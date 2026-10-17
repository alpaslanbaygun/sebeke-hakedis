package com.sebekehakedis.mobil

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Tek etkinlik. Ekranlar HTML olarak WebView'de çizilir (assets/ui). Ekranlar [UiApi] işlemlerini
 * "Android" köprüsüyle çağırır; konum, bağlantı durumu ve dosya sonuçları [emit] ile ekranlara iletilir.
 */
class MainActivity : AppCompatActivity(), GnssHub.Listener {

    internal lateinit var prefs: Prefs
    internal lateinit var api: UiApi
    internal lateinit var tiles: TileServer
    internal lateinit var depo: ProjeDeposu
    internal lateinit var telefon: TelefonKonumu
    internal var web: WebView? = null

    /** Arayüz app.init çağırınca true olur; öncesindeki olaylar gönderilmez. */
    @Volatile internal var pageReady = false

    private val handler = Handler(Looper.getMainLooper())
    private var afterBtPermission: (() -> Unit)? = null
    private var lastFixSent = 0L
    private var fixScheduled = false
    private var logScheduled = false

    private val btPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            val action = afterBtPermission
            afterBtPermission = null
            if (hasBtPermission()) action?.invoke() else if (action != null) toast(getString(R.string.bt_no_permission))
        }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            if (telefon.hasPermission()) {
                if (prefs.source == "phone") telefon.start()
            } else {
                GnssHub.setPhone(LinkState.DISCONNECTED, getString(R.string.phone_no_permission))
                toast(getString(R.string.phone_no_permission))
            }
            emit("status", api.statusJson())
        }

    private val openProjectLauncher =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) importProject(uri) }

    /** Kaydedilmeyi bekleyen dosya (Android "Farklı Kaydet" penceresi açıkken). */
    private var pendingSave: ByteArray? = null
    private val saveLaunchers = HashMap<String, ActivityResultLauncher<String>>()

    private fun saveLauncher(mime: String) =
        registerForActivityResult(ActivityResultContracts.CreateDocument(mime)) { uri ->
            val bytes = pendingSave
            pendingSave = null
            if (uri != null && bytes != null) writeTo(uri, bytes)
        }

    /** Çekilmekte olan fotoğraf: proje, nesne ve dosya. */
    private var pendingPhoto: Triple<String, String, File>? = null
    private val photoLauncher =
        registerForActivityResult(ActivityResultContracts.TakePicture()) { ok -> onPhoto(ok) }

    init {
        for (mime in SAVE_MIMES) saveLaunchers[mime] = saveLauncher(mime)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        prefs = Prefs(this)
        depo = ProjeDeposu(File(filesDir, "projeler"))
        telefon = TelefonKonumu(this)
        api = UiApi(this)
        tiles = TileServer(this, prefs, versionName())
        pendingPhoto = savedInstanceState?.let { s ->
            val p = s.getString("photoProject")
            val r = s.getString("photoRef")
            val f = s.getString("photoFile")
            if (p != null && r != null && f != null) Triple(p, r, File(f)) else null
        }

        val view = WebView(this)
        view.settings.javaScriptEnabled = true
        view.settings.domStorageEnabled = true
        view.settings.allowFileAccess = false
        view.settings.allowContentAccess = false
        // Tasarım sabit yazı boyutlarıyla yapıldı; sistem yazı ölçeği yerleşimi bozmasın.
        view.settings.textZoom = 100
        view.overScrollMode = View.OVER_SCROLL_NEVER
        view.setBackgroundColor(0xFFF8F9FB.toInt())
        view.webViewClient = AssetClient()
        view.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.d(TAG, "${message.messageLevel()} ${message.sourceId()}:${message.lineNumber()} ${message.message()}")
                return true
            }
        }
        view.addJavascriptInterface(Bridge(), "Android")
        setContentView(view)
        web = view
        view.loadUrl("$ORIGIN/ui/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val page = web
                if (page == null || !pageReady) {
                    finish()
                    return
                }
                page.evaluateJavascript("window.App ? App.back() : false") { handled ->
                    if (handled != "true") finish()
                }
            }
        })

        GnssHub.addListener(this)
        requestStartupPermissions()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        pendingPhoto?.let {
            outState.putString("photoProject", it.first)
            outState.putString("photoRef", it.second)
            outState.putString("photoFile", it.third.path)
        }
    }

    override fun onStart() {
        super.onStart()
        if (prefs.source == "phone" && telefon.hasPermission()) telefon.start()
    }

    override fun onStop() {
        // Telefon konumu yalnız uygulama açıkken dinlenir (Bluetooth alıcı servisi sürer).
        telefon.stop()
        if (pageReady) web?.evaluateJavascript("window.App&&App.emit('pause',{})", null)
        super.onStop()
    }

    override fun onDestroy() {
        GnssHub.removeListener(this)
        web?.destroy()
        web = null
        super.onDestroy()
    }

    // ---- WebView ----

    /** Arayüz dosyalarını assets'ten verir; yalnız harita karoları internete çıkar. */
    private inner class AssetClient : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
            val url = request.url
            if (url.scheme == "https" && url.host == HOST) {
                val path = url.path.orEmpty().trimStart('/')
                if (path.startsWith("tiles/")) return tiles.serve(path)
                if (path.startsWith("foto/")) return photo(path)
                if (!path.startsWith("ui/") && !path.startsWith("katalog/")) return notFound()
                return try {
                    WebResourceResponse(mimeType(path), "utf-8", assets.open(path))
                } catch (e: IOException) {
                    notFound()
                }
            }
            return notFound()
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

        /** foto/<proje>/<dosya>.jpg */
        private fun photo(path: String): WebResourceResponse {
            val parts = path.split('/')
            if (parts.size != 3) return notFound()
            val file = depo.photo(parts[1], parts[2]) ?: return notFound()
            return try {
                WebResourceResponse("image/jpeg", null, 200, "OK", mapOf("Cache-Control" to "no-store"), FileInputStream(file))
            } catch (e: IOException) {
                notFound()
            }
        }

        private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

        private fun mimeType(path: String): String = when (path.substringAfterLast('.', "").lowercase(Locale.US)) {
            "html" -> "text/html"
            "js" -> "application/javascript"
            "css" -> "text/css"
            "woff2" -> "font/woff2"
            "svg" -> "image/svg+xml"
            "png" -> "image/png"
            "json" -> "application/json"
            else -> "application/octet-stream"
        }
    }

    /** Arayüzün çağırdığı köprü. Çağrı ana iş parçacığında yürütülür ve sonucu beklenir. */
    private inner class Bridge {
        @JavascriptInterface
        fun call(method: String, args: String): String {
            val task = FutureTask {
                try {
                    val result = api.handle(method, if (args.isBlank()) JSONObject() else JSONObject(args))
                    when (result) {
                        null -> "null"
                        is JSONObject, is JSONArray -> result.toString()
                        is RawJson -> result.text
                        is String -> JSONObject.quote(result)
                        else -> result.toString()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "api $method", e)
                    UiApi.err(e.message ?: e.javaClass.simpleName).toString()
                } catch (e: OutOfMemoryError) {
                    UiApi.err(getString(R.string.too_big)).toString()
                }
            }
            handler.post(task)
            return task.get(CALL_TIMEOUT_S, TimeUnit.SECONDS)
        }
    }

    /** Ekranlara olay iletir (ana iş parçacığından çağrılmalı). */
    internal fun emit(type: String, data: Any) {
        val page = web ?: return
        if (!pageReady) return
        page.evaluateJavascript("window.App&&App.emit('$type',$data)", null)
    }

    internal fun versionName(): String = try {
        packageManager.getPackageInfo(packageName, 0).versionName.orEmpty()
    } catch (e: PackageManager.NameNotFoundException) {
        ""
    }

    // ---- GnssHub.Listener ----

    override fun onFix(fix: GnssFix) {
        // Alıcı saniyede 10 epok gönderse de ekran en çok saniyede 5 kez yenilenir; son epok hep gider.
        val now = System.currentTimeMillis()
        if (now - lastFixSent >= FIX_INTERVAL_MS) {
            sendFix()
        } else if (!fixScheduled) {
            fixScheduled = true
            handler.postDelayed({ sendFix() }, FIX_INTERVAL_MS - (now - lastFixSent))
        }
    }

    private fun sendFix() {
        fixScheduled = false
        lastFixSent = System.currentTimeMillis()
        emit("fix", api.fixJson(GnssHub.fix))
    }

    override fun onStatusChanged() {
        emit("status", api.statusJson())
    }

    override fun onLogLine() {
        if (logScheduled) return
        logScheduled = true
        handler.postDelayed({
            logScheduled = false
            emit("log", JSONObject())
        }, LOG_INTERVAL_MS)
    }

    override fun onNotice(text: String) {
        emit("notice", JSONObject().put("text", text))
    }

    // ---- İzinler ----

    internal fun hasBtPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED

    internal fun withBtPermission(action: () -> Unit) {
        if (hasBtPermission()) {
            action()
        } else {
            afterBtPermission = action
            btPermissionLauncher.launch(arrayOf(Manifest.permission.BLUETOOTH_CONNECT))
        }
    }

    private fun requestStartupPermissions() {
        val wanted = ArrayList<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) wanted.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = wanted.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) btPermissionLauncher.launch(missing.toTypedArray())
    }

    /** Telefon konumunu başlatır; izin yoksa önce izin istenir (sonuç "status" olayıyla gelir). */
    internal fun startPhone(): JSONObject {
        if (!telefon.hasPermission()) {
            locationPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
            return JSONObject().put("needPermission", true)
        }
        telefon.start()
        return UiApi.ok()
    }

    // ---- Bluetooth ----

    private fun adapter(): BluetoothAdapter? = getSystemService(BluetoothManager::class.java)?.adapter

    /** Eşleştirilmiş alıcılar; izin yoksa ya da Bluetooth kapalıysa nedeni döner. */
    @SuppressLint("MissingPermission")
    internal fun btDevices(): JSONObject {
        val adapter = adapter() ?: return JSONObject().put("unavailable", true)
        if (!hasBtPermission()) return JSONObject().put("needPermission", true)
        if (!adapter.isEnabled) return JSONObject().put("disabled", true)
        val list = JSONArray()
        adapter.bondedDevices.orEmpty().sortedBy { it.name ?: it.address }.forEach {
            list.put(
                JSONObject().put("name", it.name ?: it.address).put("address", it.address)
                    .put("selected", it.address == prefs.deviceAddress)
            )
        }
        return JSONObject().put("devices", list)
    }

    internal fun requestBtEnable() = openSettings(BluetoothAdapter.ACTION_REQUEST_ENABLE)

    internal fun connect(): JSONObject {
        if (prefs.deviceAddress.isEmpty()) return UiApi.err(getString(R.string.no_device))
        val adapter = adapter() ?: return UiApi.err(getString(R.string.bt_unavailable))
        if (!hasBtPermission()) return JSONObject().put("needPermission", true)
        if (!adapter.isEnabled) {
            requestBtEnable()
            return UiApi.err(getString(R.string.bt_disabled))
        }
        GnssService.start(this, prefs.deviceAddress)
        return UiApi.ok()
    }

    internal fun openSettings(action: String) {
        try {
            startActivity(Intent(action))
        } catch (e: ActivityNotFoundException) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        } catch (e: SecurityException) {
            toast(getString(R.string.bt_no_permission))
        }
    }

    // ---- Proje dosyası açma ----

    internal fun launchOpenProject() {
        openProjectLauncher.launch(arrayOf("*/*"))
    }

    /** Proje dosyası arka planda okunur, denetlenir ve telefona kopyalanır; sonuç "projectImported" olayıyla gelir. */
    private fun importProject(uri: Uri) {
        val name = displayName(uri)
        toast(getString(R.string.import_reading, name))
        Thread({
            val result = try {
                val bytes = readLimited(uri, MAX_PROJECT_BYTES)
                val text = decodeText(bytes).trimStart('﻿')
                val o = JSONObject(text)
                if (o.optString("bicim") != PROJECT_FORMAT) throw IOException(getString(R.string.import_not_project))
                val p = o.optJSONObject("proje") ?: JSONObject()
                val meta = JSONObject()
                    .put("ad", p.optString("ad").ifEmpty { name.substringBefore('.') })
                    .put("kaynak", name)
                    .put("hakedis", p.optInt("aktifHakedis", 1))
                    .put("sayilar", JSONObject()
                        .put("eleman", o.optJSONArray("elemanlar")?.length() ?: 0)
                        .put("hat", o.optJSONArray("hatlar")?.length() ?: 0)
                        .put("kanal", o.optJSONArray("kanallar")?.length() ?: 0)
                        .put("nokta", o.optJSONArray("noktalar")?.length() ?: 0)
                        .put("bolge", o.optJSONArray("bolgeler")?.length() ?: 0))
                val id = depo.create(text, meta)
                JSONObject().put("ok", true).put("id", id).put("ad", meta.optString("ad"))
            } catch (e: JSONException) {
                JSONObject().put("error", getString(R.string.import_not_project))
            } catch (e: IOException) {
                JSONObject().put("error", e.message ?: getString(R.string.file_failed, ""))
            } catch (e: SecurityException) {
                JSONObject().put("error", getString(R.string.file_failed, e.message.orEmpty()))
            } catch (e: OutOfMemoryError) {
                JSONObject().put("error", getString(R.string.too_big))
            }
            runOnUiThread { emit("projectImported", result) }
        }, "project-import").start()
    }

    private fun readLimited(uri: Uri, limit: Long): ByteArray {
        val input = contentResolver.openInputStream(uri) ?: throw IOException(uri.toString())
        return input.use {
            val out = java.io.ByteArrayOutputStream()
            val buf = ByteArray(64 * 1024)
            var total = 0L
            while (true) {
                val n = it.read(buf)
                if (n < 0) break
                total += n
                if (total > limit) throw IOException(getString(R.string.too_big))
                out.write(buf, 0, n)
            }
            out.toByteArray()
        }
    }

    // ---- Kaydetme ve paylaşma ----

    internal fun launchSave(name: String, mime: String, bytes: ByteArray) {
        pendingSave = bytes
        (saveLaunchers[mime] ?: saveLaunchers[SAVE_MIMES.last()])!!.launch(name)
    }

    private fun writeTo(uri: Uri, bytes: ByteArray) {
        try {
            val stream = contentResolver.openOutputStream(uri, "wt") ?: throw IOException(uri.toString())
            stream.use { it.write(bytes) }
            toast(getString(R.string.saved, displayName(uri)))
            emit("saved", JSONObject().put("name", displayName(uri)))
        } catch (e: IOException) {
            toast(getString(R.string.file_failed, e.message.orEmpty()))
        } catch (e: SecurityException) {
            toast(getString(R.string.file_failed, e.message.orEmpty()))
        }
    }

    /** Dosyayı Android paylaşım menüsüyle (Drive, e-posta, WhatsApp…) gönderir. */
    internal fun share(name: String, mime: String, bytes: ByteArray, subject: String) {
        val dir = File(cacheDir, "share").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val file = File(dir, name)
        file.writeBytes(bytes)
        shareFile(file, mime, subject.ifEmpty { name })
    }

    private fun shareFile(file: File, mime: String, subject: String) {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        val send = Intent(Intent.ACTION_SEND)
            .setType(mime)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_SUBJECT, subject)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            startActivity(Intent.createChooser(send, getString(R.string.share_title)))
        } catch (e: ActivityNotFoundException) {
            toast(getString(R.string.share_none))
        }
    }

    // ---- Fotoğraf ----

    internal fun takePhoto(projectId: String, ref: String): JSONObject {
        val dir = depo.photoDir(projectId)
        val safeRef = ref.replace(Regex("[^A-Za-z0-9_-]"), "_").take(40).ifEmpty { "nesne" }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val file = File(dir, "${safeRef}_$stamp.jpg")
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        pendingPhoto = Triple(projectId, ref, file)
        return try {
            photoLauncher.launch(uri)
            UiApi.ok()
        } catch (e: ActivityNotFoundException) {
            pendingPhoto = null
            UiApi.err(getString(R.string.no_camera))
        }
    }

    private fun onPhoto(ok: Boolean) {
        val (projectId, ref, file) = pendingPhoto ?: return
        pendingPhoto = null
        if (!ok || !file.exists() || file.length() == 0L) {
            file.delete()
            return
        }
        Thread({
            try {
                shrink(file)
            } catch (e: Exception) {
                Log.w(TAG, "foto küçültülemedi", e)
            } catch (e: OutOfMemoryError) {
                Log.w(TAG, "foto küçültülemedi", e)
            }
            runOnUiThread { emit("photo", JSONObject().put("id", projectId).put("ref", ref).put("file", file.name)) }
        }, "photo").start()
    }

    /** Fotoğrafı en çok 1600 piksel kenara indirir ve yönünü düzeltir (dosya küçülür, ekranda hızlı açılır). */
    private fun shrink(file: File) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        val longest = maxOf(bounds.outWidth, bounds.outHeight)
        if (longest <= 0) return
        var sample = 1
        while (longest / (sample * 2) >= PHOTO_MAX_PX) sample *= 2
        val bmp = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return
        val rotation = when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val scale = minOf(1f, PHOTO_MAX_PX.toFloat() / maxOf(bmp.width, bmp.height))
        val m = Matrix().apply {
            if (scale < 1f) postScale(scale, scale)
            if (rotation != 0f) postRotate(rotation)
        }
        val out = if (m.isIdentity) bmp else Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
        val tmp = File(file.path + ".tmp")
        FileOutputStream(tmp).use { out.compress(Bitmap.CompressFormat.JPEG, 85, it) }
        if (!tmp.renameTo(file)) {
            file.delete()
            tmp.renameTo(file)
        }
    }

    /** Projenin (ya da seçilen) fotoğraflarını tek zip dosyası olarak paylaşır. */
    internal fun sharePhotos(projectId: String, files: JSONArray?, name: String): JSONObject {
        val dir = depo.photoDir(projectId)
        val wanted = files?.let { arr -> (0 until arr.length()).map { arr.getString(it) }.toSet() }
        val list = dir.listFiles { f -> f.isFile && f.name.endsWith(".jpg") && (wanted == null || f.name in wanted) }.orEmpty()
        if (list.isEmpty()) return UiApi.err(getString(R.string.no_photos))
        val shareDir = File(cacheDir, "share").apply { mkdirs() }
        shareDir.listFiles()?.forEach { it.delete() }
        val zipName = (name.ifEmpty { "fotograflar" }.replace(Regex("[\\\\/:*?\"<>|]"), "_")) + ".zip"
        val zip = File(shareDir, zipName)
        ZipOutputStream(FileOutputStream(zip)).use { z ->
            for (f in list) {
                z.putNextEntry(ZipEntry(f.name))
                FileInputStream(f).use { it.copyTo(z) }
                z.closeEntry()
            }
        }
        shareFile(zip, "application/zip", zipName)
        return UiApi.ok().put("count", list.size)
    }

    // ---- Diğer ----

    /** Yalnız bilinen sayfalar (harita sağlayıcıları, anahtar konsolları) dış tarayıcıda açılır. */
    internal fun openUrl(url: String): Boolean {
        val uri = Uri.parse(url)
        val host = uri.host.orEmpty()
        val allowed = uri.scheme == "https" && OPEN_HOSTS.any { host == it || host.endsWith(".$it") }
        if (!allowed) return false
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (e: ActivityNotFoundException) {
            false
        }
    }

    private fun displayName(uri: Uri): String = try {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        } ?: uri.lastPathSegment.orEmpty()
    } catch (e: SecurityException) {
        uri.lastPathSegment.orEmpty()
    }

    /** UTF-8 değilse Türkçe ANSI (Windows-1254) kabul edilir. */
    private fun decodeText(bytes: ByteArray): String = try {
        Charsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes)).toString()
    } catch (e: java.nio.charset.CharacterCodingException) {
        String(bytes, java.nio.charset.Charset.forName("windows-1254"))
    }

    /** Ekran hazırsa arayüzün kendi bildirimiyle, değilse Android bildirimiyle gösterir. */
    internal fun toast(message: String) {
        if (pageReady && web != null) {
            emit("toast", JSONObject().put("text", message))
        } else {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
    }

    companion object {
        private const val TAG = "SebekeHakedis"
        const val HOST = "appassets.local"
        const val ORIGIN = "https://$HOST"
        const val PROJECT_FORMAT = "sebeke-hakedis.proje"
        private const val CALL_TIMEOUT_S = 20L
        private const val FIX_INTERVAL_MS = 200L
        private const val LOG_INTERVAL_MS = 300L
        private const val MAX_PROJECT_BYTES = 120L * 1024 * 1024
        private const val PHOTO_MAX_PX = 1600
        private val SAVE_MIMES = listOf(
            "application/json",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/dxf",
            "text/csv",
            "application/zip",
            "application/octet-stream"
        )
        private val OPEN_HOSTS = listOf("google.com", "yandex.com", "yandex.ru", "openstreetmap.org", "osmfoundation.org")
    }
}
