// Malzeme adlarının görünen yazımı (sh-core malzemeYazisi): eklentideki MalzemeYazimi.Duzelt ile aynı sonuç.
// Örnekler ortak dosyada (ortak/deneme/malzeme-yazimi.json); eklentinin denemesi (CekirdekTest) aynı dosyayı okur.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import KALEMLER from '../src/ortak/kalemler.js';

const require = createRequire(import.meta.url);
const SH = require('../src/interop/sh-core.cjs');
const here = path.dirname(new URL(import.meta.url).pathname);
const ORNEK = JSON.parse(fs.readFileSync(path.join(here, '../../../ortak/deneme/malzeme-yazimi.json'), 'utf8'));

test('Y1 · ortak örnekler: eklentiyle aynı görünen yazım', () => {
  assert.ok(ORNEK.ornekler.length >= 30);
  for (const [girdi, beklenen] of ORNEK.ornekler) assert.equal(SH.malzemeYazisi(girdi), beklenen, girdi);
});

test('Y2 · bütün katalog: ikinci uygulama değiştirmez, ad boşalmaz', () => {
  for (const k of KALEMLER.kalemler) {
    const a = SH.malzemeYazisi(k.tanim);
    assert.equal(SH.malzemeYazisi(a), a, k.tanim);
    if (k.tanim.trim()) assert.ok(a.trim().length > 0, k.tanim);
  }
});

test('Y3 · hat etiketi yeni yazımla: durum işareti + düzeltilmiş kesit', () => {
  assert.equal(SH.hatEtiketi('M', '3(1x150/25) Xlpe Alm.'), '^ 3(1x150/25) XLPE Al');
  assert.equal(SH.hatEtiketi('DM', '3X50/16+70 ALPEK'), '>3x50/16+70 ALPEK<');
  assert.equal(SH.hatEtiketi('KM', '3xSW'), '/3xSW\\');
});
