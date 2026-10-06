// CAD altlık okuma (DXF + Netcad NCZ) ve harita üzerinde kullanım için geometri yardımcıları.
//
// Birleşik model (düz JSON; tüm okuyucular aynı biçimi döndürür):
//   { format:'DXF'|'NCZ', ents:[…], layers:[{name, aci, off?}], bbox:{minE,minN,maxE,maxN}|null,
//     dom:number|null, warnings:[string], stats:{LINE:n,…} }
// Nesneler (x = doğu/sağa, y = kuzey/yukarı, metre; açılar derece, doğudan saat yönü tersine;
//           l = layers indeksi; c = çözülmüş ACI renk no 1..255):
//   {t:'L', l, c, x1,y1,x2,y2}            doğru
//   {t:'P', l, c, v:[x0,y0,x1,y1,…], closed, w?}   çoklu doğru (bulge'lar kirişlere bölünmüş; w = kalınlık)
//   {t:'C', l, c, x,y,r}                  daire
//   {t:'A', l, c, x,y,r,a1,a2}            yay: a1'den a2'ye saat yönü tersine (a2 ≤ a1 ise +360)
//   {t:'T', l, c, x,y,h,rot,s, ha?,va?}   yazı (ha: 1 orta, 2 sağ, 4 tam orta; va: 1 alt, 2 orta, 3 üst)
//   {t:'F', l, c, v:[…], pat?}            dolu çokgen (pat=1: desenli tarama — yarı saydam çizilmesi önerilir)
//   {t:'N', l, c, x,y, name?,z?,sym?}     nokta (NCZ: nokta adı/kotu; sembol konumlarında sym = sembol no)
// Tüm yardımcılar isteğe bağlı `hidden: Set<number>` (yok sayılacak tabaka indeksleri) kabul eder.

import { parseDXF, entsBBox, normDeg } from './dxf.js';
import { parseNCZ } from './ncz.js';

export { parseDXF } from './dxf.js';
export { parseNCZ } from './ncz.js';
export { ACI_RGB, aciCSS } from './aci.js';
export { KNOWN_SYMBOLS } from './symbols.js';

const R2D = 180 / Math.PI;

// Dosya adının uzantısına göre (.dxf / .ncz, büyük-küçük harf duyarsız) okur.
export function parseCad(bytes, filename) {
  const m = /\.([A-Za-z0-9]+)\s*$/.exec(String(filename == null ? '' : filename));
  const ext = m ? m[1].toLowerCase() : '';
  let model;
  if (ext === 'dxf') model = parseDXF(bytes);
  else if (ext === 'ncz') model = parseNCZ(bytes);
  else {
    const err = new Error('Desteklenmeyen dosya türü' + (ext ? ' (.' + ext + ')' : '') + ' — yalnızca .dxf ve .ncz dosyaları açılabilir.');
    err.code = 'CAD_EXT';
    throw err;
  }
  if (!model.ents.length) {
    const err = new Error(model.format === 'DXF'
      ? 'Bu DXF içinde çizilebilir nesne bulunamadı.'
      : 'Bu NCZ çözülemedi: okunabilir nesne bulunamadı. Dosya bozuk ya da desteklenmeyen bir Netcad sürümünden olabilir.');
    err.code = 'CAD_EMPTY';
    err.warnings = model.warnings;
    throw err;
  }
  return model;
}

const hiddenSet = (h) => (h && typeof h.has === 'function' && h.size ? h : null);

// Çizimin sınır kutusu; gizli tabaka verilirse yalnız görünen nesnelerden yeniden hesaplanır.
export function cadBBox(model, hidden) {
  const h = hiddenSet(hidden);
  if (!h && model.bbox !== undefined) return model.bbox;
  return entsBBox(model.ents, h);
}

/* ------------------------------------------------------------------
   Yakalama (snap) adayları ve ızgara indeksi
   ------------------------------------------------------------------ */
export const SNAP_KINDS = ['end', 'vertex', 'center', 'text', 'point'];
const K_END = 0, K_VERTEX = 1, K_CENTER = 2, K_TEXT = 3, K_POINT = 4;
const CACHE_KEY = '_snapIndex';
const fallbackCache = new WeakMap(); // dondurulmuş (frozen) modeller için

