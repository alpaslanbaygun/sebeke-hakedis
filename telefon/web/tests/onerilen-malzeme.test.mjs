// Önerilen malzeme (otomatik reçete) kuralları ortak dosyadan gelir (ortak/katalog/onerilen-malzeme.json); tohumdaki
// recipeRules / params onun çevirisidir. Eklentiyle ortak deneme ortak/deneme/onerilen-malzeme: aynı direk bağlamından
// aynı kalem listesi (üretici araclar/onerilen-beklenen-uret.mjs; eklenti tarafı CekirdekTest › OnerilenMalzemeOrtakDeneme).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyRules } from '../src/grid/recipe.js';
import { kurallariCevir, denemeKatalogu, direkBaglami } from '../src/grid/onerilen-malzeme.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const oku = (p) => JSON.parse(fs.readFileSync(path.join(KOK, p), 'utf8'));
const oneri = oku('ortak/katalog/onerilen-malzeme.json');
const seed = oku('telefon/web/seed/standard-tedas-2026.json');

test('OM1 · tohumdaki kurallar ve parametreler ortak dosyanın çevirisidir', () => {
  const { rules, params } = kurallariCevir(oneri, seed.standard.id);
  assert.deepEqual(seed.recipeRules, rules);
  assert.deepEqual(seed.params, params);
});

test('OM2 · ortak dosya: her kuralın nesnesi, koşulu ve kalemleri geçerli; servis kodları volt-eslesme ile AutoCAD kalemine gider (direk kuralları)', () => {
  const ve = oku('ortak/katalog/volt-eslesme.json');
  const eksik = [];
  for (const k of oneri.kurallar) {
    assert.ok(['direk', 'trafo', 'sdk', 'abone'].includes(k.nesne), k.no + ': nesne');
    for (const it of k.kalemler) {
      assert.ok(it.servis || it.kaynak, k.no + ': servis ya da kaynak');
      assert.ok(typeof it.miktar === 'number' ? it.miktar > 0 : oneri.parametreler.some((p) => p.anahtar === it.miktar) || it.miktar === '$uzunluk', k.no + ': miktar ' + it.miktar);
      if (k.nesne === 'direk' && it.servis && !ve.kalemler[it.servis]) eksik.push(it.servis);
    }
  }
  assert.deepEqual([...new Set(eksik)], [], 'volt-eslesme.json › kalemler eşlemesi olmayan direk kuralı servis kodları');
});

test('OM3 · ortak deneme: direk bağlamlarından beklenen listeler (beklenen.json)', () => {
  const durumlar = oku('ortak/deneme/onerilen-malzeme/durumlar.json').durumlar;
  const beklenen = oku('ortak/deneme/onerilen-malzeme/beklenen.json').durumlar;
  const { rules, params } = kurallariCevir(oneri);
  const cat = denemeKatalogu(rules, params);
  assert.equal(beklenen.length, durumlar.length);
  durumlar.forEach((d, i) => {
    const got = applyRules(cat.rules('pole'), direkBaglami(d.baglam), cat, {}).filter((m) => m.servis && m.src !== 'self')
      .map((m) => ({ servis: m.servis, miktar: m.qty, neden: m.why, etiket: m.tag }));
    assert.deepEqual(got, beklenen[i].kalemler, d.ad);
  });
  // çıplak AG hat yoksa mesnet izolatörü gelmez; OG direkte topraklama her rolde
  assert.ok(!beklenen[1].kalemler.some((m) => m.etiket === 'izo'), 'demetli hatta izolatör yok');
  assert.ok(beklenen[4].kalemler.some((m) => m.etiket === 'top') && beklenen[6].kalemler.some((m) => m.etiket === 'top'));
});
