// Direk tepe kuvveti hesabı (src/calc/tepe.js) — özgün tek dosyalık araca karşı altın testler.
// tests/ref/tepe_ref.html varsa özgün betik node:vm içinde sahte bir DOM ile çalıştırılır ve
// port her girdi için sayısal olarak (1e-9) ve seçilen direk adlarıyla birebir karşılaştırılır.
// Referans dosya yoksa bu testler atlanır; sabit değerli testler her zaman çalışır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as tepe from '../src/calc/tepe.js';

const {
  TABLES, tertipler, tmax, pwAl, iletkenSay, kalanOran, zayiflamaYuzde, secBeton, secATip, secKafes, betonVarMi, musAyir,
  hesapT, hesapKT, hesapD, hesapKD, hesapN, hesapG, gorevOner,
} = tepe;

// TEPE_REF ortam değişkeni başka bir referans kopyasını gösterebilir (yoksa/eksikse altın testler atlanır)
const REF_YOL = process.env.TEPE_REF ? pathToFileURL(path.resolve(process.env.TEPE_REF)) : new URL('./ref/tepe_ref.html', import.meta.url);
const MOD_YOL = new URL('../src/calc/tepe.js', import.meta.url);
const REF_VAR = fs.existsSync(REF_YOL);
const refTest = (ad, fn) => (REF_VAR ? test(ad, fn) : test.skip(ad + ' (referans dosya yok)', fn));
const TOL = 1e-9;

/* ------------------------------------------------------------------
   Özgün betiği sahte DOM ile yükleyen düzenek
   ------------------------------------------------------------------ */
function refYukle() {
  const html = fs.readFileSync(REF_YOL, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'referans dosyada betik bulunamadı');
  let src = m[1];
  // Yama: iç değişkenleri dışarı açan tek satırlık yakalama; çapa metni tam bir kez geçmelidir.
  const yama = (capa, ek) => {
    assert.equal(src.split(capa).length - 1, 1, 'yama çapası tam bir kez geçmeli: ' + capa);
    src = src.replace(capa, () => ek + capa);
  };
  yama('$("t_out").innerHTML=h;', 'globalThis.__cap={aw,enBuyuk,col,Pw,at,betonTip};');
  yama('$("kt_out").innerHTML=h;', 'globalThis.__cap={n,Td,Tb,Rd,Rb,col,Pw,PwA,ruzKT,at,kf,bt};');
  yama('$("d_out").innerHTML=h;', 'globalThis.__cap={Rd,Rb,t1,t2,dengeli,p1,p2,Pwz,at,kf,bt};');
  yama('$("kd_out").innerHTML=h;', 'globalThis.__cap={c,s,col,T1d,T2d,T1b,T2b,betonVar,kdP,darKose,kdBoy,agDur,aKoluT1,kucuk,k,pw1,pw2,sumPw,'
    + 'v1d,v1b,v4d,v4b,R1d,R4d,R5d,R1b,R4b,R5b,enD,hangiD,enB,hangiB,RkAc,RzDik,kafesZorunlu,at,kf,bt,mnKose,ygDur,ygDurIptal};');
  yama('$("n_out").innerHTML=h;', 'globalThis.__cap={Td,Tb,col,Pwz,RN,at,kf,bt};');
  yama('$("g_out").innerHTML=h;', 'globalThis.__cap={kollar,sinif,mbYG,SPw,coz2,enIx:coz2.indexOf(en),yon,eksA,eksNot,Rk,Rz,Rdemir,at,kf,bt,tevzi,demirAd,'
    + 'SPx:S.Px,SPy:S.Py,SR:S.R,SRb:S.Rb};');
  yama('return \'<div class="pick manuelkart"', 'globalThis.__man={ad:adGoster,ok:ok,tur:tur};');

  const durum = { tab: 't', dmod: 'ayni', arms: [] };
  const els = new Map();
  const stub = (id) => ({
    id, value: '', checked: false, innerHTML: '', textContent: '', className: '', title: '', style: {}, dataset: {}, options: [], selectedIndex: 0,
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, remove() {}, click() {}, blur() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {},
    closest() { return stub(); }, querySelector() { return stub(); }, querySelectorAll() { return []; }, cloneNode() { return stub(); },
  });
  const el = (id) => { if (!els.has(id)) els.set(id, stub(id)); return els.get(id); };
  const document = {
    readyState: 'complete', body: stub('body'), documentElement: stub('html'),
    getElementById(id) { return id === 'gomuluDurum' ? null : el(id); },
    querySelector(sel) {
      if (sel === '#tabs button.on') return { dataset: { t: durum.tab }, textContent: '' };
      if (sel === 'input[name=d_mod]:checked') return { value: durum.dmod };
      return null;
    },
    querySelectorAll(sel) { return sel === '#g_arms .arm' ? durum.arms : []; },
    createElement() { return stub(); },
    addEventListener() {},
  };
  const localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const ctx = vm.createContext({ document, localStorage, console, window: {}, confirm: () => true, location: { reload() {} }, setTimeout });
  vm.runInContext(src, ctx, { filename: 'tepe_ref.js' });

  const koy = (o) => { for (const k of Object.keys(o)) el(k).value = String(o[k]); };
  const metin = (h) => h.replace(/<[^>]+>/g, '');
  const calistir = (fn, out) => {
    ctx.__cap = null; ctx.__man = null; el(out).innerHTML = '';
    ctx[fn]();
    const h = el(out).innerHTML;
    const err = h.match(/^<div class="err">([\s\S]*)<\/div>$/);
    const st = h.match(/<div class="steps">([\s\S]*?)<\/div>/);
    return { cap: ctx.__cap, man: ctx.__man, html: h, hata: (!ctx.__cap && err) ? metin(err[1]) : null, adimlar: st ? st[1].split('\n').filter((x) => x.trim() !== '') : null };
  };
  const mod = (mus) => { el('sebeke').value = mus ? 'mus' : 'ag'; };
  return {
    ctx,
    tablo: () => JSON.parse(vm.runInContext('JSON.stringify({SETS,ILETKEN,KOMP,ATIP,ATIP_SIRA,KAFES,KAFES_SIRA,BETON_TIP,BETON_BOY,BOLGE_AD,YG_SIRA,YG,MUS_AG_SIRA,MUS_D,MUS_B,'
      + 'MATIP,MATIP_SIRA,MKAFES,MKAFES_SIRA,MBETON_BOY,MBETON_BOY_KD,AG_YG_IND,KD_ACI_ESIK,KD_H_SERBEST,KD_K_YG_ALT,KD_K_AG})', ctx)),
    yardimci: (mus, ad, ...arg) => { mod(mus); return ctx[ad](...arg); },
    secenekler: (mus) => {
      mod(mus);
      const h = ctx.tertipOpsiyon('al'), out = [];
      for (const g of h.matchAll(/<optgroup label="([^"]*)">([\s\S]*?)<\/optgroup>/g)) {
        for (const o of g[2].matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)) out.push({ key: o[1], label: o[2], grup: g[1] });
      }
      return out;
    },
    T: (p) => { mod(p.mus); durum.tab = 't'; koy({ t_bolge: p.bolge, t_set: 'al', t_tertip: p.tp, t_a1: p.a1, t_a2: p.a2, ts_direk: p.manuel || '' }); return calistir('hesapT', 't_out'); },
    KT: (p) => { mod(p.mus); durum.tab = 'kt'; koy({ kt_bolge: p.bolge, kt_set: 'al', kt_tertip: p.tp, kt_alfa: p.alfa, kt_aw: p.aw, ts_direk: p.manuel || '' }); return calistir('hesapKT', 'kt_out'); },
    D: (p) => {
      mod(p.mus); durum.tab = 'd'; durum.dmod = p.mod;
      koy({ d_bolge: p.bolge, d_set: 'al', d_hal: p.hal, d_t1: p.t1, d_t2: p.t2, d_f1: p.t1, d_f2: p.t2, d_a1: p.a1, d_a2: p.a2, ts_direk: p.manuel || '' });
      return calistir('hesapD', 'd_out');
    },
    KD: (p) => { mod(p.mus); durum.tab = 'kd'; koy({ kd_bolge: p.bolge, kd_set: 'al', kd_hal: p.hal, kd_t1: p.t1, kd_t2: p.t2, kd_alfa: p.alfa, kd_aw: p.aw, ts_direk: p.manuel || '' }); return calistir('hesapKD', 'kd_out'); },
    N: (p) => { mod(p.mus); durum.tab = 'n'; koy({ n_bolge: p.bolge, n_set: 'al', n_tertip: p.tp, n_hal: p.hal, n_a: p.a, ts_direk: p.manuel || '' }); return calistir('hesapN', 'n_out'); },
    G: (p) => {
      mod(p.mus); durum.tab = 'g';
      durum.arms = p.kollar.map((k) => {
        const ic = { '.a_t': { value: k.tp }, '.a_a': { value: String(k.ac) }, '.a_m': { value: k.md }, '.cz': {}, '.idx': {} };
        return { querySelector: (s) => ic[s] };
      });
      koy({ g_bolge: p.bolge, g_set: 'al', g_yontem: p.yontem, g_acikip: p.acikip, g_taban: p.taban, g_wdir: p.wdir, g_wa: p.wa, g_bra_a: p.braA, g_eks: p.eks, g_eksa: p.eksa, ts_direk: p.manuel || '' });
      el('g_wind').checked = !!p.wind;
      const r = calistir('hesapG', 'g_out');
      const bm = r.html.match(/<div class="(ok|warn|err)" style="margin:10px 0">Branşman kolunda ilk direk/);
      r.bra = bm ? { ok: 'ok', warn: 'uyari', err: 'hata' }[bm[1]] : null;
      return r;
    },
  };
}
let REF = null;
const ref = () => (REF || (REF = refYukle()));

