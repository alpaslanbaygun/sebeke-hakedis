using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Harita altlığı sağlayıcısı (karo sunucusu).</summary>
    public sealed class AltlikSaglayici
    {
        public string Id = "", Ad = "";
        /// <summary>"ucretsiz" (anahtarsız), "anahtarli", "ozel"</summary>
        public string Grup = "anahtarli";
        /// <summary>Gereken anahtarın adı (aynı anahtar birden çok altlıkta kullanılır: google, bing, azure...); "" anahtarsız.</summary>
        public string Anahtar = "";
        /// <summary>Karo adresi: {z} {x} {y} {q} (quadkey) {key}. Google, Bing ve özel adreste boş (hazırlanır).</summary>
        public string Url = "";
        /// <summary>"" düz XYZ, "google" (oturumlu), "bing" (meta veriyle), "azure" (anahtar başlıkta), "ozel" (adres anahtar kutusunda)</summary>
        public string Tur = "";
        /// <summary>Google harita türü (roadmap, satellite, hybrid) ya da Bing görüntü kümesi (Aerial, AerialWithLabelsOnDemand, RoadOnDemand).</summary>
        public string Kume = "";
        /// <summary>Karoların izdüşümü: false Web Mercator (EPSG:3857), true elipsoidal Mercator (EPSG:3395, Yandex).</summary>
        public bool Elipsoidal;
        public int EnBuyukZoom = 19;
        /// <summary>Görüntü (uydu) mü: çıktı JPEG; harita ise PNG.</summary>
        public bool Uydu = true;
        /// <summary>Haritaya yazılması gereken atıf, kullanım koşulları adresi, kullanıcıya not.</summary>
        public string Atif = "", Kosul = "", Not = "";

        public override string ToString() => Ad;
    }

    /// <summary>
    /// Harita altlığı: seçilen alanın karoları indirilir, birleştirilir ve çizimin koordinat sistemine (ITRF96 3° TM)
    /// çevrilerek tek bir resim olarak çizime konur. Bu sınıf AutoCAD'den ve resim kütüphanesinden bağımsızdır: sağlayıcılar,
    /// karo hesabı (Web Mercator / elipsoidal Mercator), plan (zoom, karo aralığı, çözünürlük) ve resmin TM'ye çevrilmesi
    /// (renkler ARGB tamsayı dizisi). Telefondaki altlık listesiyle aynı sağlayıcılar (telefon/web/src/ui/services.js;
    /// telefon/web/tests/altlik.test.mjs bu listeyi okuyup telefonda eksiksiz olduğunu denetler).
    /// </summary>
    public static class HaritaAltligi
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
        /// <summary>Web Mercator'da 0. zoom'da ekvatorda 256 piksellik karonun bir pikseli (m).</summary>
        public const double EkvatorCozunurlugu = 156543.03392804097;
        /// <summary>Çıktı resminin uzun kenarı en çok (piksel) ve en çok karo.</summary>
        public const int EnBuyukKenar = 4096, EnCokKaro = 300;

        public static readonly AltlikSaglayici[] Saglayicilar =
        {
            new AltlikSaglayici { Id = "esri", Grup = "ucretsiz", Ad = "Esri uydu görüntüsü", Url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                Atif = "Kaynak: Esri, Vantor, Earthstar Geographics", Kosul = "https://goto.arcgisonline.com/maps/World_Imagery",
                Not = "Anahtarsız. Esri kullanım koşulları geçerli; yoğun ya da ticari kullanımda ArcGIS hesabı (anahtarlı seçenek) gerekir." },
            new AltlikSaglayici { Id = "osm", Grup = "ucretsiz", Ad = "OpenStreetMap", Url = "https://tile.openstreetmap.org/{z}/{x}/{y}.png", Uydu = false,
                Atif = "© OpenStreetMap katkıda bulunanlar", Kosul = "https://operations.osmfoundation.org/policies/tiles/",
                Not = "Anahtarsız, gönüllü sunucular. Toplu indirme yasak: yalnız küçük alanlar için kullanın; yoğun kullanımda erişim kesilebilir." },
            new AltlikSaglayici { Id = "esri_k", Anahtar = "esri", Ad = "Esri uydu (ArcGIS anahtarı)", Url = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token={key}",
                Atif = "Kaynak: Esri, Vantor, Earthstar Geographics", Kosul = "https://goto.arcgisonline.com/maps/World_Imagery",
                Not = "ArcGIS Location Platform ya da ArcGIS Online anahtarı (API key) gerekir; aylık ücretsiz kullanım payı vardır." },
            new AltlikSaglayici { Id = "google_s", Anahtar = "google", Tur = "google", Kume = "satellite", Ad = "Google uydu", EnBuyukZoom = 20,
                Atif = "Görüntü © Google", Kosul = "https://cloud.google.com/maps-platform/terms",
                Not = "Google Map Tiles API anahtarı (Google Cloud hesabı) gerekir. Aylık ücretsiz kullanım payı vardır, aşılırsa ücretlendirilir. Google koşulları görüntünün kalıcı saklanmasını kısıtlar." },
            new AltlikSaglayici { Id = "google_h", Anahtar = "google", Tur = "google", Kume = "hybrid", Ad = "Google uydu + yol adları", EnBuyukZoom = 20,
                Atif = "Görüntü ve harita verileri © Google", Kosul = "https://cloud.google.com/maps-platform/terms", Not = "Google uydu ile aynı anahtar." },
            new AltlikSaglayici { Id = "google_m", Anahtar = "google", Tur = "google", Kume = "roadmap", Ad = "Google harita", EnBuyukZoom = 21, Uydu = false,
                Atif = "Harita verileri © Google", Kosul = "https://cloud.google.com/maps-platform/terms", Not = "Google uydu ile aynı anahtar." },
            new AltlikSaglayici { Id = "bing_a", Anahtar = "bing", Tur = "bing", Kume = "Aerial", Ad = "Bing uydu", EnBuyukZoom = 19,
                Atif = "© Microsoft Bing", Kosul = "https://learn.microsoft.com/en-us/bingmaps/rest-services/imagery",
                Not = "Bing Maps kurumsal (Enterprise) anahtarı gerekir: ücretsiz (Basic) anahtarlar kapatıldı, kurumsal anahtarlar 30.06.2028'e kadar çalışır. Yeni anahtar için Azure Maps'i seçin." },
            new AltlikSaglayici { Id = "bing_h", Anahtar = "bing", Tur = "bing", Kume = "AerialWithLabelsOnDemand", Ad = "Bing uydu + yol adları", EnBuyukZoom = 19,
                Atif = "© Microsoft Bing", Kosul = "https://learn.microsoft.com/en-us/bingmaps/rest-services/imagery", Not = "Bing uydu ile aynı anahtar." },
            new AltlikSaglayici { Id = "azure_s", Anahtar = "azure", Tur = "azure", Kume = "microsoft.imagery", Ad = "Azure Maps uydu (Bing'in yerine)", EnBuyukZoom = 19,
                Url = "https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=microsoft.imagery&zoom={z}&x={x}&y={y}&tileSize=256",
                Atif = "© Microsoft, Azure Maps", Kosul = "https://learn.microsoft.com/en-us/rest/api/maps/render/get-map-tile",
                Not = "Azure Maps hesabının anahtarı (subscription key) gerekir; aylık ücretsiz kullanım payı vardır." },
            new AltlikSaglayici { Id = "azure_m", Anahtar = "azure", Tur = "azure", Kume = "microsoft.base.road", Ad = "Azure Maps yol haritası", EnBuyukZoom = 21, Uydu = false,
                Url = "https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=microsoft.base.road&zoom={z}&x={x}&y={y}&tileSize=256",
                Atif = "© Microsoft, Azure Maps", Kosul = "https://learn.microsoft.com/en-us/rest/api/maps/render/get-map-tile", Not = "Azure Maps uydu ile aynı anahtar." },
            new AltlikSaglayici { Id = "yandex_m", Anahtar = "yandex", Ad = "Yandex harita", Elipsoidal = true, Uydu = false,
                Url = "https://tiles.api-maps.yandex.ru/v1/tiles/?x={x}&y={y}&z={z}&lang=tr_TR&l=map&apikey={key}",
                Atif = "© Yandex", Kosul = "https://yandex.com/dev/tiles/", Not = "Yandex Tiles API anahtarı gerekir; ücretsiz kullanım payı sınırlıdır." },
            new AltlikSaglayici { Id = "maptiler_u", Anahtar = "maptiler", Ad = "MapTiler uydu", EnBuyukZoom = 20,
                Url = "https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key={key}",
                Atif = "© MapTiler © OpenStreetMap katkıda bulunanlar", Kosul = "https://www.maptiler.com/cloud/terms/",
                Not = "MapTiler anahtarı (ücretsiz plan: ticari olmayan kullanım, aylık sınırlı)." },
            new AltlikSaglayici { Id = "maptiler_s", Anahtar = "maptiler", Ad = "MapTiler sokak", EnBuyukZoom = 20, Uydu = false,
                Url = "https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={key}",
                Atif = "© MapTiler © OpenStreetMap katkıda bulunanlar", Kosul = "https://www.maptiler.com/cloud/terms/", Not = "MapTiler uydu ile aynı anahtar." },
            new AltlikSaglayici { Id = "ozel", Grup = "ozel", Anahtar = "ozel", Tur = "ozel", Ad = "Özel karo sunucusu (XYZ)", EnBuyukZoom = 20,
                Atif = "", Not = "Kurumunuzun ya da izin aldığınız sağlayıcının XYZ adresi: {z}, {x}, {y} (ya da Bing tipi {q}) yerlerini içermeli. Koşullara uymak kullanıcının sorumluluğundadır." },
        };

        public static AltlikSaglayici Bul(string id) => Array.Find(Saglayicilar, s => s.Id == id);

        // ---------------- Karo hesabı ----------------

        /// <summary>
        /// Enlem-boylamın karo koordinatı (karo biriminde, kesirli): x = sütun, y = satır (kuzeyden). Web Mercator ya da
        /// elipsoidal Mercator (Yandex).
        /// </summary>
        public static void KaroKonumu(double enlem, double boylam, int z, bool elipsoidal, out double kx, out double ky)
        {
            double n = Math.Pow(2, z);
            kx = (boylam + 180) / 360 * n;
            double phi = Math.Max(-85.08, Math.Min(85.08, enlem)) * Math.PI / 180;
            double psi = Atanh(Math.Sin(phi));
            if (elipsoidal)
            {
                const double e = 0.0818191908426215; // WGS84
                psi -= e * Atanh(e * Math.Sin(phi));
            }
            ky = (1 - psi / Math.PI) / 2 * n;
        }

        /// <summary>Bing karo anahtarı (quadkey).</summary>
        public static string QuadKey(int x, int y, int z)
        {
            var sb = new StringBuilder(z);
            for (int i = z; i > 0; i--)
            {
                int m = 1 << (i - 1), d = 0;
                if ((x & m) != 0) d++;
                if ((y & m) != 0) d += 2;
                sb.Append((char)('0' + d));
            }
            return sb.ToString();
        }

        /// <summary>Karo adresi (düz XYZ ve özel adres): {z} {x} {y} {q} {key} yerleri doldurulur.</summary>
        public static string Adres(string sablon, int z, int x, int y, string anahtar) =>
            (sablon ?? "").Replace("{z}", z.ToString(Inv)).Replace("{x}", x.ToString(Inv)).Replace("{y}", y.ToString(Inv))
                          .Replace("{q}", QuadKey(x, y, z)).Replace("{key}", Uri.EscapeDataString(anahtar ?? ""));

        // ---------------- Plan ----------------

        /// <summary>İndirilecek karolar ve çıktı resmi.</summary>
        public sealed class Plan
        {
            public int Z, X0, Y0, X1, Y1;
            public bool Elipsoidal;
            /// <summary>Çıktı resminin TM sınırları (m) ve piksel boyu (m).</summary>
            public double E0, N0, E1, N1, Cozunurluk;
            public int Genislik, Yukseklik;
            public int KaroSayisi => (X1 - X0 + 1) * (Y1 - Y0 + 1);
        }

        /// <summary>
        /// Alanın planı: istenen piksel boyuna (m) en yakın zoom; karo sayısı ve resim boyu sınırı aşılırsa zoom düşürülür.
        /// Alan çizim koordinatıyla (TM, dom) verilir.
        /// </summary>
        public static Plan Planla(double e0, double n0, double e1, double n1, int dom, AltlikSaglayici s, double istenen)
        {
            if (e1 < e0) { var t = e0; e0 = e1; e1 = t; }
            if (n1 < n0) { var t = n0; n0 = n1; n1 = t; }
            double ortaEnlem, ortaBoylam;
            Koordinat.EnlemBoylam((e0 + e1) / 2, (n0 + n1) / 2, dom, out ortaEnlem, out ortaBoylam);
            double cos = Math.Cos(ortaEnlem * Math.PI / 180);
            int z = (int)Math.Ceiling(Math.Log(EkvatorCozunurlugu * cos / Math.Max(0.05, istenen), 2));
            z = Math.Max(1, Math.Min(s != null ? s.EnBuyukZoom : 19, z));
            bool elips = s != null && s.Elipsoidal;
            for (; z >= 1; z--)
            {
                var p = KaroAraligi(e0, n0, e1, n1, dom, z, elips);
                p.Cozunurluk = EkvatorCozunurlugu * cos / Math.Pow(2, z);
                p.Genislik = (int)Math.Ceiling((e1 - e0) / p.Cozunurluk);
                p.Yukseklik = (int)Math.Ceiling((n1 - n0) / p.Cozunurluk);
                if (p.KaroSayisi <= EnCokKaro && Math.Max(p.Genislik, p.Yukseklik) <= EnBuyukKenar) return p;
            }
            return KaroAraligi(e0, n0, e1, n1, dom, 1, elips);
        }

        private static Plan KaroAraligi(double e0, double n0, double e1, double n1, int dom, int z, bool elips)
        {
            double xmin = double.MaxValue, xmax = double.MinValue, ymin = double.MaxValue, ymax = double.MinValue;
            // Kenarlar boyunca örnekle (TM kenarı Mercator'da hafif eğridir)
            for (int i = 0; i <= 8; i++)
            {
                double t = i / 8.0;
                foreach (var k in new[] { new[] { e0 + (e1 - e0) * t, n0 }, new[] { e0 + (e1 - e0) * t, n1 }, new[] { e0, n0 + (n1 - n0) * t }, new[] { e1, n0 + (n1 - n0) * t } })
                {
                    double en, boy, kx, ky;
                    Koordinat.EnlemBoylam(k[0], k[1], dom, out en, out boy);
                    KaroKonumu(en, boy, z, elips, out kx, out ky);
                    xmin = Math.Min(xmin, kx); xmax = Math.Max(xmax, kx); ymin = Math.Min(ymin, ky); ymax = Math.Max(ymax, ky);
                }
            }
            int n = 1 << z;
            return new Plan
            {
                Z = z, Elipsoidal = elips, E0 = e0, N0 = n0, E1 = e1, N1 = n1,
                X0 = Math.Max(0, (int)Math.Floor(xmin)), X1 = Math.Min(n - 1, (int)Math.Floor(xmax)),
                Y0 = Math.Max(0, (int)Math.Floor(ymin)), Y1 = Math.Min(n - 1, (int)Math.Floor(ymax)),
            };
        }

        // ---------------- Resmi TM'ye çevirme ----------------

        /// <summary>
        /// Karo mozaiğini (ARGB, satır satır; sol üst karo X0, Y0; karo kenarı karoBoyu piksel) çizimin TM koordinatına çevirir:
        /// çıktının her pikseli (satır 0 kuzeyde) TM konumundan enlem-boylama, oradan mozaik pikseline gider; renk çift doğrusal
        /// aradeğerle alınır. Mozaiğin dışı saydam (0). Enlem-boylam 16 pikselde bir hesaplanır, aradakiler aradeğerlenir
        /// (fark milimetrenin altında).
        /// </summary>
        public static int[] Donustur(Plan p, int[] mozaik, int mozaikEn, int mozaikBoy, int karoBoyu, int dom)
        {
            int W = p.Genislik, H = p.Yukseklik;
            var cikti = new int[W * H];
            const int adim = 16;
            int gw = W / adim + 2, gh = H / adim + 2;
            var gx = new double[gw * gh];
            var gy = new double[gw * gh];
            for (int j = 0; j < gh; j++)
                for (int i = 0; i < gw; i++)
                {
                    double e = p.E0 + (i * adim + 0.5) * p.Cozunurluk, n = p.N1 - (j * adim + 0.5) * p.Cozunurluk;
                    double en, boy, kx, ky;
                    Koordinat.EnlemBoylam(e, n, dom, out en, out boy);
                    KaroKonumu(en, boy, p.Z, p.Elipsoidal, out kx, out ky);
                    gx[j * gw + i] = (kx - p.X0) * karoBoyu - 0.5;
                    gy[j * gw + i] = (ky - p.Y0) * karoBoyu - 0.5;
                }
            for (int y = 0; y < H; y++)
            {
                int gj = y / adim;
                double fy = (y - gj * adim) / (double)adim;
                for (int x = 0; x < W; x++)
                {
                    int gi = x / adim;
                    double fx = (x - gi * adim) / (double)adim;
                    int a = gj * gw + gi, b = a + 1, c = a + gw, d = c + 1;
                    double mx = (gx[a] * (1 - fx) + gx[b] * fx) * (1 - fy) + (gx[c] * (1 - fx) + gx[d] * fx) * fy;
                    double my = (gy[a] * (1 - fx) + gy[b] * fx) * (1 - fy) + (gy[c] * (1 - fx) + gy[d] * fx) * fy;
                    cikti[y * W + x] = Ornekle(mozaik, mozaikEn, mozaikBoy, mx, my);
                }
            }
            return cikti;
        }

        /// <summary>Çift doğrusal aradeğer (ARGB); dışarısı saydam.</summary>
        private static int Ornekle(int[] m, int w, int h, double x, double y)
        {
            if (x < -0.5 || y < -0.5 || x > w - 0.5 || y > h - 0.5) return 0;
            int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y);
            double fx = x - x0, fy = y - y0;
            int x1 = Math.Min(w - 1, x0 + 1), y1 = Math.Min(h - 1, y0 + 1);
            x0 = Math.Max(0, x0); y0 = Math.Max(0, y0);
            int c00 = m[y0 * w + x0], c10 = m[y0 * w + x1], c01 = m[y1 * w + x0], c11 = m[y1 * w + x1];
            int sonuc = 0;
            for (int k = 0; k < 32; k += 8)
            {
                double v = ((c00 >> k) & 255) * (1 - fx) * (1 - fy) + ((c10 >> k) & 255) * fx * (1 - fy) + ((c01 >> k) & 255) * (1 - fx) * fy + ((c11 >> k) & 255) * fx * fy;
                sonuc |= ((int)Math.Round(v) & 255) << k;
            }
            return sonuc;
        }

        private static double Atanh(double x) => 0.5 * Math.Log((1 + x) / (1 - x));

        /// <summary>Bing meta veri adresi (görüntü kümesi, anahtar).</summary>
        public static string BingMetaAdresi(string kume, string anahtar) =>
            "https://dev.virtualearth.net/REST/v1/Imagery/Metadata/" + kume + "?key=" + Uri.EscapeDataString(anahtar ?? "") + "&uriScheme=https&output=json";

        /// <summary>Google Map Tiles oturum isteğinin gövdesi.</summary>
        public static string GoogleOturumGovdesi(string kume) =>
            kume == "hybrid"
                ? "{\"mapType\":\"satellite\",\"layerTypes\":[\"layerRoadmap\"],\"language\":\"tr\",\"region\":\"TR\"}"
                : "{\"mapType\":\"" + kume + "\",\"language\":\"tr\",\"region\":\"TR\"}";

        /// <summary>Google karo adresi (oturumla).</summary>
        public static string GoogleAdresi(int z, int x, int y, string oturum, string anahtar) =>
            "https://tile.googleapis.com/v1/2dtiles/" + z.ToString(Inv) + "/" + x.ToString(Inv) + "/" + y.ToString(Inv) +
            "?session=" + Uri.EscapeDataString(oturum ?? "") + "&key=" + Uri.EscapeDataString(anahtar ?? "");

        /// <summary>Bing meta verisindeki karo şablonundan karo adresi: {subdomain} sırayla, {quadkey}, {culture} tr-TR.</summary>
        public static string BingAdresi(string sablon, string[] altAlanlar, int z, int x, int y)
        {
            string alt = altAlanlar != null && altAlanlar.Length > 0 ? altAlanlar[(x + y) % altAlanlar.Length] : "t0";
            return (sablon ?? "").Replace("{subdomain}", alt).Replace("{quadkey}", QuadKey(x, y, z)).Replace("{culture}", "tr-TR");
        }
    }
}

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Kullanıcının harita altlığı ayarları: sağlayıcı anahtarları (yalnız bu bilgisayarda; çizime ve proje dosyalarına
    /// yazılmaz) ve son seçimler. %APPDATA%\SebekeHakedis\altlik.json
    /// </summary>
    public sealed class AltlikAyari
    {
        public System.Collections.Generic.Dictionary<string, string> Anahtarlar =
            new System.Collections.Generic.Dictionary<string, string>(System.StringComparer.Ordinal);
        public string Saglayici = "esri";
        /// <summary>0 şebekenin bulunduğu alan, 1 ekranda görünen alan, 2 pencereyle seçilen alan.</summary>
        public int Alan;
        /// <summary>0 düşük (≈1 m), 1 normal (≈0,5 m), 2 yüksek (≈0,25 m).</summary>
        public int Kalite = 1;
        public bool EskileriSil;

        public static double Cozunurluk(int kalite) => kalite <= 0 ? 1.0 : kalite >= 2 ? 0.25 : 0.5;

        public string Anahtar(string ad)
        {
            string a;
            return ad != null && Anahtarlar.TryGetValue(ad, out a) ? (a ?? "").Trim() : "";
        }

        public static AltlikAyari Oku(string yol)
        {
            var a = new AltlikAyari();
            try
            {
                if (!System.IO.File.Exists(yol)) return a;
                var k = Json.Oku(System.IO.File.ReadAllText(yol, System.Text.Encoding.UTF8)) as JsonNesne;
                if (k == null) return a;
                a.Saglayici = k.Metin("saglayici", "esri");
                if (HaritaAltligi.Bul(a.Saglayici) == null) a.Saglayici = "esri";
                a.Alan = System.Math.Max(0, System.Math.Min(2, k.Tam("alan")));
                a.Kalite = System.Math.Max(0, System.Math.Min(2, k.Tam("kalite", 1)));
                a.EskileriSil = k.Mantik("eskileriSil") ?? false;
                var an = k.Nesne("anahtarlar");
                if (an != null) foreach (var kv in an) a.Anahtarlar[kv.Key] = kv.Value as string ?? "";
            }
            catch { }
            return a;
        }

        public void Kaydet(string yol)
        {
            var k = new JsonNesne();
            k["saglayici"] = Saglayici ?? "esri";
            k["alan"] = (double)Alan;
            k["kalite"] = (double)Kalite;
            k["eskileriSil"] = EskileriSil;
            var an = new JsonNesne();
            foreach (var kv in Anahtarlar) if (!string.IsNullOrWhiteSpace(kv.Value)) an[kv.Key] = kv.Value.Trim();
            k["anahtarlar"] = an;
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(yol));
            System.IO.File.WriteAllText(yol, Json.Yaz(k), new System.Text.UTF8Encoding(false));
        }
    }
}
