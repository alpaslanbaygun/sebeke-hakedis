package com.sebekehakedis.mobil

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.sqrt

/**
 * Telefonun konum servisini konum kaynağı olarak kullanır. Sahada RTK alıcısı başka bir uygulamaya
 * (M-Survey RTK, alıcının kendi uygulaması vb.) bağlıysa o uygulama telefona "sahte konum" verir;
 * burada o konum okunur. Doğruluk, konumun bildirdiği yarıçaptan alınır.
 */
internal class TelefonKonumu(private val ctx: Context) : LocationListener {

    private val lm: LocationManager? = ctx.getSystemService(LocationManager::class.java)
    var active = false
        private set

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun start(): Boolean {
        val manager = lm ?: run {
            GnssHub.setPhone(LinkState.DISCONNECTED, ctx.getString(R.string.phone_unavailable))
            return false
        }
        if (!hasPermission()) return false
        if (active) return true
        try {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, INTERVAL_MS, 0f, this, Looper.getMainLooper())
        } catch (e: IllegalArgumentException) {
            GnssHub.setPhone(LinkState.DISCONNECTED, ctx.getString(R.string.phone_unavailable))
            return false
        } catch (e: SecurityException) {
            GnssHub.setPhone(LinkState.DISCONNECTED, ctx.getString(R.string.phone_no_permission))
            return false
        }
        active = true
        val enabled = try {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
        } catch (e: Exception) {
            true
        }
        GnssHub.setPhone(
            LinkState.CONNECTING,
            ctx.getString(if (enabled) R.string.phone_waiting else R.string.phone_disabled)
        )
        return true
    }

    fun stop() {
        if (active) {
            try {
                lm?.removeUpdates(this)
            } catch (e: SecurityException) {
            }
        }
        active = false
        GnssHub.setPhone(LinkState.DISCONNECTED, "")
    }

    override fun onLocationChanged(l: Location) {
        val mock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) l.isMock else @Suppress("DEPRECATION") l.isFromMockProvider
        val acc = if (l.hasAccuracy()) l.accuracy.toDouble() else Double.NaN
        val vacc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && l.hasVerticalAccuracy()) l.verticalAccuracyMeters.toDouble() else Double.NaN
        // Android konumu çözüm türü bildirmez; renk ve etiket bildirilen doğruluğa göre seçilir.
        val quality = when {
            acc.isNaN() -> 1
            acc <= FIXED_M -> 4
            acc <= FLOAT_M -> 5
            acc <= DGPS_M -> 2
            else -> 1
        }
        val msl = if (Build.VERSION.SDK_INT >= 34 && l.hasMslAltitude()) l.mslAltitudeMeters else Double.NaN
        val alt = when {
            !msl.isNaN() -> msl
            l.hasAltitude() -> l.altitude
            else -> Double.NaN
        }
        val sats = l.extras?.let { e -> if (e.containsKey("satellites")) e.getInt("satellites") else 0 } ?: 0
        val sigma = if (acc.isNaN()) Double.NaN else acc / sqrt(2.0)
        val fix = GnssFix(
            lat = l.latitude,
            lon = l.longitude,
            altMsl = alt,
            quality = quality,
            sats = sats,
            sigmaLat = sigma,
            sigmaLon = sigma,
            sigmaAlt = vacc,
            speedMs = if (l.hasSpeed()) l.speed.toDouble() else Double.NaN,
            bearing = if (l.hasBearing()) l.bearing.toDouble() else Double.NaN,
            utc = UTC.format(Date(l.time)),
            epoch = l.time,
            receivedAt = System.currentTimeMillis(),
            source = GnssFix.SOURCE_PHONE,
            mock = mock
        )
        if (GnssHub.phoneState != LinkState.CONNECTED) {
            GnssHub.setPhone(LinkState.CONNECTED, ctx.getString(if (mock) R.string.phone_mock else R.string.phone_gps))
        }
        GnssHub.postFix(fix)
    }

    override fun onProviderDisabled(provider: String) {
        GnssHub.setPhone(LinkState.CONNECTING, ctx.getString(R.string.phone_disabled))
    }

    override fun onProviderEnabled(provider: String) {
        GnssHub.setPhone(LinkState.CONNECTING, ctx.getString(R.string.phone_waiting))
    }

    // Android 10 ve öncesinde bu yöntem soyuttur; tanımlanmazsa çağrıldığında uygulama kapanır.
    @Deprecated("Android 10 ve öncesi için")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {
    }

    companion object {
        private const val INTERVAL_MS = 1000L
        private const val FIXED_M = 0.05
        private const val FLOAT_M = 0.5
        private const val DGPS_M = 5.0
        private val UTC = SimpleDateFormat("HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    }
}
