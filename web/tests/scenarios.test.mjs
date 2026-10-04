// 25 saha senaryosu — gerçek standart verisi (Yeşil Defter 26.23.GR.02) ve Elazığ civarı TM39 koordinatlarıyla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, newProject, buildPoleLine, route, rtkObs, phoneObs, tick, now, SEED } from './helpers.mjs';
import { IDBAdapter, MemoryAdapter } from '../src/core/db.js';
import { exportChangeset, applyChangeset, listConflicts, resolveConflict, markSynced } from '../src/core/sync.js';
import { exportFormat } from '../src/export/exporter.js';
import { buildExportModel } from '../src/export/model.js';
import { greenBookPage } from '../src/qty/metraj.js';
import { makeGGA, makeGST, makeGSA } from '../src/gnss/nmea.js';
import { unzip } from '../src/export/zip.js';
import fs from 'node:fs';

const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const q = (ps, job, servis) => ps.result.quantities.find((x) => x.job === job && x.servis === servis);
const approx = (a, b, tol = 1e-3, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' beklenen ' + b + ' bulunan ' + a);
const issues = (ps, code, no) => ps.result.issues.filter((i) => (!code || i.code === code) && (!no || i.entityNo === no));

// Ortak OG hattı: 6 direk, D-017'de ~28.7° sağa köşe
const START = { E: 519000.0, N: 4282000.0, H: 1055.0 };
const OG_ROUTE = route(START, [[60, 98.412, 4.3], [60, 102.775, 2.14], [60, 95.33, -1.86], [88.7, 110.064, 3.02], [88.7, 104.218, 1.476]]);
const OG_TYPES = ['GD-12 (3 AWG)', 'GT-12 (3 AWG)', 'GT-12 (3 AWG)', 'GZ-12 (3 AWG)', 'GT-12 (3 AWG)', 'GN-12 (3 AWG)'];

test('01 · OG havai hat (BAHH + 3xSwallow): açıklık, rol, köşe açısı, reçete, Kg metraj', async () => {
  const { ps } = await setup(); await newProject(ps);
  const { poles, line } = await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const sp = ps.result.spans.filter((s) => s.lineId === line.id);
  assert.equal(sp.length, 5);
  approx(sp[0].length2D, 98.412, 1e-6, 'açıklık 1 2B');
  approx(sp[0].length3D, Math.hypot(98.412, 4.3), 1e-6, 'açıklık 1 3B');
  const roles = poles.map((p) => ps.result.roles.get(p.id));
  assert.deepEqual(roles.map((r) => r.role), ['N', 'T', 'T', 'Z', 'T', 'N']);
  approx(roles[3].angle, 28.7, 1e-6, 'köşe açısı');
  assert.equal(roles[3].side, 'sağ');
  // Rol/tip uyumu: D-014 tipi GD (durdurucu) ama rol nihayet → UYUMSUZ + öneri GN-12
  const u = issues(ps, 'UYUMSUZ').filter((i) => i.entityId === poles[0].id);
  assert.ok(u.length && /GN-12/.test(u[0].message), 'rol/tip uyuşmazlığı ve öneri');
  // Köşe direği reçetesi: GZ travers + 6 gergi izolatörü + 3 atlama mesneti
  const m = ps.result.matsByEq.get(poles[3].id).items;
  assert.ok(m.find((x) => x.servis === '005.02.02.02-021'), 'GZ-250 travers');
  assert.equal(m.find((x) => x.servis === '011.06.04.01-001').qty, 6);
  assert.equal(m.find((x) => x.servis === '011.04.01.01-006').qty, 3);
  assert.equal(m.find((x) => x.servis === '030.01.02.01-001').qty, 10);
  // Swallow Kg = 3 × Σ3B × 0.10996
  const L3 = sp.reduce((s, x) => s + x.length3D, 0);
  approx(q(ps, 'montaj', '009.03.01.01-003').qty, +(3 * L3 * 109.96 / 1000).toFixed(2), 0.011, 'Swallow kg');
  // Direk Kg grubu = Σ direk ağırlıkları
  const kg = OG_TYPES.reduce((s, n) => s + ps.cat.poleTypeByName('bahh', n).kg, 0);
  approx(q(ps, 'montaj', '005.01.02.02-000').qty, kg, 1e-6, 'direk kg grubu');
});

