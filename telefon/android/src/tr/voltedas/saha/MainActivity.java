package tr.voltedas.saha;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.json.JSONObject;

/**
 * Şebeke-M (eski adı VOLT-EDAŞ Saha): WebView kabuğu. Uygulama dosyaları https://appassets.androidplatform.net/ altında (güvenli köken)
 * APK içinden sunulur → IndexedDB, kamera, konum ve fetch tam çalışır; internet gerekmez.
 */
public final class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    private WebView web;
    private VoltBridge bridge;
    private ValueCallback<Uri[]> fileCb;
    private PermissionRequest pendingWebPerm;
    private final Map<Integer, Runnable[]> permJobs = new HashMap<>();
    private int permSeq = 100;
    private WebView printView;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0b1326"));
        w.setNavigationBarColor(Color.parseColor("#0b1326"));
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b1326"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);
        // Uygulama kimliği (ürün adı, sürüm): karo sunucuları ve web sayfaları uygulamayı bununla tanır
        s.setUserAgentString(s.getUserAgentString() + " " + appKimligi());
        bridge = new VoltBridge(this);
        web.addJavascriptInterface(bridge, "VoltNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath() == null ? "/" : u.getPath();
                if (path.equals("/_tile")) return tile(u.getQueryParameter("u"));
                if (path.equals("/")) path = "/index.html";
                try {
                    InputStream in = getAssets().open("www" + path);
                    WebResourceResponse res = new WebResourceResponse(mime(path), mime(path).startsWith("text") || path.endsWith(".js") || path.endsWith(".json") ? "utf-8" : null, in);
                    Map<String, String> h = new HashMap<>(); h.put("Cache-Control", "no-cache"); h.put("Access-Control-Allow-Origin", "*");
                    res.setResponseHeaders(h);
                    return res;
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                runWithPerms(new String[] { Manifest.permission.ACCESS_FINE_LOCATION }, () -> cb.invoke(origin, true, false), (m) -> cb.invoke(origin, false, false));
            }
            @Override public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(() -> {
                    boolean cam = false;
                    for (String r : req.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) cam = true;
                    if (!cam) { req.deny(); return; }
                    runWithPerms(new String[] { Manifest.permission.CAMERA }, () -> req.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE }), (m) -> req.deny());
                });
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE);
                String[] acc = p.getAcceptTypes();
                String type = acc != null && acc.length > 0 && acc[0] != null && acc[0].contains("/") ? acc[0] : "*/*";
                i.setType(type);
                try { startActivityForResult(Intent.createChooser(i, "Dosya seç"), 42); } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
            @Override public boolean onConsoleMessage(ConsoleMessage m) { Log.d("VoltSaha", m.message() + " @" + m.sourceId() + ":" + m.lineNumber()); return true; }
        });
        setContentView(web);
        GnssHub.get().setEvents(this::emit);
        requestStartupPermissions();
        web.loadUrl(START);
    }

    private static String mime(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".woff2")) return "font/woff2";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
    // Altlık karo vekili: CORS yok, uygulama kimliği başlığı eklenir (OSM karo kullanım kuralı: uygulamaya özgü,
    // sürümlü User-Agent; yalnız ASCII). Sürüm her yayında değişir, ad sabit kalır.
    private String tileUa;
    private String tileUserAgent() {
        if (tileUa == null) tileUa = appKimligi() + " (Android; " + getPackageName() + "; saha olcum uygulamasi)";
        return tileUa;
    }
    /** "SebekeM/<sürüm>": ürün adı ve yüklü sürüm (WebView ve karo vekilinin User-Agent'ında). */
    private String appKimligi() {
        String v = "0";
        try { v = getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { }
        return "SebekeM/" + v;
    }

    private WebResourceResponse tile(String url) {
        if (url == null || !(url.startsWith("https://"))) return null;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(8000); c.setReadTimeout(12000);
            c.setRequestProperty("User-Agent", tileUserAgent());
            int code = c.getResponseCode();
            if (code != 200) return new WebResourceResponse("text/plain", "utf-8", code == 0 ? 502 : code, "Tile", null, new ByteArrayInputStream(new byte[0]));
            String ct = c.getContentType() == null ? "image/png" : c.getContentType();
            WebResourceResponse r = new WebResourceResponse(ct.split(";")[0], null, c.getInputStream());
            Map<String, String> h = new HashMap<>(); h.put("Access-Control-Allow-Origin", "*"); r.setResponseHeaders(h);
            return r;
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 504, "Offline", null, new ByteArrayInputStream(new byte[0]));
        }
    }

    // ---------------- Arayüz teması (13.11.2026) ----------------
    /** Cihaz açık temada mı (gece modu kapalı)? WebView'in prefers-color-scheme'i uygulamanın koyu temasını izlediğinden ayrıca bildirilir. */
    public boolean cihazAcikTemada() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES;
    }
    /** Durum ve gezinme çubuğunun rengi; açık zeminde simgeler koyu. */
    @SuppressWarnings("deprecation")
    public void cubukRengi(String renk, boolean acik) {
        runOnUiThread(() -> {
            try {
                Window w = getWindow();
                int c = Color.parseColor(renk);
                w.setStatusBarColor(c);
                w.setNavigationBarColor(c);
                if (Build.VERSION.SDK_INT >= 30 && w.getInsetsController() != null) {
                    int m = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    w.getInsetsController().setSystemBarsAppearance(acik ? m : 0, m);
                } else {
                    View d = w.getDecorView();
                    int f = d.getSystemUiVisibility();
                    int m = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    d.setSystemUiVisibility(acik ? (f | m) : (f & ~m));
                }
            } catch (Exception e) { Log.w("Sebeke", "cubukRengi: " + e.getMessage()); }
        });
    }
    @Override public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        try { JSONObject o = new JSONObject(); o.put("acik", cihazAcikTemada()); emit("tema", o); } catch (Exception e) { /* */ }
    }

    // ---------------- Olaylar (Java → JS) ----------------
    public void emit(String evt, JSONObject data) {
        final String js = "window.__voltNative&&window.__voltNative(" + JSONObject.quote(evt) + "," + JSONObject.quote(data == null ? "null" : data.toString()) + ")";
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }
    public void setKeepScreenOn(boolean on) { if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); }

    // ---------------- İzinler ----------------
    private void requestStartupPermissions() {
        List<String> need = new ArrayList<>();
        need.add(Manifest.permission.ACCESS_FINE_LOCATION);
        if (Build.VERSION.SDK_INT >= 31) { need.add(Manifest.permission.BLUETOOTH_CONNECT); need.add(Manifest.permission.BLUETOOTH_SCAN); }
        if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS);
        List<String> ask = new ArrayList<>();
        for (String p : need) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) ask.add(p);
        if (!ask.isEmpty()) requestPermissions(ask.toArray(new String[0]), 7);
    }
    public void runWithPerms(String[] perms, Runnable ok, Consumer<String> fail) {
        runOnUiThread(() -> {
            List<String> ask = new ArrayList<>();
            for (String p : perms) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) ask.add(p);
            if (ask.isEmpty()) { ok.run(); return; }
            int code = ++permSeq;
            permJobs.put(code, new Runnable[] { ok, () -> fail.accept("İzin verilmedi (" + String.join(", ", ask).replace("android.permission.", "") + ")") });
            requestPermissions(ask.toArray(new String[0]), code);
        });
    }
    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        Runnable[] job = permJobs.remove(code);
        if (job == null) return;
        boolean all = res.length > 0;
        for (int r : res) if (r != PackageManager.PERMISSION_GRANTED) all = false;
        (all ? job[0] : job[1]).run();
    }
    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == 42 && fileCb != null) { fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); fileCb = null; return; }
        super.onActivityResult(req, res, data);
    }

    // ---------------- Yazdır → PDF ----------------
    public void printHtml(String title, String html) {
        printView = new WebView(this);
        printView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                pm.print(title, v.createPrintDocumentAdapter(title), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            }
        });
        printView.loadDataWithBaseURL("https://" + HOST + "/", html, "text/html", "utf-8", null);
    }

    // ---------------- Yaşam döngüsü ----------------
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        web.evaluateJavascript("(window.__voltBack?window.__voltBack():false)", (v) -> {
            if (!"true".equals(v)) {
                new AlertDialog.Builder(this).setTitle("Şebeke-M Hakediş").setMessage(GnssHub.get().linkActive() ? "GNSS bağlantısı arka planda açık kalsın mı?" : "Uygulamadan çıkılsın mı?")
                    .setPositiveButton(GnssHub.get().linkActive() ? "Arka plana al" : "Çık", (d, i) -> moveTaskToBack(true))
                    .setNegativeButton("Vazgeç", null).show();
            }
        });
    }
    @Override protected void onDestroy() {
        GnssHub.get().setEvents(null);
        if (isFinishing()) { GnssHub.get().disconnect(); GnssHub.get().phoneStop(); KeepAliveService.update(this, false); }
        if (web != null) { web.removeJavascriptInterface("VoltNative"); web.destroy(); web = null; }
        super.onDestroy();
    }
}