/* ------------------------------------------------------------------
   Karşılaştırma ve rastgele girdi yardımcıları
   ------------------------------------------------------------------ */
function yakin(a, b, yol) { // a: port, b: özgün
  if (typeof b === 'number') {
    assert.equal(typeof a, 'number', yol + ': sayı bekleniyor, bulunan ' + JSON.stringify(a));
    if (Number.isNaN(b) && Number.isNaN(a)) return;
    assert.ok(Math.abs(a - b) <= TOL, yol + ': beklenen ' + b + ' bulunan ' + a);
  } else {
    assert.equal(a === undefined ? null : a, b === undefined ? null : b, yol);
  }
}
function alanlar(a, b, adlar, yol) { for (const k of adlar) yakin(a[k], b[k], yol + '.' + k); }
function direk(a, b, adlar, yol) { // seçilen direk nesnesi: ikisi de null ya da alanlar eşit
  assert.equal(a == null, b == null, yol + ': biri null — port ' + JSON.stringify(a) + ' özgün ' + JSON.stringify(b));
  if (b != null) alanlar(a, b, adlar, yol);
}
const AT = ['ad', 'K', 'Z'], KF = ['ad', 'kap'], BT = ['ad', 'kap', 'taban'], VS = ['Rb1', 'Rd1', 'Rd', 'Rb'];
function manuelEsit(port, r, yol) {
  assert.equal(port.manuel == null, r.man == null, yol + ': manuel tahkik var/yok');
  if (r.man) { assert.equal(port.manuel.ad, r.man.ad, yol + ': manuel ad'); assert.equal(port.manuel.ok, r.man.ok, yol + ': manuel ok'); assert.equal(port.manuel.tur, r.man.tur, yol + ': manuel tür'); }
}
const sayac = { tamam: 0, hata: 0 };
function hataEsit(port, r, yol) { // özgün hata verdiyse port da aynı metinle vermeli; true dönerse karşılaştırma biter
  if (r.cap) { assert.equal(port.ok, true, yol + ': port hata verdi: ' + port.hata); sayac.tamam++; return false; }
  assert.ok(r.hata !== null, yol + ': özgün çıktı çözülemedi');
  assert.equal(port.ok, false, yol + ': port hata vermeliydi');
  assert.equal(port.hata, r.hata, yol + ': hata metni');
  sayac.hata++;
  return true;
}
function rasgele(tohum) { // mulberry32 — tohumlu, tekrarlanabilir
  let a = tohum >>> 0;
  const r = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.sec = (d) => d[Math.floor(r() * d.length)];
  r.tam = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  return r;
}
const KEYS = { false: tertipler(false).map((x) => x.key), true: tertipler(true).map((x) => x.key) };
const MANUEL = ['A:8I', 'A:10I', 'A:10U', 'A:12I', 'A:12U', 'A:8U"', 'A:10I"', 'A:10U"', 'A:12I"', 'A:12U"', 'K:K1', 'K:K2', 'K:K3', 'K:K4', 'K:K5',
  'K:K1"', 'K:K2"', 'K:K3"', 'K:K4"', 'K:K5"', 'B:2', 'B:3', 'B:4', 'B:5', 'B:6', 'B:8', 'B:10', 'B:12', 'B:14', 'B:16', 'B:18', 'B:20', 'B:25', 'B:30'];
const ACIK = [1, 20, 34, 39.9, 40, 40.01, 41, 45, 50, 50.5, 60, 80];
const ALFA = [120, 140, 178, 180, 119.99, 120.01, 139.5, 140.5, 177.9, 179, 90, 60, 20, 153, 100, 1];
const manuelSec = (r) => (r() < 0.45 ? '' : r.sec(MANUEL));
const alfaSec = (r) => (r() < 0.5 ? r.sec(ALFA) : (r() < 0.5 ? r.tam(1, 180) : Math.round((1 + r() * 179) * 1000) / 1000));
// müşterekte yalnız AG / yalnız YG kolları seyrek kalmasın diye ağırlıklandırılır
const tpSec = (r, mus) => {
  if (!mus) return r.sec(KEYS.false);
  const x = r();
  if (x < 0.15) return '#' + r.sec(KEYS.false);
  if (x < 0.27) return r.sec(TABLES.YG_SIRA) + '#';
  if (x < 0.75) return r.sec(TABLES.YG_SIRA) + '#' + r.sec(TABLES.MUS_AG_SIRA);
  return r.sec(KEYS.true);
};
const N_RASGELE = 450; // her şebeke tipi için
// Özgün aracın kendi çıktısından alınan değerler (varsayılan girdiler); referans varsa en alttaki test bunları özgünle doğrular
const KD_SABIT = { R1d: 646.4909962138422, R4d: 635.3977284264982, R5d: 541.8983126583004, R1b: 465.73091449494484, R4b: 482.940771343842,
  sumPw: 93.49941576819788, enD: 646.4909962138422, enB: 482.940771343842, RkAc: 260.27732907083396, RzDik: 386.2136671430083,
  hangiD: '1. Varsayım', hangiB: '4. Varsayım', demir: 'K1', beton: '9,30/5' };
const G_SABIT = { Px: 310.6244223794142, Py: -666.1362234719377, yon: 295, eksA: 270, Rk: 666.1362234719376, Rz: 310.62442237941434,
  Rdemir: 976.7606458513519, Rbeton: 740, demir: 'K1', kafes: 'K1', beton: '9,30/8' };

/* ==================================================================
   A) Referanstan bağımsız testler
   ================================================================== */
