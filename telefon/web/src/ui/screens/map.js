// 01 · Harita & Nokta Alımı — gerçek GIS motoru + tek elle hızlı ekipman/hat alımı.
import { html, useState, useEffect, useRef, useBus, Icon, Chip, Seg, Toggle, Sel, Badge, fmt, trn, FIXCOL } from '../kit.js';
import { app } from '../ctx.js';
import { MapEngine } from '../map-engine.js';
import { measure, recent, favorites, loadTile, BASEMAPS, ALTLIK_GRUPLARI, basemapById, basemapReady, basemapAttr, tileErrors } from '../services.js';
import { dist2, bearing, polygonArea, polylineLength, dms, segProject } from '../../geo/geom.js';
import { STATUSES, TRAFO_STATUSES, HAK_STATUSES, HAK_ORDER, EQUIPMENT_KINDS, hakOf } from '../../core/schema.js';
import { sourceInfo, sourceText } from '../../core/source.js';
import { resolveCoord, crsChoices, luminairePoz } from '../../services/survey-service.js';
import { lineLabel, KAPLAMA, YONTEM } from '../../grid/lines.js';
import { koskGovdeleri } from '../../grid/cabin-recipe.js';
import { KABIN_POSTLARI } from './cabin.js';
import { roleLabel } from '../../grid/checks.js';
import { jobOf } from '../../grid/recipe.js';
import { armsOfPoint } from './tepe.js';
import { HakRow } from './team.js';
import { energize, levelsOf } from '../../grid/energize.js';
import { cadDocs, importCad, visibleCad, setCad, removeCad, cadModel, snapCad, cadArms } from '../../services/cad-service.js';

const GEN = { AG: ['sehir', 'beton', 'agac'], OG: ['bahh', 'civ', 'beton562', 'agac'], MUS: ['mus', 'beton', 'agac'], AYD: ['ayd'] };
const GCOL = { AG: '#7ee08a', OG: '#ff8a8a', MUS: '#ff8a8a', AYD: '#7fffff', ENH: '#ff9aff', ABONE: '#fbbf24' };
const ST_COL = { YENI: '#10b981', MEVCUT: '#cbd5e1', DMM: '#f59e0b', DEMONTAJ: '#ffff00', ILERIDE: '#94a3b8' };

// Enerji kontrolü sonucu: veri ya da ayar değişmedikçe yeniden hesaplanmaz
let energyMemo = { key: null, val: null };
export function energyState() {
  const ps = app.ps, cfg = app.state.energyCfg;
  if (!cfg || !(cfg.og || cfg.ag) || !ps.p) return null;
  const src = ps.p.energy || {};
  const key = ps.p.id + '|' + (ps.result ? ps.result.signature : '') + '|' + JSON.stringify(cfg) + '|' + JSON.stringify(src) + '|' + ps.data.lines.map((l) => (l.energyOpen ? l.id : '')).join('');
  if (energyMemo.key !== key) energyMemo = { key, val: energize(ps.data, Object.assign({}, cfg, { ogSources: src.og || [], agSources: src.ag || [] })) };
  return energyMemo.val;
}
export function mapData() {
  const ps = app.ps;
  const d = ps.data, r = ps.result;
  const pointMap = new Map(d.points.map((p) => [p.id, p]));
  const eqByPoint = new Map();
  for (const e of d.equipment) { if (!eqByPoint.has(e.pointId)) eqByPoint.set(e.pointId, []); eqByPoint.get(e.pointId).push(e); }
  const bm = basemapById(app.state.basemap || 'none');
  const g = app.gnss.state;
  return {
    points: d.points, equipment: d.equipment, lines: d.lines, pointMap, eqByPoint, roles: r ? r.roles : new Map(),
    hakColor: (rec) => { const h = hakOf(rec); return h ? HAK_STATUSES[h].color : null; }, srcInfo: (p) => sourceInfo(p),
    sel: app.state.sel, target: app.state.target, crs: ps.p.crs, basemap: basemapReady(bm) ? bm : null,
    cad: app.state.cadLayers || [], energy: energyState(),
    gnss: g.E != null ? g : null, gnssColor: g.source === 'phone' ? '#38bdf8' : FIXCOL[g.fix] || '#475569',
    groupVolt: (e) => { if (e.kind === 'lighting' || e.group === 'ayd') return 'AYD'; const gr = ps.cat.poleGroup(e.group); return gr && gr.og ? 'OG' : 'AG'; },
    groupSymbol: (e) => { const gr = ps.cat.poleGroup(e.group); return gr ? gr.symbol : 'c'; }
  };
}

