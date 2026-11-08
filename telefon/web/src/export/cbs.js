// CBS dışa aktarımları: Google Earth (KML / KMZ) ve MapInfo (MIF / MID). AutoCAD eklentisinin CbsYapisi, KmlYazici ve
// MifDosyasi (yazma) sınıflarıyla aynı yapı: aynı katmanlar ve sütunlar, aynı klasörler, renkler (ortak çizim stilinin
// ekran renkleri), simgeler ve sayı yazımı. Girdi eklentinin proje modelidir (SH.projeOku ile okunan .sebeke.json):
// telefonun dosyası eklentide açılıp aktarılınca da aynı CBS dosyaları çıkar.
// Ortak deneme: ortak/deneme/cbs — eklentinin CekirdekTest'i ve telefonun tests/cbs.test.mjs'i aynı girdiden aynı
// beklenen dosyaları üretmek zorundadır (eklenti değişince telefon da değişmeli; bkz. DEVIR.md çalışma kuralları).
import STIL from '../ortak/cizim-stili.js';
import KALEMLER from '../ortak/kalemler.js';
import SH from '../interop/sh-core.cjs';

// ---------------------------------------------------------------- Sayı yazımı (.NET ile aynı)

/**
 * .NET'in özel sayı biçimiyle aynı yazım ("0.000", "0.########"): sayı önce 15 anlamlı basamağa, sonra istenen ondalık
 * basamağa sıfırdan uzağa yuvarlanır. kirp: sondaki sıfırlar (ve gerekirse nokta) atılır ("0.###" gibi).
 */
export function netSayi(v, hane, kirp = false, ayirici = '.') {
  if (!Number.isFinite(v)) v = 0;
  const eksi = v < 0;
  const [m, e] = Math.abs(v).toExponential(14).split('e');
  let r = m.replace('.', ''), tam = +e + 1;
  if (tam <= 0) { r = '0'.repeat(1 - tam) + r; tam = 1; }
  const tut = tam + hane;
  let d = r.length > tut ? r.slice(0, tut) : r.padEnd(tut, '0');
  if (r.length > tut && r.charCodeAt(tut) >= 53) {
    const a = d.split('');
    let i = a.length - 1;
    for (; i >= 0; i--) { if (a[i] === '9') a[i] = '0'; else { a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1); break; } }
    d = a.join('');
    if (i < 0) { d = '1' + d; tam++; }
  }
  const ip = d.slice(0, tam).replace(/^0+(?=\d)/, '');
  let fp = d.slice(tam);
  if (kirp) fp = fp.replace(/0+$/, '');
  const s = ip + (fp ? ayirici + fp : '');
  return eksi && /[1-9]/.test(s) ? '-' + s : s;
}
/** .NET Math.Round(d, hane): yarımda çifte yuvarlar (eklentideki CbsYapisi.Yuvarla). */
export function yuvarla(d, hane) {
  if (!Number.isFinite(d) || Math.abs(d) >= 1e16) return d;
  const p = 10 ** hane, x = d * p;
  let r = Math.round(x);
  if (r - x === 0.5 && Math.abs(r % 2) === 1) r -= 1;
  return r / p;
}
const uzunluk = (kose) => { let t = 0; for (let i = 1; i < kose.length; i++) { const dx = kose[i][0] - kose[i - 1][0], dy = kose[i][1] - kose[i - 1][1]; t += Math.sqrt(dx * dx + dy * dy); } return t; };
const alan = (k) => { let s = 0; for (let i = 0, j = k.length - 1; i < k.length; j = i++) s += k[j][0] * k[i][1] - k[i][0] * k[j][1]; return Math.abs(s) / 2; };
const ayni = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
const metin = (v) => (v == null ? '' : String(v));

// ---------------------------------------------------------------- Katmanlar ve sütunlar (CbsYapisi)

const K = (ad, baslik, n = 40) => ({ ad, baslik, tur: 'C', uzunluk: n });
const T = (ad, baslik) => ({ ad, baslik, tur: 'I', uzunluk: 0 });
const O = (ad, baslik) => ({ ad, baslik, tur: 'F', uzunluk: 0 });
const katman = (ad, baslik, geometri, alanlar) => ({ ad, baslik, geometri, alanlar });

/** Eleman katmanlarının (DIREK, TRAFO, SDK, PANO, ELEMAN) ortak sütunları (eklentideki CbsYapisi.ElemanAlanlari). */
const elemanAlanlari = () => [
  K('KIMLIK', 'Kimlik', 20), K('GIS_NO', 'GIS no', 20), K('TUR', 'Tür kodu', 20), K('TUR_ADI', 'Tür', 40), K('CINS', 'Cins kodu', 40),
  K('CINS_ADI', 'Cins', 80), K('TIP', 'Tip', 80), K('DURUM', 'Durum', 10), K('DM_DURUM', 'Demontaj', 10), T('HAKEDIS', 'Hakediş'),
  K('GUC', 'Güç', 20), K('GERILIM', 'Gerilim', 20), K('KONTROL', 'Kontrol', 10), K('PROJE', 'Proje', 120), K('PROJE_KODU', 'Proje kodu', 40),
  K('MALZEME', 'Malzemeler', 254), T('MALZEME_SAYISI', 'Malzeme satırı'), O('SAGA', 'Sağa (Y)'), O('YUKARI', 'Yukarı (X)'), O('KOT', 'Kot'),
  O('ACI', 'Açı (derece)'), K('TELEFON_ID', 'Telefon kimliği', 40)];
