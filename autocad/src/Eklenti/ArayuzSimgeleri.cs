using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Arayüz simgeleri (şerit ve pencereler): 24×24 birimlik ince çizgi simgeleri, istenen renkte. "dolu": renkli
    /// yuvarlak kare üstünde beyaz simge (şeritte seçili kategori / öğe). Dosya gerektirmez; WPF ile çizilir,
    /// pencereler için GDI resmine çevrilir. AutoCAD'e bağlı değildir (denemede de çizilir).
    /// </summary>
    internal static class ArayuzSimgeleri
    {
        private static readonly Dictionary<string, ImageSource> _wpf = new Dictionary<string, ImageSource>(StringComparer.Ordinal);
        private static readonly Dictionary<string, System.Drawing.Bitmap> _gdi = new Dictionary<string, System.Drawing.Bitmap>(StringComparer.Ordinal);

        private static string F(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);

        /// <summary>Daire yolu (yol dilinde).</summary>
        private static string D(double cx, double cy, double r) =>
            "M" + F(cx - r) + "," + F(cy) + " A" + F(r) + "," + F(r) + " 0 1 0 " + F(cx + r) + "," + F(cy) +
            " A" + F(r) + "," + F(r) + " 0 1 0 " + F(cx - r) + "," + F(cy) + " Z";

        private const string Belge = "M6,3 H14 L19,8 V21 H6 Z";
        private const string BelgeKosesi = "M14,3 V8 H19";
        private const string Telefon = "M6.5,3 H11.5 Q13,3 13,4.5 V19.5 Q13,21 11.5,21 H6.5 Q5,21 5,19.5 V4.5 Q5,3 6.5,3 Z";

        /// <summary>
        /// Simgenin yolları. Önek: yok = çizgi, '!' = dolgu, '#' = dolgu + çizgi, '~' = kesik çizgi.
        /// </summary>
        private static string[] Yollar(string ad)
        {
            switch (ad)
            {
                // ---- Şebeke elemanları ----
                case "direk":
                    return new[] { "M12,3 V21", "M6,6.5 H18", "M8,10.5 H16", "M6.5,6.5 V8.5", "M17.5,6.5 V8.5", "M8.5,10.5 V12.3", "M15.5,10.5 V12.3", "M9,21 H15" };
                case "direk_enh":
                    return new[] { "M7.5,21 L12,3 L16.5,21", "M5,7 H19", "M6.8,11.5 H17.2", "M9.4,14.6 L15.4,20.2", "M14.6,14.6 L8.6,20.2" };
                case "direk_mus":
                    return new[] { "M12,3 V21", "M5,6 H19", "M7,10.5 H17", "M12,14 L8.5,10.5", "M12,14 L15.5,10.5", "M9,21 H15" };
                case "direk_ayd":
                    return new[] { "M8,21 V6.5 Q8,3.5 11,3.5 H15.5", "#M14.5,3.5 H20 L18.8,6.3 H15.7 Z", "M15.8,9.3 L15,11", "M17.3,9.3 V11.2", "M18.8,9.3 L19.6,11", "M5.5,21 H10.5" };
                case "trafo_direk":
                    return new[] { "M7,3 V21", "M17,3 V21", "M4.5,6 H19.5", "M9.2,11 H14.8 V17 H9.2 Z", "M5,21 H9", "M15,21 H19" };
                case "kosk":
                    return new[] { "M3.5,11 L12,4 L20.5,11", "M6,9.3 V20 H18 V9.3", "!M12.9,10 L9.7,14.9 H12.2 L11.1,18.6 L14.5,13.6 H11.9 Z" };
                case "pano":
                    return new[] { "M6,3.5 H18 V20.5 H6 Z", "!M12.9,6.5 L9.6,12.3 H12.3 L11.2,17.5 L14.6,11.4 H11.9 Z" };
                case "box":
                    return new[] { "M4,6.5 H20 V18 H4 Z", "M4,10.5 H20", "M9.5,10.5 V18", "M14.5,10.5 V18" };
                case "mufu":
                    return new[] { "M2.5,12 H6", "M18,12 H21.5", "M6,8 H18 V16 H6 Z", "M10,8 V16", "M14,8 V16" };
                case "kofre":
                    return new[] { "M6,3.5 H18 V20.5 H6 Z", D(12, 9.5, 2.6), "M9,15 H15", "M9,17.6 H13" };
                case "armatur":
                    return new[] { "M12,3.5 V7.5", "#M5,7.5 H19 L16.5,12 H7.5 Z", "M8.5,15 L7.5,17.5", "M12,15 V18", "M15.5,15 L16.5,17.5" };
                case "diger":
                    return new[] { D(12, 12, 8.5), "!" + D(8.2, 12, 1.3), "!" + D(12, 12, 1.3), "!" + D(15.8, 12, 1.3) };

                // ---- Hatlar, kazı ----
                case "hat_havai":
                    return new[] { "M4,6.5 V21", "M20,6.5 V21", "M2,7.5 H6", "M18,7.5 H22", "M4,7.5 Q12,16.5 20,7.5" };
                case "hat_yeralti":
                    return new[] { "M2,8 H22", "M5,8 L3.5,10.3", "M10,8 L8.5,10.3", "M15,8 L13.5,10.3", "M20,8 L18.5,10.3", "M3,16 Q6,13 9,16 T15,16 T21,16" };
                case "abone_hat":
                    return new[] { "M5,4 V21", "M3,5.5 H7", "M5,5.5 Q11.5,6.5 17.5,9.6", "M13.2,13.4 L17.5,9.6 L21.8,13.4", "M14.5,12.3 V20 H20.5 V12.3" };
                case "kanal":
                    return new[] { "M2,6.5 H5.5", "M18.5,6.5 H22", "M5.5,6.5 L8,19 H16 L18.5,6.5", "!" + D(10.4, 15.4, 1.6), "!" + D(13.8, 15.4, 1.6) };
                case "sondaj":
                    return new[] { "M2,7 H22", "M5,7 L3.5,9.3", "M10,7 L8.5,9.3", "M15,7 L13.5,9.3", "M20,7 L18.5,9.3", "M3.5,15 H15.5", "!M15,11.4 L21,15 L15,18.6 Z" };

                // ---- Proje ----
                case "bolge":
                    return new[] { "~M4,8.5 L11,3.5 L20,7.5 L18.5,18.5 L7,20.5 Z" };
                case "nokta":
                    return new[] { D(12, 12, 5), "M12,2.5 V7", "M12,17 V21.5", "M2.5,12 H7", "M17,12 H21.5", "!" + D(12, 12, 1.4) };
                case "konum":
                    return new[] { "M12,21 Q5,13.5 5,9.5 A7,7 0 0 1 19,9.5 Q19,13.5 12,21 Z", D(12, 9.5, 2.6) };
                case "ev":
                    return new[] { "M3.5,11 L12,4 L20.5,11", "M5.8,9.2 V20 H18.2 V9.2", "M10,20 V14.5 H14 V20" };
                case "telefon_al":
                    return new[] { Telefon, "M8,18 H10", "M18.5,5 V15", "M15.6,12.1 L18.5,15 L21.4,12.1" };
                case "telefon_gonder":
                    return new[] { Telefon, "M8,18 H10", "M18.5,15 V5", "M15.6,7.9 L18.5,5 L21.4,7.9" };

                // ---- Komutlar ----
                case "malzeme":
                    return new[] { "M12,3 L21,7.8 L12,12.6 L3,7.8 Z", "M3,12 L12,16.8 L21,12", "M3,16.2 L12,21 L21,16.2" };
                case "hafiza":
                    // malzeme küpü + geri dönen ok (son malzemeler yeniden kullanılır)
                    return new[] { "M20,12 A8,8 0 1 1 17.66,6.34", "M17.4,2.8 V6.6 H21.2", "M12,8.4 L15.4,10.2 L12,12 L8.6,10.2 Z", "M8.6,10.2 V13.9 L12,15.7 L15.4,13.9 V10.2", "M12,12 V15.7" };
                case "toplu":
                    // üç küçük direk + artı (seçilenlere toplu malzeme)
                    return new[] { "M5,8 V20", "M3,10 H7", "M11,8 V20", "M9,10 H13", "M17,13 V20", "M15,15 H19", "M18.5,3 V9", "M15.5,6 H21.5" };
                case "metraj":
                    return new[] { "M3,16.5 L16.5,3 L21,7.5 L7.5,21 Z", "M7,12.5 L9,14.5", "M10,9.5 L12.5,12", "M13,6.5 L15,8.5" };
                case "gorunum":
                    return new[] { "M2,12 Q12,3 22,12 Q12,21 2,12 Z", D(12, 12, 3.2) };
                case "ayarlar":
                    {
                        var l = new List<string> { D(12, 12, 6.3), D(12, 12, 2.4) };
                        for (int i = 0; i < 8; i++)
                        {
                            double a = i * Math.PI / 4;
                            double c = Math.Cos(a), s = Math.Sin(a);
                            l.Add("M" + F(12 + 6.6 * c) + "," + F(12 + 6.6 * s) + " L" + F(12 + 9.6 * c) + "," + F(12 + 9.6 * s));
                        }
                        return l.ToArray();
                    }
                case "aktif_hakedis":
                    return new[] { D(12, 12, 9), "M7.8,12.4 L10.8,15.4 L16.4,9.2" };
                case "onay":
                    return new[] { Belge, BelgeKosesi, "M8.8,14.5 L11.2,17 L15.5,12.2" };
                case "rapor":
                    return new[] { Belge, BelgeKosesi, "M9,12 H16", "M9,15 H16", "M9,18 H13.5" };
                case "dosya_rapor":
                    return new[] { Belge, BelgeKosesi, "M12.5,10.5 V18.5", "M9.8,15.8 L12.5,18.5 L15.2,15.8" };
                case "ozet":
                    return new[] { "M3.5,20.5 H20.5", "M6.5,20.5 V13", "M10.5,20.5 V8", "M14.5,20.5 V11", "M18.5,20.5 V5" };
                case "eksik":
                    return new[] { Belge, BelgeKosesi, D(12.3, 14, 2.8), "M14.3,16 L17,18.7" };

                // ---- CBS ve harita ----
                case "kml":
                    // yerküre: daire, ekvator, iki meridyen
                    return new[] { D(12, 12, 8.5), "M3.5,12 H20.5", "M12,3.5 Q6.8,12 12,20.5", "M12,3.5 Q17.2,12 12,20.5", "M5,7.8 H19", "M5,16.2 H19" };
                case "cbs_ver":
                    // katlanmış harita + dışarı ok
                    return new[] { "M3,6.5 L7,5 L11,6.5 L15,5 V17 L11,18.5 L7,17 L3,18.5 Z", "M7,5 V17", "M11,6.5 V18.5", "M16.5,12 H21.5", "M19.2,9.7 L21.5,12 L19.2,14.3" };
                case "cbs_al":
                    // katlanmış harita + içeri ok
                    return new[] { "M3,6.5 L7,5 L11,6.5 L15,5 V17 L11,18.5 L7,17 L3,18.5 Z", "M7,5 V17", "M11,6.5 V18.5", "M21.5,12 H16.5", "M18.8,9.7 L16.5,12 L18.8,14.3" };
                case "altlik":
                    // üst üste harita katmanları
                    return new[] { "M12,3.5 L20.5,8.3 L12,13.1 L3.5,8.3 Z", "M3.5,12.3 L12,17.1 L20.5,12.3", "M3.5,16.1 L12,20.9 L20.5,16.1" };

                // ---- Genel ----
                case "bilgi":
                    return new[] { D(12, 12, 9), "M12,11 V16.5", "!" + D(12, 7.7, 1.25) };
                case "ara":
                    return new[] { D(10.5, 10.5, 6.5), "M15.3,15.3 L20.5,20.5" };
                case "kilit":
                    return new[] { "M6,11 H18 V20.5 H6 Z", "M8.8,11 V8.3 A3.2,3.2 0 0 1 15.2,8.3 V11", "!" + D(12, 15.6, 1.3) };
                case "uyari":
                    return new[] { "M12,3.5 L21.5,20 H2.5 Z", "M12,9.5 V14", "!" + D(12, 16.9, 1.15) };
                case "hata":
                    return new[] { D(12, 12, 9), "M9,9 L15,15", "M15,9 L9,15" };
                case "soru":
                    return new[] { D(12, 12, 9), "M9.6,9.4 Q9.8,7 12,7 Q14.4,7 14.4,9.2 Q14.4,11 12,12 V13.6", "!" + D(12, 16.9, 1.2) };
                case "arti":
                    return new[] { "M12,5 V19", "M5,12 H19" };
                case "sil":
                    return new[] { "M4.5,7 H19.5", "M9.5,7 V4.5 H14.5 V7", "M6.5,7 L7.5,20.5 H16.5 L17.5,7", "M10.5,10.5 V17", "M13.5,10.5 V17" };
                case "kapat":
                    return new[] { "M6,6 L18,18", "M18,6 L6,18" };
                case "tamam":
                    return new[] { "M5,12.5 L10,17.5 L19,7" };
                case "tamam_daire":
                    return new[] { "#" + D(12, 12, 8.5) };
                case "bekliyor":
                    return new[] { D(12, 12, 7.5) };
                case "excel":
                    return new[] { "M4.5,4 H19.5 V20 H4.5 Z", "M4.5,9 H19.5", "M4.5,14 H19.5", "M10,4 V20" };
                case "sec":
                    return new[] { "M5,3.5 L18.5,12 L12.3,13.3 L15.8,20.2 L13.5,21.3 L10,14.4 L5.5,18.5 Z" };
                case "asagi":
                    return new[] { "M6,9 L12,15 L18,9" };
                case "yukari":
                    return new[] { "M6,15 L12,9 L18,15" };
                case "sag":
                    return new[] { "M9,6 L15,12 L9,18" };

                // ---- Teknik hesaplar ----
                case "hesap_merkezi":
                    // hesap makinesi: ekran + tuşlar
                    return new[] { "M6,3 H18 V21 H6 Z", "M8.5,5.5 H15.5 V9 H8.5 Z", "!" + D(9.3, 12.3, 1.1), "!" + D(12, 12.3, 1.1), "!" + D(14.7, 12.3, 1.1), "!" + D(9.3, 15.5, 1.1), "!" + D(12, 15.5, 1.1), "!" + D(14.7, 15.5, 1.1), "!" + D(9.3, 18.6, 1.1), "M11.3,18.6 H15.4" };
                case "hesap_kayit":
                    // belge + onay (kayıtlı hesap sonuçları)
                    return new[] { Belge, BelgeKosesi, "M9,12 H14", "M9,15 H12", "M12.3,18.6 L14.3,20.6 L18.3,16.3" };
                case "hesap_direk":
                    // direk + yatay kuvvet oku (tepe kuvveti, sehim)
                    return new[] { "M9,4 V21", "M4,7 H14", "M5.5,10.5 H12.5", "M6,21 H12", "M14,13 H21", "M18.5,10.5 L21,13 L18.5,15.5", "M14,16.5 Q17,19.5 20,16.5" };
                case "hesap_elektrik":
                    // şimşek (gerilim düşümü, kısa devre)
                    return new[] { "!M13.6,3 L6,13.4 H11.4 L10.2,21 L18,10.6 H12.6 Z" };
                case "tekhat":
                    // tek hat şeması: bara, üç çıkış, kesici kutuları
                    return new[] { "M3.5,7 H20.5", "M7,7 V20.5", "M12,7 V20.5", "M17,7 V20.5", "M5.5,11.5 H8.5 V14.5 H5.5 Z", "M10.5,13.5 H13.5 V16.5 H10.5 Z", "M15.5,11.5 H18.5 V14.5 H15.5 Z", "M12,3.5 V7" };
                case "yerlesim":
                    // yerleşim planı: çerçeve içinde kutular
                    return new[] { "M3.5,4.5 H20.5 V19.5 H3.5 Z", "M6.5,7.5 H11 V12 H6.5 Z", "M13,7.5 H17.5 V12 H13 Z", "M6.5,14.5 H17.5 V16.8 H6.5 Z" };
                default:
                    return new[] { D(12, 12, 8) };
            }
        }

        /// <summary>Simgeyi verilen çizim bağlamına çizer (0,0 – boyut,boyut alanına).</summary>
        public static void Ciz(DrawingContext dc, string ad, double boyut, Color renk, bool dolu = false)
        {
            double k = boyut / 24.0;
            Color cizgiRengi = renk;
            int itme = 0;
            if (dolu)
            {
                var zemin = new SolidColorBrush(renk);
                zemin.Freeze();
                dc.DrawRoundedRectangle(zemin, null, new Rect(0, 0, boyut, boyut), boyut * 0.22, boyut * 0.22);
                cizgiRengi = Colors.White;
                dc.PushTransform(new TranslateTransform(boyut * 0.14, boyut * 0.14));
                itme++;
                k *= 0.72;
            }
            dc.PushTransform(new ScaleTransform(k, k));
            itme++;
            double kalinlik = boyut <= 16 ? 2.0 : boyut <= 24 ? 1.8 : 1.6;
            if (dolu) kalinlik *= 1.15;
            var firca = new SolidColorBrush(cizgiRengi);
            firca.Freeze();
            var kalem = new Pen(firca, kalinlik) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round };
            kalem.Freeze();
            var kesik = new Pen(firca, kalinlik) { DashStyle = new DashStyle(new[] { 1.4, 1.5 }, 0), DashCap = PenLineCap.Round, LineJoin = PenLineJoin.Round };
            kesik.Freeze();
            foreach (var parca in Yollar(ad))
            {
                if (string.IsNullOrEmpty(parca)) continue;
                char t = parca[0];
                string yol = t == '!' || t == '#' || t == '~' ? parca.Substring(1) : parca;
                Geometry g;
                try { g = Geometry.Parse(yol); }
                catch { continue; }
                if (t == '!') dc.DrawGeometry(firca, null, g);
                else if (t == '#') dc.DrawGeometry(firca, kalem, g);
                else if (t == '~') dc.DrawGeometry(null, kesik, g);
                else dc.DrawGeometry(null, kalem, g);
            }
            for (int i = 0; i < itme; i++) dc.Pop();
        }

        /// <summary>
        /// Şerit simgesi (WPF). boyut: mantıksal boyut (16 / 32); resim iki kat çözünürlükte çizilir (yüksek DPI'da keskin).
        /// </summary>
        public static ImageSource Wpf(string ad, int boyut, Color renk, bool dolu = false)
        {
            string anahtar = ad + "|" + boyut + "|" + renk + "|" + dolu;
            ImageSource s;
            if (_wpf.TryGetValue(anahtar, out s)) return s;
            const double kat = 2;
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen()) Ciz(dc, ad, boyut, renk, dolu);
            int px = (int)Math.Round(boyut * kat);
            var bmp = new RenderTargetBitmap(px, px, 96 * kat, 96 * kat, PixelFormats.Pbgra32);
            bmp.Render(dv);
            bmp.Freeze();
            _wpf[anahtar] = bmp;
            return bmp;
        }

        /// <summary>Pencere simgesi (GDI). px: ekran pikseli (DPI ölçeği uygulanmış).</summary>
        public static System.Drawing.Bitmap Gdi(string ad, int px, System.Drawing.Color renk, bool dolu = false)
        {
            string anahtar = ad + "|" + px + "|" + renk.ToArgb() + "|" + dolu;
            System.Drawing.Bitmap b;
            if (_gdi.TryGetValue(anahtar, out b)) return b;
            var wc = Color.FromArgb(renk.A, renk.R, renk.G, renk.B);
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen()) Ciz(dc, ad, px, wc, dolu);
            var rtb = new RenderTargetBitmap(Math.Max(1, px), Math.Max(1, px), 96, 96, PixelFormats.Pbgra32);
            rtb.Render(dv);
            b = Donustur(rtb);
            _gdi[anahtar] = b;
            return b;
        }

        /// <summary>WPF resmini GDI resmine çevirir (aynı piksel düzeni: önçarpımlı BGRA).</summary>
        public static System.Drawing.Bitmap Donustur(BitmapSource kaynak)
        {
            BitmapSource src = kaynak;
            if (src.Format != PixelFormats.Pbgra32) src = new FormatConvertedBitmap(kaynak, PixelFormats.Pbgra32, null, 0);
            int w = Math.Max(1, src.PixelWidth), h = Math.Max(1, src.PixelHeight);
            var bmp = new System.Drawing.Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
            var veri = bmp.LockBits(new System.Drawing.Rectangle(0, 0, w, h), System.Drawing.Imaging.ImageLockMode.WriteOnly, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
            try { src.CopyPixels(Int32Rect.Empty, veri.Scan0, veri.Stride * h, veri.Stride); }
            finally { bmp.UnlockBits(veri); }
            return bmp;
        }
    }
}
