package com.sebekehakedis.mobil

import android.content.Context
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

/** Telefona bağlı ayarlar (alıcı, NTRIP, harita altlığı). Projeye ait ayarlar proje dosyasındadır. */
class Prefs(ctx: Context) {
    private val sp = ctx.applicationContext.getSharedPreferences("sebekehakedis", Context.MODE_PRIVATE)

    var deviceAddress by string("device_address")
    var deviceName by string("device_name")

    var ntripHost by string("ntrip_host")
    var ntripPort by int("ntrip_port", 2101)
    var ntripMount by string("ntrip_mount")
    var ntripUser by string("ntrip_user")
    var ntripPass by string("ntrip_pass")
    var ntripSendGga by bool("ntrip_send_gga", true)
    var ntripAuto by bool("ntrip_auto", false)

    /** Harita altlığı (TileServer.PROVIDERS kimliği) ve kullanıcının kendi API anahtarları. */
    var basemap by string("basemap", "osm")
    var googleTilesKey by string("google_tiles_key")
    var yandexTilesKey by string("yandex_tiles_key")

    /**
     * Spectra / Ashtech alıcılarda NMEA çıkışını bağlanınca $PASHS komutlarıyla açar. Başka marka
     * alıcılar (CHCNAV, Kolida, Trimble…) kendi uygulamalarında ayarlandığı için varsayılan kapalıdır.
     */
    var autoConfig by bool("auto_config", false)
    var portLetter by string("port_letter", "C")

    /** Konum kaynağı: "bt" Bluetooth GNSS alıcısı, "phone" telefonun konumu. */
    var source by string("source", "bt")

    /** En son açılan proje (açılışta ona dönülür). */
    var lastProject by string("last_project")

    private fun string(key: String, def: String = "") = object : ReadWriteProperty<Any?, String> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getString(key, def) ?: def
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: String) =
            sp.edit().putString(key, value).apply()
    }

    private fun int(key: String, def: Int) = object : ReadWriteProperty<Any?, Int> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getInt(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Int) =
            sp.edit().putInt(key, value).apply()
    }

    private fun bool(key: String, def: Boolean) = object : ReadWriteProperty<Any?, Boolean> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getBoolean(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Boolean) =
            sp.edit().putBoolean(key, value).apply()
    }
}
