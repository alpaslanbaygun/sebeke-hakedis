// Excel Import Service — şablon üretimi, XLSX/CSV okuma, doğrulama (önizleme) ve toplu aktarım.
// Akış: buildTemplates() → kullanıcı doldurur → parseTable(bytes) → validateImport() → (kullanıcı onayı) → applyImport()
// Aktarılan her objenin veri kaynağı EXCEL olarak işaretlenir.
import { buildXLSX } from '../export/xlsx.js';
import { unzip } from '../export/zip.js';
import { HAK_STATUSES, HAK_ORDER } from '../core/schema.js';
import { norm, num, resolveCoord, objectTypeOf, stateOf, hakStatusOf, matchPoleType, matchPost, matchSdk, matchPoz, createObject, OBJECT_TYPES } from './survey-service.js';

// Şablonlar (spesifikasyon 4.1). req: zorunlu sütunlar. type: sabit obje türü (Genel'de satırdan okunur).
export const TEMPLATES = [
  { key: 'direk', sheet: 'Direk', type: 'direk', columns: ['Direk No', 'Tip', 'Grup', 'X', 'Y', 'Z', 'Durum', 'Hakediş', 'Açıklama'], req: ['Direk No', 'X', 'Y'] },
  { key: 'trafo', sheet: 'Trafo', type: 'trafo', columns: ['Trafo No', 'Güç', 'Tip', 'X', 'Y', 'Z', 'Durum', 'Hakediş', 'Açıklama'], req: ['Trafo No', 'X', 'Y'] },
  { key: 'sdk', sheet: 'SDK', type: 'sdk', columns: ['SDK No', 'Tip', 'Çıkış Sayısı', 'X', 'Y', 'Z', 'Açıklama'], req: ['SDK No', 'X', 'Y'] },
  { key: 'kanal', sheet: 'Kanal', type: 'kanal', columns: ['Kanal No', 'Başlangıç X', 'Başlangıç Y', 'Bitiş X', 'Bitiş Y', 'Uzunluk'], req: ['Kanal No', 'Başlangıç X', 'Başlangıç Y', 'Bitiş X', 'Bitiş Y'] },
  { key: 'armatur', sheet: 'Armatür', type: 'armatur', columns: ['Armatür No', 'Tip', 'X', 'Y', 'Z', 'Açıklama'], req: ['Armatür No', 'X', 'Y'] },
  { key: 'genel', sheet: 'Genel', type: null, columns: ['Obje Tipi', 'Obje No', 'X', 'Y', 'Z', 'Açıklama'], req: ['Obje Tipi', 'Obje No', 'X', 'Y'] }
];
const HELP = [
  ['Sayfa', 'Sütun', 'Açıklama'],
  ['Tümü', 'X ve Y', 'Metre cinsinden sağa (Easting, 6 haneli) ve yukarı (Northing, 7 haneli) değerler. Hangisini X, hangisini Y sütununa yazdığınız fark etmez: uygulama büyüklükten tanır.'],
  ['Tümü', 'Koordinat sistemi', 'Varsayılan proje koordinat sistemidir; aktarım ekranında başka sistem (ör. ED50, UTM, enlem/boylam) seçilebilir. Enlem/boylamda X = boylam, Y = enlem.'],
  ['Tümü', 'Z', 'Yükseklik (m) · boş bırakılabilir ("Z bilinmiyor" olarak kaydedilir).'],
  ['Tümü', 'No sütunu', 'Zorunlu ve projede benzersiz olmalı (ör. D-001, TR-01, SDK-01).'],
  ['Direk', 'Tip', 'Katalogdaki direk tip adı (ör. GT-12 (3 AWG)). Bulunamazsa kayıt açılır, tip sonradan seçilir.'],
  ['Direk', 'Grup', 'AG · OG · Müşterek · Aydınlatma ya da katalog grubu.'],
  ['Direk / Trafo', 'Durum', 'Yeni · Mevcut · Demontaj · DMM · İleride (boş = Yeni).'],
  ['Direk / Trafo', 'Hakediş', HAK_ORDER.map((k) => HAK_STATUSES[k].label).join(' · ') + ' (boş = Tamamlandı).'],
  ['Trafo', 'Güç', 'kVA (ör. 250).'],
  ['Trafo', 'Tip', 'Direk tipi · Bina · Köşk … (boş = direk tipi).'],
  ['SDK', 'Çıkış Sayısı', 'Tam sayı (ör. 4).'],
  ['Kanal', 'Uzunluk', 'İsteğe bağlı; koordinattan hesaplanan uzunlukla karşılaştırılır.'],
  ['Genel', 'Obje Tipi', 'Direk · Trafo · SDK · Pano · Menhol · Armatür · Abone · Detay · Diğer'],
  ['Not', '', 'Başlık satırını değiştirmeyin. Boş satırlar atlanır. Aktarımdan önce önizleme ekranında hatalar listelenir.']
];

