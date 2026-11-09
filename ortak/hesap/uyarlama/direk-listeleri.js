/* Şebeke-M · Direk listeleri (8.11.2026). Sayfa (kaynak/direk-listeleri.html) yalnız iskelettir; listeler burada
   Hesap Merkezi bağlamının "proje geneli" alanlarından kurulur (BAGLAM.md: bolgeler, direkler, hatlar, liste).
   Dört liste: AG direk listesi, ENH direk dağıtım cetveli, aydınlatma direk listesi, direk koordinat listesi.
   Proje (bölge) süzgeci: AutoCAD'de bölgeler; telefonda tek proje. Kayıt: etkin liste ve süzgeç; sonuç etkin
   listenin tablosudur. Projede olmayan bilgi tahminle doldurulmaz, boş bırakılır. */
(function () {
  'use strict';
  var BOLUMLER = ['ag', 'enh', 'ayd', 'koordinat'];
  var BOLUM_ADI = { ag: 'AG Direk Listesi', enh: 'ENH Direk Dağıtım Cetveli', ayd: 'Aydınlatma Direk Listesi', koordinat: 'Direk Koordinat Listesi' };
  var veri = null, bolum = 'ag', bolge = '', A0 = null;

  function el(id) { return document.getElementById(id); }
  function metin(v) { return v == null ? '' : String(v); }
  function sayi(v, b) { if (v == null || v === '' || !isFinite(+v)) return ''; var n = +v; return n.toLocaleString('tr-TR', { minimumFractionDigits: b == null ? 0 : b, maximumFractionDigits: b == null ? 2 : b }); }
  function kacar(s) { return metin(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var karsilastir = function (a, b) { return metin(a).localeCompare(metin(b), 'tr', { numeric: true, sensitivity: 'base' }); };

  /** Durum: iki platformun sözlüğü ortak koda (yeni, dm, dmm, mevcut, ileride). */
  function durumKodu(d) {
    var s = metin(d).toUpperCase().replace(/İ/g, 'I');
    if (!s) return '';
    if (['M', 'M+M', 'KM', 'ENH', 'ME', 'YENI', 'YENI · MONTAJ', 'GUC', 'GER', 'GUCGER', 'TADIL', 'MODUL'].indexOf(s) >= 0) return 'yeni';
    if (s === 'DM' || s === 'DEMONTAJ' || s === 'DEMONTE') return 'dm';
    if (s === 'DM+M' || s === 'DMM' || s === 'TASINAN') return 'dmm';
    if (s === 'MEVCUT') return 'mevcut';
    if (s === 'ILERIDE') return 'ileride';
    return 'diger';
  }
  var DURUM_YAZI = { yeni: 'Yeni', dm: 'Demontaj', dmm: 'Sök-tak (DMM)', mevcut: 'Mevcut', ileride: 'İleride', diger: '' };
  function dmYazi(d) { var k = metin(d.dmDurum).toUpperCase().replace(/İ/g, 'I'); return k === 'KESIK' ? ' (kesik)' : k === 'SOKUK' || k === 'SÖKÜK' ? ' (sökük)' : ''; }
  function rolYazi(d) {
    var r = metin(d.rol).toUpperCase();
    if (d.tur === 'TRAFO') return 'TR';
    return r === 'K' ? 'K' : r === 'T' ? 'T' : r === 'D' ? 'D' : r === 'N' ? 'N' : '';
  }

  // ---- malzeme sınıflandırma (cins ve tanım adından; iki platformun kalemleri eklentinin cins kodlarıyla gelir)
  function yg(m) {
    var c = metin(m.cins).toUpperCase().replace(/İ/g, 'I'), t = metin(m.tanim).toUpperCase().replace(/İ/g, 'I');
    if (/BAHH|^OG_|ENH|KOMPOZIT|YG/.test(c)) return true;
    if (/^AG_|AG\b/.test(c) && !/OG/.test(t)) return false;
    return /\bOG\b|MUS|MÜŞ|TRAFO|GTR|GT-2\d\d|GD-2\d\d|GN-|GZ-|GDS|6\.5U|JET|12M|10M|VKS|VHD|ZINCIR|ASKI|GERGI/.test(t);
  }
  function konsolMu(m) { var c = metin(m.cins).toUpperCase(), t = metin(m.tanim).toUpperCase().replace(/İ/g, 'I'); return /TRAVERS|KONSOL/.test(c) || /KONSOL|TRAVERS/.test(t); }
  function izolatorMu(m) { var c = metin(m.cins).toUpperCase().replace(/İ/g, 'I'); return /IZOLAT/.test(c) && !/IZOLASYON/.test(c); }
  function armaturMu(m) { var c = metin(m.cins).toUpperCase().replace(/İ/g, 'I'); return c === 'ARMATUR' || c === 'ARMATÜR' || /ARMAT/.test(c); }
  function adet(m) { var n = +m.miktar; return n > 0 && Math.abs(n - 1) > 1e-9 ? ' ×' + sayi(n) : ''; }
  function listele(mlz, sec) {
    var out = [];
    (mlz || []).forEach(function (m) { if (sec(m)) out.push(metin(m.tanim).trim() + adet(m)); });
    return out.join(', ');
  }
  function armaturOzeti(mlz) {
    var say = 0, gucler = [], adlar = [];
    (mlz || []).forEach(function (m) {
      if (!armaturMu(m)) return;
      var n = +m.miktar > 0 ? +m.miktar : 1;
      say += n;
      var t = metin(m.tanim);
      var w = /(\d+(?:[.,]\d+)?)\s*W\b/i.exec(t);
      var led = /S(\d+)\s*SINIF|SINIF[- ]?(\d+)/i.exec(t.replace(/İ/g, 'I'));
      if (w) gucler.push(w[1].replace('.', ',') + ' W');
      else if (led) gucler.push('LED Sınıf ' + (led[1] || led[2]));
      adlar.push(t);
    });
    return { say: say, guc: gucler.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' / '), adlar: adlar.join(', ') };
  }
  function konsolOzeti(mlz) {
    var out = [], uz = [];
    (mlz || []).forEach(function (m) {
      if (!konsolMu(m)) return;
      out.push(metin(m.tanim).trim() + adet(m));
      var u = /(\d+(?:[.,]\d+)?)\s*M\b/i.exec(metin(m.tanim));
      if (u) uz.push(u[1].replace('.', ','));
    });
    return { yazi: out.join(', '), uzunluk: uz.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' / ') };
  }
  function hatTertibi(d) {
    var adlar = [];
    (d.kollar || []).forEach(function (k) { (k.iletkenler || []).forEach(function (il) { var a = metin(il.ad).trim(); if (a && adlar.indexOf(a) < 0) adlar.push(a); }); });
    return adlar.join(' / ');
  }

  // ---- süzgeç
  function direkler() {
    var l = (veri && veri.direkler) || [];
    if (bolge) l = l.filter(function (d) { return metin(d.bolge) === bolge; });
    return l.slice().sort(function (a, b) { return karsilastir(a.no, b.no); });
  }
  function hatlar() {
    var l = (veri && veri.hatlar) || [];
    if (bolge) l = l.filter(function (h) { return metin(h.bolge) === bolge; });
    return l;
  }
  function bolgeAdlari() {
    var s = [];
    ((veri && veri.direkler) || []).concat((veri && veri.hatlar) || []).forEach(function (x) { var b = metin(x.bolge); if (b && s.indexOf(b) < 0) s.push(b); });
    return s.sort(karsilastir);
  }

  // ---- tablolar: { basliklar, satirlar, sinif (sütun sınıfları) }
  function agTablosu() {
    var satirlar = [];
    direkler().forEach(function (d) {
      if (d.tur !== 'AG' && d.tur !== 'MUSTEREK' && d.tur !== 'TRAFO') return;
      var dk = durumKodu(d.durum), tip = metin(d.tip);
      var t = d.hesap && d.hesap.tepe ? d.hesap.tepe : null;
      var acik = [];
      if (dk === 'dm') acik.push('Demontaj' + dmYazi(d)); else if (dk === 'dmm') acik.push('Sök-tak'); else if (dk === 'mevcut') acik.push('Mevcut'); else if (dk === 'ileride') acik.push('İleride');
      if (d.hakedis) acik.push(d.hakedis + '. hakediş');
      if (t && t.oneri && t.oneri !== 'tablo yok') acik.push('önerilen ' + t.oneri);
      satirlar.push([
        satirlar.length + 1, metin(d.no), rolYazi(d), d.aci != null && rolYazi(d) === 'K' ? sayi(d.aci, 1) : '', hatTertibi(d),
        t ? sayi(t.Rx, 1) : '', t ? sayi(t.Ry, 1) : '', t ? sayi(t.R, 1) : '',
        dk === 'dm' ? tip : '', dk === 'dmm' ? tip : '', dk === 'mevcut' ? tip : '',
        dk === 'yeni' && d.tur !== 'MUSTEREK' ? tip : '', dk === 'yeni' && d.tur === 'MUSTEREK' ? tip : '',
        listele(d.malzemeler, function (m) { return konsolMu(m) && !yg(m); }), listele(d.malzemeler, function (m) { return konsolMu(m) && yg(m); }),
        listele(d.malzemeler, function (m) { return izolatorMu(m) && !yg(m); }), listele(d.malzemeler, function (m) { return izolatorMu(m) && yg(m); }),
        acik.join(' · ')
      ]);
    });
    return {
      ustBasliklar: [['Sıra', 1], ['Direk', 1], ['Direk', 1], ['Açı', 1], ['Hat', 1], ['Tepe Kuvveti (kg)', 3], ['Mevcut Direk', 3], ['Yeni Direk', 2], ['Traversler ve Konsollar', 2], ['İzolatörler', 2], ['Açıklamalar', 1]],
      basliklar: ['No', 'No', 'Fonks.', '(°)', 'Tertibi', 'Px', 'Py', 'P', 'Sökülen', 'BYSK', 'Yerinde Kalan', 'AG', 'Müşterek', 'AG', 'YG', 'AG', 'YG', ''],
      sinif: ['sayi', 'no', '', 'sayi', 'uzun', 'sayi', 'sayi', 'sayi', '', '', '', '', '', 'uzun', 'uzun', 'uzun', 'uzun', 'uzun'],
      satirlar: satirlar
    };
  }

  function enhTablolari() {
    var dMap = {};
    ((veri && veri.direkler) || []).forEach(function (d) { dMap[metin(d.id)] = d; dMap['no:' + metin(d.no)] = d; });
    var tablolar = [];
    hatlar().forEach(function (h) {
      if (metin(h.tur) !== 'OG_HAVAI') return;
      var dir = h.direkler || [], ac = h.acikliklar || [];
      var satirlar = [], bastan = 0;
      dir.forEach(function (dz, i) {
        var d = dMap[metin(dz.id)] || dMap['no:' + metin(dz.no)] || {};
        var once = i > 0 && ac[i - 1] ? +ac[i - 1].uzunluk || 0 : 0, sonra = ac[i] ? +ac[i].uzunluk || 0 : 0;
        if (i > 0) bastan += once;
        var ruzgar = (i > 0 && ac[i]) ? (once + sonra) / 2 : (i === 0 ? sonra / 2 : once / 2);
        var aciDer = d.aci != null ? +d.aci : (dz.aci != null ? +dz.aci : null);
        var k = konsolOzeti(d.malzemeler);
        satirlar.push([
          metin(dz.no), sayi(bastan, 2), ac[i] ? sayi(sonra, 2) : '', '', '', sayi(ruzgar, 2),
          aciDer != null && aciDer > 0.05 ? sayi(aciDer * 400 / 360, 2) : '', '',
          '', rolYazi(Object.assign({}, dz, d)), metin(d.tip || dz.tip), metin(dz.no), '',
          k.yazi, '', '', '', d.yukseklik != null ? sayi(d.yukseklik, 1) : '', '', '',
          DURUM_YAZI[durumKodu(d.durum)] || '', dmYazi(d).replace(/[()]/g, '').trim(),
          metin(veri && veri.proje ? veri.proje.buzBolgesi : ''), listele(d.malzemeler, izolatorMu)
        ]);
      });
      tablolar.push({
        baslik: metin(h.no) + (h.iletkenler && h.iletkenler.length ? ' · ' + h.iletkenler.map(function (x) { return (x.adet > 1 ? x.adet + '×' : '') + metin(x.ad); }).join(' + ') : '') + (h.gerilimKV ? ' · ' + sayi(h.gerilimKV, 1) + ' kV' : '') + (h.toplamUzunluk ? ' · ' + sayi(h.toplamUzunluk, 2) + ' m' : ''),
        ustBasliklar: [['Direk No', 1], ['Baştan Mesafe', 1], ['Direk Ara Mes.', 1], ['Menziller (m)', 3], ['Hat Açısı (grad)', 1], ['Geçiş / Atlama', 1], ['Direk', 4], ['Farklı Ayak', 1], ['Konsollar', 3], ['Torsiyon (kgm)', 1], ['Toprak Üstü Boy (m)', 1], ['Trvs. Tert.', 1], ['Temel Tipi', 1], ['Durum', 2], ['Buz Bölgesi', 1], ['İzolatör Tipi', 1]],
        basliklar: ['', '(m)', '(m)', 'aw', 'ag', 'ar', '', '', 'Nakil Tesb.', 'Fonks.', 'Tipi', 'No', '', 'Üst', 'Orta', 'Alt', '', '', '', '', '', 'Dem.', '', ''],
        sinif: ['no', 'sayi', 'sayi', 'sayi', 'sayi', 'sayi', 'sayi', '', '', '', '', 'no', '', 'uzun', 'uzun', 'uzun', 'sayi', 'sayi', '', '', '', '', 'sayi', 'uzun'],
        satirlar: satirlar
      });
    });
    return tablolar;
  }

  function aydTablosu() {
    var satirlar = [];
    direkler().forEach(function (d) {
      var arm = armaturOzeti(d.malzemeler);
      if (d.tur !== 'AYD' && arm.say === 0) return;
      var k = konsolOzeti(d.malzemeler), dk = durumKodu(d.durum);
      var acik = [DURUM_YAZI[dk] || ''];
      if (dk === 'dm') acik[0] += dmYazi(d);
      if (d.tur !== 'AYD') acik.push((d.tur === 'MUSTEREK' ? 'müşterek' : d.tur === 'TRAFO' ? 'trafo' : 'AG') + ' direk');
      satirlar.push([satirlar.length + 1, metin(d.no), hatTertibi(d), metin(d.tip), k.uzunluk, k.yazi, '', arm.say ? sayi(arm.say) : '', arm.guc, '', acik.filter(Boolean).join(' · ')]);
    });
    return {
      basliklar: ['Sıra No', 'Direk No', 'İletken Tertibi', 'Direk Tipi', 'Konsol Uzunluğu (m)', 'Konsol Adedi / Tipi', 'Konsol Açısı', 'Armatür Sayısı', 'Armatür Gücü (W)', 'Armatür Açısı', 'Açıklamalar'],
      sinif: ['sayi', 'no', 'uzun', '', 'sayi', 'uzun', '', 'sayi', '', '', 'uzun'],
      satirlar: satirlar
    };
  }

  function koordinatTablosu() {
    var satirlar = direkler().map(function (d) { return [metin(d.no), sayi(d.saga, 2), sayi(d.yukari, 2), d.kot != null ? sayi(d.kot, 2) : '']; });
    return { basliklar: ['Direk No', 'Y (sağa)', 'X (yukarı)', 'Kot'], sinif: ['no', 'sayi', 'sayi', 'sayi'], satirlar: satirlar };
  }

  // ---- çizim
  function tabloHtml(t) {
    var h = '<table>';
    if (t.ustBasliklar) {
      h += '<tr>' + t.ustBasliklar.map(function (b) { return '<th class="grup" colspan="' + b[1] + '">' + kacar(b[0]) + '</th>'; }).join('') + '</tr>';
    }
    h += '<tr>' + t.basliklar.map(function (b, i) { return '<th class="' + (t.sinif && t.sinif[i] === 'sayi' ? 'sayi' : '') + '">' + kacar(b) + '</th>'; }).join('') + '</tr>';
    if (!t.satirlar.length) h += '<tr class="bos"><td colspan="' + t.basliklar.length + '">Bu listede direk yok.</td></tr>';
    t.satirlar.forEach(function (s) {
      h += '<tr>' + s.map(function (v, i) { return '<td class="' + ((t.sinif && t.sinif[i]) || '') + '">' + kacar(v) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</table>';
  }
  function ciz() {
    if (!veri) return;
    var p = veri.proje || {};
    var kun = [];
    if (p.ad) kun.push('<span><b>Proje:</b> ' + kacar(p.ad) + (p.kod ? ' (' + kacar(p.kod) + ')' : '') + '</span>');
    if (bolge) kun.push('<span><b>Bölge:</b> ' + kacar(bolge) + '</span>');
    if (p.firma) kun.push('<span><b>Firma:</b> ' + kacar(p.firma) + '</span>');
    if (p.yapan) kun.push('<span><b>Hazırlayan:</b> ' + kacar(p.yapan) + (p.unvan ? ', ' + kacar(p.unvan) : '') + '</span>');
    kun.push('<span><b>Tarih:</b> ' + kacar(p.tarih || new Date().toISOString().slice(0, 10)) + '</span>');
    if (p.buzBolgesi) kun.push('<span><b>Buz yükü bölgesi:</b> ' + kacar(p.buzBolgesi) + '</span>');
    el('dl-kunye').innerHTML = kun.join('');
    var ag = agTablosu(), enh = enhTablolari(), ayd = aydTablosu(), ko = koordinatTablosu();
    el('dl-ozet').innerHTML = '<span><b>' + ag.satirlar.length + '</b> AG / müşterek direk</span><span><b>' + enh.reduce(function (a, t) { return a + t.satirlar.length; }, 0) + '</b> ENH direği (' + enh.length + ' hat)</span><span><b>' + ayd.satirlar.length + '</b> aydınlatma</span><span><b>' + ko.satirlar.length + '</b> koordinat</span>';
    el('ag-icerik').innerHTML = tabloHtml(ag);
    el('enh-icerik').innerHTML = enh.length ? enh.map(function (t) { return '<h3>' + kacar(t.baslik) + '</h3>' + tabloHtml(t); }).join('') : '<table><tr class="bos"><td>Projede OG (ENH) havai hat yok.</td></tr></table>';
    el('ayd-icerik').innerHTML = tabloHtml(ayd);
    var yarim = Math.ceil(ko.satirlar.length / 2);
    el('koordinat-icerik').innerHTML = ko.satirlar.length > 12
      ? '<div class="dl-yan">' + tabloHtml(Object.assign({}, ko, { satirlar: ko.satirlar.slice(0, yarim) })) + tabloHtml(Object.assign({}, ko, { satirlar: ko.satirlar.slice(yarim) })) + '</div>'
      : tabloHtml(ko);
    BOLUMLER.forEach(function (b) { var s = el(b); if (s) s.classList.toggle('aktif', b === bolum); });
    Array.prototype.forEach.call(document.querySelectorAll('#dl-sekmeler button'), function (b) { b.classList.toggle('aktif', b.getAttribute('data-bolum') === bolum); });
    el('dl-baslik').textContent = BOLUM_ADI[bolum] || 'Direk Listeleri';
    document.title = (BOLUM_ADI[bolum] || 'Direk Listeleri') + (p.ad ? ' — ' + p.ad : '');
  }
  function bolgeSecenekleri() {
    var s = el('dl-bolge'), adlar = bolgeAdlari();
    s.innerHTML = '<option value="">Tümü</option>' + adlar.map(function (a) { return '<option value="' + kacar(a) + '">' + kacar(a) + '</option>'; }).join('');
    if (adlar.indexOf(bolge) < 0) bolge = '';
    s.value = bolge;
    s.parentNode.style.display = adlar.length > 1 ? '' : 'none';
  }
  function bolumSec(b) {
    if (BOLUMLER.indexOf(b) < 0) return;
    bolum = b;
    ciz();
    try { document.dispatchEvent(new Event('sm-degisti')); } catch (e) { /* */ }
  }

  el('dl-sekmeler').addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button[data-bolum]') : null;
    if (b) bolumSec(b.getAttribute('data-bolum'));
  });
  el('dl-bolge').addEventListener('change', function () { bolge = el('dl-bolge').value; ciz(); try { document.dispatchEvent(new Event('sm-degisti')); } catch (e) { /* */ } });
  el('dl-yazdir').addEventListener('click', function () { window.print(); });

  function etkinTablo() {
    if (bolum === 'ag') { var t = agTablosu(); return { basliklar: ['Sıra', 'Direk No', 'Fonks.', 'Açı (°)', 'Hat Tertibi', 'Px (kg)', 'Py (kg)', 'P (kg)', 'Sökülen', 'BYSK', 'Yerinde Kalan', 'Yeni AG', 'Yeni Müşterek', 'Konsol AG', 'Konsol YG', 'İzolatör AG', 'İzolatör YG', 'Açıklamalar'], satirlar: t.satirlar }; }
    if (bolum === 'ayd') { var a = aydTablosu(); return { basliklar: a.basliklar, satirlar: a.satirlar }; }
    if (bolum === 'koordinat') { var k0 = koordinatTablosu(); return { basliklar: k0.basliklar, satirlar: k0.satirlar }; }
    var satirlar = [];
    enhTablolari().forEach(function (t) { t.satirlar.forEach(function (s) { satirlar.push([t.baslik].concat(s)); }); });
    return { basliklar: ['Hat', 'Direk No', 'Baştan (m)', 'Ara (m)', 'aw', 'ag', 'ar', 'Açı (grad)', 'Geçiş', 'Nakil', 'Fonks.', 'Tipi', 'No', 'Ayak', 'Üst kons.', 'Orta kons.', 'Alt kons.', 'Torsiyon', 'Boy (m)', 'Trvs.', 'Temel', 'Durum', 'Dem.', 'Buz', 'İzolatör'], satirlar: satirlar };
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Listeler projedeki direklerden, malzemelerinden ve hatlardan kurulur; hesap yapılmaz. Proje değişince sayfayı yeniden açın.',
      'AG direk listesindeki tepe kuvveti sütunları (Px, Py, P) o direk için kaydedilmiş Cer Vektörü hesabından gelir; hesap yoksa boş kalır.',
      'ENH cetvelinde rüzgâr açıklığı (ar) komşu açıklıkların ortalamasıdır; ağırlık açıklığı (aw), gerilme açıklığı (ag), torsiyon, temel tipi, farklı ayak ve geçiş bilgileri projede olmadığı için boş bırakılır. Hat açısı grad (400) birimindedir.',
      'Konsol uzunluğu ve armatür gücü malzeme adından okunur (ör. "1.5M AG potans Açma Konsol", "70 W Sodyum Buh. Ayd. Armatürü", LED sınıfı).',
      'Koordinat listesinde Y sağa (doğu), X yukarı (kuzey) değeridir (Türk ölçme geleneği); kot ölçülmüşse yazılır.'
    ],
    hazir: function () { return !!el('ag-icerik'); },

    doldur: function (b, A) {
      A0 = A;
      veri = b || {};
      var r = { dolan: [], eksik: [], uyari: [] };
      var l = veri.liste || {};
      r.dolan.push({ alan: 'Direk sayısı', deger: l.direkler != null ? l.direkler : (veri.direkler || []).length, birim: 'adet', yol: 'liste.direkler', ham: l.direkler });
      r.dolan.push({ alan: 'Hat sayısı', deger: l.hatlar != null ? l.hatlar : (veri.hatlar || []).length, birim: 'adet', yol: 'liste.hatlar', ham: l.hatlar });
      if (l.imza) r.dolan.push({ alan: 'Liste imzası', deger: l.imza, birim: '', yol: 'liste.imza', ham: l.imza });
      if (!(veri.direkler || []).length) r.uyari.push('Projede direk yok; listeler boş.');
      var hesapsiz = (veri.direkler || []).filter(function (d) { return (d.tur === 'AG' || d.tur === 'MUSTEREK') && !(d.hesap && d.hesap.tepe); }).length;
      if (hesapsiz) r.uyari.push(hesapsiz + ' AG / müşterek direğin kayıtlı cer hesabı yok: tepe kuvveti sütunları boş.');
      bolgeSecenekleri();
      ciz();
      return r;
    },

    hesapla: function () { ciz(); },

    bolumGoster: function (b) { bolumSec(b); },

    sonuc: function (A) {
      if (!veri) return { hata: 'Proje bilgisi yok.' };
      var t = etkinTablo();
      var ag = agTablosu(), enh = enhTablolari(), ayd = aydTablosu(), ko = koordinatTablosu();
      var enhSayi = enh.reduce(function (a, x) { return a + x.satirlar.length; }, 0);
      var p = veri.proje || {};
      return {
        ozet: (BOLUM_ADI[bolum] || 'Direk listeleri') + ': ' + t.satirlar.length + ' satır' + (bolge ? ' · ' + bolge : '') + ' · ' + ag.satirlar.length + ' AG / müşterek, ' + enhSayi + ' ENH, ' + ayd.satirlar.length + ' aydınlatma, ' + ko.satirlar.length + ' koordinat',
        durum: 'bilgi',
        girdiler: [
          { ad: 'Liste', deger: BOLUM_ADI[bolum] || bolum, birim: '' },
          { ad: 'Proje (bölge)', deger: bolge || 'Tümü', birim: '' },
          { ad: 'Proje adı', deger: p.ad || '', birim: '' }
        ],
        degerler: [
          { ad: 'AG / müşterek direk', deger: ag.satirlar.length, birim: 'adet' },
          { ad: 'ENH direği', deger: enhSayi, birim: 'adet' },
          { ad: 'ENH hat', deger: enh.length, birim: 'adet' },
          { ad: 'Aydınlatma direği', deger: ayd.satirlar.length, birim: 'adet' },
          { ad: 'Koordinat satırı', deger: ko.satirlar.length, birim: 'adet' }
        ],
        tablo: { basliklar: t.basliklar, satirlar: t.satirlar },
        uyarilar: []
      };
    },

    durumAl: function () { return { surum: 1, bolum: bolum, bolge: bolge }; },

    durumYukle: function (s) {
      s = s || {};
      if (BOLUMLER.indexOf(s.bolum) >= 0) bolum = s.bolum;
      bolge = metin(s.bolge);
      // Kayıt yeniden açılınca köprü doldur() çağırmaz; listeler o anki proje bilgisinden kurulur (kayıt değişmişse
      // köprü "güncel değil" der). Proje bilgisi köprünün durumundadır.
      if (!veri) {
        var D = window.__SM && window.__SM.durum;
        veri = (D && (D.guncel || D.baglam)) || null;
      }
      bolgeSecenekleri();
      ciz();
    },

    alanAdlari: function (yol) {
      return { 'liste.direkler': 'Direk sayısı', 'liste.hatlar': 'Hat sayısı', 'liste.imza': 'Liste imzası (direkler, tipler, durumlar)' }[yol] || yol;
    }
  };
})();
