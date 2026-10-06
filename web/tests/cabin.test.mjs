// Beton köşk / trafo binası yerleşim modeli (src/grid/cabin.js) — özgün tek dosyalık araca karşı altın testler.
// tests/ref/kabin_ref.html varsa özgün betik node:vm içinde sahte bir DOM ile çalıştırılır; her durum için özgün
// layout() / checks() / weights() / addHucre() ... sonuçları (hücre konumları özgün 3B sahnesinden) port ile birebir
// karşılaştırılır. Referans dosya yoksa bu testler atlanır; sabit değerli testler her zaman çalışır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as kabin from '../src/grid/cabin.js';

const {
  KOSK, VARYANT, KAPI_TABLO, PKOSK, BINA, HUCRE_SERI, HD, HH, TRAFO, TRAFO_OLCU, PANO, VARSAYILAN_DIMS,
  varsayilanKabin, kabinTipleri, gucListesi, hucreRec, hucreListesi, trafoKorumaMi, kesiciliKorumaMi, hucreIslev,
  yerlesim, kontroller, agirliklar, etkinDims, projeDonanimi, panoIcinKva,
  hucreEkle, hucreSil, hucreKopyala, hucreTasi, hucreDegistir, hucreAyar, kabinDegistir, kanalEkle, kanalSil, planSekilleri,
} = kabin;

// KABIN_REF ortam değişkeni başka bir referans kopyasını gösterebilir (yoksa altın testler atlanır)
const REF_YOL = process.env.KABIN_REF ? pathToFileURL(path.resolve(process.env.KABIN_REF)) : new URL('./ref/kabin_ref.html', import.meta.url);
const MOD_YOL = new URL('../src/grid/cabin.js', import.meta.url);
const REF_VAR = fs.existsSync(REF_YOL);
const refTest = (ad, fn) => (REF_VAR ? test(ad, fn) : test.skip(ad + ' (referans dosya yok)', fn));

/* ------------------------------------------------------------------
   Özgün betiği sahte DOM ile yükleyen düzenek
   ------------------------------------------------------------------ */
function refYukle() {
  const html = fs.readFileSync(REF_YOL, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'referans dosyada betik bulunamadı');
  const noop = () => {};
  // tuval bağlamı: her yöntem boş işlev; yazı ölçümü sabit oranlı
  const ctx2d = new Proxy({}, {
    get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : (k in t ? t[k] : noop)),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const els = new Map();
  const stub = (id) => ({
    id, value: '', checked: false, disabled: false, innerHTML: '', textContent: '', className: '', title: '', style: {}, dataset: {},
    clientWidth: 800, clientHeight: 600, width: 0, height: 0, scrollLeft: 0, scrollTop: 0, offsetWidth: 100, offsetHeight: 100,
    classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
    appendChild: noop, remove: noop, click: noop, focus: noop, select: noop, setAttribute: noop, getAttribute: () => null,
    addEventListener: noop, removeEventListener: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => null, querySelectorAll: () => [], getContext: () => ctx2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  });
  const el = (id) => { if (!els.has(id)) els.set(id, stub(id)); return els.get(id); };
  const document = {
    body: stub('body'), documentElement: stub('html'), head: stub('head'), activeElement: null,
    getElementById: (id) => el(id), querySelector: () => null, querySelectorAll: () => [],
    createElement: () => stub(), createElementNS: () => stub(), addEventListener: noop, removeEventListener: noop,
  };
  const sandbox = {
    document, console, addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false }),
    innerWidth: 1400, innerHeight: 900, setTimeout: () => 0, clearTimeout: noop, confirm: () => true, alert: noop,
    getComputedStyle: () => ({}), URL: { createObjectURL: () => '', revokeObjectURL: noop }, Blob: function Blob() {},
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(m[1], ctx, { filename: 'kabin_ref.js' });

  // Özgün işlevleri çağıran ve sonuçları JSON olarak dışarı veren köprü (betiğin kendi kapsamında çalışır)
  vm.runInContext(`
  globalThis.__ref = (() => {
    const temiz = (s) => String(s == null ? '' : s).replace(/<span[^>]*>✕<\\/span>/g, '').replace(/<br\\s*\\/?>/g, ' ').replace(/<\\/?(?:b|small|span|em|i)\\b[^>]*>/g, '');
    const panoEsle = () => { const P = panoRec(); S.panoTip = P[0]; S.panoKg = P[4]; };   // buildUI'nin yaptığı
    const uyariAl = () => temiz(document.getElementById('uyari').innerHTML);
    const uyariSil = () => { document.getElementById('uyari').innerHTML = ''; };
    const ozet = () => JSON.stringify({ kosk: S.kosk, varyant: S.varyant, trafoKva: S.trafoKva, trafoKg: S.trafoKg, trafoAdet: S.trafoAdet, hucreSeri: S.hucreSeri, hucreler: S.hucreler, dims: S.dims });
    return {
      sifirla() { HIST_KILIT = true; _yukle(HIST_ILK); HIST_KILIT = false; VIEW = '3d'; applyGeo(S.kosk); },
      kur(j) {
        const st = JSON.parse(j);
        this.sifirla();
        S.kosk = st.kosk; S.varyant = st.varyant; S.trafoKva = st.trafoKva;
        if (st.trafoAdet == null) delete S.trafoAdet; else S.trafoAdet = st.trafoAdet;
        S.hucreSeri = st.hucreSeri; S.hucreler = st.hucreler; S.dims = st.dims; S.anmaGuc = ''; S.tipKodu = '';
        S.trafoKg = st.trafoKg != null ? st.trafoKg : trafoRec()[1];
        applyGeo(S.kosk); panoEsle();
      },
      tablolar() { return JSON.stringify({ KOSK, VARYANT, KAPI_TABLO, PKOSK, BINA, HUCRE_ULUSOY, HUCRE_EVA, HUCRE_EVAP, HD, HH, TRAFO, TRAFO_OLCU, PANO,
        seriAd: Object.fromEntries(Object.keys(HUCRE_SERI).map((k) => [k, HUCRE_SERI[k].ad])) }); },
      olc() {
        const L = layout(), D = S.dims;
        buildScene();
        const HB = L.disBoy, HE = D.en;
        const kutu = () => ({ x0: 1e18, x1: -1e18, z0: 1e18, z1: -1e18 });
        const buyut = (r, f) => { for (const p of f.pts) { r.x0 = Math.min(r.x0, p[0]); r.x1 = Math.max(r.x1, p[0]); r.z0 = Math.min(r.z0, p[2]); r.z1 = Math.max(r.z1, p[2]); } };
        // hücre gövdeleri: özgün 3B sahnesindeki kutulardan (gövde genişliği = w − 14)
        const hm = new Map();
        for (const f of faces) { if (f.tag !== 'hucre' || !f.hucreSlot) continue;
          const i = S.hucreler.indexOf(f.hucreSlot); let r = hm.get(i); if (!r) { r = kutu(); r.renk = f.color; hm.set(i, r); } buyut(r, f); }
        const hucreler = [...hm.entries()].sort((a, b) => a[0] - b[0]).map(([i, r]) => ({ i, x0: r.x0 + HB / 2 - 7, x1: r.x1 + HB / 2 + 7, z0: r.z0 + HE / 2, z1: r.z1 + HE / 2, sigar: r.renk === '#dcdedd' }));
        // kanal tabanları (bina: #5d6165) ve prefabrik kapaklı kablo bölmeleri (#4a4d50): ardışık 6 yüz = 1 kutu
        const kutular = (renk) => { const fs2 = faces.filter((f) => f.tag === 'kanal' && f.color === renk), out = [];
          for (let q = 0; q + 6 <= fs2.length; q += 6) { const r = kutu(); for (let k = 0; k < 6; k++) buyut(r, fs2[q + k]); out.push({ x0: r.x0 + HB / 2, x1: r.x1 + HB / 2, z0: r.z0 + HE / 2, z1: r.z1 + HE / 2 }); }
          return out; };
        const kapakSay = faces.filter((f) => f.tag === 'kanal' && f.color === '#8d9095').length / 6;
        let kapilar;
        if (L.bina || L.pref) kapilar = L.kapi;
        else kapilar = { h: L.hasHucre ? kapiYerlesimi(L.ygX[0], L.ygLen, 'hucre') : [], t: L.hasT ? kapiYerlesimi(L.trX[0], L.trafoBol, 'trafo') : [] };
        const W = weights();
        return JSON.stringify({
          L: { disBoy: L.disBoy, disEn: L.disEn, icEn: L.icEn, icBoy: L.icBoy, disYuk: L.disYuk, hasT: !!L.hasT, hasAG: !!L.hasAG, hasHucre: !!L.hasHucre,
            kullan: L.kullan, hucreW: L.hucreW, kalan: L.kalan, koridor: L.koridor, yanBos: L.yanBos, arkaBos: L.arkaBos || D.arka,
            hucX: L.hucX, hucXOn: L.hucXOn || null, arka: L.arka || null, on: L.on || null, ygX: L.ygX, trX: L.trX, agX: L.agX,
            trB: L.trB || null, trAkt: L.trAkt || null, agPanolar: L.agPanolar || null, bolmeX: L.bolmeX || null,
            sira1Net: L.sira1Net, sira2Net: L.sira2Net, sira1W: L.sira1W, sira2W: L.sira2W, arkaNet: L.arkaNet, onNet: L.onNet, arkaW: L.arkaW, onW: L.onW, hucNet: L.hucNet,
            kanal: L.kanal || null, pref: !!L.pref, bina: !!L.bina, trafoXc: L.trafoXc, trafoZc: L.trafoZc },
          hucreler, kapilar, kanalTaban: kutular('#5d6165'), prefBolme: kutular('#4a4d50'), kapakSay,
          bos: bosSeritler(L).map((b) => ({ x0: b.x0, x1: b.x1, sira: b.sira })),
          kontroller: checks().map((c) => ({ st: c.st, txt: temiz(c.txt), sub: temiz(c.sub) })),
          agirlik: { satirlar: W.rows.map((r) => ({ ad: r[0], kg: r[1] })), toplam: W.tot },
          tipKodu: tipKoduAuto(), tipSinifi: tipSinifi(L.disBoy), guc: gucListesi(S.varyant).map((t) => t[0]), pano: panoRec(),
          gabari: trafoGabari(S.trafoKva), agKablo: agKablo(S.trafoKva), ray: rayAcikligi(S.trafoKva),
        });
      },
      ozet,
      ekle(code) { document.getElementById('hucreSel').value = code; uyariSil(); addHucre(); return JSON.stringify({ msg: uyariAl(), h: S.hucreler }); },
      kopyala(i) { uyariSil(); kopyalaHucre(i); return JSON.stringify({ msg: uyariAl(), h: S.hucreler }); },
      tasi(i, d) { mvHucre(i, d); return JSON.stringify({ h: S.hucreler }); },
      sil(i) { delHucre(i); return JSON.stringify({ h: S.hucreler }); },
      degistir(i, code) { S.hucreler[i].c = code; refresh(); return JSON.stringify({ h: S.hucreler }); },   // hucreDegMenu satır tıklaması
      sinif(s) { setSinif(s); return ozet(); },
      kosk(k) { setKosk(k); return ozet(); },
      varyant(v) { setVaryant(v); return ozet(); },
      trafo(k) { S.trafoKva = k; S.trafoKg = trafoRec()[1]; refresh(); return ozet(); },                    // onTrafo
      adet(n) { S.trafoAdet = n; refresh(); return ozet(); },
    };
  })();`, ctx, { filename: 'kabin_kopru.js' });
  const R = ctx.__ref;
  const J = (s) => JSON.parse(s);
  return {
    tablolar: () => J(R.tablolar()),
    sifirla: () => R.sifirla(),
    kur: (cabin) => R.kur(JSON.stringify({ kosk: cabin.kosk, varyant: cabin.varyant, trafoKva: cabin.trafoKva, trafoAdet: cabin.trafoAdet, trafoKg: cabin.trafoKg,
      hucreSeri: cabin.hucreSeri, hucreler: cabin.hucreler, dims: etkinDims(cabin) })),
    olc: () => J(R.olc()),
    ozet: () => J(R.ozet()),
    ekle: (c) => J(R.ekle(c)), kopyala: (i) => J(R.kopyala(i)), tasi: (i, d) => J(R.tasi(i, d)), sil: (i) => J(R.sil(i)), degistir: (i, c) => J(R.degistir(i, c)),
    sinif: (s) => J(R.sinif(s)), kosk: (k) => J(R.kosk(k)), varyant: (v) => J(R.varyant(v)), trafo: (k) => J(R.trafo(k)), adet: (n) => J(R.adet(n)),
  };
}
let REF = null;
const ref = () => (REF || (REF = refYukle()));

