/*
 * Şebeke-M — telefonun hesap çekirdeği.
 *
 * AutoCAD eklentisindeki C# çekirdeğinin (autocad/src/Cekirdek) karşılığıdır; kurallar aynıdır:
 *  - proje dosyası (.sebeke.json) okuma / yazma (ortak/VERI-MODELI.md)
 *  - bölge seçimi, hat metrajı ve etiketi, kanal kodu ve hacmi, GIS numarası
 *  - Durum Tespit raporu ve özeti (AutoCAD raporuyla aynı satırlar)
 *  - TM projeksiyonu (ITRF96 / GRS80, 3° dilim)
 *  - değişiklik günlüğü (telefonda kayıt: "koy / sil" işlemleri)
 *
 * Tarayıcıda window.SH, Node'da require() ile kullanılır (testler: android/araclar/cekirdek-test.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SH = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BICIM = 'sebeke-hakedis.proje';
  const SURUM = 1;

  // ---------------------------------------------------------------- Sabitler

  const DURUMLAR = ['M', 'M+M', 'DM', 'DM+M', 'MEVCUT'];
  const DURUM_ADI = {
    M: 'Montaj', 'M+M': 'Malzeme + Montaj', DM: 'Demontaj', 'DM+M': 'Sök-Tak', MEVCUT: 'Mevcut', KM: 'KM', ME: 'ME'
  };

  /** Eleman türleri. katman: AutoCAD katman adındaki tür; gis: GIS numarası biçimi. */
  const ELEMAN_TURLERI = [
    { kod: 'AG_DIREK', ad: 'AG Direk', kisa: 'AG', katman: 'AGDIR', sekil: 'daire', gis: 'direk' },
    { kod: 'MUSTEREK_DIREK', ad: 'Müşterek Direk', kisa: 'Müşterek', katman: 'MUSDIR', sekil: 'daire', gis: 'direk' },
    { kod: 'AYD_DIREK', ad: 'Aydınlatma Direği', kisa: 'Aydınlatma', katman: 'AYDDIR', sekil: 'daire', gis: 'direk' },
    { kod: 'ENH_DIREK', ad: 'ENH Direği', kisa: 'ENH', katman: 'ENHDIR', sekil: 'daire', gis: 'direk' },
    { kod: 'TRAFO_DIREGI', ad: 'Trafo Direği', kisa: 'Trafo Dir.', katman: 'TRAFO', sekil: 'ucgen', gis: 'TR' },
    { kod: 'TRAFO_MERKEZI', ad: 'Trafo Merkezi', kisa: 'Köşk', katman: 'TRAFO', sekil: 'kare', gis: 'TR' },
    { kod: 'PANO', ad: 'Pano', kisa: 'Pano', katman: 'PANO', sekil: 'kare', gis: 'P' },
    { kod: 'BOX', ad: 'Box', kisa: 'Box', katman: 'BOX', sekil: 'kare', gis: 'B' },
    { kod: 'EK_MUFU', ad: 'Ek Mufu', kisa: 'Ek Mufu', katman: 'STANDART', sekil: 'elmas', gis: 'mufu' },
    { kod: 'KOFRE', ad: 'Kofre', kisa: 'Kofre', katman: 'STANDART', sekil: 'elmas', gis: '' },
    { kod: 'DIGER', ad: 'Diğer', kisa: 'Diğer', katman: 'STANDART', sekil: 'elmas', gis: '' }
  ];

  const HAT_TURLERI = [
    { kod: 'AG_HAVAI', ad: 'AG Havai', katman: 'AG_HAV_HAT' },
    { kod: 'AG_YERALTI', ad: 'AG Yeraltı', katman: 'AG_YER_HAT' },
    { kod: 'AYDINLATMA', ad: 'Aydınlatma', katman: 'AYD_HAT' },
    { kod: 'OG_HAVAI', ad: 'OG Havai', katman: 'OG_HAV_HAT' },
    { kod: 'OG_YERALTI', ad: 'OG Yeraltı', katman: 'OG_YER_XLPE' },
    { kod: 'REKORTMAN', ad: 'Rekortman', katman: 'REKORTMAN' },
    { kod: 'MUSTEREK', ad: 'Müşterek', katman: 'MUSTEREK_HAT' }
  ];

  const ZEMINLER = ['TOPRAK', 'TOPRAK (BARİYERLİ)', 'TUVENAN', 'TUVENAN (BARİYERLİ)', 'PARKE TOPRAK', 'PARKE TUVENAN',
    'PARKE TUVENAN (BARİYERLİ)', 'BRANŞMAN KANAL'];

  const KANAL = { REK: 1, AYD: 2, AG: 4, OG: 8 };

  /** Türkiye'de kullanılan 3° TM dilim orta meridyenleri. */
  const DOMLAR = [27, 30, 33, 36, 39, 42, 45];

  const KOLEKSIYONLAR = ['bolgeler', 'noktalar', 'elemanlar', 'hatlar', 'kanallar', 'sondajlar'];

  function elemanTuru(kod) { return ELEMAN_TURLERI.find(t => t.kod === kod) || ELEMAN_TURLERI[ELEMAN_TURLERI.length - 1]; }
  function hatTuru(kod) { return HAT_TURLERI.find(t => t.kod === kod) || { kod, ad: kod || 'Hat', katman: '' }; }

  /**
   * Cins kodlarındaki yazım hataları (31.10.2026): eski kod → yeni kod. Okurken çevrilir, yazarken hep yeni kod
   * yazılır. Eklentideki CinsKodu ile aynı tablo (ortak/katalog/kalemler.json › eskiCinsler).
   */
  const ESKI_CINSLER = {
    AG_ALİMİNYUM_KABLO: 'AG_ALÜMİNYUM_KABLO', OG_ALİMİNYUM_KABLO: 'OG_ALÜMİNYUM_KABLO', REKORTMAN_ALİMİNYUM: 'REKORTMAN_ALÜMİNYUM',
    ALİMİNYUM_BAĞ_TELİ: 'ALÜMİNYUM_BAĞ_TELİ', TECHİZAT_MONTAJ_DEMİRİ: 'TEÇHİZAT_MONTAJ_DEMİRİ', KOFRA: 'KOFRE'
  };
  function cinsDuzelt(cins) { return cins && Object.prototype.hasOwnProperty.call(ESKI_CINSLER, cins) ? ESKI_CINSLER[cins] : cins; }

  /**
   * Katalogda adı olmayan cinsin okunur adı (kullanıcı kuralı, 8.11.2026; eklentideki CinsKodu.OkunurAd ile aynı): alt
   * çizgiler boşluk, her sözcüğün ilk harfi büyük, gerisi Türkçe kuralıyla küçük (İ → i, I → ı); kısaltmalar (AG, OG, ENH…)
   * büyük, "ve" küçük kalır. Ör. YENİ_BİR_CİNS → "Yeni Bir Cins", AG_PANO_HT → "AG Pano HT".
   */
  const CINS_KISALTMALARI = new Set(['AG', 'OG', 'ENH', 'BAHH', 'ALPEK', 'SDK', 'XLPE', 'NYY', 'NAYY', 'GLV', 'CVT', 'PLG', 'HT', 'DT', 'CU', 'ALM', 'TR']);
  const CINS_KUCUK_SOZCUKLER = new Set(['ve', 'ile', 'veya']);
  function cinsOkunurAd(cins) {
    if (!cins) return '';
    return String(cins).replace(/_/g, ' ').split(/\s+/).filter(Boolean).map((w) => {
      if (CINS_KISALTMALARI.has(w)) return w;
      const k = w.toLocaleLowerCase('tr-TR');
      if (CINS_KUCUK_SOZCUKLER.has(k)) return k;
      return k.slice(0, 1).toLocaleUpperCase('tr-TR') + k.slice(1);
    }).join(' ');
  }

  /**
   * Katman adı Türkçe karaktersiz (31.10.2026): ç ğ ı İ ö ş ü → c g i I o s u (AGDİR → AGDIR, MÜŞTEREK_HAT →
   * MUSTEREK_HAT). Eklentideki KatmanAdlari.Ascii ile aynı.
   */
  const TR_ASCII = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U', â: 'a', Â: 'A', î: 'i', Î: 'I', û: 'u', Û: 'U' };
  function katmanAscii(ad) { return String(ad == null ? '' : ad).replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, (c) => TR_ASCII[c]); }

  /** Malzeme cinsinden eleman türü (NesneOkuyucu.ElemanTuru ile aynı). */
  function cinstenElemanTuru(cins) {
    const c = cins || '';
    const b = p => c.startsWith(p);
    if (b('AG_DEMİR') || b('AG_BETON') || b('AG_AĞAÇ')) return 'AG_DIREK';
    if (b('MÜŞ_')) return 'MUSTEREK_DIREK';
    if (b('AYD_')) return 'AYD_DIREK';
    if (b('ENH_')) return 'ENH_DIREK';
    if (b('TR_DİREK')) return 'TRAFO_DIREGI';
    if (b('BETON_KÖŞK') || b('TRAFO_BİNASI')) return 'TRAFO_MERKEZI';
    if (b('AG_PANO')) return 'PANO';
    if (b('BOX_PANO')) return 'BOX';
    if (b('EK_MUFU')) return 'EK_MUFU';
    if (b('KOFRE') || b('KOFRA')) return 'KOFRE';
    return 'DIGER';
  }

  /** Hat kaleminin cinsinden hat türü (katman bilinmiyorsa). */
  function cinstenHatTuru(cins) {
    const c = cins || '';
    const b = p => c.startsWith(p);
    if (b('ALPEK') || b('AG_İLETKEN')) return 'AG_HAVAI';
    if (b('AG_ALÜMİNYUM_KABLO') || b('AG_ALİMİNYUM_KABLO') || b('AG_BAKIR_KABLO')) return 'AG_YERALTI';
    if (b('AYDINLATMA')) return 'AYDINLATMA';
    if (b('OG_İLETKEN')) return 'OG_HAVAI';
    if (b('OG_ALÜMİNYUM_KABLO') || b('OG_ALİMİNYUM_KABLO') || b('OG_BAKIR_KABLO')) return 'OG_YERALTI';
    if (b('REKORTMAN')) return 'REKORTMAN';
    return 'DIGER';
  }

  // ---------------------------------------------------------------- Sayılar

  /** C# Math.Round(d, n, AwayFromZero) karşılığı: kayan nokta kırıntılarını temizler. */
  function temiz(d, basamak) {
    const n = basamak === undefined ? 6 : basamak;
    if (!Number.isFinite(d)) return d;
    const f = Math.pow(10, n);
    const r = Math.round(Math.abs(d) * f) / f;
    return d < 0 ? -r : r;
  }

  /** "16,8", ",5", "1.234,5", "10.5" biçimlerini çözer; sayı değilse NaN. */
  function sayi(text) {
    if (typeof text === 'number') return text;
    let s = String(text === undefined || text === null ? '' : text).trim();
    if (!s) return NaN;
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    if (s.startsWith('.')) s = '0' + s;
    if (s.startsWith('-.')) s = '-0' + s.slice(1);
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  }

  /** Türkçe sayı yazımı: binlik nokta, ondalık virgül ("1.540.966,1"). */
  function tr(v, ondalik) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    const d = ondalik === undefined ? 2 : ondalik;
    const neg = v < 0;
    const s = Math.abs(v).toFixed(d);
    let [tam, kes] = s.split('.');
    tam = tam.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (kes) kes = kes.replace(/0+$/, '');
    return (neg ? '-' : '') + tam + (kes ? ',' + kes : '');
  }

  /** C# string.CompareOrdinal karşılığı (UTF-16 kod birimi sırası). */
  function ordinal(a, b) {
    a = a === undefined || a === null ? '' : String(a);
    b = b === undefined || b === null ? '' : String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function tamSayiMi(s) { return /^[+-]?\d+$/.test(String(s === undefined || s === null ? '' : s).trim()); }

  /** INDEX sırası: ikisi de sayıysa sayıca, sayı olan önce, yoksa metin sırası. */
  function siraKarsilastir(a, b) {
    const ax = tamSayiMi(a);
    const by = tamSayiMi(b);
    if (ax && by) {
      const x = Number(a);
      const y = Number(b);
      return x < y ? -1 : x > y ? 1 : 0;
    }
    if (ax) return -1;
    if (by) return 1;
    return ordinal(a, b);
  }

  // ---------------------------------------------------------------- Projeksiyon (TM, GRS80)

  const A = 6378137.0;
  const F = 1.0 / 298.257222101;
  const E2 = F * (2.0 - F);
  const EP2 = E2 / (1.0 - E2);
  const FALSE_EASTING = 500000.0;
  const M_FACTOR = 1.0 - E2 / 4.0 - 3.0 * E2 * E2 / 64.0 - 5.0 * E2 * E2 * E2 / 256.0;
  const RAD = Math.PI / 180;

  /** Enlem/boylamdan (derece) TM düzlem koordinatı: [sağa, yukarı]. k0 = 1 (3° dilim). */
  function tmIleri(lat, lon, dom, k0) {
    const k = k0 || 1.0;
    const phi = lat * RAD;
    const dLambda = (lon - dom) * RAD;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const tanPhi = Math.tan(phi);
    const n = A / Math.sqrt(1.0 - E2 * sinPhi * sinPhi);
    const t = tanPhi * tanPhi;
    const c = EP2 * cosPhi * cosPhi;
    const a = dLambda * cosPhi;
    const e4 = E2 * E2;
    const e6 = e4 * E2;
    const m = A * (M_FACTOR * phi -
      (3.0 * E2 / 8.0 + 3.0 * e4 / 32.0 + 45.0 * e6 / 1024.0) * Math.sin(2.0 * phi) +
      (15.0 * e4 / 256.0 + 45.0 * e6 / 1024.0) * Math.sin(4.0 * phi) -
      (35.0 * e6 / 3072.0) * Math.sin(6.0 * phi));
    const x = k * n * (a + (1.0 - t + c) * Math.pow(a, 3) / 6.0 +
      (5.0 - 18.0 * t + t * t + 72.0 * c - 58.0 * EP2) * Math.pow(a, 5) / 120.0);
    const y = k * (m + n * tanPhi * (a * a / 2.0 +
      (5.0 - t + 9.0 * c + 4.0 * c * c) * Math.pow(a, 4) / 24.0 +
      (61.0 - 58.0 * t + t * t + 600.0 * c - 330.0 * EP2) * Math.pow(a, 6) / 720.0));
    return [x + FALSE_EASTING, y];
  }

  /** TM düzlem koordinatından enlem/boylam (derece): [enlem, boylam]. */
  function tmGeri(saga, yukari, dom, k0) {
    const k = k0 || 1.0;
    const x = saga - FALSE_EASTING;
    const mu = yukari / k / (A * M_FACTOR);
    const e1 = (1.0 - Math.sqrt(1.0 - E2)) / (1.0 + Math.sqrt(1.0 - E2));
    const phi1 = mu + (3.0 * e1 / 2.0 - 27.0 * Math.pow(e1, 3) / 32.0) * Math.sin(2.0 * mu) +
      (21.0 * e1 * e1 / 16.0 - 55.0 * Math.pow(e1, 4) / 32.0) * Math.sin(4.0 * mu) +
      (151.0 * Math.pow(e1, 3) / 96.0) * Math.sin(6.0 * mu) +
      (1097.0 * Math.pow(e1, 4) / 512.0) * Math.sin(8.0 * mu);
    const sinPhi1 = Math.sin(phi1);
    const cosPhi1 = Math.cos(phi1);
    const tanPhi1 = Math.tan(phi1);
    const c1 = EP2 * cosPhi1 * cosPhi1;
    const t1 = tanPhi1 * tanPhi1;
    const w = 1.0 - E2 * sinPhi1 * sinPhi1;
    const n1 = A / Math.sqrt(w);
    const r1 = A * (1.0 - E2) / Math.pow(w, 1.5);
    const d = x / (n1 * k);
    const phi = phi1 - (n1 * tanPhi1 / r1) * (d * d / 2.0 -
      (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * c1 * c1 - 9.0 * EP2) * Math.pow(d, 4) / 24.0 +
      (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * t1 * t1 - 252.0 * EP2 - 3.0 * c1 * c1) * Math.pow(d, 6) / 720.0);
    const lambda = (d - (1.0 + 2.0 * t1 + c1) * Math.pow(d, 3) / 6.0 +
      (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * c1 * c1 + 8.0 * EP2 + 24.0 * t1 * t1) * Math.pow(d, 5) / 120.0) / cosPhi1;
    return [phi / RAD, dom + lambda / RAD];
  }

  /** Boylama göre en yakın 3° dilim. */
  function domBoylamdan(lon) { return Math.round(lon / 3) * 3; }

  /**
   * Proje koordinatları ile bir konumdan (enlem, boylam) dilimi tahmin eder: konumu her dilimde
   * düzleme çevirip projenin kapsadığı alana [esik] metreden yakın düşeni seçer. Bulamazsa null.
   */
  function domTahmin(lat, lon, kutu, esik) {
    if (!kutu) return null;
    const limit = esik || 30000;
    let best = null;
    for (const dom of DOMLAR) {
      if (Math.abs(lon - dom) > 4.5) continue;
      const [e, n] = tmIleri(lat, lon, dom);
      const dx = Math.max(kutu[0] - e, 0, e - kutu[2]);
      const dy = Math.max(kutu[1] - n, 0, n - kutu[3]);
      const d = Math.hypot(dx, dy);
      if (d <= limit && (!best || d < best.d)) best = { dom, d };
    }
    return best ? best.dom : null;
  }

  // ---------------------------------------------------------------- Geometri

  function mesafe(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

  function uzunluk(kose) {
    let t = 0;
    for (let i = 1; i < (kose || []).length; i++) t += mesafe(kose[i - 1], kose[i]);
    return t;
  }

  /** Çizginin uzunluğunun yarısındaki nokta. */
  function ortaNokta(kose) {
    if (!kose || !kose.length) return null;
    if (kose.length === 1) return kose[0];
    const yarim = uzunluk(kose) / 2;
    let t = 0;
    for (let i = 1; i < kose.length; i++) {
      const d = mesafe(kose[i - 1], kose[i]);
      if (t + d >= yarim && d > 0) {
        const o = (yarim - t) / d;
        return [kose[i - 1][0] + (kose[i][0] - kose[i - 1][0]) * o, kose[i - 1][1] + (kose[i][1] - kose[i - 1][1]) * o];
      }
      t += d;
    }
    return kose[kose.length - 1];
  }

  function icinde(p, cokgen) {
    let ic = false;
    const n = cokgen.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = cokgen[i][0], yi = cokgen[i][1], xj = cokgen[j][0], yj = cokgen[j][1];
      if ((yi > p[1]) !== (yj > p[1])) {
        const xk = xj + (p[1] - yj) * (xi - xj) / (yi - yj);
        if (p[0] < xk) ic = !ic;
      }
    }
    return ic;
  }

  function alan(cokgen) {
    let s = 0;
    const n = cokgen.length;
    for (let i = 0, j = n - 1; i < n; j = i++) s += cokgen[j][0] * cokgen[i][1] - cokgen[i][0] * cokgen[j][1];
    return Math.abs(s) / 2;
  }

  function dogruParcasinaMesafe(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return mesafe(p, a);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function cokgeneMesafe(p, cokgen) {
    let en = Infinity;
    const n = cokgen.length;
    for (let i = 0, j = n - 1; i < n; j = i++) en = Math.min(en, dogruParcasinaMesafe(p, cokgen[j], cokgen[i]));
    return en;
  }

  /** Noktanın bölgesi: içinde kaldığı en küçük bölge; hiçbirinde değilse en yakını (C# Geometri.BolgeSec). */
  function bolgeSec(p, bolgeler, alanlar) {
    if (!p || !bolgeler || !bolgeler.length) return null;
    let secilen = null;
    let secilenAlan = Infinity;
    for (const b of bolgeler) {
      const s = b.sinir || [];
      if (s.length < 3) continue;
      const ar = alanlar ? alanlar.get(b.id) : alan(s);
      if (icinde(p, s) && (secilen === null || ar < secilenAlan)) {
        secilen = b;
        secilenAlan = ar;
      }
    }
    if (secilen) return secilen;
    let en = Infinity;
    for (const b of bolgeler) {
      const s = b.sinir || [];
      if (s.length < 2) continue;
      const d = cokgeneMesafe(p, s);
      if (d < en) {
        en = d;
        secilen = b;
      }
    }
    return secilen;
  }

  function kutu(noktalar) {
    let e0 = Infinity, n0 = Infinity, e1 = -Infinity, n1 = -Infinity;
    for (const p of noktalar) {
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      if (p[0] < e0) e0 = p[0];
      if (p[0] > e1) e1 = p[0];
      if (p[1] < n0) n0 = p[1];
      if (p[1] > n1) n1 = p[1];
    }
    return Number.isFinite(e0) ? [e0, n0, e1, n1] : null;
  }

  /** Projedeki her şeyin kapsadığı alan [e0, n0, e1, n1]; boş projede null. */
  function projeKutusu(p) {
    const pts = [];
    for (const e of p.elemanlar) pts.push([e.saga, e.yukari]);
    for (const n of p.noktalar) pts.push([n.saga, n.yukari]);
    for (const k of ['hatlar', 'kanallar', 'sondajlar', 'bolgeler']) {
      for (const o of p[k]) {
        const kk = k === 'bolgeler' ? o.sinir : o.kose;
        if (kk && kk.length) { pts.push(kk[0]); pts.push(kk[kk.length - 1]); }
      }
    }
    return kutu(pts);
  }

  // ---------------------------------------------------------------- Katsayılar

  /** katsayilar.json (C# Katsayilar.JsonYap biçimi) → hesapta kullanılan tablolar. */
  function katsayiHazirla(j) {
    const k = {
      tarifeOG: '0104', tarifeAG: '0105', tarifeAYD: '0108', tarifeREK: '0110',
      kanalPaylasim: {}, agAdlar: [], agAgirlik: [], agAcilim: {}, ogAdlar: [], ogAgirlik: [], ogAcilim: {}
    };
    if (!j) return k;
    const t = j.hatTarifeleri || {};
    if (t.OG) k.tarifeOG = t.OG;
    if (t.AG) k.tarifeAG = t.AG;
    if (t.AYD) k.tarifeAYD = t.AYD;
    if (t.REK) k.tarifeREK = t.REK;
    for (const [key, v] of Object.entries(j.kanalPaylasim || {})) k.kanalPaylasim[key] = [v.OG || 0, v.AG || 0, v.AYD || 0, v.REK || 0];
    const iletken = (src, adlar, agirlik, acilim) => {
      if (!src) return;
      for (const [ad, kg] of Object.entries(src.agirlikKgM || {})) {
        adlar.push(ad);
        agirlik.push(kg);
      }
      for (const [kesit, teller] of Object.entries(src.acilim || {})) acilim[kesit] = adlar.map(ad => teller[ad] || 0);
    };
    iletken(j.agIletken, k.agAdlar, k.agAgirlik, k.agAcilim);
    iletken(j.ogIletken, k.ogAdlar, k.ogAgirlik, k.ogAcilim);
    return k;
  }

  /** Kanal kaleminin tarifesinden OG ve AG paylarının tarifesi (Katsayilar.KanalUnsurlari). */
  function kanalUnsurlari(tarife) {
    const kar = tarife && tarife.length >= 2 ? tarife.slice(0, 2) : '01';
    const uns = tarife && tarife.length >= 4 ? tarife.slice(2, 4) : '04';
    let uo = uns, ua = uns;
    if (uns === '04' || uns === '05') { uo = '04'; ua = '05'; }
    else if (uns === '06' || uns === '07') { uo = '06'; ua = '07'; }
    else if (uns === '11' || uns === '12') { uo = '11'; ua = '12'; }
    return [kar + uo, kar + ua];
  }

  // ---------------------------------------------------------------- Kanal, hat, GIS

  function kanalKodu(og, ag, ayd, rek) {
    return (og ? KANAL.OG : 0) | (ag ? KANAL.AG : 0) | (ayd ? KANAL.AYD : 0) | (rek ? KANAL.REK : 0);
  }

  /** AutoCAD yazımı: "OG", "/AG/AYD", "OG/AG/AYD/REK"... */
  function kanalKablolari(kod) {
    let s = '';
    if (kod & KANAL.OG) s += 'OG';
    if (kod & KANAL.AG) s += '/AG';
    if (kod & KANAL.AYD) s += '/AYD';
    if (kod & KANAL.REK) s += '/REK';
    return s;
  }

  // ---------------------------------------------------------------- Kanal zemini
  // Cins (dolgu), kaplama, bariyer ve trencher ayrı seçilir; çizime / rapora eski programın kalem adı olarak tek yazı
  // gider. Eklentideki karşılığı: autocad/src/Cekirdek/KanalZemini.cs (aynı kural); ortak deneme
  // ortak/deneme/kanal-zemini.json (iki taraf aynı sonuçları üretmek zorunda).

  const KANAL_ZEMIN = {
    CINSLER: ['TOPRAK', 'TUVENAN', 'MICIR', 'BRANŞMAN KANAL', 'KANAL (KABLO DEMONTAJ)'],
    KAPLAMALAR: ['', 'PARKE', 'ASFALT', 'BETON'],
    CINS_ADI: { TOPRAK: 'Toprak', TUVENAN: 'Tüvenan', MICIR: 'Mıcır', 'BRANŞMAN KANAL': 'Branşman kanalı', 'KANAL (KABLO DEMONTAJ)': 'Kablo demontaj kanalı' },
    KAPLAMA_ADI: { '': 'Kaplamasız', PARKE: 'Parke', ASFALT: 'Asfalt', BETON: 'Beton' }
  };
  const kanalOzelMi = (cins) => cins === 'BRANŞMAN KANAL' || cins === 'KANAL (KABLO DEMONTAJ)';

  /** {cins, kaplama, bariyerli, trencher} → kalem adı ("PARKE TUVENAN (BARİYERLİ)"). */
  function kanalZeminiTanim(z) {
    const o = z || {};
    if (kanalOzelMi(o.cins)) return o.cins;
    const cins = o.cins === 'TUVENAN' || o.cins === 'MICIR' ? o.cins : 'TOPRAK';
    const kaplama = o.kaplama || '';
    let s = (o.trencher ? 'TRENCHER ' : '') + (kaplama === 'PARKE' ? 'PARKE ' : '');
    const sonEkli = kaplama === 'ASFALT' || kaplama === 'BETON';
    // Eski programın adı: önü ve kaplama eki olmayan mıcır "MICIRLI"dır
    s += cins === 'MICIR' && s.length === 0 && !sonEkli ? 'MICIRLI' : cins;
    if (sonEkli) s += ' (' + kaplama + ' KAPLAMALI)';
    if (o.bariyerli) s += ' (BARİYERLİ)';
    return s;
  }

  /** Okunur yazı: "Tüvenan · Parke · bariyerli". */
  function kanalZeminiYazi(z) {
    const o = z || {};
    if (kanalOzelMi(o.cins)) return KANAL_ZEMIN.CINS_ADI[o.cins];
    const l = [KANAL_ZEMIN.CINS_ADI[o.cins] || KANAL_ZEMIN.CINS_ADI.TOPRAK, KANAL_ZEMIN.KAPLAMA_ADI[o.kaplama || ''] || o.kaplama];
    if (o.bariyerli) l.push('bariyerli');
    if (o.trencher) l.push('trencher');
    return l.join(' · ');
  }

  function zeminSade(s) {
    return String(s == null ? '' : s).trim().toLocaleUpperCase('tr-TR')
      .replace(/İ/g, 'I').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/Ç/g, 'C').replace(/Ö/g, 'O').replace(/Ğ/g, 'G')
      .replace(/\s+/g, ' ');
  }

  /** Kalem adı → {cins, kaplama, bariyerli, trencher}; kural dışı ad (ör. "ASFALT") için null (ad olduğu gibi korunur). */
  function kanalZeminiCoz(tanim) {
    let s = zeminSade(tanim);
    if (!s) return null;
    if (s === zeminSade('BRANŞMAN KANAL')) return { cins: 'BRANŞMAN KANAL', kaplama: '', bariyerli: false, trencher: false };
    if (s === zeminSade('KANAL (KABLO DEMONTAJ)')) return { cins: 'KANAL (KABLO DEMONTAJ)', kaplama: '', bariyerli: false, trencher: false };
    const z = { cins: 'TOPRAK', kaplama: '', bariyerli: false, trencher: false };
    const kes = (parca, basta) => {
      if (basta) { if (!s.startsWith(parca)) return false; s = s.slice(parca.length).trim(); return true; }
      const i = s.indexOf(parca);
      if (i < 0) return false;
      s = (s.slice(0, i) + ' ' + s.slice(i + parca.length)).trim().replace(/\s+/g, ' ');
      return true;
    };
    z.bariyerli = kes('(BARIYERLI)', false);
    if (kes('(ASFALT KAPLAMALI)', false)) z.kaplama = 'ASFALT';
    else if (kes('(BETON KAPLAMALI)', false)) z.kaplama = 'BETON';
    z.trencher = kes('TRENCHER ', true);
    if (kes('PARKE ', true)) { if (z.kaplama) return null; z.kaplama = 'PARKE'; }
    if (!z.trencher && kes('TRENCHER ', true)) z.trencher = true; // "PARKE TRENCHER …" da okunur
    if (s === 'TOPRAK') z.cins = 'TOPRAK';
    else if (s === 'TUVENAN') z.cins = 'TUVENAN';
    else if (s === 'MICIR' || s === 'MICIRLI') z.cins = 'MICIR';
    else return null;
    return z;
  }

  /** Kanal hacmi (m³): genişlikler ve derinlik cm, uzunluk m. */
  function kanalHacmi(altCm, ustCm, derCm, uzunlukM) {
    return temiz(((sayi(altCm) || 0) + (sayi(ustCm) || 0)) / 2 / 100 * ((sayi(derCm) || 0) / 100) * (sayi(uzunlukM) || 0));
  }

  /** Hat metrajı: çizim uzunluğu yukarı yuvarlanır, türüne göre ek pay eklenir (ayar). */
  function hatMetraji(cizim, tur, ayar) {
    const a = ayar || {};
    const yukari = a.yukariYuvarla !== false;
    const ek = (a.ekPay && Number(a.ekPay[tur])) || 0;
    const L = Math.max(0, Number(cizim) || 0);
    const m = yukari ? Math.ceil(L - 1e-6) : Math.round(L);
    return m + ek;
  }

  /** Etiketteki metraj yazımı ("341", "10,5"). */
  function metrajYazisi(m) {
    const v = temiz(Number(m) || 0, 2);
    return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
  }

  /**
   * Hat etiketi (AutoCAD yazımı, tanıtıcı olmadan): M "^ kesit/341m", M+M "* kesit/15m",
   * DM ">kesit</42m", DM+M "[kesit]/7m", MEVCUT "(kesit)/40m".
   */
  /**
   * Hat etiketi: durum işaretiyle iletken ("^ 3x50 Alm."). Metraj etikete yazılmaz: çizimde her açıklığın üstünde ayrıca
   * yazılıdır (eklentideki NesneYazici.HatEtiketi / EtiketGovdesi ile aynı).
   */
  function hatEtiketi(durum, kesit) {
    const k = malzemeYazisi(kesit || '');
    switch (durum) {
      case 'M': return '^ ' + k;
      case 'M+M': return '* ' + k;
      case 'DM': return '>' + k + '<';
      case 'DM+M': return '[' + k + ']';
      case 'KM': return '/' + k + '\\';
      case 'ENH': return '{' + k + '}';
      case 'MEVCUT': return '(' + k + ')';
      default: return k; // ME ve bilinmeyenler düz yazılır (AutoCAD "TANIMSIZ" yazar)
    }
  }

  // ---------------------------------------------------------------- Birleşik Metraj şablonu doldurma planı
  // Kural ortak/BIRLESIK-METRAJ.md'de; eklentideki Cekirdek/BirlesikMetraj.cs ile aynı. Ortak deneme:
  // ortak/deneme/birlesik-metraj.json. Girdi: eklenti biçiminde proje (projeOku), şablon tanımı (xlsm.js › sablonTanimi /
  // XlsmDosyasi.SablonTanimi), ayar { bolgeId, firma, il, ilce, hakedisNo, katsayilar (katsayiHazirla), eslesme (metraj-sablon.json),
  // poz: (cins, tanim) → poz no, cinsAdlari: cins → okunur ad, anaCinsler: normalleştirilmiş tanım → [cins] (katalogun ana pozları) }.
  // Çıktı: { sayfalar: { ad: { hucreler: { "A18": deger }, gosterSatirlar, gizle } }, kopyaSayfalar, yeniSutunlar, malzSatirlari,
  // listeEkle, fazla, uyarilar, ozet }. Değer: sayı → sayı, "=…" → formül, metin → metin, null → hücre boşaltılır. Yeni sütunların
  // başlık hücreleri ve MALZ. LİSTESİ'ne eklenen satırların formülleri de hücrelerdedir; biçim (stil, genişlik, bayrak / toplam /
  // veri formülleri, satır gizleme, sayfa kopyalama, "ŞABLONDA OLMAYAN" sayfası) yazıcının işidir (xlsm.js › planUygula /
  // XlsmDosyasi.PlanUygula).
  // 13.11.2026 (kullanıcı kararı "cins başına ayrı sayfa"): şablonda temsil edilmeyen cinsten direkler DİREK METRAJI'nın
  // kopyası olan kendi sayfasına yazılır ("DİREK AG BETON", "DİREK ENH GALV. KAYNAKLI RAVEN"…); şablonda olmayan her sütun
  // (ana sayfada ya da kopyada) EK kodu yerine şablonun kendi KOD dizisiyle (Y175, D074…) açılır ve MALZ. LİSTESİ'ne
  // normal satır olarak eklenir (EK KALEMLER bölümü kullanılmaz).

  const BM_BLOK_ADI = { Y: 'YENİ', D: 'DEMONTAJ', DM: 'DEMONTAJDAN MONTAJ', A: 'AKTARIM' };
  const BM_DURUM_YAZISI = { Y: 'YENİ', D: 'DM', DM: 'DM', A: 'AKTARIM' };
  const BM_SAYFA_SIRASI = ['direk', 'iletken', 'yeralti'];
  /** ENH direk tipindeki iletken eki ("G-T-12 (sw)") → aile adı eki (İLETKEN METRAJI'ndaki tel kodlarıyla). */
  const BM_ILETKEN_EKI = { SW: 'SWLL', RV: 'RAVEN', PG: 'PİGEON', HW: 'HAWK', PN: 'PANSY', RS: 'ROSE', AS: 'ASTER' };
  /** Kopya sayfa adındaki kısaltmalar (Excel sayfa adı en çok 31 karakter). */
  const BM_AD_KISALTMA = [[/\bGALVANİZ\b/g, 'GALV.'], [/\bAYDINLATMA\b/g, 'AYD.'], [/\bMÜŞTEREK\b/g, 'MÜŞ.']];
  const bmBuyuk = (s) => str(s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  /** Direğin aile anahtarı: cins + ENH tipindeki iletken eki ("ENH_DEMİR_GLV|SW"); eki olmayan tipte yalnız cins. */
  function bmAile(cins, tip) {
    const m = /\(\s*([A-Za-z]{2,3})\s*\)\s*$/.exec(str(tip).trim());
    const ek = m ? m[1].toUpperCase().replace(/İ/g, 'I') : '';
    return str(cins) + (ek ? '|' + ek : '');
  }
  /** Kopya sayfanın adı: "DİREK " + cinsin okunur adı (büyük; "DİREK" / "DİREĞİ" sözü atılır, kısaltmalar) + iletken eki; 31 karakter. */
  function bmKopyaAdi(hangi, aile, cinsAdlari) {
    const [cins, ek] = aile.split('|');
    let ad = bmBuyuk((cinsAdlari && cinsAdlari[cins]) || cins.replace(/_/g, ' '));
    ad = ad.replace(/\s+DİRE(K|Ğİ)(?=\s|$)/g, '').replace(/[\[\]:*?\/\\']/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [re, kisa] of BM_AD_KISALTMA) ad = ad.replace(re, kisa);
    let tam = (hangi === 'direk' ? 'DİREK ' : hangi === 'iletken' ? 'İLETKEN ' : 'YERALTI ') + ad + (ek ? ' ' + (BM_ILETKEN_EKI[ek] || ek) : '');
    if (tam.length > 31) tam = tam.slice(0, 31).trim();
    return tam;
  }
  /** Formülde sayfa adı: tek tırnakla, içindeki tırnak ikilenir. */
  const bmSayfaRef = (ad) => "'" + str(ad).replace(/'/g, "''") + "'";

  /** Karşılaştırma için ad normalleştirme (iki platformda aynı): büyük harf (i → I), '' → ", boşluk / çarpı sadeleşir. */
  function bmNorm(s) {
    let t = str(s).normalize('NFC').trim();
    t = t.replace(/''/g, '"').replace(/[″“”]/g, '"').replace(/\s+/g, ' ');
    t = t.replace(/İ/g, 'I').replace(/ı/g, 'I').toUpperCase();
    t = t.replace(/MM²/g, 'MM2').replace(/MM 2\b/g, 'MM2');
    t = t.replace(/\s*[xX×]\s*(?=[\d(])/g, 'X').replace(/(\d)\s*\+\s*(?=\d)/g, '$1+').replace(/(\d)\s*\/\s*(?=\d)/g, '$1/');
    t = t.replace(/(\d)\(/g, '$1X(');   // "3(1x150/25)" → "3X(1X150/25)" (şablon yazımı)
    t = t.replace(/TUVENAN/g, 'TUVANEN').replace(/ALÜMINYUM/g, 'ALUMINYUM');
    return t;
  }
  const bmIlkSozcuk = (s) => bmNorm(s).split(' ')[0] || '';

  /** Eklenti durum kodu → blok: Y (yeni), D (demontaj), DM (demontajdan montaj), 'MEVCUT'; İLERİDE → null (yazılmaz). */
  function bmBlok(durum) {
    const d = str(durum).trim().toUpperCase().replace(/İ/g, 'I');
    if (d === 'DM' || d === 'DEMONTAJ') return 'D';
    if (d === 'DM+M' || d === 'DMM') return 'DM';
    if (d === 'MEVCUT') return 'MEVCUT';
    if (d === 'ILERIDE') return null;
    return 'Y';
  }
  /** Doğal sıra (SC2 < SC10): sayılar sayı olarak, yazılar büyük harf kod sırasıyla; iki platformda aynı (ICU'ya bağlı değil). */
  const bmParcala = (s) => str(s).toUpperCase().replace(/İ/g, 'I').replace(/ı/g, 'I').match(/\d+|\D+/g) || [];
  function bmDogalSira(a, b) {
    const pa = bmParcala(a), pb = bmParcala(b);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
      const x = pa[i], y = pb[i];
      const nx = /^\d/.test(x), ny = /^\d/.test(y);
      if (nx && ny) { const d = Number(x) - Number(y); if (d) return d < 0 ? -1 : 1; if (x.length !== y.length) return x.length - y.length; continue; }
      if (nx !== ny) return nx ? -1 : 1;
      if (x !== y) return x < y ? -1 : 1;
    }
    return pa.length - pb.length;
  }

  /** Eklenti birimi ("ad/kg", "mt/mt", "mt/m³") → şablon birimi ("ad.", "mt.", "kg", "m3", "tk."). */
  function bmBirim(birim) {
    const g = str(birim).split('/')[0].toLowerCase().trim();
    if (g === 'kg') return 'kg';
    if (g === 'mt' || g === 'm') return 'mt.';
    if (g === 'tk') return 'tk.';
    if (g === 'm3' || g === 'm³') return 'm3';
    return 'ad.';
  }
  /** Yazılacak miktar: şablon sütunu kg ya da m3 ise ve kalemin rapor birimi öyleyse toplam, yoksa giriş miktarı. */
  function bmMiktar(k, sablonBirim) {
    const rapor = str(k.birim).split('/')[1] || '';
    const sb = str(sablonBirim).toLowerCase();
    if ((sb.startsWith('kg') && /^kg/i.test(rapor)) || (sb.startsWith('m3') && /^m(3|³)/i.test(rapor))) {
      return temiz(num(k.toplam) || num(k.miktar) * num(k.katsayi, 1), 3);
    }
    return temiz(num(k.miktar), 3);
  }
  /** Poz: demontaj "1" + poz, demontajdan montaj / aktarım "2" + poz; ilk bölüm iki haneye tamamlanır (5.5.1 → 105.5.1). */
  function bmPoz(poz, blok) {
    const t = str(poz).trim();
    if (!t || blok === 'Y' || blok === 'MEVCUT') return t;
    const seg = t.split('.');
    seg[0] = seg[0].padStart(2, '0');
    return (blok === 'D' ? '1' : '2') + seg.join('.');
  }

  /** Noktaya en yakın eleman (varsayılan 3,5 m içinde). */
  function bmYakinEleman(p, nokta, tol) {
    let en = null, enD = tol == null ? 3.5 : tol;
    if (!nokta) return null;
    for (const e of p.elemanlar) {
      const d = Math.hypot(e.saga - nokta[0], e.yukari - nokta[1]);
      if (d <= enD) { enD = d; en = e; }
    }
    return en;
  }

  /** Kırık çizginin kanallardan birinin üstünden giden uzunluğu (m): 0,25 m adımla örnekleme, yanal pay 0,6 m. */
  function bmKanalUstu(kose, kanallar) {
    if (!kose || kose.length < 2 || !kanallar || !kanallar.length) return 0;
    const adim = 0.25, tol = 0.6;
    const noktaDogru = (q, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(q[0] - a[0], q[1] - a[1]);
      let t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t));
      return Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy));
    };
    const kanaldaMi = (q) => kanallar.some((k) => { const kk = k.kose || []; for (let i = 1; i < kk.length; i++) if (noktaDogru(q, kk[i - 1], kk[i]) <= tol) return true; return false; });
    let icinde = 0;
    for (let i = 1; i < kose.length; i++) {
      const a = kose[i - 1], b = kose[i], L = mesafe(a, b);
      const n = Math.max(1, Math.ceil(L / adim));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n;
        if (kanaldaMi([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) icinde += L / n;
      }
    }
    return temiz(icinde, 2);
  }

  function sutunHarfiBM(n) { let s = ''; while (n > 0) { const k = (n - 1) % 26; s = String.fromCharCode(65 + k) + s; n = Math.floor((n - 1) / 26); } return s; }
  function sutunNoBM(harf) { let n = 0; for (const ch of String(harf).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }

  /** Doldurma planı; bkz. bölüm başındaki açıklama. */
  function birlesikMetraj(p, sablon, ayar) {
    const a = ayar || {};
    const es = a.eslesme || {};
    const esKalemler = es.kalemler || {};
    const kat = a.katsayilar || katsayiHazirla(null);
    const pozAl = typeof a.poz === 'function' ? a.poz : (c, t) => str(a.poz && a.poz[c + '|' + t]);
    const uyarilar = [], listeEkle = [], yeniSutunlar = [], fazla = [], malzSatirlari = [];
    const ozet = { eleman: 0, iletkenSatiri: 0, yeraltiSatiri: 0, eslesen: 0, yeniSutun: 0, kopyaSayfa: 0, fazla: 0, atlanan: 0 };
    const sayfalar = {};
    const sayfa = (ad) => (sayfalar[ad] = sayfalar[ad] || { hucreler: {}, gosterSatirlar: [], gizle: null });
    const yaz = (ad, ref, deger) => { if (deger !== undefined && deger !== null && deger !== '') sayfa(ad).hucreler[ref] = deger; };
    const basliklar = {};   // DİREK başlık hücreleri (il, ilçe…): kopya sayfalara da yazılır
    const baslikYaz = (ad, ref, deger) => { yaz(ad, ref, deger); if (deger !== undefined && deger !== null && deger !== '') basliklar[ref] = deger; };
    const topla = (ad, ref, m) => { const h = sayfa(ad).hucreler; h[ref] = temiz((typeof h[ref] === 'number' ? h[ref] : 0) + m, 3); };
    const bolgeSuz = (o) => !a.bolgeId || str(o.bolge) === str(a.bolgeId);
    const elemanlar = (p.elemanlar || []).filter(bolgeSuz), hatlar = (p.hatlar || []).filter(bolgeSuz), kanallar = (p.kanallar || []).filter(bolgeSuz);
    const bolge = (p.bolgeler || []).find((b) => str(b.id) === str(a.bolgeId)) || null;
    const hakedisNo = a.hakedisNo != null && a.hakedisNo !== '' ? a.hakedisNo : ((p.proje && p.proje.aktifHakedis) || '');
    const esl = (k) => esKalemler[str(k.cins) + '|' + str(k.tanim)] || esKalemler[str(k.tanim)] || null;
    const pozYap = (k, blok) => { const e = esl(k); return bmPoz((e && e.poz) || pozAl(str(k.cins), str(k.tanim)), blok); };
    const temin = (k, blok) => { if (blok !== 'Y') return ''; const e = esl(k); return (e && e.temin) || (es.temin && es.temin[str(k.cins)]) || 'Ş'; };

    // ---- şablon sayfaları ve yeni sütun yönetimi
    const T = { direk: sablon.direk || null, iletken: sablon.iletken || null, yeralti: sablon.yeralti || null };
    const ONEK = { direk: 'DM', iletken: 'IM', yeralti: 'YM' };
    /** Hedef sayfa tanımları: ana sayfalar + kopyalar; { hangi, sayfa, kaynak (ana tanım; ana sayfada null), sutunlar, sonSutun }. */
    const hedefler = [];
    for (const h of BM_SAYFA_SIRASI) if (T[h]) hedefler.push({ hangi: h, sayfa: T[h].sayfa, kaynak: null, tanim: T[h], sutunlar: T[h].sutunlar, sonSutun: T[h].sonSutun });
    const hedefBul = (ad) => hedefler.find((x) => x.sayfa === ad) || null;
    const kopyaSayfalar = [];
    const cinsAdlari = a.cinsAdlari || {};
    /** Kopya sayfa (yoksa açılır): kaynak sayfanın biçimiyle, KOD sütunları boş. Başlık (il, ilçe…) hücreleri kopyada da yazılır. */
    function kopyaSayfa(hangi, aile) {
      const ana = T[hangi];
      const ad = bmKopyaAdi(hangi, aile, cinsAdlari);
      let k = hedefBul(ad);
      if (k) return k;
      k = { hangi, sayfa: ad, kaynak: ana, tanim: ana, sutunlar: [], sonSutun: ana.ilkKodSutunu - 1 };
      hedefler.push(k);
      kopyaSayfalar.push({ ad, kaynak: ana.sayfa, hangi, aile });
      if (hangi === 'direk') for (const [ref, deger] of Object.entries(basliklar)) yaz(ad, ref, deger);
      return k;
    }
    // KOD dizisi: şablonun blok önekli numaraları sürer (Y001… → Y175…, D074…, DM072…, A017…)
    const kodSayac = {};
    for (const k of sablon.kullanilanKodlar || []) { const m = /^(DM|Y|D|A)(\d+)$/i.exec(str(k).trim()); if (m) { const pre = m[1].toUpperCase(); kodSayac[pre] = Math.max(kodSayac[pre] || 0, +m[2]); } }
    const kodUret = (blok) => { const n = (kodSayac[blok] || 0) + 1; kodSayac[blok] = n; return blok + String(n).padStart(3, '0'); };
    const listeler = sablon.listeler || {};
    const listeSayac = {};
    /**
     * KATSAYILAR'daki seçim listesine değer ekler (varsa eklemez). Şablonun listeleri TİP satırlarından formülle dolar;
     * yeni sütunun KOD'u blok önekiyle yazıldığından direk listeleri kendiliğinden güncellenir. Buraya yalnız formülün
     * kapsamadığı değerler gelir: İLETKEN'de DM / AKTARIM bloğunda açılan tel ya da kablo (listeler YENİ bloğundan dolar),
     * kopya sayfalardaki direk tipleri (listeler yalnız ana sayfadan dolar) ve elle doldurulan Box listesi.
     */
    function listeyeEkle(liste, deger) {
      const l = listeler[liste];
      if (!l || !deger) return;
      const mevcut = (l.degerler || []).some((v) => bmNorm(v) === bmNorm(deger)) || listeEkle.some((x) => x.liste === liste && bmNorm(x.deger) === bmNorm(deger));
      if (mevcut) return;
      const sira = (l.degerler || []).length + (listeSayac[liste] || 0);
      const satir = l.ilk + sira;
      if (satir > l.son) { uyarilar.push('KATSAYILAR ' + liste + ' listesi dolu; "' + deger + '" eklenemedi.'); return; }
      listeSayac[liste] = (listeSayac[liste] || 0) + 1;
      listeEkle.push({ liste, deger, sayfa: l.sayfa, ref: l.sutun + satir });
      yaz(l.sayfa, l.sutun + satir, deger);
    }
    /**
     * Hedef sayfada bloğa yeni sütun açar (aynı anahtarla önce açılmışsa onu döner). bilgi: { tip, poz, ad, temin, birim,
     * grup, veriFormulu, kaynak }. Biçim ve formüller örnek sütundan (ana sayfanın bloğundaki son sütun; tip sütunu
     * açılıyorsa son tip sütunu) kopyalanır: kopya sayfada da örnek ana sayfadadır (ornekSayfa).
     */
    function yeniSutun(h, blok, anahtar, bilgi) {
      const var_ = yeniSutunlar.find((y) => y.sayfa === h.sayfa && y.blok === blok && y.anahtar === anahtar);
      if (var_) return var_;
      const t = h.tanim;
      const sutun = ++h.sonSutun;
      const ornekler = (h.kaynak || t).sutunlar, ters = [...ornekler].reverse();
      const ornek = (bilgi.veriFormulu && h.hangi === 'direk' ? ters.find((x) => x.blok === blok && x.tip) : null) || ters.find((x) => x.blok === blok) || ters[0] || null;
      const kod = kodUret(blok);
      const y = {
        hangi: h.hangi, sayfa: h.sayfa, ornekSayfa: (h.kaynak || t).sayfa, blok, anahtar, sutun, kod, ornekSutun: ornek ? ornek.sutun : null,
        tip: str(bilgi.tip), poz: str(bilgi.poz), ad: str(bilgi.ad), temin: str(bilgi.temin), birim: str(bilgi.birim) || 'ad.',
        grup: (BM_BLOK_ADI[blok] || blok) + '\n' + (str(bilgi.grup) || 'ŞEBEKE-M'), veriFormulu: !!bilgi.veriFormulu, kaynak: bilgi.kaynak || null
      };
      yeniSutunlar.push(y);
      h.sutunlar = h.sutunlar === t.sutunlar ? [...t.sutunlar] : h.sutunlar;   // ana tanımın listesi değişmesin
      h.sutunlar.push({ sutun, kod, blok, tip: y.tip || null, poz: y.poz, ad: y.ad, temin: y.temin, birim: y.birim, grup: y.grup, formullu: y.veriFormulu, yeni: true });
      const S = sutunHarfiBM(sutun), hc = sayfa(h.sayfa).hucreler;
      hc[S + t.kodSatiri] = y.kod;
      if (t.tipSatiri && y.tip) hc[S + t.tipSatiri] = y.tip;
      if (t.durumSatiri) hc[S + t.durumSatiri] = BM_DURUM_YAZISI[blok] || blok;
      if (t.grupSatiri) hc[S + t.grupSatiri] = y.grup;
      if (y.poz) hc[S + t.pozSatiri] = y.poz;
      hc[S + t.adSatiri] = y.ad;
      if (y.temin) hc[S + t.teminSatiri] = y.temin;
      hc[S + t.birimSatiri] = y.birim;
      return y;
    }
    /** Yazılamayan malzeme (yeni sütun açılamadı): "ŞABLONDA OLMAYAN" listesine toplanır. */
    function fazlaya(hangi, blok, anahtar, bilgi, miktar, kim) {
      let f = fazla.find((x) => x.hangi === hangi && x.blok === blok && x.anahtar === anahtar);
      if (!f) { f = { hangi, blok, anahtar, ad: str(bilgi.ad), poz: str(bilgi.poz), birim: str(bilgi.birim) || 'ad.', miktar: 0, nereler: [] }; fazla.push(f); }
      f.miktar = temiz(f.miktar + num(miktar), 3);
      if (kim && f.nereler.indexOf(kim) < 0) f.nereler.push(kim);
      return f;
    }
    /**
     * Sütun bulur ya da açar; miktarı yazar. Kopya sayfada sütun yoksa önce ana sayfanın sütunu aranır: varsa aynı başlıkla
     * (poz, ad, temin, birim) açılır, yoksa kalemin bilgileriyle. Dönüş: bulunan / açılan sütun no (fazlaya gittiyse 0).
     */
    function malzemeYaz(h, blok, k, r, kim) {
      let s = sutunBul(h.sutunlar, blok, k), birim;
      if (s) { if (!s.yeni) ozet.eslesen++; birim = s.birim; }
      else {
        const anaS = h.kaynak ? sutunBul(h.kaynak.sutunlar, blok, k) : null;
        const bilgi = anaS
          ? { tip: anaS.tip, poz: anaS.poz, ad: anaS.ad, temin: anaS.temin, birim: anaS.birim, grup: 'MALZEMELER', kaynak: { cins: str(k.cins), tanim: str(k.tanim) } }
          : { poz: pozYap(k, blok), ad: str(k.tanim), temin: temin(k, blok), birim: bmBirim(k.birim), grup: 'MALZEMELER', kaynak: { cins: str(k.cins), tanim: str(k.tanim) } };
        if (anaS) ozet.eslesen++;
        const y = yeniSutun(h, blok, 'AD|' + bmNorm(k.tanim), bilgi);
        if (!y) { fazlaya(h.hangi, blok, 'AD|' + bmNorm(k.tanim), bilgi, bmMiktar(k, bilgi.birim), kim); return 0; }
        s = y; birim = y.birim;
      }
      topla(h.sayfa, sutunHarfiBM(s.sutun) + r, bmMiktar(k, birim));
      return s.sutun;
    }
    /** Sütun listesinde kalemi karşılayan sütun: TİP = tanım; AD = tanım; eşleşme tablosu; AD "tanım " ile başlar (tanımda rakam / tire varsa). */
    function sutunBul(sutunlar, blok, k) {
      const tanim = bmNorm(k.tanim), e = esl(k);
      const adlar = e && e.adlar ? e.adlar.map(bmNorm) : [];
      const aday = sutunlar.filter((x) => x.blok === blok);
      let b = aday.find((x) => x.tip && bmNorm(x.tip) === tanim);
      if (b) return b;
      b = aday.find((x) => bmNorm(x.ad) === tanim);
      if (b) return b;
      if (adlar.length) { b = aday.find((x) => adlar.indexOf(bmNorm(x.ad)) >= 0); if (b) return b; }
      if (/[\d-]/.test(tanim)) { b = aday.find((x) => bmNorm(x.ad).startsWith(tanim + ' ')); if (b) return b; }
      return null;
    }
    /**
     * Direğin cinsi ana DİREK sayfasında temsil ediliyor mu: şablonun TİP satırındaki bir tip o cinsin katalogdaki ana
     * pozlarından (anaCinsler) ya da eşleşme tablosundaki "tip" takma adından biriyse; ya da eşleşme tablosunun
     * anaSayfaAileleri listesindeyse (ör. ENH_DEMİR_GLV|SW: şablondaki G-N12 / G-T25 kataloga uymaz). Temsil edilmeyen
     * cinsin direkleri kendi kopya sayfasına yazılır (kullanıcı kararı 13.11.2026).
     */
    const temsilOnbellek = {};
    function cinsTemsilEdiliyor(aile) {
      if (aile in temsilOnbellek) return temsilOnbellek[aile];
      const D0 = T.direk;
      const [cins, ek] = aile.split('|');
      let var_ = ((es.anaSayfaAileleri || []).some((x) => str(x) === aile || (str(x) === cins && !ek)));
      if (!var_ && D0) {
        const tipler = D0.sutunlar.filter((x) => x.tip).map((x) => bmNorm(x.tip));
        const anaCinsler = a.anaCinsler || {};
        var_ = tipler.some((tn) => (anaCinsler[tn] || []).indexOf(cins) >= 0);
        if (!var_) for (const [anahtar, deger] of Object.entries(esKalemler)) {
          if (!deger || !deger.tip || anahtar.indexOf('|') < 0 || anahtar.split('|')[0] !== cins) continue;
          if (tipler.indexOf(bmNorm(deger.tip)) >= 0) { var_ = true; break; }
        }
      }
      temsilOnbellek[aile] = var_;
      return var_;
    }
    const satirGoster = (ad, r) => { const s = sayfa(ad); if (s.gosterSatirlar.indexOf(r) < 0) s.gosterSatirlar.push(r); };
    const bitir = (ad, t, r) => { const s = sayfa(ad); for (let i = r; i <= Math.min(r + 1, t.sonVeri); i++) satirGoster(ad, i); s.gizle = r + 2 <= t.sonVeri ? [r + 2, t.sonVeri] : null; };
    const sil = (ad, ref) => { sayfa(ad).hucreler[ref] = null; };

    // ---- yardımcılar
    const ustTur = (o) => str(o.tur).replace(/İ/g, 'I').toUpperCase();
    const direkMi = (e) => /DIREK|DIREGI/.test(ustTur(e));
    const ucNoOnbellek = new Map();
    const ucNo = (h) => {
      if (ucNoOnbellek.has(h)) return ucNoOnbellek.get(h);
      const k = h.kose || [];
      const b = k.length ? bmYakinEleman(p, k[0]) : null, s = k.length ? bmYakinEleman(p, k[k.length - 1]) : null;
      const v = (b ? str(b.gisId) : '?') + '-' + (s ? str(s.gisId) : '?');
      ucNoOnbellek.set(h, v);
      return v;
    };
    const havaiMi = (h) => { const t = ustTur(h); return !/YERALTI/.test(t) && /HAVAI|MUSTEREK|AYDINLATMA|REKORTMAN|ABONE|ENH/.test(t); };
    const yeraltiMi = (h) => /YERALTI/.test(ustTur(h));
    const hatKablosuMu = (k) => k.ana || /ILETKEN|KABLO|ALPEK|REKORTMAN|AYDINLATMA/.test(str(k.cins).replace(/İ/g, 'I').toUpperCase());

    // ======================= DİREK METRAJI
    const D = T.direk;
    if (D) {
      const ad = D.sayfa, sb = D.sabit, b = D.baslik || {};
      if (b.il && a.il) baslikYaz(ad, b.il, str(a.il));
      if (b.ilce && a.ilce) baslikYaz(ad, b.ilce, str(a.ilce));
      if (b.grupNo && bolge) baslikYaz(ad, b.grupNo, str(bolge.grup) || str(bolge.kod));
      if (b.isinAdi) baslikYaz(ad, b.isinAdi, bolge ? str(bolge.ad) : str(p.proje && p.proje.ad));
      if (b.projeNo && bolge) baslikYaz(ad, b.projeNo, str(bolge.kod));
      if (b.yuklenici && a.firma) baslikYaz(ad, b.yuklenici, str(a.firma));
      if (b.hakedisNo) baslikYaz(ad, b.hakedisNo, hakedisNo);
      const sira = elemanlar.filter((e) => direkMi(e) || (e.kalemler || []).length).filter((e) => bmBlok(e.durum) !== null)
        .sort((x, y) => bmDogalSira(x.gisId, y.gisId));
      const kapasite = D.sonVeri - D.ilkVeri + 1;
      // Her eleman kendi hedef sayfasına: temsil edilmeyen cinsten direk kopya sayfaya (ilk görüldüğü sırayla açılır)
      const hedefSira = [hedefBul(ad)];   // hedefler yazılış sırasıyla (ana sayfa her zaman ilk)
      const satirlar = new Map([[ad, D.ilkVeri]]);
      const hedefi = (e) => {
        const ana = (e.kalemler || []).find((k) => k.ana) || null;
        const tip = str(e.tip || (ana && ana.tanim));
        if (!direkMi(e)) return hedefBul(ad);
        const aile = bmAile(e.cins, tip);
        return cinsTemsilEdiliyor(aile) ? hedefBul(ad) : kopyaSayfa('direk', aile);
      };
      for (const e of sira) { const h = hedefi(e); if (!satirlar.has(h.sayfa)) { satirlar.set(h.sayfa, D.ilkVeri); hedefSira.push(h); } }
      for (const h of hedefSira) {
        const sayi = sira.filter((e) => hedefi(e).sayfa === h.sayfa).length;
        if (sayi > kapasite) throw new Error('Şablonun ' + h.sayfa + ' sayfası ' + kapasite + ' satır alır; projede ' + sayi + ' eleman var. Projeyi bölgelere bölün.');
      }
      for (const e of sira) {
        const h = hedefi(e), hs = h.sayfa;
        const r = satirlar.get(hs);
        const blok = bmBlok(e.durum), direk = direkMi(e);
        const no = str(e.gisId);
        satirGoster(hs, r);
        yaz(hs, sb.no + r, no);
        const ana = (e.kalemler || []).find((k) => k.ana) || null;
        if (direk) {
          const tip = str(e.tip || (ana && ana.tanim));
          const anaK = ana || { cins: e.cins, tanim: tip, durum: e.durum };
          if (blok === 'MEVCUT') yaz(hs, sb.mevcut + r, tip);
          else {
            let harf = '';
            if (blok === 'D') {
              const dm = str((ana && ana.dmDurum) || e.dmDurum).toUpperCase().replace(/İ/g, 'I');
              harf = dm.startsWith('S') ? 'S' : 'K';
              if (!dm) uyarilar.push(no + ': demontaj direğin kesik / sökük bilgisi yok; "Kesik" sayıldı.');
            }
            const e2 = esl(anaK), adaylar = [bmNorm(tip)];
            if (e2 && e2.tip) adaylar.push(bmNorm(e2.tip));
            let s = h.sutunlar.find((x) => x.blok === blok && x.tip && adaylar.indexOf(bmNorm(x.tip)) >= 0 && (blok !== 'D' || bmNorm(x.temin).startsWith(harf)));
            let tipYazisi = s ? str(s.tip) : (e2 && e2.tip) || tip;
            if (s) { if (!s.yeni) ozet.eslesen++; }
            else {
              const cinsUst = str(e.cins).toUpperCase();
              const cinsAdi = str(cinsAdlari[str(e.cins)]) || (/AĞAÇ|AGAC/.test(cinsUst) ? 'Ağaç Direk' : /BETON/.test(cinsUst) ? 'Beton Direk' : 'Demir Direk');
              const bilgi = { tip: tipYazisi, poz: pozYap(anaK, blok), ad: tipYazisi + ' ' + cinsAdi.replace(/^(AG|OG|ENH|MÜŞTEREK|Müşterek)\s+/i, ''),
                temin: blok === 'D' ? (harf === 'S' ? 'Sökük' : 'Kesik') : blok === 'DM' ? 'Sökük' : temin(anaK, 'Y'), birim: 'ad.', grup: bmBuyuk(cinsAdi).replace(/\s+DİRE(K|Ğİ)$/, '') + ' DİREKLER',
                veriFormulu: true, kaynak: { cins: str(e.cins), tanim: tip } };
              const y = yeniSutun(h, blok, 'TIP|' + bmNorm(tipYazisi) + (blok === 'D' ? '|' + harf : ''), bilgi);
              if (!y) { fazlaya('direk', blok, 'TIP|' + bmNorm(tipYazisi), bilgi, 1, no); uyarilar.push(no + ': direk tipi "' + tip + '" için sütun açılamadı.'); }
              // kopya sayfanın tipleri KATSAYILAR listelerine (listeler yalnız ana sayfadan formülle dolar)
              else if (h.kaynak) listeyeEkle(blok === 'Y' ? 'yeniDirek' : blok === 'D' ? 'demontaj' : 'dmontaj', blok === 'D' ? tipYazisi + ' (' + harf + ')' : tipYazisi);
            }
            const secim = blok === 'D' ? tipYazisi + ' (' + harf + ')' : tipYazisi;
            yaz(hs, (blok === 'Y' ? sb.yeni : blok === 'D' ? sb.demontaj : sb.dmm) + r, secim);
          }
        }
        // malzemeler: her kalem kendi durumuyla (mevcut direğe yeni armatür gibi)
        const yazilan = new Set();
        for (const k of e.kalemler || []) {
          if (k.ana && direk) continue;
          const kb = bmBlok(str(k.durum) || str(e.durum));
          if (kb === null || kb === 'MEVCUT') continue;
          const s = malzemeYaz(h, kb, k, r, no);
          if (s) yazilan.add(s);
        }
        // programın sayısı olmayan formüllü malzeme sütunları (direk tipi sütunları hariç) → 0 (programın malzemesi esas)
        for (const x of h.sutunlar) if (!x.tip && x.formullu && !x.yeni && !yazilan.has(x.sutun)) sayfa(hs).hucreler[sutunHarfiBM(x.sutun) + r] = 0;
        satirlar.set(hs, r + 1);
        ozet.eleman++;
      }
      for (const h of hedefSira) bitir(h.sayfa, D, satirlar.get(h.sayfa));
    }

    // ======================= İLETKEN METRAJI
    const I = T.iletken;
    if (I) {
      const ad = I.sayfa, sb = I.sabit;
      const kapasite = I.sonVeri - I.ilkVeri + 1;
      let r = I.ilkVeri, doldu = false;
      const parcalar = hatlar.filter(havaiMi).filter((h) => { const b2 = bmBlok(h.durum); return b2 !== null && b2 !== 'MEVCUT'; })
        .sort((x, y) => bmDogalSira(ucNo(x), ucNo(y)) || bmDogalSira(x.id, y.id));
      /** Tel adı → şablondaki TİP KODU (AD'ın ilk sözcüğü tel adı olan kg sütunu); yoksa yeni sütun (TİP KODU = tel adı). */
      const telKodu = (blok, telAdi, kgM, og, kim, adet, metraj) => {
        const n = bmNorm(telAdi);
        const s = I.sutunlar.find((x) => x.blok === blok && str(x.birim).toLowerCase().startsWith('kg') && bmIlkSozcuk(x.ad) === n);
        if (s) { ozet.eslesen++; return str(s.tip); }
        const pozKok = og ? '9.3.1' : '9.2.1';
        const bilgi = { tip: telAdi, poz: bmPoz(pozKok, blok), ad: telAdi + (kgM ? ' (' + temiz(kgM * 1000, 2) + ' Kg/Km)' : ''), temin: blok === 'Y' ? 'Ş' : '', birim: 'kg', grup: 'İLETKENLER', veriFormulu: true, kaynak: { cins: og ? 'OG_İLETKEN' : 'AG_İLETKEN', tanim: telAdi } };
        const y = yeniSutun(hedefBul(ad), blok, 'TEL|' + n, bilgi);
        if (!y) { fazlaya('iletken', blok, 'TEL|' + n, bilgi, temiz(metraj * adet * kgM, 3), kim); uyarilar.push(kim + ': iletken "' + telAdi + '" için sütun açılamadı.'); return null; }
        if (blok !== 'Y' && !I.sutunlar.some((x) => x.blok === 'Y' && x.tip && bmNorm(x.tip) === n)) listeyeEkle('imIletken', telAdi);
        return telAdi;
      };
      /** Hat kablosu (ALPEK / AER, aydınlatma, rekortman) → şablondaki "Kablo tipi" yazısı; yoksa yeni sütun. */
      const kabloTipi = (blok, k, kim, adet, metraj) => {
        const kok = bmIlkSozcuk(k.tanim), tanim = bmNorm(k.tanim), e = esl(k);
        const adaylar = [tanim]; if (e && e.tip) adaylar.push(bmNorm(e.tip));
        let s = I.sutunlar.find((x) => x.blok === blok && x.tip && adaylar.indexOf(bmNorm(x.tip)) >= 0);
        if (!s && /ALPEK|AER/.test(tanim)) s = I.sutunlar.find((x) => x.blok === blok && x.tip && /AER/.test(bmNorm(x.tip)) && bmIlkSozcuk(x.tip) === kok);
        if (s) { ozet.eslesen++; return str(s.tip); }
        const adi = (e && e.tip) || (/ALPEK/.test(tanim) ? kok.toLowerCase() + ' AER Kablo' : str(k.tanim));
        const bilgi = { tip: adi, poz: pozYap(k, blok) || bmPoz('9.5.1', blok), ad: adi, temin: temin(k, blok), birim: 'mt.', grup: 'KABLOLAR', veriFormulu: true, kaynak: { cins: str(k.cins), tanim: str(k.tanim) } };
        const y = yeniSutun(hedefBul(ad), blok, 'KABLO|' + bmNorm(adi), bilgi);
        if (!y) { fazlaya('iletken', blok, 'KABLO|' + bmNorm(adi), bilgi, temiz(metraj * adet, 3), kim); uyarilar.push(kim + ': "' + k.tanim + '" için sütun açılamadı.'); return null; }
        if (blok !== 'Y' && !I.sutunlar.some((x) => x.blok === 'Y' && x.tip && bmNorm(x.tip) === bmNorm(adi))) listeyeEkle('imAer', adi);
        return adi;
      };
      for (const h of parcalar) {
        const hb = bmBlok(h.durum), kim = ucNo(h);
        const bloklar = hb === 'DM' ? ['D', 'A'] : [hb];   // sök-tak: DM + AKTARIM (kullanıcı kararı)
        const ana = (h.kalemler || []).find((k) => k.ana) || null;
        const metraj = temiz((ana && num(ana.miktar)) || num(h.cizimUzunlugu), 2);
        for (const blok of bloklar) {
          if (r > I.sonVeri) { if (!doldu) uyarilar.push(ad + ' ' + kapasite + ' satır alır; kalan açıklıklar yazılmadı.'); doldu = true; break; }
          satirGoster(ad, r);
          yaz(ad, sb.direkler + r, kim);
          yaz(ad, sb.aramesafe + r, metraj);
          yaz(ad, sb.durum + r, BM_DURUM_YAZISI[blok]);
          let agSira = 0;
          for (const k of h.kalemler || []) {
            const c = str(k.cins).replace(/İ/g, 'I').toUpperCase();
            if (c === 'AG_ILETKEN' || c === 'OG_ILETKEN') {
              const og = c === 'OG_ILETKEN';
              const acilim = (og ? kat.ogAcilim : kat.agAcilim)[str(k.tanim).trim()];
              const adlar = og ? kat.ogAdlar : kat.agAdlar, agirlik = og ? kat.ogAgirlik : kat.agAgirlik;
              if (!acilim) { uyarilar.push(kim + ': iletken tertibi "' + k.tanim + '" açılamadı.'); ozet.atlanan++; continue; }
              const teller = adlar.map((t, i) => ({ ad: t, adet: acilim[i], kg: agirlik[i] })).filter((t) => t.adet > 0);
              if (og) {
                if (teller.length > 1) uyarilar.push(kim + ': OG tertibinde birden çok tel türü; ilki yazıldı.');
                if (teller[0]) { const kodu = telKodu(blok, teller[0].ad, teller[0].kg, true, kim, teller[0].adet, metraj); yaz(ad, sb.og[0] + r, teller[0].adet); if (kodu) yaz(ad, sb.og[1] + r, kodu); }
              } else {
                for (const t of teller) {
                  if (agSira >= sb.ag.length) { uyarilar.push(kim + ': AG tertibinde ' + sb.ag.length + '\'ten çok tel türü; "' + t.ad + '" yazılamadı.'); ozet.atlanan++; break; }
                  const kodu = telKodu(blok, t.ad, t.kg, false, kim, t.adet, metraj);
                  yaz(ad, sb.ag[agSira][0] + r, t.adet);
                  if (kodu) yaz(ad, sb.ag[agSira][1] + r, kodu);
                  agSira++;
                }
              }
            } else if (hatKablosuMu(k)) {
              const demet = /^(\d+)\(/.exec(bmNorm(k.tanim));
              const adet = demet ? +demet[1] : 1;
              const tipi = kabloTipi(blok, k, kim, adet, metraj);
              yaz(ad, sb.aer[0] + r, adet);
              if (tipi) yaz(ad, sb.aer[1] + r, tipi);
            } else {
              uyarilar.push(kim + ': hat malzemesi "' + k.tanim + '" ' + ad + ' sayfasına yazılamaz; atlandı.');
              ozet.atlanan++;
            }
          }
          r++;
          ozet.iletkenSatiri++;
        }
      }
      bitir(ad, I, r);
    }

    // ======================= YERALTI METRAJI
    const Yt = T.yeralti;
    if (Yt) {
      const ad = Yt.sayfa, sb = Yt.sabit;
      let r = Yt.ilkVeri;
      const kapasite = Yt.sonVeri - Yt.ilkVeri + 1;
      const satirAl = (kim) => { if (r > Yt.sonVeri) { uyarilar.push(ad + ' ' + kapasite + ' satır alır; "' + kim + '" yazılmadı.'); return false; } satirGoster(ad, r); return true; };
      const ucEleman = (h) => { const k = h.kose || []; return [k.length ? bmYakinEleman(p, k[0]) : null, k.length ? bmYakinEleman(p, k[k.length - 1]) : null].filter(Boolean); };
      const cinsYaz = (eler) => {
        for (const e of eler) {
          const tur = ustTur(e);
          if (/BOX|PANO|SDK/.test(tur)) { if (sb.box) { yaz(ad, sb.box + r, str(e.tip)); listeyeEkle('box', str(e.tip)); } }
          else if (/AYD/.test(tur)) { if (sb.aydDirek) yaz(ad, sb.aydDirek + r, str(e.tip)); }
          else if (/BETON/.test(str(e.cins).toUpperCase())) { if (sb.betonDirek) yaz(ad, sb.betonDirek + r, str(e.tip)); }
          else if (/DIREK|DIREGI/.test(tur)) { if (sb.direkCinsi) yaz(ad, sb.direkCinsi + r, str(e.tip)); }
        }
      };
      // kanallar
      const kanalSira = kanallar.filter((k) => { const b2 = bmBlok(k.durum); return b2 !== null && b2 !== 'MEVCUT'; })
        .sort((x, y) => bmDogalSira(str(x.basNo) + '-' + str(x.bitNo), str(y.basNo) + '-' + str(y.bitNo)) || bmDogalSira(x.id, y.id));
      for (const k of kanalSira) {
        const blok = bmBlok(k.durum);
        const kim = (str(k.basNo) || '?') + '-' + (str(k.bitNo) || '?');
        if (!satirAl(kim)) break;
        const ana = (k.kalemler || []).find((x) => x.ana) || null;
        const zeminAdi = str(k.zemin || (ana && ana.tanim));
        const z = kanalZeminiCoz(zeminAdi) || { cins: 'TOPRAK', kaplama: '', bariyerli: false, trencher: false };
        yaz(ad, sb.no + r, kim);
        yaz(ad, sb.aramesafe + r, temiz(num(k.cizimUzunlugu), 2));
        if (sb.tertip) yaz(ad, sb.tertip + r, 'Kanal ' + str(k.kablolar || kanalKablolari(k.kod)).replace(/^\//, ''));
        if (sb.taban) yaz(ad, sb.taban + r, temiz(num(k.altGenislik), 1));
        if (sb.tavan) yaz(ad, sb.tavan + r, temiz(num(k.ustGenislik), 1));
        if (sb.derinlik) yaz(ad, sb.derinlik + r, temiz(num(k.derinlik), 1));
        if (sb.dolgu) yaz(ad, sb.dolgu + r, zeminAdi);
        if (sb.kaplama && z.kaplama) yaz(ad, sb.kaplama + r, z.kaplama);
        const hacim = temiz((ana && num(ana.toplam)) || kanalHacmi(k.altGenislik, k.ustGenislik, k.derinlik, k.cizimUzunlugu), 3);
        if (sb.toplamM3) yaz(ad, sb.toplamM3 + r, hacim);
        const ozel = z.cins === 'BRANŞMAN KANAL' || z.cins === 'KANAL (KABLO DEMONTAJ)';
        const dolgu = z.cins === 'TUVENAN' ? 'TUVANEN' : z.cins === 'MICIR' ? 'MICIR' : 'TOPRAK';
        const kaplama = z.kaplama || 'KAPLAMASIZ';
        let s = null;
        if (!ozel) {
          s = Yt.sutunlar.find((x) => x.blok === blok && str(x.birim).toLowerCase().startsWith('m3') && bmNorm(x.ad).indexOf(kaplama) >= 0 && bmNorm(x.ad).indexOf(dolgu) >= 0
            && (z.bariyerli === /BARIYER/.test(bmNorm(x.ad))) && (z.trencher === /TRENCHER/.test(bmNorm(x.ad))));
        }
        if (s) { ozet.eslesen++; yaz(ad, sutunHarfiBM(s.sutun) + r, hacim); }
        else {
          const kalem = ana || { cins: 'KABLO_KANALI', tanim: zeminAdi, birim: 'mt/m³', miktar: num(k.cizimUzunlugu), toplam: hacim };
          const kaplamaAdi = kaplama === 'KAPLAMASIZ' ? '' : kaplama[0] + kaplama.slice(1).toLowerCase() + ' Kaplamalı ';
          const dolguAdi = dolgu === 'TOPRAK' ? 'Toprak' : dolgu === 'MICIR' ? 'Mıcır Dolgulu' : 'Tuvanen Dolgulu';
          const adi = ozel ? (z.cins === 'BRANŞMAN KANAL' ? 'Branşman Kablo Kanalı Yapılması' : 'Kablo Demontaj Kanalı Açılması')
            : kaplamaAdi + dolguAdi + ' Kablo Kanalı Yapılması' + (kaplama === 'KAPLAMASIZ' ? ' - Kaplamasız' : '') + (z.bariyerli ? ' (Bariyerli)' : '') + (z.trencher ? ' (Trencher)' : '');
          const bilgi = { poz: pozYap(kalem, blok) || bmPoz('32.12.1', blok), ad: adi, temin: blok === 'Y' ? 'Y' : '', birim: 'm3', grup: 'KANALLAR', kaynak: { cins: str(kalem.cins), tanim: str(kalem.tanim) } };
          const anahtar = 'KANAL|' + bmNorm(adi);
          const y = yeniSutun(hedefBul(ad), blok, anahtar, bilgi);
          if (y) yaz(ad, sutunHarfiBM(y.sutun) + r, hacim);
          else { fazlaya('yeralti', blok, anahtar, bilgi, hacim, kim); uyarilar.push(kim + ': kanal türü "' + adi + '" için sütun açılamadı.'); }
        }
        for (const x of k.kalemler || []) {
          if (x.ana) continue;
          const kb = bmBlok(str(x.durum) || str(k.durum));
          if (kb === null || kb === 'MEVCUT') continue;
          malzemeYaz(hedefBul(ad), kb, x, r, kim);
        }
        r++;
        ozet.yeraltiSatiri++;
      }
      // yeraltı kablo parçaları: metraj kanal üstü (KANAL İÇİN) ve geri kalan (DİREK İÇİN) diye bölünür (kullanıcı kararı)
      const kablolar = hatlar.filter(yeraltiMi).filter((h) => { const b2 = bmBlok(h.durum); return b2 !== null && b2 !== 'MEVCUT'; })
        .sort((x, y) => bmDogalSira(ucNo(x), ucNo(y)) || bmDogalSira(x.id, y.id));
      const kanalCizgileri = kanallar.map((k) => ({ kose: k.kose }));
      for (const h of kablolar) {
        const blok = bmBlok(h.durum), kim = ucNo(h);
        if (!satirAl(kim)) break;
        yaz(ad, sb.no + r, kim);
        yaz(ad, sb.aramesafe + r, temiz(num(h.cizimUzunlugu), 2));
        const kalem = (h.kalemler || []).find((x) => x.ana) || (h.kalemler || []).find(hatKablosuMu) || null;
        if (sb.tertip) yaz(ad, sb.tertip + r, kalem ? str(kalem.tanim) : str(h.anaKesit));
        cinsYaz(ucEleman(h));
        if (kalem) {
          const metraj = temiz(num(kalem.miktar) || num(h.cizimUzunlugu), 2);
          const cizim = num(h.cizimUzunlugu);
          const kanalUstu = bmKanalUstu(h.kose, kanalCizgileri);
          const kanalIcin = cizim > 0 ? temiz(metraj * Math.min(1, kanalUstu / cizim), 2) : 0;
          const direkIcin = temiz(metraj - kanalIcin, 2);
          const kb = bmBlok(str(kalem.durum) || str(h.durum)) || blok;
          const tanim = bmNorm(kalem.tanim), e = esl(kalem);
          const adlar = e && e.adlar ? e.adlar.map(bmNorm) : [];
          const alm = /ALM|ALUMINYUM|NAYY|\bAL\b/.test(tanim) || /ALÜMİNYUM|_ALM/.test(str(kalem.cins).toUpperCase());
          const cu = /\bCU\b|BAKIR|NYY(?!.*NAYY)/.test(tanim) && !alm || /BAKIR/.test(str(kalem.cins).toUpperCase());
          const uyumlu = (adN) => { const t = adN.replace(/\(.*$/, ''); const tAlm = /NAYY|ALM|ALUMINYUM/.test(t), tCu = /\bNYY\b|\bCU\b|BAKIR/.test(t) && !tAlm; return !((alm && tCu) || (cu && tAlm)); };
          const nereler = [['KANAL', kanalIcin, 'KANAL İÇİN'], ['DIREK', direkIcin, 'DİREK İÇİN']];
          const yeri = (adN) => (/\(KANAL IÇIN\)/.test(adN) ? 'KANAL' : /\((DIREK|BOX) IÇIN\)/.test(adN) ? 'DIREK' : '');
          const govde = (adN) => adN.replace(/\s*\((DIREK|KANAL|BOX) IÇIN\)\s*$/, '');
          for (const [nerede, m, ek] of nereler) {
            if (!(m > 0)) continue;
            const aday = Yt.sutunlar.filter((x) => x.blok === kb && yeri(bmNorm(x.ad)) === nerede);
            let s = aday.find((x) => govde(bmNorm(x.ad)) === tanim) || aday.find((x) => adlar.indexOf(govde(bmNorm(x.ad))) >= 0);
            if (!s) s = aday.find((x) => govde(bmNorm(x.ad)).startsWith(tanim + ' ')) || aday.find((x) => bmIlkSozcuk(x.ad) === bmIlkSozcuk(tanim) && uyumlu(bmNorm(x.ad)));
            if (s) { ozet.eslesen++; yaz(ad, sutunHarfiBM(s.sutun) + r, m); continue; }
            const adi = ((e && e.adlar && e.adlar[0]) || str(kalem.tanim)) + ' (' + ek + ')';
            const bilgi = { poz: pozYap(kalem, kb) || bmPoz(nerede === 'KANAL' ? '32.16' : '32.12', kb), ad: adi, temin: temin(kalem, kb), birim: 'mt.', grup: 'KABLOLAR', kaynak: { cins: str(kalem.cins), tanim: str(kalem.tanim) } };
            const anahtar = 'KABLO|' + tanim + '|' + nerede;
            const y = yeniSutun(hedefBul(ad), kb, anahtar, bilgi);
            if (y) yaz(ad, sutunHarfiBM(y.sutun) + r, m);
            else { fazlaya('yeralti', kb, anahtar, bilgi, m, kim); uyarilar.push(kim + ': "' + kalem.tanim + '" için sütun açılamadı.'); }
          }
        }
        for (const x of h.kalemler || []) {
          if (x === kalem || x.ana) continue;
          const kb = bmBlok(str(x.durum) || str(h.durum));
          if (kb === null || kb === 'MEVCUT') continue;
          malzemeYaz(hedefBul(ad), kb, x, r, kim);
        }
        r++;
        ozet.yeraltiSatiri++;
      }
      bitir(ad, Yt, r);
    }

    // ======================= MALZ. LİSTESİ: yeni sütunlar normal satır olarak (EK KALEMLER bölümünün yerine; kullanıcı kararı)
    const M = sablon.malz;
    if (M && yeniSutunlar.length) {
      const ekler = M.ekSatirlari || [];
      let r = M.ekBaslikSatiri || (ekler.length ? ekler[0].satir : 0);
      if (!r) uyarilar.push(M.sayfa + ': EK KALEMLER bölümü yok; yeni sütunlar listeye yazılamadı.');
      else {
        // eski EK satırları temizlenir (KOD "E001"… ve miktar); bölüm başlığı satırının yazısı yeni başlıkla değişir
        for (const e of ekler) { sil(M.sayfa, M.kodSutunu + e.satir); sil(M.sayfa, M.miktarSutunu + e.satir); }
        const adlar = (t, anahtar) => (t.adlar && t.adlar[anahtar]) || null;
        // bölüm sırası: DİREK METRAJI, DİREK kopyaları, İLETKEN, YERALTI
        const sirali = [...hedefler].sort((x, y) => BM_SAYFA_SIRASI.indexOf(x.hangi) - BM_SAYFA_SIRASI.indexOf(y.hangi) || (x.kaynak ? 1 : 0) - (y.kaynak ? 1 : 0) || hedefler.indexOf(x) - hedefler.indexOf(y));
        for (const h of sirali) {
          const sutunlar = yeniSutunlar.filter((y) => y.sayfa === h.sayfa).sort((x, y) => x.sutun - y.sutun);
          if (!sutunlar.length) continue;
          const t = h.tanim, ON = ONEK[h.hangi];
          // ad: ana sayfada tanımlı ad (DM_KOD_SATIRI), kopyada aynı aralık kopya sayfasında ('DİREK AG BETON'!$G$10:$ZZ$10)
          const aralik = (anahtar) => (h.kaynak ? bmSayfaRef(h.sayfa) + '!' + adlar(t, anahtar) : ON + '_' + anahtar + '_SATIRI');
          const F = M.toplamSutunu || 'F';
          sayfa(M.sayfa).hucreler[(M.bayrakSutunu || 'A') + r] = '=IF(COUNTIF(' + F + (r + 1) + ':' + F + (r + sutunlar.length) + ',">0")>0,1,0)';
          sayfa(M.sayfa).hucreler[M.pozSutunu + r] = h.sayfa;
          for (const c of [M.adSutunu, M.birimSutunu, M.teminSutunu, F, M.kodSutunu, M.miktarSutunu, M.kaynakSutunu]) sil(M.sayfa, c + r);
          malzSatirlari.push({ satir: r, tur: 'grup', sayfa: h.sayfa });
          r++;
          for (const y of sutunlar) {
            const I = '$' + M.kaynakSutunu + r, hc = sayfa(M.sayfa).hucreler;
            hc[(M.bayrakSutunu || 'A') + r] = '=IF(' + (M.toplamSutunu || 'F') + r + '>0,1,0)';
            hc[M.kodSutunu + r] = y.kod;
            hc[M.pozSutunu + r] = '=IF(' + I + '="","",INDEX(' + aralik('POZ') + ',' + I + ')&"")';
            hc[M.adSutunu + r] = '=IF(' + I + '="","",TRIM(INDEX(' + aralik('AD') + ',' + I + ')&IFERROR(VLOOKUP(INDEX(' + aralik('SEC') + ',' + I + '),SECIM_EK,2,FALSE),"")))';
            hc[M.birimSutunu + r] = '=IF(' + I + '="","",INDEX(' + aralik('BIRIM') + ',' + I + ')&"")';
            hc[M.teminSutunu + r] = y.blok === 'Y' ? '=IF(' + I + '="","",INDEX(' + aralik('SEC') + ',' + I + ')&"")' : 'Y';
            // miktar: İLETKEN'de "MALZ. LİSTESİNE AKTARILAN" satırı (DM: hurda = demontaj − aktarım), ötekilerde TOPLAM satırı
            hc[M.miktarSutunu + r] = '=IF(' + I + '="",0,N(INDEX(' + aralik(t.malzSatiri ? 'MALZ' : 'TOPLAM') + ',' + I + ')))';
            hc[(M.toplamSutunu || 'F') + r] = '=' + M.miktarSutunu + r;
            hc[M.kaynakSutunu + r] = '=IFERROR(MATCH($' + M.kodSutunu + r + ',' + aralik('KOD') + ',0),"")';
            malzSatirlari.push({ satir: r, tur: 'kalem', sayfa: h.sayfa, kod: y.kod });
            r++;
          }
        }
      }
    }
    ozet.yeniSutun = yeniSutunlar.length;
    ozet.kopyaSayfa = kopyaSayfalar.length;
    ozet.fazla = fazla.length;
    if (fazla.length) uyarilar.push(fazla.length + ' malzeme yazılamadı; "ŞABLONDA OLMAYAN" sayfasına yazıldı.');
    return { sayfalar, kopyaSayfalar, yeniSutunlar, malzSatirlari, listeEkle, fazla, uyarilar, ozet };
  }

  // ---------------------------------------------------------------- Malzeme adlarının görünen yazımı
  // Eklentideki MalzemeYazimi.Duzelt ile aynı kurallar, aynı sıra: kelimeler BÜYÜK (Türkçe), birimler standart (kV, kVA,
  // kA, mm…; sayıdan sonra, aralarında boşluk), kablo kodları büyük, metaller Cu / Al ("Alm." → "Al"), boyut çarpısı x,
  // yaygın kısaltmalar açık (Herm. → HERMETİK…), ondalık virgül. Yalnız görünen yazı değişir; kayıtlı veri, rapor ve
  // eşleşme aynı kalır. Aynı yazıya ikinci kez uygulanınca değişmez.
  const YZ_HARF = 'A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû';
  const YZ_ACILIM = [
    ['GEN. TANK.', 'GENLEŞME TANKLI'], ['SOD.BUH.AMP.', 'SODYUM BUHARLI AMPUL'], ['ANH. OTO. SİG.', 'ANAHTARLI OTOMATİK SİGORTA'],
    ['İŞLETME TOP.', 'İŞLETME TOPRAKLAMASI'], ['MESNET İZO.', 'MESNET İZOLATÖRÜ'], ['GEÇİT İZO.', 'GEÇİT İZOLATÖRÜ'],
    ['ZİNC. İZO.', 'ZİNCİR İZOLATÖRÜ'], ['İRT.KLEMENS', 'İRTİBAT KLEMENSİ'], ['PLUG-IN BAŞ.', 'PLUG-IN BAŞLIK'], ['SF6 G.K', 'SF6 GAZLI KESİCİ'],
    ['VAK. K.', 'VAKUM KESİCİ'], ['VAK.', 'VAKUM'], ['YÜK AYR.', 'YÜK AYIRICI'], ['YÜK.BAS.', 'YÜKSEK BASINÇLI'], ['ŞEF. TÜP.', 'ŞEFFAF TÜP'],
    ['HERM.', 'HERMETİK'], ['ARM.', 'ARMATÜR'], ['K.B.', 'KABLO BAŞLIĞI'], ['K.B', 'KABLO BAŞLIĞI'], ['SİGOR.', 'SİGORTALI'],
    ['TOPR.', 'TOPRAKLAMALI'], ['KÖŞEB.', 'KÖŞEBENT'], ['KÖŞEBNT', 'KÖŞEBENT'], ['TRAV.', 'TRAVERS'], ['HÜC.', 'HÜCRESİ'], ['PLMR', 'POLİMER'],
    ['PN.', 'PANO'], ['D.T.', 'DT'], ['D.T', 'DT'], ['H.T.', 'HT'], ['H.T', 'HT'], ['ALM.', 'Al'],
    ['TUTANAGI', 'TUTANAĞI'], ['SÜKÜLMESİ', 'SÖKÜLMESİ'], ['İZOLATOR', 'İZOLATÖR'], ['KANCASİ', 'KANCASI'], ['PARAFUDUR', 'PARAFUDR'], ['MAŞON', 'MANŞON'],
    // 1.11.2026: katalog tanımlarındaki yazım hataları (kayıt aynı kalır; yalnız görünen yazı) — MalzemeYazimi.cs ile aynı sıra
    ['ALİMİNYUM', 'ALÜMİNYUM'], ['İZALASYON', 'İZOLASYON'], ['KUBLAJ', 'KUPLAJ'], ['KURTGÖZU', 'KURTGÖZÜ'], ['OTAMATİK', 'OTOMATİK'], ['SECTİONALİSER', 'SECTIONALISER'], ['PIEGON', 'PIGEON'], ['PIGON', 'PIGEON'], ['YAGLI', 'YAĞLI'], ['KOFRA', 'KOFRE'], ['TIP', 'TİP'], ['CİVATA', 'CIVATA'], ['CİVA', 'CIVA'], ['MAGNETİK', 'MANYETİK'], ['COORS', 'CORS'], ['ÖZENGİ', 'ÜZENGİ'], ['FLAMANLI', 'FİLAMANLI'], ['PAPUÇ', 'PABUÇ'], ['ETÜD', 'ETÜT'], ['BUSHİNG', 'BUŞİNG'], ['DOUBE', 'DOUBLE'], ['KAPLAMAS', 'KAPLAMASI']
  ];
  const YZ_BIRIM = [['KVAR', 'kVAr'], ['MVAR', 'MVAr'], ['KVA', 'kVA'], ['KV', 'kV'], ['KA', 'kA'], ['KN', 'kN'], ['KW', 'kW'], ['HZ', 'Hz'], ['MM²', 'mm²'], ['MM', 'mm'], ['CM', 'cm']];
  const YZ_METAL = [['CU', 'Cu'], ['AL', 'Al']];
  const yzKac = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const harfMi = (c) => !!c && new RegExp('[' + YZ_HARF + '\\d]').test(c);
  let yzKurallar = null;
  function yzHazirla() {
    if (yzKurallar) return yzKurallar;
    const acilim = YZ_ACILIM.map(([a, b]) => [new RegExp('(?<![' + YZ_HARF + '\\d])' + yzKac(a) + (/[A-Za-zÇĞİÖŞÜ]/.test(a[a.length - 1]) ? '(?![' + YZ_HARF + '])' : ''), 'g'), b]);
    const birim = YZ_BIRIM.map(([a, b]) => [new RegExp('(?<=\\d\\s?)' + yzKac(a) + '(?![' + YZ_HARF + '\\d])', 'g'), b])
      .concat(YZ_METAL.map(([a, b]) => [new RegExp('(?<![' + YZ_HARF + '\\d])' + yzKac(a) + '(?![' + YZ_HARF + '\\d])', 'g'), b]));
    yzKurallar = {
      acilim, birim,
      sodyum: new RegExp('(?<=\\d\\s?W\\s)SB(?![' + YZ_HARF + '\\d])', 'g'),
      carpi: /(?<=[\d)"'])X(?=[\d(])/g,
      carpiKod: /(?<=\d)X(?=[A-ZÇĞİÖŞÜ]{2})/g,
      metre: new RegExp('(\\d)\\s?(?:MT|M)\\.?(?![' + YZ_HARF + '\\d.])', 'g'),
      birimBosluk: new RegExp('(\\d)(kVAr|MVAr|kVA|MVA|kV|kA|kN|kW|Hz|mm²|mm|cm)(?![' + YZ_HARF + '\\d])', 'g'),
      avw: /(\d{2,})(A|V|W)(?=$|[\s,;)/\-])/g,
      ondalik: /(?<![\d.,])(\d+)\.(\d+)(?![\d.])/g,
      parantez: /\(\s+|\s+\)/g
    };
    return yzKurallar;
  }
  /** Malzeme adının görünen yazımı (eklentideki MalzemeYazimi.Duzelt ile aynı). */
  function malzemeYazisi(s) {
    if (s == null || !String(s).trim()) return s == null ? '' : String(s);
    const r = yzHazirla();
    let t = String(s).replace(/\\/g, '/').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR');
    for (const [re, deger] of r.acilim) {
      const metin = t;
      t = metin.replace(re, (m, ofs) => deger + (harfMi(metin[ofs + m.length]) ? ' ' : ''));
    }
    t = t.replace(r.sodyum, 'SODYUM BUHARLI');
    for (const [re, deger] of r.birim) t = t.replace(re, deger);
    t = t.replace(r.carpi, 'x').replace(r.carpiKod, 'x').replace(r.metre, '$1 m').replace(r.birimBosluk, '$1 $2').replace(r.avw, '$1 $2')
      .replace(r.ondalik, '$1,$2').replace(r.parantez, (m) => m.trim());
    return t.replace(/\s+/g, ' ').trim();
  }

  /**
   * Sıradaki GIS numarası. Direkler ortak sırayı paylaşır (SC77, SC78…); box SCB12, pano SCP03,
   * trafo SCTR10; ek mufu OG/AG'ye göre EKOG / EKAG; kofrede GIS numarası yoktur.
   */
  function sonrakiGis(proje, tur, onEk, cins) {
    const t = elemanTuru(tur).gis;
    if (!t) return '';
    if (t === 'mufu') return (cins || '').indexOf('_OG_') >= 0 ? 'EKOG' : 'EKAG';
    const on = (onEk || '') + (t === 'direk' ? '' : t);
    const re = new RegExp('^' + on.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$');
    let max = 0;
    let genislik = t === 'direk' ? 1 : 2;
    for (const e of proje.elemanlar) {
      const m = re.exec(e.gisId || '');
      if (!m) continue;
      const n = Number(m[1]);
      if (n > max) max = n;
      if (t !== 'direk') genislik = Math.max(genislik, m[1].length);
    }
    return on + String(max + 1).padStart(genislik, '0');
  }

  /** Projedeki en büyük sayısal kalem sırası (yeni kalemler bundan sonra numaralanır). */
  function enBuyukSira(proje) {
    let max = 0;
    for (const k of ['elemanlar', 'hatlar', 'kanallar', 'sondajlar']) {
      for (const o of proje[k]) {
        for (const kl of o.kalemler || []) {
          if (tamSayiMi(kl.sira)) {
            const n = Number(kl.sira);
            if (n > max) max = n;
          }
        }
      }
    }
    return max;
  }

  // ---------------------------------------------------------------- Katalog

  /**
   * Katalog: ortak/katalog/kalemler.json + projedeki kalemler (projede kullanılan ama katalogda
   * olmayan tipler de seçilebilsin). Her öğe {cins, tanim, birim, katsayi, tarife, rol, nesneler, kullanim}.
   */
  function katalogHazirla(katalogJson, proje) {
    const liste = [];
    const anahtar = new Map();
    const ekle = (it, kaynak) => {
      const key = it.cins + '\u0001' + it.tanim;
      let v = anahtar.get(key);
      if (!v) {
        v = {
          cins: it.cins, tanim: it.tanim, birim: it.birim || 'ad/ad', katsayi: Number(it.katsayi) || 1, tarife: it.tarife || '',
          rol: it.rol || 'malzeme', nesneler: new Set(it.nesneler || []), kullanim: 0, kaynak
        };
        anahtar.set(key, v);
        liste.push(v);
      } else {
        for (const n of it.nesneler || []) v.nesneler.add(n);
      }
      v.kullanim += Number(it.kullanim) || 0;
      return v;
    };
    for (const it of (katalogJson && katalogJson.kalemler) || []) ekle(it, 'katalog');
    if (proje) {
      const nesneKalemleri = (o, nesne) => {
        for (const kl of o.kalemler || []) {
          if (!kl.cins || !kl.tanim) continue;
          const rol = kl.ana ? (nesne === 'KANAL' ? 'kanal' : nesne === 'SONDAJ' ? 'sondaj' : 'ana') : kl.kaynak === 'HAT' ? 'hat' : 'malzeme';
          if (nesne === 'KANAL' && kl.ana) continue; // kanal kaleminin cinsi kanal kodudur
          ekle({ cins: kl.cins, tanim: kl.tanim, birim: kl.birim, katsayi: kl.katsayi, tarife: kl.tarife, rol, nesneler: [nesne], kullanim: 1 }, 'proje');
        }
      };
      for (const e of proje.elemanlar) nesneKalemleri(e, e.tur);
      for (const h of proje.hatlar) nesneKalemleri(h, 'HAT_' + h.tur);
      for (const s of proje.sondajlar) nesneKalemleri(s, 'SONDAJ');
    }
    return liste;
  }

  /** Eleman türünün kendi pozları (direk tipleri vb.), en çok kullanılan önce. */
  function anaTipler(katalog, tur) {
    return katalog.filter(it => it.rol === 'ana' && (it.nesneler.has(tur) || cinstenElemanTuru(it.cins) === tur))
      .sort((a, b) => b.kullanim - a.kullanim || ordinal(a.tanim, b.tanim));
  }

  /** Hat türünün kesitleri (hat kalemleri). */
  function hatKesitleri(katalog, tur) {
    const nesne = 'HAT_' + tur;
    return katalog.filter(it => it.nesneler.has(nesne) || (it.rol === 'hat' && cinstenHatTuru(it.cins) === tur))
      .sort((a, b) => b.kullanim - a.kullanim || ordinal(a.tanim, b.tanim));
  }

  /** Nesneye eklenebilecek malzemeler: önce o nesnede kullanılanlar, sonra diğerleri. */
  function malzemeler(katalog, nesne) {
    return katalog.filter(it => it.rol === 'malzeme' || it.rol === 'hat')
      .sort((a, b) => (b.nesneler.has(nesne) - a.nesneler.has(nesne)) || b.kullanim - a.kullanim || ordinal(a.cins, b.cins) || ordinal(a.tanim, b.tanim));
  }

  /** Katalog öğesinden kalem. o: {miktar, durum, hakedis, ana, kaynak, sira, dmDurum, aciklama}. */
  function kalemYap(it, o) {
    const miktar = sayi(o.miktar === undefined ? 1 : o.miktar);
    const katsayi = Number(it.katsayi) || 1;
    const k = {
      cins: it.cins, tanim: it.tanim, durum: o.durum || 'M', miktar: Number.isFinite(miktar) ? miktar : 0,
      birim: it.birim || 'ad/ad', katsayi, toplam: 0, birimFiyat: Number(o.birimFiyat) || 0,
      hakedis: o.hakedis || 1, tarife: it.tarife || '', sira: o.sira === undefined ? '' : String(o.sira),
      kontrol: null, kaynak: o.kaynak || 'MALZEME'
    };
    if (o.aciklama) k.aciklama = o.aciklama;
    if (o.dmDurum) k.dmDurum = o.dmDurum;
    if (o.ana) k.ana = true;
    k.toplam = temiz(k.miktar * k.katsayi);
    return k;
  }

  /** Kalemin toplamını miktara göre yeniden hesaplar (kanalın kendi kaleminde toplam = hacim). */
  function kalemToplami(k, kanal) {
    if (kanal && k.ana) k.toplam = kanalHacmi(kanal.altGenislik, kanal.ustGenislik, kanal.derinlik, k.miktar);
    else k.toplam = temiz((Number(k.miktar) || 0) * (Number(k.katsayi) || 0));
    return k;
  }

  /** Birim yazımından giriş ve rapor birimleri: "mt/kg" → ["mt", "kg"]. */
  function birimler(birim) {
    const p = String(birim || '').split('/');
    return [p[0] || '', p[1] || p[0] || ''];
  }

  // ---------------------------------------------------------------- Proje dosyası

  /**
   * Simge ve yazı boyutları (proje.boyutlar; eklentideki Boyutlar, Çizim Ayarları › Görünüm): simge büyüklüğü (kat;
   * 1 = 1/1000 pafta), hat etiketi (kablo tipi), metraj ve eleman yazısı yüksekliği (m), hat kalınlığı (kat: ortak
   * stildeki kalınlığın çarpanı, 0 = ince çizgi) ve malzemelerin çizimde yazılması (malzemeEtiketi). Bozuk değer
   * varsayılana döner; hepsi varsayılansa null (dosyaya yazılmaz).
   */
  // simgeTakimi: '' klasik, 'SM' Şebeke-M (eklentideki Boyutlar.SimgeTakimi; 9.11.2026)
  const BOYUT_VARSAYILAN = { simgeOlcegi: 1, etiketYuksekligi: 1.8, metrajYuksekligi: 1.44, elemanYaziYuksekligi: 1.8, hatKalinligi: 1, malzemeYazisi: false, simgeTakimi: '' };
  const BOYUT_ARALIK = { simgeOlcegi: [0.1, 20], hatKalinligi: [0, 5] };
  const simgeTakimiDuzelt = (t) => (String(t || '').trim().toUpperCase() === 'SM' ? 'SM' : '');
  function boyutlarOku(b) {
    if (!b || typeof b !== 'object') return null;
    const r = {};
    for (const [k, d] of Object.entries(BOYUT_VARSAYILAN)) {
      if (typeof d === 'boolean') { r[k] = b[k] === true || b[k] === 'true' || b[k] === 1 || b[k] === '1'; continue; }
      if (typeof d === 'string') { r[k] = simgeTakimiDuzelt(b[k]); continue; }
      const v = typeof b[k] === 'number' ? b[k] : sayi(b[k]);
      const [en, cok] = BOYUT_ARALIK[k] || [0.05, 50];
      r[k] = Number.isFinite(v) && v >= en && v <= cok ? v : d;
    }
    const ayni = (k) => (typeof BOYUT_VARSAYILAN[k] === 'number' ? Math.abs(r[k] - BOYUT_VARSAYILAN[k]) < 1e-9 : r[k] === BOYUT_VARSAYILAN[k]);
    if (Object.keys(r).every(ayni)) return null;
    if (!r.simgeTakimi) delete r.simgeTakimi;   // varsayılan takım dosyaya yazılmaz (eklentiyle aynı)
    return r;
  }

  // ---------------------------------------------------------------- Malzeme yazısı (elemanın malzemeleri çizimde)
  // Eklentideki karşılığı Cekirdek/MalzemeEtiketi.cs (aynı kural); ortak deneme ortak/deneme/malzeme-etiketi.json.

  /** Miktarın yazısı: en çok iki ondalık, ondalık virgül, binlik ayraçsız ("5", "2,5", "1250"). */
  function malzemeMiktari(m) {
    const v = Math.round((Number(m) || 0) * 100) / 100;
    return String(Object.is(v, -0) ? 0 : v).replace('.', ',');
  }

  /** Giriş birimi ("mt/kg" → "mt"); adet (ad) yazılmaz. */
  function girisBirimi(birim) {
    const g = String(birim || '').split('/')[0].trim();
    return !g || g.toLowerCase() === 'ad' ? '' : g;
  }

  /** Tek satır: "AD=MİKTAR[ BİRİM] (DURUM)" — ör. "GT-60=1 (M)", "1x95 ÇELİK ÖRGÜ=5 mt (M)". */
  function malzemeEtiketiSatir(ad, miktar, birim, durum) {
    const b = girisBirimi(birim), d = String(durum || '').trim();
    return ad + '=' + malzemeMiktari(miktar) + (b ? ' ' + b : '') + (d ? ' (' + d + ')' : '');
  }

  /**
   * Elemanın çizimde yazılacak malzeme satırları: kendi pozu (ana) ve miktarı sıfır olan satır yazılmaz; ad görünen
   * yazımla (malzemeYazisi); durum programdaki kodla (satırınki boşsa elemanınki); aynı ad + birim + durum toplanır,
   * sıra ilk görülüşe göre.
   */
  function malzemeEtiketi(eleman) {
    const sira = [], toplam = new Map();
    for (const k of (eleman && eleman.kalemler) || []) {
      if (!k || k.ana || Math.abs(Number(k.miktar) || 0) < 1e-9) continue;
      const ad = malzemeYazisi(k.tanim || '').trim();
      if (!ad) continue;
      const durum = String(k.durum || '').trim() ? k.durum : (eleman.durum || '');
      const birim = girisBirimi(k.birim);
      const anahtar = ad + '\u0001' + birim + '\u0001' + String(durum).trim();
      if (toplam.has(anahtar)) { toplam.get(anahtar).miktar += Number(k.miktar) || 0; continue; }
      toplam.set(anahtar, { ad, birim, durum, miktar: Number(k.miktar) || 0 });
      sira.push(anahtar);
    }
    return sira.map((a) => { const t = toplam.get(a); return malzemeEtiketiSatir(t.ad, t.miktar, t.birim, t.durum); });
  }

  // ---------------------------------------------------------------- Kullanıcılar ve onay ayarı (proje.kullanicilar, proje.onayAyari)
  // Telefondaki kullanıcılar ve roller eklentide de geçerlidir (ortak/katalog/roller.json); proje dosyasıyla iki yönde
  // taşınır. Eklentideki karşılığı Cekirdek/Kullanicilar.cs (aynı kurallar; ortak deneme ortak/deneme/kullanicilar.json).

  /** Kullanıcı kaydı: { id, ad, rol, tuz, ozet, etkin, guncelleme }; kimliksiz kayıt null. */
  function kullaniciOku(o) {
    if (!o || typeof o !== 'object') return null;
    const id = str(o.id).trim();
    if (!id) return null;
    return { id, ad: str(o.ad), rol: str(o.rol), tuz: str(o.tuz), ozet: str(o.ozet), etkin: o.etkin !== false, guncelleme: str(o.guncelleme) };
  }
  function kullanicilarOku(l) {
    const r = [], gorulen = new Set();
    for (const o of Array.isArray(l) ? l : []) { const k = kullaniciOku(o); if (k && !gorulen.has(k.id)) { gorulen.add(k.id); r.push(k); } }
    return r;
  }
  /** Onay mekanizması açık mı: en az bir etkin Yönetici. */
  function onayAcik(kullanicilar) { return kullanicilarOku(kullanicilar).some(k => k.etkin && k.rol === 'yonetici'); }
  /**
   * İki kullanıcı listesini birleştirir (yerel: bu taraftaki, gelen: dosyadaki). İki tarafta olan kullanıcıda güncelleme
   * zamanı yeni olan kazanır (eşitse yerel kalır); yalnız gelende olan eklenir. Kullanıcı silinmez, pasif olur.
   */
  function kullanicilariBirlestir(yerel, gelen) {
    const r = kullanicilarOku(yerel);
    const yer = new Map(r.map((k, i) => [k.id, i]));
    for (const k of kullanicilarOku(gelen)) {
      if (!yer.has(k.id)) { yer.set(k.id, r.length); r.push(k); continue; }
      const i = yer.get(k.id);
      if (k.guncelleme > r[i].guncelleme) r[i] = k;
    }
    return r;
  }
  /** Onay ayarı: { kilit, siki, kapaliHakedisler (yazmaya kapalı hakedişler, artan, tekrarsız), guncelleme }. */
  function onayAyariOku(o) {
    if (!o || typeof o !== 'object') return null;
    const kapali = [...new Set((Array.isArray(o.kapaliHakedisler) ? o.kapaliHakedisler : []).filter(n => typeof n === 'number' && Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
    return { kilit: o.kilit !== false, siki: o.siki !== false, kapaliHakedisler: kapali, guncelleme: str(o.guncelleme) };
  }
  /** Onay ayarlarından güncelleme zamanı yeni olan (eşitse yerel); biri yoksa öteki. */
  function onayAyariBirlestir(yerel, gelen) {
    const a = onayAyariOku(yerel), b = onayAyariOku(gelen);
    if (!a) return b;
    if (!b) return a;
    return b.guncelleme > a.guncelleme ? b : a;
  }

  function yeniProje(o) {
    const a = o || {};
    return {
      bicim: BICIM, surum: SURUM, olusturan: 'Şebeke-M Hakediş (telefon)', olusturma: zaman(),
      proje: {
        ad: a.ad || 'Yeni Proje', kaynak: 'telefon',
        koordinat: { sistem: 'TM', datum: 'ITRF96', dom: Number(a.dom) || 0, eksenler: 'saga = doğu (CAD X), yukari = kuzey (CAD Y)' },
        aktifHakedis: Number(a.hakedis) || 1, katmanOnEki: a.katmanOnEki || 'SC', gisOnEki: a.gisOnEki || a.katmanOnEki || 'SC'
      },
      bolgeler: [], noktalar: [], elemanlar: [], hatlar: [], kanallar: [], sondajlar: []
    };
  }

  function zaman() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const tz = -d.getTimezoneOffset();
    const s = tz >= 0 ? '+' : '-';
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' +
      p(d.getSeconds()) + s + p(Math.floor(Math.abs(tz) / 60)) + ':' + p(Math.abs(tz) % 60);
  }

  const num = (v, d) => { const x = sayi(v); return Number.isFinite(x) ? x : (d === undefined ? 0 : d); };
  const str = v => (v === undefined || v === null ? '' : String(v));
  const mantik = v => (v === true || v === false ? v : v === 'True' || v === 'true' ? true : v === 'False' || v === 'false' ? false : null);
  const koseler = a => (Array.isArray(a) ? a.filter(p => Array.isArray(p) && p.length >= 2).map(p => [num(p[0]), num(p[1])]) : []);

  function kalemOku(o) {
    const k = {
      cins: cinsDuzelt(str(o.cins)), tanim: str(o.tanim), durum: str(o.durum), miktar: num(o.miktar), birim: str(o.birim),
      katsayi: num(o.katsayi, 1), toplam: num(o.toplam), birimFiyat: num(o.birimFiyat), hakedis: Math.round(num(o.hakedis)),
      tarife: str(o.tarife), sira: str(o.sira), kontrol: mantik(o.kontrol), kaynak: str(o.kaynak)
    };
    if (o.aciklama) k.aciklama = str(o.aciklama);
    if (o.dmDurum) k.dmDurum = str(o.dmDurum);
    if (o.ana === true) k.ana = true;
    return k;
  }

  let idSayac = 0;
  /** Yeni nesne kimliği: "T" + zaman + sayaç (AutoCAD tanıtıcıları onaltılıktır, T ile çakışmaz). */
  function yeniId() {
    idSayac = (idSayac + 1) % 1296;
    return 'T' + Date.now().toString(36).toUpperCase() + idSayac.toString(36).toUpperCase().padStart(2, '0');
  }

  /**
   * Proje dosyasını okur ve eksikleri tamamlar. Bilinmeyen alanlar korunur (ör. fotoğraflar, not).
   * Biçim tanınmazsa hata fırlatır.
   */
  function projeOku(girdi) {
    const k = typeof girdi === 'string' ? JSON.parse(girdi.replace(/^﻿/, '')) : girdi;
    if (!k || k.bicim !== BICIM) throw new Error('Bu bir Şebeke-M Hakediş proje dosyası değil.');
    if (num(k.surum) > SURUM) throw new Error('Proje dosyası daha yeni bir sürümle hazırlanmış (' + k.surum + '). Uygulamayı güncelleyin.');
    const pj = k.proje || {};
    const kor = pj.koordinat || {};
    const p = {
      bicim: BICIM, surum: SURUM, olusturan: str(k.olusturan), olusturma: str(k.olusturma),
      proje: Object.assign({}, pj, {
        ad: str(pj.ad), kaynak: str(pj.kaynak),
        koordinat: Object.assign({}, kor, { sistem: str(kor.sistem || 'TM'), datum: str(kor.datum || 'ITRF96'), dom: Math.round(num(kor.dom)) }),
        aktifHakedis: Math.max(1, Math.round(num(pj.aktifHakedis, 1))), katmanOnEki: str(pj.katmanOnEki)
      }),
      bolgeler: [], noktalar: [], elemanlar: [], hatlar: [], kanallar: [], sondajlar: []
    };
    if (!p.proje.gisOnEki) p.proje.gisOnEki = p.proje.katmanOnEki || 'SC';
    const by = boyutlarOku(pj.boyutlar);
    if (by) p.proje.boyutlar = by; else delete p.proje.boyutlar;
    if (Array.isArray(pj.kullanicilar)) p.proje.kullanicilar = kullanicilarOku(pj.kullanicilar); else delete p.proje.kullanicilar;
    const oa = onayAyariOku(pj.onayAyari);
    if (oa) p.proje.onayAyari = oa; else delete p.proje.onayAyari;
    const kimlik = (o, set) => {
      let id = str(o.id);
      if (!id || set.has(id)) id = yeniId();
      set.add(id);
      return id;
    };
    const dizi = ad => (Array.isArray(k[ad]) ? k[ad].filter(x => x && typeof x === 'object') : []);
    let s = new Set();
    for (const o of dizi('bolgeler')) p.bolgeler.push(Object.assign({}, o, { id: kimlik(o, s), ad: str(o.ad), kod: str(o.kod), sinir: koseler(o.sinir) }));
    s = new Set();
    for (const o of dizi('noktalar')) {
      p.noktalar.push(Object.assign({}, o, {
        id: kimlik(o, s), ad: str(o.ad), kod: str(o.kod), saga: num(o.saga), yukari: num(o.yukari), kot: num(o.kot),
        hakedis: Math.round(num(o.hakedis)), bolge: str(o.bolge)
      }));
    }
    s = new Set();
    for (const o of dizi('elemanlar')) {
      p.elemanlar.push(Object.assign({}, o, {
        id: kimlik(o, s), tur: str(o.tur) || cinstenElemanTuru(o.cins), gisId: str(o.gisId), cins: cinsDuzelt(str(o.cins)), tip: str(o.tip),
        durum: str(o.durum), hakedis: Math.round(num(o.hakedis)), bolge: str(o.bolge), saga: num(o.saga), yukari: num(o.yukari),
        kot: num(o.kot), aci: num(o.aci), kontrol: mantik(o.kontrol), katman: str(o.katman), blok: str(o.blok),
        kalemler: (o.kalemler || []).map(kalemOku)
      }));
    }
    s = new Set();
    for (const o of dizi('hatlar')) {
      const kose = koseler(o.kose);
      p.hatlar.push(Object.assign({}, o, {
        id: kimlik(o, s), tur: str(o.tur), anaKesit: str(o.anaKesit), durum: str(o.durum), hakedis: Math.round(num(o.hakedis)),
        bolge: str(o.bolge), kose, cizimUzunlugu: uzunluk(kose), etiket: str(o.etiket), kontrol: mantik(o.kontrol),
        katman: str(o.katman), kalemler: (o.kalemler || []).map(kalemOku)
      }));
    }
    s = new Set();
    for (const o of dizi('kanallar')) {
      const kose = koseler(o.kose);
      const kod = Math.round(num(o.kod));
      p.kanallar.push(Object.assign({}, o, {
        id: kimlik(o, s), kod, kablolar: kanalKablolari(kod), zemin: str(o.zemin), altGenislik: num(o.altGenislik),
        ustGenislik: num(o.ustGenislik), derinlik: num(o.derinlik), basNo: str(o.basNo), bitNo: str(o.bitNo),
        durum: str(o.durum), hakedis: Math.round(num(o.hakedis)), bolge: str(o.bolge), kose, cizimUzunlugu: uzunluk(kose),
        kontrol: mantik(o.kontrol), kalemler: (o.kalemler || []).map(kalemOku)
      }));
    }
    s = new Set();
    for (const o of dizi('sondajlar')) {
      const kose = koseler(o.kose);
      p.sondajlar.push(Object.assign({}, o, {
        id: kimlik(o, s), tip: str(o.tip), durum: str(o.durum), hakedis: Math.round(num(o.hakedis)), bolge: str(o.bolge),
        basNo: str(o.basNo), bitNo: str(o.bitNo), kose, cizimUzunlugu: uzunluk(kose), kontrol: mantik(o.kontrol),
        kalemler: (o.kalemler || []).map(kalemOku)
      }));
    }
    // Teknik hesap sonuçları (Hesap Merkezi; ortak/hesap/BAGLAM.md › Kayıt)
    p.hesaplar = hesaplariOku(dizi('hesaplar'));
    if (Array.isArray(k.uyarilar) && k.uyarilar.length) p.uyarilar = k.uyarilar.map(str);
    return p;
  }

  function hesaplariOku(liste) {
    const out = [], s = new Set();
    for (const o of liste) {
      const id = str(o.id), modul = str(o.modul);
      if (!id || !modul || s.has(id)) continue;
      s.add(id);
      const h = o.hedef && typeof o.hedef === 'object' ? o.hedef : {};
      const md = o.modulDurumu;
      out.push(Object.assign({}, o, {
        id, modul, modulAdi: str(o.modulAdi), ozet: str(o.ozet), durum: str(o.durum) || 'bilgi', tarih: str(o.tarih), kaynak: str(o.kaynak),
        hedef: Object.assign({}, h, { tur: str(h.tur) || 'proje', id: str(h.id), no: str(h.no) }, Array.isArray(h.parcalar) ? { parcalar: h.parcalar.map(str).filter(Boolean) } : {}),
        ayrinti: o.ayrinti && typeof o.ayrinti === 'object' ? o.ayrinti : {},
        modulDurumu: md == null ? '' : typeof md === 'string' ? md : JSON.stringify(md),
        kullanilan: o.kullanilan && typeof o.kullanilan === 'object' ? o.kullanilan : {}
      }));
    }
    return out;
  }

  function hesapYaz(h) {
    return sirala(h, [['id', h.id], ['modul', h.modul], ['modulAdi', h.modulAdi], ['modulSurumu', h.modulSurumu || undefined],
      ['hedef', h.hedef], ['ozet', h.ozet], ['durum', h.durum], ['ayrinti', h.ayrinti || {}], ['modulDurumu', h.modulDurumu || ''],
      ['kullanilan', h.kullanilan || {}], ['tarih', h.tarih], ['kaynak', h.kaynak], ['yapan', h.yapan || undefined], ['telefonId', h.telefonId || undefined]]);
  }

  const r4 = v => temiz(Number(v) || 0, 4);
  const kYaz = kose => (kose || []).map(q => [r4(q[0]), r4(q[1])]);

  function kalemYaz(x) {
    const o = { cins: cinsDuzelt(x.cins), tanim: x.tanim };
    if (x.aciklama) o.aciklama = x.aciklama;
    Object.assign(o, {
      durum: x.durum, miktar: x.miktar, birim: x.birim, katsayi: x.katsayi, toplam: x.toplam, birimFiyat: x.birimFiyat || 0,
      hakedis: x.hakedis, tarife: x.tarife
    });
    if (x.dmDurum) o.dmDurum = x.dmDurum;
    o.sira = x.sira || '';
    o.kontrol = x.kontrol === undefined ? null : x.kontrol;
    if (x.ana) o.ana = true;
    o.kaynak = x.kaynak || '';
    return o;
  }

  /** Bilinen alanlar C# yazıcısının sırasıyla, ardından telefonun eklediği alanlar (foto, not…). */
  function sirala(o, bilinen) {
    const r = {};
    const known = new Set();
    for (const [k, v] of bilinen) {
      known.add(k);
      if (v !== undefined) r[k] = v;
    }
    for (const k of Object.keys(o)) if (!known.has(k) && !k.startsWith('_') && o[k] !== undefined) r[k] = o[k];
    return r;
  }

  /** Proje nesnesini dosya biçimine çevirir (C# ProjeDosyasi.Yaz ile aynı alanlar ve sıra). */
  function projeYaz(p, olusturan, girintili) {
    const pj = p.proje;
    const k = {
      bicim: BICIM, surum: SURUM, olusturan: olusturan || p.olusturan || 'Şebeke-M Hakediş (telefon)', olusturma: zaman(),
      proje: sirala(pj, [['ad', pj.ad], ['kaynak', pj.kaynak],
        ['koordinat', Object.assign({ sistem: 'TM', datum: 'ITRF96', dom: 0 }, pj.koordinat, { eksenler: 'saga = doğu (CAD X), yukari = kuzey (CAD Y)' })],
        ['aktifHakedis', pj.aktifHakedis], ['katmanOnEki', katmanAscii(pj.katmanOnEki)], ['gisOnEki', pj.gisOnEki],
        ['boyutlar', boyutlarOku(pj.boyutlar) || undefined], ['onaylar', pj.onaylar && pj.onaylar.length ? pj.onaylar : undefined],
        ['kullanicilar', Array.isArray(pj.kullanicilar) && pj.kullanicilar.length ? kullanicilarOku(pj.kullanicilar) : undefined],
        ['onayAyari', onayAyariOku(pj.onayAyari) || undefined]]),
      bolgeler: p.bolgeler.map(b => sirala(b, [['id', b.id], ['ad', b.ad], ['kod', b.kod], ['grup', b.grup || undefined], ['aciklama', b.aciklama || undefined], ['sinir', kYaz(b.sinir)]])),
      noktalar: p.noktalar.map(n => sirala(n, [['id', n.id], ['ad', n.ad], ['kod', n.kod], ['saga', r4(n.saga)], ['yukari', r4(n.yukari)],
        ['kot', r4(n.kot)], ['hakedis', n.hakedis], ['bolge', n.bolge], ['ekMetinler', n.ekMetinler && n.ekMetinler.length ? n.ekMetinler : undefined]])),
      elemanlar: p.elemanlar.map(e => sirala(e, [['id', e.id], ['tur', e.tur], ['gisId', e.gisId], ['cins', cinsDuzelt(e.cins)], ['tip', e.tip],
        ['durum', e.durum], ['hakedis', e.hakedis], ['bolge', e.bolge], ['saga', r4(e.saga)], ['yukari', r4(e.yukari)],
        ['kot', e.kot ? r4(e.kot) : undefined], ['aci', temiz(e.aci || 0, 6)], ['guc', e.guc || undefined], ['gerilim', e.gerilim || undefined],
        ['dmDurum', e.dmDurum || undefined], ['kontrol', e.kontrol === undefined ? null : e.kontrol], ['katman', katmanAscii(e.katman)],
        ['blok', e.blok || ''], ['kalemler', (e.kalemler || []).map(kalemYaz)]])),
      hatlar: p.hatlar.map(h => sirala(h, [['id', h.id], ['tur', h.tur], ['anaKesit', h.anaKesit], ['durum', h.durum], ['hakedis', h.hakedis],
        ['bolge', h.bolge], ['cizimUzunlugu', temiz(uzunluk(h.kose), 3)], ['etiket', h.etiket || undefined],
        ['kontrol', h.kontrol === undefined ? null : h.kontrol], ['katman', katmanAscii(h.katman)], ['kose', kYaz(h.kose)],
        ['kalemler', (h.kalemler || []).map(kalemYaz)]])),
      kanallar: p.kanallar.map(c => sirala(c, [['id', c.id], ['kod', c.kod], ['kablolar', kanalKablolari(c.kod)], ['zemin', c.zemin],
        ['altGenislik', c.altGenislik], ['ustGenislik', c.ustGenislik], ['derinlik', c.derinlik], ['basNo', c.basNo || ''],
        ['bitNo', c.bitNo || ''], ['durum', c.durum], ['hakedis', c.hakedis], ['bolge', c.bolge],
        ['cizimUzunlugu', temiz(uzunluk(c.kose), 3)], ['kontrol', c.kontrol === undefined ? null : c.kontrol], ['kose', kYaz(c.kose)],
        ['kalemler', (c.kalemler || []).map(kalemYaz)]])),
      sondajlar: p.sondajlar.map(s => sirala(s, [['id', s.id], ['tip', s.tip], ['durum', s.durum], ['hakedis', s.hakedis],
        ['bolge', s.bolge], ['basNo', s.basNo || ''], ['bitNo', s.bitNo || ''], ['cizimUzunlugu', temiz(uzunluk(s.kose), 3)],
        ['kontrol', s.kontrol === undefined ? null : s.kontrol], ['kose', kYaz(s.kose)], ['kalemler', (s.kalemler || []).map(kalemYaz)]]))
    };
    if (p.hesaplar && p.hesaplar.length) k.hesaplar = p.hesaplar.map(hesapYaz);
    if (p.uyarilar && p.uyarilar.length) k.uyarilar = p.uyarilar.slice();
    return girintili ? JSON.stringify(k, null, 1) : JSON.stringify(k);
  }

  // ---------------------------------------------------------------- Değişiklik günlüğü

  /**
   * Değişiklik kümesini projeye uygular. ops: [{k:'elemanlar', put:{...}}, {k:'hatlar', del:'id'},
   * {k:'proje', set:{...}}]. "Koy" aynı kimlikli nesnenin yerine geçer; işlemler iki kez uygulansa da
   * sonuç değişmez. [indeks] verilirse (Map: kimlik → nesne, koleksiyon başına) güncel tutulur.
   */
  function degisiklikUygula(p, d, indeks) {
    for (const op of (d && d.ops) || []) {
      if (op.k === 'proje') {
        if (op.set) Object.assign(p.proje, op.set);
        continue;
      }
      if (KOLEKSIYONLAR.indexOf(op.k) < 0) continue;
      const list = p[op.k];
      const map = indeks && indeks[op.k];
      if (op.put && op.put.id) {
        const o = op.put;
        if (op.k === 'hatlar' || op.k === 'kanallar' || op.k === 'sondajlar') o.cizimUzunlugu = uzunluk(o.kose);
        if (op.k === 'kanallar') o.kablolar = kanalKablolari(o.kod);
        const old = map ? map.get(o.id) : list.find(x => x.id === o.id);
        if (old) {
          const i = list.indexOf(old);
          if (i >= 0) list[i] = o; else list.push(o);
        } else {
          list.push(o);
        }
        if (map) map.set(o.id, o);
      } else if (op.del) {
        const old = map ? map.get(op.del) : list.find(x => x.id === op.del);
        if (old) {
          const i = list.indexOf(old);
          if (i >= 0) list.splice(i, 1);
        }
        if (map) map.delete(op.del);
      }
    }
    return p;
  }

  function indeksYap(p) {
    const ix = {};
    for (const k of KOLEKSIYONLAR) ix[k] = new Map(p[k].map(o => [o.id, o]));
    return ix;
  }

  // ---------------------------------------------------------------- Durum Tespit raporu

  function kontrolMetni(k) { return k === true ? 'True' : k === false ? 'False' : ''; }

  /**
   * Durum Tespit satırları (C# DurumTespit). Her satır: {handle, proje, cins, tip, durum, birimFiyat,
   * miktar, birim, katsayi, toplam, tutar, hakedis, bolgeTarife, malzemeTarife, dmDurum, index, kontrol, nesne}.
   */
  function durumTespit(p, katsayilar) {
    const k = katsayilar || katsayiHazirla(null);
    const bolge = new Map(p.bolgeler.map(b => [b.id, b]));
    const ad = id => { const b = bolge.get(id); return b ? b.ad : ''; };
    const kod = id => { const b = bolge.get(id); return b ? b.kod : ''; };
    const satirlar = [];
    const satir = (handle, bolgeId, kl, kontrol, nesne, dm) => ({
      handle, proje: ad(bolgeId), cins: kl.cins, tip: kl.tanim, durum: kl.durum, birimFiyat: kl.birimFiyat || 0,
      miktar: kl.miktar, birim: kl.birim, katsayi: kl.katsayi, toplam: kl.toplam, tutar: temiz(kl.toplam * (kl.birimFiyat || 0), 2),
      hakedis: kl.hakedis, bolgeTarife: kod(bolgeId), malzemeTarife: kl.tarife, dmDurum: dm, index: kl.sira, kontrol: kontrolMetni(kontrol), nesne
    });
    const iletkenAc = (h, kl, acilim, adlar, agirlik) => {
      const teller = acilim[String(kl.tanim || '').trim()];
      if (!teller) return;
      for (let i = 0; i < adlar.length; i++) {
        if (!teller[i]) continue;
        const s = satir(h.id, h.bolge, kl, kl.kontrol, 'HAT', '');
        s.cins = 'AL_İLETKENLER';
        s.tip = adlar[i];
        s.miktar = temiz(kl.miktar * teller[i]);
        s.birim = 'mt/kg';
        s.toplam = temiz(kl.miktar * teller[i] * agirlik[i]);
        s.tutar = temiz(s.toplam * (kl.birimFiyat || 0), 2);
        satirlar.push(s);
      }
    };
    for (const e of p.elemanlar) {
      for (const kl of e.kalemler || []) {
        satirlar.push(satir(e.id, e.bolge, kl, kl.ana ? e.kontrol : kl.kontrol, 'ELEMAN', kl.ana && kl.dmDurum ? kl.dmDurum : 'Standart'));
      }
    }
    for (const h of p.hatlar) {
      for (const kl of h.kalemler || []) {
        satirlar.push(satir(h.id, h.bolge, kl, kl.kontrol, 'HAT', 'Standart'));
        if (kl.cins === 'AG_İLETKEN') iletkenAc(h, kl, k.agAcilim, k.agAdlar, k.agAgirlik);
        else if (kl.cins === 'OG_İLETKEN') iletkenAc(h, kl, k.ogAcilim, k.ogAdlar, k.ogAgirlik);
      }
    }
    for (const c of p.kanallar) {
      for (const kl of c.kalemler || []) {
        if (!kl.ana) {
          satirlar.push(satir(c.id, c.bolge, kl, kl.kontrol, 'KANAL', 'Standart'));
          continue;
        }
        const [og, ag] = kanalUnsurlari(kl.tarife);
        const pay = k.kanalPaylasim[kanalKablolari(c.kod)] || [1, 0, 0, 0];
        const tarifeler = [og, ag, k.tarifeAYD, k.tarifeREK];
        for (let i = 0; i < 4; i++) {
          if (!pay[i]) continue;
          const s = satir(c.id, c.bolge, kl, c.kontrol !== null && c.kontrol !== undefined ? c.kontrol : kl.kontrol, 'KANAL', 'Standart');
          s.cins = 'KABLO_KANALI';
          s.tip = c.zemin;
          s.toplam = temiz(kl.toplam * pay[i]);
          s.tutar = temiz(s.toplam * (kl.birimFiyat || 0), 2);
          s.malzemeTarife = tarifeler[i];
          satirlar.push(s);
        }
      }
    }
    for (const s of p.sondajlar) {
      for (const kl of s.kalemler || []) satirlar.push(satir(s.id, s.bolge, kl, kl.kontrol, 'SONDAJ', 'Standart'));
    }
    satirlar.sort((a, b) => ordinal(a.proje, b.proje) || (a.hakedis - b.hakedis) || siraKarsilastir(a.index, b.index));
    return satirlar;
  }

  /** Proje × hakediş × durum × cins × tip × birim toplamları (C# DurumTespit.Ozet). */
  function ozet(satirlar) {
    const map = new Map();
    const liste = [];
    for (const s of satirlar) {
      const key = s.proje + '\u0001' + s.hakedis + '\u0001' + s.durum + '\u0001' + s.cins + '\u0001' + s.tip + '\u0001' + s.birim;
      let o = map.get(key);
      if (!o) {
        o = { proje: s.proje, bolgeTarife: s.bolgeTarife, hakedis: s.hakedis, durum: s.durum, cins: s.cins, tip: s.tip, birim: s.birim, miktar: 0, toplam: 0, tutar: 0, satir: 0 };
        map.set(key, o);
        liste.push(o);
      }
      o.miktar += s.miktar;
      o.toplam += s.toplam;
      o.tutar += s.tutar;
      o.satir++;
    }
    for (const o of liste) {
      o.miktar = temiz(o.miktar);
      o.toplam = temiz(o.toplam);
      o.tutar = temiz(o.tutar, 2);
    }
    liste.sort((a, b) => ordinal(a.proje, b.proje) || (a.hakedis - b.hakedis) || ordinal(a.durum, b.durum) ||
      ordinal(a.cins, b.cins) || ordinal(a.tip, b.tip) || ordinal(a.birim, b.birim));
    return liste;
  }

  // ---------------------------------------------------------------- Kanal listesi (proje bazında)
  // Eklentideki karşılığı: autocad/src/Cekirdek/KanalListesi.cs (aynı alanlar, aynı sıra, aynı yuvarlama); ortak deneme
  // ortak/deneme/kanal-listesi.json.

  /** Projeler ada göre (Türkçe, büyük/küçük harf farkı yok); projesi olmayanlar en sonda. */
  function projeSirasi(a, b) {
    a = a || ''; b = b || '';
    if (!a !== !b) return a ? -1 : 1;
    return a.localeCompare(b, 'tr', { sensitivity: 'accent' });
  }

  /**
   * Proje dosyasındaki kanallardan liste: { satirlar, projeler (en sonda tumu), ozet (proje × zemin × durum) }.
   * opts.proje: yalnız bu proje (bölge adı); opts.hakedis: yalnız bu hakediş.
   */
  function kanalListesi(p, opts) {
    const o = opts || {};
    const bolgeler = new Map();
    for (const b of p.bolgeler || []) if (b.id && !bolgeler.has(b.id)) bolgeler.set(b.id, b);
    const sirali = [];
    (p.kanallar || []).forEach((c, i) => {
      const b = c.bolge ? bolgeler.get(c.bolge) : null;
      const s = {
        proje: b ? b.ad || '' : '', projeKodu: b ? b.kod || '' : '', kimlik: c.id || '', basNo: c.basNo || '', bitNo: c.bitNo || '',
        kablolar: kanalKablolari(c.kod || 0).replace(/^\/+|\/+$/g, ''), zemin: c.zemin || '', cins: '', kaplama: '', bariyerli: false, trencher: false,
        durum: c.durum || '', hakedis: c.hakedis || 0, alt: sayi(c.altGenislik) || 0, ust: sayi(c.ustGenislik) || 0, derinlik: sayi(c.derinlik) || 0,
        uzunluk: 0, hacim: 0
      };
      if (o.proje != null && s.proje !== o.proje) return;
      if (o.hakedis > 0 && s.hakedis !== o.hakedis) return;
      const z = kanalZeminiCoz(s.zemin);
      if (z) {
        s.cins = KANAL_ZEMIN.CINS_ADI[z.cins];
        s.kaplama = kanalOzelMi(z.cins) ? '' : KANAL_ZEMIN.KAPLAMA_ADI[z.kaplama];
        s.bariyerli = z.bariyerli; s.trencher = z.trencher;
      } else s.cins = s.zemin;
      const ana = (c.kalemler || []).find((k) => k.ana);
      if (ana) { s.uzunluk = sayi(ana.miktar) || 0; s.hacim = sayi(ana.toplam) || 0; }
      else {
        s.uzunluk = Math.ceil(Math.max(0, sayi(c.cizimUzunlugu) || 0) - 1e-6);
        s.hacim = kanalHacmi(c.altGenislik, c.ustGenislik, c.derinlik, s.uzunluk);
      }
      s.uzunluk = temiz(s.uzunluk, 2);
      s.hacim = temiz(s.hacim, 3);
      sirali.push([i, s]);
    });
    sirali.sort((x, y) => projeSirasi(x[1].proje, y[1].proje) || (x[1].hakedis - y[1].hakedis) || (x[0] - y[0]));
    const satirlar = sirali.map((x) => x[1]);
    const projeler = [];
    const tumu = { proje: '', projeKodu: '', tumu: true, adet: 0, uzunluk: 0, hacim: 0 };
    const ozet = [], ozetHarita = new Map();
    let son = null;
    for (const s of satirlar) {
      if (!son || son.proje !== s.proje) { son = { proje: s.proje, projeKodu: s.projeKodu, tumu: false, adet: 0, uzunluk: 0, hacim: 0 }; projeler.push(son); }
      son.adet++; son.uzunluk += s.uzunluk; son.hacim += s.hacim;
      tumu.adet++; tumu.uzunluk += s.uzunluk; tumu.hacim += s.hacim;
      const a = s.proje + '\u0001' + s.zemin + '\u0001' + s.durum;
      let x = ozetHarita.get(a);
      if (!x) { x = { proje: s.proje, zemin: s.zemin, durum: s.durum, adet: 0, uzunluk: 0, hacim: 0 }; ozetHarita.set(a, x); ozet.push(x); }
      x.adet++; x.uzunluk += s.uzunluk; x.hacim += s.hacim;
    }
    for (const t of projeler) { t.uzunluk = temiz(t.uzunluk, 2); t.hacim = temiz(t.hacim, 3); }
    tumu.uzunluk = temiz(tumu.uzunluk, 2); tumu.hacim = temiz(tumu.hacim, 3);
    projeler.push(tumu);
    for (const x of ozet) { x.uzunluk = temiz(x.uzunluk, 2); x.hacim = temiz(x.hacim, 3); }
    ozet.sort((x, y) => projeSirasi(x.proje, y.proje) || ordinal(x.zemin, y.zemin) || ordinal(x.durum, y.durum));
    return { cizimAdi: p.ad || '', satirlar, projeler, ozet };
  }

  /** Raporu hakediş ve/veya bölgeye göre süzer (null: hepsi). */
  function satirSuz(satirlar, p, hakedis, bolgeId) {
    const ad = bolgeId ? (p.bolgeler.find(b => b.id === bolgeId) || {}).ad : null;
    return satirlar.filter(s => (!hakedis || s.hakedis === hakedis) && (!bolgeId || s.proje === ad));
  }

  return {
    BICIM, SURUM, DURUMLAR, DURUM_ADI, ELEMAN_TURLERI, HAT_TURLERI, ZEMINLER, KANAL, DOMLAR, KOLEKSIYONLAR,
    elemanTuru, hatTuru, cinstenElemanTuru, cinstenHatTuru, cinsDuzelt, cinsOkunurAd, katmanAscii, ESKI_CINSLER, boyutlarOku, BOYUT_VARSAYILAN,
    malzemeEtiketi, malzemeEtiketiSatir,
    temiz, sayi, tr, ordinal, siraKarsilastir,
    tmIleri, tmGeri, domBoylamdan, domTahmin,
    mesafe, uzunluk, ortaNokta, icinde, alan, dogruParcasinaMesafe, cokgeneMesafe, bolgeSec, kutu, projeKutusu,
    katsayiHazirla, kanalUnsurlari, kanalKodu, kanalKablolari, kanalHacmi, hatMetraji, metrajYazisi, hatEtiketi, malzemeYazisi,
    birlesikMetraj, bmNorm, bmBlok, bmBirim, bmMiktar, bmPoz, bmDogalSira, bmKanalUstu, bmYakinEleman, bmAile, bmKopyaAdi, sutunHarfiBM, sutunNoBM,
    KANAL_ZEMIN, kanalZeminiTanim, kanalZeminiYazi, kanalZeminiCoz, kanalListesi, projeSirasi,
    sonrakiGis, enBuyukSira,
    katalogHazirla, anaTipler, hatKesitleri, malzemeler, kalemYap, kalemToplami, birimler,
    yeniProje, projeOku, projeYaz, yeniId, zaman,
    kullaniciOku, kullanicilarOku, onayAcik, kullanicilariBirlestir, onayAyariOku, onayAyariBirlestir,
    degisiklikUygula, indeksYap,
    kontrolMetni, durumTespit, ozet, satirSuz
  };
});
