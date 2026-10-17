// Harita (M03) ve alt panelleri: eleman koy (M04), hat (M06), kanal (M07), seçim, taşıma, bölge çizimi.
// Saha kuralları: harita hiç kapanmaz (panel açılınca harita küçülür, nokta panelin üstünde kalır),
// ana düğme sağ altta başparmak altında, tip seçimi tek dokunuş, hat iki dokunuş.
(function () {
  'use strict';
  const { api, set, setAll, toast } = App;
  const SH = window.SH;
  const ot = App.oturum;

  const TURLER = [
    ['AG_DIREK', 'AG Direk'], ['MUSTEREK_DIREK', 'Müşterek'], ['AYD_DIREK', 'Aydınlatma'], ['ENH_DIREK', 'ENH'],
    ['TRAFO_DIREGI', 'Trafo Dir.'], ['TRAFO_MERKEZI', 'Köşk'], ['PANO', 'Pano'], ['BOX', 'Box'], ['EK_MUFU', 'Ek Mufu'],
    ['KOFRE', 'Kofre'], ['NOKTA', 'GPS Noktası']
  ];
  const DURUM_SEG = [['M', 'M'], ['M+M', 'M+M'], ['DM', 'DM'], ['DM+M', 'DM+M'], ['MEVCUT', 'Mevcut']];
  const DM_SEG = [['KESİK', 'Kesik'], ['SÖKÜK', 'Sökük']];
  const KABLOLAR = [['og', 'OG'], ['ag', 'AG'], ['ayd', 'Aydınl.'], ['rek', 'Rekort.']];
  const CHIP = {
    fixed: 'bg-success-container text-on-success-container',
    float: 'bg-warning-container text-on-warning-container',
    bad: 'bg-error-container text-on-error-container',
    map: 'bg-[#E0E7FF] text-[#1E3A8A]'
  };
  const DOT = { fixed: 'bg-success', float: 'bg-[#B45309]', bad: 'bg-error', map: 'bg-[#1E3A8A]' };
  const NAV_ALT = 'calc(72px + env(safe-area-inset-bottom, 0px))';

  const f3 = v => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(3));
  const f2 = v => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(2));

  function koordYazisi(e, n, h) {
    return 'Y ' + f3(e) + ' · X ' + f3(n) + (h === null || h === undefined || !Number.isFinite(h) ? '' : ' · Kot ' + f2(h));
  }

  /** Sondaki sayıyı bir artırır: N9 → N10, SC077 → SC078, A → A1. */
  function sonrakiAd(ad) {
    const m = /^(.*?)(\d+)$/.exec(ad || '');
    if (!m) return (ad || 'N') + '1';
    return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
  }

  function tipAnahtari(it) { return it ? it.cins + '|' + it.tanim : ''; }

  function varsayilanTip(tur) {
    const tipler = SH.anaTipler(ot.katalog, tur);
    for (const k of ot.sonKullanilan('tip:' + tur)) {
      const t = tipler.find(x => tipAnahtari(x) === k);
      if (t) return t;
    }
    return tipler[0] || null;
  }

  function varsayilanKesit(tur) {
    const liste = SH.hatKesitleri(ot.katalog, tur);
    for (const k of ot.sonKullanilan('kesit:' + tur)) {
      const t = liste.find(x => tipAnahtari(x) === k) || ot.katalog.find(x => tipAnahtari(x) === k);
      if (t) return t;
    }
    return liste[0] || null;
  }

  /** Başlangıç elemanından hat türü tahmini. */
  function hatTuruTahmin(e) {
    const son = ot.tercih('hatTur', null);
    if (!e) return son || 'AG_HAVAI';
    switch (e.tur) {
      case 'AYD_DIREK': return 'AYDINLATMA';
      case 'ENH_DIREK': return 'OG_HAVAI';
      case 'BOX': case 'PANO': case 'TRAFO_MERKEZI': case 'EK_MUFU': case 'KOFRE': return son === 'REKORTMAN' ? 'REKORTMAN' : 'AG_YERALTI';
      default: return son && son !== 'OG_HAVAI' && son !== 'OG_YERALTI' ? son : 'AG_HAVAI';
    }
  }

  // ---- Küçük bileşenler ----

  function segKur(s, ad, secenekler, deger, onChange) {
    const host = s.$('[data-seg="' + ad + '"]');
    host.innerHTML = secenekler.map(([v, l]) => '<button type="button" data-v="' + App.esc(v) + '"' + (v === deger ? ' class="on"' : '') + '>' + App.esc(l) + '</button>').join('');
    host.onclick = ev => {
      const b = ev.target.closest('button[data-v]');
      if (!b) return;
      host.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      onChange(b.dataset.v);
    };
  }

  function cipKur(host, items, secili, onSec) {
    host.innerHTML = items.map(([v, l]) => '<button type="button" class="chip' + (v === secili ? ' on' : '') + '" data-v="' + App.esc(v) + '">' + App.esc(l) + '</button>').join('');
    host.onclick = ev => {
      const b = ev.target.closest('button[data-v]');
      if (!b) return;
      host.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
      onSec(b.dataset.v);
    };
    const on = host.querySelector('.chip.on');
    if (on) setTimeout(() => on.scrollIntoView({ inline: 'center', block: 'nearest' }), 0);
  }

  // ---- Panel düzeni ----

  const PANELLER = ['koy', 'hat', 'kanal', 'sec'];

  function panelAc(s, ad, odak) {
    const st = s.state;
    st.panel = ad;
    for (const p of PANELLER) App.show(s, 'panel' + p[0].toUpperCase() + p.slice(1), p === ad);
    App.show(s, 'nav', false);
    App.show(s, 'fablar', false);
    App.show(s, 'son', false);
    yerlesim(s, odak);
  }

  function panelKapat(s) {
    const st = s.state;
    st.panel = null;
    for (const p of PANELLER) App.show(s, 'panel' + p[0].toUpperCase() + p.slice(1), false);
    if (!st.mod) {
      App.show(s, 'nav', true);
      App.show(s, 'fablar', true);
    }
    yerlesim(s);
  }

  /** Harita, açık panelin üstünde kalan alana sığdırılır; odak noktası görünür kalır. */
  function yerlesim(s, odak) {
    const kutu = s.$('[data-map]');
    const panel = s.state.panel ? s.$('[data-panel="' + s.state.panel + '"]') : null;
    const navGizli = !!s.state.mod || !!panel;
    kutu.style.bottom = panel ? panel.offsetHeight + 'px' : navGizli ? '0px' : NAV_ALT;
    requestAnimationFrame(() => {
      if (panel) kutu.style.bottom = panel.offsetHeight + 'px';
      if (odak) s.state.h.merkez(odak[0], odak[1]);
      s.state.h.ciz();
    });
  }

  // ---- Durum şeridi ----

  function serit(s, f) {
    App.telemetry(s, f || { live: false, kind: 'nodata' });
    const k = ot.konumTM;
    let t = '';
    if (f && f.has) {
      if (!ot.dom()) t = 'Koordinat dilimi seçilmedi';
      else if (k && k.e !== null) t = 'Y ' + f2(k.e) + '  X ' + f2(k.n);
    } else {
      t = App.kaynak === 'phone' ? 'Telefon konumu bekleniyor' : 'Alıcıya bağlanmak için dokunun';
    }
    set(s, 'koord', t);
  }

  // ---- M04 Eleman koy ----

  function koyBaslat(s) {
    const st = s.state;
    modBitir(s, true);
    const tur = ot.tercih('tur', 'AG_DIREK');
    st.koy = {
      tur, durum: ot.tercih('durum', 'M'), dmDurum: ot.tercih('dmDurum', 'SÖKÜK'), tip: tur === 'NOKTA' ? null : varsayilanTip(tur),
      gisElle: false, nokta: null, nAd: sonrakiAd(ot.tercih('noktaAd', 'N0')), nKod: ''
    };
    cipKur(s.$('#turler'), TURLER, tur, v => {
      st.koy.tur = v;
      if (v !== 'NOKTA') st.koy.tip = varsayilanTip(v);
      st.koy.gisElle = false;
      koyCiz(s);
    });
    segKur(s, 'kDurum', DURUM_SEG, st.koy.durum, v => { st.koy.durum = v; koyCiz(s); });
    segKur(s, 'kDmDurum', DM_SEG, st.koy.dmDurum, v => { st.koy.dmDurum = v; });
    const gis = s.$('[data-b="kGis"]');
    gis.oninput = () => { st.koy.gisElle = true; };
    olc(s);
    panelAc(s, 'koy', st.koy.nokta && st.koy.nokta.e !== undefined ? [st.koy.nokta.e, st.koy.nokta.n] : null);
    koyCiz(s);
  }

  /** Konumu yakalar: GNSS varsa (gerekirse ortalamayla) ondan, yoksa haritanın ortasındaki artıdan. */
  function olc(s) {
    const st = s.state;
    const k = ot.konumTM;
    const sure = Number(ot.ayar().olcumSuresi) || 0;
    st.ort = null;
    if (k && k.e !== null) {
      st.h.arti(false);
      if (sure > 0) {
        st.ort = { bitis: Date.now() + sure * 1000, sure, e: 0, n: 0, h: 0, hn: 0, say: 0, kind: 'fixed', hrms: 0, f: k.f };
        st.koy.nokta = null;
      } else {
        st.koy.nokta = { e: k.e, n: k.n, h: k.h, kaynak: 'gnss', f: k.f };
      }
      st.h.merkez(k.e, k.n);
    } else {
      st.koy.nokta = { kaynak: 'harita' };
      st.h.arti(true);
      if (!st.uyarildi) {
        st.uyarildi = true;
        toast(ot.dom() ? 'GNSS konumu yok: artıyı noktaya getirip kaydedin' : 'Dilim seçilmedi: nokta haritadaki artıdan alınır');
      }
    }
  }

  function ortalamaEkle(s) {
    const st = s.state;
    const o = st.ort;
    if (!o) return;
    const k = ot.konumTM;
    if (k && k.e !== null) {
      o.e += k.e;
      o.n += k.n;
      if (k.h !== null && k.h !== undefined) { o.h += k.h; o.hn++; }
      o.say++;
      const kind = App.chipKind(k.f.kind);
      if (kind === 'bad' || (kind === 'float' && o.kind === 'fixed')) o.kind = kind;
      if (k.f.hrms > o.hrms) o.hrms = k.f.hrms;
      o.f = k.f;
    }
    if (Date.now() >= o.bitis && o.say > 0) {
      st.koy.nokta = { e: o.e / o.say, n: o.n / o.say, h: o.hn ? o.h / o.hn : null, kaynak: 'gnss', ortalama: o.say, f: Object.assign({}, o.f, { kind: o.kind === 'fixed' ? 'fixed' : o.kind === 'float' ? 'float' : 'auto', hrms: o.hrms }) };
      st.ort = null;
    }
    koyCiz(s);
  }

  function koyCiz(s) {
    const st = s.state;
    const k = st.koy;
    if (!k) return;
    const nokta = k.tur === 'NOKTA';
    App.show(s, 'kEleman', !nokta);
    App.show(s, 'kNokta', nokta);
    App.show(s, 'kDm', !nokta && k.durum === 'DM');
    const chip = s.$('[data-kchip]');
    const dot = s.$('[data-kdot]');
    if (st.ort) {
      const kalan = Math.max(0, Math.ceil((st.ort.bitis - Date.now()) / 1000));
      set(s, 'kKalite', 'Ölçülüyor ' + kalan + ' sn');
      set(s, 'kKoord', st.ort.say + ' epok toplandı…');
      App.swap(chip, CHIP, 'float');
      App.swap(dot, DOT, 'float');
      set(s, 'kOlcDugme', 'Baştan');
    } else if (k.nokta && k.nokta.kaynak === 'gnss') {
      const f = k.nokta.f || {};
      const kind = App.chipKind(f.kind);
      set(s, 'kKalite', App.fixLabel(Object.assign({ live: true, has: true }, f)) + (f.hrms ? ' ±' + (f.hrms < 1 ? f.hrms.toFixed(3) : f.hrms.toFixed(1)) : '') + (k.nokta.ortalama ? ' · ' + k.nokta.ortalama + ' ep.' : ''));
      set(s, 'kKoord', koordYazisi(k.nokta.e, k.nokta.n, k.nokta.h));
      App.swap(chip, CHIP, kind);
      App.swap(dot, DOT, kind);
      set(s, 'kOlcDugme', 'Yeniden');
    } else {
      const [e, n] = st.h.merkezNokta();
      set(s, 'kKalite', 'Harita artısı');
      set(s, 'kKoord', koordYazisi(e, n, null));
      App.swap(chip, CHIP, 'map');
      App.swap(dot, DOT, 'map');
      set(s, 'kOlcDugme', 'GNSS');
    }
    if (!nokta) {
      set(s, 'kTip', k.tip ? k.tip.tanim : 'Seçilmedi — dokunun');
      set(s, 'kTipAlt', k.tip ? (SH.birimler(k.tip.birim)[1] === 'kg' ? SH.tr(k.tip.katsayi, 2) + ' kg' : k.tip.cins) : '');
      if (!k.gisElle) set(s, 'kGis', SH.sonrakiGis(ot.p, k.tur, ot.gisOnEki(), k.tip && k.tip.cins));
      set(s, 'kHak', ot.hakedis());
      set(s, 'kKaydet', SH.elemanTuru(k.tur).ad + ' Kaydet');
    } else {
      if (!App.val(s, 'kNAd')) set(s, 'kNAd', k.nAd);
      set(s, 'kKaydet', 'Noktayı Kaydet');
    }
  }

  async function koyKaydet(s) {
    const st = s.state;
    const k = st.koy;
    if (st.ort) return toast('Ölçüm sürüyor…');
    let e, n, h = null;
    let olcum = null;
    if (k.nokta && k.nokta.kaynak === 'gnss') {
      const f = k.nokta.f || {};
      const a = ot.ayar();
      const sorunlar = [];
      if (a.yalnizFixed && f.kind !== 'fixed') sorunlar.push('Çözüm Fixed değil (' + App.fixLabel(Object.assign({ live: true, has: true }, f)) + ')');
      if (a.enFazlaHata > 0 && f.hrms > a.enFazlaHata) sorunlar.push('Yatay hata ' + f.hrms.toFixed(3) + ' m > ' + a.enFazlaHata + ' m');
      if (sorunlar.length) {
        const v = await App.dialog({ title: 'Ölçüm ölçütü', message: sorunlar.join('\n'), actions: [{ label: 'Yine de Kaydet', value: true }, { label: 'Vazgeç', value: false, main: true }] });
        if (!v) return;
      }
      e = k.nokta.e;
      n = k.nokta.n;
      h = k.nokta.h;
      olcum = { kaynak: f.source === 'phone' ? (f.mock ? 'harici' : 'telefon') : 'alici', cozum: f.label || f.kind, hata: f.hrms === undefined ? null : f.hrms, uydu: f.sats || null, epok: k.nokta.ortalama || 1, zaman: SH.zaman() };
    } else {
      [e, n] = st.h.merkezNokta();
      olcum = { kaynak: 'harita', zaman: SH.zaman() };
    }
    if (k.tur === 'NOKTA') {
      const ad = App.val(s, 'kNAd') || k.nAd;
      const nk = ot.noktaKoy({ ad, kod: App.val(s, 'kNKod'), saga: e, yukari: n, kot: h, olcum });
      ot.tercihYaz('noktaAd', ad);
      ot.tercihYaz('tur', 'NOKTA');
      kaydedildi(s, { k: 'noktalar', id: nk.id }, ad + ' kaydedildi', null);
      return;
    }
    if (!k.tip) {
      toast('Önce tipi seçin');
      return tipSec(s);
    }
    const eleman = ot.elemanKoy({
      tur: k.tur, tip: k.tip, durum: k.durum, hakedis: ot.hakedis(), saga: e, yukari: n, kot: h, gisId: App.val(s, 'kGis'),
      olcum, dmDurum: k.durum === 'DM' ? k.dmDurum : undefined
    });
    ot.sonaEkle('tip:' + k.tur, tipAnahtari(k.tip));
    ot.tercihYaz('tur', k.tur);
    ot.tercihYaz('durum', k.durum);
    if (k.durum === 'DM') ot.tercihYaz('dmDurum', k.dmDurum);
    const onceki = st.sonEleman && ot.nesne('elemanlar', st.sonEleman);
    st.oncekiEleman = onceki && SH.mesafe([onceki.saga, onceki.yukari], [eleman.saga, eleman.yukari]) < 400 ? onceki.id : null;
    st.sonEleman = eleman.id;
    kaydedildi(s, { k: 'elemanlar', id: eleman.id }, (eleman.gisId || SH.elemanTuru(eleman.tur).ad) + ' konuldu · ' + eleman.tip, st.oncekiEleman);
  }

  /** Kayıttan sonra: panel kapanır, üstte "kaydedildi" çubuğu ve gerekirse "hat çek" kısayolu. */
  function kaydedildi(s, sec, mesaj, oncekiId) {
    const st = s.state;
    st.koy = null;
    st.h.arti(false);
    panelKapat(s);
    st.h.secim(sec);
    set(s, 'son', mesaj);
    const onceki = oncekiId && ot.nesne('elemanlar', oncekiId);
    App.show(s, 'sonHat', !!onceki);
    if (onceki) set(s, 'sonHat', (onceki.gisId || 'önceki') + ' → hat');
    App.show(s, 'son', true);
    clearTimeout(st.sonZaman);
    st.sonZaman = setTimeout(() => App.show(s, 'son', false), 12000);
    toast(mesaj, { label: 'Geri Al', run: () => geriAl(s) });
  }

  function tipSec(s) {
    const k = s.state.koy;
    s.state.bekleyen = 'tip';
    App.push('tip-sec', { baslik: 'Tip — ' + SH.elemanTuru(k.tur).ad, liste: 'ana', tur: k.tur, secili: tipAnahtari(k.tip) });
  }

  // ---- M06 Hat ----

  function hatBaslat(s, basId) {
    const st = s.state;
    modBitir(s, true);
    let bas = basId || null;
    if (!bas && st.secim && st.secim.k === 'elemanlar') bas = st.secim.id;
    st.mod = 'hat';
    st.hat = { bas, ara: [], bit: null };
    st.h.secim(null);
    App.show(s, 'fablar', false);
    App.show(s, 'nav', false);
    App.show(s, 'son', false);
    App.show(s, 'adim', true);
    yerlesim(s);
    hatAdim(s);
  }

  function hatAdim(s) {
    const st = s.state;
    const t = st.hat;
    const bas = t.bas && ot.nesne('elemanlar', t.bas);
    set(s, 'adim', bas ? '2/2 Bitiş elemanına dokunun · boş yere dokunmak ara nokta ekler' : '1/2 Başlangıç elemanına dokunun');
    App.show(s, 'adimGeri', !!bas);
    st.h.vurgula(bas ? [bas.id] : null);
    st.h.taslak(bas ? { kose: [[bas.saga, bas.yukari]].concat(t.ara) } : null);
  }

  function hatPanel(s) {
    const st = s.state;
    const t = st.hat;
    const bas = ot.nesne('elemanlar', t.bas);
    const bit = ot.nesne('elemanlar', t.bit);
    t.kose = [[bas.saga, bas.yukari]].concat(t.ara, [[bit.saga, bit.yukari]]);
    t.cizim = SH.uzunluk(t.kose);
    t.tur = t.tur || hatTuruTahmin(bas);
    t.kesit = t.kesit || varsayilanKesit(t.tur);
    t.durum = t.durum || ot.tercih('hatDurum', 'M');
    t.metraj = SH.hatMetraji(t.cizim, t.tur, ot.ayar());
    App.show(s, 'adim', false);
    st.h.vurgula([bas.id, bit.id]);
    st.h.taslak({ kose: t.kose });
    const ad = e => e.gisId || e.tip || SH.elemanTuru(e.tur).kisa;
    set(s, 'hBaslik', ad(bas) + ' → ' + ad(bit));
    cipKur(s.$('#hatTurleri'), SH.HAT_TURLERI.map(x => [x.kod, x.ad]), t.tur, v => {
      t.tur = v;
      t.kesit = varsayilanKesit(v);
      t.metraj = SH.hatMetraji(t.cizim, v, ot.ayar());
      set(s, 'hMetraj', t.metraj);
      hatCiz(s);
    });
    segKur(s, 'hDurum', DURUM_SEG, t.durum, v => { t.durum = v; hatCiz(s); });
    set(s, 'hMetraj', t.metraj);
    s.$('[data-b="hMetraj"]').oninput = () => hatCiz(s);
    hatCiz(s);
    panelAc(s, 'hat', SH.ortaNokta(t.kose));
  }

  function hatCiz(s) {
    const t = s.state.hat;
    if (!t) return;
    const m = SH.sayi(App.val(s, 'hMetraj'));
    t.metraj = Number.isFinite(m) ? m : t.metraj;
    set(s, 'hKesit', t.kesit ? t.kesit.tanim : 'Seçilmedi — dokunun');
    set(s, 'hCizim', t.cizim.toFixed(2) + ' m');
    set(s, 'hEtiket', t.kesit ? SH.hatEtiketi(t.durum, t.kesit.tanim, t.metraj) : '—');
  }

  function hatKaydet(s) {
    const st = s.state;
    const t = st.hat;
    if (!t.kesit) {
      toast('Önce kesiti seçin');
      return kesitSec(s);
    }
    if (!(t.metraj > 0)) return toast('Metrajı girin');
    const h = ot.hatCiz({ tur: t.tur, kesit: t.kesit, durum: t.durum, hakedis: ot.hakedis(), kose: t.kose, metraj: t.metraj, uclar: [t.bas, t.bit] });
    ot.sonaEkle('kesit:' + t.tur, tipAnahtari(t.kesit));
    ot.tercihYaz('hatTur', t.tur);
    ot.tercihYaz('hatDurum', t.durum);
    modBitir(s);
    st.h.secim({ k: 'hatlar', id: h.id });
    toast('Hat kaydedildi · ' + h.etiket, { label: 'Geri Al', run: () => geriAl(s) });
  }

  function kesitSec(s) {
    const t = s.state.hat;
    s.state.bekleyen = 'kesit';
    App.push('tip-sec', { baslik: 'Kesit — ' + SH.hatTuru(t.tur).ad, liste: 'hat', tur: t.tur, secili: tipAnahtari(t.kesit) });
  }

  // ---- M07 Kanal ve bölge çizimi (köşe köşe) ----

  function cokluBaslat(s, mod, ekstra) {
    const st = s.state;
    modBitir(s, true);
    st.mod = mod;
    st.coklu = Object.assign({ kose: [], uclar: [] }, ekstra || {});
    st.h.secim(null);
    st.h.arti(true);
    App.show(s, 'fablar', false);
    App.show(s, 'nav', false);
    App.show(s, 'son', false);
    App.show(s, 'adim', true);
    App.show(s, 'adimDugmeler', true);
    App.show(s, 'araclar', true);
    yerlesim(s);
    cokluAdim(s);
  }

  function cokluAdim(s) {
    const st = s.state;
    const c = st.coklu;
    const n = c.kose.length;
    const ad = st.mod === 'bolge' ? 'Bölge sınırı' : 'Kanal';
    set(s, 'adim', n === 0 ? ad + ': ilk köşeye dokunun (direğe dokunursanız ona bağlanır)' : ad + ': ' + n + ' köşe · ' + SH.uzunluk(c.kose).toFixed(1) + ' m — devam edin ya da Bitir');
    App.show(s, 'adimGeri', n > 0);
    st.h.taslak({ kose: c.kose, kapali: st.mod === 'bolge' && n > 2, renk: st.mod === 'bolge' ? '#1D4ED8' : '#B45309', imlec: () => st.h.merkezNokta() });
  }

  function cokluEkle(s, nokta, eleman) {
    const c = s.state.coklu;
    c.kose.push([nokta[0], nokta[1]]);
    c.uclar.push(eleman ? eleman.gisId || '' : '');
    cokluAdim(s);
  }

  function cokluBitir(s) {
    const st = s.state;
    const c = st.coklu;
    if (st.mod === 'bolge') {
      if (c.kose.length < 3) return toast('Bölge için en az 3 köşe gerekli');
      const id = c.bolge;
      ot.guncelle('bolgeler', id, x => { x.sinir = c.kose.map(q => [SH.temiz(q[0], 4), SH.temiz(q[1], 4)]); }, 'Bölge sınırı çizildi');
      modBitir(s);
      st.h.secim({ k: 'bolgeler', id });
      App.dialog({
        title: 'Bölge sınırı kaydedildi',
        message: 'Nesnelerin bölgeleri yeni sınıra göre yeniden hesaplansın mı?',
        actions: [{ label: 'Hayır', value: false }, { label: 'Yeniden Ata', value: true, main: true }]
      }).then(v => {
        if (!v) return;
        const n = ot.bolgeleriYenidenAta();
        toast(n ? n + ' nesnenin bölgesi değişti' : 'Değişiklik yok');
      });
      return;
    }
    if (c.kose.length < 2) return toast('Kanal için en az 2 köşe gerekli');
    kanalPanel(s);
  }

  function kanalPanel(s) {
    const st = s.state;
    const c = st.coklu;
    const a = ot.ayar();
    c.cizim = SH.uzunluk(c.kose);
    c.kablo = c.kablo || ot.tercih('kablolar', { og: false, ag: true, ayd: false, rek: false });
    c.zemin = c.zemin || ot.tercih('zemin', a.kanalZemin || 'TOPRAK');
    c.durum = c.durum || 'M+M';
    App.show(s, 'adim', false);
    App.show(s, 'adimDugmeler', false);
    st.h.arti(false);
    st.h.taslak({ kose: c.kose, renk: '#B45309' });
    const kb = s.$('#kablolar');
    kb.innerHTML = KABLOLAR.map(([k, l]) => '<button type="button" class="chip justify-center !px-1' + (c.kablo[k] ? ' on' : '') + '" data-k="' + k + '">' + l + '</button>').join('');
    kb.onclick = ev => {
      const b = ev.target.closest('[data-k]');
      if (!b) return;
      c.kablo[b.dataset.k] = !c.kablo[b.dataset.k];
      b.classList.toggle('on', c.kablo[b.dataset.k]);
      kanalCiz(s);
    };
    const zeminler = SH.ZEMINLER.slice();
    if (zeminler.indexOf(c.zemin) < 0) zeminler.unshift(c.zemin);
    cipKur(s.$('#zeminler'), zeminler.map(z => [z, z]), c.zemin, v => { c.zemin = v; });
    segKur(s, 'cDurum', DURUM_SEG, c.durum, v => { c.durum = v; });
    setAll(s, { cAlt: a.kanalAlt, cUst: a.kanalUst, cDer: a.kanalDerinlik, cMetraj: Math.ceil(c.cizim - 1e-6) });
    ['cAlt', 'cUst', 'cDer', 'cMetraj'].forEach(k => { s.$('[data-b="' + k + '"]').oninput = () => kanalCiz(s); });
    kanalCiz(s);
    panelAc(s, 'kanal', SH.ortaNokta(c.kose));
  }

  function kanalCiz(s) {
    const c = s.state.coklu;
    const hacim = SH.kanalHacmi(App.val(s, 'cAlt'), App.val(s, 'cUst'), App.val(s, 'cDer'), App.val(s, 'cMetraj'));
    set(s, 'cHacim', SH.tr(hacim, 2) + ' m³');
    const kod = SH.kanalKodu(c.kablo.og, c.kablo.ag, c.kablo.ayd, c.kablo.rek);
    set(s, 'cBilgi', 'Çizim ' + c.cizim.toFixed(2) + ' m · kanal kodu ' + kod + (kod ? ' (' + SH.kanalKablolari(kod) + ')' : ' — kablo seçin'));
  }

  function kanalKaydet(s) {
    const st = s.state;
    const c = st.coklu;
    if (!SH.kanalKodu(c.kablo.og, c.kablo.ag, c.kablo.ayd, c.kablo.rek)) return toast('Kanaldaki kabloları seçin');
    const metraj = SH.sayi(App.val(s, 'cMetraj'));
    if (!(metraj > 0)) return toast('Metrajı girin');
    // Varsayılanlar önce kaydedilir: "Geri Al" kanalın kendisini geri alsın.
    ot.ayarKaydet({ kanalAlt: SH.sayi(App.val(s, 'cAlt')), kanalUst: SH.sayi(App.val(s, 'cUst')), kanalDerinlik: SH.sayi(App.val(s, 'cDer')), kanalZemin: c.zemin });
    const kn = ot.kanalCiz({
      og: c.kablo.og, ag: c.kablo.ag, ayd: c.kablo.ayd, rek: c.kablo.rek, zemin: c.zemin, alt: App.val(s, 'cAlt'), ust: App.val(s, 'cUst'),
      derinlik: App.val(s, 'cDer'), durum: c.durum, hakedis: ot.hakedis(), kose: c.kose, metraj,
      basNo: c.uclar[0] || '', bitNo: c.uclar[c.uclar.length - 1] || ''
    });
    ot.tercihYaz('kablolar', c.kablo);
    ot.tercihYaz('zemin', c.zemin);
    modBitir(s);
    st.h.secim({ k: 'kanallar', id: kn.id });
    toast('Kanal kaydedildi · ' + SH.tr(kn.kalemler[0].toplam, 2) + ' m³', { label: 'Geri Al', run: () => geriAl(s) });
  }

  // ---- Taşıma ----

  function tasiBaslat(s, id) {
    const st = s.state;
    modBitir(s, true);
    st.mod = 'tasi';
    st.tasi = id;
    st.h.secim({ k: 'elemanlar', id });
    st.h.arti(true);
    App.show(s, 'fablar', false);
    App.show(s, 'nav', false);
    App.show(s, 'adim', true);
    App.show(s, 'adimGeri', false);
    App.show(s, 'adimDugmeler', true);
    s.$('[data-a="bitir"]').hidden = true;
    const e = ot.nesne('elemanlar', id);
    set(s, 'adim', (e.gisId || 'Eleman') + ' taşınacak: konumunuza ya da artıya');
    yerlesim(s);
  }

  // ---- Seçim ----

  function secimPanel(s, sec) {
    const st = s.state;
    st.secim = sec;
    st.h.secim(sec);
    if (!sec) return panelKapat(s);
    const o = ot.nesne(sec.k, sec.id);
    if (!o) return panelKapat(s);
    const b = ot.nesne('bolgeler', o.bolge);
    const rozet = s.$('[data-rozet]');
    const durum = o.durum || '';
    rozet.className = 'rozet ' + (durum ? 'rozet-' + durum.replace(/\+/g, 'M').replace('MMM', 'MM') : '');
    rozet.textContent = durum === 'MEVCUT' ? 'Mevcut' : durum;
    rozet.hidden = !durum;
    let baslik = '', alt = '', bilgi = '';
    const eylemler = [];
    if (sec.k === 'elemanlar') {
      baslik = SH.elemanTuru(o.tur).ad + (o.gisId ? ' ' + o.gisId : '');
      alt = o.tip + ' · H' + o.hakedis + (o.dmDurum ? ' · ' + o.dmDurum : '');
      bilgi = koordYazisi(o.saga, o.yukari, o.kot || null) + ' · ' + o.kalemler.length + ' kalem' + (b ? ' · ' + (b.kod || b.ad) : '');
      eylemler.push(['ayrinti', 'info', 'Ayrıntı'], ['hatCek', 'timeline', 'Hat çek'], ['tasi', 'open_with', 'Taşı'], ['sil', 'delete', 'Sil']);
    } else if (sec.k === 'hatlar') {
      const kl = o.kalemler.find(x => x.kaynak === 'HAT') || o.kalemler[0] || {};
      baslik = SH.hatTuru(o.tur).ad + ' · ' + (o.anaKesit || '');
      alt = (o.etiket || '') + ' · H' + o.hakedis;
      bilgi = 'Çizim ' + SH.uzunluk(o.kose).toFixed(2) + ' m · metraj ' + SH.tr(kl.miktar, 2) + ' m' + (b ? ' · ' + (b.kod || b.ad) : '');
      eylemler.push(['ayrinti', 'info', 'Ayrıntı'], ['sil', 'delete', 'Sil']);
    } else if (sec.k === 'kanallar') {
      const kl = o.kalemler.find(x => x.ana) || {};
      baslik = 'Kanal · ' + SH.kanalKablolari(o.kod);
      alt = o.zemin + ' · ' + o.altGenislik + '/' + o.ustGenislik + ' × ' + o.derinlik + ' cm · H' + o.hakedis;
      bilgi = SH.tr(kl.miktar, 2) + ' m · ' + SH.tr(kl.toplam, 2) + ' m³' + (o.basNo || o.bitNo ? ' · ' + o.basNo + ' → ' + o.bitNo : '');
      eylemler.push(['ayrinti', 'info', 'Ayrıntı'], ['sil', 'delete', 'Sil']);
    } else if (sec.k === 'sondajlar') {
      baslik = 'Yatay sondaj · ' + o.tip;
      alt = 'H' + o.hakedis;
      bilgi = SH.uzunluk(o.kose).toFixed(2) + ' m';
      eylemler.push(['ayrinti', 'info', 'Ayrıntı'], ['sil', 'delete', 'Sil']);
    } else if (sec.k === 'noktalar') {
      baslik = 'GPS noktası ' + o.ad;
      alt = (o.kod || 'kodsuz') + ' · H' + o.hakedis;
      bilgi = koordYazisi(o.saga, o.yukari, o.kot || null);
      eylemler.push(['ayrinti', 'edit', 'Düzenle'], ['sil', 'delete', 'Sil']);
    } else if (sec.k === 'bolgeler') {
      baslik = o.ad || '(adsız bölge)';
      alt = o.kod || 'kodsuz';
      bilgi = o.sinir && o.sinir.length > 2 ? SH.tr(SH.alan(o.sinir) / 10000, 2) + ' ha' : 'sınır yok';
      eylemler.push(['bolgeDuzenle', 'edit', 'Ad / kod'], ['bolgeCiz', 'polyline', 'Sınır çiz']);
    }
    setAll(s, { sBaslik: baslik, sAlt: alt, sBilgi: bilgi });
    s.$('#secEylemler').innerHTML = eylemler.map(([a, i, l]) =>
      '<button data-a="' + a + '" class="flex flex-col items-center justify-center gap-1 min-h-[64px] rounded-xl bg-surface-container-low active:bg-surface-container ' + (a === 'sil' ? 'text-[#B3261E]' : 'text-primary-container') + '">' +
      '<span class="material-symbols-outlined">' + i + '</span><span class="text-label-md font-label-md">' + l + '</span></button>').join('');
    const odak = sec.k === 'elemanlar' || sec.k === 'noktalar' ? [o.saga, o.yukari] : null;
    panelAc(s, 'sec', null);
    if (odak) {
      // Seçilen nesne panelin altında kalmasın
      requestAnimationFrame(() => {
        const [x, y] = st.h.ekran(odak[0], odak[1]);
        const { W, H } = st.h.boyut();
        if (x < 30 || y < 30 || x > W - 30 || y > H - 30) st.h.merkez(odak[0], odak[1]);
      });
    }
  }

  // ---- Mod yönetimi ----

  function modBitir(s, sessiz) {
    const st = s.state;
    st.mod = null;
    st.hat = null;
    st.coklu = null;
    st.tasi = null;
    st.ort = null;
    if (st.h) {
      st.h.taslak(null);
      st.h.vurgula(null);
      st.h.arti(false);
    }
    App.show(s, 'adim', false);
    App.show(s, 'adimDugmeler', false);
    const bitir = s.$('[data-a="bitir"]');
    if (bitir) bitir.hidden = false;
    App.show(s, 'araclar', true);
    if (!sessiz) panelKapat(s);
    else {
      st.panel = null;
      for (const p of PANELLER) App.show(s, 'panel' + p[0].toUpperCase() + p.slice(1), false);
      App.show(s, 'nav', true);
      App.show(s, 'fablar', true);
      yerlesim(s);
    }
  }

  function geriAl(s) {
    const m = ot.geriAl();
    toast(m ? 'Geri alındı: ' + m : 'Geri alınacak işlem yok');
    if (s.state.secim && !ot.nesne(s.state.secim.k, s.state.secim.id)) secimPanel(s, null);
  }

  // ---- Dokunma ----

  function dokun(s, hit, w) {
    const st = s.state;
    if (st.mod === 'hat') {
      const t = st.hat;
      if (hit && hit.k === 'elemanlar') {
        if (!t.bas) {
          t.bas = hit.id;
          hatAdim(s);
        } else if (hit.id !== t.bas) {
          t.bit = hit.id;
          hatPanel(s);
        }
      } else if (t.bas && !st.panel) {
        t.ara.push([w[0], w[1]]);
        hatAdim(s);
      }
      return;
    }
    if (st.mod === 'kanal' || st.mod === 'bolge') {
      if (st.panel) return;
      const e = hit && hit.k === 'elemanlar' ? ot.nesne('elemanlar', hit.id) : null;
      cokluEkle(s, e ? [e.saga, e.yukari] : w, e);
      return;
    }
    if (st.mod === 'tasi') return;
    if (st.panel === 'koy') {
      // Panel açıkken haritaya dokunmak artıyı oraya getirir (harita kaynağında)
      if (st.koy && st.koy.nokta && st.koy.nokta.kaynak === 'harita') {
        st.h.merkez(w[0], w[1]);
        koyCiz(s);
      }
      return;
    }
    if (st.panel === 'hat' || st.panel === 'kanal') return;
    secimPanel(s, hit);
  }

  // ---- Ekran ----

  function baslat(s) {
    const st = s.state;
    st.h = window.Harita.olustur(s.$('[data-map]'), {
      dokun: (hit, w) => dokun(s, hit, w),
      degisti: () => {
        if (st.koy && st.koy.nokta && st.koy.nokta.kaynak === 'harita') {
          const [e, n] = st.h.merkezNokta();
          set(s, 'kKoord', koordYazisi(e, n, null));
        }
        App.swap(s.$('[data-izle]'), { on: 'on', off: '' }, st.h.v.takip ? 'on' : 'off');
      }
    });
    const b = api('map.base');
    if (b && b.providers) st.h.altlik(b);
    const odak = s.params.odak;
    if (odak) {
      const o = ot.nesne(odak.k, odak.id);
      const kose = o && (odak.k === 'bolgeler' ? o.sinir : o.kose);
      if (kose && kose.length) st.h.fit(SH.kutu(kose), 0.7);
      else if (o && o.saga !== undefined) st.h.merkez(o.saga, o.yukari, 120);
      setTimeout(() => secimPanel(s, odak), 50);
    } else {
      const v = ot.tercih('gorunum:' + ot.id, null);
      if (v) {
        st.h.v.cx = v[0];
        st.h.v.cy = v[1];
        st.h.v.k = v[2];
      }
    }
    if (s.params.mod === 'bolge') cokluBaslat(s, 'bolge', { bolge: s.params.bolge });
  }

  function yenile(s) {
    if (!ot.acik()) return App.root('projeler');
    setAll(s, { ad: ot.p.proje.ad, hak: ot.hakedis() });
    s.$('[data-a="geriAl"]').disabled = !ot.geriAlinabilir();
    serit(s, App.fix);
    s.state.h.ciz();
  }

  App.screen('harita', {
    mount(s) {
      if (!ot.acik()) return App.root('projeler');
      baslat(s);
      yenile(s);
      if (!ot.dom() && ot.kutu === null && App.fix && App.fix.has) App.domKontrol(false);
    },
    resume(s) {
      const r = App.takeResult(s);
      const st = s.state;
      if (r && r.tip && st.bekleyen === 'tip' && st.koy) {
        st.koy.tip = r.tip;
        st.koy.gisElle = false;
        koyCiz(s);
      } else if (r && r.tip && st.bekleyen === 'kesit' && st.hat) {
        st.hat.kesit = r.tip;
        hatCiz(s);
      }
      st.bekleyen = null;
      yenile(s);
      if (st.panel === 'sec') secimPanel(s, st.secim);
      yerlesim(s);
    },
    pause(s) {
      const v = s.state.h.v;
      if (v.cx !== null) ot.tercihYaz('gorunum:' + ot.id, [v.cx, v.cy, v.k]);
    },
    leave(s) {
      const v = s.state.h.v;
      if (v.cx !== null && ot.id) ot.tercihYaz('gorunum:' + ot.id, [v.cx, v.cy, v.k]);
      clearTimeout(s.state.sonZaman);
      s.state.h.kapat();
    },
    fix(s, f) {
      serit(s, f);
      if (s.state.ort) ortalamaEkle(s);
      s.state.h.ciz();
    },
    back(s) {
      const st = s.state;
      if (st.mod) {
        modBitir(s);
        return true;
      }
      if (st.panel) {
        if (st.panel === 'koy') st.koy = null;
        st.h.arti(false);
        if (st.panel === 'sec') st.h.secim(null);
        panelKapat(s);
        return true;
      }
      App.root('ana');
      return true;
    },
    event(s, type, d) {
      if (type === 'veri') {
        yenile(s);
        if (s.state.panel === 'sec') secimPanel(s, s.state.secim);
      } else if (type === 'attrib') s.state.h.attrib(d);
      else if (type === 'status') serit(s, App.fix);
    },
    actions: {
      proje() { App.root('ana'); },
      konum() { App.push('konum'); },
      geriAl(s) { geriAl(s); },
      async menu(s) {
        const h = s.state.h;
        const v = await App.dialog({
          title: 'Harita',
          items: [
            { label: 'Katmanlar', value: 'katman', icon: 'layers' },
            { label: 'Harita altlığı', sub: (h.altlikBilgi() || {}).id === 'none' ? 'Yok' : 'Uydu / yol haritası', value: 'altlik', icon: 'map' },
            { label: 'Renklerin anlamı', value: 'lejant', icon: 'info' },
            { label: 'Koordinat dilimi', sub: ot.dom() ? 'TM ' + ot.dom() + '°' : 'Seçilmedi', value: 'dom', icon: 'public' },
            { label: 'Hakediş Özeti', value: 'ozet', icon: 'receipt_long' }
          ]
        });
        if (v === 'katman') App.globals.katmanlar(s);
        else if (v === 'altlik') altlikSec(s);
        else if (v === 'lejant') lejant();
        else if (v === 'dom') { await App.domKontrol(true); yenile(s); }
        else if (v === 'ozet') App.root('ozet');
      },
      katmanlar(s) { App.globals.katmanlar(s); },
      izle(s) {
        const k = ot.konumTM;
        if (!k || k.e === null) return toast('Konum yok');
        const on = s.state.h.takip();
        toast(on ? 'Konum izleniyor' : 'Konum izleme kapalı');
      },
      tumu(s) { s.state.h.tumu(); },
      async hakedis(s) {
        if (await App.hakedisSec()) {
          yenile(s);
          if (s.state.koy) koyCiz(s);
        }
      },
      koy(s) { koyBaslat(s); },
      hat(s) { hatBaslat(s); },
      kanal(s) { cokluBaslat(s, 'kanal'); },
      tipSec(s) { tipSec(s); },
      kesitSec(s) { kesitSec(s); },
      yenidenOlc(s) {
        const st = s.state;
        if (st.koy && st.koy.nokta && st.koy.nokta.kaynak === 'harita' && !(ot.konumTM && ot.konumTM.e !== null)) {
          toast('GNSS konumu yok');
          return;
        }
        olc(s);
        koyCiz(s);
      },
      koyKaydet(s) { koyKaydet(s); },
      panelKapat(s) {
        s.state.koy = null;
        s.state.ort = null;
        s.state.h.arti(false);
        panelKapat(s);
      },
      hatKaydet(s) { hatKaydet(s); },
      kanalKaydet(s) { kanalKaydet(s); },
      iptal(s) { modBitir(s); },
      adimGeri(s) {
        const st = s.state;
        if (st.mod === 'hat') {
          if (st.hat.ara.length) st.hat.ara.pop();
          else st.hat.bas = null;
          hatAdim(s);
        } else if (st.coklu) {
          st.coklu.kose.pop();
          st.coklu.uclar.pop();
          cokluAdim(s);
        }
      },
      konumdanEkle(s) {
        const k = ot.konumTM;
        if (!k || k.e === null) return toast('GNSS konumu yok');
        if (s.state.mod === 'tasi') return tasiBitir(s, [k.e, k.n], k.h);
        cokluEkle(s, [k.e, k.n], null);
      },
      merkezdenEkle(s) {
        const w = s.state.h.merkezNokta();
        if (s.state.mod === 'tasi') return tasiBitir(s, w, null);
        cokluEkle(s, w, null);
      },
      bitir(s) { cokluBitir(s); },
      sonKapat(s) { App.show(s, 'son', false); },
      sonHat(s) {
        const st = s.state;
        App.show(s, 'son', false);
        if (!st.oncekiEleman || !st.sonEleman) return;
        hatBaslat(s, st.oncekiEleman);
        st.hat.bit = st.sonEleman;
        hatPanel(s);
      },
      ayrinti(s) {
        const sec = s.state.secim;
        if (!sec) return;
        if (sec.k === 'noktalar') return noktaDuzenle(s, sec.id);
        App.push('nesne', { k: sec.k, id: sec.id });
      },
      hatCek(s) {
        const sec = s.state.secim;
        if (sec && sec.k === 'elemanlar') hatBaslat(s, sec.id);
      },
      tasi(s) {
        const sec = s.state.secim;
        if (sec && sec.k === 'elemanlar') tasiBaslat(s, sec.id);
      },
      async sil(s) {
        const sec = s.state.secim;
        if (!sec) return;
        const baslik = s.$('[data-b="sBaslik"]').textContent;
        if (!(await App.confirmDanger('Sil', baslik + ' silinsin mi? (Geri Al ile geri getirilebilir)', 'Sil'))) return;
        ot.nesneSil(sec.k, sec.id);
        secimPanel(s, null);
        toast('Silindi', { label: 'Geri Al', run: () => geriAl(s) });
      },
      async bolgeDuzenle(s) {
        const sec = s.state.secim;
        const b = ot.nesne('bolgeler', sec.id);
        const r = await App.dialog({
          title: 'Bölge',
          fields: [{ key: 'ad', label: 'Proje adı', value: b.ad }, { key: 'kod', label: 'Proje kodu', value: b.kod, mode: 'decimal' }],
          actions: [{ label: 'Vazgeç', value: null }, { label: 'Kaydet', value: 'ok', main: true }]
        });
        if (r && r.ok) ot.guncelle('bolgeler', b.id, x => { x.ad = r.values.ad.trim(); x.kod = r.values.kod.trim(); }, 'Bölge düzenlendi');
      },
      bolgeCiz(s) {
        const sec = s.state.secim;
        cokluBaslat(s, 'bolge', { bolge: sec.id });
      }
    }
  });

  function tasiBitir(s, w, kot) {
    const st = s.state;
    const id = st.tasi;
    ot.elemanTasi(id, w[0], w[1], kot);
    modBitir(s);
    secimPanel(s, { k: 'elemanlar', id });
    toast('Taşındı', { label: 'Geri Al', run: () => geriAl(s) });
  }

  async function noktaDuzenle(s, id) {
    const n = ot.nesne('noktalar', id);
    const r = await App.dialog({
      title: 'GPS noktası',
      fields: [{ key: 'ad', label: 'Ad', value: n.ad }, { key: 'kod', label: 'Kod / açıklama', value: n.kod }],
      actions: [{ label: 'Vazgeç', value: null }, { label: 'Kaydet', value: 'ok', main: true }]
    });
    if (r && r.ok) ot.guncelle('noktalar', id, x => { x.ad = r.values.ad.trim(); x.kod = r.values.kod.trim(); }, 'Nokta düzenlendi');
  }

  async function altlikSec(s) {
    const b = api('map.base');
    const items = b.providers.map(p => ({
      label: p.label,
      sub: p.needs && !p.ready ? 'API anahtarı gerekli (Ayarlar › Harita altlığı)' : p.id === 'osm' ? 'Anahtarsız · bakılan yerler telefonda saklanır' : p.id === 'none' ? 'Yalnız ızgara' : '',
      value: p.id,
      icon: p.id === b.id ? 'radio_button_checked' : 'radio_button_unchecked'
    }));
    const id = await App.dialog({ title: 'Harita altlığı', items });
    if (!id) return;
    const p = b.providers.find(x => x.id === id);
    if (p.needs && !p.ready) {
      const go = await App.dialog({ title: p.label, message: 'Bu altlık yalnız kendi API anahtarınızla kullanılabilir. Anahtarı Ayarlar › Harita altlığı bölümüne girin.', actions: [{ label: 'Vazgeç', value: false }, { label: 'Ayarlara Git', value: true, main: true }] });
      if (go) App.push('ayarlar');
      return;
    }
    const nb = api('map.setBase', { id });
    if (nb.error) toast(nb.error);
    s.state.h.altlik(nb);
    if (!ot.dom() && id !== 'none') toast('Altlık için koordinat dilimini seçin');
  }

  function lejant() {
    const R = window.Harita.DURUM_RENK;
    const H = window.Harita.HAT_RENK;
    const sat = (renk, ad, sekil) => '<tr><td><span style="display:inline-block;width:14px;height:14px;background:' + renk + ';border-radius:' + (sekil === 'kare' ? '2px' : '50%') + ';vertical-align:middle"></span></td><td style="text-align:left">' + ad + '</td></tr>';
    const cizgi = (renk, ad, kesik) => '<tr><td><span style="display:inline-block;width:28px;height:0;border-top:3px ' + (kesik ? 'dashed' : 'solid') + ' ' + renk + ';vertical-align:middle"></span></td><td style="text-align:left">' + ad + '</td></tr>';
    const html = '<table><tr><th colspan="2" style="text-align:left">Elemanlar (renk: durum)</th></tr>' +
      sat(R.M, 'Montaj (M)') + sat(R['M+M'], 'Malzeme + montaj (M+M)') + sat(R.DM, 'Demontaj (DM)') + sat(R['DM+M'], 'Sök-tak (DM+M)') + sat(R.MEVCUT, 'Mevcut') +
      '<tr><td>●</td><td style="text-align:left">direk · ■ box, pano, köşk · ▲ trafo direği · ◆ mufu, kofre</td></tr>' +
      '<tr><th colspan="2" style="text-align:left">Hatlar (renk: tür)</th></tr>' +
      cizgi(H.AG_HAVAI, 'AG havai') + cizgi(H.AG_YERALTI, 'AG yeraltı') + cizgi(H.AYDINLATMA, 'Aydınlatma') + cizgi(H.OG_HAVAI, 'OG havai') +
      cizgi(H.OG_YERALTI, 'OG yeraltı') + cizgi(H.REKORTMAN, 'Rekortman') + cizgi('#9CA3AF', 'Mevcut hat') + cizgi('#1D4ED8', 'Demontaj (kesik çizgi)', true) +
      '<tr><td><span style="display:inline-block;width:28px;height:8px;background:rgba(180,83,9,.45);vertical-align:middle"></span></td><td style="text-align:left">Kablo kanalı</td></tr>' +
      cizgi('#7C3AED', 'Yatay sondaj', true) + cizgi('rgba(37,99,235,.75)', 'Bölge sınırı', true) + '</table>';
    App.dialog({ title: 'Renklerin anlamı', html, actions: [{ label: 'Tamam', value: true, main: true }] });
  }

  App.globals.katmanlar = async function (s) {
    const h = s.state.h;
    const L = [['bolge', 'Bölgeler'], ['eleman', 'Elemanlar'], ['hat', 'Hatlar'], ['kanal', 'Kanal ve sondaj'], ['nokta', 'GPS noktaları'], ['etiket', 'Etiketler (GIS no)'],
      ['yalnizHakedis', 'Yalnız aktif hakediş belirgin']];
    const r = await App.dialog({
      title: 'Katmanlar',
      checks: L.map(([k, l]) => ({ label: l, on: h.katman(k) })),
      actions: [{ label: 'Vazgeç', value: null }, { label: 'Uygula', value: 'ok', main: true }]
    });
    if (!r || !r.ok) return;
    L.forEach(([k], i) => h.katman(k, r.checks[i]));
  };
})();
