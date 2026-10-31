// Canvas tabanlı GIS motoru: proje CRS (TM, metre) düzleminde çizim, XYZ altlık (TM'ye affine bükülerek),
// ızgara, katmanlar, yakalama, seçim, ölçüm, GNSS konumu, aplikasyon hedefi ve düğüm düzenleme.
import { tileX, tileY, tileLL } from '../geo/tiles.js';
import { aciCSS } from '../cad/aci.js';
import { project as projLL, unproject } from '../geo/crs.js';
import STIL from '../ortak/cizim-stili.js';
import { spanTexts, yaziKonumu } from '../export/dxf.js';
import { EKRAN, hatAnahtari, hatRengi, hatCizgisi, ekranDeseni, kanalGenisligi, kenarRengi, sondajli, esCizgi, dugumMu, YAZI, KAYDIRMA, yaziOlcusu } from './cizim-gorunumu.js';

// Hat kalınlığı (px) türüne göre; renk, çizgi deseni, metraj ve etiket ortak çizim stilinden (cizim-gorunumu.js)
const LW = { AG: 2.5, OG: 3.5, AYD: 2.5, ENH: 4, ABONE: 1.6 };
const hatKalinligi = (l, anahtar) => (anahtar === 'KANAL' ? 1.8 : anahtar === 'SONDAJ' ? 2.5 : anahtar === 'HAT_MUSTEREK' ? LW.OG : LW[l.lineType] || 2);
// Direk renkleri (ekran): yeni ve ileride ortak stilin "direk", mevcut ve demontaj "direkMevcut", sök-tak çizimdeki ACI'si
const PCOL = Object.fromEntries(['AG', 'OG', 'AYD'].map((v) => [v, { MEVCUT: EKRAN.direkMevcut[v], YENI: EKRAN.direk[v], DMM: aciCSS(STIL.direkRenkleri[v][2]), DEMONTAJ: EKRAN.direkMevcut[v], ILERIDE: EKRAN.direk[v] }]));

