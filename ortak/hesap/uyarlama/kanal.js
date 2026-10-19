/* Şebeke-M uyarlaması: Kanal Planı (kanal). Hesap kodlarına, kurallarına ve kablo kataloğuna dokunmaz; aracın veri
   modelini (state.tipler) projeden kurar, aracın kendi işlevlerini (goc, guncelle, fitView, derinlik,
   tipGerekliGenislik, stdGenislik, metrajToplam, tipPrimleri, capBul) çağırır ve sonuçları bunlardan okur.
   - Projedeki kanal (ya da yeraltı hattı) TEK kanal tipi olarak kurulur: kaplama zeminden, kablolar iletken
     adlarından (aracın kataloğundaki kesit), uzunluk metraja. Aracın açılıştaki örnek tipi (54+145+24) silinir.
   - Kablo dış çapı her zaman katalogdan yazılır: araçta OG kablonun kesiti listeden değiştirilince çap güncellenmiyor.
   - Kanal rengi (DXF katman rengi) her tipe verilir; boş kalırsa DXF dosyası bozuk çıkıyordu.
   - Çizim gizliyken (telefonda Ayarlar sekmesi) "sığdır" yapılmaz: ölçek eksiye düşüp çizim hata veriyordu.
   - Proje kanal genişliği / derinliği verirse aracın bulduğu dip genişliği ve derinlikle karşılaştırılır. */
