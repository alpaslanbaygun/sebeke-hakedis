// Hat sistemi: havai iletken metrajı (m / kg), yeraltı kablo + kanal metrajı, abone hattı ekleri.
// Kg hesabı gerçek iletken ağırlığı (kg/km) üzerinden yapılır.
import SH from '../interop/sh-core.cjs';
import KATSAYILAR from '../ortak/katsayilar.js';
import KALEMLER from '../ortak/kalemler.js';
import ESLESME from '../ortak/volt-eslesme.js';

export const LINE_TYPE_LABEL = { AG: 'AG', OG: 'OG', AYD: 'Aydınlatma', ENH: 'ENH', ABONE: 'Abone' };

/**
 * AutoCAD kataloğundaki iletken / kablo devresi: anahtar "@CİNS|tanım" (eklentinin HAT kalemi; ör. "@AG_İLETKEN|4P+R",
 * "@AG_BAKIR_KABLO|4x10 Nyy Cu"). Telefon kataloğunda karşılığı olmayan iletken AutoCAD'den böyle gelir; hat ekranında
 * eklentinin listesinden de seçilir. Dışa aktarımda aynı cins ve tanımla döner (iki tarafta aynı iletken).
 */
export function autocadDevresi(c) {
  const k = c && typeof c.key === 'string' && c.key.charAt(0) === '@' ? c.key.slice(1) : '';
  const i = k.indexOf('|');
  return i > 0 ? { cins: k.slice(0, i), tanim: k.slice(i + 1) } : null;
}
export const autocadAnahtari = (cins, tanim) => '@' + cins + '|' + tanim;
/**
 * Devrenin rolüne ve tesisine uyan AutoCAD cinsleri: hattın türünün cins grubu (kalemler.json › gruplar.hatlar; eklentideki
 * Katalog.HatCinsListesi). Grup yoksa null.
 */
export function autocadGrubu(role, install) {
  const e = ESLESME.hatlar[(role || 'AG') + ':' + (install === 'yeralti' ? 'yeralti' : 'havai')];
  const g = e ? ((KALEMLER.gruplar || {}).hatlar || {})[e.tur] : null;
  return g && g.length ? g : null;
}
/** AutoCAD'deki tipin cinsi devrenin rolüne ve tesisine uyuyor mu (grup yoksa uyar sayılır). */
export function autocadUygun(ac, role, install) {
  const g = autocadGrubu(role, install);
  return !g || g.includes(SH.cinsDuzelt(ac.cins));
}
/**
 * Devrenin iletken adı (tertip tahmini gibi ada bakan yerler için): telefon tipinde anahtar, AutoCAD tipinde tanım ve
 * çıplak iletken açılımındaki tel adları (3xSW → "3xSW SWALLOW").
 */
export function devreYazisi(c) {
  const ac = autocadDevresi(c);
  if (!ac) return (c && c.key) || '';
  const tablo = String(ac.cins).startsWith('OG_') ? KATSAYILAR.ogIletken : KATSAYILAR.agIletken;
  const acilim = tablo && tablo.acilim ? tablo.acilim[ac.tanim] : null;
  return ac.tanim + (acilim ? ' ' + Object.keys(acilim).join(' ') : '');
}
const buyuk = (s) => String(s || '').toLocaleUpperCase('tr').replace(/İ/g, 'I');
/**
 * AutoCAD devresinin parçaları: çıplak iletken kombinasyonu (4P+R, 3A+P+R, 2(3xSW)…) eklentinin Durum Tespit
 * açılımıyla tel tel (katsayilar.json › agIletken / ogIletken; kg ağırlıkla), kablo ve demetli iletken metreyle.
 */
