using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Kanal zemini: cins (dolgu: toprak, tüvenan, mıcır; ya da branşman / kablo demontaj kanalı), kaplama (yok, parke,
    /// asfalt, beton), bariyer ve trencher ayrı seçilir; çizime ve Durum Tespit'e eski programın kalem adı olarak tek yazı
    /// gider ("PARKE TUVENAN (BARİYERLİ)"). Katalogdaki 19 adın hepsi bu kuralla birebir kurulur ve çözülür; katalogda
    /// olmayan birleşim de aynı kuralla adlanır (ör. "TOPRAK (ASFALT KAPLAMALI)").
    /// Telefondaki karşılığı: telefon/web/src/interop/sh-core.cjs › kanalZeminiTanim / kanalZeminiCoz (aynı kural);
    /// ortak deneme ortak/deneme/kanal-zemini.json.
    /// </summary>
    public sealed class KanalZemini
    {
        public const string Toprak = "TOPRAK", Tuvenan = "TUVENAN", Micir = "MICIR";
        public const string Bransman = "BRANŞMAN KANAL", Demontaj = "KANAL (KABLO DEMONTAJ)";
        public const string Parke = "PARKE", Asfalt = "ASFALT", Beton = "BETON";

        /// <summary>Cinsler (seçim sırası): kod ve görünen ad.</summary>
        public static readonly string[] Cinsler = { Toprak, Tuvenan, Micir, Bransman, Demontaj };
        /// <summary>Kaplamalar ("" = kaplamasız).</summary>
        public static readonly string[] Kaplamalar = { "", Parke, Asfalt, Beton };

        public string Cins = Toprak;
        public string Kaplama = "";
        public bool Bariyerli;
        public bool Trencher;

        /// <summary>Branşman ve kablo demontaj kanalı: kaplama, bariyer ve trencher seçilmez.</summary>
        public static bool OzelMi(string cins) => cins == Bransman || cins == Demontaj;

        public static string CinsAdi(string cins)
        {
            switch (cins)
            {
                case Toprak: return "Toprak";
                case Tuvenan: return "Tüvenan";
                case Micir: return "Mıcır";
                case Bransman: return "Branşman kanalı";
                case Demontaj: return "Kablo demontaj kanalı";
                default: return cins ?? "";
            }
        }

        public static string KaplamaAdi(string kaplama)
        {
            switch (kaplama ?? "")
            {
                case "": return "Kaplamasız";
                case Parke: return "Parke";
                case Asfalt: return "Asfalt";
                case Beton: return "Beton";
                default: return kaplama;
            }
        }

        /// <summary>Kalem adı (çizime ve rapora giden yazı).</summary>
        public string Tanim
        {
            get
            {
                if (OzelMi(Cins)) return Cins;
                string cins = Cins == Tuvenan || Cins == Micir ? Cins : Toprak;
                string kaplama = Kaplama ?? "";
                var sb = new StringBuilder();
                if (Trencher) sb.Append("TRENCHER ");
                if (kaplama == Parke) sb.Append("PARKE ");
                bool sonEkli = kaplama == Asfalt || kaplama == Beton;
                // Eski programın adı: önü ve kaplama eki olmayan mıcır "MICIRLI"dır (MICIRLI, MICIRLI (BARİYERLİ))
                sb.Append(cins == Micir && sb.Length == 0 && !sonEkli ? "MICIRLI" : cins);
                if (sonEkli) sb.Append(" (").Append(kaplama).Append(" KAPLAMALI)");
                if (Bariyerli) sb.Append(" (BARİYERLİ)");
                return sb.ToString();
            }
        }

        /// <summary>Seçimin okunur yazısı: "Tüvenan · Parke · bariyerli".</summary>
        public string Yazi
        {
            get
            {
                if (OzelMi(Cins)) return CinsAdi(Cins);
                var l = new List<string> { CinsAdi(Cins), KaplamaAdi(Kaplama) };
                if (Bariyerli) l.Add("bariyerli");
                if (Trencher) l.Add("trencher");
                return string.Join(" · ", l.ToArray());
            }
        }

        /// <summary>Şeritteki kaplama listesinin yazısı (cins ayrı seçilir): "Parke · bariyerli", "Trencher · Kaplamasız".</summary>
        public string KaplamaYazisi
        {
            get
            {
                if (OzelMi(Cins)) return CinsAdi(Cins);
                return (Trencher ? "Trencher · " : "") + KaplamaAdi(Kaplama) + (Bariyerli ? " · bariyerli" : "");
            }
        }

        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

        /// <summary>Karşılaştırma yazımı: büyük harf, Türkçe harfler sadeleşir (TÜVENAN = TUVENAN, MİCİR = MICIR), tek boşluk.</summary>
        private static string Sade(string s)
        {
            var sb = new StringBuilder();
            bool bosluk = false;
            foreach (char ch in (s ?? "").Trim().ToUpper(Tr))
            {
                char c = ch;
                switch (c)
                {
                    case 'İ': c = 'I'; break;
                    case 'Ü': c = 'U'; break;
                    case 'Ş': c = 'S'; break;
                    case 'Ç': c = 'C'; break;
                    case 'Ö': c = 'O'; break;
                    case 'Ğ': c = 'G'; break;
                }
                if (char.IsWhiteSpace(c)) { bosluk = true; continue; }
                if (bosluk && sb.Length > 0) sb.Append(' ');
                bosluk = false;
                sb.Append(c);
            }
            return sb.ToString();
        }

        private static bool Kes(ref string s, string parca, bool basta)
        {
            if (basta)
            {
                if (!s.StartsWith(parca, StringComparison.Ordinal)) return false;
                s = s.Substring(parca.Length).Trim();
                return true;
            }
            int i = s.IndexOf(parca, StringComparison.Ordinal);
            if (i < 0) return false;
            s = (s.Substring(0, i) + " " + s.Substring(i + parca.Length)).Trim();
            while (s.Contains("  ")) s = s.Replace("  ", " ");
            return true;
        }

        /// <summary>
        /// Kalem adını cins / kaplama / bariyer / trencher'a ayırır. Kural dışı ad (ör. eski telefon dosyasındaki "ASFALT")
        /// için null: çağıran adı olduğu gibi korur.
        /// </summary>
        public static KanalZemini Coz(string tanim)
        {
            string s = Sade(tanim);
            if (s.Length == 0) return null;
            if (s == Sade(Bransman)) return new KanalZemini { Cins = Bransman };
            if (s == Sade(Demontaj)) return new KanalZemini { Cins = Demontaj };
            var z = new KanalZemini();
            z.Bariyerli = Kes(ref s, "(BARIYERLI)", false);
            if (Kes(ref s, "(ASFALT KAPLAMALI)", false)) z.Kaplama = Asfalt;
            else if (Kes(ref s, "(BETON KAPLAMALI)", false)) z.Kaplama = Beton;
            z.Trencher = Kes(ref s, "TRENCHER ", true);
            if (Kes(ref s, "PARKE ", true))
            {
                if (z.Kaplama.Length > 0) return null;
                z.Kaplama = Parke;
            }
            if (!z.Trencher && Kes(ref s, "TRENCHER ", true)) z.Trencher = true; // "PARKE TRENCHER …" da okunur
            switch (s)
            {
                case "TOPRAK": z.Cins = Toprak; break;
                case "TUVENAN": z.Cins = Tuvenan; break;
                case "MICIR":
                case "MICIRLI": z.Cins = Micir; break;
                default: return null;
            }
            return z;
        }

        /// <summary>Adın okunur yazısı; kural dışıysa adın kendisi.</summary>
        public static string YaziOf(string tanim)
        {
            var z = Coz(tanim);
            return z != null ? z.Yazi : (tanim ?? "");
        }

        /// <summary>Bütün birleşimler (şeritteki liste): her cins için kaplama × bariyer, sonra trencher; özel cinsler tek.</summary>
        public static List<KanalZemini> Hepsi()
        {
            var l = new List<KanalZemini>();
            foreach (var c in Cinsler)
            {
                if (OzelMi(c)) { l.Add(new KanalZemini { Cins = c }); continue; }
                foreach (bool trencher in new[] { false, true })
                    foreach (var k in Kaplamalar)
                        foreach (bool b in new[] { false, true })
                            l.Add(new KanalZemini { Cins = c, Kaplama = k, Bariyerli = b, Trencher = trencher });
            }
            return l;
        }

        public KanalZemini Kopya() => new KanalZemini { Cins = Cins, Kaplama = Kaplama, Bariyerli = Bariyerli, Trencher = Trencher };

        public override string ToString() => Tanim;
    }
}
