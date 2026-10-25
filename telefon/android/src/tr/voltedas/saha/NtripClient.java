package tr.voltedas.saha;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Düzeltme (RTCM) istemcisi. İki bağlantı türü:
 *  - "ntrip": NTRIP v1 / v2 (TUSAGA-Aktif, kendi sabit istasyonunun yayıncısı, yerel CORS ağları);
 *  - "tcp":   doğrudan IP:port (NTRIP'siz; sabit istasyon RTCM'i düz TCP ile veriyorsa).
 * RTCM akışını dinleyiciye verir (doğrudan GNSS alıcısına yazılır), VRS için alıcının son geçerli GGA cümlesini
 * bağlanır bağlanmaz ve sonra düzenli gönderir (veri gelmese de), kopunca geri çekilmeli yeniden bağlanır.
 * Android bağımsızdır (JDK ile test edilebilir: android/test/NtripTest.java).
 */
public final class NtripClient {
    public interface Listener {
        void onRtcm(byte[] b, int off, int len);
        void onStatus(String state, String error);
        void onStats(Stats s);
    }
    public interface GgaSource { String latestGGA(); }

    public static final class Config {
        /** "ntrip" ya da "tcp" (doğrudan IP:port). */
        public String mode = "ntrip";
        public String host = ""; public int port = 2101; public String mount = ""; public String user = ""; public String pass = "";
        public int version = 2; public boolean sendGGA = true; public int ggaSec = 1; public int timeoutMs = 10000;
        /** Alıcının geçerli GGA'sı yokken gönderilecek yaklaşık konum (telefonun konumundan üretilir; boş olabilir). */
        public String ggaFallback = "";
        /** Bu kadar süre hiç veri gelmezse bağlantı yenilenir (ms). */
        public int dataTimeoutMs = 20000;
        public boolean isTcp() { return "tcp".equalsIgnoreCase(mode); }
    }
    public static final class Mount {
        public String name, identifier, format, formatDetails, nav, network, country; public double lat, lon; public boolean nmea; public String raw;
    }
    /** Saniyelik akış özeti. */
    public static final class Stats {
        public long bytes; public double rateBps; public Map<Integer, Integer> types; public long lastFrameMs;
        public long frames, crcErrors;
        /** Referans istasyonu (RTCM 1005/1006): kimlik ve yer merkezli koordinatlar (m). id &lt; 0: henüz gelmedi. */
        public int stationId = -1; public double x, y, z;
    }
    /** Akış denemesinin sonucu (alıcı bağlı olmadan). */
    public static final class Probe {
        public boolean connected; public String error; public long bytes, frames, crcErrors; public Map<Integer, Integer> types;
        public int stationId = -1; public double x, y, z; public long firstDataMs = -1;
    }

    /** Yeniden denemenin anlamsız olduğu hata (şifre, bağlantı noktası, erişim): istemci durur, kullanıcı düzeltir. */
    static final class KaliciHata extends IOException { KaliciHata(String m) { super(m); } }

    private final Config cfg; private final GgaSource gga; private final Listener ls;
    private volatile boolean running; private volatile Socket sock; private Thread th;
    private final Rtcm3Parser parser = new Rtcm3Parser();
    /** Oturumda veri geldi mi (geldiyse yeniden bağlanma beklemesi baştan başlar). */
    private volatile boolean gotData;
    /** Süren GGA yazımının başlangıcı (ms; 0: yazım yok). Karşı taraf okumazsa yazım kilitlenir; okuyucu bunu sezer. */
    private volatile long ggaYazmaBasi;

    public NtripClient(Config cfg, GgaSource gga, Listener ls) { this.cfg = cfg; this.gga = gga; this.ls = ls; }

    public synchronized void start() {
        if (running) return;
        running = true;
        th = new Thread(this::loop, "ntrip");
        th.setDaemon(true);
        th.start();
    }
    public synchronized void stop() {
        running = false;
        try { if (sock != null) sock.close(); } catch (IOException ignored) { }
        if (th != null) th.interrupt();
        ls.onStatus("off", null);
    }
    public boolean isRunning() { return running; }
    public Rtcm3Parser parser() { return parser; }

