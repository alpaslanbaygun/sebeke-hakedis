// DXF çıktısının çizim görünümü: hat renkleri (ortak stil), Tahoma, yazılar hattın renginde, metraj açıklık başına.
// Eklentideki karşılıkları: CizimStili (renkler), CizimYazici.ParcaMetrajlariYaz + Geometri.Acikliklar (metraj).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDXF, spanTexts, yaziKonumu } from '../src/export/dxf.js';
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

test('D3 · yazı yeri parçanın ekseninde: dik hatta metraj bir yanda, etiket öbür yanda; kanal metrajı bir satır yukarıda', () => {
  // Eklentideki Geometri.YaziKonumu ile aynı sonuçlar (CekirdekTest "yazı yeri")
  const yuvarla = (k) => [+k.x.toFixed(3), +k.y.toFixed(3), +k.ang.toFixed(1)];
  assert.deepEqual(yuvarla(yaziKonumu({ E: 0, N: 0 }, { E: 10, N: 0 }, 0, 0.8)), [5, 0.8, 0], 'yatay: 0.8 m üstte');
  assert.deepEqual(yuvarla(yaziKonumu({ E: 10, N: 0 }, { E: 0, N: 0 }, 0, 0.8)), [5, 0.8, 0], 'ters çizilmiş yatay: aynı');
  assert.deepEqual(yuvarla(yaziKonumu({ E: 0, N: 0 }, { E: 0, N: 10 }, 0, 0.8)), [-0.8, 5, 90], 'dik: metraj solda');
  assert.deepEqual(yuvarla(yaziKonumu({ E: 0, N: 0 }, { E: 0, N: 10 }, ...STIL.etiketler.hat.kaydirma)), [2.5, 5, 90], 'dik: etiket sağda');
  assert.deepEqual(yuvarla(yaziKonumu({ E: 0, N: 0 }, { E: 10, N: 10 }, 1, 0)), [5.707, 5.707, 45], 'boyunca kaydırma parça doğrultusunda');

  // DXF: SDK → SDK dik AG kablo ve aynı yoldan kablosuz kanal
  const points = [{ id: 'p1', no: '1', E: 500000, N: 4400000, H: 0 }, { id: 'p2', no: '2', E: 500000, N: 4400050, H: 0 }];
  const coords = points.map((p) => ({ id: p.id, E: p.E, N: p.N, H: p.H }));
  const model = {
    project: { name: 'Deneme' }, crs: { label: 'TM30' }, cat: null, points,
    equipment: points.map((p, i) => ({ id: 'e' + i, no: 'B' + (i + 1), kind: 'sdk', pointId: p.id, E: p.E, N: p.N, H: 0, state: 'YENI', attrs: {} })),
    lines: [
      { id: 'l1', no: 'H1', lineType: 'AG', install: 'yeralti', state: 'YENI', label: '3x95+50 Nyy Alm.', coords },
      { id: 'l2', no: 'K1', lineType: 'AG', install: 'yeralti', state: 'YENI', channelOnly: true, label: 'Kanal / kazı (kablosuz)', cable: { method: 'acik' }, coords },
    ],
  };
  const v = varliklar(buildDXF(model).text);
  const kablo = STIL.katmanlar.KABLO.aci, kanal = STIL.katmanlar.KANAL.aci;
  const renkli = (r, tur) => v.filter((x) => x.tur === tur && +(x.g['62'] || [0])[0] === r);
  assert.equal(renkli(kanal, 'LINE').length, 1, 'kanal kablo renginde değil, kendi renginde');
  assert.equal(renkli(kanal, 'LINE')[0].g['6'][0], STIL.katmanlar.KANAL.cizgi, 'kanal kendi çizgi tipinde');
  const yer = (x) => [+x.g['10'][0], +x.g['20'][0], +x.g['50'][0]];
  const kabloMetraj = renkli(kablo, 'TEXT').find((x) => x.g['1'][0] === '50.00');
  const kabloEtiket = renkli(kablo, 'TEXT').find((x) => x.g['1'][0].startsWith('H1 '));
  const kanalMetraj = renkli(kanal, 'TEXT').find((x) => x.g['1'][0] === '50.00');
  assert.deepEqual(yer(kabloMetraj), [500000 - STIL.etiketler.parcaMetraji.kaydirma[1], 4400025, 90], 'kablo metrajı çizginin solunda');
  assert.deepEqual(yer(kabloEtiket), [500000 - STIL.etiketler.hat.kaydirma[1], 4400025, 90], 'kablo etiketi çizginin sağında');
  assert.deepEqual(yer(kanalMetraj), [500000 - STIL.etiketler.kaziMetraji.kaydirma[1], 4400025, 90], 'kanal metrajı kablonunkinin bir satır ötesinde');
  assert.ok(STIL.etiketler.kaziMetraji.kaydirma[1] >= STIL.etiketler.parcaMetraji.kaydirma[1] + STIL.yazi.parcaMetraji, 'iki metraj üst üste binmez');
});
