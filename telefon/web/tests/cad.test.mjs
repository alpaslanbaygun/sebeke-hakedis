// CAD altlık okuyucuları (src/cad) — DXF + Netcad NCZ ve geometri yardımcıları.
// DXF testleri metni test içinde kurar. NCZ testleri, tests/ref/ncz_ref.html varsa özgün betiği node:vm
// içinde sahte bir DOM ile çalıştırır: özgün yazıcı (buildNCZ) ile üretilen baytlar port ile okunur ve
// özgün okuyucu (convertNCZ) ile karşılaştırılır. Referans dosya yoksa bu testler atlanır; gömülü
// (base64) küçük NCZ ile yapılan testler her zaman çalışır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseCad, parseDXF, parseNCZ, cadBBox, snapCandidates, nearestSnap, armsAt, SNAP_KINDS,
  ACI_RGB, aciCSS, KNOWN_SYMBOLS,
} from '../src/cad/index.js';
import { decodeLatin1Tr, arcBBox } from '../src/cad/dxf.js';
import { nczArcAngles } from '../src/cad/ncz.js';

const REF_YOL = process.env.NCZ_REF ? pathToFileURL(path.resolve(process.env.NCZ_REF)) : new URL('./ref/ncz_ref.html', import.meta.url);
const REF_VAR = fs.existsSync(REF_YOL);
const refTest = (ad, fn) => (REF_VAR ? test(ad, fn) : test.skip(ad + ' (referans dosya yok)', fn));

const yakin = (a, b, tol = 1e-9, ad = '') => assert.ok(Math.abs(a - b) <= tol, `${ad} beklenen ${b}, bulunan ${a}`);
const enc = (s) => new TextEncoder().encode(s);

/* ------------------------------------------------------------------
   DXF kurucu: G(kod, değer, kod, değer, …) → satırlar
   ------------------------------------------------------------------ */
const G = (...a) => {
  let s = '';
  for (let i = 0; i < a.length; i += 2) s += String(a[i]).padStart(3) + '\r\n' + a[i + 1] + '\r\n';
  return s;
};
const KATMAN = (ad, renk, bayrak = 0) => G(0, 'LAYER', 2, ad, 70, bayrak, 62, renk, 6, 'CONTINUOUS');
const TABLOLAR = G(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, 6) +
  KATMAN('0', 7) + KATMAN('HAT', 1) + KATMAN('DIREK', 3) + KATMAN('YAZI', 2) + KATMAN('KAPALI', -5) + KATMAN('DONUK', 4, 1) +
  G(0, 'ENDTAB', 0, 'ENDSEC');
const belge = ({ baslik = '', bloklar = '', nesneler = '' }) => enc(
  G(0, 'SECTION', 2, 'HEADER') + baslik + G(0, 'ENDSEC') + TABLOLAR +
  G(0, 'SECTION', 2, 'BLOCKS') + bloklar + G(0, 'ENDSEC') +
  G(0, 'SECTION', 2, 'ENTITIES') + nesneler + G(0, 'ENDSEC', 0, 'EOF'));
const katmanAdi = (m, e) => m.layers[e.l].name;
const sec = (m, t, katman) => m.ents.filter((e) => e.t === t && (katman === undefined || katmanAdi(m, e) === katman));

/* ------------------------------------------------------------------
   DXF
   ------------------------------------------------------------------ */
test('DXF: temel nesneler, tabaka renkleri, kapalı/donuk tabaka, sınır kutusu, dilim', () => {
  const m = parseDXF(belge({
    baslik: G(9, '$ACADVER', 1, 'AC1015', 9, '$USERI1', 70, 39),
    nesneler:
      G(0, 'LINE', 8, 'HAT', 10, 0, 20, 0, 30, 0, 11, 10, 21, 5, 31, 0) +
      G(0, 'LINE', 8, 'HAT', 62, 5, 10, 0, 20, 1, 11, 10, 21, 6) +
      G(0, 'LINE', 8, 'HAT', 62, 256, 10, 0, 20, 2, 11, 10, 21, 7) +
      G(0, 'CIRCLE', 8, 'DIREK', 10, 20, 20, 20, 40, 3) +
      G(0, 'ARC', 8, '0', 10, 0, 20, 0, 40, 5, 50, 350, 51, 10) +
      G(0, 'POINT', 8, 'KAPALI', 10, -3, 20, -4) +
      G(0, 'LINE', 8, 'DONUK', 10, 1, 20, 1, 11, 2, 21, 2) +
      G(0, 'LINE', 8, 'YOK', 10, 3, 20, 3, 11, 4, 21, 4) +
      G(0, 'LINE', 8, 'HAT', 67, 1, 10, 1e6, 20, 1e6, 11, 2e6, 21, 2e6) + // kâğıt uzayı → atlanır
      G(0, 'XLINE', 8, 'HAT', 10, 0, 20, 0, 11, 1, 21, 0),
  }));
  assert.equal(m.format, 'DXF');
  assert.equal(m.dom, 39);
  assert.deepEqual(m.stats, { LINE: 5, CIRCLE: 1, ARC: 1, POINT: 1 });
  assert.equal(m.ents.length, 8);
  const hat = sec(m, 'L', 'HAT');
  assert.deepEqual(hat.map((e) => e.c), [1, 5, 1]); // BYLAYER, açık renk, 256 = BYLAYER
  assert.deepEqual([hat[0].x1, hat[0].y1, hat[0].x2, hat[0].y2], [0, 0, 10, 5]);
  const c = sec(m, 'C')[0];
  assert.deepEqual([c.x, c.y, c.r, c.c, katmanAdi(m, c)], [20, 20, 3, 3, 'DIREK']);
  const a = sec(m, 'A')[0];
  assert.deepEqual([a.x, a.y, a.r, a.a1, a.a2, a.c], [0, 0, 5, 350, 10, 7]);
  const n = sec(m, 'N')[0];
  assert.deepEqual([n.x, n.y, n.c], [-3, -4, 5]);
  const L = Object.fromEntries(m.layers.map((l) => [l.name, l]));
  assert.deepEqual(L.HAT, { name: 'HAT', aci: 1 });
  assert.deepEqual(L.KAPALI, { name: 'KAPALI', aci: 5, off: true });
  assert.deepEqual(L.DONUK, { name: 'DONUK', aci: 4, off: true });
  assert.deepEqual(L.YOK, { name: 'YOK', aci: 7 });
  assert.equal(sec(m, 'L', 'YOK')[0].c, 7);
  assert.ok(!('YAZI' in L), 'kullanılmayan tabaka listelenmez');
  // sınır kutusu: yay 350°→10° yalnız doğu ucunu (x=5) kapsar; kâğıt uzayı doğrusu dışarıda
  yakin(m.bbox.minE, -3); yakin(m.bbox.minN, -4); yakin(m.bbox.maxE, 23); yakin(m.bbox.maxN, 23);
  assert.deepEqual(cadBBox(m), m.bbox);
  const gizli = new Set([m.layers.findIndex((l) => l.name === 'DIREK'), m.layers.findIndex((l) => l.name === 'KAPALI')]);
  const b2 = cadBBox(m, gizli);
  yakin(b2.minE, 0); yakin(b2.maxE, 10); yakin(b2.maxN, 7); yakin(b2.minN, -5 * Math.sin(10 * Math.PI / 180), 1e-12);
  assert.ok(m.warnings.some((w) => /XLINE×1/.test(w)), 'desteklenmeyen nesne uyarısı');
  assert.doesNotThrow(() => JSON.stringify(m));
});

