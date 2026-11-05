using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Şeritteki hızlı çizimin seçimi: kategori, etkin öğe (ör. AG Havai › AG Direk), öğe başına cins ve tip (hatlarda
    /// adet ve ikinci iletken), durum, demontaj türü, hakediş ve malzeme hafızası. Şerit yazar, SH_HIZLI komutu okur.
    /// Son seçimler kullanıcının ayar klasöründe saklanır (AutoCAD yeniden açılınca aynı kategori ve tipler gelir).
    /// </summary>
    internal static class HizliSecim
    {
        public static MenuKategorisi Kategori;
        public static MenuOgesi Oge;
        public static string Durum = "M";
        public static string DmDurum = "";
        /// <summary>0: çizimin aktif hakedişi.</summary>
        public static int Hakedis;
        /// <summary>Kanal öğelerinde kanaldaki kablolar (OG, AG, AYD, REK); boşsa öğenin kendi kablosu.</summary>
        public static string KanalKablolari = "";
        /// <summary>
        /// Yeni kanalın ölçüleri (cm; şeritten ya da son kanal penceresinden): alt genişlik, üst genişlik, derinlik.
        /// 0: çizimin ayarı (Çizim Ayarları › kanal varsayılanları) kullanılır.
        /// </summary>
        public static double KanalAlt, KanalUst, KanalDerinlik;
        /// <summary>Malzeme hafızası açık mı: yeni elemana aynı tür ve tipteki son elemanın malzemeleri kendiliğinden eklenir.</summary>
        public static bool HafizaAcik = true;

        /// <summary>Öğe kodu → seçili tipin anahtarı (cins|tanım).</summary>
        private static readonly Dictionary<string, string> _tip = new Dictionary<string, string>(StringComparer.Ordinal);
        /// <summary>Öğe kodu → şeritte seçili cins (tip listesi bu cinsin tipleri).</summary>
        private static readonly Dictionary<string, string> _cins = new Dictionary<string, string>(StringComparer.Ordinal);
        /// <summary>Hat öğesi → ana iletkenin adedi (ör. 3 adet ALPEK).</summary>
        private static readonly Dictionary<string, int> _adet = new Dictionary<string, int>(StringComparer.Ordinal);
        /// <summary>Hat öğesi → ikinci iletkenin anahtarı ("-": bilerek yok) ve adedi.</summary>
        private static readonly Dictionary<string, string> _ek = new Dictionary<string, string>(StringComparer.Ordinal);
        private static readonly Dictionary<string, int> _ekAdet = new Dictionary<string, int>(StringComparer.Ordinal);
        /// <summary>Öğe kodu → son kullanılan tipler (en yeni önde).</summary>
        private static readonly Dictionary<string, List<string>> _son = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        private const int SonSayisi = 8;
        /// <summary>Şeritteki tip listesinin en çok satır sayısı (uzun cinslerde kullanılanlar ve son seçilenler kalır).</summary>
        public const int ListeSiniri = 60;
        private static Katalog _katalog;
        private static MalzemeHafizasi _hafiza = new MalzemeHafizasi();
        private static bool _yuklendi;

        /// <summary>Seçim değişince (şeritteki kutuları yenilemek için).</summary>
        public static event Action Degisti;

        /// <summary>Gömülü katalog (çizimden bağımsız; şeritteki kısa tip listesi için).</summary>
        public static Katalog TemelKatalog => _katalog ?? (_katalog = Katalog.Oku(KatalogKaynagi.Json(), null));

        // ---------------- Tipler ----------------

        /// <summary>Öğenin cinsleri (menü süzgeci ya da türün cins grubu; katalog sırasıyla).</summary>
        public static List<string> Cinsler(MenuOgesi oge, Katalog k)
        {
            if (oge == null || k == null) return new List<string>();
            if (oge.Cinsler.Count > 0) return new List<string>(oge.Cinsler);
            switch (oge.Komut)
            {
                case "SH_ELEMAN": return k.ElemanCinsListesi(oge.Tur);
                case "SH_HAT": return k.HatCinsListesi(oge.Tur);
                case "SH_SONDAJ": return new List<string>(k.SondajCinsleri);
                case "SH_KANAL": return new List<string>(KanalZemini.Cinsler);
                default: return new List<string>();
            }
        }

        /// <summary>
        /// Tipin şeritteki cinsi: kanalda zeminin cinsi (toprak, tüvenan, mıcır, branşman, demontaj; tip listesi
        /// kaplamalardır), diğer öğelerde katalog cinsi.
        /// </summary>
        public static string TipCinsi(MenuOgesi oge, KatalogKalemi it)
        {
            if (it == null) return "";
            if (oge != null && oge.Komut == "SH_KANAL")
            {
                var z = KanalZemini.Coz(it.Tanim);
                return z != null ? z.Cins : it.Cins;
            }
            return it.Cins;
        }

        /// <summary>
        /// Öğenin tipleri (verilen katalogdan, öğenin tür ve cins süzgeciyle; cins cins, katalog sırasıyla). genis: hatlarda
        /// türün cinslerinden sonra diğer iletken ve kablolar da (arama penceresi için); değilse yalnız türün cinsleri.
        /// </summary>
        public static List<KatalogKalemi> Tipler(MenuOgesi oge, Katalog k, bool genis = false)
        {
            if (oge == null || k == null) return new List<KatalogKalemi>();
            IList<string> cinsler = oge.Cinsler.Count > 0 ? oge.Cinsler : null;
            switch (oge.Komut)
            {
                case "SH_ELEMAN": return k.AnaTipler(oge.Tur, cinsler ?? (genis ? null : k.ElemanCinsListesi(oge.Tur)));
                case "SH_HAT": return k.HatKesitleri(oge.Tur, cinsler ?? (genis ? null : k.HatCinsListesi(oge.Tur)));
                case "SH_SONDAJ": return k.SondajTipleri();
                case "SH_KANAL": return k.KanalZeminleri();
                default: return new List<KatalogKalemi>();
            }
        }

        /// <summary>
        /// Şeritteki tip listesi: seçili cinsin tipleri katalog (AutoCAD) sırasıyla — ALPEK'ler alt alta, çıplak iletkenler
        /// alt alta. Cinsin tipi çoksa (ör. 500 ENH beton direk) seçili tip, son kullanılanlar ve gerçek çizimlerde
        /// kullanılanlar kalır; sıra yine katalog sırasıdır. Bütün tipler için "Ara".
        /// </summary>
        public static List<KatalogKalemi> KisaListe(MenuOgesi oge)
        {
            var k = TemelKatalog;
            var hepsi = Tipler(oge, k);
            string cins = SeciliCins(oge, k);
            var l = string.IsNullOrEmpty(cins) ? hepsi : hepsi.FindAll(x => TipCinsi(oge, x) == cins);
            if (l.Count == 0) l = hepsi;
            return Kisalt(l, oge, k, ListeSiniri);
        }

        /// <summary>Uzun listeyi kısaltır: seçili, son kullanılan ve çok kullanılan tipler kalır; sıra katalog sırası.</summary>
        private static List<KatalogKalemi> Kisalt(List<KatalogKalemi> l, MenuOgesi oge, Katalog k, int enCok)
        {
            if (l.Count <= enCok) return new List<KatalogKalemi>(l);
            var kalan = new HashSet<KatalogKalemi>();
            var secili = SeciliTip(oge, k);
            if (secili != null && l.Contains(secili)) kalan.Add(secili);
            List<string> son;
            if (oge != null && _son.TryGetValue(oge.Kod, out son))
                foreach (var a in son)
                {
                    var it = Bul(k, a);
                    if (it != null && l.Contains(it)) kalan.Add(it);
                }
            var cok = l.FindAll(x => x.Kullanim > 0);
            cok.Sort((a, b) => b.Kullanim.CompareTo(a.Kullanim));
            foreach (var it in cok) { if (kalan.Count >= enCok) break; kalan.Add(it); }
            foreach (var it in l) { if (kalan.Count >= enCok) break; kalan.Add(it); }
            return l.FindAll(x => kalan.Contains(x));
        }

        private static KatalogKalemi Bul(Katalog k, string anahtar)
        {
            if (string.IsNullOrEmpty(anahtar)) return null;
            int i = anahtar.IndexOf('|');
            if (i < 0) return null;
            string cins = anahtar.Substring(0, i), tanim = anahtar.Substring(i + 1);
            // Kanalda katalogda olmayan birleşimler kuralla kurulur (Katalog.KanalZeminleri)
            return k.Bul(cins, tanim) ?? (k.KanalCinsleri.Contains(cins) ? k.KanalZeminiKalemi(tanim) : null);
        }

        /// <summary>
        /// Öğenin seçili tipi (verilen katalogda); seçilmemişse öğenin en çok kullanılan tipi (müşterek hatta OG iletken),
        /// o da yoksa ilk tipi.
        /// </summary>
        public static KatalogKalemi SeciliTip(MenuOgesi oge, Katalog k)
        {
            if (oge == null || k == null) return null;
            Yukle();
            string a;
            if (_tip.TryGetValue(oge.Kod, out a))
            {
                var it = Bul(k, a);
                if (it != null) return it;
            }
            var hepsi = Tipler(oge, k);
            if (hepsi.Count == 0) return null;
            if (oge.HatMi && oge.Tur == "MUSTEREK")
            {
                var og = EnCokKullanilan(hepsi.FindAll(x => Iletkenler.OgMu(x.Cins)));
                if (og != null) return og;
            }
            return EnCokKullanilan(hepsi) ?? hepsi[0];
        }

        private static KatalogKalemi EnCokKullanilan(List<KatalogKalemi> l)
        {
            KatalogKalemi en = null;
            foreach (var x in l) if (x.Kullanim > 0 && (en == null || x.Kullanim > en.Kullanim)) en = x;
            return en ?? (l.Count > 0 ? l[0] : null);
        }

        public static void TipSec(MenuOgesi oge, KatalogKalemi it)
        {
            if (oge == null || it == null) return;
            Yukle();
            _tip[oge.Kod] = it.Anahtar;
            _cins[oge.Kod] = TipCinsi(oge, it);
            SonaKoy(oge.Kod, it);
            SonaKoy(TurAnahtari(oge), it);
            Kaydet();
            Degisti?.Invoke();
        }

        // ---------------- Cins ----------------

        /// <summary>Öğenin şeritte seçili cinsi: seçilmişse o, değilse seçili tipin cinsi, o da yoksa ilk cins.</summary>
        public static string SeciliCins(MenuOgesi oge, Katalog k)
        {
            if (oge == null || k == null) return "";
            Yukle();
            var cinsler = Cinsler(oge, k);
            string c;
            if (_cins.TryGetValue(oge.Kod, out c) && cinsler.Contains(c)) return c;
            var tip = SeciliTip(oge, k);
            if (tip != null && cinsler.Contains(TipCinsi(oge, tip))) return TipCinsi(oge, tip);
            return cinsler.Count > 0 ? cinsler[0] : "";
        }

        /// <summary>Cins seçilir; seçili tip bu cinsten değilse cinsin (en çok kullanılan) tipi seçilir.</summary>
        public static void CinsSec(MenuOgesi oge, string cins)
        {
            if (oge == null || string.IsNullOrEmpty(cins)) return;
            Yukle();
            _cins[oge.Kod] = cins;
            var k = TemelKatalog;
            var tip = SeciliTip(oge, k);
            if (tip == null || TipCinsi(oge, tip) != cins)
            {
                var yeni = EnCokKullanilan(Tipler(oge, k).FindAll(x => TipCinsi(oge, x) == cins));
                if (yeni != null) _tip[oge.Kod] = yeni.Anahtar;
            }
            Kaydet();
            Degisti?.Invoke();
        }

        // ---------------- Hatlar: adet ve ikinci iletken ----------------

        /// <summary>Ana iletkenin adedi (aynı güzergâhta kaç tane; ör. 3 adet ALPEK).</summary>
        public static int Adet(MenuOgesi oge)
        {
            Yukle();
            int n;
            return oge != null && _adet.TryGetValue(oge.Kod, out n) && n > 0 ? n : 1;
        }

        public static void AdetSec(MenuOgesi oge, int adet)
        {
            if (oge == null) return;
            Yukle();
            _adet[oge.Kod] = Math.Max(1, Math.Min(12, adet));
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>
        /// Hattın ikinci iletkeni (ör. müşterek hatta OG'nin yanında AG); yoksa null. Müşterek hatta seçim yapılmamışsa ana
        /// iletkenin öbür gerilimindeki en çok kullanılan iletken (OG ile AG birlikte gelir).
        /// </summary>
        public static KatalogKalemi EkIletken(MenuOgesi oge, Katalog k)
        {
            if (oge == null || k == null || !oge.HatMi) return null;
            Yukle();
            string a;
            if (_ek.TryGetValue(oge.Kod, out a)) return a == "-" ? null : Bul(k, a);
            if (oge.Tur != "MUSTEREK") return null;
            var ana = SeciliTip(oge, k);
            bool og = ana != null && Iletkenler.OgMu(ana.Cins);
            return EnCokKullanilan(Tipler(oge, k).FindAll(x => Iletkenler.OgMu(x.Cins) != og));
        }

        public static int EkAdet(MenuOgesi oge)
        {
            Yukle();
            int n;
            return oge != null && _ekAdet.TryGetValue(oge.Kod, out n) && n > 0 ? n : 1;
        }

        /// <summary>İkinci iletkeni seçer (null: yok).</summary>
        public static void EkSec(MenuOgesi oge, KatalogKalemi it, int adet = 1)
        {
            if (oge == null) return;
            Yukle();
            _ek[oge.Kod] = it == null ? "-" : it.Anahtar;
            _ekAdet[oge.Kod] = Math.Max(1, Math.Min(12, adet));
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>Şeritteki ikinci iletken listesi: öğenin bütün iletkenleri, cins cins katalog sırasıyla.</summary>
        public static List<KatalogKalemi> EkListe(MenuOgesi oge)
        {
            var k = TemelKatalog;
            var l = Tipler(oge, k);
            if (l.Count <= ListeSiniri * 2) return l;
            var ek = EkIletken(oge, k);
            var kisa = Kisalt(l, oge, k, ListeSiniri * 2);
            if (ek != null && !kisa.Contains(ek)) kisa.Insert(0, ek);
            return kisa;
        }

        /// <summary>Hat öğesinin çizilecek iletkenleri: ana iletken (adediyle) ve varsa ikinci iletken.</summary>
        public static List<HatIletkeni> HatIletkenleri(MenuOgesi oge, Katalog k)
        {
            var l = new List<HatIletkeni>();
            var ana = SeciliTip(oge, k);
            if (ana == null) return l;
            l.Add(new HatIletkeni(ana, Adet(oge)));
            var ek = EkIletken(oge, k);
            if (ek != null && ek.Anahtar != ana.Anahtar) l.Add(new HatIletkeni(ek, EkAdet(oge)));
            return l;
        }

        /// <summary>Penceredeki hat seçimini şeride yazar (ana iletken, adedi, ikinci iletken).</summary>
        public static void IletkenleriSec(MenuOgesi oge, IList<HatIletkeni> l)
        {
            if (oge == null || l == null || l.Count == 0 || l[0].Kesit == null) return;
            Yukle();
            _tip[oge.Kod] = l[0].Kesit.Anahtar;
            _cins[oge.Kod] = l[0].Kesit.Cins;
            _adet[oge.Kod] = Math.Max(1, l[0].Adet);
            SonaKoy(oge.Kod, l[0].Kesit);
            SonaKoy(TurAnahtari(oge), l[0].Kesit);
            _ek[oge.Kod] = l.Count > 1 && l[1].Kesit != null ? l[1].Kesit.Anahtar : "-";
            _ekAdet[oge.Kod] = l.Count > 1 ? Math.Max(1, l[1].Adet) : 1;
            Kaydet();
            Degisti?.Invoke();
        }

        // ---------------- Son kullanılanlar ----------------

        private static void SonaKoy(string anahtar, KatalogKalemi it)
        {
            if (string.IsNullOrEmpty(anahtar) || it == null) return;
            List<string> son;
            if (!_son.TryGetValue(anahtar, out son)) { son = new List<string>(); _son[anahtar] = son; }
            son.Remove(it.Anahtar);
            son.Insert(0, it.Anahtar);
            while (son.Count > SonSayisi) son.RemoveAt(son.Count - 1);
        }

        /// <summary>Pencerelerdeki "Son kullanılanlar" anahtarı: "eleman/AG_DIREK", "hat/AG_HAVAI", "sondaj".</summary>
        public static string TurAnahtari(MenuOgesi oge)
        {
            if (oge == null) return null;
            switch (oge.Komut)
            {
                case "SH_ELEMAN": return "eleman/" + oge.Tur;
                case "SH_HAT": return "hat/" + oge.Tur;
                case "SH_SONDAJ": return "sondaj";
                default: return null;
            }
        }

        /// <summary>Pencerede seçilen tipi son kullanılanlara ekler (anahtar: TurAnahtari biçiminde).</summary>
        public static void SonaEkle(string anahtar, KatalogKalemi it)
        {
            if (string.IsNullOrEmpty(anahtar) || it == null) return;
            Yukle();
            SonaKoy(anahtar, it);
            Kaydet();
        }

        /// <summary>Son kullanılan tipler (en yeni önde); icinden verilirse yalnız o listedekiler.</summary>
        public static List<KatalogKalemi> SonTipler(string anahtar, Katalog k, IList<KatalogKalemi> icinden = null, int enCok = 5)
        {
            Yukle();
            var l = new List<KatalogKalemi>();
            List<string> son;
            if (k == null || string.IsNullOrEmpty(anahtar) || !_son.TryGetValue(anahtar, out son)) return l;
            foreach (var a in son)
            {
                if (l.Count >= enCok) break;
                var it = Bul(k, a);
                if (it == null || l.Contains(it)) continue;
                if (icinden != null && !icinden.Contains(it)) continue;
                l.Add(it);
            }
            return l;
        }

        /// <summary>Tip arama (şeritteki Ara kutusu): bütün sözcükler tanımda, cinste ya da cins adında geçmeli.</summary>
        public static List<KatalogKalemi> Ara(List<KatalogKalemi> liste, string arama, int enCok = 40)
        {
            var sonuc = new List<KatalogKalemi>();
            var sozcukler = Norm(arama).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (sozcukler.Length == 0 || liste == null) return sonuc;
            var k = TemelKatalog;
            foreach (var it in liste)
            {
                string y = Norm(it.Tanim + " " + it.Gorunen + " " + it.Cins + " " + it.PozNo + " " + k.CinsAdi(it.Cins));
                bool uygun = true;
                foreach (var s in sozcukler) if (y.IndexOf(s, StringComparison.Ordinal) < 0) { uygun = false; break; }
                if (!uygun) continue;
                sonuc.Add(it);
                if (sonuc.Count >= enCok) break;
            }
            return sonuc;
        }

        private static string Norm(string s) => (s ?? "").ToUpperInvariant().Replace('İ', 'I').Replace('ı', 'I');

        // ---------------- Malzeme hafızası ----------------

        /// <summary>Son elemanların malzemeleri (tür ve tipe göre).</summary>
        public static MalzemeHafizasi Hafiza
        {
            get { Yukle(); return _hafiza; }
        }

        public static void HafizaSec(bool acik)
        {
            Yukle();
            HafizaAcik = acik;
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>Elemanın malzemelerini hafızaya yazar (malzemeleri düzenlenince / toplu eklenince).</summary>
        public static void Hatirla(Eleman e)
        {
            if (e == null) return;
            Yukle();
            _hafiza.Hatirla(e);
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>Elemanların malzemelerini hafızaya yazar (her tür ve tipin sondaki elemanı kalır).</summary>
        public static void HepsiniHatirla(IEnumerable<Eleman> elemanlar)
        {
            if (elemanlar == null) return;
            Yukle();
            foreach (var e in elemanlar) if (e != null) _hafiza.Hatirla(e);
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>Etkin öğenin seçili tipine kendiliğinden eklenecek malzeme sayısı (hafıza kapalıysa 0).</summary>
        public static int HafizaSayisi(MenuOgesi oge)
        {
            if (!HafizaAcik || oge == null || !oge.ElemanMi) return 0;
            var t = SeciliTip(oge, TemelKatalog);
            return t == null ? 0 : Hafiza.Sayisi(oge.Tur, t.Cins, t.Tanim);
        }

        // ---------------- Özet ----------------

        /// <summary>Şeritteki özet satırı: "AG Direk · G-10I · M · 2. hakediş · +3 malzeme", hatta "… · 3xSW / 4P+R · …".</summary>
        public static string Ozet()
        {
            var oge = Oge;
            if (oge == null) return "Önce bir öğe seçin";
            var parca = new List<string> { oge.Ad };
            if (oge.TipliMi || oge.Komut == "SH_KANAL")
            {
                if (oge.HatMi)
                {
                    string kesit = Iletkenler.AnaKesit(HatIletkenleri(oge, TemelKatalog));
                    var l = HatIletkenleri(oge, TemelKatalog);
                    if (l.Count == 1 && l[0].Adet > 1) kesit = Iletkenler.AdetYazimi(kesit, l[0].Adet);
                    if (kesit.Length > 0) parca.Add(kesit);
                }
                else
                {
                    var t = SeciliTip(oge, TemelKatalog);
                    if (t != null) parca.Add(oge.Komut == "SH_KANAL" ? KanalZemini.YaziOf(t.Tanim) + " (" + t.Tanim + ")" : t.Gorunen);
                }
                parca.Add(Durum + (Turler.DemontajMi(Durum) && !string.IsNullOrEmpty(DmDurum) ? " " + DmDurum : ""));
                parca.Add(Hakedis > 0 ? Hakedis + ". hakediş" : "aktif hakediş");
                int m = HafizaSayisi(oge);
                if (m > 0) parca.Add("+" + m + " malzeme");
            }
            return string.Join(" · ", parca);
        }

        public static void OgeSec(MenuKategorisi k, MenuOgesi oge)
        {
            Kategori = k ?? (oge != null ? oge.Kategori : Kategori);
            Oge = oge;
            Kaydet();
            Degisti?.Invoke();
        }

        public static void DurumSec(string durum, string dm)
        {
            Durum = string.IsNullOrEmpty(durum) ? "M" : durum;
            DmDurum = Turler.DemontajMi(Durum) ? (dm ?? "") : "";
            Kaydet();
            Degisti?.Invoke();
        }

        public static void HakedisSec(int hakedis)
        {
            Hakedis = Math.Max(0, hakedis);
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>Kanal ölçüsünü seçer (cm; şerit ya da kanal penceresi); şerit yenilenir.</summary>
        public static void KanalOlcusuSec(double alt, double ust, double derinlik)
        {
            Yukle();
            KanalAlt = Math.Max(0, alt);
            KanalUst = Math.Max(0, ust);
            KanalDerinlik = Math.Max(0, derinlik);
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>Komutta kullanılacak hakediş: şeritte seçilmişse o, değilse çizimin aktif hakedişi.</summary>
        public static int Hakedis_(OrtamVerisi o) => Hakedis > 0 ? Hakedis : o.Hakedis;

        // ---------------- Saklama (%APPDATA%\SebekeHakedis\serit.json) ----------------

        private static string Dosya
        {
            get
            {
                string k = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SebekeHakedis");
                return Path.Combine(k, "serit.json");
            }
        }

        private static void SozlukOku(JsonNesne kok, string ad, Dictionary<string, string> hedef)
        {
            var o = kok.Nesne(ad);
            if (o != null) foreach (var kv in o) if (kv.Value is string) hedef[kv.Key] = (string)kv.Value;
        }

        private static void SayilariOku(JsonNesne kok, string ad, Dictionary<string, int> hedef)
        {
            var o = kok.Nesne(ad);
            if (o != null) foreach (var kv in o) if (kv.Value is double) hedef[kv.Key] = (int)Math.Round((double)kv.Value);
        }

        /// <summary>Son seçimleri bir kez okur (şerit kurulurken).</summary>
        public static void Yukle()
        {
            if (_yuklendi) return;
            _yuklendi = true;
            try
            {
                KatalogKaynagi.KategorileriYukle();
                if (!File.Exists(Dosya)) { Varsayilan(); return; }
                var kok = Cekirdek.Json.Oku(File.ReadAllText(Dosya, Encoding.UTF8)) as JsonNesne;
                if (kok == null) { Varsayilan(); return; }
                Kategori = Kategoriler.Bul(kok.Metin("kategori"));
                if (Kategori != null) Oge = Kategori.Ogeler.Find(x => x.Kod == kok.Metin("oge"));
                Durum = kok.Metin("durum", "M");
                if (Array.IndexOf(Turler.CizimDurumlari, Durum) < 0) Durum = "M";
                DmDurum = kok.Metin("dm");
                Hakedis = kok.Tam("hakedis");
                KanalKablolari = kok.Metin("kanalKablolari");
                var ko = kok.Dizi("kanalOlcu");
                if (ko != null && ko.Count >= 3)
                {
                    KanalAlt = SayiCoz.Coz(Convert.ToString(ko[0], CultureInfo.InvariantCulture));
                    KanalUst = SayiCoz.Coz(Convert.ToString(ko[1], CultureInfo.InvariantCulture));
                    KanalDerinlik = SayiCoz.Coz(Convert.ToString(ko[2], CultureInfo.InvariantCulture));
                }
                HafizaAcik = kok.Mantik("hafizaAcik") ?? true;
                SozlukOku(kok, "tip", _tip);
                SozlukOku(kok, "cins", _cins);
                SozlukOku(kok, "ek", _ek);
                SayilariOku(kok, "adet", _adet);
                SayilariOku(kok, "ekAdet", _ekAdet);
                var son = kok.Nesne("son");
                if (son != null)
                    foreach (var kv in son)
                    {
                        var d = kv.Value as List<object>;
                        if (d == null) continue;
                        var l = new List<string>();
                        foreach (var x in d) l.Add(Convert.ToString(x, CultureInfo.InvariantCulture));
                        _son[kv.Key] = l;
                    }
                _hafiza = MalzemeHafizasi.JsondanOku(kok.Nesne("hafiza"));
            }
            catch { }
            if (Kategori == null) Varsayilan();
        }

        private static void Varsayilan()
        {
            var l = Kategoriler.Hepsi();
            Kategori = l.Count > 0 ? l[0] : null;
            Oge = Kategori != null && Kategori.Ogeler.Count > 0 ? Kategori.Ogeler[0] : null;
        }

        private static JsonNesne Sozluk(Dictionary<string, string> d)
        {
            var o = new JsonNesne();
            foreach (var kv in d) o[kv.Key] = kv.Value;
            return o;
        }

        private static JsonNesne Sayilar(Dictionary<string, int> d)
        {
            var o = new JsonNesne();
            foreach (var kv in d) o[kv.Key] = (double)kv.Value;
            return o;
        }

        private static void Kaydet()
        {
            try
            {
                var kok = new JsonNesne();
                kok["bicim"] = "sebeke-hakedis.serit";
                kok["kategori"] = Kategori != null ? Kategori.Kod : "";
                kok["oge"] = Oge != null ? Oge.Kod : "";
                kok["durum"] = Durum ?? "M";
                kok["dm"] = DmDurum ?? "";
                kok["hakedis"] = (double)Hakedis;
                kok["kanalKablolari"] = KanalKablolari ?? "";
                kok["kanalOlcu"] = new List<object> { KanalAlt, KanalUst, KanalDerinlik };
                kok["hafizaAcik"] = HafizaAcik;
                kok["tip"] = Sozluk(_tip);
                kok["cins"] = Sozluk(_cins);
                kok["ek"] = Sozluk(_ek);
                kok["adet"] = Sayilar(_adet);
                kok["ekAdet"] = Sayilar(_ekAdet);
                var son = new JsonNesne();
                foreach (var kv in _son) son[kv.Key] = new List<object>(kv.Value);
                kok["son"] = son;
                kok["hafiza"] = _hafiza.JsonYap();
                Directory.CreateDirectory(Path.GetDirectoryName(Dosya));
                File.WriteAllText(Dosya, Cekirdek.Json.Yaz(kok, true), new UTF8Encoding(false));
            }
            catch { }
        }
    }
}
