using System;
using System.Collections.Generic;
using System.Globalization;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Bir komutun çalışma ortamı: çizimden okunan proje, çizimin ayarları, katalog, ön ekler,
    /// aktif hakediş ve kalem sırası (OrtamVerisi) + açık belge. Her komut başında bir kez hazırlanır.
    /// </summary>
    internal sealed class Ortam : OrtamVerisi
    {
        public Document Belge;
        public Database Db;
        public Editor Ed;

        public static Ortam Hazirla(Document belge, string yedekOnEk = null)
        {
            var o = new Ortam { Belge = belge, Db = belge.Database, Ed = belge.Editor };
            var varliklar = Toplayici.Topla(o.Db);
            PromagisAyarlari pa;
            try { pa = PromagisSozlugu.Oku(o.Db); }
            catch { pa = new PromagisAyarlari(); }
            o.Doldur(varliklar, PromagisOkuyucu.Oku(varliklar, belge.Name), AyarDeposu.Oku(o.Db), yedekOnEk, pa);
            return o;
        }

        public void AyarKaydet()
        {
            try { AyarDeposu.Yaz(Db, Ayar); }
            catch (Exception ex) { Ed.WriteMessage("\nAyarlar kaydedilemedi: " + ex.Message); }
            // PROMAGIS çizimlerinde aktif hakediş PROMAGIS'in kaydına da yazılır (formları aynı numarayla açılır)
            try
            {
                if (Promagis.Var && Ayar.AktifHakedis > 0 && Ayar.AktifHakedis != Promagis.HakNo)
                {
                    PromagisSozlugu.Yaz(Db, "HakNo_Dic", "HakNo_Rec", Ayar.AktifHakedis.ToString(CultureInfo.InvariantCulture));
                    Promagis.HakNo = Ayar.AktifHakedis;
                }
            }
            catch { }
        }

        /// <summary>
        /// Komut sonunda: verilen sıra numaraları PROMAGIS'in sayacına yazılır ki PROMAGIS sonraki kayıtları
        /// bizimkilerle çakışmayan numaralarla versin (yalnız PROMAGIS sözlüğü olan çizimlerde).
        /// </summary>
        public void SiraKaydet()
        {
            try
            {
                if (!Promagis.Var || Sira <= Promagis.Sayac) return;
                PromagisSozlugu.Yaz(Db, "AYARLAR", "SAYAC", Sira.ToString(CultureInfo.InvariantCulture));
                Promagis.Sayac = Sira;
            }
            catch { }
        }

        /// <summary>Noktaya en yakın eleman (yakalama mesafesi içinde); yoksa null.</summary>
        public Eleman YakinEleman(Point3d p, double mesafe) => YakinEleman(p.X, p.Y, mesafe);
    }

    /// <summary>Çizimin içinde saklanan ayarlar (Named Objects Dictionary → SEBEKE_HAKEDIS → AYARLAR).</summary>
    internal static class AyarDeposu
    {
        private const string Sozluk = "SEBEKE_HAKEDIS";
        private const string Kayit = "AYARLAR";

        public static CizimAyarlari Oku(Database db)
        {
            var ciftler = new List<KeyValuePair<string, string>>();
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                if (nod.Contains(Sozluk))
                {
                    var sozluk = tr.GetObject(nod.GetAt(Sozluk), OpenMode.ForRead) as DBDictionary;
                    if (sozluk != null && sozluk.Contains(Kayit))
                    {
                        var xr = tr.GetObject(sozluk.GetAt(Kayit), OpenMode.ForRead) as Xrecord;
                        if (xr != null)
                        {
                            using (var rb = xr.Data)
                            {
                                if (rb != null)
                                {
                                    string anahtar = null;
                                    foreach (TypedValue tv in rb)
                                    {
                                        string s = Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "";
                                        if (anahtar == null) anahtar = s;
                                        else { ciftler.Add(new KeyValuePair<string, string>(anahtar, s)); anahtar = null; }
                                    }
                                }
                            }
                        }
                    }
                }
                tr.Commit();
            }
            return CizimAyarlari.Ciftlerden(ciftler);
        }

        public static void Yaz(Database db, CizimAyarlari a)
        {
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                DBDictionary sozluk;
                if (nod.Contains(Sozluk)) sozluk = (DBDictionary)tr.GetObject(nod.GetAt(Sozluk), OpenMode.ForWrite);
                else
                {
                    nod.UpgradeOpen();
                    sozluk = new DBDictionary();
                    nod.SetAt(Sozluk, sozluk);
                    tr.AddNewlyCreatedDBObject(sozluk, true);
                }
                Xrecord xr;
                if (sozluk.Contains(Kayit)) xr = (Xrecord)tr.GetObject(sozluk.GetAt(Kayit), OpenMode.ForWrite);
                else
                {
                    xr = new Xrecord();
                    sozluk.SetAt(Kayit, xr);
                    tr.AddNewlyCreatedDBObject(xr, true);
                }
                using (var rb = new ResultBuffer())
                {
                    foreach (var kv in a.Ciftler())
                    {
                        string v = kv.Value ?? "";
                        if (v.Length > 1000) v = v.Substring(0, 1000);
                        rb.Add(new TypedValue((int)DxfCode.Text, kv.Key));
                        rb.Add(new TypedValue((int)DxfCode.Text, v));
                    }
                    xr.Data = rb;
                }
                tr.Commit();
            }
        }
    }

    /// <summary>
    /// PROMAGIS'in çizim sözlüğü: HakNo_Dic/HakNo_Rec (aktif hakediş), Tarife_Dic/Tarife_Rec (grup kodu),
    /// AYARLAR/SAYAC (sıra sayacı), AYARLAR/TXSCALE (yazı ölçeği ×10). Değerler metin (DXF 1) olarak tutulur.
    /// </summary>
    internal static class PromagisSozlugu
    {
        public static PromagisAyarlari Oku(Database db)
        {
            var a = new PromagisAyarlari();
            using (var tr = db.TransactionManager.StartOpenCloseTransaction())
            {
                var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                a.Var = nod.Contains("AYARLAR") || nod.Contains("HakNo_Dic") || nod.Contains("Tarife_Dic");
                a.HakNo = SayiCoz.Tam(Deger(tr, nod, "HakNo_Dic", "HakNo_Rec"));
                a.GrupKodu = (Deger(tr, nod, "Tarife_Dic", "Tarife_Rec") ?? "").Trim();
                double tx = SayiCoz.Coz(Deger(tr, nod, "AYARLAR", "TXSCALE"));
                a.YaziOlcegi = tx > 0 ? tx / 10 : 0;
                long sayac;
                long.TryParse((Deger(tr, nod, "AYARLAR", "SAYAC") ?? "").Trim(), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out sayac);
                a.Sayac = sayac;
                tr.Commit();
            }
            return a;
        }

        private static string Deger(Transaction tr, DBDictionary nod, string sozluk, string kayit)
        {
            if (!nod.Contains(sozluk)) return null;
            var d = tr.GetObject(nod.GetAt(sozluk), OpenMode.ForRead) as DBDictionary;
            if (d == null || !d.Contains(kayit)) return null;
            var xr = tr.GetObject(d.GetAt(kayit), OpenMode.ForRead) as Xrecord;
            if (xr == null) return null;
            using (var rb = xr.Data)
            {
                if (rb == null) return null;
                foreach (TypedValue tv in rb) return Convert.ToString(tv.Value, CultureInfo.InvariantCulture);
            }
            return null;
        }

        public static void Yaz(Database db, string sozluk, string kayit, string deger)
        {
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                DBDictionary d;
                if (nod.Contains(sozluk)) d = (DBDictionary)tr.GetObject(nod.GetAt(sozluk), OpenMode.ForWrite);
                else
                {
                    nod.UpgradeOpen();
                    d = new DBDictionary();
                    nod.SetAt(sozluk, d);
                    tr.AddNewlyCreatedDBObject(d, true);
                }
                Xrecord xr;
                if (d.Contains(kayit)) xr = (Xrecord)tr.GetObject(d.GetAt(kayit), OpenMode.ForWrite);
                else
                {
                    xr = new Xrecord();
                    d.SetAt(kayit, xr);
                    tr.AddNewlyCreatedDBObject(xr, true);
                }
                using (var rb = new ResultBuffer(new TypedValue((int)DxfCode.Text, deger ?? "")))
                {
                    xr.Data = rb;
                }
                tr.Commit();
            }
        }
    }
}
