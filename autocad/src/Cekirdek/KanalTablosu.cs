using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Kanal listesinin çizime konan tablosu (AutoCAD'den bağımsız düzen): yazılar ve çizgiler, sol üst köşe (0, 0), y aşağı
    /// eksi. Her proje için başlık satırı, kanal satırları ve proje toplamı; en sonda genel toplam. Sütun genişlikleri
    /// yazıların genişliğinden (YaziDuzeni, ortak harf tablosu). Eklenti bunu bir blok olarak çizer (SH_KANAL_LISTESI):
    /// tablo AutoCAD'in tablo nesnesi değildir, DWG 2000 biçiminde de aynen kalır.
    /// </summary>
    public sealed class KanalTablosu
    {
        public sealed class Yazi
        {
            public string Metin = "";
            /// <summary>Hücrenin sol (Sag ise sağ) kenarındaki taban noktası.</summary>
            public double X, Y, H;
            public bool Sag;
        }

        public sealed class Cizgi { public double X1, Y1, X2, Y2; }

        public static readonly string[] Basliklar = { "BAŞ – BİT", "KABLOLAR", "CİNS", "KAPLAMA", "ÖLÇÜ alt/üst × der. (cm)", "UZUNLUK (m)", "HACİM (m³)", "DURUM", "HAK." };
        private static readonly bool[] SayiSutunu = { false, false, false, false, false, true, true, false, true };

        public readonly List<Yazi> Yazilar = new List<Yazi>();
        public readonly List<Cizgi> Cizgiler = new List<Cizgi>();
        public readonly double[] Sutunlar;
        public double Genislik, Yukseklik;
        public int SatirSayisi;

        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
        public static string Sayi(double d, int basamak) => SayiCoz.Temiz(d, basamak).ToString("#,##0." + new string('#', basamak), Tr);

        public static string KaplamaHucresi(KanalListesi.Satir s)
        {
            var l = new List<string>();
            if (s.Kaplama.Length > 0) l.Add(s.Kaplama);
            if (s.Bariyerli) l.Add("bariyerli");
            if (s.Trencher) l.Add("trencher");
            return string.Join(" · ", l.ToArray());
        }

        public static string[] Hucreler(KanalListesi.Satir s) => new[]
        {
            s.Numara, s.Kablolar, s.Cins, KaplamaHucresi(s), s.Olcu, Sayi(s.Uzunluk, 2), Sayi(s.Hacim, 3), s.Durum,
            s.Hakedis.ToString(CultureInfo.InvariantCulture),
        };

        private sealed class Satir
        {
            /// <summary>0 başlık, 1 sütun başlıkları, 2 proje başlığı, 3 kanal, 4 toplam.</summary>
            public int Tur;
            public string[] Hucre;
        }

        /// <param name="h">Yazı yüksekliği (m; çizimin hat etiketi yüksekliği gibi).</param>
        public KanalTablosu(KanalListesi liste, double h, string baslik = null)
        {
            if (!(h > 0)) h = 1.8;
            var satirlar = new List<Satir>();
            satirlar.Add(new Satir { Tur = 0, Hucre = new[] { baslik ?? ("KANAL LİSTESİ — " + liste.CizimAdi).Trim(' ', '—') } });
            satirlar.Add(new Satir { Tur = 1, Hucre = Basliklar });
            int i = 0;
            foreach (var t in liste.Projeler)
            {
                if (t.Tumu) continue;
                satirlar.Add(new Satir { Tur = 2, Hucre = new[] { "PROJE: " + t.GorunenAd + (t.ProjeKodu.Length > 0 ? " (" + t.ProjeKodu + ")" : "") } });
                for (; i < liste.Satirlar.Count && liste.Satirlar[i].Proje == t.Proje; i++)
                    satirlar.Add(new Satir { Tur = 3, Hucre = Hucreler(liste.Satirlar[i]) });
                satirlar.Add(new Satir { Tur = 4, Hucre = ToplamHucreleri(t.GorunenAd + " toplamı · " + t.Adet + " kanal", t) });
            }
            var tumu = liste.Projeler[liste.Projeler.Count - 1];
            satirlar.Add(new Satir { Tur = 4, Hucre = ToplamHucreleri("GENEL TOPLAM · " + tumu.Adet + " kanal", tumu) });
            SatirSayisi = satirlar.Count;

            // Sütun genişlikleri: kanal ve başlık satırlarının yazıları + iki yanda boşluk
            double bosluk = 0.8 * h;
            Sutunlar = new double[Basliklar.Length];
            foreach (var s in satirlar)
                if (s.Tur == 1 || s.Tur == 3)
                    for (int c = 0; c < Sutunlar.Length; c++)
                        Sutunlar[c] = Math.Max(Sutunlar[c], YaziDuzeni.Genislik(s.Hucre[c], h) + 2 * bosluk);
            foreach (var s in satirlar)
                if (s.Tur == 4)
                    for (int c = 5; c <= 6; c++) Sutunlar[c] = Math.Max(Sutunlar[c], YaziDuzeni.Genislik(s.Hucre[c], h) + 2 * bosluk);
            double ilkBesi = 0;
            for (int c = 0; c < 5; c++) ilkBesi += Sutunlar[c];
            foreach (var s in satirlar)
            {
                double gerek = (s.Tur == 0 ? 1.4 : 1) * YaziDuzeni.Genislik(s.Hucre[0], h) + 2 * bosluk;
                if (s.Tur == 4 && gerek > ilkBesi) { Sutunlar[4] += gerek - ilkBesi; ilkBesi = gerek; }
            }
            double[] x = new double[Sutunlar.Length + 1];
            for (int c = 0; c < Sutunlar.Length; c++) x[c + 1] = x[c] + Sutunlar[c];
            Genislik = x[Sutunlar.Length];
            foreach (var s in satirlar)
                if (s.Tur == 0 || s.Tur == 2) Genislik = Math.Max(Genislik, (s.Tur == 0 ? 1.4 : 1) * YaziDuzeni.Genislik(s.Hucre[0], h) + 2 * bosluk);
            x[Sutunlar.Length] = Genislik;
            Sutunlar[Sutunlar.Length - 1] = Genislik - x[Sutunlar.Length - 1];

            double y = 0;
            Cizgiler.Add(new Cizgi { X1 = 0, Y1 = 0, X2 = Genislik, Y2 = 0 });
            foreach (var s in satirlar)
            {
                double yh = s.Tur == 0 ? 1.4 * h : h;
                double sh = s.Tur == 0 ? 2.4 * h : 1.8 * h;
                double taban = y - sh + (sh - yh) / 2;
                switch (s.Tur)
                {
                    case 0:
                    case 2:
                        Yazilar.Add(new Yazi { Metin = s.Hucre[0], X = bosluk, Y = taban, H = yh });
                        Dikey(0, y, y - sh); Dikey(Genislik, y, y - sh);
                        break;
                    case 4:
                        Yazilar.Add(new Yazi { Metin = s.Hucre[0], X = bosluk, Y = taban, H = yh });
                        for (int c = 5; c <= 6; c++) Yazilar.Add(new Yazi { Metin = s.Hucre[c], X = x[c + 1] - bosluk, Y = taban, H = yh, Sag = true });
                        foreach (int c in new[] { 0, 5, 6, 7 }) Dikey(x[c], y, y - sh);
                        Dikey(Genislik, y, y - sh);
                        break;
                    default:
                        for (int c = 0; c < Sutunlar.Length; c++)
                        {
                            if (string.IsNullOrEmpty(s.Hucre[c])) continue;
                            bool sag = s.Tur == 3 && SayiSutunu[c];
                            Yazilar.Add(new Yazi { Metin = s.Hucre[c], X = sag ? x[c + 1] - bosluk : x[c] + bosluk, Y = taban, H = yh, Sag = sag });
                        }
                        for (int c = 0; c <= Sutunlar.Length; c++) Dikey(x[c], y, y - sh);
                        break;
                }
                y -= sh;
                Cizgiler.Add(new Cizgi { X1 = 0, Y1 = y, X2 = Genislik, Y2 = y });
            }
            Yukseklik = -y;
        }

        private static string[] ToplamHucreleri(string ad, KanalListesi.Toplam t) =>
            new[] { ad, "", "", "", "", Sayi(t.Uzunluk, 2), Sayi(t.Hacim, 3), "", "" };

        private void Dikey(double x, double y1, double y2) => Cizgiler.Add(new Cizgi { X1 = x, Y1 = y1, X2 = x, Y2 = y2 });
    }
}
