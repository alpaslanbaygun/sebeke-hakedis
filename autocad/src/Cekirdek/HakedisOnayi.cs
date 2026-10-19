using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Hakediş onayı — AutoCAD'in onay kaydıyla aynı (çizim sözlüğü HAK_ONAY / ONAY_DURUM&lt;n&gt;): her hakediş için üç
    /// aşama, sırayla KONTROL → HAKEDİŞ → GIS (bitler 4 / 2 / 1). HAKEDİŞ onayı verilen hakediş kilitlidir: eklenti o
    /// hakedişteki satırları ve nesneleri değiştirmez, silmez; o hakedişe yeni nesne çizilmez; telefondan gelen
    /// değişiklikler o hakedişe dokunuyorsa aktarılmaz.
    /// </summary>
    public static class HakedisOnayi
    {
        public const int Kontrol = 4, Hakedis = 2, Gis = 1;
        /// <summary>AutoCAD'in onay penceresindeki hakediş sayısı (ONAY_DURUM1…12).</summary>
        public const int SabitOnaySayisi = 12;

        public static int Bitler(IDictionary<int, int> onaylar, int hakedis)
        {
            int b;
            return onaylar != null && onaylar.TryGetValue(hakedis, out b) ? b & 7 : 0;
        }

        /// <summary>Hakediş onaylanmış (HAKEDİŞ aşaması) mı: bu hakedişin satırları kilitli.</summary>
        public static bool Kilitli(IDictionary<int, int> onaylar, int hakedis) => hakedis > 0 && (Bitler(onaylar, hakedis) & Hakedis) != 0;

        public static bool KilitVar(IDictionary<int, int> onaylar)
        {
            if (onaylar == null) return false;
            foreach (var kv in onaylar) if ((kv.Value & Hakedis) != 0) return true;
            return false;
        }

        /// <summary>Sıra kuralı (AutoCAD'deki gibi): sonraki aşama işaretliyse öncekiler de işaretli sayılır.</summary>
        public static int Duzelt(int b)
        {
            b &= 7;
            if ((b & Gis) != 0) b |= Hakedis;
            if ((b & Hakedis) != 0) b |= Kontrol;
            return b;
        }

        /// <summary>İki onay kümesinin birleşimi (telefondan gelen onaylar çizimdekilere eklenir; onay geri alınmaz).</summary>
        public static SortedDictionary<int, int> Birlestir(IDictionary<int, int> a, IDictionary<int, int> b)
        {
            var r = new SortedDictionary<int, int>();
            if (a != null) foreach (var kv in a) if (kv.Key > 0 && kv.Value != 0) r[kv.Key] = kv.Value & 7;
            if (b != null)
                foreach (var kv in b)
                {
                    if (kv.Key <= 0 || kv.Value == 0) continue;
                    int x;
                    r.TryGetValue(kv.Key, out x);
                    r[kv.Key] = Duzelt(x | kv.Value);
                }
            return r;
        }

        public static string Metin(int b) =>
            "Kontrol " + ((b & Kontrol) != 0 ? "✓" : "–") + " · Hakediş " + ((b & Hakedis) != 0 ? "✓" : "–") + " · GIS " + ((b & Gis) != 0 ? "✓" : "–");

        /// <summary>Onayı olan hakedişlerin kısa listesi (ör. "1. hakediş: Kontrol ✓ · Hakediş ✓ · GIS –").</summary>
        public static List<string> Ozet(IDictionary<int, int> onaylar)
        {
            var l = new List<string>();
            if (onaylar == null) return l;
            var anahtarlar = new List<int>(onaylar.Keys);
            anahtarlar.Sort();
            foreach (var n in anahtarlar) if ((onaylar[n] & 7) != 0) l.Add(n + ". hakediş: " + Metin(onaylar[n]));
            return l;
        }

        public static string KilitMesaji(int hakedis) =>
            hakedis + ". hakediş onaylı (kilitli): bu hakedişe yeni nesne çizilemez, bu hakedişteki satırlar değiştirilemez. " +
            "Açık bir hakediş seçin; kilidi kaldırmak için Hakediş Onayı (SH_ONAY).";

        // ---------------- Nesne düzeyinde kilit ----------------

        /// <summary>Nesnenin kendi hakedişi (bölge için 0).</summary>
        public static int NesneHakedisi(object x) =>
            x is Eleman e ? e.Hakedis : x is Hat h ? h.Hakedis : x is Kanal c ? c.Hakedis : x is Sondaj s ? s.Hakedis : x is Nokta n ? n.Hakedis : 0;

        public static List<Kalem> Kalemleri(object x) =>
            x is Eleman e ? e.Kalemler : x is Hat h ? h.Kalemler : x is Kanal c ? c.Kalemler : x is Sondaj s ? s.Kalemler : null;

        /// <summary>Nesnenin kendisi ya da satırlarından biri kilitli hakedişte mi.</summary>
        public static bool NesneKilitli(IDictionary<int, int> onaylar, object x)
        {
            if (!KilitVar(onaylar) || x == null) return false;
            if (Kilitli(onaylar, NesneHakedisi(x))) return true;
            var ks = Kalemleri(x);
            if (ks != null) foreach (var k in ks) if (Kilitli(onaylar, k.Hakedis)) return true;
            return false;
        }

        /// <summary>Kilitli hakedişteki satırların karşılaştırma anahtarı (AutoCAD yazımıyla, sıralı).</summary>
        public static string KilitliSatirlar(IDictionary<int, int> onaylar, object x)
        {
            var ks = Kalemleri(x);
            if (ks == null || !KilitVar(onaylar)) return "";
            var l = new List<string>();
            foreach (var k in ks)
                if (Kilitli(onaylar, k.Hakedis))
                    l.Add(k.Ana ? "N" + NesneYazici.NitSatiri(k) : k.Kaynak == "HAT" ? "H" + NesneYazici.HatSatiri(k) : "M" + NesneYazici.MalzemeSatiri(k));
            l.Sort(StringComparer.Ordinal);
            return string.Join("\n", l.ToArray());
        }

        /// <summary>
        /// Telefondan gelen hâl kilidi bozuyor mu: kilitli satırlar değişmiş (eklenmiş, silinmiş, değiştirilmiş) ya da
        /// nesnenin kendisi kilitli hakedişteyken yeri / geometrisi / türü değişmiş.
        /// </summary>
        public static bool KilidiBozar(IDictionary<int, int> onaylar, object simdiki, object istenen)
        {
            if (!KilitVar(onaylar)) return false;
            if (simdiki == null) return istenen != null && NesneKilitli(onaylar, istenen);
            if (istenen == null) return NesneKilitli(onaylar, simdiki);
            if (KilitliSatirlar(onaylar, simdiki) != KilitliSatirlar(onaylar, istenen)) return true;
            bool kendisi = Kilitli(onaylar, NesneHakedisi(simdiki)) || Kilitli(onaylar, NesneHakedisi(istenen));
            return kendisi && !OzAlanlarAyni(simdiki, istenen);
        }

        private static bool Yakin(double a, double b) => Math.Abs(a - b) < 0.001;

        private static bool KoselerAyni(List<double[]> a, List<double[]> b)
        {
            if (a == null || b == null) return a == b;
            if (a.Count != b.Count) return false;
            for (int i = 0; i < a.Count; i++) if (!Yakin(a[i][0], b[i][0]) || !Yakin(a[i][1], b[i][1])) return false;
            return true;
        }

        /// <summary>Nesnenin satırları dışındaki kendi alanları (yer, geometri, tür, numara) aynı mı.</summary>
        public static bool OzAlanlarAyni(object a, object b)
        {
            if (a is Eleman e1 && b is Eleman e2)
                return e1.Tur == e2.Tur && (e1.GisId ?? "") == (e2.GisId ?? "") && Yakin(e1.Saga, e2.Saga) && Yakin(e1.Yukari, e2.Yukari) &&
                       Yakin(e1.Aci, e2.Aci) && (e1.Guc ?? "") == (e2.Guc ?? "") && (e1.Gerilim ?? "") == (e2.Gerilim ?? "");
            if (a is Hat h1 && b is Hat h2) return h1.Tur == h2.Tur && KoselerAyni(h1.Kose, h2.Kose);
            if (a is Kanal c1 && b is Kanal c2)
                return c1.Kod == c2.Kod && (c1.Zemin ?? "") == (c2.Zemin ?? "") && Yakin(c1.AltGenislik, c2.AltGenislik) && Yakin(c1.UstGenislik, c2.UstGenislik) &&
                       Yakin(c1.Derinlik, c2.Derinlik) && KoselerAyni(c1.Kose, c2.Kose);
            if (a is Sondaj s1 && b is Sondaj s2) return (s1.Tip ?? "") == (s2.Tip ?? "") && KoselerAyni(s1.Kose, s2.Kose);
            if (a is Nokta n1 && b is Nokta n2) return (n1.Ad ?? "") == (n2.Ad ?? "") && Yakin(n1.Saga, n2.Saga) && Yakin(n1.Yukari, n2.Yukari) && Yakin(n1.Kot, n2.Kot);
            return true;
        }
    }
}
