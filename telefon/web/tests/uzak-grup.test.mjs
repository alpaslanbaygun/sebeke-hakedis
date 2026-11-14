// Uzak nesne grubu: eklentiyle ortak deneme (ortak/deneme/uzak-grup/vektorler.json) ve proje verisinden uyarı
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grupla, uzakGruplar } from '../src/geo/uzak-grup.js';

const V = JSON.parse(readFileSync(new URL('../../../ortak/deneme/uzak-grup/vektorler.json', import.meta.url), 'utf8'));

test('UG1 ortak vektörler: eklentiyle aynı gruplar', () => {
  for (const d of V.durumlar) assert.deepEqual(grupla(d.nesneler, V.esik), d.beklenen, d.ad);
});

test('UG2 proje verisi: adı değiştirilen projenin eski alımları uzak grup', () => {
  const points = [], equipment = [], lines = [];
  const p = (id, E, N) => { points.push({ id, E, N }); return id; };
  for (let i = 0; i < 6; i++) { p('y' + i, 612000 + i * 40, 4401000); equipment.push({ id: 'ey' + i, pointId: 'y' + i, no: 'D-00' + i }); }
  for (let i = 0; i < 3; i++) { p('e' + i, 600500 + i * 20, 4391600); equipment.push({ id: 'ee' + i, pointId: 'e' + i, no: 'A-0' + i }); }
  lines.push({ id: 'h1', nodes: ['y0', 'y1', 'y2'] }, { id: 'h2', nodes: ['e0', 'e1'] });
  equipment.push({ id: 'sil', pointId: 'y0', status: 'deleted' });
  const r = uzakGruplar({ points, equipment, lines });
  assert.deepEqual(r.ekipman.map((e) => e.no), ['A-00', 'A-01', 'A-02']);
  assert.deepEqual(r.hatlar.map((l) => l.id), ['h2']);
  assert.ok(r.uzaklik > 13000 && r.uzaklik < 16000, 'uzaklık ' + r.uzaklik);
  assert.equal(uzakGruplar({ points: points.slice(0, 6), equipment: equipment.slice(0, 6), lines: [lines[0]] }), null, 'tek grup: uyarı yok');
});
