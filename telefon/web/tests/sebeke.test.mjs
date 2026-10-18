// AutoCAD eklentisiyle dosya uyumu: telefon projesi → .sebeke.json → (Durum Tespit) ve .sebeke.json → telefon → .sebeke.json
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setup, newProject, buildPoleLine, rtkObs, route } from './helpers.mjs';
import { sebekeYaz, sebekeModel, sebekeIceAl, voltProjeYaz, voltProjeOku, promagisTip, voltTip, promagisKesit, hatTipiEsle, direkEsle, SH } from '../src/interop/sebeke.js';
import KATSAYILAR from '../src/ortak/katsayilar.js';
import { exportFormat } from '../src/export/exporter.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(here, 'out/'); fs.mkdirSync(OUT, { recursive: true });
const ORNEK = path.join(here, 'fixtures/ornek-proje.sebeke.json');

const OG_ROUTE = route({ E: 519300, N: 4282100, H: 1050 }, [[60, 80, 2], [60, 80, 1], [120, 70, -1]]);
const OG_TYPES = ['GD-10 (3 AWG)', 'GT-10 (3 AWG)', 'GT-10 (3 AWG)', 'GN-10 (3 AWG)'];

test('A1 · ad ve tip yazımları iki yönde çevrilir', () => {
  assert.equal(promagisTip('beton', '9.3/8'), '9,3/8');
  assert.equal(voltTip('beton', '9,3/8'), '9.3/8');
  assert.equal(promagisTip('bahh', 'GD-10 (3 AWG)'), 'G-D-10 (sw)');
  assert.equal(voltTip('bahh', 'G-D-10 (sw)'), 'GD-10 (3 AWG)');
  assert.equal(promagisTip('bahh', 'GT-12 (1/0)'), 'G-T-12 (1/0)');
  assert.equal(promagisTip('sehir', 'G-K2'), 'G-K2');
  assert.equal(promagisTip('trafo', 'G-T25'), 'G-T-25');
  assert.equal(voltTip('trafo', 'G-T-25'), 'G-T25');
  assert.deepEqual(promagisKesit('3xSwallow', 'OG', 'havai'), { tanim: '3xSW', aciklama: '' });
  assert.deepEqual(promagisKesit('3xRaven', 'OG', 'havai'), { tanim: '3x1\\0', aciklama: '' });
  assert.deepEqual(promagisKesit('3P+R', 'AG', 'havai'), { tanim: '3P+R', aciklama: '' });
  assert.deepEqual(promagisKesit('3x70/16+95 AER', 'AG', 'havai'), { tanim: '3X70/16+95 ALPEK', aciklama: '' });
  assert.deepEqual(promagisKesit('3x(1x150/25) NA2XSY', 'OG', 'yeralti'), { tanim: '1x150/25 Xlpe Alm.', aciklama: '3(1x150/25) Xlpe Alm.' });
  assert.deepEqual(promagisKesit('NAYY 3x95+50', 'AG', 'yeralti'), { tanim: '3x95+50 Nyy Alm.', aciklama: '' });
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
  assert.ok(/^\^ 3xSW\/\d+m$/.test(og.etiket), og.etiket);
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
  assert.equal(yer.anaKesit, '3x95+50 Nyy Alm.'); assert.equal(yer.kalemler[0].cins, 'AG_ALİMİNYUM_KABLO');
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

test('A3b · PROMAGIS durum kodu korunur: KM / ME / M+M seçimi ve demontaj türü (KESİK) dışa aktarımda döner, durum değişince düşer', async () => {
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
  assert.equal(SH.hatEtiketi('KM', '3xSW', 120), '/3xSW\\/120m');
  assert.equal(SH.hatEtiketi('ENH', '3xSW', 120), '{3xSW}/120m');
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
  assert.equal(ag.circuits.length, 0, '3A+P+R telefon kataloğunda yok → kalemler saklanır');
  assert.equal(ag.sebeke.anaKesit, '3A+P+R');
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
  assert.equal(h1.anaKesit, '3A+P+R'); assert.equal(h1.kalemler[0].cins, 'AG_İLETKEN'); assert.equal(h1.kalemler[0].miktar, 100);
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
  assert.equal(hatTipiEsle(ps.cat, '1x150/25 Xlpe Alm.', 'OG', 'yeralti').name, '3x(1x150/25) YE3SV');
  assert.equal(hatTipiEsle(ps.cat, '3x95+50 Nyy Alm.', 'AG', 'yeralti').name, 'NAYY 3x95+50');
  assert.equal(hatTipiEsle(ps.cat, '4x16 Nyy Alm.', 'AG', 'yeralti').name, 'NAYY 4x16');
  assert.equal(hatTipiEsle(ps.cat, '3P+R', 'AG', 'havai').name, '3P+R');
  assert.equal(hatTipiEsle(ps.cat, 'bilinmeyen', 'AG', 'havai'), null);
  assert.equal(direkEsle(ps.cat, 'AG_DIREK', 'AG_BETON', '9,3/3').tip.name, '9.3/3');
  assert.equal(direkEsle(ps.cat, 'ENH_DIREK', 'ENH_DEMİR_GLV', 'G-T-12 (sw)').tip.name, 'GT-12 (3 AWG)');
  assert.equal(direkEsle(ps.cat, 'ENH_DIREK', 'ENH_DEMİR', 'D-10 (sw)').tip.name, 'GD-10 (3 AWG)');
  assert.equal(direkEsle(ps.cat, 'MUSTEREK_DIREK', 'MÜŞ_DEMİR_GLV', 'G-K2"').grup, 'mus');
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
