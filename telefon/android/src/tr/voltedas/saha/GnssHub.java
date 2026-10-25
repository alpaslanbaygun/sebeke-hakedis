package tr.voltedas.saha;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/**
 * Etkinlikten bağımsız GNSS merkezi: alıcı bağlantısı, NMEA'nın arayüze toplu iletimi, son GGA'nın yakalanması,
 * NTRIP düzeltmesinin doğrudan alıcıya yazılması ve telefon GNSS'i. Ekran kapansa da (ön plan servisiyle) çalışır.
 */
public final class GnssHub {
    public interface Events { void emit(String evt, JSONObject data); }
    private static GnssHub INSTANCE;
    public static synchronized GnssHub get() { if (INSTANCE == null) INSTANCE = new GnssHub(); return INSTANCE; }

    private volatile Events events;
    private volatile GnssLink link;
    private volatile NtripClient ntrip;
    private volatile PhoneGnss phone;
    private final StringBuilder pending = new StringBuilder();
    private final StringBuilder lineBuf = new StringBuilder();
    private volatile String lastGGA;
    private final ScheduledExecutorService ses = Executors.newSingleThreadScheduledExecutor();
    private volatile JSONObject ntripState = new JSONObject();

    private GnssHub() {
        ses.scheduleAtFixedRate(this::flush, 100, 100, TimeUnit.MILLISECONDS);
    }
    public void setEvents(Events e) { this.events = e; }
    private void emit(String evt, JSONObject o) { Events e = events; if (e != null) e.emit(evt, o); }
    private static JSONObject j(Object... kv) { JSONObject o = new JSONObject(); try { for (int i = 0; i + 1 < kv.length; i += 2) o.put((String) kv[i], kv[i + 1]); } catch (Exception ignored) { } return o; }

    public boolean linkActive() { return link != null && link.isConnected(); }
    public String linkName() { return link != null ? link.name() : null; }

    // ------- Harici alıcı -------
    public synchronized void connect(Context ctx, BluetoothAdapter ad, String type, String address) throws Exception {
        disconnect();
        GnssLink.Callback cb = new GnssLink.Callback() {
            @Override public void onData(byte[] b, int off, int len) { onBytes(b, off, len); }
            @Override public void onState(String state, String error) { emit("gnssStatus", j("state", state, "error", error == null ? JSONObject.NULL : error, "name", link != null ? link.name() : "", "address", link != null ? link.address() : "")); if ("disconnected".equals(state)) KeepAliveService.update(ctx, false); }
        };
        GnssLink l = "ble".equals(type) ? new BleUartLink(ctx, ad, address, cb) : new BtSppLink(ad, address, cb);
        link = l;
        emit("gnssStatus", j("state", "connecting", "name", l.name(), "address", address));
        l.connect();
        KeepAliveService.update(ctx, true);
    }
    public synchronized void disconnect() {
        if (ntrip != null) { ntrip.stop(); ntrip = null; }
        ntripState = new JSONObject(); // durdurulan istemcinin geç gelen olayları arayüze ulaşmaz
        lastGGA = null;
        if (link != null) { link.close(); emit("gnssStatus", j("state", "disconnected", "name", link.name())); link = null; }
    }
    public void write(byte[] b) { GnssLink l = link; if (l != null) l.write(b, 0, b.length); }

    private void onBytes(byte[] b, int off, int len) {
        String s = new String(b, off, len, StandardCharsets.ISO_8859_1);
        synchronized (pending) { pending.append(s); if (pending.length() > 256 * 1024) pending.delete(0, pending.length() - 64 * 1024); }
        synchronized (lineBuf) {
            lineBuf.append(s);
            int k;
            while ((k = lineBuf.indexOf("\n")) >= 0) {
                String line = lineBuf.substring(0, k).trim();
                lineBuf.delete(0, k + 1);
                if (line.length() > 6 && line.charAt(0) == '$' && line.startsWith("GGA", 3) && validGGA(line)) lastGGA = line;
            }
            if (lineBuf.length() > 8192) lineBuf.setLength(0);
        }
    }
    /** Konumu olan GGA (enlem, boylam dolu ve çözüm kalitesi 0 değil): yayıncıya yalnız bu gönderilir. */
    static boolean validGGA(String line) {
        int star = line.indexOf('*');
        String[] p = (star > 0 ? line.substring(0, star) : line).split(",", -1);
        return p.length > 6 && !p[2].isEmpty() && !p[4].isEmpty() && !p[6].isEmpty() && !"0".equals(p[6]);
    }
    public String lastGGA() { return lastGGA; }

    private void flush() {
        String t;
        synchronized (pending) { if (pending.length() == 0) return; t = pending.toString(); pending.setLength(0); }
        emit("gnss", j("text", t));
    }

    // ------- NTRIP -------
    public synchronized void ntripStart(NtripClient.Config c) {
        if (ntrip != null) ntrip.stop();
        ntripState = new JSONObject();
        try { ntripState.put("mode", c.isTcp() ? "tcp" : "ntrip"); ntripState.put("host", c.host); ntripState.put("port", c.port); ntripState.put("mount", c.isTcp() ? JSONObject.NULL : c.mount); } catch (Exception ignored) { }
        final NtripClient[] me = new NtripClient[1];
        final JSONObject st0 = ntripState;
        me[0] = new NtripClient(c, () -> lastGGA, new NtripClient.Listener() {
            @Override public void onRtcm(byte[] b, int off, int len) { GnssLink l = link; if (l != null && ntrip == me[0]) l.write(b, off, len); }
            @Override public void onStatus(String state, String error) {
                if (ntripState != st0) return; // eski bağlantının geç gelen olayı
                try { ntripState.put("state", state); ntripState.put("error", error == null ? JSONObject.NULL : error); } catch (Exception ignored) { }
                emit("ntrip", ntripState);
            }
            @Override public void onStats(NtripClient.Stats s) {
                if (ntripState != st0) return;
                try {
                    JSONObject t = new JSONObject(); for (Map.Entry<Integer, Integer> e : s.types.entrySet()) t.put(String.valueOf(e.getKey()), e.getValue());
                    ntripState.put("bytes", s.bytes); ntripState.put("rateBps", s.rateBps); ntripState.put("types", t); ntripState.put("lastRtcmMs", s.lastFrameMs); ntripState.put("state", "connected");
                    ntripState.put("frames", s.frames); ntripState.put("crcErrors", s.crcErrors); ntripState.put("error", JSONObject.NULL);
                    if (s.stationId >= 0) { JSONObject st = new JSONObject(); st.put("id", s.stationId); st.put("x", s.x); st.put("y", s.y); st.put("z", s.z); ntripState.put("station", st); }
                } catch (Exception ignored) { }
                emit("ntrip", ntripState);
            }
        });
        ntrip = me[0];
        ntrip.start();
    }
    public synchronized void ntripStop() {
        if (ntrip != null) { ntrip.stop(); ntrip = null; }
        ntripState = new JSONObject(); // durdurulan istemcinin geç gelen olayları ("bağlı") arayüze ulaşmaz
    }

    // ------- Telefon GNSS -------
    public synchronized void phoneStart(Context ctx, long interval) {
        if (phone == null) phone = new PhoneGnss(ctx, (o) -> emit("phone", o));
        phone.start(interval);
    }
    public synchronized void phoneStop() { if (phone != null) phone.stop(); }
}
