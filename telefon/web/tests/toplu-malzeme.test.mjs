// Toplu malzeme (13.11.2026): seçilen / süzülen ekipmanların her birine aynı anda birden çok malzeme. AutoCAD'deki
// Toplu malzeme ve Eksik malzeme › Bulunanlara malzeme ekle ile aynı kural: objede zaten olan malzeme (istenirse)
// eklenmez, kilitli ve işi olmayan (mevcut / ileride) obje atlanır, otomatik reçete açıksa sahada ilave olarak girer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, newProject, buildPoleLine, rtkObs, route } from './helpers.mjs';

const ROUTE = route({ E: 519300, N: 4282100, H: 1050 }, [[60, 80, 2], [60, 80, 1], [120, 70, -1]]);
const TYPES = ['GD-10 (3 AWG)', 'GT-10 (3 AWG)', 'GT-10 (3 AWG)', 'GN-10 (3 AWG)'];
const OG = [{ role: 'OG', key: '3xSwallow', count: 1 }];
const ASKI = '011.06.04.01-001', MESNET = '011.04.01.01-006';
const canli = (ps, id) => ps.data.materials.filter((m) => m.ownerId === id && m.status !== 'deleted');

test('TM1 · birden çok malzeme her direğe; objede olan atlanır; mevcut obje atlanır; tek yeniden hesap', async () => {
  const { ps } = await setup(); await newProject(ps, { autoRecipe: false });
  const { poles } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: OG });
  await ps.addMaterial('equipment', poles[1].id, ASKI, 1, 'önceden');
  const mevcut = await ps.addEquipment('pole', { group: 'bahh', typeId: ps.cat.poleTypeByName('bahh', 'GT-10 (3 AWG)').id, state: 'MEVCUT' }, { obs: rtkObs(519600, 4282400, 1049) });
  let hesap = 0;
  const eski = ps.recompute.bind(ps);
  ps.recompute = async (...a) => { hesap++; return eski(...a); };
  const r = await ps.addMaterialsBulk([...poles.map((p) => p.id), mevcut.id], [{ servis: ASKI, qty: 2 }, { servis: MESNET, qty: 3 }], { varsaAtla: true });
  assert.equal(hesap, 1, 'tek yeniden hesap');
  assert.deepEqual(r, { eklenen: 7, ekipman: 4, atlanan: 1, kilitli: 0, issiz: 1 });
  assert.equal(canli(ps, poles[0].id).length, 2, 'ilk direğe iki malzeme');
  assert.equal(canli(ps, poles[1].id).filter((m) => m.servis === ASKI).length, 1, 'olan malzeme ikinci kez eklenmedi');
  assert.equal(canli(ps, mevcut.id).length, 0, 'mevcut direğe eklenmedi');
  const m0 = canli(ps, poles[0].id).find((m) => m.servis === MESNET);
  assert.equal(m0.qty, 3); assert.equal(m0.origin, 'MANUEL'); assert.equal(m0.approved, true);
  assert.ok(ps.hasMaterial(poles[0].id, MESNET), 'hesaplanan listede görünür');
  // Olanı atla kapalı: aynı malzeme yeniden eklenir
  const r2 = await ps.addMaterialsBulk([poles[0].id], [{ servis: ASKI, qty: 1 }], { varsaAtla: false });
  assert.equal(r2.eklenen, 1);
  assert.equal(canli(ps, poles[0].id).filter((m) => m.servis === ASKI).length, 2);
});

test('TM2 · otomatik reçete açık: sahada ilave (gerekçe zorunlu, onay bekler); süzgeç için hasMaterial', async () => {
  const { ps } = await setup(); await newProject(ps);
  const { poles } = await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: TYPES, circuits: OG });
  await assert.rejects(() => ps.addMaterialsBulk([poles[0].id], [{ servis: ASKI, qty: 1 }]), /gerekçe/);
  await assert.rejects(() => ps.addMaterialsBulk([poles[0].id], [], { reason: 'x' }), /malzeme yok/);
  const EK = '011.05.01.01-004';
  await ps.addMaterialsBulk([poles[0].id], [{ servis: EK, qty: 1 }], { reason: 'ilk direk' });
  const eksik = poles.filter((p) => !ps.hasMaterial(p.id, EK));
  assert.ok(eksik.length > 0 && eksik.length < poles.length, 'süzgeç: bir kısmında yok');
  const r = await ps.addMaterialsBulk(eksik.map((p) => p.id), [{ servis: EK, qty: 1 }], { reason: 'eksikti' });
  assert.equal(r.eklenen, eksik.length);
  for (const p of eksik) {
    const m = canli(ps, p.id).find((x) => x.servis === EK);
    assert.equal(m.origin, 'SAHADA_ILAVE'); assert.equal(m.approved, false); assert.equal(m.reason, 'eksikti');
  }
  assert.ok(poles.every((p) => ps.hasMaterial(p.id, EK)), 'artık hepsinde var');
});
