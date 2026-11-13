// Birleşik Metraj: eski programın Excel şablonunu (DİREK / İLETKEN / YERALTI METRAJI + MALZ. LİSTESİ) projeden doldurur.
// Kural ortak/BIRLESIK-METRAJ.md'de; eklentideki karşılığı Cekirdek/XlsmDosyasi.cs + Cekirdek/BirlesikMetraj.cs.
// İş bölümü:
//   sablonTanimi(xlsm)   şablonun yapısını okur (tanımlı adlar, KOD sütunları, sabit sütunlar, EK satırları, listeler)
//   SH.birlesikMetraj    ortak kural: projeden hücre planı (sh-core.cjs)
//   planUygula           planı dosyaya yazar: hücreler, yeni sütunlar (biçim, formüller), satır gizleme, fazla sayfası
//   birlesikMetrajUret   üçünü birleştirir → dosya baytları
import SH from '../interop/sh-core.cjs';
import { Xlsm, sutunHarfi, sutunNo, hucreAdi, hucreCoz, formulKaydir } from './xlsm.js';

const LISTE_ADLARI = { LST_YENI_DIREK: 'yeniDirek', LST_DEMONTAJ: 'demontaj', LST_DMONTAJ: 'dmontaj', LST_IM_ILETKEN: 'imIletken', LST_IM_AER: 'imAer', LST_AYD_DIREK: 'aydDirek', LST_BOX: 'box' };
export const FAZLA_SAYFASI = 'ŞABLONDA OLMAYAN';

const norm = (s) => SH.bmNorm(s);

/** Başlık satırlarında (1..son) düzenli ifadeye uyan ilk hücrenin sütun harfi. */
function baslikBul(s, sonSatir, sonSutun, re, basla = 1, haric = null) {
  for (let r = basla; r <= sonSatir; r++) {
    for (let c = 1; c <= sonSutun; c++) {
      if (haric && haric.has(c)) continue;
      const t = s.metin(hucreAdi(c, r));
      if (t !== '' && typeof t === 'string' && re.test(t.trim())) return { sutun: sutunHarfi(c), sutunNo: c, satir: r, metin: t.trim() };
    }
  }
  return null;
}

