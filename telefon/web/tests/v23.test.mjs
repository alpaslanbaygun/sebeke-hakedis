// v2.3: Spectra cümleleri, Yandex karo matematiği, katalog güncelleme, kabin keşfi, kofre, enerji kontrolü,
// otomatik numara, çizim katmanı, hakediş onay rolleri
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { setup, newProject, buildPoleLine, route, rtkObs, SEED } from './helpers.mjs';
import { parseSentence, spectraSetup } from '../src/gnss/nmea.js';
import { tileX, tileY, tileYf, tileLL } from '../src/geo/tiles.js';
import { importStandard, upgradeStandard, SEED_REV } from '../src/core/standards.js';
import { luminairePoz } from '../src/services/survey-service.js';
import { energize } from '../src/grid/energize.js';
import { importCad, visibleCad, snapCad, cadArms, removeCad, cadDocs } from '../src/services/cad-service.js';
import { hesapG, gorevOner } from '../src/calc/tepe.js';
import { ROLES, canHak, approvalOn, strictOn, sha256, pinHash, validPin, countsAsDone } from '../src/core/roles.js';
import { varsayilanKabin, kanalEkle } from '../src/grid/cabin.js';

const START = { E: 512340.0, N: 4281200.0, H: 1052.0 };
const nmea = (body) => { let c = 0; for (const ch of body) c ^= ch.charCodeAt(0); return '$' + body + '*' + c.toString(16).toUpperCase().padStart(2, '0'); };
const mats = (ps, id) => ps.result.matsByEq.get(id).items;

test('V1 · Spectra: $PASHR,POS ve $PTNL,GGK konum cümleleri okunur, kurulum komutları doğru', () => {
  const pos = parseSentence(nmea('PASHR,POS,3,14,093019.00,3843.12345,N,03912.54321,E,1052.337,1.0,123.4,0.02,0.01,1.4,0.8,1.1,0.9,SP60'));
  assert.equal(pos.type, 'PASHR_POS'); assert.equal(pos.fix, 'FIX'); assert.equal(pos.sats, 14);
  assert.ok(Math.abs(pos.lat - (38 + 43.12345 / 60)) < 1e-9 && Math.abs(pos.lon - (39 + 12.54321 / 60)) < 1e-9);
  assert.equal(pos.hEll, 1052.337); assert.equal(pos.pdop, 1.4);
  const flo = parseSentence(nmea('PASHR,POS,2,11,093020.00,3843.12345,N,03912.54321,E,1052.3,2.0,0,0,0,2.1,1.2,1.7,0.9,SP80'));
  assert.equal(flo.fix, 'FLOAT');
  const ggk = parseSentence(nmea('PTNL,GGK,093019.00,092026,3843.12345,N,03912.54321,E,3,12,1.6,EHT1052.337,M'));
  assert.equal(ggk.type, 'PTNL_GGK'); assert.equal(ggk.fix, 'FIX'); assert.equal(ggk.hEll, 1052.337); assert.equal(ggk.sats, 12);
  assert.equal(parseSentence(nmea('PTNL,GGK,093019.00,092026,3843.12345,N,03912.54321,E,2,9,2.6,EHT1052.3,M')).fix, 'FLOAT');
  const cmds = spectraSetup('C', 1);
  assert.ok(cmds.includes('$PASHS,NME,GGA,C,ON,1') && cmds.includes('$PASHS,NME,GST,C,ON,1'));
  assert.equal(parseSentence('$PASHR,POS,3,14*00').type, 'BAD', 'bozuk sağlama toplamı reddedilir');
});

