// v2.4: otomatik reçete kapalı (varsayılan), elle malzeme, direkte armatür, yeni kanal hesabı (kaplama + yöntem),
// PB köşk tipleri, hücresiz köşk, proje silme, kayıtlı NTRIP profilleri, katalog güncelleme (24)
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, newProject, buildPoleLine, route, rtkObs, SEED } from './helpers.mjs';
import { importStandard, upgradeStandard, SEED_REV } from '../src/core/standards.js';
import { kanalModel, kanalLabel, KAPLAMA, YONTEM } from '../src/grid/lines.js';
import { koskGovdeleri } from '../src/grid/cabin-recipe.js';
import { luminairePoz } from '../src/services/survey-service.js';
import { loadProfiles, activeProfile, updateActive, selectProfile, addProfile, removeProfile } from '../src/gnss/ntrip-profiles.js';
import { varsayilanKabin, hucreEkle } from '../src/grid/cabin.js';

const START = { E: 512340.0, N: 4281200.0, H: 1052.0 };
const mats = (ps, id) => ps.result.matsByEq.get(id).items;
const tags = (ps, id) => mats(ps, id).map((m) => m.tag).sort();
const kapali = (ps) => newProject(ps, { autoRecipe: false });
const yakin = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

test('Y1 · Otomatik reçete varsayılan kapalı: objede yalnız seçilen kalemler gelir', async () => {
  const { ps } = await setup();
  const p = await ps.createProject({ name: 'Yeni proje', cm: 39 });
  assert.equal(p.autoRecipe, false, 'yeni projede otomatik reçete kapalı');
  await ps.open(p.id);
  const t = ps.cat.poleTypeByName('bahh', 'GN-12 (3 AWG)');
  const coords = route(START, [[60, 98], [60, 102]]);
  const poles = [];
  for (const c of coords) poles.push(await ps.addEquipment('pole', { group: 'bahh', typeId: t.id, state: 'YENI' }, { obs: rtkObs(c.E, c.N, c.H) }));
  const line = await ps.createLine({ lineType: 'OG', install: 'havai', circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }], nodes: poles.map((x) => x.pointId) });
  assert.deepEqual(tags(ps, poles[1].id), ['direk'], 'direkte yalnız direğin kendisi (travers, izolatör, topraklama yok)');
  assert.equal(mats(ps, poles[1].id)[0].servis, t.servis);
  // hat: yalnız iletken
  const li = ps.result.lineInfo.get(line.id);
  assert.ok(li.items.length >= 1 && li.items.every((x) => x.conductor && !x.material), 'hatta yalnız iletken boyu');
  // direk tipi trafo: trafo + trafo direği
  const td = ps.cat.poleTypeByName('trafo', 'G-T25');
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'direk', kva: 250, cins: 'herm', poleTypeId: td.id } }, { obs: rtkObs(START.E, START.N + 80, START.H) });
  assert.deepEqual(tags(ps, tr.id), ['direk', 'trafo'], 'pano, parafudr, topraklama gelmez');
  // SDK ve abone
  const sdk = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(START.E + 40, START.N + 80, START.H) });
  assert.deepEqual(tags(ps, sdk.id), ['sdk']);
  const ab = await ps.addEquipment('subscriber', { attrs: { phase: 'tek', kofre: true } }, { obs: rtkObs(START.E + 60, START.N + 80, START.H) });
  assert.deepEqual(tags(ps, ab.id), ['kofre']);
  // kontrol listesi: reçete boş hatası yok
  assert.ok(!ps.result.issues.some((i) => /reçetesi boş/.test(i.message)), 'boş reçete hata sayılmaz');
  // ayar açılınca yardımcı malzemeler geri gelir
  await ps.updateProject({ autoRecipe: true }, 'reçete aç');
  assert.ok(mats(ps, poles[1].id).length > 1 && tags(ps, poles[1].id).includes('izo'), 'açıkken izolatör vb. gelir');
  await ps.updateProject({ autoRecipe: false }, 'reçete kapat');
  assert.deepEqual(tags(ps, poles[1].id), ['direk']);
});

