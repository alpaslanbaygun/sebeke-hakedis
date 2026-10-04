// 01 · Harita & Nokta Alımı — gerçek GIS motoru + tek elle hızlı ekipman/hat alımı.
import { html, useState, useEffect, useRef, useBus, Icon, Chip, Seg, Toggle, Sel, Badge, fmt, trn, FIXCOL } from '../kit.js';
import { app } from '../ctx.js';
import { MapEngine } from '../map-engine.js';
import { measure, recent, favorites, loadTile, BASEMAPS } from '../services.js';
import { dist2, bearing, polygonArea, polylineLength, dms, segProject } from '../../geo/geom.js';
import { STATUSES, TRAFO_STATUSES } from '../../core/schema.js';
import { lineLabel } from '../../grid/lines.js';
import { roleLabel } from '../../grid/checks.js';
import { jobOf } from '../../grid/recipe.js';

const GEN = { AG: ['sehir', 'beton', 'agac'], OG: ['bahh', 'civ', 'beton562', 'agac'], MUS: ['mus', 'beton', 'agac'], AYD: ['ayd'] };
const GCOL = { AG: '#7ee08a', OG: '#ff8a8a', MUS: '#ff8a8a', AYD: '#7fffff', ENH: '#ff9aff', ABONE: '#fbbf24' };
const ST_COL = { YENI: '#10b981', MEVCUT: '#cbd5e1', DMM: '#f59e0b', DEMONTAJ: '#ffff00', ILERIDE: '#94a3b8' };

