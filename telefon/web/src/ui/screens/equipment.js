// 03 · Ekipman Kaydı (Direk · Trafo · SDK · Aydınlatma · Abone · Menhol)
// Reçete otomatik; kullanıcı yalnız miktar değiştirir (gerekçeli) ya da "sahada ilave" açar (ayrı işaretli, onaylı).
import { html, useState, useEffect, useBus, Icon, Chip, Seg, Sel, Badge, Title, Toggle, fmt, trn, CODE_KIND } from '../kit.js';
import { HakRow, HakHistory } from './team.js';
import { app } from '../ctx.js';
import { STATUSES, TRAFO_STATUSES, JOB_LABEL, SOURCE_LABEL, HAK_STATUSES, HAK_ORDER, KIND_FOLDER, hakOf } from '../../core/schema.js';
import { sourceInfo, sourceText } from '../../core/source.js';
import { KABIN_POSTLARI } from './cabin.js';
import { autoRecipeOn } from '../../grid/recipe.js';
import { koskGovdeleri } from '../../grid/cabin-recipe.js';
import { luminairePoz } from '../../services/survey-service.js';
import { checkPole, checkTransformer, roleLabel } from '../../grid/checks.js';
import { jobOf } from '../../grid/recipe.js';
import { dms } from '../../geo/geom.js';
import { eqSummary } from './map.js';
import { CizimDurum } from '../durum-kodu.js';

const KIND_TITLE = { pole: 'Direk Kaydı', lighting: 'Aydınlatma Direği', transformer: 'Trafo Kaydı', sdk: 'SDK / Box Kaydı', subscriber: 'Abone Kaydı', manhole: 'Menhol Kaydı', kiosk: 'Köşk Kaydı', substation: 'Dağıtım Merkezi', panel: 'Pano Kaydı', luminaire: 'Armatür Kaydı', other: 'Obje Kaydı' };
const SLOTS = { panel: ['Ön', 'İç', 'Etiket', 'Çevre'], luminaire: ['Genel', 'Etiket'], pole: ['Taban', 'Gövde', 'Tepe', 'Çevre'], transformer: ['Plaka', 'Genel', 'Pano', 'Topraklama'], sdk: ['Ön', 'İç', 'Sigorta', 'Çevre'] };

// Teknik hesapların açılabildiği ekipman türleri → hesap hedefi
const HESAP_TURU = { pole: 'direk', lighting: 'direk', transformer: 'trafo', kiosk: 'trafo', substation: 'trafo' };

