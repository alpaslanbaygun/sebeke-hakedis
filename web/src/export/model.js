// Dışa aktarım için tek tip obje modeli (DXF, SHP, GeoJSON, KML, NCN, XLSX, rapor aynı veriyi kullanır).
import { lineLabel } from '../grid/lines.js';
import { jobOf } from '../grid/recipe.js';
import { STATUSES, TRAFO_STATUSES, EQUIPMENT_KINDS } from '../core/schema.js';
import { unproject, project as projLL } from '../geo/crs.js';

export function buildExportModel(ps, opts = {}) {
  const { p: project, cat, data, result } = ps;
  const crs = opts.crs || project.crs;
  const reproj = !!opts.crs && JSON.stringify(opts.crs) !== JSON.stringify(project.crs);
  // Farklı CRS istenirse E/N enlem-boylamdan yeniden hesaplanır (Z korunur)
  const conv = (p) => { if (!reproj || !p || p.lat == null) return p; const q = projLL(p.lat, p.lon, crs); return Object.assign({}, p, { E: q.E, N: q.N }); };
  const pts = new Map(data.points.map((p) => [p.id, conv(p)]));
  const ll = (p) => { if (p.lat != null) return { lat: p.lat, lon: p.lon }; const g = unproject(p.E, p.N, project.crs); return g; };
  const points = [...pts.values()].map((p) => Object.assign({ id: p.id, no: p.pointNo, E: p.E, N: p.N, H: p.H, h: p.h, cls: p.cls, source: p.source, fix: p.quality ? p.quality.fix : null, sigmaH: p.quality ? p.quality.sigmaH : null, sigmaV: p.quality ? p.quality.sigmaV : null, accuracyClass: p.accuracyClass, updatedAt: p.updatedAt }, ll(p)));
  const equipment = data.equipment.map((e) => {
    const p = pts.get(e.pointId) || {};
    const t = e.typeId ? cat.poleType(e.typeId) : null;
    const ri = result.roles.get(e.id) || {};
    const g = e.group ? cat.poleGroup(e.group) : null;
    const volt = e.kind === 'lighting' || e.group === 'ayd' ? 'AYD' : e.kind === 'pole' ? (g && g.og ? (e.group === 'mus' ? 'OG' : 'OG') : 'AG') : null;
    const st = e.kind === 'transformer' ? (TRAFO_STATUSES[e.state] || {}).label : (STATUSES[e.state] || {}).label;
    return Object.assign({
      id: e.id, no: e.no, kind: e.kind, kindLabel: (EQUIPMENT_KINDS[e.kind] || {}).label, pointId: e.pointId, E: p.E, N: p.N, H: p.H, state: e.state, stateLabel: st, job: jobOf(e),
      group: e.group || null, groupLabel: g ? g.label : '', typeName: t ? t.name : (e.attrs && e.attrs.kva ? e.attrs.kva + ' kVA' : ''), servis: t ? t.servis : '', role: ri.role || null, angle: ri.angle ?? null,
      heightM: t ? t.heightM : null, volt, symbol: g ? g.symbol : 's', attrs: e.attrs || {}, source: p.source || null, workDate: e.workDate || null, progress: e.progress
    }, p.E != null ? ll(p) : {});
  });
  const lines = data.lines.map((l) => {
    const coords = (l.nodes || []).map((id) => pts.get(id)).filter(Boolean).map((p) => Object.assign({ id: p.id, E: p.E, N: p.N, H: p.H, no: p.pointNo }, ll(p)));
    const li = result.lineInfo.get(l.id) || {};
    return { id: l.id, no: l.lineNo, name: l.name || '', lineType: l.lineType, install: l.install, state: l.state, job: (STATUSES[l.state] || {}).job || null, label: lineLabel(l, cat), coords, length2D: li.length2D || 0, length3D: li.length3D || 0, musterek: !!l.musterek, abonePhase: l.abonePhase || null };
  });
  const spans = result.spans.map((s) => { const a = pts.get(s.fromId), b = pts.get(s.toId); return Object.assign({}, s, { a: a ? { E: a.E, N: a.N, H: a.H } : null, b: b ? { E: b.E, N: b.N, H: b.H } : null }); });
  const crossings = data.crossings.map((c) => conv(Object.assign({}, c)));
  return { project, crs, cat, points, equipment, lines, spans, crossings, quantities: result.quantities, issues: result.issues, enh: result.enh, periods: data.periods, signature: result.signature };
}
