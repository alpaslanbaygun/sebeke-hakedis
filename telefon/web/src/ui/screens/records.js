// Nokta kaydı · Hat kaydı · Fotoğraf (kanıt) ekranları
import { html, useState, useEffect, useRef, useBus, Icon, Chip, Seg, Sel, Badge, Title, Toggle, fmt, trn, CODE_KIND } from '../kit.js';
import { app } from '../ctx.js';
import { measure } from '../services.js';
import { renumberDialog } from './field.js';
import { HakRow, HakHistory } from './team.js';
import { STATUSES, HAK_STATUSES, HAK_ORDER, hakOf } from '../../core/schema.js';
import { circuitLabel, circuitParts, autocadDevresi, lineLabelText, malzemeYazisi, CABLE_DEFAULTS, KAPLAMA, YONTEM, kanalModel, ZEMIN_CINSI, KAPLAMA_TURU, zemindenSurface, zeminOzelMi, kanalZeminTanimi } from '../../grid/lines.js';
import { autocadSecenekleri, autocadCinsAdi } from '../../interop/sebeke.js';
import { autoRecipeOn } from '../../grid/recipe.js';
import { MaterialPicker } from './matpick.js';
import { offsetPolyline, dms } from '../../geo/geom.js';
import { unproject } from '../../geo/crs.js';
import { sourceInfo, sourceText } from '../../core/source.js';
import { CizimDurum } from '../durum-kodu.js';
import { overlayLines, buildExif, extractExif, resetOrientation, withExif, nextPhotoName, photoPath, projectFolder, kindLabel } from '../../services/photo-service.js';

const toDMS = (v, pos, neg) => { if (v == null) return '—'; const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60; return d + '° ' + String(m).padStart(2, '0') + '′ ' + s.toFixed(4).padStart(7, '0') + '″ ' + (v >= 0 ? pos : neg); };

