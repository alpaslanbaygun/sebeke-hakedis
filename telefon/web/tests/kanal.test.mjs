// Kanal zemini (cins / kaplama / bariyer / trencher ayrı seçilir, kalem adı tek yazı) ve proje bazında kanal listesi:
// telefon ↔ AutoCAD ortak kuralları (ortak/deneme/kanal-zemini.json, ortak/deneme/kanal-listesi.json — eklentinin
// CekirdekTest'i aynı dosyaları okur).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SH } from '../src/interop/sebeke.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ZEMIN = JSON.parse(fs.readFileSync(path.join(KOK, 'ortak/deneme/kanal-zemini.json'), 'utf8'));
const LISTE = JSON.parse(fs.readFileSync(path.join(KOK, 'ortak/deneme/kanal-listesi.json'), 'utf8'));

test('KZ1 · ortak deneme: katalogdaki 19 kanal adı çözülüp yeniden kurulunca aynı yazı (eklentiyle aynı kural)', () => {
  assert.equal(ZEMIN.katalog.length, 19);
  for (const t of ZEMIN.katalog) {
    const z = SH.kanalZeminiCoz(t);
    assert.ok(z, 'çözülemedi: ' + t);
    assert.equal(SH.kanalZeminiTanim(z), t, 'yeniden kurulum: ' + t);
  }
});

test('KZ2 · ortak deneme: cins + kaplama + bariyer + trencher → kalem adı ve okunur yazı; çözüm ve kural dışı adlar', () => {
  for (const c of ZEMIN.kurulum) {
    assert.equal(SH.kanalZeminiTanim(c), c.tanim, 'ad: ' + JSON.stringify(c));
    assert.equal(SH.kanalZeminiYazi(c), c.yazi, 'yazı: ' + c.tanim);
  }
  for (const c of ZEMIN.cozum) {
    assert.deepEqual(SH.kanalZeminiCoz(c.tanim), { cins: c.cins, kaplama: c.kaplama, bariyerli: c.bariyerli, trencher: c.trencher }, 'çözüm: ' + c.tanim);
  }
  for (const t of ZEMIN.kuralDisi) assert.equal(SH.kanalZeminiCoz(t), null, 'kural dışı: "' + t + '"');
  // Eklentinin listesiyle aynı cinsler ve kaplamalar (şerit / telefon seçimleri)
  assert.deepEqual(SH.KANAL_ZEMIN.CINSLER, ['TOPRAK', 'TUVENAN', 'MICIR', 'BRANŞMAN KANAL', 'KANAL (KABLO DEMONTAJ)']);
  assert.deepEqual(SH.KANAL_ZEMIN.KAPLAMALAR, ['', 'PARKE', 'ASFALT', 'BETON']);
  const cs = fs.readFileSync(path.join(KOK, 'autocad/src/Cekirdek/KanalZemini.cs'), 'utf8');
  assert.match(cs, /Cinsler = \{ Toprak, Tuvenan, Micir, Bransman, Demontaj \}/, 'eklentideki cins sırası');
  assert.match(cs, /Kaplamalar = \{ "", Parke, Asfalt, Beton \}/, 'eklentideki kaplama sırası');
});

test('KL1 · ortak deneme: proje bazında kanal listesi (satırlar, proje toplamları, proje × zemin × durum özeti)', () => {
  const p = SH.projeOku(LISTE.girdi);
  const l = SH.kanalListesi(p);
  assert.deepEqual(l.satirlar, LISTE.beklenen.satirlar);
  assert.deepEqual(l.projeler, LISTE.beklenen.projeler);
  assert.deepEqual(l.ozet, LISTE.beklenen.ozet);
  // Süzgeç: tek proje, tek hakediş
  assert.deepEqual(SH.kanalListesi(p, { proje: 'Merkez' }).satirlar.map((s) => s.kimlik), ['K2', 'K5', 'K1']);
  assert.deepEqual(SH.kanalListesi(p, { hakedis: 2 }).satirlar.map((s) => s.kimlik), ['K1']);
});

