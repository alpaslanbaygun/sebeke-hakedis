#!/usr/bin/env node
// Simge takımlarının lejantını SVG olarak üretir: ortak/lejant/semboller-klasik.svg ve semboller-sebekem.svg
// (belgeler ve göz denetimi için; AutoCAD ve telefon simgeleri aynı ilkellerden çizer). İlkeller: semboller-uret.mjs.
//   node araclar/lejant-uret.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = JSON.parse(fs.readFileSync(path.join(kok, 'ortak/katalog/semboller.json'), 'utf8'));
const STIL = JSON.parse(fs.readFileSync(path.join(kok, 'ortak/katalog/cizim-stili.json'), 'utf8'));
const VARYANTLAR = ['YENI', 'MEVCUT', 'DMM', 'DM', 'KESIK', 'SOKUK'];
const BASLIK = { YENI: 'Yeni (montaj)', MEVCUT: 'Mevcut', DMM: 'Sök-tak (DM+M)', DM: 'Demontaj', KESIK: 'Demontaj · kesik', SOKUK: 'Demontaj · sökük' };

/** Ailenin çizim rengi: ortak stilin katman renginden (AG yeşil, OG kırmızı, AYD, trafo…); bulunamazsa koyu gri. */
function renk(aile) {
  const a = aile.replace(/^SM_/, '');
  const katman = /ENH/.test(a) ? 'DIREK_ENH' : /AG/.test(a) && !/AYD/.test(a) ? 'DIREK_AG' : /OG/.test(a) ? 'DIREK_OG' : /AYD|ARMATUR/.test(a) ? 'DIREK_AYD'
    : /TRAFO|KOSK|INDIRICI/.test(a) ? 'TRAFO' : /SDK|BOX|PANO/.test(a) ? 'SDK' : /MENHOL|MUFU/.test(a) ? 'KABLO' : 'YAZI';
  const k = STIL.katmanlar ? STIL.katmanlar[katman] : null;
  const aci = k ? k.aci : 7;
  // AutoCAD renk indeksi → yaklaşık RGB (yalnız lejant resmi için)
  const ACI = { 1: '#d22', 2: '#c9a000', 3: '#2a2', 4: '#0aa', 5: '#22c', 6: '#c3c', 7: '#222', 8: '#777', 16: '#a00', 30: '#e7841b', 32: '#8a5a00', 40: '#b8a000', 84: '#2a8', 120: '#1a7a33', 150: '#06c', 190: '#1565c0', 200: '#7a3cb0', 230: '#5a2d82' };
  return ACI[aci] || '#223';
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Bir simgeyi (ilkeller, metre) hücreye çizer; ölçek ailenin kapsamına göre. */
function simge(ilkeller, aile, cx, cy, hucre, zemin) {
  const kapsam = Math.max(0.5, S.aileler[aile].kapsam);
  const k = (hucre * 0.42) / kapsam;
  const X = (x) => (cx + x * k).toFixed(2), Y = (y) => (cy - y * k).toFixed(2);
  const ana = renk(aile), zit = zemin === 'koyu' ? '#fff' : '#fff';
  let r = ana, out = '';
  const kalem = Math.max(0.8, hucre / 48).toFixed(2);
  for (const i of ilkeller) {
    const t = i[0];
    if (t === 'R') { r = i[1] === 7 ? zit : ana; continue; }
    if (t === 'L') out += `<line x1="${X(i[1])}" y1="${Y(i[2])}" x2="${X(i[3])}" y2="${Y(i[4])}" stroke="${r}" stroke-width="${kalem}" stroke-linecap="round"/>`;
    else if (t === 'C') out += `<circle cx="${X(i[1])}" cy="${Y(i[2])}" r="${(i[3] * k).toFixed(2)}" fill="none" stroke="${r}" stroke-width="${kalem}"/>`;
    else if (t === 'D') out += `<circle cx="${X(0)}" cy="${Y(0)}" r="${(i[1] * k).toFixed(2)}" fill="${r}"/>`;
    else if (t === 'Y') { const rr = (i[1] * k).toFixed(2); out += `<path d="M ${X(0)} ${Y(i[1])} A ${rr} ${rr} 0 0 0 ${X(0)} ${Y(-i[1])} Z" fill="${r}"/>`; }
    else if (t === 'P') out += `<polyline points="${i[1].map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')}${i[2] ? ' ' + X(i[1][0][0]) + ',' + Y(i[1][0][1]) : ''}" fill="none" stroke="${r}" stroke-width="${kalem}" stroke-linejoin="round"${i[3] ? ` stroke-dasharray="${(hucre / 14).toFixed(1)} ${(hucre / 24).toFixed(1)}"` : ''}/>`;
    else if (t === 'S') { const p = i[1]; out += `<polygon points="${[p[0], p[1], p[3], p[2]].map((q) => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="${r}" stroke="${r}" stroke-width="0.3"/>`; }
    else if (t === 'T') out += `<text x="${X(i[1])}" y="${Y(i[2])}" font-size="${(i[3] * k * 1.35).toFixed(2)}" font-family="Arial, sans-serif" font-weight="bold" fill="${r}" text-anchor="middle" dominant-baseline="central">${esc(i[4])}</text>`;
  }
  return out;
}

function lejant(takim, dosya, baslik) {
  const aileler = Object.keys(S.aileler).filter((a) => (S.aileler[a].takim || '') === takim);
  const hucre = 88, sol = 230, ust = 70, satir = hucre + 8;
  const W = sol + VARYANTLAR.length * hucre + 20, H = ust + aileler.length * satir + 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif">`;
  svg += `<rect width="${W}" height="${H}" fill="#fff"/><text x="16" y="30" font-size="18" font-weight="bold" fill="#123">${esc(baslik)}</text>`;
  svg += `<text x="16" y="52" font-size="11" fill="#667">Şebeke-M Hakediş · ölçü: 1/1000 paftadaki metre; AutoCAD blokları ve telefonun DXF'i aynı ilkellerden çizilir (ortak/katalog/semboller.json)</text>`;
  VARYANTLAR.forEach((v, j) => { svg += `<text x="${sol + j * hucre + hucre / 2}" y="${ust - 8}" font-size="11" font-weight="bold" fill="#345" text-anchor="middle">${esc(BASLIK[v])}</text>`; });
  aileler.forEach((a, i) => {
    const y = ust + i * satir;
    if (i % 2 === 0) svg += `<rect x="8" y="${y}" width="${W - 16}" height="${satir}" fill="#f5f7fa"/>`;
    svg += `<text x="16" y="${y + satir / 2 + 4}" font-size="12" fill="#123">${esc(S.aileler[a].ad)}</text>`;
    svg += `<text x="16" y="${y + satir / 2 + 18}" font-size="9" fill="#889">SH_${esc(a)}_… · yarı genişlik ${S.aileler[a].yariGenislik} m</text>`;
    VARYANTLAR.forEach((v, j) => {
      const il = S.semboller[a + '_' + v];
      if (il) svg += simge(il, a, sol + j * hucre + hucre / 2, y + satir / 2, hucre, 'acik');
    });
  });
  svg += '</svg>\n';
  fs.mkdirSync(path.join(kok, 'ortak/lejant'), { recursive: true });
  fs.writeFileSync(path.join(kok, 'ortak/lejant', dosya), svg);
  console.log('ortak/lejant/' + dosya + ': ' + aileler.length + ' aile');
}

lejant('', 'semboller-klasik.svg', 'Simge takımı · Klasik');
lejant('SM', 'semboller-sebekem.svg', 'Simge takımı · Şebeke-M');
