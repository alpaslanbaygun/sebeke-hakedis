// Dışa aktarım servisi: tüm formatlar + TEDAŞ/EDAŞ teslim paketi (ZIP + SHA-256 manifest).
import { buildExportModel } from './model.js';
import { buildDXF, dxfBytes } from './dxf.js';
import { shapefileLayers, writeShapefile } from './shp.js';
import { buildGeoJSON, kml3BKlasoru, buildNCN, buildPointsCSV } from './gis.js';
import { kmlMetni, mifDosyalari, mifCoordSys, cp1254 } from './cbs.js';
import { unproject, project as projLL } from '../geo/crs.js';
import SH from '../interop/sh-core.cjs';
import { buildXLSX } from './xlsx.js';
import { buildReportHTML } from './report.js';
import { zip, enc, sha256Hex } from './zip.js';
import { greenBookPage } from '../qty/metraj.js';
import { JOB_LABEL, SOURCE_LABEL } from '../core/schema.js';
import { photoPath, safeName, projectFolder } from '../services/photo-service.js';
import { HAK_STATUSES, HAK_ORDER } from '../core/schema.js';
import { sebekeYaz, voltProjeYaz } from '../interop/sebeke.js';
import { kayitSatirlari } from '../hesap/kayitlar.js';

// Hesap kayıtlarında "hesabı yapan": uygulamadaki kullanıcı adı (varsayılan ad değilse)
const kullaniciAdi = (ps) => { const u = (ps.ds && ps.ds.user) || {}; return u.name && u.name !== 'Operatör' ? u.name : null; };

export const FORMATS = {
  sebeke: { label: 'AutoCAD proje dosyası', ext: '.sebeke.json', desc: 'AutoCAD eklentisi "Telefondan Al" ile açar: direk, hat, kanal ve malzemeler eklentinin biçiminde (Durum Tespit raporu için)' },
  voltjson: { label: 'Telefon proje dosyası', ext: '.volt.json', desc: 'Projenin tam yedeği (tüm kayıtlar) + AutoCAD bölümü; eklenti ve telefon bunu açar' },
  dxf: { label: 'AutoCAD DXF', ext: '.dxf', desc: 'Lejant katmanları, bloklar, ACI renkleri, çizgi tipleri, yazılar · 1/1000' },
  ncn: { label: 'Netcad NCN', ext: '.ncn', desc: 'Nokta adı · Y · X · Z · kod (NCZ kapalı formattır; Netcad DXF+NCN içe alır)' },
  kmz: { label: 'Google Earth KMZ', ext: '.kmz', desc: 'AutoCAD eklentisiyle aynı: her proje bir klasör (sınır, eleman, hat, kanal, sondaj), GPS noktaları; her nesnenin bilgileri (GIS no, tip, durum, hakediş, metraj…) · ek klasörde 3B direk ve iletken' },
  mif: { label: 'CBS MapInfo (MIF / MID)', ext: '.zip', desc: 'AutoCAD eklentisiyle aynı katmanlar ve sütunlar: eleman, hat, kanal, sondaj, proje sınırı, GPS noktası · Türkçe Windows kod sayfası · seçilen koordinat sisteminde' },
  shp: { label: 'CBS Shapefile', ext: '.zip', desc: 'SHP + SHX + DBF + PRJ + CPG · ekipman, hat, açıklık, ölçü katmanları' },
  geojson: { label: 'GeoJSON', ext: '.geojson', desc: 'RFC 7946 (WGS84) + proje CRS sürümü' },
  xlsx: { label: 'Excel (Metraj · Yeşil Defter · Hakediş)', ext: '.xlsx', desc: 'Montaj / Demontaj / DMM sayfaları, poz, malzeme, hakediş' },
  report: { label: 'Teknik rapor', ext: '.html', desc: 'Yazdır → PDF' },
  package: { label: 'TEDAŞ/EDAŞ teslim paketi', ext: '.zip', desc: 'Proje klasörü: PROJECT_INFO · SAHA_ALIMI · HAKEDIS · GNSS · fotoğraflar (tür/obje) · HARITA · EXPORT · RAPORLAR · SHA-256' }
};

