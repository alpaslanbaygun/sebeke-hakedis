// Excel (.xlsx / .xlsm) paketini zip içinde hücre düzeyinde düzenleme: şablon doldurma için (Birleşik Metraj,
// ortak/BIRLESIK-METRAJ.md). Yalnız dokunulan sayfaların XML'i yeniden yazılır; makro (vbaProject.bin), stiller,
// listeler, koşullu biçimler, tanımlı adlar aynen kalır. Eklentideki karşılığı Cekirdek/XlsmDosyasi.cs.
//
// Kurallar:
// - Metin inlineStr, sayı <v>, formül <f> ile yazılır; var olan hücrenin stili (s) korunur, yeni hücre aynı sütunda
//   yukarıdaki en yakın hücrenin stilini alır.
// - Paylaşılan formül (t="shared") grubunun ana hücresine yazılırken grup açılır: bağımlı hücrelere kendi formülleri
//   (göreli başvurular kaydırılarak) yazılır. Bağımlı hücreye yazılırken yalnız o hücrenin <f>'i kalkar.
// - Yazarken calcChain.xml silinir ve workbook.xml'e fullCalcOnLoad="1" konur: Excel açılınca her şeyi yeniden hesaplar.
import { zip, unzip } from './zip.js';

const dec = (u8) => new TextDecoder().decode(u8);
const enc = (s) => new TextEncoder().encode(s);

/** Sütun harfi → 1 tabanlı dizin (A=1, Z=26, AA=27). */
export function sutunNo(harf) { let n = 0; for (const ch of String(harf).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
/** 1 tabanlı dizin → sütun harfi. */
export function sutunHarfi(n) { let s = ''; while (n > 0) { const k = (n - 1) % 26; s = String.fromCharCode(65 + k) + s; n = Math.floor((n - 1) / 26); } return s; }
/** "AB12" → { sutun: 28, satir: 12 }. */
export function hucreCoz(ref) { const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(String(ref).toUpperCase()); if (!m) throw new Error('Hücre adresi değil: ' + ref); return { sutun: sutunNo(m[1]), satir: +m[2] }; }
export const hucreAdi = (sutun, satir) => sutunHarfi(sutun) + satir;

export const xmlKac = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const xmlCoz = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');

/** <is> ya da <si> içindeki metin (düz ya da zengin metin parçaları). */
function metinParcalari(ic) { let s = ''; for (const m of ic.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) s += xmlCoz(m[1]); return s; }

/**
 * Formülü (drow, dcol) kadar kaydırır: göreli başvurular değişir, mutlak ($) parçalar kalır; tırnak içi metinler ve
 * işlev adları (LOG10( gibi) dokunulmaz. Eklentideki XlsmDosyasi.FormulKaydir ile aynı.
 */
export function formulKaydir(formul, dsatir, dsutun) {
  if (!formul || (!dsatir && !dsutun)) return formul;
  let out = '', i = 0;
  const s = String(formul);
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') { // metin
      let j = i + 1;
      while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { j += 2; continue; } break; } j++; }
      out += s.slice(i, j + 1); i = j + 1; continue;
    }
    if (ch === "'") { // sayfa adı
      let j = i + 1;
      while (j < s.length) { if (s[j] === "'") { if (s[j + 1] === "'") { j += 2; continue; } break; } j++; }
      out += s.slice(i, j + 1); i = j + 1; continue;
    }
    const m = /^(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![\w(])/.exec(s.slice(i));
    const onceki = i > 0 ? s[i - 1] : '';
    if (m && !/[\w.]/.test(onceki)) {
      let sutun = sutunNo(m[2]), satir = +m[4];
      if (!m[1]) sutun += dsutun;
      if (!m[3]) satir += dsatir;
      if (sutun < 1 || satir < 1) { out += m[0]; i += m[0].length; continue; }
      out += m[1] + sutunHarfi(sutun) + m[3] + satir;
      i += m[0].length;
      continue;
    }
    out += ch; i++;
  }
  return out;
}

