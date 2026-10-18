using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using SebekeHakedis.Cekirdek;
#if AUTOCAD
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
#endif

namespace SebekeHakedis.Eklenti
{
    internal sealed class ElemanSecimi
    {
        public string Tur = "AG_DIREK";
        public KatalogKalemi Tip;
        public string Durum = "M";
        public string DmDurum = "";
        public int Hakedis = 1;
        /// <summary>İlk elemanın elle yazılan GIS numarası; boşsa kendiliğinden verilir.</summary>
        public string Gis = "";
        /// <summary>Menü öğesinden gelen cins süzgeci (boş: türün bütün cinsleri).</summary>
        public List<string> Cinsler = new List<string>();

        public override string ToString() =>
            Turler.ElemanAdi(Tur) + " · " + (Tip != null ? Tip.Tanim.Trim() : "") + " · " + Durum + " · " + Hakedis + ". hakediş";
    }

    internal sealed class HatSecimi
    {
        public string Tur = "AG_HAVAI";
        public KatalogKalemi Kesit;
        public string Durum = "M";
        public int Hakedis = 1;
        public List<string> Cinsler = new List<string>();

        public override string ToString() =>
            Turler.HatAdi(Tur) + " · " + (Kesit != null ? Kesit.Tanim.Trim() : "") + " · " + Durum + " · " + Hakedis + ". hakediş";
    }

    internal sealed class KanalSecimi
    {
        public bool Og, Ag, Ayd, Rek;
        public string Zemin = "TOPRAK";
        public double Alt = 40, Ust = 40, Derinlik = 100;
        public string Durum = "M+M";
        public int Hakedis = 1;

        public int Kod => KanalKodu.Kod(Og, Ag, Ayd, Rek);

        public override string ToString() =>
            "Kanal " + KanalKodu.Kablolar(Kod) + " · " + Zemin + " · " + Alt.ToString("0.#", CultureInfo.InvariantCulture) + "/" +
            Ust.ToString("0.#", CultureInfo.InvariantCulture) + "×" + Derinlik.ToString("0.#", CultureInfo.InvariantCulture) + " cm · " + Durum;
    }

    internal sealed class SondajSecimi
    {
        public KatalogKalemi Tip;
        public string Durum = "M";
        public int Hakedis = 1;

        public override string ToString() => "Yatay sondaj · " + (Tip != null ? Tip.Tanim : "") + " · " + Durum;
    }

    /// <summary>Eklentinin pencereleri (kodla kurulur; tasarım dosyası gerektirmez).</summary>
    internal static class Pencereler
    {
        private const string Baslik = "Şebeke Hakediş";

        /// <summary>Pencereyi gösterir: AutoCAD içinde AutoCAD'in modal penceresiyle. Denemede ekran görüntüsü için değiştirilir.</summary>
        public static Func<Form, IWin32Window, DialogResult> Gosterici = VarsayilanGoster;

        /// <summary>Bilgi / soru kutusu. Denemede değiştirilir.</summary>
        public static Func<string, MessageBoxButtons, MessageBoxIcon, MessageBoxDefaultButton, DialogResult> Mesaj =
            (metin, dugmeler, simge, varsayilan) => MessageBox.Show(metin, Baslik, dugmeler, simge, varsayilan);

        private static DialogResult VarsayilanGoster(Form f, IWin32Window sahip)
        {
            if (sahip != null) return f.ShowDialog(sahip);
#if AUTOCAD
            return AcApp.ShowModalDialog(f);
#else
            return f.ShowDialog();
#endif
        }

        // ================= Ortak parçalar =================

        private sealed class Duzen : IDisposable
        {
            public readonly Form F;
            private readonly TableLayoutPanel _t;
            public readonly FlowLayoutPanel Alt;
            public readonly Button Tamam, Vazgec;
            public Func<bool> Dogrula;