test('tepe · modül saf ve kurallara uygun: yasak metin yok, DOM/depolama erişimi yok, tablolar dondurulmuş', () => {
  const src = fs.readFileSync(MOD_YOL, 'utf8'), tst = fs.readFileSync(new URL(import.meta.url), 'utf8');
  const yasak = new RegExp(['s', 'o', 'n', 'a', 'y'].join(''), 'i');
  assert.ok(!yasak.test(src), 'modülde yasak ad geçiyor');
  assert.ok(!yasak.test(tst), 'testte yasak ad geçiyor');
  for (const w of ['document.', 'window.', 'localStorage', 'sessionStorage', 'globalThis']) assert.ok(!src.includes(w), 'modül ' + w + ' kullanmamalı');
  assert.ok(Object.isFrozen(TABLES) && Object.isFrozen(TABLES.SETS.al.tertipler['5R'].d) && Object.isFrozen(TABLES.MUS_D['3x3AWG'][0]));
  assert.throws(() => { TABLES.SETS.al.tertipler['5R'].d[0] = 1; }, TypeError);
  const p = { mus: true, bolge: 2, kollar: [{ tp: '3x3AWG#5R', ac: 0, md: 'tam' }, { tp: '3x3AWG#5R', ac: 180, md: 'tam' }, { tp: '3x1/0AWG#3R', ac: 90, md: 'tam' }], acikip: 'mut' };
  const kopya = JSON.stringify(p);
  const a = hesapG(p), b = hesapG(p);
  assert.equal(JSON.stringify(p), kopya, 'girdi değiştirilmemeli');
  assert.deepEqual(a, b, 'aynı girdi aynı sonucu vermeli');
});

test('tepe · tertip listeleri: AG 42, müşterek 257 anahtar; sıra ve gruplar', () => {
  const ag = tertipler(false), mus = tertipler(true);
  assert.equal(ag.length, 42); assert.equal(mus.length, 5 * 43 + 42);
  assert.deepEqual(ag.slice(0, 5).map((x) => x.key), ['2R', '3R', '4R', '5R', '6R']);
  assert.equal(ag[12].key, '3O+2R/A'); assert.equal(ag[12].grup, 'Çıplak alüminyum iletken');
  assert.equal(ag[13].key, '1x10+16 ALP'); assert.equal(ag[13].grup, 'AER — ALPEK askı telli kablo');
  assert.deepEqual(mus.slice(0, 9).map((x) => x.key), ['3x3AWG#', '3x3AWG#3R', '3x3AWG#5R', '3x3AWG#3P+R/P', '3x3AWG#3Po+R/P', '3x3AWG#3A+R/P', '3x3AWG#3Ph+R/Po', '3x3AWG#3O+R/A', '3x3AWG#2R']);
  assert.equal(mus[0].label, '3x3AWG  (yalnız YG)'); assert.equal(mus[3].label, '3x3AWG+(3P+R/P)'); assert.equal(mus[1].label, '3x3AWG+3R');
  assert.equal(mus[215].key, '#2R'); assert.equal(mus[215].label, '↳ yalnız AG · 2R');
  assert.equal(mus[256].key, '#3x120/16+95 ALP');
  assert.equal(new Set(mus.map((x) => x.key)).size, mus.length);
  for (const x of ag) assert.ok(tepe.tertipGecerli(x.key, false));
  for (const x of mus) assert.ok(tepe.tertipGecerli(x.key, true));
  assert.deepEqual(musAyir('3x3AWG#5R'), { yg: '3x3AWG', ag: '5R' });
  assert.deepEqual(musAyir('#5R'), { yg: '', ag: '5R' });
  assert.deepEqual(musAyir('5R'), { yg: null, ag: '5R' });
});

test('tepe · tablo ve yardımcılar: sabit değerler', () => {
  assert.equal(tmax('3A+R/P', 0, 'demir', false), 586);
  assert.equal(tmax('3A+R/P', 2, 'beton', false), 1067);
  assert.equal(tmax('3O+R/A', 1, 'beton', false), 923); // beton tablosu yok → demir değeri (özgün davranış)
  assert.equal(betonVarMi('3O+R/A', false), false);
  assert.equal(tmax('3x3AWG#5R', 1, 'demir', true), 726);
  assert.equal(tmax('3x3AWG#5R', 1, 'beton', true), 842);
  assert.equal(tmax('3x3AWG#3O+R/A', 1, 'beton', true), null);
  assert.equal(tmax('3x266MCM#', 3, 'demir', true), 984);
  assert.equal(tmax('#5R', 2, 'demir', true), 0.81 * 735);
  assert.equal(tmax('3x3AWG#2R', 0, 'demir', true), 273 + 0.81 * 140);
  assert.equal(tmax('yok', 0, 'demir', false), null);
  assert.equal(pwAl('5R', 1, false), 78);
  assert.equal(pwAl('3x3AWG#5R', 0, true), 45 + 0.81 * 62);
  assert.equal(pwAl('#5R', 1, true), 0.81 * 78);
  assert.equal(iletkenSay('3A+R/P', false), 5); assert.equal(iletkenSay('3x3AWG#5R', true), 8);
  assert.equal(iletkenSay('3x3AWG#', true), 3); assert.equal(iletkenSay('#3R', true), 3);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(zayiflamaYuzde), [100, 100, 75, 60, 50, 40, 40]);
  assert.deepEqual([2, 3, 4, 5, 6].map(kalanOran), [0, 0.25, 0.4, 0.5, 0.6]);
  assert.deepEqual(secATip(231, 44, true, false), { ad: '8I', K: 231, Z: 44 });
  assert.deepEqual(secATip(232, 0, true, false), { ad: '10I', K: 443, Z: 91 });
  assert.deepEqual(secATip(600, 0, false, false), { ad: '10U', K: 700, Z: 170 });
  assert.deepEqual(secATip(300, 100, false, true), { ad: '10I"', K: 350, Z: 121 }); // müşterekte 10I" 8U"dan önce
  assert.equal(secATip(1201, 0, false, false), null);
  assert.deepEqual(secKafes(1000, false, false), { ad: 'K1', kap: 1000 });
  assert.deepEqual(secKafes(1000, true, false), { ad: 'K2', kap: 1848 });
  assert.deepEqual(secKafes(832, false, true), { ad: 'K2"', kap: 1330 });
  assert.equal(secKafes(5001, false, false), null);
  assert.deepEqual(secBeton(0, 'durdurucu', false), { ad: '9,30/5', kap: 500, taban: true });
  assert.deepEqual(secBeton(500, 'durdurucu', false), { ad: '9,30/5', kap: 500, taban: false });
  assert.deepEqual(secBeton(610, 'bransman', false), { ad: '9,30/8', kap: 800, taban: true });
  assert.deepEqual(secBeton(610, '', false), { ad: '9,30/8', kap: 800, taban: false });
  assert.deepEqual(secBeton(100, 'bransman', true, true), { ad: '12/6', kap: 600, taban: true });
  assert.deepEqual(secBeton(250, 'tasiyici', true), { ad: '11/3', kap: 300, taban: true });
  assert.equal(secBeton(3001, '', false), null);
});

