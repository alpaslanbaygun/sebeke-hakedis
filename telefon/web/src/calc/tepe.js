// AG-OG direk tepe kuvveti hesabı — TEDAŞ / EKAT tablo metodu (cer vektör toplamı + direk tipi seçimi).
// Saf fonksiyonlar: DOM yok, global durum yok, depolama yok. Özgün araçta ekrandan okunan her şey
// (şebeke tipi, bölge, tertip, açı…) burada parametredir. Bütün kuvvetler kg'dır.
// Açı kuralı: 0° = doğu/sağ, saat yönünün tersi pozitif; kuvvet, kolun kendi istikametinde direği çeker.
// Özgün aracın bilinen tuhaflıkları bilerek korunmuştur; her biri "QUIRK" notuyla işaretlidir.

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

/* ==================================================================
   VERİ TABLOLARI — referans araçtan programla aktarıldı; tests/tepe.test.mjs birebir doğrular
   ================================================================== */
export const TABLES = deepFreeze({
  /* İletken tertipleri. n: toplam iletken sayısı, pw: [40 m, 50 m] toplam rüzgâr yükü (kg),
     d: [1..4. bölge] Tmax demir direk (kg), b: [1..4. bölge] Tmax beton direk (kg) veya null, aer: ALPEK askı telli kablo */
  SETS: {
    al: {
      ad: "Alüminyum — klasik tertipler", tip: "al",
      tertipler: {
        "2R": { n: 2, pw: [25, 31], d: [140, 200, 294, 296], b: [140, 216, 296, 296] },
        "3R": { n: 3, pw: [37, 47], d: [210, 300, 441, 444], b: [210, 324, 444, 444] },
        "4R": { n: 4, pw: [50, 62], d: [280, 400, 588, 592], b: [280, 432, 592, 592] },
        "5R": { n: 5, pw: [62, 78], d: [350, 500, 735, 740], b: [350, 540, 740, 740] },
        "6R": { n: 6, pw: [74, 94], d: [420, 600, 882, 888], b: [420, 648, 888, 888] },
        "3P+R/P": { n: 5, pw: [83, 104], d: [490, 654, 899, 908], b: [490, 692, 944, 908] },
        "3P+2R/P": { n: 6, pw: [95, 120], d: [559, 754, 1046, 1055], b: [560, 800, 1092, 1056] },
        "3Po+R/P": { n: 5, pw: [89, 112], d: [535, 695, 968, 956], b: [535, 740, 1007, 956] },
        "3A+R/P": { n: 5, pw: [97, 121], d: [586, 748, 1025, 1010], b: [586, 794, 1067, 1010] },
        "3A+2R/P": { n: 6, pw: [109, 137], d: [656, 848, 1172, 1158], b: [656, 902, 1215, 1158] },
        "3Ph+R/Po": { n: 5, pw: [107, 134], d: [661, 834, 1135, 1086], b: [661, 873, 1178, 1086] },
        "3O+R/A": { n: 5, pw: [112, 140], d: [713, 923, 1223, 1167], b: null },
        "3O+2R/A": { n: 6, pw: [124, 156], d: [783, 1023, 1370, 1315], b: null },
        "1x10+16 ALP": { aer: 1, n: 2, pw: [20, 20], d: [80, 100, 120, 120], b: [80, 100, 120, 120] },
        "1x16+25 ALP": { aer: 1, n: 2, pw: [25, 25], d: [100.9, 118.42, 153, 151.1], b: [100.9, 118.42, 153, 151.1] },
        "1x25+35 ALP": { aer: 1, n: 2, pw: [30, 30], d: [125, 136.45, 172.9, 167.85], b: [125, 136.45, 172.9, 167.85] },
        "1x35+50 ALP": { aer: 1, n: 2, pw: [35, 35], d: [150.65, 163.55, 205.3, 194.45], b: [150.65, 163.55, 205.3, 194.45] },
        "1x50+70 ALP": { aer: 1, n: 2, pw: [40, 40], d: [185.62, 191.95, 238.93, 220.35], b: [185.62, 191.95, 238.93, 220.35] },
        "1x70+95 ALP": { aer: 1, n: 2, pw: [50, 50], d: [230.4, 234.7, 286.95, 256.2], b: [230.4, 234.7, 286.95, 256.2] },
        "1x10/16+16 ALP": { aer: 1, n: 3, pw: [20, 20], d: [80, 100, 120, 120], b: [80, 100, 120, 120] },
        "1x16/16+25 ALP": { aer: 1, n: 3, pw: [25, 25], d: [100.9, 118.42, 153, 151.1], b: [100.9, 118.42, 153, 151.1] },
        "1x25/16+35 ALP": { aer: 1, n: 3, pw: [30, 30], d: [125, 136.45, 172.9, 167.85], b: [125, 136.45, 172.9, 167.85] },
        "1x35/16+50 ALP": { aer: 1, n: 3, pw: [35, 35], d: [150.65, 163.55, 205.3, 194.45], b: [150.65, 163.55, 205.3, 194.45] },
        "1x50/16+70 ALP": { aer: 1, n: 3, pw: [40, 40], d: [185.62, 191.95, 238.93, 220.35], b: [185.62, 191.95, 238.93, 220.35] },
        "1x70/16+95 ALP": { aer: 1, n: 3, pw: [50, 50], d: [230.4, 234.7, 286.95, 256.2], b: [230.4, 234.7, 286.95, 256.2] },
        "2x10 ALP": { aer: 1, n: 2, pw: [35, 35], d: [110, 137, 181, 173], b: [110, 137, 181, 173] },
        "2x16 ALP": { aer: 1, n: 2, pw: [40, 40], d: [134.5, 157.9, 204, 201.5], b: [134.5, 157.9, 204, 201.5] },
        "3x10 ALP": { aer: 1, n: 3, pw: [40, 40], d: [165.4, 205.55, 270.8, 268], b: [165.4, 205.55, 270.8, 268] },
        "3x16+25 ALP": { aer: 1, n: 4, pw: [44, 44], d: [201.8, 236.84, 306, 302.2], b: [201.8, 236.84, 306, 302.2] },
        "3x25+35 ALP": { aer: 1, n: 4, pw: [53.45, 53.45], d: [250, 272.9, 345.8, 335.7], b: [250, 272.9, 345.8, 335.7] },
        "3x35+50 ALP": { aer: 1, n: 4, pw: [63.6, 63.6], d: [301.3, 327.1, 410.6, 388.9], b: [301.3, 327.1, 410.6, 388.9] },
        "3x50+70 ALP": { aer: 1, n: 4, pw: [72.4, 72.4], d: [371.24, 383.9, 477.86, 440.7], b: [371.24, 383.9, 477.86, 440.7] },
        "3x70+95 ALP": { aer: 1, n: 4, pw: [84.25, 84.25], d: [460.8, 469.4, 573.9, 512.4], b: [460.8, 469.4, 573.9, 512.4] },
        "3x95+95 ALP": { aer: 1, n: 4, pw: [84.25, 84.25], d: [460.8, 469.4, 573.9, 512.4], b: [460.8, 469.4, 573.9, 512.4] },
        "3x120+95 ALP": { aer: 1, n: 4, pw: [84.25, 84.25], d: [460.8, 469.4, 573.9, 512.4], b: [460.8, 469.4, 573.9, 512.4] },
        "3x16/16+25 ALP": { aer: 1, n: 5, pw: [45.3, 45.3], d: [201.8, 236.84, 306, 302.2], b: [201.8, 236.84, 306, 302.2] },
        "3x25/16+35 ALP": { aer: 1, n: 5, pw: [53.45, 53.45], d: [250, 272.9, 345.8, 335.7], b: [250, 272.9, 345.8, 335.7] },
        "3x35/16+50 ALP": { aer: 1, n: 5, pw: [63.6, 63.6], d: [301.3, 327.1, 410.6, 388.9], b: [301.3, 327.1, 410.6, 388.9] },
        "3x50/16+70 ALP": { aer: 1, n: 5, pw: [72.4, 72.4], d: [371.24, 383.9, 477.86, 440.7], b: [371.24, 383.9, 477.86, 440.7] },
        "3x70/16+95 ALP": { aer: 1, n: 5, pw: [84.25, 84.25], d: [460.8, 469.4, 573.9, 512.4], b: [460.8, 469.4, 573.9, 512.4] },
        "3x95/16+95 ALP": { aer: 1, n: 5, pw: [84.25, 84.25], d: [460.8, 469.4, 573.9, 512.4], b: [460.8, 469.4, 573.9, 512.4] },
        "3x120/16+95 ALP": { aer: 1, n: 5, pw: [84.25, 84.25], d: [460.8, 469.4, 573.9, 512.4], b: [460.8, 469.4, 573.9, 512.4] },
      },
    },
  },
  /* Tek iletkenler — maksimum çekme kuvvetleri ve rüzgâr yükleri */
  ILETKEN: {
    Rose: { pw: [12.418, 15.523], d: [70, 100, 147, 148], b: [70, 108, 148, 148] },
    Pansy: { pw: [17.614, 22.018], d: [105, 139, 188, 190], b: [105, 146, 199, 190] },
    Poppy: { pw: [19.768, 24.71], d: [120, 150, 211, 206], b: [120, 162, 220, 206] },
    Aster: { pw: [22.176, 27.72], d: [137, 170, 230, 224], b: [137, 180, 240, 224] },
    Phlox: { pw: [24.9, 31.126], d: [157, 194, 259, 244], b: [157, 201, 270, 244] },
    Oxlip: { pw: [25.761, 32.089], d: [169, 218, 282, 265], b: null },
  },
  /* Tertiplerin iletken bileşimi */
  KOMP: {
    "2R": { Rose: 2 },
    "3R": { Rose: 3 },
    "4R": { Rose: 4 },
    "5R": { Rose: 5 },
    "6R": { Rose: 6 },
    "3P+R/P": { Pansy: 4, Rose: 1 },
    "3P+2R/P": { Pansy: 4, Rose: 2 },
    "3Po+R/P": { Poppy: 3, Rose: 1, Pansy: 1 },
    "3A+R/P": { Aster: 3, Rose: 1, Pansy: 1 },
    "3A+2R/P": { Aster: 3, Rose: 2, Pansy: 1 },
    "3Ph+R/Po": { Phlox: 3, Rose: 1, Poppy: 1 },
    "3O+R/A": { Oxlip: 3, Rose: 1, Aster: 1 },
    "3O+2R/A": { Oxlip: 3, Rose: 2, Aster: 1 },
  },
  /* A-tipi demir direkler — rsK/rsZ: rüzgârsız kuvvetli/zayıf eksen, rlK/rlZ: rüzgârlı (kg) */
  ATIP: {
    "8I": { rsK: 300, rsZ: 90, rlK: 231, rlZ: 44 },
    "10I": { rsK: 500, rsZ: 160, rlK: 443, rlZ: 91 },
    "12I": { rsK: 900, rsZ: 230, rlK: 786, rlZ: 144 },
    "10U": { rsK: 700, rsZ: 170, rlK: 597, rlZ: 95 },
    "12U": { rsK: 1200, rsZ: 250, rlK: 1086, rlZ: 170 },
  },
  ATIP_SIRA: ["8I", "10I", "10U", "12I", "12U"],
  /* Kafes demir direkler — rs: rüzgârsız, rl: rüzgârlı (kg) */
  KAFES: {
    K1: { rs: 1000, rl: 871 },
    K2: { rs: 2000, rl: 1848 },
    K3: { rs: 3000, rl: 2828 },
    K4: { rs: 4000, rl: 3817 },
    K5: { rs: 5000, rl: 4806 },
  },
  KAFES_SIRA: ["K1", "K2", "K3", "K4", "K5"],
  /* SBA beton direk tipleri (tepe kuvveti = tip × 100 kg) */
  BETON_TIP: [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30],
  BETON_BOY: "9,30",
  BOLGE_AD: ["1. Bölge", "2. Bölge", "3. Bölge", "4. Bölge"],
  /* Müşterek (AG + YG) — YG tertipleri: rüzgâr yükü ve yalnız YG maksimum cerleri */
  YG_SIRA: ["3x3AWG", "3x1/0AWG", "3x3/0AWG", "3x266MCM", "3x477MCM"],
  YG: {
    "3x3AWG": { pw: [45, 57], d: [273, 321, 525, 525], b: [273, 405, 552, 525] },
    "3x1/0AWG": { pw: [64, 80], d: [411, 525, 705, 678], b: [411, 555, 747, 678] },
    "3x3/0AWG": { pw: [74, 93], d: [513, 662, 870, 810], b: [513, 702, 924, 810] },
    "3x266MCM": { pw: [86, 107], d: [660, 854, 1092, 984], b: [660, 906, 1170, 984] },
    "3x477MCM": { pw: [115, 144], d: [1014, 1218, 1500, 1281], b: [1014, 1299, 1608, 1281] },
  },
  /* Müşterek hat maksimum cerleri — satır sırası MUS_AG_SIRA, sütunlar 1..4. bölge */
  MUS_AG_SIRA: ["3R", "5R", "3P+R/P", "3Po+R/P", "3A+R/P", "3Ph+R/Po", "3O+R/A"],
  MUS_D: {
    "3x3AWG": [[443, 564, 882, 885], [557, 726, 1120, 1125], [669, 851, 1253, 1260], [706, 884, 1309, 1300], [748, 927, 1355, 1343], [808, 997, 1444, 1405], [851, 1068, 1515, 1470]],
    "3x1/0AWG": [[581, 768, 1062, 1038], [695, 930, 1300, 1278], [807, 1055, 1433, 1413], [844, 1088, 1489, 1453], [886, 1131, 1535, 1496], [949, 1201, 1624, 1558], [989, 1272, 1696, 1623]],
    "3x3/0AWG": [[683, 905, 1227, 1170], [797, 1067, 1465, 1410], [909, 1192, 1598, 1545], [946, 1225, 1654, 1585], [988, 1268, 1700, 1628], [1048, 1338, 1789, 1690], [1091, 1409, 1861, 1755]],
    "3x266MCM": [[830, 1097, 1449, 1344], [944, 1259, 1587, 1584], [1056, 1384, 1820, 1719], [1093, 1417, 1875, 1759], [1135, 1460, 1922, 1802], [1195, 1530, 2011, 1864], [1238, 1601, 2083, 1929]],
    "3x477MCM": [[1184, 1461, 1897, 1641], [1298, 1623, 2095, 1881], [1410, 1748, 2226, 2016], [1447, 1781, 2284, 2056], [1489, 1824, 2330, 2099], [1549, 1894, 2419, 2161], [1592, 1965, 2491, 2226]],
  },
  MUS_B: {
    "3x3AWG": [[443, 667, 911, 885], [557, 842, 1151, 1125], [669, 965, 1316, 1260], [706, 1004, 1367, 1300], [748, 1048, 1416, 1343], [808, 1112, 1506, 1405], null],
    "3x1/0AWG": [[581, 817, 1106, 1038], [695, 992, 1346, 1278], [807, 1115, 1511, 1413], [844, 1154, 1562, 1453], [886, 1198, 1611, 1496], [949, 1262, 1701, 1558], null],
    "3x3/0AWG": [[683, 964, 1283, 1170], [797, 1139, 1523, 1410], [909, 1262, 1688, 1545], [946, 1301, 1739, 1585], [988, 1345, 1788, 1628], [1048, 1409, 1878, 1690], null],
    "3x266MCM": [[830, 1168, 1529, 1344], [944, 1343, 1769, 1584], [1056, 1466, 1934, 1719], [1093, 1505, 1985, 1759], [1135, 1549, 2034, 1802], [1195, 1613, 2124, 1864], null],
    "3x477MCM": [[1184, 1561, 1967, 1641], [1298, 1736, 2207, 1881], [1410, 1859, 2372, 2016], [1447, 1898, 2423, 2056], [1489, 1942, 2472, 2099], [1549, 2006, 2562, 2161], null],
  },
  /* A-tipi müşterek demir direkler */
  MATIP: {
    "8U\"": { rsK: 350, rsZ: 94, rlK: 258, rlZ: 17 },
    "10I\"": { rsK: 350, rsZ: 121, rlK: 243, rlZ: 42 },
    "10U\"": { rsK: 550, rsZ: 132, rlK: 436, rlZ: 45 },
    "12I\"": { rsK: 750, rsZ: 175, rlK: 619, rlZ: 81 },
    "12U\"": { rsK: 1000, rsZ: 194, rlK: 868, rlZ: 99 },
  },
  MATIP_SIRA: ["10I\"", "8U\"", "10U\"", "12I\"", "12U\""], // QUIRK — 10I" bilerek 8U"dan önce gelir (otomatik seçim sırası)
  /* Kafes müşterek demir direkler — rüzgârlı değer rüzgârsızla aynıdır */
  MKAFES: {
    "K1\"": { rs: 831, rl: 831 },
    "K2\"": { rs: 1330, rl: 1330 },
    "K3\"": { rs: 2004, rl: 2004 },
    "K4\"": { rs: 2783, rl: 2783 },
    "K5\"": { rs: 4432, rl: 4432 },
  },
  MKAFES_SIRA: ["K1\"", "K2\"", "K3\"", "K4\"", "K5\""],
  MBETON_BOY: "11",
  MBETON_BOY_KD: "12",
  /* Yükseklik indirgeme katsayıları */
  AG_YG_IND: 0.81, // AG cerlerinin YG (tepe) seviyesine indirgenmesi — 11 m müşterek direk
  KD_ACI_ESIK: 120, // köşe açısı eşiği (°)
  KD_H_SERBEST: 10.5, // 12 m direğin serbest boyu (m)
  KD_K_YG_ALT: 9.5 / 10.5, // alt YG traversi ≈ 0,904
  KD_K_AG: 7.5 / 10.5, // 12 m direkte AG traversi ≈ 0,714
  /* Çizelge:12 — iletken toplam sayısına göre tek yanlı zayıflama yüzdeleri (6 = 6 ve daha çok) */
  ZAYIFLAMA: { 2: 100, 3: 75, 4: 60, 5: 50, 6: 40 },
});

