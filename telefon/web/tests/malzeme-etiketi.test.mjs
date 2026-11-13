// Malzemelerin çizimde yazılması ve hat kalınlığı: telefon ↔ AutoCAD ortak kurallar (ortak/deneme/malzeme-etiketi.json —
// eklentinin CekirdekTest'i aynı dosyayı okur; eklentide Cekirdek/MalzemeEtiketi.cs ve CizimStili.HatKalinligi).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SH } from '../src/interop/sebeke.js';
import { buildDXF, hatKalinligi, MALZEME_YAZISI } from '../src/export/dxf.js';
import STIL from '../src/ortak/cizim-stili.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ORTAK = JSON.parse(fs.readFileSync(path.join(KOK, 'ortak/deneme/malzeme-etiketi.json'), 'utf8'));

/** DXF metnini varlıklara böler (grup kodu → değerler). */
function varliklar(metin) {
  const s = metin.split('\r\n');
  const out = [];
  let cur = null;
  for (let i = 0; i + 1 < s.length; i += 2) {
    const kod = s[i].trim(), deger = s[i + 1];
    if (kod === '0') { cur = { tur: deger, g: {} }; out.push(cur); continue; }
    if (cur) (cur.g[kod] = cur.g[kod] || []).push(deger);
  }
  return out;
}

test('ME1 · ortak deneme: elemanın malzeme satırları ve tek satır yazımı (eklentiyle aynı kural)', () => {
  const p = SH.projeOku(ORTAK.girdi);
  assert.equal(p.elemanlar.length, Object.keys(ORTAK.beklenen).length);
  for (const e of p.elemanlar) assert.deepEqual(SH.malzemeEtiketi(e), ORTAK.beklenen[e.id], 'eleman ' + e.id);
  for (const t of ORTAK.tekSatir) assert.equal(SH.malzemeEtiketiSatir(t.ad, t.miktar, t.birim, t.durum), t.beklenen);
  // Yazı yüksekliği oranı ve satır aralığı eklentideki sabitlerle aynı
  const cs = fs.readFileSync(path.join(KOK, 'autocad/src/Cekirdek/MalzemeEtiketi.cs'), 'utf8');
  assert.ok(cs.includes('YukseklikOrani = ' + MALZEME_YAZISI.oran + ';') && cs.includes('SatirAraligi = ' + MALZEME_YAZISI.aralik + ';'), 'oran ve aralık iki tarafta aynı');
  assert.ok(cs.includes('EtiketOnEki = "MLZ_"'), 'eklentide MLZ_ öznitelikleri');
});

test('ME2 · hat kalınlığı: stildeki kalınlık × kat, eklentiyle aynı yuvarlama; kanal ve sondaj ince', () => {
  const ag = { lineType: 'AG', install: 'havai' }, og = { lineType: 'OG', install: 'havai' }, agKablo = { lineType: 'AG', install: 'yeralti' };
  assert.equal(hatKalinligi(og, 1), 0.5, 'OG havai 0,5 (CekirdekTest ile aynı)');
  assert.equal(hatKalinligi(ag, 1), 0.35, 'AG havai 0,35');
  assert.equal(hatKalinligi(agKablo, 1.5), 0.52, 'AG yeraltı 1,5 kat = 0,52 (eklentide de)');
  assert.equal(hatKalinligi(og, 0), 0, '0 kat ince çizgi');
  assert.equal(hatKalinligi({ lineType: 'AG', install: 'yeralti', channelOnly: true, cable: { method: 'acik' } }, 1), 0, 'kanal ince');
  for (const k of ['HAT_AG', 'HAT_OG', 'HAT_AYD', 'HAT_ENH', 'HAT_ABONE', 'HAT_MUSTEREK', 'KABLO', 'KABLO_OG']) assert.ok(STIL.katmanlar[k].kalinlik > 0, 'stilde kalınlık: ' + k);
  for (const k of ['KANAL', 'SONDAJ']) assert.ok(!STIL.katmanlar[k].kalinlik, 'stilde kalınlık yok: ' + k);
});