test('V2 · Yandex altlığı elipsoidal Mercator kullanır: karo satırı Google/OSM\'den farklı, gidiş-dönüş tutarlı', () => {
  const lat = 38.6748, lon = 39.2225, z = 17;
  assert.equal(tileX(lon, z), Math.floor(((lon + 180) / 360) * 2 ** z));
  const y57 = tileYf(lat, z, '3857'), y95 = tileYf(lat, z, '3395');
  assert.ok(y95 - y57 > 50 && y95 - y57 < 200, 'bu enlemde ≈ 100 karo fark: ' + (y95 - y57));
  for (const proj of ['3857', '3395']) {
    const y = tileY(lat, z, proj), a = tileLL(tileX(lon, z), y, z, proj), b = tileLL(tileX(lon, z) + 1, y + 1, z, proj);
    assert.ok(a.lat >= lat && b.lat <= lat && a.lon <= lon && b.lon >= lon, proj + ' karo noktayı kapsıyor');
    assert.ok(Math.abs(tileYf(a.lat, z, proj) - y) < 1e-6, proj + ' gidiş-dönüş');
  }
});

test('V3 · Katalog güncelleme: eski sürümden açılan veride yeni kalemler eklenir, kullanıcının değiştirdiği satır korunur', async () => {
  const { ds, ps } = await setup({ skipSeed: true });
  // 2.2.0 durumu: yeni kalemler ve kabin tablosu yok
  const old = JSON.parse(JSON.stringify(SEED));
  const isNew = (p) => /^(TEDAS|YEREL):/.test(p.servis);
  const added = old.poz.filter(isNew).length;
  assert.ok(added >= 40, 'yeni kalem sayısı: ' + added);
  old.poz = old.poz.filter((p) => !isNew(p)); delete old.cabin; old.standard = Object.assign({}, old.standard, { seedRev: 22 });
  await importStandard(ds, old);
  const before = (await ds.db.query('poz', 'stdId', SEED.standard.id)).length;
  // kullanıcı bir fiyatı değiştirmiş olsun
  const some = (await ds.db.query('poz', 'stdId', SEED.standard.id)).find((p) => !p.isKgGroup);
  await ds.db.put('poz', Object.assign({}, some, { priceMaterial: 123.45 }));
  const r = await upgradeStandard(ds, SEED);
  assert.ok(r.upgraded >= added, 'eklenen: ' + r.upgraded);
  const rows = await ds.db.query('poz', 'stdId', SEED.standard.id);
  assert.equal(rows.length, before + added);
  assert.equal(rows.find((p) => p.id === some.id).priceMaterial, 123.45, 'kullanıcı değişikliği korunur');
  assert.equal((await ds.db.get('standards', SEED.standard.id)).seedRev, SEED_REV);
  assert.equal((await upgradeStandard(ds, SEED)).skipped, true, 'ikinci kez çalışmaz');
  await newProject(ps);
  assert.ok(ps.cat.table('cabin') && ps.cat.table('cabin').govde['TİP-1C'], 'kabin tablosu geldi');
});

test('V4 · Malzeme listesi: LED dahil armatürler, hava yalıtımlı hücreler ve kofre katalogda', async () => {
  const { ps } = await setup();
  await newProject(ps);
  const arm = luminairePoz(ps.cat);
  assert.ok(arm.length >= 15, 'armatür sayısı: ' + arm.length);
  assert.ok(arm.filter((p) => /LED/i.test(p.name)).length >= 5, 'LED armatürler');
  assert.ok(arm.some((p) => /sodyum/i.test(p.name)), 'sodyum buharlı armatür');
  const hd = ps.cat.t.poz.filter((p) => /hava yal/i.test(p.name));
  assert.ok(hd.length >= 9, 'hava yalıtımlı hücre: ' + hd.length);
  assert.ok(hd.every((p) => p.unit === 'Ad' && p.verified === false), 'doğrulanacak olarak işaretli');
  const cab = ps.cat.table('cabin');
  for (const k of ['YA', 'SYA', 'KE', 'OLCU']) assert.ok(ps.cat.poz(cab.hucre.hd[k]), 'hd hücre pozu: ' + k);
  assert.ok(ps.cat.poz(cab.kofre.tek) && ps.cat.poz(cab.kofre.uc), 'kofre kalemleri');
  for (const p of ps.cat.t.poz) assert.ok(!new RegExp(['so', 'nay'].join(''), 'i').test(JSON.stringify(p)), 'yasaklı marka adı geçmez');
});