test('DXF: LWPOLYLINE bulge + kapalı bayrağı, eski POLYLINE/VERTEX bulge + kapalı', () => {
  const m = parseDXF(belge({
    nesneler:
      // (0,0)→(2,0) bulge 1: merkez (1,0), alttan geçen yarım daire; kapalı
      G(0, 'LWPOLYLINE', 8, 'HAT', 90, 3, 70, 1, 10, 0, 20, 0, 42, 1, 10, 2, 20, 0, 10, 1, 20, 3) +
      // açık, bulge yok
      G(0, 'LWPOLYLINE', 8, 'DIREK', 90, 3, 70, 0, 10, 0, 20, 0, 10, 5, 20, 0, 10, 5, 20, 5) +
      // eski tip, kapalı; son köşeden ilk köşeye bulge −1 (saat yönünde yarım daire)
      G(0, 'POLYLINE', 8, 'YAZI', 66, 1, 70, 1, 0, 'VERTEX', 8, 'YAZI', 10, 10, 20, 0, 0, 'VERTEX', 8, 'YAZI', 10, 14, 20, 0, 42, 0,
        0, 'VERTEX', 8, 'YAZI', 10, 12, 20, 0, 42, -1, 0, 'SEQEND') +
      // eski tip, açık, ilk parçada çeyrek daire (bulge = tan(22.5°))
      G(0, 'POLYLINE', 8, '0', 66, 1, 70, 0, 0, 'VERTEX', 8, '0', 10, 1, 20, 0, 42, Math.tan(Math.PI / 8),
        0, 'VERTEX', 8, '0', 10, 0, 20, 1, 0, 'SEQEND'),
  }));
  assert.deepEqual(m.stats, { LWPOLYLINE: 2, POLYLINE: 2 });
  const p1 = sec(m, 'P', 'HAT')[0];
  assert.equal(p1.closed, true);
  assert.equal(p1.c, 1);
  assert.deepEqual(p1.v.slice(0, 2), [0, 0]);
  assert.deepEqual(p1.v.slice(-2), [1, 3]); // kapanış köşesi yinelenmez
  const n1 = p1.v.length / 2;
  assert.ok(n1 >= 14, 'yarım daire en az 12 kirişe bölünür');
  let alt = false;
  for (let i = 0; i < n1 - 1; i++) { // son köşe hariç hepsi merkez (1,0) yarıçap 1 çemberinde ve y ≤ 0
    yakin(Math.hypot(p1.v[2 * i] - 1, p1.v[2 * i + 1]), 1, 1e-12);
    assert.ok(p1.v[2 * i + 1] <= 1e-12);
    if (Math.abs(p1.v[2 * i] - 1) < 1e-9 && Math.abs(p1.v[2 * i + 1] + 1) < 1e-9) alt = true;
  }
  assert.ok(alt, 'yay (1,−1) noktasından geçer');
  const p2 = sec(m, 'P', 'DIREK')[0];
  assert.deepEqual(p2.v, [0, 0, 5, 0, 5, 5]);
  assert.equal(p2.closed, false);
  assert.equal(p2.c, 3);
  const p3 = sec(m, 'P', 'YAZI')[0];
  assert.equal(p3.closed, true);
  assert.deepEqual(p3.v.slice(0, 6), [10, 0, 14, 0, 12, 0]);
  assert.ok(p3.v.length > 6, 'kapanış parçasındaki bulge kirişlere bölünür');
  for (let i = 6; i < p3.v.length; i += 2) { // (12,0)→(10,0) saat yönünde: merkez (11,0), 0°'den −90° üzerinden 180°'ye (alttan)
    yakin(Math.hypot(p3.v[i] - 11, p3.v[i + 1]), 1, 1e-12);
    assert.ok(p3.v[i + 1] < 0);
  }
  const p4 = sec(m, 'P', '0')[0];
  assert.equal(p4.closed, false);
  assert.deepEqual(p4.v.slice(0, 2), [1, 0]);
  yakin(p4.v[p4.v.length - 2], 0, 1e-12); yakin(p4.v[p4.v.length - 1], 1, 1e-12);
  for (let i = 0; i < p4.v.length; i += 2) yakin(Math.hypot(p4.v[i], p4.v[i + 1]), 1, 1e-12); // merkez (0,0)
});

test('DXF: TEXT (\\U+ kaçışları, %%d %%c %%p, hizalama), MTEXT biçim kodları, ATTRIB', () => {
  const m = parseDXF(belge({
    nesneler:
      G(0, 'TEXT', 8, 'YAZI', 10, 1, 20, 2, 40, 2.5, 1, '\\U+00C7ubuk 45%%d %%c16 %%p0.5 \\U+0130\\U+011F', 50, 30) +
      G(0, 'TEXT', 8, 'YAZI', 62, 4, 10, 0, 20, 0, 40, 1, 1, 'ORTA', 72, 1, 11, 7, 21, 8) +
      G(0, 'TEXT', 8, 'YAZI', 10, 5, 20, 5, 40, 1, 1, '   ') + // boş → atlanır
      G(0, 'MTEXT', 8, 'HAT', 10, 3, 20, 4, 40, 1.2, 71, 5, 3, '{\\fArial|b0|i0;Trafo} \\P400', 1, ' kVA\\~x \\S1^2; \\\\ %%d', 50, 90) +
      G(0, 'MTEXT', 8, 'HAT', 10, 0, 20, 0, 40, 1, 1, 'Yön', 11, 0, 21, 1) +
      G(0, 'INSERT', 8, 'DIREK', 66, 1, 2, 'YOKBLOK', 10, 50, 20, 60) +
      G(0, 'ATTRIB', 8, 'DIREK', 10, 51, 20, 61, 40, 0.8, 1, 'D-12', 2, 'NO', 70, 0) +
      G(0, 'ATTRIB', 8, 'DIREK', 10, 51, 20, 62, 40, 0.8, 1, 'gizli', 2, 'X', 70, 1) +
      G(0, 'SEQEND'),
  }));
  const t = sec(m, 'T', 'YAZI');
  assert.equal(t.length, 2);
  assert.equal(t[0].s, 'Çubuk 45° ⌀16 ±0.5 İğ');
  assert.deepEqual([t[0].x, t[0].y, t[0].h, t[0].rot, t[0].c], [1, 2, 2.5, 30, 2]);
  assert.equal(t[0].ha, undefined);
  assert.deepEqual([t[1].x, t[1].y, t[1].ha, t[1].c, t[1].s], [7, 8, 1, 4, 'ORTA']); // hizalı yazı: konum 11/21
  const mt = sec(m, 'T', 'HAT');
  assert.equal(mt[0].s, 'Trafo\n400 kVA x 1/2 \\ °');
  assert.deepEqual([mt[0].x, mt[0].y, mt[0].h, mt[0].rot, mt[0].ha, mt[0].va, mt[0].c], [3, 4, 1.2, 90, 1, 2, 1]);
  assert.equal(mt[1].s, 'Yön');
  yakin(mt[1].rot, 90); // yön vektöründen
  assert.equal(mt[1].va, 3);
  const at = sec(m, 'T', 'DIREK');
  assert.deepEqual(at.map((e) => e.s), ['D-12']); // görünmez öznitelik atlanır
  // tanımı olmayan blok: konumu nokta olarak korunur + uyarı
  const n = sec(m, 'N', 'DIREK')[0];
  assert.deepEqual([n.x, n.y, n.c], [50, 60, 3]);
  assert.ok(m.warnings.some((w) => /YOKBLOK/.test(w)));
});

