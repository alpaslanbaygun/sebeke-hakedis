// Telefonun hesap çekirdeği testleri (Node 18+): node android/araclar/cekirdek-test.js
// Örnek veri elle hazırlanmıştır (ornek-proje.sebeke.json); gerçek proje verisi depoya konmaz.
// Beklenen değerler AutoCAD eklentisinin C# çekirdeğiyle aynı kurallardan elle hesaplanmıştır.
'use strict';
const fs = require('fs');
const path = require('path');
const UI = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'ui');
const SH = require(path.join(UI, 'sh-core.js'));
const SHX = require(path.join(UI, 'sh-xlsx.js'));
const KATALOG = path.join(__dirname, '..', '..', 'ortak', 'katalog');

let gecen = 0;
let kalan = 0;
function dene(ad, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.then(() => { gecen++; console.log('  ✓ ' + ad); }, e => { kalan++; console.log('  ✗ ' + ad + ': ' + e.message); });
    gecen++;
    console.log('  ✓ ' + ad);
  } catch (e) {
    kalan++;
    console.log('  ✗ ' + ad + ': ' + (e && e.stack || e));
  }
  return Promise.resolve();
}
function esit(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' beklenen ' + JSON.stringify(b) + ', bulunan ' + JSON.stringify(a)); }
function yakin(a, b, tol, msg) { if (!(Math.abs(a - b) <= (tol || 1e-9))) throw new Error((msg || '') + ' beklenen ' + b + ', bulunan ' + a); }
function dogru(v, msg) { if (!v) throw new Error(msg || 'yanlış'); }

const kat = SH.katsayiHazirla(JSON.parse(fs.readFileSync(path.join(KATALOG, 'katsayilar.json'), 'utf8')));
const katalogJson = JSON.parse(fs.readFileSync(path.join(KATALOG, 'kalemler.json'), 'utf8'));
const ornekMetin = fs.readFileSync(path.join(__dirname, 'ornek-proje.sebeke.json'), 'utf8');
const yukle = () => SH.projeOku(ornekMetin);

