// Ortak simge takımı: telefonun tablosu (src/export/semboller.js) depodaki ortak dosyayla
// (ortak/katalog/semboller.json) aynı mı, her aile için dört varyant var mı, blok adları eklentiyle aynı mı?
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import SEMBOLLER from '../src/ortak/semboller.js';
import { sembolBlogu, sembolAilesi, sembolVaryanti } from '../src/export/dxf.js';
import { exportFormat } from '../src/export/exporter.js';
import { setup, newProject, buildPoleLine, route } from './helpers.mjs';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('S1 · telefondaki ortak tablolar (src/ortak/*.js) depodaki ortak/katalog/*.json ile birebir aynı', async () => {
  for (const [klasor, ad] of [['katalog', 'semboller'], ['katalog', 'volt-eslesme'], ['katalog', 'kalemler'], ['katalog', 'katsayilar'], ['katalog', 'cizim-stili'], ['marka', 'hakkinda']]) {
    const json = JSON.parse(fs.readFileSync(path.join(kok, 'ortak/' + klasor + '/' + ad + '.json'), 'utf8'));
    const mod = (await import('../src/ortak/' + ad + '.js')).default;
    assert.deepEqual(mod, json, ad + ' (node araclar/ortak-tablolar.mjs çalıştırın)');
  }
  assert.equal(SEMBOLLER.bicim, 'sebeke-hakedis.semboller');
});

test('S2 · her aile için YENI · MEVCUT · DMM · DM · KESIK · SOKUK varyantları var ve geometrisi boş değil', () => {
  const butun = Object.keys(SEMBOLLER.aileler);
  const aileler = butun.filter((a) => !SEMBOLLER.aileler[a].takim);   // klasik takım
  assert.ok(aileler.length >= 16);
  for (const a of butun) for (const v of ['YENI', 'MEVCUT', 'DMM', 'DM', 'KESIK', 'SOKUK']) {
    const s = SEMBOLLER.semboller[a + '_' + v];
    assert.ok(Array.isArray(s) && s.length > 0, a + '_' + v);
    for (const i of s) assert.ok(['L', 'C', 'P', 'S', 'D', 'Y', 'T', 'R'].includes(i[0]), 'ilkel türü ' + i[0]);
    // klasik takımda yazı ve renk ilkeli yok (eski eklentiler de okuyabilir)
    if (!SEMBOLLER.aileler[a].takim) for (const i of s) assert.ok(i[0] !== 'T' && i[0] !== 'R', a + ': klasik takımda ' + i[0]);
  }
  // Dolu varyantta dolgu, mevcutta dolgu yok, demontajda çapraz çizgi
  assert.ok(SEMBOLLER.semboller.DIREK_AG_YENI.some((i) => i[0] === 'D'));
  assert.ok(!SEMBOLLER.semboller.DIREK_AG_MEVCUT.some((i) => i[0] === 'D' || i[0] === 'S'));
  assert.ok(SEMBOLLER.semboller.KAFES_OG_DM.some((i) => i[0] === 'L' && i[1] < 0 && i[3] > 0 && i[1] === i[2]));
  // Altı durum birbirinden farklı (kafes direkte de): demontaj işareti simgenin dışına taşar
  for (const a of aileler) {
    const goruntu = ['YENI', 'MEVCUT', 'DMM', 'DM', 'KESIK', 'SOKUK'].map((v) => JSON.stringify(SEMBOLLER.semboller[a + '_' + v]));
    assert.equal(new Set(goruntu).size, 6, a + ': altı varyant farklı');
  }
  const R = SEMBOLLER.aileler.KAFES_AG.yariGenislik;
  const tasan = (s) => s.filter((i) => i[0] === 'L' && Math.max(Math.abs(i[1]), Math.abs(i[2]), Math.abs(i[3]), Math.abs(i[4])) > R + 1);
  assert.equal(tasan(SEMBOLLER.semboller.KAFES_AG_MEVCUT).length, 0, 'mevcut kafeste taşan çizgi yok');
  assert.equal(tasan(SEMBOLLER.semboller.KAFES_AG_DM).length, 1, 'DM: tek taşan çapraz');
  assert.equal(tasan(SEMBOLLER.semboller.KAFES_AG_KESIK).length, 2, 'KESİK: iki paralel çapraz');
  assert.equal(tasan(SEMBOLLER.semboller.KAFES_AG_SOKUK).length, 2, 'SÖKÜK: taşan çarpı');
  const [k1, k2] = tasan(SEMBOLLER.semboller.KAFES_AG_KESIK);
  assert.ok(Math.abs((k1[4] - k1[2]) / (k1[3] - k1[1]) - (k2[4] - k2[2]) / (k2[3] - k2[1])) < 1e-9, 'KESİK çizgileri paralel');
  for (const a of aileler) assert.ok(SEMBOLLER.aileler[a].kapsam >= SEMBOLLER.aileler[a].yariGenislik, a + ': kapsam');
  // OG direklerde topraklama işareti (alta inen çizgi), AG'de yok
  assert.ok(SEMBOLLER.semboller.DIREK_OG_MEVCUT.some((i) => i[0] === 'L' && i[1] === 0 && i[3] === 0 && i[4] < -3));
  assert.ok(!SEMBOLLER.semboller.DIREK_AG_MEVCUT.some((i) => i[0] === 'L'));
});