export function MapScreen() {
  const ps = app.ps;
  const cv = useRef(null), eng = useRef(null), base = useRef(null);
  const [panel, setPanel] = useState(null); // null | 'pick' (ne alınacak) | 'line' (hat)
  const [kind, setKindS] = useState(app.state.capKind || 'direk');
  const [srcMode, setSrcModeS] = useState(app.state.srcMode || 'gnss'); // gnss (harici/telefon) | manual | map
  const [tool, setTool] = useState(null);
  if (app.state.follow === undefined) app.state.follow = true;
  const [follow, setFollow] = useState(!!app.state.follow);
  const [layersOpen, setLayersOpen] = useState(false);
  const [measuring, setMeasuring] = useState(null);
  const [padB, setPadB] = useState(150);
  const [busy, setBusy] = useState(false);
  const [lastCap, setLastCap] = useState(app.state.lastCap || null);
  const [, force] = useState(0);
  useBus(['project:computed', 'project:open', 'ui:sel', 'cad:change', 'tiles:error']);
  useBus('gnss:state', 300);
  // CAD çizimleri: görünür olanları belleğe al, haritaya ver
  const refreshCad = async () => { try { app.state.cadLayers = await visibleCad(ps); } catch (err) { app.state.cadLayers = []; } if (eng.current) eng.current.invalidate(); force((x) => x + 1); };
  useEffect(() => { refreshCad(); const off = app.bus.on('cad:reload', refreshCad); return off; }, []);
  useEffect(() => {
    const e = new MapEngine(cv.current, {
      getData: mapData,
      loadTile,
      onTap: (w, hit, snap) => onTap(w, hit, snap),
      onLongPress: (w, hit) => onLong(w, hit),
      onFollow: (f) => { setFollow(f); app.state.follow = f; },
      onView: (v) => { app.state.view = Object.assign({}, v); },
      editNodes: false,
      canDrag: () => app.state.tool === 'edit',
      onDragNode: (hit, pos) => onDrag(hit, pos)
    });
    eng.current = e; app.state.mapEngine = e;
    // Alt panelin kapattığı alan: konum ve sığdırma her zaman GÖRÜNEN haritanın ortasına göre yapılır
    const el = base.current;
    const side = () => app.web && typeof matchMedia === 'function' && matchMedia('(min-width:900px)').matches;   // web geniş ekran: panel sağda yüzer, haritayı alttan kapatmaz
    const syncPad = () => { if (!el) return; const h = side() ? 0 : el.getBoundingClientRect().height; e.setPad({ bottom: h }); setPadB(Math.round(h)); };
    syncPad();
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(syncPad) : null;
    if (ro) ro.observe(el);
    if (app.web) window.addEventListener('resize', syncPad);
    const G0 = app.gnss.state;
    if (app.state.follow && G0.E != null) e.center(G0.E, G0.N, app.state.view ? app.state.view.res : 0.4);
    else if (app.state.view) e.center(app.state.view.cE, app.state.view.cN, app.state.view.res);
    else if (!e.fit(ps.data.points)) { if (G0.E != null) e.center(G0.E, G0.N, 0.4); else e.center(500000, 4280000, 50); }
    if (app.state.layers) Object.assign(e.layers, app.state.layers);
    let first = !app.state.view && !ps.data.points.length;
    const off1 = app.bus.on('gnss:state', () => { const G = app.gnss.state; if (G.E != null && (app.state.follow || first)) { e.center(G.E, G.N, first ? 0.4 : undefined); first = false; } e.invalidate(); });
    const off5 = app.bus.on('data:change', (c) => { if (c.store === 'points' && c.op === 'create' && c.after && c.after.E != null && !e.inView(c.after.E, c.after.N, 30)) e.center(c.after.E, c.after.N); });
    const off2 = app.bus.on('project:computed', () => e.invalidate());
    const off3 = app.bus.on('ui:measuring', (m) => setMeasuring(m));
    const off4 = app.bus.on('ui:measureProgress', (p) => setMeasuring((m) => (m ? Object.assign({}, m, p) : m)));
    return () => { off1(); off2(); off3(); off4(); off5(); if (ro) ro.disconnect(); if (app.web) window.removeEventListener('resize', syncPad); e.destroy(); };
  }, []);
  // v2.4: otomatik reçete artık proje ayarı (varsayılan kapalı). Önceki sürümde oluşturulmuş, içinde kayıt olan projede bir kez sorulur;
  // kullanıcı seçene kadar hesap eski düzende (açık) kalır → metraj sessizce değişmez.
  const pid = ps.p ? ps.p.id : null, rcp = ps.p ? ps.p.autoRecipe : null;
  useEffect(() => {
    if (!pid || rcp !== undefined) return;
    if ((app.state.recipeAsked || {})[pid]) return;
    let n = 0, tm = null, dead = false;
    const ask = async () => {
      if (dead) return;
      // Uygulama haritayla açıldığında proje verisi ve pencere katmanı henüz hazır olmayabilir → hazır olana kadar bekle
      if (ps.openedId !== pid || !app.modal || app.modalOpen) { if (++n < 40) tm = setTimeout(ask, 500); return; }
      if (!ps.p || ps.p.id !== pid || ps.p.autoRecipe !== undefined) return;
      // içi boş eski proje: sorulacak bir şey yok → yeni düzen
      if (!(ps.data.equipment.length + ps.data.lines.length)) { ps.updateProject({ autoRecipe: false }, 'Otomatik reçete kapalı').catch(() => {}); return; }
      app.state.recipeAsked = Object.assign({}, app.state.recipeAsked, { [pid]: true });
      const r = await app.modal((close) => html`<div class="mh"><h3>Otomatik malzeme reçetesi</h3></div><div class="mb"><div class="alert info">Bu sürümde otomatik malzeme reçetesi kaldırıldı: objede yalnız seçtiğiniz kalemler gelir, diğer malzemeleri siz eklersiniz.</div><div class="note">Bu proje önceki sürümde oluşturuldu ve metrajında kurala göre eklenmiş yardımcı malzemeler (travers, izolatör, topraklama, kum, bant…) var. Kapatırsanız bu kalemler metrajdan çıkar. Seçiminizi sonradan Proje bilgileri ekranından değiştirebilirsiniz.</div></div>
        <div class="mf"><button class="btn grow" onClick=${() => close('on')}>Bu projede açık kalsın</button><button class="btn pri grow" onClick=${() => close('off')}>Kapat (yeni düzen)</button></div>`);
      if (!r || !ps.p || ps.p.id !== pid) { app.state.recipeAsked[pid] = false; return; }
      await ps.updateProject({ autoRecipe: r === 'on' }, 'Otomatik reçete: ' + (r === 'on' ? 'açık' : 'kapalı'));
      app.toast(r === 'on' ? 'Bu projede otomatik reçete açık bırakıldı' : 'Otomatik reçete kapatıldı · metraj güncellendi', 'ok', 4000);
    };
    tm = setTimeout(ask, 500);
    return () => { dead = true; clearTimeout(tm); };
  }, [pid, rcp]);
  // v2.2: GEÇİŞ özelliği kaldırıldı → eski projede kayıt varsa bir kez sor: detay noktasına dönüştür / arşivle
  useEffect(() => {
    const leg = ps.legacyCrossings ? ps.legacyCrossings() : [];
    if (!leg.length || (app.state.crossAsked || {})[ps.p.id]) return;
    app.state.crossAsked = Object.assign({}, app.state.crossAsked, { [ps.p.id]: true });
    // Uygulama haritayla açıldığında pencere katmanı henüz hazır olmayabilir → kısa gecikme
    const tm = setTimeout(async () => {
      if (!app.modal) return;
      const r = await app.modal((close) => html`<div class="mh"><h3>Geçiş kayıtları</h3></div><div class="mb"><div class="alert info">Bu sürümde "Geçiş" özelliği kaldırıldı. Projede ${leg.length} eski geçiş kaydı var.</div><div class="note">Detay noktasına dönüştürürseniz konumları haritada "Detay noktası" olarak kalır (açıklaması not olarak yazılır). Arşivlerseniz yalnızca veritabanında saklanır, haritada görünmez.</div></div>
        <div class="mf"><button class="btn grow" onClick=${() => close('archive')}>Arşivle</button><button class="btn pri grow" onClick=${() => close('detail')}>Detay noktasına dönüştür</button></div>`);
      if (!r) return;
      const res = await ps.convertLegacyCrossings(r);
      app.toast(r === 'detail' ? res.made + ' geçiş detay noktasına dönüştürüldü' : res.archived + ' geçiş arşivlendi', 'ok', 4000);
    }, 400);
    return () => clearTimeout(tm);
  }, []);
  const back = useRef(null);
  back.current = () => { if (panel) { setPanel(null); return true; } if (app.state.sel) { select(null); return true; } if (tool) { setTool(null); return true; } return false; };
  useEffect(() => { app.backHook = () => back.current(); return () => { app.backHook = null; }; }, []);
  useEffect(() => { if (eng.current) { eng.current.o.editNodes = tool === 'edit'; app.state.tool = tool; if (tool !== 'measure' && tool !== 'area') eng.current.measure = null; else if (!eng.current.measure) eng.current.measure = { mode: tool, pts: [] }; eng.current.invalidate(); } }, [tool]);

  const setSrcMode = (m) => { setSrcModeS(m); app.state.srcMode = m; if (m === 'map') { setFollow(false); app.state.follow = false; } };
  if (eng.current) eng.current.crosshair = srcMode === 'map' && !app.state.sel && !tool;
  // Konum edinme: seçili veri kaynağına göre ölçüm / elle giriş / haritadan nişangâh
  const acquire = async ({ critical = true, label = 'Nokta' } = {}) => {
    if (app.state.forceCoord) { const c = app.state.forceCoord; app.state.forceCoord = null; return { coord: { E: c.E, N: c.N, H: null }, source: 'MAP' }; }
    if (srcMode === 'map') { const e = eng.current; const w = e.toWorld(e.w / 2, e.cy()); return { coord: { E: w.E, N: w.N, H: null }, source: 'MAP' }; }
    if (srcMode === 'manual') { const c = await manualCoordModal(label); return c ? { coord: c, source: 'MANUAL' } : null; }
    const obs = await measure({ critical, label });
    return obs ? { obs } : null;
  };
  // Alım modelleri (form durumu panel kapalıyken de yaşar → ALIM düğmesi her zaman hazır)
  const pole = usePole(), trafo = useTrafo(), other = useOther();
  const cur = kind === 'trafo' ? trafo : kind === 'diger' ? other : pole;
  const setKind = (k) => { setKindS(k); app.state.capKind = k; };

  // Aktif hat + önizleme (son düğümden bulunduğun yere kesik çizgi)
  const active = app.state.activeLineId ? ps.lineById(app.state.activeLineId) : null;
  const toLine = app.state.toLine !== false;
  if (eng.current) {
    const g = app.gnss.state;
    const last = active && active.nodes.length ? ps.pointById(active.nodes[active.nodes.length - 1]) : null;
    eng.current.preview = last && g.E != null && toLine ? { from: last, to: g, color: GCOL[active.lineType] } : null;
    eng.current.invalidate();
  }

  const select = (s) => { app.state.sel = s; app.bus.emit('ui:sel'); if (eng.current) eng.current.invalidate(); if (s) setPanel(null); };
  async function onTap(w, hit, snap) {
    const t = app.state.tool;
    if (t === 'measure' || t === 'area') { eng.current.measure.pts.push(snap ? { E: snap.E, N: snap.N } : w); eng.current.invalidate(); force((x) => x + 1); return; }
    if (hit) select(hit.kind === 'line' ? { type: 'line', id: hit.ref.id, seg: hit.seg } : { type: 'point', id: hit.ref.id });
    else {
      // Uygulama objesi yoksa: CAD çiziminde en yakın uç / köşe / merkez noktasına yapış
      const cl = eng.current.layers.cad !== false ? app.state.cadLayers || [] : [];
      const sn = cl.length ? snapCad(cl, w.E, w.N, 18 * eng.current.view.res) : null;
      select(sn ? { type: 'cad', docId: sn.docId, x: sn.x, y: sn.y, kind: sn.kind, layer: sn.layer, text: sn.text } : null);
    }
  }
  async function onLong(w) {
    const r = await app.modal((close) => html`<div class="mh"><h3>Haritada nokta</h3></div><div class="mb"><div class="kv mono"><b>Y</b><span>${fmt(w.E)}</span><b>X</b><span>${fmt(w.N)}</span></div>
      <button class="btn blk" onClick=${() => close('design')}>Tasarım (aplikasyon) noktası ekle</button>
      <button class="btn blk" onClick=${() => close('target')}>Buraya aplikasyon yap</button>
      <button class="btn blk" onClick=${() => close('measure')}>Buradan ölçüm başlat</button></div><div class="mf"><button class="btn grow" onClick=${() => close(null)}>Kapat</button></div>`);
    if (r === 'design') { const no = await app.prompt('Tasarım noktası', 'Nokta no', { value: ps.nextPointNo('T'), required: true }); if (no) { const p = await ps.createPoint({ pointNo: no, cls: 'TASARIM', critical: false, coord: { E: w.E, N: w.N }, source: 'DESIGN' }); await ps.recompute('Tasarım noktası'); select({ type: 'point', id: p.id }); } }
    if (r === 'target') { app.state.target = { E: w.E, N: w.N, H: null, no: 'Harita noktası' }; app.nav.tab('stake'); }
    if (r === 'measure') { setTool('measure'); setTimeout(() => { eng.current.measure = { mode: 'measure', pts: [w] }; eng.current.invalidate(); force((x) => x + 1); }, 0); }
  }
  async function onDrag(hit, pos) {
    const p = hit.ref;
    const d = dist2(p, pos);
    const reason = await app.prompt(p.pointNo + ' taşınsın mı?', 'Gerekçe (zorunlu) · ' + d.toFixed(3) + ' m', { required: true, note: 'Ölçülen nokta elle taşınınca kaynak MANUEL olur ve denetim kaydına yazılır.' });
    if (reason) { await ps.movePoint(p.id, pos.E, pos.N, reason); app.toast(p.pointNo + ' taşındı · kaynak MANUEL'); }
    eng.current.invalidate();
  }
  // Konum düğmesi: her dokunuşta konumu görünen haritanın ortasına getirir ve takibi açar; takipteyken dokununca takibi bırakır
  const locate = () => {
    const g = app.gnss.state, e = eng.current;
    if (g.E == null) { app.toast('Konum yok · Ayarlar › Konum kaynağı', 'warn'); return; }
    if (follow && e.inView(g.E, g.N, 60)) { setFollow(false); app.state.follow = false; return; }
    setFollow(true); app.state.follow = true; e.center(g.E, g.N, Math.min(e.view.res, 0.3));
  };
  // ALIM: seçili türü ölç ve kaydet; aktif hat varsa otomatik bağla
  const doTake = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await cur.take(active && toLine ? active : null, active, acquire);
      if (r) { if (r.undo) { app.state.lastCap = r.undo; setLastCap(r.undo); } app.toast(r.msg, 'ok', 3500); }
    } catch (err) { app.toast(err.message || String(err), 'err', 5000); } finally { setBusy(false); }
  };
  const undoLast = async () => {
    if (!lastCap) return;
    if (!(await app.confirm('Son alımı geri al', lastCap.no + ' silinsin mi? Nokta, ekipman ve hat bağlantısı kaldırılır (denetim kaydına yazılır).', { ok: 'Sil', danger: true }))) return;
    await ps.undoCapture(lastCap);
    app.toast(lastCap.no + ' geri alındı', 'warn');
    app.state.lastCap = null; setLastCap(null);
  };
  const sel = app.state.sel;
  const g = app.gnss.state;
  const m = eng.current && eng.current.measure;
  const li = active ? ps.result.lineInfo.get(active.id) || {} : {};
  const visH = (eng.current ? eng.current.h : 700) - padB;
  const hakOn = eng.current ? eng.current.layers.hak !== false : true;
  const SM = { gnss: g.source === 'phone' ? ['TELEFON', '#38bdf8'] : g.source === 'none' ? ['GNSS', '#94a3b8'] : ['GNSS', '#10b981'], manual: ['ELLE', '#fbbf24'], map: ['HARİTA', '#c084fc'] }[srcMode];
  const closePanel = () => setPanel(null);
  return html`<div class="mapwrap"><canvas ref=${cv} aria-label="Harita"></canvas></div>
    <div class="fabl">
      <button aria-label="Proje merkezi" onClick=${() => app.nav.go('hub')}><${Icon} n="folder" /></button>
      <button aria-label="Tümünü sığdır" onClick=${() => { setFollow(false); app.state.follow = false; eng.current.fit(ps.data.points); }}><${Icon} n="north" s=${18} c="#dae2fd" fill="#334155" /></button>
      <button class=${cadDocs(ps).length ? 'on' : ''} aria-label="CAD çizimleri" onClick=${() => setPanel('cad')}><b style="font:800 11px var(--mono)">CAD</b></button>
      <button class=${app.state.energyCfg && (app.state.energyCfg.og || app.state.energyCfg.ag) ? 'on' : ''} aria-label="Enerji kontrolü" onClick=${() => setPanel('energy')}><b style="font:800 15px var(--mono)">ϟ</b></button>
    </div>
    <div class="fab" style="top:12px">
      <button class=${layersOpen ? 'on' : ''} aria-label="Katmanlar" onClick=${() => setLayersOpen(!layersOpen)}><${Icon} n="layers" /></button>
      <button class=${tool === 'measure' || tool === 'area' ? 'on' : ''} aria-label="Ölçüm" onClick=${() => setTool(tool === 'measure' ? 'area' : tool === 'area' ? null : 'measure')}><${Icon} n="ruler" /></button>
      <button class=${tool === 'edit' ? 'on' : ''} aria-label="Düğüm düzenle" onClick=${() => setTool(tool === 'edit' ? null : 'edit')}><${Icon} n="edit" /></button>
      <button class=${hakOn ? 'on' : ''} aria-label="Hakediş görünümü" onClick=${() => { const e = eng.current; e.layers.hak = !e.layers.hak; app.state.layers = Object.assign({}, e.layers); e.invalidate(); force((x) => x + 1); }}><b style="font:800 14px var(--mono)">₺</b></button>
    </div>
    ${hakOn && visH > 400 && ps.data.equipment.length + ps.data.lines.length > 0 ? html`<div class="haklegend" style=${'top:' + (active ? 268 : 236) + 'px'}>${HAK_ORDER.map((k) => html`<span><i style=${'background:' + HAK_STATUSES[k].color}></i>${HAK_STATUSES[k].short}</span>`)}</div>` : null}
    <div class="fab" style=${'bottom:' + (padB + 10) + 'px'}>
      ${visH > 380 ? html`<button aria-label="Yakınlaş" onClick=${() => eng.current.zoom(0.6)}><${Icon} n="plus" /></button>
      <button aria-label="Uzaklaş" onClick=${() => eng.current.zoom(1.6)}><${Icon} n="minus" /></button>` : null}
      ${app.web ? null : html`<button class=${'loc' + (follow ? ' on' : '')} aria-label="Konumuma git" onClick=${locate}><${Icon} n="locate" s=${24} /></button>`}
    </div>
    <div class="maptag coord" hidden=${!!app.web && g.E == null} style=${'left:12px;bottom:' + (padB + 10) + 'px'}>Y ${g.E != null ? g.E.toFixed(3) : '—'}  X ${g.N != null ? g.N.toFixed(3) : '—'}  Z ${g.H != null ? g.H.toFixed(3) : '—'}</div>
    ${active ? html`<button class="maptag" style=${'left:12px;top:124px;color:#dae2fd;border-color:' + (GCOL[active.lineType] || '#334155')} onClick=${() => setPanel('line')}>${active.lineNo} çiziliyor · ${toLine ? 'alınanlar hatta eklenir' : 'otomatik ekleme kapalı'}</button>` : null}
    ${tool === 'edit' ? html`<div class="maptag" style=${'left:12px;top:' + (active ? 156 : 124) + 'px;color:#fbbf24'}>Düğüm düzenleme: noktayı sürükleyin</div>` : null}
    ${tool === 'measure' || tool === 'area' ? html`<div class="maptag" style=${'left:12px;top:' + (active ? 156 : 124) + 'px;color:#22d3ee'}>${tool === 'area' ? 'Alan ölçümü' : 'Mesafe ölçümü'}: haritaya dokunun</div>` : null}
    ${layersOpen ? html`<${LayerPop} eng=${eng.current} close=${() => setLayersOpen(false)} />` : null}
    <${AltlikDurumu} eng=${eng.current} padB=${padB} openLayers=${() => setLayersOpen(true)} />
    <div class="base" ref=${base}>
      ${m ? html`<${MeasurePanel} m=${m} clear=${() => { m.pts = []; eng.current.invalidate(); force((x) => x + 1); }} undo=${() => { m.pts.pop(); eng.current.invalidate(); force((x) => x + 1); }} close=${() => setTool(null)} />`
        : sel && sel.type === 'cad' ? html`<${CadPointPanel} sel=${sel} select=${select} curLabel=${cur.label} take=${async () => { app.state.forceCoord = { E: sel.x, N: sel.y }; select(null); await doTake(); }} />`
        : sel ? html`<${SelectionPanel} sel=${sel} select=${select} eng=${eng.current} openLine=${() => setPanel('line')} />`
        : html`<div class="dock" aria-label="Alım">
            <div class="dock-top">
              <button class="what" aria-label="Alınacak nesneyi seç" onClick=${() => setPanel('pick')}>
                <i style=${'background:' + cur.color}></i>
                <span class="grow"><b>${cur.title}</b><small>${cur.sub}</small></span>
                <${Icon} n="up" s=${18} c="#94a3b8" />
              </button>
              <button class=${'lchip' + (active ? ' on' : '')} style=${active ? '--c:' + (GCOL[active.lineType] || '#10b981') : ''} aria-label="Hat" onClick=${() => setPanel('line')}>
                ${active ? html`<b>${active.lineNo} · ${active.lineType}</b><small>${active.nodes.length} düğüm · ${trn(li.length3D || 0, 0)} m</small>` : html`<b>+ HAT</b><small>başlat / devam</small>`}
              </button>
            </div>
            <div class="dock-take">
              <button class="srcbtn" style=${'--c:' + SM[1]} aria-label="Veri kaynağı" onClick=${() => setPanel('src')}><small>KAYNAK</small><b>${SM[0]}</b></button>
              <${TakeBtn} label=${cur.label} mode=${srcMode} measuring=${measuring} busy=${busy} disabled=${!cur.ok} onTake=${doTake} />
              <button class="undo" aria-label="Son alımı geri al" disabled=${!lastCap || busy} onClick=${undoLast}><${Icon} n="undo" s=${22} /></button>
            </div>
          </div>`}
    </div>
    ${panel ? html`<div class="scrim" onClick=${closePanel}></div>` : null}
    ${panel === 'pick' ? html`<section class="sheet" aria-label="Alınacak nesne">
        <div class="grab" onClick=${closePanel}><i></i></div>
        <div class="body">
          <div class="seg">${[['direk', 'DİREK'], ['trafo', 'TRAFO'], ['diger', 'DİĞER']].map(([k, l]) => html`<button class=${'chip' + (kind === k ? ' on' : '')} style="min-height:46px;font-size:14px;letter-spacing:.04em" onClick=${() => setKind(k)}>${l}</button>`)}</div>
          ${kind === 'direk' ? html`<${PoleFields} m=${pole} close=${closePanel} />` : kind === 'trafo' ? html`<${TrafoFields} m=${trafo} />` : html`<${OtherFields} m=${other} active=${active} startLine=${(preset) => { app.state.forms = Object.assign({}, app.state.forms, { line: Object.assign({}, (app.state.forms || {}).line || {}, preset) }); setPanel('line'); }} />`}
        </div>
        <div class="foot"><div class="grow" style="min-width:0"><div class="lbl">Yeşil Defter</div><div class="mono" style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cur.code || '—'}</div></div><button class="btn pri" style="flex:0 0 46%;height:52px;font-size:16px" onClick=${closePanel}><${Icon} n="check" s=${20} c="#0b1326" />TAMAM</button></div>
      </section>` : null}
    ${panel === 'line' ? html`<${LineSheet} active=${active} close=${closePanel} rerender=${() => force((x) => x + 1)} />` : null}
    ${panel === 'cad' ? html`<${CadSheet} close=${closePanel} eng=${eng.current} refresh=${refreshCad} />` : null}
    ${panel === 'energy' ? html`<${EnergySheet} close=${closePanel} eng=${eng.current} rerender=${() => force((x) => x + 1)} />` : null}
    ${panel === 'src' ? html`<${SourceSheet} mode=${srcMode} setMode=${(m) => { setSrcMode(m); closePanel(); }} close=${closePanel} />` : null}`;
}
MapScreen.flush = true;
MapScreen.compactHud = true;

