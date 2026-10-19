/* Şebeke-M uyarlaması: Beton Köşk 3B Yerleşim Simülatörü (kosk). Hesap kodlarına dokunmaz: projeden gelen trafo
   bilgilerini aracın kendi giriş alanlarına ve işlevlerine (yapı sınıfı / köşk tipi seçimi, setVaryant, trafo gücü
   seçimi, refresh) yazar; sonuçları aracın kendi işlevlerinden (layout, checks, weights) okur. Aracın tam durumu
   S nesnesidir (durumAl / durumYukle). Baskıda alt satıra proje bilgisi yazılır ve ekrandaki 2B çizimle baskı
   çizimlerinin aynı kimlikleri (tarama, ok uçları) çakışmasın diye ekran çizimi baskı süresince boşaltılır. */
(function () {
  'use strict';
  var VARSAYILAN = null;                 // aracın açılış durumu: eksik kayıtları tamamlamak için
  try { VARSAYILAN = JSON.parse(HIST_ILK); } catch (e) { VARSAYILAN = null; }
  var ALTLIK = {};                       // baskı alt satırı (proje adı, kodu, hazırlayan, firma, tarih)
  var GERILIMLER = ['31.5', '33', '34.5', '36'];
  var SINIF_ADI = { mono: 'Monoblok beton köşk', pref: 'Prefabrik beton köşk', bina: 'MOD tipi trafo binası', oda: 'Bina altı özel trafo yeri' };
  var ALTLIK_ADI = { ad: 'Proje adı', kod: 'Proje kodu', yapan: 'Hazırlayan', unvan: 'Unvan', firma: 'Firma', tarih: 'Tarih' };
  var SECIMLER = ['cbFider', 'cbGrupElev', 'cbDis', 'cbSeffaf', 'cbOlcu', 'cb3dSaha', 'cbSahaOlcu', 'cbSahaMin'];

  function duz(h) { return String(h == null ? '' : h).replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim(); }
  function sinifAl() { return isOda(S.kosk) ? 'oda' : isBina(S.kosk) ? 'bina' : isPref(S.kosk) ? 'pref' : 'mono'; }
  function tarihYaz(t) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(t || ''); }
  function histSifirla() { HIST_ILK = _snap(); HIST = [HIST_ILK]; HIST_I = 0; histBtnGuncelle(); }
  function kopya(o) { return JSON.parse(JSON.stringify(o)); }
  function acikEksikler() {
    var d = window.__SM && window.__SM.durum;
    return d && d.eksik ? d.eksik.filter(function (x) { return !x.girildi; }) : [];
  }

  /* Köşk tipi metni: telefon "Monoblok köşk · 1x630 kVA", "Prefabrik beton köşk · 2x630 kVA", "Bina tipi trafo …";
     AutoCAD "BK2/BOŞ KÖŞK (4K+1000kVA+PANO) HV İZL", "KB2-H/BOŞ BETON KÖŞK(HÜCRE)", "MOD-5A TR BİNASI" … */
  function tipCoz(tip, A) {
    var n = A.norm(tip), r = { sinif: null, kosk: null, kok: false, tp: false, hucre: null, kva: null, adet: null, desteksiz: false, belirsiz: false }, m;
    if (!n) return r;
    if ((m = n.match(/(\d{2,4})\s*kva/))) r.kva = +m[1];
    if ((m = n.match(/(\d+)\s*x\s*\d{2,4}\s*kva/))) r.adet = +m[1];
    if ((m = n.match(/(\d+)\s*k\s*\+/) || n.match(/\((\d+)\s*k\)/))) r.hucre = +m[1];
    if (/\bsac\b|dapt|indirici|\bkule\b|\bdirek\b|mrmu/.test(n)) { r.desteksiz = true; return r; }
    if (/bina alt|ozel oda|ozel trafo/.test(n)) r.sinif = 'oda';
    else if (/\bmod\b|mod-?\s?\d|binasi|bina tipi/.test(n)) {
      r.sinif = 'bina';
      if ((m = n.match(/mod-?\s?(\d)\s*([ab])?(\s*\+)?/))) {
        var b = 'MOD-' + m[1] + (m[2] ? m[2].toUpperCase() : '');
        if (BINA[b] && !m[3]) r.kosk = b; else r.desteksiz = true;        // MOD-2/3/4 ve MOD-5B+2M araçta yok
      }
    } else if (/prefabri|\bpbk\b|pbk-|kb-p\b|\bek-?\s?1\s*[abc]\b/.test(n)) {
      r.sinif = 'pref';
      if ((m = n.match(/(?:pbk|ek)-?\s?1\s*([abc])\b/))) r.kosk = 'PBK-1' + m[1].toUpperCase();
    } else if (/monoblok|\bmb-?\s?\d{4}|\bbk\s?\d|\bkb\s?\d|beton kosk/.test(n)) {
      r.sinif = 'mono';
      if ((m = n.match(/\bmb-?\s?(\d{4})\b/)) && KOSK['MB-' + m[1]]) r.kosk = 'MB-' + m[1];
    } else if (/kosk/.test(n)) r.belirsiz = true;                         // yalnız "köşk": monoblok mu prefabrik mi belli değil
    if (/\bkok\b|\(hucre\)|hucre\s*\(\d+\s*k\)|trafosuz|kb2-h\b/.test(n)) r.kok = true;
    else if (/\(trafo\s*\+\s*pano\)|kosk trafo\s*\(|kb2-t\b/.test(n)) r.tp = true;
    return r;
  }

  /* Hücre sayıları geldiyse liste: giriş / çıkış HMH 36-01, trafo koruma ≤1250 kVA HMH 36-02 (sigortalı yük ayırıcı),
     1600 kVA ve üstü HMH 36-04T (kesicili) — aracın kendi denetim kuralıyla aynı ayrım. */
  function hucreListesiKur(kva, g, c, k) {
    var L = [], i;
    for (i = 0; i < g; i++) L.push({ c: 'HMH 36-01', f: g > 1 ? 'GİRİŞ-' + (i + 1) : 'GİRİŞ', y: 'g' });
    for (i = 0; i < c; i++) L.push({ c: 'HMH 36-01', f: 'ÇIKIŞ-' + (i + 1), y: 'c' });
    for (i = 0; i < k; i++) L.push({ c: kva >= 1600 ? 'HMH 36-04T' : 'HMH 36-02', f: k > 1 ? 'TRAFO KORUMA-' + (i + 1) : 'TRAFO KORUMA', y: 'c' });
    return L;
  }

  /* Hücreleri sığdıran en kısa monoblok tip (yalnız öneri; seçim kullanıcıya bırakılır) */
  function enKisaMono() {
    var eski = S.kosk, bulunan = null;
    try {
      Object.keys(KOSK).some(function (k) {
        if (!KOSK[k].v[S.varyant]) return false;
        S.kosk = k;
        var L = layout();
        if (L.hasHucre && L.kalan >= 0) { bulunan = k; return true; }
        return false;
      });
    } catch (e) { bulunan = null; }
    S.kosk = eski; applyGeo(S.kosk);
    return bulunan;
  }

  function altlikYaz() {
    if (!ALTLIK || !Object.keys(ALTLIK).length) return;
    var kim = [ALTLIK.yapan || '—', ALTLIK.unvan].filter(Boolean).join(', ');
    var parca = [ALTLIK.ad, ALTLIK.kod, 'Hazırlayan: ' + kim, ALTLIK.firma, ALTLIK.tarih ? tarihYaz(ALTLIK.tarih) : ''].filter(Boolean).join(' · ');
    Array.prototype.forEach.call(document.querySelectorAll('#printPage .foot>span:first-child'), function (s) { s.textContent = parca; });
  }
  function svg2dBosalt() { if (VIEW !== '3d') { var e = document.getElementById('svg2d'); if (e) e.innerHTML = ''; } }
  function yazdirBitti() { if (VIEW !== '3d') setView(VIEW); else draw(); }
  // Aracın kendi "beforeprint → buildPrint" dinleyicisinden SONRA çalışır (kayıt sırası)
  window.addEventListener('beforeprint', function () { try { altlikYaz(); svg2dBosalt(); } catch (e) { /* */ } });
  window.addEventListener('afterprint', function () { try { yazdirBitti(); } catch (e) { /* */ } });
  /* Telefonda yazdırma uygulamaya kopya gönderir (kopru-bas.js) ve beforeprint olayı oluşmaz: araç baskı sayfasını
     (#printPage) o olayda kurduğundan olay burada üretilir. 3B tuvali baskıda gizlidir; resme çevrilip boşuna
     gönderilmesin diye o an küçültülür, sonra yeniden çizilir. Köprü bu olayları kendisi üretmeye başlarsa
     (__SM.yazdirOlayli) bu sarmalayıcı devre dışı kalır. */
  if (window.__SM && window.__SM.ortam === 'telefon' && !window.__SM.yazdirOlayli && typeof window.print === 'function') {
    var asilYazdir = window.print;
    window.print = function () {
      var cv = document.getElementById('c3d');
      try { window.dispatchEvent(new Event('beforeprint')); } catch (e) { /* */ }
      if (cv) { cv.width = 1; cv.height = 1; }
      try { return asilYazdir.apply(window, arguments); }
      finally { try { window.dispatchEvent(new Event('afterprint')); } catch (e) { /* */ } }
    };
  }
  // Telefonda kenar paneli çekmecedir: "Alana git" bir alanı odaklayınca çekmece açılsın
  document.addEventListener('focusin', function (e) {
    var sd = document.getElementById('side');
    if (sd && window.innerWidth <= 820 && e.target && sd.contains(e.target)) sd.classList.add('open');
  });

  window.__SM_UYARLAMA = {
    notlar: [
      'Monoblok köşklerde "Çalışma koridoru" denetimi araçta her zaman "uygun değil" çıkar: iç en 2280 mm − hücre derinliği 1650 mm − arka boşluk en çok 630 mm eder, sınır 800 mm\'dir. Bu yüzden her monoblok köşk "uygun değil" görünür; hücre derinliği (1650 mm) ve bu denetim aracın yazarıyla doğrulanmalıdır.',
      'Her zaman çıkan uyarılar: monoblokta "İç en 2280 mm < 2300 mm" (katalog iç eni); AG bölmeli monoblok tiplerde (MB-3800 ≤1000 kVA dışında) "Seçilen pano derinliği bölmeden büyük" — araç burada pano genişliğini AG bölmesinin boyuyla karşılaştırır; prefabrikte "şartname madde kontrolleri henüz eklenmedi"; özel odada "serbest tasarım".',
      'Yapısal ölçülerdeki "Duvar kalınlığı" ve "Köşk dış eni" ile AG pano bölümündeki "Pano ağırlığı" alanlarına yazılan değerler araç tarafından katalog değerine geri çekilir; hesaba girmez.',
      'Araç açılışta 630 kVA trafonun ağırlığını 2100 kg gösterir (katalogda 2410 kg). Trafo gücü seçilince ya da projeden yazılınca katalog ağırlığı kullanılır. Bilgi satırındaki "Ulusoy bölme genişliği" değeri de aslında trafo ağırlığıdır (kg).',
      'Monoblok köşk en çok 1600 kVA alır (1000 varyantı ≤ 1000 kVA, 1600 varyantı 1250–1600 kVA); 2000 ve 2500 kVA yalnız prefabrik köşk, trafo binası ya da özel odada seçilebilir. Araç listesinde olmayan güçler (ör. 1500 kVA) projeden yazılmaz, elle seçilir.',
      '1600 kVA ve üstü trafoda araç kesicili koruma hücresi olarak yalnız Ulusoy HMH 36-04T\'yi tanır; EVA / EVA+ serisiyle bu koşul sağlanamaz.',
      'Projeden trafo numarası, köşk tipi, trafo gücü, OG gerilimi ve trafo adedi alınır. Köşk boyu (MB tipi), YG hücre sayıları ve hücre tipleri projede yoktur; elle seçilmelidir. Hücre sayıları gelirse giriş ve çıkışlar HMH 36-01, trafo koruma ≤ 1250 kVA\'da HMH 36-02, 1600 kVA ve üstünde HMH 36-04T olarak yazılır.',
      'Yapı sınıfı "MOD tipi trafo binası" ya da "Bina altı özel trafo yeri" ilk kez seçildiğinde araç trafo gücünü 1000 kVA\'ya ve hücre listesini kendi örneğine çeker; projedeki güç ve hücreler yeniden seçilmelidir.',
      'Araç yalnız YG tek hat şeması çizer; AG tek hat şeması, AG çıkış sayısı ve sigorta seçimi bu araçta yoktur. Trafo–AG pano kablosu tablodan yazılır (N2XH).',
      'Köşk boş ağırlığı katalogdan değil, köşk boyuyla orantılı yaklaşık bir formülden hesaplanır (monoblok ≈ 2,95 kg/mm); toplam taşıma ağırlığı yaklaşık değerdir. Trafo binasında bina ağırlığı toplama girmez.',
      'DXF çıktısı yalnız yerleşim planını verir; ön görünüş ve tek hat şeması yazdırılarak alınır. Baskının alt satırına proje adı, kodu, hazırlayan, firma ve tarih Şebeke-M\'den yazılır.'
    ],

    hazir: function () { return typeof refresh === 'function' && typeof layout === 'function' && typeof HIST_ILK === 'string' && !!document.getElementById('checks'); },

    doldur: function (b, A) {
      var r = { dolan: [], eksik: [], uyari: [] };
      if (!b) return r;
      var T = b.trafo || null, P = b.proje || {};
      var ekle = function (alan, deger, birim, yol, ham) { r.dolan.push({ alan: alan, deger: deger, birim: birim || '', yol: yol, ham: ham, kaynak: typeof ham === 'string' ? ham : '' }); };
      var eksik = function (alan, sec, neden) { r.eksik.push({ alan: alan, sec: sec, neden: neden }); };
      var tip = T && T.tip ? String(T.tip) : '';
      var t = tipCoz(tip, A);
      var adet = T && T.adet != null && isFinite(+T.adet) ? +T.adet : null;
      var kva = T && T.gucKVA != null && isFinite(+T.gucKVA) ? +T.gucKVA : null;

      // 1) Yapı sınıfı ve köşk tipi (aracın kendi seçim kutuları)
      if (t.sinif) A.sec('#koskBtns select', t.sinif);
      var koskTip = t.kosk;
      if (!koskTip && t.sinif === 'pref' && adet > 1) {
        koskTip = 'PBK-1B';
        r.uyari.push('İki trafolu prefabrik köşk: iki trafo bölmeli tek tip olan EK-1B (PBK-1B) seçildi.');
      }
      if (koskTip) A.sec('#koskBtns select:last-of-type', koskTip);
      var sinif = sinifAl();
      if (!tip) eksik('Yapı sınıfı ve köşk tipi', '#koskBtns select', 'Projede köşk tipi yok');
      else if (t.desteksiz) {
        eksik('Yapı sınıfı ve köşk tipi', '#koskBtns select', '"' + tip + '" araçtaki tiplerden biri değil');
        r.uyari.push('Köşk tipi "' + tip + '" araçta yok; yapı sınıfını ve tipi elle seçin.');
      } else if (t.belirsiz || !t.sinif) {
        eksik('Yapı sınıfı', '#koskBtns select', 'Köşk tipi metninden monoblok / prefabrik / bina ayrımı yapılamadı');
      } else {
        ekle('Köşk tipi', SINIF_ADI[sinif] + (koskTip ? ' · ' + koskTip : ''), '', 'trafo.tip', tip);
        if (sinif === 'oda') eksik('Oda ölçüleri ve yerleşim', '#oda_x', 'Bina altı trafo yerinin ölçüleri, kapıları ve ekipman yerleşimi projede yok');
        else if (!koskTip) {
          if (sinif === 'mono') eksik('Köşk tipi (boy)', '#koskBtns select:last-of-type', 'Projede köşk boyu (MB tipi) yok');
          else if (sinif === 'pref') eksik('Prefabrik köşk tipi', '#koskBtns select:last-of-type', 'Projede prefabrik tipi (EK-1A / 1B / 1C) yok');
          else eksik('Trafo binası tipi', '#koskBtns select:last-of-type', 'Projede bina tipi (MOD-5 / 5A / 5B) yok');
        }
      }

      // 2) Varyant (monoblok / prefabrik): yalnız hücre (KÖK) ya da trafo gücüne göre — aracın güç aralıkları
      if (t.kok && (sinif === 'mono' || sinif === 'pref')) {
        if (sinif === 'pref' || KOSK[S.kosk].v.KOK) setVaryant('KOK');
        r.uyari.push('Köşk tipi yalnız hücre (KÖK): trafo bölümü yoktur, trafo gücü hesaba girmez.');
      } else if (sinif === 'mono' && kva) {
        var v = kva >= 1250 ? '1600' : '1000';
        if (kva > 1600) r.uyari.push('Monoblok köşk en çok 1600 kVA alır; ' + A.tr(kva) + ' kVA için prefabrik köşk ya da trafo binası seçin.');
        else if (KOSK[S.kosk].v[v]) { if (S.varyant !== v) setVaryant(v); }
        else r.uyari.push(S.kosk + ' tipinde ' + v + ' varyantı yok; köşk tipini değiştirin.');
      }
      if (t.tp) r.uyari.push('Köşk tipi hücresiz (TRAFO + PANO): YG hücre listesi boşaltıldı; hücre bölmesi olmayan bir monoblok tip (MB-2550, MB-3200, MB-3800) seçin.');

      // 3) Trafo gücü ve adedi
      var trafoli = !(t.kok && (sinif === 'mono' || sinif === 'pref'));
      if (trafoli) {
        if (kva == null) eksik('Trafo gücü', '#trafoSel', 'Projede trafo gücü yok');
        else if (!TRAFO.some(function (x) { return x[0] === kva; })) eksik('Trafo gücü', '#trafoSel', 'Projedeki ' + A.tr(kva) + ' kVA araç listesinde yok');
        else if (!gucListesi(S.varyant).some(function (x) { return x[0] === kva; })) eksik('Trafo gücü', '#trafoSel', A.tr(kva) + ' kVA bu köşk tipinde seçilemez');
        else if (A.sec('#trafoSel', String(kva)) != null) ekle('Trafo gücü', kva, 'kVA', 'trafo.gucKVA', T.gucKVA);
        if (kva && t.kva && t.kva !== kva) r.uyari.push('Köşk tipindeki güç (' + A.tr(t.kva) + ' kVA) trafo gücüyle (' + A.tr(kva) + ' kVA) uyuşmuyor.');
        if (adet != null) {
          if (S.kosk === 'PBK-1B') { S.trafoAdet = Math.min(2, Math.max(1, adet)); refresh(); }
          else if (adet > 1) r.uyari.push('Projede ' + adet + ' trafo var; bu köşk tipinde araç tek trafo çizer.');
          ekle('Trafo adedi', adet, 'ad.', 'trafo.adet', T.adet);
        }
      }

      // 4) OG gerilimi (aracın seçenekleri: 31,5 / 33 / 34,5 / 36 kV)
      var kv = T && T.ogKV != null && isFinite(+T.ogKV) ? +T.ogKV : null;
      var kvSec = kv == null ? null : GERILIMLER.filter(function (g) { return Math.abs(+g - kv) < 0.01; })[0];
      if (kvSec && A.sec('#gerSel', kvSec) != null) ekle('Gerilim', +kvSec, 'kV', 'trafo.ogKV', T.ogKV);
      else if (kv != null) eksik('Gerilim (kV)', '#gerSel', 'Projedeki ' + A.tr(kv) + ' kV araçta yok (31,5 / 33 / 34,5 / 36 kV)');
      else eksik('Gerilim (kV)', '#gerSel', 'Projede OG gerilimi yok');

      // 5) TRNO: trafo numarası; yoksa aracın örnek adı yerine "—"
      var no = T && T.no != null && String(T.no).trim() ? String(T.no).trim() : '';
      A.yaz('#prjAd', no || '—');
      if (no) ekle('TRNO (trafo/merkez adı)', no, '', 'trafo.no', T.no);
      else eksik('TRNO (trafo/merkez adı)', '#prjAd', 'Projede trafo numarası yok');

      // 6) YG hücreleri: sayılar projede yoksa aracın listesi kalır ve kullanıcıdan istenir
      var H = T && T.hucreler;
      var hucreSayisi = H && (H.giris != null || H.cikis != null || H.koruma != null);
      if (t.tp) { S.hucreler = []; refresh(); }
      else if (hucreSayisi) {
        var g = Math.max(0, +H.giris || 0), c = Math.max(0, +H.cikis || 0), k = Math.max(0, +H.koruma || 0);
        S.hucreler = hucreListesiKur(S.trafoKva, g, c, k);
        refresh();
        if (H.giris != null) ekle('YG giriş hücresi', g, 'ad.', 'trafo.hucreler.giris', H.giris);
        if (H.cikis != null) ekle('YG çıkış hücresi', c, 'ad.', 'trafo.hucreler.cikis', H.cikis);
        if (H.koruma != null) ekle('Trafo koruma hücresi', k, 'ad.', 'trafo.hucreler.koruma', H.koruma);
        r.uyari.push('Hücre tipleri projede yok: giriş ve çıkışlar HMH 36-01, trafo koruma ' + (S.trafoKva >= 1600 ? 'HMH 36-04T (kesicili)' : 'HMH 36-02 (sigortalı yük ayırıcı)') + ' olarak yazıldı; gerekirse listeden değiştirin.');
        if (t.hucre && t.hucre !== g + c + k) r.uyari.push('Köşk tipinde ' + t.hucre + ' hücre yazıyor; projedeki hücre sayısı ' + (g + c + k) + '.');
        if (sinif === 'mono' && !koskTip && layout().kalan < 0) {
          var oneri = enKisaMono();
          r.uyari.push('Hücreler ' + S.kosk + ' köşke sığmıyor' + (oneri ? '; sığdıran en kısa tip ' + oneri + '.' : '.'));
        }
      } else if (layout().hasHucre || sinif === 'oda') {
        eksik('YG hücre sayıları', '#hucreSel', 'Projede giriş / çıkış / trafo koruma hücre sayıları yok' + (t.hucre ? ' (köşk tipinde ' + t.hucre + ' hücre yazıyor)' : '') + '; listeyi düzenleyin');
      }

      // 7) Baskı alt satırı
      ALTLIK = {};
      Object.keys(ALTLIK_ADI).forEach(function (k) {
        if (P[k] != null && String(P[k]).trim()) { ALTLIK[k] = String(P[k]).trim(); ekle('Baskı alt satırı: ' + ALTLIK_ADI[k].toLocaleLowerCase('tr-TR'), ALTLIK[k], '', 'proje.' + k, P[k]); }
      });
      if (!ALTLIK.yapan) { ALTLIK.yapan = '—'; r.uyari.push('Projede hazırlayan bilgisi yok; baskının alt satırında "—" yazılır.'); }

      resetCam();
      setView(isOda(S.kosk) ? 'plan' : '3d');
      histSifirla();                     // aracın "Geri" ve sıfırlama noktası projeden gelen duruma çekilir
      return r;
    },

    sonuc: function (A) {
      var L = layout(), C = checks(), W = weights();
      var bad = C.filter(function (c) { return c.st === 'bad'; }), warn = C.filter(function (c) { return c.st === 'warn'; });
      var sinif = sinifAl();
      var durum = acikEksikler().length ? 'bilgi' : bad.length ? 'uygun-degil' : (sinif === 'oda' || warn.length) ? 'bilgi' : 'uygun';
      var agirlik = function (onEk) { var x = W.rows.filter(function (s) { return s[0].indexOf(onEk) === 0; })[0]; return x ? x[1] : null; };
      var tipAdi = S.kosk === '__ODA__' ? 'Özel oda' : S.kosk;
      var trno = S.proje && S.proje !== '—' ? S.proje : 'TRNO yok';

      var parca = [trno, tipAdi + ' (' + (VARYANT[S.varyant] || S.varyant) + ')', gucSatiri(), S.hucreler.length + ' YG hücre'];
      if (!L.ozel) parca.push(L.kalan >= 0 ? 'kalan ' + A.tr(L.kalan) + ' mm' : 'aşım ' + A.tr(-L.kalan) + ' mm');
      parca.push((sinif === 'bina' ? 'ekipman ' : 'toplam ') + A.tr(W.tot) + ' kg');
      parca.push(bad.length ? bad.length + ' uygunsuz' : 'uygunsuz yok');
      if (warn.length) parca.push(warn.length + ' uyarı');

      var gi = [];
      var gir = function (ad, deger, birim) { gi.push({ ad: ad, deger: deger, birim: birim || '' }); };
      gir('TRNO (trafo/merkez adı)', S.proje || '—');
      gir('Gerilim', isFinite(+S.gerilim) ? +S.gerilim : S.gerilim, 'kV');
      gir('Yapı sınıfı', SINIF_ADI[sinif]);
      gir('Köşk tipi', tipAdi);
      gir('Varyant', VARYANT[S.varyant] || S.varyant);
      if (L.hasT) {
        gir('Trafo gücü', S.trafoKva, 'kVA');
        gir('Trafo adedi', (L.trAkt && L.trAkt.length) || 1, 'ad.');
        gir('Trafo ağırlığı (bir trafo)', S.trafoKg, 'kg');
      }
      gir('Hücre serisi', HUCRE_SERI[S.hucreSeri] ? HUCRE_SERI[S.hucreSeri].ad : String(S.hucreSeri));
      gir('YG hücreleri', S.hucreler.map(function (o) { return o.c + (o.f ? ' (' + o.f + ')' : ''); }).join(' · ') || '—');
      if (sinif === 'oda') {
        var O = odaRec();
        gir('Oda iç ölçüsü', O.ic.x + ' × ' + O.ic.z, 'mm'); gir('Oda yüksekliği', O.yuk, 'mm'); gir('Duvar', O.duvar, 'mm');
      } else {
        gir('Tank / temel (t)', S.dims.t, 'mm'); gir('İç yükseklik (h)', S.dims.h, 'mm');
        gir('Hücre arkası boşluk', S.dims.arka, 'mm'); gir('Yan duvar boşluğu', S.dims.yan, 'mm');
      }

      var dg = [];
      var deg = function (ad, deger, birim) { if (deger != null && !(typeof deger === 'number' && !isFinite(deger))) dg.push({ ad: ad, deger: deger, birim: birim || '' }); };
      if (sinif !== 'oda') deg('Köşk tipi kodu', S.tipKodu || tipKoduAuto());   // özel odada araç anlamlı tip kodu üretmez
      deg('Dış boy', L.disBoy, 'mm'); deg('Dış en', L.disEn, 'mm'); deg('Dış yükseklik', L.disYuk, 'mm');
      deg('İç boy', L.icBoy, 'mm'); deg('İç en', L.icEn, 'mm');
      if (!L.ozel) {
        deg('Hücre toplam genişliği', L.hucreW, 'mm'); deg('Net hücre yeri', L.kullan, 'mm');
        deg('Kalan mesafe', L.kalan, 'mm'); deg('Çalışma koridoru', L.koridor, 'mm');
      }
      if (L.hasT) { deg('Ray açıklığı', rayAcikligi(S.trafoKva), 'mm'); deg('AG irtibat kablosu', agKablo(S.trafoKva)); }
      if (L.hasT || L.hasAG) { var pr = panoRec(); deg('AG pano', pr[0] + ' · ' + pr[1] + '×' + pr[2] + '×' + pr[3] + ' mm'); }
      deg('Köşk boş ağırlığı', agirlik('Köşk boş ağırlığı'), 'kg');
      deg('YG hücreleri ağırlığı', agirlik('YG hücreleri'), 'kg');
      deg('Trafo ağırlığı', agirlik('Trafo'), 'kg');
      deg('AG pano ağırlığı', agirlik('AG pano'), 'kg');
      deg(sinif === 'bina' ? 'Ekipman ağırlığı (bina hariç)' : 'Toplam taşıma ağırlığı', W.tot, 'kg');
      deg('Uygunsuz denetim', bad.length, 'ad.');
      deg('Uyarı', warn.length, 'ad.');

      var cift = !!L.hucXOn;
      var satirlar = S.hucreler.map(function (o, i) {
        var h = hucreRec(o.c) || [o.c, '', null, null];
        return [i + 1, h[0], h[1], o.f || '', o.y === 'g' ? 'Giriş' : o.y === 'x' ? '—' : 'Çıkış',
          cift && L.on && L.on.indexOf(i) >= 0 ? 2 : 1, h[2], h[3]];
      });
      var uy = [];
      bad.forEach(function (c) { uy.push('Uygun değil: ' + duz(c.txt) + (c.sub ? ' — ' + duz(c.sub) : '')); });
      warn.forEach(function (c) { uy.push('Uyarı: ' + duz(c.txt) + (c.sub ? ' — ' + duz(c.sub) : '')); });

      return {
        ozet: parca.join(' · '),
        durum: durum,
        girdiler: gi,
        degerler: dg,
        tablo: { basliklar: ['No', 'Hücre', 'Tanım', 'Fider adı', 'Yön', 'Sıra', 'Genişlik (mm)', 'Ağırlık (kg)'], satirlar: satirlar },
        uyarilar: uy
      };
    },

    durumAl: function () {
      var secim = {};
      SECIMLER.forEach(function (id) { var e = document.getElementById(id); if (e) secim[id] = !!e.checked; });
      return { surum: 1, S: JSON.parse(_snap()), gorunum: VIEW, secim: secim, altlik: kopya(ALTLIK || {}) };
    },

    /* Geri yükleme: araç kendi kaydını yalnız açılışta düzeltir; burada eksik alanlar aracın açılış durumuyla
       tamamlanır (eksik nesneyle araç çöker), geçersiz tip düzeltilir, "Geri" ve sıfırlama noktası yüklenen
       duruma çekilir (yoksa örnek projeye döner). */
    durumYukle: function (d) {
      var o = d && (d.S || (d.kosk && d.hucreler ? d : null));   // aracın çıplak S nesnesi de kabul edilir
      if (!o) return;
      d = d.S ? d : {};
      var t = VARSAYILAN ? kopya(VARSAYILAN) : {};
      var m = Object.assign(t, o);
      m.dims = Object.assign({}, t.dims || {}, o.dims || {});
      m.saha = Object.assign({}, t.saha || {}, o.saha || {});
      if (!Array.isArray(m.saha.birimler)) m.saha.birimler = [];
      if (!Array.isArray(m.hucreler)) m.hucreler = (VARSAYILAN && VARSAYILAN.hucreler) || [];
      if (!KOSK[m.kosk] && !PKOSK[m.kosk] && !BINA[m.kosk] && m.kosk !== '__ODA__') m.kosk = 'MB-4800';
      if (BINA[m.kosk]) m.varyant = 'BINA';
      else if (PKOSK[m.kosk]) { if (m.varyant !== 'KOK') m.varyant = 'PBK'; }
      else if (m.kosk === '__ODA__') m.varyant = 'ODA';
      else if (!KOSK[m.kosk].v[m.varyant]) m.varyant = Object.keys(KOSK[m.kosk].v)[0];
      _yukle(JSON.stringify(m));
      applyGeo(S.kosk);
      var secim = d.secim || {};
      Object.keys(secim).forEach(function (id) { var e = document.getElementById(id); if (e) e.checked = !!secim[id]; });
      ALTLIK = d.altlik || {};
      refresh();
      var g = d.gorunum || '3d';
      if (isOda(S.kosk)) g = (g === 'yer' ? 'yer' : 'plan');
      else if (g === 'yer') g = 'plan';
      resetCam();
      setView(g);
      histSifirla();
    },

    /* Kayıtlı hesap açılınca bilgi panelinde bağlam yolları yerine alan adları görünsün */
    alanAdlari: function (yol) {
      var a = { 'trafo.no': 'TRNO (trafo/merkez adı)', 'trafo.tip': 'Köşk tipi', 'trafo.gucKVA': 'Trafo gücü', 'trafo.ogKV': 'Gerilim',
        'trafo.adet': 'Trafo adedi', 'trafo.hucreler.giris': 'YG giriş hücresi', 'trafo.hucreler.cikis': 'YG çıkış hücresi',
        'trafo.hucreler.koruma': 'Trafo koruma hücresi' }[yol];
      var m = /^proje\.(\w+)$/.exec(yol || '');
      return a || (m && ALTLIK_ADI[m[1]] ? 'Baskı alt satırı: ' + ALTLIK_ADI[m[1]].toLocaleLowerCase('tr-TR') : null);
    },

    bolumGoster: function (bolum) {
      var v = { tekhat: 'th', th: 'th', gorunus: 'on', on: 'on', plan: 'plan', yerlesim: 'plan', saha: 'saha', '3b': '3d', '3d': '3d' }[String(bolum || '').toLowerCase()];
      if (v) setView(v);
    }
  };
})();
