// AutoCAD eklentisiyle dosya uyumu: telefon projesi ↔ .sebeke.json (ortak/VERI-MODELI.md).
//
//   sebekeYaz(ps)        açık projeyi AutoCAD proje dosyasına çevirir (eklentideki "Telefondan Al" bunu okur)
//   sebekeIceAl(ps, …)   AutoCAD proje dosyasını telefon projesine alır (eklentideki "Telefona Gönder" dosyası)
//   voltProjeYaz(ps)     telefonun tam proje dosyası (volt-project/3): ham veri + AutoCAD için hazır 'sebeke' bölümü
//   voltProjeOku(metin)  her iki biçimi tanır, AutoCAD proje nesnesini döndürür
//
// Eşleme tabloları ortak/katalog/volt-eslesme.json'dadır (telefon kopyası: src/ortak/volt-eslesme.js). AutoCAD
// kurallarının JavaScript karşılığı sh-core.cjs'dir (etiket, kanal kodu, bölge seçimi, proje dosyası yazımı, rapor).
import { hesapKayitlari } from '../hesap/kayitlar.js';
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
/** AutoCAD kalem kataloğu (ortak/katalog/kalemler.json): cins|tanım → kalem. */
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

/** Telefon durumu → çizim durumu; YENI'de tedarik: Y → M+M, Ş → M. null: dosyaya yazılmaz (ileride). */
export function cizimDurumu(state, supply) {
  const d = ESLESME.durumlar[state];
  if (d === undefined) return 'MEVCUT';
  if (d === 'M' && supply && ESLESME.tedarik[supply]) return ESLESME.tedarik[supply];
  return d;
}
/** İş türü (montaj / demontaj / dmm) → çizim durumu. */
const isDurumu = (job, supply) => (job === 'montaj' ? (supply && ESLESME.tedarik[supply]) || 'M' : ESLESME.isler[job] || 'M');
/**
 * Kaydın çizim durumu: AutoCAD'den gelen ya da kullanıcının seçtiği özgün kod (sebeke.durum) telefondaki durumla
 * hâlâ uyuşuyorsa aynen döner (KM, ENH, ME ve M / M+M ayrımı korunur); yoksa telefon durumundan üretilir.
 */
export function korunanDurum(sb, state, trafo, supply) {
  const d = sb && sb.durum ? String(sb.durum).trim().toUpperCase() : '';
  if (d && ESLESME.durumlarTers[d] && voltDurumu(d, trafo) === state) return d;
  return cizimDurumu(state, supply);
}
/** Telefon durumuna uyan AutoCAD kodları (seçim listesi için): [[kod, ad], …]. */
export function durumSecenekleri(state, trafo) {
  return Object.keys(ESLESME.durumlarTers).filter((k) => k !== 'aciklama' && voltDurumu(k, trafo) === state).map((k) => [k, k + ' · ' + (ESLESME.durumAdlari[k] || k)]);
}

