using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>DURUM TESPİT sayfasının bir satırı (AutoCAD raporuyla aynı sütunlar).</summary>
    public sealed class RaporSatiri
    {
        public string Handle = "", Proje = "", Cins = "", Tip = "", Durum = "";
        public double BirimFiyat, Miktar, Katsayi, Toplam, Tutar;
        public string Birim = "";
        public int Hakedis;
        public string BolgeTarife = "", MalzemeTarife = "", DmDurum = "", Index = "", Kontrol = "";
        /// <summary>Satırın geldiği nesne türü (sıralama ve özet için): ELEMAN, HAT, KANAL, SONDAJ</summary>
        public string Nesne = "";
    }

    /// <summary>
    /// Proje modelinden "Durum Tespit" raporunu üretir. Kurallar AutoCAD'in rapor dosyasındaki
    /// hesaplarla aynıdır ve gerçek bir projede satır satır karşılaştırılarak doğrulanmıştır:
    ///  - her poz satırı bir rapor satırıdır;
    ///  - kanalın kendi satırı yerine, kanal hacmi kanaldaki kablolara paylaştırılır (KABLO_KANALI);
    ///  - çıplak AG/OG iletkenler tel tel açılır, metre ve kilogramı ayrı satır olur (AL_İLETKENLER);
    ///  - proje adı ve kodu, nesnenin bölgesinden gelir.
    /// </summary>
    public sealed class DurumTespit
    {
        public readonly List<RaporSatiri> Satirlar = new List<RaporSatiri>();
        private readonly Proje _p;
        private readonly Katsayilar _k;
        private readonly Dictionary<string, Bolge> _bolgeler = new Dictionary<string, Bolge>(StringComparer.Ordinal);

        public DurumTespit(Proje p, Katsayilar k = null)
        {
            _p = p;
            _k = k ?? Katsayilar.Varsayilan;
            foreach (var b in p.Bolgeler) _bolgeler[b.Id] = b;
            Uret();
        }

        public string ProjeAdi(string bolgeId) { Bolge b; return bolgeId != null && _bolgeler.TryGetValue(bolgeId, out b) ? b.Ad : ""; }
        public string ProjeKodu(string bolgeId) { Bolge b; return bolgeId != null && _bolgeler.TryGetValue(bolgeId, out b) ? b.Kod : ""; }

        private void Uret()
        {
            foreach (var e in _p.Elemanlar)
                foreach (var k in e.Kalemler)
                    Satirlar.Add(Satir(e.Id, e.Bolge, k, k.Ana ? e.Kontrol : k.Kontrol, "ELEMAN",
                        k.Ana && !string.IsNullOrEmpty(k.DmDurum) ? k.DmDurum : "Standart"));

            foreach (var h in _p.Hatlar)
                foreach (var k in h.Kalemler)
                {
                    Satirlar.Add(Satir(h.Id, h.Bolge, k, k.Kontrol, "HAT", "Standart"));
                    if (k.Cins == "AG_İLETKEN") IletkenAc(h, k, _k.AgIletkenAcilim, _k.AgIletkenAdlari, _k.AgIletkenAgirlik, "");
                    else if (k.Cins == "OG_İLETKEN") IletkenAc(h, k, _k.OgIletkenAcilim, _k.OgIletkenAdlari, _k.OgIletkenAgirlik, "");
                }

            foreach (var c in _p.Kanallar)
                foreach (var k in c.Kalemler)
                {
                    if (k.Ana) KanalPaylastir(c, k);
                    else Satirlar.Add(Satir(c.Id, c.Bolge, k, k.Kontrol, "KANAL", "Standart"));
                }

            foreach (var s in _p.Sondajlar)
                foreach (var k in s.Kalemler)
                    Satirlar.Add(Satir(s.Id, s.Bolge, k, k.Kontrol, "SONDAJ", "Standart"));

            Satirlar.Sort((a, b) =>
            {
                int r = string.CompareOrdinal(a.Proje, b.Proje);
                if (r != 0) return r;
                r = a.Hakedis.CompareTo(b.Hakedis);
                if (r != 0) return r;
                return SiraKarsilastir(a.Index, b.Index);
            });
        }

        private RaporSatiri Satir(string handle, string bolgeId, Kalem k, bool? kontrol, string nesne, string dmDurum)
        {
            return new RaporSatiri
            {
                Handle = handle,
                Proje = ProjeAdi(bolgeId),
                Cins = k.Cins,
                Tip = k.Tanim,
                Durum = k.Durum,
                BirimFiyat = k.BirimFiyat,
                Miktar = k.Miktar,
                Birim = k.Birim,
                Katsayi = k.Katsayi,
                Toplam = k.Toplam,
                Tutar = SayiCoz.Temiz(k.Toplam * k.BirimFiyat, 2),
                Hakedis = k.Hakedis,
                BolgeTarife = ProjeKodu(bolgeId),
                MalzemeTarife = k.Tarife,
                DmDurum = dmDurum,
                Index = k.Sira,
                Kontrol = KontrolMetni(kontrol),
                Nesne = nesne,
            };
        }

        private void IletkenAc(Hat h, Kalem k, Dictionary<string, int[]> acilim, string[] adlar, double[] agirlik, string dmDurum)
        {
            int[] teller;
            if (!acilim.TryGetValue((k.Tanim ?? "").Trim(), out teller)) return;
            for (int i = 0; i < adlar.Length; i++)
            {
                if (teller[i] == 0) continue;
                var s = Satir(h.Id, h.Bolge, k, k.Kontrol, "HAT", dmDurum);
                s.Cins = "AL_İLETKENLER";
                s.Tip = adlar[i];
                s.Miktar = SayiCoz.Temiz(k.Miktar * teller[i]);
                s.Birim = "mt/kg";
                s.Toplam = SayiCoz.Temiz(k.Miktar * teller[i] * agirlik[i]);
                s.Tutar = SayiCoz.Temiz(s.Toplam * k.BirimFiyat, 2);
                Satirlar.Add(s);
            }
        }

        private void KanalPaylastir(Kanal c, Kalem k)
        {
            string og, ag;
            Katsayilar.KanalUnsurlari(k.Tarife, out og, out ag);
            double[] pay;
            if (!_k.KanalPaylasim.TryGetValue(KanalKodu.Kablolar(c.Kod), out pay))
                pay = new[] { 1.0, 0, 0, 0 };
            string[] tarifeler = { og, ag, _k.TarifeAYD, _k.TarifeREK };
            for (int i = 0; i < 4; i++)
            {
                if (pay[i] == 0) continue;
                var s = Satir(c.Id, c.Bolge, k, c.Kontrol ?? k.Kontrol, "KANAL", "Standart");
                s.Cins = "KABLO_KANALI";
                s.Tip = c.Zemin;
                s.Toplam = SayiCoz.Temiz(k.Toplam * pay[i]);
                s.Tutar = SayiCoz.Temiz(s.Toplam * k.BirimFiyat, 2);
                s.MalzemeTarife = tarifeler[i];
                Satirlar.Add(s);
            }
        }

        // ---------------- Özet ----------------

        public sealed class OzetSatiri
        {
            public string Proje = "", Durum = "", Cins = "", Tip = "", Birim = "";
            public int Hakedis;
            public double Miktar, Toplam, Tutar;
            public int SatirSayisi;
        }

        /// <summary>Proje × hakediş × durum × cins × tip × birim toplamları (AutoCAD ÖZET TABLO).</summary>
        public List<OzetSatiri> Ozet()
        {
            var sozluk = new Dictionary<string, OzetSatiri>(StringComparer.Ordinal);
            var liste = new List<OzetSatiri>();
            foreach (var s in Satirlar)
            {
                string anahtar = s.Proje + "\u0001" + s.Hakedis.ToString(CultureInfo.InvariantCulture) + "\u0001" + s.Durum + "\u0001" + s.Cins + "\u0001" + s.Tip + "\u0001" + s.Birim;
                OzetSatiri o;
                if (!sozluk.TryGetValue(anahtar, out o))
                {
                    o = new OzetSatiri { Proje = s.Proje, Hakedis = s.Hakedis, Durum = s.Durum, Cins = s.Cins, Tip = s.Tip, Birim = s.Birim };
                    sozluk[anahtar] = o;
                    liste.Add(o);
                }
                o.Miktar += s.Miktar;
                o.Toplam += s.Toplam;
                o.Tutar += s.Tutar;
                o.SatirSayisi++;
            }
            foreach (var o in liste) { o.Miktar = SayiCoz.Temiz(o.Miktar); o.Toplam = SayiCoz.Temiz(o.Toplam); o.Tutar = SayiCoz.Temiz(o.Tutar, 2); }
            liste.Sort((a, b) =>
            {
                int r = string.CompareOrdinal(a.Proje, b.Proje);
                if (r == 0) r = a.Hakedis.CompareTo(b.Hakedis);
                if (r == 0) r = string.CompareOrdinal(a.Durum, b.Durum);
                if (r == 0) r = string.CompareOrdinal(a.Cins, b.Cins);
                if (r == 0) r = string.CompareOrdinal(a.Tip, b.Tip);
                if (r == 0) r = string.CompareOrdinal(a.Birim, b.Birim);
                return r;
            });
            return liste;
        }

        // ---------------- Yardımcılar ----------------

        public static string KontrolMetni(bool? k) => k.HasValue ? (k.Value ? "True" : "False") : "";

        private static int SiraKarsilastir(string a, string b)
        {
            long x, y;
            bool ax = long.TryParse(a, NumberStyles.Integer, CultureInfo.InvariantCulture, out x);
            bool by = long.TryParse(b, NumberStyles.Integer, CultureInfo.InvariantCulture, out y);
            if (ax && by) return x.CompareTo(y);
            if (ax) return -1;
            if (by) return 1;
            return string.CompareOrdinal(a, b);
        }
    }
}
