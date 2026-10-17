// ASCII DXF okuyucu → birleşik CAD modeli (bkz. index.js).
// Özgün tek dosyalık NCZ→DXF dönüştürücüdeki DXF okuyucunun portu; şu iyileştirmelerle:
//  - BYLAYER rengi üst düzey nesnelerde de çözülür; blok içinde AutoCAD kuralı uygulanır
//    ("0" tabakasındaki nesne INSERT'in tabakasına geçer, BYBLOCK INSERT'in rengini alır)
//  - Bloklar tam afin matrisle patlatılır: blok taban noktası, negatif (aynalı) ölçek, iç içe blok,
//    MINSERT dizileri; aynalı yaylarda açılar aynalanır
//  - Eski POLYLINE/VERTEX: kapalı bayrağı ve bulge; LWPOLYLINE kapalı bayrağı `closed` olarak korunur
//  - ELLIPSE, SPLINE (de Boor), 3DFACE, LEADER, ATTRIB, DIMENSION (anonim bloğu), HATCH (kenar tipli sınırlar)
//  - OCS: ekstrüzyon yönü −Z olan düzlemsel nesneler X ekseninde aynalanır
//  - %%d %%c %%p → ° ⌀ ± ; MTEXT biçim kodları ayıklanır
//  - Kâğıt uzayı nesneleri (67=1) atlanır
// Çıktı koordinatları: x = sağa (doğu), y = yukarı (kuzey); açılar derece, doğudan saat yönü tersine.

const D2R = Math.PI / 180, R2D = 180 / Math.PI, TAU = 2 * Math.PI;
const DOMS = [27, 30, 33, 36, 39, 42, 45];
const MAX_ENTS = 3000000;
const MAX_DEPTH = 8;
const ARC_TOL = 0.01; // yay → kiriş dönüşümünde izin verilen ok (sehim) hatası, çizim birimi (m)

/* ------------------------------------------------------------------
   Ortak yardımcılar (ncz.js ve index.js de kullanır)
   ------------------------------------------------------------------ */

// Uint8Array | ArrayBuffer | başka bir realm'den gelen görünüm → Uint8Array (kopyasız)
export function toBytes(src) {
  if (ArrayBuffer.isView(src)) return new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
  if (src && typeof src.byteLength === 'number') return new Uint8Array(src);
  throw new Error('CAD verisi Uint8Array veya ArrayBuffer olmalı.');
}

// windows-1254 yoksa: latin1 + altı Türkçe harf (1254 ile 8859-1 arasındaki tek harf farkları)
const TR1254 = { 0xD0: 0x11E, 0xDD: 0x130, 0xDE: 0x15E, 0xF0: 0x11F, 0xFD: 0x131, 0xFE: 0x15F };
export function decodeLatin1Tr(u8) {
  let out = '';
  const buf = new Uint16Array(8192);
  for (let i = 0; i < u8.length; i += 8192) {
    const n = Math.min(8192, u8.length - i);
    for (let k = 0; k < n; k++) { const b = u8[i + k]; buf[k] = TR1254[b] || b; }
    out += String.fromCharCode.apply(null, n === 8192 ? buf : buf.subarray(0, n));
  }
  return out;
}
let dec1254; // undefined = denenmedi, null = desteklenmiyor
export function decode1254(u8) {
  if (dec1254 === undefined) {
    try { dec1254 = new TextDecoder('windows-1254'); } catch { dec1254 = null; }
  }
  return dec1254 ? dec1254.decode(u8) : decodeLatin1Tr(u8);
}

export const normDeg = (a) => { a %= 360; return a < 0 ? a + 360 : a; };

// Yay sınır kutusu: a1'den a2'ye saat yönü tersine (derece). [minX, minY, maxX, maxY]
export function arcBBox(x, y, r, a1, a2) {
  const s = normDeg(a1);
  let sw = normDeg(a2 - a1);
  if (sw === 0) sw = 360;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (deg) => {
    const px = x + r * Math.cos(deg * D2R), py = y + r * Math.sin(deg * D2R);
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
  };
  add(s); add(s + sw);
  for (let q = 0; q < 360; q += 90) if (normDeg(q - s) <= sw) add(q);
  return [minX, minY, maxX, maxY];
}

// Model nesnelerinin sınır kutusu (yazılarda yalnız ekleme noktası). hidden: yok sayılacak tabaka indeksleri
export function entsBBox(ents, hidden) {
  let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity;
  const add = (x, y) => {
    if (x < minE) minE = x; if (x > maxE) maxE = x;
    if (y < minN) minN = y; if (y > maxN) maxN = y;
  };
  const skip = hidden && hidden.size ? hidden : null;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (skip && skip.has(e.l)) continue;
    switch (e.t) {
      case 'L': add(e.x1, e.y1); add(e.x2, e.y2); break;
      case 'P': case 'F': { const v = e.v; for (let k = 0; k + 1 < v.length; k += 2) add(v[k], v[k + 1]); break; }
      case 'C': add(e.x - e.r, e.y - e.r); add(e.x + e.r, e.y + e.r); break;
      case 'A': { const b = arcBBox(e.x, e.y, e.r, e.a1, e.a2); add(b[0], b[1]); add(b[2], b[3]); break; }
      default: add(e.x, e.y);
    }
  }
  return minE <= maxE && minN <= maxN ? { minE, minN, maxE, maxN } : null;
}

