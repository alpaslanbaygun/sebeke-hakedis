using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Malzeme adlarının görünen yazımı: katalogdaki adlar eski programdan geldiği gibi karışık yazılmıştır ("3x50/16 Xlpe
    /// Alm.", "1X16+25 ALPEK", "36KV 630A 16KA", "17,5 kV 25 kVA Herm."). Görünen yazı tek düzene getirilir:
    ///  - kelimeler BÜYÜK harf (Türkçe kuralıyla: i → İ);
    ///  - birimler standart: kV, kVA, kVAr, kA, kN, kW, MVA, MVAr, Hz, mm, mm², cm, m; sayı ile birim arasında boşluk;
    ///  - kablo kodları büyük (NYY, NYM, XLPE…), metaller Cu ve Al ("Alm." → "Al"), boyut çarpısı küçük x (3x50);
    ///  - yaygın kısaltmalar açık yazılır (Herm. → HERMETİK, Gen. Tank. → GENLEŞME TANKLI, Arm. → ARMATÜR,
    ///    K.B → KABLO BAŞLIĞI...), D.T / H.T → DT / HT; ondalık virgül; birkaç yazım hatası düzeltilir.
    /// Yalnız görünen yazı değişir: kayıtlı veri, rapor (Durum Tespit) ve eski programla eşleşme aynı kalır.
    /// Telefondaki karşılığı: telefon/web/src/interop/sh-core.cjs › malzemeYazisi (aynı kurallar, aynı sıra).
    /// </summary>
    public static class MalzemeYazimi
    {
        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
        private const string Harf = "A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû";

        /// <summary>Açık yazılan kısaltmalar ve yazım düzeltmeleri (büyük harfe çevrilmiş metinde; uzun olan önce).</summary>
        private static readonly string[][] Acilimlar =
        {
            new[] { "GEN. TANK.", "GENLEŞME TANKLI" },
            new[] { "SOD.BUH.AMP.", "SODYUM BUHARLI AMPUL" },
            new[] { "ANH. OTO. SİG.", "ANAHTARLI OTOMATİK SİGORTA" },
            new[] { "İŞLETME TOP.", "İŞLETME TOPRAKLAMASI" },
            new[] { "MESNET İZO.", "MESNET İZOLATÖRÜ" },
            new[] { "GEÇİT İZO.", "GEÇİT İZOLATÖRÜ" },
            new[] { "ZİNC. İZO.", "ZİNCİR İZOLATÖRÜ" },
            new[] { "İRT.KLEMENS", "İRTİBAT KLEMENSİ" },
            new[] { "PLUG-IN BAŞ.", "PLUG-IN BAŞLIK" },
            new[] { "SF6 G.K", "SF6 GAZLI KESİCİ" },
            new[] { "VAK. K.", "VAKUM KESİCİ" },
            new[] { "VAK.", "VAKUM" },
            new[] { "YÜK AYR.", "YÜK AYIRICI" },
            new[] { "YÜK.BAS.", "YÜKSEK BASINÇLI" },
            new[] { "ŞEF. TÜP.", "ŞEFFAF TÜP" },
            new[] { "HERM.", "HERMETİK" },
            new[] { "ARM.", "ARMATÜR" },
            new[] { "K.B.", "KABLO BAŞLIĞI" },
            new[] { "K.B", "KABLO BAŞLIĞI" },
            new[] { "SİGOR.", "SİGORTALI" },
            new[] { "TOPR.", "TOPRAKLAMALI" },
            new[] { "KÖŞEB.", "KÖŞEBENT" },
            new[] { "KÖŞEBNT", "KÖŞEBENT" },
            new[] { "TRAV.", "TRAVERS" },
            new[] { "HÜC.", "HÜCRESİ" },
            new[] { "PLMR", "POLİMER" },
            new[] { "PN.", "PANO" },
            new[] { "D.T.", "DT" },
            new[] { "D.T", "DT" },
            new[] { "H.T.", "HT" },
            new[] { "H.T", "HT" },
            new[] { "ALM.", "Al" },
            // Yazım hataları
            new[] { "TUTANAGI", "TUTANAĞI" },
            new[] { "SÜKÜLMESİ", "SÖKÜLMESİ" },
            new[] { "İZOLATOR", "İZOLATÖR" },
            new[] { "KANCASİ", "KANCASI" },
            new[] { "PARAFUDUR", "PARAFUDR" },
            new[] { "MAŞON", "MANŞON" },
        };

        /// <summary>
        /// Birimlerin standart yazımı (büyük harfe çevrilmiş metinde): yalnız sayıdan sonra (ör. "36KV", "12,5 KA"; "KN-70/100"
        /// gibi tip kodlarına dokunulmaz), ardında harf / rakam yok.
        /// </summary>
        private static readonly string[][] Birimler =
        {
            new[] { "KVAR", "kVAr" }, new[] { "MVAR", "MVAr" }, new[] { "KVA", "kVA" }, new[] { "KV", "kV" }, new[] { "KA", "kA" },
            new[] { "KN", "kN" }, new[] { "KW", "kW" }, new[] { "HZ", "Hz" }, new[] { "MM²", "mm²" }, new[] { "MM", "mm" }, new[] { "CM", "cm" },
        };

        /// <summary>Metaller: tek başına yazılmış CU, AL (ör. "NYY CU").</summary>
        private static readonly string[][] Metaller = { new[] { "CU", "Cu" }, new[] { "AL", "Al" } };

        private static readonly List<KeyValuePair<Regex, string>> AcilimKurallari = new List<KeyValuePair<Regex, string>>();
        private static readonly List<KeyValuePair<Regex, string>> BirimKurallari = new List<KeyValuePair<Regex, string>>();
        private static readonly Regex Bosluk = new Regex(@"\s+", RegexOptions.CultureInvariant);
        private static readonly Regex Carpi = new Regex(@"(?<=[\d)""'])X(?=[\d(])", RegexOptions.CultureInvariant);
        private static readonly Regex CarpiKod = new Regex(@"(?<=\d)X(?=[A-ZÇĞİÖŞÜ]{2})", RegexOptions.CultureInvariant);
        private static readonly Regex Metre = new Regex(@"(\d)\s?(?:MT|M)\.?(?![" + Harf + @"\d.])", RegexOptions.CultureInvariant);
        private static readonly Regex BirimBosluk = new Regex(@"(\d)(kVAr|MVAr|kVA|MVA|kV|kA|kN|kW|Hz|mm²|mm|cm)(?![" + Harf + @"\d])", RegexOptions.CultureInvariant);
        private static readonly Regex AmperVoltVat = new Regex(@"(\d{2,})(A|V|W)(?=$|[\s,;)/\-])", RegexOptions.CultureInvariant);
        private static readonly Regex Ondalik = new Regex(@"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", RegexOptions.CultureInvariant);
        private static readonly Regex ParantezIci = new Regex(@"\(\s+|\s+\)", RegexOptions.CultureInvariant);
        /// <summary>Armatürde "150W SB" → sodyum buharlı.</summary>
        private static readonly Regex SodyumBuharli = new Regex(@"(?<=\d\s?W\s)SB(?![" + Harf + @"\d])", RegexOptions.CultureInvariant);

        static MalzemeYazimi()
        {
            foreach (var a in Acilimlar)
            {
                string desen = "(?<![" + Harf + @"\d])" + Regex.Escape(a[0]) + (char.IsLetter(a[0][a[0].Length - 1]) ? "(?![" + Harf + "])" : "");
                AcilimKurallari.Add(new KeyValuePair<Regex, string>(new Regex(desen, RegexOptions.CultureInvariant), a[1]));
            }
            foreach (var b in Birimler)
            {
                string desen = @"(?<=\d\s?)" + Regex.Escape(b[0]) + "(?![" + Harf + @"\d])";
                BirimKurallari.Add(new KeyValuePair<Regex, string>(new Regex(desen, RegexOptions.CultureInvariant), b[1]));
            }
            foreach (var b in Metaller)
            {
                string desen = "(?<![" + Harf + @"\d])" + Regex.Escape(b[0]) + "(?![" + Harf + @"\d])";
                BirimKurallari.Add(new KeyValuePair<Regex, string>(new Regex(desen, RegexOptions.CultureInvariant), b[1]));
            }
        }

        /// <summary>Görünen yazı (boşsa olduğu gibi). Aynı yazıya ikinci kez uygulanınca değişmez.</summary>
        public static string Duzelt(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return s ?? "";
            string t = Bosluk.Replace(s.Replace('\\', '/'), " ").Trim();
            t = t.ToUpper(Tr);
            foreach (var k in AcilimKurallari)
            {
                string metin = t, deger = k.Value;
                // Açılan kısaltmanın hemen ardından gelen harf / rakam ayrılır ("TRAV.60X60" → "TRAVERS 60X60")
                t = k.Key.Replace(metin, m => deger + (m.Index + m.Length < metin.Length && char.IsLetterOrDigit(metin[m.Index + m.Length]) ? " " : ""));
            }
            t = SodyumBuharli.Replace(t, "SODYUM BUHARLI");
            foreach (var k in BirimKurallari) t = k.Key.Replace(t, k.Value);
            t = Carpi.Replace(t, "x");
            t = CarpiKod.Replace(t, "x");
            t = Metre.Replace(t, "$1 m");
            t = BirimBosluk.Replace(t, "$1 $2");
            t = AmperVoltVat.Replace(t, "$1 $2");
            t = Ondalik.Replace(t, "$1,$2");
            t = ParantezIci.Replace(t, m => m.Value.Trim());
            return Bosluk.Replace(t, " ").Trim();
        }
    }
}