/** Bir sayfanın XML'i: satırlar ve hücreler ayrıştırılmış; yazılınca yeniden kurulur. */
export class Sayfa {
  constructor(ad, yol, xml, paket) {
    this.ad = ad; this.yol = yol; this.paket = paket; this.degisti = false;
    const bas = xml.indexOf('<sheetData'), bitis = xml.indexOf('</sheetData>');
    if (bas < 0) throw new Error('Sayfa XML\'inde sheetData yok: ' + ad);
    const kendiKapanan = xml.slice(bas, xml.indexOf('>', bas) + 1).endsWith('/>');
    this.on = xml.slice(0, bas);
    if (kendiKapanan) { this.ic = ''; this.son = xml.slice(xml.indexOf('>', bas) + 1); }
    else { this.ic = xml.slice(xml.indexOf('>', bas) + 1, bitis); this.son = xml.slice(bitis + '</sheetData>'.length); }
    this.satirlar = new Map();   // satır no → { nitelik: string, hucreler: Map(sutun → { nitelik, ic }) }
    for (const rm of this.ic.matchAll(/<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g)) {
      const r = +((/\br="(\d+)"/.exec(rm[1]) || [])[1] || 0);
      if (!r) continue;
      const hucreler = new Map();
      let k = 1;
      for (const cm of (rm[3] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = (/\br="([A-Z]+)(\d+)"/.exec(cm[1]) || []);
        const c = ref[1] ? sutunNo(ref[1]) : k;
        k = c + 1;
        hucreler.set(c, { nitelik: cm[1].replace(/\br="[A-Z]+\d+"/, '').trim(), ic: cm[2] || '' });
      }
      this.satirlar.set(r, { nitelik: rm[1].replace(/\br="\d+"/, '').replace(/\bspans="[^"]*"/, '').trim(), hucreler });
    }
    this.ic = null;
  }

  /** Sayfadaki en büyük satır ve sütun. */
  sinirlar() {
    let maxR = 0, maxC = 0;
    for (const [r, s] of this.satirlar) { if (r > maxR) maxR = r; for (const c of s.hucreler.keys()) if (c > maxC) maxC = c; }
    return { satir: maxR, sutun: maxC };
  }

  hucre(ref) { const { sutun, satir } = hucreCoz(ref); const s = this.satirlar.get(satir); return s ? s.hucreler.get(sutun) || null : null; }

  /** Hücrenin ham bilgisi: { tur: 's'|'n'|'str'|'inlineStr'|'b'|'e'|null, v, formul, paylasilan: {si, ref} | null }. */
  oku(ref) {
    const h = this.hucre(ref);
    if (!h) return null;
    const t = (/\bt="([^"]+)"/.exec(h.nitelik) || [])[1] || null;
    const v = (/<v>([\s\S]*?)<\/v>/.exec(h.ic) || [])[1];
    const f = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(h.ic);
    let formul = null, paylasilan = null;
    if (f) {
      formul = f[2] != null ? xmlCoz(f[2]) : '';
      if (/\bt="shared"/.test(f[1])) paylasilan = { si: +((/\bsi="(\d+)"/.exec(f[1]) || [])[1] || 0), ref: (/\bref="([^"]+)"/.exec(f[1]) || [])[1] || null };
    }
    let is_ = null;
    if (t === 'inlineStr') is_ = metinParcalari(h.ic);
    return { tur: t, v: v != null ? xmlCoz(v) : null, formul, paylasilan, inline: is_, stil: (/\bs="(\d+)"/.exec(h.nitelik) || [])[1] || null };
  }

  /** Hücrenin metni (paylaşılan dize çözülür; sayı olduğu gibi; boş → ""). */
  metin(ref) {
    const o = this.oku(ref);
    if (!o) return '';
    if (o.tur === 's') return this.paket.paylasilanDize(+o.v);
    if (o.tur === 'inlineStr') return o.inline || '';
    if (o.v != null) return o.v;
    return '';
  }

  /** Hücrenin formülü (paylaşılan bağımlıysa ana formülden çevrilir); formül yoksa null. */
  formul(ref) {
    const o = this.oku(ref);
    if (!o || o.formul == null) return null;
    if (o.paylasilan && o.formul === '') {
      const ana = this.paylasilanAna(o.paylasilan.si);
      if (!ana) return null;
      const a = hucreCoz(ana.ref), b = hucreCoz(ref);
      return formulKaydir(ana.formul, b.satir - a.satir, b.sutun - a.sutun);
    }
    return o.formul;
  }

  /** Paylaşılan formül grubunun ana hücresi { ref, formul, aralik }. */
  paylasilanAna(si) {
    if (!this._analar) {
      this._analar = new Map();
      for (const [r, s] of this.satirlar) for (const [c, h] of s.hucreler) {
        if (!h.ic || h.ic.indexOf('t="shared"') < 0) continue;
        const f = /<f\b([^>]*?)>([\s\S]*?)<\/f>/.exec(h.ic);
        if (!f || !/\bref="/.test(f[1])) continue;
        this._analar.set(+((/\bsi="(\d+)"/.exec(f[1]) || [])[1] || 0), { ref: hucreAdi(c, r), formul: xmlCoz(f[2]), aralik: (/\bref="([^"]+)"/.exec(f[1]) || [])[1] });
      }
    }
    return this._analar.get(si) || null;
  }

  /** Paylaşılan grubun ana hücresi değişmeden önce grup açılır: bağımlılara kendi formülleri yazılır. */
  paylasilanAc(si) {
    const ana = this.paylasilanAna(si);
    if (!ana) return;
    const a = hucreCoz(ana.ref);
    for (const [r, s] of this.satirlar) for (const [c, h] of s.hucreler) {
      if (!h.ic || h.ic.indexOf('t="shared"') < 0) continue;
      const f = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(h.ic);
      if (!f || +((/\bsi="(\d+)"/.exec(f[1]) || [])[1] || -1) !== si) continue;
      if (c === a.sutun && r === a.satir) continue;
      const yeni = formulKaydir(ana.formul, r - a.satir, c - a.sutun);
      h.ic = h.ic.replace(/<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>)/, '<f>' + xmlKac(yeni) + '</f>');
    }
    this._analar.delete(si);
    this.degisti = true;
  }

  _satir(r) {
    let s = this.satirlar.get(r);
    if (!s) { s = { nitelik: '', hucreler: new Map() }; this.satirlar.set(r, s); }
    return s;
  }

  /** Aynı sütunda yukarıdaki (300 satıra kadar) en yakın hücrenin stili. */
  stilBul(sutun, satir) {
    for (let r = satir; r >= Math.max(1, satir - 300); r--) {
      const s = this.satirlar.get(r); const h = s && s.hucreler.get(sutun);
      if (h) { const m = /\bs="(\d+)"/.exec(h.nitelik); if (m) return m[1]; }
    }
    return null;
  }

  _hazirla(ref) {
    const { sutun, satir } = hucreCoz(ref);
    const s = this._satir(satir);
    let h = s.hucreler.get(sutun);
    if (h) {
      const o = this.oku(ref);
      if (o && o.paylasilan && o.formul) this.paylasilanAc(o.paylasilan.si);   // ana hücre: grubu aç
      h.nitelik = h.nitelik.replace(/\bt="[^"]*"/, '').trim();
    } else {
      const stil = this.stilBul(sutun, satir);
      h = { nitelik: stil ? 's="' + stil + '"' : '', ic: '' };
      s.hucreler.set(sutun, h);
    }
    this.degisti = true;
    return h;
  }

  yazMetin(ref, metin) {
    const h = this._hazirla(ref);
    if (metin == null || metin === '') { h.ic = ''; return; }
    h.nitelik = (h.nitelik + ' t="inlineStr"').trim();
    h.ic = '<is><t' + (/^\s|\s$/.test(metin) ? ' xml:space="preserve"' : '') + '>' + xmlKac(metin) + '</t></is>';
  }

  yazSayi(ref, sayi) {
    const h = this._hazirla(ref);
    if (sayi == null || sayi === '' || !isFinite(+sayi)) { h.ic = ''; return; }
    h.ic = '<v>' + (+sayi) + '</v>';
  }

  /** Formül ("=" olmadan). Önbellek değeri yazılmaz; fullCalcOnLoad ile Excel hesaplar. */
  yazFormul(ref, formul) {
    const h = this._hazirla(ref);
    h.ic = '<f>' + xmlKac(String(formul).replace(/^=/, '')) + '</f>';
  }

  /** Değere göre yazar: sayı → sayı, "=…" → formül, metin → metin, null / "" → boşaltır. */
  yaz(ref, deger) {
    if (deger == null || deger === '') { this.temizle(ref); return; }
    if (typeof deger === 'number') { this.yazSayi(ref, deger); return; }
    const s = String(deger);
    if (s[0] === '=') { this.yazFormul(ref, s.slice(1)); return; }
    this.yazMetin(ref, s);
  }

  temizle(ref) { const h = this._hazirla(ref); h.ic = ''; }

  /** Hücrenin stilini başka hücreden alır (yeni sütun başlıkları için); kaynakSayfa verilirse o sayfadan (stiller çalışma kitabında ortak). */
  stilKopyala(kaynakRef, hedefRef, kaynakSayfa = null) {
    const k = (kaynakSayfa || this).hucre(kaynakRef);
    const stil = k ? (/\bs="(\d+)"/.exec(k.nitelik) || [])[1] : null;
    const { sutun, satir } = hucreCoz(hedefRef);
    const s = this._satir(satir);
    let h = s.hucreler.get(sutun);
    if (!h) { h = { nitelik: '', ic: '' }; s.hucreler.set(sutun, h); }
    h.nitelik = h.nitelik.replace(/\bs="\d+"/, '').trim();
    if (stil) h.nitelik = ('s="' + stil + '" ' + h.nitelik).trim();
    this.degisti = true;
  }

  /** Hücreyi bütünüyle kaldırır (stil de gider). */
  hucreSil(ref) {
    const { sutun, satir } = hucreCoz(ref);
    const s = this.satirlar.get(satir);
    if (s && s.hucreler.delete(sutun)) this.degisti = true;
  }

  /** Satırın niteliklerini (yükseklik…) ve hücre stillerini (sütun sütun) örnek satırdan alır; değerlere dokunmaz. */
  satirBicimKopyala(kaynakSatir, hedefSatir, sonSutun = 0) {
    const k = this.satirlar.get(kaynakSatir);
    if (!k) return;
    const h = this._satir(hedefSatir);
    h.nitelik = k.nitelik;
    for (const [c, kh] of k.hucreler) {
      if (sonSutun && c > sonSutun) continue;
      const stil = (/\bs="(\d+)"/.exec(kh.nitelik) || [])[1];
      let hh = h.hucreler.get(c);
      if (!hh) { hh = { nitelik: '', ic: '' }; h.hucreler.set(c, hh); }
      hh.nitelik = hh.nitelik.replace(/\bs="\d+"/, '').trim();
      if (stil) hh.nitelik = ('s="' + stil + '" ' + hh.nitelik).trim();
    }
    this.degisti = true;
  }

  /** ilkSutun'dan sağdaki bütün hücreleri (verilen satır aralığında) kaldırır; o sütunlardaki birleşik hücre tanımlarını da. */
  sutunlariBosalt(ilkSutun, ilkSatir, sonSatir) {
    for (const [r, s] of this.satirlar) {
      if (r < ilkSatir || r > sonSatir) continue;
      for (const c of [...s.hucreler.keys()]) if (c >= ilkSutun) s.hucreler.delete(c);
    }
    const m = /<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/.exec(this.son);
    if (m) {
      const kalan = [...m[1].matchAll(/<mergeCell\b[^>]*ref="([^"]+)"[^>]*\/>/g)].filter((x) => {
        const a = hucreCoz(x[1].split(':')[0]);
        return a.sutun < ilkSutun;
      }).map((x) => x[0]);
      this.son = this.son.replace(m[0], kalan.length ? '<mergeCells count="' + kalan.length + '">' + kalan.join('') + '</mergeCells>' : '');
    }
    this.degisti = true;
  }

  satirGoster(r) {
    const s = this.satirlar.get(r);
    if (s && /\bhidden="1"/.test(s.nitelik)) { s.nitelik = s.nitelik.replace(/\s*\bhidden="1"/, '').trim(); this.degisti = true; }
  }

  satirGizle(r) {
    const s = this._satir(r);
    if (!/\bhidden="1"/.test(s.nitelik)) { s.nitelik = (s.nitelik + ' hidden="1"').trim(); this.degisti = true; }
  }

  satirGizliMi(r) { const s = this.satirlar.get(r); return !!(s && /\bhidden="1"/.test(s.nitelik)); }

  /** <cols> içinde sütun genişliği: kaynak sütunun <col> tanımı hedefe kopyalanır. */
  sutunGenisligiKopyala(kaynak, hedef) {
    const m = /<cols>([\s\S]*?)<\/cols>/.exec(this.on);
    if (!m) return;
    let bulunan = null;
    for (const cm of m[1].matchAll(/<col\b[^>]*\/>/g)) {
      const min = +((/\bmin="(\d+)"/.exec(cm[0]) || [])[1] || 0), max = +((/\bmax="(\d+)"/.exec(cm[0]) || [])[1] || 0);
      if (kaynak >= min && kaynak <= max) { bulunan = cm[0]; break; }
    }
    if (!bulunan) return;
    // hedefi kapsayan bir <col> varsa bölünmez; yalnız yoksa eklenir
    for (const cm of m[1].matchAll(/<col\b[^>]*\/>/g)) {
      const min = +((/\bmin="(\d+)"/.exec(cm[0]) || [])[1] || 0), max = +((/\bmax="(\d+)"/.exec(cm[0]) || [])[1] || 0);
      if (hedef >= min && hedef <= max) return;
    }
    const yeni = bulunan.replace(/\bmin="\d+"/, 'min="' + hedef + '"').replace(/\bmax="\d+"/, 'max="' + hedef + '"');
    this.on = this.on.replace('</cols>', yeni + '</cols>');
    this.degisti = true;
  }

  /** XML'i yeniden kurar. */
  xml() {
    const satirNolari = [...this.satirlar.keys()].sort((a, b) => a - b);
    let ic = '';
    let maxC = 1, maxR = 1;
    for (const r of satirNolari) {
      const s = this.satirlar.get(r);
      const sutunlar = [...s.hucreler.keys()].sort((a, b) => a - b);
      if (!sutunlar.length && !s.nitelik) continue;
      maxR = r;
      let hc = '';
      for (const c of sutunlar) {
        const h = s.hucreler.get(c);
        if (c > maxC) maxC = c;
        hc += '<c r="' + hucreAdi(c, r) + '"' + (h.nitelik ? ' ' + h.nitelik : '') + (h.ic ? '>' + h.ic + '</c>' : '/>');
      }
      const spans = sutunlar.length ? ' spans="' + sutunlar[0] + ':' + sutunlar[sutunlar.length - 1] + '"' : '';
      ic += '<row r="' + r + '"' + spans + (s.nitelik ? ' ' + s.nitelik : '') + (hc ? '>' + hc + '</row>' : '/>');
    }
    let on = this.on.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:' + hucreAdi(maxC, maxR) + '"/>');
    return on + '<sheetData>' + ic + '</sheetData>' + this.son;
  }
}

/** Açılmış paket. */
export class Xlsm {
  static async ac(bytes) {
    const dosyalar = await unzip(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    if (!dosyalar['xl/workbook.xml']) throw new Error('Excel dosyası değil (xl/workbook.xml yok).');
    return new Xlsm(dosyalar);
  }

  constructor(dosyalar) {
    this.dosyalar = dosyalar;
    this.workbook = dec(dosyalar['xl/workbook.xml']);
    const rels = dosyalar['xl/_rels/workbook.xml.rels'] ? dec(dosyalar['xl/_rels/workbook.xml.rels']) : '';
    this.rel = {};
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId="([^"]+)"/.exec(m[0]), tg = /\bTarget="([^"]+)"/.exec(m[0]);
      if (id && tg) this.rel[id[1]] = tg[1].replace(/^\/xl\//, '').replace(/^\//, '');
    }
    this.sayfalar = [];
    for (const m of this.workbook.matchAll(/<sheet\b[^>]*>/g)) {
      const ad = xmlCoz((/\bname="([^"]*)"/.exec(m[0]) || [])[1] || '');
      const rid = (/\br:id="([^"]+)"/.exec(m[0]) || [])[1];
      const yol = 'xl/' + (this.rel[rid] || ('worksheets/sheet' + (this.sayfalar.length + 1) + '.xml'));
      this.sayfalar.push({ ad, yol, sheetId: (/\bsheetId="(\d+)"/.exec(m[0]) || [])[1], durum: (/\bstate="([^"]+)"/.exec(m[0]) || [])[1] || 'visible' });
    }
    this._dizeler = null;
    this._sayfalar = new Map();
    this.tanimliAdlar = new Map();
    for (const m of this.workbook.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)) {
      const ad = (/\bname="([^"]+)"/.exec(m[1]) || [])[1];
      if (ad) this.tanimliAdlar.set(ad, xmlCoz(m[2]));
    }
  }

