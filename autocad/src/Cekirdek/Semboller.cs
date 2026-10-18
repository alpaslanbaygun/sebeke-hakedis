using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Sembol geometrisinin bir parçası (ortak/katalog/semboller.json ilkelleri).</summary>
    public sealed class SembolIlkeli
    {
        /// <summary>L doğru · C daire · P çoklu doğru · S dolu dörtgen · D dolu daire · Y yarım dolu daire</summary>
        public string Tur = "";
        /// <summary>L: x1 y1 x2 y2 · C: cx cy r · D/Y: r</summary>
        public double[] Sayilar = new double[0];
        /// <summary>P ve S: köşeler [x, y]</summary>
        public List<double[]> Noktalar = new List<double[]>();
        public bool Kapali;
    }

    public sealed class Sembol
    {
        public string Ad = "";          // ör. DIREK_AG_YENI (blok adı: SH_ + Ad)
        public string Aile = "";        // ör. DIREK_AG
        public string Varyant = "";     // YENI, MEVCUT, DMM, DM
        public double YariGenislik;     // metre (yazı konumları için)
        public List<SembolIlkeli> Ilkeller = new List<SembolIlkeli>();
    }

    /// <summary>
    /// Lejant simge takımı: eleman türü + malzeme (cins) + durumdan blok adı; ortak/katalog/semboller.json'dan
    /// geometri. Telefonun DXF çıktısı aynı tabloyu ve aynı blok adlarını kullanır.
    /// Boyutlar metre (1/1000 pafta); eklenti blokları PROMAGIS gibi 4 ölçekle konduğundan blok birimi = metre / 4.
    /// </summary>
    public static class Semboller
    {
        public const string OnEk = "SH_";
        /// <summary>Bloklar bu ölçekle konur; blok birimine çevirme böleni.</summary>
        public const double BlokOlcegi = 4;

        private static Dictionary<string, Sembol> _tablo;
        private static Dictionary<string, string> _aileAdlari;

        public static bool Yuklu => _tablo != null;

        /// <summary>semboller.json metnini yükler (eklenti: gömülü kaynak; test: dosya).</summary>
        public static void Yukle(string json)
        {
            var tablo = new Dictionary<string, Sembol>(StringComparer.Ordinal);
            var aileler = new Dictionary<string, string>(StringComparer.Ordinal);
            var kok = Json.Oku(json) as JsonNesne;
            if (kok == null) throw new InvalidOperationException("semboller.json okunamadı");
            var aileNesnesi = kok.Nesne("aileler");
            if (aileNesnesi != null)
                foreach (var kv in aileNesnesi)
                {
                    var a = kv.Value as JsonNesne;
                    aileler[kv.Key] = a != null ? a.Metin("ad", kv.Key) : kv.Key;
                }
            var semboller = kok.Nesne("semboller");
            if (semboller == null) throw new InvalidOperationException("semboller.json: 'semboller' yok");
            foreach (var kv in semboller)
            {
                var s = new Sembol { Ad = kv.Key };
                int alt = kv.Key.LastIndexOf('_');
                s.Aile = alt > 0 ? kv.Key.Substring(0, alt) : kv.Key;
                s.Varyant = alt > 0 ? kv.Key.Substring(alt + 1) : "";
                var aile = aileNesnesi != null ? aileNesnesi.Nesne(s.Aile) : null;
                s.YariGenislik = aile != null ? aile.Ondalik("yariGenislik", 2) : 2;
                var dizi = kv.Value as List<object>;
                if (dizi != null)
                    foreach (var x in dizi)
                    {
                        var ilkel = IlkelOku(x as List<object>);
                        if (ilkel != null) s.Ilkeller.Add(ilkel);
                    }
                tablo[kv.Key] = s;
            }
            _tablo = tablo;
            _aileAdlari = aileler;
        }

        private static SembolIlkeli IlkelOku(List<object> d)
        {
            if (d == null || d.Count == 0) return null;
            var p = new SembolIlkeli { Tur = Convert.ToString(d[0], CultureInfo.InvariantCulture) };
            if (p.Tur == "P" || p.Tur == "S")
            {
                var kose = d.Count > 1 ? d[1] as List<object> : null;
                if (kose != null)
                    foreach (var k in kose)
                    {
                        var xy = k as List<object>;
                        if (xy != null && xy.Count >= 2) p.Noktalar.Add(new[] { Sayi(xy[0]), Sayi(xy[1]) });
                    }
                p.Kapali = p.Tur == "S" || (d.Count > 2 && d[2] is bool && (bool)d[2]);
            }
            else
            {
                var s = new List<double>();
                for (int i = 1; i < d.Count; i++) s.Add(Sayi(d[i]));
                p.Sayilar = s.ToArray();
            }
            return p;
        }

        private static double Sayi(object o) => o is double ? (double)o : SayiCoz.Coz(Convert.ToString(o, CultureInfo.InvariantCulture), 0);

        /// <summary>Tablodaki tüm semboller (ad sırasıyla).</summary>
        public static IEnumerable<Sembol> Hepsi()
        {
            Denetle();
            var adlar = new List<string>(_tablo.Keys);
            adlar.Sort(StringComparer.Ordinal);
            foreach (var a in adlar) yield return _tablo[a];
        }

        public static IEnumerable<string> Aileler()
        {
            Denetle();
            return _aileAdlari.Keys;
        }

        public static string AileAdi(string aile)
        {
            Denetle();
            string ad;
            return _aileAdlari.TryGetValue(aile ?? "", out ad) ? ad : aile;
        }

        private static void Denetle()
        {
            if (_tablo == null) throw new InvalidOperationException("Sembol tablosu yüklenmedi (Semboller.Yukle)");
        }

        /// <summary>Eklentinin kendi bloğu mu (SH_ ile başlar)?</summary>
        public static bool EklentininBlogu(string blokAdi) =>
            !string.IsNullOrEmpty(blokAdi) && blokAdi.StartsWith(OnEk, StringComparison.OrdinalIgnoreCase);

        /// <summary>Blok adından sembol; tabloda yoksa null (eski SH_DIREK gibi adlar için çağıran geri düşer).</summary>
        public static Sembol Bul(string blokAdi)
        {
            if (_tablo == null || string.IsNullOrEmpty(blokAdi)) return null;
            string ad = blokAdi.StartsWith(OnEk, StringComparison.OrdinalIgnoreCase) ? blokAdi.Substring(OnEk.Length) : blokAdi;
            Sembol s;
            return _tablo.TryGetValue(ad.ToUpperInvariant(), out s) ? s : null;
        }

        // ---------------- Seçim: tür + malzeme + durum → blok adı ----------------

        /// <summary>Durumdan varyant: M, M+M → YENI · DM → DM · DM+M → DMM · diğerleri (MEVCUT, KM, ME, boş) → MEVCUT.</summary>
        public static string Varyant(string durum)
        {
            switch ((durum ?? "").Trim().ToUpperInvariant())
            {
                case "M":
                case "M+M": return "YENI";
                case "DM": return "DM";
                case "DM+M": return "DMM";
                default: return "MEVCUT";
            }
        }

        /// <summary>Cins yazısından malzeme: demir (kafes) mi? BETON / AĞAÇ geçiyorsa hayır; DEMİR, GLV, CVT, KAFES geçiyorsa evet.</summary>
        public static bool DemirMi(string cins)
        {
            string c = (cins ?? "").ToUpperInvariant().Replace('İ', 'I').Replace('Ğ', 'G').Replace('Ç', 'C');
            if (c.Contains("BETON") || c.Contains("AGAC")) return false;
            return c.Contains("DEMIR") || c.Contains("GLV") || c.Contains("CVT") || c.Contains("KAFES") || c.Contains("GALV");
        }

        /// <summary>Eleman türü ve cinsinden sembol ailesi.</summary>
        public static string Aile(string tur, string cins)
        {
            switch (tur ?? "")
            {
                case "AG_DIREK": return DemirMi(cins) ? "KAFES_AG" : "DIREK_AG";
                case "MUSTEREK_DIREK":
                case "ENH_DIREK": return DemirMi(cins) ? "KAFES_OG" : "DIREK_OG";
                case "AYD_DIREK": return "DIREK_AYD";
                case "TRAFO_DIREGI": return "TRAFO_DIREK";
                case "TRAFO_MERKEZI":
                    {
                        string c = (cins ?? "").ToUpperInvariant().Replace('İ', 'I');
                        return c.Contains("BINA") ? "TRAFO_BINA" : "TRAFO_KOSK";
                    }
                case "PANO": return "PANO";
                case "BOX": return "SDK";
                case "EK_MUFU": return "MUFU";
                case "KOFRE": return "KOFRE";
                default:
                    {
                        // Telefonun "diğer" nesneleri cinsle ayrılır: armatür, menhol, abone bağlantısı
                        string c = (cins ?? "").ToUpperInvariant().Replace('İ', 'I').Replace('Ü', 'U');
                        if (c.StartsWith("ARMATUR", StringComparison.Ordinal)) return "ARMATUR";
                        if (c.StartsWith("MENHOL", StringComparison.Ordinal)) return "MENHOL";
                        if (c.StartsWith("ABONE", StringComparison.Ordinal)) return "ABONE";
                        return "DIGER";
                    }
            }
        }

        /// <summary>Eklentinin bloğu: SH_&lt;aile&gt;_&lt;varyant&gt;, ör. SH_KAFES_AG_YENI.</summary>
        public static string BlokAdi(string tur, string cins, string durum) => OnEk + Aile(tur, cins) + "_" + Varyant(durum);

        public static string BlokAdi(Eleman e) => BlokAdi(e.Tur, e.Cins, e.Durum);
    }
}
