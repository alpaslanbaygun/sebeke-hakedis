using System;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// PROMAGIS verisindeki sayılar Türkçe biçimde yazılır ("16,8", ",00") ama bazı alanlarda
    /// nokta da görülür ("10.5"). Hepsini kültürden bağımsız çözer.
    /// </summary>
    public static class SayiCoz
    {
        public static double Coz(string s, double varsayilan = 0)
        {
            if (s == null) return varsayilan;
            s = s.Trim();
            if (s.Length == 0) return varsayilan;
            // Binlik ayırıcı kullanılmıyor; virgül ondalık işaretidir.
            if (s.IndexOf(',') >= 0 && s.IndexOf('.') >= 0)
            {
                // "1.234,5" biçimi: noktaları at, virgülü nokta yap
                s = s.Replace(".", "").Replace(',', '.');
            }
            else
            {
                s = s.Replace(',', '.');
            }
            if (s.StartsWith(".", StringComparison.Ordinal)) s = "0" + s;
            if (s.StartsWith("-.", StringComparison.Ordinal)) s = "-0" + s.Substring(1);
            double d;
            return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out d) ? d : varsayilan;
        }

        public static int Tam(string s, int varsayilan = 0)
        {
            double d = Coz(s, double.NaN);
            return double.IsNaN(d) ? varsayilan : (int)Math.Round(d);
        }

        /// <summary>Raporlarda kullanılan yuvarlama: kayan nokta kırıntılarını temizler.</summary>
        public static double Temiz(double d, int basamak = 6) => Math.Round(d, basamak, MidpointRounding.AwayFromZero);
    }
}