/** Bir metraj sayfasının tanımı (DM_ / IM_ / YM_ tanımlı adlarından). Tanımlı ad yoksa null. */
function metrajSayfasi(x, onek) {
  const kod = x.tanimliAd(onek + '_KOD_SATIRI');
  if (!kod) return null;
  const s = x.sayfa(kod.sayfa);
  const satir = (ek) => { const a = x.tanimliAd(onek + '_' + ek); return a ? a.bas.satir : null; };
  // Tanımlı adların aralıkları sayfasız ("$G$10:$ZZ$10"): kopya sayfanın MALZ. LİSTESİ formülleri bu aralığı kopya sayfasıyla kullanır
  const aralik = (ek) => { const a = x.tanimliAd(onek + '_' + ek); return a ? '$' + sutunHarfi(a.bas.sutun) + '$' + a.bas.satir + ':$' + sutunHarfi(a.bit.sutun) + '$' + a.bit.satir : null; };
  const adlar = {};
  for (const ek of ['KOD', 'TIP', 'DURUM', 'POZ', 'AD', 'SEC', 'BIRIM', 'TOPLAM', 'MALZ']) { const r = aralik(ek + '_SATIRI'); if (r) adlar[ek] = r; }
  const o = {
    sayfa: kod.sayfa, onek, kodSatiri: kod.bas.satir, tipSatiri: satir('TIP_SATIRI'), durumSatiri: satir('DURUM_SATIRI'),
    pozSatiri: satir('POZ_SATIRI'), adSatiri: satir('AD_SATIRI'), teminSatiri: satir('SEC_SATIRI'), birimSatiri: satir('BIRIM_SATIRI'),
    toplamSatiri: satir('TOPLAM_SATIRI'), malzSatiri: satir('MALZ_SATIRI'), ilkKodSutunu: kod.bas.sutun, adlar,
    bayrakSatirlari: [], grupSatiri: null, altSatirlar: [], ilkVeri: 0, sonVeri: 0, sonSutun: 0, sutunlar: [], sabit: {}, baslik: {}
  };
  if (!o.pozSatiri || !o.adSatiri || !o.teminSatiri || !o.birimSatiri) throw new Error(kod.sayfa + ': şablonun ' + onek + '_ tanımlı adları eksik.');
  o.ilkVeri = o.birimSatiri + 1;
  const sinir = s.sinirlar();
  if (!o.toplamSatiri) {
    // İLETKEN'de TOPLAM satırının tanımlı adı yok: A sütununda "TOPLAM" ile başlayan ilk satır (MALZ satırından önce)
    const son = o.malzSatiri || sinir.satir;
    for (let r = o.ilkVeri + 1; r <= son; r++) if (/^TOPLAM/i.test(String(s.metin('A' + r)).trim())) { o.toplamSatiri = r; break; }
    if (!o.toplamSatiri) throw new Error(kod.sayfa + ': TOPLAM satırı bulunamadı.');
    // İLETKEN: TOPLAM satırının tanımlı adı olmadığından MALZ. LİSTESİ kopya formülleri MALZ satırını kullanır; yine de aralık verilir
    if (!o.adlar.TOPLAM) o.adlar.TOPLAM = '$' + sutunHarfi(kod.bas.sutun) + '$' + o.toplamSatiri + ':$' + sutunHarfi(kod.bit.sutun) + '$' + o.toplamSatiri;
  }
  o.sonVeri = o.toplamSatiri - 1;
  // KOD sütunları
  let ilkKodlu = 0, oncekiBlok = 'Y';
  for (let c = kod.bas.sutun; c <= Math.min(sinir.sutun, kod.bit.sutun); c++) {
    const kodMetni = String(s.metin(hucreAdi(c, o.kodSatiri))).trim();
    if (!kodMetni) continue;
    if (!ilkKodlu) ilkKodlu = c;
    let blok = /^Y/i.test(kodMetni) ? 'Y' : /^DM/i.test(kodMetni) ? 'DM' : /^D/i.test(kodMetni) ? 'D' : /^A/i.test(kodMetni) ? 'A' : null;
    if (!blok) {
      const d = o.durumSatiri ? norm(s.metin(hucreAdi(c, o.durumSatiri))) : '';
      blok = d === 'YENI' ? 'Y' : d === 'DM' ? 'D' : d === 'AKTARIM' ? 'A' : oncekiBlok;
    }
    oncekiBlok = blok;
    const ad = String(s.metin(hucreAdi(c, o.adSatiri))).trim();
    const veri = s.oku(hucreAdi(c, o.ilkVeri));
    o.sutunlar.push({
      sutun: c, kod: kodMetni, blok, tip: o.tipSatiri ? String(s.metin(hucreAdi(c, o.tipSatiri))).trim() || null : null,
      poz: String(s.metin(hucreAdi(c, o.pozSatiri))).trim(), ad, temin: String(s.metin(hucreAdi(c, o.teminSatiri))).trim(),
      birim: String(s.metin(hucreAdi(c, o.birimSatiri))).trim(), grup: null, formullu: !!(veri && veri.formul != null)
    });
    o.sonSutun = c;
  }
  // bayrak ve grup satırları: üst başlık satırlarından sonra, poz satırından önce
  const ust = Math.max(o.kodSatiri, o.tipSatiri || 0, o.durumSatiri || 0);
  for (let r = ust + 1; r < o.pozSatiri; r++) {
    const h = ilkKodlu ? s.oku(hucreAdi(ilkKodlu, r)) : null;
    if (h && h.formul != null) o.bayrakSatirlari.push(r); else if (o.grupSatiri == null) o.grupSatiri = r;
  }
  if (o.grupSatiri) for (const k of o.sutunlar) k.grup = String(s.metin(hucreAdi(k.sutun, o.grupSatiri))).trim() || null;
  // alt satırlar: toplam satırından başlayıp formülü süren satırlar (İLETKEN'de 116–120)
  for (let r = o.toplamSatiri; r <= o.toplamSatiri + 8; r++) {
    const h = ilkKodlu ? s.oku(hucreAdi(ilkKodlu, r)) : null;
    if (h && h.formul != null) o.altSatirlar.push(r); else if (r > o.toplamSatiri) break;
  }
  return o;
}

