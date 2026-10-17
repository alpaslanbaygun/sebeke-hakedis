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

test('11 · ENH: sehim-gerilme, direk yükleri, zemin açıklığı (geçiş özelliği kaldırıldı)', async () => {
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
  // v2.2: GEÇİŞ özelliği kaldırıldı → açıklık sonucunda geçiş listesi yok, servis API'si yok; zemin açıklığı kontrolü sürer
  assert.equal(res.spans[1].crossings, undefined, 'açıklıkta geçiş alanı yok');
  assert.equal(typeof ps.addCrossing, 'undefined', 'addCrossing kaldırıldı');
  assert.ok(s0.groundReq > 0, 'zemin açıklığı şartı tablodan geliyor');
  assert.ok(!issues(ps).some((i) => i.group === 'Geçiş'), 'geçiş bulgusu üretilmiyor');
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
  assert.ok(t.includes('SH_KAFES_OG_YENI') && t.includes('SH_TRAFO_DIREK_YENI'), 'ortak simge takımının blokları (eklentiyle aynı adlar)');
  assert.equal(f.stats.inserts, 7);
  assert.ok(t.includes('3xSwallow'));
  // Türkçe karakterler Windows-1254 (Ş=0xDE, ş=0xFE, ğ=0xF0), UTF-8 dizisi yok
  const sp = ps.result.spans[1];
  const pa = ps.pointById(sp.fromId); await ps.createPoint({ pointNo: 'Şahinkaya deresi geçişi', cls: 'DETAY', critical: false, coord: { E: pa.E + 5, N: pa.N + 5, H: pa.H }, source: 'MANUAL' }); await ps.recompute('detay');
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
  // v2.2: paket = proje klasörü (PROJECT_<KOD>/…)
  const R = 'PROJECT_ELZ-2026-OG03/';
  for (const n of ['PROJECT_INFO/project.json', 'PROJECT_INFO/MANIFEST.txt', 'SAHA_ALIMI/saha_objeleri.csv', 'HAKEDIS/hakedis_durumu.csv', 'GNSS/ham_nmea.nmea', 'GNSS/RINEX_OKUBENI.txt', 'FOTOGRAFLAR/metadata.csv', 'EXCEL_IMPORT/aktarim_gecmisi.json']) assert.ok(files[R + n], n);
  assert.ok(Object.keys(files).some((n) => n.startsWith(R + 'EXPORT/') && n.endsWith('.dxf')));
  assert.ok(Object.keys(files).some((n) => n.startsWith(R + 'HAKEDIS/') && n.endsWith('.xlsx')));
  assert.ok(Object.keys(files).some((n) => n.startsWith(R + 'RAPORLAR/')) && Object.keys(files).some((n) => n.startsWith(R + 'HARITA/')));
  assert.ok(Object.keys(files).some((n) => n.startsWith(R + 'DIREKLER/' + ps.data.equipment[0].no + '/')), 'fotoğraf obje klasöründe');
  assert.ok(/[0-9a-f]{64}/.test(new TextDecoder().decode(files[R + 'PROJECT_INFO/MANIFEST.txt'])));
  fs.writeFileSync(OUT + 'teslim_paketi.zip', pk.data);
  const [rep] = await exportFormat(ps, 'report');
  fs.writeFileSync(OUT + 'rapor.html', rep.data);
});

// ======================= v2.2 · Teknik Spesifikasyon v2 senaryoları =======================
import { sourceCode, sourceInfo, sourceTag } from '../src/core/source.js';
import { resolveCoord, crsChoices, createObject } from '../src/services/survey-service.js';
import { buildTemplates, parseTable, validateImport, applyImport, TEMPLATES } from '../src/services/excel-import.js';
import { buildXLSX } from '../src/export/xlsx.js';
import { buildExif, withExif, extractExif, nextPhotoName, photoPath, overlayLines } from '../src/services/photo-service.js';
import { hakOf, HAK_STATUSES } from '../src/core/schema.js';
import { makeCrs, project as projLL, unproject as unprojLL } from '../src/geo/crs.js';

