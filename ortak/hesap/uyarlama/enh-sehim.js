/* Şebeke-M uyarlaması: ENH Sehim Hesabı (enh-sehim). Hesap kodlarına dokunmaz: giriş alanlarına yazar, aracın kendi
   işlevlerini (setMod, setCond, halUygula, refresh, bolumler, halList, cozHal, cozT, T1, collect, apply) çağırır ve
   sonuçları aracın kendi tablolarından okur.
   Hedef: hat (direkten açılınca da bağlamda direğin üzerindeki hat gelir). Direk listesi ve açıklıklar hattan,
   iletken hattın ACSR iletkeninden, buz bölgesi projeden alınır.
   Aracın bilinen iki tuzağına karşı önlem:
   - Katalog modunda kayıt geri yüklenirken araç buz katsayısı k, rüzgâr basıncı q, başlangıç hâli ve elle girilen
     t1 / p1 değerlerini varsayılana döndürür → durumYukle bunları kayıttan yeniden yazar.
   - Aracın künye düzeltmesi (kunyeDuzelt) unvanı kendi varsayılanına çevirebilir → ad ve unvan her geri yüklemeden
     sonra yeniden yazılır; ad yoksa "—" yazılır. */
(function () {
  'use strict';
  var TABLO = '.wrap > .card:nth-of-type(3)';            // "Direkler ve açıklıklar" kartı (tablo yeniden çizilse de kalır)
  var TEL = { SWALLOW: 0, RAVEN: 1, PIGEON: 2, PARTRIDGE: 3, HAWK: 4 };
  var MALZEME = { demir: 'DEMIR', beton: 'BETON', agac: 'AHŞAP' };
  var MALZEME_AD = { demir: 'demir', beton: 'beton', agac: 'ağaç' };
  var ROL_AD = { T: 'taşıyıcı', D: 'durdurucu', N: 'nihayet', K: 'köşe' };

  function el(id) { return document.getElementById(id); }
  function sayi(v) { var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : NaN; }
  function r2(x) { return isFinite(x) ? Math.round(x * 100) / 100 : null; }
  function bos(v) { return v === undefined || v === null || String(v).trim() === ''; }
  /** Bağlamdaki yolun değeri; yol yoksa { yok: true }. Güncellik denetimi yalnız var olan yolları karşılaştırabilir
      (yolu olmayan bir kayıt, aynı bağlamla açılınca "silindi" görünür). */
  function yolDeger(kok, yol) {
    var c = kok, re = /([^.[\]]+)|\[(\d+)\]/g, m;
    if (c == null) return { yok: true };
    while ((m = re.exec(yol))) {
      if (m[1] !== undefined) { if (c === null || typeof c !== 'object' || Array.isArray(c) || !(m[1] in c)) return { yok: true }; c = c[m[1]]; }
      else { var n = +m[2]; if (!Array.isArray(c) || n >= c.length) return { yok: true }; c = c[n]; }
    }
    return { deger: c === undefined ? null : c };
  }
  function kvYazi(kv) { return String(kv).replace('.', ','); }
  function seceneVar(id, v) { var s = el(id); for (var i = 0; i < s.options.length; i++) if (s.options[i].value === String(v)) return true; return false; }
  /** Değer farklıysa yazar ve olayları tetikler; aynıysa dokunmaz (elle değiştirilmiş bağımlı alanlar korunur). */
  function secYaz(A, id, v) {
    if (el(id).value === String(v)) return true;
    return A.sec('#' + id, String(v)) != null;
  }
  function adlariYaz(adi, soy, unv) {
    el('pAdi').value = bos(adi) ? '—' : adi;
    el('pSoy').value = soy == null ? '' : soy;
    el('pUnv').value = bos(unv) ? '—' : unv;
  }
  function baglamDireki(i) {
    try { var b = window.__SM && window.__SM.durum && window.__SM.durum.baglam; var d = b && b.hat && b.hat.direkler && b.hat.direkler[i]; return d && d.no != null ? String(d.no) : null; } catch (e) { return null; }
  }

  // ------------------------------------------------------------------ sonuç okuma (aracın kendi tablolarından)
  /** #tbRes satırları: bölümün ilk satırında [DN, tip, a, Ar, (Tn, f)×hal], diğerlerinde [DN, tip, a, f×hal]. */
  function fDegerleri(A, B, nh) {
    var satir = el('tbRes').rows, out = {}, k = 0;
    B.forEach(function (b) {
      b.idx.forEach(function (i, s) {
        var c = satir[k++] ? satir[k - 1].cells : [], f = [];
        for (var j = 0; j < nh; j++) { var h = s === 0 ? c[5 + 2 * j] : c[3 + j]; f.push(h ? A.sayi(h.textContent, ',') : NaN); }
        out[i] = f;
      });
    });
    return out;
  }
  /** #tbSaha satırları: bölümün ilk satırında [DN, tip, a, Ar, Tn, f, cm, çıta], diğerlerinde [DN, tip, a, f, cm, çıta]. */
  function sahaDegerleri(A, B) {
    var satir = el('tbSaha').rows, out = {}, k = 0;
    B.forEach(function (b) {
      b.idx.forEach(function (i, s) {
        var c = satir[k++] ? satir[k - 1].cells : [];
        var f = s === 0 ? c[5] : c[3], cita = s === 0 ? c[7] : c[5];
        out[i] = { f: f ? A.sayi(f.textContent, ',') : NaN, cita: cita ? A.sayi(cita.textContent, ',') : NaN };
      });
    });
    return out;
  }
  function v(x) { return isFinite(x) ? x : null; }

  window.__SM_UYARLAMA = {
    notlar: [
      'Çekme kuvveti hal değişim denkleminden, her gerilme bölümünün eşdeğer açıklığı Ar = √(Σa³/Σa) ile hesaplanır; sehim f = pₙ·a²/(8·Tₙ). Gerilme bölümü, tipi "D" ile biten direklerde (D, K.D, SEK-D, TRF-D) biter.',
      'Hattın ilk ve son direği uç direk olduğundan durdurucu (D) alınır. Projede "köşe" görevli direkler köşe durdurucu (K.D), sapma açısı olan taşıyıcılar köşe taşıyıcı (K.T) yazılır; köşe taşıyıcı olan bir köşe direği varsa tabloda K.T seçin.',
      'Açıklıklar yatay (2B) uzunluk olarak alınır.',
      'Buz katsayısı k = 0,1 × buz bölgesi no alınır (1. bölge 0,1 … 5. bölge 0,5). İletken Kopma (iki misli buz yükü) hesabı ise 1. bölge için 0, 4. bölge için 0,5, 5. bölge için 1,2 kullanır: iki hesabın buz yükü 1., 4. ve 5. bölgede farklıdır, yazarıyla doğrulanmalıdır.',
      'Katalogdaki 1/0 AWG (Raven), 3/0 AWG (Pigeon), 266,8 MCM ve 477 MCM için başlangıç hâli +5 °C %100 rüzgârdır; kısa açıklıklı bölümlerde −5 °C\'de gerilme σmax\'ı aşabilir. Araç bunu yalnız σ aralığında gösterir; Şebeke-M aşım varsa uyarı ekler.',
      'Katalogda yalnız Swallow (3 AWG), Raven (1/0), Pigeon (3/0), Partridge (266,8 MCM) ve Hawk (477 MCM) vardır; başka bir ACSR iletken için "Elle" seçip iletken değerlerini girin.',
      'Projede bulunmayan bilgiler: rüzgâr basıncı q (araçta 53 kg/m²), saha ölçüm sıcaklığı ve ölçüm referans farkı (konsol düşümü). Gerekirse elle değiştirin.',
      'Araç, katalog modundaki bir hesabı geri açarken buz katsayısı, rüzgâr basıncı ve başlangıç hâli seçimini varsayılana döndürüyordu; Şebeke-M kayıtlı değerleri yeniden yazar (formül değişmedi).'
    ],

    hazir: function () {
      return typeof refresh === 'function' && typeof collect === 'function' && typeof bolumler === 'function' &&
        !!el('selC') && el('selC').options.length > 0;
    },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [], kullanilan: {} };
      if (!b) return r;
      var P = b.proje || {}, H = b.hat || null, Dk = b.direk || null;
      function dolan(alan, deger, birim, yol, ham, kaynak) { r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' }); }
      /** Panelde ayrı satır olmayan ama hesapta kullanılan bağlam değeri (güncellik için); yalnız yol varsa. */
      function kullan(yol) { var x = yolDeger(b, yol); if (!x.yok) r.kullanilan[yol] = x.deger; }

      // ---- 1. İletken (önce: iletken seçimi başlangıç hâlini ve t1'i kataloğa göre yeniden yazar)
      var adaylar = [];
      if (H) (H.iletkenler || []).forEach(function (i, k) { adaylar.push({ i: i, yol: 'hat.iletkenler[' + k + '].ad' }); });
      else if (Dk) (Dk.kollar || []).forEach(function (kol, k) { (kol.iletkenler || []).forEach(function (i, n) { adaylar.push({ i: i, yol: 'direk.kollar[' + k + '].iletkenler[' + n + '].ad' }); }); });
      var acsr = null, diger = [];
      adaylar.forEach(function (x) { var c = A.iletken(x.i && x.i.ad); if (c.aile === 'ACSR' && !acsr) acsr = { x: x, c: c }; else if (x.i && x.i.ad) diger.push(x.i.ad); });
      if (acsr && TEL[acsr.c.tel] !== undefined) {
        var ci = TEL[acsr.c.tel];
        if (KATALOG) secYaz(A, 'selC', ci);
        else { el('selC').value = String(ci); r.uyari.push('Hesap "Elle" modunda: iletken değerlerini (S, d, p₀, E, β, σmax) ' + acsr.x.i.ad + ' için kontrol edin.'); }
        dolan('İletken', COND[ci].ad, '', acsr.x.yol, acsr.x.i.ad, acsr.x.i.ad);
      } else if (acsr) {
        r.eksik.push({ alan: 'İletken cinsi', sec: '#selC', neden: 'Hattın iletkeni (' + acsr.x.i.ad + ') aracın kataloğunda yok; "Elle" seçip iletken değerlerini girin.' });
        r.uyari.push('İletken ' + acsr.x.i.ad + ' katalogda yok (katalog: Swallow, Raven, Pigeon, Partridge, Hawk). Araçtaki iletken değerleri bu hat için değil.');
      } else if (diger.length) {
        r.eksik.push({ alan: 'İletken cinsi', sec: '#selC', neden: 'Hattın iletkeni (' + diger.join(', ') + ') çıplak ACSR değil.' });
        r.uyari.push('Bu hesap çıplak ACSR (ENH) iletkenler içindir; hattın iletkeni ' + diger.join(', ') + '. İletken alanına bir şey yazılmadı.');
      } else {
        r.eksik.push({ alan: 'İletken cinsi', sec: '#selC', neden: 'Hattın iletkeni projede yok.' });
      }
      if (acsr && adaylar.filter(function (x) { var c = A.iletken(x.i && x.i.ad); return c.aile === 'ACSR' && c.tel !== acsr.c.tel; }).length) {
        r.uyari.push('Hatta birden çok ACSR iletken var; ilki (' + acsr.x.i.ad + ') kullanıldı.');
      }

      // ---- 2. Buz bölgesi (k = 0,1·BY aracın kendi kuralıyla yazılır)
      var by = bos(P.buzBolgesi) ? null : String(P.buzBolgesi).trim();
      if (by && seceneVar('pBY', by)) {
        secYaz(A, 'pBY', by);
        dolan('Buz bölgesi', by, '', 'proje.buzBolgesi', P.buzBolgesi);
      } else {
        r.eksik.push({ alan: 'Buz bölgesi', sec: '#pBY', neden: by ? 'Projedeki buz bölgesi (' + by + ') listede yok.' : 'Projede buz bölgesi yok; seçin (buz katsayısı k = 0,1 × bölge no yazılır).' });
      }

      // ---- 3. Proje ve hat bilgileri (yalnız rapor başlığı)
      var adParca = [];
      if (!bos(P.ad)) { adParca.push(P.ad); dolan('Proje adı', P.ad, '', 'proje.ad', P.ad); }
      if (H && !bos(H.no)) { adParca.push('Hat ' + H.no); dolan('Hat no', String(H.no), '', 'hat.no', H.no); }
      if (adParca.length) A.yaz('#pAd', adParca.join(' – '));
      var kv = H ? H.gerilimKV : null, kvYol = 'hat.gerilimKV';
      if (kv == null && Dk && Dk.kollar) Dk.kollar.forEach(function (k, n) { if (kv == null && k.gerilimKV != null) { kv = k.gerilimKV; kvYol = 'direk.kollar[' + n + '].gerilimKV'; } });
      if (kv != null && seceneVar('pU', kvYazi(kv))) { A.yaz('#pU', kvYazi(kv)); dolan('Gerilim U', kvYazi(kv), 'kV', kvYol, kv); }
      else r.eksik.push({ alan: 'Gerilim U', sec: '#pU', neden: kv != null ? 'Hattın gerilimi (' + kvYazi(kv) + ' kV) listede yok; rapor başlığı için seçin.' : 'Hattın gerilimi projede yok; rapor başlığı için seçin.' });

      // ---- 4. Projeyi yapan (boşsa "—")
      var ad = bos(P.yapan) ? '' : String(P.yapan).trim().replace(/\s+/g, ' ');
      var parca = ad ? ad.split(' ') : [];
      var adi = parca.length > 1 ? parca.slice(0, -1).join(' ') : (parca[0] || '');
      var soy = parca.length > 1 ? parca[parca.length - 1] : '';
      adlariYaz(adi, ad ? soy : '—', P.unvan);
      if (ad) dolan('Projeyi yapan', ad, '', 'proje.yapan', P.yapan);
      else r.eksik.push({ alan: 'Projeyi yapan', sec: '#pAdi', neden: 'Projede hesabı yapanın adı yok; adı ve soyadı girin.' });
      if (!bos(P.unvan)) dolan('Unvan', P.unvan, '', 'proje.unvan', P.unvan);
      else r.eksik.push({ alan: 'Unvan', sec: '#pUnv', neden: 'Projede unvan yok.' });

      // ---- 5. Direkler ve açıklıklar
      var D = H && H.direkler ? H.direkler : [];
      if (D.length < 2) {
        r.eksik.push({ alan: 'Direkler ve açıklıklar', sec: TABLO, neden: 'Hattın direk listesi projeden gelmedi; direkleri ve açıklıkları tabloya girin.' });
        return r;
      }
      // Malzeme: rapor başlığındaki "Direk tipi" (çoğunluk)
      var say = {}, ilk = {};
      D.forEach(function (d, i) { if (d && MALZEME[d.malzeme]) { say[d.malzeme] = (say[d.malzeme] || 0) + 1; if (ilk[d.malzeme] === undefined) ilk[d.malzeme] = i; kullan('hat.direkler[' + i + '].malzeme'); } });
      var turler = Object.keys(say).sort(function (x, y) { return say[y] - say[x] || ilk[x] - ilk[y]; });
      if (turler.length) {
        var mz = turler[0];
        A.yaz('#pTip', MALZEME[mz]);
        dolan('Direk malzemesi', MALZEME[mz], '', 'hat.direkler[' + ilk[mz] + '].malzeme', mz,
          turler.map(function (t) { return say[t] + ' ' + MALZEME_AD[t]; }).join(', ') + (turler.length > 1 || say[mz] < D.length ? ' (' + D.length + ' direk)' : ''));
        if (turler.length > 1) r.uyari.push('Direkler farklı malzemeden (' + turler.map(function (t) { return say[t] + ' ' + MALZEME_AD[t]; }).join(', ') + '); rapor başlığına çoğunluk (' + MALZEME[mz] + ') yazıldı.');
      } else {
        r.eksik.push({ alan: 'Direk tipi', sec: '#pTip', neden: 'Direklerin malzemesi projede yok; rapor başlığı için seçin.' });
      }

      // Kullanıcının bu tabloda elle girdiği görev / açıklık (güncel bilgi aktarılırken korunur)
      var eski = {};
      (M.direk || []).forEach(function (x) { eski[String(x.dn)] = x; });
      var n = D.length, bilinmeyen = [], eksikAc = [], uclar = [];
      var satirlar = D.map(function (d, i) {
        d = d || {};
        var dn = d.no != null && String(d.no) !== '' ? String(d.no) : String(i + 1);
        kullan('hat.direkler[' + i + '].no');
        var tip;
        if (i === 0 || i === n - 1) { tip = 'D'; uclar.push(dn); }
        else if (d.rol === 'D' || d.rol === 'N') tip = 'D';
        else if (d.rol === 'K') tip = 'K.D';
        else if (d.rol === 'T') { tip = sayi(d.aci) > 0 ? 'K.T' : 'T'; kullan('hat.direkler[' + i + '].aci'); }
        else { tip = eski[dn] ? eski[dn].tip : 'T'; bilinmeyen.push(dn); kullan('hat.direkler[' + i + '].rol'); }
        if (i > 0 && i < n - 1 && ROL_AD[d.rol]) {
          dolan('Direk ' + dn + ' görevi', tip, '', 'hat.direkler[' + i + '].rol', d.rol,
            ROL_AD[d.rol] + (d.rol === 'T' && sayi(d.aci) > 0 ? ', α = ' + A.tr(sayi(d.aci), 2) + '°' : ''));
        }
        return { dn: dn, tip: tip, a: 0 };
      });
      // Açıklık i: direk i → i+1 (bas / bit numaralarıyla eşlenir; yoksa sırayla)
      var Ac = H.acikliklar || [];
      function eslesir(x, p, q) { return x && (bos(x.bas) || bos(x.bit) || (String(x.bas) === p && String(x.bit) === q) || (String(x.bas) === q && String(x.bit) === p)); }
      for (var i = 0; i < n - 1; i++) {
        var p = satirlar[i].dn, q = satirlar[i + 1].dn, j = -1;
        if (eslesir(Ac[i], p, q)) j = i;
        else for (var t = 0; t < Ac.length && j < 0; t++) if (Ac[t] && !bos(Ac[t].bas) && ((String(Ac[t].bas) === p && String(Ac[t].bit) === q) || (String(Ac[t].bas) === q && String(Ac[t].bit) === p))) j = t;
        var u = j >= 0 ? sayi(Ac[j].uzunluk) : NaN;
        if (u > 0) {
          satirlar[i].a = u;
          dolan('Açıklık ' + p + '–' + q, u, 'm', 'hat.acikliklar[' + j + '].uzunluk', Ac[j].uzunluk);
        } else {
          if (j >= 0) kullan('hat.acikliklar[' + j + '].uzunluk');
          if (eski[p] && sayi(eski[p].a) > 0) satirlar[i].a = sayi(eski[p].a);
          eksikAc.push(p + '–' + q);
        }
      }
      M.direk = satirlar;
      if (uclar.length) r.uyari.push('Hattın ilk (' + uclar[0] + ') ve son (' + uclar[uclar.length - 1] + ') direği uç direk olduğundan durdurucu (D) alındı; gerilme bölümleri bu direklerde başlar ve biter.');
      if (bilinmeyen.length) {
        r.eksik.push({ alan: 'Direk görevleri', sec: TABLO, neden: 'Şu direklerin görevi projede yok, taşıyıcı (T) yazıldı: ' + bilinmeyen.join(', ') + '. Durdurucu ise tabloda D seçin.' });
        r.uyari.push('Görevi bilinmeyen ara direkler taşıyıcı (T) varsayıldı: ' + bilinmeyen.join(', ') + '. Gerilme bölümleri bu varsayıma göre oluştu.');
      }
      if (eksikAc.length) {
        r.eksik.push({ alan: 'Açıklık uzunlukları', sec: TABLO, neden: 'Projede uzunluğu olmayan açıklıklar: ' + eksikAc.join(', ') + '. Tabloya girin; girilmezse hesaba katılmaz.' });
      }
      return r;
    },

    hesapla: function () { refresh(true); },

    sonuc: function (A) {
      if (typeof bolumler !== 'function') return { hata: 'Hesap yüklenemedi.' };
      var B = bolumler();
      if (!B.length) return { hata: 'Direk ve açıklık girilmedi: sehim tablosu boş.' };
      var H = halList(), nh = H.length;
      var Tn = B.map(function (bl) { return H.map(function (h) { return cozHal(h, bl.ar); }); });
      var fT = fDegerleri(A, B, nh), saha = sahaDegerleri(A, B);
      var ts = fn(el('sT').value), sigmaMax = fn(el('cSig').value), t1 = T1();
      var iletken = KATALOG ? COND[+el('selC').value].ad : 'Elle girilen iletken';
      var L = A.sayi(A.metin('#kL'), ','), aMax = A.sayi(A.metin('#kA'), ','), fMax = A.sayi(A.metin('#kF'), ',');
      var TnMin = A.sayi(A.metin('#kTmin'), ',');
      var sg = A.metin('#kSig').split('–');
      var sgMin = sg.length > 1 ? A.sayi(sg[0], ',') : NaN, sgMax = sg.length > 1 ? A.sayi(sg[1], ',') : NaN;
      var TnMax = -Infinity, nan = [], asan = [];
      Tn.forEach(function (sat, bi) {
        sat.forEach(function (x, j) { if (!isFinite(x)) { if (nan.indexOf(bi + 1) < 0) nan.push(bi + 1); } else if (x > TnMax) TnMax = x; });
        var enb = Math.max.apply(null, sat.filter(isFinite));
        if (isFinite(enb) && enb > t1 * (1 + 1e-6)) asan.push(bi + 1);
      });
      var uy = [];
      if (nan.length) uy.push('Tₙ çözülemedi (bölüm ' + nan.join(', ') + '): iletken değerlerini ve başlangıç hâlini kontrol edin; bu sütunlarda sehim yok.');
      if (isFinite(sgMax) && sgMax > sigmaMax) {
        uy.push('σmax aşılıyor: hesaplanan en büyük gerilme ' + A.tr(sgMax, 2) + ' kg/mm² > σmax ' + A.tr(sigmaMax, 2) + ' kg/mm² (bölüm ' + (asan.length ? asan.join(', ') : '?') + '). Seçilen başlangıç hâli bu bölümlerde belirleyici değil; en düşük sıcaklık hâlini kontrol edin.');
      }
      var dus = [];
      for (var i = 0; i < M.direk.length - 1; i++) if (!(fn(M.direk[i].a) > 0)) dus.push(M.direk[i].dn + '–' + M.direk[i + 1].dn);
      if (dus.length) uy.push('Uzunluğu girilmemiş açıklık hesaba katılmadı: ' + dus.join(', ') + ' (bölüm eşdeğer açıklığı bu açıklık olmadan hesaplandı).');

      var degerler = [
        { ad: 'Hat uzunluğu', deger: v(L), birim: 'm' },
        { ad: 'Gerilme bölümü sayısı', deger: B.length, birim: '' },
        { ad: 'En büyük açıklık', deger: v(aMax), birim: 'm' },
        { ad: 'En büyük sehim', deger: v(fMax), birim: 'm' },
        { ad: 'En düşük çekme kuvveti Tₙ', deger: v(TnMin), birim: 'kg' },
        { ad: 'En büyük çekme kuvveti Tₙ', deger: isFinite(TnMax) ? r2(TnMax) : null, birim: 'kg' },
        { ad: 'En küçük gerilme σ', deger: v(sgMin), birim: 'kg/mm²' },
        { ad: 'En büyük gerilme σ', deger: v(sgMax), birim: 'kg/mm²' }
      ];
      B.forEach(function (bl, bi) { degerler.push({ ad: 'Bölüm ' + (bi + 1) + ' eşdeğer açıklık Ar', deger: r2(bl.ar), birim: 'm' }); });

      var basliklar = ['Açıklık', 'Tip', 'a (m)', 'Bölüm', 'Ar (m)'];
      H.forEach(function (h) { var t = (h.buz ? 'buzlu ' : '') + A.tr(h.t, 0) + ' °C'; basliklar.push('Tₙ ' + t + ' (kg)', 'f ' + t + ' (m)'); });
      basliklar.push('Tₙ saha ' + A.tr(ts, 1) + ' °C (kg)', 'f saha (m)', 'Çıta ölçüsü (m)');
      var satirlar = [];
      B.forEach(function (bl, bi) {
        var tSaha = cozT(ts, bl.ar);
        bl.idx.forEach(function (i) {
          var d = M.direk[i], son = M.direk[i + 1];
          var s = [d.dn + '–' + (son ? son.dn : ''), d.tip, r2(fn(d.a)), bi + 1, r2(bl.ar)];
          H.forEach(function (h, j) { s.push(r2(Tn[bi][j]), v((fT[i] || [])[j])); });
          s.push(r2(tSaha), v((saha[i] || {}).f), v((saha[i] || {}).cita));
          satirlar.push(s);
        });
      });

      var girdiler = [
        { ad: 'İletken', deger: iletken, birim: '' },
        { ad: 'Kesit S', deger: fn(el('cS').value), birim: 'mm²' },
        { ad: 'Çap d', deger: fn(el('cD').value), birim: 'mm' },
        { ad: 'Birim ağırlık p₀', deger: fn(el('cP0').value), birim: 'kg/m' },
        { ad: 'Elastisite modülü E', deger: fn(el('cE').value), birim: 'kg/mm²' },
        { ad: 'Isıl uzama katsayısı β', deger: fn(el('cB').value), birim: '1/°C' },
        { ad: 'σmax', deger: sigmaMax, birim: 'kg/mm²' },
        { ad: 'Tmax = T₁', deger: r2(t1), birim: 'kg' },
        { ad: 'Başlangıç hâli', deger: A.secili('#cHal'), birim: '' },
        { ad: 'Başlangıç sıcaklığı t₁', deger: fn(el('cT1t').value), birim: '°C' },
        { ad: 'Başlangıç yükü p₁', deger: fn(el('cP1').value), birim: 'kg/m' },
        { ad: 'Hesap hâli yükü pₙ', deger: fn(el('cPn').value), birim: 'kg/m' },
        { ad: 'Buz bölgesi', deger: el('pBY').value, birim: '' },
        { ad: 'Buz katsayısı k', deger: fn(el('cK').value), birim: '' },
        { ad: 'Rüzgâr basıncı q', deger: fn(el('cQ').value), birim: 'kg/m²' },
        { ad: 'Sıcaklıklar', deger: el('cTs').value, birim: '°C' },
        { ad: 'Saha ölçüm sıcaklığı', deger: ts, birim: '°C' },
        { ad: 'Ölçüm referansı farkı', deger: fn(el('sMes').value), birim: 'm' },
        { ad: 'Direk sayısı', deger: M.direk.length, birim: '' }
      ];
      return {
        ozet: iletken + ' · BY ' + el('pBY').value + ' · ' + B.length + ' gerilme bölümü · L = ' + A.tr(L, 2) + ' m · fmax = ' + A.tr(fMax, 2) + ' m · Tₙ,min = ' + A.tr(TnMin, 2) + ' kg',
        durum: 'bilgi',
        girdiler: girdiler,
        degerler: degerler,
        tablo: { basliklar: basliklar, satirlar: satirlar },
        uyarilar: uy
      };
    },

    durumAl: function () {
      return {
        surum: 1,
        arac: JSON.parse(JSON.stringify(collect())),
        ek: { sT: el('sT').value, sMes: el('sMes').value, qAr: el('qAr').value, qTn: el('qTn').value }
      };
    },

    durumYukle: function (d) {
      if (!d || !d.arac || !d.arac.M) return;
      var sakla = JSON.parse(JSON.stringify(d.arac.M));          // apply() verilen nesneyi canlı model yapar ve değiştirir
      apply(JSON.parse(JSON.stringify(d.arac)));
      // Katalog modunda apply() k, q, başlangıç hâli ve elle girilen t1 / p1'i varsayılana döndürür: kayıttan yeniden yaz
      if (sakla.hal) el('cHal').value = sakla.hal;
      if (sakla.k != null) el('cK').value = sakla.k;
      if (sakla.q != null) el('cQ').value = sakla.q;
      if (sakla.hal === 'man') { el('cT1t').value = sakla.t1; el('cP1').value = sakla.p1; }
      halUygula();
      // kunyeDuzelt boş / eski adları aracın yazarının adıyla değiştirir: kayıttaki adları yeniden yaz
      adlariYaz(sakla.adi, sakla.soy, sakla.unv);
      var ek = d.ek || {};
      ['sT', 'sMes', 'qAr', 'qTn'].forEach(function (k) { if (ek[k] != null && ek[k] !== '') el(k).value = ek[k]; });
      refresh(true);
    },

    alanAdlari: function (yol) {
      var m;
      if (yol === 'proje.ad') return 'Proje adı';
      if (yol === 'hat.no') return 'Hat no';
      if (/gerilimKV$/.test(yol)) return 'Gerilim U';
      if (yol === 'proje.buzBolgesi') return 'Buz bölgesi';
      if (yol === 'proje.yapan') return 'Projeyi yapan';
      if (yol === 'proje.unvan') return 'Unvan';
      if (/iletkenler\[\d+\]\.ad$/.test(yol)) return 'İletken';
      if ((m = /^hat\.direkler\[(\d+)\]\.(\w+)$/.exec(yol))) {
        var no = baglamDireki(+m[1]) || (+m[1] + 1) + '. sıradaki';
        return 'Direk ' + no + ' ' + ({ rol: 'görevi', malzeme: 'malzemesi', aci: 'sapma açısı', no: 'numarası' }[m[2]] || m[2]);
      }
      if ((m = /^hat\.acikliklar\[(\d+)\]\.uzunluk$/.exec(yol))) {
        var p = baglamDireki(+m[1]), q = baglamDireki(+m[1] + 1);
        return p && q ? 'Açıklık ' + p + '–' + q : (+m[1] + 1) + '. açıklık';
      }
      return null;
    }
  };
})();
