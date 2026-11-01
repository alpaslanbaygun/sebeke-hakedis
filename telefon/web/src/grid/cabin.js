// Beton köşk / trafo binası yerleşim modeli — özgün tek dosyalık "Beton Köşk 3B Yerleşim Simülatörü"
// aracının VERİ MODELİ ve KURALLARININ saf (DOM'suz, depolamasız, global durum değiştirmeyen) portu.
// Kapsam: monoblok (KOSK), prefabrik (PKOSK) ve MOD tipi trafo binaları (BINA).
// Kapsam dışı: serbest özel oda, saha planı, 3B, hücre çizimleri, DXF ve yazdırma.
//
// Özgün araçtaki global kabuk değişkenleri (DUVAR, BOLME_D, DIS_EN, IC_EN, DIS_YUK) ve `S` durumu
// burada `cabin` argümanından türetilir:
//   { sinif:'mono'|'pref'|'bina', kosk, varyant, trafoKva, trafoAdet?, hucreSeri,
//     hucreler:[{c,f,y:'g'|'c'|'x',s?:'1'|'2'}], dims?:{arka,yan,...}, kanallar?:[{ad,boy,gen,der}],
//     trafoKg?  (isteğe bağlı elle ağırlık; yoksa katalog değeri),
//     sakli?    (isteğe bağlı: sınıf değiştirirken özgün araçtaki gibi önceki sınıfın tip/hücre listesini saklar) }
// Tüm ölçüler mm, ağırlıklar kg. Koordinat orijini köşkün sol dış köşesi; X boy, Z derinlik (kapı cephesi Z+).
//
// Özgün davranıştan BİLEREK ayrılan noktalar:
//  1) Özgün araç MOD binasına / özel odaya ilk geçişte S.hucreSeri="HMH" yazar (geçersiz anahtar);
//     burada "ULUSOY" yazılır.
//  2) Özgün araçtaki `rezerv` dalları ölü koddur (BINA kayıtlarında rezerv alanı yok); taşınmadı.
//  3) Ölçü (dims) saklama: özgün araç bina→prefabrik→monoblok geçişinde bina ölçülerini monoblok
//     saklamasına sızdırır; burada ölçü farkları (dims) her sınıf için ayrı saklanır.
// Geri kalan tuhaflıklar (ör. monoblokta koridor kontrolünün varsayılan ölçülerle hep "bad" çıkması,
// AG bölme uzunluğunun pano GENİŞLİĞİ ile karşılaştırılması) özgün hâliyle korunmuştur.

/* =====================================================================
   VERİ KATALOĞU
===================================================================== */
const dondur = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) dondur(o[k]); } return o; };

/** Hücre derinliği / yüksekliği (katalog sabiti) */
export const HD = 1650, HH = 2250;

// [kod, ad, genişlik mm, ağırlık kg]
const HUCRE_ULUSOY = [
  ['HMH 36-01', 'Yük Ayırıcılı Giriş - Çıkış Hücresi', 750, 500],
  ['HMH 36-02', 'Sigortalı Yük Ayırıcısı Birleşiği', 750, 500],
  ['HMH 36-03', 'Gerilim / İç İhtiyaç Trafosu Hücresi', 750, 500],
  ['HMH 36-04', 'Kesicili Giriş - Çıkış Hücresi', 1000, 800],
  ['HMH 36-04T', 'Kesicili Trafo Koruma Hücresi', 1000, 800],
  ['HMH 36-05', 'Kesicili Bara Bağlama (Kuplaj) Hücresi', 1500, 1000],
  ['HMH 36-06', 'SF6 Gazlı Ayırıcılı Giriş - Çıkış Hücresi', 750, 500],
  ['HMH 36-07', 'Kablo Bağlama Hücresi', 750, 300],
  ['HMH 36-08', 'Yük Ayırıcılı Akım ve Gerilim Ölçü Hücresi', 1150, 800],
  ['HMH 36-09', 'Bara Yükseltme Hücresi', 750, 300],
  ['HMH 36-10', 'Akım Ölçü + Bara Yükseltme Hücresi', 750, 500],
  ['HMH 36-11', 'Akım Ölçü Hücresi', 750, 500],
  ['HMH 36-12', 'Kesicili Bara Bölme Hücresi (Yandan Çıkışlı)', 1000, 800],
  ['HMH 36-13', 'Yük Ayırıcılı Bara Bölme Hücresi (Yandan Çıkışlı)', 750, 500],
  ['HMH 36-14', 'Gerilim Trafolu Kesicili Çıkış Hücresi', 1500, 1000],
  ['HMH 36-15', 'SF6 Gazlı Ayırıcılı Akım Gerilim Ölçü Hücresi', 1150, 800],
  ['HMH 36-16', 'Yük Ayırıcılı Bara Bölme Hücresi (Başkent Tipi)', 1150, 500],
  ['HMH 36-17', 'Parafudr Hücresi', 750, 300],
  ['HMH 36-19', 'YA Akım-Gerilim Ölçü Hücresi (sağ giriş)', 1150, 800],
  ['HMH 36-20', 'YA Akım-Gerilim Ölçü Hücresi (kablo çıkış)', 1150, 800],
  ['YEDEK 1', 'Yedek Hücre Yeri (750 mm)', 750, 0],
  ['YEDEK 2', 'Yedek Hücre Yeri (1000 mm)', 1000, 0],
];
// EVA ve EVA+ aynı işlevler, farklı mahfaza; ağırlıklar genişliğe göre yaklaşık
const EVA_TABAN = [
  ['S', 'YÜK AYIRICILI GİRİŞ-ÇIKIŞ HÜCRESİ', 750, 500],
  ['Sa', 'GAZ AYIRICILI GİRİŞ-ÇIKIŞ HÜCRESİ', 750, 500],
  ['F', 'YÜK AYIRICILI SİG. TRAFO KORUMA HÜCRESİ', 750, 500],
  ['DS', 'YÜK AYIRICILI BARA BÖLME HÜCRESİ', 1000, 800],
  ['B', 'GAZ AYIRICILI KESİCİLİ GİRİŞ-ÇIKIŞ HÜCRESİ', 1000, 800],
  ['Otop', 'OTOPRODÜKTÖR HÜCRESİ', 1400, 900],
  ['CB', 'ÇİFT GAZ AYIRICILI - KESİCİLİ BARA BAĞLAMA (KUPLAJ) HÜCRESİ', 1500, 1000],
  ['CR', 'KABLO BAĞLANTI HÜCRESİ', 750, 500],
  ['McvL', 'YÜK AYIRICILI AKIM-GERİLİM ÖLÇÜ HÜCRESİ', 1000, 800],
  ['McvR', 'AYIRICISIZ AKIM-GERİLİM ÖLÇÜ HÜCRESİ', 1000, 800],
  ['Mvi', 'GAZ AYIRICILI HÜCRE', 750, 500],
  ['McvS', 'GAZ AYIRICILI AKIM-GERİLİM ÖLÇÜ HÜCRESİ', 1000, 800],
  ['Mv', 'GAZ AYIRICILI HÜCRE', 750, 500],
  ['DB', 'KESİCİLİ BARA BÖLME HÜCRESİ', 1750, 1200],
  ['BR', 'BARA YÜKSELTME HÜCRESİ', 750, 500],
];
const HUCRE_EVA = EVA_TABAN.map(([k, ad, w, kg]) => ['eva-36-' + k, ad, w, kg]);
const HUCRE_EVAP = EVA_TABAN.map(([k, ad, w, kg]) => ['eva+-36-' + k, ad, w, kg]);

export const HUCRE_SERI = dondur({
  ULUSOY: { ad: 'Ulusoy HMH 36', liste: HUCRE_ULUSOY },
  EVA: { ad: 'EVA 36 kV', liste: HUCRE_EVA },
  EVAP: { ad: 'EVA+ 36 kV', liste: HUCRE_EVAP },
});
const HUCRE_MAP = new Map([...HUCRE_ULUSOY, ...HUCRE_EVA, ...HUCRE_EVAP].map((h) => [h[0], h]));

/** Monoblok beton köşk tipleri. h/t/a: hücre / trafo / AG pano bölümü net (iç) uzunlukları.
 *  h+t+a + 40×(bölüm sayısı−1) = boy − 220 */
export const KOSK = dondur({
  'MB-2550': { boy: 2550, v: { 1000: { h: 0, t: 1720, a: 570 }, KOK: { h: 2330, t: 0, a: 0 } } },
  'MB-3200': { boy: 3200, v: { KOK: { h: 2980, t: 0, a: 0 }, 1600: { h: 0, t: 2270, a: 670 } } },
  'MB-3800': { boy: 3800, v: { 1000: { h: 0, t: 1700, a: 1840 }, KOK: { h: 3580, t: 0, a: 0 }, 1600: { h: 0, t: 2250, a: 1290 } } },
  'MB-4350': { boy: 4350, v: { 1000: { h: 1780, t: 1700, a: 570 }, KOK: { h: 4130, t: 0, a: 0 } } },
  'MB-4800': { boy: 4800, v: { 1000: { h: 2230, t: 1700, a: 570 }, KOK: { h: 4580, t: 0, a: 0 }, 1600: { h: 1700, t: 2250, a: 550 } } },
  'MB-5450': { boy: 5450, v: { 1000: { h: 2880, t: 1700, a: 570 }, KOK: { h: 5230, t: 0, a: 0 }, 1600: { h: 2330, t: 2250, a: 570 } } },
  'MB-6000': { boy: 6000, v: { 1000: { h: 3430, t: 1700, a: 570 }, KOK: { h: 5780, t: 0, a: 0 }, 1600: { h: 2880, t: 2250, a: 570 } } },
  'MB-6500': { boy: 6500, v: { 1000: { h: 3930, t: 1700, a: 570 }, KOK: { h: 6280, t: 0, a: 0 }, 1600: { h: 3380, t: 2250, a: 570 } } },
  'MB-7500': { boy: 7500, v: { 1000: { h: 4930, t: 1700, a: 570 }, KOK: { h: 7280, t: 0, a: 0 }, 1600: { h: 4380, t: 2250, a: 570 } } },
});
// Not: JS nesnelerinde tamsayı görünümlü anahtarlar önce sıralanır → Object.keys(v) = ["1000","1600","KOK"].
// Bu yüzden MB-3200'ün "ilk" (varsayılan) varyantı özgün araçta da "1600"dür.

export const VARYANT = dondur({
  1000: '≤ 1000 kVA trafolu', 1600: '1250 – 1600 kVA trafolu', KOK: 'KÖK — yalnızca hücre',
  PBK: 'Prefabrik — fabrika tipi yerleşim', BINA: 'Trafo binası — mimari projeye göre', ODA: 'Özel oda — serbest tasarım',
});

/** Üretici kapı ölçü çizimleri: "<kosk>|<varyant>" → h: hücre bölümü kapıları, t: trafo bölümü kapıları */
export const KAPI_TABLO = dondur({
  'MB-2550|1000': { h: [], t: [1500] },
  'MB-3800|1000': { h: [], t: [1500] },
  'MB-4350|1000': { h: [1500], t: [1500] },
  'MB-4800|1000': { h: [1500], t: [1500] },
  'MB-5450|1000': { h: [2000], t: [1500] },
  'MB-3200|1600': { h: [], t: [2000] },
  'MB-3800|1600': { h: [], t: [2000] },
  'MB-4800|1600': { h: [1500], t: [2000] },
  'MB-5450|1600': { h: [1500], t: [2000] },
  'MB-6000|1600': { h: [2000], t: [2000] },
  'MB-6500|1600': { h: [2000], t: [2000] },
  'MB-7500|1600': { h: [2000, 1500], t: [2000] },
  'MB-2550|KOK': { h: [2000], t: [] },
  'MB-3200|KOK': { h: [2000], t: [] },
  'MB-3800|KOK': { h: [2000], t: [] },
  'MB-4350|KOK': { h: [1500, 1500], t: [] },
  'MB-4800|KOK': { h: [1500, 2000], t: [] },
  'MB-5450|KOK': { h: [2000, 2000], t: [] },
  'MB-6000|KOK': { h: [1500, 1500, 1500], t: [] },
  'MB-6500|KOK': { h: [1500, 1500, 1500], t: [] },
  'MB-7500|KOK': { h: [2000, 1500, 2000], t: [] },
});
const KAPI_KADEME = [2000, 1500, 1200, 1000, 900, 800];

/** Prefabrik beton köşk tipleri (fabrika tipi sabit yerleşim). yg: YG mahali [x0,x1] · tr: trafo bölmeleri ·
 *  cift: çift sıra hücre · onSira: ön sıra şeridi · ag: AG panolarının sol x'leri · kapi tip "h"=K1, "t*"=K2 */
export const PKOSK = dondur({
  'PBK-1A': { ad: 'EK-1A', boy: 6800, en: 3800, yg: [100, 4160], tr: [[4200, 6700]], cift: false, ag: [3410],
    kapi: [{ x0: 550, w: 2000, tip: 'h' }, { x0: 4210, w: 2000, tip: 't0' }] },
  'PBK-1B': { ad: 'EK-1B', boy: 10280, en: 3800, yg: [2640, 7640], tr: [[100, 2600], [7680, 10180]], cift: false, hizala: 'orta', ag: [2640, 6890],
    kapi: [{ x0: 550, w: 2000, tip: 't0' }, { x0: 4225, w: 2000, tip: 'h' }, { x0: 7730, w: 2000, tip: 't1' }] },
  'PBK-1C': { ad: 'EK-1C', boy: 10800, en: 5000, yg: [100, 8160], tr: [[8200, 10700]], cift: true, onSira: [100, 4100], ag: [7410],
    kapi: [{ x0: 4360, w: 2000, tip: 'h' }, { x0: 8250, w: 2000, tip: 't0' }] },
});