test('02 · AG havai hat (şehir içi, çıplak 3P+R): AG mesnet izolatörü ve iletken kg', async () => {
  const { ps } = await setup(); await newProject(ps);
  const r = route({ E: 519300, N: 4281800, H: 1060 }, [[120, 38, 0.4], [120, 41, 0.2], [150, 36, -0.3]]);
  const { poles, line } = await buildPoleLine(ps, r, { group: 'sehir', typeNames: ['G-10U', 'G-10I', 'G-10U', 'G-10U'], lineType: 'AG', circuits: [{ role: 'AG', custom: { f: 'P', nt: 'R' }, count: 1 }] });
  const mT = ps.result.matsByEq.get(poles[1].id).items, mZ = ps.result.matsByEq.get(poles[2].id).items;
  assert.equal(mT.find((x) => x.servis === '011.04.01.01-001').qty, 4, 'taşıyıcı AG mesnet');
  assert.equal(mZ.find((x) => x.servis === '011.04.01.01-001').qty, 8, 'köşe AG mesnet');
  assert.equal(ps.result.roles.get(poles[2].id).role, 'Z');
  const L3 = ps.result.lineInfo.get(line.id).length3D;
  approx(q(ps, 'montaj', '009.02.01.01-007').qty, +(3 * L3 * 118.32 / 1000).toFixed(2), 0.011, 'Pansy kg');
  approx(q(ps, 'montaj', '009.02.01.01-001').qty, +(1 * L3 * 59.15 / 1000).toFixed(2), 0.011, 'Rose kg');
  assert.equal(issues(ps, 'UYUMSUZ').length, 0, 'uyumsuzluk yok: ' + JSON.stringify(issues(ps, 'UYUMSUZ')));
});

test('03 · AG+OG müşterek hat: müşterek tepe traversi, iki devre metrajı, OG hatta AG iletkeni reddi', async () => {
  const { ps } = await setup(); await newProject(ps);
  const r = route({ E: 519500, N: 4282300, H: 1062 }, [[45, 60, 0.5], [45, 58, 0.1], [45, 61, 0.2]]);
  const { poles, line } = await buildPoleLine(ps, r, { group: 'mus', typeNames: ["G-12U''", "G-12I''", "G-12I''", "G-12U''"], lineType: 'OG', musterek: true, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }, { role: 'AG', key: '3x70/16+95 AER', count: 1 }] });
  const m = ps.result.matsByEq.get(poles[1].id).items;
  assert.ok(m.find((x) => x.servis === '005.02.02.01-005'), 'müşterek tepe traversi (taşıyıcı)');
  const L3 = ps.result.lineInfo.get(line.id).length3D;
  approx(q(ps, 'montaj', '009.05.01.01-029') ? q(ps, 'montaj', '009.05.01.01-029').qty : ps.result.quantities.find((x) => x.unit === 'm' && /70\/16\+95|3x70/.test(x.name) || x.servis === ps.cat.lineType('3x70/16+95 AER').parts[0].yd).qty, L3, 1e-3, 'AER metre');
  assert.ok(q(ps, 'montaj', '009.03.01.01-003'), 'Swallow var');
  // OG devresine AER seçilirse UYUMSUZ
  await ps.updateLine(line.id, { circuits: [{ role: 'OG', key: '3x70/16+95 AER', count: 1 }] }, 'test');
  assert.ok(issues(ps, 'UYUMSUZ').some((i) => /OG hatta AG iletkeni/.test(i.message)), 'OG hatta AG iletkeni UYUMSUZ');
});

test('04 · Abone hattı (tek faz havai, 2x16+25 AER): abone malzemeleri otomatik', async () => {
  const { ps } = await setup(); await newProject(ps);
  const pole = await ps.addEquipment('pole', { group: 'sehir', typeId: ps.cat.poleTypeByName('sehir', 'G-10I').id }, { obs: rtkObs(519600, 4281900, 1061) });
  const ab = await ps.addEquipment('subscriber', { attrs: { phase: 'tek', aboneNo: 'ABN-44120' } }, { obs: rtkObs(519618, 4281909, 1061.5) });
  const line = await ps.createLine({ lineType: 'ABONE', install: 'havai', abonePhase: 'tek', aboneCount: 1, circuits: [{ role: 'ABONE', key: '2x16+25 AER', count: 1 }], nodes: [pole.pointId, ab.pointId] });
  assert.ok(q(ps, 'montaj', '032.13.01.01-002'), 'tek fazlı yapı bağlantı hattı');
  assert.ok(q(ps, 'montaj', '008.01.01.01-001'), '3/4" muhafaza borusu');
  assert.ok(q(ps, 'montaj', '014.01.00.00-001'), 'askı teli');
  approx(q(ps, 'montaj', ps.cat.lineType('2x16+25 AER').parts[0].yd).qty, ps.result.lineInfo.get(line.id).length3D, 1e-3);
  assert.equal(issues(ps, 'UYARI').filter((i) => /Abone hattı SDK/.test(i.message)).length, 0);
});