test('27 · Veri kaynağı: GNSS_RTK / GNSS_FLOAT / TELEFON_GPS / MANUEL / EXCEL / HARITADAN_SECILDI etiketleri ve dışa aktarım', async () => {
  const { ps, gnss } = await setup(); await newProject(ps);
  const t = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id;
  const a = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { obs: rtkObs(519000, 4282000, 1055) });
  const b = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { obs: rtkObs(519080, 4282010, 1056, { fix: 'FLOAT', sigmaH: 0.21, override: true, overrideReasons: ['RTK FIX yok (FLOAT)'] }) });
  const c = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { obs: phoneObs(519160, 4282020, 1057) });
  const d = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { coord: { E: 519240, N: 4282030, H: 1058 }, source: 'MANUAL' });
  const e = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { coord: { E: 519320, N: 4282040, H: null }, source: 'MAP' });
  const f = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { coord: { E: 519400, N: 4282050, H: 1060 }, source: 'EXCEL' });
  const codes = [a, b, c, d, e, f].map((x) => sourceCode(ps.pointById(x.pointId)));
  assert.deepEqual(codes, ['GNSS_RTK', 'GNSS_FLOAT', 'TELEFON_GPS', 'MANUEL', 'HARITADAN_SECILDI', 'EXCEL']);
  assert.equal(sourceTag(ps.pointById(a.pointId)), '[RTK FIX]'); assert.equal(sourceTag(ps.pointById(b.pointId)), '[RTK FLOAT]');
  assert.equal(sourceTag(ps.pointById(e.pointId)), '[HARİTA]'); assert.equal(sourceInfo(ps.pointById(a.pointId)).precise, true);
  // Haritadan seçilen noktada Z bilinmiyor
  assert.equal(ps.pointById(e.pointId).zUnknown, true); assert.equal(ps.pointById(e.pointId).H, null);
  // Uyarıyla kabul edilen FLOAT: hata değil uyarı; ölçülmeden girilenler bilgi uyarısı
  const ib = ps.result.issues.filter((i) => i.entityId === b.id && i.code === 'ÖLÇÜ KABUL EDİLMEDİ');
  assert.equal(ib.length, 1); assert.equal(ib[0].severity, 'warn');
  assert.ok(ps.result.issues.some((i) => i.entityId === d.id && /GNSS ile ölçülmedi/.test(i.message) && i.severity === 'warn'));
  assert.ok(ps.result.issues.some((i) => i.entityId === e.id && /Z bilinmiyor/.test(i.message)));
  // Her ölçümde kaydedilenler (7.6)
  const pa = ps.pointById(a.pointId);
  for (const k of ['measuredAt', 'device', 'deviceSerial', 'operator', 'crsLabel']) assert.ok(pa[k], k);
  assert.equal(pa.quality.sats, 26); assert.equal(pa.operator, 'Test Operatör');
  // Dışa aktarım modeli spesifikasyon kodlarını taşır
  const m = buildExportModel(ps);
  assert.deepEqual(m.equipment.map((x) => x.source), codes);
  const [csv] = await exportFormat(ps, 'csv');
  const txt = new TextDecoder().decode(csv.data);
  assert.ok(txt.includes('HARITADAN_SECILDI') && txt.includes('TELEFON_GPS') && txt.includes('Operatör'));
  const [rep] = await exportFormat(ps, 'report');
  const html = new TextDecoder().decode(rep.data);
  for (const s of ['[RTK FIX]', '[RTK FLOAT]', '[TELEFON GPS]', '[MANUEL]', '[EXCEL]', '[HARİTA]', 'Saha objeleri', 'Fotoğraflar', 'Hakediş durumu']) assert.ok(html.includes(s), 'raporda ' + s);
  // GNSS servisi: uyarı onayı (override) ile FLOAT gözlem alınır
  gnss.state.source = 'external';
  await feedEpochs(gnss, 3, 5, [0.06, 0.1]);
  const pr = gnss.observe({ critical: true, override: true, epochs: 3 });
  await feedEpochs(gnss, 3, 5, [0.06, 0.1]);
  const o = await pr;
  assert.equal(o.override, true); assert.equal(o.fix, 'FLOAT'); assert.ok(o.overrideReasons.some((r) => /RTK FIX yok/.test(r)));
  assert.ok(o.hdop != null && o.vdop != null && o.pdop != null, 'HDOP/VDOP/PDOP kaydedildi');
});