// Obje satırları (ekipman + hat + ekipmansız nokta): rapor, Excel ve CSV aynı listeyi kullanır
export function objectRows(model) {
  const pid = model.project.id, cs = model.crs.label + (model.crs.epsg ? ' (EPSG:' + model.crs.epsg + ')' : '');
  const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
  const rows = [];
  for (const e of model.equipment) rows.push([e.id, pid, e.kindLabel || e.kind, e.no, r3(e.E), r3(e.N), r3(e.H), cs, e.measuredAt || '', e.source || '', e.device ? e.device + (e.deviceSerial ? ' #' + e.deviceSerial : '') : '', e.sigmaH ?? null, e.fix || '', e.sats ?? null, e.hdop ?? null, e.vdop ?? null, e.pdop ?? null, e.operator || '', e.note || '', e.hak || '', e.progress || '', e.photos || 0]);
  for (const l of model.lines) { const a = l.coords[0] || {}; rows.push([l.id, pid, l.channelOnly ? 'Kanal / Kazı' : l.install === 'yeralti' ? 'Kablo' : 'Hat', l.no, r3(a.E), r3(a.N), r3(a.H), cs, l.workDate || '', '', '', null, '', null, null, null, null, '', (l.label || '') + ' · ' + (Math.round(l.length3D * 100) / 100) + ' m' + (l.note ? ' · ' + l.note : ''), l.hak || '', l.hak && l.hak !== 'YAPILACAK' && l.hak !== 'BASLANDI' ? 'done' : 'planned', l.photos || 0]); }
  const eqPts = new Set(model.equipment.map((e) => e.pointId));
  for (const p of model.points) if (!eqPts.has(p.id)) rows.push([p.id, pid, p.cls === 'HAT' ? 'Hat köşe noktası' : p.cls === 'TASARIM' ? 'Tasarım noktası' : 'Detay noktası', p.no, r3(p.E), r3(p.N), r3(p.H), cs, p.measuredAt || '', p.source || '', p.device ? p.device + (p.deviceSerial ? ' #' + p.deviceSerial : '') : '', p.sigmaH ?? null, p.fix || '', p.sats ?? null, p.hdop ?? null, p.vdop ?? null, p.pdop ?? null, p.operator || '', p.note || '', '', '', p.photos || 0]);
  return rows;
}
// Fotoğrafın proje içi yolu: yeni kayıtlarda saklı; eski kayıtlarda türetilir
export function photoFile(ph) {
  const filename = ph.filename || safeName(ph.ownerNo || 'FOTO') + '_' + String(ph.id || '').slice(-6) + '.jpg';
  return { filename, filepath: ph.filepath || (ph.ownerNo ? photoPath(ph.ownerType || 'pole', ph.ownerNo, filename) : 'FOTOGRAFLAR/' + filename) };
}