test('tepe · özgün aracın varsayılan girdileriyle sabit sonuçlar (AG)', () => {
  const t = hesapT({ mus: false, bolge: 1, tp: '3A+R/P', a1: 34, a2: 40 });
  assert.equal(t.ok, true); assert.equal(t.sonuc.aw, 37); assert.equal(t.sonuc.col, 0); assert.equal(t.sonuc.Pw, 97);
  assert.deepEqual(t.demir, { ad: '8I', tip: 'A', K: 231, Z: 44 }); assert.deepEqual(t.beton, { ad: '9,30/3', kap: 300, taban: false });
  assert.equal(t.adimlar[2], 'P_w (3A+R/P, 40 m) = 97 kg');

  const kt = hesapKT({ mus: false, bolge: 2, tp: '3P+R/P', alfa: 153, aw: 40 });
  assert.equal(kt.sonuc.n, 0.47); assert.equal(kt.sonuc.Td, 899); assert.equal(kt.sonuc.Tb, 944);
  assert.ok(Math.abs(kt.sonuc.Rd - 422.53) < 1e-9); assert.ok(Math.abs(kt.sonuc.Rb - 443.68) < 1e-9);
  assert.ok(Math.abs(kt.sonuc.PwA - 83 * Math.sin(76.5 * Math.PI / 180)) < 1e-9);
  assert.equal(kt.demir.ad, '10I'); assert.equal(kt.demir.K, 443); assert.equal(kt.beton.ad, '9,30/5');

  const d = hesapD({ mus: false, bolge: 1, mod: 'ayni', t1: '5R', t2: '3R', a1: 50, a2: 50 });
  assert.equal(d.sonuc.Rd, 200); assert.equal(d.sonuc.Rb, 216); assert.equal(d.sonuc.Pwz, 62.5);
  assert.deepEqual(d.demir, { ad: '10I', tip: 'A', K: 500, Z: 91 }); assert.deepEqual(d.beton, { ad: '9,30/5', kap: 500, taban: true });
  const df = hesapD({ mus: false, bolge: 1, mod: 'fark', t1: '3P+R/P', t2: '5R', a1: 50, a2: 50 });
  assert.equal(df.sonuc.Rd, 654 - 0.5 * 500); assert.equal(df.sonuc.Rb, 692 - 0.5 * 540); assert.equal(df.sonuc.Pwz, 91);
  assert.equal(df.demir.ad, '10I'); assert.equal(df.beton.ad, '9,30/5');

  const n = hesapN({ mus: false, bolge: 3, tp: '5R', a: 40 });
  assert.equal(n.sonuc.Td, 740); assert.equal(n.sonuc.Tb, 740); assert.equal(n.sonuc.Pwz, 31);
  assert.deepEqual(n.demir, { ad: '12I', tip: 'A', K: 900, Z: 144 }); assert.deepEqual(n.beton, { ad: '9,30/8', kap: 800, taban: false });
});

test('tepe · KD ve G varsayılan girdileriyle sabit sonuçlar (AG)', () => {
  const kd = hesapKD({ mus: false, bolge: 0, t1: '3A+R/P', t2: '5R', alfa: 140, aw: 50 });
  const yak = (a, b, m) => assert.ok(Math.abs(a - b) < 5e-7, (m || '') + ' beklenen ' + b + ' bulunan ' + a);
  assert.equal(kd.ok, true); assert.equal(kd.sonuc.T1d, 586); assert.equal(kd.sonuc.T2d, 350); assert.equal(kd.sonuc.k, 0.5);
  yak(kd.sonuc.R1d, KD_SABIT.R1d, 'R1d'); yak(kd.sonuc.R4d, KD_SABIT.R4d, 'R4d'); yak(kd.sonuc.R5d, KD_SABIT.R5d, 'R5d');
  yak(kd.sonuc.R1b, KD_SABIT.R1b, 'R1b'); yak(kd.sonuc.R4b, KD_SABIT.R4b, 'R4b'); yak(kd.sonuc.sumPw, KD_SABIT.sumPw, 'sumPw');
  yak(kd.sonuc.enD, KD_SABIT.enD, 'enD'); yak(kd.sonuc.enB, KD_SABIT.enB, 'enB');
  yak(kd.sonuc.RkAc, KD_SABIT.RkAc, 'RkAc'); yak(kd.sonuc.RzDik, KD_SABIT.RzDik, 'RzDik');
  assert.equal(kd.sonuc.hangiD, KD_SABIT.hangiD); assert.equal(kd.sonuc.hangiB, KD_SABIT.hangiB);
  assert.equal(kd.demir ? kd.demir.ad : null, KD_SABIT.demir); assert.equal(kd.beton.ad, KD_SABIT.beton); assert.equal(kd.kafesZorunlu, false);

  const g = hesapG({ mus: false, bolge: 2, yontem: 'oto', acikip: 'ara', taban: 180, wind: false, wdir: 90, wa: 50, braA: 40, eks: 'auto', eksa: 0,
    kollar: [{ tp: '3P+R/P', ac: 180, md: 'tam' }, { tp: '3P+R/P', ac: 180, md: 'tam' }, { tp: '5R', ac: -65, md: 'tam' }] });
  assert.equal(g.ok, true); assert.equal(g.sonuc.sinif.tip, 'bransman'); assert.deepEqual(g.sonuc.sinif.anaIx, [0, 1]); assert.equal(g.sonuc.sinif.braIx, 2);
  assert.deepEqual(g.sonuc.kollar.map((k) => k.ac), [180, 360, 295]);
  assert.equal(g.sonuc.haller.length, 1); assert.equal(g.sonuc.haller[0].ad, 'Tüm kollarda %100 cer');
  yak(g.sonuc.Px, G_SABIT.Px, 'Px'); yak(g.sonuc.Py, G_SABIT.Py, 'Py'); yak(g.sonuc.yon, G_SABIT.yon, 'yon'); yak(g.sonuc.eksA, G_SABIT.eksA, 'eksA');
  yak(g.sonuc.Rk, G_SABIT.Rk, 'Rk'); yak(g.sonuc.Rz, G_SABIT.Rz, 'Rz'); yak(g.sonuc.Rdemir, G_SABIT.Rdemir, 'Rdemir'); yak(g.sonuc.Rbeton, G_SABIT.Rbeton, 'Rbeton');
  assert.equal(g.demir.ad, G_SABIT.demir); assert.equal(g.sonuc.kf.ad, G_SABIT.kafes); assert.equal(g.beton.ad, G_SABIT.beton);
  assert.equal(g.sonuc.braKontrol.durum, 'ok');
});
test('tepe · müşterek hâller ve özgün tuhaflıklar: sabit sonuçlar', () => {
  // müşterek durdurucu: iki yan aynı olsa da Çizelge:12 uygulanır → R = T·(1−k)
  const d = hesapD({ mus: true, bolge: 1, hal: 'tum', t1: '3x3AWG#5R', t2: '3x3AWG#5R', a1: 40, a2: 40 });
  assert.equal(d.sonuc.nIlet, 8); assert.equal(d.sonuc.k, 0.6); assert.ok(Math.abs(d.sonuc.Rd - (726 - 0.6 * 726)) < 1e-9);
  assert.ok(Math.abs(d.sonuc.Rb - (842 - 0.6 * 842)) < 1e-9); assert.equal(d.beton.ad, '11/6');
  // yalnız YG durduruluyor: 3 iletken → kalan 0,25
  const dy = hesapD({ mus: true, bolge: 1, hal: 'yg', t1: '3x3AWG#5R', t2: '3x1/0AWG#3R', a1: 40, a2: 40 });
  assert.equal(dy.sonuc.yalnizYG, true); assert.equal(dy.sonuc.Rd, 525 - 0.25 * 321); assert.equal(dy.sonuc.Rb, 555 - 0.25 * 405);
  // müşterek nihayet MN: R = 0,81 × Tmax(AG); rüzgâr YG tam + AG yarım
  const n = hesapN({ mus: true, bolge: 2, tp: '3x3AWG#5R', hal: 'mn', a: 50 });
  assert.equal(n.sonuc.mn, true); assert.equal(n.sonuc.Td, 0.81 * 735); assert.equal(n.sonuc.Tb, 0.81 * 740); assert.equal(n.sonuc.Pwz, 57 + 0.81 * 78 / 2);
  const nt = hesapN({ mus: true, bolge: 2, tp: '3x3AWG#5R', hal: 'tam', a: 50 });
  assert.equal(nt.sonuc.Td, 1120); assert.equal(nt.sonuc.Tb, 1151); assert.equal(nt.sonuc.Pwz, (57 + 0.81 * 78) / 2);
  // müşterek köşede durdurucu α ≤ 120°: kafes zorunlu, beton 12 m ve travers katsayılarıyla indirgeme
  const kd = hesapKD({ mus: true, bolge: 0, hal: 'mdk', t1: '3x3AWG#5R', t2: '3x3AWG#5R', alfa: 120, aw: 50 });
  assert.equal(kd.kafesZorunlu, true); assert.equal(kd.demir.tip, 'K'); assert.equal(kd.sonuc.kdBoy, true); assert.equal(kd.sonuc.agDur, true);
  assert.ok(Math.abs(kd.sonuc.T1b - (273 + (7.5 / 10.5) * 350)) < 1e-9); assert.ok(Math.abs(kd.sonuc.T2b - ((9.5 / 10.5) * 273 + (7.5 / 10.5) * 350)) < 1e-9);
  assert.ok(kd.beton.ad.startsWith('12/')); assert.equal(kd.sonuc.sumPw, 0);
  const kd2 = hesapKD({ mus: true, bolge: 0, hal: 'mdk', t1: '3x3AWG#5R', t2: '3x3AWG#5R', alfa: 120.01, aw: 50 });
  assert.equal(kd2.kafesZorunlu, false); assert.equal(kd2.sonuc.kdBoy, false); assert.equal(kd2.sonuc.T1b, 557);
  // KT: zaviye faktörü 2 haneye yuvarlanır; müşterekte rüzgârsız değerler
  const kt = hesapKT({ mus: true, bolge: 1, tp: '3x3AWG#5R', alfa: 170, aw: 40 });
  assert.equal(kt.sonuc.n, 0.17); assert.equal(kt.sonuc.ruz, false); assert.ok(Math.abs(kt.sonuc.Rd - 0.17 * 726) < 1e-9); assert.equal(kt.beton.ad, '11/3');
  // G 'ara' kipi: 1. kolun kendi açısı yok sayılır
  const k3 = [{ tp: '3P+R/P', ac: 77, md: 'tam' }, { tp: '3P+R/P', ac: 180, md: 'tam' }, { tp: '5R', ac: -65, md: 'tam' }];
  const g = hesapG({ mus: false, bolge: 2, acikip: 'ara', taban: 180, kollar: k3 });
  assert.deepEqual(g.sonuc.kollar.map((k) => k.ac), [180, 360, 295]);
  // G tevzi: demir direk daima kafes; her kol için zayıflatılmış durum eklenir
  const tv = hesapG({ mus: false, bolge: 1, acikip: 'mut', kollar: [{ tp: '5R', ac: 0 }, { tp: '3R', ac: 180 }, { tp: '2R', ac: 90 }, { tp: '4R', ac: 270 }] });
  assert.equal(tv.sonuc.sinif.tip, 'tevzi'); assert.equal(tv.sonuc.haller.length, 5); assert.equal(tv.demir.tip, 'K'); assert.equal(tv.kafesZorunlu, true);
  assert.equal(tv.sonuc.haller.filter((h) => h.belirleyici).length, 1);
  // G müşterek: ayrılan kol YG taşıyorsa beton 12 m
  const gm = hesapG({ mus: true, bolge: 0, acikip: 'mut', kollar: [{ tp: '3x3AWG#5R', ac: 0 }, { tp: '3x3AWG#5R', ac: 180 }, { tp: '3x1/0AWG#', ac: 90 }, { tp: '#3R', ac: 270 }] });
  assert.equal(gm.sonuc.mbYG, true); assert.ok(gm.beton.ad.startsWith('12/'));
  assert.ok(Math.abs(gm.sonuc.kollar[2].Tb - 411 * (9.5 / 10.5)) < 1e-9); assert.ok(Math.abs(gm.sonuc.kollar[3].Tb - 0.81 * 210 * ((7.5 / 10.5) / 0.81)) < 1e-9);
  assert.equal(gm.sonuc.kollar[0].Tb, 557);
});

