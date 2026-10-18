using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Katalogdaki bir kalem tipi (direk tipi, hat kesiti, malzeme).</summary>
    public sealed class KatalogKalemi
    {
        public string Cins = "", Tanim = "", Birim = "ad/ad", Tarife = "", Rol = "malzeme";
        public double Katsayi = 1;
        /// <summary>Köy / bakım unsuru (2 hane); boşsa kalemin tek tarifesi vardır.</summary>
        public string UnsurKoy = "";
        public string PozNo = "", Kesit = "", Temini = "", Guc = "";
        /// <summary>PROMAGIS rapor sırası (katalog sırası); bilinmiyorsa int.MaxValue.</summary>
        public int Onem = int.MaxValue;
        /// <summary>Gerçek çizimlerde bu kalemin kullanıldığı nesne türleri (AG_DIREK, HAT_AG_HAVAI, KANAL…).</summary>
        public HashSet<string> Nesneler = new HashSet<string>(StringComparer.Ordinal);
        public int Kullanim;
        /// <summary>"katalog" (PROMAGIS listesi) ya da "cizim" (yalnız bir çizimde görüldü).</summary>
        public string Kaynak = "katalog";

        public string Anahtar => Cins + "|" + Tanim;

        /// <summary>Liste ve aramada görünen yazı: "G-K2 · AG_DEMİR_GLV · 504 kg/ad".</summary>
        public string Yazi
        {
            get
            {
                string[] b = (Birim ?? "").Split('/');
                string g = b.Length > 0 ? b[0] : "", r = b.Length > 1 ? b[1] : g;
                string ek = r == "kg" ? Katsayi.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',') + " kg/" + g : Birim;
                return Tanim.Trim() + "   ·   " + Cins + "   ·   " + ek + (string.IsNullOrEmpty(PozNo) ? "" : "   ·   poz " + PozNo);
            }
        }

        public override string ToString() => Yazi;

        /// <summary>Karşılaştırma için sadeleştirilmiş tanım (boşluk, büyük/küçük harf ve bölünmez boşluk farkı yok).</summary>
        public static string Sade(string s) =>
            (s ?? "").Replace(' ', ' ').Replace(" ", "").ToUpperInvariant().Replace('İ', 'I').Replace('ı', 'I');
    }

    /// <summary>Katalogdaki bir cins (malzeme sınıfı): kod, okunur ad, rol.</summary>
    public sealed class KatalogCinsi
    {
        public string Cins = "", Ad = "", Rol = "malzeme";
        public int Tip;
        public override string ToString() => Ad;
    }

    /// <summary>
    /// Malzeme kataloğu: ortak/katalog/kalemler.json (sürüm 2: PROMAGIS'in tam listesi; eklentiye gömülü) + çizimde
    /// kullanılan kalemler. Nesne türü → cins listeleri (gruplar) pencere süzgeçlerini ve menüyü belirler.
    /// Telefon uygulamasındaki katalogla aynı dosya (sh-core.js katalogHazirla).
    /// </summary>
    public sealed class Katalog
    {
        public readonly List<KatalogKalemi> Kalemler = new List<KatalogKalemi>();
        public readonly List<KatalogCinsi> Cinsler = new List<KatalogCinsi>();
        /// <summary>Eleman türü → nesnenin kendi pozu olabilecek cinsler (sırayla).</summary>
        public readonly Dictionary<string, List<string>> ElemanCinsleri = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        /// <summary>Hat türü → iletken / kablo cinsleri (sırayla).</summary>
        public readonly Dictionary<string, List<string>> HatCinsleri = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        public readonly List<string> KanalCinsleri = new List<string>();
        public readonly List<string> SondajCinsleri = new List<string>();
        /// <summary>Tarife kod listeleri (ayarlar penceresi için): kod → ad.</summary>
        public readonly Dictionary<string, string> Karakteristikler = new Dictionary<string, string>(StringComparer.Ordinal);
        public readonly Dictionary<string, string> Unsurlar = new Dictionary<string, string>(StringComparer.Ordinal);
        /// <summary>Durum kodu → açıklama (PROMAGIS listesi).</summary>
        public readonly Dictionary<string, string> Durumlar = new Dictionary<string, string>(StringComparer.Ordinal);
        public int Surum = 1;

        private readonly Dictionary<string, KatalogKalemi> _anahtar = new Dictionary<string, KatalogKalemi>(StringComparer.Ordinal);
        private readonly Dictionary<string, KatalogKalemi> _sade = new Dictionary<string, KatalogKalemi>(StringComparer.Ordinal);
        private readonly Dictionary<string, KatalogCinsi> _cins = new Dictionary<string, KatalogCinsi>(StringComparer.Ordinal);
        private readonly Dictionary<string, int> _cinsSirasi = new Dictionary<string, int>(StringComparer.Ordinal);

        public static Katalog Oku(string kalemlerJson, Proje proje)
        {
            var k = new Katalog();
            if (!string.IsNullOrEmpty(kalemlerJson))
            {
                var kok = Json.Oku(kalemlerJson) as JsonNesne;
                if (kok != null)
                {
                    k.Surum = kok.Tam("surum", 1);
                    k.GruplariOku(kok.Nesne("gruplar"));
                    var tarife = kok.Nesne("tarife");
                    if (tarife != null)
                    {
                        KodlariOku(tarife.Nesne("karakteristikler"), k.Karakteristikler);
                        KodlariOku(tarife.Nesne("unsurlar"), k.Unsurlar);
                    }
                    KodlariOku(kok.Nesne("durumlar"), k.Durumlar);
                    var cinsler = kok.Dizi("cinsler");
                    if (cinsler != null)
                        foreach (var x in cinsler)
                        {
                            var o = x as JsonNesne;
                            if (o == null) continue;
                            k.CinsEkle(o.Metin("cins"), o.Metin("ad"), o.Metin("rol", "malzeme"));
                        }
                    var dizi = kok.Dizi("kalemler");
                    if (dizi != null)
                        foreach (var x in dizi)
                        {
                            var o = x as JsonNesne;
                            if (o == null) continue;
                            var nes = new List<string>();
                            var nd = o.Dizi("nesneler");
                            if (nd != null) foreach (var n in nd) nes.Add(Convert.ToString(n, CultureInfo.InvariantCulture));
                            var it = k.Ekle(o.Metin("cins"), o.Metin("tanim"), o.Metin("birim", "ad/ad"), o.Ondalik("katsayi", 1), o.Metin("tarife"), o.Metin("rol", "malzeme"), nes, o.Tam("kullanim"));
                            if (it == null) continue;
                            it.UnsurKoy = o.Metin("unsurKoy");
                            it.PozNo = o.Metin("pozNo");
                            it.Kesit = o.Metin("kesit");
                            it.Temini = o.Metin("temini");
                            var guc = o.Ondalik("guc", 0);
                            it.Guc = guc > 0 ? guc.ToString("0.##", CultureInfo.InvariantCulture) : "";
                            int onem = o.Tam("onem", -1);
                            if (onem >= 0) it.Onem = onem;
                            it.Kaynak = o.Metin("kaynak", "katalog");
                        }
                }
            }
            if (k.ElemanCinsleri.Count == 0) k.VarsayilanGruplar();
            if (proje != null) k.ProjedenEkle(proje);
            return k;
        }

        private static void KodlariOku(JsonNesne o, Dictionary<string, string> hedef)
        {
            if (o == null) return;
            foreach (var kv in o)
            {
                var s = kv.Value as string;
                if (!string.IsNullOrEmpty(kv.Key) && kv.Key != "aciklama") hedef[kv.Key] = s ?? "";
            }
        }

        private void GruplariOku(JsonNesne g)
        {
            if (g == null) return;
            ListeleriOku(g.Nesne("elemanlar"), ElemanCinsleri);
            ListeleriOku(g.Nesne("hatlar"), HatCinsleri);
            DiziOku(g.Dizi("kanal"), KanalCinsleri);
            DiziOku(g.Dizi("sondaj"), SondajCinsleri);
        }

        private static void ListeleriOku(JsonNesne o, Dictionary<string, List<string>> hedef)
        {
            if (o == null) return;
            foreach (var kv in o)
            {
                var d = kv.Value as List<object>;
                if (d == null) continue;
                var l = new List<string>();
                DiziOku(d, l);
                hedef[kv.Key] = l;
            }
        }

        private static void DiziOku(List<object> d, List<string> hedef)
        {
            if (d == null) return;
            foreach (var x in d)
            {
                var s = Convert.ToString(x, CultureInfo.InvariantCulture);
                if (!string.IsNullOrEmpty(s) && !hedef.Contains(s)) hedef.Add(s);
            }
        }

        /// <summary>Eski (sürüm 1) katalogda grup tablosu yoktur: PROMAGIS cins ön eklerinden kurulur.</summary>
        private void VarsayilanGruplar()
        {
            foreach (var it in Kalemler)
            {
                if (it.Rol == "ana") GrupEkle(ElemanCinsleri, PromagisOkuyucu.ElemanTuru(it.Cins), it.Cins);
                else if (it.Rol == "hat") GrupEkle(HatCinsleri, PromagisOkuyucu.HatTuru("", it.Cins), it.Cins);
                else if (it.Rol == "kanal" && !KanalCinsleri.Contains(it.Cins)) KanalCinsleri.Add(it.Cins);
                else if (it.Rol == "sondaj" && !SondajCinsleri.Contains(it.Cins)) SondajCinsleri.Add(it.Cins);
            }
            if (SondajCinsleri.Count == 0) SondajCinsleri.Add("YATAY_DELGİ");
            if (KanalCinsleri.Count == 0) KanalCinsleri.Add("KABLO_KANALI");
        }

        private static void GrupEkle(Dictionary<string, List<string>> g, string tur, string cins)
        {
            if (string.IsNullOrEmpty(tur) || string.IsNullOrEmpty(cins)) return;
            List<string> l;
            if (!g.TryGetValue(tur, out l)) { l = new List<string>(); g[tur] = l; }
            if (!l.Contains(cins)) l.Add(cins);
        }

        private KatalogCinsi CinsEkle(string cins, string ad, string rol)
        {
            if (string.IsNullOrEmpty(cins)) return null;
            KatalogCinsi c;
            if (!_cins.TryGetValue(cins, out c))
            {
                c = new KatalogCinsi { Cins = cins, Ad = string.IsNullOrEmpty(ad) ? cins.Replace('_', ' ') : ad, Rol = rol ?? "malzeme" };
                _cins[cins] = c;
                _cinsSirasi[cins] = Cinsler.Count;
                Cinsler.Add(c);
            }
            return c;
        }

        public KatalogKalemi Ekle(string cins, string tanim, string birim, double katsayi, string tarife, string rol, IEnumerable<string> nesneler, int kullanim)
        {
            if (string.IsNullOrEmpty(cins) || string.IsNullOrEmpty(tanim)) return null;
            string key = cins + "|" + tanim;
            KatalogKalemi v;
            if (!_anahtar.TryGetValue(key, out v))
            {
                // Aynı kalem boşluk farkıyla (ör. sonda boşluk) varsa yeni kayıt açılmaz
                string sade = cins + "|" + KatalogKalemi.Sade(tanim);
                if (!_sade.TryGetValue(sade, out v))
                {
                    v = new KatalogKalemi { Cins = cins, Tanim = tanim, Birim = string.IsNullOrEmpty(birim) ? "ad/ad" : birim, Katsayi = katsayi == 0 ? 1 : katsayi, Tarife = tarife ?? "", Rol = rol ?? "malzeme" };
                    _sade[sade] = v;
                    Kalemler.Add(v);
                    CinsEkle(cins, null, v.Rol).Tip++;
                }
                _anahtar[key] = v;
            }
            if (nesneler != null) foreach (var n in nesneler) if (!string.IsNullOrEmpty(n)) v.Nesneler.Add(n);
            v.Kullanim += kullanim;
            return v;
        }

        /// <summary>Çizimde kullanılan ama katalogda olmayan tipler de seçilebilsin.</summary>
        public void ProjedenEkle(Proje p)
        {
            foreach (var e in p.Elemanlar)
                foreach (var kl in e.Kalemler)
                {
                    var it = Ekle(kl.Cins, kl.Tanim, kl.Birim, kl.Katsayi, kl.Tarife, kl.Ana ? "ana" : "malzeme", new[] { e.Tur }, 1);
                    if (it != null && kl.Ana) GrupEkle(ElemanCinsleri, e.Tur, kl.Cins);
                }
            foreach (var h in p.Hatlar)
                foreach (var kl in h.Kalemler)
                {
                    var it = Ekle(kl.Cins, kl.Tanim, kl.Birim, kl.Katsayi, kl.Tarife, kl.Kaynak == "HAT" ? "hat" : "malzeme", new[] { "HAT_" + h.Tur }, 1);
                    if (it != null && kl.Kaynak == "HAT") GrupEkle(HatCinsleri, h.Tur, kl.Cins);
                }
            foreach (var s in p.Sondajlar)
                foreach (var kl in s.Kalemler)
                    Ekle(kl.Cins, kl.Tanim, kl.Birim, kl.Katsayi, kl.Tarife, kl.Ana ? "sondaj" : "malzeme", new[] { "SONDAJ" }, 1);
        }

        // ---------------- Arama ----------------

        public KatalogKalemi Bul(string cins, string tanim)
        {
            KatalogKalemi v;
            if (_anahtar.TryGetValue((cins ?? "") + "|" + (tanim ?? ""), out v)) return v;
            return _sade.TryGetValue((cins ?? "") + "|" + KatalogKalemi.Sade(tanim), out v) ? v : null;
        }

        public KatalogCinsi Cins(string cins)
        {
            KatalogCinsi c;
            return _cins.TryGetValue(cins ?? "", out c) ? c : null;
        }

        public string CinsAdi(string cins)
        {
            var c = Cins(cins);
            return c != null ? c.Ad : (cins ?? "").Replace('_', ' ');
        }

        private int CinsSirasi(string cins)
        {
            int i;
            return _cinsSirasi.TryGetValue(cins ?? "", out i) ? i : int.MaxValue;
        }

        /// <summary>Katalog sırası: verilen cins listesindeki sıra, sonra PROMAGIS önem sırası, sonra ad.</summary>
        private Comparison<KatalogKalemi> Siralayici(IList<string> cinsler)
        {
            return (a, b) =>
            {
                int ia = cinsler != null ? cinsler.IndexOf(a.Cins) : -1, ib = cinsler != null ? cinsler.IndexOf(b.Cins) : -1;
                if (ia < 0) ia = int.MaxValue; if (ib < 0) ib = int.MaxValue;
                int r = ia.CompareTo(ib);
                if (r != 0) return r;
                r = CinsSirasi(a.Cins).CompareTo(CinsSirasi(b.Cins));
                if (r != 0) return r;
                r = a.Onem.CompareTo(b.Onem);
                return r != 0 ? r : string.CompareOrdinal(a.Tanim, b.Tanim);
            };
        }

        /// <summary>Eleman türünün cinsleri (menü süzgeci); tabloda yoksa çizimde o türle görülen ana cinsler.</summary>
        public List<string> ElemanCinsListesi(string tur)
        {
            List<string> l;
            if (ElemanCinsleri.TryGetValue(tur ?? "", out l) && l.Count > 0) return new List<string>(l);
            var s = new List<string>();
            foreach (var it in Kalemler) if (it.Rol == "ana" && (it.Nesneler.Contains(tur) || PromagisOkuyucu.ElemanTuru(it.Cins) == tur) && !s.Contains(it.Cins)) s.Add(it.Cins);
            return s;
        }

        public List<string> HatCinsListesi(string tur)
        {
            List<string> l;
            if (HatCinsleri.TryGetValue(tur ?? "", out l) && l.Count > 0) return new List<string>(l);
            var s = new List<string>();
            foreach (var it in Kalemler) if (it.Rol == "hat" && (it.Nesneler.Contains("HAT_" + tur) || PromagisOkuyucu.HatTuru("", it.Cins) == tur) && !s.Contains(it.Cins)) s.Add(it.Cins);
            return s;
        }

        /// <summary>
        /// Eleman türünün kendi pozları (direk tipleri vb.): türün cins grubundaki kalemler, katalog sırasıyla.
        /// cinsler verilirse yalnız o cinsler (menü öğesi süzgeci, ör. yalnız AG ek mufları).
        /// </summary>
        public List<KatalogKalemi> AnaTipler(string tur, IList<string> cinsler = null)
        {
            var grup = cinsler != null && cinsler.Count > 0 ? new List<string>(cinsler) : ElemanCinsListesi(tur);
            // Grubun cinsleri rolüne bakılmaksızın (ör. DİĞER › ARMATÜR malzeme rolündedir); grup dışından yalnız çizimde o türle görülen ana pozlar
            var l = Kalemler.FindAll(it => grup.Contains(it.Cins) ? (it.Rol == "ana" || it.Rol == "malzeme") : (cinsler == null && it.Rol == "ana" && it.Nesneler.Contains(tur)));
            if (l.Count == 0 && cinsler == null) l = Kalemler.FindAll(it => it.Rol == "ana" && PromagisOkuyucu.ElemanTuru(it.Cins) == tur);
            l.Sort(Siralayici(grup));
            return l;
        }

        /// <summary>Hat türünün kesitleri (türün cins grubu, katalog sırasıyla); ardından diğer iletken ve kablolar.</summary>
        public List<KatalogKalemi> HatKesitleri(string tur, IList<string> cinsler = null)
        {
            var grup = cinsler != null && cinsler.Count > 0 ? new List<string>(cinsler) : HatCinsListesi(tur);
            string nesne = "HAT_" + tur;
            var l = Kalemler.FindAll(it => it.Rol == "hat" && (grup.Contains(it.Cins) || (cinsler == null && it.Nesneler.Contains(nesne))));
            l.Sort(Siralayici(grup));
            if (cinsler != null && cinsler.Count > 0) return l;
            var diger = Kalemler.FindAll(it => !l.Contains(it) && (it.Rol == "hat" || it.Nesneler.Contains(nesne)));
            diger.Sort(Siralayici(null));
            l.AddRange(diger);
            return l;
        }

        public List<KatalogKalemi> SondajTipleri()
        {
            var l = Kalemler.FindAll(it => it.Rol == "sondaj" || SondajCinsleri.Contains(it.Cins));
            l.Sort(Siralayici(SondajCinsleri));
            return l;
        }

        /// <summary>Kanal zeminleri (KABLO_KANALI kalemleri): tanım listesi, katalog sırasıyla.</summary>
        public List<KatalogKalemi> KanalZeminleri()
        {
            var l = Kalemler.FindAll(it => it.Rol == "kanal" || KanalCinsleri.Contains(it.Cins));
            l.Sort(Siralayici(KanalCinsleri));
            return l;
        }

        /// <summary>Nesneye eklenebilecek malzemeler: önce o nesnede kullanılanlar (çok kullanılan önce), sonra katalog sırası.</summary>
        public List<KatalogKalemi> Malzemeler(string nesne)
        {
            var l = Kalemler.FindAll(it => it.Rol == "malzeme" || it.Rol == "hat");
            var sira = Siralayici(null);
            l.Sort((a, b) =>
            {
                int r = b.Nesneler.Contains(nesne).CompareTo(a.Nesneler.Contains(nesne));
                if (r != 0) return r;
                r = b.Kullanim.CompareTo(a.Kullanim);
                return r != 0 ? r : sira(a, b);
            });
            return l;
        }

        // ---------------- Tarife ----------------

        /// <summary>
        /// Kalemin tarifesi: karakteristik (çizim ayarı; boşsa katalogdaki) + unsur (çizim ayarı köy/bakım ise
        /// kalemin köy unsuru, yoksa şehir unsuru). PROMAGIS: SMIKMU 1 şehir / 2 köy, KRTNALINACAK karakteristik.
        /// </summary>
        public static string TarifeSec(KatalogKalemi it, string karakteristik, bool koy)
        {
            string t = it != null ? (it.Tarife ?? "") : "";
            string kar = t.Length >= 2 ? t.Substring(0, 2) : "01";
            string unsur = t.Length >= 4 ? t.Substring(2, 2) : "";
            if (koy && it != null && !string.IsNullOrEmpty(it.UnsurKoy)) unsur = it.UnsurKoy;
            if (!string.IsNullOrEmpty(karakteristik)) kar = karakteristik.Length == 1 ? "0" + karakteristik : karakteristik;
            return unsur.Length == 0 ? t : kar + unsur;
        }

        /// <summary>Katalog kaleminden poz satırı.</summary>
        public static Kalem KalemYap(KatalogKalemi it, double miktar, string durum, int hakedis, bool ana, string kaynak, string sira, string dmDurum = "", string karakteristik = null, bool koy = false)
        {
            var k = new Kalem
            {
                Cins = it.Cins, Tanim = it.Tanim, Durum = durum, Miktar = miktar, Birim = it.Birim, Katsayi = it.Katsayi,
                Hakedis = hakedis, Tarife = TarifeSec(it, karakteristik, koy), Sira = sira ?? "", Ana = ana, Kaynak = kaynak ?? "MALZEME", DmDurum = dmDurum ?? "",
            };
            k.Toplam = SayiCoz.Temiz(k.Miktar * k.Katsayi);
            return k;
        }
    }
}
