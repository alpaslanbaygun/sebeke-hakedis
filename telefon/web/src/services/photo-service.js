// Photo Service — fotoğraf adlandırma ({ObjeNo}_{Sıra}.jpg), proje klasör yolu, görüntü üstü bilgi satırları ve EXIF (GPS) yazımı.
import { KIND_FOLDER, EQUIPMENT_KINDS } from '../core/schema.js';
import { sourceInfo } from '../core/source.js';

export const safeName = (s) => String(s ?? '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'OBJE';
export const projectFolder = (p) => safeName((p.code || p.name || 'PROJE')).toUpperCase();

// Objenin sıradaki fotoğraf adı: D-045_01.jpg, D-045_02.jpg … (silinenler dahil en büyük sıra + 1)
export function nextPhotoName(photos, ownerId, ownerNo) {
  const base = safeName(ownerNo);
  let max = 0;
  for (const ph of photos) { if (ph.ownerId !== ownerId) continue; const m = /_(\d+)\.jpg$/i.exec(ph.filename || ''); max = Math.max(max, m ? +m[1] : (ph.seq || 0)); }
  const n = Math.max(max, photos.filter((p) => p.ownerId === ownerId && p.status !== 'deleted').length) + 1;
  return { seq: n, filename: base + '_' + String(n).padStart(2, '0') + '.jpg' };
}
// Proje içi yol: DIREKLER/D-045/D-045_01.jpg
export function photoPath(kind, ownerNo, filename) {
  const folder = KIND_FOLDER[kind] || 'FOTOGRAFLAR';
  return folder + '/' + safeName(ownerNo) + '/' + filename;
}
export const kindLabel = (kind) => (kind === 'line' ? 'Hat' : kind === 'point' ? 'Nokta' : (EQUIPMENT_KINDS[kind] || {}).label || 'Obje');

const f3 = (v) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(3));
// Fotoğraf üstüne yazılacak satırlar (spesifikasyon 6.2): proje · obje no + tür · tarih saat · X/Y/Z · doğruluk · fix
export function overlayLines({ project, ownerNo, kind, when, point, gnss, operator, heading, note }) {
  const hasP = point && point.E != null;
  const E = hasP ? point.E : gnss && gnss.E, N = hasP ? point.N : gnss && gnss.N, H = hasP ? point.H : gnss && gnss.H;
  const q = hasP ? point.quality || {} : {};
  const acc = hasP ? q.sigmaH : gnss && gnss.sigmaH;
  const fix = hasP ? sourceInfo(point).tag : gnss && gnss.source !== 'none' ? (gnss.source === 'phone' ? 'TELEFON GPS' : gnss.fix === 'FIX' ? 'RTK FIX' : gnss.fix === 'FLOAT' ? 'RTK FLOAT' : gnss.fix || 'GNSS') : 'KONUM YOK';
  const d = when || new Date();
  const out = [
    project.name,
    ownerNo + ' · ' + kindLabel(kind),
    d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR') + (operator ? ' · ' + operator : ''),
    E != null ? 'Y(saga) ' + f3(E) + '  X(yukari) ' + f3(N) + '  Z ' + (H != null ? f3(H) : 'bilinmiyor') : 'Koordinat yok',
    'Doğruluk ' + (acc != null ? '±' + (acc >= 1 ? (+acc).toFixed(1) : (+acc).toFixed(3)) + ' m' : '—') + ' · ' + fix + (heading != null ? ' · Yön ' + Math.round(heading) + '°' : '')
  ];
  if (note) out.push(note);
  return out;
}

