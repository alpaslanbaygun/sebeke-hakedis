// Hakediş onay görüntüsü (hata 6): onaylı dönemin fiyatı, tutarı ve sözleşme miktarı onay anına bağlıdır; sonradan
// değişen iş programı onaylı dönemi değiştirmez. Eski (fiyatsız) anlık görüntüler açıkça işaretlenir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, newProject, buildPoleLine, route } from './helpers.mjs';

const ROUTE = route({ E: 519300, N: 4282100, H: 1050 }, [[60, 80, 2], [60, 80, 1], [120, 70, -1]]);
const TYPES = ['GD-10 (3 AWG)', 'GT-10 (3 AWG)', 'GT-10 (3 AWG)', 'GN-10 (3 AWG)'];
const KG = '005.01.02.02-000';
const approx = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, (m || '') + ' · ' + a + ' ≠ ' + b);

async function fiyatla(ps, fiyat) {
  const wp = ps.activeProgram();
  const items = wp.items.map((i) => Object.assign({}, i, { unitPrice: fiyat }));
  await ps.ds.update('workPrograms', wp.id, { items }, { reason: 'deneme fiyatı' });
  await ps.reload('workPrograms');
  return ps.activeProgram();
}

test('H1 · onaylı dönemin fiyatı, tutarı ve sözleşme miktarı onay anında dondurulur; yeni iş programı yalnız açık dönemi etkiler', async () => {
  const { ps } = await setup(); await newProject(ps, { mode: 'tasarim' });
  const { poles } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await ps.createWorkProgram({ basis: 'Keşif' });
  const wp1 = await fiyatla(ps, 100);
  const sozlesme1 = wp1.items.find((i) => i.servis === KG).contractQty;
  for (const e of poles.slice(0, 3)) await ps.updateEquipment(e.id, { progress: 'done', workDate: '2026-09-15' }, 'montaj tamamlandı');
  const p1 = await ps.createPeriod({ start: '2026-09-01', end: '2026-09-30' });
  const t1 = ps.periodTable(p1.id);
  const l1 = t1.lines.find((l) => l.servis === KG);
  assert.equal(l1.unitPrice, 100); approx(l1.amount, Math.round(l1.current * 100 * 100) / 100, 'tutar = bu dönem × 100'); approx(l1.contract, sozlesme1);
  const toplam1 = t1.totals.amount;
  assert.ok(toplam1 > 0);
  await ps.approvePeriod(p1.id, '1. hakediş onayı');
  const onayli = ps.data.periods.find((p) => p.id === p1.id);
  assert.equal(onayli.status, 'onayli');
  const snap = onayli.snapshot.find((l) => l.key === l1.key);
  assert.equal(snap.unitPrice, 100); approx(snap.amount, l1.amount); approx(snap.contract, sozlesme1); assert.equal(snap.servis, KG);
  assert.equal(onayli.programId, wp1.id, 'onaylandığı iş programı kayıtlı');
  // Yeni iş programı: fiyat 200, sözleşme miktarı %10 fazla
  await ps.createWorkProgram({ basis: 'Revize', marginPct: 10 });
  const wp2 = await fiyatla(ps, 200);
  assert.notEqual(wp2.id, wp1.id);
  const sozlesme2 = wp2.items.find((i) => i.servis === KG).contractQty;
  assert.ok(Math.abs(sozlesme2 - sozlesme1) > 1e-6, 'sözleşme miktarı değişti');
  // Onaylı dönem: eski fiyat, eski tutar, eski sözleşme miktarı, eski toplam
  const t1b = ps.periodTable(p1.id);
  const l1b = t1b.lines.find((l) => l.servis === KG);
  assert.equal(l1b.unitPrice, 100, 'onaylı dönemin fiyatı değişmez');
  approx(l1b.amount, l1.amount, 'onaylı dönemin tutarı değişmez');
  approx(l1b.contract, sozlesme1, 'onaylı dönemin sözleşme miktarı değişmez');
  approx(l1b.remaining, sozlesme1 - l1b.cumulative, 'kalan eski sözleşmeye göre');
  approx(t1b.totals.amount, toplam1, 'onaylı dönemin toplamı değişmez');
  assert.equal(t1b.frozen, true); assert.equal(t1b.legacyPrices, false);
  // Açık dönem (2) yeni programı kullanır
  for (const e of poles.slice(3)) await ps.updateEquipment(e.id, { progress: 'done', workDate: '2026-10-10' }, 'montaj tamamlandı');
  const p2 = await ps.createPeriod({ start: '2026-10-01', end: '2026-10-31' });
  const t2 = ps.periodTable(p2.id);
  const l2 = t2.lines.find((l) => l.servis === KG);
  assert.equal(l2.unitPrice, 200); approx(l2.contract, sozlesme2); approx(l2.previous, l1.cumulative);
  approx(l2.amount, Math.round(l2.current * 200 * 100) / 100);
  assert.equal(t2.frozen, false);
});

test('H2 · eski (fiyatsız) anlık görüntü: fiyat güncel iş programından okunur ama tablo "eski görüntü" olarak işaretlenir ve onay anındaki toplam korunur', async () => {
  const { ps } = await setup(); await newProject(ps, { mode: 'tasarim' });
  const { poles } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  await ps.createWorkProgram({ basis: 'Keşif' });
  await fiyatla(ps, 100);
  for (const e of poles.slice(0, 3)) await ps.updateEquipment(e.id, { progress: 'done', workDate: '2026-09-15' }, 'montaj tamamlandı');
  const p1 = await ps.createPeriod({ start: '2026-09-01', end: '2026-09-30' });
  const toplam1 = ps.periodTable(p1.id).totals.amount;
  await ps.approvePeriod(p1.id);
  // Eski sürümün yazdığı görüntü: yalnız miktarlar (fiyat, tutar, sözleşme, programId yok)
  const per = ps.data.periods.find((p) => p.id === p1.id);
  const eski = per.snapshot.map(({ key, code, name, unit, job, cumulative, current, previous, sources }) => ({ key, code, name, unit, job, cumulative, current, previous, sources }));
  await ps.ds.update('periods', p1.id, { snapshot: eski, programId: null }, { reason: 'eski görüntü (deneme)' });
  await ps.reload('periods');
  await ps.createWorkProgram({ basis: 'Revize' }); await fiyatla(ps, 200);
  const t = ps.periodTable(p1.id);
  const l = t.lines.find((x) => x.servis === KG);
  assert.equal(t.frozen, true); assert.equal(t.legacyPrices, true, 'eski görüntü işareti');
  assert.equal(l.unitPrice, 200, 'satır fiyatı güncel programdan (donmuş fiyat yok)'); assert.equal(l.priceFrozen, false);
  approx(t.totals.amount, toplam1, 'onay anındaki toplam (dönem kaydındaki) korunur');
  assert.ok(Math.abs(t.lines.reduce((s, x) => s + (x.amount || 0), 0) - toplam1) > 1e-6, 'satır toplamı güncel fiyatla farklıdır; tablo bunu gizlemez');
  approx(t.totals.liveAmount, Math.round(t.lines.reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100);
});
