using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Autodesk.Windows;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

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
                    Text = k.Ad, ShowText = true, ShowImage = true, Image = SeritSimgeleri.KategoriSimgesi(k, 16), LargeImage = SeritSimgeleri.KategoriSimgesi(k, 32), Tag = k,
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
            sec.Items.Add(KucukDugme("Ara", "Etkin öğenin bütün tipleri arasından arayarak seçin.", null, "A", Color.FromRgb(0x37, 0x41, 0x51), TipAra));
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
            duzen.Items.Add(Dugme("Hakediş\nOnayı", "Hakediş onayı (PROMAGIS'teki gibi Kontrol → Hakediş → GIS). Onaylanan hakediş kilitlenir: satırları değiştirilemez, o hakedişe yeni nesne çizilemez.", "_SH_ONAY ", "ON", Color.FromRgb(0x15, 0x80, 0x3D)));
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
            rapor.Items.Add(Dugme("Eksik\nMalzeme", "Eksik malzeme bul (PROMAGIS DETAY sorgusu): ör. topraklaması olmayan direkler. Bulunanlar çizimde seçilir, istenirse Excel'e yazılır.", "_SH_DETAY ", "EK", Color.FromRgb(0xB4, 0x53, 0x09)));

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
            var hepsi = HizliSecim.Tipler(oge, HizliSecim.TemelKatalog, true);
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

        // ---------------- Simgeler (SeritSimgeleri: denemede de çizilir) ----------------

        private static ImageSource Simge(string harf, Color renk, int boyut) => SeritSimgeleri.Simge(harf, renk, boyut);

        private static Color HexRenk(string hex, Color varsayilan) => SeritSimgeleri.HexRenk(hex, varsayilan);

        private static ImageSource OgeSimgesi(MenuOgesi oge, int boyut) => SeritSimgeleri.OgeSimgesi(oge, boyut);
    }
}
