// 05 · Dışa Aktarım — gerçek dosya üretimi (DXF, NCN, KMZ, SHP, GeoJSON, XLSX, rapor, teslim paketi)
import { html, useState, useEffect, useBus, Icon, Chip, Badge, Title, fmt, trn } from '../kit.js';
import { app } from '../ctx.js';
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
      for (const k of keys) { setBusy(FORMATS[k].label + '…'); const out = await exportFormat(ps, k, { crs: crsKey === 'proje' ? null : crsAlt[crsKey], surum: app.web ? 'web' : 'telefon' + (ver ? ' ' + ver : '') }); files.push(...out); }
    } catch (e) { app.toast('Dışa aktarım hatası: ' + e.message, 'err', 6000); setBusy(null); return; }
    // Google Earth / CBS dosyasına yazılamayanlar ("ileride" durumundakiler, konumu olmayanlar): eklentinin dosyasında da yoklar
    const uy = [...new Set(files.flatMap((f) => f.uyarilar || []))];
    if (uy.length) app.toast(uy.length + ' nesne Google Earth / CBS dosyasına yazılmadı: ' + uy.slice(0, 3).join(' · ') + (uy.length > 3 ? ' …' : ''), 'warn', 9000);
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
  return html`<div class="title"><div class="grow"><h1>Dışa Aktarım</h1><div class="sub" style="font-family:Inter">CAD, CBS ve TEDAŞ teslim dosyaları</div></div></div>
    <div class="card"><div class="lbl">Proje</div><div style="font-size:18px;font-weight:700;margin:2px 0">${ps.p.name}</div><div class="mono note">${ps.data.equipment.filter((e) => e.kind === 'pole').length} direk · ${ps.result.spans.length} açıklık · ${trn(tot3, 3)} m · ${photos} foto</div></div>
    <div class="lbl">Koordinat sistemi</div>
    <div class="grid3">${[['proje', ps.p.crs.datum === 'TUREF' ? 'ITRF96 TM' + ps.p.crs.cm : 'Proje CRS'], ['ed50', 'ED50 3°'], ['wgs', 'WGS84 UTM']].map(([k, l]) => html`<${Chip} on=${crsKey === k} onClick=${() => setCrsKey(k)}><span class="mono">${l}</span></${Chip}>`)}</div>
    <div class="note mono">${crsSummary(crsAlt[crsKey])}${crsKey !== 'proje' ? ' · enlem/boylamdan yeniden hesaplanır' : ''}</div>
    <div class="row"><span class="lbl grow">Çıktı formatları</span><span class="mono note">${n} / ${Object.keys(FORMATS).length}</span></div>
    ${Object.entries(FORMATS).map(([k, f]) => html`<button class=${'card row' + (sel[k] ? ' ok' : '')} style="width:100%;text-align:left;color:inherit;align-items:flex-start" onClick=${() => toggle(k)}>
      <span style=${'width:24px;height:24px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + (sel[k] ? '#10b981' : '#fff')}>${sel[k] ? html`<${Icon} n="check" s=${18} c="#0b1326" w=${3} />` : null}</span>
      <span class="grow"><div class="row"><b class="grow" style="font-size:16px">${f.label}</b><span class="badge b-mut">${f.ext}</span></div><div class="note">${f.desc}</div>
      ${k === 'dxf' && sel[k] ? html`<div class="row wrap" style="gap:4px;margin-top:6px">${['ELEKTRIK-DIREK-OG', 'ELEKTRIK-DIREK-AG', 'ELEKTRIK-HAT-OG', 'ELEKTRIK-TRAFO', 'ELEKTRIK-SDK'].map((x) => html`<span class="badge" style=${'background:#0e1730;border:1px solid #334155;color:' + (x.includes('OG') ? '#ff8a8a' : x.includes('AG') ? '#7ee08a' : '#8ea2ff')}>${x}</span>`)}</div>` : null}</span></button>`)}
    ${errs ? html`<div class="alert warn"><${Icon} n="warn" s=${16} /><span>${errs} kontrol hatası var · <a onClick=${() => app.nav.go('checks')}>Kontrol listesi</a></span></div>` : null}
    ${jobs.length ? html`<div class="sect">Son üretilenler</div><div class="card tight list">${jobs.map((j) => html`<div class="li"><div class="grow"><div class="s">${new Date(j.createdAt).toLocaleString('tr-TR')} · ${j.crs}</div><div class="m">${j.formats.join(', ')} · ${(j.files || []).length} dosya</div></div>${j.stale ? html`<${Badge} k="warn">ESKİDİ</${Badge}>` : html`<${Badge} k="ok">GÜNCEL</${Badge}>`}</div>`)}</div><div class="note">Veri değişince önceki çıktılar "ESKİDİ" olarak işaretlenir (DXF/rapor zinciri).</div>` : null}
    <div class="row" style="margin-top:6px"><button class="btn pri huge grow" disabled=${!n || busy} onClick=${() => run(false)}><${Icon} n="down" s=${22} c="#0b1326" w=${2.6} />${busy || 'DIŞA AKTAR · ' + n}</button>${app.web ? null : html`<button class="btn" style="height:64px;flex-direction:column;gap:2px;font-size:11px" disabled=${!n || busy} onClick=${() => run(true)}><${Icon} n="share" s=${20} />PAYLAŞ</button>`}</div>
    ${app.web ? html`<div class="note">Dosyalar tarayıcının indirme klasörüne iner. DXF, NCN, KML, KMZ ve GeoJSON tek başına seçilirse zip içinde gelir. Rapor HTML dosyasıdır: açıp tarayıcıdan yazdırın ya da PDF olarak kaydedin.</div>` : null}`;
}