test('S3 · blok adları eklentiyle aynı kurala göre seçilir (SH_<aile>_<varyant>)', () => {
  const direk = (ek) => Object.assign({ kind: 'pole', group: 'sehir', symbol: 's', volt: 'AG', state: 'YENI' }, ek);
  assert.equal(sembolBlogu(direk({})), 'SH_KAFES_AG_YENI');
  assert.equal(sembolBlogu(direk({ symbol: 'c', group: 'beton' })), 'SH_DIREK_AG_YENI');
  assert.equal(sembolBlogu(direk({ symbol: 'c', group: 'beton', state: 'MEVCUT' })), 'SH_DIREK_AG_MEVCUT');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'bahh', state: 'DMM' })), 'SH_KAFES_OG_DMM');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'mus', state: 'DEMONTAJ' })), 'SH_KAFES_OG_DM');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'beton562', symbol: 'c', state: 'ILERIDE' })), 'SH_DIREK_OG_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'lighting', group: 'ayd', symbol: 'c', state: 'YENI' }), 'SH_DIREK_AYD_YENI');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'yeni', attrs: { post: 'direk' } }), 'SH_TRAFO_DIREK_YENI');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'mevcut', attrs: { post: 'bina' } }), 'SH_TRAFO_BINA_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'tasinan', attrs: { post: 'mbk' } }), 'SH_TRAFO_KOSK_DMM');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'demontaj', attrs: { post: 'mono' } }), 'SH_TRAFO_KOSK_DM');
  assert.equal(sembolBlogu({ kind: 'sdk', state: 'YENI' }), 'SH_SDK_YENI');
  assert.equal(sembolBlogu({ kind: 'panel', state: 'MEVCUT' }), 'SH_PANO_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'manhole', state: 'MEVCUT' }), 'SH_MENHOL_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'luminaire', state: 'YENI' }), 'SH_ARMATUR_YENI');
  assert.equal(sembolBlogu({ kind: 'other', state: 'DEMONTAJ' }), 'SH_DIGER_DM');
  assert.equal(sembolBlogu({ kind: 'subscriber', state: 'YENI' }), 'SH_ABONE_YENI');
  assert.equal(sembolAilesi({ kind: 'kiosk', state: 'yeni', attrs: {} }), 'TRAFO_DIREK'); // post yoksa direk tipi sayılır (eski davranış)
  assert.equal(sembolVaryanti('tasinan'), 'DMM');
  // Demontaj türü: KESİK / SÖKÜK ayrı simge (DM+M sök-tak yarım dolu kalır)
  assert.equal(sembolBlogu(direk({ state: 'DEMONTAJ', attrs: { dmDurum: 'KESİK' } })), 'SH_KAFES_AG_KESIK');
  assert.equal(sembolBlogu(direk({ symbol: 'c', group: 'beton', state: 'DEMONTAJ', attrs: { dmDurum: 'SÖKÜK' } })), 'SH_DIREK_AG_SOKUK');
  assert.equal(sembolBlogu(direk({ state: 'DEMONTAJ', attrs: { dmDurum: '' } })), 'SH_KAFES_AG_DM');
  assert.equal(sembolBlogu(direk({ state: 'DMM', attrs: { dmDurum: 'KESİK' } })), 'SH_KAFES_AG_DMM');
  assert.equal(sembolVaryanti('YENI', 'DM', 'kesik'), 'KESIK');
  assert.equal(sembolVaryanti('', 'DM', 'sökük'), 'SOKUK');
});