test('KZ3 · telefon kanal zemini: cins + kaplama + bariyer + trencher AutoCAD dosyasına kalem adıyla gider, geri alınınca aynı seçim', async () => {
  const L = await import('../src/grid/lines.js');
  // Eski tek seçim (surface) okunur
  assert.deepEqual(L.kanalZemini({ surface: 'parke' }), { zemin: 'tuvenan', kaplama: 'parke', bariyer: false, trencher: false });
  assert.equal(L.kanalZeminTanimi({ surface: 'toprak' }), 'TOPRAK');
  assert.equal(L.kanalZeminTanimi({ surface: 'beton' }), 'TOPRAK (BETON KAPLAMALI)');
  // Yeni alanlar: her birleşim
  const c = { zemin: 'micir', kaplama: 'asfalt', bariyer: true, trencher: false };
  assert.equal(L.kanalZeminTanimi(c), 'MICIR (ASFALT KAPLAMALI) (BARİYERLİ)');
  assert.equal(L.kanalZeminYazisi(c), 'Mıcır · Asfalt · bariyerli');
  assert.equal(L.kanalModel(c).surface, 'asfalt', 'poz anahtarı: kaplama');
  assert.equal(L.kanalModel({ zemin: 'micir', kaplama: '' }).surface, 'micir', 'poz anahtarı: zemin cinsi');
  // AutoCAD'den gelen ad → alanlar → aynı ad (katalogdaki 19 ad)
  for (const t of ZEMIN.katalog) {
    const a = L.zemindenAlanlar(t);
    assert.equal(a.zeminHam, undefined, 'kural içi: ' + t);
    assert.equal(L.kanalZeminTanimi(a), t, 'gidiş-dönüş: ' + t);
  }
  // Kural dışı ad olduğu gibi korunur; seçim yapılmadıkça aynen geri gider
  const k = L.zemindenAlanlar('ASFALT');
  assert.equal(k.zeminHam, 'ASFALT');
  assert.equal(L.kanalZeminTanimi(k), 'ASFALT');
  assert.equal(L.kanalLabel(k), 'ASFALT');
});

test('KL2 · telefon projesi: yeraltı kanalı cins + kaplamayla AutoCAD dosyasına gider, kanal listesi ve Excel sayfaları çıkar; geri alınca aynı seçim', async () => {
  const { setup, newProject, rtkObs } = await import('./helpers.mjs');
  const { sebekeYaz, sebekeIceAl } = await import('../src/interop/sebeke.js');
  const { eklentiModeli, workbookSheets } = await import('../src/export/exporter.js');
  const { buildExportModel } = await import('../src/export/model.js');
  const { ps } = await setup();
  await newProject(ps);
  const a = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(519300, 4282100, 1050) });
  const b = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(519330, 4282140, 1050) });
  await ps.createLine({ lineType: 'AG', install: 'yeralti', channelOnly: true, circuits: [], nodes: [a.pointId, b.pointId],
    cable: { zemin: 'tuvenan', kaplama: 'parke', bariyer: true, trencher: false, surface: 'parke', method: 'acik', depth: 1, width: 0.4 } });
  const dosya = JSON.parse(sebekeYaz(ps));
  assert.equal(dosya.kanallar.length, 1);
  assert.equal(dosya.kanallar[0].zemin, 'PARKE TUVENAN (BARİYERLİ)', 'AutoCAD dosyasına katalogdaki ad');
  const kl = SH.kanalListesi(eklentiModeli(ps));
  assert.equal(kl.satirlar.length, 1);
  assert.equal(kl.satirlar[0].cins, 'Tüvenan');
  assert.equal(kl.satirlar[0].kaplama, 'Parke');
  assert.equal(kl.satirlar[0].bariyerli, true);
  assert.equal(kl.satirlar[0].uzunluk, 50, 'uzunluk: 50 m (yukarı yuvarlanmış)');
  const sayfalar = workbookSheets(buildExportModel(ps), ps).map((s) => s.name);
  assert.ok(sayfalar.includes('Kanal Listesi') && sayfalar.includes('Kanal Özeti'), 'Excel: kanal sayfaları ' + sayfalar.join(', '));
  // Dosya başka projeye geri alınınca kanalın zemin seçimi aynı
  const p2 = await newProject(ps, { name: 'Geri alma' });
  await sebekeIceAl(ps, SH.projeOku(JSON.stringify(dosya)), { projectId: p2 && p2.id });
  const kanal = ps.data.lines.find((l) => l.install === 'yeralti' && l.channelOnly);
  assert.ok(kanal, 'kanal geri alındı');
  assert.equal(kanal.cable.zemin, 'tuvenan');
  assert.equal(kanal.cable.kaplama, 'parke');
  assert.equal(kanal.cable.bariyer, true);
});
