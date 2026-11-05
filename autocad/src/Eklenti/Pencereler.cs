using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
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
        /// <summary>Malzeme hafızası: aynı tür ve tipteki son elemanın malzemeleri yeni elemana eklensin mi.</summary>
        public bool Hafiza = true;

        public override string ToString() =>
            Turler.ElemanAdi(Tur) + " · " + (Tip != null ? Tip.Gorunen : "") + " · " + Durum + (Turler.DemontajMi(Durum) && !string.IsNullOrEmpty(DmDurum) ? " " + DmDurum : "") +
            " · " + Hakedis + ". hakediş";
    }

    internal sealed class HatSecimi
    {
        public string Tur = "AG_HAVAI";
        /// <summary>Hattaki iletkenler (ilki ana iletken; müşterek hatta OG ile AG birlikte; adetli: 3 adet ALPEK).</summary>
        public List<HatIletkeni> Iletkenleri = new List<HatIletkeni>();
        public string Durum = "M";
        public int Hakedis = 1;
        public List<string> Cinsler = new List<string>();

        /// <summary>Ana iletken (ilk iletken).</summary>
        public KatalogKalemi Kesit
        {
            get { return Iletkenleri.Count > 0 ? Iletkenleri[0].Kesit : null; }
            set
            {
                if (Iletkenleri.Count == 0) Iletkenleri.Add(new HatIletkeni(value));
                else Iletkenleri[0].Kesit = value;
            }
        }

        /// <summary>İletkenlerin yazımı: "3xSW / 3X25/16+35 ALPEK", "3x(3X50/16+70 ALPEK)".</summary>
        public string IletkenYazisi
        {
            get
            {
                if (Iletkenleri.Count == 1 && Iletkenleri[0].Kesit != null) return Iletkenler.AdetYazimi(Iletkenleri[0].Kesit.Tanim.Trim(), Iletkenleri[0].Adet, true);
                return Iletkenler.AnaKesit(Iletkenleri);
            }
        }

        public override string ToString() => Turler.HatAdi(Tur) + " · " + MalzemeYazimi.Duzelt(IletkenYazisi) + " · " + Durum + " · " + Hakedis + ". hakediş";
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

        public override string ToString() => "Yatay sondaj · " + (Tip != null ? Tip.Gorunen : "") + " · " + Durum;
    }

    /// <summary>Toplu malzeme penceresinden çıkan satır: her seçili elemana eklenecek malzeme.</summary>
    internal sealed class TopluMalzemeSatiri
    {
        public KatalogKalemi Kalem;
        public double Miktar = 1;
        /// <summary>Malzemenin durumu; boş: elemanın durumuna göre (mevcut elemana M).</summary>
        public string Durum = "";
        public int Hakedis = 1;
    }

    /// <summary>Telefondan alma özeti (Telefondan al penceresi). Satırlar: { ad, açıklama }.</summary>
    internal sealed class AktarimOzeti
    {
        public string Proje = "", Dosya = "";
        /// <summary>Pencerenin başlığı ve simgesi (telefondan alma; CBS'den alma da aynı pencereyi kullanır).</summary>
        public string Baslik = "Telefondan al", Simge = "telefon_al";
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
        private const string Baslik = Marka.Ad;
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
            KatalogKaynagi.RolleriYukle();
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

        /// <summary>
        /// Telefonun simge takımından elemanın simgesi (tip listesinde: beton daire, kafes kare …) seçili duruma göre: yeni dolu,
        /// mevcut boş, sök-tak yarım dolu, demontaj "/", kesik "//", sökük "X".
        /// </summary>
        private static Image SembolResmi(string tur, string cins, string durum = "M", string dm = "", int px = 20)
        {
            if (string.IsNullOrEmpty(tur)) return null;
            string blok;
            try { blok = Semboller.BlokAdi(tur, cins, durum, dm); }
            catch { return null; }
            string anahtar = blok + "@" + px.ToString(CultureInfo.InvariantCulture);
            Image r;
            if (_semboller.TryGetValue(anahtar, out r)) return r;
            r = null;
            try
            {
                var s = Semboller.Bul(blok);
                bool demontaj = Semboller.DemontajVaryanti(Semboller.Varyant(durum, dm));
                // Demontaj simgesi telefondaki gibi sarı (çizimde demontaj rengi)
                if (s != null) r = SeritSimgeleri.SembolResmi(s, demontaj ? "#ffd84d" : CizimStili.EkranElemanRengi(tur, cins), S(px));
            }
            catch { r = null; }
            if (r == null) r = TurSimgesi(tur, false, false);
            _semboller[anahtar] = r;
            return r;
        }

        /// <summary>
        /// Cinslerin kısa adları (cins düğmeleri için): hepsinde ortak olan baş ve son sözcükler atılır
        /// ("AG galvanizli demir direk", "AG beton direk" → "Galvanizli demir", "Beton").
        /// </summary>
        private static Dictionary<string, string> KisaCinsAdlari(Katalog k, IList<string> cinsler)
        {
            var adlar = new Dictionary<string, string>(StringComparer.Ordinal);
            var sozcukler = new List<string[]>();
            foreach (var c in cinsler) sozcukler.Add((k != null ? k.CinsAdi(c) : c).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
            int bas = 0, son = 0;
            if (cinsler.Count > 1)
            {
                Func<int, bool, bool> ortak = (i, sondan) =>
                {
                    string ilk = null;
                    foreach (var w in sozcukler)
                    {
                        if (w.Length <= bas + son + 1) return false;
                        string x = sondan ? w[w.Length - 1 - i] : w[i];
                        if (ilk == null) ilk = x;
                        else if (!string.Equals(ilk, x, StringComparison.CurrentCultureIgnoreCase)) return false;
                    }
                    return true;
                };
                while (ortak(bas, false)) bas++;
                while (ortak(son, true)) son++;
            }
            for (int i = 0; i < cinsler.Count; i++)
            {
                var w = sozcukler[i];
                string ad = w.Length - bas - son > 0 ? string.Join(" ", w, bas, w.Length - bas - son) : string.Join(" ", w);
                if (ad.Length > 0) ad = char.ToUpper(ad[0], Tr) + ad.Substring(1);
                adlar[cinsler[i]] = ad.Length > 0 ? ad : cinsler[i];
            }
            return adlar;
        }

        /// <summary>Cins düğmelerini doldurur: "Hepsi" + türün cinsleri (kısa adla, tip sayısıyla).</summary>
        private static void CipleriDoldur(CinsSecici c, Katalog k, IList<string> cinsler, IList<KatalogKalemi> tipler, string secili, bool hepsiVar = true)
        {
            var l = new List<CinsSecici.Secenek>();
            var adlar = KisaCinsAdlari(k, cinsler);
            if (hepsiVar && cinsler.Count != 1) l.Add(new CinsSecici.Secenek { Kod = "", Ad = "Hepsi", Sayi = tipler != null ? tipler.Count : -1, Ipucu = "Bütün cinsler" });
            foreach (var cins in cinsler)
            {
                int sayi = 0;
                if (tipler != null) foreach (var t in tipler) if (t.Cins == cins) sayi++;
                l.Add(new CinsSecici.Secenek { Kod = cins, Ad = adlar[cins], Sayi = tipler != null ? sayi : -1, Ipucu = (k != null ? k.CinsAdi(cins) : cins) + "  ·  " + cins });
            }
            c.Doldur(l, secili);
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
                Liste.Baslik = o => ((KatalogKalemi)o).Gorunen;
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
                string y = Norm(it.Tanim + " " + it.Gorunen + " " + it.Cins + " " + it.Birim + " " + it.PozNo + " " + (_k != null ? _k.CinsAdi(it.Cins) : ""));
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

        /// <summary>
        /// Kanal zemini: cins (toprak, tüvenan, mıcır, branşman, kablo demontaj), kaplama (yok, parke, asfalt, beton),
        /// bariyer ve trencher ayrı seçilir; altında çizime ve rapora gidecek kalem adı (KanalZemini). Kurala uymayan eski ad
        /// (ör. "ASFALT") "Diğer" olarak listede durur; seçim değişmezse aynen korunur.
        /// </summary>
        private sealed class ZeminSecici
        {
            public readonly KoyuAcilir Cins, Kaplama;
            public readonly KoyuOnay Bariyer, Trencher;
            public readonly Label Ad;
            public readonly int Boy;
            public event Action Degisti;
            private readonly Katalog _katalog;
            private string _ham;
            private bool _yukleniyor;

            /// <param name="yatay">Tek satır (geniş pencere); değilse alt alta (dar sütun).</param>
            public ZeminSecici(Control kap, int x, int y, int w, bool yatay, string tanim, Katalog katalog)
            {
                _katalog = katalog;
                Cins = new KoyuAcilir { Name = "zeminCinsi" };
                Kaplama = new KoyuAcilir { Name = "zeminKaplamasi" };
                Bariyer = new KoyuOnay("Bariyerli") { Name = "zeminBariyer" };
                Trencher = new KoyuOnay("Trencher") { Name = "zeminTrencher" };
                if (yatay)
                {
                    int w1 = Math.Min(190, (w - 236) / 2), w2 = w1;
                    Etiket(kap, "Kanal cinsi (zemin)", x, y);
                    Koy(kap, Cins, x, y + 20, w1);
                    Etiket(kap, "Kaplama", x + w1 + 12, y);
                    Koy(kap, Kaplama, x + w1 + 12, y + 20, w2);
                    Koy(kap, Bariyer, x + w1 + w2 + 28, y + 24);
                    Koy(kap, Trencher, x + w1 + w2 + 28 + 112, y + 24);
                    Ad = Etiket(kap, "", x, y + 58, w, KoyuYazi.Kucuk, KoyuRenk.Soluk);
                    Boy = 80;
                }
                else
                {
                    Etiket(kap, "Kanal cinsi (zemin)", x, y);
                    Koy(kap, Cins, x, y + 20, w);
                    Etiket(kap, "Kaplama", x, y + 60);
                    Koy(kap, Kaplama, x, y + 80, w);
                    Koy(kap, Bariyer, x, y + 120);
                    Koy(kap, Trencher, x + Math.Min(120, w / 2), y + 120);
                    Ad = Aciklama(kap, "", x, y + 150, w, 40);
                    Boy = 190;
                }
                foreach (var k in KanalZemini.Kaplamalar) Kaplama.Items.Add(KanalZemini.KaplamaAdi(k));
                Tanim = tanim;
                EventHandler degisti = (s, e) =>
                {
                    if (_yukleniyor) return;
                    if (Cins.SelectedIndex < KanalZemini.Cinsler.Length) _ham = null;
                    Yenile();
                    Degisti?.Invoke();
                };
                Cins.SelectedIndexChanged += degisti;
                Kaplama.SelectedIndexChanged += degisti;
                Bariyer.CheckedChanged += degisti;
                Trencher.CheckedChanged += degisti;
            }

            /// <summary>Seçili zeminin kalem adı ("PARKE TUVENAN (BARİYERLİ)"); kural dışı eski ad değişmediyse kendisi.</summary>
            public string Tanim
            {
                get
                {
                    if (_ham != null && Cins.SelectedIndex >= KanalZemini.Cinsler.Length) return _ham;
                    return Secim().Tanim;
                }
                set
                {
                    _yukleniyor = true;
                    try
                    {
                        var z = KanalZemini.Coz(value);
                        _ham = z == null && !string.IsNullOrWhiteSpace(value) ? value.Trim() : null;
                        Cins.Items.Clear();
                        foreach (var c in KanalZemini.Cinsler) Cins.Items.Add(KanalZemini.CinsAdi(c));
                        if (_ham != null) Cins.Items.Add("Diğer: " + _ham);
                        z = z ?? new KanalZemini();
                        Cins.SelectedIndex = _ham != null ? Cins.Items.Count - 1 : Math.Max(0, Array.IndexOf(KanalZemini.Cinsler, z.Cins));
                        Kaplama.SelectedIndex = Math.Max(0, Array.IndexOf(KanalZemini.Kaplamalar, z.Kaplama ?? ""));
                        Bariyer.Checked = z.Bariyerli;
                        Trencher.Checked = z.Trencher;
                    }
                    finally { _yukleniyor = false; }
                    Yenile();
                }
            }

            private KanalZemini Secim()
            {
                int c = Cins.SelectedIndex, k = Kaplama.SelectedIndex;
                return new KanalZemini
                {
                    Cins = c >= 0 && c < KanalZemini.Cinsler.Length ? KanalZemini.Cinsler[c] : KanalZemini.Toprak,
                    Kaplama = k >= 0 && k < KanalZemini.Kaplamalar.Length ? KanalZemini.Kaplamalar[k] : "",
                    Bariyerli = Bariyer.Checked, Trencher = Trencher.Checked,
                };
            }

            private void Yenile()
            {
                bool ozel = (_ham != null && Cins.SelectedIndex >= KanalZemini.Cinsler.Length) || KanalZemini.OzelMi(Secim().Cins);
                Kaplama.Enabled = !ozel;
                Bariyer.Enabled = !ozel;
                Trencher.Enabled = !ozel;
                string ad = Tanim;
                var it = _katalog != null ? _katalog.KanalZeminiKalemi(ad) : null;
                Ad.Text = "Kalem adı: " + ad + (it == null || it.Kaynak == "kural" ? "  ·  eski programın listesinde yok, bu adla yazılır" : "");
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
            using (var f = new KoyuPencere("Eleman koy", 920, 600, Boya.Simge("direk", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(f, "Çiz");
                int icSon = f.IcerikSonu - 16;

                // Sol: tür
                var tur = Koy(f, new SimgeListesi(), 16, 56, 196, icSon - 56);
                foreach (var t in Turler.Elemanlar) tur.Items.Add(t);
                tur.Simge = (x, secili) => TurSimgesi(((Tur)x).Kod, false, secili);

                // Orta: arama, cins düğmeleri, tip listesi
                var ara = Koy(f, new MetinKutusu("", "Ara (tip, cins, poz…)", Boya.Simge("ara", KoyuRenk.Ikincil)), 228, 56, 360, 30);
                var cins = Koy(f, new CinsSecici(), 228, 94, 360, 30);
                Func<Tur> seciliTur = () => tur.SelectedItem as Tur;
                DurumSecici durum = null;
                KoyuAcilir dm = null;
                Func<string> dmKodu = () => dm != null && dm.Enabled ? DmKodu(dm) : "";
                var liste = new TipListesi(ara, o.Katalog, it => SembolResmi(seciliTur() != null ? seciliTur().Kod : "", it.Cins, durum != null ? durum.Secili : "M", dmKodu()));
                var cerceve = Koy(f, new Cerceve(liste.Liste), 228, 132, 360, icSon - 132);
                Action yerlestir = () =>
                {
                    int h = cins.GerekenYukseklik;
                    cins.Height = h;
                    int y0 = cins.Bottom + S(8);
                    cerceve.SetBounds(cerceve.Left, y0, cerceve.Width, Math.Max(S(80), S(icSon) - y0));
                };

                // Sağ: durum, demontaj türü, hakediş, GIS, malzeme hafızası
                durum = new DurumSecici(f, 604, 56, 300, onceki != null ? onceki.Durum : o.Ayar.SonDeger("eleman.durum", "M"));
                int y = 56 + durum.Boy + 12;
                Etiket(f, "Demontaj türü (DM, DM+M)", 604, y);
                dm = Koy(f, DmKutusu(onceki != null ? onceki.DmDurum : ""), 604, y + 20, 300);
                y += 60;
                Etiket(f, "Hakediş", 604, y);
                var hak = Koy(f, new SayiKutusu(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis), 604, y + 20, 120, 30);
                Etiket(f, "İlk GIS numarası", 738, y);
                var gis = Koy(f, new MetinKutusu(), 738, y + 20, 166, 30);
                y += 62;
                var hafiza = Koy(f, new KoyuOnay("Son malzemeleri ekle (malzeme hafızası)") { Checked = onceki != null ? onceki.Hafiza : HizliSecim.HafizaAcik }, 604, y);
                var hafizaYazi = Aciklama(f, "", 630, y + 24, 274, 32);
                y += 62;
                const string normal = "Her tıklamada bir eleman konur; GIS numarası kendiliğinden artar. Bitirmek için Enter.";
                var bilgi = Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, normal), 604, y, 300, Math.Max(52, icSon - y));

                var suzgec = onceki != null ? onceki.Cinsler : new List<string>();
                bool yukleniyor = false;
                Action gisOner = () =>
                {
                    var t = seciliTur();
                    string oneri = t == null ? "" : Numara.SonrakiGis(o.Proje.Elemanlar, t.Kod, o.GisOnEki, liste.Secili != null ? liste.Secili.Cins : "");
                    gis.Ipucu = string.IsNullOrEmpty(oneri) ? "numara verilmez" : "kendiliğinden: " + oneri;
                };
                Action hafizaYaz = () =>
                {
                    var t = seciliTur();
                    var tip = liste.Secili;
                    string kaynak = "";
                    var l = t != null && tip != null ? HizliSecim.Hafiza.Bul(t.Kod, tip.Cins, tip.Tanim, out kaynak) : null;
                    hafizaYazi.Text = l == null || l.Count == 0
                        ? "Hafızada bu tip için malzeme yok. Bir elemanın malzemelerini düzenleyince hatırlanır."
                        : MalzemeHafizasi.Ozet(l, kaynak, 3);
                    hafizaYazi.ForeColor = hafiza.Checked && l != null && l.Count > 0 ? KoyuRenk.Ikincil : KoyuRenk.Soluk;
                };
                Action ozetYaz = () =>
                {
                    var t = seciliTur();
                    var tip = liste.Secili;
                    string d = durum.Secili, dmk = dmKodu();
                    int hafizaSayisi = hafiza.Checked && t != null && tip != null ? HizliSecim.Hafiza.Sayisi(t.Kod, tip.Cins, tip.Tanim) : 0;
                    alt.Ozet.Text = "Çizilecek: " + (t != null ? t.Ad : "?") + " · " + (tip != null ? tip.Gorunen : "tip seçin") + " · " + d +
                                    (dmk.Length > 0 ? " " + dmk : "") + " · " + (int)hak.Value + ". hakediş" + (hafizaSayisi > 0 ? " · +" + hafizaSayisi + " malzeme" : "");
                    alt.Ozet.Simge = t == null ? null : tip != null ? SembolResmi(t.Kod, tip.Cins, d, dmk, 22) : TurSimgesi(t.Kod, false, false, 18);
                };
                var kilitDenetle = KilitBagla(o, hak, bilgi, alt.Tamam, normal);
                List<KatalogKalemi> turTipleri = new List<KatalogKalemi>();
                Action tipleriDoldur = () =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    liste.Cins = cins.SeciliKod;
                    string son = onceki != null && onceki.Tur == t.Kod && onceki.Tip != null ? onceki.Tip.Anahtar : o.Ayar.SonDeger("eleman.tip." + t.Kod, null);
                    if (liste.Secili != null && liste.Secili.Cins == cins.SeciliKod) son = liste.Secili.Anahtar;
                    liste.Doldur(turTipleri, HizliSecim.SonTipler("eleman/" + t.Kod, o.Katalog, turTipleri), son);
                    gisOner();
                    hafizaYaz();
                    ozetYaz();
                };
                tur.SelectedIndexChanged += (s, e) =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    yukleniyor = true;
                    bool suzgecli = suzgec.Count > 0 && onceki != null && onceki.Tur == t.Kod;
                    var cinsler = suzgecli ? new List<string>(suzgec) : o.Katalog.ElemanCinsListesi(t.Kod);
                    turTipleri = o.Katalog.AnaTipler(t.Kod, suzgecli ? suzgec : null);
                    if (turTipleri.Count == 0) turTipleri = o.Katalog.AnaTipler(t.Kod);
                    if (turTipleri.Count == 0) turTipleri = o.Katalog.Kalemler.FindAll(x => x.Rol == "ana");
                    foreach (var it in turTipleri) if (!cinsler.Contains(it.Cins)) cinsler.Add(it.Cins);
                    string sonCins = onceki != null && onceki.Tur == t.Kod && onceki.Tip != null ? onceki.Tip.Cins : "";
                    CipleriDoldur(cins, o.Katalog, cinsler, turTipleri, o.Ayar.SonDeger("eleman.cins." + t.Kod, sonCins));
                    yerlestir();
                    yukleniyor = false;
                    tipleriDoldur();
                };
                cins.Degisti += () => { if (!yukleniyor) tipleriDoldur(); };
                liste.Degisti += () => { gisOner(); hafizaYaz(); ozetYaz(); };
                liste.Secildi += () => { if (alt.Tamam.Enabled) alt.Tamam.PerformClick(); };
                durum.Degisti += () => { dm.Enabled = Turler.DemontajMi(durum.Secili); liste.Liste.Invalidate(); ozetYaz(); };
                dm.SelectedIndexChanged += (s, e) => { liste.Liste.Invalidate(); ozetYaz(); };
                hak.ValueChanged += (s, e) => { kilitDenetle(); ozetYaz(); };
                hafiza.CheckedChanged += (s, e) => { hafizaYaz(); ozetYaz(); };
                dm.Enabled = Turler.DemontajMi(durum.Secili);

                string ilkTur = onceki != null ? onceki.Tur : o.Ayar.SonDeger("eleman.tur", "AG_DIREK");
                tur.SelectedIndex = Math.Max(0, Array.FindIndex(Turler.Elemanlar, t => t.Kod == ilkTur));
                if (onceki != null && !string.IsNullOrEmpty(onceki.Gis)) gis.Text = onceki.Gis;
                kilitDenetle();
                ozetYaz();
                f.Shown += (s, e) => { yerlestir(); liste.Liste.Focus(); };

                alt.Tamam.Click += (s, e) =>
                {
                    if (liste.Secili == null) { Uyar("Listeden bir tip seçin."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(o.KilitMesaji((int)hak.Value)); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return null;

                var sonuc = new ElemanSecimi
                {
                    Tur = seciliTur().Kod,
                    Tip = liste.Secili,
                    Durum = durum.Secili,
                    DmDurum = dmKodu(),
                    Hakedis = (int)hak.Value,
                    Gis = gis.Text.Trim(),
                    Cinsler = onceki != null && onceki.Tur == seciliTur().Kod ? suzgec : new List<string>(),
                    Hafiza = hafiza.Checked,
                };
                HizliSecim.SonaEkle("eleman/" + sonuc.Tur, sonuc.Tip);
                o.Ayar.Son["eleman.tur"] = sonuc.Tur;
                o.Ayar.Son["eleman.tip." + sonuc.Tur] = sonuc.Tip.Anahtar;
                o.Ayar.Son["eleman.cins." + sonuc.Tur] = cins.SeciliKod;
                o.Ayar.Son["eleman.durum"] = sonuc.Durum;
                return sonuc;
            }
        }

        // ================= Hat =================

        /// <summary>
        /// Hat penceresindeki iletken yuvası ("1. iletken", "2. iletken"): seçili iletken, cinsi ve adedi. Tıklanan yuva etkin
        /// olur; listede seçilen iletken etkin yuvaya yazılır. İkinci yuva boşaltılabilir (×).
        /// </summary>
        private sealed class IletkenYuvasi : Panel
        {
            public readonly string Baslik;
            public readonly SayiKutusu Adet;
            public readonly KoyuDugme Bosalt;
            private readonly Katalog _k;
            private KatalogKalemi _kesit;
            private bool _etkin;
            public event Action Tiklandi;
            public event Action Degisti;

            public IletkenYuvasi(string baslik, Katalog k, bool bosaltilir)
            {
                SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
                Baslik = baslik;
                _k = k;
                BackColor = KoyuRenk.Kart;
                Cursor = Cursors.Hand;
                Adet = new SayiKutusu(1, 12, 1);
                Controls.Add(Adet);
                Adet.ValueChanged += (s, e) => Degisti?.Invoke();
                if (bosaltilir)
                {
                    Bosalt = new KoyuDugme("", DugmeTuru.Hayalet, Boya.Simge("sil", KoyuRenk.Ikincil, 16));
                    Controls.Add(Bosalt);
                    Bosalt.Click += (s, e) => { Kesit = null; Degisti?.Invoke(); };
                }
            }

            public KatalogKalemi Kesit
            {
                get => _kesit;
                set
                {
                    _kesit = value;
                    Adet.Visible = value != null;
                    if (Bosalt != null) Bosalt.Visible = value != null;
                    Invalidate();
                }
            }

            public bool Etkin
            {
                get => _etkin;
                set { _etkin = value; Invalidate(); }
            }

            protected override void OnLayout(LayoutEventArgs levent)
            {
                base.OnLayout(levent);
                int ah = Olcu.S(30), aw = Olcu.S(70);
                int sag = Width - Olcu.S(10) - (Bosalt != null ? Olcu.S(30) + Olcu.S(4) : 0);
                Adet.SetBounds(sag - aw, (Height - ah) / 2 + Olcu.S(8), aw, ah);
                if (Bosalt != null) Bosalt.SetBounds(Width - Olcu.S(10) - Olcu.S(30), (Height - ah) / 2 + Olcu.S(8), Olcu.S(30), ah);
            }

            protected override void OnClick(EventArgs e)
            {
                base.OnClick(e);
                Tiklandi?.Invoke();
            }

            protected override void OnPaintBackground(PaintEventArgs e)
            {
                using (var b = new SolidBrush(Boya.Zemin(this))) e.Graphics.FillRectangle(b, ClientRectangle);
                Boya.Kutu(e.Graphics, ClientRectangle, _etkin ? KoyuRenk.Secili : KoyuRenk.Kart, _etkin ? KoyuRenk.Vurgu : KoyuRenk.Kenar, Olcu.S(8));
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                base.OnPaint(e);
                var g = e.Graphics;
                // Boş yuvada adet kutusu gizlidir: yazı bütün genişliği kullanır
                int w = (_kesit != null ? Adet.Left : Width) - Olcu.S(20);
                Boya.Yazi(g, Baslik + (_etkin ? "  ·  listeden seçin" : ""), KoyuYazi.Kucuk, new Rectangle(Olcu.S(12), Olcu.S(6), Math.Max(1, w), Olcu.S(16)),
                    _etkin ? KoyuRenk.Yesil : KoyuRenk.Ikincil, TextFormatFlags.Left | TextFormatFlags.Top | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
                if (_kesit == null)
                {
                    Boya.Yazi(g, "Yok — eklemek için tıklayıp listeden seçin", KoyuYazi.Govde, new Rectangle(Olcu.S(12), Olcu.S(26), Math.Max(1, w), Olcu.S(22)), KoyuRenk.Soluk,
                        TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
                    return;
                }
                Boya.Yazi(g, "Adet", KoyuYazi.Kucuk, new Rectangle(Adet.Left, Olcu.S(6), Adet.Width, Olcu.S(16)), KoyuRenk.Ikincil,
                    TextFormatFlags.Left | TextFormatFlags.Top | TextFormatFlags.SingleLine);
                Boya.Yazi(g, _kesit.Gorunen, KoyuYazi.Kalin, new Rectangle(Olcu.S(12), Olcu.S(24), Math.Max(1, w), Olcu.S(20)), KoyuRenk.Yazi,
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
                Boya.Yazi(g, _k != null ? _k.CinsAdi(_kesit.Cins) : _kesit.Cins, KoyuYazi.Kucuk, new Rectangle(Olcu.S(12), Olcu.S(44), Math.Max(1, w), Olcu.S(16)), KoyuRenk.Ikincil,
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
            }
        }

        /// <summary>Müşterek hatta öbür gerilimin (OG'nin yanında AG, AG'nin yanında OG) en çok kullanılan iletkeni.</summary>
        private static KatalogKalemi OburGerilim(List<KatalogKalemi> kesitler, KatalogKalemi ana)
        {
            bool og = ana != null && Iletkenler.OgMu(ana.Cins);
            KatalogKalemi en = null;
            foreach (var x in kesitler)
                if (Iletkenler.OgMu(x.Cins) != og && (en == null || x.Kullanim > en.Kullanim)) en = x;
            return en;
        }

        /// <summary>
        /// Hat seçimi: tür, iletkenler (iki yuva), durum, hakediş. degisecek &gt; 0: Hat Değiştir (SH_HATDEGISTIR) — çizilmiş
        /// o kadar hattın iletkeni değişir; pencere önceki (hattın şimdiki) seçimiyle açılır.
        /// </summary>
        public static HatSecimi Hat(OrtamVerisi o, HatSecimi onceki, int degisecek = 0)
        {
            Hazirla();
            bool degistir = degisecek > 0;
            using (var f = new KoyuPencere(degistir ? "Hat değiştir" : "Hat çiz", 920, 660, Boya.Simge("hat_havai", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(f, degistir ? "Değiştir" : "Çiz");
                int icSon = f.IcerikSonu - 16;

                var tur = Koy(f, new SimgeListesi(), 16, 56, 196, icSon - 56);
                foreach (var t in Turler.Hatlar) tur.Items.Add(t);
                tur.Simge = (x, secili) => TurSimgesi(((Tur)x).Kod, true, secili);
                Func<Tur> seciliTur = () => tur.SelectedItem as Tur;

                var ara = Koy(f, new MetinKutusu("", "Ara (kesit, iletken, kablo…)", Boya.Simge("ara", KoyuRenk.Ikincil)), 228, 56, 360, 30);
                var cins = Koy(f, new CinsSecici(), 228, 94, 360, 30);
                var liste = new TipListesi(ara, o.Katalog, it => seciliTur() != null ? TurSimgesi(seciliTur().Kod, true, false, 22) : null);
                var cerceve = Koy(f, new Cerceve(liste.Liste), 228, 132, 360, icSon - 132);
                Action yerlestir = () =>
                {
                    int h = cins.GerekenYukseklik;
                    cins.Height = h;
                    int y0 = cins.Bottom + S(8);
                    cerceve.SetBounds(cerceve.Left, y0, cerceve.Width, Math.Max(S(80), S(icSon) - y0));
                };

                // Sağ: iletkenler (iki yuva), durum, hakediş
                Etiket(f, "Bu hattaki iletkenler", 604, 56, 300, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var yuva1 = Koy(f, new IletkenYuvasi("1. iletken", o.Katalog, false), 604, 80, 300, 70);
                var yuva2 = Koy(f, new IletkenYuvasi("2. iletken (isteğe bağlı)", o.Katalog, true), 604, 158, 300, 70);
                var durum = new DurumSecici(f, 604, 240, 300, onceki != null ? onceki.Durum : o.Ayar.SonDeger("hat.durum", "M"));
                int y = 240 + durum.Boy + 12;
                Etiket(f, "Hakediş", 604, y);
                var hak = Koy(f, new SayiKutusu(1, 999, onceki != null ? onceki.Hakedis : o.Hakedis), 604, y + 20, 120, 30);
                y += 62;
                string normal = degistir
                    ? "Seçilen " + degisecek + " hattın iletkeni (tip, cins), türü, durumu ve hakedişi değişir; çizgiler yerinde kalır, metraj korunur (tür değişirse yeni türün metrajı)."
                    : "Hat her direkte, SDK'da biter, yeni parça başlar; her parçaya hat bilgisi yazılır.";
                var bilgi = Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, normal), 604, y, 300, Math.Max(52, icSon - y));

                var suzgec = onceki != null ? onceki.Cinsler : new List<string>();
                bool yukleniyor = false;
                List<KatalogKalemi> kesitler = new List<KatalogKalemi>();
                IletkenYuvasi etkin = yuva1;
                Func<List<HatIletkeni>> iletkenler = () =>
                {
                    var l = new List<HatIletkeni>();
                    if (yuva1.Kesit != null) l.Add(new HatIletkeni(yuva1.Kesit, (int)yuva1.Adet.Value));
                    if (yuva2.Kesit != null) l.Add(new HatIletkeni(yuva2.Kesit, (int)yuva2.Adet.Value));
                    return l;
                };
                Action ozetYaz = () =>
                {
                    var t = seciliTur();
                    var hs = new HatSecimi { Iletkenleri = iletkenler() };
                    alt.Ozet.Text = (degistir ? "Yeni: " : "Çizilecek: ") + (t != null ? t.Ad : "?") + " · " + (hs.Iletkenleri.Count > 0 ? MalzemeYazimi.Duzelt(hs.IletkenYazisi) : "iletken seçin") + " · " + durum.Secili + " · " + (int)hak.Value + ". hakediş";
                    alt.Ozet.Simge = t != null ? TurSimgesi(t.Kod, true, false, 18) : null;
                };
                var kilitDenetle = KilitBagla(o, hak, bilgi, alt.Tamam, normal);
                Action listeyiDoldur = () =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    liste.Cins = cins.SeciliKod;
                    string son = etkin.Kesit != null ? etkin.Kesit.Anahtar : null;
                    liste.Doldur(kesitler, HizliSecim.SonTipler("hat/" + t.Kod, o.Katalog, kesitler), son, null, "Tüm kesitler");
                    ozetYaz();
                };
                Action<IletkenYuvasi> etkinYap = yv =>
                {
                    etkin = yv;
                    yuva1.Etkin = yv == yuva1;
                    yuva2.Etkin = yv == yuva2;
                    // Cins düğmesi yuvadaki iletkenin cinsine; boş ikinci yuvada müşterek hatta öbür gerilime
                    var hedef = yv.Kesit ?? (yv == yuva2 && seciliTur() != null && seciliTur().Kod == "MUSTEREK" ? OburGerilim(kesitler, yuva1.Kesit) : null);
                    yukleniyor = true;
                    if (hedef != null && cins.SeciliKod != "" && cins.SeciliKod != hedef.Cins) cins.Sec(hedef.Cins);
                    yukleniyor = false;
                    liste.Cins = cins.SeciliKod;
                    liste.Doldur(kesitler, HizliSecim.SonTipler("hat/" + (seciliTur() != null ? seciliTur().Kod : ""), o.Katalog, kesitler), hedef != null ? hedef.Anahtar : null, null, "Tüm kesitler");
                };
                yuva1.Tiklandi += () => etkinYap(yuva1);
                yuva2.Tiklandi += () => etkinYap(yuva2);
                yuva1.Degisti += () => ozetYaz();
                yuva2.Degisti += () => { if (yuva2.Kesit == null) etkinYap(yuva1); ozetYaz(); };
                tur.SelectedIndexChanged += (s, e) =>
                {
                    var t = seciliTur();
                    if (t == null) return;
                    yukleniyor = true;
                    bool suzgecli = suzgec.Count > 0 && onceki != null && onceki.Tur == t.Kod;
                    var cinsler = suzgecli ? new List<string>(suzgec) : o.Katalog.HatCinsListesi(t.Kod);
                    kesitler = o.Katalog.HatKesitleri(t.Kod, suzgecli ? suzgec : cinsler);
                    if (kesitler.Count == 0) kesitler = o.Katalog.HatKesitleri(t.Kod);
                    foreach (var it in kesitler) if (!cinsler.Contains(it.Cins)) cinsler.Add(it.Cins);
                    // Yuvalar: önceki seçim (aynı türse), yoksa bu türde son kullanılan; müşterekte ikinci yuva öbür gerilim
                    bool ayni = onceki != null && onceki.Tur == t.Kod && onceki.Iletkenleri.Count > 0;
                    KatalogKalemi k1 = ayni ? onceki.Iletkenleri[0].Kesit : null, k2 = ayni && onceki.Iletkenleri.Count > 1 ? onceki.Iletkenleri[1].Kesit : null;
                    if (k1 == null)
                    {
                        string a = o.Ayar.SonDeger("hat.kesit." + t.Kod, null);
                        if (a != null) k1 = kesitler.Find(x => x.Anahtar == a);
                        if (k1 == null && t.Kod == "MUSTEREK") k1 = OburGerilim(kesitler, null);
                        if (k1 == null)
                        {
                            foreach (var x in kesitler) if (cinsler.Contains(x.Cins) && (k1 == null || x.Kullanim > k1.Kullanim)) k1 = x;
                        }
                        string b = o.Ayar.SonDeger("hat.ek." + t.Kod, t.Kod == "MUSTEREK" ? "" : "-");
                        if (b != "-") k2 = b.Length > 0 ? kesitler.Find(x => x.Anahtar == b) : null;
                        if (k2 == null && b != "-" && t.Kod == "MUSTEREK") k2 = OburGerilim(kesitler, k1);
                    }
                    yuva1.Kesit = k1;
                    yuva1.Adet.Value = ayni ? Math.Max(1, onceki.Iletkenleri[0].Adet) : 1;
                    yuva2.Kesit = k2;
                    yuva2.Adet.Value = ayni && onceki.Iletkenleri.Count > 1 ? Math.Max(1, onceki.Iletkenleri[1].Adet) : 1;
                    CipleriDoldur(cins, o.Katalog, cinsler, kesitler, k1 != null ? k1.Cins : o.Ayar.SonDeger("hat.cins." + t.Kod, ""));
                    yerlestir();
                    yukleniyor = false;
                    etkinYap(yuva1);
                    ozetYaz();
                };
                cins.Degisti += () => { if (!yukleniyor) listeyiDoldur(); };
                liste.Degisti += () =>
                {
                    if (yukleniyor || liste.Secili == null) return;
                    etkin.Kesit = liste.Secili;
                    ozetYaz();
                };
                liste.Secildi += () => { if (alt.Tamam.Enabled) alt.Tamam.PerformClick(); };
                durum.Degisti += () => ozetYaz();
                hak.ValueChanged += (s, e) => { kilitDenetle(); ozetYaz(); };
                string ilkTur = onceki != null ? onceki.Tur : o.Ayar.SonDeger("hat.tur", "AG_HAVAI");
                tur.SelectedIndex = Math.Max(0, Array.FindIndex(Turler.Hatlar, t => t.Kod == ilkTur));
                kilitDenetle();
                ozetYaz();
                f.Shown += (s, e) => { yerlestir(); liste.Liste.Focus(); };

                alt.Tamam.Click += (s, e) =>
                {
                    if (yuva1.Kesit == null) { Uyar("Listeden bir iletken / kablo seçin."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(o.KilitMesaji((int)hak.Value)); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return null;
                var sonuc = new HatSecimi
                {
                    Tur = seciliTur().Kod, Iletkenleri = iletkenler(), Durum = durum.Secili, Hakedis = (int)hak.Value,
                    Cinsler = onceki != null && onceki.Tur == seciliTur().Kod ? suzgec : new List<string>(),
                };
                HizliSecim.SonaEkle("hat/" + sonuc.Tur, sonuc.Kesit);
                o.Ayar.Son["hat.tur"] = sonuc.Tur;
                o.Ayar.Son["hat.kesit." + sonuc.Tur] = sonuc.Kesit.Anahtar;
                o.Ayar.Son["hat.ek." + sonuc.Tur] = sonuc.Iletkenleri.Count > 1 ? sonuc.Iletkenleri[1].Kesit.Anahtar : "-";
                o.Ayar.Son["hat.cins." + sonuc.Tur] = cins.SeciliKod;
                o.Ayar.Son["hat.durum"] = sonuc.Durum;
                return sonuc;
            }
        }

        // ================= Hakkında =================

        /// <summary>Beyaz yuvarlak köşeli kart üstünde Şebeke-M logosu (logo beyaz zemin için çizilmiştir).</summary>
        private sealed class LogoKarti : Control
        {
            public LogoKarti()
            {
                SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                var g = e.Graphics;
                using (var b = new SolidBrush(Boya.Zemin(this))) g.FillRectangle(b, ClientRectangle);
                Boya.Kutu(g, ClientRectangle, Color.White, Color.White, Olcu.S(12));
                var logo = Marka.Logo;
                if (logo == null) return;
                int pay = Olcu.S(14);
                var alan = new Rectangle(pay, pay, Math.Max(1, Width - 2 * pay), Math.Max(1, Height - 2 * pay));
                double k = Math.Min(alan.Width / (double)logo.Width, alan.Height / (double)logo.Height);
                int w = (int)(logo.Width * k), h = (int)(logo.Height * k);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.DrawImage(logo, alan.Left + (alan.Width - w) / 2, alan.Top + (alan.Height - h) / 2, w, h);
            }
        }

        /// <summary>
        /// Hakkında: Şebeke-M logosu, sürüm, slogan; "Hakkında" sekmesinde amaç ve yapabildikler (ortak/marka/hakkinda.json,
        /// telefonla aynı metin), "Komutlar" sekmesinde komut listesi (gruplu). "Komut satırına yaz" listeyi AutoCAD'in komut
        /// satırına da yazar (komutlariYaz null ise düğme yok).
        /// </summary>
        public static void Hakkinda(string surum, string ortam, Action komutlariYaz)
        {
            Hazirla();
            using (var f = new KoyuPencere("Hakkında", 780, 680, Boya.Simge("bilgi", KoyuRenk.Yesil, 20)))
            {
                var alt = f.Alt;
                int bh = S(34), by = (alt.Height - bh) / 2;
                var kapat = new KoyuDugme("Kapat", DugmeTuru.Birincil) { DialogResult = DialogResult.OK };
                kapat.SetBounds(alt.Width - S(16) - S(110), by, S(110), bh);
                alt.Controls.Add(kapat);
                f.AcceptButton = kapat;
                f.CancelButton = kapat;
                if (komutlariYaz != null)
                {
                    var yazDugmesi = new KoyuDugme("Komut satırına yaz", DugmeTuru.Ikincil, Boya.Simge("bilgi", KoyuRenk.Ikincil, 16));
                    yazDugmesi.SetBounds(kapat.Left - S(10) - S(180), by, S(180), bh);
                    yazDugmesi.Click += (s, e) => komutlariYaz();
                    alt.Controls.Add(yazDugmesi);
                }
                int icSon = f.IcerikSonu - 16;
                var bilgi = Marka.Hakkinda;

                Koy(f, new LogoKarti(), 16, 58, 260, 200);
                var ad = Etiket(f, Marka.Ad, 296, 58, 460, KoyuYazi.Iri, KoyuRenk.Yazi);
                ad.Height = S(38);
                Etiket(f, "AutoCAD eklentisi · Sürüm " + surum, 296, 104, 460, KoyuYazi.Kalin, KoyuRenk.Yazi);
                if (!string.IsNullOrEmpty(ortam)) Etiket(f, ortam, 296, 128, 460, KoyuYazi.Kucuk, KoyuRenk.Ikincil);
                var slogan = Aciklama(f, bilgi.Metin("slogan", Marka.Aciklama), 296, 156, 460, 44);
                slogan.ForeColor = KoyuRenk.Yazi;
                slogan.Font = KoyuYazi.Govde;
                Aciklama(f, "Desteklenen sürümler: AutoCAD 2016–2024 ve AutoCAD 2025 ve sonrası (AutoCAD tabanlı ürünler dahil; " +
                            "AutoCAD LT desteklenmez). Sorun olursa hata ayrıntısı %TEMP%\\SebekeHakedis_hata.txt dosyasına yazılır; " +
                            "SH_DOKUM destek için teknik döküm kaydeder.", 296, 202, 460, 56);

                var sekme = Koy(f, new Sekmeler(), 16, 272, 748, 34);
                int sy = 316, sh = icSon - 316;

                // Hakkında sekmesi: amaç paragrafları ve yapabildikler (kaydırmalı)
                var govde = new Panel { BackColor = KoyuRenk.Kart, AutoScroll = true };
                var kart = Koy(f, new Kart(), 16, sy, 748, sh);
                Koy(kart, govde, 1, 1, 746, sh - 2);
                Yerel.KoyuKaydirma(govde);
                int y = 14, w = 690;
                Func<string, Font, Color, int> yaz = (metin, yazi, renk) =>
                {
                    int h = TextRenderer.MeasureText(metin, yazi, new Size(S(w), int.MaxValue), TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix).Height + S(2);
                    var l = new Label { Text = metin, UseMnemonic = false, BackColor = Color.Transparent, ForeColor = renk, Font = yazi, AutoSize = false };
                    l.SetBounds(S(18), S(y), S(w), h);
                    govde.Controls.Add(l);
                    return (int)Math.Ceiling(h / (double)S(1));
                };
                Etiket(govde, "Amaç", 18, y, 300, KoyuYazi.Kalin, KoyuRenk.Yesil);
                y += 26;
                foreach (var x in bilgi.Dizi("amac") ?? new List<object>()) y += yaz(Convert.ToString(x, CultureInfo.InvariantCulture), KoyuYazi.Govde, KoyuRenk.Yazi) + 8;
                y += 10;
                Etiket(govde, "Neler yapar?", 18, y, 300, KoyuYazi.Kalin, KoyuRenk.Yesil);
                y += 26;
                foreach (var x in bilgi.Dizi("yapabildikler") ?? new List<object>())
                {
                    var g1 = x as Cekirdek.JsonNesne;
                    if (g1 == null) continue;
                    string yer = g1.Metin("yer");
                    string ek = yer == "telefon" ? "  ·  telefon" : yer == "autocad" ? "  ·  AutoCAD" : "";
                    Etiket(govde, g1.Metin("baslik") + ek, 18, y, 600, KoyuYazi.Kalin, KoyuRenk.Yazi);
                    y += 24;
                    foreach (var m in g1.Dizi("maddeler") ?? new List<object>()) y += yaz("•  " + Convert.ToString(m, CultureInfo.InvariantCulture), KoyuYazi.Kucuk, KoyuRenk.Soluk) + 4;
                    y += 10;
                }
                sekme.Ekle("Hakkında", kart);

                // Komutlar sekmesi
                var g = new DataGridView
                {
                    AllowUserToAddRows = false,
                    AllowUserToDeleteRows = false,
                    ReadOnly = true,
                    SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                    MultiSelect = false,
                    AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                    ColumnHeadersVisible = true,
                };
                KoyuTablo.Uygula(g);
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Komut", FillWeight = 30 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Ne yapar", FillWeight = 100 });
                foreach (DataGridViewColumn c in g.Columns) c.SortMode = DataGridViewColumnSortMode.NotSortable;
                string grup = null;
                foreach (var k in KomutRehberi.Liste)
                {
                    if (k[0] != grup)
                    {
                        grup = k[0];
                        int gr = g.Rows.Add(grup, "");
                        var row = g.Rows[gr];
                        row.DefaultCellStyle.BackColor = KoyuRenk.Kart;
                        row.DefaultCellStyle.SelectionBackColor = KoyuRenk.Kart;
                        row.DefaultCellStyle.ForeColor = KoyuRenk.Yesil;
                        row.DefaultCellStyle.SelectionForeColor = KoyuRenk.Yesil;
                        row.DefaultCellStyle.Font = KoyuYazi.Kalin;
                    }
                    g.Rows.Add(k[1], k[2]);
                }
                g.Columns[0].DefaultCellStyle.Font = KoyuYazi.Kalin;
                var tablo = Koy(f, new Cerceve(g), 16, sy, 748, sh);
                sekme.Ekle("Komutlar", tablo);
                f.Shown += (s, e) => { if (g.Rows.Count > 0) g.ClearSelection(); };
                Goster(f);
            }
        }

        // ================= Kanal =================

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
                string zeminSecili = onceki != null ? onceki.Zemin : a.KanalZemin;
                var zemin = new ZeminSecici(f, 16, 224, 240, false, string.IsNullOrEmpty(zeminSecili) ? KanalZemini.Toprak : zeminSecili, o.Katalog);

                // Sağ: ölçüler (şeritte girilmişse oradan), hızlı seçim, durum, hakediş
                HizliSecim.Yukle();
                double ilkAlt = onceki != null ? onceki.Alt : HizliSecim.KanalAlt > 0 ? HizliSecim.KanalAlt : a.KanalAlt;
                double ilkUst = onceki != null ? onceki.Ust : HizliSecim.KanalUst > 0 ? HizliSecim.KanalUst : a.KanalUst;
                double ilkDer = onceki != null ? onceki.Derinlik : HizliSecim.KanalDerinlik > 0 ? HizliSecim.KanalDerinlik : a.KanalDerinlik;
                Etiket(f, "Alt genişlik (cm)", 272, 56);
                var altG = Koy(f, new SayiKutusu(0, 1000, D(ilkAlt), 0, 5), 272, 76, 136, 30);
                Etiket(f, "Üst genişlik (cm)", 420, 56);
                var ust = Koy(f, new SayiKutusu(0, 1000, D(ilkUst), 0, 5), 420, 76, 136, 30);
                Etiket(f, "Derinlik (cm)", 568, 56);
                var der = Koy(f, new SayiKutusu(0, 1000, D(ilkDer), 0, 5), 568, 76, 136, 30);
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

                Func<string> zeminDegeri = () => zemin.Tanim ?? "";
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
                zemin.Degisti += () => ozetYaz();
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
                    if (zeminDegeri().Trim().Length == 0) { Uyar("Kanal cinsini (zemin) seçin."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(o.KilitMesaji((int)hak.Value)); return; }
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
                    alt.Ozet.Text = "Çizilecek: Yatay sondaj · " + (k != null ? k.Gorunen : "tip seçin") + " · " + durum.Secili + " · " + (int)hak.Value + ". hakediş";
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
                    if (o.Kilitli((int)hak.Value)) { Uyar(o.KilitMesaji((int)hak.Value)); return; }
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
                Aciklama(f, "Raporun PROJE sütununa proje kodu yazılır; grup kodu raporda bölgeleri gruplar. " +
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
        /// Eksik malzeme sorgusu (AutoCAD raporundaki DETAY): hangi elemanlarda hangi ara malzeme aranacak; süzgeç değiştikçe
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
                        case 2: e.Value = MalzemeYazimi.Duzelt(an.Tanim); break;
                        case 3: e.Value = an.Durum; break;
                        case 4: e.Value = r.Malzeme != null ? MalzemeYazimi.Duzelt(r.Malzeme.Tanim) + "  ·  " + Bicim(r.Malzeme.Miktar) + " " + BirimAdi(r.Malzeme.Birim) : "yok"; break;
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

        // ================= Proje özeti =================

        /// <summary>Proje özeti penceresinde görünen liste (Excel'e aktarılırken): seçili proje ve süzgeçler.</summary>
        public sealed class ProjeOzetiGorunumu
        {
            public ProjeOzeti.ProjeSatiri Proje;
            public int Hakedis;
            public string Durum = "", Ara = "";
            /// <summary>0: malzeme listesi, 1: kanal listesi.</summary>
            public int Sekme;
            /// <summary>"Çizime tablo olarak koy" ile kapandı: kanal listesi (görünen proje ve hakedişle) çizime konacak.</summary>
            public bool KanalTablosu;
        }

        /// <summary>
        /// Proje özeti: solda projeler (bölgeler), sağda seçilen projenin malzeme listesi ya da kanal listesi (sekme);
        /// hakediş, durum ve aramayla süzülür. "Excel'e aktar" listeleri yazar (excel), pencere açık kalır. Kanal listesi
        /// sekmesindeki "Çizime tablo olarak koy" pencereyi kapatır (KanalTablosu). Dönen değer: son görünüm.
        /// </summary>
        public static ProjeOzetiGorunumu ProjeOzetiGoster(ProjeOzeti oz, Action<ProjeOzetiGorunumu> excel)
        {
            Hazirla();
            var gorunum = new ProjeOzetiGorunumu { Proje = oz.Projeler.Count > 0 ? oz.Projeler[0] : null };
            using (var w = new KoyuPencere("Proje özeti", 1040, 680, Boya.Simge("ozet", KoyuRenk.Yesil, 20)))
            {
                // Altbilgi: solda Excel'e aktar, sağda Kapat
                var kapat = new KoyuDugme("Kapat") { DialogResult = DialogResult.Cancel };
                int bh = S(34), by = (w.Alt.Height - bh) / 2;
                kapat.SetBounds(w.Alt.Width - S(16) - S(104), by, S(104), bh);
                var excelDugme = new KoyuDugme("Excel'e aktar", DugmeTuru.Birincil, Boya.Simge("excel", Color.White, 16));
                excelDugme.SetBounds(S(16), by, S(150), bh);
                w.Alt.Controls.Add(excelDugme);
                w.Alt.Controls.Add(kapat);
                var tabloDugme = new KoyuDugme("Çizime tablo olarak koy", DugmeTuru.Ikincil, Boya.Simge("kanal", KoyuRenk.Ikincil, 16)) { Name = "kanalTablosu" };
                tabloDugme.SetBounds(kapat.Left - S(10) - S(210), by, S(210), bh);
                tabloDugme.Visible = false;
                w.Alt.Controls.Add(tabloDugme);
                var excelBilgi = Etiket(w.Alt, "Proje listesi, görünen malzeme listesi ve kanal listesi yazılır.", 182, 0, 420, KoyuYazi.Kucuk, KoyuRenk.Soluk);
                excelBilgi.Top = (w.Alt.Height - excelBilgi.Height) / 2;
                w.CancelButton = kapat;

                // Sol: projeler
                Etiket(w, "Projeler", 16, 56, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var liste = new IkiSatirListe();
                var simgeTumu = Boya.Simge("ozet", KoyuRenk.Yesil, 18);
                var simgeProje = Boya.Simge("bolge", KoyuRenk.Ikincil, 18);
                liste.Baslik = x => ((ProjeOzeti.ProjeSatiri)x).GorunenAd;
                liste.Alt = x =>
                {
                    var s = (ProjeOzeti.ProjeSatiri)x;
                    if (s.Tumu) return (oz.Projeler.Count - 1).ToString("N0", Tr) + " proje · " + s.Malzeme.ToString("N0", Tr) + " malzeme";
                    if (s.Ad.Length == 0) return "Bölgeye bağlı olmayan nesneler";
                    return (s.Kod.Length > 0 ? s.Kod : "Proje kodu yok") + " · " + s.Malzeme.ToString("N0", Tr) + " malzeme";
                };
                liste.Simge = x => ((ProjeOzeti.ProjeSatiri)x).Tumu ? simgeTumu : simgeProje;
                foreach (var pr in oz.Projeler) liste.Items.Add(pr);
                Koy(w, new Cerceve(liste), 16, 80, 300, 524);

                // Sağ: başlık, süzgeçler, malzeme listesi
                var baslik = Etiket(w, "", 332, 54, 692, KoyuYazi.Baslik, KoyuRenk.Yazi);
                var altBaslik = Etiket(w, "", 332, 80, 692, KoyuYazi.Kucuk, KoyuRenk.Soluk);
                var sekme = Koy(w, new Sekmeler(), 332, 102, 692, 34);
                Etiket(w, "Hakediş", 332, 152);
                var hak = Koy(w, new KoyuAcilir(), 392, 146, 124);
                hak.Items.Add(Hepsi);
                foreach (var h in oz.Hakedisler) hak.Items.Add(h + ". hakediş");
                hak.SelectedIndex = 0;
                Etiket(w, "Durum", 532, 152);
                var durum = Koy(w, new KoyuAcilir(), 584, 146, 124);
                durum.Items.Add(Hepsi);
                foreach (var d in oz.Durumlar) durum.Items.Add(d);
                durum.SelectedIndex = 0;
                var ara = Koy(w, new MetinKutusu("", "Cins, malzeme ya da kanal ara", Boya.Simge("ara", KoyuRenk.Soluk, 16)), 724, 144, 300, 32);

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
                string[] basliklar = { "Hak.", "Durum", "Cins", "Malzeme", "Miktar", "Rapor miktarı", "Tutar (TL)" };
                float[] agirlik = { 44, 66, 176, 176, 84, 100, 80 };
                for (int i = 0; i < basliklar.Length; i++)
                {
                    var c = new DataGridViewTextBoxColumn { HeaderText = basliklar[i], FillWeight = agirlik[i], SortMode = DataGridViewColumnSortMode.NotSortable };
                    if (i >= 4) c.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                    g.Columns.Add(c);
                }
                var malzemeSayfasi = Koy(w, new Cerceve(g), 332, 186, 692, 386);
                var toplam = Etiket(w, "", 332, 582, 692, KoyuYazi.Govde, KoyuRenk.Ikincil);

                // Kanal listesi (proje bazında): kanal satırları, "Tüm projeler"de her projenin altında toplamı
                var kg = new DataGridView
                {
                    VirtualMode = true,
                    ReadOnly = true,
                    AllowUserToAddRows = false,
                    AllowUserToDeleteRows = false,
                    SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                    MultiSelect = false,
                    AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                    Name = "kanalListesi",
                };
                KoyuTablo.Uygula(kg);
                string[] kBasliklar = { "Proje", "Baş – bit", "Kablo", "Cins", "Kaplama", "Ölçü (cm)", "Uzunluk (m)", "Hacim (m³)", "Durum", "Hak." };
                float[] kAgirlik = { 160, 90, 40, 40, 110, 50, 10, 10, 10, 10 };
                // Sütun başlıkları kesilmesin: her sütun en az başlığı (Ölçü sütunu "40/40 × 100" yazısı) kadar geniş;
                // artan genişlik çoğunlukla Proje ve Kaplama'ya gider.
                var baslikYazisi = kg.ColumnHeadersDefaultCellStyle.Font ?? kg.Font;
                var hucreYazisi = kg.DefaultCellStyle.Font ?? kg.Font;
                int pay = Olcu.S(14);
                for (int i = 0; i < kBasliklar.Length; i++)
                {
                    var c = new DataGridViewTextBoxColumn { HeaderText = kBasliklar[i], FillWeight = kAgirlik[i], SortMode = DataGridViewColumnSortMode.NotSortable };
                    if (i == 6 || i == 7 || i == 9) c.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                    int en = i == 0 ? Olcu.S(80)
                        : Math.Max(TextRenderer.MeasureText(kBasliklar[i], baslikYazisi).Width, i == 5 ? TextRenderer.MeasureText("00/00 × 000", hucreYazisi).Width : 0) + pay;
                    c.MinimumWidth = Math.Max(Olcu.S(36), en);
                    kg.Columns.Add(c);
                }
                var kanalSayfasi = Koy(w, new Cerceve(kg), 332, 186, 692, 386);
                sekme.Ekle("Malzeme listesi", malzemeSayfasi);
                sekme.Ekle("Kanal listesi", kanalSayfasi);
                var kGorunen = new List<object>();
                kg.CellValueNeeded += (s, e) =>
                {
                    if (e.RowIndex < 0 || e.RowIndex >= kGorunen.Count) return;
                    var t = kGorunen[e.RowIndex] as KanalListesi.Toplam;
                    if (t != null)
                    {
                        switch (e.ColumnIndex)
                        {
                            case 0: e.Value = t.Tumu ? "GENEL TOPLAM" : t.GorunenAd + " toplamı"; break;
                            case 1: e.Value = t.Adet.ToString("N0", Tr) + " kanal"; break;
                            case 6: e.Value = KanalTablosu.Sayi(t.Uzunluk, 2); break;
                            case 7: e.Value = KanalTablosu.Sayi(t.Hacim, 3); break;
                        }
                        return;
                    }
                    var r = (KanalListesi.Satir)kGorunen[e.RowIndex];
                    var h = KanalTablosu.Hucreler(r);
                    e.Value = e.ColumnIndex == 0 ? (r.Proje.Length == 0 ? ProjeOzeti.ProjesizAdi : r.Proje) : h[e.ColumnIndex - 1];
                };
                kg.CellFormatting += (s, e) =>
                {
                    if (e.RowIndex >= 0 && e.RowIndex < kGorunen.Count && kGorunen[e.RowIndex] is KanalListesi.Toplam)
                    {
                        e.CellStyle.Font = KoyuYazi.Kalin;
                        e.CellStyle.ForeColor = KoyuRenk.Yazi;
                    }
                };

                var gorunen = new List<DurumTespit.OzetSatiri>();
                g.CellValueNeeded += (s, e) =>
                {
                    if (e.RowIndex < 0 || e.RowIndex >= gorunen.Count) return;
                    var r = gorunen[e.RowIndex];
                    string[] birim = (r.Birim ?? "").Split('/');
                    string giris = birim.Length > 0 ? birim[0] : "", rapor = birim.Length > 1 ? birim[1] : giris;
                    switch (e.ColumnIndex)
                    {
                        case 0: e.Value = r.Hakedis; break;
                        case 1: e.Value = r.Durum; break;
                        case 2: e.Value = r.Cins; break;
                        case 3: e.Value = MalzemeYazimi.Duzelt(r.Tip ?? ""); break;
                        case 4: e.Value = (Bicim(r.Miktar) + " " + giris).Trim(); break;
                        case 5: e.Value = (Bicim(r.Toplam) + " " + rapor).Trim(); break;
                        case 6: e.Value = r.Tutar != 0 ? r.Tutar.ToString("N2", Tr) : ""; break;
                    }
                };

                Func<ProjeOzetiGorunumu> oku = () => new ProjeOzetiGorunumu
                {
                    Proje = liste.SelectedItem as ProjeOzeti.ProjeSatiri ?? (oz.Projeler.Count > 0 ? oz.Projeler[0] : null),
                    Hakedis = hak.SelectedIndex > 0 ? oz.Hakedisler[hak.SelectedIndex - 1] : 0,
                    Durum = durum.SelectedIndex > 0 ? oz.Durumlar[durum.SelectedIndex - 1] : "",
                    Ara = (ara.Text ?? "").Trim(),
                    Sekme = sekme.Secili,
                };
                // Kanal listesi: hakediş çekirdekte, durum ve arama burada süzülür; proje toplamları görünen satırlardan
                Action<ProjeOzetiGorunumu> kanallariYaz = v =>
                {
                    var kl = oz.KanalListesi(v.Proje, v.Hakedis);
                    string a = DetaySorgu.Sade(v.Ara);
                    var satirlar = kl.Satirlar.FindAll(r => (string.IsNullOrEmpty(v.Durum) || r.Durum == v.Durum) &&
                        (a.Length == 0 || DetaySorgu.Sade(r.Zemin + " " + r.Numara + " " + r.Kablolar + " " + r.Cins + " " + r.Kaplama + " " + r.Proje).IndexOf(a, StringComparison.Ordinal) >= 0));
                    var l = new List<object>();
                    var genel = new KanalListesi.Toplam { Tumu = true };
                    KanalListesi.Toplam son = null;
                    bool tumu = v.Proje == null || v.Proje.Tumu;
                    foreach (var r in satirlar)
                    {
                        if (son == null || son.Proje != r.Proje)
                        {
                            if (son != null && tumu) l.Add(son);
                            son = new KanalListesi.Toplam { Proje = r.Proje, ProjeKodu = r.ProjeKodu };
                        }
                        l.Add(r);
                        son.Adet++; son.Uzunluk += r.Uzunluk; son.Hacim += r.Hacim;
                        genel.Adet++; genel.Uzunluk += r.Uzunluk; genel.Hacim += r.Hacim;
                    }
                    if (son != null && tumu) l.Add(son);
                    if (satirlar.Count > 0) l.Add(genel);
                    kGorunen = l;
                    kg.Columns[0].Visible = tumu;
                    kg.RowCount = 0;
                    kg.RowCount = l.Count;
                    kg.Invalidate();
                    string suzgec = ProjeOzeti.SuzgecYazisi(v.Hakedis, v.Durum, v.Ara);
                    toplam.Text = genel.Adet.ToString("N0", Tr) + " kanal · " + KanalTablosu.Sayi(genel.Uzunluk, 2) + " m · " + KanalTablosu.Sayi(genel.Hacim, 3) + " m³" +
                                  (suzgec.Length > 0 ? "   (süzgeç: " + suzgec + ")" : "");
                };
                Action yenile = () =>
                {
                    var v = oku();
                    gorunum = v;
                    var p = v.Proje;
                    if (p == null) return;
                    baslik.Text = p.GorunenAd;
                    var bilgi = new List<string>();
                    if (!p.Tumu && p.Kod.Length > 0) bilgi.Add("Proje kodu " + p.Kod);
                    if (p.Tumu) bilgi.Add(oz.CizimAdi);
                    bilgi.Add(p.Eleman.ToString("N0", Tr) + " eleman · " + p.Hat.ToString("N0", Tr) + " hat · " + p.Kanal.ToString("N0", Tr) + " kanal · " + p.Sondaj.ToString("N0", Tr) + " sondaj");
                    altBaslik.Text = string.Join("   ·   ", bilgi.ToArray());
                    tabloDugme.Visible = v.Sekme == 1;
                    if (v.Sekme == 1) { kanallariYaz(v); return; }
                    List<DurumTespit.OzetSatiri> l;
                    try { l = oz.Malzemeler(p, v.Hakedis, v.Durum, v.Ara); }
                    catch { l = new List<DurumTespit.OzetSatiri>(); }
                    gorunen = l;
                    g.RowCount = 0;
                    g.RowCount = l.Count;
                    g.Invalidate();
                    double tutar = 0;
                    foreach (var r in l) tutar += r.Tutar;
                    string suzgec = ProjeOzeti.SuzgecYazisi(v.Hakedis, v.Durum, v.Ara);
                    toplam.Text = l.Count.ToString("N0", Tr) + " malzeme satırı" + (tutar != 0 ? " · toplam " + SayiCoz.Temiz(tutar, 2).ToString("N2", Tr) + " TL" : "") +
                                  (suzgec.Length > 0 ? "   (süzgeç: " + suzgec + ")" : "");
                };
                var zamanlayici = new Timer { Interval = 250 };
                zamanlayici.Tick += (s, e) => { zamanlayici.Stop(); yenile(); };
                liste.SelectedIndexChanged += (s, e) => yenile();
                sekme.Degisti += () => yenile();
                hak.SelectedIndexChanged += (s, e) => yenile();
                durum.SelectedIndexChanged += (s, e) => yenile();
                ara.Kutu.TextChanged += (s, e) => { zamanlayici.Stop(); zamanlayici.Start(); };
                w.FormClosed += (s, e) => { zamanlayici.Stop(); zamanlayici.Dispose(); };
                if (liste.Items.Count > 0) liste.SelectedIndex = 0;
                w.Shown += (s, e) => { yenile(); liste.Focus(); };

                excelDugme.Click += (s, e) =>
                {
                    zamanlayici.Stop();
                    yenile();
                    try { excel?.Invoke(gorunum); }
                    catch (Exception ex) { Uyar("Excel dosyası yazılamadı: " + ex.Message); }
                };
                tabloDugme.Click += (s, e) =>
                {
                    zamanlayici.Stop();
                    yenile();
                    if (kGorunen.Count == 0) { Uyar("Bu süzgeçte kanal yok."); return; }
                    gorunum.KanalTablosu = true;
                    w.DialogResult = DialogResult.OK;
                };
                Goster(w);
                return gorunum;
            }
        }

        // ================= CBS ve harita =================

        /// <summary>
        /// Çizimin koordinat dilimini (3° TM dilim orta meridyeni) sorar: Google Earth, CBS (MIF) ve harita altlığı için
        /// gerekir. Seçilen dilim çağıran tarafından çizimin ayarlarına kaydedilir. Vazgeçilirse 0.
        /// </summary>
        public static int DomSec(int dom, string neden)
        {
            Hazirla();
            using (var f = new KoyuPencere("Koordinat dilimi", 560, 330, Boya.Simge("kml", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(f, "Devam", false);
                Aciklama(f, (string.IsNullOrEmpty(neden) ? "" : neden + " için ") + "çizim koordinatlarının hangi 3° dilimde olduğunu seçin " +
                            "(ITRF96, dilim orta meridyeni). Seçim çizimin ayarlarına kaydedilir; bir daha sorulmaz.", 16, 58, 528, 54);
                var kap = Koy(f, new Panel { BackColor = Color.Transparent }, 16, 118, 528, 64);
                var secimler = new List<KoyuSecim>();
                for (int i = 0; i < Turler.Domlar.Length; i++)
                {
                    int m = Turler.Domlar[i];
                    var r = Koy(kap, new KoyuSecim(m.ToString(CultureInfo.InvariantCulture) + "°") { Tag = m }, (i % 4) * 130, (i / 4) * 30);
                    r.Checked = dom == m;
                    secimler.Add(r);
                }
                Aciklama(f, "Örnek: Elazığ, Malatya, Erzincan 39° · Ankara 33° · İstanbul 30°. Telefondaki projeyle aynı olmalı.", 16, 190, 528, 48);
                alt.Tamam.Click += (s, e) =>
                {
                    if (!secimler.Exists(r => r.Checked)) { Uyar("Dilimi seçin."); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return 0;
                var sec = secimler.Find(r => r.Checked);
                return sec != null ? (int)sec.Tag : 0;
            }
        }

        /// <summary>
        /// Harita altlığı: sağlayıcı (anahtarsız / anahtarlı / özel), anahtar, alan ve ayrıntı. Ayar yerinde güncellenir
        /// (anahtarlar yalnız bu bilgisayarda saklanır). Vazgeçilirse false.
        /// </summary>
        public static bool HaritaAltligiSec(AltlikAyari a)
        {
            Hazirla();
            using (var f = new KoyuPencere("Harita altlığı", 880, 620, Boya.Simge("altlik", KoyuRenk.MaviAcik, 20)))
            {
                var alt = AltKur(f, "Altlığı getir", false, 140);

                // Sol: sağlayıcılar (gruplu)
                Etiket(f, "Harita", 16, 56, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var liste = new IkiSatirListe();
                liste.Baslik = x => ((AltlikSaglayici)x).Ad;
                liste.Alt = x =>
                {
                    var s = (AltlikSaglayici)x;
                    if (s.Tur == "ozel") return "adresi siz girersiniz";
                    if (s.Anahtar.Length == 0) return "anahtarsız";
                    return (a.Anahtar(s.Anahtar).Length > 0 ? "anahtar girildi" : "anahtar gerekir") + " · " + AnahtarAdi(s.Anahtar);
                };
                liste.Simge = x => Boya.Simge(((AltlikSaglayici)x).Uydu ? "altlik" : "konum", KoyuRenk.Ikincil, 18);
                foreach (var g in new[] { new[] { "ucretsiz", "Anahtarsız" }, new[] { "anahtarli", "Anahtarlı (kendi anahtarınızla)" }, new[] { "ozel", "Özel" } })
                {
                    liste.Items.Add(new ListeBasligi(g[1]));
                    foreach (var s in HaritaAltligi.Saglayicilar) if (s.Grup == g[0]) liste.Items.Add(s);
                }
                Koy(f, new Cerceve(liste), 16, 80, 330, 464);

                // Sağ: seçilen sağlayıcı, anahtar, alan, ayrıntı
                const int X = 362, W = 502;
                var ad = Etiket(f, "", X, 54, W, KoyuYazi.Baslik, KoyuRenk.Yazi);
                var not = Aciklama(f, "", X, 80, W, 54);
                var kosul = new LinkLabel { AutoSize = false, BackColor = Color.Transparent, LinkColor = KoyuRenk.MaviAcik, ActiveLinkColor = KoyuRenk.Yesil, Font = KoyuYazi.Kucuk, LinkBehavior = LinkBehavior.HoverUnderline };
                Koy(f, kosul, X, 136, W, 20);
                kosul.LinkClicked += (s, e) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(kosul.Tag as string) { UseShellExecute = true }); } catch { } };
                var anahtarEtiket = Etiket(f, "Anahtar", X, 168);
                var anahtar = Koy(f, new MetinKutusu(""), X, 188, W - 92, 30);
                var goster = Koy(f, new KoyuOnay("Göster"), X + W - 80, 194);
                anahtar.Kutu.UseSystemPasswordChar = true;
                goster.CheckedChanged += (s, e) => anahtar.Kutu.UseSystemPasswordChar = !goster.Checked;
                var anahtarNot = Aciklama(f, "Anahtar yalnız bu bilgisayarda saklanır; çizime ve proje dosyalarına yazılmaz.", X, 222, W, 20);

                Etiket(f, "Alan", X, 252, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var alanlar = new[]
                {
                    Koy(f, new KoyuSecim("Şebekenin bulunduğu alan"), X, 274),
                    Koy(f, new KoyuSecim("Ekranda görünen alan"), X + 220, 274),
                    Koy(f, new KoyuSecim("Pencereyle seç"), X, 302),
                };
                alanlar[Math.Max(0, Math.Min(2, a.Alan))].Checked = true;
                Etiket(f, "Ayrıntı", X, 336, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var kalite = Koy(f, new Panel { BackColor = Color.Transparent }, X, 358, W, 28);
                var kaliteler = new[]
                {
                    Koy(kalite, new KoyuSecim("Düşük (≈1 m, hızlı)"), 0, 0),
                    Koy(kalite, new KoyuSecim("Normal (≈0,5 m)"), 170, 0),
                    Koy(kalite, new KoyuSecim("Yüksek (≈0,25 m)"), 320, 0),
                };
                kaliteler[Math.Max(0, Math.Min(2, a.Kalite))].Checked = true;
                var eskiler = Koy(f, new KoyuOnay("Önceki altlıkları kaldır (ALTLIK katmanındaki resimler)"), X, 398);
                eskiler.Checked = a.EskileriSil;
                Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, "Altlık çizime resim olarak konur: ALTLIK katmanı, nesnelerin altında. Resim çizimin yanındaki " +
                    "\"Altlik\" klasörüne kaydedilir (çizim henüz kaydedilmediyse Belgeler\\Altlik). Alan büyükse ayrıntı " +
                    "kendiliğinden düşürülür (en çok 4096 piksel). " +
                    "İndirme sırasında Esc ile vazgeçilir."), X, 434, W, 110);

                // Sağlayıcı değişince: ad, not, koşul, anahtar kutusu
                AltlikSaglayici secili = null;
                Action anahtarSakla = () =>
                {
                    if (secili != null && secili.Anahtar.Length > 0) a.Anahtarlar[secili.Anahtar] = anahtar.Text.Trim();
                };
                Action goster_ = () =>
                {
                    anahtarSakla();
                    secili = liste.SelectedItem as AltlikSaglayici;
                    if (secili == null) return;
                    ad.Text = secili.Ad;
                    not.Text = secili.Not;
                    kosul.Text = string.IsNullOrEmpty(secili.Kosul) ? "" : "Kullanım koşulları: " + secili.Kosul;
                    kosul.Tag = secili.Kosul;
                    bool ister = secili.Anahtar.Length > 0;
                    anahtarEtiket.Visible = anahtar.Visible = goster.Visible = anahtarNot.Visible = ister;
                    anahtarEtiket.Text = secili.Tur == "ozel" ? "Karo adresi (XYZ)" : AnahtarAdi(secili.Anahtar) + " anahtarı";
                    anahtar.Ipucu = secili.Tur == "ozel" ? "https://sunucu/{z}/{x}/{y}.png" : "anahtarı yapıştırın";
                    anahtar.Kutu.UseSystemPasswordChar = secili.Tur != "ozel" && !goster.Checked;
                    goster.Visible = ister && secili.Tur != "ozel";
                    anahtar.Text = ister ? a.Anahtar(secili.Anahtar) : "";
                    alt.Tamam.Enabled = true;
                };
                liste.SelectedIndexChanged += (s, e) => goster_();
                anahtar.Kutu.TextChanged += (s, e) => { if (secili != null && secili.Anahtar.Length > 0) { a.Anahtarlar[secili.Anahtar] = anahtar.Text.Trim(); liste.Invalidate(); } };
                int ilk = -1;
                for (int i = 0; i < liste.Items.Count; i++)
                    if (liste.Items[i] is AltlikSaglayici s && s.Id == a.Saglayici) ilk = i;
                liste.SelectedIndex = ilk >= 0 ? ilk : liste.IlkOge();

                alt.Tamam.Click += (s, e) =>
                {
                    anahtarSakla();
                    if (secili == null) { Uyar("Bir harita seçin."); return; }
                    string k = a.Anahtar(secili.Anahtar);
                    if (secili.Tur == "ozel")
                    {
                        if (!(k.StartsWith("http", StringComparison.OrdinalIgnoreCase) && (k.Contains("{q}") || (k.Contains("{z}") && k.Contains("{x}") && k.Contains("{y}")))))
                        { Uyar("Karo adresini {z}, {x}, {y} yerleriyle yazın (ör. https://sunucu/{z}/{x}/{y}.png)."); return; }
                    }
                    else if (secili.Anahtar.Length > 0 && k.Length == 0) { Uyar(secili.Ad + " için " + AnahtarAdi(secili.Anahtar) + " anahtarını girin."); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return false;
                a.Saglayici = secili.Id;
                a.Alan = Array.FindIndex(alanlar, r => r.Checked);
                a.Kalite = Array.FindIndex(kaliteler, r => r.Checked);
                a.EskileriSil = eskiler.Checked;
                return true;
            }
        }

        private static string AnahtarAdi(string anahtar)
        {
            switch (anahtar)
            {
                case "google": return "Google";
                case "bing": return "Bing Maps";
                case "azure": return "Azure Maps";
                case "esri": return "ArcGIS";
                case "yandex": return "Yandex";
                case "maptiler": return "MapTiler";
                case "ozel": return "Özel";
                default: return anahtar ?? "";
            }
        }

        /// <summary>CBS'den alınan nesnenin bilgileri (MID satırı): sütun ve değer.</summary>
        public static void CbsBilgisi(string dosya, List<string[]> satirlar)
        {
            Hazirla();
            // Başlık 42 + dosya satırı + tablo başlığı 34 + satırlar (30) + altbilgi 60
            int boy = Math.Min(640, 204 + Math.Max(4, satirlar.Count) * 30);
            using (var w = new KoyuPencere("CBS bilgisi", 620, boy, Boya.Simge("cbs_al", KoyuRenk.Yesil, 20)))
            {
                var kapat = new KoyuDugme("Kapat") { DialogResult = DialogResult.Cancel };
                int bh = S(34), by = (w.Alt.Height - bh) / 2;
                kapat.SetBounds(w.Alt.Width - S(16) - S(104), by, S(104), bh);
                w.Alt.Controls.Add(kapat);
                w.CancelButton = kapat;
                w.AcceptButton = kapat;
                Etiket(w, string.IsNullOrEmpty(dosya) ? "CBS nesnesi" : "Dosya: " + dosya, 16, 54, 588, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var g = new DataGridView
                {
                    ReadOnly = true,
                    AllowUserToAddRows = false,
                    AllowUserToDeleteRows = false,
                    SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                    MultiSelect = true,
                    AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                    ClipboardCopyMode = DataGridViewClipboardCopyMode.EnableWithoutHeaderText,
                };
                KoyuTablo.Uygula(g);
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Sütun", FillWeight = 35, SortMode = DataGridViewColumnSortMode.NotSortable });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Değer", FillWeight = 65, SortMode = DataGridViewColumnSortMode.NotSortable });
                foreach (var s in satirlar) g.Rows.Add(s[0], s.Length > 1 ? s[1] : "");
                int ust = 80, en = 588, yuk = (int)Math.Round(w.IcerikSonu - ust - 12.0);
                Koy(w, new Cerceve(g), 16, ust, en, Math.Max(80, yuk));
                Goster(w);
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
        /// Hakediş onayı (AutoCAD'in onay penceresi gibi): her hakediş için sırayla Kontrol → Hakediş → GIS. Sonraki aşama
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
            int son = Math.Max(HakedisOnayi.SabitOnaySayisi, o.Hakedis);
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
                // Onay mekanizması açıksa (telefondaki kullanıcılar ve roller) her aşama kendi rolünde; yetki dışı kutular kapalı
                bool[] yetki = { Yetki.AsamaYetkisi(o.OnayAcik, o.Uye, HakedisOnayi.Kontrol), Yetki.AsamaYetkisi(o.OnayAcik, o.Uye, HakedisOnayi.Hakedis), Yetki.AsamaYetkisi(o.OnayAcik, o.Uye, HakedisOnayi.Gis) };
                if (o.OnayAcik)
                {
                    var izinli = new List<string>();
                    if (yetki[0]) izinli.Add("Kontrol");
                    if (yetki[1]) izinli.Add("Hakediş");
                    if (yetki[2]) izinli.Add("GIS");
                    Etiket(w, (o.Uye != null ? "Oturum: " + o.Uye + " · " : "Oturum açık değil · ") +
                              (izinli.Count > 0 ? "işaretleyebileceğiniz aşamalar: " + string.Join(", ", izinli.ToArray()) + ". Soluk kutular başka rolün yetkisinde." : "bu rol onay aşaması işaretleyemez."),
                           16, 130, 648, KoyuYazi.Kucuk, KoyuRenk.Yazi);
                }
                else Etiket(w, "Her hakediş için sırayla: Kontrol → Hakediş → GIS. Sonraki aşama işaretlenince öncekiler de işaretlenir.", 16, 130, 648, KoyuYazi.Kucuk);
                var kapali = o.Proje.OnayAyari != null && o.OnayAcik ? o.Proje.OnayAyari.KapaliHakedisler : new SortedSet<int>();
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
                    Etiket(satir, (c0 > 0 ? c0.ToString("N0", Tr) + " nesne" : "—") + (kapali.Contains(n) ? " · yazmaya kapalı" : ""), 200, 7, 0, null, kapali.Contains(n) ? KoyuRenk.Sari : KoyuRenk.Ikincil);
                    int b = HakedisOnayi.Bitler(onaylar, n);
                    var k = Koy(satir, new KoyuOnay { Isaret = true, AutoSize = false, Checked = (b & HakedisOnayi.Kontrol) != 0, Enabled = yetki[0] }, merkez[0] - 26, 4, 52, 24);
                    var h = Koy(satir, new KoyuOnay { Isaret = true, AutoSize = false, Checked = (b & HakedisOnayi.Hakedis) != 0, Enabled = yetki[1] }, merkez[1] - 26, 4, 52, 24);
                    var g = Koy(satir, new KoyuOnay { Isaret = true, AutoSize = false, Checked = (b & HakedisOnayi.Gis) != 0, Enabled = yetki[2] }, merkez[2] - 26, 4, 52, 24);
                    kilit.Visible = h.Checked;
                    kutular[n] = new[] { k, h, g };
                    kilitler[n] = kilit;
                    int satirNo = n;
                    EventHandler sira = (s, e) =>
                    {
                        if (ayarlaniyor) return;
                        ayarlaniyor = true;
                        bool[] once = { k.Checked, h.Checked, g.Checked };
                        if (s == g && g.Checked) { h.Checked = true; k.Checked = true; }
                        else if (s == h && h.Checked) k.Checked = true;
                        else if (s == k && !k.Checked) { h.Checked = false; g.Checked = false; }
                        else if (s == h && !h.Checked) g.Checked = false;
                        // Sıra kuralı yetkisi olmayan aşamayı değiştirecekse tıklama geri alınır (ör. Kontrol onayı yokken Hakediş)
                        var kutu = new[] { k, h, g };
                        for (int i = 0; i < 3; i++)
                            if (!kutu[i].Enabled && kutu[i] != s && kutu[i].Checked != once[i])
                            {
                                string[] adlar = { "Kontrol", "Hakediş", "GIS" };
                                string[] islem = { Roller.KontrolOnayi, Roller.HakedisOnayi_, Roller.GisOnayi };
                                for (int j = 0; j < 3; j++) if (kutu[j] != s) kutu[j].Checked = once[j];
                                var tik = (KoyuOnay)s;
                                tik.Checked = !tik.Checked;
                                ayarlaniyor = false;
                                Uyar(satirNo + ". hakediş: sıra kuralı " + adlar[i] + " aşamasını da değiştirir; " + adlar[i] + " onayını " + Roller.Kimler(islem[i]) + " verir ya da kaldırır.");
                                return;
                            }
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

        // ================= Kullanıcılar, oturum, hakediş yetkisi =================

        /// <summary>Kullanıcı formundan dönen değerler (şifre boşsa null: değişmez).</summary>
        internal sealed class KullaniciGirdisi
        {
            public string Ad = "", Rol = "", Sifre;
            public bool Etkin = true;
        }

        private static MetinKutusu SifreKutusu(string ipucu)
        {
            var m = new MetinKutusu("", ipucu, Boya.Simge("anahtar", KoyuRenk.Ikincil));
            m.Kutu.UseSystemPasswordChar = true;
            m.Kutu.MaxLength = 8;
            m.Kutu.KeyPress += (s, e) => { if (!char.IsControl(e.KeyChar) && (e.KeyChar < '0' || e.KeyChar > '9')) e.Handled = true; };
            return m;
        }

        /// <summary>
        /// Oturum aç: kullanıcı ve şifre. dene(id, şifre) hata metni döner (yanlış şifre, bekleme) ya da null; hata pencerede
        /// gösterilir, pencere açık kalır. Açılırsa true.
        /// </summary>
        public static bool OturumAc(IList<Kullanici> liste, Func<string, string, string> dene, string onSecili = null, IWin32Window sahip = null)
        {
            Hazirla();
            var etkin = new List<Kullanici>();
            if (liste != null) foreach (var k in liste) if (k.Etkin) etkin.Add(k);
            if (etkin.Count == 0) { Uyar("Bu çizimde etkin kullanıcı yok."); return false; }
            using (var w = new KoyuPencere("Oturum aç", 420, 300, Boya.Simge("anahtar", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(w, "Giriş", false);
                Etiket(w, "Kullanıcı", 16, 58, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var kim = Koy(w, new KoyuAcilir(), 16, 80, 388, 30);
                foreach (var k in etkin) kim.Items.Add(k);
                int sec = etkin.FindIndex(k => k.Id == onSecili);
                kim.SelectedIndex = sec >= 0 ? sec : 0;
                Etiket(w, "Şifre (" + Roller.SifreEnAz + "–" + Roller.SifreEnCok + " rakam)", 16, 122, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var sifre = Koy(w, SifreKutusu("••••"), 16, 144, 388, 30);
                var hata = Koy(w, new BilgiCubugu(BilgiTuru.Hata, "") { Visible = false }, 16, 184, 388, 44);
                alt.Tamam.Click += (s, e) =>
                {
                    var k = kim.SelectedItem as Kullanici;
                    string h = k == null ? "Kullanıcı seçin." : dene(k.Id, sifre.Text);
                    if (h == null) { w.DialogResult = DialogResult.OK; return; }
                    hata.Text = h;
                    hata.Visible = true;
                    sifre.Text = "";
                    sifre.Kutu.Focus();
                };
                w.Shown += (s, e) => sifre.Kutu.Focus();
                return Goster(w, sahip) == DialogResult.OK;
            }
        }

        /// <summary>
        /// Kullanıcı ekle / düzenle. k null: yeni. ilk: ilk kullanıcı (rol Yönetici, değiştirilemez). yonetici: rol ve
        /// durum değiştirilebilir (değilse yalnız şifre). Döner: girilenler ya da null (vazgeç).
        /// </summary>
        public static KullaniciGirdisi KullaniciFormu(Kullanici k, bool ilk, bool yonetici, IWin32Window sahip = null)
        {
            Hazirla();
            string baslik = k == null ? (ilk ? "İlk yöneticiyi tanımla" : "Kullanıcı ekle") : yonetici ? "Kullanıcıyı düzenle" : "Şifremi değiştir";
            using (var w = new KoyuPencere(baslik, 460, ilk ? 478 : 426, Boya.Simge("kullanici", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(w, "Kaydet", false);
                int y = 56;
                if (ilk)
                {
                    Koy(w, new BilgiCubugu(BilgiTuru.Bilgi, "İlk kullanıcı Yönetici olur ve bu çizimde onay mekanizması açılır. Şifreyi unutmayın: başka Yönetici yoksa şifre geri alınamaz."), 16, y, 428, 58);
                    y += 68;
                }
                Etiket(w, "Ad soyad", 16, y, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var ad = Koy(w, new MetinKutusu(k != null ? k.Ad : ""), 16, y + 22, 428, 30);
                ad.Enabled = yonetici || k == null;
                y += 62;
                Etiket(w, "Rol", 16, y, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var rol = Koy(w, new KoyuAcilir(), 16, y + 22, 428, 30);
                foreach (var r in Roller.Liste) rol.Items.Add(r);
                string rolId = ilk ? Roller.Yonetici : k != null ? k.Rol : "saha";
                rol.SelectedIndex = Math.Max(0, new List<Rol>(Roller.Liste).FindIndex(r => r.Id == rolId));
                rol.Enabled = yonetici && !ilk;
                var gorev = Aciklama(w, "", 16, y + 56, 428, 34);
                Action gorevYaz = () => { var r = rol.SelectedItem as Rol; gorev.Text = r != null ? r.Gorev : ""; };
                rol.SelectedIndexChanged += (s, e) => gorevYaz();
                gorevYaz();
                y += 96;
                Etiket(w, k == null ? "Şifre (" + Roller.SifreEnAz + "–" + Roller.SifreEnCok + " rakam)" : "Yeni şifre (boş = aynı)", 16, y, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var s1 = Koy(w, SifreKutusu("••••"), 16, y + 22, 208, 30);
                Etiket(w, "Şifre tekrar", 236, y, 0, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var s2 = Koy(w, SifreKutusu("••••"), 236, y + 22, 208, 30);
                y += 62;
                var etkin = Koy(w, new KoyuOnay("Etkin (oturum açabilir)") { Checked = k == null || k.Etkin, AutoSize = false }, 16, y, 300, 24);
                etkin.Visible = k != null && yonetici;
                var hata = Koy(w, new BilgiCubugu(BilgiTuru.Hata, "") { Visible = false }, 16, y + (etkin.Visible ? 30 : 0), 428, 40);
                alt.Tamam.Click += (s, e) =>
                {
                    string h = null;
                    if (ad.Text.Trim().Length == 0) h = "Ad gerekli.";
                    else if ((k == null || s1.Text.Length > 0) && !Yetki.SifreGecerli(s1.Text)) h = "Şifre " + Roller.SifreEnAz + "–" + Roller.SifreEnCok + " rakam olmalı.";
                    else if (s1.Text != s2.Text) h = "Şifreler aynı değil.";
                    if (h != null) { hata.Text = h; hata.Visible = true; return; }
                    w.DialogResult = DialogResult.OK;
                };
                if (Goster(w, sahip) != DialogResult.OK) return null;
                return new KullaniciGirdisi { Ad = ad.Text.Trim(), Rol = ((Rol)rol.SelectedItem).Id, Sifre = s1.Text.Length > 0 ? s1.Text : null, Etkin = etkin.Checked };
            }
        }

        /// <summary>
        /// Kullanıcılar ve yetkiler (SH_KULLANICILAR): telefondaki kullanıcılar ve roller, oturum, hakediş yetkisi
        /// (yazmaya kapalı hakedişler). d çalışma kopyasıdır (kurallar KullaniciDuzeni'nde); Kaydet'e basılırsa true.
        /// oturumAc(liste, id, şifre): hata metni ya da null; oturumKapat: oturumu hemen kapatır.
        /// </summary>
        public static bool Kullanicilar(OrtamVerisi o, KullaniciDuzeni d, Func<IList<Kullanici>, string, string, string> oturumAc, Action oturumKapat = null)
        {
            Hazirla();
            int son = Math.Max(HakedisOnayi.SabitOnaySayisi, o.Hakedis);
            foreach (var n in d.Kapali) son = Math.Max(son, n);
            const int en = 700, satirBoy = 34;
            int gorunen = 7;
            int kartBoy = 46 + gorunen * satirBoy + 44;
            int yetkiBoy = 40 + ((son + 11) / 12) * 34 + 30;
            int boy = 56 + 66 + 10 + 64 + 12 + kartBoy + 12 + yetkiBoy + 16 + 60;
            using (var w = new KoyuPencere("Kullanıcılar ve yetkiler", en, boy, Boya.Simge("kullanicilar", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(w, "Kaydet", false);
                Koy(w, new BilgiCubugu(BilgiTuru.Bilgi, "Telefondaki kullanıcılar ve roller AutoCAD'de de geçerlidir; proje dosyasıyla (Telefona Gönder / Telefondan Al) iki yönde taşınır. " +
                                                         "Onay mekanizması açıkken Kontrol onayını " + Roller.Kimler(Roller.KontrolOnayi) + ", Hakediş ve GIS onayını " + Roller.Kimler(Roller.HakedisOnayi_) + " verir; hakediş yetkisini " + Roller.Kimler(Roller.HakedisYetkisi) + " belirler."), 16, 56, en - 32, 66);
                int y = 132;
                // Oturum
                var oturum = Koy(w, new Kart(), 16, y, en - 32, 64);
                Resim(oturum, Boya.Simge("kullanici", KoyuRenk.Ikincil, 22), 14, 16, 30, 30);
                var kimAd = Etiket(oturum, "", 54, 12, 360, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var kimRol = Etiket(oturum, "", 54, 34, 360, KoyuYazi.Kucuk);
                var acDugme = Koy(oturum, new KoyuDugme("Oturum aç", DugmeTuru.Birincil), en - 32 - 14 - 120, 15, 120, 34);
                var kapatDugme = Koy(oturum, new KoyuDugme("Oturumu kapat"), en - 32 - 14 - 130, 15, 130, 34);
                var sifremDugme = Koy(oturum, new KoyuDugme("Şifremi değiştir", DugmeTuru.Hayalet), en - 32 - 14 - 130 - 10 - 140, 15, 140, 34);
                y += 64 + 12;
                // Kullanıcılar
                var kart = Koy(w, new Kart("Kullanıcılar"), 16, y, en - 32, kartBoy);
                var ekleDugme = Koy(kart, new KoyuDugme("Kullanıcı ekle", DugmeTuru.Birincil, Boya.Simge("arti", Color.White, 14)), en - 32 - 14 - 170, 8, 170, 30);
                var govde = new Panel { BackColor = KoyuRenk.Kart, AutoScroll = true };
                Koy(kart, govde, 1, 44, en - 34, gorunen * satirBoy + 2);
                Yerel.KoyuKaydirma(govde);
                var kapaDugme = Koy(kart, new KoyuDugme("Onay mekanizmasını kapat", DugmeTuru.Hayalet), 12, kartBoy - 40, 220, 30);
                var durumYazi = Etiket(kart, "", 244, kartBoy - 34, en - 32 - 260, KoyuYazi.Kucuk);
                y += kartBoy + 12;
                // Hakediş yetkisi
                var yetkiKart = Koy(w, new Kart("Hakediş yetkisi · yazmaya kapalı hakedişler"), 16, y, en - 32, yetkiBoy);
                var kutular = new Dictionary<int, KoyuOnay>();
                for (int n = 1; n <= son; n++)
                {
                    int sira = (n - 1) % 12, satir = (n - 1) / 12;
                    var kutu = Koy(yetkiKart, new KoyuOnay(n + ".") { AutoSize = false, Checked = d.Kapali.Contains(n) }, 14 + sira * 54, 38 + satir * 34, 52, 26);
                    kutular[n] = kutu;
                }
                var yetkiYazi = Etiket(yetkiKart, "", 14, yetkiBoy - 30, en - 60, KoyuYazi.Kucuk);
                bool ciziliyor = false;

                Action ciz = null;
                Action<Kullanici> duzenle = k =>
                {
                    var g = KullaniciFormu(k, false, d.Yonetebilir, w);
                    if (g == null) return;
                    string h = d.Guncelle(k.Id, d.Yonetebilir ? g.Ad : null, d.Yonetebilir ? g.Rol : null, g.Sifre, d.Yonetebilir ? (bool?)g.Etkin : null);
                    if (h != null) Uyar(h);
                    ciz();
                };
                ciz = () =>
                {
                    ciziliyor = true;
                    bool acik = d.OnayAcik;
                    if (!acik) { kimAd.Text = "Onay mekanizması kapalı"; kimRol.Text = "Kullanıcı tanımlı değil: onaylar ve hakediş yetkisi herkese açık (eski davranış). Açmak için ilk Yöneticiyi tanımlayın."; }
                    else if (d.Uye != null) { kimAd.Text = d.Uye.Ad; kimRol.Text = Roller.Ad(d.Uye.Rol); kimRol.ForeColor = KoyuRenk.Hex(Roller.Bul(d.Uye.Rol)?.Renk ?? "", KoyuRenk.Ikincil); }
                    else { kimAd.Text = "Oturum açık değil"; kimRol.Text = "Onay vermek, kullanıcı eklemek ya da hakediş yetkisini değiştirmek için oturum açın."; kimRol.ForeColor = KoyuRenk.Ikincil; }
                    if (!acik || d.Uye == null) kimRol.ForeColor = KoyuRenk.Ikincil;
                    acDugme.Visible = acik && d.Uye == null;
                    kapatDugme.Visible = d.Uye != null;
                    sifremDugme.Visible = d.Uye != null;
                    ekleDugme.Text = acik ? "Kullanıcı ekle" : "İlk yöneticiyi tanımla";
                    ekleDugme.Enabled = d.Yonetebilir;
                    kapaDugme.Visible = acik;
                    kapaDugme.Enabled = d.Yonetici;
                    govde.SuspendLayout();
                    govde.Controls.Clear();
                    var liste = new List<Kullanici>(d.Liste);
                    liste.Sort((a, b) => a.Etkin != b.Etkin ? (a.Etkin ? -1 : 1) : string.Compare(a.Ad, b.Ad, StringComparison.CurrentCulture));
                    int i = 0;
                    foreach (var k in liste)
                    {
                        var ku = k;
                        bool ben = d.Uye != null && d.Uye.Id == k.Id;
                        var sp = new SatirPaneli { Vurgulu = ben, BackColor = ben ? KoyuRenk.Secili : KoyuRenk.Kart };
                        Koy(govde, sp, 0, i * satirBoy, en - 34 - 20, satirBoy);
                        Etiket(sp, k.Ad + (ben ? "  (siz)" : ""), 14, 8, 250, KoyuYazi.Kalin, k.Etkin ? KoyuRenk.Yazi : KoyuRenk.Soluk);
                        Etiket(sp, Roller.Ad(k.Rol), 270, 8, 170, KoyuYazi.Govde, k.Etkin ? KoyuRenk.Hex(Roller.Bul(k.Rol)?.Renk ?? "", KoyuRenk.Ikincil) : KoyuRenk.Soluk);
                        Etiket(sp, k.Etkin ? "Etkin" : "Pasif", 448, 8, 70, KoyuYazi.Kucuk, k.Etkin ? KoyuRenk.Ikincil : KoyuRenk.Soluk);
                        if (d.Yonetebilir && d.OnayAcik)
                        {
                            var b = Koy(sp, new KoyuDugme("Düzenle"), en - 34 - 20 - 100, 3, 92, 28);
                            b.Click += (s, e) => duzenle(ku);
                        }
                        i++;
                    }
                    if (liste.Count == 0) Etiket(govde, "Kullanıcı yok.", 14, 10, 300, KoyuYazi.Govde, KoyuRenk.Soluk);
                    govde.ResumeLayout();
                    int etkinSay = d.Liste.FindAll(x => x.Etkin).Count;
                    durumYazi.Text = acik ? etkinSay + " etkin, " + (d.Liste.Count - etkinSay) + " pasif kullanıcı" : (d.Liste.Count > 0 ? d.Liste.Count + " eski kullanıcı kaydı saklanıyor (pasif)." : "");
                    foreach (var kv in kutular) { kv.Value.Checked = d.Kapali.Contains(kv.Key); kv.Value.Enabled = d.YetkiVerebilir; }
                    var kapali = new List<string>();
                    foreach (var n in d.Kapali) kapali.Add(n + ".");
                    yetkiYazi.Text = (kapali.Count > 0 ? "Yazmaya kapalı: " + string.Join(", ", kapali.ToArray()) + " hakediş — bu hakedişlere yeni nesne çizilemez, satırları değiştirilemez." : "Bütün hakedişler yazmaya açık.") +
                                     (d.YetkiVerebilir ? "" : acik ? " Yalnız Yönetici değiştirebilir." : " Önce ilk Yöneticiyi tanımlayın.");
                    ciziliyor = false;
                };
                foreach (var kv in kutular)
                {
                    int n = kv.Key;
                    var kutu = kv.Value;
                    kutu.CheckedChanged += (s, e) =>
                    {
                        if (ciziliyor) return;
                        string h = d.KapaliYap(n, kutu.Checked);
                        if (h != null) Uyar(h);
                        ciz();
                    };
                }
                acDugme.Click += (s, e) =>
                {
                    if (OturumAc(d.Liste, (id, sifre) =>
                    {
                        string h = oturumAc(d.Liste, id, sifre);
                        if (h == null) d.Uye = d.Liste.Find(x => x.Id == id);
                        return h;
                    }, null, w)) ciz();
                };
                kapatDugme.Click += (s, e) => { d.Uye = null; oturumKapat?.Invoke(); ciz(); };
                sifremDugme.Click += (s, e) =>
                {
                    var g = KullaniciFormu(d.Uye, false, false, w);
                    if (g == null || g.Sifre == null) return;
                    string h = d.Guncelle(d.Uye.Id, null, null, g.Sifre, null);
                    if (h != null) Uyar(h); else Bilgi("Şifre değişti (Kaydet ile çizime yazılır).");
                    ciz();
                };
                ekleDugme.Click += (s, e) =>
                {
                    bool ilk = !d.OnayAcik;
                    var g = KullaniciFormu(null, ilk, true, w);
                    if (g == null) return;
                    Kullanici yeni;
                    string h = d.Ekle(g.Ad, ilk ? Roller.Yonetici : g.Rol, g.Sifre, out yeni);
                    if (h != null) Uyar(h);
                    ciz();
                };
                kapaDugme.Click += (s, e) =>
                {
                    if (!Onay("Onay mekanizması kapatılsın mı?\n\nBütün kullanıcılar pasif olur (liste saklanır); onaylar ve hakediş yetkisi herkese açılır.", false)) return;
                    string h = d.MekanizmayiKapat();
                    if (h != null) Uyar(h);
                    ciz();
                };
                alt.Tamam.Click += (s, e) => w.DialogResult = DialogResult.OK;
                ciz();
                return Goster(w) == DialogResult.OK;
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
                    alt.Ozet.Text = it != null ? "Seçili: " + it.Gorunen + "  ·  " + AltYazi(k, it) : "Listeden bir malzeme seçin";
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

        // ================= Toplu malzeme =================

        /// <summary>
        /// Seçilen elemanlara (ör. 12 direk) aynı malzemeleri tek seferde ekler: soldaki katalogdan malzeme seçilip "Ekle"
        /// ile sağdaki listeye alınır, miktar ve durum düzenlenir. "Hafızadakiler" son elemanın malzemelerini getirir.
        /// Dönen satırlar her elemana ayrı kalem olarak eklenir; vazgeçilirse null.
        /// </summary>
        public static List<TopluMalzemeSatiri> TopluMalzeme(OrtamVerisi o, List<Eleman> elemanlar)
        {
            Hazirla();
            if (elemanlar == null || elemanlar.Count == 0) return null;
            // Seçimin özeti: tür → sayı; en çok olan tür malzeme listesini belirler
            var sayilar = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var e in elemanlar) { int c; sayilar.TryGetValue(e.Tur, out c); sayilar[e.Tur] = c + 1; }
            string anaTur = "";
            int enCok = 0;
            var parca = new List<string>();
            foreach (var kv in sayilar)
            {
                parca.Add(kv.Value + " " + Turler.ElemanAdi(kv.Key));
                if (kv.Value > enCok) { enCok = kv.Value; anaTur = kv.Key; }
            }
            var ornek = elemanlar.FindLast(x => x.Tur == anaTur) ?? elemanlar[elemanlar.Count - 1];
            using (var w = new KoyuPencere("Toplu malzeme — " + elemanlar.Count + " eleman", 980, 640, Boya.Simge("malzeme", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(w, "Malzemeleri ekle", true, 160);
                int icSon = w.IcerikSonu - 16;
                Etiket(w, "Seçilen: " + string.Join(", ", parca), 16, 54, 948, KoyuYazi.Kalin, KoyuRenk.Yazi);

                // Sol: katalog
                var ara = Koy(w, new MetinKutusu("", "Ara (tanım, cins, poz no…)", Boya.Simge("ara", KoyuRenk.Ikincil)), 16, 84, 300, 30);
                var cins = Koy(w, new KoyuAcilir(), 326, 84, 200);
                var katalogListesi = o.Katalog.Malzemeler(anaTur);
                var tl = new TipListesi(ara, o.Katalog);
                Koy(w, new Cerceve(tl.Liste), 16, 122, 510, icSon - 122 - 44);
                var cinsler = new List<string>();
                foreach (var it in katalogListesi) if (!cinsler.Contains(it.Cins)) cinsler.Add(it.Cins);
                CinsleriDoldur(cins, o.Katalog, cinsler, "");
                cins.SelectedIndexChanged += (s, e) => { tl.Cins = SeciliCins(cins); tl.Yenile(); };
                tl.Doldur(katalogListesi, HizliSecim.SonTipler("malzeme/" + anaTur, o.Katalog, katalogListesi, 8), null, "Son eklenenler", "Bütün malzemeler");
                var ekle = Koy(w, new KoyuDugme("Ekle", DugmeTuru.Birincil, Boya.Simge("arti", Color.White, 16)), 16, icSon - 36, 120, 34);
                Aciklama(w, "Malzemeye çift tıklamak da ekler.", 146, icSon - 28, 380, 20);

                // Sağ: eklenecekler
                Etiket(w, "Her elemana eklenecek malzemeler", 542, 84, 420, KoyuYazi.Kalin, KoyuRenk.Yazi);
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
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Malzeme", ReadOnly = true, FillWeight = 190 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Miktar", FillWeight = 55 });
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Birim", ReadOnly = true, FillWeight = 45 });
                var cDurum = new DataGridViewComboBoxColumn { HeaderText = "Durum", FillWeight = 85, FlatStyle = FlatStyle.Flat, DisplayStyle = DataGridViewComboBoxDisplayStyle.Nothing };
                const string ElemanaGore = "elemana göre";
                cDurum.Items.Add(ElemanaGore);
                foreach (var d in Turler.CizimDurumlari) cDurum.Items.Add(d);
                g.Columns.Add(cDurum);
                g.Columns[1].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                foreach (DataGridViewColumn c in g.Columns) c.SortMode = DataGridViewColumnSortMode.NotSortable;
                g.DataError += (s, e) => { e.ThrowException = false; };
                Koy(w, new Cerceve(g), 542, 108, 422, icSon - 108 - 44);
                var hafiza = Koy(w, new KoyuDugme("Hafızadakiler", DugmeTuru.Ikincil, Boya.Simge("malzeme", KoyuRenk.Ikincil, 16)), 542, icSon - 36, 150, 34);
                var sil = Koy(w, new KoyuDugme("Satırı sil", DugmeTuru.Ikincil, Boya.Simge("sil", KoyuRenk.Ikincil, 16)), 702, icSon - 36, 120, 34);
                Etiket(w, "Hakediş", 834, icSon - 28, 56);
                var hak = Koy(w, new SayiKutusu(1, 999, o.Hakedis), 890, icSon - 36, 74, 34);

                var satirlar = new List<TopluMalzemeSatiri>();
                Action ozetYaz = () =>
                {
                    alt.Ozet.Text = satirlar.Count == 0 ? "Soldan malzeme seçip Ekle'ye basın."
                        : elemanlar.Count + " elemanın her birine " + satirlar.Count + " malzeme eklenecek (" + (int)hak.Value + ". hakediş).";
                    alt.Ozet.Simge = Boya.Simge("malzeme", KoyuRenk.Ikincil, 16);
                    alt.Tamam.Enabled = satirlar.Count > 0 && !o.Kilitli((int)hak.Value);
                };
                Action<int, TopluMalzemeSatiri> satirYaz = (r, t) =>
                {
                    var row = g.Rows[r];
                    row.Cells[0].Value = MalzemeYazimi.Duzelt(t.Kalem.Tanim) + "  ·  " + o.Katalog.CinsAdi(t.Kalem.Cins);
                    row.Cells[1].Value = Bicim(t.Miktar);
                    string[] b = (t.Kalem.Birim ?? "").Split('/');
                    row.Cells[2].Value = b.Length > 0 ? b[0] : "";
                    row.Cells[3].Value = string.IsNullOrEmpty(t.Durum) ? ElemanaGore : t.Durum;
                    row.Tag = t;
                };
                Action<KatalogKalemi, double, string> satirEkle = (it, miktar, durumKodu) =>
                {
                    if (it == null) return;
                    var t = new TopluMalzemeSatiri { Kalem = it, Miktar = miktar, Durum = durumKodu ?? "" };
                    satirlar.Add(t);
                    int r = g.Rows.Add();
                    satirYaz(r, t);
                    g.ClearSelection();
                    g.Rows[r].Selected = true;
                    ozetYaz();
                };
                ekle.Click += (s, e) => satirEkle(tl.Secili, 1, "");
                tl.Secildi += () => satirEkle(tl.Secili, 1, "");
                hafiza.Click += (s, e) =>
                {
                    string kaynak;
                    var l = HizliSecim.Hafiza.Bul(ornek.Tur, ornek.Cins, ornek.Tip, out kaynak);
                    if (l == null || l.Count == 0) { Bilgi("Malzeme hafızasında " + Turler.ElemanAdi(ornek.Tur) + " için malzeme yok.\nBir elemanın malzemelerini düzenleyince hatırlanır."); return; }
                    foreach (var h in l)
                    {
                        var it = o.Katalog.Bul(h.Cins, h.Tanim);
                        if (it != null) satirEkle(it, h.Miktar, h.ElemanDurumunda ? "" : h.Durum);
                    }
                };
                sil.Click += (s, e) =>
                {
                    if (g.CurrentRow == null) return;
                    var t = g.CurrentRow.Tag as TopluMalzemeSatiri;
                    if (t != null) satirlar.Remove(t);
                    g.Rows.Remove(g.CurrentRow);
                    ozetYaz();
                };
                g.CellClick += (s, e) =>
                {
                    if (e.RowIndex < 0 || e.ColumnIndex < 0 || g.Columns[e.ColumnIndex].ReadOnly) return;
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
                    if (e.RowIndex < 0) return;
                    var t = g.Rows[e.RowIndex].Tag as TopluMalzemeSatiri;
                    if (t == null) return;
                    string deger = Convert.ToString(g.Rows[e.RowIndex].Cells[e.ColumnIndex].Value, CultureInfo.InvariantCulture) ?? "";
                    if (e.ColumnIndex == 1)
                    {
                        double m = SayiCoz.Coz(deger, double.NaN);
                        if (!double.IsNaN(m) && m > 0) t.Miktar = m;
                        g.Rows[e.RowIndex].Cells[1].Value = Bicim(t.Miktar);
                    }
                    else if (e.ColumnIndex == 3) t.Durum = deger == ElemanaGore ? "" : deger;
                };
                hak.ValueChanged += (s, e) => ozetYaz();
                ozetYaz();
                alt.Tamam.Click += (s, e) =>
                {
                    g.EndEdit();
                    if (satirlar.Count == 0) { Uyar("Soldan en az bir malzeme seçip Ekle'ye basın."); return; }
                    if (o.Kilitli((int)hak.Value)) { Uyar(o.KilitMesaji((int)hak.Value)); return; }
                    w.DialogResult = DialogResult.OK;
                };
                w.Shown += (s, e) => ara.Kutu.Focus();
                if (Goster(w) != DialogResult.OK) return null;
                foreach (var t in satirlar)
                {
                    t.Hakedis = (int)hak.Value;
                    HizliSecim.SonaEkle("malzeme/" + anaTur, t.Kalem);
                }
                return satirlar;
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
                Aciklama(genel, "Boş bırakılırsa çizimdeki katman adlarından bulunur (şu an: " + o.OnEk + ").", 216, 24, 400, 30);
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

                // Görünüm: simge ve yazı boyutları (telefon dosyasıyla da taşınır)
                var gorunum = sayfa();
                Etiket(gorunum, "Simge ve yazı boyutları", 0, 0, 0, KoyuYazi.Kalin);
                Aciklama(gorunum, "Yeni çizilenler bu ölçülerle çizilir. Kaydedince çizimde olanlara da uygulanması sorulur. Varsayılanlar telefonun çizimiyle aynıdır (1/1000 pafta).", 0, 22, 616, 34);
                Etiket(gorunum, "Simge büyüklüğü (kat)", 0, 62);
                var simge = Koy(gorunum, new SayiKutusu(0.1m, 20, D(a.SimgeOlcegi), 2, 0.1m) { Name = "simgeOlcegi" }, 0, 82, 140, 30);
                Etiket(gorunum, "Eleman yazısı: GIS no, tip (m)", 316, 62);
                var elemanYazi = Koy(gorunum, new SayiKutusu(0.05m, 50, D(a.ElemanYaziYuksekligi), 2, 0.1m) { Name = "elemanYaziYuksekligi" }, 316, 82, 140, 30);
                Etiket(gorunum, "Hat etiketi: kablo tipi (m)", 0, 122);
                var etiket = Koy(gorunum, new SayiKutusu(0.05m, 50, D(a.EtiketYuksekligi), 2, 0.1m) { Name = "etiketYuksekligi" }, 0, 142, 140, 30);
                Etiket(gorunum, "Metraj yazısı (m)", 316, 122);
                var metrajYazi = Koy(gorunum, new SayiKutusu(0.05m, 50, D(a.MetrajYuksekligi), 2, 0.1m) { Name = "metrajYuksekligi" }, 316, 142, 140, 30);
                var varsayilan = Koy(gorunum, new KoyuDugme("Varsayılana dön", DugmeTuru.Ikincil, Boya.Simge("gorunum", KoyuRenk.Ikincil, 16)) { Name = "boyutVarsayilan" }, 0, 186, 170, 32);
                Aciklama(gorunum, "Simge 1 kat · eleman yazısı 1,8 m · kablo tipi 1,8 m · metraj 1,44 m", 186, 192, 430, 20);
                varsayilan.Click += (s, e) =>
                {
                    simge.Value = 1;
                    elemanYazi.Value = D(CizimAyarlari.VarsayilanEtiket);
                    etiket.Value = D(CizimAyarlari.VarsayilanEtiket);
                    metrajYazi.Value = D(CizimAyarlari.VarsayilanMetraj);
                };
                Etiket(gorunum, "Direğe yakalama (m)", 0, 238);
                var yakala = Koy(gorunum, new SayiKutusu(0, 50, D(a.YakalamaMesafesi), 2, 0.5m), 0, 258, 140, 30);
                Aciklama(gorunum, "Hat ve kanal çizerken elemanın simgesinin üstüne ya da en az bu mesafeye tıklanınca hat elemanın ortasına oturur ve orada parçalanır. 0: yakalama kapalı.", 156, 256, 460, 40);

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
                var zemin = new ZeminSecici(metraj, 0, 296, 616, true, string.IsNullOrEmpty(a.KanalZemin) ? KanalZemini.Toprak : a.KanalZemin, o.Katalog);

                // Proje (teknik hesaplar ve raporlar için)
                var proje = sayfa();
                Etiket(proje, "Proje adı", 0, 0);
                var pAdi = Koy(proje, new MetinKutusu(a.ProjeAdi, "boş: çizim adı"), 0, 20, 300, 30);
                Etiket(proje, "Proje kodu", 316, 0);
                var pKod = Koy(proje, new MetinKutusu(a.ProjeKodu, ""), 316, 20, 300, 30);
                Etiket(proje, "Hesabı yapan (ad soyad)", 0, 62);
                var pYapan = Koy(proje, new MetinKutusu(a.Hazirlayan, ""), 0, 82, 300, 30);
                Etiket(proje, "Unvan", 316, 62);
                var pUnvan = Koy(proje, new MetinKutusu(a.Unvan, "ör. Elektrik Mühendisi"), 316, 82, 300, 30);
                Etiket(proje, "Firma", 0, 124);
                var pFirma = Koy(proje, new MetinKutusu(a.Firma, ""), 0, 144, 616, 30);
                Etiket(proje, "Buz yükü bölgesi (ENH mekanik hesapları)", 0, 188);
                var buzKap = Koy(proje, new Panel { BackColor = Color.Transparent }, 0, 210, 628, 34);
                var buzlar = new List<KoyuSecim>();
                string[] buzSecenek = { "", "1", "2", "3", "4", "5" };
                for (int i = 0; i < buzSecenek.Length; i++)
                {
                    var r = Koy(buzKap, new KoyuSecim(buzSecenek[i].Length == 0 ? "Bilinmiyor" : buzSecenek[i] + ". bölge") { Tag = buzSecenek[i] }, i * 104, 0);
                    r.Checked = (a.BuzBolgesi ?? "") == buzSecenek[i];
                    buzlar.Add(r);
                }
                if (!buzlar.Exists(r => r.Checked)) buzlar[0].Checked = true;
                Aciklama(proje, "Teknik hesaplar (ŞEBEKE-M ARAÇLAR sekmesi) bu bilgileri hesap sayfasına kendiliğinden yazar; boş olanlar hesap sayfasında sorulur.", 0, 252, 616, 40);

                sekme.Ekle("Genel", genel);
                sekme.Ekle("Proje", proje);
                sekme.Ekle("Tarife", tarife);
                sekme.Ekle("Görünüm", gorunum);
                sekme.Ekle("Metraj", metraj);
                alt.Tamam.Click += (s, e) => w.DialogResult = DialogResult.OK;
                if (Goster(w) != DialogResult.OK) return false;

                a.Karakteristik = kar.SelectedIndex > 0 ? karKodlari[kar.SelectedIndex - 1] : "";
                a.Koy = koy.Checked;
                a.KatmanOnEki = onEk.Text.Trim();
                a.GisOnEki = gisOnEki.Text.Trim();
                a.AktifHakedis = (int)hak.Value;
                var dom = domlar.Find(r => r.Checked);
                a.Dom = dom != null ? (int)dom.Tag : 0;
                a.EtiketYuksekligi = (double)etiket.Value;
                a.SimgeOlcegi = (double)simge.Value;
                a.ElemanYaziYuksekligi = (double)elemanYazi.Value;
                a.MetrajYuksekligi = (double)metrajYazi.Value;
                a.BoyutlariDuzelt();
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
                a.KanalZemin = zemin.Tanim.Trim().Length > 0 ? zemin.Tanim.Trim() : KanalZemini.Toprak;
                a.ProjeAdi = pAdi.Text.Trim();
                a.ProjeKodu = pKod.Text.Trim();
                a.Hazirlayan = pYapan.Text.Trim();
                a.Unvan = pUnvan.Text.Trim();
                a.Firma = pFirma.Text.Trim();
                var buz = buzlar.Find(r => r.Checked);
                a.BuzBolgesi = buz != null ? (string)buz.Tag : "";
                return true;
            }
        }

        // ================= CBS'den al: dosyaların eşleştirilmesi =================

        /// <summary>
        /// CBS'den (MIF / MID) alınacak dosyalar: her dosyanın ne olduğu (direk, trafo, SDK, pano, diğer eleman, hat, kanal,
        /// sondaj, bölge, GPS noktası, malzeme tablosu ya da yalnız altlık) ve sütunlarının hangi bilgi olduğu. Tanınan
        /// dosyalar hazır gelir (Şebeke-M'in dosyası birebir, başka CBS'nin dosyası adından ve sütun adlarından); kullanıcı
        /// değiştirebilir. Durumu yazılı olmayan nesnelerin durumu ve hakedişi de burada seçilir.
        /// </summary>
        public static bool CbsAl(OrtamVerisi o, List<CbsKaynagi> kaynaklar, CbsAlmaAyari ayar)
        {
            Hazirla();
            using (var f = new KoyuPencere("CBS'den al", 980, 640, Boya.Simge("cbs_al", KoyuRenk.Yesil, 20)))
            {
                var alt = AltKur(f, "Al");
                int icSon = f.IcerikSonu - 16;
                Etiket(f, "Dosyalar", 16, 56, 300, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var liste = new IkiSatirListe();
                Func<CbsKaynagi, string> geometriAdi = k =>
                {
                    switch (k.Geometri) { case "nokta": return "nokta"; case "cizgi": return "çizgi"; case "alan": return "alan"; default: return "haritada yeri yok"; }
                };
                liste.Baslik = x => ((CbsKaynagi)x).Ad;
                liste.Alt = x =>
                {
                    var k = (CbsKaynagi)x;
                    return (k.Veri != null ? k.Veri.Nesneler.Count : 0) + " " + geometriAdi(k) + " → " + CbsIceAktarim.SecenekAdi(k.Katman) + (k.SebekeM ? " · Şebeke-M" : "");
                };
                foreach (var k in kaynaklar) liste.Items.Add(k);
                Koy(f, new Cerceve(liste), 16, 80, 300, icSon - 80);

                Etiket(f, "Bu dosya ne?", 332, 56, 300, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var katman = Koy(f, new KoyuAcilir(), 332, 80, 330);
                foreach (var sc in CbsIceAktarim.Secenekler) katman.Items.Add(sc[1]);
                var bilgi = Koy(f, new BilgiCubugu(BilgiTuru.Bilgi, ""), 676, 76, 288, 52);
                Etiket(f, "Sütunlar: hangi bilgi dosyanın hangi sütununda", 332, 134, 600, KoyuYazi.Kalin, KoyuRenk.Yazi);
                var g = new DataGridView
                {
                    AllowUserToAddRows = false, AllowUserToDeleteRows = false, SelectionMode = DataGridViewSelectionMode.CellSelect, MultiSelect = false,
                    AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill, EditMode = DataGridViewEditMode.EditOnEnter,
                };
                KoyuTablo.Uygula(g);
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Bilgi", ReadOnly = true, FillWeight = 110 });
                var cSutun = new DataGridViewComboBoxColumn { HeaderText = "Dosyadaki sütun", FillWeight = 120, FlatStyle = FlatStyle.Flat, DisplayStyle = DataGridViewComboBoxDisplayStyle.ComboBox };
                g.Columns.Add(cSutun);
                g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "İlk nesnedeki değer", ReadOnly = true, FillWeight = 130 });
                foreach (DataGridViewColumn c in g.Columns) c.SortMode = DataGridViewColumnSortMode.NotSortable;
                g.DataError += (s, e) => { e.ThrowException = false; };
                Koy(f, new Cerceve(g), 332, 158, 632, icSon - 158 - 56);

                Etiket(f, "Durumu yazılı değilse", 332, icSon - 44, 160);
                var durum = Koy(f, new KoyuAcilir(), 496, icSon - 48, 150);
                foreach (var d in Turler.CizimDurumlari) durum.Items.Add(d);
                durum.SelectedIndex = Math.Max(0, Array.IndexOf(Turler.CizimDurumlari, ayar.VarsayilanDurum));
                Etiket(f, "Hakediş", 666, icSon - 44, 70);
                var hak = Koy(f, new SayiKutusu(1, 999, Math.Max(1, ayar.Hakedis)), 736, icSon - 48, 90, 32);
                const string Yok = "(yok)";

                CbsKaynagi secili = null;
                bool yukleniyor = false;
                Action ozetYaz = () =>
                {
                    int nesne = 0, altlik = 0;
                    foreach (var k in kaynaklar) if (k.Katman.Length == 0) altlik++; else nesne++;
                    alt.Ozet.Text = nesne + " dosya şebeke nesnesi olarak alınacak" + (altlik > 0 ? ", " + altlik + " dosya altlık olarak çizilecek" : "") + ".";
                    alt.Ozet.Simge = Boya.Simge("cbs_al", KoyuRenk.Ikincil, 16);
                };
                Action tabloyuDoldur = () =>
                {
                    yukleniyor = true;
                    g.Rows.Clear();
                    cSutun.Items.Clear();
                    cSutun.Items.Add(Yok);
                    if (secili != null && secili.Veri != null) foreach (var c in secili.Veri.Sutunlar) if (!cSutun.Items.Contains(c)) cSutun.Items.Add(c);
                    var ilk = secili != null && secili.Veri != null && secili.Veri.Nesneler.Count > 0 ? secili.Veri.Nesneler[0].Degerler : new string[0];
                    if (secili != null)
                        foreach (var a in CbsIceAktarim.Alanlar(secili.Katman))
                        {
                            int i = secili.Sutun(a[0]);
                            int r = g.Rows.Add();
                            g.Rows[r].Cells[0].Value = a[1];
                            g.Rows[r].Cells[1].Value = i >= 0 && i < secili.Veri.Sutunlar.Count ? secili.Veri.Sutunlar[i] : Yok;
                            g.Rows[r].Cells[2].Value = i >= 0 && i < ilk.Length ? ilk[i] : "";
                            g.Rows[r].Tag = a[0];
                        }
                    bool altlik = secili == null || secili.Katman.Length == 0;
                    g.Enabled = !altlik;
                    string geo = secili == null ? "" : geometriAdi(secili);
                    bilgi.Text = secili == null ? "" : altlik
                        ? "Altlık: nesneler CBS-" + secili.Ad + " katmanına çizilir; hakediş nesnesi olmaz."
                        : secili.SebekeM ? "Şebeke-M'in dosyası: sütunlar birebir eşlendi" + (secili.Katman == "MALZEME" ? "; satırlar nesnelerine bağlanır." : "; malzemeler tablosundan gelir.")
                        : "Başka CBS dosyası (" + geo + "): sütunları denetleyin. Tip ve iletken katalogda aranır.";
                    yukleniyor = false;
                };
                liste.SelectedIndexChanged += (s, e) =>
                {
                    secili = liste.SelectedItem as CbsKaynagi;
                    yukleniyor = true;
                    katman.SelectedIndex = secili == null ? -1 : Array.FindIndex(CbsIceAktarim.Secenekler, x => x[0] == secili.Katman);
                    yukleniyor = false;
                    tabloyuDoldur();
                };
                katman.SelectedIndexChanged += (s, e) =>
                {
                    if (yukleniyor || secili == null || katman.SelectedIndex < 0) return;
                    secili.Katman = CbsIceAktarim.Secenekler[katman.SelectedIndex][0];
                    CbsIceAktarim.SutunlariEsle(secili);
                    liste.Invalidate();
                    tabloyuDoldur();
                    ozetYaz();
                };
                g.CellValueChanged += (s, e) =>
                {
                    if (yukleniyor || secili == null || e.RowIndex < 0 || e.ColumnIndex != 1) return;
                    string alan = g.Rows[e.RowIndex].Tag as string, sutun = g.Rows[e.RowIndex].Cells[1].Value as string;
                    if (alan == null) return;
                    secili.Sutunlar[alan] = sutun == null || sutun == Yok ? -1 : secili.Veri.Sutunlar.IndexOf(sutun);
                    int i = secili.Sutun(alan);
                    var ilk = secili.Veri.Nesneler.Count > 0 ? secili.Veri.Nesneler[0].Degerler : new string[0];
                    g.Rows[e.RowIndex].Cells[2].Value = i >= 0 && i < ilk.Length ? ilk[i] : "";
                };
                g.CurrentCellDirtyStateChanged += (s, e) => { if (g.IsCurrentCellDirty) g.CommitEdit(DataGridViewDataErrorContexts.Commit); };
                if (liste.Items.Count > 0) liste.SelectedIndex = 0;
                ozetYaz();
                alt.Tamam.Click += (s, e) =>
                {
                    g.EndEdit();
                    if (o.Kilitli((int)hak.Value)) { Uyar(o.KilitMesaji((int)hak.Value)); return; }
                    f.DialogResult = DialogResult.OK;
                };
                if (Goster(f) != DialogResult.OK) return false;
                ayar.VarsayilanDurum = durum.SelectedIndex >= 0 ? Turler.CizimDurumlari[durum.SelectedIndex] : "MEVCUT";
                ayar.Hakedis = (int)hak.Value;
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
                cubuklar.Add(new BilgiCubugu(BilgiTuru.Bilgi, "Telefondaki hakediş onayları ve yetkiler çizime de yazılacak:" + listele(oz.Onaylar, 4)));
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
            using (var w = new KoyuPencere(oz.Baslik, en, boy, Boya.Simge(oz.Simge, KoyuRenk.MaviAcik, 20)))
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
            int eskiHatSatiri = hat != null ? Iletkenler.HatKalemleri(hat).Count : 0;
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
                ZeminSecici zemin = null;
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
                    Etiket(w, "Alt genişlik (cm)", 380, 56);
                    kAlt = Koy(w, new SayiKutusu(0, 1000, D(kanal.AltGenislik), 0, 5), 380, 76, 120, 30);
                    Etiket(w, "Üst genişlik (cm)", 516, 56);
                    kUst = Koy(w, new SayiKutusu(0, 1000, D(kanal.UstGenislik), 0, 5), 516, 76, 120, 30);
                    Etiket(w, "Derinlik (cm)", 652, 56);
                    kDer = Koy(w, new SayiKutusu(0, 1000, D(kanal.Derinlik), 0, 5), 652, 76, 120, 30);
                    zemin = new ZeminSecici(w, 16, 118, 928, true, kanal.Zemin, o.Katalog);
                    gy = 118 + zemin.Boy + 4;
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
                    row.Cells[1].Value = string.IsNullOrEmpty(k.Aciklama) ? MalzemeYazimi.Duzelt(k.Tanim) : MalzemeYazimi.Duzelt(k.Tanim) + "  (" + MalzemeYazimi.Duzelt(k.Aciklama) + ")";
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
                                if (h > 0 && o.Kilitli(h)) Uyar(o.KilitMesaji(h));
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
                    foreach (var c in new Control[] { gis, guc, gerilim, bas, bit, zemin?.Cins, zemin?.Kaplama, zemin?.Bariyer, zemin?.Trencher, kAlt, kUst, kDer, og, ag, ayd, rek })
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
                    if (o.Kilitli(o.Hakedis)) { Uyar(o.KilitMesaji(o.Hakedis)); return; }
                    var it = KatalogdanSec("Malzeme ekle — " + baslik, o.Katalog.Malzemeler(katalogNesnesi), w);
                    if (it == null) return;
                    string dur = nesneDurumu == "MEVCUT" || string.IsNullOrEmpty(nesneDurumu) ? "M" : nesneDurumu;
                    // Hatta iletken / kablo: hattın ayrı bir iletken satırı (HAT), miktarı güzergâh metrajı (çoklu iletken)
                    bool iletken = hat != null && it.Rol == "hat";
                    double miktar = 1;
                    if (iletken)
                    {
                        miktar = Iletkenler.GuzergahMetraji(hat);
                        if (miktar <= 0) miktar = o.Ayar.HatMetraji(hat.CizimUzunlugu, hat.Tur);
                    }
                    var k = Katalog.KalemYap(it, miktar, dur, o.Hakedis, false, iletken ? "HAT" : "MALZEME", o.YeniSira(), "", o.Ayar.Karakteristik, o.Ayar.Koy);
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
                    if (o.Kilitli(k.Hakedis)) { Uyar(o.KilitMesaji(k.Hakedis) + " Bu satır silinemez."); return; }
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
                if (hat != null)
                {
                    // Çoklu iletken: ana kesit telefondaki gibi birleşik yazım (etiket bütün iletkenleri gösterir)
                    var hk = Iletkenler.HatKalemleri(hat);
                    if (hk.Count > 1) hat.AnaKesit = Iletkenler.EtiketKesiti(hk);
                    else if (hk.Count == 1 && eskiHatSatiri > 1) hat.AnaKesit = hk[0].Tanim;
                }
                if (kanal != null)
                {
                    kanal.Kod = KanalKodu.Kod(og.Checked, ag.Checked, ayd.Checked, rek.Checked);
                    kanal.Zemin = zemin.Tanim.Trim();
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
