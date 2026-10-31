// DXF çıktısının çizim görünümü: hat renkleri (ortak stil), Tahoma, yazılar hattın renginde, metraj açıklık başına.
// Eklentideki karşılıkları: CizimStili (renkler), CizimYazici.ParcaMetrajlariYaz + Geometri.Acikliklar (metraj).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDXF, spanTexts, yaziKonumu, yaziGenisligi, yaziSigdir, enUzunParca, boyutlar } from '../src/export/dxf.js';
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
  assert.deepEqual(yuvarla(yaziKonumu({ E: 0, N: 0 }, { E: 0, N: 10 }, ...STIL.etiketler.hat.kaydirma)), [0.7, 5, 90], 'dik: etiket sağda (üst kenarı 0,7 m ötede)');
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
  // Hizalama noktası (11/21): yazılar parçanın ortasına ortalı
  const yer = (x) => [+(+x.g['11'][0]).toFixed(3), +(+x.g['21'][0]).toFixed(3), +x.g['50'][0]];
  const kabloMetraj = renkli(kablo, 'TEXT').find((x) => x.g['1'][0] === '50.00');
  const kabloEtiket = renkli(kablo, 'TEXT').find((x) => x.g['1'][0].startsWith('H1 '));
  const kanalMetraj = renkli(kanal, 'TEXT').find((x) => x.g['1'][0] === '50.00');
  const pd = STIL.etiketler.parcaMetraji.kaydirma[1], hd = STIL.etiketler.hat.kaydirma[1];
  assert.deepEqual(yer(kabloMetraj), [500000 - pd, 4400025, 90], 'kablo metrajı çizginin solunda, parçanın ortasında');
  assert.deepEqual(yer(kabloEtiket), [500000 - hd, 4400025, 90], 'kablo etiketi çizginin sağında, parçanın ortasında');
  const kd = pd + STIL.yazi.parcaMetraji + STIL.etiketler.kaziMetraji.bosluk;
  assert.deepEqual(yer(kanalMetraj), [+(500000 - kd).toFixed(3), 4400025, 90], 'kanal metrajı kablonunkinin bir satır ötesinde');
  assert.equal(kabloMetraj.g['72'][0], '1', 'metraj ortalı');
  assert.equal(kabloMetraj.g['73'], undefined, 'metraj taban çizgisinden (73 yok = 0)');
  assert.equal(kabloEtiket.g['72'][0], '1', 'etiket ortalı');
  assert.equal(kabloEtiket.g['73'][0], '3', 'etiket üst kenarından');
  assert.ok(kd >= pd + STIL.yazi.parcaMetraji, 'iki metraj üst üste binmez');
});