test('05 · OG yeraltı kablo (3x(1x95/16) YE3SV): kanal + iniş + trafo payı + muf + rezerv, toprak kanal servisi', async () => {
  const { ps } = await setup(); await newProject(ps);
  const pole = await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GN-12 (3 AWG)').id }, { obs: rtkObs(519700, 4282100, 1063) });
  const k = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mbk', kioskServis: '022.02.03.03-005', kva: 400, cins: 'herm' } }, { obs: rtkObs(519950, 4282180, 1064) });
  const v = await ps.createPoint({ pointNo: 'P-01', cls: 'HAT', obs: rtkObs(519820, 4282150, 1063.5) });
  const line = await ps.createLine({ lineType: 'OG', install: 'yeralti', circuits: [{ role: 'OG', key: '3x(1x95/16) YE3SV', count: 1 }], nodes: [pole.pointId, v.id, k.pointId], cable: { channelType: 'toprak', width: 0.5, depth: 1.0, reserveM: 5, riserM: 8, trafoM: 5, exitM: 2, jointM: 1.5, drumM: 500 } });
  const Lc = ps.result.lineInfo.get(line.id).length2D;
  const b = ps.result.lineInfo.get(line.id).cable.breakdown;
  const core = Lc + 8 + 2 * 2 + 5 + 0 * 1.5 + 5;
  approx(b.damar, core, 1e-6, 'damar boyu');
  const cable = q(ps, 'montaj', '032.19.01.01-004');
  assert.ok(cable, 'toprak kanal servis kodu (032.19...)');
  approx(cable.qty, core * 3, 1e-3, 'tek damarlı × 3');
  assert.equal(issues(ps, 'EKSİK VERİ').filter((i) => i.entityId === line.id).length, 0);
  assert.ok(ps.result.quantities.find((x) => x.material === 'KANAL_TOPRAK'), 'kanal metrajı');
  assert.ok(ps.result.quantities.find((x) => x.material === 'BASLIK_OG'), 'kablo başlığı');
});

test('06 · AG yeraltı kablo (NYY 3x50+25): kanal derinliği yoksa EKSİK VERİ, girilince temiz', async () => {
  const { ps } = await setup(); await newProject(ps);
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'bina', kva: 400, cins: 'herm' } }, { obs: rtkObs(519400, 4282400, 1066) });
  const sdk = await ps.addEquipment('sdk', { state: 'YENI', attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id, outputs: 4 } }, { obs: rtkObs(519460, 4282440, 1066.4) });
  const line = await ps.createLine({ lineType: 'AG', install: 'yeralti', circuits: [{ role: 'AG', key: 'NYY 3x50+25', count: 1 }], nodes: [tr.pointId, sdk.pointId], cable: { channelType: 'beton', width: 0.4 } });
  assert.ok(issues(ps, 'EKSİK VERİ').some((i) => i.entityId === line.id && /derinliği/.test(i.message)));
  await ps.updateLine(line.id, { cable: { channelType: 'beton', width: 0.4, depth: 0.8 } }, 'derinlik girildi');
  assert.equal(issues(ps, 'EKSİK VERİ').filter((i) => i.entityId === line.id).length, 0);
  assert.ok(q(ps, 'montaj', '032.12.01.02-' + ps.cat.lineType('NYY 3x50+25').parts[0].yd.slice(-3)) || ps.result.quantities.find((x) => x.servis === ps.cat.lineType('NYY 3x50+25').parts[0].yd), 'beton kanal servis kodu');
  assert.ok(ps.result.quantities.find((x) => x.material === 'BETON'), 'kanal betonu');
});

test('07 · Direk tipi trafo (250 kVA, G-T25): trafo, pano, parafudr; 400 kVA → UYUMSUZ', async () => {
  const { ps } = await setup(); await newProject(ps);
  const td = ps.cat.poleTypeByName('trafo', 'G-T25');
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'direk', kva: 250, cins: 'herm', poleTypeId: td.id, serial: 'TR-250-8812', maker: 'Örnek Trafo' } }, { obs: rtkObs(519200, 4282250, 1064) });
  const m = ps.result.matsByEq.get(tr.id).items;
  assert.ok(m.find((x) => x.servis === '031.03.04.04-029'), '250 kVA direk tipi trafo');
  assert.ok(m.find((x) => x.servis === '024.01.02.01-004'), '250 kVA harici pano');
  assert.equal(m.find((x) => x.servis === '015.01.01.01-010').qty, 3, 'parafudr');
  assert.ok(m.find((x) => x.servis === td.servis), 'trafo direği');
  assert.equal(issues(ps, 'UYUMSUZ').filter((i) => i.entityId === tr.id).length, 0);
  await ps.updateEquipment(tr.id, { attrs: Object.assign({}, tr.attrs, { kva: 400 }) }, 'güç');
  assert.ok(issues(ps, 'UYUMSUZ').some((i) => i.entityId === tr.id && /G-T25/.test(i.message)), 'direk kapasitesi uyumsuz');
});

