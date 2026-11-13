// Lisans (13.11.2026, kullanıcı kararları: AutoCAD eklentisi ve telefon; internetsiz, cihaza bağlı; bitiş tarihi her
// lisansta seçilir ya da süresiz; lisanssız 7 gün çalışır, sonra kapanır). AutoCAD eklentisindeki Cekirdek/Lisans.cs ile
// aynı kurallar; ortak denemeler ortak/deneme/lisans/vektorler.json. Biçim ve araçlar: ortak/LISANS.md.
//
// Cihaz kodu: önek ("PC" AutoCAD, "TL" telefon, "WB" web) + SHA-256("sebeke-hakedis|cihaz|" + ham kimlik) ilk 10 baytı,
// Crockford base32 (16 harf), dörderli gruplar: TL-ABCD-EFGH-JKMN-PQRS.
// Lisans metni: "SHL1." + base64url(yük JSON) + "." + base64url(imza); imza "SHL1." + base64url(yük) metninin
// RSASSA-PKCS1-v1_5 / SHA-256 imzasıdır (2048 bit). Doğrulama yalnız açık anahtarla yapılır; gizli anahtar programda yoktur.

export const ONEK = 'SHL1';
export const DENEME_GUN = 7;
export const UYARI_GUN = 15;
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ---------------------------------------------------------------- SHA-256 (eşzamanlı; WebView'de crypto.subtle her zaman yok)
const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : utf8(String(bytes));
  const l = b.length, n = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(n); m.set(b); m[l] = 0x80;
  const bits = l * 8; const dv = new DataView(m.buffer);
  dv.setUint32(n - 8, Math.floor(bits / 0x100000000)); dv.setUint32(n - 4, bits >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = W[i - 15], c = W[i - 2]; W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(c, 17) ^ r(c, 19) ^ (c >>> 10))) >>> 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32); const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}

// ---------------------------------------------------------------- yardımcılar
export function utf8(s) { return new TextEncoder().encode(s); }
const utf8Coz = (u8) => new TextDecoder().decode(u8);
export function b64uCoz(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const p = t + '==='.slice((t.length + 3) % 4);
  const bin = atob(p); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
export function b64u(u8) {
  let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const bayttanSayi = (u8) => { let x = 0n; for (const v of u8) x = (x << 8n) | BigInt(v); return x; };
function usMod(b, e, m) { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; e >>= 1n; b = (b * b) % m; } return r; }
/** Tarih yazısı (YYYY-AA-GG) → gün sayısı (UTC); okunamazsa null. */
function gun(t) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t || '')); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null; }
/** Bugünün yerel tarihi YYYY-AA-GG. */
export function bugunYazisi(d = new Date()) { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
const tarihTr = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(t || ''); };

// ---------------------------------------------------------------- cihaz kodu
/** Ham cihaz kimliğinden (Windows MachineGuid, Android ANDROID_ID, web rastgele) gösterilen cihaz kodu. */
export function cihazKodu(onek, ham) {
  const h = sha256(utf8('sebeke-hakedis|cihaz|' + String(ham || '').trim().toLowerCase()));
  let bit = 0, deger = 0, s = '';
  for (let i = 0; i < 10; i++) { deger = (deger << 8) | h[i]; bit += 8; while (bit >= 5) { s += B32[(deger >>> (bit - 5)) & 31]; bit -= 5; } deger &= (1 << bit) - 1; }
  return String(onek || 'TL').toUpperCase() + '-' + s.match(/.{4}/g).join('-');
}
/** Cihaz kodunu karşılaştırmak için sadeleştirir (büyük harf, boşluksuz). */
export const kodSade = (k) => String(k || '').toUpperCase().replace(/\s+/g, '');

