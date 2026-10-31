using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Bir hattaki bir iletken / kablo (çizim penceresinde ve şeritte seçilen): katalog kalemi ve adedi.</summary>
    public sealed class HatIletkeni
    {
        public KatalogKalemi Kesit;
        /// <summary>Aynı güzergâhta kaç tane (ör. 3 adet ALPEK → 3). En az 1.</summary>
        public int Adet = 1;

        public HatIletkeni() { }

        public HatIletkeni(KatalogKalemi kesit, int adet = 1)
        {
            Kesit = kesit;
            Adet = Math.Max(1, adet);
        }

        public override string ToString() => Kesit == null ? "" : Iletkenler.AdetYazimi(Kesit.Tanim.Trim(), Adet, true);
    }

    /// <summary>
    /// Bir hatta birden çok iletken (çoklu iletken, müşterek hat). çizim biçiminde her iletken hattın ayrı bir HAT
    /// satırıdır. Adet, telefondaki gibi satırın tam yazımına "3x(3X50/16+70 ALPEK)" biçiminde yazılır; miktar adet ×
    /// güzergâh metrajıdır (rapor da tel tel açılımı bu miktarla yapar). Hat etiketi ve ana kesit telefondaki gibi:
    /// OG iletkenler " + " ile, sonra " / ", sonra AG iletkenler " + " ile (ör. "3xSW / 3X25/16+35 ALPEK").
    /// </summary>
    public static class Iletkenler
    {
        private static readonly Regex AdetliYazi = new Regex(@"^\s*(\d+)\s*[xX×]\s*\((.+)\)\s*$", RegexOptions.CultureInvariant);

        /// <summary>"3x(3X50/16+70 ALPEK)" → adet 3, iç "3X50/16+70 ALPEK". Adetli yazım değilse false.</summary>
        public static bool AdetliMi(string yazi, out int adet, out string ic)
        {
            adet = 1;
            ic = yazi ?? "";
            var m = AdetliYazi.Match(yazi ?? "");
            if (!m.Success) return false;
            int n;
            if (!int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out n) || n < 1) return false;
            adet = n;
            ic = m.Groups[2].Value.Trim();
            return true;
        }

        /// <summary>Kalemin adedi (tam yazımdaki "3x(…)" ön ekinden); yoksa 1.</summary>
        public static int Adet(Kalem k)
        {
            if (k == null) return 1;
            int n;
            string ic;
            if (AdetliMi(k.Aciklama, out n, out ic)) return n;
            if (AdetliMi(k.Tanim, out n, out ic)) return n;
            return 1;
        }

        /// <summary>Adetli yazım: adet 1 ise tanımın kendisi (bos: adet 1'de "" döner), değilse "3x(tanım)".</summary>
        public static string AdetYazimi(string tanim, int adet, bool birdeTanim = false)
        {
            tanim = (tanim ?? "").Trim();
            if (adet <= 1) return birdeTanim ? tanim : "";
            return adet.ToString(CultureInfo.InvariantCulture) + "x(" + tanim + ")";
        }

        /// <summary>Kalemin etiketteki yazımı: tam yazım (adetli olabilir), yoksa tanım.</summary>
        public static string Yazi(Kalem k) => k == null ? "" : !string.IsNullOrEmpty(k.Aciklama) ? k.Aciklama : k.Tanim ?? "";

        /// <summary>OG iletken / kablo mu (cinsi OG_ ile başlar: OG_İLETKEN, OG_ALÜMİNYUM_KABLO, OG_BAKIR_KABLO).</summary>
        public static bool OgMu(string cins) => (cins ?? "").StartsWith("OG_", StringComparison.Ordinal);

        /// <summary>Hattın iletken / kablo (HAT) satırları, sırasıyla.</summary>
        public static List<Kalem> HatKalemleri(Hat h) => h == null ? new List<Kalem>() : h.Kalemler.FindAll(k => k.Kaynak == "HAT");

        /// <summary>Etiket ve ana kesit yazısı: OG'ler " + ", sonra " / ", sonra AG'ler " + " (telefondaki lineLabel ile aynı).</summary>
        public static string EtiketKesiti(IEnumerable<Kalem> hatKalemleri)
        {
            var og = new List<string>();
            var ag = new List<string>();
            foreach (var k in hatKalemleri)
            {
                if (k == null) continue;
                string y = Yazi(k).Trim();
                if (y.Length == 0) continue;
                (OgMu(k.Cins) ? og : ag).Add(y);
            }
            var parca = new List<string>();
            if (og.Count > 0) parca.Add(string.Join(" + ", og));
            if (ag.Count > 0) parca.Add(string.Join(" + ", ag));
            return string.Join(" / ", parca);
        }

        /// <summary>
        /// Seçilen iletkenlerin ana kesit yazısı: tek iletkende (adetli olsa da) tanımı — AutoCAD'deki gibi ("3(1x150/25)"
        /// satırının ana kesiti "1x150/25"); çoklu iletkende telefondaki birleşik yazım (OG + … / AG + …).
        /// </summary>
        public static string AnaKesit(IList<HatIletkeni> iletkenler)
        {
            if (iletkenler == null || iletkenler.Count == 0) return "";
            if (iletkenler.Count == 1) return iletkenler[0].Kesit != null ? iletkenler[0].Kesit.Tanim : "";
            var l = new List<Kalem>();
            foreach (var i in iletkenler)
            {
                if (i == null || i.Kesit == null) continue;
                l.Add(new Kalem { Cins = i.Kesit.Cins, Tanim = i.Kesit.Tanim, Aciklama = AdetYazimi(i.Kesit.Tanim, i.Adet) });
            }
            return EtiketKesiti(l);
        }

        /// <summary>Güzergâh metrajı: ilk HAT satırının miktarı / adedi (etikette yazılan uzunluk).</summary>
        public static double GuzergahMetraji(Hat h)
        {
            var l = HatKalemleri(h);
            if (l.Count == 0) return 0;
            return SayiCoz.Temiz(l[0].Miktar / Math.Max(1, Adet(l[0])));
        }

        /// <summary>Her HAT satırının miktarını güzergâh metrajı × adet yapar; değişen satır varsa true.</summary>
        public static bool MetrajUygula(Hat h, double guzergah)
        {
            bool degisti = false;
            foreach (var k in HatKalemleri(h))
            {
                double yeni = SayiCoz.Temiz(guzergah * Adet(k));
                if (Math.Abs(k.Miktar - yeni) < 1e-6) continue;
                k.Miktar = yeni;
                Metraj.Toplam(k);
                degisti = true;
            }
            return degisti;
        }

        /// <summary>a, b'yi içeriyor mu (boşluk ve büyük/küçük harf farkı gözetmeden)?</summary>
        public static bool Iceriyor(string a, string b)
        {
            string sa = KatalogKalemi.Sade(a), sb = KatalogKalemi.Sade(b);
            return sb.Length > 0 && sa.IndexOf(sb, StringComparison.Ordinal) >= 0;
        }

        /// <summary>
        /// Çizilmiş hattın iletkenini (tip, cins), türünü, durumunu ve hakedişini değiştirir (Hat Değiştir, SH_HATDEGISTIR):
        /// eski HAT satırları yerine seçilen iletkenlerin satırları gelir (aynı yerde; eski sıra numaraları yeniden
        /// kullanılır), diğer malzemelere dokunulmaz. Metraj korunur; tür değiştiyse yeni türün metrajı (çizim uzunluğu +
        /// türün payı, metrajVer) yazılır. Tür değiştiyse katman yeniden belirlenir (Katman boşaltılır). Hattın yeni
        /// güzergâh metrajı döner.
        /// </summary>
        public static double Degistir(Hat h, string tur, IList<HatIletkeni> iletkenler, string durum, int hakedis,
                                      Func<string, double> metrajVer, Func<string> sira, string karakteristik, bool koy)
        {
            if (h == null) throw new ArgumentNullException(nameof(h));
            bool turDegisti = !string.Equals(h.Tur ?? "", tur ?? "", StringComparison.Ordinal);
            double guzergah = GuzergahMetraji(h);
            if (turDegisti || guzergah <= 0) guzergah = metrajVer != null ? metrajVer(tur) : guzergah;
            // Eski HAT satırlarının yeri ve sıra numaraları
            int yer = -1;
            var siralar = new Queue<string>();
            for (int i = 0; i < h.Kalemler.Count; i++)
            {
                var k = h.Kalemler[i];
                if (k.Kaynak != "HAT") continue;
                if (yer < 0) yer = i;
                if (!string.IsNullOrEmpty(k.Sira)) siralar.Enqueue(k.Sira);
            }
            var kontrol = HatKalemleri(h).Count > 0 ? HatKalemleri(h)[0].Kontrol : null;
            h.Kalemler.RemoveAll(k => k.Kaynak == "HAT");
            if (yer < 0 || yer > h.Kalemler.Count) yer = 0;
            Func<string> siraVer = () => siralar.Count > 0 ? siralar.Dequeue() : (sira != null ? sira() : "");
            var yeni = Kalemler(iletkenler, guzergah, durum, hakedis, siraVer, karakteristik, koy);
            foreach (var k in yeni) if (kontrol != null) k.Kontrol = kontrol;
            h.Kalemler.InsertRange(yer, yeni);
            h.Tur = tur;
            h.AnaKesit = AnaKesit(iletkenler);
            h.Durum = durum;
            h.Hakedis = hakedis;
            if (turDegisti) h.Katman = "";
            return guzergah;
        }

        /// <summary>
        /// Seçilen iletkenlerden hattın HAT kalemleri (her iletken bir satır; adetliyse tam yazım "3x(…)", miktar adet ×
        /// metraj). Kalem sıra numarası her satıra ayrı verilir.
        /// </summary>
        public static List<Kalem> Kalemler(IList<HatIletkeni> iletkenler, double metraj, string durum, int hakedis, Func<string> sira, string karakteristik, bool koy)
        {
            var l = new List<Kalem>();
            if (iletkenler == null) return l;
            foreach (var i in iletkenler)
            {
                if (i == null || i.Kesit == null) continue;
                int adet = Math.Max(1, i.Adet);
                var k = Katalog.KalemYap(i.Kesit, SayiCoz.Temiz(metraj * adet), durum, hakedis, false, "HAT", sira != null ? sira() : "", "", karakteristik, koy);
                if (adet > 1) k.Aciklama = AdetYazimi(i.Kesit.Tanim, adet);
                l.Add(k);
            }
            return l;
        }
    }
}