test('28 · Manuel koordinat ve koordinat sistemi: proje CRS, eksen düzeltme, ED50, enlem/boylam, uyumsuzluk', async () => {
  const { ps } = await setup(); await newProject(ps);
  const r1 = resolveCoord(ps.p, { x: '520487,364', y: '4282048,846', z: '1059.6' });
  assert.ok(r1.ok); approx(r1.E, 520487.364, 1e-6); approx(r1.N, 4282048.846, 1e-6); approx(r1.H, 1059.6, 1e-9); assert.equal(r1.swapped, false);
  // X/Y ters girilmiş → büyüklükten tanınır
  const r2 = resolveCoord(ps.p, { x: 4282048.846, y: 520487.364, zUnknown: true });
  assert.ok(r2.ok && r2.swapped); approx(r2.E, 520487.364, 1e-6); assert.equal(r2.H, null); assert.equal(r2.zUnknown, true);
  assert.ok(r2.warn.some((w) => /yer değiştirmiş/.test(w)));
  // ED50 TM39 girişi → proje (TUREF) koordinatına dönüşür: gidiş-dönüş tutarlı
  const ed = makeCrs({ datum: 'ED50', projection: 'TM3', cm: 39 });
  const g = unprojLL(520487.364, 4282048.846, ps.p.crs), q = projLL(g.lat, g.lon, ed);
  const r3 = resolveCoord(ps.p, { x: q.E, y: q.N, z: 1000, crsKey: 'ed50' });
  assert.ok(r3.ok); approx(r3.E, 520487.364, 0.002, 'ED50→TUREF E'); approx(r3.N, 4282048.846, 0.002, 'ED50→TUREF N');
  assert.ok(Math.hypot(q.E - 520487.364, q.N - 4282048.846) > 20, 'ED50 ile TUREF arasında datum farkı var');
  // Enlem / boylam (X = boylam, Y = enlem)
  const r4 = resolveCoord(ps.p, { x: g.lon, y: g.lat, crsKey: 'geo', zUnknown: true });
  assert.ok(r4.ok); approx(r4.E, 520487.364, 0.001); approx(r4.N, 4282048.846, 0.001);
  // Uyumsuzluklar
  assert.match(resolveCoord(ps.p, { x: 39.23, y: 38.67 }).error, /derece gibi/);
  assert.match(resolveCoord(ps.p, { x: 520487, y: 9282048 }).error, /Türkiye sınırları dışında/);
  assert.match(resolveCoord(ps.p, { x: 'abc', y: 4282048 }).error, /sayı değil/);
  assert.match(resolveCoord(ps.p, { x: '', y: 4282048 }).error, /boş/);
  assert.ok(crsChoices(ps.p).length >= 5 && crsChoices(ps.p)[0].key === 'proje');
  // Manuel objeden kayıt: kaynak MANUEL, girilen sistem saklanır
  const c = await createObject(ps, { type: 'direk', typeText: 'GT-12 (3 AWG)', groupText: 'OG', coord: r3, source: 'MANUAL' });
  const p = ps.pointById(c.pointId);
  assert.equal(sourceCode(p), 'MANUEL'); assert.match(p.enteredCrs, /ED50/); assert.ok(c.equipment.typeId, 'tip katalogdan eşleşti');
});

