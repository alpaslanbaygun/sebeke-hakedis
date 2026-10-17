package com.sebekehakedis.mobil

import android.provider.Settings
import android.text.format.Formatter
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.Locale
import kotlin.concurrent.thread

/** Köprünün olduğu gibi (ayrıştırmadan) arayüze verdiği JSON metni. */
internal class RawJson(val text: String)

/**
 * Arayüzün (WebView'deki ekranlar) çağırdığı işlemler. Her çağrı ana iş parçacığında çalışır, JSON
 * nesnesi alır ve JSON'a çevrilebilir bir değer döner. Hata durumunda {"error": "..."} döner.
 *
 * Proje mantığının tamamı (eleman, hat, kanal, rapor, Excel) arayüz tarafındaki JavaScript
 * çekirdeğindedir; burada yalnız telefon işleri vardır: dosya saklama, konum kaynakları, paylaşma.
 */
internal class UiApi(private val host: MainActivity) {

    private val prefs: Prefs get() = host.prefs
    private val depo: ProjeDeposu get() = host.depo

    fun handle(method: String, a: JSONObject): Any? = when (method) {
        "app.init" -> {
            host.pageReady = true
            obj("version" to host.versionName(), "lastProject" to prefs.lastProject, "source" to prefs.source)
        }
        "app.exit" -> host.finish().let { ok() }
        "toast" -> host.toast(a.optString("text")).let { ok() }

        // ---- Projeler ----
        "projects.list" -> depo.list()
        "project.create" -> obj("id" to depo.create(a.getString("text"), a.optJSONObject("meta") ?: JSONObject()))
        "project.load" -> {
            val id = a.getString("id")
            val raw = RawJson(depo.load(id))
            prefs.lastProject = id
            raw
        }
        "project.patch" -> {
            depo.append(a.getString("id"), a.getString("line"))
            ok()
        }
        "project.compact" -> {
            depo.compact(a.getString("id"), a.getString("text"), a.optJSONObject("meta"))
            ok()
        }
        "project.meta" -> {
            depo.saveMeta(a.getString("id"), a.getJSONObject("meta"))
            ok()
        }
        "project.delete" -> {
            val id = a.getString("id")
            depo.delete(id)
            if (prefs.lastProject == id) prefs.lastProject = ""
            ok()
        }
        "project.close" -> {
            prefs.lastProject = ""
            ok()
        }
        "project.import" -> host.launchOpenProject().let { ok() }

        // ---- Dosya kaydetme ve paylaşma ----
        "file.save" -> host.launchSave(fileName(a), a.optString("mime").ifEmpty { MIME_BIN }, payload(a)).let { ok() }
        "file.share" -> {
            host.share(fileName(a), a.optString("mime").ifEmpty { MIME_BIN }, payload(a), a.optString("subject"))
            ok()
        }

        // ---- Fotoğraflar ----
        "photo.take" -> host.takePhoto(a.getString("id"), a.getString("ref"))
        "photo.delete" -> {
            depo.photo(a.getString("id"), a.getString("file"))?.delete()
            ok()
        }
        "photo.share" -> host.sharePhotos(a.getString("id"), a.optJSONArray("files"), a.optString("name"))

        // ---- Konum kaynağı ----
        "source.set" -> setSource(a.optString("source"))
        "status" -> statusJson()
        "bt.devices" -> host.btDevices()
        "bt.permission" -> host.withBtPermission { host.emit("permission", obj("granted" to true)) }.let { ok() }
        "bt.enable" -> host.requestBtEnable().let { ok() }
        "bt.settings" -> host.openSettings(Settings.ACTION_BLUETOOTH_SETTINGS).let { ok() }
        "bt.select" -> {
            prefs.deviceAddress = a.getString("address")
            prefs.deviceName = a.optString("name").ifEmpty { a.getString("address") }
            statusJson()
        }
        "bt.connect" -> host.connect()
        "bt.disconnect" -> {
            GnssService.command(host, GnssService.ACTION_STOP)
            ok()
        }
        "ntrip.get" -> obj(
            "host" to prefs.ntripHost, "port" to prefs.ntripPort, "mount" to prefs.ntripMount,
            "user" to prefs.ntripUser, "pass" to prefs.ntripPass, "gga" to prefs.ntripSendGga, "auto" to prefs.ntripAuto
        )
        "ntrip.save" -> {
            if (a.has("host")) prefs.ntripHost = a.getString("host").trim()
            if (a.has("port")) prefs.ntripPort = a.optString("port").trim().toIntOrNull()?.takeIf { it in 1..65535 } ?: 2101
            if (a.has("mount")) prefs.ntripMount = a.getString("mount").trim()
            if (a.has("user")) prefs.ntripUser = a.getString("user").trim()
            if (a.has("pass")) prefs.ntripPass = a.getString("pass")
            if (a.has("gga")) prefs.ntripSendGga = a.getBoolean("gga")
            if (a.has("auto")) prefs.ntripAuto = a.getBoolean("auto")
            ok()
        }
        "ntrip.start" -> when {
            prefs.ntripHost.isEmpty() || prefs.ntripMount.isEmpty() -> err(host.getString(R.string.ntrip_missing))
            GnssHub.btState != LinkState.CONNECTED -> err(host.getString(R.string.ntrip_need_bt))
            else -> GnssService.command(host, GnssService.ACTION_NTRIP_START).let { ok() }
        }
        "ntrip.stop" -> GnssService.command(host, GnssService.ACTION_NTRIP_STOP).let { ok() }
        "ntrip.mounts" -> fetchMounts(a.optString("host").trim(), a.optString("port").trim().toIntOrNull() ?: 2101)
        "phone.start" -> host.startPhone()
        "phone.stop" -> host.telefon.stop().let { ok() }
        "phone.settings" -> host.openSettings(Settings.ACTION_LOCATION_SOURCE_SETTINGS).let { ok() }
        "dev.settings" -> host.openSettings(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS).let { ok() }
        "fix" -> fixJson(GnssHub.fix)
        "sats" -> satsJson()
        "log.get" -> JSONArray(GnssHub.logSnapshot().takeLast(a.optInt("max", 300)))

        // ---- Ayarlar ve harita altlığı ----
        "prefs.get" -> prefsJson()
        "prefs.set" -> {
            setPrefs(a)
            prefsJson()
        }
        "map.base" -> baseJson()
        "map.setBase" -> {
            val id = a.optString("id")
            if (TileServer.PROVIDERS.any { it.id == id }) prefs.basemap = id
            baseJson()
        }
        "tiles.info" -> obj("package" to host.tiles.packageName, "sha1" to host.tiles.certSha1)
        "tiles.test" -> {
            val key = if (a.optString("kind") == "yandex") TileServer.Key.YANDEX else TileServer.Key.GOOGLE
            thread(name = "tile-test") {
                val (good, text) = host.tiles.testKey(key)
                host.runOnUiThread { host.emit("keyTest", obj("kind" to a.optString("kind"), "ok" to good, "text" to text)) }
            }
            ok()
        }
        "map.attrib" -> {
            val id = a.optString("id")
            if (TileServer.PROVIDERS.firstOrNull { it.id == id }?.key == TileServer.Key.GOOGLE) {
                val z = a.optInt("z")
                val n = a.optDouble("n")
                val s = a.optDouble("s")
                val e = a.optDouble("e")
                val w = a.optDouble("w")
                thread(name = "tile-attrib") {
                    val text = try {
                        host.tiles.googleCopyright(id, z, n, s, e, w)
                    } catch (ex: IOException) {
                        null
                    }
                    if (text != null) host.runOnUiThread { host.emit("attrib", obj("id" to id, "text" to text)) }
                }
            }
            ok()
        }
        "open.url" -> if (host.openUrl(a.optString("url"))) ok() else err(host.getString(R.string.url_blocked))
        else -> err("Bilinmeyen işlem: $method")
    }

