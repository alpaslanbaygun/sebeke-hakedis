/* Şebeke-M hesap köprüsü — sayfa sonu. Paketleyici bunu her hesap sayfasının sonuna, modülün uyarlamasından
   (window.__SM_UYARLAMA) hemen sonra ekler. Görevleri:
   1. Şebeke-M Hakediş üst çubuğu: logo, hesabın adı, hedef (direk / hat / trafo / proje), projeden gelen bilgilerin özeti,
      Kaydet düğmesi ve bilgi paneli (projeden alınanlar, eksikler, uyarılar, kayıt bilgisi, hesabın kaynağı).
   2. Bağlam: uygulama (telefon) ya da eklenti (AutoCAD) hesabı açarken seçili direğin / hattın bilgilerini verir;
      uyarlama bunları hesabın kendi giriş alanlarına yazar. Projede olmayan bilgiler işaretlenir, kullanıcıdan istenir.
   3. Kayıt: sonuç (özet, girdiler, değerler, uyarılar) ve hesabın tam durumu projeye kaydedilir; yeniden açılınca
      aynen yüklenir. Proje sonradan değiştiyse "güncel değil" uyarısı ve değişen bilgiler gösterilir.
   Hesabın formülleri ve hesap kodları değiştirilmez; köprü yalnız giriş alanlarına değer yazar ve sonuçları okur. */
