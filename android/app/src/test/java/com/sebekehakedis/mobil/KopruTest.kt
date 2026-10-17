package com.sebekehakedis.mobil

import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.Config
import java.io.File

/**
 * Arayüz WebView'da çalışır; burada ekranların çağırdığı köprü (UiApi) denenir: proje oluşturma,
 * değişiklik günlüğü, derleme, konum kaynağı, harita altlığı. Ayrıca arayüz dosyalarının ve
 * kataloğun APK'ya girdiği doğrulanır.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class KopruTest {

    private val controllers = ArrayList<ActivityController<MainActivity>>()

    private fun idle() = shadowOf(Looper.getMainLooper()).idle()

    private fun launch(): MainActivity {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        controllers.add(controller)
        idle()
        return controller.get()
    }

    private fun MainActivity.call(method: String, args: JSONObject = JSONObject()): Any? = api.handle(method, args)
    private fun MainActivity.obj(method: String, args: JSONObject = JSONObject()): JSONObject = call(method, args) as JSONObject

    @After
    fun tearDown() {
        controllers.forEach { it.pause().stop().destroy() }
        controllers.clear()
        GnssHub.postFix(GnssFix())
        idle()
    }

    private val ornek = """{"bicim":"sebeke-hakedis.proje","surum":1,"proje":{"ad":"Deneme","aktifHakedis":1},"bolgeler":[],"noktalar":[],"elemanlar":[],"hatlar":[],"kanallar":[],"sondajlar":[]}"""

    @Test
    fun projectLifecycle() {
        val a = launch()
        assertEquals(0, (a.call("projects.list") as JSONArray).length())
        val id = a.obj("project.create", JSONObject().put("text", ornek).put("meta", JSONObject().put("ad", "Deneme"))).getString("id")

        val list = a.call("projects.list") as JSONArray
        assertEquals(1, list.length())
        assertEquals("Deneme", list.getJSONObject(0).getString("ad"))
        assertEquals(id, list.getJSONObject(0).getString("id"))

        // Değişiklikler satır satır eklenir, yükleme hepsini sırayla verir.
        a.obj("project.patch", JSONObject().put("id", id).put("line", """{"t":1,"ops":[{"k":"elemanlar","put":{"id":"T1","tur":"AG_DIREK"}}]}"""))
        a.obj("project.patch", JSONObject().put("id", id).put("line", """{"t":2,"ops":[{"k":"elemanlar","del":"T1"}]}"""))
        var loaded = JSONObject((a.call("project.load", JSONObject().put("id", id)) as RawJson).text)
        assertEquals("Deneme", loaded.getJSONObject("base").getJSONObject("proje").getString("ad"))
        assertEquals(2, loaded.getJSONArray("journal").length())
        assertEquals(2, (a.call("projects.list") as JSONArray).getJSONObject(0).getInt("bekleyen"))

        // Yarım kalmış (bozuk) son satır yüklemede atlanır.
        val dir = File(a.filesDir, "projeler/$id")
        File(dir, ProjeDeposu.JOURNAL).appendText("{\"t\":3,\"ops\":[{\"k\":")
        loaded = JSONObject((a.call("project.load", JSONObject().put("id", id)) as RawJson).text)
        assertEquals(2, loaded.getJSONArray("journal").length())

        // Derleme: yeni hâl yazılır, günlük boşalır.
        val yeni = ornek.replace("\"Deneme\"", "\"Deneme 2\"")
        a.obj("project.compact", JSONObject().put("id", id).put("text", yeni).put("meta", JSONObject().put("ad", "Deneme 2")))
        loaded = JSONObject((a.call("project.load", JSONObject().put("id", id)) as RawJson).text)
        assertEquals("Deneme 2", loaded.getJSONObject("base").getJSONObject("proje").getString("ad"))
        assertEquals(0, loaded.getJSONArray("journal").length())
        assertEquals("Deneme 2", (a.call("projects.list") as JSONArray).getJSONObject(0).getString("ad"))

        a.obj("project.delete", JSONObject().put("id", id))
        assertEquals(0, (a.call("projects.list") as JSONArray).length())
    }

    @Test
    fun badPatchIsRejected() {
        val a = launch()
        val id = a.obj("project.create", JSONObject().put("text", ornek)).getString("id")
        var failed = false
        try {
            a.call("project.patch", JSONObject().put("id", id).put("line", "{bozuk"))
        } catch (e: Exception) {
            failed = true
        }
        assertTrue(failed)
        val loaded = JSONObject((a.call("project.load", JSONObject().put("id", id)) as RawJson).text)
        assertEquals(0, loaded.getJSONArray("journal").length())
    }

    @Test
    fun phoneSourceAndStatus() {
        val a = launch()
        val st = a.obj("status")
        assertEquals("bt", st.getString("source"))
        assertTrue(st.getJSONObject("bt").has("state"))
        // İzin yoksa izin istenir; kaynak yine de telefona geçer.
        val r = a.obj("source.set", JSONObject().put("source", "phone"))
        assertTrue(r.optBoolean("needPermission") || r.optBoolean("ok"))
        assertEquals("phone", a.obj("status").getString("source"))
        a.obj("source.set", JSONObject().put("source", "bt"))
        assertEquals("bt", a.obj("prefs.get").getString("source"))
    }

    @Test
    fun phoneLocationBecomesFix() {
        val a = launch()
        val loc = android.location.Location(android.location.LocationManager.GPS_PROVIDER).apply {
            latitude = 38.67
            longitude = 39.22
            altitude = 1100.0
            accuracy = 0.02f
            time = System.currentTimeMillis()
        }
        a.telefon.onLocationChanged(loc)
        idle()
        val f = a.obj("fix")
        assertTrue(f.getBoolean("has"))
        assertEquals("phone", f.getString("source"))
        assertEquals("fixed", f.getString("kind"))
        assertEquals(0.02, f.getDouble("hrms"), 1e-6)
        assertEquals(1100.0, f.getDouble("hMsl"), 1e-9)
    }

    @Test
    fun basemapAndPrefs() {
        val a = launch()
        val b = a.obj("map.base")
        assertEquals("osm", b.getString("id"))
        assertTrue(b.getJSONArray("providers").length() >= 2)
        a.obj("prefs.set", JSONObject().put("autoConfig", true).put("portLetter", "a"))
        val p = a.obj("prefs.get")
        assertTrue(p.getBoolean("autoConfig"))
        assertEquals("A", p.getString("portLetter"))
    }

    @Test
    fun uiAndCatalogAreBundled() {
        val a = launch()
        for (f in listOf("ui/index.html", "ui/app.js", "ui/sh-core.js", "katalog/kalemler.json", "katalog/katsayilar.json")) {
            a.assets.open(f).use { assertTrue(f, it.read() >= 0) }
        }
    }
}
