using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Metraj ve hacim kuralları (telefondaki hatMetraji / kanalHacmi ile aynı).</summary>
    public static class Metraj
    {
        /// <summary>Hat metrajı: çizim uzunluğu yukarı yuvarlanır (ya da en yakına), türüne göre ek pay eklenir.</summary>
        public static double Hat(double cizim, bool yukariYuvarla, double ekPay)
        {
            double L = Math.Max(0, double.IsNaN(cizim) ? 0 : cizim);
            double m = yukariYuvarla ? Math.Ceiling(L - 1e-6) : Math.Round(L, MidpointRounding.AwayFromZero);
            return m + ekPay;
        }

        /// <summary>Kanal ve sondaj metrajı: çizim uzunluğu yukarı yuvarlanır.</summary>
        public static double Kanal(double cizim) => Math.Ceiling(Math.Max(0, cizim) - 1e-6);

        /// <summary>Kanal hacmi (m³): genişlikler ve derinlik cm, uzunluk m.</summary>
        public static double KanalHacmi(double altCm, double ustCm, double derinlikCm, double uzunlukM) =>
            SayiCoz.Temiz((altCm + ustCm) / 2.0 / 100.0 * (derinlikCm / 100.0) * uzunlukM);

        /// <summary>Etiketteki metraj yazımı ("341", "10,5").</summary>
        public static string Yazi(double m)
        {
            double v = SayiCoz.Temiz(m, 2);
            if (v == Math.Floor(v)) return ((long)v).ToString(CultureInfo.InvariantCulture);
            return v.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',');
        }

        /// <summary>Kalemin toplamı: kanalın kendi kaleminde hacim, diğerlerinde miktar × katsayı.</summary>
        public static void Toplam(Kalem k, Kanal kanal = null)
        {
            if (kanal != null && k.Ana) k.Toplam = KanalHacmi(kanal.AltGenislik, kanal.UstGenislik, kanal.Derinlik, k.Miktar);
            else k.Toplam = SayiCoz.Temiz(k.Miktar * k.Katsayi);
        }
    }

    /// <summary>
    /// Çizime bağlı ayarlar (çizimin içinde saklanır, çizimle birlikte taşınır).
    /// 0 / boş değerler "çizimden bul" demektir.
    /// </summary>
    public sealed class CizimAyarlari
    {
        public string KatmanOnEki = "";
        public string GisOnEki = "";
        public int AktifHakedis;
        public int Dom;
        public double SembolOlcegi;
        /// <summary>Hat etiketi ve eleman yazısı yüksekliği (m); telefonun DXF'iyle aynı: 1.8.</summary>
        public double EtiketYuksekligi = 1.8;
        public double YakalamaMesafesi = 1.0;
        public bool YukariYuvarla = true;
        public readonly Dictionary<string, double> EkPay = new Dictionary<string, double>(StringComparer.Ordinal);
        public double KanalAlt = 40, KanalUst = 40, KanalDerinlik = 100;
        public string KanalZemin = "TOPRAK";
        /// <summary>Tarife karakteristiği (2 hane, ör. 01); boş: katalogdaki standart karakteristik (PROMAGIS KRTNALINACAK).</summary>
        public string Karakteristik = "";
        /// <summary>Unsur sütunu: false şehir (yatırım), true köy / bakım (PROMAGIS SMIKMU 1/2).</summary>
        public bool Koy;
        /// <summary>Sembol takımı: true telefonla aynı SH_ simgeler (varsayılan), false çizimdeki PROMAGIS blokları.</summary>
        public bool TelefonSembolleri = true;

        /// <summary>Son seçimler (tür, tip, kesit, durum...): bir sonraki komutta hazır gelir.</summary>
        public readonly Dictionary<string, string> Son = new Dictionary<string, string>(StringComparer.Ordinal);

        public double EkPayi(string hatTuru)
        {
            double d;
            return EkPay.TryGetValue(hatTuru ?? "", out d) ? d : 0;
        }

        public double HatMetraji(double cizim, string hatTuru) => Metraj.Hat(cizim, YukariYuvarla, EkPayi(hatTuru));

        /// <summary>Katalog kaleminin bu çizimdeki tarifesi (karakteristik ve şehir/köy ayarına göre).</summary>
        public string Tarife(KatalogKalemi it) => Katalog.TarifeSec(it, Karakteristik, Koy);

        public string SonDeger(string anahtar, string varsayilan = "")
        {
            string d;
            return Son.TryGetValue(anahtar, out d) && !string.IsNullOrEmpty(d) ? d : varsayilan;
        }

        // ---------------- Saklama: anahtar / değer çiftleri ----------------

        private static string S(double d) => d.ToString("R", CultureInfo.InvariantCulture);

        public List<KeyValuePair<string, string>> Ciftler()
        {
            var l = new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("surum", "2"),
                new KeyValuePair<string, string>("katmanOnEki", KatmanOnEki ?? ""),
                new KeyValuePair<string, string>("gisOnEki", GisOnEki ?? ""),
                new KeyValuePair<string, string>("aktifHakedis", AktifHakedis.ToString(CultureInfo.InvariantCulture)),
                new KeyValuePair<string, string>("dom", Dom.ToString(CultureInfo.InvariantCulture)),
                new KeyValuePair<string, string>("sembolOlcegi", S(SembolOlcegi)),
                new KeyValuePair<string, string>("etiketYuksekligi", S(EtiketYuksekligi)),
                new KeyValuePair<string, string>("yakalamaMesafesi", S(YakalamaMesafesi)),
                new KeyValuePair<string, string>("yukariYuvarla", YukariYuvarla ? "1" : "0"),
                new KeyValuePair<string, string>("kanalAlt", S(KanalAlt)),
                new KeyValuePair<string, string>("kanalUst", S(KanalUst)),
                new KeyValuePair<string, string>("kanalDerinlik", S(KanalDerinlik)),
                new KeyValuePair<string, string>("kanalZemin", KanalZemin ?? ""),
                new KeyValuePair<string, string>("karakteristik", Karakteristik ?? ""),
                new KeyValuePair<string, string>("koy", Koy ? "1" : "0"),
                new KeyValuePair<string, string>("telefonSembolleri", TelefonSembolleri ? "1" : "0"),
            };
            foreach (var kv in EkPay) l.Add(new KeyValuePair<string, string>("ekPay." + kv.Key, S(kv.Value)));
            foreach (var kv in Son) l.Add(new KeyValuePair<string, string>("son." + kv.Key, kv.Value ?? ""));
            return l;
        }

        public static CizimAyarlari Ciftlerden(IEnumerable<KeyValuePair<string, string>> ciftler)
        {
            var a = new CizimAyarlari();
            if (ciftler == null) return a;
            int surum = 2;
            foreach (var kv in ciftler)
            {
                string k = kv.Key ?? "", v = kv.Value ?? "";
                if (k == "surum") { surum = SayiCoz.Tam(v, 2); continue; }
                if (k.StartsWith("ekPay.", StringComparison.Ordinal)) { a.EkPay[k.Substring(6)] = SayiCoz.Coz(v); continue; }
                if (k.StartsWith("son.", StringComparison.Ordinal)) { a.Son[k.Substring(4)] = v; continue; }
                switch (k)
                {
                    case "katmanOnEki": a.KatmanOnEki = v.Trim(); break;
                    case "gisOnEki": a.GisOnEki = v.Trim(); break;
                    case "aktifHakedis": a.AktifHakedis = SayiCoz.Tam(v); break;
                    case "dom": a.Dom = SayiCoz.Tam(v); break;
                    case "sembolOlcegi": a.SembolOlcegi = SayiCoz.Coz(v); break;
                    case "etiketYuksekligi": a.EtiketYuksekligi = SayiCoz.Coz(v, 1.8); break;
                    case "yakalamaMesafesi": a.YakalamaMesafesi = SayiCoz.Coz(v, 1.0); break;
                    case "yukariYuvarla": a.YukariYuvarla = v != "0"; break;
                    case "kanalAlt": a.KanalAlt = SayiCoz.Coz(v, 40); break;
                    case "kanalUst": a.KanalUst = SayiCoz.Coz(v, 40); break;
                    case "kanalDerinlik": a.KanalDerinlik = SayiCoz.Coz(v, 100); break;
                    case "kanalZemin": a.KanalZemin = string.IsNullOrEmpty(v) ? "TOPRAK" : v; break;
                    case "karakteristik": a.Karakteristik = v.Trim(); break;
                    case "koy": a.Koy = v == "1"; break;
                    case "telefonSembolleri": a.TelefonSembolleri = v != "0"; break;
                }
            }
            // Sürüm 1 ayarlarında varsayılan 0,5 m idi (PROMAGIS görünümü); telefon stiliyle 1,8 m
            if (a.EtiketYuksekligi <= 0 || (surum < 2 && Math.Abs(a.EtiketYuksekligi - 0.5) < 1e-9)) a.EtiketYuksekligi = 1.8;
            if (a.YakalamaMesafesi < 0) a.YakalamaMesafesi = 1.0;
            return a;
        }
    }
}
