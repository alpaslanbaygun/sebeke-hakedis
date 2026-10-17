package com.sebekehakedis.mobil

import kotlin.math.hypot

/** Alıcıdan gelen NMEA cümlelerinden (ya da telefonun konum servisinden) derlenen son konum durumu. */
data class GnssFix(
    val lat: Double = Double.NaN,
    val lon: Double = Double.NaN,
    val altMsl: Double = Double.NaN,
    val geoidSep: Double = Double.NaN,
    val quality: Int = 0,
    val sats: Int = 0,
    val hdop: Double = Double.NaN,
    val pdop: Double = Double.NaN,
    val vdop: Double = Double.NaN,
    val ageSec: Double = Double.NaN,
    val stationId: String = "",
    val sigmaLat: Double = Double.NaN,
    val sigmaLon: Double = Double.NaN,
    val sigmaAlt: Double = Double.NaN,
    val speedMs: Double = Double.NaN,
    val bearing: Double = Double.NaN,
    val utc: String = "",
    val epoch: Long = 0,
    val receivedAt: Long = 0,
    /** Konumun kaynağı: [SOURCE_RECEIVER] Bluetooth alıcı, [SOURCE_PHONE] telefonun konum servisi. */
    val source: Int = SOURCE_RECEIVER,
    /** Telefon konumu başka bir uygulamadan (sahte konum sağlayıcısı) geliyorsa true. */
    val mock: Boolean = false
) {
    val hasPosition: Boolean
        get() = quality > 0 && !lat.isNaN() && !lon.isNaN()

    val altEllipsoid: Double
        get() = if (geoidSep.isNaN()) altMsl else altMsl + geoidSep

    val hrms: Double
        get() = if (sigmaLat.isNaN() || sigmaLon.isNaN()) Double.NaN else hypot(sigmaLat, sigmaLon)

    fun isLive(now: Long = System.currentTimeMillis()): Boolean =
        receivedAt != 0L && now - receivedAt < STALE_MS

    companion object {
        const val STALE_MS = 5000L
        const val SOURCE_RECEIVER = 0
        const val SOURCE_PHONE = 1
    }
}

/** GSV'den gelen uydu; [system] G/R/E/C/J/S, [elevation] ve [azimuth] bilinmiyorsa -1. */
data class SatInfo(
    val system: Char,
    val prn: Int,
    val elevation: Int,
    val azimuth: Int,
    val snr: Int,
    val used: Boolean
) {
    val label: String get() = "$system$prn"
}

/** GGA kalite alanının (0-9) etiketi, rengi ve varsayılan doğruluğu. */
object FixInfo {
    fun label(quality: Int): Int = when (quality) {
        0 -> R.string.fix_none
        1 -> R.string.fix_autonomous
        2 -> R.string.fix_dgps
        3 -> R.string.fix_pps
        4 -> R.string.fix_rtk_fixed
        5 -> R.string.fix_rtk_float
        6 -> R.string.fix_estimated
        9 -> R.string.fix_sbas
        else -> R.string.fix_other
    }

    fun color(quality: Int): Int = when (quality) {
        4 -> 0xFF2E7D32.toInt()
        5 -> 0xFFEF6C00.toInt()
        2, 9 -> 0xFF1565C0.toInt()
        1, 3 -> 0xFF546E7A.toInt()
        else -> 0xFFC62828.toInt()
    }

    /** GST gelmiyorsa mock konum için kullanılan kaba yatay doğruluk (m). */
    fun defaultAccuracy(quality: Int): Float = when (quality) {
        4 -> 0.02f
        5 -> 0.5f
        2, 9 -> 1.0f
        else -> 3.0f
    }

    /** Küçük değer daha iyi çözüm. */
    fun rank(quality: Int): Int = when (quality) {
        4 -> 0
        5 -> 1
        2, 9 -> 2
        1, 3 -> 3
        else -> 4
    }
}
