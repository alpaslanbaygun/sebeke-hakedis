using System;
using System.IO;
using System.Reflection;
using System.Text;
using Microsoft.Win32;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Eklentinin lisans denetimi (13.11.2026; kurallar Cekirdek/Lisans.cs, biçim ortak/LISANS.md). Cihaz kodu Windows'un
    /// MachineGuid'inden ("PC-…"); lisans ve ilk açılış / son görülme tarihleri %APPDATA%\SebekeHakedis\lisans.json ile kayıt
    /// defterinde (HKCU\Software\SebekeHakedis\Lisans) iki yerde tutulur — en erken ilk açılış, en geç son görülme geçerlidir.
    /// Lisans yoksa 7 gün çalışır; sonra komutlar (Komutlar.Calistir) yalnız Lisans penceresini açar.
    /// </summary>
    internal static class LisansDenetimi
    {
        public const string Urun = "eklenti";
        private const string KayitYolu = @"Software\SebekeHakedis\Lisans";
        private static Lisans.AcikAnahtar _anahtar;
        private static string _cihaz;
        private static bool _uyarildi;

        private static string Klasor => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SebekeHakedis");
        private static string Dosya => Path.Combine(Klasor, "lisans.json");

        /// <summary>Gömülü açık anahtar (ortak/lisans/acik-anahtar.json).</summary>
        internal static Lisans.AcikAnahtar Anahtar
        {
            get
            {
                if (_anahtar != null) return _anahtar;
                using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("SebekeHakedis.lisans.acik-anahtar.json"))
                using (var r = new StreamReader(s, Encoding.UTF8)) _anahtar = Lisans.AcikAnahtar.Oku(r.ReadToEnd());
                return _anahtar;
            }
        }

        /// <summary>Windows'un makine kimliği (MachineGuid; yoksa bilgisayar adı).</summary>
        private static string HamKimlik()
        {
            foreach (var g in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                try
                {
                    using (var k = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, g).OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                    {
                        var v = k?.GetValue("MachineGuid") as string;
                        if (!string.IsNullOrWhiteSpace(v)) return v;
                    }
                }
                catch { }
            }
            return "makine|" + Environment.MachineName;
        }

        /// <summary>Bu bilgisayarın cihaz kodu (lisans bu koda verilir).</summary>
        internal static string CihazKodu => _cihaz ?? (_cihaz = Lisans.CihazKodu("PC", HamKimlik()));

        private sealed class Kayit { public string Lisans = "", Ilk = "", Son = ""; }

        private static string EnErken(string a, string b) => string.IsNullOrEmpty(a) ? b ?? "" : string.IsNullOrEmpty(b) ? a : string.CompareOrdinal(a, b) <= 0 ? a : b;
        private static string EnGec(string a, string b) => string.IsNullOrEmpty(a) ? b ?? "" : string.IsNullOrEmpty(b) ? a : string.CompareOrdinal(a, b) >= 0 ? a : b;

        private static Kayit Oku()
        {
            var k = new Kayit();
            try
            {
                if (File.Exists(Dosya))
                {
                    var o = Cekirdek.Json.Oku(File.ReadAllText(Dosya, Encoding.UTF8)) as JsonNesne;
                    if (o != null) { k.Lisans = o.Metin("lisans"); k.Ilk = o.Metin("ilkAcilis"); k.Son = o.Metin("sonGorulme"); }
                }
            }
            catch { }
            try
            {
                using (var r = Registry.CurrentUser.OpenSubKey(KayitYolu))
                {
                    if (r != null)
                    {
                        k.Ilk = EnErken(k.Ilk, r.GetValue("Ilk") as string);
                        k.Son = EnGec(k.Son, r.GetValue("Son") as string);
                        if (string.IsNullOrEmpty(k.Lisans)) k.Lisans = r.GetValue("Lisans") as string ?? "";
                    }
                }
            }
            catch { }
            return k;
        }

        private static void Yaz(Kayit k)
        {
            try
            {
                Directory.CreateDirectory(Klasor);
                var o = new JsonNesne();
                o["bicim"] = "sebeke-hakedis.lisans-kaydi";
                o["lisans"] = k.Lisans ?? "";
                o["ilkAcilis"] = k.Ilk ?? "";
                o["sonGorulme"] = k.Son ?? "";
                File.WriteAllText(Dosya, Cekirdek.Json.Yaz(o), new UTF8Encoding(false));
            }
            catch { }
            try
            {
                using (var r = Registry.CurrentUser.CreateSubKey(KayitYolu))
                {
                    r.SetValue("Ilk", k.Ilk ?? "");
                    r.SetValue("Son", k.Son ?? "");
                    r.SetValue("Lisans", k.Lisans ?? "");
                }
            }
            catch { }
        }

        /// <summary>Şimdiki durum (ilk açılış yoksa bugün yazılır, son görülme ilerletilir).</summary>
        internal static LisansDurumu Durum()
        {
            var k = Oku();
            string bugun = Lisans.Bugun(DateTime.Now);
            bool degisti = false;
            if (string.IsNullOrEmpty(k.Ilk)) { k.Ilk = bugun; degisti = true; }
            string son = EnGec(k.Son, bugun);
            if (son != k.Son) { k.Son = son; degisti = true; }
            if (degisti) Yaz(k);
            return Lisans.Durum(k.Lisans, CihazKodu, Urun, bugun, k.Ilk, k.Son, Anahtar);
        }

        /// <summary>Yeni lisansı dener; geçerliyse kaydeder. Dönen durum gösterilir (geçersizse kayıt değişmez).</summary>
        internal static LisansDurumu Dene(string metin, bool kaydet)
        {
            var k = Oku();
            string bugun = Lisans.Bugun(DateTime.Now);
            if (string.IsNullOrEmpty(k.Ilk)) k.Ilk = bugun;
            k.Son = EnGec(k.Son, bugun);
            var d = Lisans.Durum(metin, CihazKodu, Urun, bugun, k.Ilk, k.Son, Anahtar);
            if (kaydet && d.Tur == "lisansli") { k.Lisans = Lisans.Ayikla(metin); Yaz(k); }
            return d;
        }

        /// <summary>
        /// Komut çalışabilir mi: kullanılabilirse true (deneme / bitişe yakınken oturumda bir kez komut satırına uyarı); değilse
        /// Lisans penceresi açılır, geçerli lisans girilirse true.
        /// </summary>
        internal static bool Izinli()
        {
            LisansDurumu d;
            try { d = Durum(); }
            catch (Exception ex) { Uygulama.Yaz("Lisans denetlenemedi: " + ex.Message); return true; }
            if (d.Kullanilabilir)
            {
                if (d.Uyari && !_uyarildi) { _uyarildi = true; Uygulama.Yaz(d.Mesaj + (d.Tur == "deneme" ? " · lisans için SH_LISANS" : " · yenilemek için SH_LISANS")); }
                return true;
            }
            if (Pencereler.Lisans(d, CihazKodu, Dene, true)) Uygulama.Yaz("Lisans kaydedildi. " + Durum().Mesaj);
            return Durum().Kullanilabilir;
        }
    }
}
