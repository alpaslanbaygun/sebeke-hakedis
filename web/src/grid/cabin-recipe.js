// Kabin (köşk / trafo binası) keşfi: gövde tipine göre ayrı kalem + her hücre ayrı kalem + trafo + AG pano + kablo kanalları.
// Poz eşlemesi standart paketindeki "cabin" tablosundan gelir (Tanımlar'dan değiştirilebilir).
import { yerlesim, hucreIslev } from './cabin.js';

// Gövde anahtarı: monoblok → dış boya göre TEDAŞ sınıfı (TİP-1A/1B/1C) · bina → MOD-5/5A/5B · prefabrik → eşleme yok (elle seçilir)
export function govdeAnahtar(cabin, Y) {
  Y = Y || yerlesim(cabin);
  if (cabin.sinif === 'bina') return cabin.kosk;
  if (cabin.sinif === 'mono' && Y.tipSinifi) return String(Y.tipSinifi).split(' ')[0];
  return null;
}
// Kabin tanımlı değilken gövde kalemi: yalnız monoblok köşkte varsayılan (TİP-1C); açıkça "yok" seçilebilir
export const GOVDE_VARSAYILAN = { mono: 'TİP-1C' };
export function govdeSecenekleri(cat) {
  const out = [];
  const map = (cat.table('cabin') || {}).govde || {};
  for (const [k, servis] of Object.entries(map)) { const pz = cat.poz(servis); out.push({ servis, ad: (pz ? pz.name : k) }); }
  for (const p of cat.t.poz) if (/^PB-\d/.test(p.name) && !out.some((x) => x.servis === p.servis)) out.push({ servis: p.servis, ad: p.name });
  return out;
}
// v2.4 · Posta tipine göre seçilebilir köşk gövdeleri: prefabrik beton köşk → PB-1…PB-4 · monoblok → TİP-1A/1B/1C (boş gövde)
export function koskGovdeleri(cat, post) {
  if (post === 'mbk' || post === 'rbk') return cat.t.poz.filter((p) => /^PB-\d/.test(p.name)).sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true })).map((p) => ({ servis: p.servis, ad: p.name, kisa: p.name.split(' ')[0] }));
  if (post === 'mono') {
    const map = (cat.table('cabin') || {}).govde || {};
    return ['TİP-1A', 'TİP-1B', 'TİP-1C'].filter((k) => map[k] && cat.poz(map[k])).map((k) => ({ servis: map[k], ad: k + ' · ' + cat.poz(map[k]).name, kisa: k }));
  }
  return [];
}
const line = (cat, servis, qty, why, tag, extra = {}) => {
  const pz = servis ? cat.poz(servis) : null;
  return Object.assign({ servis: servis || null, qty, unit: pz ? pz.unit : (extra.unit || 'Ad'), kgPer: pz ? pz.kgPerUnit : null, name: pz ? pz.name : (extra.name || '(katalogda yok)'), why, grp: '', tag, origin: 'OTO', qtyFrom: 'kabin', missing: !pz }, extra.keep || {});
};
export function hucrePoz(cat, code, yalitim = 'hd') {
  const map = cat.table('cabin') || {};
  if (yalitim === 'hd' && map.kod && map.kod[code]) return map.kod[code];
  return ((map.hucre || {})[yalitim] || {})[hucreIslev(code)] || null;
}

// Gövde kalemi (kabin tanımı olsun olmasın). a: ekipman attrs · type: posta tipi
export function govdeKalemi(a, type, cat) {
  const map = (cat.table('cabin') || {}).govde || {};
  let servis;
  if (a.govde !== undefined) servis = a.govde || null;                 // elle seçim ("" / null = gövde kalemi yok)
  else if (a.cabin) { const k = govdeAnahtar(a.cabin); servis = k ? map[k] || null : null; if (!k && a.cabin.sinif !== 'pref') return line(cat, null, 1, 'Köşk gövdesi · tip belirlenemedi (boy sınıf dışı)', 'kosk', { name: 'Köşk gövdesi (tip sınıfı dışı)' }); if (!k) return null; }
  else servis = GOVDE_VARSAYILAN[type] ? map[GOVDE_VARSAYILAN[type]] : undefined;
  if (!servis) return null;
  return line(cat, servis, 1, a.cabin ? 'Köşk / bina gövdesi · ' + a.cabin.kosk : 'Köşk gövdesi (tipine göre ayrı kalem)', 'kosk');
}

// Kabin tanımlı trafo / köşk kaydının tam kalem listesi
export function cabinItems(e, cat, ctx, params) {
  const a = e.attrs || {}, cabin = a.cabin;
  const Y = yerlesim(cabin);
  const yal = cabin.yalitim === 'gd' ? 'gd' : 'hd';
  const items = [];
  const g = govdeKalemi(a, ctx.type, cat);
  if (g) items.push(g);
  // Hücreler: aynı poza düşenler tek satırda toplanır
  const by = new Map();
  for (const h of Y.hucreler) {
    if (h.islev === 'YEDEK') continue;
    const servis = hucrePoz(cat, h.c, yal);
    const k = servis || 'YOK:' + h.c;
    const r = by.get(k) || { servis, qty: 0, codes: [], ad: h.ad };
    r.qty++; r.codes.push(h.c); by.set(k, r);
  }
  for (const r of by.values()) items.push(line(cat, r.servis, r.qty, 'Hücre · ' + [...new Set(r.codes)].join(', ') + (yal === 'hd' ? ' · hava yalıtımlı' : ' · gaz izoleli'), 'hucre', { name: r.ad + ' (poz eşlenmemiş)' }));
  // Trafo + AG pano
  const nT = Y.trafo.filter((t) => t.aktif !== false).length;
  if (Y.hasT && nT) {
    const t = cat.pickTrafo('bina', ctx.cins, cabin.trafoKva);
    items.push(line(cat, t ? t.servis : null, nT, cabin.trafoKva + ' kVA ' + ctx.cinsLabel + ' trafo', 'trafo', { name: cabin.trafoKva + ' kVA trafo' }));
    const p = cat.pickPanel('dahili', cabin.trafoKva);
    if (Y.pano.length) items.push(line(cat, p ? p.servis : null, Y.pano.length, 'Dahili AG dağıtım panosu', 'pano', { name: 'AG pano' }));
  }
  // Kablo kanalları (m)
  const kServis = (cat.table('cabin') || {}).kanal || null;
  for (const k of Y.kanallar) {
    const m = Math.round((k.boy || 0) / 10) / 100;
    if (m > 0) items.push(line(cat, kServis, m, 'Kablo kanalı · ' + k.ad + ' · ' + (k.gen || '?') + '×' + (k.der || '?') + ' mm' + (k.kapakli ? ' · kapaklı' : ''), 'kanal', { unit: 'm', name: 'Kablo kanalı', keep: { tipProje: k.kaynak !== 'kullanici' } }));
  }
  // Topraklama ve levha (köşk / bina reçetesindeki gibi)
  for (const [servis, key, why] of [['030.02.01.01-001', 'koskKazik', 'Topraklama kazığı'], ['030.01.04.01-002', 'koskBakir', 'Örgülü bakır 50 mm² (m)'], ['027.01.02.01-000', 'levha', 'Tehlike levhası']]) {
    const q = cat.param(key, params);
    if (q > 0) items.push(line(cat, servis, +q, why, 'top'));
  }
  return items;
}
