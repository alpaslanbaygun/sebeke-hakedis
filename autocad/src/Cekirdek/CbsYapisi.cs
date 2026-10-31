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
        /// <summary>Dosya ve klasör adı: ELEMAN, HAT, KANAL, SONDAJ, BOLGE, NOKTA</summary>
        public readonly string Ad;
        public readonly string Baslik;
        /// <summary>"nokta", "cizgi", "alan"</summary>
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
    /// CBS dışa aktarımlarının ortak yapısı: KML öznitelikleri ve MIF/MID sütunları aynı adlarla yazılır. Katmanlar:
    /// ELEMAN (nokta), HAT, KANAL, SONDAJ (çizgi), BOLGE (alan: proje sınırı), NOKTA (GPS noktası). MIF içe aktarımı da bu
    /// adları tanır: Şebeke-M'in yazdığı dosya geri okunduğunda nesneler türüyle, tipiyle, durumuyla gelir.
    /// Telefondaki karşılığı telefon/web/src/export/cbs.js (KML ve MIF / MID de); iki tarafın çıktısı ortak denemeyle
    /// (ortak/deneme/cbs, CekirdekTest › CbsOrtakDeneme) birebir karşılaştırılır.
    /// </summary>
    public static class CbsYapisi
    {
        private static CbsAlani K(string ad, string baslik, int n = 40) => new CbsAlani(ad, baslik, 'C', n);
        private static CbsAlani T(string ad, string baslik) => new CbsAlani(ad, baslik, 'I', 0);
        private static CbsAlani O(string ad, string baslik) => new CbsAlani(ad, baslik, 'F', 0);

        public static readonly CbsKatmani Eleman = new CbsKatmani("ELEMAN", "Elemanlar", "nokta",
            K("KIMLIK", "Kimlik", 20), K("GIS_NO", "GIS no", 20), K("TUR", "Tür kodu", 20), K("TUR_ADI", "Tür", 40), K("CINS", "Cins", 40),
            K("TIP", "Tip", 80), K("DURUM", "Durum", 10), K("DM_DURUM", "Demontaj", 10), T("HAKEDIS", "Hakediş"), K("PROJE", "Proje", 120),
            K("PROJE_KODU", "Proje kodu", 40), K("MALZEME", "Malzemeler", 254), O("SAGA", "Sağa (Y)"), O("YUKARI", "Yukarı (X)"),
            O("KOT", "Kot"), O("ACI", "Açı (derece)"));

        public static readonly CbsKatmani Hat = new CbsKatmani("HAT", "Hatlar", "cizgi",
            K("KIMLIK", "Kimlik", 20), K("TUR", "Tür kodu", 20), K("TUR_ADI", "Tür", 40), K("KESIT", "Kesit", 80), K("ETIKET", "Etiket", 80),
            K("DURUM", "Durum", 10), T("HAKEDIS", "Hakediş"), K("PROJE", "Proje", 120), K("PROJE_KODU", "Proje kodu", 40),
            O("UZUNLUK", "Çizim uzunluğu (m)"), O("METRAJ", "Metraj (m)"));

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

        public static readonly CbsKatmani[] Katmanlar = { Bolge, Eleman, Hat, Kanal, Sondaj, Nokta };

        /// <summary>Projenin bütün nesneleri CBS katmanlarına (çizim koordinatıyla).</summary>
        public static List<CbsNesnesi> Nesneler(Proje p)
        {
            var l = new List<CbsNesnesi>();
            Func<string, Bolge> bolge = id => p.BolgeBul(id);
            Func<string, string> ad = id => { var b = bolge(id); return b != null ? b.Ad ?? "" : ""; };
            Func<string, string> kod = id => { var b = bolge(id); return b != null ? b.Kod ?? "" : ""; };

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
                var n = new CbsNesnesi
                {
                    Katman = Eleman, Proje = ad(e.Bolge), Durum = e.Durum,
                    Ad = string.IsNullOrEmpty(e.GisId) ? Turler.ElemanAdi(e.Tur) : e.GisId,
                    Renk = CizimStili.Yuklu ? CizimStili.EkranElemanRengi(e.Tur, e.Cins, e.Durum == "MEVCUT") : "#cbd5e1",
                };
                n.Degerler = new object[]
                {
                    e.Id, e.GisId, e.Tur, Turler.ElemanAdi(e.Tur), ana != null ? ana.Cins : e.Cins, (ana != null ? ana.Tanim : e.Tip ?? "").Trim(),
                    e.Durum, e.DmDurum, e.Hakedis, ad(e.Bolge), kod(e.Bolge), Malzemeler(e.Kalemler), Yuvarla(e.Saga, 3), Yuvarla(e.Yukari, 3),
                    Yuvarla(e.Kot, 3), Yuvarla(e.Aci * 180 / Math.PI, 4),
                };
                n.Kose.Add(new[] { e.Saga, e.Yukari });
                l.Add(n);
            }
            foreach (var h in p.Hatlar)
            {
                if (h.Kose.Count < 2) continue;
                var hk = Iletkenler.HatKalemleri(h);
                double metraj = 0;
                foreach (var k in hk) metraj = Math.Max(metraj, k.Miktar);
                var n = new CbsNesnesi
                {
                    Katman = Hat, Proje = ad(h.Bolge), Durum = h.Durum,
                    Ad = string.IsNullOrEmpty(h.Etiket) ? (string.IsNullOrEmpty(h.AnaKesit) ? Turler.HatAdi(h.Tur) : h.AnaKesit) : h.Etiket,
                    Renk = CizimStili.Yuklu ? CizimStili.EkranHatRengi(h.Tur) : "#7ee08a",
                };
                n.Degerler = new object[]
                {
                    h.Id, h.Tur, Turler.HatAdi(h.Tur), h.AnaKesit, h.Etiket, h.Durum, h.Hakedis, ad(h.Bolge), kod(h.Bolge),
                    Yuvarla(h.CizimUzunlugu, 2), Yuvarla(metraj > 0 ? metraj : h.CizimUzunlugu, 2),
                };
                foreach (var k in h.Kose) n.Kose.Add(new[] { k[0], k[1] });
                l.Add(n);
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
            }
            foreach (var t in p.Noktalar)
            {
                var n = new CbsNesnesi { Katman = Nokta, Proje = ad(t.Bolge), Ad = t.Ad, Renk = CizimStili.Yuklu ? CizimStili.EkranRengi("nokta", "#e2e8f0") : "#e2e8f0" };
                n.Degerler = new object[] { t.Id, t.Ad, t.Kod, Yuvarla(t.Kot, 3), t.Hakedis, ad(t.Bolge), string.Join(" ", t.EkMetinler.ToArray()) };
                n.Kose.Add(new[] { t.Saga, t.Yukari });
                l.Add(n);
            }
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
            if (d is double x) return x.ToString("0.########", CultureInfo.InvariantCulture);
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
