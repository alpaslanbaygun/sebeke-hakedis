#!/usr/bin/env node
// Lisans üretme aracı (Node). Tarayıcıda çalışan eşi: araclar/lisans/lisans-araci.html (aynı biçim). Biçim: ortak/LISANS.md.
//
//   Anahtar çifti (bir kez; gizli anahtar DEPOYA KONMAZ, yalnız lisans veren kişide durur):
//     node araclar/lisans/lisans-uret.mjs anahtar --ozel <gizli-anahtar.pem> [--acik ortak/lisans/acik-anahtar.json]
//   Lisans:
//     node araclar/lisans/lisans-uret.mjs uret --ozel <gizli-anahtar.pem> --cihaz PC-XXXX-XXXX-XXXX-XXXX
//          [--ad "Kime"] [--bitis 2027-11-13] [--urun hepsi|eklenti|telefon] [--no L-0001] [--cikti klasör]
//   Lisans aracına (lisans-araci.html) açık anahtarı yaz (anahtar komutu kendiliğinden yapar):
//     node araclar/lisans/lisans-uret.mjs arac
//   Denetle (bir lisansı açık anahtarla doğrular):
//     node araclar/lisans/lisans-uret.mjs denetle --lisans <dosya ya da metin> [--acik ortak/lisans/acik-anahtar.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { anahtarCifti, ozeldenAcik, yukKur, lisansImzala, lisansDosyasi } from './lisans-ortak.mjs';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [komut, ...arg] = process.argv.slice(2);
const sec = (ad, v) => { const i = arg.indexOf('--' + ad); return i >= 0 ? arg[i + 1] : v; };
const hata = (m) => { console.error('Hata: ' + m); process.exit(1); };
/** lisans-araci.html'deki gömülü açık anahtarı ortak/lisans/acik-anahtar.json'dan yeniler. */
function araciGuncelle() {
  const a = JSON.parse(fs.readFileSync(path.join(kok, 'ortak/lisans/acik-anahtar.json'), 'utf8'));
  const yol = path.join(kok, 'araclar/lisans/lisans-araci.html');
  const h = fs.readFileSync(yol, 'utf8');
  const y = h.replace(/\/\*ACIK-BASLA\*\/[\s\S]*?\/\*ACIK-BITIR\*\//, '/*ACIK-BASLA*/' + JSON.stringify({ n: a.n, e: a.e, parmakIzi: a.parmakIzi }) + '/*ACIK-BITIR*/');
  if (y === h && !h.includes(a.n)) hata('lisans-araci.html içinde ACIK-BASLA / ACIK-BITIR bulunamadı');
  fs.writeFileSync(yol, y);
  console.log('lisans-araci.html: açık anahtar ' + a.parmakIzi);
}

if (komut === 'anahtar') {
  const ozel = sec('ozel'); if (!ozel) hata('--ozel <dosya.pem> gerekli (depo dışında bir yer)');
  if (path.resolve(ozel).startsWith(kok + path.sep)) hata('Gizli anahtar deponun içine yazılmaz: ' + ozel);
  if (fs.existsSync(ozel)) hata('Dosya zaten var (üzerine yazılmaz): ' + ozel);
  const k = anahtarCifti();
  fs.writeFileSync(ozel, k.ozelPem, { mode: 0o600 });
  const acik = sec('acik', path.join(kok, 'ortak/lisans/acik-anahtar.json'));
  fs.writeFileSync(acik, JSON.stringify(Object.assign(k.acik, { aciklama: 'Lisans doğrulama açık anahtarı (araclar/lisans/lisans-uret.mjs anahtar). Gizli eşi depoda yoktur.', olusturma: new Date().toISOString().slice(0, 10) }), null, 1) + '\n');
  if (!sec('acik')) araciGuncelle();
  console.log('Gizli anahtar: ' + ozel + '\nAçık anahtar: ' + acik + '\nParmak izi: ' + k.acik.parmakIzi + '\nSonra: node araclar/ortak-tablolar.mjs (telefona kopyalar), eklenti derlemesi açık anahtarı gömer.');
} else if (komut === 'uret') {
  const ozel = sec('ozel'); if (!ozel || !fs.existsSync(ozel)) hata('--ozel <gizli-anahtar.pem> bulunamadı');
  const pem = fs.readFileSync(ozel, 'utf8');
  const acik = JSON.parse(fs.readFileSync(path.join(kok, 'ortak/lisans/acik-anahtar.json'), 'utf8'));
  if (ozeldenAcik(pem).n !== acik.n) console.warn('Uyarı: bu gizli anahtar ortak/lisans/acik-anahtar.json ile eşleşmiyor; programlar bu lisansı kabul etmez.');
  let yuk;
  try { yuk = yukKur({ no: sec('no', ''), ad: sec('ad', ''), cihaz: sec('cihaz'), urun: sec('urun', 'hepsi'), bitis: sec('bitis', '') }); } catch (e) { hata(e.message); }
  const lisans = lisansImzala(yuk, pem);
  const dosya = path.join(sec('cikti', '.'), (yuk.ad || 'lisans').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '_' + yuk.cihaz + '.lisans');
  fs.writeFileSync(dosya, lisansDosyasi(yuk, lisans));
  console.log(lisans + '\n\nDosya: ' + dosya);
} else if (komut === 'arac') {
  araciGuncelle();
} else if (komut === 'denetle') {
  const { lisansCoz, imzaDogru } = await import('../../telefon/web/src/core/lisans.js');
  let m = sec('lisans', ''); if (m && fs.existsSync(m)) m = fs.readFileSync(m, 'utf8');
  const acik = JSON.parse(fs.readFileSync(sec('acik', path.join(kok, 'ortak/lisans/acik-anahtar.json')), 'utf8'));
  const y = lisansCoz(m);
  console.log(y ? JSON.stringify(y, null, 1) : 'Lisans okunamadı');
  console.log('İmza: ' + (imzaDogru(m, acik) ? 'doğru' : 'GEÇERSİZ'));
} else {
  console.log('Kullanım: anahtar | uret | arac | denetle (ayrıntı dosyanın başında)');
}
