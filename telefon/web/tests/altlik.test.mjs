// Harita altlıkları eklentiyle aynı sağlayıcılar: ArcGIS anahtarlı Esri, Bing (kurumsal anahtar, meta veriyle karo
// adresi), Azure Maps; Bing tipi karo anahtarı (quadkey). Eklentideki karşılığı: Cekirdek/HaritaAltligi.cs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quadKey } from '../src/geo/tiles.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ekleme = fs.readFileSync(path.resolve(here, '../../../autocad/src/Cekirdek/HaritaAltligi.cs'), 'utf8');
// services.js arayüz kitini (Preact) içe aktarır: paketler kurulu değilse (yerel deneme) bu denemeler atlanır
let S = null;
try { S = await import('../src/ui/services.js'); } catch (e) { if (!/preact|htm/.test(String(e && e.message))) throw e; }

test('L1 · Bing karo anahtarı (quadkey) eklentiyle aynı', () => {
  assert.equal(quadKey(3, 5, 3), '213', 'Bing belgesindeki örnek (eklentinin denemesiyle aynı)');
  assert.equal(quadKey(0, 0, 1), '0');
  assert.equal(quadKey(1, 1, 1), '3');
});

test('L2 · eklentinin bütün altlıkları telefonda da var; düz karo adresleri ve atıfları aynı', { skip: !S && 'Preact kurulu değil' }, () => {
  const saglayicilar = [...ekleme.matchAll(/new AltlikSaglayici \{([\s\S]*?)\},\n/g)].map((m) => {
    const al = (k) => { const r = new RegExp(k + ' = "([^"]*)"').exec(m[1]); return r ? r[1] : ''; };
    return { id: al('Id'), url: al('Url'), tur: al('Tur'), atif: al('Atif') };
  });
  assert.ok(saglayicilar.length >= 14, 'eklentinin sağlayıcı listesi okundu');
  for (const s of saglayicilar) {
    const b = S.BASEMAPS.find((x) => x.id === s.id);
    assert.ok(b, 'telefonda ' + s.id + ' altlığı');
    if (s.url && !s.tur) assert.equal(b.url, s.url, s.id + ' karo adresi');
    if (s.atif) assert.equal(b.attr, s.atif, s.id + ' atıf');
  }
});

test('L3 · karo adresleri: ArcGIS anahtarı, Azure anahtarı, Bing meta verisi, özel adreste {q}', { skip: !S && 'Preact kurulu değil' }, async () => {
  const keys = { esri: 'ESRI-K', azure: 'AZ K', bing: 'BING-K', ozelUrl: 'https://karo.example/{q}.png' };
  const bul = (id) => S.basemapById(id);
  assert.equal(await S.tileUrl(bul('esri_k'), 5, 3, 7, keys), 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/5/7/3?token=ESRI-K');
  assert.equal(await S.tileUrl(bul('azure_s'), 5, 3, 7, keys), 'https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=microsoft.imagery&zoom=5&x=3&y=7&tileSize=256&subscription-key=AZ%20K');
  assert.equal(await S.tileUrl(bul('ozel'), 3, 3, 5, keys), 'https://karo.example/213.png');
  // Bing: meta veri bir kez alınır; karo adresi şablondan (alt alan sırayla, quadkey, tr-TR)
  const eski = globalThis.fetch;
  let istek = 0, adres = '';
  globalThis.fetch = async (u) => { istek++; adres = u; return { ok: true, status: 200, json: async () => ({ resourceSets: [{ resources: [{ imageUrl: 'https://ecn.{subdomain}.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=1&mkt={culture}', imageUrlSubdomains: ['t0', 't1', 't2', 't3'] }] }] }) }; };
  try {
    const u1 = await S.tileUrl(bul('bing_a'), 3, 3, 5, keys), u2 = await S.tileUrl(bul('bing_a'), 3, 2, 5, keys);
    assert.equal(u1, 'https://ecn.t0.tiles.virtualearth.net/tiles/a213.jpeg?g=1&mkt=tr-TR');
    assert.ok(u2.startsWith('https://ecn.t3.'), 'alt alan (x + y) sırasıyla');
    assert.equal(istek, 1, 'meta veri saklanır');
    assert.ok(adres.startsWith('https://dev.virtualearth.net/REST/v1/Imagery/Metadata/Aerial?key=BING-K'), 'meta veri adresi');
  } finally { globalThis.fetch = eski; }
  // Aynı anda istenen karolar tek meta veri isteğini bekler; reddedilen anahtar her karo için yeniden sorulmaz
  globalThis.fetch = async (u) => { istek++; return u.includes('RED') ? { ok: false, status: 401, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ resourceSets: [{ resources: [{ imageUrl: 'https://ecn.{subdomain}.t/a{quadkey}', imageUrlSubdomains: ['t0'] }] }] }) }; };
  try {
    istek = 0;
    await Promise.all([0, 1, 2, 3, 4].map((i) => S.tileUrl(bul('bing_h'), 5, i, 7, { bing: 'YENI-K' })));
    assert.equal(istek, 1, 'beş karo, bir meta veri isteği');
    istek = 0;
    for (let i = 0; i < 3; i++) await assert.rejects(() => S.tileUrl(bul('bing_a'), 5, i, 7, { bing: 'RED-K' }), (e) => e.durum === 401);
    assert.equal(istek, 1, 'reddedilen anahtar bir kez soruldu');
  } finally { globalThis.fetch = eski; }
  await assert.rejects(() => S.tileUrl(bul('azure_m'), 1, 0, 0, {}), (e) => e.anahtar === true, 'anahtarsız denenmez');
});
