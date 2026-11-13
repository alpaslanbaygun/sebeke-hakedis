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
  assert.deepEqual(plan.ozet, { eleman: 12, iletkenSatiri: 6, yeraltiSatiri: 4, eslesen: 27, yeniSutun: 17, kopyaSayfa: 3, fazla: 0, atlanan: 0 });
  const d = plan.sayfalar['DİREK METRAJI'].hucreler;
  assert.equal(d.C19, 'G-10I'); assert.equal(d.D20, 'G-K1 (K)'); assert.equal(d.E21, "G-10I''", 'şablonun TİP yazımı (iki kesme)'); assert.equal(d.F22, 'G-10U'); assert.equal(d.C23, '9-O', 'ağaç direk eşleşme tablosundan');
  assert.equal(d.G19, 2.7, 'bara: şablon kg → kalemin kilogramı'); assert.equal(d.BJ19, 4, 'N-80'); assert.equal(d.BV22, 1, 'mevcut direğe yeni armatür');
  assert.equal(d.Z18, 0, 'formüllü malzeme sütunu: programda yoksa 0 (programın malzemesi esas)');
  // 13.11.2026: yeni sütunlar şablonun KOD dizisiyle (EK kodu değil); temsil edilmeyen cinsler kopya sayfada
  assert.equal(plan.yeniSutunlar.map((y) => y.kod).join(','), 'Y175,Y176,Y177,Y178,Y179,Y180,Y181,Y182,D120,D121,Y183,Y184,Y185,D122,A017,Y186,Y187');
  assert.deepEqual(plan.kopyaSayfalar.map((k) => k.ad), ['DİREK AG BETON', 'DİREK ENH GALV. CIVATALI', 'DİREK ENH GALV. KAYNAKLI RAVEN']);
  assert.equal(plan.kopyaSayfalar[2].aile, 'ENH_DEMİR_GLV|RV', 'ENH direği iletken ekine göre aile (Raven ayrı sayfa, Swallow ana sayfada)');
  const b = plan.sayfalar['DİREK AG BETON'].hucreler;
  assert.equal(b.A18, 'SC11'); assert.equal(b.C18, '9,3/3'); assert.equal(b.G10, 'Y180'); assert.equal(b.G11, '9,3/3'); assert.equal(b.G15, '9,3/3 Beton Direk'); assert.equal(b.G13, 'YENİ\nAG BETON DİREKLER');
  assert.equal(b.H15, 't-60'); assert.equal(b.H18, 1, 'beton travers kopya sayfanın kendi sütununda'); assert.equal(b.I15, 'N-80 Mesnet İzolatör', 'ana sayfada olan malzeme aynı başlıkla'); assert.equal(b.I18, 4);
  assert.equal(b.D19, '9,3/8 (K)'); assert.equal(b.J10, 'D120'); assert.equal(b.K15, 'GT-60 AG Konsol'); assert.equal(b.K19, 1);
  assert.equal(b.C3, 'DENEME', 'başlık hücreleri kopyada da');
  assert.equal(plan.yeniSutunlar.find((y) => y.kod === 'Y180').ornekSayfa, 'DİREK METRAJI', 'kopyanın örnek sütunu ana sayfada');
  assert.equal(plan.yeniSutunlar.find((y) => y.kod === 'Y177').grup, 'YENİ\nAG GALVANİZ DEMİR DİREKLER');
  assert.ok(plan.listeEkle.some((l) => l.liste === 'yeniDirek' && l.deger === '9,3/3') && plan.listeEkle.some((l) => l.liste === 'demontaj' && l.deger === '9,3/8 (K)'), 'kopya sayfanın tipleri KATSAYILAR listelerine');
  const i = plan.sayfalar['İLETKEN METRAJI'].hucreler;
  assert.equal(i.A16, 'SC1-SC2'); assert.equal(i.E16, 42); assert.equal(i.H16, 'R'); assert.equal(i.J16, 'P'); assert.equal(i.L16, 'A'); assert.equal(i.K16, 3);
  assert.equal(i.Q18, 'DM'); assert.equal(i.Q19, 'AKTARIM'); assert.equal(i.H18, 'OXLIP', 'sök-tak hat: DM ve AKTARIM satırları, yeni tel sütunu');
  assert.equal(i.P17, '3x35/16+50 AER Kablo', 'ALPEK → şablonun AER yazımı'); assert.equal(i.A21, 'SC5-?', 'ucu direğe değmeyen rekortman');
  const yt = plan.sayfalar['YERALTI METRAJI'].hucreler;
  assert.equal(yt.Q17, 10, 'parke tuvenan kanal m³'); assert.equal(yt.U16, 27, 'kaplamasız toprak kanal'); assert.equal(yt.Z18, 56, 'kanal üstündeki kablo: KANAL İÇİN');
  assert.equal(yt.AR19 + yt.AQ19, 36, 'kablo metrajı kanal içi + direk için = toplam'); assert.equal(yt.H18, '4 ÇIKIŞLI H.T', 'ucundaki box cinsi');
  assert.equal(plan.listeEkle.length, 6); assert.equal(plan.sayfalar.KATSAYILAR.hucreler.AN11, 'OXLIP');
  // MALZ. LİSTESİ: EK KALEMLER bölümünün yerine sayfa başına bölüm, normal satırlar; eski EK kodları silinir
  const m = plan.sayfalar['MALZ. LİSTESİ'].hucreler;
  assert.equal(m.B471, 'DİREK METRAJI'); assert.equal(m.G472, 'Y175'); assert.equal(m.I472, '=IFERROR(MATCH($G472,DM_KOD_SATIRI,0),"")');
  assert.equal(m.B477, 'DİREK AG BETON'); assert.equal(m.G478, 'Y180'); assert.equal(m.I478, "=IFERROR(MATCH($G478,'DİREK AG BETON'!$G$10:$ZZ$10,0),\"\")", 'kopya sayfanın satırı açık aralıkla');
  assert.equal(m.H478, "=IF($I478=\"\",0,N(INDEX('DİREK AG BETON'!$G$316:$ZZ$316,$I478)))");
  assert.equal(m.A477, '=IF(COUNTIF(F478:F482,">0")>0,1,0)'); assert.equal(m.G494, null, 'kalan EK satırının kodu silinir');
  assert.equal(plan.malzSatirlari.filter((x) => x.tur === 'grup').length, 6);
});

