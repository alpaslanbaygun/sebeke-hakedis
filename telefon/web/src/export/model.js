// Dışa aktarım için tek tip obje modeli (DXF, SHP, GeoJSON, KML, NCN, XLSX, rapor aynı veriyi kullanır).
import { lineLabel } from '../grid/lines.js';
import { jobOf } from '../grid/recipe.js';
import { STATUSES, TRAFO_STATUSES, EQUIPMENT_KINDS, HAK_STATUSES, hakOf } from '../core/schema.js';
import { sourceInfo } from '../core/source.js';
import { unproject, project as projLL } from '../geo/crs.js';

export function buildExportModel(ps, opts = {}) {
  const { p: project, cat, data, result } = ps;
  const crs = opts.crs || project.crs;
  const reproj = !!opts.crs && JSON.stringify(opts.crs) !== JSON.stringify(project.crs);
  // Farklı CRS istenirse E/N enlem-boylamdan yeniden hesaplanır (Z korunur)
  const conv = (p) => { if (!reproj || !p || p.lat == null) return p; const q = projLL(p.lat, p.lon, crs); return Object.assign({}, p, { E: q.E, N: q.N }); };
  const pts = new Map(data.points.map((p) => [p.id, conv(p)]));
  const ll = (p) => { if (p.lat != null) return { lat: p.lat, lon: p.lon }; const g = unproject(p.E, p.N, project.crs); return g; };
  // Ölçüm/kaynak özeti: tüm çıktılarda aynı alanlar (spesifikasyon 5, 7.6, 13)
  const obsById = new Map((data.gnssObservations || []).map((o) => [o.id, o]));
  const meas = (p) => {
    const q = p.quality || {}, si = sourceInfo(p), o = p.observationId ? obsById.get(p.observationId) || {} : {};
    return { source: si.code, sourceTag: si.tag, sourceLabel: si.label, sourceRaw: p.source || null, fix: q.fix || null, sigmaH: q.sigmaH ?? null, sigmaV: q.sigmaV ?? null, sats: q.sats ?? null, pdop: q.pdop ?? null, hdop: q.hdop ?? o.hdop ?? null, vdop: q.vdop ?? o.vdop ?? null,
      override: !!q.override, device: p.device || o.receiver || null, deviceSerial: p.deviceSerial || o.receiverSerial || null, method: p.method || o.method || null, correction: p.correction || o.correctionSource || null,
      base: o.base || null, operator: p.operator || o.operator || p.updatedBy || p.createdBy || null, measuredAt: p.measuredAt || o.timestamp || p.createdAt || null, crsLabel: p.crsLabel || project.crs.label, zUnknown: p.H == null };
  };
  const photosBy = new Map();
  for (const ph of data.photos || []) { if (ph.status === 'deleted') continue; if (!photosBy.has(ph.ownerId)) photosBy.set(ph.ownerId, []); photosBy.get(ph.ownerId).push(ph); }
  const points = [...pts.values()].map((p) => Object.assign({ id: p.id, no: p.pointNo, E: p.E, N: p.N, H: p.H, h: p.h, cls: p.cls, accuracyClass: p.accuracyClass, updatedAt: p.updatedAt, note: p.note || '', photos: (photosBy.get(p.id) || []).length }, meas(p), ll(p)));
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
      heightM: t ? t.heightM : null, volt, symbol: g ? g.symbol : 's', attrs: e.attrs || {}, workDate: e.workDate || null, progress: e.progress, cizimDurumu: (e.sebeke && e.sebeke.durum) || null,
      hak: hakOf(e), hakLabel: hakOf(e) ? HAK_STATUSES[hakOf(e)].label : '—', note: e.note || '', photos: (photosBy.get(e.id) || []).length, photoList: (photosBy.get(e.id) || []).map((x) => x.filename || x.id)
    }, p.E != null ? meas(p) : { source: null }, p.E != null ? ll(p) : {});
  });
  const lines = data.lines.map((l) => {
    const coords = (l.nodes || []).map((id) => pts.get(id)).filter(Boolean).map((p) => Object.assign({ id: p.id, E: p.E, N: p.N, H: p.H, no: p.pointNo }, ll(p)));
    const li = result.lineInfo.get(l.id) || {};
    return { id: l.id, no: l.lineNo, name: l.name || '', lineType: l.lineType, install: l.install, state: l.state, job: (STATUSES[l.state] || {}).job || null, label: lineLabel(l, cat), coords, length2D: li.length2D || 0, length3D: li.length3D || 0, musterek: !!l.musterek, abonePhase: l.abonePhase || null, hak: hakOf(l), hakLabel: hakOf(l) ? HAK_STATUSES[hakOf(l)].label : '—', workDate: l.workDate || null, note: l.note || '', photos: (photosBy.get(l.id) || []).length, cable: l.cable || null, channelOnly: !!l.channelOnly };
  });
  const spans = result.spans.map((s) => { const a = pts.get(s.fromId), b = pts.get(s.toId); return Object.assign({}, s, { a: a ? { E: a.E, N: a.N, H: a.H } : null, b: b ? { E: b.E, N: b.N, H: b.H } : null }); });
  return { project, crs, cat, points, equipment, lines, spans, photos: (data.photos || []).filter((x) => x.status !== 'deleted'), quantities: result.quantities, issues: result.issues, enh: result.enh, periods: data.periods, signature: result.signature };
}