test('V5 · Beton köşk: köşkün kendisi tipine göre ayrı kalem; kabin kurulunca hücreler ve kablo kanalı keşfe gelir', async () => {
  const { ps } = await setup();
  await newProject(ps);
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mono', kva: 630, cins: 'herm' } }, { obs: rtkObs(START.E, START.N, START.H) });
  let it = mats(ps, tr.id);
  const shell = it.filter((x) => x.tag === 'kosk');
  assert.equal(shell.length, 1, 'köşk gövdesi tek kalem');
  assert.equal(shell[0].servis, ps.cat.table('cabin').govde['TİP-1C'], 'varsayılan TİP-1C');
  assert.equal(shell[0].qty, 1);
  const q0 = ps.result.quantities.find((q) => q.servis === shell[0].servis);
  assert.ok(q0 && q0.qty === 1, 'köşk metraja girdi');
  // tip değiştir
  await ps.updateEquipment(tr.id, { attrs: Object.assign({}, tr.attrs, { govde: ps.cat.table('cabin').govde['TİP-1B'] }) }, 'köşk tipi');
  assert.equal(mats(ps, tr.id).find((x) => x.tag === 'kosk').servis, ps.cat.table('cabin').govde['TİP-1B']);
  // kabin kur: hücre + kanal
  let cab = varsayilanKabin('mono');
  cab.yalitim = 'hd';
  cab = kanalEkle(cab, { ad: 'OG giriş kanalı', boy: 6500, gen: 600, der: 800 }).cabin;
  const nCell = cab.hucreler.length;
  assert.ok(nCell >= 2);
  await ps.updateEquipment(tr.id, { attrs: Object.assign({}, tr.attrs, { cabin: cab }) }, 'kabin');
  it = mats(ps, tr.id);
  assert.equal(it.filter((x) => x.tag === 'kosk').length, 1, 'gövde yine tek kalem');
  assert.equal(it.filter((x) => x.tag === 'hucre').reduce((a, x) => a + x.qty, 0), nCell, 'hücre adedi');
  const ch = it.find((x) => x.tag === 'kanal');
  assert.ok(ch && ch.qty === 6.5 && ch.unit === 'm', 'kanal metresi keşifte');
  // hücre çıkar → keşif azalır
  const cab2 = Object.assign({}, cab, { hucreler: cab.hucreler.slice(0, -1) });
  await ps.updateEquipment(tr.id, { attrs: Object.assign({}, tr.attrs, { cabin: cab2 }) }, 'hücre çıkarıldı');
  assert.equal(mats(ps, tr.id).filter((x) => x.tag === 'hucre').reduce((a, x) => a + x.qty, 0), nCell - 1);
  // direk tipi trafoda köşk gövdesi gelmez
  const dt = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'direk', kva: 100, cins: 'herm' } }, { obs: rtkObs(START.E + 80, START.N, START.H) });
  assert.equal(mats(ps, dt.id).filter((x) => x.tag === 'kosk').length, 0);
});

test('V6 · Abone kofresi: seçilince faz sayısına göre kalem gelir, seçilmezse gelmez', async () => {
  const { ps } = await setup();
  await newProject(ps);
  const a = await ps.addEquipment('subscriber', { attrs: { phase: 'tek' } }, { obs: rtkObs(START.E, START.N, START.H) });
  assert.equal(mats(ps, a.id).filter((x) => x.tag === 'kofre').length, 0);
  await ps.updateEquipment(a.id, { attrs: { phase: 'tek', kofre: true } }, 'kofre');
  const cab = ps.cat.table('cabin');
  assert.equal(mats(ps, a.id).find((x) => x.tag === 'kofre').servis, cab.kofre.tek);
  await ps.updateEquipment(a.id, { attrs: { phase: 'uc', kofre: true } }, 'üç faz');
  assert.equal(mats(ps, a.id).find((x) => x.tag === 'kofre').servis, cab.kofre.uc);
});

