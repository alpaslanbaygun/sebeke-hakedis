// Kullanıcılar, roller ve hakediş yetkisi: telefon ↔ AutoCAD ortak kuralları (ortak/katalog/roller.json,
// ortak/deneme/kullanicilar.json — eklentinin CekirdekTest'i aynı dosyayı okur), proje dosyasında taşınma ve
// yazmaya kapalı hakediş kilidi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, newProject, buildPoleLine, rtkObs, route, tick } from './helpers.mjs';
import { ROLES, ROLE_ORDER, pinHash, validPin, checkPin, actionRoles, canDo } from '../src/core/roles.js';
import { sebekeModel, sebekeIceAl, SH } from '../src/interop/sebeke.js';
import { aktifHakedis, objeHakedisi } from '../src/core/hakedis-no.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ORTAK = JSON.parse(fs.readFileSync(path.join(KOK, 'ortak/deneme/kullanicilar.json'), 'utf8'));
const ROLLER = JSON.parse(fs.readFileSync(path.join(KOK, 'ortak/katalog/roller.json'), 'utf8'));
const ROUTE = route({ E: 519300, N: 4282100, H: 1050 }, [[60, 80, 2], [60, 80, 1]]);
const TYPES = ['GD-10 (3 AWG)', 'GT-10 (3 AWG)', 'GN-10 (3 AWG)'];
const OG = [{ role: 'OG', key: '3xSwallow', count: 1 }];

test('R1 · ortak deneme: şifre özeti, geçersiz şifreler, kullanıcı ve onay ayarı birleştirme (eklentiyle aynı sonuç)', () => {
  for (const x of ORTAK.sifreler) assert.equal(pinHash(x.sifre, x.tuz), x.ozet, 'özet: ' + x.tuz);
  for (const x of ORTAK.sifreler) assert.ok(validPin(x.sifre), 'geçerli: ' + x.sifre);
  for (const x of ORTAK.gecersizSifreler) assert.equal(validPin(x), false, 'geçersiz: "' + x + '"');
  assert.ok(checkPin({ salt: 'T1', pinHash: ORTAK.sifreler[0].ozet }, '1234'));
  assert.equal(checkPin({ salt: 'T1', pinHash: ORTAK.sifreler[0].ozet }, '1235'), false);
  for (const c of ORTAK.birlestirme) {
    assert.deepEqual(SH.kullanicilariBirlestir(c.yerel, c.gelen), c.beklenen, c.ad);
    assert.equal(SH.onayAcik(c.beklenen), c.onayAcik, c.ad + ' · onay açık mı');
  }
  for (const c of ORTAK.onayAyari) assert.deepEqual(SH.onayAyariBirlestir(c.yerel, c.gelen), c.beklenen, c.ad);
});

test('R2 · roller ve işlem yetkileri ortak tablodan: telefonun rolleri, AutoCAD onay aşamaları, hakediş yetkisi', () => {
  assert.deepEqual(ROLE_ORDER, ROLLER.roller.map((r) => r.id));
  assert.deepEqual(ROLE_ORDER, ['saha', 'kontrol', 'hakedis', 'onay', 'yonetici'], 'telefonun durum kuralları bu rollerle yazıldı');
  for (const r of ROLLER.roller) assert.equal(ROLES[r.id].label, r.ad);
  assert.deepEqual(actionRoles('autocad.kontrol'), ['kontrol', 'yonetici']);
  assert.deepEqual(actionRoles('autocad.hakedis'), ['onay', 'yonetici']);
  assert.deepEqual(actionRoles('hakedis.yetkisi'), ['yonetici']);
  assert.deepEqual(actionRoles('tanımsız'), ['yonetici'], 'tanımsız işlem yalnız Yönetici');
  const p = { members: [{ id: 'a', role: 'yonetici', active: true }] };
  assert.equal(canDo(p, { role: 'kontrol' }, 'hakedis.yetkisi').ok, false);
  assert.equal(canDo(p, { role: 'yonetici' }, 'hakedis.yetkisi').ok, true);
  assert.equal(canDo({ members: [] }, null, 'hakedis.yetkisi').ok, true, 'onay kapalıyken kısıt yok');
});

