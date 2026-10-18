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
    /// Şerit simgeleri (AutoCAD'e bağlı değil; denemede de çizilir): öğelerde telefonun simgesi ve ekran rengi, telefonun
    /// koyu zemini üstünde. Elemanlar simge takımından (semboller.json), hatlar kendi renk ve desenleriyle (cizim-stili.json).
    /// </summary>
    internal static class SeritSimgeleri
    {
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

        private static ImageSource Resim(DrawingVisual dv, int boyut)
        {
            var bmp = new RenderTargetBitmap(boyut, boyut, 96, 96, PixelFormats.Pbgra32);
            bmp.Render(dv);
            bmp.Freeze();
            return bmp;
        }

        private static void ZeminCiz(DrawingContext dc, int boyut, Color renk)
        {
            double r0 = boyut / 6.0;
            dc.DrawRoundedRectangle(new SolidColorBrush(renk), null, new Rect(0.5, 0.5, boyut - 1, boyut - 1), r0, r0);
        }

        /// <summary>Dosya gerektirmeyen basit düğme simgesi: renkli kare üzerinde kısa yazı.</summary>
        public static ImageSource Simge(string harf, Color renk, int boyut)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                ZeminCiz(dc, boyut, renk);
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

        /// <summary>Kategori simgesi: kategorinin ilk öğesinin simgesi (AG Havai → AG direk, Kazı → kanal …).</summary>
        public static ImageSource KategoriSimgesi(MenuKategorisi k, int boyut)
        {
            if (k != null && k.Ogeler.Count > 0) return OgeSimgesi(k.Ogeler[0], boyut);
            return Simge(k != null ? k.Kisa : "?", k != null ? HexRenk(k.Renk, Colors.SlateGray) : Colors.SlateGray, boyut);
        }

        /// <summary>Öğe simgesi: elemanlarda telefonun simgesi (yeni durum, telefondaki renk), hatlarda çizgi deseni.</summary>
        public static ImageSource OgeSimgesi(MenuOgesi oge, int boyut)
        {
            try
            {
                switch (oge.Komut)
                {
                    case "SH_ELEMAN":
                        {
                            string cins = oge.Cinsler.Count > 0 ? oge.Cinsler[0] : IlkCins(oge.Tur);
                            var s = Semboller.Bul(Semboller.BlokAdi(oge.Tur, cins, "M"));
                            if (s != null) return SembolCiz(s, HexRenk(CizimStili.EkranElemanRengi(oge.Tur, cins), Colors.White), boyut);
                            break;
                        }
                    case "SH_HAT":
                        {
                            var k = CizimStili.HatStili(oge.Tur);
                            return CizgiCiz(HexRenk(CizimStili.EkranHatRengi(oge.Tur), Colors.White), k != null ? CizimStili.CizgiDeseni(k.Cizgi) : null, boyut, true);
                        }
                    case "SH_KANAL": return KanalCiz(boyut);
                    case "SH_SONDAJ": return CizgiCiz(Color.FromRgb(0xFB, 0xBF, 0x24), new[] { 2.0, -1.5 }, boyut, false);
                    case "SH_BOLGE": return BolgeCiz(boyut);
                    case "SH_NOKTAAL": return NoktaCiz(boyut);
                    case "SH_PROJEAL": return TelefonCiz(boyut, true);
                    case "SH_ICEAL": return TelefonCiz(boyut, false);
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
        public static ImageSource SembolCiz(Sembol s, Color renk, int boyut)
        {
            double enBuyuk = 0.5;
            Action<double, double> kapsa = (x, y) => enBuyuk = Math.Max(enBuyuk, Math.Max(Math.Abs(x), Math.Abs(y)));
            foreach (var i in s.Ilkeller)
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
            double c = boyut / 2.0, k = boyut * 0.38 / enBuyuk;
            Func<double, double, Point> P = (x, y) => new Point(c + x * k, c - y * k);
            var firca = new SolidColorBrush(renk);
            var kalem = new Pen(firca, Math.Max(1.0, boyut / 16.0));
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                ZeminCiz(dc, boyut, Zemin);
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
            return Resim(dv, boyut);
        }

        /// <summary>Hat simgesi: iki direk arasında hattın renginde ve deseninde çizgi.</summary>
        public static ImageSource CizgiCiz(Color renk, double[] desen, int boyut, bool direkler)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                ZeminCiz(dc, boyut, Zemin);
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
        public static ImageSource KanalCiz(int boyut)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                ZeminCiz(dc, boyut, Zemin);
                var renk = Color.FromRgb(0xFF, 0x6B, 0x6B); // telefonda yeraltı / kanal
                var kalem = new Pen(new SolidColorBrush(renk), Math.Max(1.0, boyut / 16.0));
                double m = boyut * 0.2, w = boyut * 0.18;
                dc.DrawLine(kalem, new Point(m, m), new Point(m + w, boyut - m));
                dc.DrawLine(kalem, new Point(boyut - m - w, boyut - m), new Point(boyut - m, m));
                dc.DrawLine(kalem, new Point(m + w, boyut - m), new Point(boyut - m - w, boyut - m));
                var ince = new Pen(new SolidColorBrush(Color.FromRgb(0xB4, 0x83, 0x4D)), Math.Max(1.0, boyut / 20.0));
                for (int i = 1; i <= 2; i++)
                {
                    double y = m + (boyut - 2 * m) * i / 3.0;
                    double sol = m + w * i / 3.0 + 1.5, sag = boyut - m - w * i / 3.0 - 1.5;
                    dc.DrawLine(ince, new Point(sol, y), new Point(sag, y));
                }
            }
            return Resim(dv, boyut);
        }

        private static ImageSource BolgeCiz(int boyut)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                ZeminCiz(dc, boyut, Zemin);
                var kalem = new Pen(new SolidColorBrush(HexRenk(CizimStili.Yuklu ? CizimStili.EkranRengi("bolge", "#fde047") : "#fde047", Colors.Gold)), Math.Max(1.0, boyut / 16.0))
                {
                    DashStyle = new DashStyle(new[] { 3.0, 2.0 }, 0),
                };
                double m = boyut * 0.2;
                var g = new StreamGeometry();
                using (var ctx = g.Open())
                {
                    ctx.BeginFigure(new Point(m, boyut * 0.35), false, true);
                    ctx.LineTo(new Point(boyut * 0.55, m), true, false);
                    ctx.LineTo(new Point(boyut - m, boyut * 0.45), true, false);
                    ctx.LineTo(new Point(boyut * 0.65, boyut - m), true, false);
                    ctx.LineTo(new Point(m * 1.2, boyut * 0.75), true, false);
                }
                g.Freeze();
                dc.DrawGeometry(null, kalem, g);
            }
            return Resim(dv, boyut);
        }

        private static ImageSource NoktaCiz(int boyut)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                ZeminCiz(dc, boyut, Zemin);
                var renk = HexRenk(CizimStili.Yuklu ? CizimStili.EkranRengi("nokta", "#e2e8f0") : "#e2e8f0", Colors.White);
                var kalem = new Pen(new SolidColorBrush(renk), Math.Max(1.0, boyut / 16.0));
                double c = boyut / 2.0, r = boyut * 0.28;
                dc.DrawLine(kalem, new Point(c - r - 2, c), new Point(c + r + 2, c));
                dc.DrawLine(kalem, new Point(c, c - r - 2), new Point(c, c + r + 2));
                dc.DrawEllipse(null, kalem, new Point(c, c), r * 0.6, r * 0.6);
            }
            return Resim(dv, boyut);
        }

        /// <summary>Telefon simgesi; al: aşağı ok (telefondan çizime), gönder: yukarı ok.</summary>
        private static ImageSource TelefonCiz(int boyut, bool al)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                ZeminCiz(dc, boyut, Zemin);
                var renk = al ? Color.FromRgb(0x22, 0xD3, 0xEE) : Color.FromRgb(0x8E, 0xA2, 0xFF);
                var kalem = new Pen(new SolidColorBrush(renk), Math.Max(1.0, boyut / 16.0));
                double w = boyut * 0.34, h = boyut * 0.62, x = boyut * 0.18, y = (boyut - h) / 2;
                dc.DrawRoundedRectangle(null, kalem, new Rect(x, y, w, h), boyut / 16.0, boyut / 16.0);
                double ax = boyut * 0.74, a0 = boyut * 0.28, a1 = boyut * 0.72;
                dc.DrawLine(kalem, new Point(ax, a0), new Point(ax, a1));
                double u = boyut * 0.1;
                if (al) { dc.DrawLine(kalem, new Point(ax - u, a1 - u), new Point(ax, a1)); dc.DrawLine(kalem, new Point(ax + u, a1 - u), new Point(ax, a1)); }
                else { dc.DrawLine(kalem, new Point(ax - u, a0 + u), new Point(ax, a0)); dc.DrawLine(kalem, new Point(ax + u, a0 + u), new Point(ax, a0)); }
            }
            return Resim(dv, boyut);
        }
    }
}
