// NMEA 0183 ayrıştırıcı: GGA, RMC, GST, GSA, GSV, HDT, VTG, ZDA (+ tüm talker'lar: GP/GN/GL/GA/GB/BD/GQ).
// Akış tamponlu (satır bölme) ve checksum doğrulamalı.

export const FIX_TYPES = {
  0: 'NONE', 1: 'SINGLE', 2: 'DGPS', 3: 'PPS', 4: 'FIX', 5: 'FLOAT', 6: 'DR', 7: 'MANUAL', 8: 'SIM', 9: 'SBAS'
};
export const FIX_LABEL = { NONE: 'FIX YOK', SINGLE: 'SINGLE', DGPS: 'DGPS', FIX: 'RTK FIX', FLOAT: 'RTK FLOAT', PHONE: 'TELEFON GPS', SIM: 'SİMÜLATÖR', SBAS: 'SBAS', PPS: 'PPS', DR: 'DR', MANUAL: 'MANUEL' };

export function checksumOk(line) {
  const star = line.lastIndexOf('*');
  if (line[0] !== '$' && line[0] !== '!') return false;
  if (star < 0) return true; // checksumsız cümleye izin (bazı alıcılar)
  let c = 0;
  for (let i = 1; i < star; i++) c ^= line.charCodeAt(i);
  return c === parseInt(line.slice(star + 1, star + 3), 16);
}
export function withChecksum(body) {
  let c = 0; for (let i = 0; i < body.length; i++) c ^= body.charCodeAt(i);
  return '$' + body + '*' + c.toString(16).toUpperCase().padStart(2, '0');
}
function ll(v, hemi, isLat) {
  if (!v) return null;
  const dd = isLat ? 2 : 3;
  const deg = parseInt(v.slice(0, dd), 10), min = parseFloat(v.slice(dd));
  let x = deg + min / 60;
  if (hemi === 'S' || hemi === 'W') x = -x;
  return x;
}
const f = (s) => (s === undefined || s === '' ? null : parseFloat(s));
const i = (s) => (s === undefined || s === '' ? null : parseInt(s, 10));
function hms(s) { if (!s) return null; return { h: +s.slice(0, 2), m: +s.slice(2, 4), s: parseFloat(s.slice(4)) }; }

export function parseSentence(line) {
  line = line.trim();
  if (!line || (line[0] !== '$')) return null;
  if (!checksumOk(line)) return { type: 'BAD', raw: line };
  const star = line.indexOf('*');
  const body = line.slice(1, star < 0 ? undefined : star);
  const p = body.split(',');
  const talker = p[0].slice(0, 2), type = p[0].slice(2);
  const out = { talker, type, raw: line };
  switch (type) {
    case 'GGA': {
      const q = i(p[6]);
      Object.assign(out, {
        time: hms(p[1]), lat: ll(p[2], p[3], true), lon: ll(p[4], p[5], false), quality: q, fix: FIX_TYPES[q] || 'NONE',
        sats: i(p[7]), hdop: f(p[8]), altMSL: f(p[9]), geoidSep: f(p[11]), age: f(p[13]), stationId: p[14] ? p[14].trim() : null
      });
      break;
    }
    case 'RMC':
      Object.assign(out, { time: hms(p[1]), valid: p[2] === 'A', lat: ll(p[3], p[4], true), lon: ll(p[5], p[6], false), speedKn: f(p[7]), course: f(p[8]), date: p[9] || null, mode: p[12] || null });
      break;
    case 'GST':
      Object.assign(out, { time: hms(p[1]), rms: f(p[2]), semiMajor: f(p[3]), semiMinor: f(p[4]), orient: f(p[5]), sLat: f(p[6]), sLon: f(p[7]), sAlt: f(p[8]) });
      break;
    case 'GSA': {
      const prns = p.slice(3, 15).filter((x) => x !== '').map(Number);
      Object.assign(out, { mode: p[1], fixDim: i(p[2]), prns, pdop: f(p[15]), hdop: f(p[16]), vdop: f(p[17]), systemId: p[18] ? i(p[18]) : null });
      break;
    }
    case 'GSV':
      Object.assign(out, { total: i(p[1]), msg: i(p[2]), inView: i(p[3]) });
      break;
    case 'HDT':
      Object.assign(out, { heading: f(p[1]) });
      break;
    case 'VTG':
      Object.assign(out, { course: f(p[1]), speedKmh: f(p[7]) });
      break;
    case 'ZDA':
      Object.assign(out, { time: hms(p[1]), day: i(p[2]), month: i(p[3]), year: i(p[4]) });
      break;
    default:
      out.fields = p.slice(1);
  }
  return out;
}

// Akış tamponu: parça parça gelen metni satırlara böler
export class NmeaStream {
  constructor(onSentence) { this.buf = ''; this.on = onSentence; this.stats = { lines: 0, bad: 0, bytes: 0 }; this.seen = {}; }
  push(text) {
    this.stats.bytes += text.length;
    this.buf += text;
    if (this.buf.length > 65536) this.buf = this.buf.slice(-8192);
    let k;
    while ((k = this.buf.search(/\r?\n/)) >= 0) {
      const line = this.buf.slice(0, k);
      this.buf = this.buf.slice(this.buf[k] === '\r' ? k + 2 : k + 1);
      if (!line) continue;
      const s = parseSentence(line);
      if (!s) continue;
      this.stats.lines++;
      if (s.type === 'BAD') { this.stats.bad++; continue; }
      this.seen[s.type] = Date.now();
      this.on(s);
    }
  }
}

// GGA cümlesi üret (NTRIP VRS için konum gönderimi / simülatör)
export function makeGGA(lat, lon, altMSL, quality = 1, sats = 12, hdop = 0.8, geoidSep = 0, age = null, date = new Date()) {
  const t = String(date.getUTCHours()).padStart(2, '0') + String(date.getUTCMinutes()).padStart(2, '0') + String(date.getUTCSeconds()).padStart(2, '0') + '.' + String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
  const la = Math.abs(lat), lo = Math.abs(lon);
  const latS = String(Math.floor(la)).padStart(2, '0') + ((la - Math.floor(la)) * 60).toFixed(7).padStart(10, '0');
  const lonS = String(Math.floor(lo)).padStart(3, '0') + ((lo - Math.floor(lo)) * 60).toFixed(7).padStart(10, '0');
  return withChecksum(['GNGGA', t, latS, lat >= 0 ? 'N' : 'S', lonS, lon >= 0 ? 'E' : 'W', quality, String(sats).padStart(2, '0'), hdop.toFixed(1), altMSL.toFixed(3), 'M', geoidSep.toFixed(3), 'M', age === null ? '' : age.toFixed(1), age === null ? '' : '0001'].join(','));
}
export function makeGST(sLat, sLon, sAlt, date = new Date()) {
  const t = String(date.getUTCHours()).padStart(2, '0') + String(date.getUTCMinutes()).padStart(2, '0') + String(date.getUTCSeconds()).padStart(2, '0') + '.00';
  const rms = Math.hypot(sLat, sLon);
  return withChecksum(['GNGST', t, rms.toFixed(3), sLat.toFixed(3), sLon.toFixed(3), '0.0', sLat.toFixed(3), sLon.toFixed(3), sAlt.toFixed(3)].join(','));
}
export function makeGSA(pdop, hdop, vdop, n = 12) {
  const prns = Array.from({ length: 12 }, (_, k) => (k < n ? String(k + 1).padStart(2, '0') : ''));
  return withChecksum(['GNGSA', 'A', '3', ...prns, pdop.toFixed(1), hdop.toFixed(1), vdop.toFixed(1)].join(','));
}