test('DXF: blok patlatma — taban noktası, dönme/ölçek, ayna, iç içe blok, renk kalıtımı', () => {
  const B1 = G(0, 'BLOCK', 8, '0', 2, 'B1', 70, 0, 10, 1, 20, 2, 30, 0, 3, 'B1') +
    G(0, 'LINE', 8, '0', 10, 1, 20, 2, 11, 3, 21, 2) +                 // tabaka 0 + BYLAYER → INSERT'in tabakası
    G(0, 'ARC', 8, '0', 62, 0, 10, 1, 20, 2, 40, 1, 50, 0, 51, 90) +   // BYBLOCK → INSERT'in rengi
    G(0, 'CIRCLE', 8, 'DIREK', 10, 2, 20, 2, 40, 0.5) +                // kendi tabakası + BYLAYER
    G(0, 'TEXT', 8, '0', 62, 2, 10, 1, 20, 3, 40, 1, 1, 'A') +         // açık renk
    G(0, 'ENDBLK', 8, '0');
  const B2 = G(0, 'BLOCK', 8, '0', 2, 'B2', 70, 0, 10, 0, 20, 0, 30, 0) +
    G(0, 'INSERT', 8, '0', 62, 0, 2, 'b1', 10, 10, 20, 0, 50, 90) +    // BYBLOCK; ad büyük-küçük harf duyarsız
    G(0, 'LINE', 8, '0', 62, 6, 10, 0, 20, 0, 11, 1, 21, 0) +
    G(0, 'ENDBLK', 8, '0');
  const kur = (ek) => parseDXF(belge({ bloklar: B1 + B2, nesneler: ek }));
  const al = (m) => ({ L: sec(m, 'L')[0], A: sec(m, 'A')[0], C: sec(m, 'C')[0], T: sec(m, 'T')[0] });

  // 1) düz ekleme: taban noktası (1,2) çıkarılır
  let m = kur(G(0, 'INSERT', 8, 'HAT', 2, 'B1', 10, 100, 20, 50));
  let p = al(m);
  assert.deepEqual(m.stats, { INSERT: 1 });
  assert.equal(m.ents.length, 4);
  assert.deepEqual([p.L.x1, p.L.y1, p.L.x2, p.L.y2, p.L.c, katmanAdi(m, p.L)], [100, 50, 102, 50, 1, 'HAT']);
  assert.deepEqual([p.A.x, p.A.y, p.A.r, p.A.a1, p.A.a2, p.A.c, katmanAdi(m, p.A)], [100, 50, 1, 0, 90, 1, 'HAT']);
  assert.deepEqual([p.C.x, p.C.y, p.C.r, p.C.c, katmanAdi(m, p.C)], [101, 50, 0.5, 3, 'DIREK']);
  assert.deepEqual([p.T.x, p.T.y, p.T.h, p.T.rot, p.T.c, p.T.s], [100, 51, 1, 0, 2, 'A']);

  // 2) 90° dönük, 2 kat ölçekli, açık renkli (4) ekleme
  m = kur(G(0, 'INSERT', 8, 'HAT', 62, 4, 2, 'B1', 10, 200, 20, 50, 41, 2, 42, 2, 50, 90));
  p = al(m);
  yakin(p.L.x1, 200); yakin(p.L.y1, 50); yakin(p.L.x2, 200, 1e-9); yakin(p.L.y2, 54);
  assert.equal(p.L.c, 1, 'tabaka 0 + BYLAYER nesne INSERT tabakasının rengini alır');
  yakin(p.A.x, 200); yakin(p.A.y, 50); yakin(p.A.r, 2); yakin(p.A.a1, 90); yakin(p.A.a2, 180);
  assert.equal(p.A.c, 4, 'BYBLOCK nesne INSERT rengini alır');
  yakin(p.C.x, 200, 1e-9); yakin(p.C.y, 52); yakin(p.C.r, 1); assert.equal(p.C.c, 3);
  yakin(p.T.x, 198); yakin(p.T.y, 50, 1e-9); yakin(p.T.h, 2); yakin(p.T.rot, 90); assert.equal(p.T.c, 2);

  // 3) X ekseninde aynalı ekleme (41 = −1; 42 verilmemiş → 1)
  m = kur(G(0, 'INSERT', 8, 'HAT', 2, 'B1', 10, 300, 20, 50, 41, -1));
  p = al(m);
  yakin(p.L.x1, 300); yakin(p.L.y1, 50); yakin(p.L.x2, 298); yakin(p.L.y2, 50);
  yakin(p.A.x, 300); yakin(p.A.y, 50); yakin(p.A.r, 1);
  yakin(p.A.a1, 90); yakin(p.A.a2, 180); // 0°→90° yayının aynası 90°→180°
  yakin(p.C.x, 299); yakin(p.C.y, 50); yakin(p.C.r, 0.5);
  yakin(p.T.x, 300); yakin(p.T.y, 51);

  // 4) aynalı + dönük: sx=−1, rot=90 → α yönü (270° − α)'ya gider
  m = kur(G(0, 'INSERT', 8, 'HAT', 2, 'B1', 10, 0, 20, 0, 41, -1, 50, 90));
  p = al(m);
  yakin(p.L.x2, 0, 1e-9); yakin(p.L.y2, -2);
  yakin(p.A.a1, 180); yakin(p.A.a2, 270);
  { // yayın uç noktaları, dönüştürülmüş blok-yerel uçlarla çakışmalı: yerel (1,0)→(0,−1), yerel (0,1)→(−1,0)
    const u = (a) => [p.A.x + p.A.r * Math.cos(a * Math.PI / 180), p.A.y + p.A.r * Math.sin(a * Math.PI / 180)];
    const u1 = u(p.A.a1), u2 = u(p.A.a2);
    yakin(u2[0], 0, 1e-9); yakin(u2[1], -1, 1e-9); yakin(u1[0], -1, 1e-9); yakin(u1[1], 0, 1e-9);
  }

  // 5) eşit olmayan ölçek: daire ve yay çoklu doğruya (elips) dönüşür
  m = kur(G(0, 'INSERT', 8, 'HAT', 2, 'B1', 10, 0, 20, 0, 41, 2, 42, 1));
  assert.equal(sec(m, 'C').length, 0);
  assert.equal(sec(m, 'A').length, 0);
  const el = sec(m, 'P', 'DIREK')[0];
  assert.equal(el.closed, true);
  assert.equal(el.v.length, 144);
  for (let i = 0; i < el.v.length; i += 2) yakin(((el.v[i] - 2) / 1) ** 2 + (el.v[i + 1] / 0.5) ** 2, 1, 1e-9); // merkez (2,0), yarı eksenler 1 ve 0.5

  // 6) iç içe: B2 (400,0)'a 90° dönük; içinde B1 (10,0)'a 90° dönük → toplam 180°, konum (400,10)
  m = kur(G(0, 'INSERT', 8, 'HAT', 62, 30, 2, 'B2', 10, 400, 20, 0, 50, 90));
  assert.equal(m.ents.length, 5);
  const ls = sec(m, 'L');
  const b1l = ls.find((e) => e.c !== 6), b2l = ls.find((e) => e.c === 6);
  yakin(b2l.x1, 400); yakin(b2l.y1, 0); yakin(b2l.x2, 400, 1e-9); yakin(b2l.y2, 1);
  yakin(b1l.x1, 400, 1e-9); yakin(b1l.y1, 10); yakin(b1l.x2, 398, 1e-9); yakin(b1l.y2, 10, 1e-9);
  assert.equal(b1l.c, 1); assert.equal(katmanAdi(m, b1l), 'HAT');
  p = al(m);
  yakin(p.A.x, 400, 1e-9); yakin(p.A.y, 10); yakin(p.A.a1, 180); yakin(p.A.a2, 270);
  assert.equal(p.A.c, 30, 'BYBLOCK rengi iç içe INSERT zincirinden kalıtılır');
  yakin(p.C.x, 399, 1e-9); yakin(p.C.y, 10, 1e-9);
  yakin(p.T.x, 400, 1e-9); yakin(p.T.y, 9, 1e-9); yakin(p.T.rot, 180, 1e-9); // dönme iki kez sayılmaz
  yakin(m.bbox.minE, 398, 1e-9); yakin(m.bbox.maxN, 10.5, 1e-9);

  // 7) OCS: ekstrüzyon −Z olan yay X ekseninde aynalanır
  m = kur(G(0, 'ARC', 8, 'HAT', 10, 5, 20, 1, 40, 2, 50, 0, 51, 60, 210, 0, 220, 0, 230, -1));
  p = al(m);
  yakin(p.A.x, -5); yakin(p.A.y, 1); yakin(p.A.a1, 120); yakin(p.A.a2, 180);

  // 8) MINSERT: 2 sütun × 2 satır
  m = kur(G(0, 'INSERT', 8, 'HAT', 2, 'B1', 10, 0, 20, 0, 70, 2, 71, 2, 44, 10, 45, 20));
  assert.deepEqual(sec(m, 'L').map((e) => [e.x1, e.y1]), [[0, 0], [10, 0], [0, 20], [10, 20]]);
});

test('DXF: ELLIPSE, SPLINE, SOLID, HATCH, halka (donut), 3DFACE', () => {
  const m = parseDXF(belge({
    nesneler:
      G(0, 'ELLIPSE', 8, 'HAT', 10, 10, 20, 20, 11, 4, 21, 0, 40, 0.5, 41, 0, 42, 2 * Math.PI) +
      G(0, 'ELLIPSE', 8, 'DIREK', 10, 0, 20, 0, 11, 0, 21, 3, 40, 1, 41, 0, 42, Math.PI / 2) +
      // 2. derece Bézier: (0,0),(1,2),(2,0) → orta nokta (1,1)
      G(0, 'SPLINE', 8, 'YAZI', 70, 8, 71, 2, 72, 6, 73, 3, 40, 0, 40, 0, 40, 0, 40, 1, 40, 1, 40, 1, 10, 0, 20, 0, 10, 1, 20, 2, 10, 2, 20, 0) +
      G(0, 'SOLID', 8, '0', 62, 3, 10, 0, 20, 0, 11, 1, 21, 0, 12, 0, 22, 1, 13, 1, 23, 1) +
      G(0, 'HATCH', 8, 'KAPALI', 10, 0, 20, 0, 30, 0, 210, 0, 220, 0, 230, 1, 2, 'SOLID', 70, 1, 71, 0, 91, 1,
        92, 1, 93, 4, 72, 1, 10, 0, 20, 0, 11, 4, 21, 0, 72, 1, 10, 4, 20, 0, 11, 4, 21, 4,
        72, 1, 10, 4, 20, 4, 11, 0, 21, 4, 72, 1, 10, 0, 20, 4, 11, 0, 21, 0, 97, 0, 75, 0, 76, 1, 98, 1, 10, 2, 20, 2) +
      G(0, 'HATCH', 8, 'DONUK', 10, 0, 20, 0, 30, 0, 2, 'ANSI31', 70, 0, 71, 0, 91, 1,
        92, 2, 72, 0, 73, 1, 93, 3, 10, 0, 20, 0, 10, 2, 20, 0, 10, 1, 20, 2, 97, 0, 75, 0, 76, 1, 52, 0, 41, 1, 77, 0, 78, 0, 98, 1, 10, 1, 20, 1) +
      G(0, 'LWPOLYLINE', 8, 'YOK', 90, 2, 70, 1, 43, 1, 10, 5, 20, 5, 42, 1, 10, 6, 20, 5, 42, 1) +
      G(0, '3DFACE', 8, 'YOK', 10, 0, 20, 0, 11, 1, 21, 0, 12, 1, 22, 1, 13, 0, 23, 1),
  }));
  const e1 = sec(m, 'P', 'HAT')[0];
  assert.equal(e1.closed, true);
  assert.equal(e1.v.length, 144); // tam elips: 72 kiriş
  yakin(e1.v[0], 14); yakin(e1.v[1], 20);
  yakin(e1.v[36], 10, 1e-9); yakin(e1.v[37], 22); // t = 90°
  const e2 = sec(m, 'P', 'DIREK')[0];
  assert.equal(e2.closed, false);
  assert.equal(e2.v.length, 2 * 19); // çeyrek elips: 18 kiriş
  yakin(e2.v[0], 0); yakin(e2.v[1], 3); yakin(e2.v[36], -3, 1e-9); yakin(e2.v[37], 0, 1e-9);
  const sp = sec(m, 'P', 'YAZI')[0];
  assert.deepEqual(sp.v.slice(0, 2), [0, 0]);
  assert.deepEqual(sp.v.slice(-2), [2, 0]);
  const orta = sp.v.length / 2 >> 1;
  yakin(sp.v[2 * orta], 1, 1e-9); yakin(sp.v[2 * orta + 1], 1, 1e-9);
  for (let i = 0; i < sp.v.length; i += 2) { const t = sp.v[i] / 2; yakin(sp.v[i + 1], 4 * t * (1 - t), 1e-9); } // y = 4t(1−t)
  const so = sec(m, 'F', '0')[0];
  assert.deepEqual(so.v, [0, 0, 1, 0, 1, 1, 0, 1]); // köşe sırası 10,11,13,12
  assert.equal(so.c, 3);
  const h1 = sec(m, 'F', 'KAPALI')[0];
  assert.deepEqual(h1.v, [0, 0, 4, 0, 4, 4, 0, 4]); // tohum noktası (98/10/20) sınıra karışmaz
  assert.equal(h1.pat, undefined);
  const h2 = sec(m, 'F', 'DONUK')[0];
  assert.deepEqual(h2.v, [0, 0, 2, 0, 1, 2]);
  assert.equal(h2.pat, 1); // desenli tarama işaretlenir
  const dn = sec(m, 'F', 'YOK')[0]; // halka: merkez (5.5,5), dış yarıçap 0.5 + 0.5
  for (let i = 0; i < dn.v.length; i += 2) yakin(Math.hypot(dn.v[i] - 5.5, dn.v[i + 1] - 5), 1, 1e-12);
  const f3 = sec(m, 'P', 'YOK')[0];
  assert.deepEqual([f3.v, f3.closed], [[0, 0, 1, 0, 1, 1, 0, 1], true]);

  // HATCH yay kenarı: üst yarım daire + taban doğrusu; saat yönü tersine (73=1) ve saat yönünde (73=0, açılar aynalı)
  for (const [ccw, a0, a1] of [[1, 0, 180], [0, 180, 360]]) {
    const h = parseDXF(belge({
      nesneler: G(0, 'HATCH', 8, 'HAT', 10, 0, 20, 0, 30, 0, 2, 'SOLID', 70, 1, 71, 1, 91, 1, 92, 1, 93, 2,
        72, 2, 10, 1, 20, 0, 40, 1, 50, a0, 51, a1, 73, ccw,
        72, 1, 10, ccw ? 0 : 2, 20, 0, 11, ccw ? 2 : 0, 21, 0, 97, 1, 330, 'ABC', 75, 1, 76, 1, 98, 1, 10, 1, 20, 0.5),
    })).ents;
    assert.equal(h.length, 1);
    const v = h[0].v;
    assert.equal(v.length, 2 * 37);
    yakin(v[0], ccw ? 2 : 0, 1e-9); yakin(v[v.length - 2], ccw ? 0 : 2, 1e-9);
    let tepe = false;
    for (let i = 0; i < v.length; i += 2) {
      yakin(Math.hypot(v[i] - 1, v[i + 1]), 1, 1e-9);
      assert.ok(v[i + 1] > -1e-9);
      if (Math.abs(v[i] - 1) < 1e-9 && Math.abs(v[i + 1] - 1) < 1e-9) tepe = true;
    }
    assert.ok(tepe);
  }
});