    private void loop() {
        int backoff = 2000;
        while (running) {
            gotData = false;
            try {
                if (running) ls.onStatus("connecting", null);
                session();
            } catch (KaliciHata e) {
                // Şifre / bağlantı noktası / erişim hatası: sunucuyu yormadan dur (hesap kilitlenmesin), kullanıcı düzeltir
                if (running) { running = false; ls.onStatus("error", e.getMessage()); }
                break;
            } catch (Exception e) {
                if (!running) break;
                ls.onStatus("error", message(e));
            }
            if (!running) break;
            if (gotData) backoff = 2000; // veri almış bir oturum koptuysa kısa beklemeyle yeniden bağlan
            try { Thread.sleep(backoff); } catch (InterruptedException ie) { break; }
            backoff = Math.min(backoff * 2, 30000);
        }
    }

    static String message(Exception e) {
        if (e instanceof java.net.UnknownHostException) return "Sunucu adı bulunamadı (internet ya da adres): " + e.getMessage();
        if (e instanceof java.net.ConnectException) return "Sunucuya bağlanılamadı (adres / port kapalı)";
        if (e instanceof SocketTimeoutException) return "Sunucu yanıt vermedi (zaman aşımı)";
        return e.getMessage() == null ? e.toString() : e.getMessage();
    }

    private static String basic(String u, String p) {
        return Base64.getEncoder().encodeToString((u + ":" + p).getBytes(StandardCharsets.UTF_8));
    }

    static String request(Config c, String path, String ggaLine) {
        StringBuilder sb = new StringBuilder();
        boolean v2 = c.version >= 2;
        sb.append("GET /").append(path).append(v2 ? " HTTP/1.1\r\n" : " HTTP/1.0\r\n");
        if (v2) { sb.append("Host: ").append(c.host).append(':').append(c.port).append("\r\n"); sb.append("Ntrip-Version: Ntrip/2.0\r\n"); }
        sb.append("User-Agent: NTRIP SebekeM/2.5\r\n");
        if (c.user != null && !c.user.isEmpty()) sb.append("Authorization: Basic ").append(basic(c.user, c.pass == null ? "" : c.pass)).append("\r\n");
        if (v2 && ggaLine != null && !ggaLine.isEmpty()) sb.append("Ntrip-GGA: ").append(ggaLine.trim()).append("\r\n");
        sb.append("Accept: */*\r\nConnection: close\r\n\r\n");
        return sb.toString();
    }

    /** Başlık satırlarını okur (boş satıra ya da ICY yanıtına kadar). */
    static List<String> readHeader(InputStream in) throws IOException {
        List<String> lines = new ArrayList<>();
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        while (true) {
            int b = in.read();
            if (b < 0) { if (line.size() > 0) lines.add(line.toString("ISO-8859-1")); return lines; }
            if (b == '\n') {
                String s = line.toString("ISO-8859-1"); line.reset();
                if (s.endsWith("\r")) s = s.substring(0, s.length() - 1);
                if (s.isEmpty()) return lines;
                lines.add(s);
                if (lines.size() == 1 && s.startsWith("ICY 200")) return lines; // v1: veri hemen başlar
                if (lines.size() > 64) throw new IOException("Başlık çok uzun");
            } else line.write(b);
            if (line.size() > 4096) throw new IOException("Geçersiz yanıt");
        }
    }

