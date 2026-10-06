// CAD çizimi (DXF / NCZ) servisi: dosyayı oku, projeye kaydet, haritada katman olarak göster, noktaya yapış, kolları bul.
// Çizim koordinatları proje koordinat sisteminde (Y = sağa, X = yukarı; metre) kabul edilir.
import { parseCad, nearestSnap, armsAt, cadBBox } from '../cad/index.js';
import { ulid } from '../core/ids.js';

const cache = new Map();     // belge kimliği → model
const r3 = (v) => Math.round(v * 1000) / 1000;

// Sağa / yukarı yer değiştirmiş mi? (sağa 6 haneli, yukarı 7 haneli olmalı)
export function looksSwapped(b) { return !!b && b.minE > 1e6 && b.maxE < 1e7 && b.minN > 1e5 && b.maxN < 1e6; }
export function inCountryRange(b) { return !!b && b.minE > 1e5 && b.maxE < 1e6 && b.minN > 3.8e6 && b.maxN < 4.8e6; }
function swapXY(m) {
  for (const e of m.ents) {
    if (e.t === 'L') { [e.x1, e.y1] = [e.y1, e.x1]; [e.x2, e.y2] = [e.y2, e.x2]; }
    else if (e.t === 'P' || e.t === 'F') { for (let i = 0; i < e.v.length; i += 2) [e.v[i], e.v[i + 1]] = [e.v[i + 1], e.v[i]]; }
    else { [e.x, e.y] = [e.y, e.x]; if (e.t === 'A') { const a1 = 90 - e.a2, a2 = 90 - e.a1; e.a1 = ((a1 % 360) + 360) % 360; e.a2 = ((a2 % 360) + 360) % 360; } if (e.t === 'T') e.rot = 90 - (e.rot || 0); }
  }
}
function compact(m) {
  for (const e of m.ents) {
    for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'h']) if (typeof e[k] === 'number') e[k] = r3(e[k]);
    if (e.v) e.v = Array.from(e.v, r3);
  }
}
// Dosyayı oku ve modele çevir (kaydetmeden). → { model, warnings }
export function readCad(bytes, filename, project) {
  const model = parseCad(bytes, filename);
  const warnings = [...(model.warnings || [])];
  let b = cadBBox(model);
  if (looksSwapped(b)) { swapXY(model); if (model._snapIndex) delete model._snapIndex; b = cadBBox(model); warnings.push('Çizimde sağa / yukarı değerleri yer değiştirmişti; düzeltildi.'); }
  model.bbox = b;
  if (b && !inCountryRange(b)) warnings.push('Çizim ülke koordinatlarında görünmüyor (sağa ' + Math.round(b.minE) + '…' + Math.round(b.maxE) + ', yukarı ' + Math.round(b.minN) + '…' + Math.round(b.maxN) + '). Haritada proje alanından uzakta kalabilir.');
  const cm = project && project.crs ? project.crs.cm : null;
  if (model.dom && cm && model.dom !== cm) warnings.push('Çizimin dilim orta meridyeni ' + model.dom + '°, proje ' + cm + '°. Koordinatlar farklı dilimde olabilir.');
  compact(model);
  return { model, warnings };
}
export const cadDocs = (ps) => (ps.data.documents || []).filter((d) => d.kind === 'CAD' && d.status !== 'deleted');
export async function importCad(ps, bytes, filename) {
  const { model, warnings } = readCad(bytes, filename, ps.p);
  const blobId = ulid();
  const stored = { format: model.format, ents: model.ents, layers: model.layers, bbox: model.bbox, dom: model.dom || null, stats: model.stats || {} };
  await ps.ds.db.put('blobs', { id: blobId, projectId: ps.p.id, mime: 'application/json', text: JSON.stringify(stored, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v)) });
  const hidden = model.layers.map((l, i) => (l.off ? i : -1)).filter((i) => i >= 0);
  const doc = await ps.ds.create('documents', { projectId: ps.p.id, kind: 'CAD', name: filename, format: model.format, blobId, entCount: model.ents.length, layerCount: model.layers.length, bbox: model.bbox, dom: model.dom || null, stats: model.stats || {}, visible: true, hidden, warnings, at: ps.ds.iso() }, { reason: 'CAD çizimi yüklendi: ' + filename + ' · ' + model.ents.length + ' nesne', silent: true });
  cache.set(doc.id, stored);
  await ps.reload('documents');
  return { doc, model: stored, warnings };
}
export async function cadModel(ps, doc) {
  if (cache.has(doc.id)) return cache.get(doc.id);
  const b = await ps.ds.db.get('blobs', doc.blobId);
  if (!b || !b.text) return null;
  const m = JSON.parse(b.text);
  cache.set(doc.id, m);
  return m;
}
// Haritada gösterilecek çizimler: [{ id, name, model, hidden:Set }]
export async function visibleCad(ps) {
  const out = [];
  for (const d of cadDocs(ps)) { if (d.visible === false) continue; const m = await cadModel(ps, d); if (m) out.push({ id: d.id, name: d.name, model: m, hidden: new Set(d.hidden || []) }); }
  return out;
}
export async function setCad(ps, doc, patch) { await ps.ds.update('documents', doc.id, patch, { noAudit: true, silent: true }); await ps.reload('documents'); }
export async function removeCad(ps, doc) {
  await ps.ds.remove('documents', doc.id, { reason: 'CAD çizimi kaldırıldı: ' + doc.name, silent: true });
  try { await ps.ds.db.delete('blobs', doc.blobId); } catch (e) { /* */ }
  cache.delete(doc.id); await ps.reload('documents');
}
// Dokunulan yere en yakın çizim noktası (uç, köşe, merkez, yazı, nokta)
export function snapCad(layers, E, N, maxDist) {
  let best = null;
  for (const c of layers) { const s = nearestSnap(c.model, E, N, maxDist, c.hidden); if (s && (!best || s.d < best.d)) best = Object.assign({ docId: c.id }, s); }
  if (best) { const e = layers.find((c) => c.id === best.docId).model; const ent = e.ents[best.ent]; best.layer = ent ? (e.layers[ent.l] || {}).name || '' : ''; best.text = ent && ent.t === 'T' ? ent.s : null; }
  return best;
}
// Bir düğümden çıkan kollar (hat yönleri) — tüm görünür çizimlerden
export function cadArms(layers, E, N, tol = 0.5) {
  const out = [];
  for (const c of layers) for (const a of armsAt(c.model, E, N, tol, { hidden: c.hidden })) out.push(a);
  // aynı yön + katman tekrarlarını ayıkla
  const uniq = [];
  for (const a of out.sort((x, y) => x.az - y.az)) if (!uniq.some((u) => u.layer === a.layer && Math.abs(((u.az - a.az + 540) % 360) - 180) < 1)) uniq.push(a);
  return uniq;
}
export function clearCadCache() { cache.clear(); }