test('DXF: windows-1254 geri dönüşü, latin1 yedeği, ikili DXF ve parseCad hataları', () => {
  // UTF-8 olarak geçersiz baytlar → windows-1254: İ=0xDD ş=0xFE ğ=0xF0 ı=0xFD Ş=0xDE Ğ=0xD0
  const govde = G(0, 'SECTION', 2, 'ENTITIES', 0, 'TEXT', 8, 'TÜ', 10, 0, 20, 0, 40, 1, 1, 'XXXXXX', 0, 'ENDSEC', 0, 'EOF');
  const b = Uint8Array.from(govde, (ch) => ch.charCodeAt(0)); // Ü = 0xDC tek bayt
  const k = govde.indexOf('XXXXXX');
  b.set([0xDD, 0xFE, 0xF0, 0xFD, 0xDE, 0xD0], k);
  const m = parseCad(b, 'Plan.DXF');
  assert.equal(m.ents[0].s, 'İşğıŞĞ');
  assert.equal(m.layers[0].name, 'TÜ');
  assert.equal(decodeLatin1Tr(Uint8Array.of(0xDD, 0xFE, 0xF0, 0xFD, 0xDE, 0xD0, 0xDC, 0x41)), 'İşğıŞĞÜA');
  assert.equal(parseCad(b.buffer, 'a.b.dxf').ents.length, 1, 'ArrayBuffer da kabul edilir');
  assert.throws(() => parseDXF(enc('AutoCAD Binary DXF\r\n\x1a\0')), /ikili|binary/i);
  assert.throws(() => parseCad(b, 'plan.dwg'), (e) => e.code === 'CAD_EXT' && /\.dwg/.test(e.message) && /dxf/.test(e.message));
  assert.throws(() => parseCad(b, 'plan'), (e) => e.code === 'CAD_EXT');
  assert.throws(() => parseCad(enc(G(0, 'SECTION', 2, 'ENTITIES', 0, 'ENDSEC', 0, 'EOF')), 'bos.dxf'), (e) => e.code === 'CAD_EMPTY' && /nesne bulunamadı/.test(e.message));
  assert.throws(() => parseCad(new Uint8Array(4096), 'bos.NCZ'), (e) => e.code === 'CAD_EMPTY' && /NCZ/.test(e.message));
});

test('ACI: tablo ve koyu zeminde görünürlük', () => {
  assert.equal(ACI_RGB.length, 256);
  assert.deepEqual(ACI_RGB.slice(1, 8), [[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 255, 255]]);
  assert.deepEqual(ACI_RGB[250], [0, 0, 0]);
  assert.equal(aciCSS(1, true), 'rgb(255,0,0)');
  for (const a of [7, 250, 0, 256, undefined, null, 999]) assert.equal(aciCSS(a, true), '#E2E8F0');
  assert.equal(aciCSS(-1, true), 'rgb(255,0,0)'); // negatif (kapalı tabaka) rengi mutlak değerle
  assert.equal(aciCSS(7, false), '#22303F');
  assert.equal(aciCSS(250, false), 'rgb(0,0,0)');
  assert.equal(aciCSS(3), 'rgb(0,255,0)');
});

/* ------------------------------------------------------------------
   NCZ — kayıt kurucu (yazıcının desteklemediği sembol ve "bitiş açılı" yay kayıtları için)
   ------------------------------------------------------------------ */
function nczKayit(tip, tabaka, K, D, kutu, kuyruk) {
  const u = new Uint8Array(86 + kuyruk.length), dv = new DataView(u.buffer);
  u[0] = 0x15; dv.setUint32(1, 81 + kuyruk.length, true);
  u[5] = tip; u[6] = tip; u[7] = tabaka;
  dv.setFloat64(8, K, true); dv.setFloat64(16, D, true);
  dv.setUint32(35, tabaka, true);
  for (let i = 0; i < 4; i++) dv.setFloat64(50 + 8 * i, kutu[i], true);
  u.set(kuyruk, 86);
  return u;
}
const sembolKuyruk = (olcek, donDeg, no) => { const t = new Uint8Array(11), dv = new DataView(t.buffer); dv.setFloat32(0, olcek, true); dv.setFloat32(4, donDeg * Math.PI / 180, true); dv.setUint16(8, no, true); return t; };
const yayKuyruk = (r, a1Deg, a2Deg) => { const t = new Uint8Array(34), dv = new DataView(t.buffer); dv.setFloat64(0, r, true); dv.setFloat64(18, a1Deg * Math.PI / 180, true); dv.setFloat64(26, a2Deg * Math.PI / 180, true); return t; };
const birlestir = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
// Ek kayıtları dosyanın son (0x0E) kaydından önce yerleştirir ve başlıktaki boyu günceller
function nczEkle(bayt, ...kayitlar) {
  const o = birlestir(bayt.subarray(0, bayt.length - 86), ...kayitlar, bayt.subarray(bayt.length - 86));
  new DataView(o.buffer).setUint32(5, o.length, true);
  return o;
}

