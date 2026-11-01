// Onay kilidi (hata 3): onay açıkken kontrol edilmiş / hakedişteki / onaylı kaydın miktarı, malzemesi, konumu
// değiştirilemez ve kayıt silinemez — bütün servis yolları (malzeme, ekipman, hat, bağlı nokta, taşıma, bölme,
// birleştirme, son alımı geri alma, yeniden numaralama) aynı kilide bağlıdır. Kilit kapalıyken ve yönetici
// oturumunda işlemler serbesttir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, newProject, buildPoleLine, rtkObs, route } from './helpers.mjs';

const ROUTE = route({ E: 519300, N: 4282100, H: 1050 }, [[60, 80, 2], [60, 80, 1], [120, 70, -1]]);
const TYPES = ['GD-10 (3 AWG)', 'GT-10 (3 AWG)', 'GT-10 (3 AWG)', 'GN-10 (3 AWG)'];
const OG = [{ role: 'OG', key: '3xSwallow', count: 1 }];

// Onay açık (yönetici tanımlı), oturum kapalı; direk hattı + ikinci hat; ilk direk ve ilk hat KONTROL durumunda
async function kilitliOrtam() {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  const { poles, line } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: OG });
  const mat = await ps.addMaterial('equipment', poles[0].id, '011.06.04.01-001', 1, 'Askı izolatörü');
  const matSerbest = await ps.addMaterial('equipment', poles[2].id, '011.06.04.01-001', 1, 'Askı izolatörü');
  const extra = await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-10 (3 AWG)').id, state: 'YENI' }, { obs: rtkObs(519600, 4282400, 1049) });
  const line2 = await ps.createLine({ lineType: 'OG', install: 'havai', circuits: OG, nodes: [poles[3].pointId, extra.pointId], state: 'YENI' });
  await ps.addMember({ name: 'Yön Etici', role: 'yonetici', pin: '9999' });
  ps.logout();
  await ps.ds.update('equipment', poles[0].id, { hak: 'KONTROL' }, { reason: 'deneme' });
  await ps.ds.update('lines', line.id, { hak: 'KONTROL' }, { reason: 'deneme' });
  await ps.reload('equipment'); await ps.reload('lines'); await ps.reload('materials');
  assert.equal(ps.approval().on, true); assert.equal(ps.approval().lock, true); assert.equal(ps.member, null);
  return { ps, poles, line, line2, extra, mat, matSerbest };
}
const kilitli = /kilitli/;
const canli = (ps, store) => ps.data[store].filter((x) => x.status !== 'deleted');

test('K1 · kilitli ekipman: tip değişikliği gibi malzeme miktarı, malzeme silme / ekleme ve ekipmanı silme de reddedilir; veri değişmez', async () => {
  const { ps, poles, mat, matSerbest } = await kilitliOrtam();
  const e = poles[0];
  const tipB = ps.cat.poleTypeByName('bahh', 'GN-10 (3 AWG)').id;
  await assert.rejects(() => ps.updateEquipment(e.id, { typeId: tipB }, 'deneme'), kilitli, 'tip değişikliği (eski davranış)');
  await assert.rejects(() => ps.setMaterialRowQty(mat.id, 99), kilitli, 'malzeme miktarı 1 → 99');
  assert.equal(ps.data.materials.find((m) => m.id === mat.id).qty, 1, 'miktar değişmedi');
  await assert.rejects(() => ps.removeMaterial(mat.id, 'deneme'), kilitli, 'malzeme silme');
  assert.equal(canli(ps, 'materials').some((m) => m.id === mat.id), true, 'malzeme duruyor');
  await assert.rejects(() => ps.addMaterial('equipment', e.id, '011.06.04.01-001', 2, 'ek'), kilitli, 'elle malzeme ekleme');
  await assert.rejects(() => ps.addFieldMaterial(e.id, '011.06.04.01-001', 2, 'sahada ilave'), kilitli, 'sahada ilave');
  await assert.rejects(() => ps.setMaterialQty(e.id, '011.06.04.01-001', 5, 'deneme'), kilitli, 'reçete miktarı');
  await assert.rejects(() => ps.approveMaterial(mat.id, false, 'deneme'), /kilitli|oturum/, 'malzeme onayını değiştirme');
  await assert.rejects(() => ps.removeEquipment(e.id, 'deneme'), kilitli, 'ekipman silme');
  assert.equal(canli(ps, 'equipment').some((x) => x.id === e.id), true, 'ekipman duruyor');
  // Kilitsiz ekipman aynı işlemleri yapabilir
  await ps.setMaterialRowQty(matSerbest.id, 3);
  assert.equal(ps.data.materials.find((m) => m.id === matSerbest.id).qty, 3);
  await ps.removeMaterial(matSerbest.id, 'deneme');
  assert.equal(canli(ps, 'materials').some((m) => m.id === matSerbest.id), false);
});

