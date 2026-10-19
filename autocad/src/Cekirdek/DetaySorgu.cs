using System;
using System.Collections.Generic;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    public enum DetayKapsami
    {
        /// <summary>Aranan malzemesi olan elemanlar (malzemenin her satırı) ve olmayanlar (birer satır).</summary>
        Hepsi,
        /// <summary>Yalnız aranan malzemesi olanlar: malzemenin her satırı, elemanının bilgisiyle.</summary>
        Olanlar,
        /// <summary>Yalnız aranan malzemesi olmayan elemanlar (eksik malzeme): elemanın bir satırı.</summary>
        Olmayanlar,
    }

    /// <summary>Eksik malzeme sorgusunun süzgeçleri. Boş alan: hepsi.</summary>
    public sealed class DetayFiltresi
    {
        // Hangi elemanlar (elemanın ana malzemesine göre)
        public string AnaCins = "", AnaTip = "", AnaDurum = "";
        /// <summary>Bölge kimliği (boş: hepsi).</summary>
        public string Bolge = "";
        // Aranan ara malzeme
        public string Cins = "", Tip = "", Durum = "";
        /// <summary>Ara malzemenin hakedişi (0: hepsi).</summary>
        public int Hakedis;
        public DetayKapsami Kapsam = DetayKapsami.Hepsi;

        public bool AranaBosMu => string.IsNullOrWhiteSpace(Cins) && string.IsNullOrWhiteSpace(Tip) && string.IsNullOrWhiteSpace(Durum) && Hakedis <= 0;
    }

    public sealed class DetaySatiri
    {
        public Eleman Eleman;
        /// <summary>Elemanın ana malzemesi (yoksa boş kalem).</summary>
        public Kalem Ana;
        /// <summary>Bulunan ara malzeme; null: aranan malzemesi olmayan elemanın satırı.</summary>
        public Kalem Malzeme;
        public string Proje = "", BolgeTarife = "";
        public bool Olan => Malzeme != null;
    }

    /// <summary>
    /// AutoCAD raporundaki DETAY sorgusu ("eksik malzeme bul"): elemanların ara malzemelerinde aranan malzemeyi arar.
    /// Olanlar: aranan malzemenin her satırı elemanıyla; olmayanlar: aranan malzemesi hiç olmayan elemanlar.
    /// Süzgeçler büyük/küçük harf, Türkçe I/İ ve boşluk farkını yok sayar.
    /// </summary>
    public static class DetaySorgu
    {
        public static readonly string[] Basliklar =
        {
            "HANDLE", "PROJE", "SIRA NO", "GIS ID", "ANA CİNS", "ANA TİP", "ANA DURUM", "CİNS", "TİP", "DURUM", "BİRM F.", "MİKTAR",
            "BİRİM", "METRİK A.", "TOP. MİK.", "TOP. TL.", "HAK. NO", "BÖL.TARİFE", "TARİFE", "INDEX", "KONTROL",
        };

        public static List<DetaySatiri> Sorgula(Proje p, DetayFiltresi f, Katsayilar k = null)
        {
            var dt = new DurumTespit(p, k ?? Katsayilar.Varsayilan);
            return Sorgula(p, f, dt);
        }

        public static List<DetaySatiri> Sorgula(Proje p, DetayFiltresi f, DurumTespit dt)
        {
            f = f ?? new DetayFiltresi();
            var l = new List<DetaySatiri>();
            foreach (var e in p.Elemanlar)
            {
                if (!string.IsNullOrEmpty(f.Bolge) && !string.Equals(e.Bolge ?? "", f.Bolge, StringComparison.OrdinalIgnoreCase)) continue;
                var ana = e.Kalemler.Find(x => x.Ana) ?? new Kalem();
                if (!Uyar(f.AnaCins, ana.Cins) || !Uyar(f.AnaTip, ana.Tanim) || !Uyar(f.AnaDurum, ana.Durum)) continue;
                string proje = dt.ProjeAdi(e.Bolge), tarife = dt.ProjeKodu(e.Bolge);
                bool bulundu = false;
                foreach (var m in e.Kalemler)
                {
                    if (m.Ana) continue;
                    if (f.Hakedis > 0 && m.Hakedis != f.Hakedis) continue;
                    if (!Uyar(f.Cins, m.Cins) || !Uyar(f.Tip, m.Tanim) || !Uyar(f.Durum, m.Durum)) continue;
                    bulundu = true;
                    if (f.Kapsam != DetayKapsami.Olmayanlar)
                        l.Add(new DetaySatiri { Eleman = e, Ana = ana, Malzeme = m, Proje = proje, BolgeTarife = tarife });
                }
                if (!bulundu && f.Kapsam != DetayKapsami.Olanlar)
                    l.Add(new DetaySatiri { Eleman = e, Ana = ana, Malzeme = null, Proje = proje, BolgeTarife = tarife });
            }
            return l;
        }

        /// <summary>Raporun DETAY sayfasının satırı (Basliklar sırasıyla).</summary>
        public static object[] Satir(DetaySatiri s)
        {
            var e = s.Eleman;
            var a = s.Ana ?? new Kalem();
            var m = s.Malzeme;
            if (m == null)
                return new object[] { e.Id, s.Proje, e.Id, e.GisId, a.Cins, a.Tanim, a.Durum, "", "", "", "", "", "", "", "", "", "", s.BolgeTarife, "", "", "" };
            return new object[]
            {
                e.Id, s.Proje, e.Id, e.GisId, a.Cins, a.Tanim, a.Durum, m.Cins, m.Tanim, m.Durum, m.BirimFiyat, m.Miktar, m.Birim, m.Katsayi,
                m.Toplam, SayiCoz.Temiz(m.ToplamTutar, 2), m.Hakedis, s.BolgeTarife, m.Tarife, Index(m.Sira), DurumTespit.KontrolMetni(m.Kontrol),
            };
        }

        private static object Index(string s)
        {
            long n;
            return long.TryParse((s ?? "").Trim(), System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out n) ? (object)n : (s ?? "");
        }

        /// <summary>Süzgeç boşsa her değer uyar; değilse büyük/küçük harf, I/İ ve boşluk farkı gözetilmeden eşitlik.</summary>
        public static bool Uyar(string suzgec, string deger)
        {
            if (string.IsNullOrWhiteSpace(suzgec)) return true;
            return Sade(suzgec) == Sade(deger);
        }

        /// <summary>Karşılaştırma için sadeleştirilmiş metin: büyük harf, I/İ/ı birleşik, boşluklar (bölünmez boşluk dahil) atılmış.</summary>
        public static string Sade(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var sb = new StringBuilder(s.Length);
            foreach (char c in s)
            {
                if (char.IsWhiteSpace(c) || c == ' ') continue;
                char u = char.ToUpperInvariant(c);
                if (u == 'İ' || c == 'ı') u = 'I';
                sb.Append(u);
            }
            return sb.ToString();
        }
    }
}
