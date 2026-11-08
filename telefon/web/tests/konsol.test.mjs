// AG galvaniz travers ve konsollar (GT-60, GD-80, T-AG-1…), müşterek tepe ve trafo traversleri, AG izolatör demirleri
// (B 95, D 80, D 95): telefon kataloğunda (seed), eklenti kataloğunda (ortak/katalog/kalemler.json) ve telefon ↔ eklenti
// eşlemesinde (volt-eslesme.json › kalemler) aynı kalem. Ağırlıklar (kg/ad) birim fiyat kitabındaki değerler.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import KALEMLER from '../src/ortak/kalemler.js';
import ESLESME from '../src/ortak/volt-eslesme.js';
import { importStandard, upgradeStandard, SEED_REV } from '../src/core/standards.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(fs.readFileSync(path.join(here, '../seed/standard-tedas-2026.json'), 'utf8'));
const POZ = new Map(SEED.poz.map((p) => [p.servis, p]));
const KAT = new Map(KALEMLER.kalemler.map((k) => [k.cins + '|' + k.tanim, k]));
const ESLEME = Object.entries(ESLESME.kalemler).filter(([k]) => k !== 'aciklama');

test('K1 · eşlemedeki her kalem iki katalogda da var; travers / konsolda kg aynı', () => {
  assert.ok(ESLEME.length >= 50, 'eşleme dolu');
  for (const [servis, e] of ESLEME) {
    const p = POZ.get(servis), k = KAT.get(e.cins + '|' + e.tanim);
    assert.ok(p, 'telefon kataloğunda: ' + servis);
    assert.ok(k, 'eklenti kataloğunda: ' + e.cins + ' / ' + e.tanim);
    if (p.kgPerUnit) {
      assert.equal(k.birim, 'ad/kg', 'kg ile: ' + e.tanim);
      assert.equal(k.katsayi, p.kgPerUnit, 'aynı ağırlık: ' + e.tanim);
    }
  }
  // Kullanıcının saydıkları ve örnekler
  const bak = { 'GT-60': 3.02, 'GD-80': 6.83, 'T-AG-1': 26, 'MT-4': 116, 'GTR-400 (2x8U-400)': 73, 'gD-240 Müş. Tepe Travers': 54 };
  for (const [t, kg] of Object.entries(bak)) {
    const k = KAT.get('TRAVERS_VE_KONSOLLAR_GLV|' + t);
    assert.ok(k && k.katsayi === kg && k.pozNo === '5.4' && k.tarife === '0107' && k.kaynak === 'ek', t);
  }
  for (const t of ['B 95', 'D 80', 'D 95']) assert.ok(KAT.get('İZOLATÖR_DEMİRLERİ|' + t), 'izolatör demiri ' + t);
  // Eklentinin kendi okuyucusu "kaynak" alanını bilir (Katalog.cs)
  const cs = fs.readFileSync(path.join(here, '../../../autocad/src/Cekirdek/Katalog.cs'), 'utf8');
  assert.ok(cs.includes('o.Metin("kaynak", "katalog")'));
});

