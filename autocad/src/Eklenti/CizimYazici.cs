using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Autodesk.AutoCAD.Colors;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Çekirdeğin ürettiği tarifleri (CadVarlik) çizime yazar: katman, blok, öznitelik, köşe,
    /// genişletilmiş veri (XDATA) ve hat etiketi. Çağıranın açtığı tek bir işlem içinde çalışır;
    /// işlemi onaylamak (Commit) çağıranın işidir.
    /// </summary>
    internal sealed class CizimYazici
    {
        /// <summary>Eklentinin yönettiği XDATA uygulamaları. Yazarken bunların eski değerleri silinip yenisi yazılır.</summary>
        private static readonly string[] Yonetilen = { "GIS", "NIT", "MALZEME", "HAT", "ANAKESIT", "KONTROL", "FULLREG", "HAKNO", "ZKOORD" };

        private static readonly Regex EtiketTaniticisi = new Regex(@"/\(([0-9A-Fa-f]+)\)\s*$", RegexOptions.CultureInvariant);

        private readonly Database _db;
        private readonly Transaction _tr;
        private BlockTableRecord _ms;
        private readonly Dictionary<string, ObjectId> _katmanlar = new Dictionary<string, ObjectId>(StringComparer.OrdinalIgnoreCase);
        private bool _uygulamalar;

        /// <summary>Yeni hat etiketlerinin yazı yüksekliği (m).</summary>
        public double EtiketYuksekligi = 0.5;

        public readonly List<string> Uyarilar = new List<string>();

        public CizimYazici(Database db, Transaction tr)
        {
            _db = db;
            _tr = tr;
        }

        private BlockTableRecord Ms
        {
            get
            {
                if (_ms == null) _ms = (BlockTableRecord)_tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(_db), OpenMode.ForWrite);
                return _ms;
            }
        }

        // ---------------- Kayıtlar: uygulama adları, katmanlar, çizgi tipleri, bloklar ----------------

        /// <summary>XDATA uygulama adlarını çizime kaydeder (yoksa).</summary>
        public void UygulamalariKaydet()
        {
            if (_uygulamalar) return;
            var rat = (RegAppTable)_tr.GetObject(_db.RegAppTableId, OpenMode.ForRead);
            foreach (var ad in PromagisYazici.Uygulamalar)
            {
                if (rat.Has(ad)) continue;
                if (!rat.IsWriteEnabled) rat.UpgradeOpen();
                var r = new RegAppTableRecord { Name = ad };
                rat.Add(r);
                _tr.AddNewlyCreatedDBObject(r, true);
            }
            _uygulamalar = true;
        }

        /// <summary>Katman; yoksa PROMAGIS çizimlerindeki renk ve çizgi tipiyle oluşturulur.</summary>
        public ObjectId Katman(string ad)
        {
            if (string.IsNullOrWhiteSpace(ad)) return _db.LayerZero;
            ObjectId id;
            if (_katmanlar.TryGetValue(ad, out id)) return id;
            var lt = (LayerTable)_tr.GetObject(_db.LayerTableId, OpenMode.ForRead);
            if (lt.Has(ad))
            {
                id = lt[ad];
            }
            else
            {
                try { SymbolUtilityServices.ValidateSymbolName(ad, false); }
                catch
                {
                    Uyarilar.Add("Geçersiz katman adı, 0 katmanı kullanıldı: " + ad);
                    return _db.LayerZero;
                }
                short renk;
                string cizgi;
                PromagisYazici.KatmanStili(ad, out renk, out cizgi);
                var ltr = new LayerTableRecord { Name = ad, Color = Color.FromColorIndex(ColorMethod.ByAci, renk) };
                var cizgiId = CizgiTipi(cizgi);
                if (!cizgiId.IsNull) ltr.LinetypeObjectId = cizgiId;
                lt.UpgradeOpen();
                id = lt.Add(ltr);
                _tr.AddNewlyCreatedDBObject(ltr, true);
            }
            _katmanlar[ad] = id;
            return id;
        }

        private ObjectId CizgiTipi(string ad)
        {
            if (string.IsNullOrEmpty(ad)) return ObjectId.Null;
            var ltt = (LinetypeTable)_tr.GetObject(_db.LinetypeTableId, OpenMode.ForRead);
            if (ltt.Has(ad)) return ltt[ad];
            foreach (var dosya in new[] { "acadiso.lin", "acad.lin" })
            {
                try { _db.LoadLineTypeFile(ad, dosya); }
                catch { continue; }
                ltt = (LinetypeTable)_tr.GetObject(_db.LinetypeTableId, OpenMode.ForRead);
                if (ltt.Has(ad)) return ltt[ad];
            }
            return ObjectId.Null;
        }

        /// <summary>Blok çizimde var mı ya da eklenti onu tanımlayabilir mi (SH_* blokları ve GPS).</summary>
        public bool BlokKullanilabilir(string ad)
        {
            if (string.IsNullOrEmpty(ad) || ad.StartsWith("*", StringComparison.Ordinal)) return false;
            if (Tanimlayabilir(ad)) return true;
            var bt = (BlockTable)_tr.GetObject(_db.BlockTableId, OpenMode.ForRead);
            return bt.Has(ad);
        }

        private static bool Tanimlayabilir(string ad) => ad == "GPS" || ad.StartsWith("SH_", StringComparison.Ordinal);

        /// <summary>
        /// Yeni eleman için kullanılabilecek blok: istenen blok çizimde varsa o; yoksa çizimde aynı tür ve
        /// durumdaki elemanların bloğu; o da yoksa eklentinin kendi bloğu.
        /// </summary>
        public string KullanilabilirBlok(string istenen, string tur, string durum, IEnumerable<Eleman> cizimElemanlari)
        {
            if (BlokKullanilabilir(istenen)) return istenen;
            string oneri = PromagisYazici.BlokOner(cizimElemanlari, tur, durum);
            if (BlokKullanilabilir(oneri)) return oneri;
            return PromagisYazici.VarsayilanBlok(tur);
        }

        /// <summary>Blok tanımı; eklentinin kendi bloklarıysa ve çizimde yoksa oluşturulur.</summary>
        public ObjectId Blok(string ad)
        {
            var bt = (BlockTable)_tr.GetObject(_db.BlockTableId, OpenMode.ForRead);
            if (bt.Has(ad)) return bt[ad];
            if (!Tanimlayabilir(ad)) throw new InvalidOperationException("Blok bulunamadı: " + ad);
            bt.UpgradeOpen();
            var btr = new BlockTableRecord { Name = ad, Origin = Point3d.Origin };
            var id = bt.Add(btr);
            _tr.AddNewlyCreatedDBObject(btr, true);
            BlokCiz(btr, ad);
            return id;
        }

        /// <summary>Eklentinin blokları: blok biriminde çizilir, elemanlar PROMAGIS gibi 4 ölçekle konur.</summary>
        private void BlokCiz(BlockTableRecord btr, string ad)
        {
            var parcalar = new List<Entity>();
            switch (ad)
            {
                case "GPS":
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.15));
                    parcalar.Add(new Line(new Point3d(-0.25, 0, 0), new Point3d(0.25, 0, 0)));
                    parcalar.Add(new Line(new Point3d(0, -0.25, 0), new Point3d(0, 0.25, 0)));
                    break;
                case "SH_TRAFO_DIREGI":
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.5));
                    parcalar.Add(Cokgen(true, 0, 0.42, -0.36, -0.21, 0.36, -0.21));
                    break;
                case "SH_TRAFO_MERKEZI":
                    parcalar.Add(Cokgen(true, -0.6, -0.6, 0.6, -0.6, 0.6, 0.6, -0.6, 0.6));
                    parcalar.Add(new Line(new Point3d(-0.6, -0.6, 0), new Point3d(0.6, 0.6, 0)));
                    break;
                case "SH_PANO":
                    parcalar.Add(Cokgen(true, -0.6, -0.35, 0.6, -0.35, 0.6, 0.35, -0.6, 0.35));
                    parcalar.Add(new Line(new Point3d(-0.6, 0, 0), new Point3d(0.6, 0, 0)));
                    break;
                case "SH_BOX":
                    parcalar.Add(Cokgen(true, -0.4, -0.4, 0.4, -0.4, 0.4, 0.4, -0.4, 0.4));
                    parcalar.Add(new Line(new Point3d(-0.4, -0.4, 0), new Point3d(0.4, 0.4, 0)));
                    parcalar.Add(new Line(new Point3d(-0.4, 0.4, 0), new Point3d(0.4, -0.4, 0)));
                    break;
                case "SH_EK_MUFU":
                    parcalar.Add(Cokgen(true, 0, 0.35, 0.35, 0, 0, -0.35, -0.35, 0));
                    break;
                case "SH_KOFRE":
                    parcalar.Add(Cokgen(true, -0.35, -0.22, 0.35, -0.22, 0.35, 0.22, -0.35, 0.22));
                    break;
                case "SH_DIGER":
                    parcalar.Add(Cokgen(true, 0, 0.4, 0.4, 0, 0, -0.4, -0.4, 0));
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.08));
                    break;
                default: // SH_DIREK
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.5));
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.08));
                    break;
            }
            foreach (var e in parcalar)
            {
                e.SetDatabaseDefaults(_db);
                e.LayerId = _db.LayerZero;
                e.ColorIndex = 0; // BLOĞA GÖRE: elemanın katman rengini alır
                btr.AppendEntity(e);
                _tr.AddNewlyCreatedDBObject(e, true);
            }
            if (ad == "GPS")
            {
                for (int i = 1; i <= 6; i++) OznitelikTanimi(btr, "METIN" + i, 0.27, 0.12 - 0.17 * (i - 1), 0.1, true);
                return;
            }
            OznitelikTanimi(btr, "SIRA_NO", -0.5, 0.65, 0.3, true);
            OznitelikTanimi(btr, "GIS_ID", 0.7, 0.1, 0.4, false);
            OznitelikTanimi(btr, "TİP", 0.7, -0.47, 0.4, false);
            OznitelikTanimi(btr, "CİNS", 0.73, -0.73, 0.1, true);
            OznitelikTanimi(btr, "DURUM", 0.73, -0.9, 0.1, true);
            OznitelikTanimi(btr, "GÜÇ", 0.73, -1.05, 0.1, true);
            OznitelikTanimi(btr, "GERİLİM", 0.73, -1.2, 0.1, true);
        }

        private static Polyline Cokgen(bool kapali, params double[] xy)
        {
            var pl = new Polyline();
            for (int i = 0; i + 1 < xy.Length; i += 2) pl.AddVertexAt(i / 2, new Point2d(xy[i], xy[i + 1]), 0, 0, 0);
            pl.Closed = kapali;
            return pl;
        }

        private void OznitelikTanimi(BlockTableRecord btr, string etiket, double x, double y, double yukseklik, bool gizli)
        {
            var ad = new AttributeDefinition();
            ad.SetDatabaseDefaults(_db);
            ad.Position = new Point3d(x, y, 0);
            ad.Tag = etiket;
            ad.Prompt = etiket;
            ad.TextString = "";
            ad.Height = yukseklik;
            ad.Invisible = gizli;
            ad.LayerId = _db.LayerZero;
            ad.TextStyleId = _db.Textstyle;
            btr.AppendEntity(ad);
            _tr.AddNewlyCreatedDBObject(ad, true);
        }

        // ---------------- Yeni nesne ----------------

        /// <summary>
        /// Tarifi çizime ekler. {H} yer tutucusu nesnenin gerçek tanıtıcısıyla değiştirilir (tarif de güncellenir).
        /// etiket: hat etiketi ({H} ile) ya da null. olcek: blok ölçeği.
        /// </summary>
        public ObjectId Ekle(CadVarlik v, string etiket, double olcek)
        {
            UygulamalariKaydet();
            if (v.Tur == "INSERT") return BlokEkle(v, olcek);
            return CizgiEkle(v, etiket);
        }

        private ObjectId BlokEkle(CadVarlik v, double olcek)
        {
            ObjectId btrId = Blok(v.Blok);
            var br = new BlockReference(new Point3d(v.X, v.Y, v.Z), btrId);
            br.SetDatabaseDefaults(_db);
            br.LayerId = Katman(v.Katman);
            br.Rotation = v.Aci;
            if (olcek > 0 && Math.Abs(olcek - 1) > 1e-9) br.ScaleFactors = new Scale3d(olcek);
            ObjectId id = Ms.AppendEntity(br);
            _tr.AddNewlyCreatedDBObject(br, true);
            string h = br.Handle.ToString();
            v.H = h;
            PromagisYazici.TaniticiYaz(v, h);
            OznitelikleriKur(br, btrId, v.Oz);
            XdataYaz(br, v);
            return id;
        }

        private ObjectId CizgiEkle(CadVarlik v, string etiket)
        {
            var pl = new Polyline();
            pl.SetDatabaseDefaults(_db);
            for (int i = 0; i < v.Kose.Count; i++) pl.AddVertexAt(i, new Point2d(v.Kose[i][0], v.Kose[i][1]), 0, 0, 0);
            pl.Closed = v.Kapali;
            pl.Plinegen = true; // kesikli çizgi tipi köşelerde bölünmesin
            pl.LayerId = Katman(v.Katman);
            ObjectId id = Ms.AppendEntity(pl);
            _tr.AddNewlyCreatedDBObject(pl, true);
            string h = pl.Handle.ToString();
            v.H = h;
            PromagisYazici.TaniticiYaz(v, h);
            XdataYaz(pl, v);
            if (etiket != null) EtiketYaz(pl, etiket.Replace(PromagisYazici.Tanitici, h), v.Kose);
            return id;
        }

        private void OznitelikleriKur(BlockReference br, ObjectId btrId, Dictionary<string, string> oz)
        {
            var btr = (BlockTableRecord)_tr.GetObject(btrId, OpenMode.ForRead);
            if (!btr.HasAttributeDefinitions) return;
            var degerler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in oz) degerler[kv.Key] = kv.Value;
            foreach (ObjectId eid in btr)
            {
                var tanim = _tr.GetObject(eid, OpenMode.ForRead) as AttributeDefinition;
                if (tanim == null || tanim.Constant) continue;
                var ar = new AttributeReference();
                ar.SetAttributeFromBlock(tanim, br.BlockTransform);
                string d;
                if (degerler.TryGetValue(tanim.Tag, out d)) ar.TextString = d ?? "";
                br.AttributeCollection.AppendAttribute(ar);
                _tr.AddNewlyCreatedDBObject(ar, true);
                if (tanim.Justify != AttachmentPoint.BaseLeft)
                {
                    try { ar.AdjustAlignment(_db); } catch { }
                }
            }
        }

        // ---------------- Var olan nesneyi güncelleme ----------------

        /// <summary>Var olan nesneyi tarife göre günceller (yer, köşeler, katman, blok, öznitelik, XDATA, etiket).</summary>
        public void Guncelle(ObjectId id, CadVarlik v, string etiket)
        {
            UygulamalariKaydet();
            var ent = (Entity)_tr.GetObject(id, OpenMode.ForWrite);
            string h = ent.Handle.ToString();
            v.H = h;
            PromagisYazici.TaniticiYaz(v, h);
            var katman = Katman(v.Katman);
            if (ent.LayerId != katman) ent.LayerId = katman;
            var br = ent as BlockReference;
            if (br != null) BlokGuncelle(br, v);
            else KoseleriGuncelle(ent, v);
            XdataYaz(ent, v);
            if (etiket != null) EtiketYaz(ent, etiket.Replace(PromagisYazici.Tanitici, h), v.Kose);
        }

        private string EtkinAd(BlockReference br)
        {
            try
            {
                var id = br.IsDynamicBlock ? br.DynamicBlockTableRecord : br.BlockTableRecord;
                var btr = (BlockTableRecord)_tr.GetObject(id, OpenMode.ForRead);
                return btr.Name;
            }
            catch { return br.Name; }
        }

        private void BlokGuncelle(BlockReference br, CadVarlik v)
        {
            // Yer ve açı TransformBy ile değişir: öznitelik yazıları da bloğa uyar
            var yeni = new Point3d(v.X, v.Y, v.Z);
            if (br.Position.DistanceTo(yeni) > 1e-6) br.TransformBy(Matrix3d.Displacement(yeni - br.Position));
            double fark = Math.IEEERemainder(v.Aci - br.Rotation, 2 * Math.PI);
            if (Math.Abs(fark) > 1e-9) br.TransformBy(Matrix3d.Rotation(fark, br.Normal, br.Position));

            // Durumu değişen elemanın bloğu (ör. montajdan demontaja)
            if (!string.IsNullOrEmpty(v.Blok) && !v.Blok.StartsWith("*", StringComparison.Ordinal)
                && !string.Equals(EtkinAd(br), v.Blok, StringComparison.OrdinalIgnoreCase) && BlokKullanilabilir(v.Blok))
            {
                foreach (ObjectId aid in br.AttributeCollection)
                {
                    var eski = _tr.GetObject(aid, OpenMode.ForWrite, false) as AttributeReference;
                    if (eski != null) eski.Erase();
                }
                var yeniBlok = Blok(v.Blok);
                br.BlockTableRecord = yeniBlok;
                OznitelikleriKur(br, yeniBlok, v.Oz);
                return;
            }

            var degerler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in v.Oz) degerler[kv.Key] = kv.Value;
            foreach (ObjectId aid in br.AttributeCollection)
            {
                var ar = _tr.GetObject(aid, OpenMode.ForRead, false) as AttributeReference;
                if (ar == null) continue;
                string d;
                if (!degerler.TryGetValue(ar.Tag, out d) || ar.TextString == (d ?? "")) continue;
                ar.UpgradeOpen();
                ar.TextString = d ?? "";
                if (ar.Justify != AttachmentPoint.BaseLeft)
                {
                    try { ar.AdjustAlignment(_db); } catch { }
                }
            }
        }

        private void KoseleriGuncelle(Entity ent, CadVarlik v)
        {
            int n = v.Kose.Count;
            if (n < 2) return;
            if (ent is Polyline pl)
            {
                while (pl.NumberOfVertices > n) pl.RemoveVertexAt(pl.NumberOfVertices - 1);
                for (int i = 0; i < n; i++)
                {
                    var p = new Point2d(v.Kose[i][0], v.Kose[i][1]);
                    if (i < pl.NumberOfVertices)
                    {
                        if (pl.GetPoint2dAt(i).GetDistanceTo(p) > 1e-6) pl.SetPointAt(i, p);
                    }
                    else pl.AddVertexAt(i, p, 0, 0, 0);
                }
                if (pl.Closed != v.Kapali) pl.Closed = v.Kapali;
                return;
            }
            if (ent is Polyline2d p2)
            {
                var koseler = new List<Vertex2d>();
                foreach (ObjectId vid in p2)
                {
                    var vx = _tr.GetObject(vid, OpenMode.ForRead, false) as Vertex2d;
                    if (vx != null && vx.VertexType != Vertex2dType.SplineControlVertex) koseler.Add(vx);
                }
                for (int i = 0; i < n; i++)
                {
                    var hedef = new Point3d(v.Kose[i][0], v.Kose[i][1], p2.Elevation);
                    if (i < koseler.Count)
                    {
                        var eski = koseler[i].Position;
                        if (Math.Abs(eski.X - hedef.X) > 1e-6 || Math.Abs(eski.Y - hedef.Y) > 1e-6)
                        {
                            koseler[i].UpgradeOpen();
                            koseler[i].Position = new Point3d(hedef.X, hedef.Y, eski.Z);
                        }
                    }
                    else
                    {
                        var yeni = new Vertex2d(hedef, 0, 0, 0, 0);
                        p2.AppendVertex(yeni);
                        _tr.AddNewlyCreatedDBObject(yeni, true);
                    }
                }
                for (int i = n; i < koseler.Count; i++)
                {
                    koseler[i].UpgradeOpen();
                    koseler[i].Erase();
                }
                if (p2.Closed != v.Kapali) p2.Closed = v.Kapali;
                return;
            }
            if (ent is Polyline3d p3)
            {
                var koseler = new List<PolylineVertex3d>();
                foreach (ObjectId vid in p3)
                {
                    var vx = _tr.GetObject(vid, OpenMode.ForRead, false) as PolylineVertex3d;
                    if (vx != null && vx.VertexType != Vertex3dType.ControlVertex) koseler.Add(vx);
                }
                for (int i = 0; i < n; i++)
                {
                    if (i < koseler.Count)
                    {
                        var eski = koseler[i].Position;
                        if (Math.Abs(eski.X - v.Kose[i][0]) > 1e-6 || Math.Abs(eski.Y - v.Kose[i][1]) > 1e-6)
                        {
                            koseler[i].UpgradeOpen();
                            koseler[i].Position = new Point3d(v.Kose[i][0], v.Kose[i][1], eski.Z);
                        }
                    }
                    else
                    {
                        var yeni = new PolylineVertex3d(new Point3d(v.Kose[i][0], v.Kose[i][1], 0));
                        p3.AppendVertex(yeni);
                        _tr.AddNewlyCreatedDBObject(yeni, true);
                    }
                }
                for (int i = n; i < koseler.Count; i++)
                {
                    koseler[i].UpgradeOpen();
                    koseler[i].Erase();
                }
                if (p3.Closed != v.Kapali) p3.Closed = v.Kapali;
            }
        }

        // ---------------- Silme ----------------

        /// <summary>Nesneyi (ve yalnız ona ait hat etiketini) siler.</summary>
        public void Sil(ObjectId id)
        {
            if (id.IsNull || id.IsErased) return;
            var ent = _tr.GetObject(id, OpenMode.ForWrite, false) as Entity;
            if (ent == null) return;
            var yazi = Etiket(ent);
            if (yazi != null && !BaskaHattin(yazi.TextString, ent.Handle.ToString()))
            {
                yazi.UpgradeOpen();
                yazi.Erase();
            }
            ent.Erase();
        }

        // ---------------- Genişletilmiş veri ----------------

        private void XdataYaz(Entity e, CadVarlik v)
        {
            using (var rb = new ResultBuffer())
            {
                foreach (var app in Yonetilen) Bolum(rb, app, v.XdHepsi(app));
                List<string> kimlik;
                if (v.Xd.TryGetValue(PromagisYazici.KimlikUygulamasi, out kimlik) && kimlik.Count > 0) Bolum(rb, PromagisYazici.KimlikUygulamasi, kimlik);
                e.XData = rb;
            }
        }

        private void Bolum(ResultBuffer rb, string app, List<string> degerler)
        {
            rb.Add(new TypedValue((int)DxfCode.ExtendedDataRegAppName, app));
            foreach (var d in degerler)
            {
                string s = d ?? "";
                if (s.Length > 250)
                {
                    Uyarilar.Add("Çok uzun bilgi satırı kısaltıldı (" + app + "): " + s.Substring(0, 40) + "…");
                    s = s.Substring(0, 250);
                }
                rb.Add(new TypedValue((int)DxfCode.ExtendedDataAsciiString, s));
            }
        }

        // ---------------- Hat etiketi ----------------

        private DBText Etiket(Entity hat)
        {
            var xd = Toplayici.XdataOku(hat);
            List<string> etk;
            if (!xd.TryGetValue("ETK", out etk) || etk.Count == 0 || string.IsNullOrEmpty(etk[0])) return null;
            ObjectId tid;
            if (!Toplayici.TaniticiylaBul(_db, etk[0], out tid)) return null;
            return _tr.GetObject(tid, OpenMode.ForRead, false) as DBText;
        }

        /// <summary>Etiket başka bir hatta mı ait ("…/(TANITICI)" sonu farklı)? Kopyalanmış hatlar aynı etiketi gösterebilir.</summary>
        private static bool BaskaHattin(string metin, string handle)
        {
            var m = EtiketTaniticisi.Match(metin ?? "");
            return m.Success && !string.Equals(m.Groups[1].Value, handle, StringComparison.OrdinalIgnoreCase);
        }

        private void EtiketYaz(Entity hat, string metin, List<double[]> kose)
        {
            double x, y, aci;
            bool konumVar = Geometri.EtiketKonumu(kose, out x, out y, out aci);
            double pay = EtiketYuksekligi * 0.3;
            var hedef = new Point3d(x - Math.Sin(aci) * pay, y + Math.Cos(aci) * pay, 0);

            var yazi = Etiket(hat);
            if (yazi != null && BaskaHattin(yazi.TextString, hat.Handle.ToString())) yazi = null;

            if (yazi == null)
            {
                if (!konumVar) return;
                yazi = new DBText();
                yazi.SetDatabaseDefaults(_db);
                yazi.TextStyleId = _db.Textstyle;
                yazi.Height = EtiketYuksekligi;
                yazi.TextString = metin;
                yazi.LayerId = hat.LayerId;
                yazi.Rotation = aci;
                yazi.HorizontalMode = TextHorizontalMode.TextCenter;
                yazi.VerticalMode = TextVerticalMode.TextBottom;
                yazi.AlignmentPoint = hedef;
                Ms.AppendEntity(yazi);
                _tr.AddNewlyCreatedDBObject(yazi, true);
                try { yazi.AdjustAlignment(_db); } catch { }
            }
            else
            {
                yazi.UpgradeOpen();
                if (yazi.TextString != metin) yazi.TextString = metin;
                if (yazi.LayerId != hat.LayerId) yazi.LayerId = hat.LayerId;
                // Hat başka yere taşındıysa etiket de hattın ortasına gelir
                bool sol = yazi.HorizontalMode == TextHorizontalMode.TextLeft && yazi.VerticalMode == TextVerticalMode.TextBase;
                var simdi = sol ? yazi.Position : yazi.AlignmentPoint;
                if (konumVar && new Point2d(simdi.X, simdi.Y).GetDistanceTo(new Point2d(x, y)) > Math.Max(5.0, 10 * yazi.Height))
                {
                    yazi.Rotation = aci;
                    if (sol) yazi.Position = hedef;
                    else yazi.AlignmentPoint = hedef;
                }
                try { yazi.AdjustAlignment(_db); } catch { }
            }

            using (var rb = new ResultBuffer(
                new TypedValue((int)DxfCode.ExtendedDataRegAppName, "ETK"),
                new TypedValue((int)DxfCode.ExtendedDataAsciiString, yazi.Handle.ToString())))
            {
                hat.XData = rb;
            }
        }
    }
}