const {
  ILETKEN, KOMP, ATIP, ATIP_SIRA, KAFES, KAFES_SIRA, BETON_TIP, BETON_BOY, BOLGE_AD,
  YG_SIRA, YG, MUS_AG_SIRA, MUS_D, MUS_B, MATIP, MATIP_SIRA, MKAFES, MKAFES_SIRA,
  MBETON_BOY, MBETON_BOY_KD, AG_YG_IND, KD_ACI_ESIK, KD_H_SERBEST, KD_K_YG_ALT, KD_K_AG,
} = TABLES;
const TERTIP = TABLES.SETS.al.tertipler; // tek iletken grubu vardır ("al")
const tertipAl = (k) => (typeof k === 'string' && Object.hasOwn(TERTIP, k) ? TERTIP[k] : undefined);
const ygAl = (k) => (typeof k === 'string' && Object.hasOwn(YG, k) ? YG[k] : undefined);

/* ==================================================================
   YARDIMCILAR
   ================================================================== */
const rad = (d) => d * Math.PI / 180;

/** Sayıyı Türkçe ondalık virgülle yazar (özgün fmt). */
export function fmt(x, dec) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return '—';
  dec = (dec === undefined) ? 0 : dec;
  return Number(x).toFixed(dec).replace('.', ',');
}
/** Tam sayıya çok yakınsa tam, değilse 2 haneli yazar (özgün fmtT). */
export function fmtT(x) {
  return (x === null || x === undefined) ? '—' : (Math.abs(x - Math.round(x)) < 0.005 ? fmt(x, 0) : fmt(x, 2));
}
/** Açıklık sütunu: a ≤ 40 → 0 (40 m), aksi hâlde 1 (50 m). NaN → 1 (özgün davranış). */
export function pwSutun(a) { return (a <= 40) ? 0 : 1; }

/** Çizelge:12 — tek yanlı zayıflama yüzdesi. */
export function zayiflamaYuzde(n) {
  if (n <= 2) return 100;
  if (n === 3) return 75;
  if (n === 4) return 60;
  if (n === 5) return 50;
  return 40;
}
/** Çizelge:12 — zayıflatılan tarafta KALAN oran. */
export function kalanOran(n) { return 1 - zayiflamaYuzde(n) / 100; }

/** Müşterek tertip anahtarı "YG#AG" → {yg, ag}. '#' yoksa yalnız AG sayılır. */
export function musAyir(tp) {
  const i = (tp || '').indexOf('#');
  return (i < 0) ? { yg: null, ag: tp || '' } : { yg: tp.slice(0, i), ag: tp.slice(i + 1) };
}
export function musAd(yg, ag) {
  return ag ? (yg + '+' + (ag.indexOf('+') >= 0 ? '(' + ag + ')' : ag)) : (yg + '  (yalnız YG)');
}
/** Tertibin ekranda gösterilen adı. */
export function tAd(tp, mus) {
  if (!mus) return tp;
  const a = musAyir(tp);
  if (a.yg) return musAd(a.yg, a.ag);
  return a.ag ? (a.ag + ' (yalnız AG)') : tp;
}
const yalnizAG = (tp) => { const a = musAyir(tp); return (!a.yg && !!a.ag); };
const agKismi = (tp) => { const a = musAyir(tp); return (a.ag && tertipAl(a.ag)) ? tertipAl(a.ag) : null; };

/** Beton direk boy etiketi: AG "9,30", müşterek "11", iki YG traversi gereken hâlde "12". */
export function betonBoy(mus, kd) { return mus ? (kd ? MBETON_BOY_KD : MBETON_BOY) : BETON_BOY; }
/** Beton direkte görev bazlı en küçük tip. */
export function betonTaban(gorev, mus) {
  if (mus) return (gorev === 'tasiyici') ? 3 : 6;
  if (gorev === 'tasiyici') return 3;
  if (gorev === 'durdurucu') return 5;
  if (gorev === 'bransman') return 8;
  return 0;
}

