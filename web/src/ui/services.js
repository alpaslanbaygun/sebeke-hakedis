// UI tarafı yardımcı servisler: ölçüm oturumu, nokta alma akışı, karo önbelleği, son kullanılanlar.
import { app } from './ctx.js';
import { ulid } from '../core/ids.js';
import { html } from './kit.js';
import { tileX, tileY } from '../geo/tiles.js';

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

// GNSS ile ölçüm (kalite kapısı + ilerleme). critical: kritik saha noktası.
// Kalite yetersizse (RTK FIX yok, eşik aşımı, telefon GPS) kullanıcı uyarılır; onaylarsa kayıt "uyarıyla kabul" olarak yapılır (spesifikasyon 7.5).
export async function measure({ critical = true, label = 'Nokta' } = {}) {
  const g = app.gnss;
  if (g.state.source === 'none') {
    app.toast('Konum kaynağı yok · Ayarlar › Konum kaynağı', 'warn', 4000);
    return null;
  }
  const phone = g.state.source === 'phone';
  let override = false;
  const q = g.quality({ critical, allowTest: false });
  // RTK FLOAT: ayar açıksa (varsayılan) soru sorulmadan alınır; nokta [RTK FLOAT] etiketiyle ve "uyarıyla kabul" notuyla saklanır
  const floatOk = !phone && g.state.fix === 'FLOAT' && g.state.lat != null && (await app.ds.setting('floatCapture')) !== false;
  if (!q.ok && floatOk) {
    override = true;
    if (!app.state.floatTold) { app.state.floatTold = true; app.toast('RTK FLOAT · noktalar [RTK FLOAT] etiketiyle kaydedilir (Ayarlar › Hassasiyet eşiklerinden kapatılabilir)', 'warn', 5000); }
  } else if (!q.ok && phone && app.state.phoneAccepted && g.state.lat != null) override = true; // telefon GPS bu oturumda bir kez onaylandı
  else if (!q.ok) {
    if (g.state.lat == null) { app.toast('Konum henüz alınamadı · birkaç saniye bekleyin', 'warn', 4000); return null; }
    const go = await app.modal((close) => html`<div class="mh"><h3 class="hw">Hassas alım için uygun değil</h3></div><div class="mb">
        <div class="alert warn">Mevcut GNSS çözümü hassas saha alımı için uygun olmayabilir. Yine de kayıt yapmak istiyor musunuz?</div>
        ${q.reasons.map((r) => html`<div class="row"><span class="badge b-warn">UYARI</span><span class="grow">${r}</span></div>`)}
        <div class="note">${label} kritik saha noktasıdır. Kaydederseniz nokta <b>${phone ? '[TELEFON GPS]' : g.state.fix === 'FLOAT' ? '[RTK FLOAT]' : '[GNSS]'}</b> etiketiyle ve "uyarıyla kabul" notuyla saklanır; kontrol listesinde görünür ve sonradan RTK FIX ile yeniden ölçülebilir.</div></div>
      <div class="mf"><button class="btn grow" onClick=${() => close(false)}>Vazgeç · FIX bekle</button><button class="btn warn grow" onClick=${() => close(true)}>Yine de kaydet</button></div>`);
    if (!go) return null;
    override = true; if (phone) app.state.phoneAccepted = true;
  }
  let prog = { n: 0, need: phone ? 1 : g.thresholds.epochs || 5 };
  const off = app.bus.on('gnss:observeProgress', (p) => { prog = p; app.bus.emit('ui:measureProgress', p); });
  app.bus.emit('ui:measuring', { label, need: prog.need });
  try {
    const obs = await g.observe({ critical, allowTest: phone && !critical, epochs: phone ? 1 : undefined, override });
    const s = await ensureSession();
    obs.sessionId = s ? s.id : null;
    // Aynı uyarı oturumda bir kez gösterilir (her alımda ekranı kapatmasın)
    if (obs.warn && obs.warn.length && !override) { const seen = (app.state.warned = app.state.warned || new Set()); const fresh = obs.warn.filter((w) => !seen.has(w)); fresh.forEach((w) => seen.add(w)); if (fresh.length) app.toast(fresh.join(' · '), 'warn', 4500); }
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
// Google / Yandex: Ayarlar'a anahtar girilirse resmî servis, girilmezse anahtarsız genel adresler kullanılır.
// Yandex karoları elipsoidal Mercator'dadır (proj '3395'); harita motoru karoyu buna göre yerleştirir.
export const BASEMAPS = [
  { id: 'none', label: 'Altlık yok' },
  { id: 'osm', label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, note: '© OpenStreetMap katkıda bulunanlar · toplu indirme sınırlı' },
  { id: 'esri', label: 'Esri uydu görüntüsü', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, note: 'Esri World Imagery kullanım koşulları geçerlidir' },
  { id: 'google_m', label: 'Google Harita', provider: 'google', gType: 'roadmap', url: 'https://mt{s}.google.com/vt/lyrs=m&hl=tr&x={x}&y={y}&z={z}', sub: '0123', maxZoom: 21, note: 'Google kullanım koşulları geçerlidir' },
  { id: 'google_s', label: 'Google Uydu', provider: 'google', gType: 'satellite', url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', sub: '0123', maxZoom: 20, note: 'Google kullanım koşulları geçerlidir' },
  { id: 'google_h', label: 'Google Uydu + yol adları', provider: 'google', gType: 'hybrid', url: 'https://mt{s}.google.com/vt/lyrs=y&hl=tr&x={x}&y={y}&z={z}', sub: '0123', maxZoom: 20, note: 'Google kullanım koşulları geçerlidir' },
  { id: 'yandex_m', label: 'Yandex Harita', provider: 'yandex', proj: '3395', url: 'https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=tr_TR', keyUrl: 'https://tiles.api-maps.yandex.ru/v1/tiles/?x={x}&y={y}&z={z}&lang=tr_TR&l=map&apikey={key}', maxZoom: 19, note: 'Yandex kullanım koşulları geçerlidir' },
  { id: 'yandex_s', label: 'Yandex Uydu', provider: 'yandex', proj: '3395', url: 'https://core-sat.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}&scale=1&lang=tr_TR', maxZoom: 19, note: 'Yandex kullanım koşulları geçerlidir · resmî servis uydu vermediğinden anahtarsız adres' }
];
// Google Map Tiles (resmî): harita türü başına oturum belirteci alınır, süresi dolana kadar saklanır
const gSessions = new Map();
async function googleSession(bm, key) {
  const k = bm.gType + '|' + key;
  const cur = gSessions.get(k);
  if (cur && cur.expiry > Date.now() / 1000 + 60) return cur.session;
  const body = bm.gType === 'hybrid' ? { mapType: 'satellite', layerTypes: ['layerRoadmap'], language: 'tr', region: 'TR' } : { mapType: bm.gType, language: 'tr', region: 'TR' };
  const r = await fetch('https://tile.googleapis.com/v1/createSession?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Google anahtarı kabul edilmedi (' + r.status + ')');
  const j = await r.json();
  gSessions.set(k, { session: j.session, expiry: +j.expiry || Date.now() / 1000 + 3600 });
  return j.session;
}
// Karo adresi: anahtar varsa resmî servis; yoksa (ya da resmî servis hata verirse) genel adres
export async function tileUrl(bm, z, x, y, keys) {
  keys = keys || app.state.mapKeys || {};
  const fill = (u) => u.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', bm.sub ? bm.sub[(x + y) % bm.sub.length] : '');
  if (bm.provider === 'google' && keys.google && !app.state.googleKeyBad) {
    try { const s = await googleSession(bm, keys.google); return 'https://tile.googleapis.com/v1/2dtiles/' + z + '/' + x + '/' + y + '?session=' + encodeURIComponent(s) + '&key=' + encodeURIComponent(keys.google); }
    catch (e) { app.state.googleKeyBad = true; if (app.toast) app.toast(e.message + ' · anahtarsız adrese geçildi', 'warn', 6000); }
  }
  if (bm.provider === 'yandex' && keys.yandex && bm.keyUrl) return fill(bm.keyUrl).replace('{key}', encodeURIComponent(keys.yandex));
  return fill(bm.url);
}
const inflight = new Map();
export async function loadTile(bm, z, x, y) {
  const id = bm.id + '/' + z + '/' + x + '/' + y;
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    let rec = await app.ds.db.get('tiles', id);
    let blob = rec ? rec.blob : null;
    if (!blob && navigator.onLine !== false && bm.url) {
      try {
        const u = await tileUrl(bm, z, x, y);
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
  zMax = Math.min(zMax, bm.maxZoom || 19);
  for (let z = zMin; z <= zMax; z++) {
    for (let x = tileX(bboxLL.w, z); x <= tileX(bboxLL.e, z); x++) for (let y = tileY(bboxLL.n, z, bm.proj); y <= tileY(bboxLL.s, z, bm.proj); y++) list.push([z, x, y]);
  }
  if (list.length > limit) throw new Error(list.length + ' karo gerekiyor (sınır ' + limit + '). Alanı daraltın ya da yakınlaşın.');
  let done = 0;
  for (const [z, x, y] of list) { await loadTile(bm, z, x, y); done++; if (onProg) onProg(done, list.length); }
  return list.length;
}