test('K2 · kilitli ekipmanın noktası: taşıma, yeniden ölçüm, kot / numara değişikliği reddedilir; serbest nokta taşınır', async () => {
  const { ps, poles, extra } = await kilitliOrtam();
  const p = ps.pointById(poles[0].pointId);
  await assert.rejects(() => ps.movePoint(p.id, p.E + 5, p.N, 'deneme'), kilitli, 'taşıma');
  await assert.rejects(() => ps.remeasure(p.id, rtkObs(p.E + 1, p.N + 1, 1000), 'deneme'), kilitli, 'yeniden ölçüm');
  await assert.rejects(() => ps.updatePoint(p.id, { H: 1 }, 'deneme'), kilitli, 'kot değişikliği');
  await assert.rejects(() => ps.updatePoint(p.id, { pointNo: 'X' }, 'deneme'), kilitli, 'numara değişikliği');
  const p2 = ps.pointById(p.id);
  assert.equal(p2.E, p.E); assert.equal(p2.N, p.N); assert.equal(p2.H, p.H); assert.equal(p2.pointNo, p.pointNo);
  await ps.updatePoint(p.id, { critical: false }, 'deneme'); // metrajı etkilemeyen alan serbest
  assert.equal(ps.pointById(p.id).critical, false);
  const s = ps.pointById(extra.pointId);
  await ps.movePoint(s.id, s.E + 5, s.N, 'deneme');
  assert.equal(ps.pointById(s.id).E, s.E + 5);
});

test('K3 · kilitli hat: silme, bölme, birleştirme, düğüm ekleme / çıkarma, son alımı geri alma ve düğüm noktasını taşıma reddedilir; hiçbir şey kısmen değişmez', async () => {
  const { ps, poles, line, line2, extra } = await kilitliOrtam();
  const once = JSON.stringify([ps.lineById(line.id).nodes, ps.lineById(line2.id).nodes]);
  await assert.rejects(() => ps.removeLine(line.id, 'deneme'), kilitli, 'hat silme');
  await assert.rejects(() => ps.splitLine(line.id, 1), kilitli, 'bölme');
  await assert.rejects(() => ps.mergeLines(line.id, line2.id), kilitli, 'birleştirme (ilk kilitli)');
  await assert.rejects(() => ps.mergeLines(line2.id, line.id), kilitli, 'birleştirme (ikinci kilitli)');
  await assert.rejects(() => ps.appendNode(line.id, extra.pointId), kilitli, 'düğüm ekleme');
  await assert.rejects(() => ps.removeNode(line.id, 1), kilitli, 'düğüm çıkarma');
  await assert.rejects(() => ps.reverseLine(line.id), kilitli, 'yön çevirme');
  await assert.rejects(() => ps.undoCapture({ pointId: poles[3].pointId, eqId: poles[3].id, lineId: line.id }), kilitli, 'son alımı geri alma');
  // Kilitli hattın ara düğümü (ekipmanı kilitsiz) de taşınamaz: hat uzunluğu değişirdi
  const ara = ps.pointById(poles[1].pointId);
  await assert.rejects(() => ps.movePoint(ara.id, ara.E + 2, ara.N, 'deneme'), kilitli, 'kilitli hattın düğümü');
  assert.equal(JSON.stringify([ps.lineById(line.id).nodes, ps.lineById(line2.id).nodes]), once, 'hatlar değişmedi');
  assert.equal(canli(ps, 'lines').length, 2); assert.equal(canli(ps, 'equipment').length, 5);
  // Kilitsiz hat (line2) bölünüp birleştirilebilir
  const extra2 = await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-10 (3 AWG)').id, state: 'YENI' }, { obs: rtkObs(519700, 4282450, 1049) });
  await ps.appendNode(line2.id, extra2.pointId);
  const yeni = await ps.splitLine(line2.id, 1);
  assert.equal(canli(ps, 'lines').length, 3);
  await ps.mergeLines(line2.id, yeni.id);
  assert.equal(canli(ps, 'lines').length, 2);
});

