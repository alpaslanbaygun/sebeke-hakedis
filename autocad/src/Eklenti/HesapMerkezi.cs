using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
using WinForms = System.Windows.Forms;

[assembly: CommandClass(typeof(SebekeHakedis.Eklenti.HesapKomutlari))]

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Hesap kayıtlarının çizimde saklanması: Named Objects Dictionary → SEBEKE_HAKEDIS → HESAPLAR → kayıt başına bir
    /// Xrecord (anahtar: kayıt kimliği; veri: kaydın JSON metni 1000 karakterlik parçalarda). Kayıtlar çizimle birlikte
    /// kaydedilir, Geri Al ile geri alınır ve SH_ICEAL ile proje dosyasına ("hesaplar") yazılır.
    /// </summary>
    internal static class HesapDeposu
    {
        private const string Sozluk = "SEBEKE_HAKEDIS";
        private const string AltSozluk = "HESAPLAR";
        /// <summary>
        /// Bir Xrecord metin değerinin (DXF 1) en çok uzunluğu. 1000 karakterlik parçalar bellekte sorunsuz yazılıyor ve
        /// okunuyordu; ama kaydedilen çizim yeniden açılırken AutoCAD çöküyordu (Access Violation). 0–9 kodlu DXF
        /// dizgileri için güvenli sınır 255'tir; 250 kullanılır.
        /// </summary>
        private const int ParcaBoyu = 250;

        /// <summary>Sözlük anahtarı: kimlikteki sözlük için uygun olmayan karakterler değiştirilir.</summary>
        private static string Anahtar(string id)
        {
            string a = Regex.Replace(id ?? "", @"[^A-Za-z0-9_\-]", "_");
            if (a.Length == 0) a = "_";
            return a.Length > 200 ? a.Substring(0, 200) : a;
        }

        private static DBDictionary AltSozlukAc(Transaction tr, Database db, bool yaz)
        {
            var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, yaz ? OpenMode.ForWrite : OpenMode.ForRead);
            DBDictionary ust;
            if (nod.Contains(Sozluk)) ust = (DBDictionary)tr.GetObject(nod.GetAt(Sozluk), yaz ? OpenMode.ForWrite : OpenMode.ForRead);
            else
            {
                if (!yaz) return null;
                ust = new DBDictionary();
                nod.SetAt(Sozluk, ust);
                tr.AddNewlyCreatedDBObject(ust, true);
            }
            if (ust.Contains(AltSozluk)) return (DBDictionary)tr.GetObject(ust.GetAt(AltSozluk), yaz ? OpenMode.ForWrite : OpenMode.ForRead);
            if (!yaz) return null;
            var alt = new DBDictionary();
            ust.SetAt(AltSozluk, alt);
            tr.AddNewlyCreatedDBObject(alt, true);
            return alt;
        }

        private static HesapKaydi Coz(Xrecord xr)
        {
            using (var rb = xr.Data)
            {
                if (rb == null) return null;
                var sb = new StringBuilder();
                foreach (TypedValue tv in rb) if (tv.TypeCode == (int)DxfCode.Text) sb.Append(tv.Value as string);
                try { return HesapKaydi.Oku(Cekirdek.Json.Oku(sb.ToString()) as JsonNesne); }
                catch { return null; }
            }
        }

        /// <summary>Çizimdeki bütün hesap kayıtları (yeniden eskiye).</summary>
        public static List<HesapKaydi> Oku(Database db)
        {
            var r = new List<HesapKaydi>();
            using (var tr = db.TransactionManager.StartOpenCloseTransaction())
            {
                var alt = AltSozlukAc(tr, db, false);
                if (alt != null)
                    foreach (DBDictionaryEntry e in alt)
                    {
                        var xr = tr.GetObject(e.Value, OpenMode.ForRead) as Xrecord;
                        if (xr == null) continue;
                        var k = Coz(xr);
                        if (k != null) r.Add(k);
                    }
                tr.Commit();
            }
            r.Sort((a, b) => string.CompareOrdinal(b.Tarih ?? "", a.Tarih ?? ""));
            return r;
        }

        /// <summary>Kaydı yazar (aynı kimlik varsa üzerine).</summary>
        public static void Yaz(Database db, HesapKaydi k)
        {
            using (var tr = db.TransactionManager.StartTransaction())
            {
                Yaz(tr, db, k);
                tr.Commit();
            }
        }

        public static void Yaz(Database db, IEnumerable<HesapKaydi> liste)
        {
            using (var tr = db.TransactionManager.StartTransaction())
            {
                foreach (var k in liste) Yaz(tr, db, k);
                tr.Commit();
            }
        }

        private static void Yaz(Transaction tr, Database db, HesapKaydi k)
        {
            if (k == null || string.IsNullOrEmpty(k.Id)) throw new System.ArgumentException("Kayıt kimliği boş");
            var alt = AltSozlukAc(tr, db, true);
            string anahtar = Anahtar(k.Id);
            Xrecord xr;
            if (alt.Contains(anahtar)) xr = (Xrecord)tr.GetObject(alt.GetAt(anahtar), OpenMode.ForWrite);
            else
            {
                xr = new Xrecord();
                alt.SetAt(anahtar, xr);
                tr.AddNewlyCreatedDBObject(xr, true);
            }
            string metin = Cekirdek.Json.Yaz(k.Json(), false);
            using (var rb = new ResultBuffer())
            {
                for (int i = 0; i < metin.Length; i += ParcaBoyu)
                    rb.Add(new TypedValue((int)DxfCode.Text, metin.Substring(i, Math.Min(ParcaBoyu, metin.Length - i))));
                xr.Data = rb;
            }
        }

        /// <summary>Kaydı siler; yoksa false.</summary>
        public static bool Sil(Database db, string id)
        {
            bool silindi = false;
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var alt = AltSozlukAc(tr, db, false);
                string anahtar = Anahtar(id);
                if (alt != null && alt.Contains(anahtar))
                {
                    alt.UpgradeOpen();
                    alt.Remove(anahtar);
                    silindi = true;
                }
                tr.Commit();
            }
            return silindi;
        }

        /// <summary>
        /// Telefondan (proje dosyasından) gelen kayıtları çizimdekilerle birleştirir: aynı kayıt daha yeniyse güncellenir,
        /// yoksa eklenir. Hedef kimlikleri dosyadaki kimlikten çizim tanıtıcısına çevrilir (telefonda çizilen nesnelerin
        /// telefon kimliği SH_ID olarak nesnede durur). Döner: [yeni, güncellenen].
        /// </summary>
        public static int[] Birlestir(Database db, Proje cizim, IList<HesapKaydi> gelenler, List<string> uyarilar)
        {
            int yeni = 0, guncel = 0;
            if (gelenler == null || gelenler.Count == 0) return new[] { 0, 0 };
            var mevcut = Oku(db);
            var yazilacak = new List<HesapKaydi>();
            foreach (var g in gelenler)
            {
                if (g == null || string.IsNullOrEmpty(g.Id)) continue;
                var k = HesapKaydi.Oku(g.Json()); // kopya
                string ad = (string.IsNullOrEmpty(k.ModulAdi) ? k.Modul : k.ModulAdi) + (k.HedefNo.Length > 0 ? " · " + k.HedefNo : "");
                if (k.HedefTur == "direk" || k.HedefTur == "trafo")
                {
                    string h = ElemanTaniticisi(cizim, k.HedefId);
                    if (h == null) uyarilar.Add("Hesap kaydının hedefi çizimde bulunamadı (kayıt yine alındı): " + ad);
                    else k.HedefId = h;
                }
                else if (k.HedefTur == "hat" || k.HedefTur == "kanal")
                {
                    var parcalar = new List<string>();
                    foreach (var id in new List<string>(k.HedefParcalar) { k.HedefId })
                    {
                        string h = HatTaniticisi(cizim, id);
                        if (h != null && !parcalar.Contains(h)) parcalar.Add(h);
                    }
                    if (parcalar.Count == 0) uyarilar.Add("Hesap kaydının hedef hattı çizimde bulunamadı (kayıt yine alındı): " + ad);
                    else { k.HedefId = parcalar[0]; k.HedefParcalar = parcalar; }
                }
                if (!string.IsNullOrEmpty(k.HedefHatId)) k.HedefHatId = HatTaniticisi(cizim, k.HedefHatId) ?? k.HedefHatId;

                var eski = mevcut.Find(x => x.Id == k.Id || (!string.IsNullOrEmpty(k.TelefonId) && (x.TelefonId == k.TelefonId || x.Id == k.TelefonId)));
                if (eski != null)
                {
                    if (string.CompareOrdinal(k.Tarih ?? "", eski.Tarih ?? "") <= 0) continue;
                    k.Id = eski.Id;
                    if (string.IsNullOrEmpty(k.TelefonId)) k.TelefonId = eski.TelefonId;
                    guncel++;
                }
                else yeni++;
                yazilacak.Add(k);
            }
            if (yazilacak.Count > 0) Yaz(db, yazilacak);
            return new[] { yeni, guncel };
        }

        private static string ElemanTaniticisi(Proje p, string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            var e = p.Elemanlar.Find(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase)) ?? p.Elemanlar.Find(x => x.TelefonId == id);
            return e?.Id;
        }

        private static string HatTaniticisi(Proje p, string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            var h = p.Hatlar.Find(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase)) ?? p.Hatlar.Find(x => x.TelefonId == id);
            if (h != null) return h.Id;
            var c = p.Kanallar.Find(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase)) ?? p.Kanallar.Find(x => x.TelefonId == id);
            return c?.Id;
        }
    }

    /// <summary>
    /// Hesap Merkezi (AutoCAD tarafı): hesap sayfaları eklentiye gömülüdür (ortak/hesap/paket, derlemede üretilir) ve
    /// yerel sunucudan (HesapSunucu) bilgisayarın tarayıcısında açılır. Sayfa, köprü (ortak/hesap/kopru.js) ile buradan
    /// seçili direğin / hattın / trafonun bağlamını ister, sonucu buraya kaydeder; kayıt çizimin içinde (HesapDeposu) durur.
    /// Sunucu istekleri ayrı iş parçacığında gelir; çizime dokunan her iş AutoCAD'in ana iş parçacığına aktarılır.
    /// </summary>
    internal static class HesapMerkezi
    {
        public const string Ortam = "autocad";
        private const string KaynakOnEki = "SebekeHakedis.hesap.";
        /// <summary>Geliştirme: bu ortam değişkeni bir klasörü gösteriyorsa sayfalar gömülü kaynaktan değil oradan verilir.</summary>
        private const string KlasorDegiskeni = "SEBEKE_M_HESAP_KLASOR";

        private sealed class Oturum
        {
            public string Id;
            public Document Belge;
            public string Modul;
            public HesapHedefi Hedef;
            public string KayitId;
            public DateTime Zaman;
        }

        private static readonly object _kilit = new object();
        private static HesapSunucu _sunucu;
        private static WinForms.Control _kanal;
        private static Dictionary<string, string> _kaynaklar;
        private static List<JsonNesne> _moduller;
        private static readonly Dictionary<string, Oturum> _oturumlar = new Dictionary<string, Oturum>(StringComparer.Ordinal);

        /// <summary>Eklenti yüklenirken ana iş parçacığında çağrılır (ana iş parçacığına geçiş kanalı burada kurulur).</summary>
        public static void Baslat()
        {
            if (_kanal != null) return;
            _kanal = new WinForms.Control();
            var tutamac = _kanal.Handle; // tutamaç ana iş parçacığında yaratılsın
            if (tutamac == IntPtr.Zero) _kanal = null;
        }

        public static void Durdur()
        {
            lock (_kilit)
            {
                try { _sunucu?.Dispose(); } catch { }
                _sunucu = null;
                _oturumlar.Clear();
            }
        }

        // ---------------- Gömülü sayfalar ve hesap listesi ----------------

        private static Dictionary<string, string> Kaynaklar()
        {
            if (_kaynaklar != null) return _kaynaklar;
            var d = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var ad in typeof(HesapMerkezi).Assembly.GetManifestResourceNames())
            {
                if (!ad.StartsWith(KaynakOnEki, StringComparison.Ordinal)) continue;
                d[ad.Substring(KaynakOnEki.Length).Replace('\\', '/')] = ad;
            }
            _kaynaklar = d;
            return d;
        }

        private static byte[] KaynakOku(string yol)
        {
            string klasor = null;
            try { klasor = Environment.GetEnvironmentVariable(KlasorDegiskeni); } catch { }
            if (!string.IsNullOrEmpty(klasor) && Directory.Exists(klasor))
            {
                string tam = Path.GetFullPath(Path.Combine(klasor, yol.Replace('/', Path.DirectorySeparatorChar)));
                if (tam.StartsWith(Path.GetFullPath(klasor), StringComparison.OrdinalIgnoreCase) && File.Exists(tam)) return File.ReadAllBytes(tam);
            }
            string ad;
            if (!Kaynaklar().TryGetValue(yol, out ad)) return null;
            using (var s = typeof(HesapMerkezi).Assembly.GetManifestResourceStream(ad))
            {
                if (s == null) return null;
                using (var m = new MemoryStream())
                {
                    s.CopyTo(m);
                    return m.ToArray();
                }
            }
        }

        /// <summary>Hesap listesi (ortak/hesap/moduller.json): id, ad, kisa, grup, sayfa, bolum, uygunluk.</summary>
        public static List<JsonNesne> Moduller
        {
            get
            {
                if (_moduller != null) return _moduller;
                var l = new List<JsonNesne>();
                try
                {
                    var b = KaynakOku("moduller.json");
                    var o = b == null ? null : Cekirdek.Json.Oku(Encoding.UTF8.GetString(b)) as JsonNesne;
                    var dizi = o?.Dizi("moduller");
                    if (dizi != null) foreach (var x in dizi) if (x is JsonNesne m && m.Metin("id").Length > 0) l.Add(m);
                }
                catch { }
                _moduller = l;
                return l;
            }
        }

        public static bool SayfalarVar => Moduller.Count > 0 && Kaynaklar().ContainsKey("merkez.html");

        public static JsonNesne ModulBul(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            return Moduller.Find(m => string.Equals(m.Metin("id"), id, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>Hesabın açılabileceği hedef türleri (uygunluk.hedefler; boşsa hepsi).</summary>
        public static List<string> ModulHedefleri(JsonNesne m)
        {
            var r = new List<string>();
            var d = m?.Nesne("uygunluk")?.Dizi("hedefler");
            if (d == null) return new List<string>(HesapKaydi.HedefTurleri);
            foreach (var x in d) if (x is string s) r.Add(s);
            return r.Count > 0 ? r : new List<string>(HesapKaydi.HedefTurleri);
        }

        public static string HedefAdi(string tur)
        {
            switch (tur)
            {
                case "direk": return "Direk";
                case "hat": return "Hat";
                case "trafo": return "Trafo";
                case "kanal": return "Kanal";
                default: return "Proje";
            }
        }

        // ---------------- Sunucu ----------------

        private static HesapSunucu Sunucu
        {
            get
            {
                lock (_kilit)
                {
                    if (_sunucu == null)
                    {
                        _sunucu = new HesapSunucu(KaynakOku, Api);
                        _sunucu.HataBildir = e => Gunluk("sunucu", e);
                    }
                    return _sunucu;
                }
            }
        }

        private static void Gunluk(string yer, System.Exception e)
        {
            try
            {
                File.AppendAllText(Path.Combine(Path.GetTempPath(), "SebekeHakedis_hata.txt"),
                    DateTime.Now.ToString("s") + "  Hesap Merkezi (" + yer + ")\n" + e + "\n\n", new UTF8Encoding(false));
            }
            catch { }
        }

        /// <summary>Hesap (ya da "merkez") için oturum açar ve sayfanın adresini döner.</summary>
        public static string Ac(Document belge, string modulId, HesapHedefi hedef, string kayitId)
        {
            if (belge == null) throw new System.ArgumentNullException(nameof(belge));
            if (_kanal == null) Baslat();
            if (!SayfalarVar) throw new System.InvalidOperationException("Hesap sayfaları bu derlemede yok (ortak/hesap/paket eklentiye gömülmemiş).");
            JsonNesne m = null;
            if (modulId != "merkez")
            {
                m = ModulBul(modulId);
                if (m == null) throw new System.ArgumentException("Bilinmeyen hesap: " + modulId);
            }
            var o = new Oturum
            {
                Id = HesapSunucu.RastgeleAnahtar().Substring(0, 16),
                Belge = belge,
                Modul = modulId,
                Hedef = hedef ?? new HesapHedefi(),
                KayitId = kayitId ?? "",
                Zaman = DateTime.UtcNow,
            };
            lock (_kilit)
            {
                _oturumlar[o.Id] = o;
                if (_oturumlar.Count > 300)
                {
                    var eski = new List<Oturum>(_oturumlar.Values);
                    eski.Sort((a, b) => a.Zaman.CompareTo(b.Zaman));
                    for (int i = 0; i < eski.Count - 200; i++) _oturumlar.Remove(eski[i].Id);
                }
            }
            string sayfa = m == null ? "merkez.html" : (m.Metin("sayfa").Length > 0 ? m.Metin("sayfa") : m.Metin("id")) + ".html";
            var sb = new StringBuilder(Sunucu.Kok).Append(sayfa).Append("?ortam=").Append(Ortam).Append("&oturum=").Append(o.Id);
            if (!string.IsNullOrEmpty(kayitId)) sb.Append("&kayit=").Append(Uri.EscapeDataString(kayitId));
            if (m != null && m.Metin("bolum").Length > 0) sb.Append("&bolum=").Append(Uri.EscapeDataString(m.Metin("bolum")));
            return sb.ToString();
        }

        /// <summary>Sayfayı Edge'in uygulama penceresinde açar; Edge yoksa varsayılan tarayıcıda.</summary>
        public static void TarayicidaAc(string url)
        {
            string edge = EdgeYolu();
            if (edge != null)
            {
                try
                {
                    Process.Start(new ProcessStartInfo(edge, "--app=\"" + url + "\" --no-first-run --window-size=1240,900") { UseShellExecute = false });
                    return;
                }
                catch (System.Exception e) { Gunluk("edge", e); }
            }
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }

        private static string EdgeYolu()
        {
            try
            {
                foreach (var kok in new[] { Microsoft.Win32.Registry.LocalMachine, Microsoft.Win32.Registry.CurrentUser })
                    using (var k = kok.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"))
                    {
                        var yol = k?.GetValue("") as string;
                        if (!string.IsNullOrEmpty(yol) && File.Exists(yol)) return yol;
                    }
            }
            catch { }
            foreach (var klasor in new[] { Environment.GetEnvironmentVariable("ProgramFiles(x86)"), Environment.GetEnvironmentVariable("ProgramFiles"), Environment.GetEnvironmentVariable("LocalAppData") })
            {
                if (string.IsNullOrEmpty(klasor)) continue;
                string yol = Path.Combine(klasor, @"Microsoft\Edge\Application\msedge.exe");
                if (File.Exists(yol)) return yol;
            }
            return null;
        }

        // ---------------- API (sunucu iş parçacığında çağrılır) ----------------

        private static string HataJson(string mesaj)
        {
            var o = new JsonNesne();
            o["hata"] = mesaj ?? "Hata";
            return Cekirdek.Json.Yaz(o, false);
        }

        private static string Api(string ad, string govde)
        {
            JsonNesne istek;
            try { istek = Cekirdek.Json.Oku(govde) as JsonNesne ?? new JsonNesne(); }
            catch (System.Exception e) { return HataJson("İstek okunamadı: " + e.Message); }
            Func<Oturum, string> is_;
            switch (ad)
            {
                case "basla": is_ = o => Basla(o, istek); break;
                case "kaydet": is_ = o => Kaydet(o, istek); break;
                case "merkez": is_ = o => Merkez(o, istek); break;
                case "ac": is_ = o => Ac(o, istek); break;
                case "sil": is_ = o => Sil(o, istek); break;
                case "goster": is_ = o => Goster(o, istek); break;
                default: return null;
            }
            Oturum oturum;
            lock (_kilit) _oturumlar.TryGetValue(istek.Metin("oturum"), out oturum);
            if (oturum == null) return HataJson("Bu sayfanın AutoCAD oturumu bulunamadı (AutoCAD yeniden başlatılmış olabilir). Hesabı AutoCAD'den yeniden açın.");
            return AnaIs(() => is_(oturum));
        }

        /// <summary>İşi AutoCAD'in ana iş parçacığında çalıştırır (çizime yalnız oradan dokunulur).</summary>
        private static string AnaIs(Func<string> is_)
        {
            var kanal = _kanal;
            if (kanal == null || kanal.IsDisposed) return HataJson("Hesap Merkezi hazır değil (eklenti tam yüklenmemiş).");
            if (!kanal.InvokeRequired)
            {
                try { return is_(); }
                catch (System.Exception e) { return HataJson(e.Message); }
            }
            string sonuc = null;
            System.Exception hata = null;
            using (var bitti = new ManualResetEvent(false))
            {
                try
                {
                    kanal.BeginInvoke(new Action(() =>
                    {
                        try { sonuc = is_(); }
                        catch (System.Exception e) { hata = e; }
                        finally { try { bitti.Set(); } catch { } }
                    }));
                }
                catch (System.Exception e) { return HataJson("AutoCAD'e ulaşılamadı: " + e.Message); }
                if (!bitti.WaitOne(25000))
                    return HataJson("AutoCAD yanıt vermiyor: açık bir pencere ya da çalışan bir komut olabilir. Onu bitirip yeniden deneyin.");
            }
            if (hata != null) { Gunluk("api", hata); return HataJson(hata.Message); }
            return sonuc ?? "{}";
        }

        private static Document BelgeKontrol(Oturum o)
        {
            foreach (Document d in AcApp.DocumentManager) if (d == o.Belge) return d;
            throw new System.InvalidOperationException("Hesabın açıldığı çizim AutoCAD'de kapatılmış. Çizimi açıp hesabı yeniden başlatın.");
        }

        private static void KomutKontrol(Document belge)
        {
            string k = null;
            try { k = belge.CommandInProgress; } catch { }
            if (!string.IsNullOrEmpty(k))
                throw new System.InvalidOperationException("AutoCAD'de \"" + k + "\" komutu çalışıyor. Komutu bitirip (Esc) yeniden deneyin.");
        }

        /// <summary>Çizimden proje (hesap kayıtlarıyla).</summary>
        public static Proje ProjeOku(Document belge)
        {
            var varliklar = Toplayici.Topla(belge.Database);
            var p = NesneOkuyucu.Oku(varliklar, belge.Name);
            p.Hesaplar = HesapDeposu.Oku(belge.Database);
            return p;
        }

        /// <summary>Çizim ayarlarındaki proje bilgileri (SH_AYARLAR › Proje).</summary>
        public static ProjeBilgisi Bilgi(Document belge)
        {
            var a = AyarDeposu.Oku(belge.Database);
            return new ProjeBilgisi { Ad = a.ProjeAdi ?? "", Kod = a.ProjeKodu ?? "", Yapan = a.Hazirlayan ?? "", Unvan = a.Unvan ?? "", Firma = a.Firma ?? "", BuzBolgesi = a.BuzBolgesi ?? "" };
        }

        private static HesapKaydi KayitBul(List<HesapKaydi> liste, string kayitId, string modul, HesapHedefi hedef)
        {
            HesapKaydi k = null;
            if (!string.IsNullOrEmpty(kayitId)) k = liste.Find(x => x.Id == kayitId);
            if (k == null && !string.IsNullOrEmpty(modul)) k = liste.Find(x => x.Modul == modul && x.HedefAyni(hedef));
            return k;
        }

        private static string Basla(Oturum o, JsonNesne istek)
        {
            var belge = BelgeKontrol(o);
            using (belge.LockDocument())
            {
                var p = ProjeOku(belge);
                var bilgi = Bilgi(belge);
                var baglam = HesapBaglami.Kur(p, o.Hedef, bilgi);
                var kayit = KayitBul(p.Hesaplar, o.KayitId, o.Modul, o.Hedef);
                if (kayit != null) o.KayitId = kayit.Id;
                var y = new JsonNesne();
                y["baglam"] = baglam;
                y["hedef"] = o.Hedef.Json();
                y["kayit"] = kayit?.Json();
                y["guncel"] = baglam;
                return Cekirdek.Json.Yaz(y, false);
            }
        }

        private static string DurumCoz(string d)
        {
            d = (d ?? "").Trim().ToLowerInvariant();
            if (d == "uygun değil" || d == "uygun-degil" || d == "uygun degil") return "uygun-degil";
            return d == "uygun" ? "uygun" : "bilgi";
        }

        private static string Kaydet(Oturum o, JsonNesne istek)
        {
            var belge = BelgeKontrol(o);
            KomutKontrol(belge);
            if (o.Modul == "merkez") throw new System.InvalidOperationException("Hesap merkezi sayfasından kayıt yapılmaz.");
            using (belge.LockDocument())
            {
                var db = belge.Database;
                var bilgi = Bilgi(belge);
                var mevcut = HesapDeposu.Oku(db);
                var eski = KayitBul(mevcut, istek.Metin("kayitId"), o.Modul, o.Hedef) ?? KayitBul(mevcut, o.KayitId, null, o.Hedef);
                var hedefIstek = istek.Nesne("hedef");
                if (string.IsNullOrEmpty(o.Hedef.No) && hedefIstek != null) o.Hedef.No = hedefIstek.Metin("no");
                var m = ModulBul(o.Modul);
                var k = new HesapKaydi
                {
                    Id = eski?.Id ?? HesapKaydi.YeniKimlik(),
                    Modul = o.Modul,
                    ModulAdi = istek.Metin("modulAdi").Length > 0 ? istek.Metin("modulAdi") : m?.Metin("ad") ?? o.Modul,
                    ModulSurumu = istek.Metin("modulSurumu"),
                    HedefTur = string.IsNullOrEmpty(o.Hedef.Tur) ? "proje" : o.Hedef.Tur,
                    HedefId = o.Hedef.Id ?? "",
                    HedefNo = o.Hedef.No ?? "",
                    HedefHatId = o.Hedef.HatId ?? "",
                    Ozet = istek.Metin("ozet"),
                    Durum = DurumCoz(istek.Metin("durum")),
                    Ayrinti = istek.Nesne("ayrinti") ?? new JsonNesne(),
                    Kullanilan = istek.Nesne("kullanilan") ?? new JsonNesne(),
                    Tarih = HesapKaydi.Simdi(),
                    Kaynak = Ortam,
                    Yapan = bilgi.Yapan ?? "",
                    TelefonId = eski?.TelefonId ?? "",
                };
                k.HedefParcalar.AddRange(o.Hedef.Parcalar);
                var md = istek["modulDurumu"];
                k.ModulDurumu = md == null ? "" : md is string s ? s : Cekirdek.Json.Yaz(md, false);
                HesapDeposu.Yaz(db, k);
                o.KayitId = k.Id;
                var y = new JsonNesne();
                y["id"] = k.Id;
                y["mesaj"] = (eski != null ? "Güncellendi: " : "Kaydedildi: ") + (k.HedefTur == "proje" ? "proje geneli" : HedefAdi(k.HedefTur) + " " + k.HedefNo) + " · çizimi kaydetmeyi unutmayın";
                return Cekirdek.Json.Yaz(y, false);
            }
        }

        private static JsonNesne Guncellik(Proje p, HesapKaydi k, ProjeBilgisi bilgi)
        {
            var g = new JsonNesne();
            bool yok;
            var farklar = HesapGuncellik.Durum(p, k, bilgi, Ortam, out yok);
            g["hedefYok"] = yok;
            var l = new List<object>();
            foreach (var f in farklar)
            {
                var x = new JsonNesne();
                x["yol"] = f.Yol; x["eski"] = f.Eski; x["yeni"] = f.Yeni; x["silindi"] = f.Silindi;
                l.Add(x);
            }
            g["farklar"] = l;
            return g;
        }

        private static string Merkez(Oturum o, JsonNesne istek)
        {
            var belge = BelgeKontrol(o);
            using (belge.LockDocument())
            {
                var p = ProjeOku(belge);
                var bilgi = Bilgi(belge);
                var hedef = o.Hedef;
                bool hedefli = hedef != null && !string.IsNullOrEmpty(hedef.Tur) && hedef.Tur != "proje";
                var baglam = HesapBaglami.Kur(p, hedef, bilgi);
                var y = new JsonNesne();
                y["hedef"] = hedef.Json();
                y["hedefVar"] = HesapBaglami.HedefVar(p, hedef);
                y["baglam"] = baglam;
                var kayitlar = new List<object>();
                foreach (var k in p.Hesaplar)
                {
                    if (hedefli && !(k.HedefTur == hedef.Tur && (k.HedefId == hedef.Id || k.HedefAyni(new HesapHedefi { Tur = hedef.Tur, Id = hedef.Id, HatId = k.HedefHatId, Parcalar = new List<string>(hedef.Parcalar) })))) continue;
                    var j = k.Json();
                    j["guncel"] = Guncellik(p, k, bilgi);
                    j["hedefAdi"] = HedefAdi(k.HedefTur);
                    if (!string.IsNullOrEmpty(k.HedefHatId))
                    {
                        var hat = p.Hatlar.Find(x => x.Id == k.HedefHatId);
                        j["kolAdi"] = hat != null ? HesapBaglami.HatAdi(p, hat) : "";
                    }
                    kayitlar.Add(j);
                }
                y["kayitlar"] = kayitlar;
                if (hedefli && hedef.Tur == "trafo")
                {
                    var cikislar = new List<object>();
                    foreach (var h in HesapBaglami.TrafoCikislari(p, hedef.Id))
                    {
                        var c = new JsonNesne();
                        c["id"] = h.Id;
                        c["no"] = HesapBaglami.HatAdi(p, h);
                        c["tur"] = h.Tur;
                        c["iletken"] = h.AnaKesit ?? "";
                        c["devre"] = h.Tur.StartsWith("OG", StringComparison.Ordinal) ? "OG" : "AG";
                        cikislar.Add(c);
                    }
                    y["cikislar"] = cikislar;
                }
                var pj = new JsonNesne();
                pj["ad"] = p.Ad; pj["cizim"] = Path.GetFileName(belge.Name ?? ""); pj["eleman"] = (double)p.Elemanlar.Count; pj["hat"] = (double)p.Hatlar.Count;
                y["proje"] = pj;
                y["surum"] = Uygulama.Surum;
                return Cekirdek.Json.Yaz(y, false);
            }
        }

        private static string Ac(Oturum o, JsonNesne istek)
        {
            var belge = BelgeKontrol(o);
            string modul = istek.Metin("modul");
            var m = ModulBul(modul);
            if (m == null) throw new System.ArgumentException("Bilinmeyen hesap: " + modul);
            HesapHedefi hedef;
            string kayitId = "";
            string istenenKayit = istek.Metin("kayit");
            if (istenenKayit.Length > 0)
            {
                var k = HesapDeposu.Oku(belge.Database).Find(x => x.Id == istenenKayit);
                if (k == null) throw new System.InvalidOperationException("Kayıt bulunamadı (silinmiş olabilir).");
                hedef = k.Hedef();
                kayitId = k.Id;
                modul = k.Modul;
            }
            else
            {
                hedef = new HesapHedefi { Tur = o.Hedef.Tur, Id = o.Hedef.Id, No = o.Hedef.No, HatId = istek.Metin("hatId") };
                hedef.Parcalar.AddRange(o.Hedef.Parcalar);
                if (hedef.Tur != "trafo") hedef.HatId = "";
            }
            var y = new JsonNesne();
            y["url"] = Ac(belge, modul, hedef, kayitId);
            return Cekirdek.Json.Yaz(y, false);
        }

        private static string Sil(Oturum o, JsonNesne istek)
        {
            var belge = BelgeKontrol(o);
            KomutKontrol(belge);
            using (belge.LockDocument())
            {
                bool ok = HesapDeposu.Sil(belge.Database, istek.Metin("id"));
                var y = new JsonNesne();
                y["silindi"] = ok;
                y["mesaj"] = ok ? "Kayıt silindi · çizimi kaydetmeyi unutmayın (Geri Al ile geri gelir)" : "Kayıt bulunamadı";
                return Cekirdek.Json.Yaz(y, false);
            }
        }

        /// <summary>Hedefi (ya da kaydın hedefini) çizimde seçer ve ona yaklaşır; AutoCAD penceresini öne getirir.</summary>
        private static string Goster(Oturum o, JsonNesne istek)
        {
            var belge = BelgeKontrol(o);
            HesapHedefi hedef = o.Hedef;
            string id = istek.Metin("id");
            if (id.Length > 0)
            {
                var k = HesapDeposu.Oku(belge.Database).Find(x => x.Id == id);
                if (k != null) hedef = k.Hedef();
            }
            var hedefIstek = istek.Nesne("hedef");
            if (hedefIstek != null)
            {
                hedef = new HesapHedefi { Tur = hedefIstek.Metin("tur"), Id = hedefIstek.Metin("id"), No = hedefIstek.Metin("no") };
                var pr = hedefIstek.Dizi("parcalar");
                if (pr != null) foreach (var x in pr) if (x is string s) hedef.Parcalar.Add(s);
            }
            var y = new JsonNesne();
            if (hedef == null || hedef.Tur == "proje" || string.IsNullOrEmpty(hedef.Tur)) { y["mesaj"] = "Proje geneli hesabının çizimde tek bir yeri yok."; return Cekirdek.Json.Yaz(y, false); }
            try { AcApp.DocumentManager.MdiActiveDocument = belge; } catch { }
            var idler = new List<ObjectId>();
            foreach (var h in new List<string>(hedef.Parcalar) { hedef.Id })
            {
                ObjectId oid;
                if (!string.IsNullOrEmpty(h) && Toplayici.TaniticiylaBul(belge.Database, h, out oid) && !idler.Contains(oid)) idler.Add(oid);
            }
            if (idler.Count == 0) { y["mesaj"] = "Hedef çizimde bulunamadı (silinmiş olabilir)."; return Cekirdek.Json.Yaz(y, false); }
            using (belge.LockDocument())
            {
                var ext = new Extents3d();
                bool kapsamVar = false;
                using (var tr = belge.Database.TransactionManager.StartOpenCloseTransaction())
                {
                    foreach (var oid in idler)
                    {
                        var ent = tr.GetObject(oid, OpenMode.ForRead, false) as Entity;
                        if (ent == null) continue;
                        try
                        {
                            var e = ent.GeometricExtents;
                            if (!kapsamVar) { ext = e; kapsamVar = true; } else ext.AddExtents(e);
                        }
                        catch { }
                    }
                    tr.Commit();
                }
                var ed = belge.Editor;
                if (kapsamVar) CizimKomutlari.Yakinlas(ed, ext);
                try { ed.SetImpliedSelection(idler.ToArray()); } catch { }
                try { ed.UpdateScreen(); } catch { }
            }
            // AutoCAD penceresini öne getir (sürüme göre bulunmayabilen Focus yöntemi yansımayla)
            try
            {
                var pencere = AcApp.MainWindow;
                var odak = pencere?.GetType().GetMethod("Focus", Type.EmptyTypes);
                if (odak != null) odak.Invoke(pencere, null);
            }
            catch { }
            y["mesaj"] = HedefAdi(hedef.Tur) + " " + hedef.No + " çizimde seçildi.";
            return Cekirdek.Json.Yaz(y, false);
        }
    }

    /// <summary>
    /// SH_HESAP [hesap|merkez]: seçilen direk / hat / trafo / kanal (ya da proje geneli) için hesabı tarayıcıda açar.
    /// SH_HESAPLAR: çizimdeki bütün hesapların listesi (hesap merkezi).
    /// </summary>
    public sealed class HesapKomutlari
    {
        [CommandMethod("SH_HESAP", CommandFlags.Modal | CommandFlags.UsePickSet)]
        public void Hesap()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Teknik hesap", () =>
            {
                var ed = belge.Editor;
                if (!HesapMerkezi.SayfalarVar) { ed.WriteMessage("\nHesap sayfaları bu derlemede yok; eklentiyi yeniden kurun."); return; }

                // 1) Hangi hesap? (şerit düğmeleri kimliği komutla birlikte gönderir)
                var pso = new PromptStringOptions("\nHesap kimliği ya da merkez <merkez>: ") { AllowSpaces = false };
                var ps = ed.GetString(pso);
                if (ps.Status != PromptStatus.OK && ps.Status != PromptStatus.None) return;
                string modul = (ps.StringResult ?? "").Trim().ToLowerInvariant();
                if (modul.Length == 0) modul = "merkez";
                JsonNesne m = null;
                if (modul != "merkez")
                {
                    m = HesapMerkezi.ModulBul(modul);
                    if (m == null)
                    {
                        var idler = HesapMerkezi.Moduller.ConvertAll(x => x.Metin("id"));
                        ed.WriteMessage("\nBilinmeyen hesap: " + modul + ". Hesaplar: merkez, " + string.Join(", ", idler.ToArray()));
                        return;
                    }
                }
                var hedefler = m == null ? new List<string>(HesapKaydi.HedefTurleri) : HesapMerkezi.ModulHedefleri(m);

                // 2) Hedef: önceden seçilen tek nesne, yoksa seçim; Enter = proje geneli
                ObjectId secilen = ObjectId.Null;
                var onceden = ed.SelectImplied();
                if (onceden.Status == PromptStatus.OK && onceden.Value != null && onceden.Value.Count == 1) secilen = onceden.Value[0].ObjectId;
                try { ed.SetImpliedSelection(new ObjectId[0]); } catch { }
                if (secilen.IsNull)
                {
                    string ne = m == null ? "direği, hattı, trafoyu ya da kanalı" : string.Join(" / ", hedefler.ConvertAll(HesapMerkezi.HedefAdi).FindAll(x => x != "Proje").ToArray()).ToLowerInvariant() + " seçin";
                    var peo = new PromptEntityOptions("\n" + (m == null ? "Hesabın yapılacağı " + ne + " seçin" : m.Metin("ad") + " için " + ne) + (hedefler.Contains("proje") ? " [proje geneli için Enter]" : "") + ": ")
                    {
                        AllowNone = hedefler.Contains("proje"),
                    };
                    peo.SetRejectMessage("\nBir blok ya da çizgi (hat) seçin.");
                    peo.AddAllowedClass(typeof(BlockReference), true);
                    peo.AddAllowedClass(typeof(Polyline), true);
                    peo.AddAllowedClass(typeof(Polyline2d), true);
                    peo.AddAllowedClass(typeof(Polyline3d), true);
                    peo.AddAllowedClass(typeof(Line), true);
                    var r = ed.GetEntity(peo);
                    if (r.Status == PromptStatus.None) { Baslat(belge, modul, new HesapHedefi { Tur = "proje" }); return; }
                    if (r.Status != PromptStatus.OK) return;
                    secilen = r.ObjectId;
                }

                ed.WriteMessage("\nÇizim okunuyor...");
                var p = HesapMerkezi.ProjeOku(belge);
                string h = secilen.Handle.ToString();
                var hedef = new HesapHedefi();
                var e = p.Elemanlar.Find(x => string.Equals(x.Id, h, StringComparison.OrdinalIgnoreCase));
                if (e != null)
                {
                    bool direk = HesapBaglami.DirekMi(e), trafo = HesapBaglami.TrafoMu(e);
                    if (!direk && !trafo) { ed.WriteMessage("\nBu eleman (" + Turler.ElemanAdi(e.Tur) + ") için hesap yok; direk, trafo, hat ya da kanal seçin."); return; }
                    if (direk && trafo)
                    {
                        // trafo direği: hesaba göre direk ya da trafo; merkezde sorulur
                        bool direkOlur = hedefler.Contains("direk"), trafoOlur = hedefler.Contains("trafo");
                        if (direkOlur && trafoOlur)
                        {
                            var pko = new PromptKeywordOptions("\nTrafo direği: direk hesabı mı, trafo (çıkış) hesabı mı? [Direk/Trafo]", "Direk Trafo") { AllowNone = true };
                            pko.Keywords.Default = "Trafo";
                            var kr = ed.GetKeywords(pko);
                            if (kr.Status == PromptStatus.Cancel) return;
                            hedef.Tur = kr.Status == PromptStatus.OK && kr.StringResult == "Direk" ? "direk" : "trafo";
                        }
                        else hedef.Tur = direkOlur ? "direk" : "trafo";
                    }
                    else hedef.Tur = direk ? "direk" : "trafo";
                    hedef.Id = e.Id;
                    hedef.No = string.IsNullOrEmpty(e.GisId) ? e.Id : e.GisId;
                }
                else
                {
                    var hat = p.Hatlar.Find(x => string.Equals(x.Id, h, StringComparison.OrdinalIgnoreCase));
                    if (hat != null) { hedef.Tur = "hat"; hedef.Id = hat.Id; hedef.No = HesapBaglami.HatAdi(p, hat); }
                    else
                    {
                        var kanal = p.Kanallar.Find(x => string.Equals(x.Id, h, StringComparison.OrdinalIgnoreCase));
                        if (kanal == null) { ed.WriteMessage("\nBu nesnede şebeke bilgisi yok (direk, hat, trafo ya da kanal değil)."); return; }
                        hedef.Tur = "kanal"; hedef.Id = kanal.Id; hedef.No = kanal.Id;
                    }
                }
                if (!hedefler.Contains(hedef.Tur))
                {
                    ed.WriteMessage("\n" + m.Metin("ad") + " hesabı " + HesapMerkezi.HedefAdi(hedef.Tur).ToLowerInvariant() + " için yapılmaz; uygun hedefler: " +
                                    string.Join(", ", hedefler.ConvertAll(HesapMerkezi.HedefAdi).ToArray()) + ". Uygun hesapların listesi için SH_HESAP merkez.");
                    return;
                }

                Baslat(belge, modul, hedef);
            });
        }

        [CommandMethod("SH_HESAPLAR", CommandFlags.Modal)]
        public void Hesaplar()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Hesap merkezi", () =>
            {
                if (!HesapMerkezi.SayfalarVar) { belge.Editor.WriteMessage("\nHesap sayfaları bu derlemede yok; eklentiyi yeniden kurun."); return; }
                Baslat(belge, "merkez", new HesapHedefi { Tur = "proje" });
            });
        }

        private static void Baslat(Document belge, string modul, HesapHedefi hedef)
        {
            var ed = belge.Editor;
            string url = HesapMerkezi.Ac(belge, modul, hedef, null);
            HesapMerkezi.TarayicidaAc(url);
            string hedefYazisi = hedef.Tur == "proje" ? "proje geneli" : HesapMerkezi.HedefAdi(hedef.Tur).ToLowerInvariant() + " " + hedef.No;
            ed.WriteMessage("\n" + (modul == "merkez" ? "Hesap merkezi" : "Hesap sayfası") + " tarayıcıda açıldı (" + hedefYazisi + "). " +
                            "Sonuç sayfadaki Kaydet ile çizime yazılır; sonra çizimi kaydedin (Ctrl+S).");
            ed.WriteMessage("\nAçılmadıysa adresi tarayıcıya yapıştırın: " + url);
        }
    }
}
