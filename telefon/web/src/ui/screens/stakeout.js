// 02 · Aplikasyon — gerçek hedef noktadan canlı yönlendirme (ileri/sağ-sol, kot, semt, eksen ofseti, tolerans).
// İki görünüm, aynı hesap (useAplikasyon: gnss-service.stakeout, ps.recordStakeout):
//  · Harita (13.11.2026, Basit modun varsayılanı; kullanıcı: "harita üzerinde ilerlediğim yönü anlık olarak görebilmeliyim
//    ve harita üzerinden doğrudan nokta seçip hızlıca aplikasyon başlatabilmeliyim"): tam ekran harita, konum oku + yön
//    konisi + geçilen yol, hedefe kesik çizgi; haritada noktaya dokununca "Aplikasyonu başlat" kartı; altta en yakın
//    noktalar; 1 m altında büyük hedef halkaları (10 / 5 / 2 cm); küçük alt panelde kalan mesafe, ileri / sağa, İŞARETLE.
//  · Radar (1.11.2026 tasarımı, Ayrıntılı modun varsayılanı): büyük kalan mesafe ve yön, katlanır ayrıntılar.
import { html, useState, useEffect, useRef, useBus, Icon, Chip, Badge, fmt, trn } from '../kit.js';
import { app } from '../ctx.js';
import { dist2, bearing, dms } from '../../geo/geom.js';
import { eqSummary, openCadFile, mapData } from './map.js';
import { cadDocs } from '../../services/cad-service.js';
import { MapEngine } from '../map-engine.js';
import { loadTile } from '../services.js';
import { basitMi } from '../arayuz-modu.js';

const MARKS = [['kazik', 'Kazık'], ['civi', 'Çelik çivi'], ['boya', 'Röper boya'], ['poligon', 'Poligon kazığı']];
const YAKIN = 1;   // m: bu mesafenin altında harita görünümünde büyük hedef halkaları

function resolveTarget() {
  const t = app.state.target; if (!t) return null;
  if (t.id) { const p = app.ps.pointById(t.id); if (!p) return null; const e = app.ps.eqAt(p.id)[0]; return { id: p.id, E: p.E, N: p.N, H: p.H, no: e ? e.no : p.pointNo, label: e ? eqSummary(e) : p.cls, point: p, eq: e }; }
  return t;
}
function axisOf(tp) {
  if (!tp || !tp.id) return null;
  const l = app.ps.data.lines.find((x) => x.nodes.includes(tp.id));
  if (!l) return null;
  const i = l.nodes.indexOf(tp.id);
  const a = app.ps.pointById(l.nodes[Math.max(0, i - 1)]), b = app.ps.pointById(l.nodes[Math.min(l.nodes.length - 1, i + 1)]);
  if (!a || !b || a === b) return null;
  return { az: bearing(a, b), line: l };
}
const dirWord = (az) => ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'][Math.round(az / 45) % 8];
/** Mesafe yazısı (virgüllü): 1 km üstü 1 ondalık, 10 m üstü 2, altı 3 ondalık (mm). */
const mesafe = (d) => trn(d, d >= 1000 ? 1 : d >= 10 ? 2 : 3);
/** Küçük mesafe yazısı: 1 m altı cm (1 ondalık), üstü m (2 ondalık). */
const kisaMesafe = (v) => (v < 1 ? trn(v * 100, 1) + ' cm' : trn(v, 2) + ' m');