/* ------------------------------------------------------------------
   Durum üreticileri
   ------------------------------------------------------------------ */
const H = (c, ek = {}) => ({ c, f: '', y: 'c', ...ek });
function hucreListeleri(sinif, kosk) {
  const vars = sinif === 'bina' ? projeDonanimi(kosk) : [H('HMH 36-01', { f: 'GİRİŞ FİDERİ', y: 'g' }), H('HMH 36-04T', { f: 'TRAFO KORUMA H.' })];
  const desen = ['HMH 36-04', 'HMH 36-05', 'HMH 36-08', 'eva-36-DB', 'HMH 36-01', 'HMH 36-14'];
  const tasan = (adet) => Array.from({ length: adet }, (_, i) => H(desen[i % desen.length], { f: 'F' + (i + 1) }));
  return {
    varsayilan: vars,
    bos: [],
    tasan: tasan(sinif === 'mono' ? 7 : sinif === 'pref' ? 14 : 28),
    azTasan: tasan(sinif === 'mono' ? 3 : sinif === 'pref' ? 6 : 11),
    karisik: [H('HMH 36-01', { f: 'Giriş', y: 'g' }), H('eva-36-F', { f: 'Trafo' }), H('eva+-36-B'), H('YEDEK 1', { y: 'x' }), H('HMH 36-08', { f: 'Ölçü' })],
    zorunlu: [H('HMH 36-01', { s: '2', y: 'g' }), H('HMH 36-04', { s: '1' }), H('HMH 36-02', { s: '2' }), H('HMH 36-04T'), H('HMH 36-05', { s: '2' }), H('HMH 36-04'), H('eva+-36-CB', { s: '1' })],
    korumasiz: [H('HMH 36-01', { y: 'g' }), H('HMH 36-04')],
    tek: [H('HMH 36-02', { f: 'TRAFO' })],
    ikiKoruma: [H('HMH 36-01', { y: 'g' }), H('HMH 36-08'), H('HMH 36-04T'), H('HMH 36-04T')],
    sigortali: [H('HMH 36-06', { y: 'g' }), H('HMH 36-02')],
  };
}
const DIMS_FARK = [{ arka: 50, yan: 150 }, { arka: 200, yan: 50, h: 2600, t: 660 }, { h: 2500, t: 600, arka: 0 }];
function* durumlar(sinif) {
  const tipler = kabinTipleri(sinif);
  for (const tip of tipler) for (const v of tip.varyantlar) {
    const kvaL = sinif === 'mono' ? (v.key === '1600' ? [1250, 1600, 630] : v.key === 'KOK' ? [630] : [100, 630, 1000, 1600]) : sinif === 'pref' ? [400, 1000, 1600, 2500] : [630, 1000, 1600, 2500];
    const adetL = (sinif === 'pref' && PKOSK[tip.kosk].tr.length > 1) ? [undefined, 1, 2] : [undefined];
    const listeler = hucreListeleri(sinif, tip.kosk);
    for (const trafoAdet of adetL) for (const [lad, hucreler] of Object.entries(listeler)) for (const trafoKva of kvaL) {
      const c = { sinif, kosk: tip.kosk, varyant: v.key, trafoKva, hucreSeri: 'ULUSOY', hucreler: hucreler.map((o) => ({ ...o })) };
      if (trafoAdet) c.trafoAdet = trafoAdet;
      yield { ad: `${tip.kosk}/${v.key}/${trafoKva}kVA/adet=${trafoAdet || '-'}/${lad}`, cabin: c };
      if ((lad === 'varsayilan' || lad === 'karisik' || lad === 'zorunlu') && trafoKva === kvaL[0]) {
        for (const d of DIMS_FARK) yield { ad: `${tip.kosk}/${v.key}/${trafoKva}kVA/adet=${trafoAdet || '-'}/${lad}/dims=${JSON.stringify(d)}`, cabin: { ...c, dims: d } };
      }
    }
  }
}

