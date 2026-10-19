/* Şebeke-M uyarlaması: OG Gerilim Düşümü ve Güç Kaybı (og-gd). Hesap kodlarına dokunmaz: başlık alanlarına ve
   segment tablosuna yazar, aracın kendi işlevlerini (renderTable, hesapla, tabloKC) çağırır, sonuçları okur.
   Araçta durum kaydı yoktur; durum = başlık alanları + segment listesi (segs).
   Bilinen araç davranışları (uyarlama bunlara göre çalışır):
   - Segment hücre kimlikleri segmentin iç numarasıyla kurulur (c_<id>_<alan>); sıra numarası değildir.
   - Gerilim seçeneklerde yoksa araç sessizce 31,5 kV ile hesaplar → gerilim yalnız seçeneklerden biriyse yazılır.
   - Boş tabloda, kablo tipi olmayan ya da K/C bulunamayan segmentte araç yine "TEDAŞ UYGUN" yazar → durum 'bilgi'.
   - K/C hücreleri tablo değerini göstermez (aracın görüntü hatası); kullanılan K/C tabloKC ile okunur. */
(function () {
  'use strict';
  var ACSR = { SWALLOW: 'Sw', RAVEN: '1/0', PIGEON: '3/0', PARTRIDGE: '266', HAWK: '477' };
  var YUK_ALAN = 'Segment sonundaki trafo güçleri';
  var izleniyor = false;

  function el(id) { return document.getElementById(id); }
  function bos(v) { return v === null || v === undefined || v === ''; }
  function sayiMi(v) { return typeof v === 'number' && isFinite(v); }
  function yuvarla(v, n) { var k = Math.pow(10, n); return Math.round(v * k) / k; }
  /** Araç adları value="…" içine tırnaksız yazar: tırnak ve açılı ayraçlar zararsız karakterlere çevrilir. */
  function guvenli(s) { return String(s == null ? '' : s).replace(/"/g, '\'').replace(/</g, '‹').replace(/>/g, '›').replace(/&/g, '＆'); }
  function gerilim() { return parseFloat(el('gerilim').value) || 31.5; }   // aracın kendi okuma kuralı (hesapla ile aynı)
  function segBul(id) { for (var i = 0; i < segs.length; i++) if (segs[i].id === id) return segs[i]; return null; }
  function kc(s, U) {
    var t = tabloKC(s.kesit, U);
    return { K: !bos(s.k_ov) ? parseFloat(s.k_ov) : t[0], C: !bos(s.c_ov) ? parseFloat(s.c_ov) : t[1], Kel: !bos(s.k_ov), Cel: !bos(s.c_ov) };
  }
  function hucre(id, alan) { return el('c_' + id + '_' + alan); }
  function hucreSayi(A, id, alan) { var e = hucre(id, alan); return e ? A.sayi(e.textContent) : NaN; }
  function hatGucu(A, s) { var e = hucre(s.id, 'hat_g'); if (!e) return NaN; return A.sayi(bos(s.hat_g_override) ? e.placeholder : e.value); }
  function kabloAdi(k) { return k && KABLOLAR[k] ? KABLOLAR[k].lbl : ''; }
  function t(A, v, n) { return sayiMi(v) ? A.tr(v, n) : '—'; }

  /** Bağlamdaki iletkeni aracın TEDAŞ K/C tablosundaki anahtara çevirir. */
  function anahtarBul(il, A) {
    if (!il || bos(il.ad)) return { neden: 'Projede iletken bilgisi yok' };
    var c = A.iletken(il.ad), ham = String(il.ad), adet = +il.adet || 1;
    if (adet === 1 && /^\s*2\s*[x×X*]\s*3/.test(ham)) adet = 2;                 // "2x3xSwallow" yazımı
    if (c.devre === 'AG') return { neden: '"' + ham + '" bir AG iletkeni; OG hesabında kullanılamaz' };
    if (adet > 2) return { neden: adet + ' devre: araçta yalnız tek ve çift devre değerleri var' };
    var cift = adet === 2, a = null;
    if (c.aile === 'ACSR' && ACSR[c.tel]) a = cift ? (c.tel === 'SWALLOW' ? '2X3xSw' : '2x3x' + ACSR[c.tel]) : '3x' + ACSR[c.tel];
    else if (c.aile === 'XLPE-CU' && c.kesit) a = cift ? '2x3(1x' + c.kesit + ')' : '3(1x' + c.kesit + ')';
    else if (c.aile === 'XLPE-AL' && c.kesit) a = cift ? '2x3x(1x' + c.kesit + ')A' : '3x(1x' + c.kesit + ')A';
    if (a && KABLOLAR[a]) return { anahtar: a, cift: cift };
    return { neden: '"' + ham + '"' + (cift ? ' (çift devre)' : '') + ' TEDAŞ K/C tablosunda yok' };
  }

  /** OG hattaki iletken: devresi OG olan ilk iletken (müşterek hatta AG iletkeni atlanır). */
  function ogIletkeni(liste, A) {
    var x = null;
    (liste || []).forEach(function (il, k) {
      if (x || !il) return;
      var d = il.devre || A.iletken(il.ad).devre;
      if (d === 'OG') x = { il: il, yol: 'hat.iletkenler[' + k + ']' };
    });
    if (!x && liste && liste.length && liste[0] && (liste[0].devre || A.iletken(liste[0].ad).devre) !== 'AG') x = { il: liste[0], yol: 'hat.iletkenler[0]' };
    return x;
  }

  /** Bağlamdan sıralı parçalar (zincir ya da hattın açıklıkları). */
  function parcalar(b, A) {
    var p = [];
    if (b.zincir && b.zincir.length) {
      b.zincir.forEach(function (z, i) {
        var y = 'zincir[' + i + ']';
        p.push({ bas: z.bas, bit: z.bit, L: z.uzunluk, Lyol: y + '.uzunluk', il: z.iletken || null, ilYol: y + '.iletken',
          basYol: y + '.bas', bitYol: y + '.bit', kaynak: 'Zincir ' + (i + 1),
          yuk: z.yuk && sayiMi(z.yuk.gucKVA) && z.yuk.gucKVA > 0 ? { kva: z.yuk.gucKVA, yol: y + '.yuk.gucKVA' } : null });
      });
    } else if (b.hat && b.hat.acikliklar && b.hat.acikliklar.length) {
      var k = ogIletkeni(b.hat.iletkenler, A);
      b.hat.acikliklar.forEach(function (a, i) {
        var y = 'hat.acikliklar[' + i + ']';
        p.push({ bas: a.bas, bit: a.bit, L: a.uzunluk, Lyol: y + '.uzunluk', il: k ? k.il : null, ilYol: k ? k.yol : null,
          basYol: y + '.bas', bitYol: y + '.bit', kaynak: 'Hat ' + (b.hat.no || ''), yuk: null });
      });
    }
    return p;
  }

  /** Kopru'nun eksik işaretleri, tablo yeniden çizilince (Segment Ekle / Sil) kaybolur: yeniden işaretler,
      gereği karşılanan eksikleri "girildi" sayar. */
  function izle(A) {
    if (izleniyor) return;
    izleniyor = true;
    var tazele = function () {
      setTimeout(function () {
        var S = window.__SM && window.__SM.durum;
        if (!S || !S.eksik) return;
        S.eksik.forEach(function (x) {
          if (x.girildi || !x.sec || typeof x.tamam !== 'function') return;
          var e = A.$(x.sec), ok = false;
          try { ok = x.tamam(); } catch (h) { ok = false; }
          if (ok) { x.girildi = true; if (e) e.classList.remove('sm-eksik'); }
          else if (e && !e.classList.contains('sm-eksik')) { e.classList.add('sm-eksik'); e.setAttribute('title', x.alan + ': projede yok, elle girin'); }
        });
      }, 0);
    };
    document.addEventListener('change', tazele, true);
    document.addEventListener('click', tazele, true);
  }

  window.__SM_UYARLAMA = {
    notlar: [
      'Gerilim düşümü %e = 10⁻⁴·K·N·L ve güç kaybı ΔP = 10⁻⁶·C·N²·L (N: diversiteli hat gücü kVA, L: km) ile hesaplanır; K ve C, TEDAŞ tablosundan (cos φ = 0,8) alınır. Sınırlar: %e normal işletmede %7, arızalı işletmede %10; güç kaybı %5 (sınıra eşit değer uygundur).',
      'Hat gücü sağdan sola toplanır: her segmentin gücü, kendi sonundaki trafo ve diğer güçler ile ondan sonraki bütün segmentlerin güçleridir. Dallanan hatların yükü "Diğer Güçler" satırına yazılır.',
      'Toplam %P, segmentlerin %P değerlerinin toplamıdır (her segment kendi gücüne göre); toplam kayıp gücün hat başı gücüne oranı değildir.',
      'Projede yük bilgisi olmayan ara direklerde aynı iletkenli ardışık açıklıklar tek segmentte birleştirilir (sonuç değişmez). Ara bir direkte trafo varsa segmenti o noktada ikiye ayırın.',
      'Aracın K/C tablosunda doğrulanması gereken değerler: 3×(1×35) Cu XLPE kablonun 34,5 kV C değeri 0,044 yazılmış (dizinin gidişine göre yaklaşık 0,44 olmalı; güç kaybı on kat küçük çıkar).',
      'Çift devre değerleri tek devrenin yaklaşık yarısıdır; ancak 2×3×(1×185) ve 2×3×(1×240) Cu kabloların C değerleri tek devrenin 0,77 ve 0,82 katı, 2×3×266 MCM havai hattın K değeri 0,78 katı yazılmış. Kaynak tabloyla karşılaştırın.',
      '3×(1×25) Cu XLPE kablonun 30–34,5 kV için K/C değeri yoktur; bu gerilimlerde K ve C elle girilmelidir.',
      'Araç ekranında K ve C hücreleri tablo değerini göstermez (boş görünür) ve CSV dosyasında K/C sütunları boş çıkar; hesap yine tablo değerleriyle yapılır. Kullanılan K ve C, Şebeke-M sonucundaki tabloda listelenir.',
      'Araç; seçeneklerde olmayan gerilimde 31,5 kV ile hesaplar, boş tabloda ya da kablo tipi / K-C değeri olmayan segmentte de "TEDAŞ UYGUN" yazar. Şebeke-M bu durumlarda gerilimi eksik işaretler, sonucu "bilgi" olarak kaydeder.',
      'Trafo güçleri (yükler) projede yoktur; diversite (%80) ve cos φ (0,80) aracın varsayılanlarıdır.'
    ],

    hazir: function () {
      try { return typeof renderTable === 'function' && typeof segs !== 'undefined' && segs.length > 0 && !!el('mainTable').querySelector('tbody'); }
      catch (e) { return false; }
    },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
      var goruldu = {};
      function dolan(alan, deger, birim, yol, ham, kaynak) {
        if (yol && goruldu[yol]) return;
        if (yol) goruldu[yol] = 1;
        r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham === undefined ? deger : ham, kaynak: kaynak || '' });
      }
      var p = b.proje || {};

      // ---- başlık
      if (!bos(p.ad)) { A.yaz('#merkez', p.ad); dolan('Merkez / proje', p.ad, '', 'proje.ad', p.ad, 'Proje'); }
      else if (b.trafo && !bos(b.trafo.no)) { A.yaz('#merkez', 'Trafo ' + b.trafo.no); dolan('Merkez / proje', 'Trafo ' + b.trafo.no, '', 'trafo.no', b.trafo.no, 'Trafo'); }
      var kv = null, kvYol = null;
      if (b.hat && sayiMi(b.hat.gerilimKV)) { kv = b.hat.gerilimKV; kvYol = 'hat.gerilimKV'; }
      else if (b.trafo && sayiMi(b.trafo.ogKV)) { kv = b.trafo.ogKV; kvYol = 'trafo.ogKV'; }
      var uygun = kv == null ? null : A.secenekler('#gerilim').filter(function (o) { return Math.abs(parseFloat(o.deger) - kv) < 1e-9; })[0];
      if (uygun) { A.sec('#gerilim', uygun.deger); dolan('İşletme gerilimi', kv, 'kV', kvYol, kv, kvYol === 'trafo.ogKV' ? 'Trafo' : 'Hat'); }
      else r.eksik.push({ alan: 'İşletme gerilimi', sec: '#gerilim', neden: kv == null
        ? 'Projede OG gerilimi yok; araç seçili 31,5 kV ile hesaplıyor, doğru gerilimi seçin'
        : 'Projedeki ' + A.tr(kv) + ' kV aracın gerilimlerinden biri değil (6,3 / 10,5 / 15,8 / 30 / 31,5 / 33 / 34,5 kV); araç 31,5 kV ile hesaplıyor, tablodaki gerilimi seçin' });
      if (b.hat && !bos(b.hat.no)) { A.yaz('#kol', b.hat.no); dolan('Kol no', b.hat.no, '', 'hat.no', b.hat.no, 'Hat'); }
      if (!bos(p.tarih) && /^\d{4}-\d{2}-\d{2}$/.test(String(p.tarih))) { A.yaz('#tarih', p.tarih); dolan('Tarih', p.tarih, '', 'proje.tarih', p.tarih, 'Proje'); }
      if (!bos(p.yapan)) {
        A.yaz('#haz', bos(p.unvan) ? p.yapan : p.unvan + ' ' + p.yapan);
        dolan('Hazırlayan', p.yapan, '', 'proje.yapan', p.yapan, 'Proje');
        if (!bos(p.unvan)) dolan('Unvan', p.unvan, '', 'proje.unvan', p.unvan, 'Proje');
      } else {
        A.yaz('#haz', '—');
        r.eksik.push({ alan: 'Hazırlayan', sec: '#haz', neden: 'Projede hesabı hazırlayan mühendis yok' });
      }

      // ---- segmentler
      var liste = parcalar(b, A);
      if (!liste.length) {
        var s0 = segs[0];
        r.eksik.push({ alan: 'Segmentler', sec: s0 ? '#c_' + s0.id + '_kesit' : '#mainTable', neden: 'Projede bu hedef için OG hat zinciri ya da açıklık bilgisi yok; segmentleri (kablo tipi, uzunluk, trafo gücü) elle girin',
          tamam: function () { return segs.some(function (s) { return !!s.kesit && s.l_m > 0; }); } });
        izle(A);
        return r;
      }
      // trafo bir düğümdeyse (parçanın sonu) yükü bilinir; birden çok trafo varsa toplam güç tahmin edilmez
      var tr = b.trafo, trafoNeden = null;
      if (tr && !bos(tr.no) && sayiMi(tr.gucKVA) && tr.gucKVA > 0) {
        liste.forEach(function (pc) {
          if (pc.yuk || String(pc.bit) !== String(tr.no)) return;
          if ((+tr.adet || 1) > 1) { trafoNeden = 'Trafo ' + tr.no + ' merkezinde ' + tr.adet + ' adet ' + A.tr(tr.gucKVA) + ' kVA trafo var; toplam gücü girin'; pc.yukYok = true; return; }
          pc.yuk = { kva: tr.gucKVA, yol: 'trafo.gucKVA', trafo: true };
        });
      }
      liste.forEach(function (pc) { pc.k = anahtarBul(pc.il, A); });
      // aynı iletkenli, arada yük bilgisi olmayan ardışık parçalar birleşir
      var sg = [];
      liste.forEach(function (pc) {
        var kimlik = (pc.k.anahtar || ('?' + (pc.il ? pc.il.ad : ''))) + '|' + (pc.il ? (+pc.il.adet || 1) : 1);
        var son = sg[sg.length - 1];
        if (son && !son.yuk && !son.yukYok && son.kimlik === kimlik) {
          son.parca.push(pc); son.bit = pc.bit; son.bitYol = pc.bitYol; son.yuk = pc.yuk; son.yukYok = pc.yukYok;
        } else sg.push({ kimlik: kimlik, k: pc.k, parca: [pc], bas: pc.bas, basYol: pc.basYol, bit: pc.bit, bitYol: pc.bitYol, yuk: pc.yuk, yukYok: pc.yukYok, il: pc.il, ilYol: pc.ilYol });
      });
      var degisti = false;
      segs = sg.map(function (s, i) {
        var L = 0, Lyok = false;
        s.parca.forEach(function (pc) { if (sayiMi(pc.L) && pc.L > 0) L += pc.L; else Lyok = true; });
        s.L = yuvarla(L, 2); s.Lyok = Lyok;
        var ad = (bos(s.bas) ? '' : s.bas) + '→' + (bos(s.bit) ? '' : s.bit);
        var ga = guvenli(ad);
        if (ga !== ad) degisti = true;
        return { id: i + 1, kesit: s.k.anahtar || '', ad: ga, l_m: s.L || '', trafo: s.yuk ? s.yuk.kva : '', diger: '', div: 80, hat_g_override: null, k_ov: null, c_ov: null };
      });
      nextId = segs.length + 1;
      renderTable();

      // ---- projeden alınanlar ve eksikler
      var U = gerilim(), yuksuz = [], birlesen = 0, trafoSeg = null;
      sg.forEach(function (s, i) {
        var n = i + 1, id = segs[i].id;
        s.parca.forEach(function (pc) { if (sayiMi(pc.L)) dolan('Uzunluk ' + (bos(pc.bas) ? '' : pc.bas) + '→' + (bos(pc.bit) ? '' : pc.bit), pc.L, 'm', pc.Lyol, pc.L, pc.kaynak); });
        if (s.parca.length > 1) birlesen += s.parca.length;
        if (!bos(s.bas)) dolan('Seg. ' + n + ' başı', s.bas, '', s.basYol, s.bas, s.parca[0].kaynak);
        if (!bos(s.bit)) dolan('Seg. ' + n + ' sonu', s.bit, '', s.bitYol, s.bit, s.parca[s.parca.length - 1].kaynak);
        s.parca.forEach(function (pc) {
          if (pc.il && !bos(pc.il.ad)) dolan('İletken' + (pc.ilYol.indexOf('zincir') === 0 ? ' (' + pc.kaynak.toLowerCase() + ')' : ''), pc.il.ad, '', pc.ilYol + '.ad', pc.il.ad, pc.kaynak);
          if (pc.il && sayiMi(pc.il.adet)) dolan('Devre sayısı' + (pc.ilYol.indexOf('zincir') === 0 ? ' (' + pc.kaynak.toLowerCase() + ')' : ''), pc.il.adet, '', pc.ilYol + '.adet', pc.il.adet, pc.kaynak);
        });
        if (s.yuk) {
          dolan('Seg. ' + n + ' sonu trafo gücü', s.yuk.kva, 'kVA', s.yuk.yol, s.yuk.kva, s.yuk.trafo ? 'Trafo ' + tr.no : s.parca[s.parca.length - 1].kaynak);
          if (s.yuk.trafo) dolan('Trafo no', tr.no, '', 'trafo.no', tr.no, 'Trafo');
        } else if (s.yukYok) trafoSeg = id;
        else yuksuz.push(n);
        if (!s.k.anahtar) {
          r.eksik.push({ alan: 'Seg. ' + n + ' kablo tipi', sec: '#c_' + id + '_kesit', neden: s.k.neden + '; kablo tipini seçin ya da K ve C\'yi elle girin',
            tamam: function () { var x = segBul(id); return !x || !!x.kesit || (!bos(x.k_ov) && !bos(x.c_ov)); } });
        } else {
          var t = tabloKC(s.k.anahtar, U);
          if (t[0] == null || t[1] == null) r.eksik.push({ alan: 'Seg. ' + n + ' K ve C', sec: '#c_' + id + '_k', neden: kabloAdi(s.k.anahtar) + ' için ' + A.tr(U) + ' kV\'ta tablo değeri yok; K ve C\'yi elle girin',
            tamam: function () { var x = segBul(id); if (!x) return true; var v = kc(x, gerilim()); return v.K != null && v.C != null; } });
          if (s.k.cift) r.uyari.push('Seg. ' + n + ': iki devre — aracın çift devre değerleri (' + kabloAdi(s.k.anahtar) + ') kullanıldı.');
        }
        if (s.Lyok) r.eksik.push({ alan: 'Seg. ' + n + ' uzunluğu', sec: '#c_' + id + '_l_m', neden: 'Projede açıklık uzunluğu eksik',
          tamam: function () { var x = segBul(id); return !x || x.l_m > 0; } });
      });
      if (trafoNeden && trafoSeg != null) {
        dolan('Trafo no', tr.no, '', 'trafo.no', tr.no, 'Trafo');
        dolan('Trafo adedi', tr.adet, '', 'trafo.adet', tr.adet, 'Trafo');
        r.eksik.push({ alan: 'Trafo gücü', sec: '#c_' + trafoSeg + '_trafo', neden: trafoNeden,
          tamam: function () { var x = segBul(trafoSeg); return !x || x.trafo > 0; } });
      }
      if (yuksuz.length) {
        var ilk = segs[yuksuz[0] - 1].id;
        r.eksik.push({ alan: YUK_ALAN, sec: '#c_' + ilk + '_trafo',
          neden: 'Seg. ' + yuksuz.join(', ') + ': segment sonundaki trafo gücü (kVA) projede yok. Sonunda trafo olan segmente gücünü yazın; trafosu olmayan ara segmentler boş kalabilir. Dallanan hatların yükü "Diğer Güçler" satırına.',
          tamam: function () { var s0 = segs[0]; return !!s0 && hucreSayi(A, s0.id, 'div_hat') > 0; } });
      }
      if (birlesen) r.uyari.push(birlesen + (liste[0].ilYol && liste[0].ilYol.indexOf('zincir') === 0 ? ' zincir parçası' : ' açıklık') + ', aynı iletkenli ve aradaki düğümlerde yük bilgisi olmadığı için ' + sg.filter(function (s) { return s.parca.length > 1; }).length + ' segmentte birleştirildi (sonuç değişmez). Ara bir düğümde trafo varsa segmenti o noktada ikiye ayırın.');
      r.uyari.push('Diversite (%80) ve cos φ (0,80) aracın varsayılanlarıdır; projeden gelmez, gerekirse değiştirin.');
      if (degisti) r.uyari.push('Segment adlarındaki tırnak ve açılı ayraç işaretleri değiştirildi (aracın tablosu bunları taşıyamıyor).');
      izle(A);
      return r;
    },

    hesapla: function () { hesapla(); },

    sonuc: function (A) {
      hesapla();
      if (!segs.length) return { hata: 'Tabloda segment yok: en az bir segment ekleyip kablo tipi, uzunluk ve trafo gücünü girin.' };
      if (!segs.some(function (s) { return s.l_m > 0 || s.kesit; })) return { hata: 'Segmentlere kablo tipi ve uzunluk girilmemiş.' };
      var U = gerilim(), isl = el('isletme').value, eLim = isl === 'arizali' ? 10 : 7, cos = parseFloat(el('cosPhi').value) || 0.8;
      var uy = [], eksikVar = false, topL = 0, topG = 0;
      var satirlar = segs.map(function (s, i) {
        var n = i + 1, v = kc(s, U);
        topL += s.l_m || 0; topG += (s.trafo || 0) + (s.diger || 0);
        if (!s.kesit && !(v.Kel && v.Cel)) { eksikVar = true; uy.push('Seg. ' + n + ': kablo tipi seçilmemiş; segment hesaba katılmadı (araç bu durumda da "UYGUN" yazar).'); }
        else if (v.K == null || v.C == null) { eksikVar = true; uy.push('Seg. ' + n + ': ' + kabloAdi(s.kesit) + ' için ' + A.tr(U) + ' kV\'ta K/C tablo değeri yok; K ve C elle girilmeli.'); }
        if (!(s.l_m > 0)) { eksikVar = true; uy.push('Seg. ' + n + ': uzunluk girilmemiş.'); }
        if (v.Kel) uy.push('Seg. ' + n + ': K elle girildi (' + A.tr(v.K, 5) + ').');
        if (v.Cel) uy.push('Seg. ' + n + ': C elle girildi (' + A.tr(v.C, 5) + ').');
        if (!bos(s.hat_g_override)) uy.push('Seg. ' + n + ': hat gücü elle girildi (' + A.tr(parseFloat(s.hat_g_override)) + ' kVA).');
        if (!v.Cel && s.kesit === '3(1x35)' && Math.abs(U - 34.5) < 1e-9) uy.push('Seg. ' + n + ': 3×(1×35) Cu XLPE için tablodaki 34,5 kV C değeri (0,044) şüpheli; güç kaybı olduğundan küçük çıkabilir.');
        if (!v.Cel && (s.kesit === '2x3(1x185)' || s.kesit === '2x3(1x240)')) uy.push('Seg. ' + n + ': ' + kabloAdi(s.kesit) + ' için tablodaki C değeri tek devrenin yarısı değil; güç kaybını kaynak tabloyla doğrulayın.');
        if (!v.Kel && s.kesit === '2x3x266') uy.push('Seg. ' + n + ': 2×3×266 MCM için tablodaki K değeri tek devrenin yarısı değil; gerilim düşümünü kaynak tabloyla doğrulayın.');
        return [n, s.ad || '', kabloAdi(s.kesit) || '—', s.l_m || 0, s.trafo || 0, s.diger || 0, hatGucu(A, s), s.div,
          hucreSayi(A, s.id, 'div_hat'), v.K == null ? '—' : v.K, v.C == null ? '—' : v.C,
          hucreSayi(A, s.id, 'e_seg'), hucreSayi(A, s.id, 'e_kum'), hucreSayi(A, s.id, 'dp'), hucreSayi(A, s.id, 'p_seg')];
      });
      satirlar.forEach(function (row) { for (var j = 0; j < row.length; j++) if (typeof row[j] === 'number' && !isFinite(row[j])) row[j] = '—'; });
      var e = A.sayi(A.metin('#tot_ekum')), pp = A.sayi(A.metin('#tot_p')), dp = A.sayi(A.metin('#tot_dp'));
      var I = A.sayi(A.metin('#s_i')), N0 = hucreSayi(A, segs[0].id, 'div_hat');
      if (!(N0 > 0)) { eksikVar = true; uy.push('Trafo / diğer güç girilmemiş: hat gücü 0, sonuç anlamsız.'); }
      var genel = A.metin('#s_genel'), uygunMu = /UYGUN/.test(genel) && !/AŞILDI/.test(genel);
      if (!uygunMu && !eksikVar) {
        if (pp > 5) uy.unshift('Güç kaybı %' + t(A, pp, 3) + ' > %5.');
        if (e > eLim) uy.unshift('Gerilim düşümü %' + t(A, e, 3) + ' > %' + eLim + ' (' + (isl === 'arizali' ? 'arızalı' : 'normal') + ' işletme sınırı).');
      }
      var durum = eksikVar ? 'bilgi' : (uygunMu ? 'uygun' : 'uygun-degil');
      var karar = durum === 'bilgi' ? 'eksik bilgi' : (uygunMu ? 'TEDAŞ UYGUN' : 'LİMİT AŞILDI');
      return {
        ozet: 'OG ' + A.tr(U) + ' kV' + (isl === 'arizali' ? ' (arızalı)' : '') + ' · ' + segs.length + ' segment · %e = ' + t(A, e, 3) + ' (sınır %' + eLim + ') · %P = ' + t(A, pp, 3)
          + ' · ΔP = ' + t(A, dp, 2) + ' kW · I = ' + t(A, I, 1) + ' A → ' + karar,
        durum: durum,
        girdiler: [
          { ad: 'İşletme gerilimi', deger: U, birim: 'kV' },
          { ad: 'İşletme türü', deger: isl === 'arizali' ? 'Arızalı' : 'Normal', birim: '' },
          { ad: 'cos φ', deger: cos, birim: '' },
          { ad: 'Segment sayısı', deger: segs.length, birim: '' },
          { ad: 'Toplam uzunluk', deger: yuvarla(topL, 2), birim: 'm' },
          { ad: 'Bağlı güç (trafo + diğer)', deger: yuvarla(topG, 3), birim: 'kVA' }
        ],
        degerler: [
          { ad: 'Toplam gerilim düşümü', deger: e, birim: '%' },
          { ad: 'Gerilim düşümü sınırı', deger: eLim, birim: '%' },
          { ad: 'Toplam güç kaybı', deger: pp, birim: '%' },
          { ad: 'Güç kaybı sınırı', deger: 5, birim: '%' },
          { ad: 'Toplam kayıp güç', deger: dp, birim: 'kW' },
          { ad: 'Hat başı akımı', deger: I, birim: 'A' },
          { ad: 'Hat başı diversiteli güç', deger: N0, birim: 'kVA' }
        ],
        tablo: {
          basliklar: ['Seg.', 'Ad', 'Kablo tipi', 'L (m)', 'Trafo (kVA)', 'Diğer (kVA)', 'Hat gücü (kVA)', 'Diversite (%)', 'Div. güç (kVA)', 'K', 'C', '%e', '%e kümülatif', 'ΔP (kW)', '%P'],
          satirlar: satirlar
        },
        uyarilar: uy
      };
    },

    durumAl: function () {
      var a = document.activeElement;
      if (a && a !== document.body && typeof a.blur === 'function') a.blur();   // yazılmakta olan değer işlensin
      hesapla();                                                                 // ekrandaki değerler segs'e
      return {
        surum: 1,
        baslik: { merkez: el('merkez').value, gerilim: el('gerilim').value, cosPhi: el('cosPhi').value, isletme: el('isletme').value, kol: el('kol').value, tarih: el('tarih').value, haz: el('haz').value },
        segs: segs.map(function (s) {
          return { kesit: s.kesit, ad: s.ad, l_m: s.l_m, trafo: s.trafo, diger: s.diger, div: s.div, hat_g_override: s.hat_g_override, k_ov: s.k_ov, c_ov: s.c_ov };
        })
      };
    },

    durumYukle: function (d, A) {
      d = d || {};
      var b = d.baslik || {};
      ['merkez', 'cosPhi', 'kol', 'tarih', 'haz'].forEach(function (k) { if (b[k] != null) el(k).value = b[k]; });
      if (b.gerilim != null) A.sec('#gerilim', String(b.gerilim), true);
      if (b.isletme != null) A.sec('#isletme', String(b.isletme), true);
      if (Array.isArray(d.segs)) {
        // segEkle her satırda tabloyu yeniden çizer; liste tek seferde kurulur, kimlikler 1'den başlar
        segs = d.segs.map(function (s, i) {
          return { id: i + 1, kesit: s.kesit || '', ad: guvenli(s.ad || ''), l_m: s.l_m || '', trafo: s.trafo || '', diger: s.diger || '', div: s.div != null ? s.div : 80,
            hat_g_override: bos(s.hat_g_override) ? null : s.hat_g_override, k_ov: bos(s.k_ov) ? null : s.k_ov, c_ov: bos(s.c_ov) ? null : s.c_ov };
        });
        nextId = segs.length + 1;
      }
      renderTable();   // tabloyu çizer ve hesaplar
    }
  };
})();
