// Web sürümü depolama adaptörü: çalışma kopyası bellekte, kalıcı kopya bulut belge deposunda.
// Üst katman (DataService) IndexedDB adaptörüyle aynı arayüzü görür: get, getAll, query, put, bulkPut, delete, bulkDelete, clear, count.
//
// Bulut düzeni (belge başına 256 KiB sınırı var):
//   m/manifest          → { rev, at, by, levels:{tablo:n}, b:{ '<tablo>~<kova>': sürüm } }
//   b/<tablo>~<kova>    → { s:tablo, k:kova, n:kayıt sayısı, j:'[…JSON…]' }
//   x/<blobId>~<i>      → büyük metin blokları (revizyon anlık görüntüsü) parça parça
// Kayıtlar tabloya göre "kova"lara dağıtılır; yalnız değişen kovalar yeniden yazılır. Bir kova sınırı aşarsa
// o tablonun düzeyi artar (kova sayısı iki katına çıkar / zaman penceresi daralır) ve tablo yeniden dağıtılır.
import { PROJECT_STORES, STD_STORES, GLOBAL_STORES } from '../core/schema.js';

const clone = (x) => (x === undefined ? undefined : (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x))));
const ALL = Object.assign({}, GLOBAL_STORES, PROJECT_STORES, STD_STORES);
const LOCAL_ONLY = new Set(['tiles']);                                   // buluta gitmez (varsa tarayıcı deposunda)
const MEM_ONLY = new Set(Object.entries(PROJECT_STORES).filter(([, d]) => d.derived).map(([k]) => k)); // açıklık, metraj: proje açılınca yeniden hesaplanır
const TIME_STORES = new Set(['audit', 'outbox', 'rawLogs', 'gnssObservations']); // yalnız eklenen, kimliği zaman sıralı (ULID)
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const BUCKET_LIMIT = 170 * 1024;   // hedef belge boyutu (seri hâli, bayt)
export const DOC_HARD = 250 * 1024;       // belge sınırı 256 KiB: tek kayıt bundan büyükse buluta yazılamaz
const MAX_LEVEL = 8;
const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const bytes = (s) => (enc ? enc.encode(s).length : s.length);

function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function bucketOf(store, id, level = 0) {
  id = String(id);
  if (TIME_STORES.has(store) && ULID.test(id)) return 't' + id.slice(0, Math.min(10, 4 + level)); // 4 hane ≈ 12 gün … 7 hane ≈ 33 sn
  if (!level) return '0';
  return 'h' + level + '_' + (fnv(id) & ((1 << level) - 1)).toString(36);
}
const docId = (store, key) => store + '~' + key;
// İç içe JSON kaçışları dahil belgenin seri boyutu
const docBytes = (j) => bytes(JSON.stringify(j)) + 64;

async function pool(items, n, fn) {
  let i = 0;
  const run = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
}
// Geçici durumlarda (bağlantı, çağrı hızı sınırı) artan beklemeyle yeniden dene
export const RETRY = { waits: [500, 1500, 3500] };
async function retry(fn, onlyTransient = false) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      const code = e && e.code;
      const transient = !code || code === 'unavailable' || (!onlyTransient && code === 'resource_exhausted');
      if (!transient || i >= RETRY.waits.length) throw e;
      await new Promise((r) => setTimeout(r, RETRY.waits[i] * (0.7 + Math.random() * 0.6)));
    }
  }
}

