using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Test
{
    /// <summary>
    /// Çekirdek testleri.
    ///   ornek                         : depodaki örnek dökümle birim testleri (CI'da çalışır)
    ///   dogrula dokum.json ref.tsv cikti/ : gerçek bir PROMAGIS çizimi ve PROMAGIS raporuyla satır satır karşılaştırma
    ///   katsayilar hedef.json         : ortak katsayı dosyasını üretir
    /// </summary>
    public static class Program
    {
        private static int _hata;

        public static int Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            CultureInfo.DefaultThreadCurrentCulture = new CultureInfo("tr-TR"); // Türkçe Windows'u taklit et
            CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
            string komut = args.Length > 0 ? args[0] : "ornek";
            try
            {
                switch (komut)
                {
                    case "ornek": Ornek(args.Length > 1 ? args[1] : Path.Combine(AppContext.BaseDirectory, "ornek-dokum.json")); break;
                    case "dogrula": Dogrula(args[1], args[2], args[3]); break;
                    case "katsayilar": File.WriteAllText(args[1], Json.Yaz(Katsayilar.Varsayilan.JsonYap()) + "\n", new UTF8Encoding(false)); Console.WriteLine("yazıldı: " + args[1]); break;
                    default: Console.WriteLine("Bilinmeyen komut: " + komut); return 2;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("HATA: " + ex);
                return 1;
            }
            Console.WriteLine(_hata == 0 ? "SONUÇ: tüm denetimler geçti" : "SONUÇ: " + _hata + " denetim başarısız");
            return _hata == 0 ? 0 : 1;
        }

        private static void Esit(object beklenen, object gercek, string ad)
        {
            bool ok;
            if (beklenen is double b && gercek is double g) ok = Math.Abs(b - g) < 1e-6;
            else ok = Equals(beklenen, gercek);
            Console.WriteLine((ok ? "  ✓ " : "  ✗ ") + ad + (ok ? "" : "  beklenen=" + beklenen + " gerçek=" + gercek));
            if (!ok) _hata++;
        }

        // ---------------- Birim testleri (örnek döküm) ----------------

        private static void Ornek(string yol)
        {
            Console.WriteLine("Örnek döküm: " + yol);
            Esit(16.8, SayiCoz.Coz("16,8"), "Türkçe ondalık");
            Esit(0.0, SayiCoz.Coz(",00"), "',00' sıfırdır");
            Esit(10.5, SayiCoz.Coz("10.5"), "noktalı ondalık");
            Esit("OG/AG", KanalKodu.Kablolar(12), "kanal kodu 12 = OG + AG");
            Esit("/AG/AYD/REK", KanalKodu.Kablolar(7), "kanal kodu 7 = AG + AYD + REK");
            string og, ag;
            Katsayilar.KanalUnsurlari("0104", out og, out ag);
            Esit("0104", og, "kanal OG tarifesi"); Esit("0105", ag, "kanal AG tarifesi");

            var varliklar = CadVarlik.DokumOku(File.ReadAllText(yol, Encoding.UTF8));
            var p = PromagisOkuyucu.Oku(varliklar, "ornek.dwg");
            Esit(2, p.Bolgeler.Count, "bölge sayısı");
            Esit(1, p.Noktalar.Count, "GPS noktası");
            Esit(3, p.Elemanlar.Count, "eleman sayısı");
            Esit(2, p.Hatlar.Count, "hat sayısı");
            Esit(1, p.Kanallar.Count, "kanal sayısı");
            Esit(1, p.Sondajlar.Count, "sondaj sayısı");
            Esit("SC", p.KatmanOnEki, "katman ön eki");
            Esit(2, p.AktifHakedis, "en büyük hakediş");

            var direk = p.Elemanlar.Find(e => e.GisId == "SC77");
            Esit("AG_DIREK", direk.Tur, "direk türü");
            Esit("B1", direk.Bolge, "direk bölgesi (iki bölgenin kesişiminde küçük olan)");
            Esit(2, direk.Kalemler.Count, "direk kalemleri");
            Esit(36.946, direk.Kalemler[1].Toplam, "travers kg");
            var disari = p.Elemanlar.Find(e => e.GisId == "SC99");
            Esit("B2", disari.Bolge, "bölge dışındaki direk en yakın bölgeye");
            var demontaj = p.Elemanlar.Find(e => e.Durum == "DM");
            Esit("KESİK", demontaj.DmDurum, "demontaj durumu");

            // Proje dosyası gidip gelme
            string json = ProjeDosyasi.Yaz(p, "test");
            var p2 = ProjeDosyasi.Oku(json);
            Esit(ProjeDosyasi.Yaz(p2, "test").Length, json.Length, "proje dosyası gidip gelince aynı kalır");

            var dt = new DurumTespit(p);
            var kanal = dt.Satirlar.FindAll(s => s.Cins == "KABLO_KANALI");
            Esit(2, kanal.Count, "OG+AG kanal iki satıra bölünür");
            Esit(10.0, kanal[0].Toplam + kanal[1].Toplam, "kanal hacmi korunur");
            Esit(5.0, kanal[0].Toplam, "OG payı %50");
            var tel = dt.Satirlar.FindAll(s => s.Cins == "AL_İLETKENLER");
            Esit(2, tel.Count, "4P+R iki tel türüne açılır");
            var rose = tel.Find(s => s.Tip == "ROSE");
            Esit(100.0, rose.Miktar, "ROSE metre (1 tel × 100 m)");
            Esit(5.915, rose.Toplam, "ROSE kg");
            var pansy = tel.Find(s => s.Tip == "PANSY");
            Esit(400.0, pansy.Miktar, "PANSY metre (4 tel × 100 m)");
            Esit(false, dt.Satirlar.Exists(s => s.Cins == "8"), "kanalın kendi satırı rapora girmez");
            Esit("KESİK", dt.Satirlar.Find(s => s.Durum == "DM" && s.Cins == "AG_DEMİR").DmDurum, "DM DRM sütunu");

            string xlsx = Path.Combine(Path.GetTempPath(), "sebeke-test.xlsx");
            RaporYazici.Yaz(p, xlsx, "test");
            Esit(true, new FileInfo(xlsx).Length > 2000, "Excel dosyası yazıldı");
        }

        // ---------------- Gerçek proje doğrulaması ----------------

        private static void Dogrula(string dokumYolu, string refYolu, string ciktiKlasoru)
        {
            Directory.CreateDirectory(ciktiKlasoru);
            var sure = System.Diagnostics.Stopwatch.StartNew();
            var varliklar = CadVarlik.DokumOku(File.ReadAllText(dokumYolu, Encoding.UTF8));
            var p = PromagisOkuyucu.Oku(varliklar, "SC_25_38_03_HAK_8_ALINAN.dwg");
            Console.WriteLine($"Okuma: {sure.ElapsedMilliseconds} ms · bölge {p.Bolgeler.Count}, nokta {p.Noktalar.Count}, eleman {p.Elemanlar.Count}, hat {p.Hatlar.Count}, kanal {p.Kanallar.Count}, sondaj {p.Sondajlar.Count}, uyarı {p.Uyarilar.Count}");
            foreach (var u in p.Uyarilar) Console.WriteLine("  uyarı: " + u);

            string projeYolu = Path.Combine(ciktiKlasoru, "proje.sebeke.json");
            File.WriteAllText(projeYolu, ProjeDosyasi.Yaz(p, "test"), new UTF8Encoding(false));
            var p2 = ProjeDosyasi.Oku(File.ReadAllText(projeYolu, Encoding.UTF8));
            Esit(p.Elemanlar.Count, p2.Elemanlar.Count, "proje dosyası: eleman sayısı korunur");

            sure.Restart();
            var dt = new DurumTespit(p2);
            Console.WriteLine($"Rapor: {sure.ElapsedMilliseconds} ms · {dt.Satirlar.Count} satır");

            // PROMAGIS raporu
            var refSatirlar = new List<string[]>();
            string[] bas = null;
            foreach (var satir in File.ReadAllLines(refYolu, Encoding.UTF8))
            {
                var f = satir.Split('\t');
                if (bas == null) { bas = f; continue; }
                refSatirlar.Add(f);
            }
            var ix = new Dictionary<string, int>();
            for (int i = 0; i < bas.Length; i++) ix[bas[i]] = i;
            Console.WriteLine("PROMAGIS raporu: " + refSatirlar.Count + " satır");

            // Satır satır: INDEX + CİNS + TİP + MLZ.TARİFE ile eşleştir
            var bizim = new Dictionary<string, List<RaporSatiri>>();
            foreach (var s in dt.Satirlar)
            {
                string k = s.Index + "|" + s.Cins + "|" + s.Tip + "|" + s.MalzemeTarife;
                List<RaporSatiri> l; if (!bizim.TryGetValue(k, out l)) bizim[k] = l = new List<RaporSatiri>();
                l.Add(s);
            }
            var alanFark = new Dictionary<string, int>();
            int eslesen = 0, bulunamayan = 0, tamAyni = 0;
            var ornekler = new List<string>();
            foreach (var r in refSatirlar)
            {
                string k = r[ix["INDEX"]] + "|" + r[ix["CİNS"]] + "|" + r[ix["TİP"]] + "|" + r[ix["MLZ.TARİFE"]];
                List<RaporSatiri> l;
                if (!bizim.TryGetValue(k, out l) || l.Count == 0) { bulunamayan++; if (ornekler.Count < 8) ornekler.Add("yok: " + k); continue; }
                var s = l[0]; l.RemoveAt(0);
                eslesen++;
                bool ayni = true;
                Karsilastir("PROJE", r[ix["PROJE"]], s.Proje, alanFark, ref ayni);
                Karsilastir("DURUM", r[ix["DURUM"]], s.Durum, alanFark, ref ayni);
                Karsilastir("BİRİM", r[ix["BİRİM"]], s.Birim, alanFark, ref ayni);
                Karsilastir("HAK. NO", r[ix["HAK. NO"]], s.Hakedis.ToString(CultureInfo.InvariantCulture), alanFark, ref ayni);
                Karsilastir("BÖL.TARİFE", r[ix["BÖL.TARİFE"]], s.BolgeTarife, alanFark, ref ayni);
                Karsilastir("DM DRM", r[ix["DM DRM"]], s.DmDurum, alanFark, ref ayni);
                Karsilastir("KONTROL", r[ix["KONTROL"]], s.Kontrol, alanFark, ref ayni);
                SayiKarsilastir("MİKTAR", r[ix["MİKTAR"]], s.Miktar, alanFark, ref ayni);
                SayiKarsilastir("METRİK A.", r[ix["METRİK A."]], s.Katsayi, alanFark, ref ayni);
                SayiKarsilastir("TOP. MİK.", r[ix["TOP. MİK."]], s.Toplam, alanFark, ref ayni);
                if (ayni) tamAyni++;
            }
            int fazla = 0;
            foreach (var l in bizim.Values) fazla += l.Count;
            Console.WriteLine($"Eşleşen satır: {eslesen}/{refSatirlar.Count} · tüm alanları aynı: {tamAyni} · raporda olup bizde olmayan: {bulunamayan} · bizde fazla: {fazla}");
            foreach (var kv in alanFark) Console.WriteLine($"  alan farkı {kv.Key}: {kv.Value}");
            foreach (var o in ornekler) Console.WriteLine("  " + o);

            // Özet toplamları (PROJE × HAK × DURUM × CİNS × TİP × BİRİM)
            var refOzet = new Dictionary<string, double[]>();
            foreach (var r in refSatirlar)
            {
                string k = r[ix["PROJE"]] + "|" + r[ix["HAK. NO"]] + "|" + r[ix["DURUM"]] + "|" + r[ix["CİNS"]] + "|" + r[ix["TİP"]] + "|" + r[ix["BİRİM"]];
                double[] t; if (!refOzet.TryGetValue(k, out t)) refOzet[k] = t = new double[2];
                t[0] += Ondalik(r[ix["MİKTAR"]]); t[1] += Ondalik(r[ix["TOP. MİK."]]);
            }
            int grupAyni = 0, grupFarkli = 0;
            foreach (var o in dt.Ozet())
            {
                string k = o.Proje + "|" + o.Hakedis + "|" + o.Durum + "|" + o.Cins + "|" + o.Tip + "|" + o.Birim;
                double[] t;
                if (refOzet.TryGetValue(k, out t) && Math.Abs(t[0] - o.Miktar) < 1e-3 && Math.Abs(t[1] - o.Toplam) < 1e-3) grupAyni++;
                else grupFarkli++;
            }
            Console.WriteLine($"Özet grupları: {grupAyni} aynı, {grupFarkli} farklı (PROMAGIS'te {refOzet.Count} grup)");

            // Toplam kg ve metre karşılaştırması
            double refKg = 0, bizKg = 0;
            foreach (var r in refSatirlar) if (r[ix["BİRİM"]].EndsWith("/kg", StringComparison.Ordinal)) refKg += Ondalik(r[ix["TOP. MİK."]]);
            foreach (var s in dt.Satirlar) if (s.Birim.EndsWith("/kg", StringComparison.Ordinal)) bizKg += s.Toplam;
            Console.WriteLine($"Toplam kg: PROMAGIS {refKg:N1} · bizim {bizKg:N1} · fark %{(bizKg - refKg) / refKg * 100:N3}");

            sure.Restart();
            string xlsx = Path.Combine(ciktiKlasoru, "durum-tespit.xlsx");
            RaporYazici.Yaz(p2, xlsx, "test");
            Console.WriteLine($"Excel: {xlsx} ({new FileInfo(xlsx).Length / 1024} KB, {sure.ElapsedMilliseconds} ms)");
            Esit(true, eslesen >= refSatirlar.Count * 0.999, "PROMAGIS satırlarının %99,9'u eşleşti");
        }

        private static void Karsilastir(string ad, string beklenen, string gercek, Dictionary<string, int> fark, ref bool ayni)
        {
            if ((beklenen ?? "") == (gercek ?? "")) return;
            if (ad == "DM DRM" && string.IsNullOrEmpty(beklenen) && string.IsNullOrEmpty(gercek)) return;
            int c; fark.TryGetValue(ad, out c); fark[ad] = c + 1;
            ayni = false;
        }

        private static void SayiKarsilastir(string ad, string beklenen, double gercek, Dictionary<string, int> fark, ref bool ayni)
        {
            if (Math.Abs(Ondalik(beklenen) - gercek) < 1e-6) return;
            int c; fark.TryGetValue(ad, out c); fark[ad] = c + 1;
            ayni = false;
        }

        private static double Ondalik(string s)
        {
            double d;
            return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out d) ? d : 0;
        }
    }
}
