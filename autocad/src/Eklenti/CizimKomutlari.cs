using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
using WinForms = System.Windows.Forms;

[assembly: CommandClass(typeof(SebekeHakedis.Eklenti.CizimKomutlari))]

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Çizim araçları: eleman, hat, kanal, sondaj, bölge, nokta alma, malzeme düzenleme, metraj,
    /// ayarlar ve telefondan proje alma. Hepsi PROMAGIS biçiminde yazar; PROMAGIS çizimleriyle karışık kullanılabilir.
    /// </summary>
    public sealed class CizimKomutlari
    {
        private static readonly CultureInfo Tr = new CultureInfo("tr-TR");

        // ================= Nokta girişi =================

        private enum Giris { Nokta, Kelime, Bitti, Iptal }

        /// <summary>Kullanıcıdan nokta ister. Dönen nokta dünya koordinatındadır (UCS'den çevrilir).</summary>
        private static Giris NoktaIste(Editor ed, string mesaj, string kelimeler, Point3d? tabanWcs, out Point3d wcs, out string kelime)
        {
            wcs = Point3d.Origin;
            kelime = null;
            var ppo = string.IsNullOrEmpty(kelimeler) ? new PromptPointOptions(mesaj) : new PromptPointOptions(mesaj, kelimeler);
            ppo.AllowNone = true;
            if (tabanWcs.HasValue)
            {
                ppo.UseBasePoint = true;
                ppo.BasePoint = tabanWcs.Value.TransformBy(ed.CurrentUserCoordinateSystem.Inverse());
            }
            var r = ed.GetPoint(ppo);
            switch (r.Status)
            {
                case PromptStatus.OK:
                    wcs = r.Value.TransformBy(ed.CurrentUserCoordinateSystem);
                    return Giris.Nokta;
                case PromptStatus.Keyword:
                    kelime = r.StringResult;
                    return Giris.Kelime;
                case PromptStatus.None:
                    return Giris.Bitti;
                default:
                    return Giris.Iptal;
            }
        }

        private static string Ad(Eleman e) => (string.IsNullOrEmpty(e.GisId) ? "" : e.GisId + " ") + Turler.ElemanAdi(e.Tur);

        /// <summary>Noktayı yakındaki elemanın yerine oturtur (yakalama mesafesi ayardan).</summary>
        private static Eleman Yakala(Ortam o, ref Point3d p)
        {
            var e = o.YakinEleman(p, o.Ayar.YakalamaMesafesi);
            p = e != null ? new Point3d(e.Saga, e.Yukari, 0) : new Point3d(p.X, p.Y, 0);
            return e;
        }

        private static double Uzunluk(IList<Point3d> l)
        {
            double t = 0;
            for (int i = 1; i < l.Count; i++) t += new Point2d(l[i - 1].X, l[i - 1].Y).GetDistanceTo(new Point2d(l[i].X, l[i].Y));
            return t;
        }

        /// <summary>
        /// Çoklu çizgi köşelerini sırayla ister; çizilirken çizgi ekranda görünür. sonuc: "tamam", "ayarlar",
        /// "bitir" (ilk noktada Enter), "yeniden" (ilk noktada Geri), "iptal" (Esc).
        /// </summary>
        private static List<Point3d> KoseleriIste(Ortam o, string katman, bool kapali, int enAz, Point3d? ilk,
            string ilkMesaj, string ilkKelimeler, List<Eleman> uclar, out string sonuc, bool yakala = true)
        {
            var ed = o.Ed;
            Point3d p;
            string k;
            if (ilk.HasValue) p = ilk.Value;
            else
            {
                var g0 = NoktaIste(ed, ilkMesaj, ilkKelimeler, null, out p, out k);
                if (g0 == Giris.Kelime) { sonuc = k == "Ayarlar" ? "ayarlar" : "bitir"; return null; }
                if (g0 != Giris.Nokta) { sonuc = g0 == Giris.Iptal ? "iptal" : "bitir"; return null; }
            }
            var ilkEleman = yakala ? Yakala(o, ref p) : null;
            var noktalar = new List<Point3d> { p };
            var elemanlar = new List<Eleman> { ilkEleman };
            if (ilkEleman != null) ed.WriteMessage("  → " + Ad(ilkEleman));
            using (var canli = new CanliCizgi(o.Belge, katman, kapali))
            {
                while (true)
                {
                    bool yeter = noktalar.Count >= enAz;
                    string mesaj = yeter ? "\nSonraki nokta [Geri/Bitir] <Bitir>: " : "\nSonraki nokta [Geri]: ";
                    var g = NoktaIste(ed, mesaj, yeter ? "Geri Bitir" : "Geri", noktalar[noktalar.Count - 1], out p, out k);
                    if (g == Giris.Iptal) { sonuc = "iptal"; return null; }
                    if (g == Giris.Kelime && k == "Geri")
                    {
                        if (noktalar.Count <= 1) { sonuc = "yeniden"; return null; }
                        noktalar.RemoveAt(noktalar.Count - 1);
                        elemanlar.RemoveAt(elemanlar.Count - 1);
                        canli.Ayarla(noktalar);
                        continue;
                    }
                    if (g == Giris.Kelime || g == Giris.Bitti)
                    {
                        if (yeter) break;
                        ed.WriteMessage("\nEn az " + enAz + " nokta gerekir (vazgeçmek için Esc).");
                        continue;
                    }
                    var el = yakala ? Yakala(o, ref p) : null;
                    if (!yakala) p = new Point3d(p.X, p.Y, 0);
                    if (p.DistanceTo(noktalar[noktalar.Count - 1]) < 1e-6) continue;
                    noktalar.Add(p);
                    elemanlar.Add(el);
                    if (el != null) ed.WriteMessage("  → " + Ad(el));
                    canli.Ayarla(noktalar);
                }
            }
            uclar.Clear();
            uclar.AddRange(elemanlar);
            sonuc = "tamam";
            return noktalar;
        }

        private sealed class HatParcasi
        {
            public readonly List<Point3d> Noktalar = new List<Point3d>();
            public Eleman Bas, Bit;
        }

        /// <summary>
        /// Tıklanan noktaları bağlantı düğümlerinden (eleman yakalanan noktalar) parçalara böler: her parça bir elemanda
        /// başlar, sıradaki elemanda biter; elemansız ara köşeler parçanın içinde kalır. Son nokta elemansızsa parça orada biter.
        /// </summary>
        private static List<HatParcasi> HatParcalari(List<Point3d> noktalar, List<Eleman> elemanlar)
        {
            var parcalar = new List<HatParcasi>();
            var pc = new HatParcasi { Bas = elemanlar.Count > 0 ? elemanlar[0] : null };
            pc.Noktalar.Add(noktalar[0]);
            for (int i = 1; i < noktalar.Count; i++)
            {
                pc.Noktalar.Add(noktalar[i]);
                var el = i < elemanlar.Count ? elemanlar[i] : null;
                bool son = i == noktalar.Count - 1;
                if (el != null || son)
                {
                    pc.Bit = el;
                    parcalar.Add(pc);
                    if (!son) { pc = new HatParcasi { Bas = el }; pc.Noktalar.Add(noktalar[i]); }
                }
            }
            return parcalar;
        }

        private static void UyarilariYaz(Editor ed, CizimYazici y)
        {
            int n = 0;
            foreach (var u in y.Uyarilar) if (n++ < 10) ed.WriteMessage("\nUyarı: " + u);
            if (y.Uyarilar.Count > 10) ed.WriteMessage("\n… ve " + (y.Uyarilar.Count - 10) + " uyarı daha.");
        }

        private static CizimYazici Yazici(Ortam o, Transaction tr) =>
            new CizimYazici(o.Db, tr) { EtiketYuksekligi = o.Ayar.EtiketYuksekligi };

        // ================= SH_ELEMAN =================

        [CommandMethod("SH_ELEMAN", CommandFlags.Modal)]
        public void ElemanKoy()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Eleman koyma", () =>
            {
                var o = Ortam.Hazirla(belge);
                var secim = Pencereler.Eleman(o, null);
                if (secim == null) return;
                o.AyarKaydet();
                var ed = o.Ed;
                string ilkGis = secim.Gis;
                ObjectId sonId = ObjectId.Null;
                Eleman son = null;
                int sayi = 0;
                ed.WriteMessage("\nEleman: " + secim);
                while (true)
                {
                    Point3d p;
                    string k;
                    var g = NoktaIste(ed, "\nElemanın yerini gösterin [Ayarlar/Geri/Bitir] <Bitir>: ", "Ayarlar Geri Bitir", null, out p, out k);
                    if (g == Giris.Kelime && k == "Ayarlar")
                    {
                        var s2 = Pencereler.Eleman(o, secim);
                        if (s2 != null) { secim = s2; ilkGis = s2.Gis; o.AyarKaydet(); ed.WriteMessage("\nEleman: " + secim); }
                        continue;
                    }
                    if (g == Giris.Kelime && k == "Geri")
                    {
                        if (son == null) { ed.WriteMessage("\nGeri alınacak eleman yok."); continue; }
                        using (var tr = o.Db.TransactionManager.StartTransaction())
                        {
                            Yazici(o, tr).Sil(sonId);
                            tr.Commit();
                        }
                        o.Proje.Elemanlar.Remove(son);
                        ed.WriteMessage("\n" + Ad(son) + " kaldırıldı.");
                        son = null;
                        sonId = ObjectId.Null;
                        sayi--;
                        continue;
                    }
                    if (g != Giris.Nokta) break;

                    string gis = !string.IsNullOrEmpty(ilkGis) ? ilkGis : Numara.SonrakiGis(o.Proje.Elemanlar, secim.Tur, o.GisOnEki, secim.Tip.Cins);
                    ilkGis = null;
                    var e = new Eleman
                    {
                        Tur = secim.Tur, GisId = gis, Cins = secim.Tip.Cins, Tip = secim.Tip.Tanim, Durum = secim.Durum, DmDurum = secim.DmDurum,
                        Hakedis = secim.Hakedis, Saga = p.X, Yukari = p.Y, Kot = p.Z,
                    };
                    e.Kalemler.Add(Katalog.KalemYap(secim.Tip, 1, secim.Durum, secim.Hakedis, true, "NIT", o.YeniSira(), secim.DmDurum, o.Ayar.Karakteristik, o.Ayar.Koy));
                    using (var tr = o.Db.TransactionManager.StartTransaction())
                    {
                        var y = Yazici(o, tr);
                        string blok = y.KullanilabilirBlok(PromagisYazici.BlokSec(o.Proje.Elemanlar, e), e.Tur, e.Cins, e.Durum, o.Proje.Elemanlar);
                        var v = PromagisYazici.Eleman(e, o.OnEk, blok, null);
                        sonId = y.Ekle(v, null, o.Olcek(blok));
                        e.Id = v.H;
                        e.Blok = blok;
                        e.Katman = v.Katman;
                        tr.Commit();
                        UyarilariYaz(ed, y);
                    }
                    o.Proje.Elemanlar.Add(e);
                    son = e;
                    sayi++;
                    ed.WriteMessage("\n" + Ad(e) + " konuldu.");
                }
                if (sayi > 0) ed.WriteMessage("\n" + sayi + " eleman konuldu.");
            });
        }

        // ================= SH_HAT =================

        [CommandMethod("SH_HAT", CommandFlags.Modal)]
        public void HatCiz()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Hat çizme", () =>
            {
                var o = Ortam.Hazirla(belge);
                var secim = Pencereler.Hat(o, null);
                if (secim == null) return;
                o.AyarKaydet();
                var ed = o.Ed;
                int sayi = 0;
                ed.WriteMessage("\nHat: " + secim);
                while (true)
                {
                    string katman = PromagisYazici.HatKatmani(o.OnEk, secim.Tur, secim.Durum, secim.Hakedis);
                    var uclar = new List<Eleman>();
                    string sonuc;
                    var noktalar = KoseleriIste(o, katman, false, 2, null, "\nHattın başlangıcı — direğe tıklayın [Ayarlar/Bitir] <Bitir>: ", "Ayarlar Bitir", uclar, out sonuc);
                    if (sonuc == "ayarlar")
                    {
                        var s2 = Pencereler.Hat(o, secim);
                        if (s2 != null) { secim = s2; o.AyarKaydet(); ed.WriteMessage("\nHat: " + secim); }
                        continue;
                    }
                    if (sonuc == "yeniden") continue;
                    if (noktalar == null) break;

                    // Parçalı hat (node-to-node): hat her direkte / SDK'da biter ve yeniden başlar; her parça ayrı nesne,
                    // metrajı ve etiketi kendine ait. Direksiz köşe noktaları parçanın içinde kalır.
                    var parcalar = HatParcalari(noktalar, uclar);
                    int parcaNo = 0;
                    using (var tr = o.Db.TransactionManager.StartTransaction())
                    {
                        var y = Yazici(o, tr);
                        foreach (var pc in parcalar)
                        {
                            parcaNo++;
                            double L = Uzunluk(pc.Noktalar);
                            double m = o.Ayar.HatMetraji(L, secim.Tur);
                            var h = new Hat { Tur = secim.Tur, AnaKesit = secim.Kesit.Tanim, Durum = secim.Durum, Hakedis = secim.Hakedis };
                            foreach (var q in pc.Noktalar) h.Kose.Add(new[] { q.X, q.Y });
                            h.CizimUzunlugu = L;
                            h.Kalemler.Add(Katalog.KalemYap(secim.Kesit, m, secim.Durum, secim.Hakedis, false, "HAT", o.YeniSira(), "", o.Ayar.Karakteristik, o.Ayar.Koy));
                            var v = PromagisYazici.Hat(h, o.OnEk, null);
                            string etiket = PromagisYazici.HatEtiketi(h);
                            y.Ekle(v, etiket, 1);
                            h.Id = v.H;
                            h.Katman = v.Katman;
                            o.Proje.Hatlar.Add(h);
                            sayi++;
                            ed.WriteMessage("\nParça " + parcaNo + "/" + parcalar.Count + (pc.Bas != null ? "  " + Ad(pc.Bas) : "") + (pc.Bit != null ? " → " + Ad(pc.Bit) : "") +
                                ":  çizim " + L.ToString("0.00", Tr) + " m, metraj " + Metraj.Yazi(m) + " m  (" + etiket.Replace(PromagisYazici.Tanitici, v.H) + ")");
                        }
                        tr.Commit();
                        UyarilariYaz(ed, y);
                    }
                    ed.WriteMessage("\n" + parcalar.Count + " parça çizildi. Metrajı değiştirmek için: Malzeme (SH_MALZEME) ya da Metraj (SH_METRAJ).");
                }
                if (sayi > 0) ed.WriteMessage("\nToplam " + sayi + " hat parçası çizildi.");
            });
        }

        // ================= SH_KANAL =================

        [CommandMethod("SH_KANAL", CommandFlags.Modal)]
        public void KanalCiz()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Kanal çizme", () =>
            {
                var o = Ortam.Hazirla(belge);
                var secim = Pencereler.Kanal(o, null);
                if (secim == null) return;
                o.AyarKaydet();
                var ed = o.Ed;
                int sayi = 0;
                ed.WriteMessage("\n" + secim);
                while (true)
                {
                    var uclar = new List<Eleman>();
                    string sonuc;
                    var noktalar = KoseleriIste(o, o.OnEk + "_KABLO_KANALI", false, 2, null, "\nKanalın başlangıcı [Ayarlar/Bitir] <Bitir>: ", "Ayarlar Bitir", uclar, out sonuc);
                    if (sonuc == "ayarlar")
                    {
                        var s2 = Pencereler.Kanal(o, secim);
                        if (s2 != null) { secim = s2; o.AyarKaydet(); ed.WriteMessage("\n" + secim); }
                        continue;
                    }
                    if (sonuc == "yeniden") continue;
                    if (noktalar == null) break;

                    // Kanal da bağlantı düğümlerinde (box, pano, direk) parçalanır; her parçanın baş / bit numarası ve metrajı kendine ait
                    var parcalar = HatParcalari(noktalar, uclar);
                    // Kanalın tarifesi katalogdaki zemin kaleminden (KABLO_KANALI), zemin katalogda yoksa 0104
                    var zeminKalemi = o.Katalog.KanalZeminleri().Find(z => KatalogKalemi.Sade(z.Tanim) == KatalogKalemi.Sade(secim.Zemin));
                    string tarife = zeminKalemi != null ? o.Ayar.Tarife(zeminKalemi) : Katalog.TarifeSec(new KatalogKalemi { Tarife = "0104", UnsurKoy = "16" }, o.Ayar.Karakteristik, o.Ayar.Koy);
                    int parcaNo = 0;
                    using (var tr = o.Db.TransactionManager.StartTransaction())
                    {
                        var y = Yazici(o, tr);
                        foreach (var pc in parcalar)
                        {
                            parcaNo++;
                            double L = Uzunluk(pc.Noktalar);
                            double m = Metraj.Kanal(L);
                            var c = new Kanal
                            {
                                Kod = secim.Kod, Zemin = secim.Zemin, AltGenislik = secim.Alt, UstGenislik = secim.Ust, Derinlik = secim.Derinlik,
                                Durum = secim.Durum, Hakedis = secim.Hakedis,
                                BasNo = pc.Bas != null ? pc.Bas.GisId : "", BitNo = pc.Bit != null ? pc.Bit.GisId : "",
                            };
                            foreach (var q in pc.Noktalar) c.Kose.Add(new[] { q.X, q.Y });
                            c.CizimUzunlugu = L;
                            var kl = new Kalem
                            {
                                Cins = c.Kod.ToString(CultureInfo.InvariantCulture), Tanim = c.Zemin, Durum = c.Durum, Miktar = m, Birim = "mt/m³",
                                Katsayi = 1, Hakedis = c.Hakedis, Tarife = tarife, Sira = o.YeniSira(), Ana = true, Kaynak = "NIT",
                            };
                            Metraj.Toplam(kl, c);
                            c.Kalemler.Add(kl);
                            var v = PromagisYazici.Kanal(c, o.OnEk, null);
                            y.Ekle(v, null, 1);
                            c.Id = v.H;
                            o.Proje.Kanallar.Add(c);
                            sayi++;
                            ed.WriteMessage("\nKanal parçası " + parcaNo + "/" + parcalar.Count + (pc.Bas != null ? "  " + Ad(pc.Bas) : "") + (pc.Bit != null ? " → " + Ad(pc.Bit) : "") +
                                ":  çizim " + L.ToString("0.00", Tr) + " m, metraj " + Metraj.Yazi(m) + " m, " + kl.Toplam.ToString("0.##", Tr) + " m³");
                        }
                        tr.Commit();
                        UyarilariYaz(ed, y);
                    }
                    ed.WriteMessage("\n" + parcalar.Count + " kanal parçası çizildi. Metrajı değiştirmek için: Malzeme (SH_MALZEME).");
                }
                if (sayi > 0) ed.WriteMessage("\nToplam " + sayi + " kanal parçası çizildi.");
            });
        }

        // ================= SH_SONDAJ =================

        [CommandMethod("SH_SONDAJ", CommandFlags.Modal)]
        public void SondajCiz()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Sondaj çizme", () =>
            {
                var o = Ortam.Hazirla(belge);
                var secim = Pencereler.Sondaj(o, null);
                if (secim == null) return;
                o.AyarKaydet();
                var ed = o.Ed;
                int sayi = 0;
                ed.WriteMessage("\n" + secim);
                while (true)
                {
                    var uclar = new List<Eleman>();
                    string sonuc;
                    var noktalar = KoseleriIste(o, o.OnEk + "_YATAY_SONDAJ", false, 2, null, "\nSondajın başlangıcı [Ayarlar/Bitir] <Bitir>: ", "Ayarlar Bitir", uclar, out sonuc);
                    if (sonuc == "ayarlar")
                    {
                        var s2 = Pencereler.Sondaj(o, secim);
                        if (s2 != null) { secim = s2; o.AyarKaydet(); ed.WriteMessage("\n" + secim); }
                        continue;
                    }
                    if (sonuc == "yeniden") continue;
                    if (noktalar == null) break;

                    var parcalar = HatParcalari(noktalar, uclar);
                    int parcaNo = 0;
                    using (var tr = o.Db.TransactionManager.StartTransaction())
                    {
                        var y = Yazici(o, tr);
                        foreach (var pc in parcalar)
                        {
                            parcaNo++;
                            double L = Uzunluk(pc.Noktalar);
                            double m = Metraj.Kanal(L);
                            var s = new Sondaj
                            {
                                Tip = secim.Tip.Tanim, Durum = secim.Durum, Hakedis = secim.Hakedis,
                                BasNo = pc.Bas != null ? pc.Bas.GisId : "", BitNo = pc.Bit != null ? pc.Bit.GisId : "",
                            };
                            foreach (var q in pc.Noktalar) s.Kose.Add(new[] { q.X, q.Y });
                            s.CizimUzunlugu = L;
                            s.Kalemler.Add(Katalog.KalemYap(secim.Tip, m, secim.Durum, secim.Hakedis, true, "NIT", o.YeniSira(), "", o.Ayar.Karakteristik, o.Ayar.Koy));
                            var v = PromagisYazici.Sondaj(s, o.OnEk, null);
                            y.Ekle(v, null, 1);
                            s.Id = v.H;
                            o.Proje.Sondajlar.Add(s);
                            sayi++;
                            ed.WriteMessage("\nSondaj parçası " + parcaNo + "/" + parcalar.Count + (pc.Bas != null ? "  " + Ad(pc.Bas) : "") + (pc.Bit != null ? " → " + Ad(pc.Bit) : "") +
                                ":  " + secim.Tip.Tanim.Trim() + ", çizim " + L.ToString("0.00", Tr) + " m, metraj " + Metraj.Yazi(m) + " m");
                        }
                        tr.Commit();
                        UyarilariYaz(ed, y);
                    }
                }
                if (sayi > 0) ed.WriteMessage("\nToplam " + sayi + " sondaj parçası çizildi.");
            });
        }

        // ================= SH_BOLGE =================

        [CommandMethod("SH_BOLGE", CommandFlags.Modal)]
        public void BolgeCiz()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Bölge çizme", () =>
            {
                var o = Ortam.Hazirla(belge);
                var ed = o.Ed;
                Point3d p;
                string k;
                var g = NoktaIste(ed, "\nBölge sınırının ilk köşesi ya da var olan kapalı çizgiyi seçmek için [Nesne]: ", "Nesne", null, out p, out k);
                var sinir = new List<double[]>();
                ObjectId mevcut = ObjectId.Null;
                if (g == Giris.Kelime && k == "Nesne")
                {
                    var peo = new PromptEntityOptions("\nBölge sınırı olacak kapalı çoklu çizgiyi seçin: ");
                    peo.SetRejectMessage("\nÇoklu çizgi (polyline) seçin.");
                    peo.AddAllowedClass(typeof(Polyline), true);
                    peo.AddAllowedClass(typeof(Polyline2d), true);
                    var r = ed.GetEntity(peo);
                    if (r.Status != PromptStatus.OK) return;
                    using (var tr = o.Db.TransactionManager.StartTransaction())
                    {
                        var ent = (Entity)tr.GetObject(r.ObjectId, OpenMode.ForRead);
                        var xd = Toplayici.XdataOku(ent);
                        if (xd.ContainsKey("HAT") || xd.ContainsKey("NIT"))
                        {
                            Pencereler.Uyar("Seçilen çizgi bir hat, kanal ya da sondaj. Bölge sınırı için ayrı bir çizgi seçin ya da çizin.");
                            return;
                        }
                        var v = Toplayici.Cevir(ent, tr);
                        if (v != null) foreach (var q in v.Kose) sinir.Add(new[] { q[0], q[1] });
                        tr.Commit();
                    }
                    mevcut = r.ObjectId;
                }
                else if (g == Giris.Nokta)
                {
                    var uclar = new List<Eleman>();
                    string sonuc;
                    var noktalar = KoseleriIste(o, o.OnEk + "_PROJE", true, 3, new Point3d(p.X, p.Y, 0), null, null, uclar, out sonuc, false);
                    if (noktalar == null) return;
                    foreach (var q in noktalar) sinir.Add(new[] { q.X, q.Y });
                }
                else return;

                if (sinir.Count < 3) { Pencereler.Uyar("Bölge sınırı için en az üç köşe gerekir."); return; }
                string ad = "", kod = "";
                if (!Pencereler.Bolge(ref ad, ref kod)) return;
                var b = new Bolge { Ad = ad, Kod = kod, Sinir = sinir };
                var vb = PromagisYazici.Bolge(b, o.OnEk, null);
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var y = Yazici(o, tr);
                    if (mevcut.IsNull) y.Ekle(vb, null, 1);
                    else y.Guncelle(mevcut, vb, null);
                    tr.Commit();
                    UyarilariYaz(ed, y);
                }
                ed.WriteMessage("\nBölge kaydedildi: " + (string.IsNullOrEmpty(kod) ? ad : kod + " " + ad) + " (" + Geometri.Alan(sinir).ToString("N0", Tr) + " m²).");
            });
        }

        // ================= SH_NOKTAAL =================

        [CommandMethod("SH_NOKTAAL", CommandFlags.Modal)]
        public void NoktaAl()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Nokta alma", () =>
            {
                string yol;
                using (var dlg = new WinForms.OpenFileDialog
                {
                    Title = "Ölçü noktası dosyasını seçin (telefonun Noktalar CSV çıktısı ya da Ad, Y, X, Z, Kod dosyası)",
                    Filter = "Nokta dosyaları (*.csv;*.txt;*.ncn)|*.csv;*.txt;*.ncn|Tüm dosyalar (*.*)|*.*",
                    InitialDirectory = Komutlar.Klasor(belge),
                })
                {
                    if (dlg.ShowDialog() != WinForms.DialogResult.OK) return;
                    yol = dlg.FileName;
                }
                var o = Ortam.Hazirla(belge);
                var uyarilar = new List<string>();
                var noktalar = NoktaDosyasi.Oku(NoktaDosyasi.MetinCoz(File.ReadAllBytes(yol)), o.Hakedis, uyarilar);
                var yeni = new List<Nokta>();
                int ayni = 0;
                foreach (var n in noktalar)
                {
                    bool mevcutMu = o.Proje.Noktalar.Exists(x => x.Ad == n.Ad && Math.Abs(x.Saga - n.Saga) < 0.01 && Math.Abs(x.Yukari - n.Yukari) < 0.01);
                    if (mevcutMu) ayni++;
                    else yeni.Add(n);
                }
                var sb = new StringBuilder();
                sb.AppendLine(Path.GetFileName(yol) + ": " + noktalar.Count + " nokta okundu.");
                if (ayni > 0) sb.AppendLine(ayni + " nokta çizimde zaten var, atlanacak.");
                int u = 0;
                foreach (var x in uyarilar) if (u++ < 6) sb.AppendLine("• " + x);
                if (uyarilar.Count > 6) sb.AppendLine("• … ve " + (uyarilar.Count - 6) + " uyarı daha");
                if (yeni.Count == 0) { Pencereler.Bilgi(sb + "\nEklenecek yeni nokta yok."); return; }
                sb.AppendLine();
                sb.Append(yeni.Count + " nokta GPS katmanına " + o.Hakedis + ". hakediş olarak eklensin mi?");
                if (!Pencereler.Onay(sb.ToString())) return;

                bool bosCizim = o.Varliklar.Count == 0;
                var kapsam = new Extents3d();
                bool kapsamVar = false;
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var y = Yazici(o, tr);
                    foreach (var n in yeni)
                    {
                        y.Ekle(PromagisYazici.Nokta(n, null), null, 1);
                        var q = new Point3d(n.Saga, n.Yukari, 0);
                        if (!kapsamVar) { kapsam = new Extents3d(q, q); kapsamVar = true; }
                        else kapsam.AddPoint(q);
                    }
                    tr.Commit();
                    UyarilariYaz(o.Ed, y);
                }
                o.Ed.WriteMessage("\n" + yeni.Count + " GPS noktası eklendi.");
                if (bosCizim && kapsamVar) Yakinlas(o.Ed, kapsam);
            });
        }

        // ================= SH_MALZEME =================

        private static object NesneBul(Proje p, string h)
        {
            object n = p.Elemanlar.Find(x => string.Equals(x.Id, h, StringComparison.OrdinalIgnoreCase));
            if (n != null) return n;
            n = p.Hatlar.Find(x => string.Equals(x.Id, h, StringComparison.OrdinalIgnoreCase));
            if (n != null) return n;
            n = p.Kanallar.Find(x => string.Equals(x.Id, h, StringComparison.OrdinalIgnoreCase));
            if (n != null) return n;
            return p.Sondajlar.Find(x => string.Equals(x.Id, h, StringComparison.OrdinalIgnoreCase));
        }

        private static string DurumGrubu(string d) => d == "MEVCUT" ? "MEVCUT" : d == "DM" ? "DM" : "YENI";

        /// <summary>Modeldeki nesneyi çizimdeki karşılığına yazar (katman hakediş/durum değiştiyse yeniden hesaplanır).</summary>
        private static void NesneyiYaz(Ortam o, CizimYazici y, ObjectId id, object nesne, string eskiDurum, int eskiHakedis)
        {
            CadVarlik v;
            string etiket = null;
            if (nesne is Eleman e)
            {
                if (e.Hakedis != eskiHakedis || DurumGrubu(e.Durum) != DurumGrubu(eskiDurum)) e.Katman = "";
                string blok = PromagisYazici.BlokSec(o.Proje.Elemanlar, e);
                if (!y.BlokKullanilabilir(blok)) blok = e.Blok;
                v = PromagisYazici.Eleman(e, o.OnEk, blok, null);
            }
            else if (nesne is Hat h)
            {
                if (h.Hakedis != eskiHakedis || DurumGrubu(h.Durum) != DurumGrubu(eskiDurum)) h.Katman = "";
                v = PromagisYazici.Hat(h, o.OnEk, null);
                etiket = PromagisYazici.HatEtiketi(h);
            }
            else if (nesne is Kanal c) v = PromagisYazici.Kanal(c, o.OnEk, null);
            else if (nesne is Sondaj s) v = PromagisYazici.Sondaj(s, o.OnEk, null);
            else return;
            y.Guncelle(id, v, etiket);
        }

        private static void DurumVeHakedis(object nesne, out string durum, out int hakedis)
        {
            durum = ""; hakedis = 0;
            if (nesne is Eleman e) { durum = e.Durum; hakedis = e.Hakedis; }
            else if (nesne is Hat h) { durum = h.Durum; hakedis = h.Hakedis; }
            else if (nesne is Kanal c) { durum = c.Durum; hakedis = c.Hakedis; }
            else if (nesne is Sondaj s) { durum = s.Durum; hakedis = s.Hakedis; }
        }

        [CommandMethod("SH_MALZEME", CommandFlags.Modal)]
        public void MalzemeDuzenle()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Malzeme düzenleme", () =>
            {
                var o = Ortam.Hazirla(belge);
                var ed = o.Ed;
                var peo = new PromptEntityOptions("\nMalzemesini düzenleyeceğiniz direği, hattı, kanalı ya da sondajı seçin: ");
                peo.SetRejectMessage("\nBir blok ya da çoklu çizgi seçin.");
                peo.AddAllowedClass(typeof(BlockReference), true);
                peo.AddAllowedClass(typeof(Polyline), true);
                peo.AddAllowedClass(typeof(Polyline2d), true);
                peo.AddAllowedClass(typeof(Polyline3d), true);
                var r = ed.GetEntity(peo);
                if (r.Status != PromptStatus.OK) return;
                string h = r.ObjectId.Handle.ToString();
                var nesne = NesneBul(o.Proje, h);
                if (nesne == null)
                {
                    ed.WriteMessage("\nBu nesnede şebeke bilgisi yok (PROMAGIS ya da Şebeke Hakediş nesnesi değil).");
                    return;
                }
                string eskiDurum;
                int eskiHakedis;
                DurumVeHakedis(nesne, out eskiDurum, out eskiHakedis);
                if (!Pencereler.Kalemler(o, nesne)) return;
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var y = Yazici(o, tr);
                    NesneyiYaz(o, y, r.ObjectId, nesne, eskiDurum, eskiHakedis);
                    tr.Commit();
                    UyarilariYaz(ed, y);
                }
                ed.WriteMessage("\nMalzemeler kaydedildi.");
            });
        }

        // ================= SH_METRAJ =================

        [CommandMethod("SH_METRAJ", CommandFlags.Modal)]
        public void MetrajGuncelle()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Metraj güncelleme", () =>
            {
                var o = Ortam.Hazirla(belge);
                var ed = o.Ed;
                var pso = new PromptSelectionOptions { MessageForAdding = "\nMetrajı çizim uzunluğundan yeniden hesaplanacak hatları, kanalları ve sondajları seçin: " };
                var filtre = new SelectionFilter(new[] { new TypedValue((int)DxfCode.Start, "LWPOLYLINE,POLYLINE") });
                var r = ed.GetSelection(pso, filtre);
                if (r.Status != PromptStatus.OK) return;

                var degisen = new List<KeyValuePair<ObjectId, object>>();
                var eskiler = new Dictionary<ObjectId, string>();
                var satirlar = new List<string>();
                foreach (ObjectId id in r.Value.GetObjectIds())
                {
                    var nesne = NesneBul(o.Proje, id.Handle.ToString());
                    if (nesne is Hat h)
                    {
                        var kl = h.Kalemler.Find(x => x.Kaynak == "HAT");
                        if (kl == null) continue;
                        double yeni = o.Ayar.HatMetraji(h.CizimUzunlugu, h.Tur);
                        if (Math.Abs(kl.Miktar - yeni) < 1e-6) continue;
                        satirlar.Add("Hat " + h.AnaKesit + ": " + Metraj.Yazi(kl.Miktar) + " → " + Metraj.Yazi(yeni) + " m");
                        kl.Miktar = yeni;
                        Metraj.Toplam(kl);
                        degisen.Add(new KeyValuePair<ObjectId, object>(id, h));
                    }
                    else if (nesne is Kanal c)
                    {
                        var kl = c.Kalemler.Find(x => x.Ana);
                        if (kl == null) continue;
                        double yeni = Metraj.Kanal(c.CizimUzunlugu);
                        if (Math.Abs(kl.Miktar - yeni) < 1e-6) continue;
                        satirlar.Add("Kanal " + c.Kablolar + ": " + Metraj.Yazi(kl.Miktar) + " → " + Metraj.Yazi(yeni) + " m");
                        kl.Miktar = yeni;
                        Metraj.Toplam(kl, c);
                        degisen.Add(new KeyValuePair<ObjectId, object>(id, c));
                    }
                    else if (nesne is Sondaj s)
                    {
                        var kl = s.Kalemler.Find(x => x.Ana);
                        if (kl == null) continue;
                        double yeni = Metraj.Kanal(s.CizimUzunlugu);
                        if (Math.Abs(kl.Miktar - yeni) < 1e-6) continue;
                        satirlar.Add("Sondaj " + s.Tip + ": " + Metraj.Yazi(kl.Miktar) + " → " + Metraj.Yazi(yeni) + " m");
                        kl.Miktar = yeni;
                        Metraj.Toplam(kl);
                        degisen.Add(new KeyValuePair<ObjectId, object>(id, s));
                    }
                }
                if (degisen.Count == 0) { ed.WriteMessage("\nSeçilen nesnelerin metrajı çizim uzunluğuyla zaten uyumlu."); return; }
                var sb = new StringBuilder(degisen.Count + " nesnenin metrajı değişecek:\n");
                for (int i = 0; i < satirlar.Count && i < 15; i++) sb.AppendLine("  • " + satirlar[i]);
                if (satirlar.Count > 15) sb.AppendLine("  … ve " + (satirlar.Count - 15) + " nesne daha");
                sb.AppendLine();
                sb.Append("Değiştirilsin mi?");
                if (!Pencereler.Onay(sb.ToString())) return;
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var y = Yazici(o, tr);
                    foreach (var kv in degisen)
                    {
                        string d;
                        int hk;
                        DurumVeHakedis(kv.Value, out d, out hk);
                        try { NesneyiYaz(o, y, kv.Key, kv.Value, d, hk); }
                        catch (System.Exception ex) { y.Uyarilar.Add(kv.Key.Handle + " güncellenemedi (katmanı kilitli olabilir): " + ex.Message); }
                    }
                    tr.Commit();
                    UyarilariYaz(ed, y);
                }
                ed.WriteMessage("\n" + degisen.Count + " nesnenin metrajı güncellendi.");
            });
        }

        // ================= SH_AYARLAR / SH_HAKEDIS =================

        [CommandMethod("SH_AYARLAR", CommandFlags.Modal)]
        public void Ayarlar()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Ayarlar", () =>
            {
                var o = Ortam.Hazirla(belge);
                if (!Pencereler.Ayarlar(o)) return;
                o.AyarKaydet();
                o.Ed.WriteMessage("\nAyarlar bu çizime kaydedildi.");
            });
        }

        [CommandMethod("SH_HAKEDIS", CommandFlags.Modal)]
        public void Hakedis()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Hakediş seçimi", () =>
            {
                var o = Ortam.Hazirla(belge);
                var pio = new PromptIntegerOptions("\nAktif hakediş numarası")
                {
                    DefaultValue = o.Hakedis,
                    UseDefaultValue = true,
                    LowerLimit = 1,
                    UpperLimit = 999,
                    AllowNone = true,
                };
                var r = o.Ed.GetInteger(pio);
                if (r.Status != PromptStatus.OK) return;
                o.Ayar.AktifHakedis = r.Value;
                o.AyarKaydet();
                o.Ed.WriteMessage("\nAktif hakediş: " + r.Value + ". Yeni çizilen nesneler " + r.Value + ". hakediş katmanlarına konur.");
            });
        }

        // ================= SH_PROJEAL: telefondan proje alma =================

        private static void Kapsa(ref Extents3d kapsam, ref bool kapsamVar, CadVarlik v)
        {
            var noktalar = new List<Point3d>();
            if (v.Tur == "INSERT") noktalar.Add(new Point3d(v.X, v.Y, 0));
            foreach (var k in v.Kose) noktalar.Add(new Point3d(k[0], k[1], 0));
            foreach (var p in noktalar)
            {
                if (!kapsamVar) { kapsam = new Extents3d(p, p); kapsamVar = true; }
                else kapsam.AddPoint(p);
            }
        }

        private static string Ayrinti(AktarimPlani plan, string islem)
        {
            var say = new SortedDictionary<string, int>(StringComparer.Ordinal);
            foreach (var a in plan.Adimlar) if (a.Islem == islem) { int c; say.TryGetValue(a.Nesne, out c); say[a.Nesne] = c + 1; }
            if (say.Count == 0) return "";
            var adlar = new Dictionary<string, string> { { "bolge", "bölge" }, { "nokta", "GPS noktası" }, { "eleman", "eleman" }, { "hat", "hat" }, { "kanal", "kanal" }, { "sondaj", "sondaj" } };
            var parca = new List<string>();
            foreach (var kv in say) parca.Add(kv.Value + " " + (adlar.ContainsKey(kv.Key) ? adlar[kv.Key] : kv.Key));
            return " (" + string.Join(", ", parca) + ")";
        }

        [CommandMethod("SH_PROJEAL", CommandFlags.Modal)]
        public void ProjeAl()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Telefondan proje alma", () =>
            {
                string yol = Komutlar.ProjeDosyasiSec("Telefondan gelen proje dosyasını seçin", Komutlar.Klasor(belge));
                if (yol == null) return;
                var tel = ProjeDosyasi.Oku(Komutlar.ProjeMetniOku(yol));
                var o = Ortam.Hazirla(belge, tel.KatmanOnEki);
                var ed = o.Ed;

                if (o.Ayar.Dom > 0 && tel.Dom > 0 && o.Ayar.Dom != tel.Dom &&
                    !Pencereler.Onay("Dikkat: telefondaki proje " + tel.Dom + "° dilimde, bu çizim " + o.Ayar.Dom + "° dilimde ayarlı.\n" +
                                     "Koordinatlar uyuşmayabilir. Yine de aktarılsın mı?", false))
                    return;

                ed.WriteMessage("\nKarşılaştırılıyor...");
                var plan = Aktarim.Planla(o.Varliklar, tel, o.OnEk);
                int cizimdeSilinmis = 0;
                foreach (var a in plan.Adimlar) if (a.CizimdeSilinmis) cizimdeSilinmis++;
                if (plan.Adimlar.Count == 0 && plan.Silinenler.Count == 0)
                {
                    Pencereler.Bilgi("Telefondaki proje bu çizimle aynı; aktarılacak değişiklik yok.\n(" + plan.Ayni + " nesne karşılaştırıldı.)");
                    return;
                }

                var sb = new StringBuilder();
                sb.AppendLine("Proje: " + tel.Ad + "  (" + Path.GetFileName(yol) + ")");
                bool cizimdeNesneVar = o.Proje.Elemanlar.Count + o.Proje.Hatlar.Count + o.Proje.Bolgeler.Count > 0;
                if (cizimdeNesneVar && plan.TaniticiylaEslesen == 0 && plan.KimlikleEslesen == 0)
                    sb.AppendLine("Bu proje bu çizimden alınmamış görünüyor; telefondaki nesneler yeni olarak eklenecek.");
                sb.AppendLine();
                sb.AppendLine("Yeni eklenecek: " + plan.Sayi("yeni") + Ayrinti(plan, "yeni"));
                sb.AppendLine("Güncellenecek: " + plan.Sayi("guncelle") + Ayrinti(plan, "guncelle"));
                sb.AppendLine("Değişmeyen: " + plan.Ayni);
                if (plan.Silinenler.Count > 0) sb.AppendLine("Telefonda silinmiş görünen: " + plan.Silinenler.Count + " (ayrıca sorulacak)");
                if (cizimdeSilinmis > 0) sb.AppendLine("Bilgisayarda silinmiş, telefonda duran: " + cizimdeSilinmis + " (ayrıca sorulacak)");
                for (int i = 0; i < plan.Uyarilar.Count && i < 8; i++) sb.AppendLine("Uyarı: " + plan.Uyarilar[i]);
                sb.AppendLine();
                sb.Append("Çizime aktarılsın mı?");
                if (!Pencereler.Onay(sb.ToString())) return;

                bool sil = false;
                if (plan.Silinenler.Count > 0)
                {
                    var ls = new StringBuilder("Telefonda silinmiş görünen " + plan.Silinenler.Count + " nesne var:\n");
                    int i = 0;
                    foreach (var kv in plan.Silinenler) if (i++ < 15) ls.AppendLine("  • " + kv.Value);
                    if (plan.Silinenler.Count > 15) ls.AppendLine("  … ve " + (plan.Silinenler.Count - 15) + " nesne daha");
                    ls.AppendLine();
                    ls.Append("Bunlar çizimden de silinsin mi? (Hayır derseniz çizimde kalır.)");
                    sil = Pencereler.Onay(ls.ToString(), false);
                }
                bool yenidenEkle = true;
                if (cizimdeSilinmis > 0)
                    yenidenEkle = Pencereler.Onay(cizimdeSilinmis + " nesne bu çizimden alınmıştı ama çizimde artık yok (bilgisayarda silinmiş olabilir).\n" +
                                                  "Telefondaki hâlleriyle yeniden eklensin mi?", false);

                int eklenen = 0, guncellenen = 0, silinen = 0;
                var kapsam = new Extents3d();
                bool kapsamVar = false;
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var y = Yazici(o, tr);
                    foreach (var a in plan.Adimlar)
                    {
                        var v = a.Varlik;
                        try
                        {
                            if (a.Islem == "yeni")
                            {
                                if (a.CizimdeSilinmis && !yenidenEkle) continue;
                                double olcek = 1;
                                if (a.Nesne == "eleman")
                                {
                                    v.Blok = y.KullanilabilirBlok(v.Blok, a.ElemanTuru, v.OzDeger("CİNS"), v.OzDeger("DURUM"), o.Proje.Elemanlar);
                                    olcek = o.Olcek(v.Blok);
                                }
                                y.Ekle(v, a.Etiket, olcek);
                                eklenen++;
                                Kapsa(ref kapsam, ref kapsamVar, v);
                            }
                            else
                            {
                                ObjectId id;
                                if (!Toplayici.TaniticiylaBul(o.Db, a.Hedef, out id)) { y.Uyarilar.Add("Nesne bulunamadı: " + a.Hedef + " " + a.Ad); continue; }
                                if (a.Nesne == "eleman" && !y.BlokKullanilabilir(v.Blok)) v.Blok = "";
                                y.Guncelle(id, v, a.Etiket);
                                guncellenen++;
                            }
                        }
                        catch (System.Exception ex)
                        {
                            y.Uyarilar.Add(a.Ad + " aktarılamadı (katmanı kilitli olabilir): " + ex.Message);
                        }
                    }
                    if (sil)
                        foreach (var h in plan.Silinenler.Keys)
                        {
                            ObjectId id;
                            if (!Toplayici.TaniticiylaBul(o.Db, h, out id)) continue;
                            try
                            {
                                y.Sil(id);
                                silinen++;
                            }
                            catch (System.Exception ex)
                            {
                                y.Uyarilar.Add(plan.Silinenler[h] + " silinemedi (katmanı kilitli olabilir): " + ex.Message);
                            }
                        }
                    tr.Commit();
                    UyarilariYaz(ed, y);
                }
                if (o.Ayar.Dom == 0 && tel.Dom > 0) { o.Ayar.Dom = tel.Dom; o.AyarKaydet(); }
                ed.WriteMessage("\nTelefondan alındı: " + eklenen + " yeni, " + guncellenen + " güncellendi" + (sil ? ", " + silinen + " silindi" : "") + ".");
                if (!cizimdeNesneVar && kapsamVar) Yakinlas(ed, kapsam);
                Pencereler.Bilgi("Aktarım tamamlandı.\n\nEklenen: " + eklenen + "\nGüncellenen: " + guncellenen + (sil ? "\nSilinen: " + silinen : "") +
                                 "\n\nBeğenmezseniz AutoCAD'in Geri Al (U) komutu aktarımın tamamını geri alır.");
            });
        }

        // ================= Yardımcılar =================

        /// <summary>Görünümü verilen alana yaklaştırır (dünya koordinatı).</summary>
        internal static void Yakinlas(Editor ed, Extents3d ext)
        {
            try
            {
                using (var view = ed.GetCurrentView())
                {
                    var donusum = Matrix3d.PlaneToWorld(view.ViewDirection);
                    donusum = Matrix3d.Displacement(view.Target - Point3d.Origin) * donusum;
                    donusum = Matrix3d.Rotation(-view.ViewTwist, view.ViewDirection, view.Target) * donusum;
                    donusum = donusum.Inverse();
                    ext.TransformBy(donusum);
                    double en = Math.Max(ext.MaxPoint.X - ext.MinPoint.X, 20), boy = Math.Max(ext.MaxPoint.Y - ext.MinPoint.Y, 20);
                    view.CenterPoint = new Point2d((ext.MinPoint.X + ext.MaxPoint.X) / 2, (ext.MinPoint.Y + ext.MaxPoint.Y) / 2);
                    view.Width = en * 1.15;
                    view.Height = boy * 1.15;
                    ed.SetCurrentView(view);
                }
            }
            catch { }
        }
    }

    /// <summary>Çizilirken ekranda görünen geçici çoklu çizgi (bitince silinir).</summary>
    internal sealed class CanliCizgi : IDisposable
    {
        private readonly Document _belge;
        private readonly string _katman;
        private readonly bool _kapali;
        private ObjectId _id = ObjectId.Null;

        public CanliCizgi(Document belge, string katman, bool kapali)
        {
            _belge = belge;
            _katman = katman;
            _kapali = kapali;
        }

        public void Ayarla(IList<Point3d> noktalar)
        {
            var db = _belge.Database;
            using (var tr = db.TransactionManager.StartTransaction())
            {
                Polyline pl = null;
                if (!_id.IsNull && !_id.IsErased) pl = tr.GetObject(_id, OpenMode.ForWrite) as Polyline;
                if (noktalar.Count < 2)
                {
                    if (pl != null) pl.Erase();
                    _id = ObjectId.Null;
                }
                else if (pl == null)
                {
                    pl = new Polyline();
                    pl.SetDatabaseDefaults(db);
                    for (int i = 0; i < noktalar.Count; i++) pl.AddVertexAt(i, new Point2d(noktalar[i].X, noktalar[i].Y), 0, 0, 0);
                    pl.Closed = _kapali && noktalar.Count > 2;
                    pl.LayerId = new CizimYazici(db, tr).Katman(_katman);
                    var ms = (BlockTableRecord)tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(db), OpenMode.ForWrite);
                    _id = ms.AppendEntity(pl);
                    tr.AddNewlyCreatedDBObject(pl, true);
                }
                else
                {
                    while (pl.NumberOfVertices > noktalar.Count) pl.RemoveVertexAt(pl.NumberOfVertices - 1);
                    for (int i = 0; i < noktalar.Count; i++)
                    {
                        var p = new Point2d(noktalar[i].X, noktalar[i].Y);
                        if (i < pl.NumberOfVertices) pl.SetPointAt(i, p);
                        else pl.AddVertexAt(i, p, 0, 0, 0);
                    }
                    pl.Closed = _kapali && noktalar.Count > 2;
                }
                tr.Commit();
            }
            Yenile();
        }

        private void Yenile()
        {
            try
            {
                _belge.TransactionManager.QueueForGraphicsFlush();
                _belge.TransactionManager.FlushGraphics();
                _belge.Editor.UpdateScreen();
            }
            catch { }
        }

        public void Dispose()
        {
            if (_id.IsNull) return;
            try
            {
                using (var tr = _belge.Database.TransactionManager.StartTransaction())
                {
                    var e = tr.GetObject(_id, OpenMode.ForWrite, true) as Entity;
                    if (e != null && !e.IsErased) e.Erase();
                    tr.Commit();
                }
            }
            catch { }
            _id = ObjectId.Null;
            Yenile();
        }
    }
}