function autocadParcalari(ac, cat) {
  const og = String(ac.cins).startsWith('OG_');
  const tablo = og ? KATSAYILAR.ogIletken : KATSAYILAR.agIletken;
  const acilim = tablo && tablo.acilim ? tablo.acilim[ac.tanim] : null;
  if (acilim) {
    return {
      unit: 'kg', coresPerCircuit: 1, label: ac.tanim, autocad: ac,
      parts: Object.entries(acilim).map(([ad, n]) => {
        const cd = cat.t.conductors.find((x) => buyuk(x.name) === buyuk(ad)) || null;
        const kgm = (tablo.agirlikKgM || {})[ad];
        return { conductor: cd ? cd.name : ad, count: n, kgPerKm: cd && cd.kgPerKm ? cd.kgPerKm : kgm ? kgm * 1000 : null, yd: cd ? cd.yd : null, kind: cd ? cd.kind : og ? 'ACSR' : 'AAC' };
      })
    };
  }
  return { unit: 'm', coresPerCircuit: 1, label: ac.tanim, autocad: ac, parts: [{ conductor: autocadAnahtari(ac.cins, ac.tanim), count: 1, kgPerKm: null, yd: null, kind: autocadTuru(ac.cins) }] };
}
/** AutoCAD cinsinin telefon iletken türü: ALPEK demetli (AER), çıplak iletken (AG: AAC, OG: ACSR), diğerleri kablo. */
function autocadTuru(cins) {
  const c = buyuk(cins);
  if (c.includes('ALPEK')) return 'AER';
  if (c.includes('ILETKEN') && !c.startsWith('TOP_')) return c.startsWith('OG_') ? 'ACSR' : 'AAC';
  return 'KABLO';
}

// Devre tanımından parça listesi (katalog hat tipi, özel çıplak AG kombinasyonu 3P+R(+R) ya da AutoCAD kataloğundaki iletken)
export function circuitParts(c, cat) {
  const ac = autocadDevresi(c);
  if (ac) return autocadParcalari(ac, cat);
  if (c.custom) {
    const parts = [[c.custom.f || 'P', 3], [c.custom.nt || 'R', 1]].concat(c.custom.ay ? [[c.custom.ay, 1]] : []);
    return {
      unit: 'kg', coresPerCircuit: 1, label: '3' + (c.custom.f || 'P') + '+' + (c.custom.nt || 'R') + (c.custom.ay ? '+' + c.custom.ay : ''),
      parts: parts.map(([s, n]) => { const cd = cat.bareByShort(s); return { conductor: cd ? cd.name : s, count: n, kgPerKm: cd ? cd.kgPerKm : null, yd: cd ? cd.yd : null, kind: 'AAC' }; })
    };
  }
  const lt = cat.lineType(c.key);
  if (!lt) return null;
  return {
    unit: lt.unit, coresPerCircuit: lt.coresPerCircuit, label: c.key,
    parts: lt.parts.map((p) => { const cd = cat.conductor(p.conductor); return Object.assign({}, p, { kind: cd ? cd.kind : null, kgPerKm: p.kgPerKm ?? (cd ? cd.kgPerKm : null) }); })
  };
}
export function circuitLabel(c, cat) { const p = circuitParts(c, cat); const l = p ? p.label : c.key; return (c.count > 1 ? c.count + 'x(' + l + ')' : l); }
export function lineLabel(line, cat) {
  const og = (line.circuits || []).filter((c) => c.role === 'OG' || c.role === 'ENH').map((c) => circuitLabel(c, cat)).join(' + ');
  const ag = (line.circuits || []).filter((c) => c.role !== 'OG' && c.role !== 'ENH').map((c) => circuitLabel(c, cat)).join(' + ');
  return [og, ag].filter(Boolean).join(' / ') || (line.channelOnly ? 'Kanal / kazı (kablosuz)' : '');
}
/**
 * Hattın ekranda görünen iletken yazısı: malzeme adlarının ortak yazımıyla (BÜYÜK harf, standart birim ve kodlar;
 * eklentideki MalzemeYazimi.Duzelt ile aynı). Kayıt, eşleşme ve raporlar lineLabel'ı (ham yazı) kullanır.
 */
export const malzemeYazisi = (s) => SH.malzemeYazisi(s);
export function lineLabelText(line, cat) {
  const l = lineLabel(line, cat);
  return (line.circuits || []).length ? SH.malzemeYazisi(l) : l;
}
export function isBareAG(line, cat) {
  return (line.circuits || []).some((c) => (c.role === 'AG' || c.role === 'AYD') && (c.custom || (circuitParts(c, cat) || { parts: [] }).parts.some((p) => p.kind === 'AAC')));
}

