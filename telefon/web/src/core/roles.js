// Hakediş onay mekanizması (v2.3): roller, yetkiler, PIN.
// Projede en az bir etkin Yönetici tanımlanınca devreye girer; tanımlı kullanıcı yoksa uygulama eskisi gibi kısıtsız çalışır.
// Hakediş durumu sırası: YAPILACAK → BASLANDI → TAMAMLANDI → KONTROL → HAKEDISTE → ONAYLI
import { HAK_STATUSES, HAK_ORDER, hakOf } from './schema.js';

export const ROLES = {
  saha: { label: 'Saha operatörü', short: 'SAHA', color: '#38bdf8', does: 'İşi başlatır ve "Tamamlandı" yapar.' },
  kontrol: { label: 'Kontrol mühendisi', short: 'KONTROL', color: '#c084fc', does: 'Tamamlanan işi yerinde kontrol edip onaylar ya da geri çevirir.' },
  hakedis: { label: 'Hakediş sorumlusu', short: 'HAKEDİŞ', color: '#fb923c', does: 'Kontrol edilmiş işleri hakedişe alır, hakediş dönemini açar.' },
  onay: { label: 'Onay yetkilisi', short: 'ONAY', color: '#22c55e', does: 'Hakedişi onaylar ya da geri çevirir, dönemi kapatır.' },
  yonetici: { label: 'Yönetici', short: 'YÖNETİCİ', color: '#fbbf24', does: 'Kullanıcı ekler, rol verir; gerektiğinde her adımı yapabilir.' }
};
export const ROLE_ORDER = ['saha', 'kontrol', 'hakedis', 'onay', 'yonetici'];

// İzinli geçişler: "ileri" adımlar onay, "geri" adımlar ret / geri çekme (gerekçe zorunlu)
const FIELD = ['YAPILACAK', 'BASLANDI', 'TAMAMLANDI'];
const RULES = {
  saha: (f, t) => FIELD.includes(f) && FIELD.includes(t),
  kontrol: (f, t) => (f === 'TAMAMLANDI' && t === 'KONTROL') || ((f === 'TAMAMLANDI' || f === 'KONTROL') && t === 'BASLANDI') || (f === 'KONTROL' && t === 'TAMAMLANDI'),
  hakedis: (f, t) => (f === 'KONTROL' && t === 'HAKEDISTE') || (f === 'HAKEDISTE' && t === 'KONTROL'),
  onay: (f, t) => (f === 'HAKEDISTE' && t === 'ONAYLI') || (f === 'HAKEDISTE' && t === 'KONTROL') || (f === 'ONAYLI' && t === 'HAKEDISTE'),
  yonetici: () => true
};
const ACTIONS = {
  'period.create': ['hakedis', 'yonetici'],
  'period.approve': ['onay', 'yonetici'],
  'members.manage': ['yonetici'],
  'material.approve': ['kontrol', 'yonetici']
};

export const activeMembers = (project) => ((project && project.members) || []).filter((m) => m.active !== false);
// Onay mekanizması açık mı? (en az bir etkin yönetici)
export const approvalOn = (project) => activeMembers(project).some((m) => m.role === 'yonetici');
// Sıkı kip: hakedişe yalnız kontrol edilmiş işler girer (varsayılan: açık)
export const strictOn = (project) => approvalOn(project) && !(project.approval && project.approval.strict === false);

// Durum değişikliği izni. member: oturum açan kullanıcı ({ role }) ya da null.
export function canHak(project, member, from, to) {
  if (!HAK_STATUSES[to]) return { ok: false, why: 'Geçersiz durum' };
  if (from === to) return { ok: true, back: false };
  const back = HAK_ORDER.indexOf(to) < HAK_ORDER.indexOf(from);
  if (!approvalOn(project)) return { ok: true, back, needReason: false };
  if (!member) return { ok: false, why: 'Hakediş durumunu değiştirmek için oturum açın' };
  const rule = RULES[member.role];
  if (!rule || !rule(from, to)) return { ok: false, back, why: ROLES[member.role].label + ' rolü "' + HAK_STATUSES[from].label + '" → "' + HAK_STATUSES[to].label + '" adımını yapamaz · ' + whoCan(from, to) };
  return { ok: true, back, needReason: back };
}
export function whoCan(from, to) {
  const r = ROLE_ORDER.filter((k) => k !== 'yonetici' && RULES[k](from, to)).map((k) => ROLES[k].label);
  return r.length ? 'yetkili: ' + r.join(', ') + ' ya da Yönetici' : 'yalnız Yönetici yapabilir';
}
export function canDo(project, member, action) {
  if (!approvalOn(project)) return { ok: true };
  if (!member) return { ok: false, why: 'Bu işlem için oturum açın' };
  const roles = ACTIONS[action] || ['yonetici'];
  if (!roles.includes(member.role)) return { ok: false, why: 'Bu işlemi ' + roles.map((r) => ROLES[r].label).join(' ya da ') + ' yapabilir' };
  return { ok: true };
}
// Rolün onayını bekleyen durum ve onaylayınca geçeceği durum
export const PENDING = { kontrol: ['TAMAMLANDI', 'KONTROL'], hakedis: ['KONTROL', 'HAKEDISTE'], onay: ['HAKEDISTE', 'ONAYLI'] };
export const REJECT_TO = { kontrol: 'BASLANDI', hakedis: null, onay: 'KONTROL' };

// Metraj / hakediş kümülatifine girer mi?
const CHECKED = new Set(['KONTROL', 'HAKEDISTE', 'ONAYLI']);
export function countsAsDone(project, rec) {
  if (rec.progress !== 'done') return false;
  if (!strictOn(project)) return true;
  return CHECKED.has(hakOf(rec));
}

// ---------------- PIN ----------------
// Düz SHA-256 (WebView / tarayıcı / Node'da aynı sonuç; güvenli bağlam gerektirmez)
const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(bytes) {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const l = bytes.length, n = (((l + 8) >> 6) + 1) << 6;
  const m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor((l * 8) / 4294967296));
  const w = new Uint32Array(64);
  const rr = (x, s) => (x >>> s) | (x << (32 - s));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32); const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
  return out;
}
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
const ROUNDS = 1200;
export function pinHash(pin, salt) {
  let h = new TextEncoder().encode(String(salt) + ':' + String(pin));
  for (let i = 0; i < ROUNDS; i++) h = sha256(h);
  return hex(h);
}
export function validPin(pin) { return /^\d{4,8}$/.test(String(pin || '')); }
export function checkPin(member, pin) { return !!member && !!member.pinHash && pinHash(pin, member.salt) === member.pinHash; }
