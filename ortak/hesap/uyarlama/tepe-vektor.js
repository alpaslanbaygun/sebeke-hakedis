/* Şebeke-M uyarlaması: Cer Vektör Çizimi — Tepe Kuvveti Hesabı (tepe-vektor). Hesap kodlarına ve tablolarına
   dokunmaz; yalnız aracın giriş alanlarına ve hat listesine (hatlar) yazar, aracın kendi işlevlerini (buildRows,
   hesapla, bölge / direk düğmeleri) çağırır ve sonuçları aracın son hesap değişkenlerinden (lastR, lastRx, lastRy,
   lastAci, lastVecs) okur.
   - Satırlar direğin kollarından kurulur. İletken adı aracın İLETKENLER listesindeki satıra birebir eşlenir
     (OG ENH hattında "ENH", müşterek hatta OG "Müşt." ve AG "(x0,81)" satırı). Birebir karşılığı olmayan iletken
     "Boş Hat" olarak kendi açısıyla eklenir ve eksik işaretlenir.
   - Müşterek direkte OG ve AG ayrı satır girilir: aracın birleşik satırlarında (ör. 3x1/0 AWG+…AER) bir satır kayması
     vardır; ayrı satırların toplamı doğru birleşik satırlarla aynıdır.
   - Açılar, ana hat (doğrusal iki kol ya da en uzun açıklık) 0°–180° ekseninde olacak şekilde döndürülür: kafes
     direkte |Rx|+|Ry| eksen doğrultusuna bağlıdır. Beton ve A tipinde bileşke büyüklüğü dönmeden etkilenmez.
   - Yazdırma: telefonda yazdırma bitince aracın beklediği 'afterprint' olayı gelmez; ekran çizimine dönüş sağlanır.
   - Çizim (canvas) yalnız ekranda Şebeke-M laciverdine boyanır; yazdırmada aracın beyaz çizimi kalır.
   - Önerilen direk tipi (8.11.2026): aracın hat satırlarından (kuvvet + açı) eski TEDAŞ tepe kuvveti aracının seçim
     kuralıyla (ortak/hesap/kurallar.mjs › direkOner: sağlam + kopma senaryoları, boyuna / enine / B30 tablosu) önerilen
     tip hesaplanır; sonuç kartının altında gösterilir ve kayda yazılır. Aracın formülleri değişmez. */
