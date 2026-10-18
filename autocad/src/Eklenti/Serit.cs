using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Autodesk.Windows;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
using AcRenk = Autodesk.AutoCAD.Colors;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// AutoCAD şerit menüsüne "ŞEBEKE HAKEDİŞ" sekmesini ekler. Çizim bağlama duyarlıdır:
    ///   Kategori (AG Havai, AG Yeraltı, OG Havai / ENH, …) → Hızlı Çizim paneli yalnız o kategorinin öğelerini gösterir
    ///   (ör. AG Havai: AG Direk, AG Hat, Kofre, Abone Hattı); öğeye tıklayınca pencere açılmadan çizime başlanır.
    ///   Seçim paneli etkin öğenin tiplerini (son kullanılanlar, çok kullanılanlar), durumu ve hakedişi gösterir.
    /// Kategori ve öğeler ortak/katalog/kategoriler.json'dan, tipler kalemler.json'un cins gruplarından gelir.
    /// Öğe simgeleri telefonun simge takımıyla (semboller.json) ve renkleriyle (cizim-stili.json) çizilir.
    /// </summary>
    internal static class Serit
    {
        private const string SekmeKimligi = "SEBEKE_HAKEDIS_SEKME";
        private static bool _bekliyor, _yukleniyor, _olayBagli;

        private static RibbonCombo _kategori, _tip, _durum, _dm, _hakedis;
        private static RibbonPanelSource _hizli;
        private static readonly List<RibbonToggleButton> _ogeDugmeleri = new List<RibbonToggleButton>();

        public static void Kur()
        {
            // Çalışma alanı değişince AutoCAD şeridi yeniden kurar; sekmemizi geri ekle.
            try { AcApp.SystemVariableChanged += SistemDegiskeniDegisti; } catch { }
            if (ComponentManager.Ribbon == null)
            {
                if (!_bekliyor)
                {
                    _bekliyor = true;
                    ComponentManager.ItemInitialized += SeritHazir;
                }
                return;
            }
            Olustur();
        }

        private static void SistemDegiskeniDegisti(object sender, Autodesk.AutoCAD.ApplicationServices.SystemVariableChangedEventArgs e)
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
            Olustur();
        }

        public static void Olustur()
        {
            RibbonControl serit = ComponentManager.Ribbon;
            if (serit == null) return;
            foreach (RibbonTab t in serit.Tabs)
                if (t.Id == SekmeKimligi) { serit.Tabs.Remove(t); break; }

            KatalogKaynagi.SembolleriYukle();
            KatalogKaynagi.StiliYukle();
            KatalogKaynagi.KategorileriYukle();
            HizliSecim.Yukle();
            if (!_olayBagli) { HizliSecim.Degisti += SecimDegisti; _olayBagli = true; }

            var sekme = new RibbonTab { Title = "ŞEBEKE HAKEDİŞ", Id = SekmeKimligi };
            serit.Tabs.Add(sekme);

            // 1) Kategori
            var kat = Panel(sekme, "Kategori");
            _kategori = new RibbonCombo { Width = 190, ShowText = false, ShowImage = true, Size = RibbonItemSize.Standard };
            foreach (var k in Kategoriler.Hepsi())
                _kategori.Items.Add(new RibbonButton
                {
                    Text = k.Ad, ShowText = true, ShowImage = true, Image = Simge(k.Kisa, HexRenk(k.Renk, Colors.SlateGray), 16), Tag = k,
                    ToolTip = k.Aciklama, Description = k.Aciklama,
                });
            _kategori.CurrentChanged += (s, e) => { if (!_yukleniyor) KategoriSecildi(_kategori.Current as RibbonButton); };
            kat.Items.Add(new RibbonLabel { Text = "Çizilecek şebeke" });
            kat.Items.Add(new RibbonRowBreak());
            kat.Items.Add(_kategori);
            kat.Items.Add(new RibbonRowBreak());
            kat.Items.Add(KucukDugme("Ayrıntılı…", "Etkin öğeyi süzgeçli, aramalı pencereyle çizer (tip listesinin tamamı, GIS numarası, demontaj türü).", "_SH_HIZLIAYRINTI ", "…", Color.FromRgb(0x4B, 0x55, 0x63)));

            // 2) Hızlı çizim (kategoriye göre dolar)
            _hizli = Panel(sekme, "Hızlı Çizim");

            // 3) Seçim: etkin öğenin tipi, durum, demontaj türü, hakediş
            var sec = Panel(sekme, "Seçim");
            _tip = new RibbonCombo { Width = 210, ShowText = false, Size = RibbonItemSize.Standard };
            _tip.CurrentChanged += (s, e) => { if (!_yukleniyor) TipSecildi(_tip.Current as RibbonButton); };
            _durum = new RibbonCombo { Width = 120, ShowText = false, Size = RibbonItemSize.Standard };
            foreach (var d in Turler.CizimDurumlari)
                _durum.Items.Add(new RibbonButton { Text = d, ShowText = true, Tag = d, ToolTip = Turler.DurumAdi(d), Description = Turler.DurumAdi(d) });
            _durum.CurrentChanged += (s, e) => { if (!_yukleniyor) DurumSecildi(); };
            _dm = new RibbonCombo { Width = 86, ShowText = false, Size = RibbonItemSize.Standard };
            foreach (var d in Turler.DmDurumlari) _dm.Items.Add(new RibbonButton { Text = d.Length == 0 ? "(yok)" : d, ShowText = true, Tag = d });
            _dm.CurrentChanged += (s, e) => { if (!_yukleniyor) DurumSecildi(); };
            _hakedis = new RibbonCombo { Width = 120, ShowText = false, Size = RibbonItemSize.Standard };
            _hakedis.Items.Add(new RibbonButton { Text = "Aktif hakediş", ShowText = true, Tag = 0, ToolTip = "Çizimin aktif hakedişi (SH_HAKEDIS)" });
            for (int i = 1; i <= 20; i++) _hakedis.Items.Add(new RibbonButton { Text = i.ToString(CultureInfo.InvariantCulture) + ". hakediş", ShowText = true, Tag = i });
            _hakedis.CurrentChanged += (s, e) => { if (!_yukleniyor) HakedisSecildi(); };
            sec.Items.Add(new RibbonLabel { Text = "Tip" });
            sec.Items.Add(_tip);
            sec.Items.Add(KucukDugme("Ara", "Etkin öğenin bütün tipleri arasından arayarak seçin.", null, "⌕", Color.FromRgb(0x37, 0x41, 0x51), TipAra));
            sec.Items.Add(new RibbonRowBreak());
            sec.Items.Add(new RibbonLabel { Text = "Durum" });
            sec.Items.Add(_durum);
            sec.Items.Add(_dm);
            sec.Items.Add(new RibbonRowBreak());
            sec.Items.Add(new RibbonLabel { Text = "Hakediş" });
            sec.Items.Add(_hakedis);

            // 4) Düzenle
            var duzen = Panel(sekme, "Düzenle");
            duzen.Items.Add(Dugme("Malzeme", "Seçilen direğin, hattın, kanalın ya da sondajın malzemelerini düzenler.", "_SH_MALZEME ", "MZ", Color.FromRgb(0x37, 0x41, 0x51)));
            duzen.Items.Add(Dugme("Metraj", "Seçilen hat, kanal ve sondajların metrajını çizim uzunluğundan yeniden hesaplar (parça metrajları yenilenir).", "_SH_METRAJ ", "MT", Color.FromRgb(0x4B, 0x55, 0x63)));
            duzen.Items.Add(Dugme("Telefon\nGörünümü", "Çizimi telefonun görünümüne çevirir: simgeler, renkler, hat etiketleri, her parçanın uzunluğu. Veriye dokunmaz.", "_SH_GORUNUM ", "TG", Color.FromRgb(0x0F, 0x76, 0x6E)));
            duzen.Items.Add(Dugme("Hakediş", "Aktif hakedişi değiştirir; yeni nesneler bu hakedişin katmanlarına konur.", "_SH_HAKEDIS ", "HK", Color.FromRgb(0x9D, 0x17, 0x4D)));
            duzen.Items.Add(Dugme("Ayarlar", "Katman ön eki, tarife (şehir / köy), sembol takımı, etiket yüksekliği, metraj payları.", "_SH_AYARLAR ", "AY", Color.FromRgb(0x6B, 0x6B, 0x6B)));

            // 5) Telefon
            var telefon = Panel(sekme, "Telefon");
            telefon.Items.Add(Dugme("Telefondan\nAl", "Telefondan gelen proje dosyasındaki (.sebeke.json, .volt.json ya da teslim paketi .zip) yeni ve değişen nesneleri bu çizime aktarır.", "_SH_PROJEAL ", "TA", Color.FromRgb(0x00, 0x7A, 0x87)));
            telefon.Items.Add(Dugme("Telefona\nGönder", "Bu çizimi telefonda açılacak proje dosyasına yazar (.sebeke.json ya da telefon biçimi .volt.json).", "_SH_ICEAL ", "TG", Color.FromRgb(0x2F, 0x55, 0x97)));

            // 6) Rapor
            var rapor = Panel(sekme, "Rapor");
            rapor.Items.Add(Dugme("Durum\nTespit", "Bu çizimden Durum Tespit raporunu Excel olarak üretir.", "_SH_RAPOR ", "DT", Color.FromRgb(0x1E, 0x7B, 0x4F)));
            rapor.Items.Add(Dugme("Dosyadan\nRapor", "Bir proje dosyasından (.sebeke.json, .volt.json ya da teslim paketi) Durum Tespit raporu üretir.", "_SH_PROJERAPOR ", "PR", Color.FromRgb(0x2E, 0x8B, 0x57)));
            rapor.Items.Add(Dugme("Proje\nÖzeti", "Çizimdeki bölge, direk, hat ve kanal sayılarını komut satırında gösterir.", "_SH_OZET ", "ÖZ", Color.FromRgb(0x3E, 0x7C, 0xB1)));

            // 7) Yardım
            var yardim = Panel(sekme, "Yardım");
            yardim.Items.Add(Dugme("Hakkında", "Sürüm ve komut listesi.", "_SH_HAKKINDA ", "?", Color.FromRgb(0x6B, 0x6B, 0x6B)));

            // Son seçimleri göster
            _yukleniyor = true;
            try
            {
                foreach (var it in _kategori.Items)
                {
                    var b = it as RibbonButton;
                    if (b != null && b.Tag == HizliSecim.Kategori) { _kategori.Current = b; break; }
                }
                if (_kategori.Current == null && _kategori.Items.Count > 0) _kategori.Current = _kategori.Items[0];
            }
            finally { _yukleniyor = false; }
            HizliPaneliKur(HizliSecim.Kategori);
            SecimiGoster();
        }

        // ---------------- Kategori → hızlı çizim öğeleri ----------------

        private static void KategoriSecildi(RibbonButton b)
        {
            var k = b != null ? b.Tag as MenuKategorisi : null;
            if (k == null) return;
            // Kategorinin ilk çizim öğesi etkin olur (kategori değişince eski öğe kalmaz)
            MenuOgesi oge = k.Ogeler.Find(x => x.TipliMi || x.Komut == "SH_KANAL") ?? (k.Ogeler.Count > 0 ? k.Ogeler[0] : null);
            _yukleniyor = true;
            try { HizliSecim.OgeSec(k, oge); }
            finally { _yukleniyor = false; }
            HizliPaneliKur(k);
            SecimiGoster();
        }

        private static void HizliPaneliKur(MenuKategorisi k)
        {
            if (_hizli == null) return;
            _hizli.Items.Clear();
            _ogeDugmeleri.Clear();
            _hizli.Title = k == null ? "Hızlı Çizim" : "Hızlı Çizim · " + k.Ad;
            if (k == null) return;
            foreach (var oge in k.Ogeler)
            {
                var d = new RibbonToggleButton
                {
                    Text = Satirla(oge.Ad),
                    ShowText = true,
                    ShowImage = true,
                    Size = RibbonItemSize.Large,
                    Orientation = System.Windows.Controls.Orientation.Vertical,
                    LargeImage = OgeSimgesi(oge, 32),
                    Image = OgeSimgesi(oge, 16),
                    ToolTip = OgeAciklamasi(oge),
                    Tag = oge,
                    IsChecked = oge == HizliSecim.Oge,
                    CommandParameter = oge,
                    CommandHandler = new OgeIsleyici(),
                };
                _ogeDugmeleri.Add(d);
                _hizli.Items.Add(d);
            }
        }

        private static string Satirla(string ad)
        {
            // İki kelimeli adlar iki satıra (büyük düğme altında okunur kalsın)
            int i = ad.IndexOf(' ');
            return i > 0 && ad.Length > 9 ? ad.Substring(0, i) + "\n" + ad.Substring(i + 1) : ad;
        }

        private static string OgeAciklamasi(MenuOgesi oge)
        {
            switch (oge.Komut)
            {
                case "SH_ELEMAN": return oge.Ad + ": tıklayın, sonra çizimde yerlerini gösterin (her tıklama bir eleman). Tip, durum ve hakediş Seçim panelinden.";
                case "SH_HAT": return oge.Ad + ": direkten direğe tıklayın; hat her direkte biter, her parçanın metrajı ayrı yazılır. Kesit Seçim panelinden.";
                case "SH_KANAL": return oge.Ad + ": kanal köşelerini gösterin; box / direk aralarında parçalanır. Zemin Seçim panelinden, ölçüler ayarlardan.";
                case "SH_SONDAJ": return oge.Ad + ": sondajın başını ve sonunu gösterin.";
                default: return oge.Ad;
            }
        }

        /// <summary>Öğe düğmesi: öğeyi etkin yapar, tip listesini yeniler ve hızlı çizimi başlatır.</summary>
        private sealed class OgeIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                var d = parameter as RibbonButton;
                var oge = d?.CommandParameter as MenuOgesi;
                if (oge == null) return;
                _yukleniyor = true;
                try { HizliSecim.OgeSec(oge.Kategori, oge); }
                finally { _yukleniyor = false; }
                foreach (var b in _ogeDugmeleri) b.IsChecked = b.Tag == oge;
                SecimiGoster();
                Gonder(oge.TipliMi || oge.Komut == "SH_KANAL" ? "_SH_HIZLI " : "_" + oge.Komut + " ");
            }
        }

        // ---------------- Seçim paneli ----------------

        private static void SecimDegisti()
        {
            if (_yukleniyor) return;
            try
            {
                foreach (var b in _ogeDugmeleri) b.IsChecked = b.Tag == HizliSecim.Oge;
                SecimiGoster();
            }
            catch { }
        }

        /// <summary>Etkin öğenin kısa tip listesini, durumu ve hakedişi şeritte gösterir.</summary>
        private static void SecimiGoster()
        {
            if (_tip == null) return;
            _yukleniyor = true;
            try
            {
                var oge = HizliSecim.Oge;
                _tip.Items.Clear();
                var liste = oge != null ? HizliSecim.KisaListe(oge) : new List<KatalogKalemi>();
                var secili = oge != null ? HizliSecim.SeciliTip(oge, HizliSecim.TemelKatalog) : null;
                RibbonButton cur = null;
                foreach (var it in liste)
                {
                    var b = new RibbonButton { Text = it.Tanim.Trim(), ShowText = true, Tag = it, ToolTip = it.Yazi, Description = HizliSecim.TemelKatalog.CinsAdi(it.Cins) };
                    _tip.Items.Add(b);
                    if (it == secili) cur = b;
                }
                if (liste.Count == 0) _tip.Items.Add(new RibbonButton { Text = oge == null ? "(öğe seçin)" : "(tip gerekmez)", ShowText = true });
                _tip.Current = cur ?? (_tip.Items.Count > 0 ? _tip.Items[0] : null);
                _tip.IsEnabled = liste.Count > 0;

                foreach (var it in _durum.Items) { var b = it as RibbonButton; if (b != null && (string)b.Tag == HizliSecim.Durum) { _durum.Current = b; break; } }
                foreach (var it in _dm.Items) { var b = it as RibbonButton; if (b != null && (string)b.Tag == (HizliSecim.DmDurum ?? "")) { _dm.Current = b; break; } }
                _dm.IsEnabled = Turler.DemontajMi(HizliSecim.Durum) && oge != null && oge.ElemanMi;
                foreach (var it in _hakedis.Items) { var b = it as RibbonButton; if (b != null && (int)b.Tag == HizliSecim.Hakedis) { _hakedis.Current = b; break; } }
            }
            finally { _yukleniyor = false; }
        }

        private static void TipSecildi(RibbonButton b)
        {
            var it = b != null ? b.Tag as KatalogKalemi : null;
            if (it == null || HizliSecim.Oge == null) return;
            _yukleniyor = true;
            try { HizliSecim.TipSec(HizliSecim.Oge, it); }
            finally { _yukleniyor = false; }
        }

        private static void DurumSecildi()
        {
            var d = _durum.Current as RibbonButton;
            var dm = _dm.Current as RibbonButton;
            _yukleniyor = true;
            try { HizliSecim.DurumSec(d != null ? (string)d.Tag : "M", dm != null ? (string)dm.Tag : ""); }
            finally { _yukleniyor = false; }
            _dm.IsEnabled = Turler.DemontajMi(HizliSecim.Durum) && HizliSecim.Oge != null && HizliSecim.Oge.ElemanMi;
        }

        private static void HakedisSecildi()
        {
            var h = _hakedis.Current as RibbonButton;
            _yukleniyor = true;
            try { HizliSecim.HakedisSec(h != null ? (int)h.Tag : 0); }
            finally { _yukleniyor = false; }
        }

        /// <summary>Etkin öğenin bütün tipleri arasından arayarak seçim (katalog penceresi).</summary>
        private static void TipAra()
        {
            var oge = HizliSecim.Oge;
            if (oge == null) return;
            var hepsi = HizliSecim.Tipler(oge, HizliSecim.TemelKatalog);
            if (hepsi.Count == 0) return;
            var it = Pencereler.KatalogdanSec("Tip seç — " + (oge.Kategori != null ? oge.Kategori.Ad + " › " : "") + oge.Ad, hepsi, null);
            if (it == null) return;
            HizliSecim.TipSec(oge, it);
        }

        // ---------------- Yardımcılar ----------------

        private static RibbonPanelSource Panel(RibbonTab sekme, string baslik)
        {
            var kaynak = new RibbonPanelSource { Title = baslik };
            sekme.Panels.Add(new RibbonPanel { Source = kaynak });
            return kaynak;
        }

        private static RibbonButton Dugme(string yazi, string aciklama, string komut, string harf, Color renk)
        {
            return new RibbonButton
            {
                Text = yazi,
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Large,
                Orientation = System.Windows.Controls.Orientation.Vertical,
                LargeImage = Simge(harf, renk, 32),
                Image = Simge(harf, renk, 16),
                ToolTip = aciklama,
                CommandParameter = komut,
                CommandHandler = new KomutIsleyici(),
            };
        }

        private static RibbonButton KucukDugme(string yazi, string aciklama, string komut, string harf, Color renk, Action is_ = null)
        {
            return new RibbonButton
            {
                Text = yazi,
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Standard,
                Orientation = System.Windows.Controls.Orientation.Horizontal,
                Image = Simge(harf, renk, 16),
                ToolTip = aciklama,
                CommandParameter = komut,
                Tag = is_,
                CommandHandler = new KomutIsleyici(),
            };
        }

        /// <summary>Komutu çalıştırır: önce çalışan komutu iptal eder (^C^C), sonra komutu gönderir.</summary>
        private static void Gonder(string komut)
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null || string.IsNullOrEmpty(komut)) return;
            belge.SendStringToExecute("\x03\x03" + komut, true, false, true);
        }

        private sealed class KomutIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                var dugme = parameter as RibbonButton;
                if (dugme == null) return;
                var is_ = dugme.Tag as Action;
                if (is_ != null)
                {
                    try { is_(); } catch (Exception ex) { Uygulama.Yaz("Şerit: " + ex.Message); }
                    return;
                }
                Gonder(dugme.CommandParameter as string);
            }
        }

        // ---------------- Simgeler ----------------

        /// <summary>Dosya gerektirmeyen basit düğme simgesi: renkli kare üzerinde kısa yazı.</summary>
        private static ImageSource Simge(string harf, Color renk, int boyut)
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
                        boyut * (harf.Length > 2 ? 0.34 : 0.42), Brushes.White);
