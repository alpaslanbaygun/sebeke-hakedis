#!/usr/bin/env node
// Lejant simge takımını üretir: ortak/katalog/semboller.json (eklentiye gömülür; telefon kopyası için
// araclar/ortak-tablolar.mjs → telefon/web/src/ortak/semboller.js).
//
// Boyutlar metre cinsinden, 1/1000 ölçekli pafta lejantına göredir (telefonun "Lejant.dxf" takımı).
// AutoCAD eklentisi de blokları metre cinsinden tanımlar ve 1 ölçekle koyar (telefonun DXF'iyle aynı boyut).
//
// İlkeller (sembol-yerel koordinat, metre):
//   ["L", x1, y1, x2, y2]        doğru
//   ["C", cx, cy, r]             daire (boş)
//   ["P", [[x, y], ...], kapali] çoklu doğru (kapali: true / false)
//   ["S", [[x,y],[x,y],[x,y],[x,y]]]  dolu dörtgen (AutoCAD SOLID köşe sırası: 1, 2, 4, 3 — "kelebek" sırası)
//   ["D", r]                     dolu daire (çapı r genişlikli kapalı yay çizgisi)
//   ["Y", r]                     yarım dolu daire (sol yarı)
//
// Kullanım: node araclar/semboller-uret.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r4 = (v) => Math.round(v * 10000) / 10000;
const pt = (p) => [r4(p[0]), r4(p[1])];

// ---- Yardımcılar ------------------------------------------------------------------------------

/** Dışbükey ya da yelpazeyle doldurulabilen çokgen: 1. köşeden yelpaze üçgenleri (telefonun DXF yazıcısıyla aynı). */
function yelpaze(kose) {
  const out = [];
  for (let i = 1; i < kose.length - 1; i++) out.push(['S', [pt(kose[0]), pt(kose[i]), pt(kose[i + 1]), pt(kose[i + 1])]]);
  return out;
}

/** Çokgeni x <= 0 yarı düzlemiyle kırpar (Sutherland–Hodgman, tek kenar). */
function solYari(kose) {
  const out = [];
  for (let i = 0; i < kose.length; i++) {
    const a = kose[i], b = kose[(i + 1) % kose.length];
    const aIc = a[0] <= 0, bIc = b[0] <= 0;
    if (aIc) out.push(a);
    if (aIc !== bIc) {
      const t = (0 - a[0]) / (b[0] - a[0]);
      out.push([0, a[1] + t * (b[1] - a[1])]);
    }
  }
  // Ardışık yinelenen köşeleri at (sınır üzerindeki köşe iki kez gelir)
  return out.filter((p, i) => i === 0 || Math.abs(p[0] - out[i - 1][0]) > 1e-9 || Math.abs(p[1] - out[i - 1][1]) > 1e-9)
    .filter((p, i, arr) => !(i === arr.length - 1 && i > 0 && Math.abs(p[0] - arr[0][0]) < 1e-9 && Math.abs(p[1] - arr[0][1]) < 1e-9));
}

/** Topraklama işareti: sembolün altından (y0) iner. Telefonun DXF yazıcısındaki GROUND ile aynı ölçüler. */
function toprak(y0) {
  const y1 = y0 - 2.1, hw = 2.35, out = [];
  out.push(['L', 0, r4(y0), 0, r4(y1)]);
  out.push(['L', -hw, r4(y1), hw, r4(y1)]);
  for (let i = 0; i < 4; i++) out.push(['L', r4(-hw + (i * hw) / 2), r4(y1 - 1.8), r4(-hw + (i * hw) / 2 + 1), r4(y1)]);
  return out;
}

const kare = (a) => { const h = a / 2; return [[-h, -h], [h, -h], [h, h], [-h, h]]; };
const dikdortgen = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
const elmas = (r) => [[0, r], [r, 0], [0, -r], [-r, 0]];

