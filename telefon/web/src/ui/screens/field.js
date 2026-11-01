// Saha operasyonu ekranları (v2.2): Excel toplu aktarım · Saha objeleri listesi · Sabit Base + Rover rehberi
import { html, useState, useEffect, useBus, Icon, Chip, Seg, Sel, Badge, Title, fmt } from '../kit.js';
import { app } from '../ctx.js';
import { EQUIPMENT_KINDS, HAK_STATUSES, HAK_ORDER, hakOf } from '../../core/schema.js';
import { sourceInfo, SRC, SRC_CODES } from '../../core/source.js';
import { buildTemplates, parseTable, validateImport, applyImport, TEMPLATES } from '../../services/excel-import.js';
import { crsChoices, resolveCoord } from '../../services/survey-service.js';
import { eqSummary } from './map.js';

// ---------------- Excel toplu aktarım ----------------
export function ExcelScreen() {
  const ps = app.ps;
  const [file, setFile] = useState(null);       // { name, sheets }
  const [crsKey, setCrsKey] = useState('proje');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const choices = crsChoices(ps.p);
  const validate = (f, key) => { try { setRes(validateImport(ps, f.sheets, { crsKey: key })); } catch (e) { app.toast('Doğrulama hatası: ' + e.message, 'err', 6000); setRes(null); } };
  const pick = async (f) => {
    if (!f) return;
    setBusy('Okunuyor…'); setRes(null);
    try {
      const u8 = new Uint8Array(await f.arrayBuffer());
      const sheets = await parseTable(u8, f.name);
      const ff = { name: f.name, sheets };
      setFile(ff); validate(ff, crsKey);
    } catch (e) { app.toast('Dosya okunamadı: ' + e.message, 'err', 6000); setFile(null); }
    setBusy(null);
  };
  const tpl = async () => {
    setBusy('Şablon hazırlanıyor…');
    try { const t = await buildTemplates(ps.p); const r = await app.bridge.saveFile(t.name, t.mime, t.data); app.toast('Şablon kaydedildi' + (r && r.uri ? ' · ' + r.uri : ' · İndirilenler'), 'ok', 5000); }
    catch (e) { app.toast(e.message, 'err'); }
    setBusy(null);
  };
  const tplShare = async () => { const t = await buildTemplates(ps.p); await app.bridge.shareFile(t.name, t.mime, t.data); };
  const run = async () => {
    if (!res || !res.ok) return;
    if (!(await app.confirm('Excel aktarımı', res.ok + ' kayıt içe aktarılacak' + (res.bad ? ', ' + res.bad + ' hatalı kayıt atlanacak' : '') + '. Objeler [EXCEL] etiketiyle kaydedilir. Devam edilsin mi?', { ok: 'İçe aktar' }))) return;
    setBusy('Aktarılıyor…');
    try {
      const out = await applyImport(ps, res, { onProgress: (a, b) => setBusy('Aktarılıyor… ' + a + ' / ' + b) });
      await ps.ds.create('documents', { projectId: ps.p.id, kind: 'EXCEL_IMPORT', name: file.name, imported: out.imported, skipped: out.skipped, crs: (choices.find((c) => c.key === crsKey) || {}).label, at: ps.ds.iso() }, { reason: 'Excel toplu aktarım: ' + file.name + ' · ' + out.imported + ' kayıt', silent: true });
      await ps.reload('documents');
      app.toast(out.imported + ' kayıt içe aktarıldı' + (out.skipped ? ' · ' + out.skipped + ' hatalı kayıt atlandı' : ''), 'ok', 5000);
      app.state.view = null; app.state.follow = false; app.state.sel = null;
      setFile(null); setRes(null);
      app.nav.tab('map');
    } catch (e) { app.toast('Aktarım hatası: ' + e.message, 'err', 7000); }
    setBusy(null);
  };
  const bad = res ? res.records.filter((r) => !r.ok) : [];
  const warned = res ? res.records.filter((r) => r.ok && r.warnings.length) : [];
  const past = (ps.data.documents || []).filter((d) => d.kind === 'EXCEL_IMPORT').slice(-5).reverse();
  return html`<${Title} title="Excel toplu aktarım" sub="Şablon · doğrulama · önizleme · içe aktarma" />
    <div class="card stack">
      <div class="row"><span class="badge b-mut">1</span><b class="grow">Şablonu indir ve doldur</b></div>
      <div class="note">Tek dosyada ${TEMPLATES.length} sayfa: ${TEMPLATES.map((t) => t.sheet).join(' · ')}. Sütun açıklamaları "AÇIKLAMA" sayfasında.</div>
      <div class=${app.web ? '' : 'grid2'}><button class="btn pri" disabled=${!!busy} onClick=${tpl}><${Icon} n="down" s=${18} c="#0b1326" />EXCEL ŞABLONLARINI İNDİR</button>${app.web ? null : html`<button class="btn" disabled=${!!busy} onClick=${tplShare}><${Icon} n="share" s=${18} />Paylaş</button>`}</div>
    </div>
    <div class="card stack">
      <div class="row"><span class="badge b-mut">2</span><b class="grow">Doldurulan dosyayı seç</b></div>
      <div class="fld"><label>Dosyadaki koordinat sistemi</label><${Sel} value=${crsKey} options=${choices.map((c) => [c.key, c.label])} onChange=${(v) => { setCrsKey(v); if (file) validate(file, v); }} /></div>
      <label class="btn blk" style="height:52px"><${Icon} n="folder" s=${18} />${file ? file.name : 'Excel (.xlsx) ya da CSV seç'}<input type="file" accept=".xlsx,.csv,.txt" style="display:none" onChange=${(e) => { pick(e.target.files[0]); e.target.value = ''; }} /></label>
      ${busy ? html`<div class="note">${busy}</div>` : null}
    </div>
    ${res ? html`<div class="card stack">
      <div class="row"><span class="badge b-mut">3</span><b class="grow">Önizleme</b></div>
      <div class="grid3"><div class="stat"><b>Bulundu</b><span>${res.total}</span><small>kayıt</small></div><div class="stat"><b>Uygun</b><span style="color:#6ffbbe">${res.ok}</span></div><div class="stat"><b>Hatalı</b><span style=${'color:' + (res.bad ? '#ff8a8a' : '#94a3b8')}>${res.bad}</span></div></div>
      <div class="note" style="font-size:13px"><b>${res.total} kayıt bulundu</b> · ${res.ok} kayıt uygun · ${res.bad} kayıt hatalı${warned.length ? ' · ' + warned.length + ' kayıtta uyarı' : ''}</div>
      <div class="card tight scrollx"><table class="t"><thead><tr><th>Sayfa</th><th>Şablon</th><th class="n">Kayıt</th><th class="n">Uygun</th><th class="n">Hatalı</th></tr></thead><tbody>
        ${res.sheets.map((s) => html`<tr><td>${s.name}</td><td>${s.template || html`<span class="he">tanınmadı</span>`}</td><td class="n">${s.total}</td><td class="n">${s.ok}</td><td class="n" style=${s.bad ? 'color:#ff8a8a' : ''}>${s.bad}</td></tr>${s.error ? html`<tr><td colspan="5" class="note he">${s.error}</td></tr>` : null}${(s.missingColumns || []).length ? html`<tr><td colspan="5" class="note he">Eksik zorunlu sütun: ${s.missingColumns.join(', ')}</td></tr>` : null}`)}
      </tbody></table></div>
      ${bad.length ? html`<div class="sect">Hatalı kayıtlar <span class="r">${bad.length}</span></div>
        <div class="card tight list">${(showAll ? bad : bad.slice(0, 8)).map((r) => html`<div class="li" style="align-items:flex-start"><${Badge} k="err">HATA</${Badge}><div class="grow"><div class="t" style="font-size:13px">${r.sheet} · satır ${r.row}${r.no ? ' · ' + r.no : ''}</div>${r.errors.map((e) => html`<div class="s" style="color:#fca5a5">${e}</div>`)}</div></div>`)}</div>
        ${bad.length > 8 ? html`<button class="btn sm" onClick=${() => setShowAll(!showAll)}>${showAll ? 'Daha az göster' : 'Tümünü göster (' + bad.length + ')'}</button>` : null}` : null}
      ${warned.length ? html`<div class="sect">Uyarılar <span class="r">${warned.length}</span></div>
        <div class="card tight list">${warned.slice(0, 6).map((r) => html`<div class="li" style="align-items:flex-start"><${Badge} k="warn">UYARI</${Badge}><div class="grow"><div class="t" style="font-size:13px">${r.sheet} · satır ${r.row} · ${r.no}</div>${r.warnings.map((e) => html`<div class="s">${e}</div>`)}</div></div>`)}</div>
        ${warned.length > 6 ? html`<div class="note">+${warned.length - 6} kayıt daha (aktarılır, kontrol listesinde görünür)</div>` : null}` : null}
      <button class="btn pri huge blk" disabled=${!res.ok || !!busy} onClick=${run}><${Icon} n="check" s=${22} c="#0b1326" />${res.ok ? 'İÇE AKTAR · ' + res.ok + ' KAYIT' : 'UYGUN KAYIT YOK'}</button>
      <div class="note">Yalnız uygun kayıtlar aktarılır. Hatalı satırları Excel'de düzeltip dosyayı yeniden seçebilirsiniz; aktarılanlar tekrar eklenmez (numara çakışması olarak görünür).</div>
    </div>` : null}
    ${past.length ? html`<div class="sect">Önceki aktarımlar</div><div class="card tight list">${past.map((d) => html`<div class="li"><div class="grow"><div class="t" style="font-size:13px">${d.name}</div><div class="s">${new Date(d.at || d.createdAt).toLocaleString('tr-TR')} · ${d.imported} kayıt${d.skipped ? ' · ' + d.skipped + ' atlandı' : ''}</div></div></div>`)}</div>` : null}`;
}