// a1→a2 (derece, saat yönü tersine) yayını n kirişe böler; düz [x0,y0,…] dizisi (n+1 nokta)
export function arcPoints(x, y, r, a1, a2, n) {
  let sw = normDeg(a2 - a1);
  if (sw === 0) sw = 360;
  if (!n) n = arcSegs(r, sw * D2R);
  const out = new Array(2 * (n + 1));
  for (let k = 0; k <= n; k++) {
    const a = (a1 + (sw * k) / n) * D2R;
    out[2 * k] = x + r * Math.cos(a); out[2 * k + 1] = y + r * Math.sin(a);
  }
  return out;
}

// Kiriş sayısı: en az 4, en çok 15°'lik adım (özgün araç) ve ok hatası ≤ ARC_TOL
function arcSegs(r, th) {
  th = Math.abs(th); r = Math.abs(r);
  let n = Math.max(4, Math.ceil(th / (Math.PI / 12)));
  if (r > ARC_TOL) {
    const step = 2 * Math.acos(1 - ARC_TOL / r);
    if (step > 0) n = Math.max(n, Math.ceil(th / step));
  }
  return Math.min(n, 256);
}

// (x1,y1)→(x2,y2) arasındaki bulge yayının ara ve bitiş noktalarını out'a ekler (başlangıç eklenmez)
function bulgeArc(x1, y1, x2, y2, b, out) {
  const th = 4 * Math.atan(b);
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (Math.abs(th) < 1e-9 || d < 1e-12) { out.push(x2, y2); return; }
  const r = d / (2 * Math.sin(th / 2));
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const h = r * Math.cos(th / 2);
  const nx = -(y2 - y1) / d, ny = (x2 - x1) / d;
  const cx = mx + nx * h, cy = my + ny * h;
  const a1 = Math.atan2(y1 - cy, x1 - cx);
  const n = arcSegs(r, th), ar = Math.abs(r);
  for (let k = 1; k < n; k++) {
    const a = a1 + (th * k) / n;
    out.push(cx + ar * Math.cos(a), cy + ar * Math.sin(a));
  }
  out.push(x2, y2);
}

// [x,y,bulge,…] üçlülerinden düz köşe dizisi; kapalıysa kapanış yayı da işlenir (ilk nokta yinelenmez)
function bulgePath(raw, closed) {
  const n = raw.length / 3;
  const out = [raw[0], raw[1]];
  for (let i = 0; i < n - 1; i++) bulgeArc(raw[3 * i], raw[3 * i + 1], raw[3 * i + 3], raw[3 * i + 4], raw[3 * i + 2], out);
  if (closed) {
    const l = 3 * (n - 1);
    if (raw[l + 2] !== 0) {
      bulgeArc(raw[l], raw[l + 1], raw[0], raw[1], raw[l + 2], out);
      out.length -= 2;
    }
    // kapanış köşesi ilk köşeyle çakışıyorsa at
    const m = out.length;
    if (m >= 6 && out[m - 2] === out[0] && out[m - 1] === out[1]) out.length -= 2;
  }
  return out;
}

/* ------------------------------------------------------------------
   Afin dönüşüm: [a,b,c,d,e,f] → x' = a·x + c·y + e ; y' = b·x + d·y + f
   ------------------------------------------------------------------ */
const mul = (M, N) => [
  M[0] * N[0] + M[2] * N[1], M[1] * N[0] + M[3] * N[1],
  M[0] * N[2] + M[2] * N[3], M[1] * N[2] + M[3] * N[3],
  M[0] * N[4] + M[2] * N[5] + M[4], M[1] * N[4] + M[3] * N[5] + M[5],
];
const MIRX = [-1, 0, 0, 1, 0, 0];
function insertMatrix(ix, iy, rotDeg, sx, sy, bx, by, ox, oy) {
  const cr = Math.cos(rotDeg * D2R), sr = Math.sin(rotDeg * D2R);
  // T(ix,iy)·R·T(ox,oy)·S·T(−bx,−by)
  const a = cr * sx, b = sr * sx, c = -sr * sy, d = cr * sy;
  const tx = ox - sx * bx, ty = oy - sy * by; // S·T(−b) sonrası, R öncesi öteleme
  return [a, b, c, d, ix + cr * tx - sr * ty, iy + sr * tx + cr * ty];
}
// Benzerlik dönüşümü mü (tek ölçek, dönme, isteğe bağlı ayna)? → {s, rot°, mir} | null
function similarity(M) {
  const s1 = Math.hypot(M[0], M[1]), s2 = Math.hypot(M[2], M[3]);
  const tol = 1e-9 * Math.max(s1, s2, 1e-300);
  if (Math.abs(s1 - s2) > 1e-7 * Math.max(s1, s2) + tol) return null;
  if (Math.abs(M[0] * M[2] + M[1] * M[3]) > 1e-7 * s1 * s2 + tol) return null;
  return { s: s1, rot: Math.atan2(M[1], M[0]) * R2D, mir: M[0] * M[3] - M[1] * M[2] < 0 };
}

/* ------------------------------------------------------------------
   Metin çözümleme
   ------------------------------------------------------------------ */
const PCT = { d: '°', c: '⌀', p: '±', u: '', o: '', k: '', '%': '%' };
function pctCodes(s) {
  if (s.indexOf('%%') < 0) return s;
  return s.replace(/%%(\d{3}|[dDcCpPuUoOkK%])/g, (_, k) => {
    if (k.length === 3) { const n = +k; return n >= 32 && n < 256 ? decode1254(Uint8Array.of(n)) : ''; }
    return PCT[k.toLowerCase()];
  });
}
const uEsc = (s) => (s.indexOf('\\U+') < 0 ? s
  : s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));

function plainText(s) { return pctCodes(uEsc(s)).trim(); }

