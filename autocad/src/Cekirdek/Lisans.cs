using System;
using System.Globalization;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Lisansın yükü (imzalı JSON): kime, hangi cihaz, hangi ürün, bitiş (boş: süresiz).</summary>
    public sealed class LisansBilgisi
    {
        public string No = "", Ad = "", Cihaz = "", Urun = "hepsi", Verildi = "", Bitis = "";
    }

    /// <summary>Lisans durumu (Lisans.Durum).</summary>
    public sealed class LisansDurumu
    {
        /// <summary>"lisansli" | "deneme" | "bitti".</summary>
        public string Tur = "bitti";
        public bool Kullanilabilir;
        /// <summary>Kalan gün (süresiz lisansta null).</summary>
        public int? KalanGun;
        /// <summary>Uyarı gösterilsin mi (deneme sürümü ya da bitişe 15 gün ve daha az).</summary>
        public bool Uyari;
        /// <summary>"" | "okunamadi" | "imza" | "cihaz" | "urun" | "sure".</summary>
        public string HataKodu = "";
        public string Hata = "";
        public bool SaatGeri;
        public LisansBilgisi Bilgi;
        public string Mesaj = "";
    }

    /// <summary>
    /// Lisans (13.11.2026; kullanıcı kararları: AutoCAD eklentisi ve telefon, internetsiz ve cihaza bağlı, bitiş tarihi her
    /// lisansta seçilir ya da süresiz, lisanssız 7 gün çalışır sonra kapanır). Telefondaki core/lisans.js ile aynı kurallar;
    /// ortak denemeler ortak/deneme/lisans/vektorler.json. Biçim ve araçlar: ortak/LISANS.md.
    /// Cihaz kodu: önek ("PC" eklenti) + SHA-256("sebeke-hakedis|cihaz|" + ham kimlik) ilk 10 baytı, Crockford base32.
    /// Lisans metni: "SHL1." + base64url(yük) + "." + base64url(imza); imza "SHL1." + base64url(yük) metninin
    /// RSASSA-PKCS1-v1_5 / SHA-256 imzası (2048 bit). Doğrulama elle yapılır (BigInteger) — .NET 4.6 ile 8 aynı sonucu verir.
    /// </summary>
    public static class Lisans
    {
        public const string Onek = "SHL1";
        public const int DenemeGun = 7, UyariGun = 15;
        private const string B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        private static readonly byte[] DigestInfo = { 0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20 };

        /// <summary>Açık anahtar: modül (base64url) ve üs.</summary>
        public sealed class AcikAnahtar
        {
            public string N = "";
            public int E = 65537;
            public static AcikAnahtar Oku(string json)
            {
                var o = Json.Oku(json) as JsonNesne;
                if (o == null) return null;
                return new AcikAnahtar { N = o.Metin("n"), E = o.Tam("e", 65537) };
            }
        }

        public static byte[] Sha256(byte[] b) { using (var h = SHA256.Create()) return h.ComputeHash(b); }

        /// <summary>Ham cihaz kimliğinden (Windows MachineGuid) gösterilen cihaz kodu: PC-ABCD-EFGH-JKMN-PQRS.</summary>
        public static string CihazKodu(string onek, string ham)
        {
            var h = Sha256(Encoding.UTF8.GetBytes("sebeke-hakedis|cihaz|" + (ham ?? "").Trim().ToLowerInvariant()));
            var sb = new StringBuilder();
            int bit = 0, deger = 0;
            for (int i = 0; i < 10; i++)
            {
                deger = (deger << 8) | h[i]; bit += 8;
                while (bit >= 5) { sb.Append(B32[(deger >> (bit - 5)) & 31]); bit -= 5; }
                deger &= (1 << bit) - 1;
            }
            string s = sb.ToString();
            return (onek ?? "PC").ToUpperInvariant() + "-" + s.Substring(0, 4) + "-" + s.Substring(4, 4) + "-" + s.Substring(8, 4) + "-" + s.Substring(12, 4);
        }

        /// <summary>Cihaz kodunu karşılaştırmak için sadeleştirir (büyük harf, boşluksuz).</summary>
        public static string KodSade(string k) => Regex.Replace((k ?? "").ToUpperInvariant(), @"\s+", "");

        /// <summary>Metnin içinden lisansı bulur (boşluklar ve satır sonları atılır; açıklama satırları yok sayılır).</summary>
        public static string Ayikla(string metin)
        {
            var m = Regex.Match(Regex.Replace(metin ?? "", @"\s+", ""), @"SHL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+");
            return m.Success ? m.Value : "";
        }

        public static byte[] B64uCoz(string s)
        {
            string t = (s ?? "").Replace('-', '+').Replace('_', '/');
            t += new string('=', (4 - t.Length % 4) % 4);
            return Convert.FromBase64String(t);
        }

        /// <summary>Lisansın yükü (imzaya bakmadan); okunamazsa null.</summary>
        public static LisansBilgisi Coz(string metin)
        {
            string l = Ayikla(metin);
            if (l.Length == 0) return null;
            try
            {
                var p = l.Split('.');
                var o = Json.Oku(Encoding.UTF8.GetString(B64uCoz(p[1]))) as JsonNesne;
                if (o == null || o.Tam("v") != 1 || o.Metin("cihaz").Length == 0) return null;
                return new LisansBilgisi
                {
                    No = o.Metin("no"), Ad = o.Metin("ad"), Cihaz = o.Metin("cihaz"), Urun = o.Metin("urun", "hepsi"),
                    Verildi = o.Metin("verildi"), Bitis = o.Metin("bitis"),
                };
            }
            catch { return null; }
        }

        private static BigInteger Sayi(byte[] bigEndian)
        {
            var le = new byte[bigEndian.Length + 1];
            for (int i = 0; i < bigEndian.Length; i++) le[i] = bigEndian[bigEndian.Length - 1 - i];
            return new BigInteger(le);
        }

        /// <summary>İmza doğrulama (RSASSA-PKCS1-v1_5, SHA-256).</summary>
        public static bool ImzaDogru(string metin, AcikAnahtar a)
        {
            string l = Ayikla(metin);
            if (l.Length == 0 || a == null || string.IsNullOrEmpty(a.N)) return false;
            try
            {
                var p = l.Split('.');
                var nB = B64uCoz(a.N);
                int k = nB.Length;
                var sig = B64uCoz(p[2]);
                if (sig.Length != k) return false;
                BigInteger n = Sayi(nB), s = Sayi(sig);
                if (s >= n) return false;
                var m = BigInteger.ModPow(s, a.E, n);
                var le = m.ToByteArray();
                var em = new byte[k];
                for (int i = 0; i < le.Length && i < k; i++) em[k - 1 - i] = le[i];
                if (le.Length > k && !(le.Length == k + 1 && le[k] == 0)) return false;
                var h = Sha256(Encoding.ASCII.GetBytes(p[0] + "." + p[1]));
                int ps = k - 3 - DigestInfo.Length - h.Length;
                if (ps < 8 || em[0] != 0 || em[1] != 1 || em[2 + ps] != 0) return false;
                for (int i = 0; i < ps; i++) if (em[2 + i] != 0xff) return false;
                for (int i = 0; i < DigestInfo.Length; i++) if (em[3 + ps + i] != DigestInfo[i]) return false;
                for (int i = 0; i < h.Length; i++) if (em[3 + ps + DigestInfo.Length + i] != h[i]) return false;
                return true;
            }
            catch { return false; }
        }

        /// <summary>Tarih yazısı (YYYY-AA-GG) → gün sayısı; okunamazsa null.</summary>
        public static int? Gun(string t)
        {
            DateTime d;
            if (string.IsNullOrEmpty(t) || !DateTime.TryParseExact(t, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d)) return null;
            return (int)(d - new DateTime(1970, 1, 1)).TotalDays;
        }
        public static string Bugun(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        private static string TarihTr(string t) { var g = Gun(t); return g == null ? t ?? "" : t.Substring(8, 2) + "." + t.Substring(5, 2) + "." + t.Substring(0, 4); }

        private static string HataMetni(string kod, LisansBilgisi b)
        {
            switch (kod)
            {
                case "okunamadi": return "Lisans okunamadı: metni eksiksiz yapıştırın.";
                case "imza": return "Lisans geçersiz (imza tutmuyor).";
                case "cihaz": return "Lisans başka bir cihaz için üretilmiş (" + (b != null ? b.Cihaz : "") + ").";
                case "urun": return "Lisans bu program için değil.";
                case "sure": return "Lisansın süresi doldu (" + TarihTr(b != null ? b.Bitis : "") + ").";
                default: return "";
            }
        }

        /// <summary>
        /// Lisans durumu (telefondaki lisansDurumu ile aynı). urun: "eklenti" | "telefon"; tarihler YYYY-AA-GG. Saat geri
        /// alınmışsa (bugün son görülmeden 1 günden fazla önce) son görülme tarihi esas alınır.
        /// </summary>
        public static LisansDurumu Durum(string lisans, string cihaz, string urun, string bugun, string ilkAcilis, string sonGorulme, AcikAnahtar a)
        {
            int? b = Gun(bugun), son = Gun(sonGorulme), ilk = Gun(ilkAcilis);
            bool saatGeri = b != null && son != null && b < son - 1;
            int etkin = Math.Max(b ?? 0, son ?? b ?? 0);
            string hk = "";
            LisansBilgisi bilgi = null;
            if (Ayikla(lisans).Length > 0)
            {
                bilgi = Coz(lisans);
                if (bilgi == null) hk = "okunamadi";
                else if (!ImzaDogru(lisans, a)) hk = "imza";
                else if (KodSade(bilgi.Cihaz) != KodSade(cihaz)) hk = "cihaz";
                else if (bilgi.Urun != "hepsi" && bilgi.Urun != urun) hk = "urun";
                else if (bilgi.Bitis.Length > 0 && (Gun(bilgi.Bitis) == null || etkin > Gun(bilgi.Bitis).Value)) hk = "sure";
                else
                {
                    int? kalan = bilgi.Bitis.Length > 0 ? Gun(bilgi.Bitis).Value - etkin : (int?)null;
                    return new LisansDurumu
                    {
                        Tur = "lisansli", Kullanilabilir = true, KalanGun = kalan, Uyari = kalan != null && kalan <= UyariGun, SaatGeri = saatGeri, Bilgi = bilgi,
                        Mesaj = "Lisanslı: " + (bilgi.Ad.Length > 0 ? bilgi.Ad : "kayıtlı kullanıcı") + (bilgi.Bitis.Length > 0 ? " · bitiş " + TarihTr(bilgi.Bitis) + " (" + kalan + " gün kaldı)" : " · süresiz"),
                    };
                }
            }
            string hata = HataMetni(hk, bilgi);
            int gecen = ilk == null ? 0 : Math.Max(0, etkin - ilk.Value);
            int kalanD = DenemeGun - gecen;
            if (kalanD > 0)
                return new LisansDurumu { Tur = "deneme", Kullanilabilir = true, KalanGun = kalanD, Uyari = true, HataKodu = hk, Hata = hata, SaatGeri = saatGeri, Bilgi = bilgi, Mesaj = "Deneme sürümü: " + kalanD + " gün kaldı" + (hata.Length > 0 ? " · " + hata : "") };
            return new LisansDurumu
            {
                Tur = "bitti", Kullanilabilir = false, KalanGun = 0, Uyari = true, HataKodu = hk, Hata = hata, SaatGeri = saatGeri, Bilgi = bilgi,
                Mesaj = hk == "sure" ? hata + " Yeni lisans girin." : hata.Length > 0 ? hata + " Deneme süresi de doldu." : "Deneme süresi doldu. Devam etmek için lisans girin.",
            };
        }
    }
}
