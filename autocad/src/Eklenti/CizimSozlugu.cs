using System;
using System.Collections.Generic;
using System.Globalization;
using Autodesk.AutoCAD.DatabaseServices;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// AutoCAD'in çizim sözlüğündeki kayıtlar (Named Objects Dictionary → sözlük → Xrecord, metin değerler):
    ///   AYARLAR / SAYAC        kalem sıra numarası sayacı (INDEX); eklenti yeni sıra verince günceller
    ///   HakNo_Dic / HakNo_Rec  aktif hakediş
    ///   DicBölge / RecBölge    bölge (alt proje) çizgilerinin tanıtıcı listesi — AutoCAD raporu bölgeleri buradan bulur
    /// Böylece eklentiyle çizilen nesneler AutoCAD'de de aynı sırayla, aynı hakedişte ve rapordaki bölge listesinde görünür.
    /// </summary>
    internal static class CizimSozlugu
    {
        public const string Ayarlar = "AYARLAR", Sayac = "SAYAC";
        public const string HakNoSozlugu = "HakNo_Dic", HakNoKaydi = "HakNo_Rec";
        public const string BolgeSozlugu = "DicBölge", BolgeKaydi = "RecBölge";

        /// <summary>Kaydın değerleri (yoksa boş liste). Okuma için kendi işlemini açar.</summary>
        public static List<string> Oku(Database db, string sozluk, string kayit)
        {
            var l = new List<string>();
            try
            {
                using (var tr = db.TransactionManager.StartTransaction())
                {
                    var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                    if (nod.Contains(sozluk))
                    {
                        var d = tr.GetObject(nod.GetAt(sozluk), OpenMode.ForRead) as DBDictionary;
                        if (d != null && d.Contains(kayit))
                        {
                            var xr = tr.GetObject(d.GetAt(kayit), OpenMode.ForRead) as Xrecord;
                            if (xr != null)
                                using (var rb = xr.Data)
                                    if (rb != null)
                                        foreach (TypedValue tv in rb) l.Add(Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "");
                        }
                    }
                    tr.Commit();
                }
            }
            catch { }
            return l;
        }

        public static string Ilk(Database db, string sozluk, string kayit)
        {
            var l = Oku(db, sozluk, kayit);
            return l.Count > 0 ? l[0] : "";
        }

        /// <summary>Kaydın değerlerini yazar (sözlük ve kayıt yoksa oluşturulur). Verilen işlem içinde çalışır.</summary>
        public static void Yaz(Database db, Transaction tr, string sozluk, string kayit, IEnumerable<string> degerler)
        {
            var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
            DBDictionary d;
            if (nod.Contains(sozluk)) d = (DBDictionary)tr.GetObject(nod.GetAt(sozluk), OpenMode.ForWrite);
            else
            {
                if (!nod.IsWriteEnabled) nod.UpgradeOpen();
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
            using (var rb = new ResultBuffer())
            {
                foreach (var s in degerler) rb.Add(new TypedValue((int)DxfCode.Text, s ?? ""));
                xr.Data = rb;
            }
        }

        /// <summary>AutoCAD sayacı (son verilen ya da sıradaki sıra numarası; okunamazsa 0).</summary>
        public static long SayacOku(Database db)
        {
            long n;
            return long.TryParse(Ilk(db, Ayarlar, Sayac).Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out n) ? n : 0;
        }

        /// <summary>
        /// Sayaca sıradaki boş numarayı yazar (son kullanılan + 1): AutoCAD sayacı ister doğrudan ister bir artırıp
        /// kullansın, eklentinin verdiği numarayla çakışmaz.
        /// </summary>
        public static void SayacYaz(Database db, long sonKullanilan)
        {
            try
            {
                if (SayacOku(db) > sonKullanilan) return;
                using (var tr = db.TransactionManager.StartTransaction())
                {
                    Yaz(db, tr, Ayarlar, Sayac, new[] { (sonKullanilan + 1).ToString(CultureInfo.InvariantCulture) });
                    tr.Commit();
                }
            }
            catch { }
        }

        /// <summary>AutoCAD'in aktif hakedişi (yoksa 0).</summary>
        public static int HakNoOku(Database db)
        {
            int n;
            return int.TryParse(Ilk(db, HakNoSozlugu, HakNoKaydi).Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out n) ? n : 0;
        }

        public static void HakNoYaz(Database db, Transaction tr, int hakedis) =>
            Yaz(db, tr, HakNoSozlugu, HakNoKaydi, new[] { hakedis.ToString(CultureInfo.InvariantCulture) });

        public const string OnaySozlugu = "HAK_ONAY", OnayKaydi = "ONAY_DURUM";

        /// <summary>Hakediş onayları (HAK_ONAY / ONAY_DURUM&lt;n&gt;): hakediş no → bitler (Kontrol 4, Hakediş 2, GIS 1).</summary>
        public static SortedDictionary<int, int> OnaylariOku(Database db)
        {
            var r = new SortedDictionary<int, int>();
            try
            {
                using (var tr = db.TransactionManager.StartTransaction())
                {
                    var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                    if (nod.Contains(OnaySozlugu))
                    {
                        var d = tr.GetObject(nod.GetAt(OnaySozlugu), OpenMode.ForRead) as DBDictionary;
                        if (d != null)
                            foreach (DBDictionaryEntry g in d)
                            {
                                if (!g.Key.StartsWith(OnayKaydi, StringComparison.OrdinalIgnoreCase)) continue;
                                int no;
                                if (!int.TryParse(g.Key.Substring(OnayKaydi.Length), NumberStyles.Integer, CultureInfo.InvariantCulture, out no) || no <= 0) continue;
                                var xr = tr.GetObject(g.Value, OpenMode.ForRead) as Xrecord;
                                if (xr == null) continue;
                                using (var rb = xr.Data)
                                {
                                    if (rb == null) continue;
                                    foreach (TypedValue tv in rb)
                                    {
                                        int b;
                                        if (int.TryParse((Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "").Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out b) && (b & 7) != 0)
                                            r[no] = b & 7;
                                        break;
                                    }
                                }
                            }
                    }
                    tr.Commit();
                }
            }
            catch { }
            return r;
        }

        /// <summary>Bir hakedişin onay bitlerini yazar (AutoCAD da aynı kaydı okur).</summary>
        public static void OnayYaz(Database db, Transaction tr, int hakedis, int bitler) =>
            Yaz(db, tr, OnaySozlugu, OnayKaydi + hakedis.ToString(CultureInfo.InvariantCulture), new[] { (bitler & 7).ToString(CultureInfo.InvariantCulture) });

        /// <summary>Bölge çizgisini AutoCAD'in bölge listesine ekler (zaten varsa dokunmaz).</summary>
        public static void BolgeEkle(Database db, Transaction tr, string handle)
        {
            if (string.IsNullOrEmpty(handle)) return;
            var l = Oku(db, BolgeSozlugu, BolgeKaydi);
            foreach (var h in l) if (string.Equals(h, handle, StringComparison.OrdinalIgnoreCase)) return;
            l.Add(handle);
            Yaz(db, tr, BolgeSozlugu, BolgeKaydi, l);
        }

        /// <summary>Bölge çizgisini AutoCAD'in bölge listesinden çıkarır.</summary>
        public static void BolgeCikar(Database db, Transaction tr, string handle)
        {
            if (string.IsNullOrEmpty(handle)) return;
            var l = Oku(db, BolgeSozlugu, BolgeKaydi);
            int n = l.RemoveAll(h => string.Equals(h, handle, StringComparison.OrdinalIgnoreCase));
            if (n > 0) Yaz(db, tr, BolgeSozlugu, BolgeKaydi, l);
        }
    }
}
