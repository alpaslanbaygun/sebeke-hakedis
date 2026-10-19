// Hesap Merkezi ortak kuralları: iletken adı çözümleme, eşdeğer açıklık ve hangi hesabın hangi hedefte
// açılabileceği. Telefon uygulaması bu dosyayı doğrudan alır; hesap sayfaları ve AutoCAD hesap merkezi için
// paketleyici (araclar/hesap-paketle.mjs) aynı kodu ortak/kurallar.js olarak (window.SMKural) yazar.

// ---- İletken adı ----
// Telefon ve AutoCAD yazımlarını tek biçime çevirir: "3xSwallow" = "3xSW", "3P+R", "3x50/16+70 AER" =
// "3X50/16+70 ALPEK", "NAYY 3x95+50" = "3x95+50 Nyy Alm.", "3x(1x150/25) NA2XSY" = "1x150/25 Xlpe Alm.".
// Döner: { ad, aile: 'ACSR'|'AAC'|'ABC'|'NAYY'|'NYY'|'XLPE-AL'|'XLPE-CU'|null, devre: 'OG'|'AG'|null,
//          tel (ACSR / AAC tel adı), fazSayisi, kesit (mm²), notr (mm² ya da tel adı), aydinlatma, ekran, yalitim }
const ACSR = [['SWAN', /\bSWAN\b/], ['SWALLOW', /SWALLOW|\bSW\b/], ['SPARROW', /SPARROW/], ['ROBIN', /ROBIN/],
  ['RAVEN', /RAVEN|(^|[^\d])1\/0/], ['PIGEON', /PIGEON|(^|[^\d])3\/0/], ['PARTRIDGE', /PARTRIDGE|PATRIDGE|266/],
  ['OSTRICH', /OSTRICH|(^|[^\d])300\s*MCM/], ['HAWK', /HAWK|477/], ['DRAKE', /DRAKE|795/]];
const AAC = { R: 'ROSE', L: 'LILY', I: 'IRIS', P: 'PANSY', PO: 'POPPY', A: 'ASTER', PH: 'PHLOX', O: 'OXLIP' };
const AAC_AD = /(ROSE|LILY|IRIS|PANSY|POPPY|ASTER|PHLOX|OXLIP)/;

