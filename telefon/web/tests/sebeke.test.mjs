// AutoCAD eklentisiyle dosya uyumu: telefon projesi → .sebeke.json → (Durum Tespit) ve .sebeke.json → telefon → .sebeke.json
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setup, newProject, buildPoleLine, rtkObs, route } from './helpers.mjs';
import { sebekeYaz, sebekeModel, sebekeIceAl, voltProjeYaz, voltProjeOku, cizimTip, voltTip, cizimKesit, hatTipiEsle, direkEsle, autocadSecenekleri, SH } from '../src/interop/sebeke.js';
import { lineLabel, circuitParts, autocadAnahtari } from '../src/grid/lines.js';
import KALEMLER from '../src/ortak/kalemler.js';
import KATSAYILAR from '../src/ortak/katsayilar.js';
import { exportFormat } from '../src/export/exporter.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(here, 'out/'); fs.mkdirSync(OUT, { recursive: true });
const ORNEK = path.join(here, 'fixtures/ornek-proje.sebeke.json');

const OG_ROUTE = route({ E: 519300, N: 4282100, H: 1050 }, [[60, 80, 2], [60, 80, 1], [120, 70, -1]]);
const OG_TYPES = ['GD-10 (3 AWG)', 'GT-10 (3 AWG)', 'GT-10 (3 AWG)', 'GN-10 (3 AWG)'];

test('A1 · ad ve tip yazımları iki yönde çevrilir', () => {
  assert.equal(cizimTip('beton', '9.3/8'), '9,3/8');
  assert.equal(voltTip('beton', '9,3/8'), '9.3/8');
  assert.equal(cizimTip('bahh', 'GD-10 (3 AWG)'), 'G-D-10 (sw)');
  assert.equal(voltTip('bahh', 'G-D-10 (sw)'), 'GD-10 (3 AWG)');
  assert.equal(cizimTip('bahh', 'GT-12 (1/0)'), 'G-T-12 (1/0)');
  assert.equal(cizimTip('sehir', 'G-K2'), 'G-K2');
  assert.equal(cizimTip('trafo', 'G-T25'), 'G-T-25');
  assert.equal(voltTip('trafo', 'G-T-25'), 'G-T25');
  assert.deepEqual(cizimKesit('3xSwallow', 'OG', 'havai'), { tanim: '3xSW', aciklama: '' });
  assert.deepEqual(cizimKesit('3xRaven', 'OG', 'havai'), { tanim: '3x1\\0', aciklama: '' });
  assert.deepEqual(cizimKesit('3P+R', 'AG', 'havai'), { tanim: '3P+R', aciklama: '' });
  assert.deepEqual(cizimKesit('3x70/16+95 AER', 'AG', 'havai'), { tanim: '3X70/16+95 ALPEK', aciklama: '' });
  assert.deepEqual(cizimKesit('3x(1x150/25) NA2XSY', 'OG', 'yeralti'), { tanim: '1x150/25 Xlpe Alm.', aciklama: '3(1x150/25) Xlpe Alm.' });
  assert.deepEqual(cizimKesit('NAYY 3x95+50', 'AG', 'yeralti'), { tanim: '3x95+50 Nyy Alm.', aciklama: '' });
});

/** Deneme projesi: 4 OG direk + OG hat, mevcut beton direk, direk tipi trafo, SDK, 3 AG direk + AER hat, yeraltı kablo (asfalt, borulu). */
async function ornekProje() {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  const { poles } = await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const beton = await ps.addEquipment('pole', { group: 'beton', typeId: ps.cat.poleTypeByName('beton', '9.3/8').id, state: 'MEVCUT' }, { obs: rtkObs(519400, 4282300, 1052) });
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'direk', kva: 160, poleTypeId: ps.cat.poleTypeByName('trafo', 'G-T25').id } }, { obs: rtkObs(519450, 4282320, 1053) });
  const sdk = await ps.addEquipment('sdk', { state: 'YENI', attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(519470, 4282330, 1053) });
  await ps.addMaterial('equipment', poles[0].id, '011.06.04.01-001', 3, 'Askı izolatörü');  // elle malzeme
  const agPts = [];
  for (let i = 0; i < 3; i++) { const t = ps.cat.poleTypeByName('sehir', 'G-K2'); agPts.push(await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'YENI' }, { obs: rtkObs(519500 + i * 40, 4282400, 1055) })); }
  await ps.createLine({ lineType: 'AG', install: 'havai', circuits: [{ role: 'AG', key: '3x70/16+95 AER', count: 1 }], nodes: agPts.map((p) => p.pointId), state: 'YENI' });
  await ps.createLine({ lineType: 'AG', install: 'yeralti', circuits: [{ role: 'AG', key: 'NAYY 3x95+50', count: 1 }], nodes: [agPts[0].pointId, sdk.pointId], state: 'YENI', cable: { surface: 'asfalt', method: 'borulu', width: 0.4, depth: 0.8, pipeDia: 110, pipeCount: 1 } });
  return { ps, poles, beton, tr, sdk, agPts };
}

