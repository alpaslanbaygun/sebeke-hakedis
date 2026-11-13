using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using SebekeHakedis.Cekirdek;
using SebekeHakedis.Eklenti;

namespace SebekeHakedis.PencereTest
{
    /// <summary>
    /// Pencereleri örnek verilerle kurar, ekran görüntüsünü PNG olarak kaydeder ve Tamam'a basıldığında
    /// dönen değerleri denetler. Kullanım: PencereTest.exe hedef-klasör
    /// </summary>
    internal static class Program
    {
        private static string _klasor = "ekran";
        private static string _ad = "";
        private static int _sira;
        private static int _hata;
        private static Action<Form> _doldur;
        private static bool _tamam = true;

        [STAThread]
        private static int Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Thread.CurrentThread.CurrentCulture = new CultureInfo("tr-TR");
            Thread.CurrentThread.CurrentUICulture = new CultureInfo("tr-TR");
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (args.Length > 0) _klasor = args[0];
            Directory.CreateDirectory(_klasor);

            Pencereler.Gosterici = Goster;
            Pencereler.Mesaj = (metin, dugmeler, simge, varsayilan) =>
            {
                Console.WriteLine("    [mesaj] " + metin.Replace("\n", " | "));
                return dugmeler == MessageBoxButtons.YesNo ? DialogResult.Yes : DialogResult.OK;
            };

            try
            {
                Calistir();
            }
            catch (Exception ex)
            {
                Console.WriteLine("HATA: " + ex);
                return 1;
            }
            Console.WriteLine(_hata == 0 ? "SONUÇ: tüm pencere denetimleri geçti" : "SONUÇ: " + _hata + " denetim başarısız");
            return _hata == 0 ? 0 : 1;
        }

        private static void Esit(object beklenen, object gercek, string ad)
        {
            bool ok = beklenen is double b && gercek is double g ? Math.Abs(b - g) < 1e-6 : Equals(beklenen, gercek);
            Console.WriteLine((ok ? "  ✓ " : "  ✗ ") + ad + (ok ? "" : "  beklenen=" + beklenen + " gerçek=" + gercek));
            if (!ok) _hata++;
        }

