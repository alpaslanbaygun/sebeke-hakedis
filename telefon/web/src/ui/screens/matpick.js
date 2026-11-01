// Katalogdan malzeme seçme kutusu (ekipman ve hat kayıtlarında ortak)
import { html, useState } from '../kit.js';
import { app } from '../ctx.js';

export function MaterialPicker({ job, onAdd, hint }) {
  const cat = app.ps.cat;
  const [q, setQ] = useState('');
  const hits = cat.searchPoz(q, { job: job || 'montaj', limit: 40 }).filter((x) => !x.isKgGroup);
  return html`<div class="card stack"><div class="lbl">Katalogdan seç</div>
    <input class="inp" value=${q} placeholder=${hint || 'ad ya da poz no: kum, bant, izolatör, 011.04…'} onInput=${(e) => setQ(e.target.value)} />
    <div class="list">${hits.slice(0, 12).map((x) => html`<div class="li" style="padding:8px 0"><div class="grow"><div style="font-size:13px;font-weight:600">${x.name}</div><div class="m">${x.servis} · ${x.unit}${x.kgPerUnit ? ' · ' + x.kgPerUnit + ' kg' : ''}</div></div><button class="btn sm" style="border-color:#f59e0b;color:#fcd34d" onClick=${() => onAdd(x.servis)}>Ekle</button></div>`)}</div>
    <div class="note">${hits.length} sonuç${q ? '' : ' · aramak için yazın'}. Listede yoksa: Ayarlar › Veri ve kullanıcılar › Poz kataloğu › Kalem ekle.</div></div>`;
}