// Havai hat iletken metrajı
export function overheadQuantities(line, len3D, cat, opts = {}) {
  const pay = (line.conductorPayPct ?? opts.payPct ?? 0) / 100;
  const out = [];
  for (const c of line.circuits || []) {
    const cp = circuitParts(c, cat);
    if (!cp) { out.push({ servis: null, qty: 0, unit: 'm', why: 'Hat tipi katalogda yok: ' + c.key, missing: true, refType: 'line', refId: line.id }); continue; }
    const n = c.count || 1;
    for (const p of cp.parts) {
      const meters = len3D * (cp.unit === 'kg' ? p.count : cp.coresPerCircuit) * n * (1 + pay);
      if (cp.unit === 'kg') {
        const kg = p.kgPerKm ? (meters * p.kgPerKm) / 1000 : null;
        out.push({ servis: p.yd, qty: kg ?? 0, unit: 'Kg', meters, why: (p.count * n) + '× ' + p.conductor + ' · ' + meters.toFixed(2) + ' m × ' + (p.kgPerKm ? (p.kgPerKm / 1000).toFixed(5) : '?') + ' kg/m', conductor: p.conductor, role: c.role, missing: !p.yd || !p.kgPerKm, refType: 'line', refId: line.id });
      } else {
        out.push(Object.assign({ servis: p.yd, qty: meters, unit: 'm', meters, why: (cp.autocad ? cp.label : c.key) + ' · ' + len3D.toFixed(2) + ' m × ' + (cp.coresPerCircuit * n), conductor: p.conductor, role: c.role, missing: !p.yd, refType: 'line', refId: line.id }, cp.autocad ? { name: SH.malzemeYazisi(cp.label) } : null));
      }
    }
  }
  return out;
}