export function EquipmentScreen({ id }) {
  useBus(['project:computed']);
  const ps = app.ps, cat = ps.cat;
  const e0 = ps.eqById(id);
  const [d, setD] = useState(() => (e0 ? JSON.parse(JSON.stringify(e0)) : null));
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState('');
  const [thumbs, setThumbs] = useState({});
  const [hist, setHist] = useState([]);
  useEffect(() => { if (e0) ps.ds.auditFor(e0.id).then((a) => setHist(a.reverse().slice(0, 12))); }, [e0 && e0.rev]);
  const photos = ps.data.photos.filter((p) => p.ownerId === id);
  useEffect(() => { (async () => { const t = {}; for (const ph of photos) { const b = await ps.photoBytes(ph); if (b) t[ph.id] = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); } setThumbs(t); })(); }, [photos.length]);
  if (!e0 || !d) return html`<${Title} title="Kayıt bulunamadı" />`;
  const p = ps.pointById(e0.pointId) || {};
  const ri = ps.result.roles.get(id) || {};
  const mats = ps.result.matsByEq.get(id) || { items: [], job: null };
  const set = (patch) => setD((x) => Object.assign({}, x, patch));
  const setA = (patch) => setD((x) => Object.assign({}, x, { attrs: Object.assign({}, x.attrs, patch) }));
  const dirty = JSON.stringify(d) !== JSON.stringify(e0);
  const draftIssues = d.kind === 'pole' || d.kind === 'lighting' ? checkPole(d, cat, Object.assign({}, ri, { role: d.roleManual || ri.autoRole })) : d.kind === 'transformer' ? checkTransformer(d, cat) : [];
  const liveIssues = ps.result.issues.filter((i) => i.entityId === id || i.pointId === e0.pointId);
  const save = async () => {
    let reason = '';
    const errs = draftIssues.filter((i) => i.severity === 'error');
    if (errs.length) { reason = await app.prompt('Uyumsuz kayıt', 'Gerekçe (zorunlu)', { required: true, note: errs.map((x) => x.code + ': ' + x.message).join(' · ') }); if (!reason) return; }
    const { id: _i, createdAt, updatedAt, rev, createdBy, updatedBy, ...patch } = d;
    await ps.updateEquipment(id, patch, reason || 'Kayıt güncellendi');
    app.toast(d.no + ' kaydedildi' + (ps.lastImpact ? ' · ' + ps.lastImpact.quantities + ' metraj satırı güncellendi' : ''));
  };
  const job = jobOf(d);
  const isPole = d.kind === 'pole' || d.kind === 'lighting';
  const t = isPole ? cat.poleType(d.typeId) : null;
  const g = isPole ? cat.poleGroup(d.group) : null;
  const lines = ps.data.lines.filter((l) => l.nodes.includes(e0.pointId));
  const autoN = mats.items.filter((m) => m.origin === 'OTO').length, manN = mats.items.length - autoN;
  const changeQty = async (m) => {
    const v = await app.prompt('Miktar · ' + m.name, 'Yeni miktar (' + m.unit + ') · reçete: ' + (m.autoQty ?? m.qty), { value: String(m.qty), required: true, note: 'Reçete kalemi değiştirilemez; yalnız miktar düzeltilir ve denetim kaydına yazılır. Boş bırakmak için 0 girin.' });
    if (v === null) return;
    const why = await app.prompt('Gerekçe', 'Neden değişti?', { required: true, value: 'Sahada farklı uygulandı' });
    if (!why) return;
    await ps.setMaterialQty(id, m.servis, +String(v).replace(',', '.'), why);
  };
  const resetQty = async (m) => { await ps.setMaterialQty(id, m.servis, null, 'Reçete miktarına dönüldü'); };
  const auto = autoRecipeOn(ps.p);
  const num = (v) => +String(v).replace(',', '.');
  const addManual = async (servis) => {
    const pz = cat.poz(servis);
    const v = await app.prompt((auto ? 'Sahada ilave · ' : 'Malzeme ekle · ') + (pz ? pz.name : servis), 'Miktar (' + (pz ? pz.unit : 'Ad') + ')', { value: '1', required: true });
    if (!v) return;
    try {
      if (auto) { const why = await app.prompt('Gerekçe', 'Neden ilave?', { required: true, value: '' }); if (!why) return; await ps.addFieldMaterial(id, servis, num(v), why); }
      else { await ps.addMaterial('equipment', id, servis, num(v)); app.toast((pz ? pz.name : servis) + ' eklendi', 'ok'); }
    } catch (err) { app.toast(err.message, 'err', 6000); }
    setPick(false);
  };
  const manualQty = async (m) => {
    const v = await app.prompt('Miktar · ' + m.name, 'Yeni miktar (' + m.unit + ')', { value: String(m.qty), required: true });
    if (!v) return;
    try { await ps.setMaterialRowQty(m.materialId, num(v)); } catch (err) { app.toast(err.message, 'err'); }
  };
  const hits = pick ? cat.searchPoz(q, { job: job || 'montaj', limit: 40 }).filter((x) => !x.isKgGroup) : [];
  const slots = SLOTS[d.kind] || ['Genel', 'Detay', 'Çevre', 'Ek'];
  const ydRows = [];
  const byGrp = new Map();
  for (const m of mats.items) {
    const jb = m.jobOverride || mats.job; if (!jb) continue;
    if (m.grp) { const k = jb + m.grp; const x = byGrp.get(k) || { job: jb, grp: m.grp, kg: 0, subs: [], src: new Set() }; x.kg += (m.kgPer || 0) * m.qty; x.subs.push(m); x.src.add(m.origin === 'OTO' ? 'O' : 'M'); byGrp.set(k, x); }
    else ydRows.push({ code: cat.jobCode(m.servis || '', jb), name: m.name, qty: m.qty, unit: m.unit, src: m.origin === 'OTO' ? 'O' : 'M', ok: m.servis ? cat.pozAvailable(m.servis, jb) : false });
  }
  const grpRows = [...byGrp.values()].map((x) => ({ code: cat.jobCode(x.grp, x.job), name: (cat.poz(x.grp) || { name: x.grp }).name, qty: Math.round(x.kg * 100) / 100, unit: 'Kg', src: [...x.src].join('+'), ok: cat.pozAvailable(x.grp, x.job), subs: x.subs }));
  const si = sourceInfo(p);
  const src = '[' + si.tag + '] ' + sourceText(p);
  const hk = hakOf(d);
  const free = ['panel', 'luminaire', 'other', 'manhole'].includes(d.kind);
  const freePoz = free ? (d.kind === 'luminaire' ? luminairePoz(cat) : d.kind === 'panel' ? (cat.t.panels || []).map((x) => ({ servis: x.servis, name: (x.kind === 'harici' ? 'Harici' : 'Dahili') + ' pano · ' + x.kva + ' kVA' })) : []) : [];
  return html`
    <${Title} title=${KIND_TITLE[d.kind] || 'Ekipman'} sub=${d.no + ' · ' + new Date(e0.createdAt).toLocaleString('tr-TR')} right=${HESAP_TURU[d.kind] ? html`<button class="btn sm" title="Bu ${HESAP_TURU[d.kind] === 'direk' ? 'direk' : 'trafo'} için teknik hesaplar" onClick=${() => app.nav.go('hesapMerkezi', { hedef: { tur: HESAP_TURU[d.kind], id } })}><${Icon} n="calc" s=${16} />Hesaplar</button>` : null} />
    <div class="card">
      <div class="row"><${Icon} n="lock" s=${14} c="#94a3b8" /><span class="lbl grow">Konum · ${p.pointNo || '—'}</span><button class="btn sm" onClick=${() => app.nav.go('point', { id: e0.pointId })}>Nokta kaydı</button></div>
      <div class="grid3" style="margin:8px 0"><div><div class="lbl">Y (sağa)</div><div class="num">${fmt(p.E)}</div></div><div><div class="lbl">X (yukarı)</div><div class="num">${fmt(p.N)}</div></div><div><div class="lbl">Z (kot)</div><div class="num">${p.H != null ? fmt(p.H) : 'bilinmiyor'}</div></div></div>
      <div class="kv" style="font-size:13px"><b>Veri kaynağı</b><span style=${'color:' + si.color}>${src}</span>
        ${p.measuredAt || p.device ? html`<b>Ölçüm</b><span>${p.measuredAt ? new Date(p.measuredAt).toLocaleString('tr-TR') : '—'}${p.device ? ' · ' + p.device : ''}${p.operator ? ' · ' + p.operator : ''}</span>` : null}
        <b>Özet</b><span>${eqSummary(e0)}</span>
        ${isPole ? html`<b>Rol</b><span class="hw">${roleLabel(ri.role)}${ri.angle ? ' · α ' + dms(ri.angle) + ' ' + ri.side : ''}${ri.manual ? ' (elle)' : ' (otomatik)'}</span><b>Gerekçe</b><span class="note">${ri.why || '—'}</span>` : null}
        <b>Bağlı hat</b><span>${lines.map((l) => l.lineNo + ' ' + l.lineType).join(', ') || '—'}</span>
        <b>İş</b><span>${job ? JOB_LABEL[job] + ' sayfası (' + { montaj: '0', demontaj: '1', dmm: '2' }[job] + 'xx)' : 'Hakedişe girmez'}</span></div>
    </div>
    ${liveIssues.map((i) => html`<div class=${'alert ' + (i.severity === 'error' ? 'err' : 'warn')}><${Badge} k=${CODE_KIND[i.code] || 'mut'}>${i.code}</${Badge}><span>${i.message}${i.suggestTypeId ? html` <button class="btn xs" onClick=${() => set({ typeId: i.suggestTypeId })}>Öneriyi uygula</button>` : null}</span></div>`)}

    <div class="sect">Tanım</div>
    <div class="card stack">
      <div class="grid2"><div class="fld"><label>No</label><input class="inp mono" value=${d.no} onChange=${(e) => set({ no: e.target.value })} /></div>
      <div class="fld"><label>Durum</label><${Sel} value=${d.state} options=${Object.entries(d.kind === 'transformer' ? TRAFO_STATUSES : STATUSES).map(([k, v]) => [k, v.label])} onChange=${(v) => set({ state: v })} /></div></div>
      <${CizimDurum} d=${d} set=${set} setA=${setA} trafo=${d.kind === 'transformer'} />
      ${isPole ? html`<div class="fld"><label>Direk grubu</label><${Sel} value=${d.group} options=${cat.poleGroups().map((x) => [x.id, x.label])} onChange=${(v) => set({ group: v, typeId: (cat.poleTypes(v)[0] || {}).id })} /></div>
        <div class="fld"><label>Direk tipi</label><${Sel} mono value=${d.typeId} options=${cat.poleTypes(d.group).map((x) => [x.id, x.name + (x.kg ? ' · ' + x.kg + ' kg' : '') + (x.heightM ? ' · ' + x.heightM + ' m' : '')])} onChange=${(v) => set({ typeId: v })} /></div>
        <div class="fld"><label>Rol</label><div class="seg">${[['', 'Otomatik'], ['T', 'Taşıyıcı'], ['D', 'Durdurucu'], ['N', 'Nihayet'], ['Z', 'Köşe']].map(([k, l]) => html`<${Chip} on=${(d.roleManual || '') === k} onClick=${() => set({ roleManual: k || null })}>${l}</${Chip}>`)}</div></div>
        <div class="grid2"><div class="fld"><label>Boy (m)</label><input class="inp mono" type="number" step="0.1" value=${(d.attrs || {}).heightM ?? (t ? t.heightM : '')} onChange=${(e) => setA({ heightM: e.target.value === '' ? null : +e.target.value })} /></div><div class="fld"><label>İletken bağlantı yük. (m)</label><input class="inp mono" type="number" step="0.1" placeholder="otomatik" value=${(d.attrs || {}).attachH ?? ''} onChange=${(e) => setA({ attachH: e.target.value === '' ? null : +e.target.value })} /></div></div>
        ${(() => { const arm = ((d.attrs || {}).armatur || [])[0] || null; const lums = luminairePoz(cat); return html`<div class="row" style="align-items:flex-end"><div class="fld grow"><label>Armatür (direğin malzemesi)</label><${Sel} value=${arm ? arm.servis : ''} options=${[['', 'Armatür yok'], ...lums.map((x) => [x.servis, x.name]), ...(arm && !lums.some((x) => x.servis === arm.servis) ? [[arm.servis, (cat.poz(arm.servis) || {}).name || arm.servis]] : [])]} onChange=${(v) => setA({ armatur: v ? [{ servis: v, qty: arm ? arm.qty : 1 }] : [] })} /></div>
          ${arm ? html`<div class="fld" style="width:84px"><label>Adet</label><input class="inp mono" type="number" min="1" step="1" value=${arm.qty} onChange=${(e) => setA({ armatur: [{ servis: arm.servis, qty: Math.max(1, +e.target.value || 1) }] })} /></div>` : null}</div>`; })()}` : null}
      ${d.kind === 'transformer' ? html`<div class="grid2"><div class="fld"><label>Posta tipi</label><${Sel} value=${d.attrs.post} options=${cat.postTypes().map((x) => [x.id, x.label])} onChange=${(v) => setA({ post: v })} /></div>
        <div class="fld"><label>Güç (kVA)</label><input class="inp mono" type="number" value=${d.attrs.kva ?? ''} onChange=${(e) => setA({ kva: +e.target.value })} /></div>
        <div class="fld"><label>Cins</label><${Sel} value=${d.attrs.cins || 'herm'} options=${[['herm', 'Hermetik'], ['kuru', 'Kuru tip']]} onChange=${(v) => setA({ cins: v })} /></div>
        <div class="fld"><label>Gerilim</label><input class="inp mono" value=${d.attrs.voltage || '34.5/0.4 kV'} onChange=${(e) => setA({ voltage: e.target.value })} /></div>
        <div class="fld"><label>Faz</label><${Sel} value=${d.attrs.phase || '3'} options=${[['3', '3 faz'], ['1', '1 faz']]} onChange=${(v) => setA({ phase: v })} /></div>
        <div class="fld"><label>Seri no</label><input class="inp mono" value=${d.attrs.serial || ''} onChange=${(e) => setA({ serial: e.target.value })} /></div>
        <div class="fld"><label>Üretici</label><input class="inp" value=${d.attrs.maker || ''} onChange=${(e) => setA({ maker: e.target.value })} /></div>
        <div class="fld"><label>Eski güç (kVA)</label><input class="inp mono" type="number" value=${d.attrs.oldKva ?? ''} onChange=${(e) => setA({ oldKva: e.target.value ? +e.target.value : null })} /></div></div>
        ${d.attrs.post === 'direk' ? html`<div class="fld"><label>Trafo direği</label><${Sel} mono value=${d.attrs.poleTypeId} options=${cat.poleTypes('trafo').map((x) => [x.id, x.name + ' · ' + x.kg + ' kg'])} onChange=${(v) => setA({ poleTypeId: v })} /></div>` : null}
        ${(() => { const gl = koskGovdeleri(cat, d.attrs.post); if (!gl.length) return null; const cur = d.attrs.govde; return html`<div class="fld"><label>Köşk tipi</label><${Sel} value=${cur || ''} options=${[['', d.attrs.post === 'mono' && cur === undefined ? 'Otomatik (TİP-1C)' : 'Köşk kalemi yok'], ...gl.map((x) => [x.servis, x.ad]), ...(cur && !gl.some((x) => x.servis === cur) ? [[cur, (cat.poz(cur) || {}).name || cur]] : [])]} onChange=${(v) => setA({ govde: v || null })} /></div>`; })()}
        ${KABIN_POSTLARI.includes(d.attrs.post) || d.attrs.cabin ? html`<button class=${'btn blk' + (d.attrs.cabin ? '' : ' pri')} style="height:52px" onClick=${() => app.nav.go('cabin', { id })}><${Icon} n="grid" s=${18} c=${d.attrs.cabin ? 'currentColor' : '#0b1326'} />${d.attrs.cabin ? 'Kabin: ' + d.attrs.cabin.hucreler.length + ' hücre · ' + (d.attrs.cabin.kanallar || []).length + ' kanal · düzenle' : 'Kabin · hücre ve kablo kanalı ekle'}</button>
          <div class="note">Köşk hücresiz gelir. Hücreleri ve kablo kanallarını Kabin ekranında siz eklersiniz; eklediğiniz her hücre keşfe ayrı kalem olarak yazılır.</div>` : null}
        ${(['mrmu', 'ind'].includes(d.attrs.post) || (d.attrs.kioskServis && ['mbk', 'rbk'].includes(d.attrs.post))) && !d.attrs.cabin ? html`<div class="fld"><label>${['mbk', 'rbk'].includes(d.attrs.post) ? 'Hazır köşk paketi (eski kayıt)' : 'Köşk / hücre kodu'}</label><${Sel} mono value=${d.attrs.kioskServis || ''} options=${[...(['mbk', 'rbk'].includes(d.attrs.post) ? [['', 'Paket yok · köşk tipini kullan']] : []), ...cat.t.kiosks.map((k) => [k.servis, k.label])]} onChange=${(v) => setA({ kioskServis: v || null })} /></div>` : null}` : null}
      ${d.kind === 'sdk' ? html`<div class="grid2"><div class="fld"><label>SDK tipi</label><${Sel} value=${d.attrs.sdkTypeId} options=${cat.sdkTypes().map((s) => [s.id, s.name])} onChange=${(v) => setA({ sdkTypeId: v })} /></div><div class="fld"><label>Çıkış sayısı</label><input class="inp mono" type="number" value=${d.attrs.outputs ?? 4} onChange=${(e) => setA({ outputs: +e.target.value })} /></div></div>
        <div class="fld"><label>Sigortalar (virgülle)</label><input class="inp mono" value=${(d.attrs.fuses || []).join(', ')} placeholder="3×100 A NH, 3×63 A NH" onChange=${(e) => setA({ fuses: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></div>
        <div class="note">Besleyen hat: ${lines.filter((l) => l.lineType === 'AG').map((l) => l.lineNo).join(', ') || 'yok'} · Bağlı abone: ${ps.data.lines.filter((l) => l.lineType === 'ABONE' && l.nodes[0] === e0.pointId).length}</div>` : null}
      ${free ? html`<div class="fld"><label>${d.kind === 'other' ? 'Obje adı / türü' : 'Tip açıklaması'}</label><input class="inp" value=${d.attrs.typeName || ''} onChange=${(e) => setA({ typeName: e.target.value })} /></div>
        <div class="fld"><label>Poz (hakediş kalemi)</label>${freePoz.length ? html`<${Sel} value=${d.attrs.servis || ''} options=${[['', 'Seçilmedi'], ...freePoz.map((x) => [x.servis, x.name]), ...(d.attrs.servis && !freePoz.some((x) => x.servis === d.attrs.servis) ? [[d.attrs.servis, (cat.poz(d.attrs.servis) || {}).name || d.attrs.servis]] : [])]} onChange=${(v) => setA({ servis: v || null })} />` : html`<input class="inp mono" value=${d.attrs.servis || ''} placeholder="servis kodu (ör. 020.05.01.01-003) · boş bırakılabilir" onChange=${(e) => setA({ servis: e.target.value.trim() || null })} />`}</div>
        ${d.kind === 'panel' ? html`<div class="fld"><label>Güç (kVA)</label><input class="inp mono" type="number" value=${d.attrs.kva ?? ''} onChange=${(e) => setA({ kva: e.target.value ? +e.target.value : null })} /></div>` : null}
        <div class="note">Bu türün otomatik reçetesi yok: poz seçilirse 1 adet olarak metraja girer; ek malzeme aşağıdan "Sahada ilave" ile eklenir.</div>` : null}
      ${d.kind === 'subscriber' ? html`<div class="grid2"><div class="fld"><label>Faz</label><${Sel} value=${d.attrs.phase || 'uc'} options=${[['tek', 'Tek faz'], ['uc', 'Üç faz']]} onChange=${(v) => setA({ phase: v })} /></div><div class="fld"><label>Abone no</label><input class="inp mono" value=${d.attrs.aboneNo || ''} onChange=${(e) => setA({ aboneNo: e.target.value })} /></div></div>
        <div class="fld"><label>Kofre</label><${Seg} value=${d.attrs.kofre ? 'var' : 'yok'} options=${[['yok', 'Kofre yok'], ['var', 'Kofre var']]} onChange=${(v) => setA({ kofre: v === 'var' })} /><span class="note">Kofre varsa faz sayısına göre kofre kalemi keşfe ve hakedişe gelir.</span></div>` : null}
      ${hk ? html`<div class="fld"><label>Hakediş durumu · <span style=${'color:' + HAK_STATUSES[hk].color}>${HAK_STATUSES[hk].label}</span></label>
        ${ps.approval().on ? html`<${HakRow} type="equipment" rec=${e0} noLabel=${true} onDone=${(r) => r && set({ hak: r.hak, progress: r.progress, workDate: r.workDate, hakLog: r.hakLog })} />` : html`<div class="hakrow">${HAK_ORDER.map((k) => html`<button class=${k === hk ? 'on' : ''} style=${'--c:' + HAK_STATUSES[k].color} onClick=${() => set({ hak: k, progress: HAK_STATUSES[k].done ? 'done' : 'planned', workDate: HAK_STATUSES[k].done ? (d.workDate || new Date().toISOString().slice(0, 10)) : null })}><i></i>${HAK_STATUSES[k].short}</button>`)}</div>`}</div>
        <${HakHistory} rec=${e0} />
        <div class="note">"Tamamlandı" ve sonrası durumlar metraja ve hakediş kümülatifine girer. Dönem açılınca "Hakedişe Girdi", onaylanınca "Hakediş Onaylandı" olur.</div>` : html`<div class="note">Hakediş: — (mevcut / ileride durumundaki objenin iş kalemi yok)</div>`}
      ${d.progress === 'done' && hk ? html`<div class="fld"><label>Montaj / iş tarihi</label><input class="inp mono" type="date" value=${d.workDate || ''} onChange=${(e) => set({ workDate: e.target.value })} /></div>` : null}
    </div>
    ${draftIssues.length && dirty ? html`<div class="stack">${draftIssues.map((i) => html`<div class=${'alert ' + (i.severity === 'error' ? 'err' : 'warn')}><b>${i.code}</b> ${i.message}</div>`)}</div>` : null}

    <div class="sect">Malzemeler <span class="r">${auto ? html`<span class="hl">${autoN} otomatik</span> · <span class="hw">${manN} manuel</span>` : html`<span class="hl">${autoN} seçilen</span> · <span class="hw">${manN} eklenen</span>`}</span></div>
    <div class="card" style="padding:10px 12px"><div class="row"><span class="grow" style="font-size:13px">Tanım: ${isPole ? (g ? g.short : '') + ' · ' + (t ? t.name : '') + ' · ' + roleLabel(ri.role) : eqSummary(e0)} · ${job ? JOB_LABEL[job] : 'iş yok'}</span>${auto ? html`<button class="btn xs" onClick=${() => app.nav.go('definitions', { eqId: id })}>Reçete →</button>` : null}</div>${auto ? null : html`<div class="note">Bu projede otomatik reçete kapalı: listede yalnız seçtiğiniz kalemler durur. Diğer malzemeleri aşağıdaki "Malzeme ekle" ile ekleyin.</div>`}</div>
    <div class="card tight list">
      ${mats.items.filter((m) => m.origin === 'OTO').map((m) => html`<div class="li"><${Badge} k="ok">${auto ? 'OTO' : 'SEÇİM'}</${Badge}><div class="grow"><div class="t" style="font-size:13px">${m.why}</div><div class="s">${m.name}</div><div class="m">${m.servis || 'katalogda yok'}${m.grp ? ' · Kg grubu ' + m.grp : ''}${m.overridden ? ' · reçete ' + m.autoQty : ''}</div></div>
        <button class="btn xs" style=${m.overridden ? 'border-color:#f59e0b;color:#fcd34d' : ''} onClick=${() => changeQty(m)}><b class="mono">${trn(m.qty, m.unit === 'm' || m.unit === 'Kg' ? 1 : 0)}</b> ${m.unit}</button>${m.overridden ? html`<button class="btn xs" aria-label="Reçeteye dön" onClick=${() => resetQty(m)}><${Icon} n="undo" s=${14} /></button>` : null}</div>`)}
      ${!mats.items.length ? html`<div class="empty">${job ? (auto ? 'Reçete boş · MALZEME EKSİK' : 'Kalem yok · tipi seçin ya da aşağıdan malzeme ekleyin') : 'Mevcut / ileride · malzeme gelmez'}</div>` : null}
    </div>
    ${mats.items.filter((m) => m.origin !== 'OTO').map((m) => (m.origin === 'MANUEL' && m.approved && !auto) ? html`<div class="card" style="padding:10px 12px"><div class="row"><${Badge} k="cy">EKLENEN</${Badge}><div class="grow"><b style="font-size:13px">${m.name}</b><div class="m">${m.servis}</div></div>
        <button class="btn xs" onClick=${() => manualQty(m)}><b class="mono">${trn(m.qty, m.unit === 'Ad' ? 0 : 2)}</b> ${m.unit}</button><button class="btn xs dang" aria-label="Malzemeyi kaldır" onClick=${async () => { if (await app.confirm('Malzemeyi kaldır', m.name + ' listeden çıkarılsın mı?', { danger: true, ok: 'Kaldır' })) ps.removeMaterial(m.materialId, 'Kaldırıldı'); }}><${Icon} n="trash" s=${14} /></button></div></div>`
      : html`<div class="card warn"><div class="row"><${Badge} k="m">${m.origin === 'SAHADA_ILAVE' ? 'SAHADA İLAVE' : 'MANUEL'}</${Badge}><b class="grow" style="font-size:13px">${m.name}</b></div><div class="mono hw" style="font-size:12px;margin:4px 0">${m.servis} · ${m.why}</div>
      <div class="row"><b class="mono grow">${trn(m.qty, 2)} ${m.unit}</b><span class="note">Onay</span><${Toggle} on=${m.approved} onChange=${(v) => ps.approveMaterial(m.materialId, v).catch((err) => app.toast(err.message, 'err', 6000))} label="Onay" /><button class="btn dang sm" onClick=${async () => { const r = await app.prompt('Kaldır', 'Gerekçe', { required: true }); if (r) ps.removeMaterial(m.materialId, r); }}>Kaldır</button></div></div>`)}
    ${job ? html`<button class="btn blk" style="border-style:dashed;border-color:#f59e0b;color:#fcd34d" onClick=${() => setPick(!pick)}><${Icon} n=${pick ? 'x' : 'plus'} s=${18} />${pick ? 'Malzeme seçimini kapat' : auto ? 'Sahada ilave talebi' : 'Malzeme ekle'}</button>` : null}
    ${pick ? html`<div class="card stack"><div class="lbl">${auto ? 'Katalogdan seç · elle eklenen olarak işaretlenir' : 'Katalogdan seç'}</div><input class="inp" value=${q} placeholder="servis no veya ad: izolatör, kazık, 011.04…" onInput=${(e) => setQ(e.target.value)} />
      <div class="list">${hits.slice(0, 12).map((x) => html`<div class="li" style="padding:8px 0"><div class="grow"><div style="font-size:13px;font-weight:600">${x.name}</div><div class="m">${x.servis} · ${x.unit}${x.kgPerUnit ? ' · ' + x.kgPerUnit + ' kg' : ''}</div></div><button class="btn sm" style="border-color:#f59e0b;color:#fcd34d" onClick=${() => addManual(x.servis)}>Ekle</button></div>`)}</div><div class="note">${hits.length} sonuç (${job} sayfasında bulunanlar)</div></div>` : null}

    ${job ? html`<div class="sect">Yeşil deftere yazılacak <span class="r"><${Badge} k="ok">${JOB_LABEL[job].toUpperCase()} SAYFASI</${Badge}></span></div>
    <div class="card tight list">${grpRows.map((r) => html`<div><div class="li"><div class="grow"><div class="m">${r.code}</div><div style="font-size:13px;font-weight:600">${r.name}</div></div><b class="mono">${trn(r.qty, 0)}</b><span class="note">Kg</span><${Badge} k=${r.src.includes('M') ? 'm' : 'ok'}>${r.src}</${Badge}></div>${r.subs.map((s) => html`<div class="li" style="min-height:36px;padding-left:22px"><div class="grow"><div class="m">${job === 'montaj' ? s.servis : '—'}</div><div class="s">└ ${s.name}</div></div><b class="mono">${trn(s.qty, 0)}</b><span class="note">Ad</span></div>`)}</div>`)}
      ${ydRows.map((r) => html`<div class="li"><div class="grow"><div class="m">${r.ok ? r.code : 'sayfada yok'}</div><div style="font-size:13px;font-weight:600">${r.name}</div></div><b class="mono">${trn(r.qty, r.unit === 'Ad' ? 0 : 2)}</b><span class="note">${r.unit}</span><${Badge} k=${r.src === 'M' ? 'm' : 'ok'}>${r.src}</${Badge}></div>`)}</div>
    <div class="note"><b class="hl">O</b> tanımdan otomatik · <b class="hw">M</b> sahada elle eklendi. Ayrım kayıtta, raporda ve Yeşil Defter dışa aktarımında korunur.</div>` : null}

    <div class="sect">Fotoğraflar <span class="r mono">${photos.length}</span></div>
    <div class="grid4">
      <button class="photo" style="border-color:#10b981;color:#6ffbbe;align-items:center;justify-content:center;flex-direction:column;gap:4px" onClick=${() => app.nav.go('photo', { ownerId: id, pointId: e0.pointId, ownerNo: e0.no, ownerKind: e0.kind })}><${Icon} n="camera" s=${24} /><span>Çek</span></button>
      ${photos.map((ph) => html`<div class="photo" style="border-style:solid">${thumbs[ph.id] ? html`<img src=${thumbs[ph.id]} alt=${ph.filename || ph.slot || 'foto'} />` : null}<span style="font-size:9px">${ph.filename || ph.slot || 'foto'}</span></div>`)}
    </div>
    <div class="note">Öneri: ${slots.join(' · ')}. Dosya adı ${e0.no}_01.jpg, _02.jpg… · klasör ${(KIND_FOLDER[e0.kind] || 'FOTOGRAFLAR') + '/' + e0.no}</div>

    <div class="sect">Saha notu</div>
    <textarea class="inp" placeholder="Örn. temel kayalık zemin, erişim tarla yolundan" value=${d.note || ''} onInput=${(e) => set({ note: e.target.value })}></textarea>

    <div class="sect">Değişiklik geçmişi</div>
    <div class="card tight list">${hist.map((a) => html`<div class="li" style="align-items:flex-start"><div class="grow"><div class="s">${new Date(a.ts).toLocaleString('tr-TR')} · ${a.user} · ${a.action}</div><div style="font-size:12px">${a.reason || ''}</div>${a.action === 'create' ? null : a.changes.filter((c) => !['history', 'quality'].includes(c.field)).slice(0, 4).map((c) => html`<div class="m">${c.field}: ${short(c.old)} → ${short(c.new)}</div>`)}</div></div>`)}${!hist.length ? html`<div class="empty">Kayıt yok</div>` : null}</div>

    <div class="row" style="position:sticky;bottom:-24px;background:var(--bg);padding:12px 0;margin-top:8px;border-top:1px solid var(--line2)">
      <button class="btn" style="flex:0 0 32%" onClick=${() => (dirty ? setD(JSON.parse(JSON.stringify(e0))) : app.nav.back())}>${dirty ? 'Geri al' : 'Kapat'}</button>
      <button class="btn pri grow" style="height:56px;font-size:17px" disabled=${!dirty} onClick=${save}><${Icon} n="check" s=${20} c="#0b1326" />KAYDET · ${d.no}</button>
    </div>`;
}
const short = (v) => { const s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '—'); return s.length > 40 ? s.slice(0, 40) + '…' : s; };
