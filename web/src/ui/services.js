// UI tarafı yardımcı servisler: ölçüm oturumu, nokta alma akışı, karo önbelleği, son kullanılanlar.
import { app } from './ctx.js';
import { ulid } from '../core/ids.js';
import { html } from './kit.js';

// Aktif ölçüm oturumu (alıcı + anten + NTRIP bilgisiyle)
export async function ensureSession() {
  const ps = app.ps, g = app.gnss;
  if (!ps.p || g.state.source === 'none') return null;
  const today = new Date().toISOString().slice(0, 10);
  let s = ps.data.surveySessions.find((x) => x.id === app.state.sessionId && !x.endedAt && x.startedAt.slice(0, 10) === today && x.sourceKind === g.state.source);
  if (!s) {
    s = await ps.ds.create('surveySessions', { projectId: ps.p.id, startedAt: new Date().toISOString(), operator: ps.ds.user.name, sourceKind: g.state.source, receiver: g.state.receiver || null, antenna: Object.assign({}, g.antenna), ntrip: g.ntrip.mount ? { mount: g.ntrip.mount, host: (app.state.ntripCfg || {}).host || null } : null, crs: ps.p.crs.label }, { reason: 'Ölçüm oturumu başladı', silent: true });
    await ps.reload('surveySessions');
    app.state.sessionId = s.id;
  }
  return s;
}

// Ham NMEA günlüğünü projeye yaz
export function wireRawLog() {
  app.bus.on('gnss:raw', async (chunk) => {
    const ps = app.ps; if (!ps.p || !chunk.text) return;
    await ps.ds.db.put('rawLogs', { id: ulid(), projectId: ps.p.id, sessionId: app.state.sessionId || null, t0: chunk.t1 - 1, t1: chunk.t1, text: chunk.text });
  });
  setInterval(() => app.gnss.flushRaw(), 15000);
}

// GNSS ile ölçüm (kalite kapısı + ilerleme penceresi). critical: kritik saha noktası
export async function measure({ critical = true, label = 'Nokta' } = {}) {
  const g = app.gnss;
  if (g.state.source === 'none') {
    app.toast('Konum kaynağı yok · Ayarlar › Konum kaynağı', 'warn', 4000);
    return null;
  }
  const phone = g.state.source === 'phone';
  const q = g.quality({ critical, allowTest: phone });
  if (!q.ok) {
    await app.modal((close) => html`<div class="mh"><h3 class="he">ÖLÇÜ KABUL EDİLMEDİ</h3></div><div class="mb"><div class="alert err">${label} kritik saha noktasıdır. Kabul için RTK FIX ve eşikler sağlanmalı.</div>${q.reasons.map((r) => html`<div class="row"><span class="badge b-err">RED</span><span>${r}</span></div>`)}<div class="note">Eşikler: Ayarlar › Hassasiyet eşikleri. FIX bekleyip tekrar deneyin.</div></div><div class="mf"><button class="btn pri grow" onClick=${() => close()}>Tamam</button></div>`);
    return null;
  }
  let prog = { n: 0, need: phone ? 1 : g.thresholds.epochs || 5 };
  const off = app.bus.on('gnss:observeProgress', (p) => { prog = p; app.bus.emit('ui:measureProgress', p); });
  app.bus.emit('ui:measuring', { label, need: prog.need });
  try {
    const obs = await g.observe({ critical, allowTest: phone, epochs: phone ? 1 : undefined });
    const s = await ensureSession();
    obs.sessionId = s ? s.id : null;
    // Aynı uyarı oturumda bir kez gösterilir (her alımda ekranı kapatmasın)
    if (obs.warn && obs.warn.length) { const seen = (app.state.warned = app.state.warned || new Set()); const fresh = obs.warn.filter((w) => !seen.has(w)); fresh.forEach((w) => seen.add(w)); if (fresh.length) app.toast(fresh.join(' · '), 'warn', 4500); }
    if (app.bridge) app.bridge.vibrate(60);
    return obs;
  } catch (e) {
    app.toast(e.message, 'err', 5000);
    return null;
  } finally { off(); app.bus.emit('ui:measuring', null); }
}

// Son kullanılanlar / favoriler (tek elle hızlı giriş)
export async function recent(key, value) {
  const all = (await app.ds.setting('recent')) || {};
  if (value === undefined) return all[key];
  all[key] = value; await app.ds.setting('recent', all);
  return value;
}
export async function favorites(toggleId) {
  const f = (await app.ds.setting('favPoleTypes')) || [];
  if (!toggleId) return f;
  const n = f.includes(toggleId) ? f.filter((x) => x !== toggleId) : [toggleId, ...f].slice(0, 12);
  await app.ds.setting('favPoleTypes', n);
  return n;
}

// Altlık karo önbelleği (IndexedDB) → offline harita
export const BASEMAPS = [
  { id: 'none', label: 'Altlık yok' },
  { id: 'osm', label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, note: '© OpenStreetMap katkıda bulunanlar · toplu indirme sınırlı' },
  { id: 'esri', label: 'Esri uydu görüntüsü', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, note: 'Esri World Imagery kullanım koşulları geçerlidir' }
];
const inflight = new Map();
export async function loadTile(bm, z, x, y) {
  const id = bm.id + '/' + z + '/' + x + '/' + y;
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    let rec = await app.ds.db.get('tiles', id);
    let blob = rec ? rec.blob : null;
    if (!blob && navigator.onLine !== false && bm.url) {
      try {
        const u = bm.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        // APK: yerel vekil (CORS yok, kimlik başlığı eklenir) · tarayıcı: doğrudan
        const r = await fetch(app.bridge && app.bridge.isNative() ? '/_tile?u=' + encodeURIComponent(u) : u);
        if (r.ok) { blob = await r.blob(); await app.ds.db.put('tiles', { id, blob, at: Date.now() }); }
      } catch (e) { /* offline */ }
    }
    if (!blob) return null;
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode().catch(() => {});
    return img;
  })();
  inflight.set(id, p);
  try { return await p; } finally { inflight.delete(id); }
}
// Görünen alanı offline indir (z..z+2, en fazla limit karo)
export async function prefetchArea(bm, bboxLL, zMin, zMax, limit = 1200, onProg) {
  const list = [];
  for (let z = zMin; z <= zMax; z++) {
    const n = 2 ** z;
    const tx = (lon) => Math.floor(((lon + 180) / 360) * n), ty = (lat) => Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * n);
    for (let x = tx(bboxLL.w); x <= tx(bboxLL.e); x++) for (let y = ty(bboxLL.n); y <= ty(bboxLL.s); y++) list.push([z, x, y]);
  }
  if (list.length > limit) throw new Error(list.length + ' karo gerekiyor (sınır ' + limit + '). Alanı daraltın ya da yakınlaşın.');
  let done = 0;
  for (const [z, x, y] of list) { await loadTile(bm, z, x, y); done++; if (onProg) onProg(done, list.length); }
  return list.length;
}
