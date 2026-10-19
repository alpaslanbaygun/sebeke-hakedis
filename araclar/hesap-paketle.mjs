#!/usr/bin/env node
// Hesap Merkezi paketleyicisi.
//
// Girdi (depoda):
//   ortak/hesap/kaynak/<id>.html   hesap araçlarının kendi dosyaları (yalnız gerçek proje örnekleri temizlendi,
//                                  bkz. ortak/hesap/kaynak/DEGISIKLIKLER.md); hesap kodlarına dokunulmaz
//   ortak/hesap/moduller.json      hesap listesi: ad, grup, hangi direk / hat / trafo için uygun olduğu
//   ortak/hesap/kopru-bas.js       sayfa başı köprüsü (tarayıcı belleği, telefonda yazdırma ve dosya)
//   ortak/hesap/kopru.js           Şebeke-M üst çubuğu, bağlam, kayıt, güncellik
//   ortak/hesap/tema.css           ortak koyu tema (yalnız ekranda; yazdırma aracın kendi düzeninde)
//   ortak/hesap/uyarlama/<id>.js   her hesabın uyarlaması (bağlamı giriş alanlarına yazar, sonucu okur)
//   ortak/hesap/uyarlama/<id>.css  her hesabın tema düzeltmeleri
//   ortak/hesap/merkez.html        AutoCAD'in hesap merkezi sayfası (hesap listesi ve kayıtlı sonuçlar)
// Çıktı: ortak/hesap/paket/ (depoya konmaz; telefon derlemesi ve AutoCAD derlemesi çalıştırır)
//   <id>.html, merkez.html, moduller.json, ortak/{kopru-bas.js, kopru.js, tema.css, amblem.png, yazı tipleri}
//
// Kullanım: node araclar/hesap-paketle.mjs [çıktı klasörü]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = path.join(kok, 'ortak/hesap');

/** Etiketin <script>…</script> blokları dışındaki ilk (ya da son) konumu; yoksa -1. */
export function disaridaBul(html, etiket, sonuncu) {
  // Yalnız ASCII harfler küçültülür: toLowerCase() Türkçe İ'yi iki karaktere çevirip konumları kaydırır
  const kucuk = html.replace(/[A-Z]/g, (c) => c.toLowerCase());
  let i = 0, bulunan = -1;
  while (i < kucuk.length) {
    const s = kucuk.indexOf('<script', i);
    const e = kucuk.indexOf(etiket, i);
    if (e < 0) break;
    if (s >= 0 && s < e) {
      const kapanis = kucuk.indexOf('</script', s + 7);
      if (kapanis < 0) break;
      i = kucuk.indexOf('>', kapanis) + 1;
      continue;
    }
    bulunan = e;
    if (!sonuncu) return e;
    i = e + etiket.length;
  }
  return bulunan;
}

/** Hesap sayfasına köprüyü ve temayı ekler (hesabın kendi kodları olduğu gibi kalır). */
export function ekle(html, bas, stil, son) {
  // 1) sayfa başı: <head> açılışından (varsa charset bildiriminden) hemen sonra
  let h = disaridaBul(html, '<head', false);
  if (h < 0) throw new Error('<head> bulunamadı');
  let p = html.indexOf('>', h) + 1;
  const cs = /<meta\s+charset\s*=\s*["']?[\w-]+["']?\s*\/?>/i.exec(html.slice(p, p + 400));
  if (cs && /^\s*$/.test(html.slice(p, p + cs.index))) p += cs.index + cs[0].length;
  html = html.slice(0, p) + '\n' + bas + '\n' + html.slice(p);
  // 2) tema: </head> kapanışından hemen önce (aracın kendi stillerinden sonra gelir)
  const hk = disaridaBul(html, '</head>', false);
  if (hk < 0) throw new Error('</head> bulunamadı');
  html = html.slice(0, hk) + stil + '\n' + html.slice(hk);
  // 3) uyarlama + köprü: son </body> kapanışından hemen önce
  const bk = disaridaBul(html, '</body>', true);
  if (bk < 0) html = html + '\n' + son + '\n';
  else html = html.slice(0, bk) + son + '\n' + html.slice(bk);
  return html;
}

function scriptGuvenli(js, ad) {
  if (/<\/script/i.test(js)) throw new Error(ad + ': içinde "</script" geçemez (\\x3c/script yazın)');
  return js;
}
function jsonGuvenli(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));
}
const oku = (p) => fs.readFileSync(p, 'utf8');

