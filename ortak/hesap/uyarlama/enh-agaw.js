/* Şebeke-M uyarlaması: ENH a_g–a_w bağıntısı kontrolü (enh-agaw). Hesap kodlarına ve tablolarına dokunmaz;
   aracın kendi modelini (M) kurar, kendi işlevleriyle (apply, render, ozet, hesapla) hesaplatır ve sonucu okur.
   Aracın genel adları ($, M, save, apply, render, ozet, hesapla, direkler, iletkenler …) burada yeniden tanımlanmaz. */
(function () {
  'use strict';
  var ROL_AD = { T: 'taşıyıcı', D: 'durdurucu', N: 'nihayet', K: 'köşe' };
  var TEL_AD = { SWALLOW: '3 AWG Swallow', RAVEN: '1/0 AWG Raven', PIGEON: '3/0 AWG Pigeon', HAWK: '477 MCM Hawk', PARTRIDGE: '266,8 MCM Partridge' };
  // Uyarlamanın kendi bilgisi (durumla birlikte saklanır; geri yüklemede doldur çağrılmaz)
  var ek = { surum: 1, rolBelirsiz: [] };

  function kopya(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function sayiMi(v) { return typeof v === 'number' && isFinite(v); }
  function yuvarla(v, n) { if (!sayiMi(v)) return null; var k = Math.pow(10, n == null ? 6 : n); return Math.round(v * k) / k; }
  function alanEl(id) { return document.getElementById(id); }
  function varMi(liste, v) { return liste.map(String).indexOf(String(v)) >= 0; }
  function metin(v) { return v == null ? '' : String(v).trim(); }
  function satirSec(i, alan) { return '#tb tr:nth-child(' + (i + 1) + ') ' + (alan === 'dk' ? 'select' : 'input') + '[data-k="' + alan + '"]'; }

  /** İletken (+ direk malzemesi, devre sayısı) → aracın "İletken / direk ailesi" seçeneği. */
  function aileBul(tel, malzeme, cift) {
    if (!tel) return { il: null, neden: 'Hattın iletkeni projede yok' };
    if (cift && !(tel === 'PIGEON' && malzeme === 'beton')) return { il: null, neden: 'Çift devre hat: tabloda yalnız beton direkli 2x3/0 AWG ailesi var; aileyi elle seçin' };
    if (tel === 'SWALLOW') return { il: '3 AWG SWALLOW', uyari: malzeme === 'agac' ? '3 AWG Swallow tablosunda ağaç direk tipi yok.' : null };
    if (tel === 'HAWK') return { il: '477 MCM HAWK', uyari: (malzeme === 'beton' || malzeme === 'agac') ? '477 MCM Hawk tablosunda yalnız demir direk tipleri (TB, DA UZUN, DA KISA) var.' : null };
    if (tel === 'RAVEN' || tel === 'PIGEON') {
      if (malzeme === 'demir') return { il: tel === 'RAVEN' ? '1/0 AWG RAVEN' : '3/0 AWG PİGEON', malzemeli: true };
      if (malzeme === 'beton') return { il: tel === 'RAVEN' ? '1/0 AWG (beton direk)' : (cift ? '2x3/0 AWG (beton direk)' : '3/0 AWG (beton direk)'), malzemeli: true };
      return { il: null, neden: malzeme === 'agac' ? 'Ağaç direk için tablo yok' : malzeme === 'karisik' ? 'Hatta beton ve demir direk birlikte var; aileyi elle seçin' : 'Direk malzemesi (beton / demir) projede yok; aileyi elle seçin' };
    }
    return { il: null, neden: 'Projedeki iletken (' + (TEL_AD[tel] || tel) + ') tabloda yok' };
  }

  /** İletken listesinden ilk çıplak ACSR (OG) iletkeni. */
  function acsrBul(A, liste, kok) {
    for (var i = 0; i < (liste || []).length; i++) {
      var x = liste[i];
      if (!x || !x.ad) continue;
      var c = A.iletken(x.ad);
      if (c.aile === 'ACSR') {
        var cift = (sayiMi(x.adet) && x.adet >= 2) || /^\s*[2-9]\s*\(/.test(String(x.ad));
        return { x: x, c: c, yol: kok + '[' + i + ']', cift: cift };
      }
    }
    var ilk = (liste || []).filter(function (x) { return x && x.ad; })[0];
    return ilk ? { yok: true, ad: ilk.ad, aile: A.iletken(ilk.ad).aile } : null;
  }

  /** Eşdeğer açıklığı aracın a_ort listesine oturtur: tam eşleşme ya da en yakın (eşitlikte küçük olan). */
  function aortSec(liste, ruling) {
    var sayilar = liste.map(Number).filter(sayiMi);
    if (!sayilar.length) return null;
    var en = sayilar[0];
    sayilar.forEach(function (a) { if (Math.abs(a - ruling) < Math.abs(en - ruling) - 1e-9 || (Math.abs(Math.abs(a - ruling) - Math.abs(en - ruling)) <= 1e-9 && a < en)) en = a; });
    return { deger: en, tam: Math.abs(en - ruling) < 1e-9, liste: sayilar };
  }

  /** Hat açıklığını iki direk numarasıyla bulur (bas / bit); yoksa sıralı liste varsayımı. */
  function aciklikBul(aList, noA, noB, i, dSay) {
    var basBitVar = false;
    for (var j = 0; j < aList.length; j++) {
      var a = aList[j];
      if (!a) continue;
      if (a.bas != null || a.bit != null) basBitVar = true;
      if ((String(a.bas) === String(noA) && String(a.bit) === String(noB)) || (String(a.bas) === String(noB) && String(a.bit) === String(noA))) return j;
    }
    if (!basBitVar && aList.length === dSay - 1 && i >= 0 && i < aList.length) return i;
    return -1;
  }

  // Köprü, eksik alanın dinleyicisini işaretleme anındaki öğeye bağlar; araç direk tablosunu iletken / izolatör
  // değişince yeniden kurduğundan tablodaki eksikler (direk tipi, a_g, a_w, α) burada sütun bazında izlenir:
  // herhangi bir satırda o sütun elle değişince "girildi" sayılır; tablo yeniden kurulunca turuncu çerçeve geri konur.
  var tabloIzleniyor = false;
  function tabloEksikleri() {
    var s = window.__SM && window.__SM.durum;
    return s && s.eksik ? s.eksik.filter(function (x) { return !x.girildi && x.sec && x.sec.indexOf('#tb') === 0; }) : [];
  }
  function tabloEksikIzle() {
    if (tabloIzleniyor) return;
    tabloIzleniyor = true;
    var f = function (e) {
      var t = e.target;
      if (!t || !t.closest || !t.closest('#tb') || !t.getAttribute) return;
      var k = t.getAttribute('data-k');
      if (!k) return;
      tabloEksikleri().forEach(function (x) {
        if (x.sec.indexOf('[data-k="' + k + '"]') < 0) return;
        x.girildi = true;
        Array.prototype.forEach.call(document.querySelectorAll('#tb .sm-eksik[data-k="' + k + '"]'), function (y) { y.classList.remove('sm-eksik'); });
      });
    };
    document.addEventListener('input', f, true);
    document.addEventListener('change', f, true);
    var tb = alanEl('tb');
    if (tb && window.MutationObserver) {
      new MutationObserver(function () {
        tabloEksikleri().forEach(function (x) {
          var y = document.querySelector(x.sec);
          if (y && !y.classList.contains('sm-eksik')) { y.classList.add('sm-eksik'); y.setAttribute('title', x.alan + ': projede yok, elle girin'); }
        });
      }).observe(tb, { childList: true });
    }
  }

  function sonucYazisi(s, h) {
    if (!h.aw && !h.ag) return null;
    if (!h.r) return 'tablo yok';
    if (!(h.aw > 0)) return 'a_w yok';
    if (!(h.ag > 0)) return 'a_g girilmedi';
    if (!h.ok) return 'UYGUN DEĞİL';
    if (h.dagYok && h.sapmaDer > 0) return 'UYGUN? (Δa_g yok)';
    return 'UYGUN';
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Kontrol taşıyıcı direkler içindir: proje a_g ≥ k·a_w + c + Δa_g olmalıdır. k ve c TEDAŞ 2014/1, Δa_g (m/derece × sapma açısı) TEDAŞ 2014/3 tablolarındandır.',
      'Ağırlık açıklığı a_g projede yoktur; her direk için direk tevzi listesinden (en büyük sehim hâli) girilmelidir. Rüzgâr açıklığı a_w, direğin iki yanındaki yatay açıklıkların ortalamasıdır.',
      'İzolatör cinsi katsayıları belirgin değiştirir (ör. 3/0 Pigeon, 2. bölge: silikon 0,425·a_w − 2,77; porselen 3K1 0,5234·a_w − 11,11). Projede izolatör bilgisi olmadığından mutlaka seçilmelidir.',
      'Tablodaki direk tipi kodları (BER, PT, ST1-ST2, RT1-RT2-RÇT1, 12-18/4-7 …) Şebeke-M direk tiplerinden çıkarılamaz; her satırda seçilmelidir. Swallow için beton direklerde "BETON H<15 m" tipi vardır.',
      'İletken / direk ailesi iletkene ve direk malzemesine göre seçilir: demir direklerde "3/0 AWG PİGEON" ve "1/0 AWG RAVEN", beton direklerde "(beton direk)" aileleri. Bu eşleme yazarla doğrulanmalıdır.',
      '1/0 AWG Raven (demir) direklerinin tümünde ve 3 AWG Swallow ST1-ST2 direklerinde Δa_g tablosu yoktur; araç bu durumda Δa_g\'yi sıfır alır. Hat açısı olan bu direklerde "uygun" sonucu kesin değildir.',
      'a_ort listesi tablodaki değerlerle sınırlıdır (ör. Pigeon 2.–5. bölgede yalnız 220 m). Hattın eşdeğer açıklığı listede yoksa en yakın değer seçilir. Bir satırın direk tipi için seçili a_ort tabloda yoksa araç o satırı değerlendirmez ("—").',
      'a_w ve a_g boş bırakılan satırları araç "UYGUN" sayar ve en küçük payı bu satırlarla hesaplar; Şebeke-M sonucunda boş satırlar değerlendirmeye alınmaz.',
      'İletken ya da izolatör değiştirildiğinde araç satırlardaki direk tipini kendisi güncellemez; satırlardaki direk tipini yeniden seçin.'
    ],

    hazir: function () { return typeof apply === 'function' && typeof collect === 'function' && !!alanEl('selIl') && alanEl('selIl').options.length > 0; },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [], kullanilan: {} };
      if (!b) return r;
      tabloEksikIzle();
      var yollar = {};
      function dolan(alan, deger, birim, yol, ham, kaynak) {
        if (yol && yollar[yol]) return;
        if (yol) yollar[yol] = 1;
        r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: kaynak || '' });
      }
      // Görünmeyen ama hesaba giren bağlam değerleri (güncellik denetimi için); yalnız bağlamda var olan anahtarlar
      function izle(nesne, anahtar, yol) {
        if (nesne && typeof nesne === 'object' && Object.prototype.hasOwnProperty.call(nesne, anahtar) && !yollar[yol]) r.kullanilan[yol] = nesne[anahtar];
      }

      // Açı birimi: projeden gelen α doğrudan sapma açısıdır (araçta "Doğrudan sapma açısı")
      if (M.birim !== 'sap') setBirim('sap', true);
      var mevcut = kopya(collect().M);
      var eskiSatir = {};
      (mevcut.sat || []).forEach(function (s) { eskiSatir[String(s.dn)] = s; });
      var hedefTur = (b.hedef && b.hedef.tur) || (b.direk ? 'direk' : b.hat ? 'hat' : 'proje');
      var p = b.proje || {};
      var yeni = { ad: mevcut.ad || '', hat: mevcut.hat || '', kim: mevcut.kim, unv: mevcut.unv, birim: 'sap', sat: [] };
      ek = { surum: 1, rolBelirsiz: [] };

      // ---- proje bilgileri
      if (metin(p.ad)) { yeni.ad = metin(p.ad); dolan('Proje adı', yeni.ad, '', 'proje.ad', p.ad); }
      var hatNo = null;
      if (b.hat && metin(b.hat.no)) { hatNo = metin(b.hat.no); dolan('Hat no', hatNo, '', 'hat.no', b.hat.no); }
      if (metin(p.yapan)) { yeni.kim = metin(p.yapan); dolan('Hazırlayan', yeni.kim, '', 'proje.yapan', p.yapan); }
      else { yeni.kim = '—'; r.eksik.push({ alan: 'Hazırlayan', sec: '#pKim', neden: 'Projede hazırlayan adı yok' }); }
      if (metin(p.unvan)) { yeni.unv = metin(p.unvan); dolan('Unvan', yeni.unv, '', 'proje.unvan', p.unvan); }
      else { yeni.unv = '—'; r.eksik.push({ alan: 'Unvan', sec: '#pUnv', neden: 'Projede unvan yok' }); }

      // ---- satırlar (taşıyıcı direkler) ve kullanılan iletken / malzeme
      var satirlar = [];          // { dn, aci, aciYol, aw, awYol: [..], malzeme, malzemeYol, rolBelirsiz }
      var iletkenAday = null, rulingKaynak = null;
      var dList = (b.hat && b.hat.direkler) || [];
      var aList = (b.hat && b.hat.acikliklar) || [];
      if (hedefTur === 'direk' && b.direk) {
        var dr = b.direk, kollar = dr.kollar || [];
        var dn = dr.no != null ? String(dr.no) : '1';
        izle(dr, 'no', 'direk.no');
        if (dr.rol && dr.rol !== 'T') {
          r.uyari.push('Direk ' + dn + ' ' + (ROL_AD[dr.rol] || dr.rol) + ' direk: a_g–a_w kontrolü taşıyıcı direkler içindir; satır eklenmedi.');
          izle(dr, 'rol', 'direk.rol');
        } else {
          if (dr.rol === 'T') dolan('Direk görevi', ROL_AD.T, '', 'direk.rol', dr.rol);
          else { izle(dr, 'rol', 'direk.rol'); ek.rolBelirsiz.push(dn); r.uyari.push('Direk ' + dn + ': görevi projede belirsiz; taşıyıcı değilse bu kontrol gerekmez.'); }
          var og = [];
          kollar.forEach(function (k, i) {
            if (!k) return;
            var acsr = (k.iletkenler || []).some(function (x) { return x && A.iletken(x.ad).aile === 'ACSR'; });
            if (acsr || /^OG|MUSTEREK/.test(String(k.hatTur || ''))) og.push(i);
          });
          if (og.length > 2 && b.hat && b.hat.id != null) {
            var ayni = og.filter(function (i) { return String(kollar[i].hatId) === String(b.hat.id); });
            if (ayni.length === 2) og = ayni;
          }
          var s = { dn: dn, aci: null, aciYol: 'direk.aci', aw: null, awYol: [], malzeme: dr.malzeme, malzemeYol: 'direk.malzeme', kaynak: dr };
          if (sayiMi(dr.aci)) s.aci = dr.aci;
          if (og.length === 2 && sayiMi(kollar[og[0]].aciklik) && kollar[og[0]].aciklik > 0 && sayiMi(kollar[og[1]].aciklik) && kollar[og[1]].aciklik > 0) {
            s.aw = (kollar[og[0]].aciklik + kollar[og[1]].aciklik) / 2;
            og.forEach(function (i) {
              var k = kollar[i];
              dolan('Açıklık ' + dn + '–' + ((k.karsi && k.karsi.no) || '?') + ' (2B)', k.aciklik, 'm', 'direk.kollar[' + i + '].aciklik', k.aciklik);
            });
          } else if (og.length > 2) r.uyari.push('Direk ' + dn + ' ile birden çok hat parçası birleşiyor; a_w için iki yandaki açıklığı elle girin.');
          satirlar.push(s);
          for (var t = 0; t < og.length && !iletkenAday; t++) {
            var ad1 = acsrBul(A, kollar[og[t]].iletkenler, 'direk.kollar[' + og[t] + '].iletkenler');
            if (ad1 && !ad1.yok) iletkenAday = ad1;
          }
          if (!hatNo) for (var u = 0; u < og.length && !hatNo; u++) {
            if (metin(kollar[og[u]].hatNo)) { hatNo = metin(kollar[og[u]].hatNo); dolan('Hat no', hatNo, '', 'direk.kollar[' + og[u] + '].hatNo', kollar[og[u]].hatNo); }
          }
        }
      } else if (b.hat) {
        var n = dList.length;
        dList.forEach(function (d, i) {
          if (!d) return;
          var dn = d.no != null ? String(d.no) : String(i + 1);
          izle(d, 'no', 'hat.direkler[' + i + '].no');
          izle(d, 'rol', 'hat.direkler[' + i + '].rol');
          if (i === 0 || i === n - 1) {
            if (d.rol === 'T') r.uyari.push('Direk ' + dn + ' hattın ucunda ama taşıyıcı görünüyor; uç direk değerlendirilmedi.');
            return;
          }
          if (d.rol && d.rol !== 'T') return;
          var s = { dn: dn, aci: null, aciYol: 'hat.direkler[' + i + '].aci', aw: null, awYol: [], malzeme: d.malzeme, malzemeYol: 'hat.direkler[' + i + '].malzeme', kaynak: d };
          if (!d.rol) { ek.rolBelirsiz.push(dn); s.rolBelirsiz = true; }
          if (sayiMi(d.aci)) s.aci = d.aci;
          var j1 = aciklikBul(aList, dList[i - 1] && dList[i - 1].no, d.no, i - 1, n);
          var j2 = aciklikBul(aList, d.no, dList[i + 1] && dList[i + 1].no, i, n);
          var a1 = j1 >= 0 ? aList[j1].uzunluk : null, a2 = j2 >= 0 ? aList[j2].uzunluk : null;
          if (sayiMi(a1) && a1 > 0 && sayiMi(a2) && a2 > 0) { s.aw = (a1 + a2) / 2; s.awYol = [j1, j2]; }
          satirlar.push(s);
        });
        if (ek.rolBelirsiz.length) r.uyari.push('Görevi projede belirsiz direkler listeye alındı (Direk ' + ek.rolBelirsiz.join(', ') + '); taşıyıcı değilse satırı silin.');
        iletkenAday = acsrBul(A, b.hat.iletkenler, 'hat.iletkenler');
      }
      if (!iletkenAday && b.hat && hedefTur === 'direk') iletkenAday = acsrBul(A, b.hat.iletkenler, 'hat.iletkenler');
      if (!satirlar.length && hedefTur !== 'direk') r.uyari.push('Hatta değerlendirilecek taşıyıcı direk bulunamadı (uç direkler ve durdurucu / köşe direkler bu kontrole girmez).');

      // ---- iletken / direk ailesi
      var malzemeler = {}, malzemeBilinmiyor = false;
      satirlar.forEach(function (s) { if (s.malzeme) malzemeler[s.malzeme] = 1; else malzemeBilinmiyor = true; });
      var mk = Object.keys(malzemeler);
      var malzeme = (mk.length === 1 && !malzemeBilinmiyor) ? mk[0] : (mk.length > 1 ? 'karisik' : null);
      if (!satirlar.length && hedefTur === 'direk' && b.direk) malzeme = b.direk.malzeme || null;
      var il = null, ilNeden = null;
      if (iletkenAday && !iletkenAday.yok) {
        var aile = aileBul(iletkenAday.c.tel, malzeme, iletkenAday.cift);
        if (aile.il && varMi(iletkenler(), aile.il)) {
          il = aile.il;
          dolan('İletken', iletkenAday.x.ad, '', iletkenAday.yol + '.ad', iletkenAday.x.ad, il);
          if (iletkenAday.cift && sayiMi(iletkenAday.x.adet)) dolan('Devre sayısı', iletkenAday.x.adet, '', iletkenAday.yol + '.adet', iletkenAday.x.adet);
          if (aile.malzemeli && satirlar.length) {
            dolan('Direk malzemesi', malzeme, '', satirlar[0].malzemeYol, satirlar[0].malzeme, il);
            satirlar.slice(1).forEach(function (s) { izle(s.kaynak, 'malzeme', s.malzemeYol); });
          }
          if (aile.uyari) r.uyari.push(aile.uyari);
        } else {
          ilNeden = aile.neden || 'Tabloda bu iletken için aile yok';
          izle(iletkenAday.x, 'ad', iletkenAday.yol + '.ad');
        }
      } else if (iletkenAday && iletkenAday.yok) {
        ilNeden = 'Hattın iletkeni çıplak ACSR değil (' + iletkenAday.ad + '); bu kontrol ENH çıplak iletkenler içindir';
      } else ilNeden = 'Hattın iletkeni projede yok';
      if (!il) {
        il = varMi(iletkenler(), mevcut.il) ? mevcut.il : iletkenler()[0];
        r.eksik.push({ alan: 'İletken / direk ailesi', sec: '#selIl', neden: ilNeden });
      }

      // ---- izolatör ve varsayılan direk tipi: projede yok (kullanıcının seçtiği korunur)
      var izl = izolatorler(il);
      var iz = varMi(izl, mevcut.iz) ? mevcut.iz : izl[0];
      r.eksik.push({ alan: 'İzolatör cinsi', sec: '#selIz', neden: 'Projede izolatör bilgisi yok; katsayılar izolatöre göre değişir' });
      var dkl = direkler(il, iz);
      var dkVars = varMi(dkl, mevcut.dk) ? mevcut.dk : dkl[0];

      // ---- buz bölgesi
      var bl = bolgeler(il, iz, dkVars).map(String);
      var bz = p.buzBolgesi != null ? String(p.buzBolgesi).trim() : '';
      var bolge;
      if (bz && varMi(bl, bz)) { bolge = bz; dolan('Buz bölgesi', bz + '. bölge', '', 'proje.buzBolgesi', p.buzBolgesi); }
      else {
        bolge = varMi(bl, mevcut.b) ? String(mevcut.b) : bl[0];
        if (bz) { izle(p, 'buzBolgesi', 'proje.buzBolgesi'); r.uyari.push('Projedeki ' + bz + '. buz bölgesi bu iletken / direk ailesinin tablosunda yok (var olanlar: ' + bl.join(', ') + ').'); }
        r.eksik.push({ alan: 'Buz bölgesi', sec: '#selB', neden: bz ? 'Projedeki bölge tabloda yok' : 'Projede buz bölgesi yok' });
      }

      // ---- a_ort: hattın eşdeğer açıklığı listedeki değere oturtulur
      var ruling = null;
      var tumAciklik = aList.length > 0 && aList.every(function (a) { return a && sayiMi(a.uzunluk) && a.uzunluk > 0; });
      if (b.hat && sayiMi(b.hat.ruling) && b.hat.ruling > 0) { ruling = b.hat.ruling; rulingKaynak = 'hat'; }
      else if (b.hat && tumAciklik) { ruling = A.ruling(aList); rulingKaynak = 'aciklik'; }
      else if (b.hat && aList.length) r.uyari.push('Hattın bazı açıklık uzunlukları projede yok; eşdeğer açıklık hesaplanamadı.');
      var al = aortlar(il, iz, dkVars, bolge);
      var aort = varMi(al, mevcut.a) ? String(mevcut.a) : (al.length ? String(al[0]) : String(mevcut.a));
      if (sayiMi(ruling) && ruling > 0 && al.length) {
        var sec = aortSec(al, ruling);
        aort = String(sec.deger);
        if (rulingKaynak === 'hat') dolan('Eşdeğer açıklık', b.hat.ruling, 'm', 'hat.ruling', b.hat.ruling, 'a_ort ' + sec.deger + ' m');
        else {
          aList.forEach(function (a, j) { if (a && sayiMi(a.uzunluk)) dolan('Açıklık ' + (a.bas != null ? a.bas : j + 1) + '–' + (a.bit != null ? a.bit : j + 2) + ' (2B)', a.uzunluk, 'm', 'hat.acikliklar[' + j + '].uzunluk', a.uzunluk); });
          r.uyari.push('Hattın eşdeğer açıklığı projede yoktu; açıklıklardan √(Σa³/Σa) = ' + A.tr(ruling, 2) + ' m hesaplandı.');
        }
        if (!sec.tam) r.uyari.push('Eşdeğer açıklık ' + A.tr(ruling, 2) + ' m tabloda yok; en yakın a_ort ' + sec.deger + ' m seçildi (tablodaki değerler: ' + sec.liste.join(', ') + ' m).');
      } else {
        r.eksik.push({ alan: 'a_ort (eşdeğer açıklık)', sec: '#selA', neden: 'Hattın eşdeğer açıklığı projede yok' });
      }

      // ---- satırları kur (elle girilmiş direk tipi, askı ve a_g korunur)
      var aciEksik = [], awEksik = [], yeniSatirVar = false, agEksik = false;
      satirlar.forEach(function (s, k) {
        var eski = eskiSatir[s.dn];
        var row = { dn: s.dn, dk: dkVars, ak: 'TEK', aci: 0, aw: 0, ag: 0 };
        if (eski) {
          if (varMi(dkl, eski.dk)) row.dk = eski.dk;
          if (eski.ak === 'TEK' || eski.ak === 'ÇİFT') row.ak = eski.ak;
          row.ag = sayiMi(+eski.ag) ? +eski.ag : 0;
          row.aci = sayiMi(+eski.aci) ? +eski.aci : 0;
          row.aw = sayiMi(+eski.aw) ? +eski.aw : 0;
        } else yeniSatirVar = true;
        if (s.aci != null) { row.aci = s.aci; dolan('Direk ' + s.dn + ' hat açısı α', s.aci, '°', s.aciYol, s.aci); }
        else if (!eski) aciEksik.push(k);
        if (s.aw != null) {
          row.aw = yuvarla(s.aw, 6);
          s.awYol.forEach(function (j) { var a = aList[j]; dolan('Açıklık ' + (a.bas != null ? a.bas : j + 1) + '–' + (a.bit != null ? a.bit : j + 2) + ' (2B)', a.uzunluk, 'm', 'hat.acikliklar[' + j + '].uzunluk', a.uzunluk); });
        } else if (!eski || !(row.aw > 0)) awEksik.push(k);
        if (!(row.ag > 0)) agEksik = true;
        yeni.sat.push(row);
      });
      if (aciEksik.length) r.eksik.push({ alan: 'Hat açısı α (Direk ' + aciEksik.map(function (k) { return satirlar[k].dn; }).join(', ') + ')', sec: satirSec(aciEksik[0], 'aci'), neden: 'Projede direk açısı yok' });
      if (awEksik.length) r.eksik.push({ alan: 'Rüzgâr açıklığı a_w (Direk ' + awEksik.map(function (k) { return satirlar[k].dn; }).join(', ') + ')', sec: satirSec(awEksik[0], 'aw'), neden: 'Direğin iki yanındaki açıklık projede yok' });
      if (yeni.sat.length && yeniSatirVar) r.eksik.push({ alan: 'Direk tipi kodu (her satırda)', sec: '#tb select[data-k="dk"]', neden: 'Şebeke-M direk tipleri tablo kodlarıyla (BER, PT, ST1-ST2, 12-18/4-7 …) eşlenemiyor' });
      if (yeni.sat.length && agEksik) r.eksik.push({ alan: 'Ağırlık açıklığı a_g (her direk)', sec: '#tb input[data-k="ag"]', neden: 'Projede yok: direk tevzi listesinden (en büyük sehim hâli) girin' });

      yeni.il = il; yeni.iz = iz; yeni.dk = dkVars; yeni.b = bolge; yeni.a = aort;
      yeni.hat = hatNo || yeni.hat;
      apply({ M: yeni });   // aracın kendi yükleme işlevi: seçim kutuları, satırlar ve özet yeniden kurulur
      return r;
    },

    hesapla: function () { render(true); ozet(); },

    sonuc: function (A) {
      var m = M;
      if (!m || !m.sat || !m.sat.length) return { hata: 'Direk listesi boş: önce taşıyıcı direkleri ekleyin.' };
      var say = { ok: 0, no: 0, eksik: 0, belirsiz: 0 }, minPay = null, minDn = null, bos = [], uy = [], tab = [];
      var dagYokDn = [], tabloYokDn = [], eksikDn = [];
      m.sat.forEach(function (s) {
        var h = hesapla(s);                       // aracın kendi hesabı
        var yazi = sonucYazisi(s, h);
        if (yazi === null) {
          bos.push(s.dn);
          tab.push([s.dn, s.dk, s.ak === 'ÇİFT' ? 'çift' : 'tek', yuvarla(h.sapmaDer, 4), 0, 0, h.r ? h.r.k : null, h.r ? h.r.c : null, null, null, null, 'boş (değerlendirilmedi)']);
          return;
        }
        var tam = !!h.r && h.aw > 0 && h.ag > 0;
        if (yazi === 'tablo yok') { say.belirsiz++; tabloYokDn.push(s.dn); }
        else if (yazi === 'a_w yok' || yazi === 'a_g girilmedi') { say.eksik++; eksikDn.push(s.dn); }
        else if (yazi === 'UYGUN DEĞİL') say.no++;
        else if (yazi === 'UYGUN') say.ok++;
        else { say.belirsiz++; dagYokDn.push(s.dn); }
        if (tam && (minPay === null || h.pay < minPay)) { minPay = h.pay; minDn = s.dn; }
        tab.push([s.dn, s.dk, s.ak === 'ÇİFT' ? 'çift' : 'tek', yuvarla(h.sapmaDer, 4), yuvarla(h.aw, 2), yuvarla(h.ag, 2),
          h.r ? h.r.k : null, h.r ? h.r.c : null, h.dag === null ? null : yuvarla(h.dag, 3), h.r ? yuvarla(h.agmin, 2) : null, tam ? yuvarla(h.pay, 2) : null, yazi]);
      });
      var deg = say.ok + say.no + say.belirsiz + say.eksik;
      if (dagYokDn.length) uy.push('Direk ' + dagYokDn.join(', ') + ': bu direk tipinde Δa_g tablosu yok; araç Δa_g = 0 aldı. Hat açısı olduğu için "uygun" sonucu kesin değil.');
      if (tabloYokDn.length) uy.push('Direk ' + tabloYokDn.join(', ') + ': seçili direk tipi / askı için ' + m.b + '. bölge, a_ort ' + m.a + ' m tablosu yok; satır değerlendirilmedi.');
      if (eksikDn.length) uy.push('Direk ' + eksikDn.join(', ') + ': a_g ya da a_w girilmedi; satır değerlendirilmedi.');
      if (bos.length) uy.push('Boş satırlar (a_w = a_g = 0) değerlendirilmedi: Direk ' + bos.join(', ') + '.');
      if (ek.rolBelirsiz && ek.rolBelirsiz.length) uy.push('Görevi projede belirsiz direkler: ' + ek.rolBelirsiz.join(', ') + ' (taşıyıcı değilse kontrol gerekmez).');
      var durum = say.no > 0 ? 'uygun-degil' : (say.ok > 0 && !say.eksik && !say.belirsiz ? 'uygun' : 'bilgi');
      var oz;
      if (!deg) oz = m.sat.length + ' taşıyıcı direk: a_w ve a_g girilmedi, kontrol yapılmadı';
      else {
        oz = deg + ' taşıyıcı direk: ' + say.ok + ' uygun, ' + say.no + ' uygun değil';
        if (say.eksik) oz += ', ' + say.eksik + ' eksik';
        if (say.belirsiz) oz += ', ' + say.belirsiz + ' belirsiz';
        if (minPay !== null) oz += ' · en küçük pay ' + A.tr(minPay, 2) + ' m (Direk ' + minDn + ')';
      }
      oz += ' · ' + m.il + ', ' + m.iz + ', ' + m.b + '. bölge, a_ort ' + m.a + ' m';
      return {
        ozet: oz,
        durum: durum,
        girdiler: [
          { ad: 'İletken / direk ailesi', deger: m.il, birim: '' },
          { ad: 'İzolatör', deger: m.iz, birim: '' },
          { ad: 'Buz bölgesi', deger: +m.b, birim: '' },
          { ad: 'a_ort', deger: +m.a, birim: 'm' },
          { ad: 'Direk sayısı', deger: m.sat.length, birim: 'adet' }
        ],
        degerler: [
          { ad: 'Değerlendirilen direk', deger: say.ok + say.no, birim: 'adet' },
          { ad: 'Uygun', deger: say.ok, birim: 'adet' },
          { ad: 'Uygun değil', deger: say.no, birim: 'adet' },
          { ad: 'Eksik ya da belirsiz', deger: say.eksik + say.belirsiz, birim: 'adet' },
          { ad: 'En küçük pay', deger: yuvarla(minPay, 6), birim: 'm' },
          { ad: 'En kritik direk', deger: minDn, birim: '' }
        ],
        tablo: { basliklar: ['Direk', 'Direk tipi', 'Askı', 'Sapma (°)', 'a_w (m)', 'a_g (m)', 'k', 'c', 'Δa_g (m)', 'a_g,min (m)', 'Pay (m)', 'Sonuç'], satirlar: tab },
        uyarilar: uy
      };
    },

    durumAl: function () { return { surum: 1, M: kopya(collect().M), ek: kopya(ek) }; },

    durumYukle: function (d) {
      if (!d || !d.M) return;
      var m = kopya(d.M);
      apply({ M: m });                         // aracın kendi geri yükleme işlevi
      // apply() boş hazırlayan / unvan alanına aracın varsayılanını koyar: kayıttaki değer aynen geri yazılır
      M.kim = m.kim == null ? '' : m.kim; alanEl('pKim').value = M.kim;
      M.unv = m.unv == null ? '' : m.unv; alanEl('pUnv').value = M.unv;
      render(true); ozet();
      ek = kopya(d.ek) || { surum: 1, rolBelirsiz: [] };
    },

    alanAdlari: function (yol) {
      var m;
      if (yol === 'proje.ad') return 'Proje adı';
      if (yol === 'proje.yapan') return 'Hazırlayan';
      if (yol === 'proje.unvan') return 'Unvan';
      if (yol === 'proje.buzBolgesi') return 'Buz bölgesi';
      if (yol === 'hat.no') return 'Hat no';
      if (yol === 'hat.ruling') return 'Eşdeğer açıklık';
      if ((m = /^hat\.acikliklar\[(\d+)\]\.uzunluk$/.exec(yol))) return 'Açıklık ' + (+m[1] + 1) + ' (2B)';
      if ((m = /^hat\.direkler\[(\d+)\]\.(\w+)$/.exec(yol))) return 'Hattın ' + (+m[1] + 1) + '. direği: ' + ({ aci: 'hat açısı', rol: 'görevi', malzeme: 'malzemesi', no: 'numarası' }[m[2]] || m[2]);
      if ((m = /^direk\.kollar\[(\d+)\]\.aciklik$/.exec(yol))) return 'Direkten çıkan ' + (+m[1] + 1) + '. açıklık (2B)';
      if (/iletkenler\[\d+\]\.ad$/.test(yol)) return 'İletken';
      if (/iletkenler\[\d+\]\.adet$/.test(yol)) return 'Devre sayısı';
      return { 'direk.aci': 'Direk hat açısı α', 'direk.rol': 'Direk görevi', 'direk.malzeme': 'Direk malzemesi', 'direk.no': 'Direk no' }[yol] || null;
    }
  };
})();
