using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using Autodesk.AutoCAD.Colors;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Çekirdeğin ürettiği tarifleri (CadVarlik) çizime yazar: katman, blok, öznitelik, köşe,
    /// genişletilmiş veri (XDATA), hat etiketi ve açıklık uzunluk yazıları. Görünüm (renk, çizgi tipi, yazı
    /// boyu ve yeri) telefonun DXF çıktısıyla aynıdır (bkz. Stil). Çağıranın açtığı tek bir işlem içinde
    /// çalışır; işlemi onaylamak (Commit) çağıranın işidir.
    /// </summary>
    internal sealed class CizimYazici
    {
        /// <summary>Eklentinin yönettiği XDATA uygulamaları. Yazarken bunların eski değerleri silinip yenisi yazılır.</summary>
        private static readonly string[] Yonetilen = { "GIS", "NIT", "MALZEME", "HAT", "ANAKESIT", "KONTROL", "FULLREG", "HAKNO", "ZKOORD" };

        private static readonly Regex EtiketTaniticisi = new Regex(@"/\(([0-9A-Fa-f]+)\)\s*$", RegexOptions.CultureInvariant);

        /// <summary>Blok tanımının sürüm damgası (blok kaydının uzantı sözlüğünde): "sürüm;etiket yüksekliği".</summary>
        private const string BlokDamgasi = "SH_STIL";

        private readonly Database _db;
        private readonly Transaction _tr;
        private BlockTableRecord _ms;
        private readonly Dictionary<string, ObjectId> _katmanlar = new Dictionary<string, ObjectId>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _guncelBloklar = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private bool _uygulamalar;

        /// <summary>Hat etiketlerinin ve eleman yazılarının yüksekliği (m). Telefonla aynı: 1,8.</summary>
        public double EtiketYuksekligi = Stil.EtiketYuksekligi;

        /// <summary>Bloğu değişen elemanın yeni ölçeği (0 = dokunma). Telefondan alma ve SH_STIL ayarlar.</summary>
        public double BlokOlcegi;

        /// <summary>Hat etiketini her güncellemede hattın ortasına taşı (SH_STIL); kapalıysa yalnız hat uzağa taşındıysa.</summary>
        public bool EtiketiYenidenKonumla;

        public readonly List<string> Uyarilar = new List<string>();

        /// <summary>Yeniden tanımlanan SH_ blokları (bilgi için).</summary>
        public int YenilenenBlok;

        public CizimYazici(Database db, Transaction tr)
        {
            _db = db;
            _tr = tr;
            KatalogKaynagi.SembolleriYukle();
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

        /// <summary>Katman; yoksa telefonun lejant rengi ve çizgi tipiyle oluşturulur (adı PROMAGIS düzeninde).</summary>
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
                Stil.KatmanStili(ad, out renk, out cizgi);
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

        /// <summary>Var olan şebeke katmanlarını telefonun renk ve çizgi tipine getirir (SH_STIL). Boyanan katman sayısını döndürür.</summary>
        public int KatmanlariBoya()
        {
            int n = 0;
            var lt = (LayerTable)_tr.GetObject(_db.LayerTableId, OpenMode.ForRead);
            foreach (ObjectId id in lt)
            {
                var ltr = _tr.GetObject(id, OpenMode.ForRead) as LayerTableRecord;
                if (ltr == null || !Stil.SebekeKatmani(ltr.Name)) continue;
                short renk;
                string cizgi;
                Stil.KatmanStili(ltr.Name, out renk, out cizgi);
                var cizgiId = string.IsNullOrEmpty(cizgi) ? _db.ContinuousLinetype : CizgiTipi(cizgi);
                if (cizgiId.IsNull) cizgiId = _db.ContinuousLinetype;
                bool ayniRenk = ltr.Color.ColorMethod == ColorMethod.ByAci && ltr.Color.ColorIndex == renk;
                if (ayniRenk && ltr.LinetypeObjectId == cizgiId) continue;
                ltr.UpgradeOpen();
                ltr.Color = Color.FromColorIndex(ColorMethod.ByAci, renk);
                ltr.LinetypeObjectId = cizgiId;
                n++;
            }
            return n;
        }

        /// <summary>
        /// Çizgi tipi: çizimde varsa o; telefonun DASHED (6 çizgi, 3 boşluk) ve DASHDOT (8 çizgi, 2 boşluk, nokta, 2 boşluk)
        /// tipleri yoksa aynı desenle tanımlanır (metre birimli çizimde 1/1000 paftada 6 mm çizgi); diğerleri .lin dosyasından.
        /// </summary>
        private ObjectId CizgiTipi(string ad)
        {
            if (string.IsNullOrEmpty(ad)) return ObjectId.Null;
            var ltt = (LinetypeTable)_tr.GetObject(_db.LinetypeTableId, OpenMode.ForRead);
            if (ltt.Has(ad)) return ltt[ad];
            double[] desen = null;
            string aciklama = "";
            if (ad == Stil.Kesikli) { desen = new[] { 6.0, -3.0 }; aciklama = "__ __ __ __ __ __"; }
            else if (ad == Stil.NoktaCizgi) { desen = new[] { 8.0, -2.0, 0.0, -2.0 }; aciklama = "__ . __ . __ . __"; }
            if (desen != null)
            {
                try
                {
                    var ltr = new LinetypeTableRecord { Name = ad, AsciiDescription = aciklama, NumDashes = desen.Length };
                    double toplam = 0;
                    for (int i = 0; i < desen.Length; i++) { ltr.SetDashLengthAt(i, desen[i]); toplam += Math.Abs(desen[i]); }
                    ltr.PatternLength = toplam;
                    ltt.UpgradeOpen();
                    var id = ltt.Add(ltr);
                    _tr.AddNewlyCreatedDBObject(ltr, true);
                    return id;
                }
                catch (System.Exception ex) { Uyarilar.Add("Çizgi tipi tanımlanamadı (" + ad + "): " + ex.Message); }
            }
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

        private static bool Tanimlayabilir(string ad) => ad == "GPS" || Semboller.EklentininBlogu(ad);

        /// <summary>
        /// Yeni eleman için kullanılabilecek blok: istenen blok çizimde varsa (ya da eklenti tanımlayabiliyorsa) o;
        /// yoksa çizimde aynı tür ve durumdaki elemanların PROMAGIS bloğu; o da yoksa eklentinin lejant simgesi.
        /// </summary>
        public string KullanilabilirBlok(string istenen, string tur, string cins, string durum, IEnumerable<Eleman> cizimElemanlari)
        {
            if (BlokKullanilabilir(istenen)) return istenen;
            string oneri = PromagisYazici.BlokOner(cizimElemanlari, tur, cins, durum, true);
            if (BlokKullanilabilir(oneri)) return oneri;
            return PromagisYazici.VarsayilanBlok(tur, cins, durum);
        }

        /// <summary>
        /// Blok tanımı; eklentinin kendi bloklarıysa ve çizimde yoksa oluşturulur. Eski sürümle (ya da başka etiket
        /// yüksekliğiyle) tanımlanmış bir SH_ bloğu yeniden çizilir ve çizimdeki örnekleri güncellenir.
        /// </summary>
        public ObjectId Blok(string ad)
        {
            var bt = (BlockTable)_tr.GetObject(_db.BlockTableId, OpenMode.ForRead);
            if (bt.Has(ad))
            {
                var id = bt[ad];
                if (Semboller.EklentininBlogu(ad) && !_guncelBloklar.Contains(ad))
                {
                    var btr = (BlockTableRecord)_tr.GetObject(id, OpenMode.ForRead);
                    if (!BlokGuncel(btr)) BlokYenile(btr);
                    _guncelBloklar.Add(ad);
                }
                return id;
            }
            if (!Tanimlayabilir(ad)) throw new InvalidOperationException("Blok bulunamadı: " + ad);
            bt.UpgradeOpen();
            var yeni = new BlockTableRecord { Name = ad, Origin = Point3d.Origin };
            var yeniId = bt.Add(yeni);
            _tr.AddNewlyCreatedDBObject(yeni, true);
            BlokCiz(yeni, ad);
            _guncelBloklar.Add(ad);
            return yeniId;
        }

        /// <summary>Çizimdeki tüm SH_ bloklarını güncel tanıma getirir (SH_STIL). Yenilenen blok sayısını döndürür.</summary>
        public int BloklariYenile()
        {
            int n = 0;
            var bt = (BlockTable)_tr.GetObject(_db.BlockTableId, OpenMode.ForRead);
            foreach (ObjectId id in bt)
            {
                var btr = _tr.GetObject(id, OpenMode.ForRead) as BlockTableRecord;
                if (btr == null || btr.IsLayout || btr.IsAnonymous || !Semboller.EklentininBlogu(btr.Name)) continue;
                if (BlokGuncel(btr)) { _guncelBloklar.Add(btr.Name); continue; }
                BlokYenile(btr);
                _guncelBloklar.Add(btr.Name);
                n++;
            }
            return n;
        }

        private string Damga() => Stil.BlokSurumu.ToString(CultureInfo.InvariantCulture) + ";" + EtiketYuksekligi.ToString("R", CultureInfo.InvariantCulture);

        private bool BlokGuncel(BlockTableRecord btr)
        {
            try
            {
                if (btr.ExtensionDictionary.IsNull) return false;
                var d = (DBDictionary)_tr.GetObject(btr.ExtensionDictionary, OpenMode.ForRead);
                if (!d.Contains(BlokDamgasi)) return false;
                var xr = _tr.GetObject(d.GetAt(BlokDamgasi), OpenMode.ForRead) as Xrecord;
                if (xr == null) return false;
                using (var rb = xr.Data)
                {
                    if (rb == null) return false;
                    foreach (TypedValue tv in rb) return Convert.ToString(tv.Value, CultureInfo.InvariantCulture) == Damga();
                }
            }
            catch { }
            return false;
        }

        private void DamgaYaz(BlockTableRecord btr)
        {
            if (!btr.IsWriteEnabled) btr.UpgradeOpen();
            if (btr.ExtensionDictionary.IsNull) btr.CreateExtensionDictionary();
            var d = (DBDictionary)_tr.GetObject(btr.ExtensionDictionary, OpenMode.ForWrite);
            Xrecord xr;
            if (d.Contains(BlokDamgasi)) xr = (Xrecord)_tr.GetObject(d.GetAt(BlokDamgasi), OpenMode.ForWrite);
            else
            {
                xr = new Xrecord();
                d.SetAt(BlokDamgasi, xr);
                _tr.AddNewlyCreatedDBObject(xr, true);
            }
            using (var rb = new ResultBuffer(new TypedValue((int)DxfCode.Text, Damga()))) xr.Data = rb;
        }

        /// <summary>Var olan SH_ bloğunu siler-çizer ve çizimdeki örneklerinin özniteliklerini yeni tanıma göre kurar.</summary>
        private void BlokYenile(BlockTableRecord btr)
        {
            btr.UpgradeOpen();
            var eskiler = new List<ObjectId>();
            foreach (ObjectId eid in btr) eskiler.Add(eid);
            foreach (var eid in eskiler)
            {
                var e = _tr.GetObject(eid, OpenMode.ForWrite, false) as Entity;
                if (e != null && !e.IsErased) e.Erase();
            }
            BlokCiz(btr, btr.Name);
            YenilenenBlok++;
            // Örnekler: öznitelik değerleri korunur, yeni tanıma göre yeniden kurulur
            var ornekler = btr.GetBlockReferenceIds(true, false);
            foreach (ObjectId rid in ornekler)
            {
                BlockReference br;
                try { br = _tr.GetObject(rid, OpenMode.ForWrite, false) as BlockReference; }
                catch { continue; }
                if (br == null || br.IsErased) continue;
                var degerler = OznitelikDegerleri(br);
                string etiket;
                if (!degerler.TryGetValue(Stil.EtiketOzniteligi, out etiket) || string.IsNullOrEmpty(etiket))
                    degerler[Stil.EtiketOzniteligi] = Stil.ElemanYazisi(Deger(degerler, "GIS_ID"), Deger(degerler, "TİP"));
                OznitelikleriSil(br);
                OznitelikleriKur(br, btr.ObjectId, degerler);
            }
        }

        private static string Deger(Dictionary<string, string> d, string etiket)
        {
            string s;
            return d.TryGetValue(etiket, out s) ? s : "";
        }

        private Dictionary<string, string> OznitelikDegerleri(BlockReference br)
        {
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (ObjectId aid in br.AttributeCollection)
            {
                var ar = _tr.GetObject(aid, OpenMode.ForRead, false) as AttributeReference;
                if (ar != null && !d.ContainsKey(ar.Tag)) d[ar.Tag] = ar.TextString ?? "";
            }
            return d;
        }

        private void OznitelikleriSil(BlockReference br)
        {
            foreach (ObjectId aid in br.AttributeCollection)
            {
                var eski = _tr.GetObject(aid, OpenMode.ForWrite, false) as AttributeReference;
                if (eski != null && !eski.IsErased) eski.Erase();
            }
        }

        /// <summary>
        /// Eklentinin blokları: lejant simge takımından (ortak/katalog/semboller.json) çizilir. Tablo metre
        /// cinsindendir; bloklar PROMAGIS gibi 4 ölçekle konduğundan blok birimi = metre / 4. Tabloda olmayan
        /// eski bir SH_ adı için basit daire çizilir. Yazı: tek görünür öznitelik (ETİKET = GIS no + tip), telefondaki
        /// gibi simgenin 3,5 m sağında 3 m üstünde, etiket yüksekliğinde, beyaz (7).
        /// </summary>
        private void BlokCiz(BlockTableRecord btr, string ad)
        {
            var parcalar = new List<Entity>();
            double yariGenislik = 0.5; // blok birimi
            if (ad == "GPS")
            {
                parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.15));
                parcalar.Add(new Line(new Point3d(-0.25, 0, 0), new Point3d(0.25, 0, 0)));
                parcalar.Add(new Line(new Point3d(0, -0.25, 0), new Point3d(0, 0.25, 0)));
            }
            else
            {
                var sembol = Semboller.Bul(ad);
                if (sembol != null)
                {
                    yariGenislik = sembol.YariGenislik / Semboller.BlokOlcegi;
                    foreach (var i in sembol.Ilkeller) parcalar.AddRange(IlkelVarliklari(i, 1 / Semboller.BlokOlcegi));
                }
                else
                {
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.5));
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.08));
                }
            }
            foreach (var e in parcalar)
            {
                e.SetDatabaseDefaults(_db);
                e.LayerId = _db.LayerZero;
                e.ColorIndex = 0; // BLOĞA GÖRE: elemanın rengini alır
                e.LinetypeId = _db.ByBlockLinetype;
                btr.AppendEntity(e);
                _tr.AddNewlyCreatedDBObject(e, true);
            }
            if (ad == "GPS")
            {
                for (int i = 1; i <= 6; i++) OznitelikTanimi(btr, "METIN" + i, 0.27, 0.12 - 0.17 * (i - 1), 0.1, true);
                return;
            }
            double k = 1 / Semboller.BlokOlcegi;
            // Görünen yazı: telefonla aynı yer ve boy (blok 4 ölçekle konur)
            OznitelikTanimi(btr, Stil.EtiketOzniteligi, Stil.ElemanYaziSaga * k, Stil.ElemanYaziYukari * k, EtiketYuksekligi * k, false, Stil.YaziRengi);
            // PROMAGIS'in öznitelikleri (adları aynı; görünmez, veri XDATA'da da var)
            double x = Math.Max(0.7, yariGenislik + 0.2);
            OznitelikTanimi(btr, "SIRA_NO", -yariGenislik, yariGenislik + 0.15, 0.3, true);
            OznitelikTanimi(btr, "GIS_ID", x, 0.1, 0.4, true);
            OznitelikTanimi(btr, "TİP", x, -0.47, 0.4, true);
            OznitelikTanimi(btr, "CİNS", x + 0.03, -0.73, 0.1, true);
            OznitelikTanimi(btr, "DURUM", x + 0.03, -0.9, 0.1, true);
            OznitelikTanimi(btr, "GÜÇ", x + 0.03, -1.05, 0.1, true);
            OznitelikTanimi(btr, "GERİLİM", x + 0.03, -1.2, 0.1, true);
            DamgaYaz(btr);
        }

        /// <summary>Sembol ilkelini AutoCAD varlıklarına çevirir (k: metre → blok birimi çarpanı).</summary>
        private static IEnumerable<Entity> IlkelVarliklari(SembolIlkeli i, double k)
        {
            var d = i.Sayilar;
            switch (i.Tur)
            {
                case "L":
                    if (d.Length >= 4) yield return new Line(new Point3d(d[0] * k, d[1] * k, 0), new Point3d(d[2] * k, d[3] * k, 0));
                    break;
                case "C":
                    if (d.Length >= 3) yield return new Circle(new Point3d(d[0] * k, d[1] * k, 0), Vector3d.ZAxis, d[2] * k);
                    break;
                case "P":
                    {
                        var pl = new Polyline();
                        for (int n = 0; n < i.Noktalar.Count; n++) pl.AddVertexAt(n, new Point2d(i.Noktalar[n][0] * k, i.Noktalar[n][1] * k), 0, 0, 0);
                        pl.Closed = i.Kapali;
                        yield return pl;
                        break;
                    }
                case "S":
                    if (i.Noktalar.Count >= 4)
                        yield return new Solid(
                            new Point3d(i.Noktalar[0][0] * k, i.Noktalar[0][1] * k, 0), new Point3d(i.Noktalar[1][0] * k, i.Noktalar[1][1] * k, 0),
                            new Point3d(i.Noktalar[2][0] * k, i.Noktalar[2][1] * k, 0), new Point3d(i.Noktalar[3][0] * k, i.Noktalar[3][1] * k, 0));
                    break;
                case "D": // dolu daire: r genişlikli, iki yarım yaydan kapalı çizgi (yarıçap r/2)
                    if (d.Length >= 1)
                    {
                        double r = d[0] * k;
                        var pl = new Polyline();
                        pl.AddVertexAt(0, new Point2d(-r / 2, 0), 1, r, r);
                        pl.AddVertexAt(1, new Point2d(r / 2, 0), 1, r, r);
                        pl.Closed = true;
                        yield return pl;
                    }
                    break;
                case "Y": // yarım dolu daire (sol yarı): r genişlikli açık yarım yay
                    if (d.Length >= 1)
                    {
                        double r = d[0] * k;
                        var pl = new Polyline();
                        pl.AddVertexAt(0, new Point2d(0, r / 2), 1, r, r);
                        pl.AddVertexAt(1, new Point2d(0, -r / 2), 0, r, r);
                        yield return pl;
                    }
                    break;
            }
        }

        private void OznitelikTanimi(BlockTableRecord btr, string etiket, double x, double y, double yukseklik, bool gizli, short renk = 0)
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
            ad.ColorIndex = renk; // 0 = bloğa göre
            btr.AppendEntity(ad);
            _tr.AddNewlyCreatedDBObject(ad, true);
        }

        // ---------------- Görünüm ----------------

        private void GorunumUygula(Entity e, CadVarlik v)
        {
            int renk = v.Renk == Stil.KatmanaGore ? 256 : v.Renk;
            if (e.ColorIndex != renk) e.ColorIndex = renk;
            var ct = string.IsNullOrEmpty(v.CizgiTipi) ? _db.ByLayerLinetype : CizgiTipi(v.CizgiTipi);
            if (ct.IsNull) ct = _db.ByLayerLinetype;
            if (e.LinetypeId != ct) e.LinetypeId = ct;
            if (Math.Abs(e.LinetypeScale - 1) > 1e-9) e.LinetypeScale = 1;
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
            GorunumUygula(br, v);
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
            GorunumUygula(pl, v);
            ObjectId id = Ms.AppendEntity(pl);
            _tr.AddNewlyCreatedDBObject(pl, true);
            string h = pl.Handle.ToString();
            v.H = h;
            PromagisYazici.TaniticiYaz(v, h);
            XdataYaz(pl, v);
            if (etiket != null)
            {
                EtiketYaz(pl, etiket.Replace(PromagisYazici.Tanitici, h), v.Kose);
                UzunlukYaz(pl, v.Kose);
            }
            return id;
        }

        private void OznitelikleriKur(BlockReference br, ObjectId btrId, Dictionary<string, string> oz)
        {
            var btr = (BlockTableRecord)_tr.GetObject(btrId, OpenMode.ForRead);
            if (!btr.HasAttributeDefinitions) return;
            var degerler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in oz) degerler[kv.Key] = kv.Value;
            if (!degerler.ContainsKey(Stil.EtiketOzniteligi))
                degerler[Stil.EtiketOzniteligi] = Stil.ElemanYazisi(Deger(degerler, "GIS_ID"), Deger(degerler, "TİP"));
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

        /// <summary>
        /// Var olan nesneyi tarife göre günceller (yer, köşeler, katman, blok, öznitelik, renk, XDATA, etiket ve uzunluk yazıları).
        /// xdataYaz kapalıysa PROMAGIS verisi (GIS, NIT, HAT…) elle dokunulmadan kalır; yalnız görünüm düzenlenir (SH_STIL).
        /// </summary>
        public void Guncelle(ObjectId id, CadVarlik v, string etiket, bool xdataYaz = true)
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
            GorunumUygula(ent, v);
            if (xdataYaz) XdataYaz(ent, v);
            if (etiket != null)
            {
                EtiketYaz(ent, etiket.Replace(PromagisYazici.Tanitici, h), v.Kose);
                UzunlukYaz(ent, v.Kose);
            }
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

            // Durumu değişen elemanın bloğu (ör. montajdan demontaja) ya da PROMAGIS bloğundan telefon simgesine geçiş
            if (!string.IsNullOrEmpty(v.Blok) && !v.Blok.StartsWith("*", StringComparison.Ordinal)
                && !string.Equals(EtkinAd(br), v.Blok, StringComparison.OrdinalIgnoreCase) && BlokKullanilabilir(v.Blok))
            {
                var eskiDegerler = OznitelikDegerleri(br);
                OznitelikleriSil(br);
                var yeniBlok = Blok(v.Blok);
                br.BlockTableRecord = yeniBlok;
                if (BlokOlcegi > 0 && Math.Abs(br.ScaleFactors.X - BlokOlcegi) > 1e-9) br.ScaleFactors = new Scale3d(BlokOlcegi);
                var degerler = new Dictionary<string, string>(eskiDegerler, StringComparer.OrdinalIgnoreCase);
                foreach (var kv in v.Oz) degerler[kv.Key] = kv.Value;
                degerler.Remove(Stil.EtiketOzniteligi); // GIS no + tip'ten yeniden türetilir
                OznitelikleriKur(br, yeniBlok, degerler);
                return;
            }
            // Blok aynı ama tanımı eski sürümden olabilir (ETİKET özniteliği yok): SH_ bloğu güncellenir, örnek tamamlanır
            if (Semboller.EklentininBlogu(EtkinAd(br))) Blok(EtkinAd(br));

            var istenen = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in v.Oz) istenen[kv.Key] = kv.Value;
            if (!istenen.ContainsKey(Stil.EtiketOzniteligi))
                istenen[Stil.EtiketOzniteligi] = Stil.ElemanYazisi(Deger(istenen, "GIS_ID"), Deger(istenen, "TİP"));
            var varOlan = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (ObjectId aid in br.AttributeCollection)
            {
                var ar = _tr.GetObject(aid, OpenMode.ForRead, false) as AttributeReference;
                if (ar == null) continue;
                varOlan.Add(ar.Tag);
                string d;
                if (!istenen.TryGetValue(ar.Tag, out d) || ar.TextString == (d ?? "")) continue;
                ar.UpgradeOpen();
                ar.TextString = d ?? "";
                if (ar.Justify != AttachmentPoint.BaseLeft)
                {
                    try { ar.AdjustAlignment(_db); } catch { }
                }
            }
            if (!varOlan.Contains(Stil.EtiketOzniteligi) && Semboller.EklentininBlogu(EtkinAd(br)))
            {
                // Eski eklenti sürümüyle konmuş SH_ örneği: öznitelikler yeni tanıma göre yeniden kurulur
                var degerler = OznitelikDegerleri(br);
                foreach (var kv in istenen) degerler[kv.Key] = kv.Value;
                OznitelikleriSil(br);
                OznitelikleriKur(br, br.BlockTableRecord, degerler);
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
                if (!pl.Plinegen) pl.Plinegen = true;
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

        /// <summary>Nesneyi (ve yalnız ona ait hat etiketini, uzunluk yazılarını) siler.</summary>
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
            UzunlukYazilariniSil(ent);
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

        // ---------------- Hat etiketi ve açıklık uzunlukları ----------------

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

        /// <summary>Yazının yeri: orta noktanın, yazı yönüne dik, pay kadar üstü (pay eksiyse altı). Yatay hatta telefonla birebir (y ± pay).</summary>
        private static Point3d YaziYeri(double x, double y, double aci, double pay) =>
            new Point3d(x - Math.Sin(aci) * pay, y + Math.Cos(aci) * pay, 0);

        private DBText YaziYap(string metin, Point3d yer, double aci, double yukseklik, ObjectId katman)
        {
            var yazi = new DBText();
            yazi.SetDatabaseDefaults(_db);
            yazi.TextStyleId = _db.Textstyle;
            yazi.Height = yukseklik;
            yazi.TextString = metin;
            yazi.LayerId = katman;
            yazi.ColorIndex = Stil.YaziRengi;
            yazi.Rotation = aci;
            yazi.HorizontalMode = TextHorizontalMode.TextCenter;
            yazi.VerticalMode = TextVerticalMode.TextBase;
            yazi.AlignmentPoint = yer;
            Ms.AppendEntity(yazi);
            _tr.AddNewlyCreatedDBObject(yazi, true);
            try { yazi.AdjustAlignment(_db); } catch { }
            return yazi;
        }

        /// <summary>
        /// Hat etiketi (PROMAGIS biçimi, ETK ile bağlı): hattın orta parçasının ortasında, hattın 2,5 m altında, ortalanmış,
        /// etiket yüksekliğinde, beyaz — telefonun "hat no + kesit" yazısıyla aynı yerde.
        /// </summary>
        private void EtiketYaz(Entity hat, string metin, List<double[]> kose)
        {
            double x, y, aci;
            bool konumVar = Stil.OrtaParca(kose, out x, out y, out aci);
            var hedef = YaziYeri(x, y, aci, Stil.EtiketPayi);

            var yazi = Etiket(hat);
            if (yazi != null && BaskaHattin(yazi.TextString, hat.Handle.ToString())) yazi = null;

            if (yazi == null)
            {
                if (!konumVar) return;
                yazi = YaziYap(metin, hedef, aci, EtiketYuksekligi, hat.LayerId);
            }
            else
            {
                yazi.UpgradeOpen();
                if (yazi.TextString != metin) yazi.TextString = metin;
                if (yazi.LayerId != hat.LayerId) yazi.LayerId = hat.LayerId;
                if (yazi.ColorIndex != Stil.YaziRengi) yazi.ColorIndex = Stil.YaziRengi;
                bool sol = yazi.HorizontalMode == TextHorizontalMode.TextLeft && yazi.VerticalMode == TextVerticalMode.TextBase;
                var simdi = sol ? yazi.Position : yazi.AlignmentPoint;
                // Hat başka yere taşındıysa (ya da yeniden biçimleniyorsa) etiket hattın ortasına gelir
                bool tasi = konumVar && (EtiketiYenidenKonumla || new Point2d(simdi.X, simdi.Y).GetDistanceTo(new Point2d(x, y)) > Math.Max(5.0, 10 * yazi.Height));
                if (tasi)
                {
                    yazi.Rotation = aci;
                    yazi.HorizontalMode = TextHorizontalMode.TextCenter;
                    yazi.VerticalMode = TextVerticalMode.TextBase;
                    yazi.AlignmentPoint = hedef;
                    if (Math.Abs(yazi.Height - EtiketYuksekligi) > 1e-9) yazi.Height = EtiketYuksekligi;
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

        private List<DBText> UzunlukYazilari(Entity hat)
        {
            var l = new List<DBText>();
            var xd = Toplayici.XdataOku(hat);
            List<string> hs;
            if (!xd.TryGetValue(PromagisYazici.UzunlukUygulamasi, out hs)) return l;
            foreach (var h in hs)
            {
                ObjectId tid;
                if (string.IsNullOrEmpty(h) || !Toplayici.TaniticiylaBul(_db, h, out tid)) continue;
                var t = _tr.GetObject(tid, OpenMode.ForRead, false) as DBText;
                if (t != null && !t.IsErased) l.Add(t);
            }
            return l;
        }

        private void UzunlukYazilariniSil(Entity hat)
        {
            foreach (var t in UzunlukYazilari(hat))
            {
                t.UpgradeOpen();
                t.Erase();
            }
        }

        /// <summary>
        /// Açıklık uzunlukları (telefondaki gibi): hattın her parçasının ortasında, 0,8 m üstünde, iki ondalıklı
        /// metre ("41.73"), etiketin 0,8 katı yükseklikte, beyaz. Eskileri silinip yeniden yazılır; tanıtıcıları SH_UZ'da tutulur.
        /// </summary>
        private void UzunlukYaz(Entity hat, List<double[]> kose)
        {
            UzunlukYazilariniSil(hat);
            var tanitici = new List<TypedValue> { new TypedValue((int)DxfCode.ExtendedDataRegAppName, PromagisYazici.UzunlukUygulamasi) };
            if (kose != null)
                for (int i = 1; i < kose.Count; i++)
                {
                    var a = kose[i - 1];
                    var b = kose[i];
                    double d = Geometri.Mesafe(a, b);
                    if (d < 0.01) continue;
                    double aci = Stil.YaziAcisi(b[0] - a[0], b[1] - a[1]);
                    var yer = YaziYeri((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, aci, Stil.UzunlukYaziPayi);
                    var t = YaziYap(Stil.UzunlukYazisi(d), yer, aci, EtiketYuksekligi * Stil.UzunlukYaziKatsayisi, hat.LayerId);
                    tanitici.Add(new TypedValue((int)DxfCode.ExtendedDataAsciiString, t.Handle.ToString()));
                }
            using (var rb = new ResultBuffer(tanitici.ToArray())) hat.XData = rb;
        }
    }
}