/** Metraj sayfasının sabit sütunları (başlık yazılarından). */
function sabitler(s, o, hangi) {
  const kodSutunlari = new Set(o.sutunlar.map((k) => k.sutun));   // sabit sütunlar KOD sütunu değildir
  const ara = (re) => { const b = baslikBul(s, o.ilkVeri - 1, o.sonSutun, re, Math.max(1, o.kodSatiri - 1), kodSutunlari); return b ? b.sutun : null; };
  if (hangi === 'direk') {
    o.sabit = { no: ara(/^Direk No/i) || 'A', yeni: ara(/^Yeni Direk/i) || 'C', demontaj: ara(/^Demontaj$/i) || 'D', dmm: ara(/^Demontajdan Montaj/i) || 'E', mevcut: ara(/^Mevcut$/i) || 'F' };
    // İLİ … PROJE_TÜRÜ başlıkları: etiket A sütununda, değer sağındaki ilk dolu (yoksa iki sağ) hücrede
    const etiketler = { il: /^İLİ$/i, ilce: /^İLÇESİ$/i, grupNo: /^GRUP_NO$/i, isinAdi: /^İŞİN_ADI$/i, projeNo: /^PROJE_NO$/i, yuklenici: /^YÜKLENİCİ_FİRMA$/i, hakedisNo: /^HAK_EDİŞ_NO$/i, projeTuru: /^PROJE_TÜRÜ$/i };
    // değer sütunu: etiketlerin sağındaki ilk dolu hücrelerin en sık sütunu (boş olanlar da aynı sütuna yazılır)
    const bulunan = [], sayac = {};
    for (const [ad, re] of Object.entries(etiketler)) {
      const b = baslikBul(s, o.ilkVeri - 1, 2, re);
      if (!b) continue;
      let deger = null;
      for (let c = b.sutunNo + 1; c <= b.sutunNo + 3; c++) if (s.metin(hucreAdi(c, b.satir)) !== '') { deger = c; break; }
      if (deger) sayac[deger] = (sayac[deger] || 0) + 1;
      bulunan.push({ ad, b });
    }
    const degerSutunu = +Object.keys(sayac).sort((p, q) => sayac[q] - sayac[p])[0] || 0;
    for (const { ad, b } of bulunan) o.baslik[ad] = hucreAdi(degerSutunu || b.sutunNo + 2, b.satir);
  } else if (hangi === 'iletken') {
    const cift = (re) => { const b = baslikBul(s, o.ilkVeri - 1, o.sonSutun, re, 1, kodSutunlari); return b ? [b.sutun, sutunHarfi(b.sutunNo + 1)] : null; };
    const ag = [];
    for (let i = 1; i <= 4; i++) { const c = cift(new RegExp('^AG İLETKEN ' + i + '$', 'i')); if (c) ag.push(c); }
    o.sabit = {
      direkler: ara(/Direkler Arası/i) || 'A', aramesafe: ara(/^Aramesafe/i) || 'E', tertip: ara(/^Hat Tertibi/i) || 'F',
      ag: ag.length ? ag : [['G', 'H'], ['I', 'J'], ['K', 'L']], og: cift(/^OG İLETKEN$/i) || ['M', 'N'], aer: cift(/ALPEK|AER/i) || ['O', 'P'],
      durum: ara(/^YENİ \/ DM/i) || ara(/^DURUM$/i) || 'Q'
    };
  } else {
    o.sabit = {
      no: ara(/^Direk\s*\/\s*Box No/i) || 'A', karakteristik: ara(/^Yatırım Karakteristiği/i), unsur: ara(/^Yatırım Unsurları/i),
      direkCinsi: ara(/^Direk Cinsi$/i), aydDirek: ara(/^Aydınlatma Direk Cinsi/i), betonDirek: ara(/^Beton Direk Cinsi/i), box: ara(/^Box Cinsi/i),
      aramesafe: ara(/^Aramesafe/i) || 'I', tertip: ara(/^Hat Tertibi/i), taban: ara(/^TABAN$/i), tavan: ara(/^TAVAN$/i), derinlik: ara(/^DERİNLİK$/i),
      dolgu: ara(/^KANAL DOLGU CİNSİ/i), toplamM3: ara(/^TOPRAK KANAL TOPLAMI/i), duvar: ara(/^DUVAR MONTAJ/i), aciklama: ara(/^AÇIKLAMA$/i), kaplama: ara(/^Kaplama Cinsi/i)
    };
  }
}