// Demontaj işaretleri: simgenin dışına belirgin taşan çizgiler (telefonun haritasındaki sarı çapraz gibi). Taşma payı
// küçük simgede 1,5 m (1 m'den küçük simgede — armatür — 0,8 m), büyükte en çok 3 m; böylece içi çarpılı kafes direkte
// de "mevcut"tan ayrılır.
//   DM     "/"   tek çapraz (demontaj)
//   KESIK  "//"  iki paralel çapraz (kesilerek demontaj)
//   SOKUK  "X"   iki çapraz (sökülerek demontaj)
const tasma = (R) => r4(R + Math.min(3, Math.max(R < 1 ? 0.8 : 1.5, R * 0.8)));
function dmIsareti(R, varyant) {
  const d = tasma(R);
  if (varyant === 'SOKUK') return [['L', -d, -d, d, d], ['L', -d, d, d, -d]];
  if (varyant === 'KESIK') {
    // Çapraza dik yönde ±h kaydırılmış iki çizgi (aralık simgenin yarısı kadar)
    const h = r4(Math.max(R < 1 ? 0.35 : 0.7, R * 0.42));
    return [['L', r4(-d - h), r4(-d + h), r4(d - h), r4(d + h)], ['L', r4(-d + h), r4(-d - h), r4(d + h), r4(d - h)]];
  }
  return [['L', -d, -d, d, d]];
}

// ---- Aileler ----------------------------------------------------------------------------------
// daire: {r, toprak}   çokgen: {kose, bosIsaret (yalnız MEVCUT'ta), herZaman (her varyantta), toprak}
const AILELER = {
  DIREK_AG: { ad: 'AG direk · beton / ağaç', daire: 2.25 },
  KAFES_AG: { ad: 'AG direk · demir (kafes)', kose: kare(4.6), bosIsaret: 'X' },
  DIREK_OG: { ad: 'OG / müşterek / ENH direk · beton', daire: 3, toprak: true },
  KAFES_OG: { ad: 'OG / müşterek / ENH direk · demir (kafes)', kose: kare(6), bosIsaret: 'X', toprak: true },
  DIREK_AYD: { ad: 'Aydınlatma direği', daire: 2 },
  TRAFO_DIREK: { ad: 'Direk tipi trafo', kose: [[0, 5.5], [5, -3], [-5, -3]] },
  TRAFO_BINA: { ad: 'Bina tipi trafo', kose: kare(10) },
  TRAFO_KOSK: { ad: 'Köşk (prefabrik / monoblok)', kose: [[-6, 2], [0, 7], [6, 2], [5, 2], [5, -6], [-5, -6], [-5, 2]] },
  SDK: { ad: 'SDK / box', kose: dikdortgen(8, 5), bosIsaret: 'capraz' },
  PANO: { ad: 'Pano', kose: dikdortgen(5, 7), herZaman: [['L', 1, 2.5, -1, 0], ['L', -1, 0, 1, 0], ['L', 1, 0, -1, -2.5]] },
  MUFU: { ad: 'Ek mufu', kose: elmas(1.4) },
  KOFRE: { ad: 'Kofre', kose: dikdortgen(2.8, 1.76) },
  MENHOL: { ad: 'Menhol', kose: kare(4), herZaman: [['C', 0, 0, 1.2]] },
  ABONE: { ad: 'Abone bağlantısı', daire: 1.5, herZaman: [['L', -1.5, 0, 1.5, 0]] },
  // Armatür direğin yanında durur: kapsamı (1,1 m) AG direk simgesinin (2,25) yarısından küçük (kullanıcı, 8.11.2026)
  ARMATUR: { ad: 'Armatür / sokak lambası', daire: 0.6, herZaman: [['L', -1.1, 0, -0.8, 0], ['L', 0.8, 0, 1.1, 0], ['L', 0, -1.1, 0, -0.8], ['L', 0, 0.8, 0, 1.1], ['L', -0.78, -0.78, -0.57, -0.57], ['L', 0.57, 0.57, 0.78, 0.78], ['L', -0.78, 0.78, -0.57, 0.57], ['L', 0.57, -0.57, 0.78, -0.78]] },
  DIGER: { ad: 'Diğer', kose: elmas(2.5) }
};

