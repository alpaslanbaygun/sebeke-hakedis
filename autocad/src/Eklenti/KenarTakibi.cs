using System;
using System.Collections.Generic;
using System.Globalization;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Kanal kenarlarını AutoCAD komutlarında kanalın ekseniyle birlikte tutar: eksen taşınınca, uzatılınca, köşesi
    /// oynatılınca ya da kopyalanınca kenarlar yeniden çizilir; eksen silinince kenarları da silinir. Olay anında yalnız
    /// not alınır (bildirim sırasında başka nesne değiştirilemez); iş komut bitince kendi işleminde yapılır
    /// (ArmaturTakibi ile aynı düzen). Kenarları güncel olan eksene dokunulmaz (eklentinin kendi yazdıkları dâhil).
    /// </summary>
    internal static class KenarTakibi
    {
        private const string Isaret = "SebekeHakedis.KenarTakibi";

        /// <summary>Çizim başına bekleyen eksenler (çizim kapanınca atılır).</summary>
        private static readonly Dictionary<Database, HashSet<ObjectId>> _kuyruk = new Dictionary<Database, HashSet<ObjectId>>();
        private static readonly object _kilit = new object();
        private static readonly HashSet<string> Atlanan = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "U", "UNDO", "REDO", "MREDO", "REFEDIT", "REFCLOSE", "REFSET" };
        private static bool _calisiyor, _bostaBagli;
        private static int _hataSayisi;

        public static void Baslat()
        {
            var dm = AcApp.DocumentManager;
            foreach (Document d in dm) Bagla(d);
            dm.DocumentCreated += (s, e) => { try { Bagla(e.Document); } catch { } };
            dm.DocumentToBeDestroyed += (s, e) => { try { Birak(e.Document); } catch { } };
        }

        private static void Bagla(Document d)
        {
            if (d == null || d.UserData.ContainsKey(Isaret)) return;
            d.UserData[Isaret] = true;
            var db = d.Database;
            db.ObjectModified += (s, e) => Kaydet(e.DBObject);
            db.ObjectAppended += (s, e) => Kaydet(e.DBObject);
            db.ObjectReappended += (s, e) => Kaydet(e.DBObject);
            db.ObjectErased += (s, e) => Kaydet(e.DBObject);
            d.CommandEnded += KomutBitti;
            d.CommandCancelled += KomutBitti;
            d.CommandFailed += KomutBitti;
            d.LispEnded += LispBitti;
            d.LispCancelled += LispBitti;
        }

        private static void Birak(Document d)
        {
            if (d == null) return;
            lock (_kilit) _kuyruk.Remove(d.Database);
        }

        /// <summary>Kenarı olan kanal ekseni değiştiyse not alınır.</summary>
        private static void Kaydet(DBObject o)
        {
            if (_calisiyor) return;
            try
            {
                if (!(o is Curve)) return;
                using (var rb = o.GetXDataForApplication(NesneYazici.KenarUygulamasi))
                    if (rb == null) return;
                var db = o.Database;
                if (db == null) return;
                lock (_kilit)
                {
                    HashSet<ObjectId> k;
                    if (!_kuyruk.TryGetValue(db, out k)) _kuyruk[db] = k = new HashSet<ObjectId>();
                    k.Add(o.ObjectId);
                }
                BostaBagla();
            }
            catch { }
        }

        private static void KomutBitti(object sender, CommandEventArgs e)
        {
            try
            {
                var d = sender as Document;
                if (d == null) return;
                string komut = (e.GlobalCommandName ?? "").TrimStart('\'', '_', '.', '-', '+');
                // Geri Al / Yinele eksenle kenarları birlikte geri getirir
                if (Atlanan.Contains(komut)) { Birak(d); return; }
                string etkin = (d.CommandInProgress ?? "").TrimStart('\'', '_', '.', '-', '+');
                if (etkin.Length > 0 && !string.Equals(etkin, komut, StringComparison.OrdinalIgnoreCase)) return;
                Isle(d);
            }
            catch { }
        }

        private static void LispBitti(object sender, EventArgs e)
        {
            try
            {
                var d = sender as Document;
                if (d != null && string.IsNullOrEmpty(d.CommandInProgress)) Isle(d);
            }
            catch { }
        }

        /// <summary>Komut dışında (Özellikler paleti vb.) yapılan değişiklikler AutoCAD boşa çıkınca işlenir.</summary>
        private static void BostaBagla()
        {
            if (_bostaBagli) return;
            _bostaBagli = true;
            AcApp.Idle += Bosta;
        }

        private static void Bosta(object sender, EventArgs e)
        {
            try
            {
                var d = AcApp.DocumentManager.MdiActiveDocument;
                if (d == null) return;
                if (!string.IsNullOrEmpty(d.CommandInProgress) || !d.Editor.IsQuiescent) return;
                Isle(d);
                lock (_kilit)
                {
                    foreach (var k in _kuyruk.Values) if (k.Count > 0) return; // başka çizimin işi var
                }
                AcApp.Idle -= Bosta;
                _bostaBagli = false;
            }
            catch { }
        }

        private static void Isle(Document d)
        {
            if (d == null || _calisiyor) return;
            var db = d.Database;
            List<ObjectId> eksenler;
            lock (_kilit)
            {
                HashSet<ObjectId> k;
                if (!_kuyruk.TryGetValue(db, out k) || k.Count == 0) return;
                eksenler = new List<ObjectId>(k);
            }
            if (db.TransactionManager.NumberOfActiveTransactions > 0) { BostaBagla(); return; }
            if (!string.IsNullOrEmpty(Convert.ToString(AcApp.GetSystemVariable("REFEDITNAME"), CultureInfo.InvariantCulture))) { Birak(d); return; }
            lock (_kilit) _kuyruk.Remove(db);
            _calisiyor = true;
            try
            {
                using (d.LockDocument())
                {
                    var ms = SymbolUtilityServices.GetBlockModelSpaceId(db);
                    foreach (var id in eksenler) Dene(db, t => EksenIsle(t, ms, id));
                }
                _hataSayisi = 0;
            }
            catch (Exception ex)
            {
                HataKaydi(ex);
                if (++_hataSayisi <= 2)
                    lock (_kilit)
                    {
                        HashSet<ObjectId> k;
                        if (!_kuyruk.TryGetValue(db, out k)) _kuyruk[db] = k = new HashSet<ObjectId>();
                        foreach (var id in eksenler) k.Add(id);
                    }
            }
            finally { _calisiyor = false; }
        }

        private static void Dene(Database db, Action<Transaction> is_)
        {
            try
            {
                using (var t = db.TransactionManager.StartTransaction())
                {
                    is_(t);
                    t.Commit();
                }
            }
            catch (Exception ex) { HataKaydi(ex); }
        }

        private static void EksenIsle(Transaction t, ObjectId ms, ObjectId id)
        {
            if (id.IsNull || !id.IsValid) return;
            var eksen = t.GetObject(id, OpenMode.ForRead, true) as Curve;
            if (eksen == null || eksen.OwnerId != ms) return; // blok tanımındaki nesnelere dokunulmaz
            var y = new CizimYazici(eksen.Database, t);
            if (eksen.IsErased)
            {
                y.KenarlariSil(eksen); // yalnız kendi kenarları
                return;
            }
            double genislik = Genislik(eksen);
            if (y.KenarlarGuncel(eksen, genislik)) return;
            y.KenarlariYaz(eksen, genislik);
        }

        /// <summary>Kenarlar arası: kanalın GIS verisindeki üst genişlik, yoksa alt genişlik (cm), o da yoksa varsayılan.</summary>
        private static double Genislik(DBObject eksen)
        {
            List<string> gis;
            var k = new Kanal();
            if (Toplayici.XdataOku(eksen).TryGetValue("GIS", out gis) && gis.Count > 0)
            {
                var f = (gis[0] ?? "").Split(';');
                if (f.Length > 4) k.AltGenislik = SayiCoz.Coz(f[4]);
                if (f.Length > 5) k.UstGenislik = SayiCoz.Coz(f[5]);
            }
            return NesneYazici.KanalGenisligi(k);
        }

        private static void HataKaydi(Exception ex)
        {
            try
            {
                System.IO.File.AppendAllText(System.IO.Path.Combine(System.IO.Path.GetTempPath(), "SebekeHakedis_hata.txt"),
                    DateTime.Now.ToString("s", CultureInfo.InvariantCulture) + " Kanal kenarı takibi: " + ex + Environment.NewLine);
            }
            catch { }
        }
    }
}
