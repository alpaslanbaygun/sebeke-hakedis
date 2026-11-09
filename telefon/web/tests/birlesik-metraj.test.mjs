// Birleşik Metraj: eski programın Excel şablonunu projeden doldurma (ortak/BIRLESIK-METRAJ.md). Eklentiyle ortak deneme
// ortak/deneme/birlesik-metraj: şablon tanımı (sablon.json) ve doldurma planı (beklenen-plan.json) iki tarafta aynı olmak
// zorundadır (üretici araclar/metraj-beklenen-uret.mjs; eklenti tarafı CekirdekTest › BirlesikMetrajOrtakDeneme).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SH from '../src/interop/sh-core.cjs';
import KATSAYILAR from '../src/ortak/katsayilar.js';
import ESLESME from '../src/ortak/metraj-sablon.js';
import KALEMLER from '../src/ortak/kalemler.js';
import { Xlsm, formulKaydir, sutunHarfi, sutunNo } from '../src/export/xlsm.js';
import { sablonTanimi, planUygula, planAyari, birlesikMetrajUret, FAZLA_SAYFASI } from '../src/export/birlesik-metraj.js';
import { exportFormat, FORMATS } from '../src/export/exporter.js';
import { setup, newProject, buildPoleLine, route } from './helpers.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const klasor = path.join(KOK, 'ortak/deneme/birlesik-metraj');
const SABLON = path.join(KOK, 'ortak/sablon/birlesik-metraj.xlsm');
const oku = (ad) => JSON.parse(fs.readFileSync(path.join(klasor, ad), 'utf8'));
const proje = () => SH.projeOku(fs.readFileSync(path.join(klasor, 'proje.sebeke.json'), 'utf8'));
const ayar = () => planAyari(oku('ayar.json'), { katsayilar: KATSAYILAR, eslesme: ESLESME, kalemler: KALEMLER });

test('BM1 · xlsm: sütun harfleri, formül kaydırma (metin ve işlev adları dokunulmaz)', () => {
  assert.equal(sutunHarfi(1), 'A'); assert.equal(sutunHarfi(27), 'AA'); assert.equal(sutunHarfi(279), 'JS'); assert.equal(sutunNo('ZZ'), 702);
  assert.equal(formulKaydir('IF(AND($C18<>"",$C18=H$11),1,0)', 0, 3), 'IF(AND($C18<>"",$C18=K$11),1,0)');
  assert.equal(formulKaydir('SUM(G18:G315)', 0, 272), 'SUM(JS18:JS315)');
  assert.equal(formulKaydir('LOG10(A1)+"B2"&\'Sayfa 1\'!C3', 1, 1), 'LOG10(B2)+"B2"&\'Sayfa 1\'!D4', 'LOG10 işlev adı ve tırnak içi metin kalır');
  assert.equal(formulKaydir('A1', -1, 0), 'A1', 'sayfa dışına taşan başvuru olduğu gibi');
});

test('BM2 · ad normalleştirme ve durum → blok eklentiyle aynı kural', () => {
  assert.equal(SH.bmNorm("G-10I''"), 'G-10I"');
  assert.equal(SH.bmNorm('3 x 50 + 25 ş mm2 0.6/1 kV'), '3X50+25 Ş MM2 0.6/1 KV');
  assert.equal(SH.bmNorm('3(1x150/25) Xlpe Alm.'), '3X(1X150/25) XLPE ALM.');
  assert.equal(SH.bmNorm('3x(1x150/25) XLPE KABLO (DİREK İÇİN)'), '3X(1X150/25) XLPE KABLO (DIREK IÇIN)');
  assert.equal(SH.bmNorm('Tuvenan Dolgulu'), 'TUVANEN DOLGULU');
  assert.deepEqual(['M', 'M+M', 'KM', 'DM', 'DM+M', 'MEVCUT', 'ILERIDE', 'İLERİDE'].map(SH.bmBlok), ['Y', 'Y', 'Y', 'D', 'DM', 'MEVCUT', null, null]);
  assert.equal(SH.bmPoz('5.5.1', 'D'), '105.5.1'); assert.equal(SH.bmPoz('32.12', 'DM'), '232.12'); assert.equal(SH.bmPoz('9.2.1', 'A'), '209.2.1'); assert.equal(SH.bmPoz('5.1', 'Y'), '5.1');
  assert.deepEqual(['SC10', 'SC2', 'B1', 'SC1-SC5', 'SC1-SC2', 'TR'].sort(SH.bmDogalSira), ['B1', 'SC1-SC2', 'SC1-SC5', 'SC2', 'SC10', 'TR']);
  assert.equal(SH.bmBirim('ad/kg'), 'ad.'); assert.equal(SH.bmBirim('mt/m³'), 'mt.'); assert.equal(SH.bmBirim('kg/kg'), 'kg');
  assert.equal(SH.bmMiktar({ miktar: 6, birim: 'mt/kg', katsayi: 0.45, toplam: 2.7 }, 'kg'), 2.7, 'şablon kg ise kalemin kilogramı');
  assert.equal(SH.bmMiktar({ miktar: 6, birim: 'mt/kg', katsayi: 0.45, toplam: 2.7 }, 'mt.'), 6);
});

