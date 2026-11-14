// Yazı ve simge çakışmaları: eklentiyle ortak deneme (ortak/deneme/yazi-cakisma/vektorler.json) ve DXF'te düzeltme
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cakisir, elemanAdaylari, hatAdaylari, yerlestir } from '../src/export/yazi-cakisma.js';

const V = JSON.parse(readFileSync(new URL('../../../ortak/deneme/yazi-cakisma/vektorler.json', import.meta.url), 'utf8'));
const yakin = (a, b, ad) => { assert.equal(a.length, b.length, ad + ' · aday sayısı'); a.forEach((p, i) => p.forEach((x, j) => assert.ok(Math.abs(x - b[i][j]) < 1e-6, ad + ' · ' + i + '/' + j + ': ' + x + ' ≠ ' + b[i][j]))); };

test('YC1 ortak vektörler: çakışma sınaması', () => { for (const c of V.cakisma) assert.equal(cakisir(c.a, c.b), c.beklenen, c.ad); });
test('YC2 ortak vektörler: eleman ve hat yazısı aday yerleri', () => {
  for (const e of V.elemanAdaylari) yakin(elemanAdaylari(e.kutu, e.a[0], e.a[1]), e.beklenen, e.ad);
  for (const h of V.hatAdaylari) yakin(hatAdaylari(h.kutu, h.a, h.b), h.beklenen, h.ad);
});
test('YC3 ortak vektörler: yerleştirme', () => { for (const y of V.yerlestirme) assert.deepEqual(yerlestir(y.engeller, y.etiketler), y.beklenen, y.ad); });

test('YC4 DXF: yakın direklerin yazıları ve metrajı çakışmaz (Yazı çakışmalarını düzelt)', async () => {
  const { buildDXF } = await import('../src/export/dxf.js');
  const { cakisir: ck } = await import('../src/export/yazi-cakisma.js');
  // Hat 30 m; iki direk hattın yakınında: birinci direğin yazısı, hattın metrajı ve iki yazı birbirine biner
  const points = [{ id: 'p1', no: '1', E: 500000, N: 4400000, H: 0 }, { id: 'p2', no: '2', E: 500030, N: 4400000, H: 0 }, { id: 'p3', no: '3', E: 500008, N: 4400003, H: 0 }, { id: 'p4', no: '4', E: 500015, N: 4400002.5, H: 0 }];
  const coords = points.slice(0, 2).map((p) => ({ id: p.id, E: p.E, N: p.N, H: p.H }));
  const model = {
    project: { name: 'Deneme' }, crs: { label: 'TM30' }, cat: null, points,
    equipment: points.map((p, i) => ({ id: 'e' + i, no: 'A-0' + (i + 1), kind: 'pole', group: 'sehir', pointId: p.id, E: p.E, N: p.N, H: 0, state: 'YENI', attrs: {}, typeName: 'G-K2' })),
    lines: [{ id: 'l1', no: 'H1', lineType: 'AG', install: 'havai', state: 'YENI', label: '3x50 Alm.', coords }]
  };
  const kutular = (text) => {
    const s = text.split('\r\n'), out = [];
    for (let i = 0; i + 1 < s.length; i += 2) if (s[i].trim() === '0' && s[i + 1] === 'TEXT') {
      const g = {}; for (let j = i + 2; j + 1 < s.length && s[j].trim() !== '0'; j += 2) g[s[j].trim()] = s[j + 1];
      if (/^A-0/.test(g['1'])) out.push({ metin: g['1'], x: +g['10'], y: +g['20'] });
    }
    return out;
  };
  const once = buildDXF(model), sonra = buildDXF(model, { yaziDuzen: true });
  assert.equal(once.stats.yaziCakisan, 0, 'kapalıyken sayılmaz');
  assert.ok(sonra.stats.yaziCakisan >= 1 && sonra.stats.yaziTasinan >= 1 && sonra.stats.yaziCozulemeyen === 0, JSON.stringify(sonra.stats));
  const k0 = kutular(once.text), k1 = kutular(sonra.text);
  assert.equal(k0.length, 4); assert.equal(k1.length, 4);
  assert.ok(k1.some((k, i) => Math.abs(k.x - k0[i].x) + Math.abs(k.y - k0[i].y) > 0.5), 'en az bir eleman yazısı taşındı');
  // Taşınmış eleman yazıları birbirine binmez (sol alt köşe + harf tablosu genişliği)
  const { yaziGenisligi } = await import('../src/export/dxf.js');
  const kut = k1.map((k) => { const w = yaziGenisligi(k.metin, 1.8); return { x: k.x + w / 2, y: k.y + 0.9, w, h: 1.8, aci: 0 }; });
  for (let i = 0; i < kut.length; i++) for (let j = i + 1; j < kut.length; j++) assert.ok(!ck(kut[i], kut[j]), k1[i].metin + ' ↔ ' + k1[j].metin);
  assert.equal(sonra.stats.texts, once.stats.texts, 'yazı sayısı aynı');
});