/** Direk tipi adı: telefon → AutoCAD yazımı (beton 9.3/8 → 9,3/8; GD-10 (3 AWG) → G-D-10 (sw)). */
export function cizimTip(grup, ad) {
  const s = String(ad || '').trim();
  if (grup === 'beton' || grup === 'beton562') return s.replace(/\./g, ',');
  if (grup === 'bahh') { const m = /^G([A-Z]{1,2})-(\d+)\s*\((3 AWG|1\/0)\)$/i.exec(s); if (m) return 'G-' + m[1].toUpperCase() + '-' + m[2] + ' (' + (m[3].toUpperCase() === '3 AWG' ? 'sw' : '1/0') + ')'; }
  if (grup === 'trafo') { const m = /^G-?T-?(\d+)$/i.exec(s); if (m) return 'G-T-' + m[1]; }
  if (grup === 'mus') return s.replace(/''/g, '"'); // müşterek: katalogda G-10I'' , eski program çiziminde G-10I"
  return s;
}
/** Direk tipi adı: AutoCAD → telefon yazımı. */
export function voltTip(grup, ad) {
  const s = String(ad || '').trim();
  if (grup === 'mus') return s.replace(/"/g, "''");
  if (grup === 'beton' || grup === 'beton562') return s.replace(/,/g, '.');
  if (grup === 'bahh') { const m = /^G-([A-Z]{1,2})-(\d+)\s*\((sw|1\/0)\)$/i.exec(s); if (m) return 'G' + m[1].toUpperCase() + '-' + m[2] + ' (' + (m[3].toLowerCase() === 'sw' ? '3 AWG' : '1/0') + ')'; }
  if (grup === 'trafo') { const m = /^G-T-(\d+)$/i.exec(s); if (m) return 'G-T' + m[1]; }
  return s;
}
/** Çıplak OG iletkeni / hat etiketi: 3xSwallow → 3xSW, 3x(1x240/25) NA2XSY → 1x240/25 Xlpe Alm. vb. */
export function cizimKesit(label, lineType, install) {
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
  sp.olusturan = 'Şebeke-M (telefon)';
  sp.proje.kaynak = sb.kaynak || 'telefon';
  sp.proje.koordinat.datum = datum;
  sp.proje.kod = project.code || '';
  const onaylar = onaylariHazirla(sb.onaylar, data.periods);
  if (onaylar.length) sp.proje.onaylar = onaylar;
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
    const durum = korunanDurum(e.sebeke, e.state, e.kind === 'transformer', tanim.tedarik);
    if (durum === null) { uyarilar.push(e.no + ': "ileride" durumundaki obje AutoCAD dosyasına yazılmaz'); continue; }
    const hak = hakedisi(e);
    const bolge = bolgeIdi(p.E, p.N);
    const el = {
      id: (e.sebeke && e.sebeke.id) || e.sebekeId || e.id, tur: tanim.tur, gisId: e.no || '', cins: tanim.cins, tip: tanim.tip, durum, hakedis: hak, bolge,
      saga: r4(p.E), yukari: r4(p.N), kot: p.H != null ? r4(p.H) : 0, aci: (e.sebeke && e.sebeke.aci) || 0,
      guc: tanim.guc || '', gerilim: tanim.gerilim || '', kontrol: null, katman: (e.sebeke && e.sebeke.katman) || '', blok: (e.sebeke && e.sebeke.blok) || '',
      kalemler: [], telefonId: e.id, olcum: olcumBilgisi(p), not: e.note || undefined
    };
    if (e.sebekeId && e.sebekeId !== e.id) el.id = e.sebekeId;
    // AutoCAD'in telefonda düzenlenmeyen verisi (pano çıkış şeması ANA/CON, hücreler FIDER) aynen geri gider
    if (e.sebeke && e.sebeke.ekVeri && Object.keys(e.sebeke.ekVeri).length) el.ekVeri = JSON.parse(JSON.stringify(e.sebeke.ekVeri));
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
    kalemBilgisiUygula(el.kalemler, kayitliBilgi(e.sebeke, el.id));
    sp.elemanlar.push(el);
  }

  // Hatlar, kanallar, sondajlar — parçalı (node-to-node): hat her bağlantı düğümünde (ekipmanı olan nokta) biter ve
  // yeniden başlar; her parça AutoCAD'de ayrı bir hat nesnesidir, metrajı ve etiketi kendine aittir. Ekipmansız
  // köşe noktaları parçanın içinde kalır. Parçaların toplamı hattın toplamına eşittir.
  for (const l of lines) {
    const li = result.lineInfo.get(l.id) || { items: [], length2D: 0, length3D: 0, cable: null };
    const coords = (l.nodes || []).map((id) => pts.get(id)).filter((p) => p && p.E != null);
    if (coords.length < 2) { uyarilar.push(l.lineNo + ': iki noktası yok, dosyaya yazılmadı'); continue; }
    const hak = hakedisi(l);
    const hatTuru = hatTuruSec(l);
    const iletkenler = li.items.filter((x) => !x.kanal && !x.material && !x.manual && (x.conductor || x.role));
    const tedarik = tedarikOf(cat, iletkenler.length ? iletkenler[0].servis : null);
    const durum = korunanDurum(l.sebeke, l.state, false, tedarik);
    if (durum === null) { uyarilar.push(l.lineNo + ': "ileride" durumundaki hat AutoCAD dosyasına yazılmaz'); continue; }
    const km = l.install === 'yeralti' ? kanalModel(l.cable) : null;
    const kablolu = !(l.channelOnly && !(l.circuits || []).length);
    const sb = l.sebeke || {};
    const parcalar = hatParcalari(coords, eqByPoint);
    const toplam2D = parcalar.reduce((a, pc) => a + parcaUzunlugu(pc), 0) || 1;
    // Hattın tamamı için kalemler; parçalara uzunluk payıyla bölünür (son parça kalanı alır → toplam değişmez)
    let hatKalemleri = [], manuel = [];
    const etiketTam = sb.anaKesit && !(l.circuits || []).length ? sb.anaKesit : lineLabel(l, cat);
    const kesit = cizimKesit(etiketTam, l.lineType, l.install);
    if (kablolu) {
      hatKalemleri = iletkenKalemleri(l, li, iletkenler, hatTuru, kesit, durum, hak, cat);
      if (!hatKalemleri.length && Array.isArray(sb.kalemler)) hatKalemleri = sb.kalemler.map((k) => Object.assign({}, k, { hakedis: hak }));
      // Çok iletkenli hat (müşterek OG + AG, iki kablo): ana kesit eklentideki gibi "OG + … / AG + …"
      const satirlar = hatKalemleri.filter((k) => k.kaynak === 'HAT');
      if (satirlar.length > 1) { kesit.tanim = etiketKesiti(satirlar); kesit.aciklama = ''; }
      for (const m of li.items) if (m.manual) { const k = malzemeKalemi(Object.assign({}, m, { kgPer: null, origin: 'MANUEL' }), { cins: '', voltaj: hatTuru.voltaj, tarife: hatTuru.tarife }, hak, li.job, cat); if (k) manuel.push(k); }
    }
    const kn = km && !km.kazisiz && li.cable && li.cable.kanal ? li.cable.kanal : null;
    const paylar = parcaPaylari(parcalar.map(parcaUzunlugu));
    for (let k = 0; k < parcalar.length; k++) {
      const pc = parcalar[k], pay = paylar[k], son = k === parcalar.length - 1;
      const kose = pc.map((p) => [r4(p.E), r4(p.N)]);
      const mid = pc[Math.floor(pc.length / 2)];
      const bolge = bolgeIdi(mid.E, mid.N);
      const uc = [pc[0], pc[pc.length - 1]].map((p) => { const es = eqByPoint.get(p.id) || []; return es.length ? es[0] : null; });
      const kimlik = parcaKimligi(l, k + 1, pc, parcalar.length);
      let hat = null;
      if (kablolu) {
        hat = {
          id: kimlik, tur: hatTuru.tur, anaKesit: kesit.tanim, durum, hakedis: hak, bolge, kose,
          cizimUzunlugu: r3(parcaUzunlugu(pc)), etiket: '', kontrol: null, katman: sb.katman || '', kalemler: [], telefonId: l.id,
          uclar: uc.map((e) => (e ? (e.sebekeId || e.id) : '')), not: l.note || undefined,
          parca: parcalar.length > 1 ? { sira: k + 1, toplam: parcalar.length } : undefined
        };
        // İletken / kablo (HAT) kalemleri parçalara uzunlukla bölünür; hattın malzemeleri (ek mufu, boru dışı malzeme…) ilk parçada
        for (const kl of hatKalemleri) { if (kl.kaynak === 'HAT') hat.kalemler.push(kalemPayi(kl, pay, son, paylar, k)); else if (k === 0) hat.kalemler.push(Object.assign({}, kl)); }
        if (k === 0) hat.kalemler.push(...manuel); // elle eklenen malzemeler ilk parçaya
        kalemBilgisiUygula(hat.kalemler, kayitliBilgi(sb, kimlik));
        const ana = hat.kalemler.find((x) => x.kaynak === 'HAT') || hat.kalemler[0];
        // Etiketteki uzunluk güzergâhın metrajıdır (adetli iletkende miktar / adet); tek iletkende adetli tam yazım
        const tekAdetli = ana && hat.kalemler.filter((x) => x.kaynak === 'HAT').length === 1 && iletkenAdedi(ana) > 1;
        hat.etiket = SH.hatEtiketi(durum, tekAdetli ? ana.aciklama : kesit.aciklama || kesit.tanim, ana ? ana.miktar / iletkenAdedi(ana) : Math.ceil(hat.cizimUzunlugu - 1e-6));
        sp.hatlar.push(hat);
      }
      // Yeraltı: kazı kanalı ya da yatay sondaj ayrı nesnedir (parça parça)
      if (!kn) continue;
      const kablolar = kanalKablolari(l);
      const uzunluk = Math.round(kn.uzunluk * pay * 100) / 100;
      const kanalKimligi = (on) => {
        const harita = on === 'K' ? sb.kanalParcalari : sb.sondajParcalari;
        const anahtar = pc[0].id + '|' + pc[pc.length - 1].id;
        if (harita && harita[anahtar]) return harita[anahtar];
        const kok = on === 'K' ? (sb.kanalId || 'K' + (sb.id || l.sebekeId || l.id)) : sb.sondaj ? (sb.id || l.sebekeId || l.id) : 'S' + (sb.id || l.sebekeId || l.id);
        return parcalar.length === 1 ? kok : kok + '-' + (k + 1);
      };
      if (km.method === 'sondaj') {
        const s = { id: kanalKimligi('S'), tip: (sb.sondaj && sb.tip) || 'Yatay sondaj' + (l.cable && l.cable.pipeDia ? ' Ø' + l.cable.pipeDia : ''), durum, hakedis: hak, bolge, basNo: uc[0] ? uc[0].no : '', bitNo: uc[1] ? uc[1].no : '', kose, cizimUzunlugu: r3(uzunluk), kontrol: null, kalemler: [], telefonId: l.id };
        const sondaj = li.items.find((x) => x.kanal && /sondaj/i.test(x.why || ''));
        s.kalemler.push(SH.kalemYap({ cins: 'YATAY_DELGİ', tanim: s.tip, birim: 'mt/mt', katsayi: 1, tarife: cinsTarifesi('YATAY_DELGİ', '0104') }, { miktar: Math.ceil(uzunluk - 1e-6), durum, hakedis: hak, ana: true, kaynak: 'NIT' }));
        if (sondaj && sondaj.servis) s.kalemler[0].servis = sondaj.servis;
        kalemBilgisiUygula(s.kalemler, kayitliBilgi(sb, s.id));
        sp.sondajlar.push(s);
      } else {
        const zemin = ESLESME.zeminler[km.surface] || 'TOPRAK';
        const gen = Math.round((kn.genislik || 0) * 100), der = Math.round((kn.derinlik || 0) * 100);
        const kDurum = sb.kanalDurum ? korunanDurum({ durum: sb.kanalDurum }, l.state, false, tedarik) : durum;
        const c = { id: kanalKimligi('K'), kod: SH.kanalKodu(kablolar.OG, kablolar.AG, kablolar.AYD, kablolar.REK), zemin, altGenislik: gen, ustGenislik: gen, derinlik: der, basNo: uc[0] ? uc[0].no : '', bitNo: uc[1] ? uc[1].no : '', durum: kDurum, hakedis: hak, bolge, kose, cizimUzunlugu: r3(uzunluk), kontrol: null, kalemler: [], telefonId: l.id };
        const kk = SH.kalemYap({ cins: String(c.kod), tanim: zemin, birim: 'mt/m³', katsayi: 1, tarife: cinsTarifesi('KABLO_KANALI', '0104') }, { miktar: Math.ceil(uzunluk - 1e-6), durum: kDurum, hakedis: hak, ana: true, kaynak: 'NIT' });
        SH.kalemToplami(kk, c);
        c.kalemler.push(kk);
        if (kn.boru > 0) {
          // Boru AutoCAD'de kanalın değil kablonun malzemesidir (kanal nesnesi yalnız kendi kalemini taşır)
          const boru = SH.kalemYap({ cins: 'GALVANİZLİ_GAZ_BORUSU', tanim: 'Ø' + ((l.cable && l.cable.pipeDia) || 110) + ' boru', birim: 'mt/mt', katsayi: 1, tarife: cinsTarifesi('GALVANİZLİ_GAZ_BORUSU', '0104') }, { miktar: Math.ceil(kn.boru * pay - 1e-6), durum, hakedis: hak, kaynak: 'MALZEME' });
          if (hat) hat.kalemler.push(boru);
          else { c.kalemler.push(boru); if (k === 0) uyarilar.push(l.lineNo + ': kablosuz kanaldaki boru kalemi AutoCAD çizimine yazılamaz (yalnız dosyadan raporda görünür)'); }
        }
        kalemBilgisiUygula(c.kalemler, kayitliBilgi(sb, c.id));
        sp.kanallar.push(c);
      }
    }
  }

  // Ekipmansız ölçü noktaları (detay / kontrol): AutoCAD GPS noktaları
  const eqPts = new Set(eqs.map((e) => e.pointId));
  const linePts = new Set(); for (const l of lines) for (const id of l.nodes || []) linePts.add(id);
  for (const p of pts.values()) {
    if (eqPts.has(p.id) || p.E == null) continue;
    if (p.cls === 'HAT' && linePts.has(p.id)) continue;
    sp.noktalar.push({ id: p.sebekeId || p.id, ad: p.pointNo || '', kod: p.cls || '', saga: r4(p.E), yukari: r4(p.N), kot: p.H != null ? r4(p.H) : 0, hakedis: sp.proje.aktifHakedis, bolge: bolgeIdi(p.E, p.N), telefonId: p.id, olcum: olcumBilgisi(p) });
  }
  // Teknik hesap sonuçları (Hesap Merkezi): hedef kimlikleri dosyadaki eleman / hat kimliklerine çevrilir
  const hesaplar = hesaplariDisaAktar(ps, sp, uyarilar);
  if (hesaplar.length) sp.hesaplar = hesaplar;
  if (uyarilar.length) sp.uyarilar = uyarilar;
  return sp;
}

