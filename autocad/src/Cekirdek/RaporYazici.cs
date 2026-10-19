using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Durum Tespit raporunu Excel dosyası olarak yazar (AutoCAD raporuyla aynı sayfa ve sütunlar).</summary>
    public static class RaporYazici
    {
        public static void Yaz(Proje p, string yol, string surum, Katsayilar k = null, ProjeBilgisi bilgi = null)
        {
            k = k ?? Katsayilar.Varsayilan;
            var dt = new DurumTespit(p, k);
            var x = new XlsxYazici();

            // 1) ÖZET
            var oz = x.SayfaEkle("ÖZET");
            oz.UstBilgi.Add("DURUM TESPİT ÖZETİ — " + p.Ad);
            oz.UstBilgi.Add("Kaynak: " + p.Kaynak + "   ·   Oluşturma: " + DateTime.Now.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture) + "   ·   Şebeke-M " + surum);
            var onaylar = HakedisOnayi.Ozet(p.Onaylar);
            if (onaylar.Count > 0) oz.UstBilgi.Add("Hakediş onayları: " + string.Join("   ·   ", onaylar.ToArray()));
            oz.Basliklar.AddRange(new[] { "PROJE", "PROJE KODU", "HAK. NO", "DURUM", "CİNS", "TİP", "BİRİM", "MİKTAR", "TOP. MİK.", "TOP. TL.", "SATIR" });
            var kodlar = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var b in p.Bolgeler) kodlar[b.Ad] = b.Kod;
            foreach (var o in dt.Ozet())
            {
                string kod; kodlar.TryGetValue(o.Proje, out kod);
                oz.Satirlar.Add(new object[] { o.Proje, kod ?? "", o.Hakedis, o.Durum, o.Cins, o.Tip, o.Birim, o.Miktar, o.Toplam, o.Tutar, o.SatirSayisi });
            }
            oz.Genislikler[0] = 60; oz.SayiBicimleri[2] = "0"; oz.SayiBicimleri[9] = "0.00"; oz.SayiBicimleri[10] = "0";

            // 2) DURUM TESPİT
            var d = x.SayfaEkle("DURUM TESPİT");
            d.Basliklar.AddRange(new[] { "HANDLE", "PROJE", "CİNS", "TİP", "DURUM", "BİRM F.", "MİKTAR", "BİRİM", "METRİK A.", "TOP. MİK.", "TOP. TL.", "HAK. NO", "BÖL.TARİFE", "MLZ.TARİFE", "DM DRM", "INDEX", "KONTROL" });
            foreach (var s in dt.Satirlar)
                d.Satirlar.Add(new object[] { s.Handle, s.Proje, s.Cins, s.Tip, s.Durum, s.BirimFiyat, s.Miktar, s.Birim, s.Katsayi, s.Toplam, s.Tutar, s.Hakedis, s.BolgeTarife, s.MalzemeTarife, s.DmDurum, Sayi(s.Index), s.Kontrol });
            d.Genislikler[1] = 50; d.SayiBicimleri[11] = "0"; d.SayiBicimleri[10] = "0.00"; d.SayiBicimleri[15] = "0";

            // 3) ANA MALZEME
            var a = x.SayfaEkle("ANA MALZEME");
            a.Basliklar.AddRange(new[] { "HANDLE", "PROJE", "SIRA", "GIS ID", "CİNS", "TİP", "DURUM", "BİRM F.", "MİKTAR", "BİRİM", "METRİK A.", "TOP. MİK.", "TOP. TL.", "HAK. NO", "BÖL.TARİFE", "MLZ.TARİFE", "DM DRM", "INDEX", "KONTROL" });
            foreach (var e in p.Elemanlar)
            {
                var ana = e.Kalemler.Find(z => z.Ana) ?? new Kalem();
                a.Satirlar.Add(new object[] { e.Id, dt.ProjeAdi(e.Bolge), e.Id, e.GisId, ana.Cins, ana.Tanim, ana.Durum, ana.BirimFiyat, ana.Miktar, ana.Birim, ana.Katsayi, ana.Toplam, SayiCoz.Temiz(ana.ToplamTutar, 2), ana.Hakedis, dt.ProjeKodu(e.Bolge), ana.Tarife, string.IsNullOrEmpty(ana.DmDurum) ? "Standart" : ana.DmDurum, Sayi(ana.Sira), DurumTespit.KontrolMetni(e.Kontrol) });
            }
            a.Genislikler[1] = 50; a.SayiBicimleri[13] = "0"; a.SayiBicimleri[17] = "0";

            // 4) HAT VE İLETKENLER
            var h = x.SayfaEkle("HAT VE İLETKENLER");
            h.Basliklar.AddRange(new[] { "HANDLE", "PROJE", "GIS UZ.", "FARK", "CİNS", "TİP", "DURUM", "BİRM F.", "MİKTAR", "BİRİM", "METRİK A.", "TOP. MİK.", "TOP. TL.", "HAK. NO", "BÖL.TARİFE", "TARİFE", "INDEX", "KONTROL" });
            foreach (var hat in p.Hatlar)
                foreach (var kl in hat.Kalemler)
                {
                    if (kl.Kaynak != "HAT") continue;
                    double gis = Math.Round(hat.CizimUzunlugu, 2);
                    h.Satirlar.Add(new object[] { hat.Id, dt.ProjeAdi(hat.Bolge), gis, Math.Round(kl.Miktar - gis, 2), kl.Cins, kl.Tanim, kl.Durum, kl.BirimFiyat, kl.Miktar, kl.Birim, kl.Katsayi, kl.Toplam, SayiCoz.Temiz(kl.ToplamTutar, 2), kl.Hakedis, dt.ProjeKodu(hat.Bolge), kl.Tarife, Sayi(kl.Sira), DurumTespit.KontrolMetni(kl.Kontrol) });
                }
            h.Genislikler[1] = 50; h.SayiBicimleri[2] = "0.00"; h.SayiBicimleri[3] = "0.00"; h.SayiBicimleri[13] = "0"; h.SayiBicimleri[16] = "0";

            // 5) KANALLAR
            var kn = x.SayfaEkle("KANALLAR");
            kn.Basliklar.AddRange(new[] { "HANDLE", "PROJE", "BAŞ. NO", "BİT. NO", "ALT G.", "ÜST G.", "DERİNLİK", "UZUNLUK", "GIS UZ.", "FARK", "CİNS", "TİP", "DURUM", "BİRM F.", "UZUNLUK", "BİRİM", "METRİK A.", "HACİM (m3)", "TOP. TL.", "HAK. NO", "BÖL.TARİFE", "TARİFE", "INDEX", "KONTROL" });
            foreach (var c in p.Kanallar)
            {
                var kl = c.Kalemler.Find(z => z.Ana) ?? new Kalem();
                double gis = Math.Round(c.CizimUzunlugu, 2);
                kn.Satirlar.Add(new object[] { c.Id, dt.ProjeAdi(c.Bolge), c.BasNo, c.BitNo, c.AltGenislik, c.UstGenislik, c.Derinlik, kl.Miktar, gis, Math.Round(kl.Miktar - gis, 2), c.Kablolar, c.Zemin, c.Durum, kl.BirimFiyat, kl.Miktar, kl.Birim, kl.Katsayi, kl.Toplam, SayiCoz.Temiz(kl.ToplamTutar, 2), kl.Hakedis, dt.ProjeKodu(c.Bolge), kl.Tarife, Sayi(kl.Sira), DurumTespit.KontrolMetni(c.Kontrol ?? kl.Kontrol) });
            }
            kn.Genislikler[1] = 50; kn.SayiBicimleri[8] = "0.00"; kn.SayiBicimleri[9] = "0.00"; kn.SayiBicimleri[19] = "0"; kn.SayiBicimleri[22] = "0";

            // 6) SONDAJ
            var sj = x.SayfaEkle("SONDAJ");
            sj.Basliklar.AddRange(new[] { "HANDLE", "PROJE", "BAŞ. NO", "BİT. NO", "GIS UZ.", "FARK", "CİNS", "TİP", "DURUM", "BİRM F.", "UZUNLUK (mt)", "BİRİM", "METRİK A.", "TOP UZUNLUK (mt)", "TOP. TL.", "HAK. NO", "BÖL.TARİFE", "TARİFE", "INDEX", "KONTROL" });
            foreach (var s in p.Sondajlar)
            {
                var kl = s.Kalemler.Find(z => z.Ana) ?? new Kalem();
                double gis = Math.Round(s.CizimUzunlugu, 2);
                sj.Satirlar.Add(new object[] { s.Id, dt.ProjeAdi(s.Bolge), s.BasNo, s.BitNo, gis, Math.Round(kl.Miktar - gis, 2), kl.Cins, kl.Tanim, kl.Durum, kl.BirimFiyat, kl.Miktar, kl.Birim, kl.Katsayi, kl.Toplam, SayiCoz.Temiz(kl.ToplamTutar, 2), kl.Hakedis, dt.ProjeKodu(s.Bolge), kl.Tarife, Sayi(kl.Sira), DurumTespit.KontrolMetni(s.Kontrol ?? kl.Kontrol) });
            }
            sj.Genislikler[1] = 50;

            // 7) GPS
            var g = x.SayfaEkle("GPS");
            g.Basliklar.AddRange(new[] { "HANDLE", "X KOOR (sağa)", "Y KOOR (yukarı)", "Z KOOR", "PROJE", "HAK.NO", "METIN 1", "METIN 2", "METIN 3", "METIN 4", "METIN 5", "METIN 6" });
            foreach (var n in p.Noktalar)
            {
                var r = new object[12];
                r[0] = n.Id; r[1] = Math.Round(n.Saga, 3); r[2] = Math.Round(n.Yukari, 3); r[3] = Math.Round(n.Kot, 3);
                r[4] = dt.ProjeAdi(n.Bolge); r[5] = n.Hakedis; r[6] = n.Ad; r[7] = n.Kod;
                for (int i = 0; i < n.EkMetinler.Count && i < 4; i++) r[8 + i] = n.EkMetinler[i];
                g.Satirlar.Add(r);
            }
            g.Genislikler[4] = 50; g.SayiBicimleri[1] = "0.00"; g.SayiBicimleri[2] = "0.00"; g.SayiBicimleri[3] = "0.00"; g.SayiBicimleri[5] = "0";

            // 8) KATSAYILAR
            KatsayiSayfasi(x.SayfaEkle("KATSAYILAR"), k);

            // 9) DETAY: her elemanın ara malzemeleri satır satır (ara malzemesi olmayan eleman tek satır)
            DetaySayfasi(x.SayfaEkle("DETAY"), DetaySorgu.Sorgula(p, new DetayFiltresi(), dt));

            // 10) HESAPLAR: teknik hesap sonuçları (Hesap Merkezi), güncellik bugünkü çizime göre
            if (p.Hesaplar.Count > 0) HesapSayfasi(x.SayfaEkle("HESAPLAR"), p, bilgi);

            // 11) UYARILAR
            if (p.Uyarilar.Count > 0)
            {
                var u = x.SayfaEkle("UYARILAR");
                u.Basliklar.Add("UYARI");
                foreach (var m in p.Uyarilar) u.Satirlar.Add(new object[] { m });
                u.Genislikler[0] = 120;
            }

            x.Kaydet(yol);
        }

        /// <summary>
        /// Teknik hesaplar sayfası: hesap, hedef, sonuç özeti, durum, güncellik (hesaptan sonra değişen bilgiler),
        /// kullanılan girdiler, sonuç değerleri ve uyarılar.
        /// </summary>
        public static void HesapSayfasi(XlsxYazici.Sayfa s, Proje p, ProjeBilgisi bilgi)
        {
            s.UstBilgi.Add("TEKNİK HESAPLAR — " + p.Ad);
            s.UstBilgi.Add("Hesap araçları: Elektrik-Elektronik Mühendisi Baki SONAY (formüller değiştirilmeden Şebeke-M'e eklenmiştir). Güncellik: hesap kaydedildikten sonra hesabın kullandığı bir proje bilgisi değiştiyse \"GÜNCEL DEĞİL\".");
            s.Basliklar.AddRange(new[] { "HESAP", "HEDEF", "HEDEF NO", "SONUÇ", "DURUM", "GÜNCELLİK", "GİRDİLER", "DEĞERLER", "UYARILAR", "TARİH", "KAYNAK", "YAPAN", "KİMLİK" });
            var sirali = new List<HesapKaydi>(p.Hesaplar);
            sirali.Sort((a, b) => string.CompareOrdinal(b.Tarih, a.Tarih));
            foreach (var h in sirali)
            {
                string guncellik;
                bool hedefYok;
                var fark = HesapGuncellik.Durum(p, h, bilgi, "autocad", out hedefYok);
                if (hedefYok) guncellik = "HEDEF SİLİNMİŞ";
                else
                {
                    if (fark.Count == 0) guncellik = "Güncel";
                    else
                    {
                        var l = new List<string>();
                        foreach (var f in fark) { if (l.Count >= 6) { l.Add("…"); break; } l.Add(f.ToString()); }
                        guncellik = "GÜNCEL DEĞİL: " + string.Join("; ", l.ToArray());
                    }
                }
                string tarih = h.Tarih;
                DateTime t;
                if (DateTime.TryParse(h.Tarih, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out t)) tarih = t.ToLocalTime().ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture);
                string hedefAdi = h.HedefTur == "direk" ? "Direk" : h.HedefTur == "hat" ? "Hat" : h.HedefTur == "trafo" ? "Trafo" : h.HedefTur == "kanal" ? "Kanal" : "Proje";
                s.Satirlar.Add(new object[] { string.IsNullOrEmpty(h.ModulAdi) ? h.Modul : h.ModulAdi, hedefAdi, h.HedefNo, h.Ozet, HesapKaydi.DurumAdi(h.Durum), guncellik,
                    string.Join("; ", h.Satirlar("girdiler").ToArray()), string.Join("; ", h.Satirlar("degerler").ToArray()), string.Join("; ", h.Satirlar("uyarilar").ToArray()),
                    tarih, h.Kaynak == "telefon" ? "Telefon" : "AutoCAD", h.Yapan, h.Id });
            }
            s.Genislikler[0] = 30; s.Genislikler[2] = 18; s.Genislikler[3] = 70; s.Genislikler[5] = 40; s.Genislikler[6] = 60; s.Genislikler[7] = 70; s.Genislikler[8] = 50;
        }

        /// <summary>Yalnız eksik malzeme sorgusunun sonucunu yazar (SH_DETAY).</summary>
        public static void DetayYaz(Proje p, List<DetaySatiri> satirlar, string yol, string surum, string aciklama)
        {
            var x = new XlsxYazici();
            var s = x.SayfaEkle("DETAY");
            s.UstBilgi.Add("EKSİK MALZEME SORGUSU — " + p.Ad);
            s.UstBilgi.Add((aciklama ?? "") + "   ·   Oluşturma: " + DateTime.Now.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture) + "   ·   Şebeke-M " + surum);
            DetaySayfasi(s, satirlar);
            x.Kaydet(yol);
        }

        private static void DetaySayfasi(XlsxYazici.Sayfa s, List<DetaySatiri> satirlar)
        {
            s.Basliklar.AddRange(DetaySorgu.Basliklar);
            foreach (var r in satirlar) s.Satirlar.Add(DetaySorgu.Satir(r));
            s.Genislikler[1] = 50; s.SayiBicimleri[15] = "0.00"; s.SayiBicimleri[16] = "0"; s.SayiBicimleri[19] = "0";
        }

        private static void KatsayiSayfasi(XlsxYazici.Sayfa s, Katsayilar k)
        {
            s.Filtre = false;
            s.Basliklar.AddRange(new[] { "TABLO", "ANAHTAR", "OG", "AG", "AYD", "REK", "", "" });
            s.Satirlar.Add(new object[] { "HAT TARİFESİ", "", k.TarifeOG, k.TarifeAG, k.TarifeAYD, k.TarifeREK });
            foreach (var kv in k.KanalPaylasim)
                s.Satirlar.Add(new object[] { "KANAL PAYLAŞIM", kv.Key, kv.Value[0], kv.Value[1], kv.Value[2], kv.Value[3] });
            s.Satirlar.Add(new object[] { "KANAL KODU", "REK 1 + AYD 2 + AG 4 + OG 8" });
            for (int i = 0; i < k.AgIletkenAdlari.Length; i++)
                s.Satirlar.Add(new object[] { "AG İLETKEN kg/m", k.AgIletkenAdlari[i], k.AgIletkenAgirlik[i] });
            for (int i = 0; i < k.OgIletkenAdlari.Length; i++)
                s.Satirlar.Add(new object[] { "OG İLETKEN kg/m", k.OgIletkenAdlari[i], k.OgIletkenAgirlik[i] });
            foreach (var kv in k.AgIletkenAcilim)
                s.Satirlar.Add(new object[] { "AG İLETKEN AÇILIMI", kv.Key, Acilim(kv.Value, k.AgIletkenAdlari) });
            foreach (var kv in k.OgIletkenAcilim)
                s.Satirlar.Add(new object[] { "OG İLETKEN AÇILIMI", kv.Key, Acilim(kv.Value, k.OgIletkenAdlari) });
            s.Genislikler[0] = 22; s.Genislikler[1] = 28; s.Genislikler[2] = 30;
        }

        private static string Acilim(int[] teller, string[] adlar)
        {
            var l = new List<string>();
            for (int i = 0; i < adlar.Length; i++) if (teller[i] != 0) l.Add(teller[i] + " " + adlar[i]);
            return string.Join(" + ", l.ToArray());
        }

        private static object Sayi(string s)
        {
            long n;
            return long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out n) ? (object)n : (s ?? "");
        }
    }
}
