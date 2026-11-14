// Proje merkezi (akış: PROJE → GNSS → SAHA → ALIM → HAT → BAĞLANTI → REÇETE → METRAJ → HAKEDİŞ → KONTROL → APLİKASYON → DXF/GIS → RAPOR → TESLİM)
// + Denetim kaydı + Senkron & çakışmalar
import { html, useState, useEffect, useBus, Icon, Chip, Seg, Sel, Badge, Title, Toggle, Empty, SayiGirdi, fmt, trn } from '../kit.js';
import { app } from '../ctx.js';
import { makeCrs, zoneForLon, TM_ZONES } from '../../geo/crs.js';
import { listStandards } from '../../core/standards.js';
import { HAK_STATUSES, HAK_ORDER } from '../../core/schema.js';
import { PENDING } from '../../core/roles.js';
import { autoRecipeOn } from '../../grid/recipe.js';
import { exportChangeset, applyChangeset, markSynced, listConflicts, resolveConflict, pendingChanges, httpSync } from '../../core/sync.js';
import { voltProjeOku, sebekeIceAl } from '../../interop/sebeke.js';

/**
 * AutoCAD eklentisinin yazdığı proje dosyasını (.sebeke.json) ya da telefonun tam proje dosyasını (.volt.json) alır.
 * projectId verilirse o projeye (var olan kayıtlar güncellenir), verilmezse yeni proje açılır.
 */
export async function autocadDosyasiAl(file, projectId) {
  let okunan;
  try { okunan = voltProjeOku(await file.text()); } catch (e) { app.toast('Dosya okunamadı: ' + e.message, 'err', 7000); return null; }
  const sp = okunan.proje;
  const say = sp.elemanlar.length + ' eleman · ' + sp.hatlar.length + ' hat · ' + sp.kanallar.length + ' kanal · ' + sp.sondajlar.length + ' sondaj';
  if (!(await app.confirm('AutoCAD dosyası', (sp.proje.ad || 'Proje') + ' · ' + say + (projectId ? '\n\nAçık projeye alınacak: aynı kimlikli kayıtlar güncellenir, yenileri eklenir.' : '\n\nYeni proje olarak açılacak.'), { ok: 'Al' }))) return null;
  try {
    const oz = await sebekeIceAl(app.ps, sp, { projectId });
    const m = [];
    if (oz.yeniEleman) m.push(oz.yeniEleman + ' yeni eleman'); if (oz.guncellenenEleman) m.push(oz.guncellenenEleman + ' eleman güncellendi');
    if (oz.yeniHat) m.push(oz.yeniHat + ' yeni hat'); if (oz.guncellenenHat) m.push(oz.guncellenenHat + ' hat güncellendi');
    if (oz.yeniKanal) m.push(oz.yeniKanal + ' kanal / sondaj'); if (oz.nokta) m.push(oz.nokta + ' nokta'); if (oz.guncellenenNokta) m.push(oz.guncellenenNokta + ' nokta güncellendi');
    if (oz.uyarilar.some((u) => /kilitli/.test(u))) m.push(oz.uyarilar.filter((u) => /kilitli/.test(u)).length + ' kilitli kayıt değiştirilmedi');
    app.toast('AutoCAD dosyası alındı: ' + (m.join(' · ') || 'değişiklik yok') + (oz.eslesmeyen.length ? ' · ' + oz.eslesmeyen.length + ' kalem katalogda bulunamadı (Kontrol listesi)' : ''), oz.eslesmeyen.length ? 'warn' : 'ok', 7000);
    return oz;
  } catch (e) { app.toast('Alınamadı: ' + e.message, 'err', 8000); return null; }
}