test('Y2 · Elle malzeme: ekipmana ve hatta eklenir, miktarı değişir, kaldırılır, metraja girer', async () => {
  const { ps } = await setup();
  await kapali(ps);
  const coords = route(START, [[60, 98]]);
  const { poles, line } = await buildPoleLine(ps, coords, { group: 'bahh', typeNames: 'GN-12 (3 AWG)', circuits: [{ role: 'OG', key: '3xSwallow' }] });
  const kazik = '030.02.01.01-001';
  const x = await ps.addMaterial('equipment', poles[0].id, kazik, 2);
  let m = mats(ps, poles[0].id).find((i) => i.materialId === x.id);
  assert.ok(m && m.qty === 2 && m.origin === 'MANUEL' && m.approved === true);
  assert.ok(!ps.result.issues.some((i) => /Onay bekleyen/.test(i.message)), 'elle eklenen onay beklemez');
  assert.equal(ps.result.quantities.find((q) => q.servis === kazik).qty, 2);
  await ps.setMaterialRowQty(x.id, 5);
  assert.equal(ps.result.quantities.find((q) => q.servis === kazik).qty, 5);
  // hatta
  const y = await ps.addMaterial('line', line.id, kazik, 3);
  const li = ps.result.lineInfo.get(line.id);
  assert.ok(li.items.some((i) => i.manual && i.materialId === y.id && i.qty === 3));
  const q = ps.result.quantities.find((r) => r.servis === kazik);
  assert.equal(q.qty, 8); assert.ok(q.refs.some((r) => r.type === 'line') && q.refs.some((r) => r.type === 'equipment'));
  await ps.removeMaterial(y.id, 'Kaldırıldı'); await ps.removeMaterial(x.id, 'Kaldırıldı');
  assert.equal(ps.result.quantities.find((r) => r.servis === kazik), undefined);
  await assert.rejects(() => ps.addMaterial('equipment', poles[0].id, 'YOK-KOD', 1), /katalogda yok/);
  await assert.rejects(() => ps.addMaterial('equipment', poles[0].id, kazik, 0), /sıfırdan büyük/);
});

test('Y3 · Direkte armatür: seçilen tip ve adet direğin malzemesi olarak gelir', async () => {
  const { ps } = await setup();
  await kapali(ps);
  const t = ps.cat.poleTypeByName('bahh', 'GN-12 (3 AWG)');
  const led = luminairePoz(ps.cat).find((p) => /LED/i.test(p.name));
  const e = await ps.addEquipment('pole', { group: 'bahh', typeId: t.id, attrs: { armatur: [{ servis: led.servis, qty: 2 }] } }, { obs: rtkObs(START.E, START.N, START.H) });
  const a = mats(ps, e.id).find((m) => m.tag === 'armatur');
  assert.ok(a && a.servis === led.servis && a.qty === 2);
  assert.equal(ps.result.quantities.find((q) => q.servis === led.servis).qty, 2);
  await ps.updateEquipment(e.id, { attrs: { armatur: [] } }, 'armatür kaldırıldı');
  assert.deepEqual(tags(ps, e.id), ['direk']);
});

