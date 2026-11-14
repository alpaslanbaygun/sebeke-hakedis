// Yazı ve simge çakışmaları (14.11.2026, saha isteği: "tek tuşla yazı / simge çakışmalarını düzelt"). Kutular dönük
// dikdörtgendir { x, y (merkez), w, h, aci (radyan) }. Engeller (simgeler) yerinde kalır; etiketler sırayla, aday
// yerlerinden ilk çakışmasız olana konur (yoksa en az çakışana; eşitlikte önce gelen). Konan etiket sonrakilerin engelidir.
// Eklentideki karşılığı: autocad/src/Cekirdek/YaziCakisma.cs (SH_YAZIDUZEN) — aynı kural, aynı aday sırası; ortak deneme:
// ortak/deneme/yazi-cakisma/vektorler.json. Telefonda DXF dışa aktarımı (Yazı çakışmalarını düzelt) kullanır.

/** İki dönük dikdörtgen üst üste biniyor mu (ayırma ekseni sınaması; değme ve tol altı binme sayılmaz). */
export function cakisir(a, b, tol = 1e-6) {
  const ax = [Math.cos(a.aci || 0), Math.sin(a.aci || 0)], bx = [Math.cos(b.aci || 0), Math.sin(b.aci || 0)];
  const eksenler = [ax, [-ax[1], ax[0]], bx, [-bx[1], bx[0]]];
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const L of eksenler) {
    const ra = (a.w / 2) * Math.abs(ax[0] * L[0] + ax[1] * L[1]) + (a.h / 2) * Math.abs(-ax[1] * L[0] + ax[0] * L[1]);
    const rb = (b.w / 2) * Math.abs(bx[0] * L[0] + bx[1] * L[1]) + (b.h / 2) * Math.abs(-bx[1] * L[0] + bx[0] * L[1]);
    if (Math.abs(dx * L[0] + dy * L[1]) >= ra + rb - tol) return false;
  }
  return true;
}

/** Yazı kutusunun çevresine bırakılan boşluk (yazı yüksekliğine oran): yazılar birbirine değmesin. */
export const BOSLUK = 0.1;
export const genislet = (k, yukseklik, oran = BOSLUK) => ({ x: k.x, y: k.y, w: k.w + 2 * oran * yukseklik, h: k.h + 2 * oran * yukseklik, aci: k.aci || 0 });

export const kaydir = (k, d) => ({ x: k.x + d[0], y: k.y + d[1], w: k.w, h: k.h, aci: k.aci || 0 });

/**
 * Eleman yazısının aday yerleri (kaydırma listesi): yazının merkezi simge merkezine (ax, ay) göre sağ-sol / üst-alt
 * aynalanır, sonra 1,6 ve 2,2 kat uzaklaştırılır. İlk aday yerinde kalmaktır.
 */
export function elemanAdaylari(k, ax, ay) {
  const dx = k.x - ax, dy = k.y - ay;
  const out = [];
  for (const kat of [1, 1.6, 2.2]) for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) out.push([ax + sx * dx * kat - k.x, ay + sy * dy * kat - k.y]);
  return out;
}

/**
 * Hat yazısının (metraj, hat etiketi) aday yerleri: a→b parçası boyunca kaydırma (0, ∓¼, ∓0,4 parça boyu; yazı parçanın
 * içinde kalmalı) ve çizginin öbür yanı (aynı uzaklıkta). Sıra: yerinde, öbür yan, ¼ geri / ileri, …
 */
export function hatAdaylari(k, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(L > 1e-9)) return [[0, 0]];
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
  const s = (k.x - a[0]) * n[0] + (k.y - a[1]) * n[1];
  const t = (k.x - a[0]) * u[0] + (k.y - a[1]) * u[1] - L / 2;
  const out = [[0, 0], [-2 * s * n[0], -2 * s * n[1]]];
  for (const f of [0.25, 0.4]) {
    const kay = [];
    for (const sh of [-f * L, f * L]) if (Math.abs(t + sh) + k.w / 2 <= L / 2 + 1e-9) kay.push(sh);
    for (const sh of kay) out.push([sh * u[0], sh * u[1]]);
    for (const sh of kay) out.push([sh * u[0] - 2 * s * n[0], sh * u[1] - 2 * s * n[1]]);
  }
  return out;
}

/**
 * Yerleştirme: engeller [kutu], etiketler [{ kutu, adaylar: [[dx, dy], …] }] (sırası öncelik). Döner: { secim: her etiketin
 * aday sırası, cakisan: yerinde kalsa çakışacak etiket sayısı, cozulemeyen: hâlâ çakışan etiket sayısı }.
 */
export function yerlestir(engeller, etiketler, tol = 1e-6) {
  const konan = (engeller || []).slice();
  const secim = [];
  let cakisan = 0, cozulemeyen = 0;
  for (const e of etiketler) {
    const ad = e.adaylar && e.adaylar.length ? e.adaylar : [[0, 0]];
    let en = -1, enSayi = Infinity;
    for (let i = 0; i < ad.length; i++) {
      const k = kaydir(e.kutu, ad[i]);
      let n = 0;
      for (const o of konan) if (cakisir(k, o, tol)) n++;
      if (i === 0 && n > 0) cakisan++;
      if (n < enSayi) { enSayi = n; en = i; }
      if (n === 0) break;
    }
    if (enSayi > 0) cozulemeyen++;
    secim.push(en);
    konan.push(kaydir(e.kutu, ad[en]));
  }
  return { secim, cakisan, cozulemeyen };
}