test('29 · Excel: şablonlar, 124 kayıtlık dosya, doğrulama (118 uygun / 6 hatalı), önizleme ve toplu aktarım', async () => {
  const { ps } = await setup(); await newProject(ps);
  // Şablon dosyası: 6 şablon + açıklama sayfası, başlıklar spesifikasyondaki gibi
  const tpl = await buildTemplates(ps.p);
  assert.match(tpl.name, /\.xlsx$/);
  const tsheets = await parseTable(tpl.data);
  assert.deepEqual(tsheets.map((s) => s.name), ['Direk', 'Trafo', 'SDK', 'Kanal', 'Armatür', 'Genel', 'AÇIKLAMA']);
  assert.deepEqual(tsheets[0].rows[0], ['Direk No', 'Tip', 'Grup', 'X', 'Y', 'Z', 'Durum', 'Hakediş', 'Açıklama']);
  assert.deepEqual(tsheets[3].rows[0], ['Kanal No', 'Başlangıç X', 'Başlangıç Y', 'Bitiş X', 'Bitiş Y', 'Uzunluk']);
  assert.equal(validateImport(ps, tsheets).total, 0, 'boş şablonda kayıt yok');
  fs.writeFileSync(OUT + 'excel_sablon.xlsx', tpl.data);
  // Önce projede bir direk olsun (duplicate kontrolü için)
  await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id, no: 'D-900' }, { obs: rtkObs(518900, 4281900, 1050) });
  // 124 kayıtlık dosya: 100 direk + 6 trafo + 6 SDK + 4 kanal + 4 armatür + 4 genel; 6'sı hatalı
  const direk = [];
  for (let i = 1; i <= 100; i++) direk.push(['E-' + String(i).padStart(3, '0'), i % 7 === 0 ? 'GZ-12 (3 AWG)' : 'GT-12 (3 AWG)', 'OG', 519000 + i * 40, 4282000 + i * 3, i % 10 === 0 ? null : 1050 + i * 0.1, i % 5 === 0 ? 'Mevcut' : 'Yeni', i % 4 === 0 ? 'Yapılacak' : 'Tamamlandı', i === 3 ? 'köşe başı' : '']);
  direk[9][0] = '';                         // hata 1: eksik obje numarası
  direk[19][3] = 'yok';                     // hata 2: geçersiz veri tipi (X)
  direk[29][0] = 'D-900';                   // hata 3: projede var (duplicate)
  direk[39][0] = 'E-039';                   // hata 4: dosyada duplicate
  direk[49][4] = '';                        // hata 5: boş koordinat
  direk[59][3] = 39.2; direk[59][4] = 38.6; // hata 6: koordinat sistemi uyumsuz (derece)
  direk[69][3] = 4282210; direk[69][4] = 521800; // uyarı: X/Y yer değiştirmiş → düzeltilir, kayıt uygun
  direk[79][1] = 'OLMAYAN-TIP';             // uyarı: tip katalogda yok → kayıt uygun
  const trafo = []; for (let i = 1; i <= 6; i++) trafo.push(['ETR-' + i, [50, 100, 160, 250, 400, 250][i - 1], i === 5 ? 'Köşk' : 'Direk tipi', 519100 + i * 300, 4282100, 1055, 'Yeni', 'Başlandı', '']);
  const sdk = []; for (let i = 1; i <= 6; i++) sdk.push(['ESDK-' + i, '', 4, 519150 + i * 250, 4282150, 1056, 'köşe']);
  const kanal = []; for (let i = 1; i <= 4; i++) kanal.push(['K-00' + i, 519000 + i * 100, 4282300, 519000 + i * 100 + 60, 4282380, i === 1 ? 120 : 100]);
  const arm = []; for (let i = 1; i <= 4; i++) arm.push(['EAR-' + i, i === 1 ? '150 W Sodyum' : 'LED 100 W', 519200 + i * 50, 4282400, null, '']);
  const genel = [['Menhol', 'EMH-1', 519300, 4282500, 1050, ''], ['Pano', 'EPN-1', 519320, 4282500, 1050, ''], ['Detay', 'EDT-1', 519340, 4282500, null, 'yol kenarı'], ['Diğer', 'EX-1', 519360, 4282500, 1050, 'kamera direği']];
  const mk = (t, rows) => ({ name: t.sheet, columns: t.columns.map((h) => ({ h })), rows });
  const xlsx = await buildXLSX([mk(TEMPLATES[0], direk), mk(TEMPLATES[1], trafo), mk(TEMPLATES[2], sdk), mk(TEMPLATES[3], kanal), mk(TEMPLATES[4], arm), mk(TEMPLATES[5], genel)]);
  fs.writeFileSync(OUT + 'excel_124_kayit.xlsx', xlsx);
  const res = validateImport(ps, await parseTable(xlsx, 'saha.xlsx'));
  assert.equal(res.total, 124); assert.equal(res.ok, 118); assert.equal(res.bad, 6);
  const errs = res.records.filter((r) => !r.ok).map((r) => r.errors.join(' | ')).join('\n');
  for (const re of [/Eksik obje numarası/, /Geçersiz veri tipi: X/, /Duplicate obje numarası: D-900 projede/, /Duplicate obje numarası: E-039 dosyada/, /Hatalı \/ boş koordinat/, /Koordinat sistemi uyumsuz/]) assert.match(errs, re);
  assert.ok(res.records.find((r) => r.no === 'E-070').warnings.some((w) => /yer değiştirmiş/.test(w)));
  assert.ok(res.records.find((r) => r.no === 'E-080').warnings.some((w) => /Tip katalogda bulunamadı/.test(w)));
  assert.ok(res.records.find((r) => r.no === 'K-001').warnings.some((w) => /Uzunluk/.test(w)), 'kanal uzunluğu koordinatla karşılaştırıldı');
  // Aktarım: yalnız uygun kayıtlar, kaynak EXCEL
  const before = ps.data.equipment.length;
  const out = await applyImport(ps, res);
  assert.equal(out.imported, 118); assert.equal(out.skipped, 6);
  assert.equal(ps.data.equipment.length - before, 94 + 6 + 6 + 4 + 3, 'ekipman: 94 direk + 6 trafo + 6 SDK + 4 armatür + menhol/pano/diğer');
  assert.equal(ps.data.lines.filter((l) => l.channelOnly).length, 4);
  const e1 = ps.data.equipment.find((e) => e.no === 'E-001');
  assert.equal(sourceCode(ps.pointById(e1.pointId)), 'EXCEL'); assert.equal(hakOf(e1), 'TAMAMLANDI'); assert.ok(e1.typeId);
  assert.equal(hakOf(ps.data.equipment.find((e) => e.no === 'E-004')), 'YAPILACAK');
  assert.equal(hakOf(ps.data.equipment.find((e) => e.no === 'E-005')), null, 'mevcut direğin hakediş kalemi yok');
  const e70 = ps.pointById(ps.data.equipment.find((e) => e.no === 'E-070').pointId);
  approx(e70.E, 521800, 1e-6, 'eksen düzeltildi'); approx(e70.N, 4282210, 1e-6);
  assert.equal(ps.data.equipment.find((e) => e.no === 'E-010'), undefined, 'numarası boş satır aktarılmadı');
  assert.equal(ps.data.equipment.find((e) => e.no === 'E-020'), undefined, 'X değeri sayı olmayan satır aktarılmadı');
  assert.equal(ps.data.equipment.find((e) => e.no === 'ETR-4').attrs.kva, 250);
  assert.equal(ps.data.equipment.find((e) => e.no === 'ETR-2').state, 'yeni');
  assert.equal(hakOf(ps.data.equipment.find((e) => e.no === 'ETR-2')), 'BASLANDI');
  assert.equal(ps.data.equipment.find((e) => e.no === 'EPN-1').kind, 'panel');
  assert.equal(ps.data.equipment.find((e) => e.no === 'EX-1').kind, 'other');
  assert.equal(ps.data.equipment.find((e) => e.no === 'EAR-1').attrs.servis, '020.05.01.01-003', 'armatür pozu addan bulundu');
  assert.equal(ps.pointByNo('EDT-1').cls, 'DETAY');
  // Kanal: yalnız kanal metrajı (kablo, muf, başlık yok)
  const k1 = ps.data.lines.find((l) => l.lineNo === 'K-001'), li = ps.result.lineInfo.get(k1.id);
  approx(li.length2D, 100, 1e-6); assert.ok(li.items.some((x) => x.material === 'KANAL_TOPRAK')); assert.ok(!li.items.some((x) => /MUF|BASLIK/.test(x.material || '')));
  // Aynı dosya tekrar seçilirse tüm numaralar çakışır
  const again = validateImport(ps, await parseTable(xlsx));
  assert.equal(again.ok, 0);
  // CSV de okunur (noktalı virgül, ondalık virgül)
  const csv = new TextEncoder().encode('Obje Tipi;Obje No;X;Y;Z;Açıklama\r\nDetay;C-1;519500,5;4282600,25;1051,2;"köşe; duvar"\r\n');
  const rc = validateImport(ps, await parseTable(csv, 'genel.csv'));
  assert.equal(rc.ok, 1); approx(rc.records[0].data.coord.E, 519500.5, 1e-9); assert.equal(rc.records[0].data.note, 'köşe; duvar');
});

