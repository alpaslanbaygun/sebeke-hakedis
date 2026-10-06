// Enerji verme kontrolü: AG ve/veya OG tarafına enerji verildiğinde hangi hat ve objelerin enerjili, hangilerinin enerjisiz kaldığı.
// Yöntem: bağlantı izleme. Hat düğümleri (noktalar) üzerinden, o gerilim seviyesini taşıyan hat parçaları boyunca kaynaklardan yayılır.
//   OG seviyesi: OG / ENH hatlar (ve OG devresi taşıyan müşterek hatlar)
//   AG seviyesi: AG / AYD / ABONE hatlar (ve müşterek hatlardaki AG devreleri)
//   OG kaynakları: kullanıcının seçtiği besleme noktaları
//   AG kaynakları: trafolar (OG de açıksa isteğe bağlı olarak yalnız OG'den enerji alan trafolar) + kullanıcının seçtiği noktalar
// Açık bırakılan hatlardan (line.energyOpen) ve demontaj / ileride durumundaki hatlardan enerji geçmez.
const OG_TYPES = new Set(['OG', 'ENH']), AG_TYPES = new Set(['AG', 'AYD', 'ABONE']);
export function levelsOf(line) {
  const roles = new Set((line.circuits || []).map((c) => c.role));
  const og = OG_TYPES.has(line.lineType) || roles.has('OG') || roles.has('ENH');
  const ag = AG_TYPES.has(line.lineType) || roles.has('AG') || roles.has('AYD') || roles.has('ABONE');
  return { og, ag };
}
const TRAFO_KINDS = new Set(['transformer', 'kiosk', 'substation']);
const passable = (l, opts) => !l.energyOpen && l.status !== 'deleted' && (opts.includeFuture || (l.state !== 'DEMONTAJ' && l.state !== 'ILERIDE'));

function spread(lines, level, sources, opts) {
  const adj = new Map();
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); };
  for (const l of lines) { if (!levelsOf(l)[level] || !passable(l, opts)) continue; const n = l.nodes || []; for (let i = 0; i < n.length - 1; i++) link(n[i], n[i + 1]); }
  const seen = new Set();
  const q = [];
  for (const s of sources) { if (!seen.has(s)) { seen.add(s); q.push(s); } }
  while (q.length) { const x = q.pop(); for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); q.push(y); } }
  return seen;
}

// data: { points, equipment, lines } · cfg: { og, ag, link, ogSources:[pointId], agSources:[pointId], includeFuture }
export function energize(data, cfg = {}) {
  const lines = (data.lines || []).filter((l) => l.status !== 'deleted');
  const eqs = (data.equipment || []).filter((e) => e.status !== 'deleted');
  const opts = { includeFuture: !!cfg.includeFuture };
  const out = { og: !!cfg.og, ag: !!cfg.ag, nodesOG: new Set(), nodesAG: new Set(), lineState: new Map(), eqState: new Map(), sources: { og: [], ag: [] }, dead: { lines: [], equipment: [] }, counts: { on: 0, off: 0, skipped: 0 }, notes: [] };
  const trafos = eqs.filter((e) => TRAFO_KINDS.has(e.kind) && e.state !== 'demontaj' && e.pointId);
  if (cfg.og) {
    out.sources.og = [...new Set(cfg.ogSources || [])];
    if (!out.sources.og.length) out.notes.push('OG için enerji kaynağı seçilmedi: haritada OG hattının besleme ucuna dokunup "OG enerji kaynağı yap" deyin.');
    out.nodesOG = spread(lines, 'og', out.sources.og, opts);
  }
  if (cfg.ag) {
    const fromOG = cfg.og && cfg.link !== false;
    const tr = trafos.filter((e) => !fromOG || out.nodesOG.has(e.pointId));
    out.sources.ag = [...new Set([...tr.map((e) => e.pointId), ...(cfg.agSources || [])])];
    if (!trafos.length && !(cfg.agSources || []).length) out.notes.push('AG için kaynak yok: projede trafo yok. Bir noktayı "AG enerji kaynağı" yapabilirsiniz.');
    else if (fromOG && !tr.length && !(cfg.agSources || []).length) out.notes.push('Hiçbir trafo OG\'den enerji almıyor; AG tarafı enerjisiz kalır.');
    out.nodesAG = spread(lines, 'ag', out.sources.ag, opts);
    out.deadTrafos = fromOG ? trafos.filter((e) => !out.nodesOG.has(e.pointId)).map((e) => e.id) : [];
  }
  for (const l of lines) {
    const lv = levelsOf(l);
    const act = [];
    if (cfg.og && lv.og) act.push(out.nodesOG);
    if (cfg.ag && lv.ag) act.push(out.nodesAG);
    if (!act.length) { out.lineState.set(l.id, 'na'); continue; }
    if (!passable(l, opts)) { out.lineState.set(l.id, 'skip'); out.counts.skipped++; continue; }
    const n = l.nodes || [];
    const res = act.map((set) => n.length > 0 && n.every((id) => set.has(id)));
    const st = res.every(Boolean) ? 'on' : res.some(Boolean) ? 'mixed' : 'off';
    out.lineState.set(l.id, st);
    if (st === 'on') out.counts.on++; else { out.counts.off++; out.dead.lines.push(l.id); }
  }
  // Objeler: bağlı olduğu etkin seviyelerden en az birinde enerji varsa enerjili; hiçbir etkin seviyeye bağlı değilse kapsam dışı
  // (yalnız devre dışı — açık / demontaj / ileride — hatlara bağlı objeler de kapsam dışı sayılır)
  const levelNodes = { og: new Set(), ag: new Set() };
  for (const l of lines) { if (!passable(l, opts)) continue; const lv = levelsOf(l); for (const id of l.nodes || []) { if (lv.og) levelNodes.og.add(id); if (lv.ag) levelNodes.ag.add(id); } }
  for (const e of eqs) {
    if (!e.pointId) continue;
    const inOG = cfg.og && levelNodes.og.has(e.pointId), inAG = cfg.ag && levelNodes.ag.has(e.pointId);
    if (!inOG && !inAG) { out.eqState.set(e.id, 'na'); continue; }
    const on = (inOG && out.nodesOG.has(e.pointId)) || (inAG && out.nodesAG.has(e.pointId));
    const all = (!inOG || out.nodesOG.has(e.pointId)) && (!inAG || out.nodesAG.has(e.pointId));
    out.eqState.set(e.id, all ? 'on' : on ? 'mixed' : 'off');
    if (!all) out.dead.equipment.push(e.id);
  }
  return out;
}
