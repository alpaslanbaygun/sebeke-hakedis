package tr.voltedas.saha;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** JavaScript ↔ Android köprüsü: window.VoltNative.<yöntem>(reqId, json). Yanıt: window.__voltNative('reply', {reqId, result|error}). */
public final class VoltBridge {
    private final MainActivity act;
    private final ExecutorService ex = Executors.newCachedThreadPool();
    private final Map<String, FileSlot> files = new HashMap<>();
    private static final class FileSlot { File f; String name, mime, action, dir = ""; OutputStream out; }
    /** Alt klasör yolu: her parça dosya adı kurallarına göre temizlenir (.. ve boş parçalar atılır). */
    private static String cleanDir(String d) {
        if (d == null) return "";
        StringBuilder b = new StringBuilder();
        for (String part : d.split("/")) {
            String t = part.replaceAll("[\\\\:*?\"<>|]", "_").trim();
            if (t.isEmpty() || t.equals(".") || t.equals("..")) continue;
            if (b.length() > 0) b.append('/');
            b.append(t);
        }
        return b.toString();
    }

    VoltBridge(MainActivity act) { this.act = act; }

    // ---------------- yardımcılar ----------------
    private void reply(String reqId, Object result) {
        try { JSONObject o = new JSONObject(); o.put("reqId", reqId); o.put("result", result == null ? JSONObject.NULL : result); act.emit("reply", o); } catch (Exception ignored) { }
    }
    private void fail(String reqId, String msg) {
        try { JSONObject o = new JSONObject(); o.put("reqId", reqId); o.put("error", msg == null ? "Hata" : msg); act.emit("reply", o); } catch (Exception ignored) { }
    }
    private interface Job { Object run(JSONObject a) throws Exception; }
    private void async(String reqId, String json, Job job) {
        ex.execute(() -> {
            try { reply(reqId, job.run(json == null || json.isEmpty() ? new JSONObject() : new JSONObject(json))); }
            catch (SecurityException se) { fail(reqId, "İzin verilmedi: " + se.getMessage()); }
            catch (Exception e) { fail(reqId, e.getMessage() == null ? e.toString() : e.getMessage()); }
        });
    }
    private void withPerms(String reqId, String[] perms, Runnable ok) { act.runWithPerms(perms, ok, (m) -> fail(reqId, m)); }
    private String[] btPerms() { return Build.VERSION.SDK_INT >= 31 ? new String[] { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN } : new String[] { Manifest.permission.ACCESS_FINE_LOCATION }; }
    private BluetoothAdapter adapter() throws Exception {
        BluetoothManager bm = (BluetoothManager) act.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter ad = bm == null ? null : bm.getAdapter();
        if (ad == null) throw new Exception("Bu cihazda Bluetooth yok");
        if (!ad.isEnabled()) throw new Exception("Bluetooth kapalı · açıp tekrar deneyin");
        return ad;
    }

