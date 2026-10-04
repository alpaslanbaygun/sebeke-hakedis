// GeoJSON (RFC 7946 WGS84 veya proje CRS), KML/KMZ (gerçek koordinat + 3B direk/iletken), Netcad NCN.
import { zip } from './zip.js';

const r9 = (v) => Math.round(v * 1e9) / 1e9, r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

export function buildGeoJSON(model, opts = {}) {
  const projected = opts.projected;
  const pt = (o) => (projected ? [r3(o.E), r3(o.N), r3(o.H || 0)] : [r9(o.lon), r9(o.lat), r3(o.H || 0)]);
  const features = [];
  for (const e of model.equipment) if (e.E != null) features.push({ type: 'Feature', id: e.id, geometry: { type: 'Point', coordinates: pt(e) }, properties: { katman: 'ekipman', no: e.no, tur: e.kind, turAd: e.kindLabel, durum: e.state, is: e.job, grup: e.groupLabel, tip: e.typeName, servis: e.servis, rol: e.role, aci: e.angle, boy: e.heightM, kva: e.attrs.kva || null, post: e.attrs.post || null, Y: r3(e.E), X: r3(e.N), Z: r3(e.H), kaynak: e.source } });
  for (const l of model.lines) if (l.coords.length >= 2) features.push({ type: 'Feature', id: l.id, geometry: { type: 'LineString', coordinates: l.coords.map(pt) }, properties: { katman: 'hat', no: l.no, ad: l.name, hatTipi: l.lineType, tesis: l.install, durum: l.state, is: l.job, iletken: l.label, uzunluk2D: r3(l.length2D), uzunluk3D: r3(l.length3D) } });
  for (const p of model.points) if (p.E != null && !model.equipment.some((e) => e.pointId === p.id)) features.push({ type: 'Feature', id: p.id, geometry: { type: 'Point', coordinates: pt(p) }, properties: { katman: 'olcu', no: p.no, sinif: p.cls, kaynak: p.source, fix: p.fix, sigmaH: p.sigmaH, sigmaV: p.sigmaV } });
  for (const c of model.crossings) if (c.E != null && c.lat != null) features.push({ type: 'Feature', id: c.id, geometry: { type: 'Point', coordinates: pt(c) }, properties: { katman: 'gecis', tur: c.crossKind, ad: c.label, yukseklik: c.objectHeight } });
  const fc = { type: 'FeatureCollection', name: model.project.name, features };
  if (projected && model.crs.epsg) fc.crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::' + model.crs.epsg } };
  fc.metadata = { proje: model.project.name, crs: projected ? model.crs.label : 'WGS84 (EPSG:4326) · RFC 7946', yukseklik: model.project.heightSystem, uretim: new Date().toISOString(), not: projected ? '' : 'Proje CRS (' + model.crs.label + ') kaynaklı; ITRF96/TUREF ≈ WGS84 (metre altı fark).' };
  return JSON.stringify(fc, null, 1);
}

