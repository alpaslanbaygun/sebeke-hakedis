using System;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Çizim koordinatı ile enlem-boylam arasında çeviri. Çizim: ITRF96 / TUREF, 3° TM (dilim orta meridyeni DOM, ölçek 1,
    /// sağa değere 500 000 eklenir). Enlem-boylam GRS80 elipsoidinde; ITRF96 ile WGS84 arasındaki fark metrenin altındadır
    /// (Google Earth, harita altlığı ve CBS dosyaları için ayrıca dönüşüm gerekmez).
    /// Formüller telefondaki geo/crs.js ile aynıdır: Krüger n-serisi (6. derece, Karney 2011), mm altı doğruluk.
    /// </summary>
    public static class Koordinat
    {
        public const double SagaOteleme = 500000, Olcek = 1.0;
        private const double A = 6378137.0, F = 1 / 298.257222101; // GRS80
        private const double D2R = Math.PI / 180, R2D = 180 / Math.PI;
        private static readonly double E, Ab;
        private static readonly double[] Al = new double[7], Be = new double[7];

        static Koordinat()
        {
            double n = F / (2 - F), n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
            E = Math.Sqrt(F * (2 - F));
            Ab = A / (1 + n) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
            Al[1] = n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180 - 127 * n5 / 288 + 7891 * n6 / 37800;
            Al[2] = 13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440 + 281 * n5 / 630 - 1983433 * n6 / 1935360;
            Al[3] = 61 * n3 / 240 - 103 * n4 / 140 + 15061 * n5 / 26880 + 167603 * n6 / 181440;
            Al[4] = 49561 * n4 / 161280 - 179 * n5 / 168 + 6601661 * n6 / 7257600;
            Al[5] = 34729 * n5 / 80640 - 3418889 * n6 / 1995840;
            Al[6] = 212378941 * n6 / 319334400;
            Be[1] = n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360 - 81 * n5 / 512 + 96199 * n6 / 604800;
            Be[2] = n2 / 48 + n3 / 15 - 437 * n4 / 1440 + 46 * n5 / 105 - 1118711 * n6 / 3870720;
            Be[3] = 17 * n3 / 480 - 37 * n4 / 840 - 209 * n5 / 4480 + 5569 * n6 / 90720;
            Be[4] = 4397 * n4 / 161280 - 11 * n5 / 504 - 830251 * n6 / 7257600;
            Be[5] = 4583 * n5 / 161280 - 108847 * n6 / 3991680;
            Be[6] = 20648693 * n6 / 638668800;
        }

        /// <summary>Çizim koordinatından (sağa, yukarı; m) enlem ve boylama (derece).</summary>
        public static void EnlemBoylam(double saga, double yukari, int dom, out double enlem, out double boylam) =>
            TmdenEnlemBoylam(saga, yukari, dom, Olcek, SagaOteleme, 0, out enlem, out boylam);

        /// <summary>Enlem ve boylamdan (derece) çizim koordinatına (sağa, yukarı; m).</summary>
        public static void CizimKoordinati(double enlem, double boylam, int dom, out double saga, out double yukari) =>
            EnlemBoylamdanTm(enlem, boylam, dom, Olcek, SagaOteleme, 0, out saga, out yukari);

        /// <summary>Herhangi bir TM (orta meridyen, ölçek, sağa / yukarı öteleme; GRS80) koordinatından enlem ve boylama.</summary>
        public static void TmdenEnlemBoylam(double saga, double yukari, double om, double k0, double fe, double fn, out double enlem, out double boylam)
        {
            double xi = (yukari - fn) / (k0 * Ab), eta = (saga - fe) / (k0 * Ab);
            double xi1 = xi, eta1 = eta;
            for (int j = 1; j <= 6; j++)
            {
                xi1 -= Be[j] * Math.Sin(2 * j * xi) * Math.Cosh(2 * j * eta);
                eta1 -= Be[j] * Math.Cos(2 * j * xi) * Math.Sinh(2 * j * eta);
            }
            double sh = Math.Sinh(eta1), cx = Math.Cos(xi1);
            double tau1 = Math.Sin(xi1) / Math.Sqrt(sh * sh + cx * cx);
            double lam = Math.Atan2(sh, cx);
            double e2 = E * E, tau = tau1;
            for (int i = 0; i < 8; i++)
            {
                double s = Math.Sinh(E * Atanh(E * tau / Math.Sqrt(1 + tau * tau)));
                double ti = tau * Math.Sqrt(1 + s * s) - s * Math.Sqrt(1 + tau * tau);
                double d = (tau1 - ti) / Math.Sqrt(1 + ti * ti) * ((1 + (1 - e2) * tau * tau) / ((1 - e2) * Math.Sqrt(1 + tau * tau)));
                tau += d;
                if (Math.Abs(d) < 1e-14) break;
            }
            enlem = Math.Atan(tau) * R2D;
            boylam = om + lam * R2D;
        }

        /// <summary>Enlem ve boylamdan herhangi bir TM koordinatına (GRS80).</summary>
        public static void EnlemBoylamdanTm(double enlem, double boylam, double om, double k0, double fe, double fn, out double saga, out double yukari)
        {
            double phi = enlem * D2R, lam = (boylam - om) * D2R;
            double sp = Math.Sin(phi);
            double t = Math.Sinh(Atanh(sp) - E * Atanh(E * sp));
            double xi1 = Math.Atan2(t, Math.Cos(lam));
            double eta1 = Atanh(Math.Sin(lam) / Math.Sqrt(1 + t * t));
            double xi = xi1, eta = eta1;
            for (int j = 1; j <= 6; j++)
            {
                xi += Al[j] * Math.Sin(2 * j * xi1) * Math.Cosh(2 * j * eta1);
                eta += Al[j] * Math.Cos(2 * j * xi1) * Math.Sinh(2 * j * eta1);
            }
            saga = fe + k0 * Ab * eta;
            yukari = fn + k0 * Ab * xi;
        }

        /// <summary>Boylamın 3° dilim orta meridyeni (Türkiye: 27–45).</summary>
        public static int DomBul(double boylam) => Math.Min(45, Math.Max(27, (int)Math.Round(boylam / 3) * 3));

        /// <summary>
        /// Koordinat 3° TM dilimine uyuyor mu (Türkiye: yukarı değer 3,9–4,8 milyon m, sağa değer 300–700 bin m)?
        /// Uymuyorsa çizim yerel / kaydırılmış koordinatla çizilmiş olabilir.
        /// </summary>
        public static bool TmDilimindeMi(double saga, double yukari) =>
            yukari > 3900000 && yukari < 4800000 && saga > 300000 && saga < 700000;

        /// <summary>Dilim yazısı: "ITRF96 / TM 39 (3°)".</summary>
        public static string DilimAdi(int dom) => "ITRF96 / TM " + dom + " (3°)";

        private static double Atanh(double x) => 0.5 * Math.Log((1 + x) / (1 - x));
    }
}
