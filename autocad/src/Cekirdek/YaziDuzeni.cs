using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Hat yazılarının düzeni (31.10.2026): metraj ve hat bilgisi (kablo tipi) parçanın ortasına ortalı yazılır —
    /// metraj çizginin üst yanında taban çizgisi ortalı, hat bilgisi alt yanında üst kenarı ortalı; ikisi aynı noktadan
    /// başlamaz, üst üste binmez. Yazı parçaya sığmıyorsa önce daraltılır (genişlik katsayısı en az 0,6), yetmezse
    /// yüksekliği küçülür (en az %60). Genişlik Tahoma'nın harf genişlikleriyle (yaklaşık) ölçülür. Telefondaki DXF
    /// yazıcıyla aynı kural ve aynı tablo (telefon/web/src/export/dxf.js › yaziGenisligi, yaziSigdir; tablo ortak
    /// stilde: cizim-stili.json › yazi.harfGenislikleri, sigdirma — CekirdekTest ikisinin aynı olduğunu denetler).
    /// </summary>
    public static class YaziDuzeni
    {
        /// <summary>Parça uzunluğunun yazıya ayrılan oranı (iki uçta pay kalır).</summary>
        public const double Pay = 0.9;
        public const double EnDarGenislik = 0.6, EnKucukYukseklik = 0.6;
        /// <summary>Tanımsız harfin genişliği (yüksekliğe oran).</summary>
        public const double Varsayilan = 0.6;

        /// <summary>Tahoma harf genişlikleri (yazı yüksekliğine oran, yaklaşık).</summary>
        private static readonly Dictionary<char, double> Harfler = Tablo(
            "  0.31|0 0.57|1 0.57|2 0.57|3 0.57|4 0.57|5 0.57|6 0.57|7 0.57|8 0.57|9 0.57|" +
            "A 0.60|B 0.59|C 0.60|D 0.68|E 0.56|F 0.52|G 0.68|H 0.69|I 0.37|J 0.42|K 0.60|L 0.50|M 0.79|N 0.69|O 0.72|" +
            "P 0.55|Q 0.72|R 0.63|S 0.55|T 0.56|U 0.67|V 0.59|W 0.89|X 0.58|Y 0.56|Z 0.53|" +
            "Ç 0.60|Ğ 0.68|İ 0.37|Ö 0.72|Ş 0.55|Ü 0.67|" +
            "a 0.52|b 0.55|c 0.46|d 0.55|e 0.52|f 0.31|g 0.55|h 0.56|i 0.23|j 0.29|k 0.50|l 0.23|m 0.83|n 0.56|o 0.53|" +
            "p 0.55|q 0.55|r 0.36|s 0.44|t 0.33|u 0.56|v 0.50|w 0.73|x 0.50|y 0.50|z 0.44|" +
            "ç 0.46|ğ 0.55|ı 0.23|ö 0.53|ş 0.44|ü 0.56|" +
            ". 0.36|, 0.36|: 0.36|; 0.36|/ 0.38|\\ 0.38|+ 0.73|- 0.36|( 0.38|) 0.38|[ 0.38|] 0.38|{ 0.49|} 0.49|" +
            "^ 0.73|* 0.56|< 0.73|> 0.73|= 0.73|° 0.47|² 0.40|³ 0.40|× 0.73|α 0.60|% 1.02|' 0.21|\" 0.36|_ 0.56");

        /// <summary>Tablodaki harf sayısı (ortak stildeki tabloyla karşılaştırmak için; cizim-stili.json › yazi.harfGenislikleri).</summary>
        public static int HarfSayisi => Harfler.Count;

        private static Dictionary<char, double> Tablo(string s)
        {
            var d = new Dictionary<char, double>();
            foreach (var p in s.Split('|'))
            {
                if (p.Length < 3) continue;
                d[p[0]] = double.Parse(p.Substring(2), System.Globalization.CultureInfo.InvariantCulture);
            }
            return d;
        }

        /// <summary>Yazının yaklaşık uzunluğu (m): harf genişlikleri × yükseklik × genişlik katsayısı.</summary>
        public static double Genislik(string metin, double yukseklik, double genislikKatsayisi = 1)
        {
            if (string.IsNullOrEmpty(metin)) return 0;
            double t = 0;
            foreach (char c in metin)
            {
                double g;
                t += Harfler.TryGetValue(c, out g) ? g : Varsayilan;
            }
            return t * yukseklik * genislikKatsayisi;
        }

        /// <summary>
        /// Yazıyı uzunluğu L olan parçaya sığdırır: sığıyorsa olduğu gibi; sığmıyorsa genişlik katsayısı (en az 0,6),
        /// yetmezse yükseklik (en az %60) küçülür. Çok kısa parçada en küçük ölçüyle kalır (taşar).
        /// </summary>
        public static void Sigdir(string metin, double yukseklik, double L, out double h, out double genislikKatsayisi)
        {
            h = yukseklik;
            genislikKatsayisi = 1;
            double yer = L * Pay, w = Genislik(metin, yukseklik);
            if (w <= yer || yer <= 0 || w <= 0) return;
            genislikKatsayisi = Math.Round(Math.Max(EnDarGenislik, yer / w), 3);
            if (w * genislikKatsayisi <= yer + 1e-9) return;
            h = Math.Round(Math.Max(EnKucukYukseklik * yukseklik, yukseklik * yer / (w * genislikKatsayisi)), 3);
        }

        /// <summary>Hat bilgisinin yazılacağı parça: çizginin en uzun parçası (yazı en çok orada sığar).</summary>
        public static int EnUzunParca(IList<double[]> kose)
        {
            int en = 0;
            double enUzun = -1;
            for (int i = 0; i + 1 < kose.Count; i++)
            {
                double d = Geometri.Mesafe(kose[i], kose[i + 1]);
                if (d > enUzun + 1e-9) { enUzun = d; en = i; }
            }
            return en;
        }

        /// <summary>
        /// a→b parçasına ortalı yazının hizalama noktası, açısı ve sığdırılmış ölçüsü. dik: hizalama noktasının parçaya
        /// dik uzaklığı (artı: yazının üst yanı). Metrajda hizalama noktası taban çizgisinin ortası, hat bilgisinde üst
        /// kenarın ortasıdır (çizimde ve DXF'te hizalama türü ayrıca verilir).
        /// </summary>
        public static void Yerlestir(double[] a, double[] b, double dik, string metin, double yukseklik,
                                     out double x, out double y, out double aci, out double h, out double genislikKatsayisi)
        {
            Geometri.YaziKonumu(a, b, new[] { 0.0, dik }, out x, out y, out aci);
            Sigdir(metin, yukseklik, Geometri.Mesafe(a, b), out h, out genislikKatsayisi);
        }
    }
}