/** Hedef seçme / sonraki / işaretleme ve canlı hesap: iki görünümün ortak mantığı. */
function useAplikasyon() {
  const ps = app.ps, g = app.gnss.state;
  const [mark, setMarkS] = useState(app.state.mark || 'kazik');
  const setMark = (k) => { setMarkS(k); app.state.mark = k; };
  const tol = app.gnss.thresholds.stakeTolerance || 0.02;
  const T = resolveTarget();
  const r = T ? app.gnss.stakeout(T) : null;
  const inTol = !!(r && r.dist <= tol);
  const fixOk = g.fix === 'FIX';
  useEffect(() => { if (inTol && fixOk) app.bridge.vibrate(80); }, [inTol && fixOk]);
  const ax = axisOf(T);
  let axisOff = null;
  if (r && ax) { const rel = (bearing(T, r.cur) - ax.az) * Math.PI / 180; axisOff = dist2(T, r.cur) * Math.sin(rel); }
  const hedefYap = (id) => { app.state.target = id ? { id } : null; app.bus.emit('ui:target'); };
  const pick = async () => {
    const cur = g.E != null ? g : null;
    const list = ps.data.points.filter((p) => p.E != null).map((p) => ({ p, e: ps.eqAt(p.id)[0], d: cur ? dist2(cur, p) : null })).sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12) || String(a.p.pointNo).localeCompare(b.p.pointNo));
    const id = await app.modal((close) => html`<div class="mh"><h3>Hedef nokta</h3><button class="btn xs" onClick=${() => close('map')}>Haritadan seç</button></div><div class="mb" style="padding:0"><div class="list">${list.slice(0, 200).map(({ p, e, d }) => html`<button class="li" onClick=${() => close(p.id)}><div class="grow"><div class="t">${e ? e.no : p.pointNo} ${p.source === 'DESIGN' ? html`<${Badge} k="m">TASARIM</${Badge}>` : null}</div><div class="s">${e ? eqSummary(e) : p.cls}</div></div><span class="m">${d != null ? trn(d, 1) + ' m' : ''}</span></button>`)}</div></div>`);
    if (id === 'map') { if (aplGorunum() === 'harita') { hedefYap(null); return; } app.nav.tab('map'); return; }
    if (id) hedefYap(id);
  };
  const next = () => {
    if (!T || !T.id) return pick();
    const l = ax ? ax.line : null;
    let nid = null;
    if (l) { const i = l.nodes.indexOf(T.id); nid = l.nodes[i + 1] || null; }
    if (!nid) { const sorted = ps.data.points.slice().sort((a, b) => String(a.pointNo).localeCompare(String(b.pointNo), 'tr', { numeric: true })); const i = sorted.findIndex((p) => p.id === T.id); nid = (sorted[i + 1] || {}).id; }
    if (nid) hedefYap(nid);
  };
  const doMark = async () => {
    await ps.recordStakeout({ targetId: T.id || null, targetNo: T.no, designE: T.E, designN: T.N, designH: T.H ?? null, measuredE: g.E, measuredN: g.N, measuredH: g.H, dE: r.dE, dN: r.dN, dH: r.dH, dist: r.dist, axisOffset: axisOff, mark, fix: g.fix, sigmaH: g.sigmaH, accepted: inTol && fixOk, tolerance: tol });
    app.toast(T.no + ' işaretlendi (' + MARKS.find((m) => m[0] === mark)[1] + ') · Δ ' + fmt(r.dist) + ' m');
    app.bridge.vibrate(150);
    next();
  };
  // Yön sözü: yürüyüş yönüne göre hedef nerede (önünüzde / sağınızda / solunuzda / arkanızda); yön bilinmiyorsa pusula yönü
  const rel = r && r.relBearing != null ? ((r.relBearing % 360) + 540) % 360 - 180 : null;
  const yonSozu = rel == null ? null : Math.abs(rel) < 30 ? 'Hedef önünüzde · ileri yürüyün' : Math.abs(rel) > 150 ? 'Hedef arkanızda · geri dönün' : rel > 0 ? 'Hedef sağınızda · sağa dönün' : 'Hedef solunuzda · sola dönün';
  const say = !T ? 'Hedef nokta seçin' : !r ? (g.E == null ? 'Konum bekleniyor…' : 'Hedef seçin') : inTol ? (fixOk ? 'Tolerans içinde — işareti çakın' : 'Tolerans içinde, RTK FIX bekleyin') : r.dist <= 0.2 ? 'Çok yakın · küçük adımlarla ' + (rel == null ? dirWord(r.azimuth) + ' yönüne' : 'yaklaşın') : yonSozu || 'Yürüyüş yönü yok · ' + dirWord(r.azimuth) + ' yönüne yürüyün';
  return { ps, g, T, r, tol, inTol, fixOk, ax, axisOff, mark, setMark, pick, next, doMark, hedefYap, rel, say };
}

/** Görünüm: 'harita' | 'radar' (bu oturumda hatırlanır; ilk açılışta Basit → harita, Ayrıntılı → radar). */
function aplGorunum() { return app.state.aplGorunum || (basitMi() ? 'harita' : 'radar'); }
function gorunumSec(v) { app.state.aplGorunum = v; app.nav.replace('stake'); }

