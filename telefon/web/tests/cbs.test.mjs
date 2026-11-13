// CBS dışa aktarımı (Google Earth KML / KMZ, MapInfo MIF / MID) eklentiyle aynı: ortak deneme ortak/deneme/cbs.
// Eklentinin CekirdekTest'i aynı proje dosyasından aynı beklenen dosyaları yazar (komut: cbs ortak/deneme/cbs/beklenen)
// ve karşılaştırır; burada telefonun yazdığı metinler aynı dosyalarla birebir karşılaştırılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SH from '../src/interop/sh-core.cjs';
import { cbsNesneleri, kmlMetni, mifDosyalari, mifCoordSys, netSayi, yuvarla, cp1254, KATMANLAR, sistemeCevir } from '../src/export/cbs.js';
import { makeCrs, unproject } from '../src/geo/crs.js';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../ortak/deneme/cbs');
const proje = () => SH.projeOku(fs.readFileSync(path.join(kok, 'deneme.sebeke.json'), 'utf8'));
const beklenen = (ad) => fs.readFileSync(path.join(kok, 'beklenen', ad), 'utf8');
/** İlk farklı satır (aynıysa null): hata iletisinde hangi satırın ayrıldığı görünsün. */
function ilkFark(a, b) {
  if (a === b) return null;
  const x = a.split('\n'), y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return (i + 1) + '. satır\n  beklenen: ' + x[i] + '\n  telefon : ' + y[i];
  return 'satır sonları';
}
const tm39 = makeCrs({ datum: 'TUREF', projection: 'TM3', cm: 39 });
const donustur = (E, N) => { const g = unproject(E, N, tm39); return [g.lon, g.lat]; };

test('C1 · .NET sayı yazımı ve yuvarlama eklentiyle aynı', () => {
  assert.equal(netSayi(512345.6785, 3), '512345.679', '15 anlamlı basamaktan sonra yarım yukarı (.NET)');
  assert.equal(netSayi(0.1 + 0.2, 8, true), '0.3');
  assert.equal(netSayi(40, 8, true), '40');
  assert.equal(netSayi(-45, 8, true), '-45');
  assert.equal(netSayi(1.235, 3, true, ','), '1,235');
  assert.equal(netSayi(0.000123456789, 8), '0.00012346');
  assert.equal(netSayi(9.9999999999, 3), '10.000', 'taşma');
  assert.equal(netSayi(-0.0000001, 3, true), '0');
  assert.equal(yuvarla(2.5, 0), 2, 'yarımda çift');
  assert.equal(yuvarla(3.5, 0), 4);
  assert.equal(yuvarla(-2.5, 0), -2);
  assert.equal(yuvarla(120.505, 2), 120.5, 'ikili gösterimde 120.50499…');
});

test('C2 · ortak deneme: telefonun KML ve MIF / MID metinleri eklentininkiyle birebir aynı', () => {
  const p = proje();
  const kml = kmlMetni(p, { donustur, surum: 'test', sistem: 'ITRF96 / TM 39 (3°)', tarih: 'TARIH' });
  const f = ilkFark(beklenen('deneme.kml'), kml);
  assert.equal(f, null, 'deneme.kml farklı: ' + f);
  const dosyalar = mifDosyalari(p, 'deneme', { coordSys: mifCoordSys(tm39) });
  assert.equal(dosyalar.length, 2 * KATMANLAR.length, 'bütün katmanlar (' + KATMANLAR.length + ') × (MIF + MID)');
  for (const d of dosyalar) {
    const fk = ilkFark(beklenen(d.name), d.text);
    assert.equal(fk, null, d.name + ' farklı: ' + fk);
    assert.ok(d.text.split('\n').slice(0, -1).every((s) => s.endsWith('\r')), d.name + ': satır sonları CRLF');
  }
  // Eklentinin CoordSys satırıyla aynı (ITRF96 3° TM, ölçek 1)
  assert.equal(mifCoordSys(tm39), 'CoordSys Earth Projection 8, 104, "m", 39, 0, 1, 500000, 0 Bounds (0, 3000000) (1000000, 5000000)');
});

test('C3 · nesneler: katmanlar, bölgesiz nesne, kısa sınır, Türkçe kod sayfası', () => {
  const p = proje();
  const n = cbsNesneleri(p);
  const say = (k) => n.filter((x) => x.katman === k).length;
  assert.deepEqual(KATMANLAR.map((k) => [k.ad, say(k)]), [['BOLGE', 2], ['DIREK', 5], ['TRAFO', 2], ['SDK', 1], ['PANO', 1], ['ELEMAN', 5], ['HAT', 7], ['KANAL', 2], ['SONDAJ', 1], ['NOKTA', 2], ['MALZEME', say(KATMANLAR[10])]],
    'eleman türü bazında katmanlar (31.10.2026); iki köşeli bölge sınırı yazılmaz');
  const pr = proje();
  const satir = pr.elemanlar.reduce((t, e) => t + (e.kalemler || []).length, 0) + ['hatlar', 'kanallar', 'sondajlar'].reduce((t, ad) => t + pr[ad].filter((x) => (x.kose || []).length >= 2).reduce((u, x) => u + (x.kalemler || []).length, 0), 0);
  assert.equal(say(KATMANLAR[10]), satir, 'bütün malzeme satırları MALZEME tablosunda');
  const b2 = n.find((x) => x.degerler[0] === 'B2');
  assert.equal(b2.kose.length, 4, 'kapanış köşesi tekrarlanmaz');
  assert.equal(n.find((x) => x.degerler[0] === 'E14').proje, '', 'bölgesiz eleman');
  assert.equal(n.find((x) => x.degerler[0] === 'E3').ad, 'Aydınlatma Direği', 'GIS no yoksa tür adı');
  // Türkçe Windows (1254): Ş İ ğ ı ş ü ve özel işaretler; olmayan karakter "?"
  assert.deepEqual([...cp1254('ŞİĞüıö·×…€→')], [0xde, 0xdd, 0xd0, 0xfc, 0xfd, 0xf6, 0xb7, 0xd7, 0x85, 0x80, 0x3f]);
  assert.equal(Buffer.from(cp1254('Version 300\r\n')).toString('latin1'), 'Version 300\r\n');
});