const BINA_ORTAK = () => ({
  duvar: 190, siva: 40, kolon: 500, kolonCik: 110, sacakCik: 500,
  yuk: { ic: 3140, duvarUst: 3620, mahya: 5100, kapi: 2540, kanal: 700, kot: 520 },
  gecis: { z0: 4180, z1: 6180 },
  panjur: [{ duvar: 'X+', a0: 4555, w: 1200, h: 800, oda: 'trafo' }, { duvar: 'X-', a0: 2090, w: 1200, h: 800, oda: 'salon' }],
});
const KANAL_NOT = 'İHTİYAÇ DUYULDUĞUNDA BU KISMA KABLO KANALI AÇILACAKTIR';
/** MOD tipi trafo binaları. Tüm değerler DIŞ DUVAR YÜZÜ referanslıdır. */
export const BINA = dondur({
  'MOD-5': { ad: 'MOD-5', icX: 8170, icZ: 6490, ...BINA_ORTAK(),
    merdiven: { n: 3, rise: 173, tread: 300, sahanlik: 260, yan: 150, tretuvar: 1050 },
    oda: { x0: 5060, x1: 8360, z0: 3680, z1: 6680, ad: 'TRAFO ODASI' },
    bolmeV: { z0: 3490, z1: 3680, x0: 4870, x1: 8360 },
    bolmeH: { x0: 4870, x1: 5060, z0: 3490, z1: 6680 },
    kapi: [{ ad: 'K1', x0: 5810, w: 2200, h: 2540, oda: 'trafo', panjur: true, merd: false },
      { ad: 'K2', x0: 2280, w: 1500, h: 2540, oda: 'salon', panjur: true, merd: true }],
    hucreX0: 760, hucreX1: 8260, hucreMax: 7500,
    trafo: { xc: 7075, zc: 5230 },
    pano: { x0: 4173, x1: 4667, z0: 4396, z1: 6058 },
    kanal: [{ x0: 230, x1: 7710, z0: 490, z1: 1490, ad: 'hücre kanalı' },
      { x0: 7710, x1: 8210, z0: 1490, z1: 5805, ad: 'bağlantı kanalı' },
      { x0: 4170, x1: 4670, z0: 4680, z1: 6640, ad: 'AG pano kanalı' }],
    donanim: { giris: 1, cikis: 6, koruma: 1 } },
  'MOD-5A': { ad: 'MOD-5A', icX: 13040, icZ: 6490, ...BINA_ORTAK(),
    merdiven: { n: 3, rise: 173, tread: 300, sahanlik: 260, yan: 190, tretuvar: 1050 },
    oda: { x0: 9930, x1: 13230, z0: 3680, z1: 6680, ad: 'TRAFO ODASI' },
    bolmeV: { z0: 3490, z1: 3680, x0: 9740, x1: 13230 },
    bolmeH: { x0: 9740, x1: 9930, z0: 3490, z1: 6680 },
    kapi: [{ ad: 'K1', x0: 10680, w: 2200, h: 2540, oda: 'trafo', panjur: true, merd: false },
      { ad: 'K2', x0: 7150, w: 1500, h: 2540, oda: 'salon', panjur: true, merd: true }],
    araKolon: [{ x0: 4660, x1: 5160 }, { x0: 9540, x1: 10040 }],
    sira2: { x0: 760, x1: 7050, not: KANAL_NOT },
    hucreX0: 760, hucreX1: 13130, hucreMax: 12000,
    trafo: { xc: 11580, zc: 5230 },
    pano: { x0: 9043, x1: 9537, z0: 4396, z1: 6058 },
    kanal: [{ x0: 230, x1: 12610, z0: 490, z1: 1490, ad: 'hücre kanalı' },
      { x0: 12610, x1: 13110, z0: 1490, z1: 5805, ad: 'bağlantı kanalı' },
      { x0: 9040, x1: 9540, z0: 4680, z1: 6640, ad: 'AG pano kanalı' }],
    donanim: { giris: 1, cikis: 10, koruma: 1 } },
  'MOD-5B': { ad: 'MOD-5B', icX: 16960, icZ: 6490, ...BINA_ORTAK(),
    merdiven: { n: 3, rise: 173, tread: 300, sahanlik: 260, yan: 190, tretuvar: 1050 },
    oda: { x0: 13850, x1: 17150, z0: 3680, z1: 6680, ad: 'TRAFO ODASI' },
    bolmeV: { z0: 3490, z1: 3680, x0: 13660, x1: 17150 },
    bolmeH: { x0: 13660, x1: 13850, z0: 3490, z1: 6680 },
    kapi: [{ ad: 'K1', x0: 14590, w: 2200, h: 2540, oda: 'trafo', panjur: true, merd: false },
      { ad: 'K2', x0: 11060, w: 1500, h: 2540, oda: 'salon', panjur: true, merd: true }],
    araKolon: [{ x0: 3190, x1: 3690 }, { x0: 8170, x1: 8670 }, { x0: 8710, x1: 9210 }, { x0: 13650, x1: 14150 }],
    dilatasyon: 8690,
    sira2: { x0: 760, x1: 10800, not: KANAL_NOT },
    hucreX0: 760, hucreX1: 17050, hucreMax: 15750,
    trafo: { xc: 15500, zc: 5230 },
    pano: { x0: 12963, x1: 13457, z0: 4396, z1: 6058 },
    kanal: [{ x0: 230, x1: 16530, z0: 490, z1: 1490, ad: 'hücre kanalı' },
      { x0: 16530, x1: 17030, z0: 1490, z1: 5805, ad: 'bağlantı kanalı' },
      { x0: 12960, x1: 13460, z0: 4680, z1: 6640, ad: 'AG pano kanalı' }],
    donanim: { giris: 1, cikis: 14, koruma: 1 } },
});

/** [kVA, toplam ağırlık kg] */
export const TRAFO = dondur([
  [25, 395], [50, 625], [100, 840], [125, 900], [160, 980], [200, 1125], [250, 1305], [315, 1525], [400, 1815], [500, 2075],
  [630, 2410], [800, 2785], [1000, 3125], [1250, 3410], [1600, 4090], [2000, 4850], [2500, 5550],
]);
/** Hermetik dağıtım trafosu gabarisi: [A uzunluk, B genişlik (radyatör dâhil), C toplam yükseklik, D kazan yüksekliği, F ray açıklığı, kg]
 *  A köşk enine (Z), B köşk boyuna (X) gelir. */
export const TRAFO_OLCU = dondur({
  25: [880, 650, 1205, 720, 520, 395],
  50: [1005, 685, 1295, 810, 520, 625],
  100: [1040, 705, 1410, 925, 520, 840],
  125: [1060, 710, 1435, 950, 520, 900],
  160: [1090, 720, 1465, 980, 520, 980],
  200: [1120, 725, 1500, 1015, 520, 1125],
  250: [1160, 735, 1545, 1060, 520, 1305],
  315: [1225, 820, 1600, 1115, 670, 1525],
  400: [1305, 935, 1670, 1185, 670, 1815],
  500: [1360, 950, 1650, 1245, 670, 2075],
  630: [1435, 965, 1625, 1325, 670, 2410],
  800: [1540, 1025, 1665, 1365, 820, 2785],
  1000: [1580, 1055, 1800, 1460, 820, 3125],
  1250: [1665, 1085, 1970, 1485, 820, 3410],
  1600: [1735, 1190, 2100, 1615, 820, 4090],
  2000: [1835, 1310, 2135, 1650, 1070, 4850],
  2500: [2580, 1365, 2175, 1760, 1070, 5550],
});
/** AG dağıtım panoları: [ad, A genişlik, B yükseklik, C derinlik, ağırlık, ek, kVA listesi] */
export const PANO = dondur([
  ['≤ 400 kVA (25–400)', 1150, 1800, 450, 420, 'EK-II/5', [25, 50, 100, 125, 160, 200, 250, 315, 400]],
  ['630-800-1000 kVA', 1500, 1800, 450, 560, 'EK-II/9', [630, 800, 1000]],
  ['1250 kVA ve üzeri', 1650, 1800, 450, 660, 'EK-II/11', [1250, 1600, 2000, 2500]],
]);

/** Sınıfa göre varsayılan yapısal ölçüler (dw ve en her zaman kabuktan gelir) */
export const VARSAYILAN_DIMS = dondur({
  mono: { dw: 110, t: 690, h: 2650, ct: 150, en: 2500, arka: 100, yan: 100 },
  pref: { dw: 100, t: 800, h: 3040, ct: 100, en: 3800, arka: 100, yan: 100 },
  bina: { dw: 190, t: 700, h: 3620, ct: 1480, en: 6870, arka: 100, yan: 100 },
});

const VARSAYILAN_HUCRELER = () => [{ c: 'HMH 36-01', f: 'GİRİŞ FİDERİ', y: 'g' }, { c: 'HMH 36-04T', f: 'TRAFO KORUMA H.', y: 'c' }];

/* =====================================================================
   KÜÇÜK YARDIMCILAR
===================================================================== */
const temiz = (s) => String(s == null ? '' : s).replace(/<br\s*\/?>/g, ' ').replace(/<\/?(?:b|small|span|em|i)\b[^>]*>/g, '');
const kopya = (o) => JSON.parse(JSON.stringify(o));
const hKopya = (l) => (l || []).map((o) => ({ ...o }));
const sinifOf = (kosk) => (BINA[kosk] ? 'bina' : PKOSK[kosk] ? 'pref' : KOSK[kosk] ? 'mono' : null);
const ilkVaryant = (kosk) => Object.keys(KOSK[kosk].v)[0];

export function hucreRec(code) { return HUCRE_MAP.get(code); }
export function hucreListesi(seri) { return (HUCRE_SERI[seri] || HUCRE_SERI.ULUSOY).liste; }
/** Trafo koruma hücresi (seriden bağımsız): Ulusoy 36-04T / 36-02, EVA -36-F */
export function trafoKorumaMi(c) { c = String(c); return c.includes('36-04T') || c.includes('36-02') || /-36-F$/.test(c); }
export function kesiciliKorumaMi(c) { return String(c).includes('36-04T'); }

const ISLEV_ULUSOY = {
  '01': 'YA', '06': 'YA', '02': 'SYA', '03': 'GT', '04': 'KE', '04T': 'KE', 14: 'KE', '05': 'KUPLAJ', '07': 'KABLO',
  '08': 'OLCU', 10: 'OLCU', 11: 'OLCU', 15: 'OLCU', 19: 'OLCU', 20: 'OLCU', '09': 'BARA', 12: 'BARA', 13: 'BARA', 16: 'BARA', 17: 'PF',
};
const ISLEV_EVA = {
  S: 'YA', Sa: 'YA', F: 'SYA', B: 'KE', CB: 'KUPLAJ', CR: 'KABLO', McvL: 'OLCU', McvR: 'OLCU', McvS: 'OLCU',
  DS: 'BARA', DB: 'BARA', BR: 'BARA', Otop: 'DIGER', Mvi: 'DIGER', Mv: 'DIGER',
};
/** Metraj için kaba işlev sınıfı: YA · SYA · KE · KUPLAJ · OLCU · GT · BARA · KABLO · PF · YEDEK · DIGER */
export function hucreIslev(code) {
  code = String(code || '');
  if (code.startsWith('YEDEK')) return 'YEDEK';
  let m = code.match(/^HMH 36-(.+)$/);
  if (m) return ISLEV_ULUSOY[m[1]] || 'DIGER';
  m = code.match(/^eva\+?-36-(.+)$/);
  if (m) return ISLEV_EVA[m[1]] || 'DIGER';
  return 'DIGER';
}

export function trafoRec(kva) { return TRAFO.find((t) => t[0] === kva) || TRAFO[10]; }
export function trafoGabari(k) {
  const g = TRAFO_OLCU[k] || TRAFO_OLCU[630];
  return { U: g[0], G: g[1], C: g[2], Y: g[3], ray: g[4], kg: g[5], rad: Math.round(g[1] * 0.13) };
}
export function rayAcikligi(k) { const g = TRAFO_OLCU[k]; return g ? g[4] : (k <= 250 ? 520 : (k <= 630 ? 670 : (k <= 1600 ? 820 : 1070))); }
/** trafo gücüne karşılık gelen standart pano (2000/2500 kVA için en büyük tip) */
export function panoIcinKva(kva) { for (const p of PANO) if (p[6].some((v) => v >= kva)) return p; return PANO[PANO.length - 1]; }
export function tipSinifi(f) { if (f <= 5500) return 'TİP-1A (≤5500)'; if (f <= 6500) return 'TİP-1B (≤6500)'; if (f <= 7500) return 'TİP-1C (≤7500)'; return null; }
const koskBos = (boy) => Math.round(boy * 2.95 / 50) * 50;              // monoblok yaklaşık boş ağırlık
const prefBos = (P) => Math.round(P.boy * P.en * 0.00115 / 50) * 50;    // prefabrik yaklaşık boş ağırlık
/** trafo–AG pano arası kablo (Şartname Tablo:6) */
export function agKablo(k) {
  const T = { 250: '1x185', 400: '2x185', 630: '3x185', 800: '3x185', 1000: '4x185', 1250: '4x240', 1600: '6x240', 2000: '7x240', 2500: '9x240' };
  const keys = [250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500];
  return 'N2XH ' + T[keys.find((x) => k <= x) || 1600] + ' mm²';
}

/** MOD binası elektrik projesindeki hücre dizisi: giriş + N×çıkış + trafo koruma */
export function projeDonanimi(kosk) {
  const B = BINA[kosk]; if (!B) return [];
  const D = B.donanim || { giris: 1, cikis: 6, koruma: 1 };
  const L = [];
  for (let i = 0; i < (D.giris || 0); i++) L.push({ c: 'HMH 36-01', f: 'GİRİŞ', y: 'g' });
  for (let i = 1; i <= (D.cikis || 0); i++) L.push({ c: 'HMH 36-04', f: 'F' + i, y: 'c' });
  for (let i = 0; i < (D.koruma || 0); i++) L.push({ c: 'HMH 36-02', f: 'TRAFO', y: 'c' });
  return L;
}