test('V7 · Enerji kontrolü: OG kaynağından trafoya, trafodan AG\'ye yayılır; kopuk ve açık hatlar enerjisiz kalır', () => {
  const pts = 'abcdefgh'.split('').map((id) => ({ id }));
  const eq = [...'abcdefg'].map((id) => ({ id: 'e' + id, kind: 'pole', pointId: id })).concat([{ id: 'tr', kind: 'transformer', pointId: 'h', state: 'yeni' }]);
  const lines = [
    { id: 'og', lineType: 'OG', nodes: ['a', 'b', 'h'], circuits: [{ role: 'OG' }], state: 'YENI' },
    { id: 'ag', lineType: 'AG', nodes: ['h', 'c', 'd'], circuits: [{ role: 'AG' }], state: 'YENI' },
    { id: 'kopuk', lineType: 'AG', nodes: ['e', 'f'], circuits: [{ role: 'AG' }], state: 'YENI' },
    { id: 'dem', lineType: 'AG', nodes: ['d', 'g'], circuits: [{ role: 'AG' }], state: 'DEMONTAJ' }
  ];
  const data = { points: pts, equipment: eq, lines };
  let r = energize(data, { og: true, ag: true, link: true, ogSources: ['a'] });
  assert.equal(r.lineState.get('og'), 'on'); assert.equal(r.lineState.get('ag'), 'on');
  assert.equal(r.lineState.get('kopuk'), 'off'); assert.equal(r.lineState.get('dem'), 'skip');
  assert.deepEqual(r.dead.lines, ['kopuk']);
  assert.deepEqual(r.dead.equipment.sort(), ['ee', 'ef']);
  assert.deepEqual(r.sources.ag, ['h'], 'trafo kendiliğinden AG kaynağı');
  // OG kaynağı yok → trafo OG almıyor → AG de enerjisiz
  r = energize(data, { og: true, ag: true, link: true, ogSources: [] });
  assert.equal(r.lineState.get('og'), 'off'); assert.equal(r.lineState.get('ag'), 'off'); assert.ok(r.notes.length >= 1);
  // yalnız AG: trafo doğrudan kaynak
  r = energize(data, { ag: true });
  assert.equal(r.lineState.get('ag'), 'on'); assert.equal(r.lineState.get('og'), 'na');
  // OG hattı açık bırakılırsa
  lines[0].energyOpen = true;
  r = energize(data, { og: true, ag: true, link: true, ogSources: ['a'] });
  assert.equal(r.lineState.get('og'), 'skip'); assert.equal(r.lineState.get('ag'), 'off');
  lines[0].energyOpen = false;
  // demontaj dahil
  r = energize(data, { ag: true, includeFuture: true });
  assert.equal(r.lineState.get('dem'), 'on');
  // müşterek hat: OG var, AG yok → kısmen
  const mus = { id: 'm', lineType: 'OG', nodes: ['a', 'b'], circuits: [{ role: 'OG' }, { role: 'AG' }], state: 'YENI' };
  r = energize({ points: pts, equipment: eq, lines: [mus] }, { og: true, ag: true, link: true, ogSources: ['a'] });
  assert.equal(r.lineState.get('m'), 'mixed');
});

