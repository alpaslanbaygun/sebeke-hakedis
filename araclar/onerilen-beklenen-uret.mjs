#!/usr/bin/env node
// Önerilen malzeme ortak denemesinin beklenen dosyasını yazar (ortak/deneme/onerilen-malzeme/beklenen.json):
// durumlar.json'daki her direk bağlamı için ortak kuralların (ortak/katalog/onerilen-malzeme.json) verdiği kalemler,
// telefonun motoruyla (telefon/web/src/grid/recipe.js › applyRules). Eklentinin CekirdekTest'i ve telefonun
// tests/onerilen-malzeme.test.mjs'i aynı listeyi üretmek zorundadır (DEVIR.md çalışma kuralı).
// Kural değişince: node araclar/onerilen-beklenen-uret.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyRules } from '../telefon/web/src/grid/recipe.js';
import { kurallariCevir, denemeKatalogu, direkBaglami } from '../telefon/web/src/grid/onerilen-malzeme.js';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const klasor = resolve(kok, 'ortak/deneme/onerilen-malzeme');
const oneri = JSON.parse(readFileSync(resolve(kok, 'ortak/katalog/onerilen-malzeme.json'), 'utf8'));
const durumlar = JSON.parse(readFileSync(resolve(klasor, 'durumlar.json'), 'utf8'));
const { rules, params } = kurallariCevir(oneri);
const cat = denemeKatalogu(rules, params);
const beklenen = durumlar.durumlar.map((d) => ({
  ad: d.ad,
  kalemler: applyRules(cat.rules('pole'), direkBaglami(d.baglam), cat, {}).filter((m) => m.servis && m.src !== 'self')
    .map((m) => ({ servis: m.servis, miktar: m.qty, neden: m.why, etiket: m.tag }))
}));
writeFileSync(resolve(klasor, 'beklenen.json'), JSON.stringify({ bicim: 'sebeke-hakedis.deneme.onerilen-malzeme.beklenen', durumlar: beklenen }, null, 1) + '\n');
console.log('yazıldı: beklenen.json ·', beklenen.map((b) => b.kalemler.length).join(' '));
