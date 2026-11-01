// 02 · Aplikasyon — gerçek hedef noktadan canlı yönlendirme (ileri/sağ-sol, kot, semt, eksen ofseti, tolerans).
// Yeniden tasarım (1.11.2026): sahada tek bakışta okunacak şekilde — büyük kalan mesafe ve yön, kaydırmadan ulaşılan
// İŞARETLE / SONRAKİ çubuğu (ekranın altına yapışık), ayrıntılar (tolerans bandı, eksen ofseti, koordinatlar, CAD çizimi)
// katlanır bölümde. Hesap ve kayıt mantığı değişmedi (gnss-service.stakeout, ps.recordStakeout).
import { html, useState, useEffect, useBus, Icon, Chip, Badge, fmt, trn } from '../kit.js';
import { app } from '../ctx.js';
import { dist2, bearing, dms } from '../../geo/geom.js';
import { eqSummary, openCadFile } from './map.js';
import { cadDocs } from '../../services/cad-service.js';

const MARKS = [['kazik', 'Kazık'], ['civi', 'Çelik çivi'], ['boya', 'Röper boya'], ['poligon', 'Poligon kazığı']];

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

/** Yön satırı: büyük sayı + yön sözcüğü ("1,25 m ileri"); 1 cm altındaki bileşen yazılmaz. */
function Yon({ deger, arti, eksi, renk }) {
  if (deger == null) return null;
  const v = Math.abs(deger);
  return html`<div class="apl-yon-satir"><span class="apl-yon-sayi" style=${renk ? 'color:' + renk : ''}>${v < 0.01 ? '0' : trn(v, 2)}</span><span class="apl-yon-ad">m ${deger >= 0 ? arti : eksi}</span></div>`;
}