test('BM7 · plan dosyaya yazılır ve geri okunur: değerler, yeni sütun formülleri, gizli satırlar, makro', async () => {
  const { bytes, plan } = await birlesikMetrajUret(proje(), fs.readFileSync(SABLON), ayar());
  assert.ok(bytes.length > 100000);
  const y = await Xlsm.ac(bytes);
  const d = y.sayfa('DİREK METRAJI');
  assert.equal(d.metin('A19'), 'SC1'); assert.equal(d.metin('C19'), 'G-10I'); assert.equal(d.metin('E21'), "G-10I''"); assert.equal(d.metin('JS18'), '1');
  assert.equal(d.metin('JU10'), 'Y177'); assert.equal(d.metin('JU11'), 'G-K5');
  assert.equal(d.formul('JU18'), 'IF(AND($C18<>"",$C18=JU$11),1,0)', 'veri formülü örnek sütundan kaydırılır');
  assert.equal(d.formul('JU316'), 'SUM(JU18:JU315)'); assert.equal(d.formul('JU12'), 'IF(JU316>0,1,0)');
  assert.ok(d.satirGizliMi(29) && !d.satirGizliMi(27) && !d.satirGizliMi(19), 'yazılmayan satırlar gizli, yazılanlar ve iki yedek satır açık');
  const i = y.sayfa('İLETKEN METRAJI');
  assert.equal(i.metin('BN8'), 'OXLIP'); assert.equal(i.metin('BN6'), 'DM'); assert.match(i.formul('BN16'), /BN\$6.*BN\$8/); assert.equal(i.formul('BN120'), 'MAX(0,BN118-BN119)');
  assert.ok(!i.satirGizliMi(16) && i.satirGizliMi(30));
  const m = y.sayfa('MALZ. LİSTESİ');
  assert.equal(m.metin('G472'), 'Y175'); assert.equal(m.metin('B471'), 'DİREK METRAJI'); assert.equal(m.formul('H489'), 'IF($I489="",0,N(INDEX(IM_MALZ_SATIRI,$I489)))');
  assert.equal(m.metin('G494'), '', 'eski EK kodu silindi'); assert.equal(m.oku('G478').stil, m.oku('G7').stil, 'eklenen satır kalem satırı biçiminde'); assert.equal(m.oku('B477').stil, m.oku('B6').stil, 'bölüm başlığı grup başlığı biçiminde');
  assert.equal(y.sayfa('KATSAYILAR').metin('AN11'), 'OXLIP');
  // kopya sayfalar: kaynağın sağında açılış sırasıyla, biçim ve formüller kaynaktan, KOD sütunları yalnız kendi sütunları
  assert.deepEqual(y.sayfaAdlari(), ['MALZ. LİSTESİ', 'DİREK METRAJI', 'DİREK AG BETON', 'DİREK ENH GALV. CIVATALI', 'DİREK ENH GALV. KAYNAKLI RAVEN', 'YERALTI METRAJI', 'İLETKEN METRAJI', 'KATSAYILAR']);
  const b = y.sayfa('DİREK AG BETON');
  assert.equal(b.metin('A18'), 'SC11'); assert.equal(b.metin('G11'), '9,3/3'); assert.equal(b.metin('H18'), '1'); assert.equal(b.metin('C3'), 'DENEME');
  assert.equal(b.formul('G18'), 'IF(AND($C18<>"",$C18=G$11),1,0)', 'veri formülü ana sayfadaki örnekten'); assert.equal(b.formul('G316'), 'SUM(G18:G315)'); assert.equal(b.formul('G12'), 'IF(G316>0,1,0)');
  assert.equal(b.metin('L10'), '', 'kaynağın öteki KOD sütunları kopyada yok'); assert.equal(b.metin('A1'), y.sayfa('DİREK METRAJI').metin('A1'), 'başlık alanı kopyalandı');
  assert.equal(b.oku('G10').stil, y.sayfa('DİREK METRAJI').oku('BE10').stil, 'KOD hücresi örnek sütunun biçiminde');
  assert.ok(b.satirGizliMi(25) && !b.satirGizliMi(19), 'kopyada yazılmayan satırlar gizli');
  assert.ok(!/codeName=|legacyDrawing|<drawing\b/.test(b.on + b.son), 'kopyada VBA kod adı, yorum ve çizim bağı yok');
  assert.ok(/<sheetProtection\b/.test(b.son) && /<mergeCells count="\d+">/.test(b.son), 'koruma ve birleşik hücreler kaldı');
  assert.ok(!y.dosyalar['xl/worksheets/_rels/' + y.sayfalar.find((s) => s.ad === 'DİREK AG BETON').yol.split('/').pop() + '.rels'], 'kopyanın rels dosyası yok');
  assert.ok(y.dosyalar['xl/vbaProject.bin'] && !y.dosyalar['xl/calcChain.xml'] && /fullCalcOnLoad="1"/.test(y.workbook));
  assert.ok(!y.sayfaAdlari().includes(FAZLA_SAYFASI), 'fazla sayfası açılmaz');
  assert.equal(plan.uyarilar.length, 0);
});

