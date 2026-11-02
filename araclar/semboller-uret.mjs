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
// küçük simgede 1,5 m, büyükte en çok 3 m; böylece içi çarpılı kafes direkte de "mevcut"tan ayrılır.
//   DM     "/"   tek çapraz (demontaj)
//   KESIK  "//"  iki paralel çapraz (kesilerek demontaj)
//   SOKUK  "X"   iki çapraz (sökülerek demontaj)
const tasma = (R) => r4(R + Math.min(3, Math.max(1.5, R * 0.8)));
function dmIsareti(R, varyant) {
  const d = tasma(R);
  if (varyant === 'SOKUK') return [['L', -d, -d, d, d], ['L', -d, d, d, -d]];
  if (varyant === 'KESIK') {
    // Çapraza dik yönde ±h kaydırılmış iki çizgi (aralık simgenin yarısı kadar)
    const h = r4(Math.max(0.7, R * 0.42));
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
  ARMATUR: { ad: 'Armatür / sokak lambası', daire: 1.5, herZaman: [['L', -3, 0, -2, 0], ['L', 2, 0, 3, 0], ['L', 0, -3, 0, -2], ['L', 0, 2, 0, 3], ['L', -2.1, -2.1, -1.4, -1.4], ['L', 1.4, 1.4, 2.1, 2.1], ['L', -2.1, 2.1, -1.4, 1.4], ['L', 1.4, -1.4, 2.1, -2.1]] },
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
    else for (const p of i[1]) k(p[0], p[1]);
  }
  return m;
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

const cikti = {
  bicim: 'sebeke-hakedis.semboller',
  surum: 2,
  aciklama: 'Lejant simge takımı. Boyutlar metre (1/1000 pafta). AutoCAD eklentisi blokları SH_<ad> adıyla metre cinsinden tanımlar ve 1 ölçekle koyar; telefonun DXF çıktısı aynı blokları aynı adla yazar. Üretici: araclar/semboller-uret.mjs — bu dosya elle düzenlenmez.',
  ilkeller: {
    L: 'doğru: x1 y1 x2 y2', C: 'daire: cx cy r', P: 'çoklu doğru: [[x,y],...] kapali',
    S: 'dolu dörtgen: 4 köşe, AutoCAD SOLID sırası (1 2 4 3)', D: 'dolu daire: r', Y: 'yarım dolu daire (sol yarı): r'
  },
  varyantlar: {
    YENI: 'montaj (M, M+M, KM, ENH, ME): dolu',
    MEVCUT: 'mevcut: boş',
    DMM: 'sök-tak (DM+M): yarım dolu',
    DM: 'demontaj: boş + simgeden taşan çapraz "/"',
    KESIK: 'demontaj, kesik (DM · KESİK): boş + iki paralel çapraz "//"',
    SOKUK: 'demontaj, sökük (DM · SÖKÜK): boş + taşan çarpı "X"'
  },
  aileler,
  semboller
};

const json = JSON.stringify(cikti, null, 1) + '\n';
fs.writeFileSync(path.join(kok, 'ortak/katalog/semboller.json'), json);
console.log('semboller.json: ' + Object.keys(semboller).length + ' sembol, ' + Object.keys(aileler).length + ' aile');
console.log('Telefon kopyası için: node araclar/ortak-tablolar.mjs');