test('S4 · Şebeke-M takımı (SM_*): 23 aile, tasarım kuralı (dolu / yarı dolu / kontur / çift kontur + DM, kesik K · sökük S), blok adları', () => {
  const sm = Object.keys(SEMBOLLER.aileler).filter((a) => SEMBOLLER.aileler[a].takim === 'SM');
  assert.equal(sm.length, 23);
  assert.equal(SEMBOLLER.aileler.SM_DIREK_AG.yariGenislik, SEMBOLLER.aileler.DIREK_AG.yariGenislik, 'yarı genişlik klasikle aynı: yazı yerleri ve yakalama değişmez');
  assert.equal(SEMBOLLER.aileler.SM_DIREK_OG.yariGenislik, SEMBOLLER.aileler.DIREK_OG.yariGenislik);
  const S = SEMBOLLER.semboller;
  assert.ok(S.SM_DIREK_AG_YENI.some((i) => i[0] === 'D') && S.SM_DIREK_AG_YENI.some((i) => i[0] === 'R' && i[1] === 7), 'yeni: dolu, iç çizgiler zıt renk');
  assert.ok(S.SM_DIREK_AG_DMM.some((i) => i[0] === 'Y'), 'sök-tak: sol yarı dolu');
  assert.ok(!S.SM_DIREK_AG_MEVCUT.some((i) => i[0] === 'D' || i[0] === 'S' || i[0] === 'T'), 'mevcut: yalnız kontur ve iç çizgi');
  assert.equal(S.SM_DIREK_AG_DM.filter((i) => i[0] === 'C').length, 2, 'demontaj: çift kontur');
  assert.deepEqual(S.SM_DIREK_AG_DM.filter((i) => i[0] === 'T').map((i) => i[4]), ['DM']);
  assert.deepEqual(S.SM_DIREK_AG_KESIK.filter((i) => i[0] === 'T').map((i) => i[4]), ['DM', 'K']);
  assert.deepEqual(S.SM_DIREK_AG_SOKUK.filter((i) => i[0] === 'T').map((i) => i[4]), ['DM', 'S']);
  assert.ok(S.SM_KOSK_KULESIZ_OZEL_YENI.some((i) => i[0] === 'P' && i[3] === 'DASHED'), 'kulesiz özel: kesikli kontur');
  assert.ok(S.SM_KOSK_KULE_YENI.filter((i) => i[0] === 'S').length >= 4, 'içbükey köşk üçgenlenerek dolar');
  assert.deepEqual(S.SM_SDK_AG_DM.filter((i) => i[0] === 'T').map((i) => i[4]), ['SDK', 'AG', 'DM'], 'yazılı simgede DM alta eklenir');
  // Blok adları: takım '' → klasik; 'SM' → SM_ aile (takımda olmayan aile klasik kalır)
  const direk = (ek) => Object.assign({ kind: 'pole', group: 'sehir', symbol: 'c', volt: 'AG', state: 'YENI' }, ek);
  assert.equal(sembolBlogu(direk({}), ''), 'SH_DIREK_AG_YENI');
  assert.equal(sembolBlogu(direk({}), 'SM'), 'SH_SM_DIREK_AG_YENI');
  assert.equal(sembolBlogu(direk({ symbol: 's' }), 'SM'), 'SH_SM_KAFES_AG_YENI');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'bahh', state: 'DEMONTAJ', attrs: { dmDurum: 'KESİK' } }), 'SM'), 'SH_SM_DIREK_ENH_KESIK', 'BAHH direği ENH simgesi');
  assert.equal(sembolBlogu(direk({ volt: 'OG', group: 'mus', symbol: 's' }), 'SM'), 'SH_SM_KAFES_OG_YENI');
  assert.equal(sembolBlogu({ kind: 'lighting', group: 'ayd', symbol: 'c', state: 'DMM' }, 'SM'), 'SH_SM_DIREK_AYD_DMM');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'yeni', attrs: { post: 'direk' }, typeName: '100 kVA' }, 'SM'), 'SH_SM_TRAFO_DIREK_YENI');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'yeni', attrs: { post: 'direk' }, typeName: 'Özel 100 kVA' }, 'SM'), 'SH_SM_TRAFO_DIREK_OZEL_YENI');
  assert.equal(sembolBlogu({ kind: 'kiosk', state: 'yeni', attrs: { post: 'mbk' }, typeName: 'Modüler beton köşk' }, 'SM'), 'SH_SM_KOSK_MODULER_YENI');
  assert.equal(sembolBlogu({ kind: 'kiosk', state: 'yeni', attrs: { post: 'mono' }, typeName: 'Kule çıkışlı özel' }, 'SM'), 'SH_SM_KOSK_KCIKIS_OZEL_YENI');
  assert.equal(sembolBlogu({ kind: 'kiosk', state: 'mevcut', attrs: { post: 'mono' }, typeName: 'Kule tipi' }, 'SM'), 'SH_SM_KOSK_KULE_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'substation', state: 'yeni', attrs: { post: 'bina' }, typeName: 'İndirici merkez' }, 'SM'), 'SH_SM_INDIRICI_MERKEZ_YENI');
  assert.equal(sembolBlogu({ kind: 'transformer', state: 'mevcut', attrs: { post: 'bina' } }, 'SM'), 'SH_SM_TRAFO_BINA_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'sdk', state: 'YENI' }, 'SM'), 'SH_SM_SDK_AG_YENI');
  assert.equal(sembolBlogu({ kind: 'sdk', state: 'YENI', typeName: 'Aydınlatma SDK' }, 'SM'), 'SH_SM_SDK_AYD_YENI');
  assert.equal(sembolBlogu({ kind: 'panel', state: 'MEVCUT' }, 'SM'), 'SH_SM_BOX_MEVCUT');
  assert.equal(sembolBlogu({ kind: 'luminaire', state: 'YENI', typeName: 'S3 Sınıf LED armatür' }, 'SM'), 'SH_SM_ARMATUR_LED_YENI');
  assert.equal(sembolBlogu({ kind: 'luminaire', state: 'YENI', typeName: '70W Sodyum Arm.' }, 'SM'), 'SH_SM_ARMATUR_SODYUM_YENI');
  assert.equal(sembolBlogu({ kind: 'luminaire', state: 'YENI', typeName: 'Cıva buharlı 125 W' }, 'SM'), 'SH_SM_ARMATUR_CIVA_YENI');
  assert.equal(sembolBlogu({ kind: 'manhole', state: 'MEVCUT' }, 'SM'), 'SH_MENHOL_MEVCUT', 'takımda olmayan aile klasik kalır');
  assert.equal(sembolBlogu({ kind: 'subscriber', state: 'YENI' }, 'SM'), 'SH_ABONE_YENI');
  for (const e of [direk({}), { kind: 'transformer', state: 'yeni', attrs: { post: 'direk' } }, { kind: 'sdk', state: 'YENI' }])
    assert.ok(SEMBOLLER.semboller[sembolBlogu(e).slice(3)], 'tabloda var: ' + sembolBlogu(e));
});

