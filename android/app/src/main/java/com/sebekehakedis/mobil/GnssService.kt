package com.sebekehakedis.mobil

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import kotlin.concurrent.thread

/**
 * GNSS alıcısıyla Bluetooth (SPP) bağlantısını ve NTRIP düzeltme akışını ekran kapalıyken de
 * sürdüren ön plan servisi. Alıcı markası fark etmez: NMEA (GGA, GST, GSA, RMC) okunur.
 */
class GnssService : Service() {

    private lateinit var prefs: Prefs
    private val parser = NmeaParser()
    private val handler = Handler(Looper.getMainLooper())

    @Volatile private var link: BtLink? = null
    @Volatile private var ntrip: NtripClient? = null
    @Volatile private var lastGga: String? = null
    @Volatile private var nmeaConfigured = false
    private var notifiedQuality = -1
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        GnssHub.serviceRunning = true
        val channel = NotificationChannel(
            CHANNEL_ID, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        goForeground()
        when (intent?.action) {
            ACTION_CONNECT -> intent.getStringExtra(EXTRA_ADDRESS)?.let { connect(it) }
            ACTION_STOP -> stopAll()
            ACTION_NTRIP_START -> startNtrip()
            ACTION_NTRIP_STOP -> stopNtrip()
        }
        if (link == null && ntrip == null) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        stopAll()
        handler.removeCallbacksAndMessages(null)
        GnssHub.serviceRunning = false
        super.onDestroy()
    }

    // ---- Bluetooth ----

