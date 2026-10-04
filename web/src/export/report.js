// Teknik rapor (yazdırılabilir HTML → PDF): proje, CRS, GNSS kalite, ekipman, hatlar/açıklıklar, ENH,
// Yeşil Defter (montaj/demontaj/DMM), hakediş, kontrol bulguları.
import { greenBookPage } from '../qty/metraj.js';
import { JOB_LABEL, SOURCE_LABEL } from '../core/schema.js';
import { crsSummary } from '../geo/crs.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v, d = 3) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));

export function buildReportHTML(model, extra = {}) {
  const P = model.project;
  const errs = model.issues.filter((i) => i.severity === 'error'), warns = model.issues.filter((i) => i.severity === 'warn');
  const rtk = model.points.filter((p) => p.source === 'GNSS_RTK').length, phone = model.points.filter((p) => p.source === 'PHONE').length;
  const table = (head, rows, cls = '') => '<table class="' + cls + '"><thead><tr>' + head.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + (c && c.html ? c.html : esc(c)) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  let h = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + esc(P.name) + ' · Teknik Rapor</title><style>' +
    'body{font:11px/1.45 "Segoe UI",Arial,sans-serif;color:#111;margin:18mm 14mm}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #0b1326;padding-bottom:3px}h3{font-size:12px;margin:12px 0 4px}' +
    'table{border-collapse:collapse;width:100%;margin:4px 0 10px}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#0b1326;color:#fff;font-weight:600}td.num{text-align:right}' +
    '.kv{display:grid;grid-template-columns:180px 1fr;gap:2px 10px}.kv b{color:#444;font-weight:600}.err{color:#b91c1c}.warn{color:#a16207}.ok{color:#047857}.muted{color:#666}.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-weight:700;font-size:10px}' +
    '@media print{h2{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head><body>';
  h += '<h1>' + esc(P.name) + '</h1><div class="muted">Teknik rapor · ' + new Date().toLocaleString('tr-TR') + ' · veri imzası ' + model.signature + '</div>';
  h += '<h2>1. Proje</h2><div class="kv"><b>Proje kodu</b><span>' + esc(P.code || '—') + '</span><b>İdare / işveren</b><span>' + esc(P.client || '—') + '</span><b>Yüklenici</b><span>' + esc(P.contractor || '—') + '</span><b>Standart</b><span>' + esc(model.cat.std.name) + '</span><b>Koordinat sistemi</b><span>' + esc(crsSummary(model.crs)) + '</span><b>Yükseklik</b><span>' + esc(P.heightSystem) + ' · geoit: ' + esc((P.geoid || {}).model) + '</span><b>ENH bölgesi</b><span>' + esc(P.enhZone) + '</span></div>';
  h += '<h2>2. Özet</h2><div class="kv"><b>Nokta</b><span>' + model.points.length + ' (RTK ' + rtk + ' · telefon/test ' + phone + ')</span><b>Ekipman</b><span>' + model.equipment.length + '</span><b>Hat</b><span>' + model.lines.length + ' · toplam ' + n(model.lines.reduce((s, l) => s + l.length3D, 0), 2) + ' m (3B)</span><b>Açıklık</b><span>' + model.spans.length + '</span><b>Kontrol</b><span class="' + (errs.length ? 'err' : 'ok') + '">' + errs.length + ' hata · ' + warns.length + ' uyarı</span></div>';
  h += '<h2>3. GNSS ölçü noktaları</h2>' + table(['No', 'Sınıf', 'Kaynak', 'FIX', 'σH', 'σV', 'Y (Sağa)', 'X (Yukarı)', 'Z'], model.points.map((p) => [p.no, p.cls, p.source, p.fix || '', n(p.sigmaH), n(p.sigmaV), n(p.E), n(p.N), n(p.H)]));
  h += '<h2>4. Ekipman</h2>' + table(['No', 'Tür', 'Durum', 'Grup', 'Tip', 'Rol', 'Açı (°)', 'Boy (m)'], model.equipment.map((e) => [e.no, e.kindLabel, e.stateLabel || e.state, e.groupLabel || (e.attrs.post || ''), e.typeName, e.role || '', e.angle != null ? n(e.angle, 2) : '', e.heightM ?? '']));
  h += '<h2>5. Hatlar ve açıklıklar</h2>' + table(['Hat', 'Tip', 'Tesis', 'Durum', 'İletken / kablo', '2B (m)', '3B (m)'], model.lines.map((l) => [l.no, l.lineType, l.install, l.state, l.label, n(l.length2D, 2), n(l.length3D, 2)]));
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
  h += '<p class="muted">Bu rapor VOLT-EDAŞ Saha tarafından proje veritabanından otomatik üretilmiştir. "Doğrulanmamış varsayılan" olarak işaretli standart tabloları (' + esc((model.cat.std.unverifiedTables || []).join(', ')) + ') proje öncesi kontrol edilmelidir.</p>';
  return h + '</body></html>';
}
