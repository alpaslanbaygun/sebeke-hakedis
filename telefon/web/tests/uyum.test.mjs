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

test('U3 · simge ve yazı boyutları proje dosyasında (proje.boyutlar): eklentiyle aynı alanlar, varsayılan yazılmaz', () => {
  // Eklentideki ProjeDosyasi aynı alan adlarını yazar ve okur
  const cs = fs.readFileSync(path.join(KOK, 'autocad/src/Cekirdek/ProjeDosyasi.cs'), 'utf8');
  for (const k of Object.keys(SH.BOYUT_VARSAYILAN)) assert.ok(cs.includes('"' + k + '"'), 'eklenti de yazıyor: ' + k);
  assert.ok(cs.includes('pj["boyutlar"]') && cs.includes('pj.Nesne("boyutlar")'), 'eklentide proje.boyutlar');
  const model = fs.readFileSync(path.join(KOK, 'autocad/src/Cekirdek/Model.cs'), 'utf8');
  const v = SH.BOYUT_VARSAYILAN;
  assert.ok(model.includes('VarsayilanSimge = ' + v.simgeOlcegi + ',') && model.includes('VarsayilanEtiket = ' + v.etiketYuksekligi + ',') &&
    model.includes('VarsayilanMetraj = ' + v.metrajYuksekligi + ',') && model.includes('VarsayilanEleman = ' + v.elemanYaziYuksekligi + ';'), 'varsayılanlar iki tarafta aynı');

  assert.equal(SH.boyutlarOku(null), null);
  assert.equal(SH.boyutlarOku(Object.assign({}, v)), null, 'hepsi varsayılansa yazılmaz');
  const ek = { hatKalinligi: 1, malzemeYazisi: false };
  assert.deepEqual(SH.boyutlarOku({ simgeOlcegi: 2, etiketYuksekligi: '2,5' }), Object.assign({ simgeOlcegi: 2, etiketYuksekligi: 2.5, metrajYuksekligi: 1.44, elemanYaziYuksekligi: 1.8 }, ek), 'eksik alan varsayılan, virgüllü sayı okunur');
  assert.deepEqual(SH.boyutlarOku({ simgeOlcegi: 99, metrajYuksekligi: -1, elemanYaziYuksekligi: 3 }), Object.assign({ simgeOlcegi: 1, etiketYuksekligi: 1.8, metrajYuksekligi: 1.44, elemanYaziYuksekligi: 3 }, ek), 'aralık dışı değer varsayılana döner');
  assert.deepEqual(SH.boyutlarOku({ hatKalinligi: 0, malzemeYazisi: true }), Object.assign({ simgeOlcegi: 1, etiketYuksekligi: 1.8, metrajYuksekligi: 1.44, elemanYaziYuksekligi: 1.8 }, { hatKalinligi: 0, malzemeYazisi: true }), 'hat kalınlığı 0 (ince çizgi) ve malzeme yazısı');
  assert.equal(SH.boyutlarOku({ hatKalinligi: 9 }), null, 'aralık dışı kalınlık varsayılana döner (hepsi varsayılan)');
  assert.ok(cs.includes('"hatKalinligi"') && cs.includes('"malzemeYazisi"'), 'eklenti de hat kalınlığı ve malzeme yazısını yazıyor');
  assert.ok(model.includes('VarsayilanKalinlik = ' + v.hatKalinligi + ';') && model.includes('VarsayilanMalzemeYazisi = ' + v.malzemeYazisi + ';'), 'yeni varsayılanlar iki tarafta aynı');

  const dosya = { bicim: SH.BICIM, surum: 1, proje: { ad: 'Deneme', katmanOnEki: 'SC', koordinat: { dom: 39 }, boyutlar: { simgeOlcegi: 1.5, etiketYuksekligi: 2, metrajYuksekligi: 1.6, elemanYaziYuksekligi: 2.2, hatKalinligi: 1.5, malzemeYazisi: true } } };
  const p = SH.projeOku(JSON.stringify(dosya));
  assert.deepEqual(p.proje.boyutlar, dosya.proje.boyutlar, 'okunur');
  const geri = JSON.parse(SH.projeYaz(p));
  assert.deepEqual(geri.proje.boyutlar, dosya.proje.boyutlar, 'yazılır');
  const anahtarlar = Object.keys(geri.proje);
  assert.equal(anahtarlar.indexOf('boyutlar'), anahtarlar.indexOf('gisOnEki') + 1, 'eklentideki sırayla: gisOnEki ardından');
  p.proje.boyutlar = Object.assign({}, v);
  assert.equal(JSON.parse(SH.projeYaz(p)).proje.boyutlar, undefined, 'varsayılan boyutlar yazılmaz');
  const bos = SH.projeOku(JSON.stringify({ bicim: SH.BICIM, surum: 1, proje: { ad: 'X', boyutlar: { simgeOlcegi: 1 } } }));
  assert.equal(bos.proje.boyutlar, undefined, 'varsayılan boyutlar okununca da düşer');
});
