using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// "Proje özeti" penceresinin verisi: çizimdeki projeler (bölgeler) ve seçilen projenin malzeme listesi.
    /// Toplamlar Durum Tespit raporunun ÖZET sayfasıyla aynıdır (DurumTespit.Ozet); "Tüm projeler" seçilince
    /// projelerin aynı malzemeleri birleştirilir. Listeler Excel'e yazılır (ExcelYaz).
    /// </summary>
    public sealed class ProjeOzeti
    {
        public const string TumuAdi = "Tüm projeler";
        public const string ProjesizAdi = "Projesi olmayanlar";

        /// <summary>Proje listesinin bir satırı.</summary>
        public sealed class ProjeSatiri
        {
            /// <summary>"Tüm projeler" satırı mı.</summary>
            public bool Tumu;
            /// <summary>Durum Tespit'teki PROJE değeri (bölge adı); bölgesi olmayan nesnelerde "".</summary>
            public string Ad = "";
            public string Kod = "";
            public int Eleman, Hat, Kanal, Sondaj;
            /// <summary>Malzeme listesindeki satır sayısı.</summary>
            public int Malzeme;
            public double Tutar;

            public string GorunenAd => Tumu ? TumuAdi : Ad.Length == 0 ? ProjesizAdi : Ad;
        }

        /// <summary>Çizimin (ana projenin) adı.</summary>
        public readonly string CizimAdi;
        /// <summary>İlki "Tüm projeler"; sonra projeler ada göre; en sonda (varsa) projesi olmayan nesneler.</summary>
        public readonly List<ProjeSatiri> Projeler = new List<ProjeSatiri>();
        /// <summary>Malzemelerde geçen hakedişler ve durumlar (süzgeç listeleri için).</summary>
        public readonly List<int> Hakedisler = new List<int>();
        public readonly List<string> Durumlar = new List<string>();

        private readonly List<DurumTespit.OzetSatiri> _satirlar;
        private readonly Proje _proje;

        /// <summary>Proje bazında kanal listesi (bütün projeler; pencere ve Excel'in KANAL sayfaları).</summary>
        public readonly KanalListesi Kanallar;

        /// <summary>Kanal listesi süzgeçle: proje (null ya da "Tüm projeler": hepsi) ve hakediş (0: hepsi).</summary>
        public KanalListesi KanalListesi(ProjeSatiri proje, int hakedis = 0) =>
            new KanalListesi(_proje, proje == null || proje.Tumu ? null : proje.Ad, hakedis);
        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

        public ProjeOzeti(Proje p, Katsayilar k = null)
        {
            CizimAdi = p.Ad ?? "";
            _proje = p;
            Kanallar = new KanalListesi(p);
            var dt = new DurumTespit(p, k);
            _satirlar = dt.Ozet();

            var tumu = new ProjeSatiri { Tumu = true };
            var adla = new Dictionary<string, ProjeSatiri>(StringComparer.Ordinal);
            Func<string, ProjeSatiri> proje = ad =>
            {
                ad = ad ?? "";
                ProjeSatiri s;
                if (!adla.TryGetValue(ad, out s)) adla[ad] = s = new ProjeSatiri { Ad = ad };
                return s;
            };
            // Nesnesi olmayan bölgeler de listede görünür; aynı adlı bölgeler (raporda olduğu gibi) tek projedir
            foreach (var b in p.Bolgeler)
            {
                var s = proje(b.Ad);
                if (!string.IsNullOrEmpty(b.Kod) && Array.IndexOf(s.Kod.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries), b.Kod) < 0)
                    s.Kod = s.Kod.Length == 0 ? b.Kod : s.Kod + ", " + b.Kod;
            }
            foreach (var e in p.Elemanlar) { proje(dt.ProjeAdi(e.Bolge)).Eleman++; tumu.Eleman++; }
            foreach (var h in p.Hatlar) { proje(dt.ProjeAdi(h.Bolge)).Hat++; tumu.Hat++; }
            foreach (var c in p.Kanallar) { proje(dt.ProjeAdi(c.Bolge)).Kanal++; tumu.Kanal++; }
            foreach (var s in p.Sondajlar) { proje(dt.ProjeAdi(s.Bolge)).Sondaj++; tumu.Sondaj++; }

            var hak = new SortedSet<int>();
            var durum = new HashSet<string>(StringComparer.Ordinal);
            foreach (var o in _satirlar)
            {
                var s = proje(o.Proje);
                s.Malzeme++;
                s.Tutar += o.Tutar;
                tumu.Tutar += o.Tutar;
                hak.Add(o.Hakedis);
                if (!string.IsNullOrEmpty(o.Durum)) durum.Add(o.Durum);
            }
            tumu.Tutar = SayiCoz.Temiz(tumu.Tutar, 2);
            tumu.Malzeme = Malzemeler(tumu).Count;

            var liste = new List<ProjeSatiri>(adla.Values);
            foreach (var s in liste) s.Tutar = SayiCoz.Temiz(s.Tutar, 2);
            liste.Sort((a, b) =>
            {
                if ((a.Ad.Length == 0) != (b.Ad.Length == 0)) return a.Ad.Length == 0 ? 1 : -1; // projesizler en sonda
                return string.Compare(a.Ad, b.Ad, Tr, CompareOptions.IgnoreCase);
            });
            Projeler.Add(tumu);
            foreach (var s in liste)
                if (s.Ad.Length > 0 || s.Eleman + s.Hat + s.Kanal + s.Sondaj + s.Malzeme > 0) Projeler.Add(s);

            Hakedisler.AddRange(hak);
            // Durumlar çizimdeki sırayla (M, M+M, KM, DM, DM+M, MEVCUT), bilinmeyenler sonda
            foreach (var d in Turler.CizimDurumlari) if (durum.Remove(d)) Durumlar.Add(d);
            var kalan = new List<string>(durum);
            kalan.Sort(StringComparer.Ordinal);
            Durumlar.AddRange(kalan);
        }

        /// <summary>
        /// Projenin malzeme listesi (hakediş × durum × cins × tip × birim toplamları). proje null: bütün projelerin
        /// satırları ayrı ayrı (PROJE sütunuyla); "Tüm projeler": projeler birleştirilir. hakedis 0 ve boş durum: hepsi;
        /// ara: cins ya da tipte geçen yazı (büyük/küçük harf, I/İ ve boşluk farkı gözetilmez).
        /// </summary>
        public List<DurumTespit.OzetSatiri> Malzemeler(ProjeSatiri proje, int hakedis = 0, string durum = null, string ara = null)
        {
            string a = DetaySorgu.Sade(ara);
            bool birlestir = proje != null && proje.Tumu;
            var liste = new List<DurumTespit.OzetSatiri>();
            var sozluk = new Dictionary<string, DurumTespit.OzetSatiri>(StringComparer.Ordinal);
            foreach (var o in _satirlar)
            {
                if (proje != null && !proje.Tumu && o.Proje != proje.Ad) continue;
                if (hakedis > 0 && o.Hakedis != hakedis) continue;
                if (!string.IsNullOrEmpty(durum) && o.Durum != durum) continue;
                if (a.Length > 0 && DetaySorgu.Sade(o.Cins + o.Tip).IndexOf(a, StringComparison.Ordinal) < 0) continue;
                if (!birlestir) { liste.Add(o); continue; }
                string anahtar = o.Hakedis.ToString(CultureInfo.InvariantCulture) + "\u0001" + o.Durum + "\u0001" + o.Cins + "\u0001" + o.Tip + "\u0001" + o.Birim;
                DurumTespit.OzetSatiri t;
                if (!sozluk.TryGetValue(anahtar, out t))
                {
                    sozluk[anahtar] = t = new DurumTespit.OzetSatiri { Hakedis = o.Hakedis, Durum = o.Durum, Cins = o.Cins, Tip = o.Tip, Birim = o.Birim };
                    liste.Add(t);
                }
                t.Miktar += o.Miktar;
                t.Toplam += o.Toplam;
                t.Tutar += o.Tutar;
                t.SatirSayisi += o.SatirSayisi;
            }
            if (birlestir)
            {
                foreach (var t in liste) { t.Miktar = SayiCoz.Temiz(t.Miktar); t.Toplam = SayiCoz.Temiz(t.Toplam); t.Tutar = SayiCoz.Temiz(t.Tutar, 2); }
                liste.Sort((x, y) =>
                {
                    int r = x.Hakedis.CompareTo(y.Hakedis);
                    if (r == 0) r = string.CompareOrdinal(x.Durum, y.Durum);
                    if (r == 0) r = string.CompareOrdinal(x.Cins, y.Cins);
                    if (r == 0) r = string.CompareOrdinal(x.Tip, y.Tip);
                    if (r == 0) r = string.CompareOrdinal(x.Birim, y.Birim);
                    return r;
                });
            }
            return liste;
        }

        /// <summary>Süzgeçlerin okunur yazısı (Excel başlığı ve pencere için); süzgeç yoksa "".</summary>
        public static string SuzgecYazisi(int hakedis, string durum, string ara)
        {
            var l = new List<string>();
            if (hakedis > 0) l.Add(hakedis + ". hakediş");
            if (!string.IsNullOrEmpty(durum)) l.Add("durum " + durum);
            if (!string.IsNullOrWhiteSpace(ara)) l.Add("arama \"" + ara.Trim() + "\"");
            return string.Join(" · ", l.ToArray());
        }

        /// <summary>
        /// Listeleri Excel'e yazar: PROJELER (proje listesi ve toplam), MALZEME LİSTESİ (seçili projenin, süzgeçlerle
        /// pencerede görünen hâli). "Tüm projeler" seçiliyse bir de PROJE BAZINDA sayfası (her projenin listesi ayrı satırlarda).
        /// Kanal varsa KANAL LİSTESİ (proje bazında, her projenin altında toplam) ve KANAL ÖZETİ (proje × zemin × durum).
        /// </summary>
        public void ExcelYaz(string yol, ProjeSatiri secili, int hakedis, string durum, string ara, string surum)
        {
            secili = secili ?? Projeler[0];
            var x = new XlsxYazici();
            string olusturma = "Oluşturma: " + DateTime.Now.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture) + "   ·   Şebeke-M " + surum;

            var pr = x.SayfaEkle("PROJELER");
            pr.UstBilgi.Add("PROJE LİSTESİ — " + CizimAdi);
            pr.UstBilgi.Add(olusturma);
            pr.Basliklar.AddRange(new[] { "PROJE", "PROJE KODU", "ELEMAN", "HAT", "KANAL", "SONDAJ", "MALZEME SATIRI", "TOP. TL." });
            ProjeSatiri tumu = null;
            foreach (var s in Projeler)
            {
                if (s.Tumu) { tumu = s; continue; }
                pr.Satirlar.Add(new object[] { s.GorunenAd, s.Kod, s.Eleman, s.Hat, s.Kanal, s.Sondaj, s.Malzeme, s.Tutar });
            }
            if (tumu != null) pr.Satirlar.Add(new object[] { "TOPLAM (" + TumuAdi.ToLower(Tr) + ")", "", tumu.Eleman, tumu.Hat, tumu.Kanal, tumu.Sondaj, tumu.Malzeme, tumu.Tutar });
            pr.Genislikler[0] = 50; pr.Genislikler[1] = 26;
            for (int i = 2; i <= 6; i++) pr.SayiBicimleri[i] = "0";
            pr.SayiBicimleri[7] = "#,##0.00";

            string suzgec = SuzgecYazisi(hakedis, durum, ara);
            var ml = x.SayfaEkle("MALZEME LİSTESİ");
            ml.UstBilgi.Add("MALZEME LİSTESİ — " + secili.GorunenAd + (string.IsNullOrEmpty(secili.Kod) ? "" : " (" + secili.Kod + ")"));
            if (suzgec.Length > 0) ml.UstBilgi.Add("Süzgeç: " + suzgec);
            ml.UstBilgi.Add(olusturma);
            MalzemeSayfasi(ml, Malzemeler(secili, hakedis, durum, ara), false);

            if (secili.Tumu)
            {
                var pb = x.SayfaEkle("PROJE BAZINDA");
                pb.UstBilgi.Add("PROJE BAZINDA MALZEME LİSTESİ — " + CizimAdi);
                if (suzgec.Length > 0) pb.UstBilgi.Add("Süzgeç: " + suzgec);
                pb.UstBilgi.Add(olusturma);
                MalzemeSayfasi(pb, Malzemeler(null, hakedis, durum, ara), true);
            }
            // Proje bazında kanal listesi ve kanal özeti (bütün projeler, süzgeçsiz)
            if (Kanallar.Satirlar.Count > 0) Kanallar.SayfalariEkle(x, olusturma);
            x.Kaydet(yol);
        }

        private void MalzemeSayfasi(XlsxYazici.Sayfa s, List<DurumTespit.OzetSatiri> satirlar, bool projeli)
        {
            var kodlar = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var p in Projeler) if (!p.Tumu) kodlar[p.Ad] = p.Kod;
            if (projeli) s.Basliklar.AddRange(new[] { "PROJE", "PROJE KODU" });
            s.Basliklar.AddRange(new[] { "HAK. NO", "DURUM", "CİNS", "TİP", "BİRİM", "MİKTAR", "TOP. MİK.", "TOP. TL.", "SATIR" });
            foreach (var o in satirlar)
            {
                var r = new List<object>();
                if (projeli)
                {
                    string kod;
                    kodlar.TryGetValue(o.Proje ?? "", out kod);
                    r.Add(string.IsNullOrEmpty(o.Proje) ? ProjesizAdi : o.Proje);
                    r.Add(kod ?? "");
                }
                r.AddRange(new object[] { o.Hakedis, o.Durum, o.Cins, o.Tip, o.Birim, o.Miktar, o.Toplam, o.Tutar, o.SatirSayisi });
                s.Satirlar.Add(r.ToArray());
            }
            int b = projeli ? 2 : 0;
            if (projeli) { s.Genislikler[0] = 50; s.Genislikler[1] = 26; }
            s.Genislikler[b + 2] = 26; s.Genislikler[b + 3] = 40;
            s.SayiBicimleri[b] = "0"; s.SayiBicimleri[b + 7] = "#,##0.00"; s.SayiBicimleri[b + 8] = "0";
        }
    }
}
