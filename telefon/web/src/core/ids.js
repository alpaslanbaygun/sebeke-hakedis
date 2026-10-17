// Zaman sıralı benzersiz kimlik (ULID benzeri, 26 karakter Crockford base32).
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastTime = 0;
let lastRand = [];

function randomBytes(n) {
  const a = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  return a;
}

export function ulid(now = Date.now()) {
  let t = now;
  let time = '';
  for (let i = 0; i < 10; i++) { time = ENC[t % 32] + time; t = Math.floor(t / 32); }
  let rand;
  if (now === lastTime) {
    // aynı milisaniye: rastgele kısmı artır (monoton)
    rand = lastRand.slice();
    for (let i = rand.length - 1; i >= 0; i--) { if (rand[i] < 31) { rand[i]++; break; } rand[i] = 0; }
  } else {
    const b = randomBytes(16);
    rand = Array.from(b, (x) => x % 32);
  }
  lastTime = now; lastRand = rand;
  return time + rand.map((x) => ENC[x]).join('');
}

// Proje içinde okunabilir nokta / ekipman numarası üretir: D-019, TR-3, SDK-07 ...
export function nextNo(prefix, existing, pad = 3) {
  let max = 0;
  const re = new RegExp('^' + prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '-?(\\d+)$');
  for (const s of existing) { const m = re.exec(String(s || '')); if (m) max = Math.max(max, +m[1]); }
  return prefix + '-' + String(max + 1).padStart(pad, '0');
}

export function uuid4() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
