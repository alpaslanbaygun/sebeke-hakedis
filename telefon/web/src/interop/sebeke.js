// AutoCAD eklentisiyle dosya uyumu: telefon projesi ↔ .sebeke.json (ortak/VERI-MODELI.md).
//
//   sebekeYaz(ps)        açık projeyi AutoCAD proje dosyasına çevirir (eklentideki "Telefondan Al" bunu okur)
//   sebekeIceAl(ps, …)   AutoCAD proje dosyasını telefon projesine alır (eklentideki "Telefona Gönder" dosyası)
//   voltProjeYaz(ps)     telefonun tam proje dosyası (volt-project/3): ham veri + AutoCAD için hazır 'sebeke' bölümü
//   voltProjeOku(metin)  her iki biçimi tanır, AutoCAD proje nesnesini döndürür
//
// Eşleme tabloları ortak/katalog/volt-eslesme.json'dadır (telefon kopyası: src/ortak/volt-eslesme.js). PROMAGIS
// kurallarının JavaScript karşılığı sh-core.cjs'dir (etiket, kanal kodu, bölge seçimi, proje dosyası yazımı, rapor).
import SH from './sh-core.cjs';
import ESLESME from '../ortak/volt-eslesme.js';
import KALEMLER from '../ortak/kalemler.js';
import { lineLabel, circuitParts, kanalModel } from '../grid/lines.js';
import { jobOf } from '../grid/recipe.js';
import { makeCrs } from '../geo/crs.js';
import { hakOf } from '../core/schema.js';

export const VOLT_BICIM = 'volt-project/3';
const r3 = (v) => Math.round((+v || 0) * 1000) / 1000;
const r4 = (v) => Math.round((+v || 0) * 10000) / 10000;
const low = (s) => String(s || '').toLocaleLowerCase('tr-TR');

// ---------------------------------------------------------------- Katalog yardımcıları