test('Y4 · Kanal hesabı: kaplamaya göre kalem (m³), borulu geçişte boru, yatay sondajda yalnız sondaj boyu', async () => {
  const { ps } = await setup();
  await kapali(ps);
  const K = ps.cat.table('kanal');
  assert.ok(K && K.kazi.asfalt && K.sondaj, 'kanal eşleme tablosu');
  const a = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(START.E, START.N, START.H) });
  const b = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(START.E + 50, START.N, START.H) });
  const l = await ps.createLine({ lineType: 'AG', install: 'yeralti', circuits: [{ role: 'AG', key: 'NYY 3x50+25', count: 1 }], nodes: [a.pointId, b.pointId], cable: { surface: 'asfalt', method: 'acik', depth: 0.8, width: 0.4 } });
  let li = ps.result.lineInfo.get(l.id);
  const L = li.length2D;
  assert.ok(yakin(L, 50, 0.05), 'kanal boyu ≈ 50 m: ' + L);
  let kan = li.items.filter((x) => x.kanal);
  assert.equal(kan.length, 1); assert.equal(kan[0].servis, K.kazi.asfalt); assert.equal(kan[0].unit, 'm3');
  assert.ok(yakin(kan[0].qty, L * 0.4 * 0.8), 'hacim = boy × genişlik × derinlik');
  assert.ok(!li.items.some((x) => x.material), 'kum, bant, plaka, muf, başlık kendiliğinden gelmez');
  assert.ok(li.items.some((x) => x.conductor && !x.kanal && x.unit === 'm' && x.qty > L), 'kablo boyu (paylarıyla) gelir');
  assert.ok(yakin(li.cable.kanal.hacim, L * 0.32));
  assert.equal(ps.result.quantities.find((q) => q.servis === K.kazi.asfalt).unit, 'm3');
  // toprak ve tüvenan yeşil defter pozlarına gider
  for (const s of ['toprak', 'tuvenan']) {
    await ps.updateLine(l.id, { cable: { surface: s, method: 'acik', depth: 0.8, width: 0.4 } }, s);
    assert.equal(ps.result.lineInfo.get(l.id).items.find((x) => x.kanal).servis, K.kazi[s]);
    assert.ok(ps.cat.poz(K.kazi[s]).inGreenBook !== false);
  }
  // borulu geçiş: kanal + boru
  await ps.updateLine(l.id, { cable: { surface: 'asfalt', method: 'borulu', depth: 0.8, width: 0.4, pipeDia: 110, pipeCount: 2 } }, 'borulu');
  li = ps.result.lineInfo.get(l.id);
  assert.equal(li.items.filter((x) => x.kanal).length, 1);
  const boru = li.items.find((x) => x.material === 'BORU_110');
  assert.ok(boru && yakin(boru.qty, L * 2), 'boru = boy × adet');
  // yatay sondaj: yalnız sondaj boyu (m), hacim yok
  await ps.updateLine(l.id, { cable: { surface: 'asfalt', method: 'sondaj', depth: 0.8, width: 0.4, pipeCount: 0 } }, 'sondaj');
  li = ps.result.lineInfo.get(l.id);
  kan = li.items.filter((x) => x.kanal);
  assert.equal(kan.length, 1); assert.equal(kan[0].servis, K.sondaj); assert.equal(kan[0].unit, 'm'); assert.ok(yakin(kan[0].qty, L));
  assert.equal(li.cable.kanal.hacim, 0); assert.ok(!li.items.some((x) => x.material));
  // yalnız kanal / kazı (kablosuz)
  const k2 = await ps.createLine({ lineType: 'AG', install: 'yeralti', channelOnly: true, circuits: [], nodes: [a.pointId, b.pointId], cable: { surface: 'toprak', method: 'acik', depth: 1, width: 0.5 } });
  li = ps.result.lineInfo.get(k2.id);
  assert.equal(li.items.length, 1); assert.ok(yakin(li.items[0].qty, L * 0.5));
  // abone bağlantı kanalı: metre, kaplamalı / kaplamasız
  const ab = await ps.createLine({ lineType: 'ABONE', install: 'yeralti', abonePhase: 'tek', circuits: [{ role: 'ABONE', key: 'NYY 2x16', count: 1 }], nodes: [a.pointId, b.pointId], cable: { surface: 'parke', method: 'acik', depth: 0.6, width: 0.3 } });
  kan = ps.result.lineInfo.get(ab.id).items.filter((x) => x.kanal);
  assert.equal(kan[0].servis, K.abone.kaplamali); assert.equal(kan[0].unit, 'm'); assert.ok(yakin(kan[0].qty, L));
});