test('C4 · CoordSys: UTM, ED50, coğrafi ve yerel sistem', () => {
  assert.equal(mifCoordSys(makeCrs({ datum: 'WGS84', projection: 'UTM', zone: 37 })), 'CoordSys Earth Projection 8, 104, "m", 39, 0, 0.9996, 500000, 0 Bounds (0, 3000000) (1000000, 5000000)');
  assert.equal(mifCoordSys(makeCrs({ datum: 'ED50', projection: 'TM3', cm: 36 })), 'CoordSys Earth Projection 8, 28, "m", 36, 0, 1, 500000, 0 Bounds (0, 3000000) (1000000, 5000000)');
  assert.equal(mifCoordSys(makeCrs({ datum: 'WGS84', projection: 'GEO' })), 'CoordSys Earth Projection 1, 104');
  assert.match(mifCoordSys(Object.assign(makeCrs({ projection: 'TM3', cm: 39 }), { local: { a: 1, b: 0, tx: 0, ty: 0 } })), /^CoordSys NonEarth Units "m"/);
});

test('C5 · başka koordinat sistemine çevirme: köşeler, SAGA / YUKARI, çizim uzunluğu ve alan yeni sistemde; metraj aynı', () => {
  const n = cbsNesneleri(proje());
  const kay = (k) => [k[0] + 1000, k[1] * 2];
  const c = sistemeCevir(n, kay);
  const s = (x, ad) => x.degerler[x.katman.alanlar.findIndex((a) => a.ad === ad)];
  const e = c.find((x) => x.degerler[0] === 'E1'), e0 = n.find((x) => x.degerler[0] === 'E1');
  assert.deepEqual(e.kose[0], kay(e0.kose[0]));
  assert.deepEqual([s(e, 'SAGA'), s(e, 'YUKARI')], [yuvarla(e0.kose[0][0] + 1000, 3), yuvarla(e0.kose[0][1] * 2, 3)], 'SAGA / YUKARI');
  const h = c.find((x) => x.katman.ad === 'HAT' && x.degerler[0] === 'H3'), h0 = n.find((x) => x.katman.ad === 'HAT' && x.degerler[0] === 'H3');
  assert.equal(s(h, 'UZUNLUK'), 80, 'dik hat 40 m → 80 m (çizim uzunluğu yeni sistemde)');
  assert.equal(s(h, 'METRAJ'), s(h0, 'METRAJ'), 'metraj değişmez');
  const b = c.find((x) => x.katman.ad === 'BOLGE' && x.degerler[0] === 'B1'), b0 = n.find((x) => x.katman.ad === 'BOLGE' && x.degerler[0] === 'B1');
  assert.equal(s(b, 'ALAN'), 2 * s(b0, 'ALAN'), 'alan yeni sistemde');
  assert.notEqual(s(e0, 'SAGA'), s(e, 'SAGA'), 'asıl nesneler değişmez');
  assert.ok(c.filter((x) => x.katman.ad === 'MALZEME').every((x) => x.kose.length === 0), 'malzeme satırlarının yeri yok');
});

test('KMZ 3B klasörü: direkler zemine oturur (relativeToGround; mutlak kot Google Earth arazisinden farklıydı, 13.11.2026)', async () => {
  const { kml3BKlasoru } = await import('../src/export/gis.js');
  const model = {
    equipment: [
      { id: 'e1', no: 'SC1', pointId: 'p1', lat: 38.6, lon: 39.2, H: 1050, heightM: 10, state: 'YENI' },
      { id: 'e2', no: 'SC2', pointId: 'p2', lat: 38.6005, lon: 39.2005, H: 1052, heightM: 12, state: 'YENI' },
    ],
    lines: [{ no: 'H1', label: '3x50', install: 'havai', state: 'YENI', coords: [{ id: 'p1', lat: 38.6, lon: 39.2, H: 1050 }, { id: 'p2', lat: 38.6005, lon: 39.2005, H: 1052 }] }],
  };
  const k = kml3BKlasoru(model);
  assert.ok(!k.includes('absolute'), 'mutlak yükseklik yok');
  assert.equal((k.match(/relativeToGround/g) || []).length, 5, 'iki direk (nokta + gövde) ve iletken zemine göre');
  assert.ok(k.includes('39.2,38.6,0 39.2,38.6,8.400'), 'direk gövdesi zeminden (0) tepeye: 10 − (1 + 0,6) = 8,4 m');
  assert.ok(/39\.2,38\.6,7\.800 39\.2005,38\.6005,9\.600/.test(k), 'iletken direk tepesinin 0,6 m altından');
});