/** MALZ. LİSTESİ: KOD sütunu, formül sütunları ve EK satırları (G sütunu E001… olan satırlar). */
function malzListesi(x) {
  for (const sb of x.sayfalar) {
    const s = x.sayfa(sb.ad);
    let kaynak = null;
    for (const [r, satir] of s.satirlar) {
      for (const [c] of satir.hucreler) {
        const f = s.formul(hucreAdi(c, r));
        const m = f && /MATCH\(\$([A-Z]+)\d+,(?:DM|IM|YM)_KOD_SATIRI,0\)/.exec(f);
        if (m) { kaynak = { satir: r, kaynakSutunu: sutunHarfi(c), kodSutunu: m[1] }; break; }
      }
      if (kaynak) break;
    }
    if (!kaynak) continue;
    const o = { sayfa: sb.ad, kodSutunu: kaynak.kodSutunu, kaynakSutunu: kaynak.kaynakSutunu, pozSutunu: null, adSutunu: null, birimSutunu: null, teminSutunu: null, miktarSutunu: null, toplamSutunu: null, bayrakSutunu: null, kalemOrnekSatiri: kaynak.satir, grupOrnekSatiri: null, ekBaslikSatiri: null, ekSatirlari: [] };
    const satir = s.satirlar.get(kaynak.satir);
    for (const [c] of satir.hucreler) {
      const f = s.formul(hucreAdi(c, kaynak.satir)) || '';
      const h = sutunHarfi(c);
      if (/_POZ_SATIRI/.test(f)) o.pozSutunu = h;
      else if (/_AD_SATIRI/.test(f)) o.adSutunu = h;
      else if (/_BIRIM_SATIRI/.test(f)) o.birimSutunu = h;
      else if (/_SEC_SATIRI/.test(f) && !/TRIM/.test(f)) o.teminSutunu = h;
      else if (/N\(INDEX\((?:DM|IM|YM)_(?:TOPLAM|MALZ)_SATIRI/.test(f)) o.miktarSutunu = h;
    }
    if (!o.pozSutunu || !o.adSutunu || !o.birimSutunu || !o.teminSutunu || !o.miktarSutunu) throw new Error(sb.ad + ': malzeme listesi sütunları çözülemedi.');
    // toplam sütunu: miktar sütununa eşit olan ("=H7"); bayrak sütunu: toplam > 0 denetimi yapan ("IF(F7>0,1,0)")
    for (const [c] of satir.hucreler) {
      const f = (s.formul(hucreAdi(c, kaynak.satir)) || '').replace(/\s+/g, '');
      const h = sutunHarfi(c);
      if (f === o.miktarSutunu + kaynak.satir) o.toplamSutunu = h;
    }
    for (const [c] of satir.hucreler) {
      const f = (s.formul(hucreAdi(c, kaynak.satir)) || '').replace(/\s+/g, '');
      if (o.toplamSutunu && f === 'IF(' + o.toplamSutunu + kaynak.satir + '>0,1,0)') o.bayrakSutunu = sutunHarfi(c);
    }
    // grup başlığı örneği: KOD'suz, ad sütununda yazılı, bir sonraki satırı KOD'lu ilk satır (ör. "BARALAR")
    const satirlar = [...s.satirlar.keys()].sort((a, b) => a - b);
    for (let i = 0; i + 1 < satirlar.length; i++) {
      const r = satirlar[i];
      if (r >= kaynak.satir) break;
      const kodVar = String(s.metin(o.kodSutunu + r)).trim() !== '', adVar = String(s.metin(o.adSutunu + r)).trim() !== '';
      const sonrakiKod = String(s.metin(o.kodSutunu + satirlar[i + 1])).trim() !== '';
      if (!kodVar && adVar && sonrakiKod) { o.grupOrnekSatiri = r; break; }
    }
    for (const r of satirlar) {
      const k = String(s.metin(o.kodSutunu + r)).trim();
      if (/^E\d{3}$/i.test(k)) o.ekSatirlari.push({ satir: r, kod: k });
    }
    // EK KALEMLER bölüm başlığı: ilk EK satırının üstündeki KOD'suz yazılı satır
    if (o.ekSatirlari.length) {
      const r = o.ekSatirlari[0].satir - 1;
      const yazi = [o.pozSutunu, o.adSutunu].map((c) => String(s.metin(c + r)).trim()).join('');
      if (yazi && String(s.metin(o.kodSutunu + r)).trim() === '') o.ekBaslikSatiri = r;
    }
    return o;
  }
  return null;
}

/**
 * KATSAYILAR seçim listeleri (LST_* tanımlı adları). Şablonda listeler TİP satırlarından formülle dolar; önbellek değeri
 * yoksa (temiz şablon) liste, şablon tanımından aynı kuralla türetilir: yeniDirek = DİREK Y bloğundaki TİP'ler, dmontaj = DM
 * bloğu, demontaj = D bloğu "TİP (K/S)", imIletken = İLETKEN YENİ bloğunda kg birimli TİP'ler, imAer = öteki TİP'ler,
 * aydDirek = DİREK Y bloğunda pozu 5.5.3 olan adlar, box = elle (boş).
 */
function listeDegerleri(anahtar, t) {
  const D = t.direk, I = t.iletken;
  const tipler = (o, blok) => (o ? o.sutunlar.filter((k) => k.blok === blok && k.tip).map((k) => k.tip) : []);
  switch (anahtar) {
    case 'yeniDirek': return tipler(D, 'Y');
    case 'dmontaj': return tipler(D, 'DM');
    case 'demontaj': return D ? D.sutunlar.filter((k) => k.blok === 'D' && k.tip).map((k) => k.tip + ' (' + (k.temin || 'K').slice(0, 1) + ')') : [];
    case 'imIletken': return I ? I.sutunlar.filter((k) => k.blok === 'Y' && k.tip && /^kg/i.test(k.birim)).map((k) => k.tip) : [];
    case 'imAer': return I ? I.sutunlar.filter((k) => k.blok === 'Y' && k.tip && !/^kg/i.test(k.birim)).map((k) => k.tip) : [];
    case 'aydDirek': return D ? D.sutunlar.filter((k) => k.blok === 'Y' && k.poz === '5.5.3' && k.ad).map((k) => k.ad) : [];
    default: return [];
  }
}
function listeler(x, t) {
  const out = {};
  for (const [ad, anahtar] of Object.entries(LISTE_ADLARI)) {
    const tanim = x.tanimliAdlar.get(ad);
    if (!tanim) continue;
    const m = /^(?:'((?:[^']|'')*)'|([^'!]+))!\$([A-Z]+)\$(\d+)(?::(?:INDEX\([^)]*\$[A-Z]+\$(\d+),|\$[A-Z]+\$(\d+)))?/.exec(tanim.trim());
    if (!m) continue;
    const sayfa = m[1] != null ? m[1].replace(/''/g, "'") : m[2];
    const l = { sayfa, sutun: m[3], ilk: +m[4], son: +(m[5] || m[6] || m[4]), degerler: [] };
    let s;
    try { s = x.sayfa(sayfa); } catch (e) { continue; }
    let formullu = false;
    for (let r = l.ilk; r <= l.son; r++) {
      const o = s.oku(l.sutun + r);
      if (o && o.formul != null) formullu = true;
      const v = s.metin(l.sutun + r);
      if (v === '') break;
      l.degerler.push(String(v));
    }
    if (formullu) l.degerler = listeDegerleri(anahtar, t);
    out[anahtar] = l;
  }
  return out;
}