test('BM3 · kanal üstü uzunluk: çizgi kanalın üstünden gittiği kadar (0,25 m örnekleme, 0,6 m yanal pay)', () => {
  const kanal = [{ kose: [[10, 0], [30, 0]] }];
  assert.equal(SH.bmKanalUstu([[0, 0], [40, 0]], kanal), 21, 'kanal 20 m + uçlarda 0,6 m pay');
  assert.equal(SH.bmKanalUstu([[0, 5], [40, 5]], kanal), 0, 'yanal 5 m uzakta: kanal üstü değil');
  assert.equal(SH.bmKanalUstu([[0, 0], [40, 0]], []), 0);
});

test('BM4 · gömülü şablonun tanımı ortak dosyayla aynı (sablon.json)', async () => {
  const x = await Xlsm.ac(fs.readFileSync(SABLON));
  const t = sablonTanimi(x);
  assert.deepEqual(JSON.parse(JSON.stringify(t)), oku('sablon.json'));
  assert.equal(t.direk.sabit.yeni, 'C'); assert.equal(t.direk.baslik.hakedisNo, 'C9');
  assert.deepEqual(t.iletken.sabit.ag, [['G', 'H'], ['I', 'J'], ['K', 'L']]); assert.deepEqual(t.iletken.sabit.aer, ['O', 'P']);
  assert.equal(t.yeralti.sabit.kaplama, 'X');
  assert.equal(t.malz.ekSatirlari.length, 40); assert.equal(t.malz.ekSatirlari[0].kod, 'E001');
  assert.equal(t.listeler.imIletken.degerler.length, 7, 'liste formülden türetilir (temiz şablonda önbellek yok)');
  assert.equal(t.kullanilanKodlar.length, 410);
});

test('BM5 · şablon temiz: proje verisi, kişi adı, bilgisayar yolu, eklenti kaydı yok', async () => {
  const x = await Xlsm.ac(fs.readFileSync(SABLON));
  const t = sablonTanimi(x);
  for (const o of [t.direk, t.iletken, t.yeralti]) {
    const s = x.sayfa(o.sayfa);
    for (const ref of Object.values(o.baslik)) assert.equal(s.metin(ref), '', o.sayfa + '!' + ref);
    for (let r = o.ilkVeri; r <= o.sonVeri; r += 7) for (let c = 1; c <= o.sonSutun; c++) {
      const h = s.oku(sutunHarfi(c) + r);
      if (h && h.formul == null) assert.equal(s.metin(sutunHarfi(c) + r), '', o.sayfa + '!' + sutunHarfi(c) + r);
    }
  }
  const dec = new TextDecoder();
  for (const [ad, u8] of Object.entries(x.dosyalar)) {
    if (!/\.(xml|rels|vml)$/.test(ad)) continue;
    const s = dec.decode(u8);
    assert.doesNotMatch(s, /C:\\Users|absPath|webextension/i, ad);
    assert.doesNotMatch(s, new RegExp(['PRO', 'MAG[İIı]S'].join(''), 'i'), ad);
    assert.doesNotMatch(s, new RegExp(['K[CÇ]E', 'TA[SŞ]'].join(''), 'i'), ad);
  }
  assert.ok(x.dosyalar['xl/vbaProject.bin'], 'makro (sütun gizle / göster) kalır');
});

