// Veri servisi: tüm yazma işlemleri buradan geçer.
// Her yazma → revizyon (+1), denetim kaydı (kim/ne/ne zaman/eski/yeni/neden), senkron kuyruğu ve olay yayını.
import { ulid } from './ids.js';
import { bus as defaultBus } from './bus.js';
import { PROJECT_STORES } from './schema.js';

const SKIP_DIFF = new Set(['updatedAt', 'updatedBy', 'rev', 'createdAt', 'createdBy']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function diffFields(before, after) {
  const out = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (SKIP_DIFF.has(k)) continue;
    const a = before ? before[k] : undefined, b = after ? after[k] : undefined;
    if (!same(a, b)) out.push({ field: k, old: a === undefined ? null : a, new: b === undefined ? null : b });
  }
  return out;
}

export class DataService {
  constructor(adapter, ctx = {}) {
    this.db = adapter;
    this.bus = ctx.bus || defaultBus;
    this.user = ctx.user || { id: 'local', name: 'Operatör' };
    this.deviceId = ctx.deviceId || 'device';
    this.now = ctx.now || (() => new Date());
    this.derivedStores = new Set(Object.entries(PROJECT_STORES).filter(([, d]) => d.derived).map(([k]) => k));
  }
  iso() { return this.now().toISOString(); }
  setUser(u) { this.user = u; }

  get(store, id) { return this.db.get(store, id); }
  async list(store, projectId, opts = {}) {
    const rows = projectId ? await this.db.query(store, 'projectId', projectId) : await this.db.getAll(store);
    return opts.all ? rows : rows.filter((r) => r.status !== 'deleted');
  }

  async create(store, data, opts = {}) {
    const t = this.iso();
    const rec = Object.assign({ status: 'active' }, data, {
      id: data.id || ulid(this.now().getTime()), createdAt: t, updatedAt: t,
      createdBy: this.user.name, updatedBy: this.user.name, rev: 1
    });
    await this.db.put(store, rec);
    if (!opts.noAudit) await this._audit(store, rec, 'create', diffFields(null, rec), opts.reason);
    if (!opts.noSync) await this._outbox(store, rec, 'create', 0);
    if (!opts.silent) this.bus.emit('data:change', { store, op: 'create', id: rec.id, projectId: rec.projectId, before: null, after: rec, reason: opts.reason });
    return rec;
  }

  async update(store, id, patch, opts = {}) {
    const before = await this.db.get(store, id);
    if (!before) throw new Error(store + ' kaydı bulunamadı: ' + id);
    if (opts.expectRev && before.rev !== opts.expectRev) {
      const e = new Error('Kayıt başka biri tarafından değiştirildi (rev ' + before.rev + ')'); e.code = 'REV_CONFLICT'; throw e;
    }
    const after = Object.assign({}, before, typeof patch === 'function' ? patch(before) : patch, {
      id, updatedAt: this.iso(), updatedBy: this.user.name, rev: (before.rev || 0) + 1
    });
    const changes = diffFields(before, after);
    if (!changes.length) return before;
    await this.db.put(store, after);
    if (!opts.noAudit) await this._audit(store, after, opts.action || 'update', changes, opts.reason);
    if (!opts.noSync) await this._outbox(store, after, 'update', before.rev);
    if (!opts.silent) this.bus.emit('data:change', { store, op: 'update', id, projectId: after.projectId, before, after, changes, reason: opts.reason });
    return after;
  }

  async remove(store, id, opts = {}) {
    return this.update(store, id, { status: 'deleted' }, Object.assign({ action: 'delete' }, opts));
  }

  // Türetilmiş tablolar (açıklık, metraj): tamamen yeniden hesaplanabilir → denetim/senkron dışı
  async replaceDerived(store, projectId, recs) {
    const old = await this.db.query(store, 'projectId', projectId);
    const keep = new Set(recs.map((r) => r.id));
    const del = old.filter((r) => !keep.has(r.id)).map((r) => r.id);
    const byId = new Map(old.map((r) => [r.id, r]));
    const changed = recs.filter((r) => !same(stripMeta(byId.get(r.id)), stripMeta(r)));
    const t = this.iso();
    for (const r of changed) { r.updatedAt = t; r.derived = true; r.projectId = projectId; r.status = 'active'; r.rev = ((byId.get(r.id) || {}).rev || 0) + 1; }
    if (changed.length) await this.db.bulkPut(store, changed);
    if (del.length) await this.db.bulkDelete(store, del);
    return { changed: changed.length, removed: del.length, total: recs.length, changedIds: changed.map((r) => r.id) };
  }

  async _audit(store, rec, action, changes, reason) {
    if (store === 'audit' || store === 'rawLogs' || store === 'blobs' || store === 'tiles') return;
    const e = {
      id: ulid(this.now().getTime()), projectId: rec.projectId || null, ts: this.iso(), user: this.user.name, userId: this.user.id,
      deviceId: this.deviceId, store, entityId: rec.id, entityNo: rec.no || rec.pointNo || rec.lineNo || rec.name || '',
      action, changes: changes.slice(0, 60), reason: reason || ''
    };
    await this.db.put('audit', e);
    return e;
  }
  async auditFor(entityId) { const r = await this.db.query('audit', 'entityId', entityId); return r.sort((a, b) => a.ts.localeCompare(b.ts)); }
  async auditLog(projectId, limit = 500) { const r = await this.db.query('audit', 'projectId', projectId); return r.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit); }
  async note(projectId, action, text, extra = {}) {
    return this._audit('projects', Object.assign({ id: projectId, projectId }, extra), action, [], text);
  }

  async _outbox(store, rec, op, baseRev) {
    if (this.derivedStores.has(store) || store === 'audit' || store === 'outbox' || store === 'syncState' || store === 'tiles' || store === 'settings') return;
    await this.db.put('outbox', {
      id: ulid(this.now().getTime()), ts: this.iso(), store, entityId: rec.id, projectId: rec.projectId || null,
      op, rev: rec.rev, baseRev, deviceId: this.deviceId, data: store === 'blobs' ? null : rec, synced: false
    });
  }

  // Katalog (standart) satırı yaz: denetim kaydı + senkron kuyruğu (kullanıcının eklediği / düzelttiği poz diğer cihaza da gitsin)
  async putStd(store, row, reason) {
    const before = await this.db.get(store, row.id);
    const rec = Object.assign({}, row, { rev: ((before && before.rev) || 0) + 1, updatedAt: this.iso(), updatedBy: this.user.name });
    await this.db.put(store, rec);
    await this._audit(store, { id: rec.id, no: rec.servis || rec.name }, before ? 'update' : 'create', diffFields(before, rec), reason || '');
    await this._outbox(store, rec, before ? 'update' : 'create', (before && before.rev) || 0);
    return rec;
  }

  async setting(key, value) {
    if (value === undefined) { const r = await this.db.get('settings', key); return r ? r.value : undefined; }
    await this.db.put('settings', { id: key, value, updatedAt: this.iso() });
    this.bus.emit('settings:change', { key, value });
    return value;
  }
}

function stripMeta(r) {
  if (!r) return r;
  const { updatedAt, rev, derived, status, ...rest } = r;
  return rest;
}
