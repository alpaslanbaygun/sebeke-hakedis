using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>GIS numarası ve kalem sırası (telefondaki sonrakiGis / enBuyukSira ile aynı kurallar).</summary>
    public static class Numara
    {
        /// <summary>
        /// Sıradaki GIS numarası. Direkler ortak sırayı paylaşır (SC77, SC78…); box SCB12, pano SCP03,
        /// trafo SCTR10; ek mufu OG/AG'ye göre EKOG / EKAG; kofrede GIS numarası yoktur.
        /// </summary>
        public static string SonrakiGis(IEnumerable<Eleman> elemanlar, string tur, string onEk, string cins)
        {
            var t = Turler.Eleman(tur);
            string g = t != null ? t.Gis : "";
            if (g.Length == 0) return "";
            if (g == "mufu") return (cins ?? "").IndexOf("_OG_", StringComparison.Ordinal) >= 0 ? "EKOG" : "EKAG";
            string on = (onEk ?? "") + (g == "direk" ? "" : g);
            var re = new Regex("^" + Regex.Escape(on) + "(\\d+)$", RegexOptions.CultureInvariant);
            long enBuyuk = 0;
            int genislik = g == "direk" ? 1 : 2;
            foreach (var e in elemanlar)
            {
                var m = re.Match(e.GisId ?? "");
                if (!m.Success) continue;
                long n;
                if (!long.TryParse(m.Groups[1].Value, NumberStyles.None, CultureInfo.InvariantCulture, out n)) continue;
                if (n > enBuyuk) enBuyuk = n;
                if (g != "direk") genislik = Math.Max(genislik, m.Groups[1].Value.Length);
            }
            return on + (enBuyuk + 1).ToString(CultureInfo.InvariantCulture).PadLeft(genislik, '0');
        }

        /// <summary>Projedeki en büyük sayısal kalem sırası (yeni kalemler bundan sonra numaralanır).</summary>
        public static long EnBuyukSira(Proje p)
        {
            long enBuyuk = 0;
            Action<List<Kalem>> bak = l =>
            {
                foreach (var k in l)
                {
                    long n;
                    if (long.TryParse((k.Sira ?? "").Trim(), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out n) && n > enBuyuk) enBuyuk = n;
                }
            };
            foreach (var e in p.Elemanlar) bak(e.Kalemler);
            foreach (var h in p.Hatlar) bak(h.Kalemler);
            foreach (var c in p.Kanallar) bak(c.Kalemler);
            foreach (var s in p.Sondajlar) bak(s.Kalemler);
            return enBuyuk;
        }
    }
}