function buildSnapIndex(model) {
  const ents = model.ents;
  let n = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.t === 'L') n += 2; else if (e.t === 'P') n += e.v.length >> 1; else if (e.t !== 'F') n++;
  }
  const pts = new Float64Array(4 * n); // [x, y, tür, nesne indeksi]
  let o = 0;
  const put = (x, y, k, i) => { pts[o] = x; pts[o + 1] = y; pts[o + 2] = k; pts[o + 3] = i; o += 4; };
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    switch (e.t) {
      case 'L': put(e.x1, e.y1, K_END, i); put(e.x2, e.y2, K_END, i); break;
      case 'P': { const v = e.v; for (let k = 0; k + 1 < v.length; k += 2) put(v[k], v[k + 1], K_VERTEX, i); break; }
      case 'C': case 'A': put(e.x, e.y, K_CENTER, i); break;
      case 'T': put(e.x, e.y, K_TEXT, i); break;
      case 'N': put(e.x, e.y, K_POINT, i); break;
      default:
    }
  }
  const ix = { ents, count: ents.length, pts, n, nx: 0, ny: 0, cell: 1, gx: 0, gy: 0, start: null, order: null, over: null };
  if (!n) return ix;

  // Izgara kapsamı: örneklenmiş %1–%99 aralığı (yarı genişlik kadar pay ile). Çok uzaktaki tek tük
  // aykırı noktalar ızgarayı şişirmesin diye kapsam dışındakiler ayrı (doğrusal taranan) listeye alınır.
  const step = Math.max(1, Math.floor(n / 4000));
  const sx = [], sy = [];
  for (let i = 0; i < n; i += step) { sx.push(pts[4 * i]); sy.push(pts[4 * i + 1]); }
  sx.sort((a, b) => a - b); sy.sort((a, b) => a - b);
  const q = (a, f) => a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))];
  let x0 = q(sx, 0.01), x1 = q(sx, 0.99), y0 = q(sy, 0.01), y1 = q(sy, 0.99);
  const mx = (x1 - x0) * 0.5 + 1e-6, my = (y1 - y0) * 0.5 + 1e-6;
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;
  const w = x1 - x0, h = y1 - y0;
  const cells = Math.min(1 << 20, Math.max(1, Math.ceil(n / 3)));
  // Tek boyuta yayılmış (doğrusal) noktalarda hücre sayısı patlamasın diye alt sınır: uzun kenar / hücre sayısı
  let cell = Math.max(Math.sqrt((w * h) / cells), Math.max(w, h) / cells);
  if (!(cell > 0)) cell = 1;
  let nx = Math.floor(w / cell) + 1, ny = Math.floor(h / cell) + 1;
  while (nx * ny > 4000000) { cell *= 2; nx = Math.floor(w / cell) + 1; ny = Math.floor(h / cell) + 1; }
  const cellOf = new Int32Array(n), start = new Int32Array(nx * ny + 1), over = [];
  for (let i = 0; i < n; i++) {
    const px = pts[4 * i], py = pts[4 * i + 1];
    if (!(px >= x0 && px <= x1 && py >= y0 && py <= y1)) { cellOf[i] = -1; over.push(i); continue; }
    const c = Math.floor((py - y0) / cell) * nx + Math.floor((px - x0) / cell);
    cellOf[i] = c; start[c + 1]++;
  }
  for (let c = 0; c < nx * ny; c++) start[c + 1] += start[c];
  const fill = start.slice(0, nx * ny), order = new Int32Array(n - over.length);
  for (let i = 0; i < n; i++) if (cellOf[i] >= 0) order[fill[cellOf[i]]++] = i;
  ix.nx = nx; ix.ny = ny; ix.cell = cell; ix.gx = x0; ix.gy = y0; ix.start = start; ix.order = order; ix.over = Int32Array.from(over);
  return ix;
}

function snapIndex(model) {
  let ix = model[CACHE_KEY] || fallbackCache.get(model);
  if (ix && ix.ents === model.ents && ix.count === model.ents.length) return ix;
  ix = buildSnapIndex(model);
  try {
    Object.defineProperty(model, CACHE_KEY, { value: ix, enumerable: false, configurable: true, writable: true });
  } catch { fallbackCache.set(model, ix); }
  return ix;
}