test('D4 · yazı sığdırma ve boyutlar: eklentideki YaziDuzeni ile aynı sonuçlar; simge ve yazı boyutları projeden', () => {
  // CekirdekTest "yazılar parçanın ortasına ortalı, parçaya sığdırılmış" ile aynı durumlar
  assert.ok(Math.abs(yaziGenisligi('12.34', 1.44) - (0.57 * 4 + 0.36) * 1.44) < 1e-9, 'yazı genişliği harf tablosundan');
  assert.deepEqual(yaziSigdir('12.34', 1.44, 30), { h: 1.44, gk: 1 }, 'sığan yazı olduğu gibi kalır');
  const uzun = '^ 3x95+50 NYY Al', w = yaziGenisligi(uzun, 1.8);
  assert.deepEqual(yaziSigdir(uzun, 1.8, w / 0.9 * 0.8), { h: 1.8, gk: 0.8 }, 'biraz uzun yazı daraltılır');
  assert.deepEqual(yaziSigdir(uzun, 1.8, w / 0.9 * 0.3), { h: 1.08, gk: 0.6 }, 'çok uzun yazı en dar ve en küçük ölçüde');
  assert.deepEqual(yaziSigdir(uzun, 1.8, w / 0.9 * 0.48), { h: 1.44, gk: 0.6 }, 'daraltma yetmezse yükseklik küçülür');
  assert.equal(enUzunParca([{ E: 0, N: 0 }, { E: 30, N: 0 }, { E: 30, N: 40 }, { E: 50, N: 40 }, { E: 50, N: 50 }]), 1, 'etiket en uzun parçada');

  // Kısa hatta etiket ve metraj daraltılır; boyutlar projeden (simge 2 kat, yazılar 2,5 / 2 / 3 m)
  const points = [{ id: 'p1', no: '1', E: 500000, N: 4400000, H: 0 }, { id: 'p2', no: '2', E: 500006, N: 4400000, H: 0 }];
  const coords = points.map((p) => ({ id: p.id, E: p.E, N: p.N, H: p.H }));
  const model = {
    project: { name: 'Deneme', boyutlar: { simgeOlcegi: 2, etiketYuksekligi: 2.5, metrajYuksekligi: 2, elemanYaziYuksekligi: 3 } }, crs: { label: 'TM30' }, cat: null, points,
    equipment: points.map((p, i) => ({ id: 'e' + i, no: 'B' + (i + 1), kind: 'sdk', pointId: p.id, E: p.E, N: p.N, H: 0, state: 'YENI', attrs: {} })),
    lines: [{ id: 'l1', no: 'H1', lineType: 'AG', install: 'yeralti', state: 'YENI', label: '3x95+50 Nyy Alm.', coords }],
  };
  const v = varliklar(buildDXF(model).text);
  const yazilar = v.filter((x) => x.tur === 'TEXT');
  const etiket = yazilar.find((x) => x.g['1'][0].startsWith('H1 ')), metraj = yazilar.find((x) => x.g['1'][0] === '6.00');
  const es = yaziSigdir(etiket.g['1'][0], 2.5, 6);
  assert.equal(+etiket.g['41'][0], es.gk, 'etiket parçaya sığsın diye daraltılmış');
  assert.equal(+etiket.g['40'][0], es.h, 'etiket yüksekliği (gerekirse küçültülmüş)');
  assert.ok(yaziGenisligi(etiket.g['1'][0], es.h, es.gk) <= 6 * 0.9 + 1e-9 || es.h === 1.5, 'etiket parçaya sığıyor (ya da en küçük ölçüde)');
  assert.equal(+metraj.g['40'][0], 2, 'metraj yüksekliği projeden');
  const ins = v.filter((x) => x.tur === 'INSERT');
  assert.ok(ins.length === 2 && ins.every((x) => +x.g['41'][0] === 2 && +x.g['42'][0] === 2), 'simgeler 2 kat');
  const eleman = yazilar.find((x) => x.g['1'][0].startsWith('B1'));
  assert.equal(+eleman.g['40'][0], 3, 'eleman yazısı yüksekliği projeden');
  assert.equal(+eleman.g['10'][0], 500000 + STIL.etiketler.eleman.kaydirma[0] * 2, 'eleman yazısı simgeyle birlikte dışarı kayar');
  // Varsayılanlar ortak stilden; bozuk değer varsayılana döner
  assert.deepEqual(boyutlar({}), { simge: 1, etiket: 1.8, metraj: 1.44, eleman: 1.8 });
  assert.deepEqual(boyutlar({ boyutlar: { simgeOlcegi: 0, etiketYuksekligi: 'x' } }), { simge: 1, etiket: 1.8, metraj: 1.44, eleman: 1.8 });
});

