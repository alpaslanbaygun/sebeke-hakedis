using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Hesap Merkezi'nde kaydedilen bir hesap sonucu: hangi hesap (modül), hangi direk / hat / trafo / proje için,
    /// özet, ayrıntı (kullanılan girdiler, sonuç değerleri, uyarılar), modülün kendi durumu (hesabı yeniden açmak için)
    /// ve hesap anında projeden alınan değerler (proje sonradan değişirse "güncel değil" uyarısı bunlarla bulunur).
    /// Telefon ve eklenti aynı biçimi kullanır (proje dosyasında "hesaplar" dizisi; bkz. ortak/VERI-MODELI.md).
    /// </summary>
    public sealed class HesapKaydi
    {
        public string Id = "";
        /// <summary>Modül kimliği, ör. "enh-sehim", "tepe-tedas".</summary>
        public string Modul = "";
        public string ModulAdi = "";
        /// <summary>Modül paketinin içerik izi (hesap dosyası değişirse bilgi için).</summary>
        public string ModulSurumu = "";
        /// <summary>direk, hat, trafo, kanal, proje</summary>
        public string HedefTur = "";
        /// <summary>Hedef nesnenin kimliği: AutoCAD tanıtıcısı ya da telefon kaydı (proje hedefinde boş).</summary>
        public string HedefId = "";
        /// <summary>Ekranda görünen ad: GIS no, hat no...</summary>
        public string HedefNo = "";
        /// <summary>Hat hedefinde hattı oluşturan parçaların kimlikleri.</summary>
        public List<string> HedefParcalar = new List<string>();
        /// <summary>Trafo hedefinde hesaplanan çıkışın (kolun) trafodaki ilk hat parçası (boş = trafo bilgisiyle).</summary>
        public string HedefHatId = "";
        public string Ozet = "";
        /// <summary>uygun, uygun-degil, bilgi</summary>
        public string Durum = "";
        /// <summary>{ girdiler:[{ad,deger,birim}], degerler:[{ad,deger,birim}], uyarilar:[metin] }</summary>
        public JsonNesne Ayrinti = new JsonNesne();
        /// <summary>Modülün kendi durum verisi (JSON metni); hesap yeniden açılınca modüle geri yüklenir.</summary>
        public string ModulDurumu = "";
        /// <summary>Hesap anında projeden alınan değerler: { "hat.acikliklar[0].uzunluk": 62.3, ... }</summary>
        public JsonNesne Kullanilan = new JsonNesne();
        /// <summary>ISO 8601 zaman.</summary>
        public string Tarih = "";
        /// <summary>autocad / telefon</summary>
        public string Kaynak = "";
        public string Yapan = "";
        /// <summary>Kayıt telefonda açıldıysa telefondaki kimliği (geri gönderilince eşleşme için).</summary>
        public string TelefonId = "";

        public static readonly string[] HedefTurleri = { "direk", "hat", "trafo", "kanal", "proje" };

        public static string YeniKimlik()
        {
            // zaman (ms, onaltılık) + 8 rastgele bayt: sıralanabilir ve çakışmaz
            long ms = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
            var sb = new StringBuilder("H");
            sb.Append(ms.ToString("x11", CultureInfo.InvariantCulture));
            var b = new byte[8];
            using (var r = System.Security.Cryptography.RandomNumberGenerator.Create()) r.GetBytes(b);
            foreach (var x in b) sb.Append(x.ToString("x2", CultureInfo.InvariantCulture));
            return sb.ToString();
        }

        public static string DurumAdi(string durum)
        {
            switch (durum)
            {
                case "uygun": return "Uygun";
                case "uygun-degil": return "Uygun değil";
                case "bilgi": return "Bilgi";
                default: return string.IsNullOrEmpty(durum) ? "—" : durum;
            }
        }

        public JsonNesne Json()
        {
            var o = new JsonNesne();
            o["id"] = Id;
            o["modul"] = Modul;
            o["modulAdi"] = ModulAdi;
            if (!string.IsNullOrEmpty(ModulSurumu)) o["modulSurumu"] = ModulSurumu;
            var h = new JsonNesne();
            h["tur"] = HedefTur;
            h["id"] = HedefId;
            h["no"] = HedefNo;
            if (HedefParcalar.Count > 0) h["parcalar"] = new List<object>(HedefParcalar);
            if (!string.IsNullOrEmpty(HedefHatId)) h["hatId"] = HedefHatId;
            o["hedef"] = h;
            o["ozet"] = Ozet;
            o["durum"] = Durum;
            o["ayrinti"] = Ayrinti ?? new JsonNesne();
            o["modulDurumu"] = ModulDurumu ?? "";
            o["kullanilan"] = Kullanilan ?? new JsonNesne();
            o["tarih"] = Tarih;
            o["kaynak"] = Kaynak;
            if (!string.IsNullOrEmpty(Yapan)) o["yapan"] = Yapan;
            if (!string.IsNullOrEmpty(TelefonId)) o["telefonId"] = TelefonId;
            return o;
        }

        public static HesapKaydi Oku(JsonNesne o)
        {
            if (o == null) return null;
            var k = new HesapKaydi
            {
                Id = o.Metin("id"),
                Modul = o.Metin("modul"),
                ModulAdi = o.Metin("modulAdi"),
                ModulSurumu = o.Metin("modulSurumu"),
                Ozet = o.Metin("ozet"),
                Durum = o.Metin("durum"),
                Ayrinti = o.Nesne("ayrinti") ?? new JsonNesne(),
                Kullanilan = o.Nesne("kullanilan") ?? new JsonNesne(),
                Tarih = o.Metin("tarih"),
                Kaynak = o.Metin("kaynak"),
                Yapan = o.Metin("yapan"),
                TelefonId = o.Metin("telefonId"),
            };
            // modül durumu metin ya da nesne olarak gelebilir
            var md = o["modulDurumu"];
            k.ModulDurumu = md == null ? "" : md is string s ? s : Cekirdek.Json.Yaz(md, false);
            var h = o.Nesne("hedef");
            if (h != null)
            {
                k.HedefTur = h.Metin("tur");
                k.HedefId = h.Metin("id");
                k.HedefNo = h.Metin("no");
                k.HedefHatId = h.Metin("hatId");
                var p = h.Dizi("parcalar");
                if (p != null) foreach (var x in p) if (x is string ps && ps.Length > 0) k.HedefParcalar.Add(ps);
            }
            if (string.IsNullOrEmpty(k.Id) || string.IsNullOrEmpty(k.Modul)) return null;
            return k;
        }

        /// <summary>Ayrıntıdaki listeden "ad = değer birim" satırları (rapor için).</summary>
        public List<string> Satirlar(string liste)
        {
            var r = new List<string>();
            var d = Ayrinti?.Dizi(liste);
            if (d == null) return r;
            foreach (var x in d)
            {
                if (x is string s) { r.Add(s); continue; }
                var n = x as JsonNesne;
                if (n == null) continue;
                string ad = n.Metin("ad"), birim = n.Metin("birim");
                string deger = n["deger"] is double dd ? dd.ToString("0.###", CultureInfo.GetCultureInfo("tr-TR")) : n.Metin("deger");
                r.Add(ad + (deger.Length > 0 ? " = " + deger : "") + (birim.Length > 0 ? " " + birim : ""));
            }
            return r;
        }

        /// <summary>
        /// Aynı modül ve hedef için kayıt anahtarı (aynı hedefte modül başına bir güncel kayıt tutulur; trafoda her çıkış
        /// ayrı sayılır). Telefondaki kural (telefon/web/src/hesap/kayitlar.js) ile aynıdır.
        /// </summary>
        public string HedefAnahtari => Anahtar(Modul, HedefTur, HedefId, HedefHatId);

        public static string Anahtar(string modul, string tur, string id, string hatId) =>
            (modul ?? "") + "|" + (string.IsNullOrEmpty(tur) ? "proje" : tur) + "|" + (id ?? "") + "|" + (hatId ?? "");

        /// <summary>Kaydın hedefi (hesap bağlamını yeniden kurmak için).</summary>
        public HesapHedefi Hedef()
        {
            var h = new HesapHedefi { Tur = string.IsNullOrEmpty(HedefTur) ? "proje" : HedefTur, Id = HedefId ?? "", No = HedefNo ?? "", HatId = HedefHatId ?? "" };
            h.Parcalar.AddRange(HedefParcalar);
            return h;
        }

        /// <summary>Kayıt bu hedefe mi ait? (hatta parçalardan biri ortaksa aynı hat sayılır)</summary>
        public bool HedefAyni(HesapHedefi h)
        {
            string tur = string.IsNullOrEmpty(HedefTur) ? "proje" : HedefTur;
            string ht = h == null || string.IsNullOrEmpty(h.Tur) ? "proje" : h.Tur;
            if (tur != ht) return false;
            if (tur == "proje") return true;
            if ((HedefHatId ?? "") != (h.HatId ?? "")) return false;
            if (HedefId == h.Id) return true;
            if (tur != "hat") return false;
            foreach (var x in HedefParcalar) if (x == h.Id || h.Parcalar.Contains(x)) return true;
            return h.Parcalar.Contains(HedefId);
        }

        /// <summary>ISO 8601 UTC zaman (telefondaki Date.toISOString() ile aynı biçim; metin olarak sıralanabilir).</summary>
        public static string Simdi() => DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Hesabın güncelliği: hesap anında projeden alınan değerler ("kullanilan") ile hedefin bugünkü bağlamı karşılaştırılır.
    /// Yol yazımı: "hat.acikliklar[2].uzunluk", "direk.kollar[0].iletkenler[1].ad". Sayılar 1e-6 göreli payla, metinler
    /// birebir karşılaştırılır. Telefonda aynı kural telefon/web/src/hesap/guncellik.js içindedir.
    /// </summary>
    public static class HesapGuncellik
    {
        /// <summary>Bağlamda yolun gösterdiği değer; yoksa null (bulunamadı = true).</summary>
        public static object Deger(object kok, string yol, out bool bulunamadi)
        {
            bulunamadi = false;
            object c = kok;
            int i = 0;
            while (i < yol.Length)
            {
                if (yol[i] == '.') { i++; continue; }
                if (yol[i] == '[')
                {
                    int j = yol.IndexOf(']', i);
                    if (j < 0) { bulunamadi = true; return null; }
                    int n;
                    if (!int.TryParse(yol.Substring(i + 1, j - i - 1), NumberStyles.Integer, CultureInfo.InvariantCulture, out n)) { bulunamadi = true; return null; }
                    var d = c as List<object>;
                    if (d == null || n < 0 || n >= d.Count) { bulunamadi = true; return null; }
                    c = d[n];
                    i = j + 1;
                    continue;
                }
                int k = i;
                while (k < yol.Length && yol[k] != '.' && yol[k] != '[') k++;
                string ad = yol.Substring(i, k - i);
                var o = c as JsonNesne;
                if (o == null || !o.Var(ad)) { bulunamadi = true; return null; }
                c = o[ad];
                i = k;
            }
            return c;
        }

        public static bool Esit(object a, object b)
        {
            if (a == null || b == null) return a == null && b == null;
            if (a is double x && b is double y)
            {
                double m = Math.Max(1.0, Math.Max(Math.Abs(x), Math.Abs(y)));
                return Math.Abs(x - y) <= 1e-6 * m;
            }
            if (a is bool p && b is bool q) return p == q;
            if (a is string s && b is string t) return s.Trim() == t.Trim();
            if (a is double || b is double)
            {
                // sayı ↔ metin: metni sayıya çevirip karşılaştır
                double u = a is double ad ? ad : SayiCoz.Coz(a as string ?? "", double.NaN);
                double v = b is double bd ? bd : SayiCoz.Coz(b as string ?? "", double.NaN);
                return !double.IsNaN(u) && !double.IsNaN(v) && Esit(u, v);
            }
            return Cekirdek.Json.Yaz(a, false) == Cekirdek.Json.Yaz(b, false);
        }

        public sealed class Fark
        {
            public string Yol;
            public object Eski, Yeni;
            public bool Silindi;
            public override string ToString() =>
                Yol + ": " + Yazi(Eski) + " → " + (Silindi ? "(yok)" : Yazi(Yeni));
        }

        public static string Yazi(object d)
        {
            if (d == null) return "—";
            if (d is double x) return x.ToString("0.###", CultureInfo.GetCultureInfo("tr-TR"));
            if (d is string s) return s;
            return Cekirdek.Json.Yaz(d, false);
        }

        /// <summary>
        /// Hesap anındaki değerlerden bugün farklı olanlar (boşsa hesap günceldir). platformlarArasi: kayıt öbür
        /// platformda (telefon) yapıldıysa metinler yazım farkı yüzünden "değişti" sayılmaz; sayılar ve iletken adları
        /// (aynı iletken mi) karşılaştırılır. Telefondaki kural (ortak/hesap/kurallar.mjs) ile aynıdır.
        /// </summary>
        public static List<Fark> Farklar(JsonNesne kullanilan, object guncelBaglam, bool platformlarArasi = false)
        {
            var r = new List<Fark>();
            if (kullanilan == null) return r;
            foreach (var kv in kullanilan)
            {
                bool yok = true;
                object yeni = null;
                if (guncelBaglam != null) yeni = Deger(guncelBaglam, kv.Key, out yok);
                if (yok) { r.Add(new Fark { Yol = kv.Key, Eski = kv.Value, Silindi = true }); continue; }
                bool ayni = platformlarArasi ? PlatformlarArasiEsit(kv.Value, yeni) : Esit(kv.Value, yeni);
                if (!ayni) r.Add(new Fark { Yol = kv.Key, Eski = kv.Value, Yeni = yeni });
            }
            return r;
        }

        /// <summary>
        /// Kaydın bugünkü durumu: hedef silinmişse hedefYok; değilse hesap anındaki değerlerden değişenler (boş = güncel).
        /// platform: bu ortam ("autocad"); kayıt öbür platformda yapıldıysa metin yazım farkları sayılmaz.
        /// </summary>
        public static List<Fark> Durum(Proje p, HesapKaydi k, ProjeBilgisi bilgi, string platform, out bool hedefYok)
        {
            var hedef = k.Hedef();
            hedefYok = !HesapBaglami.HedefVar(p, hedef);
            if (hedefYok) return new List<Fark>();
            var b = HesapBaglami.Kur(p, hedef, bilgi);
            return Farklar(k.Kullanilan, b, !string.IsNullOrEmpty(k.Kaynak) && k.Kaynak != platform);
        }

        private static bool PlatformlarArasiEsit(object a, object b)
        {
            var s = a as string; var t = b as string;
            if (s == null || t == null) return Esit(a, b);
            string x = IletkenAnahtari(s), y = IletkenAnahtari(t);
            if (x != null && y != null) return x == y;
            return true; // tip adı gibi yazımı platforma göre değişen metinler karşılaştırılmaz
        }

        private static readonly string[][] Acsr =
        {
            new[] { "SWALLOW", @"SWALLOW|(^|[^A-Z])SW($|[^A-Z])" }, new[] { "RAVEN", @"RAVEN|(^|[^\d])1/0" }, new[] { "PIGEON", @"PIGEON|(^|[^\d])3/0" },
            new[] { "PARTRIDGE", "PARTRIDGE|PATRIDGE|266" }, new[] { "HAWK", "HAWK|477" }, new[] { "DRAKE", "DRAKE|795" },
        };

        /// <summary>İletken adının platformdan bağımsız anahtarı ("3xSW" = "3xSwallow" → "ACSR:SWALLOW"); iletken değilse null.</summary>
        public static string IletkenAnahtari(string ad)
        {
            string u = (ad ?? "").ToUpperInvariant().Replace('İ', 'I').Replace('\\', '/').Replace(',', '.').Replace('×', 'X');
            string k = System.Text.RegularExpressions.Regex.Replace(u, @"\s+", "");
            if (k.Length == 0) return null;
            var m = System.Text.RegularExpressions.Regex.Match(k, @"(\d)X(\d+(?:\.\d+)?)(?:/(\d+)|\+1X(\d+))?\+(\d+)");
            if (System.Text.RegularExpressions.Regex.IsMatch(u, "AER|ALPEK|ALP\\.|ABC"))
                return m.Success ? "ABC:" + m.Groups[1].Value + "x" + m.Groups[2].Value + "+" + m.Groups[5].Value : "ABC";
            if (System.Text.RegularExpressions.Regex.IsMatch(u, "XLPE|YE3SV|N2XSY|NA2XSY"))
            {
                var c = System.Text.RegularExpressions.Regex.Match(k, @"1X(\d+)");
                return (System.Text.RegularExpressions.Regex.IsMatch(u, "NA2X|ALM") ? "XLPE-AL:" : "XLPE-CU:") + (c.Success ? c.Groups[1].Value : "");
            }
            if (System.Text.RegularExpressions.Regex.IsMatch(u, "NAYY|NYY|N2XH|NA2XH|N2XY|NA2XY"))
            {
                var c = System.Text.RegularExpressions.Regex.Match(System.Text.RegularExpressions.Regex.Replace(k, "NAYY|NYY|N2XH|NA2XH|N2XY|NA2XY|ALM\\.?", ""), @"(\d)X(\d+)");
                return (System.Text.RegularExpressions.Regex.IsMatch(u, "NAYY|NA2X|ALM") ? "NAYY:" : "NYY:") + (c.Success ? c.Groups[1].Value + "x" + c.Groups[2].Value : "");
            }
            string govde = System.Text.RegularExpressions.Regex.Replace(k, @"^\d*\(?(\d+X)+\(?", ""); // "3xSW", "2(3xSW)" → "SW"
            foreach (var a in Acsr)
                if (System.Text.RegularExpressions.Regex.IsMatch(u, a[1]) || System.Text.RegularExpressions.Regex.IsMatch(govde, a[1])) return "ACSR:" + a[0];
            var g = System.Text.RegularExpressions.Regex.Match(k, @"^(\d)X?(PO|PH|R|L|I|P|A|O)(?:\+(PO|PH|R|L|I|P|A|O))?$");
            if (g.Success) return "AAC:" + g.Groups[1].Value + g.Groups[2].Value + "+" + g.Groups[3].Value;
            return null;
        }
    }
}
