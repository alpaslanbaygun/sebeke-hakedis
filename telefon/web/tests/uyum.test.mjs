// Masaüstü (AutoCAD eklentisi) ile telefon arasındaki veri uyumu: cins kodları, katman adları, ortak tablolar.
// Eklentideki karşılıkları: CinsKodu (cins kodu düzeltmesi), KatmanAdlari (Türkçe karaktersiz katman adı).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SH from '../src/interop/sh-core.cjs';
import KALEMLER from '../src/ortak/kalemler.js';
import ESLESME from '../src/ortak/volt-eslesme.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const katalogJson = JSON.parse(fs.readFileSync(path.join(KOK, 'ortak/katalog/kalemler.json'), 'utf8'));

test('U1 · cins kodlarındaki yazım hataları: telefonun tablosu ortak katalogdakiyle aynı, katalogda eski kod yok', () => {
  const eski = Object.fromEntries(Object.entries(katalogJson.eskiCinsler).filter(([k]) => k !== 'aciklama'));
  assert.deepEqual(SH.ESKI_CINSLER, eski, 'sh-core ESKI_CINSLER = kalemler.json eskiCinsler (eklentideki CinsKodu ile aynı tablo)');
  for (const [a, b] of Object.entries(eski)) assert.equal(SH.cinsDuzelt(a), b, a);
  assert.equal(SH.cinsDuzelt('AG_DEMİR_GLV'), 'AG_DEMİR_GLV', 'eski olmayan kod olduğu gibi');
  assert.equal(SH.cinsDuzelt(''), '');
  const eskiKodlar = new Set(Object.keys(eski));
  assert.equal(KALEMLER.kalemler.filter((k) => eskiKodlar.has(k.cins)).length, 0, 'katalog kalemlerinde eski kod yok');
  assert.equal(KALEMLER.cinsler.filter((c) => eskiKodlar.has(c.cins)).length, 0, 'cins listesinde eski kod yok');
  assert.equal(KALEMLER.cinsler.filter((c) => /̇/.test(c.ad)).length, 0, 'cins adlarında bozuk harf (i̇) yok');
  assert.ok(!JSON.stringify(ESLESME).match(/ALİMİNYUM|"KOFRA"|TECHİZAT/), 'telefon eşleme tablosunda eski kod yok');
  assert.equal(SH.cinstenElemanTuru('KOFRE'), 'KOFRE');
  assert.equal(SH.cinstenElemanTuru('KOFRA'), 'KOFRE');
  assert.equal(SH.cinstenHatTuru('AG_ALÜMİNYUM_KABLO'), 'AG_YERALTI');
  assert.equal(SH.cinstenHatTuru('OG_ALÜMİNYUM_KABLO'), 'OG_YERALTI');
});

test('U2 · katman adları Türkçe karaktersiz; eski kodlu / eski katmanlı dosya okunup yeniden yazılınca düzelir', () => {
  assert.equal(SH.katmanAscii('SC_1.HAK.MÜŞDİR'), 'SC_1.HAK.MUSDIR');
  assert.equal(SH.katmanAscii('ŞÇ_MEVCUT'), 'SC_MEVCUT');
  assert.equal(SH.katmanAscii(''), '');
  assert.deepEqual(SH.ELEMAN_TURLERI.filter((t) => /[çğıİöşüÇĞÖŞÜ]/.test(t.katman)).map((t) => t.kod), [], 'eleman katman türleri Türkçe karaktersiz');
  assert.deepEqual(SH.HAT_TURLERI.filter((t) => /[çğıİöşüÇĞÖŞÜ]/.test(t.katman)).map((t) => t.kod), [], 'hat katman türleri Türkçe karaktersiz');
  const dosya = {
    bicim: SH.BICIM, surum: 1, proje: { ad: 'Deneme', katmanOnEki: 'SÇ', koordinat: { dom: 39 } },
    elemanlar: [{ id: 'E1', tur: 'KOFRE', cins: 'KOFRA', tip: 'KOFRE TIP-1', katman: 'SÇ_STANDART', kalemler: [{ cins: 'KOFRA', tanim: 'KOFRE TIP-1', ana: true, miktar: 1 }] }],
    hatlar: [{ id: 'H1', tur: 'MUSTEREK', katman: 'SÇ_1.HAK.MÜŞTEREK_HAT', kose: [[500000, 4300000], [500030, 4300000]],
      kalemler: [{ cins: 'AG_ALİMİNYUM_KABLO', tanim: '3x95+50 Nyy Alm.', kaynak: 'HAT', miktar: 30 }] }]
  };
  const p = SH.projeOku(JSON.stringify(dosya));
  assert.equal(p.elemanlar[0].cins, 'KOFRE', 'okurken eleman cinsi düzelir');
  assert.equal(p.elemanlar[0].kalemler[0].cins, 'KOFRE', 'okurken kalem cinsi düzelir');
  assert.equal(p.hatlar[0].kalemler[0].cins, 'AG_ALÜMİNYUM_KABLO');
  const geri = JSON.parse(SH.projeYaz(p));
  assert.equal(geri.proje.katmanOnEki, 'SC', 'önek Türkçe karaktersiz yazılır');
  assert.equal(geri.elemanlar[0].katman, 'SC_STANDART');
  assert.equal(geri.hatlar[0].katman, 'SC_1.HAK.MUSTEREK_HAT', 'eski katman adı yeni adla yazılır');
  assert.equal(geri.hatlar[0].kalemler[0].cins, 'AG_ALÜMİNYUM_KABLO', 'yazarken hep yeni kod');
  assert.ok(!/ALİMİNYUM|"KOFRA"|[ÇŞÜ]_|MÜŞ/.test(JSON.stringify({ e: geri.elemanlar, h: geri.hatlar }).replace(/"tanim":"[^"]*"/g, '')), 'yazılan dosyada eski kod ve Türkçe karakterli katman yok');
});