// ---------------- EXIF ----------------
// Küçük TIFF/EXIF yazıcı (little-endian). Yalnız ihtiyaç duyulan etiketler: açıklama, yazılım, tarih, GPS.
const T = { BYTE: 1, ASCII: 2, SHORT: 3, LONG: 4, RATIONAL: 5 };
const TR = { 'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C', 'ı': 'i', 'İ': 'I', '·': '-', '±': '+/-', '°': 'deg', '→': '>' };
const ascii = (s) => { const a = []; for (const ch of String(s)) { const t = TR[ch] ?? ch; for (const c2 of t) { const c = c2.charCodeAt(0); a.push(c < 128 ? c : 63); } } a.push(0); return a; };
const u16 = (v) => [v & 255, (v >> 8) & 255];
const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const rat = (v, den = 1000000) => [...u32(Math.round(Math.abs(v) * den) >>> 0), ...u32(den)];
const dmsRat = (deg) => { const a = Math.abs(deg), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60; return [...u32(d), ...u32(1), ...u32(m), ...u32(1), ...u32(Math.round(s * 10000)), ...u32(10000)]; };
const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
// entries: [{tag,type,count,bytes}] → IFD; 4 bayttan büyük değerler veri alanına yazılır. base: bu IFD'nin TIFF içindeki ofseti.
function ifd(entries, base, patch = {}) {
  entries.sort((a, b) => a.tag - b.tag);
  const n = entries.length, headLen = 2 + 12 * n + 4;
  let data = [];
  const head = [...u16(n)];
  for (const e of entries) {
    head.push(...u16(e.tag), ...u16(e.type), ...u32(e.count));
    if (e.pointer) { head.push(...u32(patch[e.tag] || 0)); continue; }
    if (e.bytes.length <= 4) { const b = e.bytes.slice(); while (b.length < 4) b.push(0); head.push(...b); }
    else { head.push(...u32(base + headLen + data.length)); data.push(...e.bytes); if (data.length % 2) data.push(0); }
  }
  head.push(0, 0, 0, 0);
  return head.concat(data);
}
const ent = (tag, type, bytes, count) => ({ tag, type, bytes, count: count ?? bytes.length / SIZE[type] });