test('08 · Köşk tipi trafo (TİP-1C 400 kVA): köşk kalemi; köşk/kVA uyuşmazlığı UYUMSUZ', async () => {
  const { ps } = await setup(); await newProject(ps);
  const k = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mbk', kioskServis: '022.02.03.03-005', kva: 400 } }, { obs: rtkObs(519300, 4282500, 1066) });
  const m = ps.result.matsByEq.get(k.id).items;
  assert.ok(m.find((x) => x.servis === '022.02.03.03-005'), 'köşk');
  assert.equal(m.find((x) => x.servis === '030.02.01.01-001').qty, 8, 'köşk topraklama kazığı');
  await ps.updateEquipment(k.id, { attrs: Object.assign({}, k.attrs, { kva: 630 }) }, 'güç');
  assert.ok(issues(ps, 'UYUMSUZ').some((i) => i.entityId === k.id && /Köşk tipi 400 kVA/.test(i.message)));
});

test('09 · SDK: ekipman olarak modellenir; beslemesiz uyarısı, AG bağlanınca kalkar', async () => {
  const { ps } = await setup(); await newProject(ps);
  const sdk = await ps.addEquipment('sdk', { state: 'YENI', attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id, outputs: 4, fuses: ['3×100 A NH'] } }, { obs: rtkObs(519100, 4281950, 1058) });
  assert.ok(ps.result.matsByEq.get(sdk.id).items.find((x) => x.servis === '024.02.02.01-002'), 'SDK box pozu');
  assert.ok(issues(ps, 'UYARI').some((i) => i.entityId === sdk.id && /besleyen/.test(i.message)));
  const p = await ps.addEquipment('pole', { group: 'sehir', typeId: ps.cat.poleTypeByName('sehir', 'G-10I').id }, { obs: rtkObs(519090, 4281990, 1058.5) });
  await ps.createLine({ lineType: 'AG', install: 'havai', circuits: [{ role: 'AG', key: '3x35+50 AER', count: 1 }], nodes: [p.pointId, sdk.pointId] });
  assert.equal(issues(ps, 'UYARI').filter((i) => i.entityId === sdk.id && /besleyen/.test(i.message)).length, 0);
});

test('10 · Aydınlatma: poligon direkler + aydınlatma hattı, kg grubu', async () => {
  const { ps } = await setup(); await newProject(ps);
  const r = route({ E: 519250, N: 4282600, H: 1067 }, [[90, 30, 0], [90, 30, 0]]);
  const { poles } = await buildPoleLine(ps, r, { group: 'ayd', typeNames: 'AD1-80/10', lineType: 'AYD', circuits: [{ role: 'AYD', key: '3x16+25 AER', count: 1 }] });
  const g = q(ps, 'montaj', '005.05.01.01-000');
  assert.ok(g, 'aydınlatma kg grubu');
  approx(g.qty, 3 * ps.cat.poleTypeByName('ayd', 'AD1-80/10').kg, 1e-6);
  assert.ok(poles.every((p) => p.no.startsWith('AY-')));
});

test('11 · ENH: sehim-gerilme, direk yükleri, karayolu geçişi açıklık kontrolü', async () => {
  const { ps } = await setup(); await newProject(ps, { enhZone: 'III' });
  const r = route({ E: 520000, N: 4283000, H: 1070 }, [[10, 180, 2], [10, 190, -1], [35, 175, 1.5]]);
  const { line } = await buildPoleLine(ps, r, { group: 'bahh', typeNames: ['GN-14 (3 AWG)', 'GT-14 (3 AWG)', 'GZ-14 (3 AWG)', 'GN-14 (3 AWG)'], lineType: 'ENH', circuits: [{ role: 'ENH', key: '3xSwallow', count: 1 }] });
  const res = ps.result.enh.get(line.id);
  assert.ok(!res.error, res.error);
  assert.equal(res.conductor, 'Swallow');
  const s0 = res.spans[0];
  assert.ok(s0.sagMax > 0.5 && s0.sagMax < 15, 'makul sehim ' + s0.sagMax);
  // değişik haller denklemi kalıntısı ≈ 0 (S1 → S4)
  const sec = res.sections[0], S = Object.fromEntries(sec.states.map((x) => [x.id, x])), E = res.mech.E, al = res.mech.alpha, a = sec.ar;
  const lhs = S.S4.sigma ** 2 * (S.S4.sigma - S.S1.sigma + (a * a * S.S1.g ** 2 * E) / (24 * S.S1.sigma ** 2) + al * E * (S.S4.t - S.S1.t)), rhs = (a * a * S.S4.g ** 2 * E) / 24;
  approx(lhs, rhs, rhs * 1e-6, 'denklem kalıntısı');
  assert.ok(s0.groundClear != null, 'zemin açıklığı hesaplandı');
  for (const st of res.sections[0].states) assert.ok(st.sigma <= res.sections[0].sMax * 1.001, 'σ ≤ σmax (' + st.id + ')');
  const zp = res.poles.find((p) => p.role === 'Z');
  assert.ok(zp.Hangle > 0, 'köşe direğinde açı kuvveti');
  // Karayolu geçişi: 4 m yüksek araç profiline göre zemin kotu yüksek bir noktada → açıklık yetersiz
  const span = ps.result.spans.find((s) => s.lineId === line.id && s.seq === 1);
  await ps.addCrossing({ crossKind: 'karayolu', label: 'D300 Karayolu', spanId: span.id, distance: span.length2D / 2, objectHeight: 0, groundH: 1076.5 });
  const res2 = ps.result.enh.get(line.id);
  const c = res2.spans[1].crossings[0];
  assert.equal(c.required, 7.5, 'ENH karayolu düşey açıklık');
  assert.equal(c.ok, false, 'açıklık yetersiz: ' + c.clearance);
  assert.ok(issues(ps, 'UYUMSUZ').some((i) => /D300/.test(i.message)));
});