test('D5 · kanal kenarları: eksenin iki yanında genişliğin yarısı kadar, sürekli çizgi, kanalın renginde; sondajda ve havai hatta yok', async () => {
  // Eklentideki karşılığı: NesneYazici.KanalGenisligi (genişlik yoksa 0,4 m) + CizimYazici.KenarlariYaz
  const { kanalGenisligi, esCizgi } = await import('../src/export/dxf.js');
  assert.equal(kanalGenisligi({ install: 'havai' }), 0, 'havai hatta kanal yok');
  assert.equal(kanalGenisligi({ install: 'yeralti', cable: { surface: 'toprak', method: 'sondaj' } }), 0, 'yatay sondajda kenar yok');
  assert.equal(kanalGenisligi({ install: 'yeralti', cable: { channelType: 'direk' } }), 0, 'kazısız eski kayıt (direk inişi)');
  assert.equal(kanalGenisligi({ install: 'yeralti', cable: { surface: 'asfalt', method: 'acik', width: 0.6 } }), 0.6);
  assert.equal(kanalGenisligi({ install: 'yeralti', cable: { surface: 'toprak', method: 'acik' } }), STIL.katmanlar.KANAL.kenar.varsayilanGenislik, 'genişlik yoksa stilin varsayılanı');
  // Gönye: L köşede kenar köşesi iki kenarın kesişiminde
  const e = esCizgi([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 0.5);
  assert.deepEqual(e.map((p) => [+p.x.toFixed(6), +p.y.toFixed(6)]), [[0, 0.5], [9.5, 0.5], [9.5, 10]]);

  const points = [{ id: 'p1', no: '1', E: 500000, N: 4400000, H: 0 }, { id: 'p2', no: '2', E: 500040, N: 4400000, H: 0 }];
  const coords = points.map((p) => ({ id: p.id, E: p.E, N: p.N, H: p.H }));
  const model = {
    project: { name: 'Deneme' }, crs: { label: 'TM30' }, cat: null, points,
    equipment: points.map((p, i) => ({ id: 'e' + i, no: 'B' + (i + 1), kind: 'sdk', pointId: p.id, E: p.E, N: p.N, H: 0, state: 'YENI', attrs: {} })),
    lines: [
      { id: 'l1', no: 'K1', lineType: 'AG', install: 'yeralti', state: 'YENI', channelOnly: true, label: 'Kanal', cable: { surface: 'toprak', method: 'acik', width: 0.5 }, coords },
      { id: 'l2', no: 'S1', lineType: 'OG', install: 'yeralti', state: 'YENI', channelOnly: true, label: 'Sondaj', cable: { surface: 'toprak', method: 'sondaj' }, coords },
      { id: 'l3', no: 'H1', lineType: 'AG', install: 'havai', state: 'DEMONTAJ', label: '3P+R', coords },
      { id: 'l4', no: 'K2', lineType: 'AG', install: 'yeralti', state: 'DEMONTAJ', label: '4x50 Nyy', cable: { surface: 'asfalt', method: 'borulu', width: 0.4 }, coords },
    ],
  };
  const d = buildDXF(model);
  const v = varliklar(d.text);
  // Bloklardaki POLYLINE'lar katman 0'da; kenarlar kanalın katmanında
  const kenarlar = v.filter((x) => x.tur === 'POLYLINE' && x.g['8'][0] === STIL.katmanlar.KANAL.telefon);
  assert.equal(kenarlar.length, 4, 'iki kanal × iki kenar (sondaj ve havai hatta yok)');
  assert.equal(d.stats.edges, 4);
  assert.ok(kenarlar.every((x) => x.g['6'][0] === STIL.katmanlar.KANAL.kenar.cizgi), 'kenar sürekli çizgi (katmanın kesikli çizgisi değil)');
  assert.deepEqual(kenarlar.map((x) => +x.g['62'][0]), [STIL.katmanlar.KANAL.kenar.aci, STIL.katmanlar.KANAL.kenar.aci, STIL.direkRenkleri.demontaj, STIL.direkRenkleri.demontaj], 'kanalın renginde, demontajda sarı');
  // İlk kenarın köşeleri: eksenden 0,25 m yukarıda
  const i = v.indexOf(kenarlar[0]);
  const koseler = v.slice(i + 1, i + 3).map((x) => [+x.g['10'][0], +x.g['20'][0]]);
  assert.deepEqual(koseler, [[500000, 4400000.25], [500040, 4400000.25]]);
});