test('A2 · telefon projesi AutoCAD dosyasına: direkler, trafo, hat, kanal; Durum Tespit kg toplamı telefonun kg toplamıyla aynı', async () => {
  const { ps, poles, beton, tr, sdk, agPts } = await ornekProje();
  const txt = sebekeYaz(ps);
  fs.writeFileSync(OUT + 'telefon.sebeke.json', txt);
  const sp = SH.projeOku(txt);
  assert.equal(sp.bicim, 'sebeke-hakedis.proje');
  assert.equal(sp.proje.koordinat.dom, 39);
  assert.equal(sp.bolgeler.length, 1);
  assert.equal(sp.elemanlar.length, 4 + 1 + 1 + 1 + 3);
  // OG direk: ENH_DIREK · ENH_DEMİR_GLV · G-D-10 (sw) · 279 kg · M · bölge B1
  const d = sp.elemanlar.find((e) => e.gisId === poles[0].no);
  assert.equal(d.tur, 'ENH_DIREK'); assert.equal(d.cins, 'ENH_DEMİR_GLV'); assert.equal(d.tip, 'G-D-10 (sw)'); assert.equal(d.durum, 'M'); assert.equal(d.bolge, 'B1');
  const ana = d.kalemler.find((k) => k.ana);
  assert.equal(ana.cins, 'ENH_DEMİR_GLV'); assert.equal(ana.tanim, 'G-D-10 (sw)'); assert.equal(ana.birim, 'ad/kg'); assert.equal(ana.katsayi, 279); assert.equal(ana.toplam, 279); assert.equal(ana.tarife, '0103');
  assert.ok(d.kalemler.some((k) => !k.ana && k.miktar === 3 && k.cins === 'OG_İZOLATÖR'), 'elle eklenen izolatör OG_İZOLATÖR cinsiyle');
  assert.equal(d.telefonId, poles[0].id);
  // Beton direk mevcut: AG_BETON 9,3/8 (katalogdaki 1510 kg)
  const b = sp.elemanlar.find((e) => e.gisId === beton.no);
  assert.equal(b.tur, 'AG_DIREK'); assert.equal(b.cins, 'AG_BETON'); assert.equal(b.tip, '9,3/8'); assert.equal(b.durum, 'MEVCUT');
  assert.equal(b.kalemler[0].katsayi, 1510);
  // Trafo direği: TRAFO_DIREGI · TR_DİREK_GLV · G-T-25 (887 kg) + trafo malzemesi, güç 160
  const t = sp.elemanlar.find((e) => e.gisId === tr.no);
  assert.equal(t.tur, 'TRAFO_DIREGI'); assert.equal(t.cins, 'TR_DİREK_GLV'); assert.equal(t.tip, 'G-T-25'); assert.equal(t.guc, '160');
  assert.equal(t.kalemler.find((k) => k.ana).katsayi, 887);
  assert.ok(t.kalemler.some((k) => !k.ana && k.cins === 'TRAFO_GENLEŞME_TANKLI'), 'trafo kalemi');
  // SDK: BOX · BOX_PANO
  const s = sp.elemanlar.find((e) => e.gisId === sdk.no);
  assert.equal(s.tur, 'BOX'); assert.equal(s.cins, 'BOX_PANO'); assert.ok(s.tip.includes('TİP-B'));
  // Hatlar: OG havai 3xSW (mt/mt, rapor tel tel açar), AG havai ALPEK, AG yeraltı Nyy + kanal.
  // Parçalı yapı: 4 direkli OG hattı direkten direğe 3 ayrı hat nesnesidir; metrajların toplamı hattın metrajıdır.
  const ogler = sp.hatlar.filter((h) => h.tur === 'OG_HAVAI');
  assert.equal(ogler.length, 3, 'direkten direğe üç parça');
  const og = ogler[0];
  assert.equal(og.anaKesit, '3xSW'); assert.equal(og.kalemler[0].cins, 'OG_İLETKEN'); assert.equal(og.kalemler[0].birim, 'mt/mt');
  assert.equal(og.etiket, '^ 3xSW', 'etikette metraj yok (açıklık yazısında)');
  assert.equal(og.kose.length, 2);
  assert.deepEqual(og.uclar, [poles[0].id, poles[1].id]);
  assert.deepEqual(ogler[2].uclar, [poles[2].id, poles[3].id]);
  assert.ok(ogler.every((h) => h.telefonId === ogler[0].telefonId && Number.isInteger(h.kalemler[0].miktar)), 'parçalar aynı telefon hattına ait, metrajlar tam sayı');
  assert.deepEqual(ogler.map((h) => h.id), [ogler[0].id.replace(/-1$/, '') + '-1', ogler[0].id.replace(/-1$/, '') + '-2', ogler[0].id.replace(/-1$/, '') + '-3']);
  const ogLine = ps.data.lines.find((l) => l.lineType === 'OG');
  const ogInfo = ps.result.lineInfo.get(ogLine.id);
  const ogIletken = ogInfo.items.find((x) => x.role === 'OG' && !x.kanal && !x.manual);
  assert.equal(ogler.reduce((a, h) => a + h.kalemler[0].miktar, 0), Math.ceil(ogInfo.length3D - 1e-6), 'parça metrajlarının toplamı hattın metrajı');
  assert.ok(ogIletken);
  assert.ok(Math.abs(ogler.reduce((a, h) => a + h.cizimUzunlugu, 0) - ogInfo.length2D) < 0.01, 'çizim uzunlukları toplamı');
  const ag = sp.hatlar.find((h) => h.tur === 'AG_HAVAI');
  assert.equal(ag.anaKesit, '3X70/16+95 ALPEK'); assert.equal(ag.kalemler[0].cins, 'ALPEK_KABLOLAR'); assert.equal(ag.kalemler[0].tarife, '0107');
  const yer = sp.hatlar.find((h) => h.tur === 'AG_YERALTI');
  assert.equal(yer.anaKesit, '3x95+50 Nyy Alm.'); assert.equal(yer.kalemler[0].cins, 'AG_ALÜMİNYUM_KABLO', 'cins kodu yazım hatası düzeltilmiş');
  assert.equal(sp.kanallar.length, 1);
  const kn = sp.kanallar[0];
  assert.equal(kn.kod, 4); assert.equal(kn.zemin, 'ASFALT'); assert.equal(kn.altGenislik, 40); assert.equal(kn.derinlik, 80);
  assert.equal(kn.kalemler[0].cins, '4'); assert.equal(kn.kalemler[0].birim, 'mt/m³');
  assert.ok(!kn.kalemler.some((k) => /boru/i.test(k.tanim)) && yer.kalemler.some((k) => /boru/i.test(k.tanim) && k.kaynak === 'MALZEME'), 'borulu geçişte boru kalemi kablonun malzemesi (kanal yalnız kendi kalemini taşır)');
  assert.equal(kn.basNo, agPts[0].no); assert.equal(kn.bitNo, sdk.no);
  // Durum Tespit (telefondaki JS çekirdeğiyle): direk kg toplamı telefonun kg metrajıyla aynı
  const satirlar = SH.durumTespit(sp, SH.katsayiHazirla(KATSAYILAR));
  const direkKg = satirlar.filter((r) => r.nesne === 'ELEMAN' && r.birim === 'ad/kg' && r.durum === 'M').reduce((a, r) => a + r.toplam, 0);
  const voltKg = ps.result.quantities.filter((q) => q.job === 'montaj' && q.isGroup && /direk/i.test(q.name)).reduce((a, q) => a + q.qty, 0);
  assert.equal(Math.round(direkKg), Math.round(voltKg));
  // OG hattı tel tel açılır: 3 × Swallow
  assert.ok(satirlar.some((r) => r.cins === 'AL_İLETKENLER' && r.tip === 'SWALLOW' && r.miktar === og.kalemler[0].miktar * 3));
  fs.writeFileSync(OUT + 'telefon-durum-tespit.json', JSON.stringify(SH.ozet(satirlar), null, 1));
});

test('A3 · "ileride" objeler yazılmaz, demontaj / sök-tak durumları çevrilir, tedarik Y olan pozda M+M', async () => {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  const t = ps.cat.poleTypeByName('sehir', 'G-K2');
  const a = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'DEMONTAJ' }, { obs: rtkObs(519500, 4282400, 1055) });
  const b = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'DMM' }, { obs: rtkObs(519520, 4282400, 1055) });
  const c = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'ILERIDE' }, { obs: rtkObs(519540, 4282400, 1055) });
  const sp = sebekeModel(ps);
  assert.equal(sp.elemanlar.find((e) => e.gisId === a.no).durum, 'DM');
  assert.equal(sp.elemanlar.find((e) => e.gisId === b.no).durum, 'DM+M');
  assert.ok(!sp.elemanlar.find((e) => e.gisId === c.no));
  assert.ok(sp.uyarilar.some((u) => u.includes(c.no)));
  // Yüklenici tedarikli poz: M+M
  const yPoz = ps.cat.t.poz.find((p) => p.supply === 'Y');
  await ps.addMaterial('equipment', a.id, yPoz.servis, 2, 'deneme');
  const sp2 = sebekeModel(ps);
  const k = sp2.elemanlar.find((e) => e.gisId === a.no).kalemler.find((x) => x.servis === yPoz.servis);
  assert.equal(k.durum, 'DM', 'demontaj objesinde malzeme de DM');
});

test('A3b · çizim durum kodu korunur: KM / ME / M+M seçimi ve demontaj türü (KESİK) dışa aktarımda döner, durum değişince düşer', async () => {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  const t = ps.cat.poleTypeByName('sehir', 'G-K2');
  const km = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'YENI', sebeke: { durum: 'KM' } }, { obs: rtkObs(519500, 4282400, 1055) });
  const me = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'MEVCUT', sebeke: { durum: 'ME' } }, { obs: rtkObs(519520, 4282400, 1055) });
  const mm = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'YENI', sebeke: { durum: 'M+M' } }, { obs: rtkObs(519540, 4282400, 1055) });
  const dm = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'DEMONTAJ', attrs: { dmDurum: 'KESİK' } }, { obs: rtkObs(519560, 4282400, 1055) });
  const eski = await ps.addEquipment('pole', { group: 'sehir', typeId: t.id, state: 'MEVCUT', sebeke: { durum: 'KM' } }, { obs: rtkObs(519580, 4282400, 1055) });
  const sp = sebekeModel(ps);
  const el = (e) => sp.elemanlar.find((x) => x.gisId === e.no);
  assert.equal(el(km).durum, 'KM', 'KM korunur (YENI ile uyumlu)');
  assert.equal(el(km).kalemler[0].durum, 'KM', 'nesnenin kendi pozu da KM');
  assert.equal(el(me).durum, 'ME', 'ME korunur (MEVCUT ile uyumlu)');
  assert.equal(el(mm).durum, 'M+M', 'M+M seçimi korunur');
  assert.equal(el(dm).durum, 'DM');
  assert.equal(el(dm).kalemler[0].dmDurum, 'KESİK', 'demontaj türü nesnenin kendi pozuna yazılır');
  assert.equal(el(eski).durum, 'MEVCUT', 'durum MEVCUT olunca KM düşer');
  assert.equal(SH.hatEtiketi('KM', '3xSW'), '/3xSW\\');
  assert.equal(SH.hatEtiketi('ENH', '3xSW'), '{3xSW}');
  assert.equal(SH.hatEtiketi('M', '3x50 Alm.'), '^ 3x50 Al'); // metraj ve tanıtıcı yok (açıklık yazısında); malzeme adı görünen yazımla
  assert.equal(SH.hatEtiketi('DM', '3x50 Alm.'), '>3x50 Al<');
  // Geri alma: sebeke.durum ve dmDurum telefon kaydına yazılır
  const { ps: ps2 } = await setup();
  const ozet = await sebekeIceAl(ps2, JSON.parse(sebekeYaz(ps)), { name: 'durumlar' });
  assert.equal(ozet.yeniEleman, 5);
  const geriKm = ps2.data.equipment.find((e) => e.no === km.no);
  assert.equal(geriKm.sebeke.durum, 'KM');
  assert.equal(geriKm.state, 'YENI', 'KM telefonda yeni direk');
  const geriDm = ps2.data.equipment.find((e) => e.no === dm.no);
  assert.equal(geriDm.attrs.dmDurum, 'KESİK');
  const sp2 = sebekeModel(ps2);
  assert.equal(sp2.elemanlar.find((x) => x.gisId === km.no).durum, 'KM', 'ikinci turda da KM');
  assert.equal(sp2.elemanlar.find((x) => x.gisId === me.no).durum, 'ME', 'ikinci turda da ME');
});

