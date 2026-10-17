using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.Windows;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

namespace SebekeHakedis.Eklenti
{
    /// <summary>Şeritten seçilen hızlı çizim işi (SH_CIZ komutu bunu okur).</summary>
    internal sealed class HizliSecim
    {
        /// <summary>true: hat, false: eleman.</summary>
        public bool Hat;
        /// <summary>Eleman türü (AG_DIREK…) ya da hat türü (AG_HAVAI…).</summary>
        public string Tur = "";
        /// <summary>Katalog kalemi (cins|tanım); boşsa katalog penceresi açılır.</summary>
        public string Anahtar = "";

        public override string ToString() => (Hat ? Turler.HatAdi(Tur) : Turler.ElemanAdi(Tur)) + (string.IsNullOrEmpty(Anahtar) ? "" : " · " + Anahtar.Substring(Anahtar.IndexOf('|') + 1));
    }

    /// <summary>
    /// AutoCAD şerit menüsündeki "ŞEBEKE HAKEDİŞ" sekmesi. Bağlama duyarlıdır: seçilen kategoriye (AG Havai, AG Yeraltı,
    /// OG Havai, ENH, OG Yeraltı, Aydınlatma, Trafo ve pano, Tümü) göre yalnız o kategorinin elemanları ve hatları
    /// gösterilir; her düğme üstten tıklanınca son kullanılan tiple hemen çizime geçer, aşağı okuyla sık kullanılan
    /// tipler ya da katalog seçilir. Kategori, durum ve hakediş açık çizime kaydedilir; çizim değişince şerit ona uyar.
    /// </summary>
    internal static class Serit
    {
        private const string SekmeKimligi = "SEBEKE_HAKEDIS_SEKME";
        private const string KatalogdanSec = "...";
        private const int ListeBoyu = 10;
        private static bool _bekliyor, _olaylarBagli, _susturuldu;
        private static Katalog _katalog;
        private static CizimAyarlari _ayar = new CizimAyarlari();
        private static RibbonCombo _kategoriKutusu, _durumKutusu, _hakedisKutusu;

        /// <summary>Şeritte seçili kategori (Kategoriler.Hepsi kodu); çizimden okunur, çizime yazılır.</summary>
        public static string Kategori => string.IsNullOrEmpty(_ayar.Kategori) ? Kategoriler.Genel : _ayar.Kategori;
        /// <summary>Şeritte seçili durum (hızlı çizimde kullanılır).</summary>
        public static string Durum => _ayar.SonDeger("serit.durum", "M");
        /// <summary>Şeritte seçili hakediş (0: çizimden).</summary>
        public static int Hakedis => _ayar.AktifHakedis;

        // ================= Kurulum =================

        public static void Kur()
        {
            if (!_olaylarBagli)
            {
                _olaylarBagli = true;
                // Çalışma alanı değişince AutoCAD şeridi yeniden kurar; sekmemizi geri ekle.
                try { AcApp.SystemVariableChanged += SistemDegiskeniDegisti; } catch { }
                // Başka çizime geçince şerit o çizimin kategori / durum / hakediş ayarını gösterir
                try { AcApp.DocumentManager.DocumentActivated += (s, e) => { AyarlariOku(e.Document); Olustur(); }; } catch { }
            }
            if (ComponentManager.Ribbon == null)
            {
                if (!_bekliyor)
                {
                    _bekliyor = true;
                    ComponentManager.ItemInitialized += SeritHazir;
                }
                return;
            }
            AyarlariOku(AcApp.DocumentManager.MdiActiveDocument);
            Olustur();
        }

        private static void SistemDegiskeniDegisti(object sender, SystemVariableChangedEventArgs e)
        {
            if (!string.Equals(e.Name, "WSCURRENT", StringComparison.OrdinalIgnoreCase)) return;
            AcApp.Idle += BostaYenidenKur;
        }

        private static void BostaYenidenKur(object sender, EventArgs e)
        {
            AcApp.Idle -= BostaYenidenKur;
            try
            {
                var serit = ComponentManager.Ribbon;
                if (serit == null) return;
                foreach (RibbonTab t in serit.Tabs) if (t.Id == SekmeKimligi) return;
                Olustur();
            }
            catch { }
        }

