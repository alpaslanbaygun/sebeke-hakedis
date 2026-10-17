package com.sebekehakedis.mobil

import android.os.Handler
import android.os.Looper
import java.util.concurrent.CopyOnWriteArraySet

enum class LinkState { DISCONNECTED, CONNECTING, CONNECTED }

/**
 * Konum kaynakları (Bluetooth alıcı servisi, telefonun konumu) ile arayüz arasında paylaşılan durum.
 * Dinleyiciler ana iş parçacığında çağrılır.
 */
object GnssHub {

    interface Listener {
        fun onFix(fix: GnssFix) {}
        fun onStatusChanged() {}
        fun onLogLine() {}

        /** Kullanıcıya gösterilecek bildirim (ör. dosya hatası). */
        fun onNotice(text: String) {}
    }

    private const val MAX_LOG_LINES = 300

    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArraySet<Listener>()
    private val log = ArrayDeque<String>()

    @Volatile var serviceRunning = false

    @Volatile var fix = GnssFix()
        private set

    @Volatile var sats: List<SatInfo> = emptyList()

    @Volatile var btState = LinkState.DISCONNECTED
        private set
    @Volatile var btMessage = ""
        private set

    @Volatile var ntripState = LinkState.DISCONNECTED
        private set
    @Volatile var ntripMessage = ""
        private set
    @Volatile var ntripBytes = 0L

    /** Telefonun kendi konumu (ya da başka uygulamanın verdiği "sahte konum"). */
    @Volatile var phoneState = LinkState.DISCONNECTED
        private set
    @Volatile var phoneMessage = ""
        private set

    fun addListener(l: Listener) = listeners.add(l)
    fun removeListener(l: Listener) = listeners.remove(l)

    fun postFix(f: GnssFix) {
        fix = f
        main.post { listeners.forEach { it.onFix(f) } }
    }

    /** Kaynak değişince eski konum hemen geçersiz sayılsın. */
    fun clearFix() {
        fix = GnssFix()
        sats = emptyList()
        main.post { listeners.forEach { it.onFix(fix) } }
    }

    fun setBt(state: LinkState, message: String) {
        btState = state
        btMessage = message
        notifyStatus()
    }

    fun setNtrip(state: LinkState, message: String) {
        ntripState = state
        ntripMessage = message
        notifyStatus()
    }

    fun setPhone(state: LinkState, message: String) {
        phoneState = state
        phoneMessage = message
        notifyStatus()
    }

    fun postNotice(text: String) {
        main.post { listeners.forEach { it.onNotice(text) } }
    }

    fun log(line: String) {
        synchronized(log) {
            log.addLast(line)
            while (log.size > MAX_LOG_LINES) log.removeFirst()
        }
        main.post { listeners.forEach { it.onLogLine() } }
    }

    fun logSnapshot(): List<String> = synchronized(log) { log.toList() }

    fun notifyStatus() {
        main.post { listeners.forEach { it.onStatusChanged() } }
    }
}
