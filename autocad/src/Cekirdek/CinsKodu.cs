using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Cins kodlarındaki yazım hataları (31.10.2026): AG_ALİMİNYUM_KABLO → AG_ALÜMİNYUM_KABLO, KOFRA → KOFRE,
    /// TECHİZAT_MONTAJ_DEMİRİ → TEÇHİZAT_MONTAJ_DEMİRİ … Çizimden, proje dosyasından, malzeme hafızasından ve katalogdan
    /// okunan eski kod yenisine çevrilir; yazarken hep yeni kod yazılır (var olan çizim Telefon Görünümü ile bir kez
    /// çevrilir). Tablo ortak kataloğun eskiCinsler alanıyla aynıdır (CekirdekTest denetler). Telefondaki karşılığı:
    /// sh-core.cjs › cinsDuzelt.
    /// </summary>
    public static class CinsKodu
    {
        public static readonly Dictionary<string, string> Eski = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { "AG_ALİMİNYUM_KABLO", "AG_ALÜMİNYUM_KABLO" },
            { "OG_ALİMİNYUM_KABLO", "OG_ALÜMİNYUM_KABLO" },
            { "REKORTMAN_ALİMİNYUM", "REKORTMAN_ALÜMİNYUM" },
            { "ALİMİNYUM_BAĞ_TELİ", "ALÜMİNYUM_BAĞ_TELİ" },
            { "TECHİZAT_MONTAJ_DEMİRİ", "TEÇHİZAT_MONTAJ_DEMİRİ" },
            { "KOFRA", "KOFRE" },
        };

        /// <summary>Cins kodunun düzeltilmiş hâli (eski kod değilse olduğu gibi; boş / null da olduğu gibi).</summary>
        public static string Duzelt(string cins)
        {
            if (string.IsNullOrEmpty(cins)) return cins;
            string yeni;
            return Eski.TryGetValue(cins, out yeni) ? yeni : cins;
        }

        /// <summary>Okunur adda büyük kalan kısaltmalar (katalog-aktar.py › KISALTMALAR ile aynı).</summary>
        private static readonly HashSet<string> Kisaltmalar = new HashSet<string>(StringComparer.Ordinal)
            { "AG", "OG", "ENH", "BAHH", "ALPEK", "SDK", "XLPE", "NYY", "NAYY", "GLV", "CVT", "PLG", "HT", "DT", "CU", "ALM", "TR" };

        private static readonly HashSet<string> KucukSozcukler = new HashSet<string>(StringComparer.Ordinal) { "ve", "ile", "veya" };

        private static readonly System.Globalization.CultureInfo Tr = System.Globalization.CultureInfo.GetCultureInfo("tr-TR");

        /// <summary>
        /// Katalogda adı olmayan cinsin okunur adı (kullanıcı kuralı, 8.11.2026): alt çizgiler boşluk, her sözcüğün ilk
        /// harfi büyük, gerisi Türkçe kuralıyla küçük (İ → i, I → ı); kısaltmalar (AG, OG, ENH…) büyük, "ve" küçük kalır.
        /// Ör. AG_DEMİR_GLV → "AG Demir Glv" değil: katalogdaki ad "AG Galvaniz Demir Direk" önce gelir (Katalog.CinsAdi).
        /// katalog-aktar.py › okunur_ad ile aynı kural.
        /// </summary>
        public static string OkunurAd(string cins)
        {
            if (string.IsNullOrEmpty(cins)) return "";
            var out_ = new List<string>();
            foreach (var w in cins.Replace('_', ' ').Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (Kisaltmalar.Contains(w)) { out_.Add(w); continue; }
                string k = w.ToLower(Tr);
                if (KucukSozcukler.Contains(k)) { out_.Add(k); continue; }
                out_.Add(k.Substring(0, 1).ToUpper(Tr) + k.Substring(1));
            }
            return string.Join(" ", out_);
        }
    }
}