/** Bir kolun maksimum cerı (kg). cins: "demir" | "beton". Değer yoksa null. */
export function tmax(tertip, bolge, cins, mus) {
  if (mus) {
    const a = musAyir(tertip);
    if (!a.yg) { // yalnız AG kolu → 0,81 × Tmax(AG)
      const g = a.ag ? tertipAl(a.ag) : null; if (!g) return null;
      const gr = (cins === 'beton') ? (g.b || null) : g.d; if (!gr) return null;
      return AG_YG_IND * gr[bolge];
    }
    const y = ygAl(a.yg);
    if (!y) return null;
    if (!a.ag) return (cins === 'beton' ? y.b : y.d)[bolge];
    const i = MUS_AG_SIRA.indexOf(a.ag);
    if (i >= 0) { // kitap tablosunda yer alan tertipler
      const tab = (cins === 'beton') ? MUS_B[a.yg] : MUS_D[a.yg];
      const arr = tab ? tab[i] : null;
      return arr ? arr[bolge] : null;
    }
    // tabloda olmayan tertipler (2R, 4R, 6R, …2R/…, AER): P = Tmax(YG) + 0,81 × Tmax(AG)
    const agT = tertipAl(a.ag); if (!agT) return null;
    const agArr = (cins === 'beton') ? (agT.b || null) : agT.d; if (!agArr) return null;
    const ygArr = (cins === 'beton') ? y.b : y.d;
    return ygArr[bolge] + AG_YG_IND * agArr[bolge];
  }
  const t = tertipAl(tertip);
  if (!t) return null;
  const arr = (cins === 'beton') ? (t.b || t.d) : t.d; // QUIRK — AG'de beton tablosu yoksa sessizce demir değerine düşer (çağıranlar betonVarMi ile korur)
  return arr[bolge];
}
/** Tertibin beton direk cer değeri var mı? */
export function betonVarMi(tertip, mus) {
  if (mus) {
    const a = musAyir(tertip);
    if (!a.yg) { const g = a.ag ? tertipAl(a.ag) : null; return !!(g && g.b); }
    if (!a.ag) return true;
    const i = MUS_AG_SIRA.indexOf(a.ag);
    if (i >= 0) return !!(MUS_B[a.yg] && MUS_B[a.yg][i]);
    const agT = tertipAl(a.ag);
    return !!(agT && agT.b);
  }
  const tt = tertipAl(tertip);
  return !!(tt && tt.b);
}
/** Toplam rüzgâr yükü (kg). col: 0 = 40 m, 1 = 50 m. Müşterekte Pw(YG) + 0,81 × Pw(AG). */
export function pwAl(tertip, col, mus) {
  if (mus) {
    const a = musAyir(tertip);
    const agT = a.ag ? tertipAl(a.ag) : null;
    if (!a.yg) return agT ? AG_YG_IND * agT.pw[col] : 0;
    const y = ygAl(a.yg);
    if (!y) return 0;
    return y.pw[col] + (agT ? AG_YG_IND * agT.pw[col] : 0);
  }
  const t = tertipAl(tertip);
  return t ? t.pw[col] : 0;
}
/** Direkteki toplam iletken sayısı (müşterekte YG'nin 3 iletkeni de sayılır). */
export function iletkenSay(tertip, mus) {
  if (mus) { const t = agKismi(tertip); return (yalnizAG(tertip) ? 0 : 3) + (t ? t.n : 0); }
  const t = tertipAl(tertip);
  return t ? t.n : 0;
}
/** Köşede durdurucu — 12 m beton direkte bir kolun tepeye indirgenmiş cerı: P = kYG·Tmax(YG) + 0,714·Tmax(AG). */
function kdBetonP(tertip, bolge, kYG, ygOnly) {
  const a = musAyir(tertip);
  const y = a.yg ? ygAl(a.yg) : null;
  if (!y || !y.b) return null;
  let P = kYG * y.b[bolge];
  if (!ygOnly && a.ag) {
    const agT = tertipAl(a.ag);
    if (!agT || !agT.b) return null;
    P += KD_K_AG * agT.b[bolge];
  }
  return P;
}

/* ---------------- Direk seçimleri ---------------- */
/** Beton direk: görev tabanından başlayarak tepe kuvveti ≥ R olan ilk tip. */
export function secBeton(R, gorev, mus, kd) {
  const taban = betonTaban(gorev || '', mus);
  for (const t of BETON_TIP) {
    if (t < taban) continue;
    if (t * 100 >= R) return { ad: betonBoy(mus, kd) + '/' + t, kap: t * 100, taban: (t === taban && t * 100 > R) };
  }
  return null;
}
/** A-tipi demir direk. Rk: kuvvetli eksen, Rz: zayıf eksen bileşeni, ruz: rüzgârlı değerler mi. */
export function secATip(Rk, Rz, ruz, mus) {
  const T = mus ? MATIP : ATIP;
  for (const k of (mus ? MATIP_SIRA : ATIP_SIRA)) {
    const a = T[k];
    const K = ruz ? a.rlK : a.rsK, Z = ruz ? a.rlZ : a.rsZ;
    if (K >= Rk && Z >= Rz) return { ad: k, K, Z };
  }
  return null;
}
/** Kafes demir direk. */
export function secKafes(R, ruz, mus) {
  const T = mus ? MKAFES : KAFES;
  for (const k of (mus ? MKAFES_SIRA : KAFES_SIRA)) {
    const v = ruz ? T[k].rl : T[k].rs;
    if (v >= R) return { ad: k, kap: v };
  }
  return null;
}
/** Durdurucu / nihayet: RÜZGÂRSIZ kuvvetli eksen ≥ R ve RÜZGÂRLI zayıf eksen ≥ Pwz. */
function secATipKarma(R, Pwz, mus) {
  const T = mus ? MATIP : ATIP;
  for (const k of (mus ? MATIP_SIRA : ATIP_SIRA)) {
    const a = T[k];
    if (a.rsK >= R && a.rlZ >= Pwz) return { ad: k, K: a.rsK, Z: a.rlZ };
  }
  return null;
}
/** Elle seçilen direğin tahkiki (özgün manuelBlok). v: "A:10U" | "K:K2" | "B:8" | "". */
export function manuelKontrol(v, Rk, Rz, Rvek, ruz, kd, mus) {
  if (!v) return null;
  const tur = v.slice(0, 1), ad = v.slice(2);
  if (tur === 'A') {
    const T = mus ? MATIP : ATIP;
    if (!Object.hasOwn(T, ad)) return null;
    const a = T[ad], K = ruz ? a.rlK : a.rsK, Z = ruz ? a.rlZ : a.rsZ;
    const ok = (K >= Rk && Z >= Rz);
    return { ad, tur: 'A', ok, K, Z, Rk, Rz, ruz: !!ruz,
      not: (ruz ? 'Rüzgârlı' : 'Rüzgârsız') + ' kuvvetli eksen ' + K + ' kg / Rk = ' + fmt(Rk, 2) + ' kg · zayıf eksen ' + Z + ' kg / Rz = ' + fmt(Rz, 2) + ' kg' };
  }
  if (tur === 'K') {
    const T = mus ? MKAFES : KAFES;
    if (!Object.hasOwn(T, ad)) return null;
    const kap = ruz ? T[ad].rl : T[ad].rs, ok = (kap >= Rk + Rz);
    return { ad, tur: 'K', ok, kap, R: Rk + Rz, ruz: !!ruz,
      not: (ruz ? 'Rüzgârlı' : 'Rüzgârsız') + ' tepe kuvveti ' + kap + ' kg / R = Rk+Rz = ' + fmt(Rk + Rz) + ' kg' };
  }
  const kap = parseInt(ad, 10) * 100, Rb = (Rvek === null || Rvek === undefined) ? Rk : Rvek;
  const ok = (kap >= Rb);
  return { ad: betonBoy(mus, kd) + '/' + ad, tur: 'B', ok, kap, R: Rb,
    not: 'Tepe kuvveti ' + kap + ' kg / R = ' + fmt(Rb, 2) + ' kg (beton direkte bileşke vektöreldir)' };
}

/* ---------------- Seçilebilir tertipler ---------------- */
/** Verilen şebeke tipinde seçilebilir tertip anahtarları — özgün açılır listeyle aynı sırada. */
export function tertipler(mus) {
  const out = [];
  if (mus) {
    for (const yg of YG_SIRA) {
      out.push({ key: yg + '#', label: musAd(yg, ''), grup: yg });
      for (const ag of MUS_AG_SIRA) { if (tertipAl(ag)) out.push({ key: yg + '#' + ag, label: musAd(yg, ag), grup: yg }); }
      for (const ag of Object.keys(TERTIP)) { // QUIRK — özgün yorum "müşterekte AER yok" der ama liste AER (ALPEK) tertiplerini de içerir
        if (MUS_AG_SIRA.indexOf(ag) >= 0) continue;
        out.push({ key: yg + '#' + ag, label: musAd(yg, ag), grup: yg });
      }
    }
    const ci = [], ae = [];
    for (const ag of Object.keys(TERTIP)) {
      (TERTIP[ag].aer ? ae : ci).push({ key: '#' + ag, label: '↳ yalnız AG · ' + ag,
        grup: TERTIP[ag].aer ? '── YALNIZ AG · YG YOK ── AER · ALPEK askı telli' : '── YALNIZ AG · YG YOK ── çıplak alüminyum' });
    }
    return out.concat(ci, ae);
  }
  const a = [], b = [];
  for (const k of Object.keys(TERTIP)) {
    (TERTIP[k].aer ? b : a).push({ key: k, label: k, grup: TERTIP[k].aer ? 'AER — ALPEK askı telli kablo' : 'Çıplak alüminyum iletken' });
  }
  return a.concat(b);
}
/** Anahtar bu şebeke tipinde hesaplanabilir mi? (Port eklentisi: özgün araç geçersiz anahtarı sessizce 0 sayar.) */
export function tertipGecerli(tp, mus) {
  if (typeof tp !== 'string' || !tp) return false;
  if (!mus) return !!tertipAl(tp);
  const a = musAyir(tp);
  if (a.yg) return !!ygAl(a.yg) && (!a.ag || !!tertipAl(a.ag));
  return !!a.ag && !!tertipAl(a.ag);
}

/* ---------------- Sonuç iskeleti ---------------- */
const satirlar = (s) => String(s).split('\n').filter((x) => x.trim() !== '');
const demirA = (at) => (at ? { ad: at.ad, tip: 'A', K: at.K, Z: at.Z } : null);
const demirK = (kf) => (kf ? { ad: kf.ad, tip: 'K', kap: kf.kap } : null);
const hataSonuc = (girdi, hata) => ({ ok: false, hata, girdi, sonuc: {}, demir: null, beton: null, manuel: null, uyarilar: [], adimlar: [] });
const gecersiz = (girdi, tp) => hataSonuc(girdi, 'Tertip seçilmedi veya bu şebeke tipinde geçersiz: ' + (tp === undefined || tp === null || tp === '' ? '—' : String(tp)));
const manuelDeger = (m) => (typeof m === 'string' ? m : '');

/* ==================================================================
   1) TAŞIYICI (T) — belirleyici yük hatta dik rüzgârdır
   p: {mus, bolge, tp, a1, a2, manuel}
   ================================================================== */
export function hesapT(p) {
  const mus = !!p.mus, b = +p.bolge, tp = p.tp, a1 = +p.a1, a2 = +p.a2, man = manuelDeger(p.manuel);
  const girdi = { mus, bolge: b, tp, a1, a2, manuel: man };
  if (!(a1 > 0) || !(a2 > 0)) return hataSonuc(girdi, "Açıklıklar 0'dan büyük olmalı.");
  if (!tertipGecerli(tp, mus)) return gecersiz(girdi, tp);
  const aw = (a1 + a2) / 2, enBuyuk = Math.max(a1, a2);
  const col = pwSutun(enBuyuk); // açıklıklardan biri bile 40 m'yi geçerse 50 m sütunu
  const Pw = pwAl(tp, col, mus);
  const at = secATip(Pw, 0, true, mus); // RÜZGÂRLI kuvvetli eksen; QUIRK — taşıyıcıda kafes direğe otomatik geçiş yoktur
  const betonAd = betonBoy(mus) + '/3'; // bölge sonucu etkilemez; beton tipi sabittir
  const uyarilar = [];
  if (!at) uyarilar.push('Hiçbir A-tipi direk yetmiyor, kafes direk seçin.');
  if (!mus && at && at.ad !== '8I') uyarilar.push('8I direği bu rüzgâr yükünü karşılamıyor; bir üst tip seçildi.');
  uyarilar.push(mus ? "Müşterek taşıyıcıda beton direk tipi tüm bölgelerde ve tertiplerde 11/3'tür."
    : 'AG taşıyıcıda beton direk tipi tüm tertipler için değişmez.');
  const adim = 'a_w = (' + fmt(a1, 2) + ' + ' + fmt(a2, 2) + ') / 2 = ' + fmt(aw, 2) + ' m\n'
    + "Açıklıklardan biri 40 m'yi geçtiğinde 50 m sütunu esas alınır → en büyük açıklık " + fmt(enBuyuk, 2) + ' m\n'
    + 'P_w (' + tAd(tp, mus) + ', ' + (col ? '50' : '40') + ' m) = ' + fmtT(Pw) + ' kg\n'
    + 'Taşıyıcıda A-tipi direğin RÜZGÂRLI kuvvetli eksen değeri esas alınır.\n'
    + 'Direk kuvvetli ekseni hatta DİK olacak şekilde tesis edilir.';
  return {
    ok: true, girdi,
    sonuc: { bolgeAd: BOLGE_AD[b], tertipAd: tAd(tp, mus), aw, enBuyuk, col, sutun: col ? 50 : 40, Pw, R: Pw, Rk: Pw, Rz: 0, ruz: true, at, kf: null, betonBoy: betonBoy(mus) },
    demir: demirA(at),
    beton: { ad: betonAd, kap: 300, taban: false },
    manuel: manuelKontrol(man, Pw, 0, Pw, true, false, mus),
    uyarilar, adimlar: satirlar(adim),
  };
}

