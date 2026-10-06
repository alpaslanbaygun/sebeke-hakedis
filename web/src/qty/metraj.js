// Otomatik metraj ve Yeşil Defter satırları.
// Montaj / Demontaj / DMM tamamen ayrı tutulur; servis kodunun ilk hanesi iş tipini belirtir (0/1/2).
// Her katkı kaynağıyla (GNSS · GIS · OTO · MANUEL · FOTO · PROJE · REVIZYON) ve referansıyla saklanır.
import { JOB_PREFIX } from '../core/schema.js';

export function contributionsFromEquipment(e, mats, meta) {
  const out = [];
  for (const m of mats.items) {
    const job = m.jobOverride || mats.job;
    if (!job) continue;
    let source = m.origin === 'OTO' ? (m.tag === 'direk' || m.tag === 'trafo' || m.tag === 'sdk' || m.tag === 'kosk' || m.tag === 'self' ? meta.posSource : 'OTO') : 'MANUEL';
    out.push({
      job, servis: m.servis, material: null, qty: m.qty, unit: m.unit, kgPer: m.kgPer, grp: m.grp, name: m.name, why: m.why, tag: m.tag,
      source, evidence: meta.photos > 0 ? 'FOTO' : null, missing: m.missing, overridden: !!m.overridden, origin: m.origin,
      ref: { type: 'equipment', id: e.id, no: e.no, kind: e.kind, workDate: e.workDate || null, done: meta.done != null ? meta.done : e.progress === 'done' }
    });
  }
  return out;
}
export function contributionsFromLine(line, items, job, meta) {
  return items.filter((x) => x.qty > 0 || x.missing).map((x) => ({
    job, servis: x.servis, material: x.material || null, qty: x.qty, unit: x.unit, kgPer: null, grp: '', name: x.conductor || x.material || '', why: x.why, tag: x.material ? 'kanal' : 'iletken',
    source: x.material ? 'OTO' : meta.lenSource, evidence: meta.photos > 0 ? 'FOTO' : null, missing: x.missing || (!x.servis && !x.material),
    ref: { type: 'line', id: line.id, no: line.lineNo, kind: 'line', workDate: line.workDate || null, done: meta.done != null ? meta.done : line.progress === 'done' }
  }));
}

// Katkıları Yeşil Defter satırlarına topla (Kg grupları + alt kalemler)
export function aggregate(contribs, cat, projectId) {
  const rows = new Map();
  const matMaster = cat.table('materialsMaster') || [];
  const key = (job, k) => job + '|' + k;
  const addSrc = (r, c, q) => { r.sources[c.source] = (r.sources[c.source] || 0) + q; if (c.evidence) r.sources.FOTO = (r.sources.FOTO || 0) + q; };
  for (const c of contribs) {
    let servis = c.servis;
    if (!servis && c.material) { const mm = matMaster.find((x) => x.key === c.material); servis = mm && mm.servis ? mm.servis : null; }
    if (c.grp) {
      const k = key(c.job, c.grp);
      const gp = cat.poz(c.grp);
      const r = rows.get(k) || { id: 'Q:' + c.job + ':' + c.grp, projectId, job: c.job, servis: c.grp, code: cat.jobCode(c.grp, c.job), name: gp ? gp.name : c.grp, unit: 'Kg', qty: 0, sources: {}, refs: [], subs: [], isGroup: true, available: cat.pozAvailable(c.grp, c.job), missing: !gp };
      const kg = (c.kgPer || 0) * c.qty;
      r.qty += kg; addSrc(r, c, kg);
      const sub = r.subs.find((s) => s.servis === servis);
      if (sub) sub.qty += c.qty; else r.subs.push({ servis, name: c.name, qty: c.qty, kgPer: c.kgPer, unit: 'Ad' });
      r.refs.push(Object.assign({ qty: kg, sub: servis, source: c.source }, c.ref));
      rows.set(k, r);
      continue;
    }
    const kk = servis || ('MAT:' + (c.material || c.name));
    const k = key(c.job, kk);
    const pz = servis ? cat.poz(servis) : null;
    const mm = c.material ? matMaster.find((x) => x.key === c.material) : null;
    const r = rows.get(k) || {
      id: 'Q:' + c.job + ':' + kk, projectId, job: c.job, servis: servis || null, material: c.material || null,
      code: servis ? cat.jobCode(servis, c.job) : '—', name: pz ? pz.name : mm ? mm.label : (c.name || c.material || '?'), unit: pz ? pz.unit : c.unit,
      qty: 0, sources: {}, refs: [], subs: [], isGroup: false, available: servis ? cat.pozAvailable(servis, c.job) : false, missing: !servis, noPoz: !servis
    };
    r.qty += c.qty; addSrc(r, c, c.qty);
    r.refs.push(Object.assign({ qty: c.qty, source: c.source, why: c.why }, c.ref));
    if (c.overridden) r.overridden = true;
    if (c.origin && c.origin !== 'OTO') r.hasManual = true;
    rows.set(k, r);
  }
  const out = [...rows.values()];
  for (const r of out) { r.qty = round(r.qty, r.unit === 'Kg' ? 2 : 3); for (const s of Object.keys(r.sources)) r.sources[s] = round(r.sources[s], 3); }
  const order = { montaj: 0, demontaj: 1, dmm: 2 };
  out.sort((a, b) => order[a.job] - order[b.job] || String(a.servis || 'zzz' + a.name).localeCompare(String(b.servis || 'zzz' + b.name)));
  return out;
}
export const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

// Yeşil Defter sayfası görünümü (dışa aktarım ve ekran)
export function greenBookPage(quantities, job) {
  const rows = [];
  for (const q of quantities.filter((x) => x.job === job)) {
    rows.push({ code: q.available || job === 'montaj' ? q.code : 'sayfada yok', name: q.name, qty: q.qty, unit: q.unit, sources: q.sources, sub: false, ok: q.available && !q.missing, noPoz: q.noPoz, overridden: q.overridden, hasManual: q.hasManual });
    if (q.isGroup) for (const s of q.subs) rows.push({ code: job === 'montaj' ? s.servis : '—', name: '└ ' + s.name + (s.kgPer ? ' · ' + s.kgPer + ' kg' : ''), qty: s.qty, unit: 'Ad', sub: true, ok: true });
  }
  return rows;
}
export { JOB_PREFIX };
