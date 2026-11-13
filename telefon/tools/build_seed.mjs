// Tasarım maketinden çıkarılan ham veriyi (design_raw.json) versiyonlu standart paketine
// (2026 poz kataloğu) dönüştürür. Çıktı uygulamaya ilk açılışta
// veritabanına (IndexedDB) içe aktarılır; uygulama içinde koddan değil DB'den okunur.
import { applyExtras } from './seed_extras_v23.mjs';
import { kurallariCevir } from '../web/src/grid/onerilen-malzeme.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'seed/design_raw.json'), 'utf8'));
const STD = 'TEDAS-2026-GR02';

const num = (s) => {
  if (s === null || s === undefined || s === '') return null;
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

// ---------------- Poz / Yeşil Defter kataloğu ----------------
const poz = new Map();
const catOf = (code) => {
  const p = code.slice(0, 6);
  if (code.startsWith('005.01')) return 'Demir direk';
  if (code.startsWith('005.05')) return 'Aydınlatma direği';
  if (code.startsWith('005.06.05')) return 'Trafo platformu';
  if (code.startsWith('005.06')) return 'Beton direk';
  if (code.startsWith('005.08')) return 'Ağaç direk';
  if (code.startsWith('005.02') || code.startsWith('005.07')) return 'Travers';
  const m = { '008': 'Boru', '009': 'İletken', '011': 'İzolatör', '014': 'Askı teli', '015': 'Koruma', '017': 'Koruma', '022': 'Köşk / hücre', '024': 'Pano / box', '027': 'Levha', '030': 'Topraklama', '031': 'Trafo', '032': 'Kablo / abone' };
  return m[p.slice(0, 3)] || 'Diğer';
};
const sectionOf = (code) => {
  if (code.startsWith('005.01.02.02') || code.startsWith('005.01.02.01') || code.startsWith('005.01.03')) return '5.5.1';
  if (code.startsWith('005.06.01')) return '5.6.1';
  if (code.startsWith('005.06.02')) return '5.6.2';
  return null;
};
function putPoz(code, o) {
  if (!code) return;
  const prev = poz.get(code) || {};
  const rec = Object.assign({
    id: STD + ':' + code, stdId: STD, servis: code, pozNo: sectionOf(code), name: '', unit: 'Ad', kgPerUnit: null,
    supply: 'Ş', montaj: true, demontaj: true, dmm: true, kgGroup: '', category: catOf(code), bfPoz: null,
    priceMaterial: null, priceLabor: null, priceUnit: null, inGreenBook: false,
    validFrom: '2026-01-01', validTo: '2026-12-31', source: 'Poz kataloğu 2026'
  }, prev);
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') rec[k] = v;
  poz.set(code, rec);
}
// CAT: [ad, birim, kg/Ad, temin, demontajda var, dmm'de var, bu hakedişte miktarı var, Kg grubu]
for (const [code, r] of Object.entries(raw.CAT)) {
  putPoz(code, { name: r[0], unit: r[1], kgPerUnit: r[2] || null, supply: r[3], demontaj: r[4] === 1, dmm: r[5] === 1, inGreenBook: r[6] === 1, kgGroup: r[7] || '' });
  if (r[1] === 'Kg' && !r[7]) poz.get(code).isKgGroup = true;
}
// Poz kataloğu ekranı: [grup, servis, poz, ad, birim, kg, temin, demontaj, dmm, defterde, Kg grubu]
for (const r of raw.P7_DATA) {
  // [7]=demontaj sayfasında var, [8]=DMM sayfasında var, [9]=bu defterde miktarı var; montaj: servis kodu varsa
  putPoz(r[1], { category: r[0], pozNo: r[2], name: r[3].trim(), unit: r[4], kgPerUnit: num(r[5]), supply: r[6], montaj: true, demontaj: r[7] === 1, dmm: r[8] === 1, inGreenBook: r[9] === 1, kgGroup: r[10] || '' });
}

// ---------------- Direk grupları ve tipleri ----------------
const poleGroups = [
  { id: 'bahh', label: 'BAHH · galvaniz kaynaklı (OG)', short: 'Demir · galv. kaynaklı', material: 'DEMİR', joint: 'kaynaklı', voltage: ['OG', 'ENH'], kgGroup: '005.01.02.02-000', section: '5.5.1', symbol: 's', og: true, roleFromName: true },
  { id: 'civ', label: 'BAHH · galvaniz cıvatalı (OG)', short: 'Demir · galv. cıvatalı', material: 'DEMİR', joint: 'cıvatalı', voltage: ['OG', 'ENH'], kgGroup: '005.01.03.02-000', section: '5.5.1', symbol: 's', og: true },
  { id: 'sehir', label: 'Şehir içi AG · galv. kaynaklı', short: 'Demir · şehir içi AG', material: 'DEMİR', joint: 'kaynaklı', voltage: ['AG'], kgGroup: '005.01.02.01-000', section: '5.5.1', symbol: 's', og: false },
  { id: 'mus', label: 'Müşterek AG+OG · galv. kaynaklı', short: 'Demir · müşterek', material: 'DEMİR', joint: 'kaynaklı', voltage: ['AG', 'OG'], kgGroup: '005.01.02.01-000', section: '5.5.1', symbol: 's', og: true },
  { id: 'beton', label: 'Beton · şehir içi AG/müşterek (5.6.1)', short: 'Beton · santrifüj 5.6.1', material: 'BETON', joint: 'santrifüj', voltage: ['AG', 'OG'], kgGroup: '005.06.01.00-001', section: '5.6.1', symbol: 'c', og: false },
  { id: 'beton562', label: 'Beton · B.A. hava hattı (5.6.2)', short: 'Beton · santrifüj 5.6.2', material: 'BETON', joint: 'santrifüj', voltage: ['OG', 'ENH'], kgGroup: '005.06.02.00-001', section: '5.6.2', symbol: 'c', og: true },
  { id: 'agac', label: 'Ağaç · emprenyeli', short: 'Ağaç · emprenyeli', material: 'AĞAÇ', joint: 'emprenyeli', voltage: ['AG'], kgGroup: '', section: null, symbol: 'c', og: false },
  { id: 'ayd', label: 'Aydınlatma · galv. poligon', short: 'Aydınlatma poligon', material: 'DEMİR', joint: 'poligon', voltage: ['AYD'], kgGroup: '005.05.01.01-000', section: null, symbol: 'c', og: false },
  { id: 'trafo', label: 'Trafo direği · G-T', short: 'Trafo direği', material: 'DEMİR', joint: 'kaynaklı', voltage: ['OG'], kgGroup: '005.01.02.01-000', section: '5.5.1', symbol: 's', og: true }
].map((g) => Object.assign({ stdId: STD }, g));

const poleTypes = [];
const addType = (group, name, servis, kg, cls, extra = {}) => {
  const t = Object.assign({ id: STD + ':PT:' + group + ':' + name, stdId: STD, group, name, servis, kg: kg || 0, cls: cls || '' }, extra);
  const h = name.match(/-(\d+)(?:\s|\(|$|I|U)/) || name.match(/^(\d+(?:[.,]\d+)?)(?:\/| m)/);
  if (h) t.heightM = num(h[1]);
  const rm = name.match(/^G([TDNZ])(?:S)?-/);
  if (rm) t.role = rm[1];
  poleTypes.push(t);
  putPoz(servis, { name: t.label || name, unit: 'Ad', kgPerUnit: kg || null, kgGroup: poleGroups.find((g) => g.id === group).kgGroup });
};
for (const [n, v] of Object.entries(raw.DOG)) addType('bahh', n, v[1], v[0], (n.match(/\(([^)]+)\)/) || [0, ''])[1].toLowerCase(), { label: n + ' B.A H.H.Galv.Kay.Dem.Direk' });
for (const [fam, f] of Object.entries(raw.CIV)) for (const [boy, v] of Object.entries(f.items)) addType('civ', fam + boy + ' (' + f.cls + ')', v[1], v[0], f.cls.toLowerCase(), { family: fam, boy, label: 'B.A H.H.Galv.Kay.Civ.Dem.Direk ' + fam + boy });
for (const [n, v] of Object.entries(raw.DAG)) addType('sehir', n, v[1], v[0], '', { label: n + ' Şehir içi AG Kay.Galv.Direk' });
for (const [n, v] of Object.entries(raw.DMUS)) addType('mus', n, v[1], v[0], '3 awg', { label: n + ' Şehir içi Müş. Kay.Galv.Direk' });
for (const [n, v] of Object.entries(raw.B561)) { const [boy, tk] = n.split('/'); addType('beton', n, '005.06.01.01-' + v[0], v[1], '', { heightM: num(boy), topLoadKN: num(tk), label: 'Santrifüj beton direk (5.6.1) ' + n }); }
for (const [n, v] of Object.entries(raw.B562)) { const [boy, tk] = n.split('/'); addType('beton562', n, '005.06.02.01-' + v[0], v[1], '3 awg', { heightM: num(boy), topLoadKN: num(tk), label: 'B.A. hava hattı santrifüj beton direk (5.6.2) ' + n }); }
for (const [n, c] of Object.entries(raw.AGAC)) addType('agac', n, c, 0, '', { heightM: num(n), label: 'AG-OG müşterek ağaç direk ' + n });
for (const [n, v] of Object.entries(raw.AYD)) addType('ayd', n, v[1], v[0], '', { label: n + ' galv. poligon aydınlatma direği' });
for (const [n, v] of Object.entries(raw.TD)) addType('trafo', n, v[1], v[0], '', { label: n + ' Kay.Galv.Trafo Direk' });
// beton direk tepe kuvveti → kapasite (daN) (TK değeri kN kabul edildi; doğrulanmalı)
for (const t of poleTypes) if (t.topLoadKN) t.capacityDaN = t.topLoadKN * 100;

// ---------------- İletkenler ve kablolar ----------------
// Mekanik değerler: IEC/ASTM B232 tipik değerleri — StandardVersion içinde düzenlenebilir (verified:false)
const MECH = {
  Swan: { d: 6.36, A: 24.71, rts: 830, E: 7900, alpha: 19.1e-6 }, Swallow: { d: 7.14, A: 31.2, rts: 1030, E: 7900, alpha: 19.1e-6 },
  Sparrow: { d: 8.01, A: 39.2, rts: 1270, E: 7900, alpha: 19.1e-6 }, Robin: { d: 9.0, A: 49.5, rts: 1580, E: 7900, alpha: 19.1e-6 },
  Raven: { d: 10.11, A: 62.4, rts: 1950, E: 7900, alpha: 19.1e-6 }, Pigeon: { d: 12.75, A: 99.3, rts: 2990, E: 7900, alpha: 19.1e-6 },
  Partridge: { d: 16.31, A: 157.2, rts: 5030, E: 7600, alpha: 18.9e-6 }, Ostrich: { d: 17.27, A: 176.7, rts: 5650, E: 7600, alpha: 18.9e-6 },
  Hawk: { d: 21.79, A: 281.1, rts: 8670, E: 7600, alpha: 18.9e-6 },
  Rose: { d: 6.36, A: 24.7, rts: 440, E: 6000, alpha: 23e-6 }, Lily: { d: 7.14, A: 31.1, rts: 540, E: 6000, alpha: 23e-6 },
  Iris: { d: 8.01, A: 39.2, rts: 660, E: 6000, alpha: 23e-6 }, Pansy: { d: 9.0, A: 49.5, rts: 820, E: 6000, alpha: 23e-6 },
  Poppy: { d: 10.11, A: 62.4, rts: 1000, E: 6000, alpha: 23e-6 }, Aster: { d: 11.35, A: 78.6, rts: 1250, E: 6000, alpha: 23e-6 },
  Phlox: { d: 12.75, A: 99.3, rts: 1540, E: 6000, alpha: 23e-6 }, Oxlip: { d: 14.31, A: 125.1, rts: 1920, E: 6000, alpha: 23e-6 }
};
const conductors = [];
for (const a of raw.P9_ACSR) {
  const [name, awg, yd, bf, kgkm, pm, pl] = a;
  conductors.push(Object.assign({ id: STD + ':C:' + name, stdId: STD, name, kind: 'ACSR', family: 'Çelik-alüminyum', awg, unit: 'kg', kgPerKm: kgkm, yd: yd || null, bfPoz: bf, priceMaterialPerKg: pm, priceLaborPerKg: pl, voltage: ['OG', 'ENH'], bare: true }, { mech: MECH[name] || null }));
  if (yd) putPoz(yd, { name: name.toUpperCase() + ' ' + awg + ' (ACSR)', unit: 'Kg', bfPoz: bf, category: 'İletken' });
}
for (const a of raw.AL) {
  const [short, name, awg, mm2, yd, bf, kgkm, pm, pl] = a;
  conductors.push({ id: STD + ':C:' + name, stdId: STD, name, short, kind: 'AAC', family: 'Çıplak alüminyum', awg, mm2, unit: 'kg', kgPerKm: kgkm, yd: yd || null, bfPoz: bf, priceMaterialPerKg: pm, priceLaborPerKg: pl, voltage: ['AG', 'AYD'], bare: true, mech: MECH[name] || null });
  if (yd) putPoz(yd, { name: name.toUpperCase() + ' ' + awg, unit: 'Kg', bfPoz: bf, category: 'İletken' });
}
const parseTL = (txt, key) => { const m = String(txt || '').match(new RegExp(key + '\\s+([0-9.,]+)')); return m ? num(m[1].replace('.', '').replace(',', '.')) : null; };
for (const [key, d] of Object.entries(raw.CD)) {
  const part = d[2][0];
  if (d[0] !== 'm') continue;
  const isAER = /AER/.test(key), isOG = /YE3SV|NA2XSY/.test(key);
  const tech = raw.TECH[key] || '';
  const c = {
    id: STD + ':C:' + key, stdId: STD, name: key, kind: isAER ? 'AER' : 'KABLO', family: isAER ? 'Alüminyum askılı demet (AER)' : isOG ? 'OG XLPE kablo' : 'AG PVC kablo',
    unit: 'm', coresPerCircuit: d[1], yd: part[3] || null, ydToprak: part[5] || null, bfPoz: part[4] || null,
    priceMaterialPerM: parseTL(tech, 'malzeme'), priceLaborPerM: parseTL(tech, 'montaj'), tech,
    voltage: isOG ? ['OG'] : isAER ? ['AG', 'AYD', 'ABONE'] : ['AG', 'ABONE'], bare: false,
    material: /NA2XSY|NAYY|AER/.test(key) ? 'Al' : 'Cu', insulation: isOG ? 'XLPE' : isAER ? 'XLPE' : 'PVC',
    singleCore: /3x\(1x/.test(key)
  };
  const sm = key.match(/(\d)x(\d+)(?:\/(\d+))?\+(\d+)/) || key.match(/(\d)x\(1x(\d+)\/(\d+)\)/);
  if (sm) { c.phaseCount = +sm[1]; c.phaseMM2 = +sm[2]; c.lightingMM2 = sm[3] && isAER ? +sm[3] : null; c.neutralMM2 = sm[4] ? +sm[4] : (sm[3] ? +sm[3] : null); }
  const nm = key.match(/NA?YY (\d)x(\d+)$/); if (nm) { c.phaseCount = +nm[1]; c.phaseMM2 = +nm[2]; }
  c.kV = isOG ? '20.3/35' : '0.6/1';
  conductors.push(c);
  if (c.yd) putPoz(c.yd, { name: key + (isOG ? ' ' + c.kV + ' kV kablo' : isAER ? ' kablo' : ' kablo (beton kanal)'), unit: 'm', bfPoz: c.bfPoz, category: isAER ? 'İletken' : 'Kablo / abone' });
  if (c.ydToprak) putPoz(c.ydToprak, { name: key + ' kablo (toprak kanal)', unit: 'm', bfPoz: c.bfPoz, category: 'Kablo / abone' });
}
// Hat tipleri (iletken kombinasyonları): anahtar → devre başına parça listesi
const lineTypes = Object.entries(raw.CD).map(([key, d]) => ({
  id: STD + ':LT:' + key, stdId: STD, name: key, unit: d[0], coresPerCircuit: d[1],
  parts: d[2].map((p) => ({ conductor: p[0], count: p[1], kgPerKm: p[2] || null, yd: p[3] || null, bfPoz: p[4] || null, ydToprak: p[5] || null })),
  voltage: /Swan|Swallow|Sparrow|Robin|Raven|Pigeon|Partridge|Ostrich|Hawk|YE3SV|NA2XSY/.test(key) ? 'OG' : 'AG'
}));

// ---------------- Trafo, pano, köşk ----------------
const transformers = [];
for (const [kva, c] of raw.TR_DIREK) transformers.push({ stdId: STD, kind: 'direk', cins: 'herm', kva, servis: c });
for (const [kva, c] of raw.TR_HERM) transformers.push({ stdId: STD, kind: 'bina', cins: 'herm', kva, servis: c });
for (const [kva, c] of raw.TR_KURU) transformers.push({ stdId: STD, kind: 'bina', cins: 'kuru', kva, servis: c });
for (const t of transformers) { t.id = STD + ':TR:' + t.kind + ':' + t.cins + ':' + t.kva; putPoz(t.servis, { unit: 'Ad', category: 'Trafo', name: (poz.get(t.servis) || {}).name || (t.kva + ' kVA ' + (t.cins === 'kuru' ? 'kuru tip' : 'hermetik') + ' trafo') }); }
const panels = [];
for (const [kva, c] of Object.entries(raw.PANO_H)) panels.push({ stdId: STD, kind: 'harici', kva: +kva, servis: c });
for (const [kva, c] of Object.entries(raw.PANO_D)) panels.push({ stdId: STD, kind: 'dahili', kva: +kva, servis: c });
for (const p of panels) { p.id = STD + ':PN:' + p.kind + ':' + p.kva; putPoz(p.servis, { unit: 'Ad', category: 'Pano / box', name: (poz.get(p.servis) || {}).name || (p.kva + " kVA'lik " + (p.kind === 'harici' ? 'Harici' : 'Dahili') + ' Tip AG Dağıtım Panosu') }); }
const kiosks = [];
for (const [fam, rows] of Object.entries(raw.KOSK)) for (const [code, label, kva] of rows) kiosks.push({ id: STD + ':K:' + code, stdId: STD, family: fam, servis: code, label, kva: kva || null });

// Trafo postası tipleri ve güç uyumu (kVA aralığı) — varsayılan, doğrulanmalı
const trafoPostTypes = [
  { id: 'direk', label: 'Direk tipi trafo', minKva: 25, maxKva: 400, poleTrafo: true, symbol: 'tri' },
  { id: 'bina', label: 'Bina tipi trafo', minKva: 100, maxKva: 1600, symbol: 'sq' },
  { id: 'ba', label: 'Bina altı trafo', minKva: 100, maxKva: 1600, symbol: 'sq' },
  { id: 'dapt', label: 'DAPT (dağıtım amaçlı prefabrik)', minKva: 50, maxKva: 630, symbol: 'house' },
  { id: 'mod', label: 'Modüler (MOD) trafo', minKva: 100, maxKva: 1600, symbol: 'house' },
  { id: 'kule', label: 'Kule tipi trafo', minKva: 50, maxKva: 400, symbol: 'house' },
  { id: 'kulec', label: 'Kule çıkışlı trafo', minKva: 50, maxKva: 400, symbol: 'house' },
  { id: 'mbk', label: 'Prefabrik beton köşk', minKva: 0, maxKva: 2000, fromKiosk: true, symbol: 'house' },
  { id: 'rbk', label: "RMU'lu prefabrik köşk", minKva: 100, maxKva: 1600, symbol: 'house' },
  { id: 'mono', label: 'Monoblok köşk', minKva: 100, maxKva: 1600, symbol: 'house' },
  { id: 'mrmu', label: 'RMU / MRMU', minKva: 0, maxKva: 0, noTrafo: true, symbol: 'house' },
  { id: 'ind', label: 'İndirici / dağıtım merkezi', minKva: 0, maxKva: 0, noTrafo: true, symbol: 'house' }
].map((x) => Object.assign({ stdId: STD, verified: false }, x));
const trafoPoleCompat = [
  { pole: 'G-T15', maxKva: 100 }, { pole: 'G-T25', maxKva: 250 }, { pole: 'G-T35', maxKva: 400 }, { pole: 'G-T50', maxKva: 400 }
];

// ---------------- Otomatik malzeme reçetesi kuralları ----------------
// Kurallar ve parametreler ortak dosyadadır (ortak/katalog/onerilen-malzeme.json; AutoCAD eklentisi de aynı dosyayı okur);
// motorun (src/grid/recipe.js) kural biçimine src/grid/onerilen-malzeme.js çevirir.
const oneri = JSON.parse(fs.readFileSync(path.join(root, '../ortak/katalog/onerilen-malzeme.json'), 'utf8'));
const { rules, params } = kurallariCevir(oneri, STD);

// SDK tipleri (katalogdan)
const sdkTypes = [
  { id: STD + ':SDK:B', stdId: STD, name: 'TİP-B Cam Elyaf AG Saha Dağ. Kutusu (BOX)', servis: '024.02.02.01-002', outputs: 4 }
];
for (const r of raw.P7_DATA) if (/BOX|Saha Dağ/i.test(r[3]) && !sdkTypes.find((s) => s.servis === r[1])) sdkTypes.push({ id: STD + ':SDK:' + r[1], stdId: STD, name: r[3].trim(), servis: r[1], outputs: 4 });

// ---------------- GNSS, ENH, açıklık, lejant, CRS ----------------
const gnssThresholds = { minSats: 10, maxPdop: 3.0, maxSigmaH: 0.020, maxSigmaV: 0.030, maxAge: 5, minFixSeconds: 5, epochs: 5, maxAxisOffset: 0.200, stakeTolerance: 0.020 };
const enh = {
  verified: false,
  note: 'EKAT (Elektrik Kuvvetli Akım Tesisleri Yönetmeliği) varsayımlarına göre varsayılan değerler — proje öncesi doğrulayın.',
  zones: [
    { id: 'I', label: 'I. Bölge', iceK: 0, tMin: -10, tMax: 50 },
    { id: 'II', label: 'II. Bölge', iceK: 0.2, tMin: -15, tMax: 45 },
    { id: 'III', label: 'III. Bölge', iceK: 0.3, tMin: -25, tMax: 40 },
    { id: 'IV', label: 'IV. Bölge', iceK: 0.5, tMin: -30, tMax: 40 }
  ],
  iceTemp: -5, windTemp: 5, windQ: 44, windC: [[12.5, 1.2], [15.8, 1.1], [999, 1.0]], iceDensity: 900,
  maxStressPctRTS: 40, edsPctRTS: 18, gravity: 9.81
};
// Düşey en küçük açıklıklar (m) — gerilim sınıfı → nesne türü (EKAT Çizelge-8'e göre kontrol edilmeli)
const clearances = {
  verified: false,
  note: 'Varsayılan değerler EKAT Çizelge-8 ile karşılaştırılmalı; StandardVersion içinde düzenlenebilir.',
  vertical: {
    AG: { arazi: 5.0, yerlesim: 5.5, karayolu: 7.0, yol: 5.5, demiryolu: 7.5, dere: 5.0, bina: 2.5, agac: 1.0, telekom: 1.0, enerji: 1.5 },
    OG: { arazi: 6.0, yerlesim: 7.0, karayolu: 7.0, yol: 7.0, demiryolu: 7.5, dere: 6.0, bina: 3.0, agac: 2.0, telekom: 2.0, enerji: 2.0 },
    ENH: { arazi: 6.5, yerlesim: 7.5, karayolu: 7.5, yol: 7.5, demiryolu: 8.0, dere: 6.5, bina: 3.5, agac: 2.5, telekom: 2.5, enerji: 2.5 }
  },
  horizontal: { AG: { bina: 1.0 }, OG: { bina: 2.0 }, ENH: { bina: 3.0 } }
};
const crossingTypes = [
  ['karayolu', 'Karayolu'], ['yol', 'Yol / sokak'], ['dere', 'Dere / kanal'], ['bina', 'Bina'], ['telekom', 'Telekom hattı'],
  ['enerji', 'Başka enerji hattı'], ['demiryolu', 'Demiryolu'], ['agac', 'Ağaç'], ['arazi', 'Arazi (zemin)'], ['yerlesim', 'Yerleşim yeri zemini']
].map(([id, label]) => ({ id, label }));

// Lejant.dxf katman / ACI eşlemesi
const legend = {
  layers: [
    { key: 'AG', layer: 'ELEKTRIK-HAT-AG', aci: 84, color: '#1f7f00', screen: '#7ee08a', width: 2, lt: 'CONTINUOUS' },
    { key: 'OG', layer: 'ELEKTRIK-HAT-OG', aci: 1, color: '#ff0000', screen: '#ff8a8a', width: 4, lt: 'CONTINUOUS' },
    { key: 'AYD', layer: 'ELEKTRIK-HAT-AYD', aci: 4, color: '#00ffff', screen: '#7fffff', width: 2, lt: 'CONTINUOUS' },
    { key: 'ENH', layer: 'ELEKTRIK-HAT-ENH', aci: 6, color: '#ff00ff', screen: '#ff9aff', width: 4, lt: 'CONTINUOUS' },
    { key: 'ABONE', layer: 'ELEKTRIK-HAT-ABONE', aci: 84, color: '#1f7f00', screen: '#fbbf24', width: 1.4, lt: 'DASHED' },
    { key: 'YERALTI', layer: 'ELEKTRIK-KABLO', aci: 1, color: '#ff0000', screen: '#ff8a8a', width: 4, lt: 'DASHDOT' },
    { key: 'DIREK-AG', layer: 'ELEKTRIK-DIREK-AG', aci: 120, aciNew: 108, aciDmm: 3 },
    { key: 'DIREK-OG', layer: 'ELEKTRIK-DIREK-OG', aci: 16, aciNew: 10, aciDmm: 1 },
    { key: 'DIREK-AYD', layer: 'ELEKTRIK-DIREK-AYD', aci: 190, aciNew: 152, aciDmm: 4 },
    { key: 'DIREK-ENH', layer: 'ELEKTRIK-DIREK-ENH', aci: 6, aciNew: 6, aciDmm: 6 },
    { key: 'TRAFO', layer: 'ELEKTRIK-TRAFO', aci: 5 },
    { key: 'SDK', layer: 'ELEKTRIK-SDK', aci: 5 },
    { key: 'TOPRAK', layer: 'ELEKTRIK-TOPRAKLAMA', aci: 32 },
    { key: 'DEMONTAJ', layer: 'ELEKTRIK-DEMONTAJ', aci: 2 },
    { key: 'YAZI', layer: 'ELEKTRIK-YAZI', aci: 7 },
    { key: 'OLCU', layer: 'OLCU-NOKTA', aci: 7 }
  ],
  poleColors: {
    AG: { MEVCUT: '#00ffbf', YENI: '#23a455', DMM: '#00ff00', DEMONTAJ: '#00ffbf' },
    OG: { MEVCUT: '#d94a4a', YENI: '#ff0000', DMM: '#ff0000', DEMONTAJ: '#d94a4a' },
    AYD: { MEVCUT: '#9b5cff', YENI: '#2f7fd6', DMM: '#00ffff', DEMONTAJ: '#9b5cff' },
    ENH: { MEVCUT: '#ff00ff', YENI: '#ff00ff', DMM: '#ff00ff', DEMONTAJ: '#ff00ff' }
  },
  kesit: { MEVCUT: '({t})', YENI: '{t}', ILERIDE: '<{t}>', DMM: '[{t}]' },
  lamps: [{ n: 'Cıva buharlı', m: 'r', y: 'X' }, { n: 'Sodyum buharlı', m: 'h', y: 'C' }, { n: 'LED', m: 'z', y: 'q' }, { n: 'Floresan', m: 'Z', y: 'Z' }]
};

// Malzeme ana listesi (poz karşılığı olmayan yardımcı kalemler → Tanımlar'dan poz eşlenir)
const materialsMaster = [
  ['KANAL_TOPRAK', 'Toprak kablo kanalı (kazı + dolgu)', 'm'], ['KANAL_BETON', 'Beton kablo kanalı', 'm'], ['KANAL_BORULU', 'Borulu kablo kanalı', 'm'],
  ['DIREK_INISI', 'Direk inişi (kablo çıkış donanımı)', 'Ad'], ['DUVAR_GECISI', 'Duvar geçişi', 'Ad'], ['KUM', 'Kablo kumu', 'm³'], ['UYARI_BANDI', 'Plastik uyarı bandı', 'm'],
  ['KORUMA_PLAKASI', 'Kablo koruma plakası', 'Ad'], ['BETON', 'Kanal betonu', 'm³'], ['BORU_110', 'Ø110 koruge boru', 'm'], ['BORU_125', 'Ø125 koruge boru', 'm'], ['BORU_160', 'Ø160 koruge boru', 'm'], ['BORU_200', 'Ø200 koruge boru', 'm'],
  ['MENHOL', 'Kablo menholü', 'Ad'], ['MUF_OG', 'OG ek mufu', 'Ad'], ['MUF_AG', 'AG ek mufu', 'Ad'], ['BASLIK_OG', 'OG kablo başlığı', 'Ad'], ['BASLIK_AG', 'AG kablo başlığı', 'Ad']
].map(([key, label, unit]) => ({ key, label, unit, servis: null }));
const cableRules = { verified: false, minDepth: { AG: 0.7, OG: 0.9 }, note: 'Asgari kanal derinliği (m) — şartname ile doğrulayın' };

const standard = {
  id: STD, code: '2026', name: 'Poz kataloğu 2026', book: '2026', bfYear: 2026,
  validFrom: '2026-01-01', validTo: '2026-12-31', status: 'active', createdAt: '2026-09-26T00:00:00Z',
  notes: 'Poz / servis kodları, direk tipleri, iletken ağırlıkları ve reçete kuralları 2026 birim fiyat kitabından ve saha maketinden aktarıldı. İletken mekanik değerleri, ENH yük varsayımları, açıklık tabloları ve trafo güç uyumu "doğrulanmamış varsayılan" olarak işaretlidir.',
  unverifiedTables: ['conductors.mech', 'enh', 'clearances', 'trafoPostTypes', 'trafoPoleCompat', 'poleTypes.capacityDaN', 'cableRules', 'materialsMaster']
};

const out = {
  format: 'volt-standard/1', standard,
  poz: [...poz.values()].sort((a, b) => a.servis.localeCompare(b.servis)),
  poleGroups, poleTypes, conductors, lineTypes, lineDefaults: raw.DEF,
  transformers, panels, kiosks, kioskDefaults: raw.P9_KOSKDEF, trafoPostTypes, trafoPoleCompat,
  sdkTypes, recipeRules: rules, params, gnssThresholds, enh, clearances, legend, materialsMaster, cableRules
};
fs.mkdirSync(path.join(root, 'web/seed'), { recursive: true });
applyExtras(out);   // v2.3 ekleri (hd hücre, LED armatür, kofre, kabin eşlemesi)
fs.writeFileSync(path.join(root, 'web/seed/standard-tedas-2026.json'), JSON.stringify(out));
console.log('poz', out.poz.length, 'poleTypes', poleTypes.length, 'conductors', conductors.length, 'lineTypes', lineTypes.length,
  'transformers', transformers.length, 'panels', panels.length, 'kiosks', kiosks.length, 'rules', rules.length,
  'size', fs.statSync(path.join(root, 'web/seed/standard-tedas-2026.json')).size);