export function mapData() {
  const ps = app.ps;
  const d = ps.data, r = ps.result;
  const pointMap = new Map(d.points.map((p) => [p.id, p]));
  const eqByPoint = new Map();
  for (const e of d.equipment) { if (!eqByPoint.has(e.pointId)) eqByPoint.set(e.pointId, []); eqByPoint.get(e.pointId).push(e); }
  const bm = BASEMAPS.find((b) => b.id === (app.state.basemap || 'none'));
  const g = app.gnss.state;
  return {
    points: d.points, equipment: d.equipment, lines: d.lines, crossings: d.crossings, pointMap, eqByPoint, roles: r ? r.roles : new Map(),
    sel: app.state.sel, target: app.state.target, crs: ps.p.crs, basemap: bm && bm.url ? bm : null,
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
  const [tool, setTool] = useState(null);
  if (app.state.follow === undefined) app.state.follow = true;
  const [follow, setFollow] = useState(!!app.state.follow);
  const [layersOpen, setLayersOpen] = useState(false);
  const [measuring, setMeasuring] = useState(null);
  const [padB, setPadB] = useState(150);
  const [busy, setBusy] = useState(false);
  const [lastCap, setLastCap] = useState(app.state.lastCap || null);
  const [, force] = useState(0);
  useBus(['project:computed', 'project:open', 'ui:sel']);
  useBus('gnss:state', 300);
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
    const syncPad = () => { if (!el) return; const h = el.getBoundingClientRect().height; e.setPad({ bottom: h }); setPadB(Math.round(h)); };
    syncPad();
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(syncPad) : null;
    if (ro) ro.observe(el);
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
    return () => { off1(); off2(); off3(); off4(); off5(); if (ro) ro.disconnect(); e.destroy(); };
  }, []);
  const back = useRef(null);
  back.current = () => { if (panel) { setPanel(null); return true; } if (app.state.sel) { select(null); return true; } if (tool) { setTool(null); return true; } return false; };
  useEffect(() => { app.backHook = () => back.current(); return () => { app.backHook = null; }; }, []);
  useEffect(() => { if (eng.current) { eng.current.o.editNodes = tool === 'edit'; app.state.tool = tool; if (tool !== 'measure' && tool !== 'area') eng.current.measure = null; else if (!eng.current.measure) eng.current.measure = { mode: tool, pts: [] }; eng.current.invalidate(); } }, [tool]);

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
    else select(null);
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
      const r = await cur.take(active && toLine ? active : null, active);
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
  const closePanel = () => setPanel(null);
  return html`<div class="mapwrap"><canvas ref=${cv} aria-label="Harita"></canvas></div>
    <div class="fabl">
      <button aria-label="Proje merkezi" onClick=${() => app.nav.go('hub')}><${Icon} n="folder" /></button>
      <button aria-label="Tümünü sığdır" onClick=${() => { setFollow(false); app.state.follow = false; eng.current.fit(ps.data.points); }}><${Icon} n="north" s=${18} c="#dae2fd" fill="#334155" /></button>
    </div>
    <div class="fab" style="top:12px">
      <button class=${layersOpen ? 'on' : ''} aria-label="Katmanlar" onClick=${() => setLayersOpen(!layersOpen)}><${Icon} n="layers" /></button>
      <button class=${tool === 'measure' || tool === 'area' ? 'on' : ''} aria-label="Ölçüm" onClick=${() => setTool(tool === 'measure' ? 'area' : tool === 'area' ? null : 'measure')}><${Icon} n="ruler" /></button>
      <button class=${tool === 'edit' ? 'on' : ''} aria-label="Düğüm düzenle" onClick=${() => setTool(tool === 'edit' ? null : 'edit')}><${Icon} n="edit" /></button>
    </div>
    <div class="fab" style=${'bottom:' + (padB + 10) + 'px'}>
      ${visH > 380 ? html`<button aria-label="Yakınlaş" onClick=${() => eng.current.zoom(0.6)}><${Icon} n="plus" /></button>
      <button aria-label="Uzaklaş" onClick=${() => eng.current.zoom(1.6)}><${Icon} n="minus" /></button>` : null}
      <button class=${'loc' + (follow ? ' on' : '')} aria-label="Konumuma git" onClick=${locate}><${Icon} n="locate" s=${24} /></button>
    </div>
    <div class="maptag coord" style=${'left:12px;bottom:' + (padB + 10) + 'px'}>Y ${g.E != null ? g.E.toFixed(3) : '—'}  X ${g.N != null ? g.N.toFixed(3) : '—'}  Z ${g.H != null ? g.H.toFixed(3) : '—'}</div>
    ${active ? html`<button class="maptag" style=${'left:12px;top:124px;color:#dae2fd;border-color:' + (GCOL[active.lineType] || '#334155')} onClick=${() => setPanel('line')}>${active.lineNo} çiziliyor · ${toLine ? 'alınanlar hatta eklenir' : 'otomatik ekleme kapalı'}</button>` : null}
    ${tool === 'edit' ? html`<div class="maptag" style=${'left:12px;top:' + (active ? 156 : 124) + 'px;color:#fbbf24'}>Düğüm düzenleme: noktayı sürükleyin</div>` : null}
    ${tool === 'measure' || tool === 'area' ? html`<div class="maptag" style=${'left:12px;top:' + (active ? 156 : 124) + 'px;color:#22d3ee'}>${tool === 'area' ? 'Alan ölçümü' : 'Mesafe ölçümü'}: haritaya dokunun</div>` : null}
    ${layersOpen ? html`<${LayerPop} eng=${eng.current} close=${() => setLayersOpen(false)} />` : null}
    <div class="base" ref=${base}>
      ${m ? html`<${MeasurePanel} m=${m} clear=${() => { m.pts = []; eng.current.invalidate(); force((x) => x + 1); }} undo=${() => { m.pts.pop(); eng.current.invalidate(); force((x) => x + 1); }} close=${() => setTool(null)} />`
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
              <button class="undo" aria-label="Son alımı geri al" disabled=${!lastCap || busy} onClick=${undoLast}><${Icon} n="undo" s=${22} /></button>
              <${TakeBtn} label=${cur.label} measuring=${measuring} busy=${busy} disabled=${!cur.ok} onTake=${doTake} />
            </div>
          </div>`}
    </div>
    ${panel ? html`<div class="scrim" onClick=${closePanel}></div>` : null}
    ${panel === 'pick' ? html`<section class="sheet" aria-label="Alınacak nesne">
        <div class="grab" onClick=${closePanel}><i></i></div>
        <div class="body">
          <div class="seg">${[['direk', 'DİREK'], ['trafo', 'TRAFO'], ['diger', 'DİĞER']].map(([k, l]) => html`<button class=${'chip' + (kind === k ? ' on' : '')} style="min-height:46px;font-size:14px;letter-spacing:.04em" onClick=${() => setKind(k)}>${l}</button>`)}</div>
          ${kind === 'direk' ? html`<${PoleFields} m=${pole} close=${closePanel} />` : kind === 'trafo' ? html`<${TrafoFields} m=${trafo} />` : html`<${OtherFields} m=${other} active=${active} />`}
        </div>
        <div class="foot"><div class="grow" style="min-width:0"><div class="lbl">Yeşil Defter</div><div class="mono" style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cur.code || '—'}</div></div><button class="btn pri" style="flex:0 0 46%;height:52px;font-size:16px" onClick=${closePanel}><${Icon} n="check" s=${20} c="#0b1326" />TAMAM</button></div>
      </section>` : null}
    ${panel === 'line' ? html`<${LineSheet} active=${active} close=${closePanel} rerender=${() => force((x) => x + 1)} />` : null}`;
}
MapScreen.flush = true;
MapScreen.compactHud = true;

function LayerPop({ eng, close }) {
  const [, f] = useState(0);
  const L = eng.layers;
  const t = (k) => { L[k] = !L[k]; app.state.layers = Object.assign({}, L); eng.invalidate(); f((x) => x + 1); };
  const items = [['AG', 'A.G. şebeke', '#7ee08a'], ['OG', 'O.G. şebeke', '#ff6b6b'], ['AYD', 'Aydınlatma', '#7fffff'], ['ENH', 'E.N.H.', '#ff79ff'], ['ABONE', 'Abone', '#fbbf24'], ['yeralti', 'Yeraltı kablo', '#ff6b6b'], ['trafo', 'Trafo ve box', '#6b82ff'], ['mevcut', 'Mevcut elemanlar', '#00ffbf'], ['demontaj', 'Demontaj işareti', '#ffff00'], ['points', 'Ölçü noktaları', '#e2e8f0'], ['labels', 'Etiketler', '#94a3b8'], ['spanText', 'Açıklık yazıları', '#94a3b8'], ['grid', 'Koordinat ızgarası', '#94a3b8'], ['basemap', 'Altlık harita', '#94a3b8']];
  return html`<div class="card" style="position:absolute;right:68px;top:12px;z-index:6;width:230px;padding:6px;max-height:60%;overflow:auto">
    ${items.map(([k, l, c]) => html`<button class="li" style="min-height:40px;padding:6px 8px" onClick=${() => t(k)}><span style=${'width:18px;height:3px;background:' + c}></span><span class="grow" style="font-size:13px">${l}</span><${Icon} n=${L[k] ? 'check' : 'minus'} s=${16} c=${L[k] ? '#10b981' : '#475569'} /></button>`)}
    <div class="row" style="padding:6px 8px"><span class="note grow">Altlık</span><select class="inp" style="height:34px;font-size:12px" value=${app.state.basemap || 'none'} onChange=${(e) => { app.state.basemap = e.target.value; app.ds.setting('basemap', e.target.value); eng.invalidate(); f((x) => x + 1); }}>${BASEMAPS.map((b) => html`<option value=${b.id}>${b.label}</option>`)}</select></div>
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
      <div class="grid3"><div class="stat"><b>2B</b><span>${trn(li.length2D, 2)}</span><small>m</small></div><div class="stat"><b>3B</b><span>${trn(li.length3D, 2)}</span><small>m</small></div><div class="stat"><b>Açıklık</b><span>${li.spans || 0}</span></div></div>
      <div class="grid2">
        <button class="btn" onClick=${() => app.nav.go('line', { id: l.id })}><${Icon} n="edit" s=${18} />Hat kaydı</button>
        <button class=${'btn' + (act ? ' pri' : '')} onClick=${() => { app.state.activeLineId = act ? null : l.id; select(null); app.toast(act ? l.lineNo + ' tamamlandı' : l.lineNo + ' çizime açıldı · alınan direkler bu hatta eklenir'); }}>${act ? 'Hattı bitir' : 'Devam çiz'}</button>
        <button class="btn" onClick=${async () => { await ps.reverseLine(l.id); app.toast('Hat yönü ters çevrildi'); }}><${Icon} n="reverse" s=${18} />Ters çevir</button>
        <button class="btn" disabled=${!(sel.seg > 0)} onClick=${async () => { const nl = await ps.splitLine(l.id, sel.seg); app.toast(l.lineNo + ' bölündü → ' + nl.lineNo); select(null); }}><${Icon} n="split" s=${18} />Düğümde böl</button>
      </div>
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
  const src = { GNSS_RTK: ['RTK', 'ok'], PHONE: ['TELEFON · TEST', 'cy'], MANUAL: ['MANUEL', 'warn'], DESIGN: ['TASARIM', 'm'], SIM: ['SİMÜLATÖR', 'mut'], IMPORT: ['İÇE ALINDI', 'mut'] }[p.source] || [p.source, 'mut'];
  const remeasure = async () => {
    const obs = await measure({ critical: p.critical !== false, label: p.pointNo });
    if (!obs) return;
    const why = await app.prompt('Yeniden ölçüm', 'Gerekçe', { value: p.source === 'PHONE' ? 'Telefon GPS noktası RTK ile ölçüldü' : 'Yeniden ölçüm', required: true });
    if (!why) return;
    await ps.remeasure(p.id, obs, why);
    const im = ps.lastImpact;
    app.toast(p.pointNo + ' revize edildi' + (im ? ' → ' + im.spans + ' açıklık, ' + im.roles + ' rol, ' + im.materials + ' reçete, ' + im.quantities + ' metraj' : ''), 'ok', 5000);
  };
  return html`<div class="body">
    <div class="row"><b class="grow" style="font-size:17px">${e ? e.no : p.pointNo}</b><${Badge} k=${src[1]}>${src[0]}</${Badge}><button class="btn xs" onClick=${() => select(null)}><${Icon} n="x" s=${16} /></button></div>
    ${e ? html`<div style="font-size:13px">${eqSummary(e)}${ri && ri.role ? html` · <b class="hw">${roleLabel(ri.role)}${ri.angle ? ' α=' + dms(ri.angle) : ''}</b>` : null}</div>` : html`<div class="note">${p.cls} noktası</div>`}
    <div class="grid3 mono" style="font-size:12px"><div class="stat"><b>Y</b><span style="font-size:13px">${fmt(p.E)}</span></div><div class="stat"><b>X</b><span style="font-size:13px">${fmt(p.N)}</span></div><div class="stat"><b>Z</b><span style="font-size:13px">${fmt(p.H)}</span></div></div>
    ${p.quality ? html`<div class="note mono">${p.quality.fix} · σH ${fmt(p.quality.sigmaH)} · σV ${fmt(p.quality.sigmaV)} · PDOP ${fmt(p.quality.pdop, 1)} · ${p.quality.sats ?? '—'} uydu · ${p.quality.epochs ?? 1} epok</div>` : null}
    ${iss.slice(0, 3).map((i) => html`<div class=${'alert ' + (i.severity === 'error' ? 'err' : 'warn')} style="padding:6px 10px"><b>${i.code}</b> ${i.message}</div>`)}
    ${act ? html`<button class="btn pri blk" style="height:52px;font-size:15px" disabled=${act.nodes[act.nodes.length - 1] === p.id} onClick=${async () => { await ps.appendNode(act.id, p.id); app.toast(p.pointNo + ' → ' + act.lineNo + ' hattına eklendi'); select(null); }}><${Icon} n="plus" s=${20} c="#0b1326" />${act.nodes[act.nodes.length - 1] === p.id ? act.lineNo + ' hattının son düğümü' : act.lineNo + ' hattına ekle'}</button>`
      : html`<button class="btn blk" onClick=${() => { app.state.lineStartPoint = p.id; select(null); openLine(); }}><${Icon} n="plus" s=${18} />Buradan hat başlat</button>`}
    <div class="grid2">
      ${e ? html`<button class=${'btn' + (act ? '' : ' pri')} onClick=${() => app.nav.go('equipment', { id: e.id })}><${Icon} n="edit" s=${18} />Kayıt</button>` : html`<button class=${'btn' + (act ? '' : ' pri')} onClick=${() => app.nav.go('point', { id: p.id })}>Nokta kaydı</button>`}
      <button class="btn" onClick=${() => app.nav.go('photo', { ownerId: e ? e.id : p.id, pointId: p.id, ownerNo: e ? e.no : p.pointNo })}><${Icon} n="camera" s=${18} />Fotoğraf</button>
      <button class="btn" onClick=${remeasure}><${Icon} n="cross" s=${18} />Yeniden ölç</button>
      <button class="btn" onClick=${() => { app.state.target = { id: p.id }; app.nav.tab('stake'); }}><${Icon} n="target" s=${18} />Aplikasyon</button>
    </div>
  </div>`;
}
export function eqSummary(e) {
  const ps = app.ps;
  if (e.kind === 'pole' || e.kind === 'lighting') { const t = ps.cat.poleType(e.typeId); const g = ps.cat.poleGroup(e.group); return (g ? g.short : '') + ' · ' + (t ? t.name : 'tip yok') + ' · ' + ((STATUSES[e.state] || {}).label || e.state); }
  if (e.kind === 'transformer') { const a = e.attrs || {}; const pt = ps.cat.postType(a.post); return (pt ? pt.label : 'Trafo') + ' · ' + (a.kva ? a.kva + ' kVA' : '') + ' · ' + ((TRAFO_STATUSES[e.state] || {}).label || e.state); }
  if (e.kind === 'sdk') { const t = ps.cat.sdkType((e.attrs || {}).sdkTypeId); return 'SDK · ' + (t ? t.name : '') + ' · ' + ((STATUSES[e.state] || {}).label || ''); }
  if (e.kind === 'subscriber') return 'Abone · ' + ((e.attrs || {}).phase === 'tek' ? 'tek faz' : 'üç faz') + ((e.attrs || {}).aboneNo ? ' · ' + e.attrs.aboneNo : '');
  return e.kind;
}

