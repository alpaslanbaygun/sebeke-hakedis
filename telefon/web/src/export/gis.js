// GeoJSON (RFC 7946 WGS84 veya proje CRS), Google Earth'ün 3B ek klasörü (direk / iletken), Netcad NCN.
// Google Earth dosyasının asıl içeriği eklentiyle aynıdır: export/cbs.js.

const r9 = (v) => Math.round(v * 1e9) / 1e9, r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

export function buildGeoJSON(model, opts = {}) {
  const projected = opts.projected;
  const pt = (o) => (projected ? [r3(o.E), r3(o.N), r3(o.H || 0)] : [r9(o.lon), r9(o.lat), r3(o.H || 0)]);
  const features = [];
  for (const e of model.equipment) if (e.E != null) features.push({ type: 'Feature', id: e.id, geometry: { type: 'Point', coordinates: pt(e) }, properties: { katman: 'ekipman', no: e.no, tur: e.kind, turAd: e.kindLabel, durum: e.state, is: e.job, grup: e.groupLabel, tip: e.typeName, servis: e.servis, rol: e.role, aci: e.angle, boy: e.heightM, kva: e.attrs.kva || null, post: e.attrs.post || null, Y: r3(e.E), X: r3(e.N), Z: r3(e.H), kaynak: e.source, fix: e.fix, dogruluk: e.sigmaH, uydu: e.sats, pdop: e.pdop, cihaz: e.device, operator: e.operator, olcum: e.measuredAt, hakedis: e.hak, hakedisAd: e.hakLabel, fotograf: e.photos, not: e.note } });
  for (const l of model.lines) if (l.coords.length >= 2) features.push({ type: 'Feature', id: l.id, geometry: { type: 'LineString', coordinates: l.coords.map(pt) }, properties: { katman: 'hat', no: l.no, ad: l.name, hatTipi: l.lineType, tesis: l.install, durum: l.state, is: l.job, iletken: l.label, uzunluk2D: r3(l.length2D), uzunluk3D: r3(l.length3D), hakedis: l.hak, hakedisAd: l.hakLabel, fotograf: l.photos } });
  for (const p of model.points) if (p.E != null && !model.equipment.some((e) => e.pointId === p.id)) features.push({ type: 'Feature', id: p.id, geometry: { type: 'Point', coordinates: pt(p) }, properties: { katman: 'olcu', no: p.no, sinif: p.cls, kaynak: p.source, fix: p.fix, sigmaH: p.sigmaH, sigmaV: p.sigmaV } });
  const fc = { type: 'FeatureCollection', name: model.project.name, features };
  if (projected && model.crs.epsg) fc.crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::' + model.crs.epsg } };
  fc.metadata = { proje: model.project.name, crs: projected ? model.crs.label : 'WGS84 (EPSG:4326) · RFC 7946', yukseklik: model.project.heightSystem, uretim: new Date().toISOString(), not: projected ? '' : 'Proje CRS (' + model.crs.label + ') kaynaklı; ITRF96/TUREF ≈ WGS84 (metre altı fark).' };
  return JSON.stringify(fc, null, 1);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/**
 * Google Earth dosyasının telefona özgü ek klasörü (başta kapalı): direkler gerçek yükseklikleriyle dikey çizgi, havai
 * iletkenler direk tepelerinden (mutlak yükseklik). Asıl içerik eklentiyle aynıdır (export/cbs.js › kmlMetni); bu klasör
 * belgenin sonuna eklenir.
 */
export function kml3BKlasoru(model) {
  const styles = '<Style id="t3b_direk"><IconStyle><scale>0.6</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LineStyle><color>ff9ca3af</color><width>3</width></LineStyle></Style>' +
    '<Style id="t3b_hat"><LineStyle><color>ff8ae07e</color><width>2</width></LineStyle></Style>';
  const eqById = new Map(model.equipment.map((e) => [e.pointId, e]));
  const att = (e) => (e && e.heightM ? e.heightM - (e.heightM / 10 + 0.6) - 0.6 : 0);
  let body = '';
  // "İleride" durumundakiler asıl klasörlerde yoktur (eklentinin dosyasında da yok): burada da çizilmez
  const ileride = (s) => String(s || '').toUpperCase() === 'ILERIDE';
  for (const e of model.equipment) {
    if (e.lat == null || e.H == null || !e.heightM || ileride(e.state)) continue;
    const top = e.heightM - (e.heightM / 10 + 0.6);
    if (top <= 0) continue;
    body += '<Placemark><name>' + esc(e.no) + '</name><styleUrl>#t3b_direk</styleUrl><MultiGeometry><Point><altitudeMode>absolute</altitudeMode><coordinates>' + r9(e.lon) + ',' + r9(e.lat) + ',' + (e.H + top).toFixed(3) + '</coordinates></Point><LineString><altitudeMode>absolute</altitudeMode><coordinates>' + r9(e.lon) + ',' + r9(e.lat) + ',' + e.H.toFixed(3) + ' ' + r9(e.lon) + ',' + r9(e.lat) + ',' + (e.H + top).toFixed(3) + '</coordinates></LineString></MultiGeometry></Placemark>\n';
  }
  for (const l of model.lines) {
    if (l.coords.length < 2 || l.install !== 'havai' || ileride(l.state) || !l.coords.every((c) => c.H != null && eqById.get(c.id))) continue;
    const coords = l.coords.map((c) => r9(c.lon) + ',' + r9(c.lat) + ',' + ((c.H || 0) + att(eqById.get(c.id))).toFixed(3)).join(' ');
    body += '<Placemark><name>' + esc(l.no + ' ' + l.label) + '</name><styleUrl>#t3b_hat</styleUrl><LineString><altitudeMode>absolute</altitudeMode><coordinates>' + coords + '</coordinates></LineString></Placemark>\n';
  }
  if (!body) return '';
  return '<Folder><name>3B direk ve iletken (telefon)</name><visibility>0</visibility><description>Direkler gerçek yükseklikleriyle, havai iletkenler direk tepelerinden; açmak için işaretleyin.</description>\n' + styles + '\n' + body + '</Folder>\n';
}

// Netcad NCN (ASCII nokta dosyası): Nokta_Adı  Y(Sağa)  X(Yukarı)  Z  Kod
export function buildNCN(model) {
  const eqByPoint = new Map(model.equipment.map((e) => [e.pointId, e]));
  const rows = model.points.filter((p) => p.E != null).map((p) => {
    const e = eqByPoint.get(p.id);
    const code = e ? (e.kind === 'pole' ? 'DIREK' : e.kind === 'transformer' ? 'TRAFO' : e.kind.toUpperCase()) : (p.cls || 'NOKTA');
    return [p.no.replace(/\s+/g, '_'), p.E.toFixed(3), p.N.toFixed(3), (p.H ?? 0).toFixed(3), code].join(' ');
  });
  return rows.join('\r\n') + '\r\n';
}
// Genel CSV (Excel TR ayırıcı ;)
export function buildPointsCSV(model) {
  const h = ['No', 'Sınıf', 'Kaynak', 'FIX', 'σH', 'σV', 'Y (Sağa)', 'X (Yukarı)', 'Z', 'Enlem', 'Boylam', 'Uydu', 'PDOP', 'HDOP', 'VDOP', 'Cihaz', 'Seri no', 'Yöntem', 'Düzeltme', 'Operatör', 'Ölçüm zamanı', 'Koordinat sistemi', 'Değişiklik'];
  const rows = model.points.map((p) => [p.no, p.cls, p.source, p.fix || '', p.sigmaH ?? '', p.sigmaV ?? '', p.E?.toFixed(3), p.N?.toFixed(3), p.H?.toFixed(3) ?? '', p.lat?.toFixed(9), p.lon?.toFixed(9), p.sats ?? '', p.pdop ?? '', p.hdop ?? '', p.vdop ?? '', p.device || '', p.deviceSerial || '', p.method || '', p.correction || '', p.operator || '', p.measuredAt || '', p.crsLabel || '', p.updatedAt]);
  return '﻿' + [h, ...rows].map((r) => r.map((x) => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
}