// Varyantlar (telefonun haritasındaki simgeler örnek alındı):
//   YENI   montaj (M, M+M, KM, ENH, ME): dolu
//   MEVCUT mevcut: boş (kafes direkte içi çarpı)
//   DMM    sök-tak (DM+M): yarım dolu (kafes direkte sol ve sağ üçgenler)
//   DM     demontaj: boş (kafesin çarpısı da yok) + simgeden taşan tek çapraz "/"
//   KESIK  demontaj, kesik: boş + iki paralel çapraz "//"
//   SOKUK  demontaj, sökük: boş + taşan çarpı "X"
const VARYANTLAR = ['YENI', 'MEVCUT', 'DMM', 'DM', 'KESIK', 'SOKUK'];
const demontajMi = (v) => v === 'DM' || v === 'KESIK' || v === 'SOKUK';

function uret(aile, varyant) {
  const a = AILELER[aile], out = [];
  let R;
  if (a.daire) {
    R = a.daire;
    out.push(['C', 0, 0, r4(R)]);
    if (varyant === 'YENI') out.push(['D', r4(R)]);
    if (varyant === 'DMM') out.push(['Y', r4(R)]);
  } else {
    const k = a.kose;
    R = Math.max(...k.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
    out.push(['P', k.map(pt), true]);
    if (varyant === 'YENI') out.push(...yelpaze(k));
    if (varyant === 'DMM') {
      if (a.bosIsaret === 'X') {
        // Lejant: kafes direkte sök-tak = sol ve sağ üçgenler dolu (telefonun DXF yazıcısıyla aynı)
        const h = R;
        out.push(['S', [[-h, -h], [0, 0], [-h, h], [-h, h]]], ['S', [[h, -h], [0, 0], [h, h], [h, h]]]);
      } else out.push(...yelpaze(solYari(k)));
    }
    // İç işaret (kafes çarpısı, SDK çaprazı) yalnız mevcutta: demontajda simge boştur, içinde yalnız demontaj işareti
    // görünür ("/" ile "X" kafesin çarpısıyla karışmasın diye)
    if (varyant === 'MEVCUT') {
      if (a.bosIsaret === 'X') { const h = R; out.push(['L', -h, -h, h, h], ['L', h, -h, -h, h]); }
      if (a.bosIsaret === 'capraz') { const [p0, , p2] = k; out.push(['L', ...pt(p0), ...pt(p2)]); }
    }
  }
  if (a.herZaman) out.push(...a.herZaman.map((x) => x.slice()));
  if (a.toprak) out.push(...toprak(-R));
  if (demontajMi(varyant)) out.push(...dmIsareti(R, varyant));
  return { yariGenislik: r4(R), ilkeller: out };
}

/** İlkellerin merkezden en uzak noktası (x ya da y yönünde, metre). */
function kapsam(ilkeller) {
  let m = 0;
  const k = (x, y) => { m = Math.max(m, Math.abs(x), Math.abs(y)); };
  for (const i of ilkeller) {
    if (i[0] === 'L') { k(i[1], i[2]); k(i[3], i[4]); }
    else if (i[0] === 'C') k(Math.abs(i[1]) + i[3], Math.abs(i[2]) + i[3]);
    else if (i[0] === 'D' || i[0] === 'Y') k(i[1], i[1]);
    else if (i[0] === 'T') k(Math.abs(i[1]) + i[3] * 0.4 * String(i[4]).length, Math.abs(i[2]) + i[3] / 2);
    else if (i[0] === 'R') continue;
    else for (const p of i[1]) k(p[0], p[1]);
  }
  return m;
}

// ---- Şebeke-M simge takımı (SM_*; kullanıcının 8.11.2026 tasarım paketinden, 9.11.2026) ----------------------------
// Çizim Ayarları › Görünüm › Simge takımı: Şebeke-M seçilince eklenti SH_SM_<aile>_<varyant> bloklarını koyar; telefonun
// DXF'i aynı adlarla yazar. Tasarımın kuralı (değiştirilmez): YENİ = dolu (iç çizgiler zıt renkte), DM+M = sol yarısı
// dolu, MEVCUT = yalnız kontur, DEMONTAJ = çift kontur + "DM" yazısı. Kullanıcı kararı: kesik / sökük ayrımı için
// simgenin sağ altında küçük K / S harfi. Yarı genişlikler klasik takımla aynı: yazı yerleri ve hat yapışması değişmez.
// Yeni ilkeller: ["T", x, y, h, metin] ortalanmış yazı · ["R", n] renk (sonraki ilkeller; 0 bloğa göre, 7 zıt renk:
// karanlık zeminde beyaz, kâğıtta siyah) · ["P", köşeler, kapalı, "DASHED"] kesikli çoklu doğru.
const olcekle = (k, f) => k.map((p) => [r4(p[0] * f), r4(p[1] * f)]);
const yay = (cx, cy, r, a0, a1, adim = 15) => {
  const out = [];
  for (let a = a0; a0 < a1 ? a <= a1 + 1e-9 : a >= a1 - 1e-9; a += a0 < a1 ? adim : -adim) out.push([r4(cx + r * Math.cos((a * Math.PI) / 180)), r4(cy + r * Math.sin((a * Math.PI) / 180))]);
  return out;
};
const G = {
  // direk gövdesi + konsol (AG: tek, OG: iki)
  direkAG: (R) => [['L', 0, r4(-0.6 * R), 0, r4(0.55 * R)], ['L', r4(-0.45 * R), r4(0.3 * R), r4(0.45 * R), r4(0.3 * R)], ['L', r4(-0.2 * R), r4(-0.6 * R), r4(0.2 * R), r4(-0.6 * R)]],
  direkOG: (R) => [['L', 0, r4(-0.6 * R), 0, r4(0.55 * R)], ['L', r4(-0.5 * R), r4(0.35 * R), r4(0.5 * R), r4(0.35 * R)], ['L', r4(-0.35 * R), r4(0.05 * R), r4(0.35 * R), r4(0.05 * R)], ['L', r4(-0.2 * R), r4(-0.6 * R), r4(0.2 * R), r4(-0.6 * R)]],
  // kafes (demir) direk: daralan gövde, iki çapraz, tepe travers
  kafes: (R) => [
    ['P', [[r4(-0.22 * R), r4(-0.62 * R)], [r4(0.22 * R), r4(-0.62 * R)], [r4(0.09 * R), r4(0.55 * R)], [r4(-0.09 * R), r4(0.55 * R)]], true],
    ['L', r4(-0.22 * R), r4(-0.62 * R), r4(0.155 * R), r4(-0.035 * R)], ['L', r4(0.22 * R), r4(-0.62 * R), r4(-0.155 * R), r4(-0.035 * R)],
    ['L', r4(-0.155 * R), r4(-0.035 * R), r4(0.09 * R), r4(0.55 * R)], ['L', r4(0.155 * R), r4(-0.035 * R), r4(-0.09 * R), r4(0.55 * R)],
    ['L', r4(-0.38 * R), r4(0.38 * R), r4(0.38 * R), r4(0.38 * R)]
  ],
  // aydınlatma direği: gövde + sağa kıvrılan kol + kısa uç
  ayd: (R) => [['L', 0, r4(-0.6 * R), 0, r4(0.2 * R)], ['P', yay(0.3 * R, 0.2 * R, 0.3 * R, 180, 0), false], ['L', r4(0.6 * R), r4(0.2 * R), r4(0.6 * R), r4(0.02 * R)]],
  // şimşek (özel trafo)
  simsek: (R) => [['P', [[r4(0.12 * R), r4(0.5 * R)], [r4(-0.22 * R), r4(0.04 * R)], [r4(0.02 * R), r4(0.04 * R)], [r4(-0.12 * R), r4(-0.5 * R)], [r4(0.22 * R), r4(-0.06 * R)], [r4(-0.02 * R), r4(-0.06 * R)]], true]],
  kuleCikis: () => [['L', 5, -2, 7.5, -2], ['L', 7.5, -2, 7.5, -4.5]],
  kapi: () => [['P', [[-1.5, -6], [-1.5, -1.5], [1.5, -1.5], [1.5, -6]], false]],
  moduler: () => [['L', -2, -4, -2, 4], ['L', 2, -4, 2, 4], ['L', -4, -0.8, -4, 0.8], ['L', 0, -0.8, 0, 0.8], ['L', 4, -0.8, 4, 0.8]],
  bina: () => [['L', -2.5, 2, -2.5, 3.5], ['L', 0, 2, 0, 3.5], ['L', 2.5, 2, 2.5, 3.5]],
  box: () => [['L', -4, -2.5, 4, 2.5]],
  civa: () => [['L', -0.35, -0.35, 0.35, 0.35], ['L', -0.35, 0.35, 0.35, -0.35]],
  sodyum: () => [['L', -0.35, -0.35, 0.35, 0.35], ['L', -0.35, 0.35, 0.35, -0.35], ['L', 0, -0.42, 0, 0.42]],
  led: () => [['C', 0, 0.25, 0.1], ['C', -0.22, -0.13, 0.1], ['C', 0.22, -0.13, 0.1]],
  floresan: () => [['L', -0.15, -0.35, -0.15, 0.35], ['L', 0.15, -0.35, 0.15, 0.35]]
};
const kosk = [[-6, 2], [0, 7], [6, 2], [5, 2], [5, -6], [-5, -6], [-5, 2]];
// daire: {r} ya da kose: [...]; kesik: kesikli kontur; glif: iç çizgiler (R → ilkeller); yazi: satırlar ['SDK', 'AG']
const SM = {
  SM_DIREK_AG: { ad: 'AG direği', daire: 2.25, glif: G.direkAG },
  SM_KAFES_AG: { ad: 'AG kafes direk', daire: 2.25, glif: G.kafes },
  SM_DIREK_OG: { ad: 'Müşterek / OG direği', daire: 3, glif: G.direkOG },
  SM_KAFES_OG: { ad: 'Müşterek / OG kafes direk', daire: 3, glif: G.kafes },
  SM_DIREK_ENH: { ad: 'ENH / BAHH direği', daire: 3, glif: G.kafes },
  SM_DIREK_AYD: { ad: 'Aydınlatma direği', daire: 2, glif: G.ayd },
  SM_TRAFO_DIREK: { ad: 'Direk tipi trafo postası', kose: [[0, 5.5], [5, -3], [-5, -3]] },
  SM_TRAFO_DIREK_OZEL: { ad: 'Direk tipi özel trafo postası', kose: [[0, 5.5], [5, -3], [-5, -3]], glif: (R) => G.simsek(R * 0.6).map((i) => [i[0], i[1].map((p) => [p[0], r4(p[1] - 0.8)]), i[2]]) },
  SM_INDIRICI_MERKEZ: { ad: 'İndirici / dağıtım merkezi', kose: kosk, glif: G.kapi },
  SM_KOSK_KULE: { ad: 'Kule tipi trafo postası', kose: kosk },
  SM_KOSK_KULE_CIKIS: { ad: 'Kule çıkışlı trafo postası', kose: kosk, glif: G.kuleCikis },
  SM_KOSK_KULESIZ_OZEL: { ad: 'Kulesiz tip özel trafo postası', kose: kosk, kesik: true, glif: (R) => G.simsek(R * 0.7) },
  SM_KOSK_KULE_OZEL: { ad: 'Kule tipi özel trafo postası', kose: kosk, glif: (R) => G.simsek(R * 0.7) },
  SM_KOSK_KCIKIS_OZEL: { ad: 'Kule çıkışlı tip özel trafo', kose: kosk, glif: (R) => [...G.simsek(R * 0.7), ...G.kuleCikis()] },
  SM_KOSK_MODULER: { ad: 'Modüler beton köşk', kose: dikdortgen(12, 8), glif: G.moduler },
  SM_TRAFO_BINA: { ad: 'Bina tipi trafo postası', kose: kare(10), kesik: true, glif: G.bina },
  SM_BOX: { ad: 'Dağıtım / ölçüm box (pano)', kose: dikdortgen(8, 5), glif: G.box },
  SM_SDK_AG: { ad: 'Saha dağıtım kutusu · AG', kose: dikdortgen(5, 7), yazi: ['SDK', 'AG'] },
  SM_SDK_AYD: { ad: 'Saha dağıtım kutusu · aydınlatma', kose: dikdortgen(5, 7), yazi: ['SDK', 'AYD'] },
  SM_ARMATUR_CIVA: { ad: 'Cıva buharlı sokak lambası', daire: 0.6, glif: G.civa },
  SM_ARMATUR_SODYUM: { ad: 'Sodyum buharlı sokak lambası', daire: 0.6, glif: G.sodyum },
  SM_ARMATUR_LED: { ad: 'LED sokak lambası', daire: 0.6, glif: G.led },
  SM_ARMATUR_FLORESAN: { ad: 'Floresan sokak lambası', daire: 0.6, glif: G.floresan }
};

/** Basit (kendini kesmeyen) çokgeni kulak kesmeyle üçgenler: içbükey köşk gibi biçimler de doğru dolar (yelpaze yalnız dışbükeye uyar). */
function ucgenle(kose) {
  const k = kose.filter((p, i) => i === 0 || Math.abs(p[0] - kose[i - 1][0]) > 1e-9 || Math.abs(p[1] - kose[i - 1][1]) > 1e-9);
  if (k.length < 3) return [];
  let alan = 0;
  for (let i = 0; i < k.length; i++) { const a = k[i], b = k[(i + 1) % k.length]; alan += a[0] * b[1] - b[0] * a[1]; }
  const idx = k.map((_, i) => i);
  if (alan < 0) idx.reverse();   // saat yönünün tersine
  const carpim = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const icinde = (p, a, b, c) => carpim(a, b, p) >= -1e-9 && carpim(b, c, p) >= -1e-9 && carpim(c, a, p) >= -1e-9;
  const out = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 1000) {
    let kesildi = false;
    for (let i = 0; i < idx.length; i++) {
      const a = k[idx[(i + idx.length - 1) % idx.length]], b = k[idx[i]], c = k[idx[(i + 1) % idx.length]];
      if (carpim(a, b, c) <= 1e-9) continue;   // içbükey köşe
      let bos = true;
      for (const j of idx) { const p = k[j]; if (p === a || p === b || p === c) continue; if (icinde(p, a, b, c)) { bos = false; break; } }
      if (!bos) continue;
      out.push(['S', [pt(a), pt(b), pt(c), pt(c)]]);
      idx.splice(i, 1);
      kesildi = true;
      break;
    }
    if (!kesildi) break;
  }
  if (idx.length === 3) out.push(['S', [pt(k[idx[0]]), pt(k[idx[1]]), pt(k[idx[2]]), pt(k[idx[2]])]]);
  return out;
}

