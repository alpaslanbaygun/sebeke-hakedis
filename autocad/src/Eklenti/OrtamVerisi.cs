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
            Semboller.Takim = Boyutlar.TakimDuzelt(Ayar.SimgeTakimi);   // blok adları çizimin simge takımına göre
            OnEk = Ilk(Ayar.KatmanOnEki, Proje.KatmanOnEki, yedekOnEk, "SC");
            GisOnEki = Ilk(Ayar.GisOnEki, Proje.GisOnEki, OnEk);
            Hakedis = Ayar.AktifHakedis > 0 ? Ayar.AktifHakedis : Math.Max(1, Proje.AktifHakedis);
            Sira = Numara.EnBuyukSira(Proje);
            _katalog = null;
            KatalogKaynagi.StiliYukle();
            KatalogKaynagi.RolleriYukle();
        }

        private static string Ilk(params string[] l)
        {
            foreach (var s in l) if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
            return "";
        }

        // ---- Kullanıcılar, oturum ve kilit ----

        /// <summary>Oturumdaki kullanıcı (yoksa null). Ortam hazırlanırken çizimin oturumundan konur.</summary>
        public Kullanici Uye;

        /// <summary>Onay mekanizması açık mı (çizimde etkin Yönetici var): onaylar ve hakediş yetkisi rolle korunur.</summary>
        public bool OnayAcik => Yetki.OnayAcik(Proje.Kullanicilar);

        public bool Yonetici => Uye != null && Uye.Rol == Roller.Yonetici;

        /// <summary>Hakediş yetkisiyle yazmaya kapalı hakedişler (onay mekanizması açıkken geçerli; Yönetici'ye uygulanmaz).</summary>
        public IEnumerable<int> KapaliHakedisler =>
            OnayAcik && !Yonetici && Proje.OnayAyari != null ? (IEnumerable<int>)Proje.OnayAyari.KapaliHakedisler : new int[0];

        /// <summary>Kilit denetimi sözlüğü: onaylı hakedişler + yazmaya kapalı hakedişler (HakedisOnayi.KilitSozlugu).</summary>
        public IDictionary<int, int> Kilitler => HakedisOnayi.KilitSozlugu(Proje.Onaylar, KapaliHakedisler);

        /// <summary>Hakediş kilitli mi (onaylı ya da yazmaya kapalı): bu hakedişe yeni nesne çizilmez, satırları değiştirilmez.</summary>
        public bool Kilitli(int hakedis) => HakedisOnayi.Kilitli(Proje.Onaylar, hakedis) || YazmayaKapali(hakedis);

        /// <summary>Hakediş yetkisiyle yazmaya kapalı mı (onaylı değil).</summary>
        public bool YazmayaKapali(int hakedis)
        {
            foreach (var n in KapaliHakedisler) if (n == hakedis) return true;
            return false;
        }

        /// <summary>Kilidin nedenine göre ileti: onaylı hakediş ya da yazmaya kapalı hakediş.</summary>
        public string KilitMesaji(int hakedis) =>
            HakedisOnayi.Kilitli(Proje.Onaylar, hakedis) ? HakedisOnayi.KilitMesaji(hakedis) : HakedisOnayi.KapaliMesaji(hakedis);

        /// <summary>Yeni kalemin sıra numarası (INDEX).</summary>
        public string YeniSira()
        {
            ++Sira;
            SiraVerildi(Sira);
            return Sira.ToString(CultureInfo.InvariantCulture);
        }

        /// <summary>Yeni sıra numarası verilince (AutoCAD'de AutoCAD'in sayacı da ilerletilir).</summary>
        protected virtual void SiraVerildi(long sira) { }

        /// <summary>
        /// Yeni elemanın blok ölçeği: eklentinin SH_ simgeleri metre cinsindendir, ayardaki simge büyüklüğüyle konur
        /// (Çizim Ayarları › Görünüm; 1 = telefonla aynı boyut); AutoCAD bloklarında ayardaki ölçek, yoksa çizimdekilerle
        /// aynı (AutoCAD: 4).
        /// </summary>
        public double Olcek(string blok) => Semboller.EklentininBlogu(blok) ? SimgeOlcegi : Ayar.SembolOlcegi > 0 ? Ayar.SembolOlcegi : NesneYazici.OlcekOner(Varliklar, blok, 4);

        /// <summary>Uygulamanın simgelerinin büyüklüğü (çarpan; bozuk değerde 1).</summary>
        public double SimgeOlcegi => Ayar.SimgeOlcegi >= 0.1 && Ayar.SimgeOlcegi <= 20 ? Ayar.SimgeOlcegi : 1;

        /// <summary>
        /// Noktanın yapıştığı eleman: simgesinin üstüne ya da mesafe içine tıklanan elemanlardan merkezi en yakın olan; yoksa null.
        /// ekran: ekrandaki birkaç piksellik pay (uzaktan bakarken küçük simgeler de yakalansın).
        /// </summary>
        public Eleman YakinEleman(double x, double y, double mesafe, double ekran = 0)
        {
            KatalogKaynagi.SembolleriYukle();
            return Geometri.YakinEleman(Proje.Elemanlar, x, y, mesafe, ekran, SimgeOlcegi);
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

        /// <summary>Rolleri ve yetkileri bir kez yükler (ortak/katalog/roller.json; telefonla aynı tablo).</summary>
        public static void RolleriYukle()
        {
            if (Roller.Yuklu) return;
            string json = Kaynak("SebekeHakedis.roller.json");
            if (!string.IsNullOrEmpty(json)) Roller.Yukle(json);
        }

        /// <summary>Gömülü Birleşik Metraj şablonu (ortak/sablon/birlesik-metraj.xlsm).</summary>
        public static byte[] MetrajSablonu()
        {
            using (var s = typeof(KatalogKaynagi).Assembly.GetManifestResourceStream("SebekeHakedis.sablon.birlesik-metraj.xlsm"))
            {
                if (s == null) return null;
                using (var ms = new MemoryStream()) { s.CopyTo(ms); return ms.ToArray(); }
            }
        }

        private static JsonNesne _voltEslesme;

        /// <summary>Telefon servis kodu ↔ eklenti kalemi eşlemesi (ortak/katalog/volt-eslesme.json; telefonla ortak tablo).</summary>
        public static JsonNesne VoltEslesme()
        {
            if (_voltEslesme != null) return _voltEslesme;
            string json = Kaynak("SebekeHakedis.volt-eslesme.json");
            return _voltEslesme = (string.IsNullOrEmpty(json) ? null : SebekeHakedis.Cekirdek.Json.Oku(json) as JsonNesne) ?? new JsonNesne();
        }

        /// <summary>Önerilen malzeme kurallarını bir kez yükler (ortak/katalog/onerilen-malzeme.json; telefonun reçete kuralları).</summary>
        public static OnerilenMalzeme OnerilenMalzemeler()
        {
            if (OnerilenMalzeme.Yuklu != null) return OnerilenMalzeme.Yuklu;
            string json = Kaynak("SebekeHakedis.onerilen-malzeme.json");
            if (!string.IsNullOrEmpty(json)) { try { OnerilenMalzeme.Yukle(json); } catch { } }
            return OnerilenMalzeme.Yuklu;
        }

        /// <summary>Birleşik Metraj eşleşme tablosu (ortak/katalog/metraj-sablon.json).</summary>
        public static JsonNesne MetrajEslesme()
        {
            string json = Kaynak("SebekeHakedis.metraj-sablon.json");
            return (string.IsNullOrEmpty(json) ? null : SebekeHakedis.Cekirdek.Json.Oku(json) as JsonNesne) ?? new JsonNesne();
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
