using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Proje modelinden çizim nesnelerinin tarifini (CadVarlik) üretir: katman, blok, öznitelikler,
    /// köşeler ve çizim biçiminde genişletilmiş veri (XDATA). NesneOkuyucu'nun tersidir; böylece
    /// eklentiyle çizilen ya da telefondan gelen nesneler raporda AutoCAD nesneleriyle aynı okunur.
    ///
    /// Nesnenin kendi tanıtıcısı (handle) çizime eklenince belli olur; metinlerde {H} olarak bırakılır,
    /// eklenti yazarken gerçek tanıtıcıyla değiştirir.
    /// </summary>
    public static class NesneYazici
    {
        public const string Tanitici = "{H}";

        /// <summary>Uygulamanın kendi kimlik verisi: telefondan gelen nesnenin kimliği (yeniden alırken eşleştirmek için).</summary>
        public const string KimlikUygulamasi = "SH_ID";

        /// <summary>Eklentinin parça metrajı yazılarının tanıtıcıları (hat / kanal / sondajda; her parça için bir yazı).</summary>
        public const string ParcaUygulamasi = "SH_PARCA";

        /// <summary>Direğin yanındaki armatür simgesinin tanıtıcısı (direkte armatür malzemesi varken).</summary>
        public const string ArmaturUygulamasi = "SH_ARM";

        /// <summary>Kanalın iki kenar çizgisinin tanıtıcıları (kanal ekseninde; AutoCAD tanıtıcı türüyle, kopyada çevrilir).</summary>
        public const string KenarUygulamasi = "SH_KENAR";

        /// <summary>Süs nesnesinin (hat etiketi, kanal kenarı) sahibinin tanıtıcısı: kopyalanmış nesne başkasının süsünü almasın.</summary>
        public const string SahipUygulamasi = "SH_SAHIP";

        /// <summary>Yalnız bunları taşıyan nesneler başka bir nesnenin süsüdür (kendi verisi yoktur; okunurken atlanır).</summary>
        public static readonly string[] SusUygulamalari = { ArmaturUygulamasi, SahipUygulamasi };

        /// <summary>AutoCAD'in eklentinin düzenlemediği verileri: pano çıkış şeması (ANA, CON), bina tipi trafo hücreleri (FIDER).</summary>
        public static readonly string[] EkUygulamalar = { "ANA", "CON", "FIDER" };

        /// <summary>XDATA uygulama adları (çizimde kayıtlı olmalı).</summary>
        public static readonly string[] Uygulamalar = { "GIS", "NIT", "MALZEME", "HAT", "ANAKESIT", "ETK", "KONTROL", "FULLREG", "HAKNO", "ZKOORD", KimlikUygulamasi, ParcaUygulamasi, ArmaturUygulamasi, KenarUygulamasi, SahipUygulamasi, "ANA", "CON", "FIDER" };


        // ---------------- Sayı ve alan yazımı (AutoCAD: Türkçe ondalık virgül) ----------------

        public static string Sayi(double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) return "0";
            var s = SayiCoz.Temiz(d).ToString("0.######", CultureInfo.InvariantCulture);
            return s.Replace('.', ',');
        }

        public static string Fiyat(double d) => SayiCoz.Temiz(d, 2).ToString("0.00", CultureInfo.InvariantCulture).Replace('.', ',');

        private static string Tam(int i) => i.ToString(CultureInfo.InvariantCulture);

        private static string Mantik(bool? b) => b.HasValue ? (b.Value ? "True" : "False") : "";

        /// <summary>Alan içinde ayırıcı (;) olmasın.</summary>
        private static string A(string s) => (s ?? "").Replace(';', ',').Replace('\r', ' ').Replace('\n', ' ');

        /// <summary>NIT: cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;dm durum;sıra</summary>
        public static string NitSatiri(Kalem k) =>
            string.Join(";", new[] { A(k.Cins), A(k.Tanim), A(k.Durum), "0", Sayi(k.Miktar), A(k.Birim), Sayi(k.Katsayi), Sayi(k.Toplam),
                Fiyat(k.BirimFiyat), Tam(k.Hakedis), A(k.Tarife), A(k.DmDurum), A(k.Sira) });

        /// <summary>MALZEME (kanal ve sondajın kendi pozu da bu biçimdedir): cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol</summary>
        public static string MalzemeSatiri(Kalem k) =>
            string.Join(";", new[] { A(k.Cins), A(k.Tanim), A(k.Durum), "0", Sayi(k.Miktar), A(k.Birim), Sayi(k.Katsayi), Sayi(k.Toplam),
                Fiyat(k.BirimFiyat), Tam(k.Hakedis), A(k.Tarife), A(k.Sira), Mantik(k.Kontrol) });

        /// <summary>HAT: cins;;tam yazım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol</summary>
        public static string HatSatiri(Kalem k) =>
            string.Join(";", new[] { A(k.Cins), "", A(string.IsNullOrEmpty(k.Aciklama) ? k.Tanim : k.Aciklama), A(k.Durum), "0", Sayi(k.Miktar), A(k.Birim),
                Sayi(k.Katsayi), Sayi(k.Toplam), Fiyat(k.BirimFiyat), Tam(k.Hakedis), A(k.Tarife), A(k.Sira), Mantik(k.Kontrol) });

        // ---------------- Katman ve blok ----------------

        private static readonly Dictionary<string, string> ElemanKatmanTuru = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { "AG_DIREK", "AGDIR" }, { "MUSTEREK_DIREK", "MUSDIR" }, { "AYD_DIREK", "AYDDIR" }, { "ENH_DIREK", "ENHDIR" },
            { "TRAFO_DIREGI", "TRAFO" }, { "TRAFO_MERKEZI", "TRAFO" }, { "PANO", "PANO" }, { "BOX", "BOX" },
            { "EK_MUFU", "STANDART" }, { "KOFRE", "STANDART" }, { "DIGER", "STANDART" },
        };

        private static readonly Dictionary<string, string> HatKatmanTuru = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { "AG_HAVAI", "AG_HAV_HAT" }, { "AG_YERALTI", "AG_YER_HAT" }, { "AYDINLATMA", "AYD_HAT" }, { "OG_HAVAI", "OG_HAV_HAT" },
            { "OG_YERALTI", "OG_YER_XLPE" }, { "REKORTMAN", "REKORTMAN" }, { "MUSTEREK", "MUSTEREK_HAT" },
        };

        /// <summary>
        /// AutoCAD katman adı: MEVCUT → önEk_MEVCUT, DM → önEk_DEMONTAJ, mufu/kofre → önEk_STANDART, diğerleri
        /// önEk_hakediş.HAK.tür. Türkçe karaktersiz (KatmanAdlari): önekteki Türkçe harfler de çevrilir.
        /// </summary>
        public static string ElemanKatmani(string onEk, string tur, string durum, int hakedis)
        {
            onEk = KatmanAdlari.Ascii(onEk);
            if (durum == "MEVCUT") return onEk + "_MEVCUT";
            if (durum == "DM") return onEk + "_DEMONTAJ";
            string t;
            if (!ElemanKatmanTuru.TryGetValue(tur ?? "", out t)) t = "STANDART";
            if (t == "STANDART") return onEk + "_STANDART";
            return onEk + "_" + Math.Max(1, hakedis).ToString(CultureInfo.InvariantCulture) + ".HAK." + t;
        }

        public static string HatKatmani(string onEk, string tur, string durum, int hakedis)
        {
            onEk = KatmanAdlari.Ascii(onEk);
            if (durum == "MEVCUT") return onEk + "_MEVCUT";
            if (durum == "DM") return onEk + "_DEMONTAJ";
            string t;
            if (!HatKatmanTuru.TryGetValue(tur ?? "", out t)) t = "AG_HAV_HAT";
            return onEk + "_" + Math.Max(1, hakedis).ToString(CultureInfo.InvariantCulture) + ".HAK." + t;
        }

        /// <summary>
        /// Uygulamanın bloğu: lejant simgesi, tür + malzeme + duruma göre
        /// (ör. SH_KAFES_AG_YENI). Bkz. Semboller.
        /// </summary>
        public static string VarsayilanBlok(string tur, string cins, string durum, string dmDurum = "") => Semboller.BlokAdi(tur, cins, durum, dmDurum);

        public static string VarsayilanBlok(Eleman e) => Semboller.BlokAdi(e);

        /// <summary>
        /// Yeni elemanın bloğu: her zaman uygulamanın simgesi (telefonla aynı SH_ bloğu; tür, malzeme ve duruma göre).
        /// </summary>
        public static string BlokOner(IEnumerable<Eleman> mevcut, string tur, string cins, string durum, string dmDurum = "") =>
            Semboller.BlokAdi(tur, cins, durum, dmDurum);

        /// <summary>
        /// Elemanın bloğu: her zaman uygulamanın simgesi (tür, malzeme ve duruma göre yeniden seçilir). Çizimde başka bir
        /// blokla duran eleman da yazılırken bu simgeye geçer. Yalnız adsız bloklar (*U…) olduğu gibi kalır.
        /// </summary>
        public static string BlokSec(IEnumerable<Eleman> cizim, Eleman e)
        {
            if (!string.IsNullOrEmpty(e.Blok) && e.Blok.StartsWith("*", StringComparison.Ordinal)) return e.Blok;
            return Semboller.BlokAdi(e.Tur, e.Cins, e.Durum, e.DmDurum);
        }

        /// <summary>Durumu değişen elemanın bloğu (eski durum bilgisi artık gerekmez: simge her zaman güncel duruma göre).</summary>
        public static string BlokSec(IEnumerable<Eleman> cizim, Eleman e, string eskiDurum, string eskiDm) => BlokSec(cizim, e);

        // ---------------- Armatür (direğin malzemesi; simgesi direğin yanında) ----------------

        /// <summary>Armatür taşıyabilen eleman türleri: direkler ve trafo direği.</summary>
        public static bool DirekMi(string tur) =>
            tur == "AG_DIREK" || tur == "MUSTEREK_DIREK" || tur == "AYD_DIREK" || tur == "ENH_DIREK" || tur == "TRAFO_DIREGI";

        /// <summary>Armatür simgesinin ışınlarla yarı genişliği (metre): daire 0,6 + ışınlar 1,1 (semboller-uret.mjs › ARMATUR).</summary>
        public const double ArmaturYariGenisligi = 1.1;

        /// <summary>Kalem armatür mü (cinsi ARMATÜR …).</summary>
        public static bool ArmaturMu(Kalem k) => k != null && Semboller.Aile("DIGER", k.Cins) == "ARMATUR";

        /// <summary>
        /// Direğin armatür malzemesinden simgenin bloğu ("": armatür yok). Durumu: demontaj olmayan ilk armatürün durumu
        /// (hepsi demontajsa demontaj). Simge direğin sol üstüne, direğin simgesine değmeden konur: armatür simgesi
        /// (yarı genişliği 0,6 m, ışınlarla 1,1 m) direk simgesinin yarısından küçüktür (kullanıcı, 8.11.2026); direğe
        /// uzaklığı direğin yarı genişliği + armatürün ışınlı yarı genişliği + 0,4 m.
        /// </summary>
        public static string ArmaturBlogu(Eleman e, out double dx, out double dy, out string durum)
        {
            dx = dy = 0;
            durum = "";
            if (e == null || !DirekMi(e.Tur)) return "";
            Kalem secilen = null;
            foreach (var k in e.Kalemler)
            {
                if (k.Ana || !ArmaturMu(k)) continue;
                if (secilen == null || (Semboller.Varyant(secilen.Durum) == "DM" && Semboller.Varyant(k.Durum) != "DM")) secilen = k;
            }
            if (secilen == null) return "";
            durum = secilen.Durum ?? "";
            double R = Semboller.Yuklu ? Semboller.YariGenislik(e) : 2.25;
            double A = ArmaturYariGenisligi;
            dx = -(R + A + 0.4);
            dy = Math.Max(A + 0.2, R * 0.55);
            return Semboller.OnEk + "ARMATUR_" + Semboller.Varyant(durum);
        }

        /// <summary>Yeni bloğun ölçeği: çizimde aynı bloğun en çok kullanılan ölçeği, yoksa elemanların en çok kullanılan ölçeği.</summary>
        public static double OlcekOner(IEnumerable<CadVarlik> cizim, string blok, double varsayilan)
        {
            var ayni = new Dictionary<double, int>();
            var hepsi = new Dictionary<double, int>();
            foreach (var v in cizim)
            {
                if (v.Tur != "INSERT" || !v.Xd.ContainsKey("NIT") || v.Olcek <= 0) continue;
                double o = Math.Round(v.Olcek, 6);
                int c;
                hepsi.TryGetValue(o, out c); hepsi[o] = c + 1;
                if (string.Equals(v.Blok, blok, StringComparison.OrdinalIgnoreCase)) { ayni.TryGetValue(o, out c); ayni[o] = c + 1; }
            }
            var kaynak = ayni.Count > 0 ? ayni : hepsi;
            double en = varsayilan;
            int enCok = 0;
            foreach (var kv in kaynak) if (kv.Value > enCok || (kv.Value == enCok && kv.Key > en)) { enCok = kv.Value; en = kv.Key; }
            return en > 0 ? en : (varsayilan > 0 ? varsayilan : 1);
        }

        /// <summary>
        /// Yeni katmanın rengi (AutoCAD renk numarası) ve çizgi tipi: ortak çizim stilinden (telefonla aynı); stil
        /// yüklenmemişse AutoCAD çizimlerindeki eski renkler.
        /// </summary>
        public static void KatmanStili(string katman, out short renk, out string cizgiTipi)
        {
            if (CizimStili.KatmanStili(katman, out renk, out cizgiTipi)) return;
            renk = 7; cizgiTipi = "";
            katman = katman ?? "";
            int i = katman.IndexOf(".HAK.", StringComparison.Ordinal);
            string tur = i >= 0 ? KatmanAdlari.Tur(katman.Substring(i + 5)) : "";
            switch (tur)
            {
                case "AGDIR": renk = 180; return;
                case "AYDDIR": renk = 140; return;
                case "ENHDIR": renk = 240; return;
                case "MUSDIR": case "BOX": case "PANO": renk = 7; return;
                case "TRAFO": renk = 1; return;
                case "AG_HAV_HAT": renk = 3; return;
                case "AG_YER_HAT": renk = 3; cizgiTipi = "HIDDENX2"; return;
                case "AYD_HAT": renk = 5; cizgiTipi = "HIDDENX2"; return;
                case "OG_HAV_HAT": renk = 1; return;
                case "OG_YER_XLPE": renk = 1; cizgiTipi = "HIDDENX2"; return;
                case "REKORTMAN": renk = 140; cizgiTipi = "HIDDENX2"; return;
                case "MUSTEREK_HAT": renk = 6; return;
            }
            if (katman.EndsWith("_DEMONTAJ", StringComparison.Ordinal)) { renk = 9; cizgiTipi = "HIDDENX2"; }
            else if (katman.EndsWith("_MEVCUT", StringComparison.Ordinal)) renk = 8;
            else if (katman.EndsWith("_PROJE", StringComparison.Ordinal)) { renk = 2; cizgiTipi = "HIDDENX2"; }
            else if (katman.EndsWith("_KABLO_KANALI", StringComparison.Ordinal)) renk = 30;
            else if (katman.EndsWith("_YATAY_SONDAJ", StringComparison.Ordinal)) renk = 200;
            else if (katman == "GPS" || katman.EndsWith("_GPS", StringComparison.Ordinal)) renk = 4;
        }

        // ---------------- Nesneler ----------------

        private static void Ekle(CadVarlik v, string uygulama, string deger)
        {
            List<string> l;
            if (!v.Xd.TryGetValue(uygulama, out l)) { l = new List<string>(); v.Xd[uygulama] = l; }
            l.Add(deger ?? "");
        }

        /// <summary>Eleman: blok + öznitelikler + GIS, KONTROL, NIT, MALZEME.</summary>
        public static CadVarlik Eleman(Eleman e, string onEk, string blok, string kimlik)
        {
            var ana = e.Kalemler.Find(k => k.Ana) ?? new Kalem { Cins = e.Cins, Tanim = e.Tip, Durum = e.Durum, Hakedis = e.Hakedis, Ana = true, Miktar = 1, Katsayi = 1, Toplam = 1, Birim = "ad/ad" };
            var v = new CadVarlik
            {
                H = e.Id,
                Tur = "INSERT",
                Katman = string.IsNullOrEmpty(e.Katman) || !KatmanUyumlu(e.Katman, e.Durum) ? ElemanKatmani(onEk, e.Tur, e.Durum, e.Hakedis) : KatmanAdlari.Ascii(e.Katman),
                Blok = blok,
                X = e.Saga, Y = e.Yukari, Z = e.Kot, Aci = e.Aci,
            };
            // Telefon simgesine (SH_, parçaları BLOĞA GÖRE) telefonun rengi yazılır; AutoCAD bloklarının rengine dokunulmaz
            if (CizimStili.Yuklu && Semboller.EklentininBlogu(blok)) v.Renk = CizimStili.ElemanRengi(e.Tur, ana.Cins, ana.Durum);
            v.Oz["SIRA_NO"] = Tanitici;
            v.Oz["GIS_ID"] = e.GisId ?? "";
            v.Oz["CİNS"] = ana.Cins;
            v.Oz["TİP"] = ana.Tanim;
            v.Oz["DURUM"] = ana.Durum;
            v.Oz["GÜÇ"] = string.IsNullOrEmpty(e.Guc) ? " " : e.Guc;
            v.Oz["GERİLİM"] = string.IsNullOrEmpty(e.Gerilim) ? " " : e.Gerilim;
            string gis = Tanitici + ";" + A(e.GisId) + ";" + A(ana.Cins) + ";" + A(ana.Tanim) + ";" + A(ana.Durum);
            if (!string.IsNullOrEmpty(e.Guc) || !string.IsNullOrEmpty(e.Gerilim)) gis += ";" + A(e.Guc) + ";" + A(e.Gerilim);
            Ekle(v, "GIS", gis);
            Ekle(v, "KONTROL", Mantik(e.Kontrol ?? ana.Kontrol));
            Ekle(v, "NIT", NitSatiri(ana));
            foreach (var k in e.Kalemler) if (!k.Ana) Ekle(v, "MALZEME", MalzemeSatiri(k));
            foreach (var kv in e.EkVeri) if (kv.Value != null && kv.Value.Count > 0) v.Xd[kv.Key] = new List<string>(kv.Value);
            if (!string.IsNullOrEmpty(kimlik)) Ekle(v, KimlikUygulamasi, kimlik);
            string armDurum;
            v.Armatur = ArmaturBlogu(e, out v.ArmaturDx, out v.ArmaturDy, out armDurum);
            if (v.Armatur.Length > 0 && CizimStili.Yuklu) v.ArmaturRengi = CizimStili.ElemanRengi("DIGER", "ARMATÜR", armDurum);
            v.MalzemeSatirlari = MalzemeEtiketi.Satirlar(e);
            return v;
        }

        /// <summary>Çizgi nesnesine stil anahtarının rengini ve çizgi tipini yazar (demontajda demontaj rengi).</summary>
        private static void Stil(CadVarlik v, string anahtar, string durum)
        {
            if (!CizimStili.Yuklu) return;
            var k = CizimStili.Katman(anahtar);
            if (k == null) return;
            v.Renk = Semboller.Varyant(durum) == "DM" ? CizimStili.DemontajRengi : k.Aci;
            v.CizgiTipi = string.IsNullOrEmpty(k.Cizgi) ? "CONTINUOUS" : k.Cizgi;
        }

        /// <summary>Katman adı nesnenin durumuyla çelişiyorsa (ör. demontaja çevrilmiş ama hakediş katmanında) yeniden hesaplanır.</summary>
        private static bool KatmanUyumlu(string katman, string durum)
        {
            bool dm = katman.EndsWith("_DEMONTAJ", StringComparison.Ordinal);
            bool mevcut = katman.EndsWith("_MEVCUT", StringComparison.Ordinal);
            if (durum == "DM") return dm;
            if (durum == "MEVCUT") return mevcut;
            return !dm && !mevcut;
        }

        /// <summary>Hat: çoklu çizgi + KONTROL, ANAKESIT, HAT (+ bağlı malzemeler). Etiket (ETK) yazılırken eklenir.</summary>
        public static CadVarlik Hat(Hat h, string onEk, string kimlik)
        {
            var v = new CadVarlik
            {
                H = h.Id,
                Tur = "LWPOLYLINE",
                Katman = string.IsNullOrEmpty(h.Katman) || !KatmanUyumlu(h.Katman, h.Durum) ? HatKatmani(onEk, h.Tur, h.Durum, h.Hakedis) : KatmanAdlari.Ascii(h.Katman),
            };
            foreach (var k in h.Kose) v.Kose.Add(new[] { k[0], k[1] });
            v.ParcaMetraji = true;
            if (CizimStili.Yuklu)
            {
                v.Renk = CizimStili.HatRengi(h.Tur, h.Durum);
                string ct = CizimStili.HatCizgiTipi(h.Tur);
                v.CizgiTipi = ct.Length == 0 ? "CONTINUOUS" : ct;
                v.HatKalinligi = CizimStili.HatKalinligi(h.Tur, 1);
            }
            var ilk = h.Kalemler.Find(k => k.Kaynak == "HAT");
            Ekle(v, "KONTROL", Mantik(h.Kontrol ?? (ilk != null ? ilk.Kontrol : null)));
            Ekle(v, "ANAKESIT", string.IsNullOrEmpty(h.AnaKesit) ? (ilk != null ? ilk.Tanim : "") : h.AnaKesit);
            foreach (var k in h.Kalemler)
            {
                if (k.Kaynak == "HAT") Ekle(v, "HAT", HatSatiri(k));
                else Ekle(v, "MALZEME", MalzemeSatiri(k));
            }
            if (!v.Xd.ContainsKey("HAT")) Ekle(v, "HAT", HatSatiri(new Kalem { Tanim = h.AnaKesit, Durum = h.Durum, Hakedis = h.Hakedis, Birim = "mt/mt" }));
            if (!string.IsNullOrEmpty(kimlik)) Ekle(v, KimlikUygulamasi, kimlik);
            return v;
        }

        /// <summary>
        /// Hat etiketi: durum işaretiyle iletken, ör. "^ 3X50/16+70 ALPEK". İşaretler AutoCAD ile aynı: * M+M · ^ M ·
        /// [ ] DM+M · &gt; &lt; DM · / \ KM · { } ENH · ( ) MEVCUT. Eski AutoCAD etiketinin sonundaki metraj ve tanıtıcı
        /// yazılmaz: metraj her açıklığın üstünde ayrıca yazılıdır, etiketin sahibi yazının kendi verisindedir (SH_SAHIP).
        /// Telefondaki karşılığı sh-core hatEtiketi.
        /// </summary>
        public static string HatEtiketi(Hat h)
        {
            var hatlar = Iletkenler.HatKalemleri(h);
            var kl = hatlar.Count > 0 ? hatlar[0] : null;
            // Çoklu iletken: hepsi telefondaki gibi (OG + … / AG + …). Tek iletken: AutoCAD hattın tam yazımını kullanır
            // (ör. "3(1x150/25) Xlpe Alm."), yoksa ana kesit.
            string kesit = hatlar.Count > 1 ? Iletkenler.EtiketKesiti(hatlar)
                : kl != null && !string.IsNullOrEmpty(kl.Aciklama) ? kl.Aciklama
                : !string.IsNullOrEmpty(h.AnaKesit) ? h.AnaKesit : (kl != null ? kl.Tanim : "");
            return EtiketGovdesi(h.Durum, kesit);
        }

        /// <summary>
        /// Durum işaretli etiket gövdesi (hat etiketi; telefondaki sh-core hatEtiketi ile aynı). Kesit görünen yazımla
        /// (MalzemeYazimi: "3x50/16 Xlpe Alm." → "3x50/16 XLPE Al").
        /// </summary>
        public static string EtiketGovdesi(string durum, string kesit)
        {
            kesit = MalzemeYazimi.Duzelt(kesit ?? "");
            switch (durum)
            {
                case "M": return "^ " + kesit;
                case "M+M": return "* " + kesit;
                case "DM": return ">" + kesit + "<";
                case "DM+M": return "[" + kesit + "]";
                case "KM": return "/" + kesit + "\\";
                case "ENH": return "{" + kesit + "}";
                case "MEVCUT": return "(" + kesit + ")";
                default: return kesit; // ME ve bilinmeyenler düz (AutoCAD "TANIMSIZ" yazar)
            }
        }

        /// <summary>
        /// Kanalın kenar çizgileri arası (m): üst genişlik, yoksa alt genişlik (kanalda santimetre), o da yoksa stilin
        /// varsayılanı.
        /// </summary>
        public static double KanalGenisligi(Kanal c)
        {
            double cm = c.UstGenislik > 0 ? c.UstGenislik : c.AltGenislik;
            return cm > 0 ? cm / 100.0 : CizimStili.KanalKenari.VarsayilanGenislik;
        }

        /// <summary>Kanal: çoklu çizgi (önEk_KABLO_KANALI) + GIS (baş;bit;uzunluk;derinlik;alt;üst), KONTROL, NIT.</summary>
        public static CadVarlik Kanal(Kanal c, string onEk, string kimlik)
        {
            var v = new CadVarlik { H = c.Id, Tur = "LWPOLYLINE", Katman = KatmanAdlari.Ascii(onEk) + "_KABLO_KANALI" };
            foreach (var k in c.Kose) v.Kose.Add(new[] { k[0], k[1] });
            v.ParcaMetraji = true;
            v.KaziMetraji = true;
            v.KenarGenisligi = KanalGenisligi(c);
            Stil(v, "KANAL", c.Durum);
            var ana = c.Kalemler.Find(k => k.Ana) ?? new Kalem { Cins = c.Kod.ToString(CultureInfo.InvariantCulture), Tanim = c.Zemin, Durum = c.Durum, Hakedis = c.Hakedis, Birim = "mt/m³", Katsayi = 1, Ana = true };
            var nit = ana.Kopya();
            nit.Cins = c.Kod.ToString(CultureInfo.InvariantCulture);
            nit.Tanim = c.Zemin;
            Ekle(v, "GIS", A(c.BasNo) + ";" + A(c.BitNo) + ";" + Sayi(nit.Miktar) + ";" + Sayi(c.Derinlik) + ";" + Sayi(c.AltGenislik) + ";" + Sayi(c.UstGenislik));
            Ekle(v, "KONTROL", Mantik(c.Kontrol ?? ana.Kontrol));
            Ekle(v, "NIT", MalzemeSatiri(nit));
            if (!string.IsNullOrEmpty(kimlik)) Ekle(v, KimlikUygulamasi, kimlik);
            return v;
        }

        /// <summary>Yatay sondaj: çoklu çizgi (önEk_YATAY_SONDAJ) + GIS (baş;bit;uzunluk), KONTROL, NIT.</summary>
        public static CadVarlik Sondaj(Sondaj s, string onEk, string kimlik)
        {
            var v = new CadVarlik { H = s.Id, Tur = "LWPOLYLINE", Katman = KatmanAdlari.Ascii(onEk) + "_YATAY_SONDAJ" };
            foreach (var k in s.Kose) v.Kose.Add(new[] { k[0], k[1] });
            v.ParcaMetraji = true;
            v.KaziMetraji = true;
            Stil(v, "SONDAJ", s.Durum);
            var ana = s.Kalemler.Find(k => k.Ana) ?? new Kalem { Cins = "YATAY_DELGİ", Tanim = s.Tip, Durum = s.Durum, Hakedis = s.Hakedis, Birim = "mt/mt", Katsayi = 1, Ana = true };
            Ekle(v, "GIS", A(s.BasNo) + ";" + A(s.BitNo) + ";" + Sayi(ana.Miktar));
            Ekle(v, "KONTROL", Mantik(s.Kontrol ?? ana.Kontrol));
            Ekle(v, "NIT", MalzemeSatiri(ana));
            if (!string.IsNullOrEmpty(kimlik)) Ekle(v, KimlikUygulamasi, kimlik);
            return v;
        }

        /// <summary>GPS noktası: "GPS" bloğu (GPS katmanı), METIN1..6 öznitelikleri, HAKNO ve ZKOORD.</summary>
        public static CadVarlik Nokta(Nokta n, string kimlik)
        {
            var v = new CadVarlik { H = n.Id, Tur = "INSERT", Katman = "GPS", Blok = "GPS", X = n.Saga, Y = n.Yukari, Z = n.Kot };
            v.Oz["METIN1"] = n.Ad ?? "";
            v.Oz["METIN2"] = n.Kod ?? "";
            for (int i = 0; i < 4; i++) v.Oz["METIN" + (i + 3)] = i < n.EkMetinler.Count ? n.EkMetinler[i] : "";
            Ekle(v, "HAKNO", Tam(n.Hakedis));
            Ekle(v, "ZKOORD", Sayi(n.Kot));
            if (!string.IsNullOrEmpty(kimlik)) Ekle(v, KimlikUygulamasi, kimlik);
            return v;
        }

        /// <summary>Bölge (alt proje): kapalı çoklu çizgi (önEk_PROJE) + FULLREG "ad;kod;".</summary>
        public static CadVarlik Bolge(Bolge b, string onEk, string kimlik)
        {
            var v = new CadVarlik { H = b.Id, Tur = "LWPOLYLINE", Katman = KatmanAdlari.Ascii(onEk) + "_PROJE", Kapali = true };
            foreach (var k in b.Sinir) v.Kose.Add(new[] { k[0], k[1] });
            Stil(v, "PROJE", "");
            Ekle(v, "FULLREG", A(b.Ad) + ";" + A(b.Kod) + ";" + A(b.Grup));
            if (!string.IsNullOrEmpty(kimlik)) Ekle(v, KimlikUygulamasi, kimlik);
            return v;
        }

        /// <summary>Projenin tüm nesneleri (kimlik: telefondan gelen nesnenin kimliği; çizimde olan nesnelerde boş).</summary>
        public static List<CadVarlik> Hepsi(Proje p, Func<string, bool> telefondanMi = null)
        {
            string on = string.IsNullOrEmpty(p.KatmanOnEki) ? "SC" : p.KatmanOnEki;
            Func<string, string> kim = id => telefondanMi != null && telefondanMi(id) ? id : null;
            var l = new List<CadVarlik>();
            foreach (var b in p.Bolgeler) l.Add(Bolge(b, on, kim(b.Id)));
            foreach (var n in p.Noktalar) l.Add(Nokta(n, kim(n.Id)));
            foreach (var e in p.Elemanlar) l.Add(Eleman(e, on, BlokSec(p.Elemanlar, e), kim(e.Id)));
            foreach (var h in p.Hatlar) l.Add(Hat(h, on, kim(h.Id)));
            foreach (var c in p.Kanallar) l.Add(Kanal(c, on, kim(c.Id)));
            foreach (var s in p.Sondajlar) l.Add(Sondaj(s, on, kim(s.Id)));
            return l;
        }

        /// <summary>{H} yer tutucusunu gerçek tanıtıcıyla değiştirir (öznitelikler ve XDATA).</summary>
        public static void TaniticiYaz(CadVarlik v, string handle)
        {
            var oz = new List<string>(v.Oz.Keys);
            foreach (var k in oz) if (v.Oz[k] == Tanitici) v.Oz[k] = handle;
            foreach (var kv in v.Xd)
                for (int i = 0; i < kv.Value.Count; i++)
                    if (kv.Value[i] != null && kv.Value[i].IndexOf(Tanitici, StringComparison.Ordinal) >= 0) kv.Value[i] = kv.Value[i].Replace(Tanitici, handle);
        }
    }
}