export function workbookSheets(model, ps) {
  const n3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
  const sheets = [];
  sheets.push({ name: 'Metraj', title: model.project.name + ' · Otomatik metraj', subtitle: model.cat.std.name + ' · ' + new Date().toLocaleString('tr-TR'), columns: [{ h: 'İş', w: 10 }, { h: 'Servis kodu', w: 18 }, { h: 'Açıklama', w: 60 }, { h: 'Birim', w: 7 }, { h: 'Miktar', w: 12, fmt: '0.000' }, { h: 'Sayfada var', w: 10 }, { h: 'Kaynak', w: 36 }, { h: 'Referans', w: 40 }], rows: model.quantities.map((q) => [JOB_LABEL[q.job], q.code, q.name, q.unit, n3(q.qty), q.available ? 'EVET' : 'HAYIR', Object.entries(q.sources).map(([k, v]) => (SOURCE_LABEL[k] || k) + ' ' + n3(v)).join(' · '), q.refs.map((r) => r.no).filter((x, i, a) => a.indexOf(x) === i).slice(0, 30).join(', ')]) });
  for (const job of ['montaj', 'demontaj', 'dmm']) {
    const rows = greenBookPage(model.quantities, job);
    if (!rows.length) continue;
    sheets.push({ name: 'YD ' + JOB_LABEL[job], title: 'Yeşil Defter · ' + JOB_LABEL[job] + ' sayfası', columns: [{ h: 'Servis', w: 18 }, { h: 'Açıklama', w: 64 }, { h: 'Miktar', w: 12, fmt: '0.000' }, { h: 'Birim', w: 7 }, { h: 'Durum', w: 14 }], rows: rows.map((r) => [r.code, r.name, n3(r.qty), r.unit, r.sub ? '' : r.noPoz ? 'POZ TANIMSIZ' : r.ok ? 'O' + (r.hasManual ? '+M' : '') : 'sayfada yok']) });
  }
  const ptab = ps && ps.data.periods.length ? ps.periodTable() : null;
  if (ptab && ptab.period) sheets.push({ name: 'Hakediş ' + ptab.period.no, title: 'Hakediş ' + ptab.period.no + '. dönem · ' + ptab.period.start + ' – ' + ptab.period.end + ' · ' + ptab.period.status, columns: [{ h: 'İş', w: 10 }, { h: 'Servis', w: 18 }, { h: 'Açıklama', w: 50 }, { h: 'Birim', w: 7 }, { h: 'Sözleşme', w: 12, fmt: '0.000' }, { h: 'Önceki', w: 12, fmt: '0.000' }, { h: 'Bu dönem', w: 12, fmt: '0.000' }, { h: 'Kümülatif', w: 12, fmt: '0.000' }, { h: 'Kalan', w: 12, fmt: '0.000' }, { h: 'Birim fiyat', w: 12, fmt: '#,##0.00' }, { h: 'Tutar', w: 14, fmt: '#,##0.00' }, { h: 'Kaynak', w: 30 }], rows: ptab.lines.map((l) => [JOB_LABEL[l.job], l.code, l.name, l.unit, l.contract, l.previous, l.current, l.cumulative, l.remaining, l.unitPrice, l.amount, Object.keys(l.sources).map((k) => SOURCE_LABEL[k] || k).join(', ')]) });
  const used = [...new Set(model.quantities.map((q) => q.servis).filter(Boolean))];
  sheets.push({ name: 'Poz', title: 'Kullanılan pozlar · ' + model.cat.std.name, columns: [{ h: 'Servis', w: 18 }, { h: 'Poz no', w: 10 }, { h: 'Açıklama', w: 60 }, { h: 'Birim', w: 7 }, { h: 'kg/Ad', w: 9, fmt: '0.00' }, { h: 'Montaj', w: 8 }, { h: 'Demontaj', w: 9 }, { h: 'DMM', w: 6 }, { h: 'BF poz', w: 14 }, { h: 'Geçerlilik', w: 22 }], rows: used.map((s) => model.cat.poz(s)).filter(Boolean).map((p) => [p.servis, p.pozNo || '', p.name, p.unit, p.kgPerUnit, p.montaj ? 'E' : 'H', p.demontaj ? 'E' : 'H', p.dmm ? 'E' : 'H', p.bfPoz || '', p.validFrom + ' – ' + p.validTo]) });
  if (ps) {
    const mrows = [];
    for (const e of ps.data.equipment) { const m = ps.result.matsByEq.get(e.id); if (!m) continue; for (const it of m.items) mrows.push([e.no, JOB_LABEL[it.jobOverride || m.job] || '—', it.servis || '', it.name, n3(it.qty), it.unit, it.origin === 'OTO' ? (it.overridden ? 'O (miktar düzeltildi)' : 'O') : 'M · ' + (it.approved ? 'onaylı' : 'onay bekliyor'), it.why]); }
    sheets.push({ name: 'Malzeme', title: 'Ekipman malzeme reçeteleri', columns: [{ h: 'Ekipman', w: 10 }, { h: 'İş', w: 10 }, { h: 'Servis', w: 18 }, { h: 'Malzeme', w: 54 }, { h: 'Miktar', w: 10, fmt: '0.000' }, { h: 'Birim', w: 7 }, { h: 'Köken', w: 22 }, { h: 'Gerekçe', w: 36 }], rows: mrows });
  }
  // Saha objeleri: spesifikasyon veritabanı alanlarıyla (coordinate_x = sağa / Easting, coordinate_y = yukarı / Northing)
  sheets.push({ name: 'Saha Objeleri', title: 'Saha objeleri · ' + model.crs.label + ' · X = sağa (Easting), Y = yukarı (Northing)', columns: ['id', 'project_id', 'object_type', 'object_number', 'coordinate_x', 'coordinate_y', 'coordinate_z', 'coordinate_system', 'timestamp', 'source', 'device_id', 'accuracy', 'fix_type', 'satellite_count', 'hdop', 'vdop', 'pdop', 'operator_id', 'notes', 'hakedis_status', 'progress', 'photos'].map((h) => ({ h, w: /coordinate_[xy]/.test(h) ? 14 : /notes|coordinate_system|timestamp/.test(h) ? 24 : 13, fmt: /coordinate_|accuracy/.test(h) && h !== 'coordinate_system' ? '0.000' : null })), rows: objectRows(model) });
  sheets.push({ name: 'Fotoğraflar', title: 'Fotoğraflar · ' + (model.photos || []).length + ' adet', columns: ['photo_id', 'project_id', 'object_id', 'object_type', 'filename', 'filepath', 'timestamp', 'latitude', 'longitude', 'elevation', 'accuracy', 'device_id', 'operator_id'].map((h) => ({ h, w: /filepath/.test(h) ? 40 : /filename|timestamp/.test(h) ? 22 : 13 })), rows: (model.photos || []).map((ph) => { const f = photoFile(ph); return [ph.id, ph.projectId, ph.ownerId || '', ph.ownerType || '', f.filename, f.filepath, ph.timestamp || '', ph.lat ?? null, ph.lon ?? null, ph.elevation ?? null, ph.accuracy ?? null, ph.device || '', ph.operator || ph.user || '']; }) });
  sheets.push({ name: 'Noktalar', title: 'GNSS / ölçü noktaları · ' + model.crs.label, columns: [{ h: 'No', w: 10 }, { h: 'Sınıf', w: 10 }, { h: 'Kaynak', w: 20 }, { h: 'FIX', w: 8 }, { h: 'σH', w: 8, fmt: '0.000' }, { h: 'σV', w: 8, fmt: '0.000' }, { h: 'Y (Sağa)', w: 14, fmt: '0.000' }, { h: 'X (Yukarı)', w: 14, fmt: '0.000' }, { h: 'Z', w: 10, fmt: '0.000' }, { h: 'Enlem', w: 14 }, { h: 'Boylam', w: 14 }], rows: model.points.map((p) => [p.no, p.cls, p.source, p.fix || '', p.sigmaH, p.sigmaV, p.E, p.N, p.H, p.lat != null ? +p.lat.toFixed(9) : null, p.lon != null ? +p.lon.toFixed(9) : null]) });
  sheets.push({ name: 'Açıklıklar', title: 'Açıklıklar', columns: [{ h: 'Hat', w: 8 }, { h: 'Başlangıç', w: 10 }, { h: 'Bitiş', w: 10 }, { h: '2B (m)', w: 10, fmt: '0.000' }, { h: '3B (m)', w: 10, fmt: '0.000' }, { h: 'ΔH (m)', w: 10, fmt: '0.000' }, { h: 'Semt (°)', w: 10, fmt: '0.000' }, { h: 'Kaynak', w: 8 }], rows: model.spans.map((s) => [s.lineNo, s.fromNo, s.toNo, s.length2D, s.length3D, s.dH, s.bearing, s.source]) });
  sheets.push({ name: 'Kontrol', title: 'Otomatik uygunluk kontrolü', columns: [{ h: 'Kod', w: 22 }, { h: 'Önem', w: 8 }, { h: 'Kayıt', w: 14 }, { h: 'Açıklama', w: 90 }], rows: model.issues.map((i) => [i.code, i.severity === 'error' ? 'HATA' : 'UYARI', i.entityNo, i.message]) });
  return sheets;
}

