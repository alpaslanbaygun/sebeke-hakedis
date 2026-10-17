package com.sebekehakedis.mobil

import android.content.Context
import android.util.LruCache
import android.webkit.WebResourceResponse
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.InterruptedIOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

/**
 * Harita altlığı karolarını arayüze verir: WebView `/tiles/<altlık>/<z>/<x>/<y>` ister, karo burada
 * sağlayıcıdan alınır. Tüm sağlayıcılar Web Mercator (EPSG:3857) karo düzenindedir.
 *
 * - OpenStreetMap: anahtarsız. Kullanım kuralı gereği uygulamayı tanıtan User-Agent gönderilir,
 *   yalnız bakılan karolar alınır, önbellek sunucunun Cache-Control / ETag başlıklarına uyar.
 * - Google Map Tiles API: kullanıcının kendi anahtarıyla oturum açılır. Google çevrimdışı saklamaya
 *   izin vermediği için karolar yalnız bellekte tutulur.
 * - Yandex Tiles API: kullanıcının kendi anahtarıyla; yalnız yol haritası vardır, bellekte tutulur.
 */
class TileServer(private val context: Context, private val prefs: Prefs, version: String) {

    enum class Key { GOOGLE, YANDEX }

    data class Provider(val id: String, val label: String, val key: Key?, val maxZoom: Int, val attribution: String)

    private val userAgent = "SebekeHakedis/$version (Android; elektrik sebekesi hakedis uygulamasi)"

    /** Android uygulamasına kısıtlı Google anahtarları için paket adı ve imza parmak izi. */
    val packageName: String = context.packageName
    val certSha1: String = signingSha1(context)

    /** Sağlayıcı başına son hata (ör. anahtar geçersiz); arayüz gösterir. */
    private val errors = ConcurrentHashMap<String, String>()

    private val memory = object : LruCache<String, ByteArray>(MEMORY_BYTES) {
        override fun sizeOf(key: String, value: ByteArray) = value.size
    }

    private val osmSlots = Semaphore(OSM_CONNECTIONS)
    private val pool = Executors.newFixedThreadPool(FETCH_THREADS) { r -> Thread(r, "tiles").apply { isDaemon = true } }
    private val googleSessions = ConcurrentHashMap<String, Pair<String, Long>>()
    @Volatile private var googleKeyUsed = ""
    private var savedSinceTrim = 0

    fun error(id: String): String? = errors[id]

    /** Anahtar değiştiğinde eski oturumlar ve hatalar unutulur. */
    fun keysChanged() {
        googleSessions.clear()
        errors.clear()
        memory.evictAll()
    }

    fun ready(p: Provider): Boolean = when (p.key) {
        Key.GOOGLE -> prefs.googleTilesKey.isNotBlank()
        Key.YANDEX -> prefs.yandexTilesKey.isNotBlank()
        null -> true
    }

    // ---- WebView isteği ----

    fun serve(path: String): WebResourceResponse {
        val parts = path.trim('/').split('/')
        // tiles/<id>/<z>/<x>/<y>
        if (parts.size != 5) return status(400, "Bad Request")
        val provider = PROVIDERS.firstOrNull { it.id == parts[1] && it.id != NONE } ?: return status(404, "Not Found")
        val z = parts[2].toIntOrNull()
        val x = parts[3].toIntOrNull()
        val y = parts[4].toIntOrNull()
        if (z == null || x == null || y == null || z < 0 || z > provider.maxZoom) return status(400, "Bad Request")
        val n = 1 shl z
        if (x !in 0 until n || y !in 0 until n) return status(404, "Not Found")
        if (!ready(provider)) return status(401, "Key Required")
        // Önbellekte taze karo varsa hemen verilir; yoksa indirme arka planda yapılır ve WebView'ın
        // istek iş parçacığı bekletilmez (zayıf bağlantıda arayüz dosyaları da gecikmesin).
        cached(provider, z, x, y)?.let { return image(it) }
        return image(LazyTile { fetch(provider, z, x, y) })
    }

