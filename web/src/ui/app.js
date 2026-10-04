// Uygulama kabuğu: HUD, alt sekme çubuğu, gezinme yığını, bildirimler, modal pencereler.
import { html, useState, useEffect, useBus, Icon, FIXCOL, fmt } from './kit.js';
import { app } from './ctx.js';
import { SCREENS } from './screens/index.js';

const TABS = [['map', 'Harita', 'map'], ['stake', 'Aplikasyon', 'target'], ['calc', 'Hesaplar', 'calc'], ['export', 'Dışa Aktar', 'share'], ['settings', 'Ayarlar', 'sliders']];

export function Hud({ compact }) {
  useBus('gnss:state', 250);
  const s = app.gnss.snapshot();
  const none = s.source === 'none';
  const col = none ? '#475569' : s.source === 'sim' && s.fix === 'FIX' ? '#a78bfa' : FIXCOL[s.fix] || '#475569';
  const label = none ? 'KAYNAK YOK' : s.source === 'phone' ? 'TELEFON GPS' : (s.source === 'sim' ? 'SİM · ' : '') + s.label;
  const nt = s.ntrip || {};
  const ageLabel = s.source === 'phone' ? 'KAYNAK · TEST MODU' : (nt.mount || s.stationId ? (nt.mount || 'İSTASYON ' + s.stationId) + ' · YAŞ' : 'DÜZELTME YAŞI');
  const rmsCol = s.sigmaH == null ? '#94a3b8' : s.sigmaH <= app.gnss.thresholds.maxSigmaH ? '#10b981' : s.sigmaH <= 0.1 ? '#f59e0b' : s.source === 'phone' ? '#38bdf8' : '#ef4444';
  return html`<header class=${'hud' + (compact ? ' compact' : '')}>
    <div class="hud-row">
      <div class="fixchip" style=${'background:' + col} role="status" aria-label=${'Konum durumu ' + label}><i></i>${label}</div>
      ${compact ? html`<div class="hchip"><b>${s.sigmaEst ? 'σH~' : 'σH'}</b><span style=${'color:' + rmsCol}>${s.sigmaH != null ? (s.source === 'phone' ? '±' + s.sigmaH.toFixed(1) : s.sigmaH.toFixed(3)) : '—'}</span></div>
        ${s.source === 'phone' ? null : html`<div class="hchip"><b>UYDU</b><span>${s.sats ?? '—'}</span></div><div class="hchip"><b>YAŞ</b><span>${s.age != null ? s.age.toFixed(1) : '—'}</span></div>`}`
      : html`${s.source === 'phone' ? null : html`<div class="hchip"><b>PDOP</b><span>${s.pdop != null ? s.pdop.toFixed(1) : '—'}</span></div>
      <div class="hchip"><b>SAT</b><span>${s.sats ?? '—'}${s.satsInView ? '/' + s.satsInView : ''}</span></div>`}
      ${s.rateHz ? html`<div class="hchip"><span>${Math.round(s.rateHz)} Hz</span></div>` : null}`}
      <div class="grow"></div>
      <button class="hchip" style="border:0;background:none" aria-label="Konum kaynağı ayarları" onClick=${() => app.nav.tab('settings')}><${Icon} n="bt" s=${18} c=${s.connected ? '#22d3ee' : '#475569'} w=${2.2} /></button>
    </div>
    <div class="hud-grid">
      <div><b>${s.sigmaEst ? 'σH (tahmin)' : 'RMS H'}</b><span style=${'color:' + rmsCol}>${s.sigmaH != null ? (s.source === 'phone' ? '±' + s.sigmaH.toFixed(1) : s.sigmaH.toFixed(3)) + ' m' : '—'}</span></div>
      <div><b>RMS V</b><span style=${'color:' + rmsCol}>${s.sigmaV != null ? (s.source === 'phone' ? '±' + s.sigmaV.toFixed(1) : s.sigmaV.toFixed(3)) + ' m' : '—'}</span></div>
      <div><b>${ageLabel}</b><span>${s.source === 'phone' ? 'Konum servisi' : s.age != null ? s.age.toFixed(1) + ' s' : nt.state === 'connected' ? 'bekleniyor' : 'yok'}</span></div>
    </div>
  </header>`;
}

