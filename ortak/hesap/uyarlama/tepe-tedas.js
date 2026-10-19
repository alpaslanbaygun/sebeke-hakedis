/* Şebeke-M uyarlaması: Tepe Kuvveti Hesabı (TEDAŞ) (tepe-tedas). Hesap kodlarına ve tablolarına dokunmaz; yalnız
   aracın giriş alanlarına yazar, aracın kendi düğmelerini (bölge / hat tipi / potans grupları, "Tepe Kuvvetini
   Hesapla") kullanır ve sonuçları aracın sonuç kutularından okur (araç sonuçları yalnız ekrana yazar).
   - Satırlar direğin kollarından kurulur: 1. satır ana hat (direkten geçen hat ya da en uzun açıklık), açılar ona göre.
     Müşterek kolda OG + AG aracın birleşik satırına (ör. 3x3AWG+3R), tek iletken aracın satırına birebir eşlenir.
   - Satır fonksiyonu direğin görevinden; hattı bu direkte biten kol yapısal olarak NİHAYET'tir.
   - Araç hesabı yalnız düğmeyle yapar ve tertibat yoksa uyarı penceresi açar: uyarlama hesabı kendisi başlatır,
     boş tabloda pencere açılmaz. Potans seçimi ancak seçim kutusu değişince araca geçer: durum doğrudan yazılır. */
