using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Runtime;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
using WinForms = System.Windows.Forms;

[assembly: ExtensionApplication(typeof(SebekeHakedis.Eklenti.Uygulama))]
[assembly: CommandClass(typeof(SebekeHakedis.Eklenti.Komutlar))]

namespace SebekeHakedis.Eklenti
{
    public sealed class Uygulama : IExtensionApplication
    {
        public static string Surum
        {
            get
            {
                var v = typeof(Uygulama).Assembly.GetName().Version;
                return v == null ? "0.1" : v.Major + "." + v.Minor + "." + v.Build;
            }
        }

        public void Initialize()
        {
            try { Serit.Kur(); } catch (System.Exception ex) { Yaz("Şerit menü kurulamadı: " + ex.Message); }
            try { ArmaturTakibi.Baslat(); } catch (System.Exception ex) { Yaz("Armatür takibi başlatılamadı: " + ex.Message); }
            try { KenarTakibi.Baslat(); } catch (System.Exception ex) { Yaz("Kanal kenarı takibi başlatılamadı: " + ex.Message); }
            try { HesapMerkezi.Baslat(); } catch (System.Exception ex) { Yaz("Hesap merkezi başlatılamadı: " + ex.Message); }
            Yaz(Marka.Ad + " " + Surum + " yüklendi. Şeritte ŞEBEKE-M ve ŞEBEKE-M ARAÇLAR sekmeleri; komut listesi için SH_HAKKINDA.");
        }

        public void Terminate()
        {
            try { HesapMerkezi.Durdur(); } catch { }
        }

        internal static void Yaz(string mesaj)
        {
            try
            {
                var belge = AcApp.DocumentManager.MdiActiveDocument;
                if (belge != null) belge.Editor.WriteMessage("\n" + mesaj);
            }
            catch { }
        }
    }

    public sealed class Komutlar
    {
        private static Editor Ed => AcApp.DocumentManager.MdiActiveDocument?.Editor;

        // ---------------- Komutlar ----------------

        [CommandMethod("SH_RAPOR", CommandFlags.Modal)]
        public void Rapor()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Calistir("Durum Tespit raporu", () =>
            {
                var p = CizimdenProje(belge);
                if (p == null) return;
                string varsayilan = Ad(belge) + "_DURUMTESPIT_" + DateTime.Now.ToString("dd.MM.yyyy_HH_mm") + ".xlsx";
                string yol = KayitYeriSor("Durum Tespit raporunu kaydet", "Excel dosyası (*.xlsx)|*.xlsx", varsayilan, Klasor(belge));
                if (yol == null) return;
                RaporYazici.Yaz(p, yol, Uygulama.Surum, null, HesapMerkezi.Bilgi(belge));
                if (p.Hesaplar.Count > 0) Uygulama.Yaz(p.Hesaplar.Count + " teknik hesap kaydı HESAPLAR sayfasına yazıldı.");
                Uygulama.Yaz("Rapor hazır: " + yol);
                Ac(yol);
            });
        }