// ---------------- Alım: düğme + tür modelleri ----------------
function useForm(key, init) {
  const [f, setF] = useState(() => Object.assign({}, init, (app.state.forms || {})[key] || {}));
  useEffect(() => { recent('form:' + key).then((r) => { if (r && !(app.state.forms || {})[key]) setF((x) => Object.assign({}, x, r)); }); }, []);
  const set = (patch) => setF((x) => { const n = Object.assign({}, x, patch); app.state.forms = Object.assign({}, app.state.forms, { [key]: n }); return n; });
  return [f, set];
}
// Büyük ALIM düğmesi: her zaman ekranın altında; durumu (FIX / FLOAT / kaynak yok / ölçülüyor) kendi üstünde gösterir
function TakeBtn({ label, onTake, disabled, measuring, busy }) {
  const g = app.gnss.state;
  const none = g.source === 'none';
  let b = none ? { bg: '#2d3449', fg: '#94a3b8', t: 'KAYNAK YOK' } : g.source === 'phone' ? { bg: '#38bdf8', fg: '#0b1326', t: (label || 'NOKTA AL') + ' · TEST' } : g.fix === 'FIX' ? { bg: '#10b981', fg: '#0b1326', t: label || 'NOKTA AL' } : g.fix === 'FLOAT' ? { bg: '#f59e0b', fg: '#0b1326', t: 'FLOAT · BEKLE' } : { bg: '#2d3449', fg: '#94a3b8', t: 'FIX YOK' };
  let style = 'background:' + b.bg + ';border-color:' + b.bg + ';color:' + b.fg;
  let text = b.t;
  if (measuring) {
    const pct = Math.round(100 * Math.min(1, (measuring.n || 0) / (measuring.need || 1)));
    style = 'background:linear-gradient(90deg,#10b981 ' + pct + '%,#0f5c46 ' + pct + '%);border-color:#10b981;color:#0b1326';
    text = 'ÖLÇÜLÜYOR ' + (measuring.n || 0) + '/' + measuring.need;
  }
  return html`<button class="btn huge take" style=${style} disabled=${disabled || busy} onClick=${onTake}><${Icon} n="cross" s=${24} c=${b.fg} w=${2.4} />${text}</button>`;
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
  const take = async (line) => {
    if (!t) { app.toast('Önce direk tipini seçin', 'warn'); return null; }
    const obs = await measure({ critical: true, label: 'Direk' });
    if (!obs) return null;
    const e = await ps.addEquipment(group === 'ayd' ? 'lighting' : 'pole', { group, typeId, state: f.state }, { obs });
    if (line) await ps.appendNode(line.id, e.pointId);
    const cur = { gen: f.gen, group, typeId, state: f.state };
    await recent('form:pole', cur);
    const rc = [cur, ...recents.filter((x) => !(x.typeId === typeId && x.state === f.state))].slice(0, 6);
    setRecents(rc); await recent('poles', rc);
    const ri = ps.result.roles.get(e.id);
    return { msg: e.no + ' kaydedildi' + (line ? ' → ' + line.lineNo : '') + (ri && ri.role ? ' · ' + roleLabel(ri.role) + (ri.angle ? ' α=' + ri.angle.toFixed(1) + '°' : '') : ''), undo: { no: e.no, pointId: e.pointId, eqId: e.id, lineId: line ? line.id : null } };
  };
  return { f, set, favs, setFavs, recents, groups, group, types, typeId, t, gr, code, ok: !!t, label: 'DİREK AL', title: GEN_LBL[f.gen] || 'DİREK', sub: (t ? t.name : 'tip seçin') + ' · ' + (ST_LBL[f.state] || f.state), color: ST_COL[f.state] || '#10b981', take };
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
    <div class="note">Rol (taşıyıcı / durdurucu / köşe / nihayet) ve köşe açısı hat geometrisinden otomatik hesaplanır; tip harfiyle uyuşmazsa uyarı verilir.</div>`;
}

// ---------------- Hat: başlat / devam / bitir tek pencerede ----------------
function circuitOpts(role, install) {
  const cat = app.ps.cat;
  return cat.lineTypesFor(role, install).map((lt) => [lt.name, lt.name]);
}
function LineSheet({ active, close, rerender }) {
  const ps = app.ps, cat = ps.cat;
  const [f, set] = useForm('line', { lt: 'OG', install: 'havai', og: cat.lineDefault('OG', 'havai'), ogN: 1, ag: cat.lineDefault('AG', 'havai'), agN: 1, mus: false, bare: false, bf: 'P', bn: 'R', ba: '', phase: 'uc', channel: 'toprak', depth: null, width: 0.4 });
  const [more, setMore] = useState(false);
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
  const start = async () => {
    if (f.install === 'yeralti' && !f.depth) { setMore(true); app.toast('Yeraltı hat için kanal derinliği zorunlu', 'warn'); return; }
    const circuits = [];
    if (ogOn) circuits.push({ role: f.lt, key: f.og, count: f.ogN });
    if (agShow) circuits.push(f.bare && f.install === 'havai' && agRole !== 'ABONE' ? { role: agRole, custom: { f: f.bf, nt: f.bn, ay: f.ba || '' }, count: f.agN } : { role: agRole, key: f.ag, count: f.agN });
    const d = { lineType: f.lt, install: f.install, circuits, musterek: ogOn && f.mus, nodes: startPt ? [startPt.id] : [] };
    if (f.lt === 'ABONE') { d.abonePhase = f.phase; d.aboneCount = 1; }
    if (f.install === 'yeralti') d.cable = { channelType: f.channel, depth: f.depth, width: f.width };
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
    <button class="what" style="height:auto;min-height:52px;padding:8px 10px" onClick=${() => setMore(!more)}><span class="grow"><b>İLETKEN / KABLO</b><small style="white-space:normal">${sumr}</small></span><${Icon} n=${more ? 'up' : 'down'} s=${18} c="#94a3b8" /></button>
    ${more ? html`
      ${f.lt === 'ABONE' ? html`<div class="row"><span class="lbl" style="width:64px">Faz</span><div class="grow"><${Seg} c="#fbbf24" value=${f.phase} options=${[['tek', 'Tek fazlı'], ['uc', 'Üç fazlı']]} onChange=${(v) => set({ phase: v, ag: f.install === 'havai' ? (v === 'tek' ? '2x16+25 AER' : '3x16+25 AER') : (v === 'tek' ? 'NYY 2x16' : 'NYY 4x16') })} /></div></div>` : null}
      ${ogOn ? html`<div class="row"><span class="lbl" style="width:64px;color:#ff8a8a">${f.lt}</span><select class="inp mono" style="width:64px" value=${f.ogN} onChange=${(e) => set({ ogN: +e.target.value })}>${[1, 2, 3].map((n) => html`<option value=${n}>${n}×</option>`)}</select><div class="grow"><${Sel} mono value=${f.og} options=${circuitOpts('OG', f.install)} onChange=${(v) => set({ og: v })} /></div></div>
        <div class="row card" style="padding:8px 10px"><span class="grow" style="font-size:13px">Aynı direklerde AG hattı da var (müşterek)</span><${Toggle} on=${f.mus} onChange=${(v) => set({ mus: v })} label="Müşterek" /></div>` : null}
      ${agShow ? html`<div class="row"><span class="lbl" style="width:64px;color:${GCOL[f.lt === 'ABONE' ? 'ABONE' : f.lt === 'AYD' ? 'AYD' : 'AG']}">${f.lt === 'ABONE' ? 'Abone' : f.lt === 'AYD' ? 'Ayd.' : 'AG'}</span>
          <select class="inp mono" style="width:64px" value=${f.agN} onChange=${(e) => set({ agN: +e.target.value })}>${[1, 2, 3].map((n) => html`<option value=${n}>${n}×</option>`)}</select>
          <div class="grow">${f.bare && f.install === 'havai' && f.lt !== 'ABONE' ? html`<div class="row" style="gap:4px"><span class="mono">3</span><select class="inp mono" value=${f.bf} onChange=${(e) => set({ bf: e.target.value })}>${cat.t.conductors.filter((c) => c.kind === 'AAC').map((c) => html`<option value=${c.short}>${c.short}</option>`)}</select><span class="mono">+</span><select class="inp mono" value=${f.bn} onChange=${(e) => set({ bn: e.target.value })}>${cat.t.conductors.filter((c) => c.kind === 'AAC').map((c) => html`<option value=${c.short}>${c.short}</option>`)}</select><span class="mono">+</span><select class="inp mono" value=${f.ba} onChange=${(e) => set({ ba: e.target.value })}><option value="">—</option>${cat.t.conductors.filter((c) => c.kind === 'AAC').map((c) => html`<option value=${c.short}>${c.short}</option>`)}</select></div>` : html`<${Sel} mono value=${f.ag} options=${agOptions} onChange=${(v) => set({ ag: v })} />`}</div></div>
        ${f.install === 'havai' && f.lt !== 'ABONE' ? html`<div class="row"><span class="note grow">Çıplak Al iletken (Rose/Pansy…) — AG mesnet izolatörleri otomatik</span><${Toggle} on=${f.bare} onChange=${(v) => set({ bare: v })} label="Çıplak iletken" /></div>` : null}` : null}
      ${f.install === 'yeralti' ? html`<div class="row"><span class="lbl" style="width:64px">Kanal</span><div class="chips grow">${[['toprak', 'Toprak'], ['beton', 'Beton'], ['borulu', 'Borulu'], ['direk', 'Direk inişi'], ['duvar', 'Duvar']].map(([k, l]) => html`<${Chip} on=${f.channel === k} onClick=${() => set({ channel: k })}>${l}</${Chip}>`)}</div></div>
        <div class="grid2"><div class="fld"><label>Derinlik (m) *</label><input class="inp mono" type="number" step="0.05" value=${f.depth ?? ''} placeholder="zorunlu" onChange=${(e) => set({ depth: e.target.value === '' ? null : +e.target.value })} /></div><div class="fld"><label>Genişlik (m)</label><input class="inp mono" type="number" step="0.05" value=${f.width ?? ''} onChange=${(e) => set({ width: +e.target.value })} /></div></div>` : null}` : null}
    <div class="note">Hattı başlattıktan sonra direkleri sırayla al; her direk otomatik bağlanır, köşe ve rol kendiliğinden hesaplanır. İletken bilgisi sonradan Hat kaydından değişir.</div>
    ${others.length ? html`<div class="lbl" style="margin-top:4px">Mevcut hatta devam et</div>
      <div class="card tight list">${others.map((l) => html`<button class="li" onClick=${() => { app.state.activeLineId = l.id; app.state.toLine = true; app.state.lineStartPoint = null; app.bus.emit('ui:sel'); app.toast(l.lineNo + ' çizime açıldı'); close(); }}><span style=${'width:18px;height:4px;flex-shrink:0;background:' + (GCOL[l.lineType] || '#fff')}></span><span class="grow"><span class="t">${l.lineNo} · ${l.lineType} · ${l.install}</span><div class="m">${l.nodes.length} düğüm · ${lineLabel(l, cat) || ''}</div></span><${Icon} n="next" s=${18} c="#94a3b8" /></button>`)}</div>` : null}`,
    html`<button class="btn grow" style="height:52px;flex:0 0 30%" onClick=${() => { app.state.lineStartPoint = null; close(); }}>Vazgeç</button><button class="btn pri grow" style="height:52px;font-size:16px" onClick=${start}><${Icon} n="plus" s=${20} c="#0b1326" />HAT BAŞLAT</button>`);
}

