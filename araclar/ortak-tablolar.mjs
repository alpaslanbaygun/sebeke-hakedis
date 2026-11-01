#!/usr/bin/env node
// ortak/katalog/*.json dosyalarını telefon uygulamasına JavaScript modülü olarak kopyalar
// (telefon/web/src/ortak/<ad>.js). Böylece telefon ile eklenti aynı tabloları kullanır.
// Kullanım: node araclar/ortak-tablolar.mjs      (semboller.json'ı araclar/semboller-uret.mjs üretir)
import fs from 'node:fs';
import path from 'node:path';

const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const kaynak = path.join(kok, 'ortak/katalog');
const hedef = path.join(kok, 'telefon/web/src/ortak');
fs.mkdirSync(hedef, { recursive: true });
const dosyalar = ['semboller', 'volt-eslesme', 'kalemler', 'katsayilar', 'cizim-stili'];
// Marka metinleri (ortak/marka/hakkinda.json): telefonun Hakkında ekranı ve eklentinin Hakkında penceresi aynı metni gösterir
const markalar = ['hakkinda'];
const kopyala = (klasor, ad) => {
  const json = JSON.parse(fs.readFileSync(path.join(kok, klasor, ad + '.json'), 'utf8'));
  fs.writeFileSync(path.join(hedef, ad + '.js'),
    '// Bu dosya araclar/ortak-tablolar.mjs ile ' + klasor + '/' + ad + '.json dosyasından üretilir. Elle düzenlenmez.\n' +
    'export default ' + JSON.stringify(json) + ';\n');
};
for (const ad of dosyalar) kopyala('ortak/katalog', ad);
for (const ad of markalar) kopyala('ortak/marka', ad);
console.log('telefon/web/src/ortak: ' + dosyalar.concat(markalar).join(', '));