/** Doğru ilkellerini x = 0'da böler: sol parçalar zıt renk (dolu yarının üstünde), sağ parçalar bloğa göre. */
function yariRenk(ilkeller) {
  const sol = [], sag = [];
  const dogru = (x1, y1, x2, y2) => {
    if (x1 <= 0 && x2 <= 0) sol.push(['L', r4(x1), r4(y1), r4(x2), r4(y2)]);
    else if (x1 >= 0 && x2 >= 0) sag.push(['L', r4(x1), r4(y1), r4(x2), r4(y2)]);
    else {
      const t = -x1 / (x2 - x1), ym = y1 + t * (y2 - y1);
      (x1 < 0 ? sol : sag).push(['L', r4(x1), r4(y1), 0, r4(ym)]);
      (x1 < 0 ? sag : sol).push(['L', 0, r4(ym), r4(x2), r4(y2)]);
    }
  };
  for (const i of ilkeller) {
    if (i[0] === 'L') dogru(i[1], i[2], i[3], i[4]);
    else if (i[0] === 'P') { const k = i[1]; for (let n = 1; n < k.length; n++) dogru(k[n - 1][0], k[n - 1][1], k[n][0], k[n][1]); if (i[2]) dogru(k[k.length - 1][0], k[k.length - 1][1], k[0][0], k[0][1]); }
    else if (i[0] === 'C') (i[1] < 0 ? sol : sag).push(i.slice());
    else sag.push(i.slice());
  }
  return [...(sol.length ? [['R', 7], ...sol, ['R', 0]] : []), ...sag];
}