/** ortak/hesap/kurallar.mjs → sayfalarda kullanılacak düz betik (window.SMKural). */
export function kurallarBetigi() {
  const src = oku(path.join(H, 'kurallar.mjs'));
  const adlar = [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
  const govde = src.replace(/^export /gm, '');
  return scriptGuvenli('/* ortak/hesap/kurallar.mjs dosyasından üretilir (araclar/hesap-paketle.mjs). Elle düzenlenmez. */\n' +
    'window.SMKural = (function () {\n' + govde + '\nreturn { ' + adlar.join(', ') + ' };\n})();\n', 'kurallar.mjs');
}
const varMi = (p) => fs.existsSync(p);

export function paketle(cikti = path.join(H, 'paket'), { sessiz = false } = {}) {
  const kayit = JSON.parse(oku(path.join(H, 'moduller.json')));
  fs.rmSync(cikti, { recursive: true, force: true });
  fs.mkdirSync(path.join(cikti, 'ortak'), { recursive: true });

  // Ortak dosyalar
  for (const f of ['kopru-bas.js', 'kopru.js']) fs.writeFileSync(path.join(cikti, 'ortak', f), scriptGuvenli(oku(path.join(H, f)), f));
  fs.writeFileSync(path.join(cikti, 'ortak/kurallar.js'), kurallarBetigi());
  fs.copyFileSync(path.join(H, 'tema.css'), path.join(cikti, 'ortak/tema.css'));
  fs.copyFileSync(path.join(kok, 'ortak/marka/sebeke-m-simge-64.png'), path.join(cikti, 'ortak/amblem.png'));
  fs.copyFileSync(path.join(kok, 'ortak/marka/sebeke-m-logo.png'), path.join(cikti, 'ortak/logo.png'));
  const fontlar = path.join(kok, 'telefon/web/fonts');
  for (const f of fs.readdirSync(fontlar)) if (f.endsWith('.woff2')) fs.copyFileSync(path.join(fontlar, f), path.join(cikti, 'ortak', f));

  const gruplar = Object.fromEntries((kayit.gruplar || []).map((g) => [g.id, g]));
  const liste = [];
  for (const m of kayit.moduller) {
    const kopya = Object.assign({}, m);
    if (m.sayfa && m.sayfa !== m.id) { liste.push(kopya); continue; } // başka bir hesabın bölümüne açılan kısayol
    const kaynakYolu = path.join(H, 'kaynak', m.id + '.html');
    const src = oku(kaynakYolu);
    const uyJs = varMi(path.join(H, 'uyarlama', m.id + '.js')) ? oku(path.join(H, 'uyarlama', m.id + '.js')) : 'window.__SM_UYARLAMA = {};';
    const uyCss = varMi(path.join(H, 'uyarlama', m.id + '.css')) ? oku(path.join(H, 'uyarlama', m.id + '.css')) : '';
    const surum = crypto.createHash('sha256').update(src).update('\0').update(uyJs).update('\0').update(uyCss).digest('hex').slice(0, 12);
    const yapi = {
      modul: m.id, ad: m.ad, kisa: m.kisa, grup: m.grup, grupAdi: (gruplar[m.grup] || {}).ad || '', surum,
      ortak: 'ortak/', kaynak: m.kaynak || ''
    };
    const bas = '<script>window.__SM=' + jsonGuvenli(yapi) + ';</script><script src="ortak/kopru-bas.js"></script>';
    const stil = '<link rel="stylesheet" href="ortak/tema.css">' + (uyCss ? '<style id="sm-modul-tema">\n' + uyCss + '\n</style>' : '');
    const son = '<script src="ortak/kurallar.js"></script><script>\n' + scriptGuvenli(uyJs, 'uyarlama/' + m.id + '.js') + '\n</script><script src="ortak/kopru.js"></script>';
    fs.writeFileSync(path.join(cikti, m.id + '.html'), ekle(src, bas, stil, son));
    kopya.surum = surum;
    liste.push(kopya);
  }
  const ozet = Object.assign({}, kayit, { moduller: liste });
  fs.writeFileSync(path.join(cikti, 'moduller.json'), JSON.stringify(ozet, null, 1));
  // AutoCAD'in hesap merkezi sayfası: hesap listesi sayfaya gömülür
  if (varMi(path.join(H, 'merkez.html'))) {
    const merkez = oku(path.join(H, 'merkez.html')).replace('/*__MODULLER__*/null', jsonGuvenli(ozet));
    fs.writeFileSync(path.join(cikti, 'merkez.html'), merkez);
  }
  if (!sessiz) console.log('ortak/hesap/paket: ' + liste.filter((m) => !m.sayfa || m.sayfa === m.id).length + ' hesap sayfası, merkez.html, ortak/');
  return ozet;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  paketle(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
}