/** Altlık seçimi: anahtar isteyen altlıkta anahtar yoksa Ayarlar'a yönlendirir. */
async function altlikSec(id, eng, yenile) {
  const b = basemapById(id);
  if (b.key && !basemapReady(b)) {
    if (await app.confirm(b.label, b.label + ' için ' + (b.id === 'ozel' ? 'karo adresi' : 'anahtar') + ' gerekli: Ayarlar › Harita altlığı bölümünden girin. ' + (b.note || '') + ' Ayarlar açılsın mı?', { ok: 'Ayarlara git' })) app.nav.tab('settings');
    yenile();
    return;
  }
  app.state.basemap = id; app.ds.setting('basemap', id);
  tileErrors.delete(id);
  if (eng) eng.invalidate();
  yenile();
}

/** Altlığın atıfı (sağ altta, her zaman görünür) ve yüklenemezse uyarı + başka altlığa geçiş. */
function AltlikDurumu({ eng, padB, openLayers }) {
  const bm = basemapById(app.state.basemap || 'none');
  if (!eng || bm.id === 'none' || !eng.layers.basemap) return null;
  const attr = basemapAttr(bm), hata = tileErrors.get(bm.id);
  const ready = basemapReady(bm);
  return html`${attr ? html`<div class="mapattr" style=${'bottom:' + (padB + 4) + 'px'}>${attr}</div>` : null}
    ${hata && hata.count >= 3 || !ready ? html`<div class="alert warn mapalert" role="alert"><${Icon} n="info" s=${16} /><span class="grow">${bm.label} yüklenemedi: ${!ready ? 'anahtar girilmemiş' : hata.reason}. Ölçüm ve çizim etkilenmez.</span>
      <button class="btn xs" onClick=${openLayers}>Altlık değiştir</button><button class="btn xs" onClick=${() => { app.state.basemap = 'none'; app.ds.setting('basemap', 'none'); eng.invalidate(); app.bus.emit('tiles:error', { id: bm.id }); }}>Altlığı kapat</button></div>` : null}`;
}

function LayerPop({ eng, close }) {
  const [, f] = useState(0);
  const L = eng.layers;
  const t = (k) => { L[k] = !L[k]; app.state.layers = Object.assign({}, L); eng.invalidate(); f((x) => x + 1); };
  const items = [['AG', 'A.G. şebeke', '#7ee08a'], ['OG', 'O.G. şebeke', '#ff6b6b'], ['AYD', 'Aydınlatma', '#7fffff'], ['ENH', 'E.N.H.', '#ff79ff'], ['ABONE', 'Abone', '#fbbf24'], ['yeralti', 'Yeraltı kablo', '#ff6b6b'], ['trafo', 'Trafo ve box', '#6b82ff'], ['mevcut', 'Mevcut elemanlar', '#00ffbf'], ['demontaj', 'Demontaj işareti', '#ffff00'], ['hak', 'Hakediş durumu (renkler)', '#fbbf24'], ['srcTags', 'Veri kaynağı etiketleri', '#10b981'], ['points', 'Ölçü noktaları', '#e2e8f0'], ['labels', 'Etiketler', '#94a3b8'], ['spanText', 'Açıklık yazıları', '#94a3b8'], ['grid', 'Koordinat ızgarası', '#94a3b8'], ['basemap', 'Altlık harita', '#94a3b8'], ['cad', 'CAD çizimi', '#fde047']];
  if (L.cad === undefined) L.cad = true;
  return html`<div class="card" style="position:absolute;right:68px;top:12px;z-index:6;width:230px;padding:6px;max-height:60%;overflow:auto">
    ${items.map(([k, l, c]) => html`<button class="li" style="min-height:40px;padding:6px 8px" onClick=${() => t(k)}><span style=${'width:18px;height:3px;background:' + c}></span><span class="grow" style="font-size:13px">${l}</span><${Icon} n=${L[k] ? 'check' : 'minus'} s=${16} c=${L[k] ? '#10b981' : '#475569'} /></button>`)}
    <div class="row" hidden=${!!app.web && !app.state.tilesOk} style="padding:6px 8px"><span class="note grow">Altlık</span><select class="inp" style="height:34px;font-size:12px;max-width:150px" value=${app.state.basemap || 'none'} onChange=${(e) => altlikSec(e.target.value, eng, () => f((x) => x + 1))}>
      <option value="none">Altlık yok</option>
      ${ALTLIK_GRUPLARI.map(([gk, gl]) => html`<optgroup label=${gl}>${BASEMAPS.filter((b) => b.grup === gk).map((b) => html`<option value=${b.id}>${b.label + (b.key && !basemapReady(b) ? ' · anahtar gerekli' : '')}</option>`)}</optgroup>`)}
    </select></div>
    <button class="btn sm blk" onClick=${() => { close(); app.nav.go('layers'); }}>Lejant ve katman ayrıntıları</button>
  </div>`;
}

function MeasurePanel({ m, clear, undo, close }) {
  const pts = m.pts;
  const L = polylineLength(pts), last = pts.length > 1 ? pts[pts.length - 1] : null, prev = pts.length > 1 ? pts[pts.length - 2] : null;
  return html`<div class="body"><div class="row"><b class="grow">${m.mode === 'area' ? 'Alan ölçümü' : 'Mesafe / semt ölçümü'}</b><button class="btn xs" onClick=${undo}>Geri al</button><button class="btn xs" onClick=${clear}>Temizle</button><button class="btn xs" onClick=${close}>Kapat</button></div>
    <div class="grid3"><div class="stat"><b>Toplam</b><span>${trn(L, 3)}</span><small>m</small></div><div class="stat"><b>Son parça</b><span>${prev ? trn(dist2(prev, last), 3) : '—'}</span><small>m</small></div><div class="stat"><b>Semt</b><span style="font-size:15px">${prev ? dms(bearing(prev, last)) : '—'}</span></div></div>
    ${m.mode === 'area' && pts.length > 2 ? html`<div class="grid2"><div class="stat"><b>Alan</b><span>${trn(polygonArea(pts), 2)}</span><small>m²</small></div><div class="stat"><b>Çevre</b><span>${trn(L + dist2(pts[pts.length - 1], pts[0]), 2)}</span><small>m</small></div></div>` : null}
    <div class="note">Haritaya dokunarak nokta ekleyin; 20 px içinde mevcut noktalara yakalanır.</div></div>`;
}

// ---------------- Enerji kontrolü ----------------
function EnergySheet({ close, eng, rerender }) {
  const ps = app.ps;
  const cfg = app.state.energyCfg || { og: false, ag: false, link: true, includeFuture: false };
  const set = (p) => { app.state.energyCfg = Object.assign({}, cfg, p); eng.invalidate(); rerender(); };
  const R = energyState();
  const src = ps.p.energy || {};
  const noOf = (pid) => { const e = ps.eqAt(pid)[0]; const p = ps.pointById(pid); return e ? e.no : p ? p.pointNo : '?'; };
  const go = (pid) => { const p = ps.pointById(pid); if (!p) return; eng.center(p.E, p.N, Math.min(eng.view.res, 0.6)); app.state.follow = false; app.state.sel = { type: 'point', id: pid }; app.bus.emit('ui:sel'); close(); };
  const goLine = (id) => { const l = ps.lineById(id); const p = l && ps.pointById(l.nodes[0]); if (p) eng.center(p.E, p.N); app.state.follow = false; app.state.sel = { type: 'line', id }; app.bus.emit('ui:sel'); close(); };
  const deadEq = R ? R.dead.equipment.map((id) => ps.eqById(id)).filter(Boolean) : [];
  return html`<section class="sheet" aria-label="Enerji kontrolü"><div class="grab" onClick=${close}><i></i></div>
    <div class="body">
      <b style="font-size:17px">Enerji kontrolü</b>
      <div class="note">Seçtiğiniz tarafa enerji verilir; haritada enerjili hatlar sarı parlar, enerjisiz hatlar gri kesik çizgi olur, enerjisiz objeler kırmızı çarpıyla işaretlenir. Kayıtlı veriyi değiştirmez.</div>
      <div class="grid2">
        <button class=${'chip' + (cfg.og ? ' on' : '')} style="min-height:58px;flex-direction:column;--c:#ff8a8a" onClick=${() => set({ og: !cfg.og })}><b style="font-size:15px">OG'ye enerji ver</b><small>${cfg.og ? 'açık' : 'kapalı'}</small></button>
        <button class=${'chip' + (cfg.ag ? ' on' : '')} style="min-height:58px;flex-direction:column;--c:#7ee08a" onClick=${() => set({ ag: !cfg.ag })}><b style="font-size:15px">AG'ye enerji ver</b><small>${cfg.ag ? 'açık' : 'kapalı'}</small></button>
      </div>
      ${cfg.og && cfg.ag ? html`<div class="row"><span class="grow" style="font-size:13px">AG'yi yalnız OG'den enerji alan trafolar beslesin</span><${Toggle} on=${cfg.link !== false} onChange=${(v) => set({ link: v })} label="OG'ye bağlı" /></div>` : null}
      <div class="row"><span class="grow" style="font-size:13px">Demontaj / ileride durumundaki hatları da say</span><${Toggle} on=${!!cfg.includeFuture} onChange=${(v) => set({ includeFuture: v })} label="Demontaj dahil" /></div>
      ${cfg.og ? html`<div class="card stack" style="gap:6px"><div class="lbl">OG enerji kaynakları</div>
        ${(src.og || []).length ? html`<div class="chips">${(src.og || []).map((pid) => html`<button class="chip" onClick=${() => go(pid)}>ϟ ${noOf(pid)}</button>`)}</div>` : html`<div class="alert warn" style="font-size:12px">Kaynak yok. Bu pencereyi kapatın, haritada OG hattının beslendiği direğe / köşke dokunun ve "Buradan OG enerjisi ver" deyin.</div>`}</div>` : null}
      ${cfg.ag ? html`<div class="card stack" style="gap:6px"><div class="lbl">AG enerji kaynakları</div><div class="note">Trafolar kendiliğinden kaynaktır${cfg.og && cfg.link !== false ? ' (OG\'den enerji alıyorsa)' : ''}. Proje dışından beslenen bir nokta için haritada o noktaya dokunup "Buradan AG enerjisi ver" deyin.</div>
        ${R && R.sources.ag.length ? html`<div class="chips">${R.sources.ag.slice(0, 24).map((pid) => html`<button class="chip" onClick=${() => go(pid)}>ϟ ${noOf(pid)}</button>`)}</div>` : null}</div>` : null}
      ${R ? html`<div class="grid3"><div class="stat"><b>Enerjili hat</b><span style="color:#fde047">${R.counts.on}</span></div><div class="stat"><b>Enerjisiz hat</b><span style=${'color:' + (R.counts.off ? '#ff8a8a' : '#6ffbbe')}>${R.counts.off}</span></div><div class="stat"><b>Enerjisiz obje</b><span style=${'color:' + (deadEq.length ? '#ff8a8a' : '#6ffbbe')}>${deadEq.length}</span></div></div>
        ${R.notes.map((n) => html`<div class="alert warn" style="font-size:12px">${n}</div>`)}
        ${R.counts.skipped ? html`<div class="note">${R.counts.skipped} hat devre dışı sayıldı (açık bırakılmış ya da demontaj / ileride).</div>` : null}
        ${R.dead.lines.length ? html`<div class="lbl">Enerjisiz hatlar</div><div class="chips">${R.dead.lines.slice(0, 40).map((id) => { const l = ps.lineById(id); return l ? html`<button class="chip" style="--c:#ff8a8a" onClick=${() => goLine(id)}>${l.lineNo} · ${l.lineType}</button>` : null; })}</div>` : null}
        ${deadEq.length ? html`<div class="lbl">Enerjisiz objeler</div><div class="chips">${deadEq.slice(0, 60).map((e) => html`<button class="chip" onClick=${() => go(e.pointId)}>${e.no}</button>`)}${deadEq.length > 60 ? html`<span class="note">+${deadEq.length - 60}</span>` : null}</div>` : null}
        ${!R.dead.lines.length && !deadEq.length && !R.notes.length ? html`<div class="alert ok">Enerji verilen tarafta enerjisiz hat ya da obje yok.</div>` : null}` : html`<div class="alert info">OG ya da AG tarafını açın.</div>`}
      ${cfg.og || cfg.ag ? html`<button class="btn dang blk" onClick=${() => { app.state.energyCfg = null; eng.invalidate(); rerender(); close(); }}>Enerjiyi kes · kontrolü kapat</button>` : null}
    </div></section>`;
}

