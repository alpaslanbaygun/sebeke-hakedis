// Koordinat referans sistemleri: ITRF96/TUREF (GRS80), WGS84, ED50 (Uluslararası 1924),
// 3° TM (Gauss-Krüger) dilimleri, UTM ve yerel (özel TM + 2B Helmert) sistemler.
// TM dönüşümü Krüger n-serisi (6. derece, Karney 2011) ile mm altı doğrulukta yapılır.

export const ELLIPSOIDS = {
  GRS80: { a: 6378137.0, f: 1 / 298.257222101, label: 'GRS80' },
  WGS84: { a: 6378137.0, f: 1 / 298.257223563, label: 'WGS84' },
  INTL1924: { a: 6378388.0, f: 1 / 297.0, label: 'International 1924' }
};

export const DATUMS = {
  TUREF: { label: 'ITRF96 / TUREF', ellipsoid: 'GRS80', toWGS84: null, epsgGeo: 5252 },
  WGS84: { label: 'WGS84', ellipsoid: 'WGS84', toWGS84: null, epsgGeo: 4326 },
  // EPSG:1784 ED50 → WGS 84 (30) Türkiye, Position Vector, doğruluk ±2 m
  ED50: { label: 'ED50', ellipsoid: 'INTL1924', toWGS84: { tx: -84.1, ty: -101.8, tz: -129.7, rx: 0, ry: 0, rz: 0.468, ds: 1.05 }, epsgGeo: 4230, approx: '±2 m (EPSG:1784)' }
};

const D2R = Math.PI / 180, R2D = 180 / Math.PI, AS2R = Math.PI / (180 * 3600);