test('BM8 · aile kuralı: ana sayfada temsil edilen cins ana sayfada (yeni sütun), listedeki aile de; MALZ bölümü yoksa uyarı', async () => {
  const x = await Xlsm.ac(fs.readFileSync(SABLON));
  const t = sablonTanimi(x);
  const p = proje();
  // anaSayfaAileleri boş: ENH_DEMİR_GLV|SW de temsil edilmez → kendi sayfası; AG_BETON yine kopya
  const a = ayar(); a.eslesme = Object.assign({}, a.eslesme, { anaSayfaAileleri: [] });
  let plan = SH.birlesikMetraj(p, t, a);
  assert.deepEqual(plan.kopyaSayfalar.map((k) => k.ad), ['DİREK ENH GALV. KAYNAKLI SWLL', 'DİREK AG BETON', 'DİREK ENH GALV. CIVATALI', 'DİREK ENH GALV. KAYNAKLI RAVEN']);
  // cins listede: hepsi ana sayfada
  a.eslesme = Object.assign({}, a.eslesme, { anaSayfaAileleri: ['AG_BETON', 'ENH_GLV_CVT', 'ENH_DEMİR_GLV|SW', 'ENH_DEMİR_GLV|RV'] });
  plan = SH.birlesikMetraj(p, t, a);
  assert.equal(plan.kopyaSayfalar.length, 0); assert.equal(plan.ozet.eleman, 12);
  assert.ok(plan.yeniSutunlar.some((y) => y.sayfa === 'DİREK METRAJI' && y.tip === '9,3/3'), 'beton tipi ana sayfada yeni sütun');
  assert.equal(SH.bmAile('ENH_DEMİR_GLV', 'G-T-12 (rv)'), 'ENH_DEMİR_GLV|RV'); assert.equal(SH.bmAile('AG_BETON', '9,3/3'), 'AG_BETON');
  assert.equal(SH.bmKopyaAdi('direk', 'ENH_GLV_CVT', { ENH_GLV_CVT: 'ENH Galvaniz Cıvatalı Direk' }), 'DİREK ENH GALV. CIVATALI');
  assert.equal(SH.bmKopyaAdi('direk', 'AYD_GLV_PLG|XX', { AYD_GLV_PLG: 'Galvaniz Poligon Aydınlatma Direği' }), 'DİREK GALV. POLİGON AYD. XX');
  assert.ok(SH.bmKopyaAdi('direk', 'X', { X: 'Çok Uzun Bir Cins Adı Olan Direk Türü Burada' }).length <= 31, 'sayfa adı en çok 31 karakter');
  // MALZ. LİSTESİ'nde EK bölümü yoksa yeni sütunlar listeye yazılamaz, uyarılır
  t.malz.ekSatirlari = []; t.malz.ekBaslikSatiri = null;
  plan = SH.birlesikMetraj(p, t, ayar());
  assert.ok(plan.uyarilar.some((u) => /EK KALEMLER bölümü yok/.test(u))); assert.equal(plan.malzSatirlari.length, 0);
});

test('BM9 · bölge süzgeci ve sığmayan proje', async () => {
  const x = await Xlsm.ac(fs.readFileSync(SABLON));
  const t = sablonTanimi(x);
  const p = proje();
  const hepsi = SH.birlesikMetraj(p, t, Object.assign(ayar(), { bolgeId: '' }));
  assert.equal(hepsi.ozet.eleman, 13, 'bölge seçilmeyince öteki bölgenin direği de yazılır');
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
