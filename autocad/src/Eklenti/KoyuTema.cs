using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace SebekeHakedis.Eklenti
{
    // =====================================================================================================
    // Koyu tema: renkler, yazılar, ölçek ve pencerelerin ortak parçaları (Google Stitch tasarımı, koyu).
    // Hepsi Windows Forms'un kendi denetimlerinden türer; klavye (Tab, Enter, Esc) ve AutoCAD'in modal penceresi aynen çalışır.
    // =====================================================================================================

    /// <summary>
    /// Arayüz renkleri: koyu (telefonun koyu lacivert zemini) ve açık tema (13.11.2026); vurgu her ikisinde AG yeşili.
    /// Etkin tema <see cref="Tema"/>'dan; pencere açılırken seçilir (açık pencere tema değişince değişmez).
    /// </summary>
    internal static class KoyuRenk
    {
        public static Color Arka => Tema.Acik ? Color.FromArgb(0xF3, 0xF5, 0xF8) : Color.FromArgb(0x16, 0x22, 0x33);
        public static Color Baslik => Tema.Acik ? Color.FromArgb(0xE6, 0xEB, 0xF1) : Color.FromArgb(0x10, 0x1A, 0x29);
        public static Color Kart => Tema.Acik ? Color.FromArgb(0xFF, 0xFF, 0xFF) : Color.FromArgb(0x1C, 0x2A, 0x3E);
        public static Color Kutu => Tema.Acik ? Color.FromArgb(0xFF, 0xFF, 0xFF) : Color.FromArgb(0x0F, 0x19, 0x27);
        public static Color Kenar => Tema.Acik ? Color.FromArgb(0xCB, 0xD4, 0xDF) : Color.FromArgb(0x2C, 0x3D, 0x55);
        public static Color KenarAcik => Tema.Acik ? Color.FromArgb(0x9A, 0xA8, 0xBA) : Color.FromArgb(0x45, 0x5C, 0x7D);
        public static Color Uzerinde => Tema.Acik ? Color.FromArgb(0xE8, 0xEE, 0xF5) : Color.FromArgb(0x24, 0x35, 0x4D);
        public static Color Yazi => Tema.Acik ? Color.FromArgb(0x0F, 0x1B, 0x2A) : Color.FromArgb(0xE6, 0xED, 0xF5);
        public static Color Ikincil => Tema.Acik ? Color.FromArgb(0x3C, 0x4A, 0x5D) : Color.FromArgb(0x9D, 0xAB, 0xBF);
        public static Color Soluk => Tema.Acik ? Color.FromArgb(0x66, 0x76, 0x8B) : Color.FromArgb(0x66, 0x76, 0x8D);
        public static Color Vurgu => Tema.Acik ? Color.FromArgb(0x16, 0x9B, 0x5A) : Color.FromArgb(0x16, 0x9B, 0x5A);
        public static Color VurguAcik => Tema.Acik ? Color.FromArgb(0x1D, 0xB2, 0x69) : Color.FromArgb(0x1D, 0xB2, 0x69);
        public static Color VurguKoyu => Tema.Acik ? Color.FromArgb(0x11, 0x7E, 0x49) : Color.FromArgb(0x11, 0x7E, 0x49);
        public static Color VurguPasif => Tema.Acik ? Color.FromArgb(0xD3, 0xEE, 0xDF) : Color.FromArgb(0x1D, 0x3A, 0x31);
        public static Color Yesil => Tema.Acik ? Color.FromArgb(0x12, 0x80, 0x4A) : Color.FromArgb(0x34, 0xC7, 0x7B);
        public static Color Secili => Tema.Acik ? Color.FromArgb(0xD9, 0xF2, 0xE5) : Color.FromArgb(0x13, 0x3B, 0x2D);
        public static Color Mavi => Tema.Acik ? Color.FromArgb(0x1F, 0x6F, 0xD1) : Color.FromArgb(0x1F, 0x6F, 0xD1);
        public static Color MaviAcik => Tema.Acik ? Color.FromArgb(0x1F, 0x5F, 0xBF) : Color.FromArgb(0x60, 0xA5, 0xFA);
        public static Color Gri => Tema.Acik ? Color.FromArgb(0x94, 0xA3, 0xB8) : Color.FromArgb(0x47, 0x55, 0x69);
        public static Color Sari => Tema.Acik ? Color.FromArgb(0x9A, 0x67, 0x00) : Color.FromArgb(0xF7, 0xCB, 0x55);
        public static Color Kirmizi => Tema.Acik ? Color.FromArgb(0xC4, 0x28, 0x3A) : Color.FromArgb(0xFF, 0x6B, 0x78);
        public static Color BilgiZemin => Tema.Acik ? Color.FromArgb(0xE8, 0xF1, 0xFD) : Color.FromArgb(0x12, 0x29, 0x48);
        public static Color BilgiKenar => Tema.Acik ? Color.FromArgb(0xA9, 0xC8, 0xF2) : Color.FromArgb(0x1F, 0x4E, 0x86);
        public static Color BilgiYazi => Tema.Acik ? Color.FromArgb(0x1B, 0x4E, 0x8C) : Color.FromArgb(0xA5, 0xCF, 0xFF);
        public static Color UyariZemin => Tema.Acik ? Color.FromArgb(0xFF, 0xF5, 0xD6) : Color.FromArgb(0x35, 0x2A, 0x0E);
        public static Color UyariKenar => Tema.Acik ? Color.FromArgb(0xE3, 0xC0, 0x63) : Color.FromArgb(0x7A, 0x5B, 0x12);
        public static Color UyariYazi => Tema.Acik ? Color.FromArgb(0x7A, 0x56, 0x00) : Color.FromArgb(0xF7, 0xCB, 0x55);
        public static Color HataZemin => Tema.Acik ? Color.FromArgb(0xFD, 0xEB, 0xEE) : Color.FromArgb(0x3A, 0x1A, 0x21);
        public static Color HataKenar => Tema.Acik ? Color.FromArgb(0xEF, 0xA6, 0xB0) : Color.FromArgb(0x80, 0x30, 0x3B);
        public static Color HataYazi => Tema.Acik ? Color.FromArgb(0xA1, 0x1D, 0x2D) : Color.FromArgb(0xFF, 0xA3, 0xAD);
        public static Color Kapat => Tema.Acik ? Color.FromArgb(0xC4, 0x2B, 0x1C) : Color.FromArgb(0xC4, 0x2B, 0x1C);

        /// <summary>"#rrggbb" → renk (okunamazsa varsayılan).</summary>
        public static Color Hex(string hex, Color varsayilan)
        {
            try
            {
                string s = (hex ?? "").Trim().TrimStart('#');
                if (s.Length != 6) return varsayilan;
                int v = int.Parse(s, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                return Color.FromArgb((v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF);
            }
            catch { return varsayilan; }
        }
    }

    /// <summary>
    /// Arayüz teması (13.11.2026): Otomatik (AutoCAD'in temasını izler: COLORTHEME 1 açık), Koyu ya da Açık. Seçim bu
    /// bilgisayarda kullanıcı başına saklanır (%APPDATA%\SebekeHakedis\arayuz.json; çizime yazılmaz). Her pencere açılırken
    /// <see cref="Yenile"/> etkin temayı belirler. Denemede SH_TEMA ortam değişkeni (koyu / acik) seçimi geçersiz kılar.
    /// </summary>
    internal static class Tema
    {
        public const string Otomatik = "otomatik", Koyu = "koyu", AcikSecim = "acik";
        public static readonly string[] Secenekler = { Otomatik, Koyu, AcikSecim };
        public static readonly string[] SecenekAdlari = { "Otomatik (AutoCAD'in teması)", "Koyu", "Açık" };

        /// <summary>AutoCAD açık temada mı (eklenti başlarken bağlanır; bağlanmamışsa koyu sayılır).</summary>
        public static Func<bool> AutoCadAcikMi;

        private static string _secim;
        private static bool _acik;

        /// <summary>Etkin tema açık mı (son <see cref="Yenile"/> sonucu).</summary>
        public static bool Acik => _acik;

        /// <summary>Kullanıcının seçimi: otomatik / koyu / acik.</summary>
        public static string Secim
        {
            get { if (_secim == null) _secim = Oku(); return _secim; }
            set { _secim = Array.IndexOf(Secenekler, value) >= 0 ? value : Otomatik; Kaydet(_secim); Yenile(); }
        }

        /// <summary>Etkin temayı seçimden (otomatikte AutoCAD'den) belirler.</summary>
        public static bool Yenile()
        {
            string s = Environment.GetEnvironmentVariable("SH_TEMA");
            if (string.IsNullOrEmpty(s)) s = Secim;
            if (s == AcikSecim) _acik = true;
            else if (s == Koyu) _acik = false;
            else { try { _acik = AutoCadAcikMi != null && AutoCadAcikMi(); } catch { _acik = false; } }
            return _acik;
        }

        private static string Yol => System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SebekeHakedis", "arayuz.json");

        private static string Oku()
        {
            try
            {
                if (!System.IO.File.Exists(Yol)) return Otomatik;
                var m = System.Text.RegularExpressions.Regex.Match(System.IO.File.ReadAllText(Yol), "\"tema\"\\s*:\\s*\"(\\w+)\"");
                return m.Success && Array.IndexOf(Secenekler, m.Groups[1].Value) >= 0 ? m.Groups[1].Value : Otomatik;
            }
            catch { return Otomatik; }
        }

        private static void Kaydet(string secim)
        {
            try
            {
                System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(Yol));
                System.IO.File.WriteAllText(Yol, "{ \"tema\": \"" + secim + "\" }\n");
            }
            catch { }
        }

        /// <summary>
        /// Çizim rengini (hat / eleman simgesi) zemine göre okunur yapar: açık temada çok açık renkler (AYD camgöbeği,
        /// sarı…) koyulaştırılır; koyu temada aynen kalır.
        /// </summary>
        public static Color Okunur(Color c)
        {
            if (!_acik) return c;
            double l = (0.2126 * c.R + 0.7152 * c.G + 0.0722 * c.B) / 255.0;
            if (l <= 0.55) return c;
            double k = 0.55 / l;
            return Color.FromArgb(c.A, (int)(c.R * k), (int)(c.G * k), (int)(c.B * k));
        }

        /// <summary><see cref="Okunur(Color)"/> "#rrggbb" yazımıyla (simge resimleri için).</summary>
        public static string OkunurHex(string hex)
        {
            if (!_acik) return hex;
            var c = Okunur(KoyuRenk.Hex(hex, Color.Empty));
            return c.IsEmpty ? hex : "#" + c.R.ToString("x2") + c.G.ToString("x2") + c.B.ToString("x2");
        }
    }

    /// <summary>Pencere yazıları (Segoe UI).</summary>
    internal static class KoyuYazi
    {
        public static readonly Font Govde = Yap("Segoe UI", 9F, false);
        public static readonly Font Kalin = Yap("Segoe UI Semibold", 9F, true);
        public static readonly Font Kucuk = Yap("Segoe UI", 8.25F, false);
        public static readonly Font Baslik = Yap("Segoe UI Semibold", 10.5F, true);
        public static readonly Font Iri = Yap("Segoe UI Semibold", 17F, true);

        private static Font Yap(string ad, float boy, bool kalin)
        {
            try
            {
                var f = new Font(ad, boy, FontStyle.Regular);
                if (string.Equals(f.Name, ad, StringComparison.OrdinalIgnoreCase)) return f;
                f.Dispose();
            }
            catch { }
            return new Font("Segoe UI", boy, kalin ? FontStyle.Bold : FontStyle.Regular);
        }
    }

    /// <summary>Ekran ölçeği: pencereler 96 DPI'a göre tasarlanır, ekranın ölçeğiyle büyütülür.</summary>
    internal static class Olcu
    {
        private static float _k;

        public static float K
        {
            get
            {
                if (_k > 0) return _k;
                try { using (var g = Graphics.FromHwnd(IntPtr.Zero)) _k = g.DpiX / 96f; }
                catch { _k = 1f; }
                if (float.IsNaN(_k) || _k < 1f) _k = 1f;
                return _k;
            }
        }

        public static int S(double px) => (int)Math.Round(px * K);
    }

    /// <summary>Windows yardımcıları (koyu kaydırma çubuğu, yuvarlak köşe, ipucu yazısı). Hata olursa sessizce geçer.</summary>
    internal static class Yerel
    {
        [DllImport("uxtheme.dll", CharSet = CharSet.Unicode)]
        private static extern int SetWindowTheme(IntPtr hWnd, string pszSubAppName, string pszSubIdList);

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, string lParam);

        public static void KoyuKaydirma(IntPtr h)
        {
            try { if (h != IntPtr.Zero) SetWindowTheme(h, Tema.Acik ? "Explorer" : "DarkMode_Explorer", null); } catch { }
        }

        public static void KoyuKaydirma(Control c)
        {
            try
            {
                if (c == null) return;
                if (c.IsHandleCreated) KoyuKaydirma(c.Handle);
                else c.HandleCreated += (s, e) => KoyuKaydirma(c.Handle);
            }
            catch { }
        }

        public static void KoseYuvarla(Form f)
        {
            try
            {
                int v = 2; // DWMWCP_ROUND (Windows 11)
                DwmSetWindowAttribute(f.Handle, 33, ref v, sizeof(int));
            }
            catch { }
        }

        public static void Ipucu(TextBox t, string metin)
        {
            try { if (t != null && t.IsHandleCreated) SendMessage(t.Handle, 0x1501, (IntPtr)1, metin ?? ""); } catch { }
        }
    }

    /// <summary>Çizim yardımcıları.</summary>
    internal static class Boya
    {
        public static GraphicsPath Yuvarlak(RectangleF r, float yaricap)
        {
            var p = new GraphicsPath();
            float d = Math.Max(0.5f, Math.Min(yaricap * 2, Math.Min(r.Width, r.Height)));
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        /// <summary>Yuvarlak köşeli kutu: zemin + 1 piksel kenar (kenar boş renkse çizilmez).</summary>
        public static void Kutu(Graphics g, Rectangle r, Color zemin, Color kenar, int yaricap)
        {
            var eski = g.SmoothingMode;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var rf = new RectangleF(r.X + 0.5f, r.Y + 0.5f, r.Width - 1f, r.Height - 1f);
            using (var yol = Yuvarlak(rf, yaricap))
            {
                if (zemin.A > 0) using (var b = new SolidBrush(zemin)) g.FillPath(b, yol);
                if (kenar.A > 0) using (var p = new Pen(kenar)) g.DrawPath(p, yol);
            }
            g.SmoothingMode = eski;
        }

        public static void Yazi(Graphics g, string s, Font f, Rectangle r, Color c, TextFormatFlags bayrak) =>
            TextRenderer.DrawText(g, s ?? "", f, r, c, bayrak | TextFormatFlags.NoPrefix);

        /// <summary>Açılır liste oku (aşağı bakan köşeli işaret).</summary>
        public static void Ok(Graphics g, Rectangle r, Color c, bool asagi = true)
        {
            var eski = g.SmoothingMode;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            float cx = r.X + r.Width / 2f, cy = r.Y + r.Height / 2f, w = Olcu.S(4), h = Olcu.S(2.5);
            using (var p = new Pen(c, Math.Max(1.4f, Olcu.K * 1.5f)) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
            {
                if (asagi) g.DrawLines(p, new[] { new PointF(cx - w, cy - h), new PointF(cx, cy + h), new PointF(cx + w, cy - h) });
                else g.DrawLines(p, new[] { new PointF(cx - w, cy + h), new PointF(cx, cy - h), new PointF(cx + w, cy + h) });
            }
            g.SmoothingMode = eski;
        }

        /// <summary>Denetimin üstündeki zemin rengi (kartın içinde kart rengi).</summary>
        public static Color Zemin(Control c)
        {
            for (var p = c.Parent; p != null; p = p.Parent)
                if (p.BackColor.A == 255) return p.BackColor;
            return KoyuRenk.Arka;
        }

        public static Image Simge(string ad, Color renk, int px = 16, bool dolu = false) => ArayuzSimgeleri.Gdi(ad, Olcu.S(px), renk, dolu);
    }

    // =====================================================================================================
    // Pencere
    // =====================================================================================================

    /// <summary>
    /// Koyu pencere: kendi başlık çubuğu (simge, başlık, kapat), ince kenar, gölge. Başlıktan sürüklenir; Esc kapatır.
    /// İçerik mantıksal piksellerle (96 DPI) yerleştirilir: Olcu.S().
    /// </summary>
    internal class KoyuPencere : Form
    {
        private readonly Image _simge;
        private bool _kapatUzerinde;
        /// <summary>Altbilgi (düğmeler); yoksa null.</summary>
        public readonly Panel Alt;

        public KoyuPencere(string baslik, int en, int boy, Image simge = null, bool altVar = true)
        {
            Tema.Yenile();   // pencere açılırken etkin tema (Otomatik: AutoCAD'in teması)
            SuspendLayout();
            Text = baslik;
            _simge = simge;
            FormBorderStyle = FormBorderStyle.None;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.None;
            KeyPreview = true;
            BackColor = KoyuRenk.Arka;
            ForeColor = KoyuRenk.Yazi;
            Font = KoyuYazi.Govde;
            DoubleBuffered = true;
            ClientSize = new Size(Olcu.S(en), Olcu.S(boy));
            if (altVar)
            {
                Alt = new AltCubuk();
                Alt.SetBounds(1, ClientSize.Height - 1 - Olcu.S(60), ClientSize.Width - 2, Olcu.S(60));
                Controls.Add(Alt);
            }
            ResumeLayout(false);
        }

        public int BaslikBoyu => Olcu.S(42);

        /// <summary>Altbilgi hariç içerik alanının alt sınırı (mantıksal piksel).</summary>
        public int IcerikSonu => (int)Math.Round((ClientSize.Height - (Alt != null ? Alt.Height : 0)) / Olcu.K);

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ClassStyle |= 0x00020000; // CS_DROPSHADOW
                return cp;
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            Yerel.KoseYuvarla(this);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            // Yazılabilir açılır listelerde Windows'un bıraktığı seçili (mavi) yazıyı kaldır
            Action<Control> gez = null;
            gez = c =>
            {
                foreach (Control ic in c.Controls)
                {
                    var a = ic as KoyuAcilir;
                    if (a != null) a.SecimiKaldir();
                    gez(ic);
                }
            };
            try { gez(this); } catch { }
        }

        private Rectangle KapatAlani => new Rectangle(ClientSize.Width - Olcu.S(46) - 1, 1, Olcu.S(46), BaslikBoyu - 2);

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            using (var b = new SolidBrush(KoyuRenk.Baslik)) g.FillRectangle(b, 0, 0, ClientSize.Width, BaslikBoyu);
            using (var p = new Pen(KoyuRenk.Kenar)) g.DrawLine(p, 0, BaslikBoyu - 1, ClientSize.Width, BaslikBoyu - 1);
            int x = Olcu.S(16);
            if (_simge != null)
            {
                g.DrawImage(_simge, x, (BaslikBoyu - _simge.Height) / 2, _simge.Width, _simge.Height);
                x += _simge.Width + Olcu.S(10);
            }
            else
            {
                using (var b = new SolidBrush(KoyuRenk.Yesil)) g.FillRectangle(b, x, Olcu.S(13), Olcu.S(3), BaslikBoyu - Olcu.S(26));
                x += Olcu.S(13);
            }
            var k = KapatAlani;
            // Marka: başlığın sağında, kapatma düğmesinden önce küçük rozet + "Şebeke-M"
            int sag = k.Left - Olcu.S(8);
            var rozet = Marka.Simge(Olcu.S(20));
            if (rozet != null && ClientSize.Width > Olcu.S(420))
            {
                int adEn = TextRenderer.MeasureText(g, Marka.Ad, KoyuYazi.Kucuk, new Size(int.MaxValue, BaslikBoyu), TextFormatFlags.SingleLine | TextFormatFlags.NoPadding).Width;
                int bx = sag - adEn;
                Boya.Yazi(g, Marka.Ad, KoyuYazi.Kucuk, new Rectangle(bx, 0, adEn + Olcu.S(2), BaslikBoyu), KoyuRenk.Ikincil,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.SingleLine | TextFormatFlags.NoPadding);
                bx -= rozet.Width + Olcu.S(7);
                var eski = g.InterpolationMode;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(rozet, bx, (BaslikBoyu - rozet.Height) / 2, rozet.Width, rozet.Height);
                g.InterpolationMode = eski;
                sag = bx - Olcu.S(14);
            }
            Boya.Yazi(g, Text, KoyuYazi.Baslik, new Rectangle(x, 0, Math.Max(10, sag - x), BaslikBoyu), KoyuRenk.Yazi,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
            if (_kapatUzerinde) using (var b = new SolidBrush(KoyuRenk.Kapat)) g.FillRectangle(b, k);
            using (var p = new Pen(_kapatUzerinde ? Color.White : KoyuRenk.Ikincil, Math.Max(1.2f, Olcu.K * 1.3f)))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                float c = Olcu.S(5), mx = k.Left + k.Width / 2f, my = k.Top + k.Height / 2f;
                g.DrawLine(p, mx - c, my - c, mx + c, my + c);
                g.DrawLine(p, mx + c, my - c, mx - c, my + c);
                g.SmoothingMode = SmoothingMode.Default;
            }
            using (var p = new Pen(KoyuRenk.KenarAcik)) g.DrawRectangle(p, 0, 0, ClientSize.Width - 1, ClientSize.Height - 1);
        }

        protected override void WndProc(ref Message m)
        {
            base.WndProc(ref m);
            if (m.Msg == 0x84 && m.Result == (IntPtr)1) // WM_NCHITTEST → HTCLIENT ise başlıkta HTCAPTION
            {
                long lp = m.LParam.ToInt64();
                var p = PointToClient(new Point((short)(lp & 0xFFFF), (short)((lp >> 16) & 0xFFFF)));
                if (p.Y >= 0 && p.Y < BaslikBoyu && !KapatAlani.Contains(p)) m.Result = (IntPtr)2;
            }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            bool u = KapatAlani.Contains(e.Location);
            if (u != _kapatUzerinde)
            {
                _kapatUzerinde = u;
                Invalidate(KapatAlani);
            }
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            if (_kapatUzerinde)
            {
                _kapatUzerinde = false;
                Invalidate(KapatAlani);
            }
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (e.Button == MouseButtons.Left && KapatAlani.Contains(e.Location))
            {
                DialogResult = DialogResult.Cancel;
                if (!Modal) Close();
            }
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (!e.Handled && e.KeyCode == Keys.Escape && CancelButton == null)
            {
                DialogResult = DialogResult.Cancel;
                e.Handled = true;
            }
        }
    }

    /// <summary>Pencerenin altbilgisi: üstte ince çizgi.</summary>
    internal sealed class AltCubuk : Panel
    {
        public AltCubuk()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = KoyuRenk.Arka;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var p = new Pen(KoyuRenk.Kenar)) e.Graphics.DrawLine(p, 0, 0, Width, 0);
        }
    }

    /// <summary>Yuvarlak köşeli kart (isteğe bağlı başlıkla). İçindeki denetimler kart rengini zemin alır.</summary>
    internal sealed class Kart : Panel
    {
        public string Baslik;
        public Color KenarRengi = KoyuRenk.Kenar;

        public Kart(string baslik = null)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Baslik = baslik;
            BackColor = KoyuRenk.Kart;
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            using (var b = new SolidBrush(Boya.Zemin(this))) e.Graphics.FillRectangle(b, ClientRectangle);
            Boya.Kutu(e.Graphics, ClientRectangle, BackColor, KenarRengi, Olcu.S(8));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            if (!string.IsNullOrEmpty(Baslik))
                Boya.Yazi(e.Graphics, Baslik, KoyuYazi.Kalin, new Rectangle(Olcu.S(14), Olcu.S(8), Width - Olcu.S(28), Olcu.S(22)), KoyuRenk.Ikincil,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis);
        }
    }

    /// <summary>İnce kenarlı kap (liste ve tablo için); içindeki denetim odaklanınca kenar yeşillenir.</summary>
    internal sealed class Cerceve : Panel
    {
        private readonly Control _ic;

        public Cerceve(Control ic)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = KoyuRenk.Kutu;
            Padding = new Padding(Olcu.S(3));
            _ic = ic;
            ic.Dock = DockStyle.Fill;
            Controls.Add(ic);
            ic.GotFocus += (s, e) => Invalidate();
            ic.LostFocus += (s, e) => Invalidate();
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            using (var b = new SolidBrush(Boya.Zemin(this))) e.Graphics.FillRectangle(b, ClientRectangle);
            Boya.Kutu(e.Graphics, ClientRectangle, BackColor, _ic.Focused ? KoyuRenk.Vurgu : KoyuRenk.Kenar, Olcu.S(6));
        }
    }

    // =====================================================================================================
    // Düğme, onay kutusu, seçenek
    // =====================================================================================================

    internal enum DugmeTuru { Ikincil, Birincil, Hayalet }

    /// <summary>Düz, yuvarlak köşeli düğme. Birincil: yeşil zemin (Çiz, Kaydet).</summary>
    internal sealed class KoyuDugme : Button
    {
        public DugmeTuru Tur;
        public Image Simge;
        private bool _uzerinde, _basili;

        public KoyuDugme(string yazi, DugmeTuru tur = DugmeTuru.Ikincil, Image simge = null)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Text = yazi;
            Tur = tur;
            Simge = simge;
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            UseVisualStyleBackColor = false;
            Font = KoyuYazi.Kalin;
            ForeColor = KoyuRenk.Yazi;
            BackColor = KoyuRenk.Kart;
            Cursor = Cursors.Hand;
            Size = new Size(Olcu.S(110), Olcu.S(34));
        }

        protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); _uzerinde = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); _uzerinde = false; _basili = false; Invalidate(); }
        protected override void OnMouseDown(MouseEventArgs e) { base.OnMouseDown(e); if (e.Button == MouseButtons.Left) { _basili = true; Invalidate(); } }
        protected override void OnMouseUp(MouseEventArgs e) { base.OnMouseUp(e); _basili = false; Invalidate(); }
        protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            Color zemin, kenar, yazi;
            if (Tur == DugmeTuru.Birincil)
            {
                zemin = !Enabled ? KoyuRenk.VurguPasif : _basili ? KoyuRenk.VurguKoyu : _uzerinde ? KoyuRenk.VurguAcik : KoyuRenk.Vurgu;
                kenar = Focused && Enabled ? KoyuRenk.Yesil : zemin;
                yazi = Enabled ? Color.White : KoyuRenk.Soluk;
            }
            else if (Tur == DugmeTuru.Hayalet)
            {
                zemin = _basili ? KoyuRenk.Kutu : _uzerinde ? KoyuRenk.Uzerinde : Color.Transparent;
                kenar = Focused ? KoyuRenk.KenarAcik : Color.Transparent;
                yazi = Enabled ? KoyuRenk.Yazi : KoyuRenk.Soluk;
            }
            else
            {
                zemin = !Enabled ? KoyuRenk.Arka : _basili ? KoyuRenk.Kutu : _uzerinde ? KoyuRenk.Uzerinde : KoyuRenk.Kart;
                kenar = Focused && Enabled ? KoyuRenk.Yesil : _uzerinde ? KoyuRenk.KenarAcik : KoyuRenk.Kenar;
                yazi = Enabled ? KoyuRenk.Yazi : KoyuRenk.Soluk;
            }
            Boya.Kutu(g, ClientRectangle, zemin, kenar, Olcu.S(6));
            var boyut = TextRenderer.MeasureText(g, Text, Font, Size.Empty, TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
            int simgeG = Simge != null ? Simge.Width + Olcu.S(7) : 0;
            int x = Math.Max(Olcu.S(6), (Width - (boyut.Width + simgeG)) / 2);
            if (Simge != null) g.DrawImage(Simge, x, (Height - Simge.Height) / 2, Simge.Width, Simge.Height);
            Boya.Yazi(g, Text, Font, new Rectangle(x + simgeG, 0, Width - x - simgeG, Height), yazi,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
        }
    }

    /// <summary>Onay kutusu. Isaret: hakediş onayı tablosundaki gibi yeşil tik / boş daire.</summary>
    internal sealed class KoyuOnay : CheckBox
    {
        public bool Isaret;
        private bool _uzerinde;

        public KoyuOnay(string yazi = "")
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Text = yazi;
            Font = KoyuYazi.Govde;
            ForeColor = KoyuRenk.Yazi;
            Cursor = Cursors.Hand;
            AutoSize = true;
        }

        public override Size GetPreferredSize(Size proposedSize)
        {
            int kutu = Olcu.S(Isaret ? 20 : 16);
            if (string.IsNullOrEmpty(Text)) return new Size(kutu + Olcu.S(4), Math.Max(Olcu.S(24), kutu + 4));
            var t = TextRenderer.MeasureText(Text, Font, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
            return new Size(kutu + Olcu.S(8) + t.Width + Olcu.S(2), Math.Max(Olcu.S(24), t.Height + Olcu.S(4)));
        }

        protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); _uzerinde = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); _uzerinde = false; Invalidate(); }
        protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            int kutu = Olcu.S(Isaret ? 20 : 16);
            int kx = string.IsNullOrEmpty(Text) ? (Width - kutu) / 2 : 0, ky = (Height - kutu) / 2;
            var r = new Rectangle(kx, ky, kutu, kutu);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            if (Isaret)
            {
                if (Checked)
                {
                    using (var b = new SolidBrush(Enabled ? KoyuRenk.Vurgu : KoyuRenk.VurguPasif)) g.FillEllipse(b, r);
                    Tik(g, r, Enabled ? Color.White : KoyuRenk.Ikincil);
                }
                else
                {
                    // Kapalı (yetki dışı) kutu soluk çizilir
                    using (var p = new Pen(!Enabled ? KoyuRenk.Kenar : _uzerinde ? KoyuRenk.Yesil : KoyuRenk.KenarAcik, Math.Max(1.2f, Olcu.K * 1.3f)))
                        g.DrawEllipse(p, r.X + 1, r.Y + 1, r.Width - 2, r.Height - 2);
                }
            }
            else
            {
                if (Checked)
                {
                    Boya.Kutu(g, r, Enabled ? KoyuRenk.Vurgu : KoyuRenk.VurguPasif, Enabled ? KoyuRenk.Vurgu : KoyuRenk.VurguPasif, Olcu.S(3));
                    Tik(g, r, Enabled ? Color.White : KoyuRenk.Soluk);
                }
                else Boya.Kutu(g, r, KoyuRenk.Kutu, _uzerinde && Enabled ? KoyuRenk.Yesil : KoyuRenk.KenarAcik, Olcu.S(3));
            }
            if (Focused && ShowFocusCues)
                using (var p = new Pen(KoyuRenk.Yesil)) g.DrawRectangle(p, r.X - 2, r.Y - 2, r.Width + 3, r.Height + 3);
            g.SmoothingMode = SmoothingMode.Default;
            if (!string.IsNullOrEmpty(Text))
                Boya.Yazi(g, Text, Font, new Rectangle(kutu + Olcu.S(8), 0, Width - kutu - Olcu.S(8), Height), Enabled ? ForeColor : KoyuRenk.Soluk,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
        }

        private static void Tik(Graphics g, Rectangle r, Color c)
        {
            using (var p = new Pen(c, Math.Max(1.6f, r.Width / 8f)) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                g.DrawLines(p, new[]
                {
                    new PointF(r.X + r.Width * 0.27f, r.Y + r.Height * 0.53f),
                    new PointF(r.X + r.Width * 0.44f, r.Y + r.Height * 0.70f),
                    new PointF(r.X + r.Width * 0.75f, r.Y + r.Height * 0.34f),
                });
        }
    }

    /// <summary>Seçenek düğmesi; isteğe bağlı açıklama (ör. "M+M   Malzeme + Montaj").</summary>
    internal sealed class KoyuSecim : RadioButton
    {
        public string Aciklama;
        /// <summary>Açıklamanın başladığı yer (piksel); 0: yazının hemen sağı.</summary>
        public int AciklamaX;
        private bool _uzerinde;

        public KoyuSecim(string yazi, string aciklama = null)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Text = yazi;
            Aciklama = aciklama;
            Font = KoyuYazi.Govde;
            ForeColor = KoyuRenk.Yazi;
            Cursor = Cursors.Hand;
            AutoSize = true;
        }

        public override Size GetPreferredSize(Size proposedSize)
        {
            var t = TextRenderer.MeasureText(Text, Font, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
            int w = Olcu.S(16) + Olcu.S(8) + t.Width + Olcu.S(4);
            if (!string.IsNullOrEmpty(Aciklama))
            {
                var a = TextRenderer.MeasureText(Aciklama, KoyuYazi.Kucuk, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
                w = Math.Max(w, AciklamaX) + Olcu.S(10) + a.Width;
            }
            return new Size(w, Math.Max(Olcu.S(24), t.Height + Olcu.S(4)));
        }

        protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); _uzerinde = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); _uzerinde = false; Invalidate(); }
        protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            int d = Olcu.S(16), y = (Height - d) / 2;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var renk = !Enabled ? KoyuRenk.Soluk : Checked || _uzerinde ? KoyuRenk.Yesil : KoyuRenk.KenarAcik;
            using (var b = new SolidBrush(KoyuRenk.Kutu)) g.FillEllipse(b, 0, y, d, d);
            using (var p = new Pen(renk, Math.Max(1.2f, Olcu.K * 1.3f))) g.DrawEllipse(p, 0.75f, y + 0.75f, d - 1.5f, d - 1.5f);
            if (Checked)
            {
                float ic = d * 0.5f;
                using (var b = new SolidBrush(Enabled ? KoyuRenk.Yesil : KoyuRenk.Soluk)) g.FillEllipse(b, (d - ic) / 2f, y + (d - ic) / 2f, ic, ic);
            }
            if (Focused && ShowFocusCues)
                using (var p = new Pen(KoyuRenk.Yesil)) g.DrawEllipse(p, -1f, y - 1f, d + 1f, d + 1f);
            g.SmoothingMode = SmoothingMode.Default;
            var font = Checked ? KoyuYazi.Kalin : Font;
            var t = TextRenderer.MeasureText(g, Text, font, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
            int tx = d + Olcu.S(8);
            Boya.Yazi(g, Text, font, new Rectangle(tx, 0, Width - tx, Height), Enabled ? KoyuRenk.Yazi : KoyuRenk.Soluk,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
            if (!string.IsNullOrEmpty(Aciklama))
            {
                int ax = Math.Max(AciklamaX, tx + t.Width + Olcu.S(10));
                Boya.Yazi(g, Aciklama, KoyuYazi.Kucuk, new Rectangle(ax, 0, Math.Max(0, Width - ax), Height), Enabled ? KoyuRenk.Ikincil : KoyuRenk.Soluk,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
            }
        }
    }

    // =====================================================================================================
    // Yazı kutusu, sayı kutusu, açılır liste
    // =====================================================================================================

    /// <summary>Yazı kutusu: koyu zemin, ince kenar (odakta yeşil), isteğe bağlı simge ve ipucu yazısı.</summary>
    internal sealed class MetinKutusu : Panel
    {
        public readonly TextBox Kutu;
        private readonly Image _simge;
        private string _ipucu;

        public MetinKutusu(string metin = "", string ipucu = null, Image simge = null)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            _simge = simge;
            BackColor = KoyuRenk.Kutu;
            Kutu = new TextBox { BorderStyle = BorderStyle.None, BackColor = KoyuRenk.Kutu, ForeColor = KoyuRenk.Yazi, Font = KoyuYazi.Govde, Text = metin ?? "" };
            Controls.Add(Kutu);
            Size = new Size(Olcu.S(200), Olcu.S(30));
            _ipucu = ipucu;
            Kutu.HandleCreated += (s, e) => { if (_ipucu != null) Yerel.Ipucu(Kutu, _ipucu); };
            Kutu.GotFocus += (s, e) => Invalidate();
            Kutu.LostFocus += (s, e) => Invalidate();
            Cursor = Cursors.IBeam;
        }

        /// <summary>Kutu boşken görünen soluk yazı.</summary>
        public string Ipucu
        {
            get => _ipucu;
            set
            {
                _ipucu = value;
                Yerel.Ipucu(Kutu, value);
            }
        }

        public override string Text
        {
            get => Kutu.Text;
            set => Kutu.Text = value ?? "";
        }

        protected override void OnClick(EventArgs e)
        {
            base.OnClick(e);
            Kutu.Focus();
        }

        protected override void OnEnabledChanged(EventArgs e)
        {
            base.OnEnabledChanged(e);
            Kutu.ForeColor = Enabled ? KoyuRenk.Yazi : KoyuRenk.Soluk;
            Invalidate();
        }

        protected override void OnLayout(LayoutEventArgs levent)
        {
            base.OnLayout(levent);
            int sol = Olcu.S(10) + (_simge != null ? _simge.Width + Olcu.S(7) : 0);
            int h = Kutu.PreferredHeight;
            Kutu.SetBounds(sol, Math.Max(0, (Height - h) / 2), Math.Max(10, Width - sol - Olcu.S(8)), h);
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            using (var b = new SolidBrush(Boya.Zemin(this))) e.Graphics.FillRectangle(b, ClientRectangle);
            Boya.Kutu(e.Graphics, ClientRectangle, KoyuRenk.Kutu, Kutu.Focused ? KoyuRenk.Vurgu : KoyuRenk.Kenar, Olcu.S(6));
            if (_simge != null) e.Graphics.DrawImage(_simge, Olcu.S(9), (Height - _simge.Height) / 2, _simge.Width, _simge.Height);
        }
    }

    /// <summary>Sayı kutusu (NumericUpDown yerine): yazarak, ok tuşlarıyla, tekerlekle ya da sağdaki oklarla değişir.</summary>
    internal sealed class SayiKutusu : Panel
    {
        public readonly TextBox Kutu;
        private decimal _deger, _min, _max, _adim;
        private int _ondalik;
        private bool _yaziliyor;
        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
        public event EventHandler ValueChanged;

        public SayiKutusu(decimal min, decimal max, decimal deger, int ondalik = 0, decimal adim = 1)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            _min = min;
            _max = Math.Max(min, max);
            _ondalik = Math.Max(0, ondalik);
            _adim = adim <= 0 ? 1 : adim;
            BackColor = KoyuRenk.Kutu;
            Kutu = new TextBox { BorderStyle = BorderStyle.None, BackColor = KoyuRenk.Kutu, ForeColor = KoyuRenk.Yazi, Font = KoyuYazi.Govde };
            Controls.Add(Kutu);
            Size = new Size(Olcu.S(120), Olcu.S(30));
            _deger = Sinirla(deger);
            Yaz();
            Kutu.TextChanged += (s, e) => { if (!_yaziliyor) Oku(false); };
            Kutu.Leave += (s, e) => Oku(true);
            Kutu.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Up) { Value = _deger + _adim; e.Handled = true; e.SuppressKeyPress = true; }
                else if (e.KeyCode == Keys.Down) { Value = _deger - _adim; e.Handled = true; e.SuppressKeyPress = true; }
            };
            Kutu.MouseWheel += (s, e) => { if (Kutu.Focused) Value = _deger + (e.Delta > 0 ? _adim : -_adim); };
            Kutu.GotFocus += (s, e) => Invalidate();
            Kutu.LostFocus += (s, e) => Invalidate();
        }

        public decimal Minimum { get => _min; set { _min = value; Value = _deger; } }
        public decimal Maximum { get => _max; set { _max = value; Value = _deger; } }
        public decimal Increment { get => _adim; set => _adim = value <= 0 ? 1 : value; }
        public int DecimalPlaces { get => _ondalik; set { _ondalik = Math.Max(0, value); Yaz(); } }

        public decimal Value
        {
            get => _deger;
            set
            {
                var v = Sinirla(value);
                bool degisti = v != _deger;
                _deger = v;
                Yaz();
                if (degisti) ValueChanged?.Invoke(this, EventArgs.Empty);
            }
        }

        private decimal Sinirla(decimal v) => Math.Round(Math.Max(_min, Math.Min(_max, v)), _ondalik, MidpointRounding.AwayFromZero);

        private void Yaz()
        {
            _yaziliyor = true;
            Kutu.Text = _deger.ToString(_ondalik > 0 ? "0." + new string('#', _ondalik) : "0", Tr);
            _yaziliyor = false;
        }

        private void Oku(bool bicimle)
        {
            string s = (Kutu.Text ?? "").Trim();
            decimal v;
            bool ok = decimal.TryParse(s, NumberStyles.Number, Tr, out v) ||
                      decimal.TryParse(s.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out v);
            if (ok)
            {
                v = Sinirla(v);
                bool degisti = v != _deger;
                _deger = v;
                if (bicimle) Yaz();
                if (degisti) ValueChanged?.Invoke(this, EventArgs.Empty);
            }
            else if (bicimle) Yaz();
        }

        private Rectangle OkAlani => new Rectangle(Width - Olcu.S(24), 1, Olcu.S(23), Height - 2);

        protected override void OnEnabledChanged(EventArgs e)
        {
            base.OnEnabledChanged(e);
            Kutu.ForeColor = Enabled ? KoyuRenk.Yazi : KoyuRenk.Soluk;
            Invalidate();
        }

        protected override void OnLayout(LayoutEventArgs levent)
        {
            base.OnLayout(levent);
            int h = Kutu.PreferredHeight;
            Kutu.SetBounds(Olcu.S(10), Math.Max(0, (Height - h) / 2), Math.Max(10, Width - Olcu.S(10) - Olcu.S(28)), h);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (!Enabled || e.Button != MouseButtons.Left) return;
            var o = OkAlani;
            if (o.Contains(e.Location)) Value = _deger + (e.Y < o.Top + o.Height / 2 ? _adim : -_adim);
            else Kutu.Focus();
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            Boya.Kutu(g, ClientRectangle, KoyuRenk.Kutu, Kutu.Focused ? KoyuRenk.Vurgu : KoyuRenk.Kenar, Olcu.S(6));
            var o = OkAlani;
            using (var p = new Pen(KoyuRenk.Kenar)) g.DrawLine(p, o.Left, o.Top + Olcu.S(5), o.Left, o.Bottom - Olcu.S(5));
            var renk = Enabled ? KoyuRenk.Ikincil : KoyuRenk.Soluk;
            Boya.Ok(g, new Rectangle(o.Left, o.Top + Olcu.S(2), o.Width, o.Height / 2 - Olcu.S(1)), renk, false);
            Boya.Ok(g, new Rectangle(o.Left, o.Top + o.Height / 2 - Olcu.S(1), o.Width, o.Height / 2 - Olcu.S(1)), renk, true);
        }
    }

    /// <summary>Açılır liste: koyu zemin, ince kenar, yeşil seçim. yazilabilir: listede olmayan değer de yazılabilir.</summary>
    internal sealed class KoyuAcilir : ComboBox
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int Left, Top, Right, Bottom; }

        [StructLayout(LayoutKind.Sequential)]
        private struct COMBOBOXINFO
        {
            public int cbSize;
            public RECT rcItem, rcButton;
            public int stateButton;
            public IntPtr hwndCombo, hwndItem, hwndList;
        }

        [DllImport("user32.dll")]
        private static extern bool GetComboBoxInfo(IntPtr hwnd, ref COMBOBOXINFO info);

        public KoyuAcilir(bool yazilabilir = false)
        {
            DropDownStyle = yazilabilir ? ComboBoxStyle.DropDown : ComboBoxStyle.DropDownList;
            DrawMode = DrawMode.OwnerDrawFixed;
            FlatStyle = FlatStyle.Flat;
            BackColor = KoyuRenk.Kutu;
            ForeColor = KoyuRenk.Yazi;
            Font = KoyuYazi.Govde;
            ItemHeight = Olcu.S(22);
            IntegralHeight = false;
            MaxDropDownItems = 14;
            Width = Olcu.S(200);
        }

        protected override void OnDropDown(EventArgs e)
        {
            base.OnDropDown(e);
            try
            {
                var bilgi = new COMBOBOXINFO();
                bilgi.cbSize = Marshal.SizeOf(typeof(COMBOBOXINFO));
                if (GetComboBoxInfo(Handle, ref bilgi)) Yerel.KoyuKaydirma(bilgi.hwndList);
            }
            catch { }
        }

        protected override void OnDrawItem(DrawItemEventArgs e)
        {
            var g = e.Graphics;
            bool kutuIci = (e.State & DrawItemState.ComboBoxEdit) != 0;
            bool secili = (e.State & DrawItemState.Selected) != 0 && !kutuIci;
            using (var b = new SolidBrush(secili ? KoyuRenk.Secili : KoyuRenk.Kutu)) g.FillRectangle(b, e.Bounds);
            if (secili) using (var b = new SolidBrush(KoyuRenk.Yesil)) g.FillRectangle(b, e.Bounds.X, e.Bounds.Y, Olcu.S(3), e.Bounds.Height);
            if (e.Index < 0 || e.Index >= Items.Count) return;
            string s = GetItemText(Items[e.Index]);
            var r = new Rectangle(e.Bounds.X + Olcu.S(kutuIci ? 4 : 10), e.Bounds.Y, e.Bounds.Width - Olcu.S(kutuIci ? 6 : 14), e.Bounds.Height);
            Boya.Yazi(g, s, Font, r, Enabled ? KoyuRenk.Yazi : KoyuRenk.Soluk, TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
        }

        protected override void WndProc(ref Message m)
        {
            base.WndProc(ref m);
            try
            {
                if (m.Msg == 0x000F) // WM_PAINT
                    using (var g = Graphics.FromHwnd(Handle)) KenarCiz(g);
                else if ((m.Msg == 0x0317 || m.Msg == 0x0318) && m.WParam != IntPtr.Zero) // WM_PRINT / WM_PRINTCLIENT (ekran görüntüsü)
                    using (var g = Graphics.FromHdc(m.WParam)) KenarCiz(g);
            }
            catch { }
        }

        /// <summary>Windows'un düz çizdiği açık renkli kenarı ve ok düğmesini koyu temayla yeniden çizer.</summary>
        private void KenarCiz(Graphics g)
        {
            var r = ClientRectangle;
            if (r.Width <= 2 || r.Height <= 2) return;
            var zemin = KoyuRenk.Kutu;
            var dis = Boya.Zemin(this);
            int ok = Olcu.S(24);
            using (var b = new SolidBrush(zemin))
            {
                // kenar bandı (2 piksel) ve ok düğmesi
                g.FillRectangle(b, 0, 0, r.Width, 2);
                g.FillRectangle(b, 0, r.Height - 2, r.Width, 2);
                g.FillRectangle(b, 0, 0, 2, r.Height);
                g.FillRectangle(b, r.Width - ok - 1, 0, ok + 1, r.Height);
            }
            using (var p = new Pen(dis))
            {
                // köşeleri dış zemine yuvarla
                g.DrawRectangle(p, 0, 0, r.Width - 1, r.Height - 1);
            }
            Boya.Kutu(g, new Rectangle(0, 0, r.Width, r.Height), Color.Transparent, Focused || DroppedDown ? KoyuRenk.Vurgu : KoyuRenk.Kenar, Olcu.S(5));
            Boya.Ok(g, new Rectangle(r.Width - ok - 1, 0, ok, r.Height), Enabled ? KoyuRenk.Ikincil : KoyuRenk.Soluk);
        }

        protected override void OnGotFocus(EventArgs e) { base.OnGotFocus(e); Invalidate(); }
        protected override void OnLostFocus(EventArgs e) { base.OnLostFocus(e); SecimiKaldir(); Invalidate(); }
        protected override void OnResize(EventArgs e) { base.OnResize(e); SecimiKaldir(); }
        protected override void OnHandleCreated(EventArgs e) { base.OnHandleCreated(e); SecimiKaldir(); }
        protected override void OnTextChanged(EventArgs e) { base.OnTextChanged(e); SecimiKaldir(); }

        /// <summary>Windows yazılabilir listede yazının tamamını seçili (mavi) bırakır; odak yokken kaldırılır.</summary>
        internal void SecimiKaldir()
        {
            try { if (DropDownStyle == ComboBoxStyle.DropDown && IsHandleCreated && !Focused) SelectionLength = 0; } catch { }
        }
    }

    // =====================================================================================================
    // Listeler
    // =====================================================================================================

    /// <summary>Listede bölüm başlığı ("Son kullanılanlar", "Tüm tipler"); seçilemez.</summary>
    internal sealed class ListeBasligi
    {
        public readonly string Metin;
        public ListeBasligi(string metin) { Metin = metin; }
        public override string ToString() => Metin;
    }

    /// <summary>İki satırlı liste: kalın başlık + soluk açıklama, solda isteğe bağlı simge, bölüm başlıkları.</summary>
    internal sealed class IkiSatirListe : ListBox
    {
        public Func<object, string> Baslik = o => Convert.ToString(o, CultureInfo.CurrentCulture);
        public Func<object, string> Alt = o => "";
        public Func<object, Image> Simge = o => null;
        private int _onceki = -1, _uzerinde = -1;

        public IkiSatirListe()
        {
            DrawMode = DrawMode.OwnerDrawVariable;
            BorderStyle = BorderStyle.None;
            BackColor = KoyuRenk.Kutu;
            ForeColor = KoyuRenk.Yazi;
            Font = KoyuYazi.Govde;
            IntegralHeight = false;
            Yerel.KoyuKaydirma(this);
        }

        protected override void OnMeasureItem(MeasureItemEventArgs e)
        {
            base.OnMeasureItem(e);
            if (e.Index < 0 || e.Index >= Items.Count) return;
            var o = Items[e.Index];
            if (o is ListeBasligi) e.ItemHeight = Olcu.S(28);
            else e.ItemHeight = string.IsNullOrEmpty(Alt(o)) ? Olcu.S(32) : Olcu.S(42);
        }

        protected override void OnDrawItem(DrawItemEventArgs e)
        {
            var g = e.Graphics;
            var r = e.Bounds;
            using (var b = new SolidBrush(BackColor)) g.FillRectangle(b, r);
            if (e.Index < 0 || e.Index >= Items.Count) return;
            var o = Items[e.Index];
            var baslik = o as ListeBasligi;
            if (baslik != null)
            {
                Boya.Yazi(g, baslik.Metin, KoyuYazi.Kalin, new Rectangle(r.X + Olcu.S(10), r.Y + Olcu.S(6), r.Width - Olcu.S(14), r.Height - Olcu.S(6)), KoyuRenk.Ikincil,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
                return;
            }
            bool secili = (e.State & DrawItemState.Selected) != 0 && SelectionMode != SelectionMode.None;
            var kutu = new Rectangle(r.X + Olcu.S(3), r.Y + 1, r.Width - Olcu.S(6), r.Height - 2);
            if (secili) Boya.Kutu(g, kutu, KoyuRenk.Secili, KoyuRenk.Vurgu, Olcu.S(5));
            else if (e.Index == _uzerinde && SelectionMode != SelectionMode.None) Boya.Kutu(g, kutu, KoyuRenk.Uzerinde, Color.Transparent, Olcu.S(5));
            int x = r.X + Olcu.S(12);
            var simge = Simge(o);
            if (simge != null)
            {
                g.DrawImage(simge, x, r.Y + (r.Height - simge.Height) / 2, simge.Width, simge.Height);
                x += simge.Width + Olcu.S(10);
            }
            string alt = Alt(o);
            int w = r.Right - x - Olcu.S(8);
            if (string.IsNullOrEmpty(alt))
                Boya.Yazi(g, Baslik(o), KoyuYazi.Govde, new Rectangle(x, r.Y, w, r.Height), KoyuRenk.Yazi,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
            else
            {
                Boya.Yazi(g, Baslik(o), KoyuYazi.Kalin, new Rectangle(x, r.Y + Olcu.S(4), w, Olcu.S(18)), KoyuRenk.Yazi,
                    TextFormatFlags.Top | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
                Boya.Yazi(g, alt, KoyuYazi.Kucuk, new Rectangle(x, r.Y + Olcu.S(22), w, Olcu.S(16)), KoyuRenk.Ikincil,
                    TextFormatFlags.Top | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
            }
        }

        /// <summary>İlk seçilebilir satır (yoksa -1).</summary>
        public int IlkOge()
        {
            for (int i = 0; i < Items.Count; i++) if (!(Items[i] is ListeBasligi)) return i;
            return -1;
        }

        protected override void OnSelectedIndexChanged(EventArgs e)
        {
            int i = SelectedIndex;
            if (i >= 0 && i < Items.Count && Items[i] is ListeBasligi)
            {
                int yon = i >= _onceki ? 1 : -1;
                int j = i + yon;
                while (j >= 0 && j < Items.Count && Items[j] is ListeBasligi) j += yon;
                if (j < 0 || j >= Items.Count)
                {
                    j = i - yon;
                    while (j >= 0 && j < Items.Count && Items[j] is ListeBasligi) j -= yon;
                }
                if (j >= 0 && j < Items.Count && j != i)
                {
                    SelectedIndex = j;
                    return;
                }
            }
            _onceki = SelectedIndex;
            base.OnSelectedIndexChanged(e);
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            int i = IndexFromPoint(e.Location);
            if (i != _uzerinde)
            {
                int eski = _uzerinde;
                _uzerinde = i;
                if (eski >= 0 && eski < Items.Count) Invalidate(GetItemRectangle(eski));
                if (i >= 0 && i < Items.Count) Invalidate(GetItemRectangle(i));
            }
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            if (_uzerinde >= 0 && _uzerinde < Items.Count) Invalidate(GetItemRectangle(_uzerinde));
            _uzerinde = -1;
        }
    }

    /// <summary>Simgeli seçim listesi (pencerenin solundaki tür listesi): seçili satır yeşil, simgesi beyaz.</summary>
    internal sealed class SimgeListesi : ListBox
    {
        /// <summary>Satırın simgesi (nesne, seçili mi).</summary>
        public Func<object, bool, Image> Simge = (o, s) => null;
        private int _uzerinde = -1;

        public SimgeListesi()
        {
            DrawMode = DrawMode.OwnerDrawFixed;
            BorderStyle = BorderStyle.None;
            BackColor = KoyuRenk.Arka;
            ForeColor = KoyuRenk.Yazi;
            Font = KoyuYazi.Govde;
            ItemHeight = Olcu.S(36);
            IntegralHeight = false;
            Yerel.KoyuKaydirma(this);
        }

        protected override void OnDrawItem(DrawItemEventArgs e)
        {
            var g = e.Graphics;
            var r = e.Bounds;
            using (var b = new SolidBrush(BackColor)) g.FillRectangle(b, r);
            if (e.Index < 0 || e.Index >= Items.Count) return;
            var o = Items[e.Index];
            bool secili = (e.State & DrawItemState.Selected) != 0;
            var kutu = new Rectangle(r.X + 1, r.Y + Olcu.S(2), r.Width - Olcu.S(4), r.Height - Olcu.S(4));
            if (secili) Boya.Kutu(g, kutu, KoyuRenk.Vurgu, KoyuRenk.Vurgu, Olcu.S(6));
            else if (e.Index == _uzerinde) Boya.Kutu(g, kutu, KoyuRenk.Uzerinde, Color.Transparent, Olcu.S(6));
            int x = r.X + Olcu.S(12);
            var simge = Simge(o, secili);
            if (simge != null)
            {
                g.DrawImage(simge, x, r.Y + (r.Height - simge.Height) / 2, simge.Width, simge.Height);
                x += simge.Width + Olcu.S(10);
            }
            Boya.Yazi(g, GetItemText(o), secili ? KoyuYazi.Kalin : KoyuYazi.Govde, new Rectangle(x, r.Y, r.Right - x - Olcu.S(4), r.Height),
                secili ? Color.White : KoyuRenk.Yazi, TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            int i = IndexFromPoint(e.Location);
            if (i != _uzerinde)
            {
                int eski = _uzerinde;
                _uzerinde = i;
                if (eski >= 0 && eski < Items.Count) Invalidate(GetItemRectangle(eski));
                if (i >= 0 && i < Items.Count) Invalidate(GetItemRectangle(i));
            }
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            if (_uzerinde >= 0 && _uzerinde < Items.Count) Invalidate(GetItemRectangle(_uzerinde));
            _uzerinde = -1;
        }
    }

    // =====================================================================================================
    // Sekmeler, bilgi çubuğu, özet satırı, kutucuk
    // =====================================================================================================

    /// <summary>Sekme şeridi: her sekme bir sayfa (Panel); seçili sekme yeşil.</summary>
    internal sealed class Sekmeler : Control
    {
        private readonly List<string> _adlar = new List<string>();
        private readonly List<Control> _sayfalar = new List<Control>();
        private readonly List<Rectangle> _alanlar = new List<Rectangle>();
        private int _secili, _uzerinde = -1;

        public Sekmeler()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
            Font = KoyuYazi.Kalin;
            TabStop = true;
            Height = Olcu.S(34);
            Cursor = Cursors.Hand;
        }

        public void Ekle(string ad, Control sayfa)
        {
            _adlar.Add(ad);
            _sayfalar.Add(sayfa);
            sayfa.Visible = _sayfalar.Count - 1 == _secili;
            Hesapla();
            Invalidate();
        }

        /// <summary>Seçili sekme değişince.</summary>
        public event Action Degisti;

        public int Secili
        {
            get => _secili;
            set
            {
                if (value < 0 || value >= _sayfalar.Count) return;
                bool degisti = value != _secili;
                _secili = value;
                for (int i = 0; i < _sayfalar.Count; i++) _sayfalar[i].Visible = i == value;
                Invalidate();
                if (degisti) Degisti?.Invoke();
            }
        }

        private void Hesapla()
        {
            _alanlar.Clear();
            int x = 0;
            foreach (var ad in _adlar)
            {
                int w = TextRenderer.MeasureText(ad, Font, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine).Width + Olcu.S(32);
                _alanlar.Add(new Rectangle(x, 0, w, Height));
                x += w + Olcu.S(6);
            }
        }

        protected override void OnResize(EventArgs e) { base.OnResize(e); Hesapla(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            for (int i = 0; i < _alanlar.Count; i++)
            {
                var r = _alanlar[i];
                bool s = i == _secili;
                Boya.Kutu(g, r, s ? KoyuRenk.Vurgu : i == _uzerinde ? KoyuRenk.Uzerinde : KoyuRenk.Kart, s ? (Focused ? KoyuRenk.Yesil : KoyuRenk.Vurgu) : KoyuRenk.Kenar, Olcu.S(6));
                Boya.Yazi(g, _adlar[i], Font, r, s ? Color.White : KoyuRenk.Ikincil, TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter | TextFormatFlags.SingleLine);
            }
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            for (int i = 0; i < _alanlar.Count; i++)
                if (_alanlar[i].Contains(e.Location)) { Focus(); Secili = i; return; }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            int u = _alanlar.FindIndex(r => r.Contains(e.Location));
            if (u != _uzerinde) { _uzerinde = u; Invalidate(); }
        }

        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); _uzerinde = -1; Invalidate(); }
        protected override void OnGotFocus(EventArgs e) { base.OnGotFocus(e); Invalidate(); }
        protected override void OnLostFocus(EventArgs e) { base.OnLostFocus(e); Invalidate(); }

        protected override bool IsInputKey(Keys keyData) => keyData == Keys.Left || keyData == Keys.Right || base.IsInputKey(keyData);

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.KeyCode == Keys.Right) Secili = (_secili + 1) % Math.Max(1, _sayfalar.Count);
            else if (e.KeyCode == Keys.Left) Secili = (_secili - 1 + _sayfalar.Count) % Math.Max(1, _sayfalar.Count);
        }
    }

    /// <summary>
    /// Cins seçimi: yuvarlak düğmeler (ör. "Hepsi 79 · Galvanizli demir 19 · Beton 37 · Ağaç 4"); seçili olan yeşil. Sığmayan
    /// düğme alt satıra geçer; yükseklik GerekenYukseklik ile bulunur. Sol / sağ ok tuşlarıyla da seçilir.
    /// </summary>
    internal sealed class CinsSecici : Control
    {
        public sealed class Secenek
        {
            public string Kod = "", Ad = "";
            public int Sayi = -1;
            public string Ipucu = "";
        }

        private readonly List<Secenek> _l = new List<Secenek>();
        private readonly List<Rectangle> _alanlar = new List<Rectangle>();
        private int _secili = -1, _uzerinde = -1;
        private readonly ToolTip _ipucu = new ToolTip();
        public event Action Degisti;

        public CinsSecici()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
            Font = KoyuYazi.Govde;
            TabStop = true;
            Height = Olcu.S(30);
            Cursor = Cursors.Hand;
        }

        public IList<Secenek> Secenekler => _l;

        public void Doldur(IEnumerable<Secenek> l, string seciliKod)
        {
            _l.Clear();
            _l.AddRange(l);
            _secili = _l.FindIndex(x => x.Kod == (seciliKod ?? ""));
            if (_secili < 0 && _l.Count > 0) _secili = 0;
            Hesapla();
            Invalidate();
        }

        public string SeciliKod => _secili >= 0 && _secili < _l.Count ? _l[_secili].Kod : "";

        /// <summary>Kodu verilen seçeneği seçer (Degisti olayı çalışır); yoksa bir şey yapmaz.</summary>
        public void Sec(string kod)
        {
            int i = _l.FindIndex(x => x.Kod == (kod ?? ""));
            if (i >= 0) Secili = i;
        }

        public int Secili
        {
            get => _secili;
            set
            {
                if (value < 0 || value >= _l.Count || value == _secili) return;
                _secili = value;
                Invalidate();
                Degisti?.Invoke();
            }
        }

        private string Yazi(Secenek s) => s.Ad;
        private string SayiYazisi(Secenek s) => s.Sayi >= 0 ? s.Sayi.ToString("N0", CultureInfo.GetCultureInfo("tr-TR")) : "";

        private void Hesapla()
        {
            _alanlar.Clear();
            int x = 0, y = 0, h = Olcu.S(28), ara = Olcu.S(6);
            foreach (var s in _l)
            {
                int w = TextRenderer.MeasureText(Yazi(s), KoyuYazi.Kalin, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine).Width + Olcu.S(24);
                string sayi = SayiYazisi(s);
                if (sayi.Length > 0) w += TextRenderer.MeasureText(sayi, KoyuYazi.Kucuk, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine).Width + Olcu.S(4);
                w = Math.Min(w, Math.Max(Olcu.S(60), Width));
                if (x > 0 && x + w > Width) { x = 0; y += h + ara; }
                _alanlar.Add(new Rectangle(x, y, w, h));
                x += w + ara;
            }
        }

        /// <summary>Bütün düğmelerin sığdığı yükseklik (piksel).</summary>
        public int GerekenYukseklik
        {
            get
            {
                Hesapla();
                int alt = 0;
                foreach (var r in _alanlar) alt = Math.Max(alt, r.Bottom);
                return Math.Max(Olcu.S(28), alt);
            }
        }

        protected override void OnResize(EventArgs e) { base.OnResize(e); Hesapla(); Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            for (int i = 0; i < _alanlar.Count && i < _l.Count; i++)
            {
                var r = _alanlar[i];
                bool s = i == _secili;
                var zemin = s ? KoyuRenk.Vurgu : i == _uzerinde ? KoyuRenk.Uzerinde : KoyuRenk.Kart;
                var kenar = s ? (Focused ? KoyuRenk.Yesil : KoyuRenk.Vurgu) : KoyuRenk.Kenar;
                Boya.Kutu(g, r, zemin, kenar, r.Height / 2);
                string sayi = SayiYazisi(_l[i]);
                int sayiEn = sayi.Length > 0 ? TextRenderer.MeasureText(sayi, KoyuYazi.Kucuk, Size.Empty, TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine).Width + Olcu.S(4) : 0;
                var ra = new Rectangle(r.X + Olcu.S(12), r.Y, Math.Max(1, r.Width - Olcu.S(24) - sayiEn), r.Height);
                Boya.Yazi(g, Yazi(_l[i]), KoyuYazi.Kalin, ra, s ? Color.White : KoyuRenk.Yazi,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
                if (sayiEn > 0)
                    Boya.Yazi(g, sayi, KoyuYazi.Kucuk, new Rectangle(ra.Right + Olcu.S(2), r.Y, sayiEn, r.Height), s ? Color.FromArgb(0xD8, 0xF5, 0xE6) : KoyuRenk.Soluk,
                        TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.SingleLine);
            }
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            for (int i = 0; i < _alanlar.Count; i++)
                if (_alanlar[i].Contains(e.Location)) { Focus(); Secili = i; return; }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            int u = _alanlar.FindIndex(r => r.Contains(e.Location));
            if (u == _uzerinde) return;
            _uzerinde = u;
            Invalidate();
            try { _ipucu.SetToolTip(this, u >= 0 && u < _l.Count ? _l[u].Ipucu : ""); } catch { }
        }

        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); _uzerinde = -1; Invalidate(); }
        protected override void OnGotFocus(EventArgs e) { base.OnGotFocus(e); Invalidate(); }
        protected override void OnLostFocus(EventArgs e) { base.OnLostFocus(e); Invalidate(); }

        protected override bool IsInputKey(Keys keyData) => keyData == Keys.Left || keyData == Keys.Right || base.IsInputKey(keyData);

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (_l.Count == 0) return;
            if (e.KeyCode == Keys.Right) Secili = Math.Min(_l.Count - 1, _secili + 1);
            else if (e.KeyCode == Keys.Left) Secili = Math.Max(0, _secili - 1);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) _ipucu.Dispose();
            base.Dispose(disposing);
        }
    }

    internal enum BilgiTuru { Bilgi, Uyari, Hata }

    /// <summary>Bilgi / uyarı / hata çubuğu: renkli zemin, simge, sarılan yazı.</summary>
    internal sealed class BilgiCubugu : Control
    {
        private BilgiTuru _tur;

        public BilgiCubugu(BilgiTuru tur, string metin)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            _tur = tur;
            Text = metin;
            Font = KoyuYazi.Govde;
        }

        public BilgiTuru Tur
        {
            get => _tur;
            set { _tur = value; Invalidate(); }
        }

        protected override void OnTextChanged(EventArgs e) { base.OnTextChanged(e); Invalidate(); }

        private void Renkler(out Color zemin, out Color kenar, out Color yazi, out string simge)
        {
            switch (_tur)
            {
                case BilgiTuru.Uyari: zemin = KoyuRenk.UyariZemin; kenar = KoyuRenk.UyariKenar; yazi = KoyuRenk.UyariYazi; simge = "uyari"; break;
                case BilgiTuru.Hata: zemin = KoyuRenk.HataZemin; kenar = KoyuRenk.HataKenar; yazi = KoyuRenk.HataYazi; simge = "uyari"; break;
                default: zemin = KoyuRenk.BilgiZemin; kenar = KoyuRenk.BilgiKenar; yazi = KoyuRenk.BilgiYazi; simge = "bilgi"; break;
            }
        }

        /// <summary>Verilen genişlikte yazının sığacağı yükseklik (piksel).</summary>
        public int GerekenYukseklik(int en)
        {
            int w = Math.Max(20, en - Olcu.S(48));
            var t = TextRenderer.MeasureText(Text ?? "", Font, new Size(w, 10000), TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix);
            return Math.Max(Olcu.S(40), t.Height + Olcu.S(20));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            Color zemin, kenar, yazi;
            string simge;
            Renkler(out zemin, out kenar, out yazi, out simge);
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            Boya.Kutu(g, ClientRectangle, zemin, kenar, Olcu.S(6));
            var img = ArayuzSimgeleri.Gdi(simge, Olcu.S(18), yazi);
            g.DrawImage(img, Olcu.S(12), Olcu.S(11), img.Width, img.Height);
            var r = new Rectangle(Olcu.S(38), Olcu.S(10), Width - Olcu.S(48), Height - Olcu.S(16));
            Boya.Yazi(g, Text, Font, r, yazi, TextFormatFlags.WordBreak | TextFormatFlags.Left | TextFormatFlags.Top | TextFormatFlags.EndEllipsis);
        }
    }

    /// <summary>Altbilgideki özet satırı: simge + "Çizilecek: AG Direk · G-10I · M · 2. hakediş".</summary>
    internal sealed class OzetSatiri : Control
    {
        private Image _simge;

        public OzetSatiri()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Font = KoyuYazi.Govde;
        }

        public Image Simge
        {
            get => _simge;
            set { _simge = value; Invalidate(); }
        }

        protected override void OnTextChanged(EventArgs e) { base.OnTextChanged(e); Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            int x = 0;
            if (_simge != null)
            {
                g.DrawImage(_simge, 0, (Height - _simge.Height) / 2, _simge.Width, _simge.Height);
                x = _simge.Width + Olcu.S(8);
            }
            Boya.Yazi(g, Text, Font, new Rectangle(x, 0, Width - x, Height), KoyuRenk.Ikincil,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
        }
    }

    /// <summary>Sayı kutucuğu (Telefondan al): renkli başlık bandı, büyük sayı.</summary>
    internal sealed class SayiKutucugu : Control
    {
        public Color Renk;
        public int Sayi;

        public SayiKutucugu(string baslik, int sayi, Color renk)
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Text = baslik;
            Sayi = sayi;
            Renk = renk;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
            Boya.Kutu(g, ClientRectangle, Renk, Renk, Olcu.S(8));
            Boya.Yazi(g, Text, KoyuYazi.Kalin, new Rectangle(Olcu.S(14), Olcu.S(6), Width - Olcu.S(20), Olcu.S(20)), Color.White,
                TextFormatFlags.Left | TextFormatFlags.Top | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
            Boya.Yazi(g, Sayi.ToString("N0", CultureInfo.GetCultureInfo("tr-TR")), KoyuYazi.Iri, new Rectangle(Olcu.S(12), Olcu.S(22), Width - Olcu.S(20), Height - Olcu.S(24)), Color.White,
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        }
    }

    // =====================================================================================================
    // Tablo
    // =====================================================================================================

    /// <summary>DataGridView'e koyu tema uygular.</summary>
    internal static class KoyuTablo
    {
        public static void Uygula(DataGridView g)
        {
            g.BorderStyle = BorderStyle.None;
            g.BackgroundColor = KoyuRenk.Kutu;
            g.GridColor = KoyuRenk.Kenar;
            g.EnableHeadersVisualStyles = false;
            g.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
            g.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
            g.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            g.ColumnHeadersHeight = Olcu.S(34);
            g.ColumnHeadersDefaultCellStyle.BackColor = KoyuRenk.Kart;
            g.ColumnHeadersDefaultCellStyle.ForeColor = KoyuRenk.Ikincil;
            g.ColumnHeadersDefaultCellStyle.SelectionBackColor = KoyuRenk.Kart;
            g.ColumnHeadersDefaultCellStyle.SelectionForeColor = KoyuRenk.Ikincil;
            g.ColumnHeadersDefaultCellStyle.Font = KoyuYazi.Kalin;
            g.ColumnHeadersDefaultCellStyle.Padding = new Padding(Olcu.S(6), 0, Olcu.S(4), 0);
            g.ColumnHeadersDefaultCellStyle.WrapMode = DataGridViewTriState.False;
            g.DefaultCellStyle.BackColor = KoyuRenk.Kutu;
            g.DefaultCellStyle.ForeColor = KoyuRenk.Yazi;
            g.DefaultCellStyle.SelectionBackColor = KoyuRenk.Secili;
            g.DefaultCellStyle.SelectionForeColor = KoyuRenk.Yazi;
            g.DefaultCellStyle.Font = KoyuYazi.Govde;
            g.DefaultCellStyle.Padding = new Padding(Olcu.S(6), 0, Olcu.S(4), 0);
            g.RowTemplate.Height = Olcu.S(30);
            g.RowHeadersVisible = false;
            g.AllowUserToResizeRows = false;
            g.EditingControlShowing += (s, e) =>
            {
                e.Control.BackColor = KoyuRenk.Kutu;
                e.Control.ForeColor = KoyuRenk.Yazi;
            };
            g.HandleCreated += (s, e) =>
            {
                Yerel.KoyuKaydirma(g.Handle);
                foreach (Control c in g.Controls) if (c is ScrollBar) Yerel.KoyuKaydirma(c);
            };
        }
    }

    // =====================================================================================================
    // İleti kutusu
    // =====================================================================================================

    /// <summary>Koyu ileti kutusu (Tamam / Evet-Hayır).</summary>
    internal static class KoyuMesaj
    {
        public static DialogResult Goster(string metin, string baslik, MessageBoxButtons dugmeler, MessageBoxIcon simge, MessageBoxDefaultButton varsayilan,
            Func<Form, IWin32Window, DialogResult> gosterici)
        {
            metin = metin ?? "";
            int metinEn;
            Size olcu;
            using (var bmp = new Bitmap(1, 1))
            using (var g = Graphics.FromImage(bmp))
            {
                var tek = TextRenderer.MeasureText(g, metin, KoyuYazi.Govde, new Size(Olcu.S(1000), 10000), TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix);
                metinEn = Math.Min(Olcu.S(520), Math.Max(Olcu.S(300), tek.Width + Olcu.S(8)));
                olcu = TextRenderer.MeasureText(g, metin, KoyuYazi.Govde, new Size(metinEn, 10000), TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix);
            }
            int en = (int)Math.Round((metinEn + Olcu.S(96)) / Olcu.K);
            int metinBoy = (int)Math.Round(olcu.Height / Olcu.K);
            int boy = Math.Min(760, 42 + 24 + Math.Max(36, metinBoy) + 24 + 60);
            string simgeAdi;
            Color renk;
            switch (simge)
            {
                case MessageBoxIcon.Warning: simgeAdi = "uyari"; renk = KoyuRenk.Sari; break;
                case MessageBoxIcon.Error: simgeAdi = "hata"; renk = KoyuRenk.Kirmizi; break;
                case MessageBoxIcon.Question: simgeAdi = "soru"; renk = KoyuRenk.MaviAcik; break;
                default: simgeAdi = "bilgi"; renk = KoyuRenk.MaviAcik; break;
            }
            using (var f = new KoyuPencere(baslik, en, boy))
            {
                var resim = new PictureBox
                {
                    Image = ArayuzSimgeleri.Gdi(simgeAdi, Olcu.S(32), renk),
                    SizeMode = PictureBoxSizeMode.CenterImage,
                    BackColor = Color.Transparent,
                    Bounds = new Rectangle(Olcu.S(22), Olcu.S(62), Olcu.S(36), Olcu.S(36)),
                };
                f.Controls.Add(resim);
                var yazi = new Label
                {
                    Text = metin,
                    UseMnemonic = false,
                    AutoSize = false,
                    BackColor = Color.Transparent,
                    ForeColor = KoyuRenk.Yazi,
                    Font = KoyuYazi.Govde,
                    Bounds = new Rectangle(Olcu.S(74), Olcu.S(64), metinEn + Olcu.S(4), f.ClientSize.Height - Olcu.S(64) - f.Alt.Height - Olcu.S(12)),
                };
                f.Controls.Add(yazi);
                var alt = f.Alt;
                int bw = Olcu.S(104), bh = Olcu.S(34), y = (alt.Height - bh) / 2;
                if (dugmeler == MessageBoxButtons.YesNo || dugmeler == MessageBoxButtons.OKCancel)
                {
                    bool evetHayir = dugmeler == MessageBoxButtons.YesNo;
                    var hayir = new KoyuDugme(evetHayir ? "Hayır" : "Vazgeç") { DialogResult = evetHayir ? DialogResult.No : DialogResult.Cancel };
                    var evet = new KoyuDugme(evetHayir ? "Evet" : "Tamam", DugmeTuru.Birincil) { DialogResult = evetHayir ? DialogResult.Yes : DialogResult.OK };
                    hayir.SetBounds(alt.Width - Olcu.S(16) - bw, y, bw, bh);
                    evet.SetBounds(hayir.Left - Olcu.S(10) - bw, y, bw, bh);
                    alt.Controls.Add(evet);
                    alt.Controls.Add(hayir);
                    f.AcceptButton = varsayilan == MessageBoxDefaultButton.Button2 ? (IButtonControl)hayir : evet;
                    f.CancelButton = hayir;
                    f.Shown += (s, e) => (varsayilan == MessageBoxDefaultButton.Button2 ? (Control)hayir : evet).Focus();
                }
                else
                {
                    var tamam = new KoyuDugme("Tamam", DugmeTuru.Birincil) { DialogResult = DialogResult.OK };
                    tamam.SetBounds(alt.Width - Olcu.S(16) - bw, y, bw, bh);
                    alt.Controls.Add(tamam);
                    f.AcceptButton = tamam;
                    f.CancelButton = tamam;
                    f.Shown += (s, e) => tamam.Focus();
                }
                var r = gosterici(f, null);
                if (dugmeler == MessageBoxButtons.YesNo && r != DialogResult.Yes) return DialogResult.No;
                return r;
            }
        }
    }
}
