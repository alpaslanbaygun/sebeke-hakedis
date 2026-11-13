// Lisans üretiminin ortak parçaları (Node): anahtar çifti, açık anahtar JSON'u, lisans imzalama. Biçim: ortak/LISANS.md.
// Gizli anahtar (PEM) hiçbir zaman depoya konmaz; yalnız lisans veren kişinin bilgisayarında durur.
import crypto from 'node:crypto';

export const ONEK = 'SHL1';
const b64u = (buf) => Buffer.from(buf).toString('base64url');

/** Yeni RSA-2048 anahtar çifti: { ozelPem, acik } (acik: ortak/lisans/acik-anahtar.json biçimi). */
export function anahtarCifti() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 65537 });
  return { ozelPem: privateKey.export({ type: 'pkcs8', format: 'pem' }), acik: acikAnahtarJson(publicKey) };
}

/** Açık anahtar → { bicim, surum, n (base64url modül), e, parmakIzi }. */
export function acikAnahtarJson(pub) {
  const k = typeof pub === 'string' ? crypto.createPublicKey(pub) : pub;
  const jwk = k.export({ format: 'jwk' });
  const e = parseInt(Buffer.from(jwk.e, 'base64url').toString('hex'), 16);
  return { bicim: 'sebeke-hakedis.lisans-anahtari', surum: 1, n: jwk.n, e, parmakIzi: parmakIzi(jwk.n) };
}

/** Anahtarın kısa parmak izi (modülün SHA-256'sının ilk 8 baytı, onaltılık): iki anahtarı karıştırmamak için. */
export function parmakIzi(n) {
  return crypto.createHash('sha256').update(Buffer.from(n, 'base64url')).digest('hex').slice(0, 16).toUpperCase().match(/.{4}/g).join('-');
}

/** Gizli anahtardan açık anahtar JSON'u. */
export function ozeldenAcik(ozelPem) { return acikAnahtarJson(crypto.createPublicKey(crypto.createPrivateKey(ozelPem))); }

/** Lisans yükünü sıralı alanlarla kurar. */
export function yukKur({ no = '', ad = '', cihaz, urun = 'hepsi', verildi, bitis = '' }) {
  if (!cihaz) throw new Error('Cihaz kodu gerekli');
  if (!['hepsi', 'eklenti', 'telefon'].includes(urun)) throw new Error('Ürün hepsi / eklenti / telefon olmalı');
  if (bitis && !/^\d{4}-\d{2}-\d{2}$/.test(bitis)) throw new Error('Bitiş tarihi YYYY-AA-GG olmalı');
  return { v: 1, no: String(no), ad: String(ad), cihaz: String(cihaz).toUpperCase().replace(/\s+/g, ''), urun, verildi: verildi || new Date().toISOString().slice(0, 10), bitis: bitis || '' };
}

/** Lisans metni: SHL1.<yük>.<imza> (imza: "SHL1.<yük>" metninin RSASSA-PKCS1-v1_5 / SHA-256 imzası). */
export function lisansImzala(yuk, ozelPem) {
  const m = ONEK + '.' + b64u(JSON.stringify(yuk));
  const imza = crypto.sign('sha256', Buffer.from(m, 'ascii'), crypto.createPrivateKey(ozelPem));
  return m + '.' + b64u(imza);
}

/** .lisans dosyasının metni (açıklama satırları + lisans). */
export function lisansDosyasi(yuk, lisans) {
  return ['# Şebeke-M Hakediş lisansı', '# Kime: ' + (yuk.ad || '-'), '# Cihaz: ' + yuk.cihaz, '# Ürün: ' + yuk.urun,
    '# Bitiş: ' + (yuk.bitis || 'süresiz'), '# Lisans no: ' + (yuk.no || '-'), '', lisans, ''].join('\n');
}