const kmlColor = (hex, a = 'ff') => { const h = hex.replace('#', ''); return a + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function buildKML(model) {
  const LC = { AG: '#1f7f00', OG: '#ff0000', AYD: '#00ffff', ENH: '#ff00ff', ABONE: '#fbbf24' };
  const styles = Object.entries(LC).map(([k, c]) => '<Style id="hat' + k + '"><LineStyle><color>' + kmlColor(c) + '</color><width>' + (k === 'OG' || k === 'ENH' ? 4 : 2) + '</width></LineStyle></Style>').join('') +
    '<Style id="direk"><IconStyle><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LineStyle><color>ff9ca3af</color><width>3</width></LineStyle></Style>' +
    '<Style id="trafo"><IconStyle><color>ffff6b4d</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon></IconStyle></Style>' +
    '<Style id="nokta"><IconStyle><scale>0.6</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/cross-hairs.png</href></Icon></IconStyle></Style>';
  const eqById = new Map(model.equipment.map((e) => [e.pointId, e]));
  const att = (e) => (e && e.heightM ? e.heightM - (e.heightM / 10 + 0.6) - 0.6 : 0);
  let body = '<Folder><name>Ekipman</name>';
  for (const e of model.equipment) {
    if (e.lat == null) continue;
    const top = e.heightM ? e.heightM - (e.heightM / 10 + 0.6) : 0;
    const desc = '<![CDATA[' + [e.kindLabel, e.typeName, e.stateLabel, e.role ? 'Rol ' + e.role : '', e.angle ? 'α=' + e.angle.toFixed(2) + '°' : '', 'Y=' + (e.E ?? 0).toFixed(3) + ' X=' + (e.N ?? 0).toFixed(3) + ' Z=' + (e.H ?? 0).toFixed(3)].filter(Boolean).join('<br>') + ']]>';
    body += '<Placemark><name>' + esc(e.no) + '</name><description>' + desc + '</description><styleUrl>#' + (e.kind === 'transformer' ? 'trafo' : 'direk') + '</styleUrl>';
    if (top > 0 && e.H != null) body += '<MultiGeometry><Point><altitudeMode>absolute</altitudeMode><coordinates>' + r9(e.lon) + ',' + r9(e.lat) + ',' + (e.H + top).toFixed(3) + '</coordinates></Point><LineString><altitudeMode>absolute</altitudeMode><coordinates>' + r9(e.lon) + ',' + r9(e.lat) + ',' + e.H.toFixed(3) + ' ' + r9(e.lon) + ',' + r9(e.lat) + ',' + (e.H + top).toFixed(3) + '</coordinates></LineString></MultiGeometry>';
    else body += '<Point><coordinates>' + r9(e.lon) + ',' + r9(e.lat) + ',0</coordinates></Point>';
    body += '</Placemark>';
  }
  body += '</Folder><Folder><name>Hatlar</name>';
  for (const l of model.lines) {
    if (l.coords.length < 2) continue;
    const abs = l.install === 'havai' && l.coords.every((c) => c.H != null && eqById.get(c.id));
    const coords = l.coords.map((c) => { const e = eqById.get(c.id); return r9(c.lon) + ',' + r9(c.lat) + ',' + (abs ? ((c.H || 0) + att(e)).toFixed(3) : '0'); }).join(' ');
    body += '<Placemark><name>' + esc(l.no + ' ' + l.label) + '</name><description>' + esc(l.lineType + ' · ' + l.install + ' · ' + l.state + ' · ' + l.length3D.toFixed(2) + ' m') + '</description><styleUrl>#hat' + l.lineType + '</styleUrl><LineString><tessellate>1</tessellate><altitudeMode>' + (abs ? 'absolute' : 'clampToGround') + '</altitudeMode><coordinates>' + coords + '</coordinates></LineString></Placemark>';
  }
  body += '</Folder><Folder><name>Ölçü noktaları</name>';
  for (const p of model.points) if (p.lat != null && !eqById.get(p.id)) body += '<Placemark><name>' + esc(p.no) + '</name><styleUrl>#nokta</styleUrl><description>' + esc((p.source || '') + ' ' + (p.fix || '')) + '</description><Point><coordinates>' + r9(p.lon) + ',' + r9(p.lat) + ',0</coordinates></Point></Placemark>';
  body += '</Folder>';
  return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + esc(model.project.name) + '</name><description>' + esc(model.crs.label + ' kaynaklı · WGS84') + '</description>' + styles + body + '</Document></kml>';
}
export async function buildKMZ(model) { return zip([{ name: 'doc.kml', data: buildKML(model) }]); }

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
  const h = ['No', 'Sınıf', 'Kaynak', 'FIX', 'σH', 'σV', 'Y (Sağa)', 'X (Yukarı)', 'Z', 'Enlem', 'Boylam', 'Değişiklik'];
  const rows = model.points.map((p) => [p.no, p.cls, p.source, p.fix || '', p.sigmaH ?? '', p.sigmaV ?? '', p.E?.toFixed(3), p.N?.toFixed(3), p.H?.toFixed(3) ?? '', p.lat?.toFixed(9), p.lon?.toFixed(9), p.updatedAt]);
  return '﻿' + [h, ...rows].map((r) => r.map((x) => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
}