test('A3c · parçalı hat gidiş-dönüş: parçalar telefonda tek hat olur, parça kimlikleri korunur, eklentide çizilen parçalar zincirlenir', async () => {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  const { poles } = await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const sp = sebekeModel(ps);
  const parcalar = sp.hatlar.filter((h) => h.tur === 'OG_HAVAI');
  assert.equal(parcalar.length, 3);
  // Başka telefona al: üç parça → bir hat, 4 düğüm, parça kimlikleri saklı
  const { ps: ps2 } = await setup();
  const oz = await sebekeIceAl(ps2, SH.projeOku(SH.projeYaz(sp)), { name: 'parcali' });
  assert.equal(oz.yeniHat, 1, 'parçalar tek hat olarak alınır');
  const hat = ps2.data.lines.find((l) => l.lineType === 'OG');
  assert.equal(hat.nodes.length, 4);
  assert.equal(Object.keys(hat.sebeke.parcalar).length, 3, 'parça kimlikleri düğüm çiftine göre saklanır');
  assert.equal(ps2.result.roles.get(ps2.data.equipment.find((e) => e.no === poles[1].no).id).role !== 'N', true, 'ara direk nihayet değil (hat bölünmedi)');
  // Geri yaz: aynı parça kimlikleri, aynı sırayla
  const geri = sebekeModel(ps2);
  assert.deepEqual(geri.hatlar.filter((h) => h.tur === 'OG_HAVAI').map((h) => h.id), parcalar.map((h) => h.id));
  // Eklentide çizilmiş (telefon kimliksiz) uç uca üç parça: tanımı aynıysa zincirlenir, farklıysa ayrı hat
  const { ps: ps3 } = await setup();
  const dosya = SH.projeOku(SH.projeYaz(sp));
  for (const h of dosya.hatlar) { delete h.telefonId; h.id = 'H' + h.id.slice(-1); }
  dosya.hatlar[2].anaKesit = '3x477'; dosya.hatlar[2].kalemler[0].tanim = '3x477'; dosya.hatlar[2].etiket = '^ 3x477/50m';
  const oz3 = await sebekeIceAl(ps3, dosya, { name: 'zincir' });
  assert.equal(oz3.yeniHat, 2, 'aynı tanımlı iki parça tek hat, farklı kesitli üçüncü parça ayrı hat');
  const uzun = ps3.data.lines.find((l) => l.nodes.length === 3);
  assert.ok(uzun && uzun.sebeke.parcalar && Object.keys(uzun.sebeke.parcalar).length === 2);
  // AutoCAD'den gelmiş tek parça hat (tanıtıcı H1): telefon H1-1, H1-2, H1-3 diye böler; eklenti ilk parçada H1'i
  // korur, diğerlerine yeni tanıtıcı + telefon kimliği (SH_ID) verir; geri gelince yine tek hat, tanıtıcılar haritada
  const { ps: ps4 } = await setup(); await newProject(ps4, { autoRecipe: false });
  await buildPoleLine(ps4, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const hatId = ps4.data.lines.find((l) => l.lineType === 'OG').id;
  await ps4.updateLine(hatId, { sebekeId: 'H1', sebeke: { id: 'H1' } }, 'AutoCAD kimliği');
  const sp4 = sebekeModel(ps4);
  assert.deepEqual(sp4.hatlar.filter((h) => h.tur === 'OG_HAVAI').map((h) => h.id), ['H1-1', 'H1-2', 'H1-3']);
  const cad = SH.projeOku(SH.projeYaz(sp4));
  const tanitici = ['H1', '9A01', '9A02'];
  cad.hatlar.filter((h) => h.tur === 'OG_HAVAI').forEach((h, i) => { h.telefonId = i === 0 ? '' : h.id; h.id = tanitici[i]; delete h.uclar; });
  const oz4 = await sebekeIceAl(ps4, cad, { projectId: ps4.p.id });
  assert.equal(oz4.yeniHat, 0, 'yeni hat açılmaz');
  const ogHatlar = ps4.data.lines.filter((l) => l.lineType === 'OG' && l.status !== 'deleted');
  assert.equal(ogHatlar.length, 1, 'üç parça yine tek hat');
  assert.equal(ogHatlar[0].nodes.length, 4);
  assert.deepEqual(Object.values(ogHatlar[0].sebeke.parcalar), tanitici);
  assert.deepEqual(sebekeModel(ps4).hatlar.filter((h) => h.tur === 'OG_HAVAI').map((h) => h.id), tanitici, 'dışa aktarımda AutoCAD tanıtıcıları');
});

test('A4 · AutoCAD örnek dosyası telefona alınır: direk tipleri katalogdan bulunur, hatlar uçlara bağlanır, kanal ve sondaj gelir; geri yazınca aynı kalır', async () => {
  const { ps } = await setup();
  const { proje } = voltProjeOku(fs.readFileSync(ORNEK, 'utf8'));
  const oz = await sebekeIceAl(ps, proje);
  assert.equal(oz.yeniEleman, 3); assert.equal(oz.yeniHat, 2); assert.equal(oz.yeniKanal, 2); assert.equal(oz.nokta, 1);
  assert.equal(ps.p.autoRecipe, false);
  assert.equal(ps.p.sebeke.katmanOnEki, 'SC'); assert.equal(ps.p.sebeke.bolgeler.length, 2);
  const sc1 = ps.data.equipment.find((e) => e.no === 'SC1');
  assert.equal(sc1.kind, 'pole'); assert.equal(sc1.group, 'sehir'); assert.equal(ps.cat.poleType(sc1.typeId).name, 'G-K2'); assert.equal(sc1.state, 'YENI'); assert.equal(sc1.sebekeId, 'E1');
  const sc7 = ps.data.equipment.find((e) => e.no === 'SC7');
  assert.equal(sc7.state, 'DEMONTAJ'); assert.equal(ps.cat.poleType(sc7.typeId).name, 'G-10I', 'galvanizsiz 10I → katalogdaki G-10I');
  const box = ps.data.equipment.find((e) => e.no === 'SCB03');
  assert.equal(box.kind, 'sdk');
  // Travers malzemesi telefonun malzeme tablosunda, adıyla
  const mats = ps.data.materials.filter((m) => m.ownerId === sc1.id);
  assert.equal(mats.length, 1); assert.equal(mats[0].sebeke.cins, 'TRAVERS_VE_KONSOLLAR_GLV'); assert.equal(mats[0].qty, 9.8);
  // Hatlar
  const og = ps.data.lines.find((l) => l.lineType === 'OG');
  assert.equal(og.install, 'havai'); assert.deepEqual(og.circuits.map((c) => c.key), ['3xSwallow']);
  const ag = ps.data.lines.find((l) => l.lineType === 'AG' && l.install === 'havai');
  assert.deepEqual(ag.circuits.map((c) => c.key), ['@AG_İLETKEN|3A+P+R'], '3A+P+R telefon kataloğunda yok → AutoCAD kataloğundaki iletken olarak gelir');
  assert.equal(ag.sebeke.anaKesit, '3A+P+R');
  assert.equal(lineLabel(ag, ps.cat), '3A+P+R', 'telefondaki yazı AutoCAD tanımı');
  const kanal = ps.data.lines.find((l) => l.channelOnly && l.cable.method === 'acik');
  assert.ok(kanal); assert.equal(kanal.cable.surface, 'toprak'); assert.equal(kanal.cable.width, 0.4); assert.equal(kanal.cable.depth, 1);
  const sondaj = ps.data.lines.find((l) => l.channelOnly && l.cable.method === 'sondaj');
  assert.ok(sondaj); assert.equal(sondaj.cable.pipeDia, 110);
  assert.equal(ps.result.issues.filter((i) => i.severity === 'error').length, 0, JSON.stringify(ps.result.issues.filter((i) => i.severity === 'error')));
  // Geri yazım: kimlikler, tür/cins/tip, durumlar ve kalemler korunur
  const geri = sebekeModel(ps);
  fs.writeFileSync(OUT + 'ornek-geri.sebeke.json', SH.projeYaz(geri));
  const e1 = geri.elemanlar.find((e) => e.gisId === 'SC1');
  assert.equal(e1.id, 'E1'); assert.equal(e1.tur, 'AG_DIREK'); assert.equal(e1.cins, 'AG_DEMİR_GLV'); assert.equal(e1.tip, 'G-K2'); assert.equal(e1.durum, 'M');
  assert.equal(e1.kalemler[0].katsayi, 504);
  assert.ok(e1.kalemler.some((k) => k.cins === 'TRAVERS_VE_KONSOLLAR_GLV' && k.tanim === 'G-L-50' && k.miktar === 9.8 && k.katsayi === 3.77), JSON.stringify(e1.kalemler));
  const e7 = geri.elemanlar.find((e) => e.gisId === 'SC7');
  assert.equal(e7.durum, 'DM'); assert.equal(e7.cins, 'AG_DEMİR'); assert.equal(e7.tip, '10I', 'eklentiden gelen cins ve tip korunur');
  assert.equal(geri.bolgeler.length, 2);
  const h1 = geri.hatlar.find((h) => h.tur === 'AG_HAVAI');
  assert.equal(h1.anaKesit, '3A+P+R'); assert.equal(h1.kalemler[0].cins, 'AG_İLETKEN'); assert.equal(h1.kalemler[0].tanim, '3A+P+R');
  // Telefonda dokunulmayan hat: eklentinin metrajı aynen döner (telefonun hesabı 98,99 m → 99; dosyada 100 yazılı)
  assert.equal(h1.kalemler[0].miktar, 100);
  assert.equal(h1.kalemler[0].sira, '14', 'kalemin INDEX sırası korunur');
  assert.equal(h1.kalemler[0].kontrol, false, 'miktar değişmediği için KONTROL işareti de korunur');
  const h2 = geri.hatlar.find((h) => h.tur === 'OG_HAVAI');
  assert.equal(h2.anaKesit, '3xSW'); assert.equal(h2.kalemler[0].cins, 'OG_İLETKEN');
  assert.equal(geri.kanallar.length, 1); assert.equal(geri.kanallar[0].kod, 12); assert.equal(geri.kanallar[0].zemin, 'TOPRAK');
  assert.equal(geri.sondajlar.length, 1);
  // Rapor satır sayısı ve toplam kg: özgün dosya ile geri yazılan dosya aynı
  const r0 = SH.durumTespit(proje, SH.katsayiHazirla(KATSAYILAR)), r1 = SH.durumTespit(geri, SH.katsayiHazirla(KATSAYILAR));
  const kg = (rows) => Math.round(rows.filter((r) => r.birim.endsWith('/kg')).reduce((a, r) => a + r.toplam, 0) * 1000) / 1000;
  assert.equal(kg(r1), kg(r0));
  assert.equal(r1.length, r0.length, 'satır sayısı');
  // Aynı dosyayı ikinci kez almak kayıt çoğaltmaz
  const oz2 = await sebekeIceAl(ps, proje, { projectId: ps.p.id });
  assert.equal(oz2.yeniEleman, 0); assert.equal(oz2.guncellenenEleman, 3); assert.equal(oz2.yeniHat, 0);
  assert.equal(ps.data.equipment.filter((e) => e.status !== 'deleted').length, 3);
});

test('A4b · AutoCAD\'in telefonda düzenlenmeyen verileri gidip gelir: bölge grup kodu, pano çıkış şeması (ekVeri)', async () => {
  const { ps } = await setup();
  const { proje } = voltProjeOku(fs.readFileSync(ORNEK, 'utf8'));
  proje.bolgeler[0].grup = '24.38.01 (NA)';
  const sc1 = proje.elemanlar.find((e) => e.gisId === 'SC1');
  sc1.ekVeri = { ANA: ['PANO;1'], CON: ['C1;3X50', 'C2;3X35'] };
  await sebekeIceAl(ps, proje);
  assert.equal(ps.p.sebeke.bolgeler[0].grup, '24.38.01 (NA)', 'grup kodu projede saklanır');
  const eq = ps.data.equipment.find((e) => e.no === 'SC1');
  assert.deepEqual(eq.sebeke.ekVeri.CON, ['C1;3X50', 'C2;3X35'], 'ek veri ekipmanda saklanır');
  const geri = SH.projeOku(SH.projeYaz(sebekeModel(ps)));
  assert.equal(geri.bolgeler.find((b) => b.id === proje.bolgeler[0].id).grup, '24.38.01 (NA)', 'grup kodu dosyaya geri yazılır');
  const e1 = geri.elemanlar.find((e) => e.gisId === 'SC1');
  assert.deepEqual(e1.ekVeri, { ANA: ['PANO;1'], CON: ['C1;3X50', 'C2;3X35'] }, 'ek veri aynen geri yazılır');
  assert.equal(geri.elemanlar.find((e) => e.gisId === 'SC7').ekVeri, undefined, 'ek verisi olmayan elemanda alan yok');
});

test('A4c · AutoCAD kalemlerinin INDEX sırası, hakedişi ve KONTROL işareti telefondan aynen döner; hakediş onayları gidip gelir', async () => {
  const { ps } = await setup();
  const { proje } = voltProjeOku(fs.readFileSync(ORNEK, 'utf8'));
  proje.proje.onaylar = [{ no: 2, kontrol: true, hakedis: false, gis: false }];
  const sc1 = proje.elemanlar.find((e) => e.gisId === 'SC1');
  sc1.kalemler.find((k) => !k.ana).hakedis = 3; // malzeme sonraki hakedişte eklenmiş
  await sebekeIceAl(ps, proje);
  assert.deepEqual(ps.p.sebeke.onaylar, [{ no: 2, kontrol: true, hakedis: false, gis: false }], 'onaylar projede saklanır');
  const geri = SH.projeOku(SH.projeYaz(sebekeModel(ps)));
  const metin = (v) => String(v ?? '');
  for (const tur of ['elemanlar', 'hatlar', 'kanallar', 'sondajlar']) {
    for (const o of proje[tur]) {
      const g = geri[tur].find((x) => x.id === o.id);
      assert.ok(g, tur + ' ' + o.id + ' geri yazıldı');
      assert.deepEqual(g.kalemler.map((k) => k.sira), o.kalemler.map((k) => k.sira), tur + ' ' + o.id + ': INDEX sırası korunur');
      assert.deepEqual(g.kalemler.map((k) => k.hakedis), o.kalemler.map((k) => k.hakedis), tur + ' ' + o.id + ': kalemin hakedişi korunur');
      o.kalemler.forEach((k, i) => { if (k.miktar === g.kalemler[i].miktar) assert.equal(metin(g.kalemler[i].kontrol), metin(k.kontrol), tur + ' ' + o.id + ': KONTROL korunur'); });
    }
  }
  assert.equal(geri.kanallar[0].durum, proje.kanallar[0].durum, 'kanalın çizim durumu (M+M) korunur');
  assert.deepEqual(geri.proje.onaylar, [{ no: 2, kontrol: true, hakedis: false, gis: false }], 'onaylar dosyaya geri yazılır');
  // Telefonda onaylanan dönem AutoCAD'e kontrol + hakediş onayı olarak gider
  await ps.createWorkProgram();
  const d1 = await ps.createPeriod({ start: '2026-09-01', end: '2026-09-30' });
  await ps.approvePeriod(d1.id);
  assert.deepEqual(sebekeModel(ps).proje.onaylar, [{ no: 1, kontrol: true, hakedis: true, gis: false }, { no: 2, kontrol: true, hakedis: false, gis: false }],
    'telefonda onaylanan 1. dönem kontrol + hakediş onayı olarak gider, AutoCAD onayı da kalır');
});

test('A5 · telefonun tam proje dosyası (volt-project/3) AutoCAD bölümünü taşır ve geri okunur', async () => {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const full = voltProjeYaz(ps);
  assert.equal(full.format, 'volt-project/3');
  assert.equal(full.sebeke.bicim, 'sebeke-hakedis.proje');
  assert.equal(full.sebeke.elemanlar.length, 4);
  const { proje, volt } = voltProjeOku(JSON.stringify(full));
  assert.equal(proje.elemanlar.length, 4); assert.equal(volt.format, 'volt-project/3');
  // Dışa aktarım biçimleri
  const [f] = await exportFormat(ps, 'sebeke');
  assert.ok(f.name.endsWith('.sebeke.json'));
  assert.equal(JSON.parse(Buffer.from(f.data).toString('utf8')).bicim, 'sebeke-hakedis.proje');
  const [g] = await exportFormat(ps, 'voltjson');
  assert.ok(g.name.endsWith('.volt.json'));
  assert.equal(JSON.parse(Buffer.from(g.data).toString('utf8')).format, 'volt-project/3');
});

test('A6 · katalog eşleme yardımcıları', async () => {
  const { ps } = await setup(); await newProject(ps);
  assert.equal(hatTipiEsle(ps.cat, '3xSW', 'OG', 'havai').name, '3xSwallow');
  assert.equal(hatTipiEsle(ps.cat, '3x1\\0', 'OG', 'havai').name, '3xRaven');
  assert.equal(hatTipiEsle(ps.cat, '3X50/16+70 ALPEK', 'AG', 'havai').name, '3x50/16+70 AER');
  assert.equal(hatTipiEsle(ps.cat, '1x150/25 Xlpe Alm.', 'OG', 'yeralti').name, '3x(1x150/25) NA2XSY', 'alüminyum XLPE → NA2XSY');
  assert.equal(hatTipiEsle(ps.cat, '1x150/25 Xlpe', 'OG', 'yeralti').name, '3x(1x150/25) YE3SV', 'bakır XLPE (eklentide "Alm." yok) → YE3SV');
  assert.deepEqual(cizimKesit('3x(1x95/16) YE3SV', 'OG', 'yeralti'), { tanim: '1x95/16 Xlpe', aciklama: '3(1x95/16) Xlpe' });
  assert.equal(hatTipiEsle(ps.cat, '3x95+50 Nyy Alm.', 'AG', 'yeralti').name, 'NAYY 3x95+50');
  assert.equal(hatTipiEsle(ps.cat, '4x16 Nyy Alm.', 'AG', 'yeralti').name, 'NAYY 4x16');
  assert.equal(hatTipiEsle(ps.cat, '3P+R', 'AG', 'havai').name, '3P+R');
  assert.equal(hatTipiEsle(ps.cat, 'bilinmeyen', 'AG', 'havai'), null);
  assert.equal(direkEsle(ps.cat, 'AG_DIREK', 'AG_BETON', '9,3/3').tip.name, '9.3/3');
  assert.equal(direkEsle(ps.cat, 'ENH_DIREK', 'ENH_DEMİR_GLV', 'G-T-12 (sw)').tip.name, 'GT-12 (3 AWG)');
  assert.equal(direkEsle(ps.cat, 'ENH_DIREK', 'ENH_DEMİR', 'D-10 (sw)').tip.name, 'GD-10 (3 AWG)');
  assert.equal(direkEsle(ps.cat, 'MUSTEREK_DIREK', 'MÜŞ_DEMİR_GLV', 'G-K2"').grup, 'mus');
  assert.equal(direkEsle(ps.cat, 'MUSTEREK_DIREK', 'MÜŞ_DEMİR_GLV', 'G-K2"').tip.name, "G-K2''", 'eski programın G-K2" yazımı katalogdaki G-K2\'\' ile eşleşir');
  assert.equal(cizimTip('mus', "G-10I''+2"), 'G-10I"+2');
  assert.equal(direkEsle(ps.cat, 'ENH_DIREK', 'ENH_GLV_CVT', 'P-6').tip.name, 'P-6 (3/0)', 'iletken eki olmayan cıvatalı direk tek adayla eşleşir');
  assert.equal(direkEsle(ps.cat, 'AYD_DIREK', 'AYD_GLV_PLG', 'AD1-100/10').tip.name, 'AD1-100/10');
  assert.equal(direkEsle(ps.cat, 'TRAFO_DIREGI', 'TR_DİREK', 'T-25').tip.name, 'G-T25');
});

test('A7 · telefon projesi → AutoCAD dosyası → başka telefon → AutoCAD dosyası: nesneler, kimlikler, kanal ve rapor korunur', async () => {
  const { ps } = await ornekProje();
  const ilk = sebekeModel(ps);
  const { ps: ps2 } = await setup();
  const oz = await sebekeIceAl(ps2, SH.projeOku(SH.projeYaz(ilk)));
  assert.equal(oz.yeniEleman, 10); assert.equal(oz.yeniHat, 3); assert.equal(oz.yeniKanal, 0, 'kanal aynı güzergâhtaki kabloya bağlanır');
  assert.equal(oz.eslesmeyen.length, 0, JSON.stringify(oz.eslesmeyen));
  const yer = ps2.data.lines.find((l) => l.install === 'yeralti');
  assert.equal(yer.cable.method, 'borulu'); assert.equal(yer.cable.pipeCount, 1); assert.equal(yer.cable.surface, 'asfalt'); assert.equal(yer.cable.width, 0.4); assert.equal(yer.cable.depth, 0.8);
  assert.deepEqual(yer.circuits.map((c) => c.key), ['NAYY 3x95+50']);
  assert.equal(ps2.data.materials.filter((m) => m.ownerId === yer.id && m.status !== 'deleted').length, 0, 'boru malzeme olarak çoğaltılmaz');
  const geri = sebekeModel(ps2);
  assert.equal(geri.elemanlar.length, ilk.elemanlar.length); assert.equal(geri.hatlar.length, ilk.hatlar.length); assert.equal(geri.kanallar.length, 1);
  // Kimlikler: ilk telefonun kimlikleri (telefonId) ikinci telefonda sebekeId olarak korunur ve geri yazılır
  for (const e of ilk.elemanlar) { const g = geri.elemanlar.find((x) => x.id === e.id); assert.ok(g, 'kimlik korunur: ' + e.gisId); assert.equal(g.tur, e.tur); assert.equal(g.cins, e.cins); assert.equal(g.tip, e.tip); assert.equal(g.durum, e.durum); }
  const kat = SH.katsayiHazirla(KATSAYILAR);
  const kg = (p) => Math.round(SH.durumTespit(p, kat).filter((r) => r.birim.endsWith('/kg')).reduce((a, r) => a + r.toplam, 0) * 100) / 100;
  assert.equal(kg(geri), kg(ilk));
  assert.equal(SH.durumTespit(geri, kat).length, SH.durumTespit(ilk, kat).length, 'rapor satır sayısı');
});

test('A8 · çok iletkenli hat: müşterekte OG + AG iki kalem ve birleşik ana kesit; 3 adet ALPEK ×3 ve "3x(…)"; geri alınınca devreler aynı', async () => {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  const rMus = route({ E: 519300, N: 4282100, H: 1050 }, [[60, 50, 0], [60, 50, 0]]);
  await buildPoleLine(ps, rMus, { group: 'mus', typeNames: "G-12U''", lineType: 'AG', musterek: true, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }, { role: 'AG', key: '3P+R', count: 1 }] });
  const rAg = route({ E: 519500, N: 4282300, H: 1050 }, [[90, 40, 0]]);
  await buildPoleLine(ps, rAg, { group: 'sehir', typeNames: 'G-K2', lineType: 'AG', circuits: [{ role: 'AG', key: '3x50/16+70 AER', count: 3 }] });
  const sp = sebekeModel(ps);
  // Müşterek: her parçada OG ve AG iletkeni ayrı kalem; ana kesit ve etiket eklentideki gibi "OG / AG"
  const mus = sp.hatlar.filter((h) => h.tur === 'MUSTEREK');
  assert.equal(mus.length, 2, 'müşterek hat direkten direğe iki parça');
  for (const h of mus) {
    const satir = h.kalemler.filter((k) => k.kaynak === 'HAT');
    assert.deepEqual(satir.map((k) => k.cins + ' ' + k.tanim), ['OG_İLETKEN 3xSW', 'AG_İLETKEN 3P+R']);
    assert.equal(h.anaKesit, '3xSW / 3P+R');
    assert.equal(h.etiket, '^ 3xSW / 3P+R');
  }
  // 3 adet ALPEK: tek kalem, miktar adet × güzergâh, tam yazım "3x(…)"
  const alpek = sp.hatlar.find((h) => h.tur === 'AG_HAVAI');
  const ak = alpek.kalemler.filter((k) => k.kaynak === 'HAT');
  assert.equal(ak.length, 1);
  assert.equal(ak[0].cins, 'ALPEK_KABLOLAR'); assert.equal(ak[0].tanim, '3X50/16+70 ALPEK'); assert.equal(ak[0].aciklama, '3x(3X50/16+70 ALPEK)');
  const metraj = ak[0].miktar / 3;
  assert.ok(Number.isInteger(metraj) && metraj >= 40, 'güzergâh metrajı tam metre: ' + metraj);
  assert.equal(alpek.etiket, '^ 3x(3x50/16+70 ALPEK)'); // metraj etikette değil, açıklık yazısında; görünen yazım (3X → 3x)
  // Başka telefona al: devreler (rol, tip, adet) aynen gelir; geri yazınca kalemler değişmez
  const { ps: ps2 } = await setup();
  const oz = await sebekeIceAl(ps2, SH.projeOku(SH.projeYaz(sp)), { name: 'cok-iletken' });
  assert.equal(oz.eslesmeyen.length, 0, JSON.stringify(oz.eslesmeyen));
  const m2 = ps2.data.lines.find((l) => l.musterek);
  assert.deepEqual(m2.circuits.map((c) => c.role + ' ' + c.key + ' ' + c.count), ['OG 3xSwallow 1', 'AG 3P+R 1']);
  const a2 = ps2.data.lines.find((l) => !l.musterek);
  assert.deepEqual(a2.circuits.map((c) => c.role + ' ' + c.key + ' ' + c.count), ['AG 3x50/16+70 AER 3']);
  const geri = sebekeModel(ps2);
  const ozet = (p) => p.hatlar.map((h) => h.tur + ' ' + h.anaKesit + ' ' + h.kalemler.filter((k) => k.kaynak === 'HAT').map((k) => k.cins + ':' + k.tanim + ':' + (k.aciklama || '') + ':' + k.miktar).join(',')).sort();
  assert.deepEqual(ozet(geri), ozet(sp));
  // Eklentide çizilmiş, telefon kataloğunda karşılığı olmayan iletkenli (4P+R) müşterek hat: AG devresi AutoCAD kataloğundaki
  // iletkenle açılır (telefonda düzenlenebilir), geri yazınca aynı kalemler döner
  const dosya = SH.projeOku(SH.projeYaz(sp));
  const cad = dosya.hatlar.find((h) => h.tur === 'MUSTEREK');
  dosya.hatlar = [cad]; dosya.kanallar = [];
  delete cad.telefonId; cad.id = 'H77'; delete cad.parca;
  const ag = cad.kalemler.find((k) => k.cins === 'AG_İLETKEN'); ag.tanim = '4P+R';
  cad.anaKesit = '3xSW / 4P+R';
  const { ps: ps3 } = await setup();
  const oz3 = await sebekeIceAl(ps3, dosya, { name: 'eklenti' });
  assert.equal(oz3.eslesmeyen.length, 0, JSON.stringify(oz3.eslesmeyen));
  const l3 = ps3.data.lines.find((l) => l.musterek);
  assert.deepEqual(l3.circuits.map((c) => c.role + ' ' + c.key + ' ' + c.count), ['OG 3xSwallow 1', 'AG @AG_İLETKEN|4P+R 1']);
  const h3 = sebekeModel(ps3).hatlar.find((h) => h.tur === 'MUSTEREK');
  assert.equal(h3.anaKesit, '3xSW / 4P+R');
  assert.deepEqual(h3.kalemler.filter((k) => k.kaynak === 'HAT').map((k) => k.cins + ' ' + k.tanim), ['OG_İLETKEN 3xSW', 'AG_İLETKEN 4P+R']);
  assert.equal(h3.kalemler.find((k) => k.tanim === '4P+R').miktar, cad.kalemler.find((k) => k.tanim === '4P+R').miktar, 'aynı güzergâh: aynı metraj');
});