        private static void SeritHazir(object sender, RibbonItemEventArgs e)
        {
            if (ComponentManager.Ribbon == null) return;
            ComponentManager.ItemInitialized -= SeritHazir;
            _bekliyor = false;
            AyarlariOku(AcApp.DocumentManager.MdiActiveDocument);
            Olustur();
        }

        private static Katalog KatalogAl()
        {
            if (_katalog != null) return _katalog;
            try { _katalog = Katalog.Oku(KatalogKaynagi.Json(), null); }
            catch { _katalog = new Katalog(); }
            return _katalog;
        }

        // ================= Çizim ayarlarıyla bağ =================

        /// <summary>Açık çizimin ayarlarını okur (kategori, durum, hakediş). Çizim yoksa son bilinen kalır.</summary>
        private static void AyarlariOku(Document belge)
        {
            if (belge == null) return;
            try
            {
                using (belge.LockDocument()) _ayar = AyarDeposu.Oku(belge.Database);
            }
            catch { }
        }

        /// <summary>Şeritteki seçimi açık çizime yazar (kategori / durum / hakediş).</summary>
        private static void AyarlariYaz(Action<CizimAyarlari> degistir)
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            try
            {
                if (belge == null) { degistir(_ayar); return; }
                using (belge.LockDocument())
                {
                    var a = AyarDeposu.Oku(belge.Database);
                    degistir(a);
                    AyarDeposu.Yaz(belge.Database, a);
                    _ayar = a;
                }
            }
            catch (System.Exception ex) { Uygulama.Yaz("Şerit ayarı çizime yazılamadı: " + ex.Message); }
        }

        /// <summary>Komutlar ayar değiştirince (ör. SH_HAKEDIS, pencereden kategori) şerit yenilenir.</summary>
        public static void Yenile()
        {
            try
            {
                AyarlariOku(AcApp.DocumentManager.MdiActiveDocument);
                Olustur();
            }
            catch { }
        }

        // ================= Sekme =================

        public static void Olustur()
        {
            RibbonControl serit = ComponentManager.Ribbon;
            if (serit == null) return;
            _susturuldu = true;
            try { Kurgula(serit); }
            finally { _susturuldu = false; }
        }

