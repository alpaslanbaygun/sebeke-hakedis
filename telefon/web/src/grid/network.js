// Şebeke geometrisi ve topolojisi: açıklıklar, direk rolleri/köşe açıları, bağlantı grafiği.
// Girdi: noktalar, ekipmanlar, hatlar (hat düğümleri = nokta kimlikleri). Çıktı: türetilmiş kayıtlar.
import { dist2, dist3, bearing, deflection } from '../geo/geom.js';

export function indexModel(m) {
  const pts = new Map(m.points.filter((p) => p.status !== 'deleted').map((p) => [p.id, p]));
  const eqByPoint = new Map();
  for (const e of m.equipment) if (e.status !== 'deleted' && e.pointId) { if (!eqByPoint.has(e.pointId)) eqByPoint.set(e.pointId, []); eqByPoint.get(e.pointId).push(e); }
  const lines = m.lines.filter((l) => l.status !== 'deleted');
  const linesByPoint = new Map();
  for (const l of lines) (l.nodes || []).forEach((pid, i) => {
    if (!linesByPoint.has(pid)) linesByPoint.set(pid, []);
    linesByPoint.get(pid).push({ line: l, index: i });
  });
  return { pts, eqByPoint, lines, linesByPoint };
}

const P = (p) => ({ E: p.E, N: p.N, H: p.H ?? p.h ?? 0 });

// Açıklıklar (hat düğümleri arasındaki her parça)
export function computeSpans(m, ix) {
  const spans = [];
  for (const l of ix.lines) {
    const nodes = l.nodes || [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = ix.pts.get(nodes[i]), b = ix.pts.get(nodes[i + 1]);
      if (!a || !b) continue;
      const pa = P(a), pb = P(b);
      const ov = (l.spanOverrides || {})[nodes[i] + '>' + nodes[i + 1]] || {};
      spans.push({
        id: 'SP:' + l.id + ':' + nodes[i] + '>' + nodes[i + 1], projectId: l.projectId, lineId: l.id, lineNo: l.lineNo, seq: i,
        fromId: nodes[i], toId: nodes[i + 1], fromNo: a.pointNo, toNo: b.pointNo,
        length2D: dist2(pa, pb), length3D: dist3(pa, pb), dH: pb.H - pa.H, bearing: bearing(pa, pb),
        lineType: l.lineType, install: l.install, state: l.state || 'YENI',
        tempC: ov.tempC ?? null, tensionDaN: ov.tensionDaN ?? null, note: ov.note || '',
        source: (a.source === 'GNSS_RTK' && b.source === 'GNSS_RTK') ? 'GNSS' : 'GIS'
      });
    }
  }
  return spans;
}

// Direk rolü: Taşıyıcı (T) · Durdurucu (D) · Nihayet (N) · Köşe (Z); köşe açısı otomatik
export function computePoleRoles(m, ix, opts = {}) {
  const thr = opts.cornerThresholdDeg ?? 3;
  const out = new Map();
  for (const e of m.equipment) {
    if (e.status === 'deleted' || (e.kind !== 'pole' && e.kind !== 'lighting')) continue;
    const refs = (ix.linesByPoint.get(e.pointId) || []).filter((r) => r.line.install !== 'yeralti');
    let maxAlpha = 0, side = '', ends = 0, interior = 0, beta = null;
    for (const r of refs) {
      const n = r.line.nodes;
      if (r.index === 0 || r.index === n.length - 1) { ends++; continue; }
      interior++;
      const a = ix.pts.get(n[r.index - 1]), c = ix.pts.get(e.pointId), b = ix.pts.get(n[r.index + 1]);
      if (!a || !b || !c) continue;
      const d = deflection(P(a), P(c), P(b));
      if (d.alpha > maxAlpha) { maxAlpha = d.alpha; side = d.side; beta = d.beta; }
    }
    let role = 'T', why = 'Hat üzerinde düz geçiş';
    if (!refs.length) { role = null; why = 'Hat bağlantısı yok'; }
    else if (ends > 0 && interior === 0) { role = ends === 1 ? 'N' : 'D'; why = ends === 1 ? 'Hat sonu (nihayet)' : 'İki hat birleşimi'; }
    else if (ends > 0 && interior > 0) { role = 'D'; why = 'Branşman (ayrılma) direği'; }
    else if (maxAlpha > thr) { role = 'Z'; why = 'Sapma açısı ' + maxAlpha.toFixed(2) + '° > ' + thr + '°'; }
    const final = e.roleManual || role;
    out.set(e.id, { autoRole: role, role: final, manual: !!e.roleManual, angle: interior ? maxAlpha : null, beta, side, why, lineCount: refs.length });
  }
  return out;
}

// Hat üzerindeki toplam uzunluklar
export function lineLengths(spans) {
  const r = new Map();
  for (const s of spans) {
    const x = r.get(s.lineId) || { l2: 0, l3: 0, spans: 0 };
    x.l2 += s.length2D; x.l3 += s.length3D; x.spans++;
    r.set(s.lineId, x);
  }
  return r;
}

