// Kayıtlı düzeltme profilleri: TUSAGA-Aktif (CORS-TR), kendi sabit istasyonunuz, yerel CORS ağları ve diğerleri.
// Her profil adıyla saklanır, tek dokunuşla seçilir; bağlantı türü NTRIP ya da doğrudan IP:port (NTRIP'siz) olabilir.
// Ayar: 'ntripProfiles' = { active, auto, hazir, list:[{ id, name, kind, mode, host, port, mount, user, pass, version, sendGGA, ggaSec }] }
//   auto  : alıcı bağlanınca seçili profile kendiliğinden bağlan (profil eksiksizse)
//   hazir : hazır profillerin eklendiği sürüm (2: TUSAGA-Aktif + sabit istasyon + yerel CORS bir kez eklendi)
const BOS = () => ({ name: 'TUSAGA-Aktif', kind: 'diger', mode: 'ntrip', host: '', port: 2101, mount: '', user: '', pass: '', version: 2, sendGGA: true, ggaSec: 1 });
let seq = 0;
const yeniId = () => 'ntrip-' + Date.now().toString(36) + '-' + (seq++).toString(36);
const kucuk = (s) => String(s || '').trim().toLocaleLowerCase('tr-TR');

/**
 * Hazır profiller. TUSAGA-Aktif sunucu adresi ve portu tusaga-aktif.gov.tr "Sıkça sorulan sorular (teknik)" sayfasındandır
 * (212.156.70.42 : 2101; datum ITRF96, 2005.0). Bağlantı noktası listeden seçilir; kullanıcı adı ve şifre alıcıya özeldir.
 */
export const HAZIR = {
  tusaga: { name: 'TUSAGA-Aktif', kind: 'tusaga', mode: 'ntrip', host: '212.156.70.42', port: 2101, mount: '', version: 1, sendGGA: true, ggaSec: 1 },
  sabit: { name: 'Sabit istasyon', kind: 'sabit', mode: 'ntrip', host: '', port: 2101, mount: '', version: 2, sendGGA: true, ggaSec: 5 },
  yerel: { name: 'Yerel CORS ağı', kind: 'yerel', mode: 'ntrip', host: '', port: 2101, mount: '', version: 2, sendGGA: true, ggaSec: 1 },
  diger: { name: 'Yeni profil', kind: 'diger', mode: 'ntrip', host: '', port: 2101, mount: '', version: 2, sendGGA: true, ggaSec: 1 }
};
export const TUR_ADLARI = { tusaga: 'TUSAGA-Aktif (CORS-TR)', sabit: 'Kendi sabit istasyonumuz', yerel: 'Yerel CORS ağı (belediye vb.)', diger: 'Boş profil' };

/** Adından profil türü (eski kayıtlarda tür yoktu). */
function turTahmin(p) {
  const n = kucuk(p.name);
  if (n.includes('tusaga') || n.includes('cors-tr') || p.host === HAZIR.tusaga.host) return 'tusaga';
  if (n.includes('sabit') || n.includes('base') || n.includes('baz')) return 'sabit';
  if (n.includes('yerel') || n.includes('belediye')) return 'yerel';
  return 'diger';
}
function duzelt(p) {
  const q = Object.assign(BOS(), p, { id: p.id || yeniId() });
  if (!p.kind) q.kind = turTahmin(q);
  q.mode = q.mode === 'tcp' ? 'tcp' : 'ntrip';
  q.port = +q.port > 0 ? Math.round(+q.port) : (q.mode === 'tcp' ? 0 : 2101);
  q.version = +q.version === 1 ? 1 : 2;
  q.ggaSec = Math.max(1, Math.round(+q.ggaSec || 1));
  // GGA açıkça verilmemişse: NTRIP'te açık, doğrudan IP'de kapalı (istasyon gelen veriyi okumayabilir)
  q.sendGGA = p.sendGGA === undefined ? q.mode !== 'tcp' : p.sendGGA !== false;
  return q;
}
const durum = (st, active, list) => Object.assign({}, st, { active, list });

