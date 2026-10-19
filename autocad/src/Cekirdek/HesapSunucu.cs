using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Hesap Merkezi'nin yerel web sunucusu. Hesap sayfaları bilgisayarın tarayıcısında (Edge uygulama penceresi) açılır;
    /// sayfa bağlamı buradan ister, sonucu buraya gönderir. Güvenlik:
    /// - yalnız 127.0.0.1 dinlenir (ağdan erişilemez, güvenlik duvarı sormaz), kapı rastgeledir;
    /// - her adres rastgele 128 bitlik bir anahtarla başlar (başka sayfalar adresi tahmin edemez);
    /// - Host başlığı 127.0.0.1 / localhost olmalı (DNS yeniden bağlama saldırısına karşı), API yalnız POST ve aynı köken;
    /// - dosya yolunda ".." ve ters bölü kabul edilmez.
    /// Dosyalar ve API yanıtları çağıranın verdiği işlevlerden gelir (eklentide gömülü kaynaklar ve çizim).
    /// </summary>
    public sealed class HesapSunucu : IDisposable
    {
        public const int EnBuyukGovde = 32 * 1024 * 1024;
        private const int EnBuyukBaslik = 64 * 1024;

        private readonly TcpListener _dinleyici;
        private readonly Func<string, byte[]> _dosya;
        private readonly Func<string, string, string> _api;
        private readonly Thread _dongu;
        private volatile bool _kapandi;

        /// <summary>Adreslerin başındaki gizli anahtar (32 onaltılık karakter).</summary>
        public string Anahtar { get; }
        public int Kapi { get; }
        /// <summary>Kök adres: http://127.0.0.1:kapı/anahtar/</summary>
        public string Kok => "http://127.0.0.1:" + Kapi.ToString(CultureInfo.InvariantCulture) + "/" + Anahtar + "/";
        /// <summary>İstek işlenirken oluşan hatalar (günlüğe yazmak için; isteğe bağlı).</summary>
        public Action<Exception> HataBildir;

        /// <param name="dosya">Göreli yol (ör. "enh-sehim.html", "ortak/logo.png") → içerik; yoksa null.</param>
        /// <param name="api">(ad, istek gövdesi JSON) → yanıt JSON; bilinmeyen ad için null. Ayrı iş parçacığında çağrılır.</param>
        public HesapSunucu(Func<string, byte[]> dosya, Func<string, string, string> api)
        {
            _dosya = dosya ?? throw new ArgumentNullException(nameof(dosya));
            _api = api ?? throw new ArgumentNullException(nameof(api));
            Anahtar = RastgeleAnahtar();
            _dinleyici = new TcpListener(IPAddress.Loopback, 0);
            _dinleyici.Start();
            Kapi = ((IPEndPoint)_dinleyici.LocalEndpoint).Port;
            _dongu = new Thread(Dinle) { IsBackground = true, Name = "SebekeM.HesapSunucu" };
            _dongu.Start();
        }

        public void Dispose()
        {
            _kapandi = true;
            try { _dinleyici.Stop(); } catch { }
        }

        public static string RastgeleAnahtar()
        {
            var b = new byte[16];
            using (var r = RandomNumberGenerator.Create()) r.GetBytes(b);
            var sb = new StringBuilder(32);
            foreach (var x in b) sb.Append(x.ToString("x2", CultureInfo.InvariantCulture));
            return sb.ToString();
        }

        private void Dinle()
        {
            while (!_kapandi)
            {
                TcpClient c;
                try { c = _dinleyici.AcceptTcpClient(); }
                catch (Exception e)
                {
                    if (_kapandi) return;
                    Bildir(e);
                    Thread.Sleep(50);
                    continue;
                }
                ThreadPool.QueueUserWorkItem(_ => Isle(c));
            }
        }

        private void Bildir(Exception e)
        {
            try { HataBildir?.Invoke(e); } catch { }
        }

        // ---------------- İstek ----------------

        public sealed class Istek
        {
            public string Yontem = "";
            public string Yol = "";          // sorgu dizgesi atılmış, kodu çözülmüş
            public Dictionary<string, string> Basliklar = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            public byte[] Govde = new byte[0];
        }

        public sealed class Yanit
        {
            public int Kod = 200;
            public string Tur = "text/plain; charset=utf-8";
            public byte[] Govde = new byte[0];
            /// <summary>302 yanıtında gidilecek adres.</summary>
            public string Yonlendir;

            public static Yanit Metin(int kod, string metin) =>
                new Yanit { Kod = kod, Govde = Encoding.UTF8.GetBytes(metin ?? "") };
            public static Yanit Json(int kod, string json) =>
                new Yanit { Kod = kod, Tur = "application/json; charset=utf-8", Govde = Encoding.UTF8.GetBytes(json ?? "null") };
        }

        private void Isle(TcpClient c)
        {
            using (c)
            {
                try
                {
                    c.ReceiveTimeout = 20000;
                    c.SendTimeout = 20000;
                    var s = c.GetStream();
                    Yanit yanit;
                    Istek istek;
                    try { istek = IstekOku(s); }
                    catch (InvalidDataException e) { YanitYaz(s, Yanit.Metin(400, e.Message), false); return; }
                    if (istek == null) return;
                    try { yanit = Yanitla(istek); }
                    catch (Exception e)
                    {
                        Bildir(e);
                        yanit = Yanit.Json(500, "{\"hata\":" + Json.Yaz(e.Message, false) + "}");
                    }
                    YanitYaz(s, yanit, istek.Yontem == "HEAD");
                }
                catch (Exception e) { Bildir(e); }
            }
        }

        /// <summary>HTTP/1.1 isteğini okur (başlık + Content-Length kadar gövde). Bağlantı boş kapanırsa null.</summary>
        public static Istek IstekOku(Stream s)
        {
            var baslik = new MemoryStream();
            int son = 0; // \r\n\r\n eşleşen uzunluk
            while (true)
            {
                int b = s.ReadByte();
                if (b < 0) { if (baslik.Length == 0) return null; throw new InvalidDataException("Eksik istek"); }
                baslik.WriteByte((byte)b);
                if (baslik.Length > EnBuyukBaslik) throw new InvalidDataException("Başlık çok uzun");
                son = (b == '\r' && (son == 0 || son == 2)) || (b == '\n' && (son == 1 || son == 3)) ? son + 1 : (b == '\r' ? 1 : 0);
                if (son == 4) break;
            }
            var satirlar = Encoding.UTF8.GetString(baslik.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
            var ilk = satirlar[0].Split(' ');
            if (ilk.Length < 3) throw new InvalidDataException("Geçersiz istek satırı");
            var ist = new Istek { Yontem = ilk[0].ToUpperInvariant() };
            string ham = ilk[1];
            int q = ham.IndexOfAny(new[] { '?', '#' });
            if (q >= 0) ham = ham.Substring(0, q);
            try { ist.Yol = Uri.UnescapeDataString(ham); }
            catch { throw new InvalidDataException("Geçersiz yol"); }
            for (int i = 1; i < satirlar.Length; i++)
            {
                var sat = satirlar[i];
                if (sat.Length == 0) continue;
                int k = sat.IndexOf(':');
                if (k <= 0) continue;
                ist.Basliklar[sat.Substring(0, k).Trim()] = sat.Substring(k + 1).Trim();
            }
            string uz;
            if (ist.Basliklar.TryGetValue("Content-Length", out uz))
            {
                long n;
                if (!long.TryParse(uz, NumberStyles.Integer, CultureInfo.InvariantCulture, out n) || n < 0 || n > EnBuyukGovde)
                    throw new InvalidDataException("Geçersiz gövde uzunluğu");
                var g = new byte[n];
                int okunan = 0;
                while (okunan < n)
                {
                    int r = s.Read(g, okunan, (int)(n - okunan));
                    if (r <= 0) throw new InvalidDataException("Eksik gövde");
                    okunan += r;
                }
                ist.Govde = g;
            }
            else if (ist.Basliklar.ContainsKey("Transfer-Encoding"))
                throw new InvalidDataException("Parçalı gövde desteklenmiyor");
            return ist;
        }

        /// <summary>İsteği yanıtlar (soket olmadan da sınanabilir).</summary>
        public Yanit Yanitla(Istek ist)
        {
            string host;
            ist.Basliklar.TryGetValue("Host", out host);
            string kapi = Kapi.ToString(CultureInfo.InvariantCulture);
            if (host != "127.0.0.1:" + kapi && host != "localhost:" + kapi)
                return Yanit.Metin(403, "Yasak");
            string on = "/" + Anahtar + "/";
            if (ist.Yol == "/" + Anahtar) return new Yanit { Kod = 302, Tur = "text/plain", Govde = new byte[0], Yonlendir = on };
            if (!ist.Yol.StartsWith(on, StringComparison.Ordinal)) return Yanit.Metin(404, "Bulunamadı");
            string gor = ist.Yol.Substring(on.Length);
            if (gor.Length == 0) gor = "merkez.html";
            if (gor.IndexOf('\\') >= 0 || gor.IndexOf('\0') >= 0) return Yanit.Metin(404, "Bulunamadı");
            foreach (var parca in gor.Split('/'))
                if (parca == ".." || parca == ".") return Yanit.Metin(404, "Bulunamadı");

            if (gor.StartsWith("api/", StringComparison.Ordinal))
            {
                if (ist.Yontem != "POST") return Yanit.Metin(405, "Yalnız POST");
                string koken;
                if (ist.Basliklar.TryGetValue("Origin", out koken) && koken != "http://127.0.0.1:" + kapi && koken != "http://localhost:" + kapi)
                    return Yanit.Metin(403, "Yasak köken");
                string govde = ist.Govde.Length == 0 ? "{}" : Encoding.UTF8.GetString(ist.Govde);
                string cevap = _api(gor.Substring(4), govde);
                return cevap == null ? Yanit.Json(404, "{\"hata\":\"Bilinmeyen işlem\"}") : Yanit.Json(200, cevap);
            }
            if (ist.Yontem != "GET" && ist.Yontem != "HEAD") return Yanit.Metin(405, "Yalnız GET");
            var icerik = _dosya(gor);
            if (icerik == null) return Yanit.Metin(404, "Bulunamadı");
            return new Yanit { Kod = 200, Tur = IcerikTuru(gor), Govde = icerik };
        }

        public static string IcerikTuru(string yol)
        {
            string u = Path.GetExtension(yol ?? "").ToLowerInvariant();
            switch (u)
            {
                case ".html": case ".htm": return "text/html; charset=utf-8";
                case ".js": case ".mjs": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".woff2": return "font/woff2";
                case ".txt": return "text/plain; charset=utf-8";
                default: return "application/octet-stream";
            }
        }

        private static string Durum(int kod)
        {
            switch (kod)
            {
                case 200: return "OK";
                case 302: return "Found";
                case 400: return "Bad Request";
                case 403: return "Forbidden";
                case 404: return "Not Found";
                case 405: return "Method Not Allowed";
                default: return kod >= 500 ? "Internal Server Error" : "OK";
            }
        }

        private static void YanitYaz(Stream s, Yanit y, bool govdesiz)
        {
            var sb = new StringBuilder();
            sb.Append("HTTP/1.1 ").Append(y.Kod.ToString(CultureInfo.InvariantCulture)).Append(' ').Append(Durum(y.Kod)).Append("\r\n");
            sb.Append("Content-Type: ").Append(y.Tur).Append("\r\n");
            sb.Append("Content-Length: ").Append(y.Govde.Length.ToString(CultureInfo.InvariantCulture)).Append("\r\n");
            if (!string.IsNullOrEmpty(y.Yonlendir)) sb.Append("Location: ").Append(y.Yonlendir).Append("\r\n");
            sb.Append("Cache-Control: no-store\r\n");
            sb.Append("X-Content-Type-Options: nosniff\r\n");
            sb.Append("Referrer-Policy: no-referrer\r\n");
            sb.Append("Connection: close\r\n\r\n");
            var b = Encoding.ASCII.GetBytes(sb.ToString());
            s.Write(b, 0, b.Length);
            if (!govdesiz && y.Govde.Length > 0) s.Write(y.Govde, 0, y.Govde.Length);
            s.Flush();
        }
    }
}
