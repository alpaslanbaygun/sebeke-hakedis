// Bilgisayarda önizleme için sahte Android köprüsü (APK'ya girmez).
// Projeler tarayıcının localStorage'ında tutulur; GNSS konumu örnek projenin çevresinde dolaşır.
(function () {
  'use strict';
  const LS = window.localStorage;
  const K = s => 'mock:' + s;
  const get = (k, d) => { try { const v = LS.getItem(K(k)); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { LS.setItem(K(k), JSON.stringify(v)); } catch (e) { console.warn('mock: depolama dolu', e); } };
  const ok = () => ({ ok: true });

  const state = {
    source: get('source', 'bt'),
    bt: { state: 'on', msg: 'CHCNAV i73 bağlı', device: 'CHCNAV i73', address: '00:11:22:33:44:55' },
    ntrip: { state: 'on', msg: 'TUSAGA-Aktif: düzeltme alınıyor', bytes: '412 kB', host: 'cors.tusaga-aktif.gov.tr', port: 2101, mount: 'VRSRTCM31', user: 'kullanici', pass: '', gga: true, auto: true, configured: true },
    phone: { state: 'off', msg: 'Telefon konumu kapalı', permission: true },
    prefs: { basemap: 'none', autoConfig: false, portLetter: 'C', googleKeyHint: '', yandexKeyHint: '' },
    quality: 4,
    t: 0
  };

  function projeler() { return get('projeler', []); }

  function yeniId() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return 'p' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + String(Date.now() % 1000).padStart(3, '0');
  }

  function create(text, meta) {
    const id = yeniId();
    put('base:' + id, text);
    put('j:' + id, []);
    const m = Object.assign({}, meta, { guncelleme: Date.now() });
    put('meta:' + id, m);
    put('projeler', [id].concat(projeler()));
    return id;
  }

  function demoYukle(cb) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dev/demo.sebeke.json', true);
    xhr.onload = () => cb(xhr.status === 200 ? xhr.responseText : null);
    xhr.onerror = () => cb(null);
    xhr.send();
  }

  function indir(name, mime, text, b64) {
    let blob;
    if (b64) {
      const bin = atob(b64);
      const a = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      blob = new Blob([a], { type: mime });
    } else {
      blob = new Blob([text || ''], { type: mime });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function later(fn, ms) { setTimeout(fn, ms || 300); }
  function emit(type, data) { if (window.App && App.emit) App.emit(type, data); }

  function fix() {
    if (state.source === 'phone' && state.phone.state !== 'on') return { live: false, has: false, kind: 'nodata', label: 'Veri yok', sats: 0 };
    const q = state.quality;
    const ot = window.App && App.oturum;
    const dom = ot && ot.acik() ? ot.dom() : 39;
    const bb = ot && ot.acik() ? ot.kutu : null;
    const SH = window.SH;
    let lat = 38.6745, lon = 39.2235;
    if (SH && bb && dom) {
      const cx = (bb[0] + bb[2]) / 2 + Math.cos(state.t / 40) * (bb[2] - bb[0]) * 0.3;
      const cy = (bb[1] + bb[3]) / 2 + Math.sin(state.t / 40) * (bb[3] - bb[1]) * 0.25;
      [lat, lon] = SH.tmGeri(cx, cy, dom);
    }
    const kind = q === 4 ? 'fixed' : q === 5 ? 'float' : q === 0 ? 'none' : 'auto';
    return {
      live: true, has: q > 0, quality: q, kind, label: { 4: 'Fixed', 5: 'Float', 1: 'Otonom', 0: 'Konum yok' }[q], sats: 21, utc: '10:10:10',
      source: state.source, mock: state.source === 'phone', age: 1.0, hrms: q === 4 ? 0.012 : 0.35, vrms: q === 4 ? 0.018 : 0.6,
      pdop: 1.3, hdop: 0.7, lat, lon, hMsl: 1067.42, hEll: 1103.9, speed: 0.2, bearing: null
    };
  }

  function status() {
    return {
      source: state.source, bt: state.bt, ntrip: state.ntrip, phone: state.phone, autoConfig: state.prefs.autoConfig
    };
  }

  const handlers = {
    'app.init': () => ({ version: '0.2-önizleme', lastProject: get('son', ''), source: state.source }),
    'app.exit': ok,
    toast: a => { if (window.App) App.toast(a.text); return ok(); },
    'projects.list': () => projeler().map(id => Object.assign({ id, bekleyen: get('j:' + id, []).length }, get('meta:' + id, {}))),
    'project.create': a => ({ id: create(a.text, a.meta || {}) }),
    'project.load': a => {
      const base = get('base:' + a.id, null);
      if (base === null) return { error: 'Proje bulunamadı' };
      put('son', a.id);
      return '{"base":' + base + ',"journal":[' + get('j:' + a.id, []).join(',') + ']}';
    },
    'project.patch': a => {
      JSON.parse(a.line);
      const j = get('j:' + a.id, []);
      j.push(a.line);
      put('j:' + a.id, j);
      return ok();
    },
    'project.compact': a => {
      put('base:' + a.id, a.text);
      put('j:' + a.id, []);
      if (a.meta) put('meta:' + a.id, Object.assign({}, a.meta, { guncelleme: Date.now() }));
      return ok();
    },
    'project.meta': a => { put('meta:' + a.id, Object.assign({}, a.meta, { guncelleme: Date.now() })); return ok(); },
    'project.delete': a => {
      put('projeler', projeler().filter(x => x !== a.id));
      ['base:', 'j:', 'meta:'].forEach(k => LS.removeItem(K(k + a.id)));
      if (get('son', '') === a.id) put('son', '');
      return ok();
    },
    'project.close': () => { put('son', ''); return ok(); },
    'project.import': () => {
      demoYukle(text => {
        if (!text) return emit('projectImported', { error: 'Örnek proje alınamadı (önizleme sunucusu çalışıyor mu?)' });
        const p = JSON.parse(text);
        const id = create(text, { ad: p.proje.ad, kaynak: 'demo.sebeke.json', hakedis: p.proje.aktifHakedis, sayilar: { eleman: p.elemanlar.length, hat: p.hatlar.length, kanal: p.kanallar.length, nokta: p.noktalar.length, bolge: p.bolgeler.length } });
        emit('projectImported', { ok: true, id, ad: p.proje.ad });
      });
      return ok();
    },
    'file.save': a => { indir(a.name, a.mime, a.text, a.b64); later(() => emit('saved', { name: a.name })); return ok(); },
    'file.share': a => { indir(a.name, a.mime, a.text, a.b64); return ok(); },
    'photo.take': a => { later(() => emit('photo', { id: a.id, ref: a.ref, file: a.ref + '_' + Date.now() + '.jpg' }), 500); return ok(); },
    'photo.delete': ok,
    'photo.share': () => ok(),
    'source.set': a => {
      state.source = a.source;
      put('source', a.source);
      if (a.source === 'phone') state.phone = { state: 'on', msg: 'Harici uygulamanın konumu alınıyor (sahte konum)', permission: true };
      later(() => emit('status', status()));
      return ok();
    },
    status,
    'bt.devices': () => ({ devices: [
      { name: 'CHCNAV i73', address: '00:11:22:33:44:55', selected: true },
      { name: 'Kolida K1 Pro', address: '00:11:22:33:44:66', selected: false },
      { name: 'Spectra SP60', address: '00:11:22:33:44:77', selected: false }
    ] }),
    'bt.permission': ok, 'bt.enable': ok, 'bt.settings': ok,
    'bt.select': a => { state.bt.device = a.name; state.bt.address = a.address; return status(); },
    'bt.connect': () => {
      state.bt.state = 'connecting';
      state.bt.msg = state.bt.device + ' alıcısına bağlanılıyor…';
      later(() => { state.bt.state = 'on'; state.bt.msg = state.bt.device + ' bağlı'; emit('status', status()); }, 1200);
      return ok();
    },
    'bt.disconnect': () => { state.bt.state = 'off'; state.bt.msg = 'Bağlı değil'; state.ntrip.state = 'off'; later(() => emit('status', status())); return ok(); },
    'ntrip.get': () => state.ntrip,
    'ntrip.save': a => { Object.assign(state.ntrip, a); return ok(); },
    'ntrip.start': () => { state.ntrip.state = 'on'; later(() => emit('status', status())); return ok(); },
    'ntrip.stop': () => { state.ntrip.state = 'off'; later(() => emit('status', status())); return ok(); },
    'ntrip.mounts': () => { later(() => emit('mounts', { mounts: ['VRSRTCM31', 'VRSRTCM32', 'VRSCMR'] }), 600); return ok(); },
    'phone.start': () => { state.phone.state = 'on'; return ok(); },
    'phone.stop': () => { state.phone.state = 'off'; return ok(); },
    'phone.settings': ok, 'dev.settings': ok,
    fix,
    sats: () => [],
    'log.get': () => ['$GNGGA,101010.00,3840.4700,N,03913.4100,E,4,21,0.7,1067.42,M,36.5,M,1.0,0000*5A'],
    'prefs.get': () => Object.assign({ source: state.source }, state.prefs),
    'prefs.set': a => { Object.assign(state.prefs, a); return handlers['prefs.get'](); },
    'map.base': () => ({
      id: state.prefs.basemap,
      providers: [
        { id: 'none', label: 'Yok (yalnız ızgara)', maxZoom: 0, attribution: '', needs: null, ready: true },
        { id: 'osm', label: 'OpenStreetMap', maxZoom: 19, attribution: '© OpenStreetMap katkıcıları', needs: null, ready: true },
        { id: 'g-sat', label: 'Google Uydu', maxZoom: 21, attribution: 'Google', needs: 'google', ready: false },
        { id: 'yandex', label: 'Yandex Harita', maxZoom: 19, attribution: '© Yandex', needs: 'yandex', ready: false }
      ]
    }),
    'map.setBase': a => { state.prefs.basemap = a.id; return handlers['map.base'](); },
    'map.attrib': ok,
    'tiles.info': () => ({ package: 'com.sebekehakedis.mobil', sha1: 'AA:BB:CC' }),
    'tiles.test': ok,
    'open.url': ok
  };

  window.Android = {
    call(method, args) {
      const h = handlers[method];
      if (!h) return JSON.stringify({ error: 'Bilinmeyen işlem: ' + method });
      const r = h(JSON.parse(args || '{}'));
      return typeof r === 'string' ? r : JSON.stringify(r === undefined ? null : r);
    }
  };

  // Saniyede bir konum
  setInterval(() => {
    state.t++;
    if (window.App && App.emit) App.emit('fix', fix());
  }, 1000);

  window.MOCK = state;
})();