  paylasilanDize(i) {
    if (!this._dizeler) {
      this._dizeler = [];
      const ss = this.dosyalar['xl/sharedStrings.xml'] ? dec(this.dosyalar['xl/sharedStrings.xml']) : '';
      for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) this._dizeler.push(m[1] ? metinParcalari(m[1]) : '');
    }
    return this._dizeler[i] != null ? this._dizeler[i] : '';
  }

  sayfaAdlari() { return this.sayfalar.map((s) => s.ad); }

  /** Sayfa (ayrıştırılmış, önbellekte). */
  sayfa(ad) {
    if (this._sayfalar.has(ad)) return this._sayfalar.get(ad);
    const s = this.sayfalar.find((x) => x.ad === ad);
    if (!s || !this.dosyalar[s.yol]) throw new Error('Sayfa yok: ' + ad);
    const sayfa = new Sayfa(ad, s.yol, dec(this.dosyalar[s.yol]), this);
    this._sayfalar.set(ad, sayfa);
    return sayfa;
  }

  /**
   * Tanımlı adı çözer: "'DİREK METRAJI'!$G$10:$ZZ$10" → { sayfa, bas: {sutun, satir}, bit: {sutun, satir} }.
   * Tek hücre ise bas = bit. Çözülemezse null.
   */
  tanimliAd(ad) {
    const t = this.tanimliAdlar.get(ad);
    if (!t) return null;
    const m = /^(?:'((?:[^']|'')*)'|([^'!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(t.trim());
    if (!m) return null;
    const sayfa = m[1] != null ? m[1].replace(/''/g, "'") : m[2];
    const bas = { sutun: sutunNo(m[3]), satir: +m[4] };
    const bit = m[5] ? { sutun: sutunNo(m[5]), satir: +m[6] } : bas;
    return { sayfa, bas, bit };
  }

  /** Yeni (boş) sayfa ekler; sonraki sayfa adını döner. Basit: sheetData boş, varsayılan stiller. */
  sayfaEkle(ad) {
    const n = this.sayfalar.length + 1;
    let yol = 'xl/worksheets/sheet' + n + '.xml', k = n;
    while (this.dosyalar[yol]) { k++; yol = 'xl/worksheets/sheet' + k + '.xml'; }
    const rid = 'rIdSM' + k;
    const sheetId = Math.max(0, ...this.sayfalar.map((s) => +s.sheetId || 0)) + 1;
    this.dosyalar[yol] = enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData/></worksheet>');
    this.workbook = this.workbook.replace('</sheets>', '<sheet name="' + xmlKac(ad) + '" sheetId="' + sheetId + '" r:id="' + rid + '"/></sheets>');
    const relYol = 'xl/_rels/workbook.xml.rels';
    let rels = dec(this.dosyalar[relYol]);
    rels = rels.replace('</Relationships>', '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="' + yol.replace(/^xl\//, '') + '"/></Relationships>');
    this.dosyalar[relYol] = enc(rels);
    let ct = dec(this.dosyalar['[Content_Types].xml']);
    if (ct.indexOf('PartName="/' + yol + '"') < 0) ct = ct.replace('</Types>', '<Override PartName="/' + yol + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    this.dosyalar['[Content_Types].xml'] = enc(ct);
    this.sayfalar.push({ ad, yol, sheetId: String(sheetId), durum: 'visible' });
    this.rel[rid] = yol.replace(/^xl\//, '');
    return this.sayfa(ad);
  }

  /**
   * Sayfayı kopyalar (biçim, formüller, değerler, birleşik hücreler, sütun genişlikleri, koruma); yorum, çizim, yazıcı ayarı
   * ve VBA kod adı gibi bağlı parçalar kopyaya alınmaz. Yeni sayfa kaynağın hemen sağına konur. Eklentideki XlsmDosyasi.SayfaKopyala.
   */
  sayfaKopyala(kaynakAd, yeniAd) {
    const k = this.sayfalar.find((x) => x.ad === kaynakAd);
    if (!k) throw new Error('Sayfa yok: ' + kaynakAd);
    if (this.sayfalar.some((x) => x.ad === yeniAd)) return this.sayfa(yeniAd);
    const kaynak = this.sayfa(kaynakAd);
    let xml = (kaynak.degisti ? kaynak.xml() : dec(this.dosyalar[k.yol]));
    xml = xml.replace(/\s+xr:uid="[^"]*"/, '').replace(/\s+codeName="[^"]*"/, '').replace(/\s+tabSelected="1"/, '')
      .replace(/<legacyDrawing\b[^>]*\/>/g, '').replace(/<legacyDrawingHF\b[^>]*\/>/g, '').replace(/<drawing\b[^>]*\/>/g, '').replace(/<picture\b[^>]*\/>/g, '')
      .replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g, '').replace(/<tableParts\b[^>]*\/>/g, '')
      .replace(/<oleObjects\b[^>]*>[\s\S]*?<\/oleObjects>/g, '').replace(/<controls\b[^>]*>[\s\S]*?<\/controls>/g, '')
      .replace(/<hyperlinks\b[^>]*>[\s\S]*?<\/hyperlinks>/g, '')
      .replace(/(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g, '$1');
    let n = this.sayfalar.length + 1, yol = 'xl/worksheets/sheet' + n + '.xml';
    while (this.dosyalar[yol]) { n++; yol = 'xl/worksheets/sheet' + n + '.xml'; }
    const rid = 'rIdSM' + n;
    const sheetId = Math.max(0, ...this.sayfalar.map((s) => +s.sheetId || 0)) + 1;
    this.dosyalar[yol] = enc(xml);
    const giris = '<sheet name="' + xmlKac(yeniAd) + '" sheetId="' + sheetId + '" r:id="' + rid + '"/>';
    // kaynağın (ve önceki kopyalarının) hemen sağına: kopyalar açılış sırasıyla dizilir
    let onceki = k;
    for (const s of this.sayfalar) if (s.kopyasi === kaynakAd) onceki = s;
    const oncekiGiris = new RegExp('<sheet\\b[^>]*name="' + xmlKac(onceki.ad).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*/>');
    this.workbook = oncekiGiris.test(this.workbook) ? this.workbook.replace(oncekiGiris, (m) => m + giris) : this.workbook.replace('</sheets>', giris + '</sheets>');
    const relYol = 'xl/_rels/workbook.xml.rels';
    this.dosyalar[relYol] = enc(dec(this.dosyalar[relYol]).replace('</Relationships>', '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="' + yol.replace(/^xl\//, '') + '"/></Relationships>'));
    let ct = dec(this.dosyalar['[Content_Types].xml']);
    if (ct.indexOf('PartName="/' + yol + '"') < 0) ct = ct.replace('</Types>', '<Override PartName="/' + yol + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    this.dosyalar['[Content_Types].xml'] = enc(ct);
    const yeni = { ad: yeniAd, yol, sheetId: String(sheetId), durum: 'visible', kopyasi: kaynakAd };
    this.sayfalar.splice(this.sayfalar.indexOf(onceki) + 1, 0, yeni);
    this.rel[rid] = yol.replace(/^xl\//, '');
    return this.sayfa(yeniAd);
  }

  /** Paketi yazar: değişen sayfalar, workbook (fullCalcOnLoad), calcChain silinir. */
  async yaz() {
    for (const s of this._sayfalar.values()) if (s.degisti) this.dosyalar[s.yol] = enc(s.xml());
    let wb = this.workbook;
    if (/<calcPr\b/.test(wb)) {
      wb = wb.replace(/<calcPr\b([^>]*?)\/>/, (m, a) => '<calcPr' + (/\bfullCalcOnLoad=/.test(a) ? a.replace(/\bfullCalcOnLoad="[^"]*"/, 'fullCalcOnLoad="1"') : a + ' fullCalcOnLoad="1"') + '/>');
    } else wb = wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
    this.dosyalar['xl/workbook.xml'] = enc(wb);
    if (this.dosyalar['xl/calcChain.xml']) {
      delete this.dosyalar['xl/calcChain.xml'];
      const relYol = 'xl/_rels/workbook.xml.rels';
      if (this.dosyalar[relYol]) this.dosyalar[relYol] = enc(dec(this.dosyalar[relYol]).replace(/<Relationship\b[^>]*Target="calcChain\.xml"[^>]*\/>/, ''));
      if (this.dosyalar['[Content_Types].xml']) this.dosyalar['[Content_Types].xml'] = enc(dec(this.dosyalar['[Content_Types].xml']).replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''));
    }
    // [Content_Types].xml ve _rels/.rels önce (Excel sıraya bakmaz ama alışkanlık)
    const adlar = Object.keys(this.dosyalar).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : a.localeCompare(b)));
    return zip(adlar.map((ad) => ({ name: ad, data: this.dosyalar[ad] })));
  }
}
