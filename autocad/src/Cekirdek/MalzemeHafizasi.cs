using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Malzeme hafızasındaki bir satır (elemana bağlı malzeme: travers, izolatör, armatür …).</summary>
    public sealed class HafizaKalemi
    {
        public string Cins = "", Tanim = "", Birim = "ad/ad", Tarife = "", Durum = "";
        public double Miktar = 1, Katsayi = 1;
        /// <summary>Malzemenin durumu elemanınkiyle aynıydı: yeni elemanda elemanın durumunu alır.</summary>
        public bool ElemanDurumunda = true;

        public HafizaKalemi Kopya() => (HafizaKalemi)MemberwiseClone();
    }

    /// <summary>
    /// Son konulan / düzenlenen elemanın malzemeleri (eleman türü ve tipine göre). Yeni eleman konulunca aynı tür ve tipteki
    /// son elemanın malzemeleri kendiliğinden eklenir; o tip için kayıt yoksa aynı türdeki son elemanınkiler. Malzemenin
    /// durumu elemanınkiyle aynıydıysa yeni elemanın durumunu alır (ör. M+M direğe M+M), farklıydıysa aynen kalır.
    /// </summary>
    public sealed class MalzemeHafizasi
    {
        private sealed class Kayit
        {
            public string Kaynak = "";
            public List<HafizaKalemi> Kalemler = new List<HafizaKalemi>();
        }

        private readonly Dictionary<string, Kayit> _kayit = new Dictionary<string, Kayit>(StringComparer.Ordinal);

        public static string TipAnahtari(string tur, string cins, string tip) => (tur ?? "") + "|" + (cins ?? "") + "|" + (tip ?? "").Trim();

        public int Sayi => _kayit.Count;

        /// <summary>Elemanın (nesnenin kendi pozu dışındaki) malzemelerini tipi ve türü için hatırlar.</summary>
        public void Hatirla(Eleman e)
        {
            if (e == null || string.IsNullOrEmpty(e.Tur)) return;
            var l = new List<HafizaKalemi>();
            foreach (var k in e.Kalemler)
            {
                if (k.Ana) continue;
                l.Add(new HafizaKalemi
                {
                    Cins = k.Cins ?? "", Tanim = k.Tanim ?? "", Birim = k.Birim ?? "", Tarife = k.Tarife ?? "", Durum = k.Durum ?? "",
                    Miktar = k.Miktar, Katsayi = k.Katsayi, ElemanDurumunda = string.Equals(k.Durum ?? "", e.Durum ?? "", StringComparison.Ordinal),
                });
            }
            string kaynak = string.IsNullOrEmpty(e.GisId) ? Turler.ElemanAdi(e.Tur) : e.GisId;
            _kayit[TipAnahtari(e.Tur, e.Cins, e.Tip)] = new Kayit { Kaynak = kaynak, Kalemler = l };
            _kayit[e.Tur] = new Kayit { Kaynak = kaynak, Kalemler = l.ConvertAll(x => x.Kopya()) };
        }

        /// <summary>Tür ve tipin hatırlanan malzemeleri (önce aynı tip, yoksa aynı tür); hiç yoksa null.</summary>
        public List<HafizaKalemi> Bul(string tur, string cins, string tip, out string kaynak)
        {
            kaynak = "";
            Kayit k;
            if (!_kayit.TryGetValue(TipAnahtari(tur, cins, tip), out k) && !_kayit.TryGetValue(tur ?? "", out k)) return null;
            kaynak = k.Kaynak;
            return k.Kalemler;
        }

        /// <summary>Yeni elemana eklenecek malzeme sayısı (şerit ve pencere özetinde gösterilir).</summary>
        public int Sayisi(string tur, string cins, string tip)
        {
            string kaynak;
            var l = Bul(tur, cins, tip, out kaynak);
            return l == null ? 0 : l.Count;
        }

        /// <summary>
        /// Yeni elemanın malzemeleri: hatırlanan satırlar elemanın hakedişiyle, yeni sıra numarasıyla ve bu çizimin
        /// tarifesiyle (katalogda varsa) kurulur.
        /// </summary>
        public List<Kalem> Uygula(Eleman e, Katalog katalog, Func<string> sira, string karakteristik, bool koy)
        {
            var sonuc = new List<Kalem>();
            if (e == null) return sonuc;
            string kaynak;
            var l = Bul(e.Tur, e.Cins, e.Tip, out kaynak);
            if (l == null) return sonuc;
            foreach (var h in l)
            {
                string durum = h.ElemanDurumunda || string.IsNullOrEmpty(h.Durum) ? e.Durum : h.Durum;
                var it = katalog != null ? katalog.Bul(h.Cins, h.Tanim) : null;
                Kalem k;
                if (it != null) k = Katalog.KalemYap(it, h.Miktar, durum, e.Hakedis, false, "MALZEME", sira != null ? sira() : "", "", karakteristik, koy);
                else
                {
                    k = new Kalem
                    {
                        Cins = h.Cins, Tanim = h.Tanim, Durum = durum, Miktar = h.Miktar, Birim = h.Birim, Katsayi = h.Katsayi, Tarife = h.Tarife,
                        Hakedis = e.Hakedis, Sira = sira != null ? sira() : "", Kaynak = "MALZEME",
                    };
                    Metraj.Toplam(k);
                }
                sonuc.Add(k);
            }
            return sonuc;
        }

        // ---------------- Saklama (kullanıcının ayar dosyası) ----------------

        public JsonNesne JsonYap()
        {
            var kok = new JsonNesne();
            foreach (var kv in _kayit)
            {
                var o = new JsonNesne();
                o["kaynak"] = kv.Value.Kaynak ?? "";
                var dizi = new List<object>();
                foreach (var h in kv.Value.Kalemler)
                {
                    var x = new JsonNesne();
                    x["cins"] = h.Cins;
                    x["tanim"] = h.Tanim;
                    x["birim"] = h.Birim;
                    x["katsayi"] = h.Katsayi;
                    x["tarife"] = h.Tarife;
                    x["durum"] = h.Durum;
                    x["miktar"] = h.Miktar;
                    x["elemanDurumunda"] = h.ElemanDurumunda;
                    dizi.Add(x);
                }
                o["kalemler"] = dizi;
                kok[kv.Key] = o;
            }
            return kok;
        }

        public static MalzemeHafizasi JsondanOku(JsonNesne kok)
        {
            var m = new MalzemeHafizasi();
            if (kok == null) return m;
            foreach (var kv in kok)
            {
                var o = kv.Value as JsonNesne;
                if (o == null || string.IsNullOrEmpty(kv.Key)) continue;
                var k = new Kayit { Kaynak = o.Metin("kaynak") };
                var dizi = o.Dizi("kalemler");
                if (dizi != null)
                    foreach (var y in dizi)
                    {
                        var x = y as JsonNesne;
                        if (x == null || string.IsNullOrEmpty(x.Metin("cins"))) continue;
                        k.Kalemler.Add(new HafizaKalemi
                        {
                            Cins = CinsKodu.Duzelt(x.Metin("cins")), Tanim = x.Metin("tanim"), Birim = x.Metin("birim", "ad/ad"), Katsayi = x.Ondalik("katsayi", 1),
                            Tarife = x.Metin("tarife"), Durum = x.Metin("durum"), Miktar = x.Ondalik("miktar", 1), ElemanDurumunda = x.Mantik("elemanDurumunda") ?? true,
                        });
                    }
                m._kayit[kv.Key] = k;
            }
            return m;
        }

        /// <summary>Kısa yazı (şerit ipucu): "3 malzeme (SC77): 2 × G-TR …".</summary>
        public static string Ozet(List<HafizaKalemi> l, string kaynak, int enCok = 4)
        {
            if (l == null || l.Count == 0) return "";
            var parca = new List<string>();
            for (int i = 0; i < l.Count && i < enCok; i++)
                parca.Add(SayiCoz.Temiz(l[i].Miktar, 3).ToString("0.###", CultureInfo.GetCultureInfo("tr-TR")) + " × " + MalzemeYazimi.Duzelt(l[i].Tanim ?? ""));
            if (l.Count > enCok) parca.Add("… +" + (l.Count - enCok));
            return l.Count + " malzeme" + (string.IsNullOrEmpty(kaynak) ? "" : " (" + kaynak + ")") + ": " + string.Join(", ", parca);
        }
    }
}