// Yakalama adayları: 4'lü adımlı Float64Array [x, y, tür, nesneİndeksi, …]; tür → SNAP_KINDS indeksi.
// Doğru uçları ('end'), çoklu doğru köşeleri ('vertex'), daire/yay merkezleri ('center'),
// yazı ekleme noktaları ('text') ve noktalar ('point').
export function snapCandidates(model, hidden) {
  const ix = snapIndex(model), h = hiddenSet(hidden);
  if (!h) return ix.pts;
  const ents = model.ents, src = ix.pts, out = new Float64Array(src.length);
  let o = 0;
  for (let i = 0; i < src.length; i += 4) {
    if (h.has(ents[src[i + 3]].l)) continue;
    out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = src[i + 3]; o += 4;
  }
  return out.slice(0, o);
}

// (x,y)'ye en yakın yakalama adayı: {x, y, kind, ent (model.ents indeksi), d (uzaklık)} | null
export function nearestSnap(model, x, y, maxDist = Infinity, hidden) {
  const ix = snapIndex(model);
  if (!ix.n || !(maxDist >= 0)) return null;
  const h = hiddenSet(hidden), ents = model.ents, pts = ix.pts;
  let best = -1, bd2 = maxDist * maxDist;
  const tryPt = (i) => {
    const dx = pts[4 * i] - x, dy = pts[4 * i + 1] - y, d2 = dx * dx + dy * dy;
    if (d2 > bd2 || (d2 === bd2 && best >= 0)) return;
    if (h && h.has(ents[pts[4 * i + 3]].l)) return;
    bd2 = d2; best = i;
  };
  for (let k = 0; k < ix.over.length; k++) tryPt(ix.over[k]);

  // Halka halka genişleyen ızgara taraması: k. halkadaki noktalar sorgudan en az (k−1)·hücre uzaktadır
  const { nx, ny, cell, start, order } = ix;
  const qx = Math.floor((x - ix.gx) / cell), qy = Math.floor((y - ix.gy) / cell);
  const k0 = Math.max(0, -qx, qx - (nx - 1), -qy, qy - (ny - 1));
  const kMax = Math.max(Math.abs(qx), Math.abs(qx - (nx - 1)), Math.abs(qy), Math.abs(qy - (ny - 1)));
  const scan = (cx, cy) => {
    const c = cy * nx + cx;
    for (let s = start[c], e = start[c + 1]; s < e; s++) tryPt(order[s]);
  };
  for (let k = k0; k <= kMax; k++) {
    const lo = (k - 1) * cell;
    if (lo > 0 && lo * lo > bd2) break;
    const ya = Math.max(0, qy - k), yb = Math.min(ny - 1, qy + k);
    const xa = Math.max(0, qx - k), xb = Math.min(nx - 1, qx + k);
    for (let cy = ya; cy <= yb; cy++) {
      if (cy === qy - k || cy === qy + k) { for (let cx = xa; cx <= xb; cx++) scan(cx, cy); } else {
        if (qx - k >= 0 && qx - k < nx) scan(qx - k, cy);
        if (k > 0 && qx + k >= 0 && qx + k < nx) scan(qx + k, cy);
      }
    }
  }
  if (best < 0) return null;
  return { x: pts[4 * best], y: pts[4 * best + 1], kind: SNAP_KINDS[pts[4 * best + 2]], ent: pts[4 * best + 3], d: Math.sqrt(bd2) };
}

/* ------------------------------------------------------------------
   Düğümden çıkan hat kolları
   ------------------------------------------------------------------ */
