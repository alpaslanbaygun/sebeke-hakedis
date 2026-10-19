/* Şebeke-M uyarlaması: AG Gerilim Düşümü ve Güç Kaybı (ag-gd). Hesap kodlarına dokunmaz: hat listesini (kols) ve
   genel alanları yazar, aracın kendi işlevlerini (render, calc, ownLoad, gatherState, commitPending) çağırır,
   sonuçları okur.
   Bilinen araç davranışları (uyarlama bunlara göre çalışır):
   - Tablo her değişiklikte baştan çizilir, hücrelerin kimliği yoktur → hücreler satır adıyla bulunur.
   - Kablo, hat türüne (Havai / Yeralti) ait listede yoksa hat toplamdan sessizce düşer ve araç yine "UYGUN" gösterebilir
     → kablo eşlenemeyen hat eksik işaretlenir, sonuç 'bilgi' olur.
   - İşletme gerilimi volt olarak girilir (0,4 kV → 400 V).
   - Aracın gömülü durum yükleyicisi çağrılamaz (adsız, açılışta bir kez çalışır) ve boş diversiteyi 0,98, boş cos φ'yi
     0,80 yapar (hesap 1 ve 0,8 kullanır) → durum aynı alanlarla, değerler değiştirilmeden geri yazılır. */