// ---------------- Krüger TM ----------------
const tmCache = new Map();
function tmCoef(ellName) {
  if (tmCache.has(ellName)) return tmCache.get(ellName);
  const { a, f } = ELLIPSOIDS[ellName];
  const n = f / (2 - f), n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
  const e = Math.sqrt(f * (2 - f));
  const A = (a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
  const al = [0,
    n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180 - (127 * n5) / 288 + (7891 * n6) / 37800,
    (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440 + (281 * n5) / 630 - (1983433 * n6) / 1935360,
    (61 * n3) / 240 - (103 * n4) / 140 + (15061 * n5) / 26880 + (167603 * n6) / 181440,
    (49561 * n4) / 161280 - (179 * n5) / 168 + (6601661 * n6) / 7257600,
    (34729 * n5) / 80640 - (3418889 * n6) / 1995840,
    (212378941 * n6) / 319334400];
  const be = [0,
    n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360 - (81 * n5) / 512 + (96199 * n6) / 604800,
    n2 / 48 + n3 / 15 - (437 * n4) / 1440 + (46 * n5) / 105 - (1118711 * n6) / 3870720,
    (17 * n3) / 480 - (37 * n4) / 840 - (209 * n5) / 4480 + (5569 * n6) / 90720,
    (4397 * n4) / 161280 - (11 * n5) / 504 - (830251 * n6) / 7257600,
    (4583 * n5) / 161280 - (108847 * n6) / 3991680,
    (20648693 * n6) / 638668800];
  const c = { a, f, e, n, A, al, be };
  tmCache.set(ellName, c);
  return c;
}

export function tmForward(latDeg, lonDeg, p) {
  const c = tmCoef(p.ellipsoid);
  const phi = latDeg * D2R, lam = (lonDeg - p.cm) * D2R;
  const sp = Math.sin(phi);
  const t = Math.sinh(Math.atanh(sp) - c.e * Math.atanh(c.e * sp));
  const xi1 = Math.atan2(t, Math.cos(lam));
  const eta1 = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let xi = xi1, eta = eta1;
  for (let j = 1; j <= 6; j++) {
    xi += c.al[j] * Math.sin(2 * j * xi1) * Math.cosh(2 * j * eta1);
    eta += c.al[j] * Math.cos(2 * j * xi1) * Math.sinh(2 * j * eta1);
  }
  return { E: p.fe + p.k0 * c.A * eta, N: p.fn + p.k0 * c.A * xi };
}

export function tmInverse(E, N, p) {
  const c = tmCoef(p.ellipsoid);
  const xi = (N - p.fn) / (p.k0 * c.A), eta = (E - p.fe) / (p.k0 * c.A);
  let xi1 = xi, eta1 = eta;
  for (let j = 1; j <= 6; j++) {
    xi1 -= c.be[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    eta1 -= c.be[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const sh = Math.sinh(eta1), cx = Math.cos(xi1);
  const tau1 = Math.sin(xi1) / Math.sqrt(sh * sh + cx * cx);
  const lam = Math.atan2(sh, cx);
  // τ' → τ Newton iterasyonu
  const e = c.e, e2 = e * e;
  let tau = tau1;
  for (let i = 0; i < 8; i++) {
    const s = Math.sinh(e * Math.atanh((e * tau) / Math.sqrt(1 + tau * tau)));
    const ti = tau * Math.sqrt(1 + s * s) - s * Math.sqrt(1 + tau * tau);
    const d = ((tau1 - ti) / Math.sqrt(1 + ti * ti)) * ((1 + (1 - e2) * tau * tau) / ((1 - e2) * Math.sqrt(1 + tau * tau)));
    tau += d;
    if (Math.abs(d) < 1e-14) break;
  }
  return { lat: Math.atan(tau) * R2D, lon: p.cm + lam * R2D };
}

// ---------------- Datum dönüşümü (ECEF + 7 parametre Helmert, Position Vector) ----------------
export function geoToEcef(latDeg, lonDeg, h, ellName) {
  const { a, f } = ELLIPSOIDS[ellName];
  const e2 = f * (2 - f), phi = latDeg * D2R, lam = lonDeg * D2R;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return { X: (N + h) * Math.cos(phi) * Math.cos(lam), Y: (N + h) * Math.cos(phi) * Math.sin(lam), Z: (N * (1 - e2) + h) * Math.sin(phi) };
}
export function ecefToGeo(X, Y, Z, ellName) {
  const { a, f } = ELLIPSOIDS[ellName];
  const e2 = f * (2 - f), b = a * (1 - f), ep2 = (a * a - b * b) / (b * b);
  const p = Math.hypot(X, Y), th = Math.atan2(Z * a, p * b);
  let phi = Math.atan2(Z + ep2 * b * Math.sin(th) ** 3, p - e2 * a * Math.cos(th) ** 3);
  for (let i = 0; i < 3; i++) { const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2); const h = p / Math.cos(phi) - N; phi = Math.atan2(Z, p * (1 - (e2 * N) / (N + h))); }
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return { lat: phi * R2D, lon: Math.atan2(Y, X) * R2D, h: p / Math.cos(phi) - N };
}
function helmert(P, t, inverse) {
  const s = inverse ? -1 : 1;
  const rx = s * t.rx * AS2R, ry = s * t.ry * AS2R, rz = s * t.rz * AS2R, k = 1 + s * t.ds * 1e-6;
  const X = P.X, Y = P.Y, Z = P.Z;
  return { X: s * t.tx + k * (X - rz * Y + ry * Z), Y: s * t.ty + k * (rz * X + Y - rx * Z), Z: s * t.tz + k * (-ry * X + rx * Y + Z) };
}
// GNSS (TUREF ≈ WGS84 çerçevesi) → hedef datum
export function fromGnssDatum(lat, lon, h, datum) {
  const d = DATUMS[datum];
  if (!d || !d.toWGS84) return { lat, lon, h };
  const P = geoToEcef(lat, lon, h || 0, 'WGS84');
  const Q = helmert(P, d.toWGS84, true);
  return ecefToGeo(Q.X, Q.Y, Q.Z, d.ellipsoid);
}
export function toGnssDatum(lat, lon, h, datum) {
  const d = DATUMS[datum];
  if (!d || !d.toWGS84) return { lat, lon, h };
  const P = geoToEcef(lat, lon, h || 0, d.ellipsoid);
  const Q = helmert(P, d.toWGS84, false);
  return ecefToGeo(Q.X, Q.Y, Q.Z, 'WGS84');
}

// ---------------- CRS tanımları ----------------
export const TM_ZONES = [27, 30, 33, 36, 39, 42, 45];
export function zoneForLon(lon) {
  const cm = Math.round(lon / 3) * 3;
  return Math.min(45, Math.max(27, cm));
}
export function makeCrs(opts) {
  const datum = opts.datum || 'TUREF';
  const proj = opts.projection || 'TM3';
  const ell = DATUMS[datum] ? DATUMS[datum].ellipsoid : 'GRS80';
  let c;
  if (proj === 'TM3') {
    const cm = opts.cm || 39;
    const epsg = datum === 'TUREF' ? 5253 + (cm - 27) / 3 : datum === 'ED50' ? 2319 + (cm - 27) / 3 : null;
    c = { datum, projection: 'TM3', cm, k0: 1.0, fe: 500000, fn: 0, ellipsoid: ell, epsg, label: DATUMS[datum].label + ' / TM' + cm + ' (3°)' };
  } else if (proj === 'UTM') {
    const zone = opts.zone || Math.floor(((opts.cm || 39) + 180) / 6) + 1;
    const cm = zone * 6 - 183;
    c = { datum, projection: 'UTM', zone, cm, k0: 0.9996, fe: 500000, fn: 0, ellipsoid: ell, epsg: datum === 'WGS84' ? 32600 + zone : datum === 'ED50' ? 23000 + zone : null, label: DATUMS[datum].label + ' / UTM ' + zone + 'N' };
  } else if (proj === 'GEO') {
    c = { datum, projection: 'GEO', ellipsoid: ell, epsg: DATUMS[datum].epsgGeo, label: DATUMS[datum].label + ' coğrafi (enlem/boylam)' };
  } else {
    c = { datum, projection: 'CUSTOM', cm: opts.cm || 39, k0: opts.k0 || 1, fe: opts.fe ?? 500000, fn: opts.fn ?? 0, ellipsoid: ell, epsg: null, label: 'Yerel TM (DOM ' + (opts.cm || 39) + ')' };
  }
  if (opts.local) c.local = opts.local; // 2B Helmert {a,b,tx,ty}
  return c;
}

export function project(lat, lon, crs, h = 0) {
  const g = fromGnssDatum(lat, lon, h, crs.datum);
  if (crs.projection === 'GEO') return { E: g.lon, N: g.lat };
  let r = tmForward(g.lat, g.lon, crs);
  if (crs.local) r = applyLocal(r, crs.local);
  return r;
}
export function unproject(E, N, crs, h = 0) {
  let p = { E, N };
  if (crs.projection === 'GEO') return { lat: N, lon: E };
  if (crs.local) p = invertLocal(p, crs.local);
  const g = tmInverse(p.E, p.N, crs);
  const w = toGnssDatum(g.lat, g.lon, h, crs.datum);
  return { lat: w.lat, lon: w.lon };
}
// Grid yakınsaması (°) ve ölçek faktörü — sayısal
export function convergence(lat, lon, crs) {
  const a = project(lat, lon, crs), b = project(lat + 1e-5, lon, crs);
  return Math.atan2(b.E - a.E, b.N - a.N) * R2D;
}

// 2B Helmert (4 parametre) yerel sistem
export function applyLocal(p, L) { return { E: L.a * p.E - L.b * p.N + L.tx, N: L.b * p.E + L.a * p.N + L.ty }; }
export function invertLocal(p, L) {
  const d = L.a * L.a + L.b * L.b, x = p.E - L.tx, y = p.N - L.ty;
  return { E: (L.a * x + L.b * y) / d, N: (-L.b * x + L.a * y) / d };
}
// Ortak noktalardan en küçük kareler 2B Helmert çözümü: src (TM) → dst (yerel)
export function solveHelmert2D(pairs) {
  if (pairs.length < 2) throw new Error('En az 2 ortak nokta gerekli');
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p.src.E, 0) / n, my = pairs.reduce((s, p) => s + p.src.N, 0) / n;
  const ux = pairs.reduce((s, p) => s + p.dst.E, 0) / n, uy = pairs.reduce((s, p) => s + p.dst.N, 0) / n;
  let sxx = 0, sxy1 = 0, sxy2 = 0;
  for (const p of pairs) {
    const x = p.src.E - mx, y = p.src.N - my, X = p.dst.E - ux, Y = p.dst.N - uy;
    sxx += x * x + y * y; sxy1 += x * X + y * Y; sxy2 += x * Y - y * X;
  }
  const a = sxy1 / sxx, b = sxy2 / sxx;
  const tx = ux - a * mx + b * my, ty = uy - b * mx - a * my;
  const L = { a, b, tx, ty };
  const res = pairs.map((p) => { const q = applyLocal(p.src, L); return Math.hypot(q.E - p.dst.E, q.N - p.dst.N); });
  return Object.assign(L, { scale: Math.hypot(a, b), rotDeg: Math.atan2(b, a) * R2D, rms: Math.sqrt(res.reduce((s, r) => s + r * r, 0) / n), residuals: res });
}

// ---------------- Yükseklik / geoit ----------------
// geoid: {model: 'receiver' | 'constant' | 'grid' | 'none', N?: sabit, grid?: {lat0, lon0, dlat, dlon, rows, cols, values}}
export function geoidN(lat, lon, geoid, receiverN) {
  if (!geoid || geoid.model === 'receiver') return receiverN ?? null;
  if (geoid.model === 'constant') return geoid.N ?? 0;
  if (geoid.model === 'none') return 0;
  if (geoid.model === 'grid' && geoid.grid) return bilinear(geoid.grid, lat, lon);
  return receiverN ?? null;
}
function bilinear(g, lat, lon) {
  const r = (lat - g.lat0) / g.dlat, c = (lon - g.lon0) / g.dlon;
  const r0 = Math.floor(r), c0 = Math.floor(c);
  if (r0 < 0 || c0 < 0 || r0 >= g.rows - 1 || c0 >= g.cols - 1) return null;
  const v = (i, j) => g.values[i * g.cols + j];
  const fr = r - r0, fc = c - c0;
  return v(r0, c0) * (1 - fr) * (1 - fc) + v(r0, c0 + 1) * (1 - fr) * fc + v(r0 + 1, c0) * fr * (1 - fc) + v(r0 + 1, c0 + 1) * fr * fc;
}
// Basit ASCII geoit ızgarası: başlık "lat0 lon0 dlat dlon rows cols" + satır satır değerler (güneyden kuzeye)
export function parseGeoidGrid(text) {
  const nums = text.trim().split(/[\s,;]+/).map(Number);
  const [lat0, lon0, dlat, dlon, rows, cols] = nums;
  const values = nums.slice(6, 6 + rows * cols);
  if (values.length !== rows * cols) throw new Error('Geoit ızgarası eksik: ' + values.length + '/' + rows * cols);
  return { lat0, lon0, dlat, dlon, rows, cols, values };
}

// ---------------- WKT (PRJ) ----------------
export function wkt(crs) {
  const sph = { GRS80: 'SPHEROID["GRS_1980",6378137.0,298.257222101]', WGS84: 'SPHEROID["WGS_1984",6378137.0,298.257223563]', INTL1924: 'SPHEROID["International_1924",6378388.0,297.0]' }[crs.ellipsoid];
  const dat = { TUREF: 'D_Turkish_National_Reference_Frame', WGS84: 'D_WGS_1984', ED50: 'D_European_1950' }[crs.datum] || 'D_Unknown';
  const gcs = { TUREF: 'GCS_TUREF', WGS84: 'GCS_WGS_1984', ED50: 'GCS_European_1950' }[crs.datum] || 'GCS_Unknown';
  const geog = 'GEOGCS["' + gcs + '",DATUM["' + dat + '",' + sph + '],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  if (crs.projection === 'GEO') return geog;
  const name = crs.projection === 'UTM' ? (crs.datum === 'WGS84' ? 'WGS_1984_UTM_Zone_' + crs.zone + 'N' : 'ED_1950_UTM_Zone_' + crs.zone + 'N')
    : crs.datum === 'TUREF' ? 'TUREF_TM' + crs.cm : crs.datum === 'ED50' ? 'ED_1950_TM' + crs.cm : 'Local_TM_' + crs.cm;
  return 'PROJCS["' + name + '",' + geog + ',PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",' + crs.fe.toFixed(1) + '],PARAMETER["False_Northing",' + crs.fn.toFixed(1) + '],PARAMETER["Central_Meridian",' + crs.cm.toFixed(1) + '],PARAMETER["Scale_Factor",' + crs.k0 + '],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';
}

export function crsSummary(crs) {
  return crs.label + (crs.epsg ? ' · EPSG:' + crs.epsg : '') + (crs.local ? ' · yerel Helmert' : '') + (DATUMS[crs.datum] && DATUMS[crs.datum].approx ? ' · datum dönüşümü ' + DATUMS[crs.datum].approx : '');
}
