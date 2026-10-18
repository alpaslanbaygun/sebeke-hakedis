using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Windows.Input;
using System.Windows.Media;
using Autodesk.Windows;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// AutoCAD şerit menüsüne "ŞEBEKE HAKEDİŞ" sekmesini ekler (Google Stitch tasarımı):
    ///   Kategori   — AG Havai, AG Yeraltı, OG Havai / ENH … düğmeleri (sütunlar: havai | yeraltı | diğer | proje); tek tıkla seçilir.
    ///   Elemanlar  — yalnız seçili kategorinin öğeleri (ör. AG Havai: AG Direk, AG Hat, Kofre, Abone Hattı); öğeye tıklayınca
    ///                pencere açılmadan çizime başlanır.
    ///   Ayarlar    — etkin öğenin tipi (son kullanılanlar önde, "Ara" ile bütün tipler), durum, hakediş, demontaj türü ve
    ///                "sıradaki tıklamada ne çizilecek" özeti; Ayrıntılı… süzgeçli pencereyi açar.
    ///   Düzenle, Hakediş, Telefon, Rapor, Yardım — diğer komutlar.
    /// Kategori ve öğeler ortak/katalog/kategoriler.json'dan, tipler kalemler.json'un cins gruplarından gelir.
    /// Şeridin zemin rengi AutoCAD'in temasından gelir; simgeler koyu ve açık temaya göre çizilir.
    /// </summary>
    internal static class Serit
    {
        private const string SekmeKimligi = "SEBEKE_HAKEDIS_SEKME";
        private static bool _bekliyor, _yukleniyor, _olayBagli;

        private static RibbonCombo _tip, _durum, _dm, _hakedis;
        private static RibbonTextBox _ara;
        private static RibbonLabel _ozet, _dmEtiket;
        private static RibbonPanelSource _elemanlar;
        private static readonly List<RibbonToggleButton> _kategoriDugmeleri = new List<RibbonToggleButton>();
        private static readonly List<RibbonToggleButton> _ogeDugmeleri = new List<RibbonToggleButton>();
        /// <summary>"Ara" kutusunun bulduğu tipler (boşsa kısa liste gösterilir).</summary>
        private static List<KatalogKalemi> _aramaSonucu;

        /// <summary>Kategori düğmelerinin sütunları: havai | yeraltı | diğer | proje.</summary>
        private static readonly string[][] Sutunlar =
        {
            new[] { "AG_HAVAI", "OG_HAVAI", "MUSTEREK" },
            new[] { "AG_YERALTI", "OG_YERALTI", "KAZI" },
            new[] { "AYDINLATMA", "TRAFO", "ABONE" },
            new[] { "PROJE" },
        };

        public static void Kur()
        {
            // Çalışma alanı değişince AutoCAD şeridi yeniden kurar; sekmemizi geri ekle. Tema değişince simgeleri yenile.
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
            if (string.Equals(e.Name, "WSCURRENT", StringComparison.OrdinalIgnoreCase)) AcApp.Idle += BostaYenidenKur;
            else if (string.Equals(e.Name, "COLORTHEME", StringComparison.OrdinalIgnoreCase)) AcApp.Idle += BostaTemaYenile;
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

        private static void BostaTemaYenile(object sender, EventArgs e)
        {
            AcApp.Idle -= BostaTemaYenile;
            try { if (KoyuTemaMi() != SeritSimgeleri.KoyuTema) Olustur(); } catch { }
        }

        private static void SeritHazir(object sender, RibbonItemEventArgs e)
        {
            if (ComponentManager.Ribbon == null) return;
            ComponentManager.ItemInitialized -= SeritHazir;
            _bekliyor = false;
            Olustur();
        }

        /// <summary>AutoCAD koyu temada mı? (COLORTHEME: 0 koyu, 1 açık; yoksa koyu sayılır)</summary>
        private static bool KoyuTemaMi()
        {
            try { return Convert.ToInt32(AcApp.GetSystemVariable("COLORTHEME"), CultureInfo.InvariantCulture) == 0; }
            catch { return true; }
        }

        public static void Olustur()
        {
            RibbonControl serit = ComponentManager.Ribbon;
            if (serit == null) return;
            bool etkindi = false;
            foreach (RibbonTab t in serit.Tabs)
                if (t.Id == SekmeKimligi)
                {
                    try { var p = t.GetType().GetProperty("IsActive"); etkindi = p != null && Equals(p.GetValue(t, null), true); } catch { }
                    serit.Tabs.Remove(t);
                    break;
                }

            KatalogKaynagi.SembolleriYukle();
            KatalogKaynagi.StiliYukle();
            KatalogKaynagi.KategorileriYukle();
            HizliSecim.Yukle();
            SeritSimgeleri.KoyuTema = KoyuTemaMi();
            if (!_olayBagli) { HizliSecim.Degisti += SecimDegisti; _olayBagli = true; }
            _kategoriDugmeleri.Clear();
            _ogeDugmeleri.Clear();
            _aramaSonucu = null;

            var sekme = new RibbonTab { Title = "ŞEBEKE HAKEDİŞ", Id = SekmeKimligi };
            serit.Tabs.Add(sekme);

            // 1) Kategori: sütun sütun küçük düğmeler
            var kat = Panel(sekme, "Kategori");
            var yerlesen = new HashSet<string>(StringComparer.Ordinal);
            var sutunlar = new List<List<MenuKategorisi>>();
            foreach (var s in Sutunlar)
            {
                var l = new List<MenuKategorisi>();
                foreach (var kod in s)
                {
                    var k = Kategoriler.Bul(kod);
                    if (k != null && yerlesen.Add(k.Kod)) l.Add(k);
                }
                if (l.Count > 0) sutunlar.Add(l);
            }
            var kalan = Kategoriler.Hepsi().FindAll(k => !yerlesen.Contains(k.Kod));
            for (int i = 0; i < kalan.Count; i += 3) sutunlar.Add(kalan.GetRange(i, Math.Min(3, kalan.Count - i)));
            foreach (var l in sutunlar)
            {
                var sutun = new RibbonRowPanel();
                for (int i = 0; i < l.Count; i++)
                {
                    if (i > 0) sutun.Items.Add(new RibbonRowBreak());
                    var d = KategoriDugmesi(l[i]);
                    _kategoriDugmeleri.Add(d);
                    sutun.Items.Add(d);
                }
                kat.Items.Add(sutun);
            }

            // 2) Elemanlar (kategoriye göre dolar)
            _elemanlar = Panel(sekme, "Elemanlar");

            // 3) Ayarlar: tip, arama, özet | durum, hakediş, demontaj | ayrıntılı
            var ay = Panel(sekme, "Ayarlar");
            var s1 = new RibbonRowPanel();
            s1.Items.Add(Etiket("Tip"));
            _tip = new RibbonCombo { Width = 190, ShowText = false, Size = RibbonItemSize.Standard };
            _tip.CurrentChanged += (s, e) => { if (!_yukleniyor) TipSecildi(_tip.Current as RibbonButton); };
            s1.Items.Add(_tip);
            s1.Items.Add(new RibbonRowBreak());
            s1.Items.Add(Etiket("Ara"));
            _ara = new RibbonTextBox { ShowText = false, ShowImage = false, ToolTip = "Etkin öğenin bütün tipleri arasında arar (ör. k2, beton 9,3, alpek 50). Enter'a basın; boş Enter kısa listeye döner." };
            Ozellik(_ara, "Width", 190.0);
            Ozellik(_ara, "IsEmptyTextValid", true);
            Ozellik(_ara, "AcceptTextOnLostFocus", false);
            Ozellik(_ara, "SelectTextOnFocus", true);
            Ozellik(_ara, "InvokesCommand", true);
            Ozellik(_ara, "Prompt", "tip ara (Enter)");
            Ozellik(_ara, "CommandHandler", new AraIsleyici());
            s1.Items.Add(_ara);
            s1.Items.Add(new RibbonRowBreak());
            _ozet = new RibbonLabel { Text = "", ShowText = true, ShowImage = true, ToolTip = "Sıradaki tıklamada çizilecek olan" };
            s1.Items.Add(_ozet);
            ay.Items.Add(s1);
            ay.Items.Add(new RibbonSeparator());

            var s2 = new RibbonRowPanel();
            s2.Items.Add(Etiket("Durum"));
            _durum = new RibbonCombo { Width = 116, ShowText = false, Size = RibbonItemSize.Standard };
            foreach (var d in Turler.CizimDurumlari)
                _durum.Items.Add(new RibbonButton { Text = d, ShowText = true, Tag = d, ToolTip = d + " — " + Turler.DurumAdi(d), Description = Turler.DurumAdi(d) });
            _durum.CurrentChanged += (s, e) => { if (!_yukleniyor) DurumSecildi(); };
            s2.Items.Add(_durum);
            s2.Items.Add(new RibbonRowBreak());
            s2.Items.Add(Etiket("Hakediş"));
            _hakedis = new RibbonCombo { Width = 116, ShowText = false, Size = RibbonItemSize.Standard };
            _hakedis.Items.Add(new RibbonButton { Text = "Aktif hakediş", ShowText = true, Tag = 0, ToolTip = "Çizimin aktif hakedişi (Aktif Hakediş düğmesi)" });
            for (int i = 1; i <= 20; i++) _hakedis.Items.Add(new RibbonButton { Text = i.ToString(CultureInfo.InvariantCulture) + ". hakediş", ShowText = true, Tag = i });
            _hakedis.CurrentChanged += (s, e) => { if (!_yukleniyor) HakedisSecildi(); };
            s2.Items.Add(_hakedis);
            s2.Items.Add(new RibbonRowBreak());
            _dmEtiket = Etiket("DM türü");
            s2.Items.Add(_dmEtiket);
            _dm = new RibbonCombo { Width = 116, ShowText = false, Size = RibbonItemSize.Standard };
            foreach (var d in Turler.DmDurumlari) _dm.Items.Add(new RibbonButton { Text = d.Length == 0 ? "Yok" : d, ShowText = true, Tag = d });
            _dm.CurrentChanged += (s, e) => { if (!_yukleniyor) DurumSecildi(); };
            s2.Items.Add(_dm);
            ay.Items.Add(s2);
            ay.Items.Add(Dugme("Ayrıntılı…", "Etkin öğeyi süzgeçli, aramalı pencereyle çizer (bütün tipler, GIS numarası, demontaj türü).", "_SH_HIZLIAYRINTI ", "bilgi", null));

            // 4) Düzenle
            var duzen = Panel(sekme, "Düzenle");
            duzen.Items.Add(Dugme("Malzeme", "Seçilen direğin, hattın, kanalın ya da sondajın malzemelerini düzenler.", "_SH_MALZEME ", "malzeme", null));
            duzen.Items.Add(Dugme("Metraj", "Seçilen hat, kanal ve sondajların metrajını çizim uzunluğundan yeniden hesaplar (parça metrajları yenilenir).", "_SH_METRAJ ", "metraj", null));
            duzen.Items.Add(Dugme("Telefon\nGörünümü", "Çizimi telefonun görünümüne çevirir: simgeler, renkler, hat etiketleri, her parçanın uzunluğu. Veriye dokunmaz.", "_SH_GORUNUM ", "gorunum", null));
            duzen.Items.Add(Dugme("Çizim\nAyarları", "Katman ön eki, tarife (şehir / köy), simge takımı, etiket yüksekliği, metraj payları, kanal ölçüleri.", "_SH_AYARLAR ", "ayarlar", null));

            // 5) Hakediş
            var hakedis = Panel(sekme, "Hakediş");
            hakedis.Items.Add(Dugme("Aktif\nHakediş", "Aktif hakedişi değiştirir; yeni nesneler bu hakedişin katmanlarına konur.", "_SH_HAKEDIS ", "aktif_hakedis", Color.FromRgb(0x23, 0xA4, 0x55)));
            hakedis.Items.Add(Dugme("Hakediş\nOnayı", "Hakediş onayı (PROMAGIS'teki gibi Kontrol → Hakediş → GIS). Onaylanan hakediş kilitlenir: satırları değiştirilemez, o hakedişe yeni nesne çizilemez.", "_SH_ONAY ", "onay", null));

            // 6) Telefon
            var telefon = Panel(sekme, "Telefon");
            var telRengi = Color.FromRgb(0x3B, 0xA4, 0xF6);
            telefon.Items.Add(Dugme("Telefondan\nAl", "Telefondan gelen proje dosyasındaki (.sebeke.json, .volt.json ya da teslim paketi .zip) yeni ve değişen nesneleri bu çizime aktarır.", "_SH_PROJEAL ", "telefon_al", telRengi));
            telefon.Items.Add(Dugme("Telefona\nGönder", "Bu çizimi telefonda açılacak proje dosyasına yazar (.sebeke.json ya da telefon biçimi .volt.json).", "_SH_ICEAL ", "telefon_gonder", telRengi));

            // 7) Rapor
            var rapor = Panel(sekme, "Rapor");
            rapor.Items.Add(Dugme("Durum\nTespit", "Bu çizimden Durum Tespit raporunu Excel olarak üretir.", "_SH_RAPOR ", "rapor", null));
            rapor.Items.Add(Dugme("Dosyadan\nRapor", "Bir proje dosyasından (.sebeke.json, .volt.json ya da teslim paketi) Durum Tespit raporu üretir.", "_SH_PROJERAPOR ", "dosya_rapor", null));
            rapor.Items.Add(Dugme("Proje\nÖzeti", "Çizimdeki bölge, direk, hat ve kanal sayılarını ve hakediş onaylarını gösterir.", "_SH_OZET ", "ozet", null));
            rapor.Items.Add(Dugme("Eksik\nMalzeme", "Eksik malzeme bul (PROMAGIS DETAY sorgusu): ör. topraklaması olmayan direkler. Bulunanlar çizimde seçilir, istenirse Excel'e yazılır.", "_SH_DETAY ", "eksik", null));

            // 8) Yardım
            var yardim = Panel(sekme, "Yardım");
            yardim.Items.Add(Dugme("Hakkında", "Sürüm ve komut listesi.", "_SH_HAKKINDA ", "bilgi", null));

            KategorileriGoster();
            ElemanlariKur(HizliSecim.Kategori);
            SecimiGoster();
            if (etkindi) Ozellik(sekme, "IsActive", true);
        }

        // ---------------- Kategori ----------------

        private static RibbonToggleButton KategoriDugmesi(MenuKategorisi k)
        {
            bool secili = k == HizliSecim.Kategori;
            return new RibbonToggleButton
            {
                Text = k.Ad,
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Standard,
                Orientation = System.Windows.Controls.Orientation.Horizontal,
                Image = SeritSimgeleri.KategoriSimgesi(k, 16, secili),
                LargeImage = SeritSimgeleri.KategoriSimgesi(k, 32, secili),
                ToolTip = k.Aciklama,
                Tag = k,
                IsChecked = secili,
                CommandParameter = k,
                CommandHandler = new KategoriIsleyici(),
            };
        }

        private sealed class KategoriIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                try
                {
                    var d = parameter as RibbonButton;
                    KategoriSec((d != null ? d.CommandParameter : parameter) as MenuKategorisi);
                }
                catch (Exception ex) { Uygulama.Yaz("Şerit: " + ex.Message); }
            }
        }

        private static void KategoriSec(MenuKategorisi k)
        {
            if (k == null) return;
            // Aynı kategori yeniden seçilirse etkin öğe kalır; başka kategoride ilk çizim öğesi etkin olur
            MenuOgesi oge = k == HizliSecim.Kategori && HizliSecim.Oge != null && k.Ogeler.Contains(HizliSecim.Oge)
                ? HizliSecim.Oge
                : k.Ogeler.Find(x => x.TipliMi || x.Komut == "SH_KANAL") ?? (k.Ogeler.Count > 0 ? k.Ogeler[0] : null);
            _aramaSonucu = null;
            _yukleniyor = true;
            try { HizliSecim.OgeSec(k, oge); }
            finally { _yukleniyor = false; }
            KategorileriGoster();
            ElemanlariKur(k);
            SecimiGoster();
        }

        private static void KategorileriGoster()
        {
            foreach (var d in _kategoriDugmeleri)
            {
                var k = d.Tag as MenuKategorisi;
                bool s = k == HizliSecim.Kategori;
                d.IsChecked = s;
                d.Image = SeritSimgeleri.KategoriSimgesi(k, 16, s);
                d.LargeImage = SeritSimgeleri.KategoriSimgesi(k, 32, s);
            }
        }

        // ---------------- Elemanlar ----------------

        private static void ElemanlariKur(MenuKategorisi k)
        {
            if (_elemanlar == null) return;
            _elemanlar.Items.Clear();
            _ogeDugmeleri.Clear();
            _elemanlar.Title = k == null ? "Elemanlar" : "Elemanlar · " + k.Ad;
            if (k == null) return;
            foreach (var oge in k.Ogeler)
            {
                bool secili = oge == HizliSecim.Oge;
                var d = new RibbonToggleButton
                {
                    Text = Satirla(oge.Ad),
                    ShowText = true,
                    ShowImage = true,
                    Size = RibbonItemSize.Large,
                    Orientation = System.Windows.Controls.Orientation.Vertical,
                    LargeImage = SeritSimgeleri.OgeSimgesi(oge, 32, secili),
                    Image = SeritSimgeleri.OgeSimgesi(oge, 16, secili),
                    ToolTip = OgeAciklamasi(oge),
                    Tag = oge,
                    IsChecked = secili,
                    CommandParameter = oge,
                    CommandHandler = new OgeIsleyici(),
                };
                _ogeDugmeleri.Add(d);
                _elemanlar.Items.Add(d);
            }
        }

        private static void OgeleriGoster()
        {
            foreach (var b in _ogeDugmeleri)
            {
                var oge = b.Tag as MenuOgesi;
                bool s = oge == HizliSecim.Oge;
                b.IsChecked = s;
                b.LargeImage = SeritSimgeleri.OgeSimgesi(oge, 32, s);
                b.Image = SeritSimgeleri.OgeSimgesi(oge, 16, s);
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
                case "SH_ELEMAN": return oge.Ad + ": tıklayın, sonra çizimde yerlerini gösterin (her tıklama bir eleman). Tip, durum ve hakediş Ayarlar panelinden.";
                case "SH_HAT": return oge.Ad + ": direkten direğe tıklayın; hat her direkte biter, her parçanın metrajı ayrı yazılır. Kesit Ayarlar panelinden.";
                case "SH_KANAL": return oge.Ad + ": kanal köşelerini gösterin; box / direk aralarında parçalanır. Zemin Ayarlar panelinden, ölçüler Çizim Ayarları'ndan.";
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
                var oge = (d != null ? d.CommandParameter : parameter) as MenuOgesi;
                if (oge == null) return;
                if (oge != HizliSecim.Oge) _aramaSonucu = null;
                _yukleniyor = true;
                try { HizliSecim.OgeSec(oge.Kategori, oge); }
                finally { _yukleniyor = false; }
                OgeleriGoster();
                SecimiGoster();
                Gonder(oge.TipliMi || oge.Komut == "SH_KANAL" ? "_SH_HIZLI " : "_" + oge.Komut + " ");
            }
        }

        // ---------------- Ayarlar paneli ----------------

        private static void SecimDegisti()
        {
            if (_yukleniyor) return;
            try
            {
                if (_kategoriDugmeleri.Count > 0 && !_kategoriDugmeleri.Exists(d => d.IsChecked == true && d.Tag == HizliSecim.Kategori))
                {
                    KategorileriGoster();
                    ElemanlariKur(HizliSecim.Kategori);
                }
                else OgeleriGoster();
                SecimiGoster();
            }
            catch { }
        }

        /// <summary>Etkin öğenin tip listesini, durumu, hakedişi ve özeti şeritte gösterir.</summary>
        private static void SecimiGoster()
        {
            if (_tip == null) return;
            _yukleniyor = true;
            try
            {
                var oge = HizliSecim.Oge;
                bool tipli = oge != null && (oge.TipliMi || oge.Komut == "SH_KANAL");
                _tip.Items.Clear();
                var secili = tipli ? HizliSecim.SeciliTip(oge, HizliSecim.TemelKatalog) : null;
                var liste = !tipli ? new List<KatalogKalemi>() : new List<KatalogKalemi>(_aramaSonucu ?? HizliSecim.KisaListe(oge));
                if (secili != null && !liste.Contains(secili)) liste.Insert(0, secili);
                RibbonButton cur = null;
                foreach (var it in liste)
                {
                    string ac = TipAciklamasi(it);
                    var b = new RibbonButton { Text = it.Tanim.Trim(), ShowText = true, Tag = it, ToolTip = it.Tanim.Trim() + " · " + ac, Description = ac };
                    _tip.Items.Add(b);
                    if (it == secili) cur = b;
                }
                if (liste.Count == 0) _tip.Items.Add(new RibbonButton { Text = oge == null ? "(öğe seçin)" : "(tip gerekmez)", ShowText = true });
                _tip.Current = cur ?? (_tip.Items.Count > 0 ? _tip.Items[0] : null);
                _tip.IsEnabled = liste.Count > 0;
                if (_ara != null) Ozellik(_ara, "IsEnabled", tipli);

                foreach (var it in _durum.Items) { var b = it as RibbonButton; if (b != null && (string)b.Tag == HizliSecim.Durum) { _durum.Current = b; break; } }
                foreach (var it in _dm.Items) { var b = it as RibbonButton; if (b != null && (string)b.Tag == (HizliSecim.DmDurum ?? "")) { _dm.Current = b; break; } }
                foreach (var it in _hakedis.Items) { var b = it as RibbonButton; if (b != null && (int)b.Tag == HizliSecim.Hakedis) { _hakedis.Current = b; break; } }
                _durum.IsEnabled = tipli;
                _hakedis.IsEnabled = tipli;
                bool dm = tipli && oge.ElemanMi && Turler.DemontajMi(HizliSecim.Durum);
                Ozellik(_dm, "IsVisible", dm);
                Ozellik(_dmEtiket, "IsVisible", dm);
                OzetiGoster();
            }
            finally { _yukleniyor = false; }
        }

        private static string TipAciklamasi(KatalogKalemi it)
        {
            var k = HizliSecim.TemelKatalog;
            var parca = new List<string>();
            string ad = k.CinsAdi(it.Cins);
            if (!string.IsNullOrEmpty(ad)) parca.Add(ad);
            string[] b = (it.Birim ?? "").Split('/');
            if (b.Length > 1 && b[1] == "kg" && it.Katsayi > 0) parca.Add(it.Katsayi.ToString("0.##", CultureInfo.GetCultureInfo("tr-TR")) + " kg");
            if (!string.IsNullOrEmpty(it.PozNo)) parca.Add("poz " + it.PozNo);
            return string.Join(" · ", parca);
        }

        private static void OzetiGoster()
        {
            if (_ozet == null) return;
            var oge = HizliSecim.Oge;
            _ozet.Text = HizliSecim.Ozet();
            _ozet.Image = oge != null ? SeritSimgeleri.OgeSimgesi(oge, 16) : null;
        }

        private static void TipSecildi(RibbonButton b)
        {
            var it = b != null ? b.Tag as KatalogKalemi : null;
            if (it == null || HizliSecim.Oge == null) return;
            _yukleniyor = true;
            try { HizliSecim.TipSec(HizliSecim.Oge, it); }
            finally { _yukleniyor = false; }
            OzetiGoster();
        }

        private static void DurumSecildi()
        {
            var d = _durum.Current as RibbonButton;
            var dm = _dm.Current as RibbonButton;
            _yukleniyor = true;
            try { HizliSecim.DurumSec(d != null ? (string)d.Tag : "M", dm != null ? (string)dm.Tag : ""); }
            finally { _yukleniyor = false; }
            bool goster = HizliSecim.Oge != null && HizliSecim.Oge.ElemanMi && Turler.DemontajMi(HizliSecim.Durum);
            Ozellik(_dm, "IsVisible", goster);
            Ozellik(_dmEtiket, "IsVisible", goster);
            OzetiGoster();
        }

        private static void HakedisSecildi()
        {
            var h = _hakedis.Current as RibbonButton;
            _yukleniyor = true;
            try { HizliSecim.HakedisSec(h != null ? (int)h.Tag : 0); }
            finally { _yukleniyor = false; }
            OzetiGoster();
        }

        /// <summary>"Ara" kutusu: Enter'a basınca etkin öğenin bütün tiplerinde arar; bulunanlar Tip listesine gelir, ilki seçilir.</summary>
        private sealed class AraIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                try { Ara(KutuMetni(parameter ?? _ara)); }
                catch (Exception ex) { Uygulama.Yaz("Şerit: " + ex.Message); }
            }
        }

        private static string KutuMetni(object kutu)
        {
            if (kutu == null) return "";
            foreach (var ad in new[] { "TextValue", "Value" })
            {
                try
                {
                    var p = kutu.GetType().GetProperty(ad, BindingFlags.Public | BindingFlags.Instance);
                    if (p == null) continue;
                    var v = p.GetValue(kutu, null);
                    if (v != null) return Convert.ToString(v, CultureInfo.InvariantCulture);
                }
                catch { }
            }
            return "";
        }

        private static void Ara(string arama)
        {
            var oge = HizliSecim.Oge;
            if (oge == null || !(oge.TipliMi || oge.Komut == "SH_KANAL")) return;
            arama = (arama ?? "").Trim();
            if (arama.Length == 0)
            {
                _aramaSonucu = null;
                SecimiGoster();
                return;
            }
            var hepsi = HizliSecim.Tipler(oge, HizliSecim.TemelKatalog, true);
            var bulunan = HizliSecim.Ara(hepsi, arama, 40);
            if (bulunan.Count == 0)
            {
                Uygulama.Yaz("Şerit: \"" + arama + "\" için " + oge.Ad + " tipi bulunamadı.");
                return;
            }
            _aramaSonucu = bulunan;
            _yukleniyor = true;
            try { HizliSecim.TipSec(oge, bulunan[0]); }
            finally { _yukleniyor = false; }
            SecimiGoster();
            Uygulama.Yaz("Şerit: " + bulunan.Count + (bulunan.Count >= 40 ? "+" : "") + " tip bulundu; ilki seçildi (" + bulunan[0].Tanim.Trim() + "). Tip listesinden değiştirebilirsiniz.");
        }

        // ---------------- Yardımcılar ----------------

        private static RibbonPanelSource Panel(RibbonTab sekme, string baslik)
        {
            var kaynak = new RibbonPanelSource { Title = baslik };
            sekme.Panels.Add(new RibbonPanel { Source = kaynak });
            return kaynak;
        }

        private static RibbonLabel Etiket(string yazi)
        {
            var l = new RibbonLabel { Text = yazi, ShowText = true, ShowImage = false };
            Ozellik(l, "Width", 52.0);
            Ozellik(l, "MinWidth", 52.0);
            return l;
        }

        /// <summary>Sürüme göre bulunmayabilen bir özelliği güvenle atar (yoksa geçer).</summary>
        private static void Ozellik(object o, string ad, object deger)
        {
            try
            {
                var p = o.GetType().GetProperty(ad, BindingFlags.Public | BindingFlags.Instance);
                if (p == null || !p.CanWrite) return;
                object v = deger;
                if (deger != null && !p.PropertyType.IsInstanceOfType(deger))
                {
                    try { v = Convert.ChangeType(deger, p.PropertyType, CultureInfo.InvariantCulture); }
                    catch { return; }
                }
                p.SetValue(o, v, null);
            }
            catch { }
        }

        private static RibbonButton Dugme(string yazi, string aciklama, string komut, string simge, Color? renk)
        {
            return new RibbonButton
            {
                Text = yazi,
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Large,
                Orientation = System.Windows.Controls.Orientation.Vertical,
                LargeImage = SeritSimgeleri.KomutSimgesi(simge, 32, renk),
                Image = SeritSimgeleri.KomutSimgesi(simge, 16, renk),
                ToolTip = aciklama,
                CommandParameter = komut,
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
                Gonder(dugme.CommandParameter as string);
            }
        }
    }
}
