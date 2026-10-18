// AutoCAD DXF (R12 / AC1009) üretici — Lejant.dxf katman, ACI, çizgi tipi ve sembol yapısıyla.
// Koordinatlar proje CRS'inde: X = Sağa (E), Y = Yukarı (N), Z = kot (H). Ölçek 1/1000 (yazı 1.8 m = 1.8 mm).
// Simgeler ve stil ortak tablolardan gelir (ortak/katalog/semboller.json → semboller.js, cizim-stili.json →
// cizim-stili.js): AutoCAD eklentisi aynı blokları aynı adla (SH_…) tanımlar, aynı renk / çizgi tipi / yazı
// düzenini kullanır; böylece telefonun DXF'i ile eklentinin çizimi birebir aynı görünür.
import SEMBOLLER from '../ortak/semboller.js';
import STIL from '../ortak/cizim-stili.js';
const f = (v) => (Number.isFinite(v) ? (+v).toFixed(4) : '0.0');

class W {
  constructor() { this.o = []; }
  g(code, val) { this.o.push(String(code), String(val)); return this; }
  text() { return this.o.join('\r\n') + '\r\n'; }
}

const LT_ACIKLAMA = { CONTINUOUS: 'Solid line', DASHED: '__ __ __', DASHDOT: '__ . __ .', DOT: '. . . .', HIDDEN: '_ _ _ _' };
const LTYPES = Object.entries(STIL.cizgiTipleri).map(([n, pat]) => [n, LT_ACIKLAMA[n] || n, pat]);

/** Katman tablosu: ortak stildeki telefon katmanları (aynı ada ilk giren kazanır). */
export function legendLayers() {
  const out = [], seen = new Set();
  for (const k of Object.values(STIL.katmanlar)) {
    if (!k.telefon || seen.has(k.telefon)) continue;
    seen.add(k.telefon);
    out.push({ name: k.telefon, aci: k.aci, lt: k.cizgi || 'CONTINUOUS' });
  }
  return out;
}
const KAT = (anahtar) => STIL.katmanlar[anahtar].telefon;
const poleLayer = (e) => (e.kind === 'lighting' || e.group === 'ayd' ? KAT('DIREK_AYD') : e.volt === 'OG' ? (e.group === 'mus' ? KAT('DIREK_MUSTEREK') : KAT('DIREK_OG')) : KAT('DIREK_AG'));
const lineLayer = (l) => (l.install === 'yeralti' ? KAT('KABLO') : { AG: KAT('HAT_AG'), OG: KAT('HAT_OG'), AYD: KAT('HAT_AYD'), ENH: KAT('HAT_ENH'), ABONE: KAT('HAT_ABONE') }[l.lineType] || KAT('HAT_AG'));
// Direk rengi: mevcut / yeni / DMM (ortak stil)
const POLE_ACI = STIL.direkRenkleri;
const DEMONTAJ_ACI = STIL.direkRenkleri.demontaj;
const stIdx = (st) => (st === 'YENI' ? 1 : st === 'DMM' ? 2 : 0);
const YAZI = () => KAT('YAZI'), OLCU = () => KAT('OLCU');

/** Demontaj türünden (KESİK / SÖKÜK) demontaj varyantı: DM · KESIK · SOKUK (eklentideki Semboller.Varyant ile aynı). */
export function dmVaryanti(dmDurum) {
  const d = String(dmDurum || '').trim().toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ü/g, 'U');
  if (d.startsWith('KES')) return 'KESIK';
  if (d.startsWith('SOK')) return 'SOKUK';
  return 'DM';
}

/**
 * Sembol varyantı: durumdan (ekipman ve hat durum kodları → YENI · MEVCUT · DMM · DM · KESIK · SOKUK). PROMAGIS durumu
 * verilmişse eklentiyle aynı kural: M, M+M, KM, ENH, ME → YENI · DM → DM (KESİK → KESIK, SÖKÜK → SOKUK) · DM+M → DMM ·
 * MEVCUT → MEVCUT.
 */
