using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>MIF dosyasından okunan bir nesne (geometri, stil rengi, MID satırı).</summary>
    public sealed class MifNesnesi
    {
        /// <summary>"nokta", "cizgi", "alan", "yazi", "yok"</summary>
        public string Tur = "yok";
        /// <summary>Nokta / yazı: tek parça, tek köşe. Çizgi: her parça bir çoklu çizgi. Alan: her halka bir parça (ilk köşe sonda tekrarlanmaz).</summary>
        public List<List<double[]>> Parcalar = new List<List<double[]>>();
        public string Metin = "";
        /// <summary>Yazı yüksekliği (koordinat biriminde) ve açısı (derece).</summary>
        public double YaziBoyu, Aci;
        /// <summary>Stil rengi (RGB, 0xRRGGBB): Pen, Symbol ya da Font; -1: yok.</summary>
        public int Renk = -1;
        public string[] Degerler = new string[0];
    }

    /// <summary>Okunan MIF/MID dosyası.</summary>
    public sealed class MifVerisi
    {
        public string Karakter = "";
        public char Ayirici = '\t';
        /// <summary>"tm" (Earth Projection 8), "cografi" (Projection 1 ya da belirtilmemiş), "duz" (NonEarth), "bilinmiyor"</summary>
        public string Sistem = "cografi";
        public int Datum = 104;
        public double OrtaMeridyen, BaslangicEnlemi, Olcek = 1, SagaOteleme, YukariOteleme;
        public double BirimCarpani = 1;
        public string CoordSys = "";
        public List<string> Sutunlar = new List<string>();
        public List<string> SutunTurleri = new List<string>();
        public List<MifNesnesi> Nesneler = new List<MifNesnesi>();
        /// <summary>Okunamayan / desteklenmeyen nesne sayısı (ör. yay).</summary>
        public int Atlanan;
        public List<string> Uyarilar = new List<string>();

        public int Sutun(string ad) => Sutunlar.FindIndex(s => string.Equals(s, ad, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// MapInfo MIF / MID dosyaları (CBS). Yazma: her katman (BOLGE, DIREK, TRAFO, SDK, PANO, ELEMAN, HAT, KANAL, SONDAJ, NOKTA,
    /// MALZEME) ayrı bir dosya çifti;
    /// sütunlar CbsYapisi'ndeki adlarla, koordinatlar çizimin koordinatıyla (ITRF96 3° TM; CoordSys satırında dilim yazılı),
    /// Türkçe Windows kod sayfası (WindowsTurkish). Okuma: nokta, çizgi, çoklu çizgi, alan, dikdörtgen, elips, yazı ve
    /// çoklu nokta; koordinatlar (TM, coğrafi ya da düz) çizimin dilimine çevrilir.
    /// </summary>
    public static class MifDosyasi
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        /// <summary>Türkçe Windows kod sayfası (1254).</summary>
        public static Encoding Turkce
        {
            get
            {
#if NET5_0_OR_GREATER
                try { Encoding.RegisterProvider(CodePagesEncodingProvider.Instance); } catch { }
#endif
                try { return Encoding.GetEncoding(1254); }
                catch { return new UTF8Encoding(false); }
            }
        }

        /// <summary>Çizim koordinatının CoordSys satırı: ITRF96 (WGS84 ile eş) 3° TM, ölçek 1, sağa öteleme 500 000 m.</summary>
        public static string CoordSys(int dom) =>
            "CoordSys Earth Projection 8, 104, \"m\", " + dom.ToString(Inv) + ", 0, 1, 500000, 0 Bounds (0, 3000000) (1000000, 5000000)";

        // =========================== Yazma ===========================

        /// <summary>
        /// Projeyi katman katman yazar: klasör/ad_DIREK.mif + .mid, ad_HAT..., boş katman yazılmaz. Yazılan MIF dosyalarının
        /// yolları döner.
        /// </summary>
        public static List<string> Yaz(Proje p, int dom, string klasor, string ad)
        {
            var yazilan = new List<string>();
            var hepsi = CbsYapisi.Nesneler(p);
            foreach (var k in CbsYapisi.Katmanlar)
            {
                var l = hepsi.FindAll(n => n.Katman == k);
                if (l.Count == 0) continue;
                string mif, mid;
                KatmanYaz(k, l, dom, out mif, out mid);
                string yol = Path.Combine(klasor, ad + "_" + k.Ad + ".mif");
                File.WriteAllText(yol, mif, Turkce);
                File.WriteAllText(Path.ChangeExtension(yol, ".mid"), mid, Turkce);
                yazilan.Add(yol);
            }
            return yazilan;
        }

        /// <summary>Bir katmanın MIF ve MID metinleri.</summary>
        public static void KatmanYaz(CbsKatmani k, List<CbsNesnesi> nesneler, int dom, out string mif, out string mid)
        {
            var m = new StringBuilder();
            m.Append("Version 300\r\n");
            m.Append("Charset \"WindowsTurkish\"\r\n");
            m.Append("Delimiter \",\"\r\n");
            m.Append(CoordSys(dom)).Append("\r\n");
            m.Append("Columns ").Append(k.Alanlar.Length.ToString(Inv)).Append("\r\n");
            foreach (var a in k.Alanlar)
                m.Append("  ").Append(a.Ad).Append(' ').Append(a.Tur == 'I' ? "Integer" : a.Tur == 'F' ? "Float" : "Char(" + a.Uzunluk.ToString(Inv) + ")").Append("\r\n");
            m.Append("Data\r\n\r\n");
            var d = new StringBuilder();
            foreach (var n in nesneler)
            {
                int renk = Rgb(n.Renk);
                switch (k.Geometri)
                {
                    case "nokta":
                        m.Append("Point ").Append(K(n.Kose[0])).Append("\r\n");
                        m.Append("    Symbol (").Append(Simge(n).ToString(Inv)).Append(',').Append(renk.ToString(Inv)).Append(",10)\r\n");
                        break;
                    case "yok": // haritada yeri olmayan satır (malzeme tablosu)
                        m.Append("None\r\n");
                        break;
                    case "cizgi":
                        m.Append("Pline ").Append(n.Kose.Count.ToString(Inv)).Append("\r\n");
                        foreach (var x in n.Kose) m.Append(K(x)).Append("\r\n");
                        m.Append("    Pen (").Append(n.Katman == CbsYapisi.Kanal ? "3" : "2").Append(",2,").Append(renk.ToString(Inv)).Append(")\r\n");
                        break;
                    default:
                        m.Append("Region 1\r\n  ").Append((n.Kose.Count + 1).ToString(Inv)).Append("\r\n");
                        for (int i = 0; i <= n.Kose.Count; i++) m.Append(K(n.Kose[i % n.Kose.Count])).Append("\r\n");
                        m.Append("    Pen (2,2,").Append(renk.ToString(Inv)).Append(")\r\n");
                        m.Append("    Brush (1,0,16777215)\r\n");
                        break;
                }
                for (int i = 0; i < k.Alanlar.Length; i++)
                {
                    if (i > 0) d.Append(',');
                    var a = k.Alanlar[i];
                    object v = i < n.Degerler.Length ? n.Degerler[i] : null;
                    if (a.Tur == 'C')
                    {
                        string s = CbsYapisi.Yazi(v).Replace("\r", " ").Replace("\n", " ");
                        if (s.Length > a.Uzunluk) s = s.Substring(0, a.Uzunluk);
                        d.Append('"').Append(s.Replace("\"", "\"\"")).Append('"');
                    }
                    else if (a.Tur == 'I') d.Append(v == null ? "0" : Convert.ToInt64(v, Inv).ToString(Inv));
                    else d.Append(v == null ? "0" : (Convert.ToDouble(v, Inv) + 0.0).ToString("0.########", Inv)); // eksi sıfır "0"
                }
                d.Append("\r\n");
            }
            mif = m.ToString();
            mid = d.ToString();
        }

        private static string K(double[] k) => k[0].ToString("0.000", Inv) + " " + k[1].ToString("0.000", Inv);

        /// <summary>MapInfo 3.0 simgeleri: 34 daire (direk), 36 üçgen (trafo), 32 kare (box, pano), 33 baklava (diğer), 38 boş kare (GPS noktası).</summary>
        private static int Simge(CbsNesnesi n)
        {
            if (n.Katman == CbsYapisi.Nokta) return 38;
            string tur = Convert.ToString(n.Deger("TUR"), Inv) ?? "";
            if (tur.EndsWith("DIREK", StringComparison.Ordinal)) return 34;
            if (tur.StartsWith("TRAFO", StringComparison.Ordinal)) return 36;
            if (tur == "BOX" || tur == "PANO" || tur == "KOFRE") return 32;
            return 33;
        }

        /// <summary>"#rrggbb" → 0xRRGGBB.</summary>
        public static int Rgb(string hex)
        {
            string h = (hex ?? "").TrimStart('#');
            int r;
            return h.Length == 6 && int.TryParse(h, NumberStyles.HexNumber, Inv, out r) ? r : 0;
        }

        // =========================== Okuma ===========================

        /// <summary>MIF / MID dosyasını okur: baytları Charset satırına göre çözer (yoksa UTF-8, olmazsa Türkçe Windows).</summary>
        public static string DosyaMetni(byte[] b)
        {
            if (b == null || b.Length == 0) return "";
            if (b.Length >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF) return Encoding.UTF8.GetString(b, 3, b.Length - 3);
            string bas = Encoding.ASCII.GetString(b, 0, Math.Min(b.Length, 4096));
            int ci = bas.IndexOf("Charset", StringComparison.OrdinalIgnoreCase);
            string cs = "";
            if (ci >= 0)
            {
                int q1 = bas.IndexOf('"', ci), q2 = q1 >= 0 ? bas.IndexOf('"', q1 + 1) : -1;
                if (q1 >= 0 && q2 > q1) cs = bas.Substring(q1 + 1, q2 - q1 - 1);
            }
            var kod = Kodlama(cs);
            if (kod != null) return kod.GetString(b);
            try { return new UTF8Encoding(false, true).GetString(b); }
            catch (DecoderFallbackException) { return Turkce.GetString(b); }
        }

        /// <summary>MapInfo Charset adının kod sayfası (bilinmiyorsa null: önce UTF-8 denenir).</summary>
        public static Encoding Kodlama(string charset)
        {
            int cp;
            switch ((charset ?? "").Trim().ToUpperInvariant())
            {
                case "UTF-8": case "UTF8": return new UTF8Encoding(false);
                case "WINDOWSTURKISH": case "ISO8859_9": cp = 1254; break;
                case "WINDOWSLATIN1": cp = 1252; break;
                case "WINDOWSLATIN2": cp = 1250; break;
                case "WINDOWSCYRILLIC": cp = 1251; break;
                case "WINDOWSGREEK": cp = 1253; break;
                case "WINDOWSARABIC": cp = 1256; break;
                default: return null;
            }
            if (cp == 1254) return Turkce;
            try { return Encoding.GetEncoding(cp); }
            catch { return Turkce; }
        }

        /// <summary>MIF ve MID metinlerini çözer. mid null ise öznitelikler boş kalır.</summary>
        public static MifVerisi Oku(string mif, string mid)
        {
            var v = new MifVerisi();
            var satirlar = (mif ?? "").Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            int i = 0;
            bool veri = false;
            for (; i < satirlar.Length; i++)
            {
                string s = satirlar[i].Trim();
                if (s.Length == 0) continue;
                string ilk = IlkKelime(s).ToUpperInvariant();
                if (ilk == "DATA") { veri = true; i++; break; }
                if (ilk == "CHARSET") v.Karakter = Tirnakli(s);
                else if (ilk == "DELIMITER") { string a = Tirnakli(s); if (a.Length > 0) v.Ayirici = a[0]; }
                else if (ilk == "COORDSYS") CoordSysOku(v, s);
                else if (ilk == "COLUMNS")
                {
                    int n;
                    int.TryParse(s.Substring(7).Trim(), NumberStyles.Integer, Inv, out n);
                    for (int j = 0; j < n && i + 1 < satirlar.Length; j++)
                    {
                        i++;
                        string c = satirlar[i].Trim();
                        if (c.Length == 0) { j--; continue; }
                        string ad = IlkKelime(c);
                        v.Sutunlar.Add(ad.Trim('"', '`'));
                        v.SutunTurleri.Add(c.Substring(Math.Min(c.Length, ad.Length)).Trim());
                    }
                }
            }
            if (!veri) v.Uyarilar.Add("MIF dosyasında \"Data\" bölümü yok.");
            var sb = new StringBuilder();
            for (; i < satirlar.Length; i++) sb.Append(satirlar[i]).Append('\n');
            NesneleriOku(v, Parcala(sb.ToString()));

            if (mid != null)
            {
                var satir = MidSatirlari(mid, v.Ayirici);
                if (satir.Count != v.Nesneler.Count)
                    v.Uyarilar.Add("MID dosyasındaki satır sayısı (" + satir.Count + ") nesne sayısından (" + v.Nesneler.Count + ") farklı; bilgiler sırayla eşlendi.");
                for (int j = 0; j < v.Nesneler.Count && j < satir.Count; j++) v.Nesneler[j].Degerler = satir[j];
            }
            YaziBoylari(v);
            return v;
        }

        private static string IlkKelime(string s)
        {
            int i = 0;
            while (i < s.Length && !char.IsWhiteSpace(s[i])) i++;
            return s.Substring(0, i);
        }

        private static string Tirnakli(string s)
        {
            int a = s.IndexOf('"'), b = a >= 0 ? s.IndexOf('"', a + 1) : -1;
            return a >= 0 && b > a ? s.Substring(a + 1, b - a - 1) : "";
        }

        /// <summary>CoordSys satırı: Earth Projection 1 (coğrafi), 8 (TM); NonEarth (düz).</summary>
        private static void CoordSysOku(MifVerisi v, string s)
        {
            v.CoordSys = s;
            var t = Parcala(s);
            var sayi = new List<double>();
            string birim = "m";
            bool earth = false, nonEarth = false;
            int proj = -1;
            for (int i = 0; i < t.Count; i++)
            {
                string u = t[i].ToUpperInvariant();
                if (u == "EARTH") earth = true;
                else if (u == "NONEARTH") nonEarth = true;
                else if (u == "BOUNDS" || u == "AFFINE") break;
                else if (u == "UNITS" && i + 1 < t.Count) birim = t[i + 1].Trim('"');
                else if (u == "PROJECTION" && i + 1 < t.Count) { int.TryParse(t[i + 1], NumberStyles.Integer, Inv, out proj); i++; }
                else if (t[i].StartsWith("\"", StringComparison.Ordinal)) { if (earth && proj >= 0) birim = t[i].Trim('"'); }
                else
                {
                    double d;
                    if (earth && proj >= 0 && double.TryParse(t[i], NumberStyles.Float, Inv, out d)) sayi.Add(d);
                }
            }
            v.BirimCarpani = BirimCarpani(birim);
            if (nonEarth) { v.Sistem = "duz"; if (v.BirimCarpani <= 0) { v.BirimCarpani = 1; v.Uyarilar.Add("Birim tanınmadı (" + birim + "); metre sayıldı."); } return; }
            if (!earth) { v.Sistem = "bilinmiyor"; return; }
            if (sayi.Count > 0) v.Datum = (int)sayi[0];
            // Parametreli datum: 999 → elipsoit, dx, dy, dz; 9999 → elipsoit, dx, dy, dz, rx, ry, rz, ölçek, başlangıç meridyeni
            int ofs = v.Datum == 999 ? 5 : v.Datum == 9999 ? 10 : 1;
            if (ofs > 1 && sayi.Count >= ofs)
            {
                bool kaymaYok = true;
                for (int j = 2; j < ofs; j++) if (Math.Abs(sayi[j]) > 1e-9) kaymaYok = false;
                v.Datum = kaymaYok ? 0 : -v.Datum; // kaymasız parametreli datum GRS80 / WGS84 ile eş sayılır
            }
            if (proj == 1) { v.Sistem = "cografi"; return; }
            if (proj == 8 && sayi.Count >= ofs + 5)
            {
                v.Sistem = "tm";
                v.OrtaMeridyen = sayi[ofs]; v.BaslangicEnlemi = sayi[ofs + 1]; v.Olcek = sayi[ofs + 2]; v.SagaOteleme = sayi[ofs + 3]; v.YukariOteleme = sayi[ofs + 4];
                if (v.BirimCarpani <= 0) { v.BirimCarpani = 1; v.Uyarilar.Add("Birim tanınmadı (" + birim + "); metre sayıldı."); }
                return;
            }
            v.Sistem = "bilinmiyor";
            v.Uyarilar.Add("Koordinat sistemi desteklenmiyor (" + s.Trim() + "); koordinatlar olduğu gibi alındı.");
        }

        private static double BirimCarpani(string birim)
        {
            switch ((birim ?? "").Trim().ToLowerInvariant())
            {
                case "m": return 1;
                case "km": return 1000;
                case "cm": return 0.01;
                case "mm": return 0.001;
                case "ft": return 0.3048;
                case "survey ft": return 1200.0 / 3937.0;
                default: return -1;
            }
        }

        /// <summary>Metni MIF sözcüklerine böler: kelime / sayı, tırnaklı yazı ("..." ; "" içte tırnak), ( ) , ayrı sözcük.</summary>
        private static List<string> Parcala(string s)
        {
            var l = new List<string>();
            int i = 0;
            while (i < s.Length)
            {
                char c = s[i];
                if (char.IsWhiteSpace(c)) { i++; continue; }
                if (c == '(' || c == ')' || c == ',') { l.Add(c.ToString()); i++; continue; }
                if (c == '"')
                {
                    var b = new StringBuilder("\"");
                    i++;
                    while (i < s.Length)
                    {
                        if (s[i] == '"')
                        {
                            if (i + 1 < s.Length && s[i + 1] == '"') { b.Append('"'); i += 2; continue; }
                            i++;
                            break;
                        }
                        b.Append(s[i]);
                        i++;
                    }
                    b.Append('"');
                    l.Add(b.ToString());
                    continue;
                }
                int bas = i;
                while (i < s.Length && !char.IsWhiteSpace(s[i]) && s[i] != '(' && s[i] != ')' && s[i] != ',' && s[i] != '"') i++;
                l.Add(s.Substring(bas, i - bas));
            }
            return l;
        }

        private sealed class Okuyucu
        {
            public List<string> T;
            public int I;
            public bool Bitti => I >= T.Count;
            public string Bak => I < T.Count ? T[I] : "";
            public string Al() => I < T.Count ? T[I++] : "";

            public bool Sayi(out double d)
            {
                d = 0;
                if (I >= T.Count) return false;
                if (!double.TryParse(T[I], NumberStyles.Float, Inv, out d)) return false;
                I++;
                return true;
            }

            public int Tam()
            {
                double d;
                return Sayi(out d) ? (int)d : 0;
            }

            public double[] Kose()
            {
                double x, y;
                if (!Sayi(out x) || !Sayi(out y)) return null;
                return new[] { x, y };
            }

            /// <summary>Parantezli değer listesi: ( a , b , c ) → [a, b, c]</summary>
            public List<string> Liste()
            {
                var l = new List<string>();
                if (Bak != "(") return l;
                I++;
                while (!Bitti && Bak != ")") { string t = Al(); if (t != ",") l.Add(t); }
                if (Bak == ")") I++;
                return l;
            }
        }

        private static readonly HashSet<string> Nesneler = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "POINT", "LINE", "PLINE", "REGION", "TEXT", "RECT", "ROUNDRECT", "ELLIPSE", "ARC", "MULTIPOINT", "COLLECTION", "NONE" };

        private static void NesneleriOku(MifVerisi v, List<string> t)
        {
            var o = new Okuyucu { T = t };
            MifNesnesi son = null;
            while (!o.Bitti)
            {
                string k = o.Bak.ToUpperInvariant();
                if (Nesneler.Contains(k))
                {
                    o.I++;
                    var n = new MifNesnesi();
                    if (!NesneOku(v, o, k, n)) v.Atlanan++;
                    v.Nesneler.Add(n);
                    son = n;
                    continue;
                }
                // Stil ve yazı ayrıntıları
                o.I++;
                switch (k)
                {
                    case "PEN":
                    {
                        var l = o.Liste();
                        int r;
                        if (son != null && son.Renk < 0 && l.Count >= 3 && int.TryParse(l[2], NumberStyles.Integer, Inv, out r)) son.Renk = r;
                        break;
                    }
                    case "SYMBOL":
                    {
                        var l = o.Liste();
                        int r;
                        if (son != null && l.Count >= 2 && int.TryParse(l[1], NumberStyles.Integer, Inv, out r)) son.Renk = r;
                        break;
                    }
                    case "FONT":
                    {
                        var l = o.Liste();
                        int r;
                        if (son != null && son.Tur == "yazi" && l.Count >= 4 && int.TryParse(l[3], NumberStyles.Integer, Inv, out r)) son.Renk = r;
                        break;
                    }
                    case "BRUSH": o.Liste(); break;
                    case "CENTER": { double d; o.Sayi(out d); o.Sayi(out d); break; }
                    case "ANGLE": { double d; if (o.Sayi(out d) && son != null) son.Aci = d; break; }
                    case "SPACING": { double d; o.Sayi(out d); break; }
                    case "JUSTIFY": o.Al(); break;
                    case "LABEL": { o.Al(); o.Al(); double d; o.Sayi(out d); o.Sayi(out d); break; } // Label Line Simple x y
                    default: break; // SMOOTH vb.
                }
            }
        }

        private static bool NesneOku(MifVerisi v, Okuyucu o, string k, MifNesnesi n)
        {
            double a, b;
            switch (k)
            {
                case "NONE":
                    return true;
                case "POINT":
                {
                    var p = o.Kose();
                    if (p == null) return false;
                    n.Tur = "nokta";
                    n.Parcalar.Add(new List<double[]> { p });
                    return true;
                }
                case "LINE":
                {
                    var p1 = o.Kose(); var p2 = o.Kose();
                    if (p1 == null || p2 == null) return false;
                    n.Tur = "cizgi";
                    n.Parcalar.Add(new List<double[]> { p1, p2 });
                    return true;
                }
                case "PLINE":
                {
                    int bolum = 1;
                    if (o.Bak.Equals("MULTIPLE", StringComparison.OrdinalIgnoreCase)) { o.I++; bolum = o.Tam(); }
                    n.Tur = "cizgi";
                    for (int s = 0; s < bolum; s++)
                    {
                        int adet = o.Tam();
                        var parca = new List<double[]>();
                        for (int j = 0; j < adet; j++) { var p = o.Kose(); if (p == null) return false; parca.Add(p); }
                        if (parca.Count >= 2) n.Parcalar.Add(parca);
                    }
                    return n.Parcalar.Count > 0;
                }
                case "REGION":
                {
                    int halka = o.Tam();
                    n.Tur = "alan";
                    for (int s = 0; s < halka; s++)
                    {
                        int adet = o.Tam();
                        var parca = new List<double[]>();
                        for (int j = 0; j < adet; j++) { var p = o.Kose(); if (p == null) return false; parca.Add(p); }
                        if (parca.Count > 3 && Math.Abs(parca[0][0] - parca[parca.Count - 1][0]) < 1e-9 && Math.Abs(parca[0][1] - parca[parca.Count - 1][1]) < 1e-9)
                            parca.RemoveAt(parca.Count - 1);
                        if (parca.Count >= 3) n.Parcalar.Add(parca);
                    }
                    return n.Parcalar.Count > 0;
                }
                case "RECT":
                case "ROUNDRECT":
                {
                    var p1 = o.Kose(); var p2 = o.Kose();
                    if (k == "ROUNDRECT") o.Sayi(out a);
                    if (p1 == null || p2 == null) return false;
                    n.Tur = "alan";
                    n.Parcalar.Add(new List<double[]> { new[] { p1[0], p1[1] }, new[] { p2[0], p1[1] }, new[] { p2[0], p2[1] }, new[] { p1[0], p2[1] } });
                    return true;
                }
                case "ELLIPSE":
                {
                    var p1 = o.Kose(); var p2 = o.Kose();
                    if (p1 == null || p2 == null) return false;
                    double cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2, rx = Math.Abs(p2[0] - p1[0]) / 2, ry = Math.Abs(p2[1] - p1[1]) / 2;
                    var parca = new List<double[]>();
                    for (int j = 0; j < 36; j++) { double t = j * Math.PI / 18; parca.Add(new[] { cx + rx * Math.Cos(t), cy + ry * Math.Sin(t) }); }
                    n.Tur = "alan";
                    n.Parcalar.Add(parca);
                    return true;
                }
                case "ARC":
                {
                    // Arc x1 y1 x2 y2 a b : çevreleyen dikdörtgen ve başlangıç / bitiş açısı (derece)
                    var p1 = o.Kose(); var p2 = o.Kose();
                    if (p1 == null || p2 == null || !o.Sayi(out a) || !o.Sayi(out b)) return false;
                    double cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2, rx = Math.Abs(p2[0] - p1[0]) / 2, ry = Math.Abs(p2[1] - p1[1]) / 2;
                    double bitis = b < a ? b + 360 : b;
                    int adim = Math.Max(4, (int)Math.Ceiling((bitis - a) / 10));
                    var parca = new List<double[]>();
                    for (int j = 0; j <= adim; j++) { double t = (a + (bitis - a) * j / adim) * Math.PI / 180; parca.Add(new[] { cx + rx * Math.Cos(t), cy + ry * Math.Sin(t) }); }
                    n.Tur = "cizgi";
                    n.Parcalar.Add(parca);
                    return true;
                }
                case "MULTIPOINT":
                {
                    int adet = o.Tam();
                    n.Tur = "nokta";
                    for (int j = 0; j < adet; j++) { var p = o.Kose(); if (p == null) return false; n.Parcalar.Add(new List<double[]> { p }); }
                    return n.Parcalar.Count > 0;
                }
                case "TEXT":
                {
                    // Text "yazı" x1 y1 x2 y2 (yazı bir alt satırda da olabilir)
                    string m = o.Bak.StartsWith("\"", StringComparison.Ordinal) ? o.Al() : "\"\"";
                    n.Metin = m.Length >= 2 ? m.Substring(1, m.Length - 2).Replace("\\n", " ") : "";
                    var p1 = o.Kose(); var p2 = o.Kose();
                    if (p1 == null || p2 == null) return false;
                    n.Tur = "yazi";
                    n.Parcalar.Add(new List<double[]> { new[] { Math.Min(p1[0], p2[0]), Math.Min(p1[1], p2[1]) }, new[] { Math.Max(p1[0], p2[0]), Math.Max(p1[1], p2[1]) } });
                    return true;
                }
                case "COLLECTION":
                {
                    // Collection n: ardından n parça (Region / Pline / Multipoint); hepsi tek nesne
                    int adet = o.Tam();
                    for (int j = 0; j < adet && !o.Bitti; j++)
                    {
                        string alt = o.Al().ToUpperInvariant();
                        var p = new MifNesnesi();
                        if (!NesneOku(v, o, alt, p)) return false;
                        if (n.Tur == "yok") n.Tur = p.Tur;
                        if (p.Tur == n.Tur) n.Parcalar.AddRange(p.Parcalar);
                        // Stil satırları parçaların arasında olabilir
                        while (!o.Bitti && !Nesneler.Contains(o.Bak) && (o.Bak.Equals("PEN", StringComparison.OrdinalIgnoreCase) || o.Bak.Equals("BRUSH", StringComparison.OrdinalIgnoreCase) || o.Bak.Equals("SYMBOL", StringComparison.OrdinalIgnoreCase)))
                        {
                            string st = o.Al().ToUpperInvariant();
                            var l = o.Liste();
                            int r;
                            if (n.Renk < 0 && st == "PEN" && l.Count >= 3 && int.TryParse(l[2], NumberStyles.Integer, Inv, out r)) n.Renk = r;
                        }
                    }
                    return n.Parcalar.Count > 0;
                }
            }
            return false;
        }

        /// <summary>MID satırları: ayırıcıyla bölünmüş, tırnaklı değerlerde ayırıcı ve satır sonu olabilir, "" içte tırnak.</summary>
        public static List<string[]> MidSatirlari(string mid, char ayirici)
        {
            var satirlar = new List<string[]>();
            var alanlar = new List<string>();
            var b = new StringBuilder();
            bool tirnak = false, deger = false;
            string s = mid ?? "";
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (tirnak)
                {
                    if (c == '"')
                    {
                        if (i + 1 < s.Length && s[i + 1] == '"') { b.Append('"'); i++; }
                        else tirnak = false;
                    }
                    else b.Append(c);
                    continue;
                }
                if (c == '"') { tirnak = true; deger = true; continue; }
                if (c == ayirici) { alanlar.Add(b.ToString().Trim()); b.Clear(); deger = true; continue; }
                if (c == '\r') continue;
                if (c == '\n')
                {
                    if (deger || b.Length > 0) { alanlar.Add(b.ToString().Trim()); satirlar.Add(alanlar.ToArray()); }
                    alanlar.Clear(); b.Clear(); deger = false;
                    continue;
                }
                b.Append(c);
                deger = true;
            }
            if (deger || b.Length > 0) { alanlar.Add(b.ToString().Trim()); satirlar.Add(alanlar.ToArray()); }
            return satirlar;
        }

        // =========================== Koordinat ===========================

        /// <summary>Datumu GRS80 / WGS84 ile eş sayılan (ayrıca dönüşüm gerekmeyen) MapInfo datum numaraları.</summary>
        private static readonly HashSet<int> EsDatumlar = new HashSet<int> { 0, 33, 74, 104, 1000, 1002 };

        /// <summary>
        /// Koordinatları çizimin dilimine (ITRF96 3° TM) çevirir: TM (başka dilim ya da ölçek) ve coğrafi koordinat çevrilir;
        /// düz koordinat olduğu gibi kalır. Datum GRS80 / WGS84 değilse uyarı eklenir (dönüşüm uygulanmaz).
        /// </summary>
        public static void CizimeCevir(MifVerisi v, int dom)
        {
            if (v.Sistem == "duz" || v.Sistem == "bilinmiyor")
            {
                if (v.BirimCarpani != 1) Hepsine(v, p => new[] { p[0] * v.BirimCarpani, p[1] * v.BirimCarpani });
                return;
            }
            if (!EsDatumlar.Contains(v.Datum))
                v.Uyarilar.Add("Dosyanın datumu (MapInfo " + Math.Abs(v.Datum) + ") ITRF96 / WGS84 değil; datum dönüşümü yapılmadı, konumlar birkaç metre kayabilir (ör. ED50).");
            if (v.Sistem == "cografi")
            {
                // Coğrafi sanılan ama metre olan koordinat (CoordSys yazılmamış dosyalar): olduğu gibi
                bool metre = false;
                foreach (var n in v.Nesneler) foreach (var pr in n.Parcalar) foreach (var p in pr) if (Math.Abs(p[0]) > 360 || Math.Abs(p[1]) > 90) metre = true;
                if (metre) { v.Sistem = "duz"; v.Uyarilar.Add("Koordinat sistemi yazılmamış; koordinatlar metre sayılıp olduğu gibi alındı."); return; }
                Hepsine(v, p => { double s, y; Koordinat.CizimKoordinati(p[1], p[0], dom, out s, out y); return new[] { s, y }; });
                return;
            }
            // TM
            bool ayni = Math.Abs(v.OrtaMeridyen - dom) < 1e-9 && Math.Abs(v.Olcek - 1) < 1e-12 && Math.Abs(v.SagaOteleme - Koordinat.SagaOteleme) < 1e-6 &&
                        Math.Abs(v.YukariOteleme) < 1e-6 && Math.Abs(v.BaslangicEnlemi) < 1e-12 && v.BirimCarpani == 1;
            if (ayni) return;
            if (Math.Abs(v.BaslangicEnlemi) > 1e-12) v.Uyarilar.Add("TM başlangıç enlemi 0 değil; dikkate alınmadı.");
            double c = v.BirimCarpani;
            Hepsine(v, p =>
            {
                double en, boy, s, y;
                Koordinat.TmdenEnlemBoylam(p[0] * c, p[1] * c, v.OrtaMeridyen, v.Olcek, v.SagaOteleme * c, v.YukariOteleme * c, out en, out boy);
                Koordinat.CizimKoordinati(en, boy, dom, out s, out y);
                return new[] { s, y };
            });
        }

        private static void Hepsine(MifVerisi v, Func<double[], double[]> f)
        {
            foreach (var n in v.Nesneler)
            {
                foreach (var pr in n.Parcalar)
                    for (int i = 0; i < pr.Count; i++) pr[i] = f(pr[i]);
                if (n.Tur == "yazi" && n.Parcalar.Count > 0 && n.Parcalar[0].Count >= 2)
                    n.YaziBoyu = Math.Abs(n.Parcalar[0][1][1] - n.Parcalar[0][0][1]);
            }
        }

        /// <summary>Yazı yüksekliklerini doldurur (çeviriden önce de çağrılabilir): çevreleyen kutunun yüksekliği.</summary>
        public static void YaziBoylari(MifVerisi v)
        {
            foreach (var n in v.Nesneler)
                if (n.Tur == "yazi" && n.YaziBoyu <= 0 && n.Parcalar.Count > 0 && n.Parcalar[0].Count >= 2)
                    n.YaziBoyu = Math.Abs(n.Parcalar[0][1][1] - n.Parcalar[0][0][1]);
        }
    }
}