test('S5 · DXF: projenin simge takımı Şebeke-M ise SH_SM_ blokları konur (yazı, zıt renk, kesikli çizgi); klasikte eski bloklar', async () => {
  const { ps } = await setup(); await newProject(ps);
  const ROUTE = route({ E: 519300.0, N: 4282100.0, H: 1050.0 }, [[60, 98.412, 4.3], [60, 102.775, 2.14]]);
  await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: ['GD-12 (3 AWG)', 'GT-12 (3 AWG)', 'GN-12 (3 AWG)'], circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  const satirlar = (u8) => new TextDecoder().decode(u8).split(/\r?\n/);
  // INSERT varlıklarının blok adları (kod 2) — ENTITIES bölümünde
  const konulanlar = (sat) => {
    const bas = sat.indexOf('ENTITIES'), out = [];
    for (let i = bas; i < sat.length - 3; i++) if (sat[i] === 'INSERT') { for (let j = i; j < i + 12; j++) if (sat[j] === '2') { out.push(sat[j + 1]); break; } }
    return out;
  };
  const [klasik] = await exportFormat(ps, 'dxf');
  const k = konulanlar(satirlar(klasik.data));
  assert.ok(k.length >= 3 && k.every((b) => b.startsWith('SH_KAFES_OG_')), 'klasik takım: BAHH direği SH_KAFES_OG_… ' + k.join(','));
  await ps.updateProject({ sebeke: { boyutlar: { simgeTakimi: 'SM' } } }, 'deneme');
  const [sm] = await exportFormat(ps, 'dxf');
  const sat = satirlar(sm.data), d = sat.join('\n');
  const s2 = konulanlar(sat);
  assert.ok(s2.length >= 3 && s2.every((b) => b.startsWith('SH_SM_DIREK_ENH_')), 'Şebeke-M: BAHH direği SH_SM_DIREK_ENH_… ' + s2.join(','));
  const blok = (ad) => { const b = d.indexOf('\n3\n' + ad + '\n'); return d.slice(b, d.indexOf('ENDBLK', b)); };
  const kesik = blok('SH_SM_DIREK_AG_KESIK');
  assert.ok(/\nTEXT\n[\s\S]*?\n1\nDM\n/.test(kesik) && /\nTEXT\n[\s\S]*?\n1\nK\n/.test(kesik), 'kesik demontaj: DM ve K yazıları');
  assert.ok(!/\n1\nK\n/.test(blok('SH_SM_DIREK_AG_DM')), 'DM (durumu bilinmeyen): harf yok');
  assert.ok(/\n62\n7\n/.test(blok('SH_SM_DIREK_AG_YENI')), 'dolu simgenin iç çizgileri zıt renk (7)');
  assert.ok(!/\n62\n7\n/.test(blok('SH_SM_DIREK_AG_MEVCUT')), 'kontur simgede zıt renk yok');
  assert.ok(/\n6\nDASHED\n/.test(blok('SH_SM_TRAFO_BINA_MEVCUT')), 'bina tipi: kesikli kontur');
  assert.ok(/\nDASHED\n/.test(d.slice(0, d.indexOf('BLOCKS'))), 'DASHED çizgi tipi LTYPE tablosunda tanımlı');
});