test('V8 · Otomatik numara: hat güzergâhına göre sıralar, eski numarayı saklar, nokta numarasını da günceller, çakışmayı engeller', async () => {
  const { ps } = await setup();
  await newProject(ps);
  const coords = route(START, [[60, 98], [60, 102], [62, 95]]);
  const { poles, line } = await buildPoleLine(ps, coords, { group: 'bahh', typeNames: 'GN-12 (3 AWG)', circuits: [{ role: 'OG', key: '3xSwallow' }], prefix: 'X' });
  const ag = await ps.addEquipment('pole', { group: 'sehir' }, { obs: rtkObs(START.E, START.N - 50, START.H) });
  await ps.reverseLine(line.id);
  const qtyBefore = JSON.stringify(ps.result.quantities.map((q) => [q.servis, q.qty]));
  const plan = ps.renumberPlan({ kinds: ['pole'], groups: ['bahh'], prefix: 'D-', start: 1, digits: 3 });
  assert.equal(plan.plan.length, 4); assert.equal(plan.changed, 4); assert.deepEqual(plan.clash, []);
  const order = ps.lineById(line.id).nodes;
  assert.deepEqual(plan.plan.map((x) => x.pointId), order, 'hat düğüm sırası');
  const r = await ps.renumber({ kinds: ['pole'], groups: ['bahh'], prefix: 'D-', start: 1, digits: 3 });
  assert.equal(r.changed, 4);
  for (const [i, pid] of order.entries()) {
    const e = ps.eqAt(pid)[0];
    assert.equal(e.no, 'D-' + String(i + 1).padStart(3, '0')); assert.ok(/^X-/.test(e.prevNo));
    assert.equal(ps.pointById(pid).pointNo, e.no);
  }
  assert.equal(ps.eqById(ag.id).no, ag.no, 'kapsam dışı direk değişmez');
  assert.equal(JSON.stringify(ps.result.quantities.map((q) => [q.servis, q.qty])), qtyBefore, 'metraj değişmez');
  // çakışma: AG direğine aynı seri verilirse reddedilir
  await assert.rejects(() => ps.renumber({ kinds: ['pole'], groups: ['sehir'], prefix: 'D-', start: 1, digits: 3 }), /kullanılıyor/);
  // yalnız bir hat
  const one = ps.renumberPlan({ scope: 'line', lineId: line.id, kinds: ['pole'], prefix: 'K-', start: 10, digits: 2 });
  assert.deepEqual(one.plan.map((x) => x.no), ['K-10', 'K-11', 'K-12', 'K-13']);
  assert.ok((await ps.ds.list('audit', ps.p.id)).some((a) => /Otomatik numara/.test(a.reason || '')), 'denetim kaydı');
});

test('V9 · Çizim katmanı: DXF projeye eklenir, uçlara yapışır, birleşen kollardan tepe kuvveti hesaplanır', async () => {
  const { ps } = await setup();
  await newProject(ps);
  const L = (layer, x1, y1, x2, y2) => ['0', 'LINE', '8', layer, '10', x1, '20', y1, '11', x2, '21', y2];
  const dxf = ['0', 'SECTION', '2', 'ENTITIES', ...L('OG_3x477', 512000, 4281000, 512100, 4281000), ...L('OG_3x477', 512100, 4281000, 512200, 4281000), ...L('OG_3x477', 512100, 4281000, 512100, 4281080), '0', 'ENDSEC', '0', 'EOF', ''].join('\n');
  const r = await importCad(ps, new TextEncoder().encode(dxf), 'plan.dxf');
  assert.equal(r.doc.entCount, 3); assert.equal(cadDocs(ps).length, 1);
  const layers = await visibleCad(ps);
  const sn = snapCad(layers, 512100.6, 4281000.4, 5);
  assert.ok(sn && sn.x === 512100 && sn.y === 4281000 && sn.kind === 'end');
  assert.equal(snapCad(layers, 512050, 4281040, 5), null, 'uzakta yapışmaz');
  const arms = cadArms(layers, 512100, 4281000, 0.5);
  assert.equal(arms.length, 3);
  assert.deepEqual(arms.map((a) => Math.round(a.len)).sort((a, b) => a - b), [80, 100, 100]);
  const kollar = arms.map((a) => ({ tp: '3x477MCM#', ac: Math.round(a.az * 10) / 10, md: a.len }));
  const oner = gorevOner(kollar);
  assert.ok(oner && oner.gorev, 'görev önerisi');
  const res = hesapG({ mus: true, bolge: 3, kollar, yontem: 'oto', acikip: 'mut', wind: false, wdir: 90, wa: 50, braA: 0, eks: 'auto' });
  assert.ok(res.ok, res.hata || '');
  assert.ok(res.sonuc && res.demir && res.beton, 'direk seçildi');
  // çizimi kaldır: objeler etkilenmez
  await removeCad(ps, cadDocs(ps)[0]);
  assert.equal(cadDocs(ps).length, 0);
});

test('V10 · Şifre özeti: SHA-256 doğru, şifre 4–8 rakam, aynı şifre farklı kullanıcıda farklı saklanır', () => {
  for (const s of ['', 'abc', 'VOLT-EDAŞ 2026', 'x'.repeat(200)]) {
    const b = new TextEncoder().encode(s);
    assert.equal(Buffer.from(sha256(b)).toString('hex'), crypto.createHash('sha256').update(b).digest('hex'));
  }
  assert.ok(validPin('1234') && validPin('12345678') && !validPin('123') && !validPin('12a4') && !validPin('123456789'));
  assert.notEqual(pinHash('1234', 'A'), pinHash('1234', 'B'));
  assert.equal(pinHash('1234', 'A'), pinHash('1234', 'A'));
});