/** Bir kabin için port ↔ özgün tam karşılaştırma */
function karsilastir(cabin, ad) {
  const R = ref();
  R.kur(cabin);
  const o = R.olc(), Y = yerlesim(cabin), L = o.L;
  const de = (a, b, ne) => assert.deepEqual(a, b, `${ad}: ${ne}`);
  for (const k of ['disBoy', 'disEn', 'icEn', 'icBoy', 'disYuk', 'hasT', 'hasAG', 'hasHucre', 'kullan', 'hucreW', 'kalan', 'koridor', 'yanBos', 'arkaBos']) de(Y[k], L[k], k);
  // sıra ataması + kapasiteler
  const cift = !!L.hucXOn;
  if (Y.hasHucre) {
    const arka = Y.siralar.find((s) => s.ad === 'arka'), on = Y.siralar.find((s) => s.ad === 'on');
    de([arka.x0, arka.x1], L.hucX, 'arka sıra şeridi');
    if (cift) {
      de([on.x0, on.x1], L.hucXOn, 'ön sıra şeridi');
      de(Y.hucreler.filter((h) => h.sira === 'arka').map((h) => h.i), L.arka, 'arka sıra hücreleri');
      de(Y.hucreler.filter((h) => h.sira === 'on').map((h) => h.i), L.on, 'ön sıra hücreleri');
      de([arka.net, arka.dolu, on.net, on.dolu], L.bina ? [L.sira1Net, L.sira1W, L.sira2Net, L.sira2W] : [L.arkaNet, L.arkaW, L.onNet, L.onW], 'sıra kapasiteleri');
    } else {
      assert.equal(on, undefined, `${ad}: tek sırada ön sıra olmamalı`);
      de(Y.hucreler.every((h) => h.sira === 'arka'), true, 'tek sıra');
      de([arka.net, arka.dolu], [L.bina ? L.sira1Net : (L.pref ? L.hucNet : L.kullan), L.hucreW], 'sıra kapasitesi');
    }
  } else de(Y.siralar, [], 'hücre bölümü yokken sıra yok');
  // hücre konumları — özgün 3B sahnesindeki gövde kutularından
  de(Y.hucreler.filter((h) => h.x0 != null).map((h) => ({ i: h.i, x0: h.x0, x1: h.x1, z0: h.z0, z1: h.z1, sigar: h.sigar })), o.hucreler, 'hücre konumları');
  for (const h of Y.hucreler) { const r = hucreRec(h.c); de([h.w, h.kg, h.ad], [r[2], r[3], r[1]], 'hücre kataloğu'); }
  // bölümler
  if (L.bina) de(Y.trafo.map((t) => [t.xc, t.zc]), [[L.trafoXc, L.trafoZc]], 'trafo merkezi');
  else if (L.pref) {
    de(Y.bolmeler.filter((b) => b.ad === 'trafo').map((b) => [b.x0, b.x1]), L.trB, 'trafo bölmeleri');
    de(Y.bolmeler.filter((b) => b.ad === 'trafo' && b.aktif).map((b) => [b.x0, b.x1]), L.trAkt, 'aktif trafo bölmeleri');
    de(Y.trafo.filter((t) => t.aktif).length, L.trAkt.length, 'aktif trafo adedi');
    de(Y.bolmeler.filter((b) => b.ad === 'hucre').map((b) => [b.x0, b.x1]), [L.ygX], 'YG mahali');
    de(Y.bolmeDuvar.map((b) => b.x0), L.bolmeX, 'betopan bölmeler');
    de(Y.pano.map((p) => p.yuva), L.agPanolar.map((a) => ({ x0: a.x0, x1: a.x0 + a.w, z0: a.z0, z1: a.z0 + a.d })), 'AG pano yuvaları');
  } else {
    de(Y.bolmeler, [L.hasHucre && { ad: 'hucre', x0: L.ygX[0], x1: L.ygX[1] }, L.hasT && { ad: 'trafo', x0: L.trX[0], x1: L.trX[1] }, L.hasAG && { ad: 'ag', x0: L.agX[0], x1: L.agX[1] }].filter(Boolean), 'bölümler');
    de(Y.pano.length, L.hasAG ? 1 : 0, 'AG pano adedi');
  }
  de([Y.trafo.every((t) => t.U === o.gabari.U && t.G === o.gabari.G), Y.pano.every((p) => p.ad === o.pano[0] && p.gen === o.pano[1] && p.der === o.pano[3])], [true, true], 'trafo gabarisi / pano tipi');
  // kapılar
  if (L.bina) de(Y.kapilar.map((k) => ({ ad: k.ad, x0: k.x0, w: k.w, h: k.h, oda: k.tip === 'trafo' ? 'trafo' : 'salon', panjur: k.panjur, merd: k.merd })), o.kapilar, 'kapılar');
  else if (L.pref) de(Y.kapilar.map((k) => ({ x0: k.x0, w: k.w, tip: k.tip === 'hucre' ? 'h' : 't' })), o.kapilar.map((k) => ({ x0: k.x0, w: k.w, tip: k.tip.charAt(0) })), 'kapılar');
  else {
    de(Y.kapilar.filter((k) => k.tip === 'hucre').map((k) => ({ c: k.x0 + k.w / 2, w: k.w })), o.kapilar.h, 'hücre kapıları');
    de(Y.kapilar.filter((k) => k.tip === 'trafo').map((k) => ({ c: k.x0 + k.w / 2, w: k.w })), o.kapilar.t, 'trafo kapıları');
    de(Y.kapilar.filter((k) => k.tip === 'ag').length, L.hasAG ? 1 : 0, 'AG kapısı');
  }
  // kanallar — özgün 3B sahnesindeki kanal kutularından
  const dikd = (k) => ({ x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1 });
  if (L.bina) {
    de(Y.kanallar.map(dikd), o.kanalTaban, 'bina kanalları (AG pano kanalı panoya hizalı)');
    de(Y.kanallar.map((k) => k.katalog || dikd(k)), L.kanal.map(dikd), 'bina kanal kataloğu');
    de(Y.kanallar.reduce((a, k) => a + k.kapakAdet, 0), o.kapakSay, 'kapak adedi');
    de(Y.kanallar.map((k) => [k.der, k.kaynak, k.boy, k.gen]), Y.kanallar.map((k) => [700, 'bina', Math.max(k.x1 - k.x0, k.z1 - k.z0), Math.min(k.x1 - k.x0, k.z1 - k.z0)]), 'kanal ölçüleri');
  } else if (L.pref) {
    const aktif = o.prefBolme.filter((r) => L.trAkt.some((t) => (r.x0 + r.x1) / 2 > t[0] && (r.x0 + r.x1) / 2 < t[1]));
    de(Y.kanallar.map(dikd), aktif, 'prefabrik kapaklı kablo bölmeleri (aktif bölmeler)');
    if (L.trB.length) de(Y.kanallar.map((k) => k.kapakAdet), Y.kanallar.map(() => o.kapakSay / L.trB.length), 'kapak adedi');
    de(o.prefBolme.length, L.trB.length, 'özgün: her trafo bölmesinde bir kablo bölmesi');
  } else de(Y.kanallar, [], 'monoblokta kanal yok');
  de(Y.rezerv.map((b) => ({ x0: b.x0, x1: b.x1, sira: b.sira === 'on' ? 2 : 1 })), o.bos, 'boş şeritler');
  // kontroller, ağırlıklar, tip kodu, güç listesi
  de(kontroller(cabin), o.kontroller, 'kontroller');
  de(agirliklar(cabin), o.agirlik, 'ağırlıklar');
  de(Y.tipKodu, o.tipKodu, 'tip kodu');
  if (!L.bina && !L.pref) de(Y.tipSinifi, o.tipSinifi, 'tip sınıfı'); else de(Y.tipSinifi, null, 'tip sınıfı');
  de(gucListesi(cabin), o.guc, 'güç listesi');
  de([kabin.agKablo(cabin.trafoKva), kabin.rayAcikligi(cabin.trafoKva), kabin.trafoGabari(cabin.trafoKva)], [o.agKablo, o.ray, o.gabari], 'AG kablosu / ray açıklığı / gabari');
  return { o, Y };
}

/* ------------------------------------------------------------------
   Altın testler (referans gerekir)
   ------------------------------------------------------------------ */
refTest('altın: katalog tabloları özgün araçla aynı', () => {
  const t = ref().tablolar();
  const j = (x) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(j(KOSK), t.KOSK);
  assert.deepEqual(Object.fromEntries(Object.entries(KOSK).map(([k, v]) => [k, Object.keys(v.v)])), Object.fromEntries(Object.entries(t.KOSK).map(([k, v]) => [k, Object.keys(v.v)])), 'varyant anahtar sırası');
  assert.deepEqual(j(VARYANT), t.VARYANT);
  assert.deepEqual(j(KAPI_TABLO), t.KAPI_TABLO);
  assert.deepEqual(j(PKOSK), t.PKOSK);
  assert.deepEqual(j(BINA), t.BINA);
  assert.deepEqual(j(HUCRE_SERI.ULUSOY.liste), t.HUCRE_ULUSOY);
  assert.deepEqual(j(HUCRE_SERI.EVA.liste), t.HUCRE_EVA);
  assert.deepEqual(j(HUCRE_SERI.EVAP.liste), t.HUCRE_EVAP);
  assert.deepEqual(Object.fromEntries(Object.keys(HUCRE_SERI).map((k) => [k, HUCRE_SERI[k].ad])), t.seriAd);
  assert.deepEqual([HD, HH], [t.HD, t.HH]);
  assert.deepEqual(j(TRAFO), t.TRAFO);
  assert.deepEqual(j(TRAFO_OLCU), t.TRAFO_OLCU);
  assert.deepEqual(j(PANO), t.PANO);
});