/** Şablon tanımı: SH.birlesikMetraj'ın beklediği yapı (ortak/BIRLESIK-METRAJ.md § Şablon tanımı). */
export function sablonTanimi(x) {
  const t = { direk: metrajSayfasi(x, 'DM'), iletken: metrajSayfasi(x, 'IM'), yeralti: metrajSayfasi(x, 'YM'), malz: null, listeler: {}, kullanilanKodlar: [] };
  if (!t.direk && !t.iletken && !t.yeralti) throw new Error('Bu dosya Birleşik Metraj şablonu değil (DM_KOD_SATIRI gibi tanımlı adlar yok).');
  for (const [hangi, o] of Object.entries({ direk: t.direk, iletken: t.iletken, yeralti: t.yeralti })) {
    if (!o) continue;
    sabitler(x.sayfa(o.sayfa), o, hangi);
    for (const k of o.sutunlar) t.kullanilanKodlar.push(k.kod);
  }
  t.malz = malzListesi(x);
  t.listeler = listeler(x, t);
  return t;
}

/** Planı dosyaya işler. */
export function planUygula(x, sablon, plan) {
  const sayfalar = { direk: sablon.direk, iletken: sablon.iletken, yeralti: sablon.yeralti };
  // 0) kopya sayfalar (cins başına DİREK METRAJI kopyası): kaynağın biçimiyle, KOD sütunları boş (yeni sütunlar aşağıda açılır)
  for (const k of plan.kopyaSayfalar || []) {
    const t = sayfalar[k.hangi];
    if (!t) continue;
    const s = x.sayfaKopyala(k.kaynak, k.ad);
    const sonSatir = Math.max(t.toplamSatiri, ...t.altSatirlar, t.malzSatiri || 0);
    s.sutunlariBosalt(t.ilkKodSutunu, Math.min(t.kodSatiri, t.tipSatiri || t.kodSatiri, t.durumSatiri || t.kodSatiri), sonSatir);
  }
  // 1) yeni sütunlar: biçim, genişlik, bayrak / toplam / alt satır formülleri, (gerekirse) veri formülleri — örnek ana sayfada
  for (const y of plan.yeniSutunlar || []) {
    const t = sayfalar[y.hangi];
    if (!t || !y.ornekSutun) continue;
    const s = x.sayfa(y.sayfa || t.sayfa), o = x.sayfa(y.ornekSayfa || t.sayfa);
    const kaynak = y.ornekSutun, hedef = y.sutun, fark = hedef - kaynak;
    if (o === s) s.sutunGenisligiKopyala(kaynak, hedef);
    const ustSatirlar = [];
    for (let r = Math.min(t.kodSatiri, t.tipSatiri || t.kodSatiri, t.durumSatiri || t.kodSatiri); r <= t.birimSatiri; r++) ustSatirlar.push(r);
    const formulluSatirlar = [...t.bayrakSatirlari, ...t.altSatirlar];
    for (const r of [...ustSatirlar, ...formulluSatirlar]) {
      s.stilKopyala(hucreAdi(kaynak, r), hucreAdi(hedef, r), o);
      if (formulluSatirlar.indexOf(r) >= 0) { const f = o.formul(hucreAdi(kaynak, r)); if (f != null) s.yazFormul(hucreAdi(hedef, r), formulKaydir(f, 0, fark)); }
    }
    for (let r = t.ilkVeri; r <= t.sonVeri; r++) {
      s.stilKopyala(hucreAdi(kaynak, r), hucreAdi(hedef, r), o);
      if (y.veriFormulu) { const f = o.formul(hucreAdi(kaynak, r)); if (f != null) s.yazFormul(hucreAdi(hedef, r), formulKaydir(f, 0, fark)); }
    }
  }
  // 1b) MALZ. LİSTESİ'ne eklenen satırların biçimi: grup başlığı ve kalem satırı örneklerinden
  const M = sablon.malz;
  if (M) {
    const s = x.sayfa(M.sayfa), sonSutun = Math.max(...[M.kodSutunu, M.kaynakSutunu, M.pozSutunu, M.adSutunu, M.birimSutunu, M.teminSutunu, M.miktarSutunu, M.toplamSutunu || 'A', M.bayrakSutunu || 'A'].map(sutunNo));
    for (const m of plan.malzSatirlari || []) {
      const ornek = m.tur === 'grup' ? M.grupOrnekSatiri : M.kalemOrnekSatiri;
      if (ornek && ornek !== m.satir) s.satirBicimKopyala(ornek, m.satir, sonSutun);
    }
  }
  // 2) hücreler (null: hücre boşaltılır)
  for (const [ad, sp] of Object.entries(plan.sayfalar || {})) {
    const s = x.sayfa(ad);
    for (const [ref, deger] of Object.entries(sp.hucreler || {})) s.yaz(ref, deger);
    for (const r of sp.gosterSatirlar || []) s.satirGoster(r);
    if (sp.gizle) for (let r = sp.gizle[0]; r <= sp.gizle[1]; r++) s.satirGizle(r);
  }
  // 3) şablona sığmayan malzemeler
  if (plan.fazla && plan.fazla.length) {
    const s = x.sayfaEkle(FAZLA_SAYFASI);
    const bas = ['Sayfa', 'Blok', 'Poz', 'Malzeme', 'Birim', 'Miktar', 'Nerede'];
    bas.forEach((b, i) => s.yazMetin(hucreAdi(i + 1, 1), b));
    const sayfaAdi = { direk: sablon.direk && sablon.direk.sayfa, iletken: sablon.iletken && sablon.iletken.sayfa, yeralti: sablon.yeralti && sablon.yeralti.sayfa };
    plan.fazla.forEach((f, i) => {
      const r = i + 2;
      s.yazMetin(hucreAdi(1, r), sayfaAdi[f.hangi] || f.hangi);
      s.yazMetin(hucreAdi(2, r), f.blok);
      s.yazMetin(hucreAdi(3, r), f.poz || '');
      s.yazMetin(hucreAdi(4, r), f.ad);
      s.yazMetin(hucreAdi(5, r), f.birim);
      s.yazSayi(hucreAdi(6, r), f.miktar);
      s.yazMetin(hucreAdi(7, r), (f.nereler || []).join(', '));
    });
  }
}

