// AutoCAD DXF (R12 / AC1009) üretici — Lejant.dxf katman, ACI, çizgi tipi ve sembol yapısıyla.
// Koordinatlar proje CRS'inde: X = Sağa (E), Y = Yukarı (N), Z = kot (H). Ölçek 1/1000 (yazı 1.8 m = 1.8 mm).
// Simgeler ve stil ortak tablolardan gelir (ortak/katalog/semboller.json → semboller.js, cizim-stili.json →
// cizim-stili.js): AutoCAD eklentisi aynı blokları aynı adla (SH_…) tanımlar, aynı renk / çizgi tipi / yazı
// düzenini kullanır; böylece telefonun DXF'i ile eklentinin çizimi birebir aynı görünür.
import SEMBOLLER from '../ortak/semboller.js';
import STIL from '../ortak/cizim-stili.js';
import SH from '../interop/sh-core.cjs';
import { kanalModel } from '../grid/lines.js';
const f = (v) => (Number.isFinite(v) ? (+v).toFixed(4) : '0.0');

class W {
  constructor() { this.o = []; }
  g(code, val) { this.o.push(String(code), String(val)); return this; }
  text() { return this.o.join('\r\n') + '\r\n'; }
}

const LT_ACIKLAMA = { CONTINUOUS: 'Solid line', DASHED: '__ __ __', DASHDOT: '__ . __ .', DOT: '. . . .', HIDDEN: '_ _ _ _' };
const LTYPES = Object.entries(STIL.cizgiTipleri).map(([n, pat]) => [n, LT_ACIKLAMA[n] || n, pat]);

/** Katman tablosu: ortak stildeki telefon katmanları (aynı ada ilk giren kazanır). */
export function legendLayers() {
  const out = [], seen = new Set();
  for (const k of Object.values(STIL.katmanlar)) {
    if (!k.telefon || seen.has(k.telefon)) continue;
    seen.add(k.telefon);
    out.push({ name: k.telefon, aci: k.aci, lt: k.cizgi || 'CONTINUOUS' });
  }
  return out;
}
const KAT = (anahtar) => STIL.katmanlar[anahtar].telefon;
const poleLayer = (e) => (e.kind === 'lighting' || e.group === 'ayd' ? KAT('DIREK_AYD') : e.volt === 'OG' ? (e.group === 'mus' ? KAT('DIREK_MUSTEREK') : KAT('DIREK_OG')) : KAT('DIREK_AG'));
/**
 * Hattın ortak stil anahtarı: yer altında AG / OG kablo ayrı, müşterek hat kendi renginde (eklentideki hatKatmani ile
 * aynı); yalnız kanal / sondaj (kablosuz kazı) kablo gibi değil, kendi renginde ve çizgisinde (eklentideki KANAL / SONDAJ).
 */
export const lineKey = (l) => (l.channelOnly ? (l.cable && l.cable.method === 'sondaj' ? 'SONDAJ' : 'KANAL')
  : l.install === 'yeralti' ? (l.lineType === 'OG' ? 'KABLO_OG' : 'KABLO')
  : l.musterek ? 'HAT_MUSTEREK' : { AG: 'HAT_AG', OG: 'HAT_OG', AYD: 'HAT_AYD', ENH: 'HAT_ENH', ABONE: 'HAT_ABONE' }[l.lineType] || 'HAT_AG');
const lineLayer = (l) => KAT(lineKey(l));
/**
 * Hat etiketi: "hat no kesit" — kesit duruma göre biçimlenir (mevcut "(kesit)", ileride "<kesit>"…) ve malzeme adı
 * ortak yazımla (eklentideki MalzemeYazimi). Telefonun DXF'i ve haritası aynı yazıyı kullanır.
 */
export function hatYazisi(no, state, label, channelOnly) {
  const tag = (STIL.etiketler.kesit[state] || '{t}').replace('{t}', channelOnly ? label || '' : SH.malzemeYazisi(label || ''));
  return (no || '') + ' ' + tag;
}
// Direk rengi: mevcut / yeni / DMM (ortak stil)
const POLE_ACI = STIL.direkRenkleri;
const DEMONTAJ_ACI = STIL.direkRenkleri.demontaj;
const stIdx = (st) => (st === 'YENI' ? 1 : st === 'DMM' ? 2 : 0);
/** Hattın rengi (nesneye yazılır; yazıları da bu renkte): türünün rengi, demontajda sarı. */
const lineAci = (l) => (l.state === 'DEMONTAJ' ? DEMONTAJ_ACI : STIL.katmanlar[lineKey(l)].aci);
/**
 * Kanal kenarlarının arası (m): yer altı hattının kazı kanalı (yalnız kanal ya da içinde kablo); genişlik kanalın
 * genişliği, yoksa ortak stilin varsayılanı (eklentideki NesneYazici.KanalGenisligi). Yatay sondajda ve kazısız eski
 * kayıtlarda (direk inişi, duvar geçişi) kenar yok: 0.
 */