/* --- kabin normalizasyonu: eksik/geçersiz alanlar özgün aracın düştüğü varsayılanlara çekilir --- */
function norm(cabin) {
  const c = cabin || {};
  let kosk = c.kosk, sinif = sinifOf(kosk);
  if (!sinif) { sinif = ['mono', 'pref', 'bina'].includes(c.sinif) ? c.sinif : 'mono'; kosk = { mono: 'MB-4800', pref: 'PBK-1A', bina: 'MOD-5' }[sinif]; }
  let varyant = c.varyant == null ? '' : String(c.varyant);
  if (sinif === 'bina') varyant = 'BINA';
  else if (sinif === 'pref') { if (varyant !== 'KOK') varyant = 'PBK'; }
  else if (!KOSK[kosk].v[varyant]) varyant = ilkVaryant(kosk);
  const trafoKva = Number(c.trafoKva) || 630;
  return {
    sinif, kosk, varyant, trafoKva,
    trafoAdet: c.trafoAdet,
    trafoKg: c.trafoKg != null ? Number(c.trafoKg) : trafoRec(trafoKva)[1],
    hucreSeri: HUCRE_SERI[c.hucreSeri] ? c.hucreSeri : 'ULUSOY',
    hucreler: Array.isArray(c.hucreler) ? c.hucreler.map((h) => (typeof h === 'string' ? { c: h, f: '', y: 'c' } : h)) : [],
    dimsFark: c.dims || null,
    kanallar: Array.isArray(c.kanallar) ? c.kanallar : [],
  };
}
/** köşk sınıfına göre kabuk geometrisi (özgün applyGeo) */
function kabuk(kosk) {
  if (BINA[kosk]) { const B = BINA[kosk]; return { DUVAR: B.duvar, BOLME_D: B.duvar, DIS_EN: B.icZ + 2 * B.duvar, IC_EN: B.icZ, DIS_YUK: B.yuk.mahya }; }
  if (PKOSK[kosk]) { const P = PKOSK[kosk]; return { DUVAR: 100, BOLME_D: 40, DIS_EN: P.en, IC_EN: P.en - 200, DIS_YUK: 3940 }; }
  return { DUVAR: 110, BOLME_D: 40, DIS_EN: 2500, IC_EN: 2280, DIS_YUK: 3550 };
}
/** Etkin yapısal ölçüler: sınıf varsayılanı + cabin.dims farkları; dw ve en kabuktan zorlanır */
export function etkinDims(cabin) {
  const n = norm(cabin), G = kabuk(n.kosk);
  return { ...VARSAYILAN_DIMS[n.sinif], ...(n.dimsFark || {}), dw: G.DUVAR, en: G.DIS_EN };
}

/* =====================================================================
   KAPI DAĞILIMI
===================================================================== */
/** yedek kural — üretici çizimi olmayan varyantlar için */
export function kapiKural(L, tip) {
  if (L <= 0) return [];
  if (tip === 'trafo') return [Math.min(2000, Math.max(800, Math.floor((L - 200) / 50) * 50))];
  const sigar = (w) => { const paye = w.some((x) => x >= 2000) ? 250 : 100; return w.reduce((a, b) => a + b, 0) + (w.length + 1) * paye <= L; };
  const coz = (n) => {
    const ws = new Array(n).fill(2000);
    while (!sigar(ws)) {
      let i = -1;
      for (let k = ws.length - 1; k >= 0; k--) { if (KAPI_KADEME.indexOf(ws[k]) < KAPI_KADEME.length - 1) { i = k; break; } }
      if (i < 0) break;
      ws[i] = KAPI_KADEME[KAPI_KADEME.indexOf(ws[i]) + 1];
    }
    return ws;
  };
  let n = 1 + (L > 3600 ? 1 : 0) + (L > 5400 ? 1 : 0) + (L > 7400 ? 1 : 0), ws = coz(n);
  while (n > 1 && ws.some((w) => w < 1200)) { n--; ws = coz(n); }
  return ws;
}
function kapiGenislikleri(n, L, tip) {
  if (n.sinif === 'pref') return PKOSK[n.kosk].kapi.filter((k) => (tip === 'trafo' ? k.tip.charAt(0) === 't' : k.tip === 'h')).map((k) => k.w);
  const rec = KAPI_TABLO[n.kosk + '|' + n.varyant];
  if (rec) return (tip === 'trafo' ? rec.t : rec.h).slice();
  return kapiKural(L, tip);
}
/** bölme içindeki kapı merkezleri (mutlak x) — eşit boşluklu dağılım */
function kapiYerlesimi(n, x0, L, tip) {
  const ws = kapiGenislikleri(n, L, tip);
  if (!ws.length) return [];
  const bosluk = (L - ws.reduce((a, b) => a + b, 0)) / (ws.length + 1);
  const out = []; let cur = x0;
  for (const w of ws) { cur += bosluk; out.push({ c: cur + w / 2, w }); cur += w; }
  return out;
}

/* =====================================================================
   YERLEŞİM HESABI (özgün layout / layoutPref / layoutBina)
===================================================================== */
const gen = (o) => (hucreRec(o.c) ? hucreRec(o.c)[2] : 0);

/** Hücreleri sıralara dağıtır: `s` "1"/"2" sabit sıra, yoksa 1. sıra dolana kadar oraya, sonra karşıya */
function siraDagit(hucreler, kap1, onNet, cift) {
  const arka = [], on = [], tasan = new Set(); let aW = 0, oW = 0;
  hucreler.forEach((o, i) => {
    const w = gen(o);
    const hedef = !cift ? 1 : (o.s === '1' ? 1 : o.s === '2' ? 2 : 0);
    const sira = hedef || ((aW + w <= kap1) ? 1 : 2);
    if (sira === 1) { arka.push(i); aW += w; if (aW > kap1) tasan.add(i); } else { on.push(i); oW += w; if (oW > onNet) tasan.add(i); }
  });
  return { arka, on, aW, oW, tasan };
}

function layoutMono(n, G, D) {
  const KT = KOSK[n.kosk], B = KT.v[n.varyant] || KT.v[ilkVaryant(n.kosk)];
  const { DUVAR, BOLME_D, DIS_EN, IC_EN, DIS_YUK } = G;
  const K = { ad: n.kosk, boy: KT.boy, agirlik: koskBos(KT.boy) };
  const disBoy = KT.boy, disEn = DIS_EN, icEn = IC_EN, icBoy = disBoy - 2 * DUVAR;
  const hasT = B.t > 0, hasAG = B.a > 0, hasHucre = B.h > 0;
  const bolme = BOLME_D, trafoBol = B.t, agBol = B.a, ygLen = B.h;
  const yanBos = hasHucre ? D.yan : 0;
  const kullan = hasHucre ? ygLen - 2 * yanBos : 0;
  const hucreW = n.hucreler.reduce((a, o) => a + gen(o), 0);
  const koridor = icEn - D.arka - HD;
  let cur = DUVAR;
  const ygX = [cur, cur + ygLen]; if (hasHucre) cur = ygX[1] + bolme;
  const trX = [cur, cur + trafoBol]; if (hasT) cur = trX[1] + bolme;
  const agX = [cur, cur + agBol];
  const hucX = [ygX[0] + yanBos, ygX[0] + yanBos + kullan];
  return { mono: true, B, K, disBoy, disEn, icEn, icBoy, hasT, hasAG, hasHucre, kisaKapi: hasAG, bolme, trafoBol, agBol, ygLen, hucreW, yanBos, kullan,
    kalan: kullan - hucreW, koridor, disYuk: DIS_YUK, ygX, hucX, trX, agX };
}

function layoutPref(n, G, D) {
  const P = PKOSK[n.kosk];
  const { DUVAR, BOLME_D, DIS_EN, IC_EN, DIS_YUK } = G;
  const KOK = n.varyant === 'KOK';
  const K = { ad: n.kosk + ' (' + P.ad + (KOK ? ' · KÖK' : '') + ')', boy: P.boy, agirlik: prefBos(P) };
  const disBoy = P.boy, disEn = DIS_EN, icEn = IC_EN, icBoy = disBoy - 2 * DUVAR;
  const ygX = KOK ? [DUVAR, disBoy - DUVAR] : P.yg.slice();
  const trB = KOK ? [] : P.tr.map((t) => t.slice());
  const ygLen = ygX[1] - ygX[0];
  const bolmeX = [];
  for (const tb of trB) {
    if (tb[0] > DUVAR + 1) bolmeX.push(tb[0] - BOLME_D);
    if (tb[1] < disBoy - DUVAR - 1) bolmeX.push(tb[1]);
  }
  const yanBos = D.yan;
  const arkaNet = ygLen - 2 * yanBos;
  const onNet = P.cift ? (P.onSira[1] - P.onSira[0] - 2 * yanBos) : 0;
  // trafo adedi: EK-1B'de 1 veya 2. Tek trafoda asıl bölme SAĞDAKİDİR, soldaki yedek kalır.
  const nAkt = trB.length > 1 ? Math.min(Math.max(n.trafoAdet || trB.length, 1), trB.length) : 1;
  const trAkt = KOK ? [] : trB.slice(trB.length - nAkt);
  const trYedek = KOK ? [] : trB.slice(0, trB.length - nAkt);
  const agSec = KOK ? [] : (P.tr.length > 1 ? P.ag.slice(P.ag.length - nAkt) : P.ag);
  const agPanolar = agSec.map((x0) => ({ x0, w: 750, d: 1750, z0: DUVAR + IC_EN - 1750 - 150 }));
  // Tek sıra hücre alanı AG pano hizalarıyla sınırlanır (pano önüne hücre konulamaz)
  let hucSol = ygX[0] + yanBos, hucSag = ygX[1] - yanBos;
  if (!P.cift) for (const ap of agPanolar) {
    if (ap.x0 + ap.w / 2 < (ygX[0] + ygX[1]) / 2) hucSol = Math.max(hucSol, ap.x0 + ap.w);
    else hucSag = Math.min(hucSag, ap.x0);
  }
  const hucNet = hucSag - hucSol;
  const kap1 = P.cift ? arkaNet : hucNet;
  const DG = siraDagit(n.hucreler, kap1, onNet, !!P.cift);
  const hucreW = DG.aW + DG.oW, kullan = P.cift ? arkaNet + onNet : hucNet;
  let hucBas = hucSol;
  if (P.hizala === 'orta' && !P.cift && hucreW > 0 && hucreW <= hucNet) hucBas = hucSol + Math.round((hucNet - hucreW) / 2);
  const koridor = P.cift ? icEn - 2 * (D.arka + HD) : icEn - D.arka - HD;
  return { pref: true, P, K, disBoy, disEn, icEn, icBoy, kok: KOK,
    hasT: !KOK, hasAG: false, hasHucre: true, kisaKapi: false,
    bolme: BOLME_D, trafoBol: trB.length ? trB[0][1] - trB[0][0] : 0, agBol: 0, ygLen,
    hucreW, yanBos, kullan, kalan: kullan - hucreW, koridor, disYuk: DIS_YUK,
    ygX, hucX: [hucBas, hucSag], hucSol, hucSag, hucNet,
    hucXOn: P.cift ? [P.onSira[0] + yanBos, P.onSira[1] - yanBos] : null,
    trX: trAkt[0] || [0, 0], trB, trAkt, trYedek, agX: [0, 0], bolmeX,
    kapi: P.kapi.map((k) => (KOK ? { ...k, tip: 'h' } : { ...k })),
    arka: DG.arka, on: DG.on, arkaW: DG.aW, onW: DG.oW, arkaNet, onNet, tasan: DG.tasan, agPanolar };
}

function layoutBina(n, G, D) {
  const B = BINA[n.kosk];
  const dw = B.duvar, disBoy = B.icX + 2 * dw, disEn = B.icZ + 2 * dw;
  const K = { ad: B.ad + ' trafo binası', boy: disBoy, agirlik: 0 };
  const ybMin = Math.max(100, D.yan);                    // yan duvar boşluğu en az 100 mm
  // Köşe kolonları: hücre sırası kolonun yanında biter, kolon yüzüne 100 mm boşluk kalır
  const KOLBOS = 100;
  const koseSol = { x0: -(B.kolonCik || 0), x1: (B.kolon || 0) - (B.kolonCik || 0) };
  const koseSag = { x0: disBoy - (B.kolon || 0) + (B.kolonCik || 0), x1: disBoy + (B.kolonCik || 0) };
  const solSinir = Math.max(dw + ybMin, koseSol.x1 + KOLBOS);
  const sagSinir = Math.min(dw + B.icX - ybMin, koseSag.x0 - KOLBOS);
  const tercihSol = Math.max(B.hucreX0, solSinir);
  const hucSag = Math.min(B.hucreX1 != null ? B.hucreX1 : sagSinir, sagSinir);
  const kullan = Math.min(B.hucreMax, hucSag - solSinir);
  const S2 = B.sira2 || null;
  const s2Sol = S2 ? Math.max(S2.x0, solSinir) : 0, s2Sag = S2 ? Math.min(S2.x1, sagSinir) : 0;
  const onNet = S2 ? s2Sag - s2Sol : 0;
  const DG = siraDagit(n.hucreler, kullan, onNet, !!S2);
  const aW = DG.aW, oW = DG.oW;
  // sıra sağ uçtaki kolon boşluğuna sığmıyorsa sola kaydırılır
  const hucSol = (tercihSol + aW <= hucSag + 0.5) ? tercihSol : Math.max(solSinir, hucSag - aW);
  const hucreW = aW + oW;
  const G0 = trafoGabari(n.trafoKva);
  const trX = [B.trafo.xc - G0.G / 2, B.trafo.xc + G0.G / 2];
  const oda = B.oda, odaX = oda.x1 - oda.x0, odaZ = oda.z1 - oda.z0;
  // Ara kolonlar duvar iç yüzünden oda içine taşar; sıranın x aralığına girenler sırt boşluğunu büyütür
  const kolTas = Math.max(0, (B.kolon || 0) - (B.kolonCik || 0) - dw);
  const satirdaKolon = (B.araKolon || []).some((a) => a.x1 > hucSol && a.x0 < hucSag);
  const kolonPay = satirdaKolon ? kolTas + 100 : 0;
  const arkaMin = Math.max(100, D.arka, kolonPay);
  const kb = (B.kanal || []).find((k) => /bağlantı/i.test(k.ad || ''));
  return { bina: true, B, K, disBoy, disEn, icEn: B.icZ, icBoy: B.icX,
    hasT: true, hasAG: false, hasHucre: true, kisaKapi: false,
    bolme: dw, trafoBol: odaX, agBol: 0, ygLen: B.icX,
    hucreW, yanBos: ybMin, arkaBos: arkaMin, kolonPay, kolonTasma: kolTas, kullan: kullan + onNet, kalan: (kullan + onNet) - hucreW, tasan: DG.tasan,
    sira1Net: kullan, sira2Net: onNet, sira1W: aW, sira2W: oW,
    koridor: B.icZ - arkaMin - HD, disYuk: B.yuk.mahya,
    ygX: [dw, dw + B.icX], hucX: [hucSol, hucSag],
    hucXOn: S2 ? [s2Sol, s2Sag] : null, sira2: S2,
    trX, trB: [trX], trAkt: [trX], trYedek: [], agX: [0, 0], bolmeX: [],
    trafoXc: B.trafo.xc, trafoZc: B.trafo.zc,
    ogInX: kb ? Math.round((kb.x0 + kb.x1) / 2) : B.oda.x1 - 400,
    oda, odaX, odaZ, gecis: B.gecis, kapi: B.kapi, panjur: B.panjur,
    merdiven: B.merdiven, kot: B.yuk.kot, araKolon: B.araKolon || [], dilatasyon: B.dilatasyon || null,
    arka: DG.arka, on: DG.on,
    pano: B.pano, kanal: B.kanal,
    arkaNet: kullan, onNet, hucNet: kullan, hucSol, hucSag,
    agPanolar: [{ x0: B.pano.x0, w: B.pano.x1 - B.pano.x0, d: B.pano.z1 - B.pano.z0, z0: B.pano.z0 }] };
}