// Kayıtlı ayardan (ya da eski tek profilli 'ntrip' ayarından) profil listesi
export function loadProfiles(saved, legacy) {
  if (saved && Array.isArray(saved.list) && saved.list.length) {
    const list = saved.list.map(duzelt);
    // Kendiliğinden bağlanma: önceki sürümlerden gelen kayıtta kapalı başlar (kullanıcı açar), yeni kurulumda açık
    return { active: list.some((p) => p.id === saved.active) ? saved.active : list[0].id, list, auto: saved.auto === true, hazir: saved.hazir || 0 };
  }
  const p = duzelt(Object.assign({}, legacy || {}));
  return { active: p.id, list: [p], auto: !legacy, hazir: 0 };
}
export const activeProfile = (st) => st.list.find((p) => p.id === st.active) || st.list[0];
export function updateActive(st, patch) { return durum(st, st.active, st.list.map((p) => (p.id === st.active ? duzelt(Object.assign({}, p, patch)) : p))); }
export function selectProfile(st, id) { return st.list.some((p) => p.id === id) ? durum(st, id, st.list) : st; }
export function addProfile(st, name, kind) {
  const n = String(name || '').trim();
  if (!n) throw new Error('Profil adı gerekli');
  if (st.list.some((p) => kucuk(p.name) === kucuk(n))) throw new Error('Bu adla profil var');
  const sablon = kind && HAZIR[kind] ? HAZIR[kind] : { kind: 'diger' };
  const p = duzelt(Object.assign(BOS(), sablon, { id: yeniId(), name: n }));
  return durum(st, p.id, [...st.list, p]);
}
export function removeProfile(st, id) {
  if (st.list.length < 2) throw new Error('En az bir profil kalmalı');
  const list = st.list.filter((p) => p.id !== id);
  return durum(st, st.active === id ? list[0].id : st.active, list);
}
export function setAuto(st, on) { return Object.assign({}, st, { auto: !!on }); }

/**
 * Hazır profilleri bir kez ekler (uygulama açılışında): TUSAGA-Aktif'in sunucu bilgisi boşsa doldurulur, eksik olan
 * TUSAGA-Aktif / sabit istasyon / yerel CORS profilleri eklenir. Kullanıcının sonradan sildiği hazır profil geri gelmez.
 * Döner: { st, degisti }
 */
export function hazirProfilleriEkle(st) {
  if ((st.hazir || 0) >= 2) return { st, degisti: false };
  let list = st.list.map((p) => {
    if (p.kind === 'tusaga' && !p.host) return duzelt(Object.assign({}, p, { host: HAZIR.tusaga.host, port: HAZIR.tusaga.port, version: HAZIR.tusaga.version }));
    return p;
  });
  for (const k of ['tusaga', 'sabit', 'yerel']) {
    if (list.some((p) => p.kind === k)) continue;
    let ad = HAZIR[k].name, i = 2;
    while (list.some((p) => kucuk(p.name) === kucuk(ad))) ad = HAZIR[k].name + ' ' + i++;
    list = [...list, duzelt(Object.assign(BOS(), HAZIR[k], { id: yeniId(), name: ad }))];
  }
  return { st: Object.assign({}, st, { list, hazir: 2 }), degisti: true };
}