export function kanalGenisligi(l) {
  if (!l || l.install !== 'yeralti') return 0;
  const km = kanalModel(l.cable);
  if (km.kazisiz || km.method === 'sondaj') return 0;
  const w = +(l.cable || {}).width || 0;
  return w > 0 ? w : (STIL.katmanlar.KANAL.kenar || {}).varsayilanGenislik || 0.4;
}
/**
 * Çizginin d kadar yanındaki eş çizgisi (noktalar {x, y}; d'nin işareti yanı seçer): köşede iki yanın kenarları
 * kesiştirilir (gönye), çok sivri köşede uzama dört katla sınırlanır; enAz'dan yakın ardışık köşeler tek sayılır.
 * Eklentide AutoCAD'in GetOffsetCurves'ü (CizimYazici.KenarlariYaz) aynı işi yapar.
 */
export function esCizgi(pts, d, enAz = 1e-6) {
  const p = [];
  for (const q of pts) if (!p.length || Math.hypot(q.x - p[p.length - 1].x, q.y - p[p.length - 1].y) > enAz) p.push(q);
  const n = p.length, out = [];
  if (n < 2) return out;
  const nor = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = p[i + 1].x - p[i].x, dy = p[i + 1].y - p[i].y, L = Math.hypot(dx, dy);
    nor.push({ x: -dy / L, y: dx / L });
  }
  for (let i = 0; i < n; i++) {
    const a = nor[Math.max(0, i - 1)], b = nor[Math.min(n - 2, i)];
    let mx = a.x + b.x, my = a.y + b.y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-9) { mx = b.x; my = b.y; } else { mx /= ml; my /= ml; }
    const k = d / Math.max(mx * b.x + my * b.y, 0.25);
    out.push({ x: p[i].x + mx * k, y: p[i].y + my * k });
  }
  return out;
}
/** Metraj yazısında açıklık sınırı olmayan elemanlar: hattın üstündeki ara elemanlar (eklentideki Geometri.AciklikSiniri). */
export const ARA_ELEMAN = new Set(['manhole', 'luminaire']);

/**
 * Açıklıklar: hat, üstünde eleman (direk, SDK, pano, trafo…) olan köşelerinden bölünür; elemansız kırılma köşeleri
 * açıklığın içinde kalır. Her açıklık için toplam uzunluk ve yazının konacağı parça (en uzun parça) döner.
 */
export function spanTexts(coords, isNode) {
  const out = [];
  if (!coords || coords.length < 2) return out;
  let bas = 0;
  for (let i = 1; i < coords.length; i++) {
    if (i < coords.length - 1 && !isNode(coords[i], i)) continue;
    let len = 0, len3 = 0, best = -1, bestLen = 0;
    for (let k = bas; k < i; k++) {
      const a = coords[k], b = coords[k + 1];
      const d = Math.hypot(b.E - a.E, b.N - a.N);
      len += d;
      // 3B uzunluk (iletken metrajının temeli; kotu bilinmeyen noktada 2B)
      len3 += a.H != null && b.H != null ? Math.hypot(d, b.H - a.H) : d;
      if (d > bestLen + 1e-9) { bestLen = d; best = k; }
    }
    if (best >= 0 && len > 1e-6) out.push({ from: bas, to: i, seg: best, length: len, length3D: len3 });
    bas = i;
  }
  return out;
}

/**
 * Açıklığın metraj yazısında gösterilecek uzunluk: havai hatta iletken metrajı (3B uzunluk × (1 + ek pay); eklentide
 * iletken kaleminin metrajı ÷ adet, 13.11.2026), yer altı / kanalda çizim uzunluğu. payPct: hattın kendi payı, yoksa projenin.
 */
export function aciklikMetraji(line, sp, projectPayPct = 0) {
  if (line.install === 'yeralti' || line.channelOnly) return sp.length;
  const pay = (line.payPct ?? projectPayPct ?? 0) / 100;
  return (sp.length3D ?? sp.length) * (1 + pay);
}

/**
 * Parça yazısının (metraj, hat etiketi) yeri ve açısı: parçanın (a→b) ortasından parçanın kendi ekseninde kaydırılır —
 * dx parça boyunca (okuma yönünde), dy parçaya dik (artı: yazının üst yanı). Açı (derece) parçanın doğrultusu, ters
 * okunmasın diye −90 … 90 aralığında. Yatay hatta dünya ekseninde kaydırmayla aynı; dik hatta da metraj çizginin bir
 * yanında, etiket öbür yanında kalır (eklentideki Geometri.YaziKonumu ile aynı kural).
 */
export function yaziKonumu(a, b, dx, dy) {
  let ang = Math.atan2(b.N - a.N, b.E - a.E) * 180 / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const r = ang * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: (a.E + b.E) / 2 + dx * c - dy * s, y: (a.N + b.N) / 2 + dx * s + dy * c, ang };
}
const YAZI = () => KAT('YAZI'), OLCU = () => KAT('OLCU');

