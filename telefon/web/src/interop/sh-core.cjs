/*
 * Şebeke Hakediş — telefonun hesap çekirdeği.
 *
 * AutoCAD eklentisindeki C# çekirdeğinin (autocad/src/Cekirdek) karşılığıdır; kurallar aynıdır:
 *  - proje dosyası (.sebeke.json) okuma / yazma (ortak/VERI-MODELI.md)
 *  - bölge seçimi, hat metrajı ve etiketi, kanal kodu ve hacmi, GIS numarası
 *  - Durum Tespit raporu ve özeti (PROMAGIS raporuyla aynı satırlar)
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

  /** Eleman türleri. katman: PROMAGIS katman adındaki tür; gis: GIS numarası biçimi. */
  const ELEMAN_TURLERI = [
    { kod: 'AG_DIREK', ad: 'AG Direk', kisa: 'AG', katman: 'AGDİR', sekil: 'daire', gis: 'direk' },
    { kod: 'MUSTEREK_DIREK', ad: 'Müşterek Direk', kisa: 'Müşterek', katman: 'MÜŞDİR', sekil: 'daire', gis: 'direk' },
    { kod: 'AYD_DIREK', ad: 'Aydınlatma Direği', kisa: 'Aydınlatma', katman: 'AYDDİR', sekil: 'daire', gis: 'direk' },
    { kod: 'ENH_DIREK', ad: 'ENH Direği', kisa: 'ENH', katman: 'ENHDİR', sekil: 'daire', gis: 'direk' },
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
    { kod: 'MUSTEREK', ad: 'Müşterek', katman: 'MÜŞTEREK_HAT' }
  ];

  const ZEMINLER = ['TOPRAK', 'TOPRAK (BARİYERLİ)', 'TUVENAN', 'TUVENAN (BARİYERLİ)', 'PARKE TOPRAK', 'PARKE TUVENAN',
    'PARKE TUVENAN (BARİYERLİ)', 'BRANŞMAN KANAL'];

  const KANAL = { REK: 1, AYD: 2, AG: 4, OG: 8 };

  /** Türkiye'de kullanılan 3° TM dilim orta meridyenleri. */
  const DOMLAR = [27, 30, 33, 36, 39, 42, 45];

  const KOLEKSIYONLAR = ['bolgeler', 'noktalar', 'elemanlar', 'hatlar', 'kanallar', 'sondajlar'];

  function elemanTuru(kod) { return ELEMAN_TURLERI.find(t => t.kod === kod) || ELEMAN_TURLERI[ELEMAN_TURLERI.length - 1]; }
  function hatTuru(kod) { return HAT_TURLERI.find(t => t.kod === kod) || { kod, ad: kod || 'Hat', katman: '' }; }

  /** Malzeme cinsinden eleman türü (PromagisOkuyucu.ElemanTuru ile aynı). */
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
    if (b('KOFRA')) return 'KOFRE';
    return 'DIGER';
  }

  /** Hat kaleminin cinsinden hat türü (katman bilinmiyorsa). */
  function cinstenHatTuru(cins) {
    const c = cins || '';
    const b = p => c.startsWith(p);
    if (b('ALPEK') || b('AG_İLETKEN')) return 'AG_HAVAI';
    if (b('AG_ALİMİNYUM_KABLO') || b('AG_BAKIR_KABLO')) return 'AG_YERALTI';
    if (b('AYDINLATMA')) return 'AYDINLATMA';
    if (b('OG_İLETKEN')) return 'OG_HAVAI';
    if (b('OG_ALİMİNYUM_KABLO')) return 'OG_YERALTI';
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

  /** PROMAGIS yazımı: "OG", "/AG/AYD", "OG/AG/AYD/REK"... */
  function kanalKablolari(kod) {
    let s = '';
    if (kod & KANAL.OG) s += 'OG';
    if (kod & KANAL.AG) s += '/AG';
    if (kod & KANAL.AYD) s += '/AYD';
    if (kod & KANAL.REK) s += '/REK';
    return s;
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
   * Hat etiketi (PROMAGIS yazımı, tanıtıcı olmadan): M "^ kesit/341m", M+M "* kesit/15m",
   * DM ">kesit</42m", DM+M "[kesit]/7m", MEVCUT "(kesit)/40m".
   */
  function hatEtiketi(durum, kesit, metraj) {
    const m = metrajYazisi(metraj) + 'm';
    const k = kesit || '';
    switch (durum) {
      case 'M': return '^ ' + k + '/' + m;
      case 'M+M': return '* ' + k + '/' + m;
      case 'DM': return '>' + k + '</' + m;
      case 'DM+M': return '[' + k + ']/' + m;
      case 'MEVCUT': return '(' + k + ')/' + m;
      default: return k + '/' + m;
    }
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
          tarifeKoy: it.tarifeKoy || '', poz: it.poz || '', kesit: it.kesit || '', onem: Number(it.onem) || 0,
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

  /** Sıralama: çok kullanılan önce, sonra ana listedeki sıra (önem), sonra ad. */
  const onemi = it => (it.onem > 0 ? it.onem : Number.MAX_SAFE_INTEGER);
  const katalogSirasi = (a, b) => b.kullanim - a.kullanim || onemi(a) - onemi(b) || ordinal(a.tanim, b.tanim);

  /** Eleman türünün kendi pozları (direk tipleri vb.): yalnız o türün cinsleri (katalogdaki nesneler listesi). */
  function anaTipler(katalog, tur) {
    let l = katalog.filter(it => it.rol === 'ana' && it.nesneler.has(tur));
    if (!l.length) l = katalog.filter(it => it.rol === 'ana' && cinstenElemanTuru(it.cins) === tur);
    return l.sort(katalogSirasi);
  }

  /** Hat türünün kesitleri (yalnız o türün cinsleri), ardından diğer hat kalemleri. */
  function hatKesitleri(katalog, tur) {
    const nesne = 'HAT_' + tur;
    let l = katalog.filter(it => (it.rol === 'hat' || it.nesneler.has(nesne)) && it.nesneler.has(nesne));
    if (!l.length) l = katalog.filter(it => it.rol === 'hat' && cinstenHatTuru(it.cins) === tur);
    l.sort(katalogSirasi);
    const diger = katalog.filter(it => it.rol === 'hat' && !l.includes(it)).sort(katalogSirasi);
    return l.concat(diger);
  }

  /** Nesneye eklenebilecek malzemeler: önce o nesnede kullanılanlar, sonra diğerleri. */
  function malzemeler(katalog, nesne) {
    return katalog.filter(it => it.rol === 'malzeme' || it.rol === 'hat')
      .sort((a, b) => (b.nesneler.has(nesne) - a.nesneler.has(nesne)) || b.kullanim - a.kullanim || ordinal(a.cins, b.cins) || onemi(a) - onemi(b));
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

  function yeniProje(o) {
    const a = o || {};
    return {
      bicim: BICIM, surum: SURUM, olusturan: 'Şebeke Hakediş (telefon)', olusturma: zaman(),
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
      cins: str(o.cins), tanim: str(o.tanim), durum: str(o.durum), miktar: num(o.miktar), birim: str(o.birim),
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
    if (!k || k.bicim !== BICIM) throw new Error('Bu bir Şebeke Hakediş proje dosyası değil.');
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
        id: kimlik(o, s), tur: str(o.tur) || cinstenElemanTuru(o.cins), gisId: str(o.gisId), cins: str(o.cins), tip: str(o.tip),
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
    if (Array.isArray(k.uyarilar) && k.uyarilar.length) p.uyarilar = k.uyarilar.map(str);
    return p;
  }

  const r4 = v => temiz(Number(v) || 0, 4);
  const kYaz = kose => (kose || []).map(q => [r4(q[0]), r4(q[1])]);

  function kalemYaz(x) {
    const o = { cins: x.cins, tanim: x.tanim };
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
      bicim: BICIM, surum: SURUM, olusturan: olusturan || p.olusturan || 'Şebeke Hakediş (telefon)', olusturma: zaman(),
      proje: sirala(pj, [['ad', pj.ad], ['kaynak', pj.kaynak],
        ['koordinat', Object.assign({ sistem: 'TM', datum: 'ITRF96', dom: 0 }, pj.koordinat, { eksenler: 'saga = doğu (CAD X), yukari = kuzey (CAD Y)' })],
        ['aktifHakedis', pj.aktifHakedis], ['katmanOnEki', pj.katmanOnEki], ['gisOnEki', pj.gisOnEki]]),
      bolgeler: p.bolgeler.map(b => sirala(b, [['id', b.id], ['ad', b.ad], ['kod', b.kod], ['aciklama', b.aciklama || undefined], ['sinir', kYaz(b.sinir)]])),
      noktalar: p.noktalar.map(n => sirala(n, [['id', n.id], ['ad', n.ad], ['kod', n.kod], ['saga', r4(n.saga)], ['yukari', r4(n.yukari)],
        ['kot', r4(n.kot)], ['hakedis', n.hakedis], ['bolge', n.bolge], ['ekMetinler', n.ekMetinler && n.ekMetinler.length ? n.ekMetinler : undefined]])),
      elemanlar: p.elemanlar.map(e => sirala(e, [['id', e.id], ['tur', e.tur], ['gisId', e.gisId], ['cins', e.cins], ['tip', e.tip],
        ['durum', e.durum], ['hakedis', e.hakedis], ['bolge', e.bolge], ['saga', r4(e.saga)], ['yukari', r4(e.yukari)],
        ['kot', e.kot ? r4(e.kot) : undefined], ['aci', temiz(e.aci || 0, 6)], ['guc', e.guc || undefined], ['gerilim', e.gerilim || undefined],
        ['dmDurum', e.dmDurum || undefined], ['kontrol', e.kontrol === undefined ? null : e.kontrol], ['katman', e.katman || ''],
        ['blok', e.blok || ''], ['kalemler', (e.kalemler || []).map(kalemYaz)]])),
      hatlar: p.hatlar.map(h => sirala(h, [['id', h.id], ['tur', h.tur], ['anaKesit', h.anaKesit], ['durum', h.durum], ['hakedis', h.hakedis],
        ['bolge', h.bolge], ['cizimUzunlugu', temiz(uzunluk(h.kose), 3)], ['etiket', h.etiket || undefined],
        ['kontrol', h.kontrol === undefined ? null : h.kontrol], ['katman', h.katman || ''], ['kose', kYaz(h.kose)],
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

  /** Raporu hakediş ve/veya bölgeye göre süzer (null: hepsi). */
  function satirSuz(satirlar, p, hakedis, bolgeId) {
    const ad = bolgeId ? (p.bolgeler.find(b => b.id === bolgeId) || {}).ad : null;
    return satirlar.filter(s => (!hakedis || s.hakedis === hakedis) && (!bolgeId || s.proje === ad));
  }

  return {
    BICIM, SURUM, DURUMLAR, DURUM_ADI, ELEMAN_TURLERI, HAT_TURLERI, ZEMINLER, KANAL, DOMLAR, KOLEKSIYONLAR,
    elemanTuru, hatTuru, cinstenElemanTuru, cinstenHatTuru,
    temiz, sayi, tr, ordinal, siraKarsilastir,
    tmIleri, tmGeri, domBoylamdan, domTahmin,
    mesafe, uzunluk, ortaNokta, icinde, alan, dogruParcasinaMesafe, cokgeneMesafe, bolgeSec, kutu, projeKutusu,
    katsayiHazirla, kanalUnsurlari, kanalKodu, kanalKablolari, kanalHacmi, hatMetraji, metrajYazisi, hatEtiketi,
    sonrakiGis, enBuyukSira,
    katalogHazirla, anaTipler, hatKesitleri, malzemeler, kalemYap, kalemToplami, birimler,
    yeniProje, projeOku, projeYaz, yeniId, zaman,
    degisiklikUygula, indeksYap,
    kontrolMetni, durumTespit, ozet, satirSuz
  };
});