function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => { app.toast = (msg, kind = 'ok', ms = 3200) => { const id = Math.random(); setList((l) => [...l.slice(-3), { id, msg, kind }]); setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), ms); }; }, []);
  return html`<div class="toasts" role="status" aria-live="polite">${list.map((t) => html`<div class=${'toast ' + t.kind} onClick=${() => setList((l) => l.filter((x) => x.id !== t.id))}>${t.msg}</div>`)}</div>`;
}

function Modals() {
  const [m, setM] = useState(null);
  useEffect(() => {
    app.modal = (render) => new Promise((resolve) => setM({ render, resolve }));
    app.confirm = (title, text, opts = {}) => app.modal((close) => html`<div class="mh"><h3>${title}</h3></div><div class="mb"><div class="note" style="font-size:14px">${text}</div></div><div class="mf"><button class="btn grow" onClick=${() => close(false)}>Vazgeç</button><button class=${'btn grow ' + (opts.danger ? 'dang' : 'pri')} onClick=${() => close(true)}>${opts.ok || 'Tamam'}</button></div>`);
    app.prompt = (title, label, opts = {}) => app.modal((close) => { let v = opts.value || ''; return html`<div class="mh"><h3>${title}</h3></div><div class="mb"><div class="fld"><label>${label}</label><input class="inp" autofocus value=${v} placeholder=${opts.placeholder || ''} onInput=${(e) => { v = e.target.value; }} /></div>${opts.note ? html`<div class="note">${opts.note}</div>` : null}</div><div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn pri grow" onClick=${() => close(v.trim() || (opts.required ? null : ''))}>${opts.ok || 'Kaydet'}</button></div>`; });
  }, []);
  if (!m) return null;
  const close = (v) => { setM(null); m.resolve(v); };
  return html`<div class="modal-bg" onClick=${(e) => { if (e.target === e.currentTarget) close(null); }}><div class="modal" role="dialog">${m.render(close)}</div></div>`;
}

export function App() {
  const [stack, setStack] = useState([{ name: app.ps.p ? 'map' : 'projects', params: {} }]);
  const [tab, setTab] = useState(app.ps.p ? 'map' : null);
  useBus(['project:open']);
  useEffect(() => {
    app.nav = {
      go: (name, params = {}) => setStack((s) => [...s, { name, params }]),
      replace: (name, params = {}) => setStack((s) => [...s.slice(0, -1), { name, params }]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      tab: (name, params = {}) => { setTab(name); setStack([{ name, params }]); },
      depth: () => stack.length
    };
    window.__voltBack = () => { if (app.backHook && app.backHook()) return true; let handled = false; setStack((s) => { if (s.length > 1) { handled = true; return s.slice(0, -1); } return s; }); return handled; };
  });
  const top = stack[stack.length - 1];
  const S = SCREENS[top.name] || SCREENS.projects;
  const flush = S.flush;
  const noHud = S.noHud;
  return html`<div id="app">
    ${noHud ? null : html`<${Hud} compact=${S.compactHud} />`}
    <main class=${'screen' + (flush ? ' flush' : '')} key=${top.name + stack.length}><${S} ...${top.params} /></main>
    ${S.noTabs ? null : html`<nav class="tabbar" aria-label="Ana menü">${TABS.map(([k, l, ic]) => html`<button class=${tab === k ? 'on' : ''} aria-current=${tab === k ? 'page' : null} onClick=${() => { if (!app.ps.p && k !== 'settings') { app.toast('Önce bir proje açın', 'warn'); return; } app.nav.tab(k); }}><${Icon} n=${ic} s=${22} />${l}</button>`)}</nav>`}
    <${Toasts} /><${Modals} />
  </div>`;
}