    // ---- Konum kaynağı ----

    private fun setSource(source: String): JSONObject {
        return when (source) {
            "phone" -> {
                prefs.source = "phone"
                GnssHub.clearFix()
                host.startPhone()
            }
            "bt" -> {
                prefs.source = "bt"
                host.telefon.stop()
                GnssHub.clearFix()
                ok()
            }
            else -> err(host.getString(R.string.invalid_value))
        }
    }

    fun statusJson(): JSONObject {
        fun state(s: LinkState) = when (s) {
            LinkState.CONNECTED -> "on"
            LinkState.CONNECTING -> "connecting"
            LinkState.DISCONNECTED -> "off"
        }
        return obj(
            "source" to prefs.source,
            "bt" to obj(
                "state" to state(GnssHub.btState),
                "msg" to GnssHub.btMessage.ifEmpty { host.getString(R.string.bt_idle) },
                "device" to prefs.deviceName,
                "address" to prefs.deviceAddress
            ),
            "ntrip" to obj(
                "state" to state(GnssHub.ntripState),
                "msg" to GnssHub.ntripMessage.ifEmpty { host.getString(R.string.ntrip_idle) },
                "bytes" to Formatter.formatShortFileSize(host, GnssHub.ntripBytes),
                "host" to prefs.ntripHost,
                "port" to prefs.ntripPort,
                "mount" to prefs.ntripMount,
                "auto" to prefs.ntripAuto,
                "configured" to (prefs.ntripHost.isNotEmpty() && prefs.ntripMount.isNotEmpty())
            ),
            "phone" to obj(
                "state" to state(GnssHub.phoneState),
                "msg" to GnssHub.phoneMessage.ifEmpty { host.getString(R.string.phone_idle) },
                "permission" to host.telefon.hasPermission()
            ),
            "autoConfig" to prefs.autoConfig
        )
    }

