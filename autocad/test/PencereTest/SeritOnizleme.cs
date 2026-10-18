using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using SebekeHakedis.Cekirdek;
using SebekeHakedis.Eklenti;

namespace SebekeHakedis.PencereTest
{
    /// <summary>
    /// Şerit menünün önizlemesi (AutoCAD olmadan): eklentinin şeridiyle aynı veri (kategoriler, öğeler, kısa tip
    /// listesi) ve aynı simgelerle, AutoCAD'in koyu temasına benzer bir görüntü çizer. Her kategori için bir PNG,
    /// açık kategori listesi ve AG Direk tip listesi. Gerçek şerit AutoCAD'in kendi denetimleriyle çizilir; yerleşim aynıdır.
    /// </summary>
    internal static class SeritOnizleme
    {
        private static readonly Color Arka = Color.FromRgb(0x3B, 0x44, 0x53);
        private static readonly Color Bant = Color.FromRgb(0x2F, 0x36, 0x42);
        private static readonly Color Ayrac = Color.FromRgb(0x26, 0x2C, 0x36);
        private static readonly Color Kutu = Color.FromRgb(0x27, 0x2D, 0x37);
        private static readonly Color KutuKenar = Color.FromRgb(0x5C, 0x65, 0x73);
        private static readonly Color Yazi = Color.FromRgb(0xEE, 0xF1, 0xF5);
        private static readonly Color Soluk = Color.FromRgb(0xA9, 0xB2, 0xC0);
        private static readonly Color Etkin = Color.FromRgb(0x4F, 0x6F, 0x96);
        private const double Yuk = 118, SekmeYuk = 26;

        private static FormattedText Metin(string s, double boy, Color renk, bool kalin = false)
        {
#pragma warning disable 618
            return new FormattedText(s ?? "", CultureInfo.GetCultureInfo("tr-TR"), FlowDirection.LeftToRight,
                new Typeface(new FontFamily("Segoe UI"), FontStyles.Normal, kalin ? FontWeights.SemiBold : FontWeights.Normal, FontStretches.Normal), boy, new SolidColorBrush(renk));
#pragma warning restore 618
        }

        public static void Hepsi(string klasor)
        {
            HizliSecim.Yukle();
            var kategoriler = Kategoriler.Hepsi();
            int n = 0;
            foreach (var k in kategoriler)
            {
                var oge = k.Ogeler.Find(x => x.TipliMi || x.Komut == "SH_KANAL") ?? (k.Ogeler.Count > 0 ? k.Ogeler[0] : null);
                HizliSecim.OgeSec(k, oge);
                Kaydet(SeritCiz(k, oge), Path.Combine(klasor, "14-serit-" + (++n).ToString("00", CultureInfo.InvariantCulture) + "-" + k.Kod + ".png"));
            }
            Kaydet(KategoriListesi(kategoriler), Path.Combine(klasor, "15-serit-kategori-listesi.png"));
            var agHavai = Kategoriler.Bul("AG_HAVAI");
            var agDirek = agHavai != null ? agHavai.Ogeler.Find(x => x.Tur == "AG_DIREK") : null;
            if (agDirek != null) Kaydet(TipListesi(agDirek), Path.Combine(klasor, "16-serit-tip-listesi-AG-direk.png"));
            var ogHavai = Kategoriler.Bul("OG_HAVAI");
            var ogHat = ogHavai != null ? ogHavai.Ogeler.Find(x => x.Tur == "OG_HAVAI") : null;
            if (ogHat != null) Kaydet(TipListesi(ogHat), Path.Combine(klasor, "17-serit-tip-listesi-OG-hat.png"));
            // Varsayılana dön (sonraki denemeler etkilenmesin)
            if (agHavai != null) HizliSecim.OgeSec(agHavai, agHavai.Ogeler[0]);
        }

        private static void Kaydet(DrawingVisual dv, string yol)
        {
            var b = dv.ContentBounds;
            int w = (int)Math.Ceiling(b.Right) + 2, h = (int)Math.Ceiling(b.Bottom) + 2;
            var bmp = new RenderTargetBitmap(Math.Max(w, 10), Math.Max(h, 10), 96, 96, PixelFormats.Pbgra32);
            bmp.Render(dv);
            var enc = new PngBitmapEncoder();
            enc.Frames.Add(BitmapFrame.Create(bmp));
            using (var f = File.Create(yol)) enc.Save(f);
            Console.WriteLine("    [şerit önizleme] " + Path.GetFileName(yol) + " (" + w + "×" + h + ")");
        }

