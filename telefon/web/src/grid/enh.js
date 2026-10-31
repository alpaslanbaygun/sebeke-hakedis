// ENH / havai hat mekanik hesap motoru.
// Değişik haller denklemi (parabolik), ideal (ruling) açıklık, buz/rüzgar yükleri, sehim, direk yükleri,
// iletken yerden yükseklik (zemin açıklığı) kontrolü. Tüm katsayılar standart tablosundan (enh, clearances) gelir.

import { autocadDevresi, circuitParts } from './lines.js';

const G = 0.981; // 1 kg = 0.981 daN

export function specificLoads(mech, kgPerKm, zone, enh) {
  const A = mech.A, d = mech.d;
  const w0 = (kgPerKm / 1000) * G;                       // daN/m öz ağırlık
  const wIce = zone.iceK > 0 ? zone.iceK * Math.sqrt(d) * G : 0; // daN/m buz (k·√d kg/m)
  const c = (enh.windC.find(([lim]) => d < lim) || [0, 1])[1];
  const qw = (enh.windQ * c * d) / 1000;                   // daN/m rüzgar (c·q·d)
  return { w0, wIce, qw, c, g0: w0 / A, gIce: (w0 + wIce) / A, gWind: Math.hypot(w0, qw) / A, A, d };
}

// σ2 çözümü: σ2²(σ2 − σ1 + a²γ1²E/(24σ1²) + αE(t2−t1)) = a²γ2²E/24
export function changeOfState(s1, g1, t1, g2, t2, a, E, alpha) {
  const K = -s1 + (a * a * g1 * g1 * E) / (24 * s1 * s1) + alpha * E * (t2 - t1);
  const M = (a * a * g2 * g2 * E) / 24;
  let s = Math.max(s1, 0.5);
  for (let i = 0; i < 60; i++) {
    const f = s * s * s + K * s * s - M, df = 3 * s * s + 2 * K * s;
    const ds = f / (df || 1e-9);
    s -= ds;
    if (s <= 0) s = 1e-3;
    if (Math.abs(ds) < 1e-9) break;
  }
  return s;
}
export const rulingSpan = (spans) => { const s3 = spans.reduce((x, a) => x + a ** 3, 0), s1 = spans.reduce((x, a) => x + a, 0); return s1 ? Math.sqrt(s3 / s1) : 0; };
export function sag(a, gamma, sigma, dH = 0) { const cosPsi = a / Math.hypot(a, dH || 0); return (a * a * gamma) / (8 * sigma * cosPsi); }
export function criticalSpan(sMax, alpha, tIce, tMin, gIce, g0) {
  const den = gIce * gIce - g0 * g0; if (den <= 0) return Infinity;
  return sMax * Math.sqrt((24 * alpha * (tIce - tMin)) / den);
}

// Bir germe bölümü için durum hesapları
export function sectionStates(spansA, mech, kgPerKm, zone, enh) {
  const L = specificLoads(mech, kgPerKm, zone, enh);
  const ar = rulingSpan(spansA);
  const sMax = ((enh.maxStressPctRTS / 100) * mech.rts) / mech.A; // daN/mm²
  const states = [
    { id: 'S1', label: zone.tMin + '°C buzsuz', t: zone.tMin, g: L.g0 },
    { id: 'S2', label: enh.iceTemp + '°C buzlu', t: enh.iceTemp, g: zone.iceK > 0 ? L.gIce : L.g0 },
    { id: 'S3', label: '+' + enh.windTemp + '°C rüzgarlı', t: enh.windTemp, g: L.gWind },
    { id: 'S4', label: '+' + zone.tMax + '°C (en büyük sehim)', t: zone.tMax, g: L.g0 },
    { id: 'S5', label: '+15°C (EDS)', t: 15, g: L.g0 }
  ];
  // Yönetici durum: σmax'ı yalnız birinde sağlayıp diğerlerini aşmayan referans
  let best = null;
  for (const ref of states.slice(0, 3)) {
    const sig = states.map((s) => (s.id === ref.id ? sMax : changeOfState(sMax, ref.g, ref.t, s.g, s.t, ar, mech.E, mech.alpha)));
    const worst = Math.max(...sig.slice(0, 3));
    if (worst <= sMax * 1.0005) { best = { ref, sig }; break; }
    if (!best || worst < best.worst) best = { ref, sig, worst };
  }
  const out = states.map((s, i) => Object.assign({}, s, { sigma: best.sig[i], T: best.sig[i] * mech.A }));
  const eds = out[4].sigma * mech.A / mech.rts * 100;
  return { loads: L, ar, sMax, governing: best.ref.id, states: out, edsPct: eds, edsOk: eds <= enh.edsPctRTS + 1e-6, aCrit: criticalSpan(sMax, mech.alpha, enh.iceTemp, zone.tMin, L.gIce, L.g0) };
}