// MTEXT biçim kodlarını ayıklar; paragraf sonu (\P) → '\n'
function mtextPlain(s) {
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\') {
      const n = s[i + 1];
      if (n === undefined) break;
      if (n === '\\' || n === '{' || n === '}') { o += n; i++; continue; }
      if (n === 'P' || n === 'X' || n === 'N') { o += '\n'; i++; continue; }
      if (n === '~') { o += ' '; i++; continue; }
      if (n === 'U' && s[i + 2] === '+' && /^[0-9A-Fa-f]{4}$/.test(s.substr(i + 3, 4))) {
        o += String.fromCharCode(parseInt(s.substr(i + 3, 4), 16)); i += 6; continue;
      }
      if (n === 'M' && s[i + 2] === '+') { i += 7; continue; }
      if ('LlOoKk'.indexOf(n) >= 0) { i++; continue; }
      if (/[A-Za-z]/.test(n)) {
        const e = s.indexOf(';', i + 2);
        if (e < 0) { i++; continue; }
        if (n === 'S') o += s.slice(i + 2, e).replace(/\s*[\^#]\s*/g, '/'); // üst/alt yığın → a/b
        i = e; continue;
      }
      i++; o += n; continue;
    }
    if (ch === '{' || ch === '}') continue;
    if (ch === '^' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === 'I') { o += ' '; i++; continue; }
      if (n === 'J') { o += '\n'; i++; continue; }
      if (n === 'M') { i++; continue; }
    }
    o += ch;
  }
  return pctCodes(o).replace(/[ \t]+\n/g, '\n').trim();
}

/* ------------------------------------------------------------------
   B-spline (de Boor, rasyonel destekli)
   ------------------------------------------------------------------ */
function bspline(deg, knots, cx, cy, cw) {
  const n = cx.length;
  if (deg < 1 || n < deg + 1 || knots.length !== n + deg + 1) return null;
  const t0 = knots[deg], t1 = knots[n];
  if (!(t1 > t0)) return null;
  for (let i = 1; i < knots.length; i++) if (!(knots[i] >= knots[i - 1])) return null;
  const nSeg = Math.min(2000, Math.max(8, (n - deg) * 10));
  const dx = new Float64Array(deg + 1), dy = new Float64Array(deg + 1), dw = new Float64Array(deg + 1);
  const out = [];
  let k = deg;
  for (let s = 0; s <= nSeg; s++) {
    const t = s === nSeg ? t1 : t0 + ((t1 - t0) * s) / nSeg;
    while (k < n - 1 && t >= knots[k + 1]) k++;
    for (let j = 0; j <= deg; j++) {
      const w = cw ? cw[j + k - deg] : 1;
      dx[j] = cx[j + k - deg] * w; dy[j] = cy[j + k - deg] * w; dw[j] = w;
    }
    for (let r = 1; r <= deg; r++) {
      for (let j = deg; j >= r; j--) {
        const i = j + k - deg, den = knots[i + deg - r + 1] - knots[i];
        const al = den === 0 ? 0 : (t - knots[i]) / den;
        dx[j] = (1 - al) * dx[j - 1] + al * dx[j];
        dy[j] = (1 - al) * dy[j - 1] + al * dy[j];
        dw[j] = (1 - al) * dw[j - 1] + al * dw[j];
      }
    }
    const w = dw[deg] || 1;
    out.push(dx[deg] / w, dy[deg] / w);
  }
  return out;
}

/* ------------------------------------------------------------------
   Kayıt (grup kodu / değer dizisi) erişimcileri
   ------------------------------------------------------------------ */
function gs(rec, code, def) {
  const c = rec.c;
  for (let i = 0; i < c.length; i++) if (c[i] === code) return rec.v[i];
  return def;
}
function gn(rec, code, def) {
  const s = gs(rec, code);
  if (s === undefined) return def;
  const n = +s;
  return Number.isFinite(n) ? n : def;
}
const has = (rec, code) => rec.c.indexOf(code) >= 0;
const name = (rec, code, def) => { const s = gs(rec, code); return s === undefined ? def : s.trim(); };
const finArr = (a) => { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };
const fin = (...a) => finArr(a);

/* ------------------------------------------------------------------
   Nesne → ilkel (blok-yerel / OCS koordinatlarında)
     k: L doğru, P çoklu doğru, F dolgu, C daire, A yay, T yazı, N nokta, I blok ekleme
     lay: tabaka adı, col: ham renk (null = BYLAYER, 0 = BYBLOCK), mx: OCS aynası (ekstrüzyon −Z)
   ------------------------------------------------------------------ */
function common(rec, k) {
  const col = gs(rec, 62);
  let cn = col === undefined ? null : Math.trunc(+col);
  if (cn === 256 || !Number.isFinite(cn)) cn = null;
  const p = { k, lay: name(rec, 8, '0') || '0', col: cn };
  if (gn(rec, 230, 1) < 0) p.mx = true;
  return p;
}