    private fun connect(address: String) {
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !BluetoothAdapter.checkBluetoothAddress(address)) {
            GnssHub.setBt(LinkState.DISCONNECTED, getString(R.string.bt_unavailable))
            return
        }
        link?.close()
        acquireWakeLock()
        link = BtLink(adapter.getRemoteDevice(address)).also { it.start() }
    }

    private fun stopAll() {
        stopNtrip()
        link?.close()
        link = null
        releaseWakeLock()
        GnssHub.sats = emptyList()
        GnssHub.setBt(LinkState.DISCONNECTED, "")
    }

    private fun onLinkUp(l: BtLink) {
        nmeaConfigured = false
        if (prefs.ntripAuto) handler.post { if (link === l && ntrip == null) startNtrip() }
        if (!prefs.autoConfig) return
        // Spectra / Ashtech: alıcı hangi porttan konuştuğumuzu bildirirse onu, bildirmezse ayardaki portu kullan.
        sendLine(l, "\$PASHQ,PRT")
        handler.postDelayed({
            if (link === l && !nmeaConfigured) configureNmea(l, prefs.portLetter)
        }, PORT_QUERY_TIMEOUT_MS)
    }

    private fun configureNmea(l: BtLink, port: String) {
        nmeaConfigured = true
        thread(name = "gnss-config") {
            for ((message, period) in NMEA_MESSAGES) {
                if (!sendLine(l, "\$PASHS,NME,$message,$port,ON,$period")) break
                SystemClock.sleep(150)
            }
        }
    }

    private fun sendLine(l: BtLink, line: String): Boolean {
        val bytes = (line + "\r\n").toByteArray(Charsets.US_ASCII)
        val ok = l.write(bytes, bytes.size)
        if (ok) GnssHub.log("> $line")
        return ok
    }

    private fun handleLine(l: BtLink, line: String) {
        if (!line.startsWith('$')) return
        GnssHub.log(line)
        if (line.startsWith("\$PASHR,")) {
            val f = line.substringBefore('*').split(',')
            if (f.getOrNull(1) == "PRT") {
                val port = f.getOrNull(2).orEmpty()
                if (port.length == 1 && !nmeaConfigured && prefs.autoConfig) configureNmea(l, port)
            }
            return
        }
        if (!parser.parse(line)) return
        val fix = parser.fix
        lastGga = line
        GnssHub.sats = parser.satellites()
        // Kaynak "telefon" seçiliyse alıcının konumu arayüze verilmez (bağlantı açık kalabilir).
        if (prefs.source == "bt") GnssHub.postFix(fix)
        if (fix.quality != notifiedQuality) {
            notifiedQuality = fix.quality
            updateNotification()
        }
    }

    private inner class BtLink(private val device: BluetoothDevice) : Thread("gnss-bt") {
        @Volatile private var active = true
        @Volatile private var socket: BluetoothSocket? = null
        @Volatile private var out: OutputStream? = null
        private val writeLock = Any()

        fun write(data: ByteArray, len: Int): Boolean {
            val o = out ?: return false
            return try {
                synchronized(writeLock) {
                    o.write(data, 0, len)
                    o.flush()
                }
                true
            } catch (e: IOException) {
                false
            }
        }

        fun close() {
            active = false
            closeSocket()
            interrupt()
        }

        @SuppressLint("MissingPermission")
        override fun run() {
            val name = try {
                device.name
            } catch (e: SecurityException) {
                null
            } ?: device.address

            while (active) {
                GnssHub.setBt(LinkState.CONNECTING, getString(R.string.bt_connecting, name))
                try {
                    val s = open()
                    out = s.outputStream
                    GnssHub.setBt(LinkState.CONNECTED, getString(R.string.bt_connected, name))
                    updateNotification()
                    onLinkUp(this)
                    readLoop(s.inputStream)
                } catch (e: SecurityException) {
                    active = false
                    GnssHub.setBt(LinkState.DISCONNECTED, getString(R.string.bt_no_permission))
                } catch (e: IOException) {
                    if (active) {
                        val reason = e.message ?: e.javaClass.simpleName
                        GnssHub.setBt(LinkState.CONNECTING, getString(R.string.bt_retry, reason))
                    }
                } finally {
                    out = null
                    closeSocket()
                }
                if (active) {
                    try {
                        sleep(RECONNECT_DELAY_MS)
                    } catch (e: InterruptedException) {
                    }
                }
            }
            if (link == null) GnssHub.setBt(LinkState.DISCONNECTED, "")
        }

        @SuppressLint("MissingPermission")
        private fun open(): BluetoothSocket {
            val secure = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket = secure
            try {
                secure.connect()
                return secure
            } catch (e: IOException) {
                closeSocket()
                if (!active) throw e
            }
            val insecure = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
            socket = insecure
            insecure.connect()
            return insecure
        }

        private fun readLoop(input: InputStream) {
            val buf = ByteArray(4096)
            val sb = StringBuilder()
            while (active) {
                val n = input.read(buf)
                if (n < 0) throw IOException(getString(R.string.bt_closed))
                for (i in 0 until n) {
                    val c = buf[i].toInt() and 0xFF
                    when {
                        c == '\n'.code -> {
                            if (sb.isNotEmpty()) handleLine(this, sb.toString())
                            sb.setLength(0)
                        }
                        c == '\r'.code -> Unit
                        c == '$'.code -> {
                            sb.setLength(0)
                            sb.append('$')
                        }
                        // Araya karışan ikili veriyi (RTCM vb.) at.
                        c < 32 || c > 126 -> sb.setLength(0)
                        sb.length < MAX_LINE -> sb.append(c.toChar())
                    }
                }
            }
        }

        private fun closeSocket() {
            try {
                socket?.close()
            } catch (e: IOException) {
            }
            socket = null
        }
    }

    // ---- NTRIP ----

    private fun startNtrip() {
        stopNtrip()
        val cfg = NtripConfig(
            host = prefs.ntripHost.trim(),
            port = prefs.ntripPort,
            mount = prefs.ntripMount.trim(),
            user = prefs.ntripUser.trim(),
            pass = prefs.ntripPass,
            sendGga = prefs.ntripSendGga
        )
        if (cfg.host.isEmpty() || cfg.mount.isEmpty()) {
            GnssHub.setNtrip(LinkState.DISCONNECTED, getString(R.string.ntrip_missing))
            return
        }
        GnssHub.ntripBytes = 0
        ntrip = NtripClient(
            applicationContext,
            cfg,
            gga = { if (parser.fix.hasPosition && parser.fix.isLive()) lastGga else null },
            onData = { buf, n ->
                if (link?.write(buf, n) == true) GnssHub.ntripBytes += n
            }
        ).also { it.start() }
    }

    private fun stopNtrip() {
        val client = ntrip ?: return
        ntrip = null
        client.stop()
        GnssHub.setNtrip(LinkState.DISCONNECTED, "")
    }

    // ---- Bildirim ve uyanık kalma ----

    private fun goForeground() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification() {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): android.app.Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, GnssService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        val fix = GnssHub.fix
        val text = if (GnssHub.btState == LinkState.CONNECTED && fix.isLive()) {
            getString(R.string.notif_fix, getString(FixInfo.label(fix.quality)), fix.sats)
        } else {
            GnssHub.btMessage.ifEmpty { getString(R.string.bt_idle) }
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_gnss)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, getString(R.string.notif_stop), stop)
            .build()
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            wakeLock = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sebekehakedis:link")
        }
        wakeLock?.let { if (!it.isHeld) it.acquire() }
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
    }

    companion object {
        const val ACTION_CONNECT = "com.sebekehakedis.mobil.CONNECT"
        const val ACTION_STOP = "com.sebekehakedis.mobil.STOP"
        const val ACTION_NTRIP_START = "com.sebekehakedis.mobil.NTRIP_START"
        const val ACTION_NTRIP_STOP = "com.sebekehakedis.mobil.NTRIP_STOP"
        const val EXTRA_ADDRESS = "address"

        private const val CHANNEL_ID = "gnss"
        private const val NOTIFICATION_ID = 1
        private const val RECONNECT_DELAY_MS = 3000L
        private const val PORT_QUERY_TIMEOUT_MS = 2500L
        private const val MAX_LINE = 512
        // Cümle adı ve saniye cinsinden çıkış aralığı (yalnız Spectra/Ashtech otomatik ayarında).
        private val NMEA_MESSAGES = listOf("GGA" to 1, "RMC" to 1, "GST" to 1, "GSA" to 1, "GSV" to 2)
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        /** Servisi ön planda başlatır; yalnızca Bluetooth izni verildikten sonra çağrılmalı. */
        fun start(ctx: Context, address: String) {
            val intent = Intent(ctx, GnssService::class.java)
                .setAction(ACTION_CONNECT)
                .putExtra(EXTRA_ADDRESS, address)
            ContextCompat.startForegroundService(ctx, intent)
        }

        /** Çalışan servise komut yollar; servis çalışmıyorsa hiçbir şey yapmaz. */
        fun command(ctx: Context, action: String): Boolean {
            if (!GnssHub.serviceRunning) return false
            ctx.startService(Intent(ctx, GnssService::class.java).setAction(action))
            return true
        }
    }
}