test('tepe · hata ve elle direk tahkiki', () => {
  assert.equal(hesapT({ bolge: 0, tp: '5R', a1: 0, a2: 40 }).hata, "Açıklıklar 0'dan büyük olmalı.");
  assert.equal(hesapKT({ bolge: 0, tp: '5R', alfa: 181, aw: 40 }).hata, 'α açısı 0–180° arasında olmalı.');
  assert.equal(hesapKD({ bolge: 0, t1: '5R', t2: '3R', alfa: 0, aw: 40 }).hata, 'α açısı 0–180° arasında olmalı.');
  assert.equal(hesapD({ mus: true, bolge: 0, t1: '', t2: '3x3AWG#5R', a1: 40, a2: 40 }).hata, 'Sol ve sağ taraf tertipleri seçilmeden hesap yapılamaz.');
  assert.match(hesapD({ bolge: 0, mod: 'ayni', t1: '3P+R/P', t2: '3A+R/P', a1: 40, a2: 40 }).hata, /^Seçilen iki tertipte iletken tipi değişiyor \(3P\+R\/P ↔ 3A\+R\/P\)\./);
  assert.match(hesapD({ bolge: 0, mod: 'ayni', t1: '3x16+25 ALP', t2: '5R', a1: 40, a2: 40 }).hata, /^Bu tertiplerin iletken bileşimi tanımlı değil/);
  assert.equal(hesapG({ bolge: 0, kollar: [{ tp: '5R', ac: 0 }] }).hata, 'En az iki kol girilmeli.');
  assert.match(hesapG({ bolge: 0, acikip: 'mut', kollar: [{ tp: '5R', ac: 0 }, { tp: '5R', ac: 180 }] }).hata, /^İki kol doğrusal hattır/);
  for (const r of [hesapT({ bolge: 0, tp: 'yok', a1: 40, a2: 40 }), hesapN({ mus: true, bolge: 0, tp: '9x9#5R', a: 40 }), hesapKT({ bolge: 0, tp: '3x3AWG#5R', alfa: 150, aw: 40 })]) {
    assert.equal(r.ok, false); assert.match(r.hata, /^Tertip seçilmedi veya bu şebeke tipinde geçersiz/); assert.equal(r.demir, null); assert.deepEqual(r.adimlar, []);
  }
  const n = (m) => hesapN({ mus: false, bolge: 3, tp: '5R', a: 40, manuel: m }).manuel;
  assert.equal(n(''), null); assert.equal(n('A:10I"'), null); // müşterek tipi AG'de tanınmaz
  assert.equal(n('A:10U').ok, false); assert.equal(n('A:12I').ok, true); assert.equal(n('K:K1').ok, true);
  assert.deepEqual([n('B:6').ok, n('B:6').ad, n('B:8').ok, n('B:8').kap], [false, '9,30/6', true, 800]);
  assert.equal(hesapT({ bolge: 1, tp: '3A+R/P', a1: 34, a2: 40, manuel: 'K:K1' }).manuel.kap, 871); // taşıyıcıda rüzgârlı değer
});

test('tepe · gorevOner: kol düzenine göre hesap türü', () => {
  assert.deepEqual(gorevOner([]), { gorev: null, alfa: null });
  assert.deepEqual(gorevOner([{ ac: 10, tp: '5R' }]), { gorev: 'N', alfa: null });
  assert.deepEqual(gorevOner([{ ac: 0, tp: '5R' }, { ac: 180, tp: '5R' }]), { gorev: 'T', alfa: 180 });
  assert.deepEqual(gorevOner([{ ac: 0, tp: '5R' }, { ac: 181.5, tp: '5R' }]), { gorev: 'T', alfa: 178.5 });
  assert.deepEqual(gorevOner([{ ac: 0, tp: '5R' }, { ac: 178, tp: '5R' }]), { gorev: 'KT', alfa: 178 });
  assert.deepEqual(gorevOner([{ ac: 350, tp: '5R' }, { ac: 143, tp: '5R' }]), { gorev: 'KT', alfa: 153 });
  assert.deepEqual(gorevOner([{ ac: -90, tp: '5R' }, { ac: 90.5, tp: '3R' }]), { gorev: 'D', alfa: 179.5 });
  assert.deepEqual(gorevOner([{ ac: 0, tp: '5R' }, { ac: 140, tp: '3R' }]), { gorev: 'KD', alfa: 140 });
  assert.deepEqual(gorevOner([{ ac: 0, tp: '5R' }, { ac: 180, tp: '5R' }, { ac: 90, tp: '3R' }]), { gorev: 'G', alfa: null });
  assert.equal(gorevOner([{ ac: 0, tp: 'a' }, { ac: 1, tp: 'a' }, { ac: 2, tp: 'a' }, { ac: 3, tp: 'a' }]).gorev, 'G');
});