test('K4 · kilitli direk yeniden numaralanamaz (hiçbiri değişmez); kilit kapatılınca ve yönetici oturumunda işlemler serbest', async () => {
  const { ps, poles, mat } = await kilitliOrtam();
  const nolar = poles.map((p) => ps.eqById(p.id).no);
  await assert.rejects(() => ps.renumber({ kinds: ['pole'], groups: ['bahh'], prefix: 'DK-', start: 11, digits: 3 }), kilitli, 'yeniden numaralama');
  assert.deepEqual(poles.map((p) => ps.eqById(p.id).no), nolar, 'numaralar değişmedi');
  // Yönetici oturumu: kilit yöneticiye uygulanmaz
  const adm = ps.approval().members.find((m) => m.role === 'yonetici');
  ps.login(adm.id, '9999');
  await ps.setMaterialRowQty(mat.id, 4);
  assert.equal(ps.data.materials.find((m) => m.id === mat.id).qty, 4);
  // Kilit kapatıldı (onay sürer): oturumsuz da değişir
  await ps.setApproval({ lock: false });
  ps.logout();
  assert.equal(ps.approval().lock, false);
  await ps.setMaterialRowQty(mat.id, 6);
  assert.equal(ps.data.materials.find((m) => m.id === mat.id).qty, 6);
  const p = ps.pointById(poles[0].pointId);
  await ps.movePoint(p.id, p.E + 1, p.N, 'deneme');
  assert.equal(ps.pointById(p.id).E, p.E + 1);
  await ps.removeEquipment(poles[0].id, 'deneme');
  assert.equal(canli(ps, 'equipment').some((x) => x.id === poles[0].id), false);
});

