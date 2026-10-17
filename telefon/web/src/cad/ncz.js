// Netcad NCZ (ikili) okuyucu → birleşik CAD modeli (bkz. index.js).
// Özgün tek dosyalık NCZ→DXF dönüştürücüdeki sezgisel okuyucunun portu. Okuyucu kayıt uzunluklarına
// güvenmez: kayıt başını doğrulayarak (validRec) ilerler, tutmazsa bayt bayt yeniden eşitlenir (resync).
//
// Dosya düzeni (little-endian; metinler Pascal dizgisi: u8 uzunluk + windows-1254 baytları):
//   0x00 u8  = 1 (imza)          0x05 u32 dosya boyu
//   0x0D u32 tabaka tablosu      0x2D u32 nesne bölümü başı
// Nesne kaydı (p = kayıt başı; 8.x düzeninde TLV etiketi 0x15, p+1 u32 uzunluk):
//   p+6 u8 tip   p+7 u8 tabaka no   p+8 f64 KUZEY (y)   p+16 f64 DOĞU (x)   p+24 f64 Z
//   p+50 f64×4 sınır kutusu: minK, minD, maxK, maxD      kuyruk: p+86 (eski düzen p+114)
//   tip 1 nokta, 2 doğru, 3 daire, 4 yay, 5 yazı, 6 sembol, 7 çoklu doğru, 0x0E son
//
// Özgün okuyucuya göre farklar:
//  - Yay: ikinci açı alanı için bitiş açısı / süpürme yorumlarından sınır kutusuna uyan seçilir (sezgisel)
//  - Tip 1 nokta kayıtları (ad + Z) okunur
//  - Semboller KNOWN_SYMBOLS tablosundan ilkel nesnelere patlatılır; her sembol konumu ayrıca nokta olur
// NCZ'den renk okunmaz: tüm nesneler ve tabakalar ACI 7'dir.

import { KNOWN_SYMBOLS } from './symbols.js';
import { toBytes, decode1254, arcBBox, entsBBox, normDeg } from './dxf.js';

