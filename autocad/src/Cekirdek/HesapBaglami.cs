using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Hesabın açıldığı hedef: direk, hat (parçalı), trafo, kanal ya da proje.</summary>
    public sealed class HesapHedefi
    {
        public string Tur = "proje";
        /// <summary>AutoCAD tanıtıcısı (hat hedefinde seçilen parça).</summary>
        public string Id = "";
        public string No = "";
        /// <summary>Hat hedefinde hattı oluşturan parçalar (sırayla).</summary>
        public List<string> Parcalar = new List<string>();
        /// <summary>Trafo hedefinde hesaplanacak çıkışın (kolun) ilk hat parçası.</summary>
        public string HatId = "";

        public JsonNesne Json()
        {
            var o = new JsonNesne();
            o["tur"] = Tur; o["id"] = Id; o["no"] = No;
            if (Parcalar.Count > 0) o["parcalar"] = new List<object>(Parcalar);
            if (!string.IsNullOrEmpty(HatId)) o["hatId"] = HatId;
            return o;
        }
    }

    /// <summary>Çizimde olmayan proje bilgileri (çizim ayarlarından).</summary>
    public sealed class ProjeBilgisi
    {
        public string Ad = "", Kod = "", Yapan = "", Unvan = "", Firma = "";
        /// <summary>Buz yükü bölgesi "1".."5" (boş = bilinmiyor).</summary>
        public string BuzBolgesi = "";
    }

    /// <summary>
    /// Hesap Merkezi bağlamı (ortak/hesap/BAGLAM.md, sürüm 1): çizimdeki şebekeden seçili direğin, hattın, trafonun ya
    /// da kanalın hesaplara giden bilgileri. Telefondaki bağlamla (telefon/web/src/hesap/baglam.js) aynı biçimdedir.
    /// Yalnız çizimde gerçekten olan bilgi verilir; bilinmeyen alan null olur (hesap sayfası onu kullanıcıdan ister).
    /// </summary>
    public static class HesapBaglami
    {
        /// <summary>Hat ucunun elemana bağlı sayıldığı mesafe (m). Hat çizimi uçları elemanın konumuna oturtur.</summary>
        public const double Tolerans = 0.05;
        private const double GenisTolerans = 0.5;

        public static bool DirekMi(Eleman e) => e != null && (e.Tur == "AG_DIREK" || e.Tur == "MUSTEREK_DIREK" || e.Tur == "AYD_DIREK" || e.Tur == "ENH_DIREK" || e.Tur == "TRAFO_DIREGI");
        public static bool TrafoMu(Eleman e) => e != null && (e.Tur == "TRAFO_MERKEZI" || e.Tur == "TRAFO_DIREGI");
        public static bool HavaiMi(Hat h) => h != null && (h.Tur == "AG_HAVAI" || h.Tur == "OG_HAVAI" || h.Tur == "MUSTEREK" || h.Tur == "AYDINLATMA");

        private static object R2(double v) => double.IsNaN(v) || double.IsInfinity(v) ? null : (object)(Math.Round(v * 100) / 100);
        private static object Kot(Eleman e) => e == null || Math.Abs(e.Kot) < 1e-9 ? null : R2(e.Kot);
        private static string No(Eleman e) => e == null ? "" : !string.IsNullOrEmpty(e.GisId) ? e.GisId : e.Id;

        /// <summary>Kuzeyden saat yönünde açı (derece, 0–360).</summary>
        public static double Azimut(double[] a, double[] b)
        {
            double t = Math.Atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI;
            return t < 0 ? t + 360 : t;
        }

        public static string Malzeme(Eleman e)
        {
            string c = (e == null ? "" : e.Cins ?? "").ToUpperInvariant();
            if (c.Contains("BETON")) return "beton";
            if (c.Contains("AĞAÇ") || c.Contains("AGAC")) return "agac";
            if (c.Contains("DEMİR") || c.Contains("DEMIR") || c.Contains("GLV")) return "demir";
            return null;
        }

        public static string DirekTuru(Eleman e)
        {
            switch (e == null ? "" : e.Tur)
            {
                case "AG_DIREK": return "AG";
                case "MUSTEREK_DIREK": return "MUSTEREK";
                case "ENH_DIREK": return "OG";
                case "AYD_DIREK": return "AYD";
                case "TRAFO_DIREGI": return "TRAFO";
                default: return null;
            }
        }

        private static readonly Regex TipRolDeseni = new Regex(@"^G\s*-?\s*([TDKN])(?![A-Z])", RegexOptions.CultureInvariant);

        /// <summary>Tip adındaki görev harfi: "G-D-10 (sw)" → D, "G-T-12" → T, "G-K2" → K. Yoksa null.</summary>
        public static string TipRolu(string tip)
        {
            var m = TipRolDeseni.Match((tip ?? "").Trim().ToUpperInvariant());
            return m.Success ? m.Groups[1].Value : null;
        }

        // ---------------- Ağ dizini ----------------

        private sealed class Ag
        {
            public Proje P;
            public List<Eleman> Elemanlar = new List<Eleman>();
            public Dictionary<string, Eleman> ElemanById = new Dictionary<string, Eleman>(StringComparer.Ordinal);
            public Dictionary<string, Hat> HatById = new Dictionary<string, Hat>(StringComparer.Ordinal);
            /// <summary>Hat parçasının uçlarındaki elemanlar [baş, son] (yoksa null).</summary>
            public Dictionary<Hat, Eleman[]> Uclar = new Dictionary<Hat, Eleman[]>();
            public Dictionary<Eleman, List<Hat>> HatlarByEleman = new Dictionary<Eleman, List<Hat>>();
        }

        private static Ag Dizin(Proje p)
        {
            var ag = new Ag { P = p };
            foreach (var e in p.Elemanlar) { ag.Elemanlar.Add(e); if (!string.IsNullOrEmpty(e.Id)) ag.ElemanById[e.Id] = e; }
            foreach (var h in p.Hatlar)
            {
                if (!string.IsNullOrEmpty(h.Id)) ag.HatById[h.Id] = h;
                if (h.Kose.Count < 2) continue;
                var bas = EnYakin(ag, h.Kose[0]);
                var son = EnYakin(ag, h.Kose[h.Kose.Count - 1]);
                ag.Uclar[h] = new[] { bas, son };
                foreach (var e in new[] { bas, son })
                {
                    if (e == null) continue;
                    List<Hat> l;
                    if (!ag.HatlarByEleman.TryGetValue(e, out l)) ag.HatlarByEleman[e] = l = new List<Hat>();
                    if (!l.Contains(h)) l.Add(h);
                }
            }
            return ag;
        }

        private static Eleman EnYakin(Ag ag, double[] q)
        {
            Eleman en = null; double d = double.MaxValue;
            foreach (var e in ag.Elemanlar)
            {
                double x = Math.Sqrt((e.Saga - q[0]) * (e.Saga - q[0]) + (e.Yukari - q[1]) * (e.Yukari - q[1]));
                if (x < d) { d = x; en = e; }
            }
            if (d <= Tolerans) return en;
            // Uç tam oturmamışsa: geniş payla yalnız direk ve trafo
            if (en != null && d <= GenisTolerans && (DirekMi(en) || TrafoMu(en))) return en;
            return null;
        }

        private static List<object> Iletkenler(Hat h)
        {
            var l = new List<object>();
            foreach (var k in Cekirdek.Iletkenler.HatKalemleri(h))
            {
                int adet; string ic;
                string ad = Cekirdek.Iletkenler.AdetliMi(Cekirdek.Iletkenler.Yazi(k), out adet, out ic) ? ic : (string.IsNullOrEmpty(k.Tanim) ? Cekirdek.Iletkenler.Yazi(k) : k.Tanim);
                var o = new JsonNesne();
                o["ad"] = ad.Trim();
                o["adet"] = (double)Math.Max(1, Cekirdek.Iletkenler.Adet(k));
                o["devre"] = Cekirdek.Iletkenler.OgMu(k.Cins) ? "OG" : "AG";
                l.Add(o);
            }
            if (l.Count == 0 && !string.IsNullOrEmpty(h.AnaKesit))
            {
                foreach (var parca in h.AnaKesit.Split('/'))
                {
                    if (parca.Trim().Length == 0) continue;
                    var o = new JsonNesne();
                    o["ad"] = parca.Trim(); o["adet"] = 1.0;
                    o["devre"] = h.Tur.StartsWith("OG", StringComparison.Ordinal) || (h.Tur == "MUSTEREK" && l.Count == 0) ? "OG" : "AG";
                    l.Add(o);
                }
            }
            return l;
        }

        private static object GerilimKV(Hat h, Eleman ornek)
        {
            if (h == null) return null;
            if (h.Tur.StartsWith("OG", StringComparison.Ordinal) || h.Tur == "MUSTEREK")
            {
                double kv = Kv(ornek == null ? "" : ornek.Gerilim);
                return kv > 1 ? (object)kv : null;
            }
            return 0.4;
        }

        private static double Kv(string metin)
        {
            var m = Regex.Match((metin ?? "").Replace(',', '.'), @"(\d+(?:\.\d+)?)");
            double v;
            return m.Success && double.TryParse(m.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out v) ? v : 0;
        }

        // ---------------- Kollar (direkten çıkan açıklıklar) ----------------

        private sealed class Kol
        {
            public Hat Hat; public Eleman Karsi; public double Yon; public double Uzunluk;
        }

        private static List<Kol> KollarOf(Ag ag, Eleman e)
        {
            var r = new List<Kol>();
            List<Hat> hs;
            if (!ag.HatlarByEleman.TryGetValue(e, out hs)) return r;
            foreach (var h in hs)
            {
                var u = ag.Uclar[h];
                bool basta = u[0] == e;
                var komsu = basta ? h.Kose[1] : h.Kose[h.Kose.Count - 2];
                var ben = basta ? h.Kose[0] : h.Kose[h.Kose.Count - 1];
                r.Add(new Kol { Hat = h, Karsi = basta ? u[1] : u[0], Yon = Azimut(ben, komsu), Uzunluk = h.CizimUzunlugu > 0 ? h.CizimUzunlugu : Geometri.Uzunluk(h.Kose) });
            }
            return r;
        }

        private static double? SapmaAcisi(List<Kol> havai)
        {
            if (havai.Count != 2) return null;
            double d = Math.Abs(havai[0].Yon - havai[1].Yon) % 360;
            if (d > 180) d = 360 - d;
            return 180 - d;
        }

        private static string Rol(Eleman e, List<Kol> havai, out string kaynak)
        {
            string r = TipRolu(e.Tip);
            if (r != null) { kaynak = "tip"; return r; }
            kaynak = "geometri";
            if (havai.Count == 0) { kaynak = null; return null; }
            if (havai.Count == 1) return "N";
            if (havai.Count >= 3) return "D";
            double a = SapmaAcisi(havai) ?? 0;
            return a > 3 ? "K" : "T";
        }

        private static JsonNesne DirekOzeti(Ag ag, Eleman e)
        {
            var o = new JsonNesne();
            o["id"] = e.Id; o["no"] = No(e); o["tip"] = e.Tip; o["malzeme"] = Malzeme(e);
            var havai = KollarOf(ag, e).FindAll(k => HavaiMi(k.Hat));
            string kaynak;
            o["rol"] = DirekMi(e) ? Rol(e, havai, out kaynak) : null;
            var a = SapmaAcisi(havai);
            o["aci"] = a.HasValue ? R2(a.Value) : null;
            o["kot"] = Kot(e);
            o["yukseklik"] = null;
            o["baglanti"] = null;
            return o;
        }

        private static JsonNesne Direk(Ag ag, Eleman e)
        {
            var o = DirekOzeti(ag, e);
            o["tur"] = DirekTuru(e);
            var havai = KollarOf(ag, e).FindAll(k => HavaiMi(k.Hat));
            string kaynak;
            Rol(e, havai, out kaynak);
            o["rolKaynagi"] = kaynak;
            o["durum"] = e.Durum;
            var kollar = new List<object>();
            foreach (var k in KollarOf(ag, e))
            {
                var ko = new JsonNesne();
                ko["yon"] = R2(k.Yon);
                ko["aciklik"] = R2(k.Uzunluk);
                bool kotlu = Kot(e) != null && Kot(k.Karsi) != null;
                ko["aciklik3B"] = kotlu ? R2(Math.Sqrt(k.Uzunluk * k.Uzunluk + (k.Karsi.Kot - e.Kot) * (k.Karsi.Kot - e.Kot))) : null;
                ko["dH"] = kotlu ? R2(k.Karsi.Kot - e.Kot) : null;
                var karsi = new JsonNesne();
                if (k.Karsi != null)
                {
                    var kd = DirekOzeti(ag, k.Karsi);
                    karsi["id"] = k.Karsi.Id; karsi["no"] = No(k.Karsi); karsi["tip"] = k.Karsi.Tip; karsi["rol"] = kd["rol"]; karsi["kot"] = Kot(k.Karsi);
                }
                else { karsi["id"] = null; karsi["no"] = null; karsi["tip"] = null; karsi["rol"] = null; karsi["kot"] = null; }
                ko["karsi"] = karsi;
                ko["hatId"] = k.Hat.Id; ko["hatNo"] = HatNo(ag, ZincirKur(ag, k.Hat)); ko["hatTur"] = k.Hat.Tur;
                ko["gerilimKV"] = GerilimKV(k.Hat, e);
                ko["iletkenler"] = Iletkenler(k.Hat);
                kollar.Add(ko);
            }
            o["kollar"] = kollar;
            return o;
        }

        // ---------------- Hat zinciri ----------------

        /// <summary>Seçilen parçadan iki yöne, iki parçalı (aynı türden) düğümlerden geçerek uzanan hat zinciri.</summary>
        /// <summary>Dallanma noktasında zincirin devam etmesi için en çok sapma (derece): hat düz gidiyorsa sürer, kol ayrılır.</summary>
        private const double DallanmaSapmasi = 40;

        /// <summary>Parçanın uc elemanındaki yönü (uca doğru, kuzeyden saat yönünde); bilinmiyorsa null.</summary>
        private static double? UcYonu(Ag ag, Hat h, Eleman uc)
        {
            Eleman[] u;
            if (!ag.Uclar.TryGetValue(h, out u)) return null;
            var diger = u[0] == uc ? u[1] : u[0];
            if (diger == null || uc == null) return null;
            if (Math.Abs(diger.Saga - uc.Saga) < 1e-9 && Math.Abs(diger.Yukari - uc.Yukari) < 1e-9) return null;
            return Azimut(new[] { diger.Saga, diger.Yukari }, new[] { uc.Saga, uc.Yukari });
        }

        /// <summary>
        /// Parçadan direkten direğe zincir: iki yöne doğru aynı türdeki parçalarla sürer. Dallanma noktasında (düğümde üçüncü
        /// bir parça) hattın düz devamı seçilir (sapması en küçük ve 40°'den az olan parça); yoksa zincir orada biter.
        /// </summary>
        private static List<Hat> ZincirKur(Ag ag, Hat h0)
        {
            var zincir = new List<Hat> { h0 };
            var gorulen = new HashSet<Hat> { h0 };
            for (int yon = 0; yon < 2; yon++)
            {
                var cur = h0;
                var uc = ag.Uclar.ContainsKey(cur) ? ag.Uclar[cur][yon == 0 ? 1 : 0] : null;
                while (uc != null && zincir.Count < 2000)
                {
                    List<Hat> hs;
                    if (!ag.HatlarByEleman.TryGetValue(uc, out hs)) break;
                    var digerleri = hs.FindAll(x => x != cur && x.Tur == h0.Tur && HavaiMi(x) == HavaiMi(h0) && !gorulen.Contains(x));
                    if (digerleri.Count == 0) break;
                    Hat sonraki = null;
                    if (digerleri.Count == 1) sonraki = digerleri[0];
                    else
                    {
                        // dallanma: gelen yöne en yakın (düz devam eden) parça
                        var gelis = UcYonu(ag, cur, uc);
                        double enKucuk = double.MaxValue;
                        foreach (var x in digerleri)
                        {
                            var git = UcYonu(ag, x, uc); // x'in uca doğru yönü; devam yönü bunun tersi
                            if (!gelis.HasValue || !git.HasValue) continue;
                            double sapma = Math.Abs(((git.Value + 180) - gelis.Value) % 360);
                            if (sapma > 180) sapma = 360 - sapma;
                            if (sapma < enKucuk) { enKucuk = sapma; sonraki = x; }
                        }
                        if (sonraki == null || enKucuk > DallanmaSapmasi) break;
                    }
                    if (!gorulen.Add(sonraki)) break;
                    if (yon == 0) zincir.Add(sonraki); else zincir.Insert(0, sonraki);
                    var u = ag.Uclar[sonraki];
                    uc = u[0] == uc ? u[1] : u[0];
                    cur = sonraki;
                }
            }
            return zincir;
        }

        /// <summary>Zincirdeki düğüm elemanları (sırayla). Parça yönleri karışık olabilir.</summary>
        private static List<Eleman> Dugumler(Ag ag, List<Hat> zincir)
        {
            var d = new List<Eleman>();
            if (zincir.Count == 0) return d;
            var ilk = ag.Uclar.ContainsKey(zincir[0]) ? ag.Uclar[zincir[0]] : new Eleman[2];
            Eleman bas;
            if (zincir.Count == 1) bas = ilk[0];
            else
            {
                var ikinci = ag.Uclar.ContainsKey(zincir[1]) ? ag.Uclar[zincir[1]] : new Eleman[2];
                bas = ilk[0] != null && (ilk[0] == ikinci[0] || ilk[0] == ikinci[1]) ? ilk[1] : ilk[0];
            }
            d.Add(bas);
            var cur = bas;
            foreach (var h in zincir)
            {
                var u = ag.Uclar.ContainsKey(h) ? ag.Uclar[h] : new Eleman[2];
                var sonraki = u[0] == cur ? u[1] : u[0];
                d.Add(sonraki);
                cur = sonraki;
            }
            return d;
        }

        private static string HatNo(Ag ag, List<Hat> zincir)
        {
            var d = Dugumler(ag, zincir);
            if (d.Count < 2) return zincir.Count > 0 ? zincir[0].Id : "";
            string a = d[0] != null ? No(d[0]) : "?", b = d[d.Count - 1] != null ? No(d[d.Count - 1]) : "?";
            return a + "–" + b;
        }

        private static JsonNesne HatJson(Ag ag, List<Hat> zincir)
        {
            var dug = Dugumler(ag, zincir);
            // trafo uçtaysa zincir trafodan başlasın
            if (dug.Count > 1 && !TrafoMu(dug[0]) && TrafoMu(dug[dug.Count - 1])) { zincir.Reverse(); dug.Reverse(); }
            var h0 = zincir[0];
            var o = new JsonNesne();
            o["id"] = h0.Id;
            o["no"] = HatNo(ag, zincir);
            o["tur"] = h0.Tur;
            o["havai"] = HavaiMi(h0);
            Eleman ornek = dug.Find(x => x != null && Kv(x.Gerilim) > 1);
            o["gerilimKV"] = GerilimKV(h0, ornek);
            o["iletkenler"] = Iletkenler(h0);
            var direkler = new List<object>();
            foreach (var e in dug) if (e != null) direkler.Add(DirekOzeti(ag, e));
            o["direkler"] = direkler;
            var acikliklar = new List<object>();
            double toplam = 0, s1 = 0, s3 = 0;
            for (int i = 0; i < zincir.Count; i++)
            {
                var h = zincir[i];
                double u = h.CizimUzunlugu > 0 ? h.CizimUzunlugu : Geometri.Uzunluk(h.Kose);
                var a = new JsonNesne();
                Eleman ea = i < dug.Count ? dug[i] : null, eb = i + 1 < dug.Count ? dug[i + 1] : null;
                a["bas"] = ea != null ? No(ea) : null;
                a["bit"] = eb != null ? No(eb) : null;
                a["uzunluk"] = R2(u);
                bool kotlu = Kot(ea) != null && Kot(eb) != null;
                a["uzunluk3B"] = kotlu ? R2(Math.Sqrt(u * u + (eb.Kot - ea.Kot) * (eb.Kot - ea.Kot))) : null;
                a["dH"] = kotlu ? R2(eb.Kot - ea.Kot) : null;
                acikliklar.Add(a);
                toplam += u; s1 += u; s3 += u * u * u;
            }
            o["acikliklar"] = acikliklar;
            o["toplamUzunluk"] = R2(toplam);
            o["ruling"] = s1 > 0 ? R2(Math.Sqrt(s3 / s1)) : null;
            return o;
        }

        private static List<object> Zincir(JsonNesne hat, string devre)
        {
            var r = new List<object>();
            var iletkenler = hat.Dizi("iletkenler") ?? new List<object>();
            object il = null;
            foreach (var x in iletkenler) if (devre == null || (x as JsonNesne)?.Metin("devre") == devre) { il = x; break; }
            if (il == null && iletkenler.Count > 0) il = iletkenler[0];
            foreach (var x in hat.Dizi("acikliklar") ?? new List<object>())
            {
                var a = (JsonNesne)x;
                var z = new JsonNesne();
                z["bas"] = a["bas"]; z["bit"] = a["bit"]; z["uzunluk"] = a["uzunluk"]; z["iletken"] = il; z["havai"] = hat["havai"];
                r.Add(z);
            }
            return r;
        }

        private static JsonNesne Trafo(Eleman e)
        {
            var o = new JsonNesne();
            o["id"] = e.Id; o["no"] = No(e);
            string tip = e.Tur == "TRAFO_DIREGI" ? "Direk tipi trafo" : "Trafo merkezi (köşk / bina)";
            if (!string.IsNullOrEmpty(e.Tip)) tip += " · " + e.Tip;
            double kva = Kv(e.Guc);
            if (kva > 0) tip += " · " + kva.ToString("0.##", CultureInfo.InvariantCulture) + " kVA";
            o["tip"] = tip;
            o["gucKVA"] = kva > 0 ? (object)kva : null;
            double kv = Kv(e.Gerilim);
            o["ogKV"] = kv > 1 ? (object)kv : null;
            o["agKV"] = 0.4;
            o["uk"] = null; o["pcu"] = null; o["adet"] = 1.0;
            return o;
        }

        private static JsonNesne KanalJson(Ag ag, Kanal c)
        {
            var o = new JsonNesne();
            o["id"] = c.Id; o["no"] = (c.BasNo ?? "") + (string.IsNullOrEmpty(c.BitNo) ? "" : "–" + c.BitNo);
            o["uzunluk"] = R2(c.CizimUzunlugu);
            o["zemin"] = string.IsNullOrEmpty(c.Zemin) ? null : c.Zemin;
            o["genislik"] = c.AltGenislik > 0 || c.UstGenislik > 0 ? R2((c.AltGenislik + c.UstGenislik) / 2) : null;
            o["derinlik"] = c.Derinlik > 0 ? R2(c.Derinlik) : null;
            o["yontem"] = null;
            var kablolar = new List<object>();
            // kanalla aynı güzergâhtaki yeraltı hat parçalarının iletkenleri
            if (c.Kose.Count >= 2)
                foreach (var h in ag.P.Hatlar)
                {
                    if (HavaiMi(h) || h.Kose.Count < 2) continue;
                    bool ayni = (Geometri.Mesafe(h.Kose[0], c.Kose[0]) <= GenisTolerans && Geometri.Mesafe(h.Kose[h.Kose.Count - 1], c.Kose[c.Kose.Count - 1]) <= GenisTolerans)
                             || (Geometri.Mesafe(h.Kose[0], c.Kose[c.Kose.Count - 1]) <= GenisTolerans && Geometri.Mesafe(h.Kose[h.Kose.Count - 1], c.Kose[0]) <= GenisTolerans);
                    if (ayni) kablolar.AddRange(Iletkenler(h));
                }
            o["kablolar"] = kablolar;
            return o;
        }

        private static JsonNesne ProjeJson(Proje p, ProjeBilgisi b)
        {
            var o = new JsonNesne();
            o["ad"] = !string.IsNullOrEmpty(b?.Ad) ? b.Ad : string.IsNullOrEmpty(p.Ad) ? null : p.Ad;
            o["kod"] = string.IsNullOrEmpty(b?.Kod) ? null : b.Kod;
            o["yapan"] = string.IsNullOrEmpty(b?.Yapan) ? null : b.Yapan;
            o["unvan"] = string.IsNullOrEmpty(b?.Unvan) ? null : b.Unvan;
            o["firma"] = string.IsNullOrEmpty(b?.Firma) ? null : b.Firma;
            o["tarih"] = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            o["buzBolgesi"] = string.IsNullOrEmpty(b?.BuzBolgesi) ? null : b.BuzBolgesi;
            return o;
        }

        /// <summary>Hedef çizimde hâlâ var mı?</summary>
        public static bool HedefVar(Proje p, HesapHedefi h)
        {
            if (h == null || h.Tur == "proje" || string.IsNullOrEmpty(h.Tur)) return true;
            if (h.Tur == "direk" || h.Tur == "trafo") return p.Elemanlar.Exists(e => e.Id == h.Id);
            if (h.Tur == "kanal" && p.Kanallar.Exists(c => c.Id == h.Id)) return true;
            foreach (var id in new List<string>(h.Parcalar) { h.Id }) if (p.Hatlar.Exists(x => x.Id == id)) return true;
            return false;
        }

        /// <summary>Hedef için bağlam (BAGLAM.md v1). Hat hedefinde parça listesi hedef.Parcalar'a yazılır.</summary>
        public static JsonNesne Kur(Proje p, HesapHedefi hedef, ProjeBilgisi bilgi)
        {
            var ag = Dizin(p);
            var b = new JsonNesne();
            b["surum"] = 1.0;
            b["kaynak"] = "autocad";
            b["proje"] = ProjeJson(p, bilgi);
            var hd = new JsonNesne();
            hd["tur"] = hedef == null || string.IsNullOrEmpty(hedef.Tur) ? "proje" : hedef.Tur;
            hd["id"] = hedef == null ? "" : hedef.Id ?? "";
            hd["no"] = ""; hd["ad"] = "";
            b["hedef"] = hd;
            if (hedef == null || hedef.Tur == "proje" || string.IsNullOrEmpty(hedef.Tur)) { hd["ad"] = "Proje geneli"; return b; }

            if (hedef.Tur == "direk" || hedef.Tur == "trafo")
            {
                Eleman e;
                if (!ag.ElemanById.TryGetValue(hedef.Id ?? "", out e)) return b;
                if (hedef.Tur == "direk" || DirekMi(e))
                {
                    var d = Direk(ag, e);
                    if (hedef.Tur == "direk") { b["direk"] = d; hd["no"] = No(e); hd["ad"] = (e.Tip ?? "") + " direk"; hedef.No = No(e); }
                    // direğin üzerindeki havai hat
                    var kollar = KollarOf(ag, e);
                    var kol = kollar.Find(k => HavaiMi(k.Hat)) ?? (kollar.Count > 0 ? kollar[0] : null);
                    if (kol != null && hedef.Tur == "direk") b["hat"] = HatJson(ag, ZincirKur(ag, kol.Hat));
                }
                if (hedef.Tur == "trafo" && TrafoMu(e))
                {
                    var t = Trafo(e);
                    b["trafo"] = t; hd["no"] = No(e); hd["ad"] = t.Metin("tip"); hedef.No = No(e);
                    Hat cikis;
                    if (!string.IsNullOrEmpty(hedef.HatId) && ag.HatById.TryGetValue(hedef.HatId, out cikis))
                    {
                        var hat = HatJson(ag, ZincirKur(ag, cikis));
                        b["hat"] = hat;
                        b["zincir"] = Zincir(hat, hat.Metin("tur").StartsWith("OG", StringComparison.Ordinal) ? "OG" : "AG");
                    }
                }
                return b;
            }
            if (hedef.Tur == "hat")
            {
                Hat h;
                if (!ag.HatById.TryGetValue(hedef.Id ?? "", out h)) return b;
                var zincir = ZincirKur(ag, h);
                var hat = HatJson(ag, zincir);
                b["hat"] = hat;
                hedef.Parcalar.Clear();
                foreach (var x in zincir) hedef.Parcalar.Add(x.Id);
                hd["no"] = hat.Metin("no"); hd["ad"] = string.Join(" + ", ((hat.Dizi("iletkenler") ?? new List<object>()).ConvertAll(x => ((JsonNesne)x).Metin("ad"))).ToArray());
                hd["parcalar"] = new List<object>(hedef.Parcalar);
                hedef.No = hat.Metin("no");
                string tur = hat.Metin("tur");
                b["zincir"] = Zincir(hat, tur.StartsWith("OG", StringComparison.Ordinal) ? "OG" : tur == "MUSTEREK" ? null : "AG");
                var dug = Dugumler(ag, zincir);
                var bas = dug.Count > 0 ? dug[0] : null;
                if (bas != null && TrafoMu(bas)) b["trafo"] = Trafo(bas);
                else if (dug.Count > 0 && TrafoMu(dug[dug.Count - 1])) b["trafo"] = Trafo(dug[dug.Count - 1]);
                return b;
            }
            if (hedef.Tur == "kanal")
            {
                var c = p.Kanallar.Find(x => x.Id == hedef.Id);
                if (c == null) return b;
                var k = KanalJson(ag, c);
                b["kanal"] = k; hd["no"] = k.Metin("no"); hd["ad"] = c.Zemin ?? ""; hedef.No = k.Metin("no");
                return b;
            }
            return b;
        }

        /// <summary>Trafonun çıkış hat parçaları (kullanıcı hangi kolun hesaplanacağını seçer).</summary>
        public static List<Hat> TrafoCikislari(Proje p, string trafoId)
        {
            var ag = Dizin(p);
            Eleman e;
            if (!ag.ElemanById.TryGetValue(trafoId ?? "", out e)) return new List<Hat>();
            List<Hat> hs;
            return ag.HatlarByEleman.TryGetValue(e, out hs) ? new List<Hat>(hs) : new List<Hat>();
        }

        /// <summary>Hat parçasının zincir adı (ör. "SC12–SC18").</summary>
        public static string HatAdi(Proje p, Hat h)
        {
            var ag = Dizin(p);
            return HatNo(ag, ZincirKur(ag, h));
        }
    }
}