// Yeraltı kablo: gerçek kablo metrajı = kanal + dikey iniş + çıkış + trafo payı + SDK payı + muf payı + rezerv
export const CABLE_DEFAULTS = { channelType: 'toprak', width: 0.4, depth: null, sandCm: 20, warningTape: 1, protectionPlate: true, plateLenM: 1.0, concreteCm: 10, pipeDia: 110, pipeCount: 0, manholes: 0, joints: null, drumM: 500, riserM: 8, exitM: 2, trafoM: 5, sdkM: 2, jointM: 1.5, reserveM: 5 };
// v2.4 · Kanal modeli: KAPLAMA (zeminin üstü) + YÖNTEM (nasıl geçildiği) ayrı seçilir.
// KAPLAMA kanalın poz anahtarıdır (surface): kaplama seçiliyse kaplama, değilse zemin cinsi.
export const KAPLAMA = { toprak: 'Toprak', tuvenan: 'Tüvenan', micir: 'Mıcır', asfalt: 'Asfalt', beton: 'Beton', parke: 'Parke taşı' };
export const YONTEM = { acik: 'Açık kazı', borulu: 'Borulu geçiş', sondaj: 'Yatay sondaj' };
// v2.6 · Kanal zemini AutoCAD eklentisiyle aynı: cins (dolgu) + kaplama + bariyer + trencher ayrı seçilir, AutoCAD'e
// eski programın kalem adı gider (SH.kanalZeminiTanim; ortak deneme ortak/deneme/kanal-zemini.json).
export const ZEMIN_CINSI = { toprak: 'Toprak', tuvenan: 'Tüvenan', micir: 'Mıcır', bransman: 'Branşman kanalı', demontaj: 'Kablo demontaj kanalı' };
export const KAPLAMA_TURU = { '': 'Kaplamasız', parke: 'Parke', asfalt: 'Asfalt', beton: 'Beton' };
const ZEMIN_KODU = { toprak: 'TOPRAK', tuvenan: 'TUVENAN', micir: 'MICIR', bransman: 'BRANŞMAN KANAL', demontaj: 'KANAL (KABLO DEMONTAJ)' };
const KAPLAMA_KODU = { '': '', parke: 'PARKE', asfalt: 'ASFALT', beton: 'BETON' };
const ZEMIN_ANAHTARI = Object.fromEntries(Object.entries(ZEMIN_KODU).map(([k, v]) => [v, k]));
const KAPLAMA_ANAHTARI = Object.fromEntries(Object.entries(KAPLAMA_KODU).map(([k, v]) => [v, k]));
export const zeminOzelMi = (zemin) => zemin === 'bransman' || zemin === 'demontaj';
/** Kayıttaki kanal zemini: {zemin, kaplama, bariyer, trencher}; eski kayıtta tek "surface" seçiminden çıkarılır. */
export function kanalZemini(cable) {
  const c = cable || {};
  if (c.zemin && ZEMIN_CINSI[c.zemin]) {
    const ozel = zeminOzelMi(c.zemin);
    return { zemin: c.zemin, kaplama: !ozel && KAPLAMA_TURU[c.kaplama || ''] ? c.kaplama || '' : '', bariyer: !ozel && !!c.bariyer, trencher: !ozel && !!c.trencher };
  }
  const s = c.surface;
  if (s === 'asfalt' || s === 'parke') return { zemin: 'tuvenan', kaplama: s, bariyer: false, trencher: false };
  if (s === 'beton') return { zemin: 'toprak', kaplama: 'beton', bariyer: false, trencher: false };
  return { zemin: s === 'tuvenan' || s === 'micir' ? s : 'toprak', kaplama: '', bariyer: false, trencher: false };
}
/** Zeminin poz anahtarı (KAPLAMA): kaplama seçiliyse kaplama, değilse zemin cinsi (branşman / demontaj: toprak). */
export const zemindenSurface = (z) => z.kaplama || (z.zemin === 'tuvenan' || z.zemin === 'micir' ? z.zemin : 'toprak');
/** AutoCAD'e giden kanal kalemi adı; AutoCAD'den gelen kural dışı ad (zeminHam) seçim değişmedikçe aynen döner. */
export function kanalZeminTanimi(cable) {
  const c = cable || {};
  if (c.zeminHam) return c.zeminHam;
  const z = kanalZemini(c);
  return SH.kanalZeminiTanim({ cins: ZEMIN_KODU[z.zemin], kaplama: KAPLAMA_KODU[z.kaplama], bariyerli: z.bariyer, trencher: z.trencher });
}
/** AutoCAD'deki kanal kalemi adından telefonun kanal zemini alanları (kural dışı adda zeminHam). */
export function zemindenAlanlar(tanim) {
  const z = SH.kanalZeminiCoz(tanim);
  if (!z) {
    const t = String(tanim || '').trim().toUpperCase();
    // Eski telefon dosyalarındaki yalın kaplama adları (ASFALT, BETON) ve bilinmeyen adlar: ad korunur
    const k = kanalZemini({ surface: t === 'ASFALT' ? 'asfalt' : t === 'BETON' ? 'beton' : 'toprak' });
    return Object.assign(k, { surface: zemindenSurface(k) }, t ? { zeminHam: String(tanim).trim() } : {});
  }
  const k = { zemin: ZEMIN_ANAHTARI[z.cins] || 'toprak', kaplama: KAPLAMA_ANAHTARI[z.kaplama] || '', bariyer: z.bariyerli, trencher: z.trencher };
  return Object.assign(k, { surface: zemindenSurface(k) });
}
/** Okunur yazı: "Tüvenan · Parke · bariyerli" (AutoCAD'deki kural dışı ad olduğu gibi). */
export function kanalZeminYazisi(cable) {
  const c = cable || {};
  if (c.zeminHam) return c.zeminHam;
  const z = kanalZemini(c);
  if (zeminOzelMi(z.zemin)) return ZEMIN_CINSI[z.zemin];
  return [ZEMIN_CINSI[z.zemin], KAPLAMA_TURU[z.kaplama], z.bariyer ? 'bariyerli' : '', z.trencher ? 'trencher' : ''].filter(Boolean).join(' · ');
}
export const KANAL_VARSAYILAN = {
  kazi: { toprak: '032.12.01.01-003', tuvenan: '032.12.01.01-002', micir: 'YEREL:KANAL-MICIR', asfalt: 'YEREL:KANAL-ASFALT', beton: 'YEREL:KANAL-BETON', parke: 'YEREL:KANAL-PARKE' },
  sondaj: '032.12.06.01-003',
  abone: { kaplamasiz: '032.13.03.01-001', kaplamali: '032.13.03.01-002' }
};
// Kayıttaki kanal bilgisinden kaplama + yöntem (eski kayıtlar: toprak / beton / borulu / direk inişi / duvar)
export function kanalModel(cable) {
  const c = cable || {};
  if (c.zemin || c.surface || c.method) {
    const z = kanalZemini(c);
    const surface = c.zemin ? zemindenSurface(z) : KAPLAMA[c.surface] ? c.surface : 'toprak';
    return Object.assign({ surface, method: YONTEM[c.method] ? c.method : 'acik', yeni: true }, z);
  }
  const t = c.channelType || 'toprak';
  // 'direk' (direk inişi) ve 'duvar' (duvar geçişi) v2.4'te kaldırıldı: bu eski kayıtlarda kazı yoktur → kaplama seçilene kadar kanal hesaplanmaz
  return { surface: t === 'beton' ? 'beton' : 'toprak', method: t === 'borulu' ? 'borulu' : 'acik', yeni: false, eski: t, kazisiz: t === 'direk' || t === 'duvar' };
}
export function kanalLabel(cable) { const k = kanalModel(cable); return (cable && (cable.zemin || cable.zeminHam) ? kanalZeminYazisi(cable) : KAPLAMA[k.surface]) + (k.method !== 'acik' ? ' · ' + YONTEM[k.method] : ''); }
export function cableQuantities(line, route, endKinds, cat, opts = {}) {
  const auto = opts.auto !== false;
  const cfg = Object.assign({}, CABLE_DEFAULTS, line.cable || {});
  const Lc = route.length2D;
  const km0 = kanalModel(line.cable);
  const risers = cfg.riserCount ?? endKinds.filter((k) => k === 'pole').length;
  const trafoEnds = endKinds.filter((k) => k === 'transformer' || k === 'kiosk' || k === 'substation').length;
  const sdkEnds = endKinds.filter((k) => k === 'sdk').length;
  const joints = cfg.joints ?? Math.max(0, Math.ceil(Lc / cfg.drumM) - 1);
  const exits = cfg.exitCount ?? endKinds.length;
  const coreLen = Lc + risers * cfg.riserM + exits * cfg.exitM + trafoEnds * cfg.trafoM + sdkEnds * cfg.sdkM + joints * cfg.jointM + cfg.reserveM;
  const out = [];
  const breakdown = { kanal: Lc, dikeyInis: risers * cfg.riserM, cikis: exits * cfg.exitM, trafoPayi: trafoEnds * cfg.trafoM, sdkPayi: sdkEnds * cfg.sdkM, mufPayi: joints * cfg.jointM, rezerv: cfg.reserveM, damar: coreLen, joints, risers };
  const og = line.lineType === 'OG' || line.lineType === 'ENH';
  let singleCore = false, ncirc = 0;
  for (const c of line.circuits || []) {
    const cp = circuitParts(c, cat);
    if (!cp) { out.push({ servis: null, qty: 0, unit: 'm', why: 'Kablo tipi katalogda yok: ' + c.key, missing: true, refType: 'line', refId: line.id }); continue; }
    const n = c.count || 1; ncirc += n;
    const p = cp.parts[0];
    if (cp.coresPerCircuit > 1) singleCore = true;
    const servis = (km0.yeni ? true : cfg.channelType === 'toprak') ? (p.ydToprak || p.yd) : p.yd;
    const m = coreLen * cp.coresPerCircuit * n;
    out.push(Object.assign({ servis, qty: m, unit: 'm', meters: m, why: (cp.autocad ? cp.label : c.key) + ' · ' + coreLen.toFixed(2) + ' m × ' + (cp.coresPerCircuit * n) + ' damar/devre', conductor: c.key, role: c.role, missing: !servis, refType: 'line', refId: line.id, breakdown }, cp.autocad ? { name: SH.malzemeYazisi(cp.label) } : null));
  }
  // Kanal ve yardımcı malzemeler (Material anahtarları → poz eşlemesi standart tablosunda)
  const mat = (key, qty, unit, why) => { if (qty > 0) out.push({ material: key, servis: null, qty, unit, why, refType: 'line', refId: line.id }); };
  const km = kanalModel(line.cable);
  const yeniKanal = km.yeni || !auto;      // v2.4 kanal hesabı: yeni kayıtlar ve otomatik reçetesi kapalı projeler
  let kanal = null;
  if (yeniKanal) {
    const K = Object.assign({}, KANAL_VARSAYILAN, (cat.table && cat.table('kanal')) || {});
    const poz = (servis, qty, unit, why, ad) => { const pz = servis ? cat.poz(servis) : null; out.push({ servis: servis || null, qty, unit: pz ? pz.unit : unit, why, kanal: true, name: pz ? pz.name : ad, conductor: pz ? pz.name : ad, missing: !pz, refType: 'line', refId: line.id }); };
    const w = +cfg.width || 0, d = +cfg.depth || 0;
    const hacim = Lc * w * d;
    kanal = { surface: km.surface, method: km.method, uzunluk: Lc, genislik: w, derinlik: d, hacim: km.method === 'sondaj' || km.kazisiz ? 0 : hacim, boru: 0, eski: km.kazisiz ? km.eski : null };
    const olcu = Lc.toFixed(2) + ' m × ' + w + ' × ' + (cfg.depth ?? '?') + ' m';
    if (Lc > 0 && !km.kazisiz) {
      if (km.method === 'sondaj') poz(K.sondaj, Lc, 'm', 'Yatay sondaj · ' + Lc.toFixed(2) + ' m', 'Yatay sondaj');
      else if (line.lineType === 'ABONE') { if (!auto) poz((K.abone || {})[(km.zemin ? !km.kaplama : km.surface === 'toprak' || km.surface === 'tuvenan') ? 'kaplamasiz' : 'kaplamali'], Lc, 'm', 'Abone bağlantı kanalı · ' + KAPLAMA[km.surface] + ' · ' + Lc.toFixed(2) + ' m', 'Abone bağlantı kanalı'); }
      else poz((K.kazi || {})[km.surface], hacim, 'm3', 'Kanal · ' + KAPLAMA[km.surface] + (km.method === 'borulu' ? ' · borulu geçiş' : '') + ' · ' + olcu, 'Kablo kanalı (' + KAPLAMA[km.surface] + ')');
      const nBoru = km.method === 'borulu' ? Math.max(1, +cfg.pipeCount || 0) : km.method === 'sondaj' ? (+cfg.pipeCount || 0) : 0;
      if (nBoru > 0) { kanal.boru = Lc * nBoru; mat('BORU_' + cfg.pipeDia, Lc * nBoru, 'm', nBoru + ' × Ø' + cfg.pipeDia + ' boru · ' + YONTEM[km.method]); }
    }
  } else {
    const chanKey = { toprak: 'KANAL_TOPRAK', beton: 'KANAL_BETON', borulu: 'KANAL_BORULU', direk: 'DIREK_INISI', duvar: 'DUVAR_GECISI' }[cfg.channelType] || 'KANAL_TOPRAK';
    if (line.lineType !== 'ABONE') mat(chanKey, cfg.channelType === 'direk' || cfg.channelType === 'duvar' ? 1 : Lc, cfg.channelType === 'direk' || cfg.channelType === 'duvar' ? 'Ad' : 'm', 'Kanal ' + cfg.channelType + ' · ' + cfg.width + ' × ' + (cfg.depth ?? '?') + ' m');
  }
  // Yardımcı malzemeler yalnız otomatik reçete açıkken gelir; kapalıyken kullanıcı "Malzeme ekle" ile ekler
  if (auto) {
    const kum = yeniKanal ? km.method !== 'sondaj' && km.surface !== 'beton' : cfg.channelType === 'toprak' || cfg.channelType === 'borulu';
    const acik = !yeniKanal || km.method !== 'sondaj';
    if (kum) mat('KUM', Lc * cfg.width * cfg.sandCm / 100, 'm³', 'Kum yatağı ' + cfg.sandCm + ' cm');
    if (acik) mat('UYARI_BANDI', Lc * (cfg.warningTape || 0), 'm', 'Uyarı bandı × ' + cfg.warningTape);
    if (acik && cfg.protectionPlate) mat('KORUMA_PLAKASI', Math.ceil(Lc / cfg.plateLenM) * Math.max(1, ncirc), 'Ad', 'Koruma plakası (' + cfg.plateLenM + ' m)');
    if (!yeniKanal && cfg.channelType === 'beton') mat('BETON', Lc * cfg.width * cfg.concreteCm / 100, 'm³', 'Beton ' + cfg.concreteCm + ' cm');
    if (!yeniKanal && cfg.pipeCount > 0) mat('BORU_' + cfg.pipeDia, Lc * cfg.pipeCount, 'm', cfg.pipeCount + ' × Ø' + cfg.pipeDia + ' boru');
    mat('MENHOL', cfg.manholes || 0, 'Ad', 'Menhol');
    // Yalnız kanal / kazı (kablosuz) hatta muf ve başlık yok
    if (!(line.channelOnly && !ncirc)) {
      mat(og ? 'MUF_OG' : 'MUF_AG', joints * Math.max(1, ncirc) * (singleCore ? 3 : 1), 'Ad', 'Ek muf');
      mat(og ? 'BASLIK_OG' : 'BASLIK_AG', endKinds.length * Math.max(1, ncirc) * (singleCore ? 3 : 1), 'Ad', 'Kablo başlığı');
    }
  }
  return { items: out, breakdown, cfg, kanal };
}