let _katalog = null;
/** PROMAGIS kalem kataloğu (ortak/katalog/kalemler.json): cins|tanım → kalem. */
function katalog() {
  if (_katalog) return _katalog;
  const liste = SH.katalogHazirla(KALEMLER, null);
  const anahtar = new Map(liste.map((k) => [k.cins + '|' + k.tanim, k]));
  const normal = new Map(liste.map((k) => [k.cins + '|' + adNormal(k.tanim), k]));
  const cinsTarife = new Map();
  for (const k of liste) { if (!cinsTarife.has(k.cins)) cinsTarife.set(k.cins, new Map()); const m = cinsTarife.get(k.cins); m.set(k.tarife, (m.get(k.tarife) || 0) + 1); }
  const enCokTarife = new Map();
  for (const [c, m] of cinsTarife) enCokTarife.set(c, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return (_katalog = { liste, anahtar, normal, enCokTarife });
}
/** Ad karşılaştırması için sadeleştirme: küçük harf, boşluksuz, x/X, virgül → nokta, ALPEK ↔ AER. */
export function adNormal(s) {
  return low(s).replace(/\s+/g, '').replace(/,/g, '.').replace(/×/g, 'x').replace(/alpek/g, 'aer').replace(/alm\.?$/, '').replace(/\.$/, '');
}
/** Katalogdan (cins, tanım) kalemi: önce birebir, sonra sadeleştirilmiş adla. */
function katalogKalemi(cins, tanim) {
  const k = katalog();
  return k.anahtar.get(cins + '|' + tanim) || k.normal.get(cins + '|' + adNormal(tanim)) || null;
}
function cinsTarifesi(cins, varsayilan) { return katalog().enCokTarife.get(cins) || varsayilan || ''; }

// ---------------------------------------------------------------- Durum ve ad eşlemeleri

/** Telefon durumu → PROMAGIS durumu; YENI'de tedarik: Y → M+M, Ş → M. null: dosyaya yazılmaz (ileride). */
export function promagisDurumu(state, supply) {
  const d = ESLESME.durumlar[state];
  if (d === undefined) return 'MEVCUT';
  if (d === 'M' && supply && ESLESME.tedarik[supply]) return ESLESME.tedarik[supply];
  return d;
}
/**
 * AutoCAD'den gelen özel durum kodu (KM, ENH, ME) korunur: telefonda durum değişmediyse dosyaya aynı kod yazılır;
 * değiştiyse telefonun durumundan türetilen kod kullanılır.
 */
function ozelDurum(turetilen, orijinal, state, trafo) {
  const o = String(orijinal || '').trim().toUpperCase();
  if (!o || o === turetilen || !ESLESME.durumlarTers[o] || ['M', 'M+M', 'DM', 'DM+M', 'MEVCUT'].includes(o)) return turetilen;
  return voltDurumu(o, trafo) === state ? o : turetilen;
}
/** İş türü (montaj / demontaj / dmm) → PROMAGIS durumu. */
const isDurumu = (job, supply) => (job === 'montaj' ? (supply && ESLESME.tedarik[supply]) || 'M' : ESLESME.isler[job] || 'M');

/** Direk tipi adı: telefon → PROMAGIS yazımı (beton 9.3/8 → 9,3/8; GD-10 (3 AWG) → G-D-10 (sw)). */
export function promagisTip(grup, ad) {
  const s = String(ad || '').trim();
  if (grup === 'beton' || grup === 'beton562') return s.replace(/\./g, ',');
  if (grup === 'bahh') { const m = /^G([A-Z]{1,2})-(\d+)\s*\((3 AWG|1\/0)\)$/i.exec(s); if (m) return 'G-' + m[1].toUpperCase() + '-' + m[2] + ' (' + (m[3].toUpperCase() === '3 AWG' ? 'sw' : '1/0') + ')'; }
  if (grup === 'trafo') { const m = /^G-?T-?(\d+)$/i.exec(s); if (m) return 'G-T-' + m[1]; }
  return s;
}
/** Direk tipi adı: PROMAGIS → telefon yazımı. */
export function voltTip(grup, ad) {
  const s = String(ad || '').trim();
  if (grup === 'beton' || grup === 'beton562') return s.replace(/,/g, '.');
  if (grup === 'bahh') { const m = /^G-([A-Z]{1,2})-(\d+)\s*\((sw|1\/0)\)$/i.exec(s); if (m) return 'G' + m[1].toUpperCase() + '-' + m[2] + ' (' + (m[3].toLowerCase() === 'sw' ? '3 AWG' : '1/0') + ')'; }
  if (grup === 'trafo') { const m = /^G-T-(\d+)$/i.exec(s); if (m) return 'G-T' + m[1]; }
  return s;
}
/** Çıplak OG iletkeni / hat etiketi: 3xSwallow → 3xSW, 3x(1x240/25) NA2XSY → 1x240/25 Xlpe Alm. vb. */
export function promagisKesit(label, lineType, install) {
  let s = String(label || '').trim();
  if (!s) return { tanim: '', aciklama: '' };
  if (install === 'yeralti') {
    const m = /^(\d+)x\((1x[\d/.,]+)\)\s*(YE3SV|NA2XSY|XLPE)?/i.exec(s);
    if (m) return { tanim: m[2] + ' Xlpe Alm.', aciklama: m[1] + '(' + m[2] + ') Xlpe Alm.' };
    const n = /^(NA?YY)\s+(.+)$/i.exec(s);
    if (n) return { tanim: n[2] + ' Nyy ' + (n[1].toUpperCase() === 'NYY' ? 'Cu' : 'Alm.'), aciklama: '' };
    return { tanim: s, aciklama: '' };
  }
  for (const [ad, kisa] of Object.entries(ESLESME.iletkenler)) s = s.replace(new RegExp(ad, 'gi'), kisa);
  if (/aer$/i.test(s)) s = s.replace(/\s*AER$/i, ' ALPEK').replace(/x/g, 'X');
  return { tanim: s, aciklama: '' };
}

// ---------------------------------------------------------------- Telefon → AutoCAD (.sebeke.json)

/** Açık projeden AutoCAD proje nesnesi (SH.projeYaz ile yazılır). opts: { katmanOnEki, gisOnEki } */
export function sebekeModel(ps, opts = {}) {
  const { p: project, cat, data, result } = ps;
  if (!project || !result) throw new Error('Açık proje yok');
  const uyarilar = [];
  const sb = project.sebeke || {};
  const crs = project.crs || {};
  const dom = +crs.cm || +(sb.dom) || 39;
  const datum = /turef|itrf/i.test(crs.datum || '') || !crs.datum ? 'ITRF96' : crs.datum;
  const sp = SH.yeniProje({ ad: project.name, dom, hakedis: aktifHakedis(data.periods), katmanOnEki: opts.katmanOnEki || sb.katmanOnEki || 'SC', gisOnEki: opts.gisOnEki || sb.gisOnEki || sb.katmanOnEki || 'SC' });
  sp.olusturan = 'VOLT-EDAŞ Saha';
  sp.proje.kaynak = sb.kaynak || 'telefon';
  sp.proje.koordinat.datum = datum;
  sp.proje.kod = project.code || '';
  const act = (a) => (a || []).filter((x) => x.status !== 'deleted');
  const pts = new Map(act(data.points).map((p) => [p.id, p]));
  const eqs = act(data.equipment), lines = act(data.lines);

  // Bölgeler: AutoCAD'den gelen bölgeler korunur; yoksa projenin kendisi tek bölgedir (tüm noktaları kapsayan kutu)
  if (Array.isArray(sb.bolgeler) && sb.bolgeler.length) sp.bolgeler = sb.bolgeler.map((b) => Object.assign({}, b));
  else {
    const xs = [], ys = [];
    for (const p of pts.values()) if (p.E != null) { xs.push(p.E); ys.push(p.N); }
    const pad = 10;
    const x0 = xs.length ? Math.min(...xs) - pad : 0, x1 = xs.length ? Math.max(...xs) + pad : 100, y0 = ys.length ? Math.min(...ys) - pad : 0, y1 = ys.length ? Math.max(...ys) + pad : 100;
    sp.bolgeler.push({ id: 'B1', ad: project.name || 'Proje', kod: project.code || '', sinir: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
  }
  const bolgeAlanlari = new Map(sp.bolgeler.map((b) => [b.id, SH.alan(b.sinir)]));
  const bolgeIdi = (E, N) => { const b = SH.bolgeSec([E, N], sp.bolgeler, bolgeAlanlari); return b ? b.id : (sp.bolgeler[0] ? sp.bolgeler[0].id : ''); };
  const hakedisi = (rec) => objeHakedisi(rec, data.periods, sp.proje.aktifHakedis);

  // Elemanlar
  const eqByPoint = new Map();
  for (const e of eqs) { if (!eqByPoint.has(e.pointId)) eqByPoint.set(e.pointId, []); eqByPoint.get(e.pointId).push(e); }
  for (const e of eqs) {
    const p = pts.get(e.pointId);
    if (!p || p.E == null) { uyarilar.push(e.no + ': konumu yok, dosyaya yazılmadı'); continue; }
    const ms = result.matsByEq.get(e.id) || { items: [], job: jobOf(e) };
    const tanim = elemanTanimi(e, cat);
    let durum = promagisDurumu(e.state, tanim.tedarik);
    if (durum === null) { uyarilar.push(e.no + ': "ileride" durumundaki obje AutoCAD dosyasına yazılmaz'); continue; }
    durum = ozelDurum(durum, e.sebeke && (e.sebeke.durum || (e.sebeke.anaKalem && e.sebeke.anaKalem.durum)), e.state, e.kind === 'transformer');
    const hak = hakedisi(e);
    const bolge = bolgeIdi(p.E, p.N);
    const el = {
      id: (e.sebeke && e.sebeke.id) || e.sebekeId || e.id, tur: tanim.tur, gisId: e.no || '', cins: tanim.cins, tip: tanim.tip, durum, hakedis: hak, bolge,
      saga: r4(p.E), yukari: r4(p.N), kot: p.H != null ? r4(p.H) : 0, aci: (e.sebeke && e.sebeke.aci) || 0,
      guc: tanim.guc || '', gerilim: tanim.gerilim || '', kontrol: null, katman: (e.sebeke && e.sebeke.katman) || '', blok: (e.sebeke && e.sebeke.blok) || '',
      kalemler: [], telefonId: e.id, olcum: olcumBilgisi(p), not: e.note || undefined
    };
    if (e.sebekeId && e.sebekeId !== e.id) el.id = e.sebekeId;
    // Nesnenin kendi pozu: direk tipi, trafo direği, köşk gövdesi, SDK tipi, seçilen poz
    const kendiEtiketi = e.kind === 'pole' || e.kind === 'lighting' ? 'direk' : tanim.tur === 'TRAFO_DIREGI' ? 'direk' : tanim.tur === 'TRAFO_MERKEZI' ? 'kosk' : e.kind === 'sdk' ? 'sdk' : 'self';
    const kendi = ms.items.find((m) => m.origin === 'OTO' && m.tag === kendiEtiketi) || null;
    const anaKalem = anaKalemYap(tanim, kendi, durum, hak, e);
    if (anaKalem) el.kalemler.push(anaKalem);
    for (const m of ms.items) {
      if (m === kendi) continue;
      const k = malzemeKalemi(m, tanim, hak, ms.job, cat);
      if (k) el.kalemler.push(k);
    }
    sp.elemanlar.push(el);
  }

  // Hatlar, kanallar, sondajlar. Hat, ekipman olan düğümlerde bölünür: direkten direğe / SDK'dan SDK'ya her açıklık
  // AutoCAD'de ayrı bir hat nesnesidir (kendi metrajı ve etiketiyle; PROMAGIS ve eklenti böyle çalışır). Parçaların
  // kimlikleri korunur: daha önce AutoCAD'den gelen parça kimlikleri (sebeke.parcalar) aynı uçlara yeniden verilir,
  // yenileri "<hat kimliği>#<sıra>" olur. Telefona geri alınırken parçalar yeniden tek hat olur.
  for (const l of lines) {
    const li = result.lineInfo.get(l.id) || { items: [], length2D: 0, length3D: 0, cable: null };
    const coords = (l.nodes || []).map((id) => pts.get(id)).filter((p) => p && p.E != null);
    if (coords.length < 2) { uyarilar.push(l.lineNo + ': iki noktası yok, dosyaya yazılmadı'); continue; }
    const hak = hakedisi(l);
    const hatTuru = hatTuruSec(l);
    const iletkenler = li.items.filter((x) => !x.kanal && !x.material && !x.manual && (x.conductor || x.role));
    const tedarik = tedarikOf(cat, iletkenler.length ? iletkenler[0].servis : null);
    let durum = promagisDurumu(l.state, tedarik);
    if (durum === null) { uyarilar.push(l.lineNo + ': "ileride" durumundaki hat AutoCAD dosyasına yazılmaz'); continue; }
    durum = ozelDurum(durum, l.sebeke && l.sebeke.durum, l.state, false);
    const km = l.install === 'yeralti' ? kanalModel(l.cable) : null;
    const kablolu = !(l.channelOnly && !(l.circuits || []).length);
    const sb2 = l.sebeke || {};
    const temelId = sb2.id || l.sebekeId || l.id;
    const parcalar = hatParcalari(coords, eqByPoint);
    const n = parcalar.length;
    const ucEleman = (p) => { const es = eqByPoint.get(p.id) || []; return es.length ? es[0] : null; };
    const ucKimlik = (e) => (e ? (e.sebekeId || e.id) : '');
    const paylar = parcalar.map((pc) => (l.install === 'yeralti' ? uzunluk2D(pc) : uzunluk3D(pc)));
    const eskiParcalar = Array.isArray(sb2.parcalar) ? sb2.parcalar : [];
    const parcaKimligi = (uclar, i, alan, onek) => {
      if (n === 1) return null;
      const eski = eskiParcalar.find((x) => x && x[alan] && Array.isArray(x.uclar) && uclar[0] && uclar[1] && ((x.uclar[0] === uclar[0] && x.uclar[1] === uclar[1]) || (x.uclar[0] === uclar[1] && x.uclar[1] === uclar[0])));
      return eski ? eski[alan] : onek + temelId + '#' + (i + 1);
    };

    // Hattın tüm kalemleri (bütün hat için), sonra parçalara dağıtılır
    const kesit = kablolu ? promagisKesit(sb2 && !(l.circuits || []).length && sb2.anaKesit ? sb2.anaKesit : lineLabel(l, cat), l.lineType, l.install) : null;
    let hatKalemleri = kablolu ? iletkenKalemleri(l, li, iletkenler, hatTuru, kesit, durum, hak, cat) : [];
    if (kablolu && !hatKalemleri.length && Array.isArray(sb2.kalemler)) hatKalemleri = sb2.kalemler.map((k) => Object.assign({}, k, { hakedis: hak }));
    const manuel = [];
    if (kablolu) for (const m of li.items) if (m.manual) { const k = malzemeKalemi(Object.assign({}, m, { kgPer: null, origin: 'MANUEL' }), { cins: '', voltaj: hatTuru.voltaj, tarife: hatTuru.tarife }, hak, li.job, cat); if (k) manuel.push(k); }
    const dagitimlar = new Map();
    for (const k of hatKalemleri) dagitimlar.set(k, k.kaynak === 'HAT' ? dagit(k.miktar, paylar) : null);

    const kn = km && !km.kazisiz && li.cable && li.cable.kanal ? li.cable.kanal : null;
    const kablolar = kn ? kanalKablolari(l) : null;
    const kanalUz = kn ? dagit(Math.ceil(kn.uzunluk - 1e-6), paylar) : null;
    const boruUz = kn && kn.boru > 0 ? dagit(Math.ceil(kn.boru - 1e-6), paylar) : null;

    for (let i = 0; i < n; i++) {
      const pc = parcalar[i];
      const kose = pc.map((p) => [r4(p.E), r4(p.N)]);
      const mid = pc[Math.floor(pc.length / 2)];
      const bolge = bolgeIdi(mid.E, mid.N);
      const uc = [ucEleman(pc[0]), ucEleman(pc[pc.length - 1])];
      const uclar = uc.map(ucKimlik);
      let hat = null;
      if (kablolu) {
        const h = {
          id: n === 1 ? temelId : parcaKimligi(uclar, i, 'id', ''), tur: hatTuru.tur, anaKesit: kesit.tanim, durum, hakedis: hak, bolge, kose,
          cizimUzunlugu: r3(uzunluk2D(pc)), etiket: '', kontrol: null, katman: sb2.katman || '', kalemler: [], telefonId: l.id,
          uclar, not: l.note || undefined
        };
        if (n > 1) h.parca = i + 1;
        for (const k of hatKalemleri) {
          const d = dagitimlar.get(k);
          if (d) h.kalemler.push(SH.kalemToplami(Object.assign({}, k, { miktar: d[i] })));
          else if (i === 0) h.kalemler.push(k);
        }
        if (i === 0) h.kalemler.push(...manuel);
        const ana = h.kalemler.find((k) => k.kaynak === 'HAT') || h.kalemler[0];
        h.etiket = SH.hatEtiketi(durum, kesit.aciklama || kesit.tanim, ana ? ana.miktar : Math.ceil(uzunluk2D(pc) - 1e-6));
        sp.hatlar.push(h);
        hat = h;
      }
      // Yeraltı: kazı kanalı ya da yatay sondaj ayrı nesnedir (parça parça, baş/bit numaralarıyla)
      if (kn) {
        const basNo = uc[0] ? uc[0].no : '', bitNo = uc[1] ? uc[1].no : '';
        const cizimUz = r3(uzunluk2D(pc));
        if (km.method === 'sondaj') {
          const s = {
            id: n === 1 ? ((sb2.sondaj && sb2.id) || 'S' + temelId) : parcaKimligi(uclar, i, 'kanalId', 'S'),
            tip: (sb2.sondaj && sb2.tip) || 'Yatay sondaj' + (l.cable && l.cable.pipeDia ? ' Ø' + l.cable.pipeDia : ''), durum, hakedis: hak, bolge, basNo, bitNo, kose,
            cizimUzunlugu: cizimUz, kontrol: null, kalemler: [], telefonId: l.id
          };
          if (n > 1) s.parca = i + 1;
          const sondaj = li.items.find((x) => x.kanal && /sondaj/i.test(x.why || ''));
          s.kalemler.push(SH.kalemYap({ cins: 'YATAY_DELGİ', tanim: s.tip, birim: 'mt/mt', katsayi: 1, tarife: cinsTarifesi('YATAY_DELGİ', '0104') }, { miktar: kanalUz[i], durum, hakedis: hak, ana: true, kaynak: 'NIT' }));
          if (sondaj && sondaj.servis) s.kalemler[0].servis = sondaj.servis;
          sp.sondajlar.push(s);
        } else {
          const zemin = ESLESME.zeminler[km.surface] || 'TOPRAK';
          const gen = Math.round((kn.genislik || 0) * 100), der = Math.round((kn.derinlik || 0) * 100);
          const c = {
            id: n === 1 ? (sb2.kanalId || 'K' + temelId) : parcaKimligi(uclar, i, 'kanalId', 'K'),
            kod: SH.kanalKodu(kablolar.OG, kablolar.AG, kablolar.AYD, kablolar.REK), zemin, altGenislik: gen, ustGenislik: gen, derinlik: der, basNo, bitNo, durum, hakedis: hak, bolge, kose,
            cizimUzunlugu: cizimUz, kontrol: null, kalemler: [], telefonId: l.id
          };
          if (n > 1) c.parca = i + 1;
          const kk = SH.kalemYap({ cins: String(c.kod), tanim: zemin, birim: 'mt/m³', katsayi: 1, tarife: cinsTarifesi('KABLO_KANALI', '0104') }, { miktar: kanalUz[i], durum, hakedis: hak, ana: true, kaynak: 'NIT' });
          SH.kalemToplami(kk, c);
          c.kalemler.push(kk);
          if (boruUz && boruUz[i] > 0) {
            // Boru PROMAGIS'te kanalın değil kablonun malzemesidir (kanal nesnesi yalnız kendi kalemini taşır)
            const boru = SH.kalemYap({ cins: 'GALVANİZLİ_GAZ_BORUSU', tanim: 'Ø' + ((l.cable && l.cable.pipeDia) || 110) + ' boru', birim: 'mt/mt', katsayi: 1, tarife: cinsTarifesi('GALVANİZLİ_GAZ_BORUSU', '0104') }, { miktar: boruUz[i], durum, hakedis: hak, kaynak: 'MALZEME' });
            if (hat) hat.kalemler.push(boru);
            else { c.kalemler.push(boru); if (i === 0) uyarilar.push(l.lineNo + ': kablosuz kanaldaki boru kalemi AutoCAD çizimine yazılamaz (yalnız dosyadan raporda görünür)'); }
          }
          sp.kanallar.push(c);
        }
      }
    }
  }

  // Ekipmansız ölçü noktaları (detay / kontrol): PROMAGIS GPS noktaları
  const eqPts = new Set(eqs.map((e) => e.pointId));
  const linePts = new Set(); for (const l of lines) for (const id of l.nodes || []) linePts.add(id);
  for (const p of pts.values()) {
    if (eqPts.has(p.id) || p.E == null) continue;
    if (p.cls === 'HAT' && linePts.has(p.id)) continue;
    sp.noktalar.push({ id: p.sebekeId || p.id, ad: p.pointNo || '', kod: p.cls || '', saga: r4(p.E), yukari: r4(p.N), kot: p.H != null ? r4(p.H) : 0, hakedis: sp.proje.aktifHakedis, bolge: bolgeIdi(p.E, p.N), telefonId: p.id, olcum: olcumBilgisi(p) });
  }
  if (uyarilar.length) sp.uyarilar = uyarilar;
  return sp;
}

/** Açık projeyi .sebeke.json metnine çevirir. */
export function sebekeYaz(ps, opts = {}) {
  return SH.projeYaz(sebekeModel(ps, opts), 'VOLT-EDAŞ Saha', opts.girintili !== false);
}

/** Hattın parçaları: ekipman olan düğümlerde bölünür; aradaki ekipmansız noktalar parçanın köşeleridir. */
export function hatParcalari(coords, eqByPoint) {
  const out = [];
  let cur = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    cur.push(coords[i]);
    const son = i === coords.length - 1;
    const dugum = son || (eqByPoint.get(coords[i].id) || []).length > 0;
    if (dugum) { out.push(cur); cur = [coords[i]]; }
  }
  return out.length ? out : [coords];
}
const uzunluk2D = (pc) => { let t = 0; for (let i = 1; i < pc.length; i++) t += Math.hypot(pc[i].E - pc[i - 1].E, pc[i].N - pc[i - 1].N); return t; };
const uzunluk3D = (pc) => { let t = 0; for (let i = 1; i < pc.length; i++) t += Math.hypot(pc[i].E - pc[i - 1].E, pc[i].N - pc[i - 1].N, (pc[i].H || 0) - (pc[i - 1].H || 0)); return t; };
/**
 * Toplam miktarı paylara (uzunluklara) orantılı dağıtır; toplam tam sayıysa parçalar da tam sayı olur ve toplamı
 * birebir tutar (birikimli yuvarlama). Tek parçada toplamın kendisi döner.
 */
export function dagit(toplam, paylar) {
  const n = paylar.length;
  if (n <= 1) return [toplam];
  const T = +toplam || 0;
  const butun = paylar.reduce((a, b) => a + b, 0);
  const tam = Math.abs(T - Math.round(T)) < 1e-9;
  const yuvarla = tam ? Math.round : (v) => Math.round(v * 1000) / 1000;
  const out = [];
  let onceki = 0, birikim = 0;
  for (let i = 0; i < n; i++) {
    birikim += butun > 0 ? paylar[i] / butun : 1 / n;
    const cum = i === n - 1 ? T : yuvarla(T * birikim);
    out.push(Math.max(0, Math.round((cum - onceki) * 1000) / 1000));
    onceki = cum;
  }
  return out;
}

function aktifHakedis(periods) {
  const ps = (periods || []).filter((p) => p.status !== 'deleted');
  if (!ps.length) return 1;
  const taslak = ps.filter((p) => p.status === 'taslak').sort((a, b) => b.no - a.no)[0];
  return taslak ? taslak.no : Math.max(...ps.map((p) => p.no)) + 1;
}
/** Objenin hakediş numarası: hakedişe girdiyse iş tarihinin düştüğü dönem; yoksa aktif hakediş. */
function objeHakedisi(rec, periods, aktif) {
  if (rec.sebeke && rec.sebeke.hakedis) return rec.sebeke.hakedis;
  const h = hakOf(rec);
  if (h === 'HAKEDISTE' || h === 'ONAYLI') {
    const d = (rec.workDate || '').slice(0, 10);
    const per = (periods || []).filter((p) => p.status !== 'deleted' && (!d || ((!p.start || p.start <= d) && (!p.end || d <= p.end)))).sort((a, b) => a.no - b.no)[0];
    if (per) return per.no;
  }
  return aktif;
}
function olcumBilgisi(p) {
  if (!p) return undefined;
  const q = p.quality || {};
  const kaynak = p.source === 'GNSS_RTK' || p.source === 'GNSS_FLOAT' ? 'alici' : p.source === 'PHONE' ? 'telefon' : p.source === 'MAP' ? 'harita' : 'harici';
  return { kaynak, cozum: q.fix || p.source || '', hata: q.sigmaH ?? undefined, uydu: q.sats ?? undefined, zaman: p.measuredAt || p.updatedAt || undefined };
}
function tedarikOf(cat, servis) { const pz = servis ? cat.poz(servis) : null; return pz ? pz.supply : null; }

/** Ekipmanın PROMAGIS türü, cinsi, tipi ve tedarik bilgisi. */
export function elemanTanimi(e, cat) {
  const sb = e.sebeke || {};
  if (e.kind === 'pole' || e.kind === 'lighting') {
    const t = e.typeId ? cat.poleType(e.typeId) : null;
    const grup = e.group || (t && t.group) || (e.kind === 'lighting' ? 'ayd' : 'sehir');
    const g = ESLESME.direkGruplari[grup] || ESLESME.direkGruplari.sehir;
    const pz = t ? cat.poz(t.servis) : null;
    return { tur: sb.tur || g.tur, cins: sb.cins || g.cins, tip: sb.tip || (t ? promagisTip(grup, t.name) : (e.attrs && e.attrs.typeName) || ''), tarife: g.tarife, kg: t ? t.kg : 0, servis: t ? t.servis : null, tedarik: pz ? pz.supply : null, voltaj: g.tur === 'ENH_DIREK' || g.tur === 'MUSTEREK_DIREK' ? 'OG' : g.tur === 'AYD_DIREK' ? 'AYD' : 'AG' };
  }
  if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') {
    const a = e.attrs || {};
    const post = a.post || (e.kind === 'substation' ? 'ind' : e.kind === 'kiosk' ? 'mbk' : 'direk');
    const n = ESLESME.nesneler[e.kind === 'transformer' ? 'transformer:' + (post === 'direk' ? 'direk' : post === 'bina' || post === 'ba' ? 'bina' : 'kosk') : e.kind];
    const td = a.poleTypeId ? cat.poleType(a.poleTypeId) : null;
    const kva = +a.kva || 0;
    const tip = sb.tip || (post === 'direk' ? (td ? promagisTip('trafo', td.name) : (kva ? kva + ' kVA' : '')) : (a.govde || (a.kioskServis && cat.kiosk(a.kioskServis) ? cat.kiosk(a.kioskServis).label : '') || (kva ? kva + ' kVA' : '')));
    return { tur: sb.tur || n.tur, cins: sb.cins || n.cins, tip, tarife: n.tarife, kg: td ? td.kg : 0, servis: td ? td.servis : null, tedarik: td ? tedarikOf(cat, td.servis) : null, guc: kva ? String(kva) : '', gerilim: a.gerilim || '', voltaj: 'OG' };
  }
  const n = ESLESME.nesneler[e.kind] || ESLESME.nesneler.other;
  const a = e.attrs || {};
  let tip = sb.tip || a.typeName || '';
  if (e.kind === 'sdk') { const t = cat.sdkType(a.sdkTypeId); if (t) tip = tip || t.name; }
  if (!tip && a.servis) { const pz = cat.poz(a.servis); if (pz) tip = pz.name; }
  return { tur: sb.tur || n.tur, cins: sb.cins || n.cins, tip, tarife: n.tarife, kg: 0, servis: a.servis || null, tedarik: tedarikOf(cat, a.servis), voltaj: 'AG' };
}

/** Nesnenin kendi pozu (direk tipi, trafo, box…): katalogda varsa oradan, yoksa telefonun kg değerinden. */
function anaKalemYap(tanim, kendi, durum, hak, e) {
  if (!tanim.tip && !kendi) return null;
  const sb = (e.sebeke && e.sebeke.anaKalem) || null;
  const kat = katalogKalemi(tanim.cins, tanim.tip);
  const kg = kendi && kendi.kgPer ? kendi.kgPer : tanim.kg;
  const it = kat || sb || { cins: tanim.cins, tanim: tanim.tip || (kendi ? kendi.name : ''), birim: kg ? 'ad/kg' : 'ad/ad', katsayi: kg || 1, tarife: tanim.tarife || cinsTarifesi(tanim.cins) };
  const k = SH.kalemYap(it, { miktar: kendi ? kendi.qty : 1, durum: kendi && kendi.jobOverride ? isDurumu(kendi.jobOverride, tanim.tedarik) : durum, hakedis: hak, ana: true, kaynak: 'NIT', dmDurum: durum === 'DM' ? (e.attrs && e.attrs.dmDurum) || '' : '' });
  if (kendi && kendi.servis) k.servis = kendi.servis;
  return k;
}

/** Reçete / elle eklenen malzeme → kalem. Katalogda birebir eşi varsa onun cins/tanımı, yoksa poz kategorisinden cins, poz adından tanım. */
function malzemeKalemi(m, tanim, hak, job, cat) {
  if (!(m.qty > 0)) return null;
  const servis = m.servis || null;
  const pz = servis && cat ? cat.poz(servis) : null;
  if (pz && pz.sebeke && pz.sebeke.cins) {
    // AutoCAD'den gelen (ya da kullanıcının PROMAGIS alanlarını girdiği) kalem: alanlar aynen döner
    const sb = pz.sebeke;
    const k = SH.kalemYap({ cins: sb.cins, tanim: sb.tanim, birim: sb.birim, katsayi: sb.katsayi, tarife: sb.tarife }, { miktar: m.qty, durum: isDurumu(m.jobOverride || job || 'montaj', pz.supply), hakedis: hak, kaynak: 'MALZEME' });
    k.servis = servis;
    if (m.origin && m.origin !== 'OTO') k.koken = m.origin;
    return k;
  }
  const es = servis && ESLESME.kalemler[servis] && typeof ESLESME.kalemler[servis] === 'object' ? ESLESME.kalemler[servis] : null;
  let cins = es ? es.cins : null, ad = es ? es.tanim : null;
  const kategori = (pz && pz.category) || '';
  if (!cins) {
    const v = tanim.voltaj || 'AG';
    cins = ESLESME.kategoriler[kategori + '|' + v] || ESLESME.kategoriler[kategori] || (m.tag === 'armatur' ? 'ARMATÜR' : m.tag === 'top' ? 'TOPRAKLAMA' : m.tag === 'kofre' ? 'KOFRA' : m.tag === 'trafo' ? 'TRAFO_GENLEŞME_TANKLI' : m.tag === 'hucre' ? 'HÜCRELER_METAL' : m.tag === 'pano' ? 'AG_PANO_HT' : 'DİĞER_AMBAR_MALZEMELERİ');
  }
  if (!ad) ad = m.name || m.conductor || servis || '';
  const kat = katalogKalemi(cins, ad);
  const birim = m.unit === 'Kg' || m.unit === 'kg' ? (m.kgPer ? 'ad/kg' : 'kg/kg') : m.unit === 'm' ? (m.kgPer ? 'mt/kg' : 'mt/mt') : m.unit === 'm3' || m.unit === 'm³' ? 'm³/m³' : m.kgPer ? 'ad/kg' : 'ad/ad';
  const it = kat || { cins, tanim: ad, birim, katsayi: m.kgPer || 1, tarife: cinsTarifesi(cins, tanim.tarife || ESLESME.kategoriTarifeleri[tanim.voltaj || 'AG']) };
  const durum = isDurumu(m.jobOverride || job || 'montaj', pz ? pz.supply : null);
  const k = SH.kalemYap(it, { miktar: m.qty, durum, hakedis: hak, kaynak: 'MALZEME' });
  if (servis) k.servis = servis;
  if (m.origin && m.origin !== 'OTO') k.koken = m.origin;
  return k;
}

function hatTuruSec(l) {
  if (l.musterek && l.install !== 'yeralti' && l.lineType === 'AG') return Object.assign({ voltaj: 'AG' }, ESLESME.hatlar.MUSTEREK, { ciplak: 'AG_İLETKEN', demetli: 'ALPEK_KABLOLAR' });
  const key = (l.lineType || 'AG') + ':' + (l.install === 'yeralti' ? 'yeralti' : 'havai');
  const h = ESLESME.hatlar[key] || ESLESME.hatlar['AG:havai'];
  return Object.assign({ voltaj: l.lineType === 'OG' || l.lineType === 'ENH' ? 'OG' : l.lineType === 'AYD' ? 'AYD' : l.lineType === 'ABONE' ? 'ABONE' : 'AG' }, h);
}
function kanalKablolari(l) {
  const out = { OG: 0, AG: 0, AYD: 0, REK: 0 };
  const t = l.lineType || 'AG';
  if (t === 'OG' || t === 'ENH') out.OG = 1; else if (t === 'AYD') out.AYD = 1; else if (t === 'ABONE') out.REK = 1; else out.AG = 1;
  if (l.musterek) out.AG = 1;
  for (const c of l.circuits || []) { if (c.role === 'OG' || c.role === 'ENH') out.OG = 1; else if (c.role === 'AYD') out.AYD = 1; else if (c.role === 'ABONE') out.REK = 1; else out.AG = 1; }
  // AutoCAD'den gelen kanalın kablo kodu korunur (kanalda birden çok kablo türü olabilir)
  const kod = l.sebeke && l.sebeke.kanalKod ? +l.sebeke.kanalKod : 0;
  if (kod & 8) out.OG = 1; if (kod & 4) out.AG = 1; if (kod & 2) out.AYD = 1; if (kod & 1) out.REK = 1;
  return out;
}

/** Hattın iletken / kablo kalemleri. Havai çıplakta: tek kalem (3xSW) metre cinsinden, rapor tel tel açar. Demetli ve kabloda: metre, kg katsayısı bilinmiyorsa 1. */
function iletkenKalemleri(l, li, items, hatTuru, kesit, durum, hak, cat) {
  const out = [];
  const circuits = l.circuits || [];
  if (!circuits.length) return out;
  const yeralti = l.install === 'yeralti';
  for (const c of circuits) {
    const cp = circuitParts(c, cat);
    const ciplak = !yeralti && (c.custom || (cp && cp.unit === 'kg'));
    const label = c.custom ? cp.label : c.key;
    const n = c.count || 1;
    const ks = promagisKesit(label, l.lineType, l.install);
    const cins = yeralti ? hatTuru.kablo : ciplak ? hatTuru.ciplak : hatTuru.demetli;
    const parca = items.filter((x) => x.role === c.role && (x.conductor === c.key || x.conductor === label || (cp && cp.parts.some((p) => p.conductor === x.conductor))));
    // Metre: yeraltında tüm damarların toplamı (3(1x150/25) = 3 kablo), havai demetlide hattın boyu (pay dahil),
    // çıplakta hattın boyu (rapor tel tel açar). PROMAGIS gibi tam metreye yukarı yuvarlanır.
    let metre = 0, kg = 0;
    if (yeralti) { const x = parca[0]; metre = x ? x.meters / n : li.length2D; }
    else if (ciplak) { metre = li.length3D; for (const x of parca) kg += x.unit === 'Kg' ? x.qty : 0; }
    else { const x = parca[0]; metre = x ? x.meters / n : li.length3D; }
    metre = Math.ceil(metre - 1e-6);
    const kat = katalogKalemi(cins, ks.tanim);
    const kgM = ciplak && metre > 0 && kg > 0 ? kg / metre : 0;
    const it = kat || { cins, tanim: ks.tanim, birim: kgM ? 'mt/kg' : 'mt/mt', katsayi: kgM || 1, tarife: cinsTarifesi(cins, hatTuru.tarife) };
    // Katalogda mt/mt ise (rapor tel tel açar) telefonun kg'si katsayıya yazılmaz
    const k = SH.kalemYap(it, { miktar: metre * (n > 1 && !ciplak ? n : 1), durum, hakedis: hak, kaynak: 'HAT', aciklama: ks.aciklama || (n > 1 ? n + 'x(' + ks.tanim + ')' : undefined) });
    const yd = parca[0] ? parca[0].servis : null;
    if (yd) k.servis = yd;
    out.push(k);
  }
  return out;
}

// ---------------------------------------------------------------- AutoCAD (.sebeke.json) → Telefon

/** Dosya metnini / nesnesini okur: AutoCAD proje dosyası ya da telefonun tam proje dosyası (sebeke bölümü). */
export function voltProjeOku(girdi) {
  const k = typeof girdi === 'string' ? JSON.parse(String(girdi).replace(/^﻿/, '')) : girdi;
  if (k && typeof k.format === 'string' && k.format.startsWith('volt-project/')) {
    if (!k.sebeke) throw new Error('Bu telefon proje dosyasında AutoCAD bölümü yok (eski sürüm). Projeyi telefonda yeniden dışa aktarın.');
    return { proje: SH.projeOku(k.sebeke), volt: k };
  }
  return { proje: SH.projeOku(k), volt: null };
}

/** Durumdan telefon durumu. */
function voltDurumu(durum, trafo) { const d = ESLESME.durumlarTers[(durum || '').trim().toUpperCase()] || ESLESME.durumlarTers.MEVCUT; return trafo ? d.trafo : d.state; }

/** Direk cinsinden / tipinden telefon grubu ve tipi. */
export function direkEsle(cat, tur, cins, tip) {
  let grup = ESLESME.cinsGruplari[cins] || null;
  if (!grup) {
    const c = low(cins);
    grup = tur === 'AYD_DIREK' ? 'ayd' : tur === 'TRAFO_DIREGI' ? 'trafo' : tur === 'MUSTEREK_DIREK' ? 'mus' : tur === 'ENH_DIREK' ? (c.includes('beton') ? 'beton562' : c.includes('cvt') || c.includes('cıvata') ? 'civ' : 'bahh') : c.includes('beton') ? 'beton' : c.includes('ağaç') || c.includes('agac') ? 'agac' : 'sehir';
  }
  const adaylar = [voltTip(grup, tip), tip, 'G-' + tip, voltTip(grup, 'G-' + tip)];
  let t = null;
  for (const a of adaylar) { t = cat.poleTypeByName(grup, a); if (t) break; }
  if (!t) { const n = adNormal(tip); t = cat.poleTypes(grup).find((x) => adNormal(x.name) === n) || null; }
  return { grup, tip: t };
}

/** Telefon hat tipini (katalog adı) eklentinin ana kesitinden bulur. */
export function hatTipiEsle(cat, anaKesit, lineType, install) {
  const n = adNormal(anaKesit);
  if (!n) return null;
  const adaylar = cat.t.lineTypes;
  let lt = adaylar.find((x) => adNormal(x.name) === n);
  if (!lt) {
    // 3xSW → 3xSwallow, 3x1\0 → 3xRaven, 3X50/16+70 ALPEK → 3x50/16+70 AER, 1x150/25 Xlpe Alm. → 3x(1x150/25) NA2XSY
    const ters = Object.fromEntries(Object.entries(ESLESME.iletkenler).map(([ad, kisa]) => [adNormal(kisa), ad]));
    const m = /^(\d+)x(.+)$/.exec(n);
    if (m && ters[m[2]]) lt = adaylar.find((x) => adNormal(x.name) === adNormal(m[1] + 'x' + ters[m[2]]));
    if (!lt && install === 'yeralti') { const x = /^(1x[\d/.]+)xlpe/.exec(n); if (x) lt = adaylar.find((y) => adNormal(y.name).startsWith('3x(' + x[1] + ')')); }
    if (!lt && install === 'yeralti') { const x = /^([\d/.+x]+)nyy(cu|alm)?/.exec(n); if (x) lt = adaylar.find((y) => adNormal(y.name) === (x[2] === 'cu' ? 'nyy' : 'nayy') + x[1]) || adaylar.find((y) => adNormal(y.name) === 'nyy' + x[1]); }
  }
  if (lt) { const c = cat.conductor(lt.parts[0].conductor); const kind = c ? c.kind : null; if (install === 'yeralti' && kind !== 'KABLO') return null; }
  return lt || null;
}

/**
 * AutoCAD proje dosyasını telefon projesine alır. opts: { projectId (var olan proje), name, crs, dry }
 * Eşleştirme: telefon kaydının kimliği = dosyadaki telefonId ya da sebekeId; yoksa yeni kayıt.
 */
export async function sebekeIceAl(ps, proje, opts = {}) {
  const sp = proje.proje ? proje : SH.projeOku(proje);
  const ozet = { yeniEleman: 0, guncellenenEleman: 0, yeniHat: 0, guncellenenHat: 0, yeniKanal: 0, nokta: 0, uyarilar: [], eslesmeyen: [] };
  const pj = sp.proje || {};
  const dom = pj.koordinat && pj.koordinat.dom ? pj.koordinat.dom : 39;
  let project;
  if (opts.projectId) { project = await ps.open(opts.projectId); }
  else {
    project = await ps.createProject({ name: opts.name || pj.ad || 'AutoCAD projesi', code: pj.kod || '', crs: opts.crs || makeCrs({ datum: 'TUREF', projection: 'TM3', cm: dom }), autoRecipe: false, mode: 'asbuilt' });
    await ps.open(project.id);
  }
  const sebeke = Object.assign({}, project.sebeke || {}, { katmanOnEki: pj.katmanOnEki || (project.sebeke || {}).katmanOnEki || 'SC', gisOnEki: pj.gisOnEki || pj.katmanOnEki || 'SC', kaynak: pj.kaynak || '', dom, olusturan: sp.olusturan || '', bolgeler: (sp.bolgeler || []).map((b) => ({ id: b.id, ad: b.ad, kod: b.kod, grup: b.grup || '', aciklama: b.aciklama || '', sinir: b.sinir })), alinma: new Date().toISOString() });
  await ps.updateProject({ sebeke, autoRecipe: project.autoRecipe === true }, 'AutoCAD dosyası alındı');
  if (opts.dry) return ozet;

  const act = (a) => (a || []).filter((x) => x.status !== 'deleted');
  const eqs = act(ps.data.equipment), lines = act(ps.data.lines), pts = act(ps.data.points);
  const eqByKey = new Map();
  for (const e of eqs) { eqByKey.set(e.id, e); if (e.sebekeId) eqByKey.set(e.sebekeId, e); }
  const lineByKey = new Map();
  for (const l of lines) {
    lineByKey.set(l.id, l); if (l.sebekeId) lineByKey.set(l.sebekeId, l);
    for (const pc of (l.sebeke && l.sebeke.parcalar) || []) { if (pc && pc.id) lineByKey.set(pc.id, l); if (pc && pc.kanalId) lineByKey.set(pc.kanalId, l); }
  }
  const pointByKey = new Map();
  for (const p of pts) { pointByKey.set(p.id, p); if (p.sebekeId) pointByKey.set(p.sebekeId, p); }
  const bul = (map, o) => (o.telefonId && map.get(o.telefonId)) || map.get(o.id) || null;

  // Elemanlar
  const noktaIdByEleman = new Map();   // eklenti eleman kimliği → telefon nokta kimliği (hat uçları için)
  for (const el of sp.elemanlar || []) {
    const et = ESLESME.elemanTurleri[el.tur] || ESLESME.elemanTurleri.DIGER;
    const trafo = et.kind === 'transformer';
    const state = voltDurumu(el.durum, trafo);
    const data = { state, note: el.not || undefined, sebekeId: el.id, sebeke: { id: el.id, tur: el.tur, cins: el.cins, tip: el.tip, durum: el.durum, aci: el.aci, katman: el.katman, blok: el.blok, hakedis: el.hakedis, bolge: el.bolge, anaKalem: (el.kalemler || []).find((k) => k.ana) || null } };
    const anaKalem = (el.kalemler || []).find((k) => k.ana);
    const attrs = {};
    if (et.kind === 'pole' || et.kind === 'lighting') {
      const d = direkEsle(ps.cat, el.tur, el.cins, el.tip);
      data.group = d.grup;
      if (d.tip) data.typeId = d.tip.id; else { attrs.typeName = el.tip; ozet.eslesmeyen.push(el.gisId + ': direk tipi katalogda yok (' + el.cins + ' ' + el.tip + ')'); }
    } else if (trafo) {
      attrs.post = el.tur === 'TRAFO_DIREGI' ? 'direk' : /BİNA|BINA/i.test(el.cins) ? et.binaPost : et.post;
      if (el.guc) attrs.kva = parseFloat(String(el.guc).replace(',', '.')) || undefined;
      if (el.tur === 'TRAFO_DIREGI') { const d = direkEsle(ps.cat, 'TRAFO_DIREGI', el.cins, el.tip); if (d.tip) attrs.poleTypeId = d.tip.id; else if (el.tip) attrs.typeName = el.tip; }
      else if (el.tip) attrs.govde = el.tip;
      if (anaKalem && anaKalem.dmDurum) attrs.dmDurum = anaKalem.dmDurum;
    } else {
      if (el.tip) attrs.typeName = el.tip;
      if (et.kind === 'sdk') { const t = ps.cat.sdkTypes().find((x) => adNormal(x.name) === adNormal(el.tip)); if (t) attrs.sdkTypeId = t.id; }
      attrs.cins = el.cins;
    }
    if (Object.keys(attrs).length) data.attrs = attrs;
    const mevcut = bul(eqByKey, el);
    let rec;
    if (mevcut) {
      const p = ps.pointById(mevcut.pointId);
      if (p && (Math.abs(p.E - el.saga) > 0.0005 || Math.abs(p.N - el.yukari) > 0.0005)) await ps.movePoint(p.id, el.saga, el.yukari, 'AutoCAD dosyasından güncellendi');
      rec = await ps.updateEquipment(mevcut.id, Object.assign(data, { no: el.gisId || mevcut.no }), 'AutoCAD dosyasından güncellendi');
      ozet.guncellenenEleman++;
    } else {
      rec = await ps.addEquipment(et.kind, Object.assign(data, { no: el.gisId || undefined }), { coord: { E: el.saga, N: el.yukari, H: el.kot || null }, source: 'DESIGN', defer: true, reason: 'AutoCAD dosyasından alındı' });
      ozet.yeniEleman++;
    }
    noktaIdByEleman.set(el.id, rec.pointId);
    if (el.telefonId) noktaIdByEleman.set(el.telefonId, rec.pointId);
    // Telefonun kendisinin ürettiği kalemler (trafo gücünden trafo kalemi) malzeme olarak ayrıca yazılmaz
    const telefonUretir = (k) => trafo && attrs.kva && /^TRAFO/.test(k.cins || '') && !/B[İI]NA/.test(k.cins || '');
    await malzemeleriYaz(ps, 'equipment', rec.id, (el.kalemler || []).filter((k) => !k.ana && !telefonUretir(k)), opts);
  }

  // Hatlar
  const koseNokta = async (xy, cls) => {
    // Yakın ekipman noktası (1 m) varsa o; yoksa yeni hat köşe noktası
    let enYakin = null, enKisa = 1.0;
    for (const p of ps.data.points) { if (p.status === 'deleted' || p.E == null) continue; const d = Math.hypot(p.E - xy[0], p.N - xy[1]); if (d < enKisa) { enKisa = d; enYakin = p; } }
    if (enYakin) return enYakin.id;
    const p = await ps.createPoint({ pointNo: ps.nextPointNo('P'), cls: cls || 'HAT', critical: false, coord: { E: xy[0], N: xy[1] }, source: 'DESIGN' });
    return p.id;
  };
  const kanalIndeks = new Map((sp.kanallar || []).map((c) => [koseAnahtari(c.kose), c]));
  // Noktadaki eleman (parça uçları için): telefon nokta kimliği → dosyadaki eleman kimliği
  const noktaninElemani = new Map();
  for (const el of sp.elemanlar || []) { const pid = noktaIdByEleman.get(el.id); if (pid && !noktaninElemani.has(pid)) noktaninElemani.set(pid, el.id); }
  const ucElemani = async (xy) => noktaninElemani.get(await koseNokta(xy, 'HAT')) || '';
  // AutoCAD'de direkten direğe parça parça duran hatlar telefonda tek hat olur (parça kimlikleri saklanır, geri yazımda aynen döner)
  for (const grup of parcalariBirlestir(sp.hatlar || [], hatAyniMi)) {
    const parcalar = grup.parcalar;
    const h0 = parcalar[0], hN = parcalar[parcalar.length - 1];
    const temel = parcaKimligi(h0.id);
    const h = Object.assign({}, h0, {
      id: parcalar.length > 1 && temel ? temel.temel : h0.id, kose: grup.kose, kalemler: kalemleriBirlestir(parcalar),
      cizimUzunlugu: parcalar.reduce((a, x) => a + (+x.cizimUzunlugu || SH.uzunluk(x.kose) || 0), 0),
      uclar: [grup.ters0 ? (h0.uclar || [])[1] : (h0.uclar || [])[0], grup.tersN ? (hN.uclar || [])[0] : (hN.uclar || [])[1]],
      telefonId: parcalar.map((x) => x.telefonId).find(Boolean) || undefined
    });
    const ht = ESLESME.hatTurleriTers[h.tur] || ESLESME.hatTurleriTers.AG_HAVAI;
    const lt = hatTipiEsle(ps.cat, h.anaKesit, ht.lineType, ht.install);
    const nodes = [];
    for (let i = 0; i < h.kose.length; i++) {
      const uc = h.uclar && (i === 0 ? h.uclar[0] : i === h.kose.length - 1 ? h.uclar[1] : null);
      const pid = (uc && noktaIdByEleman.get(uc)) || await koseNokta(h.kose[i], 'HAT');
      if (!nodes.length || nodes[nodes.length - 1] !== pid) nodes.push(pid);
    }
    // Parça kimlikleri ve uçları (geri yazımda aynı parçalara aynı kimlik)
    const parcaKayitlari = [];
    const kanallar = [];
    for (const pc of parcalar) {
      const kayit = { id: pc.id, uclar: [await ucElemani(pc.kose[0]), await ucElemani(pc.kose[pc.kose.length - 1])] };
      const kn = kanalIndeks.get(koseAnahtari(pc.kose)) || null;
      if (kn) { kayit.kanalId = kn.id; kanallar.push(kn); kanalIndeks.delete(koseAnahtari(pc.kose)); }
      parcaKayitlari.push(kayit);
    }
    const kanal = kanallar.length ? Object.assign({}, kanallar[0], { cizimUzunlugu: kanallar.reduce((a, x) => a + (+x.cizimUzunlugu || SH.uzunluk(x.kose) || 0), 0), kalemler: [].concat(...kanallar.map((x) => x.kalemler || [])) }) : null;
    const data = {
      lineType: ht.lineType, install: ht.install, musterek: !!ht.musterek, state: voltDurumu(h.durum), nodes, name: lt ? '' : h.anaKesit,
      circuits: lt ? [{ role: ht.lineType === 'ABONE' ? 'ABONE' : ht.lineType, key: lt.name, count: 1 }] : [],
      sebekeId: h.id, note: h.not || undefined,
      sebeke: { id: h.id, tur: h.tur, anaKesit: h.anaKesit, durum: h.durum, etiket: h.etiket, katman: h.katman, hakedis: h.hakedis, bolge: h.bolge, kalemler: lt ? undefined : h.kalemler, parcalar: parcalar.length > 1 ? parcaKayitlari : undefined }
    };
    let boruKalemi = null;
    if (kanal) { const ka = kanalAyari(kanal, h); data.cable = ka.cable; boruKalemi = ka.boru; data.sebeke.kanalId = parcalar.length > 1 ? undefined : kanal.id; data.sebeke.kanalKod = kanal.kod; }
    if (!lt && h.anaKesit) ozet.eslesmeyen.push((h.etiket || h.anaKesit) + ': hat tipi katalogda yok, metraj eklentideki kalemlerle korunur');
    const mevcut = bul(lineByKey, h) || parcalar.map((x) => lineByKey.get(x.id)).find(Boolean) || null;
    let rec;
    if (mevcut) { rec = await ps.updateLine(mevcut.id, data, 'AutoCAD dosyasından güncellendi'); ozet.guncellenenHat++; }
    else { rec = await ps.createLine(Object.assign({ lineNo: ps.nextLineNo() }, data), { defer: true, reason: 'AutoCAD dosyasından alındı' }); ozet.yeniHat++; }
    // Boru kalemi kanal ayarına (borulu geçiş, boru sayısı) çevrildi; malzeme olarak ayrıca yazılmaz (telefon kendisi hesaplar)
    const boruMu = (k) => boruKalemi && k.cins === boruKalemi.cins && k.tanim === boruKalemi.tanim && k.kaynak !== 'HAT';
    await malzemeleriYaz(ps, 'line', rec.id, (h.kalemler || []).filter((k) => !k.ana && k.kaynak !== 'HAT' && !boruMu(k)), opts);
  }
  // Hattı olmayan kanallar ve sondajlar: kablosuz kanal / kazı hattı (parçalar birleştirilir)
  for (const grup of parcalariBirlestir([...kanalIndeks.values()], kanalAyniMi)) {
    const c0 = grup.parcalar[0];
    const temel = parcaKimligi(c0.id);
    const c = Object.assign({}, c0, { id: grup.parcalar.length > 1 && temel ? temel.temel : c0.id, kose: grup.kose, kalemler: kalemleriBirlestir(grup.parcalar), cizimUzunlugu: grup.parcalar.reduce((a, x) => a + (+x.cizimUzunlugu || SH.uzunluk(x.kose) || 0), 0) });
    const nodes = []; for (const xy of c.kose) { const pid = await koseNokta(xy, 'HAT'); if (!nodes.length || nodes[nodes.length - 1] !== pid) nodes.push(pid); }
    const parcaKayitlari = grup.parcalar.length > 1 ? grup.parcalar.map((x) => ({ kanalId: x.id, uclar: [] })) : undefined;
    if (parcaKayitlari) for (let i = 0; i < grup.parcalar.length; i++) { const x = grup.parcalar[i]; parcaKayitlari[i].uclar = [await ucElemani(x.kose[0]), await ucElemani(x.kose[x.kose.length - 1])]; }
    const data = { lineType: c.kod & 8 ? 'OG' : c.kod & 4 ? 'AG' : c.kod & 2 ? 'AYD' : 'ABONE', install: 'yeralti', channelOnly: true, circuits: [], nodes, state: voltDurumu(c.durum), cable: kanalAyari(c, null).cable, sebekeId: c.id, sebeke: { id: c.id, kanal: true, kanalId: c.id, kanalKod: c.kod, zemin: c.zemin, hakedis: c.hakedis, bolge: c.bolge, parcalar: parcaKayitlari } };
    const mevcut = bul(lineByKey, c) || grup.parcalar.map((x) => lineByKey.get(x.id)).find(Boolean) || null;
    if (mevcut) await ps.updateLine(mevcut.id, data, 'AutoCAD dosyasından güncellendi'); else await ps.createLine(Object.assign({ lineNo: ps.nextLineNo() }, data), { defer: true, reason: 'AutoCAD dosyasından alındı (kanal)' });
    ozet.yeniKanal++;
  }
  for (const grup of parcalariBirlestir(sp.sondajlar || [], sondajAyniMi)) {
    const s0 = grup.parcalar[0];
    const temel = parcaKimligi(s0.id);
    const s = Object.assign({}, s0, { id: grup.parcalar.length > 1 && temel ? temel.temel : s0.id, kose: grup.kose });
    const nodes = []; for (const xy of s.kose) { const pid = await koseNokta(xy, 'HAT'); if (!nodes.length || nodes[nodes.length - 1] !== pid) nodes.push(pid); }
    const parcaKayitlari = grup.parcalar.length > 1 ? grup.parcalar.map((x) => ({ kanalId: x.id, uclar: [] })) : undefined;
    if (parcaKayitlari) for (let i = 0; i < grup.parcalar.length; i++) { const x = grup.parcalar[i]; parcaKayitlari[i].uclar = [await ucElemani(x.kose[0]), await ucElemani(x.kose[x.kose.length - 1])]; }
    const cap = /Ø\s*(\d+)/.exec(s.tip || '');
    const data = { lineType: 'OG', install: 'yeralti', channelOnly: true, circuits: [], nodes, state: voltDurumu(s.durum), cable: { surface: 'toprak', method: 'sondaj', width: 0, depth: 0, pipeDia: cap ? +cap[1] : 110, pipeCount: 1 }, sebekeId: s.id, sebeke: { id: s.id, sondaj: true, tip: s.tip, hakedis: s.hakedis, bolge: s.bolge, parcalar: parcaKayitlari } };
    const mevcut = bul(lineByKey, s) || grup.parcalar.map((x) => lineByKey.get(x.id)).find(Boolean) || null;
    if (mevcut) await ps.updateLine(mevcut.id, data, 'AutoCAD dosyasından güncellendi'); else await ps.createLine(Object.assign({ lineNo: ps.nextLineNo() }, data), { defer: true, reason: 'AutoCAD dosyasından alındı (sondaj)' });
    ozet.yeniKanal++;
  }
  // Ölçü noktaları
  for (const n of sp.noktalar || []) {
    const mevcut = bul(pointByKey, n);
    if (mevcut) continue;
    await ps.createPoint({ pointNo: n.ad || ps.nextPointNo('P'), cls: n.kod && /^[A-ZÇĞİÖŞÜ]+$/.test(n.kod) && n.kod.length <= 8 ? 'DETAY' : 'DETAY', critical: false, coord: { E: n.saga, N: n.yukari, H: n.kot || null }, source: 'DESIGN', note: n.kod ? 'Kod: ' + n.kod : '' });
    const p = ps.data.points[ps.data.points.length - 1];
    if (p) await ps.ds.update('points', p.id, { sebekeId: n.id }, { reason: 'AutoCAD nokta kimliği', silent: true });
    ozet.nokta++;
  }
  await ps.reload('points'); await ps.reload('equipment'); await ps.reload('lines'); await ps.reload('materials');
  await ps.recompute('AutoCAD dosyası alındı');
  ozet.uyarilar.push(...(sp.uyarilar || []));
  ozet.projectId = ps.p.id;
  return ozet;
}

function koseAnahtari(kose) { return (kose || []).map((q) => Math.round(q[0] * 100) + ',' + Math.round(q[1] * 100)).join(';'); }
const ucAnahtari = (q) => Math.round(q[0] * 100) + ',' + Math.round(q[1] * 100);
/** "<kimlik>#<n>" biçimindeki parça kimliği → { temel, n }; değilse null. */
export function parcaKimligi(id) { const m = /^(.+)#(\d+)$/.exec(String(id || '')); return m ? { temel: m[1], n: +m[2] } : null; }
const hatAyniMi = (a, b) => a.tur === b.tur && adNormal(a.anaKesit) === adNormal(b.anaKesit) && (a.durum || '') === (b.durum || '') && (a.hakedis || 0) === (b.hakedis || 0) && (a.katman || '') === (b.katman || '');
const kanalAyniMi = (a, b) => a.kod === b.kod && (a.zemin || '') === (b.zemin || '') && (a.durum || '') === (b.durum || '') && (a.hakedis || 0) === (b.hakedis || 0) && +a.altGenislik === +b.altGenislik && +a.ustGenislik === +b.ustGenislik && +a.derinlik === +b.derinlik;
const sondajAyniMi = (a, b) => (a.tip || '') === (b.tip || '') && (a.durum || '') === (b.durum || '') && (a.hakedis || 0) === (b.hakedis || 0);
/**
 * Parça parça duran nesneleri (hat, kanal, sondaj) tek güzergâha birleştirir. Önce "<kimlik>#n" parçaları sırayla
 * (telefonun kendi böldüğü hat); sonra uç uca değen, aynı nitelikte (ayniMi) ve o uçta başka bağlantısı olmayan
 * parçalar zincir olur (bilgisayarda direkten direğe çizilen hatlar). Üçlü kavşaklar ve nitelik değişimleri zinciri
 * böler. Döner: [{ parcalar: [nesne…] (güzergâh sırasıyla), kose, ters0, tersN }]
 */
export function parcalariBirlestir(nesneler, ayniMi) {
  const gecerli = (nesneler || []).filter((o) => Array.isArray(o.kose) && o.kose.length >= 2);
  const gruplar = new Map(), tekler = [];
  for (const o of gecerli) { const pk = parcaKimligi(o.id); if (pk) { if (!gruplar.has(pk.temel)) gruplar.set(pk.temel, []); gruplar.get(pk.temel).push({ o, n: pk.n }); } else tekler.push(o); }
  const birimler = [];
  for (const [, g] of gruplar) {
    g.sort((a, b) => a.n - b.n);
    let cur = null;
    for (const { o } of g) {
      if (cur && ucAnahtari(cur.kose[cur.kose.length - 1]) === ucAnahtari(o.kose[0]) && ayniMi(cur.parcalar[0], o)) { cur.parcalar.push(o); cur.kose.push(...o.kose.slice(1)); }
      else { cur = { parcalar: [o], kose: o.kose.slice() }; birimler.push(cur); }
    }
  }
  for (const o of tekler) birimler.push({ parcalar: [o], kose: o.kose.slice() });
  const ucta = new Map();
  const ekle = (k, b) => { if (!ucta.has(k)) ucta.set(k, []); ucta.get(k).push(b); };
  for (const b of birimler) { ekle(ucAnahtari(b.kose[0]), b); ekle(ucAnahtari(b.kose[b.kose.length - 1]), b); }
  const kullanildi = new Set();
  const komsu = (b, k) => {
    const l = ucta.get(k) || [];
    if (l.length !== 2) return null;
    const d = l[0] === b ? l[1] : l[0];
    return d === b || kullanildi.has(d) || !ayniMi(b.parcalar[0], d.parcalar[0]) ? null : d;
  };
  const sonuc = [];
  for (const b of birimler) {
    if (kullanildi.has(b)) continue;
    kullanildi.add(b);
    const parcalar = b.parcalar.slice(), kose = b.kose.slice();
    let ters0 = false, tersN = false;
    // ileri: bitiş ucundan devam eden komşular
    for (let cur = b, k = ucAnahtari(kose[kose.length - 1]); ;) {
      const d = komsu(cur, k);
      if (!d) break;
      kullanildi.add(d);
      const duz = ucAnahtari(d.kose[0]) === k;
      parcalar.push(...(duz ? d.parcalar : d.parcalar.slice().reverse()));
      kose.push(...(duz ? d.kose.slice(1) : d.kose.slice().reverse().slice(1)));
      tersN = !duz;
      cur = d; k = ucAnahtari(kose[kose.length - 1]);
    }
    // geri: başlangıç ucundan devam eden komşular
    for (let cur = b, k = ucAnahtari(kose[0]); ;) {
      const d = komsu(cur, k);
      if (!d) break;
      kullanildi.add(d);
      const duz = ucAnahtari(d.kose[d.kose.length - 1]) === k;
      parcalar.unshift(...(duz ? d.parcalar : d.parcalar.slice().reverse()));
      kose.unshift(...(duz ? d.kose.slice(0, -1) : d.kose.slice().reverse().slice(0, -1)));
      ters0 = !duz;
      cur = d; k = ucAnahtari(kose[0]);
    }
    sonuc.push({ parcalar, kose, ters0, tersN });
  }
  return sonuc;
}
/** Parçaların kalemleri: hat (HAT) ve ana kalemler aynı cins/tanım/durumda toplanır, malzemeler art arda eklenir. */
export function kalemleriBirlestir(parcalar) {
  if (parcalar.length === 1) return (parcalar[0].kalemler || []).slice();
  const out = [], toplananlar = new Map();
  for (const p of parcalar) for (const k of p.kalemler || []) {
    if (k.kaynak === 'HAT' || k.ana) {
      const anahtar = [k.kaynak, k.cins, k.tanim, k.aciklama || '', k.durum, k.hakedis].join('|');
      const t = toplananlar.get(anahtar);
      if (t) { t.miktar = r3(t.miktar + (+k.miktar || 0)); t.toplam = r3(t.toplam + (+k.toplam || 0)); continue; }
      const kopya = Object.assign({}, k, { miktar: +k.miktar || 0, toplam: +k.toplam || 0 });
      toplananlar.set(anahtar, kopya); out.push(kopya);
    } else out.push(Object.assign({}, k));
  }
  return out;
}
/** Kanal nesnesinden telefonun kanal ayarı; boru kalemi kanalda ya da aynı güzergâhtaki hatta aranır. */
function kanalAyari(c, hat) {
  const surface = ESLESME.zeminlerTers[(c.zemin || '').toUpperCase()] || 'toprak';
  const boruMu = (k) => /boru/i.test(k.tanim || '') || /BORU/i.test(k.cins || '');
  const boru = (c.kalemler || []).find(boruMu) || ((hat && hat.kalemler) || []).find((k) => !k.ana && k.kaynak !== 'HAT' && boruMu(k)) || null;
  const cap = boru ? /Ø\s*(\d+)/.exec(boru.tanim || '') : null;
  const uzunluk = Math.max(1, c.cizimUzunlugu || SH.uzunluk(c.kose) || 1);
  return { cable: { surface, method: boru ? 'borulu' : 'acik', width: r3(((+c.altGenislik || 0) + (+c.ustGenislik || 0)) / 2 / 100), depth: r3((+c.derinlik || 0) / 100), pipeDia: cap ? +cap[1] : 110, pipeCount: boru ? Math.max(1, Math.round((+boru.miktar || 0) / uzunluk)) : 0 }, boru };
}

/**
 * Eklentideki malzeme kalemlerini telefonun malzeme tablosuna yazar. Telefon kataloğunda eşi olmayan kalem için
 * kataloğa "AUTOCAD:…" kodlu bir kalem açılır (Poz Kataloğu ekranında DOĞRULANACAK görünür, ad / poz no düzeltilebilir);
 * PROMAGIS alanları (cins, tanım, birim, katsayı, tarife) kalemde saklanır ve dışa aktarımda aynen döner.
 */
async function malzemeleriYaz(ps, ownerType, ownerId, kalemler, opts) {
  const eski = (ps.data.materials || []).filter((x) => x.ownerId === ownerId && x.status !== 'deleted' && x.sebeke);
  for (const x of eski) await ps.ds.remove('materials', x.id, { reason: 'AutoCAD dosyasından yenilendi', silent: true });
  for (const k of kalemler) {
    const servis = k.servis && ps.cat.poz(k.servis) ? k.servis : pozBul(ps.cat, k) || await autocadPozu(ps, k);
    const pz = ps.cat.poz(servis);
    await ps.ds.create('materials', {
      projectId: ps.p.id, ownerId, ownerType, servis, qty: +k.miktar || 0, unit: pz ? pz.unit : birimVolt(k.birim),
      origin: 'MANUEL', reason: 'AutoCAD dosyasından', approved: true, grp: pz ? pz.kgGroup || '' : '', name: k.tanim,
      sebeke: { cins: k.cins, tanim: k.tanim, birim: k.birim, katsayi: k.katsayi, tarife: k.tarife, durum: k.durum, aciklama: k.aciklama, sira: k.sira }
    }, { reason: 'AutoCAD malzemesi: ' + k.tanim, silent: true });
  }
  if (kalemler.length || eski.length) await ps.reload('materials');
}
/** PROMAGIS birimi → telefon birimi (giriş birimi). */
function birimVolt(birim) { const g = SH.birimler(birim)[0]; return g === 'mt' ? 'm' : g === 'kg' ? 'Kg' : g === 'm³' || g === 'm3' ? 'm3' : 'Ad'; }
/** Telefon kataloğunda AutoCAD kalemi: AUTOCAD:<CİNS>-<TANIM> (aynı kalem ikinci kez açılmaz). */
async function autocadPozu(ps, k) {
  const kod = ('AUTOCAD:' + (k.cins + '-' + k.tanim).toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ.,+/()-]+/g, '-').replace(/^-|-$/g, '')).slice(0, 64);
  const var_ = ps.cat.poz(kod);
  if (var_) return kod;
  const [, rapor] = SH.birimler(k.birim);
  const row = {
    id: ps.cat.stdId + ':' + kod, stdId: ps.cat.stdId, servis: kod, pozNo: null, name: k.tanim + ' (' + k.cins + ')', unit: birimVolt(k.birim),
    kgPerUnit: rapor === 'kg' && +k.katsayi > 0 ? +k.katsayi : null, supply: k.durum === 'M+M' ? 'Y' : 'Ş', montaj: true, demontaj: true, dmm: true, kgGroup: '',
    category: 'AutoCAD', bfPoz: null, priceMaterial: null, priceLabor: null, priceUnit: null, inGreenBook: false, validFrom: ps.cat.std.validFrom, validTo: ps.cat.std.validTo,
    source: 'AutoCAD dosyasından (PROMAGIS kalemi)', verified: false, isKgGroup: false, userAdded: true,
    sebeke: { cins: k.cins, tanim: k.tanim, birim: k.birim, katsayi: k.katsayi, tarife: k.tarife }
  };
  const saved = await ps.ds.putStd('poz', row, 'AutoCAD kalemi kataloğa eklendi: ' + k.tanim);
  ps.cat.upsertPoz(saved);
  return kod;
}
/** Kalem için telefon pozu: önce eşleme tablosu (ters), sonra ad benzerliği. */
function pozBul(cat, k) {
  for (const [servis, e] of Object.entries(ESLESME.kalemler)) if (e && typeof e === 'object' && e.cins === k.cins && e.tanim === k.tanim) return servis;
  const n = adNormal(k.tanim);
  if (!n) return null;
  const p = cat.t.poz.find((x) => adNormal(x.name) === n);
  return p ? p.servis : null;
}

// ---------------------------------------------------------------- Telefonun tam proje dosyası (volt-project/3)

/** Telefonun tam proje dosyası: ham veri + türetilmiş sonuçlar + AutoCAD için hazır 'sebeke' bölümü. */
export function voltProjeYaz(ps, opts = {}) {
  const full = { format: VOLT_BICIM, exportedAt: new Date().toISOString(), app: 'VOLT-EDAŞ Saha', standard: ps.cat.std, project: ps.p, data: {} };
  for (const s of ['points', 'equipment', 'lines', 'materials', 'photos', 'periods', 'workPrograms', 'stakeouts', 'revisions', 'surveySessions', 'gnssObservations', 'documents']) full.data[s] = ps.data[s] || [];
  full.derived = { spans: ps.result.spans, quantities: ps.result.quantities, issues: ps.result.issues, signature: ps.result.signature };
  full.sebeke = JSON.parse(sebekeYaz(ps, opts));
  return full;
}

export { SH };
