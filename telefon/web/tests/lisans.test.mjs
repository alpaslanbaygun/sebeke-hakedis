// Lisans (13.11.2026): ortak denemeler (ortak/deneme/lisans/vektorler.json; eklentide CekirdekTest aynı dosyayı dener).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { cihazKodu, lisansDurumu, lisansCoz, imzaDogru, sha256, lisansAyikla } from '../src/core/lisans.js';

const V = JSON.parse(fs.readFileSync(new URL('../../../ortak/deneme/lisans/vektorler.json', import.meta.url), 'utf8'));

test('LS1 · SHA-256 Node ile aynı', () => {
  for (const s of ['', 'abc', 'Şebeke-M ğüşiöç', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(1000)]) {
    assert.equal(Buffer.from(sha256(s)).toString('hex'), crypto.createHash('sha256').update(s, 'utf8').digest('hex'), JSON.stringify(s.slice(0, 10)));
  }
});

test('LS2 · cihaz kodları', () => {
  for (const c of V.cihazlar) assert.equal(cihazKodu(c.onek, c.ham), c.kod, c.onek);
  assert.match(cihazKodu('TL', 'abc'), /^TL-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
});

test('LS3 · ortak durumlar', () => {
  for (const d of V.durumlar) {
    const r = lisansDurumu(d, V.anahtar);
    const al = { tur: r.tur, kullanilabilir: r.kullanilabilir, kalanGun: r.kalanGun, uyari: r.uyari, hataKodu: r.hataKodu, saatGeri: r.saatGeri };
    assert.deepEqual(al, d.beklenen, d.ad);
    assert.ok(r.mesaj && typeof r.mesaj === 'string', d.ad + ': mesaj');
  }
});

test('LS4 · gerçek açık anahtar biçimi; deneme anahtarıyla imzalı lisans gerçek anahtarla geçmez', () => {
  const gercek = JSON.parse(fs.readFileSync(new URL('../../../ortak/lisans/acik-anahtar.json', import.meta.url), 'utf8'));
  assert.equal(gercek.bicim, 'sebeke-hakedis.lisans-anahtari');
  assert.equal(Buffer.from(gercek.n, 'base64url').length, 256, '2048 bit');
  assert.notEqual(gercek.n, V.anahtar.n, 'denemeler gerçek anahtarı kullanmaz');
  const d = V.durumlar.find((x) => x.beklenen.tur === 'lisansli');
  assert.ok(imzaDogru(d.lisans, V.anahtar)); assert.ok(!imzaDogru(d.lisans, gercek));
  assert.equal(lisansCoz(d.lisans).v, 1);
  assert.equal(lisansAyikla('  ' + d.lisans.slice(0, 50) + '\n ' + d.lisans.slice(50)), d.lisans);
});

test('LS5 · telefon lisans servisi: ilk açılış yazılır, 8. gün kilit, geçerli lisans kaydedilir, geçersiz kaydedilmez, saat geri alınamaz', async () => {
  const { lisansYukle, lisansDene, cihazBilgisi } = await import('../src/services/lisans-service.js');
  const depo = new Map();
  const ds = { setting: async (k, v) => { if (v === undefined) return depo.get(k); depo.set(k, JSON.parse(JSON.stringify(v))); return v; } };
  const TL = V.cihazlar.find((c) => c.onek === 'TL').kod;
  const cihaz = { kod: TL };
  let d = await lisansYukle({ ds, cihaz, bugun: '2026-11-13', anahtar: V.anahtar });
  assert.equal(d.tur, 'deneme'); assert.equal(d.kalanGun, 7);
  assert.equal(depo.get('lisans').ilkAcilis, '2026-11-13');
  d = await lisansYukle({ ds, cihaz, bugun: '2026-11-20', anahtar: V.anahtar });
  assert.equal(d.tur, 'bitti'); assert.equal(d.kullanilabilir, false, '8. gün kilit');
  d = await lisansYukle({ ds, cihaz, bugun: '2026-11-14', anahtar: V.anahtar });
  assert.equal(d.tur, 'bitti', 'saat geri alınınca son görülme esas alınır'); assert.equal(d.saatGeri, true);
  const yanlis = V.durumlar.find((x) => x.beklenen.hataKodu === 'imza').lisans;
  d = await lisansDene({ ds, cihaz, metin: yanlis, kaydet: true, bugun: '2026-11-20', anahtar: V.anahtar });
  assert.equal(d.hataKodu, 'imza'); assert.equal(depo.get('lisans').metin || '', '', 'geçersiz lisans kaydedilmez');
  const iyi = V.durumlar.find((x) => x.ad.startsWith('"hepsi"')).lisans;
  d = await lisansDene({ ds, cihaz, metin: '# açıklama\n' + iyi + '\n', kaydet: true, bugun: '2026-11-20', anahtar: V.anahtar });
  assert.equal(d.tur, 'lisansli'); assert.equal(depo.get('lisans').metin, iyi, 'yalnız lisans metni saklanır');
  d = await lisansYukle({ ds, cihaz, bugun: '2026-11-21', anahtar: V.anahtar });
  assert.equal(d.tur, 'lisansli'); assert.equal(d.kalanGun, 52);
  // Köprüsüz (web / eski APK): rastgele kimlik bir kez üretilir, sonra aynı kalır
  const c1 = await cihazBilgisi({ ds, bridge: null, web: true }), c2 = await cihazBilgisi({ ds, bridge: null, web: true });
  assert.match(c1.kod, /^WB-/); assert.equal(c1.kod, c2.kod);
  const c3 = await cihazBilgisi({ ds, bridge: { isNative: () => true, cihazKimligi: async () => ({ id: '9774d56d682e549c' }) }, web: false });
  assert.equal(c3.kod, TL, 'Android: ANDROID_ID ortak denemedeki kodu verir');
});
