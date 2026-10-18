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
            o.Doldur(v, PromagisOkuyucu.Oku(v, "ornek.dwg"), new CizimAyarlari());
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

            Dene("04-kanal", () =>
            {
                var s = Pencereler.Kanal(o, null);
                Esit(true, s != null, "kanal: döner");
                Esit(KanalKodu.AG, s != null ? s.Kod : -1, "kanal: varsayılan kablo AG");
                Esit(40.0, s != null ? s.Alt : 0, "kanal: alt genişlik varsayılanı");
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
            }, f =>
            {
                var dom = Bul<KoyuSecim>(f, r => r.Text == "39°");
                dom.Checked = true;
                var sekme = Bul<Sekmeler>(f, x => true);
                string[] adlar = { "genel", "tarife", "gorunum", "metraj" };
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
            }, f =>
            {
                var sayilar = new List<SayiKutusu>();
                Hepsi(f, sayilar);
                sayilar[0].Value = 60;
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

            // Eksik malzeme sorgusu (PROMAGIS DETAY): aranan cins yazılınca tip listesi o cinsin tipleriyle dolar
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

            // Hakediş onayı (PROMAGIS HAK_ONAY): sıra kuralı Kontrol → Hakediş → GIS
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
                    "Şebeke Hakediş", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2, Goster);
                Esit(DialogResult.No, r, "ileti: varsayılan düğme Hayır");
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