export function StakeoutScreen() {
  useBus('gnss:state', 200);
  useBus(['ui:target', 'project:computed']);
  const ps = app.ps, g = app.gnss.state;
  const [mark, setMark] = useState(app.state.mark || 'kazik');
  const [ayrinti, setAyrinti] = useState(!!app.state.aplAyrinti);
  const tol = app.gnss.thresholds.stakeTolerance || 0.02;
  const T = resolveTarget();
  const r = T ? app.gnss.stakeout(T) : null;
  const inTol = r && r.dist <= tol;
  const fixOk = g.fix === 'FIX';
  useEffect(() => { if (inTol && fixOk) app.bridge.vibrate(80); }, [inTol && fixOk]);
  const ax = axisOf(T);
  let axisOff = null;
  if (r && ax) { const rel = (bearing(T, r.cur) - ax.az) * Math.PI / 180; axisOff = dist2(T, r.cur) * Math.sin(rel); }
  const pick = async () => {
    const cur = g.E != null ? g : null;
    const list = ps.data.points.filter((p) => p.E != null).map((p) => ({ p, e: ps.eqAt(p.id)[0], d: cur ? dist2(cur, p) : null })).sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12) || String(a.p.pointNo).localeCompare(b.p.pointNo));
    const id = await app.modal((close) => html`<div class="mh"><h3>Hedef nokta</h3><button class="btn xs" onClick=${() => close('map')}>Haritadan seç</button></div><div class="mb" style="padding:0"><div class="list">${list.slice(0, 200).map(({ p, e, d }) => html`<button class="li" onClick=${() => close(p.id)}><div class="grow"><div class="t">${e ? e.no : p.pointNo} ${p.source === 'DESIGN' ? html`<${Badge} k="m">TASARIM</${Badge}>` : null}</div><div class="s">${e ? eqSummary(e) : p.cls}</div></div><span class="m">${d != null ? trn(d, 1) + ' m' : ''}</span></button>`)}</div></div>`);
    if (id === 'map') { app.nav.tab('map'); return; }
    if (id) { app.state.target = { id }; app.bus.emit('ui:target'); }
  };
  const next = () => {
    if (!T || !T.id) return pick();
    const l = ax ? ax.line : null;
    let nid = null;
    if (l) { const i = l.nodes.indexOf(T.id); nid = l.nodes[i + 1] || null; }
    if (!nid) { const sorted = ps.data.points.slice().sort((a, b) => String(a.pointNo).localeCompare(String(b.pointNo), 'tr', { numeric: true })); const i = sorted.findIndex((p) => p.id === T.id); nid = (sorted[i + 1] || {}).id; }
    if (nid) { app.state.target = { id: nid }; app.bus.emit('ui:target'); }
  };
  const doMark = async () => {
    const rec = await ps.recordStakeout({ targetId: T.id || null, targetNo: T.no, designE: T.E, designN: T.N, designH: T.H ?? null, measuredE: g.E, measuredN: g.N, measuredH: g.H, dE: r.dE, dN: r.dN, dH: r.dH, dist: r.dist, axisOffset: axisOff, mark, fix: g.fix, sigmaH: g.sigmaH, accepted: inTol && fixOk, tolerance: tol });
    app.toast(T.no + ' işaretlendi (' + MARKS.find((m) => m[0] === mark)[1] + ') · Δ ' + fmt(r.dist) + ' m');
    app.bridge.vibrate(150);
    next();
  };
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
  // Durum yazısı (büyük satır): ne yapmalı?
  // Yön sözü: yürüyüş yönüne göre hedef nerede (önünüzde / sağınızda / solunuzda / arkanızda); yön bilinmiyorsa pusula yönü
  const rel = r && r.relBearing != null ? ((r.relBearing % 360) + 540) % 360 - 180 : null;
  const yonSozu = rel == null ? null : Math.abs(rel) < 30 ? 'Hedef önünüzde · ileri yürüyün' : Math.abs(rel) > 150 ? 'Hedef arkanızda · geri dönün' : rel > 0 ? 'Hedef sağınızda · sağa dönün' : 'Hedef solunuzda · sola dönün';
  const say = !T ? 'Hedef nokta seçin' : !r ? (g.E == null ? 'Konum bekleniyor…' : 'Hedef seçin') : inTol ? (fixOk ? 'Tolerans içinde — işareti çakın' : 'Tolerans içinde, RTK FIX bekleyin') : r.dist <= 0.2 ? 'Çok yakın · küçük adımlarla ' + (rel == null ? dirWord(r.azimuth) + ' yönüne' : 'yaklaşın') : yonSozu || 'Yürüyüş yönü yok · ' + dirWord(r.azimuth) + ' yönüne yürüyün';
  const bands = [[0, tol, '#10b981'], [tol, 0.2, '#f59e0b'], [0.2, 1, '#ef4444'], [1, 5, '#b91c1c']];
  const marker = r ? Math.min(0.97, r.dist <= tol ? (r.dist / tol) * 0.25 : r.dist <= 0.2 ? 0.25 + ((r.dist - tol) / (0.2 - tol)) * 0.25 : r.dist <= 1 ? 0.5 + ((r.dist - 0.2) / 0.8) * 0.25 : 0.75 + Math.min(1, (r.dist - 1) / 4) * 0.22) : 0;
  const cadN = cadDocs(ps).length;
  const openCad = async (f) => { if (!f) return; try { const rr = await openCadFile(f); const b = rr.doc.bbox; if (b) app.state.view = { cE: (b.minE + b.maxE) / 2, cN: (b.minN + b.maxN) / 2, res: Math.max((b.maxE - b.minE) / 320, (b.maxN - b.minN) / 420, 0.05) }; app.state.follow = false; app.nav.tab('map'); app.toast('Çizimde bir uca ya da köşeye dokunun, sonra "Aplikasyon yap" deyin', 'ok', 6000); } catch (e) { app.toast(e.message || String(e), 'err', 7000); } };
  const son = ps.data.stakeouts.slice(-3).reverse();
  const durumRenk = inTol ? '#10b981' : r ? '#f59e0b' : '#64748b';
  return html`<div class="apl">
    <button class="apl-hedef" onClick=${pick}><${Icon} n="target" s=${22} c="#eab308" />
      <span class="grow" style="min-width:0"><span class="lbl">Hedef nokta</span><span class="apl-hedef-ad">${T ? T.no : 'Seçilmedi — dokunun'}</span>${T && T.label ? html`<span class="apl-hedef-alt">${T.label}</span>` : null}</span><${Icon} n="down" c="#94a3b8" /></button>

    <div class="apl-yon card">
      <svg class="apl-radar" viewBox="0 0 210 210" role="img" aria-label="Yönlendirme radarı">
        <circle cx="105" cy="105" r="100" fill="#0e1730" stroke="#334155" stroke-width="1.5" />
        <circle cx="105" cy="105" r="50" fill="none" stroke="#2d3449" stroke-dasharray="3 4" />
        <circle cx="105" cy="105" r="20" fill=${inTol ? 'rgba(16,185,129,.18)' : 'none'} stroke=${inTol ? '#10b981' : '#2d3449'} stroke-width=${inTol ? 2.5 : 1} />
        <line x1="105" y1="8" x2="105" y2="202" stroke="#1f2a40" /><line x1="8" y1="105" x2="202" y2="105" stroke="#1f2a40" />
        <text x="105" y="17" text-anchor="middle" font-size="9" font-weight="700" fill="#94a3b8">${r && r.heading != null ? 'İLERİ' : 'KUZEY'}</text>
        <text x="120" y="126" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">${olcek(scale[0])}</text>
        <text x="141" y="146" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">${olcek(scale[1])}</text>
        <text x="160" y="176" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">${olcek(scale[2])}</text>
        ${r ? html`<line x1="105" y1="105" x2=${tx} y2=${ty} stroke="#10b981" stroke-width="2" stroke-dasharray="5 4" /><circle cx=${tx} cy=${ty} r="10" fill="#0b1326" stroke="#dae2fd" stroke-width="2.5" /><circle cx=${tx} cy=${ty} r="3.5" fill="#dae2fd" />` : null}
        <path d="M105 88 L115 118 L105 111 L95 118 Z" fill="#10b981" stroke="#0b1326" stroke-width="1.5" />
      </svg>
      <div class="apl-sag">
        <div class="lbl">Kalan mesafe</div>
        <div class="apl-mesafe" style=${'color:' + (inTol ? '#10b981' : '#dae2fd')}>${r ? mesafe(r.dist) : '—'}<small>m</small></div>
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
    <div class="grid4">${MARKS.map(([k, l]) => html`<${Chip} on=${mark === k} onClick=${() => { setMark(k); app.state.mark = k; }}>${l}</${Chip}>`)}</div>

    <button class="apl-ayrinti" onClick=${() => { setAyrinti(!ayrinti); app.state.aplAyrinti = !ayrinti; }}><${Icon} n=${ayrinti ? 'up' : 'down'} s=${16} />${ayrinti ? 'Ayrıntıları gizle' : 'Ayrıntılar: tolerans bandı, koordinatlar, CAD çizimi, son aplikasyonlar'}</button>
    ${ayrinti ? html`<div class="card stack">
      <div class="row"><span class="lbl grow">ΔD toleransı</span><span class="mono hl" style="font-size:12px;font-weight:700">YEŞİL ≤ ${tol.toFixed(3)} m</span></div>
      <div style="position:relative;height:10px;margin:6px 0 2px;display:flex;gap:3px">${bands.map((b) => html`<div style=${'flex:1;border-radius:3px;background:' + b[2]}></div>`)}<div style=${'position:absolute;top:-4px;left:' + marker * 100 + '%;width:4px;height:18px;background:#fff;border-radius:2px'}></div></div>
      <div class="row mono" style="font-size:10px;color:#94a3b8;justify-content:space-between"><span>0</span><span>${tol}</span><span>0.20</span><span>1.00</span><span>5.00+</span></div>
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