function polyPrim(rec, raw, closed, width, wcs) {
  if (raw.length < 6) return null;
  if (!finArr(raw)) return null;
  const p = common(rec, 'P');
  if (wcs) delete p.mx;
  const n = raw.length / 3;
  // Halka (donut): çap aralıklı iki köşe + yarım daire bulge'ları + kalınlık → dolu disk (dış yarıçap)
  if (width > 0 && n === 2 && Math.abs(Math.abs(raw[2]) - 1) < 0.25 && Math.abs(Math.abs(raw[5]) - 1) < 0.25) {
    const cx = (raw[0] + raw[3]) / 2, cy = (raw[1] + raw[4]) / 2;
    const ro = Math.hypot(raw[3] - raw[0], raw[4] - raw[1]) / 2 + width / 2;
    p.k = 'F'; p.v = arcPoints(cx, cy, ro, 0, 360, 32); p.v.length -= 2;
    return p;
  }
  p.v = bulgePath(raw, closed);
  if (p.v.length < 4) return null;
  if (closed) p.closed = true;
  if (width > 0) {
    // Kalın kapalı çoklu doğru: kalınlık şeklin içini örtüyorsa dolgu, değilse kalın çerçeve
    if (closed && p.v.length >= 6) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < p.v.length; i += 2) {
        if (p.v[i] < x0) x0 = p.v[i]; if (p.v[i] > x1) x1 = p.v[i];
        if (p.v[i + 1] < y0) y0 = p.v[i + 1]; if (p.v[i + 1] > y1) y1 = p.v[i + 1];
      }
      if (width >= 0.5 * Math.min(x1 - x0, y1 - y0)) { p.k = 'F'; delete p.closed; return p; }
    }
    p.w = width;
  }
  return p;
}

function lwpolyline(rec) {
  const c = rec.c, v = rec.v, raw = [];
  let vw = 0;
  for (let i = 0; i < c.length; i++) {
    const code = c[i];
    if (code === 10) raw.push(+v[i], 0, 0);
    else if (raw.length) {
      if (code === 20) raw[raw.length - 2] = +v[i];
      else if (code === 42) raw[raw.length - 1] = +v[i];
      else if (code === 40 || code === 41) { const w = +v[i]; if (w > vw) vw = w; }
    }
  }
  return polyPrim(rec, raw, (gn(rec, 70, 0) & 1) === 1, Math.max(gn(rec, 43, 0), vw), false);
}

function textPrim(rec, type) {
  const p = common(rec, 'T');
  let x = gn(rec, 10, NaN), y = gn(rec, 20, NaN);
  p.h = gn(rec, 40, 1); p.rot = gn(rec, 50, 0);
  if (type === 'MTEXT') {
    delete p.mx; // MTEXT ekleme noktası ve yön vektörü dünya koordinatındadır
    let s = '';
    for (let i = 0; i < rec.c.length; i++) if (rec.c[i] === 3) s += rec.v[i];
    p.s = mtextPlain(s + gs(rec, 1, ''));
    if (has(rec, 11) && has(rec, 21)) {
      const dx = gn(rec, 11, 1), dy = gn(rec, 21, 0);
      if (dx !== 0 || dy !== 0) p.rot = Math.atan2(dy, dx) * R2D;
    }
    const at = Math.trunc(gn(rec, 71, 1));
    const ha = at >= 1 && at <= 9 ? (at - 1) % 3 : 0;
    const va = at >= 1 && at <= 9 ? (at <= 3 ? 3 : at <= 6 ? 2 : 1) : 3;
    if (ha) p.ha = ha;
    p.va = va;
  } else {
    p.s = plainText(gs(rec, 1, ''));
    // Hizalı yazıda (72/73 ≠ 0) gerçek konum 11/21 grubundadır; 3 (aligned) ve 5 (fit) hariç
    let ha = Math.trunc(gn(rec, 72, 0));
    const va = Math.trunc(gn(rec, type === 'TEXT' ? 73 : 74, 0));
    if (ha === 3 || ha === 5) ha = 0;
    if ((ha || va) && has(rec, 11) && has(rec, 21)) {
      x = gn(rec, 11, NaN); y = gn(rec, 21, NaN);
      if (ha) p.ha = ha;
      if (va) p.va = va;
    }
  }
  p.x = x; p.y = y;
  if (!p.s || !fin(x, y) || !(p.h > 0)) return null;
  return p;
}

function splinePrim(rec) {
  const c = rec.c, v = rec.v;
  const cx = [], cy = [], fx = [], fy = [], knots = [], wts = [];
  for (let i = 0; i < c.length; i++) {
    switch (c[i]) {
      case 10: cx.push(+v[i]); break;
      case 20: cy.push(+v[i]); break;
      case 11: fx.push(+v[i]); break;
      case 21: fy.push(+v[i]); break;
      case 40: knots.push(+v[i]); break;
      case 41: wts.push(+v[i]); break;
      default:
    }
  }
  const nc = Math.min(cx.length, cy.length), nf = Math.min(fx.length, fy.length);
  cx.length = cy.length = nc; fx.length = fy.length = nf;
  let pts = null;
  if (nc >= 2) pts = bspline(Math.trunc(gn(rec, 71, 3)), knots, cx, cy, wts.length === nc ? wts : null);
  if (!pts) {
    // B-spline kurulamadıysa: uyum (fit) noktaları, o da yoksa kontrol çokgeni (özgün araç davranışı)
    const sx = nf >= 2 ? fx : cx, sy = nf >= 2 ? fy : cy;
    pts = [];
    for (let i = 0; i < sx.length; i++) pts.push(sx[i], sy[i]);
  }
  if (pts.length < 4 || !finArr(pts)) return null;
  const p = common(rec, 'P');
  delete p.mx;
  p.v = pts;
  return p;
}

