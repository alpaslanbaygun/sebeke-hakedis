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
        /// <summary>PROMAGIS'in çizim sözlüğündeki değerler (varsa): aktif hakediş, yazı ölçeği, sıra sayacı.</summary>
        public PromagisAyarlari Promagis = new PromagisAyarlari();
        private Katalog _katalog;

        public Katalog Katalog => _katalog ?? (_katalog = Katalog.Oku(KatalogKaynagi.Json(), Proje));

        public void Doldur(List<CadVarlik> varliklar, Proje proje, CizimAyarlari ayar, string yedekOnEk = null, PromagisAyarlari promagis = null)
        {
            Varliklar = varliklar ?? new List<CadVarlik>();
            Proje = proje ?? new Proje();
            Ayar = ayar ?? new CizimAyarlari();
            Promagis = promagis ?? new PromagisAyarlari();
            OnEk = Ilk(Ayar.KatmanOnEki, Proje.KatmanOnEki, yedekOnEk, "SC");
            GisOnEki = Ilk(Ayar.GisOnEki, Proje.GisOnEki, OnEk);
            // Aktif hakediş: bizim ayar → PROMAGIS'in HakNo kaydı → çizimde kullanılan en büyük hakediş
            Hakedis = Ayar.AktifHakedis > 0 ? Ayar.AktifHakedis : Promagis.HakNo > 0 ? Promagis.HakNo : Math.Max(1, Proje.AktifHakedis);
            // Sıra numarası (INDEX): çizimdeki en büyük sıra ile PROMAGIS'in sayacının büyüğünden devam eder
            Sira = Math.Max(Numara.EnBuyukSira(Proje), Promagis.Sayac);
            if (!Ayar.EtiketAyarlandi && Promagis.YaziOlcegi > 0) Ayar.EtiketYuksekligi = Promagis.YaziOlcegi;
            _katalog = null;
        }

        /// <summary>Kategorinin unsur kodu (şerit menüden seçilen); boşsa katalogdaki unsur kullanılır.</summary>
        public string Unsur => Kategoriler.Unsur(Ayar.Kategori);

        /// <summary>Katalog kaleminden poz satırı; tarife bu çizimin ayarlarına göre (şehir / köy, karakteristik, kategori unsuru).</summary>
        public Kalem KalemYap(KatalogKalemi it, double miktar, string durum, int hakedis, bool ana, string kaynak, string dmDurum = "")
            => Katalog.KalemYap(it, miktar, durum, hakedis, ana, kaynak, YeniSira(), dmDurum, Ayar.KoyTarifesi, Ayar.Karakteristik, Kategoriler.UnsurUygula(it.TarifeSec(Ayar.KoyTarifesi), Unsur));

        private static string Ilk(params string[] l)
        {
            foreach (var s in l) if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
            return "";
        }

        /// <summary>Yeni kalemin sıra numarası (INDEX).</summary>
        public string YeniSira() => (++Sira).ToString(CultureInfo.InvariantCulture);

        /// <summary>Yeni elemanın blok ölçeği: ayarda verilmişse o, yoksa çizimdekilerle aynı (PROMAGIS: 4).</summary>
        public double Olcek(string blok) => Ayar.SembolOlcegi > 0 ? Ayar.SembolOlcegi : PromagisYazici.OlcekOner(Varliklar, blok, 4);

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

    /// <summary>PROMAGIS'in çizimde sakladığı ayarlar (Named Objects Dictionary: HakNo_Dic, Tarife_Dic, AYARLAR).</summary>
    internal sealed class PromagisAyarlari
    {
        /// <summary>HakNo_Dic / HakNo_Rec: aktif hakediş (0 = yok).</summary>
        public int HakNo;
        /// <summary>AYARLAR / TXSCALE ÷ 10: yazı yüksekliği (0 = yok).</summary>
        public double YaziOlcegi;
        /// <summary>AYARLAR / SAYAC: son verilen sıra numarası.</summary>
        public long Sayac;
        /// <summary>Tarife_Dic / Tarife_Rec: yatırım grup kodu.</summary>
        public string GrupKodu = "";
        /// <summary>Çizimde PROMAGIS sözlüğü var mı.</summary>
        public bool Var;
    }

    /// <summary>Eklentiye gömülü ortak dosyalar: malzeme kataloğu (kalemler.json) ve simge takımı (semboller.json).</summary>
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
