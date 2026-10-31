// Telefon haritasının çizim görünümü: hat renkleri, çizgi desenleri, kanal kenarları, açıklık metrajı ve hat etiketi
// ortak çizim stilinden (ortak/katalog/cizim-stili.json → ../ortak/cizim-stili.js). Eklentinin çizimiyle ve telefonun
// DXF'iyle aynı kurallar: renk eklentideki CizimStili.EkranHatRengi, metraj CizimYazici.ParcaMetrajlariYaz +
// Geometri.Acikliklar, etiket CizimYazici.EtiketYaz, kanal kenarı CizimYazici.KenarlariYaz (NesneYazici.KanalGenisligi).
// Ekranda yazı boyu okunur aralıkta tutulur; yazının çizgiye uzaklığı yazı boyuyla aynı oranda küçülür / büyür.
import STIL from '../ortak/cizim-stili.js';
import { lineKey, ARA_ELEMAN, hatYazisi, kanalGenisligi as kanalGen, esCizgi as esCizgiDunya } from '../export/dxf.js';
import { lineLabel, kanalModel } from '../grid/lines.js';
import { aciCSS } from '../cad/aci.js';

export const EKRAN = STIL.ekran;
/** Demontaj rengi (çizimdeki ACI 2, sarı). */
export const DEMONTAJ_RENGI = aciCSS(STIL.direkRenkleri.demontaj);
/** Hat türünün (kısa ad) ekran rengi: seçim düğmeleri ve hat listeleri için. Müşterek direk O.G. renginde. */
export const TUR_RENGI = { AG: EKRAN.hat.HAT_AG, OG: EKRAN.hat.HAT_OG, MUS: EKRAN.hat.HAT_OG, AYD: EKRAN.hat.HAT_AYD, ENH: EKRAN.hat.HAT_ENH, ABONE: EKRAN.hat.HAT_ABONE };

/** Hattın ortak stil anahtarı (HAT_AG, KABLO_OG, KANAL, SONDAJ…): DXF'teki ve eklentideki katman türüyle aynı. */
export const hatAnahtari = (l) => lineKey(l);

/**
 * Hattın ekran rengi: türünün rengi (abone turuncu, müşterek mor, AG kablo mavi, OG kablo pembe, kanal gri, sondaj
 * sarı-turuncu); demontajda sarı (çizimdeki gibi). dm = false: demontaj işareti kapalıyken türünün renginde.
 */
export function hatRengi(l, dm = true) {
  if (dm && l.state === 'DEMONTAJ') return DEMONTAJ_RENGI;
  return EKRAN.hat[lineKey(l)] || EKRAN.diger;
}

/** Hattın çizgi tipi (ortak stil adı): ileride yapılacak hat kesikli, ötekiler katmanının çizgisinde. */
export function hatCizgisi(l) {
  if (l.state === 'ILERIDE') return 'DASHED';
  return (STIL.katmanlar[lineKey(l)] || {}).cizgi || 'CONTINUOUS';
}

/**
 * Çizgi tipinin ekrandaki deseni (piksel): çizimdeki desen (1/1000 paftada mm) × k. Yuvarlak uçlar her çizgiyi
 * kalınlığı kadar uzattığından boşluklara kalınlık eklenir; sıfır uzunluklu çizgi kalınlığı çapında nokta olur
 * (DOT, DASHDOT). Sürekli çizgide boş dizi.
 */
export function ekranDeseni(ad, kalinlik = 2, k = 2) {
  const p = STIL.cizgiTipleri[ad] || [];
  return p.map((x) => (x >= 0 ? Math.max(0.01, x * k) : -x * k + kalinlik));
}

/** Kanal kenarlarının arası (m; 0: kenar yok) — telefonun DXF'iyle aynı kural (export/dxf.js › kanalGenisligi). */
export const kanalGenisligi = kanalGen;
/** Kanal kenarının rengi: kanalın rengi (gri), demontajda sarı (eklentide kenar eksenin görünen renginde). */
export const kenarRengi = (l, dm = true) => (dm && l.state === 'DEMONTAJ' ? DEMONTAJ_RENGI : EKRAN.hat.KANAL);
/** Yatay sondajla geçen kablo: eklentide kablonun altında ayrı bir sondaj çizgisi (noktalı) vardır. */
export const sondajli = (l) => l.install === 'yeralti' && !l.channelOnly && kanalModel(l.cable).method === 'sondaj';

/** Ekran koordinatında eş çizgi (DXF'teki esCizgi; yarım pikselden yakın köşeler tek sayılır). */
export const esCizgi = (pts, d) => esCizgiDunya(pts, d, 0.5);

/** Açıklık sınırı olan köşe: üstünde direk, SDK, pano, trafo… olan nokta (menhol ve armatür hattın ara elemanıdır). */
export const dugumMu = (eqs) => !!eqs && eqs.some((e) => !ARA_ELEMAN.has(e.kind));

/** Hat etiketi "hat no kesit" (telefonun DXF'iyle aynı yazı); hat, durumu ve iletkenleri değişmedikçe yeniden kurulmaz. */
const etiketBellegi = new WeakMap();
export function hatEtiketi(l, cat) {
  const k = l.lineNo + '|' + l.state + '|' + (l.channelOnly ? 1 : 0) + '|' + (cat && cat.std ? cat.std.code : '') + '|' + JSON.stringify(l.circuits || []);
  const c = etiketBellegi.get(l);
  if (c && c.k === k) return c.t;
  const t = hatYazisi(l.lineNo, l.state, lineLabel(l, cat), l.channelOnly);
  etiketBellegi.set(l, { k, t });
  return t;
}

/** Yazı boyları (m, çizimde) ve kaydırmalar (parçanın kendi ekseninde [boyunca, dik]). */
export const YAZI = {
  metraj: STIL.yazi.parcaMetraji, etiket: STIL.yazi.yukseklik,
  font: (STIL.yazi.font || 'Tahoma') + ', "DejaVu Sans", Roboto, Inter, sans-serif',
  hane: ((STIL.etiketler.parcaMetraji.bicim || '0.00').split('.')[1] || '').length
};
export const KAYDIRMA = {
  metraj: STIL.etiketler.parcaMetraji.kaydirma,
  kazi: (STIL.etiketler.kaziMetraji || STIL.etiketler.parcaMetraji).kaydirma,
  etiket: STIL.etiketler.hat.kaydirma
};
/**
 * Ekrandaki yazı boyu (px): çizimdeki boy (m) ÷ ölçek (m/px), okunur aralıkta tutulur. s: çizimdeki kaydırmaların
 * çarpanı — yazı sınıra takılınca kaydırma da aynı oranda değişir, yazı çizgiye göre çizimdeki yerinde kalır.
 */
export function yaziOlcusu(boyM, res, enAz = 9, enCok = 15) {
  const px = Math.max(enAz, Math.min(enCok, boyM / res));
  return { px, s: (px * res) / boyM };
}