(function () {
  'use strict';
  var SM = window.__SM || (window.__SM = {});
  var U = window.__SM_UYARLAMA || {};
  var d = document;

  // ---------------------------------------------------------------- yardımcılar (uyarlamalara verilen A nesnesi)
  var TR = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c', '×': 'x', '²': '2', '³': '3' };
  function norm(s) {
    return String(s == null ? '' : s).replace(/[ıİşŞğĞüÜöÖçÇ×²³]/g, function (c) { return TR[c]; }).toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function el(s, kok) { return typeof s === 'string' ? (kok || d).querySelector(s) : s; }
  function olay(e, ad) { try { e.dispatchEvent(new Event(ad, { bubbles: true })); } catch (x) { /* */ } }
  function sayiYaz(v) {
    if (typeof v !== 'number' || !isFinite(v)) return v;
    return String(Math.round(v * 1e6) / 1e6);
  }
  /** Metindeki sayıyı okur: "1.749,82 kg" → 1749.82, "3.682%" → 3.682, "−5" → -5. ondalik: ',' ya da '.' zorlar. */
  function sayi(t, ondalik) {
    if (typeof t === 'number') return t;
    var s = String(t == null ? '' : t).replace(/−/g, '-').replace(/\s/g, '');
    var m = s.match(/-?[\d.,]+(e-?\d+)?/i);
    if (!m) return NaN;
    var x = m[0];
    var nokta = x.lastIndexOf('.'), virgul = x.lastIndexOf(',');
    if (ondalik === ',') x = x.replace(/\./g, '').replace(',', '.');
    else if (ondalik === '.') x = x.replace(/,/g, '');
    else if (nokta >= 0 && virgul >= 0) x = virgul > nokta ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, '');
    else if (virgul >= 0) x = (x.match(/,/g).length > 1) ? x.replace(/,/g, '') : x.replace(',', '.');
    else if ((x.match(/\./g) || []).length > 1) x = x.replace(/\./g, '');
    var n = parseFloat(x);
    return isFinite(n) ? n : NaN;
  }
  var A = {
    norm: norm,
    sayi: sayi,
    $: function (s, kok) { return el(s, kok); },
    $$: function (s, kok) { return Array.prototype.slice.call((kok || d).querySelectorAll(s)); },
    olay: olay,
    /** Giriş alanına değer yazar, input + change olaylarını tetikler. Seçim kutusunda değer ya da yazı ile eşler. */
    yaz: function (s, v, sessiz) {
      var e = el(s);
      if (!e || v === undefined || v === null || (typeof v === 'number' && !isFinite(v))) return false;
      if (e.tagName === 'SELECT') return A.sec(e, v, sessiz) != null;
      if (e.type === 'checkbox' || e.type === 'radio') e.checked = !!v;
      else e.value = typeof v === 'number' ? sayiYaz(v) : String(v);
      if (!sessiz) { olay(e, 'input'); olay(e, 'change'); }
      return true;
    },
    /** Seçim kutusunda seçenek seçer: önce değer, sonra yazı (büyük/küçük harf ve Türkçe harf farkı gözetmez); işlev de verilebilir. */
    sec: function (s, aranan, sessiz) {
      var e = el(s);
      if (!e || !e.options) return null;
      var o = null, i, op = e.options;
      if (typeof aranan === 'function') { for (i = 0; i < op.length && !o; i++) if (aranan(op[i], norm(op[i].text), norm(op[i].value))) o = op[i]; }
      else {
        var a = String(aranan), na = norm(a);
        for (i = 0; i < op.length && !o; i++) if (op[i].value === a) o = op[i];
        for (i = 0; i < op.length && !o; i++) if (norm(op[i].text) === na || norm(op[i].value) === na) o = op[i];
      }
      if (!o) return null;
      e.value = o.value;
      if (!sessiz) { olay(e, 'input'); olay(e, 'change'); }
      return o.text;
    },
    secenekler: function (s) { var e = el(s); return e && e.options ? Array.prototype.map.call(e.options, function (o) { return { deger: o.value, yazi: o.text }; }) : []; },
    deger: function (s) { var e = el(s); if (!e) return null; if (e.type === 'checkbox' || e.type === 'radio') return e.checked; return e.value; },
    metin: function (s) { var e = el(s); return e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : ''; },
    secili: function (s) { var e = el(s); return e && e.options && e.selectedIndex >= 0 ? e.options[e.selectedIndex].text : ''; },
    tikla: function (s) { var e = el(s); if (!e) return false; e.click(); return true; },
    gorunur: function (s) { var e = el(s); return !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)); },
    bekle: function (ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); },
    /** "62,30" biçiminde Türkçe sayı yazısı */
    tr: function (v, ond) {
      if (typeof v !== 'number' || !isFinite(v)) return v == null ? '—' : String(v);
      return v.toLocaleString('tr-TR', { minimumFractionDigits: ond == null ? 0 : ond, maximumFractionDigits: ond == null ? 3 : ond });
    }
  };
  SM.A = A;

  // ---------------------------------------------------------------- ortak kurallar (ortak/kurallar.js)
  // İletken adı çözümleyici ve eşdeğer açıklık telefonla aynı koddan gelir (ortak/hesap/kurallar.mjs).
  var K = window.SMKural || {};
  A.iletken = function (ad) { return K.iletkenCoz ? K.iletkenCoz(ad) : { ad: ad, aile: null, devre: null }; };
  A.ruling = function (acikliklar) { return K.ruling ? K.ruling(acikliklar) : null; };

  // ---------------------------------------------------------------- güncellik (ortak/hesap/kurallar.mjs)
  var farklar = K.farklar || function () { return []; };
  SM.farklar = farklar;

  // ---------------------------------------------------------------- ev sahibi (telefon / AutoCAD)
  var host = null;
  if (SM.ortam === 'telefon' && SM.gonder) {
    var bekleyen = {}, sira = 0;
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (!m || m.sm !== 'hesap') return;
      if (m.tip === 'yanit' && bekleyen[m.id]) { var b = bekleyen[m.id]; delete bekleyen[m.id]; if (m.hata) b.ret(new Error(m.hata)); else b.tam(m.veri); }
      else if (m.tip === 'geri') geriIstendi();
    });
    host = {
      ad: 'telefon',
      istek: function (tip, veri) {
        return new Promise(function (tam, ret) {
          var id = 'k' + (++sira);
          bekleyen[id] = { tam: tam, ret: ret };
          try { window.parent.postMessage({ sm: 'hesap', tip: tip, id: id, veri: veri || {} }, '*'); } catch (x) { delete bekleyen[id]; ret(x); }
          setTimeout(function () { if (bekleyen[id]) { delete bekleyen[id]; ret(new Error('Uygulama yanıt vermedi')); } }, 30000);
        });
      }
    };
  } else if (SM.ortam === 'autocad') {
    host = {
      ad: 'autocad',
      istek: function (tip, veri) {
        var g = {}; var v = veri || {}; Object.keys(v).forEach(function (k) { g[k] = v[k]; });
        g.oturum = SM.oturum;
        return fetch('api/' + tip, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.hata) throw new Error(j.hata || ('AutoCAD yanıtı ' + r.status)); return j; }); })
          .catch(function (e) { if (/Failed to fetch|NetworkError/i.test(e.message)) throw new Error('AutoCAD ile bağlantı yok (AutoCAD kapatılmış olabilir).'); throw e; });
      }
    };
  }

  // ---------------------------------------------------------------- durum
  var S = {
    baglam: null, hedef: null, kayit: null, guncel: null, farklar: [],
    dolan: [], eksik: [], uyari: [], kullanilan: {}, kirli: false, hazir: false, kaydedildi: null
  };
  SM.durum = S;

  // ---------------------------------------------------------------- görünüm
  function h(etiket, ozellik, cocuklar) {
    var e = d.createElement(etiket);
    if (ozellik) Object.keys(ozellik).forEach(function (k) {
      if (k === 'class') e.className = ozellik[k];
      else if (k === 'text') e.textContent = ozellik[k];
      else if (k === 'html') e.innerHTML = ozellik[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), ozellik[k]);
      else if (ozellik[k] != null) e.setAttribute(k, ozellik[k]);
    });
    (cocuklar || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); });
    return e;
  }
  var ust, cipHedef, cipDurum, dgmKaydet, panel, pencere;

  function arayuz() {
    var ortak = SM.ortak || 'ortak/';
    // Telefonda her zaman "Kapat"; AutoCAD'de sayfa Hesap Merkezi'nden açıldıysa (geçmiş varsa) "Hesap Merkezi'ne dön".
    var geriVar = SM.ortam === 'telefon' || (SM.ortam === 'autocad' && window.history.length > 1);
    var geriAdi = SM.ortam === 'telefon' ? 'Kapat' : 'Hesap Merkezi\'ne dön';
    var geri = geriVar ? h('button', { class: 'sm-geri', title: geriAdi, 'aria-label': geriAdi, onclick: function () { geriIstendi(); } }, [h('span', { html: '&#8249;' })]) : null;
    cipHedef = h('button', { class: 'sm-cip sm-hedef', title: 'Hedef', onclick: panelAcKapa }, ['Bağımsız hesap']);
    cipDurum = h('button', { class: 'sm-cip sm-durum', onclick: panelAcKapa }, ['…']);
    dgmKaydet = h('button', { class: 'sm-kaydet', onclick: kaydet, title: host ? 'Sonucu projeye kaydet' : 'Bağımsız açılışta kayıt yapılmaz' }, ['Kaydet']);
    if (!host) dgmKaydet.disabled = true;
    var menu = h('button', { class: 'sm-menu', title: 'Bilgi', 'aria-label': 'Bilgi', onclick: panelAcKapa }, [h('span', { html: '&#9432;' })]);
    ust = h('header', { id: 'sm-ust', role: 'banner' }, [
      geri,
      h('img', { class: 'sm-logo', src: ortak + 'amblem.png', alt: 'Şebeke-M Hakediş' }),
      h('div', { class: 'sm-baslik' }, [h('b', { text: SM.ad || d.title || 'Hesap' }), h('small', { text: 'Şebeke-M Hakediş · ' + (SM.grupAdi || 'Teknik hesap') })]),
      h('div', { class: 'sm-cipler' }, [cipHedef, cipDurum]),
      h('span', { class: 'sm-bosluk' }),
      dgmKaydet, menu
    ]);
    panel = h('section', { id: 'sm-panel', hidden: 'hidden', 'aria-label': 'Hesap bilgisi' });
    d.body.insertBefore(panel, d.body.firstChild);
    d.body.insertBefore(ust, d.body.firstChild);
    d.documentElement.classList.add('sm-var', 'sm-' + SM.ortam);
    if (SM.modul) d.documentElement.classList.add('sm-m-' + SM.modul);
  }

  function panelAcKapa() {
    if (panel.hidden) { panelCiz(); panel.hidden = false; } else panel.hidden = true;
  }

  function tablo(satirlar, basliklar) {
    return h('table', { class: 'sm-tablo' }, [
      basliklar ? h('thead', null, [h('tr', null, basliklar.map(function (b) { return h('th', { text: b }); }))]) : null,
      h('tbody', null, satirlar.map(function (s) { return h('tr', null, s.map(function (x) { return h('td', null, [x == null ? '—' : typeof x === 'object' && x.nodeType ? x : String(x)]); })); }))
    ]);
  }
  function deg(v, birim) {
    var t = typeof v === 'number' ? A.tr(v) : v == null || v === '' ? '—' : String(v);
    return birim ? t + ' ' + birim : t;
  }

  function panelCiz() {
    panel.innerHTML = '';
    var kapat = h('button', { class: 'sm-panel-kapat', 'aria-label': 'Kapat', onclick: function () { panel.hidden = true; } }, ['×']);
    panel.appendChild(kapat);
    // Hedef
    var hd = S.hedef;
    panel.appendChild(h('h3', { text: 'Hedef' }));
    panel.appendChild(h('p', { class: 'sm-not', text: hd ? hedefYazisi(hd, true) : (host ? 'Proje geneli (direk ya da hat seçilmedi).' : 'Bağımsız açılış: proje bilgisi yok, sonuç kaydedilmez.') }));
    // Kayıt
    if (S.kayit) {
      panel.appendChild(h('h3', { text: 'Kayıtlı hesap' }));
      panel.appendChild(h('p', { class: 'sm-not', text: 'Kaydedildi: ' + tarihYazi(S.kayit.tarih) + (S.kayit.kaynak ? ' · ' + (S.kayit.kaynak === 'autocad' ? 'AutoCAD' : 'telefon') : '') + (S.kayit.yapan ? ' · ' + S.kayit.yapan : '') }));
      if (S.guncel === null) panel.appendChild(h('p', { class: 'sm-not', text: 'Projenin bugünkü bilgisi alınamadı; güncellik denetlenemedi.' }));
      else if (S.farklar.length) {
        panel.appendChild(h('div', { class: 'sm-uyari sm-kirmizi', text: 'Proje bu hesaptan sonra değişti. Değişen bilgiler:' }));
        panel.appendChild(tablo(S.farklar.map(function (f) { return [alanAdi(f.yol), deg(f.eski), f.silindi ? '(yok)' : deg(f.yeni)]; }), ['Bilgi', 'Hesapta', 'Bugün']));
        panel.appendChild(h('button', { class: 'sm-dugme', onclick: guncelAktar, text: 'Güncel bilgileri hesaba aktar' }));
      } else panel.appendChild(h('div', { class: 'sm-uyari sm-yesil', text: 'Güncel: hesapta kullanılan proje bilgileri değişmedi.' }));
    }
    // Projeden alınanlar
    if (S.dolan.length) {
      panel.appendChild(h('h3', { text: 'Projeden alınan bilgiler (' + S.dolan.length + ')' }));
      panel.appendChild(tablo(S.dolan.map(function (x) { return [x.alan, deg(x.deger, x.birim), x.kaynak || '']; }), ['Alan', 'Değer', 'Kaynak']));
    }
    if (S.eksik.length) {
      panel.appendChild(h('h3', { text: 'Projede olmayan bilgiler — elle girin (' + S.eksik.length + ')' }));
      panel.appendChild(h('ul', { class: 'sm-liste' }, S.eksik.map(function (x) {
        var git = x.sec ? h('button', { class: 'sm-bag', text: 'Alana git', onclick: function () { alanaGit(x.sec); } }) : null;
        return h('li', { class: x.girildi ? 'sm-tamam' : '' }, [h('b', { text: x.alan }), x.neden ? ' — ' + x.neden : '', x.girildi ? ' ✓ girildi' : '', ' ', git]);
      })));
    }
    if (S.uyari.length) {
      panel.appendChild(h('h3', { text: 'Uyarılar' }));
      panel.appendChild(h('ul', { class: 'sm-liste' }, S.uyari.map(function (x) { return h('li', { text: x }); })));
    }
    if (U.notlar && U.notlar.length) {
      panel.appendChild(h('h3', { text: 'Hesap hakkında' }));
      panel.appendChild(h('ul', { class: 'sm-liste' }, U.notlar.map(function (x) { return h('li', { text: x }); })));
    }
    panel.appendChild(h('h3', { text: 'Kaynak' }));
    panel.appendChild(h('p', { class: 'sm-not', text: (SM.kaynak ? SM.kaynak + '.' : 'Hesap aracı.') + ' Hesap formülleri ve tabloları değiştirilmeden Şebeke-M Hakediş\'e eklenmiştir' + (SM.surum ? ' (paket ' + SM.surum + ')' : '') + '.' }));
  }

  function tarihYazi(t) {
    if (!t) return '—';
    var x = new Date(t);
    return isNaN(x) ? String(t) : x.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  var TUR = { direk: 'Direk', hat: 'Hat', trafo: 'Trafo', kanal: 'Kanal', proje: 'Proje' };
  function hedefYazisi(hd, uzun) {
    if (!hd) return 'Bağımsız hesap';
    var t = (TUR[hd.tur] || hd.tur || '') + (hd.no ? ' ' + hd.no : '');
    if (uzun && hd.ad && hd.ad !== hd.no) t += ' · ' + hd.ad;
    return t;
  }
  function alanAdi(yol) {
    var x = (S.dolan || []).filter(function (a) { return a.yol === yol; })[0];
    return x ? x.alan : yol;
  }

  function durumCiz() {
    var hedefVar = !!(S.hedef && S.hedef.tur && S.hedef.tur !== 'proje');
    cipHedef.textContent = hedefVar ? hedefYazisi(S.hedef) : host ? 'Proje geneli' : 'Bağımsız hesap';
    cipHedef.classList.toggle('sm-bos', !hedefVar);
    cipHedef.title = S.hedef ? hedefYazisi(S.hedef, true) : '';
    var t, sinif = '';
    var kalan = eksikKalan().length;
    if (S.kayit) {
      t = 'Kayıtlı · ' + tarihYazi(S.kayit.tarih).split(' ')[0] + (S.guncel === null ? '' : S.farklar.length ? ' · GÜNCEL DEĞİL' : ' · güncel');
      sinif = S.farklar.length ? 'sm-kirmizi' : 'sm-yesil';
    } else if (S.baglam) {
      t = S.dolan.length + ' bilgi projeden' + (kalan ? ' · ' + kalan + ' eksik' : '');
      sinif = kalan ? 'sm-turuncu' : 'sm-yesil';
    } else {
      t = host ? 'Proje bilgisi yok' : 'Bilgi';
    }
    if (S.kaydedildi) { t = 'Kaydedildi · ' + t.replace(/^Kayıtlı · [^·]+· /, ''); }
    // Kayıtlı bir hesapta kaydedilmemiş değişiklik varsa çipte belli olsun.
    if (S.kirli && (S.kayit || S.kaydedildi)) { t += ' · değişiklik kaydedilmedi'; sinif = 'sm-turuncu'; }
    cipDurum.textContent = t;
    cipDurum.className = 'sm-cip sm-durum ' + sinif;
    if (!panel.hidden) panelCiz();
  }

  // ---------------------------------------------------------------- iletiler
  function mesaj(metin, tur, ms) {
    var m = h('div', { class: 'sm-mesaj ' + (tur || '') , role: 'status', text: metin });
    d.body.appendChild(m);
    setTimeout(function () { m.classList.add('sm-cik'); setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 400); }, ms || 3200);
  }
  function sor(baslik, metin, tamam, vazgec) {
    return new Promise(function (r) {
      if (pencere && pencere.parentNode) pencere.parentNode.removeChild(pencere);
      var kapat = function (v) { if (pencere.parentNode) pencere.parentNode.removeChild(pencere); r(v); };
      pencere = h('div', { id: 'sm-pencere', role: 'dialog', 'aria-modal': 'true' }, [
        h('div', { class: 'sm-kutu' }, [
          h('h3', { text: baslik }),
          typeof metin === 'string' ? h('p', { text: metin }) : metin,
          h('div', { class: 'sm-dugmeler' }, [
            vazgec === null ? null : h('button', { class: 'sm-dugme', text: vazgec || 'Vazgeç', onclick: function () { kapat(false); } }),
            h('button', { class: 'sm-dugme sm-birincil', text: tamam || 'Tamam', onclick: function () { kapat(true); } })
          ])
        ])
      ]);
      d.body.appendChild(pencere);
    });
  }
  SM.mesaj = mesaj;
  SM.sor = sor;

  function alanaGit(sec) {
    var e = el(sec);
    if (!e) return;
    panel.hidden = true;
    try { e.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) { e.scrollIntoView(); }
    setTimeout(function () { try { e.focus(); } catch (x) { /* */ } }, 350);
  }

  // ---------------------------------------------------------------- eksik alanlar
  // Eksik girdi: { alan, sec, neden, girildi, tamam(), karar }. sec: alanın seçicisi (turuncu çerçeve); tamam(): varsa
  // doğru olunca "girildi" sayılır (tablo yeniden kurulan araçlar için); karar:false ise sonucu etkilemez, sayılmaz.
  function eksikKalan() { return S.eksik.filter(function (x) { return !x.girildi && x.karar !== false; }); }
  function eksikIsaretle(x) {
    var e = x.sec ? el(x.sec) : null;
    if (!e || x.girildi) return;
    if (!e.classList.contains('sm-eksik')) {
      e.classList.add('sm-eksik');
      e.setAttribute('title', (x.alan || '') + ': projede yok, elle girin');
    }
    if (e.__smEksik === x) return;
    e.__smEksik = x;
    var dinle = function () {
      x.girildi = true;
      e.classList.remove('sm-eksik');
      e.removeEventListener('input', dinle); e.removeEventListener('change', dinle);
      durumCiz();
    };
    e.addEventListener('input', dinle); e.addEventListener('change', dinle);
  }
  function eksikleriIsaretle() { S.eksik.forEach(eksikIsaretle); }
  // Araç tablosunu yeniden kurunca çerçeve ve dinleyici kaybolur: her değişiklikten sonra yenilenir
  function eksikTazele() {
    var degisti = false;
    S.eksik.forEach(function (x) {
      if (x.girildi) return;
      if (typeof x.tamam === 'function') {
        var ok = false;
        try { ok = !!x.tamam(); } catch (e) { ok = false; }
        if (ok) { x.girildi = true; degisti = true; var e = x.sec ? el(x.sec) : null; if (e) e.classList.remove('sm-eksik'); return; }
      }
      eksikIsaretle(x);
    });
    if (degisti) durumCiz();
  }
  d.addEventListener('change', function () { setTimeout(eksikTazele, 0); }, true);
  d.addEventListener('click', function () { setTimeout(eksikTazele, 0); }, true);

  // ---------------------------------------------------------------- doldurma
  function doldur(b) {
    S.dolan = []; S.eksik = []; S.uyari = []; S.kullanilan = {};
    if (!b || !U.doldur) return Promise.resolve();
    return Promise.resolve().then(function () { return U.doldur(b, A); }).then(function (r) {
      r = r || {};
      S.dolan = r.dolan || [];
      S.eksik = r.eksik || [];
      S.uyari = r.uyari || [];
      S.dolan.forEach(function (x) { if (x.yol) S.kullanilan[x.yol] = x.ham !== undefined ? x.ham : x.deger; });
      (r.kullanilan ? Object.keys(r.kullanilan) : []).forEach(function (k) { S.kullanilan[k] = r.kullanilan[k]; });
      return U.hesapla ? U.hesapla(A) : null;
    }).then(function () { eksikleriIsaretle(); });
  }

  function guncelAktar() {
    if (!S.guncel) return;
    sor('Güncel bilgileri aktar', 'Projenin bugünkü bilgileri hesaba yazılacak (kayıtlı hesaptaki elle girilmiş diğer değerler kalır). Sonra hesabı kontrol edip yeniden kaydedin.', 'Aktar').then(function (ok) {
      if (!ok) return;
      S.baglam = S.guncel;
      doldur(S.guncel).then(function () {
        S.farklar = [];
        S.kirli = true;
        kirliBildir();
        durumCiz();
        mesaj('Güncel bilgiler aktarıldı. Sonucu kontrol edip kaydedin.', 'sm-uyarili');
      });
    });
  }

  // ---------------------------------------------------------------- genel durum (uyarlama vermezse)
  function genelDurumAl() {
    var o = {};
    A.$$('input[id],select[id],textarea[id]').forEach(function (e) {
      if (e.closest('#sm-ust,#sm-panel,#sm-pencere') || e.type === 'file' || e.type === 'button' || e.type === 'submit') return;
      o[e.id] = (e.type === 'checkbox' || e.type === 'radio') ? e.checked : e.value;
    });
    return { genel: 1, alanlar: o };
  }
  function genelDurumYukle(s) {
    if (!s || !s.alanlar) return;
    Object.keys(s.alanlar).forEach(function (id) {
      var e = d.getElementById(id);
      if (!e) return;
      if (e.type === 'checkbox' || e.type === 'radio') e.checked = !!s.alanlar[id]; else e.value = s.alanlar[id];
      olay(e, 'input'); olay(e, 'change');
    });
  }
  function durumAl() { return U.durumAl ? U.durumAl(A) : genelDurumAl(); }
  function durumYukle(s) { return U.durumYukle && !(s && s.genel) ? U.durumYukle(s, A) : genelDurumYukle(s); }
  SM.durumAl = durumAl;
  SM.durumYukle = durumYukle;

  // ---------------------------------------------------------------- kirli işareti
  var kirliZaman = 0;
  function kirliBildir() {
    if (host && host.ad === 'telefon') { try { window.parent.postMessage({ sm: 'hesap', tip: 'kirli', veri: { kirli: S.kirli } }, '*'); } catch (x) { /* */ } }
  }
  function kirliDinle() {
    var f = function (e) {
      if (!S.hazir || (e.target && e.target.closest && e.target.closest('#sm-ust,#sm-panel,#sm-pencere'))) return;
      if (!e.isTrusted) return;
      if (!S.kirli) { S.kirli = true; kirliBildir(); if (S.kayit || S.kaydedildi) durumCiz(); }
      kirliZaman = Date.now();
    };
    d.addEventListener('input', f, true);
    d.addEventListener('change', f, true);
  }
  function geriIstendi() {
    if (!S.kirli) { kapat(); return; }
    sor('Kaydedilmedi', 'Hesapta kaydedilmemiş değişiklikler var. Çıkılsın mı?', 'Çık', 'Kal').then(function (ok) { if (ok) kapat(); });
  }
  function kapat() {
    if (host && host.ad === 'telefon') { try { window.parent.postMessage({ sm: 'hesap', tip: 'kapat', veri: {} }, '*'); } catch (x) { /* */ } }
    else if (SM.ortam === 'autocad') { if (history.length > 1) history.back(); else window.close(); }
  }
  SM.geri = geriIstendi;

  // ---------------------------------------------------------------- kaydet
  function kaydet() {
    if (!host) { mesaj('Bağımsız açılışta sonuç kaydedilmez. Hesabı Şebeke-M Hakediş\'ten (telefon ya da AutoCAD) açın.', 'sm-uyarili', 4500); return; }
    var s;
    try { s = U.sonuc ? U.sonuc(A) : null; } catch (e) { s = { hata: 'Sonuç okunamadı: ' + e.message }; }
    if (!s || s.hata || !s.ozet) { sor('Sonuç yok', (s && s.hata) || 'Hesap sonucu bulunamadı. Önce hesabı tamamlayın.', 'Tamam', null); return; }
    var kalan = eksikKalan();
    var devam = kalan.length
      ? sor('Eksik bilgi', 'Şu bilgiler projeden gelmedi ve değiştirilmedi: ' + kalan.map(function (x) { return x.alan; }).join(', ') + '. Hesaptaki değerler doğruysa kaydedebilirsiniz.', 'Yine de kaydet')
      : Promise.resolve(true);
    devam.then(function (ok) {
      if (!ok) return;
      var durum;
      try { durum = durumAl(); } catch (e) { durum = genelDurumAl(); }
      var uyarilar = (s.uyarilar || []).slice();
      kalan.forEach(function (x) { uyarilar.push(x.alan + ': projede yoktu, hesaptaki değer kullanıldı.'); });
      var veri = {
        modul: SM.modul, modulAdi: SM.ad, modulSurumu: SM.surum || '',
        hedef: S.hedef || { tur: 'proje', id: '', no: '' },
        kayitId: S.kayit ? S.kayit.id : (S.kaydedildi ? S.kaydedildi.id : ''),
        ozet: s.ozet, durum: s.durum || 'bilgi',
        ayrinti: { girdiler: s.girdiler || [], degerler: s.degerler || [], uyarilar: uyarilar },
        modulDurumu: JSON.stringify(durum),
        kullanilan: S.kullanilan
      };
      dgmKaydet.disabled = true;
      host.istek('kaydet', veri).then(function (r) {
        S.kaydedildi = { id: (r && r.id) || veri.kayitId, tarih: new Date().toISOString() };
        if (S.kayit) { S.kayit.tarih = S.kaydedildi.tarih; S.kayit.id = S.kaydedildi.id; S.farklar = []; }
        S.kirli = false; kirliBildir();
        durumCiz();
        mesaj((r && r.mesaj) || 'Kaydedildi', 'sm-basarili');
      }).catch(function (e) {
        sor('Kaydedilemedi', e.message, 'Tamam', null);
      }).then(function () { dgmKaydet.disabled = false; });
    });
  }
  SM.kaydet = kaydet;

  // ---------------------------------------------------------------- başlat
  function hazirBekle() {
    var bas = Date.now();
    return new Promise(function (r) {
      (function dene() {
        var ok = true;
        try { ok = !U.hazir || U.hazir(A); } catch (e) { ok = false; }
        if (ok || Date.now() - bas > 8000) r(); else setTimeout(dene, 120);
      })();
    });
  }

  function basla() {
    arayuz();
    kirliDinle();
    durumCiz();
    hazirBekle().then(function () {
      if (!host) { S.hazir = true; durumCiz(); return null; }
      return host.istek('basla', { modul: SM.modul, kayit: SM.kayit }).then(function (r) {
        r = r || {};
        S.hedef = r.hedef || (r.baglam && r.baglam.hedef) || null;
        S.baglam = r.baglam || null;
        S.guncel = r.guncel === undefined ? (r.kayit ? null : S.baglam) : r.guncel;
        if (r.kayit) {
          S.kayit = r.kayit;
          S.kullanilan = r.kayit.kullanilan || {};
          var md = r.kayit.modulDurumu;
          var durum = null;
          try { durum = typeof md === 'string' ? (md ? JSON.parse(md) : null) : md; } catch (e) { durum = null; }
          return Promise.resolve(durum ? durumYukle(durum) : null).then(function () {
            S.farklar = S.guncel ? farklar(S.kullanilan, S.guncel, { platformlarArasi: !!S.kayit.kaynak && S.kayit.kaynak !== SM.ortam }) : [];
            // dolan listesi: kayıttaki girdilerden (panelde gösterilir)
            S.dolan = Object.keys(S.kullanilan).map(function (k) { return { alan: k, deger: S.kullanilan[k], yol: k }; });
            if (U.alanAdlari) S.dolan.forEach(function (x) { x.alan = U.alanAdlari(x.yol) || x.alan; });
          });
        }
        return doldur(S.baglam);
      }).catch(function (e) {
        S.uyari.push('Proje bilgisi alınamadı: ' + e.message);
        mesaj('Proje bilgisi alınamadı: ' + e.message, 'sm-hatali', 6000);
      });
    }).then(function () {
      S.hazir = true;
      durumCiz();
      if (SM.bolum) {
        try {
          if (U.bolumGoster) U.bolumGoster(SM.bolum, A);
          else { var be = d.getElementById(SM.bolum); if (be) be.scrollIntoView({ block: 'start' }); }
        } catch (e) { /* */ }
      }
      if (S.kayit && S.farklar.length) mesaj('Bu hesap kaydedildikten sonra proje değişti. Ayrıntı için üstteki "GÜNCEL DEĞİL" yazısına dokunun.', 'sm-hatali', 7000);
      else if (eksikKalan().length) mesaj('Turuncu çerçeveli alanlar projede yok; lütfen girin.', 'sm-uyarili', 5000);
    });
  }

  if (d.readyState === 'complete') setTimeout(basla, 0);
  else window.addEventListener('load', function () { setTimeout(basla, 0); });
})();
