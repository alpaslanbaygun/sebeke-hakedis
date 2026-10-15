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
        public string Metin = "";
        public bool Kapali;
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