#pragma warning restore 618
                    dc.DrawText(yazi, new Point((boyut - yazi.Width) / 2, (boyut - yazi.Height) / 2));
                }
            }
            return Resim(dv, boyut);
        }

        private static ImageSource Resim(DrawingVisual dv, int boyut)
        {
            var bmp = new RenderTargetBitmap(boyut, boyut, 96, 96, PixelFormats.Pbgra32);
            bmp.Render(dv);
            bmp.Freeze();
            return bmp;
        }

        private static Color HexRenk(string hex, Color varsayilan)
        {
            try
            {
                var o = ColorConverter.ConvertFromString(hex);
                return o is Color ? (Color)o : varsayilan;
            }
            catch { return varsayilan; }
        }

        /// <summary>AutoCAD renk numarası → ekran rengi (koyu zemin üstünde okunur; 7 beyaz).</summary>
        private static Color AciRenk(short aci)
        {
            try
            {
                var c = AcRenk.Color.FromColorIndex(AcRenk.ColorMethod.ByAci, aci).ColorValue;
                return Color.FromRgb(c.R, c.G, c.B);
            }
            catch { return Colors.White; }
        }

        private static readonly Color Zemin = Color.FromRgb(0x1F, 0x29, 0x37);

        /// <summary>Öğe simgesi: elemanlarda telefonun simgesi (yeni durum, telefondaki renk), hatlarda çizgi deseni.</summary>
        private static ImageSource OgeSimgesi(MenuOgesi oge, int boyut)
        {
            try
            {
                switch (oge.Komut)
                {
                    case "SH_ELEMAN":
                        {
                            string cins = oge.Cinsler.Count > 0 ? oge.Cinsler[0] : IlkCins(oge.Tur);
                            var s = Semboller.Bul(Semboller.BlokAdi(oge.Tur, cins, "M"));
                            if (s != null) return SembolCiz(s, AciRenk(CizimStili.ElemanRengi(oge.Tur, cins, "M")), boyut);
                            break;
                        }
                    case "SH_HAT":
                        {
                            var k = CizimStili.HatStili(oge.Tur);
                            return CizgiCiz(AciRenk(k != null ? k.Aci : (short)7), k != null ? CizimStili.CizgiDeseni(k.Cizgi) : null, boyut, true);
                        }
                    case "SH_KANAL": return KanalCiz(boyut);
                    case "SH_SONDAJ": return CizgiCiz(Color.FromRgb(0xF5, 0x9E, 0x0B), new[] { 2.0, -1.5 }, boyut, false);
                }
            }
            catch { }
            var kat = oge.Kategori;
            return Simge(string.IsNullOrEmpty(oge.Kisa) ? "?" : oge.Kisa, kat != null ? HexRenk(kat.Renk, Colors.SlateGray) : Colors.SlateGray, boyut);
        }

        private static string IlkCins(string tur)
        {
            var l = HizliSecim.TemelKatalog.ElemanCinsListesi(tur);
            return l.Count > 0 ? l[0] : "";
        }

        /// <summary>Simge takımındaki bir simgeyi (metre cinsinden ilkeller) koyu zemin üstüne çizer.</summary>
        private static ImageSource SembolCiz(Sembol s, Color renk, int boyut)
        {
            double enBuyuk = 0.5;
            Action<double, double> kapsa = (x, y) => enBuyuk = Math.Max(enBuyuk, Math.Max(Math.Abs(x), Math.Abs(y)));
            foreach (var i in s.Ilkeller)
            {
                var d = i.Sayilar;
                switch (i.Tur)
                {
                    case "L": if (d.Length >= 4) { kapsa(d[0], d[1]); kapsa(d[2], d[3]); } break;
                    case "C": if (d.Length >= 3) { kapsa(Math.Abs(d[0]) + d[2], Math.Abs(d[1]) + d[2]); } break;
                    case "D":
                    case "Y": if (d.Length >= 1) kapsa(d[0], d[0]); break;
                    default: foreach (var p in i.Noktalar) kapsa(p[0], p[1]); break;
                }
            }
            double c = boyut / 2.0, k = boyut * 0.40 / enBuyuk;
            Func<double, double, Point> P = (x, y) => new Point(c + x * k, c - y * k);
            var firca = new SolidColorBrush(renk);
            var kalem = new Pen(firca, Math.Max(1.0, boyut / 16.0));
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                double r0 = boyut / 6.0;
                dc.DrawRoundedRectangle(new SolidColorBrush(Zemin), null, new Rect(0.5, 0.5, boyut - 1, boyut - 1), r0, r0);
                foreach (var i in s.Ilkeller)
                {
                    var d = i.Sayilar;
                    switch (i.Tur)
                    {
                        case "L":
                            if (d.Length >= 4) dc.DrawLine(kalem, P(d[0], d[1]), P(d[2], d[3]));
                            break;
                        case "C":
                            if (d.Length >= 3) dc.DrawEllipse(null, kalem, P(d[0], d[1]), d[2] * k, d[2] * k);
                            break;
                        case "D":
                            if (d.Length >= 1) dc.DrawEllipse(firca, null, P(0, 0), d[0] * k, d[0] * k);
                            break;
                        case "Y":
                            if (d.Length >= 1)
                            {
                                double r = d[0] * k;
                                var g = new StreamGeometry();
                                using (var ctx = g.Open())
                                {
                                    ctx.BeginFigure(P(0, d[0]), true, true);
                                    ctx.ArcTo(P(0, -d[0]), new System.Windows.Size(r, r), 0, false, SweepDirection.Counterclockwise, true, false);
                                }
                                g.Freeze();
                                dc.DrawGeometry(firca, null, g);
                            }
                            break;
                        case "P":
                        case "S":
                            {
                                var nk = i.Noktalar;
                                if (nk.Count < 2) break;
                                // SOLID köşe sırası 1 2 4 3 → çokgen sırası 1 2 3 4
                                var sira = new List<double[]>(nk);
                                if (i.Tur == "S" && nk.Count >= 4) sira = new List<double[]> { nk[0], nk[1], nk[3], nk[2] };
                                var g = new StreamGeometry();
                                using (var ctx = g.Open())
                                {
                                    ctx.BeginFigure(P(sira[0][0], sira[0][1]), i.Tur == "S", i.Tur == "S" || i.Kapali);
                                    for (int n = 1; n < sira.Count; n++) ctx.LineTo(P(sira[n][0], sira[n][1]), true, false);
                                }
                                g.Freeze();
                                dc.DrawGeometry(i.Tur == "S" ? firca : null, i.Tur == "S" ? null : kalem, g);
                                break;
                            }
                    }
                }
            }
            return Resim(dv, boyut);
        }

        /// <summary>Hat simgesi: iki direk arasında hattın renginde ve deseninde çizgi.</summary>
        private static ImageSource CizgiCiz(Color renk, double[] desen, int boyut, bool direkler)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                double r0 = boyut / 6.0;
                dc.DrawRoundedRectangle(new SolidColorBrush(Zemin), null, new Rect(0.5, 0.5, boyut - 1, boyut - 1), r0, r0);
                var kalem = new Pen(new SolidColorBrush(renk), Math.Max(1.5, boyut / 12.0));
                if (desen != null && desen.Length >= 2)
                {
                    // Desen metre cinsinden (ör. 6 / -3); simgede kalem kalınlığı biriminde yarısı kadar
                    var l = new List<double>();
                    foreach (var x in desen) l.Add(Math.Max(0.5, Math.Abs(x) * 0.5));
                    kalem.DashStyle = new DashStyle(l, 0);
                }
                double m = boyut * 0.2;
                var a = new Point(m, boyut - m);
                var b = new Point(boyut - m, m);
                dc.DrawLine(kalem, a, b);
                if (direkler)
                {
                    var f = new SolidColorBrush(Color.FromRgb(0xE5, 0xE7, 0xEB));
                    double r = Math.Max(1.5, boyut / 10.0);
                    dc.DrawEllipse(f, null, a, r, r);
                    dc.DrawEllipse(f, null, b, r, r);
                }
            }
            return Resim(dv, boyut);
        }

        /// <summary>Kanal simgesi: kazı (iki kenar ve dolgu çizgileri).</summary>
        private static ImageSource KanalCiz(int boyut)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                double r0 = boyut / 6.0;
                dc.DrawRoundedRectangle(new SolidColorBrush(Zemin), null, new Rect(0.5, 0.5, boyut - 1, boyut - 1), r0, r0);
                var renk = AciRenk(1);
                var kalem = new Pen(new SolidColorBrush(renk), Math.Max(1.0, boyut / 16.0));
                double m = boyut * 0.22, w = boyut * 0.22;
                dc.DrawLine(kalem, new Point(m, m), new Point(m + w, boyut - m));
                dc.DrawLine(kalem, new Point(boyut - m - w, m), new Point(boyut - m, boyut - m));
                var ince = new Pen(new SolidColorBrush(Color.FromRgb(0xB4, 0x83, 0x4D)), Math.Max(1.0, boyut / 20.0));
                for (int i = 1; i <= 3; i++)
                {
                    double y = m + (boyut - 2 * m) * i / 4.0;
                    dc.DrawLine(ince, new Point(m + w * i / 4.0 + 2, y), new Point(boyut - m - w + w * (4 - i) / 4.0 - 2, y));
                }
            }
            return Resim(dv, boyut);
        }
    }
}