test('V11 · Rol kuralları: her rol yalnız kendi adımını atar', () => {
  const P = { members: [{ id: 'y', role: 'yonetici', active: true }] };
  const as = (role) => ({ id: role, role });
  assert.equal(approvalOn({ members: [] }), false); assert.equal(approvalOn(P), true); assert.equal(strictOn(P), true);
  assert.equal(approvalOn({ members: [{ id: 'y', role: 'yonetici', active: false }] }), false);
  // onay kapalı: herkes her şeyi yapar
  assert.ok(canHak({}, null, 'YAPILACAK', 'ONAYLI').ok);
  // oturum yok
  assert.equal(canHak(P, null, 'YAPILACAK', 'BASLANDI').ok, false);
  const ok = (r, f, t) => canHak(P, as(r), f, t).ok;
  assert.ok(ok('saha', 'YAPILACAK', 'TAMAMLANDI') && ok('saha', 'TAMAMLANDI', 'BASLANDI'));
  assert.ok(!ok('saha', 'TAMAMLANDI', 'KONTROL') && !ok('saha', 'KONTROL', 'TAMAMLANDI'));
  assert.ok(ok('kontrol', 'TAMAMLANDI', 'KONTROL') && ok('kontrol', 'KONTROL', 'BASLANDI') && !ok('kontrol', 'KONTROL', 'HAKEDISTE') && !ok('kontrol', 'YAPILACAK', 'TAMAMLANDI'));
  assert.ok(ok('hakedis', 'KONTROL', 'HAKEDISTE') && !ok('hakedis', 'TAMAMLANDI', 'HAKEDISTE') && !ok('hakedis', 'HAKEDISTE', 'ONAYLI'));
  assert.ok(ok('onay', 'HAKEDISTE', 'ONAYLI') && ok('onay', 'HAKEDISTE', 'KONTROL') && !ok('onay', 'KONTROL', 'ONAYLI'));
  assert.ok(ok('yonetici', 'YAPILACAK', 'ONAYLI'));
  assert.equal(canHak(P, as('kontrol'), 'KONTROL', 'BASLANDI').needReason, true, 'ret gerekçe ister');
  assert.equal(canHak(P, as('kontrol'), 'TAMAMLANDI', 'KONTROL').needReason, false);
  assert.match(canHak(P, as('saha'), 'TAMAMLANDI', 'KONTROL').why, /Kontrol mühendisi/);
  assert.equal(countsAsDone(P, { progress: 'done', state: 'YENI', hak: 'TAMAMLANDI' }), false);
  assert.equal(countsAsDone(P, { progress: 'done', state: 'YENI', hak: 'KONTROL' }), true);
  assert.equal(countsAsDone({}, { progress: 'done', state: 'YENI', hak: 'TAMAMLANDI' }), true, 'onay kapalıyken eski davranış');
  assert.equal(Object.keys(ROLES).length, 5);
});

