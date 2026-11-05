using System;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Kanal listesini çizime tablo olarak koyar (KanalTablosu düzeni): SH_KANAL_LISTESI bloğu, çizgiler ve yazılar,
    /// yazılar çizimin yazı stilinde (Tahoma), renk bloktan. Tablo yeniden konunca blok tanımı yenilenir; çizimdeki tablo
    /// yerinde kalır, yeni yer sorulmaz. AutoCAD'in tablo nesnesi kullanılmaz: DWG 2000 biçiminde de aynen kalır.
    /// </summary>
    internal static class KanalTablosuYazici
    {
        public const string BlokAdi = "SH_KANAL_LISTESI";

        /// <summary>Tabloyu koyar ya da yeniler; konan / yenilenen satır sayısını yazar.</summary>
        public static void Koy(Ortam o, KanalListesi liste, string baslik = null)
        {
            var ed = o.Ed;
            if (liste.Satirlar.Count == 0) { ed.WriteMessage("\nListede kanal yok; tablo konmadı."); return; }
            double h = o.Ayar.EtiketYuksekligi > 0 ? o.Ayar.EtiketYuksekligi : 1.8;
            var t = new KanalTablosu(liste, h, baslik);

            bool vardi = false;
            using (var tr = o.Db.TransactionManager.StartOpenCloseTransaction())
            {
                var bt = (BlockTable)tr.GetObject(o.Db.BlockTableId, OpenMode.ForRead);
                if (bt.Has(BlokAdi))
                {
                    var btr = (BlockTableRecord)tr.GetObject(bt[BlokAdi], OpenMode.ForRead);
                    foreach (ObjectId id in btr.GetBlockReferenceIds(true, false))
                    {
                        var br = tr.GetObject(id, OpenMode.ForRead, false) as BlockReference;
                        if (br != null && !br.IsErased) { vardi = true; break; }
                    }
                }
                tr.Commit();
            }

            Point3d yer = Point3d.Origin;
            if (!vardi)
            {
                var po = new PromptPointOptions("\nKanal tablosunun sol üst köşesi: ");
                var r = ed.GetPoint(po);
                if (r.Status != PromptStatus.OK) return;
                yer = r.Value;
            }

            using (var tr = o.Db.TransactionManager.StartTransaction())
            {
                var y = new CizimYazici(o.Db, tr);
                var stil = y.YaziStili();
                var bt = (BlockTable)tr.GetObject(o.Db.BlockTableId, OpenMode.ForRead);
                BlockTableRecord btr;
                if (bt.Has(BlokAdi))
                {
                    btr = (BlockTableRecord)tr.GetObject(bt[BlokAdi], OpenMode.ForWrite);
                    foreach (ObjectId id in btr)
                    {
                        var e = tr.GetObject(id, OpenMode.ForWrite, false);
                        if (!e.IsErased) e.Erase();
                    }
                }
                else
                {
                    if (!bt.IsWriteEnabled) bt.UpgradeOpen();
                    btr = new BlockTableRecord { Name = BlokAdi, Origin = Point3d.Origin };
                    bt.Add(btr);
                    tr.AddNewlyCreatedDBObject(btr, true);
                }
                btr.Comments = "Şebeke-M kanal listesi (Kanal Listesi komutuyla yenilenir)";
                foreach (var c in t.Cizgiler)
                {
                    var l = new Line(new Point3d(c.X1, c.Y1, 0), new Point3d(c.X2, c.Y2, 0));
                    l.SetDatabaseDefaults(o.Db);
                    l.Layer = "0";
                    l.ColorIndex = 0; // bloktan
                    btr.AppendEntity(l);
                    tr.AddNewlyCreatedDBObject(l, true);
                }
                foreach (var a in t.Yazilar)
                {
                    var d = new DBText();
                    d.SetDatabaseDefaults(o.Db);
                    d.Layer = "0";
                    d.ColorIndex = 0;
                    d.TextStyleId = stil;
                    d.Height = a.H;
                    d.TextString = a.Metin;
                    d.Position = new Point3d(a.X, a.Y, 0);
                    if (a.Sag)
                    {
                        d.HorizontalMode = TextHorizontalMode.TextRight;
                        d.VerticalMode = TextVerticalMode.TextBase;
                        d.AlignmentPoint = new Point3d(a.X, a.Y, 0);
                    }
                    btr.AppendEntity(d);
                    tr.AddNewlyCreatedDBObject(d, true);
                    if (a.Sag) try { d.AdjustAlignment(o.Db); } catch { }
                }
                if (vardi)
                {
                    foreach (ObjectId id in btr.GetBlockReferenceIds(true, false))
                    {
                        var br = tr.GetObject(id, OpenMode.ForWrite, false) as BlockReference;
                        if (br != null && !br.IsErased) br.RecordGraphicsModified(true);
                    }
                }
                else
                {
                    var ms = (BlockTableRecord)tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(o.Db), OpenMode.ForWrite);
                    var br = new BlockReference(yer, btr.ObjectId);
                    br.SetDatabaseDefaults(o.Db);
                    br.LayerId = y.Katman(KatmanAdlari.Ascii(o.OnEk + "_KANAL_LISTESI"));
                    ms.AppendEntity(br);
                    tr.AddNewlyCreatedDBObject(br, true);
                }
                tr.Commit();
            }
            if (vardi) ed.Regen();
            ed.WriteMessage("\nKanal tablosu " + (vardi ? "yenilendi" : "kondu") + ": " + liste.Satirlar.Count + " kanal, " + (liste.Projeler.Count - 1) +
                            " proje (" + KanalTablosu.Sayi(liste.Projeler[liste.Projeler.Count - 1].Uzunluk, 2) + " m, " +
                            KanalTablosu.Sayi(liste.Projeler[liste.Projeler.Count - 1].Hacim, 3) + " m³). Yeniden yazmak için: Kanal Listesi (SH_KANALLISTESI).");
        }
    }
}