        private static void Kurgula(RibbonControl serit)
        {
            bool aktifti = false;
            foreach (RibbonTab t in serit.Tabs)
                if (t.Id == SekmeKimligi) { aktifti = t.IsActive; serit.Tabs.Remove(t); break; }

            var sekme = new RibbonTab { Title = "ŞEBEKE HAKEDİŞ", Id = SekmeKimligi };
            serit.Tabs.Add(sekme);
            var kategori = Kategoriler.Bul(Kategori) ?? Kategoriler.Bul(Kategoriler.Genel);

            SecimPaneli(sekme, kategori);
            ElemanPaneli(sekme, kategori);
            HatPaneli(sekme, kategori);
            if (kategori.Kanal || kategori.Sondaj) KanalPaneli(sekme, kategori);

            var telefon = Panel(sekme, "Telefon");
            telefon.Items.Add(Dugme("Telefondan\nAl", "Telefondan gelen proje dosyasındaki (.sebeke.json, .volt.json ya da teslim paketi .zip) yeni ve değişen nesneleri bu çizime aktarır.", "_SH_PROJEAL ", "TA", Color.FromRgb(0x00, 0x7A, 0x87)));
            telefon.Items.Add(Dugme("Telefona\nGönder", "Bu çizimi telefonda açılacak proje dosyasına yazar (.sebeke.json ya da telefon biçimi .volt.json).", "_SH_ICEAL ", "TG", Color.FromRgb(0x2F, 0x55, 0x97)));

            var duzen = Panel(sekme, "Düzenle");
            duzen.Items.Add(Dugme("Malzeme", "Seçilen direğin, hattın, kanalın ya da sondajın malzemelerini düzenler.", "_SH_MALZEME ", "MZ", Color.FromRgb(0x37, 0x41, 0x51)));
            duzen.Items.Add(Dugme("Metraj", "Seçilen hat, kanal ve sondajların metrajını çizim uzunluğundan yeniden hesaplar.", "_SH_METRAJ ", "MT", Color.FromRgb(0x4B, 0x55, 0x63)));
            duzen.Items.Add(Dugme("Bölge", "Bölge (alt proje) sınırı çizer ya da var olan kapalı çizgiyi bölge yapar.", "_SH_BOLGE ", "BL", Color.FromRgb(0xA1, 0x62, 0x07)));
            duzen.Items.Add(Dugme("Nokta\nAl", "Ölçü noktalarını dosyadan (CSV/TXT) GPS noktası olarak alır.", "_SH_NOKTAAL ", "NK", Color.FromRgb(0x0E, 0x74, 0x90)));
            duzen.Items.Add(Dugme("Telefon\nGörünümü", "Var olan çizimi telefon uygulamasının görünümüne getirir: renkler, çizgi tipleri, simgeler, yazılar, açıklık uzunlukları (SH_STIL).", "_SH_STIL ", "TG", Color.FromRgb(0x23, 0xA4, 0x55)));
            duzen.Items.Add(Dugme("Ayarlar", "Katman ön eki, sembol ölçeği, yazı yüksekliği, metraj payları, tarife seçenekleri.", "_SH_AYARLAR ", "AY", Color.FromRgb(0x6B, 0x6B, 0x6B)));

            var rapor = Panel(sekme, "Rapor");
            rapor.Items.Add(Dugme("Durum\nTespit", "Bu çizimden Durum Tespit raporunu Excel olarak üretir.", "_SH_RAPOR ", "DT", Color.FromRgb(0x1E, 0x7B, 0x4F)));
            rapor.Items.Add(Dugme("Dosyadan\nRapor", "Bir proje dosyasından (.sebeke.json, .volt.json ya da teslim paketi) Durum Tespit raporu üretir.", "_SH_PROJERAPOR ", "PR", Color.FromRgb(0x2E, 0x8B, 0x57)));
            rapor.Items.Add(Dugme("Proje\nÖzeti", "Çizimdeki bölge, direk, hat ve kanal sayılarını komut satırında gösterir.", "_SH_OZET ", "ÖZ", Color.FromRgb(0x3E, 0x7C, 0xB1)));
            rapor.Items.Add(Dugme("Hakkında", "Sürüm ve komut listesi.", "_SH_HAKKINDA ", "?", Color.FromRgb(0x6B, 0x6B, 0x6B)));

            if (aktifti) { try { serit.ActiveTab = sekme; } catch { } }
        }

        // ================= Paneller =================