(function () {
  'use strict';
  var YUK_ALAN = 'Yükler (W)';
  var AAC3 = { ROSE: '5R', PANSY: '4P/R', POPPY: '4Po/R', ASTER: '3A+R/P' };   // üç fazlı + nötr çıplak iletken
  var izleniyor = false;

  function el(id) { return document.getElementById(id); }
  function bos(v) { return v === null || v === undefined || v === ''; }
  function sayiMi(v) { return typeof v === 'number' && isFinite(v); }
  function yuvarla(v, n) { var k = Math.pow(10, n); return Math.round(v * k) / k; }
  function sayiYazi(v) { return String(Math.round(v * 1e6) / 1e6); }
  /** Araç adları value="…" içine tırnaksız yazar: tırnak ve açılı ayraçlar zararsız karakterlere çevrilir. */
  function guvenli(s) { return String(s == null ? '' : s).replace(/"/g, '\'').replace(/</g, '‹').replace(/>/g, '›').replace(/&/g, '＆'); }
  function kabloBul(ad, tip) {
    for (var i = 0; i < CABLES.length; i++) if (CABLES[i].ad === ad && (!tip || CABLES[i].tip === tip)) return CABLES[i];
    return null;
  }
  /** Tablo satırının sırası (1'den), satır adıyla bulunur. */
  function satirNo(etiket) {
    var tr = document.querySelectorAll('#sheet tr');
    for (var i = 0; i < tr.length; i++) { var l = tr[i].querySelector('.rowlabel'); if (l && l.textContent.trim() === etiket) return i + 1; }
    return 0;
  }
  function hucreSec(etiket, i, ic) { var n = satirNo(etiket); return n ? '#sheet tr:nth-child(' + n + ') > td:nth-child(' + (i + 2) + ') ' + ic : '#sheet'; }
  function t(A, v, n) { return sayiMi(v) ? A.tr(v, n) : '—'; }

  /** Bağlamdaki iletken adını aracın kablo listesindeki ada (ve hat türüne) çevirir. */
  function eslestir(il, A) {
    if (!il || bos(il.ad)) return { neden: 'Projede iletken bilgisi yok' };
    var ham = String(il.ad).trim(), dogrudan = kabloBul(ham);
    if (dogrudan) return { cable: dogrudan.ad, tip: dogrudan.tip };
    var c = A.iletken(ham), sk = ham.toUpperCase().replace(/İ/g, 'I').replace(/\s+/g, ''), aday = [], tip = null;
    if (c.devre === 'OG') return { neden: '"' + ham + '" bir OG iletkeni; AG hesabında kullanılamaz' };
    if (c.aile === 'ABC') {
      tip = 'Havai';
      if ((c.fazSayisi === 1 || c.fazSayisi === 3) && c.kesit && c.notr) {
        aday.push(c.fazSayisi + 'x' + sayiYazi(c.kesit) + (c.aydinlatma ? '/' + sayiYazi(c.aydinlatma) : '') + '+' + sayiYazi(c.notr) + ' ALP.');
      }
    } else if (c.aile === 'AAC') {
      tip = 'Havai';
      CABLES.forEach(function (x) { if (x.tip === 'Havai' && x.ad.toUpperCase().replace(/\s+/g, '') === sk) aday.push(x.ad); });
      // "3P+R" gibi üç faz + nötr yazımı: faz iletkenine göre aracın üç fazlı satırı (nötr yükü taşımaz)
      if (!aday.length && c.fazSayisi === 3 && c.notr && AAC3[c.tel]) aday.push(AAC3[c.tel]);
    } else if (c.aile === 'NYY' || c.aile === 'NAYY') {
      tip = 'Yeralti';
      var ek = /NA2XH/.test(sk) ? 'NA2XH' : /N2XH/.test(sk) ? 'N2XH' : (/NAYY/.test(sk) || (/NYY/.test(sk) && /ALM/.test(sk))) ? 'NAYY' : /NYY/.test(sk) ? 'NYY' : null;
      if (ek) {
        var tek = ham.match(/(\d)\s*[xX×]?\s*\(\s*1\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);   // "4(1x95)" tek damarlı takım
        if (tek) aday.push(tek[1] + '(1x' + sayiYazi(parseFloat(tek[2].replace(',', '.'))) + ') ' + ek);
        else if (c.fazSayisi && c.kesit) {
          var S = c.fazSayisi + 'x' + sayiYazi(c.kesit);
          if (c.notr) { aday.push(S + '+' + sayiYazi(c.notr) + ' ' + ek); aday.push(S + '/' + sayiYazi(c.notr) + ' ' + ek); }
          else aday.push(S + ' ' + ek);
        }
      }
    }
    for (var j = 0; j < aday.length; j++) { var k = kabloBul(aday[j], tip); if (k) return { cable: k.ad, tip: k.tip }; }
    return { tip: tip, neden: '"' + ham + '" aracın kablo listesinde yok' };
  }

  /** AG hattaki iletken: devresi AG olan ilk iletken (müşterek hatta OG iletkeni atlanır). */
  function agIletkeni(liste, A) {
    var x = null;
    (liste || []).forEach(function (il, k) {
      if (x || !il) return;
      var d = il.devre || A.iletken(il.ad).devre;
      if (d === 'AG') x = { il: il, yol: 'hat.iletkenler[' + k + ']' };
    });
    if (!x && liste && liste.length && liste[0] && (liste[0].devre || A.iletken(liste[0].ad).devre) !== 'OG') x = { il: liste[0], yol: 'hat.iletkenler[0]' };
    return x;
  }

  function parcalar(b, A) {
    var p = [];
    if (b.zincir && b.zincir.length) {
      b.zincir.forEach(function (z, i) {
        var y = 'zincir[' + i + ']';
        p.push({ bit: z.bit, L: z.uzunluk, Lyol: y + '.uzunluk', il: z.iletken || null, ilYol: y + '.iletken', bitYol: y + '.bit',
          havai: z.havai, havaiYol: y + '.havai', kaynak: 'Zincir ' + (i + 1), zincir: true });
      });
    } else if (b.hat && b.hat.acikliklar && b.hat.acikliklar.length) {
      var k = agIletkeni(b.hat.iletkenler, A);
      b.hat.acikliklar.forEach(function (a, i) {
        var y = 'hat.acikliklar[' + i + ']';
        p.push({ bit: a.bit, L: a.uzunluk, Lyol: y + '.uzunluk', il: k ? k.il : null, ilYol: k ? k.yol : null, bitYol: y + '.bit',
          havai: b.hat.havai, havaiYol: 'hat.havai', kaynak: 'Açıklık ' + (bos(a.bas) ? '' : a.bas) + '→' + (bos(a.bit) ? '' : a.bit), hatKaynak: 'Hat ' + (bos(b.hat.no) ? '' : b.hat.no), zincir: false });
      });
    }
    return p;
  }

  /** Araç tabloyu her değişiklikte yeniden çizdiğinden köprünün turuncu işaretleri kaybolur: yeniden işaretler,
      gereği karşılanan eksikleri "girildi" sayar. */
  function izle(A) {
    if (izleniyor) return;
    izleniyor = true;
    var tazele = function () {
      setTimeout(function () {
        var S = window.__SM && window.__SM.durum;
        if (!S || !S.eksik) return;
        S.eksik.forEach(function (x) {
          if (x.girildi || !x.sec || typeof x.tamam !== 'function') return;
          var e = A.$(x.sec), ok = false;
          try { ok = x.tamam(); } catch (h) { ok = false; }
          if (ok) { x.girildi = true; if (e) e.classList.remove('sm-eksik'); }
          else if (e && !e.classList.contains('sm-eksik')) { e.classList.add('sm-eksik'); e.setAttribute('title', x.alan + ': projede yok, elle girin'); }
        });
      }, 0);
    };
    document.addEventListener('change', tazele, true);
    document.addEventListener('click', tazele, true);
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Gerilim düşümü k (aktif) ve m (reaktif) katsayılarıyla hesaplanır: %e = k·P·L·10⁻⁷ + m·Q·L·10⁻⁷ (P: W, L: m). Her hattın yükü, kendi yükü ile ondan sonraki bütün hatların yüklerinin toplamıdır.',
      'Yükler watt (W) olarak girilir; abone ve branşman yükleri projede olmadığı için elle girilmelidir.',
      'Sınır hem gerilim düşümü hem güç kaybı için %5\'tir ve sınıra eşit değer aşım sayılır (OG hesabında eşitlik uygundur). Toplam %P, toplam kayıp gücün toplam yüke oranıdır.',
      'Akım kontrolü: yük akımı iletkenin taşıma akımını aşarsa "KESİT AZ". Akım taşıma akımına tam eşitse araç hat sonucunu "UYGUN", genel sonucu "UYGUN DEĞİLDİR" gösterir.',
      'Yeraltı kablolarında taşıma akımı her zaman toprak değeriyle alınır. Diversite katsayısı yalnız akımı böler; gerilim düşümünü etkilemez. İşletme gerilimi de yalnız akımı etkiler (k ve m katsayıları 400 V içindir).',
      'Kablosu seçilmemiş ya da hat türüne uymayan hat, toplam gerilim düşümüne katılmaz ama yükü öndeki hatlara eklenir; araç bu durumda da "UYGUN" gösterebilir. Şebeke-M bu durumda kabloyu eksik işaretler ve sonucu "bilgi" olarak kaydeder.',
      'Çıplak alüminyum iletken kodları (R: Rose, P: Pansy, Po: Poppy, A: Aster) aracın listesindeki adlara eşlenir; "3P+R" gibi üç faz + nötr yazımı faz iletkenine göre 4P/R, 4Po/R, 3A+R/P ya da 5R satırını kullanır. Faz düzeni belli olmayan yazımlar (ör. "3xR") eşlenmez, elle seçilir. Listede "2P" iki kez geçer (değerleri aynıdır).',
      'Aracın kendi dosya kaydet / aç düğmeleri Şebeke-M\'de gizlidir; hesabın durumu projeye kaydedilir. Yazdır ve Excel kullanılabilir.'
    ],

    hazir: function () {
      try { return typeof render === 'function' && typeof kols !== 'undefined' && !!document.querySelector('#sheet tr.verdict-row'); }
      catch (e) { return false; }
    },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
      var goruldu = {};
      function dolan(alan, deger, birim, yol, ham, kaynak) {
        if (yol && goruldu[yol]) return;
        if (yol) goruldu[yol] = 1;
        r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham === undefined ? deger : ham, kaynak: kaynak || '' });
      }

      // ---- trafo, kol, gerilim (sessiz yazılır; tablo sonunda bir kez çizilir)
      var tr = b.trafo || null;
      if (tr && !bos(tr.no)) { A.yaz('#iYer', String(tr.no), true); dolan('Trafo', tr.no, '', 'trafo.no', tr.no, 'Trafo'); }
      if (tr && sayiMi(tr.gucKVA) && tr.gucKVA > 0) {
        var adet = +tr.adet || 1;
        A.yaz('#iGuc', (adet > 1 ? adet + ' × ' : '') + A.tr(tr.gucKVA) + ' kVA', true);
        dolan('Trafo gücü', tr.gucKVA, 'kVA', 'trafo.gucKVA', tr.gucKVA, 'Trafo');
        if (adet > 1) dolan('Trafo adedi', tr.adet, '', 'trafo.adet', tr.adet, 'Trafo');
      }
      if (b.hat && !bos(b.hat.no)) { A.yaz('#iKol', String(b.hat.no), true); dolan('Kol adı', b.hat.no, '', 'hat.no', b.hat.no, 'Hat'); }
      var kv = null, kvYol = null;
      if (b.hat && sayiMi(b.hat.gerilimKV) && b.hat.gerilimKV > 0 && b.hat.gerilimKV <= 1) { kv = b.hat.gerilimKV; kvYol = 'hat.gerilimKV'; }
      else if (tr && sayiMi(tr.agKV) && tr.agKV > 0 && tr.agKV <= 1) { kv = tr.agKV; kvYol = 'trafo.agKV'; }
      if (kv != null) {
        var V = Math.round(kv * 1000);
        A.yaz('#gU', V, true);
        dolan('İşletme gerilimi', V, 'V', kvYol, kv, kvYol === 'trafo.agKV' ? 'Trafo' : 'Hat');
      } else r.eksik.push({ alan: 'İşletme gerilimi (V)', sec: '#gU', neden: 'Projede AG gerilimi yok; araç 400 V ile hesaplıyor (değer volt olarak girilir)' });

      // ---- hatlar
      var liste = parcalar(b, A);
      if (!liste.length) {
        render();
        r.eksik.push({ alan: 'Hat bilgisi', sec: hucreSec('Kablo / İletken Cinsi', 0, 'select'), neden: 'Projede bu hedef için AG hat zinciri ya da açıklık bilgisi yok; hatları (kablo, uzunluk, yük) elle girin',
          tamam: function () { return kols.some(function (k, i) { return !!calc(k, i).c; }); } });
        izle(A);
        return r;
      }
      var n = liste.length, esler = [], degisti = false;
      kols = liste.map(function (pc, i) {
        var m = eslestir(pc.il, A);
        pc.m = m;
        pc.tip = m.cable ? m.tip : (pc.havai === true ? 'Havai' : pc.havai === false ? 'Yeralti' : (m.tip || 'Yeralti'));
        var adet = pc.il && sayiMi(pc.il.adet) ? pc.il.adet : null;
        var nokta = '';
        if (i < n - 1 && !bos(pc.bit)) { nokta = guvenli(pc.bit); if (nokta !== String(pc.bit)) degisti = true; }
        return { tip: pc.tip, cable: m.cable || '', devre: adet != null && adet >= 1 && adet <= 4 ? String(adet) : '', nokta: nokta,
          length: sayiMi(pc.L) && pc.L > 0 ? sayiYazi(pc.L) : '', yuk: ['', '', '', ''] };
      });
      render();

      liste.forEach(function (pc, i) {
        var h = 'HAT ' + (i + 1), ek = pc.zincir ? ' (' + h + ')' : '';
        if (sayiMi(pc.L) && pc.L > 0) dolan(h + ' uzunluğu', pc.L, 'm', pc.Lyol, pc.L, pc.kaynak);
        else r.eksik.push({ alan: h + ' uzunluğu', sec: hucreSec('Hat Uzunluğu (m)', i, 'input'), neden: 'Projede uzunluk yok',
          tamam: function () { var k = kols[i]; return !k || +k.length > 0; } });
        if (pc.il && !bos(pc.il.ad)) dolan('İletken' + ek, pc.il.ad, '', pc.ilYol + '.ad', pc.il.ad, pc.hatKaynak || pc.kaynak);
        if (pc.il && sayiMi(pc.il.adet)) {
          dolan('Devre sayısı' + ek, pc.il.adet, '', pc.ilYol + '.adet', pc.il.adet, pc.hatKaynak || pc.kaynak);
          if (pc.il.adet < 1 || pc.il.adet > 4) r.eksik.push({ alan: h + ' devre sayısı', sec: hucreSec('Devre Sayısı', i, 'select'), neden: pc.il.adet + ' devre: araç en çok 4 devre alır' });
        }
        if (i < n - 1 && !bos(pc.bit)) dolan('Branşman noktası ' + (i + 1), pc.bit, '', pc.bitYol, pc.bit, pc.kaynak);
        if (!pc.m.cable) {
          if (typeof pc.havai === 'boolean') dolan((pc.zincir ? h + ' havai' : 'Havai') + ' / yeraltı', pc.havai ? 'Havai' : 'Yeraltı', '', pc.havaiYol, pc.havai, pc.hatKaynak || pc.kaynak);
          r.eksik.push({ alan: h + ' kablosu', sec: hucreSec('Kablo / İletken Cinsi', i, 'select'), neden: pc.m.neden + '; hat türünü ve kabloyu listeden seçin',
            tamam: function () { var k = kols[i]; return !k || !!calc(k, i).c; } });
        } else {
          if (typeof pc.havai === 'boolean' && (pc.havai ? 'Havai' : 'Yeralti') !== pc.tip)
            r.uyari.push(h + ': projede ' + (pc.havai ? 'havai' : 'yeraltı') + ' hat; "' + pc.m.cable + '" aracın ' + (pc.tip === 'Havai' ? 'havai' : 'yeraltı') + ' listesinde olduğundan o değerler kullanıldı.');
          var es = '"' + String(pc.il.ad).trim() + '" → "' + pc.m.cable + '"';
          if (String(pc.il.ad).trim() !== pc.m.cable && esler.indexOf(es) < 0) esler.push(es);
        }
      });
      r.eksik.push({ alan: YUK_ALAN, sec: hucreSec('Toplu Yük (W)', 0, 'input'),
        neden: 'Abone / branşman yükleri projede yok; her hattın sonundaki yükü "Toplu Yük" ya da "Yük 1–3" satırına watt (W) olarak girin',
        tamam: function () { return kols.some(function (k) { return ownLoad(k) > 0; }); } });
      if (esler.length) r.uyari.push('İletken adları aracın kablo listesindeki adlarla eşlendi: ' + esler.join(', '));
      r.uyari.push('cos φ (0,9) ve diversite (1) aracın varsayılanlarıdır; projeden gelmez, gerekirse değiştirin.');
      if (degisti) r.uyari.push('Branşman noktası adlarındaki tırnak ve açılı ayraç işaretleri değiştirildi (aracın tablosu bunları taşıyamıyor).');
      izle(A);
      return r;
    },

    hesapla: function () { render(); },

    sonuc: function (A) {
      var R = kols.map(calc), lim = +el('gLim').value || 5, U = +el('gU').value || 400;
      var kul = [];
      kols.forEach(function (k, i) { if (R[i].c || k.cable || +k.length > 0 || R[i].own > 0) kul.push(i); });
      if (!kul.length) return { hata: 'Önce hat bilgilerini (kablo, uzunluk, yük) girin.' };
      var hukum = Array.prototype.slice.call(document.querySelectorAll('#sheet tr.verdict-row td')).slice(1).map(function (x) { return (x.textContent || '').trim(); });
      var uy = [], eksikVar = false, topL = 0;
      kul.forEach(function (i) {
        var k = kols[i], x = R[i], h = 'HAT ' + (i + 1), hk = hukum[i] || '';
        topL += +k.length || 0;
        if (!x.c) {
          eksikVar = true;
          uy.push(h + ': ' + (k.cable ? '"' + k.cable + '" seçili hat türünde yok' : 'kablo seçilmemiş') + '; bu hat toplam gerilim düşümüne katılmadı (araç bu durumda da "UYGUN" gösterebilir).');
          return;
        }
        if (!(+k.length > 0)) { eksikVar = true; uy.push(h + ': uzunluk girilmemiş.'); }
        if (/KES/.test(hk)) uy.push(h + ': KESİT AZ — yük akımı ' + t(A, x.I, 1) + ' A, iletken taşıma akımı ' + t(A, x.amp) + ' A.');
        else if (/%e/.test(hk)) uy.push(h + ': gerilim düşümü %' + t(A, x.pe, 3) + ' ≥ %' + lim + '.');
        else if (/%P/.test(hk)) uy.push(h + ': güç kaybı %' + t(A, x.pp, 3) + ' ≥ %' + lim + '.');
        if (x.amp != null && x.I === x.amp) uy.push(h + ': yük akımı taşıma akımına eşit; araç hat sonucunu "UYGUN", genel sonucu "UYGUN DEĞİLDİR" gösterir.');
      });
      var top = kols.reduce(function (a, k) { return a + ownLoad(k); }, 0);
      if (!(top > 0)) { eksikVar = true; uy.push('Yük girilmemiş: hat yükleri 0, sonuç anlamsız.'); }
      var e = A.sayi(A.metin('#eq_e')), er = A.sayi(A.metin('#eq_er')), ex = A.sayi(A.metin('#eq_ex')), pp = A.sayi(A.metin('#eq_p')), dP = A.sayi(A.metin('#eq_dp'));
      var genel = A.metin('#eq_ok'), uygunMu = genel === '✓ UYGUN';
      if (!uygunMu && !eksikVar) {
        if (pp >= lim) uy.unshift('Toplam güç kaybı %' + t(A, pp, 3) + ' ≥ %' + lim + '.');
        if (e >= lim) uy.unshift('Toplam gerilim düşümü %' + t(A, e, 3) + ' ≥ %' + lim + '.');
      }
      var durum = eksikVar ? 'bilgi' : (uygunMu ? 'uygun' : 'uygun-degil');
      var karar = durum === 'bilgi' ? 'eksik bilgi' : (uygunMu ? 'UYGUN' : 'UYGUN DEĞİL');
      var ilk = R[kul[0]], I0 = sayiMi(ilk.I) ? yuvarla(ilk.I, 2) : null;
      return {
        ozet: 'AG ' + A.tr(U) + ' V · ' + kul.length + ' hat · %e = ' + t(A, e, 3) + ' · %P = ' + t(A, pp, 3) + ' (sınır %' + lim + ') · ΔP = ' + t(A, dP) + ' W · I = ' + t(A, I0, 1) + ' A → ' + karar,
        durum: durum,
        girdiler: [
          { ad: 'İşletme gerilimi', deger: U, birim: 'V' },
          { ad: 'cos φ', deger: A.sayi(el('gCos').value), birim: '' },
          { ad: 'Diversite', deger: A.sayi(el('gDiv').value), birim: '' },
          { ad: 'Hat sayısı', deger: kul.length, birim: '' },
          { ad: 'Toplam uzunluk', deger: yuvarla(topL, 2), birim: 'm' },
          { ad: 'Trafo', deger: el('iYer').value, birim: '' },
          { ad: 'Trafo gücü', deger: el('iGuc').value, birim: '' },
          { ad: 'Kol adı', deger: el('iKol').value, birim: '' }
        ],
        degerler: [
          { ad: 'Toplam gerilim düşümü', deger: e, birim: '%' },
          { ad: 'Gerilim düşümü (aktif, %er)', deger: er, birim: '%' },
          { ad: 'Gerilim düşümü (reaktif, %ex)', deger: ex, birim: '%' },
          { ad: 'Toplam güç kaybı', deger: pp, birim: '%' },
          { ad: 'Toplam kayıp güç', deger: dP, birim: 'W' },
          { ad: 'Toplam yük', deger: top, birim: 'W' },
          { ad: 'Hat başı akımı', deger: I0, birim: 'A' },
          { ad: 'Sınır (gerilim düşümü ve güç kaybı)', deger: lim, birim: '%' }
        ],
        tablo: {
          basliklar: ['Hat', 'Branşman noktası', 'Tür', 'Kablo', 'Devre', 'L (m)', 'Kendi yükü (W)', 'Toplam yük (W)', 'Akım (A)', 'Taşıma akımı (A)', 'k', 'm', '%e', 'ΔP (W)', '%P', 'Sonuç'],
          satirlar: kul.map(function (i) {
            var k = kols[i], x = R[i];
            return [i + 1, k.nokta || '', k.tip === 'Havai' ? 'Havai' : 'Yeraltı', k.cable || '—', +k.devre || 1, +k.length || 0, x.own, x.P,
              yuvarla(x.I, 2), x.amp == null ? '—' : x.amp, x.kk == null ? '—' : yuvarla(x.kk, 4), x.mm == null ? '—' : yuvarla(x.mm, 4),
              x.c ? yuvarla(x.pe, 4) : '—', x.c ? yuvarla(x.dP, 2) : '—', x.c ? yuvarla(x.pp, 4) : '—', hukum[i] || '—'];
          })
        },
        uyarilar: uy
      };
    },

    durumAl: function () {
      commitPending();                                     // odaktaki giriş ve branşman adları kols'a işlensin
      return JSON.parse(JSON.stringify(gatherState()));     // gatherState canlı kols dizisini verir: kopya alınır
    },

    durumYukle: function (d) {
      var s = d || {};
      if (s.meta) { el('iYer').value = s.meta.yer || ''; el('iKol').value = s.meta.kol || ''; el('iGuc').value = s.meta.guc || ''; }
      if (s.globals) {
        var g = s.globals, v = function (x, y) { return x == null ? y : x; };
        el('gU').value = v(g.U, 400); el('gCos').value = v(g.cos, 0.9); el('gDiv').value = v(g.div, 1); el('gLim').value = v(g.lim, 5);
      }
      if (Array.isArray(s.kols) && s.kols.length) {
        kols = s.kols.map(function (k) {
          var y = Array.isArray(k.yuk) ? k.yuk : [];
          return { tip: k.tip || 'Yeralti', cable: k.cable || '', devre: k.devre || '', nokta: k.nokta || '', length: k.length || '',
            yuk: [0, 1, 2, 3].map(function (j) { return y[j] == null ? '' : y[j]; }) };
        });
      }
      render();
    }
  };
})();