// ---------------- CBS (Google Earth, MapInfo): AutoCAD eklentisiyle aynı dosyalar ----------------
/** Eklentinin proje modeli: telefonun .sebeke.json'u eklentinin okuduğu biçimde (CBS çıktıları bundan üretilir). */
const eklentiModeli = (ps) => SH.projeOku(sebekeYaz(ps));
/** Koordinat sisteminin adı: eklentideki gibi "ITRF96 / TM 39 (3°)"; başka sistemde kendi adı. */
const sistemAdi = (crs) => (crs.projection === 'TM3' && crs.datum === 'TUREF' && !crs.local ? 'ITRF96 / TM ' + crs.cm + ' (3°)' : crs.label);
const tarihYazisi = (d = new Date()) => { const z = (n) => String(n).padStart(2, '0'); return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };
/** Google Earth (KML) metni: eklentinin yazdığıyla aynı içerik + telefonun 3B direk / iletken klasörü (başta kapalı). */
export function googleEarthMetni(ps, model, opts = {}) {
  const crs = ps.p.crs;
  return kmlMetni(eklentiModeli(ps), { donustur: (E, N) => { const g = unproject(E, N, crs); return [g.lon, g.lat]; }, surum: opts.surum || 'telefon', sistem: sistemAdi(crs), tarih: tarihYazisi(), ek: model ? kml3BKlasoru(model) : '' });
}
/**
 * MapInfo MIF / MID dosyaları (Türkçe Windows kod sayfasında baytlar): her dolu katman base_KATMAN.mif + .mid. hedefCrs
 * verilirse (Dışa Aktarım'daki koordinat seçimi) köşeler o sisteme çevrilir ve CoordSys satırı ona göre yazılır.
 */
