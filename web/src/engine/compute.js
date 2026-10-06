// Proje hesap zinciri (saf fonksiyon):
// NOKTA/HARİTA → HAT → AÇIKLIK → DİREK ROLÜ/AÇI → MALZEME REÇETESİ → METRAJ → (HAKEDİŞ) → KONTROL → (DXF/RAPOR karması)
import { indexModel, computeSpans, computePoleRoles, lineLengths, topologyIssues } from '../grid/network.js';
import { equipmentMaterials, applyRules } from '../grid/recipe.js';
import { overheadQuantities, cableQuantities, isBareAG } from '../grid/lines.js';
import { checkPole, checkTransformer, checkLine, checkPoint, checkMaterials } from '../grid/checks.js';
import { analyzeLine } from '../grid/enh.js';
import { contributionsFromEquipment, contributionsFromLine, aggregate } from '../qty/metraj.js';
import { STATUSES } from '../core/schema.js';
import { countsAsDone } from '../core/roles.js';

// Metraj satırındaki konum kaynağı: GNSS (harici alıcı) · TEST (telefon) · SIM · GIS (haritadan) · EXCEL · PROJE (tasarım) · MANUEL
const posSourceOf = (p) => (!p ? 'MANUEL' : p.source === 'GNSS_RTK' || p.source === 'GNSS_FLOAT' ? 'GNSS' : p.source === 'PHONE' ? 'TEST' : p.source === 'SIM' ? 'SIM' : p.source === 'MAP' ? 'GIS' : p.source === 'EXCEL' || p.source === 'IMPORT' ? 'EXCEL' : p.source === 'DESIGN' ? 'PROJE' : 'MANUEL');

export function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