export function ProjectsScreen({ yeni } = {}) {
  useBus(['project:open', 'project:computed', 'project:deleted']);
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [stds, setStds] = useState([]);
  const load = async () => setList(await app.ps.listProjects());
  const yeniForm = (st) => ({ name: '', code: '', location: '', client: '', contractor: '', stdId: (st.find((s) => s.status === 'active') || st[0] || {}).id, datum: 'TUREF', cm: 39, heightSystem: 'ortometrik', enhZone: 'II', mode: 'asbuilt' });
  // yeni: Proje bilgilerinde "Yeni proje aç" denince form doğrudan açılır
  useEffect(() => { load(); listStandards(app.ds).then((st) => { setStds(st); if (yeni) setForm(yeniForm(st)); }); }, []);
  const open = async (p) => { await app.ps.open(p.id); app.nav.tab('map'); };
  // Proje silme: ad yazılarak onaylanır; geri alınamaz
  const removeProject = async (p) => {
    const v = await app.prompt('Projeyi sil', 'Onaylamak için proje adını yazın', { required: true, danger: true, ok: 'Kalıcı olarak sil', placeholder: p.name, note: '"' + p.name + '" projesi; noktaları, objeleri, hatları, fotoğrafları ve hakediş kayıtlarıyla birlikte ' + (app.web ? 'web sürümünden (bulut kaydından)' : 'bu cihazdan') + ' kalıcı olarak silinir. Geri alınamaz. ' + (app.web ? 'Telefondaki kopya etkilenmez. ' : 'Web sürümündeki kopya etkilenmez. ') + 'Gerekirse önce Dışa Aktar ekranından teslim paketi alın.' });
    if (v == null) return;
    if (String(v).trim().toLocaleLowerCase('tr-TR') !== String(p.name).trim().toLocaleLowerCase('tr-TR')) return app.toast('Proje adı eşleşmedi · silinmedi', 'warn', 5000);
    const wasOpen = !!(app.ps.p && app.ps.p.id === p.id);
    try { const r = await app.ps.deleteProject(p.id); app.toast(r.name + ' silindi · ' + r.records + ' kayıt', 'ok', 5000); if (wasOpen) { app.nav.tab('projects'); return; } } catch (e) { app.toast(e.message, 'err', 7000); }
    load();
  };
  // Web: telefondan gelen dosya (.vsync) ile proje al
  const fromPhone = async (f) => {
    try {
      const cs = JSON.parse(await f.text());
      const r = await applyChangeset(app.ds, cs, { bus: app.bus });
      app.toast(r.applied + ' kayıt alındı' + (r.conflicts.length ? ' · ' + r.conflicts.length + ' çakışma' : ''), r.conflicts.length ? 'warn' : 'ok', 5000);
      const all = await app.ps.listProjects();
      const p = all.find((x) => x.id === cs.projectId);
      if (p) await open(p); else load();
    } catch (e) { app.toast('Dosya alınamadı: ' + e.message, 'err', 6000); }
  };
  const create = async () => {
    if (!form.name) return app.toast('Proje adı gerekli', 'warn');
    const crs = makeCrs({ datum: form.datum, projection: 'TM3', cm: form.cm });
    const p = await app.ps.createProject(Object.assign({}, form, { crs }));
    await app.ps.open(p.id); app.nav.replace('hub');
  };
  if (form) {
    const set = (x) => setForm(Object.assign({}, form, x));
    return html`<${Title} title="Yeni proje" back=${false} right=${html`<button class="btn sm" onClick=${() => setForm(null)}>Vazgeç</button>`} />
      <div class="card stack">
        <div class="fld"><label>Proje adı *</label><input class="inp" value=${form.name} placeholder="ör. OG-03 Hat Yenileme" onInput=${(e) => set({ name: e.target.value })} /></div>
        <div class="grid2"><div class="fld"><label>Proje kodu</label><input class="inp mono" value=${form.code} onInput=${(e) => set({ code: e.target.value })} /></div><div class="fld"><label>Yer</label><input class="inp" value=${form.location} onInput=${(e) => set({ location: e.target.value })} /></div></div>
        <div class="grid2"><div class="fld"><label>İdare / EDAŞ</label><input class="inp" value=${form.client} onInput=${(e) => set({ client: e.target.value })} /></div><div class="fld"><label>Yüklenici</label><input class="inp" value=${form.contractor} onInput=${(e) => set({ contractor: e.target.value })} /></div></div>
        <div class="fld"><label>Standart sürümü (değiştirilemez)</label><${Sel} value=${form.stdId} options=${stds.map((s) => [s.id, s.name])} onChange=${(v) => set({ stdId: v })} /></div>
        <div class="grid2"><div class="fld"><label>Datum</label><${Sel} value=${form.datum} options=${[['TUREF', 'ITRF96 / TUREF'], ['ED50', 'ED50'], ['WGS84', 'WGS84']]} onChange=${(v) => set({ datum: v })} /></div><div class="fld"><label>3° dilim (DOM)</label><div class="row"><select class="inp mono" value=${form.cm} onChange=${(e) => set({ cm: +e.target.value })}>${TM_ZONES.map((z) => html`<option value=${z}>${z}°</option>`)}</select>${app.web ? null : html`<button class="btn sm" onClick=${() => { const lon = app.gnss.state.lon; if (lon == null) return app.toast('Konum yok', 'warn'); set({ cm: zoneForLon(lon) }); }}>Oto</button>`}</div></div></div>
        <div class="grid2"><div class="fld"><label>Yükseklik</label><${Sel} value=${form.heightSystem} options=${[['ortometrik', 'Ortometrik (H)'], ['elipsoidal', 'Elipsoidal (h)']]} onChange=${(v) => set({ heightSystem: v })} /></div><div class="fld"><label>ENH buz bölgesi</label><${Sel} value=${form.enhZone} options=${['I', 'II', 'III', 'IV']} onChange=${(v) => set({ enhZone: v })} /></div></div>
        <div class="fld"><label>Çalışma modu</label><${Seg} value=${form.mode} options=${[['asbuilt', 'Uygulama / as-built'], ['tasarim', 'Tasarım / keşif']]} onChange=${(v) => set({ mode: v })} /><span class="note">As-built: alınan yeni ekipman "iş tamamlandı" sayılır (hakedişe girer). Tasarım: planlanan olarak kalır.</span></div>
      </div>
      <button class="btn pri huge blk" onClick=${create}>PROJE OLUŞTUR</button>`;
  }
  return html`<div class="brandrow"><img src="assets/sebeke-m-simge.png" alt="" /><div><b>Şebeke-M Hakediş</b><span>Elektrik Dağıtım Projesi</span></div></div>
    <div class="title"><div class="grow"><h1>Projeler</h1><div class="sub" style="font-family:Inter">${app.ps.p ? 'Açık: ' + app.ps.p.name : 'Proje seçin veya oluşturun'}</div></div>${app.ps.p ? html`<button class="btn sm" onClick=${() => app.nav.go('hub')}>Proje merkezi</button>` : null}</div>
    <button class="btn pri blk" style="height:56px" onClick=${() => setForm(yeniForm(stds))}><${Icon} n="plus" s=${20} c="#0b1326" />Yeni proje</button>
    <label class="btn blk" style="height:56px"><${Icon} n="down" s=${20} />AutoCAD dosyasından proje al (.sebeke.json)<input type="file" accept=".json,application/json" style="display:none" onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) autocadDosyasiAl(f, null).then((oz) => { if (oz) { app.nav.tab('map'); } load(); }); }} /></label>
    <div class="note">AutoCAD'de ŞEBEKE-M ARAÇLAR › Telefona Gönder ile kaydedilen dosyayı (Drive'dan) seçin. Direkler, hatlar, kanallar ve malzemeler projeye gelir; sahada değiştirip Dışa Aktar › "AutoCAD proje dosyası" ile geri gönderirsiniz.</div>
    ${app.web ? html`<label class="btn blk" style="height:56px"><${Icon} n="sync" s=${20} />Telefondan proje al (.vsync dosyası)<input type="file" accept=".vsync,.json" style="display:none" onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) fromPhone(f); }} /></label>
      <div class="note">Telefonda: Ayarlar → Veri ve senkron → Senkron → "Değişiklikleri paylaş (.vsync)". Oluşan dosyayı bu bilgisayara gönderin (e-posta, Drive, kablo) ve yukarıdan seçin.</div>` : null}
    ${list === null ? html`<${Empty}>Yükleniyor…</${Empty}>` : !list.length ? html`<${Empty}>${app.web ? 'Henüz proje yok. Telefondaki projeyi dosya ile alın ya da burada yeni proje açıp koordinatları Excel, elle giriş ya da haritadan seçerek girin.' : 'Henüz proje yok. Proje oluşturup GNSS alıcısını bağlayarak sahaya çıkın.'}</${Empty}>` : html`<div class="card tight list">${list.map((p) => html`<div class="li"><button style="background:none;border:0;color:inherit;display:flex;gap:12px;align-items:center;text-align:left;padding:0;min-width:0" class="grow" onClick=${() => open(p)}><${Icon} n="folder" c=${app.ps.p && app.ps.p.id === p.id ? '#10b981' : 'var(--mut)'} /><div class="grow" style="min-width:0"><div class="t">${p.name}</div><div class="s">${[p.code, p.crs ? p.crs.label : ''].filter(Boolean).join(' · ')}</div><div class="m">${new Date(p.updatedAt).toLocaleString('tr-TR')}</div></div></button><button class="btn xs dang" aria-label=${'Projeyi sil: ' + p.name} onClick=${() => removeProject(p)}><${Icon} n="trash" s=${15} /></button></div>`)}</div>
      <div class="note">Projeyi açmak için adına dokunun. Çöp kutusu projeyi tüm kayıtlarıyla kalıcı olarak siler.</div>`}`;
}
ProjectsScreen.noTabs = false;

