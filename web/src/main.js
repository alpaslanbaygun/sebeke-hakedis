// Uygulama başlatıcı: offline veritabanı, standart paketi, servisler, arayüz.
import { render } from 'preact';
import { html } from './ui/kit.js';
import { app } from './ui/ctx.js';
import { App } from './ui/app.js';
import { bus } from './core/bus.js';
import { IDBAdapter } from './core/db.js';
import { DataService } from './core/data-service.js';
import { importStandard } from './core/standards.js';
import { uuid4 } from './core/ids.js';
import { GnssService } from './gnss/gnss-service.js';
import { ProjectService } from './services/project-service.js';
import { bridge } from './native/bridge.js';
import { wireRawLog } from './ui/services.js';
import './ui/theme.css';

const splash = (t) => { const el = document.getElementById('splash-msg'); if (el) el.textContent = t; };

async function boot() {
  try {
    splash('Veritabanı açılıyor…');
    const db = await new IDBAdapter(indexedDB).open();
    let dev = await db.get('settings', 'deviceId');
    if (!dev) { dev = { id: 'deviceId', value: 'DEV-' + uuid4().slice(0, 8).toUpperCase() }; await db.put('settings', dev); }
    const user = ((await db.get('settings', 'user')) || {}).value || { id: 'u-' + dev.value, name: 'Saha Operatörü', role: 'operator' };
    const ds = new DataService(db, { bus, user, deviceId: dev.value });
    if (!(await db.count('standards'))) {
      splash('TEDAŞ 2026 · Yeşil Defter 26.23.GR.02 yükleniyor…');
      const pkg = await (await fetch('seed/standard-tedas-2026.json')).json();
      await importStandard(ds, pkg, { reason: 'İlk kurulum · standart paketi' });
    }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* */ }
    const gnss = new GnssService({ bus, bridge });
    const ant = await ds.setting('antenna'); if (ant) gnss.configure({ antenna: ant });
    const ps = new ProjectService({ ds, bus, gnss });
    Object.assign(app, { bus, ds, ps, gnss, bridge });
    window.__app = app;
    app.state.basemap = (await ds.setting('basemap')) || 'none';
    wireRawLog();
    const last = await ds.setting('lastProject');
    if (last) { splash('Proje açılıyor…'); try { await ps.open(last); } catch (e) { console.warn(e); } }
    // Son alıcıya otomatik bağlan (yalnız APK)
    const lr = await ds.setting('lastReceiver');
    if (lr && bridge.isNative()) gnss.connectExternal({ type: lr.type, address: lr.address, name: lr.name }).catch(() => {});
    document.getElementById('splash').remove();
    render(html`<${App} />`, document.body);
    bus.on('native:gnssStatus', (d) => { if (d && d.state === 'error' && app.toast) app.toast('GNSS: ' + (d.error || 'bağlantı hatası'), 'err', 5000); if (d && d.state === 'connected' && app.toast) app.toast('GNSS bağlandı · ' + (d.name || '')); });
    bus.on('native:ntrip', (d) => { if (d && d.state === 'error' && app.toast) app.toast('NTRIP: ' + (d.error || 'hata'), 'err', 5000); });
    window.__voltReady = true;
  } catch (e) {
    console.error(e);
    splash('Başlatma hatası: ' + e.message);
  }
}
boot();