// ---------------- Otomatik numaralama ----------------
const NUM_KINDS = ['pole', 'lighting', 'sdk', 'manhole', 'subscriber', 'luminaire', 'transformer', 'kiosk', 'panel'];
function RenumberForm({ close, lineId }) {
  const ps = app.ps;
  const line = lineId ? ps.lineById(lineId) : null;
  // Seçenekler: direkler numara ön ekine göre ayrı seriler (D- OG, A- AG, M- müşterek, AY- aydınlatma), diğer türler tek seri
  const fam = new Map();
  for (const e of ps.data.equipment) {
    if (e.status === 'deleted' || !NUM_KINDS.includes(e.kind)) continue;
    const px = ps.eqPrefix(e.kind, e.group), key = e.kind + '|' + px;
    if (!fam.has(key)) fam.set(key, { key, kind: e.kind, prefix: px + '-', groups: new Set(), n: 0 });
    const f = fam.get(key); f.groups.add(e.group); f.n++;
  }
  const POLE_FAM = { D: 'OG direkleri', A: 'AG direkleri', M: 'Müşterek direkler', AY: 'Aydınlatma direkleri' };
  const choices = [...fam.values()].sort((a, b) => NUM_KINDS.indexOf(a.kind) - NUM_KINDS.indexOf(b.kind) || ['D-', 'A-', 'M-', 'AY-'].indexOf(a.prefix) - ['D-', 'A-', 'M-', 'AY-'].indexOf(b.prefix)).map((f) => Object.assign(f, { label: (f.kind === 'pole' ? POLE_FAM[f.prefix.slice(0, -1)] || 'Direkler' : EQUIPMENT_KINDS[f.kind].label) + ' (' + f.prefix + ' · ' + f.n + ' adet)' }));
  const poleFams = choices.filter((c) => c.kind === 'pole');
  if (poleFams.length > 1) choices.splice(poleFams.length, 0, { key: 'pole|*', kind: 'pole', prefix: 'D-', groups: null, n: poleFams.reduce((a, c) => a + c.n, 0), label: 'Tüm direkler tek seri (' + poleFams.reduce((a, c) => a + c.n, 0) + ' adet)' });
  const first = choices[0] || { key: 'pole|D', kind: 'pole', prefix: 'D-', groups: null };
  const [o, setO] = useState({ scope: line ? 'line' : 'all', lineId, key: first.key, prefix: first.prefix, start: 1, digits: first.prefix === 'D-' ? 3 : 2, order: 'line' });
  const set = (p) => setO((x) => Object.assign({}, x, p));
  const ch = choices.find((c) => c.key === o.key) || first;
  const opts = { scope: o.scope, lineId: o.lineId, kinds: [ch.kind], groups: ch.groups ? [...ch.groups] : null, prefix: o.prefix, start: Math.max(0, parseInt(o.start, 10) || 0), digits: Math.min(6, Math.max(1, parseInt(o.digits, 10) || 1)), order: o.order };
  const R = ps.renumberPlan(opts);
  return html`<div class="mh"><h3>Otomatik numara ver</h3></div><div class="mb">
    <div class="note">Seçtiğiniz objelere sırayla yeni numara verilir. Eski numara kayıtta saklanır; ölçüler, malzemeler ve hakediş durumu değişmez.</div>
    <div class="fld"><label>Hangi objeler</label><${Sel} value=${o.key} options=${(choices.length ? choices : [first]).map((c) => [c.key, c.label || 'Direkler'])} onChange=${(k) => { const c = choices.find((x) => x.key === k); set({ key: k, prefix: c.prefix, digits: c.prefix === 'D-' ? 3 : 2 }); }} /></div>
    ${line ? html`<${Seg} value=${o.scope} options=${[['line', 'Yalnız ' + line.lineNo + ' hattı'], ['all', 'Tüm proje']]} onChange=${(v) => set({ scope: v })} />` : null}
    ${o.scope === 'all' ? html`<div class="fld"><label>Sıra</label><${Seg} value=${o.order} options=${[['line', 'Hat güzergâhına göre'], ['capture', 'Kayıt sırasına göre']]} onChange=${(v) => set({ order: v })} /></div>` : null}
    <div class="grid3"><div class="fld"><label>Ön ek</label><input class="inp mono" value=${o.prefix} onInput=${(e) => set({ prefix: e.target.value })} /></div>
      <div class="fld"><label>Başlangıç</label><input class="inp mono" type="number" min="0" value=${o.start} onInput=${(e) => set({ start: e.target.value })} /></div>
      <div class="fld"><label>Hane</label><input class="inp mono" type="number" min="1" max="6" value=${o.digits} onInput=${(e) => set({ digits: e.target.value })} /></div></div>
    <div class="lbl">Önizleme · ${R.plan.length} obje, ${R.changed} tanesi değişecek</div>
    ${R.plan.length ? html`<div class="card tight" style="max-height:190px;overflow:auto"><table class="tbl mono" style="font-size:12px;width:100%"><tbody>${R.plan.slice(0, 200).map((x) => html`<tr><td style="padding:3px 8px;color:#94a3b8">${x.old}</td><td style="padding:3px 4px">→</td><td style=${'padding:3px 8px;font-weight:800;color:' + (x.old === x.no ? '#94a3b8' : '#6ffbbe')}>${x.no}</td></tr>`)}</tbody></table></div>` : html`<div class="alert warn">Bu kapsamda numaralanacak obje yok.</div>`}
    ${R.clash.length ? html`<div class="alert err" style="font-size:12px">Bu numaralar başka objelerde kullanılıyor: ${R.clash.slice(0, 6).join(', ')}${R.clash.length > 6 ? '…' : ''}. Ön eki ya da başlangıç numarasını değiştirin.</div>` : null}
    ${ps.data.photos.length ? html`<div class="note">Not: daha önce çekilen fotoğrafların dosya adları eski numarayla kalır.</div>` : null}
  </div><div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn pri grow" disabled=${!R.changed || R.clash.length > 0} onClick=${() => close(opts)}>Numaraları ver</button></div>`;
}
export async function renumberDialog(lineId) {
  const opts = await app.modal((close) => html`<${RenumberForm} close=${close} lineId=${lineId || null} />`);
  if (!opts) return;
  try { const r = await app.ps.renumber(opts); app.toast(r.changed + ' objeye yeni numara verildi'); } catch (e) { app.toast(e.message, 'err'); }
}