// Hat yazılarının düzeni (eklentideki YaziDuzeni ile aynı kural, aynı harf tablosu: cizim-stili.json › yazi): metraj ve
// hat etiketi (kablo tipi) parçanın ortasına ortalı — metraj çizginin üst yanında taban çizgisi ortalı, etiket alt yanında
// üst kenarı ortalı; ikisi aynı noktadan başlamaz, üst üste binmez. Parçaya sığmayan yazı önce daraltılır (genişlik
// katsayısı en az 0,6), yetmezse küçülür (en az %60).
const HARF = STIL.yazi.harfGenislikleri || {};
const SIG = STIL.yazi.sigdirma || { pay: 0.9, enDarGenislik: 0.6, enKucukYukseklik: 0.6 };
const r3 = (v) => Math.round(v * 1000) / 1000;
/** Yazının yaklaşık uzunluğu (m): harf genişlikleri × yükseklik × genişlik katsayısı (YaziDuzeni.Genislik). */
export function yaziGenisligi(metin, h, gk = 1) {
  let t = 0;
  for (const c of String(metin ?? '')) { const g = c.length === 1 ? HARF[c] : undefined; t += Number.isFinite(g) ? g : (HARF.varsayilan || 0.6); }
  return t * h * gk;
}
/** Yazıyı uzunluğu L olan parçaya sığdırır: { h, gk } (YaziDuzeni.Sigdir). */
export function yaziSigdir(metin, h, L) {
  const yer = L * SIG.pay, w = yaziGenisligi(metin, h);
  if (w <= yer || yer <= 0 || w <= 0) return { h, gk: 1 };
  const gk = r3(Math.max(SIG.enDarGenislik, yer / w));
  if (w * gk <= yer + 1e-9) return { h, gk };
  return { h: r3(Math.max(SIG.enKucukYukseklik * h, h * yer / (w * gk))), gk };
}
/** Hat etiketinin parçası: çizginin en uzun parçası (YaziDuzeni.EnUzunParca). */
export function enUzunParca(coords) {
  let en = 0, enUzun = -1;
  for (let i = 0; i + 1 < coords.length; i++) {
    const d = Math.hypot(coords[i + 1].E - coords[i].E, coords[i + 1].N - coords[i].N);
    if (d > enUzun + 1e-9) { enUzun = d; en = i; }
  }
  return en;
}
/**
 * Boyutlar (proje.sebeke.boyutlar — AutoCAD dosyasıyla gelir, Dışa Aktarım › Çizim boyutları ile değişir; eklentide
 * Çizim Ayarları › Görünüm): simge büyüklüğü (kat) ve yazı yükseklikleri (m).
 * Projede yoksa ortak stilin ölçüleri; textH verilirse eski kullanım gibi bütün yazılar onunla orantılı.
 */
export function boyutlar(proje, textH) {
  const b = (proje && (proje.boyutlar || (proje.sebeke && proje.sebeke.boyutlar))) || {};
  const k = textH ? textH / STIL.yazi.yukseklik : 1;
  const sayi = (v, d, en, cok) => (v !== null && v !== '' && Number.isFinite(+v) && +v >= en && +v <= cok ? +v : d);
  return {
    simge: sayi(b.simgeOlcegi, 1, 0.1, 20),
    etiket: sayi(b.etiketYuksekligi, STIL.yazi.yukseklik * k, 0.05, 50),
    metraj: sayi(b.metrajYuksekligi, STIL.yazi.parcaMetraji * k, 0.05, 50),
    eleman: sayi(b.elemanYaziYuksekligi, STIL.yazi.yukseklik * k, 0.05, 50),
    // Hat kalınlığı (kat; 0 = ince çizgi) ve malzemelerin çizimde yazılması (eklentideki Boyutlar.HatKalinligi / MalzemeYazisi)
    kalinlik: sayi(b.hatKalinligi, 1, 0, 5),
    malzeme: b.malzemeYazisi === true,
    // Simge takımı: '' klasik, 'SM' Şebeke-M (eklentideki Boyutlar.SimgeTakimi)
    takim: String(b.simgeTakimi || '').toUpperCase() === 'SM' ? 'SM' : ''
  };
}

/**
 * Hattın çizgi kalınlığı (m; 1/1000 paftada kâğıtta mm): stildeki kalınlık × kat, mm'nin yüzde birine yuvarlanmış
 * (eklentideki CizimStili.HatKalinligi ile aynı). Kanal ve sondajda (stilde kalınlık yok) 0.
 */
export function hatKalinligi(l, kat) {
  if (!(kat > 0)) return 0;
  const k = (STIL.katmanlar[lineKey(l)] || {}).kalinlik || 0;
  return Math.round(k * kat * 100) / 100;
}

/** Malzeme yazısının yüksekliği eleman yazısına oranı ve satır aralığı (eklentideki MalzemeEtiketi ile aynı). */
export const MALZEME_YAZISI = { oran: 0.7, aralik: 1.5 };

/** Demontaj türünden (KESİK / SÖKÜK) demontaj varyantı: DM · KESIK · SOKUK (eklentideki Semboller.Varyant ile aynı). */
export function dmVaryanti(dmDurum) {
  const d = String(dmDurum || '').trim().toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ü/g, 'U');
  if (d.startsWith('KES')) return 'KESIK';
  if (d.startsWith('SOK')) return 'SOKUK';
  return 'DM';
}