function smUret(aile, varyant) {
  const a = SM[aile], out = [];
  const lt = a.kesik ? 'DASHED' : null;
  let R, kontur, icKontur;
  if (a.daire) {
    R = a.daire;
    kontur = ['C', 0, 0, r4(R)];
    icKontur = ['C', 0, 0, r4(R * 0.8)];
  } else {
    R = Math.max(...a.kose.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
    kontur = lt ? ['P', a.kose.map(pt), true, lt] : ['P', a.kose.map(pt), true];
    icKontur = lt ? ['P', olcekle(a.kose, 0.8), true, lt] : ['P', olcekle(a.kose, 0.8), true];
  }
  out.push(kontur);
  const glif = a.glif ? a.glif(R) : [];
  // Yazılı simge (SDK AG …): satırlar dikeyde ortalı istiflenir; demontajda "DM" alta eklenir; sök-takta sağ yarıya küçülür
  const yazilar = (satirlar, dx = 0, kat = 1) => {
    if (!satirlar.length) return [];
    const Ry = a.daire ? R : Math.max(...a.kose.map((p) => Math.abs(p[1])));
    const h = r4(Math.min(1.3, (Ry * 1.5) / (satirlar.length * 1.35)) * kat);
    return satirlar.map((m, i) => ['T', r4(dx), r4(((satirlar.length - 1) / 2 - i) * h * 1.35), h, m]);
  };
  const yazi = a.yazi || [];
  if (varyant === 'YENI') {
    out.push(...(a.daire ? [['D', r4(R)]] : ucgenle(a.kose)));
    if (glif.length || yazi.length) out.push(['R', 7], ...glif, ...yazilar(yazi), ['R', 0]);
  } else if (varyant === 'DMM') {
    out.push(...(a.daire ? [['Y', r4(R)]] : ucgenle(solYari(a.kose))));
    out.push(...yariRenk(glif), ...yazilar(yazi, R * 0.5, 0.7));
  } else if (varyant === 'MEVCUT') {
    out.push(...glif, ...yazilar(yazi));
  } else {
    // demontaj: çift kontur + "DM"; kesik / sökük: sağ altta K / S (kullanıcı kararı)
    out.push(icKontur, ...glif);
    if (yazi.length) out.push(...yazilar([...yazi, 'DM']));
    else out.push(['T', 0, r4(-0.55 * R), r4(0.4 * R), 'DM']);
    if (varyant === 'KESIK') out.push(['T', r4(0.95 * R), r4(-0.95 * R), r4(0.35 * R), 'K']);
    if (varyant === 'SOKUK') out.push(['T', r4(0.95 * R), r4(-0.95 * R), r4(0.35 * R), 'S']);
  }
  return { yariGenislik: r4(R), ilkeller: out };
}

// Blok adı sınırı: telefonun DXF'i R12 (AC1009) biçimindedir; AutoCAD bu biçimde 31 karakterden uzun ya da A–Z, 0–9,
// _ $ - dışında karakterli adlı dosyayı açmaz ("Invalid or incomplete DXF input", ENTER → boş çizim). SH_<aile>_<varyant>
// bu sınırı aşamaz (13.11.2026: SM_KOSK_KULE_CIKIS_OZEL_MEVCUT 33 karakterdi → SM_KOSK_KCIKIS_OZEL).
const ESKI_AILELER = { SM_KOSK_KULE_CIKIS_OZEL: 'SM_KOSK_KCIKIS_OZEL' };
for (const aile of [...Object.keys(AILELER), ...Object.keys(SM)])
  for (const v of VARYANTLAR) {
    const ad = 'SH_' + aile + '_' + v;
    if (ad.length > 31 || !/^[A-Z0-9_$-]+$/.test(ad)) throw new Error('Blok adı R12 DXF sınırını aşıyor (en çok 31 karakter, A–Z 0–9 _ $ -): ' + ad);
  }

const semboller = {};
const aileler = {};
for (const aile of Object.keys(AILELER)) {
  let enBuyuk = 0;
  for (const v of VARYANTLAR) {
    const s = uret(aile, v).ilkeller;
    semboller[aile + '_' + v] = s;
    enBuyuk = Math.max(enBuyuk, kapsam(s));
  }
  // kapsam: bütün varyantları içine alan yarı genişlik (şerit ve pencere simgeleri aynı ölçekte çizilsin diye)
  aileler[aile] = { ad: AILELER[aile].ad, yariGenislik: r4(AILELER[aile].daire || Math.max(...AILELER[aile].kose.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))))), kapsam: r4(enBuyuk) };
}
for (const aile of Object.keys(SM)) {
  let enBuyuk = 0, yg = 0;
  for (const v of VARYANTLAR) {
    const s = smUret(aile, v);
    semboller[aile + '_' + v] = s.ilkeller;
    yg = s.yariGenislik;
    enBuyuk = Math.max(enBuyuk, kapsam(s.ilkeller));
  }
  aileler[aile] = { ad: SM[aile].ad, takim: 'SM', yariGenislik: yg, kapsam: r4(enBuyuk) };
}