// ---------------- Saha objeleri listesi (kaynak etiketi + hakediş durumu) ----------------
export function ObjectsScreen() {
  useBus(['project:computed']);
  const ps = app.ps;
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [hak, setHak] = useState('');
  const [src, setSrc] = useState('');
  const low = (s) => String(s || '').toLocaleLowerCase('tr-TR');
  const photos = new Map();
  for (const ph of ps.data.photos) photos.set(ph.ownerId, (photos.get(ph.ownerId) || 0) + 1);
  const rows = [];
  for (const e of ps.data.equipment) { const p = ps.pointById(e.pointId); rows.push({ id: e.id, type: 'equipment', no: e.no, kind: e.kind, kindLabel: (EQUIPMENT_KINDS[e.kind] || {}).label || e.kind, sub: eqSummary(e), p, hak: hakOf(e), si: sourceInfo(p), rec: e, photos: photos.get(e.id) || 0 }); }
  for (const l of ps.data.lines) { const li = ps.result.lineInfo.get(l.id) || {}; rows.push({ id: l.id, type: 'line', no: l.lineNo, kind: 'line', kindLabel: l.channelOnly ? 'Kanal / Kazı' : l.install === 'yeralti' ? 'Kablo' : 'Hat', sub: l.lineType + ' · ' + l.install + ' · ' + fmt(li.length3D || 0, 1) + ' m', p: null, hak: hakOf(l), si: null, rec: l, photos: photos.get(l.id) || 0 }); }
  const eqPts = new Set(ps.data.equipment.map((e) => e.pointId));
  for (const p of ps.data.points) if (!eqPts.has(p.id)) rows.push({ id: p.id, type: 'point', no: p.pointNo, kind: 'point', kindLabel: p.cls === 'HAT' ? 'Hat köşe noktası' : p.cls === 'TASARIM' ? 'Tasarım noktası' : 'Detay noktası', sub: p.note || '', p, hak: null, si: sourceInfo(p), rec: p, photos: photos.get(p.id) || 0 });
  const kinds = [...new Map(rows.map((r) => [r.kind, r.kindLabel])).entries()];
  const list = rows.filter((r) => (!kind || r.kind === kind) && (!hak || r.hak === hak) && (!src || (r.si && r.si.code === src)) && (!q || low(r.no + ' ' + r.kindLabel + ' ' + r.sub).includes(low(q)))).sort((a, b) => String(a.no).localeCompare(String(b.no), 'tr', { numeric: true }));
  const counts = ps.hakCounts();
  const open = (r) => { if (r.type === 'equipment') app.nav.go('equipment', { id: r.id }); else if (r.type === 'line') app.nav.go('line', { id: r.id }); else app.nav.go('point', { id: r.id }); };
  const show = (r) => { app.state.sel = r.type === 'line' ? { type: 'line', id: r.id, seg: 0 } : { type: 'point', id: r.type === 'equipment' ? r.rec.pointId : r.id }; app.state.follow = false; const p = r.p || (r.type === 'line' ? ps.pointById(r.rec.nodes[0]) : null); if (p && p.E != null) app.state.view = { cE: p.E, cN: p.N, res: Math.min((app.state.view || {}).res || 0.3, 0.3) }; app.nav.tab('map'); };
  return html`<${Title} title="Saha objeleri" sub=${rows.length + ' obje · veri kaynağı ve hakediş durumu'} right=${html`<button class="btn sm" onClick=${() => renumberDialog()}>№ Otomatik numara</button>`} />
    <div class="hakrow">${HAK_ORDER.map((k) => html`<button class=${hak === k ? 'on' : ''} style=${'--c:' + HAK_STATUSES[k].color} onClick=${() => setHak(hak === k ? '' : k)}><i></i>${HAK_STATUSES[k].short} ${counts[k] || 0}</button>`)}</div>
    <input class="inp" placeholder="Ara: D-017, trafo, armatür…" value=${q} onInput=${(e) => setQ(e.target.value)} />
    <div class="grid2"><${Sel} value=${kind} options=${[['', 'Tüm türler'], ...kinds]} onChange=${setKind} /><${Sel} value=${src} options=${[['', 'Tüm kaynaklar'], ...SRC_CODES.map((c) => [c, '[' + SRC[c].tag + ']'])]} onChange=${setSrc} /></div>
    <div class="note">${list.length} kayıt${hak || kind || src || q ? ' (süzülmüş)' : ''}</div>
    <div class="card tight list">${list.slice(0, 300).map((r) => html`<div class="li" style="align-items:flex-start">
      <button class="grow" style="background:none;border:0;text-align:left;color:inherit;padding:0" onClick=${() => open(r)}>
        <div class="row wrap" style="gap:6px"><b style="font-size:14px">${r.no}</b><span class="note">${r.kindLabel}</span>${r.si ? html`<span class="srctag" style=${'color:' + r.si.color}>[${r.si.tag}]</span>` : null}${r.hak ? html`<span class="srctag" style=${'color:' + HAK_STATUSES[r.hak].color}>● ${HAK_STATUSES[r.hak].short}</span>` : null}</div>
        <div class="s">${r.sub}${r.p && r.p.E != null ? ' · Y ' + fmt(r.p.E, 2) + ' X ' + fmt(r.p.N, 2) + (r.p.H != null ? ' Z ' + fmt(r.p.H, 2) : ' Z ?') : ''}${r.photos ? ' · ' + r.photos + ' foto' : ''}</div>
      </button>
      <button class="btn xs" aria-label="Haritada göster" onClick=${() => show(r)}><${Icon} n="pin" s=${16} /></button></div>`)}
      ${!list.length ? html`<div class="empty">Kayıt yok</div>` : null}</div>
    ${list.length > 300 ? html`<div class="note">İlk 300 kayıt gösteriliyor · aramayı daraltın</div>` : null}`;
}