test('K2 · telefon projesi: GT-60 ve D 80 AutoCAD dosyasına katalogdaki adla gider, geri alınınca aynı poz', async () => {
  const { setup, newProject, rtkObs } = await import('./helpers.mjs');
  const { sebekeYaz, sebekeIceAl, SH } = await import('../src/interop/sebeke.js');
  const { ps } = await setup();
  await newProject(ps, { autoRecipe: false });
  const d = await ps.addEquipment('pole', { group: 'sehir', typeId: ps.cat.poleTypeByName('sehir', 'G-10I') ? ps.cat.poleTypeByName('sehir', 'G-10I').id : undefined, state: 'YENI' }, { obs: rtkObs(519300, 4282100, 1050) });
  await ps.addMaterial('equipment', d.id, '005.02.02.01-001', 2, 'GT-60');
  await ps.addMaterial('equipment', d.id, '011.05.01.01-004', 1, 'D 80');
  const dosya = JSON.parse(sebekeYaz(ps));
  const el = dosya.elemanlar.find((x) => x.telefonId === d.id);
  const gt = el.kalemler.find((k) => k.tanim === 'GT-60'), dv = el.kalemler.find((k) => k.tanim === 'D 80');
  assert.ok(gt, 'GT-60 kalemi: ' + el.kalemler.map((k) => k.cins + '/' + k.tanim).join(', '));
  assert.equal(gt.cins, 'TRAVERS_VE_KONSOLLAR_GLV');
  assert.equal(gt.birim, 'ad/kg');
  assert.equal(gt.katsayi, 3.02);
  assert.equal(gt.toplam, 6.04, '2 adet × 3,02 kg');
  assert.ok(dv && dv.cins === 'İZOLATÖR_DEMİRLERİ', 'D 80 izolatör demiri');
  // Çizimde malzeme yazısı: "GT-60=2 (M)" (eklentideki MalzemeEtiketi)
  assert.ok(SH.malzemeEtiketi(SH.projeOku(dosya).elemanlar.find((x) => x.telefonId === d.id)).some((s) => /^GT-60=2 \(/.test(s)), 'malzeme yazısı');
  // Başka projeye geri alınınca telefon kataloğundaki poz (AUTOCAD: kodlu yeni kalem açılmaz)
  const p2 = await newProject(ps, { name: 'Geri alma' });
  await sebekeIceAl(ps, SH.projeOku(JSON.stringify(dosya)), { projectId: p2 && p2.id });
  const mats = ps.data.materials.filter((m) => m.status !== 'deleted' && m.sebeke);
  const m = mats.find((x) => x.sebeke.tanim === 'GT-60');
  assert.ok(m, 'GT-60 geri geldi');
  assert.equal(m.servis, '005.02.02.01-001', 'telefon pozuna bağlandı');
  assert.equal(mats.find((x) => x.sebeke.tanim === 'D 80').servis, '011.05.01.01-004');
});

test('K3 · katalog güncellemesi 25 → 27: yeni travers / konsol, izolatör ve LED armatür pozları kurulu kataloğa eklenir', async () => {
  const { setup } = await import('./helpers.mjs');
  const { ds } = await setup({ skipSeed: true });
  const yeni = new Set(ESLEME.map(([s]) => s));
  const old = JSON.parse(JSON.stringify(SEED));
  old.poz = old.poz.filter((p) => !yeni.has(p.servis) || ['005.02.02.01-001', '005.02.02.01-012', '011.05.01.01-001'].includes(p.servis));
  old.standard = Object.assign({}, old.standard, { seedRev: 25 });
  await importStandard(ds, old);
  assert.equal(SEED_REV, 27);
  const r = await upgradeStandard(ds, SEED);
  assert.ok(r.upgraded >= 55, 'eklenen: ' + r.upgraded);
  const kayit = await ds.db.get('poz', SEED.standard.id + ':005.02.02.01-017');
  assert.ok(kayit && kayit.name.startsWith('T-AG-1') && kayit.kgPerUnit === 26 && kayit.category === 'Travers', 'T-AG-1 konsol');
  const led = await ds.db.get('poz', SEED.standard.id + ':020.05.03.01-017');
  assert.ok(led && led.name === 'Sınıf-17 Led Armatür' && led.category === 'Aydınlatma' && led.unit === 'Ad', 'Sınıf-17 LED armatür');
  assert.equal((await ds.db.get('standards', SEED.standard.id)).seedRev, 27);
});

test('K4 · LED armatür sınıfları 1–17 (8.11.2026): telefonun armatür listesinde, eklenti kataloğunda ve eşlemede', async () => {
  const { luminairePoz } = await import('../src/services/survey-service.js');
  const { setup, newProject } = await import('./helpers.mjs');
  const { ps } = await setup();
  await newProject(ps);
  const liste = luminairePoz(ps.cat);
  for (let n = 1; n <= 17; n++) {
    const servis = '020.05.03.01-' + String(n).padStart(3, '0');
    assert.ok(liste.some((x) => x.servis === servis), 'armatür listesinde: ' + servis);
    const e = ESLESME.kalemler[servis];
    assert.ok(e && e.cins === 'ARMATÜR' && e.tanim === 'S' + n + ' SINIF NUMARALI LED ARMATÜR', 'eşleme: ' + servis);
    assert.ok(KAT.get('ARMATÜR|S' + n + ' SINIF NUMARALI LED ARMATÜR'), 'eklenti kataloğunda S' + n);
  }
});