// DXF R12 (AC1009) kuralı: AutoCAD bu biçimde 31 karakterden uzun ya da A–Z, 0–9, _ $ - dışında karakterli tablo / blok
// adı ve R12'de olmayan varlık (MTEXT, LWPOLYLINE…) görürse dosyayı açmaz: "Invalid or incomplete DXF input", ENTER →
// boş çizim (13.11.2026: SH_SM_KOSK_KULE_CIKIS_OZEL_MEVCUT 33 karakterdi; malzeme yazısı MTEXT'ti).
const R12_VARLIK = new Set(['LINE', 'POINT', 'CIRCLE', 'ARC', 'TRACE', 'SOLID', 'TEXT', 'SHAPE', 'INSERT', 'ATTDEF', 'ATTRIB', 'POLYLINE', 'VERTEX', 'SEQEND', '3DFACE', 'VIEWPORT', 'DIMENSION']);
const R12_AD = /^[A-Z0-9_$-]{1,31}$/;
function r12Denetle(metin) {
  const sat = metin.split(/\r?\n/), hatalar = [];
  if (sat.length % 2 !== 0 && sat[sat.length - 1] !== '') hatalar.push('tek sayıda satır');
  let bolum = '', tur = '';
  for (let i = 0; i + 1 < sat.length; i += 2) {
    const kod = +sat[i].trim(), deger = sat[i + 1];
    if (!Number.isInteger(kod)) { hatalar.push('satır ' + (i + 1) + ': grup kodu sayı değil'); break; }
    if (kod === 0) {
      tur = deger;
      if (deger === 'SECTION') bolum = sat[i + 3];
      else if (['ENTITIES', 'BLOCKS'].includes(bolum) && !['BLOCK', 'ENDBLK', 'ENDSEC', 'EOF'].includes(deger) && !R12_VARLIK.has(deger)) hatalar.push('R12\'de olmayan varlık: ' + deger);
    } else if (kod === 2 && ['LAYER', 'LTYPE', 'STYLE', 'BLOCK', 'INSERT'].includes(tur) && !R12_AD.test(deger)) hatalar.push(tur + ' adı: ' + deger + ' (' + deger.length + ')');
    else if (kod === 3 && tur === 'BLOCK' && !R12_AD.test(deger)) hatalar.push('BLOCK adı (3): ' + deger);
    else if ((kod === 8 || kod === 6) && bolum === 'ENTITIES' && !R12_AD.test(deger)) hatalar.push('katman / çizgi tipi: ' + deger);
  }
  return [...new Set(hatalar)];
}

