using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Elemanın malzemeleri çizimde (Çizim Ayarları › Görünüm › Malzemeleri çizimde göster): simgenin yanında, tip
    /// satırının altında satır satır "AD=MİKTAR[ BİRİM] (DURUM)" — ör. "GT-60=1 (M)", "1x95 mm² ÇELİK ÖRGÜ=5 mt (M)".
    ///  - Elemanın kendi pozu (direk tipi; tip satırında yazılı) listelenmez; miktarı sıfır olan satır yazılmaz.
    ///  - Ad görünen yazımla (MalzemeYazimi.Duzelt); miktar giriş biriminde (ad yazılmaz; mt, kg… yazılır).
    ///  - Durum programdaki durum koduyla: M, M+M, MEVCUT, DM, DM+M, KM… (satırın durumu boşsa elemanınki).
    ///  - Aynı ad, birim ve durumdaki satırlar (ör. iki hakedişte girilmiş) tek satırda toplanır; sıra ilk görülüşe göre.
    /// Eklenti satırları simgenin öznitelikleri olarak yazar (MLZ_1, MLZ_2…: simgeyle taşınır, kopyalanır, silinir);
    /// telefonun DXF'i aynı satırları yazı olarak yazar. Telefondaki karşılığı: sh-core.cjs › malzemeEtiketi (aynı kural);
    /// ortak deneme ortak/deneme/malzeme-etiketi.json.
    /// </summary>
    public static class MalzemeEtiketi
    {
        /// <summary>Satırların öznitelik etiketlerinin ön eki: MLZ_1, MLZ_2…</summary>
        public const string EtiketOnEki = "MLZ_";

        /// <summary>Malzeme yazısının yüksekliği eleman yazısına oranı (açı yazısıyla aynı: 1,8 m yazıda 1,26 m).</summary>
        public const double YukseklikOrani = 0.7;

        /// <summary>Satırlar arası (yazı yüksekliğine oran; taban çizgisinden taban çizgisine).</summary>
        public const double SatirAraligi = 1.5;

        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

        /// <summary>Etiket bir malzeme satırı mı (MLZ_3 → 3).</summary>
        public static bool SatirMi(string etiket, out int sira)
        {
            sira = 0;
            return etiket != null && etiket.StartsWith(EtiketOnEki, StringComparison.OrdinalIgnoreCase)
                   && int.TryParse(etiket.Substring(EtiketOnEki.Length), NumberStyles.None, CultureInfo.InvariantCulture, out sira) && sira > 0;
        }

        public static bool SatirMi(string etiket)
        {
            int s;
            return SatirMi(etiket, out s);
        }

        public static string Etiket(int sira) => EtiketOnEki + sira.ToString(CultureInfo.InvariantCulture);

        /// <summary>Miktarın yazısı: en çok iki ondalık, ondalık virgül, binlik ayraçsız ("5", "2,5", "1250").</summary>
        public static string Miktar(double m) => SayiCoz.Temiz(m, 2).ToString("0.##", Tr);

        /// <summary>Giriş birimi ("mt/kg" → "mt"); adet (ad) yazılmaz.</summary>
        public static string GirisBirimi(string birim)
        {
            string g = (birim ?? "").Split('/')[0].Trim();
            return g.Length == 0 || string.Equals(g, "ad", StringComparison.OrdinalIgnoreCase) ? "" : g;
        }

        /// <summary>Tek satır: "AD=MİKTAR[ BİRİM] (DURUM)".</summary>
        public static string Satir(string ad, double miktar, string birim, string durum)
        {
            string b = GirisBirimi(birim);
            string d = (durum ?? "").Trim();
            return ad + "=" + Miktar(miktar) + (b.Length > 0 ? " " + b : "") + (d.Length > 0 ? " (" + d + ")" : "");
        }

        /// <summary>Elemanın çizimde yazılacak malzeme satırları (kural yukarıda).</summary>
        public static List<string> Satirlar(Eleman e)
        {
            var sonuc = new List<string>();
            if (e == null) return sonuc;
            var sira = new List<string>();
            var toplam = new Dictionary<string, double>(StringComparer.Ordinal);
            var parca = new Dictionary<string, string[]>(StringComparer.Ordinal);
            foreach (var k in e.Kalemler)
            {
                if (k == null || k.Ana || Math.Abs(k.Miktar) < 1e-9) continue;
                string ad = MalzemeYazimi.Duzelt(k.Tanim ?? "").Trim();
                if (ad.Length == 0) continue;
                string durum = string.IsNullOrWhiteSpace(k.Durum) ? (e.Durum ?? "") : k.Durum;
                string birim = GirisBirimi(k.Birim);
                string anahtar = ad + "\u0001" + birim + "\u0001" + durum.Trim();
                double t;
                if (toplam.TryGetValue(anahtar, out t)) { toplam[anahtar] = t + k.Miktar; continue; }
                toplam[anahtar] = k.Miktar;
                parca[anahtar] = new[] { ad, birim, durum };
                sira.Add(anahtar);
            }
            foreach (var a in sira)
            {
                var p = parca[a];
                sonuc.Add(Satir(p[0], toplam[a], p[1], p[2]));
            }
            return sonuc;
        }
    }
}
