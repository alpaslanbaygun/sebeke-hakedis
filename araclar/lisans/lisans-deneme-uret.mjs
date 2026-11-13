#!/usr/bin/env node
// Ortak lisans denemelerini üretir: ortak/deneme/lisans/vektorler.json. Her çalıştırmada YENİ bir deneme anahtarı
// kurulur (gizli anahtarı yazılmaz); beklenen sonuçlar burada elle yazılıdır, iki uygulamanın (Cekirdek/Lisans.cs,
// telefon core/lisans.js) bunları aynı vermesi denenir (CekirdekTest, telefon tests/lisans.test.mjs).
// Kullanım: node araclar/lisans/lisans-deneme-uret.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { anahtarCifti, yukKur, lisansImzala, lisansDosyasi } from './lisans-ortak.mjs';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const deneme = anahtarCifti(), yabanci = anahtarCifti();

// Cihaz kodu (bağımsız hesap: Node SHA-256 + Crockford base32)
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function kod(onek, ham) {
  const h = crypto.createHash('sha256').update('sebeke-hakedis|cihaz|' + ham.trim().toLowerCase(), 'utf8').digest();
  let bits = ''; for (let i = 0; i < 10; i++) bits += h[i].toString(2).padStart(8, '0');
  let s = ''; for (let i = 0; i < 80; i += 5) s += B32[parseInt(bits.slice(i, i + 5), 2)];
  return onek + '-' + s.match(/.{4}/g).join('-');
}
const cihazlar = [
  { onek: 'PC', ham: '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b' },
  { onek: 'TL', ham: '9774d56d682e549c' },
  { onek: 'WB', ham: '  Web-Rastgele-Kimlik-1234  ' },
].map((c) => Object.assign(c, { kod: kod(c.onek, c.ham) }));
const PC = cihazlar[0].kod, TL = cihazlar[1].kod;

const imzala = (o, anahtar = deneme.ozelPem) => lisansImzala(yukKur(o), anahtar);
const L = (o) => imzala(Object.assign({ no: 'D-1', ad: 'Deneme Kullanıcısı', cihaz: PC, urun: 'eklenti', verildi: '2026-11-13' }, o));
// İmzası tutan lisansın yükünü değiştir (imza aynı kalır)
const degistir = (lisans, yama) => { const [o, y, s] = lisans.split('.'); const j = JSON.parse(Buffer.from(y, 'base64url').toString('utf8')); return [o, Buffer.from(JSON.stringify(Object.assign(j, yama))).toString('base64url'), s].join('.'); };