test('Y5 · Kanal modeli: eski kayıtlar okunur; otomatik reçete açıkken yardımcı malzeme yine gelir', async () => {
  assert.deepEqual(Object.keys(KAPLAMA), ['toprak', 'tuvenan', 'micir', 'asfalt', 'beton', 'parke']); // v2.6: mıcır (kanal zemini cinsi)
  assert.deepEqual(Object.keys(YONTEM), ['acik', 'borulu', 'sondaj']);
  assert.deepEqual([kanalModel({ channelType: 'borulu' }).surface, kanalModel({ channelType: 'borulu' }).method], ['toprak', 'borulu']);
  assert.equal(kanalModel({ channelType: 'beton' }).surface, 'beton');
  for (const t of ['direk', 'duvar']) { const k = kanalModel({ channelType: t }); assert.equal(k.method, 'acik'); assert.equal(k.yeni, false); assert.equal(k.eski, t); }
  assert.equal(kanalModel({ surface: 'asfalt', method: 'sondaj' }).yeni, true);
  assert.equal(kanalLabel({ surface: 'asfalt', method: 'borulu' }), 'Asfalt · Borulu geçiş');
  assert.equal(kanalLabel({}), 'Toprak');
  const { ps } = await setup();
  await newProject(ps);          // otomatik reçete AÇIK
  const a = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(START.E, START.N, START.H) });
  const b = await ps.addEquipment('sdk', { attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { obs: rtkObs(START.E + 50, START.N, START.H) });
  const l = await ps.createLine({ lineType: 'AG', install: 'yeralti', circuits: [{ role: 'AG', key: 'NYY 3x50+25', count: 1 }], nodes: [a.pointId, b.pointId], cable: { surface: 'tuvenan', method: 'acik', depth: 0.8, width: 0.4 } });
  const it = ps.result.lineInfo.get(l.id).items;
  assert.ok(it.some((x) => x.kanal) && it.some((x) => x.material === 'KUM') && it.some((x) => x.material === 'UYARI_BANDI') && it.some((x) => x.material === 'BASLIK_AG'));
  assert.ok(!it.some((x) => /^KANAL_/.test(x.material || '')), 'yeni kayıtta eski kanal anahtarı kullanılmaz');
  // kaldırılan seçenekle girilmiş eski kayıt (direk inişi): reçete kapalıyken kazı uydurulmaz; kaplama seçilince hesaplanır
  const e = await ps.createLine({ lineType: 'AG', install: 'yeralti', circuits: [{ role: 'AG', key: 'NYY 3x50+25', count: 1 }], nodes: [b.pointId, a.pointId], cable: { channelType: 'direk', depth: 0.8, width: 0.4 } });
  await ps.updateProject({ autoRecipe: false }, 'test');
  let ci = ps.result.lineInfo.get(e.id);
  assert.ok(!ci.items.some((x) => x.kanal), 'direk inişi kaydında kanal kalemi yok');
  assert.equal(ci.cable.kanal.hacim, 0); assert.equal(ci.cable.kanal.eski, 'direk');
  await ps.updateLine(e.id, { cable: { surface: 'toprak', method: 'acik', depth: 0.8, width: 0.4 } }, 'kaplama seçildi');
  ci = ps.result.lineInfo.get(e.id);
  assert.ok(yakin(ci.cable.kanal.hacim, 50 * 0.4 * 0.8) && ci.items.some((x) => x.kanal));
});

test('Y6 · Köşk: prefabrikte PB tipleri, hücre kendiliğinden gelmez, elle eklenen hücre keşfe gelir', async () => {
  const { ps } = await setup();
  await kapali(ps);
  const pb = koskGovdeleri(ps.cat, 'mbk');
  assert.deepEqual(pb.map((x) => x.kisa), ['PB-1', 'PB-2', 'PB-3', 'PB-4']);
  assert.deepEqual(koskGovdeleri(ps.cat, 'rbk').map((x) => x.kisa), ['PB-1', 'PB-2', 'PB-3', 'PB-4']);
  assert.deepEqual(koskGovdeleri(ps.cat, 'mono').map((x) => x.kisa), ['TİP-1A', 'TİP-1B', 'TİP-1C']);
  assert.deepEqual(koskGovdeleri(ps.cat, 'direk'), []);
  const pb3 = pb[2].servis;
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mbk', kva: 400, cins: 'herm', kioskServis: null, govde: pb3 } }, { obs: rtkObs(START.E, START.N, START.H) });
  let it = mats(ps, tr.id);
  assert.deepEqual(it.map((m) => m.tag).sort(), ['kosk', 'trafo'], 'köşk + trafo; hücre, pano, topraklama yok');
  assert.equal(it.find((m) => m.tag === 'kosk').servis, pb3);
  assert.ok(/400/.test(it.find((m) => m.tag === 'trafo').name));
  assert.ok(!it.some((m) => m.missing), 'eksik kalem yok');
  // RMU'lu köşk ve monoblok
  const rb = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'rbk', kva: 630, cins: 'herm', govde: pb[0].servis } }, { obs: rtkObs(START.E + 30, START.N, START.H) });
  assert.ok(!mats(ps, rb.id).some((m) => m.tag === 'hucre'));
  const mo = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mono', kva: 630, cins: 'herm' } }, { obs: rtkObs(START.E + 60, START.N, START.H) });
  assert.deepEqual(tags(ps, mo.id), ['kosk', 'trafo']);
  // kabin: hücresiz başlar; elle eklenen iki hücre ve kanal keşfe gelir, pano / topraklama gelmez
  let cab = Object.assign(varsayilanKabin('pref'), { hucreler: [], yalitim: 'hd' });
  await ps.updateEquipment(tr.id, { attrs: Object.assign({}, tr.attrs, { cabin: cab }) }, 'kabin');
  assert.ok(!mats(ps, tr.id).some((m) => m.tag === 'hucre'), 'hücresiz kabin');
  let r = hucreEkle(cab, 'HMH 36-01'); assert.ok(r.ok, r.hata); r = hucreEkle(r.cabin, 'HMH 36-04T'); assert.ok(r.ok, r.hata);
  cab = Object.assign({}, r.cabin, { kanallar: [{ ad: 'OG giriş', boy: 4000, gen: 600, der: 800 }] });
  await ps.updateEquipment(tr.id, { attrs: Object.assign({}, tr.attrs, { cabin: cab }) }, 'hücre eklendi');
  it = mats(ps, tr.id);
  assert.equal(it.filter((m) => m.tag === 'hucre').reduce((a, m) => a + m.qty, 0), 2);
  assert.ok(it.some((m) => m.tag === 'kosk' && m.servis === pb3) && it.some((m) => m.tag === 'kanal' && m.qty === 4));
  assert.ok(!it.some((m) => m.tag === 'pano' || m.tag === 'top'), 'pano ve topraklama kendiliğinden gelmez');
});