// (x,y) düğümünden çıkan hat yönleri. Ucu tol içinde olan her doğru ve tol içindeki her çoklu doğru
// köşesi için (önceki ve sonraki parça ayrı kol; kapalı çoklu doğruda başa sarar):
//   {az, len, layer, l, c} — az: düğümden karşı uca yön (derece, 0 = doğu, saat yönü tersine, [0,360)),
//   len: parça boyu (m), layer: tabaka adı, l: tabaka indeksi, c: ACI renk.
// Aynı tabakada az farkı ≤ 1° olan kollar birleştirilir (uzun olan kalır); sonuç az'a göre sıralıdır.
// opts: gizli tabaka kümesi (Set) ya da {hidden, through}. through=true ise düğümün üzerinden kesintisiz
// geçen (düğümde köşesi olmayan) parçalar da iki yöne birer kol olarak sayılır.
export function armsAt(model, x, y, tol = 0.5, opts) {
  const isSet = opts && typeof opts.has === 'function';
  const h = hiddenSet(isSet ? opts : opts && opts.hidden);
  const through = !isSet && !!(opts && opts.through);
  const ents = model.ents, layers = model.layers || [], t2 = tol * tol, arms = [];
  const near = (px, py) => { const dx = px - x, dy = py - y; return dx * dx + dy * dy <= t2; };
  const add = (fx, fy, tx, ty, e) => {
    const dx = tx - fx, dy = ty - fy, len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) return;
    arms.push({ az: normDeg(Math.atan2(dy, dx) * R2D), len, layer: layers[e.l] ? layers[e.l].name : '', l: e.l, c: e.c });
  };
  // Düğüm, parçanın iç kısmına (uçlar hariç) tol içinde düşüyorsa izdüşümden iki uca birer kol
  const pass = (ax, ay, bx, by, e) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (!(l2 > 0)) return;
    const t = ((x - ax) * dx + (y - ay) * dy) / l2;
    if (!(t > 0 && t < 1)) return;
    const px = ax + t * dx, py = ay + t * dy;
    if (!near(px, py)) return;
    add(px, py, ax, ay, e); add(px, py, bx, by, e);
  };
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (h && h.has(e.l)) continue;
    if (e.t === 'L') {
      const n1 = near(e.x1, e.y1), n2 = near(e.x2, e.y2);
      if (n1 && n2) continue;
      if (n1) add(e.x1, e.y1, e.x2, e.y2, e);
      else if (n2) add(e.x2, e.y2, e.x1, e.y1, e);
      else if (through) pass(e.x1, e.y1, e.x2, e.y2, e);
    } else if (e.t === 'P') {
      const v = e.v;
      let n = v.length >> 1;
      const closed = !!e.closed;
      if (closed && n > 1 && v[0] === v[2 * n - 2] && v[1] === v[2 * n - 1]) n--;
      if (n < 2) continue;
      const nSeg = closed ? n : n - 1;
      let any = false, all = true;
      for (let k = 0; k < n; k++) { if (near(v[2 * k], v[2 * k + 1])) any = true; else all = false; }
      if (all) continue;
      if (any) {
        // tol içindeki ardışık köşe öbekleri: öbeğin ilk köşesinden geriye, son köşesinden ileriye birer kol
        for (let k = 0; k < n; k++) {
          if (!near(v[2 * k], v[2 * k + 1])) continue;
          const pk = k > 0 ? k - 1 : closed ? n - 1 : -1;
          const nk = k < n - 1 ? k + 1 : closed ? 0 : -1;
          if (pk >= 0 && !near(v[2 * pk], v[2 * pk + 1])) add(v[2 * k], v[2 * k + 1], v[2 * pk], v[2 * pk + 1], e);
          if (nk >= 0 && !near(v[2 * nk], v[2 * nk + 1])) add(v[2 * k], v[2 * k + 1], v[2 * nk], v[2 * nk + 1], e);
        }
      }
      if (through) {
        for (let k = 0; k < nSeg; k++) {
          const a = 2 * k, b = 2 * ((k + 1) % n);
          if (near(v[a], v[a + 1]) || near(v[b], v[b + 1])) continue;
          pass(v[a], v[a + 1], v[b], v[b + 1], e);
        }
      }
    }
  }
  const out = [];
  for (const a of arms) {
    let dup = null;
    for (const o of out) {
      if (o.l !== a.l) continue;
      const d = Math.abs(o.az - a.az);
      if (Math.min(d, 360 - d) <= 1) { dup = o; break; }
    }
    if (!dup) out.push(a);
    else if (a.len > dup.len) { dup.len = a.len; dup.az = a.az; dup.c = a.c; }
  }
  return out.sort((p, q) => p.az - q.az);
}