    // ---------------- uygulama ----------------
    @JavascriptInterface public void appInfo(String reqId, String json) {
        async(reqId, json, (a) -> {
            PackageInfo pi = act.getPackageManager().getPackageInfo(act.getPackageName(), 0);
            JSONObject o = new JSONObject();
            o.put("platform", "android"); o.put("version", pi.versionName); o.put("sdk", Build.VERSION.SDK_INT); o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            return o;
        });
    }
    @JavascriptInterface public void keepScreenOn(String reqId, String json) {
        try { boolean on = new JSONObject(json).optBoolean("on", true); act.runOnUiThread(() -> act.setKeepScreenOn(on)); reply(reqId, true); } catch (Exception e) { fail(reqId, e.getMessage()); }
    }
    @JavascriptInterface public void vibrate(String reqId, String json) {
        try {
            int ms = new JSONObject(json).optInt("ms", 40);
            Vibrator v = (Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) { if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(ms); }
            reply(reqId, true);
        } catch (Exception e) { fail(reqId, e.getMessage()); }
    }
    @JavascriptInterface public void openSettings(String reqId, String json) {
        act.runOnUiThread(() -> {
            try {
                String w = new JSONObject(json).optString("what", "app");
                Intent i = "bluetooth".equals(w) ? new Intent(Settings.ACTION_BLUETOOTH_SETTINGS) : "location".equals(w) ? new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS) : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + act.getPackageName()));
                act.startActivity(i); reply(reqId, true);
            } catch (Exception e) { fail(reqId, e.getMessage()); }
        });
    }

    // ---------------- Bluetooth GNSS ----------------
    @JavascriptInterface public void btBonded(String reqId, String json) {
        withPerms(reqId, btPerms(), () -> async(reqId, json, (a) -> {
            JSONArray arr = new JSONArray();
            for (BluetoothDevice d : adapter().getBondedDevices()) {
                JSONObject o = new JSONObject();
                o.put("name", d.getName() == null ? "" : d.getName()); o.put("address", d.getAddress());
                o.put("kind", d.getType() == BluetoothDevice.DEVICE_TYPE_LE ? "le" : d.getType() == BluetoothDevice.DEVICE_TYPE_DUAL ? "dual" : "classic");
                arr.put(o);
            }
            return arr;
        }));
    }
    @JavascriptInterface public void bleScan(String reqId, String json) {
        withPerms(reqId, btPerms(), () -> async(reqId, json, (a) -> {
            int ms = Math.min(15000, a.optInt("ms", 6000));
            BluetoothLeScanner sc = adapter().getBluetoothLeScanner();
            if (sc == null) throw new Exception("BLE tarayıcı yok");
            final Map<String, JSONObject> found = new LinkedHashMap<>();
            ScanCallback cb = new ScanCallback() {
                @Override public void onScanResult(int type, ScanResult r) {
                    try {
                        BluetoothDevice d = r.getDevice();
                        String n = null; try { n = d.getName(); } catch (SecurityException ignored) { }
                        if (n == null && r.getScanRecord() != null) n = r.getScanRecord().getDeviceName();
                        if (n == null) return; // adsız cihazları gösterme
                        JSONObject o = new JSONObject(); o.put("name", n); o.put("address", d.getAddress()); o.put("rssi", r.getRssi());
                        synchronized (found) { found.put(d.getAddress(), o); }
                    } catch (Exception ignored) { }
                }
            };
            sc.startScan(cb);
            Thread.sleep(ms);
            try { sc.stopScan(cb); } catch (Exception ignored) { }
            JSONArray arr = new JSONArray();
            synchronized (found) { for (JSONObject o : found.values()) arr.put(o); }
            return arr;
        }));
    }
    @JavascriptInterface public void gnssConnect(String reqId, String json) {
        withPerms(reqId, btPerms(), () -> async(reqId, json, (a) -> {
            GnssHub.get().connect(act.getApplicationContext(), adapter(), a.optString("type", "spp"), a.getString("address"));
            return true;
        }));
    }
    @JavascriptInterface public void gnssDisconnect(String reqId, String json) {
        async(reqId, json, (a) -> { GnssHub.get().disconnect(); KeepAliveService.update(act, false); return true; });
    }
    @JavascriptInterface public void gnssWrite(String reqId, String json) {
        async(reqId, json, (a) -> { GnssHub.get().write(Base64.decode(a.getString("b64"), Base64.DEFAULT)); return true; });
    }

    // ---------------- NTRIP ----------------
    private NtripClient.Config cfg(JSONObject a) {
        NtripClient.Config c = new NtripClient.Config();
        c.host = a.optString("host", "").trim(); c.port = a.optInt("port", 2101); c.mount = a.optString("mount", "").trim();
        c.user = a.optString("user", ""); c.pass = a.optString("pass", ""); c.version = a.optInt("version", 2);
        c.sendGGA = a.optBoolean("sendGGA", true); c.ggaSec = a.optInt("ggaSec", 1);
        c.mode = "tcp".equalsIgnoreCase(a.optString("mode", "ntrip")) ? "tcp" : "ntrip";
        c.ggaFallback = a.optString("gga", "");
        return c;
    }
    private static void kontrol(NtripClient.Config c) throws Exception {
        if (c.host.isEmpty()) throw new Exception("Sunucu adresi gerekli");
        if (c.port <= 0 || c.port > 65535) throw new Exception("Port 1–65535 arasında olmalı");
        if (!c.isTcp() && c.mount.isEmpty()) throw new Exception("Bağlantı noktası (mountpoint) gerekli");
    }
    @JavascriptInterface public void ntripSourcetable(String reqId, String json) {
        async(reqId, json, (a) -> {
            List<NtripClient.Mount> ms = NtripClient.sourcetable(cfg(a));
            JSONArray arr = new JSONArray();
            for (NtripClient.Mount m : ms) { JSONObject o = new JSONObject(); o.put("name", m.name); o.put("identifier", m.identifier); o.put("format", m.format); o.put("nmea", m.nmea); o.put("lat", m.lat); o.put("lon", m.lon); o.put("nav", m.nav); o.put("network", m.network); arr.put(o); }
            JSONObject o = new JSONObject(); o.put("mounts", arr); return o;
        });
    }
    @JavascriptInterface public void ntripConnect(String reqId, String json) {
        async(reqId, json, (a) -> {
            NtripClient.Config c = cfg(a);
            kontrol(c);
            if (!GnssHub.get().linkActive()) throw new Exception("Önce harici GNSS alıcısına bağlanın");
            GnssHub.get().ntripStart(c);
            return true;
        });
    }
    /** Akış denemesi: alıcı bağlı olmadan birkaç saniye bağlanır; şifre, bağlantı noktası, veri ve istasyon konumu. */
    @JavascriptInterface public void ntripProbe(String reqId, String json) {
        async(reqId, json, (a) -> {
            NtripClient.Config c = cfg(a);
            kontrol(c);
            if (c.ggaFallback.isEmpty()) { String g = GnssHub.get().lastGGA(); if (g != null) c.ggaFallback = g; }
            NtripClient.Probe p = NtripClient.probe(c, a.optInt("seconds", 8));
            JSONObject o = new JSONObject();
            o.put("connected", p.connected); o.put("error", p.error == null ? JSONObject.NULL : p.error);
            o.put("bytes", p.bytes); o.put("frames", p.frames); o.put("crcErrors", p.crcErrors); o.put("firstDataMs", p.firstDataMs);
            JSONObject t = new JSONObject(); if (p.types != null) for (java.util.Map.Entry<Integer, Integer> e : p.types.entrySet()) t.put(String.valueOf(e.getKey()), e.getValue());
            o.put("types", t);
            if (p.stationId >= 0) { JSONObject st = new JSONObject(); st.put("id", p.stationId); st.put("x", p.x); st.put("y", p.y); st.put("z", p.z); o.put("station", st); }
            return o;
        });
    }
    @JavascriptInterface public void ntripDisconnect(String reqId, String json) { async(reqId, json, (a) -> { GnssHub.get().ntripStop(); return true; }); }

    // ---------------- Telefon GNSS ----------------
    @JavascriptInterface public void phoneStart(String reqId, String json) {
        withPerms(reqId, new String[] { Manifest.permission.ACCESS_FINE_LOCATION }, () -> act.runOnUiThread(() -> {
            try { GnssHub.get().phoneStart(act.getApplicationContext(), new JSONObject(json).optLong("intervalMs", 1000)); reply(reqId, true); }
            catch (Exception e) { fail(reqId, e.getMessage()); }
        }));
    }
    @JavascriptInterface public void phoneStop(String reqId, String json) { act.runOnUiThread(() -> { GnssHub.get().phoneStop(); reply(reqId, true); }); }

    // ---------------- Dosya kaydet / paylaş / yazdır ----------------
    @JavascriptInterface public void fileBegin(String reqId, String json) {
        async(reqId, json, (a) -> {
            FileSlot s = new FileSlot();
            s.name = a.getString("name").replaceAll("[\\\\/:*?\"<>|]", "_"); s.mime = a.optString("mime", "application/octet-stream"); s.action = a.optString("action", "save"); s.dir = cleanDir(a.optString("dir", ""));
            File dir = new File(act.getCacheDir(), "share"); dir.mkdirs();
            s.f = new File(dir, s.name); s.out = new FileOutputStream(s.f);
            String id = Long.toHexString(System.nanoTime());
            synchronized (files) { files.put(id, s); }
            return id;
        });
    }
    @JavascriptInterface public void fileChunk(String reqId, String json) {
        async(reqId, json, (a) -> {
            FileSlot s; synchronized (files) { s = files.get(a.getString("id")); }
            if (s == null) throw new Exception("Dosya oturumu yok");
            byte[] b = Base64.decode(a.getString("b64"), Base64.DEFAULT);
            synchronized (s) { s.out.write(b); }
            return b.length;
        });
    }
    @JavascriptInterface public void fileEnd(String reqId, String json) {
        async(reqId, json, (a) -> {
            FileSlot s; synchronized (files) { s = files.remove(a.getString("id")); }
            if (s == null) throw new Exception("Dosya oturumu yok");
            s.out.close();
            JSONObject o = new JSONObject();
            if ("share".equals(s.action)) {
                Uri u = VoltFileProvider.uriFor(s.f);
                Intent send = new Intent(Intent.ACTION_SEND).setType(s.mime).putExtra(Intent.EXTRA_STREAM, u).putExtra(Intent.EXTRA_SUBJECT, s.name).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                act.runOnUiThread(() -> act.startActivity(Intent.createChooser(send, "Paylaş: " + s.name)));
                o.put("uri", u.toString());
                return o;
            }
            o.put("uri", saveToDownloads(s));
            return o;
        });
    }
    private String saveToDownloads(FileSlot s) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver cr = act.getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, s.name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, s.mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Sebeke-M" + (s.dir.isEmpty() ? "" : "/" + s.dir));
            Uri u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (u == null) throw new Exception("İndirilenler klasörüne yazılamadı");
            try (OutputStream out = cr.openOutputStream(u); InputStream in = new FileInputStream(s.f)) { copy(in, out); }
            return "İndirilenler/Sebeke-M/" + (s.dir.isEmpty() ? "" : s.dir + "/") + s.name;
        }
        File dir = new File(act.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Sebeke-M" + (s.dir.isEmpty() ? "" : "/" + s.dir)); dir.mkdirs();
        File dst = new File(dir, s.name);
        try (OutputStream out = new FileOutputStream(dst); InputStream in = new FileInputStream(s.f)) { copy(in, out); }
        return dst.getAbsolutePath();
    }
    private static void copy(InputStream in, OutputStream out) throws Exception { byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n); }
    @JavascriptInterface public void printHtml(String reqId, String json) {
        try { JSONObject a = new JSONObject(json); act.runOnUiThread(() -> { act.printHtml(a.optString("title", "Rapor"), a.optString("html", "")); reply(reqId, true); }); }
        catch (Exception e) { fail(reqId, e.getMessage()); }
    }
}
