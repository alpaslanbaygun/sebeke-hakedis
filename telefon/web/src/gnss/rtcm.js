// RTCM 3.x çerçeve ayrıştırıcı (0xD3 önsöz, 10 bit uzunluk, CRC-24Q) — mesaj türü istatistiği ve düzeltme yaşı için.
const CRC24Q = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 16;
    for (let j = 0; j < 8; j++) { c <<= 1; if (c & 0x1000000) c ^= 0x1864cfb; }
    t[i] = c & 0xffffff;
  }
  return t;
})();
export function crc24q(buf, start, len) {
  let crc = 0;
  for (let i = 0; i < len; i++) crc = ((crc << 8) & 0xffffff) ^ CRC24Q[((crc >> 16) ^ buf[start + i]) & 0xff];
  return crc;
}
export const RTCM_NAMES = {
  1005: 'Referans istasyonu ARP', 1006: 'Referans ARP + anten yüksekliği', 1007: 'Anten tanımı', 1008: 'Anten + seri no', 1033: 'Alıcı/anten tanımı',
  1004: 'GPS L1/L2 gözlem', 1012: 'GLONASS L1/L2 gözlem', 1074: 'GPS MSM4', 1075: 'GPS MSM5', 1077: 'GPS MSM7', 1084: 'GLONASS MSM4', 1087: 'GLONASS MSM7',
  1094: 'Galileo MSM4', 1097: 'Galileo MSM7', 1124: 'BeiDou MSM4', 1127: 'BeiDou MSM7', 1230: 'GLONASS kod-faz sapması', 1019: 'GPS efemeris', 1020: 'GLONASS efemeris'
};
export class RtcmStream {
  constructor(onMsg) { this.buf = new Uint8Array(0); this.on = onMsg; this.stats = { frames: 0, crcErr: 0, bytes: 0, types: {} }; }
  push(chunk) {
    const b = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    this.stats.bytes += b.length;
    const nb = new Uint8Array(this.buf.length + b.length); nb.set(this.buf); nb.set(b, this.buf.length); this.buf = nb;
    let i = 0;
    while (i + 6 <= this.buf.length) {
      if (this.buf[i] !== 0xd3) { i++; continue; }
      const len = ((this.buf[i + 1] & 0x03) << 8) | this.buf[i + 2];
      if (i + 6 + len > this.buf.length) break;
      const crc = (this.buf[i + 3 + len] << 16) | (this.buf[i + 4 + len] << 8) | this.buf[i + 5 + len];
      if (crc24q(this.buf, i, 3 + len) !== crc) { this.stats.crcErr++; i++; continue; }
      const type = len >= 2 ? (this.buf[i + 3] << 4) | (this.buf[i + 4] >> 4) : 0;
      this.stats.frames++; this.stats.types[type] = (this.stats.types[type] || 0) + 1;
      const msg = { type, len, name: RTCM_NAMES[type] || '' };
      if (type === 1005 || type === 1006) Object.assign(msg, decode1005(this.buf.subarray(i + 3, i + 3 + len)));
      if (this.on) this.on(msg);
      i += 6 + len;
    }
    this.buf = this.buf.slice(i);
  }
}
// Bit okuyucu
function bits(buf, pos, n) { let v = 0; for (let k = 0; k < n; k++) { const b = pos + k; v = v * 2 + ((buf[b >> 3] >> (7 - (b & 7))) & 1); } return v; }
function sbits(buf, pos, n) { let v = bits(buf, pos, n); if (v >= 2 ** (n - 1)) v -= 2 ** n; return v; }
function decode1005(p) {
  const station = bits(p, 12, 12);
  const X = sbits(p, 34, 38) * 1e-4, Y = sbits(p, 74, 38) * 1e-4, Z = sbits(p, 114, 38) * 1e-4;
  return { station, X, Y, Z };
}
export function buildFrame(payload) {
  const len = payload.length;
  const f = new Uint8Array(6 + len);
  f[0] = 0xd3; f[1] = (len >> 8) & 0x03; f[2] = len & 0xff; f.set(payload, 3);
  const c = crc24q(f, 0, 3 + len);
  f[3 + len] = (c >> 16) & 0xff; f[4 + len] = (c >> 8) & 0xff; f[5 + len] = c & 0xff;
  return f;
}