// ---------------- CAD çizimleri ----------------
// Çizim aç (DXF / NCZ), göster / gizle, katmanları aç-kapa, sığdır, kaldır
export async function openCadFile(file) {
  const ps = app.ps;
  const u8 = new Uint8Array(await file.arrayBuffer());
  const r = await importCad(ps, u8, file.name);
  app.bus.emit('cad:reload');
  app.toast(file.name + ' yüklendi · ' + r.model.ents.length + ' nesne · ' + r.model.layers.length + ' katman', 'ok', 4000);
  for (const w of r.warnings.slice(0, 2)) app.toast(w, 'warn', 7000);
  return r;
}
function CadSheet({ close, eng, refresh }) {
  const ps = app.ps;
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(null);
  const [mdl, setMdl] = useState(null);
  const docs = cadDocs(ps);
  const fit = (d) => { const b = d.bbox; if (!b) return; eng.fit([{ E: b.minE, N: b.minN }, { E: b.maxE, N: b.maxN }], 40); app.state.follow = false; close(); };
  const pick = async (f) => { if (!f) return; setBusy('Okunuyor: ' + f.name); try { const r = await openCadFile(f); await refresh(); fit(r.doc); } catch (e) { app.toast(e.message || String(e), 'err', 7000); } setBusy(null); };
  const tog = async (d) => { await setCad(ps, d, { visible: d.visible === false }); await refresh(); };
  const togLayer = async (d, i) => { const h = new Set(d.hidden || []); if (h.has(i)) h.delete(i); else h.add(i); await setCad(ps, d, { hidden: [...h] }); await refresh(); };
  const allLayers = async (d, on) => { await setCad(ps, d, { hidden: on ? [] : (mdl ? mdl.layers.map((_, i) => i) : []) }); await refresh(); };
  const del = async (d) => { if (!(await app.confirm('Çizimi kaldır', d.name + ' projeden kaldırılsın mı? (Objeler ve ölçümler etkilenmez.)', { danger: true, ok: 'Kaldır' }))) return; await removeCad(ps, d); if (app.state.sel && app.state.sel.type === 'cad') { app.state.sel = null; app.bus.emit('ui:sel'); } await refresh(); };
  const expand = async (d) => { if (open === d.id) { setOpen(null); return; } setMdl(await cadModel(ps, d)); setOpen(d.id); };
  return html`<section class="sheet" aria-label="CAD çizimleri"><div class="grab" onClick=${close}><i></i></div>
    <div class="body">
      <b style="font-size:17px">CAD çizimleri</b>
      <label class="btn pri blk" style="height:52px"><${Icon} n="folder" s=${18} c="#0b1326" />${busy || 'Çizim aç (DXF ya da NCZ)'}<input type="file" accept=".dxf,.ncz,.DXF,.NCZ,*/*" style="display:none" onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; pick(f); }} /></label>
      <div class="note">Çizim haritanın üzerine katman olarak gelir. Çizim koordinatları proje koordinat sisteminde (${ps.p.crs.label}) olmalıdır. Çizimdeki bir uca ya da köşeye dokununca oraya aplikasyon yapabilir, obje ekleyebilir ya da direk tepe kuvvetini hesaplayabilirsiniz.</div>
      ${docs.map((d) => html`<div class="card stack" style="gap:8px">
        <div class="row"><div class="grow"><b style="font-size:14px">${d.name}</b><div class="m note mono">${d.format} · ${d.entCount} nesne · ${d.layerCount} katman${d.dom ? ' · DOM ' + d.dom + '°' : ''}</div></div><${Toggle} on=${d.visible !== false} onChange=${() => tog(d)} label="Göster" /></div>
        ${(d.warnings || []).slice(0, 2).map((w) => html`<div class="note hw">${w}</div>`)}
        <div class="grid3"><button class="btn sm" onClick=${() => fit(d)}>Sığdır</button><button class="btn sm" onClick=${() => expand(d)}>Katmanlar</button><button class="btn sm dang" onClick=${() => del(d)}>Kaldır</button></div>
        ${open === d.id && mdl ? html`<div class="row" style="gap:6px"><button class="btn xs grow" onClick=${() => allLayers(d, true)}>Tümünü aç</button><button class="btn xs grow" onClick=${() => allLayers(d, false)}>Tümünü kapat</button></div>
          <div class="card tight list" style="max-height:240px;overflow:auto">${mdl.layers.map((l, i) => html`<button class="li" style="min-height:38px;padding:6px 10px" onClick=${() => togLayer(d, i)}><span class="grow mono" style="font-size:12px">${l.name || '(adsız)'}</span><${Icon} n=${(d.hidden || []).includes(i) ? 'minus' : 'check'} s=${16} c=${(d.hidden || []).includes(i) ? '#475569' : '#10b981'} /></button>`)}</div>` : null}
      </div>`)}
      ${!docs.length ? html`<div class="empty">Henüz çizim yok.</div>` : null}
    </div></section>`;
}
// Çizimde seçilen nokta: aplikasyon hedefi · obje ekle · tepe kuvveti
function CadPointPanel({ sel, select, take, curLabel }) {
  const KIND = { end: 'Çizgi ucu', vertex: 'Köşe noktası', center: 'Merkez', text: 'Yazı', point: 'Nokta' };
  const arms = cadArms(app.state.cadLayers || [], sel.x, sel.y, 0.5);
  return html`<div class="body">
    <div class="row"><span style="width:10px;height:10px;border-radius:5px;background:#fde047"></span><b class="grow" style="font-size:16px">Çizim noktası · ${KIND[sel.kind] || sel.kind}</b><button class="btn xs" aria-label="Kapat" onClick=${() => select(null)}><${Icon} n="x" s=${16} /></button></div>
    <div class="kv" style="font-size:13px"><b>Koordinat</b><span class="mono">Y ${fmt(sel.x)} · X ${fmt(sel.y)}</span><b>Katman</b><span class="mono">${sel.layer || '—'}</span>${sel.text ? html`<b>Yazı</b><span>${sel.text}</span>` : null}<b>Bağlı çizgi</b><span>${arms.length ? arms.length + ' kol · ' + arms.map((a) => trn(a.len, 1) + ' m').join(' · ') : 'yok'}</span></div>
    <div class="grid2">
      ${app.web ? null : html`<button class="btn pri" onClick=${() => { app.state.target = { E: sel.x, N: sel.y, H: null, no: 'CAD' + (sel.text ? ' ' + sel.text : sel.layer ? ' · ' + sel.layer : '') }; app.bus.emit('ui:target'); app.nav.tab('stake'); }}><${Icon} n="target" s=${18} c="#0b1326" />Aplikasyon yap</button>`}
      <button class=${'btn' + (app.web ? ' pri' : '')} onClick=${() => app.nav.go('tepe', { E: sel.x, N: sel.y, arms, title: 'Çizim · ' + (sel.layer || 'nokta') })}><${Icon} n="calc" s=${18} c=${app.web ? '#0b1326' : 'currentColor'} />Tepe kuvveti</button>
      <button class="btn" style="grid-column:1/3" onClick=${take}><${Icon} n="pin" s=${18} />Buraya ekle: ${curLabel}</button>
    </div>
    <div class="note">"Buraya ekle" alt çubukta seçili türü bu noktaya kaydeder (kaynak: HARİTA). Tepe kuvveti için noktada birleşen çizgiler kol olarak alınır.</div></div>`;
}

