// Telefonun lisans denetimi (13.11.2026; kurallar core/lisans.js, biçim ortak/LISANS.md). Cihaz kodu Android'de
// ANDROID_ID'den ("TL-…"; köprü cihazKimligi), web (ofis) sürümünde ve köprü yoksa bu tarayıcıya / kuruluma yazılan
// rastgele kimlikten ("WB-…" / "TL-…"). Lisans ve ilk açılış / son görülme tarihleri ayarlarda (ds.setting('lisans')) ve
// tarayıcı belleğinde iki yerde tutulur — en erken ilk açılış, en geç son görülme geçerlidir. Lisanssız 7 gün çalışır;
// sonra uygulama yalnız Lisans ekranını açar (ui/app.js).
import { lisansDurumu, cihazKodu, bugunYazisi, lisansAyikla } from '../core/lisans.js';
import ANAHTAR from '../ortak/acik-anahtar.js';

export const URUN = 'telefon';
const BELLEK = 'sh-lisans';

const enErken = (a, b) => (!a ? b || '' : !b ? a : a <= b ? a : b);
const enGec = (a, b) => (!a ? b || '' : !b ? a : a >= b ? a : b);
const bellekOku = () => { try { return JSON.parse(localStorage.getItem(BELLEK) || 'null') || {}; } catch (e) { return {}; } };
const bellekYaz = (k) => { try { localStorage.setItem(BELLEK, JSON.stringify(k)); } catch (e) { /* */ } };

function rastgeleKimlik() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* */ }
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** Ham cihaz kimliği ve kodu: { onek, ham, kod }. */
export async function cihazBilgisi({ ds, bridge, web }) {
  if (!web && bridge && bridge.isNative() && bridge.cihazKimligi) {
    try { const r = await bridge.cihazKimligi(); if (r && r.id) return { onek: 'TL', ham: String(r.id), kod: cihazKodu('TL', String(r.id)) }; } catch (e) { /* köprü eski: rastgele kimlik */ }
  }
  let id = null;
  try { id = await ds.setting('cihazKimligi'); } catch (e) { /* */ }
  if (!id) { try { id = localStorage.getItem('sh-cihaz'); } catch (e) { /* */ } }
  if (!id) id = rastgeleKimlik();
  try { await ds.setting('cihazKimligi', id); } catch (e) { /* */ }
  try { localStorage.setItem('sh-cihaz', id); } catch (e) { /* */ }
  const onek = web ? 'WB' : 'TL';
  return { onek, ham: id, kod: cihazKodu(onek, id) };
}

async function kayitOku(ds) {
  let k = {};
  try { k = (await ds.setting('lisans')) || {}; } catch (e) { /* */ }
  const b = bellekOku();
  return { metin: k.metin || b.metin || '', ilkAcilis: enErken(k.ilkAcilis, b.ilkAcilis), sonGorulme: enGec(k.sonGorulme, b.sonGorulme) };
}
async function kayitYaz(ds, k) {
  try { await ds.setting('lisans', k); } catch (e) { /* */ }
  bellekYaz(k);
}

/** Şimdiki durum (ilk açılış yoksa bugün yazılır, son görülme ilerletilir). Döner: lisansDurumu sonucu. */
export async function lisansYukle({ ds, cihaz, bugun = bugunYazisi(), anahtar = ANAHTAR }) {
  const k = await kayitOku(ds);
  let degisti = false;
  if (!k.ilkAcilis) { k.ilkAcilis = bugun; degisti = true; }
  const son = enGec(k.sonGorulme, bugun);
  if (son !== k.sonGorulme) { k.sonGorulme = son; degisti = true; }
  if (degisti) await kayitYaz(ds, k);
  return lisansDurumu({ lisans: k.metin, cihaz: cihaz.kod, urun: URUN, bugun, ilkAcilis: k.ilkAcilis, sonGorulme: k.sonGorulme }, anahtar);
}

/** Yeni lisansı dener; kaydet ve geçerliyse yazar. Geçersizse kayıt değişmez. */
export async function lisansDene({ ds, cihaz, metin, kaydet = false, bugun = bugunYazisi(), anahtar = ANAHTAR }) {
  const k = await kayitOku(ds);
  if (!k.ilkAcilis) k.ilkAcilis = bugun;
  k.sonGorulme = enGec(k.sonGorulme, bugun);
  const d = lisansDurumu({ lisans: metin, cihaz: cihaz.kod, urun: URUN, bugun, ilkAcilis: k.ilkAcilis, sonGorulme: k.sonGorulme }, anahtar);
  if (kaydet && d.tur === 'lisansli') { k.metin = lisansAyikla(metin); await kayitYaz(ds, k); }
  return d;
}
