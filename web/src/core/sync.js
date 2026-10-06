// Offline-first senkronizasyon.
// Her yazma senkron kuyruğuna (outbox) düşer. İnternet gelince sunucuya (REST) ya da dosya ile (.vsync)
// aktarılır. Karşı taraftan gelen değişiklikler revizyon numarasıyla birleştirilir; aynı kaydın iki tarafta
// değişmesi "çakışma" olarak saklanır ve kullanıcı tarafından çözülür (benimki / onlarınki / alan bazlı).
import { ulid } from './ids.js';
import { diffFields } from './data-service.js';

export async function pendingChanges(ds, projectId) {
  const all = await ds.db.getAll('outbox');
  return all.filter((c) => !c.synced && (!projectId || c.projectId === projectId || c.store === 'projects' || c.store === 'poz')).sort((a, b) => a.ts.localeCompare(b.ts));
}
export async function exportChangeset(ds, projectId) {
  const changes = await pendingChanges(ds, projectId);
  // Aynı kaydın ardışık değişikliklerinden yalnız sonuncusu (tam kayıt) gönderilir; ilk baseRev korunur
  const byEntity = new Map();
  for (const c of changes) {
    const k = c.store + '|' + c.entityId;
    const prev = byEntity.get(k);
    byEntity.set(k, prev ? Object.assign({}, c, { baseRev: prev.baseRev, op: prev.op === 'create' ? 'create' : c.op }) : c);
  }
  return { format: 'volt-sync/1', deviceId: ds.deviceId, user: ds.user.name, createdAt: ds.iso(), projectId: projectId || null, changes: [...byEntity.values()], outboxIds: changes.map((c) => c.id) };
}
export async function markSynced(ds, outboxIds) {
  for (const id of outboxIds) { const c = await ds.db.get('outbox', id); if (c) { c.synced = true; await ds.db.put('outbox', c); } }
}

// Gelen değişiklik kümesini uygula
export async function applyChangeset(ds, cs, opts = {}) {
  if (!cs || cs.format !== 'volt-sync/1') throw new Error('Geçersiz senkron dosyası');
  const res = { applied: 0, skipped: 0, conflicts: [] };
  const pend = await pendingChanges(ds);
  const localPending = new Set(pend.map((c) => c.store + '|' + c.entityId));
  for (const ch of cs.changes) {
    if (ch.deviceId === ds.deviceId) { res.skipped++; continue; }
    if (!ch.data) { res.skipped++; continue; }
    const local = await ds.db.get(ch.store, ch.entityId);
    if (!local) { await ds.db.put(ch.store, ch.data); res.applied++; continue; }
    if (local.rev >= ch.rev && JSON.stringify(local) === JSON.stringify(ch.data)) { res.skipped++; continue; }
    const changedLocally = localPending.has(ch.store + '|' + ch.entityId) && local.rev > (ch.baseRev || 0);
    if (!changedLocally) {
      if (local.rev <= (ch.baseRev || 0) || ch.rev > local.rev) {
        await ds.db.put(ch.store, Object.assign({}, ch.data, { rev: Math.max(ch.rev, local.rev + 1) }));
        await ds._audit(ch.store, ch.data, 'sync', diffFields(local, ch.data), 'Senkron: ' + (cs.user || cs.deviceId));
        res.applied++;
      } else res.skipped++;
      continue;
    }
    // Çakışma: iki tarafta da değişmiş
    const fields = diffFields(local, ch.data).map((d) => d.field);
    const conflict = { id: 'CF:' + ulid(), type: 'conflict', store: ch.store, entityId: ch.entityId, projectId: ch.projectId, local, remote: ch.data, fields, from: cs.user || cs.deviceId, at: ds.iso(), resolved: false };
    await ds.db.put('syncState', conflict);
    res.conflicts.push(conflict);
  }
  if (opts.bus) opts.bus.emit('sync:applied', res);
  return res;
}
export async function listConflicts(ds) { return (await ds.db.getAll('syncState')).filter((x) => x.type === 'conflict' && !x.resolved); }

// choice: 'local' | 'remote' | {alan: 'local'|'remote'} (alan bazlı birleştirme)
export async function resolveConflict(ds, conflictId, choice) {
  const c = await ds.db.get('syncState', conflictId);
  if (!c) throw new Error('Çakışma bulunamadı');
  let merged;
  if (choice === 'local') merged = c.local;
  else if (choice === 'remote') merged = c.remote;
  else { merged = Object.assign({}, c.local); for (const [f, side] of Object.entries(choice)) merged[f] = side === 'remote' ? c.remote[f] : c.local[f]; }
  const cur = await ds.db.get(c.store, c.entityId);
  const rec = await ds.update(c.store, c.entityId, Object.assign({}, merged, { rev: cur.rev }), { reason: 'Senkron çakışması çözüldü (' + (typeof choice === 'string' ? choice : 'alan bazlı') + ')' });
  c.resolved = true; c.resolvedAt = ds.iso(); c.choice = choice;
  await ds.db.put('syncState', c);
  return rec;
}

// REST senkron: POST {url}/sync  gövde {deviceId, cursor, changes} → {changes:[...], cursor}
export async function httpSync(ds, { url, token, projectId, fetchImpl }) {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('fetch yok');
  const st = (await ds.db.get('syncState', 'cursor:' + (projectId || 'all'))) || { id: 'cursor:' + (projectId || 'all'), cursor: null };
  const cs = await exportChangeset(ds, projectId);
  const r = await f(url.replace(/\/$/, '') + '/sync', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: JSON.stringify({ deviceId: ds.deviceId, cursor: st.cursor, changes: cs.changes }) });
  if (!r.ok) throw new Error('Sunucu yanıtı ' + r.status);
  const body = await r.json();
  await markSynced(ds, cs.outboxIds);
  const res = await applyChangeset(ds, { format: 'volt-sync/1', deviceId: 'server', user: 'sunucu', changes: body.changes || [] });
  st.cursor = body.cursor || st.cursor; st.at = ds.iso();
  await ds.db.put('syncState', st);
  return Object.assign(res, { sent: cs.changes.length });
}
