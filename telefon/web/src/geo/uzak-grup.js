// Uzak nesne grubu (14.11.2026, saha bildirimi): adı değiştirilip yeni işe devam edilen projede eski işin alımları km'lerce
// uzakta kalıyor, AutoCAD dosyasıyla da gidiyordu. Nesneler birbirine esik metreden yakınsa aynı gruptadır (zincirleme);
// bir hattın köşeleri hep aynı gruptadır. 0 ana grup (en çok nesneli; eşitlikte ilk nesnenin grubu), 1, 2 … uzak gruplar
// (nesne sayısı azalan, eşitlikte ilk görünen); köşesiz nesne 0. Eklentideki karşılığı: autocad/src/Cekirdek/UzakGrup.cs
// (aynı kural; ortak deneme: ortak/deneme/uzak-grup/vektorler.json).
export const UZAK_ESIK = 2000;

/** nesneler: her biri [[x, y], …] köşe listesi. Döner: her nesnenin grup numarası. */
export function grupla(nesneler, esik = UZAK_ESIK) {
  const n = nesneler.length;
  const noktaNesne = [], noktalar = [];
  nesneler.forEach((k, i) => { for (const p of k || []) if (p && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) { noktaNesne.push(i); noktalar.push(p); } });
  const ata = Array.from({ length: n }, (_, i) => i);
  const kok = (x) => { while (ata[x] !== x) { ata[x] = ata[ata[x]]; x = ata[x]; } return x; };
  const birlestir = (a, b) => { a = kok(a); b = kok(b); if (a !== b) { if (a < b) ata[b] = a; else ata[a] = b; } };
  const izgara = new Map();
  const hc = (v) => Math.floor(v / esik);
  for (let j = 0; j < noktalar.length; j++) {
    const cx = hc(noktalar[j][0]), cy = hc(noktalar[j][1]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const l = izgara.get((cx + dx) + ',' + (cy + dy));
      if (!l) continue;
      for (const m of l) { const ddx = noktalar[j][0] - noktalar[m][0], ddy = noktalar[j][1] - noktalar[m][1]; if (ddx * ddx + ddy * ddy <= esik * esik) birlestir(noktaNesne[j], noktaNesne[m]); }
    }
    const a0 = cx + ',' + cy;
    if (!izgara.has(a0)) izgara.set(a0, []);
    izgara.get(a0).push(j);
  }
  for (let j = 1; j < noktalar.length; j++) if (noktaNesne[j] === noktaNesne[j - 1]) birlestir(noktaNesne[j], noktaNesne[j - 1]);
  const koseli = new Array(n).fill(false);
  for (const i of noktaNesne) koseli[i] = true;
  const sayi = new Map(), ilk = new Map();
  for (let i = 0; i < n; i++) { if (!koseli[i]) continue; const r = kok(i); sayi.set(r, (sayi.get(r) || 0) + 1); if (!ilk.has(r)) ilk.set(r, i); }
  const kokler = [...sayi.keys()].sort((a, b) => sayi.get(b) - sayi.get(a) || ilk.get(a) - ilk.get(b));
  const no = new Map(kokler.map((r, g) => [r, g]));
  return Array.from({ length: n }, (_, i) => (koseli[i] ? no.get(kok(i)) : 0));
}

/** İki köşe kümesi arasındaki en kısa uzaklık (m). */
export function enKisaUzaklik(a, b) {
  let en = Infinity;
  for (const p of a) for (const q of b) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < en) en = d; }
  return en;
}

/**
 * Açık projedeki uzak gruplar (Kontrol listesi uyarısı için): { ekipman: [...], noktalar: [...], hatlar: [...], uzaklik } ya
 * da null. Ekipman noktası ve hat düğümleri birlikte gruplanır; ekipmanı olan nokta ayrıca sayılmaz.
 */
export function uzakGruplar({ points = [], equipment = [], lines = [] }, esik = UZAK_ESIK) {
  const act = (a) => a.filter((x) => x.status !== 'deleted');
  const pm = new Map(act(points).map((p) => [p.id, p]));
  const xy = (p) => (p && p.E != null && p.N != null ? [p.E, p.N] : null);
  const nes = [], tur = [];
  const eqPts = new Set();
  for (const e of act(equipment)) { const k = xy(pm.get(e.pointId)); nes.push(k ? [k] : []); tur.push(['ekipman', e]); eqPts.add(e.pointId); }
  for (const p of pm.values()) if (!eqPts.has(p.id)) { const k = xy(p); nes.push(k ? [k] : []); tur.push(['nokta', p]); }
  for (const l of act(lines)) { nes.push((l.nodes || []).map((id) => xy(pm.get(id))).filter(Boolean)); tur.push(['hat', l]); }
  if (nes.length < 2) return null;
  const g = grupla(nes, esik);
  const r = { ekipman: [], noktalar: [], hatlar: [], uzaklik: 0 };
  const ana = [], uzak = [];
  g.forEach((gi, i) => { (gi === 0 ? ana : uzak).push(...nes[i]); if (gi === 0) return; const [t, x] = tur[i]; if (t === 'ekipman') r.ekipman.push(x); else if (t === 'nokta') r.noktalar.push(x); else r.hatlar.push(x); });
  if (!r.ekipman.length && !r.noktalar.length && !r.hatlar.length) return null;
  r.uzaklik = enKisaUzaklik(uzak, ana);
  return r;
}
