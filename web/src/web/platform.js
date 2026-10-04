// Web (ofis) sürümü platform katmanı.
// Yayınlanan sayfa kilitli bir çerçevede çalışır: dosya indirme yalnız "downloads" yeteneğiyle ve izinli uzantılarla,
// konum / kamera / Bluetooth / dış sunucu (harita karosu, NTRIP) yok. Bu katman köprüyü (bridge) buna göre uyarlar.
import { zip } from '../export/zip.js';

export const isWeb = () => typeof window !== 'undefined' && !!window.__VOLT_WEB__;
const hosted = () => typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function';

const caps = new Map();
// Çerçevenin köprüsü sayfa betiğinden hemen sonra gelebilir: kısa süre bekle, yoksa düz tarayıcı say
let hostWait = null;
function waitHosted(ms = 1500) {
  if (hosted()) return Promise.resolve(true);
  if (!hostWait) hostWait = new Promise((res) => { const t0 = Date.now(); const tick = () => (hosted() ? res(true) : Date.now() - t0 > ms ? res(false) : setTimeout(tick, 50)); tick(); });
  return hostWait;
}
// Yeteneği al; yoksa (ya da süre dolarsa) null
export function capability(name, ms = 12000) {
  if (!caps.has(name)) {
    caps.set(name, waitHosted().then((ok) => (!ok ? null : Promise.race([
      Promise.resolve().then(() => window.claude.use(name)).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), ms))
    ]))));
  }
  return caps.get(name);
}

// İndirme yeteneğinin kabul ettiği uzantılar; diğerleri (dxf, ncn, kml, kmz, geojson, vsync…) zip içine alınır
const ALLOWED = new Set('gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv ttf html svg pdf xlsx zip'.split(' '));
const extOf = (name) => { const i = name.lastIndexOf('.'); return i < 0 ? '' : name.slice(i + 1).toLowerCase(); };
const DL_ERR = { declined: 'İndirme iptal edildi', rate_limited: 'Önceki indirme penceresi açık · kapatıp yeniden deneyin', too_large: 'Dosya çok büyük', unavailable: 'Bu görünümde dosya indirilemiyor' };

function anchorDownload(name, u8) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([u8])); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
export async function wrapForDownload(name, u8) {
  const ext = extOf(name);
  if (ext === 'vsync') return { name: name + '.json', data: u8 };          // telefon ".json" uzantısını da kabul eder
  if (ALLOWED.has(ext)) return { name, data: u8 };
  return { name: name + '.zip', data: await zip([{ name, data: u8 }]), zipped: true };
}
async function save(name, u8) {
  const f = hosted() ? await wrapForDownload(name, u8) : { name, data: u8 };
  const dl = await capability('downloads');
  if (!dl) {
    if (hosted()) throw new Error(DL_ERR.unavailable);
    anchorDownload(f.name, f.data);
    return { uri: f.name, name: f.name };
  }
  try { await dl.save({ filename: f.name, data: new Blob([f.data]) }); } catch (e) { throw new Error(DL_ERR[e && e.code] || (e && e.message) || 'İndirilemedi'); }
  return { uri: f.name, name: f.name, zipped: !!f.zipped };
}

// Birden çok çıktı tek zip olarak indirilir (her dosya için ayrı onay penceresi açılmasın)
export async function saveBundle(zipName, files) {
  if (files.length === 1) return save(files[0].name, files[0].data);
  return save(zipName, await zip(files.map((f) => ({ name: f.name, data: f.data }))));
}

export function installWebBridge(bridge) {
  bridge.saveFile = (name, mime, u8) => save(name, u8);
  bridge.shareFile = (name, mime, u8) => save(name, u8);
  bridge.saveBundle = saveBundle;
  bridge.printHtml = (title, html) => save((title || 'rapor').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '.html', new TextEncoder().encode(html));
  bridge.info = () => Promise.resolve({ platform: 'web', version: (typeof window !== 'undefined' && window.__VOLT_VERSION__) || 'web' });
  bridge.vibrate = () => Promise.resolve();
  bridge.keepScreenOn = () => Promise.resolve();
}

// Dış harita karosu sunucularına erişim var mı? (yayınlanan sayfada engelli; kendi sunucunda açılırsa çalışır)
export async function probeTiles() {
  if (await waitHosted()) return false;
  try { const r = await fetch('https://tile.openstreetmap.org/0/0/0.png', { mode: 'cors' }); return r.ok; } catch (e) { return false; }
}
