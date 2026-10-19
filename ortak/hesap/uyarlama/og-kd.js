/* Şebeke-M uyarlaması: OG Kısa Devre Hesabı (og-kd). Hesap kodlarına ve formüllerine dokunmaz; yalnız giriş
   alanlarına yazar, aracın kendi işlevlerini (hatEkle, hatDoldur, hesapla, durumAl, durumUygula) çağırır ve
   sonuçları aracın SONUC nesnesinden okur.
   - Şebeke (Nk, Un) ve TM (güç, uk, bağlantı, Rn) bilgileri projede yoktur: araçtaki değerler kalır, "eksik" olur.
   - Dağıtım trafosu (güç, uk, AG gerilimi) trafo bilgisinden, OG gerilimi trafodan ya da hattan gelir.
   - OG hat parçaları trafodan çıkan zincirden (OG parçalar) ya da seçili hattın açıklıklarından kurulur.
   - Geri yüklemede aracın iki kusuru giderilir: elle değiştirilmiş xtro/xtr1 oranları tablo değerine dönüyordu,
     üçgen sekonderli bağlantıdan dönüşte nötr topraklama seçimi boş kalıyordu. */
(function () {
  'use strict';
  var OZEL = '— Özel (elle gir) —';
  var TEL = {
    SWALLOW: '3xSwallow (26,69 mm²)', RAVEN: '3xRaven (53,52 mm²)', PIGEON: '3xPigeon (85,12 mm²)',
    PARTRIDGE: '3xPatridge (134,87 mm²)', HAWK: '3xHawk (241,65 mm²)', DRAKE: '3xDrake (402,56 mm²)'
  };
  // Aracın şebeke / TM örnek değerleri (kaynak dosyadaki varsayılanlar)
  var ORNEK = { sNk: 2504, sUn: 154, tNn: 100, tUk: 12, tRn: 20 };

  function el(id) { return document.getElementById(id); }
  function sayiMi(v) { return v !== null && v !== undefined && v !== '' && isFinite(+v); }
  function trTarih(t) {
    var m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : String(t);
  }
  /** A.iletken() çözümü → aracın iletken listesindeki ad (ILETKENLER[].ad) ya da null */
  function listeAdi(c) {
    if (!c) return null;
    if (c.aile === 'ACSR') return TEL[c.tel] || null;
    if ((c.aile === 'XLPE-AL' || c.aile === 'XLPE-CU') && c.kesit) {
      var al = c.aile === 'XLPE-AL', son = al ? ' mm² AL XLPE' : ' mm² Cu XLPE', bas = '3(1x' + c.kesit + (al ? '/' : ')');
      var x = ILETKENLER.filter(function (i) { return i.tip === 'kablo1' && i.ad.slice(-son.length) === son && i.ad.indexOf(bas) >= 0; })[0];
      return x ? x.ad : null;
    }
    return null;
  }
  function guvenliHesap() {
    window.SONUC = null;
    try { hesapla(); } catch (e) { return 'Hesap yapılamadı: ' + e.message; }
    return window.SONUC ? null : 'Şebeke Nk, TM gücü ve OG gerilimi sıfırdan büyük olmalı.';
  }
  function satirlar() {
    return Array.prototype.map.call(document.querySelectorAll('#hatList .seg'), function (s) { return s.id.replace('hat', ''); });
  }
  /** Hesaba girmeyen satırlar: aracın kuralı (R boş ya da l ≤ 0 olan satır atlanır) */
  function disarida(id) {
    var R = el('h' + id + '_R').value, l = parseFloat(String(el('h' + id + '_l').value).replace(',', '.')) || 0;
    return !R || l <= 0;
  }
  /** I″k2 değerleri yalnız tabloda yazılı (3.2 tablosu): kA */
  function ik2Oku(A) {
    var r = {}, tb = document.querySelector('#out_ariza table');
    if (!tb) return r;
    Array.prototype.slice.call(tb.rows, 1).forEach(function (s, i) {
      var y = s.cells[2] ? s.cells[2].textContent : '';
      var v = A.sayi(y, ',');
      r['n' + i] = Math.round((/kA/.test(y) ? v : v / 1000) * 1e9) / 1e9;
    });
    return r;
  }
  /** 0,4 kV iki faz-toprak: k = Z0/Z1 ve (k < 1 ise) I″kE2E — aracın yazdığı formül satırlarından */
  function kOku(A) {
    var r = {};
    Array.prototype.forEach.call(document.querySelectorAll('#out_ariza .formula'), function (f) {
      var t = f.textContent || '';
      var m = t.match(/k = Z₀\/Z₁ = (-?[\d.,]+)/);
      if (m) r.k = A.sayi(m[1], ',');
      if (/^I″kt = 3\/\(1\+2k\)/.test(t.trim())) { var b = f.querySelector('b.big'); if (b) r.ikt = A.sayi(b.textContent, ','); }
    });
    return r;
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Şebeke kısa devre gücü (Nk), şebeke gerilimi, TM gücü, uk, bağlantı grubu ve nötr direnci projede yoktur; TEİAŞ bağlantı görüşünden ya da TM bilgisinden girilmelidir. Araçta duran 2504 MVA / 154 kV / 100 MVA / %12 değerleri örnektir.',
      'Dağıtım trafosunun direnci ihmal edilir (yalnız reaktans); projede bakır kaybı (Pcu) olsa da bu hesapta kullanılmaz.',
      'Hatların sıfır bileşen değerleri bütün iletkenlerde R0 = R + 0,15 Ω/km ve X0 = 3·X alınır; aracın açıklamasında geçen kablo oranları (Rko/Rk1, xko/xk1) listede yoktur. Kablolu fiderlerde faz-toprak sonucu için R0 ve X0 elle doğrulanmalıdır.',
      'Hat reaktansı, OG gerilimi 30 kV ve üstündeyse 34,5 kV sınıfı, altındaysa 15 kV sınıfı değerinden alınır.',
      'Projedeki Pigeon ve Hawk iletkenleri için listedeki Pigeon / Hawk satırları kullanılır; listedeki "3/0 AWG" ve "477 MCM" (TM kademe) satırları aynı iletkenler için farklı R ve X değerleri verir, yazarla doğrulanmalıdır.',
      'Tek hat şemasında 0,4 kV baranın kısa devre gücü gerilim faktörü (c) uygulanmadan yazılır; OG noktalarının güçlerinde c uygulanır (IEC cmax seçilince fark görünür).',
      'Şablon çizimi (DXF) yalnız TEDAŞ dikey şablonunu içerir (dağıtım trafosu ve 0,4 kV bara yoktur); çizim ölçeksizdir, AutoCAD\'de ölçeklenmelidir.',
      'MVA yöntemi empedans genliklerini topladığı için uzun, ince kesitli hatlarda pu yönteminden daha düşük akım verir; araç iki yöntemi karşılaştırır, sonuçlarda pu yöntemi esastır.',
      'A4 çıktıda birim değerler tablosunun "TOPLAM — Nokta 1 / Nokta 2" satırları beyaz yazıyla basıldığından görünmez (aracın yazdırma düzeni); toplamlar ekranda ve arıza akımları bölümündeki formüllerde okunabilir.',
      'Araç kayıtlı bir hesabı açarken elle değiştirilmiş xtro/xtr1 oranlarını bağlantı tablosundaki değere döndürür ve üçgen sekonderli bağlantıdan dönüşte nötr topraklama seçimini boş bırakabilir; Şebeke-M kayıtlı değerleri yeniden yazar.'
    ],

    // Aracın açılışı kendi betiğinde eşzamanlı biter (örnek hatlar kurulur, hesaplanır); SONUC'a bağlanmaz ki
    // bağımsız açılışta tarayıcı belleğinden gelen geçersiz bir durum (Nk = 0) köprüyü bekletmesin.
    hazir: function () { return typeof hesapla === 'function' && typeof durumUygula === 'function' && !!el('hatList'); },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
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
      if (p.tarih) { var tt = trTarih(p.tarih); A.yaz('#pTar', tt); dolan('Tarih', tt, '', 'proje.tarih', p.tarih, 'Proje'); }

      // Şebeke ve TM: bağlamda yok (araçtaki değerler kalır)
      eksik('Şebeke ve TM bilgileri (Nk, Un, TM gücü, uk, bağlantı, Rn)', '#sNk', 'Projede yok; TEİAŞ bağlantı görüşünden / TM bilgisinden girin. Araçtaki örnek değerler duruyor.');
      eksik('TM / kaynak adı', '#tAd', 'Projede yok; şablon çiziminde kaynak adı olarak görünür.');

      // OG gerilimi: hat reaktansı bu değere göre seçildiği için hatlardan önce yazılır
      if (t && sayiMi(t.ogKV)) { A.yaz('#tUog', +t.ogKV); dolan('OG gerilimi', +t.ogKV, 'kV', 'trafo.ogKV', t.ogKV, kt); }
      else if (h && sayiMi(h.gerilimKV) && +h.gerilimKV >= 1) { A.yaz('#tUog', +h.gerilimKV); dolan('OG gerilimi', +h.gerilimKV, 'kV', 'hat.gerilimKV', h.gerilimKV, 'Hat ' + (h.no || '')); }
      else eksik('OG gerilimi', '#tUog', 'Projede yok (araçtaki 34,5 kV duruyor).');

      // Dağıtım trafosu
      if (t && sayiMi(t.gucKVA)) { A.yaz('#dNn', +t.gucKVA); dolan('Dağıtım trafosu gücü', +t.gucKVA, 'kVA', 'trafo.gucKVA', t.gucKVA, kt); }
      else eksik('Dağıtım trafosu gücü', '#dNn', t ? 'Projede yok (araçtaki 630 kVA duruyor).' : 'Projede trafo yok; 0,4 kV sonuçları için girin (istemiyorsanız 0 yazın).');
      if (t && sayiMi(t.uk)) { A.yaz('#dUk', +t.uk); dolan('Dağıtım trafosu uk', +t.uk, '%', 'trafo.uk', t.uk, kt); }
      else eksik('Dağıtım trafosu uk', '#dUk', 'Projede yok (araçtaki %4,5 duruyor).');
      if (t && sayiMi(t.agKV)) { A.yaz('#dUag', +t.agKV); dolan('AG gerilimi', +t.agKV, 'kV', 'trafo.agKV', t.agKV, kt); }
      else eksik('AG gerilimi', '#dUag', 'Projede yok (araçtaki 0,4 kV duruyor).');
      if (t && sayiMi(t.pcu)) r.uyari.push('Trafo bakır kaybı (Pcu) bu hesapta kullanılmaz: araç dağıtım trafosunun direncini ihmal eder.');
      if (t && sayiMi(t.adet) && +t.adet > 1) r.uyari.push('Projede ' + t.adet + ' paralel dağıtım trafosu var; araç tek trafo hesaplar.');

      // OG hat parçaları
      var parcalar = [], agSay = 0, hatKaynak = false;
      (b.zincir || []).forEach(function (z, i) {
        if (!z) return;
        var il = z.iletken || {}, c = A.iletken(il.ad);
        if ((il.devre || c.devre) === 'OG') parcalar.push({ il: il, c: c, uzunluk: z.uzunluk, bas: z.bas, bit: z.bit, yol: 'zincir[' + i + ']', ilYol: 'zincir[' + i + '].iletken', kaynak: 'Zincir ' + (i + 1) });
        else agSay++;
      });
      if (agSay) r.uyari.push(agSay + ' AG parça OG kısa devre hesabına alınmadı.');
      if (!parcalar.length && h && (h.acikliklar || []).length) {
        var k = -1;
        (h.iletkenler || []).forEach(function (il, j) { if (k < 0 && il && (il.devre || A.iletken(il.ad).devre) === 'OG') k = j; });
        if (k < 0 && /^OG/.test(h.tur || '') && (h.iletkenler || []).length) k = 0;
        if (k >= 0) {
          hatKaynak = true;
          var hil = h.iletkenler[k], hc = A.iletken(hil.ad);
          h.acikliklar.forEach(function (a, i) {
            parcalar.push({ il: hil, c: hc, uzunluk: a && a.uzunluk, bas: a && a.bas, bit: a && a.bit, yol: 'hat.acikliklar[' + i + ']', ilYol: 'hat.iletkenler[' + k + ']', kaynak: 'Hat ' + (h.no || '') });
          });
        } else r.uyari.push('Seçilen hat OG hattı değil; OG hat bilgisi alınamadı.');
      }

      // Aracın örnek hatları temizlenir; satırlar aracın kendi işlevleriyle kurulur
      el('hatList').innerHTML = '';
      hatSay = 0;
      if (hatKaynak) {
        // Hattın öncesi (TM OG barasından hattın ilk direğine kadar) projede yok: boş satır, doldurulana kadar hesaba girmez
        hatEkle();
        var id0 = hatSay;
        el('h' + id0 + '_tip').value = OZEL; hatDoldur(id0);
        ['_l', '_R', '_X', '_R0', '_X0'].forEach(function (s) { el('h' + id0 + s).value = ''; });
        el('h' + id0 + '_nk').value = parcalar[0].bas != null ? String(parcalar[0].bas) : 'Hat başı';
        eksik('TM barasından hattın başına kadar fider', '#hat' + id0, 'Projede yok; ilk satıra iletken, uzunluk ve R/X değerlerini girin (boş kaldıkça hesaba girmez).');
      }
      parcalar.forEach(function (x, n) {
        var no = n + 1, ad = listeAdi(x.c);
        hatEkle();
        var id = hatSay;
        el('h' + id + '_tip').value = ad || OZEL;
        if (sayiMi(x.uzunluk) && +x.uzunluk > 0) el('h' + id + '_l').value = String(+x.uzunluk / 1000);
        else { el('h' + id + '_l').value = ''; eksik('Hat ' + no + ' uzunluğu', '#h' + id + '_l', 'Projede yok; uzunluğu km olarak girin (boş kaldıkça hesaba girmez).'); }
        if (sayiMi(x.il.adet) && +x.il.adet >= 1) el('h' + id + '_dv').value = String(Math.round(+x.il.adet));
        if (x.bit != null && x.bit !== '') el('h' + id + '_nk').value = String(x.bit);
        hatDoldur(id);
        if (!ad) {
          ['_R', '_X', '_R0', '_X0'].forEach(function (s) { el('h' + id + s).value = ''; });
          if (!hatKaynak || !yollar['#' + x.ilYol]) {
            yollar['#' + x.ilYol] = 1;
            eksik((hatKaynak ? 'Hat' : 'Hat ' + no) + ' iletkeni (' + (x.il.ad || '?') + ')', '#hat' + id, 'Aracın iletken listesinde yok; ' + (hatKaynak ? 'her açıklık satırında ' : '') + 'iletkeni seçin ya da R, X, R0, X0 değerlerini girin (boş kaldıkça hesaba girmez).');
          }
        }
        dolan('Hat ' + (hatKaynak ? '' : no + ' ') + 'iletkeni', ad || OZEL, '', x.ilYol + '.ad', x.il.ad, x.il.ad);
        if (sayiMi(x.il.adet)) dolan('Hat ' + (hatKaynak ? '' : no + ' ') + 'devre sayısı', Math.round(+x.il.adet), '', x.ilYol + '.adet', x.il.adet, x.kaynak);
        if (sayiMi(x.uzunluk)) dolan((hatKaynak ? 'Açıklık ' : 'Hat ') + no + ' uzunluğu', +x.uzunluk / 1000, 'km', x.yol + '.uzunluk', x.uzunluk, x.kaynak + (x.bas != null && x.bit != null ? ' (' + x.bas + '–' + x.bit + ')' : ''));
        if (x.bit != null && x.bit !== '') dolan((hatKaynak ? 'Açıklık ' : 'Hat ') + no + ' sonu (nokta)', String(x.bit), '', x.yol + '.bit', x.bit, x.kaynak);
      });
      if (!parcalar.length) eksik('OG hat zinciri', '#hatList', 'Projede OG hat parçası yok; TM OG barasından trafoya kadar hatları "+ Hat Ekle" ile ekleyin.');
      else if (!hatKaynak) r.uyari.push('OG parçalar bağlamdaki sırayla TM OG barasından başlatıldı; TM barası ile ilk parça arasında başka hat varsa ekleyin.');
      var hata = guvenliHesap();
      if (hata) r.uyari.push(hata);
      return r;
    },

    hesapla: function () { guvenliHesap(); },

    sonuc: function (A) {
      var S = window.SONUC;
      if (!S || !S.kademe || !S.kademe.length) return { hata: 'Hesap sonucu yok: şebeke Nk, TM gücü ve OG gerilimi sıfırdan büyük olmalı.' };
      var kd = S.kademe, bara = kd[0], son = kd[kd.length - 1];
      var dt = num('dNn') > 0;
      var ik2 = ik2Oku(A), kk = dt ? kOku(A) : {};
      var ids = satirlar(), dahil = ids.filter(function (id) { return !disarida(id); });
      var topL = dahil.reduce(function (s, id) { return s + (parseFloat(String(el('h' + id + '_l').value).replace(',', '.')) || 0); }, 0);
      var girdiler = [
        { ad: 'Şebeke kısa devre gücü Nk', deger: num('sNk'), birim: 'MVA' },
        { ad: 'Şebeke gerilimi', deger: num('sUn'), birim: 'kV' },
        { ad: 'xo/x1', deger: num('sX01'), birim: '' },
        { ad: 'R1/x1', deger: num('sRX'), birim: '' },
        { ad: 'Gerilim faktörü', deger: el('sCmod').value, birim: '' },
        { ad: 'TM gücü', deger: num('tNn'), birim: 'MVA' },
        { ad: 'TM uk', deger: num('tUk'), birim: '%' },
        { ad: 'Paralel TM adedi', deger: Math.max(1, Math.round(num('tAdet') || 1)), birim: '' },
        { ad: 'TM bağlantı', deger: el('tBag').value, birim: '' },
        { ad: 'Nötr topraklama', deger: el('tTopMod').value, birim: '' },
        { ad: 'Nötr direnci Rn', deger: num('tRn'), birim: 'Ω' },
        { ad: 'OG gerilimi', deger: num('tUog'), birim: 'kV' },
        { ad: 'Dağıtım trafosu gücü', deger: num('dNn'), birim: 'kVA' },
        { ad: 'Dağıtım trafosu uk', deger: num('dUk'), birim: '%' },
        { ad: 'AG gerilimi', deger: num('dUag'), birim: 'kV' },
        { ad: 'Dağıtım trafosu bağlantı', deger: el('dBag').value, birim: '' },
        { ad: 'Hat sayısı (hesaba giren)', deger: dahil.length, birim: '' },
        { ad: 'Toplam hat uzunluğu', deger: Math.round(topL * 1e6) / 1e6, birim: 'km' },
        { ad: 'Arıza temizleme süresi', deger: num('gT'), birim: 's' }
      ];
      var d = [
        { ad: 'OG bara I″k3', deger: bara.IkA / 1000, birim: 'kA' },
        { ad: 'OG bara Sk', deger: bara.Sk, birim: 'MVA' },
        { ad: 'Nokta 1 (OG) I″k3', deger: S.Ik3_1 / 1000, birim: 'kA' },
        { ad: 'Nokta 1 (OG) I″k2', deger: ik2.n0, birim: 'kA' },
        { ad: 'Nokta 1 (OG) I″k1', deger: S.Ik1_1, birim: 'A' },
        { ad: 'Nokta 1 (OG) Is darbe', deger: S.Is1 / 1000, birim: 'kA' },
        { ad: 'Nokta 1 (OG) It termik', deger: S.It1 / 1000, birim: 'kA' },
        { ad: 'Nokta 1 (OG) Sk', deger: son.Sk, birim: 'MVA' },
        { ad: 'Nokta 1 (OG) I″k3 MVA yöntemi', deger: S.Ik3mva_1 / 1000, birim: 'kA' },
        { ad: 'Nokta 1 (OG) Sk MVA yöntemi', deger: S.S1mva, birim: 'MVA' }
      ];
      if (dt) {
        d.push(
          { ad: 'Nokta 2 (0,4 kV) I″k3', deger: S.Ik04 / 1000, birim: 'kA' },
          { ad: 'Nokta 2 (0,4 kV) I″k2', deger: ik2.n1, birim: 'kA' },
          { ad: 'Nokta 2 (0,4 kV) I″k1', deger: S.Ik1_04 / 1000, birim: 'kA' },
          { ad: 'Nokta 2 (0,4 kV) Is darbe', deger: S.Is2 / 1000, birim: 'kA' },
          { ad: 'Nokta 2 (0,4 kV) It termik', deger: S.It2 / 1000, birim: 'kA' },
          { ad: 'Nokta 2 OG intikali', deger: S.IkOGint, birim: 'A' },
          { ad: 'Nokta 2 (0,4 kV) I″k3 MVA yöntemi', deger: S.Ik3mva_04 / 1000, birim: 'kA' },
          { ad: 'Nokta 2 (0,4 kV) Sk MVA yöntemi', deger: S.S2mva, birim: 'MVA' },
          { ad: 'k = Z0/Z1 (0,4 kV)', deger: kk.k, birim: '' }
        );
        if (kk.k < 1 && isFinite(kk.ikt)) d.push({ ad: 'Nokta 2 (0,4 kV) I″kE2E', deger: kk.ikt, birim: 'kA' });
      }
      var uy = [];
      if (kd.length === 1) uy.push('Hesaba giren OG hat yok: sonuçlar TM OG barası içindir.');
      ids.forEach(function (id, i) {
        if (el('h' + id + '_tip').value === OZEL && !disarida(id)) uy.push('Hat ' + (i + 1) + ' (' + el('h' + id + '_nk').value + '): iletken "Özel"; R, X, R0, X0 elle girilmiş değerlerdir.');
        if (disarida(id)) uy.push('Hat ' + (i + 1) + ' (' + el('h' + id + '_nk').value + ') hesaba girmedi: uzunluk ya da R değeri boş.');
      });
      if (num('sNk') === ORNEK.sNk && num('sUn') === ORNEK.sUn && num('tNn') === ORNEK.tNn && num('tUk') === ORNEK.tUk && num('tRn') === ORNEK.tRn)
        uy.push('Şebeke ve TM bilgileri aracın örnek değerlerinde (Nk 2504 MVA, 154 kV, TM 100 MVA, uk %12, Rn 20 Ω); TEİAŞ / TM bilgisiyle doğrulayın.');
      if (!dt) uy.push('Dağıtım trafosu gücü 0: 0,4 kV sonuçları hesaplanmadı.');
      else if (kk.k < 1) uy.push('0,4 kV barada k = Z0/Z1 = ' + A.tr(kk.k, 4) + ' < 1: iki faz-toprak arızasında topraktan geçen akım (' + A.tr(kk.ikt, 3) + ' kA) üç fazlı arıza akımından büyüktür; teçhizat seçiminde dikkate alınmalı.');
      Array.prototype.forEach.call(document.querySelectorAll('#out_kars tr'), function (tr) {
        var td = tr.querySelector('td.bad');
        if (td) uy.push('pu ve MVA yöntemleri arasında %' + td.textContent.trim().replace(/^[+-]/, '') + ' fark (' + tr.cells[0].textContent.trim() + ').');
      });
      if (d.some(function (x) { return typeof x.deger === 'number' && !isFinite(x.deger); })) uy.push('Bazı sonuçlar hesaplanamadı (girdileri kontrol edin).');
      var tablo = {
        basliklar: ['Nokta', 'Beslenme (ENH / kablo)', 'L (km)', 'ΣR (pu)', 'ΣX (pu)', 'Zk (pu)', 'I″k3 (kA)', 'Sk (MVA)'],
        satirlar: kd.map(function (n) {
          return [n.ad, n.cinsi || '—', n.L ? +n.L.toFixed(4) : 0, +n.R.toFixed(5), +n.X.toFixed(5), +n.Z.toFixed(5), +(n.IkA / 1000).toFixed(3), +n.Sk.toFixed(1)];
        })
      };
      var ozet = 'OG bara I″k3 ' + A.tr(bara.IkA / 1000, 2) + ' kA (' + A.tr(bara.Sk, 0) + ' MVA)' +
        (kd.length > 1 ? ' · ' + son.ad + ': I″k3 ' + A.tr(S.Ik3_1 / 1000, 3) + ' kA' : '') + ', I″k1 ' + A.tr(S.Ik1_1, 0) + ' A' +
        (dt ? ' · 0,4 kV: I″k3 ' + A.tr(S.Ik04 / 1000, 2) + ' kA, I″k1 ' + A.tr(S.Ik1_04 / 1000, 2) + ' kA' : '');
      return { ozet: ozet, durum: 'bilgi', girdiler: girdiler, degerler: d, tablo: tablo, uyarilar: uy };
    },

    durumAl: function () { return { v: 1, arac: window.durumAl() }; },

    durumYukle: function (d) {
      var st = d && d.arac ? d.arac : d;
      if (!st || !st.f) return;
      // Önce bağlantı grubu: nötr topraklama seçeneğinin yazısı bağlantıya göre değişir (aracın kusuru)
      if (st.tBag) { el('tBag').value = st.tBag; topModuKisitla(); }
      window.durumUygula(st);
      // Araç durumUygula sonunda xtro/xtr1 oranlarını bağlantı tablosundan yeniden yazar: kayıtlı değerler geri yazılır
      ['tX01', 'dX01', 'tTopMod'].forEach(function (k) { if (st.f[k] != null && st.f[k] !== '') el(k).value = st.f[k]; });
      var tm = el('tTopMod');
      if (tm.selectedIndex < 0) tm.value = ogSekonderUcgen() ? 'Topraklama trafosu (zigzak)' : 'Trafo nötründen (Rn)';
      topModuKisitla();
      guvenliHesap();
    }
  };
})();
