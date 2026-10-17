using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Katalogdaki bir kalem tipi (direk tipi, hat kesiti, malzeme).</summary>
    public sealed class KatalogKalemi
    {
        public string Cins = "", Tanim = "", Birim = "ad/ad", Tarife = "", Rol = "malzeme";
        /// <summary>Köy / bakım tarifesi (PROMAGIS "STANDART UNSUR TARİFE (KÖY)"); boşsa Tarife kullanılır.</summary>
        public string TarifeKoy = "";
        /// <summary>TEDAŞ poz numarası (ör. 5.1, 31.6.2); bilinmiyorsa boş.</summary>
        public string Poz = "";
        /// <summary>Kablolarda kesit yazımı (ANAKESIT'e yazılır, ör. 3x70+35); boşsa tanım.</summary>
        public string Kesit = "";
        public string Guc = "";
        public double Katsayi = 1;
        /// <summary>Ana listedeki sırası (PROMAGIS ÖNEM SIRASI); 0 = bilinmiyor.</summary>
        public int Onem;
        public HashSet<string> Nesneler = new HashSet<string>(StringComparer.Ordinal);
        public int Kullanim;

        public string Anahtar => Cins + "|" + Tanim;

        /// <summary>Tarife: şehir (varsayılan) ya da köy / bakım sütunu.</summary>
        public string TarifeSec(bool koy) => koy && !string.IsNullOrEmpty(TarifeKoy) ? TarifeKoy : Tarife;

        /// <summary>Liste ve aramada görünen yazı: "G-K2 · AG_DEMİR_GLV · 504 kg/ad".</summary>
        public string Yazi
        {
            get
            {
                string[] b = (Birim ?? "").Split('/');
                string g = b.Length > 0 ? b[0] : "", r = b.Length > 1 ? b[1] : g;
                string ek = r == "kg" ? Katsayi.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',') + " kg/" + g : Birim;
                return Tanim + "   ·   " + Cins + "   ·   " + ek + (string.IsNullOrEmpty(Poz) ? "" : "   ·   poz " + Poz);
            }
        }

        public override string ToString() => Yazi;
    }

    /// <summary>
    /// Malzeme kataloğu: ortak/katalog/kalemler.json (eklentiye gömülü; PROMAGIS ana malzeme listesinin tamamı)
    /// + çizimde kullanılan kalemler. Telefon uygulamasındaki katalogla aynı kurallar (sh-core.js katalogHazirla).
    /// </summary>
    public sealed class Katalog
    {
        public readonly List<KatalogKalemi> Kalemler = new List<KatalogKalemi>();
        /// <summary>Tür (AG_DIREK, HAT_AG_HAVAI, KANAL, SONDAJ…) → o türde seçilebilecek cinsler (PROMAGIS listeleri).</summary>
        public readonly Dictionary<string, List<string>> TurCinsleri = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        /// <summary>Karakteristik kodu → adı (01 Şebeke yatırımları …).</summary>
        public readonly Dictionary<string, string> Karakteristikler = new Dictionary<string, string>(StringComparer.Ordinal);
        /// <summary>Unsur kodu → adı (07 Şehir havai AG …).</summary>
        public readonly Dictionary<string, string> Unsurlar = new Dictionary<string, string>(StringComparer.Ordinal);
        /// <summary>Standart kanal ölçüleri "alt x üst x derinlik" (cm).</summary>
        public readonly List<string> KanalOlculeri = new List<string>();
        public readonly List<string> Gerilimler = new List<string>();
        public readonly List<string> Gucler = new List<string>();
        private readonly Dictionary<string, KatalogKalemi> _anahtar = new Dictionary<string, KatalogKalemi>(StringComparer.Ordinal);

        public static Katalog Oku(string kalemlerJson, Proje proje)
        {
            var k = new Katalog();
            if (!string.IsNullOrEmpty(kalemlerJson))
            {
                var kok = Json.Oku(kalemlerJson) as JsonNesne;
                var dizi = kok != null ? kok.Dizi("kalemler") : null;
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
                        if (string.IsNullOrEmpty(it.TarifeKoy)) it.TarifeKoy = o.Metin("tarifeKoy");
                        if (string.IsNullOrEmpty(it.Poz)) it.Poz = o.Metin("poz");
                        if (string.IsNullOrEmpty(it.Kesit)) it.Kesit = o.Metin("kesit");
                        if (string.IsNullOrEmpty(it.Guc)) it.Guc = o.Metin("guc");
                        if (it.Onem == 0) it.Onem = o.Tam("onem");
                    }
                if (kok != null)
                {
                    var tc = kok.Nesne("turCinsleri");
                    if (tc != null)
                        foreach (var kv in tc)
                        {
                            var l = new List<string>();
                            var d = kv.Value as List<object>;
                            if (d != null) foreach (var c in d) l.Add(Convert.ToString(c, CultureInfo.InvariantCulture));
                            k.TurCinsleri[kv.Key] = l;
                        }
                    Sozluk(kok.Nesne("karakteristikler"), k.Karakteristikler);
                    Sozluk(kok.Nesne("unsurlar"), k.Unsurlar);
                    Liste(kok.Dizi("kanalOlculeri"), k.KanalOlculeri);
                    Liste(kok.Dizi("gerilimler"), k.Gerilimler);
                    Liste(kok.Dizi("gucler"), k.Gucler);
                }
            }
            if (k.TurCinsleri.Count == 0) VarsayilanTurCinsleri(k.TurCinsleri);
            if (proje != null) k.ProjedenEkle(proje);
            return k;
        }

        private static void Sozluk(JsonNesne n, Dictionary<string, string> hedef)
        {
            if (n == null) return;
            foreach (var kv in n) hedef[kv.Key] = Convert.ToString(kv.Value, CultureInfo.InvariantCulture) ?? "";
        }

        private static void Liste(List<object> d, List<string> hedef)
        {
            if (d == null) return;
            foreach (var x in d) hedef.Add(Convert.ToString(x, CultureInfo.InvariantCulture));
        }

        /// <summary>Katalog dosyasında tablo yoksa (eski dosya) PROMAGIS listeleri.</summary>
        private static void VarsayilanTurCinsleri(Dictionary<string, List<string>> t)
        {
            t["AG_DIREK"] = new List<string> { "AG_BETON", "AG_DEMİR_GLV", "AG_DEMİR", "AG_AĞAÇ" };
            t["MUSTEREK_DIREK"] = new List<string> { "MÜŞ_BETON", "MÜŞ_DEMİR_GLV", "MÜŞ_DEMİR" };
            t["ENH_DIREK"] = new List<string> { "ENH_BETON", "ENH_DEMİR_GLV", "ENH_GLV_CVT", "ENH_DEMİR" };
            t["AYD_DIREK"] = new List<string> { "AYD_GLV_PLG", "AYD_BETON" };
            t["TRAFO_DIREGI"] = new List<string> { "TR_DİREK_GLV", "TR_DİREK" };
            t["TRAFO_MERKEZI"] = new List<string> { "BETON_KÖŞKLER", "TRAFO_BİNASI" };
            t["PANO"] = new List<string> { "AG_PANO_HT", "AG_PANO_DT" };
            t["BOX"] = new List<string> { "BOX_PANO" };
            t["EK_MUFU"] = new List<string> { "EK_MUFU_AG_ALM", "EK_MUFU_AG_BAKIR", "EK_MUFU_OG_ALM", "EK_MUFU_OG_BAKIR" };
            t["KOFRE"] = new List<string> { "KOFRA" };
            t["HAT_AG_HAVAI"] = new List<string> { "AG_İLETKEN", "ALPEK_KABLOLAR" };
            t["HAT_AG_YERALTI"] = new List<string> { "AG_ALİMİNYUM_KABLO", "AG_BAKIR_KABLO", "TOP_İLETKEN" };
            t["HAT_OG_HAVAI"] = new List<string> { "OG_İLETKEN" };
            t["HAT_OG_YERALTI"] = new List<string> { "OG_ALİMİNYUM_KABLO", "OG_BAKIR_KABLO" };
            t["HAT_AYDINLATMA"] = new List<string> { "AYDINLATMA_KABLO" };
            t["HAT_REKORTMAN"] = new List<string> { "REKORTMAN_ALİMİNYUM", "REKORTMAN_BAKIR" };
            t["HAT_MUSTEREK"] = new List<string> { "AG_İLETKEN", "OG_İLETKEN", "ALPEK_KABLOLAR" };
            t["KANAL"] = new List<string> { "KABLO_KANALI" };
            t["SONDAJ"] = new List<string> { "YATAY_DELGİ", "KABLO_MUHAFAZA_BORULARI", "GALVANİZLİ_KABLO_TAVASI" };
        }

        public KatalogKalemi Ekle(string cins, string tanim, string birim, double katsayi, string tarife, string rol, IEnumerable<string> nesneler, int kullanim)
        {
            if (string.IsNullOrEmpty(cins) || string.IsNullOrEmpty(tanim)) return null;
            string key = cins + "|" + tanim;
            KatalogKalemi v;
            if (!_anahtar.TryGetValue(key, out v))
            {
                v = new KatalogKalemi { Cins = cins, Tanim = tanim, Birim = string.IsNullOrEmpty(birim) ? "ad/ad" : birim, Katsayi = katsayi == 0 ? 1 : katsayi, Tarife = tarife ?? "", Rol = rol ?? "malzeme" };
                _anahtar[key] = v;
                Kalemler.Add(v);
            }
            if (nesneler != null) foreach (var n in nesneler) if (!string.IsNullOrEmpty(n)) v.Nesneler.Add(n);
            v.Kullanim += kullanim;
            return v;
        }

        /// <summary>Katalogdaki kalem (cins + tanım); yoksa null.</summary>
        public KatalogKalemi Bul(string cins, string tanim)
        {
            KatalogKalemi v;
            return _anahtar.TryGetValue((cins ?? "") + "|" + (tanim ?? ""), out v) ? v : null;
        }

        /// <summary>Çizimde kullanılan ama katalogda olmayan tipler de seçilebilsin.</summary>
        public void ProjedenEkle(Proje p)
        {
            foreach (var e in p.Elemanlar)
                foreach (var kl in e.Kalemler)
                    Ekle(kl.Cins, kl.Tanim, kl.Birim, kl.Katsayi, kl.Tarife, kl.Ana ? "ana" : "malzeme", new[] { e.Tur }, 1);
            foreach (var h in p.Hatlar)
                foreach (var kl in h.Kalemler)
                    Ekle(kl.Cins, kl.Tanim, kl.Birim, kl.Katsayi, kl.Tarife, kl.Kaynak == "HAT" ? "hat" : "malzeme", new[] { "HAT_" + h.Tur }, 1);
            foreach (var s in p.Sondajlar)
                foreach (var kl in s.Kalemler)
                    Ekle(kl.Cins, kl.Tanim, kl.Birim, kl.Katsayi, kl.Tarife, kl.Ana ? "sondaj" : "malzeme", new[] { "SONDAJ" }, 1);
        }

        /// <summary>Çok kullanılan önce; sonra ana listedeki sıra; sonra ad.</summary>
        private static int Sirala(KatalogKalemi a, KatalogKalemi b)
        {
            int r = b.Kullanim.CompareTo(a.Kullanim);
            if (r != 0) return r;
            r = OnemSirasi(a).CompareTo(OnemSirasi(b));
            return r != 0 ? r : string.CompareOrdinal(a.Tanim, b.Tanim);
        }

        private static int OnemSirasi(KatalogKalemi k) => k.Onem > 0 ? k.Onem : int.MaxValue;

        /// <summary>Türün cinsleri (PROMAGIS listesi); tabloda yoksa boş.</summary>
        public List<string> Cinsler(string tur)
        {
            List<string> l;
            return TurCinsleri.TryGetValue(tur ?? "", out l) ? l : new List<string>();
        }

        private bool TurdeMi(KatalogKalemi it, string tur)
        {
            if (it.Nesneler.Contains(tur)) return true;
            var cinsler = Cinsler(tur);
            return cinsler.Count > 0 && cinsler.Contains(it.Cins);
        }

        /// <summary>Eleman türünün kendi pozları (direk tipleri vb.): yalnız o türün cinsleri.</summary>
        public List<KatalogKalemi> AnaTipler(string tur)
        {
            var l = Kalemler.FindAll(it => it.Rol == "ana" && TurdeMi(it, tur));
            if (l.Count == 0) l = Kalemler.FindAll(it => it.Rol == "ana" && PromagisOkuyucu.ElemanTuru(it.Cins) == tur);
            l.Sort(Sirala);
            return l;
        }

        /// <summary>Eleman türünün tipleri, bir cinsle daraltılmış (ör. AG_DIREK + AG_BETON).</summary>
        public List<KatalogKalemi> AnaTipler(string tur, string cins)
        {
            var l = AnaTipler(tur);
            if (string.IsNullOrEmpty(cins)) return l;
            return l.FindAll(it => it.Cins == cins);
        }

        /// <summary>Hat türünün kesitleri (yalnız o türün cinsleri); ardından diğer kablo ve iletkenler.</summary>
        public List<KatalogKalemi> HatKesitleri(string tur)
        {
            string nesne = "HAT_" + tur;
            var l = Kalemler.FindAll(it => (it.Rol == "hat" || it.Nesneler.Contains(nesne)) && TurdeMi(it, nesne));
            if (l.Count == 0) l = Kalemler.FindAll(it => it.Rol == "hat" && PromagisOkuyucu.HatTuru("", it.Cins) == tur);
            l.Sort(Sirala);
            var diger = Kalemler.FindAll(it => !l.Contains(it) && it.Rol == "hat");
            diger.Sort(Sirala);
            l.AddRange(diger);
            return l;
        }

        public List<KatalogKalemi> SondajTipleri()
        {
            var l = Kalemler.FindAll(it => it.Rol == "sondaj" || TurdeMi(it, "SONDAJ"));
            l.Sort(Sirala);
            return l;
        }

        /// <summary>Kanal zeminleri (KABLO_KANALI tipleri), ana listedeki sırayla.</summary>
        public List<KatalogKalemi> KanalZeminleri()
        {
            var l = Kalemler.FindAll(it => it.Rol == "kanal" || TurdeMi(it, "KANAL"));
            l.Sort(Sirala);
            return l;
        }

        /// <summary>Nesneye eklenebilecek malzemeler: önce o nesnede kullanılanlar, sonra çok kullanılanlar.</summary>
        public List<KatalogKalemi> Malzemeler(string nesne)
        {
            var l = Kalemler.FindAll(it => it.Rol == "malzeme" || it.Rol == "hat");
            l.Sort((a, b) =>
            {
                int r = b.Nesneler.Contains(nesne).CompareTo(a.Nesneler.Contains(nesne));
                if (r != 0) return r;
                r = b.Kullanim.CompareTo(a.Kullanim);
                if (r != 0) return r;
                r = string.CompareOrdinal(a.Cins, b.Cins);
                return r != 0 ? r : OnemSirasi(a).CompareTo(OnemSirasi(b));
            });
            return l;
        }

        /// <summary>Katalog kaleminden poz satırı. koyTarifesi: köy / bakım sütunu kullanılsın; unsur: tarifenin son iki hanesini değiştirir (boşsa katalogdaki).</summary>
        public static Kalem KalemYap(KatalogKalemi it, double miktar, string durum, int hakedis, bool ana, string kaynak, string sira, string dmDurum = "", bool koyTarifesi = false, string karakteristik = "", string unsur = "")
        {
            var k = new Kalem
            {
                Cins = it.Cins, Tanim = it.Tanim, Durum = durum, Miktar = miktar, Birim = it.Birim, Katsayi = it.Katsayi,
                Hakedis = hakedis, Tarife = TarifeYap(it.TarifeSec(koyTarifesi), karakteristik, unsur), Sira = sira ?? "", Ana = ana, Kaynak = kaynak ?? "MALZEME", DmDurum = dmDurum ?? "",
            };
            k.Toplam = SayiCoz.Temiz(k.Miktar * k.Katsayi);
            return k;
        }

        /// <summary>Tarife = karakteristik (2 hane) + unsur (2 hane); verilen parçalar katalogdakinin yerine geçer.</summary>
        public static string TarifeYap(string katalogTarifesi, string karakteristik, string unsur)
        {
            string t = (katalogTarifesi ?? "").Trim();
            string k = t.Length >= 2 ? t.Substring(0, 2) : "01";
            string u = t.Length >= 4 ? t.Substring(2, 2) : (t.Length == 0 ? "" : t.Substring(Math.Min(2, t.Length)));
            if (!string.IsNullOrEmpty(karakteristik)) k = karakteristik.Trim().PadLeft(2, '0');
            if (!string.IsNullOrEmpty(unsur)) u = unsur.Trim().PadLeft(2, '0');
            return string.IsNullOrEmpty(u) ? k : k + u;
        }
    }
}
