using System;
using System.Collections.Generic;
using System.Globalization;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Direk ile armatür simgesi arasındaki bağ (SH_ARM genişletilmiş verisi):
    /// direkte [simgenin tanıtıcısı, dx, dy] (simgenin direğe göre yeri), simgede ["@" + direğin tanıtıcısı].
    /// </summary>
    internal static class ArmaturBagi
    {
        public const string Uygulama = PromagisYazici.ArmaturUygulamasi;

        /// <summary>Direğin bağ verisi: simgenin tanıtıcısı ve yeri (konumlu: yer yazılı mı). Simgede ya da verisizde false.</summary>
        public static bool DirekVerisi(DBObject o, out string simge, out double dx, out double dy, out bool konumlu)
        {
            simge = null;
            dx = dy = 0;
            konumlu = false;
            if (o == null) return false;
            using (var rb = o.GetXDataForApplication(Uygulama))
            {
                if (rb == null) return false;
                int sira = 0;
                foreach (TypedValue tv in rb)
                {
                    if (tv.TypeCode == (short)DxfCode.ExtendedDataRegAppName) continue;
                    if (tv.TypeCode == (short)DxfCode.ExtendedDataAsciiString && sira == 0)
                    {
                        string s = Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "";
                        if (s.StartsWith("@", StringComparison.Ordinal)) return false; // bu bir simge
                        simge = s;
                        sira = 1;
                        continue;
                    }
                    if (tv.TypeCode == (short)DxfCode.ExtendedDataReal && sira >= 1)
                    {
                        double d = Convert.ToDouble(tv.Value, CultureInfo.InvariantCulture);
                        if (sira == 1) { dx = d; sira = 2; }
                        else if (sira == 2) { dy = d; sira = 3; konumlu = true; }
                    }
                }
            }
            return !string.IsNullOrEmpty(simge);
        }

        /// <summary>Simgenin sahibi olan direğin tanıtıcısı; simge değilse null.</summary>
        public static string SimgeSahibi(DBObject o)
        {
            if (o == null) return null;
            using (var rb = o.GetXDataForApplication(Uygulama))
            {
                if (rb == null) return null;
                foreach (TypedValue tv in rb)
                {
                    if (tv.TypeCode != (short)DxfCode.ExtendedDataAsciiString) continue;
                    string s = Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "";
                    return s.StartsWith("@", StringComparison.Ordinal) ? s.Substring(1) : null;
                }
            }
            return null;
        }

        /// <summary>Direğe bağ verisini yazar (simge null: bağ silinir). Nesne yazmaya açık olmalı, uygulama adı kayıtlı olmalı.</summary>
        public static void DirekVerisiYaz(DBObject direk, string simge, double dx, double dy)
        {
            if (!direk.IsWriteEnabled) direk.UpgradeOpen();
            using (var rb = string.IsNullOrEmpty(simge)
                ? new ResultBuffer(new TypedValue((int)DxfCode.ExtendedDataRegAppName, Uygulama))
                : new ResultBuffer(
                    new TypedValue((int)DxfCode.ExtendedDataRegAppName, Uygulama),
                    new TypedValue((int)DxfCode.ExtendedDataAsciiString, simge),
                    new TypedValue((int)DxfCode.ExtendedDataReal, dx),
                    new TypedValue((int)DxfCode.ExtendedDataReal, dy)))
                direk.XData = rb;
        }

        /// <summary>Simgeye sahibini (direğin tanıtıcısı) yazar.</summary>
        public static void SahibiYaz(DBObject simge, string direk)
        {
            if (!simge.IsWriteEnabled) simge.UpgradeOpen();
            using (var rb = new ResultBuffer(
                new TypedValue((int)DxfCode.ExtendedDataRegAppName, Uygulama),
                new TypedValue((int)DxfCode.ExtendedDataAsciiString, "@" + direk)))
                simge.XData = rb;
        }

        /// <summary>Tanıtıcıdan nesne kimliği (silinmiş olsa da).</summary>
        public static bool Bul(Database db, string hex, out ObjectId id)
        {
            id = ObjectId.Null;
            long n;
            if (db == null || string.IsNullOrEmpty(hex) || !long.TryParse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out n)) return false;
            try
            {
                id = db.GetObjectId(false, new Handle(n), 0);
                return !id.IsNull && id.IsValid;
            }
            catch { return false; }
        }
    }

    /// <summary>
    /// Armatür simgesi direğiyle birlikte gider: direk AutoCAD komutlarıyla (Taşı, Uzat, tutamaç, Kopyala, Ayna, Sil,
    /// Geri Al…) değişince komut bitiminde simgesi de taşınır, kopyalanır, silinir ya da geri gelir. Kullanıcı simgeyi tek
    /// başına taşırsa yeni yeri direğe göre saklanır (sonraki taşımalarda korunur). Yalnız SH_ARM verili bloklara bakar.
    /// </summary>
    internal static class ArmaturTakibi
    {
        private const string Isaret = "SebekeHakedis.ArmaturTakibi";

        private enum Olay { Direk, SimgeTasindi, SimgeEklendi }

        private sealed class Is
        {
            public ObjectId Id;
            public Olay Tur;
            public bool Eklendi;
            public string Tanitici, Simge;
        }

        private static readonly List<Is> _isler = new List<Is>();
        private static bool _calisiyor, _bostaBagli;

        public static void Baslat()
        {
            var dm = AcApp.DocumentManager;
            foreach (Document d in dm) Bagla(d);
            dm.DocumentCreated += (s, e) => Bagla(e.Document);
        }

        private static void Bagla(Document d)
        {
            try
            {
                if (d == null || d.UserData.ContainsKey(Isaret)) return;
                d.UserData[Isaret] = true;
                var db = d.Database;
                db.ObjectModified += (s, e) => Kaydet(e.DBObject, false);
                db.ObjectAppended += (s, e) => Kaydet(e.DBObject, true);
                db.ObjectReappended += (s, e) => Kaydet(e.DBObject, false);
                db.ObjectUnappended += (s, e) => Kaydet(e.DBObject, false);
                db.ObjectErased += (s, e) => Kaydet(e.DBObject, false);
                d.CommandEnded += (s, e) => Isle(s as Document);
                d.CommandCancelled += (s, e) => Isle(s as Document);
                d.CommandFailed += (s, e) => Isle(s as Document);
                d.LispEnded += (s, e) => Isle(s as Document);
                d.LispCancelled += (s, e) => Isle(s as Document);
            }
            catch { }
        }

        /// <summary>Olay anında yalnız not alınır (bildirim sırasında başka nesne değiştirilemez); iş komut bitiminde yapılır.</summary>
        private static void Kaydet(DBObject o, bool eklendi)
        {
            if (_calisiyor) return;
            try
            {
                var br = o as BlockReference;
                if (br == null) return;
                var x = new Is { Id = br.ObjectId, Eklendi = eklendi, Tanitici = br.Handle.ToString() };
                string simge;
                double dx, dy;
                bool konumlu;
                if (ArmaturBagi.DirekVerisi(br, out simge, out dx, out dy, out konumlu))
                {
                    x.Tur = Olay.Direk;
                    x.Simge = simge;
                }
                else
                {
                    if (ArmaturBagi.SimgeSahibi(br) == null) return;
                    x.Tur = eklendi ? Olay.SimgeEklendi : Olay.SimgeTasindi;
                }
                lock (_isler)
                {
                    if (_isler.Count > 200000) _isler.Clear(); // ne olursa olsun sınırsız büyümesin
                    _isler.Add(x);
                }
                BostaBagla();
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
                if (!string.IsNullOrEmpty(d.CommandInProgress)) return; // komut sürüyor: bitince işlenir
                AcApp.Idle -= Bosta;
                _bostaBagli = false;
                Isle(d);
            }
            catch { }
        }

        private static void Isle(Document d)
        {
            if (d == null || _calisiyor) return;
            List<Is> isler;
            var db = d.Database;
            lock (_isler)
            {
                if (_isler.Count == 0) return;
                isler = _isler.FindAll(x => x.Id.Database == db);
                _isler.RemoveAll(x => x.Id.Database == db || !x.Id.IsValid);
            }
            if (isler.Count == 0) return;
            _calisiyor = true;
            try
            {
                using (d.LockDocument())
                using (var tr = db.TransactionManager.StartTransaction())
                {
                    // 1) Tek başına taşınan simgeler: direğe göre yeni yerleri saklanır
                    var gorulen = new HashSet<ObjectId>();
                    foreach (var x in isler)
                        if (x.Tur == Olay.SimgeTasindi && gorulen.Add(x.Id)) Dene(() => SimgeTasindi(tr, x.Id));
                    // 2) Bu komutta eklenen simgeler (direkle birlikte kopyalananlar): kopya direklere sahiplenilir
                    var yeniSimgeler = new List<ObjectId>();
                    foreach (var x in isler) if (x.Tur == Olay.SimgeEklendi && !yeniSimgeler.Contains(x.Id)) yeniSimgeler.Add(x.Id);
                    // 3) Direkler: son durumlarına göre simge taşınır / kopyalanır / silinir / geri gelir
                    var direkler = new Dictionary<ObjectId, Is>();
                    foreach (var x in isler)
                    {
                        if (x.Tur != Olay.Direk) continue;
                        Is onceki;
                        if (direkler.TryGetValue(x.Id, out onceki))
                        {
                            if (x.Eklendi) onceki.Eklendi = true;
                            if (string.IsNullOrEmpty(onceki.Simge)) onceki.Simge = x.Simge;
                        }
                        else direkler[x.Id] = x;
                    }
                    foreach (var x in direkler.Values) Dene(() => DirekIsle(tr, db, x, yeniSimgeler));
                    tr.Commit();
                }
            }
            catch (System.Exception ex) { HataKaydi(ex); }
            finally { _calisiyor = false; }
        }

        private static void Dene(Action is_)
        {
            try { is_(); }
            catch (System.Exception ex) { HataKaydi(ex); } // kilitli katman vb.: o simge atlanır
        }

        private static BlockReference Ac(Transaction tr, ObjectId id, bool silinmis)
        {
            try { return id.IsNull || !id.IsValid ? null : tr.GetObject(id, OpenMode.ForRead, silinmis) as BlockReference; }
            catch { return null; }
        }

        private static BlockReference TaniticiylaAc(Transaction tr, Database db, string tanitici)
        {
            ObjectId id;
            return ArmaturBagi.Bul(db, tanitici, out id) ? Ac(tr, id, true) : null;
        }

        private static void SimgeTasindi(Transaction tr, ObjectId id)
        {
            var s = Ac(tr, id, false);
            if (s == null) return;
            var direk = TaniticiylaAc(tr, s.Database, ArmaturBagi.SimgeSahibi(s));
            if (direk == null || direk.IsErased) return;
            string simge;
            double dx, dy;
            bool konumlu;
            if (!ArmaturBagi.DirekVerisi(direk, out simge, out dx, out dy, out konumlu) || simge != s.Handle.ToString()) return;
            double ndx = s.Position.X - direk.Position.X, ndy = s.Position.Y - direk.Position.Y;
            if (konumlu && Math.Abs(ndx - dx) < 1e-6 && Math.Abs(ndy - dy) < 1e-6) return;
            ArmaturBagi.DirekVerisiYaz(direk, simge, ndx, ndy);
        }

        private static void DirekIsle(Transaction tr, Database db, Is x, List<ObjectId> yeniSimgeler)
        {
            var direk = Ac(tr, x.Id, true);
            if (direk == null || direk.IsErased)
            {
                // Direk silindi (ya da geri alındı): yalnız kendi simgesi silinir
                var s = TaniticiylaAc(tr, db, x.Simge);
                if (s != null && !s.IsErased && ArmaturBagi.SimgeSahibi(s) == x.Tanitici)
                {
                    s.UpgradeOpen();
                    s.Erase();
                }
                return;
            }
            // Yalnız model alanındaki direkler (blok tanımına giren kopyalara dokunulmaz)
            if (direk.OwnerId != SymbolUtilityServices.GetBlockModelSpaceId(db)) return;
            string simge;
            double dx, dy;
            bool konumlu;
            if (!ArmaturBagi.DirekVerisi(direk, out simge, out dx, out dy, out konumlu)) return;
            string tanitici = direk.Handle.ToString();
            var mevcut = TaniticiylaAc(tr, db, simge);
            if (mevcut != null && ArmaturBagi.SimgeSahibi(mevcut) == null) mevcut = null; // tanıtıcı başka bir nesnenin (başka çizimden gelmiş)
            if (mevcut != null && ArmaturBagi.SimgeSahibi(mevcut) == tanitici)
            {
                if (!konumlu) return;
                if (mevcut.IsErased)
                {
                    mevcut.UpgradeOpen();
                    mevcut.Erase(false);
                }
                var konum = new Point3d(direk.Position.X + dx, direk.Position.Y + dy, direk.Position.Z);
                if (mevcut.Position.DistanceTo(konum) > 1e-6)
                {
                    if (!mevcut.IsWriteEnabled) mevcut.UpgradeOpen();
                    mevcut.Position = konum;
                }
                return;
            }
            // Simge başka direğin (kopya direk): direkle birlikte kopyalanan simge varsa sahiplenilir, yoksa yenisi çizilir
            if (mevcut == null)
            {
                ArmaturBagi.DirekVerisiYaz(direk, null, 0, 0);
                return;
            }
            if (!konumlu) { dx = -5; dy = 3; }
            string kaynakSahibi = ArmaturBagi.SimgeSahibi(mevcut);
            var hedef = new Point3d(direk.Position.X + dx, direk.Position.Y + dy, direk.Position.Z);
            BlockReference yeni = null;
            double enYakin = Math.Max(1.0, 3 * Math.Sqrt(dx * dx + dy * dy));
            ObjectId secilen = ObjectId.Null;
            foreach (var id in yeniSimgeler)
            {
                var a = Ac(tr, id, false);
                if (a == null || a.BlockTableRecord != mevcut.BlockTableRecord || ArmaturBagi.SimgeSahibi(a) != kaynakSahibi) continue;
                double u = a.Position.DistanceTo(hedef);
                if (u < enYakin) { enYakin = u; yeni = a; secilen = id; }
            }
            if (yeni != null)
            {
                yeniSimgeler.Remove(secilen);
                dx = yeni.Position.X - direk.Position.X;
                dy = yeni.Position.Y - direk.Position.Y;
            }
            else
            {
                if (mevcut.IsErased) return; // kaynak simge yok: kopyalanacak bir şey yok
                yeni = new BlockReference(hedef, mevcut.BlockTableRecord);
                yeni.SetDatabaseDefaults(db);
                yeni.LayerId = direk.LayerId;
                yeni.Color = mevcut.Color;
                yeni.ScaleFactors = mevcut.ScaleFactors;
                var sahip = (BlockTableRecord)tr.GetObject(direk.OwnerId, OpenMode.ForWrite);
                sahip.AppendEntity(yeni);
                tr.AddNewlyCreatedDBObject(yeni, true);
            }
            ArmaturBagi.SahibiYaz(yeni, tanitici);
            ArmaturBagi.DirekVerisiYaz(direk, yeni.Handle.ToString(), dx, dy);
        }

        private static void HataKaydi(System.Exception ex)
        {
            try
            {
                System.IO.File.AppendAllText(System.IO.Path.Combine(System.IO.Path.GetTempPath(), "SebekeHakedis_hata.txt"),
                    DateTime.Now.ToString("s", CultureInfo.InvariantCulture) + " Armatür takibi: " + ex + Environment.NewLine);
            }
            catch { }
        }
    }
}
