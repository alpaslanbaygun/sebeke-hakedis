package com.sebekehakedis.mobil

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** NMEA okuma: marka fark etmeksizin GGA, GST, GSA, GSV cümleleri. */
class NmeaTest {

    @Test
    fun parsesGga() {
        val parser = NmeaParser()
        assertTrue(parser.parse("\$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"))
        val fix = parser.fix
        assertEquals(48.1173, fix.lat, 1e-6)
        assertEquals(11.516667, fix.lon, 1e-6)
        assertEquals(1, fix.quality)
        assertEquals(8, fix.sats)
        assertEquals(545.4, fix.altMsl, 1e-9)
        assertEquals(592.3, fix.altEllipsoid, 1e-9)
        assertEquals("12:35:19", fix.utc)
        assertTrue(fix.hasPosition)
        assertEquals(GnssFix.SOURCE_RECEIVER, fix.source)
    }

    @Test
    fun rejectsBadChecksumAndEmptyFix() {
        val parser = NmeaParser()
        assertFalse(parser.parse("\$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*48"))
        assertTrue(parser.parse(withChecksum("GNGGA,123520.00,,,,,0,00,99.9,,M,,M,,")))
        assertFalse(parser.fix.hasPosition)
    }

    @Test
    fun parsesRtkFixedWithGstAndGsa() {
        val parser = NmeaParser()
        parser.parse(withChecksum("GNGST,101010.00,0.012,0.010,0.008,45.0,0.006,0.008,0.015"))
        parser.parse(withChecksum("GNGSA,A,3,02,05,07,13,15,20,29,30,,,,,1.4,0.8,1.1,1"))
        assertTrue(parser.parse(withChecksum("GNGGA,101010.00,3955.123456,N,03251.654321,E,4,18,0.8,925.123,M,36.500,M,1.0,0123")))
        val fix = parser.fix
        assertEquals(4, fix.quality)
        assertEquals(39.0 + 55.123456 / 60, fix.lat, 1e-10)
        assertEquals(32.0 + 51.654321 / 60, fix.lon, 1e-10)
        assertEquals(0.010, fix.hrms, 1e-9)
        assertEquals(0.015, fix.sigmaAlt, 1e-9)
        assertEquals(1.4, fix.pdop, 1e-9)
        assertEquals(1.0, fix.ageSec, 1e-9)
        assertEquals("0123", fix.stationId)
    }

    @Test
    fun mergesGsvAndMarksUsedSatellites() {
        val parser = NmeaParser()
        parser.parse(withChecksum("GPGSA,A,3,02,05,,,,,,,,,,,1.4,0.8,1.1,1"))
        parser.parse(withChecksum("GPGSV,2,1,05,02,45,120,42,05,30,200,38,07,10,300,25,40,35,180,36,1"))
        parser.parse(withChecksum("GPGSV,2,2,05,13,05,010,,1"))
        parser.parse(withChecksum("GLGSV,1,1,01,66,50,090,44,1"))
        val sats = parser.satellites()
        assertEquals(listOf("G2", "G5", "G7", "G13", "R2", "S127"), sats.map { it.label })
        assertEquals(listOf(true, true, false, false, false, false), sats.map { it.used })
    }

    private fun withChecksum(body: String): String {
        var sum = 0
        for (c in body) sum = sum xor c.code
        return "\$" + body + "*" + String.format("%02X", sum)
    }
}