test('A8b · eklentinin kataloğundaki her iletken / kablo telefonda bir devre olur; dokunulmayan hat aynı kalem ve metrajla, telefonda değişen hat yeni metrajla döner', async () => {
  const gruplar = KALEMLER.gruplar.hatlar;
  const turu = (cins) => Object.keys(gruplar).find((t) => t !== 'MUSTEREK' && gruplar[t].includes(cins)) || 'AG_YERALTI';
  const kalemler = KALEMLER.kalemler.filter((k) => k.rol === 'hat');
  assert.ok(kalemler.length > 300, 'katalogda ' + kalemler.length + ' iletken / kablo');
  const sp = SH.yeniProje({ ad: 'İletkenler', dom: 39, hakedis: 1 });
  kalemler.forEach((k, i) => {
    const x = 519000 + (i % 20) * 100, y = 4282000 + Math.floor(i / 20) * 30;
    // Eklentideki metraj = çizim boyu (50 m) + ek pay (2 m)
    sp.hatlar.push({ id: 'H' + (i + 1), tur: turu(k.cins), anaKesit: k.tanim, durum: 'M', hakedis: 1, bolge: '', etiket: '', kontrol: true, katman: '', kose: [[x, y], [x + 50, y]], kalemler: [Object.assign(SH.kalemYap(k, { miktar: 52, durum: 'M', hakedis: 1, kaynak: 'HAT', sira: String(i + 1) }), { kontrol: true })] });
  });
  const { ps } = await setup();
  const oz = await sebekeIceAl(ps, SH.projeOku(SH.projeYaz(sp)), { name: 'iletkenler' });
  assert.equal(oz.eslesmeyen.length, 0, JSON.stringify(oz.eslesmeyen.slice(0, 5)));
  assert.equal(oz.yeniHat, kalemler.length);
  const hatlar = ps.data.lines.filter((l) => l.status !== 'deleted');
  let autocadTipi = 0;
  for (const l of hatlar) {
    const k = kalemler[+l.sebekeId.slice(1) - 1];
    assert.equal(l.circuits.length, 1, k.cins + ' ' + k.tanim + ': telefonda devre açılır');
    const c = l.circuits[0];
    assert.ok(circuitParts(c, ps.cat), k.tanim + ': parçaları bulunur');
    if (c.key.startsWith('@')) {
      autocadTipi++;
      assert.equal(c.key, autocadAnahtari(k.cins, k.tanim));
      // Hat ekranındaki listede de var (hattın türüne uyan cinslerde)
      if (gruplar[l.sebeke.tur] && gruplar[l.sebeke.tur].includes(k.cins)) assert.ok(autocadSecenekleri(ps.cat, c.role, l.install).some((x) => x[0] === c.key), k.tanim + ': hat ekranında seçilebilir');
    }
  }
  assert.ok(autocadTipi > 200, autocadTipi + ' iletken AutoCAD tipiyle geldi');
  // Dokunmadan geri yaz: aynı tür, cins, tanım, metraj; KONTROL işareti korunur
  const satir = (h) => h.kalemler.filter((k) => k.kaynak === 'HAT').map((k) => [k.cins, k.tanim, k.miktar, k.kontrol, k.sira].join(' · '));
  const geri = new Map(sebekeModel(ps).hatlar.map((h) => [h.id, h]));
  for (const h of sp.hatlar) {
    const g = geri.get(h.id);
    assert.ok(g, h.id + ' geri yazıldı');
    assert.equal(g.tur, h.tur, h.anaKesit + ': tür');
    assert.deepEqual(satir(g), satir(h), h.anaKesit + ': HAT kalemi');
  }
  // Telefonda boyu değişen hat: telefonun metrajıyla döner (AutoCAD'deki ek pay yeni boya taşınmaz)
  const l0 = hatlar.find((l) => l.circuits[0].key === '@AG_İLETKEN|4P+R');
  assert.ok(l0, '4P+R hattı');
  const son = ps.pointById(l0.nodes[l0.nodes.length - 1]);
  await ps.ds.update('points', son.id, { E: son.E + 10 }, { reason: 'deneme: nokta taşındı' });
  await ps.reload('points'); await ps.recompute('nokta taşındı');
  const g2 = sebekeModel(ps).hatlar.find((h) => h.telefonId === l0.id);
  const k2 = g2.kalemler.find((k) => k.kaynak === 'HAT');
  assert.equal(k2.miktar, 60, '60 m: telefonun hesabı');
  assert.equal(k2.kontrol, null, 'miktar değişti: KONTROL işareti düşer');
});

