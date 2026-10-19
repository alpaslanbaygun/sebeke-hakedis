using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Ortak proje dosyası (.sebeke.json). Telefon ve bilgisayar bu dosyayı okuyup yazar.
    /// Biçimin açıklaması: ortak/VERI-MODELI.md
    /// </summary>
    public static class ProjeDosyasi
    {
        public const string Bicim = "sebeke-hakedis.proje";
        public const int Surum = 1;
        public const string Uzanti = ".sebeke.json";
        /// <summary>Telefonun tam proje dosyası (ham veri + AutoCAD bölümü): biçim adı ve uzantısı.</summary>
        public const string VoltBicim = "volt-project/3";
        public const string VoltUzanti = ".volt.json";

        public static string Yaz(Proje p, string olusturan) => Json.Yaz(JsonYap(p, olusturan), true);

        /// <summary>
        /// Telefonun proje dosyası biçiminde yazar: AutoCAD bölümü ("sebeke") aynı projedir; telefon bu dosyayı da,
        /// .sebeke.json'u da açar. Ham telefon verisi ("data") çizimden üretilemez, boş bırakılır.
        /// </summary>
        public static string VoltYaz(Proje p, string olusturan)
        {
            var k = new JsonNesne();
            k["format"] = VoltBicim;
            k["exportedAt"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
            k["app"] = olusturan ?? "";
            var pj = new JsonNesne();
            pj["name"] = p.Ad;
            pj["code"] = "";
            var crs = new JsonNesne();
            crs["datum"] = "TUREF"; crs["projection"] = "TM3"; crs["cm"] = p.Dom;
            pj["crs"] = crs;
            k["project"] = pj;
            k["data"] = new JsonNesne();
            k["sebeke"] = JsonYap(p, olusturan);
            return Json.Yaz(k, true);
        }

        private static JsonNesne JsonYap(Proje p, string olusturan)
        {
            var k = new JsonNesne();
            k["bicim"] = Bicim;
            k["surum"] = Surum;
            k["olusturan"] = olusturan ?? "";
            k["olusturma"] = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:sszzz", CultureInfo.InvariantCulture);

            var pj = new JsonNesne();
            pj["ad"] = p.Ad;
            pj["kaynak"] = p.Kaynak;
            var kor = new JsonNesne();
            kor["sistem"] = p.KoordinatSistemi;
            kor["datum"] = p.Datum;
            kor["dom"] = p.Dom;
            kor["eksenler"] = "saga = doğu (CAD X), yukari = kuzey (CAD Y)";
            pj["koordinat"] = kor;
            pj["aktifHakedis"] = p.AktifHakedis;
            pj["katmanOnEki"] = p.KatmanOnEki;
            if (!string.IsNullOrEmpty(p.GisOnEki)) pj["gisOnEki"] = p.GisOnEki;
            var onaylar = new List<object>();
            foreach (var kv in p.Onaylar)
            {
                if ((kv.Value & 7) == 0) continue;
                var o = new JsonNesne();
                o["no"] = kv.Key;
                o["kontrol"] = (kv.Value & HakedisOnayi.Kontrol) != 0;
                o["hakedis"] = (kv.Value & HakedisOnayi.Hakedis) != 0;
                o["gis"] = (kv.Value & HakedisOnayi.Gis) != 0;
                onaylar.Add(o);
            }
            if (onaylar.Count > 0) pj["onaylar"] = onaylar;
            k["proje"] = pj;

            var bolgeler = new List<object>();
            foreach (var b in p.Bolgeler)
            {
                var o = new JsonNesne();
                o["id"] = b.Id; o["ad"] = b.Ad; o["kod"] = b.Kod;
                if (!string.IsNullOrEmpty(b.Grup)) o["grup"] = b.Grup;
                if (!string.IsNullOrEmpty(b.Aciklama)) o["aciklama"] = b.Aciklama;
                o["sinir"] = Koseler(b.Sinir);
                bolgeler.Add(o);
            }
            k["bolgeler"] = bolgeler;

            var noktalar = new List<object>();
            foreach (var n in p.Noktalar)
            {
                var o = new JsonNesne();
                o["id"] = n.Id; o["ad"] = n.Ad; o["kod"] = n.Kod;
                o["saga"] = Yuvarla(n.Saga); o["yukari"] = Yuvarla(n.Yukari); o["kot"] = Yuvarla(n.Kot);
                o["hakedis"] = n.Hakedis; o["bolge"] = n.Bolge;
                if (n.EkMetinler.Count > 0) o["ekMetinler"] = new List<object>(n.EkMetinler);
                if (!string.IsNullOrEmpty(n.TelefonId)) o["telefonId"] = n.TelefonId;
                noktalar.Add(o);
            }
            k["noktalar"] = noktalar;

            var elemanlar = new List<object>();
            foreach (var e in p.Elemanlar)
            {
                var o = new JsonNesne();
                o["id"] = e.Id; o["tur"] = e.Tur; o["gisId"] = e.GisId;
                o["cins"] = e.Cins; o["tip"] = e.Tip; o["durum"] = e.Durum;
                o["hakedis"] = e.Hakedis; o["bolge"] = e.Bolge;
                o["saga"] = Yuvarla(e.Saga); o["yukari"] = Yuvarla(e.Yukari);
                if (e.Kot != 0) o["kot"] = Yuvarla(e.Kot);
                o["aci"] = Math.Round(e.Aci, 6);
                if (!string.IsNullOrEmpty(e.Guc)) o["guc"] = e.Guc;
                if (!string.IsNullOrEmpty(e.Gerilim)) o["gerilim"] = e.Gerilim;
                if (!string.IsNullOrEmpty(e.DmDurum)) o["dmDurum"] = e.DmDurum;
                o["kontrol"] = e.Kontrol;
                o["katman"] = e.Katman; o["blok"] = e.Blok;
                o["kalemler"] = Kalemler(e.Kalemler);
                if (!string.IsNullOrEmpty(e.TelefonId)) o["telefonId"] = e.TelefonId;
                if (e.EkVeri.Count > 0)
                {
                    var ek = new JsonNesne();
                    foreach (var kv in e.EkVeri) ek[kv.Key] = new List<object>(kv.Value);
                    o["ekVeri"] = ek;
                }
                elemanlar.Add(o);
            }
            k["elemanlar"] = elemanlar;

            var hatlar = new List<object>();
            foreach (var h in p.Hatlar)
            {
                var o = new JsonNesne();
                o["id"] = h.Id; o["tur"] = h.Tur; o["anaKesit"] = h.AnaKesit;
                o["durum"] = h.Durum; o["hakedis"] = h.Hakedis; o["bolge"] = h.Bolge;
                o["cizimUzunlugu"] = Math.Round(h.CizimUzunlugu, 3);
                if (!string.IsNullOrEmpty(h.Etiket)) o["etiket"] = h.Etiket;
                o["kontrol"] = h.Kontrol; o["katman"] = h.Katman;
                o["kose"] = Koseler(h.Kose);
                o["kalemler"] = Kalemler(h.Kalemler);
                if (!string.IsNullOrEmpty(h.TelefonId)) o["telefonId"] = h.TelefonId;
                hatlar.Add(o);
            }
            k["hatlar"] = hatlar;

            var kanallar = new List<object>();
            foreach (var c in p.Kanallar)
            {
                var o = new JsonNesne();
                o["id"] = c.Id; o["kod"] = c.Kod; o["kablolar"] = c.Kablolar; o["zemin"] = c.Zemin;
                o["altGenislik"] = c.AltGenislik; o["ustGenislik"] = c.UstGenislik; o["derinlik"] = c.Derinlik;
                o["basNo"] = c.BasNo; o["bitNo"] = c.BitNo;
                o["durum"] = c.Durum; o["hakedis"] = c.Hakedis; o["bolge"] = c.Bolge;
                o["cizimUzunlugu"] = Math.Round(c.CizimUzunlugu, 3);
                o["kontrol"] = c.Kontrol;
                o["kose"] = Koseler(c.Kose);
                o["kalemler"] = Kalemler(c.Kalemler);
                if (!string.IsNullOrEmpty(c.TelefonId)) o["telefonId"] = c.TelefonId;
                kanallar.Add(o);
            }
            k["kanallar"] = kanallar;

            var sondajlar = new List<object>();
            foreach (var s in p.Sondajlar)
            {
                var o = new JsonNesne();
                o["id"] = s.Id; o["tip"] = s.Tip; o["durum"] = s.Durum; o["hakedis"] = s.Hakedis; o["bolge"] = s.Bolge;
                o["basNo"] = s.BasNo; o["bitNo"] = s.BitNo;
                o["cizimUzunlugu"] = Math.Round(s.CizimUzunlugu, 3);
                o["kontrol"] = s.Kontrol;
                o["kose"] = Koseler(s.Kose);
                o["kalemler"] = Kalemler(s.Kalemler);
                if (!string.IsNullOrEmpty(s.TelefonId)) o["telefonId"] = s.TelefonId;
                sondajlar.Add(o);
            }
            k["sondajlar"] = sondajlar;

            if (p.Hesaplar.Count > 0)
            {
                var hesaplar = new List<object>();
                foreach (var h in p.Hesaplar) hesaplar.Add(h.Json());
                k["hesaplar"] = hesaplar;
            }
            if (p.Uyarilar.Count > 0) k["uyarilar"] = new List<object>(p.Uyarilar);
            return k;
        }

        /// <summary>Metin telefonun tam proje dosyası mı (volt-project/…)?</summary>
        public static bool VoltDosyasiMi(string metin)
        {
            if (string.IsNullOrEmpty(metin)) return false;
            int i = metin.IndexOf("\"format\"", StringComparison.Ordinal);
            return i >= 0 && i < 400 && metin.IndexOf("volt-project/", i, StringComparison.Ordinal) > 0;
        }

        /// <summary>
        /// Proje dosyasını okur. İki biçim tanınır: AutoCAD proje dosyası (.sebeke.json) ve telefonun tam proje dosyası
        /// (.volt.json ya da teslim paketindeki PROJECT_INFO/project.json; AutoCAD bölümü "sebeke" okunur).
        /// </summary>
        public static Proje Oku(string metin)
        {
            var k = Json.Oku(metin) as JsonNesne;
            if (k != null && k.Metin("format").StartsWith("volt-project/", StringComparison.Ordinal))
            {
                var sb = k.Nesne("sebeke");
                if (sb == null) throw new FormatException("Telefonun proje dosyasında AutoCAD bölümü yok (eski sürümle yazılmış). Telefonda projeyi yeniden dışa aktarın (Dışa Aktar › AutoCAD proje dosyası).");
                k = sb;
            }
            if (k == null || k.Metin("bicim") != Bicim)
                throw new FormatException("Bu bir Şebeke-M proje dosyası değil.");
            if (k.Tam("surum") > Surum)
                throw new FormatException("Proje dosyası daha yeni bir sürümle hazırlanmış (" + k.Tam("surum") + "). Eklentiyi güncelleyin.");

            var p = new Proje();
            var pj = k.Nesne("proje") ?? new JsonNesne();
            p.Ad = pj.Metin("ad");
            p.Kaynak = pj.Metin("kaynak");
            var kor = pj.Nesne("koordinat");
            if (kor != null) { p.KoordinatSistemi = kor.Metin("sistem", "TM"); p.Datum = kor.Metin("datum", "ITRF96"); p.Dom = kor.Tam("dom"); }
            p.AktifHakedis = pj.Tam("aktifHakedis", 1);
            p.KatmanOnEki = pj.Metin("katmanOnEki");
            p.GisOnEki = pj.Metin("gisOnEki");
            foreach (var o in Nesneler(pj, "onaylar"))
            {
                int no = o.Tam("no");
                int b = (o.Mantik("kontrol") == true ? HakedisOnayi.Kontrol : 0) | (o.Mantik("hakedis") == true ? HakedisOnayi.Hakedis : 0) | (o.Mantik("gis") == true ? HakedisOnayi.Gis : 0);
                if (no > 0 && b != 0) p.Onaylar[no] = b;
            }

            foreach (var o in Nesneler(k, "bolgeler"))
            {
                var b = new Bolge { Id = o.Metin("id"), Ad = o.Metin("ad"), Kod = o.Metin("kod"), Grup = o.Metin("grup"), Aciklama = o.Metin("aciklama"), Sinir = KoseOku(o.Dizi("sinir")) };
                b.Alan = Geometri.Alan(b.Sinir);
                p.Bolgeler.Add(b);
            }
            foreach (var o in Nesneler(k, "noktalar"))
            {
                var n = new Nokta { Id = o.Metin("id"), Ad = o.Metin("ad"), Kod = o.Metin("kod"), Saga = o.Ondalik("saga"), Yukari = o.Ondalik("yukari"), Kot = o.Ondalik("kot"), Hakedis = o.Tam("hakedis"), Bolge = o.Metin("bolge"), TelefonId = o.Metin("telefonId") };
                var em = o.Dizi("ekMetinler");
                if (em != null) foreach (var m in em) n.EkMetinler.Add(Convert.ToString(m, CultureInfo.InvariantCulture));
                p.Noktalar.Add(n);
            }
            foreach (var o in Nesneler(k, "elemanlar"))
            {
                var e = new Eleman
                {
                    Id = o.Metin("id"), Tur = o.Metin("tur"), GisId = o.Metin("gisId"), Cins = o.Metin("cins"), Tip = o.Metin("tip"),
                    Durum = o.Metin("durum"), Hakedis = o.Tam("hakedis"), Bolge = o.Metin("bolge"),
                    Saga = o.Ondalik("saga"), Yukari = o.Ondalik("yukari"), Kot = o.Ondalik("kot"), Aci = o.Ondalik("aci"),
                    Guc = o.Metin("guc"), Gerilim = o.Metin("gerilim"), DmDurum = o.Metin("dmDurum"), Kontrol = o.Mantik("kontrol"),
                    Katman = o.Metin("katman"), Blok = o.Metin("blok"), Kalemler = KalemOku(o.Dizi("kalemler")), TelefonId = o.Metin("telefonId"),
                };
                var ek = o.Nesne("ekVeri");
                if (ek != null)
                    foreach (var kv in ek)
                    {
                        var d = kv.Value as List<object>;
                        if (d == null || Array.IndexOf(NesneYazici.EkUygulamalar, kv.Key) < 0) continue;
                        var l = new List<string>();
                        foreach (var x in d) l.Add(Convert.ToString(x, CultureInfo.InvariantCulture) ?? "");
                        if (l.Count > 0) e.EkVeri[kv.Key] = l;
                    }
                p.Elemanlar.Add(e);
            }
            foreach (var o in Nesneler(k, "hatlar"))
            {
                var h = new Hat
                {
                    Id = o.Metin("id"), Tur = o.Metin("tur"), AnaKesit = o.Metin("anaKesit"), Durum = o.Metin("durum"),
                    Hakedis = o.Tam("hakedis"), Bolge = o.Metin("bolge"), Etiket = o.Metin("etiket"), Kontrol = o.Mantik("kontrol"),
                    Katman = o.Metin("katman"), Kose = KoseOku(o.Dizi("kose")), Kalemler = KalemOku(o.Dizi("kalemler")), TelefonId = o.Metin("telefonId"),
                };
                h.CizimUzunlugu = Geometri.Uzunluk(h.Kose);
                p.Hatlar.Add(h);
            }
            foreach (var o in Nesneler(k, "kanallar"))
            {
                var c = new Kanal
                {
                    Id = o.Metin("id"), Kod = o.Tam("kod"), Zemin = o.Metin("zemin"),
                    AltGenislik = o.Ondalik("altGenislik"), UstGenislik = o.Ondalik("ustGenislik"), Derinlik = o.Ondalik("derinlik"),
                    BasNo = o.Metin("basNo"), BitNo = o.Metin("bitNo"), Durum = o.Metin("durum"), Hakedis = o.Tam("hakedis"),
                    Bolge = o.Metin("bolge"), Kontrol = o.Mantik("kontrol"), Kose = KoseOku(o.Dizi("kose")), Kalemler = KalemOku(o.Dizi("kalemler")), TelefonId = o.Metin("telefonId"),
                };
                c.CizimUzunlugu = Geometri.Uzunluk(c.Kose);
                p.Kanallar.Add(c);
            }
            foreach (var o in Nesneler(k, "sondajlar"))
            {
                var s = new Sondaj
                {
                    Id = o.Metin("id"), Tip = o.Metin("tip"), Durum = o.Metin("durum"), Hakedis = o.Tam("hakedis"), Bolge = o.Metin("bolge"),
                    BasNo = o.Metin("basNo"), BitNo = o.Metin("bitNo"), Kontrol = o.Mantik("kontrol"),
                    Kose = KoseOku(o.Dizi("kose")), Kalemler = KalemOku(o.Dizi("kalemler")), TelefonId = o.Metin("telefonId"),
                };
                s.CizimUzunlugu = Geometri.Uzunluk(s.Kose);
                p.Sondajlar.Add(s);
            }
            // Teknik hesap sonuçları (Hesap Merkezi)
            var hesapKimlikleri = new HashSet<string>(StringComparer.Ordinal);
            foreach (var o in Nesneler(k, "hesaplar"))
            {
                var h = HesapKaydi.Oku(o);
                if (h != null && hesapKimlikleri.Add(h.Id)) p.Hesaplar.Add(h);
            }
            return p;
        }

        // ---------------- Yardımcılar ----------------

        private static List<object> Kalemler(List<Kalem> kalemler)
        {
            var l = new List<object>();
            foreach (var x in kalemler)
            {
                var o = new JsonNesne();
                o["cins"] = x.Cins; o["tanim"] = x.Tanim;
                if (!string.IsNullOrEmpty(x.Aciklama)) o["aciklama"] = x.Aciklama;
                o["durum"] = x.Durum;
                o["miktar"] = x.Miktar; o["birim"] = x.Birim; o["katsayi"] = x.Katsayi; o["toplam"] = x.Toplam;
                o["birimFiyat"] = x.BirimFiyat; o["hakedis"] = x.Hakedis; o["tarife"] = x.Tarife;
                if (!string.IsNullOrEmpty(x.DmDurum)) o["dmDurum"] = x.DmDurum;
                o["sira"] = x.Sira;
                o["kontrol"] = x.Kontrol;
                if (x.Ana) o["ana"] = true;
                o["kaynak"] = x.Kaynak;
                l.Add(o);
            }
            return l;
        }

        private static List<Kalem> KalemOku(List<object> dizi)
        {
            var l = new List<Kalem>();
            if (dizi == null) return l;
            foreach (var d in dizi)
            {
                var o = d as JsonNesne;
                if (o == null) continue;
                l.Add(new Kalem
                {
                    Cins = o.Metin("cins"), Tanim = o.Metin("tanim"), Aciklama = o.Metin("aciklama"), Durum = o.Metin("durum"),
                    Miktar = o.Ondalik("miktar"), Birim = o.Metin("birim"), Katsayi = o.Ondalik("katsayi", 1), Toplam = o.Ondalik("toplam"),
                    BirimFiyat = o.Ondalik("birimFiyat"), Hakedis = o.Tam("hakedis"), Tarife = o.Metin("tarife"),
                    DmDurum = o.Metin("dmDurum"), Sira = o.Metin("sira"), Kontrol = o.Mantik("kontrol"),
                    Ana = o.Mantik("ana") ?? false, Kaynak = o.Metin("kaynak"),
                });
            }
            return l;
        }

        private static List<object> Koseler(List<double[]> kose)
        {
            var l = new List<object>();
            foreach (var p in kose) l.Add(new List<object> { Yuvarla(p[0]), Yuvarla(p[1]) });
            return l;
        }

        private static List<double[]> KoseOku(List<object> dizi)
        {
            var l = new List<double[]>();
            if (dizi == null) return l;
            foreach (var d in dizi)
                if (d is List<object> p && p.Count >= 2)
                    l.Add(new[] { Convert.ToDouble(p[0], CultureInfo.InvariantCulture), Convert.ToDouble(p[1], CultureInfo.InvariantCulture) });
            return l;
        }

        private static IEnumerable<JsonNesne> Nesneler(JsonNesne k, string ad)
        {
            var d = k.Dizi(ad);
            if (d == null) yield break;
            foreach (var x in d) if (x is JsonNesne o) yield return o;
        }

        private static double Yuvarla(double d) => Math.Round(d, 4);
    }
}