export const DIREK = katman('DIREK', 'Direkler', 'nokta', elemanAlanlari());
export const TRAFO = katman('TRAFO', 'Trafolar', 'nokta', elemanAlanlari());
export const SDK = katman('SDK', 'Saha dağıtım kutuları (SDK)', 'nokta', elemanAlanlari());
export const PANO = katman('PANO', 'Panolar', 'nokta', elemanAlanlari());
/** Diğer elemanlar (mufu, kofre, diğer); eski (31.10.2026 öncesi) dosyalarda bütün elemanlar bu katmandaydı. */
export const ELEMAN = katman('ELEMAN', 'Diğer elemanlar', 'nokta', elemanAlanlari());
export const HAT = katman('HAT', 'Hatlar (iletken / kablo)', 'cizgi', [
  K('KIMLIK', 'Kimlik', 20), K('TUR', 'Tür kodu', 20), K('TUR_ADI', 'Tür', 40), K('KESIT', 'Kesit', 80),
  K('ILETKEN_CINS', 'İletken cinsi', 40), K('ILETKEN', 'İletken', 80), T('ILETKEN_ADET', 'İletken adedi'),
  K('ILETKEN2_CINS', '2. iletken cinsi', 40), K('ILETKEN2', '2. iletken', 80), T('ILETKEN2_ADET', '2. iletken adedi'),
  K('ETIKET', 'Etiket', 80), K('DURUM', 'Durum', 10), T('HAKEDIS', 'Hakediş'), K('KONTROL', 'Kontrol', 10),
  K('BAS_NO', 'Baş eleman', 20), K('BIT_NO', 'Bit eleman', 20), K('PROJE', 'Proje', 120), K('PROJE_KODU', 'Proje kodu', 40),
  O('UZUNLUK', 'Çizim uzunluğu (m)'), O('METRAJ', 'Metraj (m)'), T('MALZEME_SAYISI', 'Malzeme satırı'), K('TELEFON_ID', 'Telefon kimliği', 40)]);
export const KANAL = katman('KANAL', 'Kanallar', 'cizgi', [
  K('KIMLIK', 'Kimlik', 20), K('KABLOLAR', 'Kablolar', 20), K('ZEMIN', 'Zemin', 40), O('ALT_CM', 'Alt genişlik (cm)'),
  O('UST_CM', 'Üst genişlik (cm)'), O('DERIN_CM', 'Derinlik (cm)'), K('BAS_NO', 'Baş no', 20), K('BIT_NO', 'Bit no', 20),
  K('DURUM', 'Durum', 10), T('HAKEDIS', 'Hakediş'), K('PROJE', 'Proje', 120), K('PROJE_KODU', 'Proje kodu', 40),
  O('UZUNLUK', 'Çizim uzunluğu (m)'), O('METRAJ', 'Metraj (m)')]);
export const SONDAJ = katman('SONDAJ', 'Sondajlar', 'cizgi', [
  K('KIMLIK', 'Kimlik', 20), K('TIP', 'Tip', 80), K('BAS_NO', 'Baş no', 20), K('BIT_NO', 'Bit no', 20), K('DURUM', 'Durum', 10),
  T('HAKEDIS', 'Hakediş'), K('PROJE', 'Proje', 120), K('PROJE_KODU', 'Proje kodu', 40), O('UZUNLUK', 'Çizim uzunluğu (m)'),
  O('METRAJ', 'Metraj (m)')]);
export const BOLGE = katman('BOLGE', 'Proje sınırları', 'alan', [
  K('KIMLIK', 'Kimlik', 20), K('PROJE', 'Proje', 120), K('PROJE_KODU', 'Proje kodu', 40), K('GRUP', 'Grup kodu', 40),
  K('ACIKLAMA', 'Açıklama', 120), O('ALAN', 'Alan (m²)')]);
export const NOKTA = katman('NOKTA', 'GPS noktaları', 'nokta', [
  K('KIMLIK', 'Kimlik', 20), K('AD', 'Ad', 30), K('KOD', 'Kod', 30), O('KOT', 'Kot'), T('HAKEDIS', 'Hakediş'),
  K('PROJE', 'Proje', 120), K('EK', 'Ek bilgi', 120)]);
/** Malzeme satırları: haritada yeri yok (MIF'te "None"), her satır NESNE sütunundaki kimlikle nesnesine bağlı. */
export const MALZEME = katman('MALZEME', 'Malzemeler', 'yok', [
  K('NESNE', 'Nesne kimliği', 20), K('KATMAN', 'Nesnenin katmanı', 10), K('GIS_NO', 'GIS no', 20), K('SIRA', 'Sıra no', 20),
  K('CINS', 'Cins kodu', 40), K('TANIM', 'Tanım', 120), K('ACIKLAMA', 'Tam yazım', 120), K('DURUM', 'Durum', 10),
  K('DM_DURUM', 'Demontaj', 10), O('MIKTAR', 'Miktar'), K('BIRIM', 'Birim', 20), O('KATSAYI', 'Katsayı'), O('TOPLAM', 'Toplam'),
  T('HAKEDIS', 'Hakediş'), K('TARIFE', 'Tarife', 10), K('KAYNAK', 'Kaynak', 10), K('ANA', 'Ana kalem', 5), K('KONTROL', 'Kontrol', 10)]);