export function sembolVaryanti(state, promagisDurumu, dmDurum) {
  const pd = String(promagisDurumu || '').toUpperCase();
  if (pd === 'M' || pd === 'M+M' || pd === 'KM' || pd === 'ENH' || pd === 'ME') return 'YENI';
  if (pd === 'DM') return dmVaryanti(dmDurum);
  if (pd === 'DM+M') return 'DMM';
  if (pd === 'MEVCUT') return 'MEVCUT';
  const st = String(state || '').toUpperCase();
  if (st === 'YENI') return 'YENI';
  if (st === 'DMM' || st === 'TASINAN') return 'DMM';
  if (st === 'DEMONTAJ') return dmVaryanti(dmDurum);
  return 'MEVCUT'; // MEVCUT, ILERIDE, güç/gerilim değişen, tadil…
}
/** Ekipmanın sembol ailesi (ortak tablo adları). */
export function sembolAilesi(e) {
  if (e.kind === 'pole' || e.kind === 'lighting') {
    const volt = e.kind === 'lighting' || e.group === 'ayd' ? 'AYD' : e.volt === 'OG' ? 'OG' : 'AG';
    if (volt === 'AYD') return 'DIREK_AYD';
    return (e.symbol === 's' ? 'KAFES_' : 'DIREK_') + volt;
  }
  if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') {
    const post = (e.attrs || {}).post || 'direk';
    return post === 'direk' ? 'TRAFO_DIREK' : post === 'bina' || post === 'ba' ? 'TRAFO_BINA' : 'TRAFO_KOSK';
  }
  if (e.kind === 'sdk') return 'SDK';
  if (e.kind === 'manhole') return 'MENHOL';
  if (e.kind === 'panel') return 'PANO';
  if (e.kind === 'luminaire') return 'ARMATUR';
  if (e.kind === 'other') return 'DIGER';
  return 'ABONE';
}
/** Ekipmanın blok adı: SH_<aile>_<varyant> (eklentiyle aynı); demontajda türü (KESİK / SÖKÜK) ayrı simgedir. */
export function sembolBlogu(e) {
  const st = e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation' ? { yeni: 'YENI', tasinan: 'DMM', demontaj: 'DEMONTAJ' }[e.state] || 'MEVCUT' : e.state;
  return 'SH_' + sembolAilesi(e) + '_' + sembolVaryanti(st, e.promagisDurumu, (e.attrs || {}).dmDurum);
}

function blocks(w) {
  const defs = {};
  for (const [name, ilkeller] of Object.entries(SEMBOLLER.semboller)) {
    const ents = [];
    for (const i of ilkeller) {
      const t = i[0];
      if (t === 'L') ents.push(['LINE', [i[1], i[2], i[3], i[4]]]);
      else if (t === 'C') ents.push(['CIRCLE', { 10: i[1], 20: i[2], 30: 0, 40: i[3] }]);
      else if (t === 'P') ents.push(['PLINE', i[1], !!i[2]]);
      else if (t === 'S') ents.push(['SOLID', i[1]]);
      else if (t === 'D') ents.push(['DONUT', i[1]]);
      else if (t === 'Y') ents.push(['HALFDONUT', i[1]]);
    }
    defs['SH_' + name] = ents;
  }
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
function writeEnt(w, e) {
  const [t, a, b] = e;
  if (t === 'CIRCLE') { w.g(0, 'CIRCLE').g(8, '0').g(62, 0).g(10, f(a[10])).g(20, f(a[20])).g(30, 0).g(40, f(a[40])); return; }
  if (t === 'LINE') { w.g(0, 'LINE').g(8, '0').g(62, 0).g(10, f(a[0])).g(20, f(a[1])).g(30, 0).g(11, f(a[2])).g(21, f(a[3])).g(31, 0); return; }
  if (t === 'SOLID') { w.g(0, 'SOLID').g(8, '0').g(62, 0); a.forEach((p, i) => w.g(10 + i, f(p[0])).g(20 + i, f(p[1])).g(30 + i, 0)); return; }
  if (t === 'PLINE') { w.g(0, 'POLYLINE').g(8, '0').g(62, 0).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, b ? 1 : 0); for (const p of a) w.g(0, 'VERTEX').g(8, '0').g(10, f(p[0])).g(20, f(p[1])).g(30, 0); w.g(0, 'SEQEND').g(8, '0'); return; }
  if (t === 'DONUT' || t === 'HALFDONUT') {
    // kalın yay polyline (genişlik = r) ile dolu daire / yarım daire (eklentideki blok çizimiyle aynı)
    const r = a / 2;
    w.g(0, 'POLYLINE').g(8, '0').g(62, 0).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, t === 'DONUT' ? 1 : 0).g(40, f(a)).g(41, f(a));
    if (t === 'DONUT') { w.g(0, 'VERTEX').g(8, '0').g(10, f(-r)).g(20, 0).g(30, 0).g(42, 1); w.g(0, 'VERTEX').g(8, '0').g(10, f(r)).g(20, 0).g(30, 0).g(42, 1); }
    else { w.g(0, 'VERTEX').g(8, '0').g(10, 0).g(20, f(r)).g(30, 0).g(42, 1); w.g(0, 'VERTEX').g(8, '0').g(10, 0).g(20, f(-r)).g(30, 0); }
    w.g(0, 'SEQEND').g(8, '0'); return;
  }
}