export function HubScreen() {
  useBus(['project:computed', 'auth:change']);
  useBus('gnss:state', 1000);
  const ps = app.ps, r = ps.result, d = ps.data, g = app.gnss.state;
  const eqc = (k) => d.equipment.filter((e) => e.kind === k).length;
  const errs = r.issues.filter((i) => i.severity === 'error');
  const topo = r.issues.filter((i) => i.group === 'Topoloji');
  const matMiss = r.issues.filter((i) => i.code === 'MALZEME EKSİK');
  const pkg = d.exportJobs.find((j) => (j.formats || []).includes('package') && !j.stale);
  const cad = d.exportJobs.find((j) => (j.formats || []).some((f) => ['dxf', 'shp', 'geojson', 'kmz'].includes(f)) && !j.stale);
  const rep = d.exportJobs.find((j) => (j.formats || []).includes('report') && !j.stale);
  const steps = [
    ['Proje oluştur', ps.p.name + ' · ' + ps.cat.std.code, true, () => app.nav.go('projectEdit')],
    ['GNSS bağla', g.source === 'none' ? 'Kaynak yok' : ((g.receiver || {}).name || g.source) + ' · ' + g.fix, g.source !== 'none' && (g.fix === 'FIX' || g.source === 'phone'), () => app.nav.tab('settings')],
    ['Sahaya çık', d.surveySessions.length + ' ölçüm oturumu', d.surveySessions.length > 0, () => app.nav.tab('map')],
    ['Saha objelerini al (GNSS · manuel · harita · Excel)', eqc('pole') + ' direk · ' + eqc('transformer') + ' trafo · ' + eqc('sdk') + ' SDK · ' + (eqc('lighting') + eqc('luminaire')) + ' ayd.', d.equipment.length > 0, () => app.nav.tab('map')],
    ['Hatları çiz', d.lines.length + ' hat · ' + r.spans.length + ' açıklık', d.lines.length > 0, () => app.nav.tab('map')],
    ['Hatları elektriksel bağla', topo.length ? topo.length + ' topoloji bulgusu' : 'Topoloji temiz', d.lines.length > 0 && !topo.length, () => app.nav.go('checks')],
    [autoRecipeOn(ps.p) ? 'Malzeme reçeteleri' : 'Malzemeler (seçilen + elle eklenen)', [...r.matsByEq.values()].reduce((s, m) => s + m.items.length, 0) + ' kalem · ' + matMiss.length + ' eksik', d.equipment.length > 0 && !matMiss.length, () => app.nav.go(ps.p.autoRecipe === true ? 'definitions' : 'objects')],
    ['Metraj', r.quantities.length + ' Yeşil Defter satırı', r.quantities.length > 0, () => app.nav.go('metraj')],
    ['Hakediş', d.periods.length + ' dönem · ' + d.periods.filter((p) => p.status === 'onayli').length + ' onaylı', d.periods.some((p) => p.status === 'onayli'), () => app.nav.go('hakedis')],
    ['Kontrol', errs.length + ' hata · ' + (r.issues.length - errs.length) + ' uyarı', d.equipment.length > 0 && !errs.length, () => app.nav.go('checks')],
    ['Aplikasyon', d.stakeouts.length + ' işaretleme', d.stakeouts.length > 0, () => app.nav.tab('stake')],
    ['DXF / GIS', cad ? 'Güncel · ' + new Date(cad.createdAt).toLocaleDateString('tr-TR') : 'Üretilmedi / eskidi', !!cad, () => app.nav.tab('export')],
    ['Rapor', rep ? 'Güncel' : 'Üretilmedi / eskidi', !!rep, () => app.nav.tab('export')],
    ['Teslim', pkg ? 'Paket hazır · ' + new Date(pkg.createdAt).toLocaleDateString('tr-TR') : 'Teslim paketi yok', !!pkg, () => app.nav.tab('export')]
  ];
  if (app.web) { for (const i of [10, 2, 1]) steps.splice(i, 1); steps[1][0] = 'Saha objelerini gir (telefondan al · Excel · elle · haritadan)'; }   // GNSS bağla, sahaya çık, aplikasyon: yalnız telefonda
  const firstOpen = steps.findIndex((s) => !s[2]);
  const rev = async () => { const l = await app.prompt('Revizyon', 'Revizyon adı', { value: 'Rev-' + String.fromCharCode(65 + d.revisions.length), required: true }); if (!l) return; const why = await app.prompt('Revizyon', 'Gerekçe', { required: true }); if (!why) return; await ps.createRevision(l, why); app.toast(l + ' anlık görüntüsü alındı'); };
  return html`<${Title} title=${ps.p.name} sub=${(ps.p.code || '') + ' · ' + ps.p.crs.label} right=${html`<button class="btn sm" onClick=${() => app.nav.go('projects')}>Projeler</button>`} />
    <div class="grid4"><div class="stat"><b>Nokta</b><span>${d.points.length}</span></div><div class="stat"><b>Ekipman</b><span>${d.equipment.length}</span></div><div class="stat"><b>Hat</b><span>${d.lines.length}</span></div><div class="stat"><b>Hata</b><span style=${'color:' + (errs.length ? '#ff8a8a' : 'var(--ok2)')}>${errs.length}</span></div></div>
    ${ps.lastImpact ? html`<div class="alert info"><${Icon} n="sync" s=${16} /><span>Son değişiklik (${ps.lastImpact.reason}): ${ps.lastImpact.spans} açıklık · ${ps.lastImpact.roles} rol · ${ps.lastImpact.materials} reçete · ${ps.lastImpact.quantities} metraj${ps.lastImpact.exportsStale ? ' · DXF/rapor yenilenmeli' : ''}</span></div>` : null}
    <div class="grid2"><button class="btn" onClick=${() => app.nav.go('objects')}><${Icon} n="list" s=${18} />Saha objeleri</button><button class="btn" onClick=${() => app.nav.go('excel')}><${Icon} n="grid" s=${18} />Excel aktarım</button>
      <label class="btn" style="grid-column:1/3"><${Icon} n="down" s=${18} />AutoCAD dosyasını bu projeye al${ps.p.sebeke && ps.p.sebeke.alinma ? html` <span class="note">· son: ${new Date(ps.p.sebeke.alinma).toLocaleDateString('tr-TR')}</span>` : null}<input type="file" accept=".json,application/json" style="display:none" onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) autocadDosyasiAl(f, ps.p.id); }} /></label>
      <button class="btn" style="grid-column:1/3" onClick=${() => app.nav.go('kanallar')}><${Icon} n="list" s=${18} />Kanal listesi (proje bazında)${(() => { const n = d.lines.filter((l) => l.install === 'yeralti' && l.status !== 'deleted').length; return n ? html` <span class="note">· ${n} yeraltı hat</span>` : null; })()}</button>
      <button class="btn" style="grid-column:1/3" onClick=${() => app.nav.go('team')}><${Icon} n="check" s=${18} />Kullanıcılar ve hakediş onayı${(() => { const ap = ps.approval(); if (!ap.on) return html` <span class="note">· kapalı</span>`; const me = ap.member; const n = me && PENDING[me.role] ? ps.pending(PENDING[me.role][0]).length : 0; return html` <span class="note">· ${me ? me.name : 'oturum açılmadı'}</span>${n ? html` <${Badge} k="warn">${n} bekliyor</${Badge}>` : null}`; })()}</button></div>
    ${(() => { const c = ps.hakCounts(); const tot = HAK_ORDER.reduce((a, k) => a + (c[k] || 0), 0); return tot ? html`<div class="sect">Hakediş durumu <span class="r mono">${tot} obje</span></div><div class="hakbar">${HAK_ORDER.filter((k) => c[k]).map((k) => html`<span style=${'flex:' + c[k] + ';background:' + HAK_STATUSES[k].color} title=${HAK_STATUSES[k].label}></span>`)}</div><div class="hakrow">${HAK_ORDER.map((k) => html`<button style=${'--c:' + HAK_STATUSES[k].color} onClick=${() => app.nav.go('objects')}><i></i>${HAK_STATUSES[k].short} ${c[k] || 0}</button>`)}</div>` : null; })()}
    <div class="sect">Proje akışı</div>
    <div class="card tight flow">${steps.map(([t, s, ok, go], i) => html`<button class=${'st' + (ok ? ' done' : i === firstOpen ? ' act' : '')} onClick=${go}><span class="n">${ok ? html`<${Icon} n="check" s=${14} c="#10b981" w=${3} />` : i + 1}</span><div class="grow"><b style="font-size:14px">${t}</b><div class="note">${s}</div></div><${Icon} n="next" s=${16} c="var(--line3)" /></button>`)}</div>
    <div class="grid2"><button class="btn" onClick=${rev}><${Icon} n="history" s=${18} />Revizyon al</button><button class="btn" onClick=${() => app.nav.go('audit')}><${Icon} n="list" s=${18} />Denetim kaydı</button></div>
    ${d.revisions.length ? html`<div class="card tight list">${d.revisions.slice().reverse().map((v) => html`<div class="li"><div class="grow"><div class="t" style="font-size:13px">${v.label}</div><div class="s">${new Date(v.createdAt).toLocaleString('tr-TR')} · ${v.createdBy} · ${v.reason}</div></div><span class="mono note">${v.signature}</span></div>`)}</div>` : null}`;
}