// Özgün yazıcıyla üretilip (LINE, CIRCLE, ARC 30°→140°, TEXT, POLYLINE, POINT) yalnız başlık + tabaka tablosu +
// nesne bölümüne indirgenmiş, sonuna sembol 15 (ölçek 2, 90°), bilinmeyen sembol 777 (ölçek 1.5) ve ikinci açısı
// BİTİŞ açısı olarak yazılmış bir yay (20°→100°) eklenmiş 1413 baytlık NCZ.
const KUCUK_NCZ = 'AXgAAACFBQAAeAAAAHgAAAB4AAAAAAAAAAAAAAB4AAAAeAAAAHgAAAB4AAAAGwEAAAAAAACpBVBBAAAAABCGHkEAAAAAuAVQQQAAAADYhh5BGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAABp4AAAABAAAAAAAAAQABAQUA/QASAAEwTkNfREVGQVVMVAAAAAAAAAAAAAEAAQD9gxYADlBBUlNFTF9OT0tUQVNJAAAAAAAAAAABAP2AEgAKUEFSU0VMX0hB' +
  'VAAAAAAAAAAAAACcAAED/YESAAdERdBfTk9LQVVMVAAAAAAAAAAAABMAAQD9gBIAATQAAAAAAAAAAAAAAAAAAAAAAAAACgABABcAAAAAFWgAAAABAQHb+X7yqwVQQfyp8dJthh5BAAAA' +
  'AAAAAAAAAAABAAAAAAAAAAAAAAAAAADQ+X7yqwVQQUup8dJthh5B5vl+8qsFUEGtqvHSbYYeQQAAAAACUDEAAAAAAAAAAAAAAAAAAAAAAAAAABW0AAAABwcCAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAKkFUEEAAAAAEIYeQQAAAMCxBVBBAAAAALCGHkEAAAAAA1lPTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKkFUEEAAAAAEIYe' +
  'QQAAAAAAAAAAAAAAgLAFUEEAAAAAOIYeQQAAAAAAAAAAAAAAwLEFUEEAAAAAsIYeQQAAAAAAAAAAFWUAAAACAgIAAAAAqQVQQQAAAAAQhh5BAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAA' +
  'AAAAAAAAqQVQQQAAAAAQhh5BAAAAAK4FUEEAAAAA2IYeQQAAAAAAAAAArgVQQQAAAADYhh5BAAAAABVZAAAAAwMCAAAAgKsFUEEAAAAAYIYeQQAAAAAAAAAAAAAAAgAAAAAAAAAAAAAA' +
  'AAAAAAAAoKkFUEEAAAAAQoYeQQAAAGCtBVBBAAAAAH6GHkEAAAAAAAAAAAAAHkAVcwAAAAQEAgAAAACzBVBBAAAAAIiGHkEAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAIC0BVBB' +
  'yYvYOmOGHkEAAAAAtgVQQYRcuJGxhh5BAAAAAAAAAAAAAChAAAAAAAAAAAAAAGVzLThSweA/Ov79ZsG3/j8VagAAAAUFAgAAAAC4BVBBAAAAACSGHkEAAAAAAAAAAAAAAAIAAAAAAAAA' +
  'AAAAAAAAAAAAAAC4BVBBAAAAAB+GHkGKZpDKuwVQQR9zDxF+hh5BAAAAAAAAIECSCgY/TQAADcfQ3dbe3CDn8P32/vwVXAAAAAYGAwAAAIC1BVBBAAAAAACHHkEAAAAAAAAAAAAAAAMA' +
  'AAAAAAAAAAAAAAAAAAAAAAC1BVBBAAAAAPiGHkEAAAAAtgVQQQAAAAAIhx5BAAAAAAAAAEDbD8k/DwAAFVwAAAAGBgMAAADAtgVQQQAAAAAUhx5BAAAAAAAAAAAAAAADAAAAAAAAAAAA' +
  'AAAAAAAAAACAtgVQQQAAAAAQhx5BAAAAALcFUEEAAAAAGIceQQAAAAAAAMA/AAAAAAkDABVzAAAABAQCAAAAAMIFUEEAAAAAoIceQQAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAjZTk' +
  '2sIFUEGcuNcNmYceQQAAAIDEBVBB59JzlsWHHkEAAAAAAAAAAAAAJEAAAAAAAAAAAAAAh0TnShhX1j+pFaFd3uz7PxVRAAAADg4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

test('NCZ: gömülü küçük dosya — nesneler, tabakalar, Türkçe yazı, nokta, sembol, yay sezgisi', () => {
  const bayt = Uint8Array.from(Buffer.from(KUCUK_NCZ, 'base64'));
  assert.equal(bayt.length, 1413);
  const m = parseCad(bayt, 'ornek.NcZ');
  assert.equal(m.format, 'NCZ');
  assert.equal(m.dom, null);
  assert.deepEqual(m.layers, [{ name: 'PARSEL_NOKTASI', aci: 7 }, { name: 'PARSEL_HAT', aci: 7 }, { name: 'DEĞ_NOK', aci: 7 }]);
  assert.deepEqual(m.stats, { POINT: 1, POLYLINE: 1, LINE: 1, CIRCLE: 1, ARC: 2, TEXT: 1, INSERT: 2 });
  assert.ok(m.ents.every((e) => e.c === 7));
  const [nk, pl, ln, da, yay, yz, sn, sd, sl1, sl2, bn, bd, yay2] = m.ents;
  assert.equal(m.ents.length, 13);
  assert.deepEqual(nk, { t: 'N', l: 0, c: 7, x: 500123.456, y: 4200111.789, z: 0, name: 'P1' });
  assert.deepEqual(pl, { t: 'P', l: 1, c: 7, v: [500100, 4200100, 500110, 4200130, 500140, 4200135], closed: false });
  assert.deepEqual(ln, { t: 'L', l: 1, c: 7, x1: 500100, y1: 4200100, x2: 500150, y2: 4200120 });
  assert.deepEqual(da, { t: 'C', l: 1, c: 7, x: 500120, y: 4200110, r: 7.5 });
  // yazıcı süpürme yazar (başlangıç 30°, süpürme 110°) → bitiş 140°
  assert.deepEqual([yay.t, yay.x, yay.y, yay.r], ['A', 500130, 4200140, 12]);
  yakin(yay.a1, 30, 1e-9); yakin(yay.a2, 140, 1e-9);
  assert.deepEqual([yz.t, yz.x, yz.y, yz.h, yz.s], ['T', 500105, 4200160, 2.5, 'ÇĞİÖŞÜ çğıöşü']);
  yakin(yz.rot, 30, 1e-5); // f32 radyan
  // bilinen sembol 15: daire r=1.5 + artı; ölçek 2, 90° dönük → nokta + 3 ilkel, tabaka 3 (DEĞ_NOK)
  assert.deepEqual(sn, { t: 'N', l: 2, c: 7, x: 500160, y: 4200150, sym: 15 });
  assert.deepEqual(sd, { t: 'C', l: 2, c: 7, x: 500160, y: 4200150, r: 3 });
  assert.equal(KNOWN_SYMBOLS[15].length, 3);
  yakin(sl1.x1, 500160, 1e-6); yakin(sl1.y1, 4200147, 1e-6); yakin(sl1.x2, 500160, 1e-6); yakin(sl1.y2, 4200153, 1e-6);
  yakin(sl2.x1, 500157, 1e-6); yakin(sl2.y1, 4200150, 1e-6); yakin(sl2.x2, 500163, 1e-6); yakin(sl2.y2, 4200150, 1e-6);
  // bilinmeyen sembol: nokta + 0.4×ölçek yarıçaplı daire + uyarı
  assert.deepEqual(bn, { t: 'N', l: 2, c: 7, x: 500165, y: 4200155, sym: 777 });
  assert.deepEqual([bd.t, bd.x, bd.y], ['C', 500165, 4200155]);
  yakin(bd.r, 0.6, 1e-12);
  assert.ok(m.warnings.some((w) => /777/.test(w)));
  // bitiş açısı olarak yazılmış yay: saklı sınır kutusu bitiş yorumuna uyduğundan 20°→100° okunur
  assert.deepEqual([yay2.t, yay2.x, yay2.y, yay2.r], ['A', 500200, 4200200, 10]);
  yakin(yay2.a1, 20, 1e-9); yakin(yay2.a2, 100, 1e-9);
  yakin(m.bbox.minE, 500100); yakin(m.bbox.minN, 4200100); yakin(m.bbox.maxN, 4200210);
  yakin(m.bbox.maxE, 500200 + 10 * Math.cos(20 * Math.PI / 180), 1e-6);
  assert.doesNotThrow(() => JSON.stringify(m));
});

test('NCZ: yay açısı sezgisi (nczArcAngles) ve yay sınır kutusu', () => {
  const R = Math.PI / 180;
  const kutu = (cx, cy, r, a1, a2) => { const b = arcBBox(cx, cy, r, a1, a2); return [b[1], b[0], b[3], b[2]]; }; // [minK,minD,maxK,maxD]
  const yuvarla = (v) => Math.round(v * 1e9) / 1e9 + 0; // −0 → 0
  assert.deepEqual(arcBBox(0, 0, 1, 0, 90).map(yuvarla), [0, 0, 1, 1]);
  assert.deepEqual(arcBBox(0, 0, 2, 270, 90).map(yuvarla), [0, -2, 2, 2]);
  // kutu süpürme yorumuna uyuyor: 50° başlangıç, 200° süpürme → 50°→250°
  let a = nczArcAngles(10, 20, 5, 50 * R, 200 * R, kutu(10, 20, 5, 50, 250));
  yakin(a.a1, 50, 1e-9); yakin(a.a2, 250, 1e-9); assert.equal(a.full, false);
  // kutu bitiş yorumuna uyuyor: 50°→200°
  a = nczArcAngles(10, 20, 5, 50 * R, 200 * R, kutu(10, 20, 5, 50, 200));
  yakin(a.a1, 50, 1e-9); yakin(a.a2, 200, 1e-9);
  // ayırt edilemiyor (tam daire kutusu / kutu yok) → süpürme
  a = nczArcAngles(10, 20, 5, 50 * R, 200 * R, [15, 5, 25, 15]);
  yakin(a.a2, 250, 1e-9);
  a = nczArcAngles(10, 20, 5, 50 * R, 200 * R, null);
  yakin(a.a2, 250, 1e-9);
  // başlangıç 0 ise iki yorum aynı yayı verir
  a = nczArcAngles(0, 0, 1, 0, 90 * R, kutu(0, 0, 1, 0, 90));
  yakin(a.a1, 0); yakin(a.a2, 90, 1e-9);
  // 2π süpürme → tam daire
  assert.equal(nczArcAngles(0, 0, 1, 1, 2 * Math.PI, [-1, -1, 1, 1]).full, true);
});

/* ------------------------------------------------------------------
   NCZ — özgün betikle karşılaştırma (referans dosya varsa)
   ------------------------------------------------------------------ */