/* ==================================================================
   B) Özgün betiğe karşı altın testler
   ================================================================== */
refTest('tepe/ref · veri tabloları ve sabitler özgünle birebir', () => {
  const o = ref().tablo();
  for (const k of Object.keys(o)) assert.equal(JSON.stringify(TABLES[k]), JSON.stringify(o[k]), 'TABLES.' + k);
  assert.equal(Object.keys(TABLES.SETS).length, 1);
  for (let n = -1; n <= 12; n++) {
    assert.equal(zayiflamaYuzde(n), ref().ctx.zayiflamaYuzde(n), 'zayiflamaYuzde ' + n);
    assert.equal(kalanOran(n), ref().ctx.kalanOran(n), 'kalanOran ' + n);
  }
  for (const n of [2, 3, 4, 5, 6]) assert.equal(TABLES.ZAYIFLAMA[n], ref().ctx.zayiflamaYuzde(n));
});

refTest('tepe/ref · tertip listeleri (anahtar, etiket, grup, sıra) özgün açılır listeyle aynı', () => {
  for (const mus of [false, true]) {
    const o = ref().secenekler(mus), p = tertipler(mus);
    assert.equal(p.length, o.length, 'adet mus=' + mus);
    o.forEach((x, i) => assert.deepEqual({ ...p[i] }, x, 'sıra ' + i + ' mus=' + mus));
  }
});

refTest('tepe/ref · tmax / pwAl / iletkenSay / betonVarMi: her tertip × her bölge × iki şebeke tipi', () => {
  let say = 0;
  for (const mus of [false, true]) {
    for (const tp of KEYS[mus].concat(mus ? KEYS.false : [], ['', '#', 'yok', '3x3AWG#yok', 'yok#5R'])) {
      const yol = (mus ? 'mus ' : 'ag ') + JSON.stringify(tp);
      for (let b = 0; b < 4; b++) for (const cins of ['demir', 'beton']) { yakin(tmax(tp, b, cins, mus), ref().yardimci(mus, 'tmax', 'al', tp, b, cins), yol + ' tmax b' + b + ' ' + cins); say++; }
      for (const col of [0, 1]) { yakin(pwAl(tp, col, mus), ref().yardimci(mus, 'pwAl', 'al', tp, col), yol + ' pwAl ' + col); say++; }
      yakin(iletkenSay(tp, mus), ref().yardimci(mus, 'iletkenSay', 'al', tp), yol + ' iletkenSay');
      assert.equal(betonVarMi(tp, mus), ref().yardimci(mus, 'betonVarMi', 'al', tp), yol + ' betonVarMi');
      assert.deepEqual(musAyir(tp), { ...ref().ctx.musAyir(tp) }, yol + ' musAyir');
      assert.equal(tepe.tAd(tp, mus), ref().yardimci(mus, 'tAd', tp), yol + ' tAd');
    }
  }
  assert.ok(say > 3000);
});

refTest('tepe/ref · direk seçimi: secATip / secKafes / secBeton ızgarası', () => {
  const Rz = [0, 17, 17.01, 42, 44, 45, 81, 90, 91, 95, 99, 121, 144, 160, 170, 194, 230, 250, 251];
  for (const mus of [false, true]) {
    for (let R = 0; R <= 5300; R += 23.5) {
      for (const ruz of [false, true]) {
        direk(secKafes(R, ruz, mus), ref().yardimci(mus, 'secKafes', R, ruz), KF, 'secKafes ' + R);
        for (const z of Rz) direk(secATip(R, z, ruz, mus), ref().yardimci(mus, 'secATip', R, z, ruz), AT, 'secATip ' + R + '/' + z);
      }
      for (const g of ['tasiyici', 'durdurucu', 'bransman', '', undefined]) for (const kd of [false, true]) {
        direk(secBeton(R, g, mus, kd), ref().yardimci(mus, 'secBeton', R, g, kd), BT, 'secBeton ' + R + ' ' + g + ' mus=' + mus);
      }
    }
    for (const R of [200, 300, 500, 600, 800, 3000, 3000.01, 231, 243, 350, 831, 1000, 4432, 5000]) {
      for (const g of ['tasiyici', 'durdurucu', 'bransman', '']) direk(secBeton(R, g, mus, false), ref().yardimci(mus, 'secBeton', R, g, false), BT, 'secBeton sınır ' + R);
      for (const ruz of [false, true]) { direk(secKafes(R, ruz, mus), ref().yardimci(mus, 'secKafes', R, ruz), KF, 'secKafes sınır ' + R); direk(secATip(R, 0, ruz, mus), ref().yardimci(mus, 'secATip', R, 0, ruz), AT, 'secATip sınır ' + R); }
    }
  }
});

refTest('tepe/ref · hesapT: her tertip × açıklık sınırları + rastgele', () => {
  sayac.tamam = 0; sayac.hata = 0;
  const esle = (p) => {
    const yol = 'T ' + JSON.stringify(p), r = ref().T(p), o = hesapT(p);
    if (hataEsit(o, r, yol)) return;
    alanlar(o.sonuc, r.cap, ['aw', 'enBuyuk', 'col', 'Pw'], yol);
    direk(o.sonuc.at, r.cap.at, AT, yol + ' at'); assert.equal(o.demir ? o.demir.ad : null, r.cap.at ? r.cap.at.ad : null, yol + ' demir');
    assert.equal(o.beton.ad, r.cap.betonTip, yol + ' beton');
    manuelEsit(o, r, yol); assert.deepEqual(o.adimlar, r.adimlar, yol + ' adımlar');
  };
  let say = 0;
  for (const mus of [false, true]) for (const tp of KEYS[mus]) for (const [a1, a2] of [[34, 40], [40, 40.5], [50, 30]]) { esle({ mus, bolge: say % 4, tp, a1, a2, manuel: '' }); say++; }
  const r = rasgele(101);
  for (const mus of [false, true]) for (let i = 0; i < N_RASGELE; i++) {
    esle({ mus, bolge: r.tam(0, 3), tp: tpSec(r, mus), a1: r() < 0.04 ? r.sec([0, -3]) : r.sec(ACIK), a2: r() < 0.04 ? 0 : r.sec(ACIK), manuel: manuelSec(r) }); say++;
  }
  assert.ok(say >= 1700 && sayac.tamam >= say - 120 && sayac.hata >= 20, JSON.stringify(sayac));
});

refTest('tepe/ref · hesapKT: her tertip + rastgele (açı sınırları dahil)', () => {
  sayac.tamam = 0; sayac.hata = 0;
  const esle = (p) => {
    const yol = 'KT ' + JSON.stringify(p), r = ref().KT(p), o = hesapKT(p);
    if (hataEsit(o, r, yol)) return;
    alanlar(o.sonuc, r.cap, ['n', 'Td', 'Tb', 'Rd', 'Rb', 'col', 'Pw', 'PwA'], yol); assert.equal(o.sonuc.ruz, r.cap.ruzKT, yol + ' ruz');
    direk(o.sonuc.at, r.cap.at, AT, yol + ' at'); direk(o.sonuc.kf, r.cap.kf, KF, yol + ' kf'); direk(o.beton, r.cap.bt, BT, yol + ' bt');
    assert.equal(o.demir ? o.demir.ad : null, r.cap.at ? r.cap.at.ad : (r.cap.kf ? r.cap.kf.ad : null), yol + ' demir');
    manuelEsit(o, r, yol); assert.deepEqual(o.adimlar, r.adimlar, yol + ' adımlar');
  };
  let say = 0;
  for (const mus of [false, true]) for (const tp of KEYS[mus]) for (const alfa of [153, 120, 178]) { esle({ mus, bolge: say % 4, tp, alfa, aw: say % 2 ? 40 : 45, manuel: '' }); say++; }
  const r = rasgele(202);
  for (const mus of [false, true]) for (let i = 0; i < N_RASGELE; i++) {
    esle({ mus, bolge: r.tam(0, 3), tp: tpSec(r, mus), alfa: r() < 0.04 ? r.sec([0, -10, 180.5, 200]) : alfaSec(r), aw: r.sec(ACIK), manuel: manuelSec(r) }); say++;
  }
  assert.ok(say >= 1700 && sayac.tamam >= say - 80 && sayac.hata >= 15, JSON.stringify(sayac));
});

