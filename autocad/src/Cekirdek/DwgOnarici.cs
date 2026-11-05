using System;
using System.Collections.Generic;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Açılırken çöken çizimi AutoCAD'e açtırmadan onarır (DWG 2000 biçimi, AC1015).
    ///
    /// Eklentinin 0.1.57 ve öncesi bazı nesnelere değeri olmayan uygulama bölümü yazıyordu (GIS, NIT, MALZEME… adı var,
    /// verisi yok). AutoCAD bunu sıfır uzunluklu genişletilmiş veri bölümü olarak saklar; açarken sıfırı "veri bitti"
    /// sayar, arkasındaki bölümleri nesnenin kendi verisi diye okur ve çizim açılırken çöker (ya da RECOVER nesneleri
    /// atar). Onarım: her nesnenin genişletilmiş verisi okunur; ardından kayıtlı bir uygulama adı gelen sıfır uzunluklu
    /// bölümler çıkarılır, nesnenin bit boyu ve CRC'si yeniden hesaplanır, nesne dosyadaki yerine yazılır. Yeni nesne
    /// eskisinden kısa olduğu için hiçbir konum kaymaz, nesne haritası değişmez; başka hiçbir bayta dokunulmaz.
    /// Geliştirme aracı karşılığı: araclar/dwg-onar/dwg_onar.py (aynı kural).
    /// </summary>
    public static class DwgOnarici
    {
        public sealed class Sonuc
        {
            /// <summary>Onarılan nesneler: tanıtıcı (onaltılık) ve çıkarılan değersiz bölümlerin uygulama adları.</summary>
            public readonly List<KeyValuePair<string, List<string>>> Nesneler = new List<KeyValuePair<string, List<string>>>();
            /// <summary>Biçim desteklenmiyor ya da dosya okunamadı: neden. Boşsa dosya okundu.</summary>
            public string Hata = "";
            public int NesneSayisi;
            public bool Degisti => Nesneler.Count > 0;
        }

        /// <summary>Dosyanın sürüm imi (AC1015 = DWG 2000).</summary>
        public static string Surum(byte[] b) => b != null && b.Length >= 6 ? Encoding.ASCII.GetString(b, 0, 6) : "";

        public static string SurumAdi(string s)
        {
            switch (s)
            {
                case "AC1015": return "AutoCAD 2000";
                case "AC1018": return "AutoCAD 2004";
                case "AC1021": return "AutoCAD 2007";
                case "AC1024": return "AutoCAD 2010";
                case "AC1027": return "AutoCAD 2013";
                case "AC1032": return "AutoCAD 2018";
                default: return s;
            }
        }

        /// <summary>Onarır: girdi değişmez, onarılmış bayt dizisi cikti'ye (değişiklik yoksa girdinin kopyası).</summary>
        public static Sonuc Onar(byte[] girdi, out byte[] cikti)
        {
            var sonuc = new Sonuc();
            cikti = girdi == null ? null : (byte[])girdi.Clone();
            if (girdi == null || girdi.Length < 0x40) { sonuc.Hata = "Dosya DWG değil ya da boş."; return sonuc; }
            string surum = Surum(girdi);
            if (surum != "AC1015")
            {
                sonuc.Hata = surum.StartsWith("AC10", StringComparison.Ordinal)
                    ? "Bu çizim " + SurumAdi(surum) + " biçiminde. Onarım yalnız AutoCAD 2000 (DWG 2000) biçiminde yapılabiliyor."
                    : "Dosya DWG değil.";
                return sonuc;
            }
            try
            {
                var b = cikti;
                int n = BitConverter.ToInt32(b, 0x15);
                int haritaBas = -1, haritaBoy = 0;
                for (int i = 0; i < n && i < 16; i++)
                {
                    int o = 0x19 + i * 9;
                    if (b[o] == 2) { haritaBas = BitConverter.ToInt32(b, o + 1); haritaBoy = BitConverter.ToInt32(b, o + 5); }
                }
                if (haritaBas < 0 || haritaBas + haritaBoy > b.Length) { sonuc.Hata = "Nesne haritası bulunamadı."; return sonuc; }
                var harita = NesneHaritasi(b, haritaBas, haritaBoy);
                sonuc.NesneSayisi = harita.Count;

                // Kayıtlı uygulama adları (APPID, tür 67)
                var appid = new Dictionary<long, string>();
                foreach (var kv in harita)
                {
                    try
                    {
                        int k;
                        int sz = Ms(b, kv.Value, out k);
                        var r = new Okuyucu(b, kv.Value + k);
                        if (r.BS() != 67) continue;
                        r.RL(); r.H();
                        while (true)
                        {
                            int es = r.BS();
                            if (es == 0) break;
                            r.H(); r.P += es * 8;
                        }
                        r.BL();
                        appid[kv.Key] = r.T();
                    }
                    catch { }
                }

                foreach (var kv in harita)
                {
                    try { NesneOnar(b, kv.Key, kv.Value, appid, sonuc); }
                    catch { }
                }
            }
            catch (Exception ex) { sonuc.Hata = "Dosya okunamadı: " + ex.Message; }
            return sonuc;
        }

        private sealed class Bolum { public long Bas, Son; public string Ad; public int Boy; }

        private static void NesneOnar(byte[] b, long tanitici, int loc, Dictionary<long, string> appid, Sonuc sonuc)
        {
            int k;
            int sz = Ms(b, loc, out k);
            int veriBas = loc + k;
            if (veriBas + sz + 2 > b.Length) return;
            int crcDosya = b[veriBas + sz] | (b[veriBas + sz + 1] << 8);
            if (Crc(b, loc, k + sz) != crcDosya) return; // zaten bozuk nesneye dokunulmaz
            var r = new Okuyucu(b, veriBas);
            long turBas = r.P;
            r.BS();
            long rlBas = r.P;
            long bitBoy = r.RL();
            r.H();
            long hSon = r.P;
            var bolumler = new List<Bolum>();
            long sonlBas;
            while (true)
            {
                long bas = r.P;
                int es = r.BS();
                if (es == 0)
                {
                    long sifirSon = r.P;
                    int kod; long v;
                    try { r.H(out kod, out v); } catch { r.P = sifirSon; sonlBas = bas; break; }
                    if (kod == 5 && appid.ContainsKey(v)) { bolumler.Add(new Bolum { Bas = bas, Son = r.P, Ad = appid[v], Boy = 0 }); continue; }
                    r.P = sifirSon; sonlBas = bas; break;
                }
                int kod2; long v2;
                r.H(out kod2, out v2);
                r.P += es * 8L;
                string ad;
                bolumler.Add(new Bolum { Bas = bas, Son = r.P, Ad = appid.TryGetValue(v2, out ad) ? ad : v2.ToString("X"), Boy = es });
                if (r.P > (veriBas + sz) * 8L) return;
            }
            var bos = bolumler.FindAll(x => x.Boy == 0);
            if (bos.Count == 0) return;
            long silinen = 0;
            foreach (var x in bos) silinen += x.Son - x.Bas;

            var y = new Yazici();
            y.Bitler(b, turBas, rlBas);
            uint yeniBoy = (uint)(bitBoy - silinen);
            foreach (var bayt in BitConverter.GetBytes(yeniBoy)) y.Sayi(bayt, 8);
            y.Bitler(b, rlBas + 32, hSon);
            foreach (var x in bolumler) if (x.Boy > 0) y.Bitler(b, x.Bas, x.Son);
            y.Bitler(b, sonlBas, (veriBas + sz) * 8L);
            var veri = y.Baytlar();
            var on = MsYaz(veri.Length);
            var govde = new byte[on.Length + veri.Length + 2];
            Buffer.BlockCopy(on, 0, govde, 0, on.Length);
            Buffer.BlockCopy(veri, 0, govde, on.Length, veri.Length);
            int crc = Crc(govde, 0, on.Length + veri.Length);
            govde[govde.Length - 2] = (byte)(crc & 0xFF);
            govde[govde.Length - 1] = (byte)(crc >> 8);
            if (govde.Length > k + sz + 2) return;
            Buffer.BlockCopy(govde, 0, b, loc, govde.Length);
            var adlar = new List<string>();
            foreach (var x in bos) adlar.Add(x.Ad);
            sonuc.Nesneler.Add(new KeyValuePair<string, List<string>>(tanitici.ToString("X"), adlar));
        }

        // ---------------- DWG 2000 yapı taşları ----------------

        /// <summary>CRC-16 (DWG nesne CRC'si, başlangıç 0xC0C1).</summary>
        public static int Crc(byte[] b, int bas, int boy, int tohum = 0xC0C1)
        {
            int crc = tohum;
            for (int i = bas; i < bas + boy; i++)
            {
                crc ^= b[i];
                for (int j = 0; j < 8; j++) crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xA001 : crc >> 1;
            }
            return crc & 0xFFFF;
        }

        private static int Ms(byte[] b, int i, out int bayt)
        {
            int v = 0, kay = 0, bas = i;
            while (true)
            {
                int w = b[i] | (b[i + 1] << 8);
                i += 2;
                v |= (w & 0x7FFF) << kay;
                kay += 15;
                if ((w & 0x8000) == 0) { bayt = i - bas; return v; }
            }
        }

        public static byte[] MsYaz(int n)
        {
            var l = new List<byte>();
            while (true)
            {
                int w = n & 0x7FFF;
                n >>= 15;
                if (n != 0) w |= 0x8000;
                l.Add((byte)(w & 0xFF));
                l.Add((byte)(w >> 8));
                if (n == 0) return l.ToArray();
            }
        }

        private static long Mc(byte[] b, ref int i, bool isaretli)
        {
            long v = 0;
            int kay = 0;
            while (true)
            {
                int c = b[i++];
                if ((c & 0x80) != 0) { v |= (long)(c & 0x7F) << kay; kay += 7; continue; }
                if (isaretli)
                {
                    bool eksi = (c & 0x40) != 0;
                    v |= (long)(c & 0x3F) << kay;
                    return eksi ? -v : v;
                }
                v |= (long)(c & 0x7F) << kay;
                return v;
            }
        }

        /// <summary>Nesne haritası: tanıtıcı → dosyadaki konum (her bölüm kendi içinde göreli, büyük-sonlu boy).</summary>
        public static SortedDictionary<long, int> NesneHaritasi(byte[] b, int bas, int boy)
        {
            var h = new SortedDictionary<long, int>();
            int i = bas;
            while (i < bas + boy)
            {
                int sb = i;
                int bolum = (b[i] << 8) | b[i + 1];
                i += 2;
                if (bolum == 2) break;
                long t = 0, l = 0;
                while (i - sb < bolum)
                {
                    t += Mc(b, ref i, false);
                    l += Mc(b, ref i, true);
                    h[t] = (int)l;
                }
                i += 2;
            }
            return h;
        }

        public sealed class Okuyucu
        {
            private readonly byte[] _b;
            public long P;
            public Okuyucu(byte[] b, long bayt) { _b = b; P = bayt * 8; }
            public int Bit() { int v = (_b[P >> 3] >> (7 - (int)(P & 7))) & 1; P++; return v; }
            public long Bitler(int n) { long v = 0; for (int i = 0; i < n; i++) v = (v << 1) | (long)Bit(); return v; }
            public int RC() => (int)Bitler(8);
            public int RS() { int a = RC(); return a | (RC() << 8); }
            public long RL() { long a = RS(); return a | ((long)RS() << 16); }
            public int BS()
            {
                switch (Bitler(2))
                {
                    case 0: return RS();
                    case 1: return RC();
                    case 2: return 0;
                    default: return 256;
                }
            }
            public long BL()
            {
                switch (Bitler(2))
                {
                    case 0: return RL();
                    case 1: return RC();
                    case 2: return 0;
                    default: throw new FormatException("BL");
                }
            }
            public void H(out int kod, out long v)
            {
                kod = (int)Bitler(4);
                int n = (int)Bitler(4);
                v = 0;
                for (int i = 0; i < n; i++) v = (v << 8) | (long)RC();
            }
            public long H() { int k; long v; H(out k, out v); return v; }
            public string T()
            {
                int n = BS();
                var sb = new StringBuilder();
                for (int i = 0; i < n; i++)
                {
                    int c = RC();
                    if (c != 0) sb.Append((char)c);
                }
                return sb.ToString();
            }
        }

        public sealed class Yazici
        {
            private readonly List<byte> _b = new List<byte>();
            private long _n;
            public void Bit(int v)
            {
                if ((_n & 7) == 0) _b.Add(0);
                if (v != 0) _b[_b.Count - 1] |= (byte)(0x80 >> (int)(_n & 7));
                _n++;
            }
            public void Sayi(long v, int n) { for (int i = n - 1; i >= 0; i--) Bit((int)((v >> i) & 1)); }
            public void Bitler(byte[] kaynak, long bas, long son)
            {
                for (long p = bas; p < son; p++) Bit((kaynak[p >> 3] >> (7 - (int)(p & 7))) & 1);
            }
            public byte[] Baytlar() => _b.ToArray();
            public long BitSayisi => _n;
        }
    }
}