    private fun fetch(provider: Provider, z: Int, x: Int, y: Int): ByteArray? = try {
        when (provider.key) {
            null -> osm(z, x, y)
            Key.GOOGLE -> google(provider.id, z, x, y)
            Key.YANDEX -> yandex(z, x, y)
        }
    } catch (e: IOException) {
        // Görünümden kalkan karonun iptali hata sayılmaz.
        if (e !is InterruptedIOException && !Thread.currentThread().isInterrupted) {
            errors.putIfAbsent(provider.id, context.getString(R.string.tile_network, e.message ?: e.javaClass.simpleName))
        }
        null
    }

    private fun cached(provider: Provider, z: Int, x: Int, y: Int): ByteArray? = when (provider.key) {
        null -> {
            val file = File(context.cacheDir, "tiles/osm/$z/$x/$y.png")
            val expires = File(file.path + ".meta").takeIf { it.exists() }?.readLines()?.firstOrNull()?.toLongOrNull() ?: 0L
            if (file.exists() && System.currentTimeMillis() < expires) file.readBytes() else null
        }
        Key.GOOGLE -> memory.get("${provider.id}/$z/$x/$y")
        Key.YANDEX -> memory.get("yandex/$z/$x/$y")
    }

    /** Görsel yanıt. Tarayıcı resmi içeriğinden tanır (PNG / JPEG); boş akış resim hatası olur. */
    private fun image(bytes: ByteArray) = image(ByteArrayInputStream(bytes))

    private fun image(stream: InputStream) =
        // WebView kendi önbelleğine yazmasın; saklama kuralları burada uygulanır.
        WebResourceResponse("image/png", null, 200, "OK", mapOf("Cache-Control" to "no-store"), stream)

    /** İlk okunduğunda arka plandaki indirmeyi bekleyen akış; resim görünümden kalkınca indirme iptal edilir. */
    private inner class LazyTile(task: () -> ByteArray?) : InputStream() {
        private val future: Future<ByteArray?> = pool.submit(Callable { task() })
        private var data: ByteArrayInputStream? = null

        private fun data(): ByteArrayInputStream = data ?: ByteArrayInputStream(
            try {
                future.get(FETCH_TIMEOUT_S, TimeUnit.SECONDS) ?: ByteArray(0)
            } catch (e: Exception) {
                ByteArray(0)
            }
        ).also { data = it }

        override fun read(): Int = data().read()
        override fun read(b: ByteArray, off: Int, len: Int): Int = data().read(b, off, len)
        override fun available(): Int = data?.available() ?: 0
        override fun close() {
            future.cancel(true)
        }
    }