export function iletkenCoz(ad) {
  const ham = String(ad == null ? '' : ad);
  const s = ham.toUpperCase().replace(/İ/g, 'I').replace(/\\/g, '/').replace(/,/g, '.').replace(/×/g, 'X').replace(/\s+/g, ' ').trim();
  const r = { ad: ham, aile: null, devre: null };
  if (!s) return r;
  const sk = s.replace(/\s+/g, '');
  let m;
  if (/AER|ALPEK|ALP\.|ABC|ASKILI/.test(s)) {                       // hava hattı demet kablo
    r.aile = 'ABC'; r.devre = 'AG';
    m = sk.match(/(\d)X(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?)|\+1X(\d+(?:\.\d+)?))?\+(\d+(?:\.\d+)?)/);
    if (m) { r.fazSayisi = +m[1]; r.kesit = +m[2]; if (m[3] || m[4]) r.aydinlatma = +(m[3] || m[4]); r.notr = +m[5]; }
    return r;
  }
  if (/XLPE|2XS|YE3SV|N2XSY|NA2XSY/.test(s)) {                     // OG XLPE kablo
    r.aile = /NA2X|ALM|\bAL\b|ALUM/.test(s) ? 'XLPE-AL' : 'XLPE-CU'; r.devre = 'OG'; r.yalitim = 'xlpe';
    m = sk.match(/1X(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?/);
    if (m) { r.kesit = +m[1]; if (m[2]) r.ekran = +m[2]; r.fazSayisi = 3; }
    return r;
  }
  if (/NAYY|NYY|NAYBY|NYBY|N2XH|NA2XH|N2XY|NA2XY/.test(s)) {       // AG kablo
    r.aile = /NAYY|NAYBY|NA2X|ALM/.test(s) ? 'NAYY' : 'NYY'; r.devre = 'AG';
    r.yalitim = /N2X|NA2X/.test(s) ? 'xlpe' : 'pvc';
    m = sk.replace(/NAYY|NYY|NAYBY|NYBY|N2XH|NA2XH|N2XY|NA2XY|ALM\.?/g, '').match(/(\d)X(\d+(?:\.\d+)?)(?:[+/](?:1X)?(\d+(?:\.\d+)?))?/);
    if (m) { r.fazSayisi = +m[1]; r.kesit = +m[2]; if (m[3]) r.notr = +m[3]; }
    return r;
  }
  // "3xSW" → "SW", "2x3x1/0" → "1/0", "2(3xSW)" → "SW" (AutoCAD çift devre yazımı)
  const govde = sk.replace(/^\d*\(?(\d+X)+\(?/, '');
  for (const [tel, re] of ACSR) if (re.test(s) || re.test(govde)) { // çelik özlü alüminyum (OG çıplak)
    r.aile = 'ACSR'; r.devre = 'OG'; r.tel = tel;
    const cift = sk.match(/^(\d)[X(](\d)X/);                         // "2(3xSW)", "2x3x1/0" → 2 devre, 3 faz
    if (cift) { r.adet = +cift[1]; r.fazSayisi = +cift[2]; }
    else { m = sk.match(/^(\d)X/); r.fazSayisi = m ? +m[1] : 3; }
    return r;
  }
  m = sk.match(AAC_AD);                                             // AG çıplak alüminyum, tam adla
  if (m) {
    r.aile = 'AAC'; r.devre = 'AG'; r.tel = m[1];
    const n = sk.match(/^(\d)X/); r.fazSayisi = n ? +n[1] : 3;
    const nt = sk.slice(m.index + m[1].length).match(AAC_AD); if (nt) r.notr = nt[1];
    return r;
  }
  m = sk.match(/^(\d)X?(PO|PH|R|L|I|P|A|O)(?:\+(PO|PH|R|L|I|P|A|O))?$/); // kısa adla: 3P+R, 3Po+P, 3xR, 2R
  if (m) { r.aile = 'AAC'; r.devre = 'AG'; r.fazSayisi = +m[1]; r.tel = AAC[m[2]]; if (m[3]) r.notr = AAC[m[3]]; }
  return r;
}

/** Eşdeğer (ruling) açıklık √(Σa³/Σa); açıklık yoksa null. */
export function ruling(acikliklar) {
  let s1 = 0, s3 = 0;
  for (const x of acikliklar || []) { const a = typeof x === 'number' ? x : x && x.uzunluk; if (a > 0) { s1 += a; s3 += a * a * a; } }
  return s1 > 0 ? Math.sqrt(s3 / s1) : null;
}

// ---- Uygunluk ----
const HEDEF_ADI = { direk: 'direk', hat: 'hat', trafo: 'trafo', kanal: 'kanal', proje: 'proje' };
const havaiMi = (tur) => /HAVAI|MUSTEREK|AYDINLATMA/.test(String(tur || ''));
const devreleri = (tur, iletkenler) => {
  const d = new Set();
  for (const i of iletkenler || []) { const c = i.devre || iletkenCoz(i.ad).devre; if (c) d.add(c); }
  if (!d.size) {
    const t = String(tur || '');
    if (/^OG/.test(t)) d.add('OG');
    if (/^AG|AYDINLATMA/.test(t)) d.add('AG');
    if (/MUSTEREK/.test(t)) { d.add('OG'); d.add('AG'); }
  }
  return d;
};

/** Hedefin hatları: hat seçildiyse kendisi, direk seçildiyse direkten çıkan hat parçaları. */
export function hatlar(b) {
  if (!b) return [];
  if (b.hat) return [{ tur: b.hat.tur, havai: b.hat.havai != null ? b.hat.havai : havaiMi(b.hat.tur), iletkenler: b.hat.iletkenler || [] }];
  if (b.direk && b.direk.kollar) return b.direk.kollar.map((k) => ({ tur: k.hatTur, havai: havaiMi(k.hatTur), iletkenler: k.iletkenler || [] }));
  return [];
}

/**
 * Hesap bu hedefte açılabilir mi? m: moduller.json kaydı, b: bağlam (BAGLAM.md).
 * Döner { uygun: true|false, neden, not } — not: bilgi eksik olduğu için kesin karar verilemeyen durumlar.
 */
export function uygunluk(m, b) {
  const u = (m && m.uygunluk) || {};
  const hd = (b && b.hedef && b.hedef.tur) || 'proje';
  if (u.hedefler && u.hedefler.indexOf(hd) < 0) {
    const ad = u.hedefler.filter((x) => x !== 'proje').map((x) => HEDEF_ADI[x]).join(' ya da ');
    return { uygun: false, neden: 'Bu hesap ' + (ad || 'proje') + ' için açılır' };
  }
  if (hd === 'proje') return { uygun: true };
  if (hd === 'trafo') {
    const t = (b.trafo && b.trafo.tip) || '';
    if (u.trafoTur && u.trafoTur.length) {
      const kosk = /k[öo]şk|kosk|monoblok|prefabrik|bina|mod-?5/i.test(t);
      if (!kosk) return { uygun: false, neden: 'Köşk ya da bina tipi trafo merkezleri içindir' };
    }
    return { uygun: true };
  }
  if (hd === 'kanal') return { uygun: true };
  const hs = hatlar(b);
  const gerekHat = u.havai != null || (u.devre && u.devre.length) || (u.aile && u.aile.length) || (u.hatTur && u.hatTur.length);
  if (gerekHat && !hs.length) return { uygun: false, neden: hd === 'direk' ? 'Bu direğe bağlı hat yok' : 'Hat bilgisi yok' };
  let aday = hs;
  if (u.havai === true) { aday = aday.filter((h) => h.havai); if (!aday.length) return { uygun: false, neden: 'Havai hatlar içindir' }; }
  if (u.havai === false) { aday = aday.filter((h) => !h.havai); if (!aday.length) return { uygun: false, neden: 'Yeraltı kablo hatları içindir' }; }
  if (u.hatTur && u.hatTur.length) { aday = aday.filter((h) => u.hatTur.indexOf(h.tur) >= 0); if (!aday.length) return { uygun: false, neden: 'Hat türü uygun değil (' + u.hatTur.map((x) => x.replace('_', ' ').toLowerCase()).join(', ') + ')' }; }
  if (u.devre && u.devre.length) { aday = aday.filter((h) => [...devreleri(h.tur, h.iletkenler)].some((d) => u.devre.indexOf(d) >= 0)); if (!aday.length) return { uygun: false, neden: u.devre.join(' / ') + ' hatlar içindir' }; }
  if (u.aile && u.aile.length) {
    const ok = aday.some((h) => (h.iletkenler || []).some((i) => u.aile.indexOf(iletkenCoz(i.ad).aile) >= 0));
    const bilinmiyor = aday.every((h) => !(h.iletkenler || []).length);
    if (!ok && !bilinmiyor) return { uygun: false, neden: 'İletken uygun değil (' + u.aile.map((a) => a === 'ACSR' ? 'çıplak ACSR: Swallow, Raven, Pigeon, Partridge, Hawk' : a).join(', ') + ')' };
    if (bilinmiyor) return { uygun: true, not: 'Hattın iletkeni bilinmiyor' };
  }
  if (hd === 'direk' && b.direk) {
    if (u.enAzKol && (b.direk.kollar || []).length < u.enAzKol) return { uygun: false, neden: u.enAzKol === 2 ? 'İki yanında açıklık olan direkler içindir' : 'Direğe bağlı açıklık yok' };
    if (u.rol && u.rol.length) {
      if (!b.direk.rol) return { uygun: true, not: 'Direğin görevi (taşıyıcı / durdurucu) bilinmiyor' };
      if (u.rol.indexOf(b.direk.rol) < 0) return { uygun: false, neden: u.rol.indexOf('T') >= 0 && u.rol.length === 1 ? 'Taşıyıcı direkler içindir' : 'Direk görevi uygun değil' };
    }
  }
  if (hd === 'hat' && b.hat && u.enAzAciklik && (b.hat.acikliklar || []).length < u.enAzAciklik) return { uygun: false, neden: 'Hatta açıklık yok' };
  return { uygun: true };
}

// ---- Güncellik ----
// Hesap anında kullanılan bağlam değerleri ({ yol: değer }) ile bugünkü bağlam karşılaştırılır. Yol yazımı:
// "hat.acikliklar[2].uzunluk". Sayılar 1e-6 göreli payla, metinler birebir. Eklentideki HesapGuncellik ile aynı kural.
export function yolDeger(kok, yol) {
  let c = kok;
  if (c == null) return { yok: true };
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m;
  while ((m = re.exec(yol))) {
    if (m[1] !== undefined) {
      if (c === null || typeof c !== 'object' || Array.isArray(c) || !(m[1] in c)) return { yok: true };
      c = c[m[1]];
    } else {
      const n = +m[2];
      if (!Array.isArray(c) || n >= c.length) return { yok: true };
      c = c[n];
    }
  }
  return { deger: c };
}
function sayiOku(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) ? n : NaN;
}
export function esit(a, b) {
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  if (typeof a === 'number' || typeof b === 'number') { const u = sayiOku(a), v = sayiOku(b); return isFinite(u) && isFinite(v) && esit(u, v); }
  return JSON.stringify(a) === JSON.stringify(b);
}
/** İki platformun yazımları farklı olabilir ("3xSW" / "3xSwallow"): iletken adları çözülerek karşılaştırılır. */
function platformlarArasiEsit(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return esit(a, b);
  const x = iletkenCoz(a), y = iletkenCoz(b);
  if (x.aile && y.aile) return x.aile === y.aile && (x.tel || '') === (y.tel || '') && (x.kesit || 0) === (y.kesit || 0) && String(x.notr || '') === String(y.notr || '');
  return true;   // tip adı gibi yazımı platforma göre değişen metinler karşılaştırılmaz
}

/**
 * Hesaptan bu yana değişen bilgiler: [{ yol, eski, yeni, silindi }] (boşsa hesap günceldir).
 * secenek.platformlarArasi: kayıt öbür platformda yapıldıysa (telefon ↔ AutoCAD) metinler yazım farkı yüzünden
 * "değişti" sayılmaz; sayılar ve iletkenler yine karşılaştırılır.
 */
export function farklar(kullanilan, guncel, secenek) {
  const r = [];
  const ara = !!(secenek && secenek.platformlarArasi);
  for (const k of Object.keys(kullanilan || {})) {
    const g = yolDeger(guncel, k);
    if (g.yok) r.push({ yol: k, eski: kullanilan[k], silindi: true });
    else if (!(ara ? platformlarArasiEsit(kullanilan[k], g.deger) : esit(kullanilan[k], g.deger))) r.push({ yol: k, eski: kullanilan[k], yeni: g.deger });
  }
  return r;
}
