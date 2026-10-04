// AutoCAD DXF (R12 / AC1009) üretici — Lejant.dxf katman, ACI, çizgi tipi ve sembol yapısıyla.
// Koordinatlar proje CRS'inde: X = Sağa (E), Y = Yukarı (N), Z = kot (H). Ölçek 1/1000 (yazı 1.8 m = 1.8 mm).
const f = (v) => (Number.isFinite(v) ? (+v).toFixed(4) : '0.0');

class W {
  constructor() { this.o = []; }
  g(code, val) { this.o.push(String(code), String(val)); return this; }
  text() { return this.o.join('\r\n') + '\r\n'; }
}

const LTYPES = [
  ['CONTINUOUS', 'Solid line', []],
  ['DASHED', '__ __ __', [6, -3]],
  ['DASHDOT', '__ . __ .', [8, -2, 0, -2]],
  ['DOT', '. . . .', [0, -2]],
  ['HIDDEN', '_ _ _ _', [3, -1.5]]
];

function legendLayers(model) {
  const L = (model.cat.table('legend') || { layers: [] }).layers;
  const base = L.map((x) => ({ name: x.layer, aci: x.aci, lt: x.lt || 'CONTINUOUS' }));
  base.push({ name: 'ELEKTRIK-DIREK-MUSTEREK', aci: 16, lt: 'CONTINUOUS' });
  return base;
}
const poleLayer = (e) => (e.kind === 'lighting' || e.group === 'ayd' ? 'ELEKTRIK-DIREK-AYD' : e.volt === 'OG' ? (e.group === 'mus' ? 'ELEKTRIK-DIREK-MUSTEREK' : 'ELEKTRIK-DIREK-OG') : 'ELEKTRIK-DIREK-AG');
const lineLayer = (l) => (l.install === 'yeralti' ? 'ELEKTRIK-KABLO' : { AG: 'ELEKTRIK-HAT-AG', OG: 'ELEKTRIK-HAT-OG', AYD: 'ELEKTRIK-HAT-AYD', ENH: 'ELEKTRIK-HAT-ENH', ABONE: 'ELEKTRIK-HAT-ABONE' }[l.lineType] || 'ELEKTRIK-HAT-AG');
// Lejant ACI: mevcut / yeni / DMM
const POLE_ACI = { AG: [120, 108, 3], OG: [16, 10, 1], AYD: [190, 152, 4], ENH: [6, 6, 6] };
const stIdx = (st) => (st === 'YENI' ? 1 : st === 'DMM' ? 2 : 0);
const mode = (st) => (st === 'YENI' ? 'FULL' : st === 'DMM' ? 'HALF' : 'NONE');