test('ME3 · DXF: kalın hat genişlikli çoklu çizgi, ince çizgide eski LINE; malzeme satırları eleman yazısının altında', () => {
  const points = [{ id: 'p1', no: '1', E: 500000, N: 4400000, H: 1000 }, { id: 'p2', no: '2', E: 500030, N: 4400000, H: 1001 }];
  const coords = points.map((p) => ({ id: p.id, E: p.E, N: p.N, H: p.H }));
  const model = (boyutlar) => ({
    project: { name: 'Deneme', boyutlar }, crs: { label: 'TM30' }, cat: null, points,
    equipment: points.map((p, i) => ({ id: 'e' + i, no: 'B' + (i + 1), kind: 'pole', volt: 'AG', group: 'ag', typeName: 'G-10I', pointId: p.id, E: p.E, N: p.N, H: p.H, state: 'YENI', attrs: {} })),
    lines: [{ id: 'l1', no: 'H1', lineType: 'AG', install: 'havai', state: 'YENI', label: '3x35/16+50 AER', coords }],
  });
  const satirlar = { e0: ['GT-60=1 (M)', 'N80 İZOLATÖR=2 (M)'] };

  // Varsayılan: kalın (1 kat), malzeme yazısı kapalı (satırlar verilse de yazılmaz)
  let d = buildDXF(model(undefined), { malzemeSatirlari: satirlar });
  let v = varliklar(d.text);
  const kalin = v.filter((x) => x.tur === 'POLYLINE' && x.g['40'] && x.g['8'][0] === STIL.katmanlar.HAT_AG.telefon);
  assert.equal(kalin.length, 1, 'hat bir çoklu çizgi');
  assert.equal(+kalin[0].g['40'][0], 0.35, 'AG havai 0,35 genişlik');
  assert.equal(+kalin[0].g['70'][0], 128, 'çizgi tipi köşelerde bölünmez');
  assert.equal(v.filter((x) => x.tur === 'LINE' && x.g['8'][0] === STIL.katmanlar.HAT_AG.telefon).length, 0, 'kalın hatta LINE yok');
  assert.equal(d.stats.thick, 1);
  assert.equal(d.stats.materials, 0, 'malzeme yazısı kapalı');

  // İnce çizgi + malzeme yazısı açık
  d = buildDXF(model({ hatKalinligi: 0, malzemeYazisi: true }), { malzemeSatirlari: satirlar });
  v = varliklar(d.text);
  const cizgi = v.filter((x) => x.tur === 'LINE' && x.g['8'][0] === STIL.katmanlar.HAT_AG.telefon);
  assert.equal(cizgi.length, 1, 'ince çizgide eski LINE');
  assert.equal(+cizgi[0].g['30'][0], 1000, 'ince çizgide kot korunur');
  assert.equal(d.stats.materials, 2);
  const yazilar = v.filter((x) => x.tur === 'TEXT');
  // DXF R12'dir: MTEXT yok (AutoCAD açmaz, 13.11.2026) — malzemeler satır satır TEXT
  assert.equal(v.filter((x) => x.tur === 'MTEXT').length, 0, 'R12 DXF\'te MTEXT yok');
  const eleman = yazilar.find((x) => x.g['1'][0] === 'B1 G-10I'), m1 = yazilar.find((x) => x.g['1'][0] === 'GT-60=1 (M)'), m2 = yazilar.find((x) => x.g['1'][0] === 'N80 İZOLATÖR=2 (M)');
  assert.ok(eleman && m1 && m2, 'eleman yazısı ve iki malzeme satırı');
  const th = STIL.yazi.yukseklik, hm = th * MALZEME_YAZISI.oran;
  assert.equal(+m1.g['40'][0], +hm.toFixed(4), 'malzeme yazısı eleman yazısının 0,7si');
  assert.equal(+m1.g['10'][0], +eleman.g['10'][0], 'eleman yazısıyla aynı hizada');
  assert.ok(Math.abs(+eleman.g['20'][0] - (0.45 * th + 1.15 * hm) - +m1.g['20'][0]) < 1e-3, 'ilk satır eleman yazısının altında');
  assert.ok(Math.abs(+m1.g['20'][0] - hm * MALZEME_YAZISI.aralik - +m2.g['20'][0]) < 1e-3, 'satır aralığı');
  assert.equal(+m1.g['62'][0], 7, 'beyaz / siyah');
});

test('ME4 · telefon projesi: malzeme yazısı açıkken DXF eklentinin kuralıyla satırları yazar', async () => {
  const { setup, newProject, rtkObs } = await import('./helpers.mjs');
  const { exportFormat, malzemeSatirlari, eklentiModeli } = await import('../src/export/exporter.js');
  const { ps } = await setup();
  await newProject(ps);
  const a = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(519300, 4282100, 1050) });
  assert.equal(malzemeSatirlari(ps), null, 'kapalıyken yok');
  await ps.updateProject({ sebeke: Object.assign({}, ps.p.sebeke || {}, { boyutlar: SH.boyutlarOku({ malzemeYazisi: true }) }) }, 'deneme');
  const m = malzemeSatirlari(ps);
  assert.ok(m && typeof m === 'object', 'açıkken nesne');
  const el = eklentiModeli(ps).elemanlar.find((x) => x.telefonId === a.id);
  assert.ok(el, 'eleman eklenti modelinde');
  assert.deepEqual(m[a.id] || [], SH.malzemeEtiketi(el), 'satırlar sh-core kuralıyla');
  const [dosya] = await exportFormat(ps, 'dxf');
  assert.equal(dosya.stats.materials, (m[a.id] || []).length, 'DXF satır sayısı');
});
