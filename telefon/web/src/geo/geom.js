// Düzlem (proje CRS, metre) geometri servisi: mesafe, semt, açı, alan, ofset, bölme, yakalama.
const R2D = 180 / Math.PI, D2R = Math.PI / 180;

export const dist2 = (a, b) => Math.hypot(b.E - a.E, b.N - a.N);
export const dist3 = (a, b) => Math.hypot(b.E - a.E, b.N - a.N, (b.H ?? 0) - (a.H ?? 0));
// Grid semti: kuzeyden saat yönünde (0–360°)
export function bearing(a, b) { let t = Math.atan2(b.E - a.E, b.N - a.N) * R2D; if (t < 0) t += 360; return t; }
export function bearingGrad(a, b) { return bearing(a, b) * 400 / 360; }

// Köşe açısı: β iç açı (0–180), α sapma = 180 − β, yön: +sağ / −sol (ilerleme yönüne göre)
export function deflection(prev, cur, next) {
  const b1 = bearing(prev, cur), b2 = bearing(cur, next);
  let d = b2 - b1;
  while (d > 180) d -= 360; while (d < -180) d += 360;
  const alpha = Math.abs(d);
  return { alpha, beta: 180 - alpha, side: d > 0 ? 'sağ' : d < 0 ? 'sol' : '' };
}

export function segProject(p, a, b) {
  const dx = b.E - a.E, dy = b.N - a.N, L2 = dx * dx + dy * dy;
  let t = L2 ? ((p.E - a.E) * dx + (p.N - a.N) * dy) / L2 : 0;
  const tc = Math.max(0, Math.min(1, t));
  const foot = { E: a.E + tc * dx, N: a.N + tc * dy };
  const cross = dx * (p.N - a.N) - dy * (p.E - a.E); // + sol, − sağ
  return { t, tc, foot, dist: Math.hypot(p.E - foot.E, p.N - foot.N), side: cross > 0 ? 'sol' : cross < 0 ? 'sağ' : '', signed: L2 ? -cross / Math.sqrt(L2) : 0 };
}
// Çizgiye göre konum: en yakın parça, kilometre (chainage), sağ/sol eksen ofseti
export function polylineLocate(p, pts) {
  let best = null, ch = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = segProject(p, pts[i], pts[i + 1]);
    const L = dist2(pts[i], pts[i + 1]);
    if (!best || r.dist < best.dist) best = Object.assign(r, { index: i, chainage: ch + r.tc * L });
    ch += L;
  }
  return best;
}
export function polylineLength(pts, use3d = false) {
  let s = 0; for (let i = 0; i < pts.length - 1; i++) s += use3d ? dist3(pts[i], pts[i + 1]) : dist2(pts[i], pts[i + 1]); return s;
}
export function polygonArea(pts) {
  let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.E * b.N - b.E * a.N; }
  return Math.abs(s) / 2;
}
// Paralel ofset (+sağ / −sol), köşelerde kesişim (miter)
export function offsetPolyline(pts, d) {
  if (pts.length < 2) return pts.slice();
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = dist2(a, b) || 1;
    const nx = (b.N - a.N) / L, ny = -(b.E - a.E) / L; // sağa dik
    segs.push([{ E: a.E + nx * d, N: a.N + ny * d }, { E: b.E + nx * d, N: b.N + ny * d }]);
  }
  const out = [segs[0][0]];
  for (let i = 0; i < segs.length - 1; i++) {
    const X = intersect(segs[i][0], segs[i][1], segs[i + 1][0], segs[i + 1][1]);
    out.push(X || segs[i][1]);
  }
  out.push(segs[segs.length - 1][1]);
  return out;
}
export function intersect(a, b, c, d) {
  const r = { E: b.E - a.E, N: b.N - a.N }, s = { E: d.E - c.E, N: d.N - c.N };
  const den = r.E * s.N - r.N * s.E;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.E - a.E) * s.N - (c.N - a.N) * s.E) / den;
  return { E: a.E + t * r.E, N: a.N + t * r.N };
}
// Kutupsal nokta (semt + mesafe)
export function polar(p, azDeg, d) { return { E: p.E + d * Math.sin(azDeg * D2R), N: p.N + d * Math.cos(azDeg * D2R) }; }

// Yakalama: düğüm öncelikli, sonra parça üzeri
export function snap(p, nodes, segments, tol) {
  let best = null;
  for (const n of nodes) { const d = dist2(p, n); if (d <= tol && (!best || d < best.d)) best = { kind: 'node', ref: n, pt: { E: n.E, N: n.N }, d }; }
  if (best) return best;
  for (const s of segments) {
    const r = segProject(p, s.a, s.b);
    if (r.dist <= tol && r.t > 0 && r.t < 1 && (!best || r.dist < best.d)) best = { kind: 'segment', ref: s, pt: r.foot, d: r.dist, t: r.t };
  }
  return best;
}

export function bbox(pts) {
  if (!pts.length) return null;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of pts) { if (p.E < a) a = p.E; if (p.N < b) b = p.N; if (p.E > c) c = p.E; if (p.N > d) d = p.N; }
  return { minE: a, minN: b, maxE: c, maxN: d };
}

// ---- Biçimlendirme ----
export function dms(deg, sec = false) {
  const s = deg < 0 ? '-' : ''; let x = Math.abs(deg);
  let d = Math.floor(x); let m = (x - d) * 60; let mi = Math.floor(m); let ss = (m - mi) * 60;
  if (!sec) { mi = Math.round(m); if (mi === 60) { d++; mi = 0; } return s + d + '° ' + String(mi).padStart(2, '0') + '′'; }
  ss = Math.round(ss * 10) / 10; if (ss >= 60) { ss = 0; mi++; } if (mi >= 60) { mi = 0; d++; }
  return s + d + '° ' + String(mi).padStart(2, '0') + '′ ' + ss.toFixed(1).padStart(4, '0') + '″';
}
export const fm = (v, d = 3) => (v === null || v === undefined || !Number.isFinite(+v) ? '—' : (+v).toFixed(d));
export const trNum = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(+v) ? '—' : (+v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));
