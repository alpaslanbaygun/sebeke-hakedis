// 05 · Dışa Aktarım — gerçek dosya üretimi (DXF, NCN, KMZ, SHP, GeoJSON, XLSX, rapor, teslim paketi)
import { html, useState, useEffect, useBus, Icon, Chip, Badge, Title, fmt, trn, Girdi, Toggle } from '../kit.js';
import STIL from '../../ortak/cizim-stili.js';
import { app } from '../ctx.js';
import SH from '../../interop/sh-core.cjs';

/**
 * Birleşik Metraj ayarları: şablon (gömülü temiz kopya ya da kullanıcının .xlsm dosyası; dosya bu oturumda tutulur), il ve
 * ilçe (projede saklanır: sebeke.metraj), yüklenici firma projenin yüklenicisinden gelir. Eklentideki Birleşik Metraj
 * penceresiyle aynı alanlar.
 */
function MetrajAyarlari() {
  const ps = app.ps;
  const m = (ps.p.sebeke || {}).metraj || {};
  const sablon = app.state.metrajSablonu || null;
  const kaydet = async (yeni) => {
    const sebeke = Object.assign({}, ps.p.sebeke || {}, { metraj: Object.assign({}, m, yeni) });
    try { await ps.updateProject({ sebeke }, 'Birleşik Metraj başlığı'); } catch (e) { app.toast(e.message, 'err'); }
  };
  const dosyaSec = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    f.arrayBuffer().then((buf) => { app.state.metrajSablonu = { ad: f.name, bytes: new Uint8Array(buf) }; app.toast('Şablon alındı: ' + f.name, 'ok'); app.bus.emit('project:computed'); }).catch((e) => app.toast(e.message, 'err'));
  };
  return html`<div class="card"><div class="row"><b class="grow">Birleşik Metraj</b>${sablon ? html`<${Badge} k="ok">KENDİ ŞABLONUM</${Badge}>` : html`<${Badge} k="mut">GÖMÜLÜ ŞABLON</${Badge}>`}</div>
    <div class="note">Yüklenici firma projenin yüklenicisinden (${ps.p.contractor || 'girilmemiş'}), grup no / işin adı / proje no bölgeden gelir.</div>
    <div class="grid2" style="margin-top:6px"><div class="fld"><label>İl</label><${Girdi} type="text" cls="inp" value=${m.il || ''} onSave=${(v) => kaydet({ il: String(v).trim() })} /></div>
    <div class="fld"><label>İlçe</label><${Girdi} type="text" cls="inp" value=${m.ilce || ''} onSave=${(v) => kaydet({ ilce: String(v).trim() })} /></div></div>
    <div class="row" style="margin-top:6px"><span class="grow note">${sablon ? 'Şablon: ' + sablon.ad : 'Gömülü temiz şablon (eski programın Birleşik Metraj çalışma kitabı, boş) kullanılır.'}</span>
    <label class="btn sm">Şablon seç…<input type="file" accept=".xlsm,.xlsx" style="display:none" onChange=${dosyaSec} /></label>
    ${sablon ? html`<button class="btn sm" onClick=${() => { app.state.metrajSablonu = null; app.bus.emit('project:computed'); }}>Gömülüye dön</button>` : null}</div></div>`;
}

/**
 * Çizim boyutları: DXF'teki simge büyüklüğü ve yazı yükseklikleri. AutoCAD dosyasıyla da gider gelir (eklentide Çizim
 * Ayarları › Görünüm ile aynı değerler); projede saklanır (sebeke.boyutlar).
 */
/** Hat kalınlığı seçenekleri (kat; eklentideki Çizim Ayarları › Görünüm › Hat kalınlığı ile aynı). */
const HAT_KALINLIKLARI = [[0, 'İnce çizgi'], [0.6, 'İnce'], [1, 'Normal'], [1.5, 'Kalın'], [2, 'Çok kalın']];
const kalinlikMm = (anahtar, kat) => String(Math.round(((STIL.katmanlar[anahtar] || {}).kalinlik || 0) * kat * 100) / 100).replace('.', ',');

