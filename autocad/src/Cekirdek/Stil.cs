using System;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Çizim görünümü: telefon uygulamasının DXF çıktısıyla (lejant tablosu, telefon/web/seed → legend) birebir aynı
    /// renkler, çizgi tipleri, yazı boyları ve yazı konumları. Katman ADLARI PROMAGIS düzeninde kalır (hakediş
    /// numarası katman adından okunur); renk ve çizgi tipi telefonunkidir.
    ///
    /// Telefon lejantı (AutoCAD renk numarası = ACI):
    ///   Hatlar   AG 84 · OG 1 · aydınlatma 4 · ENH 6 · abone/rekortman 84 kesikli (DASHED) · yeraltı kablo 1 nokta-çizgi (DASHDOT)
    ///   Direkler AG 120/108/3 · OG 16/10/1 · aydınlatma 190/152/4 (mevcut / yeni / söküm-montaj) · demontaj 2
    ///   Trafo 5 · SDK (box) ve pano 5 · yazılar 7 · ölçü noktaları 7
    /// Yazılar: etiket 1,8 m (1/1000'de 1,8 mm); açıklık uzunluğu 0,8 × etiket, hattın 0,8 m üstünde; hat etiketi
    /// hattın 2,5 m altında; eleman yazısı simgenin 3,5 m sağında, 3 m üstünde.
    /// </summary>
    public static class Stil
    {
        /// <summary>Renk "katmana göre" (ByLayer).</summary>
        public const short KatmanaGore = 256;
        /// <summary>Yazı rengi (telefon: ELEKTRIK-YAZI 7).</summary>
        public const short YaziRengi = 7;
        /// <summary>Demontaj nesneleri (telefon: ELEKTRIK-DEMONTAJ 2).</summary>
        public const short DemontajRengi = 2;

        /// <summary>Kesikli çizgi (abone / rekortman): 6 m çizgi, 3 m boşluk.</summary>
        public const string Kesikli = "DASHED";
        /// <summary>Nokta-çizgi (yeraltı kablo): 8 m çizgi, 2 boşluk, nokta, 2 boşluk.</summary>
        public const string NoktaCizgi = "DASHDOT";

        /// <summary>Eklentinin blok tanımlarının sürümü; değişince var olan SH_ blokları yeniden çizilir.</summary>
        public const int BlokSurumu = 2;

        /// <summary>Varsayılan etiket yüksekliği (m).</summary>
        public const double EtiketYuksekligi = 1.8;
        /// <summary>Açıklık uzunluk yazısının yüksekliği: etiket × 0,8.</summary>
        public const double UzunlukYaziKatsayisi = 0.8;
        /// <summary>Açıklık uzunluk yazısı hattın orta noktasının bu kadar üstünde (m, dünya ekseni).</summary>
        public const double UzunlukYaziPayi = 0.8;
        /// <summary>Hat etiketi hattın orta noktasının bu kadar altında (m, dünya ekseni).</summary>
        public const double EtiketPayi = -2.5;
        /// <summary>Eleman yazısı (GIS no + tip) simgeye göre: sağa 3,5 m, yukarı 3 m.</summary>
        public const double ElemanYaziSaga = 3.5, ElemanYaziYukari = 3.0;

        /// <summary>Eleman yazısı için blok özniteliğinin adı (GIS_ID + boşluk + TİP; PROMAGIS bloklarında yoktur).</summary>
        public const string EtiketOzniteligi = "ETİKET";

        // ---------------- Durum grupları ----------------

        /// <summary>Durumun görünüm grubu: 0 mevcut · 1 yeni (M, M+M, KM, ENH, ME) · 2 söküm-montaj (DM+M) · 3 demontaj (DM).</summary>
        public static int DurumGrubu(string durum)
        {
            switch ((durum ?? "").Trim().ToUpperInvariant())
            {
                case "M": case "M+M": case "KM": case "ENH": case "ME": return 1;
                case "DM+M": return 2;
                case "DM": return 3;
                default: return 0;
            }
        }

        // ---------------- Elemanlar ----------------

        private static readonly short[] AgDirek = { 120, 108, 3 }, OgDirek = { 16, 10, 1 }, AydDirek = { 190, 152, 4 };

        /// <summary>Elemanın rengi: direklerde gerilim × durum, trafo/box/pano 5, demontajda 2.</summary>
        public static short ElemanRengi(string tur, string durum)
        {
            int g = DurumGrubu(durum);
            if (g == 3) return DemontajRengi;
            int i = g == 2 ? 2 : g == 1 ? 1 : 0;
            switch (tur ?? "")
            {
                case "AG_DIREK": return AgDirek[i];
                case "MUSTEREK_DIREK":
                case "ENH_DIREK": return OgDirek[i];
                case "AYD_DIREK": return AydDirek[i];
                case "TRAFO_DIREGI":
                case "TRAFO_MERKEZI":
                case "PANO":
                case "BOX": return 5;
                case "EK_MUFU": return 1;      // yeraltı kablo rengi
                default: return YaziRengi;     // kofre, diğer
            }
        }

        // ---------------- Hatlar ----------------

        /// <summary>Hattın rengi ve çizgi tipi (boş = düz). Demontajda renk 2.</summary>
        public static void HatStili(string tur, string durum, out short renk, out string cizgiTipi)
        {
            HatTuruStili(tur, out renk, out cizgiTipi);
            if (DurumGrubu(durum) == 3) renk = DemontajRengi;
        }

        private static void HatTuruStili(string tur, out short renk, out string cizgiTipi)
        {
            cizgiTipi = "";
            switch (tur ?? "")
            {
                case "AG_YERALTI":
                case "OG_YERALTI": renk = 1; cizgiTipi = NoktaCizgi; return;
                case "OG_HAVAI": renk = 1; return;
                case "AYDINLATMA": renk = 4; return;
                case "REKORTMAN": renk = 84; cizgiTipi = Kesikli; return;
                default: renk = 84; return;   // AG_HAVAI, MUSTEREK
            }
        }

        /// <summary>Kanal 30 (PROMAGIS), sondaj 200 (PROMAGIS); telefonun lejantında ayrı kanal çizgisi yoktur.</summary>
        public const short KanalRengi = 30, SondajRengi = 200, BolgeRengi = 2, GpsRengi = 7;

        // ---------------- Katmanlar (PROMAGIS adları, telefon renkleri) ----------------

        /// <summary>Katmanın rengi ve çizgi tipi (yeni katman açılırken ve SH_STIL'de).</summary>
        public static void KatmanStili(string katman, out short renk, out string cizgiTipi)
        {
            renk = YaziRengi; cizgiTipi = "";
            katman = katman ?? "";
            int i = katman.IndexOf(".HAK.", StringComparison.Ordinal);
            string tur = i >= 0 ? katman.Substring(i + 5) : "";
            switch (tur)
            {
                case "AGDİR": renk = AgDirek[1]; return;
                case "AYDDİR": renk = AydDirek[1]; return;
                case "ENHDİR":
                case "MÜŞDİR": renk = OgDirek[1]; return;
                case "TRAFO": case "BOX": case "PANO": renk = 5; return;
                case "AG_HAV_HAT": HatTuruStili("AG_HAVAI", out renk, out cizgiTipi); return;
                case "AG_YER_HAT": HatTuruStili("AG_YERALTI", out renk, out cizgiTipi); return;
                case "AYD_HAT": HatTuruStili("AYDINLATMA", out renk, out cizgiTipi); return;
                case "OG_HAV_HAT": HatTuruStili("OG_HAVAI", out renk, out cizgiTipi); return;
                case "OG_YER_XLPE": HatTuruStili("OG_YERALTI", out renk, out cizgiTipi); return;
                case "REKORTMAN": HatTuruStili("REKORTMAN", out renk, out cizgiTipi); return;
                case "MÜŞTEREK_HAT": HatTuruStili("MUSTEREK", out renk, out cizgiTipi); return;
            }
            if (katman.EndsWith("_DEMONTAJ", StringComparison.Ordinal)) renk = DemontajRengi;
            else if (katman.EndsWith("_MEVCUT", StringComparison.Ordinal)) renk = YaziRengi;
            else if (katman.EndsWith("_STANDART", StringComparison.Ordinal)) renk = YaziRengi;
            else if (katman.EndsWith("_PROJE", StringComparison.Ordinal)) { renk = BolgeRengi; cizgiTipi = "HIDDENX2"; }
            else if (katman.EndsWith("_KABLO_KANALI", StringComparison.Ordinal)) renk = KanalRengi;
            else if (katman.EndsWith("_YATAY_SONDAJ", StringComparison.Ordinal)) renk = SondajRengi;
            else if (katman == "GPS" || katman.EndsWith("_GPS", StringComparison.Ordinal)) renk = GpsRengi;
        }

        /// <summary>Eklentinin / PROMAGIS'in düzenlediği katman mı (SH_STIL yalnız bunları boyar)?</summary>
        public static bool SebekeKatmani(string katman)
        {
            if (string.IsNullOrEmpty(katman)) return false;
            if (katman.IndexOf(".HAK.", StringComparison.Ordinal) >= 0) return true;
            if (katman == "GPS") return true;
            foreach (var son in new[] { "_DEMONTAJ", "_MEVCUT", "_STANDART", "_PROJE", "_KABLO_KANALI", "_YATAY_SONDAJ", "_GPS" })
                if (katman.EndsWith(son, StringComparison.Ordinal)) return true;
            return false;
        }

        // ---------------- Yazılar ----------------

        /// <summary>Açıklık uzunluğu yazısı: telefondaki gibi iki ondalık, nokta ile ("41.73").</summary>
        public static string UzunlukYazisi(double metre) => metre.ToString("0.00", CultureInfo.InvariantCulture);

        /// <summary>Eleman yazısı: "SC12 G-K2" (GIS no + tip; biri boşsa diğeri).</summary>
        public static string ElemanYazisi(string gisId, string tip)
        {
            string g = (gisId ?? "").Trim(), t = (tip ?? "").Trim();
            return g.Length > 0 && t.Length > 0 ? g + " " + t : g + t;
        }

        /// <summary>Yazı açısı (radyan): çizginin yönü, okunur olsun diye (−90°, 90°] aralığına getirilir.</summary>
        public static double YaziAcisi(double dx, double dy)
        {
            double a = Math.Atan2(dy, dx);
            if (a > Math.PI / 2 + 1e-9) a -= Math.PI;
            else if (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
            return a;
        }

        /// <summary>
        /// Hattın orta parçası (telefon: köşe sayısına göre ortadaki parça) ve o parçanın orta noktası / açısı.
        /// Etiket ve (tek parçalı hatta) uzunluk yazısı buraya yazılır.
        /// </summary>
        public static bool OrtaParca(System.Collections.Generic.IList<double[]> kose, out double x, out double y, out double aci)
        {
            x = y = aci = 0;
            if (kose == null || kose.Count < 2) return false;
            int i = (kose.Count - 1) / 2;
            var a = kose[i];
            var b = kose[i + 1];
            x = (a[0] + b[0]) / 2;
            y = (a[1] + b[1]) / 2;
            aci = YaziAcisi(b[0] - a[0], b[1] - a[1]);
            return true;
        }
    }
}