export function computeProject(model, cat) {
  const project = model.project;
  const act = (a) => (a || []).filter((x) => x.status !== 'deleted');
  const m = { points: act(model.points), equipment: act(model.equipment), lines: act(model.lines), materials: act(model.materials), photos: act(model.photos) };
  const ix = indexModel(m);
  const spans = computeSpans(m, ix);
  const roles = computePoleRoles(m, ix, { cornerThresholdDeg: project.cornerThresholdDeg ?? 3 });
  const lens = lineLengths(spans);
  const photoCount = new Map();
  for (const ph of m.photos) photoCount.set(ph.ownerId, (photoCount.get(ph.ownerId) || 0) + 1);
  const bare = new Set();
  for (const l of ix.lines) if (l.install !== 'yeralti' && isBareAG(l, cat)) for (const pid of l.nodes || []) bare.add(pid);
  const params = project.paramOverrides || {};
  const manualBy = new Map();
  for (const x of m.materials) { if (!manualBy.has(x.ownerId)) manualBy.set(x.ownerId, []); manualBy.get(x.ownerId).push(x); }

  const contribs = [], issues = [], matsByEq = new Map();
  const pointIssues = new Set();
  for (const e of m.equipment) {
    const p = ix.pts.get(e.pointId);
    const ri = roles.get(e.id);
    const mats = equipmentMaterials(e, cat, { ctx: { role: (ri && ri.role) || 'T', agCiplak: bare.has(e.pointId) }, params, manual: manualBy.get(e.id) });
    matsByEq.set(e.id, mats);
    contribs.push(...contributionsFromEquipment(e, mats, { posSource: posSourceOf(p), photos: photoCount.get(e.id) || 0, done: countsAsDone(project, e) }));
    if (e.kind === 'pole') issues.push(...checkPole(e, cat, ri));
    if (e.kind === 'transformer') issues.push(...checkTransformer(e, cat));
    issues.push(...checkMaterials(e, mats));
    if (!p) issues.push({ code: 'EKSİK VERİ', severity: 'error', entityId: e.id, entityNo: e.no, message: 'Ekipmanın konumu (nokta) yok' });
    else if (!pointIssues.has(p.id)) { pointIssues.add(p.id); issues.push(...checkPoint(Object.assign({}, p, { no: p.pointNo, critical: p.critical !== false })).map((x) => Object.assign(x, { entityId: e.id, entityNo: e.no, pointId: p.id }))); }
  }
  const lineInfo = new Map();
  for (const l of ix.lines) {
    const job = (STATUSES[l.state] || {}).job || null;
    const ln = lens.get(l.id) || { l2: 0, l3: 0, spans: 0 };
    const allGnss = (l.nodes || []).every((pid) => { const p = ix.pts.get(pid); return p && p.source === 'GNSS_RTK'; });
    let items = [], cableInfo = null;
    if (l.install === 'yeralti') {
      const endKinds = [l.nodes[0], l.nodes[l.nodes.length - 1]].map((pid) => { const eqs = ix.eqByPoint.get(pid) || []; return eqs.length ? eqs[0].kind : 'point'; });
      cableInfo = cableQuantities(l, { length2D: ln.l2 }, endKinds, cat);
      items = cableInfo.items;
    } else items = overheadQuantities(l, ln.l3, cat, { payPct: project.conductorPayPct || 0 });
    if (l.lineType === 'ABONE') {
      const n = l.aboneCount || 1;
      const ab = applyRules(cat.rules('abone'), { install: l.install, phase: l.abonePhase || 'uc', length: ln.l2 }, cat, params);
      for (const a of ab) items.push({ servis: a.servis, qty: a.qtyFrom === '$length' ? a.qty : a.qty * n, unit: a.unit, why: a.why, conductor: a.name, missing: a.missing });
    }
    if (job) contribs.push(...contributionsFromLine(l, items, job, { lenSource: allGnss ? 'GNSS' : 'GIS', photos: photoCount.get(l.id) || 0, done: countsAsDone(project, l) }));
    issues.push(...checkLine(l, cat));
    lineInfo.set(l.id, { length2D: ln.l2, length3D: ln.l3, spans: ln.spans, items, cable: cableInfo, job, lenSource: allGnss ? 'GNSS' : 'GIS' });
  }
  issues.push(...topologyIssues(m, ix));

  // ENH / havai hat mekanik analiz (çıplak iletkenli OG/ENH hatları)
  const enh = new Map();
  const enhT = cat.table('enh'), clr = cat.table('clearances');
  if (enhT && clr) {
    const poles = m.equipment.filter((e) => e.kind === 'pole').map((e) => { const t = cat.poleType(e.typeId); return Object.assign({}, e, { _heightM: (e.attrs && e.attrs.heightM) || (t && t.heightM) || null, _capacityDaN: (e.attrs && e.attrs.capacityDaN) || (t && t.capacityDaN) || null }); });
    for (const l of ix.lines) {
      if (l.install === 'yeralti' || !(l.lineType === 'OG' || l.lineType === 'ENH')) continue;
      const r = analyzeLine({ line: l, spans, poles, pointsById: ix.pts, roles, cat, zoneId: project.enhZone || 'II', enh: enhT, clearances: clr, landClass: project.landClass || 'arazi' });
      enh.set(l.id, r);
      if (r.error) continue;
      for (const s of r.spans) {
        if (s.ok === false) issues.push({ code: 'UYUMSUZ', severity: 'error', entityId: l.id, entityNo: l.lineNo, group: 'ENH', message: s.from + '→' + s.to + ' zemin açıklığı ' + s.groundClear.toFixed(2) + ' m < ' + s.groundReq + ' m' });
      }
      for (const p of r.poles) if (p.ok === false) issues.push({ code: 'UYUMSUZ', severity: 'error', entityId: p.id, entityNo: p.no, group: 'ENH', message: 'Direk tepe kuvveti ' + p.Ftop.toFixed(0) + ' daN > kapasite ' + p.cap.toFixed(0) + ' daN' });
      for (const s of r.sections) if (!s.edsOk) issues.push({ code: 'UYARI', severity: 'warn', entityId: l.id, entityNo: l.lineNo, group: 'ENH', message: s.from + '→' + s.to + ' EDS %' + s.edsPct.toFixed(1) + ' > %' + enhT.edsPctRTS });
    }
  }
  const quantities = aggregate(contribs, cat, project.id);
  for (const q of quantities) {
    if (q.noPoz && q.qty > 0) issues.push({ code: 'MALZEME EKSİK', severity: 'warn', entityId: q.id, entityNo: q.name, group: 'Metraj', message: q.name + ' için poz eşlemesi yok (Tanımlar › Malzeme)' });
    else if (!q.available && q.job !== 'montaj' && q.qty > 0) issues.push({ code: 'UYARI', severity: 'warn', entityId: q.id, entityNo: q.code, group: 'Metraj', message: q.name + ' · ' + q.job + ' sayfasında yok' });
  }
  const sig = fnv(JSON.stringify([m.points.map((p) => [p.id, p.E, p.N, p.H, p.rev]), m.equipment.map((e) => [e.id, e.rev]), m.lines.map((l) => [l.id, l.rev]), m.materials.map((x) => [x.id, x.rev]), cat.stdId]));
  return { ix, spans, roles, matsByEq, lineInfo, quantities, issues, enh, signature: sig, counts: { points: m.points.length, equipment: m.equipment.length, lines: m.lines.length, spans: spans.length } };
}

// İki hesap sonucu arasındaki etki (değişiklik zinciri raporu)
export function impactOf(prev, next) {
  if (!prev) return null;
  const mapBy = (arr, k) => new Map(arr.map((x) => [x[k], x]));
  const ps = mapBy(prev.spans, 'id'), ns = mapBy(next.spans, 'id');
  let spans = 0; for (const [k, s] of ns) { const o = ps.get(k); if (!o || Math.abs(o.length3D - s.length3D) > 1e-4) spans++; } for (const k of ps.keys()) if (!ns.has(k)) spans++;
  let roles = 0; for (const [k, r] of next.roles) { const o = prev.roles.get(k); if (!o || o.role !== r.role || Math.abs((o.angle || 0) - (r.angle || 0)) > 0.01) roles++; }
  let mats = 0; for (const [k, v] of next.matsByEq) { const o = prev.matsByEq.get(k); if (!o || JSON.stringify(o.items.map((x) => [x.servis, x.qty])) !== JSON.stringify(v.items.map((x) => [x.servis, x.qty]))) mats++; }
  const pq = mapBy(prev.quantities, 'id');
  let qty = 0; for (const q of next.quantities) { const o = pq.get(q.id); if (!o || Math.abs(o.qty - q.qty) > 1e-6) qty++; } for (const k of pq.keys()) if (!next.quantities.find((q) => q.id === k)) qty++;
  return { spans, roles, materials: mats, quantities: qty, exportsStale: prev.signature !== next.signature };
}
