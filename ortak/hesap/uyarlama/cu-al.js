/* Şebeke-M uyarlaması: Bakır ⇄ Alüminyum kablo kesiti (cu-al). Hesap kodlarına dokunmaz; yalnız giriş
   alanlarına yazar ve sonuçları okur. Araçta durum kaydı yoktur; durum = {sekme, arama, seçili imar kodu, Cu kesit}. */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  function aktifSekme() { var b = document.querySelector('.tab-btn.active'); return b ? b.getAttribute('data-tab') : 'lookup'; }
  function sekmeAc(ad) { var b = document.querySelector('.tab-btn[data-tab="' + ad + '"]'); if (b && !b.classList.contains('active')) b.click(); }
  function seciliKod() { var d = el('selectedDetail'); return d && d.style.display === 'block' ? (el('dKod').textContent || '').trim() : ''; }
  function sayi(t) { var n = parseFloat(String(t || '').replace(',', '.')); return isFinite(n) ? n : NaN; }

  window.__SM_UYARLAMA = {
    notlar: [
      'Eşdeğer alüminyum kesit = 1,6 × bakır kesit (iletkenlik Cu 56, Al 35 m/Ω·mm²), standart kesite yukarı yuvarlanır.',
      'Standart kesit listesi 630 mm²\'de biter: bakır 393,75 mm²\'nin üstünde araç 630 gösterir; bu durumda uyarı verilir.',
      'Araçtaki sabit "Cu → Al karşılıkları" tablosu 16, 95 ve 120 mm² için hesaplayıcıdan farklı değer gösterir (25/150/185 ile 35/185/240). Sonuç hesaplayıcıdan alınır; tablo değerleri doğrulanmalıdır.'
    ],
    hazir: function () { return typeof updateCalc === 'function' && !!el('cuInput'); },
    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      var adaylar = [];
      if (b.hat) (b.hat.iletkenler || []).forEach(function (i, k) { adaylar.push({ i: i, yol: 'hat.iletkenler[' + k + '].ad' }); });
      if (b.kanal) (b.kanal.kablolar || []).forEach(function (i, k) { adaylar.push({ i: i, yol: 'kanal.kablolar[' + k + '].ad' }); });
      if (b.direk) (b.direk.kollar || []).forEach(function (kol, k) { (kol.iletkenler || []).forEach(function (i, n) { adaylar.push({ i: i, yol: 'direk.kollar[' + k + '].iletkenler[' + n + '].ad' }); }); });
      var bakir = null, al = null;
      adaylar.forEach(function (x) {
        var c = A.iletken(x.i.ad);
        if (!bakir && (c.aile === 'NYY' || c.aile === 'XLPE-CU') && c.kesit) bakir = { x: x, c: c };
        if (!al && (c.aile === 'NAYY' || c.aile === 'XLPE-AL' || c.aile === 'ABC')) al = { x: x, c: c };
      });
      if (bakir) {
        sekmeAc('calc');
        A.yaz('#cuInput', bakir.c.kesit);
        r.dolan.push({ alan: 'Bakır kablo kesiti', deger: bakir.c.kesit, birim: 'mm²', yol: bakir.x.yol, ham: bakir.x.i.ad, kaynak: bakir.x.i.ad });
      } else if (al) {
        r.uyari.push('Seçilen hattaki kablo alüminyum (' + al.x.i.ad + '). Bu hesap bakır kesitin alüminyum karşılığını verir; karşılaştırmak istediğiniz bakır kesiti girin.');
      }
      return r;
    },
    sonuc: function (A) {
      var cu = sayi(A.deger('#cuInput'));
      if (cu > 0) {
        var teorik = sayi(A.metin('#calcTeorik')), std = sayi(A.metin('#calcStandart'));
        var uy = [];
        if (isFinite(teorik) && isFinite(std) && teorik > std) uy.push('Gereken alüminyum kesit (' + A.tr(teorik, 2) + ' mm²) standart listenin en büyüğünden (630 mm²) büyük: paralel kablo gerekir.');
        return {
          ozet: 'Cu ' + A.tr(cu) + ' mm² ≙ Al ' + A.tr(teorik, 2) + ' mm² (teorik) → standart ' + A.tr(std) + ' mm²',
          durum: 'bilgi',
          girdiler: [{ ad: 'Bakır kesit', deger: cu, birim: 'mm²' }],
          degerler: [{ ad: 'Alüminyum kesit (teorik)', deger: teorik, birim: 'mm²' }, { ad: 'Alüminyum kesit (standart)', deger: std, birim: 'mm²' }],
          uyarilar: uy
        };
      }
      var kod = seciliKod();
      if (kod) {
        return {
          ozet: 'İmar ' + kod + ': abone kablosu Cu ' + A.metin('#dCu') + ' / Al ' + A.metin('#dAl'),
          durum: 'bilgi',
          girdiler: [{ ad: 'İmar kat sayısı kodu', deger: kod, birim: '' }],
          degerler: [
            { ad: 'Güç yoğunluğu', deger: A.metin('#dGucYog'), birim: '' },
            { ad: 'Daire sayısı', deger: A.metin('#dSayisi'), birim: '' },
            { ad: 'Daire başı güç', deger: A.metin('#dBasiGuc'), birim: '' },
            { ad: 'Abone kablosu (Cu)', deger: A.metin('#dCu'), birim: '' },
            { ad: 'Abone kablosu (Al)', deger: A.metin('#dAl'), birim: '' }
          ],
          uyarilar: []
        };
      }
      return { hata: 'Bakır kesiti girin ya da bir imar kat sayısı kodu seçin.' };
    },
    durumAl: function (A) {
      return { sekme: aktifSekme(), arama: A.deger('#searchBox') || '', secili: seciliKod(), cu: A.deger('#cuInput') || '' };
    },
    durumYukle: function (d, A) {
      d = d || {};
      var satir = d.secili && typeof MAIN_DATA !== 'undefined' ? MAIN_DATA.filter(function (x) { return x[0] === d.secili; })[0] : null;
      if (satir) selectRow(satir);
      else A.yaz('#searchBox', d.arama || '');
      A.yaz('#cuInput', d.cu || '');
      updateCalc();
      sekmeAc(d.sekme || 'lookup');
    }
  };
})();