/* ==================================================================
   2) KÖŞEDE TAŞIYICI (KT) — R = 2·Tmax·cos(α/2) = n·Tmax
   p: {mus, bolge, tp, alfa, aw, manuel}
   ================================================================== */
export function hesapKT(p) {
  const mus = !!p.mus, b = +p.bolge, tp = p.tp, al = +p.alfa, aw = +p.aw, man = manuelDeger(p.manuel);
  const girdi = { mus, bolge: b, tp, alfa: al, aw, manuel: man };
  if (!(al > 0 && al <= 180)) return hataSonuc(girdi, 'α açısı 0–180° arasında olmalı.');
  if (!tertipGecerli(tp, mus)) return gecersiz(girdi, tp);
  const n = Math.round(2 * Math.cos(rad(al / 2)) * 100) / 100; // QUIRK — zaviye faktörü çarpmadan ÖNCE 2 haneye yuvarlanır (kitap tablosu gibi)
  const Td = tmax(tp, b, 'demir', mus), Tb = betonVarMi(tp, mus) ? tmax(tp, b, 'beton', mus) : null;
  const Rd = n * Td, Rb = (Tb !== null) ? n * Tb : null;
  const col = pwSutun(aw), Pw = pwAl(tp, col, mus);
  const PwA = Pw * Math.sin(rad(al / 2)); // açıortay yönündeki rüzgâr bileşeni — yalnız bilgi
  const ruzKT = !mus; // AG'de rüzgârlı, müşterekte rüzgârsız tepe kuvveti esas alınır
  const at = secATip(Rd, 0, ruzKT, mus), kf = secKafes(Rd, ruzKT, mus), bt = (Rb !== null) ? secBeton(Rb, 'tasiyici', mus) : null;
  const uyarilar = [];
  if (!at && kf) uyarilar.push('A-tipi yetersiz → kafes ' + kf.ad + ' (' + kf.kap + ' kg)');
  if (!at && !kf) uyarilar.push('Yeterli direk bulunamadı.');
  if (!bt) uyarilar.push(Rb === null ? 'Bu tertip için beton direk cer tablosu yok.' : 'Yeterli beton direk bulunamadı.');
  uyarilar.push('Direk, kuvvetli ekseni açıortay üzerinde olacak şekilde tesis edilir. Açıortay yönündeki rüzgâr bileşeni Pw·sin(α/2) = '
    + fmt(PwA) + ' kg olup bileşke ile aynı yönde değilse ayrıca tahkik edilir.');
  const adim = 'n = 2·cos(' + fmt(al / 2, 1) + '°) = ' + fmt(n, 2) + '\n'
    + 'R(demir) = ' + fmt(n, 2) + ' × ' + fmt(Td) + ' = ' + fmt(Rd, 2) + ' kg\n'
    + (Rb !== null ? ('R(beton) = ' + fmt(n, 2) + ' × ' + fmt(Tb) + ' = ' + fmt(Rb, 2) + ' kg\n') : '')
    + 'P_w (' + (col ? '50' : '40') + ' m) = ' + fmt(Pw) + ' kg → açıortay bileşeni ' + fmt(PwA) + ' kg';
  return {
    ok: true, girdi,
    sonuc: { bolgeAd: BOLGE_AD[b], tertipAd: tAd(tp, mus), n, Td, Tb, Rd, Rb, col, sutun: col ? 50 : 40, Pw, PwA, ruz: ruzKT, Rk: Rd, Rz: 0, at, kf, betonBoy: betonBoy(mus) },
    demir: demirA(at) || demirK(kf),
    beton: bt,
    manuel: manuelKontrol(man, Rd, 0, (Rb !== null ? Rb : Rd), ruzKT, false, mus),
    uyarilar, adimlar: satirlar(adim),
  };
}

/* ==================================================================
   3) DURDURUCU (D)
   p: {mus, bolge, mod:'ayni'|'fark', hal:'tum'|'yg' (yalnız müşterek), t1, t2, a1, a2, manuel}
   ================================================================== */
export function hesapD(p) {
  const mus = !!p.mus, b = +p.bolge, m = (p.mod === undefined || p.mod === null) ? 'ayni' : p.mod;
  const hal = (p.hal === undefined || p.hal === null) ? 'tum' : p.hal;
  const a1 = +p.a1, a2 = +p.a2, t1 = p.t1, t2 = p.t2, man = manuelDeger(p.manuel);
  const girdi = { mus, bolge: b, mod: m, hal, t1, t2, a1, a2, manuel: man };
  const uyarilar = [];
  let Rd, Rb, adim, dengeli = false;
  let T1d = null, T2d = null, T1b = null, T2b = null, kk = null, nIlet = null, yalnizYG = false, fark = null;

  if (mus) {
    // QUIRK — müşterek durdurucuda Çizelge:12 zayıflatması DAİMA uygulanır (mod yok sayılır); iki yan aynıysa bile R = T·(1−k) ≠ 0
    if (!t1 || !t2 || tmax(t1, b, 'demir', true) === null || tmax(t2, b, 'demir', true) === null) {
      return hataSonuc(girdi, 'Sol ve sağ taraf tertipleri seçilmeden hesap yapılamaz.');
    }
    const yg1 = musAyir(t1).yg, yg2 = musAyir(t2).yg;
    yalnizYG = (hal === 'yg') && !!(yg1 && yg2); // "yalnız YG durduruluyor" iki tarafta da YG ister
    const ygIptal = (hal === 'yg') && !yalnizYG;
    T1d = yalnizYG ? YG[yg1].d[b] : tmax(t1, b, 'demir', true);
    T2d = yalnizYG ? YG[yg2].d[b] : tmax(t2, b, 'demir', true);
    T1b = yalnizYG ? YG[yg1].b[b] : (betonVarMi(t1, true) ? tmax(t1, b, 'beton', true) : null);
    T2b = yalnizYG ? YG[yg2].b[b] : (betonVarMi(t2, true) ? tmax(t2, b, 'beton', true) : null);
    nIlet = yalnizYG ? 3 : iletkenSay((T1d <= T2d) ? t1 : t2, true);
    kk = kalanOran(nIlet);
    Rd = Math.max(T1d, T2d) - kk * Math.min(T1d, T2d);
    Rb = (T1b !== null && T2b !== null) ? (Math.max(T1b, T2b) - kk * Math.min(T1b, T2b)) : null;
    if (ygIptal) uyarilar.push('Taraflardan birinde YG iletkeni yok (yalnız AG); "yalnız YG durduruluyor" hali uygulanamadı, AG + YG birlikte durduruluyor kabul edildi.');
    adim = (ygIptal ? 'UYARI: taraflardan birinde YG iletkeni yok (yalnız AG); "yalnız YG durduruluyor" '
                    + 'hali uygulanamadı, AG + YG birlikte durduruluyor kabul edildi.\n' : '')
         + (yalnizYG ? 'Yalnız YG iletkenleri durduruluyor (' + yg1 + ', 3 iletken)\n'
                     + 'AG iletkenleri taşıyıcı olarak devam eder; rüzgâr yükleri hesaba dahildir.\n'
                     : 'AG + YG birlikte durduruluyor (' + nIlet + ' iletken)\n')
         + 'Çizelge:12 → zayıflatılan tarafta kalan oran = ' + fmt(kk, 2) + '\n'
         + 'R(demir) = ' + fmtT(Math.max(T1d, T2d)) + ' − ' + fmt(kk, 2) + '×' + fmtT(Math.min(T1d, T2d)) + ' = ' + fmt(Rd, 2) + ' kg\n'
         + (Rb !== null ? 'R(beton) = ' + fmt(Rb, 2) + ' kg\n' : '');
  } else {
    if (!tertipGecerli(t1, false)) return gecersiz(girdi, t1);
    if (!tertipGecerli(t2, false)) return gecersiz(girdi, t2);
    if (m === 'ayni') {
      if (t1 === t2) {
        dengeli = true; Rd = 0; Rb = betonVarMi(t1, false) ? 0 : null;
        adim = 'Her iki tarafta ' + tAd(t1, false) + ' → iletken sayısı ve tipi aynı.\n'
             + 'Hat doğrusal olduğundan cerler dengelenir, bileşke cer R = 0 kg.\n';
      } else {
        const k1 = Object.hasOwn(KOMP, t1) ? KOMP[t1] : null, k2 = Object.hasOwn(KOMP, t2) ? KOMP[t2] : null;
        if (!k1 || !k2) {
          return hataSonuc(girdi, 'Bu tertiplerin iletken bileşimi tanımlı değil (AER kablolar tek parçadır). '
            + 'Farklı iki tertip için İletken tipi değişiyor seçeneğini kullanın.');
        }
        const tipler = {}; Object.keys(k1).forEach((x) => { tipler[x] = 1; }); Object.keys(k2).forEach((x) => { tipler[x] = 1; });
        let arti = 0, eksi = 0; fark = [];
        Object.keys(tipler).forEach((c) => {
          const f = (k1[c] || 0) - (k2[c] || 0);
          if (f > 0) arti++; if (f < 0) eksi++;
          if (f !== 0) fark.push({ c, n: Math.abs(f), yon: (f > 0 ? 'sol' : 'sağ') });
        });
        if (arti > 0 && eksi > 0) {
          return hataSonuc(girdi, 'Seçilen iki tertipte iletken tipi değişiyor (' + t1 + ' ↔ ' + t2 + '). '
            + 'Bu durum için yukarıdan İletken tipi değişiyor seçeneğini işaretleyin.');
        }
        // dengelenmeyen iletkenler nihayet gibi çalışır: R = fark adedi × Tmax(tek iletken)
        Rd = 0; Rb = 0; let betonTam = true;
        fark.forEach((f) => {
          const I = ILETKEN[f.c];
          Rd += f.n * I.d[b];
          if (I.b) Rb += f.n * I.b[b]; else betonTam = false;
        });
        if (!betonTam) Rb = null;
        adim = 'Dengelenmeyen iletkenler (' + fark[0].yon + ' tarafta fazla):\n'
             + fark.map((f) => '  ' + f.n + ' × ' + f.c + ' → ' + f.n + ' × ' + fmtT(ILETKEN[f.c].d[b]) + ' = ' + fmtT(f.n * ILETKEN[f.c].d[b]) + ' kg').join('\n') + '\n'
             + 'R(demir) = ' + fmtT(Rd) + ' kg\n'
             + (Rb !== null ? 'R(beton) = ' + fmtT(Rb) + ' kg\n' : '');
      }
    } else {
      T1d = tmax(t1, b, 'demir', false); T2d = tmax(t2, b, 'demir', false);
      if (t1 === t2) {
        dengeli = true; Rd = 0;
        Rb = betonVarMi(t1, false) ? 0 : null;
        adim = 'Her iki tarafta ' + tAd(t1, false) + ' → cerler eşit ve zıt yönde.\n'
             + 'Hat doğrusal (α = 180°) olduğundan bileşke cer R = 0 kg.\n'
             + 'Direk tipi yalnızca hatta dik rüzgâr yüküne göre belirlenir.\n';
      } else {
        const buyukD = Math.max(T1d, T2d), kucukD = Math.min(T1d, T2d);
        const kucukTertip = (T1d < T2d) ? t1 : t2;
        nIlet = iletkenSay(kucukTertip, false);
        kk = kalanOran(nIlet);
        Rd = buyukD - kk * kucukD;
        if (betonVarMi(t1, false) && betonVarMi(t2, false)) {
          T1b = tmax(t1, b, 'beton', false); T2b = tmax(t2, b, 'beton', false);
          Rb = Math.max(T1b, T2b) - kk * Math.min(T1b, T2b);
        } else Rb = null;
        adim = 'Zayıflatılan taraf: ' + tAd(kucukTertip, false) + ' (' + nIlet + ' iletken) → kalan oran ' + fmt(kk, 2) + '\n'
             + 'R(demir) = ' + fmt(buyukD) + ' − ' + fmt(kk, 2) + '×' + fmt(kucukD) + ' = ' + fmt(Rd, 2) + ' kg\n'
             + (Rb !== null ? 'R(beton) = ' + fmt(Rb, 2) + ' kg\n' : '');
      }
    }
  }

  // Rüzgâr tahkiki — zayıf eksen (hatta dik); "yalnız YG" halinde de AG payı dahildir
  const p1 = pwAl(t1, pwSutun(a1), mus), p2 = pwAl(t2, pwSutun(a2), mus);
  const Pwz = p1 / 2 + p2 / 2;
  // Direk seçimi: kuvvetli eksen hat doğrultusunda — rüzgârsız kuvvetli, rüzgârlı zayıf eksen
  const at = secATipKarma(Rd, Pwz, mus);
  const kf = secKafes(Rd, false, mus);
  const bt = (Rb !== null) ? secBeton(Rb, 'durdurucu', mus) : null;

  if (!at && kf) uyarilar.push('A-tipi yetersiz → kafes ' + kf.ad);
  if (!at && !kf) uyarilar.push('Yeterli direk bulunamadı.');
  if (Rb === null) uyarilar.push('Bu tertip için beton cer tablosu yok.');
  if (bt && bt.taban) uyarilar.push(mus ? "Müşterek durdurucu beton direkte 11/6'dan küçük seçilmez." : "Durdurucu beton direkte 500 kg'ın altına inilmez.");
  if (dengeli && !mus) uyarilar.push('Hat doğrusal ve iki yanda aynı tertip var. Durdurucu bağda cerler birbirini dengelediğinden bileşke cer sıfırdır; '
    + 'Çizelge:12 zayıflatması yalnızca iletken tipi değiştiğinde uygulanır. Direk tipi burada yalnızca hatta dik rüzgâr yüküne göre belirlenmiştir.');
  uyarilar.push('Kuvvetli eksen, bileşke kuvveti karşılayacak şekilde hat doğrultusunda tesis edilmelidir. Zayıf eksende rüzgârlı tepe kuvveti tahkiki yapılmıştır.');
  adim += 'Rüzgâr: ' + fmt(p1) + '/2 + ' + fmt(p2) + '/2 = ' + fmt(Pwz, 2) + ' kg (zayıf eksen)';
  return {
    ok: true, girdi,
    sonuc: { bolgeAd: BOLGE_AD[b], t1Ad: tAd(t1, mus), t2Ad: tAd(t2, mus), Rd, Rb, p1, p2, Pwz, dengeli, yalnizYG,
      T1d, T2d, T1b, T2b, k: kk, nIlet, fark, Rvek: Math.sqrt(Rd * Rd + Pwz * Pwz), Rk: Rd, Rz: Pwz, ruz: false, at, kf, betonBoy: betonBoy(mus) },
    demir: demirA(at) || demirK(kf),
    beton: bt,
    manuel: manuelKontrol(man, Rd, Pwz, (Rb !== null ? Rb : Rd), false, false, mus),
    uyarilar, adimlar: satirlar(adim),
  };
}