export function ProjectEditScreen() {
  const ps = app.ps;
  const [d, setD] = useState({ name: ps.p.name, code: ps.p.code, client: ps.p.client, contractor: ps.p.contractor, location: ps.p.location, mode: ps.p.mode, cornerThresholdDeg: ps.p.cornerThresholdDeg ?? 3, conductorPayPct: ps.p.conductorPayPct ?? 0, landClass: ps.p.landClass || 'arazi', autoRecipe: autoRecipeOn(ps.p) });
  const set = (x) => setD(Object.assign({}, d, x));
  const save = async () => {
    const out = Object.assign({}, d); if (ps.p.autoRecipe === undefined && out.autoRecipe === autoRecipeOn(ps.p)) delete out.autoRecipe; /* dokunulmadıysa eski proje sorusu geçerli kalır */
    // Dolu projenin adı değişiyorsa uyar (14.11.2026, saha bildirimi): eski projenin adı değiştirilip yeni işe geçilince
    // eski alımlar yeni projede kalıyor, AutoCAD'e de gidiyordu. Yeni iş için yeni proje açılmalı.
    const yeniAd = String(out.name || '').trim(), eskiAd = String(ps.p.name || '').trim();
    const n = ps.data.equipment.length + ps.data.points.length + ps.data.lines.length;
    if (yeniAd && yeniAd !== eskiAd && n > 0) {
      const ilk = ps.data.points.map((x) => x.measuredAt || x.createdAt).filter(Boolean).sort()[0];
      const r = await app.modal((close) => html`<div class="mh"><h3 class="hw">Projenin adı değişiyor</h3></div><div class="mb">
        <div class="alert warn">"${eskiAd}" projesinde ${ps.data.equipment.length} obje, ${ps.data.lines.length} hat var${ilk ? ' (ilk alım ' + new Date(ilk).toLocaleDateString('tr-TR') + ')' : ''}. Ad değişince bu kayıtların hepsi "${yeniAd}" projesinde kalır ve dışa aktarımla (AutoCAD dosyası, rapor) birlikte gider.</div>
        <div class="note" style="font-size:14px">Yeni bir iş için ayrı proje açın. Yalnız yazım düzeltmesiyse adı değiştirin.</div></div>
        <div class="mf" style="flex-wrap:wrap"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn grow" onClick=${() => close('ad')}>Yine de adı değiştir</button><button class="btn pri grow" style="flex-basis:100%" onClick=${() => close('yeni')}><${Icon} n="plus" s=${18} c="#0b1326" />Yeni proje aç</button></div>`);
      if (!r) return;
      if (r === 'yeni') { app.nav.tab('projects', { yeni: true }); return; }
    }
    await ps.updateProject(out, 'Proje bilgileri'); app.toast('Kaydedildi'); app.nav.back();
  };
  return html`<${Title} title="Proje bilgileri" sub=${'Standart: ' + ps.cat.std.name + ' (sabit)'} />
    <div class="card stack">${[['name', 'Proje adı'], ['code', 'Kod'], ['client', 'İdare'], ['contractor', 'Yüklenici'], ['location', 'Yer']].map(([k, l]) => html`<div class="fld"><label>${l}</label><input class="inp" value=${d[k] || ''} onInput=${(e) => set({ [k]: e.target.value })} /></div>`)}
      <div class="fld"><label>Çalışma modu</label><${Seg} value=${d.mode} options=${[['asbuilt', 'Uygulama'], ['tasarim', 'Tasarım']]} onChange=${(v) => set({ mode: v })} /></div>
      <div class="grid2"><div class="fld"><label>Köşe eşiği (°)</label><${SayiGirdi} canli value=${d.cornerThresholdDeg} onSave=${(v) => set({ cornerThresholdDeg: v ?? 0 })} /></div><div class="fld"><label>İletken payı (%)</label><${SayiGirdi} canli value=${d.conductorPayPct} onSave=${(v) => set({ conductorPayPct: v ?? 0 })} /></div></div>
      <div class="fld"><label>Zemin sınıfı (ENH açıklık)</label><${Seg} value=${d.landClass} options=${[['arazi', 'Yerleşim dışı'], ['yerlesim', 'Yerleşim yeri']]} onChange=${(v) => set({ landClass: v })} /></div>
      <div class="row"><div class="grow"><b style="font-size:14px">Otomatik malzeme reçetesi</b><div class="note">Kapalı (önerilen): objede yalnız seçtiğiniz kalemler gelir (direk, trafo, köşk, iletken boyu, kanal hesabı); diğer malzemeleri siz eklersiniz. Açık: travers, izolatör, topraklama, kum, bant gibi yardımcı malzemeler kurala göre kendiliğinden eklenir.</div></div><${Toggle} on=${d.autoRecipe} onChange=${(v) => set({ autoRecipe: v })} label="Otomatik reçete" /></div></div>
    <button class="btn pri blk huge" onClick=${save}>KAYDET</button>`;
}

