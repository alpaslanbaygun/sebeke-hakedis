// DXF çıktısının çizim görünümü: hat renkleri (ortak stil), Tahoma, yazılar hattın renginde, metraj açıklık başına.
// Eklentideki karşılıkları: CizimStili (renkler), CizimYazici.ParcaMetrajlariYaz + Geometri.Acikliklar (metraj).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDXF, spanTexts } from '../src/export/dxf.js';
import STIL from '../src/ortak/cizim-stili.js';

/** DXF metnini (grup kodu, değer) çiftlerine ayırıp varlıklara böler. */
function varliklar(metin) {
  const s = metin.split('\r\n');
  const out = [];
  let cur = null;
  for (let i = 0; i + 1 < s.length; i += 2) {
    const kod = s[i].trim(), deger = s[i + 1];
    if (kod === '0') { cur = { tur: deger, g: {} }; out.push(cur); continue; }
    if (cur) (cur.g[kod] = cur.g[kod] || []).push(deger);
  }
  return out;
}

test('D1 · açıklık metrajı: elemansız kırılma köşesinde bölünmez, elemanlı köşede bölünür; yazı en uzun parçada', () => {
  const c = [{ id: 'a', E: 0, N: 0 }, { id: 'b', E: 30, N: 0 }, { id: 'c', E: 30, N: 40 }, { id: 'd', E: 50, N: 40 }, { id: 'e', E: 50, N: 50 }];
  const tek = spanTexts(c, () => false);
  assert.equal(tek.length, 1);
  assert.equal(tek[0].length, 100);
  assert.equal(tek[0].seg, 1, 'en uzun parça 30→40');
  const iki = spanTexts(c, (p) => p.id === 'c');
  assert.deepEqual(iki.map((x) => [x.from, x.to, x.length]), [[0, 2, 70], [2, 4, 30]]);
});

test('D2 · DXF: hat türüne göre renk, yazılar hattın renginde, Tahoma, kırılma köşesinde metraj yok', () => {
  const points = [
    { id: 'p1', no: '1', E: 500000, N: 4400000, H: 0 }, { id: 'p2', no: '2', E: 500030, N: 4400000, H: 0 },
    { id: 'p3', no: '3', E: 500030, N: 4400040, H: 0 }, { id: 'p4', no: '4', E: 500060, N: 4400040, H: 0 },
  ];
  const coords = points.map((p) => ({ id: p.id, E: p.E, N: p.N, H: p.H }));
  const model = {
    project: { name: 'Deneme' }, crs: { label: 'TM30' }, cat: null, points,
    // Uçlarda SDK; p2 ve p3 elemansız kırılma köşesi
    equipment: [
      { id: 'e1', no: 'B1', kind: 'sdk', pointId: 'p1', E: points[0].E, N: points[0].N, H: 0, state: 'YENI', attrs: {} },
      { id: 'e2', no: 'B2', kind: 'sdk', pointId: 'p4', E: points[3].E, N: points[3].N, H: 0, state: 'YENI', attrs: {} },
    ],
    lines: [
      { id: 'l1', no: 'H1', lineType: 'OG', install: 'yeralti', state: 'YENI', label: '3x(1x240/25) Xlpe', coords },
      { id: 'l2', no: 'H2', lineType: 'AG', install: 'havai', state: 'YENI', label: '3x50 Alm.', coords: coords.slice(0, 2) },
    ],
  };
  const { text } = buildDXF(model);
  const v = varliklar(text);
  const stil = v.find((x) => x.tur === 'STYLE');
  assert.equal(stil.g['3'][0], 'tahoma.ttf', 'yazı tipi Tahoma');
  const cizgiler = v.filter((x) => x.tur === 'LINE');
  const ogKablo = STIL.katmanlar.KABLO_OG.aci, agHat = STIL.katmanlar.HAT_AG.aci;
  assert.equal(cizgiler.filter((x) => x.g['62'] && +x.g['62'][0] === ogKablo).length, 3, 'OG kablo kendi renginde');
  assert.equal(cizgiler.filter((x) => x.g['62'] && +x.g['62'][0] === agHat).length, 1, 'AG havai kendi renginde');
  assert.notEqual(ogKablo, STIL.katmanlar.HAT_OG.aci, 'OG kablo OG havaiden ayrı renk');
  const yazilar = v.filter((x) => x.tur === 'TEXT');
  const ogYazilari = yazilar.filter((x) => +(x.g['62'] || [0])[0] === ogKablo);
  // OG kablo: tek açıklık (SDK → SDK) → bir metraj + bir etiket
  assert.equal(ogYazilari.length, 2, 'OG kabloda bir metraj ve bir etiket, ikisi de hattın renginde');
  assert.ok(ogYazilari.some((x) => x.g['1'][0] === '100.00'), 'metraj iki SDK arası toplam: 30 + 40 + 30');
  assert.ok(ogYazilari.some((x) => x.g['1'][0].startsWith('H1 ')), 'etiket');
});
