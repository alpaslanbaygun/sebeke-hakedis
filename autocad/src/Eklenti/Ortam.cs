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
            o.Doldur(varliklar, PromagisOkuyucu.Oku(varliklar, belge.Name), AyarDeposu.Oku(o.Db), yedekOnEk);
            return o;
        }

        public void AyarKaydet()
        {
            try { AyarDeposu.Yaz(Db, Ayar); }
            catch (Exception ex) { Ed.WriteMessage("\nAyarlar kaydedilemedi: " + ex.Message); }
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
}
