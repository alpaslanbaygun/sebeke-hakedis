// Ortak simge takımı: telefonun tablosu (src/export/semboller.js) depodaki ortak dosyayla
// (ortak/katalog/semboller.json) aynı mı, her aile için dört varyant var mı, blok adları eklentiyle aynı mı?
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import SEMBOLLER from '../src/ortak/semboller.js';
import { sembolBlogu, sembolAilesi, sembolVaryanti } from '../src/export/dxf.js';

const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

test('S1 · telefondaki ortak tablolar (src/ortak/*.js) depodaki ortak/katalog/*.json ile birebir aynı', async () => {
  for (const ad of ['semboller', 'volt-eslesme', 'kalemler', 'katsayilar', 'cizim-stili']) {
    const json = JSON.parse(fs.readFileSync(path.join(kok, 'ortak/katalog/' + ad + '.json'), 'utf8'));
    const mod = (await import('../src/ortak/' + ad + '.js')).default;
    assert.deepEqual(mod, json, ad + ' (node araclar/ortak-tablolar.mjs çalıştırın)');
  }
  assert.equal(SEMBOLLER.bicim, 'sebeke-hakedis.semboller');
});

test('S2 · her aile için YENI · MEVCUT · DMM · DM varyantları var ve geometrisi boş değil', () => {
  const aileler = Object.keys(SEMBOLLER.aileler);
  assert.ok(aileler.length >= 16);
  for (const a of aileler) for (const v of ['YENI', 'MEVCUT', 'DMM', 'DM']) {
    const s = SEMBOLLER.semboller[a + '_' + v];
    assert.ok(Array.isArray(s) && s.length > 0, a + '_' + v);
    for (const i of s) assert.ok(['L', 'C', 'P', 'S', 'D', 'Y'].includes(i[0]), 'ilkel türü ' + i[0]);
  }
  // Dolu varyantta dolgu, mevcutta dolgu yok, demontajda çapraz çizgi
  assert.ok(SEMBOLLER.semboller.DIREK_AG_YENI.some((i) => i[0] === 'D'));
  assert.ok(!SEMBOLLER.semboller.DIREK_AG_MEVCUT.some((i) => i[0] === 'D' || i[0] === 'S'));
  assert.ok(SEMBOLLER.semboller.KAFES_OG_DM.some((i) => i[0] === 'L' && i[1] < 0 && i[3] > 0 && i[1] === i[2]));
  // OG direklerde topraklama işareti (alta inen çizgi), AG'de yok
  assert.ok(SEMBOLLER.semboller.DIREK_OG_MEVCUT.some((i) => i[0] === 'L' && i[1] === 0 && i[3] === 0 && i[4] < -3));
  assert.ok(!SEMBOLLER.semboller.DIREK_AG_MEVCUT.some((i) => i[0] === 'L'));
});

test('S3 · blok adları eklentiyle aynı kurala göre seçilir (SH_<aile>_<varyant>)', () => {
  const direk = (ek) => Object.assign({ kind: 'pole', group: 'sehir', symbol: 's', volt: 'AG', state: 'YENI' }, ek);
  assert.equal(sembolBlogu(direk({})), 'SH_KAFES_AG_YENI');
  assert.equal(sembolBlogu(direk({ symbol: 'c', group: 'beton' })), 'SH_DIREK_AG_YENI');
  assert.equal(sembolBlogu(direk({ symbol: 'c', group: 'beton', state: 'MEVCUT' })), 'SH_DIREK_AG_MEVCUT');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'bahh', state: 'DMM' })), 'SH_KAFES_OG_DMM');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'mus', state: 'DEMONTAJ' })), 'SH_KAFES_OG_DM');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'beton562', symbol: 'c', state: 'ILERIDE' })), 'SH_DIREK_OG_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'lighting', group: 'ayd', symbol: 'c', state: 'YENI' }), 'SH_DIREK_AYD_YENI');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'yeni', attrs: { post: 'direk' } }), 'SH_TRAFO_DIREK_YENI');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'mevcut', attrs: { post: 'bina' } }), 'SH_TRAFO_BINA_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'tasinan', attrs: { post: 'mbk' } }), 'SH_TRAFO_KOSK_DMM');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'demontaj', attrs: { post: 'mono' } }), 'SH_TRAFO_KOSK_DM');
  assert.equal(sembolBlogu({ kind: 'sdk', state: 'YENI' }), 'SH_SDK_YENI');
  assert.equal(sembolBlogu({ kind: 'panel', state: 'MEVCUT' }), 'SH_PANO_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'manhole', state: 'MEVCUT' }), 'SH_MENHOL_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'luminaire', state: 'YENI' }), 'SH_ARMATUR_YENI');
  assert.equal(sembolBlogu({ kind: 'other', state: 'DEMONTAJ' }), 'SH_DIGER_DM');
  assert.equal(sembolBlogu({ kind: 'subscriber', state: 'YENI' }), 'SH_ABONE_YENI');
  assert.equal(sembolAilesi({ kind: 'kiosk', state: 'yeni', attrs: {} }), 'TRAFO_DIREK'); // post yoksa direk tipi sayılır (eski davranış)
  assert.equal(sembolVaryanti('tasinan'), 'DMM');
  for (const e of [direk({}), { kind: 'transformer', state: 'yeni', attrs: { post: 'direk' } }, { kind: 'sdk', state: 'YENI' }])
    assert.ok(SEMBOLLER.semboller[sembolBlogu(e).slice(3)], 'tabloda var: ' + sembolBlogu(e));
});
