// UI yapı taşları (Preact + htm). İş kuralı içermez; yalnız görünüm ve etkileşim.
import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import htm from 'htm';
import { app } from './ctx.js';
export const html = htm.bind(h);
export { useState, useEffect, useRef, useCallback };

// Olay yolu aboneliği → yeniden çizim (isteğe bağlı kısma)
export function useBus(events, throttleMs = 0) {
  const [, set] = useState(0);
  useEffect(() => {
    let t = 0, pend = null;
    const fire = () => { t = Date.now(); set((x) => x + 1); };
    const fn = () => {
      if (!throttleMs) return fire();
      const d = Date.now() - t;
      if (d >= throttleMs) fire(); else if (!pend) pend = setTimeout(() => { pend = null; fire(); }, throttleMs - d);
    };
    const offs = [].concat(events).map((e) => app.bus.on(e, fn));
    return () => { offs.forEach((o) => o()); if (pend) clearTimeout(pend); };
  }, [String(events)]);
}

const P = {
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  target: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  calc: 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M8 6h8 M8 10h.01 M12 10h.01 M16 10h.01 M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01 M16 18h.01',
  share: 'M12 3v12 M7 8l5-5 5 5 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  bt: 'm7 7 10 10-5 5V2l5 5L7 17',
  layers: 'm12 2 10 5-10 5L2 7z M2 17l10 5 10-5 M2 12l10 5 10-5',
  ruler: 'M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0z M14.5 12.5l2-2 M11.5 9.5l2-2 M8.5 6.5l2-2 M17.5 15.5l2-2',
  cross: 'M12 2v4 M12 18v4 M2 12h4 M18 12h4 M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z M12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  plus: 'M12 5v14 M5 12h14', minus: 'M5 12h14', x: 'M18 6 6 18 M6 6l12 12', check: 'm5 12 5 5 9-10',
  back: 'm15 18-6-6 6-6', next: 'm9 18 6-6-6-6', down: 'm6 9 6 6 6-6', up: 'm18 15-6-6-6 6',
  locate: 'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z', trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v10H5z', info: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 16v-4 M12 8h.01',
  warn: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3 M12 9v4 M12 17h.01',
  folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
  sync: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16 M16 16h5v5',
  split: 'M16 3h5v5 M8 3H3v5 M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3 M15 9l6-6', merge: 'm8 6 4-4 4 4 M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22 M20 22l-5-5',
  reverse: 'M7 16V4 M3 8l4-4 4 4 M17 8v12 M21 16l-4 4-4-4', pole: 'M12 2v20 M6 6h12 M8 22h8 M8 10h8', note: 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
  grid: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18', list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  history: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M12 7v5l4 2', undo: 'M3 7v6h6 M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
  star: 'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', search: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M21 21l-4.3-4.3',
  zin: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M21 21l-4.3-4.3 M11 8v6 M8 11h6', zout: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M21 21l-4.3-4.3 M8 11h6',
  north: 'M12 2 L19 21 L12 17 L5 21 Z', pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0', skip: 'M6 4v16 M18 4l-10 8 10 8z'
};
export function Icon({ n, s = 20, c = 'currentColor', w = 2, fill = 'none' }) {
  return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill=${fill} stroke=${c} stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[n] || P.info} /></svg>`;
}
export function Chip({ on, onClick, children, c, fill, disabled, title }) {
  return html`<button type="button" class=${'chip' + (on ? ' on' : '') + (fill ? ' fill' : '')} style=${c ? '--c:' + c : ''} aria-pressed=${on ? 'true' : 'false'} onClick=${onClick} disabled=${disabled} title=${title}>${children}</button>`;
}
export function Seg({ value, options, onChange, c }) {
  return html`<div class="seg">${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<${Chip} on=${value === v} c=${c} onClick=${() => onChange(v)}>${l}</${Chip}>`; })}</div>`;
}
export function Toggle({ on, onChange, label }) { return html`<button type="button" class=${'tog' + (on ? ' on' : '')} role="switch" aria-checked=${on ? 'true' : 'false'} aria-label=${label} onClick=${() => onChange(!on)}></button>`; }
export function Field({ label, children, hint }) { return html`<div class="fld"><label>${label}</label>${children}${hint ? html`<span class="note">${hint}</span>` : null}</div>`; }
export function Sel({ value, onChange, options, mono, disabled }) {
  return html`<select class=${'inp' + (mono ? ' mono' : '')} value=${value ?? ''} disabled=${disabled} onChange=${(e) => onChange(e.target.value)}>${options.map((o) => { if (o && o.group) return html`<optgroup label=${o.group}>${o.options.map((x) => html`<option value=${x[0]}>${x[1]}</option>`)}</optgroup>`; const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<option value=${v}>${l}</option>`; })}</select>`;
}
export function Num({ value, onChange, step = 0.001, mono = true, placeholder, unit }) {
  return html`<div class="row" style="gap:6px"><input class=${'inp' + (mono ? ' mono' : '')} type="number" inputmode="decimal" step=${step} value=${value ?? ''} placeholder=${placeholder} onChange=${(e) => onChange(e.target.value === '' ? null : +e.target.value)} />${unit ? html`<span class="note mono">${unit}</span>` : null}</div>`;
}
export function Txt({ value, onChange, placeholder, mono }) { return html`<input class=${'inp' + (mono ? ' mono' : '')} value=${value ?? ''} placeholder=${placeholder} onChange=${(e) => onChange(e.target.value)} />`; }
export function Stepper({ value, onChange, min = 0, step = 1 }) {
  return html`<div class="stepper"><button type="button" onClick=${() => onChange(Math.max(min, +(value - step).toFixed(3)))}>−</button><span>${value}</span><button type="button" onClick=${() => onChange(+(value + step).toFixed(3))}>+</button></div>`;
}
/**
 * Yazarken ekran yenilense de silinmeyen alan: yazılan taslak bileşende tutulur, odaktan çıkınca (ya da Enter'da)
 * onSave ile kaydedilir. (value + onChange alanları, ekran saniyede birkaç kez yenilenince yazılanı geri alıyordu.)
 */
export function Girdi({ value, onSave, cls = 'inp mono', ...rest }) {
  const [taslak, setTaslak] = useState(null);
  const yazili = value === null || value === undefined ? '' : String(value);
  return html`<input class=${cls} ...${rest} value=${taslak !== null ? taslak : yazili} onInput=${(e) => setTaslak(e.target.value)} onBlur=${(e) => { const v = e.target.value; setTaslak(null); if (v !== yazili) onSave(v); }} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); }} />`;
}
export function Badge({ k = 'mut', children }) { return html`<span class=${'badge b-' + k}>${children}</span>`; }
export function Title({ title, sub, back = true, right }) {
  if (app.web && (app.state.depth || 1) <= 1) back = false;   // web: menüden açılan ekranda geri düğmesi olmaz
  return html`<div class="title">${back ? html`<button class="backbtn" aria-label="Geri" onClick=${() => app.nav.back()}><${Icon} n="back" /></button>` : null}<div class="grow"><h1>${title}</h1>${sub ? html`<div class="sub">${sub}</div>` : null}</div>${right}</div>`;
}
export function Stat({ label, value, unit, color }) { return html`<div class="stat"><b>${label}</b><span style=${color ? 'color:' + color : ''}>${value}</span>${unit ? html`<small>${unit}</small>` : null}</div>`; }
export function Empty({ children }) { return html`<div class="empty">${children}</div>`; }

export const fmt = (v, d = 3) => (v === null || v === undefined || !Number.isFinite(+v) ? '—' : (+v).toFixed(d));
export const trn = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(+v) ? '—' : (+v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const CODE_KIND = { 'UYUMSUZ': 'err', 'EKSİK VERİ': 'warn', 'ÖLÇÜ KABUL EDİLMEDİ': 'err', 'MALZEME EKSİK': 'warn', 'UYARI': 'mut' };
export const FIXCOL = { FIX: '#10b981', FLOAT: '#f59e0b', SINGLE: '#ef4444', DGPS: '#f97316', NONE: '#475569', PHONE: '#38bdf8', SBAS: '#ef4444' };