refTest('tepe/ref · hesapD: AG (aynı tip / tip değişiyor) tüm çiftler + müşterek rastgele', () => {
  sayac.tamam = 0; sayac.hata = 0;
  const esle = (p) => {
    const yol = 'D ' + JSON.stringify(p), r = ref().D(p), o = hesapD(p);
    if (hataEsit(o, r, yol)) return;
    alanlar(o.sonuc, r.cap, ['Rd', 'Rb', 'p1', 'p2', 'Pwz', 'dengeli'], yol);
    direk(o.sonuc.at, r.cap.at, AT, yol + ' at'); direk(o.sonuc.kf, r.cap.kf, KF, yol + ' kf'); direk(o.beton, r.cap.bt, BT, yol + ' bt');
    assert.equal(o.demir ? o.demir.ad : null, r.cap.at ? r.cap.at.ad : (r.cap.kf ? r.cap.kf.ad : null), yol + ' demir');
    manuelEsit(o, r, yol); assert.deepEqual(o.adimlar, r.adimlar, yol + ' adımlar');
  };
  let say = 0;
  // AG: 42 × 42 çiftin tamamı, iki kipte (hata yolları dahil)
  for (const mod of ['ayni', 'fark']) for (const t1 of KEYS.false) for (const t2 of KEYS.false) { esle({ mus: false, bolge: say % 4, mod, hal: 'tum', t1, t2, a1: say % 3 ? 50 : 40, a2: say % 5 ? 41 : 40, manuel: '' }); say++; }
  const r = rasgele(303);
  for (let i = 0; i < N_RASGELE; i++) { esle({ mus: false, bolge: r.tam(0, 3), mod: r.sec(['ayni', 'fark']), hal: 'tum', t1: r.sec(KEYS.false.slice(0, 16)), t2: r.sec(KEYS.false.slice(0, 16)), a1: r.sec(ACIK), a2: r.sec(ACIK), manuel: manuelSec(r) }); say++; }
  for (let i = 0; i < 2 * N_RASGELE; i++) {
    const t1 = tpSec(r, true), t2 = r() < 0.25 ? t1 : tpSec(r, true);
    esle({ mus: true, bolge: r.tam(0, 3), mod: r.sec(['ayni', 'fark']), hal: r.sec(['tum', 'yg']), t1, t2, a1: r.sec(ACIK), a2: r.sec(ACIK), manuel: manuelSec(r) }); say++;
  }
  esle({ mus: true, bolge: 0, mod: 'ayni', hal: 'tum', t1: '', t2: '3x3AWG#5R', a1: 40, a2: 40, manuel: '' });
  assert.ok(say >= 4800 && sayac.tamam >= 3000 && sayac.hata >= 1000, JSON.stringify(sayac));
});

refTest('tepe/ref · hesapKD: üç hâl × açı sınırları (120/140/178/180) + rastgele', () => {
  sayac.tamam = 0; sayac.hata = 0;
  const esle = (p) => {
    const yol = 'KD ' + JSON.stringify(p), r = ref().KD(p), o = hesapKD(p);
    if (hataEsit(o, r, yol)) return;
    const c = r.cap, s = o.sonuc;
    alanlar(s, c, ['c', 's', 'col', 'T1d', 'T2d', 'T1b', 'T2b', 'betonVar', 'darKose', 'kdBoy', 'agDur', 'aKoluT1', 'k', 'pw1', 'pw2', 'sumPw',
      'R1d', 'R4d', 'R5d', 'R1b', 'R4b', 'R5b', 'enD', 'hangiD', 'enB', 'hangiB', 'RkAc', 'RzDik', 'mnKose', 'ygDur', 'ygDurIptal'], yol);
    assert.equal(o.kafesZorunlu, c.kafesZorunlu, yol + ' kafesZorunlu');
    alanlar(s.kucuk, c.kucuk, ['ad', 'v', 'dig', 'digAd'], yol + ' kucuk');
    direk(s.kdP, c.kdP, ['P1', 'P2'], yol + ' kdP');
    for (const v of ['v1d', 'v1b', 'v4d', 'v4b']) direk(s[v], c[v], VS, yol + ' ' + v);
    direk(s.at, c.at, AT, yol + ' at'); direk(s.kf, c.kf, KF, yol + ' kf'); direk(o.beton, c.bt, BT, yol + ' bt');
    assert.equal(o.demir ? o.demir.ad : null, c.at ? c.at.ad : (c.kf ? c.kf.ad : null), yol + ' demir');
    manuelEsit(o, r, yol); assert.deepEqual(o.adimlar, r.adimlar, yol + ' adımlar');
  };
  let say = 0;
  const r = rasgele(404);
  for (const mus of [false, true]) for (const hal of ['mdk', 'mdkyg', 'mn']) for (const alfa of [120, 120.01, 140, 141, 178, 180, 90, 20]) for (let i = 0; i < 12; i++) {
    esle({ mus, bolge: r.tam(0, 3), hal, t1: tpSec(r, mus), t2: tpSec(r, mus), alfa, aw: r.sec([40, 41, 50]), manuel: i % 3 ? '' : r.sec(MANUEL) }); say++;
  }
  for (const mus of [false, true]) for (let i = 0; i < 2 * N_RASGELE; i++) {
    const t1 = tpSec(r, mus), t2 = r() < 0.2 ? t1 : tpSec(r, mus);
    esle({ mus, bolge: r.tam(0, 3), hal: r.sec(['mdk', 'mdkyg', 'mn']), t1, t2, alfa: r() < 0.03 ? r.sec([0, -5, 181]) : alfaSec(r), aw: r.sec(ACIK), manuel: manuelSec(r) }); say++;
  }
  assert.ok(say >= 2300 && sayac.tamam >= say - 120 && sayac.hata >= 15, JSON.stringify(sayac));
});

refTest('tepe/ref · hesapN: her tertip × her bölge × hâller + rastgele', () => {
  sayac.tamam = 0; sayac.hata = 0;
  const esle = (p) => {
    const yol = 'N ' + JSON.stringify(p), r = ref().N(p), o = hesapN(p);
    if (hataEsit(o, r, yol)) return;
    alanlar(o.sonuc, r.cap, ['Td', 'Tb', 'col', 'Pwz', 'RN'], yol);
    direk(o.sonuc.at, r.cap.at, AT, yol + ' at'); direk(o.sonuc.kf, r.cap.kf, KF, yol + ' kf'); direk(o.beton, r.cap.bt, BT, yol + ' bt');
    assert.equal(o.demir ? o.demir.ad : null, r.cap.at ? r.cap.at.ad : (r.cap.kf ? r.cap.kf.ad : null), yol + ' demir');
    manuelEsit(o, r, yol);
  };
  let say = 0;
  for (const mus of [false, true]) for (const tp of KEYS[mus]) for (let b = 0; b < 4; b++) for (const hal of (mus ? ['mn', 'tam'] : ['mn'])) { esle({ mus, bolge: b, tp, hal, a: (say % 2) ? 40 : 50, manuel: '' }); say++; }
  const r = rasgele(505);
  for (const mus of [false, true]) for (let i = 0; i < N_RASGELE; i++) { esle({ mus, bolge: r.tam(0, 3), tp: tpSec(r, mus), hal: r.sec(['mn', 'tam']), a: r.sec(ACIK), manuel: manuelSec(r) }); say++; }
  assert.ok(say >= 3000 && sayac.tamam === say, JSON.stringify(sayac));
});