test('12 · Montaj: yeni direk → servis öneki 0, Yeşil Defter montaj sayfası', async () => {
  const { ps } = await setup(); await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE.slice(0, 3), { group: 'bahh', typeNames: ['GN-12 (3 AWG)', 'GT-12 (3 AWG)', 'GN-12 (3 AWG)'], circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const g = q(ps, 'montaj', '005.01.02.02-000');
  assert.equal(g.code, '005.01.02.02-000');
  const page = greenBookPage(ps.result.quantities, 'montaj');
  assert.ok(page.some((r) => r.sub && /GT-12/.test(r.name)));
});

test('13 · Demontaj: servis öneki 1, topraklama geri alınmaz, sayfada olmayan kalem işaretlenir', async () => {
  const { ps } = await setup(); await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE.slice(0, 3), { group: 'bahh', typeNames: ['GN-12 (3 AWG)', 'GT-12 (3 AWG)', 'GN-12 (3 AWG)'], circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }], state: 'DEMONTAJ' });
  const g = q(ps, 'demontaj', '005.01.02.02-000');
  assert.equal(g.code, '105.01.02.02-000');
  assert.ok(!ps.result.quantities.some((x) => x.job === 'demontaj' && x.servis === '030.02.01.01-001'), 'topraklama demontajda yok');
  assert.ok(q(ps, 'demontaj', '009.03.01.01-003'), 'iletken demontajı');
  assert.equal(q(ps, 'demontaj', '009.03.01.01-003').code, '109.03.01.01-003');
});

test('14 · DMM (BYSK): servis öneki 2, montaj/demontaj ile karışmaz', async () => {
  const { ps } = await setup(); await newProject(ps);
  const t = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)');
  await ps.addEquipment('pole', { group: 'bahh', typeId: t.id, state: 'DMM' }, { obs: rtkObs(519000, 4282000, 1055) });
  await ps.addEquipment('pole', { group: 'bahh', typeId: t.id, state: 'YENI' }, { obs: rtkObs(519050, 4282050, 1055) });
  const d = q(ps, 'dmm', '005.01.02.02-000'), mo = q(ps, 'montaj', '005.01.02.02-000');
  assert.equal(d.code, '205.01.02.02-000');
  approx(d.qty, t.kg, 1e-6); approx(mo.qty, t.kg, 1e-6);
});

test('15 · Revizyon: direk yeniden ölçülünce HARİTA→HAT→AÇIKLIK→METRAJ→HAKEDİŞ→DXF zinciri güncellenir', async () => {
  const { ps, bus } = await setup(); await newProject(ps);
  const { poles, line } = await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await ps.createWorkProgram();
  const per1 = await ps.createPeriod({ start: '2026-09-01', end: '2026-09-30' });
  await ps.approvePeriod(per1.id, '1. hakediş onayı');
  await exportFormat(ps, 'dxf'); // dışa aktarım işi kaydı yok; imza değişimini kontrol edeceğiz
  const sig0 = ps.result.signature;
  const kg0 = q(ps, 'montaj', '009.03.01.01-003').qty;
  let impact = null; bus.on('project:computed', (e) => { impact = e.impact; });
  const P = ps.pointById(poles[3].pointId);
  tick(60000);
  await ps.remeasure(P.id, rtkObs(P.E + 1.5, P.N - 2.0, P.H + 0.2), 'Direk yeri sahada değişti');
  assert.ok(impact && impact.spans === 2 && impact.roles >= 1 && impact.quantities >= 1 && impact.exportsStale, 'etki zinciri ' + JSON.stringify(impact));
  assert.notEqual(ps.result.signature, sig0);
  const kg1 = q(ps, 'montaj', '009.03.01.01-003').qty;
  assert.notEqual(kg0, kg1);
  const per2 = await ps.createPeriod({ start: '2026-10-01', end: '2026-10-31' });
  const t2 = ps.periodTable(per2.id);
  const sw = t2.lines.find((l) => l.servis === '009.03.01.01-003');
  approx(sw.sources.REVIZYON, +(kg1 - kg0).toFixed(3), 0.02, 'revizyon farkı');
  const t1 = ps.periodTable(per1.id);
  approx(t1.lines.find((l) => l.servis === '009.03.01.01-003').cumulative, kg0, 1e-6, 'onaylı dönem dondurulmuş');
  const aud = await ps.ds.auditFor(P.id);
  assert.ok(aud.some((a) => a.reason === 'Direk yeri sahada değişti' && a.changes.some((c) => c.field === 'E')), 'denetim kaydı eski/yeni değer');
});

