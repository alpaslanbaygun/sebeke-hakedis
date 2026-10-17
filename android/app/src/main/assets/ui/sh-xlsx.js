/*
 * Şebeke Hakediş — Excel (.xlsx) yazıcı ve Durum Tespit raporu.
 *
 * AutoCAD eklentisindeki XlsxYazici.cs ve RaporYazici.cs'nin karşılığıdır: aynı sayfalar, sütunlar ve
 * biçimler. Bağımlılık yoktur; zip sıkıştırması tarayıcının CompressionStream'iyle yapılır (yoksa
 * sıkıştırmadan yazılır). Tarayıcıda window.SHX, Node'da require() ile kullanılır.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sh-core.js'));
  else root.SHX = factory(root.SH);
})(typeof self !== 'undefined' ? self : this, function (SH) {
  'use strict';

  // ---------------------------------------------------------------- ZIP

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  async function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined' || typeof Blob === 'undefined' || typeof Response === 'undefined') return null;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) {
      return null;
    }
  }

  function dosTime(d) {
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xFFFF;
  }

  function dosDate(d) {
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  }

  /** files: [{name, data: Uint8Array|string}] → zip dosyası (Uint8Array). */
  async function zip(files, sikistir) {
    const enc = new TextEncoder();
    const now = new Date();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      let comp = sikistir === false ? null : await deflateRaw(data);
      const method = comp && comp.length < data.length ? 8 : 0;
      if (method === 0) comp = data;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 0x0800, true);
      h.setUint16(8, method, true);
      h.setUint16(10, dosTime(now), true);
      h.setUint16(12, dosDate(now), true);
      h.setUint32(14, crc, true);
      h.setUint32(18, comp.length, true);
      h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true);
      h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, comp);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, method, true);
      c.setUint16(12, dosTime(now), true);
      c.setUint16(14, dosDate(now), true);
      c.setUint32(16, crc, true);
      c.setUint32(20, comp.length, true);
      c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + comp.length;
    }
    let size = 0;
    for (const p of central) size += p.length;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    let total = 0;
    for (const p of all) total += p.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of all) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  }

  // ---------------------------------------------------------------- XLSX

  function kacis(s) {
    let out = '';
    for (const ch of String(s)) {
      if (ch === '&') out += '&amp;';
      else if (ch === '<') out += '&lt;';
      else if (ch === '>') out += '&gt;';
      else if (ch === '"') out += '&quot;';
      else if (ch.charCodeAt(0) < 0x20 && ch !== '\t' && ch !== '\n' && ch !== '\r') continue;
      else out += ch;
    }
    return out;
  }

  function sutunAdi(c) {
    let ad = '';
    c++;
    while (c > 0) {
      const m = (c - 1) % 26;
      ad = String.fromCharCode(65 + m) + ad;
      c = Math.floor((c - 1) / 26);
    }
    return ad;
  }

  function sayfaAdi(ad) {
    let s = String(ad || 'Sayfa').replace(/[[\]:*?/\\]/g, '').trim();
    if (!s) s = 'Sayfa';
    return s.length > 31 ? s.slice(0, 31) : s;
  }

  /** Kitap: sayfaEkle(ad) → {basliklar, satirlar, genislikler, sayiBicimleri, filtre, ustBilgi}; kaydet() → Uint8Array. */
  function kitap() {
    const sayfalar = [];

    function sayfaEkle(ad) {
      const s = { ad: sayfaAdi(ad), basliklar: [], satirlar: [], genislikler: {}, sayiBicimleri: {}, filtre: true, ustBilgi: [] };
      sayfalar.push(s);
      return s;
    }

    function hucre(parts, c, r, d, bicim) {
      const adres = sutunAdi(c) + r;
      if (typeof d === 'number') {
        if (!Number.isFinite(d)) return;
        parts.push('<c r="' + adres + '" s="' + bicim + '"><v>' + String(d) + '</v></c>');
      } else {
        const m = d === undefined || d === null ? '' : String(d);
        if (m.length === 0 && bicim === 0) return;
        parts.push('<c r="' + adres + '" s="' + bicim + '" t="inlineStr"><is><t xml:space="preserve">' + kacis(m) + '</t></is></c>');
      }
    }

    function otomatikGenislik(s, c) {
      let en = c < s.basliklar.length ? Math.min(s.basliklar[c].length + 3, 22) : 8;
      let bak = 0;
      for (const satir of s.satirlar) {
        const v = satir[c];
        if (v !== undefined && v !== null) {
          const u = typeof v === 'number' ? (Number.isInteger(v) ? String(v).length : 12) : String(v).length;
          if (u > en) en = u;
        }
        if (++bak > 2000) break;
      }
      return Math.max(6, Math.min(60, en + 2));
    }

    function sayfaXml(s) {
      const parts = [];
      const ust = s.ustBilgi.length;
      const baslikSatiri = ust + 1;
      const sonSatir = baslikSatiri + s.satirlar.length;
      const sutunSayisi = Math.max(1, s.basliklar.length);
      parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
      parts.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
      parts.push('<dimension ref="A1:' + sutunAdi(sutunSayisi - 1) + Math.max(1, sonSatir) + '"/>');
      parts.push('<sheetViews><sheetView workbookViewId="0"');
      parts.push(s.basliklar.length ? '><pane ySplit="' + baslikSatiri + '" topLeftCell="A' + (baslikSatiri + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView>' : '/>');
      parts.push('</sheetViews><sheetFormatPr defaultRowHeight="14"/><cols>');
      for (let c = 0; c < sutunSayisi; c++) {
        const g = s.genislikler[c] !== undefined ? s.genislikler[c] : otomatikGenislik(s, c);
        parts.push('<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + Number(g.toFixed(2)) + '" customWidth="1"/>');
      }
      parts.push('</cols><sheetData>');
      let r = 1;
      for (const u of s.ustBilgi) {
        parts.push('<row r="' + r + '">');
        hucre(parts, 0, r, u, 5);
        parts.push('</row>');
        r++;
      }
      if (s.basliklar.length) {
        parts.push('<row r="' + r + '" ht="30" customHeight="1">');
        s.basliklar.forEach((b, c) => hucre(parts, c, r, b, 1));
        parts.push('</row>');
        r++;
      }
      for (const satir of s.satirlar) {
        parts.push('<row r="' + r + '">');
        for (let c = 0; c < satir.length; c++) {
          const d = satir[c];
          if (d === undefined || d === null) continue;
          let bicim = 0;
          if (typeof d === 'number') {
            const f = s.sayiBicimleri[c];
            bicim = f === '0' ? 2 : f === '0.00' ? 3 : 4;
          }
          hucre(parts, c, r, d, bicim);
        }
        parts.push('</row>');
        r++;
      }
      parts.push('</sheetData>');
      if (s.filtre && s.basliklar.length) {
        parts.push('<autoFilter ref="A' + baslikSatiri + ':' + sutunAdi(s.basliklar.length - 1) + Math.max(baslikSatiri + 1, sonSatir) + '"/>');
      }
      parts.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>');
      parts.push('<pageSetup paperSize="9" orientation="landscape"/></worksheet>');
      return parts.join('');
    }

    function kitapXml() {
      let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000"/></bookViews><sheets>';
      sayfalar.forEach((s, i) => { x += '<sheet name="' + kacis(s.ad) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; });
      x += '</sheets>';
      let tanim = '';
      sayfalar.forEach((s, i) => {
        if (!s.filtre || !s.basliklar.length) return;
        const bas = s.ustBilgi.length + 1;
        const son = bas + Math.max(1, s.satirlar.length);
        tanim += '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + kacis(s.ad.replace(/'/g, "''")) +
          '\'!$A$' + bas + ':$' + sutunAdi(s.basliklar.length - 1) + '$' + son + '</definedName>';
      });
      if (tanim) x += '<definedNames>' + tanim + '</definedNames>';
      return x + '</workbook>';
    }

    const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.######"/></numFmts>' +
      '<fonts count="3"><font><sz val="10"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="12"/><name val="Calibri"/><family val="2"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

    async function kaydet(sikistir) {
      const files = [];
      let ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
      sayfalar.forEach((s, i) => { ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; });
      ct += '</Types>';
      files.push({ name: '[Content_Types].xml', data: ct });
      files.push({
        name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
          '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
      });
      files.push({
        name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<dc:creator>Şebeke Hakediş</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>'
      });
      files.push({ name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Şebeke Hakediş</Application></Properties>' });
      files.push({ name: 'xl/workbook.xml', data: kitapXml() });
      let rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      sayfalar.forEach((s, i) => { rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; });
      rels += '<Relationship Id="rId' + (sayfalar.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
      files.push({ name: 'xl/_rels/workbook.xml.rels', data: rels });
      files.push({ name: 'xl/styles.xml', data: STYLES });
      sayfalar.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sayfaXml(s) }));
      return zip(files, sikistir);
    }

    return { sayfaEkle, kaydet, sayfalar };
  }

  // ---------------------------------------------------------------- Durum Tespit raporu

  function indeksSayi(s) {
    const t = String(s === undefined || s === null ? '' : s).trim();
    return /^[+-]?\d+$/.test(t) ? Number(t) : t;
  }

  function tarihYazisi(d) {
    const p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /**
   * Durum Tespit raporu (RaporYazici.cs ile aynı sayfalar). o: {surum, katsayilar, hakedis, bolge}.
   * hakedis / bolge verilirse ÖZET ve DURUM TESPİT yalnız o hakediş / bölgenin satırlarını içerir.
   */
  async function raporYaz(p, o) {
    const opt = o || {};
    const k = opt.katsayilar || SH.katsayiHazirla(null);
    const tum = SH.durumTespit(p, k);
    const satirlar = SH.satirSuz(tum, p, opt.hakedis || null, opt.bolge || null);
    const bolgeAd = new Map(p.bolgeler.map(b => [b.id, b]));
    const projeAdi = id => (bolgeAd.get(id) || {}).ad || '';
    const projeKodu = id => (bolgeAd.get(id) || {}).kod || '';
    const kontrol = SH.kontrolMetni;
    const x = kitap();

    const oz = x.sayfaEkle('ÖZET');
    oz.ustBilgi.push('DURUM TESPİT ÖZETİ — ' + p.proje.ad + (opt.hakedis ? ' — Hakediş ' + opt.hakedis : ''));
    oz.ustBilgi.push('Kaynak: ' + (p.proje.kaynak || 'telefon') + '   ·   Oluşturma: ' + tarihYazisi(new Date()) + '   ·   Şebeke Hakediş ' + (opt.surum || ''));
    oz.basliklar.push('PROJE', 'PROJE KODU', 'HAK. NO', 'DURUM', 'CİNS', 'TİP', 'BİRİM', 'MİKTAR', 'TOP. MİK.', 'TOP. TL.', 'SATIR');
    const kodlar = new Map(p.bolgeler.map(b => [b.ad, b.kod]));
    for (const r of SH.ozet(satirlar)) oz.satirlar.push([r.proje, kodlar.get(r.proje) || '', r.hakedis, r.durum, r.cins, r.tip, r.birim, r.miktar, r.toplam, r.tutar, r.satir]);
    oz.genislikler[0] = 60;
    oz.sayiBicimleri[2] = '0';
    oz.sayiBicimleri[9] = '0.00';
    oz.sayiBicimleri[10] = '0';

    const d = x.sayfaEkle('DURUM TESPİT');
    d.basliklar.push('HANDLE', 'PROJE', 'CİNS', 'TİP', 'DURUM', 'BİRM F.', 'MİKTAR', 'BİRİM', 'METRİK A.', 'TOP. MİK.', 'TOP. TL.', 'HAK. NO', 'BÖL.TARİFE', 'MLZ.TARİFE', 'DM DRM', 'INDEX', 'KONTROL');
    for (const s of satirlar) {
      d.satirlar.push([s.handle, s.proje, s.cins, s.tip, s.durum, s.birimFiyat, s.miktar, s.birim, s.katsayi, s.toplam, s.tutar, s.hakedis,
        s.bolgeTarife, s.malzemeTarife, s.dmDurum, indeksSayi(s.index), s.kontrol]);
    }
    d.genislikler[1] = 50;
    d.sayiBicimleri[11] = '0';
    d.sayiBicimleri[10] = '0.00';
    d.sayiBicimleri[15] = '0';

    const a = x.sayfaEkle('ANA MALZEME');
    a.basliklar.push('HANDLE', 'PROJE', 'SIRA', 'GIS ID', 'CİNS', 'TİP', 'DURUM', 'BİRM F.', 'MİKTAR', 'BİRİM', 'METRİK A.', 'TOP. MİK.', 'TOP. TL.', 'HAK. NO', 'BÖL.TARİFE', 'MLZ.TARİFE', 'DM DRM', 'INDEX', 'KONTROL');
    for (const e of p.elemanlar) {
      const ana = (e.kalemler || []).find(z => z.ana) || {};
      a.satirlar.push([e.id, projeAdi(e.bolge), e.id, e.gisId, ana.cins || '', ana.tanim || '', ana.durum || '', ana.birimFiyat || 0, ana.miktar || 0,
        ana.birim || '', ana.katsayi === undefined ? 1 : ana.katsayi, ana.toplam || 0, SH.temiz((ana.toplam || 0) * (ana.birimFiyat || 0), 2), ana.hakedis || 0,
        projeKodu(e.bolge), ana.tarife || '', ana.dmDurum || 'Standart', indeksSayi(ana.sira), kontrol(e.kontrol)]);
    }
    a.genislikler[1] = 50;
    a.sayiBicimleri[13] = '0';
    a.sayiBicimleri[17] = '0';

    const h = x.sayfaEkle('HAT VE İLETKENLER');
    h.basliklar.push('HANDLE', 'PROJE', 'GIS UZ.', 'FARK', 'CİNS', 'TİP', 'DURUM', 'BİRM F.', 'MİKTAR', 'BİRİM', 'METRİK A.', 'TOP. MİK.', 'TOP. TL.', 'HAK. NO', 'BÖL.TARİFE', 'TARİFE', 'INDEX', 'KONTROL');
    for (const hat of p.hatlar) {
      const gis = SH.temiz(SH.uzunluk(hat.kose), 2);
      for (const kl of hat.kalemler || []) {
        if (kl.kaynak !== 'HAT') continue;
        h.satirlar.push([hat.id, projeAdi(hat.bolge), gis, SH.temiz(kl.miktar - gis, 2), kl.cins, kl.tanim, kl.durum, kl.birimFiyat || 0, kl.miktar, kl.birim,
          kl.katsayi, kl.toplam, SH.temiz(kl.toplam * (kl.birimFiyat || 0), 2), kl.hakedis, projeKodu(hat.bolge), kl.tarife, indeksSayi(kl.sira), kontrol(kl.kontrol)]);
      }
    }
    h.genislikler[1] = 50;
    h.sayiBicimleri[2] = '0.00';
    h.sayiBicimleri[3] = '0.00';
    h.sayiBicimleri[13] = '0';
    h.sayiBicimleri[16] = '0';

    const kn = x.sayfaEkle('KANALLAR');
    kn.basliklar.push('HANDLE', 'PROJE', 'BAŞ. NO', 'BİT. NO', 'ALT G.', 'ÜST G.', 'DERİNLİK', 'UZUNLUK', 'GIS UZ.', 'FARK', 'CİNS', 'TİP', 'DURUM', 'BİRM F.', 'UZUNLUK', 'BİRİM', 'METRİK A.', 'HACİM (m3)', 'TOP. TL.', 'HAK. NO', 'BÖL.TARİFE', 'TARİFE', 'INDEX', 'KONTROL');
    for (const c of p.kanallar) {
      const kl = (c.kalemler || []).find(z => z.ana) || {};
      const gis = SH.temiz(SH.uzunluk(c.kose), 2);
      const kont = c.kontrol !== null && c.kontrol !== undefined ? c.kontrol : kl.kontrol;
      kn.satirlar.push([c.id, projeAdi(c.bolge), c.basNo || '', c.bitNo || '', c.altGenislik, c.ustGenislik, c.derinlik, kl.miktar || 0, gis,
        SH.temiz((kl.miktar || 0) - gis, 2), SH.kanalKablolari(c.kod), c.zemin, c.durum, kl.birimFiyat || 0, kl.miktar || 0, kl.birim || '',
        kl.katsayi === undefined ? 1 : kl.katsayi, kl.toplam || 0, SH.temiz((kl.toplam || 0) * (kl.birimFiyat || 0), 2), kl.hakedis || 0,
        projeKodu(c.bolge), kl.tarife || '', indeksSayi(kl.sira), kontrol(kont)]);
    }
    kn.genislikler[1] = 50;
    kn.sayiBicimleri[8] = '0.00';
    kn.sayiBicimleri[9] = '0.00';
    kn.sayiBicimleri[19] = '0';
    kn.sayiBicimleri[22] = '0';

    const sj = x.sayfaEkle('SONDAJ');
    sj.basliklar.push('HANDLE', 'PROJE', 'BAŞ. NO', 'BİT. NO', 'GIS UZ.', 'FARK', 'CİNS', 'TİP', 'DURUM', 'BİRM F.', 'UZUNLUK (mt)', 'BİRİM', 'METRİK A.', 'TOP UZUNLUK (mt)', 'TOP. TL.', 'HAK. NO', 'BÖL.TARİFE', 'TARİFE', 'INDEX', 'KONTROL');
    for (const s of p.sondajlar) {
      const kl = (s.kalemler || []).find(z => z.ana) || {};
      const gis = SH.temiz(SH.uzunluk(s.kose), 2);
      const kont = s.kontrol !== null && s.kontrol !== undefined ? s.kontrol : kl.kontrol;
      sj.satirlar.push([s.id, projeAdi(s.bolge), s.basNo || '', s.bitNo || '', gis, SH.temiz((kl.miktar || 0) - gis, 2), kl.cins || '', kl.tanim || '',
        kl.durum || '', kl.birimFiyat || 0, kl.miktar || 0, kl.birim || '', kl.katsayi === undefined ? 1 : kl.katsayi, kl.toplam || 0,
        SH.temiz((kl.toplam || 0) * (kl.birimFiyat || 0), 2), kl.hakedis || 0, projeKodu(s.bolge), kl.tarife || '', indeksSayi(kl.sira), kontrol(kont)]);
    }
    sj.genislikler[1] = 50;

    const g = x.sayfaEkle('GPS');
    g.basliklar.push('HANDLE', 'X KOOR (sağa)', 'Y KOOR (yukarı)', 'Z KOOR', 'PROJE', 'HAK.NO', 'METIN 1', 'METIN 2', 'METIN 3', 'METIN 4', 'METIN 5', 'METIN 6');
    for (const n of p.noktalar) {
      const r = [n.id, SH.temiz(n.saga, 3), SH.temiz(n.yukari, 3), SH.temiz(n.kot, 3), projeAdi(n.bolge), n.hakedis, n.ad, n.kod];
      (n.ekMetinler || []).slice(0, 4).forEach(m => r.push(m));
      g.satirlar.push(r);
    }
    g.genislikler[4] = 50;
    g.sayiBicimleri[1] = '0.00';
    g.sayiBicimleri[2] = '0.00';
    g.sayiBicimleri[3] = '0.00';
    g.sayiBicimleri[5] = '0';

    const ks = x.sayfaEkle('KATSAYILAR');
    ks.filtre = false;
    ks.basliklar.push('TABLO', 'ANAHTAR', 'OG', 'AG', 'AYD', 'REK', '', '');
    ks.satirlar.push(['HAT TARİFESİ', '', k.tarifeOG, k.tarifeAG, k.tarifeAYD, k.tarifeREK]);
    for (const [key, v] of Object.entries(k.kanalPaylasim)) ks.satirlar.push(['KANAL PAYLAŞIM', key, v[0], v[1], v[2], v[3]]);
    ks.satirlar.push(['KANAL KODU', 'REK 1 + AYD 2 + AG 4 + OG 8']);
    k.agAdlar.forEach((ad, i) => ks.satirlar.push(['AG İLETKEN kg/m', ad, k.agAgirlik[i]]));
    k.ogAdlar.forEach((ad, i) => ks.satirlar.push(['OG İLETKEN kg/m', ad, k.ogAgirlik[i]]));
    const acilim = (teller, adlar) => adlar.map((ad, i) => (teller[i] ? teller[i] + ' ' + ad : null)).filter(Boolean).join(' + ');
    for (const [key, v] of Object.entries(k.agAcilim)) ks.satirlar.push(['AG İLETKEN AÇILIMI', key, acilim(v, k.agAdlar)]);
    for (const [key, v] of Object.entries(k.ogAcilim)) ks.satirlar.push(['OG İLETKEN AÇILIMI', key, acilim(v, k.ogAdlar)]);
    ks.genislikler[0] = 22;
    ks.genislikler[1] = 28;
    ks.genislikler[2] = 30;

    if (p.uyarilar && p.uyarilar.length) {
      const u = x.sayfaEkle('UYARILAR');
      u.basliklar.push('UYARI');
      for (const m of p.uyarilar) u.satirlar.push([m]);
      u.genislikler[0] = 120;
    }
    return x.kaydet();
  }

  /** Uint8Array → base64 (köprüden ikili dosya göndermek için). */
  function base64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let s = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    return btoa(s);
  }

  return { crc32, zip, kitap, raporYaz, base64, sutunAdi };
});
