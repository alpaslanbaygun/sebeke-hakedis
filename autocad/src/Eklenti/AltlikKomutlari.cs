using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

[assembly: CommandClass(typeof(SebekeHakedis.Eklenti.AltlikKomutlari))]

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Harita altlığı (SH_ALTLIK): seçilen sağlayıcının karoları kullanıcının anahtarıyla indirilir, birleştirilir, çizimin
    /// koordinatına (ITRF96 3° TM) çevrilir ve resim olarak çizime konur (ALTLIK katmanı, en altta). Resim çizimin yanındaki
    /// "Altlik" klasörüne kaydedilir; altına sağlayıcının atıf yazısı yazılır.
    /// </summary>
    public sealed class AltlikKomutlari
    {
        private const string Katman = "ALTLIK";

        internal static string AyarYolu => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SebekeHakedis", "altlik.json");

        [CommandMethod("SH_ALTLIK", CommandFlags.Modal | CommandFlags.Redraw)]
        public void Altlik()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Harita altlığı", () =>
            {
                var o = Ortam.Hazirla(belge);
                int dom = CbsKomutlari.DilimIste(o, "Harita altlığı");
                if (dom == 0) return;
                var ayar = AltlikAyari.Oku(AyarYolu);
                if (!Pencereler.HaritaAltligiSec(ayar)) return;
                try { ayar.Kaydet(AyarYolu); } catch (System.Exception ex) { Uygulama.Yaz("Altlık ayarı kaydedilemedi: " + ex.Message); }
                var s = HaritaAltligi.Bul(ayar.Saglayici);
                if (s == null) return;
                string anahtar = s.Anahtar.Length > 0 ? ayar.Anahtar(s.Anahtar) : "";

                double e0, n0, e1, n1;
                if (!AlanBul(o, ayar.Alan, out e0, out n0, out e1, out n1)) return;
                if (!Koordinat.TmDilimindeMi(e0, n0) || !Koordinat.TmDilimindeMi(e1, n1))
                {
                    Pencereler.Uyar("Seçilen alan 3° TM dilimine uymuyor (çizim yerel ya da kaydırılmış koordinatla çizilmiş olabilir). Harita altlığı yalnız gerçek koordinatlı çizimde doğru yere oturur.");
                    return;
                }
                var plan = HaritaAltligi.Planla(e0, n0, e1, n1, dom, s, AltlikAyari.Cozunurluk(ayar.Kalite));
                var ed = belge.Editor;
                ed.WriteMessage("\n" + s.Ad + ": " + plan.KaroSayisi + " karo (zoom " + plan.Z + "), resim " + plan.Genislik + " × " + plan.Yukseklik +
                                " piksel, piksel boyu " + plan.Cozunurluk.ToString("0.00", CultureInfo.GetCultureInfo("tr-TR")) + " m. İndiriliyor (vazgeçmek için Esc)...");

                string hata;
                var karolar = KaroIndirici.Indir(s, anahtar, plan, out hata);
                if (karolar == null) { if (hata != null) Pencereler.Uyar(hata); return; }
                if (hata != null) ed.WriteMessage("\nUyarı: " + hata);

                string yol;
                try
                {
                    int karoBoyu;
                    var moz = Mozaik(plan, karolar, out karoBoyu);
                    karolar = null;
                    var cikti = HaritaAltligi.Donustur(plan, moz, (plan.X1 - plan.X0 + 1) * karoBoyu, (plan.Y1 - plan.Y0 + 1) * karoBoyu, karoBoyu, dom);
                    moz = null;
                    yol = ResimKaydet(belge, s, plan, cikti);
                }
                catch (OutOfMemoryException)
                {
                    Pencereler.Uyar("Resim bellek için çok büyük. Daha küçük bir alan seçin ya da ayrıntıyı \"Düşük\" yapın.");
                    return;
                }

                using (belge.LockDocument())
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    if (ayar.EskileriSil) EskileriSil(o.Db, tr);
                    ResimKoy(o.Db, tr, yol, plan, s);
                    tr.Commit();
                }
                Uygulama.Yaz("Harita altlığı kondu: " + s.Ad + " (" + plan.Genislik + " × " + plan.Yukseklik + " piksel) → " + yol);
            });
        }

        // ---------------- Alan ----------------

        /// <summary>Altlığın alanı (çizim koordinatı): şebekenin çevresi (%8 pay), ekranda görünen alan ya da pencere.</summary>
        private static bool AlanBul(Ortam o, int alan, out double e0, out double n0, out double e1, out double n1)
        {
            e0 = n0 = double.MaxValue; e1 = n1 = double.MinValue;
            var ed = o.Ed;
            if (alan == 1)
            {
                using (var view = ed.GetCurrentView())
                {
                    var donusum = Matrix3d.PlaneToWorld(view.ViewDirection);
                    donusum = Matrix3d.Displacement(view.Target - Point3d.Origin) * donusum;
                    donusum = Matrix3d.Rotation(-view.ViewTwist, view.ViewDirection, view.Target) * donusum;
                    double cx = view.CenterPoint.X, cy = view.CenterPoint.Y, w = view.Width / 2, h = view.Height / 2;
                    foreach (var k in new[] { new Point3d(cx - w, cy - h, 0), new Point3d(cx + w, cy - h, 0), new Point3d(cx + w, cy + h, 0), new Point3d(cx - w, cy + h, 0) })
                    {
                        var p = k.TransformBy(donusum);
                        Genislet(p.X, p.Y, ref e0, ref n0, ref e1, ref n1);
                    }
                }
                return true;
            }
            if (alan == 2)
            {
                var p1 = ed.GetPoint("\nAltlık alanının ilk köşesi: ");
                if (p1.Status != PromptStatus.OK) return false;
                var p2 = ed.GetCorner("\nKarşı köşe: ", p1.Value);
                if (p2.Status != PromptStatus.OK) return false;
                var ucs = ed.CurrentUserCoordinateSystem;
                var a = p1.Value.TransformBy(ucs);
                var b = p2.Value.TransformBy(ucs);
                Genislet(a.X, a.Y, ref e0, ref n0, ref e1, ref n1);
                Genislet(b.X, b.Y, ref e0, ref n0, ref e1, ref n1);
                Genislet(a.X, b.Y, ref e0, ref n0, ref e1, ref n1);
                Genislet(b.X, a.Y, ref e0, ref n0, ref e1, ref n1);
                return e1 - e0 > 1 && n1 - n0 > 1;
            }
            // Şebekenin bulunduğu alan: elemanlar, hat / kanal / sondaj köşeleri, bölge sınırları, GPS noktaları
            var p_ = o.Proje;
            foreach (var e in p_.Elemanlar) Genislet(e.Saga, e.Yukari, ref e0, ref n0, ref e1, ref n1);
            foreach (var h in p_.Hatlar) foreach (var k in h.Kose) Genislet(k[0], k[1], ref e0, ref n0, ref e1, ref n1);
            foreach (var c in p_.Kanallar) foreach (var k in c.Kose) Genislet(k[0], k[1], ref e0, ref n0, ref e1, ref n1);
            foreach (var s in p_.Sondajlar) foreach (var k in s.Kose) Genislet(k[0], k[1], ref e0, ref n0, ref e1, ref n1);
            foreach (var b in p_.Bolgeler) foreach (var k in b.Sinir) Genislet(k[0], k[1], ref e0, ref n0, ref e1, ref n1);
            foreach (var t in p_.Noktalar) Genislet(t.Saga, t.Yukari, ref e0, ref n0, ref e1, ref n1);
            if (e0 > e1)
            {
                Pencereler.Uyar("Çizimde şebeke nesnesi yok. \"Ekranda görünen alan\" ya da \"Pencereyle seç\" ile alanı gösterin.");
                return false;
            }
            double pay = Math.Max(30, 0.08 * Math.Max(e1 - e0, n1 - n0));
            e0 -= pay; n0 -= pay; e1 += pay; n1 += pay;
            return true;
        }

        private static void Genislet(double x, double y, ref double e0, ref double n0, ref double e1, ref double n1)
        {
            if (double.IsNaN(x) || double.IsNaN(y)) return;
            e0 = Math.Min(e0, x); n0 = Math.Min(n0, y); e1 = Math.Max(e1, x); n1 = Math.Max(n1, y);
        }

        // ---------------- Resim ----------------

        /// <summary>Karoları tek mozaikte birleştirir (ARGB). Gelmeyen karolar açık gri.</summary>
        private static int[] Mozaik(HaritaAltligi.Plan p, Dictionary<long, byte[]> karolar, out int karoBoyu)
        {
            karoBoyu = 256;
            // Karo boyu ilk çözülen karodan (256 ya da 512)
            foreach (var kv in karolar)
            {
                try
                {
                    using (var ms = new MemoryStream(kv.Value))
                    using (var b = new Bitmap(ms)) { karoBoyu = b.Width; break; }
                }
                catch { }
            }
            int sutun = p.X1 - p.X0 + 1, satir = p.Y1 - p.Y0 + 1, w = sutun * karoBoyu, h = satir * karoBoyu;
            var moz = new int[w * h];
            for (int i = 0; i < moz.Length; i++) moz[i] = unchecked((int)0xFFE5E7EB);
            var satirBuf = new int[karoBoyu];
            foreach (var kv in karolar)
            {
                int x = (int)(kv.Key >> 32) - p.X0, y = (int)(kv.Key & 0xFFFFFFFF) - p.Y0;
                try
                {
                    using (var ms = new MemoryStream(kv.Value))
                    using (var kaynak = new Bitmap(ms))
                    using (var b = new Bitmap(karoBoyu, karoBoyu, PixelFormat.Format32bppArgb))
                    {
                        using (var g = Graphics.FromImage(b))
                        {
                            g.Clear(Color.FromArgb(255, 0xE5, 0xE7, 0xEB));
                            g.DrawImage(kaynak, new Rectangle(0, 0, karoBoyu, karoBoyu));
                        }
                        var veri = b.LockBits(new Rectangle(0, 0, karoBoyu, karoBoyu), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                        try
                        {
                            for (int r = 0; r < karoBoyu; r++)
                            {
                                Marshal.Copy(IntPtr.Add(veri.Scan0, r * veri.Stride), satirBuf, 0, karoBoyu);
                                Array.Copy(satirBuf, 0, moz, (y * karoBoyu + r) * w + x * karoBoyu, karoBoyu);
                            }
                        }
                        finally { b.UnlockBits(veri); }
                    }
                }
                catch { /* bozuk karo: gri kalır */ }
            }
            return moz;
        }

        /// <summary>Çıktıyı çizimin yanındaki Altlik klasörüne yazar (uydu JPEG, harita PNG); yolu döner.</summary>
        private static string ResimKaydet(Document belge, AltlikSaglayici s, HaritaAltligi.Plan p, int[] cikti)
        {
            string klasor = Path.Combine(Komutlar.Klasor(belge), "Altlik");
            Directory.CreateDirectory(klasor);
            string ad = Komutlar.Ad(belge) + "_" + s.Id + "_" + DateTime.Now.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture) + (s.Uydu ? ".jpg" : ".png");
            string yol = Path.Combine(klasor, ad);
            if (s.Uydu) for (int i = 0; i < cikti.Length; i++) if (cikti[i] == 0) cikti[i] = -1; // saydam → beyaz (JPEG'de saydamlık yok)
            using (var b = new Bitmap(p.Genislik, p.Yukseklik, PixelFormat.Format32bppArgb))
            {
                var veri = b.LockBits(new Rectangle(0, 0, p.Genislik, p.Yukseklik), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                try
                {
                    for (int r = 0; r < p.Yukseklik; r++)
                        Marshal.Copy(cikti, r * p.Genislik, IntPtr.Add(veri.Scan0, r * veri.Stride), p.Genislik);
                }
                finally { b.UnlockBits(veri); }
                if (s.Uydu)
                {
                    ImageCodecInfo jpeg = Array.Find(ImageCodecInfo.GetImageEncoders(), c => c.MimeType == "image/jpeg");
                    using (var ep = new EncoderParameters(1))
                    {
                        ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 88L);
                        if (jpeg != null) b.Save(yol, jpeg, ep); else b.Save(yol, ImageFormat.Jpeg);
                    }
                }
                else b.Save(yol, ImageFormat.Png);
            }
            return yol;
        }

        /// <summary>Resmi ALTLIK katmanına, alanın köşelerine oturtup en alta koyar; altına atıf yazısı.</summary>
        private static void ResimKoy(Database db, Transaction tr, string yol, HaritaAltligi.Plan p, AltlikSaglayici s)
        {
            var y = new CizimYazici(db, tr);
            var katman = y.Katman(Katman);
            var sozlukId = RasterImageDef.GetImageDictionary(db);
            if (sozlukId.IsNull) sozlukId = RasterImageDef.CreateImageDictionary(db);
            var sozluk = (DBDictionary)tr.GetObject(sozlukId, OpenMode.ForWrite);
            string ad = Path.GetFileNameWithoutExtension(yol);
            for (int i = 2; sozluk.Contains(ad); i++) ad = Path.GetFileNameWithoutExtension(yol) + "_" + i;
            var def = new RasterImageDef { SourceFileName = yol };
            def.Load();
            var defId = sozluk.SetAt(ad, def);
            tr.AddNewlyCreatedDBObject(def, true);

            var ms = (BlockTableRecord)tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(db), OpenMode.ForWrite);
            double en = p.Genislik * p.Cozunurluk, boy = p.Yukseklik * p.Cozunurluk;
            var img = new RasterImage
            {
                ImageDefId = defId,
                ShowImage = true,
                Orientation = new CoordinateSystem3d(new Point3d(p.E0, p.N1 - boy, 0), new Vector3d(en, 0, 0), new Vector3d(0, boy, 0)),
            };
            img.SetDatabaseDefaults(db);
            img.LayerId = katman;
            ms.AppendEntity(img);
            tr.AddNewlyCreatedDBObject(img, true);
            RasterImage.EnableReactors(true);
            img.AssociateRasterDef(def);

            // Atıf: resmin altında, sol köşede
            double h = Math.Max(0.8, boy / 250);
            var atif = new DBText
            {
                TextString = "Altlık: " + s.Ad + (string.IsNullOrEmpty(s.Atif) ? "" : " · " + s.Atif) + " · " + DateTime.Now.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture),
                Position = new Point3d(p.E0, p.N1 - boy - h * 1.6, 0),
                Height = h,
                TextStyleId = y.YaziStili(),
            };
            atif.SetDatabaseDefaults(db);
            atif.LayerId = katman;
            ms.AppendEntity(atif);
            tr.AddNewlyCreatedDBObject(atif, true);

            // Nesnelerin altında görünsün
            try
            {
                var dot = (DrawOrderTable)tr.GetObject(ms.DrawOrderTableId, OpenMode.ForWrite);
                dot.MoveToBottom(new ObjectIdCollection { img.ObjectId });
            }
            catch { }
        }

        /// <summary>ALTLIK katmanındaki önceki resimleri ve atıf yazılarını siler.</summary>
        private static void EskileriSil(Database db, Transaction tr)
        {
            var ms = (BlockTableRecord)tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(db), OpenMode.ForRead);
            int sayi = 0;
            foreach (ObjectId id in ms)
            {
                if (id.ObjectClass.DxfName != "IMAGE" && id.ObjectClass.DxfName != "TEXT") continue;
                var e = tr.GetObject(id, OpenMode.ForRead) as Entity;
                if (e == null || !string.Equals(e.Layer, Katman, StringComparison.OrdinalIgnoreCase)) continue;
                if (e is DBText t && !t.TextString.StartsWith("Altlık:", StringComparison.Ordinal)) continue;
                e.UpgradeOpen();
                e.Erase();
                if (e is RasterImage) sayi++;
            }
            if (sayi > 0) Uygulama.Yaz("Önceki " + sayi + " altlık kaldırıldı.");
        }
    }

    /// <summary>
    /// Karo indirici: sağlayıcıya göre adres (düz XYZ, Google oturumu, Bing meta verisi, Azure başlığı, özel adres), aynı
    /// anda en çok 6 istek, her karoya bir yeniden deneme. Esc ile vazgeçilir. Anahtar hatası ve kota ayrı söylenir.
    /// </summary>
    internal static class KaroIndirici
    {
        private static HttpClient _istemci;

        private static HttpClient Istemci
        {
            get
            {
                if (_istemci != null) return _istemci;
#if !NET5_0_OR_GREATER
                // .NET Framework 4.6 TLS 1.2'yi kendiliğinden açmaz
                try { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; } catch { }
#endif
                var c = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
                c.DefaultRequestHeaders.UserAgent.ParseAdd("Sebeke-M/" + Uygulama.Surum + " (AutoCAD eklentisi; harita altligi)");
                _istemci = c;
                return c;
            }
        }

        /// <summary>
        /// Plandaki karolar (anahtar: x &lt;&lt; 32 | y). Hiç karo gelmezse null ve hata yazısı; bazıları gelmezse karolar ve
        /// uyarı (hata) döner. Vazgeçilirse null, hata null.
        /// </summary>
        public static Dictionary<long, byte[]> Indir(AltlikSaglayici s, string anahtar, HaritaAltligi.Plan p, out string hata)
        {
            hata = null;
            Func<int, int, int, string> adres;
            var basliklar = new Dictionary<string, string>();
            try
            {
                adres = AdresHazirla(s, anahtar, basliklar);
            }
            catch (System.Exception ex)
            {
                hata = ex.Message;
                return null;
            }

            var isler = new List<long>();
            for (int y = p.Y0; y <= p.Y1; y++)
                for (int x = p.X0; x <= p.X1; x++)
                    isler.Add(((long)x << 32) | (uint)y);
            var sonuc = new Dictionary<long, byte[]>();
            var durumlar = new Dictionary<int, int>();
            int bitti = 0, sira = -1;
            bool vazgec = false;
            var kilit = new object();
            var pm = new ProgressMeter();
            pm.SetLimit(isler.Count);
            pm.Start("Harita karoları indiriliyor");
            try
            {
                var gorevler = new List<Task>();
                for (int g = 0; g < Math.Min(6, isler.Count); g++)
                {
                    gorevler.Add(Task.Run(() =>
                    {
                        while (!Volatile.Read(ref vazgec))
                        {
                            int i = Interlocked.Increment(ref sira);
                            if (i >= isler.Count) break;
                            int x = (int)(isler[i] >> 32), y = (int)(isler[i] & 0xFFFFFFFF);
                            int durum = 0;
                            byte[] veri = null;
                            for (int deneme = 0; deneme < 2 && veri == null && !Volatile.Read(ref vazgec); deneme++)
                            {
                                try
                                {
                                    using (var istek = new HttpRequestMessage(HttpMethod.Get, adres(p.Z, x, y)))
                                    {
                                        foreach (var b in basliklar) istek.Headers.TryAddWithoutValidation(b.Key, b.Value);
                                        using (var yanit = Istemci.SendAsync(istek).GetAwaiter().GetResult())
                                        {
                                            durum = (int)yanit.StatusCode;
                                            if (yanit.IsSuccessStatusCode)
                                            {
                                                var d = yanit.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult();
                                                if (d != null && d.Length > 0) veri = d;
                                            }
                                            else if (durum == 401 || durum == 403 || durum == 404) break; // yeniden denemenin yararı yok
                                        }
                                    }
                                }
                                catch { durum = -1; }
                            }
                            lock (kilit)
                            {
                                if (veri != null) sonuc[isler[i]] = veri;
                                else { int c; durumlar.TryGetValue(durum, out c); durumlar[durum] = c + 1; }
                                bitti++;
                            }
                        }
                    }));
                }
                int gosterilen = 0;
                while (!Task.WaitAll(gorevler.ToArray(), 150))
                {
                    int b;
                    lock (kilit) b = bitti;
                    for (; gosterilen < b; gosterilen++) pm.MeterProgress();
                    System.Windows.Forms.Application.DoEvents();
                    if (HostApplicationServices.Current.UserBreak()) Volatile.Write(ref vazgec, true);
                }
            }
            finally { pm.Stop(); }
            if (vazgec) { Uygulama.Yaz("Harita altlığı: vazgeçildi."); return null; }
            if (sonuc.Count == 0)
            {
                hata = s.Ad + ": hiç karo indirilemedi — " + Neden(durumlar);
                return null;
            }
            int eksik = isler.Count - sonuc.Count;
            if (eksik > 0) hata = eksik + " karo indirilemedi (" + Neden(durumlar) + "); o yerler gri kalır.";
            return sonuc;
        }

        private static string Neden(Dictionary<int, int> durumlar)
        {
            int enCok = 0, durum = 0;
            foreach (var kv in durumlar) if (kv.Value > enCok) { enCok = kv.Value; durum = kv.Key; }
            if (durum == 401 || durum == 403) return "erişim reddedildi (" + durum + "): anahtar geçersiz ya da bu hizmet için izni yok";
            if (durum == 429) return "kota ya da hız sınırı aşıldı (429)";
            if (durum == 404) return "bu alan / yakınlık için görüntü yok (404)";
            if (durum == -1 || durum == 0) return "sunucuya ulaşılamadı: internet bağlantısını ya da güvenlik duvarını denetleyin";
            return "sunucu hatası (" + durum + ")";
        }

        /// <summary>Sağlayıcıya göre karo adresi üreticisi; Google oturumu ve Bing meta verisi burada alınır.</summary>
        private static Func<int, int, int, string> AdresHazirla(AltlikSaglayici s, string anahtar, Dictionary<string, string> basliklar)
        {
            switch (s.Tur)
            {
                case "google":
                {
                    var istek = new HttpRequestMessage(HttpMethod.Post, "https://tile.googleapis.com/v1/createSession?key=" + Uri.EscapeDataString(anahtar))
                    {
                        Content = new StringContent(HaritaAltligi.GoogleOturumGovdesi(s.Kume), Encoding.UTF8, "application/json"),
                    };
                    string oturum;
                    using (istek)
                    using (var yanit = Istemci.SendAsync(istek).GetAwaiter().GetResult())
                    {
                        string metin = yanit.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                        if (!yanit.IsSuccessStatusCode) throw new InvalidOperationException("Google anahtarı kabul edilmedi (" + (int)yanit.StatusCode + "). Anahtarın Map Tiles API için açık olduğunu denetleyin.");
                        var j = SebekeHakedis.Cekirdek.Json.Oku(metin) as JsonNesne;
                        oturum = j != null ? j.Metin("session") : "";
                        if (oturum.Length == 0) throw new InvalidOperationException("Google oturumu alınamadı.");
                    }
                    return (z, x, y) => HaritaAltligi.GoogleAdresi(z, x, y, oturum, anahtar);
                }
                case "bing":
                {
                    string sablon;
                    string[] altAlanlar;
                    using (var yanit = Istemci.GetAsync(HaritaAltligi.BingMetaAdresi(s.Kume, anahtar)).GetAwaiter().GetResult())
                    {
                        string metin = yanit.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                        if (!yanit.IsSuccessStatusCode) throw new InvalidOperationException("Bing Maps anahtarı kabul edilmedi (" + (int)yanit.StatusCode + "). Ücretsiz (Basic) anahtarlar kapatıldı; kurumsal anahtar ya da Azure Maps gerekir.");
                        var j = SebekeHakedis.Cekirdek.Json.Oku(metin) as JsonNesne;
                        var kumeler = j != null ? j.Dizi("resourceSets") : null;
                        var kume = kumeler != null && kumeler.Count > 0 ? kumeler[0] as JsonNesne : null;
                        var kaynaklar = kume != null ? kume.Dizi("resources") : null;
                        var r = kaynaklar != null && kaynaklar.Count > 0 ? kaynaklar[0] as JsonNesne : null;
                        sablon = r != null ? r.Metin("imageUrl") : "";
                        var aa = r != null ? r.Dizi("imageUrlSubdomains") : null;
                        altAlanlar = aa != null ? aa.ConvertAll(o => Convert.ToString(o, CultureInfo.InvariantCulture)).ToArray() : new string[0];
                        if (sablon.Length == 0) throw new InvalidOperationException("Bing Maps karo adresi alınamadı.");
                    }
                    return (z, x, y) => HaritaAltligi.BingAdresi(sablon, altAlanlar, z, x, y);
                }
                case "azure":
                    basliklar["subscription-key"] = anahtar;
                    return (z, x, y) => HaritaAltligi.Adres(s.Url, z, x, y, "");
                case "ozel":
                    return (z, x, y) => HaritaAltligi.Adres(anahtar, z, x, y, "");
                default:
                    return (z, x, y) => HaritaAltligi.Adres(s.Url, z, x, y, anahtar);
            }
        }
    }
}
