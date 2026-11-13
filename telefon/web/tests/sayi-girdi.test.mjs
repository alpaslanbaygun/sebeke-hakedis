// Sayı alanı (13.11.2026): el konsolunda kanal derinliği girilemiyordu — type="number" virgülü reddediyordu.
// Ondalık alanlar artık yazı alanı + ondalık klavye; okuyucu virgül ve noktayı kabul eder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sayiOku } from '../src/ui/kit.js';
import { KANAL_DERINLIKLERI } from '../src/grid/lines.js';

test('SG1 · sayiOku: virgül ve nokta, boş → null, bozuk → undefined', () => {
  assert.equal(sayiOku('0,8'), 0.8);
  assert.equal(sayiOku('0.8'), 0.8);
  assert.equal(sayiOku(' 1,20 '), 1.2);
  assert.equal(sayiOku(',5'), 0.5);
  assert.equal(sayiOku('1,'), 1);
  assert.equal(sayiOku('-2,5'), -2.5);
  assert.equal(sayiOku(''), null);
  assert.equal(sayiOku(null), null);
  assert.equal(sayiOku('0,8m'), undefined);
  assert.equal(sayiOku('1,2,3'), undefined);
  assert.equal(sayiOku('abc'), undefined);
});

test('SG2 · Kanal derinliği: yazı alanı + tek dokunuşla seçilen derinlikler; ondalık alanlarda type="number" kalmadı', () => {
  assert.ok(KANAL_DERINLIKLERI.includes(0.7) && KANAL_DERINLIKLERI.includes(0.9));   // asgari AG / OG derinlikleri
  for (const ad of ['map', 'records']) {
    const src = fs.readFileSync(new URL('../src/ui/screens/' + ad + '.js', import.meta.url), 'utf8');
    assert.ok(ad === 'map' ? /Derinlik[^\n]*SayiGirdi/.test(src) : /const fld = [^\n]*SayiGirdi/.test(src), ad + ': derinlik alanı SayiGirdi olmalı');
    assert.ok(src.includes('KANAL_DERINLIKLERI.map'), ad + ': hızlı derinlik seçimi olmalı');
  }
  for (const ad of ['map', 'records', 'settings', 'tepe', 'project', 'export']) {
    const src = fs.readFileSync(new URL('../src/ui/screens/' + ad + '.js', import.meta.url), 'utf8');
    const ondalik = src.match(/type="number"[^>]*step="0\.\d+"/g) || [];
    assert.deepEqual(ondalik, [], ad + ': ondalık alan type="number" olmamalı');
  }
});
