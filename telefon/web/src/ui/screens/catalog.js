// 07 · Poz Kataloğu · 08 · Katmanlar & Lejant · 09 · Tanımlar (tek veri kaynağı)
import { html, useState, useEffect, useBus, Icon, Chip, Seg, Sel, Badge, Title, Toggle, Stepper, fmt, trn } from '../kit.js';
import { app } from '../ctx.js';
import { applyRules, recipeContext, autoRecipeOn } from '../../grid/recipe.js';
import { roleLabel } from '../../grid/checks.js';
import { JOB_LABEL } from '../../core/schema.js';
import { listStandards, cloneStandard, updateStdTable, exportStandard } from '../../core/standards.js';
import { Catalog } from '../../grid/catalog.js';
import STIL from '../../ortak/cizim-stili.js';
import { aciCSS } from '../../cad/aci.js';
import { EKRAN, DEMONTAJ_RENGI, ekranDeseni } from '../cizim-gorunumu.js';

export function PozScreen({ pickFor }) {
  const ps = app.ps, cat = ps.cat;
  const [q, setQ] = useState('');
  const [job, setJob] = useState('montaj');
  const [catg, setCatg] = useState(null);
  const [only, setOnly] = useState(false);
  const [sel, setSel] = useState(null);
  const [n, setN] = useState(80);
  const cats = cat.categories();
  let rows = cat.searchPoz(q, { job, category: catg, limit: 5000 });
  if (only) rows = rows.filter((p) => p.inGreenBook);
  const cnt = (j) => cat.t.poz.filter((p) => cat.pozAvailable(p.servis, j)).length;
  const selP = sel ? cat.poz(sel) : null;
  const importPrices = async (f) => {
    const txt = await f.text(); let nOk = 0;
    for (const line of txt.split(/\r?\n/)) {
      const c = line.split(/[;\t,]/).map((x) => x.trim()); if (!/^\d{3}\.\d{2}/.test(c[0] || '')) continue;
      const p = cat.poz(c[0]); if (!p) continue;
      const pm = parseFloat((c[1] || '').replace(/\./g, '').replace(',', '.')), pl = parseFloat((c[2] || '').replace(/\./g, '').replace(',', '.'));
      const upd = Object.assign({}, p, { priceMaterial: Number.isFinite(pm) ? pm : p.priceMaterial, priceLabor: Number.isFinite(pl) ? pl : p.priceLabor, priceSource: f.name });
      await app.ds.db.put('poz', upd); Object.assign(p, upd); nOk++;
    }
    await app.ds._audit('poz', { id: cat.stdId + ':prices' }, 'import', [], 'Birim fiyat içe aktarıldı: ' + f.name + ' · ' + nOk + ' poz');
    app.toast(nOk + ' pozun fiyatı güncellendi'); await ps.recompute('Fiyatlar');
  };
  // Kataloğa kalem ekle / yerel kalemi düzelt (poz numarası sonradan girilebilir)
  const editPoz = async (p0) => {
    const d = p0 ? Object.assign({}, p0) : { name: '', unit: 'Ad', pozNo: '', category: catg || 'Aydınlatma', code: '' };
    const r = await app.modal((close) => html`<div class="mh"><h3>${p0 ? 'Kalemi düzelt' : 'Kataloğa kalem ekle'}</h3></div><div class="mb">
        <div class="fld"><label>Kalem adı *</label><input class="inp" value=${d.name} placeholder="ör. 90 W LED Yol Aydınlatma Armatürü" onInput=${(e) => { d.name = e.target.value; }} /></div>
        <div class="grid2"><div class="fld"><label>Birim</label><select class="inp" value=${d.unit} onChange=${(e) => { d.unit = e.target.value; }}>${['Ad', 'm', 'Kg', 'Tk', 'm²', 'm³'].map((u) => html`<option value=${u}>${u}</option>`)}</select></div>
          <div class="fld"><label>Poz no (varsa)</label><input class="inp mono" value=${d.pozNo || ''} placeholder="ör. 20.7.3-02" onInput=${(e) => { d.pozNo = e.target.value; }} /></div></div>
        <div class="fld"><label>Grup</label><select class="inp" value=${d.category} onChange=${(e) => { d.category = e.target.value; }}>${cats.map((c) => html`<option value=${c}>${c}</option>`)}</select></div>
        ${p0 ? html`<div class="note mono">Kod: ${p0.servis}</div>` : html`<div class="fld"><label>Servis kodu (Yeşil Defter'de varsa)</label><input class="inp mono" value=${d.code} placeholder="boş bırakılırsa YEREL:… kodu verilir" onInput=${(e) => { d.code = e.target.value; }} /></div>`}
        <div class="grid2"><div class="fld"><label>Malzeme fiyatı (TL)</label><input class="inp mono" type="number" step="0.01" value=${d.priceMaterial ?? ''} onInput=${(e) => { d.priceMaterial = e.target.value === '' ? null : +e.target.value; }} /></div><div class="fld"><label>Montaj fiyatı (TL)</label><input class="inp mono" type="number" step="0.01" value=${d.priceLabor ?? ''} onInput=${(e) => { d.priceLabor = e.target.value === '' ? null : +e.target.value; }} /></div></div>
      </div><div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn pri grow" onClick=${() => close(d)}>Kaydet</button></div>`);
    if (!r) return;
    if (!String(r.name || '').trim()) return app.toast('Kalem adı gerekli', 'warn');
    let row;
    if (p0) row = Object.assign({}, p0, { name: r.name.trim(), unit: r.unit, pozNo: String(r.pozNo || '').trim() || null, bfPoz: String(r.pozNo || '').trim() || p0.bfPoz || null, category: r.category, priceMaterial: r.priceMaterial ?? null, priceLabor: r.priceLabor ?? null, userEdited: true });
    else {
      const code = String(r.code || '').trim() || 'YEREL:' + r.name.trim().toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) + '-' + Date.now().toString(36).slice(-3).toUpperCase();
      if (cat.poz(code)) return app.toast('Bu kod katalogda var: ' + code, 'warn', 4000);
      row = { id: cat.stdId + ':' + code, stdId: cat.stdId, servis: code, pozNo: String(r.pozNo || '').trim() || null, name: r.name.trim(), unit: r.unit, kgPerUnit: null, supply: 'Y', montaj: true, demontaj: true, dmm: true, kgGroup: '', category: r.category, bfPoz: String(r.pozNo || '').trim() || null, priceMaterial: r.priceMaterial ?? null, priceLabor: r.priceLabor ?? null, priceUnit: null, inGreenBook: false, validFrom: cat.std.validFrom, validTo: cat.std.validTo, source: 'Kullanıcı kalemi', verified: false, isKgGroup: false, userAdded: true };
    }
    const saved = await app.ds.putStd('poz', row, (p0 ? 'Katalog kalemi düzeltildi: ' : 'Kataloğa kalem eklendi: ') + row.name);
    cat.upsertPoz(saved); setSel(saved.servis); setQ(''); if (!p0) setCatg(saved.category);
    app.toast(p0 ? 'Kalem güncellendi' : 'Kalem eklendi · artık listelerden seçilebilir', 'ok', 3500);
    await ps.recompute('Katalog kalemi');
  };
  return html`<${Title} title="Poz Kataloğu" sub=${cat.std.name} right=${html`<button class="btn sm pri" onClick=${() => editPoz(null)}><${Icon} n="plus" s=${16} c="#0b1326" />Kalem ekle</button>`} />
    <div class="grid3">${['montaj', 'demontaj', 'dmm'].map((j) => html`<div class="stat"><b>${JOB_LABEL[j]}</b><span>${cnt(j)}</span></div>`)}</div>
    <div class="note">Veritabanındaki ${cat.t.poz.length} poz · sürüm ${cat.std.validFrom} – ${cat.std.validTo}. Birim fiyatlar CSV ile (servis;malzeme;montaj) güncellenebilir.</div>
    <div class="row"><${Icon} n="search" c="#94a3b8" /><input class="inp grow" placeholder="Servis poz no veya malzeme adı: GZ-12, 009…" value=${q} onInput=${(e) => { setQ(e.target.value); setN(80); }} /></div>
    <${Seg} value=${job} options=${[['montaj', 'Montaj'], ['demontaj', 'Demontaj'], ['dmm', 'DMM']]} onChange=${setJob} />
    <div class="row" style="overflow-x:auto;gap:6px;padding-bottom:2px"><${Chip} on=${!catg} onClick=${() => setCatg(null)}>Tümü</${Chip}>${cats.map((c) => html`<${Chip} on=${catg === c} onClick=${() => setCatg(c)}>${c} <span class="mono note">${cat.t.poz.filter((p) => p.category === c).length}</span></${Chip}>`)}</div>
    <div class="row"><${Toggle} on=${only} onChange=${setOnly} label="Defterde miktarı olanlar" /><span>Yalnız bu defterde miktarı olanlar</span><span class="grow"></span><label class="btn xs">Fiyat CSV<input type="file" accept=".csv,.txt" style="display:none" onChange=${(e) => e.target.files[0] && importPrices(e.target.files[0])} /></label></div>
    <div class="row"><span class="lbl grow">${catg || 'Tüm pozlar'} · ${rows.length} poz</span><span class="mono note">önek ${{ montaj: '0', demontaj: '1', dmm: '2' }[job]}xx</span></div>
    <div class="card tight list">${rows.slice(0, n).map((p) => html`<button class="li" style=${sel === p.servis ? 'box-shadow:inset 3px 0 0 #10b981;background:#0f2a22' : ''} onClick=${() => setSel(p.servis)}><div class="grow"><div class="m" style=${sel === p.servis ? 'color:#6ffbbe' : ''}>${cat.jobCode(p.servis, job)}${p.kgGroup ? ' · Kg grubu ' + p.kgGroup : ''}</div><div style="font-size:13px;font-weight:700">${p.name}</div><div class="m">Poz ${p.pozNo || '—'} · ${p.unit}${p.kgPerUnit ? ' · ' + p.kgPerUnit + ' kg/Ad' : ''} · Temin ${p.supply}${p.priceMaterial != null ? ' · ' + trn((p.priceMaterial || 0) + (p.priceLabor || 0), 2) + ' TL' : ''}</div></div>${p.inGreenBook ? html`<${Badge} k="ok">DEFTERDE</${Badge}>` : p.userAdded ? html`<${Badge} k="cy">EKLENEN</${Badge}>` : p.verified === false ? html`<${Badge} k="warn">DOĞRULANACAK</${Badge}>` : null}</button>`)}
      ${rows.length > n ? html`<button class="li" style="justify-content:center" onClick=${() => setN(n + 150)}>Daha fazla (${rows.length - n})</button>` : null}</div>
    ${selP ? html`<div class="card ok stack" style="position:sticky;bottom:-24px"><div class="row"><b class="grow">${selP.name}</b><button class="btn xs" onClick=${() => setSel(null)}><${Icon} n="x" s=${14} /></button></div>
      <div class="kv mono" style="font-size:12px"><b>Servis</b><span>${selP.servis} → ${cat.jobCode(selP.servis, 'demontaj')} / ${cat.jobCode(selP.servis, 'dmm')}</span><b>Sayfalar</b><span>${selP.montaj !== false ? 'Montaj ' : ''}${selP.demontaj ? 'Demontaj ' : ''}${selP.dmm ? 'DMM' : ''}</span><b>BF poz</b><span>${selP.bfPoz || '—'}</span><b>Geçerlilik</b><span>${selP.validFrom} – ${selP.validTo}</span></div>
      ${selP.verified === false && !selP.inGreenBook ? html`<div class="note hw">${selP.source || 'Doğrulanacak kalem'}${selP.pozConfirmed ? ' · poz numarası kaynakta görüldü' : ''}</div>` : null}
      ${selP.verified === false || selP.userAdded ? html`<button class="btn sm" onClick=${() => editPoz(selP)}><${Icon} n="edit" s=${16} />Ad / poz no / fiyat düzelt</button>` : null}
      ${pickFor ? html`<button class="btn pri" onClick=${() => { app.bus.emit('poz:picked', { servis: selP.servis, pickFor }); app.nav.back(); }}>KAYDA EKLE · ${selP.servis}</button>` : null}</div>` : null}`;
}

// Lejantta hat türleri: ortak çizim stilinin anahtarları (haritada, DXF'te ve AutoCAD eklentisinde aynı renk ve çizgi)
const HAT_LEJANTI = [['HAT_AG', 'A.G. havai hat', 2.5], ['HAT_OG', 'O.G. havai hat', 3.5], ['HAT_AYD', 'Aydınlatma hattı', 2.5], ['HAT_ENH', 'E.N.H. hattı', 4], ['HAT_MUSTEREK', 'Müşterek hat', 3.5], ['HAT_ABONE', 'Abone hattı', 1.6], ['KABLO', 'A.G. yeraltı kablosu', 2.5], ['KABLO_OG', 'O.G. yeraltı kablosu', 3.5], ['KANAL', 'Kablo kanalı (iki kenarlı)', 1.8], ['SONDAJ', 'Yatay sondaj', 2.5]];

export function LayersScreen() {
  const cat = app.ps.cat;
  const L = cat.table('legend') || { layers: [] };
  const [, f] = useState(0);
  const lay = app.state.layers || {};
  const t = (k) => { const n = Object.assign({ AG: true, OG: true, AYD: true, ENH: true, ABONE: true, yeralti: true, kanal: true, trafo: true, mevcut: true, demontaj: true }, app.state.layers || {}); n[k] = !n[k]; app.state.layers = n; f((x) => x + 1); };
  const on = (k) => lay[k] !== false;
  const sym = (shape, fill, col, ground) => html`<svg width="56" height="34" viewBox="0 0 56 34"><path d="M3 15H20 M36 15H53" stroke=${col} stroke-width="1.2" />${shape === 'c' ? html`<circle cx="28" cy="15" r="7" fill=${fill === 'full' ? col : '#0b1326'} stroke=${col} stroke-width="1.6" />${fill === 'half' ? html`<path d="M28 8a7 7 0 0 0 0 14Z" fill=${col} />` : null}` : html`<rect x="21" y="8" width="14" height="14" fill=${fill === 'full' ? col : '#0b1326'} stroke=${col} stroke-width="1.6" />${fill === 'none' ? html`<path d="M21 8l14 14M35 8L21 22" stroke=${col} />` : null}${fill === 'half' ? html`<path d="M21 8L28 15L21 22ZM35 8L28 15L35 22Z" fill=${col} />` : null}`}${ground ? html`<path d="M28 22v5 M22 27h12 M23 31l2-4 M27 31l2-4 M31 31l2-4" stroke=${col} />` : null}</svg>`;
  // Hat örneği: haritadaki renk ve çizgi deseniyle (kanalda iki kenar)
  const hatOrnegi = (k, lw) => { const st = STIL.katmanlar[k] || {}, col = EKRAN.hat[k] || EKRAN.diger, des = ekranDeseni(st.cizgi || 'CONTINUOUS', lw); return html`<svg width="64" height="14" viewBox="0 0 64 14" style="flex-shrink:0">${k === 'KANAL' ? html`<path d="M2 2H62 M2 12H62" stroke=${col} stroke-width="1.2" />` : null}<path d="M4 7H60" stroke=${col} stroke-width=${lw} stroke-linecap="round" stroke-dasharray=${des.length ? des.join(' ') : 'none'} /></svg>`; };
  const DR = STIL.direkRenkleri;
  const direkSatiri = (v) => ({ MEVCUT: EKRAN.direkMevcut[v], YENI: EKRAN.direk[v], DMM: aciCSS(DR[v][2]) });
  const rows = [['A.G. direği', 'c', 'AG', false], ['A.G. kafes direk', 's', 'AG', false], ['Müşterek / O.G. direk', 'c', 'OG', true], ['Müşterek / O.G. kafes', 's', 'OG', true], ['Aydınlatma direği', 'c', 'AYD', false], ['E.N.H. / B.A.H.H. direk', 'c', 'ENH', true]];
  const hatKatmanlari = new Set(HAT_LEJANTI.map(([k]) => k));
  const ozel = Object.entries(STIL.katmanlar).filter(([k, x], i, a) => x.telefon && !hatKatmanlari.has(k) && a.findIndex(([, y]) => y.telefon === x.telefon) === i);
  const H = EKRAN.hat;
  return html`<${Title} title="Katmanlar ve Lejant" sub="Ortak çizim stili · harita, DXF ve AutoCAD eklentisi aynı · 1/1000" />
    <div class="sect">Harita katmanları</div>
    <div class="grid2">${[['AG', 'A.G. şebeke', H.HAT_AG], ['OG', 'O.G. şebeke', H.HAT_OG], ['AYD', 'Aydınlatma', H.HAT_AYD], ['ENH', 'E.N.H. / B.A.H.H.', H.HAT_ENH], ['ABONE', 'Abone', H.HAT_ABONE], ['yeralti', 'Yeraltı kablosu', H.KABLO], ['kanal', 'Kanal kenarı ve sondaj', H.KANAL], ['trafo', 'Trafo ve box', EKRAN.trafo], ['mevcut', 'Mevcut elemanlar', EKRAN.direkMevcut.AG], ['demontaj', 'Demontaj (sarı)', DEMONTAJ_RENGI]].map(([k, l, c]) => html`<button class="card row" style="color:inherit;padding:10px" onClick=${() => t(k)}><span style=${'width:18px;height:3px;background:' + c}></span><span class="grow" style="font-size:13px;font-weight:600">${l}</span><${Icon} n=${on(k) ? 'check' : 'minus'} s=${16} c=${on(k) ? '#10b981' : '#475569'} /></button>`)}</div>
    <div class="sect">İş tipi → sembol durumu</div>
    <div class="card tight list">${[['Montaj', 'Yeni (dolu)', 'servis 0xx · yeni O.G. kafes', 'full'], ['DMM', 'Sökülüp tekrar dikilen (yarım dolu)', 'servis 2xx · BYSK', 'half'], ['Dokunulmayan', 'Mevcut (boş)', 'hakedişe girmez', 'none'], ['Demontaj', 'Mevcut + sarı çizgi', 'servis 1xx', 'none']].map(([j, s, n, m]) => html`<div class="li">${sym('s', m, m === 'none' ? EKRAN.direkMevcut.OG : EKRAN.direk.OG, true)}<div class="grow"><div><b>${j}</b> <span class="note">→ ${s}</span></div><div class="m">${n}</div></div></div>`)}</div>
    <div class="sect">Şebeke hatları · DXF katmanı</div>
    <div class="card tight list">${HAT_LEJANTI.map(([k, ad, lw]) => { const st = STIL.katmanlar[k] || {}; return html`<div class="li">${hatOrnegi(k, lw)}<div class="grow"><b style="font-size:13px">${ad}</b><div class="m">${st.telefon || ''} · ${st.cizgi || 'CONTINUOUS'}</div></div><span class="mono note">ACI ${st.aci}</span></div>`; })}
      <div class="li"><svg width="64" height="14" viewBox="0 0 64 14" style="flex-shrink:0"><path d="M4 7H60" stroke=${DEMONTAJ_RENGI} stroke-width="2.5" stroke-linecap="round" /></svg><div class="grow"><b style="font-size:13px">Demontaj hattı</b><div class="m">her türde sarı · ileride yapılacak hat kesikli</div></div><span class="mono note">ACI ${DR.demontaj}</span></div></div>
    <div class="sect">Direkler</div>
    <div class="card tight"><div class="row" style="padding:8px 12px"><span class="grow"></span><span class="lbl" style="width:56px;text-align:center">Mevcut</span><span class="lbl" style="width:56px;text-align:center">Yeni</span><span class="lbl" style="width:56px;text-align:center">BYSK</span></div>
      ${rows.map(([n, sh, v, gr]) => { const c = direkSatiri(v); return html`<div class="row" style="padding:6px 12px;border-top:1px solid #2d3449"><div class="grow"><b style="font-size:13px">${n}</b><div class="m">ACI ${DR[v].join(' · ')}</div></div>${sym(sh, 'none', c.MEVCUT, gr)}${sym(sh, 'full', c.YENI, gr)}${sym(sh, 'half', c.DMM, gr)}</div>`; })}</div>
    <div class="sect">Özel katmanlar</div>
    <div class="card tight list">${ozel.map(([k, x]) => html`<div class="li"><span style=${'width:14px;height:14px;border-radius:3px;background:' + aciCSS(x.aci)}></span><b class="grow" style="font-size:13px">${x.telefon}</b><span class="mono note">ACI ${x.aci}${x.aciYeni ? ' · ' + x.aciYeni + ' · ' + x.aciDmm : ''}</span></div>`)}</div>
    <div class="sect">Sokak lambaları · B_CAD yazı tipi</div>
    <div class="card tight list">${(L.lamps || []).map((l) => html`<div class="li"><b class="grow" style="font-size:13px">${l.n}</b><span class="badge b-warn" style="height:28px;width:34px;justify-content:center;font-size:14px">${l.m}</span><span class="badge b-cy" style="height:28px;width:34px;justify-content:center;font-size:14px">${l.y}</span></div>`)}</div>
    <div class="sect">Hat etiketi ve metraj</div>
    <div class="card tight list">${Object.entries(STIL.etiketler.kesit).map(([k, fm]) => html`<div class="li"><b class="mono" style=${'width:120px;color:' + (k === 'DEMONTAJ' ? DEMONTAJ_RENGI : H.HAT_AG)}>${'H1 ' + fm.replace('{t}', '3P+R/P')}</b><span class="grow" style="font-size:13px">${{ MEVCUT: 'Mevcut hat', YENI: 'Yeni hat', ILERIDE: 'İlerde yapılacak hat', DMM: 'Sökülüp kullanılan (BYSK)', DEMONTAJ: 'Demontaj hattı' }[k] || k}</span></div>`)}
      <div class="li"><b class="mono" style=${'width:120px;color:' + H.HAT_AG}>32.50</b><span class="grow" style="font-size:13px">Açıklık metrajı: iki direk (yer altında iki bağlantı elemanı) arası, çizginin üst yanında; etiket alt yanında, hattın renginde</span></div></div>
    <div class="alert info"><${Icon} n="info" s=${16} /><span>Renkler, çizgi tipleri ve yazı düzeni ortak çizim stilinden: haritada, DXF çıktısında ve AutoCAD eklentisinde aynıdır (ortak/katalog/cizim-stili.json).</span></div>`;
}

export function DefinitionsScreen({ eqId }) {
  useBus(['project:computed']);
  const ps = app.ps, cat = ps.cat;
  const e = eqId ? ps.eqById(eqId) : null;
  const [tab, setTab] = useState(e && e.kind === 'transformer' ? 'trafo' : 'direk');
  const [grp, setGrp] = useState(e && e.group ? e.group : 'bahh');
  const [tid, setTid] = useState(e && e.typeId ? e.typeId : null);
  const [rol, setRol] = useState('T');
  const [job, setJob] = useState('montaj');
  const [post, setPost] = useState('direk');
  const [kva, setKva] = useState(250);
  const [stds, setStds] = useState([]);
  useEffect(() => { listStandards(app.ds).then(setStds); }, []);
  const types = cat.poleTypes(grp);
  const t = cat.poleType(tid) || types[0];
  const role = (t && t.role) || rol;
  const Q = Object.assign({}, ...cat.t.params.map((p) => ({ [p.key]: p.value })), ps.p.paramOverrides || {});
  let items = [];
  if (tab === 'direk' && t) {
    const fake = { kind: 'pole', group: grp, typeId: t.id, state: { montaj: 'YENI', demontaj: 'DEMONTAJ', dmm: 'DMM' }[job] };
    const ctx = recipeContext(fake, cat, { role, agCiplak: true });
    items = applyRules(cat.rules('pole'), ctx, cat, ps.p.paramOverrides).filter((m) => job === 'montaj' || m.tag !== 'top');
  } else if (tab === 'trafo') {
    const fake = { kind: 'transformer', state: 'yeni', attrs: { post, kva, cins: 'herm', poleTypeId: (cat.poleTypeByName('trafo', 'G-T25') || {}).id, kioskServis: cat.kioskDefault(post) } };
    items = applyRules(cat.rules('trafo'), recipeContext(fake, cat), cat, ps.p.paramOverrides);
  }
  const setQ = (k, v) => ps.updateProject({ paramOverrides: Object.assign({}, ps.p.paramOverrides, { [k]: v }) }, 'Reçete parametresi: ' + k + ' = ' + v);
  const reset = () => ps.updateProject({ paramOverrides: {} }, 'Reçete parametreleri varsayılana döndü');
  const clone = async () => {
    const code = await app.prompt('Yeni katalog sürümü', 'Kod (ör. 2027)', { value: '2027', required: true, note: 'Mevcut sürüm kopyalanır (taslak). Eski projeler kendi sürümünde kalır; sürümler karışmaz.' });
    if (!code) return;
    const id = code.replace(/[^\w]+/g, '-').toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase();
    await cloneStandard(app.ds, cat.stdId, { id, code, name: 'Poz kataloğu ' + code + ' (taslak · ' + cat.std.code + ' kopyası)', validFrom: code.match(/\d{4}/) ? code.match(/\d{4}/)[0] + '-01-01' : cat.std.validFrom, validTo: code.match(/\d{4}/) ? code.match(/\d{4}/)[0] + '-12-31' : cat.std.validTo });
    setStds(await listStandards(app.ds)); app.toast(code + ' taslak sürümü oluşturuldu');
  };
  const exportStd = async () => { const pkg = await exportStandard(app.ds, cat.stdId); await app.bridge.saveFile(cat.stdId + '.json', 'application/json', new TextEncoder().encode(JSON.stringify(pkg))); };
  const mm = cat.table('materialsMaster') || [];
  const mapMat = async (m) => {
    const s = await app.prompt('Poz eşleme · ' + m.label, 'Servis kodu (montaj, 0xx…)', { value: m.servis || '', note: 'Standart tablosunu değiştirir (' + cat.std.code + '); denetim kaydına yazılır.' });
    if (s === null) return;
    if (s && !cat.poz(s)) return app.toast('Katalogda yok: ' + s, 'err');
    const nm = mm.map((x) => (x.key === m.key ? Object.assign({}, x, { servis: s || null }) : x));
    await updateStdTable(app.ds, cat.stdId, 'materialsMaster', nm, m.key + ' → ' + (s || 'eşleme yok'));
    cat.tables.materialsMaster = nm; await ps.recompute('Malzeme eşleme');
  };
  const verify = async (k) => { const v = cat.table(k); if (!v || typeof v !== 'object') return; if (!(await app.confirm('Doğrulama', k + ' tablosu ' + cat.std.code + ' için doğrulandı olarak işaretlensin mi?'))) return; const nv = Object.assign({}, v, { verified: true, verifiedBy: app.ds.user.name, verifiedAt: new Date().toISOString() }); await updateStdTable(app.ds, cat.stdId, k, nv, 'Tablo doğrulandı'); cat.tables[k] = nv; app.toast(k + ' doğrulandı'); };
  return html`<${Title} title="Tanımlar" sub="Tek veri kaynağı · direk, trafo, iletken, hat" />
    ${ps.p && !autoRecipeOn(ps.p) ? html`<div class="alert info"><${Icon} n="info" s=${16} /><span>Bu projede otomatik malzeme reçetesi kapalı: aşağıdaki reçeteler yalnız bilgi içindir, objelere uygulanmaz. Açmak için: Proje merkezi › Proje oluştur adımı › "Otomatik malzeme reçetesi".</span></div>` : null}
    <div class="card tight flow">${[['1', 'Tanım', 'Direk / trafo tipi → iş tipine göre malzeme reçetesi (bu ekran)', true], ['2', 'Alım', 'Haritada nokta + tip + durum; koordinat GNSS / telefon', false], ['3', 'Kayıt', 'Reçeteden otomatik malzeme; sahada ek ihtiyaç ayrı işaretli', false], ['4', 'Çıktı', 'Yeşil defter, rapor, DXF — otomatik / manuel ayrımı korunur', false]].map(([n, t2, d, on]) => html`<div class=${'st' + (on ? ' done' : '')}><span class="n">${n}</span><div class="grow"><b>${t2}</b><div class="note">${d}</div></div></div>`)}</div>
    <div class="grid3">${[['direk', 'DİREK'], ['trafo', 'TRAFO'], ['iletken', 'İLETKEN']].map(([k, l]) => html`<${Chip} on=${tab === k} onClick=${() => setTab(k)}>${l}</${Chip}>`)}</div>
    ${tab === 'direk' ? html`<div class="stack">
      <div class="row"><span class="lbl" style="width:90px">Direk grubu</span><div class="grow"><${Sel} value=${grp} options=${cat.poleGroups().map((g) => [g.id, g.label])} onChange=${(v) => { setGrp(v); setTid(null); }} /></div></div>
      <div class="row"><span class="lbl" style="width:90px">Direk tipi</span><div class="grow"><${Sel} mono value=${t && t.id} options=${types.map((x) => [x.id, x.name + (x.kg ? ' · ' + x.kg + ' kg' : '')])} onChange=${setTid} /></div></div>
      <div class="row"><span class="lbl" style="width:90px">Rol</span><div class="chips grow">${['T', 'D', 'N', 'Z'].map((r) => html`<${Chip} on=${role === r} disabled=${t && t.role && t.role !== r} onClick=${() => setRol(r)}>${roleLabel(r)}</${Chip}>`)}</div></div>
      ${t && t.role ? html`<div class="note">Rol tip adından gelir (${t.name.slice(0, 2)} → ${roleLabel(t.role)}).</div>` : null}
      <${Seg} value=${job} options=${[['montaj', 'Montaj'], ['demontaj', 'Demontaj'], ['dmm', 'DMM']]} onChange=${setJob} /></div>` : null}
    ${tab === 'trafo' ? html`<div class="grid2"><${Sel} value=${post} options=${cat.postTypes().map((p) => [p.id, p.label])} onChange=${setPost} /><${Sel} mono value=${kva} options=${cat.trafoSizes('bina', 'herm').map((k) => [k, k + ' kVA'])} onChange=${(v) => setKva(+v)} /></div>` : null}
    ${tab !== 'iletken' ? html`<div class="row"><span class="lbl grow">Otomatik malzeme reçetesi</span><span class="hl" style="font-size:12px;font-weight:700">${items.length} kalem · ${JOB_LABEL[tab === 'trafo' ? 'montaj' : job]} sayfası</span></div>
      <div class="card tight list">${items.map((m) => html`<div class="li"><div class="grow"><div class="t" style="font-size:13px">${m.why}</div><div class="s">${m.name}</div><div class="m">${m.servis || 'katalogda yok'}${m.grp ? ' · Kg grubu ' + m.grp : ''} · kural ${String(m.ruleId).split(':R')[1]}</div></div><b class="mono">${trn(m.qty, 0)}</b><span class="note">${m.unit}</span></div>`)}</div>
      <div class="sect">Değiştirilebilir miktarlar · proje</div>
      <div class="card tight list">${cat.t.params.map((p) => html`<div class="li"><div class="grow"><b style="font-size:13px">${p.label.split(' · ')[0]}</b> <span class="note">· ${p.label.split(' · ')[1] || ''}</span>${Q[p.key] !== p.value ? html` <${Badge} k="warn">varsayılan ${p.value}</${Badge}>` : null}</div><${Stepper} value=${Q[p.key]} step=${p.unit === 'Kg' ? 0.5 : 1} onChange=${(v) => setQ(p.key, v)} /></div>`)}</div>
      <button class="btn blk" onClick=${reset}>Varsayılana dön</button>
      <div class="note">Parametreler bu projeye kaydedilir ve tüm reçeteler yeniden hesaplanır (denetim kaydıyla). Onaylı hakediş dönemleri dondurulduğu için etkilenmez; fark sonraki dönemde REVİZYON olarak görünür.</div>` : html`
      ${[['ACSR', 'OG · Çelik-alüminyum (ACSR) · Kg ile'], ['AAC', 'AG · Çıplak alüminyum · Kg ile'], ['AER', 'AG · Alüminyum askılı demet (AER) · m ile'], ['KABLO', 'Yeraltı kabloları · m ile']].map(([k, l]) => html`<div class="sect">${l}</div><div class="card tight scrollx"><table class="t"><thead><tr><th>İletken</th><th class="n">kg/km</th><th>Yeşil Defter</th><th>BF poz</th><th class="n">TL</th></tr></thead><tbody>${cat.t.conductors.filter((c) => c.kind === k).map((c) => html`<tr><td class="mono" style="font-weight:700">${c.name}${c.awg ? html`<div class="note">${c.awg}${c.mech ? ' · d ' + c.mech.d + ' mm' : ''}</div>` : null}</td><td class="n">${c.kgPerKm ?? '—'}</td><td class="mono" style=${'font-size:11px;' + (c.yd ? '' : 'color:#fcd34d')}>${c.yd || 'defterde yok'}${c.ydToprak ? html`<div class="note">toprak ${c.ydToprak}</div>` : null}</td><td class="mono" style="font-size:11px">${c.bfPoz || ''}</td><td class="n">${c.priceMaterialPerKg != null ? trn(c.priceMaterialPerKg + (c.priceLaborPerKg || 0), 2) + '/kg' : c.priceMaterialPerM != null ? trn(c.priceMaterialPerM + (c.priceLaborPerM || 0), 2) + '/m' : '—'}</td></tr>`)}</tbody></table></div>`)}`}
    <div class="sect">Malzeme → poz eşlemesi</div>
    <div class="card tight list">${mm.map((m) => html`<button class="li" onClick=${() => mapMat(m)}><div class="grow"><div class="t" style="font-size:13px">${m.label}</div><div class="m">${m.key} · ${m.unit}</div></div>${m.servis ? html`<span class="mono hl" style="font-size:11px">${m.servis}</span>` : html`<${Badge} k="warn">POZ YOK</${Badge}>`}</button>`)}</div>
    <div class="sect">Standart sürümleri</div>
    <div class="card tight list">${stds.map((s) => html`<div class="li"><div class="grow"><div class="t" style="font-size:13px">${s.name}</div><div class="m">${s.validFrom} – ${s.validTo} · ${s.status === 'active' ? 'etkin' : s.status}${s.id === cat.stdId ? ' · BU PROJE' : ''}</div></div></div>`)}</div>
    <div class="grid2"><button class="btn" onClick=${clone}>Yeni sürüm (kopya)</button><button class="btn" onClick=${exportStd}>Sürümü dışa aktar</button></div>
    <div class="sect">Doğrulanmamış varsayılan tablolar</div>
    <div class="card tight list">${['enh', 'clearances', 'cableRules'].map((k) => { const v = cat.table(k) || {}; return html`<div class="li"><div class="grow"><div class="t" style="font-size:13px">${k}</div><div class="s">${v.note || ''}</div></div>${v.verified ? html`<${Badge} k="ok">DOĞRULANDI</${Badge}>` : html`<button class="btn xs" onClick=${() => verify(k)}>Doğrula</button>`}</div>`; })}</div>
    <div class="note">Projenin katalog sürümü oluşturulurken sabitlenir; 2026 ve 2027 sürümleri aynı projede karışmaz.</div>`;
}