test('R3 · kullanıcılar ve hakediş yetkisi AutoCAD dosyasıyla taşınır: başka telefonda aynı şifreyle oturum, yeni olan kazanır', async () => {
  const A = await setup({ deviceId: 'tel-A' });
  await newProject(A.ps, { autoRecipe: false });
  await buildPoleLine(A.ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: OG });
  const yon = await A.ps.addMember({ name: 'Deneme Yönetici', role: 'yonetici', pin: '1234' });
  const kon = await A.ps.addMember({ name: 'Deneme Kontrol', role: 'kontrol', pin: '5678' });
  await A.ps.setClosedHakedis([3, 1]);
  const sp = sebekeModel(A.ps);
  assert.equal(sp.proje.kullanicilar.length, 2);
  const kk = sp.proje.kullanicilar.find((k) => k.id === kon.id);
  assert.deepEqual(Object.keys(kk), ['id', 'ad', 'rol', 'tuz', 'ozet', 'etkin', 'guncelleme']);
  assert.equal(kk.rol, 'kontrol'); assert.equal(kk.ad, 'Deneme Kontrol'); assert.ok(kk.guncelleme);
  assert.ok(!JSON.stringify(sp).includes('5678'), 'şifre düz yazıyla dosyaya girmez');
  assert.deepEqual(sp.proje.onayAyari.kapaliHakedisler, [1, 3]);
  // Dosya yazılıp okununca alan sırası eklentiyle aynı: onaylar, kullanicilar, onayAyari boyutlardan sonra
  const metin = SH.projeYaz(SH.projeOku(JSON.parse(JSON.stringify(sp))));
  const anahtar = Object.keys(JSON.parse(metin).proje);
  assert.ok(anahtar.indexOf('kullanicilar') > anahtar.indexOf('katmanOnEki') && anahtar.indexOf('onayAyari') === anahtar.indexOf('kullanicilar') + 1, anahtar.join(','));
  // Başka telefon: yeni proje olarak alır → onay açık, aynı şifreyle oturum açılır, kapalı hakedişler gelir
  const B = await setup({ deviceId: 'tel-B' });
  const oz = await sebekeIceAl(B.ps, JSON.parse(metin));
  assert.equal(oz.kullanici, 2);
  assert.equal(B.ps.approval().on, true);
  assert.deepEqual(B.ps.approval().closed, [1, 3]);
  assert.throws(() => B.ps.login(kon.id, '0000'), /yanlış/);
  assert.equal(B.ps.login(kon.id, '5678').name, 'Deneme Kontrol');
  B.ps.logout();
  // B'de yönetici kontrol kullanıcısının rolünü değiştirir (daha yeni); A'nın eski dosyası bunu ezmez
  B.ps.login(yon.id, '1234');
  tick(60000); // bir dakika sonra
  await B.ps.updateMember(kon.id, { role: 'onay' });
  await sebekeIceAl(B.ps, JSON.parse(metin), { projectId: B.ps.p.id });
  assert.equal(B.ps.p.members.find((m) => m.id === kon.id).role, 'onay', 'eski dosya yeni değişikliği ezmez');
  // A, B'nin dosyasını alınca rol değişikliği A'ya da gelir
  const spB = sebekeModel(B.ps);
  await sebekeIceAl(A.ps, spB, { projectId: A.ps.p.id });
  assert.equal(A.ps.p.members.find((m) => m.id === kon.id).role, 'onay');
});

