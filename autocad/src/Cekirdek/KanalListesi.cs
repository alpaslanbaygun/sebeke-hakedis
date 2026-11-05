using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Proje bazında kanal listesi: her kanal parçası bir satır (proje, baş–bit numarası, kablolar, cins, kaplama, ölçüler,
    /// uzunluk, hacim, durum, hakediş), her proje için toplam ve proje × zemin × durum özeti. Proje Özeti penceresi,
    /// Excel (KANAL LİSTESİ / KANAL ÖZETİ) ve çizime konan kanal tablosu bunu kullanır.
    /// Telefondaki karşılığı: telefon/web/src/interop/sh-core.cjs › kanalListesi (aynı kural, aynı sıra); ortak deneme
    /// ortak/deneme/kanal-listesi.json.
    /// </summary>
    public sealed class KanalListesi
    {
        public sealed class Satir
        {
            public string Proje = "", ProjeKodu = "", Kimlik = "", BasNo = "", BitNo = "", Kablolar = "", Zemin = "", Durum = "";
            /// <summary>Okunur cins ve kaplama (kural dışı zemin adında Cins = adın kendisi, Kaplama = "").</summary>
            public string Cins = "", Kaplama = "";
            public bool Bariyerli, Trencher;
            public int Hakedis;
            /// <summary>cm</summary>
            public double Alt, Ust, Derinlik;
            /// <summary>Uzunluk: kanal kaleminin metrajı (m); hacim: kalemin toplamı (m³).</summary>
            public double Uzunluk, Hacim;

            public string Numara => BasNo.Length > 0 || BitNo.Length > 0 ? BasNo + " – " + BitNo : "";
            public string Olcu => Sayi(Alt) + "/" + Sayi(Ust) + " × " + Sayi(Derinlik);
        }

        public sealed class Toplam
        {
            public string Proje = "", ProjeKodu = "";
            /// <summary>Bütün projelerin toplamı (listenin en sonunda).</summary>
            public bool Tumu;
            public int Adet;
            public double Uzunluk, Hacim;
            public string GorunenAd => Tumu ? "TOPLAM" : Proje.Length == 0 ? ProjeOzeti.ProjesizAdi : Proje;
        }

        public sealed class OzetSatiri
        {
            public string Proje = "", Zemin = "", Durum = "";
            public int Adet;
            public double Uzunluk, Hacim;
        }

        public readonly string CizimAdi;
        public readonly List<Satir> Satirlar = new List<Satir>();
        /// <summary>Proje sırasıyla; en sonda bütün projelerin toplamı (Tumu).</summary>
        public readonly List<Toplam> Projeler = new List<Toplam>();
        /// <summary>Proje × zemin × durum toplamları (hakediş kalemleri gibi).</summary>
        public readonly List<OzetSatiri> Ozet = new List<OzetSatiri>();

        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

        public static string Sayi(double d) => SayiCoz.Temiz(d, 2).ToString("0.##", Tr);

        /// <summary>Projeler ada göre (Türkçe sıra, büyük/küçük harf farkı yok); projesi olmayanlar en sonda.</summary>
        public static int ProjeSirasi(string a, string b)
        {
            a = a ?? ""; b = b ?? "";
            if ((a.Length == 0) != (b.Length == 0)) return a.Length == 0 ? 1 : -1;
            return string.Compare(a, b, Tr, CompareOptions.IgnoreCase);
        }

        /// <param name="proje">Yalnız bu projenin kanalları (null: hepsi).</param>
        /// <param name="hakedis">Yalnız bu hakedişin kanalları (0: hepsi).</param>
        public KanalListesi(Proje p, string proje = null, int hakedis = 0)
        {
            CizimAdi = p.Ad ?? "";
            var bolgeler = new Dictionary<string, Bolge>(StringComparer.Ordinal);
            foreach (var b in p.Bolgeler) if (!string.IsNullOrEmpty(b.Id) && !bolgeler.ContainsKey(b.Id)) bolgeler[b.Id] = b;
            var sirali = new List<KeyValuePair<int, Satir>>();
            for (int i = 0; i < p.Kanallar.Count; i++)
            {
                var c = p.Kanallar[i];
                Bolge b;
                if (c.Bolge == null || !bolgeler.TryGetValue(c.Bolge, out b)) b = null;
                var s = new Satir
                {
                    Proje = b != null ? b.Ad ?? "" : "", ProjeKodu = b != null ? b.Kod ?? "" : "",
                    Kimlik = c.Id ?? "", BasNo = c.BasNo ?? "", BitNo = c.BitNo ?? "", Kablolar = (c.Kablolar ?? "").Trim('/'),
                    Zemin = c.Zemin ?? "", Durum = c.Durum ?? "", Hakedis = c.Hakedis,
                    Alt = c.AltGenislik, Ust = c.UstGenislik, Derinlik = c.Derinlik,
                };
                if (proje != null && s.Proje != proje) continue;
                if (hakedis > 0 && s.Hakedis != hakedis) continue;
                var z = KanalZemini.Coz(s.Zemin);
                if (z != null)
                {
                    s.Cins = KanalZemini.CinsAdi(z.Cins);
                    s.Kaplama = KanalZemini.OzelMi(z.Cins) ? "" : KanalZemini.KaplamaAdi(z.Kaplama);
                    s.Bariyerli = z.Bariyerli;
                    s.Trencher = z.Trencher;
                }
                else s.Cins = s.Zemin;
                var ana = c.Kalemler.Find(k => k.Ana);
                if (ana != null) { s.Uzunluk = ana.Miktar; s.Hacim = ana.Toplam; }
                else
                {
                    s.Uzunluk = Metraj.Kanal(c.CizimUzunlugu);
                    s.Hacim = Metraj.KanalHacmi(c.AltGenislik, c.UstGenislik, c.Derinlik, s.Uzunluk);
                }
                s.Uzunluk = SayiCoz.Temiz(s.Uzunluk, 2);
                s.Hacim = SayiCoz.Temiz(s.Hacim, 3);
                sirali.Add(new KeyValuePair<int, Satir>(i, s));
            }
            sirali.Sort((x, y) =>
            {
                int r = ProjeSirasi(x.Value.Proje, y.Value.Proje);
                if (r == 0) r = x.Value.Hakedis.CompareTo(y.Value.Hakedis);
                return r != 0 ? r : x.Key.CompareTo(y.Key);
            });
            foreach (var kv in sirali) Satirlar.Add(kv.Value);

            var tumu = new Toplam { Tumu = true };
            Toplam son = null;
            var ozet = new Dictionary<string, OzetSatiri>(StringComparer.Ordinal);
            foreach (var s in Satirlar)
            {
                if (son == null || son.Proje != s.Proje) { son = new Toplam { Proje = s.Proje, ProjeKodu = s.ProjeKodu }; Projeler.Add(son); }
                son.Adet++; son.Uzunluk += s.Uzunluk; son.Hacim += s.Hacim;
                tumu.Adet++; tumu.Uzunluk += s.Uzunluk; tumu.Hacim += s.Hacim;
                string a = s.Proje + "\u0001" + s.Zemin + "\u0001" + s.Durum;
                OzetSatiri o;
                if (!ozet.TryGetValue(a, out o)) { ozet[a] = o = new OzetSatiri { Proje = s.Proje, Zemin = s.Zemin, Durum = s.Durum }; Ozet.Add(o); }
                o.Adet++; o.Uzunluk += s.Uzunluk; o.Hacim += s.Hacim;
            }
            foreach (var t in Projeler) { t.Uzunluk = SayiCoz.Temiz(t.Uzunluk, 2); t.Hacim = SayiCoz.Temiz(t.Hacim, 3); }
            tumu.Uzunluk = SayiCoz.Temiz(tumu.Uzunluk, 2);
            tumu.Hacim = SayiCoz.Temiz(tumu.Hacim, 3);
            Projeler.Add(tumu);
            foreach (var o in Ozet) { o.Uzunluk = SayiCoz.Temiz(o.Uzunluk, 2); o.Hacim = SayiCoz.Temiz(o.Hacim, 3); }
            Ozet.Sort((x, y) =>
            {
                int r = ProjeSirasi(x.Proje, y.Proje);
                if (r == 0) r = string.CompareOrdinal(x.Zemin, y.Zemin);
                return r != 0 ? r : string.CompareOrdinal(x.Durum, y.Durum);
            });
        }

        /// <summary>Ortak deneme biçimi (telefondaki kanalListesi ile aynı alanlar ve sıra).</summary>
        public JsonNesne Json()
        {
            var o = new JsonNesne();
            var sl = new List<object>();
            foreach (var s in Satirlar)
            {
                var j = new JsonNesne();
                j["proje"] = s.Proje; j["projeKodu"] = s.ProjeKodu; j["kimlik"] = s.Kimlik; j["basNo"] = s.BasNo; j["bitNo"] = s.BitNo;
                j["kablolar"] = s.Kablolar; j["zemin"] = s.Zemin; j["cins"] = s.Cins; j["kaplama"] = s.Kaplama;
                j["bariyerli"] = s.Bariyerli; j["trencher"] = s.Trencher; j["durum"] = s.Durum; j["hakedis"] = s.Hakedis;
                j["alt"] = s.Alt; j["ust"] = s.Ust; j["derinlik"] = s.Derinlik; j["uzunluk"] = s.Uzunluk; j["hacim"] = s.Hacim;
                sl.Add(j);
            }
            o["satirlar"] = sl;
            var pl = new List<object>();
            foreach (var t in Projeler)
            {
                var j = new JsonNesne();
                j["proje"] = t.Proje; j["projeKodu"] = t.ProjeKodu; j["tumu"] = t.Tumu; j["adet"] = t.Adet; j["uzunluk"] = t.Uzunluk; j["hacim"] = t.Hacim;
                pl.Add(j);
            }
            o["projeler"] = pl;
            var ol = new List<object>();
            foreach (var x in Ozet)
            {
                var j = new JsonNesne();
                j["proje"] = x.Proje; j["zemin"] = x.Zemin; j["durum"] = x.Durum; j["adet"] = x.Adet; j["uzunluk"] = x.Uzunluk; j["hacim"] = x.Hacim;
                ol.Add(j);
            }
            o["ozet"] = ol;
            return o;
        }

        /// <summary>Excel sayfaları: KANAL LİSTESİ (satırlar, her projenin altında toplam) ve KANAL ÖZETİ (proje × zemin × durum).</summary>
        public void SayfalariEkle(XlsxYazici x, string olusturma)
        {
            var ks = x.SayfaEkle("KANAL LİSTESİ");
            ks.UstBilgi.Add("KANAL LİSTESİ (PROJE BAZINDA) — " + CizimAdi);
            ks.UstBilgi.Add(olusturma);
            ks.Basliklar.AddRange(new[] { "PROJE", "PROJE KODU", "BAŞ – BİT", "KABLOLAR", "CİNS", "KAPLAMA", "BARİYER", "TRENCHER",
                "ALT (cm)", "ÜST (cm)", "DERİNLİK (cm)", "UZUNLUK (m)", "HACİM (m³)", "DURUM", "HAK. NO", "KALEM ADI" });
            int i = 0;
            foreach (var t in Projeler)
            {
                if (t.Tumu) continue;
                for (; i < Satirlar.Count && Satirlar[i].Proje == t.Proje; i++)
                {
                    var s = Satirlar[i];
                    ks.Satirlar.Add(new object[] { t.GorunenAd, s.ProjeKodu, s.Numara, s.Kablolar, s.Cins, s.Kaplama, s.Bariyerli ? "Var" : "", s.Trencher ? "Var" : "",
                        s.Alt, s.Ust, s.Derinlik, s.Uzunluk, s.Hacim, s.Durum, s.Hakedis, s.Zemin });
                }
                ks.Satirlar.Add(new object[] { t.GorunenAd + " TOPLAMI", t.ProjeKodu, t.Adet + " kanal", "", "", "", "", "", "", "", "", t.Uzunluk, t.Hacim, "", "", "" });
            }
            var tumu = Projeler[Projeler.Count - 1];
            ks.Satirlar.Add(new object[] { "GENEL TOPLAM", "", tumu.Adet + " kanal", "", "", "", "", "", "", "", "", tumu.Uzunluk, tumu.Hacim, "", "", "" });
            ks.Genislikler[0] = 36; ks.Genislikler[1] = 22; ks.Genislikler[2] = 22; ks.Genislikler[4] = 22; ks.Genislikler[15] = 40;
            for (int c = 8; c <= 10; c++) ks.SayiBicimleri[c] = "0.##";
            ks.SayiBicimleri[11] = "#,##0.00"; ks.SayiBicimleri[12] = "#,##0.000"; ks.SayiBicimleri[14] = "0";

            var oz = x.SayfaEkle("KANAL ÖZETİ");
            oz.UstBilgi.Add("KANAL ÖZETİ (PROJE × ZEMİN × DURUM) — " + CizimAdi);
            oz.UstBilgi.Add(olusturma);
            oz.Basliklar.AddRange(new[] { "PROJE", "KALEM ADI", "CİNS · KAPLAMA", "DURUM", "PARÇA", "UZUNLUK (m)", "HACİM (m³)" });
            foreach (var o in Ozet)
                oz.Satirlar.Add(new object[] { o.Proje.Length == 0 ? ProjeOzeti.ProjesizAdi : o.Proje, o.Zemin, KanalZemini.YaziOf(o.Zemin), o.Durum, o.Adet, o.Uzunluk, o.Hacim });
            oz.Genislikler[0] = 36; oz.Genislikler[1] = 40; oz.Genislikler[2] = 34;
            oz.SayiBicimleri[4] = "0"; oz.SayiBicimleri[5] = "#,##0.00"; oz.SayiBicimleri[6] = "#,##0.000";
        }
    }
}
