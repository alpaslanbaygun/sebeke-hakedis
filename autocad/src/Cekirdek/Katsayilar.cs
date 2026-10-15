using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Raporun hesap katsayıları. Değerler PROMAGIS Durum Tespit dosyasının KATSAYILAR sayfasından alınmıştır.
    /// Ortak klasördeki katsayilar.json bu sınıftan üretilir; telefon uygulaması da aynı tabloları kullanır.
    /// </summary>
    public sealed class Katsayilar
    {
        /// <summary>Kanal hacminin yazıldığı hat tarifeleri.</summary>
        public string TarifeOG = "0104", TarifeAG = "0105", TarifeAYD = "0108", TarifeREK = "0110";

        /// <summary>Kanaldaki kablolar → hacim payları (OG, AG, AYD, REK).</summary>
        public Dictionary<string, double[]> KanalPaylasim = new Dictionary<string, double[]>(StringComparer.Ordinal)
        {
            { "OG",            new[] { 1.0, 0, 0, 0 } },
            { "/AG",           new[] { 0, 1.0, 0, 0 } },
            { "/AYD",          new[] { 0, 0, 1.0, 0 } },
            { "/REK",          new[] { 0, 0, 0, 1.0 } },
            { "OG/AG",         new[] { 0.5, 0.5, 0, 0 } },
            { "OG/AYD",        new[] { 0.8, 0, 0.2, 0 } },
            { "OG/REK",        new[] { 0.5, 0, 0, 0.5 } },
            { "OG/AG/AYD",     new[] { 0.4, 0.4, 0.2, 0 } },
            { "OG/AG/REK",     new[] { 0.4, 0.3, 0, 0.3 } },
            { "OG/AG/AYD/REK", new[] { 0.3, 0.25, 0.2, 0.25 } },
            { "/AG/AYD",       new[] { 0, 0.8, 0.2, 0 } },
            { "/AG/REK",       new[] { 0, 0.5, 0, 0.5 } },
            { "/AG/AYD/REK",   new[] { 0, 0.4, 0.2, 0.4 } },
            { "/AYD/REK",      new[] { 0, 0, 0.2, 0.8 } },
            { "OG/AYD/REK",    new[] { 0.6, 0, 0.2, 0.2 } },
        };

        /// <summary>AG çıplak iletken adları ve kg/m ağırlıkları.</summary>
        public string[] AgIletkenAdlari = { "ROSE", "PANSY", "ASTER", "OXLIP" };
        public double[] AgIletkenAgirlik = { 0.05915, 0.11832, 0.18765, 0.29886 };

        /// <summary>AG hat kesiti → tel sayıları (ROSE, PANSY, ASTER, OXLIP).</summary>
        public Dictionary<string, int[]> AgIletkenAcilim = new Dictionary<string, int[]>(StringComparer.Ordinal)
        {
            { "5R", new[] { 5, 0, 0, 0 } }, { "5P", new[] { 0, 5, 0, 0 } }, { "4R", new[] { 4, 0, 0, 0 } },
            { "4P+R", new[] { 1, 4, 0, 0 } }, { "4P+2R", new[] { 2, 4, 0, 0 } }, { "4P", new[] { 0, 4, 0, 0 } },
            { "3R", new[] { 3, 0, 0, 0 } }, { "3P", new[] { 0, 3, 0, 0 } }, { "3O+P+R", new[] { 1, 1, 0, 3 } },
            { "3O+A+R", new[] { 1, 0, 1, 3 } }, { "3O", new[] { 0, 0, 0, 3 } }, { "3A+P+R", new[] { 1, 1, 3, 0 } },
            { "3A+P+2R", new[] { 2, 1, 3, 0 } }, { "3A+P", new[] { 0, 1, 3, 0 } }, { "3A+2P", new[] { 0, 2, 3, 0 } },
            { "3A", new[] { 0, 0, 3, 0 } }, { "2R", new[] { 2, 0, 0, 0 } }, { "2P", new[] { 0, 2, 0, 0 } },
            { "R", new[] { 1, 0, 0, 0 } }, { "P", new[] { 0, 1, 0, 0 } }, { "A", new[] { 0, 0, 1, 0 } },
            { "Ox", new[] { 0, 0, 0, 1 } },
        };

        /// <summary>OG çıplak iletken adları ve kg/m ağırlıkları.</summary>
        public string[] OgIletkenAdlari = { "SWALLOW", "RAVEN", "PİGEON", "PATRİDGE", "HAWK" };
        public double[] OgIletkenAgirlik = { 0.10996, 0.22052, 0.35078, 0.55468, 0.99226 };

        /// <summary>OG hat kesiti → tel sayıları (SWALLOW, RAVEN, PİGEON, PATRİDGE, HAWK).</summary>
        public Dictionary<string, int[]> OgIletkenAcilim = new Dictionary<string, int[]>(StringComparer.Ordinal)
        {
            { "3xSW", new[] { 3, 0, 0, 0, 0 } }, { "4xSW", new[] { 4, 0, 0, 0, 0 } }, { "2(3xSW)", new[] { 6, 0, 0, 0, 0 } },
            { "3x1\\0", new[] { 0, 3, 0, 0, 0 } }, { "2(3x1\\0)", new[] { 0, 6, 0, 0, 0 } },
            { "3x3\\0", new[] { 0, 0, 3, 0, 0 } }, { "2(3x3\\0)", new[] { 0, 0, 6, 0, 0 } },
            { "3x266", new[] { 0, 0, 0, 3, 0 } }, { "2(3x266)", new[] { 0, 0, 0, 6, 0 } },
            { "3x477", new[] { 0, 0, 0, 0, 3 } }, { "2(3x477)", new[] { 0, 0, 0, 0, 6 } }, { "4(3x477)", new[] { 0, 0, 0, 0, 12 } },
            { "1xSW", new[] { 1, 0, 0, 0, 0 } }, { "2xSW", new[] { 2, 0, 0, 0, 0 } },
            { "1x1\\0", new[] { 0, 1, 0, 0, 0 } }, { "2x1\\0", new[] { 0, 2, 0, 0, 0 } },
            { "1x3\\0", new[] { 0, 0, 1, 0, 0 } }, { "2x3\\0", new[] { 0, 0, 2, 0, 0 } },
            { "1x266", new[] { 0, 0, 0, 1, 0 } }, { "2x266", new[] { 0, 0, 0, 2, 0 } },
            { "1x477", new[] { 0, 0, 0, 0, 1 } }, { "2x477", new[] { 0, 0, 0, 0, 2 } },
        };

        public static readonly Katsayilar Varsayilan = new Katsayilar();

        /// <summary>
        /// Kanal kaleminin tarifesinden OG ve AG paylarının tarifesini çıkarır
        /// (ilk iki hane karakteristik aynı kalır, unsur OG/AG'ye göre eşlenir).
        /// </summary>
        public static void KanalUnsurlari(string tarife, out string og, out string ag)
        {
            string kar = tarife != null && tarife.Length >= 2 ? tarife.Substring(0, 2) : "01";
            string uns = tarife != null && tarife.Length >= 4 ? tarife.Substring(2, 2) : "04";
            string uo, ua;
            switch (uns)
            {
                case "04": case "05": uo = "04"; ua = "05"; break;
                case "06": case "07": uo = "06"; ua = "07"; break;
                case "11": case "12": uo = "11"; ua = "12"; break;
                default: uo = uns; ua = uns; break;
            }
            og = kar + uo;
            ag = kar + ua;
        }

        public JsonNesne JsonYap()
        {
            var o = new JsonNesne();
            o["bicim"] = "sebeke-hakedis.katsayilar";
            o["surum"] = 1;
            o["kaynak"] = "PROMAGIS Durum Tespit dosyası, KATSAYILAR sayfası";
            var t = new JsonNesne();
            t["OG"] = TarifeOG; t["AG"] = TarifeAG; t["AYD"] = TarifeAYD; t["REK"] = TarifeREK;
            o["hatTarifeleri"] = t;
            var kp = new JsonNesne();
            foreach (var kv in KanalPaylasim)
            {
                var p = new JsonNesne();
                p["OG"] = kv.Value[0]; p["AG"] = kv.Value[1]; p["AYD"] = kv.Value[2]; p["REK"] = kv.Value[3];
                kp[kv.Key] = p;
            }
            o["kanalPaylasim"] = kp;
            o["kanalKodu"] = "Kanaldaki kabloların puan toplamı: REK 1, AYD 2, AG 4, OG 8";
            o["agIletken"] = IletkenJson(AgIletkenAdlari, AgIletkenAgirlik, AgIletkenAcilim);
            o["ogIletken"] = IletkenJson(OgIletkenAdlari, OgIletkenAgirlik, OgIletkenAcilim);
            return o;
        }

        private static JsonNesne IletkenJson(string[] adlar, double[] agirlik, Dictionary<string, int[]> acilim)
        {
            var o = new JsonNesne();
            var a = new JsonNesne();
            for (int i = 0; i < adlar.Length; i++) a[adlar[i]] = agirlik[i];
            o["agirlikKgM"] = a;
            var k = new JsonNesne();
            foreach (var kv in acilim)
            {
                var t = new JsonNesne();
                for (int i = 0; i < adlar.Length; i++) if (kv.Value[i] != 0) t[adlar[i]] = kv.Value[i];
                k[kv.Key] = t;
            }
            o["acilim"] = k;
            return o;
        }
    }
}