test('A9 · teknik hesap kayıtları (Hesap Merkezi) dosyayla gidip gelir: hedef kimlikleri, trafo çıkışı, daha yeni kayıt kazanır', async () => {
  const { hesapKaydet, hesapKayitlari, kayitBul, guncellik } = await import('../src/hesap/kayitlar.js');
  const { baglamKur } = await import('../src/hesap/baglam.js');
  const { ps, tr, agPts } = await ornekProje();
  const agHat = ps.data.lines.find((l) => l.install === 'havai' && l.lineType === 'AG');
  // Bağlam: direk hedefi (kollar, iletken) ve hat hedefi (açıklıklar)
  const bd = baglamKur(ps, { tur: 'direk', id: agPts[1].id });
  assert.equal(bd.hedef.tur, 'direk'); assert.equal(bd.hedef.no, agPts[1].no);
  assert.equal(bd.direk.kollar.length, 2, 'orta direğin iki kolu');
  assert.ok(bd.direk.kollar.every((k) => k.aciklik > 39 && k.aciklik < 41), 'kol açıklıkları 40 m');
  assert.equal(bd.direk.kollar[0].iletkenler[0].ad, '3x70/16+95 AER');
  const bh = baglamKur(ps, { tur: 'hat', id: agHat.id });
  assert.equal(bh.hat.acikliklar.length, 2); assert.equal(Math.round(bh.hat.toplamUzunluk), 80);
  // Kayıt: trafo hedefi + çıkış (hatId); aynı hedefte yeniden kaydetmek üzerine yazar
  const hedef = { tur: 'trafo', id: tr.id, no: tr.no, hatId: agHat.id };
  const id1 = await hesapKaydet(ps, { modul: 'ag-gd', modulAdi: 'AG Gerilim Düşümü', hedef, ozet: '%1,5', durum: 'uygun', ayrinti: { girdiler: [{ ad: 'Güç', deger: 160, birim: 'kVA' }], degerler: [], uyarilar: [] }, modulDurumu: { a: 1 }, kullanilan: { 'trafo.gucKVA': 160, 'hat.acikliklar[0].uzunluk': bh.hat.acikliklar[0].uzunluk } }, 'Deneme Kişisi');
  const id2 = await hesapKaydet(ps, { modul: 'ag-gd', hedef, ozet: '%1,6', durum: 'uygun', kayitId: '', kullanilan: { 'trafo.gucKVA': 160 } }, 'Deneme Kişisi');
  assert.equal(id1, id2, 'aynı trafo ve çıkış: tek kayıt');
  await hesapKaydet(ps, { modul: 'ag-gd', hedef: { tur: 'trafo', id: tr.id, no: tr.no }, ozet: 'çıkışsız', durum: 'bilgi', kullanilan: {} }, 'Deneme Kişisi');
  await hesapKaydet(ps, { modul: 'amax', hedef: { tur: 'direk', id: agPts[1].id, no: agPts[1].no }, ozet: 'amax 120 m', durum: 'bilgi', kullanilan: { 'direk.kollar[0].aciklik': 40 } }, 'Deneme Kişisi');
  assert.equal(hesapKayitlari(ps).length, 3, 'trafo (çıkışlı), trafo (çıkışsız), direk');
  assert.ok(kayitBul(ps, 'ag-gd', hedef) && kayitBul(ps, 'ag-gd', hedef).ozet === '%1,6');
  assert.ok(kayitBul(ps, 'ag-gd', { tur: 'trafo', id: tr.id, no: tr.no }).ozet === 'çıkışsız', 'çıkışsız kayıt ayrı');
  const g = guncellik(ps, kayitBul(ps, 'ag-gd', hedef), 'Deneme Kişisi');
  assert.equal(g.farklar.length, 0, 'kayıt güncel');
  // Dosyaya: hedef kimlikleri dosyadaki kimliklere, çıkış ilk parçaya; telefonId taşınır
  const sp = sebekeModel(ps);
  assert.equal(sp.hesaplar.length, 3);
  const hk = sp.hesaplar.find((h) => h.hedef.hatId);
  const trEl = sp.elemanlar.find((e) => e.telefonId === tr.id);
  assert.equal(hk.hedef.id, trEl.id, 'trafo hedefi dosyadaki eleman kimliğiyle');
  assert.ok(sp.hatlar.some((h) => h.id === hk.hedef.hatId && h.telefonId === agHat.id), 'çıkış hattı dosyadaki parça kimliğiyle');
  assert.equal(hk.telefonId, id1); assert.equal(hk.kaynak, 'telefon'); assert.equal(hk.yapan, 'Deneme Kişisi');
  const dk = sp.hesaplar.find((h) => h.modul === 'amax');
  assert.equal(dk.hedef.id, sp.elemanlar.find((e) => e.telefonId === agPts[1].id).id);
  const metin = SH.projeYaz(sp);
  assert.equal(SH.projeOku(metin).hesaplar.length, 3, 'proje dosyası hesapları okur');
  // Başka telefona: kayıtlar hedefleriyle gelir; aynı dosya ikinci kez alınınca çoğalmaz; daha yeni tarih günceller
  const { ps: ps2 } = await setup();
  const oz = await sebekeIceAl(ps2, SH.projeOku(metin));
  assert.deepEqual(oz.hesap, { yeni: 3, guncel: 0 });
  const k2 = hesapKayitlari(ps2).find((k) => k.hedef.hatId);
  const tr2 = ps2.data.equipment.find((e) => e.kind === 'transformer');
  assert.equal(k2.hedef.id, tr2.id, 'trafo hedefi ikinci telefondaki kayda bağlandı');
  assert.equal(k2.hedef.hatId, ps2.data.lines.find((l) => l.install === 'havai' && l.lineType === 'AG').id, 'çıkış hattı bağlandı');
  assert.equal(k2.sebekeId, id1, 'dosyadaki kimlik saklanır');
  const oz2 = await sebekeIceAl(ps2, SH.projeOku(metin), { projectId: ps2.p.id });
  assert.deepEqual(oz2.hesap, { yeni: 0, guncel: 0 }, 'ikinci alışta değişiklik yok');
  const sp3 = SH.projeOku(metin);
  const amax3 = sp3.hesaplar.find((h) => h.modul === 'amax');
  amax3.tarih = '2099-01-01T00:00:00.000Z'; amax3.ozet = 'güncellenmiş';
  const oz3 = await sebekeIceAl(ps2, sp3, { projectId: ps2.p.id });
  assert.deepEqual(oz3.hesap, { yeni: 0, guncel: 1 });
  assert.ok(hesapKayitlari(ps2).some((k) => k.modul === 'amax' && k.ozet === 'güncellenmiş'));
  // Geri yazınca ikinci telefonun kayıtları ilk telefonun kimlikleriyle (sebekeId) döner
  const geri = sebekeModel(ps2);
  assert.equal(geri.hesaplar.length, 3, 'bütün kayıtlar geri yazılır: ' + JSON.stringify(geri.uyarilar || []));
  assert.deepEqual(geri.hesaplar.map((h) => h.id).sort(), sp.hesaplar.map((h) => h.id).sort(), 'kimlikler korunur');
  assert.equal(geri.hesaplar.find((h) => h.modul === 'amax').ozet, 'güncellenmiş', 'özet güncel');
});