// ---------------------------------------------------------------- lisans metni
/** Metnin içinden lisansı bulur (boşluk / satır sonları atılır; .lisans dosyasındaki açıklama satırları yok sayılır). */
export function lisansAyikla(metin) {
  const m = /SHL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(String(metin || '').replace(/\s+/g, ''));
  return m ? m[0] : '';
}
/** Lisansın yükü (imzaya bakmadan); okunamazsa null. */
export function lisansCoz(metin) {
  const l = lisansAyikla(metin);
  if (!l) return null;
  try {
    const [, y] = l.split('.');
    const o = JSON.parse(utf8Coz(b64uCoz(y)));
    if (!o || typeof o !== 'object' || o.v !== 1 || !o.cihaz) return null;
    return { v: 1, no: String(o.no || ''), ad: String(o.ad || ''), cihaz: String(o.cihaz), urun: String(o.urun || 'hepsi'), verildi: String(o.verildi || ''), bitis: String(o.bitis || '') };
  } catch (e) { return null; }
}
const DIGEST_INFO = [0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20];
/** İmza doğrulama (RSASSA-PKCS1-v1_5, SHA-256). anahtar: { n: base64url modül, e: üs }. */
export function imzaDogru(metin, anahtar) {
  const l = lisansAyikla(metin);
  if (!l || !anahtar || !anahtar.n) return false;
  try {
    const [o, y, s] = l.split('.');
    const nB = b64uCoz(anahtar.n), k = nB.length, sig = b64uCoz(s);
    if (sig.length !== k) return false;
    const n = bayttanSayi(nB), S = bayttanSayi(sig);
    if (S >= n) return false;
    let m = usMod(S, BigInt(anahtar.e || 65537), n);
    const em = new Uint8Array(k);
    for (let i = k - 1; i >= 0; i--) { em[i] = Number(m & 0xffn); m >>= 8n; }
    const h = sha256(utf8(o + '.' + y));
    const T = DIGEST_INFO.concat(Array.from(h));
    const ps = k - 3 - T.length;
    if (ps < 8 || em[0] !== 0 || em[1] !== 1 || em[2 + ps] !== 0) return false;
    for (let i = 0; i < ps; i++) if (em[2 + i] !== 0xff) return false;
    for (let i = 0; i < T.length; i++) if (em[3 + ps + i] !== T[i]) return false;
    return true;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------- durum
const HATA = {
  okunamadi: () => 'Lisans okunamadı: metni eksiksiz yapıştırın.',
  imza: () => 'Lisans geçersiz (imza tutmuyor).',
  cihaz: (b) => 'Lisans başka bir cihaz için üretilmiş (' + b.cihaz + ').',
  urun: () => 'Lisans bu program için değil.',
  sure: (b) => 'Lisansın süresi doldu (' + tarihTr(b.bitis) + ').',
};

/**
 * Lisans durumu. g: { lisans, cihaz, urun ('eklenti' | 'telefon'), bugun, ilkAcilis, sonGorulme } (tarihler YYYY-AA-GG),
 * anahtar: açık anahtar. Döner: { tur: 'lisansli' | 'deneme' | 'bitti', kullanilabilir, kalanGun, uyari, hataKodu, hata,
 * saatGeri, bilgi, mesaj }. Saat geri alınmışsa (bugün son görülmeden 1 günden fazla önce) son görülme tarihi esas alınır.
 */
export function lisansDurumu(g, anahtar) {
  const bugun = gun(g.bugun), son = gun(g.sonGorulme), ilk = gun(g.ilkAcilis);
  const saatGeri = bugun != null && son != null && bugun < son - 1;
  const etkin = Math.max(bugun ?? 0, son ?? bugun ?? 0);
  let hataKodu = '', bilgi = null;
  if (lisansAyikla(g.lisans)) {
    bilgi = lisansCoz(g.lisans);
    if (!bilgi) hataKodu = 'okunamadi';
    else if (!imzaDogru(g.lisans, anahtar)) hataKodu = 'imza';
    else if (kodSade(bilgi.cihaz) !== kodSade(g.cihaz)) hataKodu = 'cihaz';
    else if (bilgi.urun !== 'hepsi' && bilgi.urun !== g.urun) hataKodu = 'urun';
    else if (bilgi.bitis && (gun(bilgi.bitis) == null || etkin > gun(bilgi.bitis))) hataKodu = 'sure';
    else {
      const kalan = bilgi.bitis ? gun(bilgi.bitis) - etkin : null;
      const uyari = kalan != null && kalan <= UYARI_GUN;
      const mesaj = 'Lisanslı: ' + (bilgi.ad || 'kayıtlı kullanıcı') + (bilgi.bitis ? ' · bitiş ' + tarihTr(bilgi.bitis) + ' (' + kalan + ' gün kaldı)' : ' · süresiz');
      return { tur: 'lisansli', kullanilabilir: true, kalanGun: kalan, uyari, hataKodu: '', hata: '', saatGeri, bilgi, mesaj };
    }
  }
  const hata = hataKodu ? HATA[hataKodu](bilgi || {}) : '';
  const gecen = ilk == null ? 0 : Math.max(0, etkin - ilk);
  const kalan = DENEME_GUN - gecen;
  if (kalan > 0) return { tur: 'deneme', kullanilabilir: true, kalanGun: kalan, uyari: true, hataKodu, hata, saatGeri, bilgi, mesaj: 'Deneme sürümü: ' + kalan + ' gün kaldı' + (hata ? ' · ' + hata : '') };
  return { tur: 'bitti', kullanilabilir: false, kalanGun: 0, uyari: true, hataKodu, hata, saatGeri, bilgi, mesaj: hataKodu === 'sure' ? hata + ' Yeni lisans girin.' : hata ? hata + ' Deneme süresi de doldu.' : 'Deneme süresi doldu. Devam etmek için lisans girin.' };
}
