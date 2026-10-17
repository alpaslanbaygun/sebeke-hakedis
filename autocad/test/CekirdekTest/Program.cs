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
    ///   dogrula dokum.json ref.tsv cikti/ : gerçek bir PROMAGIS çizimi ve PROMAGIS raporuyla satır satır karşılaştırma
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
            Esit("SH_TRAFO_BINA_MEVCUT", Semboller.BlokAdi("TRAFO_MERKEZI", "TRAFO_BİNASI", "KM"), "simge: trafo binası (KM → mevcut)");
            Esit("SH_SDK_YENI", Semboller.BlokAdi("BOX", "BOX_PANO", "M"), "simge: box → SDK");
            Esit("SH_PANO_YENI", Semboller.BlokAdi("PANO", "AG_PANO_HT", "M+M"), "simge: pano");
            Esit("SH_MUFU_MEVCUT", Semboller.BlokAdi("EK_MUFU", "EK_MUFU_AG_ALM", "MEVCUT"), "simge: ek mufu");
            Esit("SH_KOFRE_YENI", Semboller.BlokAdi("KOFRE", "KOFRA", "M"), "simge: kofre");
            Esit("SH_DIGER_DM", Semboller.BlokAdi("DIGER", "", "DM"), "simge: diğer");
            Esit(true, Semboller.EklentininBlogu("SH_DIREK_AG_YENI"), "simge: SH_ bloğu eklentinin");
            Esit(false, Semboller.EklentininBlogu("YENİ_AG_DİR"), "simge: PROMAGIS bloğu eklentinin değil");
            int eksik = 0, bos = 0;
            foreach (var aile in Semboller.Aileler())
                foreach (var v in new[] { "YENI", "MEVCUT", "DMM", "DM" })
                {
                    var s = Semboller.Bul("SH_" + aile + "_" + v);
                    if (s == null) { eksik++; Console.WriteLine("    eksik sembol: " + aile + "_" + v); }
                    else if (s.Ilkeller.Count == 0) bos++;
                }
            Esit(0, eksik, "simge: her aile için 4 varyant var");
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
            var p = PromagisOkuyucu.Oku(varliklar, "ornek.dwg");
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

            // Yazıcı: PROMAGIS çiziminden okunan proje yeniden çizim nesnesine yazılıp okununca aynı rapor
            GidisDonus(p, "ornek-dokum");
            // Telefonun yazdığı proje dosyası okunur ve çizime yazılabilir
            string telYol = Path.Combine(AppContext.BaseDirectory, "telefon-proje.sebeke.json");
            var tp = ProjeDosyasi.Oku(File.ReadAllText(telYol, Encoding.UTF8));
            Esit(true, tp.Elemanlar.Count > 20, "telefon projesi okundu");
            GidisDonus(tp, "telefon-proje");
            Esit("SC_1.HAK.AGDİR", PromagisYazici.ElemanKatmani("SC", "AG_DIREK", "M", 1), "katman: hakediş");
            Esit("SC_DEMONTAJ", PromagisYazici.ElemanKatmani("SC", "AG_DIREK", "DM", 3), "katman: demontaj");
            Esit("SC_STANDART", PromagisYazici.ElemanKatmani("SC", "KOFRE", "M+M", 2), "katman: kofre");
            Esit("SC_2.HAK.OG_YER_XLPE", PromagisYazici.HatKatmani("SC", "OG_YERALTI", "DM+M", 2), "katman: OG yeraltı");
            Esit("16,8", PromagisYazici.Sayi(16.8), "Türkçe ondalık yazımı");
            Esit("0,00", PromagisYazici.Fiyat(0), "fiyat yazımı");

            CizimAraclari();
            TelefondanAlma(varliklar, tp);
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

            // Blok seçimi: durumu değişen eleman o durumun bloğunu alır
            var cizimEl = new List<Eleman>
            {
                new Eleman { Id = "1", Tur = "AG_DIREK", Durum = "M", Blok = "YENİ_AG_DİR" },
                new Eleman { Id = "2", Tur = "AG_DIREK", Durum = "DM", Blok = "DEMONTAJ_AG_DİR" },
                new Eleman { Id = "3", Tur = "AG_DIREK", Durum = "M+M", Blok = "YENİ_AG_DİR" },
            };
            Esit("DEMONTAJ_AG_DİR", PromagisYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Durum = "DM", Blok = "YENİ_AG_DİR" }), "blok: demontaja çevrilen direk");
            Esit("YENİ_AG_DİR", PromagisYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Durum = "M", Blok = "YENİ_AG_DİR" }), "blok: durumu aynı direk bloğunu korur");
            Esit("YENİ_AG_DİR", PromagisYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Durum = "M" }), "blok: yeni direk çizimdeki bloğu kullanır");
            Esit("SH_TRAFO_DIREK_YENI", PromagisYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "TRAFO_DIREGI", Durum = "M" }), "blok: çizimde örneği yoksa eklentinin lejant simgesi");
            Esit("*U5", PromagisYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Durum = "DM", Blok = "*U5" }), "blok: adsız blok korunur");
            Esit("YENİ_AG_DİR", PromagisYazici.BlokSec(cizimEl, new Eleman { Id = "9", Tur = "AG_DIREK", Cins = "AG_BETON", Durum = "M", Blok = "SH_DIREK_AG_YENI" }), "blok: eklenti bloğu yerine çizimdeki PROMAGIS bloğu");
            Esit("SH_KAFES_AG_DMM", PromagisYazici.BlokSec(new List<Eleman>(), new Eleman { Id = "9", Tur = "AG_DIREK", Cins = "AG_DEMİR_GLV", Durum = "DM+M", Blok = "SH_KAFES_AG_YENI" }), "blok: eklenti bloğu duruma göre yeniden seçilir");
            Semboller_();
            var olcekler = new List<CadVarlik>
            {
                new CadVarlik { Tur = "INSERT", Blok = "A", Olcek = 4, Xd = { { "NIT", new List<string> { "" } } } },
                new CadVarlik { Tur = "INSERT", Blok = "A", Olcek = 4, Xd = { { "NIT", new List<string> { "" } } } },
                new CadVarlik { Tur = "INSERT", Blok = "B", Olcek = 2, Xd = { { "NIT", new List<string> { "" } } } },
            };
            Esit(2.0, PromagisYazici.OlcekOner(olcekler, "B", 1), "ölçek: aynı bloğun ölçeği");
            Esit(4.0, PromagisYazici.OlcekOner(olcekler, "C", 1), "ölçek: yoksa en çok kullanılan");
            Esit(4.0, PromagisYazici.OlcekOner(new List<CadVarlik>(), "C", 4), "ölçek: boş çizimde varsayılan");

            short renk; string cizgi;
            PromagisYazici.KatmanStili("SC_2.HAK.AG_YER_HAT", out renk, out cizgi);
            Esit((short)3, renk, "katman rengi AG yeraltı");
            Esit("HIDDENX2", cizgi, "katman çizgi tipi AG yeraltı");
            PromagisYazici.KatmanStili("SC_DEMONTAJ", out renk, out cizgi);
            Esit((short)9, renk, "katman rengi demontaj");

            double ex, ey, eaci;
            Geometri.EtiketKonumu(new List<double[]> { new[] { 10.0, 0 }, new[] { 0.0, 0 } }, out ex, out ey, out eaci);
            Esit(5.0, ex, "etiket ortada");
            Esit(0.0, eaci, "etiket ters yazılmaz (sağdan sola çizgi)");
            Geometri.EtiketKonumu(new List<double[]> { new[] { 0.0, 10 }, new[] { 0.0, 0 } }, out ex, out ey, out eaci);
            Esit(Math.PI / 2, eaci, "dikey çizgide etiket aşağıdan yukarı okunur");

            // Katalog (eklentiye gömülen dosya)
            string katalogYolu = Path.Combine(AppContext.BaseDirectory, "kalemler.json");
            var k = Katalog.Oku(File.ReadAllText(katalogYolu, Encoding.UTF8), null);
            Esit(true, k.Kalemler.Count > 100, "katalog okundu");
            var direkler = k.AnaTipler("AG_DIREK");
            Esit(true, direkler.Count > 3 && direkler.TrueForAll(x => x.Rol == "ana"), "katalog: AG direk tipleri");
            var kesitler = k.HatKesitleri("AG_HAVAI");
            Esit(true, kesitler.Count > 0 && kesitler[0].Nesneler.Contains("HAT_AG_HAVAI"), "katalog: AG havai kesitleri önce");
            Esit(true, k.SondajTipleri().Count > 0, "katalog: sondaj tipleri");
            var mz = k.Malzemeler("AG_DIREK");
            Esit(true, mz.Count > 10 && mz[0].Nesneler.Contains("AG_DIREK"), "katalog: direkte kullanılan malzemeler önce");
            var kl = Katalog.KalemYap(direkler[0], 1, "M", 2, true, "NIT", "5001");
            Esit(SayiCoz.Temiz(direkler[0].Katsayi), kl.Toplam, "katalog kaleminden poz: toplam = miktar × katsayı");

            // Nokta dosyaları
            var uy = new List<string>();
            var n1 = NoktaDosyasi.Oku("\uFEFFAd;Y (Saga);X (Yukari);Kot;Kod;Tur;Durum;Hakedis\nSC1;519449,123;4282393,5;1067,25;K1;AG_DIREK;M;3\n", 1, uy);
            Esit(1, n1.Count, "nokta: telefon CSV");
            Esit(519449.123, n1[0].Saga, "nokta: Y = sağa");
            Esit(4282393.5, n1[0].Yukari, "nokta: X = yukarı");
            Esit(1067.25, n1[0].Kot, "nokta: kot");
            Esit("K1", n1[0].Kod, "nokta: kod");
            Esit(3, n1[0].Hakedis, "nokta: hakediş sütunu");
            var n2 = NoktaDosyasi.Oku("P1 4282393.5 519449.1 1100.5 AD2\nP2 4282400 519450 1101\n", 2, uy);
            Esit(2, n2.Count, "nokta: boşlukla ayrılmış");
            Esit(519449.1, n2[0].Saga, "nokta: yer değiştirmiş Y/X düzeltilir");
            Esit("AD2", n2[0].Kod, "nokta: beşinci sütun kod");
            Esit(2, n2[1].Hakedis, "nokta: varsayılan hakediş");
            var n3 = NoktaDosyasi.Oku("N5,519449.10,4282393.50,KÖŞE\n", 1, uy);
            Esit("KÖŞE", n3.Count == 1 ? n3[0].Kod : "", "nokta: dördüncü sütun sayı değilse kod");
            Esit("ŞİĞ", NoktaDosyasi.MetinCoz(new byte[] { 0xDE, 0xDD, 0xD0 }), "nokta dosyası: Türkçe Windows kodlaması");
            Esit("ŞİĞ", NoktaDosyasi.MetinCoz(Encoding.UTF8.GetBytes("ŞİĞ")), "nokta dosyası: UTF-8");
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
                    PromagisYazici.TaniticiYaz(hedef, h);
                    cizim.Add(hedef);
                }
                else
                {
                    h = a.Hedef;
                    hedef = cizim.Find(x => string.Equals(x.H, h, StringComparison.OrdinalIgnoreCase));
                    PromagisYazici.TaniticiYaz(v, h);
                    string eskiKimlik = hedef.XdIlk(PromagisYazici.KimlikUygulamasi);
                    var etk = hedef.XdIlk("ETK");
                    hedef.Tur = v.Tur; hedef.Katman = v.Katman; hedef.Blok = v.Blok;
                    hedef.X = v.X; hedef.Y = v.Y; hedef.Z = v.Z; hedef.Aci = v.Aci; hedef.Kapali = v.Kapali;
                    hedef.Kose = v.Kose; hedef.Oz = v.Oz; hedef.Xd = v.Xd;
                    if (!hedef.Xd.ContainsKey(PromagisYazici.KimlikUygulamasi) && eskiKimlik != null) hedef.Xd[PromagisYazici.KimlikUygulamasi] = new List<string> { eskiKimlik };
                    if (etk != null) hedef.Xd["ETK"] = new List<string> { etk };
                }
                if (a.Etiket != null)
                {
                    string metin = a.Etiket.Replace(PromagisYazici.Tanitici, h);
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
            var p = PromagisOkuyucu.Oku(cizim, "ornek.dwg");
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
            Esit("Tk1", yeniAdim.Varlik.XdIlk(PromagisYazici.KimlikUygulamasi), "yeni nesneye telefon kimliği yazılır");
            Esit("SC_2.HAK.AGDİR", yeniAdim.Varlik.Katman, "yeni direk hakediş katmanında");
            var dmAdim = plan.Adimlar.Find(x => x.Hedef == dm.Id);
            Esit("SC_DEMONTAJ", dmAdim.Varlik.Katman, "demontaja çevrilen direk demontaj katmanına geçer");
            Esit(dm.Blok, dmAdim.Varlik.Blok, "adsız bloklu direğin bloğu korunur");
            var hatAdim = plan.Adimlar.Find(x => x.Hedef == hat.Id);
            Esit(true, hatAdim.Etiket != null && hatAdim.Etiket.Contains("/" + Metraj.Yazi(hk.Miktar) + "m/"), "metrajı değişen hattın etiketi güncellenir");

            Uygula(cizim, plan, true);
            var sonra = PromagisOkuyucu.Oku(cizim, "ornek.dwg");
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

            // 4) Telefonda yeni açılmış proje boş çizime: hepsi yeni; ikinci kez: iş yok
            var bos = new List<CadVarlik>();
            plan = Aktarim.Planla(bos, telefonProjesi, "SC");
            int toplam = telefonProjesi.Bolgeler.Count + telefonProjesi.Noktalar.Count + telefonProjesi.Elemanlar.Count + telefonProjesi.Hatlar.Count + telefonProjesi.Kanallar.Count + telefonProjesi.Sondajlar.Count;
            Esit(toplam, plan.Sayi("yeni"), "boş çizime: hepsi yeni");
            Uygula(bos, plan, false);
            var bp = PromagisOkuyucu.Oku(bos, "bos.dwg");
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

        /// <summary>Projeyi PROMAGIS biçiminde çizim nesnelerine yazar, okuyucuyla geri okur; rapor aynı kalmalı.</summary>
        private static void GidisDonus(Proje p, string ad)
        {
            Console.WriteLine("Gidiş-dönüş: " + ad);
            var varliklar = PromagisYazici.Hepsi(p, id => id.StartsWith("T", StringComparison.Ordinal));
            foreach (var v in varliklar) PromagisYazici.TaniticiYaz(v, v.H);
            // Hat etiketleri (ETK): okuyucu etiketi tanıtıcıdan bulur
            int etk = 0;
            var etiketler = new List<CadVarlik>();
            foreach (var h in p.Hatlar)
            {
                var v = varliklar.Find(x => x.H == h.Id && x.Xd.ContainsKey("HAT"));
                var t = new CadVarlik { H = "E" + (++etk).ToString(CultureInfo.InvariantCulture), Tur = "TEXT", Katman = v.Katman, Metin = PromagisYazici.HatEtiketi(h).Replace(PromagisYazici.Tanitici, h.Id) };
                v.Xd["ETK"] = new List<string> { t.H };
                etiketler.Add(t);
            }
            varliklar.AddRange(etiketler);
            var geri = PromagisOkuyucu.Oku(varliklar, ad);
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
            var geri = PromagisOkuyucu.Oku(cizim, "bos.dwg");
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
            var p = PromagisOkuyucu.Oku(varliklar, "gercek-proje.dwg");
            Console.WriteLine($"Okuma: {sure.ElapsedMilliseconds} ms · bölge {p.Bolgeler.Count}, nokta {p.Noktalar.Count}, eleman {p.Elemanlar.Count}, hat {p.Hatlar.Count}, kanal {p.Kanallar.Count}, sondaj {p.Sondajlar.Count}, uyarı {p.Uyarilar.Count}");
            foreach (var u in p.Uyarilar) Console.WriteLine("  uyarı: " + u);

            string projeYolu = Path.Combine(ciktiKlasoru, "proje.sebeke.json");
            File.WriteAllText(projeYolu, ProjeDosyasi.Yaz(p, "test"), new UTF8Encoding(false));
            var p2 = ProjeDosyasi.Oku(File.ReadAllText(projeYolu, Encoding.UTF8));
            Esit(p.Elemanlar.Count, p2.Elemanlar.Count, "proje dosyası: eleman sayısı korunur");

            sure.Restart();
            var dt = new DurumTespit(p2);
            Console.WriteLine($"Rapor: {sure.ElapsedMilliseconds} ms · {dt.Satirlar.Count} satır");

            // PROMAGIS raporu
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
            Console.WriteLine("PROMAGIS raporu: " + refSatirlar.Count + " satır");

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
            Console.WriteLine($"Özet grupları: {grupAyni} aynı, {grupFarkli} farklı (PROMAGIS'te {refOzet.Count} grup)");

            // Toplam kg ve metre karşılaştırması
            double refKg = 0, bizKg = 0;
            foreach (var r in refSatirlar) if (r[ix["BİRİM"]].EndsWith("/kg", StringComparison.Ordinal)) refKg += Ondalik(r[ix["TOP. MİK."]]);
            foreach (var s in dt.Satirlar) if (s.Birim.EndsWith("/kg", StringComparison.Ordinal)) bizKg += s.Toplam;
            Console.WriteLine($"Toplam kg: PROMAGIS {refKg:N1} · bizim {bizKg:N1} · fark %{(bizKg - refKg) / refKg * 100:N3}");

            sure.Restart();
            string xlsx = Path.Combine(ciktiKlasoru, "durum-tespit.xlsx");
            RaporYazici.Yaz(p2, xlsx, "test");
            Console.WriteLine($"Excel: {xlsx} ({new FileInfo(xlsx).Length / 1024} KB, {sure.ElapsedMilliseconds} ms)");
            Esit(true, eslesen >= refSatirlar.Count * 0.999, "PROMAGIS satırlarının %99,9'u eşleşti");
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