test('A10 · katalogda olmayan AutoCAD hattı (rekortman): hesap bağlamında iletken ve hat türü AutoCAD\'deki gibi', async () => {
  const { baglamKur } = await import('../src/hesap/baglam.js');
  const { farklar } = await import('../../../ortak/hesap/kurallar.mjs');
  const dosya = JSON.parse(fs.readFileSync(path.join(here, '../../../autocad/test/CekirdekTest/telefon-proje.sebeke.json'), 'utf8'));
  const { ps } = await setup();
  await sebekeIceAl(ps, dosya, { name: 'rekortman' });
  const e = ps.data.equipment.find((x) => x.no === 'SC108');
  assert.ok(e, 'SC108 alındı');
  const b = baglamKur(ps, { tur: 'direk', id: e.id }, {});
  const rek = b.direk.kollar.find((k) => k.hatTur === 'REKORTMAN');
  assert.ok(rek, 'rekortman kolu AutoCAD türüyle gelir');
  assert.deepEqual(rek.iletkenler.map((i) => [i.ad, i.adet, i.devre]), [['4x16 Nyy Alm.', 1, 'AG']], 'iletken eklentinin HAT satırından');
  // AutoCAD'de kaydedilmiş bir hesabın kullandığı değerler telefonda da aynı: platformlar arası fark yok
  const i = b.direk.kollar.indexOf(rek);
  const kullanilan = { ['direk.kollar[' + i + '].iletkenler[0].ad']: '4x16 Nyy Alm.', ['direk.kollar[' + i + '].iletkenler[0].adet']: 1 };
  assert.equal(farklar(kullanilan, b, { platformlarArasi: true }).length, 0);
});

