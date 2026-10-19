/* Şebeke-M hesap köprüsü — sayfa başı. Paketleyici (araclar/hesap-paketle.mjs) bu dosyayı her hesap sayfasının
   <head> kısmına, hesabın kendi kodlarından ÖNCE ekler. Hesabın formüllerine ve kodlarına dokunmaz; yalnız ortamı
   hazırlar:
   - Telefonda ve AutoCAD'de hesabın tarayıcı belleği (localStorage) bu oturuma özel bir bellekle değiştirilir:
     başka bir direğin hesabından kalan değerler yeni hesaba karışmaz, uygulamanın kendi kayıtlarına dokunulmaz.
     Hesap kaydedilince durumu projeye yazılır, yeniden açılınca oradan yüklenir.
   - Telefonda yazdırma, açılır pencere (rapor) ve dosya indirme uygulamaya yönlendirilir (WebView bunları kendisi
     yapamaz). AutoCAD'de (Edge penceresi) ve bağımsız açılışta tarayıcının kendi işlevleri çalışır. */
(function () {
  'use strict';
  var SM = window.__SM = window.__SM || {};
  var q = null;
  try { q = new URLSearchParams(location.search); } catch (e) { q = null; }
  var al = function (k) { return q ? q.get(k) : null; };
  var gomulu = false;
  try { gomulu = window.parent !== window; } catch (e) { gomulu = true; }
  SM.ortam = al('ortam') || (gomulu ? 'telefon' : 'tarayici');
  SM.oturum = al('oturum') || '';
  SM.kayit = al('kayit') || '';
  SM.bolum = al('bolum') || '';   // hesabın bir bölümüne açılış (ör. AG kısa devrede 'tekhat')
  // Tema ilk çizimden itibaren geçerli olsun (html.sm-var seçicileri)
  try { document.documentElement.classList.add('sm-var', 'sm-' + SM.ortam, 'sm-m-' + (SM.modul || 'hesap')); } catch (e) { /* */ }

  // ---- Oturuma özel bellek ----
  function bellek() {
    var m = {};
    var o = {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[String(k)] = String(v); },
      removeItem: function (k) { delete m[String(k)]; },
      clear: function () { m = {}; },
      key: function (i) { var a = Object.keys(m); return i >= 0 && i < a.length ? a[i] : null; }
    };
    Object.defineProperty(o, 'length', { get: function () { return Object.keys(m).length; } });
    o.__icerik = function () { return m; };
    return o;
  }
  if (SM.ortam !== 'tarayici') {
    SM.yerel = bellek();
    SM.oturumBellegi = bellek();
    try { Object.defineProperty(window, 'localStorage', { configurable: true, enumerable: true, get: function () { return SM.yerel; } }); } catch (e) { /* tarayıcı izin vermezse gerçek bellek kullanılır */ }
    try { Object.defineProperty(window, 'sessionStorage', { configurable: true, enumerable: true, get: function () { return SM.oturumBellegi; } }); } catch (e) { /* */ }
  }

  if (SM.ortam !== 'telefon') return;

  // ---- Telefon: uygulamaya ileti ----
  SM.gonder = function (tip, veri) {
    try { window.parent.postMessage({ sm: 'hesap', tip: tip, veri: veri }, '*'); } catch (e) { /* */ }
  };

  // Formdaki güncel değerleri yazdırılacak kopyaya işler (value özelliği HTML'e kendiliğinden yansımaz)
  function degerleriIsle(asil, kopya) {
    var a = asil.querySelectorAll('input,select,textarea'), k = kopya.querySelectorAll('input,select,textarea');
    for (var i = 0; i < a.length && i < k.length; i++) {
      var x = a[i], y = k[i];
      if (x.tagName === 'SELECT') {
        for (var j = 0; j < y.options.length; j++) {
          if (j === x.selectedIndex) y.options[j].setAttribute('selected', 'selected'); else y.options[j].removeAttribute('selected');
        }
      } else if (x.tagName === 'TEXTAREA') y.textContent = x.value;
      else if (x.type === 'checkbox' || x.type === 'radio') { if (x.checked) y.setAttribute('checked', 'checked'); else y.removeAttribute('checked'); }
      else y.setAttribute('value', x.value);
    }
    var ca = asil.querySelectorAll('canvas'), ck = kopya.querySelectorAll('canvas');
    for (var c = 0; c < ca.length && c < ck.length; c++) {
      try {
        // yazdırılmayacak tuval (data-sm-baski="yok" ya da 3B önizleme): kopyadan çıkarılır
        if (ca[c].getAttribute('data-sm-baski') === 'yok' || (ca[c].closest && ca[c].closest('[data-sm-baski="yok"]'))) { ck[c].parentNode.removeChild(ck[c]); continue; }
        var img = kopya.ownerDocument.createElement('img');
        img.src = ca[c].toDataURL('image/png');
        img.style.cssText = ck[c].getAttribute('style') || '';
        img.style.width = (ca[c].style.width || ca[c].clientWidth + 'px');
        img.style.maxWidth = '100%';
        ck[c].parentNode.replaceChild(img, ck[c]);
      } catch (e) { /* */ }
    }
  }

  // Yazdırma: sayfanın (ya da rapor penceresinin) o anki hâli uygulamanın yazdırma ekranına gider. Tarayıcının
  // yazdırma olayları (beforeprint / afterprint) burada tetiklenir: araçlar yazdırma düzenine geçip geri dönebilsin.
  SM.yazdirOlayli = true;
  SM.yazdir = function (doc, baslik) {
    var w = null;
    try { w = doc.defaultView; } catch (e) { w = null; }
    try { if (w) w.dispatchEvent(new Event('beforeprint')); } catch (e) { /* */ }
    try {
      var kopya = doc.documentElement.cloneNode(true);
      degerleriIsle(doc.documentElement, kopya);
      var sil = kopya.querySelectorAll('script,#sm-ust,#sm-panel,#sm-pencere,.sm-gizli-yazdir');
      for (var i = 0; i < sil.length; i++) sil[i].parentNode.removeChild(sil[i]);
      var html = '<!DOCTYPE html>' + kopya.outerHTML;
      var taban = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
      html = html.replace(/<head([^>]*)>/i, '<head$1><base href="' + taban + '">');
      SM.gonder('yazdir', { baslik: baslik || doc.title || 'Hesap', html: html });
    } catch (e) { SM.gonder('hata', { mesaj: 'Yazdırılamadı: ' + e.message }); }
    try { if (w) w.dispatchEvent(new Event('afterprint')); } catch (e) { /* */ }
  };
  window.print = function () { SM.yazdir(document, document.title); };

  // Açılır pencere (rapor sayfası): görünmez bir çerçeve verilir; print() çağrılınca içeriği yazdırılır
  window.open = function (url) {
    var u = url == null ? '' : String(url);
    if (/^https?:/i.test(u)) { SM.gonder('dis', { url: u }); return null; }
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.className = 'sm-gizli-yazdir';
    f.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;height:1200px;border:0;visibility:hidden';
    (document.body || document.documentElement).appendChild(f);
    var w = f.contentWindow;
    try {
      w.print = function () { SM.yazdir(w.document, w.document.title || document.title); };
      w.close = function () { setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1500); };
      w.focus = function () { };
    } catch (e) { /* */ }
    return w;
  };

  // Dosya indirme (Blob / data adresli bağlantılar) → uygulamanın dosya kaydı
  function base64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  SM.indir = function (a) {
    var ad = a.getAttribute('download') || 'hesap';
    var href = a.href;
    if (!href) return;
    if (!/^(blob:|data:)/i.test(href)) { SM.gonder('dis', { url: href }); return; }
    fetch(href).then(function (r) { return r.blob(); }).then(function (b) {
      return b.arrayBuffer().then(function (ab) { SM.gonder('dosya', { ad: ad, tur: b.type || 'application/octet-stream', veri: base64(new Uint8Array(ab)) }); });
    }).catch(function (e) { SM.gonder('hata', { mesaj: 'Dosya kaydedilemedi: ' + e.message }); });
  };
  var asilTikla = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') || /^(blob:|data:)/i.test(this.href || '')) { SM.indir(this); return; }
    if (/^https?:/i.test(this.href || '') && this.target === '_blank') { SM.gonder('dis', { url: this.href }); return; }
    return asilTikla.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    if (a.hasAttribute('download') || /^(blob:|data:)/i.test(a.href || '')) { e.preventDefault(); SM.indir(a); return; }
    if (/^https?:/i.test(a.href || '') && a.origin !== location.origin) { e.preventDefault(); SM.gonder('dis', { url: a.href }); }
  }, true);
})();