test('Y7 · Proje silme: yalnız o projenin kayıtları silinir; onay açıksa yalnız Yönetici', async () => {
  const { ps, ds } = await setup();
  const A = await ps.createProject({ name: 'A projesi', cm: 39 });
  await ps.open(A.id);
  const t = ps.cat.poleTypeByName('bahh', 'GN-12 (3 AWG)');
  const a1 = await ps.addEquipment('pole', { group: 'bahh', typeId: t.id }, { obs: rtkObs(START.E, START.N, START.H) });
  const a2 = await ps.addEquipment('pole', { group: 'bahh', typeId: t.id }, { obs: rtkObs(START.E + 60, START.N, START.H) });
  await ps.createLine({ lineType: 'OG', install: 'havai', circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }], nodes: [a1.pointId, a2.pointId] });
  await ps.addMaterial('equipment', a1.id, '030.02.01.01-001', 1);
  const B = await ps.createProject({ name: 'B projesi', cm: 39 });
  await ps.open(B.id);
  await ps.addEquipment('pole', { group: 'bahh', typeId: t.id }, { obs: rtkObs(START.E, START.N, START.H) });
  // açık olmayan projeyi sil
  const r = await ps.deleteProject(A.id);
  assert.equal(r.name, 'A projesi'); assert.ok(r.records >= 6, 'silinen kayıt: ' + r.records);
  assert.equal(await ds.get('projects', A.id), undefined);
  for (const st of ['points', 'equipment', 'lines', 'materials', 'outbox']) assert.equal((await ds.db.getAll(st)).filter((x) => x.projectId === A.id).length, 0, st);
  assert.equal((await ps.listProjects()).length, 1);
  assert.equal(ps.p.id, B.id); assert.equal(ps.data.equipment.length, 1, 'diğer proje etkilenmez');
  assert.ok((await ds.db.getAll('audit')).some((x) => /Proje silindi: A projesi/.test(x.reason || '')), 'silme denetim kaydına yazılır');
  // onay açık projede: oturumsuz ya da yetkisiz silinemez
  const adm = await ps.addMember({ name: 'Yön', role: 'yonetici', pin: '9999' });
  const saha = await ps.addMember({ name: 'Saha', role: 'saha', pin: '1111' });
  ps.logout();
  await assert.rejects(() => ps.deleteProject(B.id), /Yönetici/);
  ps.login(saha.id, '1111');
  await assert.rejects(() => ps.deleteProject(B.id), /Yönetici/);
  ps.login(adm.id, '9999');
  await ps.deleteProject(B.id);
  assert.equal(ps.p, null); assert.equal((await ps.listProjects()).length, 0);
  assert.equal(await ds.setting('lastProject'), null);
  await assert.rejects(() => ps.deleteProject('yok'), /bulunamadı/);
});

