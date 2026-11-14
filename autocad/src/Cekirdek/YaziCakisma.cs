using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Yazı ve simge çakışmaları (14.11.2026, saha isteği: "tek tuşla yazı / simge çakışmalarını düzelt"; SH_YAZIDUZEN).
    /// Kutular dönük dikdörtgendir (merkez, en, boy, açı). Engeller (simgeler) yerinde kalır; etiketler sırayla, aday
    /// yerlerinden ilk çakışmasız olana konur (yoksa en az çakışana; eşitlikte önce gelen); konan etiket sonrakilerin
    /// engelidir. Telefondaki karşılığı: telefon/web/src/export/yazi-cakisma.js (DXF dışa aktarımı) — aynı kural, aynı aday
    /// sırası; ortak deneme: ortak/deneme/yazi-cakisma/vektorler.json.
    /// </summary>
    public static class YaziCakisma
    {
        public struct Kutu
        {
            public double X, Y, W, H, Aci;
            public Kutu(double x, double y, double w, double h, double aci = 0) { X = x; Y = y; W = w; H = h; Aci = aci; }
            public Kutu Kaydir(double dx, double dy) => new Kutu(X + dx, Y + dy, W, H, Aci);
            public override string ToString() => "(" + X + ", " + Y + ") " + W + "×" + H + " ∠" + Aci;
        }

        public sealed class Etiket
        {
            public Kutu Kutu;
            /// <summary>Aday kaydırmalar (dx, dy); ilki yerinde kalmak (0, 0).</summary>
            public List<double[]> Adaylar = new List<double[]>();
            /// <summary>Çağıranın bilgisi (ör. çizim nesnesi).</summary>
            public object Bilgi;
        }

        public sealed class Sonuc
        {
            public List<int> Secim = new List<int>();
            /// <summary>Yerinde kalsa çakışacak etiket sayısı.</summary>
            public int Cakisan;
            /// <summary>Bütün adaylarında çakışan (çözülemeyen) etiket sayısı.</summary>
            public int Cozulemeyen;
        }

        /// <summary>Yazı kutusunun çevresine bırakılan boşluk (yazı yüksekliğine oran): yazılar birbirine değmesin.</summary>
        public const double Bosluk = 0.1;

        /// <summary>Kutuyu her yanda oran × yükseklik kadar büyütür.</summary>
        public static Kutu Genislet(Kutu k, double yukseklik, double oran = Bosluk) =>
            new Kutu(k.X, k.Y, k.W + 2 * oran * yukseklik, k.H + 2 * oran * yukseklik, k.Aci);

        /// <summary>İki dönük dikdörtgen üst üste biniyor mu (ayırma ekseni; değme ve tol altı binme sayılmaz).</summary>
        public static bool Cakisir(Kutu a, Kutu b, double tol = 1e-6)
        {
            double ac = Math.Cos(a.Aci), asn = Math.Sin(a.Aci), bc = Math.Cos(b.Aci), bsn = Math.Sin(b.Aci);
            var eksenler = new[] { new[] { ac, asn }, new[] { -asn, ac }, new[] { bc, bsn }, new[] { -bsn, bc } };
            double dx = b.X - a.X, dy = b.Y - a.Y;
            foreach (var L in eksenler)
            {
                double ra = (a.W / 2) * Math.Abs(ac * L[0] + asn * L[1]) + (a.H / 2) * Math.Abs(-asn * L[0] + ac * L[1]);
                double rb = (b.W / 2) * Math.Abs(bc * L[0] + bsn * L[1]) + (b.H / 2) * Math.Abs(-bsn * L[0] + bc * L[1]);
                if (Math.Abs(dx * L[0] + dy * L[1]) >= ra + rb - tol) return false;
            }
            return true;
        }

        /// <summary>Eleman yazısının aday yerleri: merkez, simge merkezine (ax, ay) göre aynalanır; 1, 1,6 ve 2,2 kat uzakta.</summary>
        public static List<double[]> ElemanAdaylari(Kutu k, double ax, double ay)
        {
            double dx = k.X - ax, dy = k.Y - ay;
            var l = new List<double[]>();
            var yonler = new[] { new[] { 1, 1 }, new[] { -1, 1 }, new[] { 1, -1 }, new[] { -1, -1 } };
            foreach (double kat in new[] { 1, 1.6, 2.2 })
                foreach (var s in yonler) l.Add(new[] { ax + s[0] * dx * kat - k.X, ay + s[1] * dy * kat - k.Y });
            return l;
        }

        /// <summary>
        /// Hat yazısının aday yerleri: a→b parçası boyunca kaydırma (0, ∓¼, ∓0,4 parça boyu; yazı parçanın içinde kalmalı)
        /// ve çizginin öbür yanı (aynı uzaklıkta). Sıra: yerinde, öbür yan, ¼ geri / ileri, öbür yanda ¼ geri / ileri, …
        /// </summary>
        public static List<double[]> HatAdaylari(Kutu k, double[] a, double[] b)
        {
            double L = Math.Sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
            if (!(L > 1e-9)) return new List<double[]> { new double[] { 0, 0 } };
            double ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
            double s = (k.X - a[0]) * nx + (k.Y - a[1]) * ny;
            double t = (k.X - a[0]) * ux + (k.Y - a[1]) * uy - L / 2;
            var l = new List<double[]> { new double[] { 0, 0 }, new[] { -2 * s * nx, -2 * s * ny } };
            foreach (double f in new[] { 0.25, 0.4 })
            {
                var kay = new List<double>();
                foreach (double sh in new[] { -f * L, f * L }) if (Math.Abs(t + sh) + k.W / 2 <= L / 2 + 1e-9) kay.Add(sh);
                foreach (double sh in kay) l.Add(new[] { sh * ux, sh * uy });
                foreach (double sh in kay) l.Add(new[] { sh * ux - 2 * s * nx, sh * uy - 2 * s * ny });
            }
            return l;
        }

        /// <summary>Yerleştirme: her etiketin seçilen aday sırası ve sayılar.</summary>
        public static Sonuc Yerlestir(IList<Kutu> engeller, IList<Etiket> etiketler, double tol = 1e-6)
        {
            var konan = new List<Kutu>(engeller ?? new Kutu[0]);
            var r = new Sonuc();
            foreach (var e in etiketler)
            {
                var ad = e.Adaylar != null && e.Adaylar.Count > 0 ? e.Adaylar : new List<double[]> { new double[] { 0, 0 } };
                int en = -1, enSayi = int.MaxValue;
                for (int i = 0; i < ad.Count; i++)
                {
                    var k = e.Kutu.Kaydir(ad[i][0], ad[i][1]);
                    int n = 0;
                    foreach (var o in konan) if (Cakisir(k, o, tol)) n++;
                    if (i == 0 && n > 0) r.Cakisan++;
                    if (n < enSayi) { enSayi = n; en = i; }
                    if (n == 0) break;
                }
                if (enSayi > 0) r.Cozulemeyen++;
                r.Secim.Add(en);
                konan.Add(e.Kutu.Kaydir(ad[en][0], ad[en][1]));
            }
            return r;
        }
    }
}