export function StakeoutScreen() {
  useBus('settings:change');
  return aplGorunum() === 'harita' ? html`<${AplikasyonHaritasi} />` : html`<${RadarGorunumu} />`;
}
// Harita görünümü tam ekran (kaydırmasız) ve küçük üst bilgiyle; radar görünümü kaydırılan sayfa
Object.defineProperty(StakeoutScreen, 'flush', { get: () => aplGorunum() === 'harita' });
Object.defineProperty(StakeoutScreen, 'compactHud', { get: () => aplGorunum() === 'harita' });

// ---------------- Harita görünümü ----------------

/** Geçilen yol: son konumlar (0,3 m'den fazla ilerleyince eklenir, en çok 40). */
const iz = [];
function izEkle(g) {
  if (g.E == null) return;
  const s = iz[iz.length - 1];
  if (s && Math.hypot(g.E - s.E, g.N - s.N) < 0.3) return;
  iz.push({ E: g.E, N: g.N });
  if (iz.length > 40) iz.shift();
}

function AplikasyonHaritasi() {
  useBus('gnss:state', 200);
  useBus(['ui:target', 'project:computed']);
  const A = useAplikasyon();
  const { ps, g, T, r, inTol, fixOk } = A;
  const cv = useRef(null), eng = useRef(null), alt = useRef(null);
  const [kart, setKart] = useState(null);           // haritada dokunulan nokta: { id }
  const [takip, setTakipS] = useState(true);        // görünüm konum + hedefe göre kendiliğinden ayarlanır
  const [, force] = useState(0);
  const [altH, setAltH] = useState(200);
  const takipR = useRef(true);
  const setTakip = (v) => { takipR.current = v; setTakipS(v); };
  // Haritanın göreceği veri: genel harita verisi + çözülmüş hedef + geçilen yol + yön konisi
  const veri = () => Object.assign(mapData(), { target: resolveTarget(), trail: iz.slice(), yonKonisi: true, sel: kartR.current ? { type: 'point', id: kartR.current.id } : null });
  const kartR = useRef(null);
  kartR.current = kart;
  // Görünümü konum ve hedefe göre ayarla: ikisi birden görünsün (hedef yoksa konum ortada)
  const ayarla = () => {
    const e = eng.current; if (!e || !takipR.current) return;
    const G = app.gnss.state, H = resolveTarget();
    if (G.E == null) { if (H) e.center(H.E, H.N, Math.min(e.view.res, 0.5)); return; }
    if (!H) { e.center(G.E, G.N); return; }
    const d = Math.hypot(H.E - G.E, H.N - G.N);
    const kenar = Math.max(120, Math.min(e.w, e.visH()) - 120);
    const res = Math.max(0.01, Math.min(5, (d * 1.25) / kenar));
    e.center((G.E + H.E) / 2, (G.N + H.N) / 2, res);
  };
  useEffect(() => {
    izEkle(app.gnss.state);
    const e = new MapEngine(cv.current, {
      getData: veri,
      loadTile,
      onTap: (w, hit) => {
        if (hit && hit.kind === 'point' && hit.ref && hit.ref.E != null) { setKart({ id: hit.ref.id }); e.invalidate(); return; }
        if (kartR.current) { setKart(null); e.invalidate(); }
      },
      onFollow: (f) => { if (!f) setTakip(false); },
      onView: () => force((x) => x + 1),
      editNodes: false,
    });
    eng.current = e; app.state.aplEngine = e;
    if (app.state.layers) Object.assign(e.layers, app.state.layers);
    e.setOlcek(app.state.haritaOlcek);
    const el = alt.current;
    const pad = () => { if (!el) return; const h = el.getBoundingClientRect().height; e.setPad({ bottom: h }); setAltH(Math.round(h)); };
    pad();
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(() => { pad(); ayarla(); }) : null;
    if (ro) ro.observe(el);
    const H0 = resolveTarget(), G0 = app.gnss.state;
    if (G0.E != null || H0) ayarla();
    else if (app.state.view) e.center(app.state.view.cE, app.state.view.cN, app.state.view.res);
    else if (!e.fit(ps.data.points)) e.center(500000, 4280000, 50);
    const k1 = app.bus.on('gnss:state', () => { izEkle(app.gnss.state); ayarla(); e.invalidate(); });
    const k2 = app.bus.on('ui:target', () => { setTakip(true); ayarla(); e.invalidate(); });
    const k3 = app.bus.on('project:computed', () => e.invalidate());
    return () => { k1(); k2(); k3(); if (ro) ro.disconnect(); if (app.state.aplEngine === e) app.state.aplEngine = null; e.destroy(); };
  }, []);
  const baslat = (id) => { setKart(null); setTakip(true); A.hedefYap(id); };
  // Dokunulan noktanın kartı (haritadaki yerinin altında)
  let kartHtml = null;
  if (kart && eng.current) {
    const p = ps.pointById(kart.id);
    if (p) {
      const e0 = ps.eqAt(p.id)[0], s = eng.current.toScreen(p.E, p.N);
      const w = eng.current.w || 360, ust = Math.max(8, Math.min(s.y + 30, eng.current.h - eng.current.pad.bottom - 170));
      const sol = Math.max(8, Math.min(s.x - 30, w - 8 - Math.min(320, w - 16)));
      const d = g.E != null ? dist2(g, p) : null;
      kartHtml = html`<div class="aplh-kart" style=${'left:' + sol + 'px;top:' + ust + 'px'}>
        <div class="row" style="align-items:baseline;gap:8px"><b style="font-size:20px">${e0 ? e0.no : p.pointNo}</b><span class="note grow" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e0 ? eqSummary(e0) : p.cls}</span>${d != null ? html`<b class="mono" style="color:var(--cy)">${trn(d, d >= 10 ? 0 : 1)} m</b>` : null}</div>
        <button class="btn pri blk" style="height:54px;font-size:16px;margin-top:8px" onClick=${() => baslat(p.id)}><${Icon} n="target" s=${20} c="#0b1326" />APLİKASYONU BAŞLAT</button>
        <button class="btn blk sm" style="margin-top:6px" onClick=${() => { setKart(null); eng.current.invalidate(); }}>Vazgeç</button>
      </div>`;
    }
  }
  // Yakında: büyük hedef halkaları (10 / 5 / 2 cm), kuzey yukarı; konum hedefe göre
  let yakin = null;
  if (T && r && r.dist < YAKIN) {
    const k = 1500, cx = 150, cy = 150;   // 1 m = 1500 px → 10 cm = 150 px
    // konum hedefe göre; halkaların dışındaysa (10 cm üstü) en dış halkanın üstünde, hedefin yönünde durur
    let ox = -r.dE * k, oy = r.dN * k;
    const ol = Math.hypot(ox, oy);
    if (ol > 140) { ox *= 140 / ol; oy *= 140 / ol; }
    const x = cx + ox, y = cy + oy;
    const dis = r.dist > 0.1;
    yakin = html`<svg class="aplh-hedef" viewBox="0 0 300 300" aria-label="Hedef halkaları">
      <circle cx=${cx} cy=${cy} r="148" fill="var(--glass)" stroke="var(--line3)" stroke-width="1.5" />
      <circle cx=${cx} cy=${cy} r="150" fill="none" stroke="#f59e0b" stroke-width="2.5" />
      <circle cx=${cx} cy=${cy} r="75" fill="none" stroke="#f59e0b" stroke-width="2.5" />
      <circle cx=${cx} cy=${cy} r="30" fill=${inTol ? 'rgba(16,185,129,.28)' : 'none'} stroke="#10b981" stroke-width="3.5" />
      <line x1="0" y1=${cy} x2="300" y2=${cy} stroke="var(--line)" /><line x1=${cx} y1="0" x2=${cx} y2="300" stroke="var(--line)" />
      <text x=${cx + 4} y="16" font-size="12" font-weight="800" fill="var(--mut)">K</text>
      <text x="${cx + 152}" y=${cy - 6} text-anchor="end" font-size="13" font-weight="800" fill="#f59e0b" font-family="JetBrains Mono">10 cm</text>
      <text x=${cx + 73} y=${cy - 6} text-anchor="end" font-size="13" font-weight="800" fill="#f59e0b" font-family="JetBrains Mono">5 cm</text>
      <text x=${cx + 28} y=${cy - 6} text-anchor="end" font-size="13" font-weight="800" fill="#10b981" font-family="JetBrains Mono">2</text>
      <circle cx=${cx} cy=${cy} r="5" fill="#eab308" />
      ${dis ? html`<line x1=${x} y1=${y} x2=${cx} y2=${cy} stroke="#10b981" stroke-width="2.5" stroke-dasharray="6 5" />` : null}
      <circle cx=${x} cy=${y} r="13" fill="#38bdf8" stroke="#fff" stroke-width="3" />
    </svg>`;
  }
  // En yakın noktalar (hedef yokken)
  const yakinlar = !T && g.E != null ? ps.data.points.filter((p) => p.E != null).map((p) => ({ p, e: ps.eqAt(p.id)[0], d: dist2(g, p) })).sort((a, b) => a.d - b.d).slice(0, 3) : [];
  const yon = r && r.forward != null;
  return html`<div class="mapwrap"><canvas ref=${cv} aria-label="Aplikasyon haritası"></canvas></div>
    ${!T ? html`<div class="aplh-ipucu">Aplikasyon için haritada bir noktaya dokunun</div>` : null}
    <div class="fab" style="top:12px">
      <button aria-label="Radar görünümü" onClick=${() => gorunumSec('radar')}><b style="font:800 10px var(--mono)">RADAR</b></button>
    </div>
    <div class="fab" style=${'bottom:' + (altH + 10) + 'px'}>
      <button class=${'loc' + (takip ? ' on' : '')} aria-label="Konumuma ve hedefe göre ortala" onClick=${() => { setTakip(true); ayarla(); }}><${Icon} n="locate" s=${24} /></button>
    </div>
    ${yakin}
    ${kartHtml}
    <div class="base aplh-alt" ref=${alt}>
      ${!T ? html`<div class="dock">
        <div class="lbl">En yakın noktalar</div>
        <div class="row" style="gap:6px">${yakinlar.map(({ p, e, d }) => html`<button class="btn grow aplh-yakin" onClick=${() => baslat(p.id)}><b>${e ? e.no : p.pointNo}</b><small class="mono">${trn(d, d >= 10 ? 0 : 1)} m</small></button>`)}
          <button class="btn grow aplh-yakin" onClick=${A.pick}><b>Liste</b><small>hepsi</small></button></div>
        ${g.E == null ? html`<div class="note">Konum bekleniyor… En yakın noktalar konum gelince görünür; haritadan ya da listeden seçebilirsiniz.</div>` : null}
      </div>` : html`<div class="dock">
        <div class="row" style="gap:10px"><div class="grow" style="min-width:0"><div class="lbl">Hedef</div><div class="aplh-ad">${T.no} <span>${T.label ? '· ' + T.label : ''}</span></div></div><button class="btn sm" onClick=${A.pick}>Değiştir</button></div>
        <div class="row" style="gap:12px;align-items:center">
          <div class="aplh-mesafe" style=${'color:' + (inTol ? 'var(--ok2)' : 'var(--tx)')}>${r ? mesafe(r.dist) : '—'}<small> m</small></div>
          <div class="grow aplh-yon">${yon ? html`<div><b class="hl">${r.forward >= 0 ? '↑' : '↓'}</b> <span class="mono">${kisaMesafe(Math.abs(r.forward))}</span> ${r.forward >= 0 ? 'ileri' : 'geri'}</div><div><b class="hl">${r.right >= 0 ? '→' : '←'}</b> <span class="mono">${kisaMesafe(Math.abs(r.right))}</span> ${r.right >= 0 ? 'sağa' : 'sola'}</div>`
            : r ? html`<div class="mono">${dms(r.azimuth)}</div><div class="note">${dirWord(r.azimuth)} yönünde</div>` : html`<div class="note">${A.say}</div>`}</div>
        </div>
        ${r && (inTol || r.dist < YAKIN) ? html`<div class="row" style="gap:6px">${MARKS.slice(0, 3).map(([k, l]) => html`<${Chip} on=${A.mark === k} onClick=${() => A.setMark(k)}>${l}</${Chip}>`)}</div>` : r && !yon ? null : r ? html`<div class="note" style="font-weight:600">${A.say}</div>` : null}
        <div class="row" style="gap:8px">
          <button class="btn huge grow" disabled=${!(r && inTol && fixOk)} style=${r && inTol && fixOk ? 'background:var(--ok);border-color:var(--ok);color:#0b1326' : ''} onClick=${A.doMark}><${Icon} n="pin" s=${22} />${r && inTol ? (fixOk ? 'İŞARETLE · ' + T.no : 'FIX BEKLE') : 'TOLERANS DIŞI'}</button>
          <button class="btn apl-sonraki" onClick=${A.next}><${Icon} n="skip" s=${20} />SONRAKİ</button>
        </div>
      </div>`}
    </div>`;
}

