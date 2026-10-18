// AutoCAD / PROMAGIS alanları: kaydın PROMAGIS durum kodu (M, M+M, KM, DM, DM+M, MEVCUT, ENH, ME) ve demontaj türü
// (KESİK / SÖKÜK). Telefondaki durumla uyuşan kodlar listelenir; seçilmezse dışa aktarımda durumdan üretilir.
import { html, Sel, Seg } from './kit.js';
import ESLESME from '../ortak/volt-eslesme.js';
import { promagisSecenekleri } from '../interop/sebeke.js';

export function PromagisDurum({ d, set, setA, trafo }) {
  const sec = promagisSecenekleri(d.state, !!trafo);
  if (!sec.length) return null;
  const cur = d.sebeke && d.sebeke.durum && sec.some(([k]) => k === d.sebeke.durum) ? d.sebeke.durum : '';
  const oto = (ESLESME.durumlar[d.state] || 'MEVCUT') + (d.state === 'YENI' || d.state === 'yeni' ? ' ya da M+M (tedarike göre)' : '');
  const setS = (v) => set({ sebeke: Object.assign({}, d.sebeke || {}, { durum: v || undefined }) });
  const dm = ['DEMONTAJ', 'DMM', 'demontaj', 'tasinan'].includes(d.state);
  return html`<div class="grid2">
    <div class="fld"><label>PROMAGIS durumu (AutoCAD)</label><${Sel} value=${cur} options=${[['', 'Otomatik · ' + oto], ...sec]} onChange=${(v) => setS(v)} /></div>
    ${dm && setA ? html`<div class="fld"><label>Demontaj türü</label><${Seg} value=${(d.attrs || {}).dmDurum || ''} options=${ESLESME.dmDurumlari.map((k) => [k, k || '—'])} onChange=${(v) => setA({ dmDurum: v })} /></div>` : null}
  </div>`;
}