        /// <summary>Kategori · durum · hakediş kutuları (üç satır).</summary>
        private static void SecimPaneli(RibbonTab sekme, Kategori kategori)
        {
            var kaynak = Panel(sekme, "Çizim");
            var satirlar = new RibbonRowPanel();

            _kategoriKutusu = new RibbonCombo { Text = "Kategori", ShowText = true, Width = 190, MinWidth = 190, ToolTip = "Çizim kategorisi: şeritte yalnız bu kategorinin eleman ve hatları görünür; tarifenin unsur hanesi buradan gelir." };
            foreach (var k in Kategoriler.Hepsi) _kategoriKutusu.Items.Add(new RibbonButton { Text = k.Ad, Tag = k.Kod, ShowText = true });
            _kategoriKutusu.Current = Bul(_kategoriKutusu, kategori.Kod);
            _kategoriKutusu.CurrentChanged += (s, e) =>
            {
                if (_susturuldu) return;
                var b = _kategoriKutusu.Current as RibbonButton;
                if (b == null) return;
                string kod = Convert.ToString(b.Tag);
                if (kod == Kategori) return;
                AyarlariYaz(a => a.Kategori = kod == Kategoriler.Genel ? "" : kod);
                Olustur();
            };
            satirlar.Items.Add(_kategoriKutusu);
            satirlar.Items.Add(new RibbonRowBreak());

            _durumKutusu = new RibbonCombo { Text = "Durum", ShowText = true, Width = 190, MinWidth = 190, ToolTip = "Yeni çizilen nesnelerin durumu (PROMAGIS kodu)." };
            foreach (var d in Turler.Durumlar) _durumKutusu.Items.Add(new RibbonButton { Text = d + " — " + Turler.DurumAdi(d), Tag = d, ShowText = true });
            _durumKutusu.Current = Bul(_durumKutusu, Durum) ?? Bul(_durumKutusu, "M");
            _durumKutusu.CurrentChanged += (s, e) =>
            {
                if (_susturuldu) return;
                var b = _durumKutusu.Current as RibbonButton;
                if (b == null) return;
                string d = Convert.ToString(b.Tag);
                AyarlariYaz(a => { a.Son["serit.durum"] = d; a.Son["eleman.durum"] = d; a.Son["hat.durum"] = d; });
            };
            satirlar.Items.Add(_durumKutusu);
            satirlar.Items.Add(new RibbonRowBreak());

            _hakedisKutusu = new RibbonCombo { Text = "Hakediş", ShowText = true, Width = 190, MinWidth = 190, ToolTip = "Aktif hakediş: yeni nesneler bu hakedişin katmanlarına konur (SH_HAKEDIS ile de değişir)." };
            int hak = Math.Max(1, Hakedis);
            for (int i = 1; i <= Math.Max(30, hak + 5); i++) _hakedisKutusu.Items.Add(new RibbonButton { Text = i + ". hakediş", Tag = i, ShowText = true });
            _hakedisKutusu.Current = Bul(_hakedisKutusu, hak);
            _hakedisKutusu.CurrentChanged += (s, e) =>
            {
                if (_susturuldu) return;
                var b = _hakedisKutusu.Current as RibbonButton;
                if (b == null) return;
                int h = Convert.ToInt32(b.Tag);
                AyarlariYaz(a => a.AktifHakedis = h);
            };
            satirlar.Items.Add(_hakedisKutusu);
            kaynak.Items.Add(satirlar);
        }

        private static RibbonButton Bul(RibbonCombo kutu, object tag)
        {
            foreach (var it in kutu.Items)
            {
                var b = it as RibbonButton;
                if (b != null && Equals(b.Tag, tag)) return b;
            }
            return null;
        }

        private static void ElemanPaneli(RibbonTab sekme, Kategori kategori)
        {
            var kaynak = Panel(sekme, kategori.Kod == Kategoriler.Genel ? "Elemanlar" : kategori.Ad + " — elemanlar");
            var katalog = KatalogAl();
            foreach (var kod in kategori.Elemanlar)
            {
                var tur = Turler.Eleman(kod);
                if (tur == null) continue;
                var tipler = katalog.AnaTipler(kod);
                kaynak.Items.Add(AyrikDugme(false, tur.Kod, tur.Ad, tipler, _ayar.SonDeger("eleman.tip." + kod, null),
                    Simge(ElemanSimgesi(tur.Kod), 32), Simge(ElemanSimgesi(tur.Kod), 16),
                    tur.Ad + ": üstten tıklayınca son kullanılan tiple yerleştirmeye başlar; aşağı oktan sık kullanılan tipler ya da katalog seçilir."));
            }
        }

        private static void HatPaneli(RibbonTab sekme, Kategori kategori)
        {
            if (kategori.Hatlar.Length == 0) return;
            var kaynak = Panel(sekme, kategori.Kod == Kategoriler.Genel ? "Hatlar" : kategori.Ad + " — hatlar");
            var katalog = KatalogAl();
            foreach (var kod in kategori.Hatlar)
            {
                var tur = Turler.Hat(kod);
                if (tur == null) continue;
                string ad = kategori.Kod == Kategoriler.Genel ? tur.Ad + "\nHat" : HatDugmeAdi(kategori, kod);
                var kesitler = katalog.HatKesitleri(kod);
                kaynak.Items.Add(AyrikDugme(true, tur.Kod, ad, kesitler, _ayar.SonDeger("hat.kesit." + kod, null),
                    HatSimgesi(kod, 32), HatSimgesi(kod, 16),
                    tur.Ad + " hattı: direkten direğe parça parça çizilir (her direkte hat biter, yenisi başlar); metraj ve etiket kendiliğinden yazılır."));
            }
        }

