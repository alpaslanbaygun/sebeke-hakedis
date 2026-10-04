package tr.voltedas.saha;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * NTRIP istemcisi (v1 / v2, TCP). RTCM akışını dinleyiciye verir (doğrudan GNSS alıcısına yazılır),
 * VRS için alıcının son GGA cümlesini periyodik gönderir, kopunca geri çekilmeli yeniden bağlanır.
 * Android bağımsızdır (JDK ile test edilebilir).
 */
public final class NtripClient {
    public interface Listener {
        void onRtcm(byte[] b, int off, int len);
        void onStatus(String state, String error);
        void onStats(long bytes, double rateBps, Map<Integer, Integer> types, long lastFrameMs);
    }
    public interface GgaSource { String latestGGA(); }
    public static final class Config {
        public String host = ""; public int port = 2101; public String mount = ""; public String user = ""; public String pass = "";
        public int version = 2; public boolean sendGGA = true; public int ggaSec = 1; public int timeoutMs = 10000;
    }
    public static final class Mount {
        public String name, identifier, format, formatDetails, nav, network, country; public double lat, lon; public boolean nmea; public String raw;
    }

    private final Config cfg; private final GgaSource gga; private final Listener ls;
    private volatile boolean running; private volatile Socket sock; private Thread th;
    private final Rtcm3Parser parser = new Rtcm3Parser();

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

    private void loop() {
        int backoff = 2000;
        while (running) {
            try {
                ls.onStatus("connecting", null);
                session();
                backoff = 2000;
            } catch (Exception e) {
                if (!running) break;
                ls.onStatus("error", e.getMessage() == null ? e.toString() : e.getMessage());
            }
            if (!running) break;
            try { Thread.sleep(backoff); } catch (InterruptedException ie) { break; }
            backoff = Math.min(backoff * 2, 30000);
        }
    }

    private static String basic(String u, String p) {
        return Base64.getEncoder().encodeToString((u + ":" + p).getBytes(StandardCharsets.UTF_8));
    }

    static String request(Config c, String path, String ggaLine) {
        StringBuilder sb = new StringBuilder();
        boolean v2 = c.version >= 2;
        sb.append("GET /").append(path).append(v2 ? " HTTP/1.1\r\n" : " HTTP/1.0\r\n");
        if (v2) { sb.append("Host: ").append(c.host).append(':').append(c.port).append("\r\n"); sb.append("Ntrip-Version: Ntrip/2.0\r\n"); }
        sb.append("User-Agent: NTRIP VoltEdasSaha/2.0\r\n");
        if (c.user != null && !c.user.isEmpty()) sb.append("Authorization: Basic ").append(basic(c.user, c.pass == null ? "" : c.pass)).append("\r\n");
        if (v2 && ggaLine != null && !ggaLine.isEmpty()) sb.append("Ntrip-GGA: ").append(ggaLine.trim()).append("\r\n");
        sb.append("Accept: */*\r\nConnection: close\r\n\r\n");
        return sb.toString();
    }