            public Duzen(string baslik, int en, int boy, string tamamYazisi)
            {
                F = new Form
                {
                    Text = baslik,
                    FormBorderStyle = FormBorderStyle.FixedDialog,
                    MaximizeBox = false,
                    MinimizeBox = false,
                    ShowInTaskbar = false,
                    StartPosition = FormStartPosition.CenterScreen,
                    AutoScaleMode = AutoScaleMode.Font,
                    Font = new Font("Segoe UI", 9F),
                    ClientSize = new Size(en, boy),
                };
                _t = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(14, 12, 14, 0), AutoScroll = true };
                _t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170F));
                _t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
                Alt = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = 54, Padding = new Padding(10, 10, 10, 8) };
                Tamam = new Button { Text = tamamYazisi, Width = 130, Height = 32 };
                Vazgec = new Button { Text = "Vazgeç", Width = 100, Height = 32, DialogResult = DialogResult.Cancel };
                Alt.Controls.Add(Tamam);
                Alt.Controls.Add(Vazgec);
                F.Controls.Add(_t);
                F.Controls.Add(Alt);
                F.AcceptButton = Tamam;
                F.CancelButton = Vazgec;
                Tamam.Click += (s, e) =>
                {
                    if (Dogrula == null || Dogrula()) F.DialogResult = DialogResult.OK;
                };
            }

            private bool _dolduran;

            public T Satir<T>(string etiket, T kontrol) where T : Control
            {
                int r = _t.RowCount++;
                _t.RowStyles.Add(new RowStyle(SizeType.AutoSize));
                var l = new Label { Text = etiket, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 6, 8, 6) };
                if (kontrol is NumericUpDown)
                {
                    kontrol.Width = 110;
                    kontrol.Anchor = AnchorStyles.Left;
                }
                else if (!(kontrol is CheckBox) && !(kontrol is FlowLayoutPanel) && !(kontrol is TableLayoutPanel)) kontrol.Dock = DockStyle.Fill;
                kontrol.Margin = new Padding(0, 4, 0, 4);
                _t.Controls.Add(l, 0, r);
                _t.Controls.Add(kontrol, 1, r);
                return kontrol;
            }

            /// <summary>İki sütuna yayılan satır. yukseklik 0: içeriğe göre; -1: pencerede kalan boşluğun tamamı.</summary>
            public T Tam<T>(T kontrol, float yukseklik) where T : Control
            {
                int r = _t.RowCount++;
                if (yukseklik < 0)
                {
                    _t.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
                    _dolduran = true;
                }
                else _t.RowStyles.Add(yukseklik > 0 ? new RowStyle(SizeType.Absolute, yukseklik) : new RowStyle(SizeType.AutoSize));
                if (yukseklik != 0) kontrol.Dock = DockStyle.Fill;
                _t.Controls.Add(kontrol, 0, r);
                _t.SetColumnSpan(kontrol, 2);
                return kontrol;
            }

            public Label Not(string metin)
            {
                var l = new Label
                {
                    Text = metin,
                    AutoSize = true,
                    ForeColor = SystemColors.GrayText,
                    MaximumSize = new Size(F.ClientSize.Width - 40, 0),
                    Margin = new Padding(0, 2, 0, 8),
                };
                return Tam(l, 0);
            }

            public Label AraBaslik(string metin)
            {
                var l = new Label { Text = metin, AutoSize = true, Font = new Font(F.Font, FontStyle.Bold), Margin = new Padding(0, 10, 0, 4) };
                return Tam(l, 0);
            }

            public bool Goster(IWin32Window sahip = null)
            {
                if (!_dolduran)
                {
                    _t.RowCount++;
                    _t.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
                }
                if (sahip != null) F.StartPosition = FormStartPosition.CenterParent;
                return Gosterici(F, sahip) == DialogResult.OK;
            }

            public void Dispose() => F.Dispose();
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, string lParam);

        private static void Ipucu(TextBox t, string metin)
        {
            t.HandleCreated += (s, e) =>
            {
                try { SendMessage(t.Handle, 0x1501, (IntPtr)1, metin); } catch { }
            };
        }

        /// <summary>Aramada büyük/küçük harf ve Türkçe I/İ farkını yok sayar.</summary>
        private static string Norm(string s) => (s ?? "").ToUpperInvariant().Replace('İ', 'I').Replace('ı', 'I');

        /// <summary>Katalogdan seçim listesi: üstte arama kutusu, altta liste.</summary>
        private sealed class KatalogListesi
        {
            public readonly Panel Kap = new Panel();
            public readonly TextBox Ara = new TextBox();
            public readonly ListBox Liste = new ListBox { IntegralHeight = false };
            private List<KatalogKalemi> _hepsi = new List<KatalogKalemi>();
            public event Action Secildi;

            public KatalogListesi()
            {
                Ara.Dock = DockStyle.Top;
                Liste.Dock = DockStyle.Fill;
                Kap.Controls.Add(Liste);
                Kap.Controls.Add(Ara);
                Ipucu(Ara, "Aramak için yazın (tip, cins…)");
                Ara.TextChanged += (s, e) => Suz(Secili?.Anahtar);
                Ara.KeyDown += (s, e) =>
                {
                    if (e.KeyCode == Keys.Down && Liste.Items.Count > 0)
                    {
                        Liste.Focus();
                        if (Liste.SelectedIndex < 0) Liste.SelectedIndex = 0;
                        e.Handled = true;
                    }
                };
                Liste.DoubleClick += (s, e) => { if (Secili != null) Secildi?.Invoke(); };
            }

            public void Doldur(List<KatalogKalemi> l, string seciliAnahtar)
            {
                _hepsi = l ?? new List<KatalogKalemi>();
                Suz(seciliAnahtar);
            }

            private void Suz(string seciliAnahtar)
            {
                var sozcukler = Norm(Ara.Text).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                Liste.BeginUpdate();
                Liste.Items.Clear();
                int sec = -1;
                foreach (var it in _hepsi)
                {
                    string y = Norm(it.Tanim + " " + it.Cins + " " + it.Birim);
                    bool uygun = true;
                    foreach (var s in sozcukler) if (y.IndexOf(s, StringComparison.Ordinal) < 0) { uygun = false; break; }
                    if (!uygun) continue;
                    int i = Liste.Items.Add(it);
                    if (sec < 0 && seciliAnahtar != null && it.Anahtar == seciliAnahtar) sec = i;
                }
                Liste.EndUpdate();
                if (Liste.Items.Count > 0) Liste.SelectedIndex = sec >= 0 ? sec : 0;
            }

            public KatalogKalemi Secili => Liste.SelectedItem as KatalogKalemi;
        }

        private static ComboBox DurumKutusu(string secili)
        {
            var c = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
            foreach (var d in Turler.CizimDurumlari) c.Items.Add(d + "   —   " + Turler.DurumAdi(d));
            int i = Array.IndexOf(Turler.CizimDurumlari, secili);
            c.SelectedIndex = i >= 0 ? i : 0;
            return c;
        }

        private static string DurumKodu(ComboBox c) => c.SelectedIndex >= 0 && c.SelectedIndex < Turler.CizimDurumlari.Length ? Turler.CizimDurumlari[c.SelectedIndex] : "M";

        private static ComboBox DmKutusu(string secili)
        {
            var c = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
            c.Items.Add("(yok)");
            c.Items.Add("KESİK");
            c.Items.Add("SÖKÜK");
            c.SelectedIndex = secili == "KESİK" ? 1 : secili == "SÖKÜK" ? 2 : 0;
            return c;
        }

        private static string DmKodu(ComboBox c) => c.SelectedIndex == 1 ? "KESİK" : c.SelectedIndex == 2 ? "SÖKÜK" : "";

        private static NumericUpDown Sayi(decimal min, decimal max, decimal deger, int ondalik = 0, decimal adim = 1)
        {
            return new NumericUpDown
            {
                Minimum = min,
                Maximum = max,
                DecimalPlaces = ondalik,
                Increment = adim,
                Value = Math.Max(min, Math.Min(max, deger)),
                TextAlign = HorizontalAlignment.Right,
            };
        }

        /// <summary>Etiket + kutu çiftlerini iki sütunda dizen tablo (ayarlar penceresi için).</summary>
        private static TableLayoutPanel IkiliTablo()
        {
            var t = new TableLayoutPanel { ColumnCount = 4, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, Margin = new Padding(0, 0, 0, 4) };
            t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150F));
            t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120F));
            t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150F));
            t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120F));
            return t;
        }

        private static T IkiliEkle<T>(TableLayoutPanel t, int sira, string etiket, T kontrol) where T : Control
        {
            int satir = sira / 2, sutun = (sira % 2) * 2;
            while (t.RowCount <= satir)
            {
                t.RowCount++;
                t.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            }
            t.Controls.Add(new Label { Text = etiket, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 6, 8, 6) }, sutun, satir);
            kontrol.Width = 110;
            kontrol.Anchor = AnchorStyles.Left;
            kontrol.Margin = new Padding(0, 4, 0, 4);
            t.Controls.Add(kontrol, sutun + 1, satir);
            return kontrol;
        }

        private static decimal D(double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) return 0;
            return (decimal)Math.Max(-1e9, Math.Min(1e9, d));
        }

        public static void Uyar(string metin) =>
            Mesaj(metin, MessageBoxButtons.OK, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button1);

        public static void Bilgi(string metin) =>
            Mesaj(metin, MessageBoxButtons.OK, MessageBoxIcon.Information, MessageBoxDefaultButton.Button1);

        public static bool Onay(string metin, bool varsayilanEvet = true) =>
            Mesaj(metin, MessageBoxButtons.YesNo, MessageBoxIcon.Question,
                varsayilanEvet ? MessageBoxDefaultButton.Button1 : MessageBoxDefaultButton.Button2) == DialogResult.Yes;

        // ================= Eleman =================

        /// <summary>Cins süzgeci kutusu: "(hepsi)" + verilen cinsler (okunur adla).</summary>
        private sealed class CinsSecenegi
        {
            public string Cins; public string Ad;
            public override string ToString() => Ad;
        }

        private static ComboBox CinsKutusu()
        {
            return new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
        }

        private static void CinsleriDoldur(ComboBox c, OrtamVerisi o, List<string> cinsler, string secili)
        {
            c.BeginUpdate();
            c.Items.Clear();
            c.Items.Add(new CinsSecenegi { Cins = "", Ad = cinsler.Count > 1 ? "(hepsi)" : cinsler.Count == 1 ? o.Katalog.CinsAdi(cinsler[0]) + "  —  " + cinsler[0] : "(hepsi)" });
            int sec = 0;
            if (cinsler.Count > 1)
                foreach (var cins in cinsler)
                {
                    int i = c.Items.Add(new CinsSecenegi { Cins = cins, Ad = o.Katalog.CinsAdi(cins) + "  —  " + cins });
                    if (cins == secili) sec = i;
                }
            c.EndUpdate();
            c.SelectedIndex = sec;
        }

        private static string SeciliCins(ComboBox c) => (c.SelectedItem as CinsSecenegi)?.Cins ?? "";

        public static ElemanSecimi Eleman(OrtamVerisi o, ElemanSecimi onceki)
        {
            using (var d = new Duzen("Eleman koy — direk, box, pano, trafo, mufu", 640, 640, "Yerleştir"))
            {
                var tur = d.Satir("Tür", new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList });
                foreach (var t in Turler.Elemanlar) tur.Items.Add(t);
                var cins = d.Satir("Cins (malzeme sınıfı)", CinsKutusu());
                d.AraBaslik("Tip (katalogdan seçin, yazarak arayın)");
                var liste = new KatalogListesi();
                d.Tam(liste.Kap, -1);
                var durum = d.Satir("Durum", DurumKutusu(onceki != null ? onceki.Durum : o.Ayar.SonDeger("eleman.durum", "M")));
                var dm = d.Satir("Demontaj durumu", DmKutusu(onceki != null ? onceki.DmDurum : ""));
                var hak = d.Satir("Hakediş", Sayi(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis));
                var gis = d.Satir("İlk GIS numarası", new TextBox());
                d.Not("Her tıklamada bir eleman konur; sonraki GIS numaraları kendiliğinden artar. Bitirmek için Enter'a basın.");

                var suzgec = onceki != null ? onceki.Cinsler : new List<string>();
                bool kendimiz = false, elle = false, yukleniyor = false;
                Action gisOner = () =>
                {
                    if (elle) return;
                    var t = tur.SelectedItem as Tur;
                    kendimiz = true;
                    gis.Text = t == null ? "" : Numara.SonrakiGis(o.Proje.Elemanlar, t.Kod, o.GisOnEki, liste.Secili != null ? liste.Secili.Cins : "");
                    kendimiz = false;
                };
                gis.TextChanged += (s, e) => { if (!kendimiz) elle = true; };
                Action tipleriDoldur = () =>
                {
                    var t = tur.SelectedItem as Tur;
                    if (t == null) return;
                    string secCins = SeciliCins(cins);
                    var tipler = secCins.Length > 0 ? o.Katalog.AnaTipler(t.Kod, new[] { secCins }) : o.Katalog.AnaTipler(t.Kod, suzgec.Count > 0 ? suzgec : null);
                    if (tipler.Count == 0) tipler = o.Katalog.AnaTipler(t.Kod);
                    if (tipler.Count == 0) tipler = o.Katalog.Kalemler.FindAll(x => x.Rol == "ana");
                    string son = onceki != null && onceki.Tur == t.Kod && onceki.Tip != null ? onceki.Tip.Anahtar : o.Ayar.SonDeger("eleman.tip." + t.Kod, null);
                    liste.Doldur(tipler, son);
                    gisOner();
                };
                tur.SelectedIndexChanged += (s, e) =>
                {
                    var t = tur.SelectedItem as Tur;
                    if (t == null) return;
                    yukleniyor = true;
                    var cinsler = suzgec.Count > 0 ? new List<string>(suzgec) : o.Katalog.ElemanCinsListesi(t.Kod);
                    string sonCins = onceki != null && onceki.Tur == t.Kod && onceki.Tip != null ? onceki.Tip.Cins : "";
                    CinsleriDoldur(cins, o, cinsler, suzgec.Count > 0 ? "" : o.Ayar.SonDeger("eleman.cins." + t.Kod, sonCins));
                    yukleniyor = false;
                    tipleriDoldur();
                };
                cins.SelectedIndexChanged += (s, e) => { if (!yukleniyor) tipleriDoldur(); };
                liste.Liste.SelectedIndexChanged += (s, e) => gisOner();
                liste.Secildi += () => d.Tamam.PerformClick();
                Action dmAyarla = () => dm.Enabled = DurumKodu(durum).StartsWith("DM", StringComparison.Ordinal);
                durum.SelectedIndexChanged += (s, e) => dmAyarla();
                dmAyarla();

                string ilkTur = onceki != null ? onceki.Tur : o.Ayar.SonDeger("eleman.tur", "AG_DIREK");
                tur.SelectedIndex = Math.Max(0, Array.FindIndex(Turler.Elemanlar, t => t.Kod == ilkTur));
                if (onceki != null && !string.IsNullOrEmpty(onceki.Gis)) { gis.Text = onceki.Gis; elle = true; }

                d.Dogrula = () =>
                {
                    if (liste.Secili == null) { Uyar("Listeden bir tip seçin."); return false; }
                    return true;
                };
                if (!d.Goster()) return null;

                var sonuc = new ElemanSecimi
                {
                    Tur = ((Tur)tur.SelectedItem).Kod,
                    Tip = liste.Secili,
                    Durum = DurumKodu(durum),
                    DmDurum = dm.Enabled ? DmKodu(dm) : "",
                    Hakedis = (int)hak.Value,
                    Gis = elle ? gis.Text.Trim() : "",
                    Cinsler = suzgec,
                };
                o.Ayar.Son["eleman.tur"] = sonuc.Tur;
                o.Ayar.Son["eleman.tip." + sonuc.Tur] = sonuc.Tip.Anahtar;
                o.Ayar.Son["eleman.cins." + sonuc.Tur] = SeciliCins(cins);
                o.Ayar.Son["eleman.durum"] = sonuc.Durum;
                return sonuc;
            }
        }

        // ================= Hat =================

        public static HatSecimi Hat(OrtamVerisi o, HatSecimi onceki)
        {
            using (var d = new Duzen("Hat çiz — AG/OG havai, yeraltı, aydınlatma, rekortman", 640, 620, "Çiz"))
            {
                var tur = d.Satir("Hat türü", new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList });
                foreach (var t in Turler.Hatlar) tur.Items.Add(t);
                var cins = d.Satir("Cins (iletken / kablo sınıfı)", CinsKutusu());
                d.AraBaslik("Kesit / iletken (katalogdan seçin, yazarak arayın)");
                var liste = new KatalogListesi();
                d.Tam(liste.Kap, -1);
                var durum = d.Satir("Durum", DurumKutusu(onceki != null ? onceki.Durum : o.Ayar.SonDeger("hat.durum", "M")));
                var hak = d.Satir("Hakediş", Sayi(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis));
                d.Not("Başlangıç direğine, sonra sıradaki direklere tıklayın; Enter ile bitirin. Hat her direkte (düğümde) " +
                      "biter ve yeniden başlar; her parçanın metrajı ayrı yazılır. Metraj çizim uzunluğundan hesaplanır " +
                      "(ayarlardaki yuvarlama ve ek pay), onaylamadan önce değiştirebilirsiniz.");

                var suzgec = onceki != null ? onceki.Cinsler : new List<string>();
                bool yukleniyor = false;
                Action kesitleriDoldur = () =>
                {
                    var t = tur.SelectedItem as Tur;
                    if (t == null) return;
                    string secCins = SeciliCins(cins);
                    var kesitler = secCins.Length > 0 ? o.Katalog.HatKesitleri(t.Kod, new[] { secCins }) : o.Katalog.HatKesitleri(t.Kod, suzgec.Count > 0 ? suzgec : null);
                    if (kesitler.Count == 0) kesitler = o.Katalog.HatKesitleri(t.Kod);
                    string son = onceki != null && onceki.Tur == t.Kod && onceki.Kesit != null ? onceki.Kesit.Anahtar : o.Ayar.SonDeger("hat.kesit." + t.Kod, null);
                    liste.Doldur(kesitler, son);
                };
                tur.SelectedIndexChanged += (s, e) =>
                {
                    var t = tur.SelectedItem as Tur;
                    if (t == null) return;
                    yukleniyor = true;
                    var cinsler = suzgec.Count > 0 ? new List<string>(suzgec) : o.Katalog.HatCinsListesi(t.Kod);
                    string sonCins = onceki != null && onceki.Tur == t.Kod && onceki.Kesit != null ? onceki.Kesit.Cins : "";
                    CinsleriDoldur(cins, o, cinsler, suzgec.Count > 0 ? "" : o.Ayar.SonDeger("hat.cins." + t.Kod, sonCins));
                    yukleniyor = false;
                    kesitleriDoldur();
                };
                cins.SelectedIndexChanged += (s, e) => { if (!yukleniyor) kesitleriDoldur(); };
                liste.Secildi += () => d.Tamam.PerformClick();
                string ilkTur = onceki != null ? onceki.Tur : o.Ayar.SonDeger("hat.tur", "AG_HAVAI");
                tur.SelectedIndex = Math.Max(0, Array.FindIndex(Turler.Hatlar, t => t.Kod == ilkTur));

                d.Dogrula = () =>
                {
                    if (liste.Secili == null) { Uyar("Listeden bir kesit seçin."); return false; }
                    return true;
                };
                if (!d.Goster()) return null;
                var sonuc = new HatSecimi { Tur = ((Tur)tur.SelectedItem).Kod, Kesit = liste.Secili, Durum = DurumKodu(durum), Hakedis = (int)hak.Value, Cinsler = suzgec };
                o.Ayar.Son["hat.tur"] = sonuc.Tur;
                o.Ayar.Son["hat.kesit." + sonuc.Tur] = sonuc.Kesit.Anahtar;
                o.Ayar.Son["hat.cins." + sonuc.Tur] = SeciliCins(cins);
                o.Ayar.Son["hat.durum"] = sonuc.Durum;
                return sonuc;
            }
        }

        // ================= Kanal =================

        private static ComboBox ZeminKutusu(OrtamVerisi o, string secili)
        {
            var c = new ComboBox { DropDownStyle = ComboBoxStyle.DropDown };
            var gorulen = new HashSet<string>(StringComparer.Ordinal);
            // Önce katalogdaki kanal zeminleri (PROMAGIS sırası), sonra sabit liste ve çizimde geçenler
            foreach (var it in o.Katalog.KanalZeminleri()) if (gorulen.Add(it.Tanim)) c.Items.Add(it.Tanim);
            foreach (var z in Turler.Zeminler) if (gorulen.Add(z)) c.Items.Add(z);
            foreach (var k in o.Proje.Kanallar) if (!string.IsNullOrEmpty(k.Zemin) && gorulen.Add(k.Zemin)) c.Items.Add(k.Zemin);
            c.Text = string.IsNullOrEmpty(secili) ? "TOPRAK" : secili;
            return c;
        }

        public static KanalSecimi Kanal(OrtamVerisi o, KanalSecimi onceki)
        {
            var a = o.Ayar;
            using (var d = new Duzen("Kablo kanalı çiz", 560, 400, "Çiz"))
            {
                var kablo = new FlowLayoutPanel { AutoSize = true, WrapContents = false };
                var og = new CheckBox { Text = "OG", AutoSize = true, Margin = new Padding(0, 4, 16, 0) };
                var ag = new CheckBox { Text = "AG", AutoSize = true, Margin = new Padding(0, 4, 16, 0) };
                var ayd = new CheckBox { Text = "Aydınlatma", AutoSize = true, Margin = new Padding(0, 4, 16, 0) };
                var rek = new CheckBox { Text = "Rekortman", AutoSize = true, Margin = new Padding(0, 4, 0, 0) };
                kablo.Controls.AddRange(new Control[] { og, ag, ayd, rek });
                d.Satir("Kanaldaki kablolar", kablo);
                var zemin = d.Satir("Zemin", ZeminKutusu(o, onceki != null ? onceki.Zemin : a.KanalZemin));
                var alt = d.Satir("Alt genişlik (cm)", Sayi(0, 1000, D(onceki != null ? onceki.Alt : a.KanalAlt), 0, 5));
                var ust = d.Satir("Üst genişlik (cm)", Sayi(0, 1000, D(onceki != null ? onceki.Ust : a.KanalUst), 0, 5));
                var der = d.Satir("Derinlik (cm)", Sayi(0, 1000, D(onceki != null ? onceki.Derinlik : a.KanalDerinlik), 0, 5));
                var durum = d.Satir("Durum", DurumKutusu(onceki != null ? onceki.Durum : a.SonDeger("kanal.durum", "M+M")));
                var hak = d.Satir("Hakediş", Sayi(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis));
                d.Not("Kanalın köşelerini sırayla gösterin; başta ve sonda direğe tıklarsanız baş/bit numarası yazılır. " +
                      "Metraj çizim uzunluğundan yukarı yuvarlanır; hacim ölçülerden hesaplanır.");

                string kablolar = onceki != null
                    ? (onceki.Og ? "OG," : "") + (onceki.Ag ? "AG," : "") + (onceki.Ayd ? "AYD," : "") + (onceki.Rek ? "REK," : "")
                    : a.SonDeger("kanal.kablolar", "AG,");
                og.Checked = kablolar.Contains("OG,");
                ag.Checked = kablolar.Contains("AG,");
                ayd.Checked = kablolar.Contains("AYD,");
                rek.Checked = kablolar.Contains("REK,");

                d.Dogrula = () =>
                {
                    if (!(og.Checked || ag.Checked || ayd.Checked || rek.Checked)) { Uyar("Kanaldaki kabloları seçin."); return false; }
                    if (zemin.Text.Trim().Length == 0) { Uyar("Zemin türünü yazın ya da seçin."); return false; }
                    return true;
                };
                if (!d.Goster()) return null;
                var sonuc = new KanalSecimi
                {
                    Og = og.Checked, Ag = ag.Checked, Ayd = ayd.Checked, Rek = rek.Checked,
                    Zemin = zemin.Text.Trim(), Alt = (double)alt.Value, Ust = (double)ust.Value, Derinlik = (double)der.Value,
                    Durum = DurumKodu(durum), Hakedis = (int)hak.Value,
                };
                a.Son["kanal.kablolar"] = (sonuc.Og ? "OG," : "") + (sonuc.Ag ? "AG," : "") + (sonuc.Ayd ? "AYD," : "") + (sonuc.Rek ? "REK," : "");
                a.Son["kanal.durum"] = sonuc.Durum;
                a.KanalZemin = sonuc.Zemin;
                a.KanalAlt = sonuc.Alt;
                a.KanalUst = sonuc.Ust;
                a.KanalDerinlik = sonuc.Derinlik;
                return sonuc;
            }
        }

        // ================= Sondaj =================

        public static SondajSecimi Sondaj(OrtamVerisi o, SondajSecimi onceki)
        {
            using (var d = new Duzen("Yatay sondaj (delgi) çiz", 600, 430, "Çiz"))
            {
                d.AraBaslik("Sondaj tipi");
                var liste = new KatalogListesi();
                d.Tam(liste.Kap, -1);
                var durum = d.Satir("Durum", DurumKutusu(onceki != null ? onceki.Durum : o.Ayar.SonDeger("sondaj.durum", "M")));
                var hak = d.Satir("Hakediş", Sayi(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis));
                d.Not("Sondajın başlangıç ve bitiş noktalarını (gerekirse ara köşeleri) gösterin; Enter ile bitirin.");
                liste.Doldur(o.Katalog.SondajTipleri(), onceki != null && onceki.Tip != null ? onceki.Tip.Anahtar : o.Ayar.SonDeger("sondaj.tip", null));
                liste.Secildi += () => d.Tamam.PerformClick();
                d.Dogrula = () =>
                {
                    if (liste.Secili == null) { Uyar("Listeden bir sondaj tipi seçin."); return false; }
                    return true;
                };
                if (!d.Goster()) return null;
                var sonuc = new SondajSecimi { Tip = liste.Secili, Durum = DurumKodu(durum), Hakedis = (int)hak.Value };
                o.Ayar.Son["sondaj.tip"] = sonuc.Tip.Anahtar;
                o.Ayar.Son["sondaj.durum"] = sonuc.Durum;
                return sonuc;
            }
        }

        // ================= Bölge =================

        public static bool Bolge(ref string ad, ref string kod)
        {
            using (var d = new Duzen("Bölge (alt proje)", 520, 210, "Kaydet"))
            {
                var tAd = d.Satir("Bölge adı", new TextBox { Text = ad ?? "" });
                var tKod = d.Satir("Proje kodu", new TextBox { Text = kod ?? "" });
                d.Not("Raporun PROJE sütununa bu kod yazılır. Sınırın içindeki her nesne bu bölgeye sayılır.");
                d.Dogrula = () =>
                {
                    if (tAd.Text.Trim().Length == 0 && tKod.Text.Trim().Length == 0) { Uyar("Bölge adını ya da proje kodunu yazın."); return false; }
                    return true;
                };
                if (!d.Goster()) return false;
                ad = tAd.Text.Trim();
                kod = tKod.Text.Trim();
                return true;
            }
        }

        // ================= Katalogdan seçim =================

        public static KatalogKalemi KatalogdanSec(string baslik, List<KatalogKalemi> liste, IWin32Window sahip)
        {
            using (var d = new Duzen(baslik, 640, 520, "Ekle"))
            {
                var kl = new KatalogListesi();
                d.Tam(kl.Kap, -1);
                kl.Doldur(liste, null);
                kl.Secildi += () => d.Tamam.PerformClick();
                d.Dogrula = () =>
                {
                    if (kl.Secili == null) { Uyar("Listeden bir malzeme seçin."); return false; }
                    return true;
                };
                d.F.Shown += (s, e) => kl.Ara.Focus();
                return d.Goster(sahip) ? kl.Secili : null;
            }
        }

        // ================= Ayarlar =================

        public static bool Ayarlar(OrtamVerisi o)
        {
            var a = o.Ayar;
            using (var d = new Duzen("Şebeke Hakediş — çizim ayarları", 600, 690, "Kaydet"))
            {
                var onEk = d.Satir("Katman ön eki", new TextBox { Text = a.KatmanOnEki });
                d.Not("Boş bırakılırsa çizimdeki PROMAGIS katmanlarından bulunur (şu an: " + o.OnEk + ").");
                var gisOnEki = d.Satir("GIS ön eki", new TextBox { Text = a.GisOnEki });
                var hak = d.Satir("Aktif hakediş", Sayi(1, 999, o.Hakedis));
                var dom = d.Satir("Dilim orta meridyeni", new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList });
                dom.Items.Add("Bilinmiyor");
                foreach (var m in Turler.Domlar) dom.Items.Add(m.ToString(CultureInfo.InvariantCulture) + "°");
                dom.SelectedIndex = Math.Max(0, Array.IndexOf(Turler.Domlar, a.Dom) + 1);
                var olcek = d.Satir("Sembol ölçeği", Sayi(0, 1000, D(a.SembolOlcegi), 2, 0.5m));
                d.Not("0 = çizimdeki elemanlarla aynı ölçek (PROMAGIS çizimlerinde genellikle 4).");
                var etiket = d.Satir("Hat etiketi yüksekliği (m)", Sayi(0.05m, 50, D(a.EtiketYuksekligi), 2, 0.1m));
                var yakala = d.Satir("Direğe yakalama (m)", Sayi(0, 50, D(a.YakalamaMesafesi), 2, 0.5m));
                var yukari = d.Satir("Metraj", new CheckBox { Text = "Çizim uzunluğunu yukarı yuvarla", Checked = a.YukariYuvarla, AutoSize = true });
                d.AraBaslik("Hat metrajına eklenecek pay (m)");
                var paylar = new Dictionary<string, NumericUpDown>();
                var payTablosu = IkiliTablo();
                for (int i = 0; i < Turler.Hatlar.Length; i++)
                {
                    var t = Turler.Hatlar[i];
                    paylar[t.Kod] = IkiliEkle(payTablosu, i, t.Ad, Sayi(-100, 1000, D(a.EkPayi(t.Kod)), 2, 0.5m));
                }
                d.Tam(payTablosu, 0);
                d.AraBaslik("Kablo kanalı varsayılanları (cm)");
                var kanalTablosu = IkiliTablo();
                var alt = IkiliEkle(kanalTablosu, 0, "Alt genişlik", Sayi(0, 1000, D(a.KanalAlt), 0, 5));
                var ust = IkiliEkle(kanalTablosu, 1, "Üst genişlik", Sayi(0, 1000, D(a.KanalUst), 0, 5));
                var der = IkiliEkle(kanalTablosu, 2, "Derinlik", Sayi(0, 1000, D(a.KanalDerinlik), 0, 5));
                d.Tam(kanalTablosu, 0);
                var zemin = d.Satir("Kanal zemini", ZeminKutusu(o, a.KanalZemin));
                d.AraBaslik("Tarife (PROMAGIS: karakteristik + unsur)");
                var kar = d.Satir("Karakteristik", new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList });
                kar.Items.Add("Katalogdaki standart (çoğunlukla 01)");
                var karKodlari = new List<string>(o.Katalog.Karakteristikler.Keys);
                karKodlari.Sort(StringComparer.Ordinal);
                foreach (var kod in karKodlari) kar.Items.Add(kod + "   —   " + o.Katalog.Karakteristikler[kod]);
                kar.SelectedIndex = Math.Max(0, karKodlari.IndexOf(a.Karakteristik) + 1);
                var unsur = d.Satir("Unsur sütunu", new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList });
                unsur.Items.Add("Şehir (yatırım unsuru)");
                unsur.Items.Add("Köy / bakım unsuru");
                unsur.SelectedIndex = a.Koy ? 1 : 0;
                d.Not("Yeni konan her kalemin tarifesi bu ayarla üretilir; var olan kalemler değişmez.");
                d.AraBaslik("Görünüm");
                var sembol = d.Satir("Semboller", new CheckBox { Text = "Telefonla aynı simgeler (SH_ blokları, 1 ölçek)", Checked = a.TelefonSembolleri, AutoSize = true });
                d.Not("Kapalıysa çizimde o tür için kullanılan PROMAGIS bloğu ve ölçeği korunur.");
                if (!d.Goster()) return false;
                a.Karakteristik = kar.SelectedIndex > 0 ? karKodlari[kar.SelectedIndex - 1] : "";
                a.Koy = unsur.SelectedIndex == 1;
                a.TelefonSembolleri = sembol.Checked;

                a.KatmanOnEki = onEk.Text.Trim();
                a.GisOnEki = gisOnEki.Text.Trim();
                a.AktifHakedis = (int)hak.Value;
                a.Dom = dom.SelectedIndex > 0 ? Turler.Domlar[dom.SelectedIndex - 1] : 0;
                a.SembolOlcegi = (double)olcek.Value;
                a.EtiketYuksekligi = (double)etiket.Value;
                a.YakalamaMesafesi = (double)yakala.Value;
                a.YukariYuvarla = yukari.Checked;
                foreach (var kv in paylar)
                {
                    double v = (double)kv.Value.Value;
                    if (v == 0) a.EkPay.Remove(kv.Key);
                    else a.EkPay[kv.Key] = v;
                }
                a.KanalAlt = (double)alt.Value;
                a.KanalUst = (double)ust.Value;
                a.KanalDerinlik = (double)der.Value;
                a.KanalZemin = zemin.Text.Trim().Length > 0 ? zemin.Text.Trim() : "TOPRAK";
                return true;
            }
        }

        // ================= Malzemeler (kalem düzenleme) =================

        private static string Bicim(double d) => SayiCoz.Temiz(d, 3).ToString("0.###", new CultureInfo("tr-TR"));

        /// <summary>
        /// Nesnenin pozlarını düzenler. Tamam'a basılırsa değişiklikler nesneye (model) yazılır ve true döner;
        /// çizime yazmak çağıranın işidir.
        /// </summary>
        public static bool Kalemler(OrtamVerisi o, object nesne)
        {
            var el = nesne as Eleman;
            var hat = nesne as Hat;
            var kanal = nesne as Kanal;
            var sondaj = nesne as Sondaj;
            List<Kalem> kaynak;
            string baslik, katalogNesnesi, nesneDurumu;
            if (el != null) { kaynak = el.Kalemler; baslik = (el.GisId + " " + Turler.ElemanAdi(el.Tur) + " " + el.Tip).Trim(); katalogNesnesi = el.Tur; nesneDurumu = el.Durum; }
            else if (hat != null) { kaynak = hat.Kalemler; baslik = "Hat · " + Turler.HatAdi(hat.Tur) + " · " + hat.AnaKesit; katalogNesnesi = "HAT_" + hat.Tur; nesneDurumu = hat.Durum; }
            else if (kanal != null) { kaynak = kanal.Kalemler; baslik = "Kanal · " + kanal.Kablolar + " · " + kanal.Zemin; katalogNesnesi = "KANAL"; nesneDurumu = kanal.Durum; }
            else if (sondaj != null) { kaynak = sondaj.Kalemler; baslik = "Yatay sondaj · " + sondaj.Tip; katalogNesnesi = "SONDAJ"; nesneDurumu = sondaj.Durum; }
            else return false;

            var kalemler = kaynak.ConvertAll(k => k.Kopya());
            Kalem ana = hat != null ? kalemler.Find(k => k.Kaynak == "HAT") : kalemler.Find(k => k.Ana);
            var kanalKopya = kanal == null ? null : new Kanal { AltGenislik = kanal.AltGenislik, UstGenislik = kanal.UstGenislik, Derinlik = kanal.Derinlik };

            using (var d = new Duzen("Malzemeler — " + baslik, 900, 560, "Kaydet"))
            {
                TextBox gis = null, guc = null, gerilim = null, bas = null, bit = null;
                ComboBox zemin = null;
                NumericUpDown alt = null, ust = null, der = null;
                CheckBox og = null, ag = null, ayd = null, rek = null;
                if (el != null)
                {
                    gis = d.Satir("GIS numarası", new TextBox { Text = el.GisId });
                    if (el.Tur == "TRAFO_DIREGI" || el.Tur == "TRAFO_MERKEZI" || el.Tur == "PANO")
                    {
                        guc = d.Satir("Güç", new TextBox { Text = el.Guc });
                        gerilim = d.Satir("Gerilim", new TextBox { Text = el.Gerilim });
                    }
                }
                if (kanal != null)
                {
                    var kablo = new FlowLayoutPanel { AutoSize = true, WrapContents = false };
                    og = new CheckBox { Text = "OG", AutoSize = true, Checked = (kanal.Kod & KanalKodu.OG) != 0, Margin = new Padding(0, 4, 16, 0) };
                    ag = new CheckBox { Text = "AG", AutoSize = true, Checked = (kanal.Kod & KanalKodu.AG) != 0, Margin = new Padding(0, 4, 16, 0) };
                    ayd = new CheckBox { Text = "Aydınlatma", AutoSize = true, Checked = (kanal.Kod & KanalKodu.AYD) != 0, Margin = new Padding(0, 4, 16, 0) };
                    rek = new CheckBox { Text = "Rekortman", AutoSize = true, Checked = (kanal.Kod & KanalKodu.REK) != 0, Margin = new Padding(0, 4, 0, 0) };
                    kablo.Controls.AddRange(new Control[] { og, ag, ayd, rek });
                    d.Satir("Kanaldaki kablolar", kablo);
                    zemin = d.Satir("Zemin", ZeminKutusu(o, kanal.Zemin));
                    alt = d.Satir("Alt genişlik (cm)", Sayi(0, 1000, D(kanal.AltGenislik), 0, 5));
                    ust = d.Satir("Üst genişlik (cm)", Sayi(0, 1000, D(kanal.UstGenislik), 0, 5));
                    der = d.Satir("Derinlik (cm)", Sayi(0, 1000, D(kanal.Derinlik), 0, 5));
                }
                if (sondaj != null)
                {
                    bas = d.Satir("Başlangıç no", new TextBox { Text = sondaj.BasNo });
                    bit = d.Satir("Bitiş no", new TextBox { Text = sondaj.BitNo });
                }

                var g = new DataGridView
                {
                    AllowUserToAddRows = false,
                    AllowUserToDeleteRows = false,
                    AllowUserToResizeRows = false,
                    RowHeadersVisible = false,
                    SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                    MultiSelect = false,
                    AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                    BackgroundColor = SystemColors.Window,
                    EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2,
                };
                var durumlar = new List<string>(Turler.Durumlar);
                var dmler = new List<string>(Turler.DmDurumlari);
                foreach (var k in kalemler)
                {
                    if (!durumlar.Contains(k.Durum ?? "")) durumlar.Add(k.Durum ?? "");
                    if (!dmler.Contains(k.DmDurum ?? "")) dmler.Add(k.DmDurum ?? "");
                }
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Cins", ReadOnly = true, FillWeight = 120 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Tanım", ReadOnly = true, FillWeight = 170 });
                var cDurum = new DataGridViewComboBoxColumn { HeaderText = "Durum", FillWeight = 60, FlatStyle = FlatStyle.Flat };
                cDurum.Items.AddRange(durumlar.ToArray());
                g.Columns.Add(cDurum);
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Miktar", FillWeight = 55 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Birim", ReadOnly = true, FillWeight = 45 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Toplam", ReadOnly = true, FillWeight = 60 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Hakediş", FillWeight = 45 });
                var cDm = new DataGridViewComboBoxColumn { HeaderText = "DM durumu", FillWeight = 55, FlatStyle = FlatStyle.Flat };
                cDm.Items.AddRange(dmler.ToArray());
                g.Columns.Add(cDm);
                g.Columns[3].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                g.Columns[5].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                g.Columns[6].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                foreach (DataGridViewColumn c in g.Columns) c.SortMode = DataGridViewColumnSortMode.NotSortable;

                bool yukleniyor = false;
                Action<Kalem> hesapla = k =>
                {
                    if (kanalKopya != null && ReferenceEquals(k, ana)) k.Toplam = Metraj.KanalHacmi(kanalKopya.AltGenislik, kanalKopya.UstGenislik, kanalKopya.Derinlik, k.Miktar);
                    else k.Toplam = SayiCoz.Temiz(k.Miktar * k.Katsayi);
                };
                Action<int, Kalem> satirYaz = (r, k) =>
                {
                    yukleniyor = true;
                    var row = g.Rows[r];
                    row.Cells[0].Value = k.Cins;
                    row.Cells[1].Value = string.IsNullOrEmpty(k.Aciklama) ? k.Tanim : k.Tanim + "  (" + k.Aciklama + ")";
                    row.Cells[2].Value = k.Durum ?? "";
                    row.Cells[3].Value = Bicim(k.Miktar);
                    row.Cells[4].Value = k.Birim;
                    row.Cells[5].Value = Bicim(k.Toplam);
                    row.Cells[6].Value = k.Hakedis.ToString(CultureInfo.InvariantCulture);
                    row.Cells[7].Value = k.DmDurum ?? "";
                    row.Tag = k;
                    if (ReferenceEquals(k, ana)) row.DefaultCellStyle.Font = new Font(g.Font, FontStyle.Bold);
                    yukleniyor = false;
                };
                Func<Kalem, int> satirEkle = k =>
                {
                    int r = g.Rows.Add();
                    satirYaz(r, k);
                    return r;
                };
                foreach (var k in kalemler) satirEkle(k);

                g.DataError += (s, e) => { e.ThrowException = false; };
                g.CurrentCellDirtyStateChanged += (s, e) =>
                {
                    if (g.IsCurrentCellDirty && g.CurrentCell is DataGridViewComboBoxCell) g.CommitEdit(DataGridViewDataErrorContexts.Commit);
                };
                g.CellValueChanged += (s, e) =>
                {
                    if (yukleniyor || e.RowIndex < 0) return;
                    var row = g.Rows[e.RowIndex];
                    var k = row.Tag as Kalem;
                    if (k == null) return;
                    string deger = Convert.ToString(row.Cells[e.ColumnIndex].Value, CultureInfo.InvariantCulture) ?? "";
                    switch (e.ColumnIndex)
                    {
                        case 2: k.Durum = deger; break;
                        case 3:
                            {
                                double m = SayiCoz.Coz(deger, double.NaN);
                                if (!double.IsNaN(m) && m >= 0) k.Miktar = m;
                                break;
                            }
                        case 6:
                            {
                                int h = SayiCoz.Tam(deger, k.Hakedis);
                                if (h > 0) k.Hakedis = h;
                                break;
                            }
                        case 7: k.DmDurum = deger; break;
                    }
                    hesapla(k);
                    satirYaz(e.RowIndex, k);
                };

                d.Tam(g, -1);
                d.Not("Durum, miktar, hakediş ve demontaj durumunu hücreye tıklayıp değiştirin; toplam kendiliğinden hesaplanır. " +
                      "Kalın satır nesnenin kendi pozudur (silinemez).");

                if (kanal != null)
                {
                    EventHandler olcuDegisti = (s, e) =>
                    {
                        kanalKopya.AltGenislik = (double)alt.Value;
                        kanalKopya.UstGenislik = (double)ust.Value;
                        kanalKopya.Derinlik = (double)der.Value;
                        if (ana == null) return;
                        hesapla(ana);
                        for (int r = 0; r < g.Rows.Count; r++) if (ReferenceEquals(g.Rows[r].Tag, ana)) satirYaz(r, ana);
                    };
                    alt.ValueChanged += olcuDegisti;
                    ust.ValueChanged += olcuDegisti;
                    der.ValueChanged += olcuDegisti;
                }

                var ekle = new Button { Text = "Malzeme ekle…", Width = 140, Height = 32 };
                var sil = new Button { Text = "Satırı sil", Width = 110, Height = 32, Margin = new Padding(3, 3, 24, 3) };
                d.Alt.Controls.Add(sil);
                d.Alt.Controls.Add(ekle);
                ekle.Click += (s, e) =>
                {
                    var it = KatalogdanSec("Malzeme ekle — " + baslik, o.Katalog.Malzemeler(katalogNesnesi), d.F);
                    if (it == null) return;
                    string dur = nesneDurumu == "MEVCUT" || string.IsNullOrEmpty(nesneDurumu) ? "M" : nesneDurumu;
                    var k = Katalog.KalemYap(it, 1, dur, o.Hakedis, false, "MALZEME", o.YeniSira(), "", o.Ayar.Karakteristik, o.Ayar.Koy);
                    kalemler.Add(k);
                    int r = satirEkle(k);
                    g.ClearSelection();
                    g.Rows[r].Selected = true;
                    g.CurrentCell = g.Rows[r].Cells[3];
                    g.BeginEdit(true);
                };
                sil.Click += (s, e) =>
                {
                    if (g.CurrentRow == null) return;
                    var k = g.CurrentRow.Tag as Kalem;
                    if (k == null) return;
                    if (ReferenceEquals(k, ana)) { Uyar("Nesnenin kendi pozu silinemez. Nesneyi silmek için AutoCAD'de silin."); return; }
                    kalemler.Remove(k);
                    g.Rows.Remove(g.CurrentRow);
                };

                d.Dogrula = () =>
                {
                    g.EndEdit();
                    if (kanal != null && !(og.Checked || ag.Checked || ayd.Checked || rek.Checked)) { Uyar("Kanaldaki kabloları seçin."); return false; }
                    return true;
                };
                if (!d.Goster()) return false;

                kaynak.Clear();
                kaynak.AddRange(kalemler);
                if (el != null)
                {
                    el.GisId = gis.Text.Trim();
                    if (guc != null) el.Guc = guc.Text.Trim();
                    if (gerilim != null) el.Gerilim = gerilim.Text.Trim();
                    if (ana != null)
                    {
                        el.Durum = ana.Durum;
                        el.Hakedis = ana.Hakedis;
                        el.DmDurum = ana.DmDurum ?? "";
                        el.Cins = ana.Cins;
                        el.Tip = ana.Tanim;
                    }
                }
                if (hat != null && ana != null)
                {
                    hat.Durum = ana.Durum;
                    hat.Hakedis = ana.Hakedis;
                }
                if (kanal != null)
                {
                    kanal.Kod = KanalKodu.Kod(og.Checked, ag.Checked, ayd.Checked, rek.Checked);
                    kanal.Zemin = zemin.Text.Trim();
                    kanal.AltGenislik = (double)alt.Value;
                    kanal.UstGenislik = (double)ust.Value;
                    kanal.Derinlik = (double)der.Value;
                    if (ana != null)
                    {
                        ana.Cins = kanal.Kod.ToString(CultureInfo.InvariantCulture);
                        ana.Tanim = kanal.Zemin;
                        kanal.Durum = ana.Durum;
                        kanal.Hakedis = ana.Hakedis;
                        Metraj.Toplam(ana, kanal);
                    }
                }
                if (sondaj != null)
                {
                    sondaj.BasNo = bas.Text.Trim();
                    sondaj.BitNo = bit.Text.Trim();
                    if (ana != null)
                    {
                        sondaj.Durum = ana.Durum;
                        sondaj.Hakedis = ana.Hakedis;
                        sondaj.Tip = ana.Tanim;
                    }
                }
                return true;
            }
        }
    }
}