function blocks(w) {
  const circle = (r, m, ground) => {
    const ents = [];
    ents.push(['CIRCLE', { 10: 0, 20: 0, 30: 0, 40: r }]);
    if (m === 'FULL') ents.push(['DONUT', r]);
    if (m === 'HALF') ents.push(['HALFDONUT', r]);
    if (ground) ents.push(['GROUND', r]);
    return ents;
  };
  const square = (a, m, ground) => {
    const h = a / 2, ents = [];
    ents.push(['PLINE', [[-h, -h], [h, -h], [h, h], [-h, h]], true]);
    if (m === 'FULL') ents.push(['SOLID', [[-h, -h], [h, -h], [-h, h], [h, h]]]);
    if (m === 'NONE') { ents.push(['LINE', [-h, -h, h, h]]); ents.push(['LINE', [h, -h, -h, h]]); }
    if (m === 'HALF') { ents.push(['SOLID', [[-h, -h], [0, 0], [-h, h], [-h, h]]]); ents.push(['SOLID', [[h, -h], [0, 0], [h, h], [h, h]]]); }
    if (ground) ents.push(['GROUND', h]);
    return ents;
  };
  const defs = {};
  for (const m of ['NONE', 'FULL', 'HALF']) {
    defs['DIREK_AG_' + m] = circle(2.25, m, false); defs['KAFES_AG_' + m] = square(4.6, m, false);
    defs['DIREK_OG_' + m] = circle(3, m, true); defs['KAFES_OG_' + m] = square(6, m, true);
    defs['DIREK_AYD_' + m] = circle(2, m, false); defs['DIREK_ENH_' + m] = circle(3, m, true);
  }
  const tri = [[0, 5.5], [5, -3], [-5, -3]], sq = [[-5, -5], [5, -5], [5, 5], [-5, 5]], house = [[-6, 2], [0, 7], [6, 2], [5, 2], [5, -6], [-5, -6], [-5, 2]];
  for (const [nm, shp] of [['TRAFO_DIREK', tri], ['TRAFO_BINA', sq], ['TRAFO_KOSK', house]]) {
    defs[nm + '_NONE'] = [['PLINE', shp, true]];
    defs[nm + '_FULL'] = [['PLINE', shp, true], ...fanSolids(shp)];
  }
  defs.SDK_NONE = [['PLINE', [[-4, -2.5], [4, -2.5], [4, 2.5], [-4, 2.5]], true], ['LINE', [-4, -2.5, 4, 2.5]]];
  defs.SDK_FULL = [['PLINE', [[-4, -2.5], [4, -2.5], [4, 2.5], [-4, 2.5]], true], ['SOLID', [[-4, -2.5], [4, -2.5], [4, 2.5], [4, 2.5]]]];
  defs.MENHOL = [['PLINE', [[-2, -2], [2, -2], [2, 2], [-2, 2]], true], ['CIRCLE', { 10: 0, 20: 0, 30: 0, 40: 1.2 }]];
  defs.ABONE = [['CIRCLE', { 10: 0, 20: 0, 30: 0, 40: 1.5 }], ['LINE', [-1.5, 0, 1.5, 0]]];
  // v2.2: pano · armatür / sokak lambası · diğer
  defs.PANO = [['PLINE', [[-2.5, -3.5], [2.5, -3.5], [2.5, 3.5], [-2.5, 3.5]], true], ['LINE', [1, 2.5, -1, 0]], ['LINE', [-1, 0, 1, 0]], ['LINE', [1, 0, -1, -2.5]]];
  defs.ARMATUR = [['CIRCLE', { 10: 0, 20: 0, 30: 0, 40: 1.5 }], ['LINE', [-3, 0, -2, 0]], ['LINE', [2, 0, 3, 0]], ['LINE', [0, -3, 0, -2]], ['LINE', [0, 2, 0, 3]], ['LINE', [-2.1, -2.1, -1.4, -1.4]], ['LINE', [1.4, 1.4, 2.1, 2.1]], ['LINE', [-2.1, 2.1, -1.4, 1.4]], ['LINE', [1.4, -1.4, 2.1, -2.1]]];
  defs.DIGER = [['PLINE', [[0, -2.5], [2.5, 0], [0, 2.5], [-2.5, 0]], true]];
  defs.OLCU = [['LINE', [-1, 0, 1, 0]], ['LINE', [0, -1, 0, 1]]];
  w.g(0, 'SECTION').g(2, 'BLOCKS');
  for (const [name, ents] of Object.entries(defs)) {
    w.g(0, 'BLOCK').g(8, '0').g(2, name).g(70, 0).g(10, 0).g(20, 0).g(30, 0).g(3, name);
    for (const e of ents) writeEnt(w, e);
    w.g(0, 'ENDBLK').g(8, '0');
  }
  w.g(0, 'ENDSEC');
  return Object.keys(defs);
}
function fanSolids(shp) { const out = []; for (let i = 1; i < shp.length - 1; i++) out.push(['SOLID', [shp[0], shp[i], shp[i + 1], shp[i + 1]]]); return out; }
function writeEnt(w, e) {
  const [t, a, b] = e;
  if (t === 'CIRCLE') { w.g(0, 'CIRCLE').g(8, '0').g(62, 0).g(10, 0).g(20, 0).g(30, 0).g(40, f(a[40])); return; }
  if (t === 'LINE') { w.g(0, 'LINE').g(8, '0').g(62, 0).g(10, f(a[0])).g(20, f(a[1])).g(30, 0).g(11, f(a[2])).g(21, f(a[3])).g(31, 0); return; }
  if (t === 'SOLID') { w.g(0, 'SOLID').g(8, '0').g(62, 0); a.forEach((p, i) => w.g(10 + i, f(p[0])).g(20 + i, f(p[1])).g(30 + i, 0)); return; }
  if (t === 'PLINE') { w.g(0, 'POLYLINE').g(8, '0').g(62, 0).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, b ? 1 : 0); for (const p of a) w.g(0, 'VERTEX').g(8, '0').g(10, f(p[0])).g(20, f(p[1])).g(30, 0); w.g(0, 'SEQEND').g(8, '0'); return; }
  if (t === 'DONUT' || t === 'HALFDONUT') {
    // kalın yay polyline (genişlik = r) ile dolu daire / yarım daire
    const r = a / 2;
    w.g(0, 'POLYLINE').g(8, '0').g(62, 0).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, t === 'DONUT' ? 1 : 0).g(40, f(a)).g(41, f(a));
    if (t === 'DONUT') { w.g(0, 'VERTEX').g(8, '0').g(10, f(-r)).g(20, 0).g(30, 0).g(42, 1); w.g(0, 'VERTEX').g(8, '0').g(10, f(r)).g(20, 0).g(30, 0).g(42, 1); }
    else { w.g(0, 'VERTEX').g(8, '0').g(10, 0).g(20, f(r)).g(30, 0).g(42, 1); w.g(0, 'VERTEX').g(8, '0').g(10, 0).g(20, f(-r)).g(30, 0); }
    w.g(0, 'SEQEND').g(8, '0'); return;
  }
  if (t === 'GROUND') {
    const y0 = -a, y1 = y0 - 2.1, hw = 2.35;
    writeEnt(w, ['LINE', [0, y0, 0, y1]]); writeEnt(w, ['LINE', [-hw, y1, hw, y1]]);
    for (let i = 0; i < 4; i++) writeEnt(w, ['LINE', [-hw + (i * hw) / 2, y1 - 1.8, -hw + (i * hw) / 2 + 1, y1]]);
  }
}