(function () {
  'use strict';
  var BOLGE = ['1B', '2B', '3B', '4B'];
  var DIREK = ['atip', 'beton', 'kafes'];
  var DIREK_AD = { atip: 'A tipi demir direk', beton: 'Beton direk', kafes: 'Kafes demir direk' };
  // OG çıplak iletken: ENH (tam çekili OG hattı) ve müşterek hattaki OG satırları
  var YG = {
    SWALLOW: { enh: '3x3AWG ENH', mus: '3x3AWG Müşt.' },
    RAVEN: { enh: '3X1/0 AWG ENH', mus: '3x1/0 AWG Müşt.' },
    PIGEON: { enh: '3X3/0 AWG ENH', mus: '3x3/0 AWG Müş.' },
    PARTRIDGE: { enh: '3x266 MCM ENH', mus: '3x266 MCM Müş.' },
    HAWK: { enh: '3x477 MCM ENH', mus: '3x477 MCM Müş.' }
  };
  // AG çıplak tertipler: satır adı → iletken bileşimi (TEDAŞ yazımı: 3P+R/P = 3 Pansy faz + Rose aydınlatma + Pansy nötr)
  var AAC = [
    ['2R', { ROSE: 2 }], ['3R', { ROSE: 3 }], ['4R', { ROSE: 4 }], ['5R', { ROSE: 5 }],
    ['3P+R/P', { PANSY: 4, ROSE: 1 }], ['3Po+R/P', { POPPY: 3, ROSE: 1, PANSY: 1 }],
    ['3A+R/P', { ASTER: 3, ROSE: 1, PANSY: 1 }], ['3O+R/A', { OXLIP: 3, ROSE: 1, ASTER: 1 }]
  ];
  var TEL_AD = { ROSE: 'Rose', LILY: 'Lily', IRIS: 'Iris', PANSY: 'Pansy', POPPY: 'Poppy', ASTER: 'Aster', PHLOX: 'Phlox', OXLIP: 'Oxlip' };
  // Aracın tablosunda bir satır kaymış birleşik müşterek + AER satırları (kullanıcı elle seçerse uyarılır)
  var KAYIK = /^(3x1\/0 AWG|3x3\/0 AWG|3x266 MCM|3x477 MCM)\+.*AER$/;

  var son = { ofset: 0, anaKol: '', konum: null, rol: null, tip: '' };   // son doldurmadaki döndürme (kuzeyden ana hat yönü, °), direk bilgisi

  function el(id) { return document.getElementById(id); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function n360(x) { var a = ((x % 360) + 360) % 360; return a >= 359.995 ? 0 : a; }
  function aciFark(a, b) { var f = n360(a - b); return f > 180 ? 360 - f : f; }   // 0..180
  function sayiMi(v) { return v !== null && v !== undefined && v !== '' && isFinite(+v); }
  function varMi(k) { return Object.prototype.hasOwnProperty.call(ILETKENLER, k); }
  function yeraltiMi(ht) { return /YERALTI/.test(String(ht || '')); }
  function bilesim(c) {
    if (!c || !c.tel || !c.fazSayisi) return null;
    var b = {};
    b[c.tel] = (b[c.tel] || 0) + c.fazSayisi;
    if (c.notr && typeof c.notr === 'string') b[c.notr] = (b[c.notr] || 0) + 1;
    return b;
  }
  function ayni(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(function (k) { return a[k] === b[k]; });
  }
  function bilesimYazi(b) { return Object.keys(b).map(function (k) { return b[k] + ' ' + (TEL_AD[k] || k); }).join(' + '); }
  function duz(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ''); }

  /** Bir iletkenin aracın İLETKENLER satırı: { anahtar } ya da { neden }. konum: 'ag' | 'mus' | null (belirsiz). */
  function satirAdi(il, kol, konum, A) {
    var c = A.iletken(il.ad);
    var ht = kol.hatTur || '';
    if (c.aile === 'ACSR') {
      var y = YG[c.tel];
      if (!y) return { neden: 'araçta ' + (c.tel || 'bu iletken') + ' için satır yok' };
      if (c.fazSayisi !== 3) return { neden: 'araçta yalnız 3 iletkenli OG satırları var' };
      if (ht === 'MUSTEREK') return { anahtar: y.mus };
      if (ht === 'OG_HAVAI') return { anahtar: y.enh };
      return { neden: 'hat türü bilinmiyor (ENH mi müşterek mi)' };
    }
    if (c.aile !== 'AAC' && c.aile !== 'ABC') {
      // TEDAŞ yazımıyla verilmiş AG tertibi (ör. "3P+R/P"): aracın satır adıyla birebir
      var dz = duz(il.ad), d0 = AAC.filter(function (x) { return duz(x[0]) === dz; })[0];
      if (!d0) return { neden: c.aile ? 'yeraltı kablosu ya da tanınmayan iletken (' + c.aile + ')' : 'iletken adı tanınmadı' };
      c = { aile: 'AAC', dogrudan: d0[0] };
    }
    if (!konum) return { neden: 'direğin AG mi müşterek mi olduğu belli değil' };
    if (c.aile === 'AAC') {
      var ad = c.dogrudan || null;
      if (!ad) {
        var b = bilesim(c);
        var x = b ? AAC.filter(function (t) { return ayni(t[1], b); })[0] : null;
        if (!x) return { neden: 'araçta ' + (b ? bilesimYazi(b) : 'bu') + ' tertibi yok' };
        ad = x[0];
      }
      var k = konum === 'mus' ? ad + ' (x0,81)' : ad;
      return varMi(k) ? { anahtar: k } : { neden: 'araçta "' + k + '" satırı yok' };
    }
    // ABC (AER / ALPEK)
    if (!c.fazSayisi || !c.kesit || !c.notr) return { neden: 'kablo kesiti okunamadı' };
    if (c.fazSayisi === 1 && c.kesit === 16 && c.aydinlatma === 16 && c.notr === 25) {
      if (konum === 'mus') return { neden: 'araçta müşterek direk için 1x16/16+25 AER satırı yok' };
      if (!(+kol.aciklik > 0)) return { neden: 'araçtaki 1x16/16+25 AER satırı yalnız 36 m\'ye kadar açıklık içindir; açıklık bilinmiyor' };
      if (+kol.aciklik > 36) return { neden: 'araçtaki 1x16/16+25 AER satırı yalnız 36 m\'ye kadar açıklık içindir (' + kol.aciklik + ' m)' };
      return { anahtar: '1x16/16+25 AER (a<=36m)' };
    }
    if (!c.aydinlatma) return { neden: 'araçta aydınlatma damarsız AER satırı yok' };
    var a = c.fazSayisi + 'x' + c.kesit + '/' + c.aydinlatma + '+' + c.notr + ' AER' + (konum === 'mus' ? '(x0,81)' : '');
    return varMi(a) ? { anahtar: a } : { neden: 'araçta "' + a + '" satırı yok' };
  }

  /** Direk tipinden hesap yöntemi: { tip, kesin } (tip: atip | beton | kafes | null) */
  function direkTipi(d) {
    var t = String(d.tip || ''), T = t.toUpperCase().replace(/İ/g, 'I');
    var aTipi = /(^|[^0-9])(8|10|12)\s*[IU](?![A-Z0-9])/.test(T);
    var kafes = /(^|[^A-Z])K\s*[1-5](?![0-9])/.test(T) || /^G-?[TDNZ]-?\d/.test(T) || /^G-?T\d{2}/.test(T) || /\((SW|3 ?AWG|1\/0)\)/.test(T);
    var beton = /^\d{1,2}([.,]\d+)?\s*\/\s*\d/.test(T);
    if (d.malzeme === 'beton') return { tip: 'beton', kesin: true };
    if (d.malzeme === 'agac') return { tip: null, neden: 'Ağaç direk için araçta hesap yöntemi yok' };
    if (d.malzeme === 'demir') {
      if (aTipi) return { tip: 'atip', kesin: true, tipten: true };
      if (kafes) return { tip: 'kafes', kesin: true, tipten: true };
      return { tip: 'kafes', kesin: false };
    }
    if (beton) return { tip: 'beton', kesin: true, tipten: true, malzemesiz: true };
    if (aTipi) return { tip: 'atip', kesin: true, tipten: true, malzemesiz: true };
    if (kafes) return { tip: 'kafes', kesin: true, tipten: true, malzemesiz: true };
    return { tip: null, neden: 'Direğin malzemesi ve tipi projede yok' };
  }

  /** Ana hat: doğrusal (sapması ≤ 10°) iki kol varsa bunların uzun olanı, yoksa en uzun açıklıklı kol. */
  function anaKol(liste) {
    var cift = null, i, j;
    for (i = 0; i < liste.length; i++) for (j = i + 1; j < liste.length; j++) {
      var sapma = 180 - aciFark(liste[i].kol.yon, liste[j].kol.yon);
      var top = (+liste[i].kol.aciklik || 0) + (+liste[j].kol.aciklik || 0);
      if (sapma <= 10 && (!cift || sapma < cift.sapma - 1e-9 || (Math.abs(sapma - cift.sapma) <= 1e-9 && top > cift.top))) cift = { a: liste[i], b: liste[j], sapma: sapma, top: top };
    }
    if (cift) return { x: (+cift.b.kol.aciklik || 0) > (+cift.a.kol.aciklik || 0) ? cift.b : cift.a, neden: 'dogrusal' };
    var uzun = null;
    liste.forEach(function (x) { if (+x.kol.aciklik > 0 && (!uzun || +x.kol.aciklik > +uzun.kol.aciklik)) uzun = x; });
    if (uzun) return { x: uzun, neden: 'uzun' };
    return liste.length ? { x: liste[0], neden: 'ilk' } : null;
  }

  function barSec(kap, ad) {
    var i = (kap === '.bolge-bar' ? BOLGE : DIREK).indexOf(ad);
    var b = i >= 0 ? document.querySelectorAll(kap + ' .bar-btn')[i] : null;
    if (b) b.click();   // aracın kendi setBolge / setDirek işlevi (düğmenin onclick'i)
    return !!b;
  }
  function metinYaz(id, v) { var e = el(id); if (e) e.value = v == null ? '' : String(v); }
  function satirlariYaz(liste) {
    hatlar.splice.apply(hatlar, [0, hatlar.length].concat(liste.map(function (h) { return { iletken: String(h.iletken), derece: +h.derece || 0 }; })));
    if (!hatlar.length) hatlar.push({ iletken: 'Boş Hat', derece: 0 });
    buildRows();
  }

  // Düğme gruplarında değişiklik "change" olayı da üretsin (köprü eksik alanın girildiğini bunu dinleyerek anlar)
  ['.bolge-bar', '.direk-bar'].forEach(function (s) {
    var k = document.querySelector(s);
    if (k) k.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.bar-btn')) setTimeout(function () { try { k.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) { /* */ } }, 0);
    });
  });

  // Telefonda yazdırma bitince 'afterprint' gelmez: araç yazdırma kipinde (beyaz, büyük tuval) kalmasın
  var asilYazdir = window.print;
  window.print = function () {
    try { return asilYazdir.apply(window, arguments); }
    finally {
      setTimeout(function () {
        try { if (isPrintMode) window.dispatchEvent(new Event('afterprint')); } catch (x) { /* */ }
      }, 0);
    }
  };

  // Ekranda çizim renkleri (yalnız arka plan, ızgara ve yazılar; hat renkleri aracın kendi renkleri)
  (function () {
    var cv = el('vecCanvas');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!ctx) return;
    var RENK = {
      '#161b22': '#0e1730',
      'rgba(255,255,255,.04)': 'rgba(148,163,184,.12)', 'rgba(255,255,255,.1)': 'rgba(148,163,184,.30)',
      'rgba(255,255,255,.2)': 'rgba(148,163,184,.55)', 'rgba(255,255,255,.08)': 'rgba(148,163,184,.22)',
      'rgba(139,148,158,.5)': 'rgba(148,163,184,.85)', 'rgba(255,255,255,0.2)': 'rgba(148,163,184,.45)',
      'rgba(255,255,255,0.5)': 'rgba(218,226,253,.75)', 'rgba(0,212,170,.4)': 'rgba(245,158,11,.85)'
    };
    var ekranda = function () {
      if (isPrintMode || !document.documentElement.classList.contains('sm-var')) return false;
      try { return !(window.matchMedia && window.matchMedia('print').matches); } catch (e) { return true; }
    };
    var P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    ['fillStyle', 'strokeStyle'].forEach(function (ad) {
      var t = P && Object.getOwnPropertyDescriptor(P, ad);
      if (!t || !t.set) return;
      try {
        Object.defineProperty(ctx, ad, {
          configurable: true,
          get: function () { return t.get.call(this); },
          set: function (v) {
            var yeni = (typeof v === 'string' && ekranda()) ? RENK[v.toLowerCase()] : null;
            t.set.call(this, yeni || v);
          }
        });
      } catch (x) { /* */ }
    });
    // tarayıcı yazdırma önizlemesi (aracın Yazdır düğmesi dışında): yazdırma ortamına geçince ve dönünce yenilenir
    var yenile = function () { try { if (!isPrintMode) hesapla(); } catch (e) { /* */ } };
    try { if (window.matchMedia) window.matchMedia('print').addEventListener('change', yenile); } catch (e) { /* */ }
    yenile();   // aracın açılış çizimi bu renklerden önce yapıldı: yeniden çizilir
  })();

  /** Önerilen direk tipi (TEDAŞ tablosu): aracın son hat satırlarından; hesap yoksa null. */
  function oneri(A) {
    if (!A || !A.direkOner || typeof lastVecs === 'undefined' || !lastVecs) return null;
    var vek = lastVecs.map(function (v, i) { return { guc: v.guc, derece: v.derece, ad: 'Hat ' + (i + 1) + (hatlar[i] && hatlar[i].iletken ? ' (' + hatlar[i].iletken + ')' : '') }; });
    return A.direkOner({ konum: son.konum, rol: son.rol, vektorler: vek, mevcutTip: son.tip });
  }
  function oneriKutusu() {
    var k = el('sm-oneri');
    if (k) return k;
    var kart = el('sonuc-kart');
    if (!kart || !kart.parentNode) return null;
    k = document.createElement('div');
    k.id = 'sm-oneri';
    k.className = 'sonuc';
    k.style.cssText = 'margin-top:10px;padding:10px 14px;font-size:13px;line-height:1.5';
    kart.parentNode.insertBefore(k, kart.nextSibling);
    return k;
  }
  function oneriYaz() {
    var A = window.__SM && window.__SM.A;
    var k = oneriKutusu();
    if (!k) return;
    var on = oneri(A);
    if (!on) { k.style.display = 'none'; return; }
    k.style.display = '';
    var html = '<div style="font-weight:700;margin-bottom:4px">Önerilen direk tipi (TEDAŞ tepe kuvveti tablosu): <span style="font-size:16px">' +
      (on.tip || (on.tablo ? '—' : 'tablo yok (AG / müşterek değil)')) + '</span></div>' +
      '<div>Boyuna L<sub>max</sub> = ' + A.tr(on.maxL, 1) + ' kg · Enine R<sub>max</sub> = ' + A.tr(on.maxR, 1) + ' kg · B30 = ' + A.tr(on.B30, 1) + ' kg · en kötü: ' + on.senaryo + '</div>' +
      '<div style="opacity:.85">' + (on.trafoDirek ? 'Trafo direği olsaydı: ' + on.trafoDirek + ' · ' : '') + 'Ağaç direk: ' + on.agacDirek +
      (on.karsilastirma && on.karsilastirma.durum !== 'bilinmiyor' ? ' · Projedeki ' + on.karsilastirma.mevcut + ' tabloya göre <b>' + on.karsilastirma.durum + '</b>' : '') + '</div>';
    k.innerHTML = html;
  }
  // Aracın hesapla()'sı her değişiklikte çağrılır: öneri kutusu da onunla yenilenir (aracın kodu değişmez)
  var asilHesapla = window.hesapla;
  if (typeof asilHesapla === 'function') {
    window.hesapla = function () {
      var r = asilHesapla.apply(this, arguments);
      try { oneriYaz(); } catch (e) { /* */ }
      return r;
    };
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Hesap tek bir yükleme durumudur: bütün hatların en büyük çekme kuvvetleri (buz bölgesine göre tablo değeri) aynı anda etkir. Tek yanlı zayıflama (kopma), rüzgâr yükü ve açıklık hesaba girmez.',
      'Beton ve A tipi direkte bileşke R = √(Rx² + Ry²), kafes direkte R = |Rx| + |Ry| alınır. Kafes sonucu eksenlerin doğrultusuna bağlıdır; Şebeke-M açıları ana hat 0°–180° ekseninde olacak şekilde döndürür. A tipi direkte kuvvetli / zayıf eksen ayrımı yapılmaz.',
      'Araç direk tipi seçmez; "Seçilen direk" yalnız çıktıda görünür. Önerilen direk tipi Şebeke-M\'nin eklediği ayrı bir değerlendirmedir: eski TEDAŞ tepe kuvveti aracının tablosu (AG: 9-H, 10I, 10U, 12I, K1–K5; müşterek: 10I\'\'…K5\'\'; trafo direği T-15…T-50; ağaç 9O / 9A) sağlam durum ve her hattın tek tek kopması (kopan hattın kuvveti sıfır; taşıyıcı direkte kopma alınmaz) senaryolarının en büyük boyuna (L), enine (R) ve L + R (B30) değerleriyle okunur. Potans yükü alınmaz; eksenler ana hat doğrultusuna göredir.',
      'Araç tablosunda 3x1/0 AWG, 3x3/0 AWG, 266 MCM ve 477 MCM müşterek + AER birleşik satırları bir satır kaymıştır (ör. "3x1/0 AWG+3x50/16+70 AER" 1. bölgede 662,34 kg; olması gereken 411 + 300,7 = 711,7 kg). Şebeke-M bu yüzden müşterek hatta OG ve AG\'yi ayrı satır girer; bu birleşik satırları elle seçmeyin.',
      'Yazarla doğrulanması gereken tablo değerleri: 1x16/16+25 AER (a≤36 m) 2./3. bölge 112,8 / 149,3 kg (diğer TEDAŞ tablosunda 118,42 / 153); 3x35/16+50 AER 1. bölge 310,3 kg (diğerinde 301,3); müşterek 266 MCM+5R 3. bölge 1687,35 kg (kitapta 1587); 477 MCM+3R 3. bölge 1857,21 kg (kitapta 1897).',
      'Araçta birebir karşılığı olmayan tertipler (ör. telefon kataloğundaki 3P+R = 3 Pansy + 1 Rose, 3P+P, 3Po+P, 3A+P; aydınlatma damarsız 3x50+70 AER; 2x16+25 ve 4x16+25 AER) "Boş Hat" olarak açısıyla eklenir; satırı listeden siz seçersiniz.',
      'Ağaç direk için araçta hesap yöntemi yoktur. Buz yükü 5. bölge araçta yoktur (1B–4B).'
    ],
    hazir: function () { return typeof hesapla === 'function' && typeof buildRows === 'function' && !!el('hatblock0'); },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
      var d = b.direk || null;
      var dol = function (alan, deger, birim, yol, ham, kaynak) { r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' }); };

      // ---- direk bilgileri (çıktı yazıları)
      metinYaz('trafo-adi', ''); metinYaz('trafo-kolu', ''); metinYaz('direk-no', ''); metinYaz('direk-input', ''); metinYaz('direk-input-tesis', '');
      if (b.trafo && b.trafo.no) { metinYaz('trafo-adi', b.trafo.no); dol('Trafo adı', String(b.trafo.no), '', 'trafo.no', b.trafo.no); }
      if (d && d.no != null && d.no !== '') { metinYaz('direk-no', d.no); dol('Direk numarası', String(d.no), '', 'direk.no', d.no); }
      if (d && d.tip) { metinYaz('direk-input', d.tip); metinYaz('direk-input-tesis', d.tip); dol('Seçilen direk', d.tip, '', 'direk.tip', d.tip); }

      // ---- buz yükü bölgesi
      var bz = b.proje ? b.proje.buzBolgesi : null;
      if (sayiMi(bz) && +bz >= 1 && +bz <= 4) {
        barSec('.bolge-bar', BOLGE[+bz - 1]);
        dol('Buz yükü bölgesi', BOLGE[+bz - 1], '', 'proje.buzBolgesi', bz);
      } else {
        r.eksik.push({ alan: 'Buz yükü bölgesi', sec: '.bolge-bar', neden: sayiMi(bz) ? bz + '. bölge araçta yok (1B–4B); uygun bölgeyi seçin' : 'Projede buz bölgesi yok; seçin' });
      }

      // ---- direk tipi (hesap yöntemi)
      if (d) {
        var dt = direkTipi(d);
        if (dt.tip) {
          barSec('.direk-bar', dt.tip);
          if (d.malzeme) dol('Direk malzemesi', d.malzeme, '', 'direk.malzeme', d.malzeme, DIREK_AD[dt.tip]);
          if (!dt.kesin) r.eksik.push({ alan: 'Direk tipi (hesap yöntemi)', sec: '.direk-bar', neden: 'Demir direğin A tipi mi kafes mi olduğu tipinden anlaşılamadı; kafes kabul edildi, A tipi ise değiştirin' });
          else if (dt.malzemesiz) r.uyari.push('Direğin malzemesi projede yok; hesap yöntemi direk tipinden (' + d.tip + ') alındı: ' + DIREK_AD[dt.tip] + '.');
        } else {
          r.eksik.push({ alan: 'Direk tipi (hesap yöntemi)', sec: '.direk-bar', neden: dt.neden + '; A tipi / beton / kafes seçin' });
        }
      } else {
        r.eksik.push({ alan: 'Direk tipi (hesap yöntemi)', sec: '.direk-bar', neden: 'Hedef bir direk değil; seçin' });
      }

      // ---- hat satırları (kollar)
      var kollar = d && Array.isArray(d.kollar) ? d.kollar : [];
      var liste = [], yeralti = 0;
      kollar.forEach(function (kol, i) {
        if (!kol) return;
        if (yeraltiMi(kol.hatTur)) { yeralti++; return; }
        if (!sayiMi(kol.yon)) { r.eksik.push({ alan: 'Kol ' + (i + 1) + ' yönü', sec: '#hat-rows', neden: 'Projede açıklığın yönü yok; hattı açısıyla elle ekleyin' }); return; }
        liste.push({ kol: kol, i: i });
      });
      if (yeralti) r.uyari.push(yeralti + ' yeraltı kablo çıkışı direk tepesine çekme kuvveti vermediği için hesaba alınmadı.');
      var ana = anaKol(liste), ofset = ana ? +ana.x.kol.yon : 0;
      son = { ofset: ofset, anaKol: ana ? 'Kol ' + (ana.x.i + 1) : '' };
      if (ana && ofset) {
        r.uyari.push('Açılar ana hat doğrultusuna göre döndürüldü: ' + (ana.neden === 'dogrusal' ? 'doğrusal giden hattın ' : ana.neden === 'uzun' ? 'en uzun açıklıklı ' : 'ilk ') +
          'kolu (Kol ' + (ana.x.i + 1) + ', kuzeyden ' + A.tr(ofset, 2) + '°) 0° alındı. Kafes direkte |Rx|+|Ry| bu eksene göredir; kuzey yönü hesapta ' + A.tr(r2(n360(-ofset)), 2) + '°.');
        if (ana.neden === 'ilk') r.uyari.push('Ana hat açıklıklardan belirlenemedi (açıklık yok); 1. kol esas alındı.');
      }
      var musterek = !!(d && (d.tur === 'MUSTEREK' || kollar.some(function (k) { return k && k.hatTur === 'MUSTEREK'; })));
      var ogVar = kollar.some(function (k) { return k && !yeraltiMi(k.hatTur) && (k.iletkenler || []).some(function (il) { return il && (il.devre === 'OG' || A.iletken(il.ad).devre === 'OG'); }); });
      var konum = musterek ? 'mus' : (ogVar ? null : 'ag');
      son.konum = konum; son.rol = d && d.rol ? String(d.rol).toUpperCase() : null; son.tip = d && d.tip ? String(d.tip) : '';
      if (d && d.tur) dol('Direk türü', d.tur, '', 'direk.tur', d.tur);
      if (d && d.rol) dol('Direk görevi', d.rol, '', 'direk.rol', d.rol, d.rol === 'T' ? 'taşıyıcı: kopma senaryosu alınmaz' : 'kopma senaryoları alınır');
      if (musterek) r.uyari.push('Müşterek direk: OG iletkenleri "Müşt.", AG iletkenleri "(x0,81)" satırlarıyla ayrı satır olarak girildi (aracın birleşik satırlarındaki kayma hatası kullanılmadı).');

      var satir = [];
      liste.forEach(function (x) {
        var kol = x.kol, i = x.i, der = r2(n360(+kol.yon - ofset));
        var kullanildi = false;
        (kol.iletkenler || []).forEach(function (il, j) {
          if (!il || !il.ad) return;
          var s = satirAdi(il, kol, konum, A);
          var adet = sayiMi(il.adet) && +il.adet >= 1 ? Math.round(+il.adet) : 1;
          for (var n = 0; n < adet; n++) satir.push({ iletken: s.anahtar || 'Boş Hat', derece: der, kol: i, j: j, il: il, neden: s.neden, ilk: n === 0 });
          dol('Kol ' + (i + 1) + ' iletkeni', s.anahtar || 'araçta karşılığı yok', '', 'direk.kollar[' + i + '].iletkenler[' + j + '].ad', il.ad, il.ad);
          if (sayiMi(il.adet)) dol('Kol ' + (i + 1) + ' devre sayısı', adet, '', 'direk.kollar[' + i + '].iletkenler[' + j + '].adet', il.adet);
          kullanildi = true;
        });
        if (!kullanildi) { r.eksik.push({ alan: 'Kol ' + (i + 1) + ' iletkeni', sec: '#hat-rows', neden: 'Projede bu açıklığın iletkeni yok; hattı açısıyla (' + A.tr(der, 2) + '°) elle ekleyin' }); return; }
        dol('Kol ' + (i + 1) + ' yönü (kuzeyden)', +kol.yon, '°', 'direk.kollar[' + i + '].yon', kol.yon, 'hesapta ' + A.tr(der, 2) + '°');
        if (kol.hatTur) dol('Kol ' + (i + 1) + ' hat türü', kol.hatTur, '', 'direk.kollar[' + i + '].hatTur', kol.hatTur);
        if (sayiMi(kol.aciklik)) dol('Kol ' + (i + 1) + ' açıklığı', +kol.aciklik, 'm', 'direk.kollar[' + i + '].aciklik', kol.aciklik);
      });
      // çizimdeki açı yayları komşu satırlar arasında: satırlar açıya göre sıralanır
      satir.sort(function (p, q) { return p.derece - q.derece || p.kol - q.kol || p.j - q.j; });
      satirlariYaz(satir);
      satir.forEach(function (s, k) {
        if (s.neden && s.ilk) r.eksik.push({ alan: 'Hat ' + (k + 1) + ' iletkeni (' + s.il.ad + ')', sec: '#hs' + k, neden: 'Araç listesinde birebir karşılığı yok: ' + s.neden + '. Satır açısıyla (' + A.tr(s.derece, 2) + '°) eklendi; iletkeni listeden seçin' });
      });
      if (!satir.length && !r.eksik.some(function (x) { return /iletkeni|yönü/.test(x.alan); })) r.eksik.push({ alan: 'Hat girişleri', sec: '#hat-rows', neden: d ? 'Direğe bağlı havai hat yok; hatları elle ekleyin' : 'Hedef bir direk değil; hatları elle ekleyin' });
      hesapla();
      return r;
    },

    hesapla: function () { hesapla(); },

    sonuc: function (A) {
      if (typeof lastVecs === 'undefined' || !lastVecs) return { hata: 'Hesap henüz yapılmadı.' };
      var etkin = lastVecs.filter(function (v) { return v.guc > 0; }).length;
      if (!etkin) return { hata: 'Çekme kuvveti olan hat yok: hat satırlarında iletken seçin.' };
      var vek = aDirek !== 'kafes';
      var uy = [];
      var bilinmeyen = hatlar.map(function (h, i) { return h.iletken !== 'Boş Hat' && !varMi(h.iletken) ? 'Hat ' + (i + 1) + ': "' + h.iletken + '" araç listesinde yok, 0 kg sayıldı.' : null; }).filter(Boolean);
      uy = uy.concat(bilinmeyen);
      hatlar.forEach(function (h, i) { if (KAYIK.test(h.iletken)) uy.push('Hat ' + (i + 1) + ': "' + h.iletken + '" satırının değeri araç tablosunda bir satır kaymış görünüyor; OG ("Müşt.") ve AG ("(x0,81)") ayrı satır girilmelidir.'); });
      var bos = hatlar.filter(function (h) { return h.iletken === 'Boş Hat'; }).length;
      if (bos) uy.push(bos + ' satır "Boş Hat" (kuvvetsiz) duruyor; o kollarda hat varsa iletkenini seçin.');
      if (!vek) uy.push('Kafes direkte R = |Rx| + |Ry| eksen doğrultusuna bağlıdır' + (son.ofset ? ' (eksen: ana hat, ' + son.anaKol + ').' : '.'));
      if (aDirek === 'atip') uy.push('A tipi direkte araç kuvvetli / zayıf eksen ayrımı yapmaz; bileşke vektörel alınır.');
      var R = r2(lastR), girdiler = [
        { ad: 'Buz yükü bölgesi', deger: aBolge, birim: '' },
        { ad: 'Direk tipi (hesap yöntemi)', deger: DIREK_AD[aDirek] || aDirek, birim: '' },
        { ad: 'Etkin hat sayısı', deger: etkin, birim: 'adet' },
        { ad: 'Ana hat yönü (kuzeyden)', deger: r2(son.ofset || 0), birim: '°' }
      ];
      var sec = A.deger('#direk-input');
      if (sec) girdiler.push({ ad: 'Seçilen direk', deger: sec, birim: '' });
      var degerler = [
        { ad: 'Tepe kuvveti R', deger: R, birim: 'kg' },
        { ad: 'Rx', deger: r2(lastRx), birim: 'kg' },
        { ad: 'Ry', deger: r2(lastRy), birim: 'kg' },
        { ad: 'Bileşke açısı (ana hatta göre)', deger: r2(lastAci), birim: '°' },
        { ad: 'Bileşke yönü (kuzeyden)', deger: r2(n360(lastAci + (son.ofset || 0))), birim: '°' }
      ];
      var on = oneri(A), ozetEk = '', durum = 'bilgi';
      if (on) {
        degerler.push({ ad: 'Önerilen direk tipi (TEDAŞ tablosu)', deger: on.tip || (on.tablo ? '—' : 'tablo yok'), birim: '' });
        degerler.push({ ad: 'En büyük boyuna kuvvet (L)', deger: on.maxL, birim: 'kg' });
        degerler.push({ ad: 'En büyük enine kuvvet (R)', deger: on.maxR, birim: 'kg' });
        degerler.push({ ad: 'B30 = en büyük L + R', deger: on.B30, birim: 'kg' });
        degerler.push({ ad: 'En kötü senaryo', deger: on.senaryo, birim: '' });
        if (on.trafoDirek) degerler.push({ ad: 'Trafo direği olsaydı', deger: on.trafoDirek, birim: '' });
        degerler.push({ ad: 'Ağaç direk', deger: on.agacDirek, birim: '' });
        if (on.tip) ozetEk = ' · önerilen direk ' + on.tip;
        if (on.karsilastirma && on.karsilastirma.durum !== 'bilinmiyor') {
          degerler.push({ ad: 'Projedeki tip tabloya göre', deger: on.karsilastirma.durum, birim: '' });
          durum = on.karsilastirma.durum === 'yeterli' ? 'uygun' : 'uygun-degil';
        }
        if (!on.tablo) uy.push('Önerilen direk tipi için tablo yok: direk ne AG ne müşterek (yalnız ENH / OG). Tablolar AG ve müşterek direkler içindir.');
        else if (son.rol === 'T') uy.push('Direk taşıyıcı (T): önerilen tip için kopma senaryosu alınmadı (eski araçtaki kural).');
        else uy.push('Önerilen tip sağlam durum ve her hattın tek tek kopması (o hattın kuvveti sıfır) senaryolarından; potans yükü alınmadı.');
      }
      return {
        ozet: 'Tepe kuvveti R = ' + A.tr(R, 1) + ' kg (' + (vek ? 'vektörel √(Rx²+Ry²)' : 'skaler |Rx|+|Ry|') + ') · bileşke ' + A.tr(r2(lastAci), 1) + '° · ' + aBolge + ' · ' + etkin + ' hat' + ozetEk,
        durum: durum,
        girdiler: girdiler,
        degerler: degerler,
        tablo: {
          basliklar: ['Hat', 'İletken', 'Açı (°)', 'P (kg)', 'Px = P·sin (kg)', 'Py = P·cos (kg)'],
          satirlar: lastVecs.map(function (v, i) { return v.guc > 0 ? ['H' + (i + 1), hatlar[i] ? hatlar[i].iletken : '', v.derece, r2(v.guc), r2(v.x), r2(v.y)] : null; }).filter(Boolean)
        },
        uyarilar: uy
      };
    },

    durumAl: function (A) {
      return {
        surum: 1, bolge: aBolge, direk: aDirek,
        hatlar: hatlar.map(function (h) { return { iletken: h.iletken, derece: +h.derece || 0 }; }),
        trafoAdi: A.deger('#trafo-adi') || '', trafoKolu: A.deger('#trafo-kolu') || '', direkNo: A.deger('#direk-no') || '',
        secilenDirek: A.deger('#direk-input') || '', ofset: son.ofset || 0, anaKol: son.anaKol || '',
        konum: son.konum || null, rol: son.rol || null, tip: son.tip || ''
      };
    },

    durumYukle: function (s) {
      s = s || {};
      if (Array.isArray(s.hatlar)) satirlariYaz(s.hatlar);   // hatlar sabit (const) dizi: yerinde değiştirilir
      // setBolge / setDirek düğme öğesi ister: düğmeye tıklanır
      if (BOLGE.indexOf(s.bolge) >= 0) barSec('.bolge-bar', s.bolge);
      if (DIREK.indexOf(s.direk) >= 0) barSec('.direk-bar', s.direk);
      // iki "Seçilen direk" kutusu yalnız elle yazınca eşlenir: ikisi de yazılır
      metinYaz('trafo-adi', s.trafoAdi); metinYaz('trafo-kolu', s.trafoKolu); metinYaz('direk-no', s.direkNo);
      metinYaz('direk-input', s.secilenDirek); metinYaz('direk-input-tesis', s.secilenDirek);
      son = { ofset: +s.ofset || 0, anaKol: s.anaKol || '', konum: s.konum || null, rol: s.rol || null, tip: s.tip || '' };
      hesapla();
    }
  };
})();
