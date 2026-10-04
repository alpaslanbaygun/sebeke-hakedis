// Hat sistemi: havai iletken metrajı (m / kg), yeraltı kablo + kanal metrajı, abone hattı ekleri.
// Kg hesabı gerçek iletken ağırlığı (kg/km) üzerinden yapılır.

export const LINE_TYPE_LABEL = { AG: 'AG', OG: 'OG', AYD: 'Aydınlatma', ENH: 'ENH', ABONE: 'Abone' };

// Devre tanımından parça listesi (katalog hat tipi ya da özel çıplak AG kombinasyonu 3P+R(+R))
export function circuitParts(c, cat) {
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
  return [og, ag].filter(Boolean).join(' / ');
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
        out.push({ servis: p.yd, qty: meters, unit: 'm', meters, why: c.key + ' · ' + len3D.toFixed(2) + ' m × ' + (cp.coresPerCircuit * n), conductor: p.conductor, role: c.role, missing: !p.yd, refType: 'line', refId: line.id });
      }
    }
  }
  return out;
}

// Yeraltı kablo: gerçek kablo metrajı = kanal + dikey iniş + çıkış + trafo payı + SDK payı + muf payı + rezerv
export const CABLE_DEFAULTS = { channelType: 'toprak', width: 0.4, depth: null, sandCm: 20, warningTape: 1, protectionPlate: true, plateLenM: 1.0, concreteCm: 10, pipeDia: 110, pipeCount: 0, manholes: 0, joints: null, drumM: 500, riserM: 8, exitM: 2, trafoM: 5, sdkM: 2, jointM: 1.5, reserveM: 5 };
export function cableQuantities(line, route, endKinds, cat) {
  const cfg = Object.assign({}, CABLE_DEFAULTS, line.cable || {});
  const Lc = route.length2D;
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
    const servis = cfg.channelType === 'toprak' ? (p.ydToprak || p.yd) : p.yd;
    const m = coreLen * cp.coresPerCircuit * n;
    out.push({ servis, qty: m, unit: 'm', meters: m, why: c.key + ' · ' + coreLen.toFixed(2) + ' m × ' + (cp.coresPerCircuit * n) + ' damar/devre', conductor: c.key, role: c.role, missing: !servis, refType: 'line', refId: line.id, breakdown });
  }
  // Kanal ve yardımcı malzemeler (Material anahtarları → poz eşlemesi standart tablosunda)
  const mat = (key, qty, unit, why) => { if (qty > 0) out.push({ material: key, servis: null, qty, unit, why, refType: 'line', refId: line.id }); };
  const chanKey = { toprak: 'KANAL_TOPRAK', beton: 'KANAL_BETON', borulu: 'KANAL_BORULU', direk: 'DIREK_INISI', duvar: 'DUVAR_GECISI' }[cfg.channelType] || 'KANAL_TOPRAK';
  if (line.lineType !== 'ABONE') mat(chanKey, cfg.channelType === 'direk' || cfg.channelType === 'duvar' ? 1 : Lc, cfg.channelType === 'direk' || cfg.channelType === 'duvar' ? 'Ad' : 'm', 'Kanal ' + cfg.channelType + ' · ' + cfg.width + ' × ' + (cfg.depth ?? '?') + ' m');
  if (cfg.channelType === 'toprak' || cfg.channelType === 'borulu') mat('KUM', Lc * cfg.width * cfg.sandCm / 100, 'm³', 'Kum yatağı ' + cfg.sandCm + ' cm');
  mat('UYARI_BANDI', Lc * (cfg.warningTape || 0), 'm', 'Uyarı bandı × ' + cfg.warningTape);
  if (cfg.protectionPlate) mat('KORUMA_PLAKASI', Math.ceil(Lc / cfg.plateLenM) * Math.max(1, ncirc), 'Ad', 'Koruma plakası (' + cfg.plateLenM + ' m)');
  if (cfg.channelType === 'beton') mat('BETON', Lc * cfg.width * cfg.concreteCm / 100, 'm³', 'Beton ' + cfg.concreteCm + ' cm');
  if (cfg.pipeCount > 0) mat('BORU_' + cfg.pipeDia, Lc * cfg.pipeCount, 'm', cfg.pipeCount + ' × Ø' + cfg.pipeDia + ' boru');
  mat('MENHOL', cfg.manholes || 0, 'Ad', 'Menhol');
  mat(og ? 'MUF_OG' : 'MUF_AG', joints * Math.max(1, ncirc) * (singleCore ? 3 : 1), 'Ad', 'Ek muf');
  mat(og ? 'BASLIK_OG' : 'BASLIK_AG', endKinds.length * Math.max(1, ncirc) * (singleCore ? 3 : 1), 'Ad', 'Kablo başlığı');
  return { items: out, breakdown, cfg };
}