let refCtx = null;
function refYukle() {
  if (refCtx) return refCtx;
  const html = fs.readFileSync(REF_YOL, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'referans dosyada betik bulunamadı');
  const el = () => ({ style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, setAttribute() {}, appendChild() {}, dispatchEvent() {} });
  const ctx = vm.createContext({
    document: { getElementById: el, createElement: el, querySelectorAll: () => [], body: el() },
    window: { addEventListener() {}, devicePixelRatio: 1 },
    TextDecoder, TextEncoder, atob, performance, console, setTimeout,
  });
  vm.runInContext(m[1], ctx, { filename: 'ncz_ref.html' });
  assert.equal(typeof ctx.buildNCZ, 'function');
  assert.equal(typeof ctx.convertNCZ, 'function');
  refCtx = ctx;
  return ctx;
}
const NCZ_GIRDI = [
  { t: 'LINE', lay: 'A', x1: 500100, y1: 4200100, x2: 500150, y2: 4200120 },
  { t: 'LINE', lay: 'A', x1: 500150, y1: 4200120, x2: 500175.25, y2: 4200090.5 },
  { t: 'CIRCLE', lay: 'A', cx: 500120, cy: 4200110, r: 7.5 },
  { t: 'ARC', lay: 'A', cx: 500130, cy: 4200140, r: 12, a1: 30, a2: 140 },
  { t: 'ARC', lay: 'A', cx: 500160, cy: 4200140, r: 5, a1: 300, a2: 45 },
  { t: 'TEXT', lay: 'A', x: 500105, y: 4200160, h: 2.5, rot: 30, txt: 'ÇĞİÖŞÜ çğıöşü Direk-1' },
  { t: 'TEXT', lay: 'A', x: 500110, y: 4200170, h: 1.5, rot: 0, txt: 'TR-2 400 kVA' },
  { t: 'POLYLINE', lay: 'YOL', verts: [[500100, 4200100], [500110, 4200130], [500140, 4200135], [500170, 4200100]] },
  { t: 'PFILL', lay: 'BINA', verts: [[500180, 4200180], [500190, 4200180], [500190, 4200190]] },
  { t: 'POINT', lay: 'A', x: 500123.456, y: 4200111.789 },
  { t: 'POINT', lay: 'A', x: 500133.25, y: 4200121.5 },
];
const normA = (a) => ((a % 360) + 360) % 360;

refTest('NCZ: özgün yazıcının çıktısı port ile okunur (koordinat, tabaka, yazı, nokta, sembol)', () => {
  const ref = refYukle();
  const yazilan = ref.buildNCZ({ ents: NCZ_GIRDI });
  const bayt = nczEkle(new Uint8Array(yazilan.bytes),
    nczKayit(6, 3, 4200150, 500160, [4200148, 500158, 4200152, 500162], sembolKuyruk(2, 90, 15)),
    nczKayit(6, 4, 4200155, 500165, [4200154, 500164, 4200156, 500166], sembolKuyruk(1.5, 0, 777)));
  const m = parseNCZ(bayt);
  assert.deepEqual(m.warnings.filter((w) => !/777/.test(w)), []);
  const ad = (e) => m.layers[e.l].name;
  // noktalar (yazıcı P1, P2 adını verir; tabaka 1)
  const nk = m.ents.filter((e) => e.t === 'N' && e.name);
  assert.deepEqual(nk.map((e) => [e.name, e.x, e.y, e.z, ad(e)]), [['P1', 500123.456, 4200111.789, 0, 'PARSEL_NOKTASI'], ['P2', 500133.25, 4200121.5, 0, 'PARSEL_NOKTASI']]);
  // çoklu doğrular (PFILL kapalı halka olarak yazılır: ilk köşe sonda yinelenir)
  const pl = m.ents.filter((e) => e.t === 'P');
  assert.deepEqual(pl.map((e) => e.v), [
    [500100, 4200100, 500110, 4200130, 500140, 4200135, 500170, 4200100],
    [500180, 4200180, 500190, 4200180, 500190, 4200190, 500180, 4200180],
  ]);
  assert.ok(pl.every((e) => ad(e) === 'PARSEL_HAT' && e.closed === false));
  const ln = m.ents.filter((e) => e.t === 'L' && ad(e) === 'PARSEL_HAT');
  assert.deepEqual(ln.map((e) => [e.x1, e.y1, e.x2, e.y2]), [[500100, 4200100, 500150, 4200120], [500150, 4200120, 500175.25, 4200090.5]]);
  const da = m.ents.filter((e) => e.t === 'C' && ad(e) === 'PARSEL_HAT');
  assert.deepEqual(da.map((e) => [e.x, e.y, e.r]), [[500120, 4200110, 7.5]]);
  const yy = m.ents.filter((e) => e.t === 'A');
  assert.equal(yy.length, 2);
  yakin(yy[0].a1, 30, 1e-9); yakin(yy[0].a2, 140, 1e-9); yakin(yy[1].a1, 300, 1e-9); yakin(yy[1].a2, 45, 1e-9);
  assert.deepEqual(yy.map((e) => [e.x, e.y, e.r]), [[500130, 4200140, 12], [500160, 4200140, 5]]);
  const yz = m.ents.filter((e) => e.t === 'T');
  assert.deepEqual(yz.map((e) => [e.s, e.x, e.y, e.h]), [['ÇĞİÖŞÜ çğıöşü Direk-1', 500105, 4200160, 2.5], ['TR-2 400 kVA', 500110, 4200170, 1.5]]);
  yakin(yz[0].rot, 30, 1e-5); yakin(yz[1].rot, 0);
  const sn = m.ents.filter((e) => e.t === 'N' && e.sym !== undefined);
  assert.deepEqual(sn.map((e) => [e.sym, e.x, e.y, ad(e)]), [[15, 500160, 4200150, 'DEĞ_NOK'], [777, 500165, 4200155, '4']]);
  assert.deepEqual(m.stats, { POINT: 2, POLYLINE: 2, LINE: 2, CIRCLE: 1, ARC: 2, TEXT: 2, INSERT: 2 });
});

refTest('NCZ: port ile özgün okuyucu aynı baytlarda aynı nesneleri verir (bilinçli farklar dışında)', () => {
  const ref = refYukle();
  const bayt = nczEkle(new Uint8Array(ref.buildNCZ({ ents: NCZ_GIRDI }).bytes),
    nczKayit(6, 3, 4200150, 500160, [4200148, 500158, 4200152, 500162], sembolKuyruk(2, 90, 15)),
    nczKayit(6, 3, 4200151, 500161, [4200150, 500160, 4200152, 500162], sembolKuyruk(1, 45, 1)),
    nczKayit(6, 4, 4200155, 500165, [4200154, 500164, 4200156, 500166], sembolKuyruk(1.5, 0, 777)));
  const o = ref.convertNCZ(bayt.buffer.slice(bayt.byteOffset, bayt.byteOffset + bayt.byteLength));
  const m = parseNCZ(bayt);
  assert.deepEqual([...o.warnings], []);
  // Bilinçli fark 1: port nokta kayıtlarını da okur → karşılaştırmadan çıkar
  const pe = m.ents.filter((e) => !(e.t === 'N' && e.sym === undefined));
  let k = 0;
  const ad = (e) => m.layers[e.l].name;
  for (const e of o.ents) {
    const q = pe[k++];
    assert.equal(ad(q), o.layers[e.layer], 'tabaka adı');
    if (e.t === 'LINE') assert.deepEqual([q.t, q.x1, q.y1, q.x2, q.y2], ['L', e.x1, e.y1, e.x2, e.y2]);
    else if (e.t === 'CIRCLE') assert.deepEqual([q.t, q.x, q.y, q.r], ['C', e.cx, e.cy, e.r]);
    else if (e.t === 'ARC') {
      // Bilinçli fark 2: özgün okuyucu ikinci açıyı bitiş açısı sayar; port (yazıcı gibi) süpürme: bitiş = a1 + a2
      assert.deepEqual([q.t, q.x, q.y, q.r], ['A', e.cx, e.cy, e.r]);
      yakin(q.a1, normA(e.a1), 1e-9); yakin(q.a2, normA(e.a1 + e.a2), 1e-9);
    } else if (e.t === 'TEXT') {
      assert.deepEqual([q.t, q.x, q.y, q.h, q.s], ['T', e.x, e.y, e.h, e.txt]);
      yakin(q.rot, normA(e.rot), 1e-9); // port dönüklüğü [0,360) aralığına indirger
    }
    else if (e.t === 'POLYLINE') assert.deepEqual([q.t, q.v, q.closed], ['P', [...e.verts].flatMap((v) => [...v]), false]);
    else if (e.t === 'INSERT') {
      // Bilinçli fark 3: semboller ilkel nesnelere patlatılır (konum noktası + tablo geometrisi / yer tutucu daire)
      assert.deepEqual([q.t, q.x, q.y, q.sym], ['N', e.x, e.y, e.sym]);
      const def = KNOWN_SYMBOLS[e.sym];
      if (!def) { const c = pe[k++]; assert.deepEqual([c.t, c.x, c.y], ['C', e.x, e.y]); yakin(c.r, 0.4 * e.sc, 1e-12); continue; }
      const cr = Math.cos(e.rot * Math.PI / 180), sr = Math.sin(e.rot * Math.PI / 180);
      const tp = (px, py) => [e.x + e.sc * (px * cr - py * sr), e.y + e.sc * (px * sr + py * cr)]; // özgün çizim dönüşümü
      for (const pr of def) {
        const s = pe[k++];
        if (pr[0] === 'L') {
          const a = tp(pr[1], pr[2]), b = tp(pr[3], pr[4]);
          assert.equal(s.t, 'L');
          yakin(s.x1, a[0], 1e-9); yakin(s.y1, a[1], 1e-9); yakin(s.x2, b[0], 1e-9); yakin(s.y2, b[1], 1e-9);
        } else {
          const c = tp(pr[1], pr[2]);
          assert.equal(s.t, 'C');
          yakin(s.x, c[0], 1e-9); yakin(s.y, c[1], 1e-9); yakin(s.r, pr[3] * e.sc, 1e-9);
        }
      }
    } else assert.fail('beklenmeyen özgün nesne tipi ' + e.t);
  }
  assert.equal(k, pe.length, 'portta fazladan nesne yok');
  assert.equal(o.ents.filter((e) => e.t === 'INSERT').length, 3);
  assert.deepEqual([...o.layers], ['0', 'PARSEL_NOKTASI', 'PARSEL_HAT', 'DEĞ_NOK', '4']);
});

