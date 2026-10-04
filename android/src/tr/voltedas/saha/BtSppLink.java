package tr.voltedas.saha;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.UUID;

/** Klasik Bluetooth seri port profili (SPP / RFCOMM) — çoğu RTK alıcısı (CHC, South, Stonex, Hi-Target, Emlid…) bu profili kullanır. */
public final class BtSppLink implements GnssLink {
    static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final BluetoothAdapter ad; private final BluetoothDevice dev; private final Callback cb;
    private volatile BluetoothSocket sock; private volatile OutputStream out; private volatile boolean alive;
    private Thread reader;

    public BtSppLink(BluetoothAdapter ad, String address, Callback cb) {
        this.ad = ad; this.dev = ad.getRemoteDevice(address); this.cb = cb;
    }
    @Override public String type() { return "spp"; }
    @Override public String address() { return dev.getAddress(); }
    @Override public String name() { try { String n = dev.getName(); return n == null ? dev.getAddress() : n; } catch (SecurityException e) { return dev.getAddress(); } }
    @Override public boolean isConnected() { return alive && sock != null && sock.isConnected(); }

    @Override public void connect() throws Exception {
        try { ad.cancelDiscovery(); } catch (SecurityException ignored) { }
        BluetoothSocket s;
        try {
            s = dev.createRfcommSocketToServiceRecord(SPP);
            s.connect();
        } catch (Exception first) {
            // Bazı alıcılar SDP kaydı yayınlamaz: kanal 1'e doğrudan bağlan
            try {
                Method m = dev.getClass().getMethod("createRfcommSocket", int.class);
                s = (BluetoothSocket) m.invoke(dev, 1);
                s.connect();
            } catch (Exception second) {
                throw new Exception("Bluetooth bağlantısı kurulamadı: " + first.getMessage());
            }
        }
        sock = s; out = s.getOutputStream(); alive = true;
        final InputStream in = s.getInputStream();
        reader = new Thread(() -> {
            byte[] buf = new byte[4096];
            try {
                while (alive) {
                    int n = in.read(buf);
                    if (n < 0) break;
                    if (n > 0) cb.onData(buf, 0, n);
                }
                if (alive) cb.onState("disconnected", "Alıcı bağlantısı kapandı");
            } catch (Exception e) {
                if (alive) cb.onState("disconnected", "Bağlantı koptu: " + e.getMessage());
            } finally { alive = false; }
        }, "spp-reader");
        reader.setDaemon(true);
        reader.start();
        cb.onState("connected", null);
    }
    @Override public synchronized void write(byte[] b, int off, int len) {
        OutputStream o = out;
        if (o == null || !alive) return;
        try { o.write(b, off, len); o.flush(); } catch (Exception e) { cb.onState("disconnected", "Yazma hatası: " + e.getMessage()); alive = false; }
    }
    @Override public void close() {
        alive = false;
        try { if (sock != null) sock.close(); } catch (Exception ignored) { }
        sock = null; out = null;
    }
}