function useTrafo() {
  const ps = app.ps, cat = ps.cat;
  const [f, set] = useForm('trafo', { post: 'direk', state: 'yeni', kva: 250, cins: 'herm', poleName: 'G-T25', kFam: 'TİP-1C', kiosk: null, oldKva: null });
  const post = cat.postType(f.post) || {};
  const binaLike = ['bina', 'ba', 'dapt', 'mod', 'kule', 'kulec', 'mono', 'rbk'].includes(f.post);
  const sizes = f.post === 'direk' ? cat.trafoSizes('direk', 'herm') : cat.trafoSizes('bina', f.cins);
  const kioskMode = f.post === 'mbk' || f.post === 'rbk' || f.post === 'mrmu' || f.post === 'ind';
  const fams = cat.kioskFamilies();
  const kList = f.post === 'mbk' ? cat.kiosksOf(f.kFam) : [];
  const kioskServis = f.post === 'mbk' ? (kList.find((k) => k.servis === f.kiosk) ? f.kiosk : (kList[0] || {}).servis) : kioskMode ? cat.kioskDefault(f.post) : null;
  const kRow = kioskServis ? cat.kiosk(kioskServis) : null;
  const kva = kRow && kRow.kva ? kRow.kva : f.kva;
  const tdType = cat.poleTypeByName('trafo', f.poleName);
  const ts = TRAFO_STATUSES[f.state] || {};
  const e0 = { kind: 'transformer', state: f.state, attrs: { post: f.post, kva, cins: f.cins, poleTypeId: tdType && f.post === 'direk' ? tdType.id : null, kioskServis, oldKva: f.oldKva } };
  const issues = [];
  if (post.maxKva && !post.noTrafo && (kva > post.maxKva || kva < post.minKva)) issues.push('UYUMSUZ: ' + kva + ' kVA, ' + post.label + ' için ' + post.minKva + '–' + post.maxKva + ' kVA');
  const comp = f.post === 'direk' ? (cat.table('trafoPoleCompat') || []).find((c) => c.pole === f.poleName) : null;
  if (comp && kva > comp.maxKva) issues.push('UYUMSUZ: ' + f.poleName + ' en fazla ' + comp.maxKva + ' kVA');
  const job = ts.job;
  const take = async (line) => {
    if (issues.length && !(await app.confirm('Uyumsuzluk', issues.join(' · ') + ' — yine de kaydedilsin mi? (Kontrol listesinde hata olarak kalır)', { ok: 'Kaydet', danger: true }))) return null;
    const obs = await measure({ critical: true, label: 'Trafo' });
    if (!obs) return null;
    const e = await ps.addEquipment('transformer', Object.assign({}, e0), { obs });
    if (line) await ps.appendNode(line.id, e.pointId);
    await recent('form:trafo', f);
    return { msg: e.no + ' kaydedildi' + (line ? ' → ' + line.lineNo : '') + ' · ' + (ps.result.matsByEq.get(e.id) || { items: [] }).items.length + ' malzeme', undo: { no: e.no, pointId: e.pointId, eqId: e.id, lineId: line ? line.id : null } };
  };
  const code = !job ? (f.state === 'mevcut' ? 'Mevcut · hakedişe girmez' : 'İleride · malzeme gelmez') : 'Reçete otomatik · ' + (kRow ? kRow.servis : kva + ' kVA');
  return { f, set, post, binaLike, sizes, fams, kList, kioskServis, kRow, ts, issues, code, ok: true, label: 'TRAFO AL', title: 'TRAFO', sub: (post.label || 'Trafo') + (post.noTrafo ? '' : ' · ' + kva + ' kVA') + ' · ' + (ts.label || f.state), color: issues.length ? '#f59e0b' : '#6b82ff', take };
}
function TrafoFields({ m }) {
  const cat = app.ps.cat, f = m.f, set = m.set, post = m.post;
  return html`
    <div class="grid2"><${Fld} l="Posta tipi"><${Sel} value=${f.post} options=${cat.postTypes().map((p) => [p.id, p.label])} onChange=${(v) => set({ post: v })} /></${Fld}>
    <${Fld} l="Durum"><${Sel} value=${f.state} options=${Object.entries(TRAFO_STATUSES).map(([k, v]) => [k, v.label])} onChange=${(v) => set({ state: v })} /></${Fld}></div>
    ${!post.noTrafo && !(f.post === 'mbk' && m.kRow && m.kRow.kva) ? html`<div class="grid2"><${Fld} l="Güç (kVA)"><${Sel} mono value=${f.kva} options=${m.sizes.map((k) => [k, k + ' kVA'])} onChange=${(v) => set({ kva: +v })} /></${Fld}>
      ${m.binaLike ? html`<${Fld} l="Cins"><${Sel} value=${f.cins} options=${[['herm', 'Hermetik yağlı'], ['kuru', 'Kuru tip']]} onChange=${(v) => set({ cins: v })} /></${Fld}>` : f.post === 'direk' ? html`<${Fld} l="Trafo direği"><${Sel} mono value=${f.poleName} options=${cat.poleTypes('trafo').map((t) => [t.name, t.name + ' · ' + t.kg + ' kg'])} onChange=${(v) => set({ poleName: v })} /></${Fld}>` : html`<div></div>`}</div>` : null}
    ${m.ts.removeOld ? html`<${Fld} l="Eski güç (kVA) · demontaj kalemi için"><${Sel} mono value=${f.oldKva || ''} options=${[['', 'seçin'], ...m.sizes.map((k) => [k, k + ' kVA'])]} onChange=${(v) => set({ oldKva: v ? +v : null })} /></${Fld}>` : null}
    ${f.post === 'mbk' ? html`<div class="grid2"><${Fld} l="Köşk ailesi"><${Sel} value=${f.kFam} options=${m.fams} onChange=${(v) => set({ kFam: v, kiosk: null })} /></${Fld}><${Fld} l="Köşk tipi"><${Sel} mono value=${m.kioskServis} options=${m.kList.map((k) => [k.servis, k.label])} onChange=${(v) => set({ kiosk: v })} /></${Fld}></div>` : null}
    ${m.issues.map((i) => html`<div class="alert err" style="padding:6px 10px">${i}</div>`)}`;
}
function Fld({ l, children }) { return html`<div class="fld"><label>${l}</label>${children}</div>`; }