/* ==================================================================
   4) KÖŞEDE DURDURUCU (KD) — 1., 4., 5. Varsayım
   p: {mus, bolge, hal:'mdk'|'mdkyg'|'mn' (yalnız müşterek), t1, t2, alfa, aw, manuel}
   ================================================================== */
/** Açıortay ekseninde bileşenler: Rb1 = (Ta+Tb)·cos(α/2), Rd1 = |Ta−Tb|·sin(α/2). Rd: demir (skaler), Rb: beton (vektörel). */
export function varsayim(Ta, Tb, c, s) {
  const Rb1 = (Ta + Tb) * c, Rd1 = Math.abs(Ta - Tb) * s;
  return { Rb1, Rd1, Rd: Rb1 + Rd1, Rb: Math.sqrt(Rb1 * Rb1 + Rd1 * Rd1) };
}
/** A-kolu ekseninde bileşenler: Rx = |Ta + Tb·cosα|, Ry = |Tb·sinα|. */
export function varsayimA(Ta, Tb, ca, sa) {
  const Rx = Math.abs(Ta + Tb * ca), Ry = Math.abs(Tb * sa);
  return { Rb1: Rx, Rd1: Ry, Rd: Rx + Ry, Rb: Math.sqrt(Rx * Rx + Ry * Ry) };
}
export function hesapKD(p) {
  const mus = !!p.mus, b = +p.bolge, t1 = p.t1, t2 = p.t2, al = +p.alfa, aw = +p.aw, man = manuelDeger(p.manuel);
  const hal = mus ? ((p.hal === undefined || p.hal === null) ? 'mdk' : p.hal) : null;
  const girdi = { mus, bolge: b, hal, t1, t2, alfa: al, aw, manuel: man };
  if (!(al > 0 && al <= 180)) return hataSonuc(girdi, 'α açısı 0–180° arasında olmalı.');
  if (!tertipGecerli(t1, mus)) return gecersiz(girdi, t1);
  if (!tertipGecerli(t2, mus)) return gecersiz(girdi, t2);
  const yari = al / 2, c = Math.cos(rad(yari)), s = Math.sin(rad(yari));
  const col = pwSutun(aw);

  const mnKose = mus && hal === 'mn'; // taşıyıcı köşe: hat sürekli, zayıflatma yok
  const yg1 = musAyir(t1).yg, yg2 = musAyir(t2).yg;
  const ygVar = !!(yg1 && yg2);
  const ygDur = mus && hal === 'mdkyg' && ygVar; // yalnız YG durduruluyor
  const ygDurIptal = mus && hal === 'mdkyg' && !ygVar;
  const T1d = ygDur ? YG[yg1].d[b] : tmax(t1, b, 'demir', mus);
  const T2d = ygDur ? YG[yg2].d[b] : tmax(t2, b, 'demir', mus);
  const betonOK = ygDur ? true : (betonVarMi(t1, mus) && betonVarMi(t2, mus));

  // α ≤ 120° müşterek durdurucu köşede beton direk 12 m; cerler travers yükseklikleriyle tepeye indirgenir
  const darKose = (al <= KD_ACI_ESIK);
  const kdBoy = mus && !mnKose && darKose;
  let T1b, T2b, kdP = null;
  if (kdBoy && betonOK) {
    T1b = kdBetonP(t1, b, 1, ygDur);           // A-kolu — üst YG traversi
    T2b = kdBetonP(t2, b, KD_K_YG_ALT, ygDur); // B-kolu — alt YG traversi
    if (T1b === null || T2b === null) { T1b = null; T2b = null; } else kdP = { P1: T1b, P2: T2b };
  } else {
    T1b = ygDur ? YG[yg1].b[b] : (betonOK ? tmax(t1, b, 'beton', mus) : null);
    T2b = ygDur ? YG[yg2].b[b] : (betonOK ? tmax(t2, b, 'beton', mus) : null);
  }
  const betonVar = betonOK && T1b !== null && T2b !== null;

  // Kafes demir direğin dikiliş istikameti: AG de durduruluyorsa A-kolu ekseni, değilse açıortay
  const agDur = mus && hal === 'mdk' && darKose;
  const ag1 = !!musAyir(t1).ag, ag2 = !!musAyir(t2).ag;
  const aKoluT1 = (ag1 !== ag2) ? ag1 : (T1d >= T2d);
  const ca = Math.cos(rad(al)), sa = Math.sin(rad(al));
  const vD = (Ta, Tb) => {
    if (!agDur) return varsayim(Ta, Tb, c, s);
    return aKoluT1 ? varsayimA(Ta, Tb, ca, sa) : varsayimA(Tb, Ta, ca, sa);
  };

  // 1. Varsayım — küçük (demir) taraf Çizelge:12 ile zayıflatılır; eşitlikte 1. taraf
  const kucukIs1 = (T1d <= T2d);
  const kucuk = kucukIs1 ? { ad: t1, v: T1d, dig: T2d, digAd: t2 } : { ad: t2, v: T2d, dig: T1d, digAd: t1 };
  const nIlet = ygDur ? 3 : iletkenSay(kucuk.ad, mus);
  const k = kalanOran(nIlet);
  const v1d = vD(kucukIs1 ? T1d * k : T1d, kucukIs1 ? T2d : T2d * k);
  let v1b = null;
  if (betonVar) {
    const bb = (T1b <= T2b) ? { v: T1b, dig: T2b } : { v: T2b, dig: T1b };
    v1b = varsayim(bb.dig, bb.v * k, c, s); // QUIRK — k demir cerine göre küçük olan taraftan bulunur, betonda da aynı k kullanılır
  }

  // 4. Varsayım (rüzgâr) yalnız AG şebekede; müşterekte tablo cerleri zaten maksimumdur
  const ekatVars = !mus;
  const pw1 = pwAl(t1, col, mus), pw2 = pwAl(t2, col, mus);
  const sumPw = ekatVars ? ((pw1 * s) / 2 + (pw2 * s) / 2) : 0;
  const v4d = vD(T1d, T2d);
  const v4b = betonVar ? varsayim(Math.max(T1b, T2b), Math.min(T1b, T2b), c, s) : null;
  // 5. Varsayım — her iki yanda %100 cer
  const v5d = v4d, v5b = v4b;

  const R1d = v1d.Rd, R4d = v4d.Rd + sumPw, R5d = v5d.Rd; // QUIRK — ΣPw bileşkeye vektörel değil SKALER eklenir
  const R1b = v1b ? v1b.Rb : null, R4b = v4b ? (v4b.Rb + sumPw) : null, R5b = v5b ? v5b.Rb : null;

  const AD_ZAY = ekatVars ? '1. Varsayım' : 'zayıflamaya göre';
  const AD_RUZ = '4. Varsayım';
  const AD_MAX = ekatVars ? '5. Varsayım' : 'bileşkeye göre (maksimum cerler)';
  const enD = mnKose ? R5d : (ekatVars ? Math.max(R1d, R4d, R5d) : Math.max(R1d, R5d));
  const hangiD = mnKose ? AD_MAX : ((enD === R1d) ? AD_ZAY : ((ekatVars && enD === R4d) ? AD_RUZ : AD_MAX));
  let enB = null, hangiB = '—';
  if (betonVar) {
    enB = mnKose ? R5b : (ekatVars ? Math.max(R1b, R4b, R5b) : Math.max(R1b, R5b));
    hangiB = mnKose ? AD_MAX : ((enB === R1b) ? AD_ZAY : ((ekatVars && enB === R4b) ? AD_RUZ : AD_MAX));
  }

  // Belirleyici varsayımın bileşenleri: eksen → kuvvetli, dik → zayıf
  const vSec = (hangiD === AD_ZAY) ? v1d : v4d;
  const RkAc = vSec.Rb1 + ((hangiD === AD_RUZ) ? sumPw : 0); // QUIRK — rüzgâr yalnız 4. Varsayım belirleyiciyse kuvvetli eksene eklenir
  const RzDik = vSec.Rd1;
  const kafesZorunlu = mus && darKose; // müşterekte α ≤ 120° → A-tipi uygun değil
  const at = kafesZorunlu ? null : secATip(RkAc, RzDik, false, mus), kf = secKafes(enD, false, mus);
  const bt = (enB !== null) ? secBeton(enB, 'durdurucu', mus, kdBoy) : null;

  const uyarilar = [];
  if (kdP) uyarilar.push('Köşede durdurucuda YG hem A-kolu hem B-kolu istikametine nihayet bağlanır; alttaki travers üsttekinin 1 m altına monte edileceğinden '
    + 'beton direk 12 m seçilmek zorundadır (α = ' + fmt(al) + '° ≤ ' + KD_ACI_ESIK + '°). Cerler tepeye indirgenir: üst YG traversi k = 1,000 · alt YG traversi k = '
    + fmt(KD_K_YG_ALT, 3) + (ygDur ? '' : ' · AG traversi k = ' + fmt(KD_K_AG, 3)) + '. (11 m direğin 0,81 standart indirgemesi bu halde geçerli değildir.)');
  if (mnKose) uyarilar.push('Taşıyıcı köşe: hat sürekli olduğundan (YG taşıyıcı; AG ister taşıyıcı ister nihayet) Çizelge:12 zayıflatması uygulanmaz, '
    + 'iki yanın maksimum cerlerinin bileşkesi alınır.');
  else {
    if (ygDurIptal) uyarilar.push('Kollardan birinde YG iletkeni yok (yalnız AG). "Yalnız YG durduruluyor" hali uygulanamadığından hesap, '
      + 'AG + YG birlikte durduruluyor kabulüyle yapıldı.');
    if (ygDur) uyarilar.push('Yalnız YG iletkenleri durduruluyor; AG iletkenleri taşıyıcı olarak devam ediyor. Bileşkeye yalnız YG cerleri girer, rüzgâr yükünde AG payı da vardır.');
  }
  if (at && al <= 140) uyarilar.push('Geniş açılı somelerde kafes direk (' + (kf ? kf.ad : '—') + ') tercih edilmesi uygun olur.');
  if (!at && kf) uyarilar.push(kafesZorunlu
    ? ('α = ' + fmt(al) + '° ≤ ' + KD_ACI_ESIK + '° olduğundan hat durdurulmak zorundadır; A-tipi direk uygun değildir, doğrudan kafes seçilir.')
    : ('Açıortaya dik bileşen ' + fmt(RzDik, 2) + ' kg hiçbir A-tipi direğin zayıf eksenine sığmıyor → kafes ' + kf.ad + '.'));
  if (!at && !kf) uyarilar.push('Yeterli direk bulunamadı.');
  if (enB === null) uyarilar.push('Bu tertip için beton cer tablosu yok.');
  if (bt && bt.taban) uyarilar.push(mus ? ('Müşterek durdurucu köşede ' + betonBoy(mus, kdBoy) + "/6'dan küçük seçilmez.") : "Durdurucu beton direkte 500 kg'ın altına inilmez.");
  if (al >= 178) uyarilar.push("α = 180° köşe değil, doğrusal hat demektir. Bu durumda EKAT'ın 1. Varsayım zayıflatması yerine Durdurucu (D) hesabı kullanılmalıdır; "
    + 'iki yanda aynı tertip varsa cerler dengelenir ve bileşke sıfır olur.');
  uyarilar.push((agDur
    ? ('AG bu direkte durdurulduğundan kafes demir direk A-kolu (' + (aKoluT1 ? 'geliş — T₁' : 'gidiş — T₂') + ') istikametine dikilir; '
      + 'bileşenler açıortaya değil bu eksene ayrıştırılmıştır: R = Rx+Ry. Beton direk açıortayda kalır, onun bileşkesi vektöreldir (R = √(Rb²+Rd²)).')
    : ('Direk açıortay yönünde dikilir. Demir direkte bileşke skaler toplamla (R = Rb+Rd), beton direkte vektörel olarak (R = √(Rb²+Rd²)) alınmıştır.'))
    + ' α ≤ 120° ise hattın mutlaka durdurulması gerekir.');

  const agEk = (tp) => ((!ygDur && musAyir(tp).ag) ? (' + ' + fmt(KD_K_AG, 3) + '·AG') : '');
  const adim = 'α/2 = ' + fmt(yari, 1) + '°   cos = ' + fmt(c, 3) + '   sin = ' + fmt(s, 3) + '\n'
    + AD_ZAY + ": T₂' = " + fmt(k, 2) + ' × ' + fmt(kucuk.v) + ' = ' + fmt(kucuk.v * k) + ' kg\n'
    + (agDur
      ? ('  R_x = |T_A + T_B·cosα| = ' + fmt(v1d.Rb1) + ' kg\n'
        + '  R_y = |T_B·sinα|       = ' + fmt(v1d.Rd1) + ' kg\n')
      : ('  R_b = (' + fmt(kucuk.dig) + ' + ' + fmt(kucuk.v * k) + ')·cos = ' + fmt(v1d.Rb1) + ' kg\n'
        + '  R_d = (' + fmt(kucuk.dig) + ' − ' + fmt(kucuk.v * k) + ')·sin = ' + fmt(v1d.Rd1) + ' kg\n'))
    + (ekatVars ? ('4. Varsayım: ΣP_w = ' + fmt(pw1) + '·sin/2 + ' + fmt(pw2) + '·sin/2 = ' + fmt(sumPw, 2) + ' kg\n') : '')
    + AD_MAX + ': her iki yanda %100 cer → ' + (agDur ? 'R_x' : 'R_b') + ' = ' + fmt(v5d.Rb1) + ' , ' + (agDur ? 'R_y' : 'R_d') + ' = ' + fmt(v5d.Rd1) + ' kg'
    + (agDur ? ('\n\nDemir direk — A-kolu ekseni (' + (aKoluT1 ? 'T₁ tarafı' : 'T₂ tarafı') + '), α = ' + fmt(al) + '°\n'
            + '  R_x = |T_A + T_B·cosα| = ' + fmt(v5d.Rb1) + ' kg\n'
            + '  R_y = |T_B·sinα|       = ' + fmt(v5d.Rd1) + ' kg\n'
            + '  R   = R_x + R_y        = ' + fmt(v5d.Rd) + ' kg') : '')
    + (kdP ? ('\n\nBeton direk — 12 m, serbest boy ' + fmt(KD_H_SERBEST, 1) + ' m\n'
            + '  P₁ (A-kolu) = 1,000·YG' + agEk(t1) + ' = ' + fmt(kdP.P1) + ' kg\n'
            + '  P₂ (B-kolu) = ' + fmt(KD_K_YG_ALT, 3) + '·YG' + agEk(t2) + ' = ' + fmt(kdP.P2) + ' kg\n'
            + '  R_x = (P₁−P₂)·sin(α/2) = ' + fmt(Math.abs(kdP.P1 - kdP.P2) * s) + ' kg\n'
            + '  R_y = (P₁+P₂)·cos(α/2) = ' + fmt((kdP.P1 + kdP.P2) * c) + ' kg\n'
            + '  R   = √(R_x²+R_y²) = ' + fmt(Math.sqrt(Math.pow(Math.abs(kdP.P1 - kdP.P2) * s, 2) + Math.pow((kdP.P1 + kdP.P2) * c, 2))) + ' kg') : '');

  const eksenAd = agDur ? 'A-kolu' : 'açıortay';
  const satir = (ad, v, pw, rd, rb) => ({ ad, eksen: v.Rb1, dik: v.Rd1, sumPw: pw, Rd: rd, Rb: rb });
  const varsayimlar = [];
  if (!mnKose) varsayimlar.push(satir(AD_ZAY, v1d, 0, R1d, R1b));
  if (!mnKose && ekatVars) varsayimlar.push(satir(AD_RUZ, v4d, sumPw, R4d, R4b));
  varsayimlar.push(satir(mnKose ? 'Maksimum cerler' : AD_MAX, v5d, 0, R5d, R5b));

  return {
    ok: true, girdi,
    sonuc: { bolgeAd: BOLGE_AD[b], t1Ad: tAd(t1, mus), t2Ad: tAd(t2, mus), c, s, col, sutun: col ? 50 : 40,
      T1d, T2d, T1b, T2b, betonVar, kdP, darKose, kdBoy, agDur, aKoluT1, mnKose, ygDur, ygDurIptal, ekatVars,
      kucuk, nIlet, k, pw1, pw2, sumPw, v1d, v1b, v4d, v4b,
      R1d, R4d, R5d, R1b, R4b, R5b, enD, hangiD, enB, hangiB, RkAc, RzDik, Rk: RkAc, Rz: RzDik, ruz: false,
      eksenAd, varsayimlar, at, kf, betonBoy: betonBoy(mus, kdBoy) },
    demir: demirA(at) || demirK(kf),
    beton: bt,
    kafesZorunlu,
    manuel: manuelKontrol(man, RkAc, RzDik, (enB !== null ? enB : enD), false, kdBoy, mus),
    uyarilar, adimlar: satirlar(adim),
  };
}

