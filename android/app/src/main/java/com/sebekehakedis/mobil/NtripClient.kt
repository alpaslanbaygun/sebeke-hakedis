package com.sebekehakedis.mobil

import android.content.Context
import android.os.SystemClock
import android.util.Base64
import java.io.BufferedInputStream
import java.io.IOException
import java.io.InputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import kotlin.concurrent.thread

data class NtripConfig(
    val host: String,
    val port: Int,
    val mount: String,
    val user: String,
    val pass: String,
    val sendGga: Boolean
)

/**
 * NTRIP v1 istemcisi. Caster'dan gelen RTCM baytlarını [onData] ile iletir,
 * [gga] geçerli bir cümle verdiği sürece 10 saniyede bir sunucuya konum yollar.
 */
class NtripClient(
    private val ctx: Context,
    private val cfg: NtripConfig,
    private val gga: () -> String?,
    private val onData: (ByteArray, Int) -> Unit
) {
    private class FatalException(message: String) : IOException(message)

    @Volatile private var running = false
    @Volatile private var socket: Socket? = null
    private var worker: Thread? = null

    fun start() {
        running = true
        worker = thread(name = "ntrip") { loop() }
    }

    fun stop() {
        running = false
        closeSocket()
        worker?.interrupt()
    }

    private fun loop() {
        while (running) {
            GnssHub.setNtrip(LinkState.CONNECTING, ctx.getString(R.string.ntrip_connecting, cfg.host))
            try {
                session()
            } catch (e: FatalException) {
                running = false
                GnssHub.setNtrip(LinkState.DISCONNECTED, e.message.orEmpty())
            } catch (e: IOException) {
                if (running) {
                    val reason = e.message ?: e.javaClass.simpleName
                    GnssHub.setNtrip(LinkState.CONNECTING, ctx.getString(R.string.ntrip_retry, reason))
                }
            } finally {
                closeSocket()
            }
            if (running) {
                try {
                    Thread.sleep(RETRY_DELAY_MS)
                } catch (e: InterruptedException) {
                }
            }
        }
    }

    private fun session() {
        val s = Socket()
        socket = s
        s.connect(InetSocketAddress(cfg.host, cfg.port), CONNECT_TIMEOUT_MS)
        s.soTimeout = HEADER_TIMEOUT_MS

        val mount = cfg.mount.trimStart('/')
        val request = StringBuilder()
            .append("GET /").append(mount).append(" HTTP/1.0\r\n")
            .append("User-Agent: ").append(USER_AGENT).append("\r\n")
            .append("Accept: */*\r\n")
        if (cfg.user.isNotEmpty()) {
            val token = Base64.encodeToString("${cfg.user}:${cfg.pass}".toByteArray(), Base64.NO_WRAP)
            request.append("Authorization: Basic ").append(token).append("\r\n")
        }
        request.append("Connection: close\r\n\r\n")

        val out = s.getOutputStream()
        out.write(request.toString().toByteArray(Charsets.ISO_8859_1))
        out.flush()

        var input: InputStream = BufferedInputStream(s.getInputStream())
        val status = readLine(input) ?: throw IOException(ctx.getString(R.string.ntrip_no_response))
        when {
            status.startsWith("SOURCETABLE") ->
                throw FatalException(ctx.getString(R.string.ntrip_no_mount, mount))
            status.contains(" 401") ->
                throw FatalException(ctx.getString(R.string.ntrip_unauthorized))
            !status.contains("200") ->
                throw FatalException(ctx.getString(R.string.ntrip_error, status))
        }
        if (status.startsWith("HTTP/")) {
            var chunked = false
            while (true) {
                val header = readLine(input) ?: break
                if (header.isEmpty()) break
                val lower = header.lowercase()
                if (lower.startsWith("transfer-encoding") && lower.contains("chunked")) chunked = true
            }
            if (chunked) input = ChunkedInputStream(input)
        }

        GnssHub.setNtrip(LinkState.CONNECTED, ctx.getString(R.string.ntrip_connected, mount))
        s.soTimeout = READ_TIMEOUT_MS

        val buf = ByteArray(4096)
        var lastGga = 0L
        var lastData = SystemClock.elapsedRealtime()
        while (running) {
            val now = SystemClock.elapsedRealtime()
            if (cfg.sendGga && (lastGga == 0L || now - lastGga >= GGA_INTERVAL_MS)) {
                gga()?.let {
                    out.write((it + "\r\n").toByteArray(Charsets.US_ASCII))
                    out.flush()
                    lastGga = now
                }
            }
            val n = try {
                input.read(buf)
            } catch (e: SocketTimeoutException) {
                if (now - lastData > STALL_TIMEOUT_MS) throw IOException(ctx.getString(R.string.ntrip_stalled))
                continue
            }
            if (n < 0) throw IOException(ctx.getString(R.string.ntrip_closed))
            lastData = SystemClock.elapsedRealtime()
            onData(buf, n)
        }
    }

    private fun closeSocket() {
        try {
            socket?.close()
        } catch (e: IOException) {
        }
        socket = null
    }

    /** HTTP chunked gövdesini çözer (NTRIP v2 yanıtı veren caster'lar için). */
    private class ChunkedInputStream(private val src: InputStream) : InputStream() {
        private var remaining = 0
        private var eof = false

        override fun read(): Int {
            val one = ByteArray(1)
            return if (read(one, 0, 1) < 0) -1 else one[0].toInt() and 0xFF
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (eof) return -1
            if (remaining == 0) {
                var line = readLine(src) ?: return -1
                if (line.isEmpty()) line = readLine(src) ?: return -1
                remaining = line.substringBefore(';').trim().toIntOrNull(16)
                    ?: throw IOException("chunk")
                if (remaining == 0) {
                    eof = true
                    return -1
                }
            }
            val n = src.read(b, off, minOf(len, remaining))
            if (n < 0) return -1
            remaining -= n
            return n
        }
    }

    companion object {
        private const val USER_AGENT = "NTRIP SebekeHakedis/1.0"
        private const val CONNECT_TIMEOUT_MS = 10000
        private const val HEADER_TIMEOUT_MS = 15000
        private const val READ_TIMEOUT_MS = 5000
        private const val STALL_TIMEOUT_MS = 60000L
        private const val GGA_INTERVAL_MS = 10000L
        private const val RETRY_DELAY_MS = 5000L
        private const val MAX_LINE = 4096

        /** Caster kaynak tablosundaki mountpoint adlarını döndürür. */
        fun fetchMountpoints(host: String, port: Int): List<String> {
            Socket().use { s ->
                s.connect(InetSocketAddress(host, port), CONNECT_TIMEOUT_MS)
                s.soTimeout = HEADER_TIMEOUT_MS
                val out = s.getOutputStream()
                out.write("GET / HTTP/1.0\r\nUser-Agent: $USER_AGENT\r\nAccept: */*\r\n\r\n".toByteArray(Charsets.ISO_8859_1))
                out.flush()
                val input = BufferedInputStream(s.getInputStream())
                val mounts = ArrayList<String>()
                while (true) {
                    val line = readLine(input) ?: break
                    if (line.startsWith("ENDSOURCETABLE")) break
                    if (line.startsWith("STR;")) {
                        line.split(';').getOrNull(1)?.takeIf { it.isNotEmpty() }?.let { mounts.add(it) }
                    }
                }
                return mounts
            }
        }

        private fun readLine(input: InputStream): String? {
            val sb = StringBuilder()
            while (true) {
                val c = input.read()
                if (c < 0) return if (sb.isEmpty()) null else sb.toString()
                if (c == '\n'.code) return sb.toString()
                if (c != '\r'.code && sb.length < MAX_LINE) sb.append(c.toChar())
            }
        }
    }
}