export function buildDXF(model, opts = {}) {
  const w = new W();
  const cat = model.cat;
  const th = opts.textH || STIL.yazi.yukseklik;
  const thParca = th * (STIL.yazi.parcaMetraji / STIL.yazi.yukseklik), thKucuk = th * (STIL.yazi.aciYazisi / STIL.yazi.yukseklik);
  const [pdx, pdy] = STIL.etiketler.parcaMetraji.kaydirma, [hdx, hdy] = STIL.etiketler.hat.kaydirma, [edx, edy] = STIL.etiketler.eleman.kaydirma, [adx, ady] = STIL.etiketler.aci.kaydirma;
  const allPts = model.points.filter((p) => p.E != null);
  const ext = allPts.reduce((a, p) => ({ x0: Math.min(a.x0, p.E), y0: Math.min(a.y0, p.N), x1: Math.max(a.x1, p.E), y1: Math.max(a.y1, p.N) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  if (!Number.isFinite(ext.x0)) Object.assign(ext, { x0: 0, y0: 0, x1: 100, y1: 100 });
  w.g(999, 'VOLT-EDAS Saha · ' + (model.project.name || '') + ' · CRS ' + model.crs.label + (model.crs.epsg ? ' EPSG:' + model.crs.epsg : '') + ' · olcek 1/1000 · birim m');
  w.g(0, 'SECTION').g(2, 'HEADER').g(9, '$ACADVER').g(1, 'AC1009').g(9, '$INSBASE').g(10, 0).g(20, 0).g(30, 0)
    .g(9, '$EXTMIN').g(10, f(ext.x0)).g(20, f(ext.y0)).g(30, 0).g(9, '$EXTMAX').g(10, f(ext.x1)).g(20, f(ext.y1)).g(30, 0)
    .g(9, '$DWGCODEPAGE').g(3, 'ANSI_1254').g(9, '$LTSCALE').g(40, 1.0).g(9, '$PDMODE').g(70, 3).g(9, '$PDSIZE').g(40, 0.5).g(0, 'ENDSEC');
  // TABLES
  const layers = legendLayers();
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
  const kesitFmt = STIL.etiketler.kesit;
  let nLines = 0, nIns = 0, nTxt = 0;
  for (const l of model.lines) {
    if (l.coords.length < 2) continue;
    const layer = lineLayer(l), lt = l.state === 'ILERIDE' ? 'DASHED' : null;
    for (let i = 0; i < l.coords.length - 1; i++) {
      const a = l.coords[i], b = l.coords[i + 1];
      w.g(0, 'LINE').g(8, layer); if (lt) w.g(6, lt); if (l.state === 'DEMONTAJ') w.g(62, DEMONTAJ_ACI);
      w.g(10, f(a.E)).g(20, f(a.N)).g(30, f(a.H || 0)).g(11, f(b.E)).g(21, f(b.N)).g(31, f(b.H || 0)); nLines++;
      if (opts.spanText !== false) {
        const mx = (a.E + b.E) / 2, my = (a.N + b.N) / 2; let ang = Math.atan2(b.N - a.N, b.E - a.E) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        const d = Math.hypot(b.E - a.E, b.N - a.N);
        text(YAZI(), mx + pdx, my + pdy, 0, d.toFixed(2), thParca, ang); nTxt++;
      }
    }
    const mid = Math.floor((l.coords.length - 1) / 2), a = l.coords[mid], b = l.coords[mid + 1];
    let ang = Math.atan2(b.N - a.N, b.E - a.E) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const tag = (kesitFmt[l.state] || '{t}').replace('{t}', l.label);
    text(YAZI(), (a.E + b.E) / 2 + hdx, (a.N + b.N) / 2 + hdy, 0, l.no + ' ' + tag, th, ang); nTxt++;
  }
  for (const e of model.equipment) {
    if (e.E == null) continue;
    let layer, color = null;
    const block = sembolBlogu(e); // demontajda çapraz çizgi bloğun içindedir (SH_…_DM)
    if (e.kind === 'pole' || e.kind === 'lighting') {
      const volt = e.kind === 'lighting' || e.group === 'ayd' ? 'AYD' : e.volt === 'OG' ? 'OG' : 'AG';
      layer = poleLayer(e);
      color = POLE_ACI[volt][stIdx(e.state)];
    } else if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') layer = KAT('TRAFO');
    else if (e.kind === 'sdk' || e.kind === 'panel') layer = KAT('SDK');
    else if (e.kind === 'manhole') layer = KAT('KABLO');
    else if (e.kind === 'luminaire') { layer = KAT('DIREK_AYD'); color = STIL.nesneRenkleri.armatur; }
    else layer = YAZI();
    if (e.state === 'DEMONTAJ' || e.state === 'demontaj') color = DEMONTAJ_ACI;
    insert(layer, block, e.E, e.N, e.H, color); nIns++;
    text(YAZI(), e.E + edx, e.N + edy, e.H, e.no + (e.typeName ? ' ' + e.typeName : ''), th, 0); nTxt++;
    if (e.role === 'Z' && e.angle) { text(YAZI(), e.E + adx, e.N + ady, e.H, 'α=' + e.angle.toFixed(2) + '°', thKucuk); nTxt++; }
  }
  for (const p of model.points) {
    if (p.E == null) continue;
    w.g(0, 'POINT').g(8, OLCU()).g(10, f(p.E)).g(20, f(p.N)).g(30, f(p.H || 0));
    if (opts.pointText !== false && !model.equipment.some((e) => e.pointId === p.id)) { text(OLCU(), p.E + 1, p.N + 1, p.H, p.no + ' ' + (p.H != null ? (+p.H).toFixed(2) : ''), th * (STIL.yazi.noktaYazisi / STIL.yazi.yukseklik)); nTxt++; }
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
