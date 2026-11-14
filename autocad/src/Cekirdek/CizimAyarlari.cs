using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Metraj ve hacim kuralları (telefondaki hatMetraji / kanalHacmi ile aynı).</summary>
    public static class Metraj
    {
        /// <summary>Hat metrajının yuvarlanması (Çizim Ayarları › Metraj): yok (cm, 2 hane; 13.11.2026'dan beri varsayılan —
        /// kullanıcı: "45,00 yazmış 45,25 yazması lazım"), yukarı tam metreye (eski program gibi), en yakın tam metreye.</summary>
        public const string YuvarlamaYok = "yok", YuvarlamaYukari = "yukari", YuvarlamaYakin = "yakin";
        public static readonly string[] Yuvarlamalar = { YuvarlamaYok, YuvarlamaYukari, YuvarlamaYakin };
        public static string YuvarlamaDuzelt(string y) => y == YuvarlamaYukari || y == YuvarlamaYakin ? y : YuvarlamaYok;

        /// <summary>Hat metrajı: çizim uzunluğu ayardaki gibi yuvarlanır (yok: 2 hane), türüne göre ek pay eklenir.</summary>
        public static double Hat(double cizim, string yuvarlama, double ekPay)
        {
            double L = Math.Max(0, double.IsNaN(cizim) ? 0 : cizim);
            string y = YuvarlamaDuzelt(yuvarlama);
            double m = y == YuvarlamaYukari ? Math.Ceiling(L - 1e-6)
                : y == YuvarlamaYakin ? Math.Round(L, MidpointRounding.AwayFromZero)
                : Math.Round(L + 1e-9, 2, MidpointRounding.AwayFromZero);
            return SayiCoz.Temiz(m + ekPay);
        }

        /// <summary>Eski imza (true: yukarı, false: en yakın tam metre).</summary>
        public static double Hat(double cizim, bool yukariYuvarla, double ekPay) => Hat(cizim, yukariYuvarla ? YuvarlamaYukari : YuvarlamaYakin, ekPay);

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
        /// <summary>Hat etiketi (kablo tipi) yazısının yüksekliği (m); telefonun DXF'iyle aynı: 1.8.</summary>
        public double EtiketYuksekligi = 1.8;
        /// <summary>
        /// Boyutlar (31.10.2026; Çizim Ayarları › Görünüm, telefon dosyasında da taşınır): uygulamanın simgelerinin
        /// büyüklüğü (çarpan; 1 = telefonla aynı, 1/1000 pafta), metraj yazısı ve eleman yazısının (GIS no, tip)
        /// yüksekliği (m). Yeni çizilenlere hemen, var olanlara Telefon Görünümü ile uygulanır.
        /// </summary>
        public double SimgeOlcegi = 1, MetrajYuksekligi = 1.44, ElemanYaziYuksekligi = 1.8;
        /// <summary>Hat kalınlığının çarpanı (Boyutlar.HatKalinligi; 0 = ince çizgi) ve malzemelerin çizimde yazılması.</summary>
        public double HatKalinligi = Boyutlar.VarsayilanKalinlik;
        public bool MalzemeYazisi = Boyutlar.VarsayilanMalzemeYazisi;
        /// <summary>Simge takımı: "" klasik, "SM" Şebeke-M (Boyutlar.SimgeTakimi).</summary>
        public string SimgeTakimi = Boyutlar.VarsayilanTakim;

        /// <summary>Boyutların varsayılanları (ortak çizim stili).</summary>
        public static double VarsayilanEtiket => CizimStili.Yuklu ? CizimStili.YaziYuksekligi : 1.8;
        public static double VarsayilanMetraj => CizimStili.Yuklu ? CizimStili.ParcaMetraji : 1.44;

        /// <summary>Boyutlar varsayılandan farklı mı (telefon dosyasına yalnız farklıysa yazılır).</summary>
        public bool BoyutlarDegisik => !BoyutlariVer().Varsayilan;
        public double YakalamaMesafesi = 1.0;
        /// <summary>Hat metrajının yuvarlanması: Metraj.YuvarlamaYok (varsayılan) / YuvarlamaYukari / YuvarlamaYakin.</summary>
        public string MetrajYuvarlama = Metraj.YuvarlamaYok;
        public readonly Dictionary<string, double> EkPay = new Dictionary<string, double>(StringComparer.Ordinal);
        public double KanalAlt = 40, KanalUst = 40, KanalDerinlik = 100;
        public string KanalZemin = "TOPRAK";
        /// <summary>Tarife karakteristiği (2 hane, ör. 01); boş: katalogdaki standart karakteristik (AutoCAD KRTNALINACAK).</summary>
        public string Karakteristik = "";
        /// <summary>Unsur sütunu: false şehir (yatırım), true köy / bakım (AutoCAD SMIKMU 1/2).</summary>
        public bool Koy;
        /// <summary>Teknik hesaplar için proje bilgisi: proje adı ve kodu (boş: çizim adı), hesabı yapan, unvanı, firma.</summary>
        public string ProjeAdi = "", ProjeKodu = "", Hazirlayan = "", Unvan = "", Firma = "";
        /// <summary>Buz yükü bölgesi "1".."5" (ENH mekanik hesapları); boş: bilinmiyor, hesap sayfası sorar.</summary>
        public string BuzBolgesi = "";

        /// <summary>Son seçimler (tür, tip, kesit, durum...): bir sonraki komutta hazır gelir.</summary>
        public readonly Dictionary<string, string> Son = new Dictionary<string, string>(StringComparer.Ordinal);

        /// <summary>Boyutlar makul aralıkta (simge 0,1–20 kat; yazılar 0,05–50 m); bozuk değer varsayılana döner.</summary>
        public void BoyutlariDuzelt() => BoyutlariKoy(BoyutlariVer());

        /// <summary>Boyutlar (proje dosyasına yazılan biçim).</summary>
        public Boyutlar BoyutlariVer() => new Boyutlar
        {
            SimgeOlcegi = SimgeOlcegi, EtiketYuksekligi = EtiketYuksekligi, MetrajYuksekligi = MetrajYuksekligi,
            ElemanYaziYuksekligi = ElemanYaziYuksekligi, HatKalinligi = HatKalinligi, MalzemeYazisi = MalzemeYazisi, SimgeTakimi = SimgeTakimi,
        }.Duzelt();

        public void BoyutlariKoy(Boyutlar b)
        {
            if (b == null) return;
            b = b.Kopya().Duzelt();
            SimgeOlcegi = b.SimgeOlcegi;
            EtiketYuksekligi = b.EtiketYuksekligi;
            MetrajYuksekligi = b.MetrajYuksekligi;
            ElemanYaziYuksekligi = b.ElemanYaziYuksekligi;
            HatKalinligi = b.HatKalinligi;
            MalzemeYazisi = b.MalzemeYazisi;
            SimgeTakimi = b.SimgeTakimi;
        }

        public double EkPayi(string hatTuru)
        {
            double d;
            return EkPay.TryGetValue(hatTuru ?? "", out d) ? d : 0;
        }

        public double HatMetraji(double cizim, string hatTuru) => Metraj.Hat(cizim, MetrajYuvarlama, EkPayi(hatTuru));

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
                new KeyValuePair<string, string>("surum", "3"),
                new KeyValuePair<string, string>("katmanOnEki", KatmanOnEki ?? ""),
                new KeyValuePair<string, string>("gisOnEki", GisOnEki ?? ""),
                new KeyValuePair<string, string>("aktifHakedis", AktifHakedis.ToString(CultureInfo.InvariantCulture)),
                new KeyValuePair<string, string>("dom", Dom.ToString(CultureInfo.InvariantCulture)),
                new KeyValuePair<string, string>("sembolOlcegi", S(SembolOlcegi)),
                new KeyValuePair<string, string>("etiketYuksekligi", S(EtiketYuksekligi)),
                new KeyValuePair<string, string>("simgeOlcegi", S(SimgeOlcegi)),
                new KeyValuePair<string, string>("metrajYuksekligi", S(MetrajYuksekligi)),
                new KeyValuePair<string, string>("elemanYaziYuksekligi", S(ElemanYaziYuksekligi)),
                new KeyValuePair<string, string>("hatKalinligi", S(HatKalinligi)),
                new KeyValuePair<string, string>("malzemeYazisi", MalzemeYazisi ? "1" : "0"),
                new KeyValuePair<string, string>("simgeTakimi", Boyutlar.TakimDuzelt(SimgeTakimi)),
                new KeyValuePair<string, string>("yakalamaMesafesi", S(YakalamaMesafesi)),
                new KeyValuePair<string, string>("metrajYuvarlama", Metraj.YuvarlamaDuzelt(MetrajYuvarlama)),
                new KeyValuePair<string, string>("kanalAlt", S(KanalAlt)),
                new KeyValuePair<string, string>("kanalUst", S(KanalUst)),
                new KeyValuePair<string, string>("kanalDerinlik", S(KanalDerinlik)),
                new KeyValuePair<string, string>("kanalZemin", KanalZemin ?? ""),
                new KeyValuePair<string, string>("karakteristik", Karakteristik ?? ""),
                new KeyValuePair<string, string>("koy", Koy ? "1" : "0"),
                new KeyValuePair<string, string>("projeAdi", ProjeAdi ?? ""),
                new KeyValuePair<string, string>("projeKodu", ProjeKodu ?? ""),
                new KeyValuePair<string, string>("hazirlayan", Hazirlayan ?? ""),
                new KeyValuePair<string, string>("unvan", Unvan ?? ""),
                new KeyValuePair<string, string>("firma", Firma ?? ""),
                new KeyValuePair<string, string>("buzBolgesi", BuzBolgesi ?? ""),
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
            bool yuvarlamaOkundu = false;
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
                    case "simgeOlcegi": a.SimgeOlcegi = SayiCoz.Coz(v, 1); break;
                    case "metrajYuksekligi": a.MetrajYuksekligi = SayiCoz.Coz(v, 1.44); break;
                    case "elemanYaziYuksekligi": a.ElemanYaziYuksekligi = SayiCoz.Coz(v, 1.8); break;
                    case "hatKalinligi": a.HatKalinligi = SayiCoz.Coz(v, Boyutlar.VarsayilanKalinlik); break;
                    case "malzemeYazisi": a.MalzemeYazisi = v == "1"; break;
                    case "simgeTakimi": a.SimgeTakimi = Boyutlar.TakimDuzelt(v); break;
                    case "yakalamaMesafesi": a.YakalamaMesafesi = SayiCoz.Coz(v, 1.0); break;
                    // Eski ayar (13.11.2026 öncesi, "yukarı yuvarla" evet / hayır): ikisi de artık yuvarlama yok (2 hane) olur —
                    // eski programda küsurat seçeneği yoktu; kullanıcı 14.11.2026: içe aktarınca hat değerleri tam sayıya
                    // yuvarlanıyordu. Yeni anahtar (metrajYuvarlama) varsa o geçerlidir.
                    case "yukariYuvarla": break;
                    case "metrajYuvarlama": a.MetrajYuvarlama = Metraj.YuvarlamaDuzelt(v); yuvarlamaOkundu = true; break;
                    case "kanalAlt": a.KanalAlt = SayiCoz.Coz(v, 40); break;
                    case "kanalUst": a.KanalUst = SayiCoz.Coz(v, 40); break;
                    case "kanalDerinlik": a.KanalDerinlik = SayiCoz.Coz(v, 100); break;
                    case "kanalZemin": a.KanalZemin = string.IsNullOrEmpty(v) ? "TOPRAK" : v; break;
                    case "karakteristik": a.Karakteristik = v.Trim(); break;
                    case "koy": a.Koy = v == "1"; break;
                    case "projeAdi": a.ProjeAdi = v.Trim(); break;
                    case "projeKodu": a.ProjeKodu = v.Trim(); break;
                    case "hazirlayan": a.Hazirlayan = v.Trim(); break;
                    case "unvan": a.Unvan = v.Trim(); break;
                    case "firma": a.Firma = v.Trim(); break;
                    case "buzBolgesi": a.BuzBolgesi = v.Trim(); break;
                }
            }
            // Sürüm 1 ayarlarında varsayılan 0,5 m idi (AutoCAD görünümü); telefon stiliyle 1,8 m
            if (a.EtiketYuksekligi <= 0 || (surum < 2 && Math.Abs(a.EtiketYuksekligi - 0.5) < 1e-9)) a.EtiketYuksekligi = 1.8;
            // Sürüm 3 (14.11.2026): 13.11.2026 sürümü eski "yukarı yuvarla: hayır" ayarını "en yakın tam metre"ye çevirip
            // kaydediyordu; o çevrilmiş kayıt yuvarlama yok (2 hane) olur. Sürüm 3'te kaydedilen seçim olduğu gibi kalır.
            if (surum < 3 && a.MetrajYuvarlama == Metraj.YuvarlamaYakin) a.MetrajYuvarlama = Metraj.YuvarlamaYok;
            if (a.YakalamaMesafesi < 0) a.YakalamaMesafesi = 1.0;
            a.BoyutlariDuzelt();
            return a;
        }
    }
}
