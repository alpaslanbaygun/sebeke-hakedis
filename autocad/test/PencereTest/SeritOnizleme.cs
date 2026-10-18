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
    /// Şerit menünün önizlemesi (AutoCAD olmadan): eklentinin şeridiyle aynı veri (kategoriler, öğeler, kısa tip listesi,
    /// özet) ve aynı simgelerle, AutoCAD'in koyu temasına benzer bir görüntü çizer. Gerçek şerit AutoCAD'in kendi
    /// denetimleriyle çizilir (zemin rengi AutoCAD temasından); yerleşim ve simgeler aynıdır.
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
        private static readonly Color EtkinKenar = Color.FromRgb(0x7F, 0xA7, 0xD6);
        private const double Yuk = 118, SekmeYuk = 26, Satir = 30;

        /// <summary>Şeritteki kategori sütunları (Serit.cs ile aynı).</summary>
        private static readonly string[][] Sutunlar =
        {
            new[] { "AG_HAVAI", "OG_HAVAI", "MUSTEREK" },
            new[] { "AG_YERALTI", "OG_YERALTI", "KAZI" },
            new[] { "AYDINLATMA", "TRAFO", "ABONE" },
            new[] { "PROJE" },
        };

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
            SeritSimgeleri.KoyuTema = true;
            var kategoriler = Kategoriler.Hepsi();
            int n = 0;
            foreach (var k in kategoriler)
            {
                var oge = k.Ogeler.Find(x => x.TipliMi || x.Komut == "SH_KANAL") ?? (k.Ogeler.Count > 0 ? k.Ogeler[0] : null);
                HizliSecim.OgeSec(k, oge);
                Kaydet(SeritCiz(k, oge), Path.Combine(klasor, "14-serit-" + (++n).ToString("00", CultureInfo.InvariantCulture) + "-" + k.Kod + ".png"));
            }
            // Demontaj seçiliyken (Demontaj kutusu görünür)
            var agHavai = Kategoriler.Bul("AG_HAVAI");
            if (agHavai != null)
            {
                HizliSecim.OgeSec(agHavai, agHavai.Ogeler[0]);
                string eskiDurum = HizliSecim.Durum, eskiDm = HizliSecim.DmDurum;
                HizliSecim.DurumSec("DM", "SÖKÜK");
                Kaydet(SeritCiz(agHavai, agHavai.Ogeler[0]), Path.Combine(klasor, "15-serit-demontaj.png"));
                HizliSecim.DurumSec(eskiDurum, eskiDm);
            }
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
                    x0 => ElemanlarPaneli(dc, x0, k, etkin),
                    x0 => AyarlarPaneli(dc, x0, etkin),
                    x0 => BuyukPanel(dc, x0, "Düzenle", new (string, string, Color?)[] { ("Malzeme", "malzeme", null), ("Metraj", "metraj", null), ("Telefon\nGörünümü", "gorunum", null), ("Çizim\nAyarları", "ayarlar", null) }),
                    x0 => BuyukPanel(dc, x0, "Hakediş", new (string, string, Color?)[] { ("Aktif\nHakediş", "aktif_hakedis", Color.FromRgb(0x23, 0xA4, 0x55)), ("Hakediş\nOnayı", "onay", null) }),
                    x0 => BuyukPanel(dc, x0, "Telefon", new (string, string, Color?)[] { ("Telefondan\nAl", "telefon_al", Color.FromRgb(0x3B, 0xA4, 0xF6)), ("Telefona\nGönder", "telefon_gonder", Color.FromRgb(0x3B, 0xA4, 0xF6)) }),
                    x0 => BuyukPanel(dc, x0, "Rapor", new (string, string, Color?)[] { ("Durum\nTespit", "rapor", null), ("Dosyadan\nRapor", "dosya_rapor", null), ("Proje\nÖzeti", "ozet", null), ("Eksik\nMalzeme", "eksik", null) }),
                    x0 => BuyukPanel(dc, x0, "Yardım", new (string, string, Color?)[] { ("Hakkında", "bilgi", null) }),
                };
                // Sekme şeridi (yalnız görüntü için; AutoCAD'in kendi sekmeleri)
                dc.DrawRectangle(new SolidColorBrush(Bant), null, new Rect(0, 0, 2200, SekmeYuk));
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
                dc.DrawRectangle(new SolidColorBrush(Bant), null, new Rect(x, SekmeYuk, 2200 - x, Yuk));
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

        private static double MetinGenisligi(string s, double boy)
        {
            double m = 0;
            foreach (var satir in s.Split('\n')) m = Math.Max(m, Metin(satir, boy, Yazi).Width);
            return m;
        }

        private static void Vurgu(DrawingContext dc, Rect r) =>
            dc.DrawRoundedRectangle(new SolidColorBrush(Etkin), new Pen(new SolidColorBrush(EtkinKenar), 1), r, 3, 3);

        private static double BuyukDugme(DrawingContext dc, double x, string yazi, ImageSource simge, bool etkin)
        {
            double w = Math.Max(54, MetinGenisligi(yazi, 11.5) + 14);
            if (etkin) Vurgu(dc, new Rect(x + 1, SekmeYuk + 4, w - 2, Yuk - 28));
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

        private static double BuyukPanel(DrawingContext dc, double x, string baslik, (string yazi, string simge, Color? renk)[] dugmeler)
        {
            double w = 8;
            foreach (var d in dugmeler) w += Math.Max(54, MetinGenisligi(d.yazi, 11.5) + 14) + 2;
            w = Math.Max(w + 6, Metin(baslik, 11.5, Yazi).Width + 20);
            PanelZemini(dc, x, w, baslik);
            double bx = x + 6;
            foreach (var d in dugmeler) bx += BuyukDugme(dc, bx, d.yazi, SeritSimgeleri.KomutSimgesi(d.simge, 32, d.renk), false) + 2;
            return w;
        }

        /// <summary>Küçük düğme (16'lık simge + yazı); genişliğini döndürür.</summary>
        private static double KucukDugme(DrawingContext dc, double x, double y, string yazi, ImageSource simge, bool etkin, double enAz = 0)
        {
            var t = Metin(yazi, 11.5, Yazi);
            double w = Math.Max(enAz, 16 + 6 + t.Width + 10);
            if (etkin) Vurgu(dc, new Rect(x, y - 2, w, 24));
            dc.DrawImage(simge, new Rect(x + 4, y + 2, 16, 16));
            dc.DrawText(t, new Point(x + 26, y + (20 - t.Height) / 2));
            return w;
        }

        private static double KategoriPaneli(DrawingContext dc, double x, MenuKategorisi secili)
        {
            var sutunlar = new List<List<MenuKategorisi>>();
            foreach (var s in Sutunlar)
            {
                var l = new List<MenuKategorisi>();
                foreach (var kod in s) { var k = Kategoriler.Bul(kod); if (k != null) l.Add(k); }
                if (l.Count > 0) sutunlar.Add(l);
            }
            var genislik = new List<double>();
            double w = 8;
            foreach (var l in sutunlar)
            {
                double m = 0;
                foreach (var k in l) m = Math.Max(m, 16 + 6 + Metin(k.Ad, 11.5, Yazi).Width + 10);
                genislik.Add(m);
                w += m + 6;
            }
            w += 4;
            PanelZemini(dc, x, w, "Kategori");
            double cx = x + 8;
            for (int i = 0; i < sutunlar.Count; i++)
            {
                for (int r = 0; r < sutunlar[i].Count; r++)
                {
                    var k = sutunlar[i][r];
                    bool s = k == secili;
                    KucukDugme(dc, cx, SekmeYuk + 8 + r * Satir, k.Ad, SeritSimgeleri.KategoriSimgesi(k, 16, s), s, genislik[i]);
                }
                cx += genislik[i] + 6;
            }
            return w;
        }

        private static string Satirla(string ad)
        {
            int i = ad.IndexOf(' ');
            return i > 0 && ad.Length > 9 ? ad.Substring(0, i) + "\n" + ad.Substring(i + 1) : ad;
        }

        private static double ElemanlarPaneli(DrawingContext dc, double x, MenuKategorisi k, MenuOgesi etkin)
        {
            double w = 8;
            foreach (var o in k.Ogeler) w += Math.Max(54, MetinGenisligi(Satirla(o.Ad), 11.5) + 14) + 2;
            string baslik = "Elemanlar · " + k.Ad;
            w = Math.Max(w + 6, Metin(baslik, 11.5, Yazi).Width + 20);
            PanelZemini(dc, x, w, baslik);
            double bx = x + 6;
            foreach (var o in k.Ogeler) bx += BuyukDugme(dc, bx, Satirla(o.Ad), SeritSimgeleri.OgeSimgesi(o, 32, o == etkin), o == etkin) + 2;
            return w;
        }

        private static void KutuCiz(DrawingContext dc, double x, double y, double w, string yazi, bool soluk = false, bool acilir = true)
        {
            dc.DrawRectangle(new SolidColorBrush(Kutu), new Pen(new SolidColorBrush(KutuKenar), 1), new Rect(x, y, w, 22));
            var t = Metin(Kisalt(yazi, w - (acilir ? 24 : 10), 11.5), 11.5, soluk ? Soluk : Yazi, false);
            dc.DrawText(t, new Point(x + 5, y + (22 - t.Height) / 2));
            if (!acilir) return;
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

        private static double AyarlarPaneli(DrawingContext dc, double x, MenuOgesi oge)
        {
            bool tipli = oge != null && (oge.TipliMi || oge.Komut == "SH_KANAL");
            var secili = tipli ? HizliSecim.SeciliTip(oge, HizliSecim.TemelKatalog) : null;
            string tip = secili != null ? secili.Tanim.Trim() : oge == null ? "(öğe seçin)" : "(tip gerekmez)";
            bool dm = tipli && oge.ElemanMi && Turler.DemontajMi(HizliSecim.Durum);
            const double etiket = 62, kutu1 = 220, kutu2 = 130;
            double w = 8 + etiket + kutu1 + 14 + 1 + 10 + etiket + kutu2 + 12 + 66 + 6;
            PanelZemini(dc, x, w, "Ayarlar");
            double lx = x + 8, kx = lx + etiket, y0 = SekmeYuk + 7;
            dc.DrawText(Metin("Tip", 11.5, Yazi), new Point(lx, y0 + 3));
            KutuCiz(dc, kx, y0, kutu1, tip, !tipli);
            dc.DrawText(Metin("Ara", 11.5, Yazi), new Point(lx, y0 + Satir + 3));
            KutuCiz(dc, kx, y0 + Satir, kutu1, "tip ara (Enter)", true, false);
            var ozet = HizliSecim.Ozet();
            if (oge != null) dc.DrawImage(SeritSimgeleri.OgeSimgesi(oge, 16), new Rect(lx, y0 + 2 * Satir + 3, 16, 16));
            dc.DrawText(Metin(Kisalt(ozet, etiket + kutu1 - 22, 11.5), 11.5, Yazi, true), new Point(lx + 22, y0 + 2 * Satir + 3));
            double sx = kx + kutu1 + 14;
            dc.DrawRectangle(new SolidColorBrush(Ayrac), null, new Rect(sx, SekmeYuk + 8, 1, Yuk - 36));
            double lx2 = sx + 10, kx2 = lx2 + etiket;
            dc.DrawText(Metin("Durum", 11.5, tipli ? Yazi : Soluk), new Point(lx2, y0 + 3));
            KutuCiz(dc, kx2, y0, kutu2, HizliSecim.Durum, !tipli);
            dc.DrawText(Metin("Hakediş", 11.5, tipli ? Yazi : Soluk), new Point(lx2, y0 + Satir + 3));
            KutuCiz(dc, kx2, y0 + Satir, kutu2, HizliSecim.Hakedis > 0 ? HizliSecim.Hakedis + ". hakediş" : "Aktif hakediş", !tipli);
            if (dm)
            {
                dc.DrawText(Metin("Demontaj", 11.5, Yazi), new Point(lx2, y0 + 2 * Satir + 3));
                KutuCiz(dc, kx2, y0 + 2 * Satir, kutu2, string.IsNullOrEmpty(HizliSecim.DmDurum) ? "Yok" : HizliSecim.DmDurum);
            }
            BuyukDugme(dc, kx2 + kutu2 + 10, "Ayrıntılı…", SeritSimgeleri.KomutSimgesi("bilgi", 32), false);
            return w;
        }

        // ---------------- Açılır tip listesi ----------------

        private static DrawingVisual TipListesi(MenuOgesi oge)
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                var l = HizliSecim.KisaListe(oge);
                double w = 320, h = 36 * l.Count + 30;
                dc.DrawRectangle(new SolidColorBrush(Kutu), new Pen(new SolidColorBrush(KutuKenar), 1), new Rect(0, 0, w, h));
                dc.DrawText(Metin((oge.Kategori != null ? oge.Kategori.Ad + " › " : "") + oge.Ad + " · tip", 11, Soluk, true), new Point(8, 6));
                double y = 26;
                var secili = HizliSecim.SeciliTip(oge, HizliSecim.TemelKatalog);
                foreach (var it in l)
                {
                    if (it == secili) dc.DrawRectangle(new SolidColorBrush(Etkin), null, new Rect(2, y, w - 4, 36));
                    dc.DrawText(Metin(it.Tanim.Trim(), 12, Yazi, true), new Point(10, y + 2));
                    string ek = HizliSecim.TemelKatalog.CinsAdi(it.Cins);
                    string[] b = (it.Birim ?? "").Split('/');
                    if (b.Length > 1 && b[1] == "kg") ek += " · " + it.Katsayi.ToString("0.##", CultureInfo.GetCultureInfo("tr-TR")) + " kg";
                    if (!string.IsNullOrEmpty(it.PozNo)) ek += " · poz " + it.PozNo;
                    dc.DrawText(Metin(Kisalt(ek, w - 20, 10.5), 10.5, Soluk), new Point(10, y + 18));
                    y += 36;
                }
            }
            return dv;
        }
    }
}
