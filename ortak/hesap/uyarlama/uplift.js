/* Şebeke-M uyarlaması: ENH Uplift Kontrolü (uplift). Hesap kodlarına dokunmaz: sekmeleri (TABS) aracın kendi biçiminde
   kurar, aracın işlevlerini (writeForm, refresh, solve, stateObj, syncActive) çağırır ve sonuçları okur.
   - Hedef direk: yalnız o direk (iki yanındaki açıklık direk.kollar'dan, komşu kotları kollar[].karsi'dan, komşuların
     bağlantı yüksekliği hattaki direk listesinden).
   - Hedef hat: görevi taşıyıcı (T) olan her ara direk bir sekme; görevi bilinmeyen ara direkler de taşıyıcı sayılıp
     eklenir (uyarı ile).
   - Mesnet kotu Z = direk ayak kotu + iletken bağlantı yüksekliği; biri yoksa h₁ / h₂ boş bırakılır (tahmin yok).
   - A_r: direğin gerilme bölümünün eşdeğer açıklığı (√(Σa³/Σa)), yoksa hattınki; katalogda tam değer yoksa bir
     alttaki A_r seçilir (daha büyük T_min, güvenli taraf).
   - Araç T_min / p₀'ı yalnız açık sekmeye katalogdan yazar: bütün sekmeler katalogdan önceden doldurulur. */
