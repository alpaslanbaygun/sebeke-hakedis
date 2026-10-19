using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Test
{
    /// <summary>
    /// Çekirdek testleri.
    ///   ornek                         : depodaki örnek dökümle birim testleri (CI'da çalışır)
    ///   dogrula dokum.json ref.tsv cikti/ : gerçek bir AutoCAD çizimi ve AutoCAD raporuyla satır satır karşılaştırma
    ///   katsayilar hedef.json         : ortak katsayı dosyasını üretir
    ///   gidisdonus proje.sebeke.json  : projeyi çizim nesnelerine yazıp geri okur, raporları karşılaştırır
    ///   semboller [dokum.txt]         : simge takımı denetimleri ve ilkel dökümü (telefonun tablosuyla karşılaştırma)
    /// </summary>
    public static class Program
    {
        private static int _hata;

        public static int Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            CultureInfo.DefaultThreadCurrentCulture = new CultureInfo("tr-TR"); // Türkçe Windows'u taklit et
            CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
            string komut = args.Length > 0 ? args[0] : "ornek";
            try
            {
                switch (komut)
                {
                    case "ornek": Ornek(args.Length > 1 ? args[1] : Path.Combine(AppContext.BaseDirectory, "ornek-dokum.json")); break;
                    case "dogrula": Dogrula(args[1], args[2], args[3]); break;
                    case "gidisdonus": GidisDonus(ProjeDosyasi.Oku(File.ReadAllText(args[1], Encoding.UTF8)), args[1]); break;
                    case "aktarim": AktarimDene(args[1], args[2]); break;
                    case "bosaaktar": BosaAktar(args[1]); break;
                    case "katsayilar": File.WriteAllText(args[1], Json.Yaz(Katsayilar.Varsayilan.JsonYap()) + "\n", new UTF8Encoding(false)); Console.WriteLine("yazıldı: " + args[1]); break;
                    case "semboller": SembolleriYukle(); Semboller_(); SembolDokumu(args.Length > 1 ? args[1] : null); break;
                    default: Console.WriteLine("Bilinmeyen komut: " + komut); return 2;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("HATA: " + ex);
                return 1;
            }
            Console.WriteLine(_hata == 0 ? "SONUÇ: tüm denetimler geçti" : "SONUÇ: " + _hata + " denetim başarısız");
            return _hata == 0 ? 0 : 1;
        }

        /// <summary>Simge takımı (ortak/katalog/semboller.json) — eklentideki gömülü dosyanın aynısı.</summary>
        private static void SembolleriYukle()
        {
            if (Semboller.Yuklu) return;
            string yol = Path.Combine(AppContext.BaseDirectory, "semboller.json");
            Semboller.Yukle(File.ReadAllText(yol, Encoding.UTF8));
        }

        /// <summary>Simge seçimi ve tablo bütünlüğü denetimleri.</summary>
        private static void Semboller_()
        {
            SembolleriYukle();
            Esit("SH_DIREK_AG_YENI", Semboller.BlokAdi("AG_DIREK", "AG_BETON", "M"), "simge: AG beton direk montaj");
            Esit("SH_DIREK_AG_YENI", Semboller.BlokAdi("AG_DIREK", "AG_AĞAÇ", "M+M"), "simge: AG ağaç direk malzeme+montaj");
            Esit("SH_KAFES_AG_MEVCUT", Semboller.BlokAdi("AG_DIREK", "AG_DEMİR_GLV", "MEVCUT"), "simge: AG demir direk mevcut");
            Esit("SH_KAFES_AG_DM", Semboller.BlokAdi("AG_DIREK", "AG_DEMİR", "DM"), "simge: AG demir direk demontaj");
            Esit("SH_DIREK_AG_MEVCUT", Semboller.BlokAdi("AG_DIREK", "", ""), "simge: cinsi bilinmeyen AG direk (daire, boş)");
            Esit("SH_KAFES_OG_DMM", Semboller.BlokAdi("MUSTEREK_DIREK", "MÜŞ_DEMİR_GLV", "DM+M"), "simge: müşterek demir direk sök-tak");
            Esit("SH_DIREK_OG_YENI", Semboller.BlokAdi("ENH_DIREK", "ENH_BETON", "M"), "simge: ENH beton direk");
            Esit("SH_KAFES_OG_YENI", Semboller.BlokAdi("ENH_DIREK", "ENH_GLV_CVT", "M"), "simge: ENH cıvatalı demir direk");
            Esit("SH_DIREK_AYD_YENI", Semboller.BlokAdi("AYD_DIREK", "AYD_GLV_PLG", "M"), "simge: aydınlatma direği (galvaniz olsa da daire)");
            Esit("SH_TRAFO_DIREK_MEVCUT", Semboller.BlokAdi("TRAFO_DIREGI", "TR_DİREK_GLV", "MEVCUT"), "simge: trafo direği");
            Esit("SH_TRAFO_KOSK_YENI", Semboller.BlokAdi("TRAFO_MERKEZI", "BETON_KÖŞKLER", "M"), "simge: beton köşk");
            Esit("SH_TRAFO_BINA_YENI", Semboller.BlokAdi("TRAFO_MERKEZI", "TRAFO_BİNASI", "KM"), "simge: trafo binası (KM → AutoCAD'deki gibi yeni)");
            Esit("SH_KAFES_AG_YENI", Semboller.BlokAdi("AG_DIREK", "AG_DEMİR_GLV", "ME"), "simge: mutabakat eksiği → yeni");
            Esit("SH_ARMATUR_YENI", Semboller.BlokAdi("DIGER", "ARMATÜR", "M"), "simge: diğer › armatür");
            Esit("SH_MENHOL_MEVCUT", Semboller.BlokAdi("DIGER", "MENHOL", "MEVCUT"), "simge: diğer › menhol");
            var kmHat = new Hat { Tur = "OG_HAVAI", AnaKesit = "3xSW", Durum = "KM" };
            kmHat.Kalemler.Add(new Kalem { Kaynak = "HAT", Tanim = "3xSW", Miktar = 120 });
            Esit("/3xSW\\/120m/({H})", NesneYazici.HatEtiketi(kmHat), "hat etiketi: KM → /tip\\");
            kmHat.Durum = "ENH";
            Esit("{3xSW}/120m/({H})", NesneYazici.HatEtiketi(kmHat), "hat etiketi: ENH → {tip}");
            Esit("SH_SDK_YENI", Semboller.BlokAdi("BOX", "BOX_PANO", "M"), "simge: box → SDK");
            Esit("SH_PANO_YENI", Semboller.BlokAdi("PANO", "AG_PANO_HT", "M+M"), "simge: pano");
            Esit("SH_MUFU_MEVCUT", Semboller.BlokAdi("EK_MUFU", "EK_MUFU_AG_ALM", "MEVCUT"), "simge: ek mufu");
            Esit("SH_KOFRE_YENI", Semboller.BlokAdi("KOFRE", "KOFRA", "M"), "simge: kofre");
            Esit("SH_DIGER_DM", Semboller.BlokAdi("DIGER", "", "DM"), "simge: diğer");
            Esit(true, Semboller.EklentininBlogu("SH_DIREK_AG_YENI"), "simge: SH_ bloğu eklentinin");
            Esit(false, Semboller.EklentininBlogu("YENİ_AG_DİR"), "simge: AutoCAD bloğu eklentinin değil");
            // Demontaj türü: kesik ve sökük ayrı simge; sök-tak yarım dolu kalır
            Esit("SH_KAFES_AG_KESIK", Semboller.BlokAdi("AG_DIREK", "AG_DEMİR_GLV", "DM", "KESİK"), "simge: AG demir direk demontaj kesik");
            Esit("SH_DIREK_AG_SOKUK", Semboller.BlokAdi("AG_DIREK", "AG_BETON", "DM", "SÖKÜK"), "simge: AG beton direk demontaj sökük");
            Esit("SH_DIREK_AG_SOKUK", Semboller.BlokAdi("AG_DIREK", "AG_BETON", "DM", "sökük"), "simge: küçük harfle sökük");
            Esit("SH_KAFES_OG_DM", Semboller.BlokAdi("ENH_DIREK", "ENH_DEMİR_GLV", "DM", ""), "simge: türü yazılmamış demontaj");
            Esit("SH_KAFES_AG_DMM", Semboller.BlokAdi("AG_DIREK", "AG_DEMİR_GLV", "DM+M", "KESİK"), "simge: sök-tak kesik olsa da yarım dolu");
            Esit("SH_KAFES_AG_YENI", Semboller.BlokAdi("AG_DIREK", "AG_DEMİR_GLV", "M", "KESİK"), "simge: montajda demontaj türü yok sayılır");
            Esit("SH_KAFES_AG_KESIK", Semboller.BlokAdi(new Eleman { Tur = "AG_DIREK", Cins = "AG_DEMİR", Durum = "DM", DmDurum = "KESİK" }), "simge: elemanın demontaj türü");
            Esit(true, Semboller.DemontajVaryanti("SOKUK") && Semboller.DemontajVaryanti("KESIK") && !Semboller.DemontajVaryanti("DMM"), "simge: demontaj varyantları");
            int eksik = 0, bos = 0;
            foreach (var aile in Semboller.Aileler())
            {
                var gorunum = new HashSet<string>(StringComparer.Ordinal);
                foreach (var v in Semboller.Varyantlar)
                {
                    var s = Semboller.Bul("SH_" + aile + "_" + v);
                    if (s == null) { eksik++; Console.WriteLine("    eksik sembol: " + aile + "_" + v); continue; }
                    if (s.Ilkeller.Count == 0) bos++;
                    var sb = new StringBuilder();
                    // Görünüm izi: ilkel türü, sayıları ve noktaların kendisi (yalnız sayısı değil: kesik "//" ile sökük "X"
                    // ikisi de iki çizgidir, yerleri farklıdır)
                    foreach (var i in s.Ilkeller)
                    {
                        sb.Append(i.Tur);
                        foreach (var d in i.Sayilar) sb.Append(' ').Append(d.ToString("0.###", CultureInfo.InvariantCulture));
                        foreach (var n in i.Noktalar) sb.Append(" (").Append(n[0].ToString("0.###", CultureInfo.InvariantCulture)).Append(',').Append(n[1].ToString("0.###", CultureInfo.InvariantCulture)).Append(')');
                        sb.Append(';');
                    }
                    gorunum.Add(sb.ToString());
                }
                if (gorunum.Count != 6) Console.WriteLine("    aynı görünen varyant: " + aile);
                Esit(6, gorunum.Count, "simge: " + aile + " altı durumu birbirinden farklı");
            }
            Esit(0, eksik, "simge: her aile için 6 varyant var (yeni, mevcut, DMM, DM, kesik, sökük)");
            var kafesMevcut = Semboller.Bul("SH_KAFES_AG_MEVCUT");
            var kafesDm = Semboller.Bul("SH_KAFES_AG_DM");
            Func<Sembol, int> tasan = x => x.Ilkeller.FindAll(i => i.Tur == "L" && Math.Max(Math.Abs(i.Sayilar[0]), Math.Abs(i.Sayilar[2])) > x.YariGenislik + 1).Count;
            Esit(0, tasan(kafesMevcut), "simge: mevcut kafes direkte simgeden taşan çizgi yok");
            Esit(1, tasan(kafesDm), "simge: demontaj kafes direkte taşan çapraz (mevcuttan ayrılır)");
            Esit(true, kafesDm.Kapsam > kafesDm.YariGenislik + 1, "simge: ailenin kapsamı demontaj işaretini içerir");
            Esit(0, bos, "simge: geometrisi boş sembol yok");
            var orn = Semboller.Bul("SH_KAFES_OG_YENI");
            Esit(3.0, orn != null ? orn.YariGenislik : 0, "simge: KAFES_OG yarı genişliği 3 m");
            Esit(null, Semboller.Bul("SH_DIREK"), "simge: eski SH_DIREK adı tabloda yok (eklenti basit daire çizer)");
        }

        /// <summary>Tüm sembolleri ilkel ilkel yazar (telefonun JS tablosuyla karşılaştırmak için).</summary>
        private static void SembolDokumu(string hedef)
        {
            var sb = new StringBuilder();
            foreach (var s in Semboller.Hepsi())
            {
                sb.Append(s.Ad).Append('\t').Append(s.YariGenislik.ToString("0.####", CultureInfo.InvariantCulture)).Append('\t').Append(s.Ilkeller.Count).Append('\n');
                foreach (var i in s.Ilkeller)
                {
                    sb.Append("  ").Append(i.Tur);
                    foreach (var d in i.Sayilar) sb.Append(' ').Append(d.ToString("0.####", CultureInfo.InvariantCulture));
                    foreach (var n in i.Noktalar) sb.Append(' ').Append(n[0].ToString("0.####", CultureInfo.InvariantCulture)).Append(',').Append(n[1].ToString("0.####", CultureInfo.InvariantCulture));
                    if (i.Tur == "P") sb.Append(i.Kapali ? " kapali" : " acik");
                    sb.Append('\n');
                }
            }
            if (hedef != null) { File.WriteAllText(hedef, sb.ToString(), new UTF8Encoding(false)); Console.WriteLine("yazıldı: " + hedef); }
            else Console.Write(sb.ToString());
        }

        private static void Esit(object beklenen, object gercek, string ad)
        {
            bool ok;
            if (beklenen is double b && gercek is double g) ok = Math.Abs(b - g) < 1e-6;
            else ok = Equals(beklenen, gercek);
            Console.WriteLine((ok ? "  ✓ " : "  ✗ ") + ad + (ok ? "" : "  beklenen=" + beklenen + " gerçek=" + gercek));
            if (!ok) _hata++;
        }

        // ---------------- Birim testleri (örnek döküm) ----------------

        private static void Ornek(string yol)
        {
            Console.WriteLine("Örnek döküm: " + yol);
            SembolleriYukle();
            Esit(16.8, SayiCoz.Coz("16,8"), "Türkçe ondalık");
            Esit(0.0, SayiCoz.Coz(",00"), "',00' sıfırdır");
            Esit(10.5, SayiCoz.Coz("10.5"), "noktalı ondalık");
            Esit("OG/AG", KanalKodu.Kablolar(12), "kanal kodu 12 = OG + AG");
            Esit("/AG/AYD/REK", KanalKodu.Kablolar(7), "kanal kodu 7 = AG + AYD + REK");
            string og, ag;
            Katsayilar.KanalUnsurlari("0104", out og, out ag);
            Esit("0104", og, "kanal OG tarifesi"); Esit("0105", ag, "kanal AG tarifesi");

            var varliklar = CadVarlik.DokumOku(File.ReadAllText(yol, Encoding.UTF8));
            var p = NesneOkuyucu.Oku(varliklar, "ornek.dwg");
            Esit(2, p.Bolgeler.Count, "bölge sayısı");
            Esit(1, p.Noktalar.Count, "GPS noktası");
            Esit(3, p.Elemanlar.Count, "eleman sayısı");
            Esit(2, p.Hatlar.Count, "hat sayısı");
            Esit(1, p.Kanallar.Count, "kanal sayısı");
            Esit(1, p.Sondajlar.Count, "sondaj sayısı");
            Esit("SC", p.KatmanOnEki, "katman ön eki");
            Esit(2, p.AktifHakedis, "en büyük hakediş");

            var direk = p.Elemanlar.Find(e => e.GisId == "SC77");
            Esit("AG_DIREK", direk.Tur, "direk türü");
            Esit("B1", direk.Bolge, "direk bölgesi (iki bölgenin kesişiminde küçük olan)");
            Esit(2, direk.Kalemler.Count, "direk kalemleri");
            Esit(36.946, direk.Kalemler[1].Toplam, "travers kg");
            var disari = p.Elemanlar.Find(e => e.GisId == "SC99");
            Esit("B2", disari.Bolge, "bölge dışındaki direk en yakın bölgeye");
            var demontaj = p.Elemanlar.Find(e => e.Durum == "DM");
            Esit("KESİK", demontaj.DmDurum, "demontaj durumu");

            // Proje dosyası gidip gelme
            string json = ProjeDosyasi.Yaz(p, "test");
            var p2 = ProjeDosyasi.Oku(json);
            Esit(ProjeDosyasi.Yaz(p2, "test").Length, json.Length, "proje dosyası gidip gelince aynı kalır");

            var dt = new DurumTespit(p);
            var kanal = dt.Satirlar.FindAll(s => s.Cins == "KABLO_KANALI");
            Esit(2, kanal.Count, "OG+AG kanal iki satıra bölünür");
            Esit(10.0, kanal[0].Toplam + kanal[1].Toplam, "kanal hacmi korunur");
            Esit(5.0, kanal[0].Toplam, "OG payı %50");
            var tel = dt.Satirlar.FindAll(s => s.Cins == "AL_İLETKENLER");
            Esit(2, tel.Count, "4P+R iki tel türüne açılır");
            var rose = tel.Find(s => s.Tip == "ROSE");
            Esit(100.0, rose.Miktar, "ROSE metre (1 tel × 100 m)");
            Esit(5.915, rose.Toplam, "ROSE kg");
            var pansy = tel.Find(s => s.Tip == "PANSY");
            Esit(400.0, pansy.Miktar, "PANSY metre (4 tel × 100 m)");
            Esit(false, dt.Satirlar.Exists(s => s.Cins == "8"), "kanalın kendi satırı rapora girmez");
            Esit("KESİK", dt.Satirlar.Find(s => s.Durum == "DM" && s.Cins == "AG_DEMİR").DmDurum, "DM DRM sütunu");

            string xlsx = Path.Combine(Path.GetTempPath(), "sebeke-test.xlsx");
            RaporYazici.Yaz(p, xlsx, "test");
            Esit(true, new FileInfo(xlsx).Length > 2000, "Excel dosyası yazıldı");

            // Yazıcı: AutoCAD çiziminden okunan proje yeniden çizim nesnesine yazılıp okununca aynı rapor
            GidisDonus(p, "ornek-dokum");
            // Telefonun yazdığı proje dosyası okunur ve çizime yazılabilir
            string telYol = Path.Combine(AppContext.BaseDirectory, "telefon-proje.sebeke.json");
            var tp = ProjeDosyasi.Oku(File.ReadAllText(telYol, Encoding.UTF8));
            Esit(true, tp.Elemanlar.Count > 20, "telefon projesi okundu");
            GidisDonus(tp, "telefon-proje");
            TelefonDosyasi(tp);
            // VOLT-EDAŞ Saha'nın yazdığı dosya (telefon/web/tests/sebeke.test.mjs çıktısı): boş çizime aktarılır, rapor aynı kalır
            Console.WriteLine("VOLT-EDAŞ Saha dosyası:");
            string voltYol = Path.Combine(AppContext.BaseDirectory, "volt-telefon.sebeke.json");
            var vt = ProjeDosyasi.Oku(File.ReadAllText(voltYol, Encoding.UTF8));
            Esit(10, vt.Elemanlar.Count, "telefon dosyası: 10 eleman");
            Esit(3, vt.Hatlar.Count, "telefon dosyası: 3 hat");
            Esit(1, vt.Kanallar.Count, "telefon dosyası: 1 kanal");
            Esit("ENH_DIREK", vt.Elemanlar[0].Tur, "telefon dosyası: OG direk ENH_DIREK");
            Esit("G-D-10 (sw)", vt.Elemanlar[0].Tip, "telefon dosyası: direk tipi AutoCAD yazımıyla");
            Esit(true, vt.Elemanlar[0].TelefonId.Length > 10, "telefon dosyası: telefonId dolu");
            Esit("SH_KAFES_OG_YENI", Semboller.BlokAdi(vt.Elemanlar[0]), "telefon dosyası: OG demir direk simgesi");
            Esit(279.0, vt.Elemanlar[0].Kalemler[0].Toplam, "telefon dosyası: direk kg");
            var vdt = new DurumTespit(vt);
            Esit(true, vdt.Satirlar.Exists(r => r.Cins == "AL_İLETKENLER" && r.Tip == "SWALLOW"), "telefon dosyası: OG hattı tel tel açılır");
            Esit(true, vdt.Satirlar.Exists(r => r.Cins == "KABLO_KANALI" && r.Tip == "ASFALT"), "telefon dosyası: kanal paylaştırılır");
            BosaAktar(voltYol);
            Esit("SC_1.HAK.AGDİR", NesneYazici.ElemanKatmani("SC", "AG_DIREK", "M", 1), "katman: hakediş");
            Esit("SC_DEMONTAJ", NesneYazici.ElemanKatmani("SC", "AG_DIREK", "DM", 3), "katman: demontaj");
            Esit("SC_STANDART", NesneYazici.ElemanKatmani("SC", "KOFRE", "M+M", 2), "katman: kofre");
            Esit("SC_2.HAK.OG_YER_XLPE", NesneYazici.HatKatmani("SC", "OG_YERALTI", "DM+M", 2), "katman: OG yeraltı");
            Esit("16,8", NesneYazici.Sayi(16.8), "Türkçe ondalık yazımı");
            Esit("0,00", NesneYazici.Fiyat(0), "fiyat yazımı");

            CizimAraclari();
            TelefondanAlma(varliklar, tp);
            RaporUyumu(varliklar, xlsx);
            OnayAkisi(varliklar);
            HesapMerkezi_(tp);
        }

        // ---------------- Hesap Merkezi: kayıt, güncellik, bağlam, sunucu ----------------

        private static void HesapMerkezi_(Proje tp)
        {
            Console.WriteLine("Hesap Merkezi:");
            // İletken anahtarı (platformlar arası karşılaştırma): telefon ve AutoCAD yazımları aynı anahtarı verir
            Esit("ACSR:SWALLOW", HesapGuncellik.IletkenAnahtari("3xSW"), "iletken anahtarı: 3xSW");
            Esit("ACSR:SWALLOW", HesapGuncellik.IletkenAnahtari("3xSwallow"), "iletken anahtarı: 3xSwallow");
            Esit("ACSR:SWALLOW", HesapGuncellik.IletkenAnahtari("2(3xSW)"), "iletken anahtarı: çift devre 2(3xSW)");
            Esit("ACSR:RAVEN", HesapGuncellik.IletkenAnahtari("3x1\\0"), "iletken anahtarı: 3x1\\0 = Raven");
            Esit("ACSR:PIGEON", HesapGuncellik.IletkenAnahtari("2(3x3/0)"), "iletken anahtarı: 2(3x3/0) = Pigeon");
            Esit("ABC:3x50+70", HesapGuncellik.IletkenAnahtari("3X50/16+70 ALPEK"), "iletken anahtarı: ALPEK");
            Esit("ABC:3x50+70", HesapGuncellik.IletkenAnahtari("3x50/16+70 AER"), "iletken anahtarı: AER (telefon yazımı)");
            Esit("NAYY:3x95", HesapGuncellik.IletkenAnahtari("3x95+50 Nyy Alm."), "iletken anahtarı: Nyy Alm.");
            Esit("NAYY:3x95", HesapGuncellik.IletkenAnahtari("NAYY 3x95+50"), "iletken anahtarı: NAYY");
            Esit("XLPE-AL:150", HesapGuncellik.IletkenAnahtari("1x150/25 Xlpe Alm."), "iletken anahtarı: XLPE Alm.");
            Esit("AAC:3P+R", HesapGuncellik.IletkenAnahtari("3P+R"), "iletken anahtarı: 3P+R");
            Esit(null, HesapGuncellik.IletkenAnahtari("G-10I"), "iletken anahtarı: direk tipi iletken değil");

            // Güncellik: yol okuma ve farklar
            var baglam = (JsonNesne)Json.Oku("{\"hat\":{\"acikliklar\":[{\"uzunluk\":39.55},{\"uzunluk\":35}],\"iletkenler\":[{\"ad\":\"3X50/16+70 ALPEK\"}]},\"direk\":{\"tip\":\"G-10I\",\"kot\":null}}");
            bool yok;
            Esit(35.0, HesapGuncellik.Deger(baglam, "hat.acikliklar[1].uzunluk", out yok), "güncellik: dizi yolu");
            Esit(false, yok, "güncellik: yol bulundu");
            HesapGuncellik.Deger(baglam, "hat.acikliklar[5].uzunluk", out yok);
            Esit(true, yok, "güncellik: olmayan dizin bulunamadı");
            var kullanilan = (JsonNesne)Json.Oku("{\"hat.acikliklar[0].uzunluk\":39.55,\"hat.acikliklar[1].uzunluk\":36,\"hat.iletkenler[0].ad\":\"3x50/16+70 AER\",\"direk.tip\":\"G-10I\",\"direk.kot\":null,\"trafo.gucKVA\":160}");
            var farklar = HesapGuncellik.Farklar(kullanilan, baglam);
            Esit(3, farklar.Count, "güncellik: uzunluk, iletken yazımı ve silinen trafo fark (aynı platform)");
            var farklar2 = HesapGuncellik.Farklar(kullanilan, baglam, true);
            Esit(2, farklar2.Count, "güncellik: platformlar arası iletken yazımı fark sayılmaz");
            Esit(true, farklar2.Exists(f => f.Yol == "trafo.gucKVA" && f.Silindi), "güncellik: silinen bilgi işaretlenir");
            Esit(true, farklar2.Exists(f => f.Yol == "hat.acikliklar[1].uzunluk" && Equals(f.Yeni, 35.0)), "güncellik: yeni değer");

            // Kayıt: JSON gidip gelme
            var k = new HesapKaydi
            {
                Id = HesapKaydi.YeniKimlik(), Modul = "ag-gd", ModulAdi = "AG Gerilim Düşümü", ModulSurumu = "abc123", HedefTur = "trafo", HedefId = "D1", HedefNo = "SCTR01",
                HedefHatId = "H14", Ozet = "%1,57 · uygun", Durum = "uygun", ModulDurumu = "{\"kols\":[1,2]}", Tarih = HesapKaydi.Simdi(), Kaynak = "autocad", Yapan = "Ayşe", TelefonId = "tel-1",
            };
            k.HedefParcalar.AddRange(new[] { "H14", "H15" });
            k.Kullanilan["trafo.gucKVA"] = 160.0;
            k.Ayrinti["girdiler"] = new List<object> { (JsonNesne)Json.Oku("{\"ad\":\"Güç\",\"deger\":160,\"birim\":\"kVA\"}") };
            Esit(true, k.Id.StartsWith("H") && k.Id.Length > 20, "kayıt: kimlik üretimi");
            Esit(true, k.Tarih.EndsWith("Z") && k.Tarih.Length == 24, "kayıt: ISO UTC tarih");
            var k2 = HesapKaydi.Oku((JsonNesne)Json.Oku(Json.Yaz(k.Json(), false)));
            Esit(k.Id, k2.Id, "kayıt: kimlik gidip gelir");
            Esit("H14", k2.HedefHatId, "kayıt: trafo çıkışı (hatId) gidip gelir");
            Esit(2, k2.HedefParcalar.Count, "kayıt: parçalar gidip gelir");
            Esit("{\"kols\":[1,2]}", k2.ModulDurumu, "kayıt: modül durumu metin olarak gidip gelir");
            Esit("tel-1", k2.TelefonId, "kayıt: telefon kimliği");
            Esit("Güç = 160 kVA", k2.Satirlar("girdiler")[0], "kayıt: rapor satırı");
            Esit(k.HedefAnahtari, k2.HedefAnahtari, "kayıt: hedef anahtarı");
            Esit(true, k2.HedefAyni(new HesapHedefi { Tur = "trafo", Id = "D1", HatId = "H14" }), "kayıt: aynı trafo ve çıkış");
            Esit(false, k2.HedefAyni(new HesapHedefi { Tur = "trafo", Id = "D1", HatId = "" }), "kayıt: aynı trafo, çıkışsız = ayrı kayıt");
            var hatKaydi = new HesapKaydi { Id = "x", Modul = "enh-sehim", HedefTur = "hat", HedefId = "H15" };
            hatKaydi.HedefParcalar.AddRange(new[] { "H15", "H16" });
            Esit(true, hatKaydi.HedefAyni(new HesapHedefi { Tur = "hat", Id = "H16" }), "kayıt: hattın başka parçasından açılan hesap aynı hat");

            // Proje dosyası: hesaplar gidip gelir
            tp.Hesaplar.Clear();
            tp.Hesaplar.Add(k);
            var tp2 = ProjeDosyasi.Oku(ProjeDosyasi.Yaz(tp, "test"));
            Esit(1, tp2.Hesaplar.Count, "proje dosyası: hesap kaydı yazılır ve okunur");
            Esit("ag-gd", tp2.Hesaplar[0].Modul, "proje dosyası: modül");
            Esit(160.0, tp2.Hesaplar[0].Kullanilan["trafo.gucKVA"], "proje dosyası: kullanılan değerler");
            var volt = ProjeDosyasi.Oku(ProjeDosyasi.VoltYaz(tp, "test"));
            Esit(1, volt.Hesaplar.Count, "telefon dosyası (.volt.json): hesap kaydı taşınır");

            // Bağlam: telefon projesindeki AG hattı, direk ve trafo
            var bilgi = new ProjeBilgisi { Ad = "Deneme", Yapan = "Ayşe", BuzBolgesi = "3" };
            var direkHedefi = new HesapHedefi { Tur = "direk", Id = "D6" };
            var bd = HesapBaglami.Kur(tp, direkHedefi, bilgi);
            Esit("SC104", direkHedefi.No, "bağlam: direk numarası hedefe yazılır");
            var direk = bd.Nesne("direk");
            Esit("G-12I", direk.Metin("tip"), "bağlam: direk tipi");
            Esit("demir", direk.Metin("malzeme"), "bağlam: direk malzemesi");
            Esit("T", direk.Metin("rol"), "bağlam: iki kollu düz direk taşıyıcı");
            Esit(2, direk.Dizi("kollar").Count, "bağlam: direğin iki kolu");
            var kol = (JsonNesne)direk.Dizi("kollar")[0];
            Esit(true, kol.Ondalik("aciklik") > 39 && kol.Ondalik("aciklik") < 40, "bağlam: kol açıklığı 39,5 m");
            Esit("3X50/16+70 ALPEK", ((JsonNesne)kol.Dizi("iletkenler")[0]).Metin("ad"), "bağlam: kol iletkeni");
            Esit("3", bd.Nesne("proje").Metin("buzBolgesi"), "bağlam: buz bölgesi ayarlardan");
            Esit(true, bd.Nesne("hat") != null, "bağlam: direğin üzerindeki hat");
            var hatHedefi = new HesapHedefi { Tur = "hat", Id = "H17" };
            var bh = HesapBaglami.Kur(tp, hatHedefi, bilgi);
            var hat = bh.Nesne("hat");
            Esit(11, hatHedefi.Parcalar.Count, "bağlam: hat zinciri trafodan son direğe parçalardan kurulur (dallanma noktasından düz geçer)");
            Esit("H14", hat.Metin("id"), "bağlam: zincir trafodan başlar");
            Esit(true, hat.Dizi("acikliklar").Count == hatHedefi.Parcalar.Count, "bağlam: her parça bir açıklık");
            Esit(true, hat.Ondalik("toplamUzunluk") > 400, "bağlam: toplam uzunluk");
            Esit(true, hat.Ondalik("ruling") > 35 && hat.Ondalik("ruling") < 40, "bağlam: eşdeğer açıklık");
            Esit("AG_HAVAI", hat.Metin("tur"), "bağlam: hat türü");
            Esit(true, bh.Nesne("trafo") != null && bh.Nesne("trafo").Metin("no") == "SCTR01", "bağlam: hattın başındaki trafo");
            Esit(true, bh.Dizi("zincir") != null && bh.Dizi("zincir").Count == hat.Dizi("acikliklar").Count, "bağlam: zincir (gerilim düşümü / kısa devre için)");
            Esit(true, HesapBaglami.HedefVar(tp, hatHedefi), "bağlam: hat hedefi var");
            Esit(false, HesapBaglami.HedefVar(tp, new HesapHedefi { Tur = "direk", Id = "YOK" }), "bağlam: silinmiş hedef");
            var cikislar = HesapBaglami.TrafoCikislari(tp, "D1");
            Esit(true, cikislar.Exists(h => h.Id == "H14"), "bağlam: trafonun AG havai çıkışı");
            Esit(true, cikislar.Exists(h => h.Id == "H54"), "bağlam: trafonun AG yeraltı çıkışı");
            var trafoHedefi = new HesapHedefi { Tur = "trafo", Id = "D1", HatId = "H14" };
            var bt = HesapBaglami.Kur(tp, trafoHedefi, bilgi);
            Esit("SCTR01", trafoHedefi.No, "bağlam: trafo numarası");
            Esit(true, bt.Nesne("trafo") != null, "bağlam: trafo bilgisi");
            Esit(true, bt.Nesne("hat") != null && bt.Nesne("hat").Metin("id") == "H14", "bağlam: seçilen çıkış hattı");
            Esit("SCTR01–SC111", HesapBaglami.HatAdi(tp, tp.Hatlar.Find(h => h.Id == "H18")), "bağlam: hat adı uç elemanlardan (dallanmada düz devam)");
            Esit("SC101–D30", HesapBaglami.HatAdi(tp, tp.Hatlar.Find(h => h.Id == "H36")), "bağlam: dallanan kol (numarasız direğe kadar)");
            var kanalHedefi = new HesapHedefi { Tur = "kanal", Id = "K56" };
            var bk = HesapBaglami.Kur(tp, kanalHedefi, bilgi);
            Esit(true, bk.Nesne("kanal") != null && bk.Nesne("kanal").Ondalik("uzunluk") > 238, "bağlam: kanal uzunluğu");
            Esit("TOPRAK", bk.Nesne("kanal").Metin("zemin"), "bağlam: kanal zemini");
            var pb = HesapBaglami.Kur(tp, new HesapHedefi { Tur = "proje" }, bilgi);
            Esit("Proje geneli", pb.Nesne("hedef").Metin("ad"), "bağlam: proje geneli");
            // Kayıt durumu: hedef silinmişse
            bool hedefYok;
            HesapGuncellik.Durum(tp, new HesapKaydi { Id = "y", Modul = "amax", HedefTur = "direk", HedefId = "YOK" }, bilgi, "autocad", out hedefYok);
            Esit(true, hedefYok, "güncellik: silinmiş hedef");
            var kayit = new HesapKaydi { Id = "z", Modul = "ag-gd", HedefTur = "trafo", HedefId = "D1", HedefHatId = "H14", Kaynak = "telefon" };
            kayit.Kullanilan["trafo.no"] = "SCTR01";
            kayit.Kullanilan["hat.acikliklar[0].uzunluk"] = 39.55;
            kayit.Kullanilan["hat.iletkenler[0].ad"] = "3x50/16+70 AER";
            var fk = HesapGuncellik.Durum(tp, kayit, bilgi, "autocad", out hedefYok);
            Esit(false, hedefYok, "güncellik: trafo hedefi var");
            Esit(0, fk.Count, "güncellik: telefon kaydı AutoCAD bağlamıyla güncel (yazım farkı sayılmaz)");
            kayit.Kullanilan["hat.acikliklar[0].uzunluk"] = 50.0;
            fk = HesapGuncellik.Durum(tp, kayit, bilgi, "autocad", out hedefYok);
            Esit(1, fk.Count, "güncellik: değişen açıklık fark");

            // Rapor: HESAPLAR sayfası
            string rapor = Path.Combine(Path.GetTempPath(), "sebeke-m-hesap-rapor.xlsx");
            RaporYazici.Yaz(tp, rapor, "test", null, bilgi);
            using (var zip = System.IO.Compression.ZipFile.OpenRead(rapor))
            {
                string wb;
                using (var r = new StreamReader(zip.GetEntry("xl/workbook.xml").Open())) wb = r.ReadToEnd();
                Esit(true, wb.Contains("HESAPLAR"), "rapor: HESAPLAR sayfası var");
                bool satirVar = false;
                foreach (var e in zip.Entries)
                    if (e.FullName.StartsWith("xl/") && (e.FullName.Contains("sharedStrings") || e.FullName.Contains("worksheets/")))
                        using (var r = new StreamReader(e.Open())) { string m = r.ReadToEnd(); if (m.Contains("%1,57") && m.Contains("Güncel")) satirVar = true; }
                Esit(true, satirVar, "rapor: hesap satırı özet ve güncellik");
            }
            try { File.Delete(rapor); } catch { }

            SunucuDene();
        }

        /// <summary>Yerel sunucu: dosya, API, yanlış anahtar, yanlış Host, yol kaçışı.</summary>
        private static void SunucuDene()
        {
            var dosyalar = new Dictionary<string, byte[]>
            {
                { "merkez.html", Encoding.UTF8.GetBytes("<html>merkez</html>") },
                { "ortak/kopru.js", Encoding.UTF8.GetBytes("// köprü") },
            };
            string sonIstek = null;
            using (var s = new HesapSunucu(y => dosyalar.ContainsKey(y) ? dosyalar[y] : null, (ad, govde) => { sonIstek = ad + ":" + govde; return ad == "basla" ? "{\"ok\":true}" : null; }))
            {
                Esit(32, s.Anahtar.Length, "sunucu: 128 bit anahtar");
                Esit(true, s.Kok.StartsWith("http://127.0.0.1:") && s.Kok.EndsWith("/" + s.Anahtar + "/"), "sunucu: kök adres");
                using (var h = new System.Net.Http.HttpClient(new System.Net.Http.HttpClientHandler { AllowAutoRedirect = false }))
                {
                    h.Timeout = TimeSpan.FromSeconds(10);
                    var r1 = h.GetAsync(s.Kok + "merkez.html").Result;
                    Esit(200, (int)r1.StatusCode, "sunucu: sayfa 200");
                    Esit("<html>merkez</html>", r1.Content.ReadAsStringAsync().Result, "sunucu: sayfa içeriği");
                    Esit("text/html", r1.Content.Headers.ContentType.MediaType, "sunucu: içerik türü");
                    var r2 = h.GetAsync(s.Kok).Result;
                    Esit("<html>merkez</html>", r2.Content.ReadAsStringAsync().Result, "sunucu: kök → merkez.html");
                    var r3 = h.GetAsync(s.Kok + "ortak/kopru.js").Result;
                    Esit("application/javascript", r3.Content.Headers.ContentType.MediaType, "sunucu: betik türü");
                    var r4 = h.GetAsync(s.Kok + "yok.html").Result;
                    Esit(404, (int)r4.StatusCode, "sunucu: olmayan dosya 404");
                    var r5 = h.GetAsync(s.Kok.Replace(s.Anahtar, new string('0', 32)) + "merkez.html").Result;
                    Esit(404, (int)r5.StatusCode, "sunucu: yanlış anahtar 404");
                    var r6 = h.GetAsync(s.Kok.TrimEnd('/')).Result;
                    Esit(302, (int)r6.StatusCode, "sunucu: anahtar kökü → yönlendirme");
                    var r7 = h.PostAsync(s.Kok + "api/basla", new System.Net.Http.StringContent("{\"modul\":\"amax\"}", Encoding.UTF8, "application/json")).Result;
                    Esit(200, (int)r7.StatusCode, "sunucu: api 200");
                    Esit("{\"ok\":true}", r7.Content.ReadAsStringAsync().Result, "sunucu: api yanıtı");
                    Esit("basla:{\"modul\":\"amax\"}", sonIstek, "sunucu: api gövdesi iletilir");
                    var r8 = h.GetAsync(s.Kok + "api/basla").Result;
                    Esit(405, (int)r8.StatusCode, "sunucu: api GET 405");
                    var r9 = h.PostAsync(s.Kok + "api/yok", new System.Net.Http.StringContent("{}", Encoding.UTF8, "application/json")).Result;
                    Esit(404, (int)r9.StatusCode, "sunucu: bilinmeyen api 404");
                    var istek = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Post, s.Kok + "api/basla");
                    istek.Content = new System.Net.Http.StringContent("{}", Encoding.UTF8, "application/json");
                    istek.Headers.TryAddWithoutValidation("Origin", "http://kotu.example");
                    var r10 = h.SendAsync(istek).Result;
                    Esit(403, (int)r10.StatusCode, "sunucu: yabancı köken 403");
                }
                // Soketsiz: Host ve yol denetimleri
                var ist = new HesapSunucu.Istek { Yontem = "GET", Yol = "/" + s.Anahtar + "/merkez.html" };
                ist.Basliklar["Host"] = "evil.example:" + s.Kapi;
                Esit(403, s.Yanitla(ist).Kod, "sunucu: yabancı Host 403 (DNS yeniden bağlama)");
                ist.Basliklar["Host"] = "127.0.0.1:" + s.Kapi;
                Esit(200, s.Yanitla(ist).Kod, "sunucu: doğru Host 200");
                ist.Yol = "/" + s.Anahtar + "/ortak/../merkez.html";
                Esit(404, s.Yanitla(ist).Kod, "sunucu: yol kaçışı 404");
                ist.Yol = "/" + s.Anahtar + "/ortak\\kopru.js";
                Esit(404, s.Yanitla(ist).Kod, "sunucu: ters bölü 404");
                var ham = new MemoryStream(Encoding.ASCII.GetBytes("POST /x HTTP/1.1\r\nHost: a\r\nContent-Length: 2\r\n\r\n{}"));
                var okunan = HesapSunucu.IstekOku(ham);
                Esit("POST", okunan.Yontem, "sunucu: istek okuma yöntem");
                Esit("{}", Encoding.UTF8.GetString(okunan.Govde), "sunucu: istek gövdesi");
            }
        }

        // ---------------- Hakediş onayı (AutoCAD HAK_ONAY) ve kilit ----------------

        private static void OnayAkisi(List<CadVarlik> ornekCizim)
        {
            Console.WriteLine("Hakediş onayı");
            Esit(6, HakedisOnayi.Duzelt(HakedisOnayi.Hakedis), "onay sırası: hakediş onayı kontrolü de işaretler");
            Esit(7, HakedisOnayi.Duzelt(HakedisOnayi.Gis), "onay sırası: GIS onayı hepsini işaretler");
            var on = new SortedDictionary<int, int> { { 1, 6 }, { 2, 4 } };
            Esit(true, HakedisOnayi.Kilitli(on, 1), "hakediş onayı verilen hakediş kilitli");
            Esit(false, HakedisOnayi.Kilitli(on, 2), "yalnız kontrol onayı kilitlemez");
            var bir = HakedisOnayi.Birlestir(on, new SortedDictionary<int, int> { { 2, 2 }, { 3, 1 } });
            Esit(6, bir[2], "birleştirme: telefondaki hakediş onayı kontrolü de getirir");
            Esit(7, bir[3], "birleştirme: GIS onayı sıradakileri de getirir");
            Esit(6, bir[1], "birleştirme: çizimdeki onay kalır");

            var cizim = new List<CadVarlik>();
            foreach (var v in ornekCizim) cizim.Add(CadVarlik.JsondanOku(v.JsonYap()));
            var p = NesneOkuyucu.Oku(cizim, "ornek.dwg");
            p.Onaylar[1] = 6; p.Onaylar[2] = 7;
            var pd = ProjeDosyasi.Oku(ProjeDosyasi.Yaz(p, "test"));
            Esit(6, HakedisOnayi.Bitler(pd.Onaylar, 1), "onaylar proje dosyasında taşınır (1)");
            Esit(7, HakedisOnayi.Bitler(pd.Onaylar, 2), "onaylar proje dosyasında taşınır (2)");
            Esit(0, Aktarim.Planla(cizim, pd, "SC", pd.Onaylar).Adimlar.Count, "onaylı projede değişiklik yoksa iş yok");

            // Onaylı hakedişteki direk telefonda taşınırsa aktarılmaz; aynı değişiklik onaysız hakedişte aktarılır
            var direk = pd.Elemanlar.Find(x => x.GisId == "SC77");
            var kilit = new SortedDictionary<int, int> { { direk.Hakedis, 6 } };
            var acik = new SortedDictionary<int, int> { { 99, 6 } };
            direk.Saga += 2;
            var plan = Aktarim.Planla(cizim, pd, "SC", kilit);
            Esit(true, plan.Kilitliler.Exists(a => a.Hedef == direk.Id) && !plan.Adimlar.Exists(a => a.Hedef == direk.Id), "kilit: onaylı hakedişteki direğin taşınması aktarılmaz");
            plan = Aktarim.Planla(cizim, pd, "SC", acik);
            Esit(true, plan.Adimlar.Exists(a => a.Hedef == direk.Id) && plan.Kilitliler.Count == 0, "kilit: onaysız hakedişte aynı değişiklik aktarılır");
            direk.Saga -= 2;

            // Kilitli direğe açık hakedişte yeni malzeme eklemek serbest (AutoCAD'de satır düzeyinde yetki)
            int acikHakedis = direk.Hakedis + 1;
            direk.Kalemler.Add(new Kalem { Cins = "TOPRAKLAMA", Tanim = "T-1", Durum = "M", Miktar = 1, Birim = "ad/ad", Katsayi = 1, Toplam = 1, Hakedis = acikHakedis, Tarife = "0107", Sira = "9100", Kaynak = "MALZEME" });
            plan = Aktarim.Planla(cizim, pd, "SC", kilit);
            Esit(true, plan.Adimlar.Exists(a => a.Hedef == direk.Id) && plan.Kilitliler.Count == 0, "kilit: onaylı direğe açık hakedişte malzeme eklenebilir");
            // Kilitli satır değişirse (miktar) aktarılmaz
            var kilitliSatir = direk.Kalemler.Find(k => !k.Ana && k.Hakedis == direk.Hakedis);
            if (kilitliSatir != null)
            {
                kilitliSatir.Miktar += 1;
                plan = Aktarim.Planla(cizim, pd, "SC", kilit);
                Esit(true, plan.Kilitliler.Exists(a => a.Hedef == direk.Id), "kilit: onaylı hakedişteki satırın miktarı değişmez");
                kilitliSatir.Miktar -= 1;
            }
            direk.Kalemler.RemoveAt(direk.Kalemler.Count - 1);

            // Onaylı hakedişe telefonda yeni nesne: aktarılmaz; telefonda silinen kilitli nesne: silinmez
            var yeni = new Eleman
            {
                Id = "TkOnay", Tur = "AG_DIREK", GisId = "SC500", Cins = "AG_DEMİR_GLV", Tip = "G-K2", Durum = "M", Hakedis = direk.Hakedis, Saga = direk.Saga + 40, Yukari = direk.Yukari,
                Kalemler = { new Kalem { Cins = "AG_DEMİR_GLV", Tanim = "G-K2", Durum = "M", Miktar = 1, Birim = "ad/kg", Katsayi = 504, Toplam = 504, Hakedis = direk.Hakedis, Tarife = "0107", Sira = "9101", Ana = true, Kaynak = "NIT" } },
            };
            pd.Elemanlar.Add(yeni);
            pd.Elemanlar.Remove(direk);
            plan = Aktarim.Planla(cizim, pd, "SC", kilit);
            Esit(true, plan.Kilitliler.Exists(a => a.Kimlik == "TkOnay" && a.Islem == "yeni"), "kilit: onaylı hakedişe yeni nesne aktarılmaz");
            Esit(true, plan.KilitliSilinenler.ContainsKey(direk.Id) && !plan.Silinenler.ContainsKey(direk.Id), "kilit: onaylı hakedişteki nesne telefonda silinse de silinmez");
            yeni.Hakedis = acikHakedis; yeni.Kalemler[0].Hakedis = acikHakedis;
            plan = Aktarim.Planla(cizim, pd, "SC", kilit);
            Esit(true, plan.Adimlar.Exists(a => a.Kimlik == "TkOnay" && a.Islem == "yeni"), "kilit: açık hakedişe yeni nesne aktarılır");
        }

        // ---------------- AutoCAD uyumu: bölge grup kodu, pano/fider verisi, eksik malzeme (DETAY) ----------------

        private static void RaporUyumu(List<CadVarlik> ornekCizim, string xlsx)
        {
            Console.WriteLine("AutoCAD uyumu");
            var cizim = new List<CadVarlik>();
            foreach (var v in ornekCizim) cizim.Add(CadVarlik.JsondanOku(v.JsonYap()));

            // 1) Bölge grup kodu (FULLREG'in üçüncü alanı) ve pano çıkış şeması (ANA / CON): okunur, yazılır, dosyada taşınır
            var bv = cizim.Find(x => x.Xd.ContainsKey("FULLREG"));
            var f0 = bv.XdIlk("FULLREG").Split(';');
            bv.Xd["FULLREG"] = new List<string> { f0[0] + ";" + (f0.Length > 1 ? f0[1] : "") + ";24.38.01 (NA)" };
            var ev = cizim.Find(x => x.Tur == "INSERT" && x.Xd.ContainsKey("NIT"));
            ev.Xd["ANA"] = new List<string> { "PANO;1" };
            ev.Xd["CON"] = new List<string> { "C1;3X50", "C2;3X35" };
            var p = NesneOkuyucu.Oku(cizim, "ornek.dwg");
            var b = p.Bolgeler.Find(x => x.Id == bv.H);
            Esit("24.38.01 (NA)", b != null ? b.Grup : null, "bölge grup kodu okunur");
            var e = p.Elemanlar.Find(x => x.Id == ev.H);
            Esit(2, e != null && e.EkVeri.ContainsKey("CON") ? e.EkVeri["CON"].Count : 0, "pano çıkış şeması (CON) okunur");
            var vb = NesneYazici.Bolge(b, "SC", null);
            Esit(true, vb.XdIlk("FULLREG").EndsWith(";24.38.01 (NA)", StringComparison.Ordinal), "grup kodu FULLREG'e yazılır");
            var ve = NesneYazici.Eleman(e, "SC", e.Blok, null);
            Esit("C2;3X35", ve.Xd.ContainsKey("CON") && ve.Xd["CON"].Count == 2 ? ve.Xd["CON"][1] : "", "pano çıkış şeması aynen geri yazılır");
            var pd = ProjeDosyasi.Oku(ProjeDosyasi.Yaz(p, "test"));
            var bd = pd.Bolgeler.Find(x => x.Id == b.Id);
            Esit("24.38.01 (NA)", bd != null ? bd.Grup : null, "grup kodu proje dosyasında taşınır");
            var ed = pd.Elemanlar.Find(x => x.Id == e.Id);
            Esit("PANO;1", ed != null && ed.EkVeri.ContainsKey("ANA") ? ed.EkVeri["ANA"][0] : "", "ANA verisi proje dosyasında taşınır");
            Esit(0, Aktarim.Planla(cizim, pd, "SC").Adimlar.Count, "grup kodu ve ek veriyle gidip gelen proje: iş yok");

            // 2) Telefon ek veriyi bilmese de (dosyada yok) çizimdeki pano çıkış şeması korunur
            ed.EkVeri.Clear();
            var plan = Aktarim.Planla(cizim, pd, "SC");
            Esit(0, plan.Adimlar.Count, "ek verisi dosyada olmayan eleman değişmiş sayılmaz");
            ed.Saga += 1;
            plan = Aktarim.Planla(cizim, pd, "SC");
            var adim = plan.Adimlar.Find(x => x.Hedef == e.Id);
            Esit(true, adim != null && adim.Varlik.Xd.ContainsKey("CON") && adim.Varlik.Xd["CON"].Count == 2, "taşınan elemanın pano çıkış şeması korunur");

            // 3) Eksik malzeme (DETAY): ara malzemesi olan / olmayan elemanlar
            var direk = p.Elemanlar.Find(x => x.GisId == "SC77");
            var ara = direk.Kalemler.Find(x => !x.Ana);
            var olan = DetaySorgu.Sorgula(p, new DetayFiltresi { Cins = ara.Cins.ToLowerInvariant(), Kapsam = DetayKapsami.Olanlar });
            Esit(true, olan.Exists(r => r.Eleman == direk && r.Malzeme == ara), "eksik malzeme: olanlarda malzeme satırı (büyük/küçük harf farkı yok)");
            Esit(true, olan.TrueForAll(r => r.Olan), "eksik malzeme: olanlarda hep malzeme var");
            var yok = DetaySorgu.Sorgula(p, new DetayFiltresi { Cins = ara.Cins, Kapsam = DetayKapsami.Olmayanlar });
            Esit(false, yok.Exists(r => r.Eleman == direk), "eksik malzeme: malzemesi olan direk eksiklerde yok");
            int beklenen = p.Elemanlar.FindAll(x => !x.Kalemler.Exists(k => !k.Ana && DetaySorgu.Uyar(ara.Cins, k.Cins))).Count;
            Esit(beklenen, yok.Count, "eksik malzeme: her eksik eleman bir satır");
            Esit(true, yok.TrueForAll(r => r.Malzeme == null), "eksik malzeme: eksik satırında malzeme sütunları boş");
            int araSayisi = 0, malzemesiz = 0;
            foreach (var x in p.Elemanlar) { int n = x.Kalemler.FindAll(k => !k.Ana).Count; araSayisi += n; if (n == 0) malzemesiz++; }
            Esit(araSayisi + malzemesiz, DetaySorgu.Sorgula(p, new DetayFiltresi()).Count, "DETAY: her ara malzeme bir satır, malzemesiz eleman bir satır");
            var anaCins = direk.Kalemler.Find(k => k.Ana).Cins;
            var suz = DetaySorgu.Sorgula(p, new DetayFiltresi { AnaCins = anaCins, Cins = "YOK_BOYLE_CINS", Kapsam = DetayKapsami.Olmayanlar });
            Esit(true, suz.Count > 0 && suz.TrueForAll(r => DetaySorgu.Uyar(anaCins, r.Ana.Cins)), "eksik malzeme: ana cins süzgeci");
            Esit(0, DetaySorgu.Sorgula(p, new DetayFiltresi { Cins = ara.Cins, Hakedis = 99, Kapsam = DetayKapsami.Olanlar }).Count, "eksik malzeme: hakediş süzgeci");
            Esit(true, DetaySorgu.Uyar("ag_demir", "AG_DEMİR"), "süzgeç: Türkçe İ/i farkı yok sayılır");
            Esit(true, DetaySorgu.Uyar("BER+2", "BER+2   "), "süzgeç: sondaki boşluklar yok sayılır");
            Esit(DetaySorgu.Basliklar.Length, DetaySorgu.Satir(olan[0]).Length, "DETAY satırı başlık sayısı kadar");
            using (var z = System.IO.Compression.ZipFile.OpenRead(xlsx))
            {
                var wb = z.GetEntry("xl/workbook.xml");
                string icerik;
                using (var r = new StreamReader(wb.Open(), Encoding.UTF8)) icerik = r.ReadToEnd();
                Esit(true, icerik.Contains("name=\"DETAY\""), "raporda DETAY sayfası var");
            }
            string dx = Path.Combine(Path.GetTempPath(), "sebeke-detay.xlsx");
            RaporYazici.DetayYaz(p, yok, dx, "test", "deneme");
            Esit(true, new FileInfo(dx).Length > 1000, "eksik malzeme sorgusu Excel'e yazılır");
        }

        // ---------------- Telefonun proje dosyası (volt-project/3) ve telefon kimlikleri ----------------

        private static void TelefonDosyasi(Proje tp)
        {
            // telefonId: çizimdeki SH_ID dosyaya yazılır, dosyadan okunur (telefon kaydını bununla bulur)
            var kopya = ProjeDosyasi.Oku(ProjeDosyasi.Yaz(tp, "test"));
            kopya.Elemanlar[0].TelefonId = "01TELEFON";
            kopya.Hatlar[0].TelefonId = "01HAT";
            string yazilan = ProjeDosyasi.Yaz(kopya, "test");
            Esit(true, yazilan.Contains("telefonId") && yazilan.Contains("01TELEFON") && yazilan.Contains("01HAT"), "telefonId dosyaya yazılır");
            var geri = ProjeDosyasi.Oku(yazilan);
            Esit("01TELEFON", geri.Elemanlar[0].TelefonId, "telefonId dosyadan okunur (eleman)");
            Esit("01HAT", geri.Hatlar[0].TelefonId, "telefonId dosyadan okunur (hat)");
            Esit("", geri.Elemanlar[1].TelefonId, "telefonId yoksa boş");
            // Telefonun tam proje dosyası: AutoCAD bölümü okunur, aynı proje
            string volt = ProjeDosyasi.VoltYaz(kopya, "test");
            Esit(true, ProjeDosyasi.VoltDosyasiMi(volt), "telefon dosyası tanınır");
            Esit(false, ProjeDosyasi.VoltDosyasiMi(yazilan), "AutoCAD dosyası telefon dosyası sayılmaz");
            var vp = ProjeDosyasi.Oku(volt);
            Esit(kopya.Elemanlar.Count, vp.Elemanlar.Count, "telefon dosyasından eleman sayısı");
            Esit(kopya.Hatlar.Count, vp.Hatlar.Count, "telefon dosyasından hat sayısı");
            Esit("01TELEFON", vp.Elemanlar[0].TelefonId, "telefon dosyasında telefonId");
            Esit(0, RaporFarki(kopya, vp), "iki biçimden aynı Durum Tespit raporu");
            // AutoCAD bölümü olmayan (eski) telefon dosyası: anlaşılır hata
            string hata = "";
            try { ProjeDosyasi.Oku("{\"format\":\"volt-project/2\",\"project\":{},\"data\":{}}"); }
            catch (FormatException ex) { hata = ex.Message; }
            Esit(true, hata.Contains("AutoCAD bölümü"), "eski telefon dosyasında anlaşılır hata");
        }

        /// <summary>İki projenin Durum Tespit satır sayısı ve kg toplamı farkı (0 = aynı).</summary>
        private static int RaporFarki(Proje a, Proje b)
        {
            var ra = new DurumTespit(a).Satirlar;
            var rb = new DurumTespit(b).Satirlar;
            if (ra.Count != rb.Count) return 1;
            double ta = 0, tb = 0;
            foreach (var s in ra) ta += s.Toplam;
            foreach (var s in rb) tb += s.Toplam;
            return Math.Abs(ta - tb) < 1e-6 ? 0 : 2;
        }

        // ---------------- Çizim araçları: numara, metraj, ayarlar, katalog, nokta dosyası ----------------

        private static void CizimAraclari()
        {
            Console.WriteLine("Çizim araçları");
            var el = new List<Eleman>();
            foreach (var g in new[] { "SC77", "SC78", "SCB12", "SCP3", "SCTR10", "HE1287/03-45", "SC9" }) el.Add(new Eleman { GisId = g });
            Esit("SC79", Numara.SonrakiGis(el, "AG_DIREK", "SC", "AG_DEMİR"), "GIS: direkler ortak sıra");
            Esit("SC79", Numara.SonrakiGis(el, "AYD_DIREK", "SC", "AYD_DEMİR"), "GIS: aydınlatma direği de aynı sırada");
            Esit("SCB13", Numara.SonrakiGis(el, "BOX", "SC", "BOX_PANO"), "GIS: box");
            Esit("SCP04", Numara.SonrakiGis(el, "PANO", "SC", "AG_PANO"), "GIS: pano en az iki hane");
            Esit("SCTR11", Numara.SonrakiGis(el, "TRAFO_MERKEZI", "SC", "BETON_KÖŞKLER"), "GIS: trafo");
            Esit("EKOG", Numara.SonrakiGis(el, "EK_MUFU", "SC", "EK_MUFU_OG_ALM"), "GIS: OG ek mufu");
            Esit("", Numara.SonrakiGis(el, "KOFRE", "SC", "KOFRA"), "GIS: kofrede numara yok");
            Esit("XY1", Numara.SonrakiGis(new List<Eleman>(), "AG_DIREK", "XY", ""), "GIS: boş projede 1'den");

            Esit(341.0, Metraj.Hat(340.2, true, 0), "metraj yukarı yuvarlanır");
            Esit(340.0, Metraj.Hat(340.0000001, true, 0), "metraj: kayan nokta kırıntısı yuvarlatmaz");
            Esit(13.0, Metraj.Hat(10.5, false, 2), "metraj: en yakına yuvarla + ek pay");
            Esit("10,5", Metraj.Yazi(10.5), "metraj yazımı ondalıklı");
            Esit("341", Metraj.Yazi(341), "metraj yazımı tam");
            Esit(10.0, Metraj.KanalHacmi(40, 40, 100, 25), "kanal hacmi");

            var a = new CizimAyarlari { KatmanOnEki = "XY", AktifHakedis = 3, Dom = 39, SembolOlcegi = 4, YukariYuvarla = false, KanalZemin = "TUVENAN" };
            a.EkPay["AG_HAVAI"] = 2.5;
            a.Son["eleman.tur"] = "BOX";
            var b = CizimAyarlari.Ciftlerden(a.Ciftler());
            Esit("XY", b.KatmanOnEki, "ayar: katman ön eki");
            Esit(3, b.AktifHakedis, "ayar: hakediş");
            Esit(39, b.Dom, "ayar: DOM");
            Esit(4.0, b.SembolOlcegi, "ayar: sembol ölçeği");
            Esit(false, b.YukariYuvarla, "ayar: yuvarlama");
            Esit(2.5, b.EkPayi("AG_HAVAI"), "ayar: ek pay");
            Esit("BOX", b.SonDeger("eleman.tur"), "ayar: son seçim");
            Esit(12.5, b.HatMetraji(10.4, "AG_HAVAI"), "ayar ile hat metrajı (en yakına + ek pay)");

            // Blok seçimi: her zaman uygulamanın simgesi; başka blokla duran eleman da yazılırken simgeye geçer
            var cizimEl = new List<Eleman>
            {
                new Eleman { Id = "1", Tur = "AG_DIREK", Durum = "M", Blok = "YENİ_AG_DİR" },
                new Eleman { Id = "2", Tur = "AG_DIREK", Durum = "DM", Blok = "DEMONTAJ_AG_DİR" },
            };
            Esit("SH_KAFES_AG_YENI", NesneYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Cins = "AG_DEMİR_GLV", Durum = "M" }), "simge: yeni direk SH_ simgesiyle");
            Esit("SH_DIREK_AG_YENI", NesneYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Cins = "AG_BETON", Durum = "M", Blok = "YENİ_AG_DİR" }), "simge: başka bloklu direk SH_ simgesine geçer");
            Esit("SH_DIREK_AG_DM", NesneYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Cins = "AG_BETON", Durum = "DM", Blok = "YENİ_AG_DİR" }), "simge: demontaja çevrilen direk");
            Esit("SH_TRAFO_DIREK_YENI", NesneYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "TRAFO_DIREGI", Durum = "M" }), "simge: trafo direği");
            Esit("*U5", NesneYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Durum = "DM", Blok = "*U5" }), "simge: adsız blok korunur");
            Esit("SH_KAFES_AG_DMM", NesneYazici.BlokSec(new List<Eleman>(), new Eleman { Id = "9", Tur = "AG_DIREK", Cins = "AG_DEMİR_GLV", Durum = "DM+M", Blok = "SH_KAFES_AG_YENI" }), "simge: duruma göre yeniden seçilir");
            Esit("SH_DIREK_AG_YENI", NesneYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Cins = "AG_BETON", Durum = "M", Blok = "SH_DIREK_AG_YENI" }), "simge: SH_ bloğu korunur");
            // Katalog (eklentiye gömülen dosya), sıra üreteci, armatürlü direk (önceki sürümde ayrı blokta tanımlıydı)
            var k = Katalog.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kalemler.json"), Encoding.UTF8), null);
            Esit(true, k.Kalemler.Count > 2500, "katalog okundu (tam liste)");
            int sira = 7000;
            Func<string> yeniSira = () => (++sira).ToString(CultureInfo.InvariantCulture);
            var arm = k.Bul("ARMATÜR", "70W Sodyum Arm.");
            Esit(true, arm != null, "katalog: armatür kalemi");
            var adirek = new Eleman { Id = "D5", Tur = "AG_DIREK", Cins = "AG_BETON", Tip = "9,3/2", Durum = "M", Hakedis = 1 };
            adirek.Kalemler.Add(new Kalem { Cins = "AG_BETON", Tanim = "9,3/2", Durum = "M", Ana = true, Kaynak = "NIT", Miktar = 1 });
            Esit("", NesneYazici.Eleman(adirek, "SC", "SH_DIREK_AG_YENI", null).Armatur, "armatür: malzemesi yoksa simge yok");
            adirek.Kalemler.Add(Katalog.KalemYap(arm, 1, "M", 1, false, "MALZEME", "7100"));
            var va = NesneYazici.Eleman(adirek, "SC", "SH_DIREK_AG_YENI", null);
            Esit("SH_ARMATUR_YENI", va.Armatur, "armatür: direğin yanında armatür simgesi");
            adirek.Kalemler[1].Durum = "DM";
            Esit("SH_ARMATUR_DM", NesneYazici.Eleman(adirek, "SC", "SH_DIREK_AG_YENI", null).Armatur, "armatür: demontaj armatür simgesi");
            var abox = new Eleman { Id = "B5", Tur = "BOX", Cins = "BOX_PANO", Durum = "M" };
            abox.Kalemler.Add(Katalog.KalemYap(arm, 1, "M", 1, false, "MALZEME", "7101"));
            Esit("", NesneYazici.Eleman(abox, "SC", "SH_SDK_YENI", null).Armatur, "armatür: direk olmayan elemanda simge çizilmez");

            // Durumu değişen eleman: simge güncel duruma göre
            var pe = new Eleman { Id = "P1", Tur = "AG_DIREK", Cins = "AG_DEMİR_GLV", Durum = "DM+M", Blok = "YENİ_AG_DİR" };
            Esit("SH_KAFES_AG_DMM", NesneYazici.BlokSec(new List<Eleman>(), pe, "M", ""), "blok: M → DM+M sök-tak simgesi");
            pe.Durum = "M+M";
            Esit("SH_KAFES_AG_YENI", NesneYazici.BlokSec(new List<Eleman>(), pe, "M", ""), "blok: başka blok yerine uygulamanın simgesi");
            var pd2 = new Eleman { Id = "P2", Tur = "AG_DIREK", Cins = "AG_DEMİR_GLV", Durum = "DM", DmDurum = "SÖKÜK", Blok = "DEMONTAJ_AG_DİR" };
            Esit("SH_KAFES_AG_SOKUK", NesneYazici.BlokSec(new List<Eleman>(), pd2, "DM", ""), "blok: demontaja sökük yazılınca sökük simgesi");

            // Malzeme hafızası: son direğin malzemeleri yeni direğe
            var trv = k.Bul("TRAVERS_VE_KONSOLLAR_GLV", "G-L-50") ?? k.Malzemeler("AG_DIREK")[0];
            var son = new Eleman { GisId = "SC50", Tur = "AG_DIREK", Cins = "AG_DEMİR_GLV", Tip = "G-8I", Durum = "M+M", Hakedis = 1 };
            son.Kalemler.Add(new Kalem { Cins = "AG_DEMİR_GLV", Tanim = "G-8I", Durum = "M+M", Ana = true, Kaynak = "NIT", Miktar = 1 });
            son.Kalemler.Add(Katalog.KalemYap(trv, 2, "M+M", 1, false, "MALZEME", "7200"));
            son.Kalemler.Add(Katalog.KalemYap(arm, 1, "KM", 1, false, "MALZEME", "7201"));
            var hafiza = new MalzemeHafizasi();
            hafiza.Hatirla(son);
            var yeniDirek = new Eleman { GisId = "SC51", Tur = "AG_DIREK", Cins = "AG_DEMİR_GLV", Tip = "G-8I", Durum = "M", Hakedis = 2 };
            var ek = hafiza.Uygula(yeniDirek, k, yeniSira, "", false);
            Esit(2, ek.Count, "hafıza: son direğin iki malzemesi");
            Esit(2.0, ek.Count > 0 ? ek[0].Miktar : 0, "hafıza: miktar korunur");
            Esit("M", ek.Count > 0 ? ek[0].Durum : "", "hafıza: direğinkiyle aynı durumdaki malzeme yeni direğin durumunu alır");
            Esit("KM", ek.Count > 1 ? ek[1].Durum : "", "hafıza: farklı durumdaki malzeme aynen kalır");
            Esit(2, ek.Count > 0 ? ek[0].Hakedis : 0, "hafıza: yeni direğin hakedişi");
            Esit(true, ek.TrueForAll(x => !x.Ana && x.Kaynak == "MALZEME" && x.Sira.Length > 0), "hafıza: yeni sıra numaralı malzeme satırları");
            var baskaTip = new Eleman { Tur = "AG_DIREK", Cins = "AG_BETON", Tip = "9,3/2", Durum = "M+M", Hakedis = 1 };
            Esit(2, hafiza.Uygula(baskaTip, k, yeniSira, "", false).Count, "hafıza: o tip için kayıt yoksa aynı türün son direği");
            Esit(0, hafiza.Uygula(new Eleman { Tur = "TRAFO_DIREGI", Cins = "TR_DİREK_GLV", Tip = "x", Durum = "M" }, k, yeniSira, "", false).Count, "hafıza: başka türe eklenmez");
            var hafiza2 = MalzemeHafizasi.JsondanOku(Json.Oku(Json.Yaz(hafiza.JsonYap(), false)) as JsonNesne);
            Esit(2, hafiza2.Sayisi("AG_DIREK", "AG_DEMİR_GLV", "G-8I"), "hafıza: kaydedilip okununca aynı");
            string kaynak;
            hafiza2.Bul("AG_DIREK", "AG_DEMİR_GLV", "G-8I", out kaynak);
            Esit("SC50", kaynak, "hafıza: hangi direkten olduğu");
        }

        // ---------------- Telefondan alma: planla, uygula, yeniden planla ----------------

        private static int _yeniTanitici = 0x9000;

        /// <summary>Eklentinin yaptığı işi döküm üzerinde taklit eder (yeni nesne, güncelleme, silme, hat etiketi).</summary>
        private static void Uygula(List<CadVarlik> cizim, AktarimPlani plan, bool sil)
        {
            foreach (var a in plan.Adimlar)
            {
                var v = a.Varlik;
                CadVarlik hedef;
                string h;
                if (a.Islem == "yeni")
                {
                    h = (_yeniTanitici++).ToString("X", CultureInfo.InvariantCulture);
                    hedef = v;
                    hedef.H = h;
                    NesneYazici.TaniticiYaz(hedef, h);
                    cizim.Add(hedef);
                }
                else
                {
                    h = a.Hedef;
                    hedef = cizim.Find(x => string.Equals(x.H, h, StringComparison.OrdinalIgnoreCase));
                    NesneYazici.TaniticiYaz(v, h);
                    string eskiKimlik = hedef.XdIlk(NesneYazici.KimlikUygulamasi);
                    var etk = hedef.XdIlk("ETK");
                    hedef.Tur = v.Tur; hedef.Katman = v.Katman; hedef.Blok = v.Blok;
                    hedef.X = v.X; hedef.Y = v.Y; hedef.Z = v.Z; hedef.Aci = v.Aci; hedef.Kapali = v.Kapali;
                    hedef.Kose = v.Kose; hedef.Oz = v.Oz; hedef.Xd = v.Xd;
                    if (!hedef.Xd.ContainsKey(NesneYazici.KimlikUygulamasi) && eskiKimlik != null) hedef.Xd[NesneYazici.KimlikUygulamasi] = new List<string> { eskiKimlik };
                    if (etk != null) hedef.Xd["ETK"] = new List<string> { etk };
                }
                if (a.Etiket != null)
                {
                    string metin = a.Etiket.Replace(NesneYazici.Tanitici, h);
                    var etk = hedef.XdIlk("ETK");
                    var yazi = etk == null ? null : cizim.Find(x => x.H == etk);
                    if (yazi == null)
                    {
                        yazi = new CadVarlik { H = (_yeniTanitici++).ToString("X", CultureInfo.InvariantCulture), Tur = "TEXT", Katman = hedef.Katman };
                        cizim.Add(yazi);
                        hedef.Xd["ETK"] = new List<string> { yazi.H };
                    }
                    yazi.Metin = metin;
                }
            }
            if (sil)
                foreach (var h in plan.Silinenler.Keys)
                {
                    var v = cizim.Find(x => string.Equals(x.H, h, StringComparison.OrdinalIgnoreCase));
                    var etk = v?.XdIlk("ETK");
                    cizim.Remove(v);
                    if (etk != null) cizim.RemoveAll(x => x.H == etk);
                }
        }

        private static void TelefondanAlma(List<CadVarlik> ornekCizim, Proje telefonProjesi)
        {
            Console.WriteLine("Telefondan alma");
            // 1) Bu çizimden alınmış, telefonda değişmemiş proje: hiçbir iş çıkmamalı
            var cizim = new List<CadVarlik>();
            foreach (var v in ornekCizim) cizim.Add(CadVarlik.JsondanOku(v.JsonYap()));
            var p = NesneOkuyucu.Oku(cizim, "ornek.dwg");
            var tel = ProjeDosyasi.Oku(ProjeDosyasi.Yaz(p, "test"));
            var plan = Aktarim.Planla(cizim, tel, "SC");
            Esit(0, plan.Adimlar.Count, "değişmemiş proje: iş yok");
            Esit(p.Bolgeler.Count + p.Noktalar.Count + p.Elemanlar.Count + p.Hatlar.Count + p.Kanallar.Count + p.Sondajlar.Count, plan.Ayni, "değişmemiş proje: hepsi aynı");
            Esit(0, plan.Silinenler.Count, "değişmemiş proje: silinen yok");

            // 2) Telefonda: direk taşındı, hat metrajı değişti, kanal silindi, yeni direk ve yeni hat eklendi, demontaja çevrildi
            var direk = tel.Elemanlar.Find(e => e.GisId == "SC77");
            direk.Saga += 2;
            var hat = tel.Hatlar[0];
            var hk = hat.Kalemler.Find(x => x.Kaynak == "HAT");
            hk.Miktar += 5; hk.Toplam = hk.Miktar * hk.Katsayi;
            var silinen = tel.Kanallar[0].Id;
            tel.Kanallar.Clear();
            var dm = tel.Elemanlar.Find(e => e.GisId == "SC99");
            dm.Durum = "DM";
            foreach (var x in dm.Kalemler) x.Durum = "DM";
            var yeni = new Eleman
            {
                Id = "Tk1", Tur = "AG_DIREK", GisId = "SC100", Cins = "AG_DEMİR_GLV", Tip = "G-K2", Durum = "M", Hakedis = 2,
                Saga = direk.Saga + 30, Yukari = direk.Yukari, Kalemler = { new Kalem { Cins = "AG_DEMİR_GLV", Tanim = "G-K2", Durum = "M", Miktar = 1, Birim = "ad/kg", Katsayi = 504, Toplam = 504, Hakedis = 2, Tarife = "0107", Sira = "9001", Ana = true, Kaynak = "NIT" } },
            };
            tel.Elemanlar.Add(yeni);
            var yeniHat = new Hat
            {
                Id = "Tk2", Tur = "AG_HAVAI", AnaKesit = "3X50/16+70 ALPEK", Durum = "M", Hakedis = 2,
                Kose = { new[] { direk.Saga, direk.Yukari }, new[] { yeni.Saga, yeni.Yukari } },
                Kalemler = { new Kalem { Cins = "ALPEK_KABLOLAR", Tanim = "3X50/16+70 ALPEK", Durum = "M", Miktar = 30, Birim = "mt/mt", Katsayi = 1, Toplam = 30, Hakedis = 2, Tarife = "0107", Sira = "9002", Kaynak = "HAT" } },
            };
            tel.Hatlar.Add(yeniHat);
            plan = Aktarim.Planla(cizim, tel, "SC");
            Esit(2, plan.Sayi("yeni"), "değişen proje: 2 yeni");
            Esit(3, plan.Sayi("guncelle"), "değişen proje: 3 güncelleme (taşınan, metrajı değişen, demontaja çevrilen)");
            Esit(true, plan.Silinenler.ContainsKey(silinen), "değişen proje: telefonda silinen kanal sorulur");
            var yeniAdim = plan.Adimlar.Find(x => x.Kimlik == "Tk1");
            Esit("Tk1", yeniAdim.Varlik.XdIlk(NesneYazici.KimlikUygulamasi), "yeni nesneye telefon kimliği yazılır");
            Esit("SC_2.HAK.AGDİR", yeniAdim.Varlik.Katman, "yeni direk hakediş katmanında");
            var dmAdim = plan.Adimlar.Find(x => x.Hedef == dm.Id);
            Esit("SC_DEMONTAJ", dmAdim.Varlik.Katman, "demontaja çevrilen direk demontaj katmanına geçer");
            Esit(dm.Blok, dmAdim.Varlik.Blok, "adsız bloklu direğin bloğu korunur");
            var hatAdim = plan.Adimlar.Find(x => x.Hedef == hat.Id);
            Esit(true, hatAdim.Etiket != null && hatAdim.Etiket.Contains("/" + Metraj.Yazi(hk.Miktar) + "m/"), "metrajı değişen hattın etiketi güncellenir");

            Uygula(cizim, plan, true);
            var sonra = NesneOkuyucu.Oku(cizim, "ornek.dwg");
            Esit(0, sonra.Uyarilar.Count, "uygulandıktan sonra okuma uyarısı yok");
            Esit(tel.Elemanlar.Count, sonra.Elemanlar.Count, "uygulandıktan sonra eleman sayısı");
            Esit(0, sonra.Kanallar.Count, "silinen kanal çizimden kalktı");
            Esit(direk.Saga, sonra.Elemanlar.Find(e => e.GisId == "SC77").Saga, "taşınan direğin yeni yeri");
            Esit(RaporSatirlari(tel).Count, RaporSatirlari(sonra).Count, "uygulandıktan sonra rapor satır sayısı");

            // 3) Aynı dosyayı ikinci kez almak hiçbir şeyi değiştirmemeli (yeni nesneler SH_ID ile bulunur)
            plan = Aktarim.Planla(cizim, tel, "SC");
            Esit(0, plan.Adimlar.Count, "ikinci alma: iş yok");
            Esit(1, plan.KimlikleEslesen > 0 ? 1 : 0, "ikinci alma: yeni nesneler kimlikle eşleşti");
            Esit(0, plan.Silinenler.Count, "ikinci alma: silinen yok");

            // 5) Telefon tek parça hattı direkten direğe böldü ("<kimlik>-1", "-2"): ilk parça eski hattı günceller
            //    (tanıtıcı korunur, silme sorulmaz), ikinci parça yeni nesne; ikinci almada iş yok
            {
                var c5 = new List<CadVarlik>();
                foreach (var v in ornekCizim) c5.Add(CadVarlik.JsondanOku(v.JsonYap()));
                var p5 = NesneOkuyucu.Oku(c5, "ornek.dwg");
                var t5 = ProjeDosyasi.Oku(ProjeDosyasi.Yaz(p5, "test"));
                var eski = t5.Hatlar[0];
                var a0 = eski.Kose[0];
                var a1 = eski.Kose[1];
                var orta = new[] { (a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 };
                var p1 = new Hat { Id = eski.Id + "-1", Tur = eski.Tur, AnaKesit = eski.AnaKesit, Durum = eski.Durum, Hakedis = eski.Hakedis, Katman = eski.Katman };
                p1.Kose.Add(a0); p1.Kose.Add(orta);
                foreach (var k in eski.Kalemler) p1.Kalemler.Add(k.Kopya());
                var p2 = new Hat { Id = eski.Id + "-2", Tur = eski.Tur, AnaKesit = eski.AnaKesit, Durum = eski.Durum, Hakedis = eski.Hakedis, Katman = eski.Katman };
                p2.Kose.Add(orta);
                for (int i = 1; i < eski.Kose.Count; i++) p2.Kose.Add(eski.Kose[i]);
                var hk2 = eski.Kalemler.Find(x => x.Kaynak == "HAT").Kopya();
                hk2.Miktar = 10; hk2.Toplam = 10 * hk2.Katsayi;
                p2.Kalemler.Add(hk2);
                t5.Hatlar.Remove(eski);
                t5.Hatlar.Add(p1);
                t5.Hatlar.Add(p2);
                var plan5 = Aktarim.Planla(c5, t5, "SC");
                Esit(1, plan5.Sayi("guncelle", "hat"), "bölünen hat: ilk parça eski hattı günceller");
                Esit(1, plan5.Sayi("yeni", "hat"), "bölünen hat: ikinci parça yeni nesne");
                var ilkParca = plan5.Adimlar.Find(x => x.Kimlik == p1.Id);
                Esit(eski.Id, ilkParca != null ? ilkParca.Hedef : "", "bölünen hat: tanıtıcı korunur");
                Esit(0, plan5.Silinenler.Count, "bölünen hat: silme sorulmaz");
                Uygula(c5, plan5, true);
                Esit(0, Aktarim.Planla(c5, t5, "SC").Adimlar.Count, "bölünen hat: ikinci alma iş yok");
                Esit("ABC", Aktarim.IlkParcaKoku("ABC-1"), "ilk parça kökü");
                Esit(null, Aktarim.IlkParcaKoku("ABC-2"), "ikinci parçanın kökü yok");
            }

            // 4) Telefonda yeni açılmış proje boş çizime: hepsi yeni; ikinci kez: iş yok
            var bos = new List<CadVarlik>();
            plan = Aktarim.Planla(bos, telefonProjesi, "SC");
            int toplam = telefonProjesi.Bolgeler.Count + telefonProjesi.Noktalar.Count + telefonProjesi.Elemanlar.Count + telefonProjesi.Hatlar.Count + telefonProjesi.Kanallar.Count + telefonProjesi.Sondajlar.Count;
            Esit(toplam, plan.Sayi("yeni"), "boş çizime: hepsi yeni");
            Uygula(bos, plan, false);
            var bp = NesneOkuyucu.Oku(bos, "bos.dwg");
            var ra = RaporSatirlari(telefonProjesi);
            var rb = RaporSatirlari(bp);
            Esit(ra.Count, rb.Count, "boş çizime: rapor satır sayısı aynı");
            double ta = 0, tb = 0;
            foreach (var r in new DurumTespit(telefonProjesi).Satirlar) ta += r.Toplam;
            foreach (var r in new DurumTespit(bp).Satirlar) tb += r.Toplam;
            Esit(SayiCoz.Temiz(ta, 3), SayiCoz.Temiz(tb, 3), "boş çizime: rapor toplamı aynı");
            plan = Aktarim.Planla(bos, telefonProjesi, "SC");
            Esit(0, plan.Adimlar.Count, "boş çizime ikinci alma: iş yok");
            Esit(toplam, plan.Ayni, "boş çizime ikinci alma: hepsi aynı");
        }

        // ---------------- Gerçek proje doğrulaması ----------------

        // ---------------- Yazıcı: proje → çizim nesneleri → proje ----------------

        /// <summary>Raporun her satırı tek metin (karşılaştırma için).</summary>
        private static List<string> RaporSatirlari(Proje p)
        {
            var l = new List<string>();
            foreach (var r in new DurumTespit(p).Satirlar)
                l.Add(string.Join("|", new[] { r.Handle, r.Proje, r.Cins, r.Tip, r.Durum, r.BirimFiyat.ToString("R", CultureInfo.InvariantCulture),
                    r.Miktar.ToString("R", CultureInfo.InvariantCulture), r.Birim, r.Katsayi.ToString("R", CultureInfo.InvariantCulture),
                    r.Toplam.ToString("R", CultureInfo.InvariantCulture), r.Hakedis.ToString(CultureInfo.InvariantCulture), r.BolgeTarife, r.MalzemeTarife,
                    r.DmDurum, r.Index, r.Kontrol }));
            l.Sort(StringComparer.Ordinal);
            return l;
        }

        /// <summary>Projeyi çizim biçiminde çizim nesnelerine yazar, okuyucuyla geri okur; rapor aynı kalmalı.</summary>
        private static void GidisDonus(Proje p, string ad)
        {
            Console.WriteLine("Gidiş-dönüş: " + ad);
            var varliklar = NesneYazici.Hepsi(p, id => id.StartsWith("T", StringComparison.Ordinal));
            foreach (var v in varliklar) NesneYazici.TaniticiYaz(v, v.H);
            // Hat etiketleri (ETK): okuyucu etiketi tanıtıcıdan bulur
            int etk = 0;
            var etiketler = new List<CadVarlik>();
            foreach (var h in p.Hatlar)
            {
                var v = varliklar.Find(x => x.H == h.Id && x.Xd.ContainsKey("HAT"));
                var t = new CadVarlik { H = "E" + (++etk).ToString(CultureInfo.InvariantCulture), Tur = "TEXT", Katman = v.Katman, Metin = NesneYazici.HatEtiketi(h).Replace(NesneYazici.Tanitici, h.Id) };
                v.Xd["ETK"] = new List<string> { t.H };
                etiketler.Add(t);
            }
            varliklar.AddRange(etiketler);
            var geri = NesneOkuyucu.Oku(varliklar, ad);
            Esit(p.Elemanlar.Count, geri.Elemanlar.Count, "eleman sayısı");
            Esit(p.Hatlar.Count, geri.Hatlar.Count, "hat sayısı");
            Esit(p.Kanallar.Count, geri.Kanallar.Count, "kanal sayısı");
            Esit(p.Sondajlar.Count, geri.Sondajlar.Count, "sondaj sayısı");
            Esit(p.Noktalar.Count, geri.Noktalar.Count, "nokta sayısı");
            Esit(p.Bolgeler.Count, geri.Bolgeler.Count, "bölge sayısı");
            Esit(0, geri.Uyarilar.Count, "okuma uyarısı yok");
            var a = RaporSatirlari(p);
            var b = RaporSatirlari(geri);
            int fark = 0;
            for (int i = 0; i < Math.Min(a.Count, b.Count); i++)
                if (a[i] != b[i]) { if (fark < 5) Console.WriteLine("    fark: " + a[i] + "\n       ↳ " + b[i]); fark++; }
            Esit(a.Count, b.Count, "rapor satır sayısı");
            Esit(0, fark, "rapor satırları aynı");
            // Etiket ve sayı yazımı
            var h0 = p.Hatlar.Count > 0 ? p.Hatlar[0] : null;
            if (h0 != null) Esit(h0.Etiket != "" ? geri.Hatlar.Find(x => x.Id == h0.Id).Etiket.StartsWith(h0.Etiket.Split('/')[0], StringComparison.Ordinal) : true, true, "hat etiketi okunur");
        }

        /// <summary>Telefonun yazdığı bir proje dosyası boş çizime aktarılır, geri okunur; ikinci aktarım iş çıkarmamalı.</summary>
        private static void BosaAktar(string projeYolu)
        {
            var tel = ProjeDosyasi.Oku(File.ReadAllText(projeYolu, Encoding.UTF8));
            Console.WriteLine($"Proje: {tel.Ad} · bölge {tel.Bolgeler.Count}, nokta {tel.Noktalar.Count}, eleman {tel.Elemanlar.Count}, hat {tel.Hatlar.Count}, kanal {tel.Kanallar.Count}, sondaj {tel.Sondajlar.Count}");
            var cizim = new List<CadVarlik>();
            var plan = Aktarim.Planla(cizim, tel, string.IsNullOrEmpty(tel.KatmanOnEki) ? "SC" : tel.KatmanOnEki);
            Console.WriteLine($"1. aktarım: yeni {plan.Sayi("yeni")} · güncelle {plan.Sayi("guncelle")} · uyarı {plan.Uyarilar.Count}");
            foreach (var u in plan.Uyarilar) Console.WriteLine("  uyarı: " + u);
            Uygula(cizim, plan, false);
            var geri = NesneOkuyucu.Oku(cizim, "bos.dwg");
            Esit(0, geri.Uyarilar.Count, "okuma uyarısı yok");
            var a = RaporSatirlari(tel);
            var b = RaporSatirlari(geri);
            Esit(a.Count, b.Count, "rapor satır sayısı aynı");
            double ta = 0, tb = 0;
            foreach (var r in new DurumTespit(tel).Satirlar) ta += r.Toplam;
            foreach (var r in new DurumTespit(geri).Satirlar) tb += r.Toplam;
            Esit(SayiCoz.Temiz(ta, 3), SayiCoz.Temiz(tb, 3), "rapor toplamı aynı");
            plan = Aktarim.Planla(cizim, tel, string.IsNullOrEmpty(tel.KatmanOnEki) ? "SC" : tel.KatmanOnEki);
            Console.WriteLine($"2. aktarım: yeni {plan.Sayi("yeni")} · güncelle {plan.Sayi("guncelle")} · aynı {plan.Ayni}");
            foreach (var x in plan.Adimlar) Console.WriteLine("  " + x.Islem + " " + x.Ad + " · " + x.Fark);
            Esit(0, plan.Adimlar.Count, "ikinci aktarım iş çıkarmaz");
        }

        /// <summary>Gerçek bir çizim dökümü ile o çizimden alınmış proje dosyası: değişiklik yoksa iş çıkmamalı.</summary>
        private static void AktarimDene(string dokumYolu, string projeYolu)
        {
            var sure = System.Diagnostics.Stopwatch.StartNew();
            var cizim = CadVarlik.DokumOku(File.ReadAllText(dokumYolu, Encoding.UTF8));
            var tel = ProjeDosyasi.Oku(File.ReadAllText(projeYolu, Encoding.UTF8));
            var plan = Aktarim.Planla(cizim, tel, "SC");
            Console.WriteLine($"Plan: {sure.ElapsedMilliseconds} ms · yeni {plan.Sayi("yeni")} · güncelle {plan.Sayi("guncelle")} · aynı {plan.Ayni} · silinen aday {plan.Silinenler.Count} · uyarı {plan.Uyarilar.Count}");
            int n = 0;
            foreach (var a in plan.Adimlar) if (n++ < 10) Console.WriteLine("  " + a.Islem + " " + a.Nesne + " " + a.Hedef + " " + a.Ad + " · " + a.Fark);
            foreach (var u in plan.Uyarilar) if (n++ < 20) Console.WriteLine("  uyarı: " + u);
            Esit(0, plan.Adimlar.Count, "değişmemiş gerçek proje: iş yok");
            Esit(0, plan.Silinenler.Count, "değişmemiş gerçek proje: silinen yok");
        }

        private static void Dogrula(string dokumYolu, string refYolu, string ciktiKlasoru)
        {
            Directory.CreateDirectory(ciktiKlasoru);
            var sure = System.Diagnostics.Stopwatch.StartNew();
            var varliklar = CadVarlik.DokumOku(File.ReadAllText(dokumYolu, Encoding.UTF8));
            var p = NesneOkuyucu.Oku(varliklar, "gercek-proje.dwg");
            Console.WriteLine($"Okuma: {sure.ElapsedMilliseconds} ms · bölge {p.Bolgeler.Count}, nokta {p.Noktalar.Count}, eleman {p.Elemanlar.Count}, hat {p.Hatlar.Count}, kanal {p.Kanallar.Count}, sondaj {p.Sondajlar.Count}, uyarı {p.Uyarilar.Count}");
            foreach (var u in p.Uyarilar) Console.WriteLine("  uyarı: " + u);

            string projeYolu = Path.Combine(ciktiKlasoru, "proje.sebeke.json");
            File.WriteAllText(projeYolu, ProjeDosyasi.Yaz(p, "test"), new UTF8Encoding(false));
            var p2 = ProjeDosyasi.Oku(File.ReadAllText(projeYolu, Encoding.UTF8));
            Esit(p.Elemanlar.Count, p2.Elemanlar.Count, "proje dosyası: eleman sayısı korunur");

            sure.Restart();
            var dt = new DurumTespit(p2);
            Console.WriteLine($"Rapor: {sure.ElapsedMilliseconds} ms · {dt.Satirlar.Count} satır");

            // AutoCAD raporu
            var refSatirlar = new List<string[]>();
            string[] bas = null;
            foreach (var satir in File.ReadAllLines(refYolu, Encoding.UTF8))
            {
                var f = satir.Split('\t');
                if (bas == null) { bas = f; continue; }
                refSatirlar.Add(f);
            }
            var ix = new Dictionary<string, int>();
            for (int i = 0; i < bas.Length; i++) ix[bas[i]] = i;
            Console.WriteLine("AutoCAD raporu: " + refSatirlar.Count + " satır");

            // Satır satır: INDEX + CİNS + TİP + MLZ.TARİFE ile eşleştir
            var bizim = new Dictionary<string, List<RaporSatiri>>();
            foreach (var s in dt.Satirlar)
            {
                string k = s.Index + "|" + s.Cins + "|" + s.Tip + "|" + s.MalzemeTarife;
                List<RaporSatiri> l; if (!bizim.TryGetValue(k, out l)) bizim[k] = l = new List<RaporSatiri>();
                l.Add(s);
            }
            var alanFark = new Dictionary<string, int>();
            int eslesen = 0, bulunamayan = 0, tamAyni = 0;
            var ornekler = new List<string>();
            foreach (var r in refSatirlar)
            {
                string k = r[ix["INDEX"]] + "|" + r[ix["CİNS"]] + "|" + r[ix["TİP"]] + "|" + r[ix["MLZ.TARİFE"]];
                List<RaporSatiri> l;
                if (!bizim.TryGetValue(k, out l) || l.Count == 0) { bulunamayan++; if (ornekler.Count < 8) ornekler.Add("yok: " + k); continue; }
                var s = l[0]; l.RemoveAt(0);
                eslesen++;
                bool ayni = true;
                Karsilastir("PROJE", r[ix["PROJE"]], s.Proje, alanFark, ref ayni);
                Karsilastir("DURUM", r[ix["DURUM"]], s.Durum, alanFark, ref ayni);
                Karsilastir("BİRİM", r[ix["BİRİM"]], s.Birim, alanFark, ref ayni);
                Karsilastir("HAK. NO", r[ix["HAK. NO"]], s.Hakedis.ToString(CultureInfo.InvariantCulture), alanFark, ref ayni);
                Karsilastir("BÖL.TARİFE", r[ix["BÖL.TARİFE"]], s.BolgeTarife, alanFark, ref ayni);
                Karsilastir("DM DRM", r[ix["DM DRM"]], s.DmDurum, alanFark, ref ayni);
                Karsilastir("KONTROL", r[ix["KONTROL"]], s.Kontrol, alanFark, ref ayni);
                SayiKarsilastir("MİKTAR", r[ix["MİKTAR"]], s.Miktar, alanFark, ref ayni);
                SayiKarsilastir("METRİK A.", r[ix["METRİK A."]], s.Katsayi, alanFark, ref ayni);
                SayiKarsilastir("TOP. MİK.", r[ix["TOP. MİK."]], s.Toplam, alanFark, ref ayni);
                if (ayni) tamAyni++;
            }
            int fazla = 0;
            foreach (var l in bizim.Values) fazla += l.Count;
            Console.WriteLine($"Eşleşen satır: {eslesen}/{refSatirlar.Count} · tüm alanları aynı: {tamAyni} · raporda olup bizde olmayan: {bulunamayan} · bizde fazla: {fazla}");
            foreach (var kv in alanFark) Console.WriteLine($"  alan farkı {kv.Key}: {kv.Value}");
            foreach (var o in ornekler) Console.WriteLine("  " + o);

            // Özet toplamları (PROJE × HAK × DURUM × CİNS × TİP × BİRİM)
            var refOzet = new Dictionary<string, double[]>();
            foreach (var r in refSatirlar)
            {
                string k = r[ix["PROJE"]] + "|" + r[ix["HAK. NO"]] + "|" + r[ix["DURUM"]] + "|" + r[ix["CİNS"]] + "|" + r[ix["TİP"]] + "|" + r[ix["BİRİM"]];
                double[] t; if (!refOzet.TryGetValue(k, out t)) refOzet[k] = t = new double[2];
                t[0] += Ondalik(r[ix["MİKTAR"]]); t[1] += Ondalik(r[ix["TOP. MİK."]]);
            }
            int grupAyni = 0, grupFarkli = 0;
            foreach (var o in dt.Ozet())
            {
                string k = o.Proje + "|" + o.Hakedis + "|" + o.Durum + "|" + o.Cins + "|" + o.Tip + "|" + o.Birim;
                double[] t;
                if (refOzet.TryGetValue(k, out t) && Math.Abs(t[0] - o.Miktar) < 1e-3 && Math.Abs(t[1] - o.Toplam) < 1e-3) grupAyni++;
                else grupFarkli++;
            }
            Console.WriteLine($"Özet grupları: {grupAyni} aynı, {grupFarkli} farklı (AutoCAD'de {refOzet.Count} grup)");

            // Toplam kg ve metre karşılaştırması
            double refKg = 0, bizKg = 0;
            foreach (var r in refSatirlar) if (r[ix["BİRİM"]].EndsWith("/kg", StringComparison.Ordinal)) refKg += Ondalik(r[ix["TOP. MİK."]]);
            foreach (var s in dt.Satirlar) if (s.Birim.EndsWith("/kg", StringComparison.Ordinal)) bizKg += s.Toplam;
            Console.WriteLine($"Toplam kg: AutoCAD {refKg:N1} · bizim {bizKg:N1} · fark %{(bizKg - refKg) / refKg * 100:N3}");

            sure.Restart();
            string xlsx = Path.Combine(ciktiKlasoru, "durum-tespit.xlsx");
            RaporYazici.Yaz(p2, xlsx, "test");
            Console.WriteLine($"Excel: {xlsx} ({new FileInfo(xlsx).Length / 1024} KB, {sure.ElapsedMilliseconds} ms)");
            Esit(true, eslesen >= refSatirlar.Count * 0.999, "AutoCAD satırlarının %99,9'u eşleşti");
        }

        private static void Karsilastir(string ad, string beklenen, string gercek, Dictionary<string, int> fark, ref bool ayni)
        {
            if ((beklenen ?? "") == (gercek ?? "")) return;
            if (ad == "DM DRM" && string.IsNullOrEmpty(beklenen) && string.IsNullOrEmpty(gercek)) return;
            int c; fark.TryGetValue(ad, out c); fark[ad] = c + 1;
            ayni = false;
        }

        private static void SayiKarsilastir(string ad, string beklenen, double gercek, Dictionary<string, int> fark, ref bool ayni)
        {
            if (Math.Abs(Ondalik(beklenen) - gercek) < 1e-6) return;
            int c; fark.TryGetValue(ad, out c); fark[ad] = c + 1;
            ayni = false;
        }

        private static double Ondalik(string s)
        {
            double d;
            return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out d) ? d : 0;
        }
    }
}