(function () {
  'use strict';
  var GOREV = { T: 'TAŞIYICI', D: 'DURDURUCU', N: 'NİHAYET' };
  // AG çıplak satırlar: ad → iletken bileşimi (TEDAŞ yazımı: 4P+R = 4 Pansy + 1 Rose, 3A+R/P = 3 Aster + Rose + Pansy)
  var AG_AAC = [
    ['2R', { ROSE: 2 }], ['3R', { ROSE: 3 }], ['2P+R', { PANSY: 2, ROSE: 1 }], ['5R', { ROSE: 5 }], ['4R', { ROSE: 4 }],
    ['4P', { PANSY: 4 }], ['4P+R', { PANSY: 4, ROSE: 1 }], ['3Po+R/P', { POPPY: 3, ROSE: 1, PANSY: 1 }],
    ['3A+R/P', { ASTER: 3, ROSE: 1, PANSY: 1 }], ['3A+R/A', { ASTER: 4, ROSE: 1 }],
    ['3Ph+R/Po', { PHLOX: 3, ROSE: 1, POPPY: 1 }], ['3O+R/A', { OXLIP: 3, ROSE: 1, ASTER: 1 }]
  ];
  // Müşterek birleşik satırların AG eki
  var MUS_AG = [
    ['3R', { ROSE: 3 }], ['2P+R', { PANSY: 2, ROSE: 1 }], ['5R', { ROSE: 5 }], ['4P+R', { PANSY: 4, ROSE: 1 }],
    ['3Po+R/Po', { POPPY: 4, ROSE: 1 }], ['3A+R/P', { ASTER: 3, ROSE: 1, PANSY: 1 }], ['3A+R/A', { ASTER: 4, ROSE: 1 }],
    ['3Ph+R/Ph', { PHLOX: 4, ROSE: 1 }], ['3O+R/O', { OXLIP: 4, ROSE: 1 }]
  ];
  var YG_ON = { SWALLOW: '3x3AWG+', RAVEN: '3x1/0AWG+', PIGEON: '3x3/0AWG+', PARTRIDGE: '3x266MCM+', HAWK: '3x477MCM+' };
  var YAZIM = { '3x266MCM+3R': '3x266MM+3R', '3x266MCM+2P+R': '3x266MMC+2P+R' };   // araçta yanlış yazılmış satır adları
  var YG_TEK = { SWALLOW: 'SWALLOW( MÜŞ)', RAVEN: 'RAVEN (MÜŞTEREK)' };
  var YG_ENH = { SWALLOW: 'SWALLOW(ENH NİHAYET)', RAVEN: 'RAVEN ENH NİHAYET' };
  var KISA = { R: 'ROSE', P: 'PANSY', PO: 'POPPY', A: 'ASTER', PH: 'PHLOX', O: 'OXLIP', L: 'LILY', I: 'IRIS' };
  var TEL_AD = { ROSE: 'Rose', LILY: 'Lily', IRIS: 'Iris', PANSY: 'Pansy', POPPY: 'Poppy', ASTER: 'Aster', PHLOX: 'Phlox', OXLIP: 'Oxlip' };
  var MERDIVEN = {
    AG: { A: ['9-H', '10I', '10U', '12I'], K: ['K1', 'K2', 'K3', 'K4', 'K5'] },
    'MÜŞTEREK': { A: ["10I''", "10U''", "12I''"], K: ["K1''", "K2''", "K3''", "K4''", "K5''"] }
  };
  var TRAFO = ['T-15', 'T-25', 'T-35', 'T-50'], AGAC = ['9O', '9A'];

  var ek = { tip: null, acik: [] };   // projedeki direk tipi (karşılaştırma için) ve kayıttan dönen açık eksikler

  function el(id) { return document.getElementById(id); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function n360(x) { var a = ((x % 360) + 360) % 360; return a >= 359.995 ? 0 : a; }
  function aciFark(a, b) { var f = n360(a - b); return f > 180 ? 360 - f : f; }
  function sayiMi(v) { return v !== null && v !== undefined && v !== '' && isFinite(+v); }
  function yeraltiMi(ht) { return /YERALTI/.test(String(ht || '')); }
  function bul(ad) { return ad && typeof findTertibat === 'function' ? findTertibat(String(ad)) : null; }
  function adi(ad) { var f = bul(ad); return f ? f.row[0] : null; }
  function ayni(a, b) { var ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(function (k) { return a[k] === b[k]; }); }
  function bilesimYazi(b) { return Object.keys(b).map(function (k) { return b[k] + ' ' + (TEL_AD[k] || k); }).join(' + '); }
  /** AG çıplak iletken bileşimi: çözümleyiciden ya da TEDAŞ yazımından ("3P+R/P", "4P+R", "5R") */
  function bilesim(c, ad) {
    var b = {};
    var ekle = function (t, n) { b[t] = (b[t] || 0) + n; };
    if (c && c.aile === 'AAC' && c.tel && c.fazSayisi) {
      ekle(c.tel, c.fazSayisi);
      if (c.notr && typeof c.notr === 'string') ekle(c.notr, 1);
      return b;
    }
    var m = String(ad || '').toUpperCase().replace(/\s+/g, '').match(/^(\d)(PO|PH|R|P|A|O|L|I)(?:\+(PO|PH|R|P|A|O|L|I)(?:\/(PO|PH|R|P|A|O|L|I))?)?$/);
    if (!m) return null;
    ekle(KISA[m[2]], +m[1]);
    if (m[3]) ekle(KISA[m[3]], 1);
    if (m[4]) ekle(KISA[m[4]], 1);
    return b;
  }
  function aerAdi(c) {
    if (!c || !c.fazSayisi || !c.kesit || !c.notr) return null;
    return c.fazSayisi + '*' + c.kesit + (c.aydinlatma ? '/' + c.aydinlatma : '') + '+' + c.notr + '-AER';
  }
  function grupSec(g, v) { var b = document.querySelector('#' + g + ' .opt-btn[data-val="' + v + '"]'); if (b) b.click(); return !!b; }
  function satirDolu(i) { return !!bul(String(el('name-' + i).value || '').trim()); }
  /** Aracın hesap düğmesi; listede bulunan tertibat yoksa uyarı penceresi açılmasın diye çağrılmaz. */
  function hesapEt() {
    var kutu = el('resultBox'), dolu = false;
    for (var i = 0; i < ROW_COUNT; i++) if (satirDolu(i)) dolu = true;
    if (!dolu) { kutu.classList.remove('show'); return false; }
    kutu.scrollIntoView = function () { };   // kendiliğinden hesapta sayfa kaymasın
    try { el('calcBtn').click(); } finally { delete kutu.scrollIntoView; }
    return true;
  }

  /** Tek iletkenin satırı: { ad } ya da { neden } */
  function tekSatir(il, c, kol) {
    var d0 = adi(il.ad);
    if (d0) return { ad: d0 };
    if (c.aile === 'ACSR') {
      if (kol.hatTur === 'OG_HAVAI') return YG_ENH[c.tel] ? { ad: YG_ENH[c.tel] } : { neden: 'araçta ' + c.tel + ' için ENH satırı yok (yalnız Swallow ve Raven)' };
      if (kol.hatTur === 'MUSTEREK') return YG_TEK[c.tel] ? { ad: YG_TEK[c.tel] } : { neden: 'araçta yalnız OG\'li müşterek ' + c.tel + ' satırı yok' };
      return { neden: 'hat türü bilinmiyor (ENH mi müşterek mi)' };
    }
    if (c.aile === 'ABC') { var a = aerAdi(c), x = adi(a); return x ? { ad: x } : { neden: 'araçta "' + (a || il.ad) + '" satırı yok' }; }
    var b = bilesim(c, il.ad);
    if (b) { var t = AG_AAC.filter(function (y) { return ayni(y[1], b); })[0]; return t ? { ad: t[0] } : { neden: 'araçta ' + bilesimYazi(b) + ' tertibi yok' }; }
    return { neden: c.aile ? 'yeraltı kablosu ya da araçta olmayan iletken (' + c.aile + ')' : 'iletken adı tanınmadı' };
  }
  /** Müşterek kolda OG + AG birleşik satırı */
  function musSatir(cOg, ilAg, cAg) {
    var on = YG_ON[cOg.tel];
    if (!on) return { neden: 'araçta ' + cOg.tel + ' müşterek satırı yok' };
    if (cAg.aile === 'ABC') {
      if (cOg.tel !== 'SWALLOW') return { neden: 'araçta yalnız Swallow + AER müşterek satırları var' };
      var a = aerAdi(cAg), x = a ? adi('3AWG+' + a) : null;
      return x ? { ad: x } : { neden: 'araçta "3AWG+' + (a || ilAg.ad) + '" satırı yok' };
    }
    var b = bilesim(cAg, ilAg.ad);
    var t = b ? MUS_AG.filter(function (y) { return ayni(y[1], b); })[0] : null;
    if (!t) return { neden: 'araçta ' + (b ? bilesimYazi(b) : ilAg.ad) + ' ile müşterek satır yok' };
    var ad = YAZIM[on + t[0]] || on + t[0], z = adi(ad);
    return z ? { ad: z, yazim: !!YAZIM[on + t[0]] } : { neden: 'araçta "' + ad + '" satırı yok' };
  }

  /** Projedeki direk tipi aracın öneri listesindeki ada: { aile:'A'|'K'|'T'|'AGAC'|'beton'|'?', ad, grup } */
  function direkTipiOku(d) {
    if (!d) return null;
    if (d.malzeme === 'beton') return { aile: 'beton', ham: d.tip || '' };
    var t = String(d.tip || '').toUpperCase().replace(/İ/g, 'I').replace(/[″"]/g, "''").replace(/’’|''/g, "''").replace(/\s+/g, '');
    if (!t) return null;
    t = t.replace(/^G-?/, '').replace(/\+\d+$/, '');
    var m;
    if ((m = t.match(/^T-?(15|25|35|50)$/))) return { aile: 'T', ad: 'T-' + m[1], ham: d.tip };
    if ((m = t.match(/^(9-?H|10I|10U|12I)('')?$/))) return { aile: 'A', ad: m[1].replace(/^9-?H$/, '9-H') + (m[2] || ''), grup: m[2] ? 'MÜŞTEREK' : 'AG', ham: d.tip };
    if ((m = t.match(/^K-?([1-5])('')?$/))) return { aile: 'K', ad: 'K' + m[1] + (m[2] || ''), grup: m[2] ? 'MÜŞTEREK' : 'AG', ham: d.tip };
    if ((m = t.match(/^(9O|9A)$/))) return { aile: 'AGAC', ad: m[1], ham: d.tip };
    return { aile: '?', ham: d.tip };
  }
  function karsilastir(tip, grup, oneri, trafo, agac) {
    if (!tip) return { durum: 'bilgi', not: 'Projede direk tipi yok; öneriyle karşılaştırılmadı.' };
    if (tip.aile === 'beton') return { durum: 'bilgi', not: 'Araç beton direk önermez; seçilen beton direk (' + (tip.ham || '—') + ') karşılaştırılmadı.' };
    if (tip.aile === '?') return { durum: 'bilgi', not: 'Direk tipi "' + tip.ham + '" aracın öneri listesinde yok; karşılaştırılmadı.' };
    if (tip.aile === 'T') {
      if (grup !== 'AG') return { durum: 'bilgi', not: 'Araç trafo direğini yalnız AG hesapta önerir.' };
      var j = TRAFO.indexOf(trafo);
      if (j < 0) return /üzeri/.test(trafo) ? { durum: 'uygun-degil', not: 'Tepe kuvveti en büyük trafo direğinin (T-50) üstünde.' } : { durum: 'bilgi', not: '' };
      return TRAFO.indexOf(tip.ad) >= j ? { durum: 'uygun', not: 'Trafo direği ' + tip.ad + ' ≥ önerilen ' + trafo + '.' } : { durum: 'uygun-degil', not: 'Trafo direği ' + tip.ad + ' önerilen ' + trafo + '\'den küçük.' };
    }
    if (tip.aile === 'AGAC') {
      var a = AGAC.indexOf(agac);
      if (a < 0) return { durum: 'uygun-degil', not: 'Ağaç direk yetmiyor: araç demir direk öneriyor.' };
      return AGAC.indexOf(tip.ad) >= a ? { durum: 'uygun', not: 'Ağaç direk ' + tip.ad + ' ≥ önerilen ' + agac + '.' } : { durum: 'uygun-degil', not: 'Ağaç direk ' + tip.ad + ' önerilen ' + agac + '\'dan küçük.' };
    }
    if (tip.grup !== grup) return { durum: 'bilgi', not: 'Projedeki direk (' + tip.ham + ') ' + (tip.grup === 'AG' ? 'AG' : 'müşterek') + ' direği; hesap ' + (grup === 'AG' ? 'AG' : 'müşterek') + ' yapıldı.' };
    var L = MERDIVEN[grup];
    if (/üzeri/.test(oneri)) return { durum: 'uygun-degil', not: 'Tepe kuvveti aracın en büyük direğinin üstünde (özel proje).' };
    var oA = L.A.indexOf(oneri), oK = L.K.indexOf(oneri), sA = L.A.indexOf(tip.ad), sK = L.K.indexOf(tip.ad);
    var uyg = function (ok) { return { durum: ok ? 'uygun' : 'uygun-degil', not: 'Projedeki direk ' + tip.ad + (ok ? ' ≥ ' : ' < ') + 'önerilen ' + oneri + '.' }; };
    if (oA >= 0 && sA >= 0) return uyg(sA >= oA);
    if (oK >= 0 && sK >= 0) return uyg(sK >= oK);
    if (oK >= 0 && sA >= 0) return { durum: 'uygun-degil', not: 'Araç A tipi direkleri yetersiz bulup kafes (' + oneri + ') önerdi; projedeki ' + tip.ad + ' yetmez.' };
    if (oA >= 0 && sK >= 0) return { durum: 'bilgi', not: 'Projedeki kafes direk (' + tip.ad + '), önerilen A tipi (' + oneri + ') ile araçta karşılaştırılamaz.' };
    return { durum: 'bilgi', not: '' };
  }

  /** Köprünün eksik listesindeki girilmemiş alanlar + kayıttan dönen açık eksikler */
  function acikEksikler() {
    var S = window.__SM && window.__SM.durum, l = [];
    ((S && S.eksik) || []).forEach(function (x) { if (!x.girildi) l.push({ alan: x.alan, sec: x.sec }); });
    ek.acik.forEach(function (x) { if (!l.some(function (y) { return y.alan === x.alan; })) l.push(x); });
    return l;
  }
  function acikIzle() {
    ek.acik.forEach(function (x) {
      var e = x.sec ? document.querySelector(x.sec) : null;
      if (!e) return;
      e.classList.add('sm-eksik');
      var f = function () { ek.acik = ek.acik.filter(function (y) { return y !== x; }); e.classList.remove('sm-eksik'); e.removeEventListener('input', f); e.removeEventListener('change', f); };
      e.addEventListener('input', f); e.addEventListener('change', f);
    });
  }

  // Düğme gruplarında seçim "change" olayı da üretsin (köprü eksik alanın girildiğini bunu dinleyerek anlar)
  ['bolgeGroup', 'hatGroup', 'potansGroup'].forEach(function (g) {
    var k = el(g);
    if (k) k.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.opt-btn')) setTimeout(function () { try { k.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) { /* */ } }, 0);
    });
  });

  window.__SM_UYARLAMA = {
    notlar: [
      'Her tertibat en büyük çekme kuvvetiyle (%100) ve her biri tek tek koptuğunda (Çizelge-12 zayıflatması, tablodaki kalan oran) hesaplanır; en büyük |Rx|+|Ry| veren durum kritik kabul edilir, potans yükü bu durumun Ry bileşenine eklenir. Rüzgâr yükü ve açıklık hesaba girmez.',
      'Tertibat 1 referans yöndür: A tipi direk seçiminde Rx bu hat boyunca, Ry ona dik değerlendirilir. Şebeke-M direkten geçen hattı (yoksa en uzun açıklığı) 1. satıra koyar; sıra değişirse öneri değişebilir.',
      'AER (demet kablo) satırlarında yalnız 3. bölge değeri gerçektir: 1. ve 2. bölgede 1 kg, 4. bölgede 4 kg yazılıdır ve araç uyarı vermez. Bu bölgelerde AER\'li hesaplar uyarıyla "bilgi" olarak kaydedilir. Swallow + AER müşterek satırlarında yalnız 3. bölge değeri vardır.',
      'Müşterek hesapta AG satırlarına 0,81 indirgemesi tablo sırasına göre uygulanır; listenin son AER satırı (3*70/25+95-AER) bu yüzden indirgenmez.',
      'Yazarla doğrulanması gereken tablo değerleri: 2R 4. bölge 196 kg (diğer tablolarda 296), 4R 4. bölge 392 kg (592), 4P+R 2. bölge 656 kg (654); 3x3AWG+3R / +5R / +4P+R 2. bölge değerleri kitap tablosundan yaklaşık 60 kg yüksek; SWALLOW( MÜŞ) bütün bölgelerde 525 kg. İki 266 MCM satırının adı araçta yanlış yazılmıştır ("3x266MM+3R", "3x266MMC+2P+R"); Şebeke-M bu adları kullanır.',
      'Araç beton direk önermez. Durum, projedeki direk aracın öneri listesindeyse (9-H, 10I, 10U, 12I, K1–K5; müşterekte 10I\'\', 10U\'\', 12I\'\', K1\'\'–K5\'\'; trafo direği T-15–T-50; ağaç 9O / 9A) karşılaştırılır; 8I, 12U ve beton direklerde sonuç "bilgi"dir.',
      'Fonksiyonu seçilmeyen satır, durdurucu / nihayet gibi zayıflatılır. Potans (konsol ilave yükü) projede yoktur; elle seçilir. En fazla 7 devre girilebilir.',
      'Telefon kataloğundaki 3P+R (3 Pansy + 1 Rose), 3Po+P, 3A+P tertiplerinin araçta karşılığı yoktur; bu satırlarda adı siz seçersiniz.'
    ],
    hazir: function () { return typeof findTertibat === 'function' && !!el('name-6') && !!el('calcBtn') && typeof STATE === 'object'; },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
      var d = b.direk || null;
      var dol = function (alan, deger, birim, yol, ham, kaynak) { r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' }); };
      ek.acik = [];

      // ---- satırları temizle (önceki doldurmadan / örnekten kalan olmasın)
      for (var i = 0; i < ROW_COUNT; i++) { el('name-' + i).value = ''; A.olay(el('name-' + i), 'input'); el('angle-' + i).value = 0; el('func-' + i).value = ''; }

      // ---- bölge
      var bz = b.proje ? b.proje.buzBolgesi : null;
      if (sayiMi(bz) && +bz >= 1 && +bz <= 4) { grupSec('bolgeGroup', String(+bz)); dol('Buz yükü bölgesi', +bz + '. bölge', '', 'proje.buzBolgesi', bz); }
      else r.eksik.push({ alan: 'Bölge', sec: '#bolgeGroup', neden: sayiMi(bz) ? bz + '. bölge araçta yok (1–4); seçin' : 'Projede buz bölgesi yok; seçin' });

      // ---- potans: projede yok
      r.eksik.push({ alan: 'Potans (konsol ilave yükü)', sec: '#potansGroup', neden: 'Projede yok: direkte potans varsa VAR seçip tipini seçin, yoksa YOK\'a dokunun' });

      if (!d) {
        r.eksik.push({ alan: 'Hat tipi', sec: '#hatGroup', neden: 'Hedef bir direk değil; seçin' });
        r.eksik.push({ alan: 'Tertibat / cer girişleri', sec: '#tertibatRows', neden: 'Hedef bir direk değil; tertibatları elle girin' });
        hesapEt();
        return r;
      }
      if (d.no != null && d.no !== '') dol('Direk', String(d.no), '', 'direk.no', d.no);
      ek.tip = direkTipiOku(d);
      if (d.tip) dol('Direk tipi', d.tip, '', 'direk.tip', d.tip);
      if (d.malzeme) dol('Direk malzemesi', d.malzeme, '', 'direk.malzeme', d.malzeme);

      // ---- hat tipi (AG / müşterek)
      var kollar = Array.isArray(d.kollar) ? d.kollar : [];
      var musterek = d.tur === 'MUSTEREK' || kollar.some(function (k) { return k && k.hatTur === 'MUSTEREK'; });
      var ogHavai = kollar.some(function (k) { return k && k.hatTur === 'OG_HAVAI'; });
      var agHavai = kollar.some(function (k) { return k && /^(AG_HAVAI|AYDINLATMA|REKORTMAN)$/.test(k.hatTur || ''); });
      var grup = musterek ? 'MÜŞTEREK' : (!ogHavai && (agHavai || d.tur === 'AG' || d.tur === 'AYD')) ? 'AG' : null;
      if (d.tur) dol('Direk türü', d.tur, '', 'direk.tur', d.tur);
      if (grup) grupSec('hatGroup', grup);
      else r.eksik.push({ alan: 'Hat tipi', sec: '#hatGroup', neden: ogHavai ? 'Direkte müşterek olmayan OG hattı var; AG mi müşterek mi hesaplanacağını seçin' : 'Direğin AG mi müşterek mi olduğu projede yok; seçin' });

      // ---- kollar: ana hat ve sıra
      var hava = [], yeralti = 0;
      kollar.forEach(function (kol, k) {
        if (!kol) return;
        if (yeraltiMi(kol.hatTur)) { yeralti++; return; }
        if (!sayiMi(kol.yon)) { r.eksik.push({ alan: 'Kol ' + (k + 1) + ' yönü', sec: '#tertibatRows', neden: 'Projede açıklığın yönü yok; tertibatı açısıyla elle girin' }); return; }
        hava.push({ kol: kol, i: k });
      });
      if (yeralti) r.uyari.push(yeralti + ' yeraltı kablo çıkışı direk tepesine çekme kuvveti vermediği için hesaba alınmadı.');
      var say = {};
      hava.forEach(function (x) { if (x.kol.hatId != null && x.kol.hatId !== '') say[x.kol.hatId] = (say[x.kol.hatId] || 0) + 1; });
      var ana = null, ikinci = null, neden = '';
      Object.keys(say).forEach(function (h) {
        if (say[h] !== 2) return;
        var p = hava.filter(function (x) { return String(x.kol.hatId) === h; });
        var top = (+p[0].kol.aciklik || 0) + (+p[1].kol.aciklik || 0);
        if (!ana || top > ana.top) ana = { p: p, top: top };
      });
      if (ana) { neden = 'direkten geçen hat'; }
      else {
        for (var x1 = 0; x1 < hava.length; x1++) for (var x2 = x1 + 1; x2 < hava.length; x2++) {
          var sapma = 180 - aciFark(hava[x1].kol.yon, hava[x2].kol.yon);
          if (sapma <= 10 && (!ana || sapma < ana.sapma)) ana = { p: [hava[x1], hava[x2]], sapma: sapma };
        }
        if (ana) neden = 'doğrusal iki kol';
      }
      if (ana) {
        var p0 = ana.p[0], p1 = ana.p[1];
        if ((+p1.kol.aciklik || 0) > (+p0.kol.aciklik || 0)) { ana = p1; ikinci = p0; } else { ana = p0; ikinci = p1; }
      } else {
        hava.forEach(function (x) { if (+x.kol.aciklik > 0 && (!ana || +x.kol.aciklik > +ana.kol.aciklik)) ana = x; });
        neden = ana ? 'en uzun açıklık' : '';
        if (!ana && hava.length) { ana = hava[0]; neden = 'ilk kol (açıklık bilinmiyor)'; }
      }
      var sira = [];
      if (ana) {
        var y0 = +ana.kol.yon;
        sira = hava.filter(function (x) { return x !== ana && x !== ikinci; })
          .sort(function (p, q) { return n360(+p.kol.yon - y0) - n360(+q.kol.yon - y0); });
        sira = [ana].concat(ikinci ? [ikinci] : [], sira);
        if (hava.length > 1) r.uyari.push('Tertibat 1 (referans yön) ana hat: Kol ' + (ana.i + 1) + ' (' + neden + '); açılar bu kola göre girildi.');
      }

      // ---- satırlar
      var satir = [];
      var tekKol = hava.length === 1;
      sira.forEach(function (x) {
        var kol = x.kol, k = x.i, aci = r2(n360(+kol.yon - +ana.kol.yon));
        // görev: hattı bu direkte biten kol yapısal olarak nihayettir
        var g;
        if (tekKol) g = { f: 'NİHAYET', not: 'Direkte tek kol var: nihayet bağlantısı.' };
        else if (kol.hatId != null && kol.hatId !== '' && say[kol.hatId] === 1) g = { f: 'NİHAYET', not: 'Kol ' + (k + 1) + ': hat bu direkte başlıyor / bitiyor; satır NİHAYET girildi.' };
        else if (GOREV[d.rol]) g = { f: GOREV[d.rol], rol: true };
        else g = { f: '', neden: d.rol === 'K' ? 'Köşe direği: köşede taşıyıcı mı durdurucu mu olduğu projede yok; seçin' : 'Direğin görevi projede yok; seçin' };
        if (g.not) r.uyari.push(g.not);
        // iletkenler
        var ils = (kol.iletkenler || []).filter(function (il) { return il && il.ad; }).map(function (il) {
          var j = kol.iletkenler.indexOf(il);
          return { il: il, j: j, c: A.iletken(il.ad), adet: sayiMi(il.adet) && +il.adet >= 1 ? Math.round(+il.adet) : 1 };
        });
        if (!ils.length) { r.eksik.push({ alan: 'Kol ' + (k + 1) + ' iletkeni', sec: '#tertibatRows', neden: 'Projede bu açıklığın iletkeni yok; tertibatı elle girin (açı ' + A.tr(aci, 2) + '°)' }); return; }
        var ekle = function (s, kaynak, adet) {
          for (var n = 0; n < adet; n++) satir.push({ ad: s.ad || '', aci: aci, f: g.f, gNeden: g.neden, neden: s.neden, kaynak: kaynak, kol: k, yazim: s.yazim, ilk: n === 0 });
        };
        var og = ils.filter(function (z) { return z.c.aile === 'ACSR'; });
        var ag = ils.filter(function (z) { return z.c.aile !== 'ACSR'; });
        if (kol.hatTur === 'MUSTEREK' && og.length === 1 && ag.length >= 1) {
          var o = og[0], a0 = ag[0], nb = Math.min(o.adet, a0.adet);
          ekle(musSatir(o.c, a0.il, a0.c), o.il.ad + ' + ' + a0.il.ad, nb);
          if (o.adet > nb) ekle(tekSatir(o.il, o.c, kol), o.il.ad, o.adet - nb);
          if (a0.adet > nb) ekle(tekSatir(a0.il, a0.c, kol), a0.il.ad, a0.adet - nb);
          ag.slice(1).forEach(function (z) { ekle(tekSatir(z.il, z.c, kol), z.il.ad, z.adet); });
        } else {
          ils.forEach(function (z) { ekle(tekSatir(z.il, z.c, kol), z.il.ad, z.adet); });
        }
        ils.forEach(function (z) {
          dol('Kol ' + (k + 1) + ' iletkeni', z.il.ad, '', 'direk.kollar[' + k + '].iletkenler[' + z.j + '].ad', z.il.ad);
          if (sayiMi(z.il.adet)) dol('Kol ' + (k + 1) + ' devre sayısı', z.adet, '', 'direk.kollar[' + k + '].iletkenler[' + z.j + '].adet', z.il.adet);
        });
        dol('Kol ' + (k + 1) + ' yönü (kuzeyden)', +kol.yon, '°', 'direk.kollar[' + k + '].yon', kol.yon, 'tertibatta ' + A.tr(aci, 2) + '°');
        if (kol.hatTur) dol('Kol ' + (k + 1) + ' hat türü', kol.hatTur, '', 'direk.kollar[' + k + '].hatTur', kol.hatTur);
        if (sayiMi(kol.aciklik)) dol('Kol ' + (k + 1) + ' açıklığı', +kol.aciklik, 'm', 'direk.kollar[' + k + '].aciklik', kol.aciklik);
        if (kol.hatId != null && kol.hatId !== '') dol('Kol ' + (k + 1) + ' hattı', kol.hatNo || String(kol.hatId), '', 'direk.kollar[' + k + '].hatId', kol.hatId);
      });
      if (satir.some(function (s) { return s.f && GOREV[d.rol] === s.f; }) || satir.some(function (s) { return s.gNeden; })) { if (d.rol != null) dol('Direğin görevi', d.rol, '', 'direk.rol', d.rol); }

      // ---- araca yaz (en fazla 7 satır)
      satir.slice(0, ROW_COUNT).forEach(function (s, n) {
        var ad = el('name-' + n);
        ad.value = s.ad; A.olay(ad, 'input');
        el('angle-' + n).value = s.aci;
        el('func-' + n).value = s.f;
        if (s.neden && s.ilk) r.eksik.push({ alan: 'Tertibat ' + (n + 1) + ' adı (' + s.kaynak + ')', sec: '#name-' + n, neden: 'Araç listesinde birebir karşılığı yok: ' + s.neden + '. Açı ve fonksiyon yazıldı; adı listeden seçin' });
        if (s.gNeden) r.eksik.push({ alan: 'Tertibat ' + (n + 1) + ' fonksiyonu', sec: '#func-' + n, neden: s.gNeden });
        if (s.yazim) r.uyari.push('Tertibat ' + (n + 1) + ': araçtaki satır adı yanlış yazılmış ("' + s.ad + '"); bu satır kullanıldı.');
      });
      if (satir.length > ROW_COUNT) {
        r.eksik.push({ alan: 'Tertibat ' + (ROW_COUNT + 1) + ' ve sonrası', sec: '#tertibatRows', neden: 'Araç en fazla ' + ROW_COUNT + ' devre alır; ' + (satir.length - ROW_COUNT) + ' devre girilemedi' });
        r.uyari.push('Direkte ' + satir.length + ' devre var; araç en fazla ' + ROW_COUNT + ' devre alır, fazlası hesaba girmedi.');
      }
      if (!satir.length && !r.eksik.some(function (x) { return /iletkeni|yönü/.test(x.alan); })) r.eksik.push({ alan: 'Tertibat / cer girişleri', sec: '#tertibatRows', neden: 'Direğe bağlı havai hat yok; tertibatları elle girin' });
      hesapEt();
      return r;
    },

    hesapla: function () { hesapEt(); },

    sonuc: function (A) {
      hesapEt();   // araç girdiler değişince kendiliğinden hesaplamaz: kayıttan önce güncel girdilerle yeniden
      if (!el('resultBox').classList.contains('show')) return { hata: 'Hesap yapılmadı: en az bir tertibat adını (listeden) girin.' };
      var say = function (s) { return A.sayi(s, '.'); };
      var senaryo = Array.prototype.slice.call(el('scenarioTable').rows, 1).map(function (tr) {
        var c = Array.prototype.map.call(tr.cells, function (td) { return td.textContent; });
        return { ad: c[0], Rx: say(c[1]), Ry: say(c[2]), Q: say(c[3]), F: say(c[4]), kritik: tr.classList.contains('winner') };
      });
      var B30 = say(A.metin('#resB30'));
      var oneri = A.metin('#resDirek'), trafo = A.metin('#resTrafo'), agac = A.metin('#resAgac'), pTxt = A.metin('#resPotans');
      var potans = /kg/.test(pTxt) ? say(pTxt) : 0;
      var maxL = senaryo.reduce(function (m, s) { return Math.max(m, Math.abs(s.Rx)); }, 0);
      var maxR = senaryo.reduce(function (m, s) { return Math.max(m, r1(s.F - Math.abs(s.Rx))); }, 0);
      var uy = [];
      var wb = (el('warnBox').innerText || '').trim();
      if (/^Uyarılar/.test(wb)) wb.split('\n').slice(1).forEach(function (s) { s = s.replace(/^[•\s]+/, '').trim(); if (s) uy.push(s); });
      var bilgi = uy.length > 0;
      var girdi = [
        { ad: 'Bölge', deger: STATE.bolge + '. bölge', birim: '' },
        { ad: 'Hat tipi', deger: STATE.hat, birim: '' },
        { ad: 'Potans', deger: STATE.potansDurumu === 'VAR' ? (STATE.potansIdx != null ? POTANS_DATA[STATE.potansIdx][0] : 'VAR (tip seçilmedi)') : 'YOK', birim: '' }
      ];
      if (STATE.potansDurumu === 'VAR' && STATE.potansIdx == null) { uy.push('Potans VAR seçili ama tipi seçilmedi: araç potans yükünü uygulamadı.'); bilgi = true; }
      for (var i = 0; i < ROW_COUNT; i++) {
        var ad = String(el('name-' + i).value || '').trim();
        if (!ad) continue;
        var f = bul(ad);
        girdi.push({ ad: 'Tertibat ' + (i + 1), deger: ad + ' · ' + (parseFloat(el('angle-' + i).value) || 0) + '° · ' + (el('func-' + i).value || 'fonksiyon yok'), birim: '' });
        if (!f) continue;
        var v = f.row[STATE.bolge];
        if (v !== null && v !== undefined && v <= 4 && f.row[3] > 100) { uy.push('Tertibat ' + (i + 1) + ' (' + f.row[0] + '): araç tablosunda ' + STATE.bolge + '. bölge değeri ' + v + ' kg (yer tutucu); yalnız 3. bölge değeri gerçektir. Sonuç güvenilir değil.'); bilgi = true; }
        if (STATE.hat === 'MÜŞTEREK' && f.idx === 28) { uy.push('Tertibat ' + (i + 1) + ' (' + f.row[0] + '): araç müşterek hesapta bu satıra 0,81 indirgemesini uygulamaz (tablo sırası hatası).'); bilgi = true; }
      }
      if (acikEksikler().length) bilgi = true;   // köprü kayıtta her girilmemiş eksik için ayrıca not düşer
      if (ek.acik.length) uy.push('Kayıtta girilmemiş bilgiler: ' + ek.acik.map(function (x) { return x.alan; }).join(', ') + '.');
      var k = karsilastir(ek.tip, STATE.hat, oneri, trafo, agac);
      var durum = bilgi ? 'bilgi' : k.durum;
      if (k.not) uy.push(k.not);
      var ozet = 'Tepe kuvveti ' + A.tr(B30, 1) + ' kg (' + A.metin('#resScenario') + ') → önerilen ' + oneri +
        (STATE.hat === 'AG' && TRAFO.indexOf(trafo) >= 0 ? ' · trafo direği ' + trafo : '') + (potans ? ' · potans +' + A.tr(potans) + ' kg' : '');
      return {
        ozet: ozet,
        durum: durum,
        girdiler: girdi,
        degerler: [
          { ad: 'Maksimum tepe kuvveti', deger: B30, birim: 'kg' },
          { ad: 'Kritik senaryo', deger: A.metin('#resScenario'), birim: '' },
          { ad: 'Önerilen direk tipi', deger: oneri, birim: '' },
          { ad: 'Trafo direği (varsa)', deger: trafo, birim: '' },
          { ad: 'Ağaç direk önerisi', deger: agac, birim: '' },
          { ad: 'Potans ilave yükü', deger: potans, birim: 'kg' },
          { ad: 'En büyük |Rx| (referans yön boyunca)', deger: r1(maxL), birim: 'kg' },
          { ad: 'En büyük |Ry| (potans dahil)', deger: r1(maxR), birim: 'kg' }
        ],
        tablo: {
          basliklar: ['Senaryo', 'Rx (kg)', 'Ry (kg)', '|Rx|+|Ry| (kg)', 'Kuvvet (kg)', 'Kritik'],
          satirlar: senaryo.map(function (s) { return [s.ad, s.Rx, s.Ry, s.Q, s.F, s.kritik ? 'evet' : '']; })
        },
        uyarilar: uy
      };
    },

    durumAl: function () {
      var satirlar = [];
      for (var i = 0; i < ROW_COUNT; i++) satirlar.push({ ad: el('name-' + i).value || '', aci: el('angle-' + i).value, fonk: el('func-' + i).value || '' });
      return {
        surum: 1, bolge: STATE.bolge, hat: STATE.hat, potans: STATE.potansDurumu, potansIdx: STATE.potansIdx,
        satirlar: satirlar, tip: ek.tip, acik: acikEksikler()
      };
    },

    durumYukle: function (s, A) {
      s = s || {};
      grupSec('bolgeGroup', String(s.bolge || 1));
      grupSec('hatGroup', s.hat === 'MÜŞTEREK' ? 'MÜŞTEREK' : 'AG');
      grupSec('potansGroup', s.potans === 'VAR' ? 'VAR' : 'YOK');
      // potans tipi araca yalnız seçim kutusu değişince geçer: durum doğrudan yazılır
      STATE.potansIdx = s.potansIdx == null ? null : +s.potansIdx;
      potansSelect.value = String(STATE.potansIdx == null ? 0 : STATE.potansIdx);
      for (var i = 0; i < ROW_COUNT; i++) {
        var x = (s.satirlar || [])[i] || {}, ad = el('name-' + i);
        ad.value = x.ad || ''; A.olay(ad, 'input');
        el('angle-' + i).value = x.aci == null || x.aci === '' ? 0 : x.aci;
        el('func-' + i).value = x.fonk || '';
      }
      ek.tip = s.tip || null;
      ek.acik = Array.isArray(s.acik) ? s.acik.slice() : [];
      acikIzle();
      hesapEt();
    }
  };
})();
