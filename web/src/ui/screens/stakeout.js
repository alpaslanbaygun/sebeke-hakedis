// 02 · Aplikasyon — gerçek hedef noktadan canlı yönlendirme (ileri/sağ-sol, kot, semt, eksen ofseti, tolerans).
import { html, useState, useEffect, useBus, Icon, Chip, Badge, fmt, trn } from '../kit.js';
import { app } from '../ctx.js';
import { dist2, bearing, dms } from '../../geo/geom.js';
import { eqSummary } from './map.js';

const MARKS = [['kazik', 'Kazık'], ['civi', 'Çelik Çivi'], ['boya', 'Röper Boya'], ['poligon', 'Poligon Kazığı']];

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

export function StakeoutScreen() {
  useBus('gnss:state', 200);
  useBus(['ui:target', 'project:computed']);
  const ps = app.ps, g = app.gnss.state;
  const [mark, setMark] = useState(app.state.mark || 'kazik');
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
  // Radar
  const scale = r ? (r.dist > 2.5 ? [1, 2.5, 5] : r.dist > 0.2 ? [0.1, 0.5, 1] : [0.02, 0.05, 0.1]) : [1, 2.5, 5];
  const R = 100, rmax = scale[2];
  let tx = 105, ty = 105;
  if (r) {
    const ang = ((r.heading != null ? r.relBearing : r.azimuth) || 0) * Math.PI / 180;
    const rr = Math.min(1, r.dist / rmax) * (R - 8);
    tx = 105 + rr * Math.sin(ang); ty = 105 - rr * Math.cos(ang);
  }
  const say = !r ? (g.E == null ? 'Konum bekleniyor' : 'Hedef seçin') : inTol ? (fixOk ? 'Tolerans içinde — işareti çakın' : 'Tolerans içinde ama RTK FIX yok — bekleyin') : r.forward != null ? (Math.abs(r.forward) >= 0.01 ? trn(Math.abs(r.forward), 2) + ' m ' + (r.forward >= 0 ? 'ileri' : 'geri') : '') + (Math.abs(r.right) >= 0.01 ? ', ' + trn(Math.abs(r.right), 2) + ' m ' + (r.right >= 0 ? 'sağa' : 'sola') : '') : trn(r.dist, 2) + ' m ' + dirWord(r.azimuth) + 'ya yürüyün';
  const bands = [[0, tol, '#10b981'], [tol, 0.2, '#f59e0b'], [0.2, 1, '#ef4444'], [1, 5, '#b91c1c']];
  const marker = r ? Math.min(0.97, r.dist <= tol ? (r.dist / tol) * 0.25 : r.dist <= 0.2 ? 0.25 + ((r.dist - tol) / (0.2 - tol)) * 0.25 : r.dist <= 1 ? 0.5 + ((r.dist - 0.2) / 0.8) * 0.25 : 0.75 + Math.min(1, (r.dist - 1) / 4) * 0.22) : 0;
  return html`<div class="stack">
    <button class="card row" style="height:56px;padding:0 12px;text-align:left;color:inherit" onClick=${pick}><${Icon} n="target" s=${22} c="#eab308" /><span class="grow"><div class="lbl">Hedef nokta</div><div style="font-weight:600;font-size:14px">${T ? T.no + ' · ' + (T.label || '') : 'Seçilmedi — dokunun'}</div></span><${Icon} n="down" c="#94a3b8" /></button>
    <div class="row" style="gap:12px">
      <svg width="196" height="196" viewBox="0 0 210 210" role="img" aria-label="Yönlendirme radarı">
        <circle cx="105" cy="105" r="100" fill="#0e1730" stroke="#334155" stroke-width="1.5" />
        <circle cx="105" cy="105" r="50" fill="none" stroke="#2d3449" stroke-dasharray="3 4" />
        <circle cx="105" cy="105" r="20" fill=${inTol ? 'rgba(16,185,129,.18)' : 'none'} stroke=${inTol ? '#10b981' : '#2d3449'} stroke-width=${inTol ? 2.5 : 1} />
        <line x1="105" y1="8" x2="105" y2="202" stroke="#1f2a40" /><line x1="8" y1="105" x2="202" y2="105" stroke="#1f2a40" />
        <text x="105" y="27" text-anchor="middle" font-size="9" font-weight="700" fill="#94a3b8">${r && r.heading != null ? 'İLERİ' : 'KUZEY'}</text>
        <text x="122" y="127" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">${scale[0] < 1 ? scale[0] * 100 + ' cm' : scale[0] + ' m'}</text>
        <text x="142" y="147" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">${scale[1] < 1 ? scale[1] * 100 + ' cm' : scale[1] + ' m'}</text>
        <text x="160" y="176" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">${scale[2] < 1 ? scale[2] * 100 + ' cm' : scale[2] + ' m'}</text>
        ${r ? html`<line x1="105" y1="105" x2=${tx} y2=${ty} stroke="#10b981" stroke-width="2" stroke-dasharray="5 4" /><circle cx=${tx} cy=${ty} r="9" fill="#0b1326" stroke="#dae2fd" stroke-width="2.5" /><circle cx=${tx} cy=${ty} r="3" fill="#dae2fd" />` : null}
        <path d="M105 90 L114 116 L105 110 L96 116 Z" fill="#10b981" stroke="#0b1326" stroke-width="1.5" />
      </svg>
      <div class="grow stack" style="gap:12px">
        <div><div class="lbl">Kalan mesafe ΔD</div><div class="row" style="align-items:baseline;gap:4px"><span class="big" style=${'color:' + (inTol ? '#10b981' : '#dae2fd') + (r && r.dist >= 100 ? ';font-size:30px' : r && r.dist >= 10 ? ';font-size:36px' : '')}>${r ? r.dist.toFixed(r.dist >= 1000 ? 1 : 3) : '—'}</span><span class="num" style="color:#94a3b8">m</span></div></div>
        <div><div class="lbl">${r && r.heading != null ? 'Yön farkı' : 'Semt (grid)'}</div><div class="num" style="font-size:18px">${r ? (r.heading != null ? dms(Math.abs(((r.relBearing + 540) % 360) - 180)) + ' ' + ((((r.relBearing + 540) % 360) - 180) >= 0 ? 'SAĞ' : 'SOL') : dms(r.azimuth)) : '—'}</div></div>
        <div><span class=${'badge ' + (inTol ? 'b-ok' : 'b-warn')} style="height:26px;font-size:11px;padding:0 10px">${inTol ? 'TOLERANS İÇİ' : r ? 'YAKLAŞIYOR' : 'BEKLİYOR'}</span></div>
      </div>
    </div>
    <div class="alert ${inTol && fixOk ? 'ok' : 'info'}" style="font-size:15px;font-weight:600" aria-live="polite">${say}</div>
    <div class="grid3">
      <div class="stat"><b>↑ ${r && r.forward != null && r.forward < 0 ? 'Geri' : 'İleri'}</b><span>${r && r.forward != null ? Math.abs(r.forward).toFixed(3) : r ? fmt(r.dN) : '—'}</span><small>m</small><div class="note">${r && r.forward == null ? 'ΔX (kuzey)' : ''}</div></div>
      <div class="stat"><b>→ ${r && r.right != null && r.right < 0 ? 'Sol' : 'Sağ'}</b><span>${r && r.right != null ? Math.abs(r.right).toFixed(3) : r ? fmt(r.dE) : '—'}</span><small>m</small><div class="note">${r && r.right == null ? 'ΔY (doğu)' : ''}</div></div>
      <div class="stat"><b>↕ ${r && r.dH != null && r.dH < 0 ? 'Kazı (−)' : 'Dolgu (+)'}</b><span style="color:#4cd7f6">${r && r.dH != null ? (r.dH >= 0 ? '+' : '') + r.dH.toFixed(3) : '—'}</span><small>m</small></div>
    </div>
    <div class="card"><div class="row"><span class="lbl grow">ΔD toleransı</span><span class="mono hl" style="font-size:12px;font-weight:700">YEŞİL ≤ ${tol.toFixed(3)} m</span></div>
      <div style="position:relative;height:10px;margin:12px 0 6px;display:flex;gap:3px">${bands.map((b) => html`<div style=${'flex:1;border-radius:3px;background:' + b[2]}></div>`)}<div style=${'position:absolute;top:-4px;left:' + marker * 100 + '%;width:4px;height:18px;background:#fff;border-radius:2px'}></div></div>
      <div class="row mono" style="font-size:10px;color:#94a3b8;justify-content:space-between"><span>0</span><span>${tol}</span><span>0.20</span><span>1.00</span><span>5.00+</span></div>
      <div class="row" style="margin-top:10px;font-size:12px"><span class="lbl" style="white-space:nowrap">Eksen ofseti</span><b class="mono hl grow" style="white-space:nowrap">${axisOff != null ? (axisOff >= 0 ? 'SAĞ ' : 'SOL ') + Math.abs(axisOff).toFixed(3) + ' m' : '—'}</b><span class="note">${ax ? ax.line.lineNo + ' ekseni' : 'hat ekseni yok'} · izin ≤ ${fmt(app.gnss.thresholds.maxAxisOffset || 0.2)} m</span></div>
      <div class="kv mono" style="font-size:11px;margin-top:8px"><b>Hedef</b><span>Y ${fmt(T && T.E)} · X ${fmt(T && T.N)} · Z ${fmt(T && T.H)}</span><b>Mevcut</b><span>Y ${fmt(g.E)} · X ${fmt(g.N)} · Z ${fmt(g.H)}</span><b>Durum</b><span class=${fixOk ? 'hl' : 'hw'}>${g.fix} · σH ${fmt(g.sigmaH)}</span></div>
    </div>
    <div class="lbl">Zemin işareti</div>
    <div class="grid4">${MARKS.map(([k, l]) => html`<${Chip} on=${mark === k} onClick=${() => { setMark(k); app.state.mark = k; }}>${l}</${Chip}>`)}</div>
    <div class="row">
      <button class="btn huge grow" disabled=${!(r && inTol && fixOk)} style=${r && inTol && fixOk ? 'background:#10b981;border-color:#10b981;color:#0b1326' : ''} onClick=${doMark}><${Icon} n="pin" s=${24} />${r && inTol ? (fixOk ? 'İŞARETLE · ' + T.no : 'FIX BEKLE') : 'TOLERANS DIŞI'}</button>
      <button class="btn" style="height:64px;flex-direction:column;gap:2px;font-size:11px" onClick=${next}><${Icon} n="skip" s=${20} />SONRAKİ</button>
    </div>
    <div class="note">Son aplikasyonlar: ${ps.data.stakeouts.slice(-3).reverse().map((s) => s.targetNo + ' (' + fmt(s.dist) + ' m)').join(' · ') || '—'}</div>
  </div>`;
}
