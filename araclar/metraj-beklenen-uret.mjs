#!/usr/bin/env node
// Birleşik Metraj ortak denemesinin beklenen dosyalarını yazar (ortak/deneme/birlesik-metraj):
//   sablon.json         gömülü şablonun (ortak/sablon/birlesik-metraj.xlsm) okunan tanımı
//   beklenen-plan.json  deneme projesinin (proje.sebeke.json) ayar.json ile doldurma planı
// Eklentinin CekirdekTest'i ve telefonun tests/birlesik-metraj.test.mjs'i aynı girdiden aynı çıktıyı üretmek zorundadır
// (DEVIR.md çalışma kuralı). Kural değişince: node araclar/metraj-beklenen-uret.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import SH from '../telefon/web/src/interop/sh-core.cjs';
import { Xlsm } from '../telefon/web/src/export/xlsm.js';
import { sablonTanimi, planAyari } from '../telefon/web/src/export/birlesik-metraj.js';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const klasor = resolve(kok, 'ortak/deneme/birlesik-metraj');
const x = await Xlsm.ac(readFileSync(resolve(kok, 'ortak/sablon/birlesik-metraj.xlsm')));
const sablon = sablonTanimi(x);
const p = SH.projeOku(readFileSync(resolve(klasor, 'proje.sebeke.json'), 'utf8'));
const ayarJson = JSON.parse(readFileSync(resolve(klasor, 'ayar.json'), 'utf8'));
const ayar = planAyari(ayarJson, {
  katsayilar: JSON.parse(readFileSync(resolve(kok, 'ortak/katalog/katsayilar.json'), 'utf8')),
  eslesme: JSON.parse(readFileSync(resolve(kok, 'ortak/katalog/metraj-sablon.json'), 'utf8')),
  kalemler: JSON.parse(readFileSync(resolve(kok, 'ortak/katalog/kalemler.json'), 'utf8'))
});
const plan = SH.birlesikMetraj(p, sablon, ayar);
const yaz = (ad, veri) => { writeFileSync(resolve(klasor, ad), JSON.stringify(veri, null, 1) + '\n'); console.log('yazıldı:', ad); };
yaz('sablon.json', sablon);
yaz('beklenen-plan.json', plan);
console.log('özet', JSON.stringify(plan.ozet), 'uyarı', plan.uyarilar.length);