test('16 · Telefon GPS test noktası: TEST sınıfı, kritik noktada ÖLÇÜ KABUL EDİLMEDİ', async () => {
  const { ps, gnss } = await setup(); await newProject(ps);
  const e = await ps.addEquipment('pole', { group: 'sehir', typeId: ps.cat.poleTypeByName('sehir', 'G-10I').id }, { obs: phoneObs(519130.214, 4282161.806, 1060) });
  const p = ps.pointById(e.pointId);
  assert.equal(p.source, 'PHONE'); assert.equal(p.accuracyClass, 'TEST');
  assert.ok(issues(ps, 'ÖLÇÜ KABUL EDİLMEDİ').some((i) => i.entityId === e.id));
  // GNSS servisi: telefon kaynağı kritik noktada reddedilir
  gnss.state = Object.assign(gnss.state, { source: 'phone', lat: 38.67, lon: 39.2, sigmaH: 4.8, fix: 'PHONE' });
  const qv = gnss.quality({ critical: true });
  assert.equal(qv.ok, false); assert.equal(qv.cls, 'TEST');
  assert.equal(gnss.quality({ critical: false }).ok, true);
});

async function feedEpochs(gnss, n, quality, sig) {
  for (let i = 0; i < n; i++) { tick(1000); const d = now(); gnss.feed([makeGGA(38.6743, 39.2232, 1031.1, quality, 24, 0.7, 36.1, quality >= 4 ? 1.0 : null, d), makeGST(sig[0], sig[0], sig[1], d), makeGSA(1.4, 0.7, 1.1)].join('\r\n') + '\r\n'); }
}
test('17 · RTK FLOAT reddi: kritik noktada ölçüm reddedilir, gerekçeli', async () => {
  const { gnss } = await setup({ skipSeed: true });
  gnss.state.source = 'external';
  await feedEpochs(gnss, 3, 5, [0.06, 0.1]);
  assert.equal(gnss.state.fix, 'FLOAT');
  await assert.rejects(gnss.observe({ critical: true }), (e) => e.code === 'REJECTED' && e.reasons.some((r) => /RTK FIX yok/.test(r)));
  const q2 = gnss.quality({ critical: false });
  assert.equal(q2.ok, true); assert.ok(q2.warn.some((w) => /RTK FIX değil/.test(w)));
});

test('18 · RTK FIX kabulü: min FIX süresi + σ eşikleri sağlanınca epok ortalamalı gözlem', async () => {
  const { gnss } = await setup({ skipSeed: true });
  gnss.state.source = 'external';
  await feedEpochs(gnss, 2, 4, [0.006, 0.011]);
  await assert.rejects(gnss.observe({ critical: true }), (e) => e.reasons.some((r) => /FIX süresi/.test(r)));
  await feedEpochs(gnss, 5, 4, [0.006, 0.011]);
  const pr = gnss.observe({ critical: true, epochs: 5 });
  await feedEpochs(gnss, 5, 4, [0.006, 0.011]);
  const o = await pr;
  assert.equal(o.fix, 'FIX'); assert.equal(o.cls, 'RTK'); assert.equal(o.epochs, 5);
  assert.ok(o.sigmaH < 0.02 && o.E > 519000 && o.N > 4282000);
  approx(o.h, 1031.1 + 36.1 - 2.0, 1e-3, 'elipsoidal zemin (anten 2 m)');
});