export const KATMANLAR = [BOLGE, DIREK, TRAFO, SDK, PANO, ELEMAN, HAT, KANAL, SONDAJ, NOKTA, MALZEME];
/** Haritada yeri olan eleman katmanları (KML klasör sırası). */
export const ELEMAN_KATMANLARI = [DIREK, TRAFO, SDK, PANO, ELEMAN];
/** Eleman türünün katmanı: direkler DIREK, trafo direği ve merkezi TRAFO, box SDK, pano PANO, ötekiler ELEMAN. */
export function elemanKatmani(tur) {
  switch (tur || '') {
    case 'AG_DIREK': case 'MUSTEREK_DIREK': case 'AYD_DIREK': case 'ENH_DIREK': return DIREK;
    case 'TRAFO_DIREGI': case 'TRAFO_MERKEZI': return TRAFO;
    case 'BOX': return SDK;
    case 'PANO': return PANO;
    default: return ELEMAN;
  }
}
/** Kontrol işareti: EVET, HAYIR, boş (belirtilmemiş). */
export const kontrolYazisi = (k) => (k === true ? 'EVET' : k === false ? 'HAYIR' : '');
/** Hattın ucundaki elemanın GIS numarası (0,5 m içindeki en yakın eleman); yoksa "" (eklentideki CbsYapisi.UctakiEleman). */
export function uctakiEleman(elemanlar, uc) {
  let en = null, enKisa = 0.5;
  for (const e of elemanlar || []) {
    const dx = (+e.saga || 0) - uc[0], dy = (+e.yukari || 0) - uc[1], d = Math.sqrt(dx * dx + dy * dy);
    if (d <= enKisa + 1e-9 && (en === null || d < enKisa)) { en = e; enKisa = d; }
  }
  return en ? metin(en.gisId) : '';
}
/** Kalemin adedi: tam yazımdaki "3x(…)" ön ekinden (eklentideki Iletkenler.Adet); yoksa 1. */
export function iletkenAdedi(k) {
  for (const y of [k && k.aciklama, k && k.tanim]) {
    const m = /^\s*(\d+)\s*[xX×]\s*\((.+)\)\s*$/.exec(metin(y));
    if (m && +m[1] >= 1) return +m[1];
  }
  return 1;
}
// Cins adları ortak katalogdan (eklentide Katalog.CinsAdi: katalogda yoksa kodun "_" yerine boşluklu yazımı)
const CINS_ADLARI = new Map((KALEMLER.cinsler || []).map((c) => [c.cins, c.ad]));
export const cinsAdi = (c) => (c ? CINS_ADLARI.get(SH.cinsDuzelt(c)) ?? SH.cinsOkunurAd(metin(c)) : '');

/** Bölgesi olmayan nesnelerin klasörü (eklentideki ProjeOzeti.ProjesizAdi). */
export const PROJESIZ = 'Projesi olmayanlar';
// Eklentideki Turler adları (CBS'de "Tür" sütunu)
const ELEMAN_ADI = { AG_DIREK: 'AG Direk', MUSTEREK_DIREK: 'Müşterek Direk', AYD_DIREK: 'Aydınlatma Direği', ENH_DIREK: 'ENH Direği', TRAFO_DIREGI: 'Trafo Direği', TRAFO_MERKEZI: 'Trafo Merkezi (Köşk)', PANO: 'Pano', BOX: 'Box', EK_MUFU: 'Ek Mufu', KOFRE: 'Kofre', DIGER: 'Diğer' };
const HAT_ADI = { AG_HAVAI: 'AG Havai', AG_YERALTI: 'AG Yeraltı', AYDINLATMA: 'Aydınlatma', OG_HAVAI: 'OG Havai', OG_YERALTI: 'OG Yeraltı', REKORTMAN: 'Rekortman', MUSTEREK: 'Müşterek' };
export const elemanAdi = (tur) => ELEMAN_ADI[tur] || tur || '';
export const hatAdi = (tur) => HAT_ADI[tur] || tur || '';

// ---------------------------------------------------------------- Ekran renkleri (eklentideki CizimStili.Ekran…)