test('R4 · yazmaya kapalı hakediş: obje değiştirilemez, yeni obje eklenemez; Yönetici ve AutoCAD\'den gelen obje hariç; açılınca serbest', async () => {
  const { ps } = await setup();
  await newProject(ps, { autoRecipe: false });
  const { poles, line } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: OG });
  const mat = await ps.addMaterial('equipment', poles[0].id, '011.06.04.01-001', 1, 'deneme');
  const yon = await ps.addMember({ name: 'Deneme Yönetici', role: 'yonetici', pin: '1234' });
  const saha = await ps.addMember({ name: 'Deneme Saha', role: 'saha', pin: '1111' });
  assert.equal(aktifHakedis(ps.data.periods), 1);
  assert.equal(objeHakedisi(ps.eqById(poles[0].id), ps.data.periods), 1);
  // Yalnız Yönetici belirler
  ps.logout(); ps.login(saha.id, '1111');
  await assert.rejects(() => ps.setClosedHakedis([1]), /Yönetici/);
  ps.logout(); ps.login(yon.id, '1234');
  await ps.setClosedHakedis([1]);
  assert.deepEqual(ps.approval().closed, [1]);
  // Saha kullanıcısı: 1. hakediş kapalı → değişiklik ve yeni obje reddedilir
  ps.logout(); ps.login(saha.id, '1111');
  await assert.rejects(() => ps.setMaterialRowQty(mat.id, 5), /yazmaya kapalı/);
  await assert.rejects(() => ps.updateEquipment(poles[1].id, { typeId: ps.cat.poleTypeByName('bahh', 'GN-10 (3 AWG)').id }, 'deneme'), /yazmaya kapalı/);
  await assert.rejects(() => ps.removeLine(line.id, 'deneme'), /yazmaya kapalı/);
  const nEq = ps.data.equipment.length, nPt = ps.data.points.length;
  await assert.rejects(() => ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-10 (3 AWG)').id, state: 'YENI' }, { obs: rtkObs(519600, 4282400, 1049) }), /yeni obje eklenemez/);
  assert.equal(ps.data.equipment.length, nEq); assert.equal(ps.data.points.length, nPt, 'reddedilince nokta da açılmaz');
  await assert.rejects(() => ps.createLine({ lineType: 'OG', install: 'havai', circuits: OG, nodes: [poles[0].pointId, poles[2].pointId], state: 'YENI' }), /yeni obje eklenemez/);
  // İş kalemi olmayan mevcut obje ve AutoCAD'den gelen obje kapalı hakedişe takılmaz
  const mevcut = await ps.addEquipment('pole', { group: 'beton', typeId: ps.cat.poleTypeByName('beton', '9.3/8').id, state: 'MEVCUT' }, { obs: rtkObs(519650, 4282450, 1049) });
  assert.ok(mevcut.id);
  const cad = await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-10 (3 AWG)').id, state: 'YENI', sebekeId: 'E99', sebeke: { id: 'E99', hakedis: 2 } }, { obs: rtkObs(519700, 4282500, 1049) });
  assert.ok(cad.id, 'AutoCAD kimlikli obje (dosyadan) eklenir');
  await ps.updateEquipment(cad.id, { note: 'serbest' }, 'not');
  // 2. hakedişteki (AutoCAD numaralı) obje açık: değiştirilebilir
  await ps.updateEquipment(cad.id, { typeId: ps.cat.poleTypeByName('bahh', 'GN-10 (3 AWG)').id }, 'deneme');
  // Yönetici kapalı hakedişte de değiştirebilir
  ps.logout(); ps.login(yon.id, '1234');
  await ps.setMaterialRowQty(mat.id, 2);
  assert.equal(ps.data.materials.find((m) => m.id === mat.id).qty, 2);
  // Açılınca saha kullanıcısı da değiştirebilir
  await ps.setClosedHakedis([]);
  ps.logout(); ps.login(saha.id, '1111');
  await ps.setMaterialRowQty(mat.id, 3);
  assert.equal(ps.data.materials.find((m) => m.id === mat.id).qty, 3);
  await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-10 (3 AWG)').id, state: 'YENI' }, { obs: rtkObs(519750, 4282550, 1049) });
});

test('R5 · onay mekanizması kapalıyken (kullanıcı yok) hakediş yetkisi uygulanmaz ve ayarlanamaz', async () => {
  const { ps } = await setup();
  await newProject(ps, { autoRecipe: false });
  const { poles } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: OG });
  await assert.rejects(() => ps.setClosedHakedis([1]), /onay mekanizmasını açın/);
  // Eski projede kalmış kapalı liste (kullanıcılar kapatılmış): kilit yok
  await ps.ds.update('projects', ps.p.id, { approval: { closed: [1] } }, { reason: 'deneme' });
  ps.p = await ps.ds.get('projects', ps.p.id);
  assert.equal(ps.editLock(ps.eqById(poles[0].id)), null);
  await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-10 (3 AWG)').id, state: 'YENI' }, { obs: rtkObs(519600, 4282400, 1049) });
});
