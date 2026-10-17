using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Bir komutun çalışma ortamı: çizimden okunan proje, çizimin ayarları, katalog, ön ekler,
    /// aktif hakediş ve kalem sırası. Her komut başında bir kez hazırlanır.
    /// </summary>
    internal sealed class Ortam
    {
        public Document Belge;
        public Database Db;
        public Editor Ed;
        public List<CadVarlik> Varliklar;
        public Proje Proje;
        public CizimAyarlari Ayar;
        public string OnEk = "SC";
        public string GisOnEki = "SC";
        public int Hakedis = 1;
        public long Sira;
        private Katalog _katalog;

        public Katalog Katalog => _katalog ?? (_katalog = Katalog.Oku(KatalogKaynagi.Json(), Proje));

        public static Ortam Hazirla(Document belge, string yedekOnEk = null)
        {
            var o = new Ortam { Belge = belge, Db = belge.Database, Ed = belge.Editor };
            o.Varliklar = Toplayici.Topla(o.Db);
            o.Proje = PromagisOkuyucu.Oku(o.Varliklar, belge.Name);
            o.Ayar = AyarDeposu.Oku(o.Db);
            o.OnEk = Ilk(o.Ayar.KatmanOnEki, o.Proje.KatmanOnEki, yedekOnEk, "SC");
            o.GisOnEki = Ilk(o.Ayar.GisOnEki, o.OnEk);
            o.Hakedis = o.Ayar.AktifHakedis > 0 ? o.Ayar.AktifHakedis : Math.Max(1, o.Proje.AktifHakedis);
            o.Sira = Numara.EnBuyukSira(o.Proje);
            return o;
        }

        private static string Ilk(params string[] l)
        {
            foreach (var s in l) if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
            return "";
        }

        /// <summary>Yeni kalemin sıra numarası (INDEX).</summary>
        public string YeniSira() => (++Sira).ToString(CultureInfo.InvariantCulture);

        /// <summary>Yeni elemanın blok ölçeği: ayarda verilmişse o, yoksa çizimdekilerle aynı (PROMAGIS: 4).</summary>
        public double Olcek(string blok) => Ayar.SembolOlcegi > 0 ? Ayar.SembolOlcegi : PromagisYazici.OlcekOner(Varliklar, blok, 4);

        public void AyarKaydet()
        {
            try { AyarDeposu.Yaz(Db, Ayar); }
            catch (Exception ex) { Ed.WriteMessage("\nAyarlar kaydedilemedi: " + ex.Message); }
        }

        /// <summary>Noktaya en yakın eleman (yakalama mesafesi içinde); yoksa null.</summary>
        public Eleman YakinEleman(Point3d p, double mesafe)
        {
            if (mesafe <= 0) return null;
            Eleman en = null;
            double enKisa = mesafe;
            foreach (var e in Proje.Elemanlar)
            {
                double dx = e.Saga - p.X, dy = e.Yukari - p.Y;
                double d = Math.Sqrt(dx * dx + dy * dy);
                if (d <= enKisa) { enKisa = d; en = e; }
            }
            return en;
        }
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

    /// <summary>Eklentiye gömülü malzeme kataloğu (ortak/katalog/kalemler.json).</summary>
    internal static class KatalogKaynagi
    {
        private static string _json;

        public static string Json()
        {
            if (_json != null) return _json;
            try
            {
                using (var s = typeof(KatalogKaynagi).Assembly.GetManifestResourceStream("SebekeHakedis.kalemler.json"))
                {
                    if (s == null) return _json = "";
                    using (var r = new StreamReader(s, Encoding.UTF8)) _json = r.ReadToEnd();
                }
            }
            catch { _json = ""; }
            return _json;
        }
    }
}
