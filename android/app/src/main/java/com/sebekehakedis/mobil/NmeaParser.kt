package com.sebekehakedis.mobil

import kotlin.math.floor

class NmeaParser {

    @Volatile
    var fix = GnssFix()
        private set

    private var epoch = 0L
    private var gstAt = 0L

    private class RawSat(val prn: Int, val elevation: Int, val azimuth: Int, val snr: Int)
    private class GsvGroup(val at: Long, val talker: String, val sats: List<RawSat>)
    private class UsedSet(val at: Long, val prns: Set<Int>)

    // Anahtar: konuşmacı + sinyal kimliği (aynı takımuydu için L1/L2 ayrı gruplar gelir).
    private val gsvPending = HashMap<String, ArrayList<RawSat>>()
    private val gsvDone = HashMap<String, GsvGroup>()
    private val usedBySystem = HashMap<Char, UsedSet>()

    /** Satırı işler; yeni bir GGA epoğu oluştuysa true döner. */
    fun parse(line: String): Boolean {
        val s = line.trim()
        if (s.length < 7 || s[0] != '$') return false
        val star = s.lastIndexOf('*')
        val body = if (star > 0) s.substring(1, star) else s.substring(1)
        if (star > 0 && !checksumOk(body, s.substring(star + 1))) return false
        val f = body.split(',')
        if (f[0].length != 5) return false
        val talker = f[0].substring(0, 2)
        when (f[0].substring(2)) {
            "GGA" -> return parseGga(f)
            "RMC" -> parseRmc(f)
            "GST" -> parseGst(f)
            "GSA" -> parseGsa(talker, f)
            "GSV" -> parseGsv(talker, f)
        }
        return false
    }

    /** Son 10 saniyede görülen uydular; aynı uydunun birden çok sinyalinden en güçlüsü alınır. */
    fun satellites(): List<SatInfo> {
        val now = System.currentTimeMillis()
        val merged = HashMap<String, SatInfo>()
        for (group in gsvDone.values) {
            if (now - group.at > SAT_MAX_AGE_MS) continue
            for (raw in group.sats) {
                val system = systemOf(group.talker, raw.prn)
                val used = isUsed(system, raw.prn, now)
                val info = SatInfo(system, displayPrn(system, raw.prn), raw.elevation, raw.azimuth, raw.snr, used)
                val previous = merged[info.label]
                if (previous == null || info.snr > previous.snr) merged[info.label] = info
            }
        }
        return merged.values.sortedWith(compareBy({ SYSTEM_ORDER.indexOf(it.system) }, { it.prn }))
    }

    private fun parseGga(f: List<String>): Boolean {
        if (f.size < 12) return false
        val now = System.currentTimeMillis()
        val gstFresh = now - gstAt < GST_MAX_AGE_MS
        fix = fix.copy(
            utc = formatUtc(f[1]),
            lat = coordinate(f[2], f[3]),
            lon = coordinate(f[4], f[5]),
            quality = f[6].toIntOrNull() ?: 0,
            sats = f[7].toIntOrNull() ?: 0,
            hdop = num(f[8]),
            altMsl = num(f[9]),
            geoidSep = num(f[11]),
            ageSec = num(f.getOrNull(13)),
            stationId = f.getOrNull(14).orEmpty(),
            sigmaLat = if (gstFresh) fix.sigmaLat else Double.NaN,
            sigmaLon = if (gstFresh) fix.sigmaLon else Double.NaN,
            sigmaAlt = if (gstFresh) fix.sigmaAlt else Double.NaN,
            epoch = ++epoch,
            receivedAt = now
        )
        return true
    }

    private fun parseRmc(f: List<String>) {
        if (f.size < 9) return
        val knots = num(f[7])
        fix = fix.copy(
            speedMs = if (knots.isNaN()) Double.NaN else knots * 0.514444,
            bearing = num(f[8])
        )
    }

    private fun parseGst(f: List<String>) {
        if (f.size < 9) return
        gstAt = System.currentTimeMillis()
        fix = fix.copy(sigmaLat = num(f[6]), sigmaLon = num(f[7]), sigmaAlt = num(f[8]))
    }