function ellipsePrim(rec) {
  const cx = gn(rec, 10, NaN), cy = gn(rec, 20, NaN), mx = gn(rec, 11, NaN), my = gn(rec, 21, NaN);
  const ratio = gn(rec, 40, 1);
  if (!fin(cx, cy, mx, my, ratio) || (mx === 0 && my === 0)) return null;
  const t0 = gn(rec, 41, 0);
  let span = gn(rec, 42, TAU) - t0;
  if (!(span > 1e-9)) span += TAU * Math.ceil((1e-9 - span) / TAU);
  const full = span >= TAU - 1e-9;
  if (full) span = TAU;
  const sg = gn(rec, 230, 1) < 0 ? -1 : 1; // normal −Z ise parametre yönü ters döner
  const nx = -my * ratio * sg, ny = mx * ratio * sg;
  const n = full ? 72 : Math.max(2, Math.ceil((72 * span) / TAU));
  const p = common(rec, 'P');
  delete p.mx;
  p.v = [];
  for (let k = 0; k < (full ? n : n + 1); k++) {
    const t = t0 + (span * k) / n, ct = Math.cos(t), st = Math.sin(t);
    p.v.push(cx + mx * ct + nx * st, cy + my * ct + ny * st);
  }
  if (full) p.closed = true;
  return p;
}

// HATCH sınır halkaları → köşe dizileri. Çoklu doğru ve kenar (doğru/yay/elips/spline) tipli sınırlar.
function hatchLoops(rec) {
  const c = rec.c, v = rec.v, loops = [];
  let i = c.indexOf(91);
  if (i < 0) return loops;
  const nLoops = +v[i++];
  for (let li = 0; li < nLoops && i < c.length; li++) {
    while (i < c.length && c[i] !== 92) i++;
    if (i >= c.length) break;
    const flag = +v[i++];
    let pts = null;
    if (flag & 2) {
      let nv = 0;
      while (i < c.length && (c[i] === 72 || c[i] === 73 || c[i] === 93)) { if (c[i] === 93) nv = +v[i]; i++; }
      const raw = [];
      for (let k = 0; k < nv && i < c.length && c[i] === 10; k++) {
        const x = +v[i++];
        let y = 0, b = 0;
        if (c[i] === 20) y = +v[i++];
        if (c[i] === 42) b = +v[i++];
        raw.push(x, y, b);
      }
      if (raw.length >= 6) pts = bulgePath(raw, true);
    } else {
      while (i < c.length && c[i] !== 93) i++;
      if (i >= c.length) break;
      const ne = +v[i++];
      pts = [];
      const add = (x, y) => {
        const m = pts.length;
        if (m && Math.abs(pts[m - 2] - x) < 1e-9 && Math.abs(pts[m - 1] - y) < 1e-9) return;
        pts.push(x, y);
      };
      for (let e = 0; e < ne && i < c.length && c[i] === 72; e++) {
        const et = +v[i++];
        if (et === 4) {
          // spline kenarı: 94 derece, 73, 74, 95 düğüm sayısı, 96 kontrol sayısı, 40×, (10,20[,42])×, [97 + (11,21)×], [12,22,13,23]
          let deg = 3, nk = 0, nc = 0;
          while (i < c.length && (c[i] === 94 || c[i] === 73 || c[i] === 74 || c[i] === 95 || c[i] === 96)) {
            if (c[i] === 94) deg = +v[i]; else if (c[i] === 95) nk = +v[i]; else if (c[i] === 96) nc = +v[i];
            i++;
          }
          const knots = [], sx = [], sy = [], sw = [];
          for (let k = 0; k < nk && c[i] === 40; k++) knots.push(+v[i++]);
          for (let k = 0; k < nc && c[i] === 10; k++) {
            sx.push(+v[i++]);
            sy.push(c[i] === 20 ? +v[i++] : 0);
            if (c[i] === 42) sw.push(+v[i++]);
          }
          // Kenarın kendi 97'si (uyum noktası sayısı) ile halka sonundaki 97 (kaynak nesne sayısı) ayrımı
          if (c[i] === 97 && (c[i + 1] === 11 || c[i + 1] === 97 || c[i + 1] === 72 || c[i + 1] === 12)) {
            const nf = +v[i++];
            for (let k = 0; k < nf && c[i] === 11; k++) { i++; if (c[i] === 21) i++; }
          }
          while (i < c.length && (c[i] === 12 || c[i] === 22 || c[i] === 13 || c[i] === 23)) i++;
          const sp = bspline(deg, knots, sx, sy, sw.length === sx.length ? sw : null);
          if (sp) for (let k = 0; k < sp.length; k += 2) add(sp[k], sp[k + 1]);
          else for (let k = 0; k < sx.length; k++) add(sx[k], sy[k]);
          continue;
        }
        const f = {};
        while (i < c.length && c[i] !== 72 && c[i] !== 97 && c[i] !== 92 && c[i] !== 75) { f[c[i]] = +v[i]; i++; }
        if (et === 1) { add(f[10], f[20]); add(f[11], f[21]); } else if (et === 2 || et === 3) {
          // Saat yönündeki (73=0) kenarlarda açılar X eksenine göre aynalı saklanır
          const ccw = f[73] !== 0;
          const a0 = (ccw ? f[50] : -f[50]) * D2R;
          let sw = normDeg(f[51] - f[50]) * D2R;
          if (sw === 0) sw = TAU;
          if (!ccw) sw = -sw;
          let ux, uy, wx, wy;
          if (et === 2) { ux = f[40]; uy = 0; wx = 0; wy = f[40]; } else { ux = f[11]; uy = f[21]; wx = -f[21] * f[40]; wy = f[11] * f[40]; }
          const n = Math.max(2, Math.ceil((72 * Math.abs(sw)) / TAU));
          for (let k = 0; k <= n; k++) {
            const a = a0 + (sw * k) / n, ca = Math.cos(a), sa = Math.sin(a);
            add(f[10] + ux * ca + wx * sa, f[20] + uy * ca + wy * sa);
          }
        }
      }
    }
    if (i < c.length && c[i] === 97) { const ns = +v[i++]; for (let k = 0; k < ns && c[i] === 330; k++) i++; }
    if (pts) {
      const m = pts.length;
      if (m >= 8 && Math.abs(pts[m - 2] - pts[0]) < 1e-9 && Math.abs(pts[m - 1] - pts[1]) < 1e-9) pts.length -= 2;
      if (pts.length >= 6 && finArr(pts)) loops.push(pts);
    }
  }
  return loops;
}