test('A20 · Google Earth ve MapInfo (CBS) telefon projesinden: eklentinin dosyasıyla aynı içerik, Türkçe kod sayfası, koordinat seçimi', async () => {
  const { unzip } = await import('../src/export/zip.js');
  const { kmlMetni, cbsNesneleri, mifDosyalari, mifCoordSys } = await import('../src/export/cbs.js');
  const { makeCrs, unproject } = await import('../src/geo/crs.js');
  const { ps, poles } = await ornekProje();
  const sp = SH.projeOku(sebekeYaz(ps));
  const nesneler = cbsNesneleri(sp);
  // KMZ: içinde doc.kml; asıl içerik eklentinin yazacağıyla aynı (aynı proje modelinden), sonda 3B klasörü (kapalı)
  const [kmz] = await exportFormat(ps, 'kmz', { surum: 'telefon 9.9.9' });
  const kml = new TextDecoder().decode((await unzip(kmz.data))['doc.kml']);
  const crs = ps.p.crs;
  const asil = kmlMetni(sp, { donustur: (E, N) => { const g = unproject(E, N, crs); return [g.lon, g.lat]; }, surum: 'telefon 9.9.9', sistem: 'ITRF96 / TM 39 (3°)', tarih: 'T' });
  const govde = (s) => s.replace(/<description>Şebeke-M [^<]*<\/description>/, '').replace(/<Folder><name>3B direk[\s\S]*?<\/Folder>\n/, '');
  assert.equal(govde(kml), govde(asil), 'KMZ içeriği eklentinin yapısıyla aynı');
  assert.match(kml, /<description>Şebeke-M telefon 9\.9\.9 · ITRF96 \/ TM 39 \(3°\) → WGS84 · \d\d\.\d\d\.\d{4} \d\d:\d\d<\/description>/);
  assert.match(kml, /<Folder><name>3B direk ve iletken \(telefon\)<\/name><visibility>0<\/visibility>/, '3B klasörü başta kapalı');
  assert.equal((asil.match(/<Placemark>/g) || []).length, nesneler.filter((n) => n.katman.ad !== 'MALZEME').length, 'her CBS nesnesi bir yer işareti (malzeme satırları hariç)');
  const direk = nesneler.find((n) => n.katman.ad === 'DIREK' && n.ad === poles[0].no);
  assert.ok(direk && kml.includes('<name>' + poles[0].no + '</name><styleUrl>#placemark_circle_'), 'direk adı GIS no, simgesi daire');
  assert.ok(kml.includes('<Data name="TIP"><displayName>Tip</displayName><value>G-D-10 (sw)</value></Data>'), 'tipi öznitelikte');
  // MIF / MID: dolu katmanlar, Türkçe Windows kod sayfası, proje sisteminin CoordSys satırı
  const [z] = await exportFormat(ps, 'mif');
  const files = await unzip(z.data);
  const base = Object.keys(files).find((n) => n.endsWith('_DIREK.mif')).replace('_DIREK.mif', '');
  for (const k of ['BOLGE', 'DIREK', 'HAT', 'KANAL', 'MALZEME']) assert.ok(files[base + '_' + k + '.mif'] && files[base + '_' + k + '.mid'], k);
  const metin1254 = (u8) => { const t = new TextDecoder('windows-1254').decode(u8); return t; };
  const mif = metin1254(files[base + '_DIREK.mif']), mid = metin1254(files[base + '_DIREK.mid']);
  assert.ok(mif.includes('Charset "WindowsTurkish"\r\n') && mif.includes(mifCoordSys(crs) + '\r\n'));
  assert.ok(mid.includes('"ENH_DEMİR_GLV"'), 'Türkçe harfler 1254 kod sayfasında doğru');
  const beklenen = mifDosyalari(sp, base, { coordSys: mifCoordSys(crs) }).find((d) => d.name === base + '_DIREK.mid').text;
  assert.equal(mid, beklenen, 'MID metni eklentinin yapısıyla aynı');
  // Başka koordinat sistemi (Dışa Aktarım'daki seçim): köşeler çevrilir, CoordSys ona göre
  const utm = makeCrs({ datum: 'WGS84', projection: 'UTM', zone: 37 });
  const [zu] = await exportFormat(ps, 'mif', { crs: utm });
  const fu = await unzip(zu.data);
  const mifU = metin1254(fu[base + '_DIREK.mif']);
  assert.ok(mifU.includes('CoordSys Earth Projection 8, 104, "m", 39, 0, 0.9996, 500000, 0'), 'UTM CoordSys');
  const ilk = (t) => t.match(/Point ([\d.]+) ([\d.]+)/).slice(1).map(Number);
  const [e1, n1] = ilk(mif), [e2, n2] = ilk(mifU);
  assert.ok(Math.abs(e2 - (500000 + (e1 - 500000) * 0.9996)) < 0.01 && Math.abs(n2 - n1 * 0.9996) < 0.01, 'UTM köşesi TM köşesinin 0,9996 katı (aynı orta meridyen)');
  // Teslim paketi: HARITA klasöründe KMZ ve MIF/MID
  const [pk] = await exportFormat(ps, 'package');
  const pf = Object.keys(await unzip(pk.data));
  assert.ok(pf.some((n) => /\/HARITA\/.*\.kmz$/.test(n)) && pf.some((n) => /\/HARITA\/mif\/.*_DIREK\.mif$/.test(n)), 'paket: KMZ ve MIF');
});
