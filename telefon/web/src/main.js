// Uygulama başlatıcı: offline veritabanı, standart paketi, servisler, arayüz.
import { render } from 'preact';
import { html } from './ui/kit.js';
import { app } from './ui/ctx.js';
import { App } from './ui/app.js';
import { bus } from './core/bus.js';
import { IDBAdapter, MemoryAdapter } from './core/db.js';
import { DataService } from './core/data-service.js';
import { importStandard, upgradeStandard, SEED_REV } from './core/standards.js';
import { uuid4 } from './core/ids.js';
import { GnssService } from './gnss/gnss-service.js';
import { ProjectService } from './services/project-service.js';
import { bridge } from './native/bridge.js';
import { wireRawLog } from './ui/services.js';
import { isWeb, capability, installWebBridge, probeTiles } from './web/platform.js';
import { CloudAdapter } from './web/cloud-adapter.js';
import './ui/theme.css';

const splash = (t) => { const el = document.getElementById('splash-msg'); if (el) el.textContent = t; };

async function boot() {
  try {
    const WEB = isWeb();
    let db = null, cloud = null;
    if (WEB) {
      // Web (ofis) sürümü: veriler bulutta, her bilgisayardan aynı; bulut yoksa yalnız bu tarayıcıda
      document.documentElement.classList.add('web');
      installWebBridge(bridge);
      let local = null;
      try { local = await new IDBAdapter(indexedDB).open(); } catch (e) { /* tarayıcı deposu kapalı */ }
      splash('Bulut verisi açılıyor…');
      const cdb = await capability('db');
      // Bulut var ama okunamadıysa yerel kopyayla devam edilmez (iki ayrı veri oluşmasın): hata gösterilir
      if (cdb) { try { cloud = await new CloudAdapter(cdb, { local }).open(); db = cloud; } catch (e) { console.warn('Bulut açılamadı', e); throw new Error('Bulut verisi okunamadı (' + ((e && (e.code || e.message)) || 'bağlantı') + '). Sayfayı yenileyip yeniden deneyin.'); } }
      if (!db) db = local || await new MemoryAdapter().open();
      app.web = true; app.cloud = cloud; app.state.cloudless = !cloud;
    } else {
      splash('Veritabanı açılıyor…');
      db = await new IDBAdapter(indexedDB).open();
    }
    let dev = await db.get('settings', 'deviceId');
    if (!dev) { dev = { id: 'deviceId', value: (WEB ? 'WEB-' : 'DEV-') + uuid4().slice(0, 8).toUpperCase() }; await db.put('settings', dev); }
    const user = ((await db.get('settings', 'user')) || {}).value || { id: 'u-' + dev.value, name: WEB ? 'Ofis' : 'Saha Operatörü', role: WEB ? 'engineer' : 'operator' };
    const ds = new DataService(db, { bus, user, deviceId: dev.value });
    if (!(await db.count('standards'))) {
      splash('TEDAŞ 2026 · Yeşil Defter 26.23.GR.02 yükleniyor…');
      const pkg = await (await fetch('seed/standard-tedas-2026.json')).json();
      const imp = () => importStandard(ds, pkg, { reason: 'İlk kurulum · standart paketi' });
      if (cloud) await cloud.seed(imp); else await imp();
    } else {
      // Uygulama güncellendiyse katalogdaki yeni kalemleri ekle (mevcut kayıtlara dokunmaz)
      const stds = await db.getAll('standards');
      if (stds.some((x) => x.id === 'TEDAS-2026-GR02' && (x.seedRev || 0) < SEED_REV)) {
        splash('Katalog güncelleniyor…');
        try { const pkg = await (await fetch('seed/standard-tedas-2026.json')).json(); await upgradeStandard(ds, pkg); } catch (e) { console.warn('Katalog güncellenemedi', e); }
      }
    }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* */ }
    const gnss = new GnssService({ bus, bridge });
    const ant = await ds.setting('antenna'); if (ant) gnss.configure({ antenna: ant });
    const gm = await ds.setting('gnssMethod'); if (gm && gm.method) gnss.setMethod(gm.method, gm.base || null);
    const ps = new ProjectService({ ds, bus, gnss });
    Object.assign(app, { bus, ds, ps, gnss, bridge });
    window.__app = app;
    app.state.basemap = (await ds.setting('basemap')) || 'none';
    app.state.mapKeys = (await ds.setting('mapKeys')) || {};
    if (WEB) {
      app.state.srcMode = 'map';                                         // ofiste varsayılan kaynak: haritadan seç
      probeTiles().then((ok) => { app.state.tilesOk = ok; if (!ok) app.state.basemap = 'none'; bus.emit('settings:change', { key: 'tilesOk' }); });
      if (cloud) {
        cloud.on(() => bus.emit('cloud:status'));
        // Başka bilgisayardan gelen değişiklik: açık projeyi yeniden yükle
        // (ps.open kullanılmaz: ayar yazıp iki sekme arasında yankı oluşturur)
        const QUIET = new Set(['settings', 'audit', 'outbox', 'syncState', 'exportJobs', 'spans', 'quantities']);
        cloud.onRemote = async (stores) => {
          try {
            if (!stores.some((x) => !QUIET.has(x))) return;
            if (ps.p) { const p = await ds.get('projects', ps.p.id); if (p) ps.p = p; await ps.load(); ps.result = null; await ps.recompute('Buluttan güncellendi', { silent: true }); }
            bus.emit('project:open', ps.p); bus.emit('project:computed', {});
            if (app.toast) app.toast('Başka bir bilgisayarda yapılan değişiklikler alındı', 'ok', 4000);
          } catch (e) { console.warn(e); }
        };
        const flushNow = () => { cloud.flush().catch(() => {}); };
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
        window.addEventListener('pagehide', flushNow);
      }
    }
    wireRawLog();
    const last = await ds.setting('lastProject');
    if (last) { splash('Proje açılıyor…'); try { await ps.open(last); } catch (e) { console.warn(e); } }
    // Son alıcıya otomatik bağlan (yalnız APK)
    const lr = await ds.setting('lastReceiver');
    if (lr && bridge.isNative()) gnss.connectExternal({ type: lr.type, address: lr.address, name: lr.name }).catch(() => {});
    document.getElementById('splash').remove();
    render(html`<${App} />`, document.body);
    bus.on('native:gnssStatus', (d) => { if (d && d.state === 'error' && app.toast) app.toast('GNSS: ' + (d.error || 'bağlantı hatası'), 'err', 5000); if (d && d.state === 'connected' && app.toast) app.toast('GNSS bağlandı · ' + (d.name || '')); });
    // v2.4: alıcı markası seçimi kaldırıldı (birden çok marka kullanılacak); tüm alıcılar genel NMEA ile okunur.
    bus.on('native:ntrip', (d) => { if (d && d.state === 'error' && app.toast) app.toast('NTRIP: ' + (d.error || 'hata'), 'err', 5000); });
    // İnternet geldiğinde otomatik senkron (sunucu adresi kayıtlıysa); yoksa Senkron ekranından elle
    const autoSync = async () => {
      try {
        const cfg = await ds.setting('syncServer');
        if (!cfg || !cfg.url || !ps.p || navigator.onLine === false) return;
        const { httpSync } = await import('./core/sync.js');
        const r = await httpSync(ds, { url: cfg.url, token: cfg.token, projectId: ps.p.id });
        if ((r.sent || r.applied) && app.toast) { app.toast('Senkron: ' + r.sent + ' gönderildi · ' + r.applied + ' alındı' + (r.conflicts.length ? ' · ' + r.conflicts.length + ' çakışma' : ''), r.conflicts.length ? 'warn' : 'ok', 4000); if (r.applied) await ps.open(ps.p.id); }
      } catch (e) { /* çevrimdışı ya da sunucu yok: sessiz geç */ }
    };
    window.addEventListener('online', () => setTimeout(autoSync, 3000));
    window.__voltReady = true;
  } catch (e) {
    console.error(e);
    splash('Başlatma hatası: ' + e.message);
  }
}
boot();