export async function buildTemplates(project) {
  const w = (h) => ({ h, w: /açıklama/i.test(h) ? 36 : /tip|grup|hakediş/i.test(h) ? 20 : 15 });
  const sheets = TEMPLATES.map((t) => ({ name: t.sheet, columns: t.columns.map(w), rows: [] }));
  sheets.push({ name: 'AÇIKLAMA', columns: HELP[0].map((h, i) => ({ h, w: i === 2 ? 100 : 18 })), rows: HELP.slice(1) });
  const data = await buildXLSX(sheets, { title: 'VOLT-EDAŞ Saha · Excel şablonları' });
  return { name: 'VOLT-EDAS_Excel_Sablonlari' + (project && project.code ? '_' + String(project.code).replace(/[^\w-]+/g, '_') : '') + '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data };
}

// ---------- Okuyucu: XLSX (zip + XML) ve CSV ----------
const dec = (u8) => new TextDecoder('utf-8').decode(u8);
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
const colIx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
const texts = (xml) => { let s = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; let m; while ((m = re.exec(xml))) s += unesc(m[1]); return s; };

async function readXlsx(u8) {
  const files = await unzip(u8);
  const get = (n) => (files[n] ? dec(files[n]) : null);
  const wb = get('xl/workbook.xml');
  if (!wb) throw new Error('Excel dosyası okunamadı (xl/workbook.xml yok)');
  const rels = get('xl/_rels/workbook.xml.rels') || '';
  const relMap = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = /Id="([^"]+)"/.exec(m[0]), tg = /Target="([^"]+)"/.exec(m[0]); if (id && tg) relMap[id[1]] = tg[1].replace(/^\/?xl\//, '').replace(/^\//, ''); }
  const shared = [];
  const ss = get('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(m[1] ? texts(m[1]) : '');
  const out = [];
  let i = 0;
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    i++;
    const name = unesc((/name="([^"]*)"/.exec(m[0]) || [])[1] || 'Sayfa' + i);
    const rid = (/r:id="([^"]+)"/.exec(m[0]) || [])[1];
    const path = 'xl/' + (relMap[rid] || 'worksheets/sheet' + i + '.xml');
    const xml = get(path);
    if (!xml) continue;
    const rows = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rn = +((/\br="(\d+)"/.exec(rm[1]) || [])[1] || rows.length + 1);
      const row = [];
      let k = 0;
      for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = cm[1], body = cm[2] || '';
        const ref = (/\br="([A-Z]+\d+)"/.exec(at) || [])[1];
        const ci = ref ? colIx(ref) : k; k = ci + 1;
        const t = (/\bt="([^"]+)"/.exec(at) || [])[1];
        const v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1];
        let val = null;
        if (t === 's') val = shared[+v] ?? '';
        else if (t === 'inlineStr') val = texts(body);
        else if (t === 'str') val = v != null ? unesc(v) : '';
        else if (t === 'b') val = v === '1';
        else if (v != null && v !== '') { const n = Number(v); val = Number.isFinite(n) ? n : unesc(v); }
        row[ci] = val;
      }
      rows[rn - 1] = row;
    }
    out.push({ name, rows: Array.from(rows, (r) => r || []) });
  }
  return out;
}
function readCsv(text, name) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ((first.match(/\t/g) || []).length > (first.match(/;/g) || []).length ? '\t' : ';') : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return [{ name: name || 'CSV', rows }];
}
// bytes → [{name, rows:[[...]]}]
export async function parseTable(u8, filename = '') {
  if (u8[0] === 0x50 && u8[1] === 0x4b) return readXlsx(u8);
  let text = dec(u8);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes('�')) { try { text = new TextDecoder('windows-1254').decode(u8); } catch (e) { /* utf-8 kalır */ } }
  return readCsv(text, filename.replace(/\.[^.]+$/, ''));
}

