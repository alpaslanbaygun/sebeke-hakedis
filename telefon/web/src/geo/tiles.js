// Harita karosu matematiği: küresel Web Mercator (EPSG:3857 — OSM, Esri, Google) ve elipsoidal Mercator (EPSG:3395 — Yandex).
const E = 0.0818191908426215;            // WGS84 birinci dış merkezlik
const RAD = Math.PI / 180;

export const tileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
// Enlem → karo satırı (kesirli). proj: '3857' | '3395'
export function tileYf(lat, z, proj = '3857') {
  const n = 2 ** z, phi = lat * RAD;
  let y;
  if (proj === '3395') { const s = Math.sin(phi); y = Math.log(Math.tan(Math.PI / 4 + phi / 2) * Math.pow((1 - E * s) / (1 + E * s), E / 2)); }
  else y = Math.log(Math.tan(phi) + 1 / Math.cos(phi));
  return ((1 - y / Math.PI) / 2) * n;
}
export const tileY = (lat, z, proj) => Math.floor(tileYf(lat, z, proj));
// Karo köşesi → enlem / boylam
export function tileLL(x, y, z, proj = '3857') {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const m = Math.PI * (1 - (2 * y) / n);                // Mercator y / a
  let phi = Math.atan(Math.sinh(m));
  if (proj === '3395') { for (let i = 0; i < 8; i++) { const s = Math.sin(phi); phi = 2 * Math.atan(Math.exp(m) * Math.pow((1 + E * s) / (1 - E * s), E / 2)) - Math.PI / 2; } }
  return { lat: phi / RAD, lon };
}
/** Bing karo anahtarı (quadkey): eklentideki HaritaAltligi.QuadKey ile aynı. */
export function quadKey(x, y, z) {
  let q = '';
  for (let i = z; i > 0; i--) { const m = 1 << (i - 1); q += String((x & m ? 1 : 0) + (y & m ? 2 : 0)); }
  return q;
}