    private fun status(code: Int, reason: String) =
        WebResourceResponse("text/plain", "utf-8", code, reason, mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))

    // ---- OpenStreetMap: diskte, başlıklara uyan önbellek ----

    private fun osm(z: Int, x: Int, y: Int): ByteArray? {
        val file = File(context.cacheDir, "tiles/osm/$z/$x/$y.png")
        val meta = File(file.path + ".meta")
        val now = System.currentTimeMillis()
        val info = if (meta.exists()) meta.readLines() else emptyList()
        val expires = info.getOrNull(0)?.toLongOrNull() ?: 0L
        if (file.exists() && now < expires) return file.readBytes()

        if (!osmSlots.tryAcquire(OSM_WAIT_S, TimeUnit.SECONDS)) return if (file.exists()) file.readBytes() else null
        try {
            val conn = open("https://tile.openstreetmap.org/$z/$x/$y.png")
            if (file.exists()) {
                info.getOrNull(1)?.takeIf { it.isNotEmpty() }?.let { conn.setRequestProperty("If-None-Match", it) }
                info.getOrNull(2)?.takeIf { it.isNotEmpty() }?.let { conn.setRequestProperty("If-Modified-Since", it) }
            }
            return try {
                when (val code = conn.responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val bytes = conn.inputStream.use { it.readBytes() }
                        file.parentFile?.mkdirs()
                        file.writeBytes(bytes)
                        writeMeta(meta, conn, now)
                        errors.remove("osm")
                        trimLater()
                        bytes
                    }
                    HttpURLConnection.HTTP_NOT_MODIFIED -> {
                        writeMeta(meta, conn, now, info)
                        file.readBytes()
                    }
                    else -> {
                        errors["osm"] = context.getString(R.string.tile_http, "OpenStreetMap", code)
                        if (file.exists()) file.readBytes() else null
                    }
                }
            } catch (e: IOException) {
                // Sahada bağlantı yoksa eski karo gösterilir.
                if (file.exists()) file.readBytes() else throw e
            } finally {
                conn.disconnect()
            }
        } finally {
            osmSlots.release()
        }
    }

    private fun writeMeta(meta: File, conn: HttpURLConnection, now: Long, old: List<String> = emptyList()) {
        val maxAge = conn.getHeaderField("Cache-Control")?.let { Regex("max-age=(\\d+)").find(it)?.groupValues?.get(1)?.toLongOrNull() }
        val expires = when {
            maxAge != null -> now + maxAge * 1000
            conn.expiration > now -> conn.expiration
            else -> now + DEFAULT_CACHE_MS
        }
        val etag = conn.getHeaderField("ETag") ?: old.getOrNull(1).orEmpty()
        val lastModified = conn.getHeaderField("Last-Modified") ?: old.getOrNull(2).orEmpty()
        meta.parentFile?.mkdirs()
        meta.writeText("$expires\n$etag\n$lastModified\n")
    }

    /** Disk önbelleği sınırı aşarsa en eski karolar silinir (yalnız uygulamanın kendi önbelleği). */
    private fun trimLater() {
        synchronized(this) {
            if (++savedSinceTrim < TRIM_EVERY) return
            savedSinceTrim = 0
        }
        val root = File(context.cacheDir, "tiles/osm")
        val files = root.walkTopDown().filter { it.isFile && it.name.endsWith(".png") }.toList()
        var total = files.sumOf { it.length() }
        if (total <= DISK_BYTES) return
        for (f in files.sortedBy { it.lastModified() }) {
            if (total <= DISK_BYTES * 3 / 4) break
            total -= f.length()
            f.delete()
            File(f.path + ".meta").delete()
        }
    }

    // ---- Google Map Tiles API ----

    private fun google(id: String, z: Int, x: Int, y: Int): ByteArray? {
        val cacheKey = "$id/$z/$x/$y"
        memory.get(cacheKey)?.let { return it }
        val key = prefs.googleTilesKey.trim()
        if (key != googleKeyUsed) {
            googleSessions.clear()
            googleKeyUsed = key
        }
        for (attempt in 0..1) {
            val session = googleSession(id, key) ?: return null
            val conn = open("https://tile.googleapis.com/v1/2dtiles/$z/$x/$y?session=${enc(session)}&key=${enc(key)}")
            try {
                when (val code = conn.responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val bytes = conn.inputStream.use { it.readBytes() }
                        memory.put(cacheKey, bytes)
                        errors.remove(id)
                        return bytes
                    }
                    // Oturum süresi dolmuş olabilir: bir kez yenilenir.
                    HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> {
                        googleSessions.remove(id)
                        if (attempt == 1) {
                            errors[id] = context.getString(R.string.tile_key_rejected, "Google", code, errorText(conn))
                        }
                    }
                    HttpURLConnection.HTTP_NOT_FOUND -> return null
                    else -> {
                        errors[id] = context.getString(R.string.tile_http, "Google", code)
                        return null
                    }
                }
            } finally {
                conn.disconnect()
            }
        }
        return null
    }

    private fun googleSession(id: String, key: String): String? {
        val now = System.currentTimeMillis() / 1000
        googleSessions[id]?.let { (token, expiry) -> if (expiry - now > SESSION_MARGIN_S) return token }
        synchronized(googleSessions) {
            googleSessions[id]?.let { (token, expiry) -> if (expiry - now > SESSION_MARGIN_S) return token }
            val body = JSONObject()
                .put("mapType", if (id == "g-road") "roadmap" else "satellite")
                .put("language", "tr-TR")
                .put("region", "TR")
                .put("scale", "scaleFactor2x")
                .put("highDpi", true)
            if (id == "g-hyb") body.put("layerTypes", JSONArray().put("layerRoadmap"))
            val conn = open("https://tile.googleapis.com/v1/createSession?key=${enc(key)}")
            try {
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val code = conn.responseCode
                if (code != HttpURLConnection.HTTP_OK) {
                    errors[id] = context.getString(R.string.tile_key_rejected, "Google", code, errorText(conn))
                    return null
                }
                val o = JSONObject(conn.inputStream.use { it.readBytes() }.toString(Charsets.UTF_8))
                val token = o.getString("session")
                val expiry = o.optString("expiry").toLongOrNull() ?: (now + 86400)
                googleSessions[id] = token to expiry
                return token
            } finally {
                conn.disconnect()
            }
        }
    }

    /** Görünen alan için Google'ın göstermesini istediği telif yazısı. Ağ çağrısıdır; ana iş parçacığında çağırmayın. */
    fun googleCopyright(id: String, zoom: Int, north: Double, south: Double, east: Double, west: Double): String? {
        val key = prefs.googleTilesKey.trim()
        if (key.isEmpty()) return null
        val session = googleSession(id, key) ?: return null
        val url = "https://tile.googleapis.com/tile/v1/viewport?session=${enc(session)}&key=${enc(key)}" +
            "&zoom=$zoom&north=$north&south=$south&east=$east&west=$west"
        val conn = open(url)
        return try {
            if (conn.responseCode != HttpURLConnection.HTTP_OK) null
            else JSONObject(conn.inputStream.use { it.readBytes() }.toString(Charsets.UTF_8)).optString("copyright").ifEmpty { null }
        } finally {
            conn.disconnect()
        }
    }

    // ---- Yandex Tiles API ----

    private fun yandex(z: Int, x: Int, y: Int): ByteArray? {
        val cacheKey = "yandex/$z/$x/$y"
        memory.get(cacheKey)?.let { return it }
        val key = prefs.yandexTilesKey.trim()
        val conn = open(
            "https://tiles.api-maps.yandex.ru/v1/tiles/?x=$x&y=$y&z=$z&lang=tr_TR&l=map" +
                "&projection=web_mercator&scale=2&apikey=${enc(key)}"
        )
        try {
            return when (val code = conn.responseCode) {
                HttpURLConnection.HTTP_OK -> {
                    val bytes = conn.inputStream.use { it.readBytes() }
                    memory.put(cacheKey, bytes)
                    errors.remove("yandex")
                    bytes
                }
                HttpURLConnection.HTTP_NOT_FOUND, HttpURLConnection.HTTP_NO_CONTENT -> null
                HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> {
                    errors["yandex"] = context.getString(R.string.tile_key_rejected, "Yandex", code, errorText(conn))
                    null
                }
                else -> {
                    errors["yandex"] = context.getString(R.string.tile_http, "Yandex", code)
                    null
                }
            }
        } finally {
            conn.disconnect()
        }
    }

    // ---- Ortak ----

    private fun open(url: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = CONNECT_TIMEOUT_MS
        conn.readTimeout = READ_TIMEOUT_MS
        conn.setRequestProperty("User-Agent", userAgent)
        if (url.startsWith("https://tile.googleapis.com/") && certSha1.isNotEmpty()) {
            conn.setRequestProperty("X-Android-Package", packageName)
            conn.setRequestProperty("X-Android-Cert", certSha1.replace(":", ""))
        }
        return conn
    }

    /** Anahtarı gerçek bir istekle dener; kullanıcıya gösterilecek sonucu döndürür. Ağ çağrısıdır. */
    fun testKey(key: Key): Pair<Boolean, String> = try {
        when (key) {
            Key.GOOGLE -> {
                val k = prefs.googleTilesKey.trim()
                if (k.isEmpty()) false to context.getString(R.string.tile_key_missing, "Google")
                else {
                    googleSessions.remove("g-road")
                    errors.remove("g-road")
                    if (googleSession("g-road", k) != null) true to context.getString(R.string.tile_key_ok, "Google Map Tiles API")
                    else false to (errors["g-road"] ?: context.getString(R.string.tile_http, "Google", 0))
                }
            }
            Key.YANDEX -> {
                if (prefs.yandexTilesKey.isBlank()) false to context.getString(R.string.tile_key_missing, "Yandex")
                else {
                    memory.remove("yandex/10/605/387")
                    errors.remove("yandex")
                    if (yandex(10, 605, 387) != null) true to context.getString(R.string.tile_key_ok, "Yandex Tiles API")
                    else false to (errors["yandex"] ?: context.getString(R.string.tile_http, "Yandex", 0))
                }
            }
        }
    } catch (e: IOException) {
        false to context.getString(R.string.tile_network, e.message ?: e.javaClass.simpleName)
    }

    private fun errorText(conn: HttpURLConnection): String = try {
        val text = conn.errorStream?.use { it.readBytes() }?.toString(Charsets.UTF_8).orEmpty()
        JSONObject(text).optJSONObject("error")?.optString("message").orEmpty().take(160)
    } catch (e: Exception) {
        ""
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    companion object {
        const val NONE = "none"

        val PROVIDERS = listOf(
            Provider(NONE, "Yok (yalnız ızgara)", null, 0, ""),
            Provider("osm", "OpenStreetMap", null, 19, "© OpenStreetMap katkıcıları"),
            Provider("g-sat", "Google Uydu", Key.GOOGLE, 21, "Google"),
            Provider("g-hyb", "Google Hibrit", Key.GOOGLE, 21, "Google"),
            Provider("g-road", "Google Yol", Key.GOOGLE, 22, "Google"),
            Provider("yandex", "Yandex Harita", Key.YANDEX, 19, "© Yandex · Yandex Haritalar")
        )

        /** Uygulamayı imzalayan sertifikanın SHA-1 parmak izi (AA:BB:… biçiminde); okunamazsa boş. */
        @Suppress("DEPRECATION")
        fun signingSha1(context: Context): String = try {
            val pm = context.packageManager
            val sig = if (android.os.Build.VERSION.SDK_INT >= 28) {
                val info = pm.getPackageInfo(context.packageName, android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES)
                info.signingInfo?.apkContentsSigners?.firstOrNull()
            } else {
                pm.getPackageInfo(context.packageName, android.content.pm.PackageManager.GET_SIGNATURES).signatures?.firstOrNull()
            }
            if (sig == null) "" else java.security.MessageDigest.getInstance("SHA-1").digest(sig.toByteArray())
                .joinToString(":") { String.format(java.util.Locale.US, "%02X", it) }
        } catch (e: Exception) {
            ""
        }

        private const val MEMORY_BYTES = 24 * 1024 * 1024
        private const val DISK_BYTES = 150L * 1024 * 1024
        private const val TRIM_EVERY = 200
        private const val OSM_CONNECTIONS = 2
        private const val FETCH_THREADS = 4
        private const val FETCH_TIMEOUT_S = 30L
        private const val OSM_WAIT_S = 20L
        private const val DEFAULT_CACHE_MS = 7L * 24 * 3600 * 1000
        private const val SESSION_MARGIN_S = 3600L
        private const val CONNECT_TIMEOUT_MS = 8000
        private const val READ_TIMEOUT_MS = 12000
    }
}