let altinSayac = 0;
for (const sinif of ['mono', 'pref', 'bina']) {
  for (const tip of kabinTipleri(sinif)) {
    refTest(`altın: ${sinif} ${tip.kosk} — yerleşim, hücre konumları, kapılar, kanallar, kontroller, ağırlıklar`, () => {
      let say = 0;
      for (const d of durumlar(sinif)) { if (d.cabin.kosk !== tip.kosk) continue; karsilastir(d.cabin, d.ad); say++; }
      assert.ok(say >= 20, `${tip.kosk}: en az 20 durum beklenir (bulunan ${say})`);
      altinSayac += say;
    });
  }
}
refTest('altın: kontrol dalları kapsanıyor (ok / warn / bad her sınıfta görülür)', () => {
  for (const sinif of ['mono', 'pref', 'bina']) {
    const gor = new Set();
    for (const d of durumlar(sinif)) for (const c of kontroller(d.cabin)) gor.add(c.st);
    assert.deepEqual([...gor].sort(), ['bad', 'ok', 'warn'], sinif);
  }
  assert.ok(altinSayac > 1400, 'altın durum sayısı: ' + altinSayac);
});

refTest('altın: sınıf varsayılanları (varsayilanKabin, ölçüler) özgün sınıf geçişiyle aynı', () => {
  const R = ref();
  for (const sinif of ['mono', 'pref', 'bina']) {
    R.sifirla();
    const o = sinif === 'mono' ? R.ozet() : R.sinif(sinif);
    const c = varsayilanKabin(sinif);
    assert.deepEqual({ kosk: c.kosk, varyant: c.varyant, trafoKva: c.trafoKva, hucreler: c.hucreler }, { kosk: o.kosk, varyant: o.varyant, trafoKva: o.trafoKva, hucreler: o.hucreler }, sinif);
    assert.equal(c.sinif, sinif);
    assert.equal(c.sakli, undefined);
    assert.deepEqual(etkinDims(c), o.dims, sinif + ' ölçüleri');
    assert.deepEqual({ ...VARSAYILAN_DIMS[sinif], dw: o.dims.dw, en: o.dims.en }, o.dims, sinif + ' varsayılan ölçüleri');
    // sınıf içinde her tipe geçiş
    for (const tip of kabinTipleri(sinif)) {
      R.sifirla(); if (sinif !== 'mono') R.sinif(sinif);
      const o2 = R.kosk(tip.kosk), c2 = varsayilanKabin(sinif, tip.kosk);
      assert.deepEqual({ kosk: c2.kosk, varyant: c2.varyant, trafoKva: c2.trafoKva, hucreler: c2.hucreler }, { kosk: o2.kosk, varyant: o2.varyant, trafoKva: o2.trafoKva, hucreler: o2.hucreler }, tip.kosk);
      karsilastir(c2, 'varsayılan ' + tip.kosk);
    }
  }
});

refTest('altın: hücre ekleme — reddedilene kadar (ileti eşitliği), kopyalama, taşıma, silme, tip değiştirme', () => {
  const R = ref();
  const kodlar = ['HMH 36-04', 'eva-36-S', 'HMH 36-05', 'HMH 36-08', 'eva+-36-DB', 'YEDEK 2', 'HMH 36-02', 'HMH 36-01'];
  const baslar = [];
  for (const sinif of ['mono', 'pref', 'bina']) for (const tip of kabinTipleri(sinif)) for (const v of tip.varyantlar) {
    baslar.push({ ...varsayilanKabin(sinif, tip.kosk), varyant: v.key, hucreler: [] });
    baslar.push({ ...varsayilanKabin(sinif, tip.kosk), varyant: v.key });
    if (sinif === 'pref' && PKOSK[tip.kosk].tr.length > 1) baslar.push({ ...varsayilanKabin(sinif, tip.kosk), varyant: v.key, trafoAdet: 1, hucreler: [] });
  }
  let redSay = 0, iletiler = new Set();
  const kalipla = (m) => m.replace(/\d+/g, '#').replace(/^\S+( \S+)? (eklenemedi|kopyalanamadı)/, 'X $2');
  for (const bas of baslar) {
    let c = bas; const ad = `${bas.kosk}/${bas.varyant}`;
    R.kur(c);
    // 1) reddedilene kadar ekle (üç ret görülene dek, en çok 60 deneme)
    let red = 0;
    for (let k = 0; k < 60 && red < 3; k++) {
      const code = kodlar[k % kodlar.length];
      const o = R.ekle(code), p = hucreEkle(c, code);
      assert.equal(p.ok, o.msg === '', `${ad}: ekle ${code} kabul/ret`);
      if (p.ok) c = p.cabin; else { assert.equal(p.hata, o.msg, `${ad}: ret iletisi`); red++; redSay++; iletiler.add(kalipla(p.hata)); }
      assert.deepEqual(c.hucreler, o.h, `${ad}: ekle ${code} sonrası liste`);
    }
    assert.equal(red, 3, `${ad}: ret bekleniyordu`);
    // 2) sıra sabitle + kopyala (dolu sırada ret iletisi dâhil)
    if (c.hucreler.length >= 2) {
      for (const [i, s] of [[0, '2'], [1, '1']]) { c = hucreAyar(c, i, { s, f: 'AD' + i, y: 'g' }).cabin; }
      R.kur(c);
      for (const i of [0, 1, c.hucreler.length - 1, 99]) {
        const o = R.kopyala(i), p = hucreKopyala(c, i);
        if (i === 99) { assert.equal(p.ok, false); continue; }
        assert.equal(p.ok, o.msg === '', `${ad}: kopyala ${i}`);
        if (p.ok) c = p.cabin; else { assert.equal(p.hata, o.msg, `${ad}: kopya ret iletisi`); iletiler.add(kalipla(p.hata)); }
        assert.deepEqual(c.hucreler, o.h, `${ad}: kopyala ${i} sonrası`);
      }
    }
    // 3) sil → yer aç → kopyala (kabul), taşı, tip değiştir
    for (let k = 0; k < 3 && c.hucreler.length > 2; k++) { const o = R.sil(1); c = hucreSil(c, 1).cabin; assert.deepEqual(c.hucreler, o.h, `${ad}: sil`); }
    if (c.hucreler.length) {
      const o = R.kopyala(0), p = hucreKopyala(c, 0);
      assert.equal(p.ok, o.msg === '', `${ad}: yer açılınca kopyala`);
      if (p.ok) { c = p.cabin; assert.equal(c.hucreler[1].f, '', 'kopyanın fider adı boş'); } else assert.equal(p.hata, o.msg);
      assert.deepEqual(c.hucreler, o.h);
    }
    for (let i = 0; i < c.hucreler.length; i++) for (const d of [1, -1, -1, 1]) {
      const o = R.tasi(i, d), p = hucreTasi(c, i, d);
      assert.equal(p.ok, true); c = p.cabin;
      assert.deepEqual(c.hucreler, o.h, `${ad}: taşı ${i} ${d}`);
    }
    if (c.hucreler.length) {
      const i = c.hucreler.length - 1;
      const o = R.degistir(i, 'eva-36-CB'), p = hucreDegistir(c, i, 'eva-36-CB');
      c = p.cabin; assert.deepEqual(c.hucreler, o.h, `${ad}: tip değiştir`);
      karsilastir(c, ad + ' düzenleme sonu');
    }
  }
  assert.ok(redSay >= baslar.length * 3);
  // ret iletisi kalıplarının hepsi görülmüş olmalı: tek sıra genel · prefabrik pano hizası · bina · çift sıra
  const kalip = [...iletiler].join('\n');
  for (const p of ['Daha geniş köşk tipi seçin', 'AG pano hizasını geçemez', 'Binada hücre sırası', 'X eklenemedi. Gereken # mm · #. sırada',
    'X kopyalanamadı. Gereken # mm, kalan yer # mm.', 'X kopyalanamadı. Gereken # mm · #. sırada']) assert.ok(kalip.includes(p), 'ileti kalıbı görülmedi: ' + p + '\n' + kalip);
});