/** Profil bağlanmaya hazır mı (sunucu, port; NTRIP'te bağlantı noktası; TUSAGA-Aktif'te kullanıcı adı). */
export function profilTamam(p) {
  return !!p && profilEksikleri(p).length === 0;
}
/** Profilde eksik olanlar (kullanıcıya gösterilir). TUSAGA-Aktif kullanıcı adı ister; diğer ağlarda isteğe bağlı. */
export function profilEksikleri(p) {
  const e = [];
  if (!p.host) e.push('sunucu adresi');
  if (!(+p.port > 0)) e.push('port');
  if (p.mode !== 'tcp' && !p.mount) e.push('bağlantı noktası');
  if (p.mode !== 'tcp' && p.kind === 'tusaga' && !p.user) e.push('kullanıcı adı');
  return e;
}
/** Alıcı bağlanınca kendiliğinden kurulacak bağlantı: ayar açık ve seçili profil eksiksizse köprü ayarı, değilse null. */
export function otomatikAyar(st) {
  const p = st && st.list ? activeProfile(st) : null;
  return st && st.auto !== false && profilTamam(p) ? baglantiAyari(p) : null;
}
/** Köprüye (Java) gidecek bağlantı ayarı. */
export function baglantiAyari(p, gga) {
  return { mode: p.mode, host: String(p.host || '').trim(), port: +p.port, mount: p.mode === 'tcp' ? '' : String(p.mount || '').trim(), user: p.user || '', pass: p.pass || '', version: p.version, sendGGA: p.sendGGA !== false, ggaSec: p.ggaSec || 1, gga: gga || '' };
}

// ---------------------------------------------------------------- Bağlantı bilgisi dosyası

export const DOSYA_BICIMI = 'sebeke-m.gnss-baglanti';
const ALANLAR = ['name', 'kind', 'mode', 'host', 'port', 'mount', 'user', 'pass', 'version', 'sendGGA', 'ggaSec'];

/** Sunucu adresi dolu profilleri paylaşılabilir dosya nesnesine çevirir (sifreler: false ise şifre yazılmaz). */
export function profilDosyasi(st, { sifreler = false, yalnizSecili = false } = {}) {
  const list = (yalnizSecili ? [activeProfile(st)] : st.list).filter((p) => p && p.host);
  return {
    bicim: DOSYA_BICIMI, surum: 1, olusturma: new Date().toISOString(),
    not: 'Şebeke-M düzeltme (NTRIP / IP) bağlantı bilgileri. Uygulamada Ayarlar › Düzeltme kaynağı › Dosyadan al ile alınır.',
    profiller: list.map((p) => { const o = {}; for (const k of ALANLAR) if (k !== 'pass' || sifreler) o[k] = p[k]; if (!sifreler) o.pass = undefined; return JSON.parse(JSON.stringify(o)); })
  };
}

const coz = (x) => { try { return decodeURIComponent(x); } catch (e) { return x; } }; // "%" içeren şifre bozulmasın

/**
 * ntrip://kullanıcı:şifre@sunucu:port/BAĞLANTINOKTASI, tcp://sunucu:port ya da sunucu:port/BAĞLANTINOKTASI.
 * Şemasız metinde port zorunludur (yanlış eşleşmeyi önler). http:// gibi başka şemalar (web sayfası) tanınmaz.
 */
