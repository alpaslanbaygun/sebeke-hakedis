// Standart sürüm paketlerinin (poz kataloğu, direk/iletken/trafo tabloları, reçete kuralları)
// veritabanına alınması ve yönetimi. Kod içinde sabit katalog tutulmaz; her şey DB'den okunur.

const LIST_TABLES = ['poz', 'poleGroups', 'poleTypes', 'conductors', 'lineTypes', 'transformers', 'panels', 'kiosks', 'trafoPostTypes', 'sdkTypes', 'recipeRules', 'params'];
const OBJ_TABLES = ['lineDefaults', 'kioskDefaults', 'trafoPoleCompat', 'gnssThresholds', 'enh', 'clearances', 'legend', 'materialsMaster', 'cableRules', 'cabin', 'kanal'];
// Uygulamayla gelen standart paketinin sürümü: kurulu katalog bundan eskiyse açılışta eksik kalemler eklenir
export const SEED_REV = 26;

export async function listStandards(ds) {
  const all = await ds.db.getAll('standards');
  return all.sort((a, b) => (b.validFrom || '').localeCompare(a.validFrom || ''));
}

export async function importStandard(ds, pkg, opts = {}) {
  if (!pkg || pkg.format !== 'volt-standard/1') throw new Error('Geçersiz katalog paketi');
  const std = pkg.standard;
  const existing = await ds.db.get('standards', std.id);
  if (existing && !opts.replace) return { skipped: true, id: std.id };
  const stdId = std.id;
  let n = 0;
  for (const t of LIST_TABLES) {
    const rows = (pkg[t] || []).map((r, i) => Object.assign({}, r, { id: r.id || (stdId + ':' + t + ':' + i), stdId }));
    if (opts.replace) { const old = await ds.db.query(t, 'stdId', stdId); await ds.db.bulkDelete(t, old.map((r) => r.id)); }
    if (rows.length) await ds.db.bulkPut(t, rows);
    n += rows.length;
  }
  for (const t of OBJ_TABLES) {
    if (pkg[t] === undefined) continue;
    await ds.db.put('stdTables', { id: stdId + ':' + t, stdId, key: t, value: pkg[t] });
    n++;
  }
  await ds.db.put('standards', Object.assign({}, std, { importedAt: ds.iso(), recordCount: n }));
  await ds._audit('standards', { id: stdId }, 'import', [], (opts.reason || 'Standart paketi içe aktarıldı') + ' · ' + n + ' kayıt');
  return { imported: n, id: stdId };
}

// Kurulu kataloğu uygulamayla gelen paketle güncelle: yalnız EKSİK satırlar eklenir (kullanıcının fiyat / poz düzeltmeleri korunur),
// pkg.upserts[tablo] içinde kimliği verilen satırlar ise yenilenir.
export async function upgradeStandard(ds, pkg) {
  const std = pkg.standard, stdId = std.id;
  const cur = await ds.db.get('standards', stdId);
  if (!cur) return importStandard(ds, pkg, { reason: 'Standart paketi' });
  if ((cur.seedRev || 0) >= (std.seedRev || 0)) return { skipped: true, id: stdId };
  const ups = pkg.upserts || {};
  let n = 0;
  for (const t of LIST_TABLES) {
    const have = new Set((await ds.db.query(t, 'stdId', stdId)).map((r) => r.id));
    const force = new Set(ups[t] || []);
    const rows = (pkg[t] || []).map((r, i) => Object.assign({}, r, { id: r.id || (stdId + ':' + t + ':' + i), stdId })).filter((r) => !have.has(r.id) || force.has(r.id));
    if (rows.length) { await ds.db.bulkPut(t, rows); n += rows.length; }
  }
  for (const t of OBJ_TABLES) {
    if (pkg[t] === undefined) continue;
    const id = stdId + ':' + t;
    if ((await ds.db.get('stdTables', id)) && !(ups.stdTables || []).includes(t)) continue;
    await ds.db.put('stdTables', { id, stdId, key: t, value: pkg[t] }); n++;
  }
  // Katalog başlığı (ad, kod, kitap, not) paketten yenilenir: 25. sürümde kurum ve kitap sürümü yazıları kaldırıldı
  await ds.db.put('standards', Object.assign({}, cur, { seedRev: std.seedRev, upgradedAt: ds.iso(), unverifiedTables: std.unverifiedTables || cur.unverifiedTables, code: std.code || cur.code, name: std.name || cur.name, book: std.book || cur.book, notes: std.notes || cur.notes }));
  await ds._audit('standards', { id: stdId }, 'import', [], 'Katalog güncellendi (sürüm ' + (cur.seedRev || 0) + ' → ' + std.seedRev + ') · ' + n + ' yeni kayıt');
  return { upgraded: n, id: stdId };
}

// Mevcut standardı yeni sürüm olarak kopyala (ör. TEDAŞ 2027 hazırlığı) — eski projeler eski sürümde kalır
export async function cloneStandard(ds, fromId, to) {
  const pkg = await exportStandard(ds, fromId);
  const newId = to.id;
  const remap = (rows) => rows.map((r) => Object.assign({}, r, { id: String(r.id).replace(fromId, newId), stdId: newId }));
  for (const t of LIST_TABLES) pkg[t] = remap(pkg[t] || []);
  pkg.standard = Object.assign({}, pkg.standard, to, { status: 'draft', createdAt: ds.iso(), clonedFrom: fromId });
  return importStandard(ds, pkg, { reason: fromId + ' sürümünden kopyalandı' });
}

export async function exportStandard(ds, stdId) {
  const std = await ds.db.get('standards', stdId);
  const pkg = { format: 'volt-standard/1', standard: std };
  for (const t of LIST_TABLES) pkg[t] = await ds.db.query(t, 'stdId', stdId);
  for (const row of await ds.db.query('stdTables', 'stdId', stdId)) pkg[row.key] = row.value;
  return pkg;
}

export async function updateStdTable(ds, stdId, key, value, reason) {
  const id = stdId + ':' + key;
  const before = await ds.db.get('stdTables', id);
  await ds.db.put('stdTables', { id, stdId, key, value });
  await ds._audit('stdTables', { id }, 'update', [{ field: key, old: before ? '(önceki tablo)' : null, new: '(yeni tablo)' }], reason || '');
}