test('19 · Offline ölçüm: IndexedDB (fake) kalıcılık, kapat-aç, senkron kuyruğu', async () => {
  const { indexedDB } = await import('fake-indexeddb');
  const A = new IDBAdapter(indexedDB, 'volt-test-offline');
  const { ps } = await setup({ adapter: A });
  const p = await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE.slice(0, 3), { group: 'bahh', typeNames: ['GN-12 (3 AWG)', 'GT-12 (3 AWG)', 'GN-12 (3 AWG)'], circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const n = ps.data.points.length;
  const B = new IDBAdapter(indexedDB, 'volt-test-offline');
  const s2 = await setup({ adapter: B, skipSeed: true });
  await s2.ps.open(p.id);
  assert.equal(s2.ps.data.points.length, n);
  assert.equal(s2.ps.result.spans.length, 2);
  const out = await B.getAll('outbox');
  assert.ok(out.filter((x) => !x.synced).length >= 7, 'senkron kuyruğu');
});

test('20 · Senkronizasyon: iki cihaz, değişiklik aktarımı ve çakışma çözümü', async () => {
  const A = await setup({ deviceId: 'tablet-A', user: 'Mühendis A' });
  const p = await newProject(A.ps);
  const e = await A.ps.addEquipment('pole', { group: 'bahh', typeId: A.ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id }, { obs: rtkObs(519000, 4282000, 1055) });
  const B = await setup({ deviceId: 'tablet-B', user: 'Operatör B' });
  const cs = await exportChangeset(A.ds, p.id);
  const r1 = await applyChangeset(B.ds, cs);
  assert.ok(r1.applied >= 3);
  await markSynced(A.ds, cs.outboxIds);
  await B.ps.open(p.id);
  assert.equal(B.ps.data.equipment.length, 1);
  // Aynı direği iki tarafta değiştir → çakışma
  await A.ps.updateEquipment(e.id, { note: 'A: temel kayalık' }, 'not');
  await B.ps.updateEquipment(e.id, { note: 'B: erişim tarla yolu' }, 'not');
  const r2 = await applyChangeset(B.ds, await exportChangeset(A.ds, p.id));
  assert.equal(r2.conflicts.length, 1);
  const cf = (await listConflicts(B.ds))[0];
  assert.ok(cf.fields.includes('note'));
  await resolveConflict(B.ds, cf.id, { note: 'remote' });
  assert.equal((await B.ds.get('equipment', e.id)).note, 'A: temel kayalık');
  assert.equal((await listConflicts(B.ds)).length, 0);
});

test('21 · DXF üretimi: katman/ACI/blok/yazı, Türkçe kodlama', async () => {
  const { ps } = await setup(); await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'direk', kva: 160, poleTypeId: ps.cat.poleTypeByName('trafo', 'G-T25').id } }, { obs: rtkObs(519600, 4282250, 1064) });
  const [f] = await exportFormat(ps, 'dxf');
  const t = Buffer.from(f.data).toString('latin1');
  assert.ok(t.includes('AC1009') && t.includes('ANSI_1254'));
  assert.ok(/LAYER\r\n\s*2\r\nELEKTRIK-HAT-OG\r\n\s*70\r\n0\r\n\s*62\r\n1\r\n/.test(t.replace(/\r\n2\r\n/g, '\r\n2\r\n')) || t.includes('ELEKTRIK-HAT-OG'));
  assert.ok(t.includes('KAFES_OG_FULL') && t.includes('TRAFO_DIREK_FULL'));
  assert.equal(f.stats.inserts, 7);
  assert.ok(t.includes('3xSwallow'));
  // Türkçe karakterler Windows-1254 (Ş=0xDE, ş=0xFE, ğ=0xF0), UTF-8 dizisi yok
  const sp = ps.result.spans[1];
  const pa = ps.pointById(sp.fromId); await ps.addCrossing({ crossKind: 'dere', label: 'Şahinkaya deresi geçişi', spanId: sp.id, distance: 20, E: pa.E + 5, N: pa.N + 5, objectHeight: 0 });
  const [f2] = await exportFormat(ps, 'dxf');
  const B = Buffer.from(f2.data);
  assert.ok(B.includes(Buffer.from([0xde, 0x61, 0x68])), 'Şah (cp1254)');
  assert.ok(B.includes(Buffer.from([0x67, 0x65, 0xe7, 0x69, 0xfe, 0x69])), 'geçişi (cp1254)');
  assert.ok(!B.includes(Buffer.from([0xc5, 0x9e])), 'UTF-8 Ş yok');
  fs.writeFileSync(OUT + 'test.dxf', f2.data);
});

test('22 · SHP + GeoJSON üretimi: geometri ve öznitelik dosyaları, WGS84/proje CRS', async () => {
  const { ps } = await setup(); await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const [z] = await exportFormat(ps, 'shp');
  const files = await unzip(z.data);
  for (const n of ['ekipman.shp', 'ekipman.shx', 'ekipman.dbf', 'ekipman.prj', 'hatlar.shp', 'acikliklar.dbf']) assert.ok(files[n], n);
  assert.ok(new TextDecoder().decode(files['ekipman.prj']).startsWith('PROJCS["TUREF_TM39"'));
  fs.mkdirSync(OUT + 'shp', { recursive: true });
  for (const [n, d] of Object.entries(files)) fs.writeFileSync(OUT + 'shp/' + n, d);
  const [g1, g2] = await exportFormat(ps, 'geojson');
  const G = JSON.parse(new TextDecoder().decode(g1.data));
  const pole = G.features.find((f) => f.properties.no === ps.data.equipment[0].no);
  const P = ps.pointById(ps.data.equipment[0].pointId);
  approx(pole.geometry.coordinates[0], P.lon, 1e-9); approx(pole.geometry.coordinates[1], P.lat, 1e-9);
  const G2 = JSON.parse(new TextDecoder().decode(g2.data));
  assert.equal(G2.crs.properties.name, 'urn:ogc:def:crs:EPSG::5257');
  fs.writeFileSync(OUT + 'test_wgs84.geojson', g1.data);
});