const EKRAN = STIL.ekran || {};
const ekranRengi = (anahtar, varsayilan = '#cbd5e1') => EKRAN[anahtar] || varsayilan;
/** Simge ailesi (eklentideki Semboller.Aile; direkler dışında renk için yeter). */
function aile(tur, cins) {
  switch (tur || '') {
    case 'TRAFO_DIREGI': return 'TRAFO_DIREK';
    case 'TRAFO_MERKEZI': return String(cins || '').toUpperCase().replace(/İ/g, 'I').includes('BINA') ? 'TRAFO_BINA' : 'TRAFO_KOSK';
    case 'PANO': return 'PANO';
    case 'BOX': return 'SDK';
    case 'EK_MUFU': return 'MUFU';
    case 'KOFRE': return 'KOFRE';
    case 'AYD_DIREK': return 'DIREK_AYD';
    default: {
      const c = String(cins || '').toUpperCase().replace(/İ/g, 'I').replace(/Ü/g, 'U');
      if (c.startsWith('ARMATUR')) return 'ARMATUR';
      if (c.startsWith('MENHOL')) return 'MENHOL';
      if (c.startsWith('ABONE')) return 'ABONE';
      return 'DIGER';
    }
  }
}
/** Elemanın ekran rengi: direkler gerilime göre (mevcut ayrı renkte), trafo / box / pano / menhol mavi, armatür sarı. */
export function ekranElemanRengi(tur, cins, mevcut) {
  const g = (STIL.nesneRenkleri.direkGerilimi || {})[tur || ''];
  if (g) { const d = EKRAN[mevcut ? 'direkMevcut' : 'direk']; return (d && d[g]) || '#dae2fd'; }
  const a = aile(tur, cins);
  if (a === 'ARMATUR') return ekranRengi('armatur', '#fde047');
  if (a.startsWith('TRAFO') || a === 'SDK' || a === 'PANO' || a === 'MENHOL') return ekranRengi('trafo', '#6b82ff');
  if (a === 'DIREK_AYD') return ekranRengi('armatur', '#fde047');
  return ekranRengi('diger');
}
/** Hattın ekran rengi (türün katman anahtarından). */
export function ekranHatRengi(tur) {
  const k = (STIL.nesneRenkleri.hatKatmani || {})[tur || ''] || 'HAT_AG';
  return (EKRAN.hat && EKRAN.hat[k]) || '#7ee08a';
}
const katmanRengi = (anahtar, varsayilan) => (EKRAN.hat && EKRAN.hat[anahtar]) || varsayilan;

// ---------------------------------------------------------------- Nesneler (CbsYapisi.Nesneler)

/** Elemanın ana malzemesi dışındaki malzemeleri: "Travers × 2 ad; ..." (254 karakterle sınırlı; Türkçe ondalık virgül). */
export function malzemeler(kalemler) {
  let s = '';
  for (const k of kalemler || []) {
    if (k.ana) continue;
    const b = metin(k.birim).split('/');
    const parca = metin(k.tanim).trim() + ' × ' + netSayi(SH.temiz(+k.miktar || 0, 3), 3, true, ',') + (b.length > 0 && b[0].length > 0 ? ' ' + b[0] : '');
    if (s.length > 0) s += '; ';
    s += parca;
  }
  return s.length > 254 ? s.slice(0, 253) + '…' : s;
}

/**
 * Projenin bütün nesneleri CBS katmanlarına (çizim koordinatıyla): {katman, degerler, kose, proje, ad, renk, durum};
 * malzeme satırları en sonda (eklentideki CbsYapisi.Nesneler).
 */