refTest('altın: sınıf / tip / varyant geçişleri — hücre listesi özgün araçtaki gibi korunur ya da değişir', () => {
  const R = ref();
  // küçük, tekrarlanabilir rastgele üreteç
  let tohum = 20261006;
  const rnd = () => { tohum = (tohum * 1664525 + 1013904223) >>> 0; return tohum / 4294967296; };
  const sec = (l) => l[Math.floor(rnd() * l.length)];
  const esit = (c, o, ad) => {
    assert.deepEqual({ kosk: c.kosk, varyant: c.varyant, trafoKva: c.trafoKva, trafoAdet: c.trafoAdet, hucreler: c.hucreler },
      { kosk: o.kosk, varyant: o.varyant, trafoKva: o.trafoKva, trafoAdet: o.trafoAdet, hucreler: o.hucreler }, ad);
    // özgün araç binaya ilk geçişte hucreSeri="HMH" yazar (hata); port "ULUSOY" kullanır
    assert.equal(c.hucreSeri, o.hucreSeri === 'HMH' ? 'ULUSOY' : o.hucreSeri, ad + ' hücre serisi');
    assert.equal(c.sinif, BINA[o.kosk] ? 'bina' : PKOSK[o.kosk] ? 'pref' : 'mono', ad + ' sınıf');
  };
  const uygula = (c, adim) => {
    let o, p;
    if (adim.t === 'sinif') { o = R.sinif(adim.v); p = kabinDegistir(c, { sinif: adim.v }); }
    else if (adim.t === 'kosk') { o = R.kosk(adim.v); p = kabinDegistir(c, { kosk: adim.v }); }
    else if (adim.t === 'varyant') { o = R.varyant(adim.v); p = kabinDegistir(c, { varyant: adim.v }); }
    else if (adim.t === 'trafo') { o = R.trafo(adim.v); p = kabinDegistir(c, { trafoKva: adim.v }); }
    else if (adim.t === 'adet') { o = R.adet(adim.v); p = kabinDegistir(c, { trafoAdet: adim.v }); }
    else if (adim.t === 'ekle') { const r = R.ekle(adim.v); p = hucreEkle(c, adim.v); if (!p.ok) { assert.equal(p.hata, r.msg); p = { ok: true, cabin: c }; } else assert.equal(r.msg, ''); o = R.ozet(); }
    else if (adim.t === 'sil') { R.sil(0); p = hucreSil(c, 0); o = R.ozet(); }
    assert.equal(p.ok, true, JSON.stringify(adim) + ' ' + p.hata);
    return { c: p.cabin, o };
  };
  // elle yazılmış diziler: mono→bina→mono (liste geri gelir), bina tipleri arası (proje donanımı), bina→pref→mono (saklama tuhaflığı)
  const diziler = [
    [['sinif', 'pref'], ['sinif', 'mono']],
    [['sinif', 'bina'], ['sinif', 'mono'], ['ekle', 'HMH 36-04'], ['sinif', 'bina'], ['sinif', 'mono']],
    [['kosk', 'MB-6000'], ['varyant', 'KOK'], ['sinif', 'bina'], ['kosk', 'MOD-5A'], ['kosk', 'MOD-5B'], ['sil'], ['sinif', 'pref'], ['sinif', 'mono'], ['sinif', 'bina']],
    [['kosk', 'MB-3200'], ['kosk', 'MB-7500'], ['varyant', '1000'], ['kosk', 'MB-3200'], ['sinif', 'pref'], ['kosk', 'PBK-1C'], ['varyant', 'KOK'], ['kosk', 'PBK-1B'], ['adet', 1], ['varyant', 'PBK'], ['sinif', 'mono'], ['sinif', 'pref']],
    [['sinif', 'pref'], ['trafo', 2500], ['sinif', 'mono'], ['sinif', 'bina'], ['trafo', 2000], ['sinif', 'pref'], ['sinif', 'bina'], ['kosk', 'MOD-5'], ['sinif', 'mono']],
    [['sinif', 'bina'], ['ekle', 'eva-36-S'], ['sinif', 'pref'], ['ekle', 'HMH 36-01'], ['sinif', 'bina'], ['sinif', 'mono'], ['sinif', 'pref'], ['sinif', 'bina']],
  ].map((d) => d.map(([t, v]) => ({ t, v })));
  // rastgele diziler: her adım portun o anki durumuna göre geçerli seçeneklerden seçilir
  for (let q = 0; q < 150; q++) diziler.push(null);
  let adimSay = 0;
  diziler.forEach((dizi, qi) => {
    R.sifirla();
    let c = varsayilanKabin('mono');
    esit(c, R.ozet(), 'başlangıç');
    const izle = [];
    for (let k = 0; k < (dizi ? dizi.length : 14); k++) {
      let adim = dizi && dizi[k];
      if (!adim) {
        const r = rnd();
        if (r < 0.34) adim = { t: 'sinif', v: sec(['mono', 'pref', 'bina']) };
        else if (r < 0.56) adim = { t: 'kosk', v: sec(kabinTipleri(c.sinif)).kosk };
        else if (r < 0.72) adim = { t: 'varyant', v: sec(kabinTipleri(c.sinif).find((t) => t.kosk === c.kosk).varyantlar).key };
        else if (r < 0.80) { const gl = gucListesi(c); adim = gl.length ? { t: 'trafo', v: sec(gl) } : { t: 'sil' }; }
        else if (r < 0.84) adim = { t: 'adet', v: sec([1, 2]) };
        else if (r < 0.95) adim = { t: 'ekle', v: sec(['HMH 36-04', 'HMH 36-02', 'eva-36-CB', 'HMH 36-08', 'eva+-36-S']) };
        else adim = { t: 'sil' };
        if (adim.t === 'sil' && !c.hucreler.length) adim = { t: 'ekle', v: 'HMH 36-01' };
      }
      izle.push(adim.t + ':' + adim.v);
      const r = uygula(c, adim); c = r.c;
      esit(c, r.o, `dizi ${qi} [${izle.join(' → ')}]`);
      adimSay++;
    }
    // dizinin sonunda yerleşim de aynı olmalı (ölçüler sınıf varsayılanı; özgün aracın ölçü sızıntısı taşınmadı)
    R.kur(c); const o = R.olc(), Y = yerlesim(c);
    assert.deepEqual([Y.kullan, Y.hucreW, Y.kalan, Y.koridor], [o.L.kullan, o.L.hucreW, o.L.kalan, o.L.koridor], `dizi ${qi} sonu`);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(c)));
  });
  assert.ok(adimSay > 2000);
});

/* ------------------------------------------------------------------
   Sabit değerli testler (referans gerekmez)
   ------------------------------------------------------------------ */
test('sabit: MB-4800 / 1000 varsayılan — kullan, kalan, koridor, bölümler, kapılar', () => {
  const c = varsayilanKabin('mono');
  assert.deepEqual(c, { sinif: 'mono', kosk: 'MB-4800', varyant: '1000', trafoKva: 630, hucreSeri: 'ULUSOY',
    hucreler: [{ c: 'HMH 36-01', f: 'GİRİŞ FİDERİ', y: 'g' }, { c: 'HMH 36-04T', f: 'TRAFO KORUMA H.', y: 'c' }] });
  const Y = yerlesim(c);
  assert.deepEqual([Y.disBoy, Y.disEn, Y.icEn, Y.duvar], [4800, 2500, 2280, 110]);
  assert.deepEqual([Y.kullan, Y.hucreW, Y.kalan, Y.koridor, Y.yanBos, Y.arkaBos], [2030, 1750, 280, 530, 100, 100]);
  assert.deepEqual(Y.bolmeler, [{ ad: 'hucre', x0: 110, x1: 2340 }, { ad: 'trafo', x0: 2380, x1: 4080 }, { ad: 'ag', x0: 4120, x1: 4690 }]);
  assert.deepEqual(Y.hucreler.map((h) => [h.c, h.x0, h.x1, h.z0, h.z1, h.sira, h.sigar]),
    [['HMH 36-01', 210, 960, 210, 1860, 'arka', true], ['HMH 36-04T', 960, 1960, 210, 1860, 'arka', true]]);
  assert.deepEqual(Y.kapilar.map((k) => [k.tip, k.x0, k.w, k.duvar]), [['hucre', 475, 1500, 'on'], ['trafo', 2480, 1500, 'on'], ['ag', 330, 1840, 'sag']]);
  assert.deepEqual(Y.trafo, [{ kva: 630, xc: 3230, zc: 1250, U: 1435, G: 965, aktif: true }]);
  assert.deepEqual([Y.tipSinifi, Y.tipKodu], ['TİP-1A (≤5500)', 'MB-4800 / BK-TIP1A_630(hd)']);
  assert.deepEqual(Y.kanallar, []);
  // monoblokta koridor kontrolü varsayılan ölçülerle "bad" çıkar (özgün davranış, bilerek korunur)
  const k = kontroller(c).find((x) => x.txt.startsWith('Çalışma koridoru'));
  assert.deepEqual([k.st, k.txt], ['bad', 'Çalışma koridoru (e): 530 mm < 800 mm']);
  assert.deepEqual(agirliklar(c), { satirlar: [{ ad: 'Köşk boş ağırlığı (MB-4800, yaklaşık)', kg: 14150 }, { ad: 'YG hücreleri (2 ad.)', kg: 1300 },
    { ad: 'Trafo (630 kVA)', kg: 2410 }, { ad: 'AG pano (630-800-1000 kVA)', kg: 560 }], toplam: 18420 });
});

