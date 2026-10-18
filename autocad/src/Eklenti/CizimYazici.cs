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
    /// genişletilmiş veri (XDATA), hat etiketi ve parça metrajları. Görünüm ortak çizim stilinden gelir
    /// (ortak/katalog/cizim-stili.json — telefonun DXF çıktısıyla birebir). Çağıranın açtığı tek bir işlem
    /// içinde çalışır; işlemi onaylamak (Commit) çağıranın işidir.
    /// </summary>
    internal sealed class CizimYazici
    {
        /// <summary>Eklentinin yönettiği XDATA uygulamaları. Yazarken bunların eski değerleri silinip yenisi yazılır.</summary>
        private static readonly string[] Yonetilen = { "GIS", "NIT", "MALZEME", "HAT", "ANAKESIT", "KONTROL", "FULLREG", "HAKNO", "ZKOORD" };

        private static readonly Regex EtiketTaniticisi = new Regex(@"/\(([0-9A-Fa-f]+)\)\s*$", RegexOptions.CultureInvariant);

        /// <summary>
        /// Blok tanımının sürümü (blok sözlüğünde saklanır). 2: metre cinsinden geometri, 1 ölçek, telefon yazı düzeni;
        /// 3: panoda çıkış şeması öznitelikleri (C_1…C_8); 4: demontaj işaretleri simgeden taşar (DM "/", KESİK "//", SÖKÜK "X"),
        /// demontajda kafes direğin iç çarpısı yok.
        /// </summary>
        private const string BlokSurumu = "4";

        private const string Sozluk = "SEBEKE_HAKEDIS", BlokKaydi = "BLOK";

        private readonly Database _db;
        private readonly Transaction _tr;
        private BlockTableRecord _ms;
        private readonly Dictionary<string, ObjectId> _katmanlar = new Dictionary<string, ObjectId>(StringComparer.OrdinalIgnoreCase);
        private bool _uygulamalar, _bloklarDenetlendi;

        /// <summary>Yeni hat etiketlerinin ve eleman yazılarının yüksekliği (m).</summary>
        public double EtiketYuksekligi = 1.8;

        /// <summary>Güncellemede var olan hat etiketleri de yüksekliği, yeri ve açısıyla telefon düzenine getirilsin (SH_GORUNUM).</summary>
        public bool EtiketleriYenile;

        public readonly List<string> Uyarilar = new List<string>();

        public CizimYazici(Database db, Transaction tr)
        {
            _db = db;
            _tr = tr;
            KatalogKaynagi.SembolleriYukle();
            KatalogKaynagi.StiliYukle();
            if (CizimStili.Yuklu) EtiketYuksekligi = CizimStili.YaziYuksekligi;
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

        /// <summary>Katman; yoksa ortak çizim stilindeki renk ve çizgi tipiyle oluşturulur.</summary>
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

        /// <summary>Yazıların katmanı: nesnenin ön ekiyle &lt;önek&gt;_YAZI (telefondaki ELEKTRIK-YAZI karşılığı).</summary>
        private ObjectId YaziKatmani(string nesneKatmani)
        {
            string onEk, tur; int hak;
            PromagisOkuyucu.KatmanCoz(nesneKatmani, out onEk, out tur, out hak);
            if (string.IsNullOrEmpty(onEk))
            {
                int i = (nesneKatmani ?? "").IndexOf('_');
                onEk = i > 0 ? nesneKatmani.Substring(0, i) : "SC";
            }
            return Katman(onEk + "_YAZI");
        }

        /// <summary>
        /// Çizgi tipi: çizimde varsa o; yoksa ortak stildeki desenle (metre; telefonun DXF'iyle aynı) tanımlanır;
        /// desen bilinmiyorsa AutoCAD'in çizgi tipi dosyalarından yüklenir. "CONTINUOUS" → sürekli.
        /// </summary>
        private ObjectId CizgiTipi(string ad)
        {
            if (string.IsNullOrEmpty(ad)) return ObjectId.Null;
            if (string.Equals(ad, "CONTINUOUS", StringComparison.OrdinalIgnoreCase)) return _db.ContinuousLinetype;
            var ltt = (LinetypeTable)_tr.GetObject(_db.LinetypeTableId, OpenMode.ForRead);
            if (ltt.Has(ad)) return ltt[ad];
            var desen = CizimStili.Yuklu ? CizimStili.CizgiDeseni(ad) : null;
            if (desen != null && desen.Length > 0)
            {
                var ltr = new LinetypeTableRecord { Name = ad, AsciiDescription = ad, NumDashes = desen.Length };
                double toplam = 0;
                for (int i = 0; i < desen.Length; i++) { ltr.SetDashLengthAt(i, desen[i]); toplam += Math.Abs(desen[i]); }
                ltr.PatternLength = toplam;
                ltt.UpgradeOpen();
                var id = ltt.Add(ltr);
                _tr.AddNewlyCreatedDBObject(ltr, true);
                return id;
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
        /// Yeni eleman için kullanılabilecek blok: istenen blok çizimde varsa (ya da SH_ simgesiyse) o; yoksa telefon
        /// simgeleri açıkken SH_ simgesi, kapalıyken çizimde aynı tür ve durumdaki elemanların PROMAGIS bloğu, o da yoksa SH_ simgesi.
        /// </summary>
        public string KullanilabilirBlok(string istenen, string tur, string cins, string durum, string dmDurum, IEnumerable<Eleman> cizimElemanlari)
        {
            if (BlokKullanilabilir(istenen)) return istenen;
            if (PromagisYazici.TelefonSembolleri) return PromagisYazici.VarsayilanBlok(tur, cins, durum, dmDurum);
            string oneri = PromagisYazici.BlokOner(cizimElemanlari, tur, cins, durum, dmDurum);
            if (BlokKullanilabilir(oneri)) return oneri;
            return PromagisYazici.VarsayilanBlok(tur, cins, durum, dmDurum);
        }

        /// <summary>Blok tanımı; eklentinin kendi bloklarıysa ve çizimde yoksa oluşturulur, eski sürümse yenilenir.</summary>
        public ObjectId Blok(string ad)
        {
            var bt = (BlockTable)_tr.GetObject(_db.BlockTableId, OpenMode.ForRead);
            if (bt.Has(ad))
            {
                var id0 = bt[ad];
                if (Semboller.EklentininBlogu(ad))
                {
                    var eski = (BlockTableRecord)_tr.GetObject(id0, OpenMode.ForRead);
                    if (!BlokGuncel(eski)) BlokYenile(eski, ad);
                }
                return id0;
            }
            if (!Tanimlayabilir(ad)) throw new InvalidOperationException("Blok bulunamadı: " + ad);
            bt.UpgradeOpen();
            var btr = new BlockTableRecord { Name = ad, Origin = Point3d.Origin };
            var id = bt.Add(btr);
            _tr.AddNewlyCreatedDBObject(btr, true);
            BlokCiz(btr, ad);
            if (Semboller.EklentininBlogu(ad)) BlokSurumunuYaz(btr);
            return id;
        }

        /// <summary>
        /// Çizimdeki eski sürüm SH_ bloklarını (1/4 geometri, 4 ölçek; PROMAGIS düzeni yazılar) yeni düzene çevirir:
        /// geometri metre, ölçek 1, yazılar telefondaki gibi. Görünen boyut değişmez. Her yazma işleminin başında bir kez.
        /// </summary>
        public void EskiBloklariYenile()
        {
            if (_bloklarDenetlendi) return;
            _bloklarDenetlendi = true;
            var bt = (BlockTable)_tr.GetObject(_db.BlockTableId, OpenMode.ForRead);
            var adaylar = new List<ObjectId>();
            foreach (ObjectId id in bt)
            {
                var btr = _tr.GetObject(id, OpenMode.ForRead) as BlockTableRecord;
                if (btr == null || btr.IsLayout || btr.IsAnonymous || !Semboller.EklentininBlogu(btr.Name)) continue;
                if (!BlokGuncel(btr)) adaylar.Add(id);
            }
            foreach (var id in adaylar)
            {
                var btr = (BlockTableRecord)_tr.GetObject(id, OpenMode.ForRead);
                try { BlokYenile(btr, btr.Name); }
                catch (Exception ex) { Uyarilar.Add("Blok yenilenemedi: " + btr.Name + " (" + ex.Message + ")"); }
            }
        }

        private bool BlokGuncel(BlockTableRecord btr) => BlokSurumuOku(btr) == BlokSurumu;

        /// <summary>Blok tanımına yazılmış sürüm ("": damgasız, ilk sürüm).</summary>
        private string BlokSurumuOku(BlockTableRecord btr)
        {
            if (btr.ExtensionDictionary.IsNull) return "";
            var d = _tr.GetObject(btr.ExtensionDictionary, OpenMode.ForRead) as DBDictionary;
            if (d == null || !d.Contains(Sozluk)) return "";
            var alt = _tr.GetObject(d.GetAt(Sozluk), OpenMode.ForRead) as DBDictionary;
            if (alt == null || !alt.Contains(BlokKaydi)) return "";
            var xr = _tr.GetObject(alt.GetAt(BlokKaydi), OpenMode.ForRead) as Xrecord;
            if (xr == null) return "";
            using (var rb = xr.Data)
            {
                if (rb == null) return "";
                foreach (TypedValue tv in rb) return Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "";
            }
            return "";
        }

        private void BlokSurumunuYaz(BlockTableRecord btr)
        {
            if (!btr.IsWriteEnabled) btr.UpgradeOpen();
            if (btr.ExtensionDictionary.IsNull) btr.CreateExtensionDictionary();
            var d = (DBDictionary)_tr.GetObject(btr.ExtensionDictionary, OpenMode.ForWrite);
            DBDictionary alt;
            if (d.Contains(Sozluk)) alt = (DBDictionary)_tr.GetObject(d.GetAt(Sozluk), OpenMode.ForWrite);
            else
            {
                alt = new DBDictionary();
                d.SetAt(Sozluk, alt);
                _tr.AddNewlyCreatedDBObject(alt, true);
            }
            Xrecord xr;
            if (alt.Contains(BlokKaydi)) xr = (Xrecord)_tr.GetObject(alt.GetAt(BlokKaydi), OpenMode.ForWrite);
            else
            {
                xr = new Xrecord();
                alt.SetAt(BlokKaydi, xr);
                _tr.AddNewlyCreatedDBObject(xr, true);
            }
            using (var rb = new ResultBuffer(new TypedValue((int)DxfCode.Text, BlokSurumu))) xr.Data = rb;
        }

        /// <summary>Eski blok tanımını yeniden çizer ve çizimdeki örneklerinin ölçeğini / yazılarını yeni düzene getirir.</summary>
        private void BlokYenile(BlockTableRecord btr, string ad)
        {
            // Damgasız (ilk sürüm) bloklar metre/4 geometriyle 4 ölçekliydi; 2. sürümden beri geometri metre, ölçek 1
            string eskiSurum = BlokSurumuOku(btr);
            bool olcekCevir = eskiSurum == "" || eskiSurum == "1";
            if (!btr.IsWriteEnabled) btr.UpgradeOpen();
            var eskiler = new List<ObjectId>();
            foreach (ObjectId eid in btr) eskiler.Add(eid);
            foreach (var eid in eskiler)
            {
                var e = _tr.GetObject(eid, OpenMode.ForWrite, false) as Entity;
                if (e != null) e.Erase();
            }
            BlokCiz(btr, ad);
            BlokSurumunuYaz(btr);
            var ornekler = btr.GetBlockReferenceIds(true, false);
            foreach (ObjectId rid in ornekler)
            {
                var br = _tr.GetObject(rid, OpenMode.ForWrite, false) as BlockReference;
                if (br == null) continue;
                // Eski geometri metre/4 idi: ölçek 4 → 1 (görünen boyut aynı kalır)
                double s = br.ScaleFactors.X;
                double yeni = Math.Abs(s) < 1e-9 ? 1 : olcekCevir ? s / 4.0 : s;
                var degerler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var attler = new List<ObjectId>();
                foreach (ObjectId aid in br.AttributeCollection) attler.Add(aid);
                foreach (var aid in attler)
                {
                    var ar = _tr.GetObject(aid, OpenMode.ForWrite, false) as AttributeReference;
                    if (ar == null) continue;
                    degerler[ar.Tag] = ar.TextString;
                    ar.Erase();
                }
                br.ScaleFactors = new Scale3d(yeni);
                OznitelikleriKur(br, btr.ObjectId, degerler);
                br.RecordGraphicsModified(true);
            }
        }

        /// <summary>
        /// Eklentinin blokları: lejant simge takımından (ortak/katalog/semboller.json) metre cinsinden çizilir; bloklar
        /// 1 ölçekle konur (telefonun DXF'iyle aynı). Tabloda olmayan eski bir SH_ adı için basit daire çizilir.
        /// </summary>
        private void BlokCiz(BlockTableRecord btr, string ad)
        {
            var parcalar = new List<Entity>();
            double yariGenislik = 2; // metre
            double k = 1 / Semboller.BlokOlcegi;
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
                    yariGenislik = sembol.YariGenislik * k;
                    foreach (var i in sembol.Ilkeller) parcalar.AddRange(IlkelVarliklari(i, k));
                }
                else
                {
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 2 * k));
                    parcalar.Add(new Circle(Point3d.Origin, Vector3d.ZAxis, 0.3 * k));
                }
            }
            foreach (var e in parcalar)
            {
                e.SetDatabaseDefaults(_db);
                e.LayerId = _db.LayerZero;
                e.ColorIndex = 0; // BLOĞA GÖRE: elemanın rengini alır
                btr.AppendEntity(e);
                _tr.AddNewlyCreatedDBObject(e, true);
            }
            if (ad == "GPS")
            {
                for (int i = 1; i <= 6; i++) OznitelikTanimi(btr, "METIN" + i, 0.27, 0.12 - 0.17 * (i - 1), 0.1, true);
                return;
            }
            // Öznitelikler PROMAGIS bloklarıyla aynı adlarda; görünenler telefondaki yazı yerinde: sağ üstte
            // GIS numarası, altında tip (telefon tek satırda "no tip" yazar). Diğerleri gizli, küçük.
            double yh = CizimStili.Yuklu ? CizimStili.YaziYuksekligi : 1.8;
            double x = CizimStili.Yuklu ? CizimStili.ElemanKaydirma[0] : 3.5, y = CizimStili.Yuklu ? CizimStili.ElemanKaydirma[1] : 3.0;
            double satir = CizimStili.Yuklu ? CizimStili.SatirArasi : 2.2;
            double kucuk = yh * 0.25;
            OznitelikTanimi(btr, "SIRA_NO", -yariGenislik, yariGenislik + 0.5, kucuk, true);
            OznitelikTanimi(btr, "GIS_ID", x, y, yh, false);
            OznitelikTanimi(btr, "TİP", x, y - satir, yh, false);
            OznitelikTanimi(btr, "CİNS", x, y - satir - kucuk * 1.6, kucuk, true);
            OznitelikTanimi(btr, "DURUM", x, y - satir - kucuk * 3.2, kucuk, true);
            OznitelikTanimi(btr, "GÜÇ", x, y - satir - kucuk * 4.8, kucuk, true);
            OznitelikTanimi(btr, "GERİLİM", x, y - satir - kucuk * 6.4, kucuk, true);
            // Pano: PROMAGIS'in çıkış şeması öznitelikleri (gizli; PROMAGIS bloğundan geçişte değerler korunur)
            if (ad.StartsWith(Semboller.OnEk + "PANO_", StringComparison.OrdinalIgnoreCase))
                for (int i = 1; i <= 8; i++) OznitelikTanimi(btr, "C_" + i.ToString(CultureInfo.InvariantCulture), x, y - satir - kucuk * (8 + 1.6 * i), kucuk, true);
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
            EskiBloklariYenile();
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
            StilUygula(br, v);
            ObjectId id = Ms.AppendEntity(br);
            _tr.AddNewlyCreatedDBObject(br, true);
            string h = br.Handle.ToString();
            v.H = h;
            PromagisYazici.TaniticiYaz(v, h);
            OznitelikleriKur(br, btrId, v.Oz);
            XdataYaz(br, v);
            ArmaturYaz(br, v);
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
            StilUygula(pl, v);
            ObjectId id = Ms.AppendEntity(pl);
            _tr.AddNewlyCreatedDBObject(pl, true);
            string h = pl.Handle.ToString();
            v.H = h;
            PromagisYazici.TaniticiYaz(v, h);
            XdataYaz(pl, v);
            if (v.ParcaMetraji) ParcaMetrajlariYaz(pl, v.Kose);
            if (etiket != null) EtiketYaz(pl, etiket.Replace(PromagisYazici.Tanitici, h), v.Kose);
            return id;
        }

        /// <summary>Tarifteki renk ve çizgi tipini nesneye yazar (telefonun DXF'indeki gibi nesne üstünde).</summary>
        private void StilUygula(Entity e, CadVarlik v)
        {
            short r = v.Renk;
            // Telefon simgesi sonradan seçildiyse (tarif PROMAGIS bloğuyla kurulmuştu) rengi buradan
            if (r < 0 && e is BlockReference && Semboller.EklentininBlogu(v.Blok) && CizimStili.Yuklu)
            {
                string cins = v.OzDeger("CİNS") ?? "";
                r = CizimStili.ElemanRengi(PromagisOkuyucu.ElemanTuru(cins), cins, v.OzDeger("DURUM") ?? "");
            }
            if (r >= 0)
            {
                var renk = Color.FromColorIndex(r == 256 ? ColorMethod.ByLayer : ColorMethod.ByAci, r);
                if (!e.Color.Equals(renk)) e.Color = renk;
            }
            if (!string.IsNullOrEmpty(v.CizgiTipi))
            {
                var id = CizgiTipi(v.CizgiTipi);
                if (!id.IsNull && e.LinetypeId != id) e.LinetypeId = id;
            }
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

        /// <summary>Var olan nesneyi tarife göre günceller (yer, köşeler, katman, blok, öznitelik, XDATA, renk, etiket, parça metrajları).</summary>
        public void Guncelle(ObjectId id, CadVarlik v, string etiket)
        {
            UygulamalariKaydet();
            EskiBloklariYenile();
            var ent = (Entity)_tr.GetObject(id, OpenMode.ForWrite);
            string h = ent.Handle.ToString();
            v.H = h;
            PromagisYazici.TaniticiYaz(v, h);
            var katman = Katman(v.Katman);
            if (ent.LayerId != katman) ent.LayerId = katman;
            var br = ent as BlockReference;
            if (br != null) BlokGuncelle(br, v);
            else KoseleriGuncelle(ent, v);
            StilUygula(ent, v);
            XdataYaz(ent, v);
            if (br != null) ArmaturYaz(br, v);
            if (br == null && v.ParcaMetraji) ParcaMetrajlariYaz(ent, v.Kose);
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

            // Durumu değişen elemanın bloğu (ör. montajdan demontaja) ya da PROMAGIS bloğundan telefon simgesine geçiş
            if (!string.IsNullOrEmpty(v.Blok) && !v.Blok.StartsWith("*", StringComparison.Ordinal)
                && !string.Equals(EtkinAd(br), v.Blok, StringComparison.OrdinalIgnoreCase) && BlokKullanilabilir(v.Blok))
            {
                // Eski bloğun öznitelikleri (ör. pano çıkış şeması C_1…C_8) yeni blokta aynı adla varsa korunur
                var eskiDegerler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (ObjectId aid in br.AttributeCollection)
                {
                    var eski = _tr.GetObject(aid, OpenMode.ForWrite, false) as AttributeReference;
                    if (eski == null) continue;
                    eskiDegerler[eski.Tag] = eski.TextString;
                    eski.Erase();
                }
                bool eskiSh = Semboller.EklentininBlogu(EtkinAd(br));
                var yeniBlok = Blok(v.Blok);
                br.BlockTableRecord = yeniBlok;
                if (Semboller.EklentininBlogu(v.Blok) && Math.Abs(br.ScaleFactors.X - 1) > 1e-9) br.ScaleFactors = new Scale3d(1);
                else if (eskiSh && !Semboller.EklentininBlogu(v.Blok)) br.ColorIndex = 256; // PROMAGIS bloğuna dönüşte KATMANA GÖRE
                var yeniDegerler = new Dictionary<string, string>(eskiDegerler, StringComparer.OrdinalIgnoreCase);
                foreach (var kv in v.Oz) yeniDegerler[kv.Key] = kv.Value;
                OznitelikleriKur(br, yeniBlok, yeniDegerler);
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

        /// <summary>Nesneyi, yalnız ona ait hat etiketini ve parça metrajı yazılarını siler.</summary>
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
            ParcaMetrajlariSil(ent);
            var arm = ent is BlockReference ? ArmaturBul((BlockReference)ent) : null;
            if (arm != null)
            {
                arm.UpgradeOpen();
                arm.Erase();
            }
            ent.Erase();
        }

        // ---------------- Armatür simgesi (direğin malzemesi) ----------------

        /// <summary>
        /// Direğin armatür simgesi (SH_ARM verisindeki tanıtıcıyla; simgenin sahibi bu direk olmalı — AutoCAD'le kopyalanmış
        /// direk asıl direğin simgesini almasın); yoksa null. dx, dy: simgenin direğe göre saklı yeri (konumlu: yazılı mı).
        /// </summary>
        private BlockReference ArmaturBul(BlockReference direk, out double dx, out double dy, out bool konumlu)
        {
            string tanitici;
            if (!ArmaturBagi.DirekVerisi(direk, out tanitici, out dx, out dy, out konumlu)) return null;
            ObjectId id;
            if (!Toplayici.TaniticiylaBul(_db, tanitici, out id) || id.IsErased) return null;
            var br = _tr.GetObject(id, OpenMode.ForRead, false) as BlockReference;
            if (br == null || br.IsErased) return null;
            return ArmaturBagi.SimgeSahibi(br) == direk.Handle.ToString() ? br : null;
        }

        private BlockReference ArmaturBul(BlockReference direk)
        {
            double dx, dy;
            bool konumlu;
            return ArmaturBul(direk, out dx, out dy, out konumlu);
        }

        /// <summary>
        /// Direkte armatür malzemesi varsa armatürün simgesini direğin hemen yanına çizer (ya da durumunu, rengini günceller;
        /// kullanıcının taşıdığı yer korunur); armatür kalmadıysa simgeyi siler. Simge direğin katmanındadır; verisinde
        /// yalnız sahibi olan direk yazılıdır (rapora girmez). Direk AutoCAD'le taşınınca simge ArmaturTakibi ile gider.
        /// </summary>
        private void ArmaturYaz(BlockReference direk, CadVarlik v)
        {
            double dx, dy;
            bool konumlu;
            var mevcut = ArmaturBul(direk, out dx, out dy, out konumlu);
            bool gerek = !string.IsNullOrEmpty(v.Armatur) && BlokKullanilabilir(v.Armatur);
            UygulamalariKaydet();
            if (!gerek)
            {
                if (mevcut != null)
                {
                    mevcut.UpgradeOpen();
                    mevcut.Erase();
                }
                string eski;
                double ex, ey;
                bool ek;
                if (ArmaturBagi.DirekVerisi(direk, out eski, out ex, out ey, out ek)) ArmaturBagi.DirekVerisiYaz(direk, null, 0, 0);
                return;
            }
            if (mevcut == null || !konumlu) { dx = v.ArmaturDx; dy = v.ArmaturDy; }
            var konum = new Point3d(direk.Position.X + dx, direk.Position.Y + dy, direk.Position.Z);
            var btrId = Blok(v.Armatur);
            if (mevcut == null)
            {
                var br = new BlockReference(konum, btrId);
                br.SetDatabaseDefaults(_db);
                br.LayerId = direk.LayerId;
                if (v.ArmaturRengi >= 0) br.Color = Color.FromColorIndex(ColorMethod.ByAci, v.ArmaturRengi);
                Ms.AppendEntity(br);
                _tr.AddNewlyCreatedDBObject(br, true);
                ArmaturBagi.SahibiYaz(br, direk.Handle.ToString());
                ArmaturBagi.DirekVerisiYaz(direk, br.Handle.ToString(), dx, dy);
                return;
            }
            mevcut.UpgradeOpen();
            if (!konumlu) ArmaturBagi.DirekVerisiYaz(direk, mevcut.Handle.ToString(), dx, dy);
            if (mevcut.Position.DistanceTo(konum) > 1e-6) mevcut.Position = konum;
            if (mevcut.BlockTableRecord != btrId) mevcut.BlockTableRecord = btrId;
            if (mevcut.LayerId != direk.LayerId) mevcut.LayerId = direk.LayerId;
            if (v.ArmaturRengi >= 0)
            {
                var renk = Color.FromColorIndex(ColorMethod.ByAci, v.ArmaturRengi);
                if (!mevcut.Color.Equals(renk)) mevcut.Color = renk;
            }
        }

        // ---------------- Genişletilmiş veri ----------------

        private void XdataYaz(Entity e, CadVarlik v)
        {
            using (var rb = new ResultBuffer())
            {
                foreach (var app in Yonetilen) Bolum(rb, app, v.XdHepsi(app));
                List<string> kimlik;
                if (v.Xd.TryGetValue(PromagisYazici.KimlikUygulamasi, out kimlik) && kimlik.Count > 0) Bolum(rb, PromagisYazici.KimlikUygulamasi, kimlik);
                // PROMAGIS'in pano çıkış şeması / hücre verisi: yalnız tarifte varsa yazılır (yoksa çizimdeki olduğu gibi kalır)
                foreach (var app in PromagisYazici.EkUygulamalar)
                {
                    List<string> l;
                    if (v.Xd.TryGetValue(app, out l) && l.Count > 0) Bolum(rb, app, l);
                }
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

        // ---------------- Yazı konumları (telefonun DXF'iyle aynı) ----------------

        /// <summary>
        /// Parçanın (a→b) ortası + kaydırma (dünya ekseninde) ve yazı açısı: parça doğrultusu, okunur olacak biçimde
        /// (−90° … 90°] aralığına çevrilir — telefondaki DXF yazıcıyla aynı kural.
        /// </summary>
        private static void ParcaKonumu(double[] a, double[] b, double[] kaydirma, out double x, out double y, out double aci)
        {
            x = (a[0] + b[0]) / 2 + kaydirma[0];
            y = (a[1] + b[1]) / 2 + kaydirma[1];
            aci = Math.Atan2(b[1] - a[1], b[0] - a[0]);
            if (aci > Math.PI / 2) aci -= Math.PI;
            if (aci < -Math.PI / 2) aci += Math.PI;
        }

        private DBText YaziYap(string metin, double x, double y, double aci, double yukseklik, ObjectId katman)
        {
            var yazi = new DBText();
            yazi.SetDatabaseDefaults(_db);
            yazi.TextStyleId = _db.Textstyle;
            yazi.Height = yukseklik;
            yazi.TextString = metin;
            yazi.LayerId = katman;
            yazi.Rotation = aci;
            yazi.HorizontalMode = TextHorizontalMode.TextLeft;
            yazi.VerticalMode = TextVerticalMode.TextBase;
            yazi.Position = new Point3d(x, y, 0);
            Ms.AppendEntity(yazi);
            _tr.AddNewlyCreatedDBObject(yazi, true);
            return yazi;
        }

        // ---------------- Parça metrajları ----------------

        /// <summary>
        /// Her parçanın (iki köşe arası) uzunluğunu parçanın ortasına yazar ("12.34", telefondaki gibi); eski yazılar
        /// silinir. Yazıların tanıtıcıları nesnenin SH_PARCA verisinde tutulur (güncelleme ve silme için).
        /// </summary>
        public void ParcaMetrajlariYaz(Entity cizgi, List<double[]> kose)
        {
            ParcaMetrajlariSil(cizgi);
            if (kose == null || kose.Count < 2) return;
            double yh = CizimStili.Yuklu ? CizimStili.ParcaMetraji : EtiketYuksekligi * 0.8;
            double[] kaydirma = CizimStili.Yuklu ? CizimStili.ParcaKaydirma : new[] { 0.0, 0.8 };
            string bicim = CizimStili.Yuklu ? CizimStili.ParcaBicimi : "0.00";
            var katman = YaziKatmani(KatmanAdi(cizgi.LayerId));
            var taniticilar = new List<string>();
            for (int i = 0; i < kose.Count - 1; i++)
            {
                double d = Math.Sqrt(Math.Pow(kose[i + 1][0] - kose[i][0], 2) + Math.Pow(kose[i + 1][1] - kose[i][1], 2));
                if (d < 1e-6) continue;
                double x, y, aci;
                ParcaKonumu(kose[i], kose[i + 1], kaydirma, out x, out y, out aci);
                var yazi = YaziYap(d.ToString(bicim, CultureInfo.InvariantCulture), x, y, aci, yh, katman);
                taniticilar.Add(yazi.Handle.ToString());
            }
            using (var rb = new ResultBuffer())
            {
                rb.Add(new TypedValue((int)DxfCode.ExtendedDataRegAppName, PromagisYazici.ParcaUygulamasi));
                foreach (var h in taniticilar) rb.Add(new TypedValue((int)DxfCode.ExtendedDataAsciiString, h));
                if (!cizgi.IsWriteEnabled) cizgi.UpgradeOpen();
                cizgi.XData = rb;
            }
        }

        private void ParcaMetrajlariSil(Entity cizgi)
        {
            var xd = Toplayici.XdataOku(cizgi);
            List<string> l;
            if (!xd.TryGetValue(PromagisYazici.ParcaUygulamasi, out l)) return;
            foreach (var h in l)
            {
                ObjectId tid;
                if (string.IsNullOrEmpty(h) || !Toplayici.TaniticiylaBul(_db, h, out tid)) continue;
                var yazi = _tr.GetObject(tid, OpenMode.ForWrite, false) as DBText;
                if (yazi != null && !yazi.IsErased) yazi.Erase();
            }
        }

        private string KatmanAdi(ObjectId katmanId)
        {
            try { return ((LayerTableRecord)_tr.GetObject(katmanId, OpenMode.ForRead)).Name; }
            catch { return ""; }
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

        /// <summary>
        /// Hat etiketini yazar ya da günceller: orta parçanın ortasında, parça doğrultusunda, 2,5 m aşağıda
        /// (telefonun DXF'indeki hat yazısıyla aynı yer), yazı katmanında. Etiketin tanıtıcısı hattın ETK verisine yazılır.
        /// </summary>
        private void EtiketYaz(Entity hat, string metin, List<double[]> kose)
        {
            bool konumVar = kose != null && kose.Count >= 2;
            double x = 0, y = 0, aci = 0;
            if (konumVar)
            {
                int orta = (kose.Count - 1) / 2;
                ParcaKonumu(kose[orta], kose[orta + 1], CizimStili.Yuklu ? CizimStili.HatKaydirma : new[] { 0.0, -2.5 }, out x, out y, out aci);
            }
            var katman = YaziKatmani(KatmanAdi(hat.LayerId));

            var yazi = Etiket(hat);
            if (yazi != null && BaskaHattin(yazi.TextString, hat.Handle.ToString())) yazi = null;

            if (yazi == null)
            {
                if (!konumVar) return;
                yazi = YaziYap(metin, x, y, aci, EtiketYuksekligi, katman);
            }
            else
            {
                yazi.UpgradeOpen();
                if (yazi.TextString != metin) yazi.TextString = metin;
                if (yazi.LayerId != katman) yazi.LayerId = katman;
                if (EtiketleriYenile && konumVar)
                {
                    // Telefon düzeni: sola dayalı, taban çizgisinde, orta parçanın 2,5 m altında, 1,8 m
                    yazi.Height = EtiketYuksekligi;
                    yazi.HorizontalMode = TextHorizontalMode.TextLeft;
                    yazi.VerticalMode = TextVerticalMode.TextBase;
                    yazi.Position = new Point3d(x, y, 0);
                    yazi.Rotation = aci;
                }
                else
                {
                    // Hat başka yere taşındıysa etiket de hattın ortasına gelir
                    bool sol = yazi.HorizontalMode == TextHorizontalMode.TextLeft && yazi.VerticalMode == TextVerticalMode.TextBase;
                    var simdi = sol ? yazi.Position : yazi.AlignmentPoint;
                    if (konumVar && new Point2d(simdi.X, simdi.Y).GetDistanceTo(new Point2d(x, y)) > Math.Max(5.0, 10 * yazi.Height))
                    {
                        yazi.Rotation = aci;
                        if (sol) yazi.Position = new Point3d(x, y, 0);
                        else yazi.AlignmentPoint = new Point3d(x, y, 0);
                    }
                    try { yazi.AdjustAlignment(_db); } catch { }
                }
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
