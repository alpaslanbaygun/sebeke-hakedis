// Katalog servisi: seçili standart sürümünün (StandardVersion) tüm teknik verisi.
// Veriler veritabanından yüklenir; iş kuralları bu arayüz üzerinden sorgular.
import { JOB_PREFIX } from '../core/schema.js';

const LIST = ['poz', 'poleGroups', 'poleTypes', 'conductors', 'lineTypes', 'transformers', 'panels', 'kiosks', 'trafoPostTypes', 'sdkTypes', 'recipeRules', 'params'];

export class Catalog {
  constructor(data) {
    this.std = data.standard;
    this.stdId = data.standard.id;
    this.t = {};
    for (const k of LIST) this.t[k] = data[k] || [];
    this.tables = {};
    for (const [k, v] of Object.entries(data)) if (!LIST.includes(k) && k !== 'standard' && k !== 'format') this.tables[k] = v;
    this.index();
  }
  static async load(ds, stdId) {
    const data = { standard: await ds.db.get('standards', stdId) };
    if (!data.standard) throw new Error('Standart sürümü bulunamadı: ' + stdId);
    for (const k of LIST) data[k] = await ds.db.query(k, 'stdId', stdId);
    for (const row of await ds.db.query('stdTables', 'stdId', stdId)) data[row.key] = row.value;
    return new Catalog(data);
  }
  index() {
    this.pozMap = new Map(this.t.poz.map((p) => [p.servis, p]));
    this.groupMap = new Map(this.t.poleGroups.map((g) => [g.id, g]));
    this.ptMap = new Map(this.t.poleTypes.map((p) => [p.id, p]));
    this.ptByGroup = new Map();
    for (const p of this.t.poleTypes) { if (!this.ptByGroup.has(p.group)) this.ptByGroup.set(p.group, []); this.ptByGroup.get(p.group).push(p); }
    this.condMap = new Map(this.t.conductors.map((c) => [c.name, c]));
    this.ltMap = new Map(this.t.lineTypes.map((l) => [l.name, l]));
    this.kioskMap = new Map(this.t.kiosks.map((k) => [k.servis, k]));
    this.postMap = new Map(this.t.trafoPostTypes.map((k) => [k.id, k]));
    this.paramMap = new Map(this.t.params.map((p) => [p.key, p]));
    this.sdkMap = new Map(this.t.sdkTypes.map((s) => [s.id, s]));
  }
  table(key) { return this.tables[key]; }

  // ---- Poz ----
  poz(servis) { return this.pozMap.get(servis) || null; }
  // İş önekli servis kodu (0xx montaj · 1xx demontaj · 2xx DMM). Yeşil Defter kodu olmayan kalemlerde (TEDAS:… / YEREL:…) kod aynen kalır, iş türü sona yazılır.
  jobCode(servis, job) { const s = String(servis); if (!/^\d/.test(s)) return s + (job === 'demontaj' ? ' (demontaj)' : job === 'dmm' ? ' (DMM)' : ''); return (JOB_PREFIX[job] || '0') + s.slice(1); }
  // Kataloğa satır ekle / güncelle (kullanıcı kalemi) ve dizinleri yenile
  upsertPoz(row) { const i = this.t.poz.findIndex((p) => p.id === row.id); if (i >= 0) this.t.poz[i] = row; else this.t.poz.push(row); this.pozMap.set(row.servis, row); }
  // Poz bu iş sayfasında var mı? (demontaj/DMM sayfasında olmayan kalem ayrı işaretlenir)
  pozAvailable(servis, job) {
    const p = this.poz(servis);
    if (!p) return false;
    if (job === 'montaj') return p.montaj !== false;
    if (job === 'demontaj') return !!p.demontaj;
    if (job === 'dmm') return !!p.dmm;
    return false;
  }
  searchPoz(q, opts = {}) {
    const low = (s) => String(s || '').toLocaleLowerCase('tr-TR');
    const qq = low(q).trim();
    let rows = this.t.poz;
    if (opts.category) rows = rows.filter((p) => p.category === opts.category);
    if (opts.job) rows = rows.filter((p) => this.pozAvailable(p.servis, opts.job));
    if (qq) rows = rows.filter((p) => low(p.servis + ' ' + p.name + ' ' + (p.pozNo || '')).includes(qq));
    return rows.slice(0, opts.limit || 200);
  }
  categories() { return [...new Set(this.t.poz.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'tr')); }

