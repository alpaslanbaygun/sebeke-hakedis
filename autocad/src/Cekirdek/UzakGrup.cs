using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Uzak nesne grubu (14.11.2026, saha bildirimi): adı değiştirilip yeni işe devam edilen telefon projesinde eski
    /// projenin alımları (km'lerce uzakta) kalıyor, dosyayla AutoCAD'e de geliyordu. Nesneler birbirine <see cref="Esik"/>
    /// metreden yakınsa aynı gruptadır (zincirleme: tek bağlantı); bir hattın / kanalın köşeleri hep aynı gruptadır. En çok
    /// nesneli grup ana gruptur, ötekiler uzak gruptur (aralarında en az eşik kadar boşluk vardır). Telefondaki karşılığı:
    /// telefon/web/src/geo/uzak-grup.js (aynı kural; ortak deneme: ortak/deneme/uzak-grup/vektorler.json).
    /// </summary>
    public static class UzakGrup
    {
        /// <summary>Gruplama eşiği (m): bundan uzak nesne kümeleri ayrı gruptur.</summary>
        public const double Esik = 2000;

        /// <summary>
        /// Nesneleri gruplar. Her nesne bir ya da daha çok köşedir (x, y). Döner: her nesnenin grup numarası; 0 ana grup
        /// (en çok nesneli; eşitlikte ilk nesnenin grubu), 1, 2 … uzak gruplar (nesne sayısı azalan, eşitlikte ilk görünen).
        /// Köşesi olmayan nesne ana gruba sayılır.
        /// </summary>
        public static int[] Grupla(IList<IList<double[]>> nesneler, double esik = Esik)
        {
            int n = nesneler.Count;
            var noktaNesne = new List<int>();
            var noktalar = new List<double[]>();
            for (int i = 0; i < n; i++)
            {
                var k = nesneler[i];
                if (k == null) continue;
                foreach (var p in k)
                {
                    if (p == null || p.Length < 2 || double.IsNaN(p[0]) || double.IsNaN(p[1])) continue;
                    noktaNesne.Add(i); noktalar.Add(p);
                }
            }
            var ata = new int[n];
            for (int i = 0; i < n; i++) ata[i] = i;
            Func<int, int> kok = null;
            kok = x => { while (ata[x] != x) { ata[x] = ata[ata[x]]; x = ata[x]; } return x; };
            Action<int, int> birlestir = (a, b) => { a = kok(a); b = kok(b); if (a != b) { if (a < b) ata[b] = a; else ata[a] = b; } };
            // Izgara: hücre = eşik; her nokta kendi ve komşu 8 hücredeki noktalara bakar
            var izgara = new Dictionary<long, List<int>>();
            Func<double, long> hc = v => (long)Math.Floor(v / esik);
            Func<long, long, long> anahtar = (cx, cy) => cx * 4000003L + cy;
            for (int j = 0; j < noktalar.Count; j++)
            {
                long cx = hc(noktalar[j][0]), cy = hc(noktalar[j][1]);
                for (long dx = -1; dx <= 1; dx++)
                    for (long dy = -1; dy <= 1; dy++)
                    {
                        List<int> l;
                        if (!izgara.TryGetValue(anahtar(cx + dx, cy + dy), out l)) continue;
                        foreach (int m in l)
                        {
                            double ddx = noktalar[j][0] - noktalar[m][0], ddy = noktalar[j][1] - noktalar[m][1];
                            if (ddx * ddx + ddy * ddy <= esik * esik) birlestir(noktaNesne[j], noktaNesne[m]);
                        }
                    }
                List<int> kendi;
                long a0 = anahtar(cx, cy);
                if (!izgara.TryGetValue(a0, out kendi)) { kendi = new List<int>(); izgara[a0] = kendi; }
                kendi.Add(j);
            }
            // Aynı nesnenin köşeleri tek grup
            for (int j = 1; j < noktalar.Count; j++) if (noktaNesne[j] == noktaNesne[j - 1]) birlestir(noktaNesne[j], noktaNesne[j - 1]);

            var koseli = new bool[n];
            foreach (int i in noktaNesne) koseli[i] = true;
            var sayi = new Dictionary<int, int>();
            var ilk = new Dictionary<int, int>();
            for (int i = 0; i < n; i++)
            {
                if (!koseli[i]) continue;
                int r = kok(i);
                int c; sayi.TryGetValue(r, out c); sayi[r] = c + 1;
                if (!ilk.ContainsKey(r)) ilk[r] = i;
            }
            var kokler = new List<int>(sayi.Keys);
            kokler.Sort((a, b) => sayi[b] != sayi[a] ? sayi[b].CompareTo(sayi[a]) : ilk[a].CompareTo(ilk[b]));
            var no = new Dictionary<int, int>();
            for (int g = 0; g < kokler.Count; g++) no[kokler[g]] = g;
            var sonuc = new int[n];
            for (int i = 0; i < n; i++) sonuc[i] = koseli[i] ? no[kok(i)] : 0;
            return sonuc;
        }

        /// <summary>İki köşe kümesi arasındaki en kısa uzaklık (m).</summary>
        public static double EnKisaUzaklik(IList<double[]> a, IList<double[]> b)
        {
            double en = double.PositiveInfinity;
            foreach (var p in a) foreach (var q in b)
                {
                    double d = Math.Sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]));
                    if (d < en) en = d;
                }
            return en;
        }

        /// <summary>Proje dosyasındaki uzak nesneler (telefondan al öncesi uyarı için).</summary>
        public sealed class Sonuc
        {
            public List<Eleman> Elemanlar = new List<Eleman>();
            public List<Nokta> Noktalar = new List<Nokta>();
            public List<Hat> Hatlar = new List<Hat>();
            public List<Kanal> Kanallar = new List<Kanal>();
            public List<Sondaj> Sondajlar = new List<Sondaj>();
            /// <summary>Uzak nesnelerin ana gruba en kısa uzaklığı (m).</summary>
            public double Uzaklik;
            public int Sayi => Elemanlar.Count + Noktalar.Count + Hatlar.Count + Kanallar.Count + Sondajlar.Count;

            /// <summary>"8 eleman, 2 hat, 1 kanal (TR-01, AY-01, …) · ana gruptan 13,2 km uzakta"</summary>
            public string Ozet()
            {
                var p = new List<string>();
                if (Elemanlar.Count > 0) p.Add(Elemanlar.Count + " eleman");
                if (Noktalar.Count > 0) p.Add(Noktalar.Count + " GPS noktası");
                if (Hatlar.Count > 0) p.Add(Hatlar.Count + " hat");
                if (Kanallar.Count > 0) p.Add(Kanallar.Count + " kanal");
                if (Sondajlar.Count > 0) p.Add(Sondajlar.Count + " sondaj");
                var adlar = new List<string>();
                foreach (var e in Elemanlar) { if (adlar.Count >= 8) break; if (!string.IsNullOrEmpty(e.GisId)) adlar.Add(e.GisId); }
                string km = (Uzaklik / 1000.0).ToString("0.0", CultureInfo.InvariantCulture).Replace('.', ',');
                return string.Join(", ", p.ToArray()) + (adlar.Count > 0 ? " (" + string.Join(", ", adlar.ToArray()) + (Elemanlar.Count > adlar.Count ? ", …" : "") + ")" : "") +
                       " · ana gruptan " + km + " km uzakta";
            }
        }

        /// <summary>Projedeki uzak gruplar (ana grup dışındaki her şey); yoksa null.</summary>
        public static Sonuc Bul(Proje p, double esik = Esik)
        {
            if (p == null) return null;
            var nesneler = new List<IList<double[]>>();
            var turler = new List<object>();
            foreach (var e in p.Elemanlar) { nesneler.Add(new[] { new[] { e.Saga, e.Yukari } }); turler.Add(e); }
            foreach (var n in p.Noktalar) { nesneler.Add(new[] { new[] { n.Saga, n.Yukari } }); turler.Add(n); }
            foreach (var h in p.Hatlar) { nesneler.Add(h.Kose); turler.Add(h); }
            foreach (var c in p.Kanallar) { nesneler.Add(c.Kose); turler.Add(c); }
            foreach (var s in p.Sondajlar) { nesneler.Add(s.Kose); turler.Add(s); }
            if (nesneler.Count < 2) return null;
            var g = Grupla(nesneler, esik);
            var r = new Sonuc();
            var ana = new List<double[]>();
            var uzak = new List<double[]>();
            for (int i = 0; i < g.Length; i++)
            {
                var hedef = g[i] == 0 ? ana : uzak;
                if (nesneler[i] != null) foreach (var k in nesneler[i]) if (k != null && k.Length >= 2) hedef.Add(k);
                if (g[i] == 0) continue;
                var x = turler[i];
                if (x is Eleman e) r.Elemanlar.Add(e);
                else if (x is Nokta n) r.Noktalar.Add(n);
                else if (x is Hat h) r.Hatlar.Add(h);
                else if (x is Kanal c) r.Kanallar.Add(c);
                else if (x is Sondaj s) r.Sondajlar.Add(s);
            }
            if (r.Sayi == 0) return null;
            r.Uzaklik = EnKisaUzaklik(uzak, ana);
            return r;
        }

        /// <summary>Uzak nesneleri projeden çıkarır (aktarılmasınlar diye).</summary>
        public static void Cikar(Proje p, Sonuc s)
        {
            if (p == null || s == null) return;
            p.Elemanlar.RemoveAll(x => s.Elemanlar.Contains(x));
            p.Noktalar.RemoveAll(x => s.Noktalar.Contains(x));
            p.Hatlar.RemoveAll(x => s.Hatlar.Contains(x));
            p.Kanallar.RemoveAll(x => s.Kanallar.Contains(x));
            p.Sondajlar.RemoveAll(x => s.Sondajlar.Contains(x));
        }
    }
}
