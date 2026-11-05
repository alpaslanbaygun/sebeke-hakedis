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