// Tek DXF kaydını ilkele/ilkellere çevirir. undefined = desteklenmeyen tip, null = geçersiz/boş nesne
function toPrim(rec) {
  switch (rec.type) {
    case 'LINE': {
      const p = common(rec, 'L');
      delete p.mx;
      p.x1 = gn(rec, 10, NaN); p.y1 = gn(rec, 20, NaN); p.x2 = gn(rec, 11, NaN); p.y2 = gn(rec, 21, NaN);
      return fin(p.x1, p.y1, p.x2, p.y2) ? p : null;
    }
    case 'POINT': {
      const p = common(rec, 'N');
      delete p.mx;
      p.x = gn(rec, 10, NaN); p.y = gn(rec, 20, NaN);
      return fin(p.x, p.y) ? p : null;
    }
    case 'CIRCLE': case 'ARC': {
      const p = common(rec, rec.type === 'ARC' ? 'A' : 'C');
      p.x = gn(rec, 10, NaN); p.y = gn(rec, 20, NaN); p.r = gn(rec, 40, NaN);
      if (!fin(p.x, p.y) || !(p.r > 0)) return null;
      if (p.k === 'A') { p.a1 = gn(rec, 50, 0); p.a2 = gn(rec, 51, 360); }
      return p;
    }
    case 'TEXT': case 'MTEXT': case 'ATTRIB':
      if (rec.type === 'ATTRIB' && (gn(rec, 70, 0) & 1)) return null; // görünmez öznitelik
      return textPrim(rec, rec.type);
    case 'LWPOLYLINE': return lwpolyline(rec);
    case 'SPLINE': return splinePrim(rec);
    case 'ELLIPSE': return ellipsePrim(rec);
    case 'LEADER': {
      const raw = [];
      for (let i = 0; i < rec.c.length; i++) {
        if (rec.c[i] === 10) raw.push(+rec.v[i], 0, 0);
        else if (rec.c[i] === 20 && raw.length) raw[raw.length - 2] = +rec.v[i];
      }
      return polyPrim(rec, raw, false, 0, true);
    }
    case 'SOLID': case 'TRACE': case '3DFACE': {
      const face = rec.type === '3DFACE';
      const v = [];
      for (const [cx, cy] of face ? [[10, 20], [11, 21], [12, 22], [13, 23]] : [[10, 20], [11, 21], [13, 23], [12, 22]]) {
        const x = gn(rec, cx, NaN), y = gn(rec, cy, NaN);
        if (!fin(x, y)) continue;
        const m = v.length;
        if (m && v[m - 2] === x && v[m - 1] === y) continue;
        v.push(x, y);
      }
      if (v.length >= 6 && v[v.length - 2] === v[0] && v[v.length - 1] === v[1]) v.length -= 2;
      if (v.length < 6) return null;
      const p = common(rec, face ? 'P' : 'F');
      p.v = v;
      if (face) { p.closed = true; delete p.mx; }
      return p;
    }
    case 'HATCH': {
      const loops = hatchLoops(rec);
      if (!loops.length) return null;
      const solid = gn(rec, 70, 0) === 1;
      return loops.map((v) => { const p = common(rec, 'F'); p.v = v; if (!solid) p.pat = 1; return p; });
    }
    case 'INSERT': case 'DIMENSION': {
      const p = common(rec, 'I');
      p.bn = name(rec, 2, '');
      if (!p.bn) return null;
      if (rec.type === 'DIMENSION') { delete p.mx; p.x = 0; p.y = 0; p.sx = 1; p.sy = 1; p.rot = 0; p.dim = true; return p; }
      p.x = gn(rec, 10, 0); p.y = gn(rec, 20, 0);
      p.sx = gn(rec, 41, 1); p.sy = gn(rec, 42, 1); p.rot = gn(rec, 50, 0);
      const nc = Math.trunc(gn(rec, 70, 1)), nr = Math.trunc(gn(rec, 71, 1));
      if (nc > 1 || nr > 1) { p.nc = Math.max(1, nc); p.nr = Math.max(1, nr); p.dc = gn(rec, 44, 0); p.dr = gn(rec, 45, 0); }
      return p;
    }
    default: return undefined;
  }
}

// Sessizce yok sayılan (uyarıya yazılmayan) kayıt tipleri
const QUIET = new Set(['SEQEND', 'ATTDEF', 'VIEWPORT', 'ENDSEC', 'EOF', 'VERTEX', 'ACAD_PROXY_ENTITY', 'OLE2FRAME']);

/* ------------------------------------------------------------------
   Ana okuyucu
   ------------------------------------------------------------------ */
