using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
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
    ///   cbs klasor/                   : telefonla ortak CBS denemesinin beklenen dosyalarını yazar (ortak/deneme/cbs/beklenen)
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
                    case "cbs": CbsBeklenenYaz(args[1]); break;
                    case "dwgonar":
                        {
                            // Geliştirme: eklentinin SH_ONAR'ı ile aynı onarım (gerçek çizim depoya konmaz)
                            byte[] cikti;
                            var so = DwgOnarici.Onar(File.ReadAllBytes(args[1]), out cikti);
                            if (so.Hata.Length > 0) { Console.WriteLine(so.Hata); return 1; }
                            foreach (var kv in so.Nesneler) Console.WriteLine("  " + kv.Key + ": " + string.Join(", ", kv.Value.ToArray()));
                            Console.WriteLine(so.Nesneler.Count + " nesne onarıldı (" + so.NesneSayisi + " nesne okundu)");
                            if (so.Degisti) File.WriteAllBytes(args[2], cikti);
                            break;
                        }
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
            Esit("/3xSW\\", NesneYazici.HatEtiketi(kmHat), "hat etiketi: KM → /tip\\ (metraj ve tanıtıcı yok)");
            kmHat.Durum = "ENH";
            Esit("{3xSW}", NesneYazici.HatEtiketi(kmHat), "hat etiketi: ENH → {tip}");
            kmHat.Durum = "M";
            Esit("^ 3xSW", NesneYazici.HatEtiketi(kmHat), "hat etiketi: M → ^ tip");
            Esit(">3xSW<", NesneYazici.EtiketGovdesi("DM", "3xSW"), "hat etiketi: DM → >tip<");
            Esit("(3xSW)", NesneYazici.EtiketGovdesi("MEVCUT", "3xSW"), "hat etiketi: MEVCUT → (tip)");
            Esit("[3xSW]", NesneYazici.EtiketGovdesi("DM+M", "3xSW"), "hat etiketi: DM+M → [tip]");
            Esit("* 3xSW", NesneYazici.EtiketGovdesi("M+M", "3xSW"), "hat etiketi: M+M → * tip");
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
            ProjeOzetiDene(p, dt);
            KoordinatVeKml(p);
            MifDene(p);
            AltlikDene();
            MalzemeYazimiDene();

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
            Esit("SC_1.HAK.AGDIR", NesneYazici.ElemanKatmani("SC", "AG_DIREK", "M", 1), "katman: hakediş (Türkçe karaktersiz)");
            Esit("SC_2.HAK.MUSDIR", NesneYazici.ElemanKatmani("SC", "MUSTEREK_DIREK", "M", 2), "katman: müşterek direk MUSDIR");
            Esit("SC_1.HAK.MUSTEREK_HAT", NesneYazici.HatKatmani("SC", "MUSTEREK", "M", 1), "katman: müşterek hat MUSTEREK_HAT");
            Esit("SC_1.HAK.AYDDIR", NesneYazici.ElemanKatmani("ŞÇ", "AYD_DIREK", "M", 1), "katman: önekteki Türkçe harf de çevrilir");
            Esit("SC_1.HAK.AGDIR", NesneYazici.Eleman(new Eleman { Id = "A1", Tur = "AG_DIREK", Durum = "M", Hakedis = 1, Katman = "SC_1.HAK.AGDİR" }, "SC", "SH_X", null).Katman,
                 "katman: çizimdeki eski adlı katman yeni adıyla yazılır");
            Esit("SC_1.HAK.MUSDIR", KatmanAdlari.Ascii("SC_1.HAK.MÜŞDİR"), "katman adı: ASCII çevirisi");
            Esit("MUSTEREK_HAT", KatmanAdlari.Tur("MÜŞTEREK_HAT"), "katman türü: eski ad yeni ada");
            Esit(true, KatmanAdlari.SebekeKatmani("SC_3.HAK.ENHDİR") && KatmanAdlari.SebekeKatmani("SÇ_MEVCUT") && KatmanAdlari.SebekeKatmani("CBS-Ölçü"),
                 "şebeke katmanı: hakediş, özel ve CBS katmanları çevrilir");
            Esit(false, KatmanAdlari.SebekeKatmani("Benim çizgilerim"), "kullanıcının kendi katmanına dokunulmaz");
            Esit("MUSTEREK", NesneOkuyucu.HatTuru("MÜŞTEREK_HAT", "") + "|" + NesneOkuyucu.HatTuru("MUSTEREK_HAT", "") == "MUSTEREK|MUSTEREK" ? "MUSTEREK" : "?",
                 "eski ve yeni müşterek hat katmanı aynı türde okunur");
            Esit("SC_DEMONTAJ", NesneYazici.ElemanKatmani("SC", "AG_DIREK", "DM", 3), "katman: demontaj");
            Esit("SC_STANDART", NesneYazici.ElemanKatmani("SC", "KOFRE", "M+M", 2), "katman: kofre");
            Esit("SC_2.HAK.OG_YER_XLPE", NesneYazici.HatKatmani("SC", "OG_YERALTI", "DM+M", 2), "katman: OG yeraltı");
            Esit("16,8", NesneYazici.Sayi(16.8), "Türkçe ondalık yazımı");
            Esit("0,00", NesneYazici.Fiyat(0), "fiyat yazımı");

            CizimAraclari();
            TelefondanAlma(varliklar, tp);
            RaporUyumu(varliklar, xlsx);
            OnayAkisi(varliklar);
            KullanicilarDene();
            KanalDene();
            DwgOnarDene();
            HesapMerkezi_(tp);
            CizimGorunumu(); // ortak çizim stilini yükler: en sonda (önceki denetimler stilsiz yazımı dener)
            CbsOrtakDeneme(); // telefonla aynı CBS dosyaları (stil yüklü olmalı: renkler ortak stilden)
            CbsIceAktarimDene(); // CBS'den şebeke nesnesi olarak alma
            MalzemeYazisiVeKalinlikDene(); // stil yüklü olmalı (hat kalınlıkları ortak stilden)
            YazmaDenetimiDene();
        }

        /// <summary>
        /// Malzemelerin çizimde yazılması (MalzemeEtiketi; ortak deneme ortak/deneme/malzeme-etiketi.json — telefondaki
        /// tests/malzeme-etiketi.test.mjs aynı dosyayı okur), hat kalınlığı (ortak stil × çarpan) ve iki yeni görünüm ayarının
        /// proje dosyasında ve çizim ayarlarında taşınması.
        /// </summary>
        private static void MalzemeYazisiVeKalinlikDene()
        {
            Console.WriteLine("Malzeme yazısı ve hat kalınlığı");
            string metin = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "malzeme-etiketi.json"), Encoding.UTF8);
            var kok = Json.Oku(metin) as JsonNesne;
            var p = ProjeDosyasi.Oku(Json.Yaz(kok.Nesne("girdi")));
            var beklenen = kok.Nesne("beklenen");
            foreach (var e in p.Elemanlar)
            {
                var b = new List<string>();
                foreach (var x in beklenen.Dizi(e.Id)) b.Add(Convert.ToString(x, CultureInfo.InvariantCulture));
                Esit(string.Join(" | ", b), string.Join(" | ", MalzemeEtiketi.Satirlar(e)), "ortak: malzeme satırları · " + e.Id);
            }
            foreach (var o in kok.Dizi("tekSatir"))
            {
                var t = (JsonNesne)o;
                Esit(t.Metin("beklenen"), MalzemeEtiketi.Satir(t.Metin("ad"), t.Ondalik("miktar"), t.Metin("birim"), t.Metin("durum")), "ortak: tek satır · " + t.Metin("beklenen"));
            }
            int sira;
            Esit(true, MalzemeEtiketi.SatirMi("MLZ_12", out sira) && sira == 12, "MLZ_12 malzeme satırı");
            Esit(false, MalzemeEtiketi.SatirMi("MLZ_") || MalzemeEtiketi.SatirMi("MLZ_0") || MalzemeEtiketi.SatirMi("TİP"), "MLZ_, MLZ_0 ve TİP malzeme satırı değil");
            // Elemanın tarifi satırları taşır; çizimdeki malzeme yazısı "aynı mı" karşılaştırmasına girmez
            var e1 = p.Elemanlar.Find(x => x.Id == "E1");
            var v = NesneYazici.Eleman(e1, "SC", NesneYazici.BlokSec(p.Elemanlar, e1), null);
            Esit(5, v.MalzemeSatirlari != null ? v.MalzemeSatirlari.Count : -1, "eleman tarifinde 5 malzeme satırı");
            var cizimde = NesneYazici.Eleman(e1, "SC", NesneYazici.BlokSec(p.Elemanlar, e1), null);
            cizimde.Oz["MLZ_1"] = "GT-60=2 (M)";
            string fark;
            Esit(true, CadVarlik.Ayni(cizimde, v, out fark), "malzeme yazısı öznitelikleri karşılaştırılmaz" + (fark != null ? " (" + fark + ")" : ""));

            // Hat kalınlığı: ortak stildeki kalınlık × çarpan (mm'nin yüzde biri; telefonla aynı yuvarlama)
            Esit(0.5, CizimStili.HatKalinligi("OG_HAVAI", 1), "hat kalınlığı: OG havai 0,5");
            Esit(0.35, CizimStili.HatKalinligi("AG_HAVAI", 1), "hat kalınlığı: AG havai 0,35");
            Esit(0.5, CizimStili.HatKalinligi("OG_YERALTI", 1), "hat kalınlığı: OG yeraltı 0,5");
            Esit(0.25, CizimStili.HatKalinligi("REKORTMAN", 1), "hat kalınlığı: abone 0,25");
            Esit(0.52, CizimStili.HatKalinligi("AG_YERALTI", 1.5), "hat kalınlığı: AG yeraltı 1,5 kat = 0,52 (0,35 × 1,5 kayan noktada 0,52499…)");
            Esit(0.0, CizimStili.HatKalinligi("OG_HAVAI", 0), "hat kalınlığı: 0 kat ince çizgi");
            var hat = new Hat { Id = "H1", Tur = "OG_HAVAI", Durum = "M", Hakedis = 1, AnaKesit = "3x50/16 XLPE" };
            hat.Kose.Add(new[] { 0.0, 0.0 }); hat.Kose.Add(new[] { 10.0, 0.0 });
            Esit(0.5, NesneYazici.Hat(hat, "SC", null).HatKalinligi, "hat tarifinde stildeki kalınlık");
            Esit(-1.0, NesneYazici.Eleman(e1, "SC", "SH_AG_DIREK", null).HatKalinligi, "elemanda hat kalınlığı yok");

            // Görünüm ayarları: varsayılan yazılmaz, değişince proje dosyasında ve çizim ayarlarında taşınır
            var by = new Boyutlar();
            Esit(true, by.Varsayilan, "boyutlar: varsayılan");
            by.HatKalinligi = 1.5; by.MalzemeYazisi = true;
            Esit(false, by.Varsayilan, "boyutlar: kalınlık ve malzeme yazısı değişince varsayılan değil");
            var q = new Proje { Ad = "X", KatmanOnEki = "SC", Boyutlar = by };
            var geri = ProjeDosyasi.Oku(ProjeDosyasi.Yaz(q, "deneme"));
            Esit(true, geri.Boyutlar != null && geri.Boyutlar.Ayni(by), "boyutlar: proje dosyasında gidiş-dönüş (" + geri.Boyutlar + ")");
            Esit(true, new Boyutlar { HatKalinligi = 9 }.Duzelt().HatKalinligi == Boyutlar.VarsayilanKalinlik, "boyutlar: aralık dışı kalınlık varsayılana döner");
            var ay = new CizimAyarlari();
            ay.BoyutlariKoy(by);
            var ay2 = CizimAyarlari.Ciftlerden(ay.Ciftler());
            Esit(true, ay2.HatKalinligi == 1.5 && ay2.MalzemeYazisi, "çizim ayarları: kalınlık ve malzeme yazısı saklanır");
            Esit(true, ay2.BoyutlariVer().Ayni(by), "çizim ayarları: boyutlar aynı");
            Esit(true, Pencerelerdeki(1.0).Contains("OG 0,5") && Pencerelerdeki(0).StartsWith("İnce çizgi"), "ayar yazısı: kalınlıklar mm ile");
        }

        /// <summary>Çizim Ayarları › Görünüm › Hat kalınlığı seçeneğinin yazısı (eklentideki Pencereler.HatKalinligiYazisi ile aynı biçim).</summary>
        private static string Pencerelerdeki(double kat)
        {
            if (!(kat > 0)) return "İnce çizgi (kalınlık yok)";
            var tr = CultureInfo.GetCultureInfo("tr-TR");
            return "Normal — OG " + CizimStili.HatKalinligi("OG_HAVAI", kat).ToString("0.##", tr) + " · AG " + CizimStili.HatKalinligi("AG_HAVAI", kat).ToString("0.##", tr) + " mm";
        }

        /// <summary>Çizim görünümü: ortak stil (renkler, yazı tipi, kanal kenarı), açıklık metrajı, hat etiketi.</summary>
        /// <summary>Proje özeti penceresinin verisi: proje listesi, malzeme listesi (ÖZET ile aynı toplamlar), süzgeçler, Excel.</summary>
        private static void ProjeOzetiDene(Proje p, DurumTespit dt)
        {
            Console.WriteLine("Proje özeti:");
            var oz = new ProjeOzeti(p);
            var tumu = oz.Projeler[0];
            Esit(true, tumu.Tumu, "proje özeti: ilk satır tüm projeler");
            Esit(1 + p.Bolgeler.Count, oz.Projeler.Count, "proje özeti: her bölge bir proje (bölgesiz nesne yok)");
            int eleman = 0, hat = 0, kanal = 0, sondaj = 0;
            foreach (var s in oz.Projeler) if (!s.Tumu) { eleman += s.Eleman; hat += s.Hat; kanal += s.Kanal; sondaj += s.Sondaj; }
            Esit(p.Elemanlar.Count, eleman, "proje özeti: eleman sayıları projelere dağılır");
            Esit(p.Elemanlar.Count + p.Hatlar.Count + p.Kanallar.Count + p.Sondajlar.Count, tumu.Eleman + tumu.Hat + tumu.Kanal + tumu.Sondaj, "proje özeti: tüm projeler sayıları");
            Esit(p.Hatlar.Count + p.Kanallar.Count + p.Sondajlar.Count, hat + kanal + sondaj, "proje özeti: hat, kanal, sondaj sayıları projelere dağılır");
            var b1 = oz.Projeler.Find(s => !s.Tumu && s.Ad == dt.ProjeAdi("B1"));
            Esit(true, b1 != null && b1.Eleman > 0, "proje özeti: SC77'nin bölgesi listede");

            // Malzeme listesi: ÖZET ile aynı toplamlar; tüm projelerde aynı malzemeler birleşir
            var ozet = dt.Ozet();
            double toplam = 0, b1Toplam = 0;
            foreach (var o in ozet) { toplam += o.Toplam; if (b1 != null && o.Proje == b1.Ad) b1Toplam += o.Toplam; }
            var hepsi = oz.Malzemeler(tumu);
            double hepsiToplam = 0;
            foreach (var o in hepsi) hepsiToplam += o.Toplam;
            Esit(SayiCoz.Temiz(toplam), SayiCoz.Temiz(hepsiToplam), "proje özeti: tüm projelerin toplamı ÖZET toplamına eşit");
            Esit(true, hepsi.Count <= ozet.Count && hepsi.TrueForAll(o => o.Proje == ""), "proje özeti: tüm projelerde projeler birleşir");
            double b1Liste = 0;
            foreach (var o in oz.Malzemeler(b1)) b1Liste += o.Toplam;
            Esit(SayiCoz.Temiz(b1Toplam), SayiCoz.Temiz(b1Liste), "proje özeti: seçilen projenin listesi yalnız o projenin satırları");
            Esit(ozet.Count, oz.Malzemeler(null).Count, "proje özeti: proje bazında liste ÖZET satırlarıyla aynı");

            // Süzgeçler
            Esit(true, oz.Hakedisler.Count > 0 && oz.Durumlar.Count > 0, "proje özeti: hakediş ve durum listeleri dolu");
            int h = oz.Hakedisler[0];
            Esit(true, oz.Malzemeler(tumu, h).TrueForAll(o => o.Hakedis == h), "proje özeti: hakediş süzgeci");
            Esit(true, oz.Malzemeler(tumu, 0, "DM").TrueForAll(o => o.Durum == "DM") && oz.Malzemeler(tumu, 0, "DM").Count > 0, "proje özeti: durum süzgeci (DM)");
            var iletken = oz.Malzemeler(tumu, 0, null, "al_iletken");
            Esit(true, iletken.Count > 0 && iletken.TrueForAll(o => o.Cins.StartsWith("AL_İLETKEN", StringComparison.Ordinal)), "proje özeti: arama büyük/küçük harf ve İ/I farkı gözetmez");
            Esit(0, oz.Malzemeler(tumu, 0, null, "bu-yok").Count, "proje özeti: bulunamayan arama boş liste");
            Esit("2. hakediş · durum DM · arama \"rose\"", ProjeOzeti.SuzgecYazisi(2, "DM", " rose "), "proje özeti: süzgeç yazısı");

            // Excel: tüm projeler (üç sayfa) ve tek proje
            string yol = Path.Combine(Path.GetTempPath(), "sebeke-proje-ozeti.xlsx");
            oz.ExcelYaz(yol, tumu, 0, "", "", "test");
            Esit(true, new FileInfo(yol).Length > 2000, "proje özeti: Excel yazıldı (tüm projeler)");
            using (var z = System.IO.Compression.ZipFile.OpenRead(yol))
            {
                string wb;
                using (var r = new StreamReader(z.GetEntry("xl/workbook.xml").Open(), Encoding.UTF8)) wb = r.ReadToEnd();
                Esit(true, wb.Contains("PROJELER") && wb.Contains("MALZEME LİSTESİ") && wb.Contains("PROJE BAZINDA"), "proje özeti: Excel sayfaları (projeler, malzeme listesi, proje bazında)");
            }
            oz.ExcelYaz(yol, b1, h, "", "", "test");
            using (var z = System.IO.Compression.ZipFile.OpenRead(yol))
            {
                string wb;
                using (var r = new StreamReader(z.GetEntry("xl/workbook.xml").Open(), Encoding.UTF8)) wb = r.ReadToEnd();
                Esit(false, wb.Contains("PROJE BAZINDA"), "proje özeti: tek projede proje bazında sayfası yok");
            }
            try { File.Delete(yol); } catch { }
        }

        // ---------------- Telefonla ortak CBS denemesi (ortak/deneme/cbs) ----------------

        /// <summary>
        /// Ortak denemenin çıktıları: aynı proje dosyasından (deneme.sebeke.json) eklentinin yazdığı Google Earth dosyası
        /// (üretim tarihi "TARIH" yazılır) ve her katmanın MIF / MID metni. Telefon (telefon/web/src/export/cbs.js) aynı
        /// girdiden aynı metinleri üretmek zorundadır: telefon/web/tests/cbs.test.mjs aynı beklenen dosyalarla karşılaştırır.
        /// </summary>
        private static SortedDictionary<string, string> CbsCiktilari(Proje p)
        {
            var d = new SortedDictionary<string, string>(StringComparer.Ordinal);
            string kml = KmlYazici.Metin(p, p.Dom, "test");
            d["deneme.kml"] = Regex.Replace(kml, "(<description>Şebeke-M Hakediş test · [^<]*? → WGS84 · )[^<]*(</description>)", "${1}TARIH${2}");
            var hepsi = CbsYapisi.Nesneler(p);
            foreach (var k in CbsYapisi.Katmanlar)
            {
                var l = hepsi.FindAll(n => n.Katman == k);
                if (l.Count == 0) continue;
                string mif, mid;
                MifDosyasi.KatmanYaz(k, l, p.Dom, out mif, out mid);
                d["deneme_" + k.Ad + ".mif"] = mif;
                d["deneme_" + k.Ad + ".mid"] = mid;
            }
            return d;
        }

        private static Proje CbsDenemeProjesi()
        {
            SembolleriYukle();
            if (!CizimStili.Yuklu) CizimStili.Yukle(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "cizim-stili.json"), Encoding.UTF8));
            // Cins adları katalogdan (eklentide çizimin kataloğu; telefonda ortak/katalog/kalemler.json)
            CbsYapisi.CinsAdlari = Katalog.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kalemler.json"), Encoding.UTF8), null).CinsAdi;
            return ProjeDosyasi.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "cbs", "deneme.sebeke.json"), Encoding.UTF8));
        }

        /// <summary>
        /// Eklentinin CBS çıktısı ortak beklenen dosyalarla birebir aynı mı. Eklentinin KML / MIF yazımı değişirse bu denetim
        /// bozulur: beklenenler `cbs` komutuyla yeniden yazılır ve telefon da aynı değişikliği alır (DEVIR.md çalışma kuralı).
        /// </summary>
        private static void CbsOrtakDeneme()
        {
            Console.WriteLine("CBS: telefonla ortak deneme (ortak/deneme/cbs)");
            var p = CbsDenemeProjesi();
            string klasor = Path.Combine(AppContext.BaseDirectory, "cbs", "beklenen");
            var ciktilar = CbsCiktilari(p);
            Esit(1 + 2 * CbsYapisi.Katmanlar.Length, ciktilar.Count, "CBS ortak: KML ve bütün katmanların MIF / MID'i (" + CbsYapisi.Katmanlar.Length + " katman)");
            foreach (var kv in ciktilar)
            {
                string yol = Path.Combine(klasor, kv.Key);
                string beklenen = File.Exists(yol) ? File.ReadAllText(yol, new UTF8Encoding(false)) : null;
                string fark = beklenen == null ? " — beklenen dosya yok" : IlkFark(beklenen, kv.Value);
                Esit(true, fark.Length == 0, "CBS ortak: " + kv.Key + fark);
            }
        }

        /// <summary>
        /// CBS'den (MIF / MID) şebeke nesnesi olarak alma: Şebeke-M'in kendi dosyaları geri okununca aynı nesneler (tür, GIS no,
        /// durum, malzemeler); aynı çizime alınınca tanıtıcıyla eşleşir; başka CBS'nin dosyası adından, sütun adlarından tanınır.
        /// </summary>
        private static void CbsIceAktarimDene()
        {
            Console.WriteLine("CBS'den alma (MIF → şebeke nesnesi):");
            // Ayırıcısı yazılmamış MIF: MID virgülle ayrılmışsa virgül alınır (MapInfo'ya göre varsayılan sekme)
            var vv = MifDosyasi.Oku("Version 300\nColumns 3\n  NO Integer\n  TIP Char(20)\n  DURUM Char(20)\nData\nPoint 1 2\n", "1,\"G-K2\",\"Yeni\"\n");
            Esit("1|G-K2|Yeni", string.Join("|", vv.Nesneler[0].Degerler), "CBS al: ayırıcısı yazılmamış MIF'te virgüllü MID");
            var vs = MifDosyasi.Oku("Version 300\nColumns 2\n  NO Integer\n  TIP Char(20)\nData\nPoint 1 2\n", "1\t\"9,3/3\"\n");
            Esit("1|9,3/3", string.Join("|", vs.Nesneler[0].Degerler), "CBS al: ayırıcısı yazılmamış MIF'te sekmeli MID (değerde virgül)");
            var p = CbsDenemeProjesi();
            var katalog = Katalog.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kalemler.json"), Encoding.UTF8), null);
            var kaynaklar = new List<CbsKaynagi>();
            var hepsi = CbsYapisi.Nesneler(p);
            foreach (var k in CbsYapisi.Katmanlar)
            {
                var l = hepsi.FindAll(n => n.Katman == k);
                if (l.Count == 0) continue;
                string mif, mid;
                MifDosyasi.KatmanYaz(k, l, p.Dom, out mif, out mid);
                var v = MifDosyasi.Oku(MifDosyasi.DosyaMetni(MifDosyasi.Turkce.GetBytes(mif)), MifDosyasi.DosyaMetni(MifDosyasi.Turkce.GetBytes(mid)));
                MifDosyasi.CizimeCevir(v, p.Dom);
                var kay = new CbsKaynagi { Ad = "deneme_" + k.Ad, Veri = v };
                CbsIceAktarim.Tani(kay);
                Esit(k.Ad + " Şebeke-M", kay.Katman + (kay.SebekeM ? " Şebeke-M" : ""), "CBS al: " + k.Ad + " dosyası tanınır");
                kaynaklar.Add(kay);
            }
            int sira = 9000;
            var ayar = new CbsAlmaAyari { Sira = () => (++sira).ToString(CultureInfo.InvariantCulture), HatMetraji = (L, t) => Math.Ceiling(L) };
            var uyarilar = new List<string>();
            var bos = CbsIceAktarim.ProjeyeCevir(kaynaklar, katalog, new Proje(), ayar, uyarilar);
            Esit(p.Elemanlar.Count + "|" + p.Hatlar.Count + "|" + p.Kanallar.Count + "|" + p.Sondajlar.Count + "|" + p.Bolgeler.FindAll(b => b.Sinir.Count >= 3).Count + "|" + p.Noktalar.Count,
                 bos.Elemanlar.Count + "|" + bos.Hatlar.Count + "|" + bos.Kanallar.Count + "|" + bos.Sondajlar.Count + "|" + bos.Bolgeler.Count + "|" + bos.Noktalar.Count,
                 "CBS al: bütün nesneler geri gelir (eleman, hat, kanal, sondaj, bölge, nokta)");
            bool ayni = true;
            foreach (var e in p.Elemanlar)
            {
                var g = bos.Elemanlar.Find(x => x.Id == "CBS:" + e.Id);
                if (g == null || g.Tur != e.Tur || (g.GisId ?? "") != (e.GisId ?? "") || g.Durum != e.Durum || g.Hakedis != e.Hakedis || g.Kalemler.Count != e.Kalemler.Count ||
                    Math.Abs(g.Saga - e.Saga) > 0.001 || Math.Abs(g.Yukari - e.Yukari) > 0.001 || (g.Guc ?? "") != (e.Guc ?? "") || g.Kontrol != e.Kontrol)
                {
                    ayni = false;
                    Console.WriteLine("    fark: " + e.Id + " " + e.GisId + (g == null ? " yok" : " tür " + g.Tur + "/" + e.Tur + " durum " + g.Durum + "/" + e.Durum + " hak " + g.Hakedis + "/" + e.Hakedis +
                                      " kalem " + g.Kalemler.Count + "/" + e.Kalemler.Count + " güç '" + g.Guc + "'/'" + e.Guc + "' kontrol " + g.Kontrol + "/" + e.Kontrol));
                }
            }
            Esit(true, ayni, "CBS al: elemanların türü, GIS no, durumu, hakedişi, yeri, gücü ve malzeme satırları aynı");
            var h0 = p.Hatlar[0];
            var hg = bos.Hatlar.Find(x => x.Id == "CBS:" + h0.Id);
            Esit(h0.Tur + "|" + h0.Kalemler.Count + "|" + Iletkenler.HatKalemleri(h0)[0].Tanim, hg.Tur + "|" + hg.Kalemler.Count + "|" + Iletkenler.HatKalemleri(hg)[0].Tanim,
                 "CBS al: hattın türü, malzemeleri ve iletkeni aynı (malzeme tablosundan)");
            Esit(0, RaporFarki(p, bos), "CBS al: Durum Tespit raporu aynı (malzeme satırları, miktarlar)");
            // Aynı çizime geri alınınca tanıtıcısıyla eşleşir: nesne çift olmaz
            var ayniCizim = CbsIceAktarim.ProjeyeCevir(kaynaklar, katalog, p, ayar, new List<string>());
            Esit(true, ayniCizim.Elemanlar.TrueForAll(x => p.Elemanlar.Exists(e => e.Id == x.Id)), "CBS al: aynı çizime geri alınca elemanlar tanıtıcısıyla eşleşir");

            // Başka bir CBS'nin dosyası: adından direk, sütunları eş anlamlılarıyla; durum ve tür tahmini
            string dmif = "Version 300\nCharset \"WindowsTurkish\"\nDelimiter \",\"\nCoordSys Earth Projection 8, 104, \"m\", 39, 0, 1, 500000, 0\nColumns 5\n  OBJECTID Integer\n" +
                          "  DIREK_NO Char(20)\n  DIREK_TIPI Char(40)\n  DURUMU Char(20)\n  GERILIM Char(10)\nData\n\nPoint 519300 4282100\nPoint 519340 4282100\n";
            string dmid = "17,\"D-101\",\"9I\",\"İşletmede\",\"0,4 kV\"\n18,\"D-102\",\"G-K2\",\"Sökülecek\",\"34,5 kV\"\n";
            var dv = MifDosyasi.Oku(dmif, dmid);
            MifDosyasi.CizimeCevir(dv, 39);
            var dk = new CbsKaynagi { Ad = "ENH_DIREKLER", Veri = dv };
            CbsIceAktarim.Tani(dk);
            Esit("DIREK|False|0|1|2|3", dk.Katman + "|" + dk.SebekeM + "|" + dk.Sutun("KIMLIK") + "|" + dk.Sutun("GIS_NO") + "|" + dk.Sutun("TIP") + "|" + dk.Sutun("DURUM"),
                 "CBS al (dış): adından direk dosyası; OBJECTID, DIREK_NO, DIREK_TIPI, DURUMU sütunları eşlenir");
            var dp = CbsIceAktarim.ProjeyeCevir(new[] { dk }, katalog, new Proje(), ayar, new List<string>());
            Esit("D-101|AG_DIREK|MEVCUT|CBS:ENH_DIREKLER:17", dp.Elemanlar[0].GisId + "|" + dp.Elemanlar[0].Tur + "|" + dp.Elemanlar[0].Durum + "|" + dp.Elemanlar[0].Id,
                 "CBS al (dış): GIS no, tür, durum (işletmede → mevcut), kalıcı kimlik");
            Esit("ENH_DIREK|DM", dp.Elemanlar[1].Tur + "|" + dp.Elemanlar[1].Durum, "CBS al (dış): 34,5 kV direk ENH direği, sökülecek → demontaj");
            Esit(true, dp.Elemanlar[0].Kalemler.Count == 1 && dp.Elemanlar[0].Kalemler[0].Ana, "CBS al (dış): direğin kendi malzemesi (katalogdan ya da tipinden)");
            // Hat dosyası: kablo tipi katalogdan, türü cinsinden
            string hmif = "Version 300\nDelimiter \",\"\nCoordSys Earth Projection 8, 104, \"m\", 39, 0, 1, 500000, 0\nColumns 2\n  ID Integer\n  KABLO_TIPI Char(40)\nData\n\nPline 2\n519300 4282000\n519340 4282000\n";
            var hv = MifDosyasi.Oku(hmif, "5,\"3x95+50 NYY ALM.\"\n");
            MifDosyasi.CizimeCevir(hv, 39);
            var hk = new CbsKaynagi { Ad = "AG_KABLO_HATLARI", Veri = hv };
            CbsIceAktarim.Tani(hk);
            var hp = CbsIceAktarim.ProjeyeCevir(new[] { hk }, katalog, new Proje(), ayar, new List<string>());
            Esit("HAT|AG_YERALTI|3x95+50 Nyy Alm.|40", hk.Katman + "|" + hp.Hatlar[0].Tur + "|" + Iletkenler.HatKalemleri(hp.Hatlar[0])[0].Tanim + "|" + Iletkenler.HatKalemleri(hp.Hatlar[0])[0].Miktar,
                 "CBS al (dış): kablo hattı katalogdaki kabloyla, yer altı AG, metraj çizim uzunluğundan");
            Esit("M|M+M|DM+M|MEVCUT|DM|X", CbsIceAktarim.DurumKodu("yeni", "X") + "|" + CbsIceAktarim.DurumKodu("m+m", "X") + "|" + CbsIceAktarim.DurumKodu("Değişecek", "X") + "|" +
                 CbsIceAktarim.DurumKodu("Mevcut", "X") + "|" + CbsIceAktarim.DurumKodu("DEMONTAJ", "X") + "|" + CbsIceAktarim.DurumKodu("?", "X"), "CBS al: durum yazıları");
            Esit(KanalKodu.OG | KanalKodu.AG, CbsIceAktarim.KanalKoduOku("OG/AG"), "CBS al: kanal kablo yazısı → kod");
        }

        /// <summary>İki metnin ilk farkı (satır no ve iki satır); aynıysa boş.</summary>
        private static string IlkFark(string a, string b)
        {
            if (a == b) return "";
            var x = a.Split('\n');
            var y = b.Split('\n');
            for (int i = 0; i < Math.Max(x.Length, y.Length); i++)
            {
                string s = i < x.Length ? x[i] : "(yok)", t = i < y.Length ? y[i] : "(yok)";
                if (s != t) return " — " + (i + 1) + ". satır farklı:\n      beklenen: " + s.TrimEnd('\r') + "\n      eklenti : " + t.TrimEnd('\r');
            }
            return " — satır sonları farklı";
        }

        /// <summary>Ortak denemenin beklenen dosyalarını yazar (eklentinin çıktısı esastır).</summary>
        private static void CbsBeklenenYaz(string klasor)
        {
            var p = CbsDenemeProjesi();
            Directory.CreateDirectory(klasor);
            foreach (var kv in CbsCiktilari(p))
            {
                File.WriteAllText(Path.Combine(klasor, kv.Key), kv.Value, new UTF8Encoding(false));
                Console.WriteLine("yazıldı: " + Path.Combine(klasor, kv.Key));
            }
        }

        /// <summary>TM ↔ enlem-boylam (telefondaki geo/crs.js ile aynı sonuç) ve Google Earth dosyası (KML / KMZ).</summary>
        private static void KoordinatVeKml(Proje p)
        {
            Console.WriteLine("Koordinat ve KML:");
            double enlem, boylam, saga, yukari;
            // Beklenen değerler telefondaki geo/crs.js'den (TUREF / TM39 ve TM30)
            Koordinat.EnlemBoylam(512345.678, 4280000.123, 39, out enlem, out boylam);
            Esit(true, Math.Abs(enlem - 38.6530704324) < 1e-9 && Math.Abs(boylam - 39.1418263245) < 1e-9, "koordinat: TM39 → enlem/boylam telefonla aynı");
            Koordinat.CizimKoordinati(38.6748, 39.2232, 39, out saga, out yukari);
            Esit(true, Math.Abs(saga - 519423.2181) < 1e-3 && Math.Abs(yukari - 4282426.3998) < 1e-3, "koordinat: enlem/boylam → TM39 telefonla aynı");
            Koordinat.EnlemBoylam(500000, 4400000, 30, out enlem, out boylam);
            Esit(true, Math.Abs(enlem - 39.7340495594) < 1e-9 && Math.Abs(boylam - 30) < 1e-12, "koordinat: orta meridyende boylam = DOM");
            Koordinat.CizimKoordinati(enlem, boylam, 30, out saga, out yukari);
            Esit(true, Math.Abs(saga - 500000) < 1e-4 && Math.Abs(yukari - 4400000) < 1e-4, "koordinat: gidip gelince aynı (0,1 mm)");
            Esit(39, Koordinat.DomBul(39.9), "koordinat: boylamın dilimi");
            Esit(true, Koordinat.TmDilimindeMi(512345, 4280000) && !Koordinat.TmDilimindeMi(1200, 3400), "koordinat: TM dilimi denetimi");

            string kml = KmlYazici.Metin(p, 39, "test");
            var x = new System.Xml.XmlDocument();
            bool okundu = true;
            try { x.LoadXml(kml); } catch { okundu = false; }
            Esit(true, okundu, "KML: geçerli XML");
            var ns = new System.Xml.XmlNamespaceManager(x.NameTable);
            ns.AddNamespace("k", "http://www.opengis.net/kml/2.2");
            var nesneler = CbsYapisi.Nesneler(p);
            Esit(nesneler.FindAll(n => n.Katman != CbsYapisi.Malzeme).Count, okundu ? x.SelectNodes("//k:Placemark", ns).Count : -1, "KML: her nesne bir yer işareti (malzeme satırları hariç)");
            Esit(p.Elemanlar.Count, nesneler.FindAll(n => Array.IndexOf(CbsYapisi.ElemanKatmanlari, n.Katman) >= 0).Count, "KML: bütün elemanlar (direk, trafo, SDK, pano, diğer)");
            Esit(p.Elemanlar.FindAll(e => e.Tur.EndsWith("DIREK", StringComparison.Ordinal)).Count, nesneler.FindAll(n => n.Katman == CbsYapisi.Direk).Count, "CBS: direkler DIREK katmanında");
            int satir = 0;
            foreach (var e in p.Elemanlar) satir += e.Kalemler.Count;
            foreach (var h in p.Hatlar) if (h.Kose.Count >= 2) satir += h.Kalemler.Count;
            foreach (var c in p.Kanallar) if (c.Kose.Count >= 2) satir += c.Kalemler.Count;
            foreach (var so in p.Sondajlar) if (so.Kose.Count >= 2) satir += so.Kalemler.Count;
            Esit(satir, nesneler.FindAll(n => n.Katman == CbsYapisi.Malzeme).Count, "CBS: bütün malzeme satırları MALZEME tablosunda");
            Esit(true, okundu && x.SelectNodes("//k:Folder/k:name", ns).Count >= p.Bolgeler.Count, "KML: her proje bir klasör");
            var direk = p.Elemanlar.Find(e => e.GisId == "SC77");
            var gis = okundu ? x.SelectSingleNode("//k:Placemark[k:name='SC77']/k:ExtendedData/k:Data[@name='TIP']/k:value", ns) : null;
            Esit(true, gis != null && gis.InnerText == direk.Kalemler.Find(k => k.Ana).Tanim.Trim(), "KML: elemanın tipi öznitelikte");
            var hat = p.Hatlar[0];
            var cizgi = okundu ? x.SelectSingleNode("//k:LineString/k:coordinates", ns) : null;
            Esit(true, cizgi != null && cizgi.InnerText.Split(' ').Length >= 2, "KML: hat köşeleri");
            Esit(true, kml.Contains("<Data name=\"HAKEDIS\">") && kml.Contains("<Data name=\"PROJE_KODU\">"), "KML: hakediş ve proje kodu öznitelikleri");
            // Hat rengi ortak çizim stilinden (telefon ekranı): AG havai yeşil
            Esit(true, kml.Contains("<LineStyle><color>ff"), "KML: çizgi biçimleri");
            bool atildi = false;
            try { KmlYazici.Metin(p, 0, "test"); } catch (ArgumentException) { atildi = true; }
            Esit(true, atildi, "KML: DOM yoksa yazılmaz");

            string kmz = Path.Combine(Path.GetTempPath(), "sebeke-test.kmz");
            KmlYazici.Yaz(p, 39, kmz, "test");
            using (var z = System.IO.Compression.ZipFile.OpenRead(kmz))
            {
                var g = z.GetEntry("doc.kml");
                string ic = "";
                if (g != null) using (var r = new StreamReader(g.Open(), Encoding.UTF8)) ic = r.ReadToEnd();
                Esit(true, g != null && ic.Length > 0 && ic.Contains("<kml"), "KMZ: içinde doc.kml");
            }
            try { File.Delete(kmz); } catch { }
        }

        /// <summary>MIF / MID: Şebeke-M'in yazdığı katmanlar geri okunur; başka programların nesne türleri, stilleri, koordinat sistemleri.</summary>
        private static void MifDene(Proje p)
        {
            Console.WriteLine("MIF / MID:");
            var nesneler = CbsYapisi.Nesneler(p);
            foreach (var k in CbsYapisi.Katmanlar)
            {
                var l = nesneler.FindAll(n => n.Katman == k);
                if (l.Count == 0) continue;
                string mif, mid;
                MifDosyasi.KatmanYaz(k, l, 39, out mif, out mid);
                // Dosyaya Türkçe kod sayfasıyla yazılır, okurken Charset satırından çözülür
                var bayt = MifDosyasi.Turkce.GetBytes(mif);
                var v = MifDosyasi.Oku(MifDosyasi.DosyaMetni(bayt), MifDosyasi.DosyaMetni(MifDosyasi.Turkce.GetBytes(mid)));
                Esit(l.Count, v.Nesneler.Count, "MIF " + k.Ad + ": nesne sayısı");
                if (k.Geometri == "yok") Esit(true, v.Nesneler.TrueForAll(z => z.Tur == "yok"), "MIF " + k.Ad + ": haritada yeri yok (None)");
                Esit(k.Alanlar.Length, v.Sutunlar.Count, "MIF " + k.Ad + ": sütunlar");
                Esit("tm", v.Sistem, "MIF " + k.Ad + ": TM koordinat sistemi");
                Esit(0, v.Uyarilar.Count, "MIF " + k.Ad + ": uyarı yok");
                MifDosyasi.CizimeCevir(v, 39);
                bool konum = true, deger = true;
                for (int i = 0; i < l.Count && i < v.Nesneler.Count; i++)
                {
                    var a = l[i].Kose; var b = v.Nesneler[i].Parcalar.Count > 0 ? v.Nesneler[i].Parcalar[0] : new List<double[]>();
                    if (a.Count != b.Count) { konum = false; continue; }
                    for (int j = 0; j < a.Count; j++) if (Math.Abs(a[j][0] - b[j][0]) > 0.001 || Math.Abs(a[j][1] - b[j][1]) > 0.001) konum = false;
                    for (int j = 0; j < k.Alanlar.Length; j++)
                    {
                        string beklenen = CbsYapisi.Yazi(l[i].Degerler[j]);
                        if (k.Alanlar[j].Tur == 'C' && beklenen.Length > k.Alanlar[j].Uzunluk) beklenen = beklenen.Substring(0, k.Alanlar[j].Uzunluk);
                        if (k.Alanlar[j].Tur != 'C' && beklenen.Length == 0) beklenen = "0";
                        if (j >= v.Nesneler[i].Degerler.Length || v.Nesneler[i].Degerler[j] != beklenen) { deger = false; Console.WriteLine("    fark: " + k.Alanlar[j].Ad + " '" + beklenen + "' → '" + (j < v.Nesneler[i].Degerler.Length ? v.Nesneler[i].Degerler[j] : "-") + "'"); }
                    }
                }
                Esit(true, konum, "MIF " + k.Ad + ": koordinatlar 1 mm içinde aynı");
                Esit(true, deger, "MIF " + k.Ad + ": değerler aynı (Türkçe harfler dâhil)");
            }

            // Başka programın dosyası: her nesne türü, stiller, tırnaklı değerler
            string dis =
                "Version 300\nCharset \"UTF-8\"\nDelimiter \";\"\nCoordSys Earth Projection 1, 104\nColumns 3\n  AD Char(30)\n  NO Integer\n  NOT Char(50)\nData\n\n" +
                "Point 39.2232 38.6748\n    Symbol (35,255,12)\n" +
                "Line 39.2232 38.6748 39.2240 38.6750\n    Pen (1,2,16711680)\n" +
                "Pline Multiple 2\n  2\n39.22 38.67\n39.23 38.67\n  3\n39.22 38.68\n39.23 38.68\n39.23 38.69\n    Pen (2,2,0)\n" +
                "Region 2\n  4\n39.22 38.67\n39.23 38.67\n39.23 38.68\n39.22 38.67\n  3\n39.221 38.671\n39.222 38.671\n39.222 38.672\n    Pen (1,2,0)\n    Brush (2,16777215,0)\n" +
                "Text\n    \"Trafo \"\"T-1\"\"\"\n    39.2232 38.6748 39.2236 38.6749\n    Font (\"Arial\",0,0,65280)\n    Angle 30\n" +
                "Rect 39.20 38.60 39.21 38.61\n" +
                "Ellipse 39.20 38.60 39.21 38.61\n" +
                "Arc 39.20 38.60 39.21 38.61 0 90\n" +
                "Multipoint 2 39.20 38.60 39.21 38.61\n" +
                "Collection 2\n  Multipoint 1 39.2 38.6\n  Pline 2\n39.2 38.6\n39.21 38.61\n" +
                "None\n";
            string disMid = "\"SC 1; A\";1;\"çift \"\"tırnak\"\"\"\n\"İkinci\";2;\"\"\n\"\";3;x\n\"ü\";4;\"\"\n\"yazı\";5;\"\"\n;6;\n;7;\n;8;\n;9;\n;10;\n;11;\n";
            var d = MifDosyasi.Oku(dis, disMid);
            Esit(11, d.Nesneler.Count, "MIF dış: 11 nesne");
            Esit(0, d.Atlanan, "MIF dış: atlanan yok");
            string turler = string.Join(",", d.Nesneler.ConvertAll(n => n.Tur).ToArray());
            Esit("nokta,cizgi,cizgi,alan,yazi,alan,alan,cizgi,nokta,nokta,yok", turler, "MIF dış: nesne türleri");
            Esit(2, d.Nesneler[2].Parcalar.Count, "MIF dış: çoklu çizgi iki parça");
            Esit(2, d.Nesneler[3].Parcalar.Count, "MIF dış: iki halkalı alan");
            Esit(3, d.Nesneler[3].Parcalar[0].Count, "MIF dış: halkanın tekrarlanan son köşesi atılır");
            Esit(255, d.Nesneler[0].Renk, "MIF dış: simge rengi");
            Esit(16711680, d.Nesneler[1].Renk, "MIF dış: kalem rengi");
            Esit("Trafo \"T-1\"", d.Nesneler[4].Metin, "MIF dış: yazı (iç tırnaklı)");
            Esit(65280, d.Nesneler[4].Renk, "MIF dış: yazı rengi");
            Esit(30.0, d.Nesneler[4].Aci, "MIF dış: yazı açısı");
            Esit("SC 1; A", d.Nesneler[0].Degerler[0], "MID: tırnak içinde ayırıcı");
            Esit("çift \"tırnak\"", d.Nesneler[0].Degerler[2], "MID: iç tırnak");
            Esit("x", d.Nesneler[2].Degerler[2], "MID: tırnaksız değer");
            Esit("6", d.Nesneler[5].Degerler[1], "MID: boş değerli satır");
            Esit(2, d.Nesneler[8].Parcalar.Count, "MIF dış: çoklu nokta");
            Esit(true, d.Nesneler[9].Parcalar.Count == 1 && d.Nesneler[9].Tur == "nokta", "MIF dış: topluluk (ilk parçanın türü)");
            MifDosyasi.CizimeCevir(d, 39);
            double s, y;
            Koordinat.CizimKoordinati(38.6748, 39.2232, 39, out s, out y);
            Esit(true, Math.Abs(d.Nesneler[0].Parcalar[0][0][0] - s) < 1e-6 && Math.Abs(d.Nesneler[0].Parcalar[0][0][1] - y) < 1e-6, "MIF dış: coğrafi koordinat çizim dilimine çevrilir");
            Esit(true, d.Nesneler[4].YaziBoyu > 5 && d.Nesneler[4].YaziBoyu < 20, "MIF dış: yazı yüksekliği metreye çevrilir");

            // Başka dilim (TM42) ve UTM: çizimin dilimine (TM39) çevrilir
            double s42, y42, sU, yU;
            Koordinat.EnlemBoylamdanTm(38.6748, 39.2232, 42, 1, 500000, 0, out s42, out y42);
            Koordinat.EnlemBoylamdanTm(38.6748, 39.2232, 39, 0.9996, 500000, 0, out sU, out yU);
            foreach (var kv in new[] { new { cs = "CoordSys Earth Projection 8, 104, \"m\", 42, 0, 1, 500000, 0", x = s42, yy = y42, ad = "TM42" },
                                       new { cs = "CoordSys Earth Projection 8, 104, \"m\", 39, 0, 0.9996, 500000, 0", x = sU, yy = yU, ad = "UTM 37" } })
            {
                var t = MifDosyasi.Oku("Version 300\n" + kv.cs + "\nColumns 1\n  A Char(5)\nData\nPoint " + kv.x.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) + " " +
                                       kv.yy.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) + "\n", "\"a\"\n");
                MifDosyasi.CizimeCevir(t, 39);
                var q = t.Nesneler[0].Parcalar[0][0];
                Esit(true, Math.Abs(q[0] - s) < 0.001 && Math.Abs(q[1] - y) < 0.001, "MIF: " + kv.ad + " → TM39 (1 mm)");
            }
            var ed50 = MifDosyasi.Oku("Version 300\nCoordSys Earth Projection 8, 28, \"m\", 39, 0, 1, 500000, 0\nColumns 1\n  A Char(5)\nData\nPoint 500000 4280000\n", null);
            MifDosyasi.CizimeCevir(ed50, 39);
            Esit(true, ed50.Uyarilar.Exists(u => u.Contains("datum")), "MIF: ITRF96 / WGS84 olmayan datumda uyarı");
            var duz = MifDosyasi.Oku("Version 300\nCoordSys NonEarth Units \"m\" Bounds (0, 0) (1000000, 5000000)\nColumns 0\nData\nPoint 512345.6 4280000.1\n", null);
            MifDosyasi.CizimeCevir(duz, 39);
            Esit(512345.6, duz.Nesneler[0].Parcalar[0][0][0], "MIF: düz koordinat olduğu gibi");
            var yazisiz = MifDosyasi.Oku("Version 300\nColumns 0\nData\nPoint 512345.6 4280000.1\n", null);
            MifDosyasi.CizimeCevir(yazisiz, 39);
            Esit(512345.6, yazisiz.Nesneler[0].Parcalar[0][0][0], "MIF: CoordSys yoksa metre koordinat olduğu gibi");

            // Kod sayfaları: Türkçe Windows ve UTF-8
            string tr = "Version 300\nCharset \"WindowsTurkish\"\nColumns 1\n  AD Char(20)\nData\nPoint 1 2\n";
            var trv = MifDosyasi.Oku(MifDosyasi.DosyaMetni(MifDosyasi.Turkce.GetBytes(tr)), MifDosyasi.DosyaMetni(MifDosyasi.Turkce.GetBytes("\"ŞİĞÜÖÇışğüöç\"\n")));
            Esit("ŞİĞÜÖÇışğüöç", trv.Nesneler[0].Degerler[0], "MID: Türkçe Windows kod sayfası");
            Esit("ğüş", MifDosyasi.DosyaMetni(Encoding.UTF8.GetBytes("ğüş")), "MID: Charset'siz UTF-8");
        }

        /// <summary>Harita altlığı: karo hesabı, plan (zoom, karo aralığı), karo mozaiğinin TM'ye çevrilmesi.</summary>
        private static void AltlikDene()
        {
            Console.WriteLine("Harita altlığı:");
            Esit("213", HaritaAltligi.QuadKey(3, 5, 3), "altlık: Bing karo anahtarı (belgedeki örnek)");
            double kx, ky, ex, ey;
            HaritaAltligi.KaroKonumu(0, 0, 1, false, out kx, out ky);
            Esit(true, Math.Abs(kx - 1) < 1e-12 && Math.Abs(ky - 1) < 1e-12, "altlık: 0°,0° → dünyanın ortası");
            HaritaAltligi.KaroKonumu(38.67, 39.22, 18, false, out kx, out ky);
            HaritaAltligi.KaroKonumu(38.67, 39.22, 18, true, out ex, out ey);
            Esit(true, Math.Abs(kx - ex) < 1e-9 && ey - ky > 100 && ey - ky < 2000, "altlık: Yandex (elipsoidal) karoları kuzeyde daha aşağıda");
            Esit("https://a/18/5/7?k=a%20b", HaritaAltligi.Adres("https://a/{z}/{x}/{y}?k={key}", 18, 5, 7, "a b"), "altlık: karo adresi");
            Esit(true, HaritaAltligi.Saglayicilar.Length >= 12 && HaritaAltligi.Bul("google_s").Anahtar == "google" && HaritaAltligi.Bul("yandex_m").Elipsoidal, "altlık: sağlayıcılar");

            var esri = HaritaAltligi.Bul("esri");
            var p = HaritaAltligi.Planla(511500, 4279600, 512500, 4280400, 39, esri, 0.5);
            Esit(18, p.Z, "altlık: 1 km alan, 0,5 m → zoom 18");
            Esit(true, p.KaroSayisi > 40 && p.KaroSayisi < 200 && Math.Abs(p.Cozunurluk - 0.4646) < 0.01, "altlık: karo sayısı ve piksel boyu");
            Esit(true, p.Genislik > 2000 && p.Genislik < 2300 && p.Yukseklik > 1600 && p.Yukseklik < 1800, "altlık: resim boyu");
            var buyuk = HaritaAltligi.Planla(500000, 4270000, 520000, 4290000, 39, esri, 0.5);
            Esit(true, buyuk.Z <= 14 && Math.Max(buyuk.Genislik, buyuk.Yukseklik) <= HaritaAltligi.EnBuyukKenar && buyuk.KaroSayisi <= HaritaAltligi.EnCokKaro, "altlık: 20 km alanda zoom düşer, sınırlar aşılmaz");

            // Mozaik: belli bir boylamın batısı kırmızı, belli bir enlemin kuzeyi yeşil; TM'ye çevrilen resimde her piksel kendi konumunun rengini alır
            int ts = 256, mw = (p.X1 - p.X0 + 1) * ts, mh = (p.Y1 - p.Y0 + 1) * ts;
            double sinirBoylam, sinirEnlem;
            Koordinat.EnlemBoylam(512000, 4280000, 39, out sinirEnlem, out sinirBoylam);
            double sx, sy;
            HaritaAltligi.KaroKonumu(sinirEnlem, sinirBoylam, p.Z, false, out sx, out sy);
            int sutun = (int)Math.Round((sx - p.X0) * ts), satir = (int)Math.Round((sy - p.Y0) * ts);
            var moz = new int[mw * mh];
            for (int y = 0; y < mh; y++)
                for (int x = 0; x < mw; x++)
                    moz[y * mw + x] = unchecked((int)0xFF000000) | (x < sutun ? 0xFF0000 : 0) | (y < satir ? 0x00FF00 : 0);
            var cikti = HaritaAltligi.Donustur(p, moz, mw, mh, ts, 39);
            Esit(p.Genislik * p.Yukseklik, cikti.Length, "altlık: çıktı boyu");
            var rnd = new Random(7);
            int dogru = 0, sayilan = 0;
            for (int k = 0; k < 400; k++)
            {
                int x = rnd.Next(p.Genislik), y = rnd.Next(p.Yukseklik);
                double e = p.E0 + (x + 0.5) * p.Cozunurluk, n = p.N1 - (y + 0.5) * p.Cozunurluk, en, boy;
                Koordinat.EnlemBoylam(e, n, 39, out en, out boy);
                double px, py;
                HaritaAltligi.KaroKonumu(en, boy, p.Z, false, out px, out py);
                double dx = (px - p.X0) * ts - sutun, dy = (py - p.Y0) * ts - satir;
                if (Math.Abs(dx) < 2 || Math.Abs(dy) < 2) continue; // sınıra çok yakın: aradeğer karışık renk verir
                sayilan++;
                int c = cikti[y * p.Genislik + x];
                bool kirmizi = (c & 0xFF0000) == 0xFF0000, yesil = (c & 0x00FF00) == 0x00FF00;
                if (kirmizi == dx < 0 && yesil == dy < 0 && ((c >> 24) & 255) == 255) dogru++;
            }
            Esit(sayilan, dogru, "altlık: TM'ye çevrilen resimde her piksel kendi yerinin rengini alır (" + sayilan + " örnek)");
            // TM'de sınır çizgisi: 512000 doğusu kırmızı değil (çıktının o sütununun iki yanı)
            int ortaX = (int)Math.Round((512000 - p.E0) / p.Cozunurluk), ortaY = (int)Math.Round((p.N1 - 4280000) / p.Cozunurluk);
            Esit(true, (cikti[ortaY * p.Genislik + ortaX - 5] & 0xFF0000) == 0xFF0000 && (cikti[ortaY * p.Genislik + ortaX + 5] & 0xFF0000) == 0, "altlık: sınır doğru yerde (±5 piksel)");
            Esit(true, HaritaAltligi.GoogleOturumGovdesi("hybrid").Contains("layerRoadmap") && HaritaAltligi.BingAdresi("https://ecn.{subdomain}.x/a{quadkey}.jpeg?mkt={culture}", new[] { "t0", "t1" }, 3, 3, 5) == "https://ecn.t0.x/a213.jpeg?mkt=tr-TR", "altlık: Google oturumu ve Bing adresi");
        }

        /// <summary>
        /// Malzeme adlarının görünen yazımı: büyük harf, standart birim ve kodlar, açılan kısaltmalar. Örnekler
        /// ortak/deneme/malzeme-yazimi.json'da; telefondaki deneme (telefon/web/tests/malzeme-yazimi.test.mjs) aynı dosyayı okur.
        /// </summary>
        /// <summary>
        /// Eklenti kaynağı denetimi (5.11.2026 çökmesi: hat çizip komuttan çıkınca AutoCAD "eNotOpenForWrite" iç hatasıyla
        /// kapanıyordu — süs takibi hattı yalnız okunur açıp genişletilmiş verisine yazıyordu). Kural: genişletilmiş veri
        /// yazılmadan hemen önce nesne yazmaya açılmış olmalı; UpgradeOpen yalnız yazmaya açık değilse çağrılır (açıksa
        /// AutoCAD hata verir).
        /// </summary>
        private static void YazmaDenetimiDene()
        {
            Console.WriteLine("Eklenti kaynağı: yazmaya açma denetimi");
            string kok = AppContext.BaseDirectory;
            while (kok != null && !Directory.Exists(Path.Combine(kok, "autocad", "src", "Eklenti"))) kok = Path.GetDirectoryName(kok.TrimEnd(Path.DirectorySeparatorChar));
            if (kok == null) { Console.WriteLine("  (kaynak bulunamadı, atlandı)"); return; }
            var hatalar = new List<string>();
            int xdata = 0;
            foreach (var dosya in Directory.GetFiles(Path.Combine(kok, "autocad", "src", "Eklenti"), "*.cs"))
            {
                var satirlar = File.ReadAllLines(dosya, Encoding.UTF8);
                for (int i = 0; i < satirlar.Length; i++)
                {
                    var m = System.Text.RegularExpressions.Regex.Match(satirlar[i], @"(\w+(?:\[\w]+\])?)\.XData = ");
                    if (m.Success)
                    {
                        xdata++;
                        string ad = m.Groups[1].Value;
                        bool tamam = false;
                        for (int j = Math.Max(0, i - 8); j <= i && !tamam; j++)
                            tamam = satirlar[j].Contains(ad + ".IsWriteEnabled") || satirlar[j].Contains(ad + " = new ") || satirlar[j].Contains("OpenMode.ForWrite") && satirlar[j].Contains(ad);
                        if (!tamam) hatalar.Add(Path.GetFileName(dosya) + ":" + (i + 1) + " " + ad + ".XData — önce yazmaya açılmalı");
                    }
                    var u = System.Text.RegularExpressions.Regex.Match(satirlar[i], @"(\w+(?:\[\w]+\])?)\.UpgradeOpen\(\)");
                    if (u.Success && !satirlar[i].Contains("!" + u.Groups[1].Value + ".IsWriteEnabled"))
                        hatalar.Add(Path.GetFileName(dosya) + ":" + (i + 1) + " " + u.Groups[1].Value + ".UpgradeOpen() korumasız");
                }
            }
            Esit(true, xdata >= 8, "genişletilmiş veri yazan yerler bulundu (" + xdata + ")");
            Esit("", string.Join(" | ", hatalar.ToArray()), "yalnız okunur nesneye yazma yok");
        }

        /// <summary>Örnekler ortak dosyada: telefondaki deneme de aynı dosyayı okur.</summary>
        private static List<string[]> MalzemeYazimiOrnekleri()
        {
            var kok = Json.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "malzeme-yazimi.json"), Encoding.UTF8)) as JsonNesne;
            var l = new List<string[]>();
            foreach (var x in kok.Dizi("ornekler"))
                if (x is List<object> c && c.Count >= 2) l.Add(new[] { Convert.ToString(c[0]), Convert.ToString(c[1]) });
            return l;
        }

        private static void MalzemeYazimiDene()
        {
            Console.WriteLine("Malzeme yazımı:");
            int dogru = 0;
            var ornekler = MalzemeYazimiOrnekleri();
            foreach (var o in ornekler)
            {
                string g = MalzemeYazimi.Duzelt(o[0]);
                if (g == o[1]) dogru++;
                else Console.WriteLine("    fark: '" + o[0] + "' → '" + g + "' (beklenen '" + o[1] + "')");
            }
            Esit(true, ornekler.Count >= 30, "malzeme yazımı: ortak örnek dosyası okundu (" + ornekler.Count + ")");
            Esit(ornekler.Count, dogru, "malzeme yazımı: örnekler");
            // Bütün katalog: ikinci kez uygulanınca değişmez, boşalan ya da çok uzayan ad yok
            var katalog = Katalog.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kalemler.json"), Encoding.UTF8), null);
            int sabit = 0, bozuk = 0;
            foreach (var it in katalog.Kalemler)
            {
                string a = MalzemeYazimi.Duzelt(it.Tanim), b = MalzemeYazimi.Duzelt(a);
                if (a == b) sabit++; else Console.WriteLine("    değişiyor: '" + it.Tanim + "' → '" + a + "' → '" + b + "'");
                if (a.Trim().Length == 0 && it.Tanim.Trim().Length > 0 || a.Length > it.Tanim.Length * 3 + 20) bozuk++;
            }
            Esit(katalog.Kalemler.Count, sabit, "malzeme yazımı: bütün katalogda ikinci uygulama değiştirmez (" + katalog.Kalemler.Count + " ad)");
            Esit(0, bozuk, "malzeme yazımı: boşalan / bozulan ad yok");
        }

        private static void CizimGorunumu()
        {
            Console.WriteLine("Çizim görünümü");
            if (!CizimStili.Yuklu) CizimStili.Yukle(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "cizim-stili.json"), Encoding.UTF8));
            Esit("Tahoma", CizimStili.YaziFontu, "yazı tipi Tahoma");
            Esit("SEBEKE-M", CizimStili.YaziStili, "yazı stili");
            Esit((short)1, CizimStili.HatRengi("OG_HAVAI", "M"), "renk: OG havai kırmızı");
            Esit((short)84, CizimStili.HatRengi("AG_HAVAI", "M"), "renk: AG havai yeşil");
            Esit((short)30, CizimStili.HatRengi("REKORTMAN", "M"), "renk: abone turuncu");
            Esit((short)200, CizimStili.HatRengi("MUSTEREK", "M"), "renk: müşterek mor");
            Esit((short)150, CizimStili.HatRengi("AG_YERALTI", "M"), "renk: AG yer altı mavi");
            Esit((short)230, CizimStili.HatRengi("OG_YERALTI", "M"), "renk: OG yer altı pembe");
            Esit((short)2, CizimStili.HatRengi("OG_YERALTI", "DM"), "renk: demontaj sarı");
            var renkler = new Dictionary<short, string>();
            foreach (var t in new[] { "OG_HAVAI", "AG_HAVAI", "AYDINLATMA", "REKORTMAN", "MUSTEREK", "AG_YERALTI", "OG_YERALTI" })
            {
                short r = CizimStili.HatRengi(t, "M");
                Esit(false, renkler.ContainsKey(r), "renk: " + t + " başka hatla aynı değil" + (renkler.ContainsKey(r) ? " (" + renkler[r] + ")" : ""));
                renkler[r] = t;
            }
            foreach (var k in new[] { "KANAL", "SONDAJ", "HAT_ENH" })
                Esit(false, renkler.ContainsKey(CizimStili.Katman(k).Aci), "renk: " + k + " hatlardan ayrı");
            Esit("KABLO_OG", CizimStili.KatmanTuruStili("SC_2.HAK.OG_YER_XLPE").Anahtar, "katman: OG yer altı kendi stilinde");
            Esit("KABLO", CizimStili.KatmanTuruStili("SC_2.HAK.AG_YER_HAT").Anahtar, "katman: AG yer altı");
            Esit("CENTER", CizimStili.Katman("KANAL").Cizgi, "kanal ekseni eksen çizgisi");
            Esit(true, CizimStili.CizgiDeseni("CENTER") != null, "eksen çizgisi deseni tanımlı");
            Esit((short)8, CizimStili.KanalKenari.Aci, "kanal kenarı gri");
            Esit(0.4, CizimStili.KanalKenari.VarsayilanGenislik, "kanal kenarı varsayılan genişlik");
            Esit(0.6, NesneYazici.KanalGenisligi(new Kanal { UstGenislik = 60, AltGenislik = 40 }), "kanal genişliği: üst genişlik (cm → m)");
            Esit(0.4, NesneYazici.KanalGenisligi(new Kanal { AltGenislik = 40 }), "kanal genişliği: üst yoksa alt");
            Esit(0.4, NesneYazici.KanalGenisligi(new Kanal()), "kanal genişliği: ölçü yoksa varsayılan");
            var kanal = new Kanal { Id = "K1", UstGenislik = 70, Durum = "M", Kose = { new[] { 0.0, 0.0 }, new[] { 10.0, 0.0 } } };
            Esit(0.7, NesneYazici.Kanal(kanal, "SC", null).KenarGenisligi, "kanal tarifi kenar genişliğini taşır");
            Esit(0.0, NesneYazici.Hat(new Hat { Id = "H1", Tur = "AG_YERALTI", Durum = "M", Kose = { new[] { 0.0, 0.0 }, new[] { 5.0, 0.0 } } }, "SC", null).KenarGenisligi, "hatta kenar yok");

            // Açıklıklar: elemansız kırılma köşelerinde bölünmez
            var kose = new List<double[]> { new[] { 0.0, 0.0 }, new[] { 30.0, 0.0 }, new[] { 30.0, 40.0 }, new[] { 50.0, 40.0 }, new[] { 50.0, 50.0 } };
            var tek = Geometri.Acikliklar(kose, i => false);
            Esit(1, tek.Count, "açıklık: elemansız köşelerde tek açıklık");
            int parca; double uz;
            Esit(true, Geometri.AciklikYazisi(kose, tek[0][0], tek[0][1], out parca, out uz), "açıklık yazısı var");
            Esit(100.0, uz, "açıklık metrajı tüm parçaların toplamı");
            Esit(1, parca, "yazı en uzun parçada (30→40)");
            var iki = Geometri.Acikliklar(kose, i => i == 2);
            Esit(2, iki.Count, "açıklık: elemanlı köşede bölünür");
            Esit("0-2 2-4", iki[0][0] + "-" + iki[0][1] + " " + iki[1][0] + "-" + iki[1][1], "açıklık sınırları");
            Geometri.AciklikYazisi(kose, iki[1][0], iki[1][1], out parca, out uz);
            Esit(30.0, uz, "ikinci açıklık metrajı");
            Esit(true, Geometri.AciklikSiniri("BOX", "SDK") && Geometri.AciklikSiniri("AG_DIREK", "DIREK_AG") && Geometri.AciklikSiniri("TRAFO_MERKEZI", "TRAFO_KOSK"), "açıklık sınırı: direk, SDK, trafo");
            Esit(false, Geometri.AciklikSiniri("EK_MUFU", "MUFU") || Geometri.AciklikSiniri("DIGER", "MENHOL"), "açıklık sınırı değil: ek mufu, menhol");

            // Yazı yeri parçanın kendi ekseninde (telefondaki dxf.js yaziKonumu ile aynı): yatay hatta dünya ekseniyle aynı,
            // dik hatta metraj bir yanda, etiket öbür yanda (çizginin üstüne binip birbirini örtmez)
            double x, y, aci;
            Geometri.YaziKonumu(new[] { 0.0, 0.0 }, new[] { 10.0, 0.0 }, new[] { 0.0, 0.8 }, out x, out y, out aci);
            Esit("5,000 0,800 0,0", Konum(x, y, aci), "yazı yeri: yatay hatta metraj 0,8 m üstte");
            Geometri.YaziKonumu(new[] { 10.0, 0.0 }, new[] { 0.0, 0.0 }, new[] { 0.0, 0.8 }, out x, out y, out aci);
            Esit("5,000 0,800 0,0", Konum(x, y, aci), "yazı yeri: ters çizilmiş yatay hatta da aynı (yazı ters dönmez)");
            Geometri.YaziKonumu(new[] { 0.0, 0.0 }, new[] { 0.0, 10.0 }, new[] { 0.0, 0.8 }, out x, out y, out aci);
            Esit("-0,800 5,000 90,0", Konum(x, y, aci), "yazı yeri: dik hatta metraj çizginin solunda");
            Geometri.YaziKonumu(new[] { 0.0, 0.0 }, new[] { 0.0, 10.0 }, CizimStili.HatKaydirma, out x, out y, out aci);
            Esit("0,700 5,000 90,0", Konum(x, y, aci), "yazı yeri: dik hatta etiket çizginin sağında (üst kenarı 0,7 m ötede)");
            Geometri.YaziKonumu(new[] { 0.0, 0.0 }, new[] { 10.0, 10.0 }, new[] { 1.0, 0.0 }, out x, out y, out aci);
            Esit("5,707 5,707 45,0", Konum(x, y, aci), "yazı yeri: boyunca kaydırma parça doğrultusunda");
            // Kanal / sondaj metrajı kablonun metrajından bir satır yukarıda: iki yazı üst üste binmez
            Esit(0.46, CizimStili.KaziBosluk, "kazı metrajı ile kablo metrajı arası boşluk");
            Esit(true, CizimStili.ParcaKaydirma[1] > 0 && CizimStili.HatKaydirma[1] < 0, "metraj çizginin üst yanında, etiket alt yanında");

            // Yazılar parçanın ortasına ortalı, parçaya sığdırılmış (YaziDuzeni; telefondaki dxf.js yaziSigdir ile aynı)
            Esit(true, Math.Abs(YaziDuzeni.Genislik("12.34", 1.44) - (0.57 * 4 + 0.36) * 1.44) < 1e-9, "yazı genişliği harf tablosundan");
            double h, gk;
            YaziDuzeni.Sigdir("12.34", 1.44, 30, out h, out gk);
            Esit("1,440 1,000", Konum2(h, gk), "sığan yazı olduğu gibi kalır");
            string uzun = "^ 3x95+50 NYY Al";
            double w = YaziDuzeni.Genislik(uzun, 1.8);
            YaziDuzeni.Sigdir(uzun, 1.8, w / 0.9 * 0.8, out h, out gk);
            Esit("1,800 0,800", Konum2(h, gk), "biraz uzun yazı daraltılır (genişlik katsayısı 0,8)");
            YaziDuzeni.Sigdir(uzun, 1.8, w / 0.9 * 0.3, out h, out gk);
            Esit("1,080 0,600", Konum2(h, gk), "çok uzun yazı en dar (0,6) ve en küçük (%60) ölçüde");
            YaziDuzeni.Sigdir(uzun, 1.8, w / 0.9 * 0.48, out h, out gk);
            Esit("1,440 0,600", Konum2(h, gk), "daraltma yetmezse yükseklik küçülür (0,48 = 0,6 × 0,8)");
            Esit(1, YaziDuzeni.EnUzunParca(kose), "etiket en uzun parçada (30→40)");
            YaziDuzeni.Yerlestir(new[] { 0.0, 0.0 }, new[] { 0.0, 50.0 }, CizimStili.HatKaydirma[1], uzun, 1.8, out x, out y, out aci, out h, out gk);
            Esit("0,700 25,000 90,0", Konum(x, y, aci), "dik hatta etiket ortalı: parçanın ortası, çizginin sağında");
            // Harf tablosu ortak stildekiyle aynı (telefon oradan okur)
            var stilJson = Json.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "cizim-stili.json"), Encoding.UTF8)) as JsonNesne;
            var harfler = stilJson.Nesne("yazi").Nesne("harfGenislikleri");
            int harfSayisi = 0, harfFarki = 0;
            foreach (var kv in harfler)
            {
                if (kv.Key == "aciklama") continue;
                harfSayisi++;
                double g = kv.Key == "varsayilan" ? YaziDuzeni.Varsayilan : YaziDuzeni.Genislik(kv.Key, 1);
                if (kv.Key.Length != 1 && kv.Key != "varsayilan") harfFarki++;
                else if (Math.Abs(g - Convert.ToDouble(kv.Value, CultureInfo.InvariantCulture)) > 1e-9) harfFarki++;
            }
            Esit(YaziDuzeni.HarfSayisi + 1, harfSayisi, "harf tablosu: ortak stilde de aynı sayıda harf");
            Esit(0, harfFarki, "harf tablosu: ortak stildeki genişliklerle aynı");
            var sigdir = stilJson.Nesne("yazi").Nesne("sigdirma");
            Esit(YaziDuzeni.Pay + " " + YaziDuzeni.EnDarGenislik + " " + YaziDuzeni.EnKucukYukseklik,
                 sigdir.Ondalik("pay") + " " + sigdir.Ondalik("enDarGenislik") + " " + sigdir.Ondalik("enKucukYukseklik"), "sığdırma sınırları ortak stildekiyle aynı");
            Esit(true, NesneYazici.Kanal(kanal, "SC", null).KaziMetraji, "kanal metrajı kazı metrajı");
            Esit(true, NesneYazici.Sondaj(new Sondaj { Id = "S1", Durum = "M", Kose = { new[] { 0.0, 0.0 }, new[] { 8.0, 0.0 } } }, "SC", null).KaziMetraji, "sondaj metrajı kazı metrajı");
            Esit(false, NesneYazici.Hat(new Hat { Id = "H2", Tur = "AG_YERALTI", Durum = "M", Kose = { new[] { 0.0, 0.0 }, new[] { 5.0, 0.0 } } }, "SC", null).KaziMetraji, "hat metrajı kazı metrajı değil");
        }

        private static string Konum2(double a, double b) =>
            a.ToString("0.000", CultureInfo.GetCultureInfo("tr-TR")) + " " + b.ToString("0.000", CultureInfo.GetCultureInfo("tr-TR"));

        private static string Konum(double x, double y, double aci) =>
            x.ToString("0.000", CultureInfo.GetCultureInfo("tr-TR")) + " " + y.ToString("0.000", CultureInfo.GetCultureInfo("tr-TR")) + " " +
            (aci * 180 / Math.PI).ToString("0.0", CultureInfo.GetCultureInfo("tr-TR"));

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
                HedefHatId = "H14", Ozet = "%1,57 · uygun", Durum = "uygun", ModulDurumu = "{\"kols\":[1,2]}", Tarih = HesapKaydi.Simdi(), Kaynak = "autocad", Yapan = "Deneme Kişisi", TelefonId = "tel-1",
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
            var bilgi = new ProjeBilgisi { Ad = "Deneme", Yapan = "Deneme Kişisi", BuzBolgesi = "3" };
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
            Esit("SC101", ((JsonNesne)hat.Dizi("acikliklar")[0]).Metin("bit"), "bağlam: ilk açıklığın bitişi SC101");
            // AutoCAD'den okunan çizimde yönetilen her uygulamanın yalnız adı yazılmış boş bölümü olabilir (eski değeri silmek
            // için yazılır). Boş NIT bölümü GPS noktasını eleman yapmamalı; yoksa direğin üstündeki nokta zincir düğümü olur.
            var cizimBos = NesneYazici.Hepsi(tp, id => false);
            foreach (var v in cizimBos)
                foreach (var u in new[] { "GIS", "NIT", "MALZEME", "HAT", "ANAKESIT", "KONTROL", "FULLREG", "HAKNO", "ZKOORD" })
                    if (!v.Xd.ContainsKey(u)) v.Xd[u] = new List<string>();
            var okunan = NesneOkuyucu.Oku(cizimBos, "bos-bolum.dwg");
            Esit(tp.Noktalar.Count, okunan.Noktalar.Count, "okuyucu: boş NIT bölümlü GPS noktası nokta kalır");
            Esit(tp.Elemanlar.Count, okunan.Elemanlar.Count, "okuyucu: boş bölümler eleman sayısını değiştirmez");
            Esit(tp.Hatlar.Count, okunan.Hatlar.Count, "okuyucu: boş bölümler hat sayısını değiştirmez");
            var bh2 = HesapBaglami.Kur(okunan, new HesapHedefi { Tur = "hat", Id = "H17" }, bilgi);
            Esit("SC101", ((JsonNesne)bh2.Nesne("hat").Dizi("acikliklar")[0]).Metin("bit"), "bağlam: GPS noktalı çizimde zincir düğümü direk (SC101)");
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

        // ---------------- DWG 2000 onarımı (uydurma dosyayla) ----------------

        private static void BsYaz(DwgOnarici.Yazici y, int v)
        {
            if (v == 0) { y.Sayi(2, 2); return; }
            if (v < 256) { y.Sayi(1, 2); y.Sayi(v, 8); return; }
            y.Sayi(0, 2); y.Sayi(v & 0xFF, 8); y.Sayi(v >> 8, 8);
        }

        private static void HYaz(DwgOnarici.Yazici y, int kod, int v)
        {
            y.Sayi(kod, 4);
            int n = v == 0 ? 0 : v < 0x100 ? 1 : 2;
            y.Sayi(n, 4);
            for (int i = n - 1; i >= 0; i--) y.Sayi((v >> (8 * i)) & 0xFF, 8);
        }

        /// <summary>Uydurma nesne: tür, tanıtıcı, EED bölümleri (uygulama tanıtıcısı, veri; veri null: değersiz bölüm), gövde, tanıtıcı akışı.</summary>
        private static byte[] UydurmaNesne(int tur, int tanitici, List<KeyValuePair<int, byte[]>> eed, Action<DwgOnarici.Yazici> govde, int katman)
        {
            // Bit boyu tanıtıcı akışının başıdır: önce gövdeyi ölç, sonra yaz
            Func<long, DwgOnarici.Yazici> yaz = bitBoy =>
            {
                var y = new DwgOnarici.Yazici();
                BsYaz(y, tur);
                foreach (var bayt in BitConverter.GetBytes((uint)bitBoy)) y.Sayi(bayt, 8);
                HYaz(y, 0, tanitici);
                foreach (var e in eed)
                {
                    BsYaz(y, e.Value == null ? 0 : e.Value.Length);
                    HYaz(y, 5, e.Key);
                    if (e.Value != null) foreach (var bb in e.Value) y.Sayi(bb, 8);
                }
                BsYaz(y, 0);
                govde(y);
                return y;
            };
            long ana = yaz(0).BitSayisi;
            var son = yaz(ana);
            if (katman > 0) HYaz(son, 5, katman);
            var veri = son.Baytlar();
            var on = DwgOnarici.MsYaz(veri.Length);
            var nesne = new byte[on.Length + veri.Length + 2];
            Buffer.BlockCopy(on, 0, nesne, 0, on.Length);
            Buffer.BlockCopy(veri, 0, nesne, on.Length, veri.Length);
            int crc = DwgOnarici.Crc(nesne, 0, on.Length + veri.Length);
            nesne[nesne.Length - 2] = (byte)crc; nesne[nesne.Length - 1] = (byte)(crc >> 8);
            return nesne;
        }

        private static byte[] UydurmaDwg(List<KeyValuePair<int, byte[]>> nesneler)
        {
            var dosya = new List<byte>(Encoding.ASCII.GetBytes("AC1015"));
            while (dosya.Count < 0x100) dosya.Add(0);
            var konum = new List<KeyValuePair<int, int>>();
            foreach (var n in nesneler) { konum.Add(new KeyValuePair<int, int>(n.Key, dosya.Count)); dosya.AddRange(n.Value); }
            int haritaBas = dosya.Count;
            var bolum = new List<byte>();
            int st = 0, sl = 0;
            Action<int, bool> mc = (v, isaretli) =>
            {
                bool eksi = v < 0; int a = Math.Abs(v);
                while (true)
                {
                    int sinir = isaretli ? 0x40 : 0x80;
                    if (a < sinir) { bolum.Add((byte)(a | (isaretli && eksi ? 0x40 : 0))); return; }
                    bolum.Add((byte)((a & 0x7F) | 0x80)); a >>= 7;
                }
            };
            foreach (var kv in konum) { mc(kv.Key - st, false); mc(kv.Value - sl, true); st = kv.Key; sl = kv.Value; }
            int boy = bolum.Count + 2;
            dosya.Add((byte)(boy >> 8)); dosya.Add((byte)boy); dosya.AddRange(bolum); dosya.Add(0); dosya.Add(0);
            dosya.Add(0); dosya.Add(2); dosya.Add(0); dosya.Add(0);
            int haritaBoy = dosya.Count - haritaBas;
            var b = dosya.ToArray();
            BitConverter.GetBytes(3).CopyTo(b, 0x15);
            for (int i = 0; i < 3; i++)
            {
                b[0x19 + i * 9] = (byte)i;
                BitConverter.GetBytes(i == 2 ? haritaBas : 0).CopyTo(b, 0x19 + i * 9 + 1);
                BitConverter.GetBytes(i == 2 ? haritaBoy : 0).CopyTo(b, 0x19 + i * 9 + 5);
            }
            return b;
        }

        /// <summary>
        /// Açılırken çöken çizimin onarımı (DwgOnarici): uydurma bir DWG 2000 dosyasında değersiz (sıfır uzunluklu)
        /// genişletilmiş veri bölümü çıkarılır, öbür bölümler, nesnenin gövdesi ve tanıtıcı akışı aynen kalır.
        /// </summary>
        private static void DwgOnarDene()
        {
            Console.WriteLine("DWG 2000 onarımı (değersiz genişletilmiş veri bölümü)");
            Action<DwgOnarici.Yazici> appidGovde(string ad) => y => { y.Sayi(2, 2); BsYaz(y, ad.Length + 1); foreach (char c in ad) y.Sayi(c, 8); y.Sayi(0, 8); };
            Action<DwgOnarici.Yazici> varlik = y => { y.Sayi(0, 1); y.Sayi(0x1A5, 13); };
            var nesneler = new List<KeyValuePair<int, byte[]>>
            {
                new KeyValuePair<int, byte[]>(0x10, UydurmaNesne(67, 0x10, new List<KeyValuePair<int, byte[]>>(), appidGovde("GIS"), 0)),
                new KeyValuePair<int, byte[]>(0x11, UydurmaNesne(67, 0x11, new List<KeyValuePair<int, byte[]>>(), appidGovde("MALZEME"), 0)),
                new KeyValuePair<int, byte[]>(0x20, UydurmaNesne(19, 0x20, new List<KeyValuePair<int, byte[]>>
                {
                    new KeyValuePair<int, byte[]>(0x10, new byte[] { 0, 3, 0xA2, 0x00, 0x41, 0x42, 0x43 }),
                    new KeyValuePair<int, byte[]>(0x11, null),
                }, varlik, 0x30)),
                new KeyValuePair<int, byte[]>(0x21, UydurmaNesne(19, 0x21, new List<KeyValuePair<int, byte[]>>
                {
                    new KeyValuePair<int, byte[]>(0x10, new byte[] { 0, 1, 0xA2, 0x00, 0x5A }),
                }, varlik, 0x30)),
            };
            var dwg = UydurmaDwg(nesneler);
            byte[] onarilmis;
            var s = DwgOnarici.Onar(dwg, out onarilmis);
            Esit("", s.Hata, "onarım: dosya okunur");
            Esit(4, s.NesneSayisi, "onarım: nesne haritası");
            Esit("20:MALZEME", string.Join(" ", s.Nesneler.ConvertAll(kv => kv.Key + ":" + string.Join(",", kv.Value.ToArray())).ToArray()), "onarım: yalnız değersiz bölümü olan nesne");
            Esit(dwg.Length, onarilmis.Length, "onarım: dosya boyu aynı (nesne yerinde, haritaya dokunulmaz)");
            byte[] ikinci;
            Esit(false, DwgOnarici.Onar(onarilmis, out ikinci).Degisti, "onarım: onarılmış dosyada iş kalmaz");
            // Onarılmış nesne: CRC tutar, GIS bölümü aynen, gövde ve tanıtıcı akışı (katman 0x30) yerinde
            var harita = DwgOnarici.NesneHaritasi(onarilmis, BitConverter.ToInt32(onarilmis, 0x19 + 18 + 1), BitConverter.ToInt32(onarilmis, 0x19 + 18 + 5));
            int loc = harita[0x20];
            int sz = onarilmis[loc] | (onarilmis[loc + 1] << 8);
            Esit(onarilmis[loc + 2 + sz] | (onarilmis[loc + 3 + sz] << 8), DwgOnarici.Crc(onarilmis, loc, 2 + sz), "onarım: nesnenin CRC'si yeni");
            var r = new DwgOnarici.Okuyucu(onarilmis, loc + 2);
            Esit(19, r.BS(), "onarım: tür");
            long bitBoy = r.RL();
            Esit(0x20L, r.H(), "onarım: tanıtıcı");
            int es = r.BS();
            Esit(7, es, "onarım: GIS bölümü (7 bayt)");
            Esit(0x10L, r.H(), "onarım: GIS uygulaması");
            r.P += es * 8;
            Esit(0, r.BS(), "onarım: değersiz bölüm yok, bitiş");
            Esit(0L, r.Bitler(1), "onarım: gövde aynen (grafik yok)");
            Esit(0x1A5L, r.Bitler(13), "onarım: gövde aynen");
            Esit(bitBoy, r.P - (loc + 2) * 8L, "onarım: bit boyu tanıtıcı akışının başı");
            Esit(0x30L, r.H(), "onarım: tanıtıcı akışı (katman) yerinde");
            var yeni = new byte[106];
            Encoding.ASCII.GetBytes("AC1032").CopyTo(yeni, 0);
            byte[] x;
            Esit(true, DwgOnarici.Onar(yeni, out x).Hata.Contains("AutoCAD 2018"), "onarım: 2018 biçiminde açıklama");
        }

        /// <summary>
        /// Kanal zemini (cins / kaplama / bariyer / trencher → eski programın kalem adı) ve proje bazında kanal listesi:
        /// ortak denemeler ortak/deneme/kanal-zemini.json ve kanal-listesi.json (telefondaki tests/kanal.test.mjs aynı
        /// dosyaları okur, aynı sonucu üretmek zorundadır).
        /// </summary>
        private static void KanalDene()
        {
            Console.WriteLine("Kanal zemini ve kanal listesi");
            var z = Json.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kanal-zemini.json"), Encoding.UTF8)) as JsonNesne;
            int n = 0;
            foreach (var x in z.Dizi("katalog"))
            {
                string t = Convert.ToString(x, CultureInfo.InvariantCulture);
                var c = KanalZemini.Coz(t);
                Esit(true, c != null, "ortak: katalog adı çözülür · " + t);
                if (c != null) Esit(t, c.Tanim, "ortak: katalog adı yeniden kurulur · " + t);
                n++;
            }
            Esit(19, n, "ortak: katalogdaki kanal adı sayısı");
            foreach (var x in z.Dizi("kurulum"))
            {
                var o = (JsonNesne)x;
                var c = new KanalZemini { Cins = o.Metin("cins"), Kaplama = o.Metin("kaplama"), Bariyerli = o.Mantik("bariyerli") == true, Trencher = o.Mantik("trencher") == true };
                Esit(o.Metin("tanim"), c.Tanim, "ortak: kalem adı · " + o.Metin("tanim"));
                Esit(o.Metin("yazi"), c.Yazi, "ortak: okunur yazı · " + o.Metin("tanim"));
            }
            foreach (var x in z.Dizi("cozum"))
            {
                var o = (JsonNesne)x;
                var c = KanalZemini.Coz(o.Metin("tanim"));
                Esit(o.Metin("cins") + "|" + o.Metin("kaplama") + "|" + (o.Mantik("bariyerli") == true) + "|" + (o.Mantik("trencher") == true),
                    c == null ? "null" : c.Cins + "|" + c.Kaplama + "|" + c.Bariyerli + "|" + c.Trencher, "ortak: çözüm · " + o.Metin("tanim"));
            }
            foreach (var x in z.Dizi("kuralDisi"))
                Esit(true, KanalZemini.Coz(Convert.ToString(x, CultureInfo.InvariantCulture)) == null, "ortak: kural dışı ad · \"" + x + "\"");
            Esit(50, KanalZemini.Hepsi().Count, "bütün birleşimler: 3 cins × 4 kaplama × bariyer × trencher + 2 özel");
            // Katalog: her birleşim kanal kalemi; katalogdakiler kendi kalemi, olmayanlar aynı tarifeyle kurulur
            var kat = Katalog.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kalemler.json"), Encoding.UTF8), null);
            var zeminler = kat.KanalZeminleri();
            Esit(50, zeminler.Count, "katalog: 50 kanal zemini kalemi");
            Esit(19, zeminler.FindAll(x => x.Kaynak != "kural").Count, "katalog: eski programın 19 adı kendi kalemiyle");
            var asfaltli = kat.KanalZeminiKalemi("TOPRAK (ASFALT KAPLAMALI)");
            Esit(true, asfaltli != null && asfaltli.Kaynak == "kural" && asfaltli.Cins == "KABLO_KANALI" && asfaltli.Birim == "mt/m³", "katalog: katalogda olmayan birleşim kuralla kurulur");
            Esit(kat.KanalZeminiKalemi("TOPRAK").Tarife, asfaltli.Tarife, "katalog: kurulan kalemin tarifesi topraktaki gibi");
            // Yeraltı kablosu / kanal metrajı açıklık başına: ara kırılma köşelerinde bölünmez, yalnız elemanlarda
            var kose = new List<double[]> { new[] { 0.0, 0 }, new[] { 10.0, 0 }, new[] { 10.0, 10 }, new[] { 20.0, 10 }, new[] { 20.0, 30 }, new[] { 25.0, 30 } };
            Esit(1, Geometri.Acikliklar(kose, i => false).Count, "metraj: elemansız köşelerde tek açıklık (her iki nokta arasına yazılmaz)");
            Esit(2, Geometri.Acikliklar(kose, i => i == 3).Count, "metraj: arada eleman (muf, box) varsa iki açıklık");
            var adlar = new HashSet<string>(StringComparer.Ordinal);
            foreach (var c in KanalZemini.Hepsi()) adlar.Add(c.Tanim);
            Esit(50, adlar.Count, "bütün birleşimlerin adları ayrı");
            foreach (var c in KanalZemini.Hepsi())
            {
                var g = KanalZemini.Coz(c.Tanim);
                if (g == null || g.Tanim != c.Tanim) { Esit(c.Tanim, g == null ? "null" : g.Tanim, "her birleşim geri çözülür"); break; }
            }

            var l = Json.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kanal-listesi.json"), Encoding.UTF8)) as JsonNesne;
            var p = ProjeDosyasi.Oku(Json.Yaz(l.Nesne("girdi"), false));
            var liste = new KanalListesi(p).Json();
            var beklenen = l.Nesne("beklenen");
            foreach (var ad in new[] { "satirlar", "projeler", "ozet" })
                Esit(Json.Yaz(beklenen.Dizi(ad), false), Json.Yaz(liste[ad], false), "ortak kanal listesi: " + ad);
            var merkez = new KanalListesi(p, "Merkez");
            Esit("K2,K5,K1", string.Join(",", merkez.Satirlar.ConvertAll(s => s.Kimlik).ToArray()), "kanal listesi: tek proje süzgeci");
            Esit("K1", string.Join(",", new KanalListesi(p, null, 2).Satirlar.ConvertAll(s => s.Kimlik).ToArray()), "kanal listesi: tek hakediş süzgeci");
            // Çizime konan tablo: başlık + sütun başlıkları + her proje (başlık, kanallar, toplam) + genel toplam
            var tablo = new KanalTablosu(new KanalListesi(p), 1.8);
            Esit(14, tablo.SatirSayisi, "kanal tablosu: satır sayısı");
            double toplamGenislik = 0;
            foreach (var g in tablo.Sutunlar) toplamGenislik += g;
            Esit(true, Math.Abs(toplamGenislik - tablo.Genislik) < 1e-9, "kanal tablosu: sütunlar tablonun genişliğini doldurur");
            Esit(true, Math.Abs(tablo.Yukseklik - (2.4 * 1.8 + 13 * 1.8 * 1.8)) < 1e-9, "kanal tablosu: yükseklik (başlık 2,4h, satırlar 1,8h)");
            bool tasan = false;
            foreach (var y in tablo.Yazilar)
            {
                double sol = y.Sag ? y.X - YaziDuzeni.Genislik(y.Metin, y.H) : y.X, sag = y.Sag ? y.X : y.X + YaziDuzeni.Genislik(y.Metin, y.H);
                if (sol < -1e-9 || sag > tablo.Genislik + 1e-9) tasan = true;
            }
            Esit(false, tasan, "kanal tablosu: yazılar tablonun içinde");
            Esit(true, tablo.Yazilar.Exists(y => y.Metin == "PROJE: Merkez (11.22.33)") && tablo.Yazilar.Exists(y => y.Metin == "22,64" && y.Sag),
                "kanal tablosu: proje başlığı ve sağa yaslı toplam hacim");
            Esit(true, tablo.Yazilar.Exists(y => y.Metin == "Parke · bariyerli") && tablo.Yazilar.Exists(y => y.Metin == "Kaplamasız · trencher"), "kanal tablosu: kaplama hücresi");
            // Excel sayfaları kurulur (KANAL LİSTESİ: 5 satır + 3 proje toplamı + genel toplam)
            var xl = new XlsxYazici();
            new KanalListesi(p).SayfalariEkle(xl, "deneme");
            string gecici = Path.Combine(Path.GetTempPath(), "kanal-listesi-deneme.xlsx");
            xl.Kaydet(gecici);
            Esit(true, new FileInfo(gecici).Length > 1000, "kanal listesi: Excel yazılır");
            File.Delete(gecici);
        }

        /// <summary>
        /// Kullanıcılar, roller ve hakediş yetkisi (17. madde): telefonla ortak tablo (roller.json) ve ortak deneme
        /// (kullanicilar.json — telefondaki tests/kullanicilar.test.mjs aynı dosyayı okur), onay değişikliği yetkisi,
        /// yazmaya kapalı hakediş kilidi, proje dosyasında taşınma.
        /// </summary>
        private static void KullanicilarDene()
        {
            Console.WriteLine("Kullanıcılar ve roller");
            Roller.Yukle(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "roller.json"), Encoding.UTF8));
            Esit("saha,kontrol,hakedis,onay,yonetici", string.Join(",", new List<Rol>(Roller.Liste).ConvertAll(r => r.Id).ToArray()), "roller: telefonla aynı sıra");
            Esit("Kontrol mühendisi ya da Yönetici", Roller.Kimler(Roller.KontrolOnayi), "AutoCAD Kontrol onayı: kontrol mühendisi");
            Esit("Onay yetkilisi ya da Yönetici", Roller.Kimler(Roller.HakedisOnayi_), "AutoCAD Hakediş onayı: onay yetkilisi");
            Esit("Onay yetkilisi ya da Yönetici", Roller.Kimler(Roller.GisOnayi), "AutoCAD GIS onayı: onay yetkilisi");
            Esit("Yönetici", Roller.Kimler("tanimsiz.islem"), "tanımsız işlem yalnız Yönetici");

            var ortak = Json.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kullanicilar.json"), Encoding.UTF8)) as JsonNesne;
            foreach (var x in ortak.Dizi("sifreler"))
            {
                var o = (JsonNesne)x;
                Esit(o.Metin("ozet"), Yetki.Ozet(o.Metin("sifre"), o.Metin("tuz")), "ortak: şifre özeti telefonla aynı (tuz " + o.Metin("tuz") + ")");
                Esit(true, Yetki.SifreGecerli(o.Metin("sifre")), "ortak: geçerli şifre " + o.Metin("sifre"));
            }
            foreach (var x in ortak.Dizi("gecersizSifreler"))
                Esit(false, Yetki.SifreGecerli(Convert.ToString(x, CultureInfo.InvariantCulture)), "ortak: geçersiz şifre \"" + x + "\"");
            Esit(false, Yetki.SifreGecerli("1234\n"), "şifre: satır sonu kabul edilmez");
            foreach (var x in ortak.Dizi("birlestirme"))
            {
                var c = (JsonNesne)x;
                var sonuc = Yetki.Birlestir(Yetki.Oku(c.Dizi("yerel")), Yetki.Oku(c.Dizi("gelen")));
                Esit(Json.Yaz(c.Dizi("beklenen"), false), Yetki.ListeJson(sonuc), "ortak birleştirme: " + c.Metin("ad"));
                Esit(c.Mantik("onayAcik") == true, Yetki.OnayAcik(sonuc), "ortak birleştirme: onay açık mı · " + c.Metin("ad"));
            }
            foreach (var x in ortak.Dizi("onayAyari"))
            {
                var c = (JsonNesne)x;
                var sonuc = Yetki.Birlestir(OnayAyari.Oku(c.Nesne("yerel")), OnayAyari.Oku(c.Nesne("gelen")));
                Esit(Json.Yaz(c.Nesne("beklenen"), false), sonuc == null ? "null" : Json.Yaz(sonuc.Json(), false), "ortak onay ayarı: " + c.Metin("ad"));
            }

            // Onay değişikliği yetkisi (SH_ONAY): onay kapalıyken serbest; açıkken her aşama kendi rolünde
            Func<string, string, string, Kullanici> uye = (id, ad, rol) => new Kullanici { Id = id, Ad = ad, Rol = rol, Tuz = "T" + id, Ozet = Yetki.Ozet("1234", "T" + id), Guncelleme = "2026-11-01T08:00:00.000Z" };
            var yon = uye("U1", "Deneme Yönetici", "yonetici");
            var kon = uye("U2", "Deneme Kontrol", "kontrol");
            var ona = uye("U3", "Deneme Onay", "onay");
            var saha = uye("U4", "Deneme Saha", "saha");
            var liste = new List<Kullanici> { yon, kon, ona, saha };
            var bos = new SortedDictionary<int, int>();
            var kontrolOnayi = new SortedDictionary<int, int> { { 1, HakedisOnayi.Kontrol } };
            var hakedisOnayi = new SortedDictionary<int, int> { { 1, HakedisOnayi.Kontrol | HakedisOnayi.Hakedis } };
            var gisOnayi = new SortedDictionary<int, int> { { 1, 7 } };
            Esit(null, Yetki.OnayDegisikligi(new List<Kullanici>(), null, bos, gisOnayi), "onay kapalı: oturumsuz her aşama serbest (eski davranış)");
            Esit(true, Yetki.OnayDegisikligi(liste, null, bos, kontrolOnayi) != null, "onay açık: oturumsuz onay verilemez");
            Esit(null, Yetki.OnayDegisikligi(liste, kon, bos, kontrolOnayi), "kontrol mühendisi Kontrol onayı verir");
            Esit(true, Yetki.OnayDegisikligi(liste, kon, kontrolOnayi, hakedisOnayi) != null, "kontrol mühendisi Hakediş onayı veremez");
            Esit(null, Yetki.OnayDegisikligi(liste, ona, kontrolOnayi, gisOnayi), "onay yetkilisi Hakediş ve GIS onayı verir");
            Esit(true, Yetki.OnayDegisikligi(liste, ona, bos, hakedisOnayi) != null, "onay yetkilisi Kontrol aşamasını atlayamaz (sıra kuralı Kontrol'ü de işaretler)");
            Esit(true, Yetki.OnayDegisikligi(liste, saha, bos, kontrolOnayi) != null, "saha operatörü onay veremez");
            Esit(true, Yetki.OnayDegisikligi(liste, kon, hakedisOnayi, bos) != null, "kontrol mühendisi Hakediş onayını kaldıramaz");
            Esit(null, Yetki.OnayDegisikligi(liste, yon, bos, gisOnayi), "yönetici her aşamayı verir");
            Esit(null, Yetki.OnayDegisikligi(liste, saha, gisOnayi, gisOnayi), "değişiklik yoksa yetki sorulmaz");
            Esit(true, Yetki.Islem(liste, kon, Roller.HakedisYetkisi) != null && Yetki.Islem(liste, yon, Roller.HakedisYetkisi) == null, "hakediş yetkisini yalnız yönetici belirler");
            Esit(true, Yetki.SifreDogru(kon, "1234") && !Yetki.SifreDogru(kon, "1235"), "şifre denetimi");
            yon.Etkin = false;
            Esit(false, Yetki.OnayAcik(liste), "etkin yönetici kalmayınca onay mekanizması kapalı");
            yon.Etkin = true;

            // Hakediş yetkisi: yazmaya kapalı hakediş kilit sözlüğünde Hakediş biti gibi; onay kaydına yazılmaz
            var onaylar = new SortedDictionary<int, int> { { 1, 4 } };
            var kilit = HakedisOnayi.KilitSozlugu(onaylar, new[] { 2, 0, -3 });
            Esit(true, HakedisOnayi.Kilitli(kilit, 2) && !HakedisOnayi.Kilitli(kilit, 1) && !HakedisOnayi.Kilitli(kilit, 3), "kapalı hakediş kilitli, öteki açık");
            Esit(6, kilit[2] | HakedisOnayi.Kontrol, "kilit sözlüğü: kapalı hakedişe Hakediş biti");
            Esit(1, onaylar.Count, "kilit sözlüğü onayları değiştirmez");
            var h = new Hat { Id = "HY1", Tur = "AG_HAVAI", Hakedis = 1 };
            h.Kalemler.Add(new Kalem { Cins = "ALPEK_KABLOLAR", Tanim = "3X50/16+70 ALPEK", Kaynak = "HAT", Hakedis = 2 });
            Esit(true, Iletkenler.DegistirmeKilidi(h, kilit, 1) != null, "Hat Değiştir: yazmaya kapalı hakedişteki satır da korunur");

            // Proje dosyası: kullanıcılar ve onay ayarı yazılır, okunur (telefonla aynı alanlar)
            var pr = new Proje { Ad = "Deneme" };
            pr.Kullanicilar.AddRange(liste);
            pr.OnayAyari = new OnayAyari { Kilit = false, KapaliHakedisler = new SortedSet<int> { 3, 1 }, Guncelleme = "2026-11-02T08:00:00.000Z" };
            var metin = ProjeDosyasi.Yaz(pr, "deneme");
            Esit(false, metin.Contains("\"1234\""), "dosyada şifre düz yazıyla yok");
            var geri = ProjeDosyasi.Oku(metin);
            Esit(Yetki.ListeJson(liste), Yetki.ListeJson(geri.Kullanicilar), "dosya: kullanıcılar gidip gelir");
            Esit("[1,3]|False|True", "[" + string.Join(",", new List<int>(geri.OnayAyari.KapaliHakedisler).ConvertAll(n => n.ToString(CultureInfo.InvariantCulture)).ToArray()) + "]|" + geri.OnayAyari.Kilit + "|" + geri.OnayAyari.Siki, "dosya: onay ayarı gidip gelir");
            var pj = (Json.Oku(metin) as JsonNesne).Nesne("proje");
            var anahtar = new List<string>();
            foreach (var kv in pj) anahtar.Add(kv.Key);
            Esit(anahtar.IndexOf("kullanicilar") + 1, anahtar.IndexOf("onayAyari"), "dosya: onayAyari kullanicilar'ın ardından (telefonla aynı sıra)");
            var eskiDosya = ProjeDosyasi.Oku("{\"bicim\":\"sebeke-hakedis.proje\",\"surum\":1,\"proje\":{\"ad\":\"Eski\"}}");
            Esit(true, eskiDosya.Kullanicilar.Count == 0 && eskiDosya.OnayAyari == null, "eski dosya: kullanıcı yok, onay ayarı yok (kısıtsız)");

            // Kullanıcılar penceresinin kuralları (telefondaki addMember / updateMember / closeApproval / setClosedHakedis)
            int saat = 0;
            var dz = new KullaniciDuzeni(null, null, null) { Saat = () => "2026-11-02T08:00:" + (10 + saat++).ToString(CultureInfo.InvariantCulture) + ".000Z" };
            Kullanici y1;
            Esit(true, dz.KapaliYap(1, true) != null, "pencere: onay kapalıyken hakediş yetkisi verilemez");
            Esit("İlk kullanıcı Yönetici olmalı.", dz.Ekle("Deneme Kontrol", "kontrol", "1234", out y1), "pencere: ilk kullanıcı Yönetici olmalı");
            Esit(true, dz.Ekle("Deneme Yönetici", "yonetici", "12", out y1) != null, "pencere: kısa şifre reddedilir");
            Esit(null, dz.Ekle("Deneme Yönetici", "yonetici", "4321", out y1), "pencere: ilk Yönetici tanımlanır");
            Esit(true, dz.OnayAcik && dz.Uye == y1 && dz.IlkYonetici == y1.Id, "pencere: ilk Yönetici oturuma alınır");
            Esit(true, Yetki.SifreDogru(y1, "4321") && y1.Tuz.Length == 26, "pencere: şifre özetle saklanır, tuz rastgele");
            Kullanici k1, s1;
            Esit(null, dz.Ekle("Deneme Kontrol", "kontrol", "1111", out k1), "pencere: Yönetici kullanıcı ekler");
            Esit("Bu adla kullanıcı var.", dz.Ekle("deneme kontrol", "saha", "2222", out s1), "pencere: aynı ad (büyük / küçük harf) eklenmez");
            Esit(null, dz.Ekle("Deneme Saha", "saha", "2222", out s1), "pencere: saha kullanıcısı");
            Esit(null, dz.KapaliYap(2, true), "pencere: Yönetici 2. hakedişi yazmaya kapatır");
            Esit("2", string.Join(",", new List<int>(dz.Kapali).ConvertAll(n => n.ToString(CultureInfo.InvariantCulture)).ToArray()), "pencere: kapalı hakediş listesi");
            Esit(true, dz.Guncelle(y1.Id, null, "saha", null, null) != null, "pencere: son Yönetici rolünü bırakamaz");
            dz.Uye = dz.Liste.Find(x => x.Id == k1.Id);
            Kullanici o1;
            Esit(true, dz.Ekle("Deneme Onay", "onay", "3333", out o1) != null && o1 == null, "pencere: Yönetici olmayan kullanıcı ekleyemez");
            Esit(true, dz.KapaliYap(3, true) != null, "pencere: Yönetici olmayan hakediş yetkisi veremez");
            Esit(true, dz.Guncelle(y1.Id, null, null, "9999", null) != null, "pencere: başkasının şifresini değiştiremez");
            string onceGun = dz.Uye.Guncelleme;
            Esit(null, dz.Guncelle(k1.Id, null, null, "5555", null), "pencere: kendi şifresini değiştirir");
            Esit(true, Yetki.SifreDogru(dz.Uye, "5555") && string.CompareOrdinal(dz.Uye.Guncelleme, onceGun) > 0, "pencere: yeni şifre geçerli, güncelleme zamanı ilerler");
            dz.Uye = dz.Liste.Find(x => x.Id == y1.Id);
            Esit(null, dz.Guncelle(s1.Id, null, null, null, false), "pencere: Yönetici kullanıcıyı pasif yapar");
            Esit(null, dz.MekanizmayiKapat(), "pencere: onay mekanizmasını kapatır");
            Esit(true, !dz.OnayAcik && dz.Uye == null && dz.Liste.TrueForAll(x => !x.Etkin), "pencere: herkes pasif, oturum kapalı, liste saklanır");
        }

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

            // Simge ve yazı boyutları (proje.boyutlar): varsayılansa yazılmaz; telefonla aynı alan adları (uyum.test.mjs U3)
            Esit(false, yazilan.Contains("\"boyutlar\""), "varsayılan boyutlar dosyaya yazılmaz");
            kopya.Boyutlar = new Boyutlar { SimgeOlcegi = 1.5, EtiketYuksekligi = 2, MetrajYuksekligi = 1.6, ElemanYaziYuksekligi = 2.2 };
            string boyutlu = ProjeDosyasi.Yaz(kopya, "test");
            var bg = ProjeDosyasi.Oku(boyutlu).Boyutlar;
            Esit(true, bg != null && bg.Ayni(kopya.Boyutlar), "boyutlar dosyadan okunur (" + bg + ")");
            Esit(true, ProjeDosyasi.Oku(ProjeDosyasi.VoltYaz(kopya, "test")).Boyutlar.Ayni(kopya.Boyutlar), "boyutlar telefon dosyasında da");
            var bozuk = ProjeDosyasi.Oku("{\"bicim\":\"sebeke-hakedis.proje\",\"surum\":1,\"proje\":{\"ad\":\"D\",\"boyutlar\":{\"simgeOlcegi\":99,\"etiketYuksekligi\":2.5}}}").Boyutlar;
            Esit("1 2,5 1,44 1,8", bozuk.SimgeOlcegi.ToString(CultureInfo.GetCultureInfo("tr-TR")) + " " + bozuk.EtiketYuksekligi.ToString(CultureInfo.GetCultureInfo("tr-TR")) + " " +
                 bozuk.MetrajYuksekligi.ToString(CultureInfo.GetCultureInfo("tr-TR")) + " " + bozuk.ElemanYaziYuksekligi.ToString(CultureInfo.GetCultureInfo("tr-TR")),
                 "aralık dışı boyut varsayılana döner, eksik alan varsayılan");
            var ayar = new CizimAyarlari();
            Esit(false, ayar.BoyutlarDegisik, "yeni çizimde boyutlar varsayılan");
            ayar.BoyutlariKoy(kopya.Boyutlar);
            Esit(true, ayar.BoyutlarDegisik && ayar.BoyutlariVer().Ayni(kopya.Boyutlar), "ayarlara alınan boyutlar");
            var ayar2 = CizimAyarlari.Ciftlerden(ayar.Ciftler());
            Esit(true, ayar2.BoyutlariVer().Ayni(kopya.Boyutlar), "boyutlar çizimin ayarlarında saklanır");
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
            string katalogMetni = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "kalemler.json"), Encoding.UTF8);
            var k = Katalog.Oku(katalogMetni, null);
            Esit(true, k.Kalemler.Count > 2500, "katalog okundu (tam liste)");

            // Cins kodlarındaki yazım hataları (31.10.2026): katalogda yalnız yeni kodlar; eski kod okunurken çevrilir
            var eskiCinsler = ((JsonNesne)Json.Oku(katalogMetni)).Nesne("eskiCinsler");
            int eslesen = 0;
            foreach (var kv in eskiCinsler)
            {
                if (kv.Key == "aciklama") continue;
                Esit(Convert.ToString(kv.Value, CultureInfo.InvariantCulture), CinsKodu.Duzelt(kv.Key), "cins kodu: " + kv.Key + " katalogdaki gibi çevrilir");
                eslesen++;
            }
            Esit(CinsKodu.Eski.Count, eslesen, "cins kodu: eklentinin tablosu katalogdaki eskiCinsler ile aynı");
            Esit(0, k.Kalemler.FindAll(x => CinsKodu.Eski.ContainsKey(x.Cins)).Count, "katalogda eski (yazım hatalı) cins kodu yok");
            Esit(0, k.Cinsler.FindAll(x => x.Ad.Contains("̇") || x.Ad != x.Ad.Trim()).Count, "cins adlarında bozuk harf yok (i̇)");
            Esit("Bakır bara", k.CinsAdi("BAKIR_BARA"), "cins adı Türkçe yazımla");
            Esit("Rekortman (alüminyum)", k.CinsAdi("REKORTMAN_ALİMİNYUM"), "cins adı: eski kodla da bulunur");
            Esit(true, k.Bul("AG_ALİMİNYUM_KABLO", "3x95+50 Nyy Alm.") != null && k.Bul("AG_ALİMİNYUM_KABLO", "3x95+50 Nyy Alm.").Cins == "AG_ALÜMİNYUM_KABLO",
                 "katalog: eski kodla aranan kalem yeni koduyla gelir");
            Esit("AG_ALÜMİNYUM_KABLO", NesneOkuyucu.HatKalemiOku("AG_ALİMİNYUM_KABLO;;3x95+50 Nyy Alm.;M;0;10;mt/mt;1;10;0,00;1;0105;7001;").Cins,
                 "çizimdeki eski kodlu hat kalemi yeni kodla okunur");
            Esit("KOFRE", NesneOkuyucu.MalzemeOku("KOFRA;KOFRE TIP-1;M+M;0;1;ad/ad;1;1;0,00;1;0113;7002;").Cins, "çizimdeki KOFRA malzemesi KOFRE okunur");
            Esit("KOFRE", NesneOkuyucu.ElemanTuru("KOFRE") + "|" + NesneOkuyucu.ElemanTuru("KOFRA") == "KOFRE|KOFRE" ? "KOFRE" : "?", "eleman türü: eski ve yeni kofre kodu");
            Esit("AG_YERALTI", NesneOkuyucu.HatTuru("", "AG_ALÜMİNYUM_KABLO"), "hat türü: yeni alüminyum kablo kodu");
            var eskiDosya = ProjeDosyasi.Oku("{\"bicim\":\"sebeke-hakedis.proje\",\"surum\":1,\"proje\":{\"ad\":\"D\"},\"elemanlar\":[{\"id\":\"E1\",\"tur\":\"KOFRE\",\"cins\":\"KOFRA\",\"tip\":\"KOFRE TIP-1\",\"kalemler\":[{\"cins\":\"KOFRA\",\"tanim\":\"KOFRE TIP-1\",\"ana\":true}]}]," +
                                             "\"hatlar\":[{\"id\":\"H1\",\"tur\":\"AG_YERALTI\",\"kalemler\":[{\"cins\":\"AG_ALİMİNYUM_KABLO\",\"tanim\":\"3x95+50 Nyy Alm.\",\"kaynak\":\"HAT\"}]}]}");
            Esit("KOFRE|KOFRE|AG_ALÜMİNYUM_KABLO", eskiDosya.Elemanlar[0].Cins + "|" + eskiDosya.Elemanlar[0].Kalemler[0].Cins + "|" + eskiDosya.Hatlar[0].Kalemler[0].Cins,
                 "eski proje dosyasındaki kodlar yeni kodla okunur");
            int sira = 7000;
            Func<string> yeniSira = () => (++sira).ToString(CultureInfo.InvariantCulture);

            var arm = k.Bul("ARMATÜR", "70W Sodyum Arm.");
            Esit(true, arm != null, "katalog: armatür kalemi");

            // Hat Değiştir (SH_HATDEGISTIR): çizilmiş hattın iletkeni değişir, diğer malzemeler ve metraj korunur
            var alpek50 = k.HatKesitleri("AG_HAVAI").Find(x => x.Tanim.Contains("50/16+70") && x.Tanim.ToUpperInvariant().Contains("ALPEK"));
            var alpek70 = k.HatKesitleri("AG_HAVAI").Find(x => x.Tanim.Contains("70/16+95") && x.Tanim.ToUpperInvariant().Contains("ALPEK"));
            var nyy = k.Bul("AG_ALÜMİNYUM_KABLO", "3x95+50 Nyy Alm.");
            Esit(true, alpek50 != null && alpek70 != null && nyy != null, "katalog: ALPEK 3x50, 3x70 ve NYY kabloları");
            var dh = new Hat { Id = "HD1", Tur = "AG_HAVAI", Durum = "M", Hakedis = 1, Katman = "SC_1.HAK.AG_HAT", CizimUzunlugu = 40 };
            dh.Kose.Add(new[] { 0.0, 0.0 }); dh.Kose.Add(new[] { 40.0, 0.0 });
            dh.Kalemler.Add(Katalog.KalemYap(arm, 2, "M", 1, false, "MALZEME", "6990"));
            dh.Kalemler.AddRange(Iletkenler.Kalemler(new[] { new HatIletkeni(alpek50) }, 42, "M", 1, () => "6991", "", false));
            dh.Kalemler.Add(Katalog.KalemYap(arm, 1, "M", 1, false, "MALZEME", "6992"));
            dh.Kalemler[1].Miktar = 45; // elle düzeltilmiş metraj
            dh.AnaKesit = alpek50.Tanim;
            double dm = Iletkenler.Degistir(dh, "AG_HAVAI", new[] { new HatIletkeni(alpek70) }, "M", 1, t => 99, yeniSira, "", false);
            Esit(45.0, dm, "hat değiştir: aynı türde metraj korunur");
            Esit(3, dh.Kalemler.Count, "hat değiştir: satır sayısı aynı, diğer malzemelere dokunulmaz");
            Esit(alpek70.Tanim + "|HAT|6991|45", dh.Kalemler[1].Tanim + "|" + dh.Kalemler[1].Kaynak + "|" + dh.Kalemler[1].Sira + "|" + dh.Kalemler[1].Miktar,
                 "hat değiştir: yeni iletken eski satırın yerinde, sıra numarası korunur");
            Esit(alpek70.Tanim, dh.AnaKesit, "hat değiştir: ana kesit");
            Esit("SC_1.HAK.AG_HAT", dh.Katman, "hat değiştir: tür aynıysa katman korunur");
            Esit(true, NesneYazici.HatEtiketi(dh).Contains("70/16+95"), "hat değiştir: kablo tipi yazısı yeni iletkenle (" + NesneYazici.HatEtiketi(dh) + ")");
            dm = Iletkenler.Degistir(dh, "AG_YERALTI", new[] { new HatIletkeni(nyy, 2) }, "DM+M", 2, t => t == "AG_YERALTI" ? 43 : 0, yeniSira, "", false);
            Esit("43|86|2x(3x95+50 Nyy Alm.)|DM+M|2", dm + "|" + dh.Kalemler[1].Miktar + "|" + dh.Kalemler[1].Aciklama + "|" + dh.Kalemler[1].Durum + "|" + dh.Kalemler[1].Hakedis,
                 "hat değiştir: tür değişince yeni türün metrajı; adet × metraj, durum, hakediş");
            Esit("|AG_YERALTI|DM+M|2", dh.Katman + "|" + dh.Tur + "|" + dh.Durum + "|" + dh.Hakedis, "hat değiştir: tür değişince katman yeniden belirlenir");
            Esit(true, NesneYazici.Hat(dh, "SC", null).Katman.Contains("1.HAK") == false, "hat değiştir: yeni katman yeni hakedişte (" + NesneYazici.Hat(dh, "SC", null).Katman + ")");
            dm = Iletkenler.Degistir(dh, "AG_YERALTI", new[] { new HatIletkeni(alpek50), new HatIletkeni(nyy) }, "M", 2, null, yeniSira, "", false);
            Esit("4|HAT|HAT|MALZEME", dh.Kalemler.Count + "|" + dh.Kalemler[1].Kaynak + "|" + dh.Kalemler[2].Kaynak + "|" + dh.Kalemler[3].Kaynak,
                 "hat değiştir: iki iletken iki satır (eski sıra, sonra yeni sıra numarası)");
            Esit(true, dh.Kalemler[2].Sira == "7001" || dh.Kalemler[2].Sira == "7002", "hat değiştir: fazla satıra yeni sıra numarası (" + dh.Kalemler[2].Sira + ")");

            // Hata 5 · Hat Değiştir onaylı satırı silemez: hattın 1. dönem satırı açık, 2. dönem satırı onaylı → komut izin
            // vermez; model hiç değişmez. Yalnız hattın ana hakedişine bakmak yetmez, her HAT satırının hakedişi denetlenir.
            {
                var kh = new Hat { Id = "HK1", Tur = "AG_HAVAI", Durum = "M", Hakedis = 1, Katman = "SC_1.HAK.AG_HAT", CizimUzunlugu = 40 };
                kh.Kose.Add(new[] { 0.0, 0.0 }); kh.Kose.Add(new[] { 40.0, 0.0 });
                kh.Kalemler.AddRange(Iletkenler.Kalemler(new[] { new HatIletkeni(alpek50) }, 42, "M", 1, () => "8001", "", false));   // 1. dönem (açık)
                kh.Kalemler.AddRange(Iletkenler.Kalemler(new[] { new HatIletkeni(alpek70) }, 42, "M", 2, () => "8002", "", false));   // 2. dönem (onaylı)
                kh.Kalemler.Add(Katalog.KalemYap(arm, 1, "M", 1, false, "MALZEME", "8003"));
                kh.AnaKesit = Iletkenler.AnaKesit(new[] { new HatIletkeni(alpek50), new HatIletkeni(alpek70) });
                var onaylar = new SortedDictionary<int, int> { { 2, HakedisOnayi.Kontrol | HakedisOnayi.Hakedis } };   // 2. hakediş onaylı (kilitli)
                Esit(false, HakedisOnayi.Kilitli(onaylar, kh.Hakedis), "hat değiştir kilidi: hattın ana hakedişi (1) açık");
                Esit(true, Iletkenler.DegistirmeKilidi(kh, onaylar, 1) != null, "hat değiştir kilidi: onaylı 2. dönem satırı varken hat değiştirilemez");
                Esit(null, Iletkenler.DegistirmeKilidi(kh, new SortedDictionary<int, int>(), 1), "hat değiştir kilidi: onay yoksa serbest");
                var sh = new Hat { Id = "HS1", Tur = "AG_HAVAI", Durum = "M", Hakedis = 1, CizimUzunlugu = 40 };
                sh.Kalemler.AddRange(Iletkenler.Kalemler(new[] { new HatIletkeni(alpek50) }, 42, "M", 1, () => "8101", "", false));
                Esit(null, Iletkenler.DegistirmeKilidi(sh, onaylar, 1), "hat değiştir kilidi: onaylı satırı olmayan hat serbest");
                Esit(true, Iletkenler.DegistirmeKilidi(sh, onaylar, 2) != null, "hat değiştir kilidi: yeni satırlar onaylı hakedişe yazılamaz");
                Esit(true, Iletkenler.DegistirmeKilidi(dh, onaylar, 1) != null, "hat değiştir kilidi: ana hakedişi onaylı hat (eski denetim) yine kilitli");
                Func<Hat, string> imza = x => x.Tur + "|" + x.AnaKesit + "|" + x.Durum + "|" + x.Hakedis + "|" + x.Katman + "|" +
                                              string.Join(";", x.Kalemler.ConvertAll(k => k.Cins + "/" + k.Tanim + "/" + k.Kaynak + "/" + k.Sira + "/" + k.Miktar + "/" + k.Hakedis + "/" + k.Durum).ToArray());
                string once = imza(kh);
                bool firlatti = false;
                try { Iletkenler.Degistir(kh, "AG_HAVAI", new[] { new HatIletkeni(nyy) }, "M", 1, t => 99, yeniSira, "", false, onaylar); }
                catch (InvalidOperationException) { firlatti = true; }
                Esit(true, firlatti, "hat değiştir: kilitli satırda işlem reddedilir");
                Esit(once, imza(kh), "hat değiştir: reddedilince model kısmen değişmiş kalmaz (satırlar, tür, ana kesit aynı)");
                Esit("8001|8002|8003", kh.Kalemler[0].Sira + "|" + kh.Kalemler[1].Sira + "|" + kh.Kalemler[2].Sira, "hat değiştir: onaylı 2. dönem satırı yerinde");
                // Onay kaldırılınca aynı işlem yapılır
                double km = Iletkenler.Degistir(kh, "AG_HAVAI", new[] { new HatIletkeni(nyy) }, "M", 1, t => 99, yeniSira, "", false, new SortedDictionary<int, int>());
                Esit("42|2|" + nyy.Tanim, km + "|" + kh.Kalemler.Count + "|" + kh.Kalemler[0].Tanim, "hat değiştir: onay yokken satırlar değişir");
            }

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
            Esit("SC_2.HAK.AGDIR", yeniAdim.Varlik.Katman, "yeni direk hakediş katmanında");
            var dmAdim = plan.Adimlar.Find(x => x.Hedef == dm.Id);
            Esit("SC_DEMONTAJ", dmAdim.Varlik.Katman, "demontaja çevrilen direk demontaj katmanına geçer");
            Esit(dm.Blok, dmAdim.Varlik.Blok, "adsız bloklu direğin bloğu korunur");
            var hatAdim = plan.Adimlar.Find(x => x.Hedef == hat.Id);
            Esit(true, hatAdim != null && hatAdim.Varlik.ParcaMetraji, "metrajı değişen hat güncellenir (metraj yazıları yeniden yazılır)");
            Esit(true, hatAdim.Etiket != null && !hatAdim.Etiket.Contains("m/") && !hatAdim.Etiket.Contains("("), "hat etiketinde metraj ve tanıtıcı yok");

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
            // Etiketteki malzeme adı görünen yazımla (MalzemeYazimi): "^ 3X50" → "^ 3x50"
            if (h0 != null) Esit(h0.Etiket != "" ? geri.Hatlar.Find(x => x.Id == h0.Id).Etiket.StartsWith(MalzemeYazimi.Duzelt(h0.Etiket.Split('/')[0]), StringComparison.Ordinal) : true, true, "hat etiketi okunur");
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