/** iç kullanım: özgün layout() ile aynı alan adlarını taşıyan ham yerleşim */
function hamYerlesim(cabin) {
  const n = norm(cabin), G = kabuk(n.kosk);
  const D = { ...VARSAYILAN_DIMS[n.sinif], ...(n.dimsFark || {}), dw: G.DUVAR, en: G.DIS_EN };
  const L = n.sinif === 'bina' ? layoutBina(n, G, D) : n.sinif === 'pref' ? layoutPref(n, G, D) : layoutMono(n, G, D);
  return { n, G, D, L };
}

/** hücre sıralarında kullanılmayan (boş) şeritler — rezerv olarak taranır */
function bosSeritler(L) {
  if (!L.hasHucre) return [];
  const out = [];
  const cift = !!L.hucXOn;
  const w1 = cift ? (L.bina ? (L.sira1W || 0) : (L.arkaW || 0)) : (L.hucreW || 0);
  if (L.hucX) { const x0 = L.hucX[0] + w1, x1 = L.hucX[1]; if (x1 - x0 > 300) out.push({ x0, x1, sira: 1 }); }
  if (cift) { const w2 = L.bina ? (L.sira2W || 0) : (L.onW || 0); const x0 = L.hucXOn[0] + w2, x1 = L.hucXOn[1]; if (x1 - x0 > 300) out.push({ x0, x1, sira: 2 }); }
  return out;
}

function tipKoduAuto(n, L) {
  if (L.bina) return `${n.kosk} TRAFO BİNASI_${n.trafoKva}(hd)`;
  if (L.pref) return L.kok ? `${n.kosk} / PREFABRİK ${L.P.ad}_KÖK(hd)` : `${n.kosk} / PREFABRİK ${L.P.ad}_${n.trafoKva}${(L.trAkt || L.trB).length > 1 ? 'x2' : ''}(hd)`;
  if (n.varyant === 'KOK') return `${n.kosk} — KÖK (trafosuz)`;
  const ts = tipSinifi(L.disBoy) || '';
  const harf = ts.includes('1A') ? 'A' : ts.includes('1B') ? 'B' : ts.includes('1C') ? 'C' : '?';
  return `${n.kosk} / BK-TIP1${harf}_${n.trafoKva}(hd)`;
}

/**
 * Yerleşim — özgün layout() sonucunun düz veri hâli (mm, sol dış köşe orijin, X boy, Z derinlik).
 */
export function yerlesim(cabin) {
  const { n, G, D, L } = hamYerlesim(cabin);
  const dw = G.DUVAR, arkaB = L.arkaBos || D.arka;
  const cift = !!L.hucXOn;
  const P = panoIcinKva(n.trafoKva);

  // --- bölümler ---
  const bolmeler = [], bolmeDuvar = [];
  if (L.bina) {
    const B = L.B;
    bolmeler.push({ ad: 'hucre', x0: dw, x1: dw + B.icX });
    bolmeler.push({ ad: 'trafo', x0: B.oda.x0, x1: B.oda.x1, z0: B.oda.z0, z1: B.oda.z1 });
    bolmeDuvar.push({ x0: B.bolmeV.x0, x1: B.bolmeV.x1, z0: B.bolmeV.z0, z1: B.bolmeV.z1 });
    bolmeDuvar.push({ x0: B.bolmeH.x0, x1: B.bolmeH.x1, z0: B.bolmeH.z0, z1: B.gecis.z0 });
    if (B.bolmeH.z1 - B.gecis.z1 > 0) bolmeDuvar.push({ x0: B.bolmeH.x0, x1: B.bolmeH.x1, z0: B.gecis.z1, z1: B.bolmeH.z1 });
  } else if (L.pref) {
    bolmeler.push({ ad: 'hucre', x0: L.ygX[0], x1: L.ygX[1] });
    for (const tb of L.trB) bolmeler.push({ ad: 'trafo', x0: tb[0], x1: tb[1], aktif: L.trAkt.some((a) => a[0] === tb[0]) });
    for (const bx of L.bolmeX) bolmeDuvar.push({ x0: bx, x1: bx + L.bolme, z0: dw, z1: dw + L.icEn });
  } else {
    if (L.hasHucre) bolmeler.push({ ad: 'hucre', x0: L.ygX[0], x1: L.ygX[1] });
    if (L.hasT) bolmeler.push({ ad: 'trafo', x0: L.trX[0], x1: L.trX[1] });
    if (L.hasAG) bolmeler.push({ ad: 'ag', x0: L.agX[0], x1: L.agX[1] });
    if (L.hasHucre && L.hasT) bolmeDuvar.push({ x0: L.ygX[1], x1: L.ygX[1] + L.bolme, z0: dw, z1: dw + L.icEn });
    if (L.hasT && L.hasAG) bolmeDuvar.push({ x0: L.trX[1], x1: L.trX[1] + L.bolme, z0: dw, z1: dw + L.icEn });
  }

  // --- sıralar + hücre konumları (özgün çizim döngüsü: sıra başından itibaren yan yana) ---
  const siralar = [];
  const hucreler = n.hucreler.map((o, i) => { const h = hucreRec(o.c);
    return { i, c: o.c, ad: h ? h[1] : '', w: h ? h[2] : 0, kg: h ? h[3] : 0, f: o.f || '', y: o.y || 'c', islev: hucreIslev(o.c), x0: null, x1: null, z0: null, z1: null, sira: 'arka', sigar: false }; });
  if (L.hasHucre) {
    const diz = (idx, ad, x0, x1, z0, net, dolu) => {
      siralar.push({ ad, x0, x1, net, dolu });
      let cx = x0;
      for (const i of idx) {
        const hc = hucreler[i]; hc.sira = ad;
        if (!hucreRec(hc.c)) continue;
        hc.x0 = cx; hc.x1 = cx + hc.w; hc.z0 = z0; hc.z1 = z0 + HD; hc.sigar = (cx + hc.w) <= x1 + 0.5;
        cx += hc.w;
      }
    };
    const zArka = dw + arkaB, zOn = L.disEn - dw - arkaB - HD;
    if (cift) {
      diz(L.arka, 'arka', L.hucX[0], L.hucX[1], zArka, L.bina ? L.sira1Net : L.arkaNet, L.bina ? L.sira1W : L.arkaW);
      diz(L.on, 'on', L.hucXOn[0], L.hucXOn[1], zOn, L.bina ? L.sira2Net : L.onNet, L.bina ? L.sira2W : L.onW);
    } else {
      diz(n.hucreler.map((_, i) => i), 'arka', L.hucX[0], L.hucX[1], zArka, L.bina ? L.sira1Net : (L.pref ? L.hucNet : L.kullan), L.hucreW);
    }
  }

  // --- trafo(lar) ---
  const G0 = trafoGabari(n.trafoKva), trafo = [];
  if (L.hasT) {
    if (L.bina) trafo.push({ kva: n.trafoKva, xc: L.trafoXc, zc: L.trafoZc, U: G0.U, G: G0.G, aktif: true });
    else for (const TB of (L.pref ? L.trB : [L.trX])) {
      trafo.push({ kva: n.trafoKva, xc: (TB[0] + TB[1]) / 2, zc: dw + L.icEn / 2, U: G0.U, G: G0.G,
        aktif: L.pref ? L.trAkt.some((a) => a[0] === TB[0]) : true });
    }
  }

  // --- AG pano(lar) — çizilen gövde (planda derinlik C × genişlik A) ---
  const pano = [];
  const panoEk = { ad: P[0], gen: P[1], yuk: P[2], der: P[3], kg: P[4] };
  if (L.hasAG) {
    const cx = (L.agX[0] + L.agX[1]) / 2, pd = Math.min(P[3], L.agBol - 80), PW = Math.min(P[1], L.icEn - 200), cz = L.disEn / 2;
    pano.push({ x0: cx - pd / 2, x1: cx + pd / 2, z0: cz - PW / 2, z1: cz + PW / 2, ...panoEk });
  }
  if (L.pref || L.bina) for (const ap of L.agPanolar) {
    const cx = ap.x0 + ap.w / 2, cz = ap.z0 + ap.d / 2;
    pano.push({ x0: cx - P[3] / 2, x1: cx + P[3] / 2, z0: cz - P[1] / 2, z1: cz + P[1] / 2, ...panoEk,
      yuva: { x0: ap.x0, x1: ap.x0 + ap.w, z0: ap.z0, z1: ap.z0 + ap.d } });
  }

  // --- kapılar ---
  const kapilar = [];
  if (L.bina) for (const k of L.kapi) kapilar.push({ x0: k.x0, w: k.w, tip: k.oda === 'trafo' ? 'trafo' : 'hucre', duvar: 'on', ad: k.ad, h: k.h, panjur: !!k.panjur, merd: k.merd !== false });
  else if (L.pref) for (const k of L.kapi) kapilar.push({ x0: k.x0, w: k.w, tip: k.tip === 'h' ? 'hucre' : 'trafo', duvar: 'on', ad: k.tip === 'h' ? 'K1' : 'K2', h: 2400, panjur: k.tip.charAt(0) === 't' });
  else {
    const kh = Math.min(2400, D.h - 100);
    if (L.hasHucre) for (const k of kapiYerlesimi(n, L.ygX[0], L.ygLen, 'hucre')) kapilar.push({ x0: k.c - k.w / 2, w: k.w, tip: 'hucre', duvar: 'on', h: kh, panjur: false });
    if (L.hasT) for (const k of kapiYerlesimi(n, L.trX[0], L.trafoBol, 'trafo')) kapilar.push({ x0: k.c - k.w / 2, w: k.w, tip: 'trafo', duvar: 'on', h: kh, panjur: true });
    // AG pano kapısı kısa kenarda (X+ ucu); x0 = duvar boyunca (Z) başlangıç. Ölçü özgün PLAN çizimindeki gibidir
    // (iç en − 440); özgün 3B çizim aynı kapıyı min(iç en − 280, 2000) genişlikte çizer.
    if (L.hasAG) kapilar.push({ x0: dw + 220, w: L.icEn - 440, tip: 'ag', duvar: 'sag', h: kh, panjur: false });
  }

  // --- kablo kanalları ---
  const kanallar = [];
  const kanalEkle = (k, ek) => { const kw = k.x1 - k.x0, kd = k.z1 - k.z0;
    kanallar.push({ ad: k.ad, x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1, boy: Math.max(kw, kd), gen: Math.min(kw, kd), ...ek }); };
  if (L.bina) {
    const DK = L.B.yuk.kanal;
    for (const kn0 of L.kanal) {
      let kn = kn0, katalog;
      // AG pano kanalı, panonun güncel ölçüsüne (trafo gücüne bağlı) hizalanır — özgün 3B kodundaki gibi
      if (/AG pano/i.test(kn0.ad || '') && L.agPanolar.length) {
        const ap0 = L.agPanolar[0], cx0 = ap0.x0 + ap0.w / 2, cz0 = ap0.z0 + ap0.d / 2, ins = 140;
        kn = { ...kn0, x0: cx0 - P[3] / 2 + ins, x1: cx0 + P[3] / 2 - ins, z0: cz0 - P[1] / 2 + ins, z1: cz0 + P[1] / 2 - ins };
        katalog = { x0: kn0.x0, x1: kn0.x1, z0: kn0.z0, z1: kn0.z1 };
      }
      const kapakli = !/bağlantı/i.test(kn.ad || '');     // bağlantı kanalı özgün araçta kapaksız (açık) gösterilir
      const uz = Math.max(kn.x1 - kn.x0, kn.z1 - kn.z0);
      kanalEkle(kn, { der: DK, kapakli, kapakAdet: kapakli ? Math.max(2, Math.round(uz / 900)) : 0, kaynak: 'bina', ...(katalog ? { katalog } : {}) });
    }
  } else if (L.pref) {
    // her AKTİF trafo bölmesinde, trafonun arkasında kapaklı kablo bölmesi (özgün 3B: z = duvar+150 … duvar+780)
    for (const TB of L.trAkt) {
      const kw = (TB[1] - TB[0]) - 360;
      kanalEkle({ ad: 'kapaklı kablo bölmesi', x0: TB[0] + 180, x1: TB[1] - 180, z0: dw + 150, z1: dw + 780 },
        { der: D.t, kapakli: true, kapakAdet: Math.max(2, Math.round(kw / 700)), kaynak: 'pref' });
    }
  }
  for (const k of n.kanallar) {
    const boy = Number(k.boy) || 0, g2 = Number(k.gen) || 0;
    kanallar.push({ ad: k.ad || 'Kanal', x0: null, x1: null, z0: null, z1: null, boy, gen: g2, der: Number(k.der) || 0,
      kapakli: k.kapakli !== false, kapakAdet: 0, kaynak: 'kullanici' });
  }

  const rezerv = bosSeritler(L).map((b) => ({ x0: b.x0, x1: b.x1, sira: b.sira === 2 ? 'on' : 'arka',
    z0: b.sira === 2 ? L.disEn - dw - arkaB - HD : dw + arkaB, z1: b.sira === 2 ? L.disEn - dw - arkaB : dw + arkaB + HD }));

  return {
    sinif: n.sinif, kosk: n.kosk, varyant: n.varyant,
    disBoy: L.disBoy, disEn: L.disEn, icBoy: L.icBoy, icEn: L.icEn, disYuk: L.disYuk, duvar: dw, bolmeKal: L.bolme,
    bolmeler, bolmeDuvar,
    hasHucre: L.hasHucre, hasT: L.hasT, hasAG: L.hasAG,
    kullan: L.kullan, hucreW: L.hucreW, kalan: L.kalan, koridor: L.koridor, yanBos: L.yanBos, arkaBos: arkaB,
    siralar, hucreler, trafo, pano, kapilar, kanallar, rezerv,
    tipSinifi: n.sinif === 'mono' ? tipSinifi(L.disBoy) : null,
    tipKodu: tipKoduAuto(n, L),
  };
}