// ---------------- AutoCAD'de onaylı hakediş (eklentideki Hat Değiştir kilidi, hata 5) ----------------
test('K5 · AutoCAD\'de onaylı hakedişteki hat (kendi hakedişi ya da bir iletken satırı): iletken / tür / durum değişikliği reddedilir; düğüm, not ve hakediş durumu serbest; dosyadan alma takılmaz; onay yoksa serbest', async () => {
  const { hatDegistirmeKilidi, autocadKilitleri, sebekeIceAl, voltProjeOku } = await import('../src/interop/sebeke.js');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { setup } = await import('./helpers.mjs');
  const ORNEK = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures/ornek-proje.sebeke.json');
  // Örnek dosya: H1 (1. hakediş, AG 3A+P+R) ve H2 (2. hakediş, OG 3xSW); 2. hakediş AutoCAD'de onaylı
  const { proje } = voltProjeOku(fs.readFileSync(ORNEK, 'utf8'));
  proje.proje.onaylar = [{ no: 2, kontrol: true, hakedis: true, gis: false }];
  const { ps } = await setup();
  await sebekeIceAl(ps, proje);
  assert.deepEqual([...autocadKilitleri(ps.p)], [2]);
  const h1 = ps.data.lines.find((l) => l.sebekeId === 'H1'), h2 = ps.data.lines.find((l) => l.sebekeId === 'H2');
  assert.ok(h1 && h2, 'iki hat alındı');
  assert.equal(hatDegistirmeKilidi(h1, { state: 'DEMONTAJ' }, ps.p), null, '1. hakediş açık: serbest');
  assert.match(hatDegistirmeKilidi(h2, { state: 'DEMONTAJ' }, ps.p), /2\. hakediş AutoCAD'de onaylı/, '2. hakediş kilitli');
  assert.equal(hatDegistirmeKilidi(h2, { note: 'x', hak: 'TAMAMLANDI', nodes: h2.nodes.slice().reverse() }, ps.p), null, 'iletkeni değiştirmeyen alanlar serbest');
  assert.equal(hatDegistirmeKilidi(h2, { state: h2.state, circuits: JSON.parse(JSON.stringify(h2.circuits)) }, ps.p), null, 'aynı değerle kayıt serbest');
  // Servis: iletken / durum değişikliği reddedilir, veri değişmez; hat kaydı ekranının gönderdiği tam kayıt da (değişmeyen alanlarla)
  const once = JSON.stringify(h2);
  await assert.rejects(() => ps.updateLine(h2.id, { state: 'DEMONTAJ' }, 'deneme'), /2\. hakediş AutoCAD'de onaylı \(kilitli\)/);
  await assert.rejects(() => ps.updateLine(h2.id, Object.assign({}, h2, { circuits: [] }), 'deneme'), /onaylı \(kilitli\)/);
  await assert.rejects(() => ps.updateLine(h2.id, { lineType: 'AG' }, 'deneme'), /onaylı \(kilitli\)/);
  assert.equal(JSON.stringify(ps.lineById(h2.id)), once, 'hiçbir şey değişmedi');
  await ps.updateLine(h2.id, { note: 'saha notu' }, 'deneme');
  assert.equal(ps.lineById(h2.id).note, 'saha notu', 'not değişir');
  await ps.reverseLine(h2.id);
  assert.deepEqual(ps.lineById(h2.id).nodes, h2.nodes.slice().reverse(), 'düğüm sırası değişir');
  await ps.updateLine(h1.id, { state: 'DEMONTAJ' }, 'deneme');
  assert.equal(ps.lineById(h1.id).state, 'DEMONTAJ', 'açık hakedişteki hat değişir');
  // Satır kilidi: hattın kendisi açık hakedişte ama bir iletken satırı onaylı hakedişte (1. dönemi açık, 2. dönemi onaylı hat)
  const sb = JSON.parse(JSON.stringify(h1.sebeke));
  sb.kalemBilgisi.H1.push({ cins: 'AG_İLETKEN', tanim: 'P', kaynak: 'HAT', ana: false, sira: '', hakedis: 2, kontrol: null, miktar: 50 });
  await ps.ds.update('lines', h1.id, { sebeke: sb }, { reason: 'deneme', silent: true }); await ps.reload('lines');
  const k = hatDegistirmeKilidi(ps.lineById(h1.id), { circuits: [] }, ps.p);
  assert.match(k, /2\. hakediş AutoCAD'de onaylı \(kilitli\) · hattın bu hakedişteki iletken satırı \(P\)/, 'satır kilidi: ' + k);
  // Dosyadan yeniden alma kilide takılmaz (dosya esastır)
  const oz = await sebekeIceAl(ps, proje, { projectId: ps.p.id });
  assert.equal(oz.guncellenenHat, 2, 'iki hat dosyadan güncellendi');
  assert.equal(ps.lineById(h2.id).state, 'YENI', 'dosyadaki durum geri geldi');
  // Onay kalkınca serbest
  await ps.updateProject({ sebeke: Object.assign({}, ps.p.sebeke, { onaylar: [] }) }, 'deneme');
  assert.equal(hatDegistirmeKilidi(ps.lineById(h2.id), { state: 'DEMONTAJ' }, ps.p), null);
});
