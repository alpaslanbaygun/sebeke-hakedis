/* Şebeke-M uyarlaması: İletken Kopma — İki Misli Buz Yükü (kopma). Hesap kodlarına dokunmaz: giriş alanlarına yazar,
   aracın calc() işlevini çağırır, sonucu aracın kendi "last" nesnesinden okur.
   Hedef: iki yanında açıklık olan direk. a₁ / a₂ direğin iki açıklığından, iletken bu açıklıkların ACSR iletkeninden,
   buz bölgesi projeden alınır. h_proje (direk tepesindeki bağlantı noktası ile iletkenin en alçak noktası "çeltik"
   arasındaki düşey mesafe) projede yoktur: her zaman "eksik" işaretlenir ve kullanıcı girene kadar (ya da kayıttan
   gelene kadar) sonuç 'bilgi' kalır. Araçtaki 63,6 m örnek değerdir. */
(function () {
  'use strict';
  var TEL = { SWALLOW: 'SW', RAVEN: '1/0', PIGEON: '3/0', PARTRIDGE: '266', HAWK: '477' };
  var TEL_AD = { SW: 'Swallow', '1/0': 'Raven', '3/0': 'Pigeon', '266': 'Partridge', '477': 'Hawk' };
  var ORNEK_H = 63.6;                       // aracın h_proje örnek (varsayılan) değeri
  var ALANLAR = ['cond', 'zone', 'a1', 'a2', 'hproje', 'pole'];
  var hGirildi = false;                      // h_proje kullanıcıdan (ya da kayıttan) geldi mi
  var bekleyen = { cond: false, zone: false };
  var dinleniyor = false, doldururken = false;

  function el(id) { return document.getElementById(id); }
  function sayi(v) { var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : NaN; }
  function bos(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function yuvarla(x, n) { var k = Math.pow(10, n); return isFinite(x) ? Math.round(x * k) / k : null; }
  /** Kullanıcı (ya da onun yerine deneme adımı) alanı değiştirince işaretler; uyarlama bu alanlara olay göndermez. */
  function dinle() {
    if (dinleniyor || !el('hproje')) return;
    var h = function () { hGirildi = true; };
    el('hproje').addEventListener('input', h); el('hproje').addEventListener('change', h);
    ['cond', 'zone'].forEach(function (id) {
      var f = function () { if (!doldururken) bekleyen[id] = false; };
      el(id).addEventListener('input', f); el(id).addEventListener('change', f);
    });
    dinleniyor = true;
  }
  function hDurumu() {
    var h = Number(el('hproje').value);
    return { h: h, ok: h > 0 && (hGirildi || Math.abs(h - ORNEK_H) > 1e-9) };
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Yöntem TEDAŞ "İki Misli Buz Yükü Hesabı" Excel modelidir: −5 °C\'de iki misli buz yükünde (pₙ = p₀ + 2·p_b) iletken çekmesi Tₙ₂b hal değişim denkleminin (Cardano) çözümüyle bulunur; h_b = |(0,7·T_kop − Tₙ₂b)/pₙ| ≥ h_proje ise hesap kurtarır.',
      'h_proje, iletkenin direk tepesindeki bağlantı noktası ile iletkenin en alçak noktası (çeltik) arasındaki düşey mesafedir; araçtaki adı "direk proje yüksekliği" olsa da direk boyu değildir. Projede yoktur: boy kesitten ölçülüp girilmelidir. Araçtaki 63,6 m örnek değerdir.',
      'Buz yükü katsayısı k bu hesapta 1. bölge 0, 2. bölge 0,2, 3. bölge 0,3, 4. bölge 0,5, 5. bölge 1,2 alınır. ENH Sehim hesabı k = 0,1 × bölge no kullanır (1. bölge 0,1, 4. bölge 0,4, 5. bölge 0,5): iki hesabın buz yükü 1., 4. ve 5. bölgede farklıdır, yazarıyla doğrulanmalıdır.',
      'Araç girdi eksikken de (açıklık ya da h_proje boşken) "kurtarıyor" yazabilir; Şebeke-M sonucu ancak a₁, a₂ ve h_proje girilmişse uygun / uygun değil olarak kaydeder.',
      'Sabitler: E = 8000 kg/mm², t₁ = tₙ = −5 °C; iletken değerleri (T_kop, T₁, p₀, d, β) araçtaki tablodandır. Katalog: Swallow (SW), Raven (1/0), Pigeon (3/0), Partridge (266), Hawk (477).',
      'a₁ ve a₂ direğin iki yanındaki yatay (2B) açıklıklardır; ortalamaları eşdeğer açıklık olarak kullanılır. "Direk No" alanı yalnız sayı alır: harf içeren direk numaralarında sayısal kısmı yazılır.'
    ],

    hazir: function () {
      var ok = typeof calc === 'function' && !!el('cond') && el('cond').options.length > 0 && !!el('zone') && el('zone').options.length > 0;
      if (ok) dinle();
      return ok;
    },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [], kullanilan: {} };
      if (!b) return r;
      dinle();
      doldururken = true;
      try {
        var P = b.proje || {}, Dk = b.direk || null, H = b.hat || null;
        var dolan = function (alan, deger, birim, yol, ham, kaynak) { r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' }); };
        var kollar = Dk && Dk.kollar ? Dk.kollar.map(function (k, n) { return { k: k, n: n }; }) : [];
        var ayni = H ? kollar.filter(function (x) { return x.k.hatId != null && x.k.hatId === H.id; }) : [];
        var acsr = kollar.filter(function (x) { return (x.k.iletkenler || []).some(function (i) { return A.iletken(i.ad).aile === 'ACSR'; }); });
        var sec = ayni.length === 2 ? ayni : acsr.length === 2 ? acsr : kollar.slice(0, 2);
        if (kollar.length > 2) r.uyari.push('Direğe ' + kollar.length + ' açıklık bağlı; ' + sec.map(function (x) { return (x.k.karsi && x.k.karsi.no) || (x.n + 1) + '. kol'; }).join(' ve ') + ' yönündeki iki açıklık kullanıldı.');

        // ---- Açıklıklar
        var eksikA = [];
        ['a1', 'a2'].forEach(function (id, s) {
          var x = sec[s], u = x ? sayi(x.k.aciklik) : NaN;
          if (u > 0) {
            A.yaz('#' + id, u);
            var kar = x.k.karsi && !bos(x.k.karsi.no) ? x.k.karsi.no + ' yönü' : (x.n + 1) + '. kol';
            dolan((s ? 'a₂' : 'a₁') + ' — ' + (s + 1) + '. açıklık', u, 'm', 'direk.kollar[' + x.n + '].aciklik', x.k.aciklik, kar);
          } else eksikA.push(s ? 'a₂' : 'a₁');
        });
        if (eksikA.length) r.eksik.push({ alan: 'Açıklıklar ' + eksikA.join(' / '), sec: '#' + (eksikA[0] === 'a₁' ? 'a1' : 'a2'), neden: 'Direğin iki yanındaki açıklık projeden gelmedi; araçtaki ' + eksikA.join(' ve ') + ' örnek değerdir, girin.' });

        // ---- İletken (seçilen açıklıkların, yoksa hattın ACSR iletkeni)
        var izler = [];
        sec.forEach(function (x) { (x.k.iletkenler || []).forEach(function (i, m) { izler.push({ ad: i.ad, yol: 'direk.kollar[' + x.n + '].iletkenler[' + m + '].ad' }); }); });
        if (!izler.length && H) (H.iletkenler || []).forEach(function (i, m) { izler.push({ ad: i.ad, yol: 'hat.iletkenler[' + m + '].ad' }); });
        var cond = null, iz = null, katalogDisi = [], acsrDegil = [];
        izler.forEach(function (x) {
          if (!x.ad) return;
          var c = A.iletken(x.ad);
          if (c.aile === 'ACSR' && TEL[c.tel]) { if (!cond) { cond = TEL[c.tel]; iz = x; } }
          else if (c.aile === 'ACSR') katalogDisi.push(x.ad);
          else acsrDegil.push(x.ad);
        });
        if (cond) {
          A.sec('#cond', cond);
          dolan('İletken', cond + ' (' + TEL_AD[cond] + ')', '', iz.yol, iz.ad, iz.ad);
          bekleyen.cond = false;
        } else {
          bekleyen.cond = true;
          r.eksik.push({ alan: 'İletken tertibi', sec: '#cond', neden: katalogDisi.length ? 'İletken (' + katalogDisi[0] + ') araçtaki tabloda yok.' : acsrDegil.length ? 'İletken (' + acsrDegil.join(', ') + ') çıplak ACSR değil.' : 'İletken projede yok; seçin.' });
          if (katalogDisi.length || acsrDegil.length) r.uyari.push('Bu hesap yalnız Swallow, Raven, Pigeon, Partridge ve Hawk iletkenleri içindir; projedeki iletken: ' + katalogDisi.concat(acsrDegil).join(', ') + '.');
        }

        // ---- Buz bölgesi
        var by = bos(P.buzBolgesi) ? null : String(P.buzBolgesi).trim();
        if (by && A.sec('#zone', by) != null) { dolan('Buz yükü bölgesi', by, '', 'proje.buzBolgesi', P.buzBolgesi); bekleyen.zone = false; }
        else {
          bekleyen.zone = true;
          r.eksik.push({ alan: 'Buz yükü bölgesi', sec: '#zone', neden: by ? 'Projedeki buz bölgesi (' + by + ') listede yok.' : 'Projede buz bölgesi yok; seçin.' });
        }

        // ---- h_proje: projede yok (kayıttan gelen değer güncel bilgi aktarılırken korunur)
        r.eksik.push(hGirildi
          ? { alan: 'h_proje', sec: '#hproje', neden: 'Projede yok; kayıttaki ' + A.tr(Number(el('hproje').value), 2) + ' m korundu, boy kesitle karşılaştırın.', girildi: true }
          : { alan: 'h_proje', sec: '#hproje', neden: 'Direk tepesindeki bağlantı noktası ile iletkenin en alçak noktası (çeltik) arasındaki düşey mesafe projede yok; boy kesitten ölçüp girin. Araçtaki ' + A.tr(Number(el('hproje').value), 1) + ' m örnek değerdir.' });

        // ---- Direk No (yalnız sayı alır; etiket)
        if (Dk && !bos(Dk.no)) {
          var ham = String(Dk.no).trim(), m = ham.match(/\d+/);
          if (m) {
            A.yaz('#pole', +m[0]);
            dolan('Direk No', +m[0], '', 'direk.no', Dk.no, ham);
            if (m[0] !== ham) r.uyari.push('Araçtaki "Direk No" alanı yalnız sayı alır: ' + ham + ' için ' + (+m[0]) + ' yazıldı.');
          } else {
            A.yaz('#pole', '');
            r.kullanilan['direk.no'] = Dk.no;
            r.uyari.push('Direk numarası (' + ham + ') sayı içermiyor; araçtaki "Direk No" alanı yalnız sayı aldığından boş bırakıldı.');
          }
        }
      } finally { doldururken = false; }
      return r;
    },

    hesapla: function () { calc(); },

    sonuc: function (A) {
      if (typeof calc !== 'function' || !last) return { hata: 'Hesap yüklenemedi.' };
      var L = last, cond = el('cond').value, zone = el('zone').value, c = COND[cond] || {};
      var a1 = Number(el('a1').value), a2 = Number(el('a2').value), hd = hDurumu(), poleNo = el('pole').value;
      var eks = [];
      if (!(a1 > 0)) eks.push('a₁'); if (!(a2 > 0)) eks.push('a₂');
      if (!hd.ok) eks.push('h_proje');
      if (bekleyen.cond) eks.push('iletken'); if (bekleyen.zone) eks.push('buz bölgesi');
      var tamam = !eks.length;
      var durum = tamam ? (L.pass ? 'uygun' : 'uygun-degil') : 'bilgi';
      var uy = [];
      if (!hd.ok) uy.push('h_proje girilmedi: araçtaki ' + A.tr(hd.h, 1) + ' m örnek değerdir; karar verilmedi.');
      if (eks.length && (eks.length > 1 || hd.ok)) uy.push('Girdi eksik: ' + eks.join(', ') + '. Araçtaki sonuç bu değerlerle hesaplandı, kesin değil.');
      if (L.Tn2b >= L.lim07) uy.push('Tₙ₂b (' + A.tr(L.Tn2b, 2) + ' kg) 0,7·T_kop sınırını (' + A.tr(L.lim07, 0) + ' kg) aşıyor: h_b mutlak değerle hesaplandığı için anlamsız, iletken bu yükü taşımaz.');
      var bas = (poleNo ? 'Direk ' + poleNo + ' · ' : '') + cond + ' · ' + zone + '. bölge · h_b = ' + A.tr(L.hb, 2) + ' m';
      var ozet = hd.ok
        ? bas + ' ' + (L.pass ? '≥' : '<') + ' h_proje = ' + A.tr(hd.h, 1) + ' m → ' + (L.pass ? 'iki misli buz yükü hesabını kurtarıyor' : 'iki misli buz yükü hesabını kurtarmıyor') + (tamam ? '' : ' (girdi eksik)')
        : bas + ' · h_proje girilmedi';
      return {
        ozet: ozet,
        durum: durum,
        girdiler: [
          { ad: 'İletken tertibi', deger: cond + (TEL_AD[cond] ? ' (' + TEL_AD[cond] + ')' : ''), birim: '' },
          { ad: 'Buz yükü bölgesi', deger: zone, birim: '' },
          { ad: 'Buz katsayısı k', deger: ZONE[zone], birim: '' },
          { ad: 'a₁', deger: a1, birim: 'm' },
          { ad: 'a₂', deger: a2, birim: 'm' },
          { ad: 'h_proje', deger: hd.ok ? hd.h : null, birim: 'm' },
          { ad: 'Direk No', deger: poleNo === '' ? null : Number(poleNo), birim: '' },
          { ad: 'İletken çapı d', deger: c.d, birim: 'mm' },
          { ad: 'Birim ağırlık p₀', deger: c.p0, birim: 'kg/m' },
          { ad: 'Başlangıç çekmesi T₁', deger: c.T1, birim: 'kg' },
          { ad: 'Kopma kuvveti T_kop', deger: c.Tkop, birim: 'kg' },
          { ad: 'Elastisite modülü E', deger: E_CONST, birim: 'kg/mm²' },
          { ad: 'Sıcaklık t₁ = tₙ', deger: T1_CONST, birim: '°C' }
        ],
        degerler: [
          { ad: 'Buz yükü p_b', deger: yuvarla(L.pb, 4), birim: 'kg/m' },
          { ad: 'Ortalama açıklık a_ort', deger: yuvarla(L.aort, 2), birim: 'm' },
          { ad: 'p₁ = p₀ + p_b', deger: yuvarla(L.p1, 4), birim: 'kg/m' },
          { ad: '2·p_b (iki misli buz)', deger: yuvarla(L.p2b, 4), birim: 'kg/m' },
          { ad: 'pₙ = 2·p_b + p₀', deger: yuvarla(L.pn, 4), birim: 'kg/m' },
          { ad: 'İki misli buz çekmesi Tₙ₂b', deger: yuvarla(L.Tn2b, 2), birim: 'kg' },
          { ad: '0,7·T_kop (emniyet sınırı)', deger: yuvarla(L.lim07, 2), birim: 'kg' },
          { ad: 'Hesaplanan h_b', deger: yuvarla(L.hb, 2), birim: 'm' }
        ],
        uyarilar: uy
      };
    },

    durumAl: function () {
      var a = {};
      ALANLAR.forEach(function (id) { a[id] = el(id).value; });
      return { surum: 1, alanlar: a, hGirildi: hGirildi, bekleyen: { cond: bekleyen.cond, zone: bekleyen.zone } };
    },

    durumYukle: function (d) {
      if (!d || !d.alanlar) return;
      dinle();
      ALANLAR.forEach(function (id) { if (d.alanlar[id] != null) el(id).value = d.alanlar[id]; });
      hGirildi = !!d.hGirildi;
      var bk = d.bekleyen || {};
      bekleyen.cond = !!bk.cond; bekleyen.zone = !!bk.zone;
      calc();
    },

    alanAdlari: function (yol) {
      var m;
      if (yol === 'proje.buzBolgesi') return 'Buz yükü bölgesi';
      if (yol === 'direk.no') return 'Direk No';
      if (yol === 'direk.rol') return 'Direk görevi';
      if (/iletkenler\[\d+\]\.ad$/.test(yol)) return 'İletken';
      if ((m = /^direk\.kollar\[(\d+)\]\.aciklik$/.exec(yol))) return 'Açıklık (' + (+m[1] + 1) + '. kol)';
      return null;
    }
  };
})();