/* =====================================================================
   KONTROLLER (özgün checks()) — metinler özgün araçla aynıdır, HTML etiketleri ayıklanır
===================================================================== */
export function gucListesi(cabin) {
  const n = norm(cabin);
  return gucListesiN(n.sinif, n.varyant);
}
function gucListesiN(sinif, v) {
  if (v === 'KOK') return [];                                   // KÖK: trafo yok (monoblok ve prefabrik)
  if (sinif === 'bina' || sinif === 'pref') return TRAFO.filter((t) => t[0] <= 2500).map((t) => t[0]);
  if (v === '1600') return TRAFO.filter((t) => t[0] >= 1250 && t[0] <= 1600).map((t) => t[0]);
  return TRAFO.filter((t) => t[0] <= 1000).map((t) => t[0]);
}

export function kontroller(cabin) {
  const { n, G, D, L } = hamYerlesim(cabin);
  const { DUVAR, BOLME_D, DIS_EN, IC_EN, DIS_YUK } = G;
  const out = [];
  const add = (st, txt, sub) => out.push({ st, txt: temiz(txt), sub: temiz(sub) });
  const H = n.hucreler, kva = n.trafoKva;

  if (L.bina) {
    const B = L.B, Y = B.yuk;
    add('ok', `Yapı: <b>${n.kosk}</b> — MOD tipi trafo binası (mimari + elektrik projesi)`,
      `İç ${B.icX}×${B.icZ} mm · duvar ${B.duvar} mm (+${B.siva} mm sıva) · köşe kolonları ${B.kolon}×${B.kolon} mm · dış ${L.disBoy}×${L.disEn} mm`);
    add('ok', `Kotlar (bitmiş iç zeminden): tavan <b>+${(Y.ic / 1000).toFixed(2)}</b> · saçak +${(Y.duvarUst / 1000).toFixed(2)} · mahya +${(Y.mahya / 1000).toFixed(2)} m · iç zemin dış zeminden +${(Y.kot / 1000).toFixed(2)} m`,
      `Kırma çatı, saçak çıkması ${B.sacakCik} mm · kapı yüksekliği ${Y.kapi} mm · kablo kanalı derinliği ${Y.kanal} mm (proje kesitleri)`);
    if (L.dilatasyon) add('ok', `Dilatasyon derzi: x = <b>${L.dilatasyon} mm</b> (yapı ortası)`,
      'Derzin iki yanında ikiz kolon bulunur; hücre sırası ve kablo kanalı derzde süreklidir (mimari plan)');
    if (L.araKolon.length) add('ok', `Ara kolonlar: uzun cephelerde <b>${L.araKolon.length}×2</b> adet ${B.kolon}×${B.kolon} mm`,
      L.araKolon.map((a) => `x=${a.x0}–${a.x1}`).join(' · ') + ' (mimari plan)');
    add('ok', `Bölümler: <b>${L.odaX}×${L.odaZ}</b> mm trafo odası + L biçimli hücre/AG salonu`,
      `Betonarme bölme ${B.duvar} mm · bölmede ${L.gecis.z1 - L.gecis.z0} mm geçiş boşluğu`);
    {
      const korumalar = H.filter((o) => trafoKorumaMi(o.c));
      if (korumalar.length) {
        const kes = korumalar.some((o) => kesiciliKorumaMi(o.c));
        if (kva >= 1600 && !kes) add('bad', `${kva} kVA trafo yalnız <b>kesicili</b> trafo koruma hücresiyle bağlanabilir`, '1600 kVA ve üzeri kesicili trafo koruma hücresi gerektirir');
        else add('ok', `Trafo–hücre bağlantısı: ${korumalar.length} trafo koruma hücresi`,
          kva >= 1600 ? '1600 kVA ve üzeri → kesicili koruma' : '≤1250 kVA → sigortalı yük ayırıcılı veya kesicili koruma');
      } else if (H.length) add('warn', 'Hücre listesinde trafo koruma hücresi yok', 'Trafo için bir koruma hücresi ekleyin');
    }
    if (L.sira2) {
      add(L.sira1W <= L.sira1Net ? 'ok' : 'bad', `1. sıra (hücre duvarı): <b>${L.sira1W}</b> / ${L.sira1Net} mm — ${L.arka.length} hücre`,
        `Sıra ${L.hucSol} mm'den başlar · elektrik projesinde bu şerit ${B.hucreMax} mm'dir`);
      add(L.sira2W <= L.sira2Net ? 'ok' : 'bad', `2. sıra (kapı cephesi duvarı): <b>${L.sira2W}</b> / ${L.sira2Net} mm — ${L.on.length} hücre`,
        `Kapıların bulunmadığı şeritte (${L.hucXOn[0]}–${L.hucXOn[1]} mm) yer alır; boş kalan kısım rezerv olarak taranır`);
    }
    add(L.kalan >= 0 ? 'ok' : 'bad',
      L.kalan >= 0 ? `Hücreler sığıyor — kalan mesafe: <b>${L.kalan} mm</b>` : `Hücreler sığmıyor — <b>${-L.kalan} mm</b> aşım`,
      `Toplam net ${L.kullan} mm${L.sira2 ? ' (iki sıra)' : ''} / hücre toplamı ${L.hucreW} mm · sıra ${L.hucSol} mm'den başlar`);
    add(L.koridor >= 800 ? 'ok' : 'bad', `Hücre önü serbest derinlik: <b>${L.koridor} mm</b> ${L.koridor >= 800 ? '≥' : '<'} 800 mm`,
      `İç derinlik ${B.icZ} − hücre derinliği ${HD} − arka boşluk ${L.arkaBos} mm`);
    {
      const sol = L.hucX[0] - D.dw, sag = (D.dw + B.icX) - L.hucX[1];
      add(Math.min(sol, sag) >= 100 ? 'ok' : 'bad',
        `Yan duvar boşlukları: sol <b>${sol}</b> · sağ <b>${sag}</b> mm ${Math.min(sol, sag) >= 100 ? '≥' : '<'} 100 mm`,
        'Sıranın iki ucundaki hücre ile yan duvar arası en az 100 mm serbest bırakılır; sıra bu sınırı geçemez');
    }
    add(L.arkaBos >= 100 ? 'ok' : 'bad', `Hücre arkası boşluk: <b>${L.arkaBos} mm</b> ${L.arkaBos >= 100 ? '≥' : '<'} 100 mm`,
      L.kolonPay > 0
        ? `Uzun cephe kolonları duvar iç yüzünden <b>${L.kolonTasma} mm</b> oda içine taşar; hücre sırası kolona değmesin diye sırt boşluğu ${L.kolonTasma}+100 = <b>${L.kolonPay} mm</b>'ye çekilmiştir (kolon yüzüne 100 mm açıklık).`
        : 'Hücre sırtı ile arka duvar arası en az 100 mm; elektrik projesinde bu boşluk 80 mm görünmekte olup uygulamada 100 mm\'ye tamamlanır');
    {
      const G0 = trafoGabari(kva);
      const bosX = L.odaX - G0.G, bosZ = L.odaZ - G0.U;
      add(kva <= 2500 ? 'ok' : 'bad', `Trafo: <b>${kva} kVA</b> — ${G0.U}×${G0.G}×${G0.C} mm`,
        `Trafo odası ${L.odaX}×${L.odaZ} mm · yanlarda toplam ${bosX} mm, derinlikte ${bosZ} mm serbest`);
      add(bosX >= 1200 && bosZ >= 1200 ? 'ok' : (bosX >= 800 && bosZ >= 800 ? 'warn' : 'bad'),
        `Trafo çevresi geçiş: <b>${Math.round(Math.min(bosX, bosZ) / 2)} mm</b> (en dar yön, tek taraf)`,
        'Bakım/işletme için trafo çevresinde en az 600–800 mm dolaşım payı bırakılır');
      add('ok', `Ray açıklığı: <b>${rayAcikligi(kva)} mm</b>`, '820 mm\'ye kadar ayarlanabilir olacaktır');
    }
    add('ok', `Kapılar: <b>${L.kapi.map((k) => k.ad + ' ' + k.w + '×' + k.h).join(' · ')}</b>`,
      'K1 trafo odası · K2 hücre/AG salonu — çift kanat, alt bölümü panjurlu (mimari görünüş paftaları)');
    if (L.merdiven) {
      const M = L.merdiven, cik = M.sahanlik + M.n * M.tread;
      const oran = 2 * M.rise + M.tread;
      const md = L.kapi.filter((k) => k.merd !== false).map((k) => k.ad).join(', ');
      const yok = L.kapi.filter((k) => k.merd === false).map((k) => k.ad).join(', ');
      add(oran >= 600 && oran <= 650 ? 'ok' : 'warn',
        `Kapı önü merdiveni (<b>${md}</b>): ${M.n} basamak · rıht ${M.rise} × basamak ${M.tread} mm · çıkma ${cik} mm`,
        `Bitmiş iç zemin dış zeminden +${(L.kot / 1000).toFixed(2)} m yüksektedir · 2h+b = ${oran} mm (uygun aralık 600–650) · sahanlık ${M.sahanlik} mm · genişlik kapı + 2×${M.yan} mm`);
      if (yok) add('ok', `<b>${yok}</b> (trafo odası) kapısında merdiven yoktur`,
        'Trafonun kızaklanarak içeri alınabilmesi için bu kapı önünde basamak bulunmaz; kot farkı tretuvar/rampa ile karşılanır (mimari plan)');
      add('ok', `Tretuvar: bina çevresinde <b>${M.tretuvar} mm</b>`, 'Dış zemin kotunda, su uzaklaştırma eğimli (mimari kesit)');
    }
    add('ok', `Havalandırma: ${L.panjur.length} adet <b>${L.panjur[0].w}×${L.panjur[0].h}</b> panjur (kısa cephelerde, karşılıklı)`,
      'Trafo odası ve salon çapraz havalandırılır; kapı panjurlarıyla birlikte');
    add('ok', `Kablo kanalları: ${L.kanal.length} kol · derinlik <b>${Y.kanal} mm</b>`,
      L.kanal.map((k) => k.ad + ' ' + (k.x1 - k.x0) + '×' + (k.z1 - k.z0)).join(' · '));
    // (özgün araçtaki "İlave hücre rezervi" satırı ölü koddur — BINA kayıtlarında rezerv alanı yok)
    add('ok', `AG panosu: <b>${L.pano.x1 - L.pano.x0}×${L.pano.z1 - L.pano.z0}</b> mm — salonda, bölme duvarı önünde`,
      'Altında kendi kablo kanalı bulunur; trafo AG buşinglerinden beslenir');
    return out;
  }

  if (L.pref) {
    const P = L.P;
    add('ok', `Köşk: <b>${n.kosk}</b> — PREFABRİK BETON KÖŞK ${P.ad} (fabrika tipi)`,
      `Dış ${L.disBoy}×${DIS_EN} mm · zemin üstü yükseklik 3140 mm (+3.14 çatı kotu) · duvar ${DUVAR} mm · betopan bölme ${BOLME_D} mm · kablo bodrumu −0.80 · temel −1.15 (eva-PBK DXF)`);
    if (L.kok) add('ok', 'Varyant: <b>KÖK</b> — yalnızca modüler hücre',
      'Trafo bölmesi, betopan bölmeler ve AG panosu kaldırıldı; iç uzunluğun tamamı hücre sırasına ayrıldı. Köşk yalnız OG dağıtım (kök) noktası olarak kullanılır.');
    if (!L.kok) {
      const korumalar = H.filter((o) => trafoKorumaMi(o.c));
      if (korumalar.length) {
        const kes = korumalar.some((o) => kesiciliKorumaMi(o.c));
        if (kva >= 1600 && !kes) add('bad', `${kva} kVA trafo yalnız <b>kesicili</b> trafo koruma hücresiyle bağlanabilir`,
          '1600 kVA ve üzeri (2000/2500 dâhil) kesicili trafo koruma hücresi (örn. HMH 36-04T) gerektirir');
        else add('ok', `Trafo–hücre bağlantısı: ${korumalar.length} trafo koruma hücresi (${kva} kVA için uygun)`,
          kva >= 1600 ? '1600 kVA ve üzeri → kesicili trafo koruma hücresi' : '≤1250 kVA → sigortalı yük ayırıcılı veya kesicili koruma kabul edilir');
        if (L.trAkt.length > 1 && korumalar.length < L.trAkt.length) add('warn', `${L.trAkt.length} trafo var, listede ${korumalar.length} trafo koruma hücresi`,
          'EK-1B tipinde her trafo için ayrı Kes.Trf.Kor. hücresi öngörülmüştür (DXF: Giriş + Ölçü + 2×Kes.Trf.Kor.)');
      } else if (H.length) add('warn', 'Hücre listesinde trafo koruma hücresi yok', 'Her trafo için bir koruma hücresi ekleyin (≤1250 kVA: sigortalı YA veya kesicili · 1600 kVA+: kesicili)');
    }
    add('ok', `Bölüm dağılımı: ${L.kok ? `hücre salonu <b>${L.ygLen}</b> mm (bölmesiz)` : `YG <b>${L.ygLen}</b>${L.trB.map((tb) => ` · TR <b>${tb[1] - tb[0]}</b>`).join('')} mm`} (iç)`,
      L.kok ? `KÖK: iç uzunluğun tamamı (${L.icBoy} mm) tek hücre mahallidir · duvar ${DUVAR} mm`
        : `${P.ad} fabrika tipi sabit yerleşim · betopan bölme ${BOLME_D} mm · duvar ${DUVAR} mm${P.hizala === 'orta' ? ' · hücre grubu YG mahallinde ortalanır (AG pano köşesi hizası, DXF)' : ''}`);
    if (P.cift) {
      add(L.arkaW <= L.arkaNet ? 'ok' : 'bad', `Arka sıra: <b>${L.arkaW}</b> / ${L.arkaNet} mm (${L.arka.length} hücre)`,
        `YG ${L.ygLen} − 2×${L.yanBos} mm yan boşluk · DXF: 8 hücre arka duvara dayalı`);
      add(L.onW <= L.onNet ? 'ok' : 'bad', `Ön sıra: <b>${L.onW}</b> / ${L.onNet} mm (${L.on.length} hücre)`,
        `Ön sıra şeridi ${P.onSira[0]}–${P.onSira[1]} mm · DXF: 4 hücre ön duvara dayalı (180° dönük)`);
      add(L.kalan >= 0 ? 'ok' : 'bad',
        L.kalan >= 0 ? `Hücreler sığıyor — toplam kalan <b>${L.kalan} mm</b>` : `Hücreler sığmıyor — <b>${-L.kalan} mm</b> aşım`,
        `Toplam net ${L.kullan} mm / hücre toplamı ${L.hucreW} mm`);
    } else {
      const sinir = (L.hucNet < L.arkaNet)
        ? `AG pano hizaları arası net <b>${L.hucNet} mm</b> — pano önüne hücre konulamaz (kapak erişimi)`
        : `YG ${L.ygLen} mm − 2×${L.yanBos} mm yan boşluk = net ${L.kullan} mm`;
      if (L.kalan >= 0) add('ok', `Hücreler sığıyor — kalan mesafe: <b>${L.kalan} mm</b>`, `${sinir} · hücre toplamı ${L.hucreW} mm`);
      else add('bad', `Hücreler sığmıyor — <b>${-L.kalan} mm</b> aşım (pano hizası geçilemez)`, `${sinir} · hücre toplamı ${L.hucreW} mm`);
    }
    add(L.koridor >= 800 ? 'ok' : 'bad', `Çalışma koridoru: <b>${L.koridor} mm</b> ${L.koridor >= 800 ? '≥' : '<'} 800 mm`,
      P.cift ? `İç en ${IC_EN} − 2×(hücre ${HD} + arka boşluk ${D.arka}) — çift sıralı DM yerleşimi`
        : `İç en ${IC_EN} − hücre derinliği ${HD} − arka boşluk ${D.arka}`);
    add(L.yanBos >= 100 ? 'ok' : 'bad', `Yan duvar boşlukları: <b>${L.yanBos} mm</b> ${L.yanBos >= 100 ? '≥' : '<'} 100 mm`,
      'En sağ/en soldaki hücre ile yan duvar (betopan bölme) arası en az 100 mm serbest bırakılır');
    add(D.arka >= 100 ? 'ok' : 'bad', `Hücre arkası boşluk: <b>${D.arka} mm</b> ${D.arka >= 100 ? '≥' : '<'} 100 mm`,
      'Hücre sırtı ile duvar arası en az 100 mm serbest bırakılır (hücre sıraları bu boşlukla çizilir)');
    if (!L.kok) {
      const G0 = trafoGabari(kva);
      add(kva <= 2500 ? 'ok' : 'bad', `Trafo: <b>${kva} kVA</b> × ${L.trAkt.length}${L.trB.length > L.trAkt.length ? ` (+${L.trB.length - L.trAkt.length} yedek bölme)` : ''} — prefabrik köşkte 2500 kVA'ya kadar`,
        'DXF paftasında trafo mahalli 2500 kVA\'ya kadar gösterilmiştir' + (kva >= 2000 ? ' · 2000/2500 kVA gabarisi yaklaşık değerdir, üretici teyidi gerekir' : ''));
      add(G0.G <= L.trafoBol - 200 ? 'ok' : 'warn', `Trafo bölmesi: <b>${L.trafoBol} mm</b> · trafo genişliği ${G0.G} mm (radyatör dâhil)`,
        'Trafo bölmesinde iki yanda YÜRÜME YOLU bırakılır (DXF)');
      add('ok', `Ray açıklığı: <b>${rayAcikligi(kva)} mm</b> (${kva} kVA)`, '820 mm\'ye kadar ayarlanabilir olacaktır');
    }
    add('ok', `Kapılar: <b>${L.kapi.map((k) => (k.tip === 'h' ? 'K1' : 'K2') + ' ' + k.w + '×2400').join(' · ')}</b>`,
      L.kok ? 'KÖK\'te trafo bölmesi olmadığından tüm kapılar hücre salonuna açılır (çift kanat)'
        : 'Üretici görünüş paftasıyla birebir: K1 panjursuz (YG) · K2 alt yarısı panjurlu (TR) · çift kanat · konumlar ön duvar iç ölçü zincirinden');
    if (!L.kok) {
      add('ok', `Havalandırma: arka duvarda ${L.trB.length} panjur (trafo bölmesi hizasında)`, 'K2 kapı panjurlarıyla çapraz havalandırma sağlanır');
      if (L.trB.length > 1) add('ok', 'Personel girişi: ön cephe ortasındaki K1 kapısından', 'EK-1B DXF: PERSONEL GİRİŞİ orta YG mahallindedir');
      add('ok', `AG pano: <b>1750×750</b> serbest duran × ${L.agPanolar.length}`, 'YG mahallinde, betopan bölme yanında dikey yerleşim (DXF \'P 1750X750\' bloğu) — pano adedi trafo adedini izler; ayrı AG bölmesi ve kısa kenar kapısı yoktur');
    }
    add('warn', 'Prefabrik şartname madde kontrolleri henüz eklenmedi', 'EK-1A görünüş paftası işlendi; yazılı şartname metni yüklendiğinde madde bazlı uygunluk kontrolleri bu listeye eklenecektir');
    return out;
  }

  // --- monoblok ---
  const B = L.B;
  add('ok', `Köşk: <b>${n.kosk}</b> · ${VARYANT[n.varyant]}`,
    `Dış ${L.disBoy}×${DIS_EN}×${DIS_YUK} mm · iç boy ${L.icBoy} mm · iç en ${IC_EN} mm (duvar ${DUVAR} mm)`);
  {
    const koruma = H.find((o) => trafoKorumaMi(o.c));
    if (L.hasT && L.hasHucre && koruma) {
      const kes = kesiciliKorumaMi(koruma.c);
      if (kva >= 1600 && !kes) add('bad', `${kva} kVA trafo yalnız <b>kesicili</b> trafo koruma hücresiyle bağlanabilir`,
        '1250 kVA\'ya kadar sigortalı yük ayırıcılı veya kesicili kabul edilir; 1600 kVA ve üzeri kesicili (örn. HMH 36-04T) zorunludur');
      else add('ok', `Trafo–hücre bağlantısı: ${hucreRec(koruma.c)[0]} (${kva} kVA için uygun)`,
        kva >= 1600 ? '1600 kVA ve üzeri → kesicili trafo koruma hücresi' : '≤1250 kVA → sigortalı yük ayırıcılı veya kesicili koruma kabul edilir');
    } else if (L.hasT && L.hasHucre && H.length) add('warn', 'Hücre listesinde trafo koruma hücresi yok', 'Trafo OG irtibatı için koruma hücresi ekleyin (≤1250 kVA: sigortalı YA veya kesicili · 1600 kVA+: kesicili)');
  }
  add('ok', `Bölüm dağılımı: ${L.hasHucre ? `hücre <b>${B.h}</b>` : 'hücre yok'}${L.hasT ? ` · trafo <b>${B.t}</b>` : ''}${L.hasAG ? ` · AG pano <b>${B.a}</b>` : ''} mm`,
    `Bölme duvarı ${BOLME_D} mm · toplam ${B.h + B.t + B.a + BOLME_D * ([B.h, B.t, B.a].filter((x) => x > 0).length - 1)} = iç boy ${L.icBoy} mm`);
  if (L.hasHucre) {
    if (L.kalan >= 0) add('ok', `Hücreler sığıyor — kalan mesafe: <b>${L.kalan} mm</b>`, `Hücre bölümü ${L.ygLen} mm − 2×${L.yanBos} mm yan boşluk = net ${L.kullan} mm / hücre toplamı ${L.hucreW} mm`);
    else add('bad', `Hücreler sığmıyor — <b>${-L.kalan} mm</b> aşım`, `Net yerleşim ${L.kullan} mm / hücre toplamı ${L.hucreW} mm`);
    add(L.yanBos >= 100 ? 'ok' : 'warn', `Yan duvar boşlukları: <b>${L.yanBos} mm</b> (sağ ve sol)`, 'En sağ ve en soldaki hücre ile bölme/yan duvar arası serbest bırakılır');
    // Not: varsayılan ölçülerle (iç en 2280, hücre 1650, arka 100) koridor 530 mm çıkar; özgün araçtaki gibi "bad".
    add(L.koridor >= 800 ? 'ok' : 'bad', `Çalışma koridoru (e): <b>${L.koridor} mm</b> ${L.koridor >= 800 ? '≥' : '<'} 800 mm`,
      L.koridor >= 800 ? 'Şartname Md. 2.8 — hücre önü işletme koridoru'
        : `İç en ${IC_EN} − hücre derinliği ${HD} − arka boşluk ${D.arka} = ${L.koridor} mm. Arka boşluğu ${Math.max(0, IC_EN - HD - 800)} mm'ye indirerek 800 mm sağlanır (Md. 2.8 / Md. 3.2).`);
    add(D.arka <= 100 ? 'ok' : 'bad', `Hücre arkası boşluk: <b>${D.arka} mm</b> ${D.arka <= 100 ? '≤' : '>'} 100 mm`, 'Md. 3.2 — hücre arka yüzü ile duvar arası en fazla 100 mm');
  } else {
    add('ok', 'Bu varyantta hücre bölümü yoktur', 'Yalnızca trafo (ve varsa AG pano) bölümünden oluşan kompakt tip');
    if (H.length) add('bad', `Listede ${H.length} hücre var ancak bu varyantta hücre bölümü YOK`, 'Hücreler plan/ön görünüş/tek hat çizimlerine alınmaz. KÖK varyantı ya da hücre bölmeli gövde (MB-3800+) seçin veya hücreleri silin');
  }
  add(IC_EN >= 2300 ? 'ok' : 'warn', `İç en: <b>${IC_EN} mm</b> (standart EK-1A: d ≥ 2300 mm)`, IC_EN >= 2300 ? '' : 'Katalog iç eni 2280 mm; standardın en küçük değerinin 20 mm altında — üretici tip deney raporu ile teyit edilmelidir');
  const hOk = D.h >= 2650;
  add(hOk ? 'ok' : (D.h >= 2650 * 0.95 ? 'warn' : 'bad'), `İç yükseklik (h): <b>${D.h} mm</b> (min 2650)`, hOk ? '' : 'Md. 2.2-k: şartlar sağlanırsa −%5 tolerans (≥2518)');
  add(D.t >= 690 ? 'ok' : (D.t >= 656 ? 'warn' : 'bad'), `Tank/temel (t): <b>${D.t} mm</b> (min 690)`, '');
  add(DIS_EN <= 2550 ? 'ok' : 'bad', `Dış genişlik: <b>${DIS_EN} mm</b> ≤ 2550 mm`, 'EK-1A Tablo-2 notu');
  add(DIS_YUK <= 3700 ? 'ok' : 'bad', `Dış yükseklik: <b>${DIS_YUK} mm</b> ≤ 3700 mm`, 'Çatı çıkıntısı hariç');
  const ts = tipSinifi(L.disBoy);
  add(ts ? 'ok' : 'warn', `Dış boy (f): <b>${L.disBoy} mm</b> → ${ts || '7500 mm üzeri: tek parçalı Tip-1 kapsamı dışı'}`, 'EK-1A Tablo-2');
  if (L.hasT) {
    const uygun = gucListesiN('mono', n.varyant).includes(kva);
    add(uygun ? 'ok' : 'bad', `Trafo gücü: <b>${kva} kVA</b> — ${VARYANT[n.varyant]}`,
      uygun ? 'Varyantın izin verdiği güç aralığında' : 'Bu varyant için uygun değil, güç veya varyant değiştirilmeli');
    const min = n.varyant === '1600' ? 2250 : 1700;
    add(B.t >= min ? 'ok' : 'bad', `Trafo bölümü: <b>${B.t} mm</b> ≥ ${min} mm`,
      n.varyant === '1600' ? '1250–1600 kVA için katalog trafo yeri' : '≤1000 kVA için katalog trafo yeri 1700 mm');
    add('ok', `Ray açıklığı: <b>${rayAcikligi(kva)} mm</b> (${kva} kVA)`, 'Md. 3.1 Tablo-3 — 820 mm\'ye kadar ayarlanabilir olacaktır');
    add('ok', 'Buşing yönelimi: <b>OG (3 ad.) → YG hücreleri</b>, <b>AG (3F+N = 4 ad.) → AG pano</b>', 'OG buşing L tipi ayrılabilen ekranlı başlık (Md. 3.5); AG tarafta nötr kesiti faz kesiti ile aynı (Md. 3.5 Tablo:6), buşingler 1 kV izolasyon kapaklı (Md. 3.1)');
    add('ok', 'Trafo, bölmesinde her iki eksende ortalanmıştır', 'Trafo bölümünde taban döşemesi yoktur (Md. 2.2-h)');
  } else {
    add('ok', 'Trafo bölümü yok (KÖK)', 'Yalnızca YG hücrelerinden oluşan dağıtım kutusu');
  }
  {
    const hk = kapiGenislikleri(n, B.h, 'hucre'), tk = kapiGenislikleri(n, B.t, 'trafo');
    const liste = [];
    if (hk.length) liste.push(`hücre ${hk.join(' + ')}`);
    if (tk.length) liste.push(`trafo ${tk.join(' + ')}`);
    if (L.hasAG) liste.push('AG (kısa kenar)');
    const teyit = !!KAPI_TABLO[n.kosk + '|' + n.varyant];
    add(teyit ? 'ok' : 'warn', `Kapılar: <b>${liste.join(' · ')}</b> mm`,
      teyit ? 'Üretici kapı ölçü çizimiyle birebir doğrulanmıştır' : 'Bu varyantın kapı ölçü çizimi elde yok; genişlikler doğrulanmış kuralla türetilmiştir');
  }
  if (L.hasAG) {
    const P = panoIcinKva(kva);
    add(B.a >= 550 ? 'ok' : 'bad', `AG pano bölümü (c): <b>${B.a} mm</b> ≥ 550 mm`, 'EK-1A Tablo-1');
    // Not: özgün araç burada bölme uzunluğunu panonun GENİŞLİĞİ (A) ile karşılaştırır; metin "derinlik" der. Aynen korunmuştur.
    if (B.a < P[1]) add('warn', `Seçilen pano derinliği (${P[1]} mm) bölmeden büyük`, 'Daha sığ pano tipi veya daha uzun köşk seçin');
    add('ok', 'AG pano kısa kenardadır; kapısı kısa yüzdedir', 'Pano bölümü köşkün ucunda, tam iç genişlik boyunca');
  } else {
    add('ok', 'AG pano bölümü ve kısa kenar kapısı yok',
      n.varyant === 'KOK' ? 'KÖK varyantında AG pano bulunmadığından kısa kenarda kapı açılmaz' : 'Bu tipte ayrı AG pano bölmesi yoktur; pano, hücre bölümü içinde konumlandırılır');
  }
  return out;
}