export function AuditScreen() {
  const ps = app.ps;
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { ps.ds.auditLog(ps.p.id, 2000).then(setRows); }, []);
  const low = (s) => String(s || '').toLocaleLowerCase('tr-TR');
  const list = q ? rows.filter((r) => low(r.entityNo + ' ' + r.reason + ' ' + r.user + ' ' + r.store + ' ' + r.action).includes(low(q))) : rows;
  return html`<${Title} title="Denetim kaydı" sub=${rows.length + ' kayıt · kim · ne · ne zaman · eski/yeni · neden'} />
    <input class="inp" placeholder="Ara: D-017, remeasure, kullanıcı…" value=${q} onInput=${(e) => setQ(e.target.value)} />
    <div class="card tight list">${list.slice(0, 400).map((a) => html`<div class="li" style="align-items:flex-start"><div class="grow"><div class="row" style="gap:6px"><${Badge} k=${a.action === 'delete' ? 'err' : a.action === 'create' ? 'ok' : a.action === 'sync' ? 'cy' : 'mut'}>${a.action}</${Badge}><b style="font-size:13px">${a.entityNo || a.store}</b><span class="note">${a.store}</span></div><div class="s">${new Date(a.ts).toLocaleString('tr-TR')} · ${a.user} · ${a.deviceId}</div>${a.reason ? html`<div style="font-size:12px;margin-top:2px">${a.reason}</div>` : null}${(a.action === 'create' ? [] : (a.changes || []).filter((c) => !['history', 'quality'].includes(c.field))).slice(0, 5).map((c) => html`<div class="m">${c.field}: ${sh(c.old)} → ${sh(c.new)}</div>`)}</div></div>`)}</div>`;
}
const sh = (v) => { const s = v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—'); return s.length > 48 ? s.slice(0, 48) + '…' : s; };

export function SyncScreen() {
  const ds = app.ds, ps = app.ps;
  const [pend, setPend] = useState([]);
  const [cf, setCf] = useState([]);
  const [cfg, setCfg] = useState({ url: '', token: '' });
  const [busy, setBusy] = useState(false);
  const load = async () => { setPend(await pendingChanges(ds, ps.p && ps.p.id)); setCf(await listConflicts(ds)); const c = await ds.setting('syncServer'); if (c) setCfg(c); };
  useEffect(() => { load(); }, []);
  const exportFile = async () => { const cs = await exportChangeset(ds, ps.p.id); const bytes = new TextEncoder().encode(JSON.stringify(cs)); await app.bridge.shareFile((ps.p.code || 'proje') + '_' + ds.deviceId.slice(0, 6) + '_' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.vsync', 'application/json', bytes); if (await app.confirm('Senkron', 'Dosya karşı cihaza aktarıldı mı? Kuyruk "gönderildi" olarak işaretlensin mi?')) { await markSynced(ds, cs.outboxIds); load(); } };
  const importFile = async (f) => { try { const cs = JSON.parse(await f.text()); const r = await applyChangeset(ds, cs, { bus: app.bus }); app.toast(r.applied + ' değişiklik uygulandı · ' + r.conflicts.length + ' çakışma', r.conflicts.length ? 'warn' : 'ok', 5000); if ((cs.changes || []).some((c) => c.store === 'poz')) ps.catCache.clear(); const pid = ps.p ? ps.p.id : cs.projectId; if (pid && (await ds.get('projects', pid))) await ps.open(pid); load(); } catch (e) { app.toast(e.message, 'err'); } };
  const server = async () => { if (!cfg.url) return app.toast('Sunucu adresi girin', 'warn'); setBusy(true); try { await ds.setting('syncServer', cfg); const r = await httpSync(ds, { url: cfg.url, token: cfg.token, projectId: ps.p.id }); app.toast(r.sent + ' gönderildi · ' + r.applied + ' alındı · ' + r.conflicts.length + ' çakışma'); await ps.open(ps.p.id); load(); } catch (e) { app.toast('Senkron: ' + e.message, 'err', 5000); } setBusy(false); };
  const resolve = async (c, ch) => { await resolveConflict(ds, c.id, ch); await ps.open(ps.p.id); load(); };
  if (app.web) {
    const st = app.cloud ? app.cloud.status : null;
    const send = async () => {
      const cs = await exportChangeset(ds, ps.p.id);
      if (!cs.changes.length) return app.toast('Telefona gönderilecek yeni değişiklik yok', 'warn');
      try { await app.bridge.saveFile((ps.p.code || 'proje').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '_web_' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.vsync', 'application/json', new TextEncoder().encode(JSON.stringify(cs))); } catch (e) { return app.toast(e.message, 'err', 5000); }
      if (await app.confirm('Telefona aktarım', 'Dosya indi. Telefonda uygulamaya aldıktan sonra "Gönderildi" deyin; böylece bir sonraki dosyada yalnız yeni değişiklikler olur.', { ok: 'Gönderildi' })) { await markSynced(ds, cs.outboxIds); load(); }
    };
    return html`<${Title} title="Telefonla veri alışverişi" sub=${'Bu ofis kopyası: ' + ds.deviceId} />
      <div class=${'alert ' + (app.cloud ? 'ok' : 'warn')}><${Icon} n=${app.cloud ? 'check' : 'warn'} s=${16} /><span>${app.cloud ? 'Bu sayfadaki veriler bulutta saklanır: hangi bilgisayardan açarsanız açın aynı proje gelir' + (st && st.at ? ' · son kayıt ' + new Date(st.at).toLocaleString('tr-TR') : '') + '.' : 'Bulut kaydı kullanılamıyor: veriler yalnız bu tarayıcıda. Oturum açıp sayfayı yeniden açın.'} Telefondaki uygulama ile veri alışverişi dosya ile yapılır.</span></div>
      <div class="card stack">
        <div class="row"><span class="badge b-mut">1</span><b class="grow">Telefondan al</b></div>
        <div class="note">Telefonda: Ayarlar → Veri ve senkron → Senkron → "Değişiklikleri paylaş (.vsync)". Dosyayı bu bilgisayara gönderin ve aşağıdan seçin. Sahada alınan direkler, hatlar ve ölçümler buraya eklenir. Fotoğraflar dosyaya girmez; telefonda İndirilenler/Sebeke-M klasöründe kalır.</div>
        <label class="btn pri blk" style="height:52px"><${Icon} n="down" s=${18} c="#0b1326" />Telefondan gelen dosyayı seç<input type="file" accept=".vsync,.json" style="display:none" onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); }} /></label>
      </div>
      <div class="card stack">
        <div class="row"><span class="badge b-mut">2</span><b class="grow">Telefona gönder</b><span class="mono note" style=${'color:' + (pend.length ? '#f59e0b' : '#10b981')}>${pend.length} değişiklik bekliyor</span></div>
        <div class="note">Burada yaptığınız düzeltmeleri (koordinat, tip, hakediş durumu, Excel ile eklenenler) telefona taşır. İnen dosyayı telefona gönderin; uygulamada Senkron → "Dosyadan al" ile seçin.</div>
        <button class="btn blk" style="height:52px" disabled=${!ps.p || !pend.length} onClick=${send}><${Icon} n="share" s=${18} />Telefon için dosya indir</button>
      </div>
      ${cf.length ? html`<div class="sect">Çakışmalar</div><div class="note">Aynı kayıt hem telefonda hem burada değişmiş. Hangisinin kalacağını seçin.</div>${cf.map((c) => html`<div class="card err stack"><div><b>${c.store} · ${c.local.no || c.local.pointNo || c.local.lineNo || c.entityId}</b><div class="note">${c.from} · ${new Date(c.at).toLocaleString('tr-TR')}</div></div>${c.fields.filter((f) => !['updatedAt', 'updatedBy', 'rev'].includes(f)).map((f) => html`<div class="row" style="font-size:12px"><b style="width:90px">${f}</b><button class="btn xs grow" onClick=${() => resolve(c, { [f]: 'local' })}>Buradaki: ${sh(c.local[f])}</button><button class="btn xs grow" onClick=${() => resolve(c, { [f]: 'remote' })}>Telefondaki: ${sh(c.remote[f])}</button></div>`)}<div class="grid2"><button class="btn sm" onClick=${() => resolve(c, 'local')}>Tümü buradaki</button><button class="btn sm" onClick=${() => resolve(c, 'remote')}>Tümü telefondaki</button></div></div>`)}` : null}`;
  }
  return html`<${Title} title="Senkron" sub=${'Cihaz ' + ds.deviceId} />
    <div class="grid2"><div class="stat"><b>Bekleyen</b><span style=${'color:' + (pend.length ? '#f59e0b' : '#10b981')}>${pend.length}</span></div><div class="stat"><b>Çakışma</b><span style=${'color:' + (cf.length ? '#ff8a8a' : '#10b981')}>${cf.length}</span></div></div>
    <div class="note">Tüm kayıtlar önce cihazda (offline) saklanır. İnternet gelince sunucuya gönderilir ya da .vsync dosyasıyla başka tablete aktarılır. Aynı kayıt iki cihazda değişirse çakışma olarak listelenir.</div>
    <div class="sect">Dosya ile</div>
    <div class="grid2"><button class="btn" onClick=${exportFile}>Değişiklikleri paylaş (.vsync)</button><label class="btn">Dosyadan al<input type="file" accept=".vsync,.json" style="display:none" onChange=${(e) => e.target.files[0] && importFile(e.target.files[0])} /></label></div>
    <div class="sect">Sunucu ile (REST)</div>
    <div class="card stack"><div class="fld"><label>Sunucu adresi</label><input class="inp mono" placeholder="https://sunucu/api" value=${cfg.url} onInput=${(e) => setCfg(Object.assign({}, cfg, { url: e.target.value }))} /></div><div class="fld"><label>Erişim anahtarı</label><input class="inp mono" type="password" value=${cfg.token} onInput=${(e) => setCfg(Object.assign({}, cfg, { token: e.target.value }))} /></div><button class="btn pri" disabled=${busy} onClick=${server}>${busy ? 'Senkronize ediliyor…' : 'SENKRONİZE ET'}</button><div class="note">Sunucu adresi kayıtlıysa internet geldiğinde otomatik senkronize edilir. Protokol: POST /sync {deviceId, cursor, changes[]} → {changes[], cursor}. Sunucu tarafı geliştirme planında tanımlıdır.</div></div>
    ${cf.length ? html`<div class="sect">Çakışmalar</div>${cf.map((c) => html`<div class="card err stack"><div><b>${c.store} · ${c.local.no || c.local.pointNo || c.local.lineNo || c.entityId}</b><div class="note">${c.from} · ${new Date(c.at).toLocaleString('tr-TR')}</div></div>${c.fields.filter((f) => !['updatedAt', 'updatedBy', 'rev'].includes(f)).map((f) => html`<div class="row" style="font-size:12px"><b style="width:90px">${f}</b><button class="btn xs grow" onClick=${() => resolve(c, { [f]: 'local' })}>Benim: ${sh(c.local[f])}</button><button class="btn xs grow" onClick=${() => resolve(c, { [f]: 'remote' })}>Gelen: ${sh(c.remote[f])}</button></div>`)}<div class="grid2"><button class="btn sm" onClick=${() => resolve(c, 'local')}>Tümü benimki</button><button class="btn sm" onClick=${() => resolve(c, 'remote')}>Tümü gelen</button></div></div>`)}` : null}
    <div class="sect">Bekleyen değişiklikler</div>
    <div class="card tight list">${pend.slice(-60).reverse().map((c) => html`<div class="li"><${Badge} k=${c.op === 'create' ? 'ok' : 'mut'}>${c.op}</${Badge}><div class="grow"><div class="t" style="font-size:12px">${(c.data && (c.data.no || c.data.pointNo || c.data.lineNo || c.data.name)) || c.entityId}</div><div class="s">${c.store} · rev ${c.rev} · ${new Date(c.ts).toLocaleTimeString('tr-TR')}</div></div></div>`)}${!pend.length ? html`<div class="empty">Kuyruk boş</div>` : null}</div>`;
}