export function PointScreen({ id }) {
  useBus(['project:computed']);
  const ps = app.ps;
  const p = ps.pointById(id);
  const [obs, setObs] = useState([]);
  useEffect(() => { setObs(ps.data.gnssObservations.filter((o) => o.pointNo === (p && p.pointNo) || o.remeasureOf === id).slice(-10).reverse()); }, [p && p.rev]);
  if (!p) return html`<${Title} title="Nokta yok" />`;
  const q = p.quality || {};
  const eqs = ps.eqAt(id);
  const iss = ps.result.issues.filter((i) => i.pointId === id || i.entityId === id);
  const remeasure = async () => {
    const o = await measure({ critical: p.critical !== false, label: p.pointNo });
    if (!o) return;
    const why = await app.prompt('Yeniden ölçüm', 'Gerekçe', { required: true, value: p.source === 'PHONE' ? 'Telefon GPS noktası RTK ile yeniden ölçüldü' : 'Kontrol ölçümü' });
    if (why) { await ps.remeasure(id, o, why); app.toast(p.pointNo + ' revize edildi'); }
  };
  const editCoord = async () => {
    const v = await app.prompt('Koordinat düzelt', 'Y X Z (boşlukla)', { value: fmt(p.E) + ' ' + fmt(p.N) + ' ' + fmt(p.H), required: true, note: 'Elle düzeltme kaynağı MANUEL yapar ve denetim kaydına yazılır.' });
    if (!v) return;
    const [E, N, H] = v.replace(/,/g, '.').split(/\s+/).map(Number);
    const why = await app.prompt('Gerekçe', 'Neden?', { required: true });
    if (!why || !Number.isFinite(E) || !Number.isFinite(N)) return;
    await ps.movePoint(id, E, N, why);
    if (Number.isFinite(H)) await ps.updatePoint(id, { H }, why);
  };
  return html`<${Title} title=${p.pointNo} sub=${p.cls + ' · ' + (eqs.map((e) => e.no).join(', ') || 'ekipmansız')} />
    ${iss.map((i) => html`<div class=${'alert ' + (i.severity === 'error' ? 'err' : 'warn')}><${Badge} k=${CODE_KIND[i.code]}>${i.code}</${Badge}> ${i.message}</div>`)}
    <div class="card"><div class="grid3"><div><div class="lbl">Y (sağa)</div><div class="num">${fmt(p.E)}</div></div><div><div class="lbl">X (yukarı)</div><div class="num">${fmt(p.N)}</div></div><div><div class="lbl">Z ${ps.p.heightSystem === 'elipsoidal' ? '(h)' : '(H)'}</div><div class="num">${fmt(p.H)}</div></div></div>
      <div class="kv mono" style="font-size:12px;margin-top:10px"><b>Enlem</b><span>${toDMS(p.lat, 'K', 'G')}</span><b>Boylam</b><span>${toDMS(p.lon, 'D', 'B')}</span><b>Elipsoidal h</b><span>${fmt(p.h)} m</span><b>CRS</b><span>${ps.p.crs.label}</span><b>Veri kaynağı</b><span style=${'color:' + sourceInfo(p).color}>[${sourceInfo(p).tag}] ${sourceText(p)}</span>${p.device || p.method ? html`<b>Cihaz / yöntem</b><span>${p.device || '—'}${p.deviceSerial ? ' #' + p.deviceSerial : ''}${p.method ? ' · ' + p.method : ''}${p.correction ? ' · ' + p.correction : ''}</span>` : null}${p.operator ? html`<b>Operatör</b><span>${p.operator}</span>` : null}${p.enteredCrs && p.enteredCrs !== ps.p.crs.label ? html`<b>Girilen sistem</b><span>${p.enteredCrs}</span>` : null}
      ${p.quality ? html`<b>Kalite</b><span>${q.fix} · σH ${fmt(q.sigmaH)} · σV ${fmt(q.sigmaV)} · PDOP ${fmt(q.pdop, 1)}${q.hdop != null ? ' · HDOP ' + fmt(q.hdop, 1) : ''}${q.vdop != null ? ' · VDOP ' + fmt(q.vdop, 1) : ''} · ${q.sats ?? '—'} uydu · yaş ${fmt(q.age, 1)} s · ${q.epochs ?? 1} epok${q.sigmaEst ? ' · σ tahmini' : ''}</span>` : null}</div></div>
    <div class="grid2">${app.web ? null : html`<button class="btn pri" onClick=${remeasure}><${Icon} n="cross" s=${18} c="#0b1326" />Yeniden ölç</button>`}<button class=${'btn' + (app.web ? ' pri' : '')} onClick=${editCoord}><${Icon} n="edit" s=${18} c=${app.web ? '#0b1326' : 'currentColor'} />${app.web ? 'Koordinatı düzelt' : 'Elle düzelt'}</button>
      ${app.web ? null : html`<button class="btn" onClick=${() => { app.state.target = { id }; app.nav.tab('stake'); }}><${Icon} n="target" s=${18} />Aplikasyon</button>`}<button class="btn" onClick=${() => app.nav.go('photo', { ownerKind: eqs[0] ? eqs[0].kind : 'point', ownerId: eqs[0] ? eqs[0].id : id, pointId: id, ownerNo: eqs[0] ? eqs[0].no : p.pointNo })}><${Icon} n="camera" s=${18} />Fotoğraf</button></div>
    <div class="card row"><span class="grow">Kritik saha noktası (RTK FIX değilse uyarı verilir)</span><${Toggle} on=${p.critical !== false} onChange=${(v) => ps.updatePoint(id, { critical: v }, v ? 'Kritik nokta' : 'Kritik değil (detay)')} label="Kritik" /></div>
    <div class="sect">Ölçüm revizyonları</div>
    <div class="card tight list">${(p.history || []).slice().reverse().map((h) => html`<div class="li"><div class="grow"><div class="s">${new Date(h.at).toLocaleString('tr-TR')} · ${h.by || ''}${h.manualMove ? ' · elle taşındı' : ''}</div><div class="m">${h.source} · Y ${fmt(h.E)} X ${fmt(h.N)} Z ${fmt(h.H)}</div></div><span class="m">Δ ${fmt(Math.hypot((h.E ?? 0) - p.E, (h.N ?? 0) - p.N))} m</span></div>`)}${!(p.history || []).length ? html`<div class="empty">İlk ölçüm · revizyon yok</div>` : null}</div>
    <div class="sect">GNSS gözlemleri</div>
    <div class="card tight list">${obs.map((o) => html`<div class="li"><div class="grow"><div class="s">${new Date(o.timestamp || o.createdAt).toLocaleString('tr-TR')} · ${o.receiver || o.source}${o.receiverSerial ? ' #' + o.receiverSerial : ''}</div><div class="m">${o.fix} · σH ${fmt(o.sigmaH)} · σV ${fmt(o.sigmaV)} · PDOP ${fmt(o.pdop, 1)} · ${o.sats ?? '—'} uydu · ${o.epochs} epok · ${fmt(o.duration, 1)} s · anten ${fmt(o.antennaHeight, 3)} m · ${o.mountpoint || o.correctionSource || ''}</div></div></div>`)}${!obs.length ? html`<div class="empty">Gözlem yok (elle / tasarım noktası)</div>` : null}</div>`;
}

/**
 * Devrenin iletken / kablo seçenekleri: telefonun hat tipleri ve eklentinin (AutoCAD) kataloğundaki, telefonda karşılığı
 * olmayan iletken / kablolar (4P+R, 2x4 NYY Al…). AutoCAD'den gelen ve listede olmayan iletken de seçili kalır.
 */
function devreSecenekleri(cat, c, install) {
  const tel = cat.lineTypesFor(c.role === 'AYD' ? 'AG' : c.role, install).map((x) => [x.name, malzemeYazisi(x.name)]);
  const ac = autocadSecenekleri(cat, c.role, install);
  const hepsi = tel.concat(ac);
  const simdiki = c.key && !hepsi.some((x) => x[0] === c.key) ? [[c.key, malzemeYazisi(circuitLabel(c, cat))]] : [];
  if (!ac.length) return simdiki.concat(tel);
  return simdiki.concat([{ group: 'Telefondaki tipler', options: tel }, { group: "AutoCAD'deki tipler", options: ac }]);
}
/** Seçili iletkenin kısa bilgisi: telefon tipinde teknik özellik ve poz, AutoCAD tipinde cinsi (ve çıplakta tel açılımı). */
function devreNotu(cat, c) {
  const ac = autocadDevresi(c);
  if (ac) {
    const cp = circuitParts(c, cat);
    const teller = cp && cp.unit === 'kg' ? ' · ' + cp.parts.map((p) => p.count + '× ' + p.conductor).join(' + ') : '';
    return "AutoCAD'deki tip · " + autocadCinsAdi(ac.cins) + teller;
  }
  const lt = cat.lineType(c.key);
  const cd = lt ? cat.conductor(lt.parts[0].conductor) : null;
  return cd ? (cd.tech || cd.family + ' · ' + (cd.kgPerKm ? cd.kgPerKm + ' kg/km' : '')) + (cd.yd ? ' · YD ' + cd.yd : '') : '';
}