/* =====================================================================
   AĞIRLIK (özgün weights())
===================================================================== */
export function agirliklar(cabin) {
  const { n, L } = hamYerlesim(cabin);
  const P = panoIcinKva(n.trafoKva);
  const hs = n.hucreler.reduce((a, o) => a + (hucreRec(o.c) ? hucreRec(o.c)[3] : 0), 0);
  let rows;
  if (L.bina) rows = [['Trafo (' + n.trafoKva + ' kVA)', n.trafoKg], ['YG hücreleri (' + n.hucreler.length + ' ad.)', hs], ['AG pano (' + P[0] + ')', P[4]]];
  else {
    rows = [['Köşk boş ağırlığı (' + L.K.ad + ', yaklaşık)', L.K.agirlik], ['YG hücreleri (' + n.hucreler.length + ' ad.)', hs]];
    if (L.hasT) { const nT = (L.trAkt || [L.trX]).length; rows.push(['Trafo (' + n.trafoKva + ' kVA)' + (nT > 1 ? ' × ' + nT : ''), n.trafoKg * nT]); }
    if (L.hasAG) rows.push(['AG pano (' + P[0] + ')', P[4]]);
    else if (L.pref) rows.push([`AG pano (${P[0]}) × ${L.agPanolar.length}`, P[4] * L.agPanolar.length]);
  }
  return { satirlar: rows.map(([ad, kg]) => ({ ad, kg })), toplam: rows.reduce((a, r) => a + r[1], 0) };
}