function CizimBoyutlari() {
  const ps = app.ps;
  const b = Object.assign({}, SH.BOYUT_VARSAYILAN, (ps.p.sebeke || {}).boyutlar || {});
  const kaydet = async (yeni) => {
    const by = SH.boyutlarOku(yeni);
    const sebeke = Object.assign({}, ps.p.sebeke || {});
    if (by) sebeke.boyutlar = by; else delete sebeke.boyutlar;
    try { await ps.updateProject({ sebeke }, 'Çizim boyutları'); } catch (e) { app.toast(e.message, 'err'); }
  };
  const alan = (k, ad, adim) => html`<div class="fld"><label>${ad}</label><${Girdi} type="number" inputmode="decimal" step=${adim} value=${b[k]}
    onSave=${(v) => { const x = +String(v).replace(',', '.'); if (Number.isFinite(x)) kaydet(Object.assign({}, b, { [k]: x })); }} /></div>`;
  const varsayilan = !SH.boyutlarOku(b);
  const takim = b.simgeTakimi === 'SM' ? 'SM' : '';
  return html`<div class="card"><div class="row"><b class="grow">Çizim boyutları</b>${varsayilan ? html`<${Badge} k="mut">VARSAYILAN</${Badge}>` : html`<button class="btn sm" onClick=${() => kaydet(SH.BOYUT_VARSAYILAN)}>Varsayılana dön</button>`}</div>
    <div class="fld" style="margin-top:6px"><label>Simge takımı (DXF ve AutoCAD dosyası)</label>
      <select class="inp" value=${takim} onChange=${(e) => kaydet(Object.assign({}, b, { simgeTakimi: e.target.value }))}>
        <option value="">Klasik (lejant simgeleri)</option><option value="SM">Şebeke-M (dolu · yarı dolu · kontur · çift kontur + DM)</option></select></div>
    <div class="grid2" style="margin-top:6px">${alan('simgeOlcegi', 'Simge (kat)', 0.1)}${alan('elemanYaziYuksekligi', 'Eleman yazısı (m)', 0.1)}${alan('etiketYuksekligi', 'Kablo tipi yazısı (m)', 0.1)}${alan('metrajYuksekligi', 'Metraj yazısı (m)', 0.1)}</div>
    <div class="fld" style="margin-top:6px"><label>Hat kalınlığı (baskı 1/1000)</label><div class="chips">${HAT_KALINLIKLARI.map(([k, ad]) => html`<${Chip} on=${Math.abs((+b.hatKalinligi || 0) - k) < 1e-9} onClick=${() => kaydet(Object.assign({}, b, { hatKalinligi: k }))}>${ad}</${Chip}>`)}</div>
      <span class="note">${+b.hatKalinligi > 0 ? 'OG ' + kalinlikMm('HAT_OG', b.hatKalinligi) + ' · AG ' + kalinlikMm('HAT_AG', b.hatKalinligi) + ' mm (kâğıtta)' : 'Hatlar ince çizgi'}</span></div>
    <div class="row" style="margin-top:6px"><span class="grow">Malzemeleri çizimde göster<small class="note" style="display:block">Simgenin yanında, tipin altında: GT-60=1 (M)</small></span><${Toggle} on=${b.malzemeYazisi === true} label="Malzemeleri çizimde göster" onChange=${(v) => kaydet(Object.assign({}, b, { malzemeYazisi: v }))} /></div>
    <div class="note">DXF bu ölçülerle çizilir; AutoCAD dosyasıyla eklentiye de gider (eklentide Çizim Ayarları › Görünüm). Varsayılan: simge 1 kat, eleman ve kablo tipi yazısı 1,8 m, metraj 1,44 m, hat kalınlığı normal (1/1000 pafta).</div></div>`;
}
import { FORMATS, exportFormat } from '../../export/exporter.js';
import { makeCrs, crsSummary, zoneForLon } from '../../geo/crs.js';

