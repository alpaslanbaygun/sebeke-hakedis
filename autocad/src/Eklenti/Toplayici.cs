using System;
using System.Collections.Generic;
using System.Globalization;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Açık çizimin model alanındaki nesneleri çekirdeğin anladığı yalın biçime (CadVarlik) çevirir.
    /// Yalnız okuma yapar; çizimde hiçbir şeyi değiştirmez.
    /// </summary>
    internal static class Toplayici
    {
        public static List<CadVarlik> Topla(Database db)
        {
            var liste = new List<CadVarlik>();
            var etiketler = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var tr = db.TransactionManager.StartOpenCloseTransaction())
            {
                var bt = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
                var ms = (BlockTableRecord)tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForRead);
                foreach (ObjectId id in ms)
                {
                    Entity ent;
                    try { ent = tr.GetObject(id, OpenMode.ForRead, false) as Entity; }
                    catch { continue; }
                    if (ent == null) continue;

                    var xd = XdataOku(ent);
                    if (xd.Count == 0) continue; // AutoCAD nesneleri her zaman genişletilmiş veri taşır
                    if (xd.Count == 1 && xd.ContainsKey(NesneYazici.ArmaturUygulamasi)) continue; // direğin armatür simgesi (süs)

                    var v = Cevir(ent, tr);
                    if (v == null) continue;
                    v.Xd = xd;
                    liste.Add(v);

                    List<string> etk;
                    if (xd.TryGetValue("ETK", out etk)) foreach (var h in etk) if (!string.IsNullOrEmpty(h)) etiketler.Add(h);
                }

                // Hat etiketleri (ETK ile bağlı yazılar) ayrıca alınır
                foreach (var h in etiketler)
                {
                    ObjectId id;
                    if (!TaniticiylaBul(db, h, out id)) continue;
                    Entity ent;
                    try { ent = tr.GetObject(id, OpenMode.ForRead, false) as Entity; }
                    catch { continue; }
                    var v = ent == null ? null : Cevir(ent, tr);
                    if (v != null) liste.Add(v);
                }
                tr.Commit();
            }
            return liste;
        }

        /// <summary>Tek bir nesneyi (genişletilmiş verisiyle) çevirir; hat ise etiket yazısı da eklenir.</summary>
        internal static List<CadVarlik> Tek(Transaction tr, Entity ent)
        {
            var l = new List<CadVarlik>();
            var v = Cevir(ent, tr);
            if (v == null) return l;
            v.Xd = XdataOku(ent);
            l.Add(v);
            List<string> etk;
            if (v.Xd.TryGetValue("ETK", out etk) && etk.Count > 0)
            {
                ObjectId id;
                if (TaniticiylaBul(ent.Database, etk[0], out id))
                {
                    var t = tr.GetObject(id, OpenMode.ForRead, false) as Entity;
                    var tv = t == null ? null : Cevir(t, tr);
                    if (tv != null) l.Add(tv);
                }
            }
            return l;
        }

        internal static CadVarlik Cevir(Entity ent, Transaction tr)
        {
            var v = new CadVarlik { H = ent.Handle.ToString(), Katman = ent.Layer };

            if (ent is BlockReference br)
            {
                v.Tur = "INSERT";
                v.X = br.Position.X; v.Y = br.Position.Y; v.Z = br.Position.Z;
                v.Aci = br.Rotation;
                v.Olcek = br.ScaleFactors.X;
                v.Blok = BlokAdi(br, tr);
                foreach (ObjectId aid in br.AttributeCollection)
                {
                    AttributeReference ar;
                    try { ar = tr.GetObject(aid, OpenMode.ForRead, false) as AttributeReference; }
                    catch { continue; }
                    if (ar != null && !string.IsNullOrEmpty(ar.Tag) && !v.Oz.ContainsKey(ar.Tag)) v.Oz[ar.Tag] = ar.TextString ?? "";
                }
                return v;
            }
            if (ent is Polyline pl)
            {
                v.Tur = "LWPOLYLINE";
                v.Kapali = pl.Closed;
                for (int i = 0; i < pl.NumberOfVertices; i++)
                {
                    Point2d p = pl.GetPoint2dAt(i);
                    v.Kose.Add(new[] { p.X, p.Y });
                }
                return v;
            }
            if (ent is Polyline2d p2)
            {
                v.Tur = "POLYLINE";
                v.Kapali = p2.Closed;
                foreach (ObjectId vid in p2)
                {
                    Vertex2d vx;
                    try { vx = tr.GetObject(vid, OpenMode.ForRead, false) as Vertex2d; }
                    catch { continue; }
                    if (vx == null || vx.VertexType == Vertex2dType.SplineControlVertex) continue;
                    v.Kose.Add(new[] { vx.Position.X, vx.Position.Y });
                }
                return v;
            }
            if (ent is Polyline3d p3)
            {
                v.Tur = "POLYLINE";
                v.Kapali = p3.Closed;
                foreach (ObjectId vid in p3)
                {
                    PolylineVertex3d vx;
                    try { vx = tr.GetObject(vid, OpenMode.ForRead, false) as PolylineVertex3d; }
                    catch { continue; }
                    if (vx == null || vx.VertexType == Vertex3dType.ControlVertex) continue;
                    v.Kose.Add(new[] { vx.Position.X, vx.Position.Y });
                }
                return v;
            }
            if (ent is DBText t)
            {
                v.Tur = "TEXT";
                v.X = t.Position.X; v.Y = t.Position.Y;
                v.Metin = t.TextString ?? "";
                return v;
            }
            if (ent is MText mt)
            {
                v.Tur = "MTEXT";
                v.X = mt.Location.X; v.Y = mt.Location.Y;
                v.Metin = mt.Text ?? "";
                return v;
            }
            return null;
        }

        internal static string BlokAdi(BlockReference br, Transaction tr)
        {
            try
            {
                var id = br.IsDynamicBlock ? br.DynamicBlockTableRecord : br.BlockTableRecord;
                var btr = tr.GetObject(id, OpenMode.ForRead, false) as BlockTableRecord;
                return btr != null ? btr.Name : br.Name;
            }
            catch { return br.Name; }
        }

        /// <summary>
        /// Nesnenin genişletilmiş verisi: uygulama adı → değerler. Değeri olmayan ya da yalnız boş dizgilerden oluşan
        /// bölüm (eski değeri silmek için yazılan iz) yok sayılır; ham=true ile olduğu gibi döner (denetim için).
        /// </summary>
        public static Dictionary<string, List<string>> XdataOku(DBObject o, bool ham = false)
        {
            var d = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            ResultBuffer rb = o.XData;
            if (rb == null) return d;
            using (rb)
            {
                List<string> mevcut = null;
                foreach (TypedValue tv in rb)
                {
                    if (tv.TypeCode == (short)DxfCode.ExtendedDataRegAppName)
                    {
                        string ad = Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "";
                        if (!d.TryGetValue(ad, out mevcut)) d[ad] = mevcut = new List<string>();
                        continue;
                    }
                    if (mevcut == null) continue;
                    mevcut.Add(Convert.ToString(tv.Value, CultureInfo.InvariantCulture) ?? "");
                }
            }
            if (!ham)
            {
                var bos = new List<string>();
                foreach (var kv in d) if (kv.Value.TrueForAll(string.IsNullOrEmpty)) bos.Add(kv.Key);
                foreach (var k in bos) d.Remove(k);
            }
            return d;
        }

        /// <summary>
        /// Uygulamaların genişletilmiş verisini nesneden siler. Önce AutoCAD'in belgelenmiş yolu denenir (yalnız uygulama
        /// adı yazılır; eski program da veriyi böyle görmez olur). AutoCAD bölümü silmeyip değersiz bırakırsa (yeni
        /// nesnelerde böyle davrandığı görüldü) tek boş dizgi yazılır: değersiz bölüm DWG'de sıfır uzunluklu kaydedilir,
        /// okuyucu bunu verinin sonu sayar ve nesne açılışta atılır (canlı denemede 72 nesne kayboldu).
        /// </summary>
        internal static void XdataSil(DBObject o, IList<string> uygulamalar)
        {
            if (o == null || uygulamalar == null || uygulamalar.Count == 0) return;
            if (!o.IsWriteEnabled) o.UpgradeOpen();
            using (var rb = new ResultBuffer())
            {
                foreach (var u in uygulamalar) rb.Add(new TypedValue((int)DxfCode.ExtendedDataRegAppName, u));
                o.XData = rb;
            }
            var ham = XdataOku(o, true);
            var kalan = new List<string>();
            foreach (var u in uygulamalar)
            {
                List<string> l;
                if (ham.TryGetValue(u, out l) && l.Count == 0) kalan.Add(u);
            }
            if (kalan.Count == 0) return;
            using (var rb = new ResultBuffer())
            {
                foreach (var u in kalan)
                {
                    rb.Add(new TypedValue((int)DxfCode.ExtendedDataRegAppName, u));
                    rb.Add(new TypedValue((int)DxfCode.ExtendedDataAsciiString, ""));
                }
                o.XData = rb;
            }
        }

        internal static bool TaniticiylaBul(Database db, string hex, out ObjectId id)
        {
            id = ObjectId.Null;
            long n;
            if (!long.TryParse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out n)) return false;
            try
            {
                id = db.GetObjectId(false, new Handle(n), 0);
                return !id.IsNull && !id.IsErased;
            }
            catch { return false; }
        }
    }
}
