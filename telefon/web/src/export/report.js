// Teknik rapor (yazdırılabilir HTML → PDF): proje, CRS, GNSS kalite, ekipman, hatlar/açıklıklar, ENH,
// Yeşil Defter (montaj/demontaj/DMM), hakediş, kontrol bulguları.
import { greenBookPage } from '../qty/metraj.js';
import { JOB_LABEL, SOURCE_LABEL, HAK_STATUSES, HAK_ORDER } from '../core/schema.js';
import { SRC } from '../core/source.js';
import { crsSummary } from '../geo/crs.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v, d = 3) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));

export function buildReportHTML(model, extra = {}) {
  const P = model.project;
  const errs = model.issues.filter((i) => i.severity === 'error'), warns = model.issues.filter((i) => i.severity === 'warn');
  const rtk = model.points.filter((p) => p.source === 'GNSS_RTK').length, phone = model.points.filter((p) => p.source === 'TELEFON_GPS').length;
  const table = (head, rows, cls = '') => '<table class="' + cls + '"><thead><tr>' + head.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + (c && c.html ? c.html : esc(c)) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  let h = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + esc(P.name) + ' · Teknik Rapor</title><style>' +
    '@page{size:A4 landscape;margin:12mm}body{font:10.5px/1.45 "Segoe UI",Arial,sans-serif;color:#111;margin:10mm 8mm}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #0b1326;padding-bottom:3px}h3{font-size:12px;margin:12px 0 4px}' +
    'table{border-collapse:collapse;width:100%;margin:4px 0 10px}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#0b1326;color:#fff;font-weight:600}td.num{text-align:right}' +
    '.kv{display:grid;grid-template-columns:180px 1fr;gap:2px 10px}.kv b{color:#444;font-weight:600}.err{color:#b91c1c}.warn{color:#a16207}.ok{color:#047857}.muted{color:#666}.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-weight:700;font-size:10px}' +
    '@media print{h2{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head><body>';
  h += '<h1>' + esc(P.name) + '</h1><div class="muted">Teknik rapor · ' + new Date().toLocaleString('tr-TR') + ' · veri imzası ' + model.signature + '</div>';
  h += '<h2>1. Proje</h2><div class="kv"><b>Proje kodu</b><span>' + esc(P.code || '—') + '</span><b>İdare / işveren</b><span>' + esc(P.client || '—') + '</span><b>Yüklenici</b><span>' + esc(P.contractor || '—') + '</span><b>Standart</b><span>' + esc(model.cat.std.name) + '</span><b>Koordinat sistemi</b><span>' + esc(crsSummary(model.crs)) + '</span><b>Yükseklik</b><span>' + esc(P.heightSystem) + ' · geoit: ' + esc((P.geoid || {}).model) + '</span><b>ENH bölgesi</b><span>' + esc(P.enhZone) + '</span></div>';
  // Veri kaynağı dağılımı, hakediş durumu, fotoğraf ve operatör özetleri
  const srcCount = {}; for (const p of model.points) srcCount[p.source] = (srcCount[p.source] || 0) + 1;
  const srcTxt = Object.entries(srcCount).map(([k, v]) => '[' + ((SRC[k] || {}).tag || k) + '] ' + v).join(' · ') || '—';
  const hakCount = {}; for (const o of [...model.equipment, ...model.lines]) if (o.hak) hakCount[o.hak] = (hakCount[o.hak] || 0) + 1;
  const operators = [...new Set([...model.points.map((p) => p.operator), ...(model.photos || []).map((p) => p.operator || p.user)].filter(Boolean))];
  const devices = [...new Set(model.points.map((p) => p.device ? p.device + (p.deviceSerial ? ' #' + p.deviceSerial : '') : null).filter(Boolean))];
  const nPhoto = (model.photos || []).length;
  const dt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const acc = (v) => (v == null ? '' : '±' + (v >= 1 ? (+v).toFixed(1) : (+v).toFixed(3)));
  const tag = (o) => (o.source ? '[' + ((SRC[o.source] || {}).tag || o.source) + ']' : '');
  h += '<h2>2. Özet</h2><div class="kv"><b>Nokta</b><span>' + model.points.length + ' (RTK FIX ' + rtk + ' · telefon ' + phone + ')</span><b>Veri kaynağı</b><span>' + esc(srcTxt) + '</span><b>Ekipman</b><span>' + model.equipment.length + '</span><b>Hat</b><span>' + model.lines.length + ' · toplam ' + n(model.lines.reduce((s, l) => s + l.length3D, 0), 2) + ' m (3B)</span><b>Açıklık</b><span>' + model.spans.length + '</span>' +
    '<b>Hakediş durumu</b><span>' + (HAK_ORDER.filter((k) => hakCount[k]).map((k) => HAK_STATUSES[k].label + ' ' + hakCount[k]).join(' · ') || '—') + '</span><b>Fotoğraf</b><span>' + nPhoto + '</span><b>Operatör</b><span>' + esc(operators.join(', ') || '—') + '</span><b>GNSS cihazı</b><span>' + esc(devices.join(', ') || '—') + '</span>' +
    '<b>Kontrol</b><span class="' + (errs.length ? 'err' : 'ok') + '">' + errs.length + ' hata · ' + warns.length + ' uyarı</span></div>';
  h += '<h2>3. Saha objeleri</h2>' + table(['No', 'Tür', 'Durum', 'Tip', 'Y (Sağa)', 'X (Yukarı)', 'Z', 'Veri kaynağı', 'Doğruluk (m)', 'Fix', 'Cihaz', 'Ölçüm tarihi', 'Hakediş', 'Foto', 'Operatör', 'Not'],
    model.equipment.map((e) => [e.no, e.kindLabel, e.stateLabel || e.state, [e.groupLabel || e.attrs.post || '', e.typeName || e.attrs.typeName || ''].filter(Boolean).join(' · '), n(e.E), n(e.N), e.H != null ? n(e.H) : 'bilinmiyor', tag(e), acc(e.sigmaH), e.fix || '', e.device || '', dt(e.measuredAt), e.hakLabel || '—', e.photos || 0, e.operator || '', e.note || '']));
  const loose = model.points.filter((p) => !model.equipment.some((e) => e.pointId === p.id));
  if (loose.length) h += '<h3>Ekipmansız noktalar (hat köşe · detay · tasarım)</h3>' + table(['No', 'Sınıf', 'Y (Sağa)', 'X (Yukarı)', 'Z', 'Veri kaynağı', 'Doğruluk (m)', 'Fix', 'Ölçüm tarihi', 'Foto', 'Operatör', 'Not'], loose.map((p) => [p.no, p.cls, n(p.E), n(p.N), p.H != null ? n(p.H) : 'bilinmiyor', tag(p), acc(p.sigmaH), p.fix || '', dt(p.measuredAt), p.photos || 0, p.operator || '', p.note || '']));
  h += '<h2>4. GNSS ölçüm kayıtları</h2>' + table(['No', 'Kaynak', 'Fix', 'σH', 'σV', 'Uydu', 'PDOP', 'HDOP', 'VDOP', 'Cihaz', 'Seri no', 'Yöntem', 'Düzeltme kaynağı', 'Base', 'Operatör', 'Tarih · saat', 'Koordinat sistemi'],
    model.points.filter((p) => p.sourceRaw === 'GNSS_RTK' || p.sourceRaw === 'PHONE' || p.sourceRaw === 'SIM' || p.fix).map((p) => [p.no, tag(p) + (p.override ? ' uyarıyla kabul' : ''), p.fix || '', n(p.sigmaH), n(p.sigmaV), p.sats ?? '', p.pdop != null ? n(p.pdop, 1) : '', p.hdop != null ? n(p.hdop, 1) : '', p.vdop != null ? n(p.vdop, 1) : '', p.device || '', p.deviceSerial || '', p.method || '', p.correction || '', p.base ? (p.base.name || '') + (p.base.E != null ? ' (Y ' + n(p.base.E, 2) + ' · X ' + n(p.base.N, 2) + ')' : '') : '', p.operator || '', dt(p.measuredAt), p.crsLabel || '']));
  h += '<h3>Direk rolleri</h3>' + table(['No', 'Grup', 'Tip', 'Rol', 'Açı (°)', 'Boy (m)'], model.equipment.filter((e) => e.kind === 'pole' || e.kind === 'lighting').map((e) => [e.no, e.groupLabel, e.typeName, e.role || '', e.angle != null ? n(e.angle, 2) : '', e.heightM ?? '']));
  h += '<h2>5. Hatlar ve açıklıklar</h2>' + table(['Hat', 'Tip', 'Tesis', 'Durum', 'İletken / kablo', '2B (m)', '3B (m)', 'Hakediş', 'Foto'], model.lines.map((l) => [l.no, l.lineType, l.install, l.state, l.label, n(l.length2D, 2), n(l.length3D, 2), l.hakLabel || '—', l.photos || 0]));
  h += table(['Hat', 'Başlangıç', 'Bitiş', '2B (m)', '3B (m)', 'ΔH (m)', 'Semt (°)'], model.spans.map((s) => [s.lineNo, s.fromNo, s.toNo, n(s.length2D), n(s.length3D), n(s.dH), n(s.bearing, 4)]));
  const enhs = [...(model.enh || new Map()).entries()].filter(([, r]) => r && !r.error);
  if (enhs.length) {
    h += '<h2>6. ENH mekanik hesap</h2>';
    for (const [lid, r] of enhs) {
      const l = model.lines.find((x) => x.id === lid);
      h += '<h3>' + esc(l ? l.no + ' · ' + l.label : lid) + ' · ' + esc(r.conductor) + ' · ' + esc(r.zone.label) + '</h3>';
      h += table(['Bölüm', 'Açıklık', 'İdeal açıklık (m)', 'Yönetici durum', 'σmax', 'EDS %', 'Kritik açıklık (m)'], r.sections.map((s) => [s.from + '→' + s.to, s.spans, n(s.ar, 1), s.governing, n(s.sMax, 2), { html: '<span class="' + (s.edsOk ? 'ok' : 'warn') + '">' + n(s.edsPct, 1) + '</span>' }, Number.isFinite(s.aCrit) ? n(s.aCrit, 1) : '∞']));
      h += table(['Açıklık', 'a (m)', 'Sehim maks (m)', 'Sehim buzlu (m)', 'Tmax (daN)', 'Zemin açıklığı (m)', 'Gerekli (m)', 'Sonuç'], r.spans.map((s) => [s.from + '→' + s.to, n(s.a, 2), n(s.sagMax, 3), n(s.sagIce, 3), n(s.Tmax, 0), n(s.groundClear, 2), n(s.groundReq, 1), { html: s.ok == null ? '<span class="muted">boy yok</span>' : s.ok ? '<span class="ok">UYGUN</span>' : '<span class="err">UYUMSUZ</span>' }]));
      h += table(['Direk', 'Rol', 'Açı', 'Düşey (daN)', 'Rüzgar (daN)', 'Açı kuvveti (daN)', 'Boyuna (daN)', 'Tepe kuvveti (daN)', 'Kapasite', 'Sonuç'], r.poles.map((p) => [p.no, p.role, p.angle ? n(p.angle, 2) : '', n(p.V, 0), n(p.Hwind, 0), n(p.Hangle, 0), n(p.Hlong, 0), n(p.Ftop, 0), p.cap ? n(p.cap, 0) : 'tanımsız', { html: p.ok == null ? '<span class="muted">—</span>' : p.ok ? '<span class="ok">UYGUN</span>' : '<span class="err">AŞIM</span>' }]));
    }
  }
  h += '<h2>7. Yeşil Defter (otomatik metraj)</h2>';
  for (const job of ['montaj', 'demontaj', 'dmm']) {
    const rows = greenBookPage(model.quantities, job);
    if (!rows.length) continue;
    h += '<h3>' + JOB_LABEL[job] + ' sayfası</h3>' + table(['Servis', 'Açıklama', 'Miktar', 'Birim', 'Kaynak'], rows.map((r) => [r.code, r.name, n(r.qty, r.unit === 'Kg' ? 2 : r.unit === 'Ad' ? 0 : 3), r.unit, r.sources ? Object.entries(r.sources).map(([k, v]) => (SOURCE_LABEL[k] || k)).join(' + ') : '']));
  }
  if (extra.period) {
    const t = extra.period;
    h += '<h2>8. Hakediş · ' + t.period.no + '. dönem (' + esc(t.period.start) + ' – ' + esc(t.period.end) + ') · ' + esc(t.period.status) + '</h2>' + table(['İş', 'Servis', 'Açıklama', 'Birim', 'Sözleşme', 'Önceki', 'Bu dönem', 'Kümülatif', 'Kalan', 'Kaynak'], t.lines.map((l) => [JOB_LABEL[l.job], l.code, l.name, l.unit, n(l.contract), n(l.previous), n(l.current), n(l.cumulative), { html: '<span class="' + (l.remaining < 0 ? 'err' : '') + '">' + n(l.remaining) + '</span>' }, Object.keys(l.sources).map((k) => SOURCE_LABEL[k] || k).join(', ')]));
  }
  h += '<h2>9. Kontrol bulguları</h2>' + (model.issues.length ? table(['Kod', 'Önem', 'Kayıt', 'Açıklama'], model.issues.map((i) => [i.code, i.severity === 'error' ? 'HATA' : 'UYARI', i.entityNo, i.message])) : '<p class="ok">Bulgu yok.</p>');
  h += '<h2>10. Fotoğraflar · ' + nPhoto + ' adet</h2>' + (nPhoto ? table(['Dosya', 'Obje', 'Tür', 'Tarih · saat', 'Enlem', 'Boylam', 'Doğruluk (m)', 'Fix', 'Operatör', 'Açıklama'], (model.photos || []).map((ph) => [ph.filepath || ph.filename || ph.id, ph.ownerNo || '', ph.ownerType || '', dt(ph.timestamp), ph.lat != null ? (+ph.lat).toFixed(7) : '', ph.lon != null ? (+ph.lon).toFixed(7) : '', acc(ph.accuracy), ph.fix || ph.gnssFix || '', ph.operator || ph.user || '', ph.note || ''])) : '<p class="muted">Fotoğraf yok.</p>');
  h += '<p class="muted">Bu rapor Şebeke-M tarafından proje veritabanından otomatik üretilmiştir. "Doğrulanmamış varsayılan" olarak işaretli standart tabloları (' + esc((model.cat.std.unverifiedTables || []).join(', ')) + ') proje öncesi kontrol edilmelidir.</p>';
  return h + '</body></html>';
}