export function cbsNesneleri(p) {
  const l = [], malzemeSatirlari = [];
  const bolgeler = p.bolgeler || [], elemanlar = p.elemanlar || [];
  const bul = (id) => bolgeler.find((b) => b.id === id) || null;
  const ad = (id) => { const b = bul(id); return b ? metin(b.ad) : ''; };
  const kod = (id) => { const b = bul(id); return b ? metin(b.kod) : ''; };
  const yeni = (k, proje, isim, renk, durum = '') => ({ katman: k, proje, ad: isim, renk, durum, degerler: [], kose: [] });
  const malzemeEkle = (kimlik, katmanAdi, gisNo, proje, kalemler) => {
    for (const k of kalemler || []) {
      const n = yeni(MALZEME, proje, metin(k.tanim).trim(), '', k.durum);
      n.degerler = [kimlik, katmanAdi, gisNo, k.sira, k.cins, metin(k.tanim).trim(), k.aciklama, k.durum, k.dmDurum, SH.temiz(+k.miktar || 0, 6), k.birim,
        SH.temiz(+(k.katsayi ?? 1), 6), SH.temiz(+k.toplam || 0, 6), k.hakedis, k.tarife, k.kaynak, k.ana ? 'EVET' : '', kontrolYazisi(k.kontrol)];
      malzemeSatirlari.push(n);
    }
  };
  for (const b of bolgeler) {
    const sinir = b.sinir || [];
    if (sinir.length < 3) continue;
    const n = yeni(BOLGE, metin(b.ad), metin(b.ad), ekranRengi('bolge', '#fde047'));
    n.degerler = [b.id, b.ad, b.kod, b.grup, b.aciklama, yuvarla(alan(sinir), 2)];
    n.kose = sinir.map((k) => [k[0], k[1]]);
    if (n.kose.length > 3 && ayni(n.kose[0], n.kose[n.kose.length - 1])) n.kose.pop();
    l.push(n);
  }
  for (const e of elemanlar) {
    const kalemler = e.kalemler || [];
    const ana = kalemler.find((k) => k.ana) || null;
    const k = elemanKatmani(e.tur), cins = ana ? ana.cins : e.cins;
    const n = yeni(k, ad(e.bolge), e.gisId ? e.gisId : elemanAdi(e.tur), ekranElemanRengi(e.tur, e.cins, e.durum === 'MEVCUT'), e.durum);
    n.degerler = [e.id, e.gisId, e.tur, elemanAdi(e.tur), cins, cinsAdi(cins), metin(ana ? ana.tanim : e.tip).trim(), e.durum, e.dmDurum,
      e.hakedis, e.guc, e.gerilim, kontrolYazisi(e.kontrol), ad(e.bolge), kod(e.bolge), malzemeler(kalemler), kalemler.length,
      yuvarla(+e.saga || 0, 3), yuvarla(+e.yukari || 0, 3), yuvarla(+e.kot || 0, 3), yuvarla((+e.aci || 0) * 180 / Math.PI, 4), e.telefonId];
    n.kose = [[+e.saga || 0, +e.yukari || 0]];
    l.push(n);
    malzemeEkle(e.id, k.ad, e.gisId, n.proje, kalemler);
  }
  for (const h of p.hatlar || []) {
    const kose = h.kose || [];
    if (kose.length < 2) continue;
    const hk = (h.kalemler || []).filter((k) => k.kaynak === 'HAT');
    let metraj = 0;
    for (const k of hk) metraj = Math.max(metraj, +k.miktar || 0);
    const i1 = hk[0] || null, i2 = hk[1] || null;
    const cu = uzunluk(kose);
    const n = yeni(HAT, ad(h.bolge), h.etiket ? h.etiket : h.anaKesit ? h.anaKesit : hatAdi(h.tur), ekranHatRengi(h.tur), h.durum);
    n.degerler = [h.id, h.tur, hatAdi(h.tur), h.anaKesit,
      i1 ? i1.cins : '', i1 ? metin(i1.tanim).trim() : '', i1 ? iletkenAdedi(i1) : 0,
      i2 ? i2.cins : '', i2 ? metin(i2.tanim).trim() : '', i2 ? iletkenAdedi(i2) : 0,
      h.etiket, h.durum, h.hakedis, kontrolYazisi(h.kontrol ?? (i1 ? i1.kontrol : null)),
      uctakiEleman(elemanlar, kose[0]), uctakiEleman(elemanlar, kose[kose.length - 1]), ad(h.bolge), kod(h.bolge),
      yuvarla(cu, 2), yuvarla(metraj > 0 ? metraj : cu, 2), (h.kalemler || []).length, h.telefonId];
    n.kose = kose.map((k) => [k[0], k[1]]);
    l.push(n);
    malzemeEkle(h.id, HAT.ad, '', n.proje, h.kalemler);
  }
  for (const c of p.kanallar || []) {
    const kose = c.kose || [];
    if (kose.length < 2) continue;
    const ana = (c.kalemler || []).find((k) => k.ana) || null;
    const kablolar = SH.kanalKablolari(Math.round(+c.kod || 0)).replace(/^\/+|\/+$/g, '');
    const cu = uzunluk(kose);
    const n = yeni(KANAL, ad(c.bolge), 'Kanal ' + kablolar + ' · ' + metin(c.zemin), katmanRengi('KANAL', '#9ca3af'), c.durum);
    n.degerler = [c.id, kablolar, c.zemin, +c.altGenislik || 0, +c.ustGenislik || 0, +c.derinlik || 0, c.basNo, c.bitNo, c.durum, c.hakedis,
      ad(c.bolge), kod(c.bolge), yuvarla(cu, 2), yuvarla(ana && ana.miktar > 0 ? ana.miktar : cu, 2)];
    n.kose = kose.map((k) => [k[0], k[1]]);
    l.push(n);
    malzemeEkle(c.id, KANAL.ad, '', n.proje, c.kalemler);
  }
  for (const s of p.sondajlar || []) {
    const kose = s.kose || [];
    if (kose.length < 2) continue;
    const ana = (s.kalemler || []).find((k) => k.ana) || null;
    const cu = uzunluk(kose);
    const n = yeni(SONDAJ, ad(s.bolge), 'Sondaj ' + metin(s.tip).trim(), katmanRengi('SONDAJ', '#fbbf24'), s.durum);
    n.degerler = [s.id, metin(s.tip).trim(), s.basNo, s.bitNo, s.durum, s.hakedis, ad(s.bolge), kod(s.bolge), yuvarla(cu, 2),
      yuvarla(ana && ana.miktar > 0 ? ana.miktar : cu, 2)];
    n.kose = kose.map((k) => [k[0], k[1]]);
    l.push(n);
    malzemeEkle(s.id, SONDAJ.ad, '', n.proje, s.kalemler);
  }
  for (const t of p.noktalar || []) {
    const n = yeni(NOKTA, ad(t.bolge), metin(t.ad), ekranRengi('nokta', '#e2e8f0'));
    n.degerler = [t.id, t.ad, t.kod, yuvarla(+t.kot || 0, 3), t.hakedis, ad(t.bolge), (t.ekMetinler || []).map(metin).join(' ')];
    n.kose = [[+t.saga || 0, +t.yukari || 0]];
    l.push(n);
  }
  return l.concat(malzemeSatirlari);
}
/** Değerin yazımı (KML ve MID): sayılar noktalı ondalık (en çok 8 basamak), tam sayılar tam, metin olduğu gibi. */
export function deger(alan, v) {
  if (alan.tur === 'C') return metin(v);
  if (v == null || v === '') return '';
  if (alan.tur === 'I') return String(Math.trunc(+v || 0));
  return netSayi(+v || 0, 8, true);
}
const turu = (n) => metin(n.degerler[n.katman.alanlar.findIndex((a) => a.ad === 'TUR')]);

