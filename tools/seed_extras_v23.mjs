// v2.3 katalog ekleri: hava yalıtımlı (hd) hücreler, LED / sodyum armatürler, abone kofresi, MOD-5 trafo binası,
// kabin (köşk gövdesi + hücre) poz eşlemesi. Standart paketine eklenir (tekrar çalıştırılabilir).
// Kaynak: TEDAŞ birim fiyat poz numaraları (birimfiyat.com / birimfiyat.net üzerindeki TEDAŞ listeleri, 2026).
// Bu kalemler EDAŞ Yeşil Defter servis kodu taşımaz: servis alanı "TEDAS:<poz no>" ya da "YEREL:<ad>" biçimindedir
// ve verified:false ("doğrulanacak") olarak işaretlenir. Poz numarası uygulamadan düzeltilebilir.
import fs from 'node:fs';
import path from 'node:path';

export const SEED_REV = 24;

// [servis, pozNo, ad, kategori, onaylı mı (poz numarası kaynakta görüldü)]
const POZ = [
  // --- Hava yalıtımlı (hd) metal muhafazalı modüler hücreler · TEDAŞ 22.4.x ---
  ['TEDAS:22.4.1-008', '22.4.1-008', '36 kV 630 A 16 kA Modüler Giriş-Çıkış Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.1-007', '22.4.1-007', '36 kV 400 A 16 kA Modüler Giriş-Çıkış Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.2-004', '22.4.2-004', '36 kV 200 A 16 kA Modüler Trafo Koruma Hücresi · sigortalı yük ayırıcılı (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.3-008', '22.4.3-008', '30-36/0,1 kV Modüler Gerilim Trafosu Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.4-007', '22.4.4-007', '36 kV 630 A 16 kA Modüler Kesicili Çıkış Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.6-007', '22.4.6-007', '36 kV 630 A 16 kA Ayırıcılı Giriş-Çıkış Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.7-008', '22.4.7-008', '36 kV 1250 A 16 kA Kablo Bağlantı Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.8-007', '22.4.8-007', '36 kV 630 A 16 kA Akım ve Gerilim Ölçü Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.10-008', '22.4.10-008', '36 kV 1250 A 16 kA Akım Ölçü + Bara Yükseltme Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.11-007', '22.4.11-007', '36 kV 630 A 16 kA Akım Ölçü Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['TEDAS:22.4.12-007', '22.4.12-007', '36 kV 630 A 16 kA Kesicili Bara Bölme Hücresi · yandan çıkışlı (hava yalıtımlı · hd)', 'Köşk / hücre', true],
  ['YEREL:HD-KUPLAJ', null, '36 kV Kesicili Bara Bağlama (Kuplaj) Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', false],
  ['YEREL:HD-BARA-YUKSELTME', null, '36 kV Bara Yükseltme Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', false],
  ['YEREL:HD-BARA-BOLME-YA', null, '36 kV Yük Ayırıcılı Bara Bölme Hücresi · yandan çıkışlı (hava yalıtımlı · hd)', 'Köşk / hücre', false],
  ['YEREL:HD-PARAFUDR', null, '36 kV Parafudr Hücresi (hava yalıtımlı · hd)', 'Köşk / hücre', false],
  // --- Köşk / bina gövdeleri ---
  ['TEDAS:36.7-005', '36.7-005', 'MOD-5 Modüler Hücreli Trafo Binası (6,3-34,5 kV)', 'Köşk / hücre', true],
  ['YEREL:KOSK-TIP1A-BOS', null, '36 kV TİP1A Beton Köşk (BOŞ · yalnız gövde)', 'Köşk / hücre', false],
  ['YEREL:BINA-MOD5A', null, 'MOD-5A Modüler Hücreli Trafo Binası', 'Köşk / hücre', false],
  ['YEREL:BINA-MOD5B', null, 'MOD-5B Modüler Hücreli Trafo Binası', 'Köşk / hücre', false],
  ['YEREL:KOSK-KABLO-KANALI', null, 'Köşk / bina içi kablo kanalı (beton, kapaklı)', 'Köşk / hücre', false, 'm'],
  // --- Sodyum buharlı armatürler · TEDAŞ 20.5.1 ---
  ['TEDAS:20.5.1-001', '20.5.1-001', '70 W Sodyum Buharlı Aydınlatma Armatürü (demir, ağaç ve beton direklerde · TEDAŞ pozu)', 'Aydınlatma', true],
  ['TEDAS:20.5.1-002', '20.5.1-002', '100 W Sodyum Buharlı Aydınlatma Armatürü (demir, ağaç ve beton direklerde)', 'Aydınlatma', true],
  ['TEDAS:20.5.1-004', '20.5.1-004', '250 W Sodyum Buharlı Aydınlatma Armatürü (demir, ağaç ve beton direklerde)', 'Aydınlatma', true],
  ['YEREL:ARM-NA-400', null, '400 W Sodyum Buharlı Aydınlatma Armatürü', 'Aydınlatma', false],
  // --- LED armatürler · TEDAŞ 20.7 (yol aydınlatma sınıfı / armatür sınıfı) ---
  ['TEDAS:20.7.1', '20.7.1', 'LED Armatür · M1 yol aydınlatma sınıfı (armatür sınıfı seçilecek)', 'Aydınlatma', true],
  ['TEDAS:20.7.1-02', '20.7.1-02', 'LED Armatür · M1 · Armatür sınıfı 2 (refüjden karşılıklı kaydırılmış)', 'Aydınlatma', true],
  ['TEDAS:20.7.2', '20.7.2', 'LED Armatür · M2 yol aydınlatma sınıfı (armatür sınıfı seçilecek)', 'Aydınlatma', true],
  ['TEDAS:20.7.2-04', '20.7.2-04', 'LED Armatür · M2 · Armatür sınıfı 7 (sağ-sol tek taraflı)', 'Aydınlatma', true],
  ['TEDAS:20.7.3', '20.7.3', 'LED Armatür · M3 yol aydınlatma sınıfı (armatür sınıfı seçilecek)', 'Aydınlatma', true],
  ['TEDAS:20.7.3-01', '20.7.3-01', 'LED Armatür · M3 · Armatür sınıfı 8 (refüjden karşılıklı kaydırılmış)', 'Aydınlatma', true],
  ['TEDAS:20.7.4', '20.7.4', 'LED Armatür · M4 yol aydınlatma sınıfı (armatür sınıfı seçilecek)', 'Aydınlatma', true],
  ['TEDAS:20.7.4-02', '20.7.4-02', 'LED Armatür · M4 · Armatür sınıfı 13 (sağ-sol tek taraflı)', 'Aydınlatma', true],
  ['TEDAS:20.7.4-03', '20.7.4-03', 'LED Armatür · M4 · Armatür sınıfı 14 (sağ-sol tek taraflı)', 'Aydınlatma', true],
  ['TEDAS:20.7.5', '20.7.5', 'LED Armatür · M5 yol aydınlatma sınıfı (armatür sınıfı seçilecek)', 'Aydınlatma', true],
  // LED armatürler · güce göre (poz numarası yok; sahadaki armatürü kaydetmek için)
  ...[30, 40, 50, 60, 80, 100, 120, 150, 180, 200, 250].map((w) => ['YEREL:ARM-LED-' + w, null, w + ' W LED Yol Aydınlatma Armatürü', 'Aydınlatma', false]),
  ['YEREL:ARM-LED-PROJ-100', null, '100 W LED Projektör', 'Aydınlatma', false],
  ['YEREL:ARM-LED-PROJ-200', null, '200 W LED Projektör', 'Aydınlatma', false],
  ['YEREL:ARM-LED-PARK', null, 'LED Park / Bahçe Armatürü', 'Aydınlatma', false],
  // --- Abone kofresi ---
  ['YEREL:KOFRE-1F', null, 'AG Abone Kofresi · tek fazlı (yapı bağlantı girişi)', 'Kablo / abone', false],
  ['YEREL:KOFRE-3F', null, 'AG Abone Kofresi · üç fazlı (yapı bağlantı girişi)', 'Kablo / abone', false],
  // --- v2.4 · Kaplamalı kablo kanalı (yeşil defterde yalnız kaplamasız toprak ve tüvenan var) ---
  ['YEREL:KANAL-ASFALT', null, 'Standart Tüvenan Dolgulu Kablo Kanalı Yapılması - Asfalt Kaplamalı', 'Kablo / abone', false, 'm3'],
  ['YEREL:KANAL-BETON', null, 'Standart Tüvenan Dolgulu Kablo Kanalı Yapılması - Beton Kaplamalı', 'Kablo / abone', false, 'm3'],
  ['YEREL:KANAL-PARKE', null, 'Standart Tüvenan Dolgulu Kablo Kanalı Yapılması - Parke Taşı Kaplamalı', 'Kablo / abone', false, 'm3'],
];

// Kabin keşfi: köşk gövdesi + her hücre ayrı kalem. Hücre sınıfı (YA, SYA, KE…) → poz; önce hücre koduna özel eşleme aranır.
const CABIN = {
  note: 'Kabin (köşk / bina) keşif eşlemesi · gövde tipine göre ayrı kalem, hücreler tek tek · v2.3',
  govde: { 'TİP-1A': 'YEREL:KOSK-TIP1A-BOS', 'TİP-1B': '022.02.03.02-044', 'TİP-1C': '022.02.03.03-052', 'TİP-2A/T': '022.02.03.09-014', 'MOD-5': 'TEDAS:36.7-005', 'MOD-5A': 'YEREL:BINA-MOD5A', 'MOD-5B': 'YEREL:BINA-MOD5B' },
  hucre: {
    hd: { YA: 'TEDAS:22.4.1-008', SYA: 'TEDAS:22.4.2-004', KE: 'TEDAS:22.4.4-007', GT: 'TEDAS:22.4.3-008', OLCU: 'TEDAS:22.4.8-007', KABLO: 'TEDAS:22.4.7-008', KUPLAJ: 'YEREL:HD-KUPLAJ', BARA: 'YEREL:HD-BARA-YUKSELTME', PF: 'YEREL:HD-PARAFUDR' },
    gd: { YA: '022.04.02.01-002', SYA: '022.04.02.01-004', KE: '022.04.02.01-006', BARA: '022.04.02.01-008' }
  },
  // Hücre koduna özel (yalnız hd)
  kod: { 'HMH 36-06': 'TEDAS:22.4.6-007', 'HMH 36-10': 'TEDAS:22.4.10-008', 'HMH 36-11': 'TEDAS:22.4.11-007', 'HMH 36-12': 'TEDAS:22.4.12-007', 'HMH 36-13': 'YEREL:HD-BARA-BOLME-YA', 'HMH 36-16': 'YEREL:HD-BARA-BOLME-YA' },
  kanal: 'YEREL:KOSK-KABLO-KANALI',
  kofre: { tek: 'YEREL:KOFRE-1F', uc: 'YEREL:KOFRE-3F' }
};

// v2.4 · Yeraltı kanal hesabı: kaplamaya göre kanal kalemi (m³), yatay sondaj (m), abone bağlantı kanalı (m)
export const KANAL = {
  kazi: { toprak: '032.12.01.01-003', tuvenan: '032.12.01.01-002', asfalt: 'YEREL:KANAL-ASFALT', beton: 'YEREL:KANAL-BETON', parke: 'YEREL:KANAL-PARKE' },
  sondaj: '032.12.06.01-003',
  abone: { kaplamasiz: '032.13.03.01-001', kaplamali: '032.13.03.01-002' }
};

export function applyExtras(out) {
  const STD = out.standard.id;
  const have = new Set(out.poz.map((p) => p.servis));
  const added = [];
  for (const [servis, pozNo, name, category, ok, unit] of POZ) {
    if (have.has(servis)) continue;
    out.poz.push({
      id: STD + ':' + servis, stdId: STD, servis, pozNo: pozNo || null, name, unit: unit || 'Ad', kgPerUnit: null, supply: 'Y', montaj: true, demontaj: true, dmm: true, kgGroup: '', category,
      bfPoz: pozNo || null, priceMaterial: null, priceLabor: null, priceUnit: null, inGreenBook: false, validFrom: out.standard.validFrom, validTo: out.standard.validTo,
      source: pozNo ? 'TEDAŞ birim fiyat poz no · EDAŞ servis kodu doğrulanacak' : 'Yerel kalem · poz numarası girilecek', verified: false, pozConfirmed: !!ok, isKgGroup: false, extra: servis.startsWith('YEREL:KANAL-') ? 'v2.4' : 'v2.3'
    });
    added.push(servis);
  }
  out.cabin = CABIN;
  out.kanal = KANAL;
  out.standard.seedRev = SEED_REV;
  if (!(out.standard.unverifiedTables || []).includes('cabin')) out.standard.unverifiedTables = [...(out.standard.unverifiedTables || []), 'cabin', 'poz.extra(v2.3)'];
  return added;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const f = path.join(path.dirname(new URL(import.meta.url).pathname), '../web/seed/standard-tedas-2026.json');
  const out = JSON.parse(fs.readFileSync(f, 'utf8'));
  const added = applyExtras(out);
  fs.writeFileSync(f, JSON.stringify(out));
  console.log('ek kalem:', added.length, '· toplam poz:', out.poz.length, '· seedRev', out.standard.seedRev);
}