/**
 * Sembol varyantı: durumdan (ekipman ve hat durum kodları → YENI · MEVCUT · DMM · DM · KESIK · SOKUK). çizim durumu
 * verilmişse eklentiyle aynı kural: M, M+M, KM, ENH, ME → YENI · DM → DM (KESİK → KESIK, SÖKÜK → SOKUK) · DM+M → DMM ·
 * MEVCUT → MEVCUT.
 */
export function sembolVaryanti(state, cizimDurumu, dmDurum) {
  const pd = String(cizimDurumu || '').toUpperCase();
  if (pd === 'M' || pd === 'M+M' || pd === 'KM' || pd === 'ENH' || pd === 'ME') return 'YENI';
  if (pd === 'DM') return dmVaryanti(dmDurum);
  if (pd === 'DM+M') return 'DMM';
  if (pd === 'MEVCUT') return 'MEVCUT';
  const st = String(state || '').toUpperCase();
  if (st === 'YENI') return 'YENI';
  if (st === 'DMM' || st === 'TASINAN') return 'DMM';
  if (st === 'DEMONTAJ') return dmVaryanti(dmDurum);
  return 'MEVCUT'; // MEVCUT, ILERIDE, güç/gerilim değişen, tadil…
}
/** Ekipmanın sembol ailesi (ortak tablo adları). */
export function sembolAilesi(e) {
  if (e.kind === 'pole' || e.kind === 'lighting') {
    const volt = e.kind === 'lighting' || e.group === 'ayd' ? 'AYD' : e.volt === 'OG' ? 'OG' : 'AG';
    if (volt === 'AYD') return 'DIREK_AYD';
    return (e.symbol === 's' ? 'KAFES_' : 'DIREK_') + volt;
  }
  if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') {
    const post = (e.attrs || {}).post || 'direk';
    return post === 'direk' ? 'TRAFO_DIREK' : post === 'bina' || post === 'ba' ? 'TRAFO_BINA' : 'TRAFO_KOSK';
  }
  if (e.kind === 'sdk') return 'SDK';
  if (e.kind === 'manhole') return 'MENHOL';
  if (e.kind === 'panel') return 'PANO';
  if (e.kind === 'luminaire') return 'ARMATUR';
  if (e.kind === 'other') return 'DIGER';
  return 'ABONE';
}
const ust = (s) => String(s || '').toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ç/g, 'C').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ğ/g, 'G');

/**
 * Şebeke-M takımındaki aile (eklentideki Semboller.SmAile ile aynı kural): kafes / beton ayrımı klasikteki gibi, ENH direği
 * kendi simgesi, trafo merkezi tipten (indirici · bina · kulesiz özel · kule çıkışlı (özel) · kule (özel) · yoksa modüler
 * köşk), direk tipi trafoda "özel", pano → box, SDK → SDK AG / AYD, armatür tipinden lamba (LED · cıva · floresan · sodyum).
 * Takımda olmayan aileler (menhol, abone, diğer) klasik ailesiyle döner.
 */
export function smAilesi(e) {
  const klasik = sembolAilesi(e);
  const ct = ust((e.typeName || '') + ' ' + ((e.attrs || {}).post || '') + ' ' + (e.name || ''));
  if (klasik === 'DIREK_AG' || klasik === 'KAFES_AG' || klasik === 'DIREK_OG' || klasik === 'KAFES_OG' || klasik === 'DIREK_AYD') {
    if ((klasik === 'DIREK_OG' || klasik === 'KAFES_OG') && e.group === 'bahh') return 'SM_DIREK_ENH';   // BAHH = ENH direği
    return 'SM_' + klasik;
  }
  if (klasik === 'TRAFO_DIREK') return ct.includes('OZEL') ? 'SM_TRAFO_DIREK_OZEL' : 'SM_TRAFO_DIREK';
  if (klasik === 'TRAFO_BINA' || klasik === 'TRAFO_KOSK') {
    const ozel = ct.includes('OZEL');
    if (ct.includes('INDIRICI') || ct.includes('DAGITIM MERKEZ')) return 'SM_INDIRICI_MERKEZ';
    if (klasik === 'TRAFO_BINA' || ct.includes('BINA')) return 'SM_TRAFO_BINA';
    if (ct.includes('KULESIZ')) return 'SM_KOSK_KULESIZ_OZEL';
    if (ct.includes('KULE') && ct.includes('CIKIS')) return ozel ? 'SM_KOSK_KCIKIS_OZEL' : 'SM_KOSK_KULE_CIKIS';
    if (ct.includes('KULE')) return ozel ? 'SM_KOSK_KULE_OZEL' : 'SM_KOSK_KULE';
    return 'SM_KOSK_MODULER';
  }
  if (klasik === 'PANO') return 'SM_BOX';
  if (klasik === 'SDK') return ct.includes('AYD') ? 'SM_SDK_AYD' : 'SM_SDK_AG';
  if (klasik === 'ARMATUR') {
    if (ct.includes('LED')) return 'SM_ARMATUR_LED';
    if (ct.includes('CIVA')) return 'SM_ARMATUR_CIVA';
    if (ct.includes('FLORESAN') || ct.includes('FLUORESAN')) return 'SM_ARMATUR_FLORESAN';
    return 'SM_ARMATUR_SODYUM';
  }
  return klasik;
}