refTest('tepe/ref · hesapG: branşman / tevzi / elle — rastgele kol düzenleri, rüzgâr, eksen seçenekleri', () => {
  sayac.tamam = 0; sayac.hata = 0;
  const esle = (p) => {
    const yol = 'G ' + JSON.stringify(p), r = ref().G(p), o = hesapG(p);
    if (hataEsit(o, r, yol)) return null;
    const c = r.cap, s = o.sonuc;
    assert.equal(s.kollar.length, c.kollar.length, yol + ' kol sayısı');
    c.kollar.forEach((k, i) => { alanlar(s.kollar[i], k, ['tp', 'ac', 'md', 'n', 'Td', 'Tb'], yol + ' kol' + i); yakin(s.kollar[i].pw[0], k.pw[0], yol + ' pw0'); yakin(s.kollar[i].pw[1], k.pw[1], yol + ' pw1'); });
    alanlar(s.sinif, c.sinif, ['tip', 'ad', 'not', 'anaAci', 'anaAci2', 'braAci', 'braIx'], yol + ' sinif');
    assert.deepEqual(s.sinif.anaIx || null, c.sinif.anaIx ? [...c.sinif.anaIx] : null, yol + ' anaIx');
    alanlar(s, c, ['mbYG', 'SPw', 'yon', 'eksA', 'eksNot', 'Rk', 'Rz', 'Rdemir', 'tevzi'], yol);
    yakin(s.Px, c.SPx, yol + ' Px'); yakin(s.Py, c.SPy, yol + ' Py'); yakin(s.Rvek, c.SR, yol + ' Rvek'); yakin(s.Rbeton, c.SRb, yol + ' Rbeton');
    assert.equal(s.haller.length, c.coz2.length, yol + ' durum sayısı');
    c.coz2.forEach((x, i) => {
      const h = s.haller[i], y = yol + ' hal' + i;
      assert.equal(h.ad, x.d.ad, y + ' ad'); assert.equal(h.z, x.d.z, y + ' z');
      yakin(h.Px, x.s.Px, y + ' Px'); yakin(h.Py, x.s.Py, y + ' Py'); yakin(h.R, x.s.R, y + ' R'); yakin(h.sk, x.sk, y + ' sk'); yakin(h.Rb, x.s.Rb, y + ' Rb');
      assert.equal(h.belirleyici, i === c.enIx, y + ' belirleyici');
    });
    assert.equal(s.belirleyici.ix, c.enIx, yol + ' belirleyici');
    direk(s.at, c.at, AT, yol + ' at'); direk(s.kf, c.kf, KF, yol + ' kf'); direk(o.beton, c.bt, BT, yol + ' bt');
    assert.equal(o.demir ? o.demir.ad : '—', c.demirAd, yol + ' demir');
    assert.equal(s.braKontrol ? s.braKontrol.durum : null, r.bra, yol + ' branşman açıklığı');
    manuelEsit(o, r, yol); assert.deepEqual(o.adimlar, r.adimlar, yol + ' adımlar');
    return s;
  };
  const r = rasgele(606);
  const aci = () => (r() < 0.7 ? 5 * r.tam(-72, 72) : Math.round((r() * 720 - 360) * 100) / 100);
  const say = { toplam: 0, bransman: 0, tevzi: 0, hat: 0, hata: 0, mbYG: 0, ruzgar: 0 };
  for (const mus of [false, true]) for (let i = 0; i < 3 * N_RASGELE; i++) {
    const x = r(), n = x < 0.02 ? 1 : x < 0.12 ? 2 : x < 0.62 ? 3 : x < 0.82 ? 4 : r.tam(5, 6);
    const acikip = r.sec(['mut', 'ara']);
    const kollar = [];
    for (let j = 0; j < n; j++) kollar.push({ tp: tpSec(r, mus), ac: aci(), md: r.sec(['tam', 'tam', 'zay', 'tas']) });
    if (n >= 3 && r() < 0.65) { // branşman düzeni: aynı tertipte, karşıt (ya da 120° eşiğine yakın) iki kol
      const [i1, i2] = r.sec([[0, 1], [0, 2], [1, 2]]);
      kollar[i2].tp = kollar[i1].tp;
      const fark = r.sec([180, 180, 180, 170, 150, 120, 119.5, 121, 200, 240, 100]);
      if (acikip === 'mut') kollar[i2].ac = kollar[i1].ac + fark;
      else if (i2 === i1 + 1) kollar[i2].ac = fark;
    }
    const s = esle({ mus, bolge: r.tam(0, 3), kollar, yontem: r() < 0.3 ? 'el' : 'oto', acikip, taban: r.sec([0, 90, 180, 270, 37.5, -45]),
      wind: r() < 0.4, wdir: r() < 0.6 ? 15 * r.tam(0, 23) : Math.round(r() * 36000) / 100, wa: r.sec([40, 50]), braA: r.sec([0, 30, 40, 40.5, 45, 50, 51, 70]),
      eks: r.sec(['auto', 'auto', 'auto', 'dik', 'bra', 'ana', 'acio', 'man']), eksa: r.sec([0, 45, 90, 135, -30, 400, 12.5]), manuel: manuelSec(r) });
    say.toplam++;
    if (!s) say.hata++; else { say[s.sinif.tip]++; if (s.mbYG) say.mbYG++; if (s.wind) say.ruzgar++; }
  }
  // ızgaranın gerçekten bütün dalları gezdiğinden emin ol
  assert.ok(say.toplam >= 2700 && say.bransman > 400 && say.tevzi > 600 && say.hat > 30 && say.hata > 60 && say.mbYG > 200 && say.ruzgar > 600 && sayac.tamam === say.toplam - say.hata, JSON.stringify(say));
});

refTest('tepe/ref · özgün aracın varsayılan girdileri (sabit değerli testlerin kaynağı)', () => {
  const kd = ref().KD({ mus: false, bolge: 0, hal: 'mdk', t1: '3A+R/P', t2: '5R', alfa: 140, aw: 50 }).cap;
  for (const k of ['R1d', 'R4d', 'R5d', 'R1b', 'R4b', 'sumPw', 'enD', 'enB', 'RkAc', 'RzDik']) assert.ok(Math.abs(kd[k] - KD_SABIT[k]) < 5e-7, 'KD ' + k + ' = ' + kd[k]);
  assert.equal(kd.hangiD, KD_SABIT.hangiD); assert.equal(kd.hangiB, KD_SABIT.hangiB); assert.equal(kd.at ? kd.at.ad : kd.kf.ad, KD_SABIT.demir); assert.equal(kd.bt.ad, KD_SABIT.beton);
  const g = ref().G({ mus: false, bolge: 2, yontem: 'oto', acikip: 'ara', taban: 180, wind: false, wdir: 90, wa: 50, braA: 40, eks: 'auto', eksa: 0,
    kollar: [{ tp: '3P+R/P', ac: 180, md: 'tam' }, { tp: '3P+R/P', ac: 180, md: 'tam' }, { tp: '5R', ac: -65, md: 'tam' }] }).cap;
  for (const [a, b] of [['SPx', 'Px'], ['SPy', 'Py'], ['yon', 'yon'], ['eksA', 'eksA'], ['Rk', 'Rk'], ['Rz', 'Rz'], ['Rdemir', 'Rdemir'], ['SRb', 'Rbeton']]) assert.ok(Math.abs(g[a] - G_SABIT[b]) < 5e-7, 'G ' + a + ' = ' + g[a]);
  assert.equal(g.demirAd, G_SABIT.demir); assert.equal(g.kf.ad, G_SABIT.kafes); assert.equal(g.bt.ad, G_SABIT.beton);
});
