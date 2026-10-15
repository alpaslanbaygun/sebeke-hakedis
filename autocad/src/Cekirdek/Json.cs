using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Küçük, bağımlılıksız JSON okuyucu/yazıcı. .NET Framework 4.6 ve .NET 8'de aynı çalışır.
    /// Nesneler: JsonNesne (sıralı sözlük), diziler: List&lt;object&gt;, sayılar: double,
    /// metin: string, mantıksal: bool, boş: null.
    /// </summary>
    public sealed class JsonNesne : IEnumerable<KeyValuePair<string, object>>
    {
        private readonly List<string> _sira = new List<string>();
        private readonly Dictionary<string, object> _degerler = new Dictionary<string, object>(StringComparer.Ordinal);

        public object this[string ad]
        {
            get { object d; return _degerler.TryGetValue(ad, out d) ? d : null; }
            set
            {
                if (!_degerler.ContainsKey(ad)) _sira.Add(ad);
                _degerler[ad] = value;
            }
        }

        public bool Var(string ad) => _degerler.ContainsKey(ad);
        public int Sayi => _sira.Count;

        public string Metin(string ad, string varsayilan = "")
        {
            var d = this[ad];
            if (d == null) return varsayilan;
            if (d is string s) return s;
            if (d is double n) return n.ToString("R", CultureInfo.InvariantCulture);
            if (d is bool b) return b ? "true" : "false";
            return d.ToString();
        }

        public double Ondalik(string ad, double varsayilan = 0)
        {
            var d = this[ad];
            if (d is double n) return n;
            if (d is string s) return Sayi_.Coz(s, varsayilan);
            return varsayilan;
        }

        public int Tam(string ad, int varsayilan = 0)
        {
            var d = this[ad];
            if (d is double n) return (int)Math.Round(n);
            if (d is string s) return (int)Math.Round(Sayi_.Coz(s, varsayilan));
            return varsayilan;
        }

        public bool? Mantik(string ad)
        {
            var d = this[ad];
            if (d is bool b) return b;
            if (d is string s)
            {
                if (string.Equals(s, "true", StringComparison.OrdinalIgnoreCase)) return true;
                if (string.Equals(s, "false", StringComparison.OrdinalIgnoreCase)) return false;
            }
            return null;
        }

        public JsonNesne Nesne(string ad) => this[ad] as JsonNesne;
        public List<object> Dizi(string ad) => this[ad] as List<object>;

        public IEnumerator<KeyValuePair<string, object>> GetEnumerator()
        {
            foreach (var k in _sira) yield return new KeyValuePair<string, object>(k, _degerler[k]);
        }

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();

        // Sayı ayrıştırma için iç yardımcı (Sayi sınıfıyla ad çakışmasın diye)
        private static class Sayi_
        {
            public static double Coz(string s, double varsayilan) => SayiCoz.Coz(s, varsayilan);
        }
    }

    public static class Json
    {
        // ---------------- Okuma ----------------

        public static object Oku(string metin)
        {
            if (metin == null) throw new ArgumentNullException(nameof(metin));
            int i = 0;
            BosluguAtla(metin, ref i);
            var deger = DegerOku(metin, ref i);
            BosluguAtla(metin, ref i);
            if (i != metin.Length) throw Hata(metin, i, "Fazladan karakter");
            return deger;
        }

        private static object DegerOku(string s, ref int i)
        {
            if (i >= s.Length) throw Hata(s, i, "Beklenmeyen dosya sonu");
            char c = s[i];
            switch (c)
            {
                case '{': return NesneOku(s, ref i);
                case '[': return DiziOku(s, ref i);
                case '"': return MetinOku(s, ref i);
                case 't': Beklenen(s, ref i, "true"); return true;
                case 'f': Beklenen(s, ref i, "false"); return false;
                case 'n': Beklenen(s, ref i, "null"); return null;
                default:
                    if (c == '-' || (c >= '0' && c <= '9')) return SayiOku(s, ref i);
                    throw Hata(s, i, "Beklenmeyen karakter '" + c + "'");
            }
        }

        private static JsonNesne NesneOku(string s, ref int i)
        {
            var n = new JsonNesne();
            i++; // {
            BosluguAtla(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return n; }
            while (true)
            {
                BosluguAtla(s, ref i);
                if (i >= s.Length || s[i] != '"') throw Hata(s, i, "Anahtar bekleniyordu");
                string anahtar = MetinOku(s, ref i);
                BosluguAtla(s, ref i);
                if (i >= s.Length || s[i] != ':') throw Hata(s, i, "':' bekleniyordu");
                i++;
                BosluguAtla(s, ref i);
                n[anahtar] = DegerOku(s, ref i);
                BosluguAtla(s, ref i);
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (i < s.Length && s[i] == '}') { i++; return n; }
                throw Hata(s, i, "',' ya da '}' bekleniyordu");
            }
        }

        private static List<object> DiziOku(string s, ref int i)
        {
            var d = new List<object>();
            i++; // [
            BosluguAtla(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return d; }
            while (true)
            {
                BosluguAtla(s, ref i);
                d.Add(DegerOku(s, ref i));
                BosluguAtla(s, ref i);
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (i < s.Length && s[i] == ']') { i++; return d; }
                throw Hata(s, i, "',' ya da ']' bekleniyordu");
            }
        }

        private static string MetinOku(string s, ref int i)
        {
            i++; // "
            var sb = new StringBuilder();
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') return sb.ToString();
                if (c != '\\') { sb.Append(c); continue; }
                if (i >= s.Length) break;
                char e = s[i++];
                switch (e)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw Hata(s, i, "Eksik \\u kodu");
                        sb.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        i += 4;
                        break;
                    default: throw Hata(s, i, "Geçersiz kaçış karakteri");
                }
            }
            throw Hata(s, i, "Kapanmamış metin");
        }

        private static double SayiOku(string s, ref int i)
        {
            int bas = i;
            if (s[i] == '-') i++;
            while (i < s.Length)
            {
                char c = s[i];
                if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') i++;
                else break;
            }
            return double.Parse(s.Substring(bas, i - bas), NumberStyles.Float, CultureInfo.InvariantCulture);
        }

        private static void Beklenen(string s, ref int i, string kelime)
        {
            if (string.CompareOrdinal(s, i, kelime, 0, kelime.Length) != 0) throw Hata(s, i, "'" + kelime + "' bekleniyordu");
            i += kelime.Length;
        }

        private static void BosluguAtla(string s, ref int i)
        {
            while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n' || s[i] == '﻿')) i++;
        }

        private static FormatException Hata(string s, int i, string mesaj)
        {
            int satir = 1;
            for (int k = 0; k < i && k < s.Length; k++) if (s[k] == '\n') satir++;
            return new FormatException("JSON okunamadı (satır " + satir + "): " + mesaj);
        }

        // ---------------- Yazma ----------------

        public static string Yaz(object deger, bool girintili = true)
        {
            var sb = new StringBuilder();
            DegerYaz(sb, deger, girintili, 0);
            return sb.ToString();
        }

        private static void DegerYaz(StringBuilder sb, object d, bool g, int seviye)
        {
            if (d == null) { sb.Append("null"); return; }
            if (d is string s) { MetinYaz(sb, s); return; }
            if (d is bool b) { sb.Append(b ? "true" : "false"); return; }
            if (d is double x) { SayiYaz(sb, x); return; }
            if (d is float f) { SayiYaz(sb, f); return; }
            if (d is int n) { sb.Append(n.ToString(CultureInfo.InvariantCulture)); return; }
            if (d is long l) { sb.Append(l.ToString(CultureInfo.InvariantCulture)); return; }
            if (d is JsonNesne o) { NesneYaz(sb, o, g, seviye); return; }
            if (d is System.Collections.IEnumerable e) { DiziYaz(sb, e, g, seviye); return; }
            MetinYaz(sb, Convert.ToString(d, CultureInfo.InvariantCulture));
        }

        private static void NesneYaz(StringBuilder sb, JsonNesne o, bool g, int seviye)
        {
            if (o.Sayi == 0) { sb.Append("{}"); return; }
            sb.Append('{');
            bool ilk = true;
            foreach (var kv in o)
            {
                if (!ilk) sb.Append(',');
                ilk = false;
                if (g) { sb.Append('\n'); sb.Append(' ', (seviye + 1) * 2); }
                MetinYaz(sb, kv.Key);
                sb.Append(g ? ": " : ":");
                DegerYaz(sb, kv.Value, g, seviye + 1);
            }
            if (g) { sb.Append('\n'); sb.Append(' ', seviye * 2); }
            sb.Append('}');
        }

        private static void DiziYaz(StringBuilder sb, System.Collections.IEnumerable e, bool g, int seviye)
        {
            // Yalnız sayı içeren kısa diziler (koordinatlar) tek satırda yazılır.
            var ogeler = new List<object>();
            foreach (var x in e) ogeler.Add(x);
            if (ogeler.Count == 0) { sb.Append("[]"); return; }
            bool basit = true;
            foreach (var x in ogeler) if (!(x is double || x is int || x is long || x is float)) { basit = false; break; }
            bool satirli = g && !(basit && ogeler.Count <= 4);
            sb.Append('[');
            for (int k = 0; k < ogeler.Count; k++)
            {
                if (k > 0) sb.Append(satirli ? "," : ", ");
                if (satirli) { sb.Append('\n'); sb.Append(' ', (seviye + 1) * 2); }
                DegerYaz(sb, ogeler[k], g, seviye + 1);
            }
            if (satirli) { sb.Append('\n'); sb.Append(' ', seviye * 2); }
            sb.Append(']');
        }

        private static void SayiYaz(StringBuilder sb, double x)
        {
            if (double.IsNaN(x) || double.IsInfinity(x)) { sb.Append("null"); return; }
            if (Math.Abs(x - Math.Round(x)) < 1e-12 && Math.Abs(x) < 1e15)
                sb.Append(((long)Math.Round(x)).ToString(CultureInfo.InvariantCulture));
            else
                sb.Append(x.ToString("R", CultureInfo.InvariantCulture));
        }

        private static void MetinYaz(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }
    }
}
