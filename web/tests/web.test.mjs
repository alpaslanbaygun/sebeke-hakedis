// Web (ofis) sürümü: bulut kaydı adaptörü, telefon ↔ web veri alışverişi, indirme sarmalayıcı
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, newProject, buildPoleLine, route, rtkObs, tick, SEED } from './helpers.mjs';
import { FakeCloud } from './fake-cloud.mjs';
import { CloudAdapter, bucketOf, BUCKET_LIMIT, RETRY } from '../src/web/cloud-adapter.js';
RETRY.waits = [5, 5, 5];
import { wrapForDownload } from '../src/web/platform.js';
import { importStandard } from '../src/core/standards.js';
import { exportChangeset, applyChangeset, markSynced, listConflicts } from '../src/core/sync.js';
import { unzip } from '../src/export/zip.js';
import { ulid } from '../src/core/ids.js';

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
// Bulut üstünde tam uygulama yığını (standart paketi her açılışta dosyadan gelir, buluta yazılmaz)
async function webStack(cloud, opts = {}) {
  const adapter = await new CloudAdapter(cloud, { delay: 5, tab: opts.tab }).open();
  const S = await setup({ adapter, skipSeed: true, deviceId: 'WEB-1', user: 'Ofis' });
  await adapter.seed(() => importStandard(S.ds, SEED));
  return Object.assign(S, { adapter });
}
const START = { E: 512340.0, N: 4281200.0, H: 1052.0 };