// Bağlantı grafiği + yukarı akış izleme (Abone → SDK → AG hat → Trafo → OG hat → kaynak)
export function buildGraph(m, ix) {
  const adj = new Map();
  const add = (a, b, via) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, via }); };
  for (const l of ix.lines) {
    const n = l.nodes || [];
    for (let i = 0; i < n.length - 1; i++) { add(n[i], n[i + 1], l); add(n[i + 1], n[i], l); }
  }
  return adj;
}
export function traceUpstream(m, ix, startPointId) {
  // En kısa yol ile besleme kaynağına (indirici / OG hat başı işaretli nokta) doğru iz
  const adj = buildGraph(m, ix);
  const isSource = (pid) => (ix.eqByPoint.get(pid) || []).some((e) => e.kind === 'substation' || (e.attrs && e.attrs.source));
  const prev = new Map([[startPointId, null]]);
  const q = [startPointId];
  let found = null;
  while (q.length) {
    const u = q.shift();
    if (isSource(u) && u !== startPointId) { found = u; break; }
    for (const e of adj.get(u) || []) if (!prev.has(e.to)) { prev.set(e.to, { from: u, via: e.via }); q.push(e.to); }
  }
  const chain = [];
  let cur = found || [...prev.keys()].pop();
  while (cur) {
    const p = ix.pts.get(cur);
    const eqs = ix.eqByPoint.get(cur) || [];
    const pr = prev.get(cur);
    chain.unshift({ pointId: cur, no: p ? p.pointNo : cur, eq: eqs.map((e) => e.kind), via: pr ? pr.via.lineType + ' ' + (pr.via.lineNo || '') : '' });
    cur = pr ? pr.from : null;
  }
  return { reached: !!found, chain };
}

// Topoloji kontrolleri
export function topologyIssues(m, ix) {
  const issues = [];
  const push = (code, severity, entityId, entityNo, message) => issues.push({ code, severity, entityId, entityNo, message, group: 'Topoloji' });
  for (const l of ix.lines) {
    const n = l.nodes || [];
    if (n.length < 2) push('EKSİK VERİ', 'error', l.id, l.lineNo, 'Hat en az 2 düğüm içermeli');
    const miss = n.filter((pid) => !ix.pts.has(pid));
    if (miss.length) push('EKSİK VERİ', 'error', l.id, l.lineNo, miss.length + ' düğüm noktası bulunamadı (silinmiş)');
    for (let i = 0; i < n.length - 1; i++) if (n[i] === n[i + 1]) push('UYUMSUZ', 'error', l.id, l.lineNo, 'Ardışık aynı düğüm (sıfır açıklık)');
  }
  const kindAt = (pid) => (ix.eqByPoint.get(pid) || []).map((e) => e.kind);
  for (const e of m.equipment) {
    if (e.status === 'deleted') continue;
    const refs = ix.linesByPoint.get(e.pointId) || [];
    if (e.kind === 'pole' && !refs.length && e.state !== 'DEMONTAJ') push('UYARI', 'warn', e.id, e.no, 'Direk hiçbir hatta bağlı değil');
    if (e.kind === 'transformer') {
      const og = refs.some((r) => r.line.lineType === 'OG' || r.line.lineType === 'ENH');
      const ag = refs.some((r) => r.line.lineType === 'AG');
      if (!og) push('UYARI', 'warn', e.id, e.no, 'Trafo OG besleme hattına bağlı değil');
      if (!ag) push('UYARI', 'warn', e.id, e.no, 'Trafo AG çıkışı (hat/kablo) tanımlı değil');
    }
    if (e.kind === 'sdk') {
      const ag = refs.some((r) => r.line.lineType === 'AG');
      if (!ag) push('UYARI', 'warn', e.id, e.no, 'SDK besleyen AG hattına/kablosuna bağlı değil');
    }
  }
  for (const l of ix.lines) {
    if (l.lineType !== 'ABONE') continue;
    const n = l.nodes || [];
    const ends = [n[0], n[n.length - 1]].map(kindAt);
    const ok = ends.some((k) => k.includes('sdk') || k.includes('pole'));
    if (!ok) push('UYARI', 'warn', l.id, l.lineNo, 'Abone hattı SDK veya direkten beslenmiyor');
  }
  // OG hattında AG'ye ait ekipman / trafo dışı bağlantı (gerilim sınıfı)
  for (const l of ix.lines) {
    if (l.lineType !== 'OG' && l.lineType !== 'ENH') continue;
    for (const pid of l.nodes || []) for (const e of ix.eqByPoint.get(pid) || []) {
      if (e.kind === 'sdk') push('UYUMSUZ', 'error', l.id, l.lineNo, 'OG hattı SDK üzerinden geçemez (' + e.no + ')');
      if (e.kind === 'pole' && e.group && ['sehir', 'agac', 'ayd'].includes(e.group)) push('UYUMSUZ', 'error', e.id, e.no, 'OG hattı AG direk grubunda (' + e.group + ')');
    }
  }
  return issues;
}