export function LineScreen({ id }) {
  useBus(['project:computed']);
  const ps = app.ps, cat = ps.cat;
  const l0 = ps.lineById(id);
  const [d, setD] = useState(() => (l0 ? JSON.parse(JSON.stringify(l0)) : null));
  const [pick, setPick] = useState(false);
  if (!l0 || !d) return html`<${Title} title="Hat yok" />`;
  const li = ps.result.lineInfo.get(id) || {};
  const spans = ps.result.spans.filter((s) => s.lineId === id).sort((a, b) => a.seq - b.seq);
  const set = (p) => setD((x) => Object.assign({}, x, p));
  const setC = (i, p) => setD((x) => Object.assign({}, x, { circuits: x.circuits.map((c, j) => (j === i ? Object.assign({}, c, p) : c)) }));
  const setCable = (p) => setD((x) => Object.assign({}, x, { cable: Object.assign({}, x.cable || {}, p) }));
  // Kanal zemini seçimi: cins / kaplama / bariyer / trencher birlikte yazılır, poz anahtarı (surface) onlardan; AutoCAD'in kural dışı adı bırakılır
  const setZemin = (p) => setD((x) => {
    const km = kanalModel(x.cable);
    const z = Object.assign({ zemin: km.zemin || 'toprak', kaplama: km.kaplama || '', bariyer: !!km.bariyer, trencher: !!km.trencher }, p);
    if (zeminOzelMi(z.zemin)) Object.assign(z, { kaplama: '', bariyer: false, trencher: false });
    const c = Object.assign({}, x.cable || {}, z, { surface: zemindenSurface(z), method: km.method });
    delete c.zeminHam;
    return Object.assign({}, x, { cable: c });
  });
  const dirty = JSON.stringify(d) !== JSON.stringify(l0);
  const auto = autoRecipeOn(ps.p);
  const num = (v) => +String(v).replace(',', '.');
  const matLabel = (key) => { const m = (cat.table('materialsMaster') || []).find((x) => x.key === key); return m ? m.label : key; };
  const addManual = async (servis) => {
    const pz = cat.poz(servis);
    const v = await app.prompt('Malzeme ekle · ' + (pz ? pz.name : servis), 'Miktar (' + (pz ? pz.unit : 'Ad') + ')', { value: '1', required: true });
    if (!v) return;
    try { await ps.addMaterial('line', id, servis, num(v)); app.toast((pz ? pz.name : servis) + ' eklendi', 'ok'); setPick(false); } catch (err) { app.toast(err.message, 'err', 6000); }
  };
  const manualQty = async (m) => {
    const v = await app.prompt('Miktar · ' + (m.name || ''), 'Yeni miktar (' + m.unit + ')', { value: String(m.qty), required: true });
    if (!v) return;
    try { await ps.setMaterialRowQty(m.materialId, num(v)); } catch (err) { app.toast(err.message, 'err'); }
  };
  const iss = ps.result.issues.filter((i) => i.entityId === id);
  const save = async () => { const { id: _i, createdAt, updatedAt, rev, createdBy, updatedBy, ...patch } = d; await ps.updateLine(id, patch, 'Hat kaydı güncellendi'); app.toast(d.lineNo + ' kaydedildi'); };
  const roleOpts = d.lineType === 'OG' || d.lineType === 'ENH' ? [[d.lineType, d.lineType], ['AG', 'AG (müşterek)'], ['AYD', 'AYD']] : d.lineType === 'ABONE' ? [['ABONE', 'ABONE']] : [['AG', 'AG'], ['AYD', 'AYD']];
  const merge = async () => {
    const ends = [l0.nodes[0], l0.nodes[l0.nodes.length - 1]];
    const cands = ps.data.lines.filter((x) => x.id !== id && (ends.includes(x.nodes[0]) || ends.includes(x.nodes[x.nodes.length - 1])));
    if (!cands.length) return app.toast('Ortak uçlu hat yok', 'warn');
    const bid = await app.modal((close) => html`<div class="mh"><h3>Birleştirilecek hat</h3></div><div class="mb" style="padding:0"><div class="list">${cands.map((c) => html`<button class="li" onClick=${() => close(c.id)}><div class="grow"><div class="t">${c.lineNo}</div><div class="s">${lineLabelText(c, cat)}</div></div></button>`)}</div></div>`);
    if (bid) { try { await ps.mergeLines(id, bid); app.toast('Birleştirildi'); } catch (e) { app.toast(e.message, 'err'); } }
  };
  const offset = async () => {
    const v = await app.prompt('Ofset hat (tasarım)', 'Mesafe m (+ sağ, − sol)', { value: '5', required: true, note: 'Seçili hattın paralelinde TASARIM noktaları ve yeni hat oluşturulur (aplikasyon için).' });
    if (!v) return;
    const pts = l0.nodes.map((n) => ps.pointById(n)).filter(Boolean);
    const off = offsetPolyline(pts, +String(v).replace(',', '.'));
    const ids = [];
    for (const [i, q] of off.entries()) { const p = await ps.createPoint({ pointNo: ps.nextPointNo('T'), cls: 'TASARIM', critical: false, coord: { E: q.E, N: q.N, H: pts[i].H }, source: 'DESIGN' }); ids.push(p.id); }
    const nl = await ps.createLine(Object.assign({}, { lineType: l0.lineType, install: l0.install, circuits: l0.circuits, state: 'ILERIDE', nodes: ids, name: l0.lineNo + ' ofset ' + v + ' m' }));
    app.toast(nl.lineNo + ' ofset hat oluşturuldu (İLERİDE)');
  };
  const cb = Object.assign({}, CABLE_DEFAULTS, d.cable || {});
  return html`<${Title} title=${d.lineNo + ' · ' + d.lineType} sub=${lineLabelText(l0, cat) + ' · ' + trn(li.length3D, 2) + ' m'} right=${html`<button class="btn sm" title="Bu hat için teknik hesaplar" onClick=${() => app.nav.go('hesapMerkezi', { hedef: { tur: 'hat', id } })}><${Icon} n="calc" s=${16} />Hesaplar</button>`} />
    ${iss.map((i) => html`<div class=${'alert ' + (i.severity === 'error' ? 'err' : 'warn')}><${Badge} k=${CODE_KIND[i.code]}>${i.code}</${Badge}> ${i.message}</div>`)}
    <div class="grid3"><div class="stat"><b>2B</b><span>${trn(li.length2D, 2)}</span><small>m</small></div><div class="stat"><b>3B</b><span>${trn(li.length3D, 2)}</span><small>m</small></div><div class="stat"><b>Kaynak</b><span style="font-size:15px">${li.lenSource || '—'}</span></div></div>
    <div class="card stack">
      <div class="grid2"><div class="fld"><label>Hat no</label><input class="inp mono" value=${d.lineNo} onChange=${(e) => set({ lineNo: e.target.value })} /></div><div class="fld"><label>Hat adı</label><input class="inp" value=${d.name || ''} placeholder="ör. Kurtdere OG fideri" onChange=${(e) => set({ name: e.target.value })} /></div></div>
      <div class="fld"><label>Hat tipi</label><${Seg} value=${d.lineType} options=${['AG', 'OG', 'AYD', 'ENH', 'ABONE']} onChange=${(v) => set({ lineType: v })} /></div>
      <div class="grid2"><div class="fld"><label>Tesis</label><${Seg} value=${d.install} options=${[['havai', 'Havai'], ['yeralti', 'Yeraltı']]} onChange=${(v) => set({ install: v })} /></div><div class="fld"><label>Gerilim (kV)</label><input class="inp mono" type="number" step="0.1" value=${d.voltageKV ?? (d.lineType === 'OG' || d.lineType === 'ENH' ? 34.5 : 0.4)} onChange=${(e) => set({ voltageKV: +e.target.value })} /></div></div>
      <div class="fld"><label>Durum</label><div class="chips">${Object.entries(STATUSES).map(([k, v]) => html`<${Chip} on=${d.state === k} onClick=${() => set({ state: k })}>${v.label.split(' ·')[0]}</${Chip}>`)}</div></div>
      <${CizimDurum} d=${d} set=${set} />
      <div class="row"><span class="grow">${d.install === 'yeralti' ? 'Aynı kanalda AG ve OG kablosu' : 'Müşterek (AG+OG aynı direk)'}</span><${Toggle} on=${!!d.musterek} onChange=${(v) => set({ musterek: v })} label="Müşterek" /></div>
      <div class="row"><span class="grow">Ana ring</span><${Toggle} on=${!!d.ring} onChange=${(v) => set({ ring: v })} label="Ring" /></div>
      ${d.lineType === 'ABONE' ? html`<div class="grid2"><div class="fld"><label>Faz</label><${Seg} value=${d.abonePhase || 'uc'} options=${[['tek', 'Tek'], ['uc', 'Üç']]} onChange=${(v) => set({ abonePhase: v })} /></div><div class="fld"><label>Bağlantı sayısı</label><input class="inp mono" type="number" value=${d.aboneCount || 1} onChange=${(e) => set({ aboneCount: +e.target.value })} /></div></div>` : null}
      <div class="fld"><label>Faz yapısı</label><input class="inp mono" value=${d.phaseConfig || (d.lineType === 'ABONE' && d.abonePhase === 'tek' ? '1F+N' : '3F+N')} onChange=${(e) => set({ phaseConfig: e.target.value })} /></div>
    </div>
    <div class="sect">İletken / kablo devreleri <span class="r"><button class="btn xs" onClick=${() => set({ circuits: [...d.circuits, { role: roleOpts[0][0], key: cat.lineDefault(roleOpts[0][0], d.install), count: 1 }] })}>+ Devre</button></span></div>
    ${d.circuits.map((c, i) => html`<div class="card stack"><div class="row"><${Sel} value=${c.role} options=${roleOpts} onChange=${(v) => setC(i, { role: v })} /><select class="inp mono" style="width:70px" value=${c.count || 1} onChange=${(e) => setC(i, { count: +e.target.value })}>${[1, 2, 3, 4].map((n) => html`<option value=${n}>${n}×</option>`)}</select><button class="btn dang sm" aria-label="Sil" disabled=${d.circuits.length < 2} onClick=${() => set({ circuits: d.circuits.filter((_, j) => j !== i) })}><${Icon} n="x" s=${16} /></button></div>
      ${c.custom ? html`<div class="mono note">Çıplak: ${malzemeYazisi(circuitLabel(c, cat))}</div>` : html`<${Sel} mono value=${c.key} options=${devreSecenekleri(cat, c, d.install)} onChange=${(v) => setC(i, { key: v, custom: null })} />`}
      <div class="note">${devreNotu(cat, c)}</div></div>`)}
    ${d.install === 'yeralti' ? (() => { const km = kanalModel(d.cable); const kn = li.cable && li.cable.kanal; const fld = ([k, l]) => html`<div class="fld"><label>${l}</label><input class="inp mono" type="number" step="0.05" value=${(d.cable || {})[k] ?? (k === 'joints' || k === 'depth' ? '' : cb[k])} onChange=${(e) => setCable({ [k]: e.target.value === '' ? null : +e.target.value })} /></div>`;
      return html`<div class="sect">Kanal</div><div class="card stack">
      ${!km.yeni && (km.eski === 'direk' || km.eski === 'duvar') ? html`<div class="alert warn" style="font-size:12px">Bu kayıt eski "${km.eski === 'direk' ? 'Direk inişi' : 'Duvar geçişi'}" türündeydi; bu tür kaldırıldı. Kaplama ve yöntemi seçip kaydedin.</div>` : null}
      <div class="fld"><label>Cins (zemin)</label><div class="chips">${Object.entries(ZEMIN_CINSI).map(([k, l]) => html`<${Chip} on=${km.zemin === k && !(d.cable || {}).zeminHam} onClick=${() => setZemin({ zemin: k })}>${l}</${Chip}>`)}</div></div>
      ${zeminOzelMi(km.zemin) ? null : html`<div class="fld"><label>Kaplama</label><div class="chips">${Object.entries(KAPLAMA_TURU).map(([k, l]) => html`<${Chip} on=${km.kaplama === k && !(d.cable || {}).zeminHam} onClick=${() => setZemin({ kaplama: k })}>${l}</${Chip}>`)}<${Chip} on=${!!km.bariyer} onClick=${() => setZemin({ bariyer: !km.bariyer })}>Bariyerli</${Chip}><${Chip} on=${!!km.trencher} onClick=${() => setZemin({ trencher: !km.trencher })}>Trencher</${Chip}></div></div>`}
      <div class="note mono">AutoCAD kalem adı: ${kanalZeminTanimi(d.cable)}${(d.cable || {}).zeminHam ? ' (AutoCAD\'den geldiği gibi; seçim yapınca değişir)' : ''}</div>
      <div class="fld"><label>Yöntem</label><div class="chips">${Object.entries(YONTEM).map(([k, l]) => html`<${Chip} on=${km.method === k} onClick=${() => setCable(Object.assign({ surface: km.surface, method: k, zemin: km.zemin, kaplama: km.kaplama, bariyer: km.bariyer, trencher: km.trencher }, k === 'borulu' && !((d.cable || {}).pipeCount > 0) ? { pipeCount: 1 } : {}))}>${l}</${Chip}>`)}</div></div>
      <div class="grid3">${[['depth', 'Derinlik m *'], ['width', 'Genişlik m']].map(fld)}${km.method !== 'acik' ? [['pipeDia', 'Boru Ø mm'], ['pipeCount', 'Boru adet']].map(fld) : null}</div>
      ${kn && kn.eski ? html`<div class="alert warn">Bu hat eski sürümde “${kn.eski === 'direk' ? 'Direk inişi' : 'Duvar geçişi'}” olarak girilmiş; bu seçenek kaldırıldı ve kazı hesaplanmıyor. Burada kanal açılıyorsa yukarıdan kaplamayı seçin.</div>` : null}
      ${kn ? html`<div class="kv mono" style="font-size:12px"><b>Kanal boyu</b><span>${trn(kn.uzunluk, 2)} m</span>${kn.method === 'sondaj' ? html`<b>Yatay sondaj</b><span class="hl">${trn(kn.uzunluk, 2)} m</span>` : html`<b>Kazı hacmi</b><span class="hl">${trn(kn.uzunluk, 2)} × ${kn.genislik} × ${kn.derinlik} = ${trn(kn.hacim, 2)} m³</span>`}${kn.boru ? html`<b>Boru</b><span>${trn(kn.boru, 2)} m</span>` : null}</div>` : html`<div class="note">Kaplama ve yöntemi seçip kaydedince kanal hesabı burada görünür.</div>`}
      </div>
      ${d.channelOnly && !(d.circuits || []).length ? null : html`<div class="sect">Kablo boyu payları</div><div class="card stack">
      <div class="grid3">${[['riserM', 'Dikey iniş m'], ['exitM', 'Çıkış payı m'], ['trafoM', 'Trafo payı m'], ['sdkM', 'SDK payı m'], ['joints', 'Muf (boş=oto)'], ['jointM', 'Muf payı m'], ['drumM', 'Makara m'], ['reserveM', 'Rezerv m']].map(fld)}</div>
      ${li.cable ? html`<div class="kv mono" style="font-size:12px"><b>Kanal</b><span>${trn(li.cable.breakdown.kanal, 2)} m</span><b>+ Dikey iniş</b><span>${trn(li.cable.breakdown.dikeyInis, 2)} (${li.cable.breakdown.risers} iniş)</span><b>+ Çıkış</b><span>${trn(li.cable.breakdown.cikis, 2)}</span><b>+ Trafo / SDK</b><span>${trn(li.cable.breakdown.trafoPayi, 2)} / ${trn(li.cable.breakdown.sdkPayi, 2)}</span><b>+ Muf payı</b><span>${trn(li.cable.breakdown.mufPayi, 2)} (${li.cable.breakdown.joints} muf)</span><b>+ Rezerv</b><span>${trn(li.cable.breakdown.rezerv, 2)}</span><b>= Damar boyu</b><span class="hl">${trn(li.cable.breakdown.damar, 2)} m</span></div>` : null}</div>`}
      ${auto ? html`<div class="sect">Otomatik yardımcı malzeme ayarları</div><div class="card stack"><div class="grid3">${[['sandCm', 'Kum cm'], ['warningTape', 'Uyarı bandı'], ['concreteCm', 'Beton cm']].map(fld)}</div>
        <div class="row"><span class="grow">Koruma plakası</span><${Toggle} on=${cb.protectionPlate} onChange=${(v) => setCable({ protectionPlate: v })} label="Koruma plakası" /></div></div>` : null}`; })() : null}
    <div class="sect">Malzemeler <span class="r mono">${(li.items || []).length} kalem</span></div>
    <div class="card tight list">${(li.items || []).map((m) => { const pz = m.servis ? cat.poz(m.servis) : null; const ad = m.name || (pz ? pz.name : '') || m.conductor || matLabel(m.material) || '?'; return html`<div class="li"><${Badge} k=${m.manual ? 'cy' : 'ok'}>${m.manual ? 'EKLENEN' : m.kanal || m.material ? 'KANAL' : 'HAT'}</${Badge}><div class="grow"><div class="t" style="font-size:13px">${ad}</div><div class="m">${m.servis || (m.material ? 'poz eşlenmemiş' : 'katalogda yok')}${m.why && !m.manual ? ' · ' + m.why : ''}</div></div>
      ${m.manual ? html`<button class="btn xs" onClick=${() => manualQty(m)}><b class="mono">${trn(m.qty, m.unit === 'Ad' ? 0 : 2)}</b> ${m.unit}</button><button class="btn xs dang" aria-label="Malzemeyi kaldır" onClick=${async () => { if (await app.confirm('Malzemeyi kaldır', ad + ' listeden çıkarılsın mı?', { danger: true, ok: 'Kaldır' })) ps.removeMaterial(m.materialId, 'Kaldırıldı'); }}><${Icon} n="trash" s=${14} /></button>` : html`<b class="mono">${trn(m.qty, m.unit === 'Ad' ? 0 : 2)}</b><span class="note">${m.unit}</span>`}</div>`; })}
      ${!(li.items || []).length ? html`<div class="empty">Kalem yok</div>` : null}</div>
    ${auto ? null : html`<div class="note">Bu projede otomatik reçete kapalı: hatta yalnız iletken / kablo boyu ve kanal hesabı kendiliğinden gelir. Kum, uyarı bandı, koruma plakası, muf, başlık gibi malzemeleri "Malzeme ekle" ile ekleyin.</div>`}
    ${li.job ? html`<button class="btn blk" style="border-style:dashed;border-color:#f59e0b;color:#fcd34d" onClick=${() => setPick(!pick)}><${Icon} n=${pick ? 'x' : 'plus'} s=${18} />${pick ? 'Malzeme seçimini kapat' : 'Malzeme ekle'}</button>` : null}
    ${pick ? html`<${MaterialPicker} job=${li.job} onAdd=${addManual} />` : null}
    <div class="sect">Düğümler (${d.nodes.length})</div>
    <div class="card tight list">${d.nodes.map((n, i) => { const p = ps.pointById(n); const e = p ? ps.eqAt(p.id)[0] : null; const r = e ? ps.result.roles.get(e.id) : null; return html`<div class="li"><span class="m" style="width:22px">${i + 1}</span><div class="grow"><div class="t">${e ? e.no : p ? p.pointNo : '(silinmiş)'}</div><div class="s">${r && r.role ? r.role + (r.angle ? ' · α ' + dms(r.angle) : '') : p ? p.cls : ''}</div></div><button class="btn xs" disabled=${i === 0 || i === d.nodes.length - 1} onClick=${async () => { await ps.splitLine(id, i); app.toast('Bölündü'); app.nav.back(); }}>Böl</button><button class="btn xs dang" onClick=${() => ps.removeNode(id, i).then(() => setD(JSON.parse(JSON.stringify(ps.lineById(id)))))}>Çıkar</button></div>`; })}</div>
    <div class="sect">Açıklıklar</div>
    <div class="card tight scrollx"><table class="t"><thead><tr><th>Açıklık</th><th class="n">2B m</th><th class="n">3B m</th><th class="n">ΔH m</th><th class="n">Semt</th></tr></thead><tbody>${spans.map((s) => html`<tr><td class="mono">${s.fromNo}→${s.toNo}</td><td class="n">${fmt(s.length2D)}</td><td class="n">${fmt(s.length3D)}</td><td class="n">${(s.dH >= 0 ? '+' : '') + fmt(s.dH)}</td><td class="n">${dms(s.bearing)}</td></tr>`)}</tbody></table></div>
    <div class="grid2" style="margin-top:10px">
      <button class="btn" onClick=${() => { app.state.activeLineId = id; app.state.capTab = 'hat'; app.nav.tab('map'); }}>Uzat (devam çiz)</button>
      <button class="btn" onClick=${() => ps.reverseLine(id).then(() => setD(JSON.parse(JSON.stringify(ps.lineById(id)))))}>Ters çevir</button>
      <button class="btn" onClick=${merge}>Birleştir</button>
      <button class="btn" onClick=${() => renumberDialog(id)}>№ Direklere numara ver</button>
      <button class="btn" onClick=${offset}>Ofset hat</button>
      ${d.lineType === 'OG' || d.lineType === 'ENH' ? html`<button class="btn" onClick=${() => app.nav.go('enh', { id })}>ENH hesabı</button>` : html`<span></span>`}
      <button class="btn dang" onClick=${async () => { const r = await app.prompt('Hattı sil', 'Gerekçe', { required: true }); if (r) { await ps.removeLine(id, r); app.nav.back(); } }}>Sil</button>
    </div>
    ${hakOf(d) ? html`<div class="card stack" style="margin-top:10px"><div class="lbl">Hakediş durumu · <span style=${'color:' + HAK_STATUSES[hakOf(d)].color}>${HAK_STATUSES[hakOf(d)].label}</span></div>
      ${ps.approval().on ? html`<${HakRow} type="line" rec=${l0} noLabel=${true} onDone=${(r) => r && set({ hak: r.hak, progress: r.progress, workDate: r.workDate, hakLog: r.hakLog })} />` : html`<div class="hakrow">${HAK_ORDER.map((k) => html`<button class=${k === hakOf(d) ? 'on' : ''} style=${'--c:' + HAK_STATUSES[k].color} onClick=${() => set({ hak: k, progress: HAK_STATUSES[k].done ? 'done' : 'planned', workDate: HAK_STATUSES[k].done ? (d.workDate || new Date().toISOString().slice(0, 10)) : null })}><i></i>${HAK_STATUSES[k].short}</button>`)}</div>`}
      <${HakHistory} rec=${l0} /></div>` : html`<div class="note" style="margin-top:10px">Hakediş: — (mevcut / ileride)</div>`}
    ${d.progress === 'done' ? html`<div class="fld"><label>Montaj tarihi</label><input class="inp mono" type="date" value=${d.workDate || ''} onChange=${(e) => set({ workDate: e.target.value })} /></div>` : null}
    <div class="fld" style="margin-top:8px"><label>Açıklama</label><textarea class="inp" value=${d.note || ''} onInput=${(e) => set({ note: e.target.value })}></textarea></div>
    <div class="row" style="position:sticky;bottom:-24px;background:var(--bg);padding:12px 0;border-top:1px solid var(--line2);margin-top:8px"><button class="btn" style="flex:0 0 32%" onClick=${() => (dirty ? setD(JSON.parse(JSON.stringify(l0))) : app.nav.back())}>${dirty ? 'Geri al' : 'Kapat'}</button><button class="btn pri grow" style="height:56px" disabled=${!dirty} onClick=${save}>KAYDET · ${d.lineNo}</button></div>`;
}