test('V12 · Hakediş onay akışı: saha tamamlar → kontrol onaylar → hakediş dönemi → onay; yetkisiz adımlar reddedilir', async () => {
  const { ps } = await setup();
  await newProject(ps);
  const coords = route(START, [[60, 98], [60, 102]]);
  const { poles, line } = await buildPoleLine(ps, coords, { group: 'bahh', typeNames: 'GN-12 (3 AWG)', circuits: [{ role: 'OG', key: '3xSwallow' }] });
  const doneQty = () => ps.result.quantities.reduce((a, q) => a + (q.doneQty || 0), 0);
  const refsDone = () => { let n = 0; for (const q of ps.result.quantities) for (const c of q.refs || []) if (c.done) n++; return n; };
  // onay kapalı: eski davranış (as-built → tamamlandı, serbest değişim)
  assert.equal(ps.approval().on, false);
  await ps.setHak('equipment', poles[0].id, 'ONAYLI');
  await ps.setHak('equipment', poles[0].id, 'TAMAMLANDI');
  const before = refsDone();
  assert.ok(before > 0);
  // ilk kullanıcı yönetici olmalı
  await assert.rejects(() => ps.addMember({ name: 'Ali', role: 'saha', pin: '1111' }), /Yönetici/);
  await assert.rejects(() => ps.addMember({ name: 'Yön', role: 'yonetici', pin: '12' }), /4–8/);
  const adm = await ps.addMember({ name: 'Yön Etici', role: 'yonetici', pin: '9999' });
  assert.equal(ps.approval().on, true); assert.equal(ps.member.id, adm.id, 'ilk yönetici oturumu açık');
  assert.ok(!('pinHash' in ps.approval().members[0]), 'şifre özeti ekrana verilmez');
  assert.ok(!JSON.stringify(ps.p.members).includes('9999'), 'şifre düz yazıyla saklanmaz');
  // sıkı kip: kontrol edilmemiş işler hakediş toplamına girmez
  assert.equal(refsDone(), 0, 'onay açılınca kontrol edilmemiş iş sayılmaz');
  const saha = await ps.addMember({ name: 'Ali Saha', role: 'saha', pin: '1111' });
  const kon = await ps.addMember({ name: 'Ayşe Kontrol', role: 'kontrol', pin: '2222' });
  const hak = await ps.addMember({ name: 'Hakan Hakediş', role: 'hakedis', pin: '3333' });
  const ona = await ps.addMember({ name: 'Oya Onay', role: 'onay', pin: '4444' });
  await assert.rejects(() => ps.addMember({ name: 'ali saha', role: 'saha', pin: '1111' }), /var/);
  // oturum kapalı: değişiklik yok
  ps.logout();
  assert.equal(ps.member, null);
  await assert.rejects(() => ps.setHak('equipment', poles[1].id, 'BASLANDI'), /oturum/);
  await assert.rejects(() => ps.addMember({ name: 'X', role: 'saha', pin: '1111' }), /oturum/);
  // yanlış şifre + kilit
  for (let i = 0; i < 5; i++) assert.throws(() => ps.login(saha.id, '0000'), /yanlış/);
  assert.throws(() => ps.login(saha.id, '1111'), /bekleyin/);
  // saha operatörü (başka kullanıcının sayacı ayrı)
  ps._tries.clear();
  ps.login(saha.id, '1111');
  assert.equal(ps.ds.user.name, 'Ali Saha', 'denetim kaydına ad yazılır');
  await ps.setHak('equipment', poles[1].id, 'BASLANDI', 'düzeltme');
  await ps.setHak('equipment', poles[1].id, 'TAMAMLANDI');
  await assert.rejects(() => ps.setHak('equipment', poles[1].id, 'KONTROL'), /Kontrol mühendisi/);
  await assert.rejects(() => ps.createPeriod({ start: '2026-09-01', end: '2026-09-30' }), /Hakediş sorumlusu/);
  // yeni obje en fazla "Tamamlandı" ile girer
  const e4 = await ps.addEquipment('pole', { group: 'bahh', hak: 'ONAYLI' }, { obs: rtkObs(START.E, START.N + 90, START.H) });
  assert.equal(e4.hak, 'TAMAMLANDI');
  // kontrol mühendisi
  ps.login(kon.id, '2222');
  assert.equal(ps.pending('TAMAMLANDI').length, 5, '3 direk + 1 hat + yeni direk');
  await assert.rejects(() => ps.setHak('equipment', poles[0].id, 'BASLANDI'), /gerekçe/);
  const m = await ps.setHakMany([{ type: 'equipment', id: poles[0].id }, { type: 'equipment', id: poles[1].id }, { type: 'line', id: line.id }], 'KONTROL');
  assert.equal(m.changed, 3);
  assert.ok(refsDone() > 0 && refsDone() < before + 5, 'yalnız kontrol edilenler sayılır');
  const log = ps.eqById(poles[1].id).hakLog;
  assert.deepEqual(log.map((x) => [x.by, x.role, x.to]), [['Ali Saha', 'saha', 'BASLANDI'], ['Ali Saha', 'saha', 'TAMAMLANDI'], ['Ayşe Kontrol', 'kontrol', 'KONTROL']]);
  // kontrol edilmiş kayıt kilitli (saha değiştiremez), not serbest
  ps.login(saha.id, '1111');
  const t2 = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)');
  await assert.rejects(() => ps.updateEquipment(poles[0].id, { typeId: t2.id }, 'tip'), /kilitli/);
  await ps.updateEquipment(poles[0].id, { note: 'not' }, 'not');
  await ps.updateEquipment(poles[2].id, { typeId: t2.id }, 'tip');          // kontrol edilmemiş: serbest
  await assert.rejects(() => ps.updateEquipment(poles[0].id, { hak: 'BASLANDI', progress: 'planned', workDate: null }, 'geri'), /yapamaz/);
  // ret: gerekçeyle geri çevir
  ps.login(kon.id, '2222');
  await ps.setHak('equipment', poles[1].id, 'BASLANDI', 'izolatör eksik');
  assert.equal(ps.eqById(poles[1].id).hakLog.at(-1).note, 'izolatör eksik');
  assert.equal(ps.eqById(poles[1].id).progress, 'planned');
  // hakediş sorumlusu: dönem açar, yalnız kontrol edilmişler hakedişe girer
  await assert.rejects(() => ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' }), /Hakediş sorumlusu/);
  ps.login(hak.id, '3333');
  const per = await ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' });
  assert.equal(ps.eqById(poles[0].id).hak, 'HAKEDISTE'); assert.equal(ps.lineById(line.id).hak, 'HAKEDISTE');
  assert.equal(ps.eqById(poles[2].id).hak, 'TAMAMLANDI', 'kontrol edilmemiş iş hakedişe girmez');
  assert.equal(ps.eqById(poles[1].id).hak, 'BASLANDI');
  await assert.rejects(() => ps.approvePeriod(per.id), /Onay yetkilisi/);
  // onay yetkilisi
  ps.login(ona.id, '4444');
  await ps.approvePeriod(per.id);
  assert.equal(ps.eqById(poles[0].id).hak, 'ONAYLI');
  assert.equal(ps.data.periods.find((x) => x.id === per.id).approvedBy, 'Oya Onay');
  assert.equal(ps.eqById(poles[0].id).hakLog.at(-1).role, 'onay');
  // yönetim: yalnız yönetici; son yönetici kapatılamaz
  await assert.rejects(() => ps.updateMember(saha.id, { role: 'kontrol' }), /Yönetici/);
  await ps.updateMember(ona.id, { pin: '5555' });                           // kendi şifresi
  ps.logout(); assert.throws(() => ps.login(ona.id, '4444'), /yanlış/); ps.login(ona.id, '5555');
  ps.login(adm.id, '9999');
  await assert.rejects(() => ps.updateMember(adm.id, { role: 'saha' }), /En az bir etkin Yönetici/);
  await ps.updateMember(saha.id, { active: false });
  assert.throws(() => ps.login(saha.id, '1111'), /Kullanıcı yok/);
  // "yalnız kontrol edilmiş" kuralı kapatılırsa tamamlananlar yeniden sayılır
  ps.login(adm.id, '9999');
  const strictCount = refsDone();
  await ps.setApproval({ strict: false });
  assert.ok(refsDone() > strictCount);
  // mekanizmayı kapat: eski serbest davranış, geçmiş saklanır
  await ps.closeApproval('deneme bitti');
  assert.equal(ps.approval().on, false); assert.equal(ps.member, null);
  await ps.setHak('equipment', poles[2].id, 'ONAYLI');
  assert.ok(ps.eqById(poles[0].id).hakLog.length >= 3);
  const audit = await ps.ds.list('audit', ps.p.id);
  assert.ok(audit.some((a) => /Kullanıcı eklendi: Ayşe Kontrol/.test(a.reason || '')) && audit.some((a) => a.user === 'Ayşe Kontrol'));
});