/** Ekipmanın blok adı: SH_<aile>_<varyant> (eklentiyle aynı); demontajda türü (KESİK / SÖKÜK) ayrı simgedir. takim: '' | 'SM'. */
export function sembolBlogu(e, takim = '') {
  const st = e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation' ? { yeni: 'YENI', tasinan: 'DMM', demontaj: 'DEMONTAJ' }[e.state] || 'MEVCUT' : e.state;
  let aile = sembolAilesi(e);
  if (takim === 'SM') { const sm = smAilesi(e); if (SEMBOLLER.semboller[sm + '_YENI']) aile = sm; }
  return 'SH_' + aile + '_' + sembolVaryanti(st, e.cizimDurumu, (e.attrs || {}).dmDurum);
}

function blocks(w) {
  const defs = {};
  for (const [name, ilkeller] of Object.entries(SEMBOLLER.semboller)) {
    const ents = [];
    let renk = 0;   // ["R", n]: sonraki ilkellerin rengi (0 bloğa göre, 7 zıt renk)
    for (const i of ilkeller) {
      const t = i[0];
      if (t === 'R') { renk = +i[1] || 0; continue; }
      if (t === 'L') ents.push(['LINE', [i[1], i[2], i[3], i[4]], null, renk]);
      else if (t === 'C') ents.push(['CIRCLE', { 10: i[1], 20: i[2], 30: 0, 40: i[3] }, null, renk]);
      else if (t === 'P') ents.push(['PLINE', i[1], !!i[2], renk, i[3] || null]);
      else if (t === 'S') ents.push(['SOLID', i[1], null, renk]);
      else if (t === 'D') ents.push(['DONUT', i[1], null, renk]);
      else if (t === 'Y') ents.push(['HALFDONUT', i[1], null, renk]);
      else if (t === 'T') ents.push(['TEXT', { x: i[1], y: i[2], h: i[3], metin: i[4] }, null, renk]);
    }
    defs['SH_' + name] = ents;
  }
  defs.OLCU = [['LINE', [-1, 0, 1, 0]], ['LINE', [0, -1, 0, 1]]];
  w.g(0, 'SECTION').g(2, 'BLOCKS');
  for (const [name, ents] of Object.entries(defs)) {
    w.g(0, 'BLOCK').g(8, '0').g(2, name).g(70, 0).g(10, 0).g(20, 0).g(30, 0).g(3, name);
    for (const e of ents) writeEnt(w, e);
    w.g(0, 'ENDBLK').g(8, '0');
  }
  w.g(0, 'ENDSEC');
  return Object.keys(defs);
}
function writeEnt(w, e) {
  const [t, a, b, renk = 0, cizgi = null] = e;
  const c = renk || 0;   // 0: bloğa göre (elemanın rengi); 7: zıt renk (Şebeke-M dolu simgenin iç çizgileri)
  if (t === 'CIRCLE') { w.g(0, 'CIRCLE').g(8, '0').g(62, c).g(10, f(a[10])).g(20, f(a[20])).g(30, 0).g(40, f(a[40])); return; }
  if (t === 'LINE') { w.g(0, 'LINE').g(8, '0').g(62, c).g(10, f(a[0])).g(20, f(a[1])).g(30, 0).g(11, f(a[2])).g(21, f(a[3])).g(31, 0); return; }
  if (t === 'SOLID') { w.g(0, 'SOLID').g(8, '0').g(62, c); a.forEach((p, i) => w.g(10 + i, f(p[0])).g(20 + i, f(p[1])).g(30 + i, 0)); return; }
  if (t === 'TEXT') { w.g(0, 'TEXT').g(8, '0').g(62, c).g(10, f(a.x)).g(20, f(a.y)).g(30, 0).g(40, f(a.h)).g(1, a.metin).g(72, 1).g(11, f(a.x)).g(21, f(a.y)).g(31, 0).g(73, 2); return; }
  if (t === 'PLINE') { w.g(0, 'POLYLINE').g(8, '0').g(62, c); if (cizgi) w.g(6, cizgi); w.g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, b ? 1 : 0); for (const p of a) w.g(0, 'VERTEX').g(8, '0').g(10, f(p[0])).g(20, f(p[1])).g(30, 0); w.g(0, 'SEQEND').g(8, '0'); return; }
  if (t === 'DONUT' || t === 'HALFDONUT') {
    // kalın yay polyline (genişlik = r) ile dolu daire / yarım daire (eklentideki blok çizimiyle aynı)
    const r = a / 2;
    w.g(0, 'POLYLINE').g(8, '0').g(62, c).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, t === 'DONUT' ? 1 : 0).g(40, f(a)).g(41, f(a));
    if (t === 'DONUT') { w.g(0, 'VERTEX').g(8, '0').g(10, f(-r)).g(20, 0).g(30, 0).g(42, 1); w.g(0, 'VERTEX').g(8, '0').g(10, f(r)).g(20, 0).g(30, 0).g(42, 1); }
    else { w.g(0, 'VERTEX').g(8, '0').g(10, 0).g(20, f(r)).g(30, 0).g(42, 1); w.g(0, 'VERTEX').g(8, '0').g(10, 0).g(20, f(-r)).g(30, 0); }
    w.g(0, 'SEQEND').g(8, '0'); return;
  }
}