/** Telefondaki hesap kayıtları → proje dosyası (hedef: dosyadaki eleman kimliği; hatta parça kimlikleri). */
function hesaplariDisaAktar(ps, sp, uyarilar) {
  const out = [];
  const eqById = new Map((ps.data.equipment || []).map((e) => [e.id, e]));
  for (const k of hesapKayitlari(ps)) {
    const h = k.hedef || {};
    const hedef = { tur: h.tur || 'proje', id: '', no: h.no || '' };
    const ad = (k.modulAdi || k.modul) + (h.no ? ' · ' + h.no : '');
    if (h.tur === 'direk' || h.tur === 'trafo') {
      const e = eqById.get(h.id);
      if (!e || e.status === 'deleted') { uyarilar.push('Hesap kaydı aktarılmadı, hedef nesne silinmiş: ' + ad); continue; }
      const el = sp.elemanlar.find((x) => x.telefonId === e.id);
      if (!el) { uyarilar.push('Hesap kaydı aktarılmadı, hedef dosyaya yazılmadı (ileride durumunda olabilir): ' + ad); continue; }
      hedef.id = el.id;
    } else if (h.tur === 'hat' || h.tur === 'kanal') {
      const parcalar = sp.hatlar.filter((x) => x.telefonId === h.id).map((x) => x.id).concat(sp.kanallar.filter((x) => x.telefonId === h.id).map((x) => x.id));
      if (!parcalar.length) { uyarilar.push('Hesap kaydı aktarılmadı, hedef hat dosyaya yazılmadı: ' + ad); continue; }
      hedef.id = parcalar[0];
      hedef.parcalar = parcalar;
    }
    if (h.hatId) {
      // trafo hedefinde hesaplanan çıkış: telefondaki hattın dosyadaki ilk parçası
      const kol = sp.hatlar.find((x) => x.telefonId === h.hatId);
      if (kol) hedef.hatId = kol.id; else uyarilar.push('Hesap kaydının çıkış hattı dosyaya yazılmadı (trafo bilgisiyle açılır): ' + ad);
    }
    out.push({ id: k.sebekeId || k.id, modul: k.modul, modulAdi: k.modulAdi, modulSurumu: k.modulSurumu || undefined, hedef, ozet: k.ozet, durum: k.durum,
      ayrinti: k.ayrinti || {}, modulDurumu: k.modulDurumu || '', kullanilan: k.kullanilan || {}, tarih: k.tarih, kaynak: k.kaynak || 'telefon', yapan: k.yapan || undefined, telefonId: k.id });
  }
  return out;
}