test('30 · Obje bazlı hakediş durumu: 6 durum, metraja etkisi, dönem açılınca / onaylanınca otomatik ilerleme', async () => {
  const { ps } = await setup(); await newProject(ps);
  const { poles, line } = await buildPoleLine(ps, OG_ROUTE.slice(0, 4), { group: 'bahh', typeNames: OG_TYPES.slice(0, 4), circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  assert.deepEqual(Object.keys(HAK_STATUSES), ['YAPILACAK', 'BASLANDI', 'TAMAMLANDI', 'KONTROL', 'HAKEDISTE', 'ONAYLI']);
  assert.equal(hakOf(ps.eqById(poles[0].id)), 'TAMAMLANDI', 'uygulama modunda alınan obje tamamlandı sayılır');
  const grp = ps.cat.poleGroup('bahh').kgGroup;
  const cum = () => { const t = ps.periodTable ? null : null; return ps.result.quantities.find((x) => x.job === 'montaj' && x.servis === grp).refs.filter((r) => r.done).reduce((s, r) => s + r.qty, 0); };
  const all = cum();
  // Yapılacak / Başlandı → hakediş kümülatifinden düşer
  await ps.setHak('equipment', poles[3].id, 'YAPILACAK');
  assert.equal(ps.eqById(poles[3].id).progress, 'planned'); assert.equal(ps.eqById(poles[3].id).workDate, null);
  assert.ok(cum() < all - 1, 'yapılacak obje kümülatiften çıktı');
  await ps.setHak('equipment', poles[2].id, 'BASLANDI');
  await ps.setHak('equipment', poles[1].id, 'KONTROL');
  await ps.setHak('line', line.id, 'KONTROL');
  assert.deepEqual(ps.hakCounts(), { TAMAMLANDI: 1, KONTROL: 2, BASLANDI: 1, YAPILACAK: 1 });
  await assert.rejects(ps.setHak('equipment', poles[0].id, 'BITTI'), /Geçersiz/);
  // Dönem açılınca: tamamlandı + kontrol edildi → hakedişe girdi; başlandı/yapılacak yerinde kalır
  await ps.createWorkProgram();
  const per = await ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' });
  assert.equal(hakOf(ps.eqById(poles[0].id)), 'HAKEDISTE'); assert.equal(hakOf(ps.eqById(poles[1].id)), 'HAKEDISTE'); assert.equal(hakOf(ps.lineById(line.id)), 'HAKEDISTE');
  assert.equal(hakOf(ps.eqById(poles[2].id)), 'BASLANDI'); assert.equal(hakOf(ps.eqById(poles[3].id)), 'YAPILACAK');
  const t = ps.periodTable(per.id);
  const row = t.lines.find((l) => l.servis === grp && l.job === 'montaj');
  approx(row.current, cum(), 0.01, 'dönem miktarı = tamamlanan objeler');
  // Onay: hakedişe giren → onaylandı
  await ps.approvePeriod(per.id);
  assert.equal(hakOf(ps.eqById(poles[0].id)), 'ONAYLI'); assert.equal(hakOf(ps.lineById(line.id)), 'ONAYLI');
  assert.equal(hakOf(ps.eqById(poles[2].id)), 'BASLANDI');
  // Sonradan tamamlanan obje bir sonraki döneme girer
  await ps.setHak('equipment', poles[2].id, 'TAMAMLANDI');
  const per2 = await ps.createPeriod({ start: '2027-01-01', end: '2027-03-31' });
  const row2 = ps.periodTable(per2.id).lines.find((l) => l.servis === grp && l.job === 'montaj');
  assert.ok(row2.current > 0 && row2.previous > 0, 'ikinci dönemde yalnız yeni tamamlanan');
  // Mevcut objenin hakediş durumu yok
  const mv = await ps.addEquipment('pole', { group: 'bahh', typeId: poles[0].typeId, state: 'MEVCUT' }, { obs: rtkObs(519900, 4282900, 1070) });
  assert.equal(hakOf(mv), null); await assert.rejects(ps.setHak('equipment', mv.id, 'TAMAMLANDI'), /iş kalemi yok/);
  // Dışa aktarım: hakediş durumu
  const m = buildExportModel(ps);
  assert.equal(m.equipment.find((e) => e.id === poles[0].id).hakLabel, 'Hakediş Onaylandı');
  const gj = JSON.parse(new TextDecoder().decode((await exportFormat(ps, 'geojson'))[0].data));
  assert.ok(gj.features.some((f) => f.properties.hakedis === 'ONAYLI'));
});

test('31 · GEÇİŞ kaldırıldı: eski kayıtlar detay noktasına dönüştürülür ya da arşivlenir; menü ve katalogda yok', async () => {
  const { ps, ds } = await setup(); await newProject(ps);
  await buildPoleLine(ps, OG_ROUTE.slice(0, 3), { group: 'bahh', typeNames: OG_TYPES.slice(0, 3), circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  assert.equal(ps.cat.table('crossingTypes'), undefined, 'katalogda geçiş tablosu yok');
  assert.ok(!(SEED.legend.layers || []).some((l) => l.key === 'GECIS'));
  // v2.1'den kalma iki geçiş kaydı (doğrudan veritabanına)
  await ds.create('crossings', { projectId: ps.p.id, crossKind: 'karayolu', label: 'D300 Karayolu', E: 519050, N: 4282030, groundH: 1057, objectHeight: 4.5 }, { silent: true });
  await ds.create('crossings', { projectId: ps.p.id, crossKind: 'dere', label: 'Konumsuz dere' }, { silent: true });
  await ps.open(ps.p.id);
  assert.equal(ps.legacyCrossings().length, 2);
  const n0 = ps.data.points.length;
  assert.ok(!ps.result.issues.some((i) => i.group === 'Geçiş'), 'eski kayıt hesap zincirine girmez');
  const r = await ps.convertLegacyCrossings('detail');
  assert.deepEqual(r, { made: 1, archived: 2 });
  assert.equal(ps.legacyCrossings().length, 0);
  const np = ps.data.points[ps.data.points.length - 1];
  assert.equal(ps.data.points.length, n0 + 1); assert.equal(np.cls, 'DETAY'); assert.match(np.note, /D300 Karayolu/); approx(np.E, 519050, 1e-9);
  assert.equal((await ds.db.getAll('crossings')).filter((c) => c.status === 'deleted').length, 2, 'kayıtlar arşivde duruyor');
  const src = fs.readFileSync(new URL('../src/ui/screens/map.js', import.meta.url), 'utf8');
  assert.ok(!/GEÇİŞ AL/.test(src) && !/'crossing'/.test(src), 'harita menüsünde GEÇİŞ AL yok');
});

test('32 · Fotoğraf: {ObjeNo}_{Sıra}.jpg, tür/obje klasörü, görüntü üstü satırlar, EXIF GPS, teslim paketinde klasör yapısı', async () => {
  const { ps } = await setup(); await newProject(ps);
  const e = await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id, no: 'D045' }, { obs: rtkObs(519000, 4282000, 1055) });
  const tr = await ps.addEquipment('transformer', { state: 'yeni', no: 'TR001', attrs: { post: 'direk', kva: 250, cins: 'herm', poleTypeId: ps.cat.poleTypeByName('trafo', 'G-T25').id } }, { obs: rtkObs(519050, 4282000, 1055) });
  const p = ps.pointById(e.pointId);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
  for (let i = 1; i <= 3; i++) {
    const nm = nextPhotoName(ps.data.photos, e.id, e.no);
    assert.equal(nm.filename, 'D045_0' + i + '.jpg');
    const bytes = withExif(jpg, buildExif({ lat: p.lat, lon: p.lon, alt: p.H, accuracy: p.quality.sigmaH, description: ps.p.name + ' - ' + e.no, date: now() }));
    await ps.addPhoto(bytes, 'image/jpeg', { ownerId: e.id, ownerNo: e.no, ownerType: e.kind, pointId: p.id, filename: nm.filename, filepath: photoPath(e.kind, e.no, nm.filename), seq: nm.seq, lat: p.lat, lon: p.lon, elevation: p.H, accuracy: p.quality.sigmaH, fix: 'RTK FIX', operator: 'Test Operatör' });
  }
  const nt = nextPhotoName(ps.data.photos, tr.id, tr.no);
  await ps.addPhoto(jpg, 'image/jpeg', { ownerId: tr.id, ownerNo: tr.no, ownerType: 'transformer', filename: nt.filename, filepath: photoPath('transformer', tr.no, nt.filename) });
  assert.equal(photoPath('pole', 'D045', 'D045_01.jpg'), 'DIREKLER/D045/D045_01.jpg'); assert.equal(photoPath('transformer', 'TR001', 'TR001_01.jpg'), 'TRAFOLAR/TR001/TR001_01.jpg');
  assert.equal(photoPath('sdk', 'SDK001', 'a.jpg').split('/')[0], 'SDK'); assert.equal(photoPath('panel', 'PN-1', 'a.jpg').split('/')[0], 'PANOLAR'); assert.equal(photoPath('luminaire', 'AR-1', 'a.jpg').split('/')[0], 'ARMATURLER'); assert.equal(photoPath('line', 'K001', 'a.jpg').split('/')[0], 'KANALLAR');
  // EXIF: GPS IFD ve tarih yazıldı, JPEG bütünlüğü korunur
  const b0 = await ps.photoBytes(ps.data.photos[0]);
  const ex = extractExif(b0);
  assert.ok(ex && ex[0] === 0xff && ex[1] === 0xe1); assert.equal(b0[0], 0xff); assert.equal(b0[b0.length - 1], 0xd9);
  const exs = Buffer.from(ex).toString('latin1');
  assert.ok(exs.includes('Exif') && exs.includes('WGS-84') && exs.includes('2026:'), 'EXIF GPS + tarih');
  // Görüntü üstü satırlar: proje · obje no + tür · tarih saat · koordinat · doğruluk · fix
  const ol = overlayLines({ project: ps.p, ownerNo: e.no, kind: 'pole', when: now(), point: p, gnss: {}, operator: 'Test Operatör' });
  assert.equal(ol[0], ps.p.name); assert.match(ol[1], /D045 · Direk/); assert.match(ol[2], /2026/); assert.match(ol[3], /519000\.000.*4282000\.000.*1055\.000/); assert.match(ol[4], /±0\.009 m · RTK FIX/);
  // Model + rapor: fotoğraf sayısı
  const m = buildExportModel(ps);
  assert.equal(m.equipment.find((x) => x.id === e.id).photos, 3);
  const [pk] = await exportFormat(ps, 'package');
  const files = await unzip(pk.data), R = 'PROJECT_ELZ-2026-OG03/';
  for (const n of ['DIREKLER/D045/D045_01.jpg', 'DIREKLER/D045/D045_02.jpg', 'DIREKLER/D045/D045_03.jpg', 'TRAFOLAR/TR001/TR001_01.jpg']) assert.ok(files[R + n], n);
  const meta = new TextDecoder().decode(files[R + 'FOTOGRAFLAR/metadata.csv']);
  assert.ok(meta.includes('D045_02.jpg') && meta.includes('DIREKLER/D045/'));
  const objs = new TextDecoder().decode(files[R + 'SAHA_ALIMI/saha_objeleri.csv']);
  for (const k of ['object_type', 'object_number', 'coordinate_x', 'coordinate_system', 'source', 'device_id', 'accuracy', 'fix_type', 'satellite_count', 'hdop', 'vdop', 'pdop', 'operator_id', 'hakedis_status', 'progress']) assert.ok(objs.includes(k), k);
  assert.ok(objs.includes('GNSS_RTK') && objs.includes('CHC i73'));
});

test('33 · Yeni obje türleri: pano, armatür, menhol, diğer, kanal — poz, kontrol ve klasör; Sabit Base + Rover ölçüm kaydı', async () => {
  const { ps, gnss } = await setup(); await newProject(ps);
  const pano = await createObject(ps, { type: 'pano', coord: { E: 519000, N: 4282000, H: 1050 }, source: 'MANUAL', attrs: { servis: ps.cat.t.panels[0].servis, kva: ps.cat.t.panels[0].kva } });
  const arm = await createObject(ps, { type: 'armatur', typeText: '150 W Sodyum Buh. Ayd. Armatürü', obs: rtkObs(519020, 4282000, 1050) });
  const dig = await createObject(ps, { type: 'diger', typeText: 'Kamera direği', obs: rtkObs(519040, 4282000, 1050) });
  assert.equal(pano.equipment.kind, 'panel'); assert.match(pano.no, /^PN-/); assert.equal(arm.equipment.kind, 'luminaire'); assert.match(arm.no, /^AR-/); assert.match(dig.no, /^X-/);
  // Poz seçili türler metraja girer; pozsuz "diğer" yalnız uyarı üretir (hata değil)
  const mats = ps.result.matsByEq.get(arm.eqId);
  assert.equal(mats.items.length, 1); assert.equal(mats.items[0].servis, '020.05.01.01-003');
  assert.ok(ps.result.quantities.some((q) => q.servis === '020.05.01.01-003' && q.qty === 1));
  assert.ok(ps.result.quantities.some((q) => q.servis === ps.cat.t.panels[0].servis));
  const di = ps.result.issues.filter((i) => i.entityId === dig.eqId && i.code === 'MALZEME EKSİK');
  assert.equal(di.length, 1); assert.equal(di[0].severity, 'warn');
  assert.ok(!ps.result.issues.some((i) => i.entityId === arm.eqId && i.severity === 'error'));
  // Sabit Base + Rover: yöntem ve base bilgisi gözleme ve noktaya yazılır
  gnss.state.source = 'external'; gnss.state.receiver = { name: 'Meridian M20L', serial: 'M20L-7781' };
  gnss.setMethod('BASE_ROVER', { name: 'BASE-1', link: 'UHF radyo', E: 519500, N: 4282500, H: 1062.4, device: 'M20L #2' });
  assert.equal(gnss.methodOf(), 'BASE_ROVER'); assert.equal(gnss.snapshot().base.name, 'BASE-1');
  await feedEpochs(gnss, 7, 4, [0.006, 0.011]);
  const pr = gnss.observe({ critical: true, epochs: 3 });
  await feedEpochs(gnss, 3, 4, [0.006, 0.011]);
  const o = await pr;
  assert.equal(o.method, 'BASE_ROVER'); assert.equal(o.base.name, 'BASE-1'); assert.match(o.correctionSource, /Sabit base · UHF radyo · BASE-1/); assert.equal(o.rover.name, 'Meridian M20L');
  const sd = await createObject(ps, { type: 'sdk', obs: o });
  const sp = ps.pointById(sd.pointId);
  assert.equal(sp.method, 'BASE_ROVER'); assert.equal(sp.device, 'Meridian M20L'); assert.match(sp.correction, /BASE-1/);
  const saved = ps.data.gnssObservations.find((x) => x.id === sp.observationId);
  assert.equal(saved.base.E, 519500); assert.equal(saved.operator, 'Test Operatör');
  const html = new TextDecoder().decode((await exportFormat(ps, 'report'))[0].data);
  assert.ok(html.includes('BASE_ROVER') && html.includes('BASE-1') && html.includes('Meridian M20L'));
  gnss.setMethod(null); assert.equal(gnss.methodOf(), 'HARICI_GNSS');
});