refTest('NCZ: aykırı değer filtresi ve dilim (Central_Meridian) araması özgün okuyucuyla aynı', () => {
  const ref = refYukle();
  const girdi = [];
  for (let i = 0; i < 30; i++) girdi.push({ t: 'LINE', lay: 'A', x1: 500000 + 10 * i, y1: 4200000, x2: 500000 + 10 * i, y2: 4200050 + i });
  girdi.push({ t: 'LINE', lay: 'A', x1: 900000, y1: 4900000, x2: 900010, y2: 4900010 }); // çok uzakta
  const bayt = new Uint8Array(ref.buildNCZ({ ents: girdi }).bytes);
  const o = ref.convertNCZ(bayt.buffer);
  const m = parseNCZ(bayt);
  assert.equal(o.ents.length, 30);
  assert.equal(m.ents.length, 30);
  assert.equal(m.warnings.length, 1);
  assert.equal(m.warnings[0], o.warnings[0]);
  assert.deepEqual(m.ents.map((e) => [e.x1, e.y1, e.x2, e.y2]), [...o.ents].map((e) => [e.x1, e.y1, e.x2, e.y2]));
  assert.equal(m.dom, o.dom);
  // şablondaki projeksiyon tanımına bir orta meridyen yazılırsa ikisi de aynı dilimi bulur
  const wkt = enc('PARAMETER["Central_Meridian",36.0]');
  const b2 = birlestir(bayt, wkt);
  assert.equal(ref.convertNCZ(b2.buffer).dom, 36);
  assert.equal(parseNCZ(b2).dom, 36);
});

refTest('DXF: özgün yazıcının ürettiği DXF port ile özgün DXF okuyucuda aynı nesneleri verir', () => {
  const ref = refYukle();
  const bayt = nczEkle(new Uint8Array(ref.buildNCZ({ ents: NCZ_GIRDI }).bytes),
    nczKayit(6, 3, 4200150, 500160, [4200148, 500158, 4200152, 500162], sembolKuyruk(2, 90, 15)),
    nczKayit(6, 3, 4200151, 500161, [4200150, 500160, 4200152, 500162], sembolKuyruk(1, 45, 6)),
    nczKayit(6, 4, 4200155, 500165, [4200154, 500164, 4200156, 500166], sembolKuyruk(1.5, 30, 777)));
  const cozulen = ref.convertNCZ(bayt.buffer);
  cozulen.dom = 39;
  const dxf = new Uint8Array(ref.buildDXF(cozulen)); // AC1015, SYM_n blokları, \\U+ kaçışlı yazılar, $USERI1 = dilim
  const o = ref.parseDXFInput(dxf.buffer);
  const m = parseDXF(dxf);
  assert.equal(m.dom, 39);
  assert.equal(o.dom, 39);
  assert.deepEqual(m.warnings, []);
  assert.deepEqual(m.stats, { LWPOLYLINE: 2, LINE: 2, CIRCLE: 1, ARC: 2, TEXT: 2, INSERT: 3 });
  assert.equal(m.ents.length, o.ents.length);
  assert.ok(m.ents.every((e) => e.c === 7));
  const T = { LINE: 'L', CIRCLE: 'C', ARC: 'A', TEXT: 'T', POLYLINE: 'P' };
  const say = {};
  for (let i = 0; i < o.ents.length; i++) {
    const e = o.ents[i], q = m.ents[i];
    assert.equal(q.t, T[e.t], i + '. nesne tipi');
    assert.equal(m.layers[q.l].name, e.lay, i + '. nesne tabakası');
    say[e.t] = (say[e.t] || 0) + 1;
    const es = (a, b2) => a.forEach((v, k) => yakin(v, b2[k], 1e-9, i + '. nesne'));
    if (e.t === 'LINE') es([q.x1, q.y1, q.x2, q.y2], [e.x1, e.y1, e.x2, e.y2]);
    else if (e.t === 'CIRCLE') es([q.x, q.y, q.r], [e.cx, e.cy, e.r]);
    else if (e.t === 'ARC') es([q.x, q.y, q.r, q.a1, q.a2], [e.cx, e.cy, e.r, normA(e.a1), normA(e.a2)]);
    else if (e.t === 'TEXT') { es([q.x, q.y, q.h, q.rot], [e.x, e.y, e.h, normA(e.rot)]); assert.equal(q.s, e.txt); }
    else { es(q.v, [...e.verts].flatMap((v) => [...v])); assert.equal(q.closed, false); }
  }
  // semboller: 15 → daire + 2 doğru; 6 → daire + 12 doğru; 777 → yer tutucu daire + numara yazısı
  assert.deepEqual(say, { POLYLINE: 2, LINE: 2 + 2 + 12, CIRCLE: 1 + 1 + 1 + 1, ARC: 2, TEXT: 2 + 1 });
  const no = m.ents.filter((e) => e.t === 'T' && e.s === '777')[0];
  yakin(no.h, 1.5, 1e-9); yakin(no.rot, 30, 1e-5);
  yakin(no.x, 500165 + 1.5 * 1.2 * Math.cos(Math.PI / 6), 1e-6); yakin(no.y, 4200155 + 1.5 * 1.2 * Math.sin(Math.PI / 6), 1e-6);
  assert.equal(m.ents.filter((e) => e.t === 'T')[0].s, 'ÇĞİÖŞÜ çğıöşü Direk-1');
});

/* ------------------------------------------------------------------
   Geometri yardımcıları
   ------------------------------------------------------------------ */
const model = (ents, layers = [{ name: 'A', aci: 1 }, { name: 'B', aci: 2 }]) => ({ format: 'DXF', ents, layers, bbox: null, dom: null, warnings: [], stats: {} });
const L = (x1, y1, x2, y2, l = 0) => ({ t: 'L', l, c: l + 1, x1, y1, x2, y2 });
const kollar = (a) => a.map((k) => [Math.round(k.az * 1e6) / 1e6, Math.round(k.len * 1e6) / 1e6, k.layer]);
// nearestSnap sonucu: konum/tür/nesne birebir, uzaklık 1e-9 içinde
const yakala = (r, x, y, kind, ent, d) => {
  assert.ok(r, 'aday bulunmalı');
  assert.deepEqual([r.x, r.y, r.kind, r.ent], [x, y, kind, ent]);
  yakin(r.d, d, 1e-9, 'uzaklık');
  assert.deepEqual(Object.keys(r).sort(), ['d', 'ent', 'kind', 'x', 'y']);
};

test('armsAt: T kavşağı (üç doğru), kesintisiz geçen hat (through), tolerans, tekrarların birleşmesi', () => {
  const m = model([L(0, 10, 10, 10), L(10, 10, 20, 10), L(10, 10.2, 10, 0), L(50, 50, 60, 60)]);
  assert.deepEqual(kollar(armsAt(m, 10, 10)), [[0, 10, 'A'], [180, 10, 'A'], [270, 10.2, 'A']]);
  assert.deepEqual(kollar(armsAt(m, 10, 10, 0.1)), [[0, 10, 'A'], [180, 10, 'A']]); // sap 0.2 m uzakta
  assert.deepEqual(armsAt(m, 30, 30), []);
  const kol = armsAt(m, 10, 10)[0];
  assert.deepEqual(Object.keys(kol).sort(), ['az', 'c', 'l', 'layer', 'len']);
  assert.deepEqual([kol.l, kol.c], [0, 1]);
  // gövde hattı düğümde bölünmemiş: varsayılan yalnız sapı görür; through ile iki yön de sayılır
  const m2 = model([L(0, 10, 20, 10), L(10, 10, 10, 0), L(10, 10, 10, 0), L(10, 10, 10, 0, 1)]);
  assert.deepEqual(kollar(armsAt(m2, 10, 10)), [[270, 10, 'A'], [270, 10, 'B']]); // aynı tabakadaki tekrar birleşir
  assert.deepEqual(kollar(armsAt(m2, 10, 10, 0.5, { through: true })), [[0, 10, 'A'], [180, 10, 'A'], [270, 10, 'A'], [270, 10, 'B']]);
  assert.deepEqual(kollar(armsAt(m2, 10, 10, 0.5, new Set([0]))), [[270, 10, 'B']]);
  assert.deepEqual(kollar(armsAt(m2, 10, 10, 0.5, { hidden: new Set([1]), through: true })), [[0, 10, 'A'], [180, 10, 'A'], [270, 10, 'A']]);
  // 1°'den yakın yönler birleşir (uzun olan kalır), 359.6° ile 0.3° de komşudur
  const r = Math.PI / 180;
  const m3 = model([L(0, 0, 10 * Math.cos(359.6 * r), 10 * Math.sin(359.6 * r)), L(0, 0, 25 * Math.cos(0.3 * r), 25 * Math.sin(0.3 * r)), L(0, 0, 0, 5)]);
  const k3 = armsAt(m3, 0, 0);
  assert.equal(k3.length, 2);
  yakin(k3[0].az, 0.3, 1e-9); yakin(k3[0].len, 25, 1e-9); yakin(k3[1].az, 90, 1e-9);
});

