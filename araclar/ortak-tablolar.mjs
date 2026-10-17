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
const dosyalar = ['semboller', 'volt-eslesme', 'kalemler', 'katsayilar'];
for (const ad of dosyalar) {
  const json = JSON.parse(fs.readFileSync(path.join(kaynak, ad + '.json'), 'utf8'));
  fs.writeFileSync(path.join(hedef, ad + '.js'),
    '// Bu dosya araclar/ortak-tablolar.mjs ile ortak/katalog/' + ad + '.json dosyasından üretilir. Elle düzenlenmez.\n' +
    'export default ' + JSON.stringify(json) + ';\n');
}
console.log('telefon/web/src/ortak: ' + dosyalar.join(', '));