export function buildDXF(model, opts = {}) {
  const w = new W();
  const cat = model.cat;
  const B = boyutlar(model.project, opts.textH);
  const th = B.eleman;
  const thParca = B.metraj, thKucuk = th * (STIL.yazi.aciYazisi / STIL.yazi.yukseklik);
  const [, pdy] = STIL.etiketler.parcaMetraji.kaydirma, [, hdy] = STIL.etiketler.hat.kaydirma, [edx, edy] = STIL.etiketler.eleman.kaydirma, [adx, ady] = STIL.etiketler.aci.kaydirma;
  // Kanal / sondaj (yalnız kanal) metrajı: içindeki kablonun metrajıyla üst üste binmesin diye bir satır yukarıda
  const kdy = pdy + thParca + ((STIL.etiketler.kaziMetraji || {}).bosluk ?? 0.46);
  const allPts = model.points.filter((p) => p.E != null);
  const ext = allPts.reduce((a, p) => ({ x0: Math.min(a.x0, p.E), y0: Math.min(a.y0, p.N), x1: Math.max(a.x1, p.E), y1: Math.max(a.y1, p.N) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  if (!Number.isFinite(ext.x0)) Object.assign(ext, { x0: 0, y0: 0, x1: 100, y1: 100 });
  w.g(999, 'Sebeke-M Hakedis · ' + (model.project.name || '') + ' · CRS ' + model.crs.label + (model.crs.epsg ? ' EPSG:' + model.crs.epsg : '') + ' · olcek 1/1000 · birim m');
  w.g(0, 'SECTION').g(2, 'HEADER').g(9, '$ACADVER').g(1, 'AC1009').g(9, '$INSBASE').g(10, 0).g(20, 0).g(30, 0)
    .g(9, '$EXTMIN').g(10, f(ext.x0)).g(20, f(ext.y0)).g(30, 0).g(9, '$EXTMAX').g(10, f(ext.x1)).g(20, f(ext.y1)).g(30, 0)
    .g(9, '$DWGCODEPAGE').g(3, 'ANSI_1254').g(9, '$LTSCALE').g(40, 1.0).g(9, '$PDMODE').g(70, 3).g(9, '$PDSIZE').g(40, 0.5).g(0, 'ENDSEC');
  // TABLES
  const layers = legendLayers();
  w.g(0, 'SECTION').g(2, 'TABLES');
  w.g(0, 'TABLE').g(2, 'LTYPE').g(70, LTYPES.length);
  for (const [n, d, pat] of LTYPES) {
    w.g(0, 'LTYPE').g(2, n).g(70, 0).g(3, d).g(72, 65).g(73, pat.length).g(40, f(pat.reduce((s, x) => s + Math.abs(x), 0)));
    for (const x of pat) w.g(49, f(x));
  }
  w.g(0, 'ENDTAB');
  w.g(0, 'TABLE').g(2, 'LAYER').g(70, layers.length + 1);
  w.g(0, 'LAYER').g(2, '0').g(70, 0).g(62, 7).g(6, 'CONTINUOUS');
  for (const l of layers) w.g(0, 'LAYER').g(2, l.name).g(70, 0).g(62, l.aci).g(6, l.lt);
  w.g(0, 'ENDTAB');
  w.g(0, 'TABLE').g(2, 'STYLE').g(70, 1).g(0, 'STYLE').g(2, 'STANDARD').g(70, 0).g(40, 0).g(41, 1).g(50, 0).g(71, 0).g(42, th).g(3, STIL.yazi.fontDosyasi || 'tahoma.ttf').g(4, '').g(0, 'ENDTAB');
  w.g(0, 'ENDSEC');
  blocks(w);
  // ENTITIES
  w.g(0, 'SECTION').g(2, 'ENTITIES');
  const text = (layer, x, y, z, s, h = th, rot = 0, color = null) => { w.g(0, 'TEXT').g(8, layer); if (color != null) w.g(62, color); w.g(10, f(x)).g(20, f(y)).g(30, f(z || 0)).g(40, f(h)).g(1, s).g(50, f(rot)); };
  /**
   * Parçaya ortalı yazı: (x, y) hizalama noktası — üst: false → taban çizgisinin ortası (metraj), true → üst kenarın ortası
   * (hat etiketi). 10/20 sol alt köşe (harf tablosuyla yaklaşık; hizalamayı okumayan programlar için), 11/21 hizalama
   * noktası, 72 = 1 ortalı, 73 = 3 üstten; 41 genişlik katsayısı (sığdırma).
   */
  const ortaliText = (layer, x, y, s, h, rot, color, ust, gk) => {
    const r = rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), yarim = yaziGenisligi(s, h, gk) / 2, asagi = ust ? h : 0;
    const x0 = x - yarim * c + asagi * sn, y0 = y - yarim * sn - asagi * c;
    w.g(0, 'TEXT').g(8, layer); if (color != null) w.g(62, color);
    w.g(10, f(x0)).g(20, f(y0)).g(30, 0).g(40, f(h)).g(1, s).g(50, f(rot));
    if (Math.abs(gk - 1) > 1e-9) w.g(41, f(gk));
    w.g(72, 1).g(11, f(x)).g(21, f(y)).g(31, 0);
    if (ust) w.g(73, 3);
  };
  const ol = B.simge;
  const insert = (layer, block, x, y, z, color = null, rot = 0) => { w.g(0, 'INSERT').g(8, layer); if (color != null) w.g(62, color); w.g(2, block).g(10, f(x)).g(20, f(y)).g(30, f(z || 0)).g(41, f(ol)).g(42, f(ol)).g(43, f(ol)).g(50, f(rot)); };
  // Açıklık sınırı olan elemanların noktaları (direk, SDK, pano, trafo…)
  const nodePts = new Set(model.equipment.filter((e) => e.pointId && !ARA_ELEMAN.has(e.kind)).map((e) => e.pointId));
  let nLines = 0, nIns = 0, nTxt = 0, nKenar = 0, nKalin = 0, nMalzeme = 0;
  for (const l of model.lines) {
    if (l.coords.length < 2) continue;
    // Çizgi tipi katmandan; ileride yapılacak hat kesikli, yalnız kanal / sondaj kendi çizgisinde (katmanı kabloyla ortak)
    const layer = lineLayer(l), lt = l.state === 'ILERIDE' ? 'DASHED' : l.channelOnly ? STIL.katmanlar[lineKey(l)].cizgi || null : null, aci = lineAci(l);
    const kal = l.channelOnly ? 0 : hatKalinligi(l, B.kalinlik);
    if (kal > 0) {
      // Kalın hat: eklentideki gibi genişlikli çoklu çizgi (ekranda ve baskıda görünür; 70 = 128 çizgi tipi köşelerde
      // bölünmez). Düz (2B) çizilir: noktaların kotu ÖLÇÜ katmanındaki noktalarda ve simgelerde kalır.
      w.g(0, 'POLYLINE').g(8, layer); if (lt) w.g(6, lt); w.g(62, aci);
      w.g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, 128).g(40, f(kal)).g(41, f(kal));
      for (const c of l.coords) w.g(0, 'VERTEX').g(8, layer).g(10, f(c.E)).g(20, f(c.N)).g(30, 0);
      w.g(0, 'SEQEND').g(8, layer); nLines += l.coords.length - 1; nKalin++;
    } else {
      for (let i = 0; i < l.coords.length - 1; i++) {
        const a = l.coords[i], b = l.coords[i + 1];
        w.g(0, 'LINE').g(8, layer); if (lt) w.g(6, lt); w.g(62, aci);
        w.g(10, f(a.E)).g(20, f(a.N)).g(30, f(a.H || 0)).g(11, f(b.E)).g(21, f(b.N)).g(31, f(b.H || 0)); nLines++;
      }
    }
    // Kanal: eksenin iki yanında, genişliğin yarısı kadar uzakta kenar çizgileri (eklentideki KenarlariYaz): kanalın
    // katmanında, sürekli çizgiyle, kanalın renginde (demontajda sarı)
    const kw = kanalGenisligi(l);
    if (kw > 0) {
      const kenar = STIL.katmanlar.KANAL.kenar || {}, kk = KAT('KANAL');
      const renk = l.state === 'DEMONTAJ' ? DEMONTAJ_ACI : kenar.aci || STIL.katmanlar.KANAL.aci;
      const xy = l.coords.map((c) => ({ x: c.E, y: c.N }));
      for (const yan of [kw / 2, -kw / 2]) {
        const e = esCizgi(xy, yan);
        if (e.length < 2) continue;
        w.g(0, 'POLYLINE').g(8, kk).g(6, kenar.cizgi || 'CONTINUOUS').g(62, renk).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, 0);
        for (const p of e) w.g(0, 'VERTEX').g(8, kk).g(10, f(p.x)).g(20, f(p.y)).g(30, 0);
        w.g(0, 'SEQEND').g(8, kk); nKenar++;
      }
    }
    // Metraj: her açıklığa bir yazı (iki direk / iki bağlantı elemanı arası), parçanın ortasına ortalı, hattın renginde
    if (opts.spanText !== false) {
      const mdy = l.channelOnly ? kdy : pdy;
      for (const sp of spanTexts(l.coords, (c) => nodePts.has(c.id))) {
        const a = l.coords[sp.seg], b = l.coords[sp.seg + 1], metin = aciklikMetraji(l, sp, model.project.conductorPayPct || 0).toFixed(2);
        const k = yaziKonumu(a, b, 0, mdy), s = yaziSigdir(metin, thParca, Math.hypot(b.E - a.E, b.N - a.N));
        ortaliText(YAZI(), k.x, k.y, metin, s.h, k.ang, aci, false, s.gk); nTxt++;
      }
    }
    // Hat etiketi (kablo tipi; "hat no kesit", haritayla aynı yazı: hatYazisi): en uzun parçanın ortasına ortalı, üst
    // kenarı çizginin alt yanında, parçaya sığdırılmış
    const ep = enUzunParca(l.coords), ea = l.coords[ep], eb = l.coords[ep + 1], etiket = hatYazisi(l.no, l.state, l.label, l.channelOnly);
    const k = yaziKonumu(ea, eb, 0, hdy), es = yaziSigdir(etiket, B.etiket, Math.hypot(eb.E - ea.E, eb.N - ea.N));
    ortaliText(YAZI(), k.x, k.y, etiket, es.h, k.ang, aci, true, es.gk); nTxt++;
  }
  for (const e of model.equipment) {
    if (e.E == null) continue;
    let layer, color = null;
    const block = sembolBlogu(e, B.takim); // demontajda çapraz çizgi bloğun içindedir (SH_…_DM); takım projenin ayarından
    if (e.kind === 'pole' || e.kind === 'lighting') {
      const volt = e.kind === 'lighting' || e.group === 'ayd' ? 'AYD' : e.volt === 'OG' ? 'OG' : 'AG';
      layer = poleLayer(e);
      color = POLE_ACI[volt][stIdx(e.state)];
    } else if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') layer = KAT('TRAFO');
    else if (e.kind === 'sdk' || e.kind === 'panel') layer = KAT('SDK');
    else if (e.kind === 'manhole') layer = KAT('KABLO');
    else if (e.kind === 'luminaire') { layer = KAT('DIREK_AYD'); color = STIL.nesneRenkleri.armatur; }
    else layer = YAZI();
    if (e.state === 'DEMONTAJ' || e.state === 'demontaj') color = DEMONTAJ_ACI;
    insert(layer, block, e.E, e.N, e.H, color); nIns++;
    // Eleman yazısı simgenin sağ üstünde; yeri simgeyle büyür (simgenin dışında kalsın), yüksekliği ayrı ayarlanır
    text(YAZI(), e.E + edx * ol, e.N + edy * ol, e.H, e.no + (e.typeName ? ' ' + e.typeName : ''), th, 0); nTxt++;
    // Malzemeler (Çizim boyutları › Malzemeleri çizimde göster): eleman yazısının altında satır satır, eleman yazısının
    // 0,7'si yükseklikte, satır aralığı 1,5, beyaz / siyah; satırlar sh-core malzemeEtiketi'nden. DXF R12 (AC1009)
    // biçimindedir: MTEXT bu sürümde yoktur, AutoCAD dosyayı açmaz (13.11.2026) — satırlar ayrı TEXT, simgeden bağımsız
    // taşınır (AutoCAD eklentisi kendi çiziminde tek MText yazar: SH_MLZ).
    const satirlar = B.malzeme && opts.malzemeSatirlari ? opts.malzemeSatirlari[e.id] : null;
    if (satirlar && satirlar.length) {
      const hm = th * MALZEME_YAZISI.oran, adim = hm * MALZEME_YAZISI.aralik;
      const y0 = e.N + edy * ol - (0.45 * th + 1.15 * hm);
      satirlar.forEach((m, i) => { text(YAZI(), e.E + edx * ol, y0 - i * adim, e.H, m, hm, 0, 7); nTxt++; nMalzeme++; });
    }
    if (e.role === 'Z' && e.angle) { text(YAZI(), e.E + adx * ol, e.N + ady * ol, e.H, 'α=' + e.angle.toFixed(2) + '°', thKucuk); nTxt++; }
  }
  for (const p of model.points) {
    if (p.E == null) continue;
    w.g(0, 'POINT').g(8, OLCU()).g(10, f(p.E)).g(20, f(p.N)).g(30, f(p.H || 0));
    if (opts.pointText !== false && !model.equipment.some((e) => e.pointId === p.id)) { text(OLCU(), p.E + 1, p.N + 1, p.H, p.no + ' ' + (p.H != null ? (+p.H).toFixed(2) : ''), th * (STIL.yazi.noktaYazisi / STIL.yazi.yukseklik)); nTxt++; }
  }
  w.g(0, 'ENDSEC').g(0, 'EOF');
  const txt = w.text();
  return { text: txt, stats: { layers: layers.length + 1, lines: nLines, inserts: nIns, texts: nTxt, edges: nKenar, thick: nKalin, materials: nMalzeme } };
}

// Türkçe karakterler için Windows-1254 kodlaması (R12 DXF); tabloda olmayanlar AutoCAD \U+XXXX kaçışı ile
const CP1254 = { 0x011E: 0xd0, 0x0130: 0xdd, 0x015e: 0xde, 0x011f: 0xf0, 0x0131: 0xfd, 0x015f: 0xfe, 0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };
export function dxfBytes(text) {
  const out = [];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (CP1254[c] !== undefined) out.push(CP1254[c]);
    else if (c >= 0xa0 && c <= 0xff && ![0xd0, 0xdd, 0xde, 0xf0, 0xfd, 0xfe].includes(c)) out.push(c);
    else for (const b of ('\\U+' + c.toString(16).toUpperCase().padStart(4, '0'))) out.push(b.charCodeAt(0));
  }
  return new Uint8Array(out);
}
