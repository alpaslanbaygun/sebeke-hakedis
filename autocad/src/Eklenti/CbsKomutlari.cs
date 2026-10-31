using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.Colors;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
using WinForms = System.Windows.Forms;

[assembly: CommandClass(typeof(SebekeHakedis.Eklenti.CbsKomutlari))]

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Çizimi başka programlara aktarma: Google Earth (KML / KMZ) ve CBS (MapInfo MIF / MID). Koordinatlar çizimin
    /// 3° TM diliminden çevrilir; dilim çizimin ayarlarında yoksa bir kez sorulur.
    /// </summary>
    public sealed class CbsKomutlari
    {
        /// <summary>Google Earth dosyası: her proje (bölge) bir klasör; elemanlar, hatlar, kanallar, sondajlar bilgileriyle.</summary>
        [CommandMethod("SH_KML", CommandFlags.Modal)]
        public void Kml()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Google Earth'e aktarma", () =>
            {
                var o = Ortam.Hazirla(belge);
                var p = o.Proje;
                if (!VeriVar(p)) return;
                int dom = DilimIste(o, "Google Earth dosyası");
                if (dom == 0) return;
                if (!KoordinatUygun(p)) return;
                string yol = Komutlar.KayitYeriSor("Google Earth dosyasını kaydet", "Google Earth KMZ (*.kmz)|*.kmz|Google Earth KML (*.kml)|*.kml",
                    Komutlar.Ad(belge) + ".kmz", Komutlar.Klasor(belge));
                if (yol == null) return;
                KmlYazici.Yaz(p, dom, yol, Uygulama.Surum);
                int sayi = CbsYapisi.Nesneler(p).Count;
                Uygulama.Yaz("Google Earth dosyası hazır: " + yol + " (" + sayi + " nesne, " + Koordinat.DilimAdi(dom) + ").");
                Komutlar.Ac(yol, "Google Earth dosyası hazır");
            });
        }

        /// <summary>
        /// CBS'ye MIF / MID: her nesne türü ayrı dosya çifti (ad_ELEMAN, ad_HAT, ad_KANAL, ad_SONDAJ, ad_BOLGE, ad_NOKTA);
        /// koordinatlar çizim koordinatı (ITRF96 3° TM), sütunlar GIS no, tür, tip, durum, hakediş, proje, metraj...
        /// </summary>
        [CommandMethod("SH_MIFVER", CommandFlags.Modal)]
        public void MifVer()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("CBS'ye (MIF) aktarma", () =>
            {
                var o = Ortam.Hazirla(belge);
                var p = o.Proje;
                if (!VeriVar(p)) return;
                int dom = DilimIste(o, "CBS (MIF) dosyası");
                if (dom == 0) return;
                if (!KoordinatUygun(p)) return;
                string yol = Komutlar.KayitYeriSor("CBS dosyalarının adı (her nesne türü ayrı dosya: ad_ELEMAN.mif, ad_HAT.mif …)", "MapInfo MIF (*.mif)|*.mif",
                    Komutlar.Ad(belge) + ".mif", Komutlar.Klasor(belge));
                if (yol == null) return;
                string klasor = Path.GetDirectoryName(yol), ad = Path.GetFileNameWithoutExtension(yol);
                // Kullanıcı eski bir katman dosyasını seçtiyse katman eki atılır (ad_ELEMAN → ad)
                foreach (var k in CbsYapisi.Katmanlar)
                    if (ad.EndsWith("_" + k.Ad, StringComparison.OrdinalIgnoreCase)) { ad = ad.Substring(0, ad.Length - k.Ad.Length - 1); break; }
                var var_ = new List<string>();
                foreach (var k in CbsYapisi.Katmanlar)
                {
                    string f = Path.Combine(klasor, ad + "_" + k.Ad + ".mif");
                    if (File.Exists(f) || File.Exists(Path.ChangeExtension(f, ".mid"))) var_.Add(Path.GetFileName(f));
                }
                if (var_.Count > 0 && !Pencereler.Onay("Bu klasörde aynı adlı CBS dosyaları var:\n" + string.Join(", ", var_.ToArray()) + "\n\nÜzerlerine yazılsın mı?", false)) return;
                var yazilan = MifDosyasi.Yaz(p, dom, klasor, ad);
                var adlar = yazilan.ConvertAll(Path.GetFileNameWithoutExtension);
                Uygulama.Yaz("CBS dosyaları yazıldı (" + Koordinat.DilimAdi(dom) + "): " + string.Join(", ", adlar.ToArray()) + " (.mif + .mid) → " + klasor);
                if (yazilan.Count > 0 && Pencereler.Onay("CBS dosyaları yazıldı (" + yazilan.Count + " katman, her biri .mif + .mid):\n" + string.Join("\n", adlar.ToArray()) +
                                                         "\n\nKlasör açılsın mı?"))
                {
                    try { Process.Start(new ProcessStartInfo("explorer.exe", "/select,\"" + yazilan[0] + "\"") { UseShellExecute = true }); }
                    catch (System.Exception ex) { Uygulama.Yaz("Klasör açılamadı: " + ex.Message); }
                }
            });
        }

        /// <summary>
        /// CBS'den MIF / MID: seçilen dosyalardaki noktalar, çizgiler, alanlar ve yazılar çizime altlık olarak çizilir (her dosya
        /// "CBS-dosya adı" katmanına). Koordinatlar çizimin dilimine çevrilir. Bilgileri nesnede saklanır (SH_CBSBILGI ile
        /// görülür). Altlık nesneleri hakediş nesnesi değildir: rapora ve telefona girmez.
        /// </summary>
        [CommandMethod("SH_MIFAL", CommandFlags.Modal | CommandFlags.Redraw)]
        public void MifAl()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("CBS'den (MIF) alma", () =>
            {
                string[] dosyalar;
                using (var dlg = new WinForms.OpenFileDialog
                {
                    Title = "CBS dosyalarını seçin (MapInfo MIF; yanında aynı adlı MID dosyası)",
                    Filter = "MapInfo MIF (*.mif)|*.mif",
                    Multiselect = true,
                    InitialDirectory = Komutlar.Klasor(belge),
                })
                {
                    if (dlg.ShowDialog() != WinForms.DialogResult.OK) return;
                    dosyalar = dlg.FileNames;
                }
                if (dosyalar == null || dosyalar.Length == 0) return;
                var o = Ortam.Hazirla(belge);
                var veriler = new List<KeyValuePair<string, MifVerisi>>();
                foreach (var f in dosyalar)
                {
                    string mid = Path.ChangeExtension(f, ".mid");
                    var v = MifDosyasi.Oku(MifDosyasi.DosyaMetni(File.ReadAllBytes(f)), File.Exists(mid) ? MifDosyasi.DosyaMetni(File.ReadAllBytes(mid)) : null);
                    if (!File.Exists(mid)) v.Uyarilar.Add("MID dosyası bulunamadı; nesneler bilgisiz alındı.");
                    veriler.Add(new KeyValuePair<string, MifVerisi>(Path.GetFileNameWithoutExtension(f), v));
                }

                // Dilim: çizimde yoksa TM dosyasının dilimi; coğrafi dosyada sorulur
                int dom = o.Ayar.Dom;
                bool cevrilecek = veriler.Exists(x => x.Value.Sistem == "tm" || x.Value.Sistem == "cografi");
                if (dom == 0 && cevrilecek)
                {
                    var tm = veriler.Find(x => x.Value.Sistem == "tm" && Array.IndexOf(Turler.Domlar, (int)Math.Round(x.Value.OrtaMeridyen)) >= 0 &&
                                               Math.Abs(x.Value.Olcek - 1) < 1e-9 && Math.Abs(x.Value.OrtaMeridyen - Math.Round(x.Value.OrtaMeridyen)) < 1e-9);
                    if (tm.Value != null)
                    {
                        dom = (int)Math.Round(tm.Value.OrtaMeridyen);
                        o.Ayar.Dom = dom;
                        o.AyarKaydet();
                        Uygulama.Yaz("Çizimin koordinat dilimi dosyadaki gibi " + dom + "° alındı ve ayarlara kaydedildi.");
                    }
                    else
                    {
                        dom = DilimIste(o, "CBS dosyasının koordinatlarını çevirmek");
                        if (dom == 0) return;
                    }
                }
                foreach (var kv in veriler) MifDosyasi.CizimeCevir(kv.Value, dom);

                int cizilen = 0, atlanan = 0;
                var kapsam = new Extents3d();
                bool kapsamVar = false;
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var c = new CbsCizici(o.Db, tr);
                    foreach (var kv in veriler)
                    {
                        cizilen += c.Ciz(kv.Key, kv.Value);
                        atlanan += kv.Value.Atlanan;
                    }
                    if (c.KapsamVar) { kapsam = c.Kapsam; kapsamVar = true; }
                    tr.Commit();
                }
                var ed = belge.Editor;
                foreach (var kv in veriler)
                {
                    var v = kv.Value;
                    ed.WriteMessage("\n" + kv.Key + ": " + v.Nesneler.Count + " nesne (" + SistemAdi(v) + ")" + (v.Atlanan > 0 ? ", " + v.Atlanan + " okunamadı" : ""));
                    foreach (var u in v.Uyarilar) ed.WriteMessage("\n   Uyarı: " + u);
                }
                Uygulama.Yaz("CBS'den alındı: " + cizilen + " nesne çizildi (katmanlar CBS-…). Bilgileri görmek için SH_CBSBILGI ile nesneyi seçin.");
                if (kapsamVar) CizimKomutlari.Yakinlas(ed, kapsam);
            });
        }

        /// <summary>CBS'den alınan nesnenin bilgileri (MID satırı) bir pencerede.</summary>
        [CommandMethod("SH_CBSBILGI", CommandFlags.Modal)]
        public void CbsBilgi()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("CBS bilgisi", () =>
            {
                var ed = belge.Editor;
                var pe = ed.GetEntity("\nCBS'den alınan nesneyi seçin: ");
                if (pe.Status != PromptStatus.OK) return;
                List<string[]> satirlar;
                string dosya;
                using (var tr = belge.Database.TransactionManager.StartTransaction())
                {
                    var ent = (Entity)tr.GetObject(pe.ObjectId, OpenMode.ForRead);
                    satirlar = CbsCizici.BilgiOku(ent, out dosya);
                    tr.Commit();
                }
                if (satirlar == null) { Pencereler.Uyar("Bu nesnede CBS bilgisi yok (SH_MIFAL ile alınan nesneleri seçin)."); return; }
                Pencereler.CbsBilgisi(dosya, satirlar);
            });
        }

        private static string SistemAdi(MifVerisi v)
        {
            switch (v.Sistem)
            {
                case "tm": return "TM " + v.OrtaMeridyen.ToString("0.###", CultureInfo.InvariantCulture) + "°" + (Math.Abs(v.Olcek - 1) > 1e-9 ? " ölçek " + v.Olcek.ToString("0.####", CultureInfo.InvariantCulture) : "");
                case "cografi": return "enlem-boylam";
                case "duz": return "düz koordinat";
                default: return "koordinat sistemi bilinmiyor";
            }
        }

        // ---------------- Ortak ----------------

        /// <summary>Çizimde aktarılacak şebeke verisi var mı (yoksa kullanıcıya söylenir).</summary>
        internal static bool VeriVar(Proje p)
        {
            if (p.Elemanlar.Count + p.Hatlar.Count + p.Kanallar.Count + p.Sondajlar.Count + p.Bolgeler.Count + p.Noktalar.Count > 0) return true;
            Pencereler.Uyar("Bu çizimde aktarılacak şebeke verisi yok (direk, hat, kanal, sondaj ya da bölge).");
            return false;
        }

        /// <summary>Çizimin koordinat dilimi; ayarlarda yoksa sorulur ve kaydedilir. Vazgeçilirse 0.</summary>
        internal static int DilimIste(Ortam o, string neden)
        {
            if (o.Ayar.Dom > 0) return o.Ayar.Dom;
            int dom = Pencereler.DomSec(0, neden);
            if (dom == 0) return 0;
            o.Ayar.Dom = dom;
            o.AyarKaydet();
            Uygulama.Yaz("Koordinat dilimi " + dom + "° olarak çizimin ayarlarına kaydedildi (Çizim Ayarları'ndan değiştirilebilir).");
            return dom;
        }

        /// <summary>
        /// Çizim koordinatları 3° TM dilimine uyuyor mu? Uymuyorsa (yerel / kaydırılmış koordinat) kullanıcıya sorulur.
        /// </summary>
        internal static bool KoordinatUygun(Proje p)
        {
            int uygun = 0, toplam = 0;
            Action<double, double> say = (x, y) => { toplam++; if (Koordinat.TmDilimindeMi(x, y)) uygun++; };
            foreach (var e in p.Elemanlar) say(e.Saga, e.Yukari);
            foreach (var h in p.Hatlar) foreach (var k in h.Kose) say(k[0], k[1]);
            foreach (var b in p.Bolgeler) foreach (var k in b.Sinir) say(k[0], k[1]);
            if (toplam == 0 || uygun * 2 >= toplam) return true;
            return Pencereler.Onay("Çizimin koordinatları 3° TM dilimine uymuyor (yukarı değer 3,9–4,8 milyon m, sağa değer 300–700 bin m olmalı). " +
                                   "Çizim yerel ya da kaydırılmış koordinatla çizilmiş olabilir; nesneler haritada yanlış yerde görünür.\n\nYine de yazılsın mı?", false);
        }
    }

    /// <summary>
    /// CBS (MIF) nesnelerini çizime altlık olarak çizer: nokta → küçük daire (+ adı / numarası yazı olarak), çizgi → çoklu
    /// çizgi, alan → kapalı çoklu çizgi, yazı → yazı. Her dosya kendi katmanında ("CBS-ad"); renkler dosyanın stilinden
    /// (siyah / beyaz ise katmanın rengi). MID satırı nesnenin genişletilmiş verisinde (SH_CBS) saklanır.
    /// </summary>
    internal sealed class CbsCizici
    {
        public const string Uygulama = "SH_CBS";
        private const double NoktaYaricapi = 0.5, EtiketBoyu = 1.2;
        /// <summary>Noktanın yanına yazılacak sütun: ilk bulunan dolu sütun.</summary>
        private static readonly string[] EtiketSutunlari = { "GIS_NO", "AD", "ADI", "NO", "NUMARA", "ETIKET", "KOD", "ISIM", "NAME", "LABEL", "ID" };

        private readonly Database _db;
        private readonly Transaction _tr;
        private readonly BlockTableRecord _ms;
        private readonly CizimYazici _y;
        public Extents3d Kapsam;
        public bool KapsamVar;

        public CbsCizici(Database db, Transaction tr)
        {
            _db = db;
            _tr = tr;
            _ms = (BlockTableRecord)tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(db), OpenMode.ForWrite);
            _y = new CizimYazici(db, tr);
            var rat = (RegAppTable)tr.GetObject(db.RegAppTableId, OpenMode.ForRead);
            if (!rat.Has(Uygulama))
            {
                rat.UpgradeOpen();
                var r = new RegAppTableRecord { Name = Uygulama };
                rat.Add(r);
                tr.AddNewlyCreatedDBObject(r, true);
            }
        }

        /// <summary>Bir dosyanın nesnelerini çizer; çizilen nesne sayısı döner.</summary>
        public int Ciz(string dosya, MifVerisi v)
        {
            var katman = Katman("CBS-" + dosya);
            int etiket = -1;
            foreach (var s in EtiketSutunlari) { etiket = v.Sutun(s); if (etiket >= 0) break; }
            int sayi = 0;
            foreach (var n in v.Nesneler)
            {
                if (n.Tur == "yok" || n.Parcalar.Count == 0) continue;
                var bilgi = Bilgi(dosya, v, n);
                var renk = Renk(n.Renk);
                bool cizildi = false;
                switch (n.Tur)
                {
                    case "nokta":
                        foreach (var pr in n.Parcalar)
                        {
                            var m = new Point3d(pr[0][0], pr[0][1], 0);
                            Ekle(new Circle(m, Vector3d.ZAxis, NoktaYaricapi), katman, renk, bilgi);
                            string ad = etiket >= 0 && etiket < n.Degerler.Length ? (n.Degerler[etiket] ?? "").Trim() : "";
                            if (ad.Length > 0) Ekle(Yazi(ad, new Point3d(m.X + NoktaYaricapi * 1.6, m.Y + NoktaYaricapi * 1.6, 0), EtiketBoyu, 0), katman, renk, bilgi);
                            cizildi = true;
                        }
                        break;
                    case "cizgi":
                    case "alan":
                        foreach (var pr in n.Parcalar)
                        {
                            if (pr.Count < 2) continue;
                            var pl = new Polyline(pr.Count);
                            for (int i = 0; i < pr.Count; i++) pl.AddVertexAt(i, new Point2d(pr[i][0], pr[i][1]), 0, 0, 0);
                            pl.Closed = n.Tur == "alan";
                            Ekle(pl, katman, renk, bilgi);
                            cizildi = true;
                        }
                        break;
                    case "yazi":
                        if (n.Metin.Trim().Length == 0) break;
                        var k = n.Parcalar[0][0];
                        Ekle(Yazi(n.Metin, new Point3d(k[0], k[1], 0), n.YaziBoyu > 0 ? n.YaziBoyu : EtiketBoyu, n.Aci * Math.PI / 180), katman, renk, bilgi);
                        cizildi = true;
                        break;
                }
                if (cizildi) sayi++;
            }
            return sayi;
        }

        private DBText Yazi(string metin, Point3d yer, double boy, double aci) =>
            new DBText { TextString = metin, Position = yer, Height = boy, Rotation = aci, TextStyleId = _y.YaziStili() };

        private void Ekle(Entity e, ObjectId katman, Color renk, ResultBuffer bilgi)
        {
            e.SetDatabaseDefaults(_db);
            e.LayerId = katman;
            if (renk != null) e.Color = renk;
            _ms.AppendEntity(e);
            _tr.AddNewlyCreatedDBObject(e, true);
            if (bilgi != null) e.XData = bilgi;
            try
            {
                var ext = e.GeometricExtents;
                if (KapsamVar) Kapsam.AddExtents(ext); else { Kapsam = ext; KapsamVar = true; }
            }
            catch { }
        }

        /// <summary>Dosyanın rengi: siyah ve beyaz (koyu / açık zeminde kaybolur) ya da yoksa katmanın rengi.</summary>
        private static Color Renk(int rgb)
        {
            if (rgb <= 0 || rgb >= 0xFFFFFF) return null;
            return Color.FromRgb((byte)((rgb >> 16) & 0xFF), (byte)((rgb >> 8) & 0xFF), (byte)(rgb & 0xFF));
        }

        /// <summary>Altlık katmanı (yoksa açık gri, sürekli çizgi); adı Türkçe karaktersiz (KatmanAdlari).</summary>
        private ObjectId Katman(string ad)
        {
            var temiz = new System.Text.StringBuilder();
            foreach (char c in KatmanAdlari.Ascii(ad)) temiz.Append("<>/\\\":;?*|,=`".IndexOf(c) >= 0 ? '_' : c);
            ad = temiz.ToString();
            if (ad.Length > 250) ad = ad.Substring(0, 250);
            var lt = (LayerTable)_tr.GetObject(_db.LayerTableId, OpenMode.ForRead);
            if (lt.Has(ad)) return lt[ad];
            var ltr = new LayerTableRecord { Name = ad, Color = Color.FromColorIndex(ColorMethod.ByAci, 252) };
            lt.UpgradeOpen();
            var id = lt.Add(ltr);
            _tr.AddNewlyCreatedDBObject(ltr, true);
            return id;
        }

        /// <summary>Nesnenin bilgisi: dosya adı ve "SÜTUN=değer" satırları (genişletilmiş verinin sınırı içinde).</summary>
        private static ResultBuffer Bilgi(string dosya, MifVerisi v, MifNesnesi n)
        {
            var rb = new ResultBuffer(new TypedValue((int)DxfCode.ExtendedDataRegAppName, Uygulama));
            int toplam = 0;
            Action<string> ekle = s =>
            {
                if (s.Length > 250) s = s.Substring(0, 249) + "…";
                if (toplam + s.Length * 2 > 15000) return; // AutoCAD bir nesnede ~16 KB genişletilmiş veri saklar
                toplam += s.Length * 2 + 4;
                rb.Add(new TypedValue((int)DxfCode.ExtendedDataAsciiString, s));
            };
            ekle("DOSYA=" + dosya);
            for (int i = 0; i < v.Sutunlar.Count && i < n.Degerler.Length; i++) ekle(v.Sutunlar[i] + "=" + (n.Degerler[i] ?? ""));
            return rb;
        }

        /// <summary>Nesnenin CBS bilgisi (sütun, değer); yoksa null.</summary>
        public static List<string[]> BilgiOku(Entity e, out string dosya)
        {
            dosya = "";
            List<string> l;
            if (!Toplayici.XdataOku(e).TryGetValue(Uygulama, out l)) return null;
            var satirlar = new List<string[]>();
            foreach (var s in l)
            {
                int i = s.IndexOf('=');
                string ad = i >= 0 ? s.Substring(0, i) : s, deger = i >= 0 ? s.Substring(i + 1) : "";
                if (ad == "DOSYA" && satirlar.Count == 0 && dosya.Length == 0) { dosya = deger; continue; }
                satirlar.Add(new[] { ad, deger });
            }
            return satirlar;
        }
    }
}