export class MapEngine {
  constructor(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.o = opts;
    this.view = { cE: 500000, cN: 4280000, res: 0.5 };
    this.dpr = Math.max(1, Math.min(3, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1)));
    this.dirty = true; this.pointers = new Map(); this.follow = false;
    // Görünür alan: üstte/altta panelin kapattığı pikseller. Görünüm merkezi (cE,cN) bu alanın ortasına düşer.
    this.pad = { top: 0, bottom: 0 };
    this.layers = { basemap: true, grid: true, labels: true, spanText: true, AG: true, OG: true, AYD: true, ENH: true, ABONE: true, yeralti: true, kanal: true, trafo: true, mevcut: true, demontaj: true, points: true, hak: true, srcTags: true };
    this.tiles = new Map(); this.tileQueue = new Set();
    this.measure = null; this.preview = null; this.dragNode = null; this.crosshair = false;
    this.bind(); this.resize(); this.loop();
  }
  destroy() { this.dead = true; this.ro && this.ro.disconnect(); }
  bind() {
    const c = this.c;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.up(e, true));
    c.addEventListener('wheel', (e) => { e.preventDefault(); const r = c.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY > 0 ? 1.25 : 0.8); }, { passive: false });
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(c.parentElement); }
  }
  resize() {
    const r = this.c.parentElement.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
    this.dirty = true;
  }
  loop() { if (this.dead) return; if (this.dirty) { this.dirty = false; try { this.draw(); } catch (e) { console.error('[map]', e); } } requestAnimationFrame(() => this.loop()); }
  invalidate() { this.dirty = true; }
  visH() { return Math.max(80, this.h - this.pad.top - this.pad.bottom); }
  cy() { return this.pad.top + this.visH() / 2; }
  setPad(p) { const b = Math.max(0, Math.min(this.h - 120, Math.round(p.bottom || 0))), t = Math.max(0, Math.round(p.top || 0)); if (b === this.pad.bottom && t === this.pad.top) return; this.pad = { top: t, bottom: b }; this.dirty = true; }
  // Nokta görünür alanın (panelin kapatmadığı kısım) içinde mi?
  inView(E, N, m = 24) { const s = this.toScreen(E, N); return s.x >= m && s.x <= this.w - m && s.y >= this.pad.top + m && s.y <= this.h - this.pad.bottom - m; }
  toScreen(E, N) { return { x: this.w / 2 + (E - this.view.cE) / this.view.res, y: this.cy() - (N - this.view.cN) / this.view.res }; }
  toWorld(x, y) { return { E: this.view.cE + (x - this.w / 2) * this.view.res, N: this.view.cN - (y - this.cy()) * this.view.res }; }
  zoomAt(x, y, f) {
    const w0 = this.toWorld(x, y);
    this.view.res = Math.min(200, Math.max(0.005, this.view.res * f));
    const w1 = this.toWorld(x, y);
    this.view.cE += w0.E - w1.E; this.view.cN += w0.N - w1.N;
    this.dirty = true; this.o.onView && this.o.onView(this.view);
  }
  zoom(f) { this.zoomAt(this.w / 2, this.cy(), f); }
  center(E, N, res) { this.view.cE = E; this.view.cN = N; if (res) this.view.res = res; this.dirty = true; this.o.onView && this.o.onView(this.view); }
  fit(pts, pad = 60) {
    const v = pts.filter((p) => p && p.E != null);
    if (!v.length) return false;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of v) { a = Math.min(a, p.E); b = Math.min(b, p.N); c = Math.max(c, p.E); d = Math.max(d, p.N); }
    const res = Math.max((c - a) / Math.max(40, this.w - 2 * pad), (d - b) / Math.max(40, this.visH() - 2 * pad), 0.05);
    this.center((a + c) / 2, (b + d) / 2, res);
    return true;
  }

  // ---------- Hareketler ----------
  down(e) {
    this.c.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY, t0: Date.now() });
    if (this.pointers.size === 1) {
      const hit = this.o.editNodes ? this.hitTest(e.offsetX, e.offsetY, true) : null;
      if (hit && hit.kind === 'point' && this.o.canDrag && this.o.canDrag(hit)) this.dragNode = { hit, E: hit.ref.E, N: hit.ref.N };
      clearTimeout(this.lpT);
      this.lpT = setTimeout(() => { const p = this.pointers.get(e.pointerId); if (p && Math.hypot(p.x - p.x0, p.y - p.y0) < 8 && this.pointers.size === 1) { this.lp = true; const w = this.toWorld(p.x, p.y); this.o.onLongPress && this.o.onLongPress(w, this.hitTest(p.x, p.y)); } }, 550);
    }
    if (this.pointers.size === 2) { clearTimeout(this.lpT); const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  }
  move(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
    p.x = e.offsetX; p.y = e.offsetY;
    if (this.pointers.size === 1) {
      if (this.dragNode) { const w = this.toWorld(p.x, p.y); this.dragNode.E = w.E; this.dragNode.N = w.N; this.dirty = true; return; }
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) { this.follow = false; this.o.onFollow && this.o.onFollow(false); }
      this.view.cE -= dx * this.view.res; this.view.cN += dy * this.view.res; this.dirty = true;
    } else if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.view.cE -= (mx - this.pinch.mx) * this.view.res; this.view.cN += (my - this.pinch.my) * this.view.res;
      if (d > 10 && this.pinch.d > 10) this.zoomAt(mx, my, this.pinch.d / d);
      this.pinch = { d, mx, my }; this.dirty = true;
    }
  }
  up(e, cancel) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    clearTimeout(this.lpT);
    if (this.pointers.size < 2) this.pinch = null;
    if (!p || cancel) { this.dragNode = null; return; }
    if (this.dragNode) {
      const dn = this.dragNode; this.dragNode = null;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) { this.o.onDragNode && this.o.onDragNode(dn.hit, { E: dn.E, N: dn.N }); this.dirty = true; return; }
    }
    if (this.lp) { this.lp = false; return; }
    if (Math.hypot(p.x - p.x0, p.y - p.y0) < 8 && Date.now() - p.t0 < 500 && this.pointers.size === 0) {
      const w = this.toWorld(p.x, p.y);
      this.o.onTap && this.o.onTap(w, this.hitTest(p.x, p.y), this.snapAt(p.x, p.y));
    }
    this.o.onView && this.o.onView(this.view);
  }
  // Yakalama: düğüm (20 px) öncelikli
  snapAt(x, y, tolPx = 20) {
    const d = this.o.getData(); let best = null;
    for (const pt of d.points) { if (pt.E == null) continue; const s = this.toScreen(pt.E, pt.N); const dd = Math.hypot(s.x - x, s.y - y); if (dd <= tolPx && (!best || dd < best.d)) best = { d: dd, point: pt }; }
    return best ? best.point : null;
  }
  hitTest(x, y, pointsOnly) {
    const d = this.o.getData();
    let best = null;
    for (const e of d.equipment) { const p = d.pointMap.get(e.pointId); if (!p || p.E == null) continue; const s = this.toScreen(p.E, p.N); const dd = Math.hypot(s.x - x, s.y - y); if (dd < 22 && (!best || dd < best.d)) best = { d: dd, kind: 'point', ref: p, eq: e }; }
    for (const p of d.points) { if (p.E == null) continue; const s = this.toScreen(p.E, p.N); const dd = Math.hypot(s.x - x, s.y - y); if (dd < 18 && (!best || dd < best.d - 2)) best = { d: dd, kind: 'point', ref: p, eq: (d.eqByPoint.get(p.id) || [])[0] || null }; }
    if (best || pointsOnly) return best;
    for (const l of d.lines) {
      const n = l.nodes.map((id) => d.pointMap.get(id)).filter(Boolean);
      for (let i = 0; i < n.length - 1; i++) {
        const a = this.toScreen(n[i].E, n[i].N), b = this.toScreen(n[i + 1].E, n[i + 1].N);
        const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2; let t = L2 ? ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const dd = Math.hypot(x - (a.x + t * (b.x - a.x)), y - (a.y + t * (b.y - a.y)));
        if (dd < 12 && (!best || dd < best.d)) best = { d: dd, kind: 'line', ref: l, seg: i };
      }
    }
    return best;
  }

  // ---------- Çizim ----------
  draw() {
    const g = this.ctx, d = this.o.getData();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#0a1122'; g.fillRect(0, 0, this.w, this.h);
    if (this.layers.basemap && d.basemap && d.crs) this.drawTiles(g, d);
    if (this.layers.grid) this.drawGrid(g);
    if (this.layers.cad !== false && d.cad && d.cad.length) this.drawCad(g, d.cad);
    const en = d.energy || null;     // enerji kontrolü açıksa: enerjili hat sarı parlar, enerjisiz hat gri kesik çizilir
    const sel = d.sel || {};
    // Hatlar: çizimdeki görünüm (ortak çizim stili) — türün rengi ve çizgi deseni, demontaj sarı, kanal iki kenarlı
    const res = this.view.res, dm = this.layers.demontaj !== false, kanalAcik = this.layers.kanal !== false;
    const metrajAcik = this.layers.spanText && res < 1.2, etiketAcik = this.layers.labels && res < 0.8 && d.lineTag;
    const yazilar = []; // hatların üstünde kalsın diye hatlardan sonra yazılır
    const metrajOlcu = yaziOlcusu(YAZI.metraj, res), etiketOlcu = yaziOlcusu(YAZI.etiket, res, 10, 16);
    // Görünen alan (yazılar taşabilsin diye 200 px paylı): dışındaki hat çizilmez, yazısı hesaplanmaz
    const g0 = this.toWorld(-200, -200), g1 = this.toWorld(this.w + 200, this.h + 200);
    for (const l of d.lines) {
      if (!this.layers[l.lineType] || (l.install === 'yeralti' && !this.layers.yeralti)) continue;
      if (l.channelOnly && !kanalAcik) continue;
      if (l.state === 'MEVCUT' && !this.layers.mevcut) continue;
      const n = l.nodes.map((id) => d.pointMap.get(id)).filter((p) => p && p.E != null);
      if (n.length < 2) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of n) { if (p.E < x0) x0 = p.E; if (p.E > x1) x1 = p.E; if (p.N < y0) y0 = p.N; if (p.N > y1) y1 = p.N; }
      if (x1 < g0.E || x0 > g1.E || y1 < g1.N || y0 > g0.N) continue;
      const on = sel.type === 'line' && sel.id === l.id;
      const anahtar = hatAnahtari(l), lw = hatKalinligi(l, anahtar);
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (on) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = lw + 8; g.setLineDash([]); this.path(g, n); g.stroke(); }
      // Hakediş görünümü: hattın altında durum renginde geniş bant
      const hc = this.layers.hak && d.hakColor ? d.hakColor(l) : null;
      if (hc) { g.strokeStyle = hc; g.globalAlpha = 0.42; g.lineWidth = lw + 9; g.setLineDash([]); this.path(g, n); g.stroke(); g.globalAlpha = 1; }
      const es = en ? en.lineState.get(l.id) : null;
      if (es === 'on' || es === 'mixed') { g.strokeStyle = es === 'on' ? '#fde047' : '#fb923c'; g.globalAlpha = 0.5; g.lineWidth = lw + 9; g.setLineDash([]); this.path(g, n); g.stroke(); g.globalAlpha = 1; }
      const enerjisiz = es === 'off' || es === 'skip';
      const col = enerjisiz ? '#64748b' : hatRengi(l, dm);
      if (l.state === 'MEVCUT' && !es) g.globalAlpha = 0.6;
      // Kanal kenarları: eksenden genişliğin yarısı kadar iki yanda (yalnız yakın ölçekte, çizgiden ayrı görünürken)
      const kw = kanalAcik ? kanalGenisligi(l) : 0, yari = kw / 2 / res;
      if (kw && yari >= lw / 2 + 2) {
        const sp = n.map((p) => this.toScreen(p.E, p.N));
        g.strokeStyle = kenarRengi(l, dm); g.lineWidth = 1.2; g.setLineDash([]);
        for (const yan of [yari, -yari]) { const e = esCizgi(sp, yan); if (e.length < 2) continue; g.beginPath(); e.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
      }
      // Yatay sondajla geçen kablo: altında sondajın noktalı çizgisi (eklentide ayrı sondaj nesnesi)
      if (kanalAcik && sondajli(l)) { const sw = lw + 3; g.strokeStyle = EKRAN.hat.SONDAJ; g.lineWidth = sw; g.setLineDash(ekranDeseni('DOT', sw)); this.path(g, n); g.stroke(); }
      g.strokeStyle = col; g.lineWidth = lw;
      g.setLineDash(enerjisiz ? [4, 7] : ekranDeseni(hatCizgisi(l), lw));
      this.path(g, n); g.stroke(); g.globalAlpha = 1; g.setLineDash([]);
      // Metraj: her açıklığa bir kez (iki direk / iki bağlantı elemanı arası), en uzun parçanın üst yanında, hattın renginde;
      // kanal ve sondaj metrajı bir satır yukarıda (içindeki kablonun metrajıyla üst üste binmesin)
      if (metrajAcik) {
        const [kx, ky] = l.channelOnly ? KAYDIRMA.kazi : KAYDIRMA.metraj, s = metrajOlcu.s;
        for (const a of spanTexts(n, (p) => dugumMu(d.eqByPoint.get(p.id)))) yazilar.push([a.length.toFixed(YAZI.hane), yaziKonumu(n[a.seg], n[a.seg + 1], kx * s, ky * s), metrajOlcu.px, col]);
      }
      // Hat etiketi "hat no kesit": orta parçanın alt yanında, hattın renginde (telefonun DXF'iyle aynı yazı)
      if (etiketAcik) {
        const mid = Math.floor((n.length - 1) / 2), s = etiketOlcu.s;
        yazilar.push([d.lineTag(l), yaziKonumu(n[mid], n[mid + 1], KAYDIRMA.etiket[0] * s, KAYDIRMA.etiket[1] * s), etiketOlcu.px, col]);
      }
    }
    if (yazilar.length) {
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      for (const [t, k, px, col] of yazilar) {
        const s = this.toScreen(k.x, k.y);
        if (!t || s.x < -400 || s.y < -60 || s.x > this.w + 60 || s.y > this.h + 60) continue;
        g.save(); g.translate(s.x, s.y); g.rotate(-k.ang * Math.PI / 180);
        g.font = '600 ' + px.toFixed(1) + 'px ' + YAZI.font;
        g.lineWidth = 3; g.strokeStyle = 'rgba(10,17,34,.85)'; g.strokeText(t, 0, 0);
        g.fillStyle = col; g.fillText(t, 0, 0); g.restore();
      }
    }
    // Aktif hat önizlemesi
    if (this.preview && this.preview.from && this.preview.to) {
      const a = this.toScreen(this.preview.from.E, this.preview.from.N), b = this.toScreen(this.preview.to.E, this.preview.to.N);
      g.strokeStyle = this.preview.color || '#ff6b6b'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
    }
    // Noktalar ve ekipman
    const labels = this.layers.labels && this.view.res < 2;
    for (const p of d.points) {
      if (p.E == null) continue;
      const s = this.toScreen(p.E, p.N);
      if (s.x < -40 || s.y < -40 || s.x > this.w + 40 || s.y > this.h + 40) continue;
      const eqs = d.eqByPoint.get(p.id) || [];
      const isSel = sel.type === 'point' && sel.id === p.id;
      if (isSel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(s.x, s.y, 16, 0, Math.PI * 2); g.stroke(); }
      const si = d.srcInfo ? d.srcInfo(p) : null;
      if (!eqs.length) { if (this.layers.points) this.cross(g, s, si && !si.precise ? si.color : '#e2e8f0'); }
      // Hakediş görünümü: objenin çevresinde durum renginde halka
      // Uzak ölçekte halka küçülür; çok uzakta obje yalnız durum renginde nokta olarak çizilir (üst üste binmeyi önler)
      const far = this.view.res > 2.5, hr = this.view.res < 0.8 ? 14 : this.view.res < 2.5 ? 10 : 5;
      const hc = this.layers.hak && d.hakColor && eqs.length ? d.hakColor(eqs[0]) : null;
      if (hc) { g.fillStyle = hc; g.globalAlpha = far ? 0.95 : 0.22; g.beginPath(); g.arc(s.x, s.y, hr, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; if (!far) { g.strokeStyle = hc; g.lineWidth = 2.5; g.beginPath(); g.arc(s.x, s.y, hr, 0, Math.PI * 2); g.stroke(); } }
      if (!(far && hc)) for (const e of eqs) this.symbol(g, s, e, d);
      // Hassas olmayan kaynak (telefon · manuel · Excel · harita · FLOAT): sağ altta kaynak renginde küçük işaret (her ölçekte)
      if (this.layers.srcTags && si && !si.precise && eqs.length && !far) { g.fillStyle = si.color; g.strokeStyle = '#0b1326'; g.lineWidth = 1.5; g.beginPath(); g.arc(s.x + 8, s.y + 8, 3.5, 0, Math.PI * 2); g.fill(); g.stroke(); }
      // Enerji kontrolü: enerjisiz obje kırmızı çarpı, kaynak sarı halka
      if (en && eqs.length) {
        const st = en.eqState.get(eqs[0].id);
        if (st === 'off' || st === 'mixed') { g.strokeStyle = st === 'off' ? '#ef4444' : '#fb923c'; g.lineWidth = 2.5; g.setLineDash([]); g.beginPath(); g.arc(s.x, s.y, 13, 0, Math.PI * 2); g.moveTo(s.x - 6, s.y - 6); g.lineTo(s.x + 6, s.y + 6); g.moveTo(s.x + 6, s.y - 6); g.lineTo(s.x - 6, s.y + 6); g.stroke(); }
      }
      if (en && (en.sources.og.includes(p.id) || en.sources.ag.includes(p.id))) { g.strokeStyle = '#fde047'; g.lineWidth = 3; g.setLineDash([]); g.beginPath(); g.arc(s.x, s.y, 17, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#fde047'; g.font = '800 13px JetBrains Mono, monospace'; g.textAlign = 'center'; g.fillText('ϟ', s.x, s.y - 20); g.textAlign = 'left'; }
      if (p.source === 'PHONE' && !far) { g.strokeStyle = '#38bdf8'; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.arc(s.x, s.y, 18, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      if (labels) {
        g.font = '700 11px JetBrains Mono, monospace'; g.textAlign = 'left';
        const t = (eqs[0] ? eqs[0].no : p.pointNo) || '';
        const col = eqs[0] && eqs[0].kind === 'pole' && d.groupVolt(eqs[0]) === 'OG' ? '#ff8a8a' : eqs[0] && eqs[0].kind === 'transformer' ? '#8ea2ff' : '#dae2fd';
        g.lineWidth = 3; g.strokeStyle = 'rgba(10,17,34,.9)'; g.strokeText(t, s.x + 10, s.y - 9); g.fillStyle = col; g.fillText(t, s.x + 10, s.y - 9);
        const ri = eqs[0] && d.roles.get(eqs[0].id);
        if (ri && ri.role === 'Z' && ri.angle) { g.font = '600 10px JetBrains Mono, monospace'; g.fillStyle = '#fbbf24'; g.fillText('α ' + ri.angle.toFixed(1) + '°', s.x + 10, s.y + 16); }
        // Veri kaynağı etiketi: hassas olmayanlar her zaman, RTK FIX yalnız yakın ölçekte
        if (this.layers.srcTags && si && (si.precise ? this.view.res < 0.12 : this.view.res < 0.45)) { g.font = '700 9px JetBrains Mono, monospace'; g.lineWidth = 3; g.strokeStyle = 'rgba(10,17,34,.9)'; g.strokeText('[' + si.tag + ']', s.x + 10, s.y + 3); g.fillStyle = si.color; g.fillText('[' + si.tag + ']', s.x + 10, s.y + 3); }
      }
    }
    // Sürükleme
    if (this.dragNode) { const s = this.toScreen(this.dragNode.E, this.dragNode.N); g.strokeStyle = '#fbbf24'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(s.x, s.y, 14, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    // Ölçüm
    if (this.measure && this.measure.pts.length) {
      const pts = this.measure.pts;
      g.strokeStyle = '#22d3ee'; g.fillStyle = 'rgba(34,211,238,.12)'; g.lineWidth = 2; g.setLineDash([]);
      this.path(g, pts); if (this.measure.mode === 'area' && pts.length > 2) { g.closePath(); g.fill(); } g.stroke();
      for (const p of pts) { const s = this.toScreen(p.E, p.N); g.fillStyle = '#22d3ee'; g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI * 2); g.fill(); }
    }
    // Aplikasyon hedefi
    if (d.target) {
      const s = this.toScreen(d.target.E, d.target.N);
      g.strokeStyle = '#eab308'; g.lineWidth = 2; for (const r of [6, 12, 18]) { g.beginPath(); g.arc(s.x, s.y, r, 0, Math.PI * 2); g.stroke(); }
      if (d.gnss && d.gnss.E != null) { const a = this.toScreen(d.gnss.E, d.gnss.N); g.setLineDash([6, 4]); g.strokeStyle = '#10b981'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(s.x, s.y); g.stroke(); g.setLineDash([]); }
    }
    // GNSS konumu
    if (d.gnss && d.gnss.E != null) {
      const s = this.toScreen(d.gnss.E, d.gnss.N);
      const col = d.gnssColor || '#10b981';
      const acc = d.gnss.sigmaH ? d.gnss.sigmaH / this.view.res : 0;
      if (acc > 6) { g.fillStyle = col + '22'; g.strokeStyle = col + '88'; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, Math.min(acc, 2000), 0, Math.PI * 2); g.fill(); g.stroke(); }
      const hd = d.gnss.heading ?? d.gnss.course;
      if (hd != null) { g.save(); g.translate(s.x, s.y); g.rotate(hd * Math.PI / 180); g.fillStyle = col; g.beginPath(); g.moveTo(0, -18); g.lineTo(7, -6); g.lineTo(-7, -6); g.closePath(); g.fill(); g.restore(); }
      g.fillStyle = '#0b1326'; g.beginPath(); g.arc(s.x, s.y, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(s.x, s.y, 6, 0, Math.PI * 2); g.fill();
    }
    // Haritadan nokta seçme: görünen alanın ortasında nişangâh
    if (this.crosshair) {
      const x = this.w / 2, y = this.cy();
      g.strokeStyle = 'rgba(10,17,34,.9)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 6, y); g.moveTo(x + 6, y); g.lineTo(x + 22, y); g.moveTo(x, y - 22); g.lineTo(x, y - 6); g.moveTo(x, y + 6); g.lineTo(x, y + 22); g.stroke();
      g.strokeStyle = '#c084fc'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 6, y); g.moveTo(x + 6, y); g.lineTo(x + 22, y); g.moveTo(x, y - 22); g.lineTo(x, y - 6); g.moveTo(x, y + 6); g.lineTo(x, y + 22); g.stroke();
      g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#c084fc'; g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
    }
    this.drawScale(g);
  }
  path(g, pts, off = 0) { g.beginPath(); pts.forEach((p, i) => { const s = this.toScreen(p.E, p.N); if (i) g.lineTo(s.x + off, s.y + off); else g.moveTo(s.x + off, s.y + off); }); }
  /** Demontaj işareti (sarı, simgeden taşar): "/" demontaj · "//" kesik · "X" sökük — AutoCAD simgeleriyle aynı. */
  dmIsareti(g, s, dmDurum) {
    const d = String(dmDurum || '').toLocaleUpperCase('tr');
    const kesik = d.startsWith('KES'), sokuk = d.startsWith('SÖK') || d.startsWith('SOK');
    g.strokeStyle = '#ffff00'; g.lineWidth = 2.5; g.beginPath();
    if (kesik) { g.moveTo(s.x - 14, s.y + 8); g.lineTo(s.x + 8, s.y - 14); g.moveTo(s.x - 8, s.y + 14); g.lineTo(s.x + 14, s.y - 8); }
    else { g.moveTo(s.x - 11, s.y + 11); g.lineTo(s.x + 11, s.y - 11); if (sokuk) { g.moveTo(s.x - 11, s.y - 11); g.lineTo(s.x + 11, s.y + 11); } }
    g.stroke();
  }
  cross(g, s, col) { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); g.moveTo(s.x - 6, s.y); g.lineTo(s.x + 6, s.y); g.moveTo(s.x, s.y - 6); g.lineTo(s.x, s.y + 6); g.stroke(); }
  symbol(g, s, e, d) {
    const st = e.state || 'YENI';
    if (e.kind === 'luminaire') {
      // Armatür / sokak lambası: sarı ışık halkalı lamba (yeni dolu, mevcut içi boş)
      const Y = st === 'MEVCUT' ? '#d4a017' : EKRAN.armatur;
      g.strokeStyle = Y; g.lineWidth = 1.6; g.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.moveTo(s.x + Math.cos(a) * 8, s.y + Math.sin(a) * 8); g.lineTo(s.x + Math.cos(a) * 12, s.y + Math.sin(a) * 12); }
      g.stroke();
      g.fillStyle = st === 'MEVCUT' || st === 'ILERIDE' ? '#0b1326' : Y; g.lineWidth = 2; g.beginPath(); g.arc(s.x, s.y, 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
      if (st === 'DEMONTAJ' && this.layers.demontaj) this.dmIsareti(g, s, (e.attrs || {}).dmDurum);
      return;
    }
    if (e.kind === 'pole' || e.kind === 'lighting') {
      const volt = d.groupVolt(e);
      if ((st === 'MEVCUT' && !this.layers.mevcut)) return;
      const col = (PCOL[volt] || PCOL.AG)[st] || '#dae2fd';
      const sq = d.groupSymbol(e) === 's' && volt !== 'AYD';
      const r = volt === 'OG' ? 7 : volt === 'AYD' ? 5 : 6;
      const mode = st === 'YENI' || st === 'ILERIDE' ? 'full' : st === 'DMM' ? 'half' : 'none';
      g.lineWidth = 2; g.strokeStyle = col; g.fillStyle = mode === 'full' ? col : '#0b1326';
      g.beginPath(); if (sq) g.rect(s.x - r, s.y - r, 2 * r, 2 * r); else g.arc(s.x, s.y, r, 0, Math.PI * 2); g.fill(); g.stroke();
      if (mode === 'half') { g.fillStyle = col; g.beginPath(); if (sq) { g.moveTo(s.x - r, s.y - r); g.lineTo(s.x, s.y); g.lineTo(s.x - r, s.y + r); g.closePath(); g.moveTo(s.x + r, s.y - r); g.lineTo(s.x, s.y); g.lineTo(s.x + r, s.y + r); g.closePath(); } else { g.arc(s.x, s.y, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); } g.fill(); }
      // Kafesin iç çarpısı yalnız mevcutta; demontajda simge boş, içinde yalnız demontaj işareti (AutoCAD simgeleriyle aynı)
      if (mode === 'none' && sq && st !== 'DEMONTAJ') { g.beginPath(); g.moveTo(s.x - r, s.y - r); g.lineTo(s.x + r, s.y + r); g.moveTo(s.x + r, s.y - r); g.lineTo(s.x - r, s.y + r); g.stroke(); }
      if (st === 'DEMONTAJ' && this.layers.demontaj) this.dmIsareti(g, s, (e.attrs || {}).dmDurum);
      if (st === 'ILERIDE') { g.fillStyle = '#0b1326'; g.beginPath(); g.arc(s.x, s.y, r / 2.2, 0, Math.PI * 2); g.fill(); }
      // Aydınlatma direği: konsol kolu + sarı lamba başlığı (AG/OG direklerinden net ayrılır)
      if (volt === 'AYD') {
        g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(s.x + 3, s.y - 3); g.lineTo(s.x + 10, s.y - 10); g.stroke();
        g.fillStyle = '#fde047'; g.strokeStyle = '#0b1326'; g.lineWidth = 1; g.beginPath(); g.arc(s.x + 11.5, s.y - 11.5, 4, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = '#fde047'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(s.x + 17, s.y - 11.5); g.lineTo(s.x + 20, s.y - 11.5); g.moveTo(s.x + 11.5, s.y - 17); g.lineTo(s.x + 11.5, s.y - 20); g.moveTo(s.x + 15.5, s.y - 15.5); g.lineTo(s.x + 17.6, s.y - 17.6); g.stroke();
      }
      return;
    }
    if (!this.layers.trafo && (e.kind === 'transformer' || e.kind === 'sdk' || e.kind === 'kiosk' || e.kind === 'substation' || e.kind === 'panel')) return;
    const T = EKRAN.trafo;
    g.lineWidth = 2; g.strokeStyle = T;
    const full = st === 'yeni' || st === 'YENI';
    g.fillStyle = full ? T : '#0b1326';
    g.beginPath();
    if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') {
      const post = (e.attrs || {}).post || 'direk';
      if (post === 'direk') { g.moveTo(s.x, s.y - 10); g.lineTo(s.x + 9, s.y + 7); g.lineTo(s.x - 9, s.y + 7); g.closePath(); }
      else if (post === 'bina' || post === 'ba') g.rect(s.x - 8, s.y - 8, 16, 16);
      else { g.moveTo(s.x - 10, s.y - 1); g.lineTo(s.x, s.y - 10); g.lineTo(s.x + 10, s.y - 1); g.lineTo(s.x + 8, s.y - 1); g.lineTo(s.x + 8, s.y + 8); g.lineTo(s.x - 8, s.y + 8); g.lineTo(s.x - 8, s.y - 1); g.closePath(); }
    } else if (e.kind === 'sdk') { g.rect(s.x - 9, s.y - 6, 18, 12); }
    else if (e.kind === 'manhole') { g.rect(s.x - 6, s.y - 6, 12, 12); }
    else if (e.kind === 'panel') { g.rect(s.x - 7, s.y - 9, 14, 18); }
    else if (e.kind === 'other') { g.strokeStyle = EKRAN.diger; g.fillStyle = full ? EKRAN.diger : '#0b1326'; g.moveTo(s.x, s.y - 8); g.lineTo(s.x + 8, s.y); g.lineTo(s.x, s.y + 8); g.lineTo(s.x - 8, s.y); g.closePath(); }
    else { g.arc(s.x, s.y, 5, 0, Math.PI * 2); g.strokeStyle = '#fbbf24'; }
    g.fill(); g.stroke();
    if (e.kind === 'sdk') { g.beginPath(); g.moveTo(s.x - 9, s.y + 6); g.lineTo(s.x + 9, s.y - 6); g.stroke(); }
    if (e.kind === 'panel') { g.strokeStyle = full ? '#0b1326' : T; g.lineWidth = 1.6; g.beginPath(); g.moveTo(s.x + 2, s.y - 6); g.lineTo(s.x - 3, s.y + 1); g.lineTo(s.x + 1, s.y + 1); g.lineTo(s.x - 2, s.y + 6); g.stroke(); }
  }
  drawGrid(g) {
    const span = this.view.res * Math.max(this.w, this.h);
    const raw = span / 5, pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw) || pow * 10;
    const tl = this.toWorld(0, 0), br = this.toWorld(this.w, this.h);
    g.strokeStyle = 'rgba(148,163,184,.10)'; g.lineWidth = 1; g.font = '600 9px JetBrains Mono, monospace'; g.fillStyle = 'rgba(148,163,184,.55)';
    for (let E = Math.ceil(tl.E / step) * step; E <= br.E; E += step) { const x = this.toScreen(E, 0).x; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, this.h); g.stroke(); g.textAlign = 'left'; g.fillText('Y ' + E.toFixed(0), x + 3, 12); }
    for (let N = Math.ceil(br.N / step) * step; N <= tl.N; N += step) { const y = this.toScreen(0, N).y; g.beginPath(); g.moveTo(0, y); g.lineTo(this.w, y); g.stroke(); g.fillText('X ' + N.toFixed(0), 3, y - 3); }
  }
  drawScale(g) {
    const target = 90 * this.view.res, pow = 10 ** Math.floor(Math.log10(target));
    const m = [1, 2, 5].map((k) => k * pow).reverse().find((s) => s <= target) || pow;
    const px = m / this.view.res, x = 72, y = 24;
    g.strokeStyle = '#dae2fd'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + px, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.moveTo(x + px, y - 4); g.lineTo(x + px, y + 4); g.stroke();
    g.font = '700 11px JetBrains Mono, monospace'; g.fillStyle = '#dae2fd'; g.textAlign = 'left'; g.fillText((m >= 1000 ? m / 1000 + ' km' : m + ' m'), x + px + 6, y + 4);
  }
  // ---------- CAD çizimi (DXF / NCZ) ----------
  // Nesne sınır kutuları bir kez hesaplanır; her karede yalnız görünen nesneler, renge göre toplu çizilir.
  drawCad(g, cad) {
    const tl = this.toWorld(0, 0), br = this.toWorld(this.w, this.h);
    const vx0 = tl.E, vx1 = br.E, vy0 = br.N, vy1 = tl.N, res = this.view.res;
    const X = (x) => this.w / 2 + (x - this.view.cE) / res, Y = (y) => this.cy() - (y - this.view.cN) / res;
    for (const c of cad) {
      const m = c.model, E = m.ents, n = E.length;
      let bb = m._bb;
      if (!bb) {
        bb = new Float64Array(n * 4);
        for (let i = 0; i < n; i++) {
          const e = E[i]; let a, b, cc, d2;
          if (e.t === 'L') { a = Math.min(e.x1, e.x2); b = Math.min(e.y1, e.y2); cc = Math.max(e.x1, e.x2); d2 = Math.max(e.y1, e.y2); }
          else if (e.t === 'P' || e.t === 'F') { a = b = Infinity; cc = d2 = -Infinity; for (let k = 0; k < e.v.length; k += 2) { a = Math.min(a, e.v[k]); cc = Math.max(cc, e.v[k]); b = Math.min(b, e.v[k + 1]); d2 = Math.max(d2, e.v[k + 1]); } }
          else if (e.t === 'C' || e.t === 'A') { a = e.x - e.r; b = e.y - e.r; cc = e.x + e.r; d2 = e.y + e.r; }
          else if (e.t === 'T') { const w = (e.s || '').length * (e.h || 1); a = e.x - w; b = e.y - w; cc = e.x + w; d2 = e.y + w; }
          else { a = cc = e.x; b = d2 = e.y; }
          bb[i * 4] = a; bb[i * 4 + 1] = b; bb[i * 4 + 2] = cc; bb[i * 4 + 3] = d2;
        }
        Object.defineProperty(m, '_bb', { value: bb, enumerable: false });
      }
      const paths = new Map(), fills = [], texts = [], pts = [];
      const P = (col) => { let p = paths.get(col); if (!p) { p = new Path2D(); paths.set(col, p); } return p; };
      for (let i = 0; i < n; i++) {
        if (bb[i * 4] > vx1 || bb[i * 4 + 2] < vx0 || bb[i * 4 + 1] > vy1 || bb[i * 4 + 3] < vy0) continue;
        const e = E[i];
        if (c.hidden && c.hidden.has(e.l)) continue;
        const col = aciCSS(e.c || 7, true);
        if (e.t === 'L') { const p = P(col); p.moveTo(X(e.x1), Y(e.y1)); p.lineTo(X(e.x2), Y(e.y2)); }
        else if (e.t === 'P') { const p = P(col), v = e.v; if (v.length < 4) continue; p.moveTo(X(v[0]), Y(v[1])); for (let k = 2; k < v.length; k += 2) p.lineTo(X(v[k]), Y(v[k + 1])); if (e.closed) p.closePath(); }
        else if (e.t === 'C') { const r = e.r / res; if (r < 0.4) continue; const p = P(col); p.moveTo(X(e.x) + r, Y(e.y)); p.arc(X(e.x), Y(e.y), r, 0, Math.PI * 2); }
        else if (e.t === 'A') { const r = e.r / res; if (r < 0.4) continue; const p = P(col); const a1 = -e.a2 * Math.PI / 180, a2 = -e.a1 * Math.PI / 180; p.moveTo(X(e.x) + r * Math.cos(a1), Y(e.y) + r * Math.sin(a1)); p.arc(X(e.x), Y(e.y), r, a1, a2 < a1 ? a2 + Math.PI * 2 : a2); }
        else if (e.t === 'F') fills.push([e, col]);
        else if (e.t === 'T') { if ((e.h || 1) / res > 5 && texts.length < 600) texts.push([e, col]); }
        else if (e.t === 'N') pts.push([e, col]);
      }
      g.lineWidth = 1.1; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([]);
      g.globalAlpha = 0.28;
      for (const [e, col] of fills) { const v = e.v; if (v.length < 6) continue; g.fillStyle = col; g.beginPath(); g.moveTo(X(v[0]), Y(v[1])); for (let k = 2; k < v.length; k += 2) g.lineTo(X(v[k]), Y(v[k + 1])); g.closePath(); g.fill(); }
      g.globalAlpha = 0.9;
      for (const [col, p] of paths) { g.strokeStyle = col; g.stroke(p); }
      for (const [e, col] of pts) { const x = X(e.x), y = Y(e.y); g.strokeStyle = col; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke(); }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      for (const [e, col] of texts) { const px = Math.min(60, (e.h || 1) / res); g.save(); g.translate(X(e.x), Y(e.y)); if (e.rot) g.rotate(-e.rot * Math.PI / 180); g.fillStyle = col; g.font = '500 ' + px.toFixed(1) + 'px Inter, sans-serif'; const lines = String(e.s || '').split('\n'); for (let k = 0; k < lines.length; k++) g.fillText(lines[k], 0, k * px * 1.25); g.restore(); }
      g.globalAlpha = 1;
    }
    // Seçili çizim noktası
    const s = this.o.getData().sel;
    if (s && s.type === 'cad') { const x = X(s.x), y = Y(s.y); g.strokeStyle = '#fde047'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.moveTo(x - 17, y); g.lineTo(x + 17, y); g.moveTo(x, y - 17); g.lineTo(x, y + 17); g.stroke(); }
  }
  // ---------- Altlık karolar ----------
  drawTiles(g, d) {
    const crs = d.crs, c = unproject(this.view.cE, this.view.cN, crs);
    let z = Math.round(Math.log2((156543.03 * Math.cos(c.lat * Math.PI / 180)) / this.view.res));
    z = Math.max(3, Math.min(d.basemap.maxZoom || 19, z));
    const corners = [[0, 0], [this.w, 0], [0, this.h], [this.w, this.h]].map(([x, y]) => { const w = this.toWorld(x, y); return unproject(w.E, w.N, crs); });
    const n = 2 ** z;
    const tproj = d.basemap.proj || '3857';             // Yandex: elipsoidal Mercator (3395)
    const tx = (lon) => tileX(lon, z), ty = (lat) => tileY(lat, z, tproj);
    const x0 = Math.min(...corners.map((p) => tx(p.lon))), x1 = Math.max(...corners.map((p) => tx(p.lon)));
    const y0 = Math.min(...corners.map((p) => ty(p.lat))), y1 = Math.max(...corners.map((p) => ty(p.lat)));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return;
    const ll = (x, y) => tileLL(x, y, z, tproj);
    g.globalAlpha = d.basemap.opacity ?? 0.75;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const img = this.tile(d.basemap, z, x, y);
      if (!img) continue;
      const P = [ll(x, y), ll(x + 1, y), ll(x, y + 1)].map((q) => { const p = projLL(q.lat, q.lon, crs); return this.toScreen(p.E, p.N); });
      g.save();
      g.setTransform(this.dpr * (P[1].x - P[0].x) / 256, this.dpr * (P[1].y - P[0].y) / 256, this.dpr * (P[2].x - P[0].x) / 256, this.dpr * (P[2].y - P[0].y) / 256, this.dpr * P[0].x, this.dpr * P[0].y);
      g.drawImage(img, 0, 0, 256.6, 256.6);
      g.restore();
    }
    g.globalAlpha = 1;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  tile(bm, z, x, y) {
    const key = bm.id + '/' + z + '/' + x + '/' + y;
    const t = this.tiles.get(key);
    if (t && t.img) return t.img;
    if (t) return null;
    this.tiles.set(key, { loading: true });
    if (this.tiles.size > 600) { const k = this.tiles.keys().next().value; this.tiles.delete(k); }
    this.o.loadTile(bm, z, x, y).then((img) => { if (img) { this.tiles.set(key, { img }); this.dirty = true; } }).catch(() => {});
    return null;
  }
}