export class CloudAdapter {
  // cdb: belge deposu (claude.use('db')) · opts.local: tarayıcıya özel depo (IndexedDB adaptörü; fotoğraf/karo) · opts.delay: yazma gecikmesi
  constructor(cdb, opts = {}) {
    this.cdb = cdb;
    this.local = opts.local || null;
    this.delay = opts.delay ?? 2500;
    this.tab = opts.tab || 'T' + Math.random().toString(36).slice(2, 10);
    this.s = new Map(); for (const name of Object.keys(ALL)) this.s.set(name, new Map());
    this.levels = {};            // tablo → düzey
    this.known = new Map();      // belge kimliği → buluttaki sürüm
    this.dirty = new Map();      // tablo → Set(kova)
    this.cloudIds = new Map();   // standart tabloları: buluta ait (tohum sonrası değişen) kayıt kimlikleri
    this.pendingStd = [];        // tohumdan sonra uygulanacak bulut kayıtları
    this.seeding = false;
    this.rev = 0;
    this.status = { mode: 'cloud', state: 'saved', at: null, error: null, pending: 0 };
    this.listeners = new Set();
    this.onRemote = opts.onRemote || null;
    this.timer = null; this.flushing = null; this.unsub = null;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _status(p) { Object.assign(this.status, p, { pending: [...this.dirty.values()].reduce((n, s) => n + s.size, 0) }); for (const f of this.listeners) { try { f(this.status); } catch (e) { /* */ } } }
  m(store) { const x = this.s.get(store); if (!x) throw new Error('Tablo yok: ' + store); return x; }
  isStd(store) { return !!STD_STORES[store]; }

  // ---- Açılış: buluttaki kayıtları belleğe al ----
  async open() {
    const man = await retry(() => this.cdb.doc('m/manifest').get());
    const d = man.exists ? man.data() : null;
    if (d) { this.rev = d.rev || 0; this.levels = Object.assign({}, d.levels || {}); }
    const keys = d ? Object.entries(d.b || {}).filter(([, v]) => v > 0) : [];
    this.blobIds = new Set(d ? Object.keys(d.x || {}) : []);       // buluttaki metin blokları (revizyon anlık görüntüleri)
    await pool(keys, 6, async ([k, v]) => { await this._pull(k); this.known.set(k, v); });
    this.fresh = !d;
    this._watch();
    this._status({ state: 'saved', at: d ? d.at : null });
    return this;
  }
  async _pull(k, replace) {
    const snap = await retry(() => this.cdb.doc('b/' + k).get());
    const store = k.slice(0, k.indexOf('~'));
    if (!this.s.has(store)) return;
    const recs = snap.exists ? JSON.parse(snap.data().j || '[]') : [];
    if (this.isStd(store) && this.seedPending !== false) { this.pendingStd.push([store, recs]); return; }
    const m = this.m(store);
    if (replace) { const key = k.slice(k.indexOf('~') + 1); for (const id of [...m.keys()]) if (bucketOf(store, id, this.levels[store] || 0) === key) m.delete(id); }
    for (const r of recs) m.set(r.id, r);
    if (this.isStd(store)) { const set = this.cloudIds.get(store) || new Set(); for (const r of recs) set.add(r.id); this.cloudIds.set(store, set); }
  }
  // Standart paketi her açılışta dosyadan yüklenir (buluta yazılmaz); buluttaki değişiklikler üstüne uygulanır
  async seed(fn) {
    this.seeding = true;
    try { await fn(); } finally { this.seeding = false; }
    this.seedPending = false;
    for (const [store, recs] of this.pendingStd) { const m = this.m(store); const set = this.cloudIds.get(store) || new Set(); for (const r of recs) { m.set(r.id, r); set.add(r.id); } this.cloudIds.set(store, set); }
    this.pendingStd = [];
  }
  _watch() {
    try {
      this.unsub = this.cdb.doc('m/manifest').onSnapshot((snap) => {
        if (!snap.exists) return;
        const d = snap.data();
        if (d.by === this.tab) return;
        this._remote(d).catch((e) => console.warn('bulut', e));
      }, (e) => { if (e && e.code === 'revoked') this._status({ state: 'error', error: 'Bulut erişimi kapandı' }); });
    } catch (e) { /* abonelik yok: yalnız açılışta okunur */ }
  }
  // Başka bir bilgisayar/sekme yazdı → değişen tabloları yeniden oku
  async _remote(d) {
    this.rev = Math.max(this.rev, d.rev || 0);
    this.blobIds = new Set(Object.keys(d.x || {}));
    const stores = new Set();
    for (const [k, v] of Object.entries(d.b || {})) if ((this.known.get(k) || 0) !== v) stores.add(k.slice(0, k.indexOf('~')));
    for (const st of Object.keys(d.levels || {})) if ((this.levels[st] || 0) !== d.levels[st]) stores.add(st);
    const changed = [];
    for (const store of stores) {
      if (!this.s.has(store) || this.dirty.has(store)) continue;     // bu tarafta bekleyen yazma varsa dokunma (son yazan kazanır)
      this.levels[store] = (d.levels || {})[store] || 0;
      const keys = Object.entries(d.b || {}).filter(([k]) => k.startsWith(store + '~'));
      const m = this.m(store);
      if (this.isStd(store)) { for (const id of this.cloudIds.get(store) || []) m.delete(id); this.cloudIds.set(store, new Set()); } else m.clear();
      await pool(keys.filter(([, v]) => v > 0), 6, ([k]) => this._pull(k));
      for (const [k, v] of keys) this.known.set(k, v);
      changed.push(store);
    }
    if (changed.length && this.onRemote) this.onRemote(changed);
  }

  // ---- Okuma ----
  async get(store, id) {
    let r = this.m(store).get(id);
    if (r === undefined && (store === 'blobs' || LOCAL_ONLY.has(store))) {
      if (this.local) { try { r = await this.local.get(store, id); } catch (e) { /* */ } }
      if (r === undefined && store === 'blobs') r = await this._blobGet(id);
      return r;
    }
    return clone(r);
  }
  async getAll(store) { return [...this.m(store).values()].map(clone); }
  async query(store, index, value) { const out = []; for (const r of this.m(store).values()) if (r[index] === value) out.push(clone(r)); return out; }
  async count(store) { return this.m(store).size; }
  async estimate() { return null; }

  // ---- Yazma ----
  _touch(store, id) {
    if (this.seeding || LOCAL_ONLY.has(store) || MEM_ONLY.has(store) || store === 'blobs') return;
    if (this.isStd(store)) { const set = this.cloudIds.get(store) || new Set(); set.add(id); this.cloudIds.set(store, set); }
    const set = this.dirty.get(store) || new Set();
    set.add(bucketOf(store, id, this.levels[store] || 0));
    this.dirty.set(store, set);
  }
  _schedule() {
    if (this.seeding || !this.dirty.size) return;
    if (this.status.state === 'readonly') { this._status({}); return; }   // salt okunur görünüm: yazma denenmez
    this._status({ state: 'pending' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush().catch(() => {}), this.delay);
  }
  async put(store, rec) {
    if (store === 'blobs') return this._blobPut(rec);
    if (LOCAL_ONLY.has(store)) { if (this.local) { try { await this.local.put(store, rec); } catch (e) { /* */ } } return rec.id; }
    const m = this.m(store);
    // Değeri değişmeyen ayar (ör. son proje) buluta yeniden yazılmaz
    if (store === 'settings') { const cur = m.get(rec.id); if (cur && JSON.stringify(cur.value) === JSON.stringify(rec.value)) return rec.id; }
    m.set(rec.id, clone(rec)); this._touch(store, rec.id); this._schedule(); return rec.id;
  }
  async bulkPut(store, recs) { const m = this.m(store); for (const r of recs) { m.set(r.id, clone(r)); this._touch(store, r.id); } this._schedule(); return recs.length; }
  async delete(store, id) { if (this.m(store).delete(id)) { this._touch(store, id); this._schedule(); } if ((store === 'blobs' || LOCAL_ONLY.has(store)) && this.local) { try { await this.local.delete(store, id); } catch (e) { /* */ } } }
  async bulkDelete(store, ids) { const m = this.m(store); for (const id of ids) if (m.delete(id)) this._touch(store, id); this._schedule(); return ids.length; }
  async clear(store) { const m = this.m(store); for (const id of [...m.keys()]) { m.delete(id); this._touch(store, id); } this._schedule(); if (LOCAL_ONLY.has(store) && this.local) { try { await this.local.clear(store); } catch (e) { /* */ } } }

  // ---- İkili / büyük veri ----
  // Fotoğraf baytları yalnız bu tarayıcıda (IndexedDB) tutulur; metin blokları (revizyon anlık görüntüsü) buluta parça parça yazılır
  async _blobPut(rec) {
    this.m('blobs').set(rec.id, rec);
    if (rec.text != null && !this.seeding) {
      // Parça boyu: belge sınırı 256 KiB. Çoğunlukla ASCII metinde (CAD çizimi) büyük parça, değilse küçük parça (UTF-8'de 3 kata kadar büyür)
      const parts = []; const CH = /[^\x00-\x7f]/.test(rec.text.slice(0, 20000)) ? 60000 : 150000;
      for (let i = 0; i < rec.text.length; i += CH) { let part = rec.text.slice(i, i + CH); if (CH > 60000 && docBytes(part) > 200 * 1024) { parts.push(part.slice(0, CH / 2)); part = part.slice(CH / 2); } parts.push(part); }
      const meta = Object.assign({}, rec, { text: undefined, n: parts.length });
      delete meta.text;
      try {
        for (let i = 0; i < parts.length; i++) await retry(() => this.cdb.doc('x/' + rec.id + '~' + i).set(i === 0 ? Object.assign({ j: parts[i] }, meta) : { j: parts[i] }));
        const ref = this.cdb.doc('m/manifest'); const body = { x: { [rec.id]: parts.length } };
        if (this.fresh) { await retry(() => ref.set(Object.assign({ rev: this.rev, by: this.tab, levels: this.levels, b: {} }, body))); this.fresh = false; } else await retry(() => ref.update(body));
        this.blobIds.add(rec.id);
      } catch (e) { this._fail(e); }
    } else if (this.local) { try { await this.local.put('blobs', rec); } catch (e) { /* */ } }
    return rec.id;
  }
  async _blobGet(id) {
    if (!this.blobIds || !this.blobIds.has(id)) return undefined;        // fotoğraf baytları bulutta yok: boşuna okuma yapma
    try {
      const first = await retry(() => this.cdb.doc('x/' + id + '~0').get());
      if (!first.exists) return undefined;
      const d = first.data(); let text = d.j || '';
      for (let i = 1; i < (d.n || 1); i++) { const p = await retry(() => this.cdb.doc('x/' + id + '~' + i).get()); text += p.exists ? p.data().j : ''; }
      const rec = Object.assign({}, d, { text }); delete rec.j; delete rec.n;
      this.m('blobs').set(id, rec);
      return rec;
    } catch (e) { return undefined; }
  }

  // ---- Buluta yazma ----
  _fail(e) {
    const ro = e && (e.code === 'invalid_argument' || e.code === 'not_granted' || e.code === 'revoked');
    this._status({ state: ro ? 'readonly' : 'error', error: (e && (e.code === 'quota_exceeded' ? 'Bulut alanı doldu' : e.message)) || 'Buluta yazılamadı' });
  }
  flush() {
    clearTimeout(this.timer);
    if (this.flushing) { this.again = true; return this.flushing; }
    this.flushing = this._flush().finally(() => { this.flushing = null; if (this.again) { this.again = false; if (this.dirty.size) this._schedule(); } });
    return this.flushing;
  }
  _group(store, level, only) {
    const groups = new Map();
    const ids = this.isStd(store) ? (this.cloudIds.get(store) || new Set()) : null;
    for (const [id, r] of this.m(store)) {
      if (ids && !ids.has(id)) continue;
      if (store === 'outbox' && r.synced) continue;                    // telefona gönderilmiş değişiklikler bulutta saklanmaz
      const k = bucketOf(store, id, level);
      if (only && !only.has(k)) continue;
      const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r]);
    }
    return groups;
  }
  async _flush() {
    if (!this.dirty.size) return;
    this._status({ state: 'saving' });
    const work = this.dirty; this.dirty = new Map();
    const patch = {}; const drop = []; let skipped = 0;
    try {
      for (const [store, keys0] of work) {
        let level = this.levels[store] || 0, keys = keys0, groups, json;
        // Sınırı aşan kova varsa düzeyi artır ve tabloyu yeniden dağıt
        for (;;) {
          groups = this._group(store, level, keys);
          json = new Map(); let over = false;
          for (const [k, recs] of groups) { const j = JSON.stringify(recs); json.set(k, j); if (docBytes(j) > BUCKET_LIMIT && recs.length > 1) over = true; }
          if (!over || level >= MAX_LEVEL || (TIME_STORES.has(store) && level >= 6)) break;
          level++; keys = null;                                      // null → tablonun tümü
        }
        const releveled = level !== (this.levels[store] || 0);
        const targets = keys ? [...keys] : [...groups.keys()];
        for (const k of targets) {
          const id = docId(store, k); const j = json.get(k);
          if (!j) { if (this.known.get(id)) { await retry(() => this.cdb.doc('b/' + id).delete(), true); patch[id] = 0; this.known.set(id, 0); } continue; }
          if (docBytes(j) > DOC_HARD) { skipped++; console.warn('Buluta sığmayan kova', id, docBytes(j)); continue; }
          await retry(() => this.cdb.doc('b/' + id).set({ s: store, k, n: groups.get(k).length, j }), true);
          const v = (this.known.get(id) || 0) + 1; patch[id] = v; this.known.set(id, v);
        }
        if (releveled) {
          for (const [id, v] of this.known) if (v > 0 && id.startsWith(store + '~') && !groups.has(id.slice(store.length + 1))) { patch[id] = 0; drop.push(id); }
          this.levels[store] = level;
        }
      }
      this.rev++;
      const body = { rev: this.rev, at: new Date().toISOString(), by: this.tab, levels: this.levels, b: patch };
      const ref = this.cdb.doc('m/manifest');
      if (this.fresh) { await retry(() => ref.set(body), true); this.fresh = false; } else await retry(() => ref.update(body), true);
      for (const id of drop) { this.known.set(id, 0); try { await this.cdb.doc('b/' + id).delete(); } catch (e) { /* artık kalır, zararsız */ } }
      this._status(skipped ? { state: 'error', error: 'Bazı kayıtlar buluta sığmadı', at: body.at } : { state: 'saved', at: body.at, error: null });
    } catch (e) {
      // Yazılamayanları kuyruğa geri koy
      for (const [store, keys] of work) { const set = this.dirty.get(store) || new Set(); for (const k of keys) set.add(k); this.dirty.set(store, set); }
      this._fail(e);
      if (this.status.state === 'error') { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush().catch(() => {}), 15000); }
      throw e;
    }
  }
}
