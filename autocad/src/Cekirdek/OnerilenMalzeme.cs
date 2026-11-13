using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Önerilen malzeme (otomatik reçete) kuralları: ortak/katalog/onerilen-malzeme.json (eklentiye gömülü; telefonun
    /// standart tohumundaki recipeRules aynı dosyanın çevirisidir, motoru src/grid/recipe.js). Direk kuralları direğin
    /// grubu (volt-eslesme.json › cinsGruplari), rolü (taşıyıcı / durdurucu / nihayet / köşe), OG iletken sınıfı ve
    /// çıplak AG hat bağlı olup olmadığına göre travers, izolatör, topraklama… kalemleri önerir; kullanıcı işaretler.
    /// Telefonla ortak deneme: ortak/deneme/onerilen-malzeme (aynı bağlamdan aynı liste).
    /// </summary>
    public sealed class OnerilenMalzeme
    {
        public const string Bicim = "sebeke-hakedis.onerilen-malzeme";
        public static readonly string[] Roller = { "T", "D", "N", "Z" };
        public static readonly Dictionary<string, string> RolAdlari = new Dictionary<string, string>(StringComparer.Ordinal) { { "T", "Taşıyıcı" }, { "D", "Durdurucu" }, { "N", "Nihayet" }, { "Z", "Köşe" } };

        public sealed class Parametre { public string Anahtar = "", Ad = "", Birim = ""; public double Deger; }

        public sealed class KalemSablonu
        {
            public string Servis = "", Kaynak = "", Neden = "", Grup = "", Etiket = "";
            /// <summary>Sayı miktar; parametre adıysa MiktarParametre dolu, "$uzunluk" ise uzunluk.</summary>
            public double MiktarSayi; public string MiktarParametre = "";
        }

        public sealed class Kural
        {
            public int No; public string Nesne = "", Not = "";
            /// <summary>Koşullar: liste (değer listede olmalı) ya da mantık (eşit olmalı); hepsi sağlanmalı.</summary>
            public Dictionary<string, List<string>> ListeKosullari = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            public Dictionary<string, bool> MantikKosullari = new Dictionary<string, bool>(StringComparer.Ordinal);
            public List<KalemSablonu> Kalemler = new List<KalemSablonu>();
        }

        /// <summary>Direğin bağlamı (telefon recipeContext ile aynı alanlar).</summary>
        public sealed class DirekBaglami
        {
            public string Grup = "", Rol = "T", Tip = "";
            public bool IletkenBuyuk, IletkenCift, AgCiplak;
            /// <summary>Rolün nasıl bulunduğu (pencerede gösterilir).</summary>
            public string RolNedeni = "";
            public string Deger(string anahtar)
            {
                switch (anahtar)
                {
                    case "grup": return Grup ?? "";
                    case "rol": return Rol ?? "";
                    case "tip": return Tip ?? "";
                    default: return null;
                }
            }
            public bool? Mantik(string anahtar)
            {
                switch (anahtar)
                {
                    case "iletkenBuyuk": return IletkenBuyuk;
                    case "iletkenCift": return IletkenCift;
                    case "agCiplak": return AgCiplak;
                    default: return null;
                }
            }
        }

        /// <summary>Önerilen bir kalem: servis kodu, miktar, neden; AutoCAD kalemi (eşleme + katalog) ve direkte zaten var mı.</summary>
        public sealed class Oneri
        {
            public string Servis = "", Neden = "", Etiket = "", Cins = "", Tanim = "";
            public double Miktar; public int KuralNo;
            public KatalogKalemi Kalem;
            /// <summary>Direğin kalemlerinde aynı cins / tanım zaten var (miktarı).</summary>
            public double MevcutMiktar;
            public bool Var => MevcutMiktar > 0;
            /// <summary>Eşleme tablosunda servis kodunun AutoCAD karşılığı yok.</summary>
            public bool EslemeYok => Kalem == null;
        }

        public readonly List<Parametre> Parametreler = new List<Parametre>();
        public readonly List<Kural> Kurallar = new List<Kural>();
        public string Aciklama = "";

        private static OnerilenMalzeme _yuklu;
        public static OnerilenMalzeme Yuklu => _yuklu;
        public static void Yukle(string json) { _yuklu = Oku(json); }

        public static OnerilenMalzeme Oku(string json)
        {
            var k = Json.Oku(json) as JsonNesne;
            if (k == null || k.Metin("bicim") != Bicim) throw new FormatException("Önerilen malzeme tablosu okunamadı.");
            var o = new OnerilenMalzeme { Aciklama = k.Metin("aciklama") };
            var pl = k.Dizi("parametreler");
            if (pl != null) foreach (var x in pl) { var p = x as JsonNesne; if (p != null) o.Parametreler.Add(new Parametre { Anahtar = p.Metin("anahtar"), Ad = p.Metin("ad"), Birim = p.Metin("birim"), Deger = p.Ondalik("deger") }); }
            var kl = k.Dizi("kurallar");
            if (kl != null)
                foreach (var x in kl)
                {
                    var r = x as JsonNesne; if (r == null) continue;
                    var kural = new Kural { No = r.Tam("no"), Nesne = r.Metin("nesne"), Not = r.Metin("not") };
                    var kosul = r.Nesne("kosul");
                    if (kosul != null)
                        foreach (var kv in kosul)
                        {
                            var liste = kv.Value as List<object>;
                            if (liste != null) { var l = new List<string>(); foreach (var v in liste) l.Add(Convert.ToString(v, CultureInfo.InvariantCulture)); kural.ListeKosullari[kv.Key] = l; }
                            else if (kv.Value is bool) kural.MantikKosullari[kv.Key] = (bool)kv.Value;
                            else kural.ListeKosullari[kv.Key] = new List<string> { Convert.ToString(kv.Value, CultureInfo.InvariantCulture) };
                        }
                    var kalemler = r.Dizi("kalemler");
                    if (kalemler != null)
                        foreach (var y in kalemler)
                        {
                            var it = y as JsonNesne; if (it == null) continue;
                            var s = new KalemSablonu { Servis = it.Metin("servis"), Kaynak = it.Metin("kaynak"), Neden = it.Metin("neden"), Grup = it.Metin("grup"), Etiket = it.Metin("etiket") };
                            var m = it["miktar"];
                            if (m is double) s.MiktarSayi = (double)m;
                            else if (m is string) s.MiktarParametre = (string)m;
                            kural.Kalemler.Add(s);
                        }
                    o.Kurallar.Add(kural);
                }
            return o;
        }

        public double ParametreDegeri(string anahtar, IDictionary<string, double> ustune = null)
        {
            double v;
            if (ustune != null && ustune.TryGetValue(anahtar, out v)) return v;
            foreach (var p in Parametreler) if (p.Anahtar == anahtar) return p.Deger;
            return 0;
        }

        private static bool Uyar(Kural k, DirekBaglami b)
        {
            foreach (var kv in k.ListeKosullari) { var d = b.Deger(kv.Key); if (d == null || !kv.Value.Contains(d)) return false; }
            foreach (var kv in k.MantikKosullari) { var d = b.Mantik(kv.Key); if (d == null || d.Value != kv.Value) return false; }
            return true;
        }

        private static string Doldur(string sablon, DirekBaglami b)
        {
            return Regex.Replace(sablon ?? "", @"\{(\w+)\}", m =>
            {
                switch (m.Groups[1].Value)
                {
                    case "rol": string ad; return RolAdlari.TryGetValue(b.Rol ?? "", out ad) ? ad : (b.Rol ?? "");
                    case "tip": return b.Tip ?? "";
                    default: return "";
                }
            });
        }

        /// <summary>
        /// Direk bağlamına uyan kuralların kalemleri (telefon applyRules ile aynı sıra ve miktarlar; direğin kendisi — kaynak
        /// "kendisi" — listede yok). esle: servis kodu → AutoCAD katalog kalemi (null: eşleme yok; öneri yine listelenir).
        /// </summary>
        public List<Oneri> Direk(DirekBaglami b, Func<string, KatalogKalemi> esle, IDictionary<string, double> parametreUstune = null)
        {
            var out_ = new List<Oneri>();
            foreach (var k in Kurallar)
            {
                if (k.Nesne != "direk" || !Uyar(k, b)) continue;
                foreach (var it in k.Kalemler)
                {
                    if (it.Kaynak.Length > 0 || it.Servis.Length == 0) continue;
                    double miktar = it.MiktarParametre.Length > 0 ? (it.MiktarParametre == "$uzunluk" ? 0 : ParametreDegeri(it.MiktarParametre, parametreUstune)) : it.MiktarSayi;
                    if (!(miktar > 0)) continue;
                    var kalem = esle != null ? esle(it.Servis) : null;
                    out_.Add(new Oneri { Servis = it.Servis, Miktar = miktar, Neden = Doldur(it.Neden, b), Etiket = it.Etiket, KuralNo = k.No, Kalem = kalem, Cins = kalem != null ? kalem.Cins : "", Tanim = kalem != null ? kalem.Tanim : "" });
                }
            }
            return out_;
        }

        /// <summary>Servis kodu → AutoCAD katalog kalemi: volt-eslesme.json › kalemler (cins / tanım) → katalog (yoksa eşlemedeki adla açılır).</summary>
        public static Func<string, KatalogKalemi> Esleyici(JsonNesne voltEslesme, Katalog katalog)
        {
            var tablo = voltEslesme != null ? voltEslesme.Nesne("kalemler") : null;
            return servis =>
            {
                var e = tablo != null ? tablo.Nesne(servis) : null;
                if (e == null) return null;
                string cins = e.Metin("cins"), tanim = e.Metin("tanim");
                if (cins.Length == 0 || tanim.Length == 0) return null;
                var k = katalog != null ? katalog.Bul(cins, tanim) : null;
                if (k == null && katalog != null) k = katalog.Ekle(cins, tanim, "ad/ad", 1, "", "malzeme", null, 0);
                return k ?? new KatalogKalemi { Cins = cins, Tanim = tanim };
            };
        }

        /// <summary>Direğin grubu (volt-eslesme.json › cinsGruplari: AG_DEMİR_GLV → sehir …); bilinmeyen cinste "".</summary>
        public static string Grup(JsonNesne voltEslesme, string cins)
        {
            var t = voltEslesme != null ? voltEslesme.Nesne("cinsGruplari") : null;
            if (t == null) return "";
            var c = CinsKodu.Duzelt(cins) ?? "";
            return t.Metin(c, t.Metin(cins ?? ""));
        }

        /// <summary>Direk tipindeki iletken sınıfı: parantez içi ("G-T-12 (sw)" → "sw", "GT-25 (2x477)" → "2x477").</summary>
        public static string IletkenSinifi(string tip)
        {
            var m = Regex.Match(tip ?? "", @"\(([^()]*)\)\s*$");
            return m.Success ? m.Groups[1].Value.Trim().ToLowerInvariant() : "";
        }

        private static bool HavaiMi(string tur) { var t = (tur ?? "").Replace('İ', 'I').ToUpperInvariant(); return !t.Contains("YERALTI") && Regex.IsMatch(t, "HAVAI|MUSTEREK|AYDINLATMA|REKORTMAN|ABONE|ENH"); }
        private static bool OgMu(string tur) { var t = (tur ?? "").Replace('İ', 'I').ToUpperInvariant(); return t.Contains("OG") || t.Contains("ENH"); }
        private static bool AgMi(string tur) { var t = (tur ?? "").Replace('İ', 'I').ToUpperInvariant(); return t == "AG_HAVAI" || t == "MUSTEREK" || t == "AYDINLATMA"; }

        /// <summary>
        /// Direğin bağlamı çizimden: grup cinsten; bağlı havai hatlar (köşesi direğe tol içinde) yön sayısı ve sapma açısından
        /// rol — hat yok: taşıyıcı; tek yön: nihayet; iki yön: sapma ≤ eşik taşıyıcı, yoksa köşe; üç ve çok yön: durdurucu
        /// (branşman). Telefonda hat düğümlerinden aynı sınıflama (computePoleRoles). İletken sınıfı direk tipinden (477 →
        /// büyük, 2x… → çift devre), yoksa bağlı OG hattın kesitinden; çıplak AG: bağlı AG / müşterek / aydınlatma hatta
        /// AG_İLETKEN kalemi (demetli ALPEK değil).
        /// </summary>
        public static DirekBaglami Baglam(Proje p, Eleman e, JsonNesne voltEslesme, double tol = 3.5, double koseEsigi = 3)
        {
            var b = new DirekBaglami { Grup = Grup(voltEslesme, e.Cins), Tip = e.Tip ?? "" };
            var sinif = IletkenSinifi(e.Tip);
            b.IletkenBuyuk = sinif.Contains("477");
            b.IletkenCift = sinif.StartsWith("2x", StringComparison.Ordinal);
            var yonler = new List<double[]>();
            string ogKesit = "";
            foreach (var h in p.Hatlar)
            {
                if (!HavaiMi(h.Tur) || h.Kose.Count < 2) continue;
                bool bagli = false;
                for (int i = 0; i < h.Kose.Count; i++)
                {
                    var k = h.Kose[i];
                    if (Math.Sqrt((k[0] - e.Saga) * (k[0] - e.Saga) + (k[1] - e.Yukari) * (k[1] - e.Yukari)) > tol) continue;
                    bagli = true;
                    if (i > 0) yonler.Add(Yon(k, h.Kose[i - 1]));
                    if (i < h.Kose.Count - 1) yonler.Add(Yon(k, h.Kose[i + 1]));
                }
                if (!bagli) continue;
                if (OgMu(h.Tur) && ogKesit.Length == 0) { Kalem ana = null; foreach (var x in h.Kalemler) if (x.Ana) { ana = x; break; } ogKesit = ana != null ? ana.Tanim : h.AnaKesit; }
                if (AgMi(h.Tur)) foreach (var x in h.Kalemler) if ((CinsKodu.Duzelt(x.Cins) ?? x.Cins ?? "") == "AG_İLETKEN") { b.AgCiplak = true; break; }
            }
            if (sinif.Length == 0 && ogKesit.Length > 0) { var u = ogKesit.Replace('İ', 'I').ToUpperInvariant(); b.IletkenBuyuk = u.Contains("477"); b.IletkenCift = Regex.IsMatch(u, @"^\s*2\s*X\s*3"); }
            // Rol: aynı doğrultudaki yönler (üst üste çizilmiş iki hat) tek sayılır
            var tekil = new List<double[]>();
            foreach (var y in yonler) { bool var_ = false; foreach (var t in tekil) if (Math.Abs(Sapma(t, y)) < 0.5) { var_ = true; break; } if (!var_) tekil.Add(y); }
            if (tekil.Count == 0) { b.Rol = "T"; b.RolNedeni = "Hat bağlantısı yok; taşıyıcı sayıldı"; }
            else if (tekil.Count == 1) { b.Rol = "N"; b.RolNedeni = "Hat sonu (nihayet)"; }
            else if (tekil.Count == 2)
            {
                double sapma = 180 - Sapma(tekil[0], tekil[1]);
                if (sapma > koseEsigi) { b.Rol = "Z"; b.RolNedeni = "Sapma açısı " + sapma.ToString("0.0", CultureInfo.GetCultureInfo("tr-TR")) + "° > " + koseEsigi.ToString("0", CultureInfo.InvariantCulture) + "°"; }
                else { b.Rol = "T"; b.RolNedeni = "Hat üzerinde düz geçiş"; }
            }
            else { b.Rol = "D"; b.RolNedeni = "Branşman (ayrılma) direği: " + tekil.Count + " yön"; }
            return b;
        }

        private static double[] Yon(double[] a, double[] b) { double dx = b[0] - a[0], dy = b[1] - a[1], l = Math.Sqrt(dx * dx + dy * dy); return l > 0 ? new[] { dx / l, dy / l } : new[] { 0.0, 0.0 }; }
        /// <summary>İki birim yön arasındaki açı (derece, 0–180).</summary>
        private static double Sapma(double[] a, double[] b) { double c = Math.Max(-1, Math.Min(1, a[0] * b[0] + a[1] * b[1])); return Math.Acos(c) * 180 / Math.PI; }
    }
}