/* ==================================================================
   5) NİHAYET (N) — R = Tmax (tek yanlı); zayıf eksende Pw/2 tahkiki
   p: {mus, bolge, tp, hal:'mn'|'tam' (yalnız müşterek), a, manuel}
   ================================================================== */
export function hesapN(p) {
  const mus = !!p.mus, b = +p.bolge, tp = p.tp, a = +p.a, man = manuelDeger(p.manuel);
  const hal = mus ? ((p.hal === undefined || p.hal === null) ? 'mn' : p.hal) : 'ag';
  const girdi = { mus, bolge: b, tp, hal, a, manuel: man };
  if (!tertipGecerli(tp, mus)) return gecersiz(girdi, tp);
  let Td = tmax(tp, b, 'demir', mus), Tb = betonVarMi(tp, mus) ? tmax(tp, b, 'beton', mus) : null;
  const col = pwSutun(a);
  let Pwz, notMN = '', mn = false;
  const agT = mus ? agKismi(tp) : null;
  const yg = musAyir(tp).yg;
  if (mus && hal === 'mn' && agT && yg) {
    // YG taşıyıcı devam eder, yalnız AG biter: AG cerleri YG seviyesine indirgenir
    mn = true;
    Td = AG_YG_IND * agT.d[b];
    Tb = agT.b ? AG_YG_IND * agT.b[b] : Td; // QUIRK — AG'nin beton tablosu yoksa beton için demir değeri kullanılır
    Pwz = YG[yg].pw[col] + AG_YG_IND * agT.pw[col] / 2;
    notMN = "MN — YG taşıyıcı, AG nihayet: R = 0,81 × Tmax(AG). Rüzgâr YG'de tam açıklıktan, AG'de yarım açıklıktan gelir.";
  } else if (mus && hal === 'mn' && !yg) {
    Pwz = pwAl(tp, col, mus) / 2;
    notMN = 'Seçilen kolda YG iletkeni yok (yalnız AG); MN hali uygulanamaz. Cer zaten ' + fmt(AG_YG_IND, 2) + ' ile direk tepesine indirgenmiş AG cerıdır.';
  } else if (mus && hal === 'mn' && !agT) {
    Pwz = pwAl(tp, col, mus) / 2;
    notMN = 'Seçilen hatta AG iletkeni yok; MN hali uygulanamaz, tek yanlı YG cerine göre hesaplandı.';
  } else {
    Pwz = pwAl(tp, col, mus) / 2;
  }
  const RN = Td;
  const at = secATipKarma(RN, Pwz, mus);
  const kf = secKafes(RN, false, mus);
  const bt = (Tb !== null) ? secBeton(Tb, mus ? 'durdurucu' : '', mus) : null; // QUIRK — AG nihayette beton için görev tabanı yoktur (9,30/2'den başlar)
  const uyarilar = [];
  if (notMN) uyarilar.push(notMN);
  if (!at && kf) uyarilar.push('A-tipi yetersiz → kafes ' + kf.ad);
  if (!at && !kf) uyarilar.push('Yeterli direk bulunamadı.');
  if (Tb === null) uyarilar.push('Bu tertip için beton cer tablosu yok.');
  uyarilar.push('Nihayet direği, kuvvetli ekseni hat istikametinde olacak şekilde tesis edilir.');
  const adimlar = [
    'Son açıklık ' + fmt(a) + ' m → ' + (col ? '50' : '40') + ' m sütunu',
    (mn ? 'R = 0,81 × T_max(AG) = ' : 'R = T_max (tek yanlı) = ') + fmtT(Td) + ' kg (' + BOLGE_AD[b] + ' · ' + tAd(tp, mus) + ')',
    '4. Varsayım — zayıf eksende rüzgâr = ' + fmt(Pwz, 2) + ' kg',
  ];
  if (Tb !== null) adimlar.push('R(beton) = ' + fmtT(Tb) + ' kg');
  return {
    ok: true, girdi,
    sonuc: { bolgeAd: BOLGE_AD[b], tertipAd: tAd(tp, mus), Td, Tb, col, sutun: col ? 50 : 40, Pwz, RN, mn, Rk: Td, Rz: Pwz, ruz: false, at, kf, betonBoy: betonBoy(mus) },
    demir: demirA(at) || demirK(kf),
    beton: bt,
    manuel: manuelKontrol(man, Td, Pwz, (Tb !== null ? Tb : Td), false, false, mus),
    uyarilar, adimlar,
  };
}