/** Proje dosyasındaki hesap kayıtlarını telefona alır (aynı kayıt yeniden alınırsa daha yeniyse güncellenir). */
async function hesaplariIceAl(ps, sp, eqByKey, lineByKey, ozet) {
  const liste = sp.hesaplar || [];
  if (!liste.length) return;
  const mevcut = hesapKayitlari(ps);
  let yeni = 0, guncel = 0;
  for (const h of liste) {
    const t = h.hedef || {};
    let hedef = { tur: t.tur || 'proje', id: '', no: t.no || '' };
    if (t.tur === 'direk' || t.tur === 'trafo') {
      const e = eqByKey.get(t.id);
      if (!e) { ozet.uyarilar.push('Hesap kaydı alınamadı, hedef bulunamadı: ' + (h.modulAdi || h.modul) + ' ' + (t.no || t.id)); continue; }
      hedef.id = e.id; hedef.no = e.no || hedef.no;
    } else if (t.tur === 'hat' || t.tur === 'kanal') {
      const l = [t.id].concat(t.parcalar || []).map((x) => lineByKey.get(x)).find(Boolean);
      if (!l) { ozet.uyarilar.push('Hesap kaydı alınamadı, hedef hat bulunamadı: ' + (h.modulAdi || h.modul) + ' ' + (t.no || t.id)); continue; }
      hedef.id = l.id; hedef.no = l.lineNo || hedef.no;
    }
    if (t.hatId) { const kol = lineByKey.get(t.hatId); if (kol) hedef.hatId = kol.id; }
    const rec = { projectId: ps.p.id, kind: 'HESAP', modul: h.modul, modulAdi: h.modulAdi, modulSurumu: h.modulSurumu || '', hedef, ozet: h.ozet, durum: h.durum,
      ayrinti: h.ayrinti || {}, modulDurumu: h.modulDurumu || '', kullanilan: h.kullanilan || {}, tarih: h.tarih, kaynak: h.kaynak || 'autocad', yapan: h.yapan || '',
      sebekeId: h.id, name: (h.modulAdi || h.modul) + (hedef.no ? ' · ' + hedef.no : '') };
    const eski = mevcut.find((d) => d.id === h.telefonId || d.sebekeId === h.id || d.id === h.id);
    if (eski) {
      if (String(h.tarih || '') > String(eski.tarih || '')) { await ps.ds.update('documents', eski.id, rec, { reason: 'Hesap kaydı AutoCAD dosyasından güncellendi', silent: true, noAudit: true }); guncel++; }
    } else { await ps.ds.create('documents', rec, { reason: 'Hesap kaydı AutoCAD dosyasından alındı', silent: true, noAudit: true }); yeni++; }
  }
  await ps.reload('documents');
  ozet.hesap = { yeni, guncel };
}

/** Açık projeyi .sebeke.json metnine çevirir. */
export function sebekeYaz(ps, opts = {}) {
  return SH.projeYaz(sebekeModel(ps, opts), 'Şebeke-M (telefon)', opts.girintili !== false);
}

/** Hattı bağlantı düğümlerinden (ekipmanı olan noktalar) parçalara böler; ekipmansız köşeler parçanın içinde kalır. */
export function hatParcalari(coords, eqByPoint) {
  const out = [];
  let bas = 0;
  for (let i = 1; i < coords.length; i++) {
    if (i === coords.length - 1 || (eqByPoint.get(coords[i].id) || []).length) { out.push(coords.slice(bas, i + 1)); bas = i; }
  }
  return out;
}
const parcaUzunlugu = (pc) => { let t = 0; for (let i = 1; i < pc.length; i++) t += Math.hypot(pc[i].E - pc[i - 1].E, pc[i].N - pc[i - 1].N); return t; };
/** Parçaların uzunluk payları (toplamı 1). */
function parcaPaylari(uzunluklar) { const t = uzunluklar.reduce((a, b) => a + b, 0) || 1; return uzunluklar.map((u) => u / t); }
/**
 * Kalemin parça payı: miktar uzunluk payıyla bölünür; toplam değişmez. Tam sayı miktar (AutoCAD metrajı) tam
 * sayı parçalara dağıtılır (en büyük kalan yöntemi: kalan metreler payı en çok kesilen parçalara gider); ondalıklı
 * miktar 2 ondalıkla bölünür, son parça kalanı alır.
 */
