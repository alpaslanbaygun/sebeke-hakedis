using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Windows.Media.Imaging;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Şebeke-M markası: ad, logo ve simge. Görseller eklentiye gömülüdür (ortak/marka; üretici araclar/marka-uret.py).
    /// Logo beyaz zemin içindir: koyu pencerelerde beyaz kart üstünde, simge beyaz yuvarlak rozet olarak gösterilir.
    /// </summary>
    internal static class Marka
    {
        public const string Ad = "Şebeke-M";
        public const string AltBaslik = "Elektrik Dağıtım Projesi";
        public const string Aciklama = "Elektrik dağıtım şebekesi proje, hakediş ve durum tespit eklentisi";

        private static Image _logo;
        private static readonly Dictionary<int, Image> _simgeler = new Dictionary<int, Image>();
        private static readonly Dictionary<int, BitmapSource> _seritSimgeleri = new Dictionary<int, BitmapSource>();

        private static Stream Akis(string ad) => typeof(Marka).Assembly.GetManifestResourceStream("SebekeHakedis.marka." + ad);

        private static Image Oku(string ad)
        {
            try
            {
                using (var s = Akis(ad))
                {
                    if (s == null) return null;
                    using (var ham = Image.FromStream(s)) return new Bitmap(ham); // akış kapanınca da kullanılabilsin
                }
            }
            catch { return null; }
        }

        /// <summary>Tam logo (amblem + "Şebeke-M" + alt yazı), beyaz zemin; bulunamazsa null.</summary>
        public static Image Logo => _logo ?? (_logo = Oku("logo.png"));

        private static Cekirdek.JsonNesne _hakkinda;

        /// <summary>
        /// Hakkında metni (ortak/marka/hakkinda.json, eklentiye gömülü; telefon aynı dosyayı gösterir): slogan, amac (paragraflar),
        /// yapabildikler (başlık + maddeler). Bulunamazsa boş nesne.
        /// </summary>
        public static Cekirdek.JsonNesne Hakkinda
        {
            get
            {
                if (_hakkinda != null) return _hakkinda;
                try
                {
                    using (var s = Akis("hakkinda.json"))
                    {
                        if (s != null)
                            using (var r = new System.IO.StreamReader(s, System.Text.Encoding.UTF8))
                                _hakkinda = Cekirdek.Json.Oku(r.ReadToEnd()) as Cekirdek.JsonNesne;
                    }
                }
                catch { }
                return _hakkinda ?? (_hakkinda = new Cekirdek.JsonNesne());
            }
        }

        /// <summary>Beyaz rozet içinde amblem, istenen piksel boyutunda (en yakın gömülü boyuttan yüksek kaliteyle).</summary>
        public static Image Simge(int px)
        {
            px = Math.Max(8, px);
            Image s;
            if (_simgeler.TryGetValue(px, out s)) return s;
            int kaynak = px <= 16 ? 16 : px <= 24 ? 24 : px <= 32 ? 32 : 64;
            var ham = Oku("simge-" + kaynak + ".png");
            if (ham == null) return null;
            if (kaynak == px) s = ham;
            else
            {
                var b = new Bitmap(px, px);
                using (var g = Graphics.FromImage(b))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.DrawImage(ham, new Rectangle(0, 0, px, px));
                }
                ham.Dispose();
                s = b;
            }
            _simgeler[px] = s;
            return s;
        }

        /// <summary>Şerit düğmesi için simge (16 ya da 32 piksel).</summary>
        public static BitmapSource SeritSimgesi(int px)
        {
            int kaynak = px <= 16 ? 16 : px <= 24 ? 24 : px <= 32 ? 32 : 64;
            BitmapSource b;
            if (_seritSimgeleri.TryGetValue(kaynak, out b)) return b;
            try
            {
                using (var s = Akis("simge-" + kaynak + ".png"))
                {
                    if (s == null) return null;
                    var d = BitmapDecoder.Create(s, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
                    b = d.Frames[0];
                    b.Freeze();
                }
            }
            catch { return null; }
            _seritSimgeleri[kaynak] = b;
            return b;
        }
    }
}
