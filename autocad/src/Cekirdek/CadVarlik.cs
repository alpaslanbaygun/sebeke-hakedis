using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// AutoCAD çiziminden toplanan tek bir nesnenin yalın hâli. Eklenti çizimi bu biçime çevirir;
    /// çekirdek yalnız bunu görür (AutoCAD'e bağımlı değildir, bu yüzden bilgisayarsız test edilebilir).
    /// Koordinatlar CAD eksenindedir: X = sağa, Y = yukarı.
    /// </summary>
    public sealed class CadVarlik
    {
        /// <summary>Nesnenin AutoCAD tanıtıcısı (handle), onaltılık.</summary>
        public string H = "";
        /// <summary>INSERT, POLYLINE, LWPOLYLINE, TEXT, MTEXT</summary>
        public string Tur = "";
        public string Katman = "";
        public string Blok = "";
        public double X, Y, Z;
        public double Aci;
        /// <summary>Blok ölçeği (X yönü). AutoCAD elemanları genellikle 4 ölçekle konur.</summary>
        public double Olcek = 1;
        public string Metin = "";
        public bool Kapali;
        /// <summary>Nesneye yazılacak renk (AutoCAD renk numarası; -1: dokunma). Çizimden okunurken doldurulmaz.</summary>
        public short Renk = -1;
        /// <summary>Nesneye yazılacak çizgi tipi ("" dokunma, "CONTINUOUS" sürekli). Çizimden okunurken doldurulmaz.</summary>
        public string CizgiTipi = "";
        /// <summary>
        /// Çizgi nesnesine metraj yazısı yazılsın mı (hat, kanal, sondaj): her açıklığa (iki eleman arasına) bir yazı;
        /// elemansız kırılma köşelerinde bölünmez.
        /// </summary>
        public bool ParcaMetraji;
        /// <summary>
        /// Metraj kanal / sondaj metrajı mı: içindeki kablonun metrajıyla üst üste binmesin diye bir satır yukarıya yazılır
        /// (CizimStili.KaziBosluk).
        /// </summary>
        public bool KaziMetraji;
        /// <summary>Çizginin iki yanına çizilecek kenarların arası (m; kanal). 0: kenar yok.</summary>
        public double KenarGenisligi;
        /// <summary>
        /// Hattın stildeki çizgi kalınlığı (m; 1/1000 paftada kâğıtta mm; CizimStili.HatKalinligi): eklenti ayardaki çarpanla
        /// çoklu çizginin genişliği yapar. -1: dokunma (hat değil ya da çizimden okundu).
        /// </summary>
        public double HatKalinligi = -1;
        /// <summary>
        /// Elemanın çizimde yazılacak malzeme satırları (MalzemeEtiketi.Satirlar; ayar açıksa MLZ_ öznitelikleri olarak
        /// yazılır). null: dokunma (eleman değil ya da çizimden okundu).
        /// </summary>
        public List<string> MalzemeSatirlari;
        /// <summary>
        /// Direğin hemen yanına çizilecek armatür simgesinin bloğu ("": yok). Direkte armatür malzemesi varsa dolar; simge
        /// direğe bağlı bir süsdür (kendi verisi yoktur), direkle birlikte güncellenir ve silinir.
        /// </summary>
        public string Armatur = "";
        /// <summary>Armatür simgesinin rengi (-1: dokunma) ve direğe göre yeri (metre, dünya ekseninde).</summary>
        public short ArmaturRengi = -1;
        public double ArmaturDx, ArmaturDy;
        /// <summary>Blok öznitelikleri (etiket → değer).</summary>
        public Dictionary<string, string> Oz = new Dictionary<string, string>(StringComparer.Ordinal);
        /// <summary>Çoklu çizgi köşeleri: her biri [X, Y].</summary>
        public List<double[]> Kose = new List<double[]>();
        /// <summary>Genişletilmiş veri (XDATA): uygulama adı → metin değerleri.</summary>
        public Dictionary<string, List<string>> Xd = new Dictionary<string, List<string>>(StringComparer.Ordinal);

        public bool NoktaMi => Tur == "INSERT" || Tur == "TEXT" || Tur == "MTEXT";
        public bool CizgiMi => Tur == "POLYLINE" || Tur == "LWPOLYLINE";

        public string XdIlk(string uygulama)
        {
            List<string> l;
            return Xd.TryGetValue(uygulama, out l) && l.Count > 0 ? l[0] : null;
        }

        public List<string> XdHepsi(string uygulama)
        {
            List<string> l;
            return Xd.TryGetValue(uygulama, out l) ? l : new List<string>();
        }

        public string OzDeger(string etiket)
        {
            string d;
            return Oz.TryGetValue(etiket, out d) ? d : null;
        }

        /// <summary>
        /// İki tarifin çizimde aynı sonucu verip vermediği (kimlik ve etiket bağlantısı hariç).
        /// Konumlar 1 mm, açı 1e-5 radyan toleransla karşılaştırılır. Farklıysa ilk farkı söyler.
        /// </summary>
        public static bool Ayni(CadVarlik a, CadVarlik b, out string fark)
        {
            fark = null;
            const double tol = 0.001;
            if (a.Tur != b.Tur) { fark = "tür"; return false; }
            if (!string.Equals(a.Katman, b.Katman, StringComparison.Ordinal)) { fark = "katman " + a.Katman + " → " + b.Katman; return false; }
            if (a.Tur == "INSERT")
            {
                if (!string.Equals(a.Blok ?? "", b.Blok ?? "", StringComparison.OrdinalIgnoreCase)) { fark = "blok " + a.Blok + " → " + b.Blok; return false; }
                if (Math.Abs(a.X - b.X) > tol || Math.Abs(a.Y - b.Y) > tol) { fark = "konum"; return false; }
                if (Math.Abs(a.Z - b.Z) > tol) { fark = "kot"; return false; }
                double da = Math.Abs(a.Aci - b.Aci) % (2 * Math.PI);
                if (Math.Min(da, 2 * Math.PI - da) > 1e-5) { fark = "açı"; return false; }
                // Sıra no ve malzeme yazısı (MLZ_…; elemanın malzemelerinden üretilen süs) karşılaştırılmaz
                Func<string, bool> sayilmaz = t => t == "SIRA_NO" || MalzemeEtiketi.SatirMi(t);
                foreach (var kv in a.Oz)
                {
                    if (sayilmaz(kv.Key)) continue;
                    string d;
                    if (!b.Oz.TryGetValue(kv.Key, out d) || d != kv.Value) { fark = "öznitelik " + kv.Key; return false; }
                }
                foreach (var kv in b.Oz) if (!sayilmaz(kv.Key) && !a.Oz.ContainsKey(kv.Key)) { fark = "öznitelik " + kv.Key; return false; }
            }
            else if (a.CizgiMi)
            {
                if (a.Kapali != b.Kapali) { fark = "kapalılık"; return false; }
                if (a.Kose.Count != b.Kose.Count) { fark = "köşe sayısı " + a.Kose.Count + " → " + b.Kose.Count; return false; }
                for (int i = 0; i < a.Kose.Count; i++)
                    if (Math.Abs(a.Kose[i][0] - b.Kose[i][0]) > tol || Math.Abs(a.Kose[i][1] - b.Kose[i][1]) > tol) { fark = "köşe " + (i + 1); return false; }
            }
            var uygulamalar = new HashSet<string>(a.Xd.Keys, StringComparer.Ordinal);
            uygulamalar.UnionWith(b.Xd.Keys);
            foreach (var u in uygulamalar)
            {
                if (u == "SH_ID" || u == "ETK") continue;
                // Boş dizgiler sayılmaz: "GIS" [""] ile hiç GIS olmaması aynıdır; silinmiş bölümün izi ("") de yok demektir
                var la = a.XdHepsi(u).FindAll(x => !string.IsNullOrEmpty(x));
                var lb = b.XdHepsi(u).FindAll(x => !string.IsNullOrEmpty(x));
                if (la.Count != lb.Count) { fark = u + " satır sayısı " + la.Count + " → " + lb.Count; return false; }
                for (int i = 0; i < la.Count; i++) if (!SatirAyni(la[i], lb[i])) { fark = u + ": " + la[i] + " → " + lb[i]; return false; }
            }
            return true;
        }

        /// <summary>Genişletilmiş veri satırları alan alan aynı mı (sayılar 0,001 toleransla: "1447,202759" ile "1447,2028" aynıdır).</summary>
        private static bool SatirAyni(string a, string b)
        {
            if (a == b) return true;
            var fa = (a ?? "").Split(';');
            var fb = (b ?? "").Split(';');
            if (fa.Length != fb.Length) return false;
            for (int i = 0; i < fa.Length; i++)
            {
                if (fa[i] == fb[i]) continue;
                double da = SayiCoz.Coz(fa[i], double.NaN), db = SayiCoz.Coz(fb[i], double.NaN);
                if (double.IsNaN(da) || double.IsNaN(db) || Math.Abs(da - db) > 0.001) return false;
            }
            return true;
        }

        // -------- Döküm dosyası (JSON) --------

        public JsonNesne JsonYap()
        {
            var o = new JsonNesne();
            o["h"] = H;
            o["tur"] = Tur;
            o["katman"] = Katman;
            if (Tur == "INSERT")
            {
                o["blok"] = Blok;
                o["x"] = X; o["y"] = Y;
                if (Z != 0) o["z"] = Z;
                o["aci"] = Aci;
                if (Olcek != 1) o["olcek"] = Olcek;
                if (Oz.Count > 0)
                {
                    var oz = new JsonNesne();
                    foreach (var kv in Oz) oz[kv.Key] = kv.Value;
                    o["oz"] = oz;
                }
            }
            else if (CizgiMi)
            {
                var k = new List<object>();
                foreach (var p in Kose) k.Add(new List<object> { p[0], p[1] });
                o["kose"] = k;
                o["kapali"] = Kapali;
            }
            else
            {
                o["x"] = X; o["y"] = Y;
                o["metin"] = Metin;
            }
            if (Xd.Count > 0)
            {
                var xd = new JsonNesne();
                foreach (var kv in Xd) xd[kv.Key] = new List<object>(kv.Value);
                o["xd"] = xd;
            }
            return o;
        }

        public static CadVarlik JsondanOku(JsonNesne o)
        {
            var v = new CadVarlik
            {
                H = o.Metin("h"),
                Tur = o.Metin("tur"),
                Katman = o.Metin("katman"),
                Blok = o.Metin("blok"),
                X = o.Ondalik("x"),
                Y = o.Ondalik("y"),
                Z = o.Ondalik("z"),
                Aci = o.Ondalik("aci"),
                Olcek = o.Ondalik("olcek", 1),
                Metin = o.Metin("metin"),
                Kapali = o.Mantik("kapali") ?? false,
            };
            var oz = o.Nesne("oz");
            if (oz != null) foreach (var kv in oz) v.Oz[kv.Key] = kv.Value as string ?? "";
            var kose = o.Dizi("kose");
            if (kose != null)
                foreach (var p in kose)
                    if (p is List<object> pl && pl.Count >= 2)
                        v.Kose.Add(new[] { Convert.ToDouble(pl[0]), Convert.ToDouble(pl[1]) });
            var xd = o.Nesne("xd");
            if (xd != null)
                foreach (var kv in xd)
                {
                    var liste = new List<string>();
                    if (kv.Value is List<object> l) foreach (var d in l) liste.Add(d == null ? "" : Convert.ToString(d, System.Globalization.CultureInfo.InvariantCulture));
                    v.Xd[kv.Key] = liste;
                }
            return v;
        }

        public static List<CadVarlik> DokumOku(string jsonMetni)
        {
            var kok = Json.Oku(jsonMetni) as JsonNesne;
            if (kok == null) throw new FormatException("Döküm dosyası bir JSON nesnesi değil.");
            var liste = new List<CadVarlik>();
            var dizi = kok.Dizi("varliklar");
            if (dizi != null) foreach (var x in dizi) if (x is JsonNesne n) liste.Add(JsondanOku(n));
            return liste;
        }

        public static string DokumYaz(IEnumerable<CadVarlik> varliklar, string kaynak)
        {
            var kok = new JsonNesne();
            kok["bicim"] = "sebeke-hakedis.cad-dokum";
            kok["surum"] = 1;
            kok["kaynak"] = kaynak ?? "";
            var dizi = new List<object>();
            foreach (var v in varliklar) dizi.Add(v.JsonYap());
            kok["varliklar"] = dizi;
            return Json.Yaz(kok, false);
        }
    }
}
