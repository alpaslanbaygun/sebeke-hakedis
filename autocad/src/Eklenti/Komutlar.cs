using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
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
            Yaz("Şebeke Hakediş " + Surum + " yüklendi. Komutlar: SH_RAPOR, SH_ICEAL, SH_PROJERAPOR, SH_OZET, SH_HAKKINDA");
        }

        public void Terminate() { }

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
                RaporYazici.Yaz(p, yol, Uygulama.Surum);
                Uygulama.Yaz("Rapor hazır: " + yol);
                Ac(yol);
            });
        }

        [CommandMethod("SH_ICEAL", CommandFlags.Modal)]
        public void IceAl()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Calistir("PROMAGIS içe alma", () =>
            {
                var p = CizimdenProje(belge);
                if (p == null) return;
                string yol = KayitYeriSor("Proje dosyasını kaydet", "Şebeke Hakediş projesi (*.sebeke.json)|*.sebeke.json", Ad(belge) + ProjeDosyasi.Uzanti, Klasor(belge));
                if (yol == null) return;
                if (!yol.EndsWith(ProjeDosyasi.Uzanti, StringComparison.OrdinalIgnoreCase))
                    yol = Path.Combine(Path.GetDirectoryName(yol) ?? "", Path.GetFileNameWithoutExtension(yol) + ProjeDosyasi.Uzanti);
                File.WriteAllText(yol, ProjeDosyasi.Yaz(p, "Şebeke Hakediş AutoCAD eklentisi " + Uygulama.Surum), new UTF8Encoding(false));
                Uygulama.Yaz("Proje dosyası yazıldı: " + yol);
            });
        }

        [CommandMethod("SH_PROJERAPOR", CommandFlags.Modal)]
        public void ProjeRapor()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            Calistir("Proje dosyasından rapor", () =>
            {
                string kaynak;
                using (var dlg = new WinForms.OpenFileDialog
                {
                    Title = "Proje dosyasını seçin",
                    Filter = "Şebeke Hakediş projesi (*.sebeke.json)|*.sebeke.json|Tüm dosyalar (*.*)|*.*",
                    InitialDirectory = belge != null ? Klasor(belge) : "",
                })
                {
                    if (dlg.ShowDialog() != WinForms.DialogResult.OK) return;
                    kaynak = dlg.FileName;
                }
                var p = ProjeDosyasi.Oku(File.ReadAllText(kaynak, Encoding.UTF8));
                string ad = Path.GetFileName(kaynak);
                if (ad.EndsWith(ProjeDosyasi.Uzanti, StringComparison.OrdinalIgnoreCase)) ad = ad.Substring(0, ad.Length - ProjeDosyasi.Uzanti.Length);
                string yol = KayitYeriSor("Durum Tespit raporunu kaydet", "Excel dosyası (*.xlsx)|*.xlsx",
                    ad + "_DURUMTESPIT_" + DateTime.Now.ToString("dd.MM.yyyy_HH_mm") + ".xlsx", Path.GetDirectoryName(kaynak));
                if (yol == null) return;
                RaporYazici.Yaz(p, yol, Uygulama.Surum);
                Uygulama.Yaz("Rapor hazır: " + yol);
                Ac(yol);
            });
        }

        [CommandMethod("SH_OZET", CommandFlags.Modal)]
        public void Ozet()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Calistir("Proje özeti", () =>
            {
                var p = CizimdenProje(belge);
                if (p == null) return;
                var ed = belge.Editor;
                ed.WriteMessage("\n──────── " + p.Ad + " ────────");
                ed.WriteMessage("\nBölge (alt proje): " + p.Bolgeler.Count + "   ·   GPS noktası: " + p.Noktalar.Count);
                ed.WriteMessage("\nEleman: " + p.Elemanlar.Count + "   ·   Hat: " + p.Hatlar.Count + "   ·   Kanal: " + p.Kanallar.Count + "   ·   Sondaj: " + p.Sondajlar.Count);
                var turler = new SortedDictionary<string, int>(StringComparer.Ordinal);
                foreach (var e in p.Elemanlar) { int c; turler.TryGetValue(e.Tur, out c); turler[e.Tur] = c + 1; }
                foreach (var kv in turler) ed.WriteMessage("\n   " + kv.Key + ": " + kv.Value);
                var hak = new SortedDictionary<int, int>();
                foreach (var e in p.Elemanlar) { int c; hak.TryGetValue(e.Hakedis, out c); hak[e.Hakedis] = c + 1; }
                var sb = new StringBuilder();
                foreach (var kv in hak) sb.Append("  H" + kv.Key + ": " + kv.Value);
                ed.WriteMessage("\nHakedişe göre eleman:" + sb);
                if (p.Uyarilar.Count > 0) ed.WriteMessage("\nUyarı: " + p.Uyarilar.Count + " nesne okunamadı (ayrıntı raporun UYARILAR sayfasında).");
            });
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
            var ed = Ed;
            if (ed == null) return;
            ed.WriteMessage("\nŞebeke Hakediş AutoCAD eklentisi " + Uygulama.Surum + " (" + System.Runtime.InteropServices.RuntimeEnvironment.GetSystemVersion() + ")");
            ed.WriteMessage("\n  SH_RAPOR       Bu çizimden Durum Tespit raporu (Excel)");
            ed.WriteMessage("\n  SH_ICEAL       PROMAGIS çizimini proje dosyasına aktar (.sebeke.json)");
            ed.WriteMessage("\n  SH_PROJERAPOR  Proje dosyasından Durum Tespit raporu");
            ed.WriteMessage("\n  SH_OZET        Çizimdeki proje özetini göster");
            ed.WriteMessage("\n  SH_SERIT       Şerit menü sekmesini yeniden kur");
            ed.WriteMessage("\n  SH_DOKUM       Destek için teknik döküm dosyası");
        }

        [CommandMethod("SH_SERIT", CommandFlags.Modal)]
        public void SeritKur()
        {
            Serit.Olustur();
            Uygulama.Yaz("ŞEBEKE HAKEDİŞ sekmesi kuruldu.");
        }

        // ---------------- Yardımcılar ----------------

        private static Proje CizimdenProje(Document belge)
        {
            var ed = belge.Editor;
            ed.WriteMessage("\nÇizim okunuyor...");
            var sure = Stopwatch.StartNew();
            List<CadVarlik> varliklar = Toplayici.Topla(belge.Database);
            if (!PromagisOkuyucu.PromagisCizimiMi(varliklar))
            {
                ed.WriteMessage("\nBu çizimde PROMAGIS verisi bulunamadı (direk, hat ya da bölge bilgisi yok).");
                return null;
            }
            var p = PromagisOkuyucu.Oku(varliklar, belge.Name);
            ed.WriteMessage("\n" + p.Bolgeler.Count + " bölge, " + p.Elemanlar.Count + " eleman, " + p.Hatlar.Count + " hat, " + p.Kanallar.Count + " kanal okundu (" + sure.ElapsedMilliseconds + " ms).");
            if (p.Bolgeler.Count == 0) ed.WriteMessage("\nUyarı: çizimde bölge sınırı yok; PROJE sütunları boş kalacak.");
            return p;
        }

        private static void Calistir(string islem, Action is_)
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
                var cevap = WinForms.MessageBox.Show("Rapor hazır:\n" + yol + "\n\nŞimdi açılsın mı?", "Şebeke Hakediş",
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

        private static string Klasor(Document belge)
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
