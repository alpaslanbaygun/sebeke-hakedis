using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Ölçü noktası dosyası okuyucu (CSV / TXT). Telefonun "Noktalar (CSV)" çıktısını ve yaygın
    /// "Ad, Y, X, Z, Kod" dosyalarını okur. Türk ölçme geleneği: Y = sağa (doğu), X = yukarı (kuzey).
    /// Sütun başlığı varsa sütunlar adından bulunur; yoksa sıra Ad, Y, X, Kot, Kod kabul edilir.
    /// Y ile X yer değiştirmiş görünüyorsa (Y 7 haneli kuzey değeri) kendiliğinden düzeltilir.
    /// </summary>
    public static class NoktaDosyasi
    {
        public static List<Nokta> Oku(string metin, int varsayilanHakedis, List<string> uyarilar)
        {
            var sonuc = new List<Nokta>();
            if (string.IsNullOrEmpty(metin)) return sonuc;
            if (metin[0] == '﻿') metin = metin.Substring(1);
            var satirlar = metin.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

            char ayirici = AyiriciBul(satirlar);
            int iAd = 0, iY = 1, iX = 2, iKot = 3, iKod = 4, iHak = -1;
            bool baslikVar = false;
            int satirNo = 0, takas = 0;

            foreach (var ham in satirlar)
            {
                satirNo++;
                string s = ham.Trim();
                if (s.Length == 0 || s.StartsWith("#", StringComparison.Ordinal) || s.StartsWith("//", StringComparison.Ordinal)) continue;
                var f = Bol(s, ayirici);
                if (f.Count < 3) { uyarilar?.Add(satirNo + ". satır atlandı (en az ad, Y, X gerekir): " + s); continue; }

                if (!baslikVar && sonuc.Count == 0 && !SayiMi(Al(f, iY)) && !SayiMi(Al(f, iX)))
                {
                    // Başlık satırı: sütunları adından bul
                    baslikVar = true;
                    int cAd = -1, cY = -1, cX = -1, cKot = -1, cKod = -1, cHak = -1;
                    for (int i = 0; i < f.Count; i++)
                    {
                        string b = IlkSozcuk(f[i]);
                        if (cAd < 0 && (b == "ad" || b == "adi" || b == "nokta" || b == "no" || b == "name" || b == "point")) cAd = i;
                        else if (cY < 0 && (b == "y" || b == "saga" || b == "easting" || b == "dogu" || b == "e")) cY = i;
                        else if (cX < 0 && (b == "x" || b == "yukari" || b == "northing" || b == "kuzey" || b == "n")) cX = i;
                        else if (cKot < 0 && (b == "kot" || b == "z" || b == "h" || b == "yukseklik" || b == "elevation")) cKot = i;
                        else if (cKod < 0 && (b == "kod" || b == "code" || b == "aciklama" || b == "tanim")) cKod = i;
                        else if (cHak < 0 && b == "hakedis") cHak = i;
                    }
                    if (cY >= 0 && cX >= 0)
                    {
                        iAd = cAd >= 0 ? cAd : 0; iY = cY; iX = cX; iKot = cKot; iKod = cKod; iHak = cHak;
                    }
                    continue;
                }

                double yv = SayiCoz.Coz(Al(f, iY), double.NaN), xv = SayiCoz.Coz(Al(f, iX), double.NaN);
                if (double.IsNaN(yv) || double.IsNaN(xv)) { uyarilar?.Add(satirNo + ". satır atlandı (koordinat okunamadı): " + s); continue; }

                // Başlıksız dosyada 4. sütun sayı değilse kod kabul edilir (Ad, Y, X, Kod)
                string kotYazi = iKot >= 0 ? Al(f, iKot) : "";
                string kod = iKod >= 0 ? Al(f, iKod) : "";
                if (!baslikVar && kotYazi.Length > 0 && !SayiMi(kotYazi)) { kod = kotYazi; kotYazi = ""; }

                if (yv > 1000000 && xv < 1000000) { double t = yv; yv = xv; xv = t; takas++; }

                var n = new Nokta
                {
                    Ad = Al(f, iAd),
                    Kod = kod,
                    Saga = yv,
                    Yukari = xv,
                    Kot = SayiCoz.Coz(kotYazi, 0),
                    Hakedis = iHak >= 0 ? SayiCoz.Tam(Al(f, iHak), varsayilanHakedis) : varsayilanHakedis,
                };
                if (n.Hakedis <= 0) n.Hakedis = varsayilanHakedis;
                sonuc.Add(n);
            }
            if (takas > 0) uyarilar?.Add(takas + " noktada Y ile X yer değiştirmiş görünüyordu; düzeltildi (Y = sağa, X = yukarı).");
            return sonuc;
        }

        /// <summary>
        /// Dosya baytlarını metne çevirir: UTF-8 (BOM'lu ya da BOM'suz) geçerliyse o, değilse Türkçe Windows
        /// kod sayfası (1254). Eski ölçü cihazlarının ve Excel'in "CSV" çıktıları genellikle 1254'tür.
        /// </summary>
        public static string MetinCoz(byte[] baytlar)
        {
            if (baytlar == null || baytlar.Length == 0) return "";
            try { return new System.Text.UTF8Encoding(false, true).GetString(baytlar); }
            catch (System.Text.DecoderFallbackException) { }
#if NET5_0_OR_GREATER
            try { System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance); } catch { }
#endif
            try { return System.Text.Encoding.GetEncoding(1254).GetString(baytlar); }
            catch { return System.Text.Encoding.UTF8.GetString(baytlar); }
        }

        private static char AyiriciBul(string[] satirlar)
        {
            int noktaliVirgul = 0, sekme = 0, virgul = 0, bak = 0;
            foreach (var s in satirlar)
            {
                if (s.Trim().Length == 0) continue;
                if (s.IndexOf(';') >= 0) noktaliVirgul++;
                if (s.IndexOf('\t') >= 0) sekme++;
                if (s.IndexOf(',') >= 0) virgul++;
                if (++bak >= 20) break;
            }
            if (noktaliVirgul > 0) return ';';
            if (sekme > 0) return '\t';
            if (virgul > 0) return ',';
            return ' ';
        }

        private static List<string> Bol(string s, char ayirici)
        {
            var l = new List<string>();
            if (ayirici == ' ')
            {
                foreach (var p in s.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)) l.Add(p.Trim());
                return l;
            }
            // Tırnaklı alanları koru ("A;B" gibi)
            var sb = new System.Text.StringBuilder();
            bool tirnak = false;
            foreach (char c in s)
            {
                if (c == '"') { tirnak = !tirnak; continue; }
                if (c == ayirici && !tirnak) { l.Add(sb.ToString().Trim()); sb.Clear(); continue; }
                sb.Append(c);
            }
            l.Add(sb.ToString().Trim());
            return l;
        }

        private static string Al(List<string> f, int i) => i >= 0 && i < f.Count ? f[i] : "";

        private static bool SayiMi(string s) => !double.IsNaN(SayiCoz.Coz(s, double.NaN));

        /// <summary>Başlık hücresinin ilk sözcüğü, küçük harf ve Türkçe harfler sadeleştirilmiş ("Y (Sağa)" → "y").</summary>
        private static string IlkSozcuk(string s)
        {
            s = (s ?? "").Trim().ToLowerInvariant()
                .Replace('ı', 'i').Replace('ş', 's').Replace('ğ', 'g').Replace('ü', 'u').Replace('ö', 'o').Replace('ç', 'c').Replace("\u0307", "");
            int i = 0;
            while (i < s.Length && (char.IsLetterOrDigit(s[i]) || s[i] == '_')) i++;
            return s.Substring(0, i);
        }
    }
}