const DEG = 180 / Math.PI;
const DOMS = [27, 30, 33, 36, 39, 42, 45];
const GEO_TYPES = new Set([0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

function makeReader(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = u8.byteLength;
  return {
    n, u8,
    b: (o) => (o >= 0 && o < n ? u8[o] : -1),
    u16: (o) => (o >= 0 && o + 2 <= n ? dv.getUint16(o, true) : 0),
    u32: (o) => (o >= 0 && o + 4 <= n ? dv.getUint32(o, true) : 0),
    f32: (o) => (o >= 0 && o + 4 <= n ? dv.getFloat32(o, true) : NaN),
    f64: (o) => (o >= 0 && o + 8 <= n ? dv.getFloat64(o, true) : NaN),
    slice: (a, b2) => u8.subarray(Math.max(0, a), Math.max(0, b2)),
  };
}

function plaus(v, lim) {
  lim = lim || 1e7;
  if (!Number.isFinite(v) || v <= -lim || v >= lim) return false;
  if (v !== 0 && Math.abs(v) < 1e-100) return false; // denormal çöp
  return true;
}

function bboxOf(r, p) {
  const y1 = r.f64(p + 50), x1 = r.f64(p + 58), y2 = r.f64(p + 66), x2 = r.f64(p + 74);
  if (!(plaus(y1, 1e8) && plaus(x1, 1e8) && plaus(y2, 1e8) && plaus(x2, 1e8))) return null;
  if (!(y1 <= y2 + 1e-6 && x1 <= x2 + 1e-6)) return null;
  return [y1, x1, y2, x2];
}
const inBB = (vy, vx, bb, m) => bb[0] - m <= vy && vy <= bb[2] + m && bb[1] - m <= vx && vx <= bb[3] + m;
const bbMargin = (bb) => Math.max(1, 0.02 * Math.max(bb[2] - bb[0], bb[3] - bb[1]));

// Nokta kaydı (tip 1) — yazıcı düzeninden: iki tip baytı da 1, sınır kutusu noktanın kendisine çökük
// (±1e-3 içinde). Tip baytı 1 çok sık rastlanan bir değer olduğundan doğrulama bilerek sıkı tutulur.
function validPoint(r, pos) {
  if (pos + 87 > r.n) return false;
  if (r.b(pos + 5) !== 1 || r.b(pos + 6) !== 1) return false;
  const y = r.f64(pos + 8), x = r.f64(pos + 16), z = r.f64(pos + 24);
  if (!plaus(y, 1e8) || !plaus(x, 1e8) || !plaus(z, 1e6)) return false;
  const bb = bboxOf(r, pos);
  if (!bb) return false;
  if (Math.abs(bb[0] - y) > 1e-3 || Math.abs(bb[2] - y) > 1e-3 || Math.abs(bb[1] - x) > 1e-3 || Math.abs(bb[3] - x) > 1e-3) return false;
  if (x === 0 && y === 0 && bb[0] === 0 && bb[1] === 0 && bb[2] === 0 && bb[3] === 0) return false; // sıfır dolgusu
  return true;
}

function validRec(r, pos) {
  if (pos + 82 > r.n) return false;
  const typ = r.b(pos + 6);
  if (typ === 1) return validPoint(r, pos);
  if (!GEO_TYPES.has(typ)) return false;
  const y = r.f64(pos + 8), x = r.f64(pos + 16);
  if (!plaus(y, 1e8) || !plaus(x, 1e8)) return false;
  return bboxOf(r, pos) !== null;
}
function resync(r, pos) {
  while (pos < r.n - 8) { if (validRec(r, pos)) return pos; pos++; }
  return r.n;
}

/* Kuyruk konumu iki düzende olabilir: yeni +86, eski +114 (28B ek öznitelik). Gruplu kayıtlarda
   @etiket sonrası dolgu taranır. Her aday tip-özel yapı doğrulamasından geçirilir. */
function findTail(r, p, typ) {
  const n = r.n;
  const bb = bboxOf(r, p);
  function validAt(t) {
    if (t + 34 > n) return false;
    if (typ === 0x02) {
      const y2 = r.f64(t), x2 = r.f64(t + 8);
      return plaus(y2) && plaus(x2) && bb !== null &&
        bb[0] - 1e-3 <= y2 && y2 <= bb[2] + 1e-3 && bb[1] - 1e-3 <= x2 && x2 <= bb[3] + 1e-3;
    } else if (typ === 0x03) {
      const rad = r.f64(t);
      return bb !== null && rad > 0 && rad < 1e6 && Math.abs((bb[2] - bb[0]) / 2 - rad) < Math.max(1e-3, rad * 0.01);
    } else if (typ === 0x04) {
      const rad = r.f64(t), a1 = r.f64(t + 18), a2 = r.f64(t + 26);
      return rad > 0 && rad < 1e6 && Number.isFinite(a1) && Number.isFinite(a2) && Math.abs(a1) < 7 && Math.abs(a2) < 7;
    } else if (typ === 0x05) {
      const h = r.f32(t), rot = r.f32(t + 4);
      return h > 1e-6 && h < 1e5 && Math.abs(rot) < 7 && r.b(t + 10) <= 1 && r.b(t + 11) > 0 && r.b(t + 11) <= 200;
    } else if (typ === 0x06) {
      const sc = r.f32(t), rot = r.f32(t + 4), sym = r.u16(t + 8);
      return sc > 0 && sc < 1e4 && Math.abs(rot) < 7 && sym < 10000;
    } else if (typ === 0x07) {
      const vy = r.f64(t + 27), vx = r.f64(t + 35);
      if (!plaus(vy) || !plaus(vx) || bb === null) return false;
      const m = bbMargin(bb);
      return bb[0] - m <= vy && vy <= bb[2] + m && bb[1] - m <= vx && vx <= bb[3] + m;
    }
    return false;
  }
  if (validAt(p + 86)) return p + 86;
  if (validAt(p + 114)) return p + 114;
  // Gruplu kayıt (@etiket): yeni düzen +97, eski düzen +125.
  // Etiket tamamen yazdırılabilir ASCII olmalı (rastgele bayt tuzağına düşme).
  for (const lp of [97, 125]) {
    const tl = p + lp + 1 < n ? r.b(p + lp) : 0;
    if (tl >= 4 && tl <= 40 && r.b(p + lp + 1) === 0x40) {
      let printable = true;
      for (let k = 1; k < tl; k++) {
        const cc = r.b(p + lp + 1 + k);
        if (cc < 32 || cc > 126) { printable = false; break; }
      }
      if (!printable) continue;
      const labelEnd = p + lp + 1 + tl;
      for (let gap = 0; gap < 15; gap++) {
        if (validAt(labelEnd + gap)) return labelEnd + gap;
      }
    }
  }
  return null;
}

// Tabaka tablosu: 29 baytlık adımlarla Pascal dizgisi zinciri; en uzun zincir kazanır. İndeks = tabaka no.
function parseLayers(r, ptr) {
  let best = [];
  for (let start = ptr; start < Math.min(ptr + 400, r.n - 29); start++) {
    const chain = [];
    let pos = start;
    while (pos + 29 <= r.n) {
      const ln = r.b(pos);
      if (!(ln > 0 && ln < 28)) break;
      const raw = r.slice(pos + 1, pos + 1 + ln);
      let ok = true;
      for (let i = 0; i < raw.length; i++) if (raw[i] < 0x20) { ok = false; break; }
      if (!ok) break;
      chain.push(decode1254(raw));
      pos += 29;
    }
    if (chain.length > best.length) best = chain;
  }
  return best;
}

/* Yay açıları (SEZGİSEL). Kayıtta t+18 başlangıç açısı (radyan, doğudan saat yönü tersine), t+26 ikinci açı.
   Özgün okuyucu ikinci açıyı BİTİŞ açısı sayar; aynı aracın Netcad 8.5 yazıcısı aynı alana SÜPÜRME
   (bitiş = başlangıç + süpürme) yazar. Dosyadan hangisinin doğru olduğu kesin bilinemediği için iki aday
   yayın sınır kutusu kaydın saklı kutusuyla (p+50…p+82) karşılaştırılır ve daha iyi uyan seçilir.
   Kutular ayırt edilemiyorsa ya da hiçbiri uymuyorsa süpürme yorumu kullanılır. */
export function nczArcAngles(cx, cy, rad, a1Rad, v2Rad, bb) {
  const a1 = a1Rad * DEG, v2 = v2Rad * DEG;
  const end = { a1: normDeg(a1), a2: normDeg(v2), full: false };
  // Süpürme 0 olamaz (yazıcı tam daireyi 2π yazar): bu durumda yalnız bitiş açısı yorumu anlamlıdır
  if (Math.abs(v2) < 1e-9) { end.full = end.a1 === end.a2; return end; }
  const sweep = {
    a1: normDeg(v2 >= 0 ? a1 : a1 + v2),
    a2: normDeg(v2 >= 0 ? a1 + v2 : a1),
    full: Math.abs(v2) >= 360 - 1e-7,
  };
  if (!bb) return sweep;
  const err = (c) => {
    const b = c.full ? [cx - rad, cy - rad, cx + rad, cy + rad] : arcBBox(cx, cy, rad, c.a1, c.a2);
    // bb = [minK, minD, maxK, maxD]; b = [minX(D), minY(K), maxX, maxY]
    return Math.abs(b[1] - bb[0]) + Math.abs(b[0] - bb[1]) + Math.abs(b[3] - bb[2]) + Math.abs(b[2] - bb[3]);
  };
  const eS = err(sweep), eE = err(end);
  const tol = Math.max(1e-3, rad * 0.02);
  if (eE <= tol && eS > 2 * eE + 1e-6 && eS > tol * 0.5) return end;
  return sweep;
}

function parseRecords(r, start) {
  const ents = [];
  const n = r.n;
  let resyncs = 0;
  let pos = resync(r, start);
  while (pos < n - 8) {
    const p = pos;
    const typ = r.b(p + 6);
    const layer = r.b(p + 7);
    let adv = null;
    if (typ === 1) {
      // Nokta: ad p+86'da Pascal dizgisi (yazıcıda en çok 22 karakter), Z p+24'te
      const nl = r.b(p + 86);
      let nm = '';
      if (nl > 0 && nl <= 32 && p + 87 + nl <= n) {
        const raw = r.slice(p + 87, p + 87 + nl);
        let ok = true;
        for (let i = 0; i < raw.length; i++) if (raw[i] < 0x20 || raw[i] === 0x7F) { ok = false; break; }
        if (ok) nm = decode1254(raw).replace(/\s+$/, '');
      }
      ents.push({ t: 'POINT', layer, x: r.f64(p + 16), y: r.f64(p + 8), z: r.f64(p + 24), name: nm });
      const len = r.b(p) === 0x15 ? r.u32(p + 1) : 0;
      adv = len >= 82 && len <= 512 ? 5 + len : 87 + (nm ? nl : 0);
    } else {
      const t = findTail(r, p, typ);
      if (t !== null) {
        if (typ === 0x02) {
          const y1 = r.f64(p + 8), x1 = r.f64(p + 16), y2 = r.f64(t), x2 = r.f64(t + 8);
          const bb = bboxOf(r, p);
          if (plaus(x1) && plaus(y1) && plaus(x2) && plaus(y2) && bb) {
            const m = bbMargin(bb);
            if (inBB(y1, x1, bb, m) && inBB(y2, x2, bb, m)) ents.push({ t: 'LINE', layer, x1, y1, x2, y2 });
          }
          adv = (t + 20) - p;
        } else if (typ === 0x03) {
          const cy = r.f64(p + 8), cx = r.f64(p + 16), rad = r.f64(t);
          const bb = bboxOf(r, p);
          if (plaus(cx) && plaus(cy) && rad > 0 && rad < 1e6 && bb &&
            Math.abs((bb[2] - bb[0]) / 2 - rad) < Math.max(0.5, rad * 0.05)) ents.push({ t: 'CIRCLE', layer, cx, cy, r: rad });
          adv = (t + 8) - p;
        } else if (typ === 0x04) {
          const cy = r.f64(p + 8), cx = r.f64(p + 16), rad = r.f64(t);
          const bb = bboxOf(r, p);
          if (plaus(cx) && plaus(cy) && rad > 0 && rad < 1e6 && bb && inBB(cy, cx, bb, rad + bbMargin(bb))) {
            const an = nczArcAngles(cx, cy, rad, r.f64(t + 18), r.f64(t + 26), bb);
            if (an.full) ents.push({ t: 'CIRCLE', layer, cx, cy, r: rad });
            else ents.push({ t: 'ARC', layer, cx, cy, r: rad, a1: an.a1, a2: an.a2 });
          }
          adv = (t + 34) - p;
        } else if (typ === 0x05) {
          const iy = r.f64(p + 8), ix = r.f64(p + 16);
          const h = r.f32(t), rotRad = r.f32(t + 4);
          const tl = r.b(t + 11);
          const rawTxt = r.slice(t + 12, t + 12 + tl);
          let ctrl = 0;
          for (let ci = 0; ci < rawTxt.length; ci++) { const cc = rawTxt[ci]; if (cc < 32 && cc !== 9) ctrl++; }
          // eslint-disable-next-line no-control-regex
          const txt = decode1254(rawTxt).replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+$/, '');
          const bb = bboxOf(r, p);
          if (ctrl === 0 && plaus(ix) && plaus(iy) && h > 1e-6 && h < 1e5 && Math.abs(rotRad) < 7 && txt && !txt.startsWith('@') &&
            bb && inBB(iy, ix, bb, bbMargin(bb) + h * 2)) ents.push({ t: 'TEXT', layer, x: ix, y: iy, h, rot: normDeg(rotRad * DEG), txt });
          adv = (t + 12 + tl) - p;
        } else if (typ === 0x06) {
          const iy = r.f64(p + 8), ix = r.f64(p + 16);
          const sc = r.f32(t), rotRad = r.f32(t + 4), sym = r.u16(t + 8);
          const bb = bboxOf(r, p);
          if (plaus(ix) && plaus(iy) && sc > 0 && sc < 1e4 && Math.abs(rotRad) < 7 && sym < 10000 && bb && inBB(iy, ix, bb, bbMargin(bb))) {
            ents.push({ t: 'INSERT', layer, x: ix, y: iy, sc, rot: rotRad * DEG, sym });
          }
          adv = (t + 11) - p;
        } else if (typ === 0x07) {
          const verts = [];
          let q = t + 27;
          const bb = bboxOf(r, p);
          const m = bb ? bbMargin(bb) : 1;
          while (q + 24 <= n) {
            if (validRec(r, q)) break;
            const vy = r.f64(q), vx = r.f64(q + 8);
            if (!plaus(vx) || !plaus(vy)) break;
            if (bb && !inBB(vy, vx, bb, m)) break;
            verts.push(vx, vy);
            q += 24;
          }
          adv = q - p;
          if (verts.length >= 4) ents.push({ t: 'POLYLINE', layer, verts });
        }
      }
    }
    if (adv === null || adv < 8) { resyncs++; pos = resync(r, p + 1); } else {
      pos = p + adv;
      if (pos < n - 8 && !validRec(r, pos)) { resyncs++; pos = resync(r, pos); }
    }
  }
  return { ents, resyncs };
}

// Projeksiyon meta verisi (Netcad 7.x+ WKT): "Central_Meridian" sonrasındaki sayı
function findDom(u8) {
  const pat = [0x43, 0x65, 0x6e, 0x74, 0x72, 0x61, 0x6c, 0x5f, 0x4d, 0x65, 0x72, 0x69, 0x64, 0x69, 0x61, 0x6e];
  const lim = Math.min(u8.length, 2000000) - 16;
  for (let i = u8.indexOf(0x43); i >= 0 && i < lim; i = u8.indexOf(0x43, i + 1)) {
    let ok = true;
    for (let k = 1; k < 16; k++) if (u8[i + k] !== pat[k]) { ok = false; break; }
    if (!ok) continue;
    let s = '';
    for (let k = i + 16; k < i + 64 && k < u8.length; k++) {
      const c = u8[k];
      if ((c >= 48 && c <= 57) || c === 46 || c === 45) s += String.fromCharCode(c);
      else if (s.length > 0) break;
    }
    const v = Math.round(parseFloat(s));
    if (DOMS.indexOf(v) >= 0) return v;
  }
  return null;
}

// Aykırı değer filtresi: nesnelerin %90'ının olduğu bölgeden aşırı uzak olanları at
function dropOutliers(ents, warnings) {
  if (ents.length <= 20) return ents;
  const refPt = (e) => {
    if (e.t === 'LINE') return [(e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2];
    if (e.cx !== undefined) return [e.cx, e.cy];
    if (e.x !== undefined) return [e.x, e.y];
    return [e.verts[0], e.verts[1]];
  };
  const pts = ents.map(refPt);
  const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
  const ys = pts.map((p) => p[1]).sort((a, b) => a - b);
  const q = (arr, f) => arr[Math.floor(f * (arr.length - 1))];
  const x1 = q(xs, 0.05), x2 = q(xs, 0.95), y1 = q(ys, 0.05), y2 = q(ys, 0.95);
  const diag = Math.hypot(x2 - x1, y2 - y1) || 1;
  const m = 2.5 * diag;
  const kept = [];
  for (let i = 0; i < ents.length; i++) {
    const p2 = pts[i];
    if (p2[0] >= x1 - m && p2[0] <= x2 + m && p2[1] >= y1 - m && p2[1] <= y2 + m) kept.push(ents[i]);
  }
  if (kept.length !== ents.length) {
    warnings.push((ents.length - kept.length) + ' aykırı nesne (çizim bölgesinden çok uzakta, muhtemelen bozuk kayıt) atlandı.');
  }
  return kept;
}

export function parseNCZ(src) {
  const r = makeReader(toBytes(src));
  const warnings = [];
  if (r.b(0) !== 0x01) warnings.push('Dosya başlığı beklenen Netcad imzasında değil — sonuç eksik olabilir.');
  const fsize = r.u32(5);
  if (fsize !== r.n) warnings.push('Başlıktaki boyut (' + fsize + ') dosya boyutuyla (' + r.n + ') uyuşmuyor.');
  const layerNames = parseLayers(r, r.u32(0x0d));
  const dom = findDom(r.u8);
  const raw = dropOutliers(parseRecords(r, r.u32(0x2d)).ents, warnings);

  const ents = [], layers = [], stats = {}, lmap = new Map(), unknown = new Set();
  const lid = (id) => {
    let i = lmap.get(id);
    if (i === undefined) {
      i = layers.length;
      const nm = id >= 0 && id < layerNames.length ? String(layerNames[id]).trim() : '';
      layers.push({ name: nm || 'LAYER_' + id, aci: 7 });
      lmap.set(id, i);
    }
    return i;
  };
  for (let i = 0; i < raw.length; i++) {
    const e = raw[i], l = lid(e.layer), c = 7;
    stats[e.t] = (stats[e.t] || 0) + 1;
    switch (e.t) {
      case 'LINE': ents.push({ t: 'L', l, c, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 }); break;
      case 'CIRCLE': ents.push({ t: 'C', l, c, x: e.cx, y: e.cy, r: e.r }); break;
      case 'ARC': ents.push({ t: 'A', l, c, x: e.cx, y: e.cy, r: e.r, a1: e.a1, a2: e.a2 }); break;
      case 'TEXT': ents.push({ t: 'T', l, c, x: e.x, y: e.y, h: e.h, rot: e.rot, s: e.txt }); break;
      case 'POLYLINE': ents.push({ t: 'P', l, c, v: e.verts, closed: false }); break;
      case 'POINT': {
        const o = { t: 'N', l, c, x: e.x, y: e.y, z: e.z };
        if (e.name) o.name = e.name;
        ents.push(o);
        break;
      }
      case 'INSERT': {
        // Sembol: konum noktası + tablodaki geometri (yoksa 0.4×ölçek yarıçaplı daire)
        ents.push({ t: 'N', l, c, x: e.x, y: e.y, sym: e.sym });
        const def = KNOWN_SYMBOLS[e.sym];
        const sc = e.sc, cr = Math.cos(e.rot / DEG), sr = Math.sin(e.rot / DEG);
        const tx = (px, py) => e.x + sc * (px * cr - py * sr), ty = (px, py) => e.y + sc * (px * sr + py * cr);
        if (!def) {
          unknown.add(e.sym);
          ents.push({ t: 'C', l, c, x: e.x, y: e.y, r: 0.4 * sc });
          break;
        }
        for (let k = 0; k < def.length; k++) {
          const pr = def[k];
          if (pr[0] === 'L') ents.push({ t: 'L', l, c, x1: tx(pr[1], pr[2]), y1: ty(pr[1], pr[2]), x2: tx(pr[3], pr[4]), y2: ty(pr[3], pr[4]) });
          else if (pr[0] === 'C') ents.push({ t: 'C', l, c, x: tx(pr[1], pr[2]), y: ty(pr[1], pr[2]), r: pr[3] * sc });
          else if (pr[0] === 'A') ents.push({ t: 'A', l, c, x: tx(pr[1], pr[2]), y: ty(pr[1], pr[2]), r: pr[3] * sc, a1: normDeg(pr[4] + e.rot), a2: normDeg(pr[5] + e.rot) });
          else if (pr[0] === 'P') {
            const v = [];
            for (const q of pr[1]) v.push(tx(q[0], q[1]), ty(q[0], q[1]));
            ents.push({ t: 'P', l, c, v, closed: false });
          }
        }
        break;
      }
      default:
    }
  }
  if (unknown.size) warnings.push('Tanımı bilinmeyen sembol no: ' + [...unknown].sort((a, b) => a - b).join(', ') + ' — yer tutucu (daire) olarak gösterildi.');
  if (raw.length === 0) warnings.push('Hiç nesne çözülemedi. Bu dosya farklı bir Netcad sürümünden olabilir.');
  return { format: 'NCZ', ents, layers, bbox: entsBBox(ents), dom, warnings, stats };
}