function kalemPayi(k, pay, son, paylar, sira) {
  const n = paylar.length;
  if (n === 1) return Object.assign({}, k);
  const toplam = Number(k.miktar) || 0;
  let miktar;
  if (Number.isInteger(toplam)) {
    const ham = paylar.map((p) => toplam * p);
    const taban = ham.map((x) => Math.floor(x + 1e-9));
    let kalan = toplam - taban.reduce((a, b) => a + b, 0);
    const sirali = ham.map((x, i) => [x - taban[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const ek = new Array(n).fill(0);
    for (let i = 0; kalan > 0 && i < n; i++, kalan--) ek[sirali[i][1]] = 1;
    miktar = taban[sira] + ek[sira];
  } else if (son) { let onceki = 0; for (let i = 0; i < n - 1; i++) onceki += Math.round(toplam * paylar[i] * 100) / 100; miktar = Math.round((toplam - onceki) * 100) / 100; }
  else miktar = Math.round(toplam * pay * 100) / 100;
  return SH.kalemToplami(Object.assign({}, k, { miktar: Math.max(0, miktar) }));
}
/**
 * Parçanın AutoCAD kimliği: AutoCAD'den gelen parça kimliği (sebeke.parcalar: "başNokta|bitNokta" → kimlik) varsa o;
 * tek parçada eski kimlik (sebeke.id / sebekeId / id); çok parçada "<kimlik>-<sıra>".
 */
function parcaKimligi(l, sira, pc, n) {
  const sb = l.sebeke || {};
  const key = pc[0].id + '|' + pc[pc.length - 1].id;
  if (sb.parcalar && sb.parcalar[key]) return sb.parcalar[key];
  const kok = sb.id || l.sebekeId || l.id;
  return n === 1 ? kok : kok + '-' + sira;
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

/** Ekipmanın AutoCAD türü, cinsi, tipi ve tedarik bilgisi. */
export function elemanTanimi(e, cat) {
  const sb = e.sebeke || {};
  if (e.kind === 'pole' || e.kind === 'lighting') {
    const t = e.typeId ? cat.poleType(e.typeId) : null;
    const grup = e.group || (t && t.group) || (e.kind === 'lighting' ? 'ayd' : 'sehir');
    const g = ESLESME.direkGruplari[grup] || ESLESME.direkGruplari.sehir;
    const pz = t ? cat.poz(t.servis) : null;
    return { tur: sb.tur || g.tur, cins: sb.cins || g.cins, tip: sb.tip || (t ? cizimTip(grup, t.name) : (e.attrs && e.attrs.typeName) || ''), tarife: g.tarife, kg: t ? t.kg : 0, servis: t ? t.servis : null, tedarik: pz ? pz.supply : null, voltaj: g.tur === 'ENH_DIREK' || g.tur === 'MUSTEREK_DIREK' ? 'OG' : g.tur === 'AYD_DIREK' ? 'AYD' : 'AG' };
  }
  if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') {
    const a = e.attrs || {};
    const post = a.post || (e.kind === 'substation' ? 'ind' : e.kind === 'kiosk' ? 'mbk' : 'direk');
    const n = ESLESME.nesneler[e.kind === 'transformer' ? 'transformer:' + (post === 'direk' ? 'direk' : post === 'bina' || post === 'ba' ? 'bina' : 'kosk') : e.kind];
    const td = a.poleTypeId ? cat.poleType(a.poleTypeId) : null;
    const kva = +a.kva || 0;
    const tip = sb.tip || (post === 'direk' ? (td ? cizimTip('trafo', td.name) : (kva ? kva + ' kVA' : '')) : (a.govde || (a.kioskServis && cat.kiosk(a.kioskServis) ? cat.kiosk(a.kioskServis).label : '') || (kva ? kva + ' kVA' : '')));
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
  const k = SH.kalemYap(it, { miktar: kendi ? kendi.qty : 1, durum: kendi && kendi.jobOverride ? isDurumu(kendi.jobOverride, tanim.tedarik) : durum, hakedis: hak, ana: true, kaynak: 'NIT', dmDurum: durum === 'DM' || durum === 'DM+M' ? (e.attrs && e.attrs.dmDurum) || '' : '' });
  if (kendi && kendi.servis) k.servis = kendi.servis;
  return k;
}

/** Reçete / elle eklenen malzeme → kalem. Katalogda birebir eşi varsa onun cins/tanımı, yoksa poz kategorisinden cins, poz adından tanım. */
function malzemeKalemi(m, tanim, hak, job, cat) {
  if (!(m.qty > 0)) return null;
  const servis = m.servis || null;
  const pz = servis && cat ? cat.poz(servis) : null;
  if (pz && pz.sebeke && pz.sebeke.cins) {
    // AutoCAD'den gelen (ya da kullanıcının AutoCAD alanlarını girdiği) kalem: alanlar aynen döner
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

/** Kalemin adedi: tam yazımdaki "3x(…)" ön ekinden (eklentideki Iletkenler.Adet ile aynı); yoksa 1. */
export function iletkenAdedi(k) {
  const m = /^\s*(\d+)\s*[x×]\s*\((.+)\)\s*$/i.exec(String((k && (k.aciklama || k.tanim)) || ''));
  return m ? Math.max(1, +m[1]) : 1;
}
/** Çok iletkenli hattın ana kesiti / etiket yazısı: OG'ler " + ", sonra " / ", sonra AG'ler " + " (eklentideki gibi). */
export function etiketKesiti(satirlar) {
  const yazi = (k) => String(k.aciklama || k.tanim || '').trim();
  const og = satirlar.filter((k) => String(k.cins || '').startsWith('OG_')).map(yazi).filter(Boolean);
  const ag = satirlar.filter((k) => !String(k.cins || '').startsWith('OG_')).map(yazi).filter(Boolean);
  return [og.join(' + '), ag.join(' + ')].filter(Boolean).join(' / ');
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
    const ks = cizimKesit(label, l.lineType, l.install);
    // Müşterek hatta OG devresi OG iletkenidir (eklentideki gibi); ana kesitteki "OG / AG" ayrımı ve geri alım buna bakar
    const ogDevre = hatTuru.tur === 'MUSTEREK' && (c.role === 'OG' || c.role === 'ENH');
    const cins = yeralti ? hatTuru.kablo : ogDevre ? ESLESME.hatlar['OG:havai'].ciplak : ciplak ? hatTuru.ciplak : hatTuru.demetli;
    const parca = items.filter((x) => x.role === c.role && (x.conductor === c.key || x.conductor === label || (cp && cp.parts.some((p) => p.conductor === x.conductor))));
    // Metre: yeraltında tüm damarların toplamı (3(1x150/25) = 3 kablo), havai demetlide hattın boyu (pay dahil),
    // çıplakta hattın boyu (rapor tel tel açar). AutoCAD gibi tam metreye yukarı yuvarlanır.
    let metre = 0, kg = 0;
    if (yeralti) { const x = parca[0]; metre = x ? x.meters / n : li.length2D; }
    else if (ciplak) { metre = li.length3D; for (const x of parca) kg += x.unit === 'Kg' ? x.qty : 0; }
    else { const x = parca[0]; metre = x ? x.meters / n : li.length3D; }
    metre = Math.ceil(metre - 1e-6);
    const kat = katalogKalemi(cins, ks.tanim);
    const kgM = ciplak && metre > 0 && kg > 0 ? kg / metre : 0;
    const it = kat || { cins, tanim: ks.tanim, birim: kgM ? 'mt/kg' : 'mt/mt', katsayi: kgM || 1, tarife: cinsTarifesi(cins, hatTuru.tarife) };
    // Katalogda mt/mt ise (rapor tel tel açar) telefonun kg'si katsayıya yazılmaz. Adet (ör. 3 ALPEK, 2 devre 4P+R): miktar
    // adet × güzergâh, tam yazım "3x(…)" — eklentideki çoklu iletkenle aynı. Kg katsayılı özel çıplak kombinasyonda kg zaten
    // bütün devreleri içerir (çarpılmaz).
    const carpan = n > 1 && !(ciplak && !kat && kgM) ? n : 1;
    const k = SH.kalemYap(it, { miktar: metre * carpan, durum, hakedis: hak, kaynak: 'HAT', aciklama: ks.aciklama || (carpan > 1 ? n + 'x(' + ks.tanim + ')' : undefined) });
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
  // Eski program iletken ekini yazmaz (cıvatalı ENH direği "P-6"; katalogda "P-6 (3/0)"): ek atılınca tek aday kalıyorsa o
  if (!t) { const n = adNormal(voltTip(grup, tip)); const l = cat.poleTypes(grup).filter((x) => adNormal(x.name.replace(/\s*\([^)]*\)\s*$/, '')) === n); if (l.length === 1) t = l[0]; }
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
 * Çok iletkenli (ya da adetli) hattın telefon devreleri: her HAT satırı bir devre — OG iletken OG devresi, diğerleri hattın
 * türünün devresi (müşterekte AG); adet "3x(…)" yazımından. Tek, adetsiz iletkende ya da eşleşmeyen satır varsa null.
 */
function hatDevreleri(cat, h, ht) {
  const satirlar = (h.kalemler || []).filter((k) => k.kaynak === 'HAT');
  if (!satirlar.length || (satirlar.length === 1 && iletkenAdedi(satirlar[0]) === 1)) return null;
  const out = [];
  for (const k of satirlar) {
    const og = String(k.cins || '').startsWith('OG_');
    const tur = og ? 'OG' : ht.lineType === 'OG' ? 'AG' : ht.lineType;
    const lt = hatTipiEsle(cat, k.tanim, tur, ht.install);
    if (!lt) return null;
    out.push({ role: ht.lineType === 'ABONE' ? 'ABONE' : tur, key: lt.name, count: iletkenAdedi(k) });
  }
  return out;
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
  const sebeke = Object.assign({}, project.sebeke || {}, { katmanOnEki: pj.katmanOnEki || (project.sebeke || {}).katmanOnEki || 'SC', gisOnEki: pj.gisOnEki || pj.katmanOnEki || 'SC', kaynak: pj.kaynak || '', dom, olusturan: sp.olusturan || '', bolgeler: (sp.bolgeler || []).map((b) => Object.assign({ id: b.id, ad: b.ad, kod: b.kod, aciklama: b.aciklama || '', sinir: b.sinir }, b.grup ? { grup: b.grup } : {})), onaylar: onaylariHazirla(pj.onaylar, null), alinma: new Date().toISOString() });
  await ps.updateProject({ sebeke, autoRecipe: project.autoRecipe === true }, 'AutoCAD dosyası alındı');
  if (opts.dry) return ozet;

  const act = (a) => (a || []).filter((x) => x.status !== 'deleted');
  const eqs = act(ps.data.equipment), lines = act(ps.data.lines), pts = act(ps.data.points);
  const eqByKey = new Map();
  for (const e of eqs) { eqByKey.set(e.id, e); if (e.sebekeId) eqByKey.set(e.sebekeId, e); }
  const lineByKey = new Map();
  for (const l of lines) { lineByKey.set(l.id, l); if (l.sebekeId) lineByKey.set(l.sebekeId, l); }
  const pointByKey = new Map();
  for (const p of pts) { pointByKey.set(p.id, p); if (p.sebekeId) pointByKey.set(p.sebekeId, p); }
  const bul = (map, o) => (o.telefonId && map.get(o.telefonId)) || map.get(o.id) || null;

  // Elemanlar
  const noktaIdByEleman = new Map();   // eklenti eleman kimliği → telefon nokta kimliği (hat uçları için)
  for (const el of sp.elemanlar || []) {
    const et = ESLESME.elemanTurleri[el.tur] || ESLESME.elemanTurleri.DIGER;
    const trafo = et.kind === 'transformer';
    const state = voltDurumu(el.durum, trafo);
    const data = { state, note: el.not || undefined, sebekeId: el.id, sebeke: Object.assign({ id: el.id, tur: el.tur, cins: el.cins, tip: el.tip, durum: el.durum, aci: el.aci, katman: el.katman, blok: el.blok, hakedis: el.hakedis, bolge: el.bolge, anaKalem: (el.kalemler || []).find((k) => k.ana) || null, kalemBilgisi: { [el.id]: kalemBilgisi(el.kalemler) } }, el.ekVeri && Object.keys(el.ekVeri).length ? { ekVeri: el.ekVeri } : {}) };
    const anaKalem = (el.kalemler || []).find((k) => k.ana);
    const attrs = {};
    if (anaKalem && anaKalem.dmDurum) attrs.dmDurum = anaKalem.dmDurum;
    if (et.kind === 'pole' || et.kind === 'lighting') {
      const d = direkEsle(ps.cat, el.tur, el.cins, el.tip);
      data.group = d.grup;
      if (d.tip) data.typeId = d.tip.id; else { attrs.typeName = el.tip; ozet.eslesmeyen.push(el.gisId + ': direk tipi katalogda yok (' + el.cins + ' ' + el.tip + ')'); }
    } else if (trafo) {
      attrs.post = el.tur === 'TRAFO_DIREGI' ? 'direk' : /BİNA|BINA/i.test(el.cins) ? et.binaPost : et.post;
      if (el.guc) attrs.kva = parseFloat(String(el.guc).replace(',', '.')) || undefined;
      if (el.tur === 'TRAFO_DIREGI') { const d = direkEsle(ps.cat, 'TRAFO_DIREGI', el.cins, el.tip); if (d.tip) attrs.poleTypeId = d.tip.id; else if (el.tip) attrs.typeName = el.tip; }
      else if (el.tip) attrs.govde = el.tip;
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
  // Parçalı hatlar (direkten direğe ayrı nesneler) telefonda tek hat olur: aynı telefon kimliğiyle gelenler ve
  // uç uca eklenen aynı tanımlı parçalar zincirlenir; parça kimlikleri saklanır, dışa aktarımda aynen döner.
  const kullanilanHat = new Set();
  const hatlarById = new Map((sp.hatlar || []).map((x) => [x.id, x]));
  for (const h of hatlariBirlestir(sp.hatlar || [])) {
    const ht = ESLESME.hatTurleriTers[h.tur] || ESLESME.hatTurleriTers.AG_HAVAI;
    // Çok iletkenli hat (müşterek OG + AG, 3 adet ALPEK): her iletken satırı bir devre; eşleşmeyen varsa kalemler korunur
    const devreler = hatDevreleri(ps.cat, h, ht);
    const lt = devreler ? null : hatTipiEsle(ps.cat, h.anaKesit, ht.lineType, ht.install);
    const nodes = [];
    const koseNoktalari = [];
    for (let i = 0; i < h.kose.length; i++) {
      const uc = h.uclar && (i === 0 ? h.uclar[0] : i === h.kose.length - 1 ? h.uclar[1] : null);
      const ara = h.araUclar && h.araUclar[i];
      const pid = ((uc || ara) && noktaIdByEleman.get(uc || ara)) || await koseNokta(h.kose[i], 'HAT');
      koseNoktalari.push(pid);
      if (!nodes.length || nodes[nodes.length - 1] !== pid) nodes.push(pid);
    }
    // Kanal: parçaların her biri ayrı kanal nesnesi olabilir; ilki kanal ayarını verir, hepsi listeden düşer
    let kanal = null, boruKalemi = null;
    const parcalar = {}, kanalParcalari = {}, bilgi = {};
    for (const pc of h.parcalar) {
      const a = koseNoktalari[pc.bas], b = koseNoktalari[pc.bit];
      const c = kanalIndeks.get(koseAnahtari(pc.kose));
      if (a && b && a !== b) { parcalar[a + '|' + b] = pc.id; if (c) kanalParcalari[a + '|' + b] = c.id; }
      const orj = hatlarById.get(pc.id);
      if (orj) bilgi[pc.id] = kalemBilgisi(orj.kalemler);
      if (!c) continue;
      bilgi[c.id] = kalemBilgisi(c.kalemler);
      kanalIndeks.delete(koseAnahtari(pc.kose));
      if (!kanal) kanal = c;
    }
    const data = {
      lineType: ht.lineType, install: ht.install, musterek: !!ht.musterek, state: voltDurumu(h.durum), nodes, name: lt || devreler ? '' : h.anaKesit,
      circuits: devreler || (lt ? [{ role: ht.lineType === 'ABONE' ? 'ABONE' : ht.lineType, key: lt.name, count: 1 }] : []),
      sebekeId: h.id, note: h.not || undefined,
      sebeke: { id: h.id, tur: h.tur, anaKesit: h.anaKesit, durum: h.durum, etiket: h.etiket, katman: h.katman, hakedis: h.hakedis, bolge: h.bolge, kalemler: lt || devreler ? undefined : h.kalemler, parcalar: Object.keys(parcalar).length > 1 ? parcalar : undefined, kalemBilgisi: bilgi }
    };
    if (kanal) {
      const ka = kanalAyari(kanal, h); data.cable = ka.cable; boruKalemi = ka.boru; data.sebeke.kanalId = kanal.id; data.sebeke.kanalKod = kanal.kod; data.sebeke.kanalDurum = kanal.durum;
      if (Object.keys(kanalParcalari).length > 1) data.sebeke.kanalParcalari = kanalParcalari;
    }
    if (!lt && !devreler && h.anaKesit) ozet.eslesmeyen.push((h.etiket || h.anaKesit) + ': hat tipi katalogda yok, metraj eklentideki kalemlerle korunur');
    // Telefondaki hat: kimlikle, kimliğin köküyle ya da parçalardan birinin kimliğiyle; aynı hat iki kez kullanılmaz
    // (AutoCAD'de ortadan bir parça silinip hat ikiye ayrıldıysa ikinci kısım yeni hat olur)
    const adaylar = [bul(lineByKey, h), h.telefonId ? lineByKey.get(kokKimlik(h.telefonId)) : null, ...h.parcalar.map((pc) => lineByKey.get(pc.id) || lineByKey.get(kokKimlik(pc.id)))];
    const mevcut = adaylar.find((x) => x && !kullanilanHat.has(x.id)) || null;
    let rec;
    if (mevcut) { kullanilanHat.add(mevcut.id); rec = await ps.updateLine(mevcut.id, data, 'AutoCAD dosyasından güncellendi'); ozet.guncellenenHat++; }
    else { rec = await ps.createLine(Object.assign({ lineNo: ps.nextLineNo() }, data), { defer: true, reason: 'AutoCAD dosyasından alındı' }); ozet.yeniHat++; }
    // Boru kalemi kanal ayarına (borulu geçiş, boru sayısı) çevrildi; malzeme olarak ayrıca yazılmaz (telefon kendisi hesaplar)
    await malzemeleriYaz(ps, 'line', rec.id, (h.kalemler || []).filter((k) => !k.ana && k.kaynak !== 'HAT' && !(boruKalemi && k.cins === boruKalemi.cins && k.tanim === boruKalemi.tanim)), opts);
  }
  // Hattı olmayan kanallar ve sondajlar: kablosuz kanal / kazı hattı
  for (const c of kanalIndeks.values()) {
    const nodes = []; for (const xy of c.kose) { const pid = await koseNokta(xy, 'HAT'); if (!nodes.length || nodes[nodes.length - 1] !== pid) nodes.push(pid); }
    const data = { lineType: c.kod & 8 ? 'OG' : c.kod & 4 ? 'AG' : c.kod & 2 ? 'AYD' : 'ABONE', install: 'yeralti', channelOnly: true, circuits: [], nodes, state: voltDurumu(c.durum), cable: kanalAyari(c, null).cable, sebekeId: c.id, sebeke: { id: c.id, kanal: true, kanalId: c.id, kanalKod: c.kod, zemin: c.zemin, durum: c.durum, hakedis: c.hakedis, bolge: c.bolge, kalemBilgisi: { [c.id]: kalemBilgisi(c.kalemler) } } };
    const mevcut = bul(lineByKey, c);
    if (mevcut) await ps.updateLine(mevcut.id, data, 'AutoCAD dosyasından güncellendi'); else await ps.createLine(Object.assign({ lineNo: ps.nextLineNo() }, data), { defer: true, reason: 'AutoCAD dosyasından alındı (kanal)' });
    ozet.yeniKanal++;
  }
  for (const s of sp.sondajlar || []) {
    const nodes = []; for (const xy of s.kose) { const pid = await koseNokta(xy, 'HAT'); if (!nodes.length || nodes[nodes.length - 1] !== pid) nodes.push(pid); }
    const cap = /Ø\s*(\d+)/.exec(s.tip || '');
    const data = { lineType: 'OG', install: 'yeralti', channelOnly: true, circuits: [], nodes, state: voltDurumu(s.durum), cable: { surface: 'toprak', method: 'sondaj', width: 0, depth: 0, pipeDia: cap ? +cap[1] : 110, pipeCount: 1 }, sebekeId: s.id, sebeke: { id: s.id, sondaj: true, tip: s.tip, durum: s.durum, hakedis: s.hakedis, bolge: s.bolge, kalemBilgisi: { [s.id]: kalemBilgisi(s.kalemler) } } };
    const mevcut = bul(lineByKey, s);
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
  // Teknik hesap kayıtları: hedefler yeni eklenen nesnelerle birlikte eşlenir
  {
    const eq2 = new Map(), ln2 = new Map();
    for (const e of act(ps.data.equipment)) { eq2.set(e.id, e); if (e.sebekeId) eq2.set(e.sebekeId, e); }
    for (const l of act(ps.data.lines)) { ln2.set(l.id, l); if (l.sebekeId) ln2.set(l.sebekeId, l); for (const pid of Object.values((l.sebeke || {}).parcalar || {})) ln2.set(pid, l); }
    await hesaplariIceAl(ps, sp, eq2, ln2, ozet);
  }
  await ps.recompute('AutoCAD dosyası alındı');
  ozet.uyarilar.push(...(sp.uyarilar || []));
  ozet.projectId = ps.p.id;
  return ozet;
}

/**
 * AutoCAD'den gelen kalemlerin telefonda tutulmayan AutoCAD bilgileri: INDEX sırası, kalemin hakedişi ve KONTROL işareti.
 * Telefon kalemleri malzemeden yeniden üretir; geri yazımda aynı cins / tanımlı kaleme bu bilgiler verilir (KONTROL
 * yalnız miktar değişmediyse). Böylece değişmeyen nesne AutoCAD'e "değişmiş" gitmez, onaylı hakediş kilidi bozulmaz.
 */
function kalemBilgisi(kalemler) {
  return (kalemler || []).map((k) => ({ cins: k.cins || '', tanim: k.tanim || '', kaynak: k.kaynak || '', ana: !!k.ana, sira: k.sira || '', hakedis: +k.hakedis || 0, kontrol: k.kontrol === undefined ? null : k.kontrol, miktar: +k.miktar || 0 }));
}
const kayitliBilgi = (sb, id) => (sb && sb.kalemBilgisi && id && sb.kalemBilgisi[id]) || null;
function kalemBilgisiUygula(kalemler, bilgi) {
  if (!Array.isArray(bilgi) || !bilgi.length) return;
  const kalan = bilgi.slice();
  for (const k of kalemler) {
    const i = kalan.findIndex((b) => b.cins === (k.cins || '') && b.tanim === (k.tanim || '') && b.ana === !!k.ana && b.kaynak === (k.kaynak || ''));
    if (i < 0) continue;
    const b = kalan.splice(i, 1)[0];
    if (!k.sira && b.sira) k.sira = b.sira;
    if (b.hakedis) k.hakedis = b.hakedis;
    if (b.kontrol !== null && Math.abs((+k.miktar || 0) - b.miktar) < 1e-9) k.kontrol = b.kontrol;
  }
}

/**
 * Hakediş onayları (AutoCAD / AutoCAD HAK_ONAY ile aynı): [{ no, kontrol, hakedis, gis }]. AutoCAD'den gelenler korunur;
 * telefonda onaylanan dönem (hakediş onayı) kontrol + hakediş onayı sayılır. Sıra: kontrol → hakediş → GIS.
 */
export function onaylariHazirla(kayitli, periods) {
  const m = new Map();
  const ekle = (no, o) => {
    if (!(no > 0)) return;
    const x = m.get(no) || { no, kontrol: false, hakedis: false, gis: false };
    x.kontrol = x.kontrol || !!o.kontrol; x.hakedis = x.hakedis || !!o.hakedis; x.gis = x.gis || !!o.gis;
    if (x.gis) x.hakedis = true;
    if (x.hakedis) x.kontrol = true;
    m.set(no, x);
  };
  for (const o of Array.isArray(kayitli) ? kayitli : []) if (o) ekle(Math.round(+o.no), o);
  for (const p of periods || []) if (p && p.status === 'onayli') ekle(Math.round(+p.no), { kontrol: true, hakedis: true });
  return [...m.values()].filter((o) => o.kontrol || o.hakedis || o.gis).sort((a, b) => a.no - b.no);
}

function koseAnahtari(kose) { return (kose || []).map((q) => Math.round(q[0] * 100) + ',' + Math.round(q[1] * 100)).join(';'); }
const noktaAnahtari = (q) => Math.round(q[0] * 100) + ',' + Math.round(q[1] * 100);
const parcaSirasi = (id) => { const m = /-(\d+)$/.exec(String(id || '')); return m ? +m[1] : 0; };
/** Parça kimliğinin kökü: "ULID-2" → "ULID" (parça eki yoksa aynen). */
export const kokKimlik = (id) => String(id || '').replace(/-\d+$/, '');
const hatTanimi = (h) => [h.tur, h.anaKesit, h.durum, h.hakedis].join('\u0001');

/**
 * AutoCAD'den gelen hat parçalarını telefon hatlarına birleştirir. Aynı telefon kimliği (telefonId) ile gelenler bir
 * grup; kimliksiz (eklentide çizilen) parçalar da tanımı aynıysa (tür, kesit, durum, hakediş) ve uç uca ekleniyorsa
 * zincirlenir. Dönen her hat: birleşik köşeler, toplanmış HAT kalemleri, uçlar ve parça listesi
 * ({ id, bas, bit, kose }: parçanın birleşik köşe dizisindeki aralığı).
 */
export function hatlariBirlestir(hatlar) {
  const gruplar = new Map();
  // Telefon kimliği olanlar kimliğin köküyle ("ULID-2" → "ULID") gruplanır; kimliği olmayan bir parça, kimliği bir
  // grubun kökü olan nesneyse (AutoCAD'de bölünen hattın ilk parçası, tanıtıcısı korunmuş) o gruba katılır;
  // diğerleri tanımlarıyla (tür, kesit, durum, hakediş) gruplanıp uç uca zincirlenir.
  const kokler = new Set(hatlar.filter((h) => h.telefonId).map((h) => kokKimlik(h.telefonId)));
  for (const h of hatlar) {
    const g = h.telefonId ? 'T' + kokKimlik(h.telefonId) : kokler.has(h.id) ? 'T' + h.id : 'E' + hatTanimi(h);
    if (!gruplar.has(g)) gruplar.set(g, []);
    gruplar.get(g).push(h);
  }
  const out = [];
  for (const [g, hs] of gruplar) {
    const sirali = hs.slice().sort((a, b) => parcaSirasi(a.id) - parcaSirasi(b.id));
    const kalan = sirali.map((h) => ({ h, kose: (h.kose || []).map((q) => [q[0], q[1]]) })).filter((x) => x.kose.length >= 2);
    while (kalan.length) {
      const zincir = [kalan.shift()];
      let eklendi = true;
      while (eklendi) {
        eklendi = false;
        const bas = noktaAnahtari(zincir[0].kose[0]), bit = noktaAnahtari(zincir[zincir.length - 1].kose.slice(-1)[0]);
        const sonrakiIdx = kalan.findIndex((x) => (g[0] === 'T' || hatTanimi(x.h) === hatTanimi(zincir[0].h)) && noktaAnahtari(x.kose[0]) === bit);
        if (sonrakiIdx >= 0) { zincir.push(kalan.splice(sonrakiIdx, 1)[0]); eklendi = true; continue; }
        const oncekiIdx = kalan.findIndex((x) => (g[0] === 'T' || hatTanimi(x.h) === hatTanimi(zincir[0].h)) && noktaAnahtari(x.kose.slice(-1)[0]) === bas);
        if (oncekiIdx >= 0) { zincir.unshift(kalan.splice(oncekiIdx, 1)[0]); eklendi = true; }
      }
      out.push(zinciriBirlestir(zincir));
    }
  }
  return out;
}
function zinciriBirlestir(zincir) {
  const ilk = zincir[0].h;
  if (zincir.length === 1) return Object.assign({}, ilk, { parcalar: [{ id: ilk.id, bas: 0, bit: (ilk.kose || []).length - 1, kose: ilk.kose }] });
  const kose = [], parcalar = [], kalemler = [], araUclar = {};
  const uclar = [(ilk.uclar || [])[0] || '', ''];
  for (const { h, kose: k } of zincir) {
    const bas = kose.length ? kose.length - 1 : 0;
    for (let i = kose.length ? 1 : 0; i < k.length; i++) kose.push(k[i]);
    parcalar.push({ id: h.id, bas, bit: kose.length - 1, kose: h.kose });
    if (h.uclar) { if (h.uclar[0]) araUclar[bas] = h.uclar[0]; if (h.uclar[1]) araUclar[kose.length - 1] = h.uclar[1]; uclar[1] = h.uclar[1] || uclar[1]; }
    for (const kl of h.kalemler || []) {
      const ayni = kl.kaynak === 'HAT' ? kalemler.find((x) => x.kaynak === 'HAT' && x.cins === kl.cins && x.tanim === kl.tanim && x.durum === kl.durum) : null;
      if (ayni) { ayni.miktar = Math.round((ayni.miktar + kl.miktar) * 100) / 100; SH.kalemToplami(ayni); }
      else kalemler.push(Object.assign({}, kl));
    }
  }
  const toplam = zincir.reduce((a, x) => a + (x.h.cizimUzunlugu || SH.uzunluk(x.h.kose)), 0);
  return Object.assign({}, ilk, { kose, kalemler, uclar, araUclar, parcalar, cizimUzunlugu: Math.round(toplam * 1000) / 1000, parca: undefined });
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
 * AutoCAD alanları (cins, tanım, birim, katsayı, tarife) kalemde saklanır ve dışa aktarımda aynen döner.
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
/** AutoCAD birimi → telefon birimi (giriş birimi). */
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
    source: 'AutoCAD dosyasından (eklenti kalemi)', verified: false, isKgGroup: false, userAdded: true,
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
  const full = { format: VOLT_BICIM, exportedAt: new Date().toISOString(), app: 'Şebeke-M', standard: ps.cat.std, project: ps.p, data: {} };
  for (const s of ['points', 'equipment', 'lines', 'materials', 'photos', 'periods', 'workPrograms', 'stakeouts', 'revisions', 'surveySessions', 'gnssObservations', 'documents']) full.data[s] = ps.data[s] || [];
  full.derived = { spans: ps.result.spans, quantities: ps.result.quantities, issues: ps.result.issues, signature: ps.result.signature };
  full.sebeke = JSON.parse(sebekeYaz(ps, opts));
  return full;
}

export { SH };
