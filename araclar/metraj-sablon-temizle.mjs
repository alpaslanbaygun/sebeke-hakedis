#!/usr/bin/env node
// Birleşik Metraj şablonunu temizler: proje verisi (başlık, direk / açıklık satırları, formüllerin önbellek değerleri,
// paylaşılan dizeler), kişi adları, bilgisayar yolu ve Office eklenti kayıtları atılır; formüller, listeler, makro,
// biçimler ve notlar kalır. Çıktı depoya giren gömülü şablondur (ortak/sablon/birlesik-metraj.xlsm).
//
//   node araclar/metraj-sablon-temizle.mjs <kaynak.xlsm> [hedef.xlsm]
//
// Kaynak dosya (kullanıcının kendi çalışma kitabı) depoya konmaz; bkz. ortak/BIRLESIK-METRAJ.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Xlsm, hucreAdi } from '../telefon/web/src/export/xlsm.js';
import { sablonTanimi } from '../telefon/web/src/export/birlesik-metraj.js';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kaynak = process.argv[2];
const hedef = process.argv[3] || resolve(kok, 'ortak/sablon/birlesik-metraj.xlsm');
if (!kaynak) { console.error('Kullanım: node araclar/metraj-sablon-temizle.mjs <kaynak.xlsm> [hedef.xlsm]'); process.exit(2); }

const dec = (u8) => new TextDecoder().decode(u8);
const enc = (s) => new TextEncoder().encode(s);
const YAZAR = 'Şebeke-M Hakediş';
const TARIH = '2026-11-09T00:00:00Z';

const x = await Xlsm.ac(readFileSync(kaynak));
const t = sablonTanimi(x);
const rapor = { temizlenen: 0, onbellek: 0, dize: 0 };

/** Hücre doluysa (değer ya da formül) boşaltır. */
const bosalt = (s, ref, formulDe = false) => {
  const o = s.oku(ref);
  if (!o) return;
  if (o.formul != null && !formulDe) return;
  if (o.v == null && o.inline == null && o.formul == null) return;
  s.temizle(ref);
  rapor.temizlenen++;
};

for (const [hangi, o] of Object.entries({ direk: t.direk, iletken: t.iletken, yeralti: t.yeralti })) {
  if (!o) continue;
  const s = x.sayfa(o.sayfa);
  for (const ref of Object.values(o.baslik || {})) bosalt(s, ref);
  const sinir = s.sinirlar();
  const kodSutunlari = new Set(o.sutunlar.map((k) => k.sutun));
  for (let r = o.ilkVeri; r <= o.sonVeri; r++) {
    for (let c = 1; c <= Math.max(sinir.sutun, o.sonSutun); c++) {
      const ref = hucreAdi(c, r);
      if (hangi === 'iletken' && !kodSutunlari.has(c) && c !== 6) bosalt(s, ref, true);   // A–E, G–Q: elle girişler (E'de "=40+27" gibi toplamlar da)
      else bosalt(s, ref, false);
    }
  }
}

// Formüllerin önbellek değerleri (eski projeden kalan sayılar / yazılar): Excel açılınca yeniden hesaplar (fullCalcOnLoad)
for (const sb of x.sayfalar) {
  const s = x.sayfa(sb.ad);
  for (const [, satir] of s.satirlar) {
    for (const [, h] of satir.hucreler) {
      if (!h.ic || h.ic.indexOf('<f') < 0) continue;
      const yeni = h.ic.replace(/<v>[\s\S]*?<\/v>/, '').replace(/<v\/>/, '');
      const nit = h.nitelik.replace(/\s*\bt="[^"]*"/, '');
      if (yeni !== h.ic || nit !== h.nitelik) { h.ic = yeni; h.nitelik = nit; s.degisti = true; rapor.onbellek++; }
    }
  }
}

// Paylaşılan dizeler: yalnız hâlâ kullanılanlar kalır (proje adları, firma adı gibi artıklar düşer)
{
  const kullanilan = new Map();
  const hucreler = [];
  for (const sb of x.sayfalar) {
    const s = x.sayfa(sb.ad);
    for (const [, satir] of s.satirlar) for (const [, h] of satir.hucreler) {
      if (!/\bt="s"/.test(h.nitelik)) continue;
      const m = /<v>(\d+)<\/v>/.exec(h.ic);
      if (!m) continue;
      hucreler.push({ h, eski: +m[1] });
      if (!kullanilan.has(+m[1])) kullanilan.set(+m[1], kullanilan.size);
    }
    s.degisti = true;
  }
  const ss = x.dosyalar['xl/sharedStrings.xml'] ? dec(x.dosyalar['xl/sharedStrings.xml']) : '';
  const siler = [...ss.matchAll(/<si>[\s\S]*?<\/si>|<si\/>/g)].map((m) => m[0]);
  const yeniSiler = [...kullanilan.keys()].sort((a, b) => kullanilan.get(a) - kullanilan.get(b)).map((i) => siler[i] || '<si><t></t></si>');
  for (const { h, eski } of hucreler) h.ic = h.ic.replace(/<v>\d+<\/v>/, '<v>' + kullanilan.get(eski) + '</v>');
  const bas = /<sst\b[^>]*>/.exec(ss);
  const ustBilgi = bas ? bas[0].replace(/\bcount="\d+"/, 'count="' + hucreler.length + '"').replace(/\buniqueCount="\d+"/, 'uniqueCount="' + yeniSiler.length + '"') : '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + hucreler.length + '" uniqueCount="' + yeniSiler.length + '">';
  x.dosyalar['xl/sharedStrings.xml'] = enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + ustBilgi + yeniSiler.join('') + '</sst>');
  rapor.dize = siler.length - yeniSiler.length;
}

