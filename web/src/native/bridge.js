// Yerel (Android) köprü soyutlaması. APK içinde window.VoltNative (Java @JavascriptInterface) kullanılır;
// masaüstü tarayıcıda Web Serial / Web Bluetooth / indirme yedekleri devreye girer.
import { bus } from '../core/bus.js';

const N = () => (typeof window !== 'undefined' ? window.VoltNative : null);
let seq = 0;
const pending = new Map();

// Java → JS olayları
if (typeof window !== 'undefined') {
  window.__voltNative = (evt, json) => {
    let data = null;
    try { data = json ? JSON.parse(json) : null; } catch (e) { data = json; }
    if (evt === 'reply' && data && pending.has(data.reqId)) {
      const { res, rej } = pending.get(data.reqId); pending.delete(data.reqId);
      if (data.error) rej(new Error(data.error)); else res(data.result);
      return;
    }
    bus.emit('native:' + evt, data);
  };
}
function call(method, args) {
  const n = N();
  if (!n || typeof n[method] !== 'function') return Promise.reject(new Error('Yerel özellik yok: ' + method));
  const reqId = 'r' + (++seq);
  return new Promise((res, rej) => {
    pending.set(reqId, { res, rej });
    try { n[method](reqId, JSON.stringify(args || {})); } catch (e) { pending.delete(reqId); rej(e); }
    setTimeout(() => { if (pending.has(reqId)) { pending.delete(reqId); rej(new Error(method + ' zaman aşımı')); } }, 120000);
  });
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

export const bridge = {
  isNative: () => !!N(),
  info: () => (N() ? call('appInfo', {}) : Promise.resolve({ platform: 'web', version: 'web' })),
  // ---- Harici GNSS ----
  btBonded: () => call('btBonded', {}),
  bleScan: (ms = 6000) => call('bleScan', { ms }),
  gnssConnect: (link) => call('gnssConnect', link), // {type:'spp'|'ble', address, name, service?, rx?, tx?}
  gnssDisconnect: () => call('gnssDisconnect', {}),
  gnssWrite: (u8) => call('gnssWrite', { b64: b64(u8) }),
  // ---- NTRIP (yerel TCP istemci; RTCM doğrudan alıcıya iletilir) ----
  ntripSourcetable: (cfg) => call('ntripSourcetable', cfg),
  ntripConnect: (cfg) => call('ntripConnect', cfg),
  ntripDisconnect: () => call('ntripDisconnect', {}),
  // ---- Telefon GNSS (LocationManager + NMEA dinleyici) ----
  phoneStart: (opts) => call('phoneStart', opts || {}),
  phoneStop: () => call('phoneStop', {}),
  // ---- Dosya ----
  async saveFile(name, mime, u8, opts = {}) {
    if (!N()) return webDownload(name, mime, u8);
    const id = await call('fileBegin', { name, mime, action: opts.share ? 'share' : 'save', size: u8.length, dir: opts.dir || '' }); // dir: İndirilenler/VOLT-EDAS altındaki alt klasör
    const CH = 512 * 1024;
    for (let i = 0; i < u8.length; i += CH) await call('fileChunk', { id, b64: b64(u8.subarray(i, i + CH)) });
    return call('fileEnd', { id });
  },
  shareFile(name, mime, u8) { return this.saveFile(name, mime, u8, { share: true }); },
  printHtml: (title, html) => (N() ? call('printHtml', { title, html }) : webPrint(html)),
  keepScreenOn: (on) => (N() ? call('keepScreenOn', { on }) : Promise.resolve()),
  vibrate: (ms = 40) => { if (N()) return call('vibrate', { ms }).catch(() => {}); try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* */ } return Promise.resolve(); },
  openSettings: (what) => call('openSettings', { what })
};

function webDownload(name, mime, u8) {
  const blob = new Blob([u8], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return Promise.resolve({ uri: 'download:' + name });
}
function webPrint(html) {
  const w = window.open('', '_blank');
  if (!w) return Promise.reject(new Error('Açılır pencere engellendi'));
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400);
  return Promise.resolve({});
}

// ---- Masaüstü tarayıcı yedekleri: Web Serial (USB/BT seri) ----
export async function webSerialConnect(baud = 115200, onText) {
  if (!('serial' in navigator)) throw new Error('Bu tarayıcıda Web Serial yok');
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: baud });
  const dec = new TextDecoderStream();
  port.readable.pipeTo(dec.writable).catch(() => {});
  const reader = dec.readable.getReader();
  let alive = true;
  (async () => { while (alive) { const { value, done } = await reader.read(); if (done) break; if (value) onText(value); } })();
  return { close: async () => { alive = false; try { await reader.cancel(); await port.close(); } catch (e) { /* */ } }, write: async (u8) => { const w = port.writable.getWriter(); await w.write(u8); w.releaseLock(); } };
}
// Web Bluetooth — Nordic UART (NUS) profili
export async function webBleConnect(onText) {
  if (!navigator.bluetooth) throw new Error('Bu tarayıcıda Web Bluetooth yok');
  const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e', TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e', RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [NUS] });
  const gatt = await dev.gatt.connect();
  const svc = await gatt.getPrimaryService(NUS);
  const tx = await svc.getCharacteristic(TX);
  const rx = await svc.getCharacteristic(RX);
  const dec = new TextDecoder();
  tx.addEventListener('characteristicvaluechanged', (e) => onText(dec.decode(e.target.value)));
  await tx.startNotifications();
  return { name: dev.name, close: async () => gatt.disconnect(), write: async (u8) => { for (let i = 0; i < u8.length; i += 180) await rx.writeValueWithoutResponse(u8.subarray(i, i + 180)); } };
}
