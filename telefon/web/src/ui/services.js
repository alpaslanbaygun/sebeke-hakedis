// UI tarafı yardımcı servisler: ölçüm oturumu, nokta alma akışı, karo önbelleği, son kullanılanlar.
import { app } from './ctx.js';
import { ulid } from '../core/ids.js';
import { html } from './kit.js';
import { tileX, tileY, quadKey } from '../geo/tiles.js';

// Aktif ölçüm oturumu (alıcı + anten + NTRIP bilgisiyle)
export async function ensureSession() {
  const ps = app.ps, g = app.gnss;
  if (!ps.p || g.state.source === 'none') return null;
  const today = new Date().toISOString().slice(0, 10);
  let s = ps.data.surveySessions.find((x) => x.id === app.state.sessionId && !x.endedAt && x.startedAt.slice(0, 10) === today && x.sourceKind === g.state.source);
  if (!s) {
    s = await ps.ds.create('surveySessions', { projectId: ps.p.id, startedAt: new Date().toISOString(), operator: ps.ds.user.name, sourceKind: g.state.source, receiver: g.state.receiver || null, antenna: Object.assign({}, g.antenna), ntrip: g.ntrip.state === 'connected' ? { mode: g.ntrip.mode || 'ntrip', mount: g.ntrip.mount || null, host: g.ntrip.host || (app.state.ntripCfg || {}).host || null, port: g.ntrip.port || null, station: g.ntrip.station ? g.ntrip.station.id : null } : null, crs: ps.p.crs.label }, { reason: 'Ölçüm oturumu başladı', silent: true });
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

// ---------------------------------------------------------------- Harita altlıkları
// Her altlık: haritada gösterilecek atıf (attr), kullanım koşulu notu ve adresi, gereken anahtar (key: Ayarlar'daki
// anahtarın adı) ve toplu / offline indirmeye izin (offline). Anahtarlar kodda yoktur: Ayarlar › Harita altlığı'nda
// girilir, yalnız bu cihazda saklanır (proje dosyalarına, eşitlemeye ve paylaşıma girmez). Anahtar isteyen altlık
// anahtarsız denenmez; anahtarsız ücretsiz seçenekler (OpenStreetMap, OpenTopoMap, Esri uydu) her zaman vardır.
// Ücretsiz kullanım sınırsız değildir: sağlayıcı yoğun kullanımı kesebilir (notlarda yazılı).
// Yandex karoları elipsoidal Mercator'dadır (proj '3395'); harita motoru karoyu buna göre yerleştirir.
export const ALTLIK_GRUPLARI = [['ucretsiz', 'Ücretsiz (anahtarsız)'], ['anahtarli', 'Anahtarlı (ücretsiz katmanı olan)'], ['ozel', 'Özel']];
export const BASEMAPS = [
  { id: 'none', label: 'Altlık yok' },
  { id: 'osm', grup: 'ucretsiz', label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19,
    attr: '© OpenStreetMap katkıda bulunanlar', kosul: 'https://operations.osmfoundation.org/policies/tiles/',
    note: 'Ücretsiz, gönüllü sunucular. Toplu / offline indirme yasak; yoğun kullanımda erişim haber verilmeden kesilebilir.' },
  { id: 'otm', grup: 'ucretsiz', label: 'OpenTopoMap (topoğrafik)', url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17,
    attr: '© OpenStreetMap katkıda bulunanlar, SRTM · © OpenTopoMap (CC-BY-SA)', kosul: 'https://opentopomap.org/about',
    note: 'Ücretsiz; sunucu kapasitesi sınırlı, toplu indirme yok. Eş yükselti eğrili.' },
  { id: 'esri', grup: 'ucretsiz', label: 'Esri uydu görüntüsü', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19,
    attr: 'Kaynak: Esri, Vantor, Earthstar Geographics', kosul: 'https://goto.arcgisonline.com/maps/World_Imagery',
    note: 'Esri kullanım koşulları geçerli. Karo dışa aktarımı kapalı (offline yok); yoğun ya da ticari kullanımda ArcGIS hesabı gerekebilir.' },
  { id: 'maptiler_s', grup: 'anahtarli', key: 'maptiler', label: 'MapTiler sokak', url: 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={key}', maxZoom: 20,
    attr: '© MapTiler © OpenStreetMap katkıda bulunanlar', kosul: 'https://www.maptiler.com/cloud/terms/',
    note: 'Ücretsiz planla alınan anahtar yeter: ayda 5 bin harita açılışı, ticari olmayan kullanım; sınır aşılınca ay sonuna kadar durur.' },
  { id: 'maptiler_u', grup: 'anahtarli', key: 'maptiler', label: 'MapTiler uydu', url: 'https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key={key}', maxZoom: 20,
    attr: '© MapTiler © OpenStreetMap katkıda bulunanlar', kosul: 'https://www.maptiler.com/cloud/terms/',
    note: 'MapTiler sokak ile aynı anahtar ve kota.' },
  { id: 'esri_k', grup: 'anahtarli', key: 'esri', label: 'Esri uydu (ArcGIS anahtarı)', url: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token={key}', maxZoom: 19,
    attr: 'Kaynak: Esri, Vantor, Earthstar Geographics', kosul: 'https://goto.arcgisonline.com/maps/World_Imagery',
    note: 'ArcGIS Location Platform ya da ArcGIS Online anahtarı (API key) gerekir; aylık ücretsiz kullanım payı vardır. Anahtarsız Esri uydu yoğun kullanımda kesilirse bunu seçin.' },
  { id: 'google_m', grup: 'anahtarli', key: 'google', provider: 'google', gType: 'roadmap', label: 'Google harita', maxZoom: 21,
    attr: 'Harita verileri © Google', kosul: 'https://cloud.google.com/maps-platform/terms',
    note: 'Google Map Tiles API anahtarı (Google Cloud hesabı) gerekir. Aylık ücretsiz kullanım payı vardır; aşılırsa ücretlendirilir.' },
  { id: 'google_s', grup: 'anahtarli', key: 'google', provider: 'google', gType: 'satellite', label: 'Google uydu', maxZoom: 20,
    attr: 'Görüntü © Google', kosul: 'https://cloud.google.com/maps-platform/terms', note: 'Google harita ile aynı anahtar.' },
  { id: 'google_h', grup: 'anahtarli', key: 'google', provider: 'google', gType: 'hybrid', label: 'Google uydu + yol adları', maxZoom: 20,
    attr: 'Görüntü ve harita verileri © Google', kosul: 'https://cloud.google.com/maps-platform/terms', note: 'Google harita ile aynı anahtar.' },
  { id: 'bing_a', grup: 'anahtarli', key: 'bing', provider: 'bing', set: 'Aerial', label: 'Bing uydu', maxZoom: 19,
    attr: '© Microsoft Bing', kosul: 'https://learn.microsoft.com/en-us/bingmaps/rest-services/imagery',
    note: 'Bing Maps kurumsal (Enterprise) anahtarı gerekir: ücretsiz (Basic) anahtarlar kapatıldı, kurumsal anahtarlar 30.06.2028\'e kadar çalışır. Yeni anahtar için Azure Maps\'i seçin.' },
  { id: 'bing_h', grup: 'anahtarli', key: 'bing', provider: 'bing', set: 'AerialWithLabelsOnDemand', label: 'Bing uydu + yol adları', maxZoom: 19,
    attr: '© Microsoft Bing', kosul: 'https://learn.microsoft.com/en-us/bingmaps/rest-services/imagery', note: 'Bing uydu ile aynı anahtar.' },
  { id: 'azure_s', grup: 'anahtarli', key: 'azure', provider: 'azure', label: 'Azure Maps uydu (Bing\'in yerine)', maxZoom: 19,
    url: 'https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=microsoft.imagery&zoom={z}&x={x}&y={y}&tileSize=256&subscription-key={key}',
    attr: '© Microsoft, Azure Maps', kosul: 'https://learn.microsoft.com/en-us/rest/api/maps/render/get-map-tile',
    note: 'Azure Maps hesabının anahtarı (subscription key) gerekir; aylık ücretsiz kullanım payı vardır.' },
  { id: 'azure_m', grup: 'anahtarli', key: 'azure', provider: 'azure', label: 'Azure Maps yol haritası', maxZoom: 21,
    url: 'https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=microsoft.base.road&zoom={z}&x={x}&y={y}&tileSize=256&subscription-key={key}',
    attr: '© Microsoft, Azure Maps', kosul: 'https://learn.microsoft.com/en-us/rest/api/maps/render/get-map-tile', note: 'Azure Maps uydu ile aynı anahtar.' },
  { id: 'yandex_m', grup: 'anahtarli', key: 'yandex', provider: 'yandex', proj: '3395', label: 'Yandex harita',
    url: 'https://tiles.api-maps.yandex.ru/v1/tiles/?x={x}&y={y}&z={z}&lang=tr_TR&l=map&apikey={key}', maxZoom: 19,
    attr: '© Yandex', kosul: 'https://yandex.com/dev/tiles/', note: 'Yandex Tiles API anahtarı gerekir; ücretsiz kullanım payı sınırlıdır.' },
  { id: 'ozel', grup: 'ozel', key: 'ozelUrl', label: 'Özel karo sunucusu (XYZ)', maxZoom: 20, offline: true,
    note: 'Kurumunuzun ya da izin aldığınız sağlayıcının XYZ adresi ({z}/{x}/{y} ya da Bing tipi {q}). Offline indirme açık; koşullara uymak kullanıcının sorumluluğundadır.' }
];

export const basemapById = (id) => BASEMAPS.find((b) => b.id === id) || BASEMAPS[0];
/** Altlığın anahtarı (yoksa ''). Özel altlıkta anahtar, karo adresinin kendisidir. */
export const basemapKey = (bm, keys) => (bm && bm.key ? ((keys || app.state.mapKeys || {})[bm.key] || '').trim() : '');
/** Altlık kullanılabilir mi (anahtar isteyende anahtar girilmiş mi)? */
export const basemapReady = (bm, keys) => !!bm && bm.id !== 'none' && (!bm.key || !!basemapKey(bm, keys));
/** Haritadaki atıf yazısı (özel altlıkta Ayarlar'da girilen). */
export const basemapAttr = (bm, keys) => (bm && bm.id === 'ozel' ? ((keys || app.state.mapKeys || {}).ozelAttr || '') : (bm && bm.attr) || '');

// Altlık hataları: aynı altlıkta art arda hata olunca haritada uyarı çıkar (tiles:error), başka altlığa geçilebilir
export const tileErrors = new Map();
function tileError(bm, reason) {
  const cur = tileErrors.get(bm.id) || { count: 0 };
  cur.count++; cur.reason = reason; cur.at = Date.now();
  tileErrors.set(bm.id, cur);
  if (cur.count === 3 && app.bus) app.bus.emit('tiles:error', { id: bm.id, reason });
}
function tileOk(bm) { if (tileErrors.has(bm.id)) { tileErrors.delete(bm.id); if (app.bus) app.bus.emit('tiles:error', { id: bm.id, ok: true }); } }
const httpNeden = (st) => (st === 401 || st === 403 ? 'erişim reddedildi (' + st + '): anahtar geçersiz ya da kullanım izni yok'
  : st === 429 ? 'kota ya da hız sınırı aşıldı (429)' : st === 504 || st === 502 ? 'sunucuya ulaşılamadı (' + st + ')' : 'sunucu hatası (' + st + ')');

// Google Map Tiles (resmî): harita türü başına oturum belirteci alınır, süresi dolana kadar saklanır
const gSessions = new Map();
async function googleSession(bm, key) {
  const k = bm.gType + '|' + key;
  const cur = gSessions.get(k);
  if (cur && cur.expiry > Date.now() / 1000 + 60) return cur.session;
  const body = bm.gType === 'hybrid' ? { mapType: 'satellite', layerTypes: ['layerRoadmap'], language: 'tr', region: 'TR' } : { mapType: bm.gType, language: 'tr', region: 'TR' };
  const r = await fetch('https://tile.googleapis.com/v1/createSession?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const e = new Error('Google anahtarı kabul edilmedi (' + r.status + ')'); e.durum = r.status; throw e; }
  const j = await r.json();
  gSessions.set(k, { session: j.session, expiry: +j.expiry || Date.now() / 1000 + 3600 });
  return j.session;
}
// Bing Maps (kurumsal anahtar): görüntü kümesinin karo adresi şablonu meta veriden alınır (eklentideki gibi), saklanır
const bingMetas = new Map();
async function bingMeta(bm, key) {
  const k = bm.set + '|' + key;
  if (bingMetas.has(k)) return bingMetas.get(k);
  const u = 'https://dev.virtualearth.net/REST/v1/Imagery/Metadata/' + bm.set + '?key=' + encodeURIComponent(key) + '&uriScheme=https&output=json';
  const r = await fetch(app.bridge && app.bridge.isNative() ? '/_tile?u=' + encodeURIComponent(u) : u);
  if (!r.ok) { const e = new Error('Bing Maps anahtarı kabul edilmedi (' + r.status + ')'); e.durum = r.status; throw e; }
  const j = await r.json();
  const res = (((j.resourceSets || [])[0] || {}).resources || [])[0] || {};
  if (!res.imageUrl) throw new Error('Bing Maps karo adresi alınamadı');
  const m = { url: res.imageUrl, alt: res.imageUrlSubdomains || [] };
  bingMetas.set(k, m);
  return m;
}
/** Karo adresi. Anahtar isteyen altlıkta anahtar yoksa hata (anahtarsız genel adres denenmez). */
export async function tileUrl(bm, z, x, y, keys) {
  keys = keys || app.state.mapKeys || {};
  const fill = (u) => u.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{q}', quadKey(x, y, z)).replace('{s}', bm.sub ? bm.sub[(x + y) % bm.sub.length] : '');
  const key = basemapKey(bm, keys);
  if (bm.key && !key) { const e = new Error(bm.label + ': anahtar girilmemiş (Ayarlar › Harita altlığı)'); e.anahtar = true; throw e; }
  if (bm.provider === 'google') { const s = await googleSession(bm, key); return 'https://tile.googleapis.com/v1/2dtiles/' + z + '/' + x + '/' + y + '?session=' + encodeURIComponent(s) + '&key=' + encodeURIComponent(key); }
  if (bm.provider === 'bing') { const m = await bingMeta(bm, key); return m.url.replace('{subdomain}', m.alt.length ? m.alt[(x + y) % m.alt.length] : 't0').replace('{quadkey}', quadKey(x, y, z)).replace('{culture}', 'tr-TR'); }
  if (bm.id === 'ozel') return fill(key);
  return fill(bm.url).replace('{key}', encodeURIComponent(key));
}
const inflight = new Map();
export async function loadTile(bm, z, x, y) {
  const id = bm.id + '/' + z + '/' + x + '/' + y;
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    let rec = await app.ds.db.get('tiles', id);
    let blob = rec ? rec.blob : null;
    // Görülen karolar cihazda saklanır (yeniden görüntüleme internetsiz de olur; koşullar buna izin verir)
    if (!blob && navigator.onLine !== false && bm.id !== 'none') {
      try {
        const u = await tileUrl(bm, z, x, y);
        // APK: yerel vekil (CORS yok, uygulama kimliği başlığı eklenir) · tarayıcı: doğrudan
        const r = await fetch(app.bridge && app.bridge.isNative() ? '/_tile?u=' + encodeURIComponent(u) : u);
        if (r.ok) { blob = await r.blob(); await app.ds.db.put('tiles', { id, blob, at: Date.now() }); tileOk(bm); }
        else tileError(bm, httpNeden(r.status));
      } catch (e) { tileError(bm, e.anahtar ? e.message : e.durum ? httpNeden(e.durum) : 'ağ hatası: internet bağlantısını denetleyin'); }
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
// Görünen alanı offline indir (z..z+2, en fazla limit karo). Yalnız koşulları buna izin veren altlıkta (offline: true).
export async function prefetchArea(bm, bboxLL, zMin, zMax, limit = 1200, onProg) {
  if (!bm.offline) throw new Error(bm.label + ' kullanım koşulları toplu / offline indirmeye izin vermiyor. Gördüğünüz alanlar zaten cihazda saklanır.');
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