/* ==================================================================
   6) GENEL VEKTÖREL (G) — branşman / tevzi / çok kollu
   p: {mus, bolge, kollar:[{tp, ac, md}], yontem:'oto'|'el', acikip:'mut'|'ara', taban,
       wind, wdir, wa, braA, eks:'auto'|'dik'|'bra'|'ana'|'acio'|'man', eksa, manuel}
   ================================================================== */
const norm360 = (a) => ((a % 360) + 360) % 360;
/** Kolların mutlak yönleri. 'ara' kipinde 1. kol taban yönündedir, sonrakiler bir öncekine göre birikir. */
export function mutlakAcilar(kollar, acikip, taban) {
  const ara = (acikip === undefined || acikip === null || acikip === 'ara');
  let ac = 0;
  return kollar.map((r, i) => {
    const v = +r.ac || 0;
    if (!ara) return v;
    ac = (i === 0) ? (+taban || 0) : ac + v; // QUIRK — 'ara' kipinde 1. kolun kendi açı değeri yok sayılır, yönü `taban`dan gelir
    return ac;
  });
}
/** Ana hat = doğrultusu birbirine en yakın karşıt olan kol çifti. */
function gAnaHatCift(kollar) {
  let en = null;
  for (let i = 0; i < kollar.length; i++) for (let j = i + 1; j < kollar.length; j++) {
    const d = Math.abs(((kollar[i].ac - kollar[j].ac) % 360 + 360) % 360 - 180);
    if (!en || d < en.d) en = { i, j, d };
  }
  return en;
}
/** Branşman / tevzi ayrımı. kollar: [{tp, ac (mutlak)}]. */
export function gSinifla(kollar, mus) {
  const n = kollar.length;
  if (n < 3) return { tip: 'hat', ad: 'DÜZ HAT', not: 'İki kol doğrusal hattır; Durdurucu (D) veya Köşede durdurucu (KD) sekmesini kullanın.' };
  if (n >= 4) {
    const c4 = gAnaHatCift(kollar);
    return { tip: 'tevzi', ad: 'TEVZİ DİREĞİ', anaAci: (c4 ? kollar[c4.i].ac : undefined),
      anaIx: (c4 ? [c4.i, c4.j] : []),
      not: n + ' kol ayrılıyor. Dört ve daha fazla kolda, cins ve kesitler ne olursa olsun direk tevzi direğidir.' };
  }
  const t = kollar.map((k) => k.tp);
  const ayniCift = (t[0] === t[1]) || (t[0] === t[2]) || (t[1] === t[2]);
  // aynı tertipli iki kol ancak doğrultuları karşıtsa (≥ 120°) hattın devamı sayılır
  let ayniAci = 0;
  if (ayniCift) {
    let a1, a2;
    if (t[0] === t[1]) { a1 = 0; a2 = 1; } else if (t[0] === t[2]) { a1 = 0; a2 = 2; } else { a1 = 1; a2 = 2; }
    ayniAci = 180 - Math.abs(((kollar[a1].ac - kollar[a2].ac) % 360 + 360) % 360 - 180);
  }
  if (ayniCift && ayniAci >= KD_ACI_ESIK) {
    let i1, i2, ib;
    if (t[0] === t[1]) { i1 = 0; i2 = 1; ib = 2; } else if (t[0] === t[2]) { i1 = 0; i2 = 2; ib = 1; } else { i1 = 1; i2 = 2; ib = 0; }
    return { tip: 'bransman', ad: 'BRANŞMAN DİREĞİ',
      not: 'Ana hattın iki kolu aynı cins-kesitte (' + tAd(t[i1], mus) + '), üçüncü kol branşman olarak ayrılıyor.',
      anaAci: kollar[i1].ac, anaAci2: kollar[i2].ac, braAci: kollar[ib].ac,
      braIx: ib, anaIx: [i1, i2] };
  }
  const c3 = gAnaHatCift(kollar);
  const ayn = ayniCift
    ? 'Aynı cins-kesitteki iki kol arasındaki açı ' + fmt(ayniAci) + '° olduğundan bunlar hattın devamı sayılmaz; o kol da direkte durdurularak ayrılıyor. '
    : 'Üç kolun da cins-kesiti farklı; tertip bakımından ana hat sürekliliği yok. ';
  return { tip: 'tevzi', ad: 'TEVZİ DİREĞİ', anaAci: (c3 ? kollar[c3.i].ac : undefined),
    anaIx: (c3 ? [c3.i, c3.j] : []),
    not: ayn + 'Direk tevzi direğidir; kollardan biri tevzi direğinde durdurularak ayrıldığından '
       + 'direk geometrik ana hat doğrultusunda (' + (c3 ? fmt(norm360(kollar[c3.i].ac)) + '°' : '—') + ') dikilir.' };
}
/** Ana hattın iki kolunun açıortayı — branşmanın bulunduğu yarı düzleme bakan yön. */
export function gAciortay(sinif) {
  const a = rad(sinif.anaAci), b2 = rad(sinif.anaAci2);
  let x = Math.cos(a) + Math.cos(b2), y = Math.sin(a) + Math.sin(b2);
  if (Math.hypot(x, y) < 1e-9) { x = -Math.sin(a); y = Math.cos(a); } // doğrusal ana hat → kollara dik
  let ac = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const d = Math.cos(rad(ac - sinif.braAci));
  if (d < 0) ac = (ac + 180) % 360;
  return ac;
}
/** Bileşkeyi direk eksenine ayırır: Rk kuvvetli, Rz zayıf eksen; demirde R = Rk + Rz (skaler). */
export function eksenAyir(Px, Py, eksA) {
  const c = Math.cos(rad(eksA)), sn = Math.sin(rad(eksA));
  const Rk = Math.abs(Px * c + Py * sn), Rz = Math.abs(-Px * sn + Py * c);
  return { Rk, Rz, R: Rk + Rz };
}
export function hesapG(p) {
  const mus = !!p.mus, b = +p.bolge, man = manuelDeger(p.manuel);
  const rows = Array.isArray(p.kollar) ? p.kollar : [];
  const yontem = (p.yontem === undefined || p.yontem === null) ? 'oto' : p.yontem;
  const acikip = (p.acikip === undefined || p.acikip === null) ? 'ara' : p.acikip;
  const ara = (acikip === 'ara');
  const eksMod = (p.eks === undefined || p.eks === null) ? 'auto' : p.eks;
  const wind = !!p.wind, wdir = (p.wdir === undefined || p.wdir === null) ? 90 : +p.wdir, wa = (p.wa === undefined || p.wa === null) ? 50 : +p.wa;
  const girdi = { mus, bolge: b, kollar: rows.map((r) => ({ tp: r.tp, ac: r.ac, md: r.md === undefined ? 'tam' : r.md })), yontem, acikip,
    taban: p.taban, wind, wdir, wa, braA: p.braA, eks: eksMod, eksa: p.eksa, manuel: man };
  if (rows.length < 2) return hataSonuc(girdi, 'En az iki kol girilmeli.');
  for (const r of rows) if (!tertipGecerli(r.tp, mus)) return gecersiz(girdi, r.tp);

  const mutAc = mutlakAcilar(rows, acikip, p.taban);
  const kollar = rows.map((r, i) => ({
    tp: r.tp, ac: mutAc[i], ara: +r.ac, md: (r.md === undefined || r.md === null) ? 'tam' : r.md,
    n: iletkenSay(r.tp, mus), Td: tmax(r.tp, b, 'demir', mus),
    Tb: betonVarMi(r.tp, mus) ? tmax(r.tp, b, 'beton', mus) : null,
    pw: [pwAl(r.tp, 0, mus), pwAl(r.tp, 1, mus)],
  }));

  const oto = (yontem === 'oto');
  const sinif = gSinifla(kollar, mus);

  // Ana hat dışında kalan (direkte durdurularak ayrılan) kollar
  const anaIx = sinif.anaIx || []; // QUIRK — elle yöntemde 2 kolda ana hat tanımsızdır: bütün kollar "ayrılan" sayılır, 12 m kuralı tetiklenebilir
  const ayrilan = kollar.map((k, i) => i).filter((i) => anaIx.indexOf(i) < 0);

  // Ayrılan kol da YG taşıyorsa ikinci YG traversi gerekir → beton direk 12 m, beton cerleri yeniden indirgenir
  const mbYG = mus && ayrilan.some((i) => !!musAyir(kollar[i].tp).yg);
  if (mbYG) {
    kollar.forEach((k, i) => {
      if (k.Tb === null) return;
      const a = musAyir(k.tp);
      if (!a.yg) { k.Tb = k.Tb * (KD_K_AG / AG_YG_IND); return; } // yalnız AG kolu: 0,81 → 0,714
      if (ayrilan.indexOf(i) >= 0) k.Tb = k.Tb * KD_K_YG_ALT; // QUIRK — ayrılan YG kolunun TÜM müşterek cerı (YG + 0,81·AG) 0,904 ile çarpılır; AG payı 0,714'e ayrıştırılmaz
    });
  }
  if (oto && sinif.tip === 'hat') return hataSonuc(girdi, sinif.not);

  // rüzgâr (4. Varsayım)
  const col = pwSutun(wa);
  let SPw = 0;
  if (wind) kollar.forEach((k) => { SPw += Math.abs(Math.sin(rad(k.ac - wdir))) * k.pw[col] / 2; });

  // incelenecek yükleme durumları
  const durumlar = [];
  if (!oto) {
    durumlar.push({ ad: 'Elle girilen kuvvet durumu', z: -2 });
  } else {
    durumlar.push({ ad: 'Tüm kollarda %100 cer', z: -1 });
    if (sinif.tip === 'tevzi') {
      kollar.forEach((k, i) => durumlar.push({ ad: 'Kol ' + (i + 1) + ' (' + tAd(k.tp, mus) + ') zayıflatılmış → kalan %' + fmt(kalanOran(k.n) * 100), z: i }));
    }
  }
  const carpan = (i, z) => {
    if (z === -2) { const m = kollar[i].md; return (m === 'tas') ? 0 : ((m === 'zay') ? kalanOran(kollar[i].n) : 1); }
    return (i === z) ? kalanOran(kollar[i].n) : 1;
  };
  const coz = (z) => {
    let Px = 0, Py = 0, Pxb = 0, Pyb = 0, betonOK = true; const kuv = [];
    kollar.forEach((k, i) => {
      const c = carpan(i, z), fd = k.Td * c;
      Px += fd * Math.cos(rad(k.ac)); Py += fd * Math.sin(rad(k.ac));
      if (k.Tb === null) betonOK = false; else { const fb = k.Tb * c; Pxb += fb * Math.cos(rad(k.ac)); Pyb += fb * Math.sin(rad(k.ac)); }
      kuv.push({ tp: k.tp, ac: k.ac, fd });
    });
    if (wind) {
      Px += SPw * Math.cos(rad(wdir)); Py += SPw * Math.sin(rad(wdir));
      Pxb += SPw * Math.cos(rad(wdir)); Pyb += SPw * Math.sin(rad(wdir));
    }
    return { Px, Py, R: Math.hypot(Px, Py), Rb: betonOK ? Math.hypot(Pxb, Pyb) : null, kuv };
  };
  const coz2 = durumlar.map((d) => ({ d, s: coz(d.z) }));
  // Ön seçim vektörel büyüklüğe göre — eksen bileşke yönüne bağlı olduğunda gerekli
  let en = coz2[0];
  coz2.forEach((x) => { if (x.s.R > en.s.R) en = x; });
  let S = en.s;
  let yon = (Math.atan2(S.Py, S.Px) * 180 / Math.PI + 360) % 360;
  let eksA = yon, eksNot = 'bileşke yönünde';
  if (eksMod === 'auto') {
    if (sinif.tip === 'bransman') { eksA = gAciortay(sinif); eksNot = 'ana hat açıortayı — otomatik'; }
    else if (sinif.tip === 'tevzi' && sinif.anaAci !== undefined) { eksA = sinif.anaAci; eksNot = 'ana hat doğrultusu — otomatik'; }
  }
  if (eksMod === 'man') { eksA = +p.eksa; eksNot = 'elle girildi'; }
  else if (eksMod !== 'auto') {
    if (sinif.tip === 'bransman') {
      if (eksMod === 'dik') { eksA = sinif.anaAci + 90; eksNot = 'ana hatta dik'; }
      else if (eksMod === 'bra') { eksA = sinif.braAci; eksNot = 'branşman istikametinde'; }
      else if (eksMod === 'acio') { eksA = gAciortay(sinif); eksNot = 'ana hat açıortayı'; }
      else { eksA = sinif.anaAci; eksNot = 'ana hat üzerinde'; }
    } else if (sinif.tip === 'tevzi' && sinif.anaAci !== undefined && (eksMod === 'ana' || eksMod === 'dik')) {
      eksA = (eksMod === 'dik') ? sinif.anaAci + 90 : sinif.anaAci;
      eksNot = (eksMod === 'dik') ? 'ana hatta dik' : 'ana hat doğrultusu';
    } else {
      eksNot = 'bu yerleşim bu direk düzeninde geçerli değil — bileşke yönü alındı';
    }
  }
  eksA = ((eksA % 360) + 360) % 360;
  // Belirleyici yükleme durumu demir ölçütüyle (Rk + Rz, skaler) yeniden bulunur
  coz2.forEach((x) => { x.sk = eksenAyir(x.s.Px, x.s.Py, eksA).R; });
  en = coz2[0]; coz2.forEach((x) => { if (x.sk > en.sk) en = x; });
  S = en.s;
  yon = (Math.atan2(S.Py, S.Px) * 180 / Math.PI + 360) % 360;
  const E = eksenAyir(S.Px, S.Py, eksA);
  const Rk = E.Rk, Rz = E.Rz, Rdemir = E.R;

  const at = secATip(Rk, Rz, false, mus), kf = secKafes(Rdemir, false, mus);
  const bt = (S.Rb !== null) ? secBeton(S.Rb, 'bransman', mus, mbYG) : null; // QUIRK — beton R, betonun kendi en büyüğünden değil DEMİR ölçütüne göre belirleyici olan durumdan alınır

  const tevzi = (sinif.tip === 'tevzi'); // tevzide demir direk kafes olmak zorundadır
  const demir = tevzi ? demirK(kf) : (demirA(at) || demirK(kf));

  const uyarilar = [];
  uyarilar.push(sinif.ad + ' — ' + sinif.not);
  if (mbYG) uyarilar.push('Ana hattan ayrılan kol da YG taşıyor: ana hat YG traversinin 1 m altına ikinci bir YG traversi gerekeceğinden beton direk 12 m seçilmek zorundadır. '
    + 'Cerler tepeye indirgenir — ayrılan YG kolu k = ' + fmt(KD_K_YG_ALT, 3) + ' · AG kolları k = ' + fmt(KD_K_AG, 3) + ' (11 m direğin 0,81 indirgemesi yerine) · '
    + 'ana hat YG traversi tepede olduğundan değişmez. Demir direkte istikametler aynı traverste toplandığından indirgeme uygulanmaz.');
  if (mus && !mbYG && ayrilan.some((i) => yalnizAG(kollar[i].tp))) uyarilar.push('Ayrılan kolda yalnız AG var; cer AG traversi seviyesinde etkidiğinden '
    + fmt(AG_YG_IND, 2) + ' ile direk tepesine indirgenmiştir.');
  if (tevzi) {
    uyarilar.push(kf ? ('Tevzi direğinde bileşke ne çıkarsa çıksın demir direk kafes olmak zorundadır; en küçüğü K1\'dir.'
      + (at ? ' (Bileşkenin A-tipi karşılığı ' + at.ad + ' olurdu, seçilmez.)' : '')) : 'Yeterli kafes direk bulunamadı.');
  } else if (at) {
    uyarilar.push('Branşman direklerinin ilerdeki kesit artışlarına cevap verebilmesi için kafes direk (' + (kf ? kf.ad : '—') + ') seçilmesi tavsiye edilir.');
  } else {
    uyarilar.push(kf ? ('A-tipi yetersiz → kafes ' + kf.ad + ' (' + kf.kap + ' kg)') : 'Yeterli direk bulunamadı.');
  }
  if (S.Rb === null) uyarilar.push('Bu tertiplerin beton cer tablosu yok.');
  if (bt && bt.taban) uyarilar.push(mus ? ('Müşterek branşman/tevzi beton direkte ' + betonBoy(mus, mbYG) + "/6'dan küçük seçilmez.")
    : "Branşman/tevzi beton direkte 800 kg'ın altına inilmez.");

  // Branşman istikametindeki ilk direğin açıklık denetimi: ≤ 40 m normal · 40–50 m özel önlem · > 50 m izin verilmez
  let braKontrol = null;
  if (sinif.tip === 'bransman') {
    const ba = +p.braA || 0;
    if (ba > 0) {
      const bet = mus ? "beton direk 10 m'lik seçilmelidir" : 'beton direkte bir üst boy seçilmelidir';
      if (ba <= 40) braKontrol = { a: ba, durum: 'ok', mesaj: 'Branşman kolunda ilk direk ' + fmt(ba) + ' m ötede — 40 m sınırı içinde, h = 5,5 m emniyet mesafesi normal direk boyuyla kurtarılır.' };
      else if (ba <= 50) braKontrol = { a: ba, durum: 'uyari', mesaj: 'Branşman kolunda ilk direk ' + fmt(ba) + ' m ötede (40 m sınırı aşıldı). h = 5,5 m emniyet mesafesini kurtarmak için bu ilk direk, '
        + 'AG iletkenleri direk tepesinde olan müşterek direk olmalıdır; ' + bet + '.' };
      else braKontrol = { a: ba, durum: 'hata', mesaj: 'Branşman kolunda ilk direk ' + fmt(ba) + " m ötede. EKAT bu istikamette 50 m'yi aşan açıklığa izin vermez — ara direk konulmalı ya da "
        + 'branşman noktası kaydırılmalıdır.' };
      uyarilar.push(braKontrol.mesaj);
    }
  }
  uyarilar.push('Demir direkte kuvvetli eksen, en büyük bileşeni karşılayacak istikamette dikilmelidir.');

  let ad = '';
  kollar.forEach((k, i) => {
    const c = carpan(i, en.d.z);
    ad += 'Kol ' + (i + 1) + ': ' + tAd(k.tp, mus) + ' @ ' + fmt(norm360(k.ac)) + '°'
      + ((ara && i > 0) ? ' (bir öncekiyle ' + fmt(k.ara) + '°)' : '') + ' · ' + (c === 1 ? '%100' : '%' + fmt(c * 100)) + ' → ' + fmtT(k.Td * c) + ' kg\n';
  });
  const adim = ad
    + 'ΣPx = ' + fmt(S.Px, 2) + ' kg   ΣPy = ' + fmt(S.Py, 2) + ' kg\n'
    + 'Demir: Rk = ' + fmt(Rk, 2) + ' , Rz = ' + fmt(Rz, 2) + ' → R = Rk+Rz = ' + fmt(Rdemir, 2) + ' kg  (skaler — direk tipi bundan seçilir)\n'
    + (S.Rb !== null ? ('Beton: R = √(ΣPx²+ΣPy²) = ' + fmt(S.Rb, 2) + ' kg  (vektörel)\n') : '')
    + 'Demir cerleriyle vektörel büyüklük ' + fmt(S.R, 2) + ' kg olurdu; kafes/A-tipi seçiminde kullanılmaz.';

  const belIx = coz2.indexOf(en);
  return {
    ok: true, girdi,
    sonuc: {
      bolgeAd: BOLGE_AD[b],
      kollar: kollar.map((k, i) => { const c = carpan(i, en.d.z); return { tp: k.tp, ad: tAd(k.tp, mus), ac: k.ac, acNorm: norm360(k.ac), md: k.md, n: k.n, Td: k.Td, Tb: k.Tb, pw: k.pw, carpan: c, F: k.Td * c, ayrilan: ayrilan.indexOf(i) >= 0 }; }),
      sinif, tevzi, oto, mbYG, wind, wdir, col, SPw,
      varsayim: oto ? (tevzi ? '2. Varsayım — Çizelge:12 zayıflatması (en büyük bileşke)' : '1. Varsayım — kolların en büyük çekme kuvvetleri') : null,
      // haller: R = demir cerleriyle VEKTÖREL büyüklük, sk = demir ölçütü (Rk + Rz, skaler), Rb = beton (vektörel)
      haller: coz2.map((x, i) => ({ ad: x.d.ad, z: x.d.z, Px: x.s.Px, Py: x.s.Py, R: x.s.R, sk: x.sk, Rb: x.s.Rb, belirleyici: i === belIx })),
      belirleyici: { ix: belIx, ad: en.d.ad, z: en.d.z },
      Px: S.Px, Py: S.Py, Rvek: S.R, yon, eksA, eksNot, Rk, Rz, Rdemir, Rbeton: S.Rb, ruz: false,
      braKontrol, at, kf, betonBoy: betonBoy(mus, mbYG),
    },
    demir,
    beton: bt,
    kafesZorunlu: tevzi,
    manuel: manuelKontrol(man, Rk, Rz, (S.Rb !== null ? S.Rb : Rdemir), false, mbYG, mus),
    uyarilar, adimlar: satirlar(adim),
  };
}

/* ==================================================================
   GÖREV ÖNERİSİ — kol düzenine uyan hesap türü (özgün araçta yoktur)
   kollar: [{ac (mutlak açı, °, 0 = doğu, saat yönünün tersi), tp}] → {gorev, alfa}
   ================================================================== */
export function gorevOner(kollar) {
  const k = Array.isArray(kollar) ? kollar : [];
  if (k.length === 0) return { gorev: null, alfa: null };
  if (k.length === 1) return { gorev: 'N', alfa: null };
  if (k.length >= 3) return { gorev: 'G', alfa: null };
  const alfa = 180 - Math.abs((((+k[0].ac) - (+k[1].ac)) % 360 + 360) % 360 - 180); // iki kol arasındaki iç açı (180° = doğrusal)
  const duz = (180 - alfa) < 2, ayni = (k[0].tp === k[1].tp);
  return { gorev: ayni ? (duz ? 'T' : 'KT') : (duz ? 'D' : 'KD'), alfa };
}