test('sabit: MOD-5 varsayılan — hücre sırası 7500 mm ve üç kanal', () => {
  const c = varsayilanKabin('bina');
  assert.deepEqual([c.kosk, c.varyant, c.trafoKva, c.hucreSeri, c.hucreler.length], ['MOD-5', 'BINA', 1000, 'ULUSOY', 8]);
  assert.deepEqual(c.hucreler.map((h) => h.c), ['HMH 36-01', ...Array(6).fill('HMH 36-04'), 'HMH 36-02']);
  const Y = yerlesim(c);
  assert.deepEqual([Y.disBoy, Y.disEn, Y.hucreW, Y.kullan, Y.kalan, Y.koridor, Y.arkaBos], [8550, 6870, 7500, 7500, 0, 4740, 100]);
  assert.deepEqual(Y.siralar, [{ ad: 'arka', x0: 560, x1: 8060, net: 7500, dolu: 7500 }]);   // sıra köşe kolonu yüzünden 760 yerine 560'tan başlar
  assert.ok(Y.hucreler.every((h) => h.sigar));
  assert.deepEqual(Y.kanallar.map((k) => [k.ad, k.boy, k.gen, k.der, k.kapakli, k.kaynak]), [
    ['hücre kanalı', 7480, 1000, 700, true, 'bina'], ['bağlantı kanalı', 4315, 500, 700, false, 'bina'], ['AG pano kanalı', 1220, 170, 700, true, 'bina']]);
  // AG pano kanalının katalog (mimari proje) dikdörtgeni 500×1960; 3B koddaki gibi panonun altına (pano − 2×140) hizalanır
  assert.deepEqual(Y.kanallar[2].katalog, { x0: 4170, x1: 4670, z0: 4680, z1: 6640 });
  assert.deepEqual([Y.kanallar[2].x0, Y.kanallar[2].x1, Y.kanallar[2].z0, Y.kanallar[2].z1], [4335, 4505, 4617, 5837]);
  // 400 kVA → 1150 mm pano → kanal 870×170
  const Y4 = yerlesim({ ...c, trafoKva: 400 });
  assert.deepEqual([Y4.kanallar[2].boy, Y4.kanallar[2].gen], [870, 170]);
  // MOD-5A/5B: ara kolonlar sıranın içinde → sırt boşluğu 300 mm
  const YA = yerlesim(varsayilanKabin('bina', 'MOD-5A'));
  assert.deepEqual([YA.hucreW, YA.arkaBos, YA.koridor, YA.siralar.map((s) => s.net)], [11500, 300, 4540, [12000, 6290]]);
});

test('sabit: PBK-1C kapasiteleri 7860 + 3800, PBK-1A / 1B pano hizası sınırları', () => {
  const Y = yerlesim(varsayilanKabin('pref', 'PBK-1C'));
  assert.deepEqual(Y.siralar.map((s) => [s.ad, s.net]), [['arka', 7860], ['on', 3800]]);
  assert.deepEqual([Y.kullan, Y.koridor, Y.icEn], [11660, 1300, 4800]);
  assert.deepEqual(Y.kanallar.map((k) => [k.ad, k.x0, k.x1, k.z0, k.z1, k.boy, k.gen, k.der, k.kapakli, k.kapakAdet, k.kaynak]),
    [['kapaklı kablo bölmesi', 8380, 10520, 250, 880, 2140, 630, 800, true, 3, 'pref']]);
  assert.equal(yerlesim(varsayilanKabin('pref', 'PBK-1A')).kullan, 3210);
  const b = varsayilanKabin('pref', 'PBK-1B');
  assert.deepEqual([yerlesim(b).kullan, yerlesim({ ...b, trafoAdet: 1 }).kullan, yerlesim({ ...b, varyant: 'KOK' }).kullan], [3500, 4150, 9880]);
  assert.deepEqual(yerlesim({ ...b, trafoAdet: 1 }).trafo.map((t) => t.aktif), [false, true]);   // tek trafoda sağdaki bölme aktif
  assert.equal(yerlesim({ ...b, trafoAdet: 1 }).kanallar.length, 1);
  assert.equal(yerlesim({ ...b, varyant: 'KOK' }).kanallar.length, 0);
  // çift sıra: sabitlenen hücre karşı sıraya gider, 180° dönük sıra kapı duvarına dayanır
  const c = { ...varsayilanKabin('pref', 'PBK-1C'), hucreler: [{ c: 'HMH 36-01', f: '', y: 'g', s: '2' }, { c: 'HMH 36-04T', f: '', y: 'c' }] };
  assert.deepEqual(yerlesim(c).hucreler.map((h) => [h.sira, h.x0, h.z0, h.z1]), [['on', 200, 3150, 4800], ['arka', 200, 200, 1850]]);
});

test('sabit: tip listeleri, varsayılan varyant ve güç listesi', () => {
  assert.deepEqual(kabinTipleri('mono').map((t) => t.kosk), ['MB-2550', 'MB-3200', 'MB-3800', 'MB-4350', 'MB-4800', 'MB-5450', 'MB-6000', 'MB-6500', 'MB-7500']);
  assert.deepEqual(kabinTipleri('mono').find((t) => t.kosk === 'MB-3200').varyantlar.map((v) => v.key), ['1600', 'KOK']);
  assert.deepEqual(kabinTipleri('pref').map((t) => [t.kosk, t.ad, t.boy, t.en]), [['PBK-1A', 'EK-1A', 6800, 3800], ['PBK-1B', 'EK-1B', 10280, 3800], ['PBK-1C', 'EK-1C', 10800, 5000]]);
  assert.deepEqual(kabinTipleri('bina').map((t) => [t.kosk, t.boy, t.en]), [['MOD-5', 8550, 6870], ['MOD-5A', 13420, 6870], ['MOD-5B', 17340, 6870]]);
  // MB-3200'ün ilk varyantı "1600" (tamsayı anahtarlar önce gelir) → trafo 1600 kVA'ya çekilir
  assert.deepEqual([varsayilanKabin('mono', 'MB-3200').varyant, varsayilanKabin('mono', 'MB-3200').trafoKva], ['1600', 1600]);
  assert.deepEqual(gucListesi(varsayilanKabin('mono')), [25, 50, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000]);
  assert.deepEqual(gucListesi({ ...varsayilanKabin('mono'), varyant: '1600' }), [1250, 1600]);
  assert.deepEqual(gucListesi({ ...varsayilanKabin('mono'), varyant: 'KOK' }), []);
  assert.equal(gucListesi(varsayilanKabin('pref')).at(-1), 2500);
  assert.deepEqual(panoIcinKva(500).slice(0, 4), ['630-800-1000 kVA', 1500, 1800, 450]);
  assert.deepEqual([kabin.agKablo(630), kabin.agKablo(2500), kabin.rayAcikligi(400)], ['N2XH 3x185 mm²', 'N2XH 9x240 mm²', 670]);
  assert.deepEqual(VARSAYILAN_DIMS.mono, { dw: 110, t: 690, h: 2650, ct: 150, en: 2500, arka: 100, yan: 100 });
  assert.equal(etkinDims(varsayilanKabin('pref', 'PBK-1C')).en, 5000);
});

