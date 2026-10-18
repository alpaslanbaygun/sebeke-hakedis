using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
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

    /// <summary>Telefondan alma özeti (Telefondan al penceresi). Satırlar: { ad, açıklama }.</summary>
    internal sealed class AktarimOzeti
    {
        public string Proje = "", Dosya = "";
        /// <summary>Proje bu çizimden alınmamış görünüyor (her şey yeni eklenecek).</summary>
        public bool BaskaCizim;
        public int Degismeyen, CizimdeSilinmis;
        public readonly List<string[]> Yeniler = new List<string[]>();
        public readonly List<string[]> Guncellenenler = new List<string[]>();
        public readonly List<string> Kilitliler = new List<string>();
        public readonly List<string> Silinenler = new List<string>();
        public readonly List<string> Onaylar = new List<string>();
        public readonly List<string> Uyarilar = new List<string>();
    }

    /// <summary>Eksik malzeme penceresinden çıkış: vazgeç, bulunanları çizimde seç, ya da seç ve Excel'e yaz.</summary>
    internal enum DetayIslemi { Vazgec, Sec, Excel }

    /// <summary>
    /// Eklentinin pencereleri (kodla kurulur, koyu tema; Google Stitch tasarımı). Yerleşim 96 DPI'a göre mantıksal piksel;
    /// ekran ölçeği Olcu.S() ile uygulanır.
    /// </summary>
    internal static class Pencereler
    {
        private const string Baslik = "Şebeke Hakediş";
        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

        /// <summary>Pencereyi gösterir: AutoCAD içinde AutoCAD'in modal penceresiyle. Denemede ekran görüntüsü için değiştirilir.</summary>
        public static Func<Form, IWin32Window, DialogResult> Gosterici = VarsayilanGoster;

        /// <summary>Bilgi / soru kutusu (koyu). Denemede değiştirilir.</summary>
        public static Func<string, MessageBoxButtons, MessageBoxIcon, MessageBoxDefaultButton, DialogResult> Mesaj =
            (metin, dugmeler, simge, varsayilan) => KoyuMesaj.Goster(metin, Baslik, dugmeler, simge, varsayilan, MesajGoster);

        private static DialogResult VarsayilanGoster(Form f, IWin32Window sahip)
        {
            if (sahip != null)
            {
                f.StartPosition = FormStartPosition.CenterParent;
                return f.ShowDialog(sahip);
            }
#if AUTOCAD
            return AcApp.ShowModalDialog(null, f, false);
#else
            return f.ShowDialog();
#endif
        }

        /// <summary>İleti kutusu açık bir pencerenin üstündeyse o pencereye bağlanır.</summary>
        private static DialogResult MesajGoster(Form f, IWin32Window sahip)
        {
            var etkin = Form.ActiveForm as KoyuPencere;
            if (sahip == null && etkin != null && etkin.Visible && etkin != f) return Gosterici(f, etkin);
            return Gosterici(f, sahip);
        }

        private static DialogResult Goster(Form f, IWin32Window sahip = null)
        {
            if (sahip != null) f.StartPosition = FormStartPosition.CenterParent;
            return Gosterici(f, sahip);
        }

        public static void Uyar(string metin) =>
            Mesaj(metin, MessageBoxButtons.OK, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button1);

        public static void Bilgi(string metin) =>
            Mesaj(metin, MessageBoxButtons.OK, MessageBoxIcon.Information, MessageBoxDefaultButton.Button1);

        public static bool Onay(string metin, bool varsayilanEvet = true) =>
            Mesaj(metin, MessageBoxButtons.YesNo, MessageBoxIcon.Question,
                varsayilanEvet ? MessageBoxDefaultButton.Button1 : MessageBoxDefaultButton.Button2) == DialogResult.Yes;

        // ================= Ortak parçalar =================

        private static int S(double v) => Olcu.S(v);

        private static void Hazirla()
        {
            KatalogKaynagi.StiliYukle();
            KatalogKaynagi.SembolleriYukle();
            HizliSecim.Yukle();
        }

        /// <summary>Denetimi yerleştirir (mantıksal piksel). w/h verilmezse denetimin kendi boyu kalır.</summary>
        private static T Koy<T>(Control kap, T c, int x, int y, int w = -1, int h = -1) where T : Control
        {
            if (w >= 0 && h >= 0) c.SetBounds(S(x), S(y), S(w), S(h));
            else if (w >= 0) c.SetBounds(S(x), S(y), S(w), c.Height);
            else c.Location = new Point(S(x), S(y));
            kap.Controls.Add(c);
            return c;
        }

        private static Label Etiket(Control kap, string metin, int x, int y, int w = 0, Font yazi = null, Color? renk = null, ContentAlignment hiza = ContentAlignment.TopLeft)
        {
            var l = new Label
            {
                Text = metin,
                UseMnemonic = false,
                BackColor = Color.Transparent,
                ForeColor = renk ?? KoyuRenk.Ikincil,
                Font = yazi ?? KoyuYazi.Govde,
                AutoSize = w <= 0,
                TextAlign = hiza,
            };
            l.Location = new Point(S(x), S(y));
            if (w > 0)
            {
                l.Size = new Size(S(w), S(20));
                l.AutoEllipsis = true;
            }
            kap.Controls.Add(l);
            return l;
        }

        /// <summary>Sarılan açıklama yazısı.</summary>
        private static Label Aciklama(Control kap, string metin, int x, int y, int w, int h)
        {
            var l = new Label { Text = metin, UseMnemonic = false, BackColor = Color.Transparent, ForeColor = KoyuRenk.Soluk, Font = KoyuYazi.Kucuk, AutoSize = false };
            l.SetBounds(S(x), S(y), S(w), S(h));
            kap.Controls.Add(l);
            return l;
        }

        private static PictureBox Resim(Control kap, Image img, int x, int y, int w, int h)
        {
            var p = new PictureBox { Image = img, SizeMode = PictureBoxSizeMode.CenterImage, BackColor = Color.Transparent };
            return Koy(kap, p, x, y, w, h);
        }

        private sealed class Altlik
        {
            public KoyuDugme Tamam, Vazgec;
            public OzetSatiri Ozet;
        }

        /// <summary>Altbilgi: solda özet satırı (isteğe bağlı), sağda birincil düğme ve Vazgeç.</summary>
        private static Altlik AltKur(KoyuPencere f, string tamamYazisi, bool ozet = true, int tamamEn = 120)
        {
            var a = new Altlik();
            var alt = f.Alt;
            int bh = S(34), y = (alt.Height - bh) / 2;
            a.Vazgec = new KoyuDugme("Vazgeç") { DialogResult = DialogResult.Cancel };
            a.Vazgec.SetBounds(alt.Width - S(16) - S(104), y, S(104), bh);
            a.Tamam = new KoyuDugme(tamamYazisi, DugmeTuru.Birincil);
            a.Tamam.SetBounds(a.Vazgec.Left - S(10) - S(tamamEn), y, S(tamamEn), bh);
            alt.Controls.Add(a.Tamam);
            alt.Controls.Add(a.Vazgec);
            if (ozet)
            {
                a.Ozet = new OzetSatiri();
                a.Ozet.SetBounds(S(16), 1, Math.Max(S(20), a.Tamam.Left - S(32)), alt.Height - 1);
                alt.Controls.Add(a.Ozet);
            }
            f.AcceptButton = a.Tamam;
            f.CancelButton = a.Vazgec;
            return a;
        }

        /// <summary>Aramada büyük/küçük harf ve Türkçe I/İ farkını yok sayar.</summary>
        private static string Norm(string s) => (s ?? "").ToUpperInvariant().Replace('İ', 'I').Replace('ı', 'I');

        private static decimal D(double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) return 0;
            return (decimal)Math.Max(-1e9, Math.Min(1e9, d));
        }

        private static string Bicim(double d) => SayiCoz.Temiz(d, 3).ToString("0.###", Tr);

        // ---- simgeler ----

        private static readonly Color KanalRengi = KoyuRenk.Hex("#c98a4b", Color.Peru);
        private static readonly Color SondajRengi = KoyuRenk.Hex("#fbbf24", Color.Gold);

        private static string IlkCins(string tur)
        {
            var l = HizliSecim.TemelKatalog.ElemanCinsListesi(tur);
            return l.Count > 0 ? l[0] : "";
        }

        private static Color ElemanRengi(string tur, string cins = null)
        {
            try { return KoyuRenk.Hex(CizimStili.EkranElemanRengi(tur, cins ?? IlkCins(tur)), KoyuRenk.Yesil); }
            catch { return KoyuRenk.Yesil; }
        }

        private static Color HatRengi(string tur)
        {
            try { return KoyuRenk.Hex(CizimStili.EkranHatRengi(tur), KoyuRenk.Yesil); }
            catch { return KoyuRenk.Yesil; }
        }

        /// <summary>Tür simgesi (pencerenin solundaki listede; seçiliyse beyaz).</summary>
        private static Image TurSimgesi(string kod, bool hat, bool secili, int px = 20)
        {
            string ad = hat ? SeritSimgeleri.HatSimgeAdi(kod) : SeritSimgeleri.ElemanSimgeAdi(kod, null);
            return Boya.Simge(ad, secili ? Color.White : hat ? HatRengi(kod) : ElemanRengi(kod), px);
        }

        private static readonly Dictionary<string, Image> _semboller = new Dictionary<string, Image>(StringComparer.Ordinal);

        /// <summary>Telefonun simge takımından elemanın simgesi (tip listesinde: beton daire, kafes kare …; yeni montaj simgesi).</summary>
        private static Image SembolResmi(string tur, string cins)
        {
            if (string.IsNullOrEmpty(tur)) return null;
            string blok;
            try { blok = Semboller.BlokAdi(tur, cins, "M"); }
            catch { return null; }
            Image r;
            if (_semboller.TryGetValue(blok, out r)) return r;
            r = null;
            try
            {
                var s = Semboller.Bul(blok);
                if (s != null) r = SeritSimgeleri.SembolResmi(s, CizimStili.EkranElemanRengi(tur, cins), S(20));
            }
            catch { r = null; }
            if (r == null) r = TurSimgesi(tur, false, false);
            _semboller[blok] = r;
            return r;
        }

        /// <summary>Malzeme listesindeki açıklama satırı: "AG galvanizli demir direk · 209 kg/ad · poz 5.1".</summary>
        private static string AltYazi(Katalog k, KatalogKalemi it)
        {
            var parca = new List<string>();
            string ad = k != null ? k.CinsAdi(it.Cins) : it.Cins;
            if (!string.IsNullOrEmpty(ad)) parca.Add(ad);
            string[] b = (it.Birim ?? "").Split('/');
            if (b.Length > 1 && b[1] == "kg" && it.Katsayi > 0) parca.Add(it.Katsayi.ToString("0.##", Tr) + " kg/" + b[0]);
            else if (!string.IsNullOrEmpty(it.Birim)) parca.Add(it.Birim);
            if (!string.IsNullOrEmpty(it.PozNo)) parca.Add("poz " + it.PozNo);
            return string.Join(" · ", parca);
        }

        /// <summary>
        /// Arama kutusu + iki satırlı tip listesi: aramasızken "Son kullanılanlar" ve "Tüm tipler" bölümleri, aramada yalnız
        /// uyan tipler. Cins süzgeci isteğe bağlı.
        /// </summary>
        private sealed class TipListesi
        {
            public readonly IkiSatirListe Liste = new IkiSatirListe();
            public readonly MetinKutusu Ara;
            private readonly Katalog _k;
            private List<KatalogKalemi> _hepsi = new List<KatalogKalemi>(), _son = new List<KatalogKalemi>();
            private string _sonBaslik = "Son kullanılanlar", _tumBaslik = "Tüm tipler";
            /// <summary>Cins süzgeci (boş: hepsi).</summary>
            public string Cins = "";
            public event Action Secildi;
            public event Action Degisti;

            public TipListesi(MetinKutusu ara, Katalog k, Func<KatalogKalemi, Image> simge = null)
            {
                Ara = ara;
                _k = k;
                Liste.Baslik = o => ((KatalogKalemi)o).Tanim.Trim();
                Liste.Alt = o => AltYazi(_k, (KatalogKalemi)o);
                if (simge != null) Liste.Simge = o => simge((KatalogKalemi)o);
                ara.Kutu.TextChanged += (s, e) => Suz(Secili != null ? Secili.Anahtar : null);
                ara.Kutu.KeyDown += (s, e) =>
                {
                    if (e.KeyCode == Keys.Down && Liste.Items.Count > 0)
                    {
                        Liste.Focus();
                        if (Liste.SelectedIndex < 0) Liste.SelectedIndex = Math.Max(0, Liste.IlkOge());
                        e.Handled = true;
                        e.SuppressKeyPress = true;
                    }
                };
                Liste.DoubleClick += (s, e) => { if (Secili != null) Secildi?.Invoke(); };
                Liste.SelectedIndexChanged += (s, e) => Degisti?.Invoke();
            }

            public void Doldur(List<KatalogKalemi> hepsi, List<KatalogKalemi> son, string seciliAnahtar, string sonBaslik = null, string tumBaslik = null)
            {
                _hepsi = hepsi ?? new List<KatalogKalemi>();
                _son = son ?? new List<KatalogKalemi>();
                if (sonBaslik != null) _sonBaslik = sonBaslik;
                if (tumBaslik != null) _tumBaslik = tumBaslik;
                Suz(seciliAnahtar);
            }

            public void Yenile() => Suz(Secili != null ? Secili.Anahtar : null);

            private bool Uyar(KatalogKalemi it, string[] sozcukler)
            {
                if (!string.IsNullOrEmpty(Cins) && it.Cins != Cins) return false;
                if (sozcukler.Length == 0) return true;
                string y = Norm(it.Tanim + " " + it.Cins + " " + it.Birim + " " + it.PozNo + " " + (_k != null ? _k.CinsAdi(it.Cins) : ""));
                foreach (var s in sozcukler) if (y.IndexOf(s, StringComparison.Ordinal) < 0) return false;
                return true;
            }

            private void Suz(string seciliAnahtar)
            {
                var sozcukler = Norm(Ara.Text).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                bool arama = sozcukler.Length > 0;
                Liste.BeginUpdate();
                Liste.Items.Clear();
                int sec = -1;
                var son = _son.FindAll(x => Uyar(x, new string[0]));
                if (!arama && son.Count > 0)
                {
                    Liste.Items.Add(new ListeBasligi(_sonBaslik));
                    foreach (var it in son)
                    {
                        int i = Liste.Items.Add(it);
                        if (sec < 0 && seciliAnahtar != null && it.Anahtar == seciliAnahtar) sec = i;
                    }
                }
                int sayi = 0;
                int baslikYeri = -1;
                if (!arama && son.Count > 0) baslikYeri = Liste.Items.Add(new ListeBasligi(_tumBaslik));
                foreach (var it in _hepsi)
                {
                    if (!Uyar(it, sozcukler)) continue;
                    int i = Liste.Items.Add(it);
                    sayi++;
                    if (sec < 0 && seciliAnahtar != null && it.Anahtar == seciliAnahtar) sec = i;
                }
                if (baslikYeri >= 0) Liste.Items[baslikYeri] = new ListeBasligi(_tumBaslik + " (" + sayi + ")");
                Liste.EndUpdate();
                if (sec < 0) sec = Liste.IlkOge();
                if (sec >= 0) Liste.SelectedIndex = sec;
                else Degisti?.Invoke();
            }

            public KatalogKalemi Secili => Liste.SelectedItem as KatalogKalemi;
        }

        /// <summary>Durum seçimi: kartta seçenekler, her birinin yanında anlamı.</summary>
        private sealed class DurumSecici
        {
            public readonly Kart Kap;
            public readonly int Boy;
            private readonly List<KoyuSecim> _l = new List<KoyuSecim>();
            public event Action Degisti;

            public DurumSecici(Control kap, int x, int y, int w, string secili, string[] durumlar = null)
            {
                durumlar = durumlar ?? Turler.CizimDurumlari;
                Boy = 38 + durumlar.Length * 26 + 8;
                Kap = Koy(kap, new Kart("Durum"), x, y, w, Boy);
                int yy = 36;
                foreach (var d in durumlar)
                {
                    var r = new KoyuSecim(d, Turler.DurumAdi(d)) { AutoSize = false, AciklamaX = S(78), Tag = d };
                    Koy(Kap, r, 14, yy, w - 24, 24);
                    r.CheckedChanged += (s, e) => { if (((KoyuSecim)s).Checked) Degisti?.Invoke(); };
                    _l.Add(r);
                    yy += 26;
                }
                var bu = _l.Find(r => (string)r.Tag == secili) ?? (_l.Count > 0 ? _l[0] : null);
                if (bu != null) bu.Checked = true;
            }

            public string Secili
            {
                get
                {
                    var r = _l.Find(x => x.Checked);
                    return r != null ? (string)r.Tag : "M";
                }
            }
        }

        private static KoyuAcilir DmKutusu(string secili)
        {
            var c = new KoyuAcilir();
            c.Items.Add("Yok");
            c.Items.Add("KESİK");
            c.Items.Add("SÖKÜK");
            c.SelectedIndex = secili == "KESİK" ? 1 : secili == "SÖKÜK" ? 2 : 0;
            return c;
        }

        private static string DmKodu(ComboBox c) => c.SelectedIndex == 1 ? "KESİK" : c.SelectedIndex == 2 ? "SÖKÜK" : "";

        /// <summary>Cins süzgeci kutusu: "(hepsi)" + verilen cinsler (okunur adla).</summary>
        private sealed class CinsSecenegi
        {
            public string Cins;
            public string Ad;
            public override string ToString() => Ad;
        }

        private static void CinsleriDoldur(ComboBox c, Katalog k, List<string> cinsler, string secili)
        {
            c.BeginUpdate();
            c.Items.Clear();
            c.Items.Add(new CinsSecenegi
            {
                Cins = "",
                Ad = cinsler.Count == 1 ? "Cins: " + k.CinsAdi(cinsler[0]) + "  ·  " + cinsler[0] : "Cins: (hepsi)",
            });
            int sec = 0;
            if (cinsler.Count > 1)
                foreach (var cins in cinsler)
                {
                    int i = c.Items.Add(new CinsSecenegi { Cins = cins, Ad = "Cins: " + k.CinsAdi(cins) + "  ·  " + cins });
                    if (cins == secili) sec = i;
                }
            c.EndUpdate();
            c.SelectedIndex = sec;
        }

        private static string SeciliCins(ComboBox c) => (c.SelectedItem as CinsSecenegi)?.Cins ?? "";

        /// <summary>Hakediş kilit denetimi: kilitliyse bilgi çubuğu uyarıya döner ve Çiz düğmesi kapanır.</summary>
        private static Action KilitBagla(OrtamVerisi o, SayiKutusu hak, BilgiCubugu bilgi, KoyuDugme tamam, string normalMetin)
        {
            return () =>
            {
                int h = (int)hak.Value;
                bool kilitli = o.Kilitli(h);
                bilgi.Tur = kilitli ? BilgiTuru.Uyari : BilgiTuru.Bilgi;
                bilgi.Text = kilitli ? h + ". hakediş onaylı (kilitli) — açık bir hakediş seçin." : normalMetin;
                tamam.Enabled = !kilitli;
            };
        }

        // ================= Eleman =================

        public static ElemanSecimi Eleman(OrtamVerisi o, ElemanSecimi onceki)
        {
            Hazirla();
            using (var f = new KoyuPencere("Eleman koy", 880, 560, Boya.Simge("direk", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(f, "Çiz");

                // Sol: tür
                var tur = Koy(f, new SimgeListesi(), 16, 56, 196, 428);
                foreach (var t in Turler.Elemanlar) tur.Items.Add(t);
                tur.Simge = (x, secili) => TurSimgesi(((Tur)x).Kod, false, secili);

                // Orta: arama, cins, tip listesi
                var ara = Koy(f, new MetinKutusu("", "Ara (tip, cins, poz…)", Boya.Simge("ara", KoyuRenk.Ikincil)), 228, 56, 330, 30);
                var cins = Koy(f, new KoyuAcilir(), 228, 94, 330);
                Func<Tur> seciliTur = () => tur.SelectedItem as Tur;
                var liste = new TipListesi(ara, o.Katalog, it => SembolResmi(seciliTur() != null ? seciliTur().Kod : "", it.Cins));
                Koy(f, new Cerceve(liste.Liste), 228, 132, 330, 352);

                // Sağ: durum, demontaj, hakediş, GIS
                var durum = new DurumSecici(f, 574, 56, 290, onceki != null ? onceki.Durum : o.Ayar.SonDeger("eleman.durum", "M"));
                int y = 56 + durum.Boy + 12;
                Etiket(f, "Demontaj durumu (DM, DM+M)", 574, y);
                var dm = Koy(f, DmKutusu(onceki != null ? onceki.DmDurum : ""), 574, y + 20, 290);
                y += 60;
                Etiket(f, "Hakediş", 574, y);
                var hak = Koy(f, new SayiKutusu(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis), 574, y + 20, 120, 30);
                Etiket(f, "İlk GIS numarası", 708, y);
                var gis = Koy(f, new MetinKutusu(), 708, y + 20, 156, 30);
                y += 62;
                const string normal = "Her tıklamada bir eleman konur; GIS numarası kendiliğinden artar. Bitirmek için Enter.";
                var bilgi = Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, normal), 574, y, 290, Math.Max(52, 484 - y));

                var suzgec = onceki != null ? onceki.Cinsler : new List<string>();
                bool yukleniyor = false;
                Action gisOner = () =>
                {
                    var t = seciliTur();
                    string oneri = t == null ? "" : Numara.SonrakiGis(o.Proje.Elemanlar, t.Kod, o.GisOnEki, liste.Secili != null ? liste.Secili.Cins : "");
                    gis.Ipucu = string.IsNullOrEmpty(oneri) ? "numara verilmez" : "kendiliğinden: " + oneri;
                };
                Action ozetYaz = () =>
                {
                    var t = seciliTur();
                    var tip = liste.Secili;
                    string d = durum.Secili, dmk = dm.Enabled ? DmKodu(dm) : "";
                    alt.Ozet.Text = "Çizilecek: " + (t != null ? t.Ad : "?") + " · " + (tip != null ? tip.Tanim.Trim() : "tip seçin") + " · " + d +
                                    (dmk.Length > 0 ? " " + dmk : "") + " · " + (int)hak.Value + ". hakediş";
                    alt.Ozet.Simge = t != null ? TurSimgesi(t.Kod, false, false, 18) : null;
                };
                var kilitDenetle = KilitBagla(o, hak, bilgi, alt.Tamam, normal);
                Action tipleriDoldur = () =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    string secCins = SeciliCins(cins);
                    var gecerli = onceki != null && onceki.Tur == t.Kod ? suzgec : null;
                    var tipler = secCins.Length > 0 ? o.Katalog.AnaTipler(t.Kod, new[] { secCins }) : o.Katalog.AnaTipler(t.Kod, gecerli != null && gecerli.Count > 0 ? gecerli : null);
                    if (tipler.Count == 0) tipler = o.Katalog.AnaTipler(t.Kod);
                    if (tipler.Count == 0) tipler = o.Katalog.Kalemler.FindAll(x => x.Rol == "ana");
                    string son = onceki != null && onceki.Tur == t.Kod && onceki.Tip != null ? onceki.Tip.Anahtar : o.Ayar.SonDeger("eleman.tip." + t.Kod, null);
                    liste.Doldur(tipler, HizliSecim.SonTipler("eleman/" + t.Kod, o.Katalog, tipler), son);
                    gisOner();
                    ozetYaz();
                };
                tur.SelectedIndexChanged += (s, e) =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    yukleniyor = true;
                    bool suzgecli = suzgec.Count > 0 && onceki != null && onceki.Tur == t.Kod;
                    var cinsler = suzgecli ? new List<string>(suzgec) : o.Katalog.ElemanCinsListesi(t.Kod);
                    string sonCins = onceki != null && onceki.Tur == t.Kod && onceki.Tip != null ? onceki.Tip.Cins : "";
                    CinsleriDoldur(cins, o.Katalog, cinsler, suzgecli ? "" : o.Ayar.SonDeger("eleman.cins." + t.Kod, sonCins));
                    yukleniyor = false;
                    tipleriDoldur();
                };
                cins.SelectedIndexChanged += (s, e) => { if (!yukleniyor) tipleriDoldur(); };
                liste.Degisti += () => { gisOner(); ozetYaz(); };
                liste.Secildi += () => { if (alt.Tamam.Enabled) alt.Tamam.PerformClick(); };
                durum.Degisti += () => { dm.Enabled = Turler.DemontajMi(durum.Secili); ozetYaz(); };
                dm.SelectedIndexChanged += (s, e) => ozetYaz();
                hak.ValueChanged += (s, e) => { kilitDenetle(); ozetYaz(); };
                dm.Enabled = Turler.DemontajMi(durum.Secili);

                string ilkTur = onceki != null ? onceki.Tur : o.Ayar.SonDeger("eleman.tur", "AG_DIREK");
                tur.SelectedIndex = Math.Max(0, Array.FindIndex(Turler.Elemanlar, t => t.Kod == ilkTur));
                if (onceki != null && !string.IsNullOrEmpty(onceki.Gis)) gis.Text = onceki.Gis;
                kilitDenetle();
                ozetYaz();
                f.Shown += (s, e) => liste.Liste.Focus();

                alt.Tamam.Click += (s, e) =>
                {
                    if (liste.Secili == null) { Uyar("Listeden bir tip seçin."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(HakedisOnayi.KilitMesaji((int)hak.Value)); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return null;

                var sonuc = new ElemanSecimi
                {
                    Tur = seciliTur().Kod,
                    Tip = liste.Secili,
                    Durum = durum.Secili,
                    DmDurum = dm.Enabled ? DmKodu(dm) : "",
                    Hakedis = (int)hak.Value,
                    Gis = gis.Text.Trim(),
                    Cinsler = onceki != null && onceki.Tur == seciliTur().Kod ? suzgec : new List<string>(),
                };
                HizliSecim.SonaEkle("eleman/" + sonuc.Tur, sonuc.Tip);
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
            Hazirla();
            using (var f = new KoyuPencere("Hat çiz", 880, 560, Boya.Simge("hat_havai", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(f, "Çiz");

                var tur = Koy(f, new SimgeListesi(), 16, 56, 196, 428);
                foreach (var t in Turler.Hatlar) tur.Items.Add(t);
                tur.Simge = (x, secili) => TurSimgesi(((Tur)x).Kod, true, secili);
                Func<Tur> seciliTur = () => tur.SelectedItem as Tur;

                var ara = Koy(f, new MetinKutusu("", "Ara (kesit, iletken, kablo…)", Boya.Simge("ara", KoyuRenk.Ikincil)), 228, 56, 330, 30);
                var cins = Koy(f, new KoyuAcilir(), 228, 94, 330);
                var liste = new TipListesi(ara, o.Katalog, it => seciliTur() != null ? TurSimgesi(seciliTur().Kod, true, false, 22) : null);
                Koy(f, new Cerceve(liste.Liste), 228, 132, 330, 352);

                var durum = new DurumSecici(f, 574, 56, 290, onceki != null ? onceki.Durum : o.Ayar.SonDeger("hat.durum", "M"));
                int y = 56 + durum.Boy + 12;
                Etiket(f, "Hakediş", 574, y);
                var hak = Koy(f, new SayiKutusu(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis), 574, y + 20, 120, 30);
                y += 62;
                const string normal = "Her direkte / SDK'da hat biter, yeni parça başlar; her parçanın metrajı ayrı yazılır. " +
                                      "Metraj çizim uzunluğundan hesaplanır (ayarlardaki yuvarlama ve ek pay).";
                var bilgi = Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, normal), 574, y, 290, Math.Max(52, 484 - y));

                var suzgec = onceki != null ? onceki.Cinsler : new List<string>();
                bool yukleniyor = false;
                Action ozetYaz = () =>
                {
                    var t = seciliTur();
                    var k = liste.Secili;
                    alt.Ozet.Text = "Çizilecek: " + (t != null ? t.Ad : "?") + " · " + (k != null ? k.Tanim.Trim() : "kesit seçin") + " · " + durum.Secili + " · " + (int)hak.Value + ". hakediş";
                    alt.Ozet.Simge = t != null ? TurSimgesi(t.Kod, true, false, 18) : null;
                };
                var kilitDenetle = KilitBagla(o, hak, bilgi, alt.Tamam, normal);
                Action kesitleriDoldur = () =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    string secCins = SeciliCins(cins);
                    var gecerli = onceki != null && onceki.Tur == t.Kod ? suzgec : null;
                    var kesitler = secCins.Length > 0 ? o.Katalog.HatKesitleri(t.Kod, new[] { secCins }) : o.Katalog.HatKesitleri(t.Kod, gecerli != null && gecerli.Count > 0 ? gecerli : null);
                    if (kesitler.Count == 0) kesitler = o.Katalog.HatKesitleri(t.Kod);
                    string son = onceki != null && onceki.Tur == t.Kod && onceki.Kesit != null ? onceki.Kesit.Anahtar : o.Ayar.SonDeger("hat.kesit." + t.Kod, null);
                    liste.Doldur(kesitler, HizliSecim.SonTipler("hat/" + t.Kod, o.Katalog, kesitler), son, null, "Tüm kesitler");
                    ozetYaz();
                };
                tur.SelectedIndexChanged += (s, e) =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    yukleniyor = true;
                    bool suzgecli = suzgec.Count > 0 && onceki != null && onceki.Tur == t.Kod;
                    var cinsler = suzgecli ? new List<string>(suzgec) : o.Katalog.HatCinsListesi(t.Kod);
                    string sonCins = onceki != null && onceki.Tur == t.Kod && onceki.Kesit != null ? onceki.Kesit.Cins : "";
                    CinsleriDoldur(cins, o.Katalog, cinsler, suzgecli ? "" : o.Ayar.SonDeger("hat.cins." + t.Kod, sonCins));
                    yukleniyor = false;
                    kesitleriDoldur();
                };
                cins.SelectedIndexChanged += (s, e) => { if (!yukleniyor) kesitleriDoldur(); };
                liste.Degisti += () => ozetYaz();
                liste.Secildi += () => { if (alt.Tamam.Enabled) alt.Tamam.PerformClick(); };
                durum.Degisti += () => ozetYaz();
                hak.ValueChanged += (s, e) => { kilitDenetle(); ozetYaz(); };
                string ilkTur = onceki != null ? onceki.Tur : o.Ayar.SonDeger("hat.tur", "AG_HAVAI");
                tur.SelectedIndex = Math.Max(0, Array.FindIndex(Turler.Hatlar, t => t.Kod == ilkTur));
                kilitDenetle();
                ozetYaz();
                f.Shown += (s, e) => liste.Liste.Focus();

                alt.Tamam.Click += (s, e) =>
                {
                    if (liste.Secili == null) { Uyar("Listeden bir kesit seçin."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(HakedisOnayi.KilitMesaji((int)hak.Value)); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return null;
                var sonuc = new HatSecimi
                {
                    Tur = seciliTur().Kod, Kesit = liste.Secili, Durum = durum.Secili, Hakedis = (int)hak.Value,
                    Cinsler = onceki != null && onceki.Tur == seciliTur().Kod ? suzgec : new List<string>(),
                };
                HizliSecim.SonaEkle("hat/" + sonuc.Tur, sonuc.Kesit);
                o.Ayar.Son["hat.tur"] = sonuc.Tur;
                o.Ayar.Son["hat.kesit." + sonuc.Tur] = sonuc.Kesit.Anahtar;
                o.Ayar.Son["hat.cins." + sonuc.Tur] = SeciliCins(cins);
                o.Ayar.Son["hat.durum"] = sonuc.Durum;
                return sonuc;
            }
        }

        // ================= Kanal =================

        /// <summary>Kanal zeminleri: katalogdakiler (PROMAGIS sırası), sabit liste ve çizimde geçenler.</summary>
        private static List<string> Zeminler(OrtamVerisi o, string secili)
        {
            var l = new List<string>();
            var gorulen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var it in o.Katalog.KanalZeminleri()) if (gorulen.Add(it.Tanim)) l.Add(it.Tanim);
            foreach (var z in Turler.Zeminler) if (gorulen.Add(z)) l.Add(z);
            foreach (var k in o.Proje.Kanallar) if (!string.IsNullOrEmpty(k.Zemin) && gorulen.Add(k.Zemin)) l.Add(k.Zemin);
            if (!string.IsNullOrEmpty(secili) && gorulen.Add(secili)) l.Insert(0, secili);
            return l;
        }

        private static KoyuAcilir ZeminKutusu(OrtamVerisi o, string secili)
        {
            var c = new KoyuAcilir(true);
            foreach (var z in Zeminler(o, null)) c.Items.Add(z);
            c.Text = string.IsNullOrEmpty(secili) ? "TOPRAK" : secili;
            return c;
        }

        public static KanalSecimi Kanal(OrtamVerisi o, KanalSecimi onceki)
        {
            Hazirla();
            var a = o.Ayar;
            using (var f = new KoyuPencere("Kablo kanalı çiz", 820, 560, Boya.Simge("kanal", KanalRengi, 20)))
            {
                var alt = AltKur(f, "Çiz");

                // Sol: kablolar ve zemin
                var kablo = Koy(f, new Kart("Kanaldaki kablolar"), 16, 56, 240, 156);
                var og = Koy(kablo, new KoyuOnay("OG"), 16, 36);
                var ag = Koy(kablo, new KoyuOnay("AG"), 16, 64);
                var ayd = Koy(kablo, new KoyuOnay("Aydınlatma"), 16, 92);
                var rek = Koy(kablo, new KoyuOnay("Rekortman"), 16, 120);
                Etiket(f, "Zemin", 16, 224);
                var zemin = new IkiSatirListe();
                Koy(f, new Cerceve(zemin), 16, 244, 240, 240);
                string zeminSecili = onceki != null ? onceki.Zemin : a.KanalZemin;
                foreach (var z in Zeminler(o, zeminSecili)) zemin.Items.Add(z);
                int zi = zemin.Items.IndexOf(string.IsNullOrEmpty(zeminSecili) ? "TOPRAK" : zeminSecili);
                if (zemin.Items.Count > 0) zemin.SelectedIndex = Math.Max(0, zi);

                // Sağ: ölçüler, hızlı seçim, durum, hakediş
                Etiket(f, "Alt genişlik (cm)", 272, 56);
                var altG = Koy(f, new SayiKutusu(0, 1000, D(onceki != null ? onceki.Alt : a.KanalAlt), 0, 5), 272, 76, 136, 30);
                Etiket(f, "Üst genişlik (cm)", 420, 56);
                var ust = Koy(f, new SayiKutusu(0, 1000, D(onceki != null ? onceki.Ust : a.KanalUst), 0, 5), 420, 76, 136, 30);
                Etiket(f, "Derinlik (cm)", 568, 56);
                var der = Koy(f, new SayiKutusu(0, 1000, D(onceki != null ? onceki.Derinlik : a.KanalDerinlik), 0, 5), 568, 76, 136, 30);
                Etiket(f, "Hakediş", 716, 56);
                var hak = Koy(f, new SayiKutusu(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis), 716, 76, 88, 30);
                Etiket(f, "Hızlı seçim (alt × üst × derinlik)", 272, 118);
                int[][] hazir = { new[] { 40, 40, 80 }, new[] { 40, 40, 100 }, new[] { 60, 60, 120 }, new[] { 80, 80, 150 } };
                for (int i = 0; i < hazir.Length; i++)
                {
                    var h = hazir[i];
                    var d = Koy(f, new KoyuDugme(h[0] + " × " + h[1] + " × " + h[2]) { Font = KoyuYazi.Govde }, 272 + i * 134, 138, 124, 32);
                    d.Click += (s, e) => { altG.Value = h[0]; ust.Value = h[1]; der.Value = h[2]; };
                }
                var durum = new DurumSecici(f, 272, 184, 532, onceki != null ? onceki.Durum : a.SonDeger("kanal.durum", "M+M"));
                int y = 184 + durum.Boy + 12;
                const string normal = "Kanalın köşelerini sırayla gösterin. Kanal tıkladığınız her box / pano / direkte biter ve yeniden başlar; " +
                                      "her parçanın baş/bit numarası, metrajı ve hacmi kendine aittir.";
                var bilgi = Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, normal), 272, y, 532, Math.Max(52, 484 - y));

                string kablolar = onceki != null
                    ? (onceki.Og ? "OG," : "") + (onceki.Ag ? "AG," : "") + (onceki.Ayd ? "AYD," : "") + (onceki.Rek ? "REK," : "")
                    : a.SonDeger("kanal.kablolar", "AG,");
                og.Checked = kablolar.Contains("OG,");
                ag.Checked = kablolar.Contains("AG,");
                ayd.Checked = kablolar.Contains("AYD,");
                rek.Checked = kablolar.Contains("REK,");

                Func<string> zeminDegeri = () => zemin.SelectedItem as string ?? "";
                Action ozetYaz = () =>
                {
                    var kl = new List<string>();
                    if (og.Checked) kl.Add("OG");
                    if (ag.Checked) kl.Add("AG");
                    if (ayd.Checked) kl.Add("Aydınlatma");
                    if (rek.Checked) kl.Add("Rekortman");
                    alt.Ozet.Text = "Çizilecek: Kablo kanalı · " + (kl.Count > 0 ? string.Join(" + ", kl) : "kablo seçin") + " · " + zeminDegeri() + " · " +
                                    altG.Value.ToString("0.#", Tr) + "/" + ust.Value.ToString("0.#", Tr) + " × " + der.Value.ToString("0.#", Tr) + " cm · " +
                                    durum.Secili + " · " + (int)hak.Value + ". hakediş";
                    alt.Ozet.Simge = Boya.Simge("kanal", KanalRengi, 18);
                };
                var kilitDenetle = KilitBagla(o, hak, bilgi, alt.Tamam, normal);
                foreach (var c in new[] { og, ag, ayd, rek }) c.CheckedChanged += (s, e) => ozetYaz();
                zemin.SelectedIndexChanged += (s, e) => ozetYaz();
                altG.ValueChanged += (s, e) => ozetYaz();
                ust.ValueChanged += (s, e) => ozetYaz();
                der.ValueChanged += (s, e) => ozetYaz();
                durum.Degisti += () => ozetYaz();
                hak.ValueChanged += (s, e) => { kilitDenetle(); ozetYaz(); };
                kilitDenetle();
                ozetYaz();

                alt.Tamam.Click += (s, e) =>
                {
                    if (!(og.Checked || ag.Checked || ayd.Checked || rek.Checked)) { Uyar("Kanaldaki kabloları seçin."); return; }
                    if (zeminDegeri().Trim().Length == 0) { Uyar("Zemin türünü seçin."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(HakedisOnayi.KilitMesaji((int)hak.Value)); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return null;
                var sonuc = new KanalSecimi
                {
                    Og = og.Checked, Ag = ag.Checked, Ayd = ayd.Checked, Rek = rek.Checked,
                    Zemin = zeminDegeri().Trim(), Alt = (double)altG.Value, Ust = (double)ust.Value, Derinlik = (double)der.Value,
                    Durum = durum.Secili, Hakedis = (int)hak.Value,
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
            Hazirla();
            using (var f = new KoyuPencere("Yatay sondaj çiz", 740, 540, Boya.Simge("sondaj", SondajRengi, 20)))
            {
                var alt = AltKur(f, "Çiz");
                Etiket(f, "Tip", 16, 56);
                var ara = Koy(f, new MetinKutusu("", "Ara (çap, tip…)", Boya.Simge("ara", KoyuRenk.Ikincil)), 16, 76, 360, 30);
                var liste = new TipListesi(ara, o.Katalog, it => Boya.Simge("sondaj", SondajRengi, 22));
                Koy(f, new Cerceve(liste.Liste), 16, 114, 360, 370);

                var durum = new DurumSecici(f, 392, 56, 332, onceki != null ? onceki.Durum : o.Ayar.SonDeger("sondaj.durum", "M"));
                int y = 56 + durum.Boy + 12;
                Etiket(f, "Hakediş", 392, y);
                var hak = Koy(f, new SayiKutusu(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis), 392, y + 20, 120, 30);
                y += 62;
                const string normal = "Sondajın başlangıç ve bitiş noktalarını (gerekirse ara köşeleri) gösterin; Enter ile bitirin. " +
                                      "Tıklanan her elemanda sondaj biter ve yeni parça başlar.";
                var bilgi = Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, normal), 392, y, 332, Math.Max(52, 484 - y));

                var tipler = o.Katalog.SondajTipleri();
                liste.Doldur(tipler, HizliSecim.SonTipler("sondaj", o.Katalog, tipler),
                    onceki != null && onceki.Tip != null ? onceki.Tip.Anahtar : o.Ayar.SonDeger("sondaj.tip", null));
                Action ozetYaz = () =>
                {
                    var k = liste.Secili;
                    alt.Ozet.Text = "Çizilecek: Yatay sondaj · " + (k != null ? k.Tanim.Trim() : "tip seçin") + " · " + durum.Secili + " · " + (int)hak.Value + ". hakediş";
                    alt.Ozet.Simge = Boya.Simge("sondaj", SondajRengi, 18);
                };
                var kilitDenetle = KilitBagla(o, hak, bilgi, alt.Tamam, normal);
                liste.Degisti += () => ozetYaz();
                liste.Secildi += () => { if (alt.Tamam.Enabled) alt.Tamam.PerformClick(); };
                durum.Degisti += () => ozetYaz();
                hak.ValueChanged += (s, e) => { kilitDenetle(); ozetYaz(); };
                kilitDenetle();
                ozetYaz();
                f.Shown += (s, e) => liste.Liste.Focus();

                alt.Tamam.Click += (s, e) =>
                {
                    if (liste.Secili == null) { Uyar("Listeden bir sondaj tipi seçin."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(HakedisOnayi.KilitMesaji((int)hak.Value)); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return null;
                var sonuc = new SondajSecimi { Tip = liste.Secili, Durum = durum.Secili, Hakedis = (int)hak.Value };
                HizliSecim.SonaEkle("sondaj", sonuc.Tip);
                o.Ayar.Son["sondaj.tip"] = sonuc.Tip.Anahtar;
                o.Ayar.Son["sondaj.durum"] = sonuc.Durum;
                return sonuc;
            }
        }

        // ================= Bölge =================

        public static bool Bolge(ref string ad, ref string kod, ref string grup)
        {
            Hazirla();
            using (var f = new KoyuPencere("Bölge (alt proje)", 540, 330, Boya.Simge("bolge", KoyuRenk.Sari, 20)))
            {
                var alt = AltKur(f, "Kaydet", false);
                Etiket(f, "Bölge adı", 16, 66);
                var tAd = Koy(f, new MetinKutusu(ad ?? "", "ör. 1. Bölge"), 130, 60, 394, 30);
                Etiket(f, "Proje kodu", 16, 106);
                var tKod = Koy(f, new MetinKutusu(kod ?? "", "raporun PROJE sütunu"), 130, 100, 394, 30);
                Etiket(f, "Grup kodu", 16, 146);
                var tGrup = Koy(f, new MetinKutusu(grup ?? "", "boş bırakılabilir"), 130, 140, 394, 30);
                Aciklama(f, "Raporun PROJE sütununa proje kodu yazılır; grup kodu PROMAGIS'teki bölge grup kodudur. " +
                            "Sınırın içindeki her nesne bu bölgeye sayılır.", 130, 182, 394, 70);
                alt.Tamam.Click += (s, e) =>
                {
                    if (tAd.Text.Trim().Length == 0 && tKod.Text.Trim().Length == 0) { Uyar("Bölge adını ya da proje kodunu yazın."); return; }
                    f.DialogResult = DialogResult.OK;
                };
                f.Shown += (s, e) => tAd.Kutu.Focus();
                if (Goster(f) != DialogResult.OK) return false;
                ad = tAd.Text.Trim();
                kod = tKod.Text.Trim();
                grup = tGrup.Text.Trim();
                return true;
            }
        }

        // ================= Eksik malzeme sorgusu (DETAY) =================

        private const string Hepsi = "(hepsi)";

        private static KoyuAcilir YaziliKutu(IEnumerable<string> l, string secili)
        {
            var c = new KoyuAcilir(true) { AutoCompleteMode = AutoCompleteMode.SuggestAppend, AutoCompleteSource = AutoCompleteSource.ListItems, MaxDropDownItems = 18 };
            Doldur(c, l, secili);
            return c;
        }

        private static void Doldur(ComboBox c, IEnumerable<string> l, string secili)
        {
            c.BeginUpdate();
            c.Items.Clear();
            c.Items.Add(Hepsi);
            foreach (var s in l) c.Items.Add(s);
            c.EndUpdate();
            c.Text = string.IsNullOrWhiteSpace(secili) ? Hepsi : secili;
        }

        private static string Deger(ComboBox c)
        {
            string s = (c.Text ?? "").Trim();
            return s == Hepsi ? "" : s;
        }

        /// <summary>Tekrarsız liste (Türkçe alfabe sırasıyla).</summary>
        private static List<string> Sirali(IEnumerable<string> l)
        {
            var g = new HashSet<string>(StringComparer.Ordinal);
            var r = new List<string>();
            foreach (var s in l)
            {
                string t = (s ?? "").Trim();
                if (t.Length > 0 && g.Add(t)) r.Add(t);
            }
            var tr = CultureInfo.GetCultureInfo("tr-TR").CompareInfo;
            r.Sort((a, b) => tr.Compare(a, b, CompareOptions.IgnoreCase));
            return r;
        }

        private static string BirimAdi(string birim)
        {
            string[] b = (birim ?? "").Split('/');
            return b.Length > 0 ? b[0] : "";
        }

        /// <summary>
        /// Eksik malzeme sorgusu (PROMAGIS raporundaki DETAY): hangi elemanlarda hangi ara malzeme aranacak; süzgeç değiştikçe
        /// sonuç listesi yenilenir. Çizimde seç / Excel'e yaz ile kapanır. Son seçimler çizimin ayarlarında saklanır.
        /// </summary>
        public static DetayIslemi Detay(OrtamVerisi o, DetayFiltresi f, out List<DetaySatiri> sonuc)
        {
            sonuc = new List<DetaySatiri>();
            Hazirla();
            var p = o.Proje;
            var k = o.Katalog;
            var anaCinsler = new List<string>();
            var araCinsler = new List<string>();
            var durumlar = new List<string>(Turler.CizimDurumlari);
            foreach (var e in p.Elemanlar)
                foreach (var kl in e.Kalemler)
                {
                    (kl.Ana ? anaCinsler : araCinsler).Add(kl.Cins);
                    durumlar.Add(kl.Durum);
                }
            foreach (var c in k.Cinsler) if (c.Rol == "malzeme") araCinsler.Add(c.Cins);

            Func<string, bool, List<string>> tipler = (cins, ana) =>
            {
                var l = new List<string>();
                foreach (var e in p.Elemanlar)
                    foreach (var kl in e.Kalemler)
                        if (kl.Ana == ana && DetaySorgu.Uyar(cins, kl.Cins)) l.Add(kl.Tanim);
                if (!ana && !string.IsNullOrWhiteSpace(cins))
                    foreach (var it in k.Kalemler) if (DetaySorgu.Uyar(cins, it.Cins)) l.Add(it.Tanim);
                return Sirali(l);
            };

            using (var w = new KoyuPencere("Eksik malzeme bul", 900, 680, Boya.Simge("eksik", KoyuRenk.Yesil, 20)))
            {
                // Altbilgi: solda Çizimde seç / Excel'e yaz, sağda Vazgeç
                var vazgec = new KoyuDugme("Vazgeç") { DialogResult = DialogResult.Cancel };
                int bh = S(34), by = (w.Alt.Height - bh) / 2;
                vazgec.SetBounds(w.Alt.Width - S(16) - S(104), by, S(104), bh);
                var sec = new KoyuDugme("Çizimde seç", DugmeTuru.Birincil, Boya.Simge("sec", Color.White, 16));
                sec.SetBounds(S(16), by, S(150), bh);
                var excel = new KoyuDugme("Excel'e yaz", DugmeTuru.Ikincil, Boya.Simge("excel", KoyuRenk.Yesil, 16));
                excel.SetBounds(sec.Right + S(10), by, S(140), bh);
                w.Alt.Controls.Add(sec);
                w.Alt.Controls.Add(excel);
                w.Alt.Controls.Add(vazgec);
                w.AcceptButton = sec;
                w.CancelButton = vazgec;

                // Süzgeçler (kutuların sırası denemede kullanılır: ana cins, ana tip, durum, bölge, cins, tip, durum)
                var k1 = Koy(w, new Kart("Hangi elemanlar"), 16, 56, 426, 186);
                Etiket(k1, "Ana cins", 14, 42);
                var anaCins = Koy(k1, YaziliKutu(Sirali(anaCinsler), f.AnaCins), 104, 38, 306);
                Etiket(k1, "Ana tip", 14, 78);
                var anaTip = Koy(k1, YaziliKutu(tipler(f.AnaCins, true), f.AnaTip), 104, 74, 306);
                Etiket(k1, "Durum", 14, 114);
                var anaDurum = Koy(k1, YaziliKutu(Sirali(durumlar), f.AnaDurum), 104, 110, 306);
                Etiket(k1, "Bölge", 14, 150);
                var bolge = Koy(k1, new KoyuAcilir(), 104, 146, 306);
                bolge.Items.Add(Hepsi);
                var bolgeIdleri = new List<string> { "" };
                foreach (var b in p.Bolgeler)
                {
                    bolge.Items.Add(string.IsNullOrEmpty(b.Kod) ? b.Ad : b.Ad + "  ·  " + b.Kod);
                    bolgeIdleri.Add(b.Id);
                }
                int bi = bolgeIdleri.FindIndex(x => x == (f.Bolge ?? ""));
                bolge.SelectedIndex = bi >= 0 ? bi : 0;

                var k2 = Koy(w, new Kart("Aranan ara malzeme"), 458, 56, 426, 186);
                Etiket(k2, "Cins", 14, 42);
                var cins = Koy(k2, YaziliKutu(Sirali(araCinsler), f.Cins), 104, 38, 306);
                Etiket(k2, "Tip", 14, 78);
                var tip = Koy(k2, YaziliKutu(tipler(f.Cins, false), f.Tip), 104, 74, 306);
                Etiket(k2, "Durum", 14, 114);
                var durum = Koy(k2, YaziliKutu(Sirali(durumlar), f.Durum), 104, 110, 306);
                Etiket(k2, "Hakediş", 14, 150);
                var hak = Koy(k2, new SayiKutusu(0, 999, f.Hakedis), 104, 144, 100, 30);
                Etiket(k2, "0 = bütün hakedişler", 214, 150, 190, KoyuYazi.Kucuk, KoyuRenk.Soluk);

                Etiket(w, "Göster", 16, 254);
                var kapsam = Koy(w, new Panel { BackColor = Color.Transparent }, 16, 274, 868, 28);
                var rOlmayan = Koy(kapsam, new KoyuSecim("Bu malzemesi OLMAYAN elemanlar (eksikler)"), 0, 2);
                var rOlan = Koy(kapsam, new KoyuSecim("Bu malzemesi OLAN elemanlar"), 330, 2);
                var rHepsi = Koy(kapsam, new KoyuSecim("Hepsi"), 590, 2);
                (f.Kapsam == DetayKapsami.Olanlar ? rOlan : f.Kapsam == DetayKapsami.Hepsi ? rHepsi : rOlmayan).Checked = true;

                // Sonuç
                var sonucYazisi = Etiket(w, "", 16, 314, 500, KoyuYazi.Kalin, KoyuRenk.Yazi);
                Etiket(w, "Süzgeç değişince liste yenilenir.", 584, 316, 300, KoyuYazi.Kucuk, KoyuRenk.Soluk, ContentAlignment.TopRight);
                var g = new DataGridView
                {
                    VirtualMode = true,
                    ReadOnly = true,
                    AllowUserToAddRows = false,
                    AllowUserToDeleteRows = false,
                    SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                    MultiSelect = false,
                    AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                };
                KoyuTablo.Uygula(g);
                string[] basliklar = { "GIS no", "Cins", "Tip", "Durum", "Aranan malzeme", "Bölge" };
                float[] agirlik = { 60, 110, 120, 45, 170, 110 };
                for (int i = 0; i < basliklar.Length; i++)
                    g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = basliklar[i], FillWeight = agirlik[i], SortMode = DataGridViewColumnSortMode.NotSortable });
                Koy(w, new Cerceve(g), 16, 338, 868, 266);

                var dt = new DurumTespit(p, Katsayilar.Varsayilan);
                var gorunen = new List<DetaySatiri>();
                g.CellValueNeeded += (s, e) =>
                {
                    if (e.RowIndex < 0 || e.RowIndex >= gorunen.Count) return;
                    var r = gorunen[e.RowIndex];
                    var an = r.Ana ?? new Kalem();
                    switch (e.ColumnIndex)
                    {
                        case 0: e.Value = r.Eleman.GisId; break;
                        case 1: e.Value = an.Cins; break;
                        case 2: e.Value = an.Tanim; break;
                        case 3: e.Value = an.Durum; break;
                        case 4: e.Value = r.Malzeme != null ? r.Malzeme.Tanim.Trim() + "  ·  " + Bicim(r.Malzeme.Miktar) + " " + BirimAdi(r.Malzeme.Birim) : "yok"; break;
                        case 5: e.Value = r.Proje; break;
                    }
                };
                g.CellFormatting += (s, e) =>
                {
                    if (e.ColumnIndex == 4 && e.RowIndex >= 0 && e.RowIndex < gorunen.Count && gorunen[e.RowIndex].Malzeme == null)
                        e.CellStyle.ForeColor = KoyuRenk.HataYazi;
                };

                Func<DetayFiltresi> suzgec = () => new DetayFiltresi
                {
                    AnaCins = Deger(anaCins), AnaTip = Deger(anaTip), AnaDurum = Deger(anaDurum),
                    Bolge = bolge.SelectedIndex > 0 ? bolgeIdleri[bolge.SelectedIndex] : "",
                    Cins = Deger(cins), Tip = Deger(tip), Durum = Deger(durum), Hakedis = (int)hak.Value,
                    Kapsam = rOlan.Checked ? DetayKapsami.Olanlar : rHepsi.Checked ? DetayKapsami.Hepsi : DetayKapsami.Olmayanlar,
                };
                Action yenile = () =>
                {
                    var fs = suzgec();
                    List<DetaySatiri> l;
                    try { l = DetaySorgu.Sorgula(p, fs, dt); }
                    catch { l = new List<DetaySatiri>(); }
                    gorunen = l;
                    g.RowCount = 0;
                    g.RowCount = l.Count;
                    g.Invalidate();
                    var olan = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    int eksik = 0;
                    foreach (var r in l) { if (r.Olan) olan.Add(r.Eleman.Id); else eksik++; }
                    string m;
                    if (fs.AranaBosMu) m = "Aranan malzemeyi seçin (cins ya da tip).  ";
                    else m = "";
                    if (fs.Kapsam == DetayKapsami.Olmayanlar) m += eksik.ToString("N0", Tr) + " eleman eksik";
                    else if (fs.Kapsam == DetayKapsami.Olanlar) m += olan.Count.ToString("N0", Tr) + " eleman · " + (l.Count - eksik).ToString("N0", Tr) + " malzeme satırı";
                    else m += eksik.ToString("N0", Tr) + " eksik · " + olan.Count.ToString("N0", Tr) + " olan eleman";
                    sonucYazisi.Text = m;
                };
                var zamanlayici = new Timer { Interval = 300 };
                zamanlayici.Tick += (s, e) => { zamanlayici.Stop(); yenile(); };
                EventHandler degisti = (s, e) => { zamanlayici.Stop(); zamanlayici.Start(); };
                foreach (var c in new ComboBox[] { anaCins, anaTip, anaDurum, cins, tip, durum }) c.TextChanged += degisti;
                bolge.SelectedIndexChanged += degisti;
                hak.ValueChanged += degisti;
                foreach (var r in new[] { rOlmayan, rOlan, rHepsi }) r.CheckedChanged += degisti;
                anaCins.TextChanged += (s, e) => Doldur(anaTip, tipler(Deger(anaCins), true), Deger(anaTip));
                cins.TextChanged += (s, e) => Doldur(tip, tipler(Deger(cins), false), Deger(tip));
                w.Shown += (s, e) => yenile();
                w.FormClosed += (s, e) => { zamanlayici.Stop(); zamanlayici.Dispose(); };

                var islem = DetayIslemi.Vazgec;
                sec.Click += (s, e) => { islem = DetayIslemi.Sec; w.DialogResult = DialogResult.OK; };
                excel.Click += (s, e) => { islem = DetayIslemi.Excel; w.DialogResult = DialogResult.OK; };
                if (Goster(w) != DialogResult.OK) return DetayIslemi.Vazgec;
                var son = suzgec();
                f.AnaCins = son.AnaCins;
                f.AnaTip = son.AnaTip;
                f.AnaDurum = son.AnaDurum;
                f.Bolge = son.Bolge;
                f.Cins = son.Cins;
                f.Tip = son.Tip;
                f.Durum = son.Durum;
                f.Hakedis = son.Hakedis;
                f.Kapsam = son.Kapsam;
                sonuc = DetaySorgu.Sorgula(p, f, dt);
                return islem == DetayIslemi.Vazgec ? DetayIslemi.Sec : islem;
            }
        }

        // ================= Hakediş onayı =================

        /// <summary>Onay tablosunun satırı (aktif hakediş vurgulu).</summary>
        private sealed class SatirPaneli : Panel
        {
            public bool Vurgulu;

            public SatirPaneli()
            {
                SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                base.OnPaint(e);
                if (Vurgulu) using (var b = new SolidBrush(KoyuRenk.Yesil)) e.Graphics.FillRectangle(b, 0, Olcu.S(4), Olcu.S(3), Height - Olcu.S(8));
                using (var p = new Pen(KoyuRenk.Kenar)) e.Graphics.DrawLine(p, Olcu.S(10), Height - 1, Width - Olcu.S(10), Height - 1);
            }
        }

        /// <summary>
        /// Hakediş onayı (PROMAGIS'in onay penceresi gibi): her hakediş için sırayla Kontrol → Hakediş → GIS. Sonraki aşama
        /// işaretlenince öncekiler de işaretlenir, önceki kaldırılınca sonrakiler de kalkar. onaylar yerinde güncellenir.
        /// </summary>
        public static bool Onaylar(OrtamVerisi o, SortedDictionary<int, int> onaylar)
        {
            Hazirla();
            var p = o.Proje;
            var say = new Dictionary<int, int>();
            Action<int> ekle = h => { int c; say.TryGetValue(h, out c); say[h] = c + 1; };
            foreach (var e in p.Elemanlar) ekle(e.Hakedis);
            foreach (var h in p.Hatlar) ekle(h.Hakedis);
            foreach (var c in p.Kanallar) ekle(c.Hakedis);
            foreach (var s in p.Sondajlar) ekle(s.Hakedis);
            int son = Math.Max(HakedisOnayi.PromagisSayisi, o.Hakedis);
            foreach (var n in onaylar.Keys) son = Math.Max(son, n);
            foreach (var n in say.Keys) son = Math.Max(son, n);

            const int satirBoy = 32;
            int gorunen = Math.Min(son, 14);
            bool kaydir = son > gorunen;
            int tabloBoy = 42 + gorunen * satirBoy + 6;
            int boy = 56 + 64 + 10 + 24 + tabloBoy + 14 + 24 + 16 + 60;
            using (var w = new KoyuPencere("Hakediş onayı", 680, boy, Boya.Simge("onay", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(w, "Kaydet", false);
                Koy(w, new BilgiCubugu(BilgiTuru.Bilgi, "Hakediş onayı verilen hakediş kilitlenir: satırları değiştirilemez, silinemez; o hakedişe yeni nesne " +
                                                         "çizilemez; telefondan gelen değişiklik o hakedişe dokunuyorsa aktarılmaz."), 16, 56, 648, 64);
                Etiket(w, "Her hakediş için sırayla: Kontrol → Hakediş → GIS. Sonraki aşama işaretlenince öncekiler de işaretlenir.", 16, 130, 648, KoyuYazi.Kucuk);
                int ty = 154;
                var kart = Koy(w, new Kart(), 16, ty, 648, tabloBoy);
                int[] merkez = { 360, 470, 580 };
                Etiket(kart, "Hakediş", 18, 12, 0, KoyuYazi.Kalin);
                Etiket(kart, "Nesne", 200, 12, 0, KoyuYazi.Kalin);
                string[] asama = { "Kontrol", "Hakediş", "GIS" };
                for (int i = 0; i < 3; i++) Etiket(kart, asama[i], merkez[i] - 50, 12, 100, KoyuYazi.Kalin, null, ContentAlignment.TopCenter);
                var govde = new Panel { BackColor = KoyuRenk.Kart, AutoScroll = kaydir };
                Koy(kart, govde, 1, 40, 646, gorunen * satirBoy + 4);
                if (kaydir) Yerel.KoyuKaydirma(govde);
                var kutular = new Dictionary<int, KoyuOnay[]>();
                var kilitler = new Dictionary<int, PictureBox>();
                bool ayarlaniyor = false;
                var kilitResmi = Boya.Simge("kilit", KoyuRenk.Sari, 14);
                for (int n = 1; n <= son; n++)
                {
                    bool aktif = n == o.Hakedis;
                    var satir = new SatirPaneli { Vurgulu = aktif, BackColor = aktif ? KoyuRenk.Secili : KoyuRenk.Kart };
                    Koy(govde, satir, 0, (n - 1) * satirBoy, kaydir ? 626 : 646, satirBoy);
                    int c0;
                    say.TryGetValue(n, out c0);
                    Etiket(satir, n + ". hakediş" + (aktif ? "  (aktif)" : ""), 18, 7, 0, aktif ? KoyuYazi.Kalin : KoyuYazi.Govde, KoyuRenk.Yazi);
                    var kilit = Resim(satir, kilitResmi, 150, 6, 20, 20);
                    Etiket(satir, c0 > 0 ? c0.ToString("N0", Tr) + " nesne" : "—", 200, 7, 0, null, KoyuRenk.Ikincil);
                    int b = HakedisOnayi.Bitler(onaylar, n);
                    var k = Koy(satir, new KoyuOnay { Isaret = true, AutoSize = false, Checked = (b & HakedisOnayi.Kontrol) != 0 }, merkez[0] - 26, 4, 52, 24);
                    var h = Koy(satir, new KoyuOnay { Isaret = true, AutoSize = false, Checked = (b & HakedisOnayi.Hakedis) != 0 }, merkez[1] - 26, 4, 52, 24);
                    var g = Koy(satir, new KoyuOnay { Isaret = true, AutoSize = false, Checked = (b & HakedisOnayi.Gis) != 0 }, merkez[2] - 26, 4, 52, 24);
                    kilit.Visible = h.Checked;
                    kutular[n] = new[] { k, h, g };
                    kilitler[n] = kilit;
                    EventHandler sira = (s, e) =>
                    {
                        if (ayarlaniyor) return;
                        ayarlaniyor = true;
                        if (s == g && g.Checked) { h.Checked = true; k.Checked = true; }
                        else if (s == h && h.Checked) k.Checked = true;
                        else if (s == k && !k.Checked) { h.Checked = false; g.Checked = false; }
                        else if (s == h && !h.Checked) g.Checked = false;
                        ayarlaniyor = false;
                        kilit.Visible = h.Checked;
                    };
                    k.CheckedChanged += sira;
                    h.CheckedChanged += sira;
                    g.CheckedChanged += sira;
                }
                int ly = ty + tabloBoy + 14;
                Resim(w, Boya.Simge("tamam_daire", KoyuRenk.Vurgu, 14), 16, ly, 18, 18);
                Etiket(w, "Tamamlandı", 38, ly, 0, KoyuYazi.Kucuk);
                Resim(w, Boya.Simge("bekliyor", KoyuRenk.KenarAcik, 14), 130, ly, 18, 18);
                Etiket(w, "Bekliyor", 152, ly, 0, KoyuYazi.Kucuk);
                Resim(w, kilitResmi, 230, ly, 18, 18);
                Etiket(w, "Kilitli (hakediş onaylı)", 252, ly, 0, KoyuYazi.Kucuk);
                alt.Tamam.Click += (s, e) => w.DialogResult = DialogResult.OK;
                if (Goster(w) != DialogResult.OK) return false;
                onaylar.Clear();
                foreach (var kv in kutular)
                {
                    int b = (kv.Value[0].Checked ? HakedisOnayi.Kontrol : 0) | (kv.Value[1].Checked ? HakedisOnayi.Hakedis : 0) | (kv.Value[2].Checked ? HakedisOnayi.Gis : 0);
                    if (b != 0) onaylar[kv.Key] = HakedisOnayi.Duzelt(b);
                }
                return true;
            }
        }

        // ================= Katalogdan seçim =================

        public static KatalogKalemi KatalogdanSec(string baslik, List<KatalogKalemi> liste, IWin32Window sahip)
        {
            Hazirla();
            var k = HizliSecim.TemelKatalog;
            using (var w = new KoyuPencere(baslik, 720, 580, Boya.Simge("malzeme", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(w, "Ekle");
                var ara = Koy(w, new MetinKutusu("", "Ara (tanım, cins, poz no…)", Boya.Simge("ara", KoyuRenk.Ikincil)), 16, 56, 430, 30);
                var cins = Koy(w, new KoyuAcilir(), 458, 56, 246);
                var tl = new TipListesi(ara, k);
                Koy(w, new Cerceve(tl.Liste), 16, 96, 688, 408);
                var cinsler = new List<string>();
                foreach (var it in liste ?? new List<KatalogKalemi>()) if (!cinsler.Contains(it.Cins)) cinsler.Add(it.Cins);
                CinsleriDoldur(cins, k, cinsler, "");
                cins.SelectedIndexChanged += (s, e) => { tl.Cins = SeciliCins(cins); tl.Yenile(); };
                Action ozetYaz = () =>
                {
                    var it = tl.Secili;
                    alt.Ozet.Text = it != null ? "Seçili: " + it.Tanim.Trim() + "  ·  " + AltYazi(k, it) : "Listeden bir malzeme seçin";
                };
                tl.Degisti += () => ozetYaz();
                tl.Secildi += () => alt.Tamam.PerformClick();
                tl.Doldur(liste, null, null);
                ozetYaz();
                alt.Tamam.Click += (s, e) =>
                {
                    if (tl.Secili == null) { Uyar("Listeden bir malzeme seçin."); return; }
                    w.DialogResult = DialogResult.OK;
                };
                w.Shown += (s, e) => ara.Kutu.Focus();
                return Goster(w, sahip) == DialogResult.OK ? tl.Secili : null;
            }
        }

        // ================= Ayarlar =================

        public static bool Ayarlar(OrtamVerisi o)
        {
            Hazirla();
            var a = o.Ayar;
            using (var w = new KoyuPencere("Çizim ayarları", 660, 560, Boya.Simge("ayarlar", KoyuRenk.Ikincil, 20)))
            {
                var alt = AltKur(w, "Kaydet");
                alt.Ozet.Text = "Ayarlar bu çizimin içine kaydedilir.";
                alt.Ozet.Simge = Boya.Simge("kilit", KoyuRenk.Soluk, 16);
                var sekme = Koy(w, new Sekmeler(), 16, 56, 628, 34);
                Func<Panel> sayfa = () => Koy(w, new Panel { BackColor = KoyuRenk.Arka }, 16, 104, 628, 380);

                // Genel
                var genel = sayfa();
                Etiket(genel, "Katman ön eki", 0, 0);
                var onEk = Koy(genel, new MetinKutusu(a.KatmanOnEki, "çizimden: " + o.OnEk), 0, 20, 200, 30);
                Aciklama(genel, "Boş bırakılırsa çizimdeki PROMAGIS katmanlarından bulunur (şu an: " + o.OnEk + ").", 216, 24, 400, 30);
                Etiket(genel, "GIS ön eki", 0, 62);
                var gisOnEki = Koy(genel, new MetinKutusu(a.GisOnEki, "çizimden: " + o.GisOnEki), 0, 82, 200, 30);
                Etiket(genel, "Aktif hakediş", 0, 124);
                var hak = Koy(genel, new SayiKutusu(1, 999, o.Hakedis), 0, 144, 120, 30);
                Aciklama(genel, "Yeni çizilen nesneler bu hakedişin katmanlarına konur.", 136, 150, 460, 20);
                Etiket(genel, "Dilim orta meridyeni (3°)", 0, 190);
                var domKap = Koy(genel, new Panel { BackColor = Color.Transparent }, 0, 212, 628, 64);
                var domlar = new List<KoyuSecim>();
                var domSecenek = new List<int> { 0 };
                domSecenek.AddRange(Turler.Domlar);
                for (int i = 0; i < domSecenek.Count; i++)
                {
                    int m = domSecenek[i];
                    var r = Koy(domKap, new KoyuSecim(m == 0 ? "Bilinmiyor" : m.ToString(CultureInfo.InvariantCulture) + "°") { Tag = m }, (i % 4) * 130, (i / 4) * 30);
                    r.Checked = a.Dom == m;
                    domlar.Add(r);
                }
                if (!domlar.Exists(r => r.Checked)) domlar[0].Checked = true;
                Aciklama(genel, "Telefondaki projeyle aynı olmalı (Elazığ, Malatya, Erzincan: 39°).", 0, 282, 600, 20);

                // Tarife
                var tarife = sayfa();
                Etiket(tarife, "Karakteristik", 0, 0);
                var kar = Koy(tarife, new KoyuAcilir(), 0, 20, 600);
                kar.Items.Add("Katalogdaki standart (çoğunlukla 01)");
                var karKodlari = new List<string>(o.Katalog.Karakteristikler.Keys);
                karKodlari.Sort(StringComparer.Ordinal);
                foreach (var kod in karKodlari) kar.Items.Add(kod + "   —   " + o.Katalog.Karakteristikler[kod]);
                kar.SelectedIndex = Math.Max(0, karKodlari.IndexOf(a.Karakteristik) + 1);
                Etiket(tarife, "Unsur sütunu", 0, 66);
                var unsurKap = Koy(tarife, new Panel { BackColor = Color.Transparent }, 0, 86, 600, 60);
                var sehir = Koy(unsurKap, new KoyuSecim("Şehir (yatırım unsuru)"), 0, 0);
                var koy = Koy(unsurKap, new KoyuSecim("Köy / bakım unsuru"), 0, 30);
                (a.Koy ? koy : sehir).Checked = true;
                Aciklama(tarife, "Yeni konan her kalemin tarifesi bu ayarla üretilir (karakteristik + unsur); var olan kalemler değişmez.", 0, 156, 600, 34);

                // Görünüm
                var gorunum = sayfa();
                var sembol = Koy(gorunum, new KoyuOnay("Telefonla aynı simgeler (SH_ blokları, 1 ölçek)") { Checked = a.TelefonSembolleri }, 0, 0);
                Aciklama(gorunum, "Kapalıysa çizimde o tür için kullanılan PROMAGIS bloğu ve ölçeği korunur.", 26, 26, 580, 20);
                Etiket(gorunum, "PROMAGIS blok ölçeği", 0, 60);
                var olcek = Koy(gorunum, new SayiKutusu(0, 1000, D(a.SembolOlcegi), 2, 0.5m), 0, 80, 120, 30);
                Aciklama(gorunum, "0 = çizimdekilerle aynı (genellikle 4). Telefon simgeleri her zaman 1 ölçekle konur (1/1000 pafta).", 136, 82, 480, 30);
                Etiket(gorunum, "Hat etiketi yüksekliği (m)", 0, 122);
                var etiket = Koy(gorunum, new SayiKutusu(0.05m, 50, D(a.EtiketYuksekligi), 2, 0.1m), 0, 142, 120, 30);
                Aciklama(gorunum, "Telefonun çizimiyle aynı: 1,8 m (parça metrajı 1,44 m).", 136, 150, 480, 20);
                Etiket(gorunum, "Direğe yakalama (m)", 0, 184);
                var yakala = Koy(gorunum, new SayiKutusu(0, 50, D(a.YakalamaMesafesi), 2, 0.5m), 0, 204, 120, 30);
                Aciklama(gorunum, "Hat ve kanal çizerken bu mesafedeki direğin ortasına oturur.", 136, 212, 480, 20);

                // Metraj
                var metraj = sayfa();
                var yukari = Koy(metraj, new KoyuOnay("Çizim uzunluğunu yukarı yuvarla") { Checked = a.YukariYuvarla }, 0, 0);
                Etiket(metraj, "Hat metrajına eklenecek pay (m)", 0, 36, 0, KoyuYazi.Kalin);
                var paylar = new Dictionary<string, SayiKutusu>();
                for (int i = 0; i < Turler.Hatlar.Length; i++)
                {
                    var t = Turler.Hatlar[i];
                    int x = (i % 2) * 310, y = 60 + (i / 2) * 36;
                    Etiket(metraj, t.Ad, x, y + 6, 120, null, KoyuRenk.Yazi);
                    paylar[t.Kod] = Koy(metraj, new SayiKutusu(-100, 1000, D(a.EkPayi(t.Kod)), 2, 0.5m), x + 130, y, 110, 30);
                }
                Etiket(metraj, "Kablo kanalı varsayılanları", 0, 214, 0, KoyuYazi.Kalin);
                Etiket(metraj, "Alt genişlik (cm)", 0, 238);
                var kAlt = Koy(metraj, new SayiKutusu(0, 1000, D(a.KanalAlt), 0, 5), 0, 258, 130, 30);
                Etiket(metraj, "Üst genişlik (cm)", 146, 238);
                var kUst = Koy(metraj, new SayiKutusu(0, 1000, D(a.KanalUst), 0, 5), 146, 258, 130, 30);
                Etiket(metraj, "Derinlik (cm)", 292, 238);
                var kDer = Koy(metraj, new SayiKutusu(0, 1000, D(a.KanalDerinlik), 0, 5), 292, 258, 130, 30);
                Etiket(metraj, "Kanal zemini", 0, 300);
                var zemin = Koy(metraj, ZeminKutusu(o, a.KanalZemin), 0, 320, 422);

                sekme.Ekle("Genel", genel);
                sekme.Ekle("Tarife", tarife);
                sekme.Ekle("Görünüm", gorunum);
                sekme.Ekle("Metraj", metraj);
                alt.Tamam.Click += (s, e) => w.DialogResult = DialogResult.OK;
                if (Goster(w) != DialogResult.OK) return false;

                a.Karakteristik = kar.SelectedIndex > 0 ? karKodlari[kar.SelectedIndex - 1] : "";
                a.Koy = koy.Checked;
                a.TelefonSembolleri = sembol.Checked;
                a.KatmanOnEki = onEk.Text.Trim();
                a.GisOnEki = gisOnEki.Text.Trim();
                a.AktifHakedis = (int)hak.Value;
                var dom = domlar.Find(r => r.Checked);
                a.Dom = dom != null ? (int)dom.Tag : 0;
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
                a.KanalAlt = (double)kAlt.Value;
                a.KanalUst = (double)kUst.Value;
                a.KanalDerinlik = (double)kDer.Value;
                a.KanalZemin = zemin.Text.Trim().Length > 0 ? zemin.Text.Trim() : "TOPRAK";
                return true;
            }
        }

        // ================= Telefondan al =================

        private static void Kutucuk(Control kap, string baslik, int sayi, Color renk, List<string[]> satirlar, string bosYazi, int x, int y)
        {
            var k = Koy(kap, new Kart(), x, y, 248, 236);
            Koy(k, new SayiKutucugu(baslik, sayi, renk), 0, 0, 248, 66);
            if (satirlar != null && satirlar.Count > 0)
            {
                var l = new IkiSatirListe { SelectionMode = SelectionMode.None, BackColor = KoyuRenk.Kart };
                l.Baslik = o => ((string[])o)[0];
                l.Alt = o => ((string[])o).Length > 1 ? ((string[])o)[1] : "";
                int n = 0;
                foreach (var s in satirlar)
                {
                    if (n++ >= 500) { l.Items.Add(new[] { "… ve " + (satirlar.Count - 500) + " nesne daha", "" }); break; }
                    l.Items.Add(s);
                }
                Koy(k, l, 4, 72, 240, 158);
            }
            else Aciklama(k, bosYazi, 14, 80, 220, 40).ForeColor = KoyuRenk.Ikincil;
        }

        /// <summary>
        /// Telefondan alma onayı: yeni / güncellenecek / değişmeyen nesne sayıları ve listeleri, kilitli hakediş ve silinme uyarıları.
        /// </summary>
        public static bool AktarimOnayi(AktarimOzeti oz)
        {
            Hazirla();
            var cubuklar = new List<BilgiCubugu>();
            Func<List<string>, int, string> listele = (l, enCok) =>
            {
                var sb = new System.Text.StringBuilder();
                for (int i = 0; i < l.Count && i < enCok; i++) sb.Append("\n•  " + l[i]);
                if (l.Count > enCok) sb.Append("\n…  ve " + (l.Count - enCok) + " tane daha");
                return sb.ToString();
            };
            if (oz.Kilitliler.Count > 0)
                cubuklar.Add(new BilgiCubugu(BilgiTuru.Uyari, "Onaylı (kilitli) hakedişe dokunduğu için aktarılmayacak: " + oz.Kilitliler.Count + listele(oz.Kilitliler, 4)));
            if (oz.Silinenler.Count > 0)
                cubuklar.Add(new BilgiCubugu(BilgiTuru.Hata, "Telefonda silinmiş görünen: " + oz.Silinenler.Count + " (ayrıca sorulacak)" + listele(oz.Silinenler, 3)));
            if (oz.CizimdeSilinmis > 0)
                cubuklar.Add(new BilgiCubugu(BilgiTuru.Uyari, "Bilgisayarda silinmiş, telefonda duran: " + oz.CizimdeSilinmis + " (ayrıca sorulacak)"));
            if (oz.Onaylar.Count > 0)
                cubuklar.Add(new BilgiCubugu(BilgiTuru.Bilgi, "Telefondaki hakediş onayları çizime de yazılacak:" + listele(oz.Onaylar, 4)));
            if (oz.Uyarilar.Count > 0)
                cubuklar.Add(new BilgiCubugu(BilgiTuru.Uyari, "Uyarılar:" + listele(oz.Uyarilar, 4)));
            int en = 800;
            var yukseklik = new List<int>();
            int toplam = 0;
            foreach (var c in cubuklar)
            {
                int h = (int)Math.Ceiling(c.GerekenYukseklik(S(en - 32)) / Olcu.K);
                yukseklik.Add(h);
                toplam += h + 8;
            }
            int ust = 82 + (oz.BaskaCizim ? 52 : 0);
            int boy = Math.Min(900, ust + 236 + 12 + toplam + 8 + 60);
            using (var w = new KoyuPencere("Telefondan al", en, boy, Boya.Simge("telefon_al", KoyuRenk.MaviAcik, 20)))
            {
                var alt = AltKur(w, "Çizime aktar", false, 140);
                Etiket(w, "Proje: " + oz.Proje + "    ·    Dosya: " + oz.Dosya, 16, 54, en - 32, null, KoyuRenk.Ikincil);
                int y = 82;
                if (oz.BaskaCizim)
                {
                    Koy(w, new BilgiCubugu(BilgiTuru.Uyari, "Bu proje bu çizimden alınmamış görünüyor; telefondaki nesneler yeni olarak eklenecek."), 16, y, en - 32, 44);
                    y += 52;
                }
                Kutucuk(w, "Yeni eklenecek", oz.Yeniler.Count, KoyuRenk.Vurgu, oz.Yeniler, "Yeni nesne yok.", 16, y);
                Kutucuk(w, "Güncellenecek", oz.Guncellenenler.Count, KoyuRenk.Mavi, oz.Guncellenenler, "Değişen nesne yok.", 276, y);
                Kutucuk(w, "Değişmeyen", oz.Degismeyen, KoyuRenk.Gri, null, "Bu nesnelere dokunulmaz.", 536, y);
                y += 236 + 12;
                for (int i = 0; i < cubuklar.Count; i++)
                {
                    if (y + yukseklik[i] > boy - 60 - 8) break;
                    Koy(w, cubuklar[i], 16, y, en - 32, yukseklik[i]);
                    y += yukseklik[i] + 8;
                }
                alt.Tamam.Click += (s, e) => w.DialogResult = DialogResult.OK;
                w.Shown += (s, e) => alt.Tamam.Focus();
                return Goster(w) == DialogResult.OK;
            }
        }

        // ================= Malzemeler (kalem düzenleme) =================

        private static string NesneSimgeAdi(object nesne)
        {
            if (nesne is Eleman e) return SeritSimgeleri.ElemanSimgeAdi(e.Tur, string.IsNullOrEmpty(e.Cins) ? null : new[] { e.Cins });
            if (nesne is Hat h) return SeritSimgeleri.HatSimgeAdi(h.Tur);
            if (nesne is Kanal) return "kanal";
            if (nesne is Sondaj) return "sondaj";
            return "malzeme";
        }

        private static Color NesneRengi(object nesne)
        {
            if (nesne is Eleman e) return ElemanRengi(e.Tur, e.Cins);
            if (nesne is Hat h) return HatRengi(h.Tur);
            if (nesne is Kanal) return KanalRengi;
            if (nesne is Sondaj) return SondajRengi;
            return KoyuRenk.Yesil;
        }

        /// <summary>
        /// Nesnenin pozlarını düzenler. Kaydet'e basılırsa değişiklikler nesneye (model) yazılır ve true döner;
        /// çizime yazmak çağıranın işidir.
        /// </summary>
        public static bool Kalemler(OrtamVerisi o, object nesne)
        {
            Hazirla();
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
            // Onaylı (kilitli) hakedişin satırları değiştirilemez; nesnenin kendi pozu kilitliyse nesnenin bilgileri de
            bool anaKilitli = ana != null && o.Kilitli(ana.Hakedis);
            bool kilitVar = kalemler.Exists(k => o.Kilitli(k.Hakedis));
            var kanalKopya = kanal == null ? null : new Kanal { AltGenislik = kanal.AltGenislik, UstGenislik = kanal.UstGenislik, Derinlik = kanal.Derinlik };
            string simgeAdi = NesneSimgeAdi(nesne);
            var simgeRengi = NesneRengi(nesne);

            using (var w = new KoyuPencere("Malzemeler — " + baslik, 960, 620, Boya.Simge(simgeAdi, simgeRengi, 20)))
            {
                var alt = AltKur(w, "Kaydet", false);
                int bh = S(34), by = (w.Alt.Height - bh) / 2;
                var ekle = new KoyuDugme("Malzeme ekle…", DugmeTuru.Birincil, Boya.Simge("arti", Color.White, 16));
                ekle.SetBounds(S(16), by, S(150), bh);
                var sil = new KoyuDugme("Satırı sil", DugmeTuru.Ikincil, Boya.Simge("sil", KoyuRenk.Ikincil, 16));
                sil.SetBounds(ekle.Right + S(10), by, S(120), bh);
                w.Alt.Controls.Add(ekle);
                w.Alt.Controls.Add(sil);

                MetinKutusu gis = null, guc = null, gerilim = null, bas = null, bit = null;
                KoyuAcilir zemin = null;
                SayiKutusu kAlt = null, kUst = null, kDer = null;
                KoyuOnay og = null, ag = null, ayd = null, rek = null;
                int gy = 56;
                if (el != null)
                {
                    Etiket(w, "GIS numarası", 16, 56);
                    gis = Koy(w, new MetinKutusu(el.GisId), 16, 76, 170, 30);
                    if (el.Tur == "TRAFO_DIREGI" || el.Tur == "TRAFO_MERKEZI" || el.Tur == "PANO")
                    {
                        Etiket(w, "Güç", 202, 56);
                        guc = Koy(w, new MetinKutusu(el.Guc, "ör. 400 kVA"), 202, 76, 150, 30);
                        Etiket(w, "Gerilim", 368, 56);
                        gerilim = Koy(w, new MetinKutusu(el.Gerilim, "ör. 34,5/0,4 kV"), 368, 76, 150, 30);
                    }
                    gy = 122;
                }
                else if (kanal != null)
                {
                    Etiket(w, "Kanaldaki kablolar", 16, 56);
                    og = Koy(w, new KoyuOnay("OG") { Checked = (kanal.Kod & KanalKodu.OG) != 0 }, 16, 80);
                    ag = Koy(w, new KoyuOnay("AG") { Checked = (kanal.Kod & KanalKodu.AG) != 0 }, 76, 80);
                    ayd = Koy(w, new KoyuOnay("Aydınlatma") { Checked = (kanal.Kod & KanalKodu.AYD) != 0 }, 136, 80);
                    rek = Koy(w, new KoyuOnay("Rekortman") { Checked = (kanal.Kod & KanalKodu.REK) != 0 }, 252, 80);
                    Etiket(w, "Zemin", 370, 56);
                    zemin = Koy(w, ZeminKutusu(o, kanal.Zemin), 370, 76, 210);
                    Etiket(w, "Alt genişlik (cm)", 596, 56);
                    kAlt = Koy(w, new SayiKutusu(0, 1000, D(kanal.AltGenislik), 0, 5), 596, 76, 110, 30);
                    Etiket(w, "Üst genişlik (cm)", 716, 56);
                    kUst = Koy(w, new SayiKutusu(0, 1000, D(kanal.UstGenislik), 0, 5), 716, 76, 110, 30);
                    Etiket(w, "Derinlik (cm)", 836, 56);
                    kDer = Koy(w, new SayiKutusu(0, 1000, D(kanal.Derinlik), 0, 5), 836, 76, 108, 30);
                    gy = 122;
                }
                else if (sondaj != null)
                {
                    Etiket(w, "Başlangıç no", 16, 56);
                    bas = Koy(w, new MetinKutusu(sondaj.BasNo), 16, 76, 170, 30);
                    Etiket(w, "Bitiş no", 202, 56);
                    bit = Koy(w, new MetinKutusu(sondaj.BitNo), 202, 76, 170, 30);
                    gy = 122;
                }
                else if (hat != null)
                {
                    Etiket(w, Turler.HatAdi(hat.Tur) + "  ·  " + hat.AnaKesit + "  ·  çizim uzunluğu " + hat.CizimUzunlugu.ToString("0.00", Tr) + " m", 16, 58, 928);
                    gy = 88;
                }

                var g = new DataGridView
                {
                    AllowUserToAddRows = false,
                    AllowUserToDeleteRows = false,
                    SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                    MultiSelect = false,
                    AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                    EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2,
                };
                KoyuTablo.Uygula(g);
                var durumlar = new List<string>(Turler.Durumlar);
                var dmler = new List<string>(Turler.DmDurumlari);
                foreach (var k in kalemler)
                {
                    if (!durumlar.Contains(k.Durum ?? "")) durumlar.Add(k.Durum ?? "");
                    if (!dmler.Contains(k.DmDurum ?? "")) dmler.Add(k.DmDurum ?? "");
                }
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Cins", ReadOnly = true, FillWeight = 120 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Tanım", ReadOnly = true, FillWeight = 175 });
                var cDurum = new DataGridViewComboBoxColumn { HeaderText = "Durum", FillWeight = 60, FlatStyle = FlatStyle.Flat, DisplayStyle = DataGridViewComboBoxDisplayStyle.Nothing };
                cDurum.Items.AddRange(durumlar.ToArray());
                g.Columns.Add(cDurum);
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Miktar", FillWeight = 55 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Birim", ReadOnly = true, FillWeight = 45 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Toplam", ReadOnly = true, FillWeight = 65 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Hakediş", FillWeight = 50 });
                var cDm = new DataGridViewComboBoxColumn { HeaderText = "DM durumu", FillWeight = 60, FlatStyle = FlatStyle.Flat, DisplayStyle = DataGridViewComboBoxDisplayStyle.Nothing };
                cDm.Items.AddRange(dmler.ToArray());
                g.Columns.Add(cDm);
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "", ReadOnly = true, FillWeight = 18 });
                g.Columns[3].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                g.Columns[5].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                g.Columns[6].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                foreach (DataGridViewColumn c in g.Columns) c.SortMode = DataGridViewColumnSortMode.NotSortable;
                var kilitResmi = Boya.Simge("kilit", KoyuRenk.Ikincil, 14);
                var anaResmi = Boya.Simge(simgeAdi, simgeRengi, 18);

                var toplamYazi = Etiket(w, "", 16, 530, 320, KoyuYazi.Kalin, KoyuRenk.Yazi);
                Etiket(w, kilitVar
                        ? "Gri satırlar onaylı (kilitli) hakedişte: değiştirilemez, silinemez." + (anaKilitli ? " Nesnenin kendi pozu da kilitli." : "")
                        : "Durum, miktar, hakediş ve DM durumunu hücreye tıklayıp değiştirin; toplam kendiliğinden hesaplanır.",
                    344, 532, 600, KoyuYazi.Kucuk, kilitVar ? KoyuRenk.UyariYazi : KoyuRenk.Soluk, ContentAlignment.TopRight);

                bool yukleniyor = false;
                Action toplamYaz = () =>
                {
                    double kg = 0;
                    bool varMi = false;
                    foreach (var k in kalemler)
                    {
                        string[] b = (k.Birim ?? "").Split('/');
                        if (b.Length > 1 && b[1] == "kg") { kg += k.Toplam; varMi = true; }
                    }
                    toplamYazi.Text = varMi ? "Toplam: " + kg.ToString("#,0.##", Tr) + " kg" : "";
                };
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
                    row.Cells[8].Value = "";
                    row.Tag = k;
                    if (ReferenceEquals(k, ana)) row.DefaultCellStyle.Font = KoyuYazi.Kalin;
                    if (o.Kilitli(k.Hakedis))
                    {
                        row.ReadOnly = true;
                        row.DefaultCellStyle.ForeColor = KoyuRenk.Soluk;
                        row.DefaultCellStyle.SelectionForeColor = KoyuRenk.Ikincil;
                    }
                    yukleniyor = false;
                };
                Func<Kalem, int> satirEkle = k =>
                {
                    int r = g.Rows.Add();
                    satirYaz(r, k);
                    return r;
                };
                foreach (var k in kalemler) satirEkle(k);
                toplamYaz();

                g.CellPainting += (s, e) =>
                {
                    if (e.RowIndex < 0 || e.RowIndex >= g.Rows.Count) return;
                    var row = g.Rows[e.RowIndex];
                    var kl = row.Tag as Kalem;
                    bool secili = (e.State & DataGridViewElementStates.Selected) != 0;
                    if (e.ColumnIndex == 8)
                    {
                        e.PaintBackground(e.CellBounds, secili);
                        if (kl != null && o.Kilitli(kl.Hakedis))
                            e.Graphics.DrawImage(kilitResmi, e.CellBounds.Left + (e.CellBounds.Width - kilitResmi.Width) / 2, e.CellBounds.Top + (e.CellBounds.Height - kilitResmi.Height) / 2);
                        e.Handled = true;
                    }
                    else if ((e.ColumnIndex == 2 || e.ColumnIndex == 7) && !row.ReadOnly)
                    {
                        e.Paint(e.CellBounds, DataGridViewPaintParts.All);
                        Boya.Ok(e.Graphics, new Rectangle(e.CellBounds.Right - S(22), e.CellBounds.Top, S(18), e.CellBounds.Height), KoyuRenk.Soluk);
                        e.Handled = true;
                    }
                    else if (e.ColumnIndex == 0 && kl != null && ReferenceEquals(kl, ana))
                    {
                        e.PaintBackground(e.CellBounds, secili);
                        e.Graphics.DrawImage(anaResmi, e.CellBounds.Left + S(6), e.CellBounds.Top + (e.CellBounds.Height - anaResmi.Height) / 2);
                        Boya.Yazi(e.Graphics, Convert.ToString(e.FormattedValue, CultureInfo.CurrentCulture), KoyuYazi.Kalin,
                            new Rectangle(e.CellBounds.Left + S(30), e.CellBounds.Top, Math.Max(1, e.CellBounds.Width - S(32)), e.CellBounds.Height),
                            row.ReadOnly ? KoyuRenk.Soluk : KoyuRenk.Yesil, TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
                        e.Handled = true;
                    }
                };
                g.DataError += (s, e) => { e.ThrowException = false; };
                g.CellClick += (s, e) =>
                {
                    if (e.RowIndex < 0 || e.ColumnIndex < 0) return;
                    var row = g.Rows[e.RowIndex];
                    if (row.ReadOnly || g.Columns[e.ColumnIndex].ReadOnly) return;
                    g.BeginEdit(true);
                    var cb = g.EditingControl as ComboBox;
                    if (cb != null) { try { cb.DroppedDown = true; } catch { } }
                };
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
                                if (h > 0 && o.Kilitli(h)) Uyar(HakedisOnayi.KilitMesaji(h));
                                else if (h > 0) k.Hakedis = h;
                                break;
                            }
                        case 7: k.DmDurum = deger; break;
                    }
                    hesapla(k);
                    satirYaz(e.RowIndex, k);
                    toplamYaz();
                };
                Koy(w, new Cerceve(g), 16, gy, 928, 518 - gy);

                if (anaKilitli)
                    foreach (var c in new Control[] { gis, guc, gerilim, bas, bit, zemin, kAlt, kUst, kDer, og, ag, ayd, rek })
                        if (c != null) c.Enabled = false;

                if (kanal != null)
                {
                    EventHandler olcuDegisti = (s, e) =>
                    {
                        kanalKopya.AltGenislik = (double)kAlt.Value;
                        kanalKopya.UstGenislik = (double)kUst.Value;
                        kanalKopya.Derinlik = (double)kDer.Value;
                        if (ana == null) return;
                        hesapla(ana);
                        for (int r = 0; r < g.Rows.Count; r++) if (ReferenceEquals(g.Rows[r].Tag, ana)) satirYaz(r, ana);
                        toplamYaz();
                    };
                    kAlt.ValueChanged += olcuDegisti;
                    kUst.ValueChanged += olcuDegisti;
                    kDer.ValueChanged += olcuDegisti;
                }

                ekle.Click += (s, e) =>
                {
                    if (o.Kilitli(o.Hakedis)) { Uyar(HakedisOnayi.KilitMesaji(o.Hakedis)); return; }
                    var it = KatalogdanSec("Malzeme ekle — " + baslik, o.Katalog.Malzemeler(katalogNesnesi), w);
                    if (it == null) return;
                    string dur = nesneDurumu == "MEVCUT" || string.IsNullOrEmpty(nesneDurumu) ? "M" : nesneDurumu;
                    var k = Katalog.KalemYap(it, 1, dur, o.Hakedis, false, "MALZEME", o.YeniSira(), "", o.Ayar.Karakteristik, o.Ayar.Koy);
                    kalemler.Add(k);
                    int r = satirEkle(k);
                    toplamYaz();
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
                    if (o.Kilitli(k.Hakedis)) { Uyar(k.Hakedis + ". hakediş onaylı (kilitli): bu satır silinemez."); return; }
                    kalemler.Remove(k);
                    g.Rows.Remove(g.CurrentRow);
                    toplamYaz();
                };

                alt.Tamam.Click += (s, e) =>
                {
                    g.EndEdit();
                    if (kanal != null && !(og.Checked || ag.Checked || ayd.Checked || rek.Checked)) { Uyar("Kanaldaki kabloları seçin."); return; }
                    w.DialogResult = DialogResult.OK;
                };
                if (Goster(w) != DialogResult.OK) return false;

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
                    kanal.AltGenislik = (double)kAlt.Value;
                    kanal.UstGenislik = (double)kUst.Value;
                    kanal.Derinlik = (double)kDer.Value;
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
