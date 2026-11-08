using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Excel (.xlsx) dosyası yazan küçük, bağımlılıksız yazıcı. Bilgisayarda Excel kurulu olması gerekmez.
    /// Her sayfa: kalın başlık satırı, sabitlenmiş ilk satır, otomatik filtre, sütun genişlikleri.
    /// </summary>
    public sealed class XlsxYazici
    {
        public sealed class Sayfa
        {
            public string Ad;
            public List<string> Basliklar = new List<string>();
            public List<object[]> Satirlar = new List<object[]>();
            public Dictionary<int, double> Genislikler = new Dictionary<int, double>();
            /// <summary>Sütun → sayı biçimi: "0", "0.00", "#,##0.00"</summary>
            public Dictionary<int, string> SayiBicimleri = new Dictionary<int, string>();
            public bool Filtre = true;
            /// <summary>Başlıktan önce yazılacak açıklama satırları (ör. rapor başlığı).</summary>
            public List<string> UstBilgi = new List<string>();
        }

        private readonly List<Sayfa> _sayfalar = new List<Sayfa>();

        public Sayfa SayfaEkle(string ad)
        {
            var s = new Sayfa { Ad = SayfaAdiTemizle(ad) };
            _sayfalar.Add(s);
            return s;
        }

        public void Kaydet(string yol)
        {
            using (var fs = new FileStream(yol, FileMode.Create, FileAccess.Write))
                Kaydet(fs);
        }

        public void Kaydet(Stream akis)
        {
            // Biçimler: 0 normal, 1 başlık, 2 tam sayı, 3 iki ondalık, 4 ondalık (en çok 6), 5 üst bilgi
            using (var zip = new ZipArchive(akis, ZipArchiveMode.Create, true))
            {
                Yaz(zip, "[Content_Types].xml", IcerikTurleri());
                Yaz(zip, "_rels/.rels",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                    "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>" +
                    "<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/>" +
                    "</Relationships>");
                Yaz(zip, "docProps/core.xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">" +
                    "<dc:creator>Şebeke-M Hakediş</dc:creator>" +
                    "<dcterms:created xsi:type=\"dcterms:W3CDTF\">" + DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture) + "</dcterms:created>" +
                    "</cp:coreProperties>");
                Yaz(zip, "docProps/app.xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\"><Application>Şebeke-M Hakediş</Application></Properties>");
                Yaz(zip, "xl/workbook.xml", Kitap());
                Yaz(zip, "xl/_rels/workbook.xml.rels", KitapIliskileri());
                Yaz(zip, "xl/styles.xml", Bicimler());
                for (int i = 0; i < _sayfalar.Count; i++)
                    Yaz(zip, "xl/worksheets/sheet" + (i + 1) + ".xml", SayfaXml(_sayfalar[i]));
            }
        }

        private static void Yaz(ZipArchive zip, string ad, string icerik)
        {
            var g = zip.CreateEntry(ad, CompressionLevel.Optimal);
            using (var s = g.Open())
            using (var w = new StreamWriter(s, new UTF8Encoding(false)))
                w.Write(icerik);
        }

        private string IcerikTurleri()
        {
            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">");
            sb.Append("<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>");
            sb.Append("<Default Extension=\"xml\" ContentType=\"application/xml\"/>");
            sb.Append("<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>");
            sb.Append("<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>");
            sb.Append("<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>");
            sb.Append("<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>");
            for (int i = 0; i < _sayfalar.Count; i++)
                sb.Append("<Override PartName=\"/xl/worksheets/sheet" + (i + 1) + ".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
            sb.Append("</Types>");
            return sb.ToString();
        }

        private string Kitap()
        {
            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">");
            sb.Append("<bookViews><workbookView xWindow=\"0\" yWindow=\"0\" windowWidth=\"28800\" windowHeight=\"15000\"/></bookViews><sheets>");
            for (int i = 0; i < _sayfalar.Count; i++)
                sb.Append("<sheet name=\"" + Kacis(_sayfalar[i].Ad) + "\" sheetId=\"" + (i + 1) + "\" r:id=\"rId" + (i + 1) + "\"/>");
            sb.Append("</sheets>");
            // Otomatik filtre aralıkları
            var tanimlar = new StringBuilder();
            for (int i = 0; i < _sayfalar.Count; i++)
            {
                var s = _sayfalar[i];
                if (!s.Filtre || s.Basliklar.Count == 0) continue;
                int bas = s.UstBilgi.Count + 1;
                int son = bas + Math.Max(1, s.Satirlar.Count);
                tanimlar.Append("<definedName name=\"_xlnm._FilterDatabase\" localSheetId=\"" + i + "\" hidden=\"1\">'" +
                                Kacis(s.Ad.Replace("'", "''")) + "'!$A$" + bas + ":$" + SutunAdi(s.Basliklar.Count - 1) + "$" + son + "</definedName>");
            }
            if (tanimlar.Length > 0) sb.Append("<definedNames>").Append(tanimlar).Append("</definedNames>");
            sb.Append("</workbook>");
            return sb.ToString();
        }

        private string KitapIliskileri()
        {
            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
            for (int i = 0; i < _sayfalar.Count; i++)
                sb.Append("<Relationship Id=\"rId" + (i + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet" + (i + 1) + ".xml\"/>");
            sb.Append("<Relationship Id=\"rId" + (_sayfalar.Count + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
            sb.Append("</Relationships>");
            return sb.ToString();
        }

        private static string Bicimler()
        {
            return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
                "<numFmts count=\"2\"><numFmt numFmtId=\"164\" formatCode=\"#,##0.00\"/><numFmt numFmtId=\"165\" formatCode=\"#,##0.######\"/></numFmts>" +
                "<fonts count=\"3\">" +
                "<font><sz val=\"10\"/><name val=\"Calibri\"/><family val=\"2\"/></font>" +
                "<font><b/><sz val=\"10\"/><color rgb=\"FFFFFFFF\"/><name val=\"Calibri\"/><family val=\"2\"/></font>" +
                "<font><b/><sz val=\"12\"/><name val=\"Calibri\"/><family val=\"2\"/></font>" +
                "</fonts>" +
                "<fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill>" +
                "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF2F5597\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>" +
                "<borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border>" +
                "<border><left style=\"thin\"><color rgb=\"FFBFBFBF\"/></left><right style=\"thin\"><color rgb=\"FFBFBFBF\"/></right><top style=\"thin\"><color rgb=\"FFBFBFBF\"/></top><bottom style=\"thin\"><color rgb=\"FFBFBFBF\"/></bottom><diagonal/></border></borders>" +
                "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
                "<cellXfs count=\"6\">" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\"/>" +
                "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\" wrapText=\"1\"/></xf>" +
                "<xf numFmtId=\"1\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/>" +
                "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/>" +
                "<xf numFmtId=\"165\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/>" +
                "<xf numFmtId=\"0\" fontId=\"2\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>" +
                "</cellXfs>" +
                "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
                "</styleSheet>";
        }

        private static string SayfaXml(Sayfa s)
        {
            var sb = new StringBuilder(1 << 16);
            int ust = s.UstBilgi.Count;
            int baslikSatiri = ust + 1;
            int sonSatir = baslikSatiri + s.Satirlar.Count;
            int sutunSayisi = Math.Max(1, s.Basliklar.Count);
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">");
            sb.Append("<dimension ref=\"A1:" + SutunAdi(sutunSayisi - 1) + Math.Max(1, sonSatir) + "\"/>");
            sb.Append("<sheetViews><sheetView workbookViewId=\"0\"");
            sb.Append(s.Basliklar.Count > 0 ? "><pane ySplit=\"" + baslikSatiri + "\" topLeftCell=\"A" + (baslikSatiri + 1) + "\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView>" : "/>");
            sb.Append("</sheetViews>");
            sb.Append("<sheetFormatPr defaultRowHeight=\"14\"/>");
            // Sütun genişlikleri
            sb.Append("<cols>");
            for (int c = 0; c < sutunSayisi; c++)
            {
                double g;
                if (!s.Genislikler.TryGetValue(c, out g)) g = OtomatikGenislik(s, c);
                sb.Append("<col min=\"" + (c + 1) + "\" max=\"" + (c + 1) + "\" width=\"" + g.ToString("0.##", CultureInfo.InvariantCulture) + "\" customWidth=\"1\"/>");
            }
            sb.Append("</cols><sheetData>");
            int r = 1;
            foreach (var u in s.UstBilgi)
            {
                sb.Append("<row r=\"" + r + "\">");
                Hucre(sb, 0, r, u, 5);
                sb.Append("</row>");
                r++;
            }
            if (s.Basliklar.Count > 0)
            {
                sb.Append("<row r=\"" + r + "\" ht=\"30\" customHeight=\"1\">");
                for (int c = 0; c < s.Basliklar.Count; c++) Hucre(sb, c, r, s.Basliklar[c], 1);
                sb.Append("</row>");
                r++;
            }
            foreach (var satir in s.Satirlar)
            {
                sb.Append("<row r=\"" + r + "\">");
                for (int c = 0; c < satir.Length; c++)
                {
                    var d = satir[c];
                    if (d == null) continue;
                    int bicim = 0;
                    if (d is double || d is int || d is long || d is float)
                    {
                        string fmt;
                        bicim = s.SayiBicimleri.TryGetValue(c, out fmt) ? (fmt == "0" ? 2 : fmt == "0.00" ? 3 : 4) : 4;
                    }
                    Hucre(sb, c, r, d, bicim);
                }
                sb.Append("</row>");
                r++;
            }
            sb.Append("</sheetData>");
            if (s.Filtre && s.Basliklar.Count > 0)
                sb.Append("<autoFilter ref=\"A" + baslikSatiri + ":" + SutunAdi(s.Basliklar.Count - 1) + Math.Max(baslikSatiri + 1, sonSatir) + "\"/>");
            sb.Append("<pageMargins left=\"0.5\" right=\"0.5\" top=\"0.6\" bottom=\"0.6\" header=\"0.3\" footer=\"0.3\"/>");
            sb.Append("<pageSetup paperSize=\"9\" orientation=\"landscape\"/>");
            sb.Append("</worksheet>");
            return sb.ToString();
        }

        private static void Hucre(StringBuilder sb, int c, int r, object d, int bicim)
        {
            string adres = SutunAdi(c) + r;
            if (d is double x)
            {
                if (double.IsNaN(x) || double.IsInfinity(x)) return;
                sb.Append("<c r=\"" + adres + "\" s=\"" + bicim + "\"><v>" + x.ToString("R", CultureInfo.InvariantCulture) + "</v></c>");
            }
            else if (d is int i)
                sb.Append("<c r=\"" + adres + "\" s=\"" + bicim + "\"><v>" + i.ToString(CultureInfo.InvariantCulture) + "</v></c>");
            else if (d is long l)
                sb.Append("<c r=\"" + adres + "\" s=\"" + bicim + "\"><v>" + l.ToString(CultureInfo.InvariantCulture) + "</v></c>");
            else
            {
                string m = Convert.ToString(d, CultureInfo.InvariantCulture) ?? "";
                if (m.Length == 0 && bicim == 0) return;
                sb.Append("<c r=\"" + adres + "\" s=\"" + bicim + "\" t=\"inlineStr\"><is><t xml:space=\"preserve\">" + Kacis(m) + "</t></is></c>");
            }
        }

        private static double OtomatikGenislik(Sayfa s, int c)
        {
            int en = c < s.Basliklar.Count ? Math.Min(s.Basliklar[c].Length + 3, 22) : 8;
            int bak = 0;
            foreach (var satir in s.Satirlar)
            {
                if (c < satir.Length && satir[c] != null)
                {
                    int u = satir[c] is double ? 12 : Convert.ToString(satir[c], CultureInfo.InvariantCulture).Length;
                    if (u > en) en = u;
                }
                if (++bak > 2000) break;
            }
            return Math.Max(6, Math.Min(60, en + 2));
        }

        public static string SutunAdi(int c)
        {
            string ad = "";
            c++;
            while (c > 0)
            {
                int m = (c - 1) % 26;
                ad = (char)('A' + m) + ad;
                c = (c - 1) / 26;
            }
            return ad;
        }

        private static string Kacis(string s)
        {
            var sb = new StringBuilder(s.Length + 8);
            foreach (char ch in s)
            {
                switch (ch)
                {
                    case '&': sb.Append("&amp;"); break;
                    case '<': sb.Append("&lt;"); break;
                    case '>': sb.Append("&gt;"); break;
                    case '"': sb.Append("&quot;"); break;
                    default:
                        if (ch < 0x20 && ch != '\t' && ch != '\n' && ch != '\r') break; // XML'de geçersiz
                        sb.Append(ch);
                        break;
                }
            }
            return sb.ToString();
        }

        private static string SayfaAdiTemizle(string ad)
        {
            var sb = new StringBuilder();
            foreach (char ch in ad ?? "Sayfa")
                if ("[]:*?/\\".IndexOf(ch) < 0) sb.Append(ch);
            var s = sb.ToString().Trim();
            if (s.Length == 0) s = "Sayfa";
            return s.Length > 31 ? s.Substring(0, 31) : s;
        }
    }
}