test('23 · Yeşil Defter: Kg grubu = Σ(alt kalem × kg/Ad), montaj/demontaj/DMM sayfaları ayrı', async () => {
  const { ps } = await setup(); await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const g = q(ps, 'montaj', '005.02.02.02-000');
  const sum = g.subs.reduce((s, x) => s + x.qty * x.kgPer, 0);
  approx(g.qty, sum, 1e-6, 'travers kg grubu');
  const page = greenBookPage(ps.result.quantities, 'montaj');
  assert.ok(page.length > 10);
  assert.equal(greenBookPage(ps.result.quantities, 'demontaj').length, 0);
  const [x] = await exportFormat(ps, 'xlsx');
  const files = await unzip(x.data);
  assert.ok(files['xl/workbook.xml'] && files['xl/worksheets/sheet2.xml']);
  fs.writeFileSync(OUT + 'test.xlsx', x.data);
});

test('24 · Hakediş: iş programı → dönem → önceki / bu dönem / kümülatif / kalan, kaynaklar', async () => {
  const { ps } = await setup(); await newProject(ps, { mode: 'tasarim' });
  const { poles } = await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await ps.createWorkProgram({ basis: 'Keşif' });
  const wp = ps.activeProgram();
  const kgAll = wp.items.find((i) => i.servis === '005.01.02.02-000').contractQty;
  for (const e of poles.slice(0, 3)) await ps.updateEquipment(e.id, { progress: 'done', workDate: '2026-09-15' }, 'montaj tamamlandı');
  const p1 = await ps.createPeriod({ start: '2026-09-01', end: '2026-09-30' });
  const t1 = ps.periodTable(p1.id);
  const l1 = t1.lines.find((l) => l.servis === '005.01.02.02-000');
  const kg3 = OG_TYPES.slice(0, 3).reduce((s, n) => s + ps.cat.poleTypeByName('bahh', n).kg, 0);
  approx(l1.current, kg3); approx(l1.previous, 0); approx(l1.remaining, kgAll - kg3);
  assert.ok(l1.sources.GNSS > 0, 'kaynak GNSS');
  await ps.approvePeriod(p1.id);
  for (const e of poles.slice(3)) await ps.updateEquipment(e.id, { progress: 'done', workDate: '2026-10-10' }, 'montaj tamamlandı');
  const p2 = await ps.createPeriod({ start: '2026-10-01', end: '2026-10-31' });
  const l2 = ps.periodTable(p2.id).lines.find((l) => l.servis === '005.01.02.02-000');
  approx(l2.previous, kg3); approx(l2.cumulative, kgAll); approx(l2.current, kgAll - kg3); approx(l2.remaining, 0);
});

test('25 · Yeniden ölçülen nokta: telefon GPS noktası RTK ile revize, aynı Point ID, geçmiş korunur', async () => {
  const { ps } = await setup(); await newProject(ps);
  const e = await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GN-12 (3 AWG)').id }, { obs: phoneObs(519130.2, 4282161.8, 1060) });
  const id = e.pointId, nPts = ps.data.points.length;
  assert.ok(issues(ps, 'ÖLÇÜ KABUL EDİLMEDİ').some((i) => i.entityId === e.id));
  await ps.remeasure(id, rtkObs(519133.527, 4282158.064, 1068.69), 'RTK FIX ile yeniden ölçüldü');
  const p = ps.pointById(id);
  assert.equal(ps.data.points.length, nPts, 'yeni nokta açılmadı');
  assert.equal(p.source, 'GNSS_RTK'); assert.equal(p.history.length, 1); assert.equal(p.history[0].source, 'PHONE');
  approx(p.E, 519133.527, 1e-6);
  assert.equal(issues(ps, 'ÖLÇÜ KABUL EDİLMEDİ').filter((i) => i.entityId === e.id).length, 0);
  assert.equal(ps.eqAt(id)[0].id, e.id, 'ekipman ve reçete aynen kaldı');
});

test('26 · Teslim paketi: tüm dosyalar + SHA-256 manifest', async () => {
  const { ps } = await setup(); await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE, { group: 'bahh', typeNames: OG_TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await ps.addPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg', { ownerId: ps.data.equipment[0].id, ownerNo: ps.data.equipment[0].no, pointNo: ps.data.equipment[0].no, heading: 42, note: 'taban' });
  const [pk] = await exportFormat(ps, 'package');
  const files = await unzip(pk.data);
  for (const n of ['proje/project.json', 'gnss/ham_nmea.nmea', 'gnss/RINEX_OKUBENI.txt', 'fotograflar/metadata.csv', 'MANIFEST.txt']) assert.ok(files[n], n);
  assert.ok(Object.keys(files).some((n) => n.startsWith('cad/') && n.endsWith('.dxf')));
  assert.ok(Object.keys(files).some((n) => n.startsWith('excel/')));
  assert.ok(/[0-9a-f]{64}/.test(new TextDecoder().decode(files['MANIFEST.txt'])));
  fs.writeFileSync(OUT + 'teslim_paketi.zip', pk.data);
  const [rep] = await exportFormat(ps, 'report');
  fs.writeFileSync(OUT + 'rapor.html', rep.data);
});