export function parseDXF(src) {
  const u8 = toBytes(src);
  if (u8.length >= 18 && String.fromCharCode.apply(null, u8.subarray(0, 18)) === 'AutoCAD Binary DXF') {
    throw new Error('İkili (binary) DXF desteklenmiyor — dosyayı ASCII DXF olarak kaydedin.');
  }
  let txt;
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch { txt = decode1254(u8); }
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
  const L = txt.split(/\r\n?|\n/);
  txt = null;

  const warnings = [], stats = {}, unsupported = {};
  const layerDefs = new Map(); // ad → {aci, off}
  const blocks = new Map();    // AD (büyük harf) → {bx, by, prims}
  const top = [];              // üst düzey ilkeller (ENTITIES)
  let dom = null;
  let section = null, curBlock = null, openPl = null, rec = null;

  const sink = (p, type) => {
    if (p === undefined) { if (!QUIET.has(type)) unsupported[type] = (unsupported[type] || 0) + 1; return; }
    if (p === null) return;
    const dst = section === 'BLOCKS' ? (curBlock ? curBlock.prims : null) : section === 'ENTITIES' ? top : null;
    if (!dst) return;
    if (Array.isArray(p)) for (let i = 0; i < p.length; i++) dst.push(p[i]); else dst.push(p);
    if (dst === top) stats[type] = (stats[type] || 0) + 1;
  };

  const flush = () => {
    const r = rec;
    rec = null;
    if (!r) return;
    const t = r.type;
    if (t === 'SECTION') {
      if (section === 'HEADER') {
        // Özgün aracın kuralı: dilim orta meridyeni $USERI1 başlık değişkeninde taşınır
        for (let k = 0; k + 1 < r.c.length; k++) {
          if (r.c[k] === 9 && r.c[k + 1] === 70 && r.v[k].trim() === '$USERI1') {
            const dv = Math.round(+r.v[k + 1]);
            if (DOMS.indexOf(dv) >= 0) dom = dv;
            break;
          }
        }
      }
      return;
    }
    if (section === 'TABLES') {
      if (t === 'LAYER') {
        const nm = name(r, 2);
        if (nm !== undefined) {
          const col = Math.trunc(gn(r, 62, 7)), a = Math.abs(col);
          const d = { aci: a >= 1 && a <= 255 ? a : 7 };
          if (col < 0 || (gn(r, 70, 0) & 1)) d.off = true;
          layerDefs.set(nm, d);
        }
      }
      return;
    }
    if (section !== 'BLOCKS' && section !== 'ENTITIES') return;
    if (t === 'BLOCK') {
      curBlock = null;
      if (section === 'BLOCKS') {
        const nm = name(r, 2, '');
        curBlock = { bx: gn(r, 10, 0), by: gn(r, 20, 0), prims: [] };
        if (nm) blocks.set(nm.toUpperCase(), curBlock);
      }
      return;
    }
    // Açık eski tip POLYLINE, VERTEX olmayan ilk kayıtta (olağan durumda SEQEND) kapanır
    if (openPl && t !== 'VERTEX') {
      const pl = openPl;
      openPl = null;
      if (!pl.skip) sink(polyPrim(pl.rec, pl.raw, pl.closed, pl.w, (gn(pl.rec, 70, 0) & 8) !== 0), 'POLYLINE');
    }
    if (t === 'ENDBLK') { curBlock = null; return; }
    if (t === 'SEQEND') return;
    if (gn(r, 67, 0) === 1 && section === 'ENTITIES') { if (t === 'POLYLINE') openPl = { skip: true }; return; }
    if (t === 'POLYLINE') {
      const fl = gn(r, 70, 0);
      openPl = { rec: r, raw: [], skip: (fl & 80) !== 0, closed: (fl & 1) === 1, w: Math.max(gn(r, 40, 0), gn(r, 41, 0)) };
      if (openPl.skip) unsupported['POLYLINE (mesh)'] = (unsupported['POLYLINE (mesh)'] || 0) + 1;
      return;
    }
    if (t === 'VERTEX') {
      if (openPl && !openPl.skip && !(gn(r, 70, 0) & 16)) { // 16: spline çerçeve kontrol noktası
        const x = gn(r, 10, NaN), y = gn(r, 20, NaN);
        if (fin(x, y)) {
          openPl.raw.push(x, y, gn(r, 42, 0));
          const w = Math.max(gn(r, 40, 0), gn(r, 41, 0));
          if (w > openPl.w) openPl.w = w;
        }
      }
      return;
    }
    sink(toPrim(r), t);
  };

  for (let i = 0, n = L.length - 1; i < n; i += 2) {
    const code = parseInt(L[i], 10);
    if (code === 0) {
      flush();
      const vt = L[i + 1].trim();
      if (vt === 'ENDSEC') { section = null; curBlock = null; openPl = null; continue; }
      if (vt === 'EOF') break;
      rec = { type: vt, c: [], v: [] };
      continue;
    }
    if (!rec) continue;
    if (code === 2 && rec.type === 'SECTION' && rec.c.length === 0) section = L[i + 1].trim().toUpperCase();
    if (code !== code) continue; // NaN: bozuk satır çifti
    rec.c.push(code);
    rec.v.push(L[i + 1]);
  }
  flush();

  /* ---- çözümleme: tabaka, renk, blok patlatma ---- */
  const ents = [], layers = [], layerIdx = new Map();
  const missing = new Set();
  let capped = false;
  const lid = (nm) => {
    let i = layerIdx.get(nm);
    if (i === undefined) {
      i = layers.length;
      const d = layerDefs.get(nm), o = { name: nm, aci: d ? d.aci : 7 };
      if (d && d.off) o.off = true;
      layers.push(o);
      layerIdx.set(nm, i);
    }
    return i;
  };
  const layerAci = (nm) => { const d = layerDefs.get(nm); return d ? d.aci : 7; };
  const ap = (M, v) => {
    if (!M) return v;
    const o = new Array(v.length);
    for (let i = 0; i + 1 < v.length; i += 2) { o[i] = M[0] * v[i] + M[2] * v[i + 1] + M[4]; o[i + 1] = M[1] * v[i] + M[3] * v[i + 1] + M[5]; }
    return o;
  };

  // ctx: blok içindeysek {lay: INSERT'in tabaka adı, col: INSERT'in çözülmüş rengi}; üst düzeyde null
  const emit = (p, M, ctx, depth, stack) => {
    if (ents.length >= MAX_ENTS) { capped = true; return; }
    const lay = ctx && p.lay === '0' ? ctx.lay : p.lay;
    let c;
    if (p.col === null) c = layerAci(lay);
    else if (p.col === 0) c = ctx ? ctx.col : 7;
    else { c = Math.abs(p.col); if (c > 255) c = 7; }
    if (p.mx) M = M ? mul(M, MIRX) : MIRX;

    if (p.k === 'I') {
      const b = blocks.get(p.bn.toUpperCase());
      if (!b) {
        if (!p.dim) { missing.add(p.bn); const q = ap(M, [p.x, p.y]); ents.push({ t: 'N', l: lid(lay), c, x: q[0], y: q[1] }); }
        return;
      }
      if (depth >= MAX_DEPTH || stack.indexOf(b) >= 0) return; // aşırı derin ya da kendine başvuran blok
      const sub = { lay, col: c };
      stack.push(b);
      const nc = p.nc || 1, nr = p.nr || 1;
      for (let ir = 0; ir < nr; ir++) {
        for (let ic = 0; ic < nc; ic++) {
          const Mi = insertMatrix(p.x, p.y, p.rot, p.sx, p.sy, b.bx, b.by, ic * (p.dc || 0), ir * (p.dr || 0));
          const T = M ? mul(M, Mi) : Mi;
          for (let k = 0; k < b.prims.length; k++) emit(b.prims[k], T, sub, depth + 1, stack);
        }
      }
      stack.pop();
      return;
    }

    const e = { t: p.k, l: lid(lay), c };
    switch (p.k) {
      case 'L': {
        const q = ap(M, [p.x1, p.y1, p.x2, p.y2]);
        e.x1 = q[0]; e.y1 = q[1]; e.x2 = q[2]; e.y2 = q[3];
        break;
      }
      case 'P':
        e.v = ap(M, p.v); e.closed = !!p.closed;
        if (p.w) e.w = M ? p.w * Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) : p.w;
        break;
      case 'F':
        e.v = ap(M, p.v);
        if (p.pat) e.pat = 1;
        break;
      case 'N': {
        const q = ap(M, [p.x, p.y]);
        e.x = q[0]; e.y = q[1];
        break;
      }
      case 'C': case 'A': {
        const sim = M ? similarity(M) : null;
        if (M && !sim) {
          // Eşit olmayan ölçek: daire/yay elipse dönüşür → çoklu doğru
          const full = p.k === 'C';
          e.t = 'P';
          const v = arcPoints(p.x, p.y, p.r, full ? 0 : p.a1, full ? 360 : p.a2, full ? 72 : 0);
          if (full) v.length -= 2;
          e.v = ap(M, v); e.closed = full;
          break;
        }
        const q = ap(M, [p.x, p.y]);
        e.x = q[0]; e.y = q[1]; e.r = sim ? p.r * sim.s : p.r;
        if (p.k === 'A') {
          if (!sim) { e.a1 = normDeg(p.a1); e.a2 = normDeg(p.a2); }
          // Aynalı dönüşümde α yönü (rot − α)'ya gider ve dolanım yönü ters döner → uçlar yer değiştirir
          else if (sim.mir) { e.a1 = normDeg(sim.rot - p.a2); e.a2 = normDeg(sim.rot - p.a1); }
          else { e.a1 = normDeg(p.a1 + sim.rot); e.a2 = normDeg(p.a2 + sim.rot); }
        }
        break;
      }
      case 'T': {
        const q = ap(M, [p.x, p.y]);
        e.x = q[0]; e.y = q[1];
        if (M) {
          const cr = Math.cos(p.rot * D2R), sr = Math.sin(p.rot * D2R);
          // taban çizgisi yönü ve ona dik (yükseklik) yönün dönüşmüş boyu
          e.h = p.h * Math.hypot(-M[0] * sr + M[2] * cr, -M[1] * sr + M[3] * cr);
          e.rot = normDeg(Math.atan2(M[1] * cr + M[3] * sr, M[0] * cr + M[2] * sr) * R2D);
        } else { e.h = p.h; e.rot = normDeg(p.rot); }
        e.s = p.s;
        if (p.ha) e.ha = p.ha;
        if (p.va) e.va = p.va;
        break;
      }
      default: return;
    }
    ents.push(e);
  };

  const stack = [];
  for (let i = 0; i < top.length; i++) emit(top[i], null, null, 0, stack);

  const un = Object.keys(unsupported);
  if (un.length) warnings.push('Desteklenmeyen DXF nesneleri atlandı: ' + un.map((k) => k + '×' + unsupported[k]).join(', '));
  if (missing.size) warnings.push('Tanımı bulunamayan blok(lar) nokta olarak gösterildi: ' + [...missing].slice(0, 12).join(', ') + (missing.size > 12 ? '…' : ''));
  if (capped) warnings.push('Çizim çok büyük: ilk ' + MAX_ENTS + ' nesneden sonrası atlandı.');

  return { format: 'DXF', ents, layers, bbox: entsBBox(ents), dom, warnings, stats };
}
