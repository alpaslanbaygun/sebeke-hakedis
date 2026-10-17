using System;
using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Autodesk.Windows;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

namespace SebekeHakedis.Eklenti
{
    /// <summary>AutoCAD şerit menüsüne "ŞEBEKE HAKEDİŞ" sekmesini ekler.</summary>
    internal static class Serit
    {
        private const string SekmeKimligi = "SEBEKE_HAKEDIS_SEKME";
        private static bool _bekliyor;

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

            var sekme = new RibbonTab { Title = "ŞEBEKE HAKEDİŞ", Id = SekmeKimligi };
            serit.Tabs.Add(sekme);

            var telefon = Panel(sekme, "Telefon");
            telefon.Items.Add(Dugme("Telefondan\nAl", "Telefondan gelen proje dosyasındaki (.sebeke.json, .volt.json ya da teslim paketi .zip) yeni ve değişen nesneleri bu çizime aktarır.", "_SH_PROJEAL ", "TA", Color.FromRgb(0x00, 0x7A, 0x87)));
            telefon.Items.Add(Dugme("Telefona\nGönder", "Bu çizimi telefonda açılacak proje dosyasına yazar (.sebeke.json ya da telefon biçimi .volt.json).", "_SH_ICEAL ", "TG", Color.FromRgb(0x2F, 0x55, 0x97)));

            var cizim = Panel(sekme, "Çizim");
            cizim.Items.Add(Dugme("Eleman", "Direk, box, pano, trafo, mufu koyar. Tip katalogdan seçilir, GIS numarası kendiliğinden verilir.", "_SH_ELEMAN ", "EL", Color.FromRgb(0xB4, 0x53, 0x09)));
            cizim.Items.Add(Dugme("Hat", "Direkten direğe hat çizer; metraj ve PROMAGIS etiketi kendiliğinden yazılır.", "_SH_HAT ", "HT", Color.FromRgb(0x1E, 0x7B, 0x4F)));
            cizim.Items.Add(Dugme("Kanal", "Kablo kanalı çizer; hacim kanal ölçülerinden hesaplanır.", "_SH_KANAL ", "KN", Color.FromRgb(0x8B, 0x5A, 0x2B)));
            cizim.Items.Add(Dugme("Sondaj", "Yatay sondaj (delgi) çizer.", "_SH_SONDAJ ", "SN", Color.FromRgb(0x6D, 0x28, 0xD9)));
            cizim.Items.Add(Dugme("Bölge", "Bölge (alt proje) sınırı çizer ya da var olan kapalı çizgiyi bölge yapar.", "_SH_BOLGE ", "BL", Color.FromRgb(0xA1, 0x62, 0x07)));
            cizim.Items.Add(Dugme("Nokta\nAl", "Ölçü noktalarını dosyadan (CSV/TXT) GPS noktası olarak alır.", "_SH_NOKTAAL ", "NK", Color.FromRgb(0x0E, 0x74, 0x90)));

            var duzen = Panel(sekme, "Düzenle");
            duzen.Items.Add(Dugme("Malzeme", "Seçilen direğin, hattın, kanalın ya da sondajın malzemelerini düzenler.", "_SH_MALZEME ", "MZ", Color.FromRgb(0x37, 0x41, 0x51)));
            duzen.Items.Add(Dugme("Metraj", "Seçilen hat, kanal ve sondajların metrajını çizim uzunluğundan yeniden hesaplar.", "_SH_METRAJ ", "MT", Color.FromRgb(0x4B, 0x55, 0x63)));
            duzen.Items.Add(Dugme("Hakediş", "Aktif hakedişi değiştirir; yeni nesneler bu hakedişin katmanlarına konur.", "_SH_HAKEDIS ", "HK", Color.FromRgb(0x9D, 0x17, 0x4D)));
            duzen.Items.Add(Dugme("Ayarlar", "Katman ön eki, sembol ölçeği, etiket yüksekliği, metraj payları.", "_SH_AYARLAR ", "AY", Color.FromRgb(0x6B, 0x6B, 0x6B)));

            var rapor = Panel(sekme, "Rapor");
            rapor.Items.Add(Dugme("Durum\nTespit", "Bu çizimden Durum Tespit raporunu Excel olarak üretir.", "_SH_RAPOR ", "DT", Color.FromRgb(0x1E, 0x7B, 0x4F)));
            rapor.Items.Add(Dugme("Dosyadan\nRapor", "Bir proje dosyasından (.sebeke.json, .volt.json ya da teslim paketi) Durum Tespit raporu üretir.", "_SH_PROJERAPOR ", "PR", Color.FromRgb(0x2E, 0x8B, 0x57)));
            rapor.Items.Add(Dugme("Proje\nÖzeti", "Çizimdeki bölge, direk, hat ve kanal sayılarını komut satırında gösterir.", "_SH_OZET ", "ÖZ", Color.FromRgb(0x3E, 0x7C, 0xB1)));

            var yardim = Panel(sekme, "Yardım");
            yardim.Items.Add(Dugme("Hakkında", "Sürüm ve komut listesi.", "_SH_HAKKINDA ", "?", Color.FromRgb(0x6B, 0x6B, 0x6B)));
        }

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

        /// <summary>Dosya gerektirmeyen basit düğme simgesi: renkli kare üzerinde iki harf.</summary>
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
                        boyut * 0.42, Brushes.White);
#pragma warning restore 618
                    dc.DrawText(yazi, new Point((boyut - yazi.Width) / 2, (boyut - yazi.Height) / 2));
                }
            }
            var bmp = new RenderTargetBitmap(boyut, boyut, 96, 96, PixelFormats.Pbgra32);
            bmp.Render(dv);
            bmp.Freeze();
            return bmp;
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
                var komut = dugme?.CommandParameter as string;
                var belge = AcApp.DocumentManager.MdiActiveDocument;
                if (belge == null || string.IsNullOrEmpty(komut)) return;
                belge.SendStringToExecute(komut, true, false, true);
            }
        }
    }
}
