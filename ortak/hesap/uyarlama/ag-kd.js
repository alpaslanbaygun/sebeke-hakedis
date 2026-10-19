/* Şebeke-M uyarlaması: AG Kısa Devre Hesabı (ag-kd). Hesap kodlarına ve formüllerine dokunmaz; yalnız giriş
   alanlarına yazar, aracın kendi işlevlerini (trafoAuto, addSegment, upd, calc, stateObj, applyState) çağırır ve
   sonuçları aracın buildPrintData nesnesinden okur.
   - Trafo gücü yalnız aracın listesindeki değerlerden seçilir; listede yoksa "eksik" olur (sessizce 400 kVA olmaz).
   - Segmentler trafodan çıkan zincirden (AG parçalar) ya da seçili AG hattının açıklıklarından kurulur.
   - Projede koruma cihazı bilgisi olmadığından cihaz "Yok" seçilir (araç her yeni segmente 36 kA TMŞ koyar ve
     gerçek olmayan "UYGUNDUR" kararları üretirdi).
   - Aracın gömülü durum okuma kusuru (kayıtlı HTML açılınca boş gelir) Şebeke-M kaydını etkilemez: durum
     stateObj / applyState ile alınıp yüklenir. */
(function () {
  'use strict';
  var KISA = { R: 'Rose', L: 'Lily', I: 'Iris', P: 'Pansy', PO: 'Poppy', A: 'Aster', PH: 'Phlox', O: 'Oxlip' };
  // Uyarlamanın ek bilgisi (durumla birlikte saklanır): eşlenemeyen segmentler, listede olmayan trafo gücü
  var ek = { eslenemeyen: [], beklenen: 0, istenenKVA: null };

  function el(id) { return document.getElementById(id); }
  function sayiMi(v) { return v !== null && v !== undefined && v !== '' && isFinite(+v); }
  function buyuk(w) { w = String(w || ''); return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
  function secenekVar(id, v) { return Array.prototype.some.call(el(id).options, function (o) { return o.value === String(v); }); }
  function yuvarla(v, n) { return typeof v === 'number' && isFinite(v) ? +v.toFixed(n) : null; }
  /** Araç tertibi "3xFaz+Aydınlatma/Nötr": '/' sonrasındaki iletken nötrdür */
  function egikNotr(ham) {
    var s = String(ham || '').toUpperCase().replace(/İ/g, 'I').replace(/\s+/g, '');
    var m = s.match(/\/(ROSE|LILY|IRIS|PANSY|POPPY|ASTER|PHLOX|OXLIP|PO|PH|R|L|I|P|A|O)(?![A-Z])/);
    return m ? (KISA[m[1]] || buyuk(m[1])) : null;
  }
  /** A.iletken() çözümü → segment alanları (upd sırasıyla) ya da null */
  function segmentTanimi(c, ham) {
    if (!c || c.devre === 'OG') return null;
    if (c.aile === 'NYY' || c.aile === 'NAYY') {
      var q = +c.kesit, f = +c.fazSayisi, al = c.aile === 'NAYY';
      if (KESITLER.indexOf(q) < 0 || !(f >= 2 && f <= 4)) return null;
      var r = { tip: f === 2 ? (al ? 'kabloAlMono' : 'kabloMono') : (al ? 'kabloAl' : 'kabloCu'), kesit: q, yalitim: c.yalitim === 'xlpe' ? 'xlpe' : 'pvc' };
      if (f === 4 || f === 2) r.penEsit = true;
      else if (c.notr) r.penKesit = +c.notr;
      else r.notrYok = true;
      return r;
    }
    if (c.aile === 'ABC') {
      var faz = +c.fazSayisi, k = +c.kesit, ay = c.aydinlatma ? +c.aydinlatma : null, n = c.notr ? +c.notr : null;
      if ((faz !== 1 && faz !== 3) || !k) return null;
      var tam = faz + 'x' + k + (ay ? '+1x' + ay : '') + (n ? '+' + n : '');
      if (AER[tam]) return { tip: 'aer', aer: tam };
      var on = faz + 'x' + k + '+';
      var aday = Object.keys(AER).filter(function (x) { return x.indexOf(on) === 0 && (ay ? x.indexOf('+1x' + ay + '+') > 0 : x.indexOf('+1x') < 0); });
      if (!aday.length && ay) aday = Object.keys(AER).filter(function (x) { return x.indexOf(on) === 0 && x.indexOf('+1x') < 0; });
      if (!aday.length) return null;
      return { tip: 'aer', aer: aday[0], penKesit: n, not: 'araç tablosunda "' + ham + '" yok; aynı faz kesitli "' + aday[0] + '" satırı kullanıldı' + (n ? ', nötr (taşıyıcı) kesiti ' + n + ' mm² girildi' : '') + '.' };
    }
    if (c.aile === 'AAC' && c.tel) {
      var il = buyuk(c.tel), fs = +c.fazSayisi || 3;
      if (!HAVAI[il]) return null;
      var nt = egikNotr(ham) || (c.notr ? buyuk(c.notr) : null);
      if (nt && !HAVAI[nt]) nt = null;
      if (fs === 2) return { tip: 'havaiMono', iletken: il, notrIletken: nt || il };
      if (fs === 3) return nt ? { tip: 'havai', iletken: il, notrIletken: nt } : { tip: 'havai', iletken: il, notrYok: true };
      if (fs >= 4) return { tip: 'havai', iletken: il, notrIletken: nt || il };  // 4R, 5R: bütün teller aynı iletken
      return null;
    }
    return null;
  }
  /** Segmenti aracın kendi işlevleriyle ekler (upd: aracın nötr / PEN kesiti önerileri de işler) */
  function segmentEkle(k, x) {
    addSegment();
    var s = segments[segments.length - 1], id = s.id;
    upd(id, 'tip', k.tip);
    if (k.kesit != null) upd(id, 'kesit', k.kesit);
    if (k.iletken) upd(id, 'iletken', k.iletken);
    if (k.notrIletken) upd(id, 'notrIletken', k.notrIletken);
    if (k.aer) upd(id, 'aer', k.aer);
    if (k.penEsit) upd(id, 'penEsit', true);
    else if (k.penKesit != null && +k.penKesit !== +s.penKesit) upd(id, 'penKesit', k.penKesit);
    if (k.yalitim && k.yalitim !== s.yalitim) upd(id, 'yalitim', k.yalitim);
    upd(id, 'L', x.uzunluk);
    upd(id, 'adet', x.adet);
    if (x.bit != null && x.bit !== '') upd(id, 'dugumAd', String(x.bit));
    upd(id, 'cihaz', 'yok');
    return s;
  }
  function veri() { return typeof buildPrintData !== 'undefined' ? buildPrintData : null; }

  window.__SM_UYARLAMA = {
    notlar: [
      'Trafo gücü yalnız aracın listesindeki değerlerden seçilebilir (50, 100, 160, 250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500 kVA); listede olmayan güç (ör. 315 kVA) projeden aktarılmaz, elle seçim gerekir.',
      'uk ve bakır kaybı projede yoksa araç tablosundaki değerler kullanılır (50–1600 kVA BEST, 2000–2500 kVA Maksan kataloğu).',
      'Projede koruma cihazı bilgisi yoktur: cihaz kontrolü "Yok" olarak gelir. Kesit dayanımı (termik kontrol) iletken adında yalıtım yoksa PVC ve 0,2 s açma süresi varsayımıyla yapılır; gerçek değerler segmentlerde girilmelidir.',
      'Askılı demet (AER) kablolarda yalıtım PVC kabul edilir (k = 76); XLPE yalıtımlı kabul edilirse k = 94 olur. PVC varsayımı güvenli taraftadır.',
      'Araç tablosunda olmayan AER tipleri (ör. 2x16+25, 4x16+25, 1x50+70) aktarılamaz. Aynı faz kesitli satırı olan tiplerde (ör. 3x25+35, 3x120/16+120) o satır kullanılır ve nötr (taşıyıcı) kesiti projedeki değerle girilir.',
      'Çıplak AG hatlarda telefon yazımı "3P+R" faz Pansy, nötr Rose demektir; araç tertibi "3xPansy+Rose/Iris" ise Rose aydınlatma, Iris nötrdür. Nötrü belirtilmeyen hatlarda (ör. 3xR) aracın standart tertip nötrü alınır.',
      'Bir segment monofaz (1~) olunca sonraki bütün düğümlerde en büyük akım olarak 20 °C döngüsüyle hesaplanan I″k1 kullanılır.',
      'Tek hat şemasında trafo etiketi 36 kV sınıfında her zaman "31,5/0,4 kV", 15 kV sınıfında "10,5/0,4 kV" yazar (34,5 kV trafoda da). Uzun iletken adları komşu segmentin adının üstüne binebilir (aracın çizim düzeni); değerler etkilenmez.',
      'A4 raporda hat empedansı formüllerinde özgül iletkenlik her zaman 56/35 yazılır; IEC (54/34) seçildiğinde hesap 54/34 ile yapılır, yalnız rapor yazısı farklıdır. 2 telli monofaz havai hatta rapordaki R formülü kablo formülü gibi görünür; R değeri doğrudur.',
      'Düğümlerde kısa devre gücü (MVA) verilmez; araç akımları kA olarak verir.',
      'Aracın kendi "Kaydet" ile kaydedilen HTML kopyası açıldığında kayıtlı segmentler yüklenmez (aracın bilinen kusuru); Şebeke-M kendi kaydını kullandığı için bu düğmeler gizlenmiştir.'
    ],

    hazir: function () { return typeof calc === 'function' && !!el('segList') && !!veri(); },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
      ek = { eslenemeyen: [], beklenen: 0, istenenKVA: null };
      // Hesaba yazılmayan ama kararı belirleyen bağlam değerleri (güncellik denetimi için)
      var kullanilan = {};
      var yollar = {};
      function dolan(alan, deger, birim, yol, ham, kaynak) {
        if (yollar[yol]) return;
        yollar[yol] = 1;
        r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' });
      }
      function eksik(alan, sec, neden) { r.eksik.push({ alan: alan, sec: sec, neden: neden }); }
      var p = b.proje || {}, t = b.trafo || null, h = b.hat || null;
      var kt = t ? 'Trafo' + (t.no ? ' ' + t.no : '') : '';

      if (p.ad) { A.yaz('#pAd', p.ad); dolan('Proje adı', p.ad, '', 'proje.ad', p.ad, 'Proje'); }
      if (p.tarih) { var tr = String(p.tarih).slice(0, 10); A.yaz('#pTarih', tr); dolan('Tarih', tr, '', 'proje.tarih', p.tarih, 'Proje'); }
      if (t && t.no) { A.yaz('#pTr', String(t.no)); dolan('Trafo adı', String(t.no), '', 'trafo.no', t.no, kt); }
      if (h && h.no) { A.yaz('#pKol', String(h.no)); dolan('Çıkış kolu (hat)', String(h.no), '', 'hat.no', h.no, 'Hat'); }

      // Trafo: güç listeden, sınıf, araç tablosu (uk, Pcu), sonra projenin uk / Pcu / AG gerilimi
      if (t && sayiMi(t.gucKVA)) {
        if (secenekVar('tS', +t.gucKVA)) { A.yaz('#tS', String(+t.gucKVA)); dolan('Trafo gücü', +t.gucKVA, 'kVA', 'trafo.gucKVA', t.gucKVA, kt); }
        else {
          ek.istenenKVA = +t.gucKVA;
          kullanilan['trafo.gucKVA'] = t.gucKVA;
          eksik('Trafo gücü', '#tS', 'Projedeki ' + A.tr(+t.gucKVA) + ' kVA aracın listesinde yok (50…2500 kVA); sonuç bilgi amaçlıdır.');
        }
      } else eksik('Trafo gücü', '#tS', t ? 'Projede yok (araç 400 kVA ile açılır).' : 'Projede trafo yok (araç 400 kVA ile açılır).');
      if (t && sayiMi(t.ogKV)) {
        var sinif = +t.ogKV <= 17.5 ? '15' : '36';
        A.yaz('#tOG', sinif);
        dolan('OG gerilim sınıfı', sinif + ' kV\'a kadar', '', 'trafo.ogKV', t.ogKV, kt);
      } else eksik('OG gerilim sınıfı', '#tOG', 'Projede yok (araçta 36 kV sınıfı duruyor).');
      trafoAuto();
      if (t && sayiMi(t.uk)) { A.yaz('#tUk', +t.uk); dolan('Bağıl kısa devre gerilimi uk', +t.uk, '%', 'trafo.uk', t.uk, kt); }
      else eksik('Bağıl kısa devre gerilimi uk', '#tUk', 'Projede yok; araç tablosundaki %' + A.tr(+A.deger('#tUk'), 1) + ' kullanılıyor.');
      if (t && sayiMi(t.pcu)) { A.yaz('#tPcu', +t.pcu); dolan('Bakır kayıpları Pcu', +t.pcu, 'W', 'trafo.pcu', t.pcu, kt); }
      else eksik('Bakır kayıpları Pcu', '#tPcu', 'Projede yok; araç tablosundaki ' + A.deger('#tPcu') + ' W kullanılıyor.');
      if (t && sayiMi(t.agKV)) { var un = Math.round(+t.agKV * 1000); A.yaz('#tUn', un); dolan('İşletme gerilimi Un', un, 'V', 'trafo.agKV', t.agKV, kt); }
      else eksik('İşletme gerilimi Un', '#tUn', 'Projede yok (araçtaki 400 V duruyor).');
      if (t && sayiMi(t.adet) && +t.adet > 1) r.uyari.push('Projede ' + t.adet + ' paralel trafo var; araç tek trafo hesaplar.');
      if (ek.istenenKVA != null) r.uyari.push('Trafo gücü ' + A.tr(ek.istenenKVA) + ' kVA aracın listesinde yok: hesap ' + A.deger('#tS') + ' kVA ile yapılıyor, sonuç bilgi amaçlıdır.');

      // AG parçalar: trafodan çıkan zincir ya da seçili AG hattının açıklıkları
      var parcalar = [], ogSay = 0, hatKaynak = false;
      (b.zincir || []).forEach(function (z, i) {
        if (!z) return;
        var il = z.iletken || {}, c = A.iletken(il.ad);
        if ((il.devre || c.devre) === 'OG') { ogSay++; return; }
        parcalar.push({ il: il, c: c, uzunluk: z.uzunluk, bas: z.bas, bit: z.bit, yol: 'zincir[' + i + ']', ilYol: 'zincir[' + i + '].iletken', kaynak: 'Zincir ' + (i + 1) });
      });
      if (ogSay) r.uyari.push(ogSay + ' OG parça AG kısa devre hesabına alınmadı.');
      if (!parcalar.length && h && (h.acikliklar || []).length) {
        var k = -1;
        (h.iletkenler || []).forEach(function (il, j) { if (k < 0 && il && (il.devre || A.iletken(il.ad).devre) === 'AG') k = j; });
        if (k < 0 && /^(AG|AYDINLATMA)/.test(h.tur || '') && (h.iletkenler || []).length) k = 0;
        if (k >= 0) {
          hatKaynak = true;
          var hil = h.iletkenler[k], hc = A.iletken(hil.ad);
          h.acikliklar.forEach(function (a, i) {
            parcalar.push({ il: hil, c: hc, uzunluk: a && a.uzunluk, bas: a && a.bas, bit: a && a.bit, yol: 'hat.acikliklar[' + i + ']', ilYol: 'hat.iletkenler[' + k + ']', kaynak: 'Hat ' + (h.no || '') });
          });
        } else r.uyari.push('Seçilen hat AG hattı değil; AG segment bilgisi alınamadı.');
      }

      segments = [];
      uid = 0;
      var notlar = {};
      parcalar.forEach(function (x, n) {
        var no = n + 1, ad = x.il.ad || '?', kk = segmentTanimi(x.c, x.il.ad);
        ek.beklenen++;
        if (!kk) {
          ek.eslenemeyen.push({ sira: no, ad: ad, uzunluk: sayiMi(x.uzunluk) ? +x.uzunluk : null, bit: x.bit != null ? String(x.bit) : '' });
          kullanilan[x.ilYol + '.ad'] = x.il.ad == null ? null : x.il.ad;
          eksik((hatKaynak ? 'Açıklık ' : 'Segment ') + no + ' iletkeni (' + ad + ')', '#segList', 'Aracın listesinde karşılığı yok; segment zincirden çıkarıldı. "+ Segment Ekle" ile ekleyip ▲ ile ' + no + '. sıraya taşıyın.');
          return;
        }
        var L = sayiMi(x.uzunluk) && +x.uzunluk > 0 ? +x.uzunluk : 0;
        var s = segmentEkle(kk, { uzunluk: L, adet: sayiMi(x.il.adet) && +x.il.adet >= 1 ? Math.round(+x.il.adet) : 1, bit: x.bit });
        if (!L) eksik((hatKaynak ? 'Açıklık ' : 'Segment ') + no + ' uzunluğu', '#segList', 'Projede yok; segmentte uzunluğu (m) girin.');
        if (kk.not && !notlar[ad]) { notlar[ad] = 1; r.uyari.push(ad + ': ' + kk.not); }
        if (kk.notrYok && !notlar[ad + '#n']) {
          notlar[ad + '#n'] = 1;
          eksik((hatKaynak ? 'Hat' : 'Segment ' + no) + ' nötr iletkeni (' + ad + ')', '#segList', 'Adda nötr yok; aracın standart ' + (s.tip === 'havai' ? 'tertibindeki nötr (' + s.notrIletken + ')' : 'eşi (' + s.penKesit + ' mm²)') + ' alındı, segmentte kontrol edin.');
        }
        var tanim = segRX(s).tanim;
        dolan(hatKaynak ? 'Hat iletkeni' : 'Segment ' + no + ' iletkeni', tanim, '', x.ilYol + '.ad', x.il.ad, ad);
        if (sayiMi(x.il.adet)) dolan(hatKaynak ? 'Hat devre sayısı' : 'Segment ' + no + ' devre sayısı', Math.round(+x.il.adet), '', x.ilYol + '.adet', x.il.adet, x.kaynak);
        if (sayiMi(x.uzunluk)) dolan((hatKaynak ? 'Açıklık ' : 'Segment ') + no + ' uzunluğu', +x.uzunluk, 'm', x.yol + '.uzunluk', x.uzunluk, x.kaynak + (x.bas != null && x.bit != null ? ' (' + x.bas + '–' + x.bit + ')' : ''));
        if (x.bit != null && x.bit !== '') dolan((hatKaynak ? 'Açıklık ' : 'Segment ') + no + ' sonu (düğüm)', String(x.bit), '', x.yol + '.bit', x.bit, x.kaynak);
      });
      if (!parcalar.length) eksik('AG segment zinciri', '#segList', 'Projede trafodan çıkan AG hat / kablo bilgisi yok; "+ Segment Ekle" ile ekleyin.');
      if (segments.length) r.uyari.push('Koruma cihazı bilgisi projede yok: cihaz kontrolleri kapalı ("Yok"). Kesit dayanımı, iletken adında yalıtım yoksa PVC ve 0,2 s açma süresi varsayımıyla denetlendi; gerçek değerleri segmentlerde girin.');
      if (hatKaynak) r.uyari.push('Hat trafo AG barasından başlıyor kabul edildi; arada başka hat ya da kablo varsa segment olarak ekleyip ▲ ile başa taşıyın.');
      if (Object.keys(kullanilan).length) r.kullanilan = kullanilan;
      calc();
      return r;
    },

    hesapla: function () { calc(); },

    bolumGoster: function (bolum) {
      if (bolum !== 'tekhat') return;
      var kutu = el('sldBox'), kart = kutu && kutu.closest('.card');
      if (!kart) return;
      var ust = el('sm-ust'), h = ust ? ust.getBoundingClientRect().height : 0;
      window.scrollTo(0, Math.max(0, kart.getBoundingClientRect().top + (window.pageYOffset || 0) - h - 8));
    },

    sonuc: function (A) {
      var bp = veri();
      if (!bp || !bp.t) return { hata: 'Hesap sonucu yok.' };
      var t = bp.t, nodes = bp.nodes || [];
      var els = document.querySelectorAll('#segList .node');
      var bus = A.sayi((A.metin('#tBus').match(/=\s*([\d.]+)\s*kA/) || [])[1], '.');
      var kOk = 0, kNo = [], cOk = 0, cNo = [], nan = false, topL = 0;
      var satirlar = nodes.map(function (n, i) {
        var e = els[i], kb = e && e.querySelector('.nhead .badge'), cb = e && e.querySelector('.chk .badge');
        var ad = n.seg.dugumAd || (n.idx + '. Düğüm');
        if (kb) { if (kb.classList.contains('no')) kNo.push(ad); else kOk++; }
        if (cb) { if (cb.classList.contains('no')) cNo.push(ad); else cOk++; }
        if (![n.IkMax, n.Ik1, n.ip, n.Ith].every(isFinite)) nan = true;
        topL += +n.seg.L || 0;
        return [ad, n.rx.tanim, +n.seg.L || 0, yuvarla(n.sumR, 3), yuvarla(n.sumX, 3), yuvarla(n.mono ? n.Zloop20 : n.Zk, 3), n.mono ? A.tr(n.IkMax, 3) + ' (1~)' : yuvarla(n.IkMax, 3),
          yuvarla(n.kappa, 3), yuvarla(n.ip, 2), yuvarla(n.Ik1, 3), yuvarla(n.Ith, 3), n.kesitOK === null ? '—' : yuvarla(n.Smin, 1), n.kesitOK === null ? '—' : n.qEff,
          kb ? kb.textContent : '—', { tms: 'TMŞ', sya: 'SYA / NH', mcb: 'Minyatür kesici', yok: 'Yok' }[n.seg.cihaz] || '—', cb ? cb.textContent : '—'];
      });
      var son = nodes[nodes.length - 1], ilk = nodes[0];
      var girdiler = [
        { ad: 'Trafo gücü', deger: t.S, birim: 'kVA' },
        { ad: 'OG gerilim sınıfı', deger: A.secili('#tOG'), birim: '' },
        { ad: 'İşletme gerilimi Un', deger: t.Un, birim: 'V' },
        { ad: 'Bağıl kısa devre gerilimi uk', deger: +(t.uk * 100).toFixed(6), birim: '%' },
        { ad: 'Bakır kayıpları Pcu', deger: t.Pcu, birim: 'W' },
        { ad: 'Hesap yöntemi', deger: mode === 'vec' ? 'Vektörel (IEC 909)' : 'Skaler ΣZ (pratik)', birim: '' },
        { ad: 'Özgül iletkenlik', deger: kappaSet === 'iec' ? 'IEC 54/34' : 'EMO 56/35', birim: '' },
        { ad: 'Segment sayısı', deger: nodes.length, birim: '' },
        { ad: 'Toplam uzunluk', deger: +topL.toFixed(2), birim: 'm' }
      ];
      var d = [
        { ad: 'Trafo empedansı ZT', deger: t.ZT, birim: 'mΩ' },
        { ad: 'Trafo direnci RT', deger: t.RT, birim: 'mΩ' },
        { ad: 'Trafo reaktansı XT', deger: t.XT, birim: 'mΩ' },
        { ad: 'Trafo AG barası I″k3', deger: bus, birim: 'kA' },
        { ad: 'Önerilen TMŞ', deger: TMS[t.S] || null, birim: 'A' }
      ];
      if (son) {
        d.push(
          { ad: 'İlk düğüm I″k3', deger: ilk.IkMax, birim: 'kA' },
          { ad: son.mono ? 'Uç düğüm I″k1 (en büyük, 1~)' : 'Uç düğüm I″k3', deger: son.IkMax, birim: 'kA' },
          { ad: 'Uç düğüm ip', deger: son.ip, birim: 'kA' },
          { ad: 'Uç düğüm I″k1 (en küçük)', deger: son.Ik1, birim: 'kA' },
          { ad: 'Uç düğüm Ith', deger: son.Ith, birim: 'kA' },
          { ad: 'Kesiti yetersiz düğüm', deger: kNo.length, birim: '' },
          { ad: 'Koruması uygun olmayan düğüm', deger: cNo.length, birim: '' }
        );
      }
      var eksikSeg = ek.eslenemeyen.length && segments.length < ek.beklenen;
      var uy = [];
      if (ek.istenenKVA != null) uy.push('Projedeki trafo gücü ' + A.tr(ek.istenenKVA) + ' kVA aracın listesinde yok; hesap ' + t.S + ' kVA ile yapıldı.');
      if (eksikSeg) uy.push('Zincirdeki ' + ek.eslenemeyen.map(function (x) { return x.sira + '. parça (' + x.ad + ')'; }).join(', ') + ' aracın listesinde olmadığından hesaba girmedi; sonraki düğümlerin sonuçları eksik empedansla hesaplandı.');
      if (son && !cOk && !cNo.length) uy.push('Koruma cihazı kontrolü yapılmadı (cihaz bilgisi yok).');
      if (nodes.some(function (n) { return n.kesitOK !== null && +n.seg.tkd === 0.2; })) uy.push('Kesit dayanımı 0,2 s açma süresiyle denetlendi; koruma açma süresi farklıysa segmentlerde girin.');
      if (kNo.length) uy.push('Kesit dayanımı YETERSİZ: ' + kNo.join(', ') + '.');
      if (cNo.length) uy.push('Koruma cihazı UYGUN DEĞİL: ' + cNo.join(', ') + '.');
      if (nodes.some(function (n) { return n.mono; })) uy.push('Monofaz segmentten sonraki düğümlerde en büyük akım olarak I″k1 (1~) kullanıldı.');
      if (nan) uy.push('Bazı düğümlerde sonuç hesaplanamadı (girdileri kontrol edin).');
      var durum = 'bilgi';
      if (!son || nan || ek.istenenKVA != null || eksikSeg) durum = 'bilgi';
      else if (kNo.length || cNo.length) durum = 'uygun-degil';
      else if (kOk || cOk) durum = 'uygun';
      var ozet = t.S + ' kVA trafo, bara I″k3 ' + A.tr(bus, 2) + ' kA' +
        (son ? ' · ' + nodes.length + ' düğüm · uç ' + (son.seg.dugumAd || son.idx + '. Düğüm') + ': ' + (son.mono ? 'I″k1max ' : 'I″k3 ') + A.tr(son.IkMax, 2) + ' kA, I″k1min ' + A.tr(son.Ik1, 3) + ' kA' +
          ' · kesit ' + kOk + '/' + (kOk + kNo.length) + ' dayanır' + (cOk + cNo.length ? ' · koruma ' + cOk + '/' + (cOk + cNo.length) + ' uygun' : '') : ' · segment yok');
      return {
        ozet: ozet, durum: durum, girdiler: girdiler, degerler: d,
        tablo: { basliklar: ['Düğüm', 'Segment', 'L (m)', 'ΣR (mΩ)', 'ΣX (mΩ)', 'Zk (mΩ)', 'I″k3 / I″k1max (kA)', 'κ', 'ip (kA)', 'I″k1 min (kA)', 'Ith (kA)', 'Smin (mm²)', 'Kesit (mm²)', 'Kesit kontrolü', 'Koruma', 'Koruma kontrolü'], satirlar: satirlar },
        uyarilar: uy
      };
    },

    durumAl: function () { return { v: 1, arac: JSON.parse(JSON.stringify(stateObj())), ek: JSON.parse(JSON.stringify(ek)) }; },

    durumYukle: function (d) {
      var st = d && d.arac ? d.arac : d;
      if (!st) return;
      ek = d && d.ek ? JSON.parse(JSON.stringify(d.ek)) : { eslenemeyen: [], beklenen: 0, istenenKVA: null };
      applyState(JSON.parse(JSON.stringify(st)));
      // applyState sayaç olarak st.uid||100 alır; segment kimlikleriyle çakışmasın
      segments.forEach(function (s) { if (+s.id > uid) uid = +s.id; });
      calc();
    }
  };
})();