// ---------------- Seçim kartı ----------------
function SelectionPanel({ sel, select, eng, openLine }) {
  const ps = app.ps;
  if (sel.type === 'line') {
    const l = ps.lineById(sel.id);
    if (!l) return null;
    const li = ps.result.lineInfo.get(l.id) || {};
    const act = app.state.activeLineId === l.id;
    return html`<div class="body">
      <div class="row"><span style=${'width:22px;height:4px;background:' + (GCOL[l.lineType] || '#fff')}></span><b class="grow" style="font-size:16px">${l.lineNo} · ${l.lineType} ${l.install}</b><button class="btn xs" onClick=${() => select(null)}><${Icon} n="x" s=${16} /></button></div>
      <div class="mono" style="font-size:13px">${lineLabel(l, ps.cat) || 'iletken tanımsız'}</div>
      ${app.state.energyCfg && (app.state.energyCfg.og || app.state.energyCfg.ag) ? (() => { const es = (energyState() || { lineState: new Map() }).lineState.get(l.id); return html`<div class="row"><${Badge} k=${es === 'on' ? 'ok' : es === 'off' ? 'err' : es === 'mixed' ? 'warn' : 'mut'}>${{ on: 'ENERJİLİ', off: 'ENERJİSİZ', mixed: 'KISMEN ENERJİLİ', skip: 'DEVRE DIŞI', na: 'KAPSAM DIŞI' }[es] || '—'}</${Badge}><span class="grow"></span><button class=${'btn xs' + (l.energyOpen ? ' warn' : '')} onClick=${async () => { await ps.updateLine(l.id, { energyOpen: !l.energyOpen }, l.lineNo + (l.energyOpen ? ' kapatıldı (enerji geçer)' : ' açıldı (enerji geçmez)')); app.bus.emit('ui:sel'); }}>${l.energyOpen ? 'Hat AÇIK · kapat' : 'Hattı aç (ayır)'}</button></div>`; })() : null}
      <div class="grid3"><div class="stat"><b>2B</b><span>${trn(li.length2D, 2)}</span><small>m</small></div><div class="stat"><b>3B</b><span>${trn(li.length3D, 2)}</span><small>m</small></div><div class="stat"><b>Açıklık</b><span>${li.spans || 0}</span></div></div>
      <div class="grid2">
        <button class="btn" onClick=${() => app.nav.go('line', { id: l.id })}><${Icon} n="edit" s=${18} />Hat kaydı</button>
        <button class=${'btn' + (act ? ' pri' : '')} onClick=${() => { app.state.activeLineId = act ? null : l.id; select(null); app.toast(act ? l.lineNo + ' tamamlandı' : l.lineNo + ' çizime açıldı · alınan direkler bu hatta eklenir'); }}>${act ? 'Hattı bitir' : 'Devam çiz'}</button>
        <button class="btn" onClick=${async () => { await ps.reverseLine(l.id); app.toast('Hat yönü ters çevrildi'); }}><${Icon} n="reverse" s=${18} />Ters çevir</button>
        <button class="btn" disabled=${!(sel.seg > 0)} onClick=${async () => { const nl = await ps.splitLine(l.id, sel.seg); app.toast(l.lineNo + ' bölündü → ' + nl.lineNo); select(null); }}><${Icon} n="split" s=${18} />Düğümde böl</button>
      </div>
      <${HakRow} type="line" rec=${l} />
      <div class="note">Böl: seçilen parçanın başlangıç düğümünden ikiye ayırır. Birleştir ve ofset: Hat kaydı ekranında.</div>
    </div>`;
  }
  const p = ps.pointById(sel.id);
  if (!p) return null;
  const eqs = ps.eqAt(p.id);
  const e = eqs[0];
  const ri = e ? ps.result.roles.get(e.id) : null;
  const iss = ps.result.issues.filter((i) => i.entityId === (e ? e.id : p.id) || i.pointId === p.id);
  const act = app.state.activeLineId ? ps.lineById(app.state.activeLineId) : null;
  const si = sourceInfo(p);
  const remeasure = async () => {
    const obs = await measure({ critical: p.critical !== false, label: p.pointNo });
    if (!obs) return;
    const why = await app.prompt('Yeniden ölçüm', 'Gerekçe', { value: si.precise ? 'Yeniden ölçüm' : si.label + ' noktası GNSS ile ölçüldü', required: true });
    if (!why) return;
    await ps.remeasure(p.id, obs, why);
    const im = ps.lastImpact;
    app.toast(p.pointNo + ' revize edildi' + (im ? ' → ' + im.spans + ' açıklık, ' + im.roles + ' rol, ' + im.materials + ' reçete, ' + im.quantities + ' metraj' : ''), 'ok', 5000);
  };
  const nPh = ps.data.photos.filter((x) => x.ownerId === (e ? e.id : p.id)).length;
  const when = p.measuredAt || p.updatedAt || p.createdAt;
  const note = (e && e.note) || p.note || '';
  const kindLbl = e ? (EQUIPMENT_KINDS[e.kind] || {}).label || e.kind : p.cls === 'HAT' ? 'Hat köşe noktası' : p.cls === 'TASARIM' ? 'Tasarım noktası' : 'Detay noktası';
  // Obje detay kartı (spesifikasyon 8.3): no · tür / koordinat / veri kaynağı / hakediş / fotoğraf / ölçüm / not
  return html`<div class="body">
    <div class="row"><b class="grow" style="font-size:17px">${e ? e.no : p.pointNo} <span style="font-weight:500;color:var(--mut)">· ${kindLbl}</span></b><${Badge} k=${si.badge}>${si.tag}</${Badge}><button class="btn xs" aria-label="Kapat" onClick=${() => select(null)}><${Icon} n="x" s=${16} /></button></div>
    ${e ? html`<div style="font-size:13px">${eqSummary(e)}${ri && ri.role ? html` · <b class="hw">${roleLabel(ri.role)}${ri.angle ? ' α=' + dms(ri.angle) : ''}</b>` : null}</div>` : null}
    ${e && e.kind === 'transformer' && (KABIN_POSTLARI.includes((e.attrs || {}).post) || (e.attrs || {}).cabin) ? html`<button class="btn blk" style="min-height:46px;border-color:#22d3ee;color:#67e8f9" onClick=${() => app.nav.go('cabin', { id: e.id })}><${Icon} n="grid" s=${18} />Kabin · hücreler${(e.attrs || {}).cabin ? ' (' + e.attrs.cabin.hucreler.length + ')' : ' ve kablo kanalları'}</button>` : null}
    <div class="kv" style="font-size:13px">
      <b>Koordinat</b><span class="mono">Y ${fmt(p.E)} · X ${fmt(p.N)} · Z ${p.H != null ? fmt(p.H) : 'bilinmiyor'}</span>
      <b>Veri kaynağı</b><span style=${'color:' + si.color}>${sourceText(p)}${p.quality && p.quality.sats != null ? ' · ' + p.quality.sats + ' uydu' : ''}</span>
      <b>Fotoğraflar</b><span>${nPh}</span>
      <b>Ölçüm</b><span>${when ? new Date(when).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}${p.operator ? ' · ' + p.operator : ''}</span>
      ${note ? html`<b>Notlar</b><span>${note}</span>` : null}
    </div>
    ${e ? html`<${HakRow} type="equipment" rec=${e} />` : null}
    ${iss.slice(0, 2).map((i) => html`<div class=${'alert ' + (i.severity === 'error' ? 'err' : 'warn')} style="padding:6px 10px"><b>${i.code}</b> ${i.message}</div>`)}
    ${act ? html`<button class="btn pri blk" style="height:52px;font-size:15px" disabled=${act.nodes[act.nodes.length - 1] === p.id} onClick=${async () => { await ps.appendNode(act.id, p.id); app.toast(p.pointNo + ' → ' + act.lineNo + ' hattına eklendi'); select(null); }}><${Icon} n="plus" s=${20} c="#0b1326" />${act.nodes[act.nodes.length - 1] === p.id ? act.lineNo + ' hattının son düğümü' : act.lineNo + ' hattına ekle'}</button>` : null}
    <div class="grid2">
      ${e ? html`<button class=${'btn' + (act ? '' : ' pri')} onClick=${() => app.nav.go('equipment', { id: e.id })}><${Icon} n="edit" s=${18} />Kayıt</button>` : html`<button class=${'btn' + (act ? '' : ' pri')} onClick=${() => app.nav.go('point', { id: p.id })}>Nokta kaydı</button>`}
      <button class="btn" onClick=${() => app.nav.go('photo', { ownerId: e ? e.id : p.id, pointId: p.id, ownerNo: e ? e.no : p.pointNo, ownerKind: e ? e.kind : 'point' })}><${Icon} n="camera" s=${18} />Fotoğraf</button>
      ${app.web ? html`<button class="btn" style="grid-column:1/3" onClick=${() => app.nav.go('point', { id: p.id })}><${Icon} n="cross" s=${18} />Koordinat ve ölçüm kaydı</button>` : html`<button class="btn" onClick=${remeasure}><${Icon} n="cross" s=${18} />${si.precise ? 'Yeniden ölç' : 'GNSS ile ölç'}</button>
      <button class="btn" onClick=${() => { app.state.target = { id: p.id }; app.nav.tab('stake'); }}><${Icon} n="target" s=${18} />Aplikasyon</button>`}
      ${act ? null : html`<button class="btn" style="grid-column:1/3" onClick=${() => { app.state.lineStartPoint = p.id; select(null); openLine(); }}><${Icon} n="plus" s=${18} />Buradan hat başlat</button>`}
      ${app.state.energyCfg && (app.state.energyCfg.og || app.state.energyCfg.ag) ? ['og', 'ag'].filter((lv) => app.state.energyCfg[lv] && ps.data.lines.some((l) => l.nodes.includes(p.id) && levelsOf(l)[lv])).map((lv) => { const cur = ((ps.p.energy || {})[lv] || []); const on = cur.includes(p.id); return html`<button class=${'btn' + (on ? ' warn' : '')} style="grid-column:1/3" onClick=${async () => { const en = Object.assign({ og: [], ag: [] }, ps.p.energy || {}); en[lv] = on ? cur.filter((x) => x !== p.id) : [...cur, p.id]; await ps.updateProject({ energy: en }, (on ? 'Enerji kaynağı kaldırıldı: ' : 'Enerji kaynağı: ') + (e ? e.no : p.pointNo) + ' (' + lv.toUpperCase() + ')'); app.bus.emit('ui:sel'); }}><b style="font:800 15px var(--mono)">ϟ</b>${on ? lv.toUpperCase() + ' enerji kaynağını kaldır' : 'Buradan ' + lv.toUpperCase() + ' enerjisi ver'}</button>`; }) : null}
      ${e && (e.kind === 'pole' || e.kind === 'lighting' || e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') ? html`<button class="btn" style="grid-column:1/3;border-color:#f59e0b;color:#fcd34d" onClick=${() => app.nav.go('hesapMerkezi', { hedef: { tur: e.kind === 'pole' || e.kind === 'lighting' ? 'direk' : 'trafo', id: e.id } })}><${Icon} n="calc" s=${18} />Teknik hesaplar (${e.kind === 'pole' || e.kind === 'lighting' ? 'bu direk' : 'bu trafo'})</button>` : null}
      ${e && (e.kind === 'pole' || e.kind === 'lighting') ? html`<button class="btn" style="grid-column:1/3" onClick=${() => app.nav.go('tepe', { E: p.E, N: p.N, arms: armsOfPoint(ps, p.id), title: e.no + ' · ' + eqSummary(e), pointId: p.id })}><${Icon} n="calc" s=${18} />Tepe kuvveti (cer vektör hesabı)</button>` : null}
    </div>
  </div>`;
}
export function eqSummary(e) {
  const ps = app.ps;
  if (e.kind === 'pole' || e.kind === 'lighting') { const t = ps.cat.poleType(e.typeId); const g = ps.cat.poleGroup(e.group); return (g ? g.short : '') + ' · ' + (t ? t.name : 'tip yok') + ' · ' + ((STATUSES[e.state] || {}).label || e.state); }
  if (e.kind === 'transformer') { const a = e.attrs || {}; const pt = ps.cat.postType(a.post); return (pt ? pt.label : 'Trafo') + ' · ' + (a.kva ? a.kva + ' kVA' : '') + ' · ' + ((TRAFO_STATUSES[e.state] || {}).label || e.state); }
  if (e.kind === 'sdk') { const t = ps.cat.sdkType((e.attrs || {}).sdkTypeId); return 'SDK · ' + (t ? t.name : '') + ' · ' + ((STATUSES[e.state] || {}).label || ''); }
  if (e.kind === 'panel' || e.kind === 'luminaire' || e.kind === 'other' || e.kind === 'manhole') { const a = e.attrs || {}; const pz = a.servis ? ps.cat.poz(a.servis) : null; return ((EQUIPMENT_KINDS[e.kind] || {}).label || e.kind) + (a.typeName ? ' · ' + a.typeName : pz ? ' · ' + pz.name : '') + (a.kva ? ' · ' + a.kva + ' kVA' : '') + ' · ' + ((STATUSES[e.state] || {}).label || ''); }
  if (e.kind === 'subscriber') return 'Abone · ' + ((e.attrs || {}).phase === 'tek' ? 'tek faz' : 'üç faz') + ((e.attrs || {}).kofre ? ' · kofreli' : '') + ((e.attrs || {}).aboneNo ? ' · ' + e.attrs.aboneNo : '');
  return e.kind;
}

// ---------------- Alım: düğme + tür modelleri ----------------
function useForm(key, init) {
  const [f, setF] = useState(() => Object.assign({}, init, (app.state.forms || {})[key] || {}));
  useEffect(() => { recent('form:' + key).then((r) => { if (r && !(app.state.forms || {})[key]) setF((x) => Object.assign({}, x, r)); }); }, []);
  const set = (patch) => setF((x) => { const n = Object.assign({}, x, patch); app.state.forms = Object.assign({}, app.state.forms, { [key]: n }); return n; });
  return [f, set];
}
// Büyük ALIM düğmesi: her zaman ekranın altında; durumu (FIX / FLOAT / kaynak yok / ölçülüyor) kendi üstünde gösterir.
// mode: gnss → ölçer · manual → koordinat formu açar · map → nişangâhtaki noktayı ekler
function TakeBtn({ label, onTake, disabled, measuring, busy, mode = 'gnss' }) {
  const g = app.gnss.state;
  const none = g.source === 'none';
  const base = label || 'NOKTA AL';
  let b = mode === 'manual' ? { bg: '#fbbf24', fg: '#0b1326', t: base.replace(/ AL$/, '') + ' · ELLE', ic: 'edit' }
    : mode === 'map' ? { bg: '#c084fc', fg: '#0b1326', t: base.replace(/ AL$/, '') + ' · BURAYA', ic: 'pin' }
    : none ? { bg: '#2d3449', fg: '#94a3b8', t: 'KAYNAK YOK' } : g.source === 'phone' ? { bg: '#38bdf8', fg: '#0b1326', t: base + ' · TEL.' } : g.fix === 'FIX' ? { bg: '#10b981', fg: '#0b1326', t: base } : g.fix === 'FLOAT' ? { bg: '#f59e0b', fg: '#0b1326', t: base + ' · FLOAT' } : { bg: '#ef4444', fg: '#0b1326', t: base + ' · FIX YOK' };
  let style = 'background:' + b.bg + ';border-color:' + b.bg + ';color:' + b.fg;
  let text = b.t;
  if (measuring && mode === 'gnss') {
    const pct = Math.round(100 * Math.min(1, (measuring.n || 0) / (measuring.need || 1)));
    style = 'background:linear-gradient(90deg,#10b981 ' + pct + '%,#0f5c46 ' + pct + '%);border-color:#10b981;color:#0b1326';
    text = 'ÖLÇÜLÜYOR ' + (measuring.n || 0) + '/' + measuring.need;
  }
  return html`<button class="btn huge take" style=${style} disabled=${disabled || busy} onClick=${onTake}><${Icon} n=${b.ic || 'cross'} s=${22} c=${b.fg} w=${2.4} /><span>${text}</span></button>`;
}

// Manuel koordinat girişi (spesifikasyon 3.3): sağa / yukarı / Z + koordinat sistemi; kaynak etiketi MANUEL
function manualCoordModal(label) {
  const ps = app.ps;
  const choices = crsChoices(ps.p);
  return app.modal((close) => html`<${ManualCoord} label=${label} choices=${choices} close=${close} />`);
}
function ManualCoord({ label, choices, close }) {
  const ps = app.ps;
  const last = app.state.manualLast || {};
  const [f, setF] = useState({ x: '', y: '', z: '', zUnknown: false, crsKey: last.crsKey || 'proje' });
  const set = (p) => setF((v) => Object.assign({}, v, p));
  const geo = (choices.find((c) => c.key === f.crsKey) || {}).geo;
  const r = f.x !== '' && f.y !== '' ? resolveCoord(ps.p, f) : null;
  const ok = r && r.ok;
  return html`<div class="mh"><h3>${label} · manuel koordinat</h3><${Badge} k="m">MANUEL</${Badge}></div>
    <div class="mb">
      <div class="fld"><label>Koordinat sistemi</label><${Sel} value=${f.crsKey} options=${choices.map((c) => [c.key, c.label])} onChange=${(v) => set({ crsKey: v })} /></div>
      <div class="grid2">
        <div class="fld"><label>${geo ? 'Boylam (°)' : 'Y · Sağa (Easting)'}</label><input class="inp mono" inputmode="decimal" autofocus value=${f.x} placeholder=${geo ? '39.230000' : '520487.364'} onInput=${(e) => set({ x: e.target.value })} /></div>
        <div class="fld"><label>${geo ? 'Enlem (°)' : 'X · Yukarı (Northing)'}</label><input class="inp mono" inputmode="decimal" value=${f.y} placeholder=${geo ? '38.670000' : '4282048.846'} onInput=${(e) => set({ y: e.target.value })} /></div>
      </div>
      <div class="row"><div class="fld grow"><label>Z · Yükseklik (m)</label><input class="inp mono" inputmode="decimal" disabled=${f.zUnknown} value=${f.zUnknown ? '' : f.z} placeholder=${f.zUnknown ? 'bilinmiyor' : 'isteğe bağlı'} onInput=${(e) => set({ z: e.target.value })} /></div>
        <div class="fld" style="align-items:center"><label>Z bilinmiyor</label><${Toggle} on=${f.zUnknown} onChange=${(v) => set({ zUnknown: v })} label="Z bilinmiyor" /></div></div>
      ${r && !r.ok ? html`<div class="alert err">${r.error}</div>` : null}
      ${ok ? html`<div class="alert info" style="display:block"><div class="mono" style="font-size:12px">Proje: Y ${fmt(r.E)} · X ${fmt(r.N)} · Z ${r.H != null ? fmt(r.H) : 'bilinmiyor'}</div><div class="note">${r.lat.toFixed(7)}°K · ${r.lon.toFixed(7)}°D${r.warn.length ? ' · ' + r.warn.join(' · ') : ''}</div></div>` : html`<div class="note">Sağa değer 6, yukarı değer 7 hanelidir; yerleri karışırsa otomatik düzeltilir. Nokta [MANUEL] etiketiyle kaydedilir ve sonradan GNSS ile ölçülebilir.</div>`}
    </div>
    <div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn pri grow" disabled=${!ok} onClick=${() => { app.state.manualLast = { crsKey: f.crsKey }; close({ E: r.E, N: r.N, H: r.H, lat: r.lat, lon: r.lon, enteredCrs: r.enteredCrs, crsLabel: r.crsLabel }); }}>Kaydet</button></div>`;
}

