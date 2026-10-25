using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// AutoCAD eklentisiyle hazırlanmış bir çizimi ortak proje modeline çevirir.
    /// AutoCAD veriyi nesnelerin genişletilmiş verisinde (XDATA) tutar:
    ///   GIS      kimlik;GIS no;cins;tip;durum[;güç;gerilim]   (kanalda: baş;bit;uzunluk;derinlik;alt;üst)
    ///   NIT      nesnenin kendi pozu
    ///   MALZEME  nesneye bağlı malzeme satırları
    ///   HAT      hat satırı (tanımdan sonra ikinci bir iletken alanı vardır)
    ///   KONTROL  True/False, ANAKESIT iletken, ETK etiket yazısının tanıtıcısı
    ///   FULLREG  bölge sınırı: proje adı;proje kodu
    ///   HAKNO, ZKOORD  GPS noktasının hakedişi ve kotu
    /// </summary>
    public static class NesneOkuyucu
    {
        private static readonly Regex HakedisKatmani = new Regex(@"^(?<on>.+?)_(?<hak>\d+)\.HAK\.(?<tur>.+)$", RegexOptions.CultureInvariant);
        private static readonly Regex OzelKatman = new Regex(@"^(?<on>.+?)_(?<ozel>DEMONTAJ|MEVCUT|STANDART|KABLO_KANALI|YATAY_SONDAJ|PROJE)$", RegexOptions.CultureInvariant);

        public static bool SebekeCizimiMi(IEnumerable<CadVarlik> varliklar)
        {
            foreach (var v in varliklar)
                if (Dolu(v, "NIT") || Dolu(v, "FULLREG") || Dolu(v, "HAT")) return true;
            return false;
        }

        /// <summary>
        /// Uygulamanın en az bir değeri var mı. Yalnız adı yazılmış boş bölüm (AutoCAD'de eski değeri silmek için
        /// yazılır; ör. GPS noktasındaki boş NIT) sayılmaz; yoksa GPS noktası eleman sanılır.
        /// </summary>
        private static bool Dolu(CadVarlik v, string uygulama)
        {
            List<string> l;
            return v.Xd.TryGetValue(uygulama, out l) && l != null && l.Count > 0;
        }

        public static Proje Oku(IList<CadVarlik> varliklar, string kaynakAdi)
        {
            var p = new Proje { Kaynak = kaynakAdi ?? "", Ad = DosyaAdi(kaynakAdi) };
            var tanitici = new Dictionary<string, CadVarlik>(StringComparer.OrdinalIgnoreCase);
            foreach (var v in varliklar) if (!string.IsNullOrEmpty(v.H)) tanitici[v.H] = v;

            var onEkler = new Dictionary<string, int>(StringComparer.Ordinal);

            // 1) Bölgeler
            foreach (var v in varliklar)
            {
                var fr = v.XdIlk("FULLREG");
                if (fr == null || !v.CizgiMi) continue;
                var f = fr.Split(';');
                var b = new Bolge { Id = v.H, Ad = Alan(f, 0).Trim(), Kod = Alan(f, 1).Trim(), Grup = Alan(f, 2).Trim() };
                foreach (var k in v.Kose) b.Sinir.Add(new[] { k[0], k[1] });
                b.Alan = Geometri.Alan(b.Sinir);
                p.Bolgeler.Add(b);
            }

            foreach (var v in varliklar)
            {
                string katmanTuru, onEk; int katmanHakedis;
                KatmanCoz(v.Katman, out onEk, out katmanTuru, out katmanHakedis);
                if (!string.IsNullOrEmpty(onEk)) { int c; onEkler.TryGetValue(onEk, out c); onEkler[onEk] = c + 1; }

                try
                {
                    if (v.Tur == "INSERT" && Dolu(v, "HAKNO") && !Dolu(v, "NIT"))
                        p.Noktalar.Add(NoktaOku(v));
                    else if (v.Tur == "INSERT" && Dolu(v, "NIT"))
                        p.Elemanlar.Add(ElemanOku(v, katmanTuru, katmanHakedis));
                    else if (v.CizgiMi && Dolu(v, "HAT"))
                        p.Hatlar.Add(HatOku(v, katmanTuru, katmanHakedis, tanitici));
                    else if (v.CizgiMi && Dolu(v, "NIT") && katmanTuru == "KABLO_KANALI")
                        p.Kanallar.Add(KanalOku(v));
                    else if (v.CizgiMi && Dolu(v, "NIT") && katmanTuru == "YATAY_SONDAJ")
                        p.Sondajlar.Add(SondajOku(v));
                    else if (v.CizgiMi && Dolu(v, "NIT"))
                        p.Uyarilar.Add("Tanınmayan çizgi nesnesi atlandı: " + v.H + " (" + v.Katman + ")");
                }
                catch (Exception ex)
                {
                    p.Uyarilar.Add("Nesne okunamadı: " + v.H + " (" + v.Katman + "): " + ex.Message);
                }
            }

            // Katman ön eki (ör. SC)
            int enCok = 0;
            foreach (var kv in onEkler) if (kv.Value > enCok) { enCok = kv.Value; p.KatmanOnEki = kv.Key; }

            BolgeleriAta(p);

            int enBuyuk = 0;
            foreach (var e in p.Elemanlar) enBuyuk = Math.Max(enBuyuk, e.Hakedis);
            foreach (var h in p.Hatlar) enBuyuk = Math.Max(enBuyuk, h.Hakedis);
            foreach (var k in p.Kanallar) enBuyuk = Math.Max(enBuyuk, k.Hakedis);
            p.AktifHakedis = Math.Max(1, enBuyuk);
            return p;
        }

        /// <summary>Her nesneye bulunduğu bölgeyi yazar (içinde kaldığı en küçük bölge, yoksa en yakını).</summary>
        public static void BolgeleriAta(Proje p)
        {
            if (p.Bolgeler.Count == 0) return;
            foreach (var n in p.Noktalar) n.Bolge = Id(Geometri.BolgeSec(new[] { n.Saga, n.Yukari }, p.Bolgeler));
            foreach (var e in p.Elemanlar) e.Bolge = Id(Geometri.BolgeSec(new[] { e.Saga, e.Yukari }, p.Bolgeler));
            foreach (var h in p.Hatlar) h.Bolge = Id(Geometri.BolgeSec(Geometri.OrtaNokta(h.Kose), p.Bolgeler));
            foreach (var k in p.Kanallar) k.Bolge = Id(Geometri.BolgeSec(Geometri.OrtaNokta(k.Kose), p.Bolgeler));
            foreach (var s in p.Sondajlar) s.Bolge = Id(Geometri.BolgeSec(Geometri.OrtaNokta(s.Kose), p.Bolgeler));
        }

        private static string Id(Bolge b) => b == null ? "" : b.Id;

        // ---------------- Nesne türleri ----------------

        private static Nokta NoktaOku(CadVarlik v)
        {
            var n = new Nokta
            {
                Id = v.H,
                Ad = (v.OzDeger("METIN1") ?? "").Trim(),
                Kod = (v.OzDeger("METIN2") ?? "").Trim(),
                Saga = v.X,
                Yukari = v.Y,
                Kot = SayiCoz.Coz(v.XdIlk("ZKOORD"), v.Z),
                Hakedis = SayiCoz.Tam(v.XdIlk("HAKNO")),
                TelefonId = v.XdIlk(NesneYazici.KimlikUygulamasi) ?? "",
            };
            for (int i = 3; i <= 6; i++)
            {
                var m = v.OzDeger("METIN" + i);
                if (!string.IsNullOrWhiteSpace(m)) n.EkMetinler.Add(m.Trim());
            }
            return n;
        }

        private static Eleman ElemanOku(CadVarlik v, string katmanTuru, int katmanHakedis)
        {
            var gis = (v.XdIlk("GIS") ?? "").Split(';');
            var e = new Eleman
            {
                Id = v.H,
                GisId = Alan(gis, 1),
                Saga = v.X,
                Yukari = v.Y,
                Kot = v.Z,
                Aci = v.Aci,
                Guc = Alan(gis, 5).Trim(),
                Gerilim = Alan(gis, 6).Trim(),
                Kontrol = Mantik(v.XdIlk("KONTROL")),
                Katman = v.Katman,
                Blok = v.Blok,
                TelefonId = v.XdIlk(NesneYazici.KimlikUygulamasi) ?? "",
            };
            if (string.IsNullOrEmpty(e.GisId)) e.GisId = (v.OzDeger("GIS_ID") ?? "").Trim();
            if (string.IsNullOrEmpty(e.Guc)) e.Guc = (v.OzDeger("GÜÇ") ?? "").Trim();
            if (string.IsNullOrEmpty(e.Gerilim)) e.Gerilim = (v.OzDeger("GERİLİM") ?? "").Trim();

            foreach (var u in NesneYazici.EkUygulamalar)
            {
                var l = v.XdHepsi(u);
                if (l.Count > 0) e.EkVeri[u] = new List<string>(l);
            }
            var ana = AnaKalemOku(v.XdIlk("NIT"));
            ana.Kontrol = e.Kontrol;
            e.Kalemler.Add(ana);
            foreach (var m in v.XdHepsi("MALZEME"))
                if (!string.IsNullOrWhiteSpace(m)) e.Kalemler.Add(MalzemeOku(m));

            e.Cins = ana.Cins;
            e.Tip = ana.Tanim;
            e.Durum = ana.Durum;
            e.DmDurum = ana.DmDurum;
            e.Hakedis = ana.Hakedis > 0 ? ana.Hakedis : katmanHakedis;
            if (string.IsNullOrEmpty(e.Cins)) { e.Cins = Alan(gis, 2); e.Tip = Alan(gis, 3); e.Durum = Alan(gis, 4); }
            e.Tur = ElemanTuru(e.Cins);
            return e;
        }

        private static Hat HatOku(CadVarlik v, string katmanTuru, int katmanHakedis, Dictionary<string, CadVarlik> tanitici)
        {
            var h = new Hat
            {
                Id = v.H,
                Katman = v.Katman,
                Kontrol = Mantik(v.XdIlk("KONTROL")),
                AnaKesit = (v.XdIlk("ANAKESIT") ?? "").Trim(),
                TelefonId = v.XdIlk(NesneYazici.KimlikUygulamasi) ?? "",
            };
            foreach (var k in v.Kose) h.Kose.Add(new[] { k[0], k[1] });
            h.CizimUzunlugu = Geometri.Uzunluk(h.Kose);
            var satirlar = v.XdHepsi("HAT").FindAll(x => !string.IsNullOrWhiteSpace(x));
            foreach (var s in satirlar)
            {
                var kl = HatKalemiOku(s);
                int adet;
                string ic;
                // Adetli yazım (çoklu iletken, telefondaki gibi): "3x(3X50/16+70 ALPEK)" → tip iç kesit, tam yazım korunur
                if (Iletkenler.AdetliMi(kl.Tanim, out adet, out ic))
                {
                    kl.Aciklama = kl.Tanim;
                    kl.Tanim = ic;
                }
                // Raporda hat satırının tipi ana kesittir (ör. "3(1x150/25) Xlpe" yerine "1x150/25 Xlpe"). Çok satırlı hatta
                // (birden çok iletken) yalnız ana kesitin bir yazımı olan satır (ana kesiti içeren) değişir; diğer iletkenler
                // kendi tipiyle kalır.
                else if (!string.IsNullOrEmpty(h.AnaKesit) && kl.Tanim != h.AnaKesit && (satirlar.Count == 1 || Iletkenler.Iceriyor(kl.Tanim, h.AnaKesit)))
                {
                    kl.Aciklama = kl.Tanim;
                    kl.Tanim = h.AnaKesit;
                }
                h.Kalemler.Add(kl);
            }
            foreach (var m in v.XdHepsi("MALZEME"))
                if (!string.IsNullOrWhiteSpace(m)) h.Kalemler.Add(MalzemeOku(m));
            var ilk = h.Kalemler.Count > 0 ? h.Kalemler[0] : new Kalem();
            h.Durum = ilk.Durum;
            h.Hakedis = ilk.Hakedis > 0 ? ilk.Hakedis : katmanHakedis;
            if (string.IsNullOrEmpty(h.AnaKesit)) h.AnaKesit = ilk.Tanim;
            h.Tur = HatTuru(katmanTuru, ilk.Cins);
            var etk = v.XdIlk("ETK");
            CadVarlik yazi;
            if (etk != null && tanitici.TryGetValue(etk, out yazi)) h.Etiket = yazi.Metin ?? "";
            return h;
        }

        private static Kanal KanalOku(CadVarlik v)
        {
            var gis = (v.XdIlk("GIS") ?? "").Split(';');
            var kalem = MalzemeOku(v.XdIlk("NIT"));
            kalem.Ana = true;
            kalem.Kaynak = "NIT";
            var k = new Kanal
            {
                Id = v.H,
                Kod = SayiCoz.Tam(kalem.Cins),
                Zemin = kalem.Tanim,
                BasNo = Alan(gis, 0),
                BitNo = Alan(gis, 1),
                Derinlik = SayiCoz.Coz(Alan(gis, 3)),
                AltGenislik = SayiCoz.Coz(Alan(gis, 4)),
                UstGenislik = SayiCoz.Coz(Alan(gis, 5)),
                Durum = kalem.Durum,
                Hakedis = kalem.Hakedis,
                Kontrol = Mantik(v.XdIlk("KONTROL")),
                TelefonId = v.XdIlk(NesneYazici.KimlikUygulamasi) ?? "",
            };
            foreach (var p in v.Kose) k.Kose.Add(new[] { p[0], p[1] });
            k.CizimUzunlugu = Geometri.Uzunluk(k.Kose);
            k.Kalemler.Add(kalem);
            return k;
        }

        private static Sondaj SondajOku(CadVarlik v)
        {
            var gis = (v.XdIlk("GIS") ?? "").Split(';');
            var kalem = MalzemeOku(v.XdIlk("NIT"));
            kalem.Ana = true;
            kalem.Kaynak = "NIT";
            var s = new Sondaj
            {
                Id = v.H,
                Tip = kalem.Tanim,
                Durum = kalem.Durum,
                Hakedis = kalem.Hakedis,
                BasNo = Alan(gis, 0),
                BitNo = Alan(gis, 1),
                Kontrol = Mantik(v.XdIlk("KONTROL")),
                TelefonId = v.XdIlk(NesneYazici.KimlikUygulamasi) ?? "",
            };
            foreach (var p in v.Kose) s.Kose.Add(new[] { p[0], p[1] });
            s.CizimUzunlugu = Geometri.Uzunluk(s.Kose);
            s.Kalemler.Add(kalem);
            return s;
        }

        // ---------------- Satır biçimleri ----------------

        /// <summary>NIT (nesnenin kendi pozu): cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;dm durum;sıra</summary>
        public static Kalem AnaKalemOku(string satir)
        {
            var f = (satir ?? "").Split(';');
            var k = OrtakAlanlar(f, 1);
            k.Ana = true;
            k.Kaynak = "NIT";
            k.DmDurum = Alan(f, 11).Trim();
            k.Sira = Alan(f, 12).Trim();
            return k;
        }

        /// <summary>MALZEME: cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol</summary>
        public static Kalem MalzemeOku(string satir)
        {
            var f = (satir ?? "").Split(';');
            var k = OrtakAlanlar(f, 1);
            k.Kaynak = "MALZEME";
            k.Sira = Alan(f, 11).Trim();
            k.Kontrol = Mantik(Alan(f, 12));
            return k;
        }

        /// <summary>HAT: cins;tanım;ikinci tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol</summary>
        public static Kalem HatKalemiOku(string satir)
        {
            var f = (satir ?? "").Split(';');
            // İkinci tanım alanını atlayıp ortak sıraya getir
            var g = new List<string>(f);
            string tanim = Alan(f, 1), tanim2 = Alan(f, 2);
            if (g.Count > 2) g.RemoveAt(2);
            var k = OrtakAlanlar(g.ToArray(), 1);
            k.Tanim = string.IsNullOrEmpty(tanim) ? tanim2 : tanim;
            k.Kaynak = "HAT";
            k.Sira = Alan(f, 12).Trim();
            k.Kontrol = Mantik(Alan(f, 13));
            return k;
        }

        private static Kalem OrtakAlanlar(string[] f, int tanimAlani)
        {
            var k = new Kalem
            {
                Cins = Alan(f, 0).Trim(),
                Tanim = Alan(f, tanimAlani),
                Durum = Alan(f, 2).Trim(),
                Miktar = SayiCoz.Coz(Alan(f, 4)),
                Birim = Alan(f, 5).Trim(),
                Katsayi = SayiCoz.Coz(Alan(f, 6), 1),
                Toplam = SayiCoz.Coz(Alan(f, 7)),
                BirimFiyat = SayiCoz.Coz(Alan(f, 8)),
                Hakedis = SayiCoz.Tam(Alan(f, 9)),
                Tarife = Alan(f, 10).Trim(),
            };
            return k;
        }

        // ---------------- Yardımcılar ----------------

        public static void KatmanCoz(string katman, out string onEk, out string tur, out int hakedis)
        {
            onEk = ""; tur = ""; hakedis = 0;
            if (string.IsNullOrEmpty(katman)) return;
            var m = HakedisKatmani.Match(katman);
            if (m.Success)
            {
                onEk = m.Groups["on"].Value;
                tur = m.Groups["tur"].Value;
                hakedis = int.Parse(m.Groups["hak"].Value, System.Globalization.CultureInfo.InvariantCulture);
                return;
            }
            m = OzelKatman.Match(katman);
            if (m.Success) { onEk = m.Groups["on"].Value; tur = m.Groups["ozel"].Value; return; }
            tur = katman;
        }

        public static string ElemanTuru(string cins)
        {
            cins = cins ?? "";
            if (Bas(cins, "AG_DEMİR") || Bas(cins, "AG_BETON") || Bas(cins, "AG_AĞAÇ")) return "AG_DIREK";
            if (Bas(cins, "MÜŞ_")) return "MUSTEREK_DIREK";
            if (Bas(cins, "AYD_")) return "AYD_DIREK";
            if (Bas(cins, "ENH_")) return "ENH_DIREK";
            if (Bas(cins, "TR_DİREK")) return "TRAFO_DIREGI";
            if (Bas(cins, "BETON_KÖŞK") || Bas(cins, "TRAFO_BİNASI")) return "TRAFO_MERKEZI";
            if (Bas(cins, "AG_PANO")) return "PANO";
            if (Bas(cins, "BOX_PANO")) return "BOX";
            if (Bas(cins, "EK_MUFU")) return "EK_MUFU";
            if (Bas(cins, "KOFRA")) return "KOFRE";
            return "DIGER";
        }

        public static string HatTuru(string katmanTuru, string cins)
        {
            switch (katmanTuru)
            {
                case "AG_HAV_HAT": return "AG_HAVAI";
                case "AG_YER_HAT": return "AG_YERALTI";
                case "AYD_HAT": return "AYDINLATMA";
                case "OG_HAV_HAT": return "OG_HAVAI";
                case "OG_YER_XLPE": return "OG_YERALTI";
                case "REKORTMAN": return "REKORTMAN";
                case "MÜŞTEREK_HAT": return "MUSTEREK";
            }
            cins = cins ?? "";
            if (Bas(cins, "ALPEK") || Bas(cins, "AG_İLETKEN")) return "AG_HAVAI";
            if (Bas(cins, "AG_ALİMİNYUM_KABLO") || Bas(cins, "AG_BAKIR_KABLO")) return "AG_YERALTI";
            if (Bas(cins, "AYDINLATMA")) return "AYDINLATMA";
            if (Bas(cins, "OG_İLETKEN")) return "OG_HAVAI";
            if (Bas(cins, "OG_ALİMİNYUM_KABLO")) return "OG_YERALTI";
            if (Bas(cins, "REKORTMAN")) return "REKORTMAN";
            return "DIGER";
        }

        private static bool Bas(string s, string onEk) => s.StartsWith(onEk, StringComparison.Ordinal);

        private static string Alan(string[] f, int i) => i < f.Length ? f[i] : "";

        private static bool? Mantik(string s)
        {
            if (s == null) return null;
            s = s.Trim();
            if (string.Equals(s, "True", StringComparison.OrdinalIgnoreCase)) return true;
            if (string.Equals(s, "False", StringComparison.OrdinalIgnoreCase)) return false;
            return null;
        }

        private static string DosyaAdi(string yol)
        {
            if (string.IsNullOrEmpty(yol)) return "Proje";
            string ad = yol;
            int i = Math.Max(ad.LastIndexOf('\\'), ad.LastIndexOf('/'));
            if (i >= 0) ad = ad.Substring(i + 1);
            int n = ad.LastIndexOf('.');
            if (n > 0) ad = ad.Substring(0, n);
            return ad;
        }
    }
}