        [CommandMethod("SH_ICEAL", CommandFlags.Modal)]
        public void IceAl()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Calistir("Telefona gönderme", () =>
            {
                var p = CizimdenProje(belge);
                if (p == null) return;
                var ayar = AyarDeposu.Oku(belge.Database);
                if (ayar.Dom > 0) p.Dom = ayar.Dom;
                if (ayar.AktifHakedis > 0) p.AktifHakedis = ayar.AktifHakedis;
                int hakNo = CizimSozlugu.HakNoOku(belge.Database);
                if (hakNo > 0) p.AktifHakedis = hakNo;
                if (!string.IsNullOrEmpty(ayar.KatmanOnEki)) p.KatmanOnEki = ayar.KatmanOnEki;
                if (string.IsNullOrEmpty(p.KatmanOnEki)) p.KatmanOnEki = "SC";
                p.GisOnEki = string.IsNullOrEmpty(ayar.GisOnEki) ? p.KatmanOnEki : ayar.GisOnEki;
                if (p.Dom == 0) Uygulama.Yaz("Not: dilim orta meridyeni (DOM) ayarlı değil; telefonda proje açılırken sorulacak. SH_AYARLAR ile girebilirsiniz.");
                string yol = KayitYeriSor("Proje dosyasını kaydet",
                    "AutoCAD proje dosyası (*.sebeke.json)|*.sebeke.json|Telefon proje dosyası (*.volt.json)|*.volt.json",
                    Ad(belge) + ProjeDosyasi.Uzanti, Klasor(belge));
                if (yol == null) return;
                bool volt = yol.EndsWith(ProjeDosyasi.VoltUzanti, StringComparison.OrdinalIgnoreCase);
                string uzanti = volt ? ProjeDosyasi.VoltUzanti : ProjeDosyasi.Uzanti;
                if (!yol.EndsWith(uzanti, StringComparison.OrdinalIgnoreCase))
                {
                    string ad = Path.GetFileName(yol);
                    if (ad.EndsWith(".json", StringComparison.OrdinalIgnoreCase)) ad = ad.Substring(0, ad.Length - 5);
                    yol = Path.Combine(Path.GetDirectoryName(yol) ?? "", ad + uzanti);
                }
                string olusturan = Marka.Ad + " AutoCAD eklentisi " + Uygulama.Surum;
                File.WriteAllText(yol, volt ? ProjeDosyasi.VoltYaz(p, olusturan) : ProjeDosyasi.Yaz(p, olusturan), new UTF8Encoding(false));
                Uygulama.Yaz("Proje dosyası yazıldı: " + yol);
                Uygulama.Yaz("Telefona aktarmak için dosyayı Google Drive'a koyun; telefonda Projeler › \"AutoCAD dosyasından proje al\" ile seçin.");
            });
        }

        [CommandMethod("SH_PROJERAPOR", CommandFlags.Modal)]
        public void ProjeRapor()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            Calistir("Proje dosyasından rapor", () =>
            {
                string kaynak = ProjeDosyasiSec("Proje dosyasını seçin", belge != null ? Klasor(belge) : "");
                if (kaynak == null) return;
                var p = ProjeDosyasi.Oku(ProjeMetniOku(kaynak));
                string ad = ProjeDosyaAdi(kaynak);
                string yol = KayitYeriSor("Durum Tespit raporunu kaydet", "Excel dosyası (*.xlsx)|*.xlsx",
                    ad + "_DURUMTESPIT_" + DateTime.Now.ToString("dd.MM.yyyy_HH_mm") + ".xlsx", Path.GetDirectoryName(kaynak));
                if (yol == null) return;
                RaporYazici.Yaz(p, yol, Uygulama.Surum);
                Uygulama.Yaz("Rapor hazır: " + yol);
                Ac(yol);
            });
        }

        /// <summary>
        /// Proje özeti: projeler (bölgeler) ve seçilen projenin malzeme listesi bir pencerede; listeler Excel'e aktarılır.
        /// Toplamlar Durum Tespit raporunun ÖZET sayfasıyla aynıdır.
        /// </summary>
        [CommandMethod("SH_OZET", CommandFlags.Modal)]
        public void Ozet()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Calistir("Proje özeti", () =>
            {
                var p = CizimdenProje(belge);
                if (p == null) return;
                var oz = new ProjeOzeti(p);
                Pencereler.ProjeOzetiGoster(oz, g =>
                {
                    string ek = g.Proje == null || g.Proje.Tumu ? "_PROJE_OZETI_" : "_" + g.Proje.GorunenAd + "_MALZEME_";
                    string yol = KayitYeriSor("Proje özetini Excel'e kaydet", "Excel dosyası (*.xlsx)|*.xlsx",
                        Ad(belge) + ek + DateTime.Now.ToString("dd.MM.yyyy_HH_mm") + ".xlsx", Klasor(belge));
                    if (yol == null) return;
                    oz.ExcelYaz(yol, g.Proje, g.Hakedis, g.Durum, g.Ara, Uygulama.Surum);
                    Uygulama.Yaz("Proje özeti Excel'e yazıldı: " + yol);
                    Ac(yol);
                });
            });
        }

        /// <summary>
        /// Eksik malzeme sorgusu (AutoCAD raporundaki DETAY): ör. "topraklaması olmayan AG direkleri". Bulunan elemanlar
        /// çizimde seçilir; istenirse sonuç Excel'e yazılır. Son süzgeçler çizimin ayarlarında saklanır.
        /// </summary>
        [CommandMethod("SH_DETAY", CommandFlags.Modal | CommandFlags.Redraw)]
        public void Detay()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Calistir("Eksik malzeme sorgusu", () =>
            {
                var o = Ortam.Hazirla(belge);
                var ed = o.Ed;
                if (o.Proje.Elemanlar.Count == 0) { Pencereler.Bilgi("Bu çizimde şebeke elemanı (direk, pano, trafo…) yok."); return; }
                var a = o.Ayar;
                var f = new DetayFiltresi
                {
                    AnaCins = a.SonDeger("detay.anaCins"), AnaTip = a.SonDeger("detay.anaTip"), AnaDurum = a.SonDeger("detay.anaDurum"),
                    Bolge = a.SonDeger("detay.bolge"), Cins = a.SonDeger("detay.cins"), Tip = a.SonDeger("detay.tip"), Durum = a.SonDeger("detay.durum"),
                    Hakedis = SayiCoz.Tam(a.SonDeger("detay.hakedis", "0")),
                    Kapsam = a.SonDeger("detay.kapsam") == "olanlar" ? DetayKapsami.Olanlar : a.SonDeger("detay.kapsam") == "hepsi" ? DetayKapsami.Hepsi : DetayKapsami.Olmayanlar,
                };
                List<DetaySatiri> satirlar;
                var islem = Pencereler.Detay(o, f, out satirlar);
                if (islem == DetayIslemi.Vazgec) return;
                a.Son["detay.anaCins"] = f.AnaCins; a.Son["detay.anaTip"] = f.AnaTip; a.Son["detay.anaDurum"] = f.AnaDurum; a.Son["detay.bolge"] = f.Bolge;
                a.Son["detay.cins"] = f.Cins; a.Son["detay.tip"] = f.Tip; a.Son["detay.durum"] = f.Durum;
                a.Son["detay.hakedis"] = f.Hakedis.ToString(System.Globalization.CultureInfo.InvariantCulture);
                a.Son["detay.kapsam"] = f.Kapsam == DetayKapsami.Olanlar ? "olanlar" : f.Kapsam == DetayKapsami.Hepsi ? "hepsi" : "olmayanlar";
                o.AyarKaydet();

                var olanlar = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var olmayanlar = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var s in satirlar) (s.Olan ? olanlar : olmayanlar).Add(s.Eleman.Id);
                string aranan = DetayAciklamasi(f);
                if (satirlar.Count == 0)
                {
                    Pencereler.Bilgi("Süzgece uyan eleman bulunamadı.\n\n" + aranan);
                    return;
                }

                // Bulunan elemanlar çizimde seçili kalsın
                var ids = new List<Autodesk.AutoCAD.DatabaseServices.ObjectId>();
                var gorulen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var s in satirlar)
                {
                    Autodesk.AutoCAD.DatabaseServices.ObjectId id;
                    if (gorulen.Add(s.Eleman.Id) && Toplayici.TaniticiylaBul(o.Db, s.Eleman.Id, out id)) ids.Add(id);
                }
                try { ed.SetImpliedSelection(ids.ToArray()); } catch { }

                ed.WriteMessage("\nEksik malzeme sorgusu: " + (f.Kapsam != DetayKapsami.Olanlar ? olmayanlar.Count + " eksik" : "") +
                                (f.Kapsam == DetayKapsami.Hepsi ? ", " : "") + (f.Kapsam != DetayKapsami.Olmayanlar ? olanlar.Count + " olan" : "") + " eleman; " + ids.Count + " eleman seçildi.");
                if (islem != DetayIslemi.Excel) return;
                string yol = KayitYeriSor("Eksik malzeme sorgusunu kaydet", "Excel dosyası (*.xlsx)|*.xlsx",
                    Ad(belge) + "_DETAY_" + DateTime.Now.ToString("dd.MM.yyyy_HH_mm") + ".xlsx", Klasor(belge));
                if (yol == null) return;
                RaporYazici.DetayYaz(o.Proje, satirlar, yol, Uygulama.Surum, aranan.Replace("\n", "  ·  "));
                Uygulama.Yaz("Sorgu sonucu yazıldı: " + yol);
                Ac(yol);
            });
        }

        private static string DetayAciklamasi(DetayFiltresi f)
        {
            var el = new List<string>();
            if (f.AnaCins.Length > 0) el.Add(f.AnaCins);
            if (f.AnaTip.Length > 0) el.Add(f.AnaTip);
            if (f.AnaDurum.Length > 0) el.Add("durum " + f.AnaDurum);
            var ar = new List<string>();
            if (f.Cins.Length > 0) ar.Add(f.Cins);
            if (f.Tip.Length > 0) ar.Add(f.Tip);
            if (f.Durum.Length > 0) ar.Add("durum " + f.Durum);
            if (f.Hakedis > 0) ar.Add(f.Hakedis + ". hakediş");
            return "Elemanlar: " + (el.Count > 0 ? string.Join(", ", el) : "hepsi") + "\nAranan malzeme: " + (ar.Count > 0 ? string.Join(", ", ar) : "herhangi bir ara malzeme");
        }

        [CommandMethod("SH_DOKUM", CommandFlags.Modal)]
        public void Dokum()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Calistir("Teknik döküm", () =>
            {
                var varliklar = Toplayici.Topla(belge.Database);
                string yol = KayitYeriSor("Teknik dökümü kaydet (destek için)", "JSON (*.json)|*.json", Ad(belge) + "_dokum.json", Klasor(belge));
                if (yol == null) return;
                File.WriteAllText(yol, CadVarlik.DokumYaz(varliklar, belge.Name), new UTF8Encoding(false));
                Uygulama.Yaz(varliklar.Count + " nesne yazıldı: " + yol);
            });
        }

        [CommandMethod("SH_HAKKINDA", CommandFlags.Modal)]
        public void Hakkinda()
        {
            Calistir("Hakkında", () => Pencereler.Hakkinda(Uygulama.Surum, OrtamBilgisi(), KomutlariYaz));
        }

        private static string OrtamBilgisi()
        {
            string acad = "";
            try { var v = AcApp.Version; acad = "AutoCAD R" + v.Major + "." + v.Minor + " · "; } catch { }
            return acad + ".NET " + System.Runtime.InteropServices.RuntimeEnvironment.GetSystemVersion();
        }

        /// <summary>Komut listesini komut satırına yazar (Hakkında penceresindeki listeyle aynı).</summary>
        private static void KomutlariYaz()
        {
            var ed = Ed;
            if (ed == null) return;
            ed.WriteMessage("\n" + Marka.Ad + " AutoCAD eklentisi " + Uygulama.Surum + " (" + OrtamBilgisi() + ")");
            string grup = null;
            foreach (var k in KomutRehberi.Liste)
            {
                if (k[0] != grup) { grup = k[0]; ed.WriteMessage("\n  " + grup); }
                ed.WriteMessage("\n  " + k[1].PadRight(16) + k[2]);
            }
        }

        [CommandMethod("SH_SERIT", CommandFlags.Modal)]
        public void SeritKur()
        {
            Serit.Olustur();
            Uygulama.Yaz("ŞEBEKE-M sekmeleri kuruldu.");
        }

        // ---------------- Yardımcılar ----------------

        private static Proje CizimdenProje(Document belge)
        {
            var ed = belge.Editor;
            ed.WriteMessage("\nÇizim okunuyor...");
            var sure = Stopwatch.StartNew();
            List<CadVarlik> varliklar = Toplayici.Topla(belge.Database);
            if (!NesneOkuyucu.SebekeCizimiMi(varliklar))
            {
                ed.WriteMessage("\nBu çizimde şebeke verisi bulunamadı (direk, hat ya da bölge bilgisi yok).");
                return null;
            }
            var p = NesneOkuyucu.Oku(varliklar, belge.Name);
            p.Onaylar = CizimSozlugu.OnaylariOku(belge.Database);
            try { p.Hesaplar = HesapDeposu.Oku(belge.Database); } catch (System.Exception ex) { ed.WriteMessage("\nHesap kayıtları okunamadı: " + ex.Message); }
            ed.WriteMessage("\n" + p.Bolgeler.Count + " bölge, " + p.Elemanlar.Count + " eleman, " + p.Hatlar.Count + " hat, " + p.Kanallar.Count + " kanal" +
                            (p.Hesaplar.Count > 0 ? ", " + p.Hesaplar.Count + " hesap kaydı" : "") + " okundu (" + sure.ElapsedMilliseconds + " ms).");
            if (p.Bolgeler.Count == 0) ed.WriteMessage("\nUyarı: çizimde bölge sınırı yok; PROJE sütunları boş kalacak.");
            return p;
        }

        internal static void Calistir(string islem, Action is_)
        {
            try { is_(); }
            catch (System.Exception ex)
            {
                Uygulama.Yaz(islem + " sırasında hata: " + ex.Message);
                try
                {
                    string gunluk = Path.Combine(Path.GetTempPath(), "SebekeHakedis_hata.txt");
                    File.AppendAllText(gunluk, DateTime.Now.ToString("s") + "  " + islem + "\n" + ex + "\n\n", new UTF8Encoding(false));
                    Uygulama.Yaz("Ayrıntı: " + gunluk);
                }
                catch { }
            }
        }

        /// <summary>Proje dosyası türleri: AutoCAD (.sebeke.json), telefon (.volt.json), telefonun teslim paketi (.zip).</summary>
        internal const string ProjeDosyasiFiltresi =
            "Proje dosyaları (*.sebeke.json;*.volt.json;*.json;*.zip)|*.sebeke.json;*.volt.json;*.json;*.zip|" +
            "AutoCAD proje dosyası (*.sebeke.json)|*.sebeke.json|Telefon proje dosyası (*.volt.json)|*.volt.json|" +
            "Telefon teslim paketi (*.zip)|*.zip|Tüm dosyalar (*.*)|*.*";

        internal static string ProjeDosyasiSec(string baslik, string klasor)
        {
            using (var dlg = new WinForms.OpenFileDialog { Title = baslik, Filter = ProjeDosyasiFiltresi, InitialDirectory = klasor ?? "" })
            {
                return dlg.ShowDialog() == WinForms.DialogResult.OK ? dlg.FileName : null;
            }
        }

        /// <summary>
        /// Proje dosyasının metnini okur. Zip (telefonun teslim paketi) ise içindeki PROJECT_INFO/project.json alınır;
        /// biçim ayrımını (AutoCAD / telefon) ProjeDosyasi.Oku yapar.
        /// </summary>
        internal static string ProjeMetniOku(string yol)
        {
            if (!yol.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) return File.ReadAllText(yol, Encoding.UTF8);
            using (var fs = File.OpenRead(yol))
            using (var zip = new ZipArchive(fs, ZipArchiveMode.Read))
            {
                ZipArchiveEntry secilen = null;
                foreach (var e in zip.Entries)
                {
                    string ad = e.FullName.Replace('\\', '/');
                    if (ad.EndsWith("PROJECT_INFO/project.json", StringComparison.OrdinalIgnoreCase)) { secilen = e; break; }
                    if (secilen == null && ad.EndsWith(ProjeDosyasi.Uzanti, StringComparison.OrdinalIgnoreCase)) secilen = e;
                }
                if (secilen == null) throw new FormatException("Zip içinde proje dosyası bulunamadı (PROJECT_INFO/project.json ya da *.sebeke.json).");
                using (var r = new StreamReader(secilen.Open(), Encoding.UTF8)) return r.ReadToEnd();
            }
        }

        /// <summary>Dosya adından proje adı (uzantılar atılır).</summary>
        internal static string ProjeDosyaAdi(string yol)
        {
            string ad = Path.GetFileName(yol);
            foreach (var u in new[] { ProjeDosyasi.Uzanti, ProjeDosyasi.VoltUzanti, "_teslim_paketi.zip", ".zip", ".json" })
                if (ad.EndsWith(u, StringComparison.OrdinalIgnoreCase)) { ad = ad.Substring(0, ad.Length - u.Length); break; }
            return string.IsNullOrEmpty(ad) ? "Proje" : ad;
        }

        private static string KayitYeriSor(string baslik, string filtre, string dosyaAdi, string klasor)
        {
            using (var dlg = new WinForms.SaveFileDialog
            {
                Title = baslik,
                Filter = filtre,
                FileName = Temizle(dosyaAdi),
                InitialDirectory = klasor ?? "",
                OverwritePrompt = true,
                AddExtension = true,
            })
            {
                return dlg.ShowDialog() == WinForms.DialogResult.OK ? dlg.FileName : null;
            }
        }

        private static void Ac(string yol)
        {
            try
            {
                var cevap = WinForms.MessageBox.Show("Rapor hazır:\n" + yol + "\n\nŞimdi açılsın mı?", Marka.Ad,
                    WinForms.MessageBoxButtons.YesNo, WinForms.MessageBoxIcon.Information);
                if (cevap == WinForms.DialogResult.Yes) Process.Start(new ProcessStartInfo(yol) { UseShellExecute = true });
            }
            catch (System.Exception ex) { Uygulama.Yaz("Dosya açılamadı: " + ex.Message); }
        }

        private static string Ad(Document belge)
        {
            string ad = Path.GetFileNameWithoutExtension(belge.Name ?? "");
            return string.IsNullOrEmpty(ad) ? "Proje" : ad;
        }

        internal static string Klasor(Document belge)
        {
            try
            {
                string d = Path.GetDirectoryName(belge.Name ?? "");
                if (!string.IsNullOrEmpty(d) && Directory.Exists(d)) return d;
            }
            catch { }
            return Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        }

        private static string Temizle(string ad)
        {
            foreach (char c in Path.GetInvalidFileNameChars()) ad = ad.Replace(c, '_');
            return ad;
        }
    }
}