/* =====================================================================
   TİP LİSTELERİ / VARSAYILANLAR
===================================================================== */
export function kabinTipleri(sinif) {
  if (sinif === 'bina') return Object.keys(BINA).map((k) => ({ kosk: k, ad: BINA[k].ad, boy: BINA[k].icX + 2 * BINA[k].duvar, en: BINA[k].icZ + 2 * BINA[k].duvar,
    icBoy: BINA[k].icX, icEn: BINA[k].icZ, varyantlar: [{ key: 'BINA', ad: VARYANT.BINA }] }));
  if (sinif === 'pref') return Object.keys(PKOSK).map((k) => ({ kosk: k, ad: PKOSK[k].ad, boy: PKOSK[k].boy, en: PKOSK[k].en,
    varyantlar: [{ key: 'PBK', ad: PKOSK[k].cift ? 'FABRİKA TİPİ — DM (çift sıra)' : 'FABRİKA TİPİ — trafolu' }, { key: 'KOK', ad: 'KÖK — yalnızca hücre' }] }));
  return Object.keys(KOSK).map((k) => ({ kosk: k, ad: k, boy: KOSK[k].boy, en: 2500,
    varyantlar: Object.keys(KOSK[k].v).map((v) => ({ key: v, ad: VARYANT[v] })) }));
}

/** Sınıf için varsayılan kabin: özgün aracın açılış durumundan o sınıfa/tipe geçince oluşan durum */
export function varsayilanKabin(sinif, kosk) {
  const bas = { sinif: 'mono', kosk: 'MB-4800', varyant: '1000', trafoKva: 630, hucreSeri: 'ULUSOY', hucreler: VARSAYILAN_HUCRELER() };
  const degisim = {};
  if (sinif && sinif !== 'mono') degisim.sinif = sinif;
  if (kosk) degisim.kosk = kosk;
  if (!Object.keys(degisim).length) return bas;
  const r = kabinDegistir(bas, degisim);
  const c = r.ok ? r.cabin : bas;
  delete c.sakli;
  return c;
}

/* =====================================================================
   DÜZENLEME YARDIMCILARI — saf; { ok:true, cabin } ya da { ok:false, hata }
===================================================================== */
const tamam = (cabin) => ({ ok: true, cabin });
const hata = (m) => ({ ok: false, hata: temiz(m) });
const kabinKopya = (cabin) => ({ ...cabin, hucreler: (cabin.hucreler || []).map((h) => (typeof h === 'string' ? { c: h, f: '', y: 'c' } : { ...h })) });
function siraBosluk(L) {
  return [(L.bina ? L.sira1Net : L.arkaNet) - (L.bina ? L.sira1W : L.arkaW), (L.bina ? L.sira2Net : L.onNet) - (L.bina ? L.sira2W : L.onW)];
}

export function hucreEkle(cabin, code) {
  const h = hucreRec(code);
  if (!h) return hata('Bilinmeyen hücre tipi: ' + code);
  const { L } = hamYerlesim(cabin);
  const c = kabinKopya(cabin);
  // çift sıralı yerleşimde yeni hücre OTOMATİK'tir; yalnız iki sıra da doluysa reddedilir
  if (L.hucXOn) {
    const [bos1, bos2] = siraBosluk(L);
    if (h[2] > bos1 && h[2] > bos2) return hata(`<b>${h[0]}</b> eklenemedi. Gereken ${h[2]} mm · 1. sırada <b>${Math.max(0, bos1)} mm</b>, 2. sırada <b>${Math.max(0, bos2)} mm</b> boş yer var.<br>Listeden hücre çıkarın veya daha geniş bina/köşk tipi seçin.`);
    c.hucreler.push({ c: code, f: '', y: 'c' }); return tamam(c);
  }
  if (h[2] > L.kalan) {
    const ek0 = L.bina ? `Binada hücre sırası yan duvarlardan en az 100 mm içeride kalmak zorundadır — kullanılabilir net alan ${L.kullan} mm.` : null;
    const ek = ek0 || ((L.pref && !L.P.cift && L.hucNet < L.arkaNet)
      ? `Prefabrikte hücre sırası <b>AG pano hizasını geçemez</b> — pano önünde kalan hücrenin kapağına erişilemez. Pano hizaları arası net alan ${L.hucNet} mm.`
      : 'Daha geniş köşk tipi seçin, trafo/AG bölme uzunluğunu azaltın veya listeden hücre çıkarın.');
    return hata(`<b>${h[0]}</b> eklenemedi. Gereken ${h[2]} mm, kalan yer <b>${Math.max(0, L.kalan)} mm</b>.<br>${ek}`);
  }
  c.hucreler.push({ c: code, f: '', y: 'c' });
  return tamam(c);
}

export function hucreSil(cabin, i) {
  const c = kabinKopya(cabin);
  if (!Number.isInteger(i) || i < 0 || i >= c.hucreler.length) return hata('Geçersiz hücre sırası');
  c.hucreler.splice(i, 1);
  return tamam(c);
}

/** Hücreyi çoğaltır: aynı tip, yön oku ve sıra tercihi; fider adı boş. Listede hemen altına eklenir. */
export function hucreKopyala(cabin, i) {
  const c = kabinKopya(cabin), o = c.hucreler[i];
  if (!o) return hata('Geçersiz hücre sırası');
  const h = hucreRec(o.c), { L } = hamYerlesim(cabin);
  if (h) {
    if (L.hucXOn) {
      const [s1, s2] = siraBosluk(L);
      const bos = o.s === '1' ? s1 : o.s === '2' ? s2 : Math.max(s1, s2);
      if (h[2] > bos) return hata(`<b>${h[0]}</b> kopyalanamadı. Gereken ${h[2]} mm · 1. sırada <b>${Math.max(0, s1)} mm</b>, 2. sırada <b>${Math.max(0, s2)} mm</b> boş yer var.`);
    } else if (h[2] > L.kalan) {
      return hata(`<b>${h[0]}</b> kopyalanamadı. Gereken ${h[2]} mm, kalan yer <b>${Math.max(0, L.kalan)} mm</b>.`);
    }
  }
  c.hucreler.splice(i + 1, 0, { ...o, f: '' });
  return tamam(c);
}

/** Hücreyi KENDİ SIRASI içinde bir kademe kaydırır (d: −1 yukarı/sola, +1 aşağı/sağa); taşınamıyorsa değişmez. */
export function hucreTasi(cabin, i, d) {
  const c = kabinKopya(cabin);
  if (!c.hucreler[i]) return hata('Geçersiz hücre sırası');
  d = d < 0 ? -1 : 1;
  const { L } = hamYerlesim(cabin);
  const cift = !!L.hucXOn, sr = (k) => ((cift && L.on && L.on.indexOf(k) >= 0) ? 2 : 1), s0 = sr(i);
  let j = i + d;
  while (j >= 0 && j < c.hucreler.length && sr(j) !== s0) j += d;
  if (j < 0 || j >= c.hucreler.length) return tamam(c);
  [c.hucreler[i], c.hucreler[j]] = [c.hucreler[j], c.hucreler[i]];
  return tamam(c);
}

/** Hücre tipini yerinde değiştirir (özgün araçta sığma denetimi yoktur) */
export function hucreDegistir(cabin, i, code) {
  const c = kabinKopya(cabin);
  if (!c.hucreler[i]) return hata('Geçersiz hücre sırası');
  if (!hucreRec(code)) return hata('Bilinmeyen hücre tipi: ' + code);
  c.hucreler[i].c = code;
  return tamam(c);
}

/** Fider adı (f), yön oku (y: g giriş · c çıkış · x ok yok) ve hedef sıra (s: "1" · "2" · "a"/boş otomatik) */
export function hucreAyar(cabin, i, ayar = {}) {
  const c = kabinKopya(cabin), o = c.hucreler[i];
  if (!o) return hata('Geçersiz hücre sırası');
  if (ayar.f !== undefined) o.f = String(ayar.f);
  if (ayar.y !== undefined) { if (!['g', 'c', 'x'].includes(ayar.y)) return hata('Geçersiz yön: ' + ayar.y); o.y = ayar.y; }
  if (ayar.s !== undefined) { if (ayar.s === '1' || ayar.s === '2') o.s = ayar.s; else delete o.s; }
  return tamam(c);
}

/** varyant değişince trafo gücünü izin verilen aralığa çeker (özgün uygunGuc) */
function uygunGuc(c) {
  const gl = gucListesiN(c.sinif, c.varyant);
  if (!gl.length) return;
  if (!gl.includes(c.trafoKva)) {
    c.trafoKva = (c.sinif === 'pref' || c.sinif === 'bina') ? 1000 : (c.varyant === '1600' ? 1600 : 1000);
    delete c.trafoKg;
  }
}
const DIMS_AD = { mono: 'dimsMono', pref: 'dimsPref', bina: 'dimsBina' };

