#!/usr/bin/env node
// semboller.json'daki tüm simgeleri bir SVG sayfasına çizer (gözle denetim için).
// Kullanım: node araclar/semboller-onizle.mjs [çıktı.svg]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d = JSON.parse(fs.readFileSync(path.join(kok, 'ortak/katalog/semboller.json'), 'utf8'));
const hedef = process.argv[2] || path.join(kok, 'araclar/semboller-onizleme.svg');
const varyantlar = Object.keys(d.varyantlar);
const aileler = Object.keys(d.aileler);
const hucre = 120, olcek = 6; // 1 m = 6 px
const W = 160 + varyantlar.length * hucre, H = 40 + aileler.length * hucre;
const s = [];
s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="12">`);
s.push(`<rect width="${W}" height="${H}" fill="white"/>`);
varyantlar.forEach((v, j) => s.push(`<text x="${160 + j * hucre + hucre / 2}" y="24" text-anchor="middle" font-weight="bold">${v}</text>`));
aileler.forEach((a, i) => {
  const cy = 40 + i * hucre + hucre / 2 - 10;
  s.push(`<text x="8" y="${cy}" font-size="11">${a}</text>`);
  varyantlar.forEach((v, j) => {
    const cx = 160 + j * hucre + hucre / 2;
    const p = d.semboller[a + '_' + v];
    const X = (x) => (cx + x * olcek).toFixed(2), Y = (y) => (cy - y * olcek).toFixed(2);
    s.push(`<g stroke="#1d4ed8" stroke-width="1.2" fill="none">`);
    for (const e of p) {
      const t = e[0];
      if (t === 'L') s.push(`<line x1="${X(e[1])}" y1="${Y(e[2])}" x2="${X(e[3])}" y2="${Y(e[4])}"/>`);
      else if (t === 'C') s.push(`<circle cx="${X(e[1])}" cy="${Y(e[2])}" r="${(e[3] * olcek).toFixed(2)}"/>`);
      else if (t === 'P') s.push(`<polyline points="${e[1].map((q) => X(q[0]) + ',' + Y(q[1])).join(' ') + (e[2] ? ' ' + X(e[1][0][0]) + ',' + Y(e[1][0][1]) : '')}"/>`);
      else if (t === 'S') { const q = e[1]; s.push(`<polygon fill="#1d4ed8" stroke="none" points="${[q[0], q[1], q[3], q[2]].map((k) => X(k[0]) + ',' + Y(k[1])).join(' ')}"/>`); }
      else if (t === 'D') s.push(`<circle fill="#1d4ed8" stroke="none" cx="${X(0)}" cy="${Y(0)}" r="${(e[1] * olcek).toFixed(2)}"/>`);
      else if (t === 'Y') { const r = e[1] * olcek; s.push(`<path fill="#1d4ed8" stroke="none" d="M ${X(0)} ${Y(e[1])} A ${r} ${r} 0 0 0 ${X(0)} ${Y(-e[1])} Z"/>`); }
    }
    s.push('</g>');
  });
});
s.push('</svg>');
fs.writeFileSync(hedef, s.join('\n'));
console.log('yazıldı: ' + hedef);