test('sabit: hücre kataloğu ve işlev sınıfları', () => {
  assert.deepEqual([HD, HH], [1650, 2250]);
  assert.deepEqual([HUCRE_SERI.ULUSOY.liste.length, HUCRE_SERI.EVA.liste.length, HUCRE_SERI.EVAP.liste.length], [22, 15, 15]);
  assert.deepEqual(Object.values(HUCRE_SERI).map((s) => s.ad), ['Ulusoy HMH 36', 'EVA 36 kV', 'EVA+ 36 kV']);
  assert.deepEqual(hucreRec('HMH 36-05'), ['HMH 36-05', 'Kesicili Bara Bağlama (Kuplaj) Hücresi', 1500, 1000]);
  assert.deepEqual(hucreRec('eva+-36-DB'), ['eva+-36-DB', 'KESİCİLİ BARA BÖLME HÜCRESİ', 1750, 1200]);
  assert.equal(hucreRec('yok'), undefined);
  assert.equal(hucreListesi('EVAP')[0][0], 'eva+-36-S');
  assert.equal(hucreListesi('HMH'), HUCRE_SERI.ULUSOY.liste);   // geçersiz seri → Ulusoy (özgün düşüş)
  assert.deepEqual(['HMH 36-04T', 'HMH 36-02', 'eva-36-F', 'eva+-36-F', 'HMH 36-04', 'HMH 36-20', 'eva-36-B'].map(trafoKorumaMi), [true, true, true, true, false, false, false]);
  assert.deepEqual(['HMH 36-04T', 'HMH 36-02', 'eva-36-F', 'eva-36-B'].map(kesiciliKorumaMi), [true, false, false, false]);
  const bekle = {
    YA: ['HMH 36-01', 'HMH 36-06', 'eva-36-S', 'eva-36-Sa', 'eva+-36-S', 'eva+-36-Sa'],
    SYA: ['HMH 36-02', 'eva-36-F', 'eva+-36-F'],
    KE: ['HMH 36-04', 'HMH 36-04T', 'HMH 36-14', 'eva-36-B', 'eva+-36-B'],
    KUPLAJ: ['HMH 36-05', 'eva-36-CB', 'eva+-36-CB'],
    OLCU: ['HMH 36-08', 'HMH 36-10', 'HMH 36-11', 'HMH 36-15', 'HMH 36-19', 'HMH 36-20', 'eva-36-McvL', 'eva-36-McvR', 'eva-36-McvS', 'eva+-36-McvL', 'eva+-36-McvR', 'eva+-36-McvS'],
    GT: ['HMH 36-03'],
    BARA: ['HMH 36-09', 'HMH 36-12', 'HMH 36-13', 'HMH 36-16', 'eva-36-DS', 'eva-36-DB', 'eva-36-BR', 'eva+-36-DS', 'eva+-36-DB', 'eva+-36-BR'],
    KABLO: ['HMH 36-07', 'eva-36-CR', 'eva+-36-CR'],
    PF: ['HMH 36-17'],
    YEDEK: ['YEDEK 1', 'YEDEK 2'],
    DIGER: ['eva-36-Otop', 'eva-36-Mvi', 'eva-36-Mv', 'eva+-36-Otop', 'eva+-36-Mvi', 'eva+-36-Mv'],
  };
  const tum = [...HUCRE_SERI.ULUSOY.liste, ...HUCRE_SERI.EVA.liste, ...HUCRE_SERI.EVAP.liste].map((h) => h[0]);
  const bulunan = {};
  for (const k of tum) (bulunan[hucreIslev(k)] ||= []).push(k);
  for (const [sinif, kodlar] of Object.entries(bekle)) assert.deepEqual([...(bulunan[sinif] || [])].sort(), [...kodlar].sort(), sinif);
  assert.equal(Object.values(bekle).flat().length, tum.length);
  assert.equal(hucreIslev('bilinmeyen'), 'DIGER');
  assert.ok(yerlesim(varsayilanKabin('mono')).hucreler.every((h) => typeof h.islev === 'string'));
});

test('sabit: düzenleme yardımcıları saf çalışır ve özgün ret iletilerini verir', () => {
  const c0 = varsayilanKabin('mono'), kopya0 = JSON.stringify(c0);
  let r = hucreEkle(c0, 'HMH 36-04');
  assert.deepEqual(r, { ok: false, hata: 'HMH 36-04 eklenemedi. Gereken 1000 mm, kalan yer 280 mm. Daha geniş köşk tipi seçin, trafo/AG bölme uzunluğunu azaltın veya listeden hücre çıkarın.' });
  assert.equal(JSON.stringify(c0), kopya0, 'girdi değişmemeli');
  assert.equal(hucreEkle(c0, 'yok-kod').ok, false);
  r = hucreSil(c0, 1); assert.equal(r.ok, true); assert.equal(r.cabin.hucreler.length, 1); assert.equal(c0.hucreler.length, 2);
  r = hucreEkle(r.cabin, 'HMH 36-04'); assert.deepEqual(r.cabin.hucreler[1], { c: 'HMH 36-04', f: '', y: 'c' });
  r = hucreKopyala(r.cabin, 1);
  assert.deepEqual(r, { ok: false, hata: 'HMH 36-04 kopyalanamadı. Gereken 1000 mm, kalan yer 280 mm.' });
  r = hucreTasi(c0, 1, -1); assert.deepEqual(r.cabin.hucreler.map((h) => h.c), ['HMH 36-04T', 'HMH 36-01']);
  assert.deepEqual(hucreTasi(c0, 0, -1).cabin.hucreler, c0.hucreler);               // uçta: değişmez
  r = hucreDegistir(c0, 0, 'eva-36-S'); assert.equal(r.cabin.hucreler[0].c, 'eva-36-S'); assert.equal(c0.hucreler[0].c, 'HMH 36-01');
  assert.equal(hucreDegistir(c0, 0, 'yok').ok, false);
  r = hucreAyar(c0, 0, { f: 'KÖY ÇIKIŞI', y: 'x', s: '2' }); assert.deepEqual(r.cabin.hucreler[0], { c: 'HMH 36-01', f: 'KÖY ÇIKIŞI', y: 'x', s: '2' });
  r = hucreAyar(r.cabin, 0, { s: 'a' }); assert.equal('s' in r.cabin.hucreler[0], false);
  assert.equal(hucreAyar(c0, 0, { y: 'q' }).ok, false);
  assert.equal(hucreSil(c0, 5).ok, false);
  // çift sıra reddi (PBK-1C): iki sıra da doluyken
  let p = { ...varsayilanKabin('pref', 'PBK-1C'), hucreler: [] };
  for (let i = 0; i < 6; i++) p = hucreEkle(p, 'eva-36-DB').cabin;      // 4×1750=7000 arka, 2×1750=3500 ön
  assert.deepEqual(yerlesim(p).siralar.map((s) => s.dolu), [7000, 3500]);
  assert.deepEqual(hucreEkle(p, 'HMH 36-04'), { ok: false, hata: 'HMH 36-04 eklenemedi. Gereken 1000 mm · 1. sırada 860 mm, 2. sırada 300 mm boş yer var. Listeden hücre çıkarın veya daha geniş bina/köşk tipi seçin.' });
  assert.equal(hucreEkle(p, 'HMH 36-01').ok, true);
  // prefabrik tek sıra: pano hizası iletisi
  let a = { ...varsayilanKabin('pref'), hucreler: [] };
  for (let i = 0; i < 3; i++) a = hucreEkle(a, 'HMH 36-04').cabin;
  assert.equal(hucreEkle(a, 'HMH 36-04').hata, 'HMH 36-04 eklenemedi. Gereken 1000 mm, kalan yer 210 mm. Prefabrikte hücre sırası AG pano hizasını geçemez — pano önünde kalan hücrenin kapağına erişilemez. Pano hizaları arası net alan 3210 mm.');
  // bina: yan duvar iletisi
  assert.equal(hucreEkle(varsayilanKabin('bina'), 'HMH 36-01').hata, 'HMH 36-01 eklenemedi. Gereken 750 mm, kalan yer 0 mm. Binada hücre sırası yan duvarlardan en az 100 mm içeride kalmak zorundadır — kullanılabilir net alan 7500 mm.');
});