    private fun fetchMounts(address: String, port: Int): JSONObject {
        if (address.isEmpty()) return err(host.getString(R.string.ntrip_missing))
        thread(name = "ntrip-list") {
            val result = try {
                val list = NtripClient.fetchMountpoints(address, port)
                if (list.isEmpty()) err(host.getString(R.string.ntrip_list_empty)) else obj("mounts" to JSONArray(list))
            } catch (e: IOException) {
                err(host.getString(R.string.ntrip_list_failed, e.message ?: e.javaClass.simpleName))
            } catch (e: IllegalArgumentException) {
                err(host.getString(R.string.ntrip_list_failed, e.message ?: e.javaClass.simpleName))
            }
            host.runOnUiThread { host.emit("mounts", result) }
        }
        return ok()
    }

    // ---- GNSS ----

    fun fixJson(fix: GnssFix): JSONObject {
        val live = fix.isLive()
        val has = live && fix.hasPosition
        val o = obj(
            "live" to live,
            "has" to has,
            "quality" to fix.quality,
            "kind" to kind(fix.quality, live),
            "label" to if (live) host.getString(FixInfo.label(fix.quality)) else host.getString(R.string.fix_nodata),
            "sats" to fix.sats,
            "utc" to fix.utc,
            "source" to if (fix.source == GnssFix.SOURCE_PHONE) "phone" else "bt",
            "mock" to fix.mock
        )
        o.num("age", if (live) fix.ageSec else Double.NaN)
        o.num("hrms", if (has) fix.hrms else Double.NaN)
        o.num("vrms", if (has) fix.sigmaAlt else Double.NaN)
        o.num("pdop", if (live) fix.pdop else Double.NaN)
        o.num("hdop", if (live) fix.hdop else Double.NaN)
        o.num("lat", if (has) fix.lat else Double.NaN)
        o.num("lon", if (has) fix.lon else Double.NaN)
        o.num("hMsl", if (has) fix.altMsl else Double.NaN)
        o.num("hEll", if (has) fix.altEllipsoid else Double.NaN)
        o.num("speed", if (has) fix.speedMs else Double.NaN)
        o.num("bearing", if (has) fix.bearing else Double.NaN)
        return o
    }

    private fun kind(quality: Int, live: Boolean): String = when {
        !live -> "nodata"
        quality == 4 -> "fixed"
        quality == 5 -> "float"
        quality == 2 || quality == 9 -> "dgps"
        quality == 1 || quality == 3 -> "auto"
        else -> "none"
    }