// ---------- Doğrulama ----------
const empty = (v) => v === null || v === undefined || String(v).trim() === '';
// Sayfa → şablon: sayfa adından ya da başlık satırından tanınır. Başlık ilk 10 satırda aranır.
function detect(sheet) {
  for (let r = 0; r < Math.min(10, sheet.rows.length); r++) {
    const head = (sheet.rows[r] || []).map(norm);
    if (head.filter(Boolean).length < 2) continue;
    let best = null;
    for (const t of TEMPLATES) {
      const hit = t.columns.filter((c) => head.includes(norm(c))).length;
      const first = head.includes(norm(t.columns[0]));
      const score = hit + (first ? 3 : 0) + (norm(sheet.name) === norm(t.sheet) ? 2 : 0);
      if (hit >= 2 && (first || norm(sheet.name) === norm(t.sheet)) && (!best || score > best.score)) best = { t, score, row: r, head };
    }
    if (best) return best;
  }
  return null;
}

// Sonuç: { sheets:[{name, template, total, ok, bad, missingColumns}], records:[{sheet,row,type,no,ok,errors[],warnings[],data}], total, ok, bad }
export function validateImport(ps, sheets, opts = {}) {
  const cat = ps.cat, project = ps.p;
  const crsKey = opts.crsKey || 'proje';
  const existing = new Set([...ps.data.equipment.map((e) => norm(e.no)), ...ps.data.points.map((p) => norm(p.pointNo)), ...ps.data.lines.map((l) => norm(l.lineNo))]);
  const seen = new Map();
  const records = [], info = [];
  for (const sh of sheets) {
    if (norm(sh.name) === 'aciklama') continue;
    const d = detect(sh);
    if (!d) { if (sh.rows.some((r) => (r || []).some((v) => !empty(v)))) info.push({ name: sh.name, template: null, total: 0, ok: 0, bad: 0, error: 'Şablon tanınmadı (başlık satırı bulunamadı)' }); continue; }
    const t = d.t;
    const ix = {}; for (const c of t.columns) ix[c] = d.head.indexOf(norm(c));
    const missing = t.req.filter((c) => ix[c] < 0);
    const si = { name: sh.name, template: t.sheet, total: 0, ok: 0, bad: 0, missingColumns: missing };
    info.push(si);
    for (let r = d.row + 1; r < sh.rows.length; r++) {
      const row = sh.rows[r] || [];
      if (!row.some((v) => !empty(v))) continue;
      const get = (c) => (ix[c] >= 0 ? row[ix[c]] : null);
      const rec = { sheet: sh.name, row: r + 1, template: t.key, type: t.type, no: '', errors: [], warnings: [], data: {} };
      si.total++;
      if (missing.length) rec.errors.push('Eksik zorunlu sütun: ' + missing.join(', '));
      const noCol = t.columns.find((c) => / No$/.test(c));
      const no = empty(get(noCol)) ? '' : String(get(noCol)).trim();
      rec.no = no;
      if (!no) rec.errors.push('Eksik obje numarası (' + noCol + ')');
      else {
        const k = norm(no);
        if (existing.has(k)) rec.errors.push('Duplicate obje numarası: ' + no + ' projede zaten var');
        else if (seen.has(k)) rec.errors.push('Duplicate obje numarası: ' + no + ' dosyada ' + seen.get(k) + ' ile aynı');
        else seen.set(k, sh.name + ' satır ' + (r + 1));
      }
      if (t.key === 'genel') {
        const tt = get('Obje Tipi');
        if (empty(tt)) rec.errors.push('Zorunlu alan eksik: Obje Tipi');
        else { rec.type = objectTypeOf(tt); if (!rec.type || OBJECT_TYPES[rec.type].line) { rec.errors.push('Geçersiz obje tipi: ' + tt); rec.type = null; } }
      }
      const note = empty(get('Açıklama')) ? '' : String(get('Açıklama')).trim();
      const coord = (xc, yc, zc, label) => {
        const x = get(xc), y = get(yc), z = zc ? get(zc) : null;
        if (empty(x) || empty(y)) { rec.errors.push('Hatalı / boş koordinat' + (label ? ' (' + label + ')' : '') + ': ' + (empty(x) ? xc : yc) + ' boş'); return null; }
        if (Number.isNaN(num(x)) || Number.isNaN(num(y))) { rec.errors.push('Geçersiz veri tipi: ' + (Number.isNaN(num(x)) ? xc + ' = "' + x + '"' : yc + ' = "' + y + '"') + ' sayı değil'); return null; }
        if (!empty(z) && Number.isNaN(num(z))) { rec.errors.push('Geçersiz veri tipi: ' + zc + ' = "' + z + '" sayı değil'); return null; }
        const c = resolveCoord(project, { x, y, z: empty(z) ? null : z, crsKey, zUnknown: empty(z) });
        if (!c.ok) { rec.errors.push(c.error); return null; }
        for (const w of c.warn) rec.warnings.push(w + (label ? ' (' + label + ')' : ''));
        if (c.zUnknown && zc) rec.warnings.push('Z bilinmiyor');
        return c;
      };
      if (t.key === 'kanal') {
        const a = coord('Başlangıç X', 'Başlangıç Y', null, 'başlangıç'), b = coord('Bitiş X', 'Bitiş Y', null, 'bitiş');
        if (a && b) {
          const len = Math.hypot(b.E - a.E, b.N - a.N);
          const u = get('Uzunluk');
          if (!empty(u) && Number.isNaN(num(u))) rec.errors.push('Geçersiz veri tipi: Uzunluk = "' + u + '" sayı değil');
          else if (!empty(u) && Math.abs(num(u) - len) > Math.max(1, len * 0.02)) rec.warnings.push('Uzunluk ' + num(u) + ' m ≠ koordinattan ' + len.toFixed(2) + ' m (koordinat esas alınır)');
          if (len < 0.05) rec.errors.push('Hatalı koordinat: başlangıç ve bitiş aynı nokta');
          rec.data = { a, b, length: len };
        }
      } else {
        const zc = t.columns.includes('Z') ? 'Z' : null;
        const c = coord('X', 'Y', zc);
        const o = { type: rec.type, no, coord: c, source: 'EXCEL', note };
        if (t.key === 'direk' || rec.type === 'direk') {
          o.typeText = empty(get('Tip')) ? '' : String(get('Tip')).trim(); o.groupText = empty(get('Grup')) ? '' : String(get('Grup')).trim();
          const m = matchPoleType(cat, o.typeText, o.groupText);
          if (o.typeText && !m.typeId) rec.warnings.push('Tip katalogda bulunamadı: ' + o.typeText + ' (kayıt açılır, tip sonradan seçilir)');
          if (!o.typeText && t.key === 'direk') rec.warnings.push('Tip boş (sonradan seçilir)');
          if (m.group === 'ayd') o.type = rec.type = 'aydinlatma';
        }
        if (t.key === 'trafo') {
          const g = get('Güç');
          if (!empty(g) && (Number.isNaN(num(g)) || !(num(g) > 0))) rec.errors.push('Geçersiz veri tipi: Güç = "' + g + '" (kVA sayı olmalı)');
          else if (empty(g)) rec.warnings.push('Güç boş (sonradan girilir)');
          else o.power = num(g);
          o.typeText = empty(get('Tip')) ? '' : String(get('Tip')).trim();
          if (o.typeText && !matchPost(cat, o.typeText)) rec.warnings.push('Trafo tipi tanınmadı: ' + o.typeText + ' (direk tipi kabul edildi)');
        }
        if (t.key === 'sdk') {
          const n = get('Çıkış Sayısı');
          if (!empty(n) && (Number.isNaN(num(n)) || !Number.isInteger(num(n)) || num(n) <= 0)) rec.errors.push('Geçersiz veri tipi: Çıkış Sayısı = "' + n + '" (tam sayı olmalı)');
          else if (!empty(n)) o.outputs = num(n);
          o.typeText = empty(get('Tip')) ? '' : String(get('Tip')).trim();
          if (o.typeText && !matchSdk(cat, o.typeText)) rec.warnings.push('SDK tipi katalogda bulunamadı: ' + o.typeText);
        }
        if (t.key === 'armatur') { o.typeText = empty(get('Tip')) ? '' : String(get('Tip')).trim(); if (o.typeText && !matchPoz(cat, o.typeText, 'armat')) rec.warnings.push('Armatür pozu bulunamadı: ' + o.typeText + ' (serbest metin olarak kaydedilir)'); }
        if (t.columns.includes('Durum')) { const s = stateOf(get('Durum')); if (s === undefined) rec.errors.push('Geçersiz veri tipi: Durum = "' + get('Durum') + '"'); else o.state = s || 'YENI'; }
        if (t.columns.includes('Hakediş')) { const h = hakStatusOf(get('Hakediş')); if (h === undefined) rec.errors.push('Geçersiz veri tipi: Hakediş = "' + get('Hakediş') + '"'); else if (h) o.hak = h; }
        rec.data = o;
      }
      rec.ok = rec.errors.length === 0;
      if (rec.ok) si.ok++; else si.bad++;
      records.push(rec);
    }
  }
  const total = records.length, ok = records.filter((r) => r.ok).length;
  return { sheets: info, records, total, ok, bad: total - ok, crsKey };
}

