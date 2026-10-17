using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Çizim kategorisi (şerit menüdeki seçim): hangi elemanların ve hatların sunulacağı ve tarifenin unsur hanesi.
    /// PROMAGIS'te unsur her kalemde elle seçilir; burada kategori seçmek yeter (AG havai 07, AG yeraltı 05,
    /// OG havai 06, ENH 03, OG yeraltı 04, aydınlatma 08).
    /// </summary>
    public sealed class Kategori
    {
        public readonly string Kod, Ad, Unsur;
        public readonly string[] Elemanlar, Hatlar;
        public readonly bool Kanal, Sondaj;

        public Kategori(string kod, string ad, string unsur, string[] elemanlar, string[] hatlar, bool kanal = false, bool sondaj = false)
        {
            Kod = kod; Ad = ad; Unsur = unsur ?? ""; Elemanlar = elemanlar ?? new string[0]; Hatlar = hatlar ?? new string[0]; Kanal = kanal; Sondaj = sondaj;
        }

        public override string ToString() => Ad;
    }

    public static class Kategoriler
    {
        public const string Genel = "GENEL";

        /// <summary>Kategorinin değiştirebildiği unsurlar: yer / gerilim sınıfına bağlı olanlar (ENH, şehir yeraltı / havai).</summary>
        private static readonly HashSet<string> YereBagliUnsurlar = new HashSet<string>(StringComparer.Ordinal) { "03", "04", "05", "06", "07" };

        public static readonly Kategori[] Hepsi =
        {
            new Kategori("AG_HAVAI", "AG Havai", "07",
                new[] { "AG_DIREK", "MUSTEREK_DIREK", "KOFRE" },
                new[] { "AG_HAVAI", "MUSTEREK", "REKORTMAN" }),
            new Kategori("AG_YERALTI", "AG Yeraltı", "05",
                new[] { "BOX", "PANO", "EK_MUFU" },
                new[] { "AG_YERALTI", "REKORTMAN" }, true, true),
            new Kategori("OG_HAVAI", "OG Havai (şehir)", "06",
                new[] { "ENH_DIREK", "MUSTEREK_DIREK", "TRAFO_DIREGI" },
                new[] { "OG_HAVAI", "MUSTEREK" }),
            new Kategori("ENH", "ENH (nakil hattı)", "03",
                new[] { "ENH_DIREK", "TRAFO_DIREGI" },
                new[] { "OG_HAVAI" }),
            new Kategori("OG_YERALTI", "OG Yeraltı", "04",
                new[] { "TRAFO_MERKEZI", "EK_MUFU", "PANO" },
                new[] { "OG_YERALTI" }, true, true),
            new Kategori("AYDINLATMA", "Aydınlatma", "08",
                new[] { "AYD_DIREK" },
                new[] { "AYDINLATMA" }, true, false),
            new Kategori("TRAFO", "Trafo ve pano", "",
                new[] { "TRAFO_DIREGI", "TRAFO_MERKEZI", "PANO", "BOX" },
                new string[0]),
            new Kategori(Genel, "Tümü", "",
                new[] { "AG_DIREK", "MUSTEREK_DIREK", "AYD_DIREK", "ENH_DIREK", "TRAFO_DIREGI", "TRAFO_MERKEZI", "PANO", "BOX", "EK_MUFU", "KOFRE", "DIGER" },
                new[] { "AG_HAVAI", "AG_YERALTI", "AYDINLATMA", "OG_HAVAI", "OG_YERALTI", "REKORTMAN", "MUSTEREK" }, true, true),
        };

        public static Kategori Bul(string kod)
        {
            foreach (var k in Hepsi) if (k.Kod == kod) return k;
            return null;
        }

        /// <summary>Kategorinin unsuru; "Tümü" ve trafo kategorisinde boş (katalogdaki kullanılır).</summary>
        public static string Unsur(string kategoriKodu)
        {
            var k = Bul(kategoriKodu);
            return k != null ? k.Unsur : "";
        }

        /// <summary>
        /// Kategori unsuru yalnız yere bağlı unsurları değiştirir: ENH ↔ şehir havai OG, AG havai ↔ yeraltı gibi.
        /// Trafo ekipmanı (01/02), aydınlatma (08), rekortman (09/10) gibi kalemler katalogdaki unsurunu korur.
        /// </summary>
        public static string UnsurUygula(string katalogTarifesi, string kategoriUnsuru)
        {
            if (string.IsNullOrEmpty(kategoriUnsuru)) return "";
            string t = (katalogTarifesi ?? "").Trim();
            string u = t.Length >= 4 ? t.Substring(2, 2) : "";
            if (u.Length > 0 && !YereBagliUnsurlar.Contains(u)) return "";
            return YereBagliUnsurlar.Contains(kategoriUnsuru) ? kategoriUnsuru : "";
        }

        /// <summary>Elemanın türü hangi kategorilerde sunuluyor (ilk eşleşen; yoksa Tümü).</summary>
        public static Kategori ElemanKategorisi(string tur)
        {
            foreach (var k in Hepsi) if (k.Kod != Genel && Array.IndexOf(k.Elemanlar, tur) >= 0) return k;
            return Bul(Genel);
        }
    }
}