export function ExportScreen() {
  useBus(['project:computed']);
  const ps = app.ps;
  const [sel, setSel] = useState(app.state.expSel || { sebeke: true, dxf: true, ncn: true, xlsx: true, package: true });
  const [busy, setBusy] = useState(null);
  const [crsKey, setCrsKey] = useState('proje');
  // Programın sürümü Google Earth dosyasının açıklamasına yazılır (eklentideki gibi "Şebeke-M <sürüm>")
  const [ver, setVer] = useState(app.state.appVer || null);
  useEffect(() => { if (!ver) app.bridge.info().then((i) => { app.state.appVer = (i && i.version) || null; setVer(app.state.appVer); }).catch(() => {}); }, []);
  const n = Object.values(sel).filter(Boolean).length;
  const errs = ps.result.issues.filter((i) => i.severity === 'error').length;
  const jobs = ps.data.exportJobs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const photos = ps.data.photos.length;
  const tot3 = ps.data.lines.reduce((s, l) => s + ((ps.result.lineInfo.get(l.id) || {}).length3D || 0), 0);
  const crsAlt = { proje: ps.p.crs, ed50: makeCrs({ datum: 'ED50', projection: 'TM3', cm: ps.p.crs.cm }), wgs: makeCrs({ datum: 'WGS84', projection: 'UTM', zone: Math.floor((ps.p.crs.cm + 180) / 6) + 1 }) };
  const run = async (share) => {
    if (errs && !(await app.confirm('Kontrol hataları', errs + ' hata var. Yine de üretilsin mi? (Teslim paketinde MANIFEST içinde belirtilir)', { ok: 'Üret' }))) return;
    const keys = Object.keys(sel).filter((k) => sel[k]);
    setBusy('Hazırlanıyor…');
    const files = [];
    try {
      const metraj = { sablon: app.state.metrajSablonu ? app.state.metrajSablonu.bytes : null };
      for (const k of keys) { setBusy(FORMATS[k].label + '…'); const out = await exportFormat(ps, k, { crs: crsKey === 'proje' ? null : crsAlt[crsKey], surum: app.web ? 'web' : 'telefon' + (ver ? ' ' + ver : ''), metraj }); files.push(...out); }
    } catch (e) { app.toast('Dışa aktarım hatası: ' + e.message, 'err', 6000); setBusy(null); return; }
    // Google Earth / CBS dosyasına yazılamayanlar ("ileride" durumundakiler, konumu olmayanlar): eklentinin dosyasında da yoklar
    const uy = [...new Set(files.filter((f) => !f.metraj).flatMap((f) => f.uyarilar || []))];
    if (uy.length) app.toast(uy.length + ' nesne Google Earth / CBS dosyasına yazılmadı: ' + uy.slice(0, 3).join(' · ') + (uy.length > 3 ? ' …' : ''), 'warn', 9000);
    // Birleşik Metraj: açılan sütunlar ve uyarılar
    const bm = files.find((f) => f.metraj);
    if (bm) {
      const o = bm.metraj.ozet, ys = bm.metraj.yeniSutunlar, ks = bm.metraj.kopyaSayfalar || [];
      app.toast('Birleşik Metraj: ' + o.eleman + ' direk · ' + o.iletkenSatiri + ' açıklık · ' + o.yeraltiSatiri + ' yeraltı satırı · ' + o.eslesen + ' eşleşen malzeme' +
        (ks.length ? ' · ' + ks.length + ' direk sayfası (' + ks.map((k) => k.ad).join(', ') + ')' : '') +
        (ys.length ? ' · ' + ys.length + ' yeni sütun (' + ys.slice(0, 3).map((y) => y.ad).join(', ') + (ys.length > 3 ? ' …' : '') + ')' : '') + (o.fazla ? ' · ' + o.fazla + ' malzeme şablona sığmadı' : ''), ys.length || o.fazla ? 'warn' : 'ok', 9000);
      if (bm.uyarilar && bm.uyarilar.length) app.toast('Birleşik Metraj uyarıları: ' + bm.uyarilar.slice(0, 3).join(' · ') + (bm.uyarilar.length > 3 ? ' …' : ''), 'warn', 9000);
    }
    const saved = [];
    // Web: birden çok çıktı tek zip olarak indirilir (her dosyaya ayrı onay sorulmasın)
    if (app.web && files.length > 1) {
      setBusy('İndiriliyor…');
      const zipName = (ps.p.code || 'proje').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '_cikti_' + new Date().toISOString().slice(0, 10) + '.zip';
      try { const r = await app.bridge.saveBundle(zipName, files); for (const f of files) saved.push({ name: f.name, size: f.data.length, uri: r && r.uri }); } catch (e) { app.toast(e.message, 'err', 5000); setBusy(null); return; }
    } else
    for (const f of files) { setBusy('Kaydediliyor: ' + f.name); try { const r = share ? await app.bridge.shareFile(f.name, f.mime, f.data) : await app.bridge.saveFile(f.name, f.mime, f.data); saved.push({ name: f.name, size: f.data.length, uri: r && r.uri }); } catch (e) { app.toast(f.name + ': ' + e.message, 'err'); } }
    if (!saved.length) { setBusy(null); return; }
    await ps.ds.create('exportJobs', { projectId: ps.p.id, formats: keys, crs: crsAlt[crsKey].label, files: saved, signature: ps.result.signature, stale: false, issues: errs }, { reason: 'Dışa aktarım: ' + keys.join(', '), silent: true });
    await ps.reload('exportJobs');
    setBusy(null);
    app.toast(saved.length + ' dosya ' + (app.web ? 'indirildi' + (saved.length > 1 ? ' (tek zip)' : '') : share ? 'paylaşıldı' : 'kaydedildi (İndirilenler/Sebeke-M)'), 'ok', 5000);
  };
  const toggle = (k) => { const s = Object.assign({}, sel, { [k]: !sel[k] }); setSel(s); app.state.expSel = s; };
  return html`<div class="title"><div class="grow"><h1>Dışa Aktarım</h1><div class="sub" style="font-family:Inter">CAD, CBS ve teslim dosyaları</div></div></div>
    <div class="card"><div class="lbl">Proje</div><div style="font-size:18px;font-weight:700;margin:2px 0">${ps.p.name}</div><div class="mono note">${ps.data.equipment.filter((e) => e.kind === 'pole').length} direk · ${ps.result.spans.length} açıklık · ${trn(tot3, 3)} m · ${photos} foto</div></div>
    <div class="lbl">Koordinat sistemi</div>
    <div class="grid3">${[['proje', ps.p.crs.datum === 'TUREF' ? 'ITRF96 TM' + ps.p.crs.cm : 'Proje CRS'], ['ed50', 'ED50 3°'], ['wgs', 'WGS84 UTM']].map(([k, l]) => html`<${Chip} on=${crsKey === k} onClick=${() => setCrsKey(k)}><span class="mono">${l}</span></${Chip}>`)}</div>
    <div class="note mono">${crsSummary(crsAlt[crsKey])}${crsKey !== 'proje' ? ' · enlem/boylamdan yeniden hesaplanır' : ''}</div>
    <div class="row"><span class="lbl grow">Çıktı formatları</span><span class="mono note">${n} / ${Object.keys(FORMATS).length}</span></div>
    ${Object.entries(FORMATS).map(([k, f]) => html`<button class=${'card row' + (sel[k] ? ' ok' : '')} style="width:100%;text-align:left;color:inherit;align-items:flex-start" onClick=${() => toggle(k)}>
      <span style=${'width:24px;height:24px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + (sel[k] ? '#10b981' : '#fff')}>${sel[k] ? html`<${Icon} n="check" s=${18} c="#0b1326" w=${3} />` : null}</span>
      <span class="grow"><div class="row"><b class="grow" style="font-size:16px">${f.label}</b><span class="badge b-mut">${f.ext}</span></div><div class="note">${f.desc}</div>
      ${k === 'dxf' && sel[k] ? html`<div class="row wrap" style="gap:4px;margin-top:6px">${['ELEKTRIK-DIREK-OG', 'ELEKTRIK-DIREK-AG', 'ELEKTRIK-HAT-OG', 'ELEKTRIK-TRAFO', 'ELEKTRIK-SDK'].map((x) => html`<span class="badge" style=${'background:var(--bg2);border:1px solid var(--line);color:' + (x.includes('OG') ? '#ff8a8a' : x.includes('AG') ? '#7ee08a' : '#8ea2ff')}>${x}</span>`)}</div>` : null}</span></button>`)}
    ${sel.dxf || sel.sebeke || sel.voltjson || sel.package ? html`<${CizimBoyutlari} />` : null}
    ${sel.metraj ? html`<${MetrajAyarlari} />` : null}
    ${errs ? html`<div class="alert warn"><${Icon} n="warn" s=${16} /><span>${errs} kontrol hatası var · <a onClick=${() => app.nav.go('checks')}>Kontrol listesi</a></span></div>` : null}
    ${jobs.length ? html`<div class="sect">Son üretilenler</div><div class="card tight list">${jobs.map((j) => html`<div class="li"><div class="grow"><div class="s">${new Date(j.createdAt).toLocaleString('tr-TR')} · ${j.crs}</div><div class="m">${j.formats.join(', ')} · ${(j.files || []).length} dosya</div></div>${j.stale ? html`<${Badge} k="warn">ESKİDİ</${Badge}>` : html`<${Badge} k="ok">GÜNCEL</${Badge}>`}</div>`)}</div><div class="note">Veri değişince önceki çıktılar "ESKİDİ" olarak işaretlenir (DXF/rapor zinciri).</div>` : null}
    <div class="row" style="margin-top:6px"><button class="btn pri huge grow" disabled=${!n || busy} onClick=${() => run(false)}><${Icon} n="down" s=${22} c="#0b1326" w=${2.6} />${busy || 'DIŞA AKTAR · ' + n}</button>${app.web ? null : html`<button class="btn" style="height:64px;flex-direction:column;gap:2px;font-size:11px" disabled=${!n || busy} onClick=${() => run(true)}><${Icon} n="share" s=${20} />PAYLAŞ</button>`}</div>
    ${app.web ? html`<div class="note">Dosyalar tarayıcının indirme klasörüne iner. DXF, NCN, KML, KMZ ve GeoJSON tek başına seçilirse zip içinde gelir. Rapor HTML dosyasıdır: açıp tarayıcıdan yazdırın ya da PDF olarak kaydedin.</div>` : null}`;
}