test('S6 · DXF R12 kuralı: bütün blok adları 31 karakteri aşmaz, R12 varlıkları ve adları (iki takım, malzeme yazısı açık)', async () => {
  for (const ad of Object.keys(SEMBOLLER.semboller)) assert.ok(R12_AD.test('SH_' + ad), 'blok adı R12 sınırında: SH_' + ad + ' (' + ('SH_' + ad).length + ')');
  const eski = SEMBOLLER.eskiAileler || {};
  for (const [a, y] of Object.entries(eski)) if (a !== 'aciklama') assert.ok(SEMBOLLER.aileler[y] && !SEMBOLLER.aileler[a], 'eski aile ' + a + ' → ' + y);
  assert.equal(sembolBlogu({ kind: 'kiosk', state: 'mevcut', attrs: { post: 'mono' }, typeName: 'Kule çıkışlı özel' }, 'SM'), 'SH_SM_KOSK_KCIKIS_OZEL_MEVCUT');
  const { ps } = await setup(); await newProject(ps);
  const ROUTE = route({ E: 519300.0, N: 4282100.0, H: 1050.0 }, [[60, 98.412, 4.3], [60, 102.775, 2.14]]);
  await buildPoleLine(ps, ROUTE, { group: 'bahh', typeNames: ['GD-12 (3 AWG)', 'GT-12 (3 AWG)', 'GN-12 (3 AWG)'], circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }] });
  for (const takim of ['', 'SM']) {
    await ps.updateProject({ sebeke: { boyutlar: { simgeTakimi: takim, malzemeYazisi: true } } }, 'deneme');
    const [d] = await exportFormat(ps, 'dxf');
    const metin = new TextDecoder('windows-1254').decode(d.data);
    assert.ok(metin.includes('AC1009'), 'R12 başlığı');
    assert.deepEqual(r12Denetle(metin), [], 'takım "' + takim + '": R12 kuralı');
  }
  assert.ok(r12Denetle('0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nSH_SM_KOSK_KULE_CIKIS_OZEL_MEVCUT\n0\nENDBLK\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nMTEXT\n0\nENDSEC\n').length === 2, 'denetim uzun adı ve MTEXT\'i yakalar');
});
