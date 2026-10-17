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
        public HashSet<string> Nesneler = new HashSet<string>(StringComparer.Ordinal);
        public int Kullanim;

        public string Anahtar => Cins + "|" + Tanim;

        /// <summary>Liste ve aramada görünen yazı: "G-K2 · AG_DEMİR_GLV · 504 kg/ad".</summary>
        public string Yazi
        {
            get
            {
                string[] b = (Birim ?? "").Split('/');
                string g = b.Length > 0 ? b[0] : "", r = b.Length > 1 ? b[1] : g;
                string ek = r == "kg" ? Katsayi.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',') + " kg/" + g : Birim;
                return Tanim + "   ·   " + Cins + "   ·   " + ek;
            }
        }

        public override string ToString() => Yazi;
    }

    /// <summary>
    /// Malzeme kataloğu: ortak/katalog/kalemler.json (eklentiye gömülü) + çizimde kullanılan kalemler.
    /// Telefon uygulamasındaki katalogla aynı kurallar (sh-core.js katalogHazirla).
    /// </summary>
    public sealed class Katalog
    {
        public readonly List<KatalogKalemi> Kalemler = new List<KatalogKalemi>();
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
                        k.Ekle(o.Metin("cins"), o.Metin("tanim"), o.Metin("birim", "ad/ad"), o.Ondalik("katsayi", 1), o.Metin("tarife"), o.Metin("rol", "malzeme"), nes, o.Tam("kullanim"));
                    }
            }
            if (proje != null) k.ProjedenEkle(proje);
            return k;
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

        private static int Sirala(KatalogKalemi a, KatalogKalemi b)
        {
            int r = b.Kullanim.CompareTo(a.Kullanim);
            return r != 0 ? r : string.CompareOrdinal(a.Tanim, b.Tanim);
        }

        /// <summary>Eleman türünün kendi pozları (direk tipleri vb.).</summary>
        public List<KatalogKalemi> AnaTipler(string tur)
        {
            var l = Kalemler.FindAll(it => it.Rol == "ana" && (it.Nesneler.Contains(tur) || PromagisOkuyucu.ElemanTuru(it.Cins) == tur));
            l.Sort(Sirala);
            return l;
        }

        /// <summary>Hat türünün kesitleri; ardından diğer kablo ve iletkenler.</summary>
        public List<KatalogKalemi> HatKesitleri(string tur)
        {
            string nesne = "HAT_" + tur;
            var l = Kalemler.FindAll(it => it.Nesneler.Contains(nesne) || (it.Rol == "hat" && PromagisOkuyucu.HatTuru("", it.Cins) == tur));
            l.Sort(Sirala);
            var diger = Kalemler.FindAll(it => !l.Contains(it) && (it.Rol == "hat" || it.Cins.Contains("KABLO") || it.Cins.Contains("İLETKEN") || it.Cins.Contains("ALPEK") || it.Cins.Contains("REKORTMAN")));
            diger.Sort(Sirala);
            l.AddRange(diger);
            return l;
        }

        public List<KatalogKalemi> SondajTipleri()
        {
            var l = Kalemler.FindAll(it => it.Rol == "sondaj" || it.Cins == "YATAY_DELGİ");
            l.Sort(Sirala);
            return l;
        }

        /// <summary>Nesneye eklenebilecek malzemeler: önce o nesnede kullanılanlar.</summary>
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
                return r != 0 ? r : string.CompareOrdinal(a.Tanim, b.Tanim);
            });
            return l;
        }

        /// <summary>Katalog kaleminden poz satırı.</summary>
        public static Kalem KalemYap(KatalogKalemi it, double miktar, string durum, int hakedis, bool ana, string kaynak, string sira, string dmDurum = "")
        {
            var k = new Kalem
            {
                Cins = it.Cins, Tanim = it.Tanim, Durum = durum, Miktar = miktar, Birim = it.Birim, Katsayi = it.Katsayi,
                Hakedis = hakedis, Tarife = it.Tarife, Sira = sira ?? "", Ana = ana, Kaynak = kaynak ?? "MALZEME", DmDurum = dmDurum ?? "",
            };
            k.Toplam = SayiCoz.Temiz(k.Miktar * k.Katsayi);
            return k;
        }
    }
}