        // ---------------- Şerit ----------------

        private static DrawingVisual SeritCiz(MenuKategorisi k, MenuOgesi etkin)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                var paneller = new List<Func<double, double>>
                {
                    x0 => KategoriPaneli(dc, x0, k),
                    x0 => HizliPanel(dc, x0, k, etkin),
                    x0 => SecimPaneli(dc, x0, etkin),
                    x0 => BuyukPanel(dc, x0, "Düzenle", new[] { ("Malzeme", "MZ", "#374151"), ("Metraj", "MT", "#4B5563"), ("Telefon\nGörünümü", "TG", "#0F766E"), ("Hakediş", "HK", "#9D174D"), ("Ayarlar", "AY", "#6B6B6B") }),
                    x0 => BuyukPanel(dc, x0, "Telefon", new[] { ("Telefondan\nAl", "TA", "#007A87"), ("Telefona\nGönder", "TG", "#2F5597") }),
                    x0 => BuyukPanel(dc, x0, "Rapor", new[] { ("Durum\nTespit", "DT", "#1E7B4F"), ("Dosyadan\nRapor", "PR", "#2E8B57"), ("Proje\nÖzeti", "ÖZ", "#3E7CB1") }),
                    x0 => BuyukPanel(dc, x0, "Yardım", new[] { ("Hakkında", "?", "#6B6B6B") }),
                };
                // Sekme şeridi (yalnız görüntü için; AutoCAD'in kendi sekmeleri)
                dc.DrawRectangle(new SolidColorBrush(Bant), null, new Rect(0, 0, 1900, SekmeYuk));
                var sekmeler = new[] { "Giriş", "Ekle", "Açıklama", "Parametrik", "Görünüş", "Yönet", "Çıktı", "ŞEBEKE HAKEDİŞ" };
                double sx = 8;
                foreach (var s in sekmeler)
                {
                    bool bu = s == "ŞEBEKE HAKEDİŞ";
                    var t = Metin(s, 12, bu ? Yazi : Soluk, bu);
                    if (bu) dc.DrawRectangle(new SolidColorBrush(Arka), null, new Rect(sx - 8, 3, t.Width + 16, SekmeYuk - 3));
                    dc.DrawText(t, new Point(sx, (SekmeYuk - t.Height) / 2 + 1));
                    sx += t.Width + 20;
                }
                double x = 0;
                foreach (var p in paneller)
                {
                    x += p(x);
                    dc.DrawRectangle(new SolidColorBrush(Ayrac), null, new Rect(x, SekmeYuk, 1, Yuk));
                    x += 1;
                }
            }
            return dv;
        }

        /// <summary>Panel zemini ve başlık bandı.</summary>
        private static void PanelZemini(DrawingContext dc, double x, double w, string baslik)
        {
            dc.DrawRectangle(new SolidColorBrush(Arka), null, new Rect(x, SekmeYuk, w, Yuk));
            dc.DrawRectangle(new SolidColorBrush(Bant), null, new Rect(x, SekmeYuk + Yuk - 20, w, 20));
            var t = Metin(baslik, 11.5, Soluk);
            dc.DrawText(t, new Point(x + (w - t.Width) / 2, SekmeYuk + Yuk - 20 + (20 - t.Height) / 2));
        }

        private static double MetinGenisligi(string s, double boy) { double m = 0; foreach (var satir in s.Split('\n')) m = Math.Max(m, Metin(satir, boy, Yazi).Width); return m; }

        private static double BuyukDugme(DrawingContext dc, double x, string yazi, ImageSource simge, bool etkin)
        {
            double w = Math.Max(52, MetinGenisligi(yazi, 11.5) + 12);
            if (etkin) dc.DrawRoundedRectangle(new SolidColorBrush(Etkin), new Pen(new SolidColorBrush(Color.FromRgb(0x7F, 0xA7, 0xD6)), 1), new Rect(x + 1, SekmeYuk + 4, w - 2, Yuk - 28), 3, 3);
            dc.DrawImage(simge, new Rect(x + (w - 32) / 2, SekmeYuk + 10, 32, 32));
            double y = SekmeYuk + 46;
            foreach (var satir in yazi.Split('\n'))
            {
                var t = Metin(satir, 11.5, Yazi);
                dc.DrawText(t, new Point(x + (w - t.Width) / 2, y));
                y += t.Height - 1;
            }
            return w;
        }

        private static double BuyukPanel(DrawingContext dc, double x, string baslik, (string yazi, string harf, string renk)[] dugmeler)
        {
            double w = 8;
            foreach (var d in dugmeler) w += Math.Max(52, MetinGenisligi(d.yazi, 11.5) + 12) + 2;
            w = Math.Max(w + 6, Metin(baslik, 11.5, Yazi).Width + 20);
            PanelZemini(dc, x, w, baslik);
            double bx = x + 6;
            foreach (var d in dugmeler) bx += BuyukDugme(dc, bx, d.yazi, SeritSimgeleri.Simge(d.harf, SeritSimgeleri.HexRenk(d.renk, Colors.Gray), 32), false) + 2;
            return w;
        }

        private static void KutuCiz(DrawingContext dc, double x, double y, double w, string yazi, ImageSource simge = null, bool soluk = false)
        {
            dc.DrawRectangle(new SolidColorBrush(Kutu), new Pen(new SolidColorBrush(KutuKenar), 1), new Rect(x, y, w, 22));
            double tx = x + 5;
            if (simge != null) { dc.DrawImage(simge, new Rect(x + 3, y + 3, 16, 16)); tx = x + 23; }
            var t = Metin(Kisalt(yazi, w - (tx - x) - 18, 11.5), 11.5, soluk ? Soluk : Yazi);
            dc.DrawText(t, new Point(tx, y + (22 - t.Height) / 2));
            // açılır ok
            var ok = new StreamGeometry();
            using (var g = ok.Open())
            {
                g.BeginFigure(new Point(x + w - 13, y + 9), true, true);
                g.LineTo(new Point(x + w - 5, y + 9), true, false);
                g.LineTo(new Point(x + w - 9, y + 14), true, false);
            }
            ok.Freeze();
            dc.DrawGeometry(new SolidColorBrush(Soluk), null, ok);
        }

        private static string Kisalt(string s, double w, double boy)
        {
            s = s ?? "";
            if (Metin(s, boy, Yazi).Width <= w) return s;
            while (s.Length > 1 && Metin(s + "…", boy, Yazi).Width > w) s = s.Substring(0, s.Length - 1);
            return s + "…";
        }

        private static double KategoriPaneli(DrawingContext dc, double x, MenuKategorisi k)
        {
            double w = 206;
            PanelZemini(dc, x, w, "Kategori");
            var l = Metin("Çizilecek şebeke", 11.5, Soluk);
            dc.DrawText(l, new Point(x + 8, SekmeYuk + 8));
            KutuCiz(dc, x + 8, SekmeYuk + 30, 190, k.Ad, SeritSimgeleri.KategoriSimgesi(k, 16));
            dc.DrawImage(SeritSimgeleri.Simge("…", Color.FromRgb(0x4B, 0x55, 0x63), 16), new Rect(x + 8, SekmeYuk + 62, 16, 16));
            dc.DrawText(Metin("Ayrıntılı…", 11.5, Yazi), new Point(x + 28, SekmeYuk + 61));
            return w;
        }

        private static double HizliPanel(DrawingContext dc, double x, MenuKategorisi k, MenuOgesi etkin)
        {
            double w = 8;
            foreach (var o in k.Ogeler) w += Math.Max(52, MetinGenisligi(Satirla(o.Ad), 11.5) + 12) + 2;
            string baslik = "Hızlı Çizim · " + k.Ad;
            w = Math.Max(w + 6, Metin(baslik, 11.5, Yazi).Width + 20);
            PanelZemini(dc, x, w, baslik);
            double bx = x + 6;
            foreach (var o in k.Ogeler) bx += BuyukDugme(dc, bx, Satirla(o.Ad), SeritSimgeleri.OgeSimgesi(o, 32), o == etkin) + 2;
            return w;
        }

        private static string Satirla(string ad)
        {
            int i = ad.IndexOf(' ');
            return i > 0 && ad.Length > 9 ? ad.Substring(0, i) + "\n" + ad.Substring(i + 1) : ad;
        }

        private static double SecimPaneli(DrawingContext dc, double x, MenuOgesi oge)
        {
            double w = 330;
            PanelZemini(dc, x, w, "Seçim");
            var liste = oge != null ? HizliSecim.KisaListe(oge) : new List<KatalogKalemi>();
            var secili = oge != null ? HizliSecim.SeciliTip(oge, HizliSecim.TemelKatalog) : null;
            string tip = secili != null ? secili.Tanim.Trim() : liste.Count > 0 ? liste[0].Tanim.Trim() : "(tip gerekmez)";
            double lx = x + 8, kx = x + 64;
            dc.DrawText(Metin("Tip", 11.5, Yazi), new Point(lx, SekmeYuk + 9));
            KutuCiz(dc, kx, SekmeYuk + 6, 210, tip, null, liste.Count == 0);
            dc.DrawImage(SeritSimgeleri.Simge("A", Color.FromRgb(0x37, 0x41, 0x51), 16), new Rect(kx + 216, SekmeYuk + 9, 16, 16));
            dc.DrawText(Metin("Ara", 11.5, Yazi), new Point(kx + 236, SekmeYuk + 8));
            dc.DrawText(Metin("Durum", 11.5, Yazi), new Point(lx, SekmeYuk + 37));
            KutuCiz(dc, kx, SekmeYuk + 34, 120, HizliSecim.Durum);
            KutuCiz(dc, kx + 126, SekmeYuk + 34, 86, string.IsNullOrEmpty(HizliSecim.DmDurum) ? "(yok)" : HizliSecim.DmDurum, null, !Turler.DemontajMi(HizliSecim.Durum));
            dc.DrawText(Metin("Hakediş", 11.5, Yazi), new Point(lx, SekmeYuk + 65));
            KutuCiz(dc, kx, SekmeYuk + 62, 120, HizliSecim.Hakedis > 0 ? HizliSecim.Hakedis + ". hakediş" : "Aktif hakediş");
            return w;
        }

        // ---------------- Açılır listeler ----------------

        private static DrawingVisual KategoriListesi(List<MenuKategorisi> l)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                double w = 260, h = 26 * l.Count + 8;
                dc.DrawRectangle(new SolidColorBrush(Kutu), new Pen(new SolidColorBrush(KutuKenar), 1), new Rect(0, 0, w, h));
                double y = 4;
                foreach (var k in l)
                {
                    if (k.Kod == "AG_HAVAI") dc.DrawRectangle(new SolidColorBrush(Etkin), null, new Rect(2, y, w - 4, 26));
                    dc.DrawImage(SeritSimgeleri.KategoriSimgesi(k, 16), new Rect(8, y + 5, 16, 16));
                    var t = Metin(k.Ad, 12, Yazi, true);
                    dc.DrawText(t, new Point(30, y + (26 - t.Height) / 2));
                    var ogeler = new List<string>();
                    foreach (var o in k.Ogeler) ogeler.Add(o.Ad);
                    var a = Metin(Kisalt(string.Join(", ", ogeler), w - 40 - t.Width - 10, 10.5), 10.5, Soluk);
                    dc.DrawText(a, new Point(30 + t.Width + 8, y + (26 - a.Height) / 2 + 1));
                    y += 26;
                }
            }
            return dv;
        }

        private static DrawingVisual TipListesi(MenuOgesi oge)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                var l = HizliSecim.KisaListe(oge);
                double w = 300, h = 34 * l.Count + 30;
                dc.DrawRectangle(new SolidColorBrush(Kutu), new Pen(new SolidColorBrush(KutuKenar), 1), new Rect(0, 0, w, h));
                dc.DrawText(Metin((oge.Kategori != null ? oge.Kategori.Ad + " › " : "") + oge.Ad + " · tip", 11, Soluk, true), new Point(8, 6));
                double y = 26;
                var secili = HizliSecim.SeciliTip(oge, HizliSecim.TemelKatalog);
                foreach (var it in l)
                {
                    if (it == secili) dc.DrawRectangle(new SolidColorBrush(Etkin), null, new Rect(2, y, w - 4, 34));
                    dc.DrawText(Metin(it.Tanim.Trim(), 12, Yazi, true), new Point(10, y + 2));
                    string ek = HizliSecim.TemelKatalog.CinsAdi(it.Cins);
                    string[] b = (it.Birim ?? "").Split('/');
                    if (b.Length > 1 && b[1] == "kg") ek += " · " + it.Katsayi.ToString("0.##", CultureInfo.GetCultureInfo("tr-TR")) + " kg";
                    if (!string.IsNullOrEmpty(it.PozNo)) ek += " · poz " + it.PozNo;
                    dc.DrawText(Metin(Kisalt(ek, w - 20, 10.5), 10.5, Soluk), new Point(10, y + 17));
                    y += 34;
                }
            }
            return dv;
        }
    }
}