    private fun parseGsa(talker: String, f: List<String>) {
        if (f.size < 18) return
        fix = fix.copy(pdop = num(f[15]), hdop = num(f[16]), vdop = num(f[17]))

        val now = System.currentTimeMillis()
        val prns = (3..14).mapNotNull { f[it].toIntOrNull() }
        // NMEA 4.10+: 19. alan sistem kimliği. Yoksa konuşmacıdan veya PRN aralığından çıkarılır.
        val explicit = SYSTEM_BY_ID[f.getOrNull(18)?.toIntOrNull() ?: 0]
        if (explicit != null) {
            usedBySystem[explicit] = UsedSet(now, prns.toSet())
        } else {
            for ((system, group) in prns.groupBy { systemOf(talker, it) }) {
                usedBySystem[system] = UsedSet(now, group.toSet())
            }
        }
    }

    private fun parseGsv(talker: String, f: List<String>) {
        if (f.size < 4) return
        val total = f[1].toIntOrNull() ?: return
        val index = f[2].toIntOrNull() ?: return
        val satFields = f.size - 4
        val signal = if (satFields % 4 == 1) f.last() else ""
        val key = talker + signal
        val list = if (index == 1) {
            ArrayList<RawSat>().also { gsvPending[key] = it }
        } else {
            gsvPending[key] ?: return
        }
        for (k in 0 until satFields / 4) {
            val base = 4 + k * 4
            val prn = f[base].toIntOrNull() ?: continue
            list.add(
                RawSat(
                    prn = prn,
                    elevation = f[base + 1].toIntOrNull() ?: -1,
                    azimuth = f[base + 2].toIntOrNull() ?: -1,
                    snr = f[base + 3].toIntOrNull() ?: 0
                )
            )
        }
        if (index >= total) {
            gsvPending.remove(key)
            gsvDone[key] = GsvGroup(System.currentTimeMillis(), talker, list)
        }
    }

    private fun systemOf(talker: String, prn: Int): Char = when (talker) {
        "GL" -> 'R'
        "GA" -> 'E'
        "GB", "BD" -> 'C'
        "GQ", "QZ" -> 'J'
        else -> when (prn) {
            in 33..64 -> 'S'
            in 65..96 -> 'R'
            else -> 'G'
        }
    }

    private fun displayPrn(system: Char, prn: Int): Int = when {
        system == 'R' && prn > 64 -> prn - 64
        system == 'S' -> prn + 87
        else -> prn
    }

    private fun isUsed(system: Char, prn: Int, now: Long): Boolean {
        fun inSet(s: Char): Boolean {
            val set = usedBySystem[s] ?: return false
            return now - set.at < SAT_MAX_AGE_MS && prn in set.prns
        }
        // SBAS uyduları GPS GSA cümlesinde listelenir.
        return inSet(system) || (system == 'S' && inSet('G'))
    }

    private fun num(s: String?): Double = s?.toDoubleOrNull() ?: Double.NaN

    /** ddmm.mmmm / dddmm.mmmm biçimini ondalık dereceye çevirir. */
    private fun coordinate(value: String, hemisphere: String): Double {
        val v = value.toDoubleOrNull() ?: return Double.NaN
        val deg = floor(v / 100.0)
        val result = deg + (v - deg * 100.0) / 60.0
        return if (hemisphere == "S" || hemisphere == "W") -result else result
    }

    private fun formatUtc(t: String): String =
        if (t.length >= 6) "${t.substring(0, 2)}:${t.substring(2, 4)}:${t.substring(4, 6)}" else ""

    private fun checksumOk(body: String, given: String): Boolean {
        val expected = given.trim().take(2).toIntOrNull(16) ?: return false
        var sum = 0
        for (c in body) sum = sum xor c.code
        return sum == expected
    }

    private companion object {
        const val GST_MAX_AGE_MS = 3000L
        const val SAT_MAX_AGE_MS = 10000L
        const val SYSTEM_ORDER = "GRECJS"
        val SYSTEM_BY_ID = mapOf(1 to 'G', 2 to 'R', 3 to 'E', 4 to 'C', 5 to 'J')
    }
}
