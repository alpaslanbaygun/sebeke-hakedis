// Survey Service — saha objesi oluşturma (veri kaynağından bağımsız tek giriş noktası) ve koordinat girişi çözümleme.
// Harita alımı (GNSS / manuel / haritadan) ve Excel toplu aktarımı aynı createObject() fonksiyonunu kullanır;
// yeni obje türü eklemek için OBJECT_TYPES tablosuna satır eklemek yeterlidir.
import { makeCrs, project as projLL, unproject, TM_ZONES } from '../geo/crs.js';
import { STATUSES, HAK_STATUSES, HAK_ORDER } from '../core/schema.js';

// Spesifikasyon obje türleri → dahili ekipman türü / nokta sınıfı
export const OBJECT_TYPES = {
  direk: { label: 'Direk', eq: 'pole', critical: true, words: ['direk', 'pole'] },
  aydinlatma: { label: 'Aydınlatma direği', eq: 'lighting', critical: true, words: ['aydinlatma diregi', 'aydinlatma'] },
  trafo: { label: 'Trafo', eq: 'transformer', critical: true, words: ['trafo', 'transformator'] },
  sdk: { label: 'SDK / Box', eq: 'sdk', critical: true, words: ['sdk', 'box', 'saha dagitim'] },
  pano: { label: 'Pano', eq: 'panel', critical: true, words: ['pano'] },
  menhol: { label: 'Menhol', eq: 'manhole', critical: true, words: ['menhol', 'manhole', 'rogar'] },
  armatur: { label: 'Armatür / sokak lambası', eq: 'luminaire', critical: false, words: ['armatur', 'sokak lambasi', 'lamba'] },
  abone: { label: 'Abone', eq: 'subscriber', critical: false, words: ['abone'] },
  kose: { label: 'Hat köşe noktası', cls: 'HAT', critical: true, words: ['kose', 'hat kose', 'guzergah'] },
  detay: { label: 'Detay noktası', cls: 'DETAY', critical: false, words: ['detay', 'nokta'] },
  diger: { label: 'Diğer', eq: 'other', critical: false, words: ['diger', 'other'] },
  kanal: { label: 'Kanal / Kazı', line: true, words: ['kanal', 'kazi'] },
  kablo: { label: 'Kablo', line: true, words: ['kablo'] }
};

// Türkçe karakterleri sadeleştirip küçük harfe çevirir (başlık / değer eşleştirme)
export const norm = (s) => String(s ?? '').trim().toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/i̇/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ').trim();
export function objectTypeOf(text) {
  const t = norm(text);
  if (!t) return null;
  for (const [k, v] of Object.entries(OBJECT_TYPES)) if (v.words.some((w) => t === w)) return k;
  for (const [k, v] of Object.entries(OBJECT_TYPES)) if (v.words.some((w) => t.includes(w))) return k;
  return null;
}
export const num = (v) => { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) ? v : NaN; const s = String(v).trim().replace(/\s/g, ''); if (!s) return null; const t = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''); const n = Number(t); return Number.isFinite(n) ? n : NaN; };

// Manuel giriş / Excel için koordinat sistemi seçenekleri (proje CRS varsayılan)
export function crsChoices(project) {
  const p = project.crs;
  const out = [{ key: 'proje', label: 'Proje · ' + p.label, crs: p }];
  out.push({ key: 'geo', label: 'WGS84 enlem / boylam (derece)', crs: makeCrs({ datum: 'WGS84', projection: 'GEO' }), geo: true });
  for (const cm of TM_ZONES) if (!(p.datum === 'TUREF' && p.projection === 'TM3' && p.cm === cm)) out.push({ key: 'turef' + cm, label: 'ITRF96/TUREF · TM' + cm + ' (3°)', crs: makeCrs({ datum: 'TUREF', projection: 'TM3', cm }) });
  out.push({ key: 'ed50', label: 'ED50 · TM' + (p.cm || 39) + ' (3°)', crs: makeCrs({ datum: 'ED50', projection: 'TM3', cm: p.cm || 39 }) });
  out.push({ key: 'utm', label: 'WGS84 · UTM ' + (Math.floor(((p.cm || 39) + 180) / 6) + 1) + 'N', crs: makeCrs({ datum: 'WGS84', projection: 'UTM', cm: p.cm || 39 }) });
  return out;
}