test('BM6 · doldurma planı ortak dosyayla aynı (beklenen-plan.json)', async () => {
  const x = await Xlsm.ac(fs.readFileSync(SABLON));
  const plan = SH.birlesikMetraj(proje(), sablonTanimi(x), ayar());
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), oku('beklenen-plan.json'));
  assert.deepEqual(plan.ozet, { eleman: 8, iletkenSatiri: 6, yeraltiSatiri: 4, eslesen: 25, yeniSutun: 9, fazla: 0, atlanan: 0 });
  const d = plan.sayfalar['DİREK METRAJI'].hucreler;
  assert.equal(d.C19, 'G-10I'); assert.equal(d.D20, 'G-K1 (K)'); assert.equal(d.E21, "G-10I''", 'şablonun TİP yazımı (iki kesme)'); assert.equal(d.F22, 'G-10U'); assert.equal(d.C23, '9-O', 'ağaç direk eşleşme tablosundan');
  assert.equal(d.G19, 2.7, 'bara: şablon kg → kalemin kilogramı'); assert.equal(d.BJ19, 4, 'N-80'); assert.equal(d.BV22, 1, 'mevcut direğe yeni armatür');
  assert.equal(d.Z18, 0, 'formüllü malzeme sütunu: programda yoksa 0 (programın malzemesi esas)');
  assert.equal(plan.yeniSutunlar.map((y) => y.kod).join(','), 'YE001,YE002,YE003,YE004,YE005,DE006,AE007,YE008,YE009');
  const i = plan.sayfalar['İLETKEN METRAJI'].hucreler;
  assert.equal(i.A16, 'SC1-SC2'); assert.equal(i.E16, 42); assert.equal(i.H16, 'R'); assert.equal(i.J16, 'P'); assert.equal(i.L16, 'A'); assert.equal(i.K16, 3);
  assert.equal(i.Q18, 'DM'); assert.equal(i.Q19, 'AKTARIM'); assert.equal(i.H18, 'OXLIP', 'sök-tak hat: DM ve AKTARIM satırları, yeni tel sütunu');
  assert.equal(i.P17, '3x35/16+50 AER Kablo', 'ALPEK → şablonun AER yazımı'); assert.equal(i.A21, 'SC5-?', 'ucu direğe değmeyen rekortman');
  const yt = plan.sayfalar['YERALTI METRAJI'].hucreler;
  assert.equal(yt.Q17, 10, 'parke tuvenan kanal m³'); assert.equal(yt.U16, 27, 'kaplamasız toprak kanal'); assert.equal(yt.Z18, 56, 'kanal üstündeki kablo: KANAL İÇİN');
  assert.equal(yt.AR19 + yt.AQ19, 36, 'kablo metrajı kanal içi + direk için = toplam'); assert.equal(yt.H18, '4 ÇIKIŞLI H.T', 'ucundaki box cinsi');
  assert.equal(plan.listeEkle.length, 2); assert.equal(plan.sayfalar.KATSAYILAR.hucreler.AN11, 'OXLIP');
  assert.equal(plan.sayfalar['MALZ. LİSTESİ'].hucreler.G472, 'YE001', 'EK satırının kodu yeni sütunla aynı');
});

test('BM7 · plan dosyaya yazılır ve geri okunur: değerler, yeni sütun formülleri, gizli satırlar, makro', async () => {
  const { bytes, plan } = await birlesikMetrajUret(proje(), fs.readFileSync(SABLON), ayar());
  assert.ok(bytes.length > 100000);
  const y = await Xlsm.ac(bytes);
  const d = y.sayfa('DİREK METRAJI');
  assert.equal(d.metin('A19'), 'SC1'); assert.equal(d.metin('C19'), 'G-10I'); assert.equal(d.metin('E21'), "G-10I''"); assert.equal(d.metin('JS18'), '1');
  assert.equal(d.metin('JU10'), 'YE003'); assert.equal(d.metin('JU11'), 'G-K5');
  assert.equal(d.formul('JU18'), 'IF(AND($C18<>"",$C18=JU$11),1,0)', 'veri formülü örnek sütundan kaydırılır');
  assert.equal(d.formul('JU316'), 'SUM(JU18:JU315)'); assert.equal(d.formul('JU12'), 'IF(JU316>0,1,0)');
  assert.ok(d.satirGizliMi(29) && !d.satirGizliMi(27) && !d.satirGizliMi(19), 'yazılmayan satırlar gizli, yazılanlar ve iki yedek satır açık');
  const i = y.sayfa('İLETKEN METRAJI');
  assert.equal(i.metin('BN8'), 'OXLIP'); assert.equal(i.metin('BN6'), 'DM'); assert.match(i.formul('BN16'), /BN\$6.*BN\$8/); assert.equal(i.formul('BN120'), 'MAX(0,BN118-BN119)');
  assert.ok(!i.satirGizliMi(16) && i.satirGizliMi(30));
  const m = y.sayfa('MALZ. LİSTESİ');
  assert.equal(m.metin('G472'), 'YE001'); assert.equal(m.formul('H477'), 'IF($I477="",0,N(INDEX(IM_MALZ_SATIRI,$I477)))');
  assert.equal(y.sayfa('KATSAYILAR').metin('AN11'), 'OXLIP');
  assert.ok(y.dosyalar['xl/vbaProject.bin'] && !y.dosyalar['xl/calcChain.xml'] && /fullCalcOnLoad="1"/.test(y.workbook));
  assert.ok(!y.sayfaAdlari().includes(FAZLA_SAYFASI), 'EK satırı yettiğinde fazla sayfası açılmaz');
  assert.equal(plan.uyarilar.length, 0);
});