// Notlar: yazar adı
for (const ad of Object.keys(x.dosyalar)) {
  if (!/^xl\/comments\d+\.xml$/.test(ad)) continue;
  let c = dec(x.dosyalar[ad]);
  c = c.replace(/<author>[^<]*<\/author>/g, '<author>Not</author>').replace(/(<t[^>]*>)[^<:]{1,40}:(\s*)/g, '$1Not:$2');
  x.dosyalar[ad] = enc(c);
}

// Çalışma kitabı: bilgisayar yolu
x.workbook = x.workbook.replace(/<x15ac:absPath\b[^>]*\/>/, '');

// Belge özellikleri
if (x.dosyalar['docProps/core.xml']) {
  let c = dec(x.dosyalar['docProps/core.xml']);
  c = c.replace(/<dc:creator>[^<]*<\/dc:creator>/, '<dc:creator>' + YAZAR + '</dc:creator>')
    .replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>' + YAZAR + '</cp:lastModifiedBy>')
    .replace(/<cp:lastPrinted>[^<]*<\/cp:lastPrinted>/, '')
    .replace(/(<dcterms:modified[^>]*>)[^<]*(<\/dcterms:modified>)/, '$1' + TARIH + '$2');
  x.dosyalar['docProps/core.xml'] = enc(c);
}
if (x.dosyalar['docProps/app.xml']) {
  x.dosyalar['docProps/app.xml'] = enc(dec(x.dosyalar['docProps/app.xml']).replace(/<Company>[^<]*<\/Company>/, '<Company></Company>').replace(/<Manager>[^<]*<\/Manager>/, ''));
}

// Office eklenti (web extension) kayıtları
for (const ad of Object.keys(x.dosyalar)) if (ad.startsWith('xl/webextensions/')) delete x.dosyalar[ad];
if (x.dosyalar['_rels/.rels']) x.dosyalar['_rels/.rels'] = enc(dec(x.dosyalar['_rels/.rels']).replace(/<Relationship\b[^>]*webextensiontaskpanes[^>]*\/>/g, ''));
x.dosyalar['[Content_Types].xml'] = enc(dec(x.dosyalar['[Content_Types].xml']).replace(/<Override\b[^>]*PartName="\/xl\/webextensions\/[^"]*"[^>]*\/>/g, ''));

mkdirSync(dirname(hedef), { recursive: true });
const bytes = await x.yaz();
writeFileSync(hedef, bytes);

// Doğrulama: temiz dosyada proje artığı kalmamalı
const y = await Xlsm.ac(bytes);
const t2 = sablonTanimi(y);
const sorun = [];
for (const o of [t2.direk, t2.iletken, t2.yeralti]) {
  if (!o) continue;
  const s = y.sayfa(o.sayfa);
  for (const ref of Object.values(o.baslik || {})) if (s.metin(ref) !== '') sorun.push(o.sayfa + '!' + ref + ' dolu');
  for (let r = o.ilkVeri; r <= o.sonVeri; r++) for (let c = 1; c <= o.sonSutun; c++) {
    const h = s.oku(hucreAdi(c, r));
    if (h && h.formul == null && (h.v != null || h.inline != null)) sorun.push(o.sayfa + '!' + hucreAdi(c, r) + ' = ' + JSON.stringify(s.metin(hucreAdi(c, r))));
  }
}
for (const ad of Object.keys(y.dosyalar)) {
  if (!/\.(xml|rels|vml)$/.test(ad)) continue;
  const c = dec(y.dosyalar[ad]);
  if (/C:\\Users|absPath|webextension/i.test(c)) sorun.push(ad + ': bilgisayar yolu / eklenti kaydı kaldı');
  if (/^xl\/comments\d+\.xml$/.test(ad) && /<author>(?!Not<)/.test(c)) sorun.push(ad + ': not yazarı değişmedi');
}
const core = y.dosyalar['docProps/core.xml'] ? dec(y.dosyalar['docProps/core.xml']) : '';
if (core && !(core.indexOf('<dc:creator>' + YAZAR + '</dc:creator>') >= 0 && core.indexOf('<cp:lastModifiedBy>' + YAZAR + '</cp:lastModifiedBy>') >= 0)) sorun.push('docProps/core.xml: yazar adı değişmedi');
console.log('Şablon yazıldı:', hedef, '(' + bytes.length + ' bayt)');
console.log('Temizlenen hücre', rapor.temizlenen, '· önbellek değeri silinen formül', rapor.onbellek, '· atılan paylaşılan dize', rapor.dize);
console.log('Sayfalar:', y.sayfaAdlari().join(', '), '· KOD sütunu', t2.kullanilanKodlar.length, '· EK satırı', t2.malz ? t2.malz.ekSatirlari.length : 0);
if (sorun.length) { console.error('SORUN:', sorun.slice(0, 20).join('\n')); process.exit(1); }
console.log('Doğrulama tamam: veri satırları ve başlıklar boş.');
