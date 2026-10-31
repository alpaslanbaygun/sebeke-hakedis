using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>CBS dosyasındaki bir sütun (öznitelik).</summary>
    public sealed class CbsAlani
    {
        /// <summary>Sütun adı: büyük harf, Türkçe karaktersiz (MID sütunu, KML Data adı). Ör. GIS_NO</summary>
        public readonly string Ad;
        /// <summary>Okunur ad (KML'de görünen). Ör. "GIS no"</summary>
        public readonly string Baslik;
        /// <summary>'C' metin, 'I' tam sayı, 'F' ondalık sayı.</summary>
        public readonly char Tur;
        /// <summary>Metin sütununun en çok uzunluğu (MIF Char(n)).</summary>
        public readonly int Uzunluk;

        public CbsAlani(string ad, string baslik, char tur = 'C', int uzunluk = 40)
        {
            Ad = ad; Baslik = baslik; Tur = tur; Uzunluk = uzunluk;
        }
    }

    /// <summary>CBS katmanı: bir nesne türünün sütunları ve geometrisi.</summary>
    public sealed class CbsKatmani
    {
        /// <summary>Dosya ve klasör adı: BOLGE, DIREK, TRAFO, SDK, PANO, ELEMAN, HAT, KANAL, SONDAJ, NOKTA, MALZEME</summary>
        public readonly string Ad;
        public readonly string Baslik;
        /// <summary>"nokta", "cizgi", "alan", "yok" (haritada yeri olmayan tablo: MALZEME)</summary>
        public readonly string Geometri;
        public readonly CbsAlani[] Alanlar;

        public CbsKatmani(string ad, string baslik, string geometri, params CbsAlani[] alanlar)
        {
            Ad = ad; Baslik = baslik; Geometri = geometri; Alanlar = alanlar;
        }

        public int Sira(string alan) => Array.FindIndex(Alanlar, a => string.Equals(a.Ad, alan, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>CBS'ye giden bir nesne: katmanı, değerleri (Alanlar sırasıyla) ve geometrisi (çizim koordinatı).</summary>
    public sealed class CbsNesnesi
    {
        public CbsKatmani Katman;
        public object[] Degerler;
        /// <summary>Nokta: tek köşe; çizgi: köşeler; alan: kapalı sınır (ilk köşe sonda tekrarlanmaz).</summary>
        public List<double[]> Kose = new List<double[]>();
        /// <summary>Proje (bölge) adı; bölgesi olmayanlarda "".</summary>
        public string Proje = "";
        /// <summary>Görünen ad (KML Placemark adı).</summary>
        public string Ad = "";
        /// <summary>Ekran rengi (#rrggbb; telefondaki koyu ekranla aynı): KML çizgi ve simge rengi.</summary>
        public string Renk = "";
        public string Durum = "";

        public object Deger(string alan)
        {
            int i = Katman.Sira(alan);
            return i >= 0 && i < Degerler.Length ? Degerler[i] : null;
        }
    }

    /// <summary>
    /// CBS dışa aktarımlarının ortak yapısı: KML öznitelikleri ve MIF/MID sütunları aynı adlarla yazılır. Katmanlar şebeke
    /// elemanı bazında (31.10.2026): BOLGE (alan: proje sınırı), DIREK, TRAFO, SDK, PANO, ELEMAN (diğer elemanlar: mufu,
    /// kofre…; eski dosyalarda bütün elemanlar) — hepsi nokta, aynı sütunlarla —, HAT (iletken / kablo; iletkenleri, adetleri,
    /// baş ve bit elemanıyla), KANAL, SONDAJ (çizgi), NOKTA (GPS noktası) ve MALZEME (haritada yeri olmayan tablo: her
    /// nesnenin bütün malzeme satırları, NESNE sütunu nesnenin kimliği). MIF içe aktarımı (CbsIceAktarim) da bu adları tanır:
    /// Şebeke-M'in yazdığı dosya geri okunduğunda nesneler türüyle, tipiyle, durumuyla ve malzemeleriyle gelir.
    /// Telefondaki karşılığı telefon/web/src/export/cbs.js (KML ve MIF / MID de); iki tarafın çıktısı ortak denemeyle
    /// (ortak/deneme/cbs, CekirdekTest › CbsOrtakDeneme) birebir karşılaştırılır.
    /// </summary>
    public static class CbsYapisi
    {
        private static CbsAlani K(string ad, string baslik, int n = 40) => new CbsAlani(ad, baslik, 'C', n);
        private static CbsAlani T(string ad, string baslik) => new CbsAlani(ad, baslik, 'I', 0);
        private static CbsAlani O(string ad, string baslik) => new CbsAlani(ad, baslik, 'F', 0);

        /// <summary>Cins kodunun okunur adı (katalogdan; eklenti ve deneme katalog yüklenince verir). null: CINS_ADI boş.</summary>
        public static Func<string, string> CinsAdlari;

        /// <summary>Eleman katmanlarının (DIREK, TRAFO, SDK, PANO, ELEMAN) ortak sütunları.</summary>
        private static CbsAlani[] ElemanAlanlari() => new[]
        {
            K("KIMLIK", "Kimlik", 20), K("GIS_NO", "GIS no", 20), K("TUR", "Tür kodu", 20), K("TUR_ADI", "Tür", 40), K("CINS", "Cins kodu", 40),
            K("CINS_ADI", "Cins", 80), K("TIP", "Tip", 80), K("DURUM", "Durum", 10), K("DM_DURUM", "Demontaj", 10), T("HAKEDIS", "Hakediş"),
            K("GUC", "Güç", 20), K("GERILIM", "Gerilim", 20), K("KONTROL", "Kontrol", 10), K("PROJE", "Proje", 120), K("PROJE_KODU", "Proje kodu", 40),
            K("MALZEME", "Malzemeler", 254), T("MALZEME_SAYISI", "Malzeme satırı"), O("SAGA", "Sağa (Y)"), O("YUKARI", "Yukarı (X)"), O("KOT", "Kot"),
            O("ACI", "Açı (derece)"), K("TELEFON_ID", "Telefon kimliği", 40),
        };

        public static readonly CbsKatmani Direk = new CbsKatmani("DIREK", "Direkler", "nokta", ElemanAlanlari());
        public static readonly CbsKatmani Trafo = new CbsKatmani("TRAFO", "Trafolar", "nokta", ElemanAlanlari());
        public static readonly CbsKatmani Sdk = new CbsKatmani("SDK", "Saha dağıtım kutuları (SDK)", "nokta", ElemanAlanlari());
        public static readonly CbsKatmani Pano = new CbsKatmani("PANO", "Panolar", "nokta", ElemanAlanlari());
        /// <summary>Diğer elemanlar (mufu, kofre, diğer); eski (31.10.2026 öncesi) dosyalarda bütün elemanlar bu katmandaydı.</summary>
        public static readonly CbsKatmani Eleman = new CbsKatmani("ELEMAN", "Diğer elemanlar", "nokta", ElemanAlanlari());

        public static readonly CbsKatmani Hat = new CbsKatmani("HAT", "Hatlar (iletken / kablo)", "cizgi",
            K("KIMLIK", "Kimlik", 20), K("TUR", "Tür kodu", 20), K("TUR_ADI", "Tür", 40), K("KESIT", "Kesit", 80),
            K("ILETKEN_CINS", "İletken cinsi", 40), K("ILETKEN", "İletken", 80), T("ILETKEN_ADET", "İletken adedi"),
            K("ILETKEN2_CINS", "2. iletken cinsi", 40), K("ILETKEN2", "2. iletken", 80), T("ILETKEN2_ADET", "2. iletken adedi"),
            K("ETIKET", "Etiket", 80), K("DURUM", "Durum", 10), T("HAKEDIS", "Hakediş"), K("KONTROL", "Kontrol", 10),
            K("BAS_NO", "Baş eleman", 20), K("BIT_NO", "Bit eleman", 20), K("PROJE", "Proje", 120), K("PROJE_KODU", "Proje kodu", 40),
            O("UZUNLUK", "Çizim uzunluğu (m)"), O("METRAJ", "Metraj (m)"), T("MALZEME_SAYISI", "Malzeme satırı"), K("TELEFON_ID", "Telefon kimliği", 40));

        public static readonly CbsKatmani Kanal = new CbsKatmani("KANAL", "Kanallar", "cizgi",
            K("KIMLIK", "Kimlik", 20), K("KABLOLAR", "Kablolar", 20), K("ZEMIN", "Zemin", 40), O("ALT_CM", "Alt genişlik (cm)"),
            O("UST_CM", "Üst genişlik (cm)"), O("DERIN_CM", "Derinlik (cm)"), K("BAS_NO", "Baş no", 20), K("BIT_NO", "Bit no", 20),
            K("DURUM", "Durum", 10), T("HAKEDIS", "Hakediş"), K("PROJE", "Proje", 120), K("PROJE_KODU", "Proje kodu", 40),
            O("UZUNLUK", "Çizim uzunluğu (m)"), O("METRAJ", "Metraj (m)"));

        public static readonly CbsKatmani Sondaj = new CbsKatmani("SONDAJ", "Sondajlar", "cizgi",
            K("KIMLIK", "Kimlik", 20), K("TIP", "Tip", 80), K("BAS_NO", "Baş no", 20), K("BIT_NO", "Bit no", 20), K("DURUM", "Durum", 10),
            T("HAKEDIS", "Hakediş"), K("PROJE", "Proje", 120), K("PROJE_KODU", "Proje kodu", 40), O("UZUNLUK", "Çizim uzunluğu (m)"),
            O("METRAJ", "Metraj (m)"));

        public static readonly CbsKatmani Bolge = new CbsKatmani("BOLGE", "Proje sınırları", "alan",
            K("KIMLIK", "Kimlik", 20), K("PROJE", "Proje", 120), K("PROJE_KODU", "Proje kodu", 40), K("GRUP", "Grup kodu", 40),
            K("ACIKLAMA", "Açıklama", 120), O("ALAN", "Alan (m²)"));

        public static readonly CbsKatmani Nokta = new CbsKatmani("NOKTA", "GPS noktaları", "nokta",
            K("KIMLIK", "Kimlik", 20), K("AD", "Ad", 30), K("KOD", "Kod", 30), O("KOT", "Kot"), T("HAKEDIS", "Hakediş"),
            K("PROJE", "Proje", 120), K("EK", "Ek bilgi", 120));

        /// <summary>Malzeme satırları: haritada yeri yok (MIF'te "None"), her satır NESNE sütunundaki kimlikle nesnesine bağlı.</summary>
        public static readonly CbsKatmani Malzeme = new CbsKatmani("MALZEME", "Malzemeler", "yok",
            K("NESNE", "Nesne kimliği", 20), K("KATMAN", "Nesnenin katmanı", 10), K("GIS_NO", "GIS no", 20), K("SIRA", "Sıra no", 20),
            K("CINS", "Cins kodu", 40), K("TANIM", "Tanım", 120), K("ACIKLAMA", "Tam yazım", 120), K("DURUM", "Durum", 10),
            K("DM_DURUM", "Demontaj", 10), O("MIKTAR", "Miktar"), K("BIRIM", "Birim", 20), O("KATSAYI", "Katsayı"), O("TOPLAM", "Toplam"),
            T("HAKEDIS", "Hakediş"), K("TARIFE", "Tarife", 10), K("KAYNAK", "Kaynak", 10), K("ANA", "Ana kalem", 5), K("KONTROL", "Kontrol", 10));

        public static readonly CbsKatmani[] Katmanlar = { Bolge, Direk, Trafo, Sdk, Pano, Eleman, Hat, Kanal, Sondaj, Nokta, Malzeme };

        /// <summary>Haritada yeri olan eleman katmanları (KML klasör sırası).</summary>
        public static readonly CbsKatmani[] ElemanKatmanlari = { Direk, Trafo, Sdk, Pano, Eleman };

        /// <summary>Eleman türünün katmanı: direkler DIREK, trafo direği ve merkezi TRAFO, box SDK, pano PANO, ötekiler ELEMAN.</summary>
        public static CbsKatmani ElemanKatmani(string tur)
        {
            switch (tur ?? "")
            {
                case "AG_DIREK": case "MUSTEREK_DIREK": case "AYD_DIREK": case "ENH_DIREK": return Direk;
                case "TRAFO_DIREGI": case "TRAFO_MERKEZI": return Trafo;
                case "BOX": return Sdk;
                case "PANO": return Pano;
                default: return Eleman;
            }
        }

        /// <summary>Kontrol işareti: EVET, HAYIR, boş (belirtilmemiş).</summary>
        public static string KontrolYazisi(bool? k) => k == true ? "EVET" : k == false ? "HAYIR" : "";

        /// <summary>Hattın ucundaki elemanın GIS numarası (0,5 m içindeki en yakın eleman); yoksa "".</summary>
        public static string UctakiEleman(IList<Eleman> elemanlar, double[] uc)
        {
            Eleman en = null;
            double enKisa = 0.5;
            foreach (var e in elemanlar)
            {
                double d = Math.Sqrt((e.Saga - uc[0]) * (e.Saga - uc[0]) + (e.Yukari - uc[1]) * (e.Yukari - uc[1]));
                if (d <= enKisa + 1e-9 && (en == null || d < enKisa)) { en = e; enKisa = d; }
            }
            return en != null ? en.GisId ?? "" : "";
        }

        /// <summary>Projenin bütün nesneleri CBS katmanlarına (çizim koordinatıyla); malzeme satırları en sonda.</summary>
        public static List<CbsNesnesi> Nesneler(Proje p)
        {
            var l = new List<CbsNesnesi>();
            var malzemeler = new List<CbsNesnesi>();
            Func<string, Bolge> bolge = id => p.BolgeBul(id);
            Func<string, string> ad = id => { var b = bolge(id); return b != null ? b.Ad ?? "" : ""; };
            Func<string, string> kod = id => { var b = bolge(id); return b != null ? b.Kod ?? "" : ""; };
            Func<string, string> cinsAdi = c => string.IsNullOrEmpty(c) || CinsAdlari == null ? "" : CinsAdlari(c) ?? "";
            Action<string, string, string, string, List<Kalem>> malzemeEkle = (kimlik, katman, gisNo, proje, kalemler) =>
            {
                foreach (var k in kalemler)
                {
                    var n = new CbsNesnesi { Katman = Malzeme, Proje = proje, Ad = (k.Tanim ?? "").Trim(), Durum = k.Durum };
                    n.Degerler = new object[]
                    {
                        kimlik, katman, gisNo, k.Sira, k.Cins, (k.Tanim ?? "").Trim(), k.Aciklama, k.Durum, k.DmDurum, SayiCoz.Temiz(k.Miktar, 6), k.Birim,
                        SayiCoz.Temiz(k.Katsayi, 6), SayiCoz.Temiz(k.Toplam, 6), k.Hakedis, k.Tarife, k.Kaynak, k.Ana ? "EVET" : "", KontrolYazisi(k.Kontrol),
                    };
                    malzemeler.Add(n);
                }
            };

            foreach (var b in p.Bolgeler)
            {
                if (b.Sinir.Count < 3) continue;
                var n = new CbsNesnesi { Katman = Bolge, Proje = b.Ad ?? "", Ad = b.Ad ?? "", Renk = CizimStili.Yuklu ? CizimStili.EkranRengi("bolge", "#fde047") : "#fde047" };
                n.Degerler = new object[] { b.Id, b.Ad, b.Kod, b.Grup, b.Aciklama, Yuvarla(b.Alan, 2) };
                foreach (var k in b.Sinir) n.Kose.Add(new[] { k[0], k[1] });
                if (n.Kose.Count > 3 && Ayni(n.Kose[0], n.Kose[n.Kose.Count - 1])) n.Kose.RemoveAt(n.Kose.Count - 1);
                l.Add(n);
            }
            foreach (var e in p.Elemanlar)
            {
                var ana = e.Kalemler.Find(k => k.Ana);
                var katman = ElemanKatmani(e.Tur);
                string cins = ana != null ? ana.Cins : e.Cins;
                var n = new CbsNesnesi
                {
                    Katman = katman, Proje = ad(e.Bolge), Durum = e.Durum,
                    Ad = string.IsNullOrEmpty(e.GisId) ? Turler.ElemanAdi(e.Tur) : e.GisId,
                    Renk = CizimStili.Yuklu ? CizimStili.EkranElemanRengi(e.Tur, e.Cins, e.Durum == "MEVCUT") : "#cbd5e1",
                };
                n.Degerler = new object[]
                {
                    e.Id, e.GisId, e.Tur, Turler.ElemanAdi(e.Tur), cins, cinsAdi(cins), (ana != null ? ana.Tanim : e.Tip ?? "").Trim(),
                    e.Durum, e.DmDurum, e.Hakedis, e.Guc, e.Gerilim, KontrolYazisi(e.Kontrol), ad(e.Bolge), kod(e.Bolge), Malzemeler(e.Kalemler),
                    e.Kalemler.Count, Yuvarla(e.Saga, 3), Yuvarla(e.Yukari, 3), Yuvarla(e.Kot, 3), Yuvarla(e.Aci * 180 / Math.PI, 4), e.TelefonId,
                };
                n.Kose.Add(new[] { e.Saga, e.Yukari });
                l.Add(n);
                malzemeEkle(e.Id, katman.Ad, e.GisId, n.Proje, e.Kalemler);
            }
            foreach (var h in p.Hatlar)
            {
                if (h.Kose.Count < 2) continue;
                var hk = Iletkenler.HatKalemleri(h);
                double metraj = 0;
                foreach (var k in hk) metraj = Math.Max(metraj, k.Miktar);
                Kalem i1 = hk.Count > 0 ? hk[0] : null, i2 = hk.Count > 1 ? hk[1] : null;
                var n = new CbsNesnesi
                {
                    Katman = Hat, Proje = ad(h.Bolge), Durum = h.Durum,
                    Ad = string.IsNullOrEmpty(h.Etiket) ? (string.IsNullOrEmpty(h.AnaKesit) ? Turler.HatAdi(h.Tur) : h.AnaKesit) : h.Etiket,
                    Renk = CizimStili.Yuklu ? CizimStili.EkranHatRengi(h.Tur) : "#7ee08a",
                };
                n.Degerler = new object[]
                {
                    h.Id, h.Tur, Turler.HatAdi(h.Tur), h.AnaKesit,
                    i1 != null ? i1.Cins : "", i1 != null ? (i1.Tanim ?? "").Trim() : "", i1 != null ? Iletkenler.Adet(i1) : 0,
                    i2 != null ? i2.Cins : "", i2 != null ? (i2.Tanim ?? "").Trim() : "", i2 != null ? Iletkenler.Adet(i2) : 0,
                    h.Etiket, h.Durum, h.Hakedis, KontrolYazisi(h.Kontrol ?? (i1 != null ? i1.Kontrol : null)),
                    UctakiEleman(p.Elemanlar, h.Kose[0]), UctakiEleman(p.Elemanlar, h.Kose[h.Kose.Count - 1]), ad(h.Bolge), kod(h.Bolge),
                    Yuvarla(h.CizimUzunlugu, 2), Yuvarla(metraj > 0 ? metraj : h.CizimUzunlugu, 2), h.Kalemler.Count, h.TelefonId,
                };
                foreach (var k in h.Kose) n.Kose.Add(new[] { k[0], k[1] });
                l.Add(n);
                malzemeEkle(h.Id, Hat.Ad, "", n.Proje, h.Kalemler);
            }
            foreach (var c in p.Kanallar)
            {
                if (c.Kose.Count < 2) continue;
                var ana = c.Kalemler.Find(k => k.Ana);
                var n = new CbsNesnesi
                {
                    Katman = Kanal, Proje = ad(c.Bolge), Durum = c.Durum, Ad = "Kanal " + c.Kablolar.Trim('/') + " · " + c.Zemin,
                    Renk = CizimStili.Yuklu ? CizimStili.EkranKatmanRengi("KANAL", "#9ca3af") : "#9ca3af",
                };
                n.Degerler = new object[]
                {
                    c.Id, c.Kablolar.Trim('/'), c.Zemin, c.AltGenislik, c.UstGenislik, c.Derinlik, c.BasNo, c.BitNo, c.Durum, c.Hakedis,
                    ad(c.Bolge), kod(c.Bolge), Yuvarla(c.CizimUzunlugu, 2), Yuvarla(ana != null && ana.Miktar > 0 ? ana.Miktar : c.CizimUzunlugu, 2),
                };
                foreach (var k in c.Kose) n.Kose.Add(new[] { k[0], k[1] });
                l.Add(n);
                malzemeEkle(c.Id, Kanal.Ad, "", n.Proje, c.Kalemler);
            }
            foreach (var s in p.Sondajlar)
            {
                if (s.Kose.Count < 2) continue;
                var ana = s.Kalemler.Find(k => k.Ana);
                var n = new CbsNesnesi
                {
                    Katman = Sondaj, Proje = ad(s.Bolge), Durum = s.Durum, Ad = "Sondaj " + (s.Tip ?? "").Trim(),
                    Renk = CizimStili.Yuklu ? CizimStili.EkranKatmanRengi("SONDAJ", "#fbbf24") : "#fbbf24",
                };
                n.Degerler = new object[]
                {
                    s.Id, (s.Tip ?? "").Trim(), s.BasNo, s.BitNo, s.Durum, s.Hakedis, ad(s.Bolge), kod(s.Bolge), Yuvarla(s.CizimUzunlugu, 2),
                    Yuvarla(ana != null && ana.Miktar > 0 ? ana.Miktar : s.CizimUzunlugu, 2),
                };
                foreach (var k in s.Kose) n.Kose.Add(new[] { k[0], k[1] });
                l.Add(n);
                malzemeEkle(s.Id, Sondaj.Ad, "", n.Proje, s.Kalemler);
            }
            foreach (var t in p.Noktalar)
            {
                var n = new CbsNesnesi { Katman = Nokta, Proje = ad(t.Bolge), Ad = t.Ad, Renk = CizimStili.Yuklu ? CizimStili.EkranRengi("nokta", "#e2e8f0") : "#e2e8f0" };
                n.Degerler = new object[] { t.Id, t.Ad, t.Kod, Yuvarla(t.Kot, 3), t.Hakedis, ad(t.Bolge), string.Join(" ", t.EkMetinler.ToArray()) };
                n.Kose.Add(new[] { t.Saga, t.Yukari });
                l.Add(n);
            }
            l.AddRange(malzemeler);
            return l;
        }

        /// <summary>Elemanın ana malzemesi dışındaki malzemeleri: "G-L-50 × 9,8 mt; ..." (254 karakterle sınırlı).</summary>
        public static string Malzemeler(List<Kalem> kalemler)
        {
            var sb = new StringBuilder();
            foreach (var k in kalemler)
            {
                if (k.Ana) continue;
                string[] b = (k.Birim ?? "").Split('/');
                string parca = (k.Tanim ?? "").Trim() + " × " + (SayiCoz.Temiz(k.Miktar, 3) + 0.0).ToString("0.###", Tr) + (b.Length > 0 && b[0].Length > 0 ? " " + b[0] : "");
                if (sb.Length > 0) sb.Append("; ");
                sb.Append(parca);
            }
            return sb.Length > 254 ? sb.ToString(0, 253) + "…" : sb.ToString();
        }

        /// <summary>Değerin yazımı (KML ve MID): sayılar noktalı ondalık, metin olduğu gibi.</summary>
        public static string Yazi(object d)
        {
            if (d == null) return "";
            if (d is double x) return (x + 0.0).ToString("0.########", CultureInfo.InvariantCulture); // + 0.0: eksi sıfır "0" yazılsın (.NET 8 "-0" yazar)
            if (d is int i) return i.ToString(CultureInfo.InvariantCulture);
            return Convert.ToString(d, CultureInfo.InvariantCulture) ?? "";
        }

        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
        /// <summary>
        /// Math.Round; eksi sıfır artı sıfıra çevrilir (+ 0.0): .NET 8 "-0", .NET Framework "0" yazar; iki eklenti derlemesi
        /// ve telefon (telefon/web/src/export/cbs.js) aynı yazsın.
        /// </summary>
        private static double Yuvarla(double d, int hane) => Math.Round(d, hane) + 0.0;
        private static bool Ayni(double[] a, double[] b) => Math.Abs(a[0] - b[0]) < 1e-6 && Math.Abs(a[1] - b[1]) < 1e-6;
    }
}
