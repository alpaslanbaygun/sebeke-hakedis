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

            var proje = Panel(sekme, "Proje");
            proje.Items.Add(Dugme("PROMAGIS\nİçe Al", "Bu çizimdeki PROMAGIS verisini ortak proje dosyasına (.sebeke.json) aktarır.", "_SH_ICEAL ", "İA", Color.FromRgb(0x2F, 0x55, 0x97)));
            proje.Items.Add(Dugme("Proje\nÖzeti", "Çizimdeki bölge, direk, hat ve kanal sayılarını komut satırında gösterir.", "_SH_OZET ", "ÖZ", Color.FromRgb(0x3E, 0x7C, 0xB1)));

            var rapor = Panel(sekme, "Rapor");
            rapor.Items.Add(Dugme("Durum\nTespit", "Bu çizimden Durum Tespit raporunu Excel olarak üretir.", "_SH_RAPOR ", "DT", Color.FromRgb(0x1E, 0x7B, 0x4F)));
            rapor.Items.Add(Dugme("Dosyadan\nRapor", "Bir proje dosyasından (.sebeke.json) Durum Tespit raporu üretir.", "_SH_PROJERAPOR ", "PR", Color.FromRgb(0x2E, 0x8B, 0x57)));

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