// ---------------- Sabit Base + Rover (adım adım rehber) ----------------
const LINKS = [['UHF', 'UHF radyo'], ['LORA', 'LoRa'], ['RADIO', 'Dahili / harici radyo'], ['NTRIP', 'NTRIP (kendi caster / SIM)'], ['DIGER', 'Diğer']];
const BASE_SRC = [['known', 'Bilinen nokta'], ['manual', 'Manuel koordinat'], ['average', 'Ortalama al'], ['saved', 'Kayıtlı base']];
export function BaseRoverScreen() {
  useBus('gnss:state', 500);
  const ps = app.ps, g = app.gnss, s = g.state;
  const [step, setStep] = useState(1);
  const [b, setB] = useState(() => Object.assign({ name: 'BASE-1', device: '', conn: 'BT', posSrc: 'known', pointId: '', x: '', y: '', z: '', antH: '', link: 'UHF', channel: '', E: null, N: null, H: null, lat: null, lon: null }, g.base || {}));
  const [saved, setSaved] = useState([]);
  const [avg, setAvg] = useState(null);
  useEffect(() => { app.ds.setting('savedBases').then((v) => setSaved(Array.isArray(v) ? v : [])); }, []);
  const set = (p) => setB((v) => Object.assign({}, v, p));
  const pts = ps.p ? ps.data.points.filter((p) => p.E != null) : [];
  const setFromPoint = (id) => { const p = ps.pointById(id); if (p) set({ pointId: id, E: p.E, N: p.N, H: p.H, lat: p.lat, lon: p.lon, posLabel: 'Bilinen nokta ' + p.pointNo }); };
  const setManual = () => { const r = resolveCoord(ps.p, { x: b.x, y: b.y, z: b.z, zUnknown: b.z === '' }); if (!r.ok) { app.toast(r.error, 'err'); return false; } set({ E: r.E, N: r.N, H: r.H, lat: r.lat, lon: r.lon, posLabel: 'Manuel koordinat' }); return true; };
  const average = async () => {
    if (s.source === 'none' || s.lat == null) { app.toast('Ortalama için alıcı bağlı ve konum geliyor olmalı', 'warn'); return; }
    setAvg('Ortalama alınıyor (60 epok)…');
    try { const o = await g.observe({ epochs: 60, critical: false, override: true, timeoutMs: 180000 }); set({ E: o.E, N: o.N, H: o.H ?? o.h, lat: o.lat, lon: o.lon, posLabel: 'Ortalama (' + o.epochs + ' epok, ' + o.fix + ')' }); setAvg(null); app.toast('Base konumu ortalamadan alındı', 'ok'); }
    catch (e) { setAvg(null); app.toast(e.message, 'err'); }
  };
  const roverOk = s.source === 'external' && s.connected !== false && s.lat != null;
  const corrOk = roverOk && (s.fix === 'FIX' || s.fix === 'FLOAT') && s.age != null && s.age < 10;
  const finish = async () => {
    const base = { name: b.name, device: b.device, conn: b.conn, link: (LINKS.find((l) => l[0] === b.link) || [])[1] || b.link, channel: b.channel, antH: b.antH === '' ? null : +b.antH, E: b.E, N: b.N, H: b.H, lat: b.lat, lon: b.lon, posSrc: b.posSrc, posLabel: b.posLabel || '', setAt: new Date().toISOString() };
    g.setMethod('BASE_ROVER', base);
    await app.ds.setting('gnssMethod', { method: 'BASE_ROVER', base });
    const list = [base, ...saved.filter((x) => x.name !== base.name)].slice(0, 8);
    await app.ds.setting('savedBases', list);
    app.toast('Sabit Base + Rover etkin · base bilgisi her ölçüme yazılır', 'ok', 4500);
    app.nav.back();
  };
  const off = async () => { g.setMethod(null, null); await app.ds.setting('gnssMethod', { method: null }); app.toast('Base + Rover kapatıldı'); app.nav.back(); };
  const hasPos = b.E != null && b.N != null;
  const steps = ['BASE bağla', 'BASE konumu', 'Düzeltme verisi', 'ROVER bağla', 'Bağlantı kontrolü', 'Ölçüme başla'];
  return html`<${Title} title="Sabit Base + Rover" sub="Adım adım kurulum · base bilgisi her ölçüme kaydedilir" />
    <div class=${'card ' + (corrOk && s.fix === 'FIX' ? 'ok' : 'warn')}><div class="mono" style="font-size:13px;font-weight:700">${g.method === 'BASE_ROVER' ? 'BASE BAĞLI' : 'BASE TANIMSIZ'} · ${roverOk ? 'ROVER BAĞLI' : 'ROVER YOK'} · RTK DURUMU: ${s.source === 'none' ? 'GNSS YOK' : s.fix}</div>
      <div class="note">${s.sigmaH != null ? '±' + s.sigmaH.toFixed(3) + ' m · ' : ''}${s.sats ?? '—'} uydu · PDOP ${s.pdop != null ? s.pdop.toFixed(1) : '—'} · düzeltme yaşı ${s.age != null ? s.age.toFixed(1) + ' s' : 'yok'}${s.stationId ? ' · istasyon ' + s.stationId : ''}</div></div>
    <div class="chips">${steps.map((t, i) => html`<${Chip} on=${step === i + 1} onClick=${() => setStep(i + 1)}>${i + 1}</${Chip}>`)}</div>
    <div class="card stack">
      <b style="font-size:16px">${step}. ${steps[step - 1]}</b>
      ${step === 1 ? html`
        <div class="note">Base alıcıyı sehpaya kurun, açın ve kendi yazılımından (ör. M-Survey) "Base" moduna alın. Uygulama base'e bağlanmaz; bilgileri kayıt için alır.</div>
        <div class="grid2"><div class="fld"><label>Base adı</label><input class="inp" value=${b.name} onInput=${(e) => set({ name: e.target.value })} /></div><div class="fld"><label>Cihaz / seri no</label><input class="inp" value=${b.device} placeholder="ör. M20L #1234" onInput=${(e) => set({ device: e.target.value })} /></div></div>
        <div class="fld"><label>Base bağlantısı</label><${Seg} value=${b.conn} options=${[['BT', 'Bluetooth'], ['USB', 'USB'], ['YOK', 'Bağımsız']]} onChange=${(v) => set({ conn: v })} /></div>
        <div class="fld"><label>Base anten yüksekliği (m)</label><input class="inp mono" inputmode="decimal" value=${b.antH} onInput=${(e) => set({ antH: e.target.value })} /></div>` : null}
      ${step === 2 ? html`
        <div class="fld"><label>Konum nasıl belirlenecek?</label><div class="grid2">${BASE_SRC.map(([k, l]) => html`<${Chip} on=${b.posSrc === k} onClick=${() => set({ posSrc: k })}>${l}</${Chip}>`)}</div></div>
        ${b.posSrc === 'known' ? html`<div class="fld"><label>Projedeki nokta</label><${Sel} value=${b.pointId || ''} options=${[['', pts.length ? 'Nokta seçin' : 'Projede nokta yok'], ...pts.slice(0, 400).map((p) => [p.id, p.pointNo + ' · ' + sourceInfo(p).tag])]} onChange=${setFromPoint} /></div>` : null}
        ${b.posSrc === 'manual' ? html`<div class="grid2"><div class="fld"><label>Y · Sağa</label><input class="inp mono" inputmode="decimal" value=${b.x} onInput=${(e) => set({ x: e.target.value })} /></div><div class="fld"><label>X · Yukarı</label><input class="inp mono" inputmode="decimal" value=${b.y} onInput=${(e) => set({ y: e.target.value })} /></div></div>
          <div class="row"><div class="fld grow"><label>Z (m)</label><input class="inp mono" inputmode="decimal" value=${b.z} onInput=${(e) => set({ z: e.target.value })} /></div><button class="btn" style="align-self:flex-end" onClick=${setManual}>Uygula</button></div>` : null}
        ${b.posSrc === 'average' ? html`<div class="note">Bağlı alıcı base noktasının üzerindeyken 60 epok ortalama alınır (düzeltmesiz konum metre mertebesinde doğruluktadır; mutlak doğruluk gerekmiyorsa uygundur).</div><button class="btn" disabled=${!!avg} onClick=${average}>${avg || 'Ortalama al'}</button>` : null}
        ${b.posSrc === 'saved' ? html`<div class="card tight list">${saved.map((x) => html`<button class="li" onClick=${() => setB(Object.assign({}, b, x, { posSrc: 'saved', posLabel: 'Kayıtlı base ' + x.name, link: (LINKS.find((l) => l[1] === x.link) || [b.link])[0] }))}><div class="grow"><div class="t">${x.name}</div><div class="m">Y ${fmt(x.E, 3)} · X ${fmt(x.N, 3)} · Z ${fmt(x.H, 3)}</div></div></button>`)}${!saved.length ? html`<div class="empty">Kayıtlı base yok</div>` : null}</div>` : null}
        ${hasPos ? html`<div class="alert ok" style="display:block"><b>${b.posLabel || 'Base konumu'}</b><div class="mono" style="font-size:12px">Y ${fmt(b.E)} · X ${fmt(b.N)} · Z ${b.H != null ? fmt(b.H) : 'bilinmiyor'}</div></div>` : html`<div class="alert warn">Base konumu henüz belirlenmedi</div>`}` : null}
      ${step === 3 ? html`
        <div class="fld"><label>Düzeltme verisi rover'a nasıl ulaşıyor?</label><div class="grid2">${LINKS.map(([k, l]) => html`<${Chip} on=${b.link === k} onClick=${() => set({ link: k })}>${l}</${Chip}>`)}</div></div>
        <div class="fld"><label>Kanal / frekans / protokol (isteğe bağlı)</label><input class="inp" value=${b.channel} placeholder="ör. 438.125 MHz · TRIMTALK 450S" onInput=${(e) => set({ channel: e.target.value })} /></div>
        <div class="note">${b.link === 'NTRIP' ? 'Base düzeltmeyi internetten veriyorsa (NTRIP sunucusu ya da doğrudan IP:port): Ayarlar › Düzeltme kaynağı › "Sabit istasyon" profiline bilgileri girip bağlanın; düzeltme telefondan rover\'a iletilir, istasyonun uzaklığı da görünür.' : 'Radyo bağlantısında düzeltme doğrudan base → rover gider; uygulama yalnız rover\'dan gelen RTK durumunu izler. Base ve rover aynı kanal ve protokolde olmalı.'}</div>` : null}
      ${step === 4 ? html`
        <div class=${'alert ' + (roverOk ? 'ok' : 'warn')}>${roverOk ? 'Rover bağlı: ' + ((s.receiver || {}).name || 'alıcı') : 'Rover bağlı değil'}</div>
        <div class="note">Rover alıcıyı Android Bluetooth ayarlarından eşleştirin, sonra Ayarlar › Ölçüm › Harici GNSS bölümünden seçin. NMEA çıkışı (GGA, RMC, GST, GSA) açık olmalı.</div>
        <button class="btn" onClick=${() => { app.nav.tab('settings'); app.nav.go('ayarOlcum'); }}><${Icon} n="bt" s=${18} />Konum kaynağı ayarları</button>` : null}
      ${step === 5 ? html`
        ${[['Rover NMEA geliyor', roverOk], ['Düzeltme rover\'a ulaşıyor (FLOAT/FIX, yaş < 10 s)', corrOk], ['RTK FIX', roverOk && s.fix === 'FIX'], ['Base konumu tanımlı', hasPos]].map(([t, ok]) => html`<div class="row"><${Icon} n=${ok ? 'check' : 'x'} s=${18} c=${ok ? '#10b981' : '#ef4444'} w=${3} /><span class="grow">${t}</span></div>`)}
        <div class="note">Düzeltme gelmiyorsa: base'in yayında olduğunu, kanal/protokolü ve rover'ın "Rover" modunda olduğunu alıcı yazılımından kontrol edin.</div>` : null}
      ${step === 6 ? html`
        <div class="kv" style="font-size:13px"><b>Base</b><span>${b.name}${b.device ? ' · ' + b.device : ''}</span><b>Konum</b><span class="mono">${hasPos ? 'Y ' + fmt(b.E) + ' · X ' + fmt(b.N) : '—'}</span><b>Düzeltme</b><span>${(LINKS.find((l) => l[0] === b.link) || [])[1]}${b.channel ? ' · ' + b.channel : ''}</span><b>Rover</b><span>${roverOk ? (s.receiver || {}).name || 'bağlı' : 'bağlı değil'}</span></div>
        ${!hasPos ? html`<div class="alert warn">Base konumu olmadan da başlanabilir; ölçüm kaydında base koordinatı boş kalır.</div>` : null}
        <button class="btn pri huge blk" onClick=${finish}><${Icon} n="check" s=${22} c="#0b1326" />ÖLÇÜME BAŞLA</button>` : null}
      <div class="grid2">${step > 1 ? html`<button class="btn" onClick=${() => setStep(step - 1)}>Geri</button>` : html`<span></span>`}${step < 6 ? html`<button class="btn pri" onClick=${() => { if (step === 2 && b.posSrc === 'manual' && !hasPos && !setManual()) return; setStep(step + 1); }}>İleri</button>` : html`<span></span>`}</div>
    </div>
    ${g.method === 'BASE_ROVER' ? html`<button class="btn dang blk" onClick=${off}>Base + Rover'ı kapat</button>` : null}`;
}