        /// <summary>Kategori içinde kısa ad: AG Havai'de "AG Hat", OG Havai'de "OG Hat", müşterek "Müşterek Hat", rekortman "Rekortman".</summary>
        private static string HatDugmeAdi(Kategori kategori, string kod)
        {
            switch (kod)
            {
                case "AG_HAVAI": return "AG\nHat";
                case "AG_YERALTI": return "AG\nKablo";
                case "OG_HAVAI": return kategori.Kod == "ENH" ? "ENH\nHat" : "OG\nHat";
                case "OG_YERALTI": return "OG\nKablo";
                case "AYDINLATMA": return "Aydınlatma\nHattı";
                case "REKORTMAN": return "Rekortman\n(abone)";
                case "MUSTEREK": return "Müşterek\nHat";
            }
            return Turler.HatAdi(kod);
        }

        private static void KanalPaneli(RibbonTab sekme, Kategori kategori)
        {
            var kaynak = Panel(sekme, "Yeraltı");
            if (kategori.Kanal) kaynak.Items.Add(Dugme("Kanal", "Kablo kanalı çizer; hacim kanal ölçülerinden hesaplanır (SDK'dan SDK'ya parça parça çizin).", "_SH_KANAL ", "KN", Color.FromRgb(0x8B, 0x5A, 0x2B)));
            if (kategori.Sondaj) kaynak.Items.Add(Dugme("Sondaj", "Yatay sondaj (delgi) çizer.", "_SH_SONDAJ ", "SN", Color.FromRgb(0x6D, 0x28, 0xD9)));
        }

        private static RibbonPanelSource Panel(RibbonTab sekme, string baslik)
        {
            var kaynak = new RibbonPanelSource { Title = baslik };
            sekme.Panels.Add(new RibbonPanel { Source = kaynak });
            return kaynak;
        }

        // ================= Düğmeler =================

        private static RibbonButton Dugme(string yazi, string aciklama, string komut, string harf, Color renk)
        {
            return new RibbonButton
            {
                Text = yazi,
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Large,
                Orientation = System.Windows.Controls.Orientation.Vertical,
                LargeImage = Harfli(harf, renk, 32),
                Image = Harfli(harf, renk, 16),
                ToolTip = aciklama,
                CommandParameter = komut,
                CommandHandler = new KomutIsleyici(),
            };
        }