export function mifCiktilari(ps, base, hedefCrs) {
  const kaynak = ps.p.crs, hedef = hedefCrs || kaynak;
  const koordinat = JSON.stringify(hedef) === JSON.stringify(kaynak) ? null : (k) => { const g = unproject(k[0], k[1], kaynak); const q = projLL(g.lat, g.lon, hedef); return [q.E, q.N]; };
  return mifDosyalari(eklentiModeli(ps), base, { coordSys: mifCoordSys(hedef), koordinat, hane: hedef.projection === 'GEO' ? 8 : 3 }).map((d) => ({ name: d.name, data: cp1254(d.text) }));
}

export async function exportFormat(ps, fmt, opts = {}) {
  const model = buildExportModel(ps, { crs: opts.crs });
  const base = (ps.p.code || ps.p.name || 'proje').replace(/[^\p{L}\p{N}_-]+/gu, '_');
  switch (fmt) {
    case 'dxf': { const d = buildDXF(model, opts); return [{ name: base + '.dxf', mime: 'application/dxf', data: dxfBytes(d.text), stats: d.stats }]; }
    case 'sebeke': return [{ name: base + '.sebeke.json', mime: 'application/json', data: enc(sebekeYaz(ps)) }];
    case 'voltjson': return [{ name: base + '.volt.json', mime: 'application/json', data: enc(JSON.stringify(voltProjeYaz(ps), null, 1)) }];
    case 'ncn': return [{ name: base + '.ncn', mime: 'text/plain', data: enc(buildNCN(model)) }];
    case 'kml': return [{ name: base + '.kml', mime: 'application/vnd.google-earth.kml+xml', data: enc(googleEarthMetni(ps, model, opts)) }];
    case 'kmz': return [{ name: base + '.kmz', mime: 'application/vnd.google-earth.kmz', data: await zip([{ name: 'doc.kml', data: enc(googleEarthMetni(ps, model, opts)) }]) }];
    case 'mif': { const files = mifCiktilari(ps, base, opts.crs); return [{ name: base + '_cbs_mif.zip', mime: 'application/zip', data: await zip(files), files: files.map((f) => f.name) }]; }
    case 'geojson': return [{ name: base + '_wgs84.geojson', mime: 'application/geo+json', data: enc(buildGeoJSON(model)) }, { name: base + '_' + (model.crs.epsg || 'proje') + '.geojson', mime: 'application/geo+json', data: enc(buildGeoJSON(model, { projected: true })) }];
    case 'shp': {
      const files = [];
      for (const L of shapefileLayers(model)) { const s = writeShapefile(L.kind, L.feats, L.fields, model.crs); for (const ext of ['shp', 'shx', 'dbf', 'prj', 'cpg']) files.push({ name: L.name + '.' + ext, data: s[ext] }); }
      return [{ name: base + '_shp.zip', mime: 'application/zip', data: await zip(files), files: files.map((f) => f.name) }];
    }
    case 'csv': return [{ name: base + '_noktalar.csv', mime: 'text/csv', data: enc(buildPointsCSV(model)) }];
    case 'xlsx': return [{ name: base + '_metraj_hakedis.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: await buildXLSX(workbookSheets(model, ps), { title: ps.p.name }) }];
    case 'report': { const t = ps.data.periods.length ? ps.periodTable() : null; return [{ name: base + '_rapor.html', mime: 'text/html', data: enc(buildReportHTML(model, { period: t, hesaplar: kayitSatirlari(ps, kullaniciAdi(ps)) })) }]; }
    case 'package': return [await deliveryPackage(ps, model, base, opts)];
    default: throw new Error('Bilinmeyen format: ' + fmt);
  }
}

// Teslim paketi = proje klasörü (spesifikasyon 10): PROJECT_INFO · HARITA · SAHA_ALIMI · HAKEDIS · GNSS · <TÜR>/<ObjeNo>/ fotoğraflar · FOTOGRAFLAR · EXCEL_IMPORT · RAPORLAR · EXPORT
async function deliveryPackage(ps, model, base, opts) {
  const files = [];
  const add = (name, data) => files.push({ name, data: typeof data === 'string' ? enc(data) : data });
  const csv = (rows) => '﻿' + rows.map((r) => r.map((x) => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  // PROJECT_INFO: proje JSON (tam veri + standart kimliği) + denetim kaydı
  const full = voltProjeYaz(ps);   // volt-project/3: ham veri + türetilmiş sonuçlar + AutoCAD bölümü (sebeke)
  add('PROJECT_INFO/project.json', JSON.stringify(full, null, 1));
  add('EXPORT/' + base + '.sebeke.json', JSON.stringify(full.sebeke, null, 1));
  add('PROJECT_INFO/denetim_kaydi.json', JSON.stringify(await ps.ds.auditLog(ps.p.id, 100000), null, 1));
  // SAHA_ALIMI: obje listesi (kaynak, doğruluk, cihaz, hakediş, fotoğraf sayısı)
  const objHead = ['id', 'project_id', 'object_type', 'object_number', 'coordinate_x', 'coordinate_y', 'coordinate_z', 'coordinate_system', 'timestamp', 'source', 'device_id', 'accuracy', 'fix_type', 'satellite_count', 'hdop', 'vdop', 'pdop', 'operator_id', 'notes', 'hakedis_status', 'progress', 'photos'];
  add('SAHA_ALIMI/saha_objeleri.csv', csv([objHead, ...objectRows(model)]));
  // HAKEDIS: obje bazlı durum + metraj/hakediş Excel
  const hk = [['Obje No', 'Tür', 'Hakediş durumu', 'İş tarihi', 'Fotoğraf']];
  for (const e of model.equipment) if (e.hak) hk.push([e.no, e.kindLabel, HAK_STATUSES[e.hak].label, e.workDate || '', e.photos || 0]);
  for (const l of model.lines) if (l.hak) hk.push([l.no, 'Hat', HAK_STATUSES[l.hak].label, l.workDate || '', l.photos || 0]);
  add('HAKEDIS/hakedis_durumu.csv', csv(hk));
  add('HAKEDIS/' + base + '_metraj_hakedis.xlsx', await buildXLSX(workbookSheets(model, ps), { title: ps.p.name }));
  // GNSS: ham akış + gözlemler + nokta listesi
  const raws = (await ps.ds.db.query('rawLogs', 'projectId', ps.p.id)).sort((a, b) => (a.t0 || 0) - (b.t0 || 0));
  add('GNSS/ham_nmea.nmea', raws.map((r) => r.text).join(''));
  add('GNSS/gozlemler.json', JSON.stringify(ps.data.gnssObservations, null, 1));
  add('GNSS/noktalar.csv', buildPointsCSV(model));
  add('GNSS/RINEX_OKUBENI.txt', 'RINEX gözlem dosyası ham faz/kod gözlemleri gerektirir; NMEA akışından RINEX üretilemez.\r\nAlıcının dahili kaydını (ör. .DAT/.GNS/.SBF/.UBX) alıcı yazılımıyla RINEX 3.x\'e dönüştürüp bu klasöre ekleyin.\r\nBu pakette: ham NMEA akışı (ham_nmea.nmea), epok ortalamalı gözlemler (gozlemler.json) ve nokta listesi.\r\n');
  // Fotoğraflar: DIREKLER/D-001/D-001_01.jpg … + FOTOGRAFLAR/metadata.csv
  const meta = [['Dosya', 'Klasör yolu', 'Obje', 'Tür', 'Zaman', 'Operatör', 'Enlem', 'Boylam', 'Yükseklik', 'Y (sağa)', 'X (yukarı)', 'Doğruluk (m)', 'Fix', 'Cihaz', 'Yön (°)', 'Açıklama']];
  const usedPaths = new Set();
  for (const ph of model.photos || []) {
    const bytes = await ps.photoBytes(ph);
    if (!bytes) continue;
    const f = photoFile(ph);
    let path = f.filepath; let k = 1;
    while (usedPaths.has(path)) path = f.filepath.replace(/\.jpg$/i, '_' + ++k + '.jpg');
    usedPaths.add(path);
    add(path, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    meta.push([f.filename, path, ph.ownerNo || '', ph.ownerType || '', ph.timestamp, ph.operator || ph.user || '', ph.lat ?? '', ph.lon ?? '', ph.elevation ?? '', ph.E ?? '', ph.N ?? '', ph.accuracy ?? '', ph.fix || ph.gnssFix || '', ph.device || '', ph.heading ?? '', ph.note || '']);
  }
  add('FOTOGRAFLAR/metadata.csv', csv(meta));
  // EXCEL_IMPORT: toplu aktarım geçmişi
  add('EXCEL_IMPORT/aktarim_gecmisi.json', JSON.stringify((ps.data.documents || []).filter((d) => d.kind === 'EXCEL_IMPORT'), null, 1));
  // HARITA: GIS çıktıları
  add('HARITA/' + base + '_wgs84.geojson', buildGeoJSON(model));
  add('HARITA/' + base + '_proje.geojson', buildGeoJSON(model, { projected: true }));
  add('HARITA/' + base + '.kmz', await zip([{ name: 'doc.kml', data: enc(googleEarthMetni(ps, model, opts)) }]));
  for (const f of mifCiktilari(ps, base, opts.crs)) add('HARITA/mif/' + f.name, f.data);
  // EXPORT: CAD + SHP
  add('EXPORT/' + base + '.dxf', dxfBytes(buildDXF(model).text));
  add('EXPORT/' + base + '.ncn', buildNCN(model));
  for (const L of shapefileLayers(model)) { const s = writeShapefile(L.kind, L.feats, L.fields, model.crs); for (const ext of ['shp', 'shx', 'dbf', 'prj', 'cpg']) add('EXPORT/shp/' + L.name + '.' + ext, s[ext]); }
  // RAPORLAR
  const t = ps.data.periods.length ? ps.periodTable() : null;
  add('RAPORLAR/' + base + '_rapor.html', buildReportHTML(model, { period: t, hesaplar: kayitSatirlari(ps, kullaniciAdi(ps)) }));
  // Manifest (SHA-256)
  const lines = ['Şebeke-M · proje teslim paketi', 'Proje: ' + ps.p.name + ' (' + (ps.p.code || '-') + ')', 'Standart: ' + ps.cat.std.name, 'CRS: ' + model.crs.label + (model.crs.epsg ? ' · EPSG:' + model.crs.epsg : ''), 'Üretim: ' + new Date().toISOString(), 'Veri imzası: ' + ps.result.signature, 'Kontrol: ' + ps.result.issues.filter((i) => i.severity === 'error').length + ' hata, ' + ps.result.issues.filter((i) => i.severity === 'warn').length + ' uyarı', '', 'SHA-256  boyut  dosya'];
  for (const f of files) lines.push(((await sha256Hex(f.data)) || '-') + '  ' + f.data.length + '  ' + f.name);
  add('PROJECT_INFO/MANIFEST.txt', lines.join('\r\n') + '\r\n');
  const root = 'PROJECT_' + projectFolder(ps.p) + '/';
  for (const f of files) f.name = root + f.name;
  return { name: base + '_teslim_paketi.zip', mime: 'application/zip', data: await zip(files), files: files.map((f) => f.name) };
}