// Veri kaynağı seçimi (spesifikasyon 3.2): GNSS · Telefon GPS · Manuel · Haritadan seç · Excel
function SourceSheet({ mode, setMode, close }) {
  const g = app.gnss.state;
  const ext = g.source === 'external' || g.source === 'sim';
  const opt = (on, col, title, sub, tag, onClick) => html`<button class=${'srcopt' + (on ? ' on' : '')} style=${'--c:' + col} onClick=${onClick}><i></i><span class="grow"><b>${title}</b><small>${sub}</small></span><span class="badge b-mut">${tag}</span></button>`;
  const useGnss = () => { if (ext) setMode('gnss'); else { close(); app.toast('Harici GNSS bağlı değil · alıcıyı seçin', 'warn', 4000); app.nav.tab('settings'); } };
  const usePhone = async () => { if (g.source !== 'phone') { try { await app.gnss.usePhone(); } catch (e) { app.toast(e.message, 'err'); return; } } setMode('gnss'); app.toast('Telefon GPS · noktalar [TELEFON GPS] etiketiyle kaydedilir', 'warn', 4000); };
  return html`<section class="sheet" aria-label="Veri kaynağı"><div class="grab" onClick=${close}><i></i></div>
    <div class="body">
      <b style="font-size:17px">Veri kaynağı</b>
      ${app.web ? html`<div class="alert info"><span>Web sürümünde ölçüm yapılmaz. GNSS ve telefon GPS alımı telefondaki uygulamayla yapılır; buradan koordinat girilir, haritadan seçilir ya da Excel ile aktarılır.</span></div>` : null}
      ${app.web ? null : opt(mode === 'gnss' && ext, '#10b981', 'GNSS (Harici / RTK)', ext ? ((g.receiver || {}).name || (g.source === 'sim' ? 'Simülatör' : 'Alıcı')) + ' · ' + (g.fix || '—') + (g.sigmaH != null ? ' · ±' + g.sigmaH.toFixed(3) + ' m' : '') : 'Bağlı değil · dokununca Ayarlar açılır', 'RTK FIX', useGnss)}
      ${app.web ? null : opt(mode === 'gnss' && g.source === 'phone', '#38bdf8', 'Telefon GPS', g.source === 'phone' ? 'Etkin' + (g.sigmaH != null ? ' · ±' + g.sigmaH.toFixed(1) + ' m' : '') : '±3–10 m · hassas alım için uygun değil', 'TELEFON GPS', usePhone)}
      ${opt(mode === 'manual', '#fbbf24', 'Manuel koordinat', 'Sağa / yukarı / Z elle girilir, koordinat sistemi seçilir', 'MANUEL', () => setMode('manual'))}
      ${opt(mode === 'map', '#c084fc', 'Haritadan seç', 'Haritayı kaydır, nişangâhı konuma getir · Z bilinmiyor', 'HARİTA', () => setMode('map'))}
      ${opt(false, '#a3e635', 'Excel (toplu)', 'Şablonu indir, doldur, önizle ve içe aktar', 'EXCEL', () => { close(); app.nav.go('excel'); })}
      <div class="note">Seçilen kaynak her objeye etiket olarak yazılır; haritada, listelerde ve raporlarda görünür.</div>
    </div></section>`;
}
const ST_LBL = { YENI: 'YENİ', MEVCUT: 'MEVCUT', DMM: 'DMM', DEMONTAJ: 'DEMONTAJ', ILERIDE: 'İLERİDE' };
const GEN_LBL = { AG: 'AG DİREK', OG: 'OG DİREK', MUS: 'MÜŞTEREK DİREK', AYD: 'AYDINLATMA DİREĞİ' };

function usePole() {
  const ps = app.ps, cat = ps.cat;
  const [f, set] = useForm('pole', { gen: 'OG', group: 'bahh', typeId: null, state: 'YENI' });
  const [favs, setFavs] = useState([]);
  const [recents, setRecents] = useState([]);
  useEffect(() => { favorites().then(setFavs); recent('poles').then((r) => setRecents(Array.isArray(r) ? r : [])); }, []);
  const groups = GEN[f.gen] || [];
  const group = groups.includes(f.group) ? f.group : groups[0];
  const types = cat.poleTypes(group);
  const typeId = types.find((t) => t.id === f.typeId) ? f.typeId : (types.find((t) => favs.includes(t.id)) || types[Math.min(1, types.length - 1)] || {}).id;
  const t = cat.poleType(typeId);
  const gr = cat.poleGroup(group);
  const job = (STATUSES[f.state] || {}).job;
  const code = !job ? 'Mevcut · hakedişe girmez' : t ? cat.jobCode(gr.kgGroup || t.servis, job) + ' · ' + (t.kg ? t.kg + ' kg' : 'Ad') : '—';
  const take = async (line, activeLine, acq) => {
    if (!t) { app.toast('Önce direk tipini seçin', 'warn'); return null; }
    const pos = await acq({ critical: true, label: 'Direk' });
    if (!pos) return null;
    const arm = f.arm && cat.poz(f.arm) ? [{ servis: f.arm, qty: Math.max(1, +f.armN || 1) }] : null;
    const e = await ps.addEquipment(group === 'ayd' ? 'lighting' : 'pole', Object.assign({ group, typeId, state: f.state }, arm ? { attrs: { armatur: arm } } : {}), pos);
    if (line) await ps.appendNode(line.id, e.pointId);
    const cur = { gen: f.gen, group, typeId, state: f.state, arm: f.arm || '', armN: f.armN || 1 };
    await recent('form:pole', cur);
    const rc = [cur, ...recents.filter((x) => !(x.typeId === typeId && x.state === f.state))].slice(0, 6);
    setRecents(rc); await recent('poles', rc);
    const ri = ps.result.roles.get(e.id);
    return { msg: e.no + ' kaydedildi' + (line ? ' → ' + line.lineNo : '') + (ri && ri.role ? ' · ' + roleLabel(ri.role) + (ri.angle ? ' α=' + ri.angle.toFixed(1) + '°' : '') : ''), undo: { no: e.no, pointId: e.pointId, eqId: e.id, lineId: line ? line.id : null } };
  };
  return { f, set, favs, setFavs, recents, groups, group, types, typeId, t, gr, code, ok: !!t, label: 'DİREK AL', title: GEN_LBL[f.gen] || 'DİREK', sub: (t ? t.name : 'tip seçin') + ' · ' + (ST_LBL[f.state] || f.state) + (f.arm && cat.poz(f.arm) ? ' · ' + (f.armN || 1) + ' armatür' : ''), color: ST_COL[f.state] || '#10b981', take };
}
function PoleFields({ m, close }) {
  const cat = app.ps.cat, f = m.f, set = m.set;
  const nm = (x) => x.name + (x.kg ? ' · ' + x.kg + ' kg' : '');
  const opts = [];
  const favT = m.types.filter((x) => m.favs.includes(x.id));
  if (favT.length) opts.push({ group: '★ Favoriler', options: favT.map((x) => [x.id, nm(x)]) });
  opts.push({ group: m.gr ? m.gr.label : 'Tipler', options: m.types.map((x) => [x.id, nm(x)]) });
  const rc = m.recents.map((r) => ({ r, t: cat.poleType(r.typeId) })).filter((x) => x.t);
  return html`
    ${rc.length ? html`<div class="lbl">Son kullanılanlar · tek dokunuşla seç</div>
      <div class="grid2">${rc.map(({ r, t }) => html`<button class=${'rc' + (m.typeId === r.typeId && f.state === r.state ? ' on' : '')} onClick=${() => { set({ gen: r.gen, group: r.group, typeId: r.typeId, state: r.state }); close(); }}><b>${t.name}</b><small style=${'color:' + (ST_COL[r.state] || '#94a3b8')}>${ST_LBL[r.state] || r.state}</small></button>`)}</div>
      <div class="lbl" style="margin-top:4px">Yeni tip seç</div>` : null}
    <div class="row"><span class="lbl" style="width:64px">Genel</span><div class="chips grow">${['AG', 'OG', 'MUS', 'AYD'].map((k) => html`<${Chip} c=${GCOL[k]} on=${f.gen === k} onClick=${() => set({ gen: k, group: GEN[k][0], typeId: null })}>${k === 'MUS' ? 'Müşterek' : k === 'AYD' ? 'AYD.' : k}</${Chip}>`)}</div></div>
    <div class="row"><span class="lbl" style="width:64px">Alt tip</span><div class="chips grow">${m.groups.map((gid) => { const g = cat.poleGroup(gid); return html`<${Chip} on=${m.group === gid} onClick=${() => set({ group: gid, typeId: null })}>${g.material}<small>${g.joint}</small></${Chip}>`; })}</div></div>
    <div class="row"><span class="lbl" style="width:64px">Tip</span><div class="grow"><${Sel} mono value=${m.typeId} options=${opts} onChange=${(v) => set({ typeId: v })} /></div><button class="btn sm" aria-label="Favori" onClick=${async () => m.setFavs(await favorites(m.typeId))}><${Icon} n="star" s=${18} c=${m.favs.includes(m.typeId) ? '#fbbf24' : '#94a3b8'} fill=${m.favs.includes(m.typeId) ? '#fbbf24' : 'none'} /></button></div>
    <div class="row"><span class="lbl" style="width:64px">Durum</span><div class="chips grow">${Object.keys(ST_LBL).map((k) => html`<${Chip} c=${ST_COL[k]} on=${f.state === k} onClick=${() => set({ state: k })}>${ST_LBL[k]}</${Chip}>`)}</div></div>
    <div class="row"><span class="lbl" style="width:64px">Armatür</span><div class="grow"><${Sel} value=${f.arm && cat.poz(f.arm) ? f.arm : ''} options=${[['', 'Armatür yok'], ...luminairePoz(cat).map((x) => [x.servis, x.name])]} onChange=${(v) => set({ arm: v, armN: f.armN || 1 })} /></div>${f.arm && cat.poz(f.arm) ? html`<select class="inp mono" style="width:64px" aria-label="Armatür adedi" value=${f.armN || 1} onChange=${(e) => set({ armN: +e.target.value })}>${[1, 2, 3, 4].map((n) => html`<option value=${n}>${n}×</option>`)}</select>` : null}</div>
    <div class="note">Armatür direğin malzemesi olarak kaydedilir. Rol (taşıyıcı / durdurucu / köşe / nihayet) ve köşe açısı hat geometrisinden otomatik hesaplanır; tip harfiyle uyuşmazsa uyarı verilir.</div>`;
}