// X (sağa / Easting), Y (yukarı / Northing), Z → proje koordinatı. Eksen karışıklığını (X↔Y) büyüklükten anlar ve düzeltir.
export function resolveCoord(project, { x, y, z, crsKey = 'proje', zUnknown = false }) {
  const ch = crsChoices(project).find((c) => c.key === crsKey) || crsChoices(project)[0];
  let X = num(x), Y = num(y);
  const Z = zUnknown ? null : num(z);
  const warn = [];
  if (X === null || Y === null) return { ok: false, error: 'Koordinat boş' };
  if (Number.isNaN(X) || Number.isNaN(Y)) return { ok: false, error: 'Koordinat sayı değil' };
  if (Number.isNaN(Z)) return { ok: false, error: 'Z sayı değil' };
  let lat, lon, E, N, swapped = false;
  if (ch.geo) {
    // X = boylam, Y = enlem. Türkiye için enlem 35–43, boylam 25–46
    if (Math.abs(X) > 180 || Math.abs(Y) > 180) return { ok: false, error: 'Koordinat sistemi uyumsuz: değerler derece değil (enlem/boylam seçili)' };
    if (Y > 43.5 && X <= 43.5) { const t = X; X = Y; Y = t; swapped = true; }
    lon = X; lat = Y;
    const q = projLL(lat, lon, project.crs); E = q.E; N = q.N;
  } else {
    if (Math.abs(X) <= 180 && Math.abs(Y) <= 180) return { ok: false, error: 'Koordinat sistemi uyumsuz: değerler derece gibi görünüyor (metre bekleniyor)' };
    // TM/UTM: sağa 6 haneli (100 000–900 000), yukarı 7 haneli (milyonlar)
    if (X >= 1e6 && Y < 1e6) { const t = X; X = Y; Y = t; swapped = true; }
    if (crsKey === 'proje') { E = X; N = Y; const g = unproject(E, N, project.crs); lat = g.lat; lon = g.lon; }
    else { const g = unproject(X, Y, ch.crs); lat = g.lat; lon = g.lon; const q = projLL(lat, lon, project.crs); E = q.E; N = q.N; }
  }
  if (swapped) warn.push('X ve Y yer değiştirmiş görünüyor · otomatik düzeltildi');
  if (!(lat > 34 && lat < 44 && lon > 24 && lon < 46.5)) return { ok: false, error: 'Koordinat sistemi uyumsuz: nokta Türkiye sınırları dışında (' + (Number.isFinite(lat) ? lat.toFixed(3) + '°, ' + lon.toFixed(3) + '°' : 'hesaplanamadı') + ')' };
  if (project.crs.projection === 'TM3' && Math.abs(lon - project.crs.cm) > 2.5) warn.push('Nokta proje dilim orta meridyeninden (' + project.crs.cm + '°) ' + Math.abs(lon - project.crs.cm).toFixed(1) + '° uzakta');
  return { ok: true, E, N, H: Z, lat, lon, swapped, warn, enteredCrs: ch.crs.label, crsLabel: project.crs.label, zUnknown: Z === null };
}

// Metinden durum / hakediş durumu
export function stateOf(text) {
  const t = norm(text);
  if (!t) return null;
  if (t.includes('mevcut')) return 'MEVCUT';
  if (t.includes('dmm') || t.includes('bysk')) return 'DMM';
  if (t.includes('demont')) return 'DEMONTAJ';
  if (t.includes('ileri')) return 'ILERIDE';
  if (t.includes('yeni') || t.includes('montaj')) return 'YENI';
  return undefined; // tanınmadı
}
export function hakStatusOf(text) {
  const t = norm(text);
  if (!t) return null;
  for (const k of HAK_ORDER) if (norm(HAK_STATUSES[k].label) === t || norm(HAK_STATUSES[k].short) === t) return k;
  if (t.includes('onay')) return 'ONAYLI';
  if (t.includes('hakedis')) return 'HAKEDISTE';
  if (t.includes('kontrol')) return 'KONTROL';
  if (t.includes('tamam') || t.includes('bitti') || t.includes('yapildi')) return 'TAMAMLANDI';
  if (t.includes('basla') || t.includes('devam')) return 'BASLANDI';
  if (t.includes('yapilacak') || t.includes('bekl')) return 'YAPILACAK';
  return undefined;
}
const TRAFO_STATE = { YENI: 'yeni', MEVCUT: 'mevcut', DEMONTAJ: 'demontaj', DMM: 'tasinan', ILERIDE: 'ileride' };