// Fotoğraf / kanıt: uygulama içi kamera, zaman-konum-yön damgası
// Fotoğraf: bir objeye çoklu çekim. Dosya adı {ObjeNo}_{Sıra}.jpg; görüntü üstüne proje/obje/tarih/koordinat/doğruluk/fix yazılır,
// EXIF'e GPS + tarih işlenir; APK'da ayrıca İndirilenler/Sebeke-M/<PROJE>/<TÜR>/<ObjeNo>/ klasörüne kopyalanır.
export function PhotoScreen({ ownerId, pointId, ownerNo, slot, ownerKind }) {
  const ps = app.ps;
  const vid = useRef(null), stream = useRef(null);
  const [err, setErr] = useState(null);
  const [heading, setHeading] = useState(null);
  const [note, setNote] = useState(slot || '');
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState([]);
  const eq = ps.eqById(ownerId), ln = eq ? null : ps.lineById(ownerId);
  const kind = ownerKind || (eq ? eq.kind : ln ? 'line' : 'point');
  const existing = ps.data.photos.filter((x) => x.ownerId === ownerId).length;
  useEffect(() => {
    (async () => {
      if (app.web) { setErr('Web sürümünde kamera yok. "Dosyadan ekle" ile bilgisayardaki fotoğrafları seçin; fotoğraflar yalnız bu tarayıcıda saklanır (buluta yazılmaz).'); return; }
      try { stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }); vid.current.srcObject = stream.current; await vid.current.play(); }
      catch (e) { setErr('Kamera açılamadı: ' + e.message + ' · Galeriden seçebilirsiniz'); }
    })();
    const onOri = (e) => { const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : e.absolute && e.alpha != null ? (360 - e.alpha) % 360 : null; if (h != null) setHeading(h); };
    window.addEventListener('deviceorientationabsolute', onOri); window.addEventListener('deviceorientation', onOri);
    return () => { if (stream.current) stream.current.getTracks().forEach((t) => t.stop()); window.removeEventListener('deviceorientationabsolute', onOri); window.removeEventListener('deviceorientation', onOri); };
  }, []);
  const stampAndSave = async (source, origBytes) => {
    if (busy) return;
    setBusy(true);
    try {
      const g = app.gnss.state;
      const w = source.videoWidth || source.naturalWidth || source.width, h = source.videoHeight || source.naturalHeight || source.height;
      const k = Math.min(1, 1920 / Math.max(w, h));
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      const x = c.getContext('2d'); x.drawImage(source, 0, 0, c.width, c.height);
      const p = pointId ? ps.pointById(pointId) : null;
      const now = new Date();
      const lines = overlayLines({ project: ps.p, ownerNo: ownerNo || '', kind, when: now, point: p, gnss: g, operator: ps.ds.user.name, heading, note });
      const fs = Math.max(14, Math.round(Math.min(c.width, c.height) / 34));
      x.fillStyle = 'rgba(11,19,38,.72)'; x.fillRect(0, c.height - fs * 1.35 * lines.length - fs * 0.6, c.width, fs * 1.35 * lines.length + fs * 0.6);
      x.fillStyle = '#fff'; x.font = '600 ' + fs + 'px JetBrains Mono, monospace';
      lines.forEach((t, i) => x.fillText(t, fs * 0.6, c.height - fs * 1.35 * (lines.length - i - 1) - fs * 0.6, c.width - fs * 1.2));
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
      let bytes = new Uint8Array(await blob.arrayBuffer());
      // EXIF: galeri fotoğrafında orijinal EXIF korunur (yön düzeltilir); yoksa GPS + tarih yazılır
      const lat = p && p.lat != null ? p.lat : g.lat, lon = p && p.lon != null ? p.lon : g.lon;
      const acc = p && p.quality ? p.quality.sigmaH : g.sigmaH;
      const orig = origBytes ? extractExif(origBytes) : null;
      bytes = withExif(bytes, orig ? resetOrientation(orig) : buildExif({ lat, lon, alt: p && p.H != null ? p.H : g.H, heading, accuracy: acc, date: now, description: ps.p.name + ' - ' + (ownerNo || '') + ' - ' + kindLabel(kind), artist: ps.ds.user.name, model: (g.receiver || {}).name || 'Telefon' }));
      const nm = nextPhotoName(ps.data.photos, ownerId, ownerNo || 'OBJE');
      const filepath = photoPath(kind, ownerNo || 'OBJE', nm.filename);
      await ps.addPhoto(bytes, 'image/jpeg', { ownerId, ownerNo, ownerType: kind, pointId, pointNo: p ? p.pointNo : null, slot: slot || null, filename: nm.filename, filepath, seq: nm.seq,
        lat: lat ?? null, lon: lon ?? null, elevation: p && p.H != null ? p.H : g.H ?? null, E: p ? p.E : g.E, N: p ? p.N : g.N, accuracy: acc ?? null, fix: p ? sourceInfo(p).tag : g.fix, heading, note, width: c.width, height: c.height, device: (g.receiver || {}).name || null, operator: ps.ds.user.name, exifKept: !!orig });
      // Fiziksel klasör (yalnız APK): İndirilenler/Sebeke-M/<PROJE>/DIREKLER/D-001/D-001_01.jpg
      if (app.bridge.isNative() && (await app.ds.setting('photoToDevice')) !== false) { try { await app.bridge.saveFile(nm.filename, 'image/jpeg', bytes, { dir: projectFolder(ps.p) + '/' + filepath.split('/').slice(0, -1).join('/') }); } catch (e) { app.toast('Telefona kopyalanamadı: ' + e.message, 'warn'); } }
      setTaken((t) => [...t, nm.filename]);
      app.toast(nm.filename + ' kaydedildi', 'ok', 1800);
      app.bridge.vibrate(40);
      if (slot) app.nav.back();
    } catch (e) { app.toast('Fotoğraf kaydedilemedi: ' + e.message, 'err', 5000); }
    setBusy(false);
  };
  const fromFile = async (f) => { if (!f) return; const ob = new Uint8Array(await f.arrayBuffer()); const img = new Image(); img.src = URL.createObjectURL(f); await img.decode(); await stampAndSave(img, ob); };
  return html`<div class="cam"><div class="row" style="padding:10px 12px;background:#0b1326"><button class="backbtn" aria-label="Geri" onClick=${() => app.nav.back()}><${Icon} n="back" /></button><div class="grow"><b>${ownerNo} · ${slot || kindLabel(kind)}</b><div class="note mono">${existing + taken.length} fotoğraf${taken.length ? ' · son: ' + taken[taken.length - 1] : ''} · ${heading != null ? 'Yön ' + heading.toFixed(0) + '°' : 'pusula yok'} · ${app.gnss.state.fix}</div></div><button class="btn pri sm" onClick=${() => app.nav.back()}>Bitti</button></div>
    ${err ? html`<div class="alert warn" style="margin:12px">${err}</div>` : null}
    <video ref=${vid} playsinline muted></video>
    <div style="padding:8px 12px;background:#0b1326"><input class="inp" placeholder="Açıklama (ör. taban, topraklama)" value=${note} onInput=${(e) => setNote(e.target.value)} /></div>
    <div class="ctl"><label class=${'btn' + (app.web ? ' pri' : '')}>${app.web ? 'Dosyadan ekle' : 'Galeri'}<input type="file" accept="image/*" multiple style="display:none" onChange=${async (e) => { for (const f of [...e.target.files]) await fromFile(f); e.target.value = ''; }} /></label><button class="shutter" aria-label="Çek" hidden=${!!app.web} disabled=${!!err || busy} onClick=${() => stampAndSave(vid.current)}></button><span style="width:80px;text-align:center" class="mono note">${taken.length ? '+' + taken.length : ''}</span></div></div>`;
}
PhotoScreen.noHud = true; PhotoScreen.noTabs = true; PhotoScreen.flush = true;
