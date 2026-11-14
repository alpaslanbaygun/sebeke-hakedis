using System;
using System.Collections.Generic;
using System.Globalization;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

[assembly: CommandClass(typeof(SebekeHakedis.Eklenti.YaziKomutlari))]

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// SH_YAZIDUZEN (14.11.2026, saha isteği: "tek tuşla yazı ve simge çakışmalarını düzelt"). Simgeler (bloklar) yerinde
    /// kalır; üst üste binen yazılar boş bir yere taşınır: eleman / GPS noktası yazıları (görünen öznitelikler, birlikte)
    /// ve malzeme yazısı simgenin çevresinde, hat metrajı ve hat etiketi kendi parçası boyunca ya da çizginin öbür yanında.
    /// Kural Cekirdek/YaziCakisma.cs (telefondaki DXF dışa aktarımıyla ortak). Tek komut: bir U ile geri alınır. Yazılar
    /// elemanın / hattın yeniden yazılmasında (Malzeme, Telefon Görünümü) eski yerine döner; komut yeniden çalıştırılır.
    /// </summary>
    public sealed class YaziKomutlari
    {
        /// <summary>Yazı kutularının çevresine bırakılan boşluk (yazı yüksekliğine oran).</summary>
        private const double Bosluk = YaziCakisma.Bosluk;

        private sealed class Grup
        {
            public string Tur;                       // "eleman", "malzeme", "hat"
            public List<ObjectId> Yazilar = new List<ObjectId>();
            public ObjectId Sahip;                   // eleman bloğu (malzeme yazısının direği)
            public YaziCakisma.Kutu Kutu;
            public List<double[]> Adaylar;
            public string Ad;
        }

        [CommandMethod("SH_YAZIDUZEN", CommandFlags.Modal | CommandFlags.UsePickSet)]
        public void YaziDuzen()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Yazı çakışmaları", () =>
            {
                var o = Ortam.Hazirla(belge);
                var ed = o.Ed;
                // Kapsam: önceden seçilenler ya da Enter ile tüm çizim
                HashSet<ObjectId> kapsam = null;
                var onceden = ed.SelectImplied();
                if (onceden.Status == PromptStatus.OK && onceden.Value != null && onceden.Value.Count > 0) kapsam = new HashSet<ObjectId>(onceden.Value.GetObjectIds());
                else
                {
                    var pso = new PromptSelectionOptions { MessageForAdding = "\nYazıları düzenlenecek nesneleri seçin (Enter: tüm çizim): " };
                    var r = ed.GetSelection(pso);
                    if (r.Status == PromptStatus.OK && r.Value != null && r.Value.Count > 0) kapsam = new HashSet<ObjectId>(r.Value.GetObjectIds());
                    else if (r.Status != PromptStatus.Error && r.Status != PromptStatus.None) return; // Esc
                }

                var elemanlar = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var e in o.Proje.Elemanlar) elemanlar.Add(e.Id);
                foreach (var n in o.Proje.Noktalar) elemanlar.Add(n.Id);
                var hatlar = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var h in o.Proje.Hatlar) hatlar.Add(h.Id);
                foreach (var c in o.Proje.Kanallar) hatlar.Add(c.Id);
                foreach (var s in o.Proje.Sondajlar) hatlar.Add(s.Id);

                int tasinan = 0, cakisan, cozulemeyen;
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var ms = (BlockTableRecord)tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(o.Db), OpenMode.ForRead);
                    var engeller = new List<YaziCakisma.Kutu>();
                    var elemanGruplari = new List<Grup>();
                    var malzemeGruplari = new List<Grup>();
                    var hatGruplari = new List<Grup>();
                    var blokKutulari = new Dictionary<ObjectId, double[]>();
                    var cizgiler = new Dictionary<ObjectId, List<double[]>>();
                    foreach (ObjectId id in ms)
                    {
                        Entity ent;
                        try { ent = tr.GetObject(id, OpenMode.ForRead, false) as Entity; }
                        catch { continue; }
                        if (ent == null) continue;
                        string h = ent.Handle.ToString();
                        if (ent is BlockReference br)
                        {
                            // Simge (bloğun öznitelik dışı çizimi): engel
                            var sk = SimgeKutusu(tr, br, blokKutulari);
                            if (sk.HasValue) engeller.Add(sk.Value);
                            if (!elemanlar.Contains(h)) continue;
                            bool kapsamda = kapsam == null || kapsam.Contains(id);
                            // Eleman yazısı: görünen öznitelikler birlikte
                            var g = OznitelikGrubu(tr, br);
                            if (g != null)
                            {
                                if (kapsamda) { g.Ad = h; elemanGruplari.Add(g); }
                                else engeller.Add(g.Kutu);
                            }
                            // Malzeme yazısı (SH_MLZ ile direğe bağlı çok satırlı yazı)
                            string mh; double dx, dy; bool konumlu;
                            if (ArmaturBagi.DirekVerisi(br, out mh, out dx, out dy, out konumlu, NesneYazici.MalzemeYazisiUygulamasi))
                            {
                                ObjectId mid;
                                MText mt = null;
                                if (ArmaturBagi.Bul(o.Db, mh, out mid)) { try { mt = tr.GetObject(mid, OpenMode.ForRead, false) as MText; } catch { mt = null; } }
                                if (mt != null && !mt.IsErased)
                                {
                                    var mk = MetinKutusu(mt);
                                    if (mk.HasValue)
                                    {
                                        if (kapsamda) malzemeGruplari.Add(new Grup { Tur = "malzeme", Yazilar = { mid }, Sahip = id, Kutu = Genislet(mk.Value, mt.TextHeight), Adaylar = YaziCakisma.ElemanAdaylari(mk.Value, br.Position.X, br.Position.Y), Ad = h });
                                        else engeller.Add(mk.Value);
                                    }
                                }
                            }
                            continue;
                        }
                        if (ent is DBText t && !(ent is AttributeReference))
                        {
                            string sahip = CizimYazici.SahibiOku(t);
                            if (sahip == null || !hatlar.Contains(sahip)) continue;
                            var k = YaziKutusu(t);
                            ObjectId sid;
                            bool kapsamda = kapsam == null || kapsam.Contains(id) || (ArmaturBagi.Bul(o.Db, sahip, out sid) && kapsam.Contains(sid));
                            if (!kapsamda) { engeller.Add(k); continue; }
                            List<double[]> kose = null;
                            ObjectId cid;
                            if (ArmaturBagi.Bul(o.Db, sahip, out cid) && !cizgiler.TryGetValue(cid, out kose)) { kose = Koseler(tr, cid); cizgiler[cid] = kose; }
                            double[] a, b;
                            if (kose == null || !EnYakinParca(kose, k.X, k.Y, out a, out b)) { engeller.Add(k); continue; }
                            hatGruplari.Add(new Grup { Tur = "hat", Yazilar = { id }, Kutu = Genislet(k, t.Height), Adaylar = YaziCakisma.HatAdaylari(k, a, b), Ad = sahip });
                        }
                    }
                    // Öncelik: eleman yazıları, malzeme yazıları, hat yazıları (sonrakiler öncekilerden kaçar)
                    var gruplar = new List<Grup>();
                    gruplar.AddRange(elemanGruplari); gruplar.AddRange(malzemeGruplari); gruplar.AddRange(hatGruplari);
                    var etiketler = gruplar.ConvertAll(g => new YaziCakisma.Etiket { Kutu = g.Kutu, Adaylar = g.Adaylar, Bilgi = g });
                    var sonuc = YaziCakisma.Yerlestir(engeller, etiketler);
                    cakisan = sonuc.Cakisan; cozulemeyen = sonuc.Cozulemeyen;
                    for (int i = 0; i < gruplar.Count; i++)
                    {
                        int s = sonuc.Secim[i];
                        if (s <= 0) continue;
                        var g = gruplar[i];
                        var d = new Vector3d(g.Adaylar[s][0], g.Adaylar[s][1], 0);
                        try
                        {
                            foreach (var yid in g.Yazilar)
                            {
                                var y = (Entity)tr.GetObject(yid, OpenMode.ForWrite, false);
                                y.TransformBy(Matrix3d.Displacement(d));
                            }
                            // Malzeme yazısının yeni yeri direğe yazılır (direk taşınınca yazı da bu yerle gelir)
                            if (g.Tur == "malzeme" && !g.Sahip.IsNull)
                            {
                                var br = (BlockReference)tr.GetObject(g.Sahip, OpenMode.ForWrite, false);
                                var mt = (MText)tr.GetObject(g.Yazilar[0], OpenMode.ForRead, false);
                                ArmaturBagi.DirekVerisiYaz(br, mt.Handle.ToString(), mt.Location.X - br.Position.X, mt.Location.Y - br.Position.Y, NesneYazici.MalzemeYazisiUygulamasi);
                            }
                            tasinan++;
                        }
                        catch (System.Exception ex) { ed.WriteMessage("\n" + g.Ad + " yazısı taşınamadı (katmanı kilitli olabilir): " + ex.Message); }
                    }
                    tr.Commit();
                }
                ed.WriteMessage("\nYazı çakışmaları: " + cakisan + " çakışan yazı, " + tasinan + " yazı boş yere taşındı" +
                                (cozulemeyen > 0 ? "; " + cozulemeyen + " yazıya çakışmasız yer bulunamadı (yazı boyunu küçültün ya da elle taşıyın)" : "") +
                                ". Geri almak için: U.");
            });
        }

        // ---------------- Kutular ----------------

        private static YaziCakisma.Kutu Genislet(YaziCakisma.Kutu k, double yukseklik) => YaziCakisma.Genislet(k, yukseklik);

        /// <summary>Tek satırlı yazının dönük kutusu (harf genişlik tablosuyla; hizalama noktası ve kipine göre).</summary>
        internal static YaziCakisma.Kutu YaziKutusu(DBText t)
        {
            double w = YaziDuzeni.Genislik(t.TextString ?? "", t.Height, t.WidthFactor > 0 ? t.WidthFactor : 1), h = t.Height;
            bool sol = t.HorizontalMode == TextHorizontalMode.TextLeft && t.VerticalMode == TextVerticalMode.TextBase;
            var p = sol || t.HorizontalMode == TextHorizontalMode.TextAlign || t.HorizontalMode == TextHorizontalMode.TextFit ? t.Position : t.AlignmentPoint;
            double fx = t.HorizontalMode == TextHorizontalMode.TextCenter || t.HorizontalMode == TextHorizontalMode.TextMid ? 0.5 : t.HorizontalMode == TextHorizontalMode.TextRight ? 1 : 0;
            double fy = t.HorizontalMode == TextHorizontalMode.TextMid || t.VerticalMode == TextVerticalMode.TextVerticalMid ? -0.5 : t.VerticalMode == TextVerticalMode.TextTop ? -1 : 0;
            double c = Math.Cos(t.Rotation), s = Math.Sin(t.Rotation);
            double ox = w * (0.5 - fx), oy = h * (0.5 + fy);
            return new YaziCakisma.Kutu(p.X + ox * c - oy * s, p.Y + ox * s + oy * c, w, h, t.Rotation);
        }

        /// <summary>Çok satırlı yazının dönük kutusu (AutoCAD'in sınır noktalarından).</summary>
        private static YaziCakisma.Kutu? MetinKutusu(MText mt)
        {
            try
            {
                var pts = mt.GetBoundingPoints();
                if (pts == null || pts.Count < 4) return null;
                var l = new List<double[]>();
                foreach (Point3d p in pts) l.Add(new[] { p.X, p.Y });
                return DonukKutu(l, mt.Rotation);
            }
            catch { return null; }
        }

        /// <summary>Noktaları aci yönündeki eksenlerde saran kutu.</summary>
        private static YaziCakisma.Kutu? DonukKutu(List<double[]> noktalar, double aci)
        {
            if (noktalar.Count == 0) return null;
            double c = Math.Cos(aci), s = Math.Sin(aci);
            double u0 = double.MaxValue, u1 = double.MinValue, v0 = double.MaxValue, v1 = double.MinValue;
            foreach (var p in noktalar)
            {
                double u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c;
                u0 = Math.Min(u0, u); u1 = Math.Max(u1, u); v0 = Math.Min(v0, v); v1 = Math.Max(v1, v);
            }
            double um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
            return new YaziCakisma.Kutu(um * c - vm * s, um * s + vm * c, u1 - u0, v1 - v0, aci);
        }

        /// <summary>Eleman / GPS noktası bloğunun görünen öznitelikleri tek kutu; adaylar simgenin çevresinde.</summary>
        private static Grup OznitelikGrubu(Transaction tr, BlockReference br)
        {
            var g = new Grup { Tur = "eleman" };
            var noktalar = new List<double[]>();
            double hMax = 0;
            foreach (ObjectId aid in br.AttributeCollection)
            {
                AttributeReference ar;
                try { ar = tr.GetObject(aid, OpenMode.ForRead, false) as AttributeReference; }
                catch { continue; }
                if (ar == null || ar.Invisible || ar.IsMTextAttribute || string.IsNullOrWhiteSpace(ar.TextString)) continue;
                var k = YaziKutusu(ar);
                noktalar.AddRange(Koseleri(k));
                hMax = Math.Max(hMax, ar.Height);
                g.Yazilar.Add(aid);
            }
            if (g.Yazilar.Count == 0) return null;
            var kk = DonukKutu(noktalar, br.Rotation);
            if (!kk.HasValue) return null;
            g.Kutu = Genislet(kk.Value, hMax);
            g.Adaylar = YaziCakisma.ElemanAdaylari(kk.Value, br.Position.X, br.Position.Y);
            return g;
        }

        private static IEnumerable<double[]> Koseleri(YaziCakisma.Kutu k)
        {
            double c = Math.Cos(k.Aci), s = Math.Sin(k.Aci);
            foreach (var d in new[] { new[] { -1, -1 }, new[] { 1, -1 }, new[] { 1, 1 }, new[] { -1, 1 } })
            {
                double u = d[0] * k.W / 2, v = d[1] * k.H / 2;
                yield return new[] { k.X + u * c - v * s, k.Y + u * s + v * c };
            }
        }

        /// <summary>Bloğun öznitelik ve yazı tanımı dışındaki çiziminin dönük kutusu (blok tanımı başına önbellekli).</summary>
        private static YaziCakisma.Kutu? SimgeKutusu(Transaction tr, BlockReference br, Dictionary<ObjectId, double[]> onbellek)
        {
            double[] e;
            if (!onbellek.TryGetValue(br.BlockTableRecord, out e))
            {
                e = null;
                try
                {
                    var btr = (BlockTableRecord)tr.GetObject(br.BlockTableRecord, OpenMode.ForRead, false);
                    if (!btr.IsLayout && !btr.IsFromExternalReference)
                        foreach (ObjectId id in btr)
                        {
                            var x = tr.GetObject(id, OpenMode.ForRead, false) as Entity;
                            if (x == null || x is AttributeDefinition) continue;
                            Extents3d ex;
                            try { ex = x.GeometricExtents; } catch { continue; }
                            if (e == null) e = new[] { ex.MinPoint.X, ex.MinPoint.Y, ex.MaxPoint.X, ex.MaxPoint.Y };
                            else { e[0] = Math.Min(e[0], ex.MinPoint.X); e[1] = Math.Min(e[1], ex.MinPoint.Y); e[2] = Math.Max(e[2], ex.MaxPoint.X); e[3] = Math.Max(e[3], ex.MaxPoint.Y); }
                        }
                }
                catch { e = null; }
                onbellek[br.BlockTableRecord] = e;
            }
            if (e == null) return null;
            // Bloğun çizimi büyük bir alan kaplıyorsa (çerçeve, pafta) engel sayılmaz
            double sx = Math.Abs(br.ScaleFactors.X), sy = Math.Abs(br.ScaleFactors.Y);
            double w = (e[2] - e[0]) * sx, h = (e[3] - e[1]) * sy;
            if (!(w > 0 || h > 0) || w > 50 || h > 50) return null;
            var m = new Point3d((e[0] + e[2]) / 2, (e[1] + e[3]) / 2, 0).TransformBy(br.BlockTransform);
            return new YaziCakisma.Kutu(m.X, m.Y, Math.Max(w, 1e-3), Math.Max(h, 1e-3), br.Rotation);
        }

        /// <summary>Çoklu çizginin köşeleri (2B).</summary>
        private static List<double[]> Koseler(Transaction tr, ObjectId id)
        {
            try
            {
                var ent = tr.GetObject(id, OpenMode.ForRead, false);
                var l = new List<double[]>();
                if (ent is Polyline pl) { for (int i = 0; i < pl.NumberOfVertices; i++) { var p = pl.GetPoint2dAt(i); l.Add(new[] { p.X, p.Y }); } return l; }
                if (ent is Polyline2d p2) { foreach (ObjectId v in p2) { var x = tr.GetObject(v, OpenMode.ForRead, false) as Vertex2d; if (x != null && x.VertexType != Vertex2dType.SplineControlVertex) l.Add(new[] { x.Position.X, x.Position.Y }); } return l; }
                if (ent is Polyline3d p3) { foreach (ObjectId v in p3) { var x = tr.GetObject(v, OpenMode.ForRead, false) as PolylineVertex3d; if (x != null && x.VertexType != Vertex3dType.ControlVertex) l.Add(new[] { x.Position.X, x.Position.Y }); } return l; }
                if (ent is Line ln) return new List<double[]> { new[] { ln.StartPoint.X, ln.StartPoint.Y }, new[] { ln.EndPoint.X, ln.EndPoint.Y } };
            }
            catch { }
            return null;
        }

        /// <summary>Noktaya en yakın parça.</summary>
        private static bool EnYakinParca(List<double[]> kose, double x, double y, out double[] a, out double[] b)
        {
            a = b = null;
            double en = double.MaxValue;
            for (int i = 0; i + 1 < kose.Count; i++)
            {
                double[] p = kose[i], q = kose[i + 1];
                double dx = q[0] - p[0], dy = q[1] - p[1], L2 = dx * dx + dy * dy;
                if (L2 < 1e-12) continue;
                double t = Math.Max(0, Math.Min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / L2));
                double ex = p[0] + t * dx - x, ey = p[1] + t * dy - y, d = ex * ex + ey * ey;
                if (d < en) { en = d; a = p; b = q; }
            }
            return a != null;
        }
    }
}