(async () => {
  console.log('Şebeke Hakediş — telefon hesap çekirdeği testleri');

  await dene('proje dosyası okunur, uzunluklar hesaplanır', () => {
    const p = yukle();
    esit(p.bolgeler.length, 2);
    esit(p.elemanlar.length, 3);
    esit(p.hatlar.length, 2);
    esit(p.kanallar[0].kablolar, 'OG/AG');
    yakin(p.hatlar[0].cizimUzunlugu, Math.hypot(70, 70), 1e-9);
    esit(p.proje.koordinat.dom, 39);
    esit(p.proje.gisOnEki, 'SC');
    let hata = null;
    try { SH.projeOku('{"bicim":"baska"}'); } catch (e) { hata = e; }
    dogru(hata, 'yanlış biçim reddedilmeli');
  });

  await dene('bölge: içindeki en küçük, yoksa en yakın', () => {
    const p = yukle();
    esit(SH.bolgeSec([519050, 4282050], p.bolgeler).id, 'B1');
    esit(SH.bolgeSec([519120, 4282120], p.bolgeler).id, 'B2');
    esit(SH.bolgeSec([519300, 4282300], p.bolgeler).id, 'B1');
    esit(SH.bolgeSec([519120, 4282120], []), null);
  });

  await dene('Durum Tespit: satırlar, iletken açılımı, kanal paylaşımı', () => {
    const p = yukle();
    const r = SH.durumTespit(p, kat);
    esit(r.length, 13, 'satır sayısı');
    const aster = r.find(s => s.cins === 'AL_İLETKENLER' && s.tip === 'ASTER');
    yakin(aster.miktar, 300);
    yakin(aster.toplam, 56.295, 1e-9);
    esit(aster.birim, 'mt/kg');
    esit(aster.dmDurum, '');
    const sw = r.find(s => s.tip === 'SWALLOW');
    yakin(sw.miktar, 150);
    yakin(sw.toplam, 16.494, 1e-9);
    yakin(sw.tutar, 41.24, 1e-9, 'tutar = toplam × birim fiyat (2 hane)');
    const kanal = r.filter(s => s.cins === 'KABLO_KANALI');
    esit(kanal.length, 2);
    esit(kanal.map(s => s.malzemeTarife).join(','), '0104,0105');
    yakin(kanal[0].toplam, 10);
    esit(kanal[0].tip, 'TOPRAK');
    esit(kanal[0].kontrol, 'True', 'kanalın kontrolü yoksa kalemin');
    const dm = r.find(s => s.handle === 'E2');
    esit(dm.dmDurum, 'KESİK');
    esit(dm.proje, 'ELAZIĞ AYDINLATMA');
    esit(dm.bolgeTarife, '23.01.01.01.00002');
    esit(r.find(s => s.handle === 'E3').kontrol, '', 'boş kontrol');
    const kg = r.reduce((t, s) => t + (s.birim.endsWith('/kg') ? s.toplam : 0), 0);
    yakin(kg, 504 + 36.946 + 209 + 5.915 + 11.832 + 56.295 + 16.494, 1e-6);
    // Sıralama: proje adı, hakediş, INDEX
    esit(r[0].proje, 'ELAZIĞ AYDINLATMA');
    for (let i = 2; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      dogru(SH.ordinal(a.proje, b.proje) < 0 || (a.proje === b.proje && (a.hakedis < b.hakedis || (a.hakedis === b.hakedis && SH.siraKarsilastir(a.index, b.index) <= 0))), 'sıra ' + i);
    }
  });

  await dene('Özet ve süzme', () => {
    const p = yukle();
    const r = SH.durumTespit(p, kat);
    const o = SH.ozet(r);
    const kanal = o.filter(x => x.cins === 'KABLO_KANALI');
    esit(kanal.length, 1, 'iki pay aynı gruba toplanır');
    yakin(kanal[0].toplam, 20);
    esit(kanal[0].satir, 2);
    esit(SH.satirSuz(r, p, 2, null).length, 4, 'E3 + H2 (hat + SWALLOW) + S1');
    esit(SH.satirSuz(r, p, null, 'B2').length, 1);
  });

  await dene('Dosyaya yaz → oku: rapor aynı kalır, ek alanlar korunur', () => {
    const p = yukle();
    p.elemanlar[0].not = 'köşe direği';
    p.elemanlar[0].fotolar = ['E1_1.jpg'];
    p.elemanlar[0]._kutu = [1, 2, 3, 4];
    const metin = SH.projeYaz(p, 'test');
    const j = JSON.parse(metin);
    esit(Object.keys(j).slice(0, 4).join(','), 'bicim,surum,olusturan,olusturma');
    esit(Object.keys(j.elemanlar[0])[0], 'id');
    esit(j.elemanlar[0].not, 'köşe direği');
    esit(j.elemanlar[0]._kutu, undefined, 'çalışma alanları yazılmaz');
    esit(j.hatlar[0].cizimUzunlugu, SH.temiz(Math.hypot(70, 70), 3));
    const p2 = SH.projeOku(metin);
    esit(JSON.stringify(SH.durumTespit(p2, kat)), JSON.stringify(SH.durumTespit(yukle(), kat)));
  });

  await dene('Değişiklik günlüğü: koy / sil iki kez uygulansa da aynı sonuç', () => {
    const p = yukle();
    const ix = SH.indeksYap(p);
    const yeni = { id: 'T1', tur: 'AG_DIREK', gisId: 'SC8', saga: 519060, yukari: 4282060, kalemler: [] };
    const d1 = { t: 1, ops: [{ k: 'elemanlar', put: yeni }, { k: 'proje', set: { aktifHakedis: 3 } }] };
    SH.degisiklikUygula(p, d1, ix);
    SH.degisiklikUygula(p, JSON.parse(JSON.stringify(d1)), ix);
    esit(p.elemanlar.length, 4);
    esit(p.proje.aktifHakedis, 3);
    esit(ix.elemanlar.get('T1').gisId, 'SC8');
    SH.degisiklikUygula(p, { ops: [{ k: 'hatlar', put: { id: 'H1', tur: 'AG_HAVAI', kose: [[0, 0], [3, 4]], kalemler: [] } }] }, ix);
    esit(p.hatlar.length, 2);
    esit(p.hatlar[0].cizimUzunlugu, 5);
    const d2 = { ops: [{ k: 'elemanlar', del: 'T1' }] };
    SH.degisiklikUygula(p, d2, ix);
    SH.degisiklikUygula(p, d2, ix);
    esit(p.elemanlar.length, 3);
    esit(ix.elemanlar.has('T1'), false);
  });

  await dene('GIS numarası', () => {
    const p = yukle();
    esit(SH.sonrakiGis(p, 'AG_DIREK', 'SC'), 'SC8');
    esit(SH.sonrakiGis(p, 'AYD_DIREK', 'SC'), 'SC8', 'direkler aynı sırayı paylaşır');
    esit(SH.sonrakiGis(p, 'BOX', 'SC'), 'SCB04');
    esit(SH.sonrakiGis(p, 'PANO', 'SC'), 'SCP01');
    esit(SH.sonrakiGis(p, 'TRAFO_DIREGI', 'SC'), 'SCTR01');
    esit(SH.sonrakiGis(p, 'EK_MUFU', 'SC', 'EK_MUFU_OG_ALM'), 'EKOG');
    esit(SH.sonrakiGis(p, 'EK_MUFU', 'SC', 'EK_MUFU_AG_ALM'), 'EKAG');
    esit(SH.sonrakiGis(p, 'KOFRE', 'SC'), '');
  });

  await dene('Hat metrajı ve etiketi', () => {
    esit(SH.hatMetraji(98.99, 'AG_HAVAI'), 99);
    esit(SH.hatMetraji(99.0000001, 'AG_HAVAI'), 99);
    esit(SH.hatMetraji(14.2, 'REKORTMAN', { ekPay: { REKORTMAN: 2 } }), 17);
    esit(SH.hatMetraji(14.2, 'AG_HAVAI', { yukariYuvarla: false }), 14);
    esit(SH.hatEtiketi('M', '3X50/16+70 ALPEK', 341), '^ 3X50/16+70 ALPEK/341m');
    esit(SH.hatEtiketi('M+M', '2x6 Nym (Ç.K.) Cu', 15), '* 2x6 Nym (Ç.K.) Cu/15m');
    esit(SH.hatEtiketi('DM', '5R', 42), '>5R</42m');
    esit(SH.hatEtiketi('DM+M', '3X35/16+50 ALPEK', 7), '[3X35/16+50 ALPEK]/7m');
    esit(SH.hatEtiketi('MEVCUT', '3xSW', 10.5), '(3xSW)/10,5m');
  });

  await dene('Kanal kodu, kablolar, hacim', () => {
    esit(SH.kanalKodu(true, true, false, false), 12);
    esit(SH.kanalKablolari(12), 'OG/AG');
    esit(SH.kanalKablolari(6), '/AG/AYD');
    esit(SH.kanalKablolari(15), 'OG/AG/AYD/REK');
    yakin(SH.kanalHacmi(170, 170, 100, 21), 35.7, 1e-9);
    yakin(SH.kanalHacmi('40', '60', '80', '10'), 4, 1e-9);
    esit(SH.kanalUnsurlari('0104').join(','), '0104,0105');
    esit(SH.kanalUnsurlari('0207').join(','), '0206,0207');
  });

  await dene('TM projeksiyonu (pyproj ile karşılaştırma, ITRF96)', () => {
    const ref = [[36, 38.4512345, 35.4523456, 452194.2322, 4257727.4655], [39, 38.674321, 39.2234567, 519445.6861, 4282373.2807],
      [33, 39.9208, 32.8541, 487526.6517, 4420745.3391], [45, 39.9, 44.1, 423032.9682, 4418813.4353]];
    for (const [dom, lat, lon, e, n] of ref) {
      const [x, y] = SH.tmIleri(lat, lon, dom);
      yakin(x, e, 0.001, 'sağa');
      yakin(y, n, 0.001, 'yukarı');
      const [la, lo] = SH.tmGeri(x, y, dom);
      yakin(la, lat, 1e-8);
      yakin(lo, lon, 1e-8);
    }
    esit(SH.domBoylamdan(39.22), 39);
    esit(SH.domBoylamdan(35.45), 36);
    const kutu = SH.projeKutusu(yukle());
    esit(SH.domTahmin(38.674321, 39.2234567, kutu), 39);
    esit(SH.domTahmin(41.0, 29.0, kutu), null);
  });

  await dene('Katalog: direk tipleri, hat kesitleri, kalem', () => {
    const p = yukle();
    const k = SH.katalogHazirla(katalogJson, p);
    const tipler = SH.anaTipler(k, 'AG_DIREK').map(x => x.tanim);
    dogru(tipler.indexOf('G-K2') >= 0, 'G-K2 yok');
    dogru(tipler.indexOf('G-10I') >= 0, 'G-10I yok');
    const kesit = SH.hatKesitleri(k, 'AG_HAVAI').map(x => x.tanim);
    dogru(kesit.indexOf('3X50/16+70 ALPEK') >= 0, 'ALPEK kesiti yok');
    dogru(SH.hatKesitleri(k, 'OG_HAVAI').some(x => x.tanim === '3xSW'), 'OG kesiti yok');
    const it = k.find(x => x.tanim === 'G-K2' && x.cins === 'AG_DEMİR_GLV');
    const kl = SH.kalemYap(it, { miktar: '2', durum: 'M', hakedis: 3, ana: true, kaynak: 'NIT', sira: 18 });
    esit(kl.toplam, 2 * it.katsayi);
    esit(kl.sira, '18');
    esit(kl.ana, true);
    esit(SH.enBuyukSira(p), 17);
    const kanal = { altGenislik: 40, ustGenislik: 40, derinlik: 100 };
    const kk = { ana: true, miktar: 25 };
    esit(SH.kalemToplami(kk, kanal).toplam, 10);
  });

  await dene('Sayı okuma ve yazma', () => {
    yakin(SH.sayi('16,8'), 16.8);
    yakin(SH.sayi(',5'), 0.5);
    yakin(SH.sayi('1.234,5'), 1234.5);
    yakin(SH.sayi('10.5'), 10.5);
    dogru(Number.isNaN(SH.sayi('abc')));
    esit(SH.tr(1540966.1, 1), '1.540.966,1');
    esit(SH.tr(0.5, 2), '0,5');
    esit(SH.temiz(2.5, 0), 3);
    esit(SH.temiz(-2.5, 0), -3);
  });

  await dene('Excel: zip yapısı ve sayfalar', async () => {
    const p = yukle();
    const bytes = await SHX.raporYaz(p, { surum: 'test', katsayilar: kat });
    esit(bytes[0], 0x50);
    esit(bytes[1], 0x4B);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endPos = bytes.length - 22;
    esit(dv.getUint32(endPos, true), 0x06054b50, 'zip sonu');
    const count = dv.getUint16(endPos + 10, true);
    esit(count, 7 + 8, 'dosya sayısı (8 sayfa)');
    // Merkez dizinden DURUM TESPİT sayfasını bul, aç ve satırları say
    let pos = dv.getUint32(endPos + 16, true);
    const dec = new TextDecoder();
    let sheet2 = null;
    for (let i = 0; i < count; i++) {
      const method = dv.getUint16(pos + 10, true);
      const csize = dv.getUint32(pos + 20, true);
      const nlen = dv.getUint16(pos + 28, true);
      const xlen = dv.getUint16(pos + 30, true);
      const clen = dv.getUint16(pos + 32, true);
      const off = dv.getUint32(pos + 42, true);
      const name = dec.decode(bytes.subarray(pos + 46, pos + 46 + nlen));
      if (name === 'xl/worksheets/sheet2.xml') {
        const lnlen = dv.getUint16(off + 26, true);
        const lxlen = dv.getUint16(off + 28, true);
        const data = bytes.subarray(off + 30 + lnlen + lxlen, off + 30 + lnlen + lxlen + csize);
        let raw = data;
        if (method === 8) {
          const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          raw = new Uint8Array(await new Response(stream).arrayBuffer());
        }
        sheet2 = dec.decode(raw);
      }
      pos += 46 + nlen + xlen + clen;
    }
    dogru(sheet2, 'sheet2 yok');
    esit((sheet2.match(/<row /g) || []).length, 14, 'başlık + 13 satır');
    dogru(sheet2.indexOf('AL_İLETKENLER') > 0);
    // Sıkıştırmasız yazım da geçerli zip üretir
    const ham = await SHX.zip([{ name: 'a.txt', data: 'merhaba' }], false);
    esit(SHX.crc32(new TextEncoder().encode('merhaba')) >>> 0, new DataView(ham.buffer).getUint32(14, true));
  });

  console.log('\n' + gecen + ' test geçti, ' + kalan + ' başarısız');
  if (kalan) process.exit(1);
})();