export function parseNtripUrl(s) {
  const t = String(s || '').trim();
  const m = /^(?:(ntrip|tcp):\/\/)?(?:([^:@/\s]*)(?::([^@/\s]*))?@)?([A-Za-z0-9.-]+|\[[0-9a-fA-F:]+\])(?::(\d{1,5}))?(?:\/([^\s?#]*))?$/i.exec(t);
  if (!m || (!m[1] && !m[5])) return null;
  const sema = (m[1] || '').toLowerCase();
  const tcp = sema === 'tcp' || (!sema && !m[6] && !!m[5]);
  const p = { mode: tcp ? 'tcp' : 'ntrip', host: m[4], port: m[5] ? +m[5] : (tcp ? 0 : 2101) };
  if (!tcp) p.mount = coz(m[6] || '');
  if (m[2]) p.user = coz(m[2]);
  if (m[3] !== undefined && m[2] !== undefined) p.pass = coz(m[3]);
  return p;
}

// Anahtarlar ASCII'ye indirgenmiş küçük harfle karşılaştırılır ("Bağlantı Noktası" → "baglanti noktasi", "IP" → "ip")
const ascii = (s) => String(s || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, ' ').trim();
const ANAHTARLAR = [
  [/^(profil|profil adi|ad|adi|name|isim|istasyon|istasyon adi)$/, 'name'],
  [/^(sunucu|sunucu adresi|ip|ip adresi|host|caster|caster adresi|yayinci|server|ntrip sunucusu|ntrip caster)$/, 'host'],
  [/^(port|kapi|port no)$/, 'port'],
  [/^(mount ?point|mount|baglanti noktasi|nokta|mp)$/, 'mount'],
  [/^(kullanici|kullanici adi|user|username|user name|kullanici kodu)$/, 'user'],
  [/^(sifre|parola|pass|password)$/, 'pass'],
  [/^(surum|ntrip surumu|ntrip versiyonu|versiyon|version)$/, 'version'],
  [/^(tur|baglanti turu|mode|yontem)$/, 'mode']
];
const ADRES_SATIRI = (s) => /^(ntrip|tcp):\/\//i.test(s) || /^[^\s:/@]+:\d{1,5}\/\S+$/.test(s) || /^[^\s:/@]+(:[^\s@/]*)?@[^\s:/]+:\d{1,5}\/\S+$/.test(s);
function surumCoz(v) {
  const x = ascii(v).replace(/^ntrip\s*/, '').replace(/^v/, '');
  return /^1(\.0)?$/.test(x) ? 1 : /^2(\.0)?$/.test(x) ? 2 : undefined;
}
/** "Anahtar: değer" satırları (tek profil); tanınmayan anahtarlar atlanır. */
function anahtarDegerleri(satirlar) {
  const p = {};
  for (const s of satirlar) {
    for (const parca of s.split(/[;,]\s*(?=[^:=]+[:=])/)) {
      const m = /^([^:=]+)[:=]\s*(.*)$/.exec(parca.trim());
      if (!m) continue;
      const e = ANAHTARLAR.find(([re]) => re.test(ascii(m[1])));
      const v = m[2].trim();
      if (e && v !== '' && p[e[1]] === undefined) p[e[1]] = v;
    }
  }
  if (p.version !== undefined) p.version = surumCoz(p.version);
  return p;
}

/**
 * Metinden profiller: bu uygulamanın dosyası (JSON), tek profil / profil dizisi (JSON), ntrip:// / tcp:// adresleri ya da
 * "Sunucu: …, Port: …, Bağlantı noktası: …, Kullanıcı: …, Şifre: …" biçimli bilgi metni. Tek bir adres satırı ile
 * ayrı kullanıcı / şifre satırları aynı profilde birleşir. Döner: [{ name?, mode, host, port, mount?, user?, pass?, version? }, …]
 */
export function metindenProfiller(text) {
  const t = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!t) return [];
  if (t[0] === '{' || t[0] === '[') {
    let j;
    try { j = JSON.parse(t); } catch (e) { throw new Error('Dosya okunamadı (JSON bozuk)'); }
    const dizi = Array.isArray(j) ? j : Array.isArray(j.profiller) ? j.profiller : Array.isArray(j.list) ? j.list : [j];
    return dizi.filter((p) => p && typeof p === 'object' && (p.host || p.sunucu)).map((p) => temizle({ name: p.name || p.ad, kind: p.kind, mode: p.mode, host: p.host || p.sunucu, port: p.port, mount: p.mount, user: p.user, pass: p.pass, version: p.version, sendGGA: p.sendGGA, ggaSec: p.ggaSec }));
  }
  const satirlar = t.split(/\r?\n/).map((s) => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
  // 1) adres satırları
  const urller = [];
  for (const s of satirlar) { if (!ADRES_SATIRI(s)) continue; const p = parseNtripUrl(s); if (p) urller.push(temizle(p)); }
  if (urller.length > 1) return urller;
  // 2) "anahtar: değer" bilgisi
  const kv = anahtarDegerleri(satirlar);
  if (urller.length === 1) {
    const u = urller[0], ek = {};
    for (const k of ['name', 'user', 'pass', 'version']) if (kv[k] !== undefined && u[k] === undefined) ek[k] = kv[k];
    if (u.mode !== 'tcp' && !u.mount && kv.mount) ek.mount = kv.mount;
    return [temizle(Object.assign({}, u, ek))];
  }
  if (kv.host) {
    const u = parseNtripUrl(kv.host); // "Sunucu: 1.2.3.4:2101" ya da "…:2101/NOKTA" biçimi
    if (u) { kv.host = u.host; if (!kv.port && u.port) kv.port = u.port; if (!kv.mount && u.mount) kv.mount = u.mount; }
    if (/\s/.test(kv.host)) return []; // adres değil (ör. posta adresi)
    if (kv.mode) kv.mode = /tcp|ip/i.test(kv.mode) && !/ntrip/i.test(kv.mode) ? 'tcp' : 'ntrip';
    else kv.mode = kv.mount || kv.user || /ntrip|caster|mount|baglanti noktasi/.test(ascii(t)) ? 'ntrip' : 'tcp';
    return [temizle(kv)];
  }
  // 3) yalnız "sunucu:port" satırları: doğrudan IP
  const out = [];
  for (const s of satirlar) { const u = parseNtripUrl(s); if (u && u.mode === 'tcp') out.push(temizle(u)); }
  return out;
}
function temizle(p) {
  const o = {};
  for (const k of ALANLAR) if (p[k] !== undefined && p[k] !== null && p[k] !== '') o[k] = p[k];
  if (o.host) o.host = String(o.host).trim();
  if (o.port !== undefined) o.port = +o.port;
  if (o.mode !== undefined) o.mode = o.mode === 'tcp' ? 'tcp' : 'ntrip';
  if (o.version !== undefined) o.version = +o.version === 1 ? 1 : 2;
  return o;
}

/**
 * Gelen profilleri listeye katar: aynı adlı profil güncellenir (gelen dosyada şifre yoksa eskisi korunur), yenisi eklenir.
 * Adsız gelen profile sunucudan ad verilir. Seçili profil, gelenlerin ilki olur. Döner: { st, eklenen, guncellenen }
 */
export function profilleriBirlestir(st, gelen) {
  let list = st.list.slice(), eklenen = 0, guncellenen = 0, ilk = null;
  for (const g0 of gelen || []) {
    if (!g0 || !g0.host) continue;
    const g = Object.assign({}, g0);
    if (g.sendGGA === undefined && g.mode === 'tcp') g.sendGGA = false;
    const ad = String(g.name || '').trim() || (g.mode === 'tcp' ? 'IP ' + g.host + ':' + (g.port || '') : g.host + (g.mount ? ' · ' + g.mount : ''));
    const i = list.findIndex((p) => kucuk(p.name) === kucuk(ad));
    if (i >= 0) {
      const eski = list[i];
      const yeni = duzelt(Object.assign({}, eski, g, { id: eski.id, name: eski.name, pass: g.pass !== undefined ? g.pass : eski.pass, kind: g.kind || eski.kind }));
      list[i] = yeni; guncellenen++; ilk = ilk || yeni.id;
    } else {
      const sablon = g.kind && HAZIR[g.kind] ? HAZIR[g.kind] : { kind: g.host === HAZIR.tusaga.host ? 'tusaga' : 'diger' };
      const yeni = duzelt(Object.assign(BOS(), sablon, g, { id: yeniId(), name: ad }));
      list.push(yeni); eklenen++; ilk = ilk || yeni.id;
    }
  }
  return { st: durum(st, ilk || st.active, list), eklenen, guncellenen };
}

// ---------------------------------------------------------------- Konum yardımcıları

const A = 6378137.0, F = 1 / 298.257222101, E2 = F * (2 - F);
/** Yer merkezli X, Y, Z (m) → enlem, boylam (derece), elipsoit yüksekliği (m); GRS80 (ITRF96 / WGS84 ile cm altı aynı). */
export function ecefToGeo(x, y, z) {
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - E2)), h = 0;
  for (let i = 0; i < 8; i++) {
    const N = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
    h = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - E2 * N / (N + h)));
  }
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI, h };
}
/** İki nokta arası yüzey uzaklığı (km). */
export function uzaklikKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || !isFinite(v))) return null;
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