(function () {
  'use strict';
  var ZEMIN = [   // proje zemini → aracın kaplama seçeneği
    [/asfalt/, 'Asfalt'], [/beton/, 'Beton'], [/parke|kilit|tretuvar|kaldırım|kaldirim/, 'Parke'],
    [/toprak|tuvenan|tüvenan|tüvenen|tuvenen|branşman kanal|bransman kanal|stabilize|çakıl|cakil/, 'Yok']
  ];
  var ek = { acik: [], kaynak: null, proje: null };   // açık eksikler (kayıttan), karşılaştırma için proje ölçüleri

  function el(id) { return document.getElementById(id); }
  function sayiMi(v) { return v !== null && v !== undefined && v !== '' && isFinite(+v); }
  function temiz(s) { return String(s == null ? '' : s).replace(/[<>"'&]/g, '').trim(); }
  function kesitYaz(n) { return String(n).replace('.', ','); }   // katalog anahtarı: '2x1,5', '3x150+70'
  function trSayi2(v) { return String(Math.round(v * 100) / 100); }   // metraj: nokta ondalık (araç virgülü ayırıcı sayar)
  function ciziliyor() { var w = el('cwrap'); return !!(w && w.clientWidth > 60 && w.clientHeight > 60); }
  var sigdirBekle = false;   // çizim gizliyken (telefonda Ayarlar sekmesi) sığdırma, çizim sekmesi açılınca yapılır
  function sigdir() {
    if (ciziliyor()) { sigdirBekle = false; try { fitView(); } catch (e) { /* */ } }
    else sigdirBekle = true;
  }
  // Aracın sığdırma ve çizim işlevleri yalnız görünür tuvalde çalışır: gizli (0 × 0) tuvalde ölçek eksiye düşüp
  // her çizimde hata veriyordu (çizim davranışı; hesaba etkisi yok). Aracın açılışta kurduğu setTimeout(fitView, 60)
  // ve sekme geçişindeki ciz() çağrıları bu sarmalayıcılardan geçer.
  (function () {
    var asilFit = fitView, asilCiz = ciz;
    window.fitView = function () {
      if (!ciziliyor()) { sigdirBekle = true; return; }
      sigdirBekle = false;
      return asilFit.apply(this, arguments);
    };
    window.ciz = function () {
      if (!(view.scale > 0)) view.scale = 3.2;   // aracın açılış ölçeği
      return asilCiz.apply(this, arguments);
    };
    var b = el('tabCiz');
    if (b) b.addEventListener('click', function () { if (sigdirBekle) setTimeout(sigdir, 80); });
    window.addEventListener('resize', function () { if (sigdirBekle) setTimeout(sigdir, 80); });
  })();
  function anaTip() { return (state.tipler || []).filter(function (t) { return detayTuru(t) === 'kesit'; })[0] || null; }

  /** Proje iletkeni → aracın kablo kaydı: { kablo } ya da { neden } */
  function kabloKur(il, A) {
    var c = A.iletken(il.ad);
    var adet = sayiMi(il.adet) && +il.adet >= 1 ? Math.round(+il.adet) : 1;
    if (c.aile === 'NAYY' || c.aile === 'NYY') {
      if (!c.fazSayisi || !c.kesit) return { neden: 'kesit okunamadı' };
      var k = c.fazSayisi + 'x' + kesitYaz(c.kesit) + (c.notr ? '+' + kesitYaz(c.notr) : '');
      if (!KATALOG[c.aile][k]) return { neden: 'aracın ' + c.aile + ' kataloğunda ' + k + ' yok' };
      return { kablo: { sinif: 'AG', adet: adet, tip: c.aile, kesit: k, cap: capBul(c.aile, k), muhafaza: 'yok' }, ad: c.aile + ' ' + k };
    }
    if (c.aile === 'XLPE-AL' || c.aile === 'XLPE-CU') {
      var tip = c.aile === 'XLPE-AL' ? 'OG-Al' : 'OG-Cu';
      if (!c.kesit) return { neden: 'kesit okunamadı' };
      var on = '1x' + kesitYaz(c.kesit) + '/', kes = c.ekran ? on + kesitYaz(c.ekran) : null, not = '';
      if (!kes) {   // ekran kesiti yazılmamış: katalogda o kesitin tek bir ekranlı kaydı varsa o
        var aday = Object.keys(KATALOG[tip]).filter(function (x) { return x.indexOf(on) === 0; });
        if (aday.length === 1) { kes = aday[0]; not = 'ekran kesiti katalogdan'; }
      }
      if (!kes || !KATALOG[tip][kes]) return { neden: 'aracın ' + tip + ' kataloğunda ' + (kes || on + '…') + ' yok' };
      return { kablo: { sinif: 'OG', adet: adet, tip: tip, kesit: kes, cap: capBul(tip, kes), muhafaza: 'yok' }, ad: tip + ' ' + kes, not: not };
    }
    if (c.aile === 'ACSR' || c.aile === 'AAC' || c.aile === 'ABC') return { neden: 'havai hat iletkeni, yeraltı kablosu değil' };
    return { neden: 'kablo adı tanınmadı' };
  }

  /** Köprünün eksik listesinde girilmemiş (ve karara etkili) alanlar + kayıttan dönen açık eksikler */
  function acikEksikler() {
    var S = window.__SM && window.__SM.durum, l = [];
    ((S && S.eksik) || []).forEach(function (x) { if (!x.girildi && x.karar !== false) l.push({ alan: x.alan, sec: x.sec }); });
    ek.acik.forEach(function (x) { if (!l.some(function (y) { return y.alan === x.alan; })) l.push(x); });
    return l;
  }
  function acikIzle() {
    ek.acik.forEach(function (x) {
      var e = x.sec ? document.querySelector(x.sec) : null;
      if (!e) return;
      var f = function () { ek.acik = ek.acik.filter(function (y) { return y !== x; }); e.removeEventListener('input', f); e.removeEventListener('change', f); };
      e.addEventListener('input', f); e.addEventListener('change', f);
    });
  }
  /** Çizim etiketinden kazı (aracın kendi yazdığı değer): 'm³' toplam ya da 'm³/m' metre başına */
  function etiketHacim(t, metrajli, A) {
    var kopya = JSON.parse(JSON.stringify(t));
    if (!metrajli) kopya.metraj = '';
    var p = tipPrimleri(kopya, 0).P.filter(function (x) { return x.t === 'text' && /m³/.test(x.s); })[0];
    return p ? A.sayi(p.s, ',') : NaN;
  }

  // Ekranda çizim renkleri: zemin laciverde, beyaz çizgiler açık laciverde. Yazdırmada (aracın Yazdır düğmesi:
  // beyaz kâğıt, siyah çizgi) ve tarayıcının kendi yazdırmasında aracın renkleri aynen kalır.
  (function () {
    if (typeof ctx === 'undefined' || !ctx) return;
    var RENK = { '#05070b': '#0b1326', '#ffffff': '#dae2fd', '#808080': '#7b8aa6' };
    var ekranda = function () {
      if (yazdirModu || !document.documentElement.classList.contains('sm-var')) return false;
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
    // tarayıcı yazdırma önizlemesi: yazdırma ortamına geçince ve dönünce çizim yenilenir
    var yenile = function () { try { if (!yazdirModu) ciz(); } catch (e) { /* */ } };
    window.addEventListener('beforeprint', yenile);
    window.addEventListener('afterprint', yenile);
    try { if (window.matchMedia) window.matchMedia('print').addEventListener('change', yenile); } catch (e) { /* */ }
  })();

  window.__SM_UYARLAMA = {
    notlar: [
      'Kanal dip genişliği kablo dizilişinden TEDAŞ açıklık kurallarıyla bulunur (kablo-kablo ve kablo-duvar en az 7 cm ya da kablo çapı, tek damarlı sistemler arası en az 14 cm ya da 2 çap, AG-OG arası 14 cm ve koruyucu tuğla; borulu ×1,5, büzlü ×2) ve 10 cm\'lik dilime yukarı yuvarlanır (en az 40 cm, abone 20 cm). Derinlik 1 katta 80 cm, her ilave kat +30 cm (abone 50, yol geçişi 100); kablo istifi daha derin gerektirirse o.',
      'Araçta OG kablonun kesiti listeden değiştirilince kablo dış çapı güncellenmez (eski çap kalır, kanal dar çıkar). Şebeke-M doldururken çapı katalogdan yazar; sonradan kesit değiştirirseniz çap kutusunu kontrol edin. Katalogla uyuşmayan çap sonuçta uyarılır.',
      'Durum çubuğundaki "Toplam kazı" dip genişliği × derinlik × metraj ile hesaplanır (şev payı dahil değil); çizimdeki kazı yazısı şevli kesitte trapez alanını kullanır. Sonuçta ikisi de verilir.',
      'Metrajda ondalık nokta ile yazılır: araç virgülü ayırıcı sayar (54,5 → 54 + 5).',
      'Projede kablo dizilişi (kat düzeni), muhafaza (boru / büz), kanal kesiti (şevli / düz) ve dolgu malzemesi yoktur: kablolar tek katta OG solda, AG sağda, muhafazasız dizilir; dolgu yalnız çizim yazısıdır.',
      'Projedeki kanal genişliği aracın 10 cm dilimli dip genişliğiyle, derinliği aracın derinliğiyle karşılaştırılır.',
      'Aracın kataloğunda olmayan kablolar (ör. NAYY 4x16) eklenmez; çapını elle girerek ekleyin. Havai hat iletkenleri kanala alınmaz.'
    ],
    hazir: function () { return typeof guncelle === 'function' && typeof state === 'object' && !!state && Array.isArray(state.tipler); },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
      var dol = function (alan, deger, birim, yol, ham, kaynak) { r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' }); };
      ek.acik = [];
      var kn = b.kanal || null, hat = !kn && b.hat && (b.hat.havai === false || /YERALTI/.test(b.hat.tur || '')) ? b.hat : null;
      var kok = kn ? 'kanal' : hat ? 'hat' : null;
      var t = {
        no: 1, uid: 'k' + Date.now().toString(36), ad: '', kaynak: null, renk: RENK_SIRA[0], genislik: 40, genislikManuel: null,
        kaplama: 'Yok', kaplamaKal: null, dolgu: 'Tüvenen', metraj: '', sevli: false, tur: 'Standart', detay: 'kesit', donusAci: 90,
        katlar: [{ kablolar: [] }]
      };
      // ---- ad
      var no = kn ? kn.no : hat ? hat.no : null;
      if (no != null && no !== '' && temiz(no)) { t.ad = temiz(no); dol(kn ? 'Kanal no' : 'Hat no', t.ad, '', kok + '.no', no); }
      // ---- kaplama (zemin)
      var zemin = kn ? kn.zemin : null;
      if (zemin) {
        var z = String(zemin).toLocaleLowerCase('tr'), k = ZEMIN.filter(function (x) { return x[0].test(z); })[0];
        if (k) { t.kaplama = k[1]; dol('Kaplama (zemin)', k[1] === 'Yok' ? 'kaplamasız' : k[1], '', 'kanal.zemin', zemin, zemin); }
        else r.eksik.push({ alan: 'Kaplama', sec: '#editsec', neden: 'Projedeki zemin "' + zemin + '" aracın kaplama seçeneklerine (yok / parke / asfalt / beton) eşlenemedi; seçin' });
      } else {
        r.eksik.push({ alan: 'Kaplama', sec: '#editsec', neden: kok ? 'Projede zemin bilgisi yok; kaplamayı seçin (kaplamasız / parke / asfalt / beton)' : 'Projede kanal yok; kaplamayı seçin' });
      }
      // ---- metraj
      var uz = kn ? kn.uzunluk : hat ? hat.toplamUzunluk : null;
      if (sayiMi(uz) && +uz > 0) { t.metraj = trSayi2(+uz); dol('Metraj', +uz, 'm', kok + (kn ? '.uzunluk' : '.toplamUzunluk'), uz); }
      else r.eksik.push({ alan: 'Metraj', sec: '#editsec', neden: 'Projede kanal uzunluğu yok; metrajı girin (kazı hacmi için)', karar: false });
      // ---- kablolar
      var liste = kn ? (kn.kablolar || []) : hat ? (hat.iletkenler || []) : [];
      var yolOn = kn ? 'kanal.kablolar' : 'hat.iletkenler';
      var og = [], ag = [];
      liste.forEach(function (il, i) {
        if (!il || !il.ad) return;
        var s = kabloKur(il, A);
        if (s.kablo) {
          (s.kablo.sinif === 'OG' ? og : ag).push(s.kablo);
          dol('Kablo ' + (i + 1), s.kablo.adet + ' × ' + s.ad + (s.kablo.sinif === 'OG' ? ' (devre)' : ''), '', yolOn + '[' + i + '].ad', il.ad, il.ad);
          if (s.not) r.uyari.push('Kablo ' + (i + 1) + ' (' + il.ad + '): ' + s.not + ' (' + s.kablo.kesit + ').');
        } else {
          dol('Kablo ' + (i + 1), 'eklenmedi', '', yolOn + '[' + i + '].ad', il.ad, il.ad);
          r.eksik.push({ alan: 'Kablo ' + (i + 1) + ' (' + il.ad + ')', sec: '#editsec', neden: s.neden + '; kanala elle ekleyin' });
        }
        if (sayiMi(il.adet)) dol('Kablo ' + (i + 1) + ' adedi', +il.adet, il.devre === 'OG' || (s.kablo && s.kablo.sinif === 'OG') ? 'devre' : 'adet', yolOn + '[' + i + '].adet', il.adet);
      });
      var kablolar = og.concat(ag);   // tek kat: OG solda, AG sağda (araya koruyucu eleman araç koyar)
      if (kablolar.length) {
        t.katlar = [{ kablolar: kablolar }];
        r.uyari.push('Kablolar tek katta yan yana dizildi' + (og.length && ag.length ? ' (OG solda, AG sağda; araya koruyucu eleman)' : '') + ', muhafazasız. Katlı döşeme ya da boru / büz varsa düzenleyin; genişlik ve derinlik değişir.');
      } else {
        t.katlar = [{ kablolar: [yeniKablo('AG', 3)] }];
        r.eksik.push({ alan: 'Kablolar', sec: '#editsec', neden: liste.length ? 'Projedeki kabloların hiçbiri aracın kataloğunda yok; aracın örnek kablosu (3 × NAYY 3x240+120) duruyor, kabloları girin' : 'Projede kablo bilgisi yok; aracın örnek kablosu (3 × NAYY 3x240+120) duruyor, kabloları girin' });
      }
      // ---- kanal kesiti (şevli / düz): projede yok
      r.eksik.push({ alan: 'Kanal kesiti (şevli / düz)', sec: '#editsec', neden: 'Projede yok; düz (şevsiz) kabul edildi, şevli ise seçin (kazı hacmi değişir)', karar: false });
      // ---- karşılaştırma için proje ölçüleri
      ek.proje = {};
      if (kn && sayiMi(kn.genislik) && +kn.genislik > 0) { ek.proje.genislik = +kn.genislik; dol('Projedeki kanal genişliği', +kn.genislik, 'cm', 'kanal.genislik', kn.genislik); }
      if (kn && sayiMi(kn.derinlik) && +kn.derinlik > 0) { ek.proje.derinlik = +kn.derinlik; dol('Projedeki kanal derinliği', +kn.derinlik, 'cm', 'kanal.derinlik', kn.derinlik); }
      if (!kok) r.uyari.push('Hedef bir kanal ya da yeraltı hattı değil: kanal tipini elle kurun.');

      // aracın modeli tamamen değiştirilir (açılıştaki örnek tip ve tarayıcı belleğinden kalan tipler gider)
      state = { tipler: [t], sayac: 1, secili: 0 };
      goc();
      guncelle();
      sigdir();
      if (r.eksik.some(function (x) { return x.karar !== false; }) && typeof mobil === 'function' && mobil()) sekme('ayar');
      return r;
    },

    hesapla: function () { guncelle(); sigdir(); },

    sonuc: function (A) {
      var t = anaTip();
      if (!t) return { hata: 'Kanal kesiti tipi yok: bir kanal ekleyin.' };
      var H = derinlik(t), W = t.genislik, AG = W + (t.sevli !== false ? G.SEV * 2 : 0);
      var gerek = tipGerekliGenislik(t), stdW = stdGenislik(gerek, TURLER[tur(t)].minG);
      var uz = metrajToplam(t.metraj);
      var alan = etiketHacim(t, false, A), hacim = uz > 0 ? etiketHacim(t, true, A) : 0;
      var topMetraj = metrajToplam(state.tipler.map(function (x) { return x.metraj || ''; }).join('+'));
      var cubukKazi = A.sayi(A.metin('#stKazi'), ',');
      var uy = [], bilgi = false;
      if (t.genislikManuel && t.genislikManuel < Math.ceil(gerek)) uy.push('Elle girilen genişlik (' + t.genislikManuel + ' cm) şartnamenin gerektirdiğinden (' + Math.ceil(gerek) + ' cm) küçük; araç ' + W + ' cm aldı.');
      if (H < 60) uy.push('Kanal derinliği ' + H + ' cm: zorunlu hallerde dahi en az 60 cm olmalı (Md.2-b).');
      state.tipler.forEach(function (x) {
        x.katlar.forEach(function (kat, ki) {
          kat.kablolar.forEach(function (kb) {
            var kt = kb.sinif === 'OG' ? (kb.tip === 'OG-Cu' ? 'OG-Cu' : 'OG-Al') : (kb.tip || 'NAYY'), c = capBul(kt, kb.kesit);
            if (c && Math.abs(c - (+kb.cap || 0)) > 1e-6) {
              uy.push(tipAdi(x) + ', ' + (ki + 1) + '. kat: ' + kb.sinif + ' ' + kb.kesit + ' kablosunun çapı ' + A.tr(+kb.cap, 2) + ' cm, katalogda ' + A.tr(c, 2) + ' cm (elle değiştirilmediyse çapı düzeltin).');
              if (kb.sinif === 'OG') bilgi = true;
            }
          });
        });
      });
      if (isFinite(cubukKazi) && hacim > 0 && Math.abs(cubukKazi - hacim) > 0.01 && state.tipler.length === 1) uy.push('Durum çubuğundaki toplam kazı (' + A.tr(cubukKazi, 2) + ' m³) dip genişliği × derinlikle hesaplanır; çizimdeki trapez kazı ' + A.tr(hacim, 2) + ' m³.');
      if (acikEksikler().length) bilgi = true;   // köprü kayıtta her girilmemiş eksik için ayrıca not düşer
      if (ek.acik.length) uy.push('Kayıtta girilmemiş bilgiler: ' + ek.acik.map(function (x) { return x.alan; }).join(', ') + '.');
      // proje ölçüleriyle karşılaştırma
      var p = ek.proje || {}, durum = 'bilgi', kars = [];
      if (p.genislik != null) kars.push(p.genislik >= stdW ? null : 'genişlik ' + p.genislik + ' cm < ' + stdW + ' cm');
      if (p.derinlik != null) kars.push(p.derinlik >= H ? null : 'derinlik ' + p.derinlik + ' cm < ' + H + ' cm');
      var kotu = kars.filter(Boolean);
      if (kotu.length) { durum = 'uygun-degil'; uy.push('Projedeki kanal ' + (bilgi ? 'şimdiki girdilerle ' : '') + 'yetersiz: ' + kotu.join(', ') + '.'); }
      else if (p.genislik != null && p.derinlik != null) durum = 'uygun';
      if (bilgi) durum = 'bilgi';   // girdiler eksikse (ör. kablolar aracın örneğiyle) karar verilmez
      var kablo = t.katlar.map(function (k) { return k.kablolar.map(function (x) { return x.adet + '×' + (x.sinif === 'OG' ? '3(' + x.kesit + ')' : x.kesit) + ' ' + (x.tip || ''); }).join(' + '); }).join(' / ');
      return {
        ozet: tipAdi(t) + ': dip ' + W + (AG !== W ? ' / ağız ' + AG : '') + ' × derinlik ' + H + ' cm · ' + A.tr(uz, 2) + ' m · kazı ' + A.tr(hacim, 2) + ' m³' + (durum === 'uygun' ? ' · proje kanalı yeterli' : durum === 'uygun-degil' ? ' · proje kanalı yetersiz' : ''),
        durum: durum,
        girdiler: [
          { ad: 'Kanal türü', deger: tur(t), birim: '' },
          { ad: 'Kaplama', deger: t.kaplama === 'Yok' ? 'kaplamasız' : t.kaplama + ' ' + kaplamaKal(t) + ' cm', birim: '' },
          { ad: 'Kanal kesiti', deger: t.sevli !== false ? 'şevli (trapez)' : 'düz (şevsiz)', birim: '' },
          { ad: 'Kat sayısı', deger: t.katlar.length, birim: '' },
          { ad: 'Kablolar', deger: kablo, birim: '' },
          { ad: 'Metraj', deger: uz, birim: 'm' },
          { ad: 'Projedeki kanal genişliği', deger: p.genislik != null ? p.genislik : '—', birim: p.genislik != null ? 'cm' : '' },
          { ad: 'Projedeki kanal derinliği', deger: p.derinlik != null ? p.derinlik : '—', birim: p.derinlik != null ? 'cm' : '' }
        ],
        degerler: [
          { ad: 'Kanal dip genişliği', deger: W, birim: 'cm' },
          { ad: 'Kanal ağız genişliği', deger: AG, birim: 'cm' },
          { ad: 'Kanal derinliği', deger: H, birim: 'cm' },
          { ad: 'Gereken dip genişliği (şartname)', deger: Math.round(gerek * 10) / 10, birim: 'cm' },
          { ad: 'Standart dip genişliği (10 cm dilim)', deger: stdW, birim: 'cm' },
          { ad: 'Kesit alanı (metre başına kazı)', deger: alan, birim: 'm³/m' },
          { ad: 'Kazı hacmi (çizim)', deger: hacim, birim: 'm³' },
          { ad: 'Toplam metraj', deger: topMetraj, birim: 'm' },
          { ad: 'Toplam kazı (araç durum çubuğu)', deger: cubukKazi, birim: 'm³' }
        ],
        tablo: {
          basliklar: ['Tip', 'Detay', 'Tür', 'Dip (cm)', 'Ağız (cm)', 'Derinlik (cm)', 'Gereken dip (cm)', 'Kaplama', 'Metraj (m)'],
          satirlar: state.tipler.map(function (x) {
            var kes = detayTuru(x) === 'kesit';
            return [tipAdi(x), DETAYLAR[detayTuru(x)].ad, tur(x), x.genislik, x.genislik + (kes && x.sevli !== false ? G.SEV * 2 : 0), kes ? derinlik(x) : '—', Math.ceil(tipGerekliGenislik(x)), x.kaplama === 'Yok' ? 'kaplamasız' : x.kaplama, metrajToplam(x.metraj)];
          })
        },
        uyarilar: uy
      };
    },

    durumAl: function () {
      return { surum: 1, model: JSON.parse(projeJSON()), proje: ek.proje || {}, acik: acikEksikler() };
    },

    durumYukle: function (s) {
      s = s || {};
      var m = s.model && Array.isArray(s.model.tipler) ? JSON.parse(JSON.stringify(s.model)) : { tipler: [], sayac: 0, secili: -1 };
      m.tipler.forEach(function (t, i) { if (t.renk == null) t.renk = RENK_SIRA[i % RENK_SIRA.length]; });
      if (typeof m.secili !== 'number') m.secili = m.tipler.length ? 0 : -1;
      state = m;
      goc();
      guncelle();
      sigdir();
      ek.proje = s.proje || {};
      ek.acik = Array.isArray(s.acik) ? s.acik.slice() : [];
      acikIzle();
    }
  };
})();