        /// <summary>
        /// Ayrık düğme: üst kısım son kullanılan tiple hemen çizime geçer (tip yoksa katalog penceresi); aşağı ok sık
        /// kullanılan tipleri (katalog sırası: çizimde sık kullanılanlar önce) ve "Katalogdan seç…" seçeneğini listeler.
        /// </summary>
        private static RibbonSplitButton AyrikDugme(bool hat, string tur, string ad, List<KatalogKalemi> tipler, string sonAnahtar, ImageSource buyuk, ImageSource kucuk, string aciklama)
        {
            var sb = new RibbonSplitButton
            {
                Text = ad,
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Large,
                Orientation = System.Windows.Controls.Orientation.Vertical,
                IsSplit = true,
                IsSynchronizedWithCurrentItem = false,
                ListStyle = RibbonSplitButtonListStyle.Descriptive,
                ListImageSize = RibbonImageSize.Standard,
                LargeImage = buyuk,
                Image = kucuk,
                ToolTip = aciklama,
            };
            KatalogKalemi son = null;
            if (!string.IsNullOrEmpty(sonAnahtar))
            {
                son = tipler.Find(x => x.Anahtar == sonAnahtar) ?? KatalogAl().Kalemler.Find(x => x.Anahtar == sonAnahtar);
            }
            var liste = new List<KatalogKalemi>();
            if (son != null) liste.Add(son);
            foreach (var t in tipler) { if (liste.Count >= ListeBoyu) break; if (!liste.Contains(t)) liste.Add(t); }
            foreach (var t in liste)
            {
                sb.Items.Add(new RibbonButton
                {
                    Text = t.Tanim,
                    Description = TipAciklamasi(t) + (t == son ? "  (son kullanılan)" : ""),
                    ShowText = true,
                    ShowImage = true,
                    Image = kucuk,
                    LargeImage = buyuk,
                    CommandParameter = new HizliSecim { Hat = hat, Tur = tur, Anahtar = t.Anahtar },
                    CommandHandler = new HizliIsleyici(),
                });
            }
            sb.Items.Add(new RibbonSeparator());
            sb.Items.Add(new RibbonButton
            {
                Text = "Katalogdan seç" + KatalogdanSec,
                Description = (hat ? "Tüm kesitler" : "Tüm tipler") + " (" + tipler.Count + ") · yazarak arama",
                ShowText = true,
                ShowImage = true,
                Image = Harfli("…", Color.FromRgb(0x6B, 0x6B, 0x6B), 16),
                LargeImage = Harfli("…", Color.FromRgb(0x6B, 0x6B, 0x6B), 32),
                CommandParameter = new HizliSecim { Hat = hat, Tur = tur, Anahtar = "" },
                CommandHandler = new HizliIsleyici(),
            });
            // Üst kısım: son kullanılan tip; yoksa katalog
            sb.CommandParameter = new HizliSecim { Hat = hat, Tur = tur, Anahtar = son != null ? son.Anahtar : "" };
            sb.CommandHandler = new HizliIsleyici();
            if (son != null) sb.Text = ad + "\n" + Kisa(son.Tanim);
            return sb;
        }

        private static string Kisa(string s) => string.IsNullOrEmpty(s) ? "" : s.Length <= 14 ? s : s.Substring(0, 13) + "…";

        private static string TipAciklamasi(KatalogKalemi t)
        {
            var parca = new List<string> { t.Cins };
            if (t.Katsayi > 0 && t.Birim.EndsWith("/kg", StringComparison.Ordinal)) parca.Add(t.Katsayi.ToString("0.##", CultureInfo.InvariantCulture) + " kg");
            if (!string.IsNullOrEmpty(t.Poz)) parca.Add("poz " + t.Poz);
            if (!string.IsNullOrEmpty(t.Tarife)) parca.Add("tarife " + t.Tarife);
            return string.Join(" · ", parca);
        }

        // ================= Simgeler =================

