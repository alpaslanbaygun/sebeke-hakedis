using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Excel (.xlsx / .xlsm) paketini zip içinde hücre düzeyinde düzenler: Birleşik Metraj şablonunu doldurmak için
    /// (ortak/BIRLESIK-METRAJ.md). Yalnız dokunulan sayfaların XML'i yeniden yazılır; makro (vbaProject.bin), stiller,
    /// listeler, koşullu biçimler ve tanımlı adlar aynen kalır. Telefondaki karşılığı telefon/web/src/export/xlsm.js;
    /// iki taraf aynı kuralları uygular.
    ///
    /// Kurallar:
    ///  - Metin inlineStr, sayı &lt;v&gt;, formül &lt;f&gt; ile yazılır; var olan hücrenin stili korunur, yeni hücre aynı sütunda
    ///    yukarıdaki en yakın hücrenin stilini alır.
    ///  - Paylaşılan formül (t="shared") grubunun ana hücresine yazılırken grup açılır: bağımlılara kendi formülleri yazılır.
    ///  - Yazarken calcChain.xml silinir ve workbook.xml'e fullCalcOnLoad="1" konur: Excel açılınca her şeyi yeniden hesaplar.
    /// </summary>
    public sealed class XlsmDosyasi
    {
        public sealed class SayfaKaydi { public string Ad, Yol, SheetId, Durum; }
        public sealed class TanimliAdBilgisi { public string Sayfa; public int BasSutun, BasSatir, BitSutun, BitSatir; }

        private readonly Dictionary<string, byte[]> _dosyalar;
        private readonly Dictionary<string, XlsmSayfa> _sayfalar = new Dictionary<string, XlsmSayfa>(StringComparer.Ordinal);
        private List<string> _dizeler;
        public string Workbook;
        public readonly Dictionary<string, string> Rel = new Dictionary<string, string>(StringComparer.Ordinal);
        public readonly List<SayfaKaydi> Sayfalar = new List<SayfaKaydi>();
        public readonly Dictionary<string, string> TanimliAdlar = new Dictionary<string, string>(StringComparer.Ordinal);

        public static XlsmDosyasi Ac(byte[] bytes)
        {
            using (var ms = new MemoryStream(bytes)) return Ac(ms);
        }

        public static XlsmDosyasi Ac(Stream akis)
        {
            var dosyalar = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            using (var zip = new ZipArchive(akis, ZipArchiveMode.Read, true))
            {
                foreach (var g in zip.Entries)
                {
                    if (g.FullName.EndsWith("/")) continue;
                    using (var s = g.Open())
                    using (var ms = new MemoryStream())
                    {
                        s.CopyTo(ms);
                        dosyalar[g.FullName] = ms.ToArray();
                    }
                }
            }
            if (!dosyalar.ContainsKey("xl/workbook.xml")) throw new InvalidDataException("Excel dosyası değil (xl/workbook.xml yok).");
            return new XlsmDosyasi(dosyalar);
        }

        public static string Dec(byte[] b) => Encoding.UTF8.GetString(b);
        public static byte[] Enc(string s) => Encoding.UTF8.GetBytes(s);

        private XlsmDosyasi(Dictionary<string, byte[]> dosyalar)
        {
            _dosyalar = dosyalar;
            Workbook = Dec(dosyalar["xl/workbook.xml"]);
            string rels = dosyalar.ContainsKey("xl/_rels/workbook.xml.rels") ? Dec(dosyalar["xl/_rels/workbook.xml.rels"]) : "";
            foreach (Match m in Regex.Matches(rels, @"<Relationship\b[^>]*>"))
            {
                var id = Regex.Match(m.Value, "\\bId=\"([^\"]+)\""); var tg = Regex.Match(m.Value, "\\bTarget=\"([^\"]+)\"");
                if (id.Success && tg.Success) Rel[id.Groups[1].Value] = Regex.Replace(Regex.Replace(tg.Groups[1].Value, "^/xl/", ""), "^/", "");
            }
            foreach (Match m in Regex.Matches(Workbook, @"<sheet\b[^>]*>"))
            {
                var ad = XmlCoz(Grup(m.Value, "\\bname=\"([^\"]*)\""));
                var rid = Grup(m.Value, "\\br:id=\"([^\"]+)\"");
                string hedef;
                var yol = "xl/" + (rid != null && Rel.TryGetValue(rid, out hedef) ? hedef : "worksheets/sheet" + (Sayfalar.Count + 1) + ".xml");
                Sayfalar.Add(new SayfaKaydi { Ad = ad, Yol = yol, SheetId = Grup(m.Value, "\\bsheetId=\"(\\d+)\""), Durum = Grup(m.Value, "\\bstate=\"([^\"]+)\"") ?? "visible" });
            }
            foreach (Match m in Regex.Matches(Workbook, @"<definedName\b([^>]*)>([\s\S]*?)</definedName>"))
            {
                var ad = Grup(m.Groups[1].Value, "\\bname=\"([^\"]+)\"");
                if (ad != null) TanimliAdlar[ad] = XmlCoz(m.Groups[2].Value);
            }
        }

        internal static string Grup(string s, string desen) { var m = Regex.Match(s, desen); return m.Success ? m.Groups[1].Value : null; }

        public byte[] Dosya(string ad) { byte[] b; return _dosyalar.TryGetValue(ad, out b) ? b : null; }
        public void DosyaYaz(string ad, byte[] icerik) { _dosyalar[ad] = icerik; }
        public void DosyaSil(string ad) { _dosyalar.Remove(ad); }
        public IEnumerable<string> DosyaAdlari() { return new List<string>(_dosyalar.Keys); }

        public string PaylasilanDize(int i)
        {
            if (_dizeler == null)
            {
                _dizeler = new List<string>();
                string ss = _dosyalar.ContainsKey("xl/sharedStrings.xml") ? Dec(_dosyalar["xl/sharedStrings.xml"]) : "";
                foreach (Match m in Regex.Matches(ss, @"<si>([\s\S]*?)</si>|<si/>")) _dizeler.Add(m.Groups[1].Success ? MetinParcalari(m.Groups[1].Value) : "");
            }
            return i >= 0 && i < _dizeler.Count ? _dizeler[i] : "";
        }

        public List<string> SayfaAdlari() { var l = new List<string>(); foreach (var s in Sayfalar) l.Add(s.Ad); return l; }

        public XlsmSayfa Sayfa(string ad)
        {
            XlsmSayfa s;
            if (_sayfalar.TryGetValue(ad, out s)) return s;
            SayfaKaydi k = null;
            foreach (var x in Sayfalar) if (x.Ad == ad) { k = x; break; }
            if (k == null || !_dosyalar.ContainsKey(k.Yol)) throw new InvalidDataException("Sayfa yok: " + ad);
            s = new XlsmSayfa(ad, k.Yol, Dec(_dosyalar[k.Yol]), this);
            _sayfalar[ad] = s;
            return s;
        }

        /// <summary>"'DİREK METRAJI'!$G$10:$ZZ$10" → sayfa ve aralık; tek hücre ise baş = bit; çözülemezse null.</summary>
        public TanimliAdBilgisi TanimliAd(string ad)
        {
            string t;
            if (!TanimliAdlar.TryGetValue(ad, out t)) return null;
            var m = Regex.Match(t.Trim(), @"^(?:'((?:[^']|'')*)'|([^'!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$");
            if (!m.Success) return null;
            var b = new TanimliAdBilgisi
            {
                Sayfa = m.Groups[1].Success ? m.Groups[1].Value.Replace("''", "'") : m.Groups[2].Value,
                BasSutun = SutunNo(m.Groups[3].Value), BasSatir = int.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture)
            };
            if (m.Groups[5].Success) { b.BitSutun = SutunNo(m.Groups[5].Value); b.BitSatir = int.Parse(m.Groups[6].Value, CultureInfo.InvariantCulture); }
            else { b.BitSutun = b.BasSutun; b.BitSatir = b.BasSatir; }
            return b;
        }

        /// <summary>Yeni (boş) sayfa ekler.</summary>
        public XlsmSayfa SayfaEkle(string ad)
        {
            int n = Sayfalar.Count + 1, k = n;
            string yol = "xl/worksheets/sheet" + n + ".xml";
            while (_dosyalar.ContainsKey(yol)) { k++; yol = "xl/worksheets/sheet" + k + ".xml"; }
            string rid = "rIdSM" + k;
            int sheetId = 0;
            foreach (var s in Sayfalar) { int v; if (int.TryParse(s.SheetId ?? "", out v) && v > sheetId) sheetId = v; }
            sheetId++;
            _dosyalar[yol] = Enc("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><dimension ref=\"A1\"/><sheetViews><sheetView workbookViewId=\"0\"/></sheetViews><sheetFormatPr defaultRowHeight=\"15\"/><sheetData/></worksheet>");
            Workbook = Workbook.Replace("</sheets>", "<sheet name=\"" + XmlKac(ad) + "\" sheetId=\"" + sheetId + "\" r:id=\"" + rid + "\"/></sheets>");
            const string relYol = "xl/_rels/workbook.xml.rels";
            string rels = Dec(_dosyalar[relYol]);
            rels = rels.Replace("</Relationships>", "<Relationship Id=\"" + rid + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"" + yol.Substring(3) + "\"/></Relationships>");
            _dosyalar[relYol] = Enc(rels);
            string ct = Dec(_dosyalar["[Content_Types].xml"]);
            if (ct.IndexOf("PartName=\"/" + yol + "\"", StringComparison.Ordinal) < 0)
                ct = ct.Replace("</Types>", "<Override PartName=\"/" + yol + "\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            _dosyalar["[Content_Types].xml"] = Enc(ct);
            Sayfalar.Add(new SayfaKaydi { Ad = ad, Yol = yol, SheetId = sheetId.ToString(CultureInfo.InvariantCulture), Durum = "visible" });
            Rel[rid] = yol.Substring(3);
            return Sayfa(ad);
        }

        /// <summary>Paketi yazar: değişen sayfalar, workbook (fullCalcOnLoad), calcChain silinir.</summary>
        public byte[] Yaz()
        {
            foreach (var s in _sayfalar.Values) if (s.Degisti) _dosyalar[s.Yol] = Enc(s.Xml());
            string wb = Workbook;
            if (Regex.IsMatch(wb, @"<calcPr\b"))
            {
                wb = Regex.Replace(wb, @"<calcPr\b([^>]*?)/>", m =>
                {
                    var a = m.Groups[1].Value;
                    return "<calcPr" + (Regex.IsMatch(a, "\\bfullCalcOnLoad=") ? Regex.Replace(a, "\\bfullCalcOnLoad=\"[^\"]*\"", "fullCalcOnLoad=\"1\"") : a + " fullCalcOnLoad=\"1\"") + "/>";
                }, RegexOptions.None, TimeSpan.FromSeconds(10));
            }
            else wb = wb.Replace("</workbook>", "<calcPr fullCalcOnLoad=\"1\"/></workbook>");
            _dosyalar["xl/workbook.xml"] = Enc(wb);
            Workbook = wb;
            if (_dosyalar.ContainsKey("xl/calcChain.xml"))
            {
                _dosyalar.Remove("xl/calcChain.xml");
                const string relYol = "xl/_rels/workbook.xml.rels";
                if (_dosyalar.ContainsKey(relYol)) _dosyalar[relYol] = Enc(Regex.Replace(Dec(_dosyalar[relYol]), "<Relationship\\b[^>]*Target=\"calcChain\\.xml\"[^>]*/>", ""));
                if (_dosyalar.ContainsKey("[Content_Types].xml")) _dosyalar["[Content_Types].xml"] = Enc(Regex.Replace(Dec(_dosyalar["[Content_Types].xml"]), "<Override\\b[^>]*PartName=\"/xl/calcChain\\.xml\"[^>]*/>", ""));
            }
            var adlar = new List<string>(_dosyalar.Keys);
            adlar.Sort((a, b) => a == "[Content_Types].xml" ? -1 : b == "[Content_Types].xml" ? 1 : string.CompareOrdinal(a, b));
            using (var ms = new MemoryStream())
            {
                using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
                {
                    foreach (var ad in adlar)
                    {
                        var g = zip.CreateEntry(ad, CompressionLevel.Optimal);
                        using (var s = g.Open()) { var b = _dosyalar[ad]; s.Write(b, 0, b.Length); }
                    }
                }
                return ms.ToArray();
            }
        }

        // ---------------- yardımcılar (telefonun xlsm.js'iyle aynı) ----------------

        public static int SutunNo(string harf)
        {
            int n = 0;
            foreach (var ch in harf.ToUpperInvariant()) n = n * 26 + (ch - 64);
            return n;
        }

        public static string SutunHarfi(int n)
        {
            var s = "";
            while (n > 0) { int k = (n - 1) % 26; s = (char)(65 + k) + s; n = (n - 1) / 26; }
            return s;
        }

        public static void HucreCoz(string ref_, out int sutun, out int satir)
        {
            var m = Regex.Match(ref_.ToUpperInvariant(), @"^\$?([A-Z]+)\$?(\d+)$");
            if (!m.Success) throw new ArgumentException("Hücre adresi değil: " + ref_);
            sutun = SutunNo(m.Groups[1].Value);
            satir = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
        }

        public static string HucreAdi(int sutun, int satir) => SutunHarfi(sutun) + satir.ToString(CultureInfo.InvariantCulture);

        public static string XmlKac(string s) => (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

        public static string XmlCoz(string s)
        {
            if (string.IsNullOrEmpty(s)) return s ?? "";
            s = s.Replace("&lt;", "<").Replace("&gt;", ">").Replace("&quot;", "\"").Replace("&apos;", "'");
            s = Regex.Replace(s, "&#(\\d+);", m => char.ConvertFromUtf32(int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture)));
            s = Regex.Replace(s, "&#x([0-9a-fA-F]+);", m => char.ConvertFromUtf32(int.Parse(m.Groups[1].Value, NumberStyles.HexNumber, CultureInfo.InvariantCulture)));
            return s.Replace("&amp;", "&");
        }

        /// <summary>&lt;is&gt; ya da &lt;si&gt; içindeki metin (düz ya da zengin metin parçaları).</summary>
        public static string MetinParcalari(string ic)
        {
            var sb = new StringBuilder();
            foreach (Match m in Regex.Matches(ic, @"<t\b[^>]*>([\s\S]*?)</t>")) sb.Append(XmlCoz(m.Groups[1].Value));
            return sb.ToString();
        }

        private static readonly Regex _basvuru = new Regex(@"^(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![\w(])", RegexOptions.CultureInvariant);

        /// <summary>
        /// Formülü (dsatir, dsutun) kadar kaydırır: göreli başvurular değişir, mutlak ($) parçalar kalır; tırnak içi
        /// metinler, sayfa adları ve işlev adları (LOG10( gibi) dokunulmaz.
        /// </summary>
        public static string FormulKaydir(string formul, int dsatir, int dsutun)
        {
            if (string.IsNullOrEmpty(formul) || (dsatir == 0 && dsutun == 0)) return formul;
            var s = formul; var sb = new StringBuilder(); int i = 0;
            while (i < s.Length)
            {
                char ch = s[i];
                if (ch == '"' || ch == '\'')
                {
                    int j = i + 1;
                    while (j < s.Length) { if (s[j] == ch) { if (j + 1 < s.Length && s[j + 1] == ch) { j += 2; continue; } break; } j++; }
                    sb.Append(s, i, Math.Min(j + 1, s.Length) - i); i = j + 1; continue;
                }
                var m = _basvuru.Match(s.Substring(i));
                char onceki = i > 0 ? s[i - 1] : '\0';
                bool sozcukOncesi = i > 0 && (char.IsLetterOrDigit(onceki) || onceki == '_' || onceki == '.');
                if (m.Success && !sozcukOncesi)
                {
                    int sutun = SutunNo(m.Groups[2].Value), satir = int.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture);
                    if (m.Groups[1].Value.Length == 0) sutun += dsutun;
                    if (m.Groups[3].Value.Length == 0) satir += dsatir;
                    if (sutun < 1 || satir < 1) { sb.Append(m.Value); i += m.Length; continue; }
                    sb.Append(m.Groups[1].Value).Append(SutunHarfi(sutun)).Append(m.Groups[3].Value).Append(satir.ToString(CultureInfo.InvariantCulture));
                    i += m.Length;
                    continue;
                }
                sb.Append(ch); i++;
            }
            return sb.ToString();
        }
    }

    /// <summary>Bir sayfanın XML'i: satırlar ve hücreler ayrıştırılmış; yazılınca yeniden kurulur.</summary>
    public sealed class XlsmSayfa
    {
        public sealed class Hucre { public string Nitelik = "", Ic = ""; }
        public sealed class Satir { public string Nitelik = ""; public SortedDictionary<int, Hucre> Hucreler = new SortedDictionary<int, Hucre>(); }
        public sealed class HucreBilgisi { public string Tur, V, Formul, PaylasilanRef, Inline, Stil; public int? PaylasilanSi; }
        public sealed class PaylasilanAnaBilgisi { public string Ref, Formul, Aralik; }

        public readonly string Ad, Yol;
        public bool Degisti;
        private string _on, _son;
        private readonly XlsmDosyasi _paket;
        public readonly SortedDictionary<int, Satir> Satirlar = new SortedDictionary<int, Satir>();
        private Dictionary<int, PaylasilanAnaBilgisi> _analar;

        private static readonly Regex _satirDeseni = new Regex(@"<row\b([^>]*?)(/>|>([\s\S]*?)</row>)", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _hucreDeseni = new Regex(@"<c\b([^>]*?)(?:/>|>([\s\S]*?)</c>)", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _satirNoDeseni = new Regex("\\br=\"(\\d+)\"", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _satirNitelikTemiz = new Regex("\\br=\"\\d+\"|\\bspans=\"[^\"]*\"", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _hucreNitelikTemiz = new Regex("\\br=\"[A-Z]+\\d+\"", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public XlsmSayfa(string ad, string yol, string xml, XlsmDosyasi paket)
        {
            Ad = ad; Yol = yol; _paket = paket;
            int bas = xml.IndexOf("<sheetData", StringComparison.Ordinal), bitis = xml.IndexOf("</sheetData>", StringComparison.Ordinal);
            if (bas < 0) throw new InvalidDataException("Sayfa XML'inde sheetData yok: " + ad);
            int kapanis = xml.IndexOf('>', bas);
            bool kendiKapanan = xml.Substring(bas, kapanis + 1 - bas).EndsWith("/>", StringComparison.Ordinal);
            _on = xml.Substring(0, bas);
            string ic;
            if (kendiKapanan) { ic = ""; _son = xml.Substring(kapanis + 1); }
            else { ic = xml.Substring(kapanis + 1, bitis - kapanis - 1); _son = xml.Substring(bitis + "</sheetData>".Length); }
            foreach (Match rm in _satirDeseni.Matches(ic))
            {
                var rsM = _satirNoDeseni.Match(rm.Groups[1].Value);
                if (!rsM.Success) continue;
                int r = int.Parse(rsM.Groups[1].Value, CultureInfo.InvariantCulture);
                var satir = new Satir { Nitelik = _satirNitelikTemiz.Replace(rm.Groups[1].Value, "").Trim() };
                int k = 1;
                if (rm.Groups[3].Success)
                {
                    foreach (Match cm in _hucreDeseni.Matches(rm.Groups[3].Value))
                    {
                        var refM = _hucreRefDeseni.Match(cm.Groups[1].Value);
                        int c = refM.Success ? XlsmDosyasi.SutunNo(refM.Groups[1].Value) : k;
                        k = c + 1;
                        satir.Hucreler[c] = new Hucre { Nitelik = _hucreNitelikTemiz.Replace(cm.Groups[1].Value, "").Trim(), Ic = cm.Groups[2].Success ? cm.Groups[2].Value : "" };
                    }
                }
                Satirlar[r] = satir;
            }
        }

        public void Sinirlar(out int satir, out int sutun)
        {
            satir = 0; sutun = 0;
            foreach (var kv in Satirlar)
            {
                if (kv.Key > satir) satir = kv.Key;
                foreach (var c in kv.Value.Hucreler.Keys) if (c > sutun) sutun = c;
            }
        }

        public Hucre HucreAl(string ref_)
        {
            int sutun, satir; XlsmDosyasi.HucreCoz(ref_, out sutun, out satir);
            Satir s; Hucre h;
            return Satirlar.TryGetValue(satir, out s) && s.Hucreler.TryGetValue(sutun, out h) ? h : null;
        }

        private static readonly Regex _turDeseni = new Regex("\\bt=\"([^\"]+)\"", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _stilDeseni = new Regex("\\bs=\"(\\d+)\"", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _degerDeseni = new Regex(@"<v>([\s\S]*?)</v>", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _formulDeseni = new Regex(@"<f\b([^>]*?)(?:/>|>([\s\S]*?)</f>)", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex _hucreRefDeseni = new Regex("\\br=\"([A-Z]+)(\\d+)\"", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public HucreBilgisi Oku(string ref_)
        {
            var h = HucreAl(ref_);
            if (h == null) return null;
            var tm = _turDeseni.Match(h.Nitelik); var sm = _stilDeseni.Match(h.Nitelik);
            var b = new HucreBilgisi { Tur = tm.Success ? tm.Groups[1].Value : null, Stil = sm.Success ? sm.Groups[1].Value : null };
            var v = _degerDeseni.Match(h.Ic);
            if (v.Success) b.V = XlsmDosyasi.XmlCoz(v.Groups[1].Value);
            var f = _formulDeseni.Match(h.Ic);
            if (f.Success)
            {
                b.Formul = f.Groups[2].Success ? XlsmDosyasi.XmlCoz(f.Groups[2].Value) : "";
                if (Regex.IsMatch(f.Groups[1].Value, "\\bt=\"shared\""))
                {
                    var si = XlsmDosyasi.Grup(f.Groups[1].Value, "\\bsi=\"(\\d+)\"");
                    b.PaylasilanSi = si != null ? int.Parse(si, CultureInfo.InvariantCulture) : 0;
                    b.PaylasilanRef = XlsmDosyasi.Grup(f.Groups[1].Value, "\\bref=\"([^\"]+)\"");
                }
            }
            if (b.Tur == "inlineStr") b.Inline = XlsmDosyasi.MetinParcalari(h.Ic);
            return b;
        }

        /// <summary>Hücrenin metni (paylaşılan dize çözülür; sayı olduğu gibi; boş → "").</summary>
        public string Metin(string ref_)
        {
            var o = Oku(ref_);
            if (o == null) return "";
            if (o.Tur == "s") { int i; return int.TryParse(o.V ?? "", NumberStyles.Integer, CultureInfo.InvariantCulture, out i) ? _paket.PaylasilanDize(i) : ""; }
            if (o.Tur == "inlineStr") return o.Inline ?? "";
            return o.V ?? "";
        }

        /// <summary>Hücrenin formülü (paylaşılan bağımlıysa ana formülden çevrilir); formül yoksa null.</summary>
        public string Formul(string ref_)
        {
            var o = Oku(ref_);
            if (o == null || o.Formul == null) return null;
            if (o.PaylasilanSi.HasValue && o.Formul.Length == 0)
            {
                var ana = PaylasilanAna(o.PaylasilanSi.Value);
                if (ana == null) return null;
                int ac, ar, bc, br; XlsmDosyasi.HucreCoz(ana.Ref, out ac, out ar); XlsmDosyasi.HucreCoz(ref_, out bc, out br);
                return XlsmDosyasi.FormulKaydir(ana.Formul, br - ar, bc - ac);
            }
            return o.Formul;
        }

        public PaylasilanAnaBilgisi PaylasilanAna(int si)
        {
            if (_analar == null)
            {
                _analar = new Dictionary<int, PaylasilanAnaBilgisi>();
                foreach (var rk in Satirlar)
                    foreach (var ck in rk.Value.Hucreler)
                    {
                        var h = ck.Value;
                        if (string.IsNullOrEmpty(h.Ic) || h.Ic.IndexOf("t=\"shared\"", StringComparison.Ordinal) < 0) continue;
                        var f = Regex.Match(h.Ic, @"<f\b([^>]*?)>([\s\S]*?)</f>");
                        if (!f.Success || !Regex.IsMatch(f.Groups[1].Value, "\\bref=\"")) continue;
                        var siS = XlsmDosyasi.Grup(f.Groups[1].Value, "\\bsi=\"(\\d+)\"");
                        _analar[siS != null ? int.Parse(siS, CultureInfo.InvariantCulture) : 0] = new PaylasilanAnaBilgisi { Ref = XlsmDosyasi.HucreAdi(ck.Key, rk.Key), Formul = XlsmDosyasi.XmlCoz(f.Groups[2].Value), Aralik = XlsmDosyasi.Grup(f.Groups[1].Value, "\\bref=\"([^\"]+)\"") };
                    }
            }
            PaylasilanAnaBilgisi a;
            return _analar.TryGetValue(si, out a) ? a : null;
        }

        /// <summary>Paylaşılan grubun ana hücresi değişmeden önce grup açılır: bağımlılara kendi formülleri yazılır.</summary>
        public void PaylasilanAc(int si)
        {
            var ana = PaylasilanAna(si);
            if (ana == null) return;
            int ac, ar; XlsmDosyasi.HucreCoz(ana.Ref, out ac, out ar);
            foreach (var rk in Satirlar)
                foreach (var ck in rk.Value.Hucreler)
                {
                    var h = ck.Value;
                    if (string.IsNullOrEmpty(h.Ic) || h.Ic.IndexOf("t=\"shared\"", StringComparison.Ordinal) < 0) continue;
                    var f = Regex.Match(h.Ic, @"<f\b([^>]*?)(?:/>|>([\s\S]*?)</f>)");
                    if (!f.Success) continue;
                    var siS = XlsmDosyasi.Grup(f.Groups[1].Value, "\\bsi=\"(\\d+)\"");
                    if ((siS != null ? int.Parse(siS, CultureInfo.InvariantCulture) : -1) != si) continue;
                    if (ck.Key == ac && rk.Key == ar) continue;
                    var yeni = XlsmDosyasi.FormulKaydir(ana.Formul, rk.Key - ar, ck.Key - ac);
                    h.Ic = Regex.Replace(h.Ic, @"<f\b[^>]*?(?:/>|>[\s\S]*?</f>)", "<f>" + XlsmDosyasi.XmlKac(yeni) + "</f>");
                }
            _analar.Remove(si);
            Degisti = true;
        }

        private Satir _Satir(int r)
        {
            Satir s;
            if (!Satirlar.TryGetValue(r, out s)) { s = new Satir(); Satirlar[r] = s; }
            return s;
        }

        /// <summary>Aynı sütunda yukarıdaki (300 satıra kadar) en yakın hücrenin stili.</summary>
        public string StilBul(int sutun, int satir)
        {
            for (int r = satir; r >= Math.Max(1, satir - 300); r--)
            {
                Satir s; Hucre h;
                if (Satirlar.TryGetValue(r, out s) && s.Hucreler.TryGetValue(sutun, out h))
                {
                    var st = XlsmDosyasi.Grup(h.Nitelik, "\\bs=\"(\\d+)\"");
                    if (st != null) return st;
                }
            }
            return null;
        }

        private Hucre _Hazirla(string ref_)
        {
            int sutun, satir; XlsmDosyasi.HucreCoz(ref_, out sutun, out satir);
            var s = _Satir(satir);
            Hucre h;
            if (s.Hucreler.TryGetValue(sutun, out h))
            {
                var o = Oku(ref_);
                if (o != null && o.PaylasilanSi.HasValue && !string.IsNullOrEmpty(o.Formul)) PaylasilanAc(o.PaylasilanSi.Value);
                h.Nitelik = Regex.Replace(h.Nitelik, "\\bt=\"[^\"]*\"", "").Trim();
            }
            else
            {
                var stil = StilBul(sutun, satir);
                h = new Hucre { Nitelik = stil != null ? "s=\"" + stil + "\"" : "", Ic = "" };
                s.Hucreler[sutun] = h;
            }
            Degisti = true;
            return h;
        }

        public void YazMetin(string ref_, string metin)
        {
            var h = _Hazirla(ref_);
            if (string.IsNullOrEmpty(metin)) { h.Ic = ""; return; }
            h.Nitelik = (h.Nitelik + " t=\"inlineStr\"").Trim();
            bool bosluk = metin[0] == ' ' || metin[metin.Length - 1] == ' ' || char.IsWhiteSpace(metin[0]) || char.IsWhiteSpace(metin[metin.Length - 1]);
            h.Ic = "<is><t" + (bosluk ? " xml:space=\"preserve\"" : "") + ">" + XlsmDosyasi.XmlKac(metin) + "</t></is>";
        }

        public void YazSayi(string ref_, double sayi)
        {
            var h = _Hazirla(ref_);
            if (double.IsNaN(sayi) || double.IsInfinity(sayi)) { h.Ic = ""; return; }
            h.Ic = "<v>" + SayiYazisi(sayi) + "</v>";
        }

        /// <summary>JavaScript'in sayı yazımıyla aynı ("2.7", "24.58", "1e-7" gibi kısa gösterim).</summary>
        public static string SayiYazisi(double d)
        {
            if (d == Math.Floor(d) && Math.Abs(d) < 1e15) return ((long)d).ToString(CultureInfo.InvariantCulture);
            return d.ToString("R", CultureInfo.InvariantCulture);
        }

        /// <summary>Formül ("=" olmadan). Önbellek değeri yazılmaz; fullCalcOnLoad ile Excel hesaplar.</summary>
        public void YazFormul(string ref_, string formul)
        {
            var h = _Hazirla(ref_);
            var f = formul ?? "";
            if (f.StartsWith("=", StringComparison.Ordinal)) f = f.Substring(1);
            h.Ic = "<f>" + XlsmDosyasi.XmlKac(f) + "</f>";
        }

        /// <summary>Değere göre yazar: sayı → sayı, "=…" → formül, metin → metin, null / "" → boşaltır.</summary>
        public void Yaz(string ref_, object deger)
        {
            if (deger == null) { Temizle(ref_); return; }
            if (deger is double) { YazSayi(ref_, (double)deger); return; }
            if (deger is int) { YazSayi(ref_, (int)deger); return; }
            if (deger is long) { YazSayi(ref_, (long)deger); return; }
            var s = deger.ToString();
            if (s.Length == 0) { Temizle(ref_); return; }
            if (s[0] == '=') { YazFormul(ref_, s.Substring(1)); return; }
            YazMetin(ref_, s);
        }

        public void Temizle(string ref_) { var h = _Hazirla(ref_); h.Ic = ""; }

        /// <summary>Hücrenin stilini başka hücreden alır (yeni sütun başlıkları için).</summary>
        public void StilKopyala(string kaynakRef, string hedefRef)
        {
            var k = HucreAl(kaynakRef);
            var stil = k != null ? XlsmDosyasi.Grup(k.Nitelik, "\\bs=\"(\\d+)\"") : null;
            int sutun, satir; XlsmDosyasi.HucreCoz(hedefRef, out sutun, out satir);
            var s = _Satir(satir);
            Hucre h;
            if (!s.Hucreler.TryGetValue(sutun, out h)) { h = new Hucre(); s.Hucreler[sutun] = h; }
            h.Nitelik = Regex.Replace(h.Nitelik, "\\bs=\"\\d+\"", "").Trim();
            if (stil != null) h.Nitelik = ("s=\"" + stil + "\" " + h.Nitelik).Trim();
            Degisti = true;
        }

        public void SatirGoster(int r)
        {
            Satir s;
            if (Satirlar.TryGetValue(r, out s) && Regex.IsMatch(s.Nitelik, "\\bhidden=\"1\"")) { s.Nitelik = Regex.Replace(s.Nitelik, "\\s*\\bhidden=\"1\"", "").Trim(); Degisti = true; }
        }

        public void SatirGizle(int r)
        {
            var s = _Satir(r);
            if (!Regex.IsMatch(s.Nitelik, "\\bhidden=\"1\"")) { s.Nitelik = (s.Nitelik + " hidden=\"1\"").Trim(); Degisti = true; }
        }

        public bool SatirGizliMi(int r) { Satir s; return Satirlar.TryGetValue(r, out s) && Regex.IsMatch(s.Nitelik, "\\bhidden=\"1\""); }

        /// <summary>&lt;cols&gt; içinde sütun genişliği: kaynak sütunun &lt;col&gt; tanımı hedefe kopyalanır (hedefi kapsayan varsa dokunulmaz).</summary>
        public void SutunGenisligiKopyala(int kaynak, int hedef)
        {
            var m = Regex.Match(_on, @"<cols>([\s\S]*?)</cols>");
            if (!m.Success) return;
            string bulunan = null;
            foreach (Match cm in Regex.Matches(m.Groups[1].Value, @"<col\b[^>]*/>"))
            {
                int min = int.Parse(XlsmDosyasi.Grup(cm.Value, "\\bmin=\"(\\d+)\"") ?? "0", CultureInfo.InvariantCulture), max = int.Parse(XlsmDosyasi.Grup(cm.Value, "\\bmax=\"(\\d+)\"") ?? "0", CultureInfo.InvariantCulture);
                if (kaynak >= min && kaynak <= max) { bulunan = cm.Value; break; }
            }
            if (bulunan == null) return;
            foreach (Match cm in Regex.Matches(m.Groups[1].Value, @"<col\b[^>]*/>"))
            {
                int min = int.Parse(XlsmDosyasi.Grup(cm.Value, "\\bmin=\"(\\d+)\"") ?? "0", CultureInfo.InvariantCulture), max = int.Parse(XlsmDosyasi.Grup(cm.Value, "\\bmax=\"(\\d+)\"") ?? "0", CultureInfo.InvariantCulture);
                if (hedef >= min && hedef <= max) return;
            }
            var yeni = Regex.Replace(Regex.Replace(bulunan, "\\bmin=\"\\d+\"", "min=\"" + hedef + "\""), "\\bmax=\"\\d+\"", "max=\"" + hedef + "\"");
            _on = _on.Replace("</cols>", yeni + "</cols>");
            Degisti = true;
        }

        /// <summary>XML'i yeniden kurar.</summary>
        public string Xml()
        {
            var ic = new StringBuilder();
            int maxC = 1, maxR = 1;
            foreach (var rk in Satirlar)
            {
                var s = rk.Value;
                if (s.Hucreler.Count == 0 && s.Nitelik.Length == 0) continue;
                maxR = rk.Key;
                var hc = new StringBuilder();
                int ilk = -1, son = -1;
                foreach (var ck in s.Hucreler)
                {
                    if (ilk < 0) ilk = ck.Key;
                    son = ck.Key;
                    if (ck.Key > maxC) maxC = ck.Key;
                    var h = ck.Value;
                    hc.Append("<c r=\"").Append(XlsmDosyasi.HucreAdi(ck.Key, rk.Key)).Append('"');
                    if (h.Nitelik.Length > 0) hc.Append(' ').Append(h.Nitelik);
                    if (h.Ic.Length > 0) hc.Append('>').Append(h.Ic).Append("</c>"); else hc.Append("/>");
                }
                ic.Append("<row r=\"").Append(rk.Key).Append('"');
                if (ilk > 0) ic.Append(" spans=\"").Append(ilk).Append(':').Append(son).Append('"');
                if (s.Nitelik.Length > 0) ic.Append(' ').Append(s.Nitelik);
                if (hc.Length > 0) ic.Append('>').Append(hc).Append("</row>"); else ic.Append("/>");
            }
            var on = Regex.Replace(_on, "<dimension ref=\"[^\"]*\"/>", "<dimension ref=\"A1:" + XlsmDosyasi.HucreAdi(maxC, maxR) + "\"/>");
            return on + "<sheetData>" + ic + "</sheetData>" + _son;
        }
    }
}