// Direk bağlantı (en alt iletken) yüksekliği — tip boyundan: gömme = L/10 + 0.6 m, travers altı 0.6 m
export function attachmentHeight(pole, heightM) {
  if (pole && pole.attrs && pole.attrs.attachH) return +pole.attrs.attachH;
  if (!heightM) return null;
  return heightM - (heightM / 10 + 0.6) - 0.6;
}

// Hat bazında tam ENH analizi
export function analyzeLine({ line, spans, poles, pointsById, roles, cat, zoneId, enh, clearances, landClass }) {
  const circ = (line.circuits || []).find((c) => c.role === 'OG' || c.role === 'ENH') || (line.circuits || [])[0];
  if (!circ) return { error: 'Hatta iletken tanımlı değil' };
  // AutoCAD kataloğundaki çıplak iletken (4xSW, 3A+P+R…): tel açılımındaki faz iletkeni (en çok teli olan) hesaplanır
  const ac = autocadDevresi(circ);
  let part = null;
  if (ac) { const cp = circuitParts(circ, cat); if (cp && cp.unit === 'kg') part = cp.parts.reduce((a, b) => (b.count > a.count ? b : a)); }
  else { const lt = cat.lineType(circ.key); part = lt ? lt.parts[0] : null; }
  const cd = part ? cat.conductor(part.conductor) : null;
  if (!cd || !cd.mech) return { error: 'İletken mekanik verisi yok (' + (ac ? ac.tanim : circ.key || '?') + ') · yalnız çıplak ACSR/AAC için hesaplanır' };
  const zone = enh.zones.find((z) => z.id === zoneId) || enh.zones[1];
  const nCond = (part.count || 3) * (circ.count || 1);
  const ordered = spans.filter((s) => s.lineId === line.id).sort((a, b) => a.seq - b.seq);
  if (!ordered.length) return { error: 'Açıklık yok' };
  // Germe bölümleri: T olmayan direklerde bölünür
  const sections = []; let cur = [];
  ordered.forEach((s, i) => {
    cur.push(s);
    const toPole = poles.find((p) => p.pointId === s.toId);
    const r = toPole ? (roles.get(toPole.id) || {}).role : 'N';
    if (i === ordered.length - 1 || r !== 'T') { sections.push(cur); cur = []; }
  });
  const vClass = line.lineType === 'ENH' ? 'ENH' : line.lineType === 'OG' ? 'OG' : 'AG';
  const reqGround = (clearances.vertical[vClass] || {})[landClass || 'arazi'] ?? 6;
  const spanRes = [], secRes = [];
  const tension = new Map(); // spanId → {T_wind, T_ice, T_max}
  for (const sec of sections) {
    const st = sectionStates(sec.map((s) => s.length2D), cd.mech, cd.kgPerKm, zone, enh);
    secRes.push({ from: sec[0].fromNo, to: sec[sec.length - 1].toNo, spans: sec.length, ar: st.ar, governing: st.governing, sMax: st.sMax, states: st.states, edsPct: st.edsPct, edsOk: st.edsOk, aCrit: st.aCrit, loads: st.loads });
    const S = Object.fromEntries(st.states.map((x) => [x.id, x]));
    for (const s of sec) {
      const fMax = sag(s.length2D, S.S4.g, S.S4.sigma, s.dH);
      const fIce = sag(s.length2D, S.S2.g, S.S2.sigma, s.dH);
      const pa = poles.find((p) => p.pointId === s.fromId), pb = poles.find((p) => p.pointId === s.toId);
      const ha = attachmentHeight(pa, pa && pa._heightM), hb = attachmentHeight(pb, pb && pb._heightM);
      const A = pointsById.get(s.fromId), B = pointsById.get(s.toId);
      const f = Math.max(fMax, fIce);
      let low = null, lowX = null;
      if (ha != null && hb != null && A && B) {
        const yA = (A.H ?? 0) + ha, yB = (B.H ?? 0) + hb;
        // en düşük iletken-zemin mesafesi (zemin iki direk arasında doğrusal kabul)
        for (let k = 0; k <= 40; k++) {
          const x = k / 40, y = yA + (yB - yA) * x - 4 * f * x * (1 - x), gnd = (A.H ?? 0) + ((B.H ?? 0) - (A.H ?? 0)) * x;
          if (low === null || y - gnd < low) { low = y - gnd; lowX = x * s.length2D; }
        }
      }
      const r = { spanId: s.id, from: s.fromNo, to: s.toNo, a: s.length2D, a3: s.length3D, dH: s.dH, sagMax: fMax, sagIce: fIce, Tmax: Math.max(S.S1.T, S.S2.T, S.S3.T), groundClear: low, groundClearAt: lowX, groundReq: reqGround, ok: low == null ? null : low >= reqGround, attachA: ha, attachB: hb };
      spanRes.push(r);
      tension.set(s.id, { Tw: S.S3.T, Ti: S.S2.T, T1: S.S1.T, wind: st.loads.qw, w0: st.loads.w0, wIce: st.loads.wIce });
    }
  }
  // Direk yükleri
  const poleRes = [];
  const lineNodes = line.nodes || [];
  lineNodes.forEach((pid, i) => {
    const p = poles.find((x) => x.pointId === pid); if (!p) return;
    const back = ordered.find((s) => s.toId === pid), ahead = ordered.find((s) => s.fromId === pid);
    const ab = back ? back.length2D : 0, aa = ahead ? ahead.length2D : 0;
    const tb = back ? tension.get(back.id) : null, ta = ahead ? tension.get(ahead.id) : null;
    const t = ta || tb; if (!t) return;
    const role = (roles.get(p.id) || {}).role;
    const angle = (roles.get(p.id) || {}).angle || 0;
    const windSpan = (ab + aa) / 2;
    const Hwind = nCond * t.wind * windSpan;
    const Tw = Math.max(tb ? tb.Tw : 0, ta ? ta.Tw : 0);
    const Hangle = nCond * 2 * Tw * Math.sin((angle * Math.PI / 180) / 2);
    const Hlong = role === 'N' ? nCond * Math.max(tb ? tb.T1 : 0, ta ? ta.T1 : 0, tb ? tb.Ti : 0, ta ? ta.Ti : 0) : 0;
    const V = nCond * (t.w0 + t.wIce) * windSpan;
    const Ftop = Math.hypot(Hwind + Hangle, Hlong);
    const cap = p._capacityDaN || null;
    poleRes.push({ id: p.id, no: p.no, role, angle, windSpan, V, Hwind, Hangle, Hlong, Ftop, cap, util: cap ? Ftop / cap : null, ok: cap ? Ftop <= cap : null });
  });
  return { conductor: cd.name, mech: cd.mech, kgPerKm: cd.kgPerKm, nCond, zone, sections: secRes, spans: spanRes, poles: poleRes, vClass, reqGround };
}