test('BM8 · EK satırı bitince malzeme "ŞABLONDA OLMAYAN" sayfasına toplanır', async () => {
  const x = await Xlsm.ac(fs.readFileSync(SABLON));
  const t = sablonTanimi(x);
  t.malz.ekSatirlari = t.malz.ekSatirlari.slice(0, 2);   // yalnız iki EK satırı kalmış gibi
  const p = proje();
  const plan = SH.birlesikMetraj(p, t, ayar());
  assert.equal(plan.yeniSutunlar.length, 2);
  assert.ok(plan.fazla.length >= 5, 'kalanlar fazlaya');
  const vhd = plan.fazla.find((f) => /VHD-35/.test(f.ad));
  assert.ok(vhd && vhd.miktar === 3 && vhd.nereler.includes('SC7'), 'ENH direğinin izolatörü fazlada');
  const tel = plan.fazla.find((f) => f.hangi === 'iletken' && /OXLIP/.test(f.ad) && f.blok === 'D');
  assert.ok(tel && tel.birim === 'kg' && Math.abs(tel.miktar - 41 * 3 * 0.29886) < 0.01, 'sütun açılamayan tel kilogramıyla fazlada');
  assert.ok(plan.uyarilar.some((u) => /EK satırı kalmadı/.test(u)));
  planUygula(x, t, plan);
  const y = await Xlsm.ac(await x.yaz());
  const f = y.sayfa(FAZLA_SAYFASI);
  assert.equal(f.metin('A1'), 'Sayfa'); assert.equal(f.metin('D2'), plan.fazla[0].ad); assert.equal(+f.metin('F2'), plan.fazla[0].miktar);
});

test('BM9 · bölge süzgeci ve sığmayan proje', async () => {
  const x = await Xlsm.ac(fs.readFileSync(SABLON));
  const t = sablonTanimi(x);
  const p = proje();
  const hepsi = SH.birlesikMetraj(p, t, Object.assign(ayar(), { bolgeId: '' }));
  assert.equal(hepsi.ozet.eleman, 9, 'bölge seçilmeyince öteki bölgenin direği de yazılır');
  assert.equal(hepsi.sayfalar['DİREK METRAJI'].hucreler.C6, 'Birleşik Metraj Denemesi', 'işin adı projeden');
  const cok = proje();
  for (let n = 0; n < 300; n++) cok.elemanlar.push(Object.assign({}, cok.elemanlar[0], { id: 'X' + n, gisId: 'X' + n }));
  assert.throws(() => SH.birlesikMetraj(cok, t, ayar()), /298 satır alır/);
});

test('BM10 · telefon projesi → Dışa Aktarım "metraj": OG hattın direkleri ve açıklıkları şablona yazılır', async () => {
  assert.ok(FORMATS.metraj && FORMATS.metraj.ext === '.xlsm');
  const { ps } = await setup(); await newProject(ps);
  const START = { E: 519300.0, N: 4282100.0, H: 1050.0 };
  const ROUTE = route(START, [[60, 98.412, 4.3], [60, 102.775, 2.14], [60, 95.33, -1.86], [88.7, 110.064, 3.02]]);
  const TYPES = ['GD-12 (3 AWG)', 'GT-12 (3 AWG)', 'GT-12 (3 AWG)', 'GZ-12 (3 AWG)', 'GN-12 (3 AWG)'];
  const { poles } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await ps.updateProject({ sebeke: { metraj: { il: 'ELAZIĞ', ilce: 'MERKEZ' } } }, 'deneme');
  const [f] = await exportFormat(ps, 'metraj', { metraj: { sablon: fs.readFileSync(SABLON) } });
  assert.match(f.name, /_birlesik_metraj\.xlsm$/);
  assert.equal(f.metraj.ozet.eleman, poles.length, 'her direk bir satır');
  assert.equal(f.metraj.ozet.iletkenSatiri, poles.length - 1, 'her açıklık bir satır');
  const y = await Xlsm.ac(f.data);
  const d = y.sayfa('DİREK METRAJI');
  assert.equal(d.metin('C3'), 'ELAZIĞ'); assert.equal(d.metin('C4'), 'MERKEZ'); assert.equal(d.metin('C8'), 'Yüklenici Firma', 'yüklenici projeden');
  assert.ok(d.metin('A18') !== '' && d.metin('C18') !== '', 'ilk direk satırı: no ve yeni direk tipi');
  const i = y.sayfa('İLETKEN METRAJI');
  assert.equal(i.metin('N16'), 'SWLL', 'OG iletken kodu şablonun yazımıyla'); assert.equal(+i.metin('M16'), 3);
  assert.ok(f.metraj.yeniSutunlar.length >= 1, 'ENH direk tipleri şablonda yok: yeni sütun açılır');
});
