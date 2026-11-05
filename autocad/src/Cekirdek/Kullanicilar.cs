using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Proje kullanıcısı (telefondaki üye): ad, rol, şifre özeti. Proje dosyasında proje.kullanicilar; çizimde
    /// SEBEKE_HAKEDIS › KULLANICILAR. Şifre düz yazıyla hiçbir yerde tutulmaz.
    /// </summary>
    public sealed class Kullanici
    {
        public string Id = "", Ad = "", Rol = "", Tuz = "", Ozet = "", Guncelleme = "";
        public bool Etkin = true;

        public Kullanici Kopya() => (Kullanici)MemberwiseClone();

        /// <summary>Dosyadaki kayıttan (telefondaki sh-core kullaniciOku ile aynı kural); kimliksizse null.</summary>
        public static Kullanici Oku(JsonNesne o)
        {
            if (o == null) return null;
            string id = o.Metin("id").Trim();
            if (id.Length == 0) return null;
            return new Kullanici
            {
                Id = id, Ad = o.Metin("ad"), Rol = o.Metin("rol"), Tuz = o.Metin("tuz"), Ozet = o.Metin("ozet"),
                Etkin = !(o["etkin"] is bool b && !b), Guncelleme = o.Metin("guncelleme"),
            };
        }

        public JsonNesne Json()
        {
            var o = new JsonNesne();
            o["id"] = Id; o["ad"] = Ad; o["rol"] = Rol; o["tuz"] = Tuz; o["ozet"] = Ozet; o["etkin"] = Etkin; o["guncelleme"] = Guncelleme;
            return o;
        }

        public override string ToString() => Ad + " · " + Roller.Ad(Rol);
    }

    /// <summary>
    /// Onay ayarı (telefondaki approval): kontrol edilmiş kaydı kilitle, hakedişe yalnız kontrol edilmiş işler (telefonda
    /// kullanılır, eklenti taşır) ve hakediş yetkisi: yazmaya kapalı hakedişler (iki tarafta da uygulanır).
    /// </summary>
    public sealed class OnayAyari
    {
        public bool Kilit = true, Siki = true;
        public SortedSet<int> KapaliHakedisler = new SortedSet<int>();
        public string Guncelleme = "";

        public OnayAyari Kopya() => new OnayAyari { Kilit = Kilit, Siki = Siki, KapaliHakedisler = new SortedSet<int>(KapaliHakedisler), Guncelleme = Guncelleme };

        /// <summary>Dosyadaki kayıttan (sh-core onayAyariOku ile aynı: yalnız pozitif tam sayılar, tekrarsız, artan).</summary>
        public static OnayAyari Oku(JsonNesne o)
        {
            if (o == null) return null;
            var a = new OnayAyari { Kilit = !(o["kilit"] is bool k && !k), Siki = !(o["siki"] is bool s && !s), Guncelleme = o.Metin("guncelleme") };
            var d = o.Dizi("kapaliHakedisler");
            if (d != null)
                foreach (var x in d)
                    if (x is double n && n > 0 && n <= int.MaxValue && Math.Floor(n) == n) a.KapaliHakedisler.Add((int)n);
            return a;
        }

        public JsonNesne Json()
        {
            var o = new JsonNesne();
            o["kilit"] = Kilit; o["siki"] = Siki;
            var l = new List<object>();
            foreach (var n in KapaliHakedisler) l.Add(n);
            o["kapaliHakedisler"] = l;
            o["guncelleme"] = Guncelleme;
            return o;
        }
    }

    /// <summary>Rol (ortak/katalog/roller.json).</summary>
    public sealed class Rol
    {
        public string Id = "", Ad = "", Kisa = "", Renk = "", Gorev = "";
        public override string ToString() => Ad;
    }

    /// <summary>
    /// Roller, işlem yetkileri ve şifre kuralı: telefonla ortak tablo (ortak/katalog/roller.json; eklentiye gömülü,
    /// telefonda src/ortak/roller.js → core/roles.js). Kullanmadan önce Yukle ile yüklenir.
    /// </summary>
    public static class Roller
    {
        public const string Yonetici = "yonetici";
        public const string KontrolOnayi = "autocad.kontrol", HakedisOnayi_ = "autocad.hakedis", GisOnayi = "autocad.gis";
        public const string HakedisYetkisi = "hakedis.yetkisi", KullaniciYonetimi = "members.manage";

        private static readonly List<Rol> _liste = new List<Rol>();
        private static readonly Dictionary<string, List<string>> _islemler = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        private static readonly Dictionary<string, string> _islemAdlari = new Dictionary<string, string>(StringComparer.Ordinal);

        public static bool Yuklu { get; private set; }
        public static IList<Rol> Liste => _liste;
        public static int SifreEnAz { get; private set; } = 4;
        public static int SifreEnCok { get; private set; } = 8;
        public static int SifreTur { get; private set; } = 1200;
        public static int YanlisDeneme { get; private set; } = 5;
        public static int BeklemeSaniye { get; private set; } = 60;

        public static void Yukle(string json)
        {
            var k = Json.Oku(json) as JsonNesne;
            if (k == null || k.Metin("bicim") != "sebeke-hakedis.roller") throw new FormatException("Roller tablosu okunamadı.");
            _liste.Clear(); _islemler.Clear(); _islemAdlari.Clear();
            var rl = k.Dizi("roller");
            if (rl != null)
                foreach (var x in rl)
                    if (x is JsonNesne r) _liste.Add(new Rol { Id = r.Metin("id"), Ad = r.Metin("ad"), Kisa = r.Metin("kisa"), Renk = r.Metin("renk"), Gorev = r.Metin("gorev") });
            var isl = k.Nesne("islemler");
            if (isl != null)
                foreach (var kv in isl)
                {
                    var l = new List<string>();
                    if (kv.Value is List<object> d) foreach (var x in d) l.Add(Convert.ToString(x, CultureInfo.InvariantCulture));
                    _islemler[kv.Key] = l;
                }
            var ad = k.Nesne("islemAdlari");
            if (ad != null) foreach (var kv in ad) _islemAdlari[kv.Key] = Convert.ToString(kv.Value, CultureInfo.InvariantCulture);
            var s = k.Nesne("sifre");
            if (s != null)
            {
                SifreEnAz = s.Tam("enAz", 4); SifreEnCok = s.Tam("enCok", 8); SifreTur = s.Tam("tur", 1200);
                YanlisDeneme = s.Tam("yanlisDeneme", 5); BeklemeSaniye = s.Tam("beklemeSaniye", 60);
            }
            Yuklu = true;
        }

        public static Rol Bul(string id) => _liste.Find(r => r.Id == id);
        public static string Ad(string id) { var r = Bul(id); return r != null ? r.Ad : (id ?? ""); }

        /// <summary>İşlemi yapabilen roller (tanımsız işlem yalnız Yönetici).</summary>
        public static IList<string> IslemRolleri(string islem)
        {
            List<string> l;
            return _islemler.TryGetValue(islem ?? "", out l) ? l : new List<string> { Yonetici };
        }

        public static string IslemAdi(string islem)
        {
            string a;
            return _islemAdlari.TryGetValue(islem ?? "", out a) ? a : islem;
        }

        public static bool Yapabilir(string rol, string islem) => !string.IsNullOrEmpty(rol) && IslemRolleri(islem).Contains(rol);

        /// <summary>"Kontrol mühendisi ya da Yönetici".</summary>
        public static string Kimler(string islem)
        {
            var l = new List<string>();
            foreach (var r in IslemRolleri(islem)) l.Add(Ad(r));
            return string.Join(" ya da ", l.ToArray());
        }
    }

    /// <summary>
    /// Kullanıcı ve yetki kuralları — telefondaki core/roles.js ve sh-core.cjs (kullanicilariBirlestir, onayAyariBirlestir)
    /// ile aynı; ortak deneme ortak/deneme/kullanicilar.json.
    /// </summary>
    public static class Yetki
    {
        /// <summary>Şifre geçerli mi: yalnız 0–9 rakamları, en az / en çok hane (telefondaki validPin).</summary>
        public static bool SifreGecerli(string sifre)
        {
            if (sifre == null || sifre.Length < Roller.SifreEnAz || sifre.Length > Roller.SifreEnCok) return false;
            foreach (char c in sifre) if (c < '0' || c > '9') return false;
            return true;
        }

        /// <summary>Şifre özeti: SHA-256, tur kez (ilk girdi UTF-8 "tuz:şifre"), küçük harfli onaltılık (telefondaki pinHash).</summary>
        public static string Ozet(string sifre, string tuz)
        {
            byte[] h = Encoding.UTF8.GetBytes((tuz ?? "") + ":" + (sifre ?? ""));
            using (var sha = SHA256.Create())
                for (int i = 0; i < Roller.SifreTur; i++) h = sha.ComputeHash(h);
            var sb = new StringBuilder(64);
            foreach (byte b in h) sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
            return sb.ToString();
        }

        public static bool SifreDogru(Kullanici k, string sifre) =>
            k != null && !string.IsNullOrEmpty(k.Ozet) && string.Equals(Ozet(sifre, k.Tuz), k.Ozet, StringComparison.Ordinal);

        /// <summary>Yeni tuz (rastgele, 26 karakter).</summary>
        public static string YeniTuz()
        {
            const string abc = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
            var b = new byte[26];
            using (var r = RandomNumberGenerator.Create()) r.GetBytes(b);
            var sb = new StringBuilder(26);
            foreach (var x in b) sb.Append(abc[x % abc.Length]);
            return sb.ToString();
        }

        public static string Zaman() => DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);

        /// <summary>Onay mekanizması açık mı: en az bir etkin Yönetici.</summary>
        public static bool OnayAcik(IEnumerable<Kullanici> l)
        {
            if (l != null) foreach (var k in l) if (k != null && k.Etkin && k.Rol == Roller.Yonetici) return true;
            return false;
        }

        public static List<Kullanici> Oku(List<object> dizi)
        {
            var r = new List<Kullanici>();
            var gorulen = new HashSet<string>(StringComparer.Ordinal);
            if (dizi != null)
                foreach (var x in dizi)
                {
                    var k = Kullanici.Oku(x as JsonNesne);
                    if (k != null && gorulen.Add(k.Id)) r.Add(k);
                }
            return r;
        }

        /// <summary>
        /// İki kullanıcı listesini birleştirir (yerel: çizimdeki, gelen: dosyadaki): iki tarafta olan kullanıcıda güncelleme
        /// zamanı yeni olan kazanır (eşitse yerel), yalnız gelende olan eklenir. Kullanıcı silinmez, pasif olur.
        /// </summary>
        public static List<Kullanici> Birlestir(IList<Kullanici> yerel, IList<Kullanici> gelen)
        {
            var r = new List<Kullanici>();
            var yer = new Dictionary<string, int>(StringComparer.Ordinal);
            if (yerel != null) foreach (var k in yerel) if (k != null && !string.IsNullOrEmpty(k.Id) && !yer.ContainsKey(k.Id)) { yer[k.Id] = r.Count; r.Add(k.Kopya()); }
            var gorulen = new HashSet<string>(StringComparer.Ordinal);
            if (gelen != null)
                foreach (var k in gelen)
                {
                    if (k == null || string.IsNullOrEmpty(k.Id) || !gorulen.Add(k.Id)) continue;
                    int i;
                    if (!yer.TryGetValue(k.Id, out i)) { yer[k.Id] = r.Count; r.Add(k.Kopya()); }
                    else if (string.CompareOrdinal(k.Guncelleme ?? "", r[i].Guncelleme ?? "") > 0) r[i] = k.Kopya();
                }
            return r;
        }

        /// <summary>Onay ayarlarından güncelleme zamanı yeni olan (eşitse yerel); biri yoksa öteki.</summary>
        public static OnayAyari Birlestir(OnayAyari yerel, OnayAyari gelen)
        {
            if (yerel == null) return gelen?.Kopya();
            if (gelen == null) return yerel.Kopya();
            return string.CompareOrdinal(gelen.Guncelleme ?? "", yerel.Guncelleme ?? "") > 0 ? gelen.Kopya() : yerel.Kopya();
        }

        /// <summary>Kullanıcı listeleri aynı mı (birleştirme bir şey değiştirdi mi).</summary>
        public static bool Ayni(IList<Kullanici> a, IList<Kullanici> b) => ListeJson(a) == ListeJson(b);

        public static bool Ayni(OnayAyari a, OnayAyari b) => (a == null ? "" : Json.Yaz(a.Json(), false)) == (b == null ? "" : Json.Yaz(b.Json(), false));

        public static string ListeJson(IList<Kullanici> l)
        {
            var d = new List<object>();
            if (l != null) foreach (var k in l) d.Add(k.Json());
            return Json.Yaz(d, false);
        }

        private static readonly int[] Asamalar = { HakedisOnayi.Kontrol, HakedisOnayi.Hakedis, HakedisOnayi.Gis };

        public static string AsamaIslemi(int bit) => bit == HakedisOnayi.Kontrol ? Roller.KontrolOnayi : bit == HakedisOnayi.Hakedis ? Roller.HakedisOnayi_ : Roller.GisOnayi;
        public static string AsamaAdi(int bit) => bit == HakedisOnayi.Kontrol ? "Kontrol" : bit == HakedisOnayi.Hakedis ? "Hakediş" : "GIS";

        /// <summary>Rol bu aşamanın işaretini koyup kaldırabilir mi (onay kapalıyken herkes).</summary>
        public static bool AsamaYetkisi(bool onayAcik, Kullanici uye, int bit) => !onayAcik || (uye != null && Roller.Yapabilir(uye.Rol, AsamaIslemi(bit)));

        /// <summary>
        /// Hakediş onayı değişikliği (SH_ONAY) yetki denetimi: onay mekanizması açıkken oturum gerekir ve değişen her aşama
        /// (konan ya da kaldırılan işaret) oturumdaki rolün yetkisinde olmalı. Döner: hata metni, izinliyse null.
        /// </summary>
        public static string OnayDegisikligi(IList<Kullanici> kullanicilar, Kullanici uye, IDictionary<int, int> eski, IDictionary<int, int> yeni)
        {
            if (!OnayAcik(kullanicilar)) return null;
            var hepsi = new SortedSet<int>();
            if (eski != null) hepsi.UnionWith(eski.Keys);
            if (yeni != null) hepsi.UnionWith(yeni.Keys);
            foreach (var n in hepsi)
            {
                int fark = HakedisOnayi.Bitler(eski, n) ^ HakedisOnayi.Bitler(yeni, n);
                foreach (var bit in Asamalar)
                {
                    if ((fark & bit) == 0) continue;
                    if (uye == null) return "Hakediş onayını değiştirmek için oturum açın (Kullanıcılar › Oturum aç).";
                    if (!Roller.Yapabilir(uye.Rol, AsamaIslemi(bit)))
                        return n + ". hakediş · " + AsamaAdi(bit) + " onayını " + Roller.Kimler(AsamaIslemi(bit)) + " verebilir ya da kaldırabilir (oturum: " + uye + ").";
                }
            }
            return null;
        }

        /// <summary>İşlem yetkisi: onay kapalıyken serbest; açıkken oturum ve rol gerekir. Döner: hata metni ya da null.</summary>
        public static string Islem(IList<Kullanici> kullanicilar, Kullanici uye, string islem)
        {
            if (!OnayAcik(kullanicilar)) return null;
            if (uye == null) return "Bu işlem için oturum açın.";
            return Roller.Yapabilir(uye.Rol, islem) ? null : Roller.IslemAdi(islem) + ": bu işlemi " + Roller.Kimler(islem) + " yapabilir (oturum: " + uye + ").";
        }
    }

    /// <summary>
    /// Kullanıcılar ve yetkiler penceresinin (SH_KULLANICILAR) çalışma kopyası ve kuralları — telefondaki
    /// ProjectService.addMember / updateMember / closeApproval / setClosedHakedis ile aynı: ilk kullanıcı Yönetici olur ve
    /// oturuma alınır; sonra kullanıcıyı yalnız Yönetici ekler / düzenler; kişi kendi şifresini değiştirebilir; en az bir
    /// etkin Yönetici kalır; hakediş yetkisini yalnız Yönetici belirler. Her işlem hata metni döner, izinliyse null.
    /// </summary>
    public sealed class KullaniciDuzeni
    {
        public readonly List<Kullanici> Liste;
        public OnayAyari Ayar;
        /// <summary>Oturumdaki kullanıcı (pencerede oturum açılıp kapanabilir).</summary>
        public Kullanici Uye;
        /// <summary>Bu düzenlemede tanımlanan ilk Yönetici (kaydedilince oturuma alınır); yoksa null.</summary>
        public string IlkYonetici;
        public bool Degisti;
        /// <summary>Saat (deneme için değiştirilebilir).</summary>
        public Func<string> Saat = Yetki.Zaman;

        public KullaniciDuzeni(IEnumerable<Kullanici> liste, OnayAyari ayar, Kullanici uye)
        {
            Liste = new List<Kullanici>();
            if (liste != null) foreach (var k in liste) Liste.Add(k.Kopya());
            Ayar = ayar?.Kopya();
            Uye = uye == null ? null : Liste.Find(k => k.Id == uye.Id && k.Etkin);
        }

        public bool OnayAcik => Yetki.OnayAcik(Liste);
        public bool Yonetici => Uye != null && Uye.Rol == Roller.Yonetici;
        /// <summary>Kullanıcı ekleyip düzenleyebilir mi (onay kapalıyken yalnız ilk Yönetici tanımlanabilir).</summary>
        public bool Yonetebilir => !OnayAcik || Roller.Yapabilir(Uye?.Rol, Roller.KullaniciYonetimi);
        public bool YetkiVerebilir => OnayAcik && Roller.Yapabilir(Uye?.Rol, Roller.HakedisYetkisi);
        public SortedSet<int> Kapali => Ayar != null ? Ayar.KapaliHakedisler : new SortedSet<int>();

        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
        private bool AdVar(string ad, string haric) =>
            Liste.Exists(k => k.Etkin && k.Id != haric && string.Equals(k.Ad.Trim().ToLower(Tr), ad.Trim().ToLower(Tr), StringComparison.Ordinal));

        public string Ekle(string ad, string rol, string sifre, out Kullanici yeni)
        {
            yeni = null;
            ad = (ad ?? "").Trim();
            if (ad.Length == 0) return "Ad gerekli.";
            if (Roller.Bul(rol) == null) return "Rol seçin.";
            if (!Yetki.SifreGecerli(sifre)) return "Şifre " + Roller.SifreEnAz + "–" + Roller.SifreEnCok + " rakam olmalı.";
            bool ilk = !OnayAcik;
            if (ilk && rol != Roller.Yonetici) return "İlk kullanıcı Yönetici olmalı.";
            if (!ilk && !Roller.Yapabilir(Uye?.Rol, Roller.KullaniciYonetimi)) return Uye == null ? "Kullanıcı eklemek için Yönetici oturumu açın." : "Kullanıcıyı yalnız Yönetici ekler.";
            if (AdVar(ad, null)) return "Bu adla kullanıcı var.";
            string t = Saat(), tuz = Yetki.YeniTuz();
            yeni = new Kullanici { Id = Yetki.YeniTuz(), Ad = ad, Rol = rol, Tuz = tuz, Ozet = Yetki.Ozet(sifre, tuz), Etkin = true, Guncelleme = t };
            Liste.Add(yeni);
            if (ilk) { Uye = yeni; IlkYonetici = yeni.Id; }
            Degisti = true;
            return null;
        }

        /// <summary>Kullanıcıyı günceller; null verilen alan değişmez. Kişi yalnız kendi şifresini değiştiriyorsa Yönetici gerekmez.</summary>
        public string Guncelle(string id, string ad, string rol, string sifre, bool? etkin)
        {
            var k = Liste.Find(x => x.Id == id);
            if (k == null) return "Kullanıcı yok.";
            bool kendi = Uye != null && Uye.Id == id;
            bool yalnizSifre = ad == null && rol == null && etkin == null && sifre != null;
            if (!(kendi && yalnizSifre) && !Roller.Yapabilir(Uye?.Rol, Roller.KullaniciYonetimi))
                return Uye == null ? "Bu işlem için Yönetici oturumu açın." : "Kullanıcıyı yalnız Yönetici düzenler.";
            var yeni = k.Kopya();
            if (ad != null) { ad = ad.Trim(); if (ad.Length == 0) return "Ad gerekli."; if (AdVar(ad, id)) return "Bu adla kullanıcı var."; yeni.Ad = ad; }
            if (rol != null) { if (Roller.Bul(rol) == null) return "Rol seçin."; yeni.Rol = rol; }
            if (etkin != null) yeni.Etkin = etkin.Value;
            if (sifre != null)
            {
                if (!Yetki.SifreGecerli(sifre)) return "Şifre " + Roller.SifreEnAz + "–" + Roller.SifreEnCok + " rakam olmalı.";
                yeni.Tuz = Yetki.YeniTuz();
                yeni.Ozet = Yetki.Ozet(sifre, yeni.Tuz);
            }
            var deneme = new List<Kullanici>(Liste);
            deneme[deneme.IndexOf(k)] = yeni;
            if (!Yetki.OnayAcik(deneme)) return "En az bir etkin Yönetici kalmalı · önce başka bir Yönetici tanımlayın ya da onay mekanizmasını kapatın.";
            if (Json.Yaz(yeni.Json(), false) == Json.Yaz(k.Json(), false)) return null;
            yeni.Guncelleme = Saat();
            Liste[Liste.IndexOf(k)] = yeni;
            if (kendi) Uye = yeni.Etkin ? yeni : null;
            Degisti = true;
            return null;
        }

        /// <summary>Onay mekanizmasını kapatır: bütün kullanıcılar pasif (liste saklanır), oturum kapanır.</summary>
        public string MekanizmayiKapat()
        {
            if (!OnayAcik) return null;
            if (!Roller.Yapabilir(Uye?.Rol, Roller.KullaniciYonetimi)) return "Onay mekanizmasını yalnız Yönetici kapatır.";
            string t = Saat();
            for (int i = 0; i < Liste.Count; i++)
                if (Liste[i].Etkin) { var y = Liste[i].Kopya(); y.Etkin = false; y.Guncelleme = t; Liste[i] = y; }
            Uye = null;
            Degisti = true;
            return null;
        }

        /// <summary>Hakediş yetkisi: hakedişi yazmaya kapatır ya da açar (yalnız Yönetici; onay mekanizması açık olmalı).</summary>
        public string KapaliYap(int hakedis, bool kapali)
        {
            if (hakedis <= 0) return "Geçersiz hakediş.";
            if (!OnayAcik) return "Hakediş yetkisi için önce ilk Yöneticiyi tanımlayın (onay mekanizması).";
            if (!Roller.Yapabilir(Uye?.Rol, Roller.HakedisYetkisi)) return "Hakediş yetkisini yalnız " + Roller.Kimler(Roller.HakedisYetkisi) + " belirler.";
            var a = Ayar?.Kopya() ?? new OnayAyari();
            bool var_ = a.KapaliHakedisler.Contains(hakedis);
            if (var_ == kapali) return null;
            if (kapali) a.KapaliHakedisler.Add(hakedis); else a.KapaliHakedisler.Remove(hakedis);
            a.Guncelleme = Saat();
            Ayar = a;
            Degisti = true;
            return null;
        }
    }
}
