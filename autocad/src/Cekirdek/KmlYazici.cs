using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Çizimi Google Earth dosyası olarak yazar (KML; KMZ: sıkıştırılmış KML). Koordinatlar çizimin 3° TM diliminden
    /// enlem-boylama çevrilir (Koordinat). Her proje (bölge) bir klasördür: sınırı, elemanları, hatları, kanalları,
    /// sondajları; GPS noktaları ayrı klasörde. Renkler telefon ekranındaki renklerdir (ortak çizim stili). Her nesnenin
    /// bilgileri (GIS no, tip, durum, hakediş, proje, metraj...) KML öznitelikleri olarak yazılır (CbsYapisi):
    /// Google Earth'te balonda görünür, CBS programları sütun olarak okur.
    /// </summary>
    public static class KmlYazici
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
        private const string Simgeler = "http://maps.google.com/mapfiles/kml/shapes/";

        /// <summary>Dosyayı yazar: uzantısı .kmz ise KMZ (içinde doc.kml), değilse KML.</summary>
        public static void Yaz(Proje p, int dom, string yol, string surum)
        {
            string kml = Metin(p, dom, surum);
            if (yol.EndsWith(".kmz", StringComparison.OrdinalIgnoreCase))
            {
                using (var fs = new FileStream(yol, FileMode.Create, FileAccess.Write))
                    KmzYaz(kml, fs);
            }
            else File.WriteAllText(yol, kml, new UTF8Encoding(false));
        }

        public static void KmzYaz(string kml, Stream akis)
        {
            using (var zip = new ZipArchive(akis, ZipArchiveMode.Create, true))
            {
                var g = zip.CreateEntry("doc.kml", CompressionLevel.Optimal);
                using (var s = g.Open())
                {
                    var b = new UTF8Encoding(false).GetBytes(kml);
                    s.Write(b, 0, b.Length);
                }
            }
        }

        /// <summary>KML metni.</summary>
        public static string Metin(Proje p, int dom, string surum)
        {
            if (dom <= 0) throw new ArgumentException("Dilim orta meridyeni (DOM) belirtilmedi.");
            var nesneler = CbsYapisi.Nesneler(p);
            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
            sb.Append("<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n<Document>\n");
            sb.Append("<name>").Append(Kac(p.Ad)).Append("</name>\n");
            sb.Append("<description>").Append(Kac("Şebeke-M Hakediş " + surum + " · " + Koordinat.DilimAdi(dom) + " → WGS84 · " +
                DateTime.Now.ToString("dd.MM.yyyy HH:mm", Inv))).Append("</description>\n");
            sb.Append("<open>1</open>\n");

            // Biçimler: her renk ve geometri bir kez
            var bicimler = new Dictionary<string, string>(StringComparer.Ordinal);
            var govde = new StringBuilder();

            // Projeler (bölgeler) sırasıyla; bölgesi olmayan nesneler en sonda
            var projeler = new List<string>();
            foreach (var b in p.Bolgeler) if (!projeler.Contains(b.Ad ?? "")) projeler.Add(b.Ad ?? "");
            nesneler.RemoveAll(n => n.Katman == CbsYapisi.Malzeme); // malzeme satırlarının haritada yeri yok (bilgileri nesnede)
            foreach (var n in nesneler) if (n.Katman != CbsYapisi.Nokta && !projeler.Contains(n.Proje)) projeler.Add(n.Proje);
            if (projeler.Remove("")) projeler.Add("");
            foreach (var pr in projeler)
            {
                var bu = nesneler.FindAll(n => n.Proje == pr && n.Katman != CbsYapisi.Nokta);
                if (bu.Count == 0) continue;
                var kod = "";
                var bolge = p.Bolgeler.Find(b => (b.Ad ?? "") == pr);
                if (bolge != null) kod = bolge.Kod ?? "";
                govde.Append("<Folder><name>").Append(Kac(pr.Length > 0 ? pr : ProjeOzeti.ProjesizAdi)).Append("</name>");
                if (kod.Length > 0) govde.Append("<description>").Append(Kac("Proje kodu " + kod)).Append("</description>");
                govde.Append('\n');
                foreach (var n in bu.FindAll(x => x.Katman == CbsYapisi.Bolge)) Yer(govde, n, dom, bicimler);
                foreach (var k in new[] { CbsYapisi.Direk, CbsYapisi.Trafo, CbsYapisi.Sdk, CbsYapisi.Pano, CbsYapisi.Eleman, CbsYapisi.Hat, CbsYapisi.Kanal, CbsYapisi.Sondaj })
                {
                    var l = bu.FindAll(x => x.Katman == k);
                    if (l.Count == 0) continue;
                    govde.Append("<Folder><name>").Append(Kac(k.Baslik + " (" + l.Count + ")")).Append("</name>\n");
                    foreach (var n in l) Yer(govde, n, dom, bicimler);
                    govde.Append("</Folder>\n");
                }
                govde.Append("</Folder>\n");
            }
            var noktalar = nesneler.FindAll(n => n.Katman == CbsYapisi.Nokta);
            if (noktalar.Count > 0)
            {
                govde.Append("<Folder><name>").Append(Kac(CbsYapisi.Nokta.Baslik + " (" + noktalar.Count + ")")).Append("</name><visibility>0</visibility>\n");
                foreach (var n in noktalar) Yer(govde, n, dom, bicimler, false);
                govde.Append("</Folder>\n");
            }

            foreach (var kv in bicimler) sb.Append(kv.Value);
            sb.Append(govde);
            sb.Append("</Document>\n</kml>\n");
            return sb.ToString();
        }

        /// <summary>Bir nesnenin Placemark'ı: adı, biçimi, öznitelikleri, geometrisi.</summary>
        private static void Yer(StringBuilder sb, CbsNesnesi n, int dom, Dictionary<string, string> bicimler, bool gorunur = true)
        {
            bool sokulecek = n.Durum == "DM";
            string bicim = Bicim(n, sokulecek, bicimler);
            sb.Append("<Placemark>");
            if (!gorunur) sb.Append("<visibility>0</visibility>");
            sb.Append("<name>").Append(Kac(n.Ad)).Append("</name>");
            sb.Append("<styleUrl>#").Append(bicim).Append("</styleUrl>");
            sb.Append("<ExtendedData>");
            for (int i = 0; i < n.Katman.Alanlar.Length && i < n.Degerler.Length; i++)
            {
                string d = CbsYapisi.Yazi(n.Degerler[i]);
                if (d.Length == 0) continue;
                var a = n.Katman.Alanlar[i];
                sb.Append("<Data name=\"").Append(a.Ad).Append("\"><displayName>").Append(Kac(a.Baslik)).Append("</displayName><value>")
                  .Append(Kac(d)).Append("</value></Data>");
            }
            sb.Append("</ExtendedData>");
            switch (n.Katman.Geometri)
            {
                case "nokta":
                    sb.Append("<Point><coordinates>").Append(Konum(n.Kose[0], dom)).Append("</coordinates></Point>");
                    break;
                case "cizgi":
                    sb.Append("<LineString><tessellate>1</tessellate><coordinates>");
                    for (int i = 0; i < n.Kose.Count; i++) { if (i > 0) sb.Append(' '); sb.Append(Konum(n.Kose[i], dom)); }
                    sb.Append("</coordinates></LineString>");
                    break;
                default:
                    sb.Append("<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>");
                    for (int i = 0; i <= n.Kose.Count; i++) { if (i > 0) sb.Append(' '); sb.Append(Konum(n.Kose[i % n.Kose.Count], dom)); }
                    sb.Append("</coordinates></LinearRing></outerBoundaryIs></Polygon>");
                    break;
            }
            sb.Append("</Placemark>\n");
        }

        /// <summary>Nesnenin biçim adı; biçim ilk kez kullanılıyorsa tanımı eklenir. Sökülecekler (DM) yarı saydam.</summary>
        private static string Bicim(CbsNesnesi n, bool sokulecek, Dictionary<string, string> bicimler)
        {
            string renk = (n.Renk ?? "").TrimStart('#').ToLowerInvariant();
            if (renk.Length != 6) renk = "cbd5e1";
            string saydam = sokulecek ? "80" : "ff";
            string tur = n.Katman.Geometri == "nokta" ? Simge(n) : n.Katman.Geometri;
            string ad = tur.Replace(".png", "") + "_" + renk + (sokulecek ? "_dm" : "");
            if (bicimler.ContainsKey(ad)) return ad;
            string kmlRenk = saydam + renk.Substring(4, 2) + renk.Substring(2, 2) + renk.Substring(0, 2);
            var b = new StringBuilder();
            b.Append("<Style id=\"").Append(ad).Append("\">");
            switch (n.Katman.Geometri)
            {
                case "nokta":
                    double olcek = n.Katman == CbsYapisi.Nokta ? 0.6 : tur == "triangle.png" ? 1.0 : 0.8;
                    b.Append("<IconStyle><color>").Append(kmlRenk).Append("</color><scale>").Append(olcek.ToString("0.0", Inv))
                     .Append("</scale><Icon><href>").Append(Simgeler).Append(tur).Append("</href></Icon></IconStyle>")
                     .Append("<LabelStyle><scale>0.7</scale></LabelStyle>");
                    break;
                case "cizgi":
                    double en = n.Katman == CbsYapisi.Kanal ? 5 : n.Katman == CbsYapisi.Hat && OgMu(n) ? 4 : 3;
                    b.Append("<LineStyle><color>").Append(kmlRenk).Append("</color><width>").Append(en.ToString("0", Inv)).Append("</width></LineStyle>");
                    break;
                default:
                    b.Append("<LineStyle><color>ff").Append(renk.Substring(4, 2) + renk.Substring(2, 2) + renk.Substring(0, 2))
                     .Append("</color><width>2</width></LineStyle><PolyStyle><color>22").Append(renk.Substring(4, 2) + renk.Substring(2, 2) + renk.Substring(0, 2))
                     .Append("</color></PolyStyle>");
                    break;
            }
            b.Append("</Style>\n");
            bicimler[ad] = b.ToString();
            return ad;
        }

        /// <summary>Eleman simgesi: direkler daire, trafo üçgen, box / pano kare, diğerleri baklava; GPS noktası artı.</summary>
        private static string Simge(CbsNesnesi n)
        {
            if (n.Katman == CbsYapisi.Nokta) return "cross-hairs.png";
            string tur = Convert.ToString(n.Deger("TUR"), Inv) ?? "";
            if (tur.EndsWith("DIREK", StringComparison.Ordinal)) return "placemark_circle.png";
            if (tur.StartsWith("TRAFO", StringComparison.Ordinal)) return "triangle.png";
            if (tur == "BOX" || tur == "PANO" || tur == "KOFRE") return "square.png";
            return "open-diamond.png";
        }

        private static bool OgMu(CbsNesnesi n)
        {
            string tur = Convert.ToString(n.Deger("TUR"), Inv) ?? "";
            return tur.StartsWith("OG", StringComparison.Ordinal) || tur == "MUSTEREK";
        }

        /// <summary>Çizim koordinatı → "boylam,enlem,0" (8 ondalık ≈ 1 mm).</summary>
        private static string Konum(double[] k, int dom)
        {
            double enlem, boylam;
            Koordinat.EnlemBoylam(k[0], k[1], dom, out enlem, out boylam);
            return boylam.ToString("0.00000000", Inv) + "," + enlem.ToString("0.00000000", Inv) + ",0";
        }

        /// <summary>XML kaçışı.</summary>
        public static string Kac(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var sb = new StringBuilder(s.Length + 8);
            foreach (char c in s)
            {
                switch (c)
                {
                    case '&': sb.Append("&amp;"); break;
                    case '<': sb.Append("&lt;"); break;
                    case '>': sb.Append("&gt;"); break;
                    case '"': sb.Append("&quot;"); break;
                    default:
                        if (c < 0x20 && c != '\t' && c != '\n' && c != '\r') continue; // XML'de yasak denetim karakterleri
                        sb.Append(c);
                        break;
                }
            }
            return sb.ToString();
        }
    }
}
