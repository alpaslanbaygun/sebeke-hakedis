package com.sebekehakedis.mobil

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Telefondaki projeler. Her proje bir klasördür:
 *  - `proje.sebeke.json`: projenin son derlenmiş hâli (ortak proje dosyası biçiminde)
 *  - `degisiklik.jsonl`: o hâlden sonraki değişiklikler, satır başına bir değişiklik kümesi
 *  - `bilgi.json`: listede gösterilen özet (ad, sayılar, son değişiklik)
 *  - `foto/`: nesnelere bağlı fotoğraflar
 *
 * Sahada her kayıtta yalnız küçük bir satır eklenir (büyük dosya yeniden yazılmaz). Değişiklikler
 * kimliğe göre "koy / sil" işlemleri olduğundan iki kez uygulanmaları sonucu değiştirmez; bu yüzden
 * derleme sırasında telefon kapansa da veri kaybolmaz.
 */
internal class ProjeDeposu(private val root: File) {

    init {
        root.mkdirs()
    }

    fun dir(id: String): File? = if (ID.matches(id)) File(root, id).takeIf { it.isDirectory } else null

    private fun need(id: String): File = dir(id) ?: throw IOException("Proje bulunamadı: $id")

    /** Projelerin özetleri; son değişen en üstte. */
    fun list(): JSONArray {
        val items = root.listFiles { f -> f.isDirectory && ID.matches(f.name) && File(f, BASE).exists() }.orEmpty().map { d ->
            val meta = readMeta(d)
            meta.put("id", d.name)
            meta.put("bekleyen", journalCount(d))
            if (!meta.has("guncelleme")) meta.put("guncelleme", File(d, BASE).lastModified())
            meta
        }.sortedByDescending { it.optLong("guncelleme") }
        return JSONArray(items)
    }

    fun create(text: String, meta: JSONObject): String {
        var id = newId()
        while (File(root, id).exists()) id = newId()
        val d = File(root, id)
        if (!d.mkdirs()) throw IOException("Klasör oluşturulamadı: ${d.path}")
        writeAtomic(File(d, BASE), text)
        writeAtomic(File(d, JOURNAL), "")
        saveMeta(id, meta)
        return id
    }

    /** {"base": <proje>, "journal": [<değişiklik>, ...]} metni (arayüz değişiklikleri sırayla uygular). */
    fun load(id: String): String {
        val d = need(id)
        val base = File(d, BASE).readText(Charsets.UTF_8)
        val sb = StringBuilder(base.length + 64)
        sb.append("{\"base\":").append(base).append(",\"journal\":[")
        var first = true
        for (line in journalLines(d)) {
            if (!first) sb.append(',')
            first = false
            sb.append(line)
        }
        return sb.append("]}").toString()
    }

    /** Değişiklik satırını ekler; satır geçerli bir JSON nesnesi olmalıdır. */
    fun append(id: String, line: String) {
        val d = need(id)
        val clean = line.replace('\n', ' ').replace('\r', ' ').trim()
        JSONObject(clean)
        FileOutputStream(File(d, JOURNAL), true).use { out ->
            out.write((clean + "\n").toByteArray(Charsets.UTF_8))
            out.fd.sync()
        }
    }

    /** Derlenmiş yeni hâli yazar ve değişiklik dosyasını boşaltır. */
    fun compact(id: String, text: String, meta: JSONObject?) {
        val d = need(id)
        // Büyük metin burada ayrıştırılmaz (ana iş parçacığı); arayüz kendi derlediği metni gönderir.
        if (!text.trimStart().startsWith("{") || !text.trimEnd().endsWith("}")) throw IOException("Geçersiz proje metni")
        writeAtomic(File(d, BASE), text)
        writeAtomic(File(d, JOURNAL), "")
        if (meta != null) saveMeta(id, meta)
    }

    fun saveMeta(id: String, meta: JSONObject) {
        val d = need(id)
        val m = JSONObject(meta.toString())
        m.remove("id")
        m.put("guncelleme", System.currentTimeMillis())
        writeAtomic(File(d, META), m.toString())
    }

    fun delete(id: String): Boolean = dir(id)?.deleteRecursively() ?: false

    fun photoDir(id: String): File = File(need(id), PHOTOS).apply { mkdirs() }

    /** Proje klasöründeki bir fotoğraf; ad güvenli değilse null. */
    fun photo(id: String, name: String): File? {
        if (!PHOTO_NAME.matches(name)) return null
        val d = dir(id) ?: return null
        return File(File(d, PHOTOS), name).takeIf { it.isFile }
    }

    private fun readMeta(d: File): JSONObject = try {
        JSONObject(File(d, META).readText(Charsets.UTF_8))
    } catch (e: IOException) {
        JSONObject().put("ad", d.name)
    } catch (e: JSONException) {
        JSONObject().put("ad", d.name)
    }

    private fun journalLines(d: File): List<String> {
        val f = File(d, JOURNAL)
        if (!f.exists()) return emptyList()
        // Yazılırken kesilmiş son satır (telefon kapandıysa) atlanır.
        return f.readLines(Charsets.UTF_8).map { it.trim() }.filter { line ->
            line.isNotEmpty() && try {
                JSONObject(line)
                true
            } catch (e: JSONException) {
                false
            }
        }
    }

    private fun journalCount(d: File): Int {
        val f = File(d, JOURNAL)
        if (!f.exists()) return 0
        var n = 0
        f.forEachLine(Charsets.UTF_8) { if (it.isNotBlank()) n++ }
        return n
    }

    private fun writeAtomic(f: File, text: String) {
        val tmp = File(f.path + ".tmp")
        FileOutputStream(tmp).use { out ->
            out.write(text.toByteArray(Charsets.UTF_8))
            out.fd.sync()
        }
        if (!tmp.renameTo(f)) {
            f.delete()
            if (!tmp.renameTo(f)) throw IOException("Dosya yazılamadı: ${f.path}")
        }
    }

    companion object {
        const val BASE = "proje.sebeke.json"
        const val JOURNAL = "degisiklik.jsonl"
        const val META = "bilgi.json"
        const val PHOTOS = "foto"
        private val ID = Regex("[A-Za-z0-9_-]{1,64}")
        val PHOTO_NAME = Regex("[A-Za-z0-9_.-]{1,120}\\.jpg")

        private fun newId(): String =
            "p" + SimpleDateFormat("yyyyMMddHHmmssSSS", Locale.US).format(Date())
    }
}
