package tr.voltedas.saha;

import java.util.Map;
import java.util.TreeMap;

/**
 * RTCM 3.x çerçeve ayrıştırıcı: 0xD3 önsöz, 10 bit uzunluk, CRC-24Q. İstatistik (mesaj türü, sayısı) ve referans
 * istasyonunun konumu (1005 / 1006: istasyon kimliği + yer merkezli X, Y, Z). Android bağımsız.
 */
public final class Rtcm3Parser {
    private static final int[] CRC = new int[256];
    static {
        for (int i = 0; i < 256; i++) {
            int c = i << 16;
            for (int j = 0; j < 8; j++) { c <<= 1; if ((c & 0x1000000) != 0) c ^= 0x1864CFB; }
            CRC[i] = c & 0xFFFFFF;
        }
    }
    public static int crc24q(byte[] b, int off, int len) {
        int crc = 0;
        for (int i = 0; i < len; i++) crc = ((crc << 8) & 0xFFFFFF) ^ CRC[((crc >> 16) ^ (b[off + i] & 0xFF)) & 0xFF];
        return crc;
    }

    private byte[] buf = new byte[8192];
    private int n = 0;
    public long frames = 0, crcErrors = 0, bytes = 0, lastFrameMs = 0;
    public final Map<Integer, Integer> types = new TreeMap<>();
    /** Son 1005 / 1006 mesajı: istasyon kimliği (-1: gelmedi) ve ARP'nin yer merkezli koordinatları (m). */
    public int stationId = -1; public double stationX, stationY, stationZ; public long stationMs = 0;

    public synchronized void push(byte[] data, int off, int len) {
        bytes += len;
        if (n + len > buf.length) { byte[] nb = new byte[Math.max(buf.length * 2, n + len)]; System.arraycopy(buf, 0, nb, 0, n); buf = nb; }
        System.arraycopy(data, off, buf, n, len); n += len;
        int i = 0;
        while (i + 6 <= n) {
            if ((buf[i] & 0xFF) != 0xD3) { i++; continue; }
            int L = ((buf[i + 1] & 0x03) << 8) | (buf[i + 2] & 0xFF);
            if (i + 6 + L > n) break;
            int crc = ((buf[i + 3 + L] & 0xFF) << 16) | ((buf[i + 4 + L] & 0xFF) << 8) | (buf[i + 5 + L] & 0xFF);
            if (crc24q(buf, i, 3 + L) != crc) { crcErrors++; i++; continue; }
            int type = L >= 2 ? (((buf[i + 3] & 0xFF) << 4) | ((buf[i + 4] & 0xFF) >> 4)) : 0;
            frames++; lastFrameMs = System.currentTimeMillis();
            Integer c = types.get(type); types.put(type, c == null ? 1 : c + 1);
            if ((type == 1005 || type == 1006) && L >= 19) station(buf, i + 3);
            i += 6 + L;
        }
        if (i > 0) { System.arraycopy(buf, i, buf, 0, n - i); n -= i; }
        if (n > 65536) n = 0; // bozuk akış koruması
    }

    /** 1005 / 1006: bit 12 istasyon kimliği (12 bit), 34 / 74 / 114 ECEF X / Y / Z (38 bit, işaretli, 0,0001 m). */
    private void station(byte[] b, int p) {
        stationId = (int) bits(b, p, 12, 12);
        stationX = sbits(b, p, 34, 38) * 1e-4;
        stationY = sbits(b, p, 74, 38) * 1e-4;
        stationZ = sbits(b, p, 114, 38) * 1e-4;
        stationMs = System.currentTimeMillis();
    }
    static long bits(byte[] b, int p, int pos, int len) {
        long v = 0;
        for (int k = 0; k < len; k++) { int q = pos + k; v = (v << 1) | ((b[p + (q >> 3)] >> (7 - (q & 7))) & 1); }
        return v;
    }
    static long sbits(byte[] b, int p, int pos, int len) {
        long v = bits(b, p, pos, len);
        if ((v & (1L << (len - 1))) != 0) v -= (1L << len);
        return v;
    }
    public synchronized Map<Integer, Integer> snapshot() { return new TreeMap<>(types); }
}