(function () {
  'use strict';
  var TEL = { SWALLOW: 'swallow', RAVEN: 'raven', PIGEON: 'pigeon', PARTRIDGE: 'partridge', HAWK: 'hawk' };
  var OLU = { D: 1, N: 1, K: 1 };                    // gerilme bölümünü bitiren görevler (durdurucu, nihayet, köşe)
  var ROL_AD = { T: 'taşıyıcı', D: 'durdurucu', N: 'nihayet', K: 'köşe' };
  var SEC_ALAN = { selCond: 'cond', selZone: 'zone', selAr: 'ar' };
  // Projeden gelmeyen ve aracın varsayılanıyla kalan seçimler: kullanıcı değiştirene kadar sonuç 'bilgi'
  var bekleyen = { cond: false, zone: false, ar: false };
  var dinleniyor = false;

  function el(id) { return document.getElementById(id); }
  function sayi(v) { var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : NaN; }
  function bos(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function yuvarla(x, n) { var k = Math.pow(10, n); return isFinite(x) ? Math.round(x * k) / k : null; }
  function yaz(x) { return isFinite(x) ? String(yuvarla(x, 3)) : ''; }
  function yolDeger(kok, yol) {
    var c = kok, re = /([^.[\]]+)|\[(\d+)\]/g, m;
    if (c == null) return { yok: true };
    while ((m = re.exec(yol))) {
      if (m[1] !== undefined) { if (c === null || typeof c !== 'object' || Array.isArray(c) || !(m[1] in c)) return { yok: true }; c = c[m[1]]; }
      else { var n = +m[2]; if (!Array.isArray(c) || n >= c.length) return { yok: true }; c = c[n]; }
    }
    return { deger: c === undefined ? null : c };
  }
  function katalogSatiri(cond, zone, ar) {
    for (var i = 0; i < CAT.length; i++) if (CAT[i][0] === cond && CAT[i][1] === +zone && CAT[i][2] === +ar) return CAT[i];
    return null;
  }
  function arSecenekleri(cond, zone) {
    return CAT.filter(function (r) { return r[0] === cond && r[1] === +zone; }).map(function (r) { return r[2]; }).sort(function (x, y) { return x - y; });
  }
  /** Eşdeğer açıklığı katalog listesine oturtur: tam değer, yoksa bir alttaki, o da yoksa en küçük. */
  function arOturt(cond, zone, ar) {
    var ops = arSecenekleri(cond, zone);
    if (!ops.length || !(ar > 0)) return null;
    for (var i = 0; i < ops.length; i++) if (Math.abs(ops[i] - ar) < 0.005) return { ar: ops[i], tur: 'tam' };
    var alt = ops.filter(function (o) { return o < ar; });
    return alt.length ? { ar: alt[alt.length - 1], tur: 'alt' } : { ar: ops[0], tur: 'kucuk' };
  }
  /** Kullanıcı (ya da onun yerine deneme adımı) iletken / bölge / A_r seçimini değiştirince o seçim "girildi" sayılır.
      Uyarlamanın kendisi bu kutulara olay göndermez (sekmeler aracın writeForm'u ile sessizce yazılır). */
  function dinle() {
    if (dinleniyor) return;
    Object.keys(SEC_ALAN).forEach(function (id) {
      var e = el(id); if (e) e.addEventListener('change', function () { bekleyen[SEC_ALAN[id]] = false; });
    });
    dinleniyor = true;
  }
  /** Bir sekmenin sonucu (aracın özet tablosuyla aynı okuma) ve girdilerinin tamlığı. */
  function sekmeSonucu(t) {
    var a1 = parseFloat(t.a1) || 0, a2 = parseFloat(t.a2) || 0, h1 = parseFloat(t.h1) || 0, h2 = parseFloat(t.h2) || 0;
    var p0 = parseFloat(t.p0) || 0, T = parseFloat(t.tmin) || 0;
    var eks = [];
    if (!(a1 > 0)) eks.push('a₁'); if (!(a2 > 0)) eks.push('a₂');
    if (bos(t.h1)) eks.push('h₁'); if (bos(t.h2)) eks.push('h₂');
    if (!(T > 0)) eks.push('T_min'); if (!(p0 > 0)) eks.push('p₀');
    if (t.src === 'katalog') { if (bekleyen.cond) eks.push('iletken'); if (bekleyen.zone) eks.push('buz bölgesi'); if (bekleyen.ar) eks.push('A_r'); }
    var r = (a1 > 0 && a2 > 0 && T > 0) ? solve(p0, T, a1, a2, h1, h2) : null;
    return { t: t, a1: a1, a2: a2, h1: h1, h2: h2, p0: p0, T: T, r: r, eksik: eks, tamam: !eks.length && !!r };
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Kontrol: f_min = p₀·4·a₁·a₂/(8·T_min) > x_proje = (a₂·h₁ + a₁·h₂)/(a₁ + a₂) ise uplift yoktur; değilse taşıyıcı yerine durdurucu gerekir. R = p₀(a₁+a₂)/2 − T_min(h₁/a₁ + h₂/a₂) direğe gelen düşey kuvvettir.',
      'T_min katalogdan iletken, buz bölgesi ve eşdeğer açıklığa (A_r) göre alınır; ara değer yoktur. Şebeke-M direğin gerilme bölümünün eşdeğer açıklığını hesaplar ve katalogda tam değer yoksa bir alttaki A_r\'yi seçer (daha büyük T_min, güvenli taraf).',
      'Katalogda Pigeon, 3. bölge, A_r = 150 m için T_min = 198,22 kg yazılıdır; bu değer aynı bölgede 200 m için verilen 361,91 kg\'dan ve 4. bölgede 150 m için verilen 234,36 kg\'dan küçük olduğundan tutarsız görünüyor. Yazarıyla doğrulanmalıdır; bu satır seçilince uyarı verilir (bu satırda bir alttaki A_r seçimi güvenli tarafta kalmayabilir).',
      'h₁ ve h₂ komşu direklerin mesnet kotunun bu direğinkine göre farkıdır: mesnet kotu = direk ayak kotu + iletken bağlantı yüksekliği. Bağlantı yüksekliği projede yalnız direğe girildiyse vardır; yoksa h₁ / h₂ elle girilmelidir (direk boyundan tahmin edilmez).',
      'Araç boş h₁ / h₂\'yi 0 (düz arazi) sayar ve girdi eksikken de "Uplift var" yazabilir; Şebeke-M sonucu ancak bütün girdiler tamamsa uygun / uygun değil olarak kaydeder.',
      'Hattın ilk ve son direği, durdurucu, nihayet ve köşe direkleri kontrol edilmez; görevi bilinmeyen ara direkler taşıyıcı sayılarak kontrol edilir. Açıklıklar yatay (2B) uzunluktur.'
    ],

    hazir: function () {
      var ok = typeof stateObj === 'function' && typeof writeForm === 'function' && Array.isArray(TABS) && TABS.length > 0 &&
        !!el('selCond') && el('selCond').options.length > 0;
      if (ok) dinle();
      return ok;
    },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [], kullanilan: {} };
      if (!b) return r;
      dinle();
      var P = b.proje || {}, H = b.hat || null, Dk = b.direk || null;
      var hedef = (b.hedef && b.hedef.tur) || (Dk ? 'direk' : 'hat');
      var tek = !!Dk && (hedef === 'direk' || !H);
      var goruldu = {};
      function dolan(alan, deger, birim, yol, ham, kaynak) {
        if (yol && goruldu[yol]) return; if (yol) goruldu[yol] = 1;
        r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' });
      }
      function kullan(yol) { var x = yolDeger(b, yol); if (!x.yok) r.kullanilan[yol] = x.deger; }
      var D = H && H.direkler ? H.direkler : [], Ac = H && H.acikliklar ? H.acikliklar : [];
      function dno(i) { return D[i] && !bos(D[i].no) ? String(D[i].no) : String(i + 1); }

      // ---- Proje / hat başlığı
      if (!bos(P.ad)) { A.yaz('#projAd', P.ad); dolan('Proje adı', P.ad, '', 'proje.ad', P.ad); }
      if (H && !bos(H.no)) { A.yaz('#projHat', String(H.no)); dolan('Hat no', String(H.no), '', 'hat.no', H.no); }
      else if (tek && Dk.kollar && Dk.kollar.length && !bos(Dk.kollar[0].hatNo)) { A.yaz('#projHat', String(Dk.kollar[0].hatNo)); dolan('Hat no', String(Dk.kollar[0].hatNo), '', 'direk.kollar[0].hatNo', Dk.kollar[0].hatNo); }
      else if (!bos(P.kod)) { A.yaz('#projHat', String(P.kod)); dolan('Proje kodu', String(P.kod), '', 'proje.kod', P.kod); }

      // ---- Kontrol edilecek direkler ve açıklıkları
      // Hattaki açıklık k: direk k → k+1 (bas / bit numaralarıyla, yoksa sırayla)
      function hatAcikligi(k) {
        var p = dno(k), q = dno(k + 1), j = -1, x = Ac[k];
        if (x && (bos(x.bas) || bos(x.bit) || (String(x.bas) === p && String(x.bit) === q) || (String(x.bas) === q && String(x.bit) === p))) j = k;
        else for (var t = 0; t < Ac.length && j < 0; t++) if (Ac[t] && ((String(Ac[t].bas) === p && String(Ac[t].bit) === q) || (String(Ac[t].bas) === q && String(Ac[t].bit) === p))) j = t;
        return { j: j, u: j >= 0 ? sayi(Ac[j].uzunluk) : NaN, ad: p + '–' + q };
      }
      function hatIndeksi(id, no) {
        for (var i = 0; i < D.length; i++) if (D[i] && ((id != null && D[i].id === id) || (id == null && no != null && String(D[i].no) === String(no)))) return i;
        if (no != null) for (var k = 0; k < D.length; k++) if (D[k] && String(D[k].no) === String(no)) return k;
        return -1;
      }
      /** Direğin gerilme bölümünün açıklıkları (bölüm durdurucu / nihayet / köşe direklerinde ve hat uçlarında biter). */
      function bolum(i) {
        var n = D.length, L = i, R = i;
        while (L > 0) { L--; if (L === 0 || OLU[(D[L] || {}).rol]) break; }
        while (R < n - 1) { R++; if (R === n - 1 || OLU[(D[R] || {}).rol]) break; }
        var sp = [];
        for (var k = L; k < R; k++) { var s = hatAcikligi(k); if (!(s.u > 0)) return null; sp.push(s); }
        return { bas: dno(L), bit: dno(R), acikliklar: sp };
      }

      var adaylar = [];   // { ad, a1, a2, Z0, Z1, Z2, eksik:[], bolum }
      var izler = [];     // iletken adayları { ad, yol }
      if (tek) {
        var kollar = (Dk.kollar || []).map(function (k, n) { return { k: k, n: n }; });
        var ayni = H ? kollar.filter(function (x) { return x.k.hatId != null && x.k.hatId === H.id; }) : [];
        var acsr = kollar.filter(function (x) { return (x.k.iletkenler || []).some(function (i) { return A.iletken(i.ad).aile === 'ACSR'; }); });
        var sec = ayni.length === 2 ? ayni : acsr.length === 2 ? acsr : kollar.slice(0, 2);
        if (kollar.length > 2) r.uyari.push('Direğe ' + kollar.length + ' açıklık bağlı; ' + sec.map(function (x) { return (x.k.karsi && x.k.karsi.no) || (x.n + 1) + '. kol'; }).join(' ve ') + ' yönündeki iki açıklık kullanıldı.');
        sec.forEach(function (x) { (x.k.iletkenler || []).forEach(function (i, m) { izler.push({ ad: i.ad, yol: 'direk.kollar[' + x.n + '].iletkenler[' + m + '].ad' }); }); });
        if (!bos(Dk.no)) kullan('direk.no');
        kullan('direk.rol');
        if (Dk.rol && Dk.rol !== 'T') r.uyari.push('Direğin görevi ' + (ROL_AD[Dk.rol] || Dk.rol) + ': uplift kontrolü taşıyıcı direkler içindir.');
        else if (!Dk.rol) r.uyari.push('Direğin görevi projede yok; taşıyıcı olduğu varsayılarak kontrol edildi.');
        var c = { ad: bos(Dk.no) ? 'Direk' : 'Direk ' + Dk.no, eksik: [] };
        var Zbu = NaN, i0 = H ? hatIndeksi(Dk.id, Dk.no) : -1;
        if (sayi(Dk.kot) === sayi(Dk.kot) && sayi(Dk.baglanti) > 0) {
          Zbu = sayi(Dk.kot) + sayi(Dk.baglanti);
          dolan(c.ad + ' kotu', sayi(Dk.kot), 'm', 'direk.kot', Dk.kot);
          dolan(c.ad + ' bağlantı yüksekliği', sayi(Dk.baglanti), 'm', 'direk.baglanti', Dk.baglanti);
        } else { c.eksik.push(c.ad + (bos(Dk.kot) ? ' kotu' : ' bağlantı yüksekliği')); kullan('direk.kot'); kullan('direk.baglanti'); }
        ['a1', 'a2'].forEach(function (an, s) {
          var x = sec[s], hk = an === 'a1' ? 'h1' : 'h2';
          if (!x) { c[an] = NaN; c[hk] = NaN; c.eksik.push(s + 1 + '. açıklık'); return; }
          var kol = x.k, u = sayi(kol.aciklik), ks = kol.karsi || {}, kno = bos(ks.no) ? (x.n + 1) + '. kol' : String(ks.no);
          c[an] = u;
          var bu = bos(Dk.no) ? 'direk' : String(Dk.no);
          if (u > 0) dolan('Açıklık ' + bu + '–' + kno, u, 'm', 'direk.kollar[' + x.n + '].aciklik', kol.aciklik);
          else c.eksik.push('açıklık ' + bu + '–' + kno);
          // komşunun bağlantı yüksekliği yalnız hattaki direk listesinde var
          var j = H ? hatIndeksi(ks.id, ks.no) : -1, kb = j >= 0 ? D[j].baglanti : null;
          var kk = sayi(ks.kot);
          if (isFinite(Zbu) && kk === kk && sayi(kb) > 0) {
            c[hk] = kk + sayi(kb) - Zbu;
            dolan('Direk ' + kno + ' kotu', kk, 'm', 'direk.kollar[' + x.n + '].karsi.kot', ks.kot);
            dolan('Direk ' + kno + ' bağlantı yüksekliği', sayi(kb), 'm', 'hat.direkler[' + j + '].baglanti', kb);
          } else {
            c[hk] = NaN;
            kullan('direk.kollar[' + x.n + '].karsi.kot'); if (j >= 0) kullan('hat.direkler[' + j + '].baglanti');
            if (!(kk === kk)) c.eksik.push('Direk ' + kno + ' kotu');
            else if (!(sayi(kb) > 0)) c.eksik.push('Direk ' + kno + ' bağlantı yüksekliği');
          }
        });
        c.bolum = i0 > 0 && i0 < D.length - 1 ? bolum(i0) : null;
        adaylar.push(c);
      } else if (H) {
        (H.iletkenler || []).forEach(function (i, m) { izler.push({ ad: i.ad, yol: 'hat.iletkenler[' + m + '].ad' }); });
        var bilinmeyen = [];
        D.forEach(function (d, i) {
          kullan('hat.direkler[' + i + '].rol');
          if (i === 0 || i === D.length - 1 || !d || OLU[d.rol]) return;
          if (d.rol !== 'T') bilinmeyen.push('Direk ' + dno(i));
          kullan('hat.direkler[' + i + '].no');
          var c = { ad: 'Direk ' + dno(i), eksik: [] };
          if (d.rol === 'T') dolan(c.ad + ' görevi', 'taşıyıcı', '', 'hat.direkler[' + i + '].rol', d.rol);
          var Z = function (k) {
            var x = D[k] || {}, kot = sayi(x.kot), bg = sayi(x.baglanti);
            if (kot === kot && bg > 0) {
              dolan('Direk ' + dno(k) + ' kotu', kot, 'm', 'hat.direkler[' + k + '].kot', x.kot);
              dolan('Direk ' + dno(k) + ' bağlantı yüksekliği', bg, 'm', 'hat.direkler[' + k + '].baglanti', x.baglanti);
              return kot + bg;
            }
            c.eksik.push('Direk ' + dno(k) + (kot === kot ? ' bağlantı yüksekliği' : ' kotu'));
            kullan('hat.direkler[' + k + '].kot'); kullan('hat.direkler[' + k + '].baglanti');
            return NaN;
          };
          var s1 = hatAcikligi(i - 1), s2 = hatAcikligi(i);
          c.a1 = s1.u; c.a2 = s2.u;
          if (s1.u > 0) dolan('Açıklık ' + s1.ad, s1.u, 'm', 'hat.acikliklar[' + s1.j + '].uzunluk', Ac[s1.j].uzunluk); else c.eksik.push('açıklık ' + s1.ad);
          if (s2.u > 0) dolan('Açıklık ' + s2.ad, s2.u, 'm', 'hat.acikliklar[' + s2.j + '].uzunluk', Ac[s2.j].uzunluk); else c.eksik.push('açıklık ' + s2.ad);
          var Zb = Z(i), Zs = Z(i - 1), Zg = Z(i + 1);
          c.h1 = Zs - Zb; c.h2 = Zg - Zb;
          c.bolum = bolum(i);
          adaylar.push(c);
        });
        if (bilinmeyen.length) r.uyari.push('Görevi projede olmayan ara direkler taşıyıcı sayılarak kontrole eklendi: ' + bilinmeyen.join(', ') + '. Durdurucu olanların sekmesini silin.');
        if (!adaylar.length) r.uyari.push('Bu hatta kontrol edilecek taşıyıcı direk yok (ara direklerin hepsi durdurucu, nihayet ya da köşe).');
      }

      // ---- İletken ve buz bölgesi
      var cond = null, zone = null, iletkenIz = null, katalogDisi = [], acsrDegil = [];
      izler.forEach(function (x) {
        if (!x.ad) return;
        var cz = A.iletken(x.ad);
        if (cz.aile === 'ACSR' && TEL[cz.tel]) { if (!cond) { cond = TEL[cz.tel]; iletkenIz = x; } }
        else if (cz.aile === 'ACSR') katalogDisi.push(x.ad);
        else acsrDegil.push(x.ad);
      });
      if (cond) dolan('İletken', cond.charAt(0).toUpperCase() + cond.slice(1), '', iletkenIz.yol, iletkenIz.ad, iletkenIz.ad);
      else {
        r.eksik.push({ alan: 'İletken cinsi', sec: '#selCond', neden: katalogDisi.length ? 'İletken (' + katalogDisi[0] + ') katalogda yok; Manuel seçip T_min ve p₀ girin.'
          : acsrDegil.length ? 'İletken (' + acsrDegil.join(', ') + ') çıplak ACSR değil.' : 'İletken projede yok; seçin, sonra A_r\'yi kontrol edin.' });
        if (katalogDisi.length || acsrDegil.length) r.uyari.push('Uplift kataloğu yalnız Swallow, Raven, Pigeon, Partridge ve Hawk iletkenleri içindir; projedeki iletken: ' + katalogDisi.concat(acsrDegil).join(', ') + '.');
        cond = el('selCond').value; bekleyen.cond = true;
      }
      var by = bos(P.buzBolgesi) ? null : String(P.buzBolgesi).trim();
      if (by && arSecenekleri(cond, by).length) { zone = by; dolan('Buz bölgesi', by, '', 'proje.buzBolgesi', P.buzBolgesi); }
      else {
        zone = el('selZone').value; bekleyen.zone = true;
        r.eksik.push({ alan: 'Buz bölgesi', sec: '#selZone', neden: by ? 'Projedeki buz bölgesi (' + by + ') katalogda yok.' : 'Projede buz bölgesi yok; seçin.' });
      }

      // ---- A_r: bölümün eşdeğer açıklığı, yoksa hattınki; katalog listesine oturtulur
      var arNot = {}, arYok = [], arKucuk = [];
      adaylar.forEach(function (c) {
        var ar = NaN, kaynak = '';
        if (c.bolum) {
          ar = A.ruling(c.bolum.acikliklar.map(function (s) { return s.u; }));
          c.bolum.acikliklar.forEach(function (s) { kullan('hat.acikliklar[' + s.j + '].uzunluk'); });
          kaynak = 'bölüm ' + c.bolum.bas + '–' + c.bolum.bit;
        } else if (H && sayi(H.ruling) > 0) {
          ar = sayi(H.ruling); kaynak = 'hat';
          dolan('Hattın eşdeğer açıklığı', ar, 'm', 'hat.ruling', H.ruling);
        }
        var o = isFinite(ar) ? arOturt(cond, zone, ar) : null;
        if (!o) { arYok.push(c.ad); c.ar = (arSecenekleri(cond, zone).indexOf(+el('selAr').value) >= 0 ? el('selAr').value : String(arSecenekleri(cond, zone)[0] || '')); return; }
        c.ar = String(o.ar);
        var anahtar = kaynak + '|' + yuvarla(ar, 2) + '|' + o.ar + '|' + o.tur;
        (arNot[anahtar] = arNot[anahtar] || { kaynak: kaynak, ar: ar, o: o, direkler: [] }).direkler.push(c.ad);
        if (o.tur === 'kucuk') arKucuk.push(c.ad);
      });
      Object.keys(arNot).forEach(function (k) {
        var x = arNot[k], kim = x.direkler.join(', ');
        var ne = (x.kaynak === 'hat' ? 'hattın' : x.kaynak + ' gerilme bölümünün') + ' eşdeğer açıklığı ' + A.tr(x.ar, 2) + ' m';
        if (x.o.tur === 'tam') r.uyari.push(kim + ': ' + ne + ', katalogda A_r = ' + x.o.ar + ' m.');
        else if (x.o.tur === 'alt') r.uyari.push(kim + ': ' + ne + '; katalogda tam değer yok, bir alttaki A_r = ' + x.o.ar + ' m seçildi (daha büyük T_min, güvenli taraf).');
        else r.uyari.push(kim + ': ' + ne + ' katalogdaki en küçük değerden de küçük; A_r = ' + x.o.ar + ' m seçildi. T_min gerçekte daha büyüktür, sonucu kontrol edin ya da Manuel seçip T_min girin.');
        if (cond === 'pigeon' && +zone === 3 && x.o.ar === 150) r.uyari.push(kim + ': katalogdaki Pigeon / 3. bölge / A_r 150 m değeri (198,22 kg) komşu değerlerle tutarsız; yazarıyla doğrulayın.');
      });
      if (arYok.length || arKucuk.length) {
        bekleyen.ar = true;
        r.eksik.push({ alan: 'Eşdeğer açıklık A_r', sec: '#selAr', neden: arYok.length ? 'Eşdeğer açıklık hesaplanamadı (' + arYok.join(', ') + '); her sekmede katalogdan seçin.' : 'Eşdeğer açıklık katalogdaki en küçük değerden küçük (' + arKucuk.join(', ') + '); A_r\'yi ya da Manuel T_min\'i kontrol edin.' });
      }

      // ---- Sekmeler (aracın kendi biçimi; elle girilmiş h / açıklık değerleri güncel bilgi aktarılırken korunur)
      if (!tek && !H) r.eksik.push({ alan: 'Direk ve açıklıklar', sec: '#a1', neden: 'Direk ya da hat bilgisi projeden gelmedi; açıklıkları ve mesnet farklarını girin.' });
      var eski = {};
      (TABS || []).forEach(function (t) { eski[t.ad] = t; });
      var eksikA = [], eksikH = [], eksikNeden = [];
      var sekmeler = adaylar.map(function (c) {
        var row = katalogSatiri(cond, zone, c.ar), e = eski[c.ad] || {};
        var t = { ad: c.ad, src: 'katalog', cond: cond, zone: String(zone), ar: String(c.ar), tmin: row ? String(row[3]) : '', p0: row ? String(row[4]) : '',
          a1: yaz(c.a1), a2: yaz(c.a2), h1: yaz(c.h1), h2: yaz(c.h2) };
        ['a1', 'a2', 'h1', 'h2'].forEach(function (k) { if (t[k] === '' && !bos(e[k])) t[k] = e[k]; });
        if (t.a1 === '' || t.a2 === '') eksikA.push(c.ad);
        if (t.h1 === '' || t.h2 === '') {
          eksikH.push(c.ad);
          c.eksik.forEach(function (x) { if (!/açıklık/.test(x) && eksikNeden.indexOf(x) < 0) eksikNeden.push(x); });
        }
        return t;
      });
      if (!sekmeler.length) sekmeler = [{ ad: tek ? 'Direk' : '—', src: 'katalog', cond: cond, zone: String(zone), ar: el('selAr').value, tmin: '', p0: '', a1: '', a2: '', h1: '', h2: '' }];
      TABS = sekmeler; ACT = 0;
      writeForm(TABS[0]);
      if (eksikA.length) r.eksik.push({ alan: 'Açıklıklar a₁ / a₂', sec: '#a1', neden: 'Projede uzunluğu olmayan açıklık var: ' + eksikA.join(', ') + '.' });
      if (eksikH.length) {
        r.eksik.push({ alan: 'Mesnet yükseklik farkları h₁ / h₂', sec: '#h1', neden: (eksikH.length > 1 ? eksikH.join(', ') + ' sekmelerinde' : eksikH[0] + ' sekmesinde') + ' boş: projede yok — ' + eksikNeden.join(', ') + '. Boy kesitten okuyup girin (araç boş alanı 0 sayar).' });
      }
      return r;
    },

    hesapla: function () { refresh(); },

    sonuc: function (A) {
      if (typeof stateObj !== 'function' || !TABS || !TABS.length) return { hata: 'Hesap yüklenemedi.' };
      syncActive();
      var S = TABS.map(sekmeSonucu);
      var tamam = S.filter(function (x) { return x.tamam; });
      var kalan = S.filter(function (x) { return x.r && x.tamam && !x.r.ok; });
      var uygun = tamam.filter(function (x) { return x.r.ok; });
      var eksikler = S.filter(function (x) { return !x.tamam; });
      if (!S.some(function (x) { return x.r; })) return { hata: 'Açıklıklar ve T_min girilmedi: kontrol edilecek direk yok.' };
      var durum = kalan.length ? 'uygun-degil' : eksikler.length ? 'bilgi' : 'uygun';
      var uy = [];
      eksikler.forEach(function (x) { uy.push((x.t.ad || 'Sekme') + ': girdi eksik (' + x.eksik.join(', ') + ')' + (x.r ? '; araçtaki sonuç bu eksiklerle hesaplandı, kesin değil.' : '.')); });
      S.forEach(function (x) { if (x.t.src === 'katalog' && x.t.cond === 'pigeon' && +x.t.zone === 3 && +x.t.ar === 150) uy.push((x.t.ad || 'Sekme') + ': katalogdaki Pigeon / 3. bölge / A_r 150 m değeri tutarsız görünüyor; yazarıyla doğrulayın.'); });
      function bicim(x) { return x.r ? 'f_min ' + A.tr(x.r.fmin, 2) + ' m ' + (x.r.ok ? '>' : '≤') + ' x_proje ' + A.tr(x.r.xp, 2) + ' m' : 'girdi eksik'; }
      var ozet;
      if (S.length === 1) {
        var x = S[0];
        ozet = (x.t.ad || 'Direk') + ': ' + bicim(x) + (x.r ? (x.r.ok ? ' → uplift yok' : ' → uplift var, durdurucu gerekir') + ' (R = ' + A.tr(x.r.R, 2) + ' kg)' : '') + (x.tamam ? '' : ' · girdi eksik');
      } else {
        ozet = S.length + ' taşıyıcı direk: ' + uygun.length + ' uygun, ' + kalan.length + ' durdurucu gerekli' +
          (kalan.length ? ' (' + kalan.map(function (y) { return y.t.ad; }).join(', ') + ')' : '') + (eksikler.length ? ', ' + eksikler.length + ' girdisi eksik' : '');
      }
      var degerler = [
        { ad: 'Kontrol edilen direk', deger: S.length, birim: 'adet' },
        { ad: 'Uplift yok (uygun)', deger: uygun.length, birim: 'adet' },
        { ad: 'Durdurucu gerekli', deger: kalan.length, birim: 'adet' },
        { ad: 'Girdisi eksik', deger: eksikler.length, birim: 'adet' }
      ];
      // x_proje, emniyet payı ve R yalnız girdisi tam direklerden (eksik h araçta 0 sayılır, o değerler yanıltır)
      var hesapli = S.filter(function (y) { return y.tamam; });
      if (S.length === 1 && S[0].r) {
        degerler.push({ ad: 'f_min (sanal sehim)', deger: yuvarla(S[0].r.fmin, 3), birim: 'm' });
        if (S[0].tamam) degerler.push({ ad: 'x_proje', deger: yuvarla(S[0].r.xp, 3), birim: 'm' },
          { ad: 'Emniyet payı f_min − x_proje', deger: yuvarla(S[0].r.margin, 3), birim: 'm' },
          { ad: 'Düşey mesnet kuvveti R', deger: yuvarla(S[0].r.R, 2), birim: 'kg' });
      } else if (hesapli.length) {
        var enk = hesapli.reduce(function (m, y) { return !m || y.r.margin < m.r.margin ? y : m; }, null);
        var enR = hesapli.reduce(function (m, y) { return !m || y.r.R < m.r.R ? y : m; }, null);
        degerler.push({ ad: 'En küçük emniyet payı f_min − x_proje', deger: yuvarla(enk.r.margin, 3), birim: 'm' },
          { ad: 'En küçük emniyet payının direği', deger: enk.t.ad, birim: '' },
          { ad: 'En küçük düşey mesnet kuvveti R', deger: yuvarla(enR.r.R, 2), birim: 'kg' });
      }
      var t0 = S[0].t;
      var girdiler = [
        { ad: 'Veri kaynağı', deger: t0.src === 'katalog' ? 'Katalog' : 'Manuel', birim: '' },
        { ad: 'İletken / bölge', deger: tabLabel(t0), birim: '' }
      ];
      if (S.length === 1) {
        girdiler.push({ ad: 'T_min', deger: S[0].T, birim: 'kg' }, { ad: 'p₀', deger: S[0].p0, birim: 'kg/m' },
          { ad: 'a₁', deger: S[0].a1, birim: 'm' }, { ad: 'a₂', deger: S[0].a2, birim: 'm' },
          { ad: 'h₁', deger: bos(t0.h1) ? null : S[0].h1, birim: 'm' }, { ad: 'h₂', deger: bos(t0.h2) ? null : S[0].h2, birim: 'm' });
      }
      var satirlar = S.map(function (y) {
        var t = y.t;
        var tam = y.tamam;
        return [t.ad || '', tabLabel(t), y.a1 || null, y.a2 || null, bos(t.h1) ? null : y.h1, bos(t.h2) ? null : y.h2, y.T || null, y.p0 || null,
          y.r ? yuvarla(y.r.fmin, 3) : null, tam ? yuvarla(y.r.xp, 3) : null, tam ? yuvarla(y.r.margin, 3) : null, tam ? yuvarla(y.r.R, 2) : null,
          !tam ? 'eksik' : y.r.ok ? 'UYGUN' : 'DURDURUCU'];
      });
      return {
        ozet: ozet, durum: durum, girdiler: girdiler, degerler: degerler,
        tablo: { basliklar: ['Direk', 'İletken / bölge', 'a₁ (m)', 'a₂ (m)', 'h₁ (m)', 'h₂ (m)', 'T_min (kg)', 'p₀ (kg/m)', 'f_min (m)', 'x_proje (m)', 'Emniyet payı (m)', 'R (kg)', 'Sonuç'], satirlar: satirlar },
        uyarilar: uy
      };
    },

    durumAl: function () {
      return { surum: 1, arac: JSON.parse(JSON.stringify(stateObj())), bekleyen: { cond: bekleyen.cond, zone: bekleyen.zone, ar: bekleyen.ar } };
    },

    durumYukle: function (d) {
      if (!d || !d.arac || !Array.isArray(d.arac.tabs) || !d.arac.tabs.length) return;
      dinle();
      var s = d.arac;
      el('projAd').value = s.proj || ''; el('projHat').value = s.hat || '';
      TABS = s.tabs.map(function (t) { return JSON.parse(JSON.stringify(t)); });
      ACT = Math.min(s.act || 0, TABS.length - 1);
      writeForm(TABS[ACT]);
      var bk = d.bekleyen || {};
      bekleyen.cond = !!bk.cond; bekleyen.zone = !!bk.zone; bekleyen.ar = !!bk.ar;
      refresh();
    },

    alanAdlari: function (yol) {
      var m, b = null;
      try { b = window.__SM.durum.baglam; } catch (e) { b = null; }
      function no(i) { var x = b && b.hat && b.hat.direkler && b.hat.direkler[i]; return x && x.no != null ? String(x.no) : (i + 1) + '. sıradaki'; }
      if (yol === 'proje.ad') return 'Proje adı';
      if (yol === 'hat.no' || /hatNo$/.test(yol)) return 'Hat no';
      if (yol === 'proje.kod') return 'Proje kodu';
      if (yol === 'proje.buzBolgesi') return 'Buz bölgesi';
      if (yol === 'hat.ruling') return 'Hattın eşdeğer açıklığı';
      if (/iletkenler\[\d+\]\.ad$/.test(yol)) return 'İletken';
      if (yol === 'direk.no') return 'Direk no';
      if (yol === 'direk.rol') return 'Direk görevi';
      if (yol === 'direk.kot') return 'Direk kotu';
      if (yol === 'direk.baglanti') return 'Direk bağlantı yüksekliği';
      if ((m = /^direk\.kollar\[(\d+)\]\.aciklik$/.exec(yol))) return 'Açıklık (' + (+m[1] + 1) + '. kol)';
      if ((m = /^direk\.kollar\[(\d+)\]\.karsi\.kot$/.exec(yol))) return 'Komşu direk kotu (' + (+m[1] + 1) + '. kol)';
      if ((m = /^hat\.direkler\[(\d+)\]\.(\w+)$/.exec(yol))) return 'Direk ' + no(+m[1]) + ' ' + ({ rol: 'görevi', kot: 'kotu', baglanti: 'bağlantı yüksekliği', no: 'numarası' }[m[2]] || m[2]);
      if ((m = /^hat\.acikliklar\[(\d+)\]\.uzunluk$/.exec(yol))) return 'Açıklık ' + no(+m[1]) + '–' + no(+m[1] + 1);
      return null;
    }
  };
})();
