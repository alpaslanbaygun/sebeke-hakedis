using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Şerit ve pencere simgeleri (AutoCAD'e bağlı değil; denemede de çizilir). Kategori ve öğeler ince çizgi simgeleriyle,
    /// kategorinin renginde (Google Stitch tasarımı); seçili kategori / öğe renkli kare üstünde beyaz. Tip listelerinde
    /// elemanlar telefonun simge takımıyla (semboller.json) ve ekran rengiyle (cizim-stili.json) çizilir.
    /// </summary>
    internal static class SeritSimgeleri
    {
        /// <summary>AutoCAD koyu temada mı (COLORTHEME 0)? Renksiz simgeler buna göre açık ya da koyu çizilir.</summary>
        public static bool KoyuTema = true;

        /// <summary>Renksiz komut simgelerinin rengi (temaya göre).</summary>
        public static Color Notr => KoyuTema ? Color.FromRgb(0xE2, 0xE8, 0xF0) : Color.FromRgb(0x33, 0x41, 0x55);

        private static Color Zemin => HexRenk(CizimStili.Yuklu ? CizimStili.EkranZemini : "#0b1326", Color.FromRgb(0x0B, 0x13, 0x26));

        public static Color HexRenk(string hex, Color varsayilan)
        {
            try
            {
                var o = ColorConverter.ConvertFromString(hex);
                return o is Color ? (Color)o : varsayilan;
            }
            catch { return varsayilan; }
        }

        // ---------------- Adlar ve renkler ----------------

        /// <summary>Kategori rengi (koyu zeminde okunur; telefonun AG yeşili, OG kırmızısı …).</summary>
        public static Color KategoriRengi(MenuKategorisi k)
        {
            switch (k != null ? k.Kod : "")
            {
                case "AG_HAVAI":
                case "AG_YERALTI": return Color.FromRgb(0x23, 0xA4, 0x55);
                case "OG_HAVAI":
                case "OG_YERALTI": return Color.FromRgb(0xFF, 0x4D, 0x4D);
                case "MUSTEREK": return Color.FromRgb(0xE6, 0x4C, 0xE6);
                case "AYDINLATMA": return Color.FromRgb(0x3B, 0x8F, 0xE6);
                case "TRAFO": return Color.FromRgb(0x7C, 0x8C, 0xFF);
                case "ABONE": return Color.FromRgb(0xF5, 0x9E, 0x0B);
                case "KAZI": return Color.FromRgb(0xC9, 0x8A, 0x4B);
                case "PROJE": return Color.FromRgb(0x60, 0xA5, 0xFA);
                default: return HexRenk(k != null ? k.Renk : "", Colors.SlateGray);
            }
        }

        public static string KategoriSimgeAdi(MenuKategorisi k)
        {
            switch (k != null ? k.Kod : "")
            {
                case "AG_HAVAI": return "direk";
                case "AG_YERALTI": return "box";
                case "OG_HAVAI": return "direk_enh";
                case "OG_YERALTI": return "hat_yeralti";
                case "MUSTEREK": return "direk_mus";
                case "AYDINLATMA": return "armatur";
                case "TRAFO": return "kosk";
                case "ABONE": return "ev";
                case "KAZI": return "kanal";
                case "PROJE": return "konum";
                default: return k != null && k.Ogeler.Count > 0 ? OgeSimgeAdi(k.Ogeler[0]) : "diger";
            }
        }

        /// <summary>Eleman türünün simgesi (cinsler: menü öğesinin cins süzgeci; armatür ayrımı için).</summary>
        public static string ElemanSimgeAdi(string tur, IList<string> cinsler)
        {
            switch (tur ?? "")
            {
                case "AG_DIREK": return "direk";
                case "MUSTEREK_DIREK": return "direk_mus";
                case "AYD_DIREK": return "direk_ayd";
                case "ENH_DIREK": return "direk_enh";
                case "TRAFO_DIREGI": return "trafo_direk";
                case "TRAFO_MERKEZI": return "kosk";
                case "PANO": return "pano";
                case "BOX": return "box";
                case "EK_MUFU": return "mufu";
                case "KOFRE": return "kofre";
                case "DIGER":
                    if (cinsler != null) foreach (var c in cinsler) if ((c ?? "").StartsWith("ARMAT", StringComparison.OrdinalIgnoreCase)) return "armatur";
                    return "diger";
                default: return "diger";
            }
        }

        public static string HatSimgeAdi(string tur)
        {
            switch (tur ?? "")
            {
                case "AG_YERALTI":
                case "OG_YERALTI": return "hat_yeralti";
                case "REKORTMAN": return "abone_hat";
                default: return "hat_havai";
            }
        }

        public static string OgeSimgeAdi(MenuOgesi oge)
        {
            if (oge == null) return "diger";
            switch (oge.Komut)
            {
                case "SH_ELEMAN": return ElemanSimgeAdi(oge.Tur, oge.Cinsler);
                case "SH_HAT": return HatSimgeAdi(oge.Tur);
                case "SH_KANAL": return "kanal";
                case "SH_SONDAJ": return "sondaj";
                case "SH_BOLGE": return "bolge";
                case "SH_NOKTAAL": return "nokta";
                case "SH_PROJEAL": return "telefon_al";
                case "SH_ICEAL": return "telefon_gonder";
                default: return "diger";
            }
        }

        public static Color OgeRengi(MenuOgesi oge) => oge != null && oge.Kategori != null ? KategoriRengi(oge.Kategori) : Notr;

        // ---------------- Şerit simgeleri ----------------

        public static ImageSource KategoriSimgesi(MenuKategorisi k, int boyut, bool secili = false) =>
            ArayuzSimgeleri.Wpf(KategoriSimgeAdi(k), boyut, KategoriRengi(k), secili);

        public static ImageSource OgeSimgesi(MenuOgesi oge, int boyut, bool secili = false) =>
            ArayuzSimgeleri.Wpf(OgeSimgeAdi(oge), boyut, OgeRengi(oge), secili);

        /// <summary>Komut simgesi (Malzeme, Metraj, Rapor …); renk verilmezse temanın renksiz tonu.</summary>
        public static ImageSource KomutSimgesi(string ad, int boyut, Color? renk = null) =>
            ArayuzSimgeleri.Wpf(ad, boyut, renk ?? Notr);

        /// <summary>Eski düz simge (renkli kare üstünde kısa yazı); yeni simgesi olmayanlar için.</summary>
        public static ImageSource Simge(string harf, Color renk, int boyut)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                double r0 = boyut / 6.0;
                dc.DrawRoundedRectangle(new SolidColorBrush(renk), null, new Rect(0.5, 0.5, boyut - 1, boyut - 1), r0, r0);
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
            var bmp = new RenderTargetBitmap(boyut, boyut, 96, 96, PixelFormats.Pbgra32);
            bmp.Render(dv);
            bmp.Freeze();
            return bmp;
        }

        // ---------------- Telefonun simge takımı ----------------

        /// <summary>
        /// Simge takımındaki bir simgeyi (metre cinsinden ilkeller) çizer; zeminli: telefonun koyu zemini üstünde. Ölçek ailenin
        /// "mevcut" simgesinden alınır: bütün durumlar aynı boyda görünür, demontaj işaretleri ("/", "//", "X") kenara kadar uzar.
        /// </summary>
        public static ImageSource SembolCiz(Sembol s, Color renk, int boyut, bool zeminli = true)
        {
            double enBuyuk = 0.5;
            Action<double, double> kapsa = (x, y) => enBuyuk = Math.Max(enBuyuk, Math.Max(Math.Abs(x), Math.Abs(y)));
            var olcu = Semboller.Bul(Semboller.OnEk + s.Aile + "_MEVCUT") ?? s;
            // Demontaj işaretleri simgeden taşar (kafes direkte "/" ile "X"in farkı yalnız taşan uçlardadır): ölçek ailenin
            // kapsamına göre küçülür ki taşan uçlar simgede görünsün (köşede biraz kırpılır). Bütün varyantlar aynı ölçekte.
            enBuyuk = Math.Max(enBuyuk, s.Kapsam * 0.8);
            foreach (var i in olcu.Ilkeller)
            {
                var d = i.Sayilar;
                switch (i.Tur)
                {
                    case "L": if (d.Length >= 4) { kapsa(d[0], d[1]); kapsa(d[2], d[3]); } break;
                    case "C": if (d.Length >= 3) kapsa(Math.Abs(d[0]) + d[2], Math.Abs(d[1]) + d[2]); break;
                    case "D":
                    case "Y": if (d.Length >= 1) kapsa(d[0], d[0]); break;
                    default: foreach (var p in i.Noktalar) kapsa(p[0], p[1]); break;
                }
            }
            double c = boyut / 2.0, k = boyut * (zeminli ? 0.38 : 0.44) / enBuyuk;
            Func<double, double, Point> P = (x, y) => new Point(c + x * k, c - y * k);
            var firca = new SolidColorBrush(renk);
            var kalem = new Pen(firca, Math.Max(1.0, boyut / 16.0));
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                if (zeminli) dc.DrawRoundedRectangle(new SolidColorBrush(Zemin), null, new Rect(0.5, 0.5, boyut - 1, boyut - 1), boyut / 6.0, boyut / 6.0);
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
                                    ctx.ArcTo(P(0, -d[0]), new Size(r, r), 0, false, SweepDirection.Counterclockwise, true, false);
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
            var bmp = new RenderTargetBitmap(boyut, boyut, 96, 96, PixelFormats.Pbgra32);
            bmp.Render(dv);
            bmp.Freeze();
            return bmp;
        }

        /// <summary>Pencereler için telefon simgesi (zeminsiz, GDI resmi).</summary>
        public static System.Drawing.Bitmap SembolResmi(Sembol s, string renkHex, int px) =>
            ArayuzSimgeleri.Donustur((BitmapSource)SembolCiz(s, HexRenk(renkHex, Colors.White), px, false));
    }
}