const B = '2026-11-13';
const durumlar = [
  { ad: 'süreli geçerli', lisans: L({ bitis: '2027-11-13' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-10-01', sonGorulme: B, beklenen: { tur: 'lisansli', kullanilabilir: true, kalanGun: 365, uyari: false, hataKodu: '', saatGeri: false } },
  { ad: 'süresiz', lisans: L({ bitis: '' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-01-01', sonGorulme: B, beklenen: { tur: 'lisansli', kullanilabilir: true, kalanGun: null, uyari: false, hataKodu: '', saatGeri: false } },
  { ad: '15 gün kala uyarı', lisans: L({ bitis: '2026-11-28' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: B, sonGorulme: B, beklenen: { tur: 'lisansli', kullanilabilir: true, kalanGun: 15, uyari: true, hataKodu: '', saatGeri: false } },
  { ad: 'bitiş günü hâlâ geçerli', lisans: L({ bitis: B }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-01-01', sonGorulme: B, beklenen: { tur: 'lisansli', kullanilabilir: true, kalanGun: 0, uyari: true, hataKodu: '', saatGeri: false } },
  { ad: 'süresi dolmuş, deneme de bitmiş', lisans: L({ bitis: '2026-11-12' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-10-01', sonGorulme: B, beklenen: { tur: 'bitti', kullanilabilir: false, kalanGun: 0, uyari: true, hataKodu: 'sure', saatGeri: false } },
  { ad: 'süresi dolmuş, deneme sürüyor', lisans: L({ bitis: '2026-11-12' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-11-11', sonGorulme: B, beklenen: { tur: 'deneme', kullanilabilir: true, kalanGun: 5, uyari: true, hataKodu: 'sure', saatGeri: false } },
  { ad: 'başka cihaz', lisans: L({ cihaz: TL, urun: 'hepsi' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: B, sonGorulme: B, beklenen: { tur: 'deneme', kullanilabilir: true, kalanGun: 7, uyari: true, hataKodu: 'cihaz', saatGeri: false } },
  { ad: 'başka anahtarla imzalı', lisans: imzala({ no: 'X', ad: 'Sahte', cihaz: PC, urun: 'eklenti', verildi: B }, yabanci.ozelPem), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-10-01', sonGorulme: B, beklenen: { tur: 'bitti', kullanilabilir: false, kalanGun: 0, uyari: true, hataKodu: 'imza', saatGeri: false } },
  { ad: 'yükü değiştirilmiş (bitiş uzatılmış)', lisans: degistir(L({ bitis: '2026-12-01' }), { bitis: '2099-12-31' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-10-01', sonGorulme: B, beklenen: { tur: 'bitti', kullanilabilir: false, kalanGun: 0, uyari: true, hataKodu: 'imza', saatGeri: false } },
  { ad: 'bozuk metin', lisans: 'SHL1.YWJj.ZGVm', cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: B, sonGorulme: B, beklenen: { tur: 'deneme', kullanilabilir: true, kalanGun: 7, uyari: true, hataKodu: 'okunamadi', saatGeri: false } },
  { ad: 'başka ürün (telefon lisansı eklentide)', lisans: L({ urun: 'telefon' }), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: '2026-10-01', sonGorulme: B, beklenen: { tur: 'bitti', kullanilabilir: false, kalanGun: 0, uyari: true, hataKodu: 'urun', saatGeri: false } },
  { ad: '"hepsi" lisansı telefonda', lisans: L({ cihaz: TL, urun: 'hepsi', bitis: '2027-01-12' }), cihaz: TL, urun: 'telefon', bugun: B, ilkAcilis: '2026-10-01', sonGorulme: B, beklenen: { tur: 'lisansli', kullanilabilir: true, kalanGun: 60, uyari: false, hataKodu: '', saatGeri: false } },
  { ad: 'lisanssız ilk gün', lisans: '', cihaz: TL, urun: 'telefon', bugun: B, ilkAcilis: B, sonGorulme: B, beklenen: { tur: 'deneme', kullanilabilir: true, kalanGun: 7, uyari: true, hataKodu: '', saatGeri: false } },
  { ad: 'lisanssız son gün', lisans: '', cihaz: TL, urun: 'telefon', bugun: B, ilkAcilis: '2026-11-07', sonGorulme: B, beklenen: { tur: 'deneme', kullanilabilir: true, kalanGun: 1, uyari: true, hataKodu: '', saatGeri: false } },
  { ad: 'lisanssız 8. gün kapanır', lisans: '', cihaz: TL, urun: 'telefon', bugun: B, ilkAcilis: '2026-11-06', sonGorulme: B, beklenen: { tur: 'bitti', kullanilabilir: false, kalanGun: 0, uyari: true, hataKodu: '', saatGeri: false } },
  { ad: 'saat geri alınmış (deneme son görülmeden sayılır)', lisans: '', cihaz: TL, urun: 'telefon', bugun: '2026-11-10', ilkAcilis: '2026-11-15', sonGorulme: '2026-11-20', beklenen: { tur: 'deneme', kullanilabilir: true, kalanGun: 2, uyari: true, hataKodu: '', saatGeri: true } },
  { ad: 'saat geri alınmış (süresi geçmiş lisans geçmez)', lisans: L({ bitis: '2026-11-15' }), cihaz: PC, urun: 'eklenti', bugun: '2026-11-10', ilkAcilis: '2026-10-01', sonGorulme: '2026-11-20', beklenen: { tur: 'bitti', kullanilabilir: false, kalanGun: 0, uyari: true, hataKodu: 'sure', saatGeri: true } },
  { ad: '.lisans dosyası (açıklama satırları, satır sonları)', lisans: (() => { const y = yukKur({ no: 'D-2', ad: 'Dosya', cihaz: PC, urun: 'eklenti', verildi: B, bitis: '2027-05-13' }); const l = lisansImzala(y, deneme.ozelPem); return lisansDosyasi(y, l.slice(0, 120) + '\n' + l.slice(120)); })(), cihaz: PC, urun: 'eklenti', bugun: B, ilkAcilis: B, sonGorulme: B, beklenen: { tur: 'lisansli', kullanilabilir: true, kalanGun: 181, uyari: false, hataKodu: '', saatGeri: false } },
  { ad: 'cihaz kodu küçük harf ve boşluklu girilmiş', lisans: L({}), cihaz: ' ' + PC.toLowerCase() + ' ', urun: 'eklenti', bugun: B, ilkAcilis: B, sonGorulme: B, beklenen: { tur: 'lisansli', kullanilabilir: true, kalanGun: null, uyari: false, hataKodu: '', saatGeri: false } },
];

const cikti = {
  bicim: 'sebeke-hakedis.lisans-deneme', surum: 1,
  aciklama: 'Ortak lisans denemeleri: araclar/lisans/lisans-deneme-uret.mjs üretir (her seferinde yeni deneme anahtarı; gizli anahtar yazılmaz). Eklenti (Cekirdek/Lisans.cs, CekirdekTest) ve telefon (core/lisans.js, tests/lisans.test.mjs) aynı sonucu vermeli. Bu anahtar yalnız denemeler içindir; programlar ortak/lisans/acik-anahtar.json ile doğrular.',
  anahtar: deneme.acik, cihazlar, durumlar,
};
const yol = path.join(kok, 'ortak/deneme/lisans/vektorler.json');
fs.writeFileSync(yol, JSON.stringify(cikti, null, 1) + '\n');
console.log(path.relative(kok, yol) + ': ' + durumlar.length + ' durum, ' + cihazlar.length + ' cihaz kodu');
