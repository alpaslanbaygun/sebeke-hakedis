/* Şebeke-M uyarlaması: Amax hesabı — travers düzenleri (amax). Hesap kodlarına ve tablolarına dokunmaz; giriş
   alanlarına yazar, aracın kendi işlevleriyle (buildGeom, calc, getTn, getTn5) hesaplatır ve sonucu okur.
   Aracın genel adları ($, g, E, gv, calc, TRAVERS, FIELDS …) burada yeniden tanımlanmaz. */
(function () {
  'use strict';
  var TEL_IDX = { SWALLOW: '0', RAVEN: '1', PIGEON: '2', PARTRIDGE: '3', HAWK: '4' };
  var ROL_AD = { T: 'taşıyıcı', D: 'durdurucu', N: 'nihayet', K: 'köşe' };
  var BAG_AD = { mm: 'Mesnet-Mesnet', aa: 'Askı-Askı', ga: 'Gergi-Askı', ag: 'Askı-Gergi', gm: 'Gergi-Mesnet', gg: 'Gergi-Gergi' };
  // Uyarlamanın kendi bilgisi (durumla saklanır; geri yüklemede doldur çağrılmaz):
  // aciklik = karşılaştırılan açıklık, travOnay = travers düzeni / konsol ölçüleri kullanıcı tarafından girildi mi
  var ek = { surum: 1, aciklik: null, travOnay: false };
  var dinleniyor = false;

  function alanEl(id) { return document.getElementById(id); }
  function kopya(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function sayiMi(v) { return typeof v === 'number' && isFinite(v); }
  function yuvarla(v, n) { if (!sayiMi(v)) return null; var k = Math.pow(10, n == null ? 6 : n); return Math.round(v * k) / k; }
  function ciktiOku(id) { var e = alanEl(id); var n = parseFloat(e ? e.textContent : ''); return isFinite(n) ? n : null; }
  function secenekVar(e, v) { return !!e && Array.prototype.some.call(e.options || [], function (o) { return o.value === String(v); }); }
  function travAdi(tv) { var t = TRAVERS[tv]; return t ? String(t.ad).split(' — ')[0] : String(tv); }

  // Travers düzeni ya da konsol ölçüsü elle değişince "girildi" sayılır (araç yeniden kurduğu için belge düzeyinde)
  function dinleyiciKur() {
    if (dinleniyor) return;
    dinleniyor = true;
    var f = function (e) { var t = e.target; if (t && t.id && (t.id === 'trav' || /^gi_/.test(t.id))) ek.travOnay = true; };
    document.addEventListener('input', f, true);
    document.addEventListener('change', f, true);
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'amax = min(adf, ads). adf yatay koldan: fmax = 4·(Df − U/150)² − Liz, adf = √(8·Tn·fmax / Pn); ads düşey koldan: f₊₅ = (Ds − U/150)/(2·sinα) − Liz, ads = √(8·Tn₊₅·f₊₅ / p0).',
      'DfDs6, DfDs7 ve DfDs8 düzenlerinde amax yalnız adf\'dir (ads kolu yok). Araçtaki "adf / ads belirleyici" yazısı bu düzenlerde yanıltıcı olabilir; Şebeke-M sonucunda belirleyici adf yazılır.',
      'Başlıkta DfDs0–9 yazsa da araçta 9 travers düzeni (DfDs0–DfDs8) vardır.',
      'Travers düzeni ve konsol ölçüleri projede yoktur; direk başlığı çizimine göre girilmelidir. Girilmedikçe sonuç aracın örnek ölçüleriyle bulunur ve karar verilmez.',
      'Düzenler arasında geçişte aynı adlı ölçüler (ör. j, k, h, i) bir düzenden ötekine taşınır; her düzende bütün ölçüleri kontrol edin. DfDs6\'da "Üst kaçık konsol" ile "Tepe-konsol arası", DfDs7\'de konsol arası dikey mesafeler yalnız çizimde kullanılır, hesaba girmez.',
      'İzolatör boyu Liz bağlantı tipinden önerilir (askı ucu başına 0,5 m). Taşıyıcı direkte askı izolatörü varsayılır; mesnet (iğne) izolatörü projeden bilinemez. Aracın kendi kaydı Liz\'i saklamaz; Şebeke-M kaydı saklar.',
      'Maksimum sehim hâli iletkene ve bölgeye göre araçta otomatik seçilir (Swallow, Raven: 1. bölgede +5 °C rüzgâr, diğerlerinde −5 °C buz; Pigeon, Partridge: 1.–2. bölgede çıplak, diğerlerinde buz; Hawk: her zaman çıplak).',
      'Df ya da Ds, U/150\'ye yakın ya da küçükse kök içi negatif olur ve amax hesaplanamaz; Df < U/150 iken formüldeki kare nedeniyle araç yine bir değer gösterebilir, bu değer geçersizdir.',
      'Eşdeğer açıklık (ar) ya da gerilim boş bırakılırsa araç yine bir sonuç gösterir; Şebeke-M bu durumda karar vermez.'
    ],

    hazir: function () { return typeof calc === 'function' && typeof buildGeom === 'function' && typeof window._amaxVal === 'number' && !!alanEl('o_amax'); },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [], kullanilan: {} };
      if (!b) return r;
      dinleyiciKur();
      var yollar = {};
      function dolan(alan, deger, birim, yol, ham, kaynak) {
        if (yol && yollar[yol]) return;
        if (yol) yollar[yol] = 1;
        r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' });
      }
      function izle(nesne, anahtar, yol) {
        if (nesne && typeof nesne === 'object' && Object.prototype.hasOwnProperty.call(nesne, anahtar) && !yollar[yol]) r.kullanilan[yol] = nesne[anahtar];
      }
      // "Güncel bilgileri aktar" ile yeniden doldurulursa kullanıcının girdiği travers bilgisi korunur
      ek = { surum: 1, aciklik: null, travOnay: !!(ek && ek.travOnay) };
      var p = b.proje || {};
      var hedefTur = (b.hedef && b.hedef.tur) || (b.direk ? 'direk' : b.hat ? 'hat' : 'proje');

      // ---- açıklık: direkte en uzun kol (ya da bağlamın verdiği kol), hatta en uzun açıklık
      var acik = null;
      if (hedefTur === 'direk' && b.direk) {
        var dr = b.direk, kollar = dr.kollar || [];
        var aday = [];
        kollar.forEach(function (k, i) { if (k && sayiMi(k.aciklik) && k.aciklik > 0) aday.push(i); });
        var og = aday.filter(function (i) {
          var k = kollar[i];
          return (k.iletkenler || []).some(function (x) { return x && A.iletken(x.ad).aile === 'ACSR'; }) || /^OG|MUSTEREK/.test(String(k.hatTur || ''));
        });
        if (og.length) aday = og;
        var sec = -1;
        if (b.hedef && sayiMi(b.hedef.kol) && aday.indexOf(b.hedef.kol) >= 0) sec = b.hedef.kol;
        else if (aday.length) {
          sec = aday[0];
          aday.forEach(function (i) { if (kollar[i].aciklik > kollar[sec].aciklik) sec = i; });
        }
        if (sec >= 0) {
          var kol = kollar[sec], ks = kol.karsi || {};
          acik = {
            uzunluk: kol.aciklik, yol: 'direk.kollar[' + sec + '].aciklik',
            etiket: (dr.no != null ? dr.no : '?') + '–' + (ks.no != null ? ks.no : '?'),
            d1: { nesne: dr, yol: 'direk', no: dr.no }, d2: { nesne: ks, yol: 'direk.kollar[' + sec + '].karsi', no: ks.no },
            iletkenler: kol.iletkenler, iletkenKok: 'direk.kollar[' + sec + '].iletkenler',
            gerilim: { nesne: kol, yol: 'direk.kollar[' + sec + '].gerilimKV' }
          };
          if (aday.length > 1 && !(b.hedef && sayiMi(b.hedef.kol))) r.uyari.push('Direkten ' + aday.length + ' açıklık çıkıyor; en uzunu (Direk ' + acik.etiket + ', ' + A.tr(kol.aciklik, 2) + ' m) kullanıldı.');
        }
      } else if (b.hat) {
        var aList = b.hat.acikliklar || [], dList = b.hat.direkler || [];
        var en = -1, gecerli = 0;
        aList.forEach(function (a, j) { if (a && sayiMi(a.uzunluk) && a.uzunluk > 0) { gecerli++; if (en < 0 || a.uzunluk > aList[en].uzunluk) en = j; } });
        if (en >= 0) {
          var a = aList[en];
          var bul = function (no, yedek) {
            if (no != null) for (var i = 0; i < dList.length; i++) if (dList[i] && String(dList[i].no) === String(no)) return i;
            return (a.bas == null && a.bit == null && aList.length === dList.length - 1) ? yedek : -1;
          };
          var i1 = bul(a.bas, en), i2 = bul(a.bit, en + 1);
          var no1 = a.bas != null ? a.bas : (i1 >= 0 ? dList[i1].no : '?'), no2 = a.bit != null ? a.bit : (i2 >= 0 ? dList[i2].no : '?');
          acik = {
            uzunluk: a.uzunluk, yol: 'hat.acikliklar[' + en + '].uzunluk', etiket: no1 + '–' + no2,
            d1: i1 >= 0 ? { nesne: dList[i1], yol: 'hat.direkler[' + i1 + ']', no: no1 } : null,
            d2: i2 >= 0 ? { nesne: dList[i2], yol: 'hat.direkler[' + i2 + ']', no: no2 } : null,
            iletkenler: b.hat.iletkenler, iletkenKok: 'hat.iletkenler', gerilim: { nesne: b.hat, yol: 'hat.gerilimKV' }
          };
          if (gecerli > 1) r.uyari.push('Hattın en uzun açıklığı (Direk ' + acik.etiket + ', ' + A.tr(a.uzunluk, 2) + ' m) kullanıldı.');
        }
      }

      // ---- iletken
      var ilt = acik && acik.iletkenler && acik.iletkenler.length ? acik.iletkenler : (b.hat && b.hat.iletkenler) || [];
      var iltKok = acik && acik.iletkenler && acik.iletkenler.length ? acik.iletkenKok : 'hat.iletkenler';
      var bulunan = null, ilkAd = null;
      ilt.forEach(function (x, i) {
        if (bulunan || !x || !x.ad) return;
        if (ilkAd === null) ilkAd = x.ad;
        var c = A.iletken(x.ad);
        if (c.aile === 'ACSR') bulunan = { x: x, c: c, yol: iltKok + '[' + i + '].ad' };
      });
      if (bulunan && TEL_IDX[bulunan.c.tel] != null) {
        A.sec('#ilet', TEL_IDX[bulunan.c.tel]);
        dolan('İletken', ILET[+TEL_IDX[bulunan.c.tel]], '', bulunan.yol, bulunan.x.ad, bulunan.x.ad);
      } else {
        r.eksik.push({ alan: 'İletken', sec: '#ilet', neden: bulunan ? 'Projedeki iletken (' + bulunan.x.ad + ') araçta yok' : ilkAd ? 'Hattın iletkeni (' + ilkAd + ') çıplak ACSR değil; bu hesap ENH çıplak iletkenler içindir' : 'Hattın iletkeni projede yok' });
        if (bulunan) izle(bulunan.x, 'ad', bulunan.yol);
      }

      // ---- buz bölgesi
      var bz = p.buzBolgesi != null ? String(p.buzBolgesi).trim() : '';
      if (secenekVar(alanEl('bolge'), bz)) { A.sec('#bolge', bz); dolan('Buz bölgesi', bz + '. bölge', '', 'proje.buzBolgesi', p.buzBolgesi); }
      else {
        r.eksik.push({ alan: 'Buz bölgesi', sec: '#bolge', neden: bz ? 'Projedeki bölge (' + bz + ') araçta yok' : 'Projede buz bölgesi yok' });
        izle(p, 'buzBolgesi', 'proje.buzBolgesi');
      }

      // ---- hat gerilimi
      var uKaynak = null;
      if (acik && acik.gerilim && sayiMi(acik.gerilim.nesne.gerilimKV) && acik.gerilim.nesne.gerilimKV > 0) uKaynak = { v: acik.gerilim.nesne.gerilimKV, yol: acik.gerilim.yol };
      else if (b.hat && sayiMi(b.hat.gerilimKV) && b.hat.gerilimKV > 0) uKaynak = { v: b.hat.gerilimKV, yol: 'hat.gerilimKV' };
      if (uKaynak) { A.yaz('#U', uKaynak.v); dolan('Hat gerilimi U', uKaynak.v, 'kV', uKaynak.yol, uKaynak.v); }
      else r.eksik.push({ alan: 'Hat gerilimi U', sec: '#U', neden: 'Projede hat gerilimi yok (araçta ' + A.tr(g('U')) + ' kV duruyor)' });

      // ---- eşdeğer açıklık
      if (b.hat && sayiMi(b.hat.ruling) && b.hat.ruling > 0) {
        A.yaz('#ar', b.hat.ruling);
        dolan('Eşdeğer açıklık ar', b.hat.ruling, 'm', 'hat.ruling', b.hat.ruling);
      } else if (b.hat && (b.hat.acikliklar || []).length && b.hat.acikliklar.every(function (x) { return x && sayiMi(x.uzunluk) && x.uzunluk > 0; })) {
        var ru = yuvarla(A.ruling(b.hat.acikliklar), 2);
        A.yaz('#ar', ru);
        b.hat.acikliklar.forEach(function (x, j) { if (x && sayiMi(x.uzunluk)) dolan('Açıklık ' + (x.bas != null ? x.bas : j + 1) + '–' + (x.bit != null ? x.bit : j + 2) + ' (2B)', x.uzunluk, 'm', 'hat.acikliklar[' + j + '].uzunluk', x.uzunluk, 'eşdeğer açıklık'); });
        r.uyari.push('Hattın eşdeğer açıklığı projede yoktu; açıklıklardan √(Σa³/Σa) = ' + A.tr(ru, 2) + ' m hesaplandı.');
      } else {
        r.eksik.push({ alan: 'Eşdeğer açıklık ar', sec: '#ar', neden: 'Projede eşdeğer açıklık yok (araçta ' + A.tr(g('ar')) + ' m duruyor)' });
        if (b.hat) izle(b.hat, 'ruling', 'hat.ruling');
      }

      // ---- bağlantı tipi: iki uç direğin görevinden (taşıyıcı → askı, durdurucu / nihayet / köşe → gergi)
      var r1 = acik && acik.d1 && acik.d1.nesne ? acik.d1.nesne.rol : null;
      var r2 = acik && acik.d2 && acik.d2.nesne ? acik.d2.nesne.rol : null;
      if (ROL_AD[r1] && ROL_AD[r2]) {
        var kod = (r1 === 'T' ? 'a' : 'g') + (r2 === 'T' ? 'a' : 'g');
        A.sec('#baglanti', kod);          // araç Liz'i bağlantı tipine göre kendisi önerir
        dolan('Direk-1 görevi', 'Direk ' + acik.d1.no + ': ' + ROL_AD[r1] + (r1 === 'T' ? ' (askı)' : ' (gergi)'), '', acik.d1.yol + '.rol', r1);
        dolan('Direk-2 görevi', 'Direk ' + acik.d2.no + ': ' + ROL_AD[r2] + (r2 === 'T' ? ' (askı)' : ' (gergi)'), '', acik.d2.yol + '.rol', r2);
        if (r1 === 'T' || r2 === 'T') r.uyari.push('Taşıyıcı direkte askı izolatörü varsayıldı; mesnet (iğne) izolatörlüyse bağlantı tipini ve izolatör boyunu değiştirin.');
      } else {
        r.eksik.push({ alan: 'Bağlantı tipi (askı / gergi)', sec: '#baglanti', neden: 'Açıklığın iki ucundaki direklerin görevi projede yok' });
        if (acik && acik.d1) izle(acik.d1.nesne, 'rol', acik.d1.yol + '.rol');
        if (acik && acik.d2) izle(acik.d2.nesne, 'rol', acik.d2.yol + '.rol');
      }

      // ---- travers düzeni ve konsol ölçüleri: projede yok
      if (!ek.travOnay) r.eksik.push({ alan: 'Travers düzeni ve konsol ölçüleri', sec: '#trav', neden: 'Projede yok: direk başlığı çizimine göre düzeni seçip konsol ölçülerini girin' });

      // ---- karşılaştırılacak açıklık
      if (acik) {
        ek.aciklik = { deger: acik.uzunluk, etiket: acik.etiket };
        dolan('Açıklık ' + acik.etiket + ' (2B)', acik.uzunluk, 'm', acik.yol, acik.uzunluk, 'amax ile karşılaştırılır');
      } else r.uyari.push('Karşılaştırılacak açıklık bulunamadı; yalnız amax hesaplanır.');
      return r;
    },

    hesapla: function () { calc(); renklendirGirdiler(); },

    sonuc: function (A) {
      var amax = window._amaxVal;
      if (typeof amax !== 'number') return { hata: 'Hesap henüz yapılmadı.' };
      var il = parseInt(alanEl('ilet').value, 10), bl = parseInt(alanEl('bolge').value, 10);
      var ar = g('ar'), U = g('U');                                  // aracın kendi okuma işlevi
      var Liz = parseFloat(alanEl('LizSel').value), bg = alanEl('baglanti').value;
      var tv = selT.value, t = TRAVERS[tv];
      var Tn = getTn(il, bl, ar), Tn5 = getTn5(il, bl, ar);          // aracın kendi işlevleri
      var Df = ciktiOku('o_Df'), Ds = ciktiOku('o_Ds'), fmax = ciktiOku('o_fmax'), f5 = ciktiOku('o_f5');
      var adf = ciktiOku('o_adf'), ads = ciktiOku('o_ads');
      var yalnizAdf = ['t6', 't7', 't8'].indexOf(tv) >= 0;
      var gecerli = sayiMi(amax);
      var bel = !gecerli ? null : (yalnizAdf || (sayiMi(ads) && adf <= ads)) ? 'adf' : 'ads';
      var belYazi = bel === 'adf' ? (yalnizAdf ? 'adf (yatay kol; bu düzende yalnız adf)' : 'adf (yatay kol)') : bel === 'ads' ? 'ads (düşey kol)' : '—';
      var acik = ek.aciklik;
      var uy = [], durum;
      if (yalnizAdf) uy.push(travAdi(tv) + ' düzeninde amax yalnız yatay koldan (adf) bulunur; ads bilgi içindir.');
      if (!gecerli) { durum = 'bilgi'; uy.push('amax hesaplanamadı: konsol ölçüleri bu gerilim ve izolatör boyu için yetersiz (fmax ya da f₊₅ negatif).'); }
      else if (sayiMi(Df) && U > 0 && Df <= U / 150) { durum = 'bilgi'; uy.push('Df = ' + A.tr(Df, 2) + ' m, U/150 = ' + A.tr(U / 150, 3) + ' m\'den büyük değil: faz arası yatay mesafe yetersiz, araçtaki amax geçersiz.'); }
      else if (!(ar > 0) || !(U > 0)) { durum = 'bilgi'; uy.push('Hat gerilimi ya da eşdeğer açıklık (ar) girilmedi; karar verilmedi.'); }
      else if (!ek.travOnay) { durum = 'bilgi'; uy.push('Travers düzeni ve konsol ölçüleri girilmedi: sonuç aracın örnek ölçüleriyle, karar verilmedi.'); }
      else if (!acik) durum = 'bilgi';
      else durum = acik.deger <= amax ? 'uygun' : 'uygun-degil';

      var oz = gecerli ? 'amax = ' + A.tr(amax, 2) + ' m (' + travAdi(tv) + ', ' + bel + ' belirleyici)' : 'amax hesaplanamadı (' + travAdi(tv) + ')';
      if (acik) oz += ' · açıklık ' + acik.etiket + ' = ' + A.tr(acik.deger, 2) + ' m' + (durum === 'uygun' ? ' ≤ amax' : durum === 'uygun-degil' ? ' > amax' : '');
      oz += ' · ' + ILET[il] + ', ' + bl + '. bölge, ' + (BAG_AD[bg] || bg) + ', Liz ' + A.tr(Liz, 1) + ' m';
      if (!ek.travOnay) oz += ' · travers ölçüleri girilmedi';

      var girdiler = [
        { ad: 'İletken', deger: ILET[il], birim: '' },
        { ad: 'Buz bölgesi', deger: bl, birim: '' },
        { ad: 'Bağlantı tipi', deger: BAG_AD[bg] || bg, birim: '' },
        { ad: 'İzolatör boyu Liz', deger: Liz, birim: 'm' },
        { ad: 'Hat gerilimi U', deger: U, birim: 'kV' },
        { ad: 'Eşdeğer açıklık ar', deger: ar, birim: 'm' },
        { ad: 'Travers düzeni', deger: t ? t.ad : tv, birim: '' }
      ];
      (t ? t.inp : []).forEach(function (q) { girdiler.push({ ad: 'Direk-' + q[3] + ' ' + q[1] + ' (' + q[0] + ')', deger: gv[q[0]], birim: 'm' }); });
      if (acik) girdiler.push({ ad: 'Açıklık ' + acik.etiket, deger: acik.deger, birim: 'm' });
      return {
        ozet: oz,
        durum: durum,
        girdiler: girdiler,
        degerler: [
          { ad: 'amax', deger: yuvarla(amax, 6), birim: 'm' },
          { ad: 'adf', deger: adf, birim: 'm' },
          { ad: 'ads', deger: ads, birim: 'm' },
          { ad: 'Df', deger: Df, birim: 'm' },
          { ad: 'Ds', deger: Ds, birim: 'm' },
          { ad: 'fmax', deger: fmax, birim: 'm' },
          { ad: 'f₊₅', deger: f5, birim: 'm' },
          { ad: 'Tn (en büyük sehim hâli)', deger: yuvarla(Tn, 6), birim: 'kg' },
          { ad: 'Tn₊₅', deger: yuvarla(Tn5, 6), birim: 'kg' },
          { ad: 'Belirleyici kol', deger: belYazi, birim: '' },
          { ad: 'Açıklık', deger: acik ? acik.deger : null, birim: 'm' },
          { ad: 'amax − açıklık', deger: acik && gecerli ? yuvarla(amax - acik.deger, 6) : null, birim: 'm' }
        ],
        uyarilar: uy
      };
    },

    // Aracın kendi kayıt biçimi ({fields, geom}) + aracın saklamadığı Liz + uyarlamanın bilgisi
    durumAl: function () {
      var f = {};
      FIELDS.forEach(function (k) { var e = alanEl(k); if (e) f[k] = e.value; });
      return { surum: 1, fields: f, LizSel: alanEl('LizSel').value, geom: kopya(gv), ek: kopya(ek) };
    },

    durumYukle: function (d) {
      dinleyiciKur();
      if (!d || !d.fields) return;
      Object.keys(gv).forEach(function (k) { delete gv[k]; });
      Object.keys(d.geom || {}).forEach(function (k) { gv[k] = d.geom[k]; });
      FIELDS.forEach(function (k) {
        var e = alanEl(k), v = d.fields[k];
        if (!e || v == null) return;
        if (e.tagName === 'SELECT' && !secenekVar(e, v)) return;
        e.value = String(v);
      });
      // Liz bağlantı tipinden sonra yazılır (aracın kaydında yok; bağlantı değişince araç onu ezer)
      if (d.LizSel != null && secenekVar(alanEl('LizSel'), d.LizSel)) alanEl('LizSel').value = String(d.LizSel);
      buildGeom();                 // aracın kendi işlevi: ölçü kutuları gv'den kurulur, calc() ve renklendirme
      ek = kopya(d.ek) || { surum: 1, aciklik: null, travOnay: false };
    },

    alanAdlari: function (yol) {
      var m;
      if (yol === 'proje.buzBolgesi') return 'Buz bölgesi';
      if (yol === 'hat.ruling') return 'Eşdeğer açıklık';
      if (yol === 'hat.gerilimKV' || /\.gerilimKV$/.test(yol)) return 'Hat gerilimi';
      if ((m = /^hat\.acikliklar\[(\d+)\]\.uzunluk$/.exec(yol))) return 'Açıklık ' + (+m[1] + 1) + ' (2B)';
      if ((m = /^direk\.kollar\[(\d+)\]\.aciklik$/.exec(yol))) return 'Direkten çıkan ' + (+m[1] + 1) + '. açıklık (2B)';
      if (/iletkenler\[\d+\]\.ad$/.test(yol)) return 'İletken';
      if (/karsi\.rol$/.test(yol)) return 'Karşı direğin görevi';
      if ((m = /^hat\.direkler\[(\d+)\]\.rol$/.exec(yol))) return 'Hattın ' + (+m[1] + 1) + '. direğinin görevi';
      if (yol === 'direk.rol') return 'Direğin görevi';
      return null;
    }
  };
})();