test('sabit: kabinDegistir — sınıf/tip/varyant geçişleri ve otomatik düzeltmeler', () => {
  const m = hucreEkle({ ...varsayilanKabin('mono', 'MB-6000') }, 'HMH 36-01').cabin;      // 3 hücre
  let r = kabinDegistir(m, { sinif: 'bina' });
  assert.deepEqual([r.cabin.sinif, r.cabin.kosk, r.cabin.varyant, r.cabin.trafoKva, r.cabin.hucreSeri, r.cabin.hucreler.length], ['bina', 'MOD-5', 'BINA', 1000, 'ULUSOY', 8]);
  assert.equal(m.sinif, 'mono');
  const b = r.cabin;
  r = kabinDegistir(b, { kosk: 'MOD-5B' });                                           // bina tipleri arası: proje donanımı
  assert.equal(r.cabin.hucreler.length, 16);
  r = kabinDegistir(r.cabin, { sinif: 'mono' });                                      // geri dönüş: monoblok listesi ve tipi geri gelir
  assert.deepEqual([r.cabin.kosk, r.cabin.varyant, r.cabin.hucreler], ['MB-6000', '1000', m.hucreler]);
  r = kabinDegistir(r.cabin, { sinif: 'bina' });                                      // ikinci giriş: saklanan bina listesi/tipi
  assert.deepEqual([r.cabin.kosk, r.cabin.hucreler.length], ['MOD-5B', 16]);
  // kosk başka sınıftansa sınıf da değişir
  r = kabinDegistir(m, { kosk: 'PBK-1C' });
  assert.deepEqual([r.cabin.sinif, r.cabin.kosk, r.cabin.varyant, r.cabin.hucreler], ['pref', 'PBK-1C', 'PBK', m.hucreler]);
  r = kabinDegistir(r.cabin, { varyant: 'KOK' }); assert.equal(r.cabin.varyant, 'KOK');
  r = kabinDegistir(r.cabin, { kosk: 'PBK-1A' }); assert.equal(r.cabin.varyant, 'KOK', 'KÖK seçimi tip değişince korunur');
  // varyant → trafo gücü otomatik çekilir
  r = kabinDegistir(m, { varyant: '1600' }); assert.equal(r.cabin.trafoKva, 1600);
  r = kabinDegistir(r.cabin, { varyant: '1000' }); assert.equal(r.cabin.trafoKva, 1000);
  r = kabinDegistir(m, { trafoKva: 1600 }); assert.equal(r.cabin.trafoKva, 1000, 'varyantın izin vermediği güç geri çekilir');
  assert.equal(kabinDegistir(m, { varyant: 'PBK' }).ok, false);
  assert.equal(kabinDegistir({ ...m, kosk: 'MB-2550', varyant: '1000' }, { varyant: '1600' }).ok, false);
  assert.equal(kabinDegistir(m, { kosk: 'XX' }).ok, false);
  assert.equal(kabinDegistir(m, { sinif: 'bina', kosk: 'PBK-1A' }).ok, false);
  assert.equal(kabinDegistir(m, { trafoAdet: 3 }).ok, false);
  assert.deepEqual(kabinDegistir(m, { hucreSeri: 'EVAP' }).cabin.hucreSeri, 'EVAP');
  // ölçü farkları sınıfa özgü saklanır
  r = kabinDegistir({ ...m, dims: { arka: 50 } }, { sinif: 'pref' }); assert.equal(r.cabin.dims, undefined);
  r = kabinDegistir(r.cabin, { sinif: 'mono' }); assert.deepEqual(r.cabin.dims, { arka: 50 });
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(r.cabin)));
});

test('sabit: kullanıcı kanalları ve plan şekilleri', () => {
  let c = varsayilanKabin('mono');
  let r = kanalEkle(c, { ad: 'Dış kanal', boy: 12000, gen: 600, der: 800 });
  assert.equal(r.ok, true); assert.equal(c.kanallar, undefined);
  c = kanalEkle(r.cabin, { boy: 3000, gen: 400, der: 700 }).cabin;
  assert.deepEqual(c.kanallar, [{ ad: 'Dış kanal', boy: 12000, gen: 600, der: 800 }, { ad: 'Kanal 2', boy: 3000, gen: 400, der: 700 }]);
  assert.deepEqual(yerlesim(c).kanallar.map((k) => [k.ad, k.x0, k.z1, k.boy, k.gen, k.der, k.kaynak]), [['Dış kanal', null, null, 12000, 600, 800, 'kullanici'], ['Kanal 2', null, null, 3000, 400, 700, 'kullanici']]);
  assert.equal(kanalEkle(c, { ad: 'x', boy: 0, gen: 400, der: 700 }).ok, false);
  assert.equal(kanalSil(c, 7).ok, false);
  assert.deepEqual(kanalSil(c, 0).cabin.kanallar.map((k) => k.ad), ['Kanal 2']);
  // bina + kullanıcı kanalı: katalog kanallarının ardına eklenir
  const b = kanalEkle(varsayilanKabin('bina'), { ad: 'Ek', boy: 5000, gen: 500, der: 700 }).cabin;
  assert.deepEqual(yerlesim(b).kanallar.map((k) => k.kaynak), ['bina', 'bina', 'bina', 'kullanici']);

  const TURLER = new Set(['duvar', 'bolme', 'hucre', 'hucreTasan', 'trafo', 'pano', 'kanal', 'kapak', 'rezerv', 'kapi']);
  for (const sinif of ['mono', 'pref', 'bina']) for (const tip of kabinTipleri(sinif)) for (const v of tip.varyantlar) {
    const k = { ...varsayilanKabin(sinif, tip.kosk), varyant: v.key }, Y = yerlesim(k), P = planSekilleri(k);
    assert.deepEqual([P.w, P.h], [Y.disBoy, Y.disEn]);
    const say = (kind) => P.rects.filter((x) => x.kind === kind).length;
    assert.ok(P.rects.every((x) => TURLER.has(x.kind) && [x.x, x.y, x.w, x.h].every(Number.isFinite) && x.w > 0 && x.h > 0), tip.kosk + '/' + v.key);
    const pay = sinif === 'bina' ? 110 : 0;   // bina kolonları dış yüzden 110 mm taşar
    assert.ok(P.rects.every((x) => x.x >= -pay && x.y >= -pay && x.x + x.w <= P.w + pay && x.y + x.h <= P.h + pay), tip.kosk + '/' + v.key + ' sınır');
    assert.equal(say('hucre') + say('hucreTasan'), Y.hucreler.filter((h) => h.x0 != null).length);
    assert.equal(say('trafo'), Y.trafo.filter((t) => t.aktif).length);
    assert.equal(say('pano'), Y.pano.length);
    assert.equal(say('kapi'), Y.kapilar.length);
    assert.equal(say('kanal'), Y.kanallar.filter((x) => x.x0 != null).length);
    assert.equal(say('kapak'), Y.kanallar.reduce((a, x) => a + x.kapakAdet, 0));
    assert.equal(say('rezerv'), Y.rezerv.length);
    assert.ok(P.labels.every((l) => typeof l.text === 'string' && Number.isFinite(l.x) && Number.isFinite(l.y) && l.size > 0));
    assert.ok(P.lines.every((l) => [l.x1, l.y1, l.x2, l.y2].every(Number.isFinite)));
    for (const h of Y.hucreler.filter((x) => x.x0 != null)) assert.ok(P.labels.some((l) => l.kind === 'hucre' && l.text === h.c));
  }
  // taşan hücre ayrı türle işaretlenir
  let t = { ...varsayilanKabin('mono'), hucreler: Array.from({ length: 4 }, () => ({ c: 'HMH 36-04', f: '', y: 'c' })) };
  assert.deepEqual(planSekilleri(t).rects.filter((x) => x.kind.startsWith('hucre')).map((x) => x.kind), ['hucre', 'hucre', 'hucreTasan', 'hucreTasan']);
  // hücre bölümü olmayan varyant: hücreler yerleşmez, kontrol "bad" verir
  const y = yerlesim({ ...varsayilanKabin('mono', 'MB-2550') });
  assert.deepEqual([y.hasHucre, y.siralar, y.hucreler.map((h) => h.x0)], [false, [], [null, null]]);
  assert.ok(kontroller(varsayilanKabin('mono', 'MB-2550')).some((k) => k.st === 'bad' && k.txt === 'Listede 2 hücre var ancak bu varyantta hücre bölümü YOK'));
});

test('sabit: modül saf ve DOM\'suz — kaynakta tarayıcı/global erişimi ya da yasak ad yok', () => {
  const src = fs.readFileSync(MOD_YOL, 'utf8');
  for (const yasak of [/\bdocument\b/, /\bwindow\b/, /localStorage/, /sessionStorage/, /indexedDB/, /globalThis/, new RegExp(['so', 'nay'].join(''), 'i')]) assert.equal(yasak.test(src), false, String(yasak));
  assert.throws(() => { KOSK['MB-4800'].boy = 1; }, TypeError);          // kataloglar dondurulmuş
  assert.throws(() => { HUCRE_SERI.ULUSOY.liste.push(['x']); }, TypeError);
  // kontrol metinlerinde HTML etiketi kalmaz
  for (const sinif of ['mono', 'pref', 'bina']) for (const k of kontroller(varsayilanKabin(sinif))) assert.equal(/<\/?(b|small|br|span)\b/.test(k.txt + k.sub), false);
});