/**
 * Plan ayarı: ayar.json alanları (bolgeId, firma, il, ilce, hakedisNo) + ortak tablolar → SH.birlesikMetraj ayarı.
 * tablolar: { katsayilar: katsayilar.json, eslesme: metraj-sablon.json, kalemler: kalemler.json (poz numaraları) }.
 */
export function planAyari(ayar, tablolar) {
  const a = ayar || {}, t = tablolar || {};
  const poz = {}, pozSade = {}, anaCinsler = {}, cinsAdlari = {};
  // sade anahtar: boşluk (bölünmez boşluk da) ve büyük / küçük harf farkı yok (eklenti Katalog.Bul ile aynı; ilk kayıt kazanır)
  const sade = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, '').toUpperCase().replace(/İ/g, 'I').replace(/ı/g, 'I');
  for (const k of (t.kalemler && t.kalemler.kalemler) || []) {
    if (k.pozNo) { poz[k.cins + '|' + k.tanim] = k.pozNo; const sk = k.cins + '|' + sade(k.tanim); if (!(sk in pozSade)) pozSade[sk] = k.pozNo; }
    if (k.rol === 'ana') { const n = SH.bmNorm(k.tanim); (anaCinsler[n] = anaCinsler[n] || []).includes(k.cins) || anaCinsler[n].push(k.cins); }
  }
  for (const c of (t.kalemler && t.kalemler.cinsler) || []) if (c.cins && c.ad) cinsAdlari[c.cins] = c.ad;
  return {
    bolgeId: a.bolgeId || '', firma: a.firma || '', il: a.il || '', ilce: a.ilce || '', hakedisNo: a.hakedisNo != null ? a.hakedisNo : '',
    katsayilar: SH.katsayiHazirla(t.katsayilar || null), eslesme: t.eslesme || {},
    poz: (c, tn) => poz[c + '|' + tn] || pozSade[c + '|' + sade(tn)] || '', anaCinsler, cinsAdlari
  };
}

/**
 * Projeden (eklenti biçimi, SH.projeOku) Birleşik Metraj dosyası üretir.
 * sablonBytes: .xlsm şablonu; ayar: SH.birlesikMetraj ayarı. Dönüş: { bytes, plan, sablon }.
 */
export async function birlesikMetrajUret(p, sablonBytes, ayar) {
  const x = await Xlsm.ac(sablonBytes);
  const sablon = sablonTanimi(x);
  const plan = SH.birlesikMetraj(p, sablon, ayar || {});
  planUygula(x, sablon, plan);
  const bytes = await x.yaz();
  return { bytes, plan, sablon };
}

export { Xlsm, sutunHarfi, sutunNo, hucreCoz };