const cikti = {
  bicim: 'sebeke-hakedis.semboller',
  surum: 3,
  aciklama: 'Lejant simge takımları (klasik ve Şebeke-M). Boyutlar metre (1/1000 pafta). AutoCAD eklentisi blokları SH_<ad> adıyla metre cinsinden tanımlar ve 1 ölçekle koyar; telefonun DXF çıktısı aynı blokları aynı adla yazar. Üretici: araclar/semboller-uret.mjs — bu dosya elle düzenlenmez.',
  ilkeller: {
    L: 'doğru: x1 y1 x2 y2', C: 'daire: cx cy r', P: 'çoklu doğru: [[x,y],...] kapali [, çizgiTipi ("DASHED")]',
    S: 'dolu dörtgen: 4 köşe, AutoCAD SOLID sırası (1 2 4 3)', D: 'dolu daire: r', Y: 'yarım dolu daire (sol yarı): r',
    T: 'ortalanmış yazı: x y yükseklik metin', R: 'renk (sonraki ilkeller için): 0 bloğa göre, 7 zıt renk (karanlık zeminde beyaz, kâğıtta siyah)'
  },
  takimlar: {
    '': 'Klasik: aile adı öneksiz (DIREK_AG …); eklenti bloğu SH_<aile>_<varyant>',
    SM: 'Şebeke-M (kullanıcının SM_* tasarımı): aile adı SM_ önekli; YENİ dolu (iç çizgiler zıt renk), DM+M sol yarısı dolu, MEVCUT kontur, demontaj çift kontur + "DM" (kesik / sökük: sağ altta K / S)'
  },
  varyantlar: {
    YENI: 'montaj (M, M+M, KM, ENH, ME): dolu',
    MEVCUT: 'mevcut: boş',
    DMM: 'sök-tak (DM+M): yarım dolu',
    DM: 'demontaj: boş + simgeden taşan çapraz "/" (Şebeke-M: çift kontur + DM)',
    KESIK: 'demontaj, kesik (DM · KESİK): boş + iki paralel çapraz "//" (Şebeke-M: + K)',
    SOKUK: 'demontaj, sökük (DM · SÖKÜK): boş + taşan çarpı "X" (Şebeke-M: + S)'
  },
  eskiAileler: Object.assign({ aciklama: 'Adı değişen aileler: eski ad → yeni ad. Eklenti çizimdeki eski adlı SH_ bloklarını yeni adla yeniden adlandırır (blok adı R12 DXF sınırı: 31 karakter).' }, ESKI_AILELER),
  aileler,
  semboller
};

const json = JSON.stringify(cikti, null, 1) + '\n';
fs.writeFileSync(path.join(kok, 'ortak/katalog/semboller.json'), json);
console.log('semboller.json: ' + Object.keys(semboller).length + ' sembol, ' + Object.keys(aileler).length + ' aile');
console.log('Telefon kopyası için: node araclar/ortak-tablolar.mjs');