test('armsAt: çoklu doğru köşesi, uç köşe, kapalı çoklu doğruda başa sarma', () => {
  const acik = model([{ t: 'P', l: 0, c: 1, v: [0, 0, 10, 0, 10, 10, 30, 10], closed: false }]);
  assert.deepEqual(kollar(armsAt(acik, 10, 0)), [[90, 10, 'A'], [180, 10, 'A']]);
  assert.deepEqual(kollar(armsAt(acik, 0, 0)), [[0, 10, 'A']]);
  assert.deepEqual(kollar(armsAt(acik, 30, 10)), [[180, 20, 'A']]);
  assert.deepEqual(kollar(armsAt(acik, 20, 10)), []); // parça ortası: köşe yok
  assert.deepEqual(kollar(armsAt(acik, 20, 10, 0.5, { through: true })), [[0, 10, 'A'], [180, 10, 'A']]);
  const kapali = model([{ t: 'P', l: 1, c: 2, v: [0, 0, 10, 0, 10, 10, 0, 10], closed: true }]);
  assert.deepEqual(kollar(armsAt(kapali, 0, 0)), [[0, 10, 'B'], [90, 10, 'B']]);   // ilk köşe: son köşeye sarar
  assert.deepEqual(kollar(armsAt(kapali, 0, 10)), [[0, 10, 'B'], [270, 10, 'B']]); // son köşe: ilk köşeye sarar
  assert.deepEqual(kollar(armsAt(kapali, 5, 10, 0.5, { through: true })), [[0, 5, 'B'], [180, 5, 'B']]);
  // ilk köşesi sonda yinelenen kapalı halka da aynı sonucu verir
  const yineli = model([{ t: 'P', l: 1, c: 2, v: [0, 0, 10, 0, 10, 10, 0, 10, 0, 0], closed: true }]);
  assert.deepEqual(kollar(armsAt(yineli, 0, 0)), [[0, 10, 'B'], [90, 10, 'B']]);
  // düğüm çevresindeki çok kısa parça (tol içinde iki köşe) tek düğüm sayılır
  const kisa = model([{ t: 'P', l: 0, c: 1, v: [0, 0, 10, 0, 10.1, 0.1, 10.1, 10], closed: false }]);
  const k = armsAt(kisa, 10, 0);
  assert.equal(k.length, 2);
  yakin(k[0].az, 90, 1e-9); yakin(k[0].len, 9.9, 1e-9); yakin(k[1].az, 180, 1e-9);
});

test('nearestSnap / snapCandidates: türler, en büyük uzaklık, gizli tabakalar, önbellek', () => {
  const m = model([
    L(0, 0, 10, 0),
    { t: 'P', l: 1, c: 2, v: [20, 0, 20, 10, 30, 10], closed: false },
    { t: 'C', l: 0, c: 1, x: 50, y: 50, r: 5 },
    { t: 'A', l: 0, c: 1, x: 60, y: 50, r: 5, a1: 0, a2: 90 },
    { t: 'T', l: 1, c: 2, x: 70, y: 70, h: 1, rot: 0, s: 'x' },
    { t: 'N', l: 1, c: 2, x: 80, y: 80 },
    { t: 'F', l: 0, c: 1, v: [100, 100, 110, 100, 110, 110] }, // dolgu köşeleri aday değildir
    L(5000, 5000, 5001, 5001), // çok uzaktaki nesne ızgarayı bozmamalı
  ]);
  const once = JSON.stringify(m);
  const c = snapCandidates(m);
  assert.ok(c instanceof Float64Array);
  assert.equal(c.length, 4 * 11);
  assert.deepEqual([...c.slice(0, 8)], [0, 0, 0, 0, 10, 0, 0, 0]);
  assert.deepEqual([...c.slice(8, 12)], [20, 0, SNAP_KINDS.indexOf('vertex'), 1]);
  yakala(nearestSnap(m, 9.6, 0.3, 1), 10, 0, 'end', 0, 0.5);
  assert.equal(nearestSnap(m, 9.6, 0.3, 0.49), null);
  yakala(nearestSnap(m, 21, 9, 5), 20, 10, 'vertex', 1, Math.SQRT2);
  assert.equal(nearestSnap(m, 51, 50, 2).kind, 'center');
  assert.equal(nearestSnap(m, 60, 51, 2).ent, 3);
  assert.equal(nearestSnap(m, 70, 69, 2).kind, 'text');
  assert.equal(nearestSnap(m, 80, 81, 2).kind, 'point');
  assert.equal(nearestSnap(m, 105, 100, 3), null);
  yakala(nearestSnap(m, 4990, 4990, 100), 5000, 5000, 'end', 7, Math.hypot(10, 10));
  assert.equal(nearestSnap(m, -1e7, 3e6).ent, 0); // sınırsız arama, ızgaranın çok dışından
  assert.equal(nearestSnap(m, 1e7, 1e7).ent, 7);
  // gizli tabaka
  const gizli = new Set([1]);
  assert.equal(snapCandidates(m, gizli).length, 4 * 6);
  assert.equal(nearestSnap(m, 21, 9, 5, gizli), null);
  assert.equal(nearestSnap(m, 21, 9, 50, gizli).ent, 0);
  // önbellek: numaralandırılamaz özellik; JSON çıktısı değişmez; nesne listesi değişince yenilenir
  assert.equal(JSON.stringify(m), once);
  assert.ok(!Object.keys(m).includes('_snapIndex'));
  assert.ok(m._snapIndex && m._snapIndex.pts === c);
  m.ents.push(L(200, 200, 210, 210));
  assert.equal(nearestSnap(m, 200.2, 200, 1).ent, 8);
  const donuk = Object.freeze(model([L(1, 1, 2, 2)]));
  yakala(nearestSnap(donuk, 1, 1.1, 1), 1, 1, 'end', 0, 0.1);
  assert.equal(nearestSnap(model([]), 0, 0), null);
  // kaba kuvvetle karşılaştırma (rastgele noktalar, sabit tohum)
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const ents = [];
  for (let i = 0; i < 3000; i++) ents.push({ t: 'N', l: i % 2, c: 1, x: rnd() * 1000, y: rnd() * 300 });
  const mm = model(ents);
  for (let i = 0; i < 300; i++) {
    const qx = rnd() * 1400 - 200, qy = rnd() * 700 - 200, md = i % 3 === 0 ? Infinity : rnd() * 40, h = i % 2 ? gizli : undefined;
    let best = null, bd = md;
    for (let j = 0; j < ents.length; j++) {
      if (h && h.has(ents[j].l)) continue;
      const d = Math.hypot(ents[j].x - qx, ents[j].y - qy);
      if (d < bd || (d === bd && best === null)) { bd = d; best = j; }
    }
    const r = nearestSnap(mm, qx, qy, md, h);
    if (best === null) assert.equal(r, null); else { assert.equal(r.ent, best); yakin(r.d, bd, 1e-9); }
  }
});

test('Başarım: 50.000 doğrulu DXF < 3 sn; nearestSnap ilk çağrıdan sonra < 5 ms', () => {
  const parca = [G(0, 'SECTION', 2, 'ENTITIES')];
  for (let i = 0; i < 50000; i++) {
    const x = 500000 + (i % 250) * 8, y = 4200000 + Math.floor(i / 250) * 8;
    parca.push(G(0, 'LINE', 5, i.toString(16).toUpperCase(), 100, 'AcDbEntity', 8, 'HAT' + (i % 7), 100, 'AcDbLine', 10, x + 0.125, 20, y + 0.25, 30, 0, 11, x + 6.5, 21, y + 5.75, 31, 0));
  }
  parca.push(G(0, 'ENDSEC', 0, 'EOF'));
  const bayt = enc(parca.join(''));
  let t0 = performance.now();
  const m = parseDXF(bayt);
  const tParse = performance.now() - t0;
  assert.equal(m.ents.length, 50000);
  assert.equal(m.layers.length, 7);
  assert.deepEqual(m.bbox, { minE: 500000.125, minN: 4200000.25, maxE: 500000 + 249 * 8 + 6.5, maxN: 4200000 + 199 * 8 + 5.75 });
  assert.ok(tParse < 3000, `DXF okuma ${tParse.toFixed(0)} ms`);
  yakala(nearestSnap(m, 500800.2, 4200800.2, 5), 500800.125, 4200800.25, 'end', 100 * 250 + 100, Math.hypot(0.075, 0.05)); // ilk çağrı: indeks kurulur
  let enUzun = 0, bulunan = 0;
  t0 = performance.now();
  for (let i = 0; i < 500; i++) {
    const t1 = performance.now();
    const r = nearestSnap(m, 500000 + ((i * 37) % 2000) + 0.3, 4200000 + ((i * 91) % 1600) + 0.7, i % 5 === 0 ? Infinity : 10);
    const dt = performance.now() - t1;
    if (dt > enUzun) enUzun = dt;
    if (r) bulunan++;
  }
  const ort = (performance.now() - t0) / 500;
  assert.equal(bulunan, 500);
  assert.ok(ort < 1, `nearestSnap ortalama ${ort.toFixed(3)} ms`);
  assert.ok(enUzun < 5, `nearestSnap en uzun ${enUzun.toFixed(3)} ms`);
  t0 = performance.now();
  assert.equal(armsAt(m, 500800.125, 4200800.25).length, 1);
  assert.ok(performance.now() - t0 < 50, 'armsAt 50.000 doğruda < 50 ms');
});