    /** Başlık satırlarını okur (boş satıra ya da ICY yanıtına kadar). */
    static List<String> readHeader(InputStream in) throws IOException {
        List<String> lines = new ArrayList<>();
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        int prev = -1;
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
            prev = b;
            if (line.size() > 4096) throw new IOException("Geçersiz yanıt");
        }
    }

    private void session() throws IOException {
        Socket s = new Socket();
        sock = s;
        s.connect(new InetSocketAddress(cfg.host, cfg.port), cfg.timeoutMs);
        s.setSoTimeout(Math.max(cfg.timeoutMs, 15000));
        s.setTcpNoDelay(true);
        OutputStream out = s.getOutputStream();
        InputStream in = s.getInputStream();
        String g = gga != null ? gga.latestGGA() : null;
        out.write(request(cfg, cfg.mount, g).getBytes(StandardCharsets.ISO_8859_1));
        if (cfg.version < 2 && cfg.sendGGA && g != null) out.write((g.trim() + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
        out.flush();
        List<String> hdr = readHeader(in);
        if (hdr.isEmpty()) throw new IOException("Sunucu yanıt vermedi");
        String st = hdr.get(0);
        if (st.startsWith("SOURCETABLE")) throw new IOException("Mountpoint bulunamadı: " + cfg.mount);
        if (st.contains(" 401")) throw new IOException("Kimlik doğrulama hatası (401)");
        if (st.contains(" 404")) throw new IOException("Mountpoint bulunamadı (404)");
        if (!(st.startsWith("ICY 200") || st.matches("HTTP/1\\.[01] 200.*"))) throw new IOException("Sunucu: " + st);
        boolean chunked = false;
        for (String h : hdr) if (h.toLowerCase(Locale.ROOT).startsWith("transfer-encoding:") && h.toLowerCase(Locale.ROOT).contains("chunked")) chunked = true;
        if (chunked) in = new ChunkedInputStream(in);
        ls.onStatus("connected", null);
        byte[] buf = new byte[4096];
        long lastGga = System.currentTimeMillis(), lastStat = lastGga, statBytes = 0;
        while (running) {
            int n;
            try { n = in.read(buf); }
            catch (java.net.SocketTimeoutException te) { throw new IOException("Düzeltme verisi gelmiyor (zaman aşımı)"); }
            if (n < 0) throw new IOException("Sunucu bağlantıyı kapattı");
            if (n > 0) { ls.onRtcm(buf, 0, n); parser.push(buf, 0, n); statBytes += n; }
            long now = System.currentTimeMillis();
            if (cfg.sendGGA && now - lastGga >= Math.max(1, cfg.ggaSec) * 1000L) {
                String gl = gga != null ? gga.latestGGA() : null;
                if (gl != null) { out.write((gl.trim() + "\r\n").getBytes(StandardCharsets.ISO_8859_1)); out.flush(); }
                lastGga = now;
            }
            if (now - lastStat >= 1000) {
                ls.onStats(parser.bytes, statBytes * 1000.0 / (now - lastStat), parser.snapshot(), parser.lastFrameMs);
                statBytes = 0; lastStat = now;
            }
        }
        s.close();
    }

    /** Kaynak tablosu (mountpoint listesi). */
    public static List<Mount> sourcetable(Config c) throws IOException {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(c.host, c.port), c.timeoutMs);
            s.setSoTimeout(c.timeoutMs);
            s.getOutputStream().write(request(c, "", null).getBytes(StandardCharsets.ISO_8859_1));
            s.getOutputStream().flush();
            InputStream in = s.getInputStream();
            List<String> hdr = readHeader(in);
            if (hdr.isEmpty()) throw new IOException("Sunucu yanıt vermedi");
            if (hdr.get(0).contains(" 401")) throw new IOException("Kimlik doğrulama hatası (401)");
            boolean chunked = false;
            for (String h : hdr) if (h.toLowerCase(Locale.ROOT).contains("chunked")) chunked = true;
            if (chunked) in = new ChunkedInputStream(in);
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            byte[] b = new byte[4096];
            int n;
            try { while ((n = in.read(b)) > 0) { body.write(b, 0, n); if (body.toString("ISO-8859-1").contains("ENDSOURCETABLE")) break; if (body.size() > 4_000_000) break; } }
            catch (java.net.SocketTimeoutException ignored) { }
            return parseSourcetable(body.toString("UTF-8"));
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

    /** HTTP/1.1 chunked gövde çözücü (NTRIP v2). */
    static final class ChunkedInputStream extends InputStream {
        private final InputStream in; private int left = 0; private boolean eof = false;
        ChunkedInputStream(InputStream in) { this.in = in; }
        private void next() throws IOException {
            StringBuilder sb = new StringBuilder();
            int b;
            while ((b = in.read()) >= 0 && b != '\n') if (b != '\r') sb.append((char) b);
            if (b < 0) { eof = true; return; }
            String s = sb.toString().trim();
            if (s.isEmpty()) { next(); return; }
            int semi = s.indexOf(';'); if (semi >= 0) s = s.substring(0, semi);
            left = Integer.parseInt(s, 16);
            if (left == 0) eof = true;
        }
        @Override public int read() throws IOException { byte[] one = new byte[1]; int n = read(one, 0, 1); return n <= 0 ? -1 : one[0] & 0xFF; }
        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (eof) return -1;
            if (left == 0) { next(); if (eof) return -1; }
            int n = in.read(b, off, Math.min(len, left));
            if (n < 0) { eof = true; return -1; }
            left -= n;
            if (left == 0) { in.read(); in.read(); } // CRLF
            return n;
        }
    }
}