const OTHER_KINDS = [['sdk', 'SDK / Box', 'SDK AL'], ['subscriber', 'Abone', 'ABONE AL'], ['manhole', 'Menhol', 'MENHOL AL'], ['linept', 'Hat köşe noktası', 'KÖŞE AL'], ['detail', 'Detay noktası', 'DETAY AL'], ['crossing', 'Geçiş', 'GEÇİŞ AL']];
function useOther() {
  const ps = app.ps, cat = ps.cat;
  const [f, set] = useForm('other', { kind: 'sdk', sdkTypeId: null, outputs: 4, state: 'YENI', phase: 'uc', aboneNo: '', crossKind: 'karayolu', objH: 0, label: '' });
  const K = OTHER_KINDS.find((k) => k[0] === f.kind) || OTHER_KINDS[0];
  const sdkT = cat.sdkType(f.sdkTypeId) || cat.sdkTypes()[0] || {};
  const crossT = (cat.table('crossingTypes') || []).find((c) => c.id === f.crossKind) || {};
  const take = async (line, activeLine) => {
    if (f.kind === 'linept' && !activeLine) { app.toast('Köşe noktası için önce hat başlatın (+ HAT)', 'warn', 4000); return null; }
    const critical = f.kind === 'sdk' || f.kind === 'manhole' || (f.kind === 'linept' && activeLine.install === 'havai');
    const obs = await measure({ critical, label: K[1] });
    if (!obs) return null;
    if (f.kind === 'linept') { const p = await ps.createPoint({ pointNo: ps.nextPointNo('P'), cls: 'HAT', critical, obs }); await ps.appendNode(activeLine.id, p.id); return { msg: p.pointNo + ' → ' + activeLine.lineNo + ' köşe noktası', undo: { no: p.pointNo, pointId: p.id, eqId: null, lineId: activeLine.id } }; }
    if (f.kind === 'detail') { const p = await ps.createPoint({ pointNo: ps.nextPointNo('P'), cls: 'DETAY', critical: false, obs }); await ps.recompute('Detay noktası'); return { msg: p.pointNo + ' kaydedildi', undo: { no: p.pointNo, pointId: p.id, eqId: null, lineId: null } }; }
    if (f.kind === 'crossing') {
      let best = null;
      for (const s of ps.result.spans) { const a = ps.pointById(s.fromId), b = ps.pointById(s.toId); const r = segProject(obs, a, b); if (!best || r.dist < best.r.dist) best = { s, r }; }
      if (!best || best.r.dist > 60) { app.toast('Yakında (60 m) açıklık yok · geçiş bir açıklığa bağlanmalı', 'err'); return null; }
      await ps.addCrossing({ crossKind: f.crossKind, label: f.label || crossT.label, spanId: best.s.id, distance: best.r.tc * best.s.length2D, lateral: best.r.signed, E: obs.E, N: obs.N, lat: obs.lat, lon: obs.lon, groundH: obs.H, objectHeight: f.objH || 0, source: 'GNSS' });
      return { msg: 'Geçiş ' + best.s.fromNo + '→' + best.s.toNo + ' açıklığına bağlandı' };
    }
    const data = f.kind === 'sdk' ? { state: f.state, attrs: { sdkTypeId: f.sdkTypeId || sdkT.id, outputs: f.outputs, fuses: [] } } : f.kind === 'subscriber' ? { state: 'YENI', attrs: { phase: f.phase, aboneNo: f.aboneNo } } : { state: f.state, attrs: {} };
    const e = await ps.addEquipment(f.kind, data, { obs });
    const ln = line && f.kind !== 'subscriber' ? line : null;
    if (ln) await ps.appendNode(ln.id, e.pointId);
    return { msg: e.no + ' kaydedildi' + (ln ? ' → ' + ln.lineNo : ''), undo: { no: e.no, pointId: e.pointId, eqId: e.id, lineId: ln ? ln.id : null } };
  };
  const sub = f.kind === 'sdk' ? (sdkT.name || 'SDK') + ' · ' + f.outputs + ' çıkış · ' + (ST_LBL[f.state] || f.state) : f.kind === 'subscriber' ? (f.phase === 'tek' ? 'Tek faz' : 'Üç faz') + (f.aboneNo ? ' · ' + f.aboneNo : '') : f.kind === 'crossing' ? (crossT.label || 'Geçiş') + (f.objH ? ' · ' + f.objH + ' m' : '') : f.kind === 'linept' ? 'aktif hatta güzergah noktası' : f.kind === 'detail' ? 'kritik olmayan nokta' : (ST_LBL[f.state] || f.state);
  const code = f.kind === 'sdk' ? sdkT.servis : f.kind === 'crossing' ? 'Açıklık kontrolü (ENH)' : f.kind === 'subscriber' ? 'Abone noktası' : '—';
  return { f, set, code, ok: true, label: K[2], title: K[1].toLocaleUpperCase('tr-TR'), sub, color: f.kind === 'subscriber' ? '#fbbf24' : f.kind === 'crossing' ? '#f59e0b' : f.kind === 'sdk' || f.kind === 'manhole' ? '#6b82ff' : '#e2e8f0', take };
}
function OtherFields({ m, active }) {
  const cat = app.ps.cat, f = m.f, set = m.set;
  return html`
    <div class="grid2">${OTHER_KINDS.map(([k, l]) => html`<${Chip} on=${f.kind === k} onClick=${() => set({ kind: k })}>${l}</${Chip}>`)}</div>
    ${f.kind === 'sdk' ? html`<div class="grid2"><${Fld} l="SDK tipi"><${Sel} value=${f.sdkTypeId || (cat.sdkTypes()[0] || {}).id} options=${cat.sdkTypes().map((s) => [s.id, s.name])} onChange=${(v) => set({ sdkTypeId: v })} /></${Fld}><${Fld} l="Çıkış"><${Sel} mono value=${f.outputs} options=${[2, 3, 4, 6, 8].map((n) => [n, n + ' çıkış'])} onChange=${(v) => set({ outputs: +v })} /></${Fld}></div>` : null}
    ${f.kind === 'sdk' || f.kind === 'manhole' ? html`<div class="chips">${['YENI', 'MEVCUT', 'DEMONTAJ', 'DMM'].map((k) => html`<${Chip} c=${ST_COL[k]} on=${f.state === k} onClick=${() => set({ state: k })}>${ST_LBL[k]}</${Chip}>`)}</div>` : null}
    ${f.kind === 'subscriber' ? html`<div class="grid2"><${Fld} l="Faz"><${Seg} c="#fbbf24" value=${f.phase} options=${[['tek', 'Tek'], ['uc', 'Üç']]} onChange=${(v) => set({ phase: v })} /></${Fld}><${Fld} l="Abone / tesisat no"><input class="inp mono" value=${f.aboneNo} onChange=${(e) => set({ aboneNo: e.target.value })} /></${Fld}></div>` : null}
    ${f.kind === 'linept' ? html`<div class=${'alert ' + (active ? 'info' : 'warn')}>${active ? 'Direk olmayan güzergah/köşe noktası ' + active.lineNo + ' hattına eklenir (ör. yeraltı kablo dönüşü).' : 'Önce bir hat başlatın: alttaki "+ HAT" düğmesi.'}</div>` : null}
    ${f.kind === 'crossing' ? html`<div class="chips">${(cat.table('crossingTypes') || []).map((c) => html`<${Chip} on=${f.crossKind === c.id} onClick=${() => set({ crossKind: c.id })}>${c.label}</${Chip}>`)}</div>
      <div class="grid2"><${Fld} l="Nesne yüksekliği (m)"><input class="inp mono" type="number" step="0.1" value=${f.objH} onChange=${(e) => set({ objH: +e.target.value })} /></${Fld}><${Fld} l="Açıklama"><input class="inp" value=${f.label} placeholder="ör. D300 karayolu" onChange=${(e) => set({ label: e.target.value })} /></${Fld}></div>
      <div class="note">Nesnenin zemininde/tepesinde ölçün; en yakın açıklığa otomatik bağlanır, yaklaşım kontrolü ENH ekranında yapılır.</div>` : null}`;
}