test('W1 · Bulut kaydı: proje, direkler, hat buluta yazılır; başka bilgisayarda aynı veri açılır', async () => {
  const cloud = new FakeCloud();
  const A = await webStack(cloud);
  const p = await newProject(A.ps);
  const coords = route(START, [[60, 98], [60, 102], [62, 95], [88, 110]]);
  const { poles, line } = await buildPoleLine(A.ps, coords, { group: 'bahh', typeNames: ['GN-12 (3 AWG)', 'GT-12 (3 AWG)', 'GT-12 (3 AWG)', 'GZ-12 (3 AWG)', 'GN-12 (3 AWG)'], circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await A.adapter.flush();
  assert.equal(A.adapter.status.state, 'saved');
  assert.ok(cloud.docs.has('m/manifest'), 'manifest yazıldı');
  // Standart paketi (≈1,3 MB) buluta gitmez: yalnız proje verisi
  assert.ok(cloud.size() < 400 * 1024, 'bulut boyutu küçük: ' + cloud.size());
  assert.ok(![...cloud.docs.keys()].some((k) => k.startsWith('b/poz~')), 'poz kataloğu buluta yazılmadı');
  assert.ok(![...cloud.docs.keys()].some((k) => /^b\/(spans|quantities)~/.test(k)), 'türetilmiş tablolar (açıklık, metraj) buluta yazılmadı');
  for (const [k, d] of cloud.docs) assert.ok(JSON.stringify(d).length < 256 * 1024, k);

  // İkinci bilgisayar: aynı bulut, boş bellek
  const B = await webStack(cloud);
  const list = await B.ps.listProjects();
  assert.equal(list.length, 1);
  await B.ps.open(p.id);
  assert.equal(B.ps.data.equipment.length, poles.length);
  assert.equal(B.ps.data.lines.length, 1);
  assert.equal(B.ps.data.points.length, A.ps.data.points.length);
  assert.equal(B.ps.result.spans.length, A.ps.result.spans.length);
  assert.equal(B.ps.result.signature, A.ps.result.signature, 'hesap sonucu aynı');
  assert.deepEqual(B.ps.result.quantities.map((q) => [q.servis, q.qty]), A.ps.result.quantities.map((q) => [q.servis, q.qty]));
  assert.equal(B.ds.deviceId, 'WEB-1');
  assert.equal((await B.ds.db.get('lines', line.id)).lineNo, line.lineNo);
  // Açılış veriyi değiştirmediyse buluta yeniden yazma olmaz (yalnız "son proje" ayarı aynı kalır)
  const w0 = cloud.writes; await B.adapter.flush(); await wait();
  assert.equal(cloud.writes, w0, 'açılışta gereksiz bulut yazması yok');
});

test('W2 · Büyük veri: kova 256 KiB sınırını aşmadan bölünür; yeniden açılışta kayıt kaybı olmaz', async () => {
  const cloud = new FakeCloud();
  const a = await new CloudAdapter(cloud, { delay: 5 }).open();
  await a.seed(async () => {});
  const N = 3000; const recs = [];
  for (let i = 0; i < N; i++) recs.push({ id: 'P' + String(i).padStart(5, '0'), projectId: 'X', pointNo: 'N-' + i, E: 512000 + i * 1.234, N: 4281000 + i * 2.345, H: 1050.123, note: 'Kurtdere köyü çıkışı · şarampol kenarı · ölçüm ' + i, quality: { fix: 'FIX', sigmaH: 0.009, sigmaV: 0.014, pdop: 1.3, sats: 26 } });
  await a.bulkPut('points', recs);
  await a.flush();
  assert.equal(a.status.state, 'saved');
  assert.ok(a.levels.points >= 2, 'tablo düzeyi arttı: ' + a.levels.points);
  const docs = [...cloud.docs.entries()].filter(([k]) => k.startsWith('b/points~'));
  assert.ok(docs.length >= 4, docs.length + ' kova');
  for (const [k, d] of docs) assert.ok(new TextEncoder().encode(JSON.stringify(d)).length <= 256 * 1024, k);
  const man = cloud.docs.get('m/manifest');
  assert.equal(Object.entries(man.b).filter(([k, v]) => k.startsWith('points~') && v > 0).length, docs.length, 'manifest ile belgeler uyumlu');
  // Tek kayıt değişince yalnız bir kova yazılır
  const w0 = cloud.log.length;
  await a.put('points', Object.assign({}, recs[1234], { H: 1051 }));
  await a.flush();
  const wr = cloud.log.slice(w0).filter((x) => x[0] === 'set');
  assert.equal(wr.length, 1, 'tek kova yazıldı');
  const b = await new CloudAdapter(cloud).open();
  assert.equal(await b.count('points'), N);
  assert.equal((await b.get('points', 'P01234')).H, 1051);
  // Silme de kalıcı
  await a.bulkDelete('points', recs.slice(0, 2990).map((r) => r.id));
  await a.flush();
  const c = await new CloudAdapter(cloud).open();
  assert.equal(await c.count('points'), 10);
});

test('W3 · Zaman sıralı tablolar (denetim, senkron kuyruğu) pencerelere ayrılır; eski pencereler yeniden yazılmaz', async () => {
  const cloud = new FakeCloud();
  const a = await new CloudAdapter(cloud, { delay: 5 }).open();
  await a.seed(async () => {});
  const t0 = Date.parse('2026-09-01T08:00:00Z');
  const id1 = ulid(t0), id2 = ulid(t0 + 40 * 86400e3);
  assert.notEqual(bucketOf('audit', id1, 0), bucketOf('audit', id2, 0), '40 gün arayla farklı pencere');
  assert.equal(bucketOf('audit', id1, 0), bucketOf('audit', ulid(t0 + 3600e3), 0), 'aynı gün aynı pencere');
  await a.put('audit', { id: id1, projectId: 'X', action: 'create' });
  await a.flush();
  const w0 = cloud.log.length;
  await a.put('audit', { id: id2, projectId: 'X', action: 'update' });
  await a.flush();
  const sets = cloud.log.slice(w0).filter((x) => x[0] === 'set').map((x) => x[1]);
  assert.deepEqual(sets, ['b/audit~' + bucketOf('audit', id2, 0)]);
  const b = await new CloudAdapter(cloud).open();
  assert.equal(await b.count('audit'), 2);
});

test('W4 · İki bilgisayar açıkken: birinde yapılan değişiklik diğerine gelir; yankı (sonsuz yazma) olmaz', async () => {
  const cloud = new FakeCloud();
  const A = await webStack(cloud, { tab: 'A' });
  const p = await newProject(A.ps);
  await A.adapter.flush();
  const B = await webStack(cloud, { tab: 'B' });
  await B.ps.open(p.id);
  let got = null; B.adapter.onRemote = (stores) => { got = stores; };
  const e = await A.ps.addEquipment('pole', { group: 'bahh', typeId: A.ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id, state: 'YENI' }, { obs: rtkObs(START.E, START.N, START.H) });
  await A.adapter.flush(); await wait(40);
  assert.ok(got && got.includes('equipment') && got.includes('points'), 'uzak değişiklik bildirildi: ' + got);
  assert.equal((await B.ds.db.get('equipment', e.id)).no, e.no);
  await B.ps.load(); assert.equal(B.ps.data.equipment.length, 1);
  const w0 = cloud.writes; await wait(60);
  assert.equal(cloud.writes, w0, 'yankı yok');
});

test('W5 · Telefon ↔ web: telefondaki proje dosyayla web\'e alınır, web\'deki düzeltme telefona çakışmasız döner', async () => {
  // Telefon (APK): yerel veritabanı
  const T = await setup({ deviceId: 'DEV-TEL', user: 'Saha' });
  const p = await newProject(T.ps);
  const coords = route(START, [[60, 98], [60, 102], [62, 95]]);
  const { poles } = await buildPoleLine(T.ps, coords, { group: 'bahh', typeNames: ['GN-12 (3 AWG)', 'GT-12 (3 AWG)', 'GT-12 (3 AWG)', 'GN-12 (3 AWG)'], circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const cs1 = await exportChangeset(T.ds, p.id);
  await markSynced(T.ds, cs1.outboxIds);
  // Web: dosyayı al → buluta yazılır
  const cloud = new FakeCloud();
  const W = await webStack(cloud);
  const r1 = await applyChangeset(W.ds, JSON.parse(JSON.stringify(cs1)));
  assert.equal(r1.conflicts.length, 0);
  await W.ps.open(p.id);
  assert.equal(W.ps.data.equipment.length, 4);
  assert.equal(W.ps.result.signature, T.ps.result.signature, 'web hesabı telefonla aynı');
  await W.adapter.flush();
  // Web'de hakediş durumu ve tip düzeltmesi
  tick(60000);
  await W.ps.setHak('equipment', poles[1].id, 'KONTROL');
  const cs2 = await exportChangeset(W.ds, p.id);
  assert.ok(cs2.changes.length >= 1 && cs2.changes.every((c) => c.deviceId === 'WEB-1'), 'yalnız web değişiklikleri: ' + cs2.changes.length);
  await markSynced(W.ds, cs2.outboxIds);
  await W.adapter.put('outbox', await W.ds.db.get('outbox', cs2.outboxIds[0]));   // kova yeniden yazılsın
  // Telefon: web dosyasını al
  const r2 = await applyChangeset(T.ds, JSON.parse(JSON.stringify(cs2)));
  assert.equal(r2.conflicts.length, 0, 'çakışma yok');
  await T.ps.open(p.id);
  assert.equal(T.ps.eqById(poles[1].id).hak, 'KONTROL');
  // Web yeniden açılınca (başka bilgisayar) her şey yerinde
  await W.adapter.flush();
  const W2 = await webStack(cloud);
  await W2.ps.open(p.id);
  assert.equal(W2.ps.eqById(poles[1].id).hak, 'KONTROL');
  assert.equal((await listConflicts(W2.ds)).length, 0);
  assert.equal((await exportChangeset(W2.ds, p.id)).changes.length, 0, 'gönderilenler yeniden gönderilmez');
});

test('W6 · Salt okunur ve geçici hata: yazılamazsa durum bildirilir, veri kuyruğunda kalır, sonra yazılır', async () => {
  const cloud = new FakeCloud();
  const a = await new CloudAdapter(cloud, { delay: 5 }).open();
  await a.seed(async () => {});
  await a.put('settings', { id: 'x', value: 1 }); await a.flush();
  cloud.failNext = 1;
  await a.put('settings', { id: 'x', value: 2 });
  await assert.rejects(a.flush());                       // hız sınırı: yazma yukarı taşınır, kuyruk korunur
  assert.equal(a.status.state, 'error');
  assert.ok(a.dirty.size, 'değişiklik kuyruğa geri kondu');
  await a.flush();
  assert.equal(a.status.state, 'saved');
  assert.equal((await (await new CloudAdapter(cloud).open()).get('settings', 'x')).value, 2);
  cloud.readonly = true;
  await a.put('settings', { id: 'x', value: 3 });
  await assert.rejects(a.flush());
  assert.equal(a.status.state, 'readonly');
  clearTimeout(a.timer);
});

test('W7 · Revizyon anlık görüntüsü (büyük metin) buluta parça parça yazılır ve başka bilgisayarda okunur', async () => {
  const cloud = new FakeCloud();
  const a = await new CloudAdapter(cloud, { delay: 5 }).open();
  await a.seed(async () => {});
  const text = JSON.stringify({ data: Array.from({ length: 9000 }, (_, i) => ({ i, ad: 'Çıkış direği şğüöı ' + i })) });
  assert.ok(text.length > 300000);
  await a.put('blobs', { id: 'B1', projectId: 'X', mime: 'application/json', text });
  const b = await new CloudAdapter(cloud).open();
  const got = await b.get('blobs', 'B1');
  assert.equal(got.text, text);
  assert.equal(got.mime, 'application/json');
  assert.equal(await b.get('blobs', 'YOK'), undefined);
});

test('W8 · İndirme: izinli uzantı olduğu gibi, diğerleri zip içinde, .vsync → .json', async () => {
  const u8 = new TextEncoder().encode('0\nSECTION\n');
  const a = await wrapForDownload('ELZ.dxf', u8);
  assert.equal(a.name, 'ELZ.dxf.zip');
  const files = await unzip(a.data);
  const names = files.map ? files.map((f) => f.name) : Object.keys(files);
  assert.deepEqual(names, ['ELZ.dxf']);
  assert.equal((await wrapForDownload('ELZ_metraj.xlsx', u8)).name, 'ELZ_metraj.xlsx');
  assert.equal((await wrapForDownload('ELZ_rapor.html', u8)).name, 'ELZ_rapor.html');
  assert.equal((await wrapForDownload('ELZ_web_202610041200.vsync', u8)).name, 'ELZ_web_202610041200.vsync.json');
  assert.equal((await wrapForDownload('ELZ.kmz', u8)).name, 'ELZ.kmz.zip');
});

test('W9 · Açılışta geçici okuma hatası yeniden denenir; bulut hiç okunamazsa hata verilir (yerel kopyaya sessizce geçilmez)', async () => {
  const cloud = new FakeCloud();
  const a = await new CloudAdapter(cloud, { delay: 5 }).open();
  await a.seed(async () => {});
  await a.put('settings', { id: 'x', value: 7 }); await a.flush();
  let n = 0; const flaky = { doc: (p) => { const d = cloud.doc(p); const get = d.get; d.get = async () => { if (n++ < 2) throw Object.assign(new Error('meşgul'), { code: 'resource_exhausted' }); return get(); }; return d; } };
  const b = await new CloudAdapter(flaky).open();
  assert.equal((await b.get('settings', 'x')).value, 7);
  const dead = { doc: () => ({ get: async () => { throw Object.assign(new Error('yok'), { code: 'unavailable' }); }, onSnapshot: () => () => {} }) };
  await assert.rejects(new CloudAdapter(dead).open());
});

test('W10 · Çizim (CAD) web bulutunda: büyük çizim parçalara bölünür, başka bilgisayarda aynı çizim açılır', async () => {
  const { importCad, cadDocs, cadModel, clearCadCache } = await import('../src/services/cad-service.js');
  const cloud = new FakeCloud();
  const A = await webStack(cloud);
  await newProject(A.ps);
  const out = ['0', 'SECTION', '2', 'ENTITIES'];
  for (let i = 0; i < 6000; i++) out.push('0', 'LINE', '8', i % 2 ? 'OG_HAT' : 'AG_ŞEBEKE', '10', String(512000 + i * 1.2345), '20', String(4281000 + (i % 50) * 3.21), '11', String(512001 + i * 1.2345), '21', String(4281003 + (i % 50) * 3.21));
  out.push('0', 'ENDSEC', '0', 'EOF', '');
  const r = await importCad(A.ps, new TextEncoder().encode(out.join('\n')), 'buyuk.dxf');
  assert.equal(r.doc.entCount, 6000);
  await A.adapter.flush();
  const parts = [...cloud.docs.keys()].filter((k) => k.startsWith('x/' + r.doc.blobId + '~'));
  assert.ok(parts.length >= 2, 'parça sayısı: ' + parts.length);
  for (const k of parts) assert.ok(JSON.stringify(cloud.docs.get(k)).length < 250 * 1024, k + ' belge sınırının altında');
  clearCadCache();
  const B = await webStack(cloud);
  await B.ps.open(A.ps.p.id);
  const d = cadDocs(B.ps);
  assert.equal(d.length, 1);
  const m = await cadModel(B.ps, d[0]);
  assert.equal(m.ents.length, 6000);
  assert.ok(m.layers.some((l) => l.name === 'AG_ŞEBEKE'), 'Türkçe katman adı korunur');
});