  // ---- Direk ----
  poleGroups() { return this.t.poleGroups; }
  poleGroup(id) { return this.groupMap.get(id) || null; }
  poleTypes(group) { return this.ptByGroup.get(group) || []; }
  poleType(id) { return this.ptMap.get(id) || null; }
  poleTypeByName(group, name) { return this.poleTypes(group).find((p) => p.name === name) || null; }

  // ---- İletken / hat tipi ----
  conductor(name) { return this.condMap.get(name) || null; }
  lineType(key) { return this.ltMap.get(key) || null; }
  lineTypesFor(role, install) {
    // role: OG | AG | AYD | ABONE ; install: havai | yeralti
    return this.t.lineTypes.filter((lt) => {
      const c = this.conductor(lt.parts[0].conductor);
      const kind = c ? c.kind : (lt.unit === 'kg' ? 'ACSR' : 'KABLO');
      if (install === 'yeralti') return kind === 'KABLO' && (role === 'OG' ? lt.voltage === 'OG' : lt.voltage !== 'OG');
      if (role === 'OG' || role === 'ENH') return lt.voltage === 'OG' && kind !== 'KABLO';
      return lt.voltage !== 'OG' && kind !== 'KABLO';
    });
  }
  lineDefault(role, install) {
    const d = this.table('lineDefaults') || {};
    const k = role === 'OG' || role === 'ENH' ? 'og' : role === 'ABONE' ? 'ab' : 'ag';
    return (d[k] || {})[install] || null;
  }
  // Çıplak AG kombinasyonu (ör. 3P+R+R): kısa ad → iletken
  bareByShort(short) { return this.t.conductors.find((c) => c.short === short) || null; }

  // ---- Trafo ----
  postTypes() { return this.t.trafoPostTypes; }
  postType(id) { return this.postMap.get(id) || null; }
  pickTrafo(kind, cins, kva) {
    const list = this.t.transformers.filter((t) => t.kind === kind && (kind === 'direk' || t.cins === cins)).sort((a, b) => a.kva - b.kva);
    return list.find((x) => x.kva >= kva) || list[list.length - 1] || null;
  }
  trafoSizes(kind, cins) { return this.t.transformers.filter((t) => t.kind === kind && (kind === 'direk' || t.cins === cins)).map((t) => t.kva).sort((a, b) => a - b); }
  pickPanel(kind, kva) {
    const list = this.t.panels.filter((p) => p.kind === kind).sort((a, b) => a.kva - b.kva);
    return list.find((x) => x.kva >= kva) || list[list.length - 1] || null;
  }
  kiosk(servis) { return this.kioskMap.get(servis) || null; }
  kioskFamilies() { return [...new Set(this.t.kiosks.map((k) => k.family))]; }
  kiosksOf(family) { return this.t.kiosks.filter((k) => k.family === family); }
  kioskDefault(type) { return (this.table('kioskDefaults') || {})[type] || null; }

  // ---- Reçete ----
  rules(eq) { return this.t.recipeRules.filter((r) => r.eq === eq); }
  param(key, overrides) {
    if (overrides && overrides[key] !== undefined) return overrides[key];
    const p = this.paramMap.get(key); return p ? p.value : 0;
  }
  sdkTypes() { return this.t.sdkTypes; }
  sdkType(id) { return this.sdkMap.get(id) || this.t.sdkTypes[0] || null; }
}
