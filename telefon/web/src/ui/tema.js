// Arayüz teması (13.11.2026): Otomatik (cihazın teması), Koyu ya da Açık. AutoCAD eklentisinde aynı seçim pencerelerin
// rengini belirler (KoyuTema.cs › Tema: Otomatik = AutoCAD'in teması). Seçim ayarlara (ds.setting('tema')) ve açılışta
// boyanmadan önce okunsun diye tarayıcı belleğine yazılır; <html data-tema="acik|koyu"> CSS değişkenlerini seçer
// (ui/theme.css). Harita kanvası CSS değişkeni okuyamaz: kanvasTemasi() bağlamın renk atamalarını açık temada çevirir.

export const TEMA_SECENEKLERI = [['otomatik', 'Otomatik'], ['koyu', 'Koyu'], ['acik', 'Açık']];
const ANAHTAR = 'sh-tema';
const RENK = { koyu: { zemin: '#0b1326', cubukAcik: false }, acik: { zemin: '#f3f5f8', cubukAcik: true } };

let secim = 'otomatik';
let sistemAcik = null;   // yerel uygulamanın bildirdiği cihaz teması (WebView prefers-color-scheme uygulamanın temasını izler)
const dinleyiciler = new Set();

const kok = () => (typeof document !== 'undefined' ? document.documentElement : null);

/** Etkin tema açık mı? */
export const temaAcik = () => { const k = kok(); return !!k && k.dataset.tema === 'acik'; };
/** Kullanıcının seçimi: otomatik / koyu / acik. */
export const temaSecimi = () => secim;

function cihazAcikMi() {
  if (sistemAcik != null) return sistemAcik;
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { return false; }
}

/** Seçimden etkin temayı hesaplar ve uygular (html data-tema, theme-color, sistem çubukları). */
function uygula() {
  const k = kok();
  if (!k) return;
  const acik = secim === 'acik' || (secim === 'otomatik' && cihazAcikMi());
  const ad = acik ? 'acik' : 'koyu';
  if (k.dataset.tema === ad) return;
  k.dataset.tema = ad;
  k.style.colorScheme = acik ? 'light' : 'dark';
  try { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', RENK[ad].zemin); } catch (e) { /* */ }
  try { if (typeof window !== 'undefined' && window.VoltNative && window.VoltNative.cubukRengi) window.VoltNative.cubukRengi('t' + Date.now(), JSON.stringify({ renk: RENK[ad].zemin, acik: RENK[ad].cubukAcik })); } catch (e) { /* */ }
  for (const f of dinleyiciler) { try { f(acik); } catch (e) { /* */ } }
}

/** Seçimi değiştirir ve uygular (ayara yazmak çağıranın işi: ds.setting('tema', s)). */
export function temaUygula(s) {
  secim = TEMA_SECENEKLERI.some(([k]) => k === s) ? s : 'otomatik';
  try { localStorage.setItem(ANAHTAR, secim); } catch (e) { /* */ }
  uygula();
}

/** Yerel uygulama cihazın temasını bildirir (açılışta ve cihaz teması değişince). */
export function sistemTemasi(acik) { sistemAcik = !!acik; uygula(); }

/** Tema değişince çağrılır (harita yeniden çizilsin diye); kaldırıcıyı döner. */
export function temaDinle(f) { dinleyiciler.add(f); return () => dinleyiciler.delete(f); }

/** Açılış: bellekteki seçimi hemen uygular, cihaz teması değişimini izler. */
export function temaBaslat() {
  let s = 'otomatik';
  try { s = localStorage.getItem(ANAHTAR) || 'otomatik'; } catch (e) { /* */ }
  temaUygula(s);
  try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (sistemAcik == null) uygula(); }); } catch (e) { /* */ }
}

// ---------------- Kanvas ----------------

const rgb = (c) => {
  const s = String(c).trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16)).concat(1);
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(m[2] ? parseInt(m[2], 16) / 255 : 1);
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3], m[4] != null ? +m[4] : 1];
  return null;
};
const parlaklik = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Koyu zemine göre seçilmiş çizim rengini açık zemine uyarlar (koyu temada aynen döner): koyu zemin rengi (içi boş
 * simgeler, yazı halesi, harita zemini) beyaza, açık yazı / çizgi renkleri (beyaz, açık gri, AYD camgöbeği, sarı)
 * koyuya çevrilir; orta renkler kalır. AutoCAD eklentisindeki Tema.Okunur ile aynı kural (parlaklık > 0,55 → 0,55).
 */
export function okunur(c) {
  if (!temaAcik() || typeof c !== 'string') return c;
  const v = rgb(c);
  if (!v) return c;
  const [r, g, b, a] = v;
  const l = parlaklik(r, g, b);
  if (l < 0.12) return a < 1 ? 'rgba(255,255,255,' + a + ')' : '#eef2f6';   // koyu zemin, içi boş simge, yazı halesi
  if (l > 0.85 && Math.max(r, g, b) - Math.min(r, g, b) < 40) return a < 1 ? 'rgba(15,27,42,' + Math.min(1, a * 0.8) + ')' : '#0f1b2a';   // beyaz / açık gri
  if (l <= 0.55) return c;
  const k = 0.55 / l;
  return 'rgba(' + Math.round(r * k) + ',' + Math.round(g * k) + ',' + Math.round(b * k) + ',' + a + ')';
}

/**
 * Kanvas bağlamının fillStyle / strokeStyle atamalarını açık temada okunur() ile çevirir (bir kez kurulur; tema her
 * atamada denetlenir). Harita motoru ve ona çizen ekranlar renkleri koyu zemine göre yazar; burada tek yerde uyarlanır.
 */
export function kanvasTemasi(g) {
  if (!g || g.__tema) return g;
  const proto = Object.getPrototypeOf(g);
  for (const ad of ['fillStyle', 'strokeStyle']) {
    let d = null;
    for (let p = proto; p && !d; p = Object.getPrototypeOf(p)) d = Object.getOwnPropertyDescriptor(p, ad);
    if (!d || !d.set) continue;
    Object.defineProperty(g, ad, { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, okunur(v)); } });
  }
  Object.defineProperty(g, '__tema', { value: true });
  return g;
}
