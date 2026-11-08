// Önerilen direk tipi (TEDAŞ tepe kuvveti tablosu; ortak/hesap/kurallar.mjs › direkOner — eski aracın seçim kuralı)
import test from 'node:test';
import assert from 'node:assert/strict';
import { direkOner, DIREK_TABLOLARI } from '../../../ortak/hesap/kurallar.mjs';

test('DO1 · düz AG hat: taşıyıcıda kopma yok → 9-H; durdurucuda tek yanlı çekme (kopma) → K1', () => {
  const vek = [{ guc: 300, derece: 0 }, { guc: 300, derece: 180 }];
  const t = direkOner({ konum: 'ag', rol: 'T', vektorler: vek });
  assert.equal(t.tip, '9-H'); assert.equal(t.maxL, 0); assert.equal(t.maxR, 0); assert.equal(t.senaryolar.length, 1);
  const d = direkOner({ konum: 'ag', rol: 'D', vektorler: vek });
  assert.equal(d.maxL, 300, 'kopan hattın karşısı tek yanlı çeker');
  assert.equal(d.B30, 300);
  assert.equal(d.tip, 'K1', 'L 300 ≥ 230: I / U direkler düşer, B30 300 ≤ 1000 → K1');
  assert.equal(d.senaryolar.length, 3);
  assert.equal(d.trafoDirek, 'T-15');
  assert.equal(d.agacDirek, 'demir direk seçiniz', 'N = 300 ≥ 259: ağaç direk olmaz');
  assert.equal(t.agacDirek, '9O', 'taşıyıcıda N = 0 < 174');
});

test('DO2 · köşe direği: enine kuvvet tabloyu belirler; müşterek tablo ayrı; potans yükü en kötü senaryoya eklenir', () => {
  // 30° sapmalı köşe: 200 kg @0° ve 200 kg @210° → sağlam: Rx = 200·sin210 = −100, Ry = 200 + 200·cos210 = 26,8 → L 26,8 · R 100
  const vek = [{ guc: 200, derece: 0 }, { guc: 200, derece: 210 }];
  const a = direkOner({ konum: 'ag', rol: 'K', vektorler: vek });
  assert.equal(a.senaryolar[0].L, 26.8); assert.equal(a.senaryolar[0].R, 100);
  assert.equal(a.maxL, 200, 'kopmada karşı hat 200 kg boyuna');
  assert.equal(a.maxR, 100);
  assert.equal(a.tip, '10U', 'L 200 ≥ 160 → 9-H / 10I düşer; L < 230 ve R 100 < 700 → 10U');
  assert.equal(a.B30, 273.2, 'en kötü: Hat 1 kopması → kalan 200 kg @210°: L 173,2 + R 100 = 273,2');
  assert.equal(a.senaryo, 'Hat 1 kopması');
  const m = direkOner({ konum: 'mus', rol: 'K', vektorler: vek });
  assert.ok(DIREK_TABLOLARI.mus.includes(m.tip), 'müşterek tablodan: ' + m.tip);
  const p = direkOner({ konum: 'ag', rol: 'K', vektorler: vek, potans: 500 });
  assert.equal(p.maxR, a.maxR + 500);
});

test('DO3 · projedeki tip tabloya göre yeterli mi; tablo olmayan direk (ENH) için tip yok', () => {
  const vek = [{ guc: 300, derece: 0 }, { guc: 300, derece: 180 }];
  const k = direkOner({ konum: 'ag', rol: 'D', vektorler: vek, mevcutTip: 'G-10I' });
  assert.equal(k.karsilastirma.durum, 'yetersiz');
  assert.equal(direkOner({ konum: 'ag', rol: 'D', vektorler: vek, mevcutTip: 'G-K3' }).karsilastirma.durum, 'yeterli');
  assert.equal(direkOner({ konum: 'ag', rol: 'D', vektorler: vek, mevcutTip: '9,3/2' }).karsilastirma.durum, 'bilinmiyor');
  assert.equal(direkOner({ konum: 'mus', rol: 'D', vektorler: vek, mevcutTip: 'G-K2"' }).karsilastirma.mevcut, 'G-K2"');
  const enh = direkOner({ konum: null, rol: 'D', vektorler: vek });
  assert.equal(enh.tip, null); assert.equal(enh.tablo, null); assert.equal(enh.trafoDirek, null);
  assert.equal(direkOner({ konum: 'ag', vektorler: [] }), null);
});