    /** Gönderilecek GGA: alıcının son geçerli GGA'sı, yoksa yapılandırmadaki yaklaşık konum. */
    private String currentGga() {
        String g = gga != null ? gga.latestGGA() : null;
        if (g == null || g.trim().isEmpty()) g = cfg.ggaFallback;
        return g == null || g.trim().isEmpty() ? null : g.trim();
    }
    private static void writeLine(OutputStream out, String line) throws IOException {
        out.write((line + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
        out.flush();
    }

    /** Sunucunun ilk yanıtı: hata ise açıklamalı istisna (şifre / bağlantı noktası / erişim hatası kalıcıdır). */
    static boolean checkResponse(List<String> hdr, Config c) throws IOException {
        if (hdr.isEmpty()) throw new IOException("Sunucu yanıt vermedi");
        String st = hdr.get(0);
        String ST = st.toUpperCase(Locale.ROOT);
        if (st.startsWith("SOURCETABLE")) throw new KaliciHata("Bağlantı noktası (mountpoint) bulunamadı: " + c.mount);
        if (st.contains(" 401") || ST.contains("BAD PASSWORD") || ST.contains("UNAUTHORIZED"))
            throw new KaliciHata("Kullanıcı adı ya da şifre yanlış (401)");
        if (st.contains(" 403")) throw new KaliciHata("Erişim reddedildi (403): hesabın süresi ya da aynı anda bağlantı sınırı");
        if (st.contains(" 404")) throw new KaliciHata("Bağlantı noktası (mountpoint) bulunamadı (404)");
        if (!(st.startsWith("ICY 200") || st.matches("HTTP/1\\.[01] 200.*"))) throw new IOException("Sunucu: " + st);
        boolean chunked = false;
        for (String h : hdr) {
            String l = h.toLowerCase(Locale.ROOT);
            if (l.startsWith("transfer-encoding:") && l.contains("chunked")) chunked = true;
            // v2 yayıncısı bilinmeyen bağlantı noktasında 200 + kaynak tablosu döndürür
            if (l.startsWith("content-type:") && l.contains("sourcetable")) throw new KaliciHata("Bağlantı noktası (mountpoint) bulunamadı: " + c.mount);
        }
        return chunked;
    }

    /**
     * GGA yazıcısı: ilk GGA'yı hemen, sonra her ggaSec saniyede gönderir (ayrı iş parçacığında; karşı taraf okumazsa
     * yazım kilitlenir, okuyucu ggaYazmaBasi ile sezip bağlantıyı yeniler).
     */
    private Thread ggaYazici(final Socket s, final OutputStream out) {
        Thread w = new Thread(() -> {
            boolean ilk = true;
            try {
                while (running && !s.isClosed()) {
                    if (!ilk) Thread.sleep(Math.max(1, cfg.ggaSec) * 1000L);
                    ilk = false;
                    String gl = currentGga();
                    if (gl == null) { if (!running) break; Thread.sleep(500); ilk = true; continue; }
                    ggaYazmaBasi = System.currentTimeMillis();
                    writeLine(out, gl);
                    ggaYazmaBasi = 0;
                }
            } catch (Exception ignored) { ggaYazmaBasi = 0; }
        }, "ntrip-gga");
        w.setDaemon(true);
        w.start();
        return w;
    }

    private void session() throws IOException {
        Socket s = new Socket();
        sock = s;
        Thread yazici = null;
        ggaYazmaBasi = 0;
        try {
            if (cfg.host == null || cfg.host.trim().isEmpty()) throw new IOException("Sunucu adresi boş");
            s.connect(new InetSocketAddress(cfg.host.trim(), cfg.port), cfg.timeoutMs);
            s.setSoTimeout(Math.max(cfg.timeoutMs, 15000));
            s.setTcpNoDelay(true);
            OutputStream out = s.getOutputStream();
            InputStream in = s.getInputStream();
            if (!cfg.isTcp()) {
                // NTRIP: istek (v2'de GGA başlıkta), v1'de GGA isteğin hemen ardından; sonra yanıt başlığı
                String g = cfg.sendGGA ? currentGga() : null;
                out.write(request(cfg, cfg.mount, g).getBytes(StandardCharsets.ISO_8859_1));
                if (cfg.version < 2 && g != null) out.write((g + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
                out.flush();
                List<String> hdr = readHeader(in);
                if (checkResponse(hdr, cfg)) in = new ChunkedInputStream(in);
            }
            // Doğrudan TCP'de istek ve başlık yok, akış hemen başlar. GGA (açıksa) ayrı yazıcıyla: hemen ve düzenli
            // (VRS yayıncısı ilk GGA'yı beklerken veri gelmese de gider)
            if (cfg.sendGGA) yazici = ggaYazici(s, out);
            if (!running) return;
            ls.onStatus("connected", null);
            s.setSoTimeout(1000);
            byte[] buf = new byte[4096];
            long now = System.currentTimeMillis();
            long lastStat = now, lastData = now, statBytes = 0;
            int dataTimeout = Math.max(cfg.dataTimeoutMs, 5000);
            while (running) {
                int n;
                try { n = in.read(buf); } catch (SocketTimeoutException te) { n = 0; }
                if (n < 0) throw new IOException("Sunucu bağlantıyı kapattı");
                now = System.currentTimeMillis();
                if (n > 0) { gotData = true; ls.onRtcm(buf, 0, n); parser.push(buf, 0, n); statBytes += n; lastData = now; }
                else if (now - lastData > dataTimeout) throw new IOException("Düzeltme verisi gelmiyor (" + dataTimeout / 1000 + " s)" + (cfg.sendGGA && currentGga() == null ? " · alıcıdan konum (GGA) gelmedi" : ""));
                long wb = ggaYazmaBasi;
                if (wb != 0 && now - wb > dataTimeout) throw new IOException("Sunucu konum iletisini (GGA) almıyor; bağlantı yenileniyor");
                if (now - lastStat >= 1000) {
                    if (!running) break;
                    ls.onStats(stats(statBytes * 1000.0 / Math.max(1, now - lastStat)));
                    statBytes = 0; lastStat = now;
                }
            }
        } finally {
            try { s.close(); } catch (IOException ignored) { }
            if (yazici != null) yazici.interrupt();
        }
    }

    private Stats stats(double rate) {
        Stats st = new Stats();
        synchronized (parser) {
            st.bytes = parser.bytes; st.types = parser.snapshot(); st.lastFrameMs = parser.lastFrameMs; st.frames = parser.frames; st.crcErrors = parser.crcErrors;
            st.stationId = parser.stationId; st.x = parser.stationX; st.y = parser.stationY; st.z = parser.stationZ;
        }
        st.rateBps = rate;
        return st;
    }

    /**
     * Akış denemesi: alıcı bağlı olmadan sunucuya bağlanır, birkaç saniye RTCM okur ve özetler (şifre, bağlantı noktası
     * ve verinin gelip gelmediği; istasyon konumu). VRS için yapılandırmadaki yaklaşık GGA gönderilir.
     */
    public static Probe probe(Config c, int seconds) {
        final Probe r = new Probe();
        final long t0 = System.currentTimeMillis();
        final NtripClient nc = new NtripClient(c, null, new Listener() {
            @Override public void onRtcm(byte[] b, int off, int len) { if (r.firstDataMs < 0) r.firstDataMs = System.currentTimeMillis() - t0; }
            @Override public void onStatus(String state, String error) { if ("connected".equals(state)) r.connected = true; }
            @Override public void onStats(Stats s) { }
        });
        nc.running = true;
        final String[] err = new String[1];
        Thread t = new Thread(() -> { try { nc.session(); } catch (Exception e) { if (nc.running) err[0] = message(e); } }, "ntrip-deneme");
        t.setDaemon(true);
        t.start();
        long deadline = t0 + Math.max(2, Math.min(seconds, 30)) * 1000L;
        try {
            while (t.isAlive() && System.currentTimeMillis() < deadline) {
                t.join(200);
                // Yeterli bilgi geldiyse erken bitir: istasyon konumu ve en az 5 çerçeve
                synchronized (nc.parser) { if (nc.parser.stationId >= 0 && nc.parser.frames >= 5) break; }
            }
        } catch (InterruptedException ignored) { }
        nc.running = false;
        try { Socket s = nc.sock; if (s != null) s.close(); } catch (IOException ignored) { }
        try { t.join(2000); } catch (InterruptedException ignored) { }
        synchronized (nc.parser) {
            r.bytes = nc.parser.bytes; r.frames = nc.parser.frames; r.crcErrors = nc.parser.crcErrors; r.types = nc.parser.snapshot();
            r.stationId = nc.parser.stationId; r.x = nc.parser.stationX; r.y = nc.parser.stationY; r.z = nc.parser.stationZ;
        }
        r.error = err[0];
        int sure = Math.max(2, Math.min(seconds, 30));
        if (r.error == null && r.connected && r.bytes == 0) r.error = "Bağlandı ama " + sure + " s içinde düzeltme verisi gelmedi" + (c.sendGGA && (c.ggaFallback == null || c.ggaFallback.isEmpty()) ? " (konum bilinmediği için GGA gönderilemedi)" : "");
        else if (r.error == null && r.connected && r.frames == 0) r.error = "Veri geliyor ama RTCM düzeltmesi değil: port ya da bağlantı noktası yanlış olabilir";
        if (r.error == null && !r.connected) r.error = "Bağlanılamadı";
        return r;
    }

    /** Kaynak tablosu (mountpoint listesi). */
    public static List<Mount> sourcetable(Config c) throws IOException {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(c.host.trim(), c.port), c.timeoutMs);
            s.setSoTimeout(c.timeoutMs);
            s.getOutputStream().write(request(c, "", null).getBytes(StandardCharsets.ISO_8859_1));
            s.getOutputStream().flush();
            InputStream in = s.getInputStream();
            List<String> hdr = readHeader(in);
            if (hdr.isEmpty()) throw new IOException("Sunucu yanıt vermedi");
            if (hdr.get(0).contains(" 401")) throw new IOException("Kullanıcı adı ya da şifre yanlış (401)");
            boolean chunked = false;
            for (String h : hdr) if (h.toLowerCase(Locale.ROOT).contains("chunked")) chunked = true;
            if (chunked) in = new ChunkedInputStream(in);
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            byte[] b = new byte[4096];
            int n;
            try { while ((n = in.read(b)) > 0) { body.write(b, 0, n); if (body.toString("ISO-8859-1").contains("ENDSOURCETABLE")) break; if (body.size() > 4_000_000) break; } }
            catch (SocketTimeoutException ignored) { }
            return parseSourcetable(body.toString("UTF-8"));
        } catch (IOException e) {
            if (e.getMessage() != null && e.getMessage().contains("401")) throw e;
            throw new IOException(message(e), e);
        }
    }
    public static List<Mount> parseSourcetable(String txt) {
        List<Mount> out = new ArrayList<>();
        for (String line : txt.split("\r?\n")) {
            if (!line.startsWith("STR;")) continue;
            String[] f = line.split(";", -1);
            Mount m = new Mount();
            m.raw = line;
            m.name = f.length > 1 ? f[1] : ""; m.identifier = f.length > 2 ? f[2] : ""; m.format = f.length > 3 ? f[3] : ""; m.formatDetails = f.length > 4 ? f[4] : "";
            m.nav = f.length > 6 ? f[6] : ""; m.network = f.length > 7 ? f[7] : ""; m.country = f.length > 8 ? f[8] : "";
            try { m.lat = Double.parseDouble(f[9]); m.lon = Double.parseDouble(f[10]); } catch (Exception ignored) { }
            m.nmea = f.length > 11 && "1".equals(f[11].trim());
            out.add(m);
        }
        return out;
    }

    /**
     * HTTP/1.1 chunked gövde çözücü (NTRIP v2). Durumu alanlarda tutar: kısa okuma süresi dolduğunda (SocketTimeoutException)
     * yarım kalan parça başlığı ya da satır sonu kaybolmaz, sonraki okumada kaldığı yerden sürer.
     */
    static final class ChunkedInputStream extends InputStream {
        private static final int SIZE = 0, DATA = 1, CRLF = 2, END = 3;
        private final InputStream in; private int state = SIZE; private int left = 0; private int crlf = 0;
        private final StringBuilder size = new StringBuilder();
        ChunkedInputStream(InputStream in) { this.in = in; }
        @Override public int read() throws IOException { byte[] one = new byte[1]; int n = read(one, 0, 1); return n <= 0 ? -1 : one[0] & 0xFF; }
        @Override public int read(byte[] b, int off, int len) throws IOException {
            while (true) {
                if (state == END) return -1;
                if (state == SIZE) {
                    int c = in.read();
                    if (c < 0) { state = END; return -1; }
                    if (c == '\n') {
                        String s = size.toString().trim(); size.setLength(0);
                        if (s.isEmpty()) continue;
                        int semi = s.indexOf(';'); if (semi >= 0) s = s.substring(0, semi).trim();
                        try { left = Integer.parseInt(s, 16); } catch (NumberFormatException e) { throw new IOException("Bozuk parça başlığı: " + s); }
                        if (left == 0) { state = END; return -1; }
                        state = DATA;
                    } else if (c != '\r') {
                        if (size.length() > 64) throw new IOException("Bozuk parça başlığı");
                        size.append((char) c);
                    }
                    continue;
                }
                if (state == DATA) {
                    int n = in.read(b, off, Math.min(len, left));
                    if (n < 0) { state = END; return -1; }
                    left -= n;
                    if (left == 0) { state = CRLF; crlf = 0; }
                    if (n > 0) return n;
                    continue;
                }
                // CRLF: parça sonundaki satır sonu (\r\n ya da yalnız \n)
                int c = in.read();
                if (c < 0) { state = END; return -1; }
                if (c == '\n') { state = SIZE; continue; }
                if (c == '\r') { crlf++; continue; }
                // beklenmeyen bayt: yeni parça başlığının ilk karakteri say
                state = SIZE; size.setLength(0); size.append((char) c);
            }
        }
    }
}