/** Sınıf geçişi (özgün setSinif). Önceki sınıfın tipi / varyantı / hücre listesi `sakli` alanında tutulur. */
function sinifDegistir(c, s) {
  const st = c.sakli = { ...(c.sakli || {}) };
  const eski = c.sinif;
  if (eski === s) return;
  // ölçü farkları her sınıf için ayrı saklanır (özgün araçtaki sızıntı taşınmadı — dosya başındaki 3. not)
  if (c.dims) st[DIMS_AD[eski]] = c.dims; else delete st[DIMS_AD[eski]];
  const yeniDims = () => { if (st[DIMS_AD[s]]) c.dims = st[DIMS_AD[s]]; else delete c.dims; };
  if (s === 'bina') {
    if (eski === 'pref') st.prefKosk = c.kosk; else { st.varMono = c.varyant; st.monoKosk = c.kosk; }
    const ilk = !st.binaKosk;
    st.hucMono = st.hucMono || hKopya(c.hucreler);
    c.kosk = (st.binaKosk && BINA[st.binaKosk]) ? st.binaKosk : 'MOD-5'; c.varyant = 'BINA'; c.sinif = 'bina';
    yeniDims();
    if (ilk) { c.hucreler = projeDonanimi(c.kosk); c.hucreSeri = 'ULUSOY'; c.trafoKva = 1000; delete c.trafoKg; }   // özgün: "HMH" (hata) → ULUSOY
    else if (st.hucBina) c.hucreler = hKopya(st.hucBina);
    uygunGuc(c);
    return;
  }
  if (eski === 'bina') {
    st.binaKosk = c.kosk; st.hucBina = hKopya(c.hucreler);
    if (st.hucMono) c.hucreler = hKopya(st.hucMono);
  }
  if (s === 'pref') {
    // özgün davranış: binadan gelinse bile "monoblok" saklaması o anki tip/varyantla ezilir
    st.varMono = c.varyant; st.monoKosk = c.kosk;
    c.kosk = (st.prefKosk && PKOSK[st.prefKosk]) ? st.prefKosk : 'PBK-1A'; c.varyant = 'PBK'; c.sinif = 'pref';
    yeniDims(); uygunGuc(c);
  } else if (s === 'mono') {
    if (eski === 'pref') st.prefKosk = c.kosk;
    c.kosk = (st.monoKosk && KOSK[st.monoKosk]) ? st.monoKosk : 'MB-4800';
    c.varyant = st.varMono || '1000';
    if (!KOSK[c.kosk].v[c.varyant]) c.varyant = ilkVaryant(c.kosk);
    c.sinif = 'mono';
    yeniDims(); uygunGuc(c);
  }
}
/** Tip değişimi (özgün setKosk) — aynı sınıf içinde */
function koskDegistir(c, k) {
  const eski = c.kosk;
  c.kosk = k;
  if (BINA[k]) { c.varyant = 'BINA'; if (BINA[eski] && eski !== k) c.hucreler = projeDonanimi(k); }   // tip değişince proje donanımı
  else if (PKOSK[k]) { if (c.varyant !== 'KOK') c.varyant = 'PBK'; }                                // KÖK seçimi tip değişince korunur
  else if (c.varyant === 'PBK' || c.varyant === 'BINA' || !KOSK[k].v[c.varyant]) c.varyant = ilkVaryant(k);
  uygunGuc(c);
}

/**
 * Kabin sınıfı / tipi / varyantı / trafo gücü / trafo adedi / hücre serisi değişimi.
 * Özgün setSinif → setKosk → setVaryant → onTrafo sırasıyla ve aynı otomatik düzeltmelerle uygulanır.
 */
export function kabinDegistir(cabin, d = {}) {
  const n = norm(cabin);
  const c = { ...kabinKopya(cabin), sinif: n.sinif, kosk: n.kosk, varyant: n.varyant, trafoKva: n.trafoKva, hucreSeri: n.hucreSeri };
  if (cabin && cabin.sakli) c.sakli = kopya(cabin.sakli);
  let hedefSinif = d.sinif;
  if (d.kosk !== undefined) {
    const ks = sinifOf(d.kosk);
    if (!ks) return hata('Bilinmeyen köşk tipi: ' + d.kosk);
    if (hedefSinif && hedefSinif !== ks) return hata(`${d.kosk} tipi "${hedefSinif}" sınıfında yok`);
    hedefSinif = ks;
  }
  if (hedefSinif !== undefined) {
    if (!['mono', 'pref', 'bina'].includes(hedefSinif)) return hata('Bilinmeyen yapı sınıfı: ' + hedefSinif);
    sinifDegistir(c, hedefSinif);
  }
  if (d.kosk !== undefined && d.kosk !== c.kosk) koskDegistir(c, d.kosk);
  if (d.varyant !== undefined) {
    const v = String(d.varyant);
    const gecerli = c.sinif === 'bina' ? v === 'BINA' : c.sinif === 'pref' ? (v === 'PBK' || v === 'KOK') : !!KOSK[c.kosk].v[v];
    if (!gecerli) return hata('Bu köşk tipinde yok: ' + v);
    c.varyant = v; uygunGuc(c);
  }
  if (d.trafoKva !== undefined) {
    const k = Number(d.trafoKva);
    if (!TRAFO_OLCU[k]) return hata('Bilinmeyen trafo gücü: ' + d.trafoKva);
    c.trafoKva = k; delete c.trafoKg; uygunGuc(c);
  }
  if (d.trafoAdet !== undefined) {
    if (d.trafoAdet !== 1 && d.trafoAdet !== 2) return hata('Trafo adedi 1 veya 2 olabilir');
    c.trafoAdet = d.trafoAdet;
  }
  if (d.hucreSeri !== undefined) {
    if (!HUCRE_SERI[d.hucreSeri]) return hata('Bilinmeyen hücre serisi: ' + d.hucreSeri);
    c.hucreSeri = d.hucreSeri;
  }
  if (c.sakli && !Object.keys(c.sakli).length) delete c.sakli;
  return tamam(c);
}

/** Kullanıcı tanımlı ek kablo kanalı (mm): { ad, boy, gen, der } */
export function kanalEkle(cabin, k = {}) {
  const boy = Number(k.boy), g2 = Number(k.gen), der = Number(k.der);
  if (!(boy > 0) || !(g2 > 0) || !(der > 0)) return hata('Kanal boyu, genişliği ve derinliği sıfırdan büyük olmalıdır');
  const c = kabinKopya(cabin);
  c.kanallar = [...(cabin.kanallar || []).map((x) => ({ ...x }))];
  c.kanallar.push({ ad: String(k.ad || ('Kanal ' + (c.kanallar.length + 1))), boy, gen: g2, der });
  return tamam(c);
}
export function kanalSil(cabin, i) {
  const l = (cabin.kanallar || []).map((x) => ({ ...x }));
  if (!Number.isInteger(i) || i < 0 || i >= l.length) return hata('Geçersiz kanal sırası');
  l.splice(i, 1);
  const c = kabinKopya(cabin); c.kanallar = l;
  return tamam(c);
}

/* =====================================================================
   BASİT 2B PLAN — çizim ilkel şekilleri (mm, aynı orijin; y = Z)
===================================================================== */
export function planSekilleri(cabin) {
  const Y = yerlesim(cabin), n = norm(cabin);
  const W = Y.disBoy, Hh = Y.disEn, dw = Y.duvar;
  const rects = [], lines = [], labels = [];
  const R = (x, y, w, h, kind, label) => { const r = { x, y, w, h, kind }; if (label != null) r.label = label; rects.push(r); };
  const T = (x, y, text, size, kind) => labels.push({ x, y, text, size, kind });

  // dış duvarlar
  R(0, 0, W, dw, 'duvar'); R(0, Hh - dw, W, dw, 'duvar'); R(0, dw, dw, Hh - 2 * dw, 'duvar'); R(W - dw, dw, dw, Hh - 2 * dw, 'duvar');
  if (Y.sinif === 'bina') {
    const B = BINA[n.kosk], kk = B.kolon, ck = B.kolonCik;
    for (const x of [-ck, W - kk + ck]) for (const z of [-ck, Hh - kk + ck]) R(x, z, kk, kk, 'duvar', 'kolon');
    for (const ak of (B.araKolon || [])) { R(ak.x0, -ck, ak.x1 - ak.x0, kk, 'duvar', 'kolon'); R(ak.x0, Hh + ck - kk, ak.x1 - ak.x0, kk, 'duvar', 'kolon'); }
    if (B.dilatasyon) lines.push({ x1: B.dilatasyon, y1: -ck, x2: B.dilatasyon, y2: Hh + ck, kind: 'dilatasyon' });
  }
  // kablo kanalları + kapak plakaları
  for (const k of Y.kanallar) {
    if (k.x0 == null) continue;
    const kw = k.x1 - k.x0, kd = k.z1 - k.z0;
    R(k.x0, k.z0, kw, kd, 'kanal', k.ad);
    for (let i = 0; i < k.kapakAdet; i++) {
      if (k.kaynak === 'pref') { const ad = kw / k.kapakAdet; R(k.x0 + ad * i + 20, k.z0 + 20, ad - 40, kd - 40, 'kapak'); }
      else if (kw >= kd) { const ad = kw / k.kapakAdet; R(k.x0 + ad * i + 15, k.z0 + 30, ad - 30, kd - 60, 'kapak'); }
      else { const ad = kd / k.kapakAdet; R(k.x0 + 30, k.z0 + ad * i + 15, kw - 60, ad - 30, 'kapak'); }
    }
    T((k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2, k.ad, 90, 'kanal');
  }
  // boş hücre şeritleri (rezerv)
  for (const b of Y.rezerv) {
    R(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0, 'rezerv', (b.sira === 'on' ? 'İKİNCİ HÜCRE SIRASI' : 'İLAVE HÜCRE YERİ') + ' (REZERV)');
    T((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, `${b.x1 - b.x0} mm`, 90, 'rezerv');
  }
  // bölme duvarları
  for (const b of Y.bolmeDuvar) R(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0, 'bolme');
  // bölüm adları
  for (const b of Y.bolmeler) {
    const cx = (b.x0 + b.x1) / 2;
    if (Y.sinif === 'bina') T(b.ad === 'trafo' ? cx : (dw + BINA[n.kosk].bolmeH.x0) / 2, b.ad === 'trafo' ? b.z1 - 300 : dw + Y.icEn / 2, b.ad === 'trafo' ? 'TRAFO ODASI' : 'HÜCRE / AG SALONU', 140, 'bolum');
    else T(cx, Hh - dw - 120, b.ad === 'hucre' ? `YG ${b.x1 - b.x0}` : b.ad === 'trafo' ? (b.aktif === false ? 'YEDEK TRAFO YERİ' : `TRAFO BÖLÜMÜ (b=${b.x1 - b.x0})`) : `AG PANO (c=${b.x1 - b.x0})`, 110, 'bolum');
  }
  // hücreler
  for (const h of Y.hucreler) {
    if (h.x0 == null) continue;
    R(h.x0, h.z0, h.w, HD, h.sigar ? 'hucre' : 'hucreTasan', h.c);
    T((h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2, h.c, 110, 'hucre');
    if (h.f) T((h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2 + 180, h.f, 80, 'fider');
  }
  // trafo(lar): gabari bölmeye sığacak şekilde kırpılır (özgün 3B: boy ≤ iç en − 320, genişlik ≤ bölme − 260)
  Y.trafo.forEach((t, i) => {
    if (!t.aktif) return;
    const bol = Y.bolmeler.filter((b) => b.ad === 'trafo')[i];
    const g = Y.sinif === 'bina' ? t.G : Math.min((bol.x1 - bol.x0) - 260, t.G), u = Math.min(Y.icEn - 320, t.U);
    R(t.xc - g / 2, t.zc - u / 2, g, u, 'trafo', `${t.kva} kVA`);
    T(t.xc, t.zc, `${t.kva} kVA`, 140, 'trafo');
  });
  // AG pano(lar)
  for (const p of Y.pano) { R(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0, 'pano', 'ADP'); T((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, 'ADP', 120, 'pano'); }
  // kapılar: duvardaki boşluk + 90° açık kanat çizgileri (çift kanat, dışa)
  for (const k of Y.kapilar) {
    if (k.duvar === 'on') {
      R(k.x0, Hh - dw, k.w, dw, 'kapi', k.ad || (k.tip === 'trafo' ? 'trafo kapısı' : 'hücre kapısı'));
      lines.push({ x1: k.x0, y1: Hh, x2: k.x0, y2: Hh + k.w / 2, kind: 'kapiKanat' }, { x1: k.x0 + k.w, y1: Hh, x2: k.x0 + k.w, y2: Hh + k.w / 2, kind: 'kapiKanat' });
      T(k.x0 + k.w / 2, Hh + k.w / 2 + 120, `${k.ad ? k.ad + ' ' : ''}${k.w}`, 90, 'kapi');
    } else {
      R(W - dw, k.x0, dw, k.w, 'kapi', 'AG pano kapısı');
      lines.push({ x1: W, y1: k.x0, x2: W + k.w / 2, y2: k.x0, kind: 'kapiKanat' }, { x1: W, y1: k.x0 + k.w, x2: W + k.w / 2, y2: k.x0 + k.w, kind: 'kapiKanat' });
      T(W + k.w / 2 + 120, k.x0 + k.w / 2, `AG ${k.w}`, 90, 'kapi');
    }
  }
  // bina: OG kablosu duvar dibindeki kanallardan geçer (koruma hücresi → hücre kanalı → bağlantı kanalı → trafo)
  if (Y.sinif === 'bina' && Y.trafo.length) {
    const hk = Y.kanallar.find((k) => /hücre/i.test(k.ad)), bk = Y.kanallar.find((k) => /bağlantı/i.test(k.ad));
    const kor = Y.hucreler.find((h) => h.x0 != null && h.sira === 'arka' && trafoKorumaMi(h.c));
    if (hk && bk && kor) {
      const kx = Math.max(hk.x0 + 60, Math.min(hk.x1 - 60, (kor.x0 + kor.x1) / 2));
      const zH = (hk.z0 + hk.z1) / 2, xB = (bk.x0 + bk.x1) / 2, t = Y.trafo[0];
      const p = [[kx, kor.z1], [kx, zH], [xB, zH], [xB, t.zc], [t.xc + t.G / 2, t.zc]];
      for (let i = 0; i < p.length - 1; i++) lines.push({ x1: p[i][0], y1: p[i][1], x2: p[i + 1][0], y2: p[i + 1][1], kind: 'kabloOG' });
    }
  }
  return { w: W, h: Hh, rects, lines, labels };
}
