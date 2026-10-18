using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Komut ortamının AutoCAD'e bağlı olmayan kısmı: çizimden okunan proje, ayarlar, katalog, ön ekler,
    /// aktif hakediş, kalem sırası. Pencereler yalnız bunu kullanır; böylece AutoCAD olmadan da denenebilir.
    /// </summary>
    internal class OrtamVerisi
    {
        public List<CadVarlik> Varliklar = new List<CadVarlik>();
        public Proje Proje = new Proje();
        public CizimAyarlari Ayar = new CizimAyarlari();
        public string OnEk = "SC";
        public string GisOnEki = "SC";
        public int Hakedis = 1;
        public long Sira;
        private Katalog _katalog;

        public Katalog Katalog => _katalog ?? (_katalog = Katalog.Oku(KatalogKaynagi.Json(), Proje));

        public void Doldur(List<CadVarlik> varliklar, Proje proje, CizimAyarlari ayar, string yedekOnEk = null)
        {
            Varliklar = varliklar ?? new List<CadVarlik>();
            Proje = proje ?? new Proje();
            Ayar = ayar ?? new CizimAyarlari();
            OnEk = Ilk(Ayar.KatmanOnEki, Proje.KatmanOnEki, yedekOnEk, "SC");
            GisOnEki = Ilk(Ayar.GisOnEki, Proje.GisOnEki, OnEk);
            Hakedis = Ayar.AktifHakedis > 0 ? Ayar.AktifHakedis : Math.Max(1, Proje.AktifHakedis);
            Sira = Numara.EnBuyukSira(Proje);
            _katalog = null;
            PromagisYazici.TelefonSembolleri = Ayar.TelefonSembolleri;
            KatalogKaynagi.StiliYukle();
        }

        private static string Ilk(params string[] l)
        {
            foreach (var s in l) if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
            return "";
        }

        /// <summary>Yeni kalemin sıra numarası (INDEX).</summary>
        public string YeniSira() => (++Sira).ToString(CultureInfo.InvariantCulture);

        /// <summary>
        /// Yeni elemanın blok ölçeği: eklentinin SH_ simgeleri metre cinsindendir, her zaman 1 ölçekle konur (telefonla
        /// aynı boyut); PROMAGIS bloklarında ayardaki ölçek, yoksa çizimdekilerle aynı (PROMAGIS: 4).
        /// </summary>
        public double Olcek(string blok) => Semboller.EklentininBlogu(blok) ? 1 : Ayar.SembolOlcegi > 0 ? Ayar.SembolOlcegi : PromagisYazici.OlcekOner(Varliklar, blok, 4);

        /// <summary>Noktaya en yakın eleman (mesafe içinde); yoksa null.</summary>
        public Eleman YakinEleman(double x, double y, double mesafe)
        {
            if (mesafe <= 0) return null;
            Eleman en = null;
            double enKisa = mesafe;
            foreach (var e in Proje.Elemanlar)
            {
                double dx = e.Saga - x, dy = e.Yukari - y;
                double d = Math.Sqrt(dx * dx + dy * dy);
                if (d <= enKisa) { enKisa = d; en = e; }
            }
            return en;
        }
    }

    /// <summary>Eklentiye gömülü ortak dosyalar: malzeme kataloğu (kalemler.json), simge takımı (semboller.json), menü kategorileri (kategoriler.json).</summary>
    internal static class KatalogKaynagi
    {
        private static string _json;
        private static bool _sembollerYuklendi;

        public static string Json()
        {
            if (_json != null) return _json;
            return _json = Kaynak("SebekeHakedis.kalemler.json");
        }

        /// <summary>Simge takımını bir kez yükler (CizimYazici blok tanımlarken çağırır).</summary>
        public static void SembolleriYukle()
        {
            if (_sembollerYuklendi || Semboller.Yuklu) { _sembollerYuklendi = true; return; }
            string json = Kaynak("SebekeHakedis.semboller.json");
            if (!string.IsNullOrEmpty(json)) Semboller.Yukle(json);
            _sembollerYuklendi = true;
        }

        private static bool _stilYuklendi;

        /// <summary>Ortak çizim stilini bir kez yükler (renkler, çizgi tipleri, yazı yükseklikleri).</summary>
        public static void StiliYukle()
        {
            if (_stilYuklendi || CizimStili.Yuklu) { _stilYuklendi = true; return; }
            string json = Kaynak("SebekeHakedis.cizim-stili.json");
            if (!string.IsNullOrEmpty(json)) CizimStili.Yukle(json);
            _stilYuklendi = true;
        }

        private static bool _kategorilerYuklendi;

        /// <summary>Menü kategorilerini bir kez yükler (şerit ve hızlı çizim komutları çağırır).</summary>
        public static void KategorileriYukle()
        {
            if (_kategorilerYuklendi || Kategoriler.Yuklu) { _kategorilerYuklendi = true; return; }
            string json = Kaynak("SebekeHakedis.kategoriler.json");
            if (!string.IsNullOrEmpty(json)) Kategoriler.Yukle(json);
            _kategorilerYuklendi = true;
        }

        private static string Kaynak(string ad)
        {
            try
            {
                using (var s = typeof(KatalogKaynagi).Assembly.GetManifestResourceStream(ad))
                {
                    if (s == null) return "";
                    using (var r = new StreamReader(s, Encoding.UTF8)) return r.ReadToEnd();
                }
            }
            catch { return ""; }
        }
    }
}