export function buildExif(m = {}) {
  const d = m.date ? new Date(m.date) : new Date();
  const p2 = (x) => String(x).padStart(2, '0');
  const local = d.getFullYear() + ':' + p2(d.getMonth() + 1) + ':' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  const gps = [];
  if (m.lat != null && m.lon != null && Number.isFinite(+m.lat) && Number.isFinite(+m.lon)) {
    gps.push(ent(0x0000, T.BYTE, [2, 3, 0, 0]));
    gps.push(ent(0x0001, T.ASCII, ascii(m.lat >= 0 ? 'N' : 'S')), ent(0x0002, T.RATIONAL, dmsRat(m.lat)));
    gps.push(ent(0x0003, T.ASCII, ascii(m.lon >= 0 ? 'E' : 'W')), ent(0x0004, T.RATIONAL, dmsRat(m.lon)));
    if (m.alt != null && Number.isFinite(+m.alt)) gps.push(ent(0x0005, T.BYTE, [m.alt < 0 ? 1 : 0]), ent(0x0006, T.RATIONAL, rat(m.alt, 1000)));
    gps.push(ent(0x0007, T.RATIONAL, [...u32(d.getUTCHours()), ...u32(1), ...u32(d.getUTCMinutes()), ...u32(1), ...u32(d.getUTCSeconds()), ...u32(1)]));
    if (m.heading != null && Number.isFinite(+m.heading)) gps.push(ent(0x0010, T.ASCII, ascii('T')), ent(0x0011, T.RATIONAL, rat(((m.heading % 360) + 360) % 360, 100)));
    gps.push(ent(0x0012, T.ASCII, ascii('WGS-84')));
    gps.push(ent(0x001d, T.ASCII, ascii(d.getUTCFullYear() + ':' + p2(d.getUTCMonth() + 1) + ':' + p2(d.getUTCDate()))));
    if (m.accuracy != null && Number.isFinite(+m.accuracy)) gps.push(ent(0x001f, T.RATIONAL, rat(m.accuracy, 1000)));
  }
  const exif = [ent(0x9003, T.ASCII, ascii(local)), ent(0x9004, T.ASCII, ascii(local))];
  const ifd0 = [
    ent(0x010e, T.ASCII, ascii(m.description || '')),
    ent(0x010f, T.ASCII, ascii(m.make || 'VOLT-EDAS Saha')),
    ent(0x0110, T.ASCII, ascii(m.model || 'GNSS')),
    ent(0x0112, T.SHORT, u16(1)),
    ent(0x0131, T.ASCII, ascii(m.software || 'VOLT-EDAS Saha')),
    ent(0x0132, T.ASCII, ascii(local)),
    ent(0x013b, T.ASCII, ascii(m.artist || '')),
    { tag: 0x8769, type: T.LONG, count: 1, pointer: true }
  ];
  if (gps.length) ifd0.push({ tag: 0x8825, type: T.LONG, count: 1, pointer: true });
  // İki geçiş: önce uzunluklar, sonra alt IFD ofsetleri
  const off0 = 8;
  const len0 = ifd(ifd0.map((e) => Object.assign({}, e)), off0).length;
  const offExif = off0 + len0;
  const exifB = ifd(exif, offExif);
  const offGps = offExif + exifB.length;
  const gpsB = gps.length ? ifd(gps, offGps) : [];
  const b0 = ifd(ifd0, off0, { 0x8769: offExif, 0x8825: offGps });
  const tiff = [0x49, 0x49, 0x2a, 0x00, ...u32(8), ...b0, ...exifB, ...gpsB];
  const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const len = body.length + 2;
  return new Uint8Array([0xff, 0xe1, (len >> 8) & 255, len & 255, ...body]);
}
// JPEG içindeki mevcut EXIF (APP1) bölümünü döndürür (yoksa null)
export function extractExif(u8) {
  if (!u8 || u8[0] !== 0xff || u8[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 < u8.length && u8[p] === 0xff) {
    const mk = u8[p + 1], len = (u8[p + 2] << 8) | u8[p + 3];
    if (mk === 0xda || mk === 0xd9) break;
    if (mk === 0xe1 && u8[p + 4] === 0x45 && u8[p + 5] === 0x78 && u8[p + 6] === 0x69 && u8[p + 7] === 0x66) return u8.slice(p, p + 2 + len);
    p += 2 + len;
  }
  return null;
}
// Kopyalanan EXIF'te yön (Orientation) 1'e çekilir: görüntü tuvalde zaten döndürülmüş kaydedilir
export function resetOrientation(seg) {
  const s = seg.slice();
  const t = 10; // TIFF başlangıcı (FFE1 len(2) "Exif\0\0")
  const le = s[t] === 0x49;
  const r16 = (o) => (le ? s[o] | (s[o + 1] << 8) : (s[o] << 8) | s[o + 1]);
  const r32 = (o) => (le ? (s[o] | (s[o + 1] << 8) | (s[o + 2] << 16) | (s[o + 3] << 24)) >>> 0 : ((s[o] << 24) | (s[o + 1] << 16) | (s[o + 2] << 8) | s[o + 3]) >>> 0);
  const o0 = t + r32(t + 4);
  if (o0 + 2 > s.length) return s;
  const n = r16(o0);
  for (let i = 0; i < n; i++) { const e = o0 + 2 + i * 12; if (e + 12 > s.length) break; if (r16(e) === 0x0112) { if (le) { s[e + 8] = 1; s[e + 9] = 0; } else { s[e + 8] = 0; s[e + 9] = 1; } } }
  return s;
}
// EXIF bölümünü JPEG'in başına (SOI'den hemen sonra) yerleştirir; varsa eski EXIF çıkarılır
export function withExif(jpeg, exifSeg) {
  if (!exifSeg || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const old = extractExif(jpeg);
  let rest = jpeg.subarray(2);
  if (old) { let p = 2; while (p + 4 < jpeg.length) { const len = (jpeg[p + 2] << 8) | jpeg[p + 3]; if (jpeg[p + 1] === 0xe1 && jpeg[p + 4] === 0x45) { const a = jpeg.subarray(2, p), b = jpeg.subarray(p + 2 + len); rest = new Uint8Array(a.length + b.length); rest.set(a, 0); rest.set(b, a.length); break; } if (jpeg[p + 1] === 0xda) break; p += 2 + len; } }
  const out = new Uint8Array(2 + exifSeg.length + rest.length);
  out[0] = 0xff; out[1] = 0xd8; out.set(exifSeg, 2); out.set(rest, 2 + exifSeg.length);
  return out;
}