test('Y8 · Kayıtlı NTRIP profilleri: eski tek ayar taşınır, profil eklenir, seçilir, silinir', () => {
  let st = loadProfiles(null, { name: 'TUSAGA-Aktif', host: '212.156.70.42', port: 2101, mount: 'VRSRTCM31', user: 'u', pass: 'p', version: 1 });
  assert.equal(st.list.length, 1); assert.equal(activeProfile(st).host, '212.156.70.42'); assert.equal(activeProfile(st).version, 1);
  const ilk = st.active;
  st = addProfile(st, 'Sabit istasyon · Şantiye');
  assert.equal(st.list.length, 2); assert.equal(activeProfile(st).name, 'Sabit istasyon · Şantiye'); assert.equal(activeProfile(st).host, '');
  st = updateActive(st, { host: '10.0.0.5', mount: 'BASE1' });
  assert.equal(activeProfile(st).mount, 'BASE1');
  assert.equal(st.list.find((p) => p.id === ilk).host, '212.156.70.42', 'diğer profil değişmez');
  assert.throws(() => addProfile(st, 'sabit istasyon · şantiye'), /var/);
  assert.throws(() => addProfile(st, '  '), /gerekli/);
  st = selectProfile(st, ilk);
  assert.equal(activeProfile(st).name, 'TUSAGA-Aktif');
  assert.equal(selectProfile(st, 'yok').active, ilk);
  // kaydedilip yeniden yüklenir
  const st2 = loadProfiles(JSON.parse(JSON.stringify(st)), null);
  assert.equal(st2.list.length, 2); assert.equal(st2.active, ilk);
  st = removeProfile(st, ilk);
  assert.equal(st.list.length, 1); assert.equal(activeProfile(st).name, 'Sabit istasyon · Şantiye');
  assert.throws(() => removeProfile(st, st.active), /En az bir/);
  assert.equal(loadProfiles(null, null).list[0].name, 'TUSAGA-Aktif');
});

test('Y9 · Katalog güncelleme 23 → 24: kaplamalı kanal kalemleri ve kanal tablosu eklenir', async () => {
  const { ds, ps } = await setup({ skipSeed: true });
  const old = JSON.parse(JSON.stringify(SEED));
  old.poz = old.poz.filter((p) => !/^YEREL:KANAL-/.test(p.servis)); delete old.kanal; old.standard = Object.assign({}, old.standard, { seedRev: 23 });
  await importStandard(ds, old);
  assert.equal(SEED_REV, 25);
  const r = await upgradeStandard(ds, SEED);
  assert.ok(r.upgraded >= 4);
  await ps.open((await ps.createProject({ name: 'P', cm: 39 })).id);
  for (const k of ['YEREL:KANAL-ASFALT', 'YEREL:KANAL-BETON', 'YEREL:KANAL-PARKE']) { const p = ps.cat.poz(k); assert.ok(p && p.unit === 'm3' && p.verified === false, k); }
  assert.equal(ps.cat.table('kanal').sondaj, '032.12.06.01-003');
});

test('Y9b · Katalog güncelleme 24 → 25: katalog başlığından kurum ve kitap sürümü yazıları kalkar (ad, kod, kitap yenilenir)', async () => {
  const { ds } = await setup({ skipSeed: true });
  const old = JSON.parse(JSON.stringify(SEED));
  old.standard = Object.assign({}, old.standard, { seedRev: 24, code: 'XX 2026', name: 'XX 2026 · Defter 26.23.GR.02', book: '26.23.GR.02' });
  await importStandard(ds, old);
  await upgradeStandard(ds, SEED);
  const st = await ds.db.get('standards', SEED.standard.id);
  assert.equal(st.seedRev, 25);
  assert.equal(st.name, 'Poz kataloğu 2026'); assert.equal(st.code, '2026'); assert.equal(st.book, '2026');
  for (const v of [st.name, st.code, st.book, st.notes || '']) assert.ok(!/26\.23|TEDAŞ|VOLT/.test(v), v);
});

test('Y10 · Önceki sürümde oluşturulmuş proje: seçim yapılana kadar metraj değişmez, kapatılınca yardımcı kalemler çıkar', async () => {
  const { ps } = await setup();
  const p = await newProject(ps, { autoRecipe: true });
  const { poles } = await buildPoleLine(ps, route(START, [[60, 98], [60, 102]]), { group: 'bahh', typeNames: 'GN-12 (3 AWG)', circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const acik = mats(ps, poles[1].id).length;
  // v2.3 kaydı gibi: alan hiç yok
  const rec = await ps.ds.db.get('projects', p.id); delete rec.autoRecipe; await ps.ds.db.put('projects', rec);
  await ps.open(p.id);
  assert.equal(ps.p.autoRecipe, undefined);
  assert.equal(mats(ps, poles[1].id).length, acik, 'sorulmadan metraj değişmedi');
  await ps.updateProject({ autoRecipe: false }, 'test');
  assert.deepEqual(tags(ps, poles[1].id), ['direk'], 'kapatınca yalnız seçilen kalem kalır');
  await ps.updateProject({ autoRecipe: true }, 'test');
  assert.equal(mats(ps, poles[1].id).length, acik, 'yeniden açınca aynı reçete geri gelir');
});
