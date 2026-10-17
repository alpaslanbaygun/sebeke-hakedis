// Depolama adaptörleri: IndexedDB (cihaz, offline-first) ve bellek (test).
// Üst katman yalnızca bu arayüzü kullanır: get, getAll, query, put, bulkPut, delete, clear, count.
import { DB_NAME, DB_VERSION, PROJECT_STORES, STD_STORES, GLOBAL_STORES } from './schema.js';

function storeDefs() {
  const defs = [];
  for (const [name, d] of Object.entries(GLOBAL_STORES)) defs.push({ name, indexes: d.indexes || [] });
  for (const [name, d] of Object.entries(PROJECT_STORES)) defs.push({ name, indexes: ['projectId', ...(d.indexes || [])] });
  for (const [name, d] of Object.entries(STD_STORES)) defs.push({ name, indexes: d.noStd ? [] : ['stdId', ...(d.indexes || [])] });
  return defs;
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export class IDBAdapter {
  constructor(idbFactory, name = DB_NAME) { this.f = idbFactory; this.name = name; this.db = null; }
  async open() {
    const defs = storeDefs();
    this.db = await new Promise((res, rej) => {
      const r = this.f.open(this.name, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const d of defs) {
          const os = db.objectStoreNames.contains(d.name) ? r.transaction.objectStore(d.name) : db.createObjectStore(d.name, { keyPath: 'id' });
          for (const ix of d.indexes) if (!os.indexNames.contains(ix)) os.createIndex(ix, ix, { unique: false });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('Veritabanı başka bir sekmede açık'));
    });
    return this;
  }
  tx(store, mode = 'readonly') { return this.db.transaction(store, mode).objectStore(store); }
  get(store, id) { return reqP(this.tx(store).get(id)); }
  getAll(store) { return reqP(this.tx(store).getAll()); }
  query(store, index, value) { return reqP(this.tx(store).index(index).getAll(value)); }
  put(store, rec) { return reqP(this.tx(store, 'readwrite').put(rec)); }
  delete(store, id) { return reqP(this.tx(store, 'readwrite').delete(id)); }
  clear(store) { return reqP(this.tx(store, 'readwrite').clear()); }
  count(store) { return reqP(this.tx(store).count()); }
  bulkPut(store, recs) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      for (const r of recs) os.put(r);
      t.oncomplete = () => res(recs.length);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('abort'));
    });
  }
  bulkDelete(store, ids) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      for (const id of ids) os.delete(id);
      t.oncomplete = () => res(ids.length);
      t.onerror = () => rej(t.error);
    });
  }
  async estimate() {
    try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { /* yok */ }
    return null;
  }
}

const clone = (x) => (x === undefined ? undefined : (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x))));

export class MemoryAdapter {
  constructor() { this.s = new Map(); for (const d of storeDefs()) this.s.set(d.name, new Map()); }
  async open() { return this; }
  m(store) { const x = this.s.get(store); if (!x) throw new Error('Tablo yok: ' + store); return x; }
  async get(store, id) { return clone(this.m(store).get(id)); }
  async getAll(store) { return [...this.m(store).values()].map(clone); }
  async query(store, index, value) { return [...this.m(store).values()].filter((r) => r[index] === value).map(clone); }
  async put(store, rec) { this.m(store).set(rec.id, clone(rec)); return rec.id; }
  async bulkPut(store, recs) { for (const r of recs) this.m(store).set(r.id, clone(r)); return recs.length; }
  async bulkDelete(store, ids) { for (const id of ids) this.m(store).delete(id); return ids.length; }
  async delete(store, id) { this.m(store).delete(id); }
  async clear(store) { this.m(store).clear(); }
  async count(store) { return this.m(store).size; }
  async estimate() { return null; }
}
