using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Katman adları Türkçe karaktersiz (31.10.2026): eklentinin yazdığı her katman ç ğ ı İ ö ş ü yerine c g i I o s u ile
    /// yazılır (AGDİR → AGDIR, MÜŞDİR → MUSDIR, MÜŞTEREK_HAT → MUSTEREK_HAT; ön ek ve CBS katmanları da). Eski adlı
    /// çizimler okunurken iki ad da tanınır; eklenti bir katmana yazarken eski adlı katmanı yeni adına çevirir, Telefon
    /// Görünümü bütün şebeke katmanlarını bir kez çevirir. Telefondaki karşılığı: sh-core.cjs › katmanAscii.
    /// </summary>
    public static class KatmanAdlari
    {
        private const string Turkce = "çÇğĞıİöÖşŞüÜâÂîÎûÛ";
        private const string Karsilik = "cCgGiIoOsSuUaAiIuU";

        /// <summary>Eskiden yazılan (Türkçe karakterli) katman türleri ve yeni adları.</summary>
        public static readonly Dictionary<string, string> EskiTurler = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { "AGDİR", "AGDIR" }, { "MÜŞDİR", "MUSDIR" }, { "AYDDİR", "AYDDIR" }, { "ENHDİR", "ENHDIR" }, { "MÜŞTEREK_HAT", "MUSTEREK_HAT" },
        };

        private static readonly Regex HakedisKatmani = new Regex(@"^.+?_\d+\.HAK\..+$", RegexOptions.CultureInvariant);
        private static readonly Regex OzelKatman = new Regex(@"^.+?_(DEMONTAJ|MEVCUT|STANDART|KABLO_KANALI|YATAY_SONDAJ|PROJE|YAZI)$", RegexOptions.CultureInvariant);

        /// <summary>Türkçe karakterler ASCII karşılığıyla (ç→c, ğ→g, ı→i, İ→I, ö→o, ş→s, ü→u; şapkalılar da).</summary>
        public static string Ascii(string s)
        {
            if (string.IsNullOrEmpty(s)) return s ?? "";
            StringBuilder sb = null;
            for (int i = 0; i < s.Length; i++)
            {
                int k = Turkce.IndexOf(s[i]);
                if (k < 0) { if (sb != null) sb.Append(s[i]); continue; }
                if (sb == null) sb = new StringBuilder(s, 0, i, s.Length);
                sb.Append(Karsilik[k]);
            }
            return sb == null ? s : sb.ToString();
        }

        /// <summary>Adda Türkçe karakter var mı.</summary>
        public static bool TurkceVar(string s)
        {
            if (string.IsNullOrEmpty(s)) return false;
            foreach (char c in s) if (Turkce.IndexOf(c) >= 0) return true;
            return false;
        }

        /// <summary>Katman türü (".HAK." sonrası) eski adıyla da yeni adıyla da verilebilir; yeni adı döner.</summary>
        public static string Tur(string tur)
        {
            string yeni;
            return tur != null && EskiTurler.TryGetValue(tur, out yeni) ? yeni : Ascii(tur);
        }

        /// <summary>
        /// Şebeke katmanı mı (eklentinin ya da eski programın yazdığı): önek_hakediş.HAK.tür, önek_DEMONTAJ / MEVCUT /
        /// STANDART / KABLO_KANALI / YATAY_SONDAJ / PROJE / YAZI, GPS, ALTLIK, CBS-…, eski tür adlarından biri.
        /// Telefon Görünümü yalnız bunları çevirir (kullanıcının kendi katmanlarına dokunulmaz).
        /// </summary>
        public static bool SebekeKatmani(string ad)
        {
            if (string.IsNullOrEmpty(ad)) return false;
            if (HakedisKatmani.IsMatch(ad) || OzelKatman.IsMatch(ad)) return true;
            if (ad == "GPS" || ad == "ALTLIK" || ad.StartsWith("CBS-", StringComparison.Ordinal)) return true;
            return EskiTurler.ContainsKey(ad);
        }
    }
}