// ---------------- Hat: başlat / devam / bitir tek pencerede ----------------
function circuitOpts(role, install) {
  const cat = app.ps.cat;
  return cat.lineTypesFor(role, install).map((lt) => [lt.name, lt.name]);
}
function LineSheet({ active, close, rerender }) {
  const ps = app.ps, cat = ps.cat;
  const [f, set] = useForm('line', { lt: 'OG', install: 'havai', og: cat.lineDefault('OG', 'havai'), ogN: 1, ag: cat.lineDefault('AG', 'havai'), agN: 1, mus: false, bare: false, bf: 'P', bn: 'R', ba: '', phase: 'uc', channel: 'toprak', depth: null, width: 0.4, channelOnly: false });
  const [more, setMore] = useState(() => ((app.state.forms || {}).line || {}).install === 'yeralti');
  const wrap = (body, foot) => html`<section class="sheet" aria-label="Hat"><div class="grab" onClick=${close}><i></i></div><div class="body">${body}</div>${foot ? html`<div class="foot">${foot}</div>` : null}</section>`;
  if (active) {
    const li = ps.result.lineInfo.get(active.id) || {};
    const last = active.nodes.length ? ps.pointById(active.nodes[active.nodes.length - 1]) : null;
    const toLine = app.state.toLine !== false;
    return wrap(html`
      <div class="card" style=${'border-color:' + (GCOL[active.lineType] || '#334155')}>
        <div class="row"><b class="grow" style="font-size:16px">${active.lineNo} · ${active.lineType} · ${active.install}</b><${Badge} k="ok">ÇİZİLİYOR</${Badge}></div>
        <div class="mono" style="font-size:12px;margin:4px 0">${lineLabel(active, cat) || 'iletken tanımsız'}</div>
        <div class="note">${active.nodes.length} düğüm · ${trn(li.length3D || 0, 2)} m (3B)${last ? ' · son: ' + last.pointNo : ''}</div>
      </div>
      <div class="row card" style="padding:10px 12px"><span class="grow" style="font-size:14px"><b>Alınanları bu hatta ekle</b><div class="note">Açıkken aldığın her direk, trafo ve SDK sırayla bu hatta bağlanır.</div></span><${Toggle} on=${toLine} onChange=${(v) => { app.state.toLine = v; rerender(); }} label="Alınanları hatta ekle" /></div>
      <div class="grid2">
        <button class="btn" disabled=${!active.nodes.length} onClick=${async () => { await ps.removeNode(active.id, active.nodes.length - 1); app.toast('Son düğüm hattan çıkarıldı', 'warn'); }}><${Icon} n="undo" s=${18} />Son düğümü çıkar</button>
        <button class="btn" onClick=${() => { close(); app.nav.go('line', { id: active.id }); }}><${Icon} n="edit" s=${18} />Hat kaydı</button>
      </div>
      <div class="note">Mevcut bir direği hatta bağlamak için haritada direğe dokun, "hattına ekle"ye bas. Direksiz güzergah noktası için: Alınacak nesne › Diğer › Hat köşe noktası.</div>`,
      html`<button class="btn grow" style="height:52px" onClick=${close}>Devam et</button><button class="btn pri grow" style="height:52px;font-size:16px" onClick=${() => { app.state.activeLineId = null; app.bus.emit('ui:sel'); app.toast(active.lineNo + ' tamamlandı'); close(); }}><${Icon} n="check" s=${20} c="#0b1326" />HATTI BİTİR</button>`);
  }
  const ogOn = f.lt === 'OG' || f.lt === 'ENH';
  const agShow = !ogOn || f.mus;
  const agRole = f.lt === 'ABONE' ? 'ABONE' : f.lt === 'AYD' ? 'AYD' : 'AG';
  const startPt = app.state.lineStartPoint ? ps.pointById(app.state.lineStartPoint) : null;
  const surf = KAPLAMA[f.surface] ? f.surface : 'toprak', meth = YONTEM[f.method] ? f.method : 'acik';
  const start = async () => {
    if (f.install === 'yeralti' && !f.depth) { setMore(true); app.toast('Yeraltı hat için kanal derinliği zorunlu', 'warn'); return; }
    const circuits = [];
    const chOnly = f.install === 'yeralti' && !!f.channelOnly;
    if (ogOn && !chOnly) circuits.push({ role: f.lt, key: f.og, count: f.ogN });
    if (agShow && !chOnly) circuits.push(f.bare && f.install === 'havai' && agRole !== 'ABONE' ? { role: agRole, custom: { f: f.bf, nt: f.bn, ay: f.ba || '' }, count: f.agN } : { role: agRole, key: f.ag, count: f.agN });
    const d = { lineType: f.lt, install: f.install, circuits, musterek: ogOn && f.mus, nodes: startPt ? [startPt.id] : [] };
    if (f.lt === 'ABONE') { d.abonePhase = f.phase; d.aboneCount = 1; }
    if (f.install === 'yeralti') { d.cable = { surface: surf, method: meth, depth: f.depth, width: f.width }; if (meth !== 'acik') { d.cable.pipeDia = +f.pipeDia || 110; d.cable.pipeCount = meth === 'borulu' ? Math.max(1, +f.pipeCount || 1) : (+f.pipeCount || 0); } if (chOnly) d.channelOnly = true; }
    const l = await ps.createLine(d);
    app.state.activeLineId = l.id; app.state.toLine = true; app.state.lineStartPoint = null; app.state.sel = null; app.bus.emit('ui:sel');
    await recent('form:line', f);
    app.toast(l.lineNo + ' başlatıldı · ' + (startPt ? 'ilk düğüm ' + startPt.pointNo : 'şimdi direkleri sırayla al'));
    close();
  };
  const agOptions = f.lt === 'ABONE' ? circuitOpts('ABONE', f.install).filter(([k]) => /2x16|3x16|4x16|NYY 2x|NYY 4x|NAYY 4x|3x25\+|4x25/.test(k)) : circuitOpts(agRole, f.install);
  const others = ps.data.lines.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5);
  const sumr = f.lt + ' · ' + (f.install === 'havai' ? 'havai' : 'yeraltı') + ' · ' + (ogOn ? (f.ogN > 1 ? f.ogN + '× ' : '') + f.og + (f.mus ? ' + AG' : '') : (f.agN > 1 ? f.agN + '× ' : '') + (f.bare && f.install === 'havai' && f.lt !== 'ABONE' ? '3' + f.bf + '+' + f.bn : f.ag));
  return wrap(html`
    <div class="row"><b class="grow" style="font-size:17px">Yeni hat</b>${startPt ? html`<${Badge} k="cy">İLK DÜĞÜM ${startPt.pointNo}</${Badge}>` : null}</div>
    <div class="row"><span class="lbl" style="width:64px">Hat tipi</span><div class="chips grow">${['AG', 'OG', 'AYD', 'ENH', 'ABONE'].map((k) => html`<${Chip} c=${GCOL[k]} on=${f.lt === k} onClick=${() => set({ lt: k, og: cat.lineDefault(k, f.install) || f.og, ag: cat.lineDefault(k === 'ABONE' ? 'ABONE' : 'AG', f.install) || f.ag })}>${k === 'AYD' ? 'AYD.' : k}</${Chip}>`)}</div></div>
    <div class="row"><span class="lbl" style="width:64px">Tesis</span><div class="grow"><${Seg} value=${f.install} options=${[['havai', 'Havai'], ['yeralti', 'Yeraltı']]} onChange=${(v) => { set({ install: v, og: cat.lineDefault('OG', v), ag: cat.lineDefault(f.lt === 'ABONE' ? 'ABONE' : 'AG', v) }); if (v === 'yeralti') setMore(true); }} /></div></div>
    ${f.install === 'yeralti' ? html`<div class="row card" style="padding:8px 10px"><span class="grow" style="font-size:13px"><b>Yalnız kanal / kazı</b><div class="note">Kablo yok; yalnız kanal metrajı çıkar.</div></span><${Toggle} on=${!!f.channelOnly} onChange=${(v) => set({ channelOnly: v })} label="Yalnız kanal" /></div>` : null}
    <button class="what" style="height:auto;min-height:52px;padding:8px 10px" onClick=${() => setMore(!more)}><span class="grow"><b>${f.install === 'yeralti' && f.channelOnly ? 'KANAL' : 'İLETKEN / KABLO'}</b><small style="white-space:normal">${f.install === 'yeralti' && f.channelOnly ? f.lt + ' · ' + KAPLAMA[surf] + (meth !== 'acik' ? ' · ' + YONTEM[meth] : '') + ' · ' + (f.depth ?? '?') + ' × ' + f.width + ' m' : sumr}</small></span><${Icon} n=${more ? 'up' : 'down'} s=${18} c="#94a3b8" /></button>
    ${more ? html`
      ${f.lt === 'ABONE' ? html`<div class="row"><span class="lbl" style="width:64px">Faz</span><div class="grow"><${Seg} c="#fbbf24" value=${f.phase} options=${[['tek', 'Tek fazlı'], ['uc', 'Üç fazlı']]} onChange=${(v) => set({ phase: v, ag: f.install === 'havai' ? (v === 'tek' ? '2x16+25 AER' : '3x16+25 AER') : (v === 'tek' ? 'NYY 2x16' : 'NYY 4x16') })} /></div></div>` : null}
      ${ogOn && !(f.install === 'yeralti' && f.channelOnly) ? html`<div class="row"><span class="lbl" style="width:64px;color:#ff8a8a">${f.lt}</span><select class="inp mono" style="width:64px" value=${f.ogN} onChange=${(e) => set({ ogN: +e.target.value })}>${[1, 2, 3].map((n) => html`<option value=${n}>${n}×</option>`)}</select><div class="grow"><${Sel} mono value=${f.og} options=${circuitOpts('OG', f.install)} onChange=${(v) => set({ og: v })} /></div></div>
        <div class="row card" style="padding:8px 10px"><span class="grow" style="font-size:13px">${f.install === 'yeralti' ? 'Aynı kanalda AG kablosu da var' : 'Aynı direklerde AG hattı da var (müşterek)'}</span><${Toggle} on=${f.mus} onChange=${(v) => set({ mus: v })} label="Müşterek" /></div>` : null}
      ${agShow && !(f.install === 'yeralti' && f.channelOnly) ? html`<div class="row"><span class="lbl" style="width:64px;color:${GCOL[f.lt === 'ABONE' ? 'ABONE' : f.lt === 'AYD' ? 'AYD' : 'AG']}">${f.lt === 'ABONE' ? 'Abone' : f.lt === 'AYD' ? 'Ayd.' : 'AG'}</span>
          <select class="inp mono" style="width:64px" value=${f.agN} onChange=${(e) => set({ agN: +e.target.value })}>${[1, 2, 3].map((n) => html`<option value=${n}>${n}×</option>`)}</select>
          <div class="grow">${f.bare && f.install === 'havai' && f.lt !== 'ABONE' ? html`<div class="row" style="gap:4px"><span class="mono">3</span><select class="inp mono" value=${f.bf} onChange=${(e) => set({ bf: e.target.value })}>${cat.t.conductors.filter((c) => c.kind === 'AAC').map((c) => html`<option value=${c.short}>${c.short}</option>`)}</select><span class="mono">+</span><select class="inp mono" value=${f.bn} onChange=${(e) => set({ bn: e.target.value })}>${cat.t.conductors.filter((c) => c.kind === 'AAC').map((c) => html`<option value=${c.short}>${c.short}</option>`)}</select><span class="mono">+</span><select class="inp mono" value=${f.ba} onChange=${(e) => set({ ba: e.target.value })}><option value="">—</option>${cat.t.conductors.filter((c) => c.kind === 'AAC').map((c) => html`<option value=${c.short}>${c.short}</option>`)}</select></div>` : html`<${Sel} mono value=${f.ag} options=${agOptions} onChange=${(v) => set({ ag: v })} />`}</div></div>
        ${f.install === 'havai' && f.lt !== 'ABONE' ? html`<div class="row"><span class="note grow">Çıplak Al iletken (Rose/Pansy…) — AG mesnet izolatörleri otomatik</span><${Toggle} on=${f.bare} onChange=${(v) => set({ bare: v })} label="Çıplak iletken" /></div>` : null}` : null}
      ${f.install === 'yeralti' ? html`<div class="row"><span class="lbl" style="width:64px">Kaplama</span><div class="chips grow">${Object.entries(KAPLAMA).map(([k, l]) => html`<${Chip} on=${surf === k} onClick=${() => set({ surface: k })}>${l}</${Chip}>`)}</div></div>
        <div class="row"><span class="lbl" style="width:64px">Yöntem</span><div class="chips grow">${Object.entries(YONTEM).map(([k, l]) => html`<${Chip} on=${meth === k} onClick=${() => set({ method: k })}>${l}</${Chip}>`)}</div></div>
        <div class="grid2"><div class="fld"><label>Derinlik (m) *</label><input class="inp mono" type="number" step="0.05" value=${f.depth ?? ''} placeholder="zorunlu" onChange=${(e) => set({ depth: e.target.value === '' ? null : +e.target.value })} /></div><div class="fld"><label>Genişlik (m)</label><input class="inp mono" type="number" step="0.05" value=${f.width ?? ''} onChange=${(e) => set({ width: +e.target.value })} /></div></div>
        ${meth !== 'acik' ? html`<div class="grid2"><div class="fld"><label>Boru çapı (mm)</label><${Sel} mono value=${+f.pipeDia || 110} options=${[110, 125, 160, 200].map((x) => [x, 'Ø' + x])} onChange=${(v) => set({ pipeDia: +v })} /></div><div class="fld"><label>Boru adedi${meth === 'sondaj' ? ' (yoksa 0)' : ''}</label><input class="inp mono" type="number" min=${meth === 'borulu' ? 1 : 0} step="1" value=${f.pipeCount ?? (meth === 'borulu' ? 1 : 0)} onChange=${(e) => set({ pipeCount: +e.target.value })} /></div></div>` : null}
        <div class="note">${meth === 'sondaj' ? 'Yatay sondaj: metraja sondaj boyu (m) gelir; kazı hacmi hesaplanmaz.' : 'Kanal hesabı: uzunluk × genişlik × derinlik = m³, seçilen kaplamanın kalemine yazılır.' + (meth === 'borulu' ? ' Borulu geçişte boru metrajı da gelir.' : '')}</div>` : null}` : null}
    <div class="note">Hattı başlattıktan sonra direkleri sırayla al; her direk otomatik bağlanır, köşe ve rol kendiliğinden hesaplanır. İletken bilgisi sonradan Hat kaydından değişir.</div>
    ${others.length ? html`<div class="lbl" style="margin-top:4px">Mevcut hatta devam et</div>
      <div class="card tight list">${others.map((l) => html`<button class="li" onClick=${() => { app.state.activeLineId = l.id; app.state.toLine = true; app.state.lineStartPoint = null; app.bus.emit('ui:sel'); app.toast(l.lineNo + ' çizime açıldı'); close(); }}><span style=${'width:18px;height:4px;flex-shrink:0;background:' + (GCOL[l.lineType] || '#fff')}></span><span class="grow"><span class="t">${l.lineNo} · ${l.lineType} · ${l.install}</span><div class="m">${l.nodes.length} düğüm · ${lineLabel(l, cat) || ''}</div></span><${Icon} n="next" s=${18} c="#94a3b8" /></button>`)}</div>` : null}`,
    html`<button class="btn grow" style="height:52px;flex:0 0 30%" onClick=${() => { app.state.lineStartPoint = null; close(); }}>Vazgeç</button><button class="btn pri grow" style="height:52px;font-size:16px" onClick=${start}><${Icon} n="plus" s=${20} c="#0b1326" />HAT BAŞLAT</button>`);
}