// Katalog eşleştirmeleri (bulunamazsa null → kayıt açılır, kontrol listesinde eksik olarak görünür)
export function matchPoleType(cat, typeText, groupText) {
  const t = norm(typeText), g = norm(groupText);
  const groups = cat.t.poleGroups || [];
  let grp = groups.find((x) => x.id === String(groupText || '').trim()) || (g ? groups.find((x) => norm(x.label) === g || norm(x.short) === g) : null);
  const all = cat.t.poleTypes || [];
  const cand = grp ? all.filter((x) => x.group === grp.id) : all;
  let ty = t ? cand.find((x) => norm(x.name) === t) || cand.find((x) => norm(x.name).startsWith(t)) || all.find((x) => norm(x.name) === t) || all.find((x) => norm(x.name).startsWith(t)) : null;
  if (ty && !grp) grp = groups.find((x) => x.id === ty.group) || null;
  if (!grp && g) {
    // Genel sınıf: AG / OG / Müşterek / Aydınlatma
    const pick = g.includes('ayd') ? 'ayd' : g.includes('mus') ? 'mus' : g === 'og' || g.includes('bahh') ? 'bahh' : g === 'ag' || g.includes('sehir') ? 'sehir' : g.includes('beton') ? 'beton' : g.includes('agac') ? 'agac' : null;
    grp = pick ? groups.find((x) => x.id === pick) || null : null;
  }
  return { group: grp ? grp.id : null, typeId: ty ? ty.id : null, typeName: ty ? ty.name : null };
}
export function matchPost(cat, text) {
  const t = norm(text);
  const posts = cat.postTypes();
  if (!t) return posts.find((p) => p.id === 'direk') || posts[0];
  return posts.find((p) => p.id === t) || posts.find((p) => norm(p.label) === t) || posts.find((p) => norm(p.label).includes(t) || t.includes(norm(p.label))) || (t.includes('kosk') ? posts.find((p) => p.id === 'mbk') : t.includes('bina') ? posts.find((p) => p.id === 'bina') : null) || null;
}
export function matchSdk(cat, text) {
  const t = norm(text);
  const list = cat.sdkTypes();
  if (!t) return list[0] || null;
  return list.find((s) => norm(s.name) === t) || list.find((s) => norm(s.name).includes(t)) || null;
}
// Armatür / pano için poz araması (ad içinde geçen metin)
export function matchPoz(cat, text, hint) {
  const t = norm(text);
  if (!t) return null;
  const pool = (cat.t.poz || []).filter((p) => !p.isKgGroup && (!hint || norm(p.name).includes(hint)));
  return pool.find((p) => p.servis === String(text).trim()) || pool.find((p) => norm(p.name) === t) || pool.find((p) => norm(p.name).includes(t)) || null;
}
export const luminairePoz = (cat) => (cat.t.poz || []).filter((p) => !p.isKgGroup && /armat|projekt/i.test(p.name));

// Tek obje oluştur. o: { type, no, coord{E,N,H,lat,lon,...} | obs, source, typeText, groupText, power, outputs, stateText|state, hak, note, attrs }
// defer: toplu işlemde yeniden hesap sona bırakılır.
export async function createObject(ps, o, opts = {}) {
  const T = OBJECT_TYPES[o.type];
  if (!T) throw new Error('Bilinmeyen obje türü: ' + o.type);
  const cat = ps.cat;
  const state = o.state || 'YENI';
  const pos = o.obs ? { obs: o.obs } : { coord: o.coord, source: o.source || 'MANUAL' };
  if (!T.eq) {
    const p = await ps.createPoint(Object.assign({ pointNo: o.no || ps.nextPointNo('P'), cls: T.cls, critical: T.critical, note: o.note || '' }, pos));
    if (!opts.defer) await ps.recompute(p.pointNo + ' eklendi');
    return { point: p, no: p.pointNo, pointId: p.id, eqId: null };
  }
  const data = { state, attrs: Object.assign({}, o.attrs || {}), note: o.note || '' };
  if (o.no) data.no = o.no;
  if (o.hak) data.hak = o.hak;
  let kind = T.eq;
  if (kind === 'pole' || kind === 'lighting') {
    const m = o.typeId ? { group: o.group, typeId: o.typeId } : matchPoleType(cat, o.typeText, o.groupText || (kind === 'lighting' ? 'ayd' : ''));
    data.group = m.group || (kind === 'lighting' ? 'ayd' : null); data.typeId = m.typeId || null;
    if (data.group === 'ayd') kind = 'lighting';
    if (!m.typeId && o.typeText) data.attrs.typeName = String(o.typeText);
  } else if (kind === 'transformer') {
    data.state = TRAFO_STATE[state] || state;
    const post = o.attrs && o.attrs.post ? { id: o.attrs.post } : matchPost(cat, o.typeText);
    data.attrs.post = post ? post.id : 'direk';
    if (o.power != null) data.attrs.kva = +o.power;
    if (!data.attrs.cins) data.attrs.cins = 'herm';
  } else if (kind === 'sdk') {
    const t = o.attrs && o.attrs.sdkTypeId ? { id: o.attrs.sdkTypeId } : matchSdk(cat, o.typeText);
    data.attrs.sdkTypeId = t ? t.id : null;
    data.attrs.outputs = +o.outputs || (t && t.outputs) || 4;
    if (!data.attrs.fuses) data.attrs.fuses = [];
  } else if (kind === 'luminaire' || kind === 'panel' || kind === 'other' || kind === 'manhole') {
    if (!data.attrs.servis && o.typeText) { const pz = matchPoz(cat, o.typeText, kind === 'luminaire' ? 'armat' : null); if (pz) data.attrs.servis = pz.servis; }
    if (o.typeText && !data.attrs.typeName) data.attrs.typeName = String(o.typeText);
    if (o.power != null && kind === 'panel') data.attrs.kva = +o.power;
  }
  const e = await ps.addEquipment(kind, data, Object.assign({ defer: !!opts.defer }, pos));
  return { equipment: e, no: e.no, pointId: e.pointId, eqId: e.id };
}
export { STATUSES };
