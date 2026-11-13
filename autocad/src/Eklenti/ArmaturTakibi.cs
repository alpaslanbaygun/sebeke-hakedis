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
    /// Direk ile ona bağlı süs nesnesi arasındaki bağ: armatür simgesi (SH_ARM) ve malzeme yazısı (SH_MLZ; 13.11.2026).
    /// Direkte [süsün tanıtıcısı, dx, dy] (süsün direğe göre yeri), süste ["@" + direğin tanıtıcısı]. Uygulama adı
    /// verilmezse armatür bağı okunur / yazılır.
    /// </summary>
    internal static class ArmaturBagi
    {
        public const string Uygulama = NesneYazici.ArmaturUygulamasi;

        /// <summary>Direğe bağlanabilen süslerin uygulama adları (armatür simgesi, malzeme yazısı).</summary>
        public static readonly string[] Uygulamalar = { NesneYazici.ArmaturUygulamasi, NesneYazici.MalzemeYazisiUygulamasi };

        /// <summary>Direğin bağ verisi: süsün tanıtıcısı ve yeri (konumlu: yer yazılı mı). Süste ya da verisizde false.</summary>
        public static bool DirekVerisi(DBObject o, out string simge, out double dx, out double dy, out bool konumlu, string uygulama = Uygulama)
        {
            simge = null;
            dx = dy = 0;
            konumlu = false;
            if (o == null) return false;
            using (var rb = o.GetXDataForApplication(uygulama))
            {
                if (rb == null) return false;
                int sira = 0;
                foreach (TypedValue tv in rb)
                {
                    if (tv.TypeCode == (short)DxfCode.ExtendedDataRegAppName) continue;
                    if (tv.TypeCode == (short)DxfCode.ExtendedDataAsciiString && sira == 0)
                    {
                        string s = Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "";
                        if (s.StartsWith("@", StringComparison.Ordinal)) return false; // bu bir süs
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

        /// <summary>Süsün sahibi olan direğin tanıtıcısı; süs değilse null.</summary>
        public static string SimgeSahibi(DBObject o, string uygulama = Uygulama)
        {
            if (o == null) return null;
            using (var rb = o.GetXDataForApplication(uygulama))
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

        /// <summary>Nesne hangi uygulamanın süsü (armatür simgesi / malzeme yazısı); hiçbirinin değilse null.</summary>
        public static string SusUygulamasi(DBObject o)
        {
            foreach (var u in Uygulamalar) if (SimgeSahibi(o, u) != null) return u;
            return null;
        }

        /// <summary>Direkte herhangi bir süs bağı var mı.</summary>
        public static bool DirekMi(DBObject o)
        {
            string s;
            double dx, dy;
            bool k;
            foreach (var u in Uygulamalar) if (DirekVerisi(o, out s, out dx, out dy, out k, u)) return true;
            return false;
        }

        /// <summary>Direğe bağ verisini yazar (simge null: bağ silinir). Nesne yazmaya açık olmalı, uygulama adı kayıtlı olmalı.</summary>
        public static void DirekVerisiYaz(DBObject direk, string simge, double dx, double dy, string uygulama = Uygulama)
        {
            // Silme: veri yoksa dokunulmaz; varsa Toplayici.XdataSil ile silinir. Yalnız uygulama adı yazmak değersiz
            // (sıfır uzunluklu) bölüm bırakabiliyor; bu kaydedilen çizimi bozuyor (açılışta eWrongObjectType).
            if (string.IsNullOrEmpty(simge))
            {
                using (var var_ = direk.GetXDataForApplication(uygulama)) if (var_ == null) return;
                Toplayici.XdataSil(direk, new[] { uygulama });
                return;
            }
            if (!direk.IsWriteEnabled) direk.UpgradeOpen();
            using (var rb = new ResultBuffer(
                    new TypedValue((int)DxfCode.ExtendedDataRegAppName, uygulama),
                    new TypedValue((int)DxfCode.ExtendedDataAsciiString, simge),
                    new TypedValue((int)DxfCode.ExtendedDataReal, dx),
                    new TypedValue((int)DxfCode.ExtendedDataReal, dy)))
                direk.XData = rb;
        }

        /// <summary>Süse sahibini (direğin tanıtıcısı) yazar.</summary>
        public static void SahibiYaz(DBObject simge, string direk, string uygulama = Uygulama)
        {
            if (!simge.IsWriteEnabled) simge.UpgradeOpen();
            using (var rb = new ResultBuffer(
                new TypedValue((int)DxfCode.ExtendedDataRegAppName, uygulama),
                new TypedValue((int)DxfCode.ExtendedDataAsciiString, "@" + direk)))
                simge.XData = rb;
        }

        /// <summary>
        /// Süsün SH_SAHIP verisi (sahibinin tanıtıcısı, AutoCAD tanıtıcı türüyle): süs seçilince komutlar sahibine gider
        /// (Toplayici.SusSahibi); kopyada AutoCAD tanıtıcıyı kopyanın sahibine çevirir.
        /// </summary>
        public static void SahipVerisiYaz(DBObject sus, string sahip)
        {
            if (!sus.IsWriteEnabled) sus.UpgradeOpen();
            using (var rb = new ResultBuffer(
                new TypedValue((int)DxfCode.ExtendedDataRegAppName, NesneYazici.SahipUygulamasi),
                new TypedValue((int)DxfCode.ExtendedDataHandle, sahip)))
                sus.XData = rb;
        }

        /// <summary>Süsün yeri: blok için konum, çok satırlı yazı için sol üst köşe.</summary>
        public static Point3d Konum(Entity e)
        {
            var br = e as BlockReference;
            if (br != null) return br.Position;
            var mt = e as MText;
            if (mt != null) return mt.Location;
            return Point3d.Origin;
        }

        public static void KonumYaz(Entity e, Point3d p)
        {
            var br = e as BlockReference;
            if (br != null) { br.Position = p; return; }
            var mt = e as MText;
            if (mt != null) mt.Location = p;
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
    /// Direğin süsleri (armatür simgesi, malzeme yazısı) direğiyle birlikte gider: direk AutoCAD komutlarıyla (Taşı, Uzat,
    /// tutamaç, Kopyala, Ayna, Sil, yapıştırma…) değişince komut bitiminde süsleri de taşınır, kopyalanır ya da silinir.
    /// Kullanıcı süsü tek başına taşırsa yeni yeri direğe göre saklanır. Geri Al / Yinele'de bir şey yapılmaz (AutoCAD
    /// ikisini birlikte geri getirir). Yalnız SH_ARM / SH_MLZ verili, model alanındaki bloklara ve yazılara bakar.
    /// </summary>
    internal static class ArmaturTakibi
    {
        private const string Isaret = "SebekeHakedis.ArmaturTakibi";

        /// <summary>Bir nesnenin bu komuttaki olayları (aynı nesnenin olayları birleştirilir).</summary>
        private sealed class Not
        {
            public ObjectId Id;
            public bool Direk;      // direk mi (değilse süs)
            public bool Eklendi;    // çizime eklendi (kopya, yapıştırma, ayna)
            public bool GeriGeldi;  // silinmişken geri geldi
            public string Tanitici; // nesnenin tanıtıcısı
            public string Uygulama; // süste: hangi bağın süsü
            public readonly Dictionary<string, string> Susler = new Dictionary<string, string>(StringComparer.Ordinal); // direkte: uygulama → süsün tanıtıcısı (olay anındaki)
        }

        /// <summary>Bu komutta eklenen süs (kopya direklere sahiplenilebilir).</summary>
        private sealed class Aday
        {
            public ObjectId Id;
            public string Tur;      // blok adı kimliği ya da "MTEXT": aynı türden olan sahiplenilir
            public string Uygulama;
            public Point3d Konum;
            public string Sahip;
            public bool Alindi;
        }

        /// <summary>Çizim başına bekleyen işler (çizim kapanınca atılır: kapanmış çizimin nesnelerine asla dokunulmaz).</summary>
        private static readonly Dictionary<Database, Dictionary<ObjectId, Not>> _kuyruk = new Dictionary<Database, Dictionary<ObjectId, Not>>();
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
            db.ObjectModified += (s, e) => Kaydet(e.DBObject, false, false);
            db.ObjectAppended += (s, e) => Kaydet(e.DBObject, true, false);
            db.ObjectReappended += (s, e) => Kaydet(e.DBObject, false, true);
            db.ObjectUnappended += (s, e) => Kaydet(e.DBObject, false, false);
            db.ObjectErased += (s, e) => Kaydet(e.DBObject, false, !e.Erased);
            d.CommandEnded += KomutBitti;
            d.CommandCancelled += KomutBitti;
            d.CommandFailed += KomutBitti;
            d.LispEnded += LispBitti;
            d.LispCancelled += LispBitti;
        }

        /// <summary>Çizimin bekleyen işlerini atar.</summary>
        private static void Birak(Document d)
        {
            if (d == null) return;
            lock (_kilit) _kuyruk.Remove(d.Database);
        }

        /// <summary>Olay anında yalnız not alınır (bildirim sırasında başka nesne değiştirilemez); iş komut bitiminde yapılır.</summary>
        private static void Kaydet(DBObject o, bool eklendi, bool geriGeldi)
        {
            if (_calisiyor) return;
            try
            {
                var ent = o as Entity;
                if (ent == null || !(ent is BlockReference || ent is MText)) return;
                bool direk = ent is BlockReference && ArmaturBagi.DirekMi(ent);
                string susUygulamasi = direk ? null : ArmaturBagi.SusUygulamasi(ent);
                if (!direk && susUygulamasi == null) return;
                var db = ent.Database;
                if (db == null) return;
                lock (_kilit)
                {
                    Dictionary<ObjectId, Not> k;
                    if (!_kuyruk.TryGetValue(db, out k)) _kuyruk[db] = k = new Dictionary<ObjectId, Not>();
                    Not n;
                    if (!k.TryGetValue(ent.ObjectId, out n)) k[ent.ObjectId] = n = new Not { Id = ent.ObjectId, Direk = direk, Tanitici = ent.Handle.ToString(), Uygulama = susUygulamasi };
                    if (eklendi) n.Eklendi = true;
                    if (geriGeldi) n.GeriGeldi = true;
                    if (direk)
                        foreach (var u in ArmaturBagi.Uygulamalar)
                        {
                            string simge;
                            double dx, dy;
                            bool konumlu;
                            if (!n.Susler.ContainsKey(u) && ArmaturBagi.DirekVerisi(ent, out simge, out dx, out dy, out konumlu, u)) n.Susler[u] = simge;
                        }
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
                // Geri Al / Yinele ikisini birlikte geri getirir; blok yerinde düzenlemede nesneler blok tanımına döner
                if (Atlanan.Contains(komut)) { Birak(d); return; }
                // Başka bir komutun içinde biten komut (ör. Taşı sırasında saydam Yakınlaş): dıştaki bitince işlenir
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
                if (d != null && string.IsNullOrEmpty(d.CommandInProgress)) Isle(d); // komut içindeki LISP: komut bitince
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
                if (!string.IsNullOrEmpty(d.CommandInProgress) || !d.Editor.IsQuiescent) return; // komut ya da LISP sürüyor
                Isle(d);
                lock (_kilit)
                {
                    bool bos = true;
                    foreach (var k in _kuyruk.Values) if (k.Count > 0) { bos = false; break; }
                    if (!bos) return; // başka çizimin işi var: o çizim etkin olunca
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
            List<Not> notlar;
            lock (_kilit)
            {
                Dictionary<ObjectId, Not> k;
                if (!_kuyruk.TryGetValue(db, out k) || k.Count == 0) return;
                notlar = new List<Not>(k.Values);
            }
            // Açık bir işlem varken (başka bir eklentinin işi) dokunulmaz: sonra işlenir
            if (db.TransactionManager.NumberOfActiveTransactions > 0) { BostaBagla(); return; }
            // Blok yerinde düzenleme sürerken dokunulmaz (o nesneler blok tanımına geri yazılır)
            if (!string.IsNullOrEmpty(Convert.ToString(AcApp.GetSystemVariable("REFEDITNAME"), CultureInfo.InvariantCulture))) { Birak(d); return; }
            lock (_kilit) _kuyruk.Remove(db);
            _calisiyor = true;
            try
            {
                using (d.LockDocument())
                {
                    var ms = SymbolUtilityServices.GetBlockModelSpaceId(db);
                    // 1) Tek başına taşınan süsler: direğe göre yeni yerleri saklanır
                    foreach (var n in notlar)
                        if (!n.Direk && !n.Eklendi) Dene(db, t => SimgeTasindi(t, db, n));
                    // 2) Bu komutta eklenen süsler (direkle birlikte kopyalananlar): bir kez okunur, sahibine göre gruplanır
                    var gruplar = new Dictionary<string, List<Aday>>(StringComparer.OrdinalIgnoreCase);
                    var hepsi = new List<Aday>();
                    using (var okuma = db.TransactionManager.StartTransaction())
                    {
                        foreach (var n in notlar)
                        {
                            if (n.Direk || !n.Eklendi) continue;
                            var a = Ac(okuma, n.Id, false);
                            if (a == null || a.OwnerId != ms) continue;
                            var aday = new Aday { Id = n.Id, Tur = Turu(a), Uygulama = n.Uygulama, Konum = ArmaturBagi.Konum(a), Sahip = ArmaturBagi.SimgeSahibi(a, n.Uygulama) ?? "" };
                            hepsi.Add(aday);
                            List<Aday> l;
                            if (!gruplar.TryGetValue(aday.Sahip, out l)) gruplar[aday.Sahip] = l = new List<Aday>();
                            l.Add(aday);
                        }
                        okuma.Commit();
                    }
                    // 3) Direkler: son durumlarına göre süsler taşınır, kopyalanır ya da silinir (her biri kendi işleminde)
                    foreach (var n in notlar)
                        if (n.Direk)
                            foreach (var u in ArmaturBagi.Uygulamalar)
                            {
                                string uyg = u;
                                Dene(db, t => DirekIsle(t, db, ms, n, uyg, gruplar, hepsi));
                            }
                }
                _hataSayisi = 0;
            }
            catch (System.Exception ex)
            {
                HataKaydi(ex);
                // Bütünüyle olmadıysa (ör. çizim kilitlenemedi) iki kez daha denenir
                if (++_hataSayisi <= 2)
                    lock (_kilit)
                    {
                        Dictionary<ObjectId, Not> k;
                        if (!_kuyruk.TryGetValue(db, out k)) _kuyruk[db] = k = new Dictionary<ObjectId, Not>();
                        foreach (var n in notlar) if (!k.ContainsKey(n.Id)) k[n.Id] = n;
                    }
            }
            finally { _calisiyor = false; }
        }

        /// <summary>Tek bir işi kendi işleminde yapar: yarıda kalırsa (kilitli katman vb.) hiçbiri yazılmaz, o iş atlanır.</summary>
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
            catch (System.Exception ex) { HataKaydi(ex); }
        }

        private static Entity Ac(Transaction tr, ObjectId id, bool silinmis)
        {
            try
            {
                if (id.IsNull || !id.IsValid) return null;
                var e = tr.GetObject(id, OpenMode.ForRead, silinmis) as Entity;
                return e is BlockReference || e is MText ? e : null;
            }
            catch { return null; }
        }

        private static Entity TaniticiylaAc(Transaction tr, Database db, string tanitici)
        {
            ObjectId id;
            return ArmaturBagi.Bul(db, tanitici, out id) ? Ac(tr, id, true) : null;
        }

        /// <summary>Süsün türü: blok tanımının kimliği ya da MTEXT (kopya sahiplenirken aynı tür aranır).</summary>
        private static string Turu(Entity e)
        {
            var br = e as BlockReference;
            return br != null ? br.BlockTableRecord.ToString() : "MTEXT";
        }

        private static void SimgeTasindi(Transaction t, Database db, Not n)
        {
            var s = Ac(t, n.Id, false);
            if (s == null) return;
            string uyg = n.Uygulama ?? ArmaturBagi.SusUygulamasi(s);
            if (uyg == null) return;
            var direk = TaniticiylaAc(t, db, ArmaturBagi.SimgeSahibi(s, uyg)) as BlockReference;
            if (direk == null || direk.IsErased) return;
            string simge;
            double dx, dy;
            bool konumlu;
            if (!ArmaturBagi.DirekVerisi(direk, out simge, out dx, out dy, out konumlu, uyg) || simge != s.Handle.ToString()) return;
            var k = ArmaturBagi.Konum(s);
            double ndx = k.X - direk.Position.X, ndy = k.Y - direk.Position.Y;
            if (konumlu && Math.Abs(ndx - dx) < 1e-6 && Math.Abs(ndy - dy) < 1e-6) return;
            ArmaturBagi.DirekVerisiYaz(direk, simge, ndx, ndy, uyg);
        }

        private static void DirekIsle(Transaction t, Database db, ObjectId ms, Not n, string uyg, Dictionary<string, List<Aday>> gruplar, List<Aday> hepsi)
        {
            var direk = Ac(t, n.Id, true) as BlockReference;
            if (direk == null || direk.IsErased)
            {
                // Direk silindi: yalnız kendi süsü (model alanında) silinir
                string sus;
                if (!n.Susler.TryGetValue(uyg, out sus)) return;
                var s = TaniticiylaAc(t, db, sus);
                if (s != null && !s.IsErased && s.OwnerId == ms && ArmaturBagi.SimgeSahibi(s, uyg) == n.Tanitici)
                {
                    if (!s.IsWriteEnabled) s.UpgradeOpen();
                    s.Erase();
                }
                return;
            }
            if (direk.OwnerId != ms) return; // blok tanımındaki nesnelere dokunulmaz
            string simge;
            double dx, dy;
            bool konumlu;
            if (!ArmaturBagi.DirekVerisi(direk, out simge, out dx, out dy, out konumlu, uyg)) return;
            string tanitici = direk.Handle.ToString();
            var mevcut = TaniticiylaAc(t, db, simge);
            string mevcutSahibi = mevcut != null ? ArmaturBagi.SimgeSahibi(mevcut, uyg) : null;
            if (mevcut != null && mevcutSahibi == tanitici)
            {
                if (!konumlu) return;
                if (mevcut.IsErased)
                {
                    // Süs silinmiş: yalnız direk de geri geldiyse süs de gelir; kullanıcı süsü kendisi sildiyse dokunulmaz
                    if (!n.GeriGeldi) return;
                    if (!mevcut.IsWriteEnabled) mevcut.UpgradeOpen();
                    mevcut.Erase(false);
                }
                var konum = new Point3d(direk.Position.X + dx, direk.Position.Y + dy, direk.Position.Z);
                if (ArmaturBagi.Konum(mevcut).DistanceTo(konum) > 1e-6)
                {
                    if (!mevcut.IsWriteEnabled) mevcut.UpgradeOpen();
                    ArmaturBagi.KonumYaz(mevcut, konum);
                }
                return;
            }
            // Süs bu direğin değil: kopya ya da yapıştırılmış direk. Bağlı nesne süs değilse (başka çizimden gelen
            // tanıtıcı) yok sayılır.
            if (mevcut != null && mevcutSahibi == null) mevcut = null;
            if (!konumlu) { dx = -5; dy = 3; }
            var hedef = new Point3d(direk.Position.X + dx, direk.Position.Y + dy, direk.Position.Z);
            // Bu komutta eklenen süslerden sahiplenilecek olan: önce asıl süsle aynı sahipten (birlikte kopyalanan) en
            // yakını; yoksa (başka çizimden yapıştırma) tam hedef yerdeki sahiplenilmemiş biri
            Aday aday = null;
            List<Aday> grup;
            string tur = mevcut != null ? Turu(mevcut) : null;
            if (mevcutSahibi != null && gruplar.TryGetValue(mevcutSahibi, out grup))
            {
                double enYakin = Math.Max(1.0, 3 * Math.Sqrt(dx * dx + dy * dy));
                foreach (var a in grup)
                {
                    if (a.Alindi || a.Uygulama != uyg || (tur != null && a.Tur != tur)) continue;
                    double u = a.Konum.DistanceTo(hedef);
                    if (u < enYakin) { enYakin = u; aday = a; }
                }
            }
            if (aday == null)
                foreach (var a in hepsi)
                    if (!a.Alindi && a.Uygulama == uyg && a.Konum.DistanceTo(hedef) < 1e-3) { aday = a; break; }
            if (!direk.IsWriteEnabled) direk.UpgradeOpen(); // kilitli katmanda burada durur, yarım iş kalmaz
            Entity yeni;
            if (aday != null)
            {
                yeni = Ac(t, aday.Id, false);
                if (yeni == null) return;
                aday.Alindi = true;
                var k = ArmaturBagi.Konum(yeni);
                dx = k.X - direk.Position.X;
                dy = k.Y - direk.Position.Y;
            }
            else
            {
                if (mevcut == null)
                {
                    // Kopyalanacak süs yok: bağ silinir (eklenti direği yeniden yazınca süsü yeniden çizer)
                    ArmaturBagi.DirekVerisiYaz(direk, null, 0, 0, uyg);
                    return;
                }
                if (mevcut.IsErased) return; // asıl süs silinmiş: kopyalanacak bir şey yok
                var alan = (BlockTableRecord)t.GetObject(ms, OpenMode.ForWrite);
                var mbr = mevcut as BlockReference;
                if (mbr != null)
                {
                    var ybr = new BlockReference(hedef, mbr.BlockTableRecord);
                    ybr.SetDatabaseDefaults(db);
                    ybr.LayerId = direk.LayerId;
                    ybr.Color = mbr.Color;
                    ybr.ScaleFactors = mbr.ScaleFactors;
                    yeni = ybr;
                }
                else
                {
                    var ymt = (MText)mevcut.Clone();
                    ymt.Location = hedef;
                    ymt.LayerId = direk.LayerId;
                    yeni = ymt;
                }
                alan.AppendEntity(yeni);
                t.AddNewlyCreatedDBObject(yeni, true);
            }
            ArmaturBagi.SahibiYaz(yeni, tanitici, uyg);
            if (uyg == NesneYazici.MalzemeYazisiUygulamasi) ArmaturBagi.SahipVerisiYaz(yeni, tanitici);
            ArmaturBagi.DirekVerisiYaz(direk, yeni.Handle.ToString(), dx, dy, uyg);
        }

        private static void HataKaydi(System.Exception ex)
        {
            try
            {
                System.IO.File.AppendAllText(System.IO.Path.Combine(System.IO.Path.GetTempPath(), "SebekeHakedis_hata.txt"),
                    DateTime.Now.ToString("s", CultureInfo.InvariantCulture) + " Süs takibi: " + ex + Environment.NewLine);
            }
            catch { }
        }
    }
}