        /// <summary>Dosya gerektirmeyen basit düğme simgesi: renkli kare üzerinde iki harf.</summary>
        private static ImageSource Harfli(string harf, Color renk, int boyut)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                double r = boyut / 6.0;
                dc.DrawRoundedRectangle(new SolidColorBrush(renk), null, new Rect(0.5, 0.5, boyut - 1, boyut - 1), r, r);
                if (boyut >= 24 || harf.Length == 1)
                {
#pragma warning disable 618
                    var yazi = new FormattedText(harf, CultureInfo.InvariantCulture, FlowDirection.LeftToRight,
                        new Typeface(new FontFamily("Segoe UI"), FontStyles.Normal, FontWeights.Bold, FontStretches.Normal),
                        boyut * 0.42, Brushes.White);
#pragma warning restore 618
                    dc.DrawText(yazi, new Point((boyut - yazi.Width) / 2, (boyut - yazi.Height) / 2));
                }
            }
            return Donmus(dv, boyut);
        }

        private static ImageSource Donmus(DrawingVisual dv, int boyut)
        {
            var bmp = new RenderTargetBitmap(boyut, boyut, 96, 96, PixelFormats.Pbgra32);
            bmp.Render(dv);
            bmp.Freeze();
            return bmp;
        }

        /// <summary>Telefonun lejant renkleri (ekran): AG yeşil, OG kırmızı, aydınlatma mavi, trafo/SDK mor-mavi, diğer gri.</summary>
        private static Color ElemanRengi(string tur)
        {
            switch (tur)
            {
                case "AG_DIREK": return Color.FromRgb(0x23, 0xA4, 0x55);
                case "MUSTEREK_DIREK":
                case "ENH_DIREK": return Color.FromRgb(0xD9, 0x2B, 0x2B);
                case "AYD_DIREK": return Color.FromRgb(0x2F, 0x7F, 0xD6);
                case "TRAFO_DIREGI":
                case "TRAFO_MERKEZI": return Color.FromRgb(0x1F, 0x3A, 0xE8);
                case "PANO":
                case "BOX": return Color.FromRgb(0x1F, 0x3A, 0xE8);
                case "EK_MUFU": return Color.FromRgb(0xD9, 0x2B, 0x2B);
                default: return Color.FromRgb(0x55, 0x55, 0x55);
            }
        }

        private static Color HatRengi(string tur)
        {
            switch (tur)
            {
                case "OG_HAVAI": case "OG_YERALTI": return Color.FromRgb(0xD9, 0x2B, 0x2B);
                case "AG_YERALTI": return Color.FromRgb(0xD9, 0x2B, 0x2B);
                case "AYDINLATMA": return Color.FromRgb(0x00, 0xA8, 0xC8);
                default: return Color.FromRgb(0x1F, 0x7F, 0x00); // AG havai, müşterek, rekortman
            }
        }

        /// <summary>Eleman simgesi: lejant sembolü (SH_…_YENI) kategorinin renginde çizilir — çizimdekiyle aynı şekil.</summary>
        private static DrawingVisual ElemanSimgesi(string tur)
        {
            var dv = new DrawingVisual();
            var renk = ElemanRengi(tur);
            Sembol sembol = null;
            try { KatalogKaynagi.SembolleriYukle(); sembol = Semboller.Bul(Semboller.OnEk + Semboller.Aile(tur, OrnekCins(tur)) + "_YENI"); } catch { }
            using (var dc = dv.RenderOpen())
            {
                dc.DrawRoundedRectangle(Brushes.White, new Pen(new SolidColorBrush(Color.FromRgb(0xC8, 0xC8, 0xC8)), 1), new Rect(0.5, 0.5, 31, 31), 4, 4);
                if (sembol == null) return dv;
                double yg = Math.Max(0.5, sembol.YariGenislik);
                double k = 12.5 / yg; // metre → piksel (32 px karede 25 px)
                var kalem = new Pen(new SolidColorBrush(renk), 1.6) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round };
                var dolgu = new SolidColorBrush(renk);
                Func<double, double, Point> P = (x, y) => new Point(16 + x * k, 16 - y * k);
                foreach (var i in sembol.Ilkeller)
                {
                    var d = i.Sayilar;
                    switch (i.Tur)
                    {
                        case "L": if (d.Length >= 4) dc.DrawLine(kalem, P(d[0], d[1]), P(d[2], d[3])); break;
                        case "C": if (d.Length >= 3) dc.DrawEllipse(null, kalem, P(d[0], d[1]), d[2] * k, d[2] * k); break;
                        case "D": if (d.Length >= 1) dc.DrawEllipse(dolgu, null, P(0, 0), d[0] * k / 2, d[0] * k / 2); break;
                        case "Y":
                            if (d.Length >= 1)
                            {
                                double r = d[0] * k / 2;
                                var g = new StreamGeometry();
                                using (var gc = g.Open())
                                {
                                    gc.BeginFigure(P(0, d[0] / 2), true, true);
                                    gc.ArcTo(P(0, -d[0] / 2), new Size(r, r), 0, false, SweepDirection.Counterclockwise, true, true);
                                }
                                dc.DrawGeometry(dolgu, null, g);
                            }
                            break;
                        case "P":
                        case "S":
                            if (i.Noktalar.Count >= 2)
                            {
                                var g = new StreamGeometry();
                                using (var gc = g.Open())
                                {
                                    gc.BeginFigure(P(i.Noktalar[0][0], i.Noktalar[0][1]), i.Tur == "S", i.Kapali || i.Tur == "S");
                                    for (int n = 1; n < i.Noktalar.Count; n++) gc.LineTo(P(i.Noktalar[n][0], i.Noktalar[n][1]), true, true);
                                }
                                dc.DrawGeometry(i.Tur == "S" ? dolgu : null, kalem, g);
                            }
                            break;
                    }
                }
            }
            return dv;
        }

        /// <summary>Simge için örnek malzeme: beton direk görünümü (kafes için cins DEMİR olmalı).</summary>
        private static string OrnekCins(string tur)
        {
            switch (tur)
            {
                case "AG_DIREK": return "AG_BETON";
                case "MUSTEREK_DIREK": return "MÜŞ_DEMİR_GLV";
                case "ENH_DIREK": return "ENH_DEMİR_GLV";
                case "TRAFO_MERKEZI": return "BETON_KÖŞKLER";
                default: return "";
            }
        }

        private static ImageSource Simge(DrawingVisual dv32, int boyut)
        {
            if (boyut == 32) return Donmus(dv32, 32);
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                dc.PushTransform(new ScaleTransform(boyut / 32.0, boyut / 32.0));
                dc.DrawDrawing(dv32.Drawing);
                dc.Pop();
            }
            return Donmus(dv, boyut);
        }

        /// <summary>Hat simgesi: kategorinin renginde çizgi (yeraltı nokta-çizgi, rekortman kesikli), uçlarda direk noktaları.</summary>
        private static ImageSource HatSimgesi(string tur, int boyut)
        {
            var dv = new DrawingVisual();
            var renk = HatRengi(tur);
            using (var dc = dv.RenderOpen())
            {
                double s = boyut / 32.0;
                dc.DrawRoundedRectangle(Brushes.White, new Pen(new SolidColorBrush(Color.FromRgb(0xC8, 0xC8, 0xC8)), 1), new Rect(0.5, 0.5, boyut - 1, boyut - 1), 4 * s, 4 * s);
                var kalem = new Pen(new SolidColorBrush(renk), 2.2 * s) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
                if (tur == "AG_YERALTI" || tur == "OG_YERALTI") kalem.DashStyle = new DashStyle(new double[] { 3, 1.2, 0.3, 1.2 }, 0);
                else if (tur == "REKORTMAN") kalem.DashStyle = new DashStyle(new double[] { 2.2, 1.2 }, 0);
                dc.DrawLine(kalem, new Point(6 * s, 23 * s), new Point(26 * s, 9 * s));
                var dolgu = new SolidColorBrush(renk);
                dc.DrawEllipse(dolgu, null, new Point(6 * s, 23 * s), 3 * s, 3 * s);
                dc.DrawEllipse(dolgu, null, new Point(26 * s, 9 * s), 3 * s, 3 * s);
            }
            return Donmus(dv, boyut);
        }

        // ================= Komut işleyiciler =================

        private sealed class KomutIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                var dugme = parameter as RibbonButton;
                var komut = dugme?.CommandParameter as string;
                var belge = AcApp.DocumentManager.MdiActiveDocument;
                if (belge == null || string.IsNullOrEmpty(komut)) return;
                belge.SendStringToExecute(komut, true, false, true);
            }
        }

        /// <summary>Hızlı çizim: seçimi bekletir, SH_CIZ komutunu başlatır (komut seçimi alır ve çizime geçer).</summary>
        private sealed class HizliIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                var dugme = parameter as RibbonCommandItem;
                var secim = dugme?.CommandParameter as HizliSecim;
                var belge = AcApp.DocumentManager.MdiActiveDocument;
                if (belge == null || secim == null) return;
                HizliCizim.Bekleyen = secim;
                belge.SendStringToExecute("_SH_CIZ ", true, false, true);
            }
        }
    }

    /// <summary>Şeritten gelen hızlı çizim isteği (tek seferlik).</summary>
    internal static class HizliCizim
    {
        public static HizliSecim Bekleyen;

        public static HizliSecim Al()
        {
            var s = Bekleyen;
            Bekleyen = null;
            return s;
        }
    }
}
