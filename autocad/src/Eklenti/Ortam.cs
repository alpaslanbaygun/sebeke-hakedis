using System;
using System.Collections.Generic;
using System.Globalization;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Bir komutun çalışma ortamı: çizimden okunan proje, çizimin ayarları, katalog, ön ekler,
    /// aktif hakediş ve kalem sırası (OrtamVerisi) + açık belge. Her komut başında bir kez hazırlanır.
    /// </summary>
    internal sealed class Ortam : OrtamVerisi
    {
        public Document Belge;
        public Database Db;
        public Editor Ed;

        public static Ortam Hazirla(Document belge, string yedekOnEk = null)
        {
            var o = new Ortam { Belge = belge, Db = belge.Database, Ed = belge.Editor };
            var varliklar = Toplayici.Topla(o.Db);
            o.Doldur(varliklar, NesneOkuyucu.Oku(varliklar, belge.Name), AyarDeposu.Oku(o.Db), yedekOnEk);
            // AutoCAD'in sayacı sıradaki boş numarayı tutar: eklenti bunun altında numara vermez.
            long sayac = CizimSozlugu.SayacOku(o.Db);
            if (sayac - 1 > o.Sira) o.Sira = sayac - 1;
            // AutoCAD'in aktif hakedişi: eklenti hakediş seçilince buraya da yazar; farklıysa AutoCAD'de sonradan değişmiştir.
            // Ayar da eşitlenir: ayarlar sonradan kaydedilince AutoCAD'in yeni değeri eskisiyle ezilmesin.
            int hakNo = CizimSozlugu.HakNoOku(o.Db);
            if (hakNo > 0) { o.Hakedis = hakNo; o.Ayar.AktifHakedis = hakNo; }
            // Hakediş onayları (AutoCAD HAK_ONAY): onaylı hakedişler kilitlidir
            o.Proje.Onaylar = CizimSozlugu.OnaylariOku(o.Db);
            // Kullanıcılar, roller ve hakediş yetkisi (telefonla aynı); oturum çizim başına
            List<Kullanici> kullanicilar;
            OnayAyari ayar;
            KullaniciDeposu.Oku(o.Db, out kullanicilar, out ayar);
            o.Proje.Kullanicilar = kullanicilar;
            o.Proje.OnayAyari = ayar;
            o.Uye = Oturum.Uye(o.Db, kullanicilar);
            return o;
        }

        /// <summary>Eklenti yeni sıra verdikçe AutoCAD sayacı da ilerler (AutoCAD'le sonradan çizilen kalem aynı numarayı almaz).</summary>
        protected override void SiraVerildi(long sira) => CizimSozlugu.SayacYaz(Db, sira);

        public void AyarKaydet()
        {
            try
            {
                AyarDeposu.Yaz(Db, Ayar);
                if (Ayar.AktifHakedis > 0)
                    using (var tr = Db.TransactionManager.StartTransaction())
                    {
                        CizimSozlugu.HakNoYaz(Db, tr, Ayar.AktifHakedis);
                        tr.Commit();
                    }
            }
            catch (Exception ex) { Ed.WriteMessage("\nAyarlar kaydedilemedi: " + ex.Message); }
        }

        /// <summary>Noktanın yapıştığı eleman (simgesinin üstü, yakalama mesafesi ya da ekrandaki yakalama kutusu içinde); yoksa null.</summary>
        public Eleman YakinEleman(Point3d p, double mesafe) => YakinEleman(p.X, p.Y, mesafe, EkranToleransi());

        /// <summary>
        /// Ekrandaki yakalama kutusunun (APERTURE, piksel) çizimdeki karşılığı (metre): uzaktan bakarken küçük görünen
        /// simgeye de tıklanabilsin. En çok 15 m. Okunamazsa 0.
        /// </summary>
        public double EkranToleransi()
        {
            try
            {
                double gorunum = Convert.ToDouble(Autodesk.AutoCAD.ApplicationServices.Application.GetSystemVariable("VIEWSIZE"), CultureInfo.InvariantCulture);
                object ekran = Autodesk.AutoCAD.ApplicationServices.Application.GetSystemVariable("SCREENSIZE");
                double piksel = ekran is Point2d ? ((Point2d)ekran).Y : 0;
                double kutu = Convert.ToDouble(Autodesk.AutoCAD.ApplicationServices.Application.GetSystemVariable("APERTURE"), CultureInfo.InvariantCulture);
                if (piksel <= 0 || gorunum <= 0) return 0;
                return Math.Min(15.0, gorunum / piksel * Math.Max(5, kutu));
            }
            catch { return 0; }
        }
    }

    /// <summary>Çizimin içinde saklanan ayarlar (Named Objects Dictionary → SEBEKE_HAKEDIS → AYARLAR).</summary>
    internal static class AyarDeposu
    {
        private const string Sozluk = "SEBEKE_HAKEDIS";
        private const string Kayit = "AYARLAR";

        public static CizimAyarlari Oku(Database db)
        {
            var ciftler = new List<KeyValuePair<string, string>>();
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                if (nod.Contains(Sozluk))
                {
                    var sozluk = tr.GetObject(nod.GetAt(Sozluk), OpenMode.ForRead) as DBDictionary;
                    if (sozluk != null && sozluk.Contains(Kayit))
                    {
                        var xr = tr.GetObject(sozluk.GetAt(Kayit), OpenMode.ForRead) as Xrecord;
                        if (xr != null)
                        {
                            using (var rb = xr.Data)
                            {
                                if (rb != null)
                                {
                                    string anahtar = null;
                                    foreach (TypedValue tv in rb)
                                    {
                                        string s = Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "";
                                        if (anahtar == null) anahtar = s;
                                        else { ciftler.Add(new KeyValuePair<string, string>(anahtar, s)); anahtar = null; }
                                    }
                                }
                            }
                        }
                    }
                }
                tr.Commit();
            }
            return CizimAyarlari.Ciftlerden(ciftler);
        }

        public static void Yaz(Database db, CizimAyarlari a)
        {
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                DBDictionary sozluk;
                if (nod.Contains(Sozluk)) sozluk = (DBDictionary)tr.GetObject(nod.GetAt(Sozluk), OpenMode.ForWrite);
                else
                {
                    nod.UpgradeOpen();
                    sozluk = new DBDictionary();
                    nod.SetAt(Sozluk, sozluk);
                    tr.AddNewlyCreatedDBObject(sozluk, true);
                }
                Xrecord xr;
                if (sozluk.Contains(Kayit)) xr = (Xrecord)tr.GetObject(sozluk.GetAt(Kayit), OpenMode.ForWrite);
                else
                {
                    xr = new Xrecord();
                    sozluk.SetAt(Kayit, xr);
                    tr.AddNewlyCreatedDBObject(xr, true);
                }
                using (var rb = new ResultBuffer())
                {
                    foreach (var kv in a.Ciftler())
                    {
                        string v = kv.Value ?? "";
                        if (v.Length > 1000) v = v.Substring(0, 1000);
                        rb.Add(new TypedValue((int)DxfCode.Text, kv.Key));
                        rb.Add(new TypedValue((int)DxfCode.Text, v));
                    }
                    xr.Data = rb;
                }
                tr.Commit();
            }
        }
    }
}