        private static OrtamVerisi Ortam(string dokum)
        {
            var o = new OrtamVerisi();
            var v = CadVarlik.DokumOku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, dokum), Encoding.UTF8));
            o.Doldur(v, NesneOkuyucu.Oku(v, "ornek.dwg"), new CizimAyarlari());
            return o;
        }

        private static void Dene(string ad, Action is_, Action<Form> doldur = null, bool tamam = true)
        {
            _ad = ad;
            _sira = 0;
            _doldur = doldur;
            _tamam = tamam;
            Console.WriteLine(ad);
            is_();
        }

        private static void Calistir()
        {
            var o = Ortam("ornek-dokum.json");

            Dene("01-eleman", () =>
            {
                var s = Pencereler.Eleman(o, null);
                Esit(true, s != null && s.Tip != null, "eleman: tip seçili döner");
                Esit("AG_DIREK", s?.Tur, "eleman: varsayılan tür AG direk");
                Esit("", s?.Gis, "eleman: GIS elle girilmediyse kendiliğinden");
            });

            // Onaylı (kilitli) hakediş seçiliyken Çiz düğmesi kapalı, uyarı görünür
            o.Proje.Onaylar[2] = HakedisOnayi.Kontrol | HakedisOnayi.Hakedis;
            Dene("01b-eleman-kilitli", () =>
            {
                var s = Pencereler.Eleman(o, new ElemanSecimi { Tur = "AG_DIREK", Durum = "M", Hakedis = 2 });
                Esit(true, s == null, "kilitli hakediş: Çiz kapalı, seçim dönmez");
            });
            o.Proje.Onaylar.Remove(2);

            Dene("02-eleman-pano", () =>
            {
                var s = Pencereler.Eleman(o, null);
                Esit("PANO", s?.Tur, "eleman: tür değişir");
                Esit(true, s != null && s.Tip != null && s.Tip.Rol == "ana", "eleman: pano tipi seçildi");
            }, f =>
            {
                var tur = Bul<SimgeListesi>(f, c => c.Items.Count == Turler.Elemanlar.Length);
                tur.SelectedIndex = Array.FindIndex(Turler.Elemanlar, t => t.Kod == "PANO");
                Esit(true, Bul<MetinKutusu>(f, t => t.Ipucu == "kendiliğinden: SCP01") != null, "eleman: pano için GIS önerisi SCP01");
                Resim(f, "sonra");
            });

            Dene("03-hat", () =>
            {
                var s = Pencereler.Hat(o, null);
                Esit(true, s != null && s.Kesit != null, "hat: kesit seçili döner");
                Esit("AG_HAVAI", s?.Tur, "hat: varsayılan tür AG havai");
            });

            // Cins düğmeleri: AG beton direk seçilir; demontaj · kesik simgesi listede ve özette
            Dene("01c-eleman-beton-kesik", () =>
            {
                var s = Pencereler.Eleman(o, new ElemanSecimi { Tur = "AG_DIREK", Durum = "M", Hakedis = 1 });
                Esit("AG_BETON", s?.Tip?.Cins, "eleman: cins düğmesiyle beton direk");
                Esit("DM", s?.Durum, "eleman: durum demontaj");
                Esit("KESİK", s?.DmDurum, "eleman: demontaj türü kesik");
                Esit("SH_DIREK_AG_KESIK", s != null ? Semboller.BlokAdi(s.Tur, s.Tip.Cins, s.Durum, s.DmDurum) : "", "eleman: kesik beton direğin simgesi");
            }, f =>
            {
                var cins = Bul<CinsSecici>(f, x => true);
                Esit(true, cins != null && cins.Secenekler.Count == 5, "eleman: AG direkte 5 cins düğmesi (hepsi, galvanizli demir, demir, beton, ağaç)");
                cins.Sec("AG_BETON");
                var lb = Bul<IkiSatirListe>(f, x => true);
                bool hepsiBeton = true;
                int sayi = 0;
                foreach (var it in lb.Items) { var kk = it as KatalogKalemi; if (kk == null) continue; sayi++; if (kk.Cins != "AG_BETON") hepsiBeton = false; }
                Esit(true, sayi > 20 && hepsiBeton, "eleman: listede yalnız beton direkler");
                Bul<KoyuSecim>(f, r => (string)r.Tag == "DM").Checked = true;
                var dm = Bul<KoyuAcilir>(f, c => c.Items.Count == 3 && Convert.ToString(c.Items[1]) == "KESİK");
                dm.SelectedIndex = 1;
                Resim(f, "sonra");
            });

            // Hat Değiştir: pencere hattın şimdiki iletkeniyle açılır, başlık ve düğme "değiştir"
            Dene("03d-hat-degistir", () =>
            {
                var simdiki = o.Katalog.HatKesitleri("AG_HAVAI").Find(x => x.Tanim == "3X50/16+70 ALPEK");
                var s = Pencereler.Hat(o, new HatSecimi { Tur = "AG_HAVAI", Durum = "M", Hakedis = 1, Iletkenleri = { new HatIletkeni(simdiki) } }, 3);
                Esit("3X50/16+70 ALPEK", s?.Kesit?.Tanim, "hat değiştir: hattın şimdiki iletkeniyle açılır");
            }, f =>
            {
                Esit("Hat değiştir", f.Text, "hat değiştir: pencere başlığı");
                Esit(true, Bul<KoyuDugme>(f, d => d.Text == "Değiştir") != null, "hat değiştir: Değiştir düğmesi");
            });

            // Müşterek hat: OG ve AG iletken birlikte gelir
            Dene("03b-hat-musterek", () =>
            {
                var s = Pencereler.Hat(o, new HatSecimi { Tur = "MUSTEREK", Durum = "M", Hakedis = 1 });
                Esit(2, s != null ? s.Iletkenleri.Count : 0, "müşterek hat: iki iletken");
                Esit(true, s != null && s.Iletkenleri.Count == 2 && Iletkenler.OgMu(s.Iletkenleri[0].Kesit.Cins) != Iletkenler.OgMu(s.Iletkenleri[1].Kesit.Cins), "müşterek hat: biri OG, biri AG");
            });

            // Çoklu iletken: 3 adet ALPEK
            Dene("03c-hat-adet", () =>
            {
                var s = Pencereler.Hat(o, new HatSecimi { Tur = "AG_HAVAI", Durum = "M", Hakedis = 1 });
                Esit(true, s != null && s.Kesit != null && s.Kesit.Cins == "ALPEK_KABLOLAR", "hat: ALPEK seçildi");
                Esit(3, s != null && s.Iletkenleri.Count > 0 ? s.Iletkenleri[0].Adet : 0, "hat: 3 adet");
                Esit(true, s != null && s.IletkenYazisi.StartsWith("3x(", StringComparison.Ordinal), "hat: yazımı 3x(…)");
            }, f =>
            {
                var cins = Bul<CinsSecici>(f, x => true);
                cins.Sec("ALPEK_KABLOLAR");
                var adet = Bul<SayiKutusu>(f, x => x.Parent != null && x.Parent.GetType().Name == "IletkenYuvasi");
                adet.Value = 3;
                Resim(f, "sonra");
            });

            Dene("04-kanal", () =>
            {
                var s = Pencereler.Kanal(o, null);
                Esit(true, s != null, "kanal: döner");
                Esit(KanalKodu.AG, s != null ? s.Kod : -1, "kanal: varsayılan kablo AG");
                Esit(40.0, s != null ? s.Alt : 0, "kanal: alt genişlik varsayılanı");
                Esit("PARKE TUVENAN (BARİYERLİ)", s != null ? s.Zemin : "", "kanal: cins + kaplama + bariyer → kalem adı");
            }, f =>
            {
                // Kanal cinsi (zemin) ve kaplama ayrı seçilir; altında kalem adı
                Esit(5, Bul<KoyuAcilir>(f, c => c.Name == "zeminCinsi").Items.Count, "kanal: 5 cins (toprak, tüvenan, mıcır, branşman, demontaj)");
                Bul<KoyuAcilir>(f, c => c.Name == "zeminCinsi").SelectedIndex = 1;
                Bul<KoyuAcilir>(f, c => c.Name == "zeminKaplamasi").SelectedIndex = 1;
                Bul<KoyuOnay>(f, c => c.Name == "zeminBariyer").Checked = true;
                Esit(true, Bul<Label>(f, l => l.Text == "Kalem adı: PARKE TUVENAN (BARİYERLİ)") != null, "kanal: kalem adı katalogdaki gibi (uyarı yok)");
                Resim(f, "zemin");
                Bul<KoyuAcilir>(f, c => c.Name == "zeminKaplamasi").SelectedIndex = 2;
                Esit(true, Bul<Label>(f, l => l.Text.StartsWith("Kalem adı: TUVENAN (ASFALT KAPLAMALI) (BARİYERLİ)") && l.Text.Contains("listesinde yok")) != null, "kanal: katalogda olmayan birleşim uyarılı");
                Bul<KoyuAcilir>(f, c => c.Name == "zeminKaplamasi").SelectedIndex = 1;
            });

            Dene("05-sondaj", () =>
            {
                var s = Pencereler.Sondaj(o, null);
                Esit(true, s != null && s.Tip != null, "sondaj: tip seçili döner");
            });

            Dene("06-bolge", () =>
            {
                string ad = "", kod = "", grup = "";
                bool ok = Pencereler.Bolge(ref ad, ref kod, ref grup);
                Esit(true, ok, "bölge: Tamam");
                Esit("Deneme Mahallesi", ad, "bölge: ad");
                Esit("11.22.33.44.55555", kod, "bölge: kod");
                Esit("24.38.01 (NA)", grup, "bölge: grup kodu");
            }, f =>
            {
                var kutular = new List<TextBox>();
                Hepsi(f, kutular);
                kutular[0].Text = "Deneme Mahallesi";
                kutular[1].Text = "11.22.33.44.55555";
                kutular[2].Text = "24.38.01 (NA)";
            });

            Dene("07-ayarlar", () =>
            {
                bool ok = Pencereler.Ayarlar(o);
                Esit(true, ok, "ayarlar: Tamam");
                Esit(39, o.Ayar.Dom, "ayarlar: DOM seçildi");
                Esit(1.0, o.Ayar.SimgeOlcegi, "ayarlar: Varsayılana dön simgeyi 1 kata getirdi");
                Esit(2.5, o.Ayar.ElemanYaziYuksekligi, "ayarlar: eleman yazısı yüksekliği");
                Esit(2.0, o.Ayar.EtiketYuksekligi, "ayarlar: hat etiketi (kablo tipi) yüksekliği");
                Esit(1.2, o.Ayar.MetrajYuksekligi, "ayarlar: metraj yazısı yüksekliği");
                Esit(1.5, o.Ayar.HatKalinligi, "ayarlar: hat kalınlığı (Kalın = 1,5 kat)");
                Esit(true, o.Ayar.MalzemeYazisi, "ayarlar: malzemeleri çizimde göster");
                Esit(Semboller.TakimSM, o.Ayar.SimgeTakimi, "ayarlar: simge takımı Şebeke-M seçildi");
            }, f =>
            {
                var dom = Bul<KoyuSecim>(f, r => r.Text == "39°");
                dom.Checked = true;
                var sekme = Bul<Sekmeler>(f, x => true);
                // Boyutlar (Görünüm sekmesi açıkken: gizli düğmeye basılamaz): simge 3 kat → Varsayılana dön → 1; yazılar elle
                sekme.Secili = 3;
                Bul<SayiKutusu>(f, k => k.Name == "simgeOlcegi").Value = 3;
                Bul<KoyuDugme>(f, d => d.Name == "boyutVarsayilan").PerformClick();
                Bul<SayiKutusu>(f, k => k.Name == "elemanYaziYuksekligi").Value = 2.5m;
                Bul<SayiKutusu>(f, k => k.Name == "etiketYuksekligi").Value = 2.0m;
                Bul<SayiKutusu>(f, k => k.Name == "metrajYuksekligi").Value = 1.2m;
                var kalin = Bul<KoyuAcilir>(f, k => k.Name == "hatKalinligi");
                Esit(5, kalin.Items.Count, "ayarlar: hat kalınlığı seçenekleri");
                Esit(true, Convert.ToString(kalin.SelectedItem).StartsWith("Normal"), "ayarlar: hat kalınlığı varsayılanı Normal");
                kalin.SelectedIndex = 3;
                Esit(true, Convert.ToString(kalin.SelectedItem).StartsWith("Kalın"), "ayarlar: hat kalınlığı Kalın seçildi");
                Bul<KoyuOnay>(f, k => k.Name == "malzemeYazisi").Checked = true;
                var takim = Bul<KoyuAcilir>(f, k => k.Name == "simgeTakimi");
                Esit(2, takim.Items.Count, "ayarlar: simge takımı seçenekleri (Klasik, Şebeke-M)");
                Esit(true, Convert.ToString(takim.SelectedItem).StartsWith("Klasik"), "ayarlar: simge takımı varsayılanı Klasik");
                takim.SelectedIndex = 1;
                Esit(true, Convert.ToString(takim.SelectedItem).StartsWith("Şebeke-M"), "ayarlar: simge takımı Şebeke-M seçildi");
                string[] adlar = { "genel", "proje", "tarife", "gorunum", "metraj" };
                for (int i = 1; i < adlar.Length; i++)
                {
                    sekme.Secili = i;
                    Resim(f, adlar[i]);
                }
                sekme.Secili = 0;
            });

            var direk = o.Proje.Elemanlar.Find(e => e.GisId == "SC77");
            int once = direk.Kalemler.Count;
            Dene("08-malzeme-direk", () =>
            {
                bool ok = Pencereler.Kalemler(o, direk);
                Esit(true, ok, "malzeme: Kaydet");
                Esit(once + 1, direk.Kalemler.Count, "malzeme: katalogdan eklenen satır nesneye yazıldı");
                var yeni = direk.Kalemler[direk.Kalemler.Count - 1];
                Esit(3.0, yeni.Miktar, "malzeme: yeni satırın miktarı düzenlendi");
                Esit(SayiCoz.Temiz(3 * yeni.Katsayi), yeni.Toplam, "malzeme: toplam = miktar × katsayı");
            }, f =>
            {
                var ekle = Bul<Button>(f, b => b.Text.StartsWith("Malzeme ekle", StringComparison.Ordinal));
                ekle.PerformClick();
                var g = Bul<DataGridView>(f, x => true);
                g.CancelEdit();
                g.EndEdit();
                var son = g.Rows[g.Rows.Count - 1];
                son.Cells[3].Value = "3";
                Resim(f, "sonra");
            });

            // Direğin durumu açılır listeyle M → DM (KESİK) → M: gerçek düzenleme denetimiyle (kullanıcının yaptığı gibi).
            // 8.11.2026: "Yeni direk Demontaj yapılınca tekrar Yeni'ye alınamıyor" bildirimi.
            string eskiDurum = direk.Durum, eskiDm = direk.DmDurum;
            Dene("08b-malzeme-durum-geri", () =>
            {
                bool ok = Pencereler.Kalemler(o, direk);
                Esit(true, ok, "durum geri: Kaydet");
                Esit("M", direk.Durum, "durum geri: direğin durumu yeniden M");
                Esit("", direk.DmDurum, "durum geri: DM durumu temizlendi");
                Esit("M", direk.Kalemler.Find(k => k.Ana)?.Durum, "durum geri: direğin kendi pozunun durumu M");
            }, f =>
            {
                var g = Bul<DataGridView>(f, x => true);
                int r = -1;
                for (int i = 0; i < g.Rows.Count; i++) if (g.Rows[i].Tag is Kalem k && k.Ana) r = i;
                Esit(true, r >= 0, "durum geri: direğin kendi satırı listede");
                // Kullanıcının yaptığı gibi: hücreye tıkla (CellClick → düzenleme + liste açılır), listeden seç; EndEdit çağrılmaz —
                // seçim yapılır yapılmaz değer yazılmalı ve düzenleme kendiliğinden kapanmalı
                Action<int, string, string> sec = (sutun, deger, ad) =>
                {
                    g.CurrentCell = g.Rows[r].Cells[sutun];
                    g.BeginEdit(true);
                    Application.DoEvents();
                    var cb = g.EditingControl as ComboBox;
                    Esit(true, cb != null, "durum geri: " + ad + " açılır liste düzenlemede");
                    if (cb == null) return;
                    Esit(true, cb.Items.Contains(deger), "durum geri: " + ad + " listede '" + deger + "' var");
                    cb.SelectedItem = deger;
                    Bekle(60);
                    Esit(false, g.IsCurrentCellInEditMode, "durum geri: " + ad + " seçilince düzenleme kapandı");
                };
                var ana = (Kalem)g.Rows[r].Tag;
                sec(2, "DM", "durum");
                Esit("DM", ana.Durum, "durum geri: M → DM yazıldı");
                sec(7, "KESİK", "DM durumu");
                Esit("KESİK", ana.DmDurum, "durum geri: DM durumu KESİK");
                Resim(f, "dm");
                sec(2, "M", "durum");
                Esit("M", ana.Durum, "durum geri: DM → M yazıldı");
                Esit("M", Convert.ToString(g.Rows[r].Cells[2].Value), "durum geri: hücrede M görünür");
                Esit("", ana.DmDurum ?? "", "durum geri: M'ye dönünce KESİK kendiliğinden kalktı");
                Esit("", Convert.ToString(g.Rows[r].Cells[7].Value), "durum geri: DM durumu hücresi boş");
                // Aynı hücrede ikinci kez değiştir (DM → M → DM+M): düzenleme kapanmasaydı ikinci seçim yazılmazdı
                sec(2, "DM+M", "durum");
                Esit("DM+M", ana.Durum, "durum geri: üçüncü değişiklik de yazıldı");
                sec(2, "M", "durum");
                Esit("M", ana.Durum, "durum geri: yeniden M");
                Resim(f, "sonra");
            });
            Esit(eskiDurum, direk.Durum, "durum geri: deneme sonunda direk eski durumunda");
            direk.DmDurum = eskiDm;

            // Direk tipi sonradan değiştirilir (13.11.2026): "Tipi değiştir…" katalogdan tip seçtirir (denemede listenin ilki),
            // direğin kendi pozu ve tipi değişir; malzemeler, durum ve hakediş kalır
            string eskiTip = direk.Tip, eskiCins = direk.Cins;
            int eskiSayi = direk.Kalemler.Count;
            var ilkTip = o.Katalog.AnaTipler(direk.Tur)[0];
            Dene("08c-malzeme-tip-degistir", () =>
            {
                bool ok = Pencereler.Kalemler(o, direk);
                Esit(true, ok, "tip değiştir: Kaydet");
                var ana = direk.Kalemler.Find(k => k.Ana);
                Esit(ilkTip.Tanim, ana?.Tanim, "tip değiştir: direğin kendi pozu seçilen tip");
                Esit(ilkTip.Cins, ana?.Cins, "tip değiştir: cins de seçilenden");
                Esit(ilkTip.Katsayi, ana?.Katsayi ?? -1, "tip değiştir: katsayı (kg) yeni tipten");
                Esit(ilkTip.Tanim, direk.Tip, "tip değiştir: elemanın tipi");
                Esit(ilkTip.Cins, direk.Cins, "tip değiştir: elemanın cinsi");
                Esit(eskiDurum, direk.Durum, "tip değiştir: durum değişmedi");
                Esit(eskiSayi, direk.Kalemler.Count, "tip değiştir: malzemeler kaldı");
            }, f =>
            {
                var dugme = Bul<Button>(f, b => b.Text.StartsWith("Tipi değiştir", StringComparison.Ordinal));
                Esit(true, dugme != null, "tip değiştir: düğme var");
                Esit(true, (f.Text ?? "").Contains(eskiTip), "tip değiştir: başlıkta eski tip");
                dugme.PerformClick();
                Esit(true, (f.Text ?? "").Contains(ilkTip.Tanim), "tip değiştir: başlık yeni tiple");
                var g = Bul<DataGridView>(f, x => true);
                int r = -1;
                for (int i = 0; i < g.Rows.Count; i++) if (g.Rows[i].Tag is Kalem k && k.Ana) r = i;
                Esit(MalzemeYazimi.Duzelt(ilkTip.Tanim), Convert.ToString(g.Rows[r].Cells[1].Value), "tip değiştir: ilk satırda yeni tip");
                Resim(f, "sonra");
            });
            // Eski tipe geri (sonraki denemeler eski tipi bekler)
            {
                var ana = direk.Kalemler.Find(k => k.Ana);
                var eskiKalem = o.Katalog.Bul(eskiCins, eskiTip);
                if (ana != null && eskiKalem != null) { ana.Cins = eskiKalem.Cins; ana.Tanim = eskiKalem.Tanim; ana.Birim = eskiKalem.Birim; ana.Katsayi = eskiKalem.Katsayi; }
                direk.Tip = eskiTip;
                direk.Cins = eskiCins;
            }

            // Önerilen malzemeler (13.11.2026): SC77 şehir içi AG direk, bağlı hattı yok → taşıyıcı; çıplak AG yok → yalnız GT-70 travers
            int oncekiSayi = direk.Kalemler.Count;
            Dene("08d-malzeme-onerilen", () =>
            {
                bool ok = Pencereler.Kalemler(o, direk);
                Esit(true, ok, "önerilen: Kaydet");
                Esit(oncekiSayi + 1, direk.Kalemler.Count, "önerilen: işaretli öneri kalem olarak eklendi");
                var yeni = direk.Kalemler.Find(k => k.Cins == "TRAVERS_VE_KONSOLLAR_GLV" && k.Tanim == "GT-70");
                Esit(true, yeni != null && !yeni.Ana && yeni.Miktar == 1 && yeni.Durum == "M" && yeni.Kaynak == "MALZEME", "önerilen: GT-70 travers, 1 adet, direğin durumuyla");
            }, f =>
            {
                var dugme = Bul<Button>(f, b => b.Text.StartsWith("Önerilen", StringComparison.Ordinal));
                Esit(true, dugme != null, "önerilen: düğme var");
                Esit("Önerilen (1)…", dugme?.Text, "önerilen: düğme eksik öneri sayısını gösterir");
                dugme.PerformClick();   // iç pencere: Seçilenleri ekle (varsayılan işaretli)
                Esit("Önerilen…", dugme?.Text, "önerilen: eklenince sayı düşer");
                var g = Bul<DataGridView>(f, x => true);
                bool var_ = false;
                for (int i = 0; i < g.Rows.Count; i++) if (g.Rows[i].Tag is Kalem k && k.Tanim == "GT-70") var_ = true;
                Esit(true, var_, "önerilen: tabloda yeni satır");
                Resim(f, "sonra");
            });
            direk.Kalemler.RemoveAll(k => k.Cins == "TRAVERS_VE_KONSOLLAR_GLV" && k.Tanim == "GT-70");   // sonraki denemeler eski listeyi bekler

            var hat = o.Proje.Hatlar[0];
            Dene("09-malzeme-hat", () =>
            {
                bool ok = Pencereler.Kalemler(o, hat);
                Esit(true, ok, "malzeme (hat): Kaydet");
                Esit("DM+M", hat.Durum, "malzeme (hat): hat satırının durumu hattın durumu olur");
            }, f =>
            {
                var g = Bul<DataGridView>(f, x => true);
                for (int r = 0; r < g.Rows.Count; r++)
                    if (g.Rows[r].Tag is Kalem k && k.Kaynak == "HAT") g.Rows[r].Cells[2].Value = "DM+M";
            });

            var kanal = o.Proje.Kanallar[0];
            Dene("10-malzeme-kanal", () =>
            {
                bool ok = Pencereler.Kalemler(o, kanal);
                Esit(true, ok, "malzeme (kanal): Kaydet");
                Esit(60.0, kanal.AltGenislik, "malzeme (kanal): alt genişlik değişti");
                var ana = kanal.Kalemler.Find(k => k.Ana);
                Esit(Metraj.KanalHacmi(60, kanal.UstGenislik, kanal.Derinlik, ana.Miktar), ana.Toplam, "malzeme (kanal): hacim yeniden hesaplandı");
                Esit("TOPRAK (ASFALT KAPLAMALI)", kanal.Zemin, "malzeme (kanal): zemin cins + kaplamadan");
                Esit("TOPRAK (ASFALT KAPLAMALI)", ana.Tanim, "malzeme (kanal): kanal kaleminin adı da");
            }, f =>
            {
                var sayilar = new List<SayiKutusu>();
                Hepsi(f, sayilar);
                sayilar[0].Value = 60;
                Bul<KoyuAcilir>(f, c => c.Name == "zeminCinsi").SelectedIndex = 0;
                Bul<KoyuAcilir>(f, c => c.Name == "zeminKaplamasi").SelectedIndex = 2;
                Bul<KoyuOnay>(f, c => c.Name == "zeminBariyer").Checked = false;
                Bul<KoyuOnay>(f, c => c.Name == "zeminTrencher").Checked = false;
                Resim(f, "sonra");
            });

            var sondaj = o.Proje.Sondajlar[0];
            Dene("11-malzeme-sondaj", () =>
            {
                bool ok = Pencereler.Kalemler(o, sondaj);
                Esit(true, ok, "malzeme (sondaj): Kaydet");
            });

            // Telefon projesiyle (çok elemanlı) eleman penceresi ve katalog seçimi
            var t = new OrtamVerisi();
            t.Doldur(new List<CadVarlik>(), ProjeDosyasi.Oku(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "telefon-proje.sebeke.json"), Encoding.UTF8)), new CizimAyarlari());
            Dene("12-katalog-sec", () =>
            {
                var it = Pencereler.KatalogdanSec("Malzeme ekle — deneme", t.Katalog.Malzemeler("AG_DIREK"), null);
                Esit(true, it != null, "katalog: seçim döner");
            });
            Dene("13-eleman-telefon-projesi", () =>
            {
                var s = Pencereler.Eleman(t, null);
                Esit(true, s != null, "eleman (telefon projesi): döner");
            }, null, true);

            // Şeritteki hızlı çizim öğesinin süzgeçli penceresi: AG Yeraltı › AG Ek Mufu yalnız AG ek mufularını listeler
            KatalogKaynagi.KategorileriYukle();
            var mufuOgesi = Kategoriler.Oge("AG_YERALTI", "EK_MUFU_AG");
            Dene("13b-eleman-suzgecli", () =>
            {
                var s = Pencereler.Eleman(o, new ElemanSecimi { Tur = mufuOgesi.Tur, Durum = "M", Hakedis = 1, Cinsler = new List<string>(mufuOgesi.Cinsler) });
                Esit(true, s != null && s.Tip != null && s.Tip.Cins.StartsWith("EK_MUFU_AG", StringComparison.Ordinal), "süzgeçli pencere: yalnız AG ek mufu tipi");
                Esit(2, s != null ? s.Cinsler.Count : 0, "süzgeçli pencere: süzgeç seçimde kalır");
            }, f =>
            {
                var lb = Bul<IkiSatirListe>(f, x => true);
                bool hepsiAg = true;
                int sayi = 0;
                foreach (var it in lb.Items)
                {
                    var kk = it as KatalogKalemi;
                    if (kk == null) continue;
                    sayi++;
                    if (!kk.Cins.StartsWith("EK_MUFU_AG", StringComparison.Ordinal)) hepsiAg = false;
                }
                Esit(true, sayi > 5 && hepsiAg, "süzgeçli pencere: listede yalnız AG ek mufuları");
            });

            // Eksik malzeme sorgusu (AutoCAD DETAY): aranan cins yazılınca tip listesi o cinsin tipleriyle dolar
            var dEleman = o.Proje.Elemanlar.Find(e => e.Kalemler.Exists(k => !k.Ana));
            var dAra = dEleman != null ? dEleman.Kalemler.Find(k => !k.Ana) : null;
            var df = new DetayFiltresi();
            Dene("18-eksik-malzeme", () =>
            {
                List<DetaySatiri> bulunan;
                var islem = Pencereler.Detay(o, df, out bulunan);
                Esit(DetayIslemi.Sec, islem, "eksik malzeme: Çizimde seç");
                Esit(dAra != null ? dAra.Cins : "-", df.Cins, "eksik malzeme: aranan cins döner");
                Esit(DetayKapsami.Olanlar, df.Kapsam, "eksik malzeme: seçilen gösterim (olanlar) döner");
                Esit("", df.AnaCins, "eksik malzeme: (hepsi) süzgeç sayılmaz");
                Esit(true, bulunan != null && bulunan.Count > 0 && bulunan.TrueForAll(x => x.Olan), "eksik malzeme: bulunan satırlar döner (malzemesi olanlar)");
            }, f =>
            {
                var kutular = new List<ComboBox>();
                Hepsi(f, kutular);
                Esit(true, kutular.Count >= 7 && kutular[0].Items.Count > 1, "eksik malzeme: ana cinsler çizimden dolu");
                kutular[4].Text = dAra != null ? dAra.Cins : "";
                Esit(true, kutular[5].Items.Count > 1, "eksik malzeme: tip listesi aranan cinsin tipleriyle dolar");
                var olan = Bul<RadioButton>(f, r => r.Text.StartsWith("Bu malzemesi OLAN", StringComparison.Ordinal));
                if (olan != null) olan.Checked = true;
                Bekle(450);
                Resim(f, "sonra");
            });

            // Hakediş onayı (AutoCAD HAK_ONAY): sıra kuralı Kontrol → Hakediş → GIS
            var onaylar = new SortedDictionary<int, int> { { 1, 6 } };
            Dene("19-hakedis-onayi", () =>
            {
                bool ok = Pencereler.Onaylar(o, onaylar);
                Esit(true, ok, "onay: Kaydet");
                Esit(7, HakedisOnayi.Bitler(onaylar, 2), "onay: GIS işaretlenince kontrol ve hakediş de işaretlenir");
                Esit(0, HakedisOnayi.Bitler(onaylar, 1), "onay: kontrol kaldırılınca sonraki aşamalar da kalkar");
            }, f =>
            {
                var kutular = new List<CheckBox>();
                Hepsi(f, kutular);
                Esit(true, kutular.Count >= 36 && kutular[0].Checked && kutular[1].Checked && !kutular[2].Checked, "onay: kayıtlı onay işaretli gelir");
                kutular[5].Checked = true;   // 2. hakediş · GIS
                kutular[0].Checked = false;  // 1. hakediş · Kontrol
                Resim(f, "sonra");
            });

            // Kullanıcılar ve roller (telefondakilerle aynı): onay mekanizması açıkken her aşama kendi rolünde
            Func<string, string, string, Kullanici> uye = (id, ad, rol) => new Kullanici { Id = id, Ad = ad, Rol = rol, Tuz = "T" + id, Ozet = Yetki.Ozet("1234", "T" + id), Guncelleme = "2026-11-01T08:00:00.000Z" };
            var yonetici = uye("U1", "Deneme Yönetici", "yonetici");
            var kontrolcu = uye("U2", "Deneme Kontrol", "kontrol");
            var saha = uye("U3", "Deneme Saha", "saha");
            o.Proje.Kullanicilar = new List<Kullanici> { yonetici, kontrolcu, saha };
            o.Proje.OnayAyari = new OnayAyari { KapaliHakedisler = new SortedSet<int> { 4 } };
            o.Uye = kontrolcu;
            var rolOnaylari = new SortedDictionary<int, int> { { 1, 6 } };
            Dene("19b-hakedis-onayi-rol", () =>
            {
                bool ok = Pencereler.Onaylar(o, rolOnaylari);
                Esit(true, ok, "rol: Kaydet");
                Esit(4, HakedisOnayi.Bitler(rolOnaylari, 3), "rol: kontrol mühendisi 3. hakedişe Kontrol onayı verir");
                Esit(6, HakedisOnayi.Bitler(rolOnaylari, 1), "rol: Hakediş onayı kutusu kapalı, değişmedi");
            }, f =>
            {
                var kutular = new List<CheckBox>();
                Hepsi(f, kutular);
                Esit(true, kutular[0].Enabled && !kutular[1].Enabled && !kutular[2].Enabled, "rol: yalnız Kontrol kutuları açık");
                kutular[6].Checked = true;   // 3. hakediş · Kontrol
                Esit(true, Bul<Label>(f, l => l.Text.Contains("yazmaya kapalı")) != null, "rol: yazmaya kapalı hakediş satırda yazılı");
                Esit(true, Bul<Label>(f, l => l.Text.StartsWith("Oturum: Deneme Kontrol", StringComparison.Ordinal)) != null, "rol: oturum ve izinli aşamalar yazılı");
                Resim(f, "sonra");
            });

            // Kullanıcılar ve yetkiler: Yönetici oturumu, 2. hakedişi yazmaya kapatır
            var duzen = new KullaniciDuzeni(o.Proje.Kullanicilar, o.Proje.OnayAyari, yonetici);
            Dene("19c-kullanicilar", () =>
            {
                bool ok = Pencereler.Kullanicilar(o, duzen, (l, id, sifre) => sifre == "1234" ? null : "Şifre yanlış.");
                Esit(true, ok, "kullanıcılar: Kaydet");
                Esit("2,4", string.Join(",", new List<int>(duzen.Kapali).ConvertAll(n => n.ToString(CultureInfo.InvariantCulture)).ToArray()), "kullanıcılar: 2. hakediş yazmaya kapandı");
                Esit(true, duzen.Degisti, "kullanıcılar: değişiklik kaydedilecek");
            }, f =>
            {
                var kutular = new List<CheckBox>();
                Hepsi(f, kutular);
                var iki = kutular.Find(c => c.Text == "2.");
                Esit(true, iki != null && iki.Enabled, "kullanıcılar: Yönetici hakediş yetkisini değiştirebilir");
                Esit(true, kutular.Exists(c => c.Text == "4." && c.Checked), "kullanıcılar: kayıtlı kapalı hakediş işaretli");
                iki.Checked = true;
                Esit(true, Bul<Label>(f, l => l.Text == "Deneme Kontrol") != null, "kullanıcılar: liste");
                Resim(f, "sonra");
            });

            // Kullanıcılar: oturum yok → değiştirilemez (düğmeler kapalı)
            var duzen2 = new KullaniciDuzeni(o.Proje.Kullanicilar, o.Proje.OnayAyari, null);
            Dene("19d-kullanicilar-oturumsuz", () =>
            {
                Pencereler.Kullanicilar(o, duzen2, (l, id, sifre) => "Şifre yanlış.");
                Esit(false, duzen2.Degisti, "oturumsuz: değişiklik yok");
            }, f =>
            {
                var kutular = new List<CheckBox>();
                Hepsi(f, kutular);
                Esit(true, kutular.TrueForAll(c => !c.Enabled), "oturumsuz: hakediş yetkisi kapalı");
                Esit(true, Bul<Button>(f, b => b.Text == "Oturum aç" && b.Visible) != null, "oturumsuz: Oturum aç düğmesi");
            });

            Dene("19e-ilk-yonetici", () =>
            {
                var g = Pencereler.KullaniciFormu(null, true, true);
                Esit("Deneme Yeni|yonetici|2468", g == null ? "" : g.Ad + "|" + g.Rol + "|" + g.Sifre, "form: ilk yönetici adı, rolü, şifresi");
            }, f =>
            {
                var metinler = new List<MetinKutusu>();
                Hepsi(f, metinler);
                metinler[0].Text = "Deneme Yeni";
                metinler[1].Text = "2468";
                metinler[2].Text = "2468";
                Esit(true, metinler[1].Kutu.UseSystemPasswordChar, "form: şifre gizli");
                Resim(f, "sonra");
            });

            Dene("19f-oturum-ac", () =>
            {
                string denenen = null;
                bool ok = Pencereler.OturumAc(o.Proje.Kullanicilar, (id, sifre) => { denenen = id + ":" + sifre; return sifre == "1234" ? null : "Şifre yanlış."; }, "U2");
                Esit(true, ok, "oturum: giriş");
                Esit("U2:1234", denenen, "oturum: seçili kullanıcı ve şifre denendi");
            }, f =>
            {
                var m = Bul<MetinKutusu>(f, x => true);
                m.Text = "1234";
                Resim(f, "sonra");
            });
            o.Proje.Kullanicilar = new List<Kullanici>();
            o.Proje.OnayAyari = null;
            o.Uye = null;

            // Onaylı hakedişteki satırlar kilitli: değiştirilemez, silinemez
            o.Proje.Onaylar[direk.Hakedis] = HakedisOnayi.Kontrol | HakedisOnayi.Hakedis;
            int kilitliOnce = direk.Kalemler.Count;
            Dene("20-malzeme-kilitli", () =>
            {
                bool ok = Pencereler.Kalemler(o, direk);
                Esit(true, ok, "kilitli: Kaydet");
                Esit(kilitliOnce, direk.Kalemler.Count, "kilitli: onaylı hakedişin satırı silinmedi");
            }, f =>
            {
                var g = Bul<DataGridView>(f, x => true);
                Esit(true, g.Rows.Count > 0 && g.Rows[0].ReadOnly, "kilitli: onaylı hakedişin satırı salt okunur");
                g.CurrentCell = g.Rows[g.Rows.Count - 1].Cells[0];
                Bul<Button>(f, b => b.Text == "Satırı sil").PerformClick();
                Esit(kilitliOnce, g.Rows.Count, "kilitli: silme düğmesi kilitli satırı silmez");
            });
            o.Proje.Onaylar.Clear();

            // Toplu malzeme: seçilen direklere aynı malzeme
            var direkler = o.Proje.Elemanlar.FindAll(e => NesneYazici.DirekMi(e.Tur));
            Dene("23-toplu-malzeme", () =>
            {
                var l = Pencereler.TopluMalzeme(o, direkler);
                Esit(1, l != null ? l.Count : 0, "toplu malzeme: bir satır döner");
                Esit(2.0, l != null && l.Count > 0 ? l[0].Miktar : 0, "toplu malzeme: miktar düzenlendi");
            }, f =>
            {
                Bul<Button>(f, b => b.Text == "Ekle").PerformClick();
                var g = Bul<DataGridView>(f, x => true);
                Esit(1, g.Rows.Count, "toplu malzeme: listeye eklendi");
                g.Rows[0].Cells[1].Value = "2";
                Resim(f, "sonra");
            });

            // Telefondan alma onayı (kutucuklar ve uyarılar)
            var oz = new AktarimOzeti { Proje = "Deneme Projesi", Dosya = "saha_2026-10-18.sebeke.json", Degismeyen = 120 };
            oz.Yeniler.Add(new[] { "SC100 AG Direk", "Eleman" });
            oz.Yeniler.Add(new[] { "SC101 AG Direk", "Eleman" });
            oz.Yeniler.Add(new[] { "Hat 3X50/16+70 ALPEK", "Hat" });
            oz.Guncellenenler.Add(new[] { "SC103 Trafo", "DURUM: M → DM+M" });
            oz.Guncellenenler.Add(new[] { "SC104 Aydınlatma Direği", "Konum değişti" });
            oz.Guncellenenler.Add(new[] { "SC105 Pano", "Malzeme eklendi" });
            oz.Kilitliler.Add("SC150 OG Direk (yeni)");
            oz.Kilitliler.Add("SC151 Trafo");
            oz.Silinenler.Add("SC175 AG Hat");
            oz.Onaylar.Add("3. hakediş → Kontrol + Hakediş (kilitlenecek)");
            Dene("21-telefondan-al", () => Esit(true, Pencereler.AktarimOnayi(oz), "telefondan al: Çizime aktar"));

            // Koyu ileti kutusu
            Dene("22-ileti", () =>
            {
                var r = KoyuMesaj.Goster("Bu nesne denetlenmiş (KONTROL işaretli). Değiştirirseniz denetim yeniden gerekir.\n\nYine de malzemeleri açılsın mı?",
                    "Şebeke-M", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2, Goster);
                Esit(DialogResult.No, r, "ileti: varsayılan düğme Hayır");
            });

            // Hakkında: Şebeke-M logosu, sürüm, komut listesi
            Esit(true, Marka.Logo != null && Marka.Simge(20) != null && Marka.SeritSimgesi(32) != null, "marka: logo ve simgeler gömülü");
            bool yazildi = false;
            Esit(true, Marka.Hakkinda.Dizi("amac") != null && Marka.Hakkinda.Dizi("amac").Count >= 2 && Marka.Hakkinda.Dizi("yapabildikler").Count >= 3, "marka: hakkında metni gömülü (ortak/marka/hakkinda.json)");
            Dene("24-hakkinda", () => Pencereler.Hakkinda("0.1.99", "AutoCAD R25.0 · .NET 8", () => yazildi = true), f =>
            {
                Bul<Button>(f, b => b.Text == "Komut satırına yaz").PerformClick();
                Esit(true, yazildi, "hakkında: komut listesi yazılır");
                var g = Bul<DataGridView>(f, x => true);
                Esit(true, g != null && g.Rows.Count > KomutRehberi.Liste.Length, "hakkında: komutlar gruplu listelenir");
                Esit(true, Bul<Label>(f, l => l.Text == "Neler yapar?") != null && Bul<Label>(f, l => l.Text.StartsWith("•  ")) != null, "hakkında: amaç ve yapabildikler metni");
                var sekme = Bul<Sekmeler>(f, x => true);
                Esit(true, sekme != null && sekme.Secili == 0, "hakkında: önce Hakkında sekmesi");
                sekme.Secili = 1;
                Resim(f, "komutlar");
            });

            // Proje özeti: projeler solda, seçilen projenin malzeme listesi sağda; Excel'e aktar görünen listeyi verir
            var poz = new ProjeOzeti(o.Proje);
            Pencereler.ProjeOzetiGorunumu aktarilan = null;
            Dene("25-proje-ozeti", () =>
            {
                Pencereler.ProjeOzetiGoster(poz, gv => aktarilan = gv);
                Esit(true, aktarilan != null && aktarilan.Proje != null && !aktarilan.Proje.Tumu, "proje özeti: Excel'e aktar seçili projeyi verir");
                Esit("DM", aktarilan != null ? aktarilan.Durum : "", "proje özeti: süzgeç Excel'e gider");
            }, f =>
            {
                var lb = Bul<IkiSatirListe>(f, x => true);
                Esit(poz.Projeler.Count, lb.Items.Count, "proje özeti: proje listesi");
                var g = Bul<DataGridView>(f, x => true);
                Esit(poz.Malzemeler(poz.Projeler[0]).Count, g.RowCount, "proje özeti: tüm projelerin malzeme listesi");
                int son = poz.Projeler.Count - 1;
                lb.SelectedIndex = son;
                Esit(poz.Malzemeler(poz.Projeler[son]).Count, g.RowCount, "proje özeti: seçilen projenin malzeme listesi");
                var durum = Bul<KoyuAcilir>(f, c => c.Items.Contains("DM"));
                durum.SelectedItem = "DM";
                Esit(poz.Malzemeler(poz.Projeler[son], 0, "DM").Count, g.RowCount, "proje özeti: durum süzgeci");
                Resim(f, "sonra");
                // Kanal listesi sekmesi: tüm projeler, her projenin altında toplamı ve genel toplam
                durum.SelectedIndex = 0;
                lb.SelectedIndex = 0;
                var sekme = Bul<Sekmeler>(f, x => true);
                sekme.Secili = 1;
                var kg = Bul<DataGridView>(f, x => x.Name == "kanalListesi");
                var kl = poz.Kanallar;
                Esit(kl.Satirlar.Count + 2 * kl.Projeler.Count - 1, kg.RowCount, "proje özeti: kanal listesi (proje başlıkları + satırlar + proje toplamları + genel toplam)");
                Esit(true, kg.Columns[0].HeaderText == "Baş – bit" && (kg.Rows.Count > 0 && Convert.ToString(kg.Rows[0].Cells[0].Value).StartsWith("PROJE: ")), "proje özeti: kanal listesinde proje başlık satırı");
                Esit(true, Bul<Button>(f, b => b.Name == "kanalTablosu").Visible, "proje özeti: kanal sekmesinde 'Çizime tablo olarak koy'");
                Resim(f, "kanal");
                // Excel'e aktar: malzeme sekmesi, son proje ve DM süzgeciyle (görünüm Excel'e gider)
                sekme.Secili = 0;
                lb.SelectedIndex = son;
                durum.SelectedItem = "DM";
                Bul<Button>(f, b => b.Text == "Excel'e aktar").PerformClick();
            });

            Dene("25b-kanal-tablosu", () =>
            {
                var gv = Pencereler.ProjeOzetiGoster(poz, null);
                Esit(true, gv != null && gv.KanalTablosu && gv.Sekme == 1, "proje özeti: kanal tablosu istenir");
            }, f =>
            {
                Bul<Sekmeler>(f, x => true).Secili = 1;
                Bul<Button>(f, b => b.Name == "kanalTablosu").PerformClick();
            });

            Dene("25c-birlesik-metraj-iste", () =>
            {
                var gv = Pencereler.ProjeOzetiGoster(poz, null);
                Esit(true, gv != null && gv.BirlesikMetraj && gv.Proje != null && !gv.Proje.Tumu, "proje özeti: Birleşik Metraj seçili projeyle istenir");
            }, f =>
            {
                var lb = Bul<IkiSatirListe>(f, x => true);
                lb.SelectedIndex = poz.Projeler.Count - 1;
                Bul<Button>(f, b => b.Name == "birlesikMetraj").PerformClick();
            });

            // Birleşik Metraj: ayar penceresi (şablon, başlık bilgileri) ve sonuç penceresi (açılan sütunlar, uyarılar)
            var metrajAyari = new MetrajAyari { Firma = "Deneme Yüklenici Ltd." };
            Dene("30-birlesik-metraj", () =>
            {
                string hak;
                Esit(true, Pencereler.BirlesikMetrajSor(metrajAyari, "Deneme Köyü AG-OG Şebekesi", 3, out hak), "birleşik metraj: Oluştur");
                Esit("3", hak, "birleşik metraj: hakediş no görünen hakedişten");
                Esit("ELAZIĞ", metrajAyari.Il, "birleşik metraj: il saklanır");
                Esit(true, metrajAyari.Gomulu, "birleşik metraj: gömülü şablon varsayılan");
            }, f =>
            {
                Bul<MetinKutusu>(f, m => m.Ipucu == "İLİ").Text = "ELAZIĞ";
                Bul<MetinKutusu>(f, m => m.Ipucu == "İLÇESİ").Text = "MERKEZ";
                Resim(f, "sonra");
            });
            var metrajPlani = new MetrajPlani();
            foreach (var k in new[] { "eleman", "iletkenSatiri", "yeraltiSatiri", "eslesen", "yeniSutun", "kopyaSayfa", "fazla", "atlanan" }) metrajPlani.Ozet[k] = 0;
            metrajPlani.Ozet["eleman"] = 9; metrajPlani.Ozet["iletkenSatiri"] = 6; metrajPlani.Ozet["eslesen"] = 25; metrajPlani.Ozet["yeniSutun"] = 3; metrajPlani.Ozet["kopyaSayfa"] = 1; metrajPlani.Ozet["fazla"] = 1;
            metrajPlani.KopyaSayfalar.Add(new MetrajPlani.KopyaSayfa { Ad = "DİREK AG BETON", Kaynak = "DİREK METRAJI", Hangi = "direk", Aile = "AG_BETON" });
            metrajPlani.YeniSutunlar.Add(new MetrajPlani.YeniSutun { Hangi = "direk", Sayfa = "DİREK METRAJI", Blok = "Y", SutunNo = 279, Kod = "Y175", Tip = "G-K5", Ad = "G-K5 Galvaniz Demir Direk", Birim = "ad.", Poz = "5.1" });
            metrajPlani.YeniSutunlar.Add(new MetrajPlani.YeniSutun { Hangi = "direk", Sayfa = "DİREK AG BETON", Blok = "Y", SutunNo = 7, Kod = "Y176", Tip = "9,3/3", Ad = "9,3/3 Beton Direk", Birim = "ad.", Poz = "5.6.7" });
            metrajPlani.YeniSutunlar.Add(new MetrajPlani.YeniSutun { Hangi = "iletken", Sayfa = "İLETKEN METRAJI", Blok = "D", SutunNo = 66, Kod = "D120", Tip = "OXLIP", Ad = "OXLIP (298.86 Kg/Km)", Birim = "kg", Poz = "109.2.1" });
            metrajPlani.Fazlalar.Add(new MetrajPlani.Fazla { Hangi = "direk", Blok = "Y", Ad = "VHD-35", Birim = "ad.", Miktar = 3, Nereler = new List<string> { "SC7" } });
            metrajPlani.Uyarilar.Add("SC2: demontaj direğin kesik / sökük bilgisi yok; \"Kesik\" sayıldı.");
            Dene("30b-birlesik-metraj-sonuc", () => Pencereler.BirlesikMetrajSonuc(metrajPlani, Path.Combine(_klasor, "Deneme_BIRLESIK_METRAJ.xlsm")), f =>
            {
                var kutu = Bul<TextBox>(f, t => t.Multiline);
                Esit(true, kutu != null && kutu.Text.Contains("DİREK AG BETON  (AG_BETON)") && kutu.Text.Contains("Y175") && kutu.Text.Contains("VHD-35") && kutu.Text.Contains("UYARILAR"), "birleşik metraj sonucu: direk sayfaları, sütunlar, fazlalar ve uyarılar listelenir");
                Resim(f, "sonra");
            });

            // Koordinat dilimi (Google Earth / CBS / harita altlığı için; çizimde yoksa sorulur)
            Dene("26-koordinat-dilimi", () => Esit(39, Pencereler.DomSec(0, "Google Earth dosyası"), "dilim: seçilen dilim döner"), f =>
            {
                Bul<KoyuSecim>(f, r => r.Text == "39°").Checked = true;
                Resim(f, "sonra");
            });

            // CBS'den alınan nesnenin bilgileri
            Dene("27-cbs-bilgisi", () => Pencereler.CbsBilgisi("Direkler_2026", new List<string[]>
            {
                new[] { "GIS_NO", "SC1024" }, new[] { "TUR", "AG_DIREK" }, new[] { "TIP", "10I" }, new[] { "DURUM", "MEVCUT" },
                new[] { "MALZEME", "G-L-50 × 1; Topraklama × 1" }, new[] { "ISLETME", "Merkez" },
            }));

            // CBS'den al: direk dosyası şebeke nesnesi (sütunlar eş anlamlılarıyla), bina dosyası altlık; ikinci dosya
            // pencerede "Altlık"tan "Bölge"ye çevrilir
            var cbsKaynaklari = new List<CbsKaynagi>();
            var cv1 = MifDosyasi.Oku("Version 300\nDelimiter \",\"\nCoordSys Earth Projection 8, 104, \"m\", 39, 0, 1, 500000, 0\nColumns 4\n  OBJECTID Integer\n  DIREK_NO Char(20)\n  DIREK_TIPI Char(40)\n  DURUMU Char(20)\nData\nPoint 519300 4282100\nPoint 519340 4282100\n",
                                     "1,\"D-1\",\"9I\",\"İşletmede\"\n2,\"D-2\",\"G-K2\",\"Sökülecek\"\n");
            var ck1 = new CbsKaynagi { Ad = "ENH_DIREKLER", Veri = cv1 };
            CbsIceAktarim.Tani(ck1);
            cbsKaynaklari.Add(ck1);
            var cv2 = MifDosyasi.Oku("Version 300\nColumns 1\n  AD Char(20)\nData\nRegion 1\n  4\n519300 4282100\n519340 4282100\n519340 4282140\n519300 4282100\n", "\"Bina\"\n");
            var ck2 = new CbsKaynagi { Ad = "BINALAR", Veri = cv2 };
            CbsIceAktarim.Tani(ck2);
            cbsKaynaklari.Add(ck2);
            var cbsAyari = new CbsAlmaAyari { Hakedis = 1 };
            Dene("29-cbs-al", () =>
            {
                Esit(true, Pencereler.CbsAl(o, cbsKaynaklari, cbsAyari), "cbs al: Al");
                Esit("DIREK", ck1.Katman, "cbs al: direk dosyası direk olarak alınır");
                Esit(1, ck1.Sutun("GIS_NO"), "cbs al: DIREK_NO sütunu GIS no");
                Esit("BOLGE", ck2.Katman, "cbs al: bina dosyası pencerede bölgeye çevrildi");
                Esit("MEVCUT", cbsAyari.VarsayilanDurum, "cbs al: varsayılan durum mevcut");
            }, f =>
            {
                Esit("", ck2.Katman, "cbs al: tanınmayan alan dosyası altlık gelir");
                var liste = Bul<IkiSatirListe>(f, x => true);
                liste.SelectedIndex = 1;
                var katman = Bul<KoyuAcilir>(f, x => x.Items.Count == CbsIceAktarim.Secenekler.Length);
                katman.SelectedIndex = Array.FindIndex(CbsIceAktarim.Secenekler, x => x[0] == "BOLGE");
                Resim(f, "bolge");
            });

            // Harita altlığı: sağlayıcı, anahtar (yalnız bu bilgisayarda), alan, ayrıntı
            var altlik = new AltlikAyari();
            Dene("28-harita-altligi", () =>
            {
                Esit(true, Pencereler.HaritaAltligiSec(altlik), "altlık: Altlığı getir");
                Esit("google_s", altlik.Saglayici, "altlık: seçilen sağlayıcı");
                Esit("deneme-anahtar", altlik.Anahtar("google"), "altlık: anahtar saklanır");
                Esit(2, altlik.Kalite, "altlık: ayrıntı yüksek");
            }, f =>
            {
                var lb = Bul<IkiSatirListe>(f, x => true);
                Esit(true, lb.SelectedItem is AltlikSaglayici s0 && s0.Id == "esri", "altlık: varsayılan Esri (anahtarsız)");
                for (int i = 0; i < lb.Items.Count; i++) if (lb.Items[i] is AltlikSaglayici s && s.Id == "google_s") lb.SelectedIndex = i;
                Bul<MetinKutusu>(f, m => m.Visible).Text = "deneme-anahtar";
                Bul<KoyuSecim>(f, r => r.Text.StartsWith("Yüksek", StringComparison.Ordinal)).Checked = true;
                Resim(f, "sonra");
            });

            // Şerit menü önizlemesi (AutoCAD olmadan; aynı veri ve simgelerle)
            Console.WriteLine("14-serit");
            SeritOnizleme.Hepsi(_klasor);
            HizliSecim.Yukle();
            var agHavai = Kategoriler.Bul("AG_HAVAI");
            Esit(true, agHavai != null && agHavai.Ogeler.Count >= 2 && agHavai.Ogeler[0].Ad == "AG Direk" && agHavai.Ogeler[1].Ad == "AG Hat", "şerit: AG Havai → AG Direk, AG Hat");
            var kisa = HizliSecim.KisaListe(agHavai.Ogeler[0]);
            Esit(true, kisa.Count >= 8 && kisa.TrueForAll(x => x.Rol == "ana" && x.Cins.StartsWith("AG_", StringComparison.Ordinal)), "şerit: AG Direk kısa tip listesi yalnız AG direkleri");
            var ogHat = Kategoriler.Oge("OG_HAVAI", "OG_HAT");
            Esit(true, HizliSecim.KisaListe(ogHat).TrueForAll(x => x.Cins == "OG_İLETKEN"), "şerit: OG Hat tipleri yalnız OG iletken");
        }

        // ---------------- Yardımcılar ----------------

        private static T Bul<T>(Control kok, Func<T, bool> kosul) where T : Control
        {
            foreach (Control c in kok.Controls)
            {
                if (c is T t && kosul(t)) return t;
                var ic = Bul(c, kosul);
                if (ic != null) return ic;
            }
            return null;
        }

        private static void Hepsi<T>(Control kok, List<T> liste) where T : Control
        {
            foreach (Control c in kok.Controls)
            {
                if (c is T t) liste.Add(t);
                Hepsi(c, liste);
            }
        }

        /// <summary>Pencerenin zamanlayıcıları çalışsın diye bekler (ör. eksik malzeme listesinin yenilenmesi).</summary>
        private static void Bekle(int ms)
        {
            var son = DateTime.Now.AddMilliseconds(ms);
            while (DateTime.Now < son)
            {
                Application.DoEvents();
                Thread.Sleep(20);
            }
            Application.DoEvents();
        }

        private static void Resim(Form f, string ek)
        {
            Application.DoEvents();
            f.Refresh();
            Application.DoEvents();
            using (var bmp = new Bitmap(f.Width, f.Height))
            {
                f.DrawToBitmap(bmp, new Rectangle(0, 0, f.Width, f.Height));
                string ad = _ad + (_sira++ > 0 || ek != null ? "-" + (ek ?? _sira.ToString(CultureInfo.InvariantCulture)) : "") + ".png";
                bmp.Save(Path.Combine(_klasor, ad), ImageFormat.Png);
                Console.WriteLine("    resim: " + ad + " (" + f.Width + "×" + f.Height + ")");
            }
        }

        private static readonly Stack<string> _icIce = new Stack<string>();

        private static DialogResult Goster(Form f, IWin32Window sahip)
        {
            f.StartPosition = FormStartPosition.Manual;
            f.Location = new Point(30 + _icIce.Count * 40, 30 + _icIce.Count * 40);
            f.Show();
            if (_icIce.Count == 0) Resim(f, null);
            else Resim(f, "ic" + _icIce.Count);
            var r = DialogResult.Cancel;
            if (_tamam)
            {
                if (_icIce.Count == 0 && _doldur != null)
                {
                    _icIce.Push(_ad);
                    try { _doldur(f); }
                    finally { _icIce.Pop(); }
                }
                var tamam = f.AcceptButton as Button;
                tamam?.PerformClick();
                r = f.DialogResult;
            }
            f.Hide();
            return r;
        }
    }
}