function useTrafo() {
  const ps = app.ps, cat = ps.cat;
  const [f, set] = useForm('trafo', { post: 'direk', state: 'yeni', kva: 250, cins: 'herm', poleName: 'G-T25', govde: '', oldKva: null });
  const post = cat.postType(f.post) || {};
  const binaLike = ['bina', 'ba', 'dapt', 'mod', 'kule', 'kulec', 'mono', 'rbk', 'mbk'].includes(f.post);
  const sizes = f.post === 'direk' ? cat.trafoSizes('direk', 'herm') : cat.trafoSizes('bina', f.cins);
  // v2.4 · Köşk tipi: prefabrik beton köşkte PB-1…PB-4, monoblokta TİP-1A/1B/1C boş gövde. Hücreler kendiliğinden gelmez (Kabin ekranından eklenir).
  const govdeList = koskGovdeleri(cat, f.post);
  const govde = govdeList.length ? (govdeList.find((g) => g.servis === f.govde) ? f.govde : (govdeList.find((g) => g.kisa === 'TİP-1C') || govdeList[0]).servis) : null;
  const kioskServis = f.post === 'mrmu' || f.post === 'ind' ? cat.kioskDefault(f.post) : null;
  const kRow = kioskServis ? cat.kiosk(kioskServis) : null;
  const kva = f.kva;
  const tdType = cat.poleTypeByName('trafo', f.poleName);
  const ts = TRAFO_STATUSES[f.state] || {};
  const e0 = { kind: 'transformer', state: f.state, attrs: Object.assign({ post: f.post, kva, cins: f.cins, poleTypeId: tdType && f.post === 'direk' ? tdType.id : null, kioskServis, oldKva: f.oldKva }, govde ? { govde } : {}) };
  const issues = [];
  if (post.maxKva && !post.noTrafo && (kva > post.maxKva || kva < post.minKva)) issues.push('UYUMSUZ: ' + kva + ' kVA, ' + post.label + ' için ' + post.minKva + '–' + post.maxKva + ' kVA');
  const comp = f.post === 'direk' ? (cat.table('trafoPoleCompat') || []).find((c) => c.pole === f.poleName) : null;
  if (comp && kva > comp.maxKva) issues.push('UYUMSUZ: ' + f.poleName + ' en fazla ' + comp.maxKva + ' kVA');
  const job = ts.job;
  const take = async (line, activeLine, acq) => {
    if (issues.length && !(await app.confirm('Uyumsuzluk', issues.join(' · ') + ' — yine de kaydedilsin mi? (Kontrol listesinde hata olarak kalır)', { ok: 'Kaydet', danger: true }))) return null;
    const pos = await acq({ critical: true, label: 'Trafo' });
    if (!pos) return null;
    const e = await ps.addEquipment('transformer', Object.assign({}, e0), pos);
    if (line) await ps.appendNode(line.id, e.pointId);
    await recent('form:trafo', f);
    return { msg: e.no + ' kaydedildi' + (line ? ' → ' + line.lineNo : '') + ' · ' + (ps.result.matsByEq.get(e.id) || { items: [] }).items.length + ' kalem' + (govde ? ' · hücreler için: trafoya dokun › Kabin' : ''), undo: { no: e.no, pointId: e.pointId, eqId: e.id, lineId: line ? line.id : null } };
  };
  const gRow = govde ? govdeList.find((g) => g.servis === govde) : null;
  const code = !job ? (f.state === 'mevcut' ? 'Mevcut · hakedişe girmez' : 'İleride · malzeme gelmez') : (gRow ? gRow.kisa + ' + ' : '') + (kRow ? kRow.servis : kva + ' kVA');
  return { f, set, post, binaLike, sizes, govdeList, govde, kioskServis, kRow, ts, issues, code, ok: true, label: 'TRAFO AL', title: 'TRAFO', sub: (post.label || 'Trafo') + (post.noTrafo ? '' : ' · ' + kva + ' kVA') + ' · ' + (ts.label || f.state), color: issues.length ? '#f59e0b' : '#6b82ff', take };
}
function TrafoFields({ m }) {
  const cat = app.ps.cat, f = m.f, set = m.set, post = m.post;
  return html`
    <div class="grid2"><${Fld} l="Posta tipi"><${Sel} value=${f.post} options=${cat.postTypes().map((p) => [p.id, p.label])} onChange=${(v) => set({ post: v })} /></${Fld}>
    <${Fld} l="Durum"><${Sel} value=${f.state} options=${Object.entries(TRAFO_STATUSES).map(([k, v]) => [k, v.label])} onChange=${(v) => set({ state: v })} /></${Fld}></div>
    ${!post.noTrafo ? html`<div class="grid2"><${Fld} l="Güç (kVA)"><${Sel} mono value=${f.kva} options=${m.sizes.map((k) => [k, k + ' kVA'])} onChange=${(v) => set({ kva: +v })} /></${Fld}>
      ${m.binaLike ? html`<${Fld} l="Cins"><${Sel} value=${f.cins} options=${[['herm', 'Hermetik yağlı'], ['kuru', 'Kuru tip']]} onChange=${(v) => set({ cins: v })} /></${Fld}>` : f.post === 'direk' ? html`<${Fld} l="Trafo direği"><${Sel} mono value=${f.poleName} options=${cat.poleTypes('trafo').map((t) => [t.name, t.name + ' · ' + t.kg + ' kg'])} onChange=${(v) => set({ poleName: v })} /></${Fld}>` : html`<div></div>`}</div>` : null}
    ${m.ts.removeOld ? html`<${Fld} l="Eski güç (kVA) · demontaj kalemi için"><${Sel} mono value=${f.oldKva || ''} options=${[['', 'seçin'], ...m.sizes.map((k) => [k, k + ' kVA'])]} onChange=${(v) => set({ oldKva: v ? +v : null })} /></${Fld}>` : null}
    ${m.govdeList.length ? html`<${Fld} l="Köşk tipi"><${Sel} value=${m.govde} options=${m.govdeList.map((g) => [g.servis, g.ad])} onChange=${(v) => set({ govde: v })} /></${Fld}>
      <div class="note">Köşk hücresiz kaydedilir. Hücreleri ve kablo kanallarını sonradan ekleyin: haritada trafoya dokunup "Kabin · hücreler".</div>` : null}
    ${m.issues.map((i) => html`<div class="alert err" style="padding:6px 10px">${i}</div>`)}`;
}
function Fld({ l, children }) { return html`<div class="fld"><label>${l}</label>${children}</div>`; }

// Diğer obje türleri (GEÇİŞ v2.2'de kaldırıldı). line: hat penceresini açar (kanal/kablo çizgisel objedir).
// v2.4: Menhol ve Armatür / lamba listeden çıkarıldı (armatür direğin malzemesidir). Eski kayıtlar açılır ve düzenlenir.
const OTHER_KINDS = [['sdk', 'SDK / Box', 'SDK AL'], ['panel', 'Pano', 'PANO AL'], ['subscriber', 'Abone', 'ABONE AL'], ['linept', 'Hat köşe noktası', 'KÖŞE AL'], ['detail', 'Detay noktası', 'DETAY AL'], ['other', 'Diğer (serbest)', 'OBJE AL']];
function useOther() {
  const ps = app.ps, cat = ps.cat;
  const [f, set] = useForm('other', { kind: 'sdk', sdkTypeId: null, outputs: 4, state: 'YENI', phase: 'uc', aboneNo: '', kofre: false, panelKey: '', lumServis: '', typeName: '', note: '' });
  const K = OTHER_KINDS.find((k) => k[0] === f.kind) || OTHER_KINDS[0];
  const kind = K[0];
  const sdkT = cat.sdkType(f.sdkTypeId) || cat.sdkTypes()[0] || {};
  const panels = cat.t.panels || [];
  const panel = panels.find((p) => p.id === f.panelKey) || null;
  const lums = luminairePoz(cat);
  const lum = lums.find((p) => p.servis === f.lumServis) || null;
  const take = async (line, activeLine, acq) => {
    if (kind === 'linept' && !activeLine) { app.toast('Köşe noktası için önce hat başlatın (+ HAT)', 'warn', 4000); return null; }
    const critical = kind === 'sdk' || kind === 'manhole' || kind === 'panel' || (kind === 'linept' && activeLine.install === 'havai');
    const pos = await acq({ critical, label: K[1] });
    if (!pos) return null;
    if (kind === 'linept') { const p = await ps.createPoint(Object.assign({ pointNo: ps.nextPointNo('P'), cls: 'HAT', critical }, pos)); await ps.appendNode(activeLine.id, p.id); return { msg: p.pointNo + ' → ' + activeLine.lineNo + ' köşe noktası', undo: { no: p.pointNo, pointId: p.id, eqId: null, lineId: activeLine.id } }; }
    if (kind === 'detail') { const p = await ps.createPoint(Object.assign({ pointNo: ps.nextPointNo('P'), cls: 'DETAY', critical: false, note: f.note || '' }, pos)); await ps.recompute('Detay noktası'); return { msg: p.pointNo + ' kaydedildi', undo: { no: p.pointNo, pointId: p.id, eqId: null, lineId: null } }; }
    const data = kind === 'sdk' ? { state: f.state, attrs: { sdkTypeId: f.sdkTypeId || sdkT.id, outputs: f.outputs, fuses: [] } }
      : kind === 'subscriber' ? { state: 'YENI', attrs: { phase: f.phase, aboneNo: f.aboneNo, kofre: !!f.kofre } }
      : kind === 'panel' ? { state: f.state, attrs: panel ? { servis: panel.servis, kva: panel.kva, typeName: (panel.kind === 'harici' ? 'Harici' : 'Dahili') + ' pano' } : { typeName: f.typeName || '' } }
      : kind === 'luminaire' ? { state: f.state, attrs: lum ? { servis: lum.servis, typeName: lum.name } : { typeName: f.typeName || '' } }
      : kind === 'other' ? { state: f.state, attrs: { typeName: f.typeName || '' }, note: f.note || '' }
      : { state: f.state, attrs: {} };
    const e = await ps.addEquipment(kind, data, pos);
    const ln = line && kind !== 'subscriber' && kind !== 'luminaire' && kind !== 'other' ? line : null;
    if (ln) await ps.appendNode(ln.id, e.pointId);
    return { msg: e.no + ' kaydedildi' + (ln ? ' → ' + ln.lineNo : ''), undo: { no: e.no, pointId: e.pointId, eqId: e.id, lineId: ln ? ln.id : null } };
  };
  const stL = ST_LBL[f.state] || f.state;
  const sub = kind === 'sdk' ? (sdkT.name || 'SDK') + ' · ' + f.outputs + ' çıkış · ' + stL
    : kind === 'subscriber' ? (f.phase === 'tek' ? 'Tek faz' : 'Üç faz') + (f.kofre ? ' · kofreli' : '') + (f.aboneNo ? ' · ' + f.aboneNo : '')
    : kind === 'panel' ? (panel ? (panel.kind === 'harici' ? 'Harici ' : 'Dahili ') + panel.kva + ' kVA' : f.typeName || 'tip serbest') + ' · ' + stL
    : kind === 'luminaire' ? (lum ? lum.name : f.typeName || 'tip serbest') + ' · ' + stL
    : kind === 'other' ? (f.typeName || 'serbest obje') + ' · ' + stL
    : kind === 'linept' ? 'aktif hatta güzergah noktası' : kind === 'detail' ? 'kritik olmayan nokta' : stL;
  const code = kind === 'sdk' ? sdkT.servis : kind === 'panel' && panel ? panel.servis : kind === 'luminaire' && lum ? lum.servis : kind === 'subscriber' ? 'Abone noktası' : kind === 'panel' || kind === 'luminaire' || kind === 'other' || kind === 'manhole' ? 'Poz kayıttan seçilir' : '—';
  return { f, set, kind, panels, lums, code, ok: true, label: K[2], title: K[1].toLocaleUpperCase('tr-TR'), sub, color: kind === 'subscriber' ? '#fbbf24' : kind === 'luminaire' ? '#fde047' : kind === 'sdk' || kind === 'manhole' || kind === 'panel' ? '#6b82ff' : '#e2e8f0', take };
}
function OtherFields({ m, active, startLine }) {
  const cat = app.ps.cat, f = m.f, set = m.set, kind = m.kind;
  const states = html`<div class="chips">${['YENI', 'MEVCUT', 'DEMONTAJ', 'DMM'].map((k) => html`<${Chip} c=${ST_COL[k]} on=${f.state === k} onClick=${() => set({ state: k })}>${ST_LBL[k]}</${Chip}>`)}</div>`;
  return html`
    <div class="grid2">${OTHER_KINDS.map(([k, l]) => html`<${Chip} on=${kind === k} onClick=${() => set({ kind: k })}>${l}</${Chip}>`)}</div>
    <div class="grid2"><button class="chip" onClick=${() => startLine({ install: 'yeralti', channelOnly: true, lt: 'AG' })}>Kanal / Kazı<small>çizgi</small></button><button class="chip" onClick=${() => startLine({ install: 'yeralti', channelOnly: false })}>Kablo (yeraltı)<small>çizgi</small></button></div>
    ${kind === 'sdk' ? html`<div class="grid2"><${Fld} l="SDK tipi"><${Sel} value=${f.sdkTypeId || (cat.sdkTypes()[0] || {}).id} options=${cat.sdkTypes().map((s) => [s.id, s.name])} onChange=${(v) => set({ sdkTypeId: v })} /></${Fld}><${Fld} l="Çıkış"><${Sel} mono value=${f.outputs} options=${[2, 3, 4, 6, 8].map((n) => [n, n + ' çıkış'])} onChange=${(v) => set({ outputs: +v })} /></${Fld}></div>` : null}
    ${kind === 'panel' ? html`<${Fld} l="Pano tipi"><${Sel} value=${f.panelKey || ''} options=${[['', 'Serbest (poz sonradan)'], ...m.panels.map((p) => [p.id, (p.kind === 'harici' ? 'Harici' : 'Dahili') + ' · ' + p.kva + ' kVA'])]} onChange=${(v) => set({ panelKey: v })} /></${Fld}>` : null}
    ${kind === 'luminaire' ? html`<${Fld} l="Armatür tipi"><${Sel} value=${f.lumServis || ''} options=${[['', 'Serbest (poz sonradan)'], ...m.lums.map((p) => [p.servis, p.name])]} onChange=${(v) => set({ lumServis: v })} /></${Fld}>` : null}
    ${(kind === 'panel' && !f.panelKey) || (kind === 'luminaire' && !f.lumServis) || kind === 'other' ? html`<${Fld} l=${kind === 'other' ? 'Obje adı / türü (serbest)' : 'Tip açıklaması (serbest)'}><input class="inp" value=${f.typeName} placeholder=${kind === 'other' ? 'ör. kamera direği, topraklama levhası' : 'ör. 100 W LED'} onChange=${(e) => set({ typeName: e.target.value })} /></${Fld}>` : null}
    ${kind === 'sdk' || kind === 'manhole' || kind === 'panel' || kind === 'luminaire' || kind === 'other' ? states : null}
    ${kind === 'subscriber' ? html`<div class="grid2"><${Fld} l="Faz"><${Seg} c="#fbbf24" value=${f.phase} options=${[['tek', 'Tek'], ['uc', 'Üç']]} onChange=${(v) => set({ phase: v })} /></${Fld}><${Fld} l="Abone / tesisat no"><input class="inp mono" value=${f.aboneNo} onChange=${(e) => set({ aboneNo: e.target.value })} /></${Fld}></div>
      <${Fld} l="Kofre"><${Seg} c="#fbbf24" value=${f.kofre ? 'var' : 'yok'} options=${[['yok', 'Kofre yok'], ['var', 'Kofre var']]} onChange=${(v) => set({ kofre: v === 'var' })} /></${Fld}>` : null}
    ${kind === 'detail' || kind === 'other' ? html`<${Fld} l="Açıklama"><input class="inp" value=${f.note} onChange=${(e) => set({ note: e.target.value })} /></${Fld}>` : null}
    ${kind === 'linept' ? html`<div class=${'alert ' + (active ? 'info' : 'warn')}>${active ? 'Direk olmayan güzergah/köşe noktası ' + active.lineNo + ' hattına eklenir (ör. yeraltı kablo dönüşü).' : 'Önce bir hat başlatın: alttaki "+ HAT" düğmesi.'}</div>` : null}`;
}