// ---------- Aktarım (yalnız uygun kayıtlar) ----------
export async function applyImport(ps, result, opts = {}) {
  const good = result.records.filter((r) => r.ok);
  let done = 0; const created = [];
  const rules = ps.cat.table('cableRules') || { minDepth: { AG: 0.7 } };
  for (const r of good) {
    if (r.template === 'kanal') {
      const { a, b } = r.data;
      const pa = await ps.createPoint({ pointNo: r.no + '-A', cls: 'HAT', critical: false, coord: a, source: 'EXCEL' });
      const pb = await ps.createPoint({ pointNo: r.no + '-B', cls: 'HAT', critical: false, coord: b, source: 'EXCEL' });
      const l = await ps.createLine({ lineNo: r.no, lineType: 'AG', install: 'yeralti', channelOnly: true, circuits: [], nodes: [pa.id, pb.id], cable: { channelType: 'toprak', depth: (rules.minDepth || {}).AG || 0.7, width: 0.4 }, note: 'Excel aktarımı · kanal derinliği/genişliği varsayılan' }, { defer: true, reason: 'Excel aktarımı: kanal ' + r.no });
      created.push({ no: l.lineNo, lineId: l.id });
    } else {
      const c = await createObject(ps, r.data, { defer: true });
      created.push(c);
    }
    done++;
    if (opts.onProgress && done % 10 === 0) opts.onProgress(done, good.length);
  }
  await ps._after(['points', 'equipment', 'lines'], 'Excel toplu aktarım: ' + done + ' kayıt');
  return { imported: done, skipped: result.records.length - done, created };
}