export function buildDXF(model, opts = {}) {
  const w = new W();
  const cat = model.cat;
  const th = opts.textH || 1.8;
  const allPts = model.points.filter((p) => p.E != null);
  const ext = allPts.reduce((a, p) => ({ x0: Math.min(a.x0, p.E), y0: Math.min(a.y0, p.N), x1: Math.max(a.x1, p.E), y1: Math.max(a.y1, p.N) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  if (!Number.isFinite(ext.x0)) Object.assign(ext, { x0: 0, y0: 0, x1: 100, y1: 100 });
  w.g(999, 'VOLT-EDAS Saha · ' + (model.project.name || '') + ' · CRS ' + model.crs.label + (model.crs.epsg ? ' EPSG:' + model.crs.epsg : '') + ' · olcek 1/1000 · birim m');
  w.g(0, 'SECTION').g(2, 'HEADER').g(9, '$ACADVER').g(1, 'AC1009').g(9, '$INSBASE').g(10, 0).g(20, 0).g(30, 0)
    .g(9, '$EXTMIN').g(10, f(ext.x0)).g(20, f(ext.y0)).g(30, 0).g(9, '$EXTMAX').g(10, f(ext.x1)).g(20, f(ext.y1)).g(30, 0)
    .g(9, '$DWGCODEPAGE').g(3, 'ANSI_1254').g(9, '$LTSCALE').g(40, 1.0).g(9, '$PDMODE').g(70, 3).g(9, '$PDSIZE').g(40, 0.5).g(0, 'ENDSEC');
  // TABLES
  const layers = legendLayers(model);
  w.g(0, 'SECTION').g(2, 'TABLES');
  w.g(0, 'TABLE').g(2, 'LTYPE').g(70, LTYPES.length);
  for (const [n, d, pat] of LTYPES) {
    w.g(0, 'LTYPE').g(2, n).g(70, 0).g(3, d).g(72, 65).g(73, pat.length).g(40, f(pat.reduce((s, x) => s + Math.abs(x), 0)));
    for (const x of pat) w.g(49, f(x));
  }
  w.g(0, 'ENDTAB');
  w.g(0, 'TABLE').g(2, 'LAYER').g(70, layers.length + 1);
  w.g(0, 'LAYER').g(2, '0').g(70, 0).g(62, 7).g(6, 'CONTINUOUS');
  for (const l of layers) w.g(0, 'LAYER').g(2, l.name).g(70, 0).g(62, l.aci).g(6, l.lt);
  w.g(0, 'ENDTAB');
  w.g(0, 'TABLE').g(2, 'STYLE').g(70, 1).g(0, 'STYLE').g(2, 'STANDARD').g(70, 0).g(40, 0).g(41, 1).g(50, 0).g(71, 0).g(42, th).g(3, 'txt').g(4, '').g(0, 'ENDTAB');
  w.g(0, 'ENDSEC');
  blocks(w);
  // ENTITIES
  w.g(0, 'SECTION').g(2, 'ENTITIES');
  const text = (layer, x, y, z, s, h = th, rot = 0, color = null) => { w.g(0, 'TEXT').g(8, layer); if (color != null) w.g(62, color); w.g(10, f(x)).g(20, f(y)).g(30, f(z || 0)).g(40, f(h)).g(1, s).g(50, f(rot)); };
  const insert = (layer, block, x, y, z, color = null, rot = 0) => { w.g(0, 'INSERT').g(8, layer); if (color != null) w.g(62, color); w.g(2, block).g(10, f(x)).g(20, f(y)).g(30, f(z || 0)).g(41, 1).g(42, 1).g(43, 1).g(50, f(rot)); };
  const kesitFmt = (cat.table('legend') || {}).kesit || { MEVCUT: '({t})', YENI: '{t}', ILERIDE: '<{t}>', DMM: '[{t}]' };
  let nLines = 0, nIns = 0, nTxt = 0;
  for (const l of model.lines) {
    if (l.coords.length < 2) continue;
    const layer = lineLayer(l), lt = l.state === 'ILERIDE' ? 'DASHED' : null;
    for (let i = 0; i < l.coords.length - 1; i++) {
      const a = l.coords[i], b = l.coords[i + 1];
      w.g(0, 'LINE').g(8, layer); if (lt) w.g(6, lt); if (l.state === 'DEMONTAJ') w.g(62, 2);
      w.g(10, f(a.E)).g(20, f(a.N)).g(30, f(a.H || 0)).g(11, f(b.E)).g(21, f(b.N)).g(31, f(b.H || 0)); nLines++;
      if (opts.spanText !== false) {
        const mx = (a.E + b.E) / 2, my = (a.N + b.N) / 2; let ang = Math.atan2(b.N - a.N, b.E - a.E) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        const d = Math.hypot(b.E - a.E, b.N - a.N);
        text('ELEKTRIK-YAZI', mx, my + 0.8, 0, d.toFixed(2), th * 0.8, ang); nTxt++;
      }
    }
    const mid = Math.floor((l.coords.length - 1) / 2), a = l.coords[mid], b = l.coords[mid + 1];
    let ang = Math.atan2(b.N - a.N, b.E - a.E) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const tag = (kesitFmt[l.state] || '{t}').replace('{t}', l.label);
    text('ELEKTRIK-YAZI', (a.E + b.E) / 2, (a.N + b.N) / 2 - 2.5, 0, l.no + ' ' + tag, th, ang); nTxt++;
  }
  for (const e of model.equipment) {
    if (e.E == null) continue;
    let layer, block, color = null;
    const m = mode(e.state);
    if (e.kind === 'pole' || e.kind === 'lighting') {
      const volt = e.kind === 'lighting' || e.group === 'ayd' ? 'AYD' : e.volt === 'OG' ? 'OG' : 'AG';
      layer = poleLayer(e);
      block = (volt === 'AYD' ? 'DIREK_AYD_' : e.symbol === 's' ? (volt === 'OG' ? 'KAFES_OG_' : 'KAFES_AG_') : (volt === 'OG' ? 'DIREK_OG_' : 'DIREK_AG_')) + m;
      color = POLE_ACI[volt][stIdx(e.state)];
    } else if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') {
      layer = 'ELEKTRIK-TRAFO';
      const post = (e.attrs || {}).post || 'direk';
      block = (post === 'direk' ? 'TRAFO_DIREK' : post === 'bina' || post === 'ba' ? 'TRAFO_BINA' : 'TRAFO_KOSK') + (e.state === 'yeni' ? '_FULL' : '_NONE');
    } else if (e.kind === 'sdk') { layer = 'ELEKTRIK-SDK'; block = e.state === 'YENI' ? 'SDK_FULL' : 'SDK_NONE'; }
    else if (e.kind === 'manhole') { layer = 'ELEKTRIK-KABLO'; block = 'MENHOL'; }
    else if (e.kind === 'panel') { layer = 'ELEKTRIK-SDK'; block = 'PANO'; }
    else if (e.kind === 'luminaire') { layer = 'ELEKTRIK-DIREK-AYD'; block = 'ARMATUR'; color = 4; }
    else if (e.kind === 'other') { layer = 'ELEKTRIK-YAZI'; block = 'DIGER'; }
    else { layer = 'ELEKTRIK-YAZI'; block = 'ABONE'; }
    insert(layer, block, e.E, e.N, e.H, color); nIns++;
    if (e.state === 'DEMONTAJ' || e.state === 'demontaj') { w.g(0, 'LINE').g(8, 'ELEKTRIK-DEMONTAJ').g(62, 2).g(10, f(e.E - 5)).g(20, f(e.N - 5)).g(30, 0).g(11, f(e.E + 5)).g(21, f(e.N + 5)).g(31, 0); }
    text('ELEKTRIK-YAZI', e.E + 3.5, e.N + 3, e.H, e.no + (e.typeName ? ' ' + e.typeName : ''), th, 0); nTxt++;
    if (e.role === 'Z' && e.angle) { text('ELEKTRIK-YAZI', e.E + 3.5, e.N + 0.6, e.H, 'α=' + e.angle.toFixed(2) + '°', th * 0.7); nTxt++; }
  }
  for (const p of model.points) {
    if (p.E == null) continue;
    w.g(0, 'POINT').g(8, 'OLCU-NOKTA').g(10, f(p.E)).g(20, f(p.N)).g(30, f(p.H || 0));
    if (opts.pointText !== false && !model.equipment.some((e) => e.pointId === p.id)) { text('OLCU-NOKTA', p.E + 1, p.N + 1, p.H, p.no + ' ' + (p.H != null ? (+p.H).toFixed(2) : ''), th * 0.7); nTxt++; }
  }
  w.g(0, 'ENDSEC').g(0, 'EOF');
  const txt = w.text();
  return { text: txt, stats: { layers: layers.length + 1, lines: nLines, inserts: nIns, texts: nTxt } };
}

// Türkçe karakterler için Windows-1254 kodlaması (R12 DXF); tabloda olmayanlar AutoCAD \U+XXXX kaçışı ile
const CP1254 = { 0x011E: 0xd0, 0x0130: 0xdd, 0x015e: 0xde, 0x011f: 0xf0, 0x0131: 0xfd, 0x015f: 0xfe, 0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };
export function dxfBytes(text) {
  const out = [];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (CP1254[c] !== undefined) out.push(CP1254[c]);
    else if (c >= 0xa0 && c <= 0xff && ![0xd0, 0xdd, 0xde, 0xf0, 0xfd, 0xfe].includes(c)) out.push(c);
    else for (const b of ('\\U+' + c.toString(16).toUpperCase().padStart(4, '0'))) out.push(b.charCodeAt(0));
  }
  return new Uint8Array(out);
}
