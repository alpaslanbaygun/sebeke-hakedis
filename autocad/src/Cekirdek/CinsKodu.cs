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
    }
}
