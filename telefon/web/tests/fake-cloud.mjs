// Sahte bulut belge deposu (web sürümü testleri): yayınlanan sayfadaki "db" yeteneğinin kullanılan alt kümesi.
// Belge sınırı (256 KiB), update'in var olmayan belgede hata vermesi, iç içe birleştirme ve canlı abonelik taklit edilir.
export class FakeCloud {
  constructor() { this.docs = new Map(); this.subs = new Map(); this.writes = 0; this.log = []; this.readonly = false; this.failNext = 0; this.leases = new Map(); this.acquires = 0; this.noAcquire = false; }
  _check(path, data) {
    if (path.split('/').length % 2) throw Object.assign(new Error('belge yolu çift parçalı olmalı: ' + path), { code: 'invalid_argument' });
    if (!/^[A-Za-z0-9_\-.~:@+/]+$/.test(path)) throw Object.assign(new Error('geçersiz yol: ' + path), { code: 'invalid_argument' });
    if (this.readonly) throw Object.assign(new Error('salt okunur'), { code: 'invalid_argument' });
    if (this.failNext > 0) { this.failNext--; throw Object.assign(new Error('geçici hata'), { code: 'resource_exhausted' }); }
    const n = new TextEncoder().encode(JSON.stringify(data)).length;
    if (n > 256 * 1024) throw Object.assign(new Error('belge 256 KiB sınırını aşıyor: ' + path + ' ' + n), { code: 'invalid_argument' });
    return n;
  }
  _emit(path) { const d = this.docs.get(path); for (const fn of this.subs.get(path) || []) queueMicrotask(() => fn(snap(path, d))); }
  doc(path) {
    const self = this;
    return {
      path, id: path.split('/').pop(),
      async get() { return snap(path, self.docs.get(path)); },
      async set(data) { const n = self._check(path, data); self.docs.set(path, JSON.parse(JSON.stringify(data))); self.writes++; self.log.push(['set', path, n]); self._emit(path); },
      async update(data) {
        if (!self.docs.has(path)) throw Object.assign(new Error('belge yok: ' + path), { code: 'invalid_argument' });
        const merged = merge(JSON.parse(JSON.stringify(self.docs.get(path))), JSON.parse(JSON.stringify(data)));
        self._check(path, merged); self.docs.set(path, merged); self.writes++; self.log.push(['update', path]); self._emit(path);
      },
      async delete() { if (self.readonly) throw Object.assign(new Error('salt okunur'), { code: 'invalid_argument' }); self.docs.delete(path); self.writes++; self.log.push(['delete', path]); },
      // Kısa kira (acquire): kira dolmamış ve başkasındaysa { acquired: false, expiresAt }; yoksa / dolmuşsa / aynı tutucuysa verilir (yenileme)
      ...(self.noAcquire ? {} : {
        async acquire({ holder, ttlMs, data } = {}) {
          self.acquires++;
          const now = Date.now(), cur = self.leases.get(path);
          if (cur && cur.until > now && cur.holder !== holder) return { acquired: false, expiresAt: new Date(cur.until).toISOString() };
          const ttl = Math.min(600000, Math.max(1000, ttlMs || 30000));
          const lease = { holder, until: now + ttl, version: ((cur && cur.version) || 0) + 1 };
          self.leases.set(path, lease);
          if (data) { const d = merge(JSON.parse(JSON.stringify(self.docs.get(path) || {})), JSON.parse(JSON.stringify(data))); self.docs.set(path, d); }
          return { acquired: true, version: lease.version, expiresAt: new Date(lease.until).toISOString(), holder };
        }
      }),
      onSnapshot(next) { const set = self.subs.get(path) || new Set(); set.add(next); self.subs.set(path, set); queueMicrotask(() => next(snap(path, self.docs.get(path)))); return () => set.delete(next); }
    };
  }
  size() { let n = 0; for (const d of this.docs.values()) n += JSON.stringify(d).length; return n; }
}
const snap = (path, d) => ({ id: path.split('/').pop(), exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))), metadata: { fromCache: false, hasPendingWrites: false } });
function merge(a, b) {
  for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
  return a;
}
