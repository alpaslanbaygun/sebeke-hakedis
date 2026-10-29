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
    /// AutoCAD şerit menüsüne "ŞEBEKE-M" (çizim) ve "ŞEBEKE-M ARAÇLAR" sekmelerini ekler (Google Stitch tasarımı):
    ///   Kategori   — AG Havai, AG Yeraltı, OG Havai / ENH … düğmeleri (sütunlar: havai | yeraltı | diğer | proje); tek tıkla seçilir.
    ///   Elemanlar  — yalnız seçili kategorinin öğeleri (ör. AG Havai: AG Direk, AG Hat, Kofre, Abone Hattı); öğeye tıklayınca
    ///                pencere açılmadan çizime başlanır.
    ///   Ayarlar    — etkin öğenin cinsi (ör. AG direkte galvanizli demir / demir / beton / ağaç) ve o cinsin tipleri (katalog
    ///                sırasıyla; "Ara" ile bütün tipler), durum (her durumun simgesiyle), hakediş, demontaj türü; hatlarda
    ///                adet ve ikinci iletken (müşterek hatta OG ile AG birlikte); "sıradaki tıklamada ne çizilecek" özeti.
    ///   Malzeme    — seçilen nesnenin malzemeleri, seçilen elemanlara toplu malzeme, malzeme hafızası (açık / kapalı).
    ///   Düzenle   — metraj, telefon görünümü, çizim ayarları.
    /// ARAÇLAR sekmesi: Hakediş, Raporlar, Telefon (ve hesap araçları). İki sekmenin başında Şebeke-M paneli (Hakkında).
    /// Kategori ve öğeler ortak/katalog/kategoriler.json'dan, tipler kalemler.json'un cins gruplarından gelir.
    /// Şeridin zemin rengi AutoCAD'in temasından gelir; simgeler koyu ve açık temaya göre çizilir.
    /// </summary>
    internal static class Serit
    {
        private const string SekmeKimligi = "SEBEKE_HAKEDIS_SEKME";
        private const string AracSekmesiKimligi = "SEBEKE_M_ARACLAR";
        private const string AyrintiAciklamasi = "Etkin öğeyi süzgeçli, aramalı pencereyle çizer (bütün tipler, cins düğmeleri, GIS numarası, demontaj türü; hatlarda iki iletken ve adet).";
        private static bool _bekliyor, _yukleniyor, _olayBagli;

        private static RibbonCombo _cins, _tip, _durum, _dm, _hakedis, _adet, _ek, _kanalHazir;
        private static RibbonTextBox _ara, _kanalAlt, _kanalUst, _kanalDer;
        private static RibbonLabel _dmEtiket, _adetEtiket, _ekEtiket, _kanalEtiket, _kanalAltEtiket, _kanalUstEtiket, _kanalDerEtiket;
        /// <summary>Hazır kanal ölçüleri (alt × üst × derinlik, cm): kanal penceresindeki hızlı seçimlerle aynı.</summary>
        private static readonly int[][] KanalHazir = { new[] { 40, 40, 80 }, new[] { 40, 40, 100 }, new[] { 60, 60, 120 }, new[] { 80, 80, 150 } };
        /// <summary>"Ayrıntılı…" düğmesi: ipucunda sıradaki tıklamada çizilecek olanın tam yazısı (şeritte uzun yazı yer kaplamasın).</summary>
        private static RibbonButton _ayrinti;
        private static RibbonToggleButton _hafiza;
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
                bool ana = false, arac = false;
                foreach (RibbonTab t in serit.Tabs) { if (t.Id == SekmeKimligi) ana = true; else if (t.Id == AracSekmesiKimligi) arac = true; }
                if (ana && arac) return;
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
            bool etkindi = false, aracEtkindi = false;
            var kaldirilacak = new List<RibbonTab>();
            foreach (RibbonTab t in serit.Tabs)
            {
                if (t.Id != SekmeKimligi && t.Id != AracSekmesiKimligi) continue;
                bool e = false;
                try { var p = t.GetType().GetProperty("IsActive"); e = p != null && Equals(p.GetValue(t, null), true); } catch { }
                if (t.Id == SekmeKimligi) etkindi = e; else aracEtkindi = e;
                kaldirilacak.Add(t);
            }
            foreach (var t in kaldirilacak) serit.Tabs.Remove(t);

            KatalogKaynagi.SembolleriYukle();
            KatalogKaynagi.StiliYukle();
            KatalogKaynagi.KategorileriYukle();
            HizliSecim.Yukle();
            SeritSimgeleri.KoyuTema = KoyuTemaMi();
            if (!_olayBagli) { HizliSecim.Degisti += SecimDegisti; _olayBagli = true; }
            _kategoriDugmeleri.Clear();
            _ogeDugmeleri.Clear();
            _aramaSonucu = null;

            // Çizim sekmesi: Şebeke-M | Kategori | Elemanlar | Ayarlar | Malzeme | Düzenle
            var sekme = new RibbonTab { Title = "ŞEBEKE-M", Id = SekmeKimligi };
            serit.Tabs.Add(sekme);
            MarkaPaneli(sekme);

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

            // 3) Ayarlar: cins, tip, arama | durum, hakediş, demontaj | adet, ikinci iletken, özet | ayrıntılı
            var ay = Panel(sekme, "Ayarlar");
            var s1 = new RibbonRowPanel();
            s1.Items.Add(Etiket("Cins"));
            _cins = new RibbonCombo { Width = 190, ShowText = false, Size = RibbonItemSize.Standard };
            _cins.CurrentChanged += (s, e) => { if (!_yukleniyor) CinsSecildi(_cins.Current as RibbonButton); };
            s1.Items.Add(_cins);
            s1.Items.Add(new RibbonRowBreak());
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
            ay.Items.Add(s1);
            ay.Items.Add(new RibbonSeparator());

            var s2 = new RibbonRowPanel();
            s2.Items.Add(Etiket("Durum"));
            _durum = new RibbonCombo { Width = 116, ShowText = false, Size = RibbonItemSize.Standard };
            foreach (var d in Turler.CizimDurumlari)
                _durum.Items.Add(new RibbonButton { Text = d, ShowText = true, ShowImage = true, Tag = d, ToolTip = d + " — " + Turler.DurumAdi(d), Description = Turler.DurumAdi(d) });
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
            foreach (var d in Turler.DmDurumlari)
                _dm.Items.Add(new RibbonButton { Text = d.Length == 0 ? "Yok" : d, ShowText = true, ShowImage = true, Tag = d, ToolTip = d.Length == 0 ? "Demontaj (\"/\")" : d == "KESİK" ? "Kesilerek demontaj (\"//\")" : "Sökülerek demontaj (\"X\")" });
            _dm.CurrentChanged += (s, e) => { if (!_yukleniyor) DurumSecildi(); };
            s2.Items.Add(_dm);
            ay.Items.Add(s2);
            ay.Items.Add(new RibbonSeparator());

            var s3 = new RibbonRowPanel();
            _adetEtiket = Etiket("Adet");
            s3.Items.Add(_adetEtiket);
            _adet = new RibbonCombo { Width = 64, ShowText = false, Size = RibbonItemSize.Standard, ToolTip = "Aynı güzergâhta kaç tane (ör. 3 adet ALPEK). Metraj adet kadar katlanır, etikette 3x(…) yazar." };
            for (int i = 1; i <= 8; i++) _adet.Items.Add(new RibbonButton { Text = i.ToString(CultureInfo.InvariantCulture) + " ×", ShowText = true, Tag = i });
            _adet.CurrentChanged += (s, e) => { if (!_yukleniyor) AdetSecildi(); };
            s3.Items.Add(_adet);
            s3.Items.Add(new RibbonRowBreak());
            _ekEtiket = Etiket("2. iletken");
            s3.Items.Add(_ekEtiket);
            _ek = new RibbonCombo { Width = 170, ShowText = false, Size = RibbonItemSize.Standard, ToolTip = "Aynı hatta ikinci iletken / kablo (müşterek hatta OG ile AG birlikte gelir). Daha fazlası için Ayrıntılı…" };
            _ek.CurrentChanged += (s, e) => { if (!_yukleniyor) EkSecildi(_ek.Current as RibbonButton); };
            s3.Items.Add(_ek);
            ay.Items.Add(s3);
            // Kanal: ölçüler (yalnız kanal öğesinde görünür). Yazıp Enter; hazır ölçüler listeden.
            var s4 = new RibbonRowPanel();
            _kanalEtiket = Etiket("Kanal");
            s4.Items.Add(_kanalEtiket);
            _kanalHazir = new RibbonCombo { Width = 128, ShowText = false, Size = RibbonItemSize.Standard, ToolTip = "Hazır kanal ölçüsü: alt genişlik × üst genişlik × derinlik (cm)." };
            _kanalHazir.Items.Add(new RibbonButton { Text = "Hazır ölçü…", ShowText = true, Tag = null });
            foreach (var h in KanalHazir)
                _kanalHazir.Items.Add(new RibbonButton { Text = h[0] + " × " + h[1] + " × " + h[2], ShowText = true, Tag = h, ToolTip = "Alt " + h[0] + " cm, üst " + h[1] + " cm, derinlik " + h[2] + " cm" });
            _kanalHazir.CurrentChanged += (s, e) => { if (!_yukleniyor) KanalHazirSecildi(_kanalHazir.Current as RibbonButton); };
            s4.Items.Add(_kanalHazir);
            s4.Items.Add(new RibbonRowBreak());
            _kanalAltEtiket = KisaEtiket("Alt");
            s4.Items.Add(_kanalAltEtiket);
            _kanalAlt = KanalKutusu("Kanalın alt genişliği (cm)");
            s4.Items.Add(_kanalAlt);
            _kanalUstEtiket = KisaEtiket("Üst");
            s4.Items.Add(_kanalUstEtiket);
            _kanalUst = KanalKutusu("Kanalın üst genişliği (cm). Kanal çizimde bu genişlikte iki kenar çizgisiyle görünür.");
            s4.Items.Add(_kanalUst);
            s4.Items.Add(new RibbonRowBreak());
            _kanalDerEtiket = Etiket("Derinlik");
            s4.Items.Add(_kanalDerEtiket);
            _kanalDer = KanalKutusu("Kanalın derinliği (cm)");
            s4.Items.Add(_kanalDer);
            ay.Items.Add(s4);
            _ayrinti = Dugme("Ayrıntılı…", AyrintiAciklamasi, "_SH_HIZLIAYRINTI ", "bilgi", null);
            ay.Items.Add(_ayrinti);

            // 4) Malzeme
            var malzeme = Panel(sekme, "Malzeme");
            malzeme.Items.Add(Dugme("Malzeme", "Seçilen direğin, hattın, kanalın ya da sondajın malzemelerini düzenler. Direğe armatür eklenirse simgesi direğin yanına çizilir.", "_SH_MALZEME ", "malzeme", null));
            malzeme.Items.Add(Dugme("Toplu\nMalzeme", "Seçilen direklere / elemanlara aynı malzemeleri tek seferde ekler (önce seçebilir ya da düğmeden sonra seçebilirsiniz).", "_SH_TOPLUMALZEME ", "toplu", null));
            _hafiza = new RibbonToggleButton
            {
                Text = "Malzeme\nHafızası",
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Large,
                Orientation = System.Windows.Controls.Orientation.Vertical,
                LargeImage = SeritSimgeleri.KomutSimgesi("hafiza", 32, HafizaRengi),
                Image = SeritSimgeleri.KomutSimgesi("hafiza", 16, HafizaRengi),
                ToolTip = "Açıkken yeni konan direğe, trafoya … aynı tür ve tipteki son elemanın malzemeleri kendiliğinden eklenir. " +
                          "Hafıza, bir elemanın malzemeleri düzenlenince (Malzeme, Toplu Malzeme) güncellenir.",
                IsChecked = HizliSecim.HafizaAcik,
                CommandHandler = new HafizaIsleyici(),
            };
            malzeme.Items.Add(_hafiza);

            // 5) Düzenle
            var duzen = Panel(sekme, "Düzenle");
            duzen.Items.Add(Dugme("Metraj", "Seçilen hat, kanal ve sondajların metrajını çizim uzunluğundan yeniden hesaplar (parça metrajları yenilenir).", "_SH_METRAJ ", "metraj", null));
            duzen.Items.Add(Dugme("Telefon\nGörünümü", "Çizimi telefonun görünümüne çevirir: simgeler (durumuna göre), renkler, hat etiketleri, her parçanın uzunluğu, direklerin yanındaki armatürler. Veriye dokunmaz.", "_SH_GORUNUM ", "gorunum", null));
            duzen.Items.Add(Dugme("Çizim\nAyarları", "Katman ön eki, tarife (şehir / köy), simge takımı, etiket yüksekliği, yakalama, metraj payları, kanal ölçüleri.", "_SH_AYARLAR ", "ayarlar", null));

            // Araçlar sekmesi: Şebeke-M | Hakediş | Raporlar | Telefon
            var araclar = new RibbonTab { Title = "ŞEBEKE-M ARAÇLAR", Id = AracSekmesiKimligi };
            serit.Tabs.Add(araclar);
            MarkaPaneli(araclar);

            var hakedis = Panel(araclar, "Hakediş");
            hakedis.Items.Add(Dugme("Aktif\nHakediş", "Aktif hakedişi değiştirir; yeni nesneler bu hakedişin katmanlarına konur.", "_SH_HAKEDIS ", "aktif_hakedis", Color.FromRgb(0x23, 0xA4, 0x55)));
            hakedis.Items.Add(Dugme("Hakediş\nOnayı", "Hakediş onayı (Kontrol → Hakediş → GIS). Onaylanan hakediş kilitlenir: satırları değiştirilemez, o hakedişe yeni nesne çizilemez.", "_SH_ONAY ", "onay", null));

            var rapor = Panel(araclar, "Raporlar");
            rapor.Items.Add(Dugme("Durum\nTespit", "Bu çizimden Durum Tespit raporunu Excel olarak üretir.", "_SH_RAPOR ", "rapor", null));
            rapor.Items.Add(Dugme("Dosyadan\nRapor", "Bir proje dosyasından (.sebeke.json, .volt.json ya da teslim paketi) Durum Tespit raporu üretir.", "_SH_PROJERAPOR ", "dosya_rapor", null));
            rapor.Items.Add(Dugme("Proje\nÖzeti", "Projeleri (bölgeleri) ve seçilen projenin malzeme listesini bir pencerede gösterir; listeler Excel'e aktarılır.", "_SH_OZET ", "ozet", null));
            rapor.Items.Add(Dugme("Eksik\nMalzeme", "Eksik malzeme bul (DETAY sorgusu): ör. topraklaması olmayan direkler. Bulunanlar çizimde seçilir, istenirse Excel'e yazılır.", "_SH_DETAY ", "eksik", null));

            var telefon = Panel(araclar, "Telefon");
            var telRengi = Color.FromRgb(0x3B, 0xA4, 0xF6);
            telefon.Items.Add(Dugme("Telefondan\nAl", "Telefondan gelen proje dosyasındaki (.sebeke.json, .volt.json ya da teslim paketi .zip) yeni ve değişen nesneleri bu çizime aktarır.", "_SH_PROJEAL ", "telefon_al", telRengi));
            telefon.Items.Add(Dugme("Telefona\nGönder", "Bu çizimi telefonda açılacak proje dosyasına yazar (.sebeke.json ya da telefon biçimi .volt.json).", "_SH_ICEAL ", "telefon_gonder", telRengi));

            // CBS ve harita: Google Earth, MIF dışa / içe aktarma, CBS bilgisi
            var cbs = Panel(araclar, "CBS ve Harita");
            var cbsRengi = Color.FromRgb(0x23, 0xA4, 0x55);
            cbs.Items.Add(Dugme("Google\nEarth", "Çizimi Google Earth dosyası olarak kaydeder (KMZ / KML): her proje bir klasör; direk, hat, kanal, sondaj bilgileriyle. Koordinatlar çizimin diliminden çevrilir.", "_SH_KML ", "kml", cbsRengi));
            cbs.Items.Add(Dugme("CBS'ye\nAktar", "CBS için MapInfo MIF / MID dosyaları: her nesne türü (eleman, hat, kanal, sondaj, proje sınırı, GPS noktası) ayrı dosya, çizim koordinatıyla.", "_SH_MIFVER ", "cbs_ver", null));
            cbs.Items.Add(Dugme("CBS'den\nAl", "MapInfo MIF / MID dosyalarını çizime altlık olarak alır (nokta, çizgi, alan, yazı). Koordinatlar çizimin dilimine çevrilir; bilgiler nesnede saklanır.", "_SH_MIFAL ", "cbs_al", null));
            cbs.Items.Add(Dugme("CBS\nBilgisi", "CBS'den alınan bir nesnenin bilgilerini (MID satırı) gösterir.", "_SH_CBSBILGI ", "bilgi", null));
            cbs.Items.Add(Dugme("Harita\nAltlığı", "Uydu görüntüsü ya da harita altlığı: Esri, Google, Bing / Azure, Yandex, MapTiler, OpenStreetMap ya da özel sunucu (anahtarlılar kendi anahtarınızla). Çizimin koordinatına oturtulmuş resim olarak, nesnelerin altına konur.", "_SH_ALTLIK ", "altlik", Color.FromRgb(0x3B, 0xA4, 0xF6)));

            HesapPanelleri(araclar);

            KategorileriGoster();
            ElemanlariKur(HizliSecim.Kategori);
            SecimiGoster();
            if (etkindi) Ozellik(sekme, "IsActive", true);
            else if (aracEtkindi) Ozellik(araclar, "IsActive", true);
        }

        // ---------------- Teknik hesaplar ----------------

        /// <summary>Panel adlarına göre hesap grupları (ortak/hesap/moduller.json › grup).</summary>
        private static readonly string[][] HesapPanelGruplari =
        {
            new[] { "Teknik Hesaplamalar", "mekanik", "Hat ve\nDirek", "hesap_direk", "Hat ve direk hesapları: sehim, uplift, ag–aw, Amax, iletken kopma, tepe kuvveti." },
            new[] { "Teknik Hesaplamalar", "elektrik", "Elektrik", "hesap_elektrik", "Elektrik hesapları: gerilim düşümü, kısa devre, bakır–alüminyum kesit." },
        };

        /// <summary>
        /// Araçlar sekmesi › Teknik Hesaplamalar (Hesap Merkezi, Kayıtlı Hesaplar, hat ve direk / elektrik açılır listeleri)
        /// ve Proje ve Yerleşim (köşk, kanal, AG tek hat). Hesap listesi eklentiye gömülü moduller.json'dan gelir;
        /// her düğme "_SH_HESAP <kimlik>" komutunu gönderir (seçili nesne hedef olur, Enter = proje geneli).
        /// </summary>
        private static void HesapPanelleri(RibbonTab araclar)
        {
            var moduller = HesapMerkezi.Moduller;
            var hesapRengi = Color.FromRgb(0xF5, 0x9E, 0x0B);
            var hesap = Panel(araclar, "Teknik Hesaplamalar");
            hesap.Items.Add(Dugme("Hesap\nMerkezi", "Seçili direk, hat, trafo ya da kanal için uygun hesapların listesi ve o hedefin kayıtlı sonuçları (tarayıcıda açılır). Nesne seçmeden Enter: çizimin tamamı.", "_SH_HESAP merkez ", "hesap_merkezi", hesapRengi));
            hesap.Items.Add(Dugme("Kayıtlı\nHesaplar", "Çizimdeki bütün hesap kayıtları: sonuç, uygunluk, hesaptan sonra değişen bilgiler (güncel değil uyarısı), çizimde gösterme.", "_SH_HESAPLAR ", "hesap_kayit", null));
            foreach (var g in HesapPanelGruplari)
            {
                var liste = moduller.FindAll(m => m.Metin("grup") == g[1]);
                if (liste.Count == 0) continue;
                var acilir = new RibbonSplitButton
                {
                    Text = g[2],
                    ShowText = true,
                    ShowImage = true,
                    Size = RibbonItemSize.Large,
                    Orientation = System.Windows.Controls.Orientation.Vertical,
                    LargeImage = SeritSimgeleri.KomutSimgesi(g[3], 32, null),
                    Image = SeritSimgeleri.KomutSimgesi(g[3], 16, null),
                    ToolTip = g[4] + " Tıklayınca Hesap Merkezi açılır; ok ile hesabı doğrudan seçin.",
                    IsSplit = true,
                    IsSynchronizedWithCurrentItem = false,
                    ListStyle = RibbonSplitButtonListStyle.List,
                    CommandParameter = "_SH_HESAP merkez ",
                    CommandHandler = new KomutIsleyici(),
                };
                Ozellik(acilir, "ListImageSize", RibbonImageSize.Standard);
                foreach (var m in liste)
                {
                    acilir.Items.Add(new RibbonButton
                    {
                        Text = m.Metin("ad"),
                        ShowText = true,
                        ShowImage = true,
                        Image = SeritSimgeleri.KomutSimgesi(g[3], 16, null),
                        ToolTip = m.Metin("aciklama"),
                        CommandParameter = "_SH_HESAP " + m.Metin("id") + " ",
                        CommandHandler = new KomutIsleyici(),
                    });
                }
                hesap.Items.Add(acilir);
            }

            var yerlesimListesi = moduller.FindAll(x => x.Metin("grup") == "yerlesim");
            if (yerlesimListesi.Count == 0) return;
            var yerlesim = Panel(araclar, "Proje ve Yerleşim");
            foreach (var m in yerlesimListesi)
            {
                string id = m.Metin("id");
                string simge = id == "kosk" ? "kosk" : id == "kanal" ? "kanal" : id == "ag-tekhat" ? "tekhat" : "yerlesim";
                yerlesim.Items.Add(Dugme(Satirla(m.Metin("kisa")), m.Metin("aciklama"), "_SH_HESAP " + id + " ", simge, null));
            }
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
                case "SH_KANAL": return oge.Ad + ": kanal köşelerini gösterin; box / direk aralarında parçalanır. Zemin (Tip) ve ölçüler (Kanal: alt, üst, derinlik) Ayarlar panelinden.";
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

        private static Color? HafizaRengi => HizliSecim.HafizaAcik ? Color.FromRgb(0x23, 0xA4, 0x55) : (Color?)null;

        /// <summary>
        /// Etkin öğenin cinslerini, tip listesini (seçili cinsin tipleri, katalog sırasıyla), durumu (her durumun simgesiyle),
        /// hakedişi, hatlarda adet ve ikinci iletkeni ve özeti şeritte gösterir.
        /// </summary>
        private static void SecimiGoster()
        {
            if (_tip == null) return;
            _yukleniyor = true;
            try
            {
                var oge = HizliSecim.Oge;
                var k = HizliSecim.TemelKatalog;
                bool tipli = oge != null && (oge.TipliMi || oge.Komut == "SH_KANAL");

                // Cins
                _cins.Items.Clear();
                var cinsler = tipli ? HizliSecim.Cinsler(oge, k) : new List<string>();
                string seciliCins = tipli ? HizliSecim.SeciliCins(oge, k) : "";
                RibbonButton curCins = null;
                foreach (var c in cinsler)
                {
                    var b = new RibbonButton { Text = k.CinsAdi(c), ShowText = true, Tag = c, ToolTip = k.CinsAdi(c) + " · " + c, Description = c };
                    _cins.Items.Add(b);
                    if (c == seciliCins) curCins = b;
                }
                if (cinsler.Count == 0) _cins.Items.Add(new RibbonButton { Text = oge == null ? "(öğe seçin)" : "—", ShowText = true });
                _cins.Current = curCins ?? (_cins.Items.Count > 0 ? _cins.Items[0] : null);
                _cins.IsEnabled = cinsler.Count > 1 && _aramaSonucu == null;

                // Tip
                _tip.Items.Clear();
                var secili = tipli ? HizliSecim.SeciliTip(oge, k) : null;
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

                // Durum ve demontaj türü: her seçeneğin yanında simgesi (yeni dolu, mevcut boş, sök-tak yarım, demontaj "/", kesik "//", sökük "X")
                bool eleman = tipli && oge.ElemanMi;
                foreach (var it in _durum.Items)
                {
                    var b = it as RibbonButton;
                    if (b == null) continue;
                    b.Image = eleman && secili != null ? DurumSimgesi(oge.Tur, secili.Cins, (string)b.Tag, HizliSecim.DmDurum) : null;
                    if ((string)b.Tag == HizliSecim.Durum) _durum.Current = b;
                }
                foreach (var it in _dm.Items)
                {
                    var b = it as RibbonButton;
                    if (b == null) continue;
                    b.Image = eleman && secili != null ? DurumSimgesi(oge.Tur, secili.Cins, "DM", (string)b.Tag) : null;
                    if ((string)b.Tag == (HizliSecim.DmDurum ?? "")) _dm.Current = b;
                }
                foreach (var it in _hakedis.Items) { var b = it as RibbonButton; if (b != null && (int)b.Tag == HizliSecim.Hakedis) { _hakedis.Current = b; break; } }
                _durum.IsEnabled = tipli;
                _hakedis.IsEnabled = tipli;
                bool dm = eleman && Turler.DemontajMi(HizliSecim.Durum);
                Ozellik(_dm, "IsVisible", dm);
                Ozellik(_dmEtiket, "IsVisible", dm);

                // Hatlar: adet ve ikinci iletken
                bool hat = tipli && oge.HatMi;
                Ozellik(_adet, "IsVisible", hat);
                Ozellik(_adetEtiket, "IsVisible", hat);
                Ozellik(_ek, "IsVisible", hat);
                Ozellik(_ekEtiket, "IsVisible", hat);
                if (hat)
                {
                    int adet = HizliSecim.Adet(oge);
                    foreach (var it in _adet.Items) { var b = it as RibbonButton; if (b != null && (int)b.Tag == adet) { _adet.Current = b; break; } }
                    _ek.Items.Clear();
                    var yok = new RibbonButton { Text = "Yok", ShowText = true, Tag = null, ToolTip = "Hatta tek iletken" };
                    _ek.Items.Add(yok);
                    var ek = HizliSecim.EkIletken(oge, k);
                    RibbonButton curEk = yok;
                    foreach (var it in HizliSecim.EkListe(oge))
                    {
                        string ac = TipAciklamasi(it);
                        var b = new RibbonButton { Text = it.Tanim.Trim(), ShowText = true, Tag = it, ToolTip = it.Tanim.Trim() + " · " + ac, Description = ac };
                        _ek.Items.Add(b);
                        if (ek != null && it.Anahtar == ek.Anahtar) curEk = b;
                    }
                    _ek.Current = curEk;
                }
                // Kanal: ölçüler
                bool kanal = oge != null && oge.Komut == "SH_KANAL";
                foreach (var it in new object[] { _kanalEtiket, _kanalHazir, _kanalAltEtiket, _kanalAlt, _kanalUstEtiket, _kanalUst, _kanalDerEtiket, _kanalDer })
                    if (it != null) Ozellik(it, "IsVisible", kanal);
                if (kanal) KanalOlcusunuGoster();
                Hafiza_();
                OzetiGoster();
            }
            finally { _yukleniyor = false; }
        }

        // ---------------- Kanal ölçüleri ----------------

        private static RibbonLabel KisaEtiket(string yazi)
        {
            var l = new RibbonLabel { Text = yazi, ShowText = true, ShowImage = false };
            Ozellik(l, "Width", 28.0);
            Ozellik(l, "MinWidth", 28.0);
            return l;
        }

        private static RibbonTextBox KanalKutusu(string ipucu)
        {
            var k = new RibbonTextBox { ShowText = false, ShowImage = false, ToolTip = ipucu + ". Yazıp Enter'a basın; yeni kanallar bu ölçüyle çizilir. Boş bırakılırsa Çizim Ayarları'ndaki ölçü kullanılır." };
            Ozellik(k, "Width", 48.0);
            Ozellik(k, "IsEmptyTextValid", true);
            Ozellik(k, "AcceptTextOnLostFocus", true);
            Ozellik(k, "SelectTextOnFocus", true);
            Ozellik(k, "InvokesCommand", true);
            Ozellik(k, "CommandHandler", new KanalKutusuIsleyici());
            return k;
        }

        private static string Cm(double d) => d > 0 ? d.ToString("0.#", CultureInfo.GetCultureInfo("tr-TR")) : "";

        /// <summary>Kutulara seçili kanal ölçüsü; girilmemişse boş (çizimin ayarı kullanılır).</summary>
        private static void KanalOlcusunuGoster()
        {
            Ozellik(_kanalAlt, "TextValue", Cm(HizliSecim.KanalAlt));
            Ozellik(_kanalUst, "TextValue", Cm(HizliSecim.KanalUst));
            Ozellik(_kanalDer, "TextValue", Cm(HizliSecim.KanalDerinlik));
            // Boş kutuda "ayar": o ölçü için çizimin ayarı kullanılır
            Ozellik(_kanalAlt, "Prompt", HizliSecim.KanalAlt > 0 ? "" : "ayar");
            Ozellik(_kanalUst, "Prompt", HizliSecim.KanalUst > 0 ? "" : "ayar");
            Ozellik(_kanalDer, "Prompt", HizliSecim.KanalDerinlik > 0 ? "" : "ayar");
            if (_kanalHazir != null && _kanalHazir.Items.Count > 0)
            {
                object sec = _kanalHazir.Items[0];
                foreach (var it in _kanalHazir.Items)
                    if (it is RibbonButton b && b.Tag is int[] h && h[0] == HizliSecim.KanalAlt && h[1] == HizliSecim.KanalUst && h[2] == HizliSecim.KanalDerinlik) sec = b;
                _kanalHazir.Current = sec;
            }
        }

        private static void KanalHazirSecildi(RibbonButton b)
        {
            var h = b != null ? b.Tag as int[] : null;
            if (h == null) return;
            _yukleniyor = true;
            try { HizliSecim.KanalOlcusuSec(h[0], h[1], h[2]); }
            finally { _yukleniyor = false; }
            SecimiGoster();
            Uygulama.Yaz("Şerit: kanal ölçüsü " + h[0] + " × " + h[1] + " × " + h[2] + " cm (alt × üst × derinlik).");
        }

        /// <summary>Kanal kutusunda Enter (ya da kutudan çıkınca): üç ölçü birlikte okunur; geçersiz sayı eski değerinde kalır.</summary>
        private static void KanalOlcusuGirildi()
        {
            if (_yukleniyor) return;
            Func<RibbonTextBox, double, double> oku = (k, eski) =>
            {
                string m = (KutuMetni(k) ?? "").Trim();
                if (m.Length == 0) return eski;
                double d = SayiCoz.Coz(m, double.NaN);
                return double.IsNaN(d) || d < 0 || d > 1000 ? eski : d;
            };
            double alt = oku(_kanalAlt, HizliSecim.KanalAlt), ust = oku(_kanalUst, HizliSecim.KanalUst), der = oku(_kanalDer, HizliSecim.KanalDerinlik);
            if (alt == HizliSecim.KanalAlt && ust == HizliSecim.KanalUst && der == HizliSecim.KanalDerinlik) { KanalOlcusunuGoster(); return; }
            _yukleniyor = true;
            try { HizliSecim.KanalOlcusuSec(alt, ust, der); }
            finally { _yukleniyor = false; }
            SecimiGoster();
            Uygulama.Yaz("Şerit: kanal ölçüsü " + Cm(alt) + " × " + Cm(ust) + " × " + Cm(der) + " cm (alt × üst × derinlik).");
        }

        private sealed class KanalKutusuIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                try { KanalOlcusuGirildi(); }
                catch (Exception ex) { Uygulama.Yaz("Şerit: " + ex.Message); }
            }
        }

        /// <summary>Elemanın verilen durumdaki simgesi (şeritteki durum listesinde).</summary>
        private static ImageSource DurumSimgesi(string tur, string cins, string durum, string dm)
        {
            try
            {
                var s = Semboller.Bul(Semboller.BlokAdi(tur, cins, durum, dm));
                if (s == null) return null;
                bool demontaj = Semboller.DemontajVaryanti(Semboller.Varyant(durum, dm));
                var renk = SeritSimgeleri.HexRenk(demontaj ? "#e6b800" : CizimStili.EkranElemanRengi(tur, cins), SeritSimgeleri.Notr);
                return SeritSimgeleri.SembolCiz(s, renk, 16, false);
            }
            catch { return null; }
        }

        /// <summary>Malzeme hafızası düğmesi: açık / kapalı görünümü ve ipucu (etkin öğe için kaç malzeme eklenecek).</summary>
        private static void Hafiza_()
        {
            if (_hafiza == null) return;
            _hafiza.IsChecked = HizliSecim.HafizaAcik;
            _hafiza.LargeImage = SeritSimgeleri.KomutSimgesi("hafiza", 32, HafizaRengi);
            _hafiza.Image = SeritSimgeleri.KomutSimgesi("hafiza", 16, HafizaRengi);
            var oge = HizliSecim.Oge;
            string ek = "";
            if (oge != null && oge.ElemanMi)
            {
                var t = HizliSecim.SeciliTip(oge, HizliSecim.TemelKatalog);
                string kaynak = "";
                var l = t != null ? HizliSecim.Hafiza.Bul(oge.Tur, t.Cins, t.Tanim, out kaynak) : null;
                ek = l != null && l.Count > 0 ? "\n\n" + oge.Ad + " · " + t.Tanim.Trim() + ": " + MalzemeHafizasi.Ozet(l, kaynak) : "\n\n" + oge.Ad + " için hafızada malzeme yok.";
            }
            _hafiza.ToolTip = (HizliSecim.HafizaAcik ? "AÇIK: " : "KAPALI: ") +
                              "yeni konan direğe, trafoya … aynı tür ve tipteki son elemanın malzemeleri kendiliğinden eklenir. Hafıza, bir elemanın malzemeleri düzenlenince (Malzeme, Toplu Malzeme) güncellenir." + ek;
        }

        private sealed class HafizaIsleyici : ICommand
        {
#pragma warning disable 67
            public event EventHandler CanExecuteChanged;
#pragma warning restore 67
            public bool CanExecute(object parameter) => true;

            public void Execute(object parameter)
            {
                try
                {
                    _yukleniyor = true;
                    try { HizliSecim.HafizaSec(!HizliSecim.HafizaAcik); }
                    finally { _yukleniyor = false; }
                    Hafiza_();
                    OzetiGoster();
                    Uygulama.Yaz("Şerit: malzeme hafızası " + (HizliSecim.HafizaAcik ? "açık — yeni elemanlara son malzemeler eklenir." : "kapalı."));
                }
                catch (Exception ex) { Uygulama.Yaz("Şerit: " + ex.Message); }
            }
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

        /// <summary>Sıradaki tıklamada çizilecek olanın tam yazısı "Ayrıntılı…" düğmesinin ipucunda (şeritte yer kaplamaz).</summary>
        private static void OzetiGoster()
        {
            if (_ayrinti == null) return;
            string ozet = HizliSecim.Oge != null ? HizliSecim.Ozet() : "";
            _ayrinti.ToolTip = (string.IsNullOrEmpty(ozet) ? "" : "Sıradaki tıklamada çizilecek: " + ozet + "\n\n") + AyrintiAciklamasi;
        }

        private static void TipSecildi(RibbonButton b)
        {
            var it = b != null ? b.Tag as KatalogKalemi : null;
            if (it == null || HizliSecim.Oge == null) return;
            _yukleniyor = true;
            try { HizliSecim.TipSec(HizliSecim.Oge, it); }
            finally { _yukleniyor = false; }
            // Aramadan gelen tip başka cinsten olabilir; cins ve durum simgeleri yenilensin
            OzetiGoster();
            YenileErtele();
        }

        private static void CinsSecildi(RibbonButton b)
        {
            string c = b != null ? b.Tag as string : null;
            if (string.IsNullOrEmpty(c) || HizliSecim.Oge == null) return;
            _aramaSonucu = null;
            _yukleniyor = true;
            try { HizliSecim.CinsSec(HizliSecim.Oge, c); }
            finally { _yukleniyor = false; }
            YenileErtele();
        }

        private static void AdetSecildi()
        {
            var b = _adet.Current as RibbonButton;
            if (b == null || HizliSecim.Oge == null) return;
            _yukleniyor = true;
            try { HizliSecim.AdetSec(HizliSecim.Oge, (int)b.Tag); }
            finally { _yukleniyor = false; }
            OzetiGoster();
        }

        private static void EkSecildi(RibbonButton b)
        {
            if (b == null || HizliSecim.Oge == null) return;
            _yukleniyor = true;
            try { HizliSecim.EkSec(HizliSecim.Oge, b.Tag as KatalogKalemi); }
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
            YenileErtele();
        }

        private static bool _yenileBekliyor;

        /// <summary>
        /// Şeritteki listeleri AutoCAD boşa çıkınca yeniden kurar: açılır liste kendi seçim olayının içindeyken öğeleri
        /// değiştirilmesin diye.
        /// </summary>
        private static void YenileErtele()
        {
            if (_yenileBekliyor) return;
            _yenileBekliyor = true;
            try { AcApp.Idle += BostaYenile; }
            catch { _yenileBekliyor = false; }
        }

        private static void BostaYenile(object sender, EventArgs e)
        {
            AcApp.Idle -= BostaYenile;
            _yenileBekliyor = false;
            try { SecimiGoster(); } catch { }
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

        /// <summary>Sekmenin başındaki Şebeke-M paneli: logo düğmesi (Hakkında: sürüm ve komut listesi).</summary>
        private static void MarkaPaneli(RibbonTab sekme)
        {
            var p = Panel(sekme, Marka.Ad);
            p.Items.Add(new RibbonButton
            {
                Text = "Hakkında",
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Large,
                Orientation = System.Windows.Controls.Orientation.Vertical,
                LargeImage = Marka.SeritSimgesi(32),
                Image = Marka.SeritSimgesi(16),
                ToolTip = Marka.Ad + " — " + Marka.Aciklama + ". Sürüm ve komut listesi.",
                CommandParameter = "_SH_HAKKINDA ",
                CommandHandler = new KomutIsleyici(),
            });
        }

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