// ---------------- Radar görünümü ----------------

/** Yön satırı: büyük sayı + yön sözcüğü ("1,25 m ileri"); 1 cm altındaki bileşen yazılmaz. */
function Yon({ deger, arti, eksi, renk }) {
  if (deger == null) return null;
  const v = Math.abs(deger);
  return html`<div class="apl-yon-satir"><span class="apl-yon-sayi" style=${renk ? 'color:' + renk : ''}>${v < 0.01 ? '0' : trn(v, 2)}</span><span class="apl-yon-ad">m ${deger >= 0 ? arti : eksi}</span></div>`;
}

function RadarGorunumu() {
  useBus('gnss:state', 200);
  useBus(['ui:target', 'project:computed']);
  const A = useAplikasyon();
  const { ps, g, T, r, tol, inTol, fixOk, ax, axisOff, mark, setMark, pick, next, doMark, say } = A;
  const [ayrinti, setAyrinti] = useState(!!app.state.aplAyrinti);
  // Radar: hedef, yürüyüş yönüne (yoksa kuzeye) göre; ölçek kalan mesafeye göre değişir
  const scale = r ? (r.dist > 2.5 ? [1, 2.5, 5] : r.dist > 0.2 ? [0.1, 0.5, 1] : [0.02, 0.05, 0.1]) : [1, 2.5, 5];
  const R = 100, rmax = scale[2];
  let tx = 105, ty = 105;
  if (r) {
    const ang = ((r.heading != null ? r.relBearing : r.azimuth) || 0) * Math.PI / 180;
    const rr = Math.min(1, r.dist / rmax) * (R - 26);
    tx = 105 + rr * Math.sin(ang); ty = 105 - rr * Math.cos(ang);
  }
  const olcek = (v) => (v < 1 ? v * 100 + ' cm' : v + ' m');
  const bands = [[0, tol, '#10b981'], [tol, 0.2, '#f59e0b'], [0.2, 1, '#ef4444'], [1, 5, '#b91c1c']];
  const marker = r ? Math.min(0.97, r.dist <= tol ? (r.dist / tol) * 0.25 : r.dist <= 0.2 ? 0.25 + ((r.dist - tol) / (0.2 - tol)) * 0.25 : r.dist <= 1 ? 0.5 + ((r.dist - 0.2) / 0.8) * 0.25 : 0.75 + Math.min(1, (r.dist - 1) / 4) * 0.22) : 0;
  const cadN = cadDocs(ps).length;
  const openCad = async (f) => { if (!f) return; try { const rr = await openCadFile(f); const b = rr.doc.bbox; if (b) app.state.view = { cE: (b.minE + b.maxE) / 2, cN: (b.minN + b.maxN) / 2, res: Math.max((b.maxE - b.minE) / 320, (b.maxN - b.minN) / 420, 0.05) }; app.state.follow = false; app.nav.tab('map'); app.toast('Çizimde bir uca ya da köşeye dokunun, sonra "Aplikasyon yap" deyin', 'ok', 6000); } catch (e) { app.toast(e.message || String(e), 'err', 7000); } };
  const son = ps.data.stakeouts.slice(-3).reverse();
  const durumRenk = inTol ? '#10b981' : r ? '#f59e0b' : 'var(--mut2)';
  return html`<div class="apl">
    <div class="row" style="gap:8px"><button class="apl-hedef grow" onClick=${pick}><${Icon} n="target" s=${22} c="#eab308" />
      <span class="grow" style="min-width:0"><span class="lbl">Hedef nokta</span><span class="apl-hedef-ad">${T ? T.no : 'Seçilmedi — dokunun'}</span>${T && T.label ? html`<span class="apl-hedef-alt">${T.label}</span>` : null}</span><${Icon} n="down" c="var(--mut)" /></button>
      <button class="btn" style="height:58px;flex:0 0 74px;flex-direction:column;gap:2px" aria-label="Harita görünümü" onClick=${() => gorunumSec('harita')}><${Icon} n="map" s=${20} /><small style="font-size:11px">Harita</small></button></div>

    <div class="apl-yon card">
      <svg class="apl-radar" viewBox="0 0 210 210" role="img" aria-label="Yönlendirme radarı">
        <circle cx="105" cy="105" r="100" fill="var(--bg2)" stroke="var(--line)" stroke-width="1.5" />
        <circle cx="105" cy="105" r="50" fill="none" stroke="var(--line2)" stroke-dasharray="3 4" />
        <circle cx="105" cy="105" r="20" fill=${inTol ? 'rgba(16,185,129,.18)' : 'none'} stroke=${inTol ? '#10b981' : 'var(--line2)'} stroke-width=${inTol ? 2.5 : 1} />
        <line x1="105" y1="8" x2="105" y2="202" stroke="var(--panel2)" /><line x1="8" y1="105" x2="202" y2="105" stroke="var(--panel2)" />
        <text x="105" y="17" text-anchor="middle" font-size="9" font-weight="700" fill="var(--mut)">${r && r.heading != null ? 'İLERİ' : 'KUZEY'}</text>
        <text x="120" y="126" font-family="JetBrains Mono" font-size="9" fill="var(--mut)">${olcek(scale[0])}</text>
        <text x="141" y="146" font-family="JetBrains Mono" font-size="9" fill="var(--mut)">${olcek(scale[1])}</text>
        <text x="160" y="176" font-family="JetBrains Mono" font-size="9" fill="var(--mut)">${olcek(scale[2])}</text>
        ${r ? html`<line x1="105" y1="105" x2=${tx} y2=${ty} stroke="#10b981" stroke-width="2" stroke-dasharray="5 4" /><circle cx=${tx} cy=${ty} r="10" fill="var(--bg2)" stroke="var(--tx)" stroke-width="2.5" /><circle cx=${tx} cy=${ty} r="3.5" fill="var(--tx)" />` : null}
        <path d="M105 88 L115 118 L105 111 L95 118 Z" fill="#10b981" stroke="var(--bg)" stroke-width="1.5" />
      </svg>
      <div class="apl-sag">
        <div class="lbl">Kalan mesafe</div>
        <div class="apl-mesafe" style=${'color:' + (inTol ? '#10b981' : 'var(--tx)')}>${r ? mesafe(r.dist) : '—'}<small>m</small></div>
        ${r && r.forward != null ? html`<${Yon} deger=${r.forward} arti="ileri" eksi="geri" /><${Yon} deger=${r.right} arti="sağa" eksi="sola" />`
          : r ? html`<div class="apl-yon-satir"><span class="apl-yon-sayi">${dms(r.azimuth)}</span><span class="apl-yon-ad">semt</span></div><div class="note">${dirWord(r.azimuth)} yönünde</div>` : null}
        <div class="row" style="gap:6px;margin-top:4px"><span class="badge" style=${'background:' + durumRenk + '22;color:' + durumRenk + ';border-color:' + durumRenk + '66'}>${inTol ? 'TOLERANS İÇİ' : r ? 'YAKLAŞIYOR' : 'BEKLİYOR'}</span><span class=${'badge ' + (fixOk ? 'b-ok' : g.fix && g.fix !== 'NONE' ? 'b-warn' : 'b-mut')}>${g.fix && g.fix !== 'NONE' ? g.fix : 'KONUM YOK'}</span></div>
      </div>
    </div>
    <div class=${'alert ' + (inTol && fixOk ? 'ok' : 'info')} style="font-size:15px;font-weight:600;padding:10px 12px" aria-live="polite">${say}</div>

    <div class="grid3">
      <div class="stat"><b>Kot farkı</b><span style=${'color:' + (r && r.dH != null ? '#4cd7f6' : 'inherit')}>${r && r.dH != null ? (r.dH >= 0 ? '+' : '') + r.dH.toFixed(3) : '—'}</span><small>m</small><div class="note">${r && r.dH != null ? (r.dH < 0 ? 'kazı' : 'dolgu') : ''}</div></div>
      <div class="stat"><b>Eksen</b><span>${axisOff != null ? Math.abs(axisOff).toFixed(3) : '—'}</span><small>m</small><div class="note">${axisOff != null ? (axisOff >= 0 ? 'sağ' : 'sol') + ' · izin ' + fmt(app.gnss.thresholds.maxAxisOffset || 0.2) : ax ? ax.line.lineNo + ' ekseni' : 'hat yok'}</div></div>
      <div class="stat"><b>Doğruluk</b><span style=${'color:' + (fixOk ? '#10b981' : '#f59e0b')}>${g.sigmaH != null ? fmt(g.sigmaH) : '—'}</span><small>m</small><div class="note">σH · tolerans ${tol.toFixed(3)}</div></div>
    </div>

    <div class="row" style="align-items:center"><span class="lbl grow">Zemin işareti</span></div>
    <div class="grid4">${MARKS.map(([k, l]) => html`<${Chip} on=${mark === k} onClick=${() => setMark(k)}>${l}</${Chip}>`)}</div>

    <button class="apl-ayrinti" onClick=${() => { setAyrinti(!ayrinti); app.state.aplAyrinti = !ayrinti; }}><${Icon} n=${ayrinti ? 'up' : 'down'} s=${16} />${ayrinti ? 'Ayrıntıları gizle' : 'Ayrıntılar: tolerans bandı, koordinatlar, CAD çizimi, son aplikasyonlar'}</button>
    ${ayrinti ? html`<div class="card stack">
      <div class="row"><span class="lbl grow">ΔD toleransı</span><span class="mono hl" style="font-size:12px;font-weight:700">YEŞİL ≤ ${tol.toFixed(3)} m</span></div>
      <div style="position:relative;height:10px;margin:6px 0 2px;display:flex;gap:3px">${bands.map((b) => html`<div style=${'flex:1;border-radius:3px;background:' + b[2]}></div>`)}<div style=${'position:absolute;top:-4px;left:' + marker * 100 + '%;width:4px;height:18px;background:#fff;border-radius:2px'}></div></div>
      <div class="row mono" style="font-size:10px;color:var(--mut);justify-content:space-between"><span>0</span><span>${tol}</span><span>0.20</span><span>1.00</span><span>5.00+</span></div>
      <div class="kv mono" style="font-size:11px"><b>Hedef</b><span>Y ${fmt(T && T.E)} · X ${fmt(T && T.N)} · Z ${fmt(T && T.H)}</span><b>Mevcut</b><span>Y ${fmt(g.E)} · X ${fmt(g.N)} · Z ${fmt(g.H)}</span><b>ΔY / ΔX</b><span>${r ? fmt(r.dE) + ' · ' + fmt(r.dN) : '—'}</span><b>Durum</b><span class=${fixOk ? 'hl' : 'hw'}>${g.fix || '—'} · σH ${fmt(g.sigmaH)}</span></div>
      <div class="grid2"><label class="btn sm"><${Icon} n="folder" s=${16} />CAD çizimi aç<input type="file" accept=".dxf,.ncz,.DXF,.NCZ,*/*" style="display:none" onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; openCad(f); }} /></label>
        <button class="btn sm" disabled=${!cadN} onClick=${() => { app.state.follow = false; app.nav.tab('map'); app.toast('Çizimde hedef noktaya dokunun, sonra "Aplikasyon yap" deyin', 'ok', 5000); }}><${Icon} n="map" s=${16} />Çizimden hedef seç${cadN ? ' (' + cadN + ')' : ''}</button></div>
      <div class="note">Son aplikasyonlar: ${son.map((s) => s.targetNo + ' (' + fmt(s.dist) + ' m)').join(' · ') || '—'}</div>
    </div>` : null}

    <div class="apl-alt">
      <button class="btn huge grow" disabled=${!(r && inTol && fixOk)} style=${r && inTol && fixOk ? 'background:#10b981;border-color:#10b981;color:#0b1326' : ''} onClick=${doMark}><${Icon} n="pin" s=${24} />${r && inTol ? (fixOk ? 'İŞARETLE · ' + T.no : 'FIX BEKLE') : T ? 'TOLERANS DIŞI' : 'HEDEF SEÇİN'}</button>
      <button class="btn apl-sonraki" onClick=${next}><${Icon} n="skip" s=${20} />SONRAKİ</button>
    </div>
  </div>`;
}