    private fun satsJson(): JSONArray {
        val sats = if (GnssHub.fix.isLive()) GnssHub.sats else emptyList()
        return JSONArray(sats.map {
            obj("sys" to it.system.toString(), "prn" to it.prn, "el" to it.elevation, "az" to it.azimuth, "snr" to it.snr, "used" to it.used, "label" to it.label)
        })
    }

    // ---- Ayarlar ----

    private fun prefsJson() = obj(
        "basemap" to prefs.basemap,
        "autoConfig" to prefs.autoConfig,
        "portLetter" to prefs.portLetter,
        "source" to prefs.source,
        // Anahtarın kendisi arayüze verilmez; yalnız son dört karakteri gösterilir.
        "googleKeyHint" to keyHint(prefs.googleTilesKey),
        "yandexKeyHint" to keyHint(prefs.yandexTilesKey)
    )

    private fun keyHint(key: String): String = if (key.isBlank()) "" else "••••" + key.trim().takeLast(4)

    private fun setPrefs(a: JSONObject) {
        for (key in a.keys()) {
            when (key) {
                "autoConfig" -> prefs.autoConfig = a.getBoolean(key)
                "portLetter" -> prefs.portLetter = a.getString(key).uppercase(Locale.US).take(1).ifEmpty { "C" }
                "googleTilesKey" -> {
                    prefs.googleTilesKey = a.getString(key).trim()
                    host.tiles.keysChanged()
                }
                "yandexTilesKey" -> {
                    prefs.yandexTilesKey = a.getString(key).trim()
                    host.tiles.keysChanged()
                }
                "basemap" -> a.getString(key).let { id -> if (TileServer.PROVIDERS.any { it.id == id }) prefs.basemap = id }
            }
        }
    }

    private fun baseJson(): JSONObject {
        val providers = JSONArray()
        for (p in TileServer.PROVIDERS) {
            providers.put(
                obj(
                    "id" to p.id, "label" to p.label, "maxZoom" to p.maxZoom, "attribution" to p.attribution,
                    "needs" to when (p.key) {
                        TileServer.Key.GOOGLE -> "google"
                        TileServer.Key.YANDEX -> "yandex"
                        null -> JSONObject.NULL
                    },
                    "ready" to host.tiles.ready(p)
                )
            )
        }
        val current = TileServer.PROVIDERS.firstOrNull { it.id == prefs.basemap } ?: TileServer.PROVIDERS[0]
        val o = obj("id" to current.id, "providers" to providers)
        if (!host.tiles.ready(current)) {
            o.put("error", host.getString(R.string.tile_key_missing, if (current.key == TileServer.Key.GOOGLE) "Google" else "Yandex"))
        } else {
            host.tiles.error(current.id)?.let { o.put("error", it) }
        }
        return o
    }

    // ---- Yardımcılar ----

    private fun fileName(a: JSONObject): String =
        a.optString("name").trim().replace(Regex("[\\\\/:*?\"<>|\\n\\r]"), "_").ifEmpty { "dosya" }

    /** Dosya içeriği: "b64" (ikili, ör. Excel) ya da "text" (UTF-8). */
    private fun payload(a: JSONObject): ByteArray =
        if (a.has("b64")) Base64.decode(a.getString("b64"), Base64.DEFAULT) else a.optString("text").toByteArray(Charsets.UTF_8)

    companion object {
        private const val MIME_BIN = "application/octet-stream"

        fun ok(): JSONObject = JSONObject().put("ok", true)
        fun err(message: String): JSONObject = JSONObject().put("error", message)

        fun obj(vararg pairs: Pair<String, Any?>): JSONObject {
            val o = JSONObject()
            for ((k, v) in pairs) {
                when (v) {
                    null -> o.put(k, JSONObject.NULL)
                    is Double -> o.num(k, v)
                    is Float -> o.num(k, v.toDouble())
                    else -> o.put(k, v)
                }
            }
            return o
        }

        /** JSON NaN taşıyamaz; bilinmeyen değer null yazılır. */
        fun JSONObject.num(key: String, v: Double): JSONObject =
            if (v.isNaN() || v.isInfinite()) put(key, JSONObject.NULL) else put(key, v)
    }
}
