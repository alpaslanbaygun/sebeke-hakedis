using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    public static class Geometri
    {
        public static double Uzunluk(IList<double[]> kose)
        {
            double t = 0;
            for (int i = 1; i < kose.Count; i++) t += Mesafe(kose[i - 1], kose[i]);
            return t;
        }

        public static double Mesafe(double[] a, double[] b)
        {
            double dx = b[0] - a[0], dy = b[1] - a[1];
            return Math.Sqrt(dx * dx + dy * dy);
        }

        /// <summary>Çizginin uzunluğunun yarısındaki nokta.</summary>
        public static double[] OrtaNokta(IList<double[]> kose)
        {
            if (kose.Count == 0) return null;
            if (kose.Count == 1) return kose[0];
            double yarim = Uzunluk(kose) / 2, t = 0;
            for (int i = 1; i < kose.Count; i++)
            {
                double d = Mesafe(kose[i - 1], kose[i]);
                if (t + d >= yarim && d > 0)
                {
                    double o = (yarim - t) / d;
                    return new[] { kose[i - 1][0] + (kose[i][0] - kose[i - 1][0]) * o, kose[i - 1][1] + (kose[i][1] - kose[i - 1][1]) * o };
                }
                t += d;
            }
            return kose[kose.Count - 1];
        }

        /// <summary>
        /// Hat etiketinin yeri: çizginin uzunluğunun yarısındaki nokta ve o parçanın okunur yöndeki açısı
        /// (yazı ters dönmesin diye -90°..+90° arasına getirilir, sonra 0..360°).
        /// </summary>
        public static bool EtiketKonumu(IList<double[]> kose, out double x, out double y, out double aci)
        {
            x = y = aci = 0;
            if (kose == null || kose.Count < 2) return false;
            double yarim = Uzunluk(kose) / 2, t = 0;
            int parca = kose.Count - 1;
            double o = 1;
            for (int i = 1; i < kose.Count; i++)
            {
                double d = Mesafe(kose[i - 1], kose[i]);
                if (t + d >= yarim && d > 0) { parca = i; o = (yarim - t) / d; break; }
                t += d;
            }
            var a = kose[parca - 1];
            var b = kose[parca];
            x = a[0] + (b[0] - a[0]) * o;
            y = a[1] + (b[1] - a[1]) * o;
            aci = Math.Atan2(b[1] - a[1], b[0] - a[0]);
            if (aci > Math.PI / 2 + 1e-9) aci -= Math.PI;
            else if (aci <= -Math.PI / 2 + 1e-9) aci += Math.PI;
            if (aci < 0) aci += 2 * Math.PI;
            return true;
        }

        /// <summary>
        /// Hat çizerken tıklanan noktanın yapıştığı eleman: simgesinin üstüne (yarı genişliğinin biraz dışına kadar) ya da
        /// verilen mesafe içine tıklanan elemanlardan merkezi en yakın olan. mesafe: en az yakalama mesafesi (ayar; 0 ise
        /// yakalama kapalı), ekran: ekrandaki birkaç piksellik pay (uzaktan bakarken küçük simgeler de yakalansın).
        /// Simge tablosu yüklü değilse yalnız mesafe ve ekran payı kullanılır.
        /// </summary>
        public static Eleman YakinEleman(IEnumerable<Eleman> elemanlar, double x, double y, double mesafe, double ekran = 0)
        {
            if (elemanlar == null || mesafe <= 0) return null;
            Eleman en = null;
            double enKisa = double.MaxValue;
            foreach (var e in elemanlar)
            {
                if (e == null) continue;
                double dx = e.Saga - x, dy = e.Yukari - y;
                double d = Math.Sqrt(dx * dx + dy * dy);
                double r = Math.Max(mesafe, ekran);
                if (Semboller.Yuklu) r = Math.Max(r, Semboller.YariGenislik(e) * 1.15);
                if (d <= r && d < enKisa) { enKisa = d; en = e; }
            }
            return en;
        }

        /// <summary>Metraj yazısında açıklığın sınırı sayılmayan eleman türleri: hattın üstünde ara elemanlar.</summary>
        private static readonly HashSet<string> AraElemanlar = new HashSet<string>(StringComparer.Ordinal) { "EK_MUFU" };

        /// <summary>
        /// Eleman türü açıklık sınırı mı: havai hatta direk, yer altında bağlantı elemanı (SDK, pano, trafo, kofre, direk…).
        /// Ek mufu ve menhol hattın üstündeki ara elemanlardır: iki SDK arasındaki metraj onlarda bölünmez.
        /// </summary>
        public static bool AciklikSiniri(string tur, string aile)
        {
            if (string.IsNullOrEmpty(tur) && string.IsNullOrEmpty(aile)) return false;
            if (tur != null && AraElemanlar.Contains(tur)) return false;
            return aile != "MENHOL" && aile != "ARMATUR";
        }

        /// <summary>
        /// Açıklıklar: çizgi, üstünde eleman (direk, SDK…) olan köşelerinden bölünür; elemansız kırılma köşeleri
        /// açıklığın içinde kalır. Uçlar her zaman sınırdır. dugumMu(i): i. köşe bir elemanın üstünde mi.
        /// Dönüş: her açıklık için [baş köşe, bit köşe].
        /// </summary>
        public static List<int[]> Acikliklar(IList<double[]> kose, Func<int, bool> dugumMu)
        {
            var l = new List<int[]>();
            if (kose == null || kose.Count < 2) return l;
            int bas = 0;
            for (int i = 1; i < kose.Count; i++)
            {
                if (i < kose.Count - 1 && (dugumMu == null || !dugumMu(i))) continue;
                l.Add(new[] { bas, i });
                bas = i;
            }
            return l;
        }

        /// <summary>
        /// Açıklığın metraj yazısı: toplam uzunluk ve yazının konacağı parça (açıklığın en uzun parçası; uzunluğu sıfır
        /// olan parçalar sayılmaz). Açıklık sıfır uzunluktaysa false.
        /// </summary>
        public static bool AciklikYazisi(IList<double[]> kose, int bas, int bit, out int parca, out double uzunluk)
        {
            parca = -1;
            uzunluk = 0;
            double enUzun = 0;
            for (int i = bas; i < bit && i + 1 < kose.Count; i++)
            {
                double d = Mesafe(kose[i], kose[i + 1]);
                uzunluk += d;
                if (d > enUzun + 1e-9) { enUzun = d; parca = i; }
            }
            return parca >= 0 && uzunluk > 1e-6;
        }

        /// <summary>Nokta çokgenin içinde mi (ışın yöntemi).</summary>
        public static bool Icinde(double[] p, IList<double[]> cokgen)
        {
            bool ic = false;
            int n = cokgen.Count;
            for (int i = 0, j = n - 1; i < n; j = i++)
            {
                double xi = cokgen[i][0], yi = cokgen[i][1], xj = cokgen[j][0], yj = cokgen[j][1];
                if ((yi > p[1]) != (yj > p[1]))
                {
                    double xk = xj + (p[1] - yj) * (xi - xj) / (yi - yj);
                    if (p[0] < xk) ic = !ic;
                }
            }
            return ic;
        }

        public static double Alan(IList<double[]> cokgen)
        {
            double s = 0;
            int n = cokgen.Count;
            for (int i = 0, j = n - 1; i < n; j = i++) s += cokgen[j][0] * cokgen[i][1] - cokgen[i][0] * cokgen[j][1];
            return Math.Abs(s) / 2;
        }

        public static double CokgeneMesafe(double[] p, IList<double[]> cokgen)
        {
            double en = double.MaxValue;
            int n = cokgen.Count;
            for (int i = 0, j = n - 1; i < n; j = i++) en = Math.Min(en, DogruParcasinaMesafe(p, cokgen[j], cokgen[i]));
            return en;
        }

        public static double DogruParcasinaMesafe(double[] p, double[] a, double[] b)
        {
            double dx = b[0] - a[0], dy = b[1] - a[1];
            double l2 = dx * dx + dy * dy;
            if (l2 == 0) return Mesafe(p, a);
            double t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
            t = Math.Max(0, Math.Min(1, t));
            double qx = a[0] + t * dx, qy = a[1] + t * dy;
            double ex = p[0] - qx, ey = p[1] - qy;
            return Math.Sqrt(ex * ex + ey * ey);
        }

        /// <summary>
        /// Noktanın bölgesi: içinde kaldığı en küçük bölge; hiçbirinin içinde değilse en yakın bölge.
        /// AutoCAD raporuyla 22.048 satırın %99'unda aynı sonucu verir.
        /// </summary>
        public static Bolge BolgeSec(double[] p, IList<Bolge> bolgeler)
        {
            if (p == null || bolgeler.Count == 0) return null;
            Bolge secilen = null;
            foreach (var b in bolgeler)
            {
                if (b.Sinir.Count < 3) continue;
                if (Icinde(p, b.Sinir) && (secilen == null || b.Alan < secilen.Alan)) secilen = b;
            }
            if (secilen != null) return secilen;
            double en = double.MaxValue;
            foreach (var b in bolgeler)
            {
                if (b.Sinir.Count < 2) continue;
                double d = CokgeneMesafe(p, b.Sinir);
                if (d < en) { en = d; secilen = b; }
            }
            return secilen;
        }
    }
}