// ---------------------------------------------------------------- Google Earth (KmlYazici)

const SIMGELER = 'http://maps.google.com/mapfiles/kml/shapes/';
/** XML kaçışı; XML'de yasak denetim karakterleri atılır. */
export function kac(s) {
  let o = '';
  for (const c of metin(s)) {
    if (c === '&') o += '&amp;'; else if (c === '<') o += '&lt;'; else if (c === '>') o += '&gt;'; else if (c === '"') o += '&quot;';
    else if (c.charCodeAt(0) < 0x20 && c !== '\t' && c !== '\n' && c !== '\r') continue;
    else o += c;
  }
  return o;
}
function kmlSimgesi(n) {
  if (n.katman === NOKTA) return 'cross-hairs.png';
  const tur = turu(n);
  if (tur.endsWith('DIREK')) return 'placemark_circle.png';
  if (tur.startsWith('TRAFO')) return 'triangle.png';
  if (tur === 'BOX' || tur === 'PANO' || tur === 'KOFRE') return 'square.png';
  return 'open-diamond.png';
}
const ogMu = (n) => { const t = turu(n); return t.startsWith('OG') || t === 'MUSTEREK'; };
function bicim(n, sokulecek, bicimler) {
  let renk = metin(n.renk).replace(/^#+/, '').toLowerCase();
  if (renk.length !== 6) renk = 'cbd5e1';
  const tur = n.katman.geometri === 'nokta' ? kmlSimgesi(n) : n.katman.geometri;
  const ad = tur.replace('.png', '') + '_' + renk + (sokulecek ? '_dm' : '');
  if (bicimler.has(ad)) return ad;
  const bgr = renk.slice(4, 6) + renk.slice(2, 4) + renk.slice(0, 2);
  const kmlRenk = (sokulecek ? '80' : 'ff') + bgr;
  let b = '<Style id="' + ad + '">';
  if (n.katman.geometri === 'nokta') {
    const olcek = n.katman === NOKTA ? 0.6 : tur === 'triangle.png' ? 1.0 : 0.8;
    b += '<IconStyle><color>' + kmlRenk + '</color><scale>' + olcek.toFixed(1) + '</scale><Icon><href>' + SIMGELER + tur + '</href></Icon></IconStyle><LabelStyle><scale>0.7</scale></LabelStyle>';
  } else if (n.katman.geometri === 'cizgi') {
    const en = n.katman === KANAL ? 5 : n.katman === HAT && ogMu(n) ? 4 : 3;
    b += '<LineStyle><color>' + kmlRenk + '</color><width>' + en + '</width></LineStyle>';
  } else {
    b += '<LineStyle><color>ff' + bgr + '</color><width>2</width></LineStyle><PolyStyle><color>22' + bgr + '</color></PolyStyle>';
  }
  bicimler.set(ad, b + '</Style>\n');
  return ad;
}
function yerIsareti(n, konum, bicimler, gorunur = true) {
  const sokulecek = n.durum === 'DM';
  let s = '<Placemark>' + (gorunur ? '' : '<visibility>0</visibility>') + '<name>' + kac(n.ad) + '</name><styleUrl>#' + bicim(n, sokulecek, bicimler) + '</styleUrl><ExtendedData>';
  n.katman.alanlar.forEach((a, i) => {
    if (i >= n.degerler.length) return;
    const d = deger(a, n.degerler[i]);
    if (!d.length) return;
    s += '<Data name="' + a.ad + '"><displayName>' + kac(a.baslik) + '</displayName><value>' + kac(d) + '</value></Data>';
  });
  s += '</ExtendedData>';
  if (n.katman.geometri === 'nokta') s += '<Point><coordinates>' + konum(n.kose[0]) + '</coordinates></Point>';
  else if (n.katman.geometri === 'cizgi') s += '<LineString><tessellate>1</tessellate><coordinates>' + n.kose.map(konum).join(' ') + '</coordinates></LineString>';
  else s += '<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>' + n.kose.concat([n.kose[0]]).map(konum).join(' ') + '</coordinates></LinearRing></outerBoundaryIs></Polygon>';
  return s + '</Placemark>\n';
}

/**
 * KML metni (eklentideki KmlYazici.Metin): her proje (bölge) bir klasör — sınırı, elemanları, hatları, kanalları,
 * sondajları; GPS noktaları ayrı klasörde (kapalı). o.donustur(saga, yukari) → [boylam, enlem]; o.surum: program sürümü;
 * o.sistem: koordinat sisteminin adı (ör. "ITRF96 / TM 39 (3°)"); o.tarih: üretim zamanı yazısı; o.ek: belgenin sonuna
 * eklenecek KML (telefonun 3B direk ve iletken klasörü).
 */
export function kmlMetni(p, o) {
  const nesneler = cbsNesneleri(p).filter((n) => n.katman !== MALZEME); // malzeme satırlarının haritada yeri yok
  const konum = (k) => { const [lon, lat] = o.donustur(k[0], k[1]); return netSayi(lon, 8) + ',' + netSayi(lat, 8) + ',0'; };
  const bicimler = new Map();
  let govde = '';
  const bolgeler = p.bolgeler || [];
  const projeler = [];
  for (const b of bolgeler) if (!projeler.includes(metin(b.ad))) projeler.push(metin(b.ad));
  for (const n of nesneler) if (n.katman !== NOKTA && !projeler.includes(n.proje)) projeler.push(n.proje);
  const bos = projeler.indexOf('');
  if (bos >= 0) { projeler.splice(bos, 1); projeler.push(''); }
  for (const pr of projeler) {
    const bu = nesneler.filter((n) => n.proje === pr && n.katman !== NOKTA);
    if (!bu.length) continue;
    const bolge = bolgeler.find((b) => metin(b.ad) === pr);
    const kod = bolge ? metin(bolge.kod) : '';
    govde += '<Folder><name>' + kac(pr.length > 0 ? pr : PROJESIZ) + '</name>' + (kod.length > 0 ? '<description>' + kac('Proje kodu ' + kod) + '</description>' : '') + '\n';
    for (const n of bu.filter((x) => x.katman === BOLGE)) govde += yerIsareti(n, konum, bicimler);
    for (const k of [DIREK, TRAFO, SDK, PANO, ELEMAN, HAT, KANAL, SONDAJ]) {
      const l = bu.filter((x) => x.katman === k);
      if (!l.length) continue;
      govde += '<Folder><name>' + kac(k.baslik + ' (' + l.length + ')') + '</name>\n';
      for (const n of l) govde += yerIsareti(n, konum, bicimler);
      govde += '</Folder>\n';
    }
    govde += '</Folder>\n';
  }
  const noktalar = nesneler.filter((n) => n.katman === NOKTA);
  if (noktalar.length) {
    govde += '<Folder><name>' + kac(NOKTA.baslik + ' (' + noktalar.length + ')') + '</name><visibility>0</visibility>\n';
    for (const n of noktalar) govde += yerIsareti(n, konum, bicimler, false);
    govde += '</Folder>\n';
  }
  let s = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n';
  s += '<name>' + kac((p.proje || {}).ad) + '</name>\n';
  s += '<description>' + kac('Şebeke-M Hakediş ' + metin(o.surum) + ' · ' + metin(o.sistem) + ' → WGS84 · ' + metin(o.tarih)) + '</description>\n';
  s += '<open>1</open>\n';
  for (const v of bicimler.values()) s += v;
  return s + govde + (o.ek || '') + '</Document>\n</kml>\n';
}

// ---------------------------------------------------------------- MapInfo MIF / MID (MifDosyasi.KatmanYaz)

/**
 * CoordSys satırı. Eklentinin çizimi her zaman ITRF96 3° TM'dir: "Earth Projection 8, 104, "m", DOM, 0, 1, 500000, 0".
 * Telefonda proje başka sistemdeyse (UTM, ED50, coğrafi, yerel) o sistemin satırı yazılır.
 */
export function mifCoordSys(crs) {
  const c = crs || {};
  const datum = c.datum === 'ED50' ? 28 : 104; // MapInfo datum: 104 WGS84 (ITRF96 / TUREF ile eş), 28 ED50
  if (c.projection === 'GEO') return 'CoordSys Earth Projection 1, ' + datum;
  if (c.local) return 'CoordSys NonEarth Units "m" Bounds (0, 0) (1000000, 10000000)';
  const sayi = (v) => netSayi(+v || 0, 8, true);
  return 'CoordSys Earth Projection 8, ' + datum + ', "m", ' + sayi(c.cm ?? 39) + ', 0, ' + sayi(c.k0 ?? 1) + ', ' + sayi(c.fe ?? 500000) + ', ' + sayi(c.fn ?? 0) + ' Bounds (0, 3000000) (1000000, 5000000)';
}
/** "#rrggbb" → 0xRRGGBB (MapInfo rengi). */
export function rgb(hex) { const h = metin(hex).replace(/^#+/, ''); return /^[0-9a-fA-F]{6}$/.test(h) ? parseInt(h, 16) : 0; }
/** MapInfo 3.0 simgeleri: 34 daire (direk), 36 üçgen (trafo), 32 kare (box, pano), 33 baklava (diğer), 38 boş kare (GPS noktası). */
function mifSimgesi(n) {
  if (n.katman === NOKTA) return 38;
  const tur = turu(n);
  if (tur.endsWith('DIREK')) return 34;
  if (tur.startsWith('TRAFO')) return 36;
  if (tur === 'BOX' || tur === 'PANO' || tur === 'KOFRE') return 32;
  return 33;
}
/**
 * Bir katmanın MIF ve MID metinleri (satır sonu CRLF). o.coordSys: CoordSys satırı (varsayılan eklentinin TM satırı,
 * o.dom ile); o.hane: koordinat basamağı (eklentide 3). Başka sisteme çevirmek için önce sistemeCevir.
 */
export function mifKatmani(k, nesneler, o = {}) {
  const cs = o.coordSys || mifCoordSys({ cm: o.dom || 39 });
  const hane = o.hane ?? 3;
  const K2 = (q) => netSayi(q[0], hane) + ' ' + netSayi(q[1], hane);
  let m = 'Version 300\r\nCharset "WindowsTurkish"\r\nDelimiter ","\r\n' + cs + '\r\nColumns ' + k.alanlar.length + '\r\n';
  for (const a of k.alanlar) m += '  ' + a.ad + ' ' + (a.tur === 'I' ? 'Integer' : a.tur === 'F' ? 'Float' : 'Char(' + a.uzunluk + ')') + '\r\n';
  m += 'Data\r\n\r\n';
  let d = '';
  for (const n of nesneler) {
    const renk = rgb(n.renk);
    if (k.geometri === 'yok') {
      m += 'None\r\n'; // haritada yeri olmayan satır (malzeme tablosu)
    } else if (k.geometri === 'nokta') {
      m += 'Point ' + K2(n.kose[0]) + '\r\n    Symbol (' + mifSimgesi(n) + ',' + renk + ',10)\r\n';
    } else if (k.geometri === 'cizgi') {
      m += 'Pline ' + n.kose.length + '\r\n';
      for (const x of n.kose) m += K2(x) + '\r\n';
      m += '    Pen (' + (n.katman === KANAL ? '3' : '2') + ',2,' + renk + ')\r\n';
    } else {
      m += 'Region 1\r\n  ' + (n.kose.length + 1) + '\r\n';
      for (let i = 0; i <= n.kose.length; i++) m += K2(n.kose[i % n.kose.length]) + '\r\n';
      m += '    Pen (2,2,' + renk + ')\r\n    Brush (1,0,16777215)\r\n';
    }
    k.alanlar.forEach((a, i) => {
      if (i > 0) d += ',';
      const v = i < n.degerler.length ? n.degerler[i] : null;
      if (a.tur === 'C') {
        let s = metin(v).replace(/\r/g, ' ').replace(/\n/g, ' ');
        if (s.length > a.uzunluk) s = s.slice(0, a.uzunluk);
        d += '"' + s.replace(/"/g, '""') + '"';
      } else if (a.tur === 'I') d += v == null ? '0' : String(Math.round(+v || 0));
      else d += v == null ? '0' : netSayi(+v || 0, 8, true);
    });
    d += '\r\n';
  }
  return { mif: m, mid: d };
}
/**
 * Nesneleri başka koordinat sistemine çevirir (telefonda Dışa Aktarım'daki seçim; eklentide yok, çizim hep kendi
 * sisteminde): köşeler, elemanların SAGA / YUKARI sütunları, çizim uzunluğu (UZUNLUK) ve sınırın alanı (ALAN) yeni sistemde;
 * metraj (gerçek miktar) değişmez. koordinat([x, y]) → [x, y]; cografi: hedef enlem / boylam (uzunluk, alan çevrilmez).
 */
export function sistemeCevir(nesneler, koordinat, cografi = false) {
  return nesneler.map((n) => {
    const m = Object.assign({}, n, { kose: n.kose.map((k) => koordinat(k)), degerler: n.degerler.slice() });
    const sira = (ad) => n.katman.alanlar.findIndex((a) => a.ad === ad);
    const sg = sira('SAGA'), yk = sira('YUKARI'), uz = sira('UZUNLUK'), al = sira('ALAN');
    if (sg >= 0 && yk >= 0 && m.kose.length) { m.degerler[sg] = yuvarla(m.kose[0][0], cografi ? 8 : 3); m.degerler[yk] = yuvarla(m.kose[0][1], cografi ? 8 : 3); }
    if (!cografi && uz >= 0 && m.kose.length >= 2) m.degerler[uz] = yuvarla(uzunluk(m.kose), 2);
    if (!cografi && al >= 0 && m.kose.length >= 3) m.degerler[al] = yuvarla(alan(m.kose), 2);
    return m;
  });
}
/**
 * Projenin MIF/MID dosyaları: her dolu katman ad_KATMAN.mif + .mid (eklentideki MifDosyasi.Yaz). Metinler; kodlama ayrı.
 * o.koordinat verilirse nesneler o sisteme çevrilir (sistemeCevir; o.hane 8 ise hedef coğrafi).
 */
export function mifDosyalari(p, ad, o = {}) {
  let hepsi = cbsNesneleri(p);
  if (o.koordinat) hepsi = sistemeCevir(hepsi, o.koordinat, (o.hane ?? 3) > 3);
  const out = [];
  for (const k of KATMANLAR) {
    const l = hepsi.filter((n) => n.katman === k);
    if (!l.length) continue;
    const { mif, mid } = mifKatmani(k, l, o);
    out.push({ name: ad + '_' + k.ad + '.mif', text: mif }, { name: ad + '_' + k.ad + '.mid', text: mid });
  }
  return out;
}

// Türkçe Windows kod sayfası (1254): 0x80–0x9F özel karakterler, 0xA0–0xFF Latin-1 (altı Türkçe harf dışında)
const CP1254 = new Map([[0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x0178, 0x9f],
  [0x011e, 0xd0], [0x0130, 0xdd], [0x015e, 0xde], [0x011f, 0xf0], [0x0131, 0xfd], [0x015f, 0xfe]]);
const LATIN1_DISI = new Set([0xd0, 0xdd, 0xde, 0xf0, 0xfd, 0xfe]);
/** Metni Türkçe Windows (1254) baytlarına çevirir; kod sayfasında olmayan karakter "?" olur. */
export function cp1254(text) {
  const out = [];
  for (const ch of metin(text)) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (CP1254.has(c)) out.push(CP1254.get(c));
    else if (c >= 0xa0 && c <= 0xff && !LATIN1_DISI.has(c)) out.push(c);
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}
