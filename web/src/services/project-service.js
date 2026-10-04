// Proje servisi: veritabanı ile hesap zincirini bağlar. UI yalnızca bu servisi çağırır.
import { ulid, nextNo } from '../core/ids.js';
import { PROJECT_STORES, EQUIPMENT_KINDS, HAK_STATUSES, hakOf } from '../core/schema.js';
import { Catalog } from '../grid/catalog.js';
import { computeProject, impactOf } from '../engine/compute.js';
import { makeCrs, project as projectLL, unproject } from '../geo/crs.js';
import { buildWorkProgram, periodTable, approveSnapshot } from '../qty/hakedis.js';

const LOAD = ['points', 'equipment', 'lines', 'crossings', 'materials', 'photos', 'periods', 'workPrograms', 'stakeouts', 'revisions', 'surveySessions', 'gnssObservations', 'inspections', 'exportJobs', 'documents'];

export class ProjectService {
  constructor({ ds, bus, gnss }) {
    this.ds = ds; this.bus = bus; this.gnss = gnss;
    this.p = null; this.cat = null; this.data = {}; this.result = null; this.lastImpact = null;
    this.catCache = new Map();
  }
  get id() { return this.p ? this.p.id : null; }

  // ---------------- Proje ----------------
  async listProjects() { return (await this.ds.list('projects')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); }
  async createProject(d) {
    const std = d.stdId || (await this.ds.db.getAll('standards')).find((s) => s.status === 'active')?.id;
    if (!std) throw new Error('Aktif standart sürümü yok');
    const crs = d.crs || makeCrs({ datum: 'TUREF', projection: 'TM3', cm: d.cm || 39 });
    const pid = ulid();
    const rec = await this.ds.create('projects', {
      id: pid, projectId: pid, name: d.name, code: d.code || '', client: d.client || '', contractor: d.contractor || '', stdId: std, crs,
      heightSystem: d.heightSystem || 'ortometrik', geoid: d.geoid || { model: 'receiver' }, enhZone: d.enhZone || 'II', landClass: d.landClass || 'arazi',
      mode: d.mode || 'asbuilt', cornerThresholdDeg: d.cornerThresholdDeg ?? 3, conductorPayPct: d.conductorPayPct ?? 0, paramOverrides: {}, thresholds: d.thresholds || null,
      startDate: d.startDate || new Date().toISOString().slice(0, 10), location: d.location || ''
    }, { reason: 'Proje oluşturuldu' });
    return rec;
  }
  async open(id) {
    const p = await this.ds.get('projects', id);
    if (!p) throw new Error('Proje bulunamadı');
    this.p = p;
    if (!this.catCache.has(p.stdId)) this.catCache.set(p.stdId, await Catalog.load(this.ds, p.stdId));
    this.cat = this.catCache.get(p.stdId);
    await this.load();
    this.result = null;
    await this.recompute('Proje açıldı', { silent: true });
    if (this.gnss) this.gnss.configure({ crs: p.crs, geoid: p.geoid, thresholds: Object.assign({}, this.cat.table('gnssThresholds') || {}, p.thresholds || {}) });
    await this.ds.setting('lastProject', id);
    this.bus.emit('project:open', p);
    return p;
  }
  async updateProject(patch, reason) {
    if (patch.stdId && patch.stdId !== this.p.stdId) throw new Error('Projenin standart sürümü değiştirilemez (' + this.p.stdId + '). Yeni sürüm için projeyi kopyalayın.');
    this.p = await this.ds.update('projects', this.p.id, patch, { reason });
    if (patch.crs || patch.geoid || patch.thresholds) this.gnss && this.gnss.configure({ crs: this.p.crs, geoid: this.p.geoid, thresholds: Object.assign({}, this.cat.table('gnssThresholds') || {}, this.p.thresholds || {}) });
    if (patch.crs) await this.reprojectAll('Koordinat sistemi değişti');
    await this.recompute(reason || 'Proje ayarı');
    return this.p;
  }
  async load() {
    for (const s of LOAD) this.data[s] = await this.ds.list(s, this.p.id);
  }
  async reload(s) { this.data[s] = await this.ds.list(s, this.p.id); }

  // Hesap zinciri + türetilmiş kayıtların kalıcılaştırılması + etki raporu
  async recompute(reason, opts = {}) {
    const model = Object.assign({ project: this.p }, this.data);
    const r = computeProject(model, this.cat);
    const impact = impactOf(this.result, r);
    const sp = await this.ds.replaceDerived('spans', this.p.id, r.spans.map((s) => Object.assign({}, s)));
    const qt = await this.ds.replaceDerived('quantities', this.p.id, r.quantities.map((q) => Object.assign({}, q)));
    this.result = r;
    let stale = 0;
    for (const j of this.data.exportJobs || []) if (!j.stale && j.signature !== r.signature) { await this.ds.update('exportJobs', j.id, { stale: true }, { noSync: true, noAudit: true, silent: true }); stale++; }
    if (stale) await this.reload('exportJobs');
    this.lastImpact = impact ? Object.assign(impact, { reason, spansStored: sp.changed, quantitiesStored: qt.changed, exportJobsStaled: stale, at: this.ds.iso() }) : null;
    if (!opts.silent) this.bus.emit('project:computed', { impact: this.lastImpact, reason });
    return r;
  }
  async _after(stores, reason) { for (const s of [].concat(stores)) await this.reload(s); return this.recompute(reason); }

  // ---------------- Nokta / ölçüm ----------------
  pointById(id) { return this.data.points.find((p) => p.id === id) || null; }
  pointByNo(no) { return this.data.points.find((p) => p.pointNo === no) || null; }
  eqAt(pointId) { return this.data.equipment.filter((e) => e.pointId === pointId); }
  eqById(id) { return this.data.equipment.find((e) => e.id === id) || null; }
  lineById(id) { return this.data.lines.find((l) => l.id === id) || null; }
  nextPointNo(prefix) { return nextNo(prefix, this.data.points.map((p) => p.pointNo), prefix === 'D' ? 3 : 2); }
  nextLineNo() { return nextNo('H', this.data.lines.map((l) => l.lineNo), 2); }

  async saveObservation(obs, extra = {}) {
    const o = await this.ds.create('gnssObservations', Object.assign({ projectId: this.p.id }, obs, extra), { reason: 'GNSS ölçümü', silent: true });
    if (this.data.gnssObservations) this.data.gnssObservations.push(o);
    return o;
  }
  pointFromObs(obs) {
    const src = obs.source === 'phone' ? 'PHONE' : obs.source === 'sim' ? 'SIM' : 'GNSS_RTK';
    return {
      E: obs.E, N: obs.N, h: obs.h, H: this.p.heightSystem === 'elipsoidal' ? obs.h : (obs.H ?? obs.h), lat: obs.lat, lon: obs.lon,
      source: src, accuracyClass: obs.cls, zUnknown: false,
      quality: { fix: obs.fix, sigmaH: obs.sigmaH, sigmaV: obs.sigmaV, pdop: obs.pdop, hdop: obs.hdop ?? null, vdop: obs.vdop ?? null, sats: obs.sats, age: obs.age, epochs: obs.epochs, duration: obs.duration, spread: obs.spreadH, sigmaEst: obs.sigmaEst, override: !!obs.override, overrideReasons: obs.override ? obs.overrideReasons || [] : undefined },
      // Ölçüm kaydı özeti (spesifikasyon 7.6): tam kayıt gnssObservations tablosunda
      measuredAt: obs.timestamp || this.ds.iso(), device: obs.receiver || (obs.source === 'phone' ? 'Telefon' : null), deviceSerial: obs.receiverSerial || null,
      method: obs.method || null, correction: obs.correctionSource || null, operator: this.ds.user.name, crsLabel: this.p.crs.label
    };
  }
  // Yeni nokta (+ isteğe bağlı ekipman) — gözlemden, elle ya da proje tasarımından
  async createPoint({ pointNo, cls, critical = true, obs, coord, source, note }) {
    let data;
    if (obs) {
      const o = await this.saveObservation(obs, { pointNo, accepted: true, operator: this.ds.user.name });
      data = Object.assign(this.pointFromObs(obs), { observationId: o.id, sessionId: obs.sessionId || null });
    } else {
      const c = coord || {};
      let lat = c.lat, lon = c.lon;
      if ((lat == null || lon == null) && c.E != null) { const g = unproject(c.E, c.N, this.p.crs); lat = g.lat; lon = g.lon; }
      let E = c.E, N = c.N;
      if (E == null && lat != null) { const q = projectLL(lat, lon, this.p.crs); E = q.E; N = q.N; }
      const src = source || 'MANUAL';
      data = { E, N, H: c.H ?? null, h: c.h ?? null, lat, lon, source: src, accuracyClass: src === 'DESIGN' ? 'PROJE' : src === 'EXCEL' ? 'EXCEL' : src === 'MAP' ? 'HARITA' : 'MANUEL', quality: null,
        zUnknown: c.H == null, measuredAt: this.ds.iso(), operator: this.ds.user.name, crsLabel: c.crsLabel || this.p.crs.label, enteredCrs: c.enteredCrs || null };
    }
    const p = await this.ds.create('points', Object.assign({ projectId: this.p.id, pointNo: pointNo || this.nextPointNo('P'), cls: cls || 'DETAY', critical, note: note || '', history: [] }, data), { reason: 'Nokta alındı (' + (data.source) + ')' });
    this.data.points.push(p);
    return p;
  }
  // Yeniden ölçüm: yeni kayıt açılmaz; aynı Point ID üzerinde kaynak + koordinat revize edilir
  async remeasure(pointId, obs, reason) {
    const before = this.pointById(pointId);
    if (!before) throw new Error('Nokta yok');
    const o = await this.saveObservation(obs, { pointNo: before.pointNo, accepted: true, remeasureOf: pointId });
    const hist = (before.history || []).concat([{ at: before.updatedAt, source: before.source, E: before.E, N: before.N, H: before.H, observationId: before.observationId || null, quality: before.quality || null, by: before.updatedBy }]);
    const p = await this.ds.update('points', pointId, Object.assign(this.pointFromObs(obs), { observationId: o.id, history: hist }), { reason: reason || ('Yeniden ölçüm: ' + before.source + ' → ' + (obs.source === 'phone' ? 'PHONE' : 'GNSS_RTK ' + obs.fix)) });
    await this.reload('points');
    await this.recompute('Nokta revize: ' + p.pointNo);
    return p;
  }
  async movePoint(pointId, E, N, reason) {
    const p0 = this.pointById(pointId);
    const g = unproject(E, N, this.p.crs);
    const hist = (p0.history || []).concat([{ at: p0.updatedAt, source: p0.source, E: p0.E, N: p0.N, H: p0.H, by: p0.updatedBy, manualMove: true }]);
    await this.ds.update('points', pointId, { E, N, lat: g.lat, lon: g.lon, source: 'MANUAL', accuracyClass: 'MANUEL', history: hist }, { reason: reason || 'Elle taşındı' });
    return this._after('points', 'Nokta taşındı: ' + p0.pointNo);
  }
  async updatePoint(pointId, patch, reason) { await this.ds.update('points', pointId, patch, { reason }); return this._after('points', reason || 'Nokta güncellendi'); }

  // ---------------- Ekipman ----------------
  eqPrefix(kind, group) {
    if (kind === 'pole') return group === 'ayd' ? 'AY' : ['sehir', 'agac', 'beton'].includes(group) ? 'A' : group === 'mus' ? 'M' : 'D';
    return (EQUIPMENT_KINDS[kind] || { prefix: 'E' }).prefix;
  }
  async addEquipment(kind, data, opts = {}) {
    const prefix = this.eqPrefix(kind, data.group);
    const no = data.no || nextNo(prefix, this.data.equipment.map((e) => e.no).concat(this.data.points.map((p) => p.pointNo)), prefix === 'D' ? 3 : 2);
    let pointId = data.pointId;
    if (!pointId) {
      const pt = await this.createPoint({ pointNo: no, cls: kind.toUpperCase(), critical: kind !== 'subscriber', obs: opts.obs, coord: opts.coord, source: opts.source });
      pointId = pt.id;
    }
    const progress = data.progress || (this.p.mode === 'asbuilt' && (data.state === 'YENI' || data.state === 'yeni' || data.state === 'DMM' || data.state === 'DEMONTAJ' || data.state === 'demontaj' || data.state === 'tasinan') ? 'done' : 'planned');
    const rec = Object.assign({ projectId: this.p.id, kind, no, pointId, state: kind === 'transformer' ? 'yeni' : 'YENI', attrs: {}, materialOverrides: {}, progress, workDate: progress === 'done' ? this.ds.iso().slice(0, 10) : null }, data, { no, pointId, progress });
    if (!rec.hak || !HAK_STATUSES[rec.hak]) rec.hak = hakOf(rec); // obje bazlı hakediş durumu (iş kalemi yoksa null)
    else { rec.progress = HAK_STATUSES[rec.hak].done ? 'done' : 'planned'; if (rec.progress === 'done' && !rec.workDate) rec.workDate = this.ds.iso().slice(0, 10); if (rec.progress !== 'done') rec.workDate = null; }
    const e = await this.ds.create('equipment', rec, { reason: opts.reason || (EQUIPMENT_KINDS[kind] || {}).label + ' kaydı' });
    this.data.equipment.push(e);
    if (!opts.defer) await this.recompute(e.no + ' eklendi');
    return e;
  }
  async updateEquipment(id, patch, reason) {
    const e = await this.ds.update('equipment', id, patch, { reason });
    return this._after('equipment', reason || (e.no + ' güncellendi')).then(() => e);
  }
  // Reçete kalemi miktar değişikliği (yalnız miktar; denetim kaydına yazılır)
  async setMaterialQty(eqId, servis, qty, reason) {
    if (!reason) throw new Error('Miktar değişikliği için gerekçe zorunlu');
    const e = this.eqById(eqId);
    const ov = Object.assign({}, e.materialOverrides || {});
    if (qty === null) delete ov[servis]; else ov[servis] = qty;
    return this.updateEquipment(eqId, { materialOverrides: ov }, 'Reçete miktarı: ' + servis + ' → ' + (qty ?? 'varsayılan') + ' · ' + reason);
  }
  // Sahada ilave talebi (reçete dışı, ayrı işaretli, onay bekler)
  async addFieldMaterial(eqId, servis, qty, reason) {
    if (!reason) throw new Error('Sahada ilave için gerekçe zorunlu');
    const pz = this.cat.poz(servis);
    const x = await this.ds.create('materials', { projectId: this.p.id, ownerId: eqId, ownerType: 'equipment', servis, qty, unit: pz ? pz.unit : 'Ad', origin: 'SAHADA_ILAVE', reason, approved: false, grp: pz ? pz.kgGroup : '' }, { reason: 'Sahada ilave: ' + servis + ' × ' + qty + ' · ' + reason });
    this.data.materials.push(x);
    await this.recompute('Sahada ilave');
    return x;
  }
  async approveMaterial(id, ok, reason) { await this.ds.update('materials', id, { approved: !!ok }, { reason: (ok ? 'Onaylandı' : 'Onay geri alındı') + (reason ? ' · ' + reason : '') }); return this._after('materials', 'Malzeme onayı'); }
  async removeMaterial(id, reason) { await this.ds.remove('materials', id, { reason }); return this._after('materials', 'Malzeme kaldırıldı'); }
  async removeEquipment(id, reason) { await this.ds.remove('equipment', id, { reason }); return this._after('equipment', 'Ekipman silindi'); }

  // ---------------- Hat ----------------
  async createLine(d, opts = {}) {
    const rec = Object.assign({ projectId: this.p.id, lineNo: d.lineNo || this.nextLineNo(), state: 'YENI', nodes: [], circuits: [], install: 'havai', progress: this.p.mode === 'asbuilt' ? 'done' : 'planned', workDate: this.p.mode === 'asbuilt' ? this.ds.iso().slice(0, 10) : null }, d);
    if (!rec.hak || !HAK_STATUSES[rec.hak]) rec.hak = hakOf(rec);
    const l = await this.ds.create('lines', rec, { reason: opts.reason || 'Hat oluşturuldu' });
    this.data.lines.push(l);
    if (!opts.defer) await this.recompute(l.lineNo + ' oluşturuldu');
    return l;
  }
  async updateLine(id, patch, reason) { const l = await this.ds.update('lines', id, patch, { reason }); await this._after('lines', reason || l.lineNo + ' güncellendi'); return l; }
  async appendNode(lineId, pointId, index = null) {
    const l = this.lineById(lineId);
    const nodes = l.nodes.slice();
    if (nodes[nodes.length - 1] === pointId && index === null) return l;
    if (index === null) nodes.push(pointId); else nodes.splice(index, 0, pointId);
    return this.updateLine(lineId, { nodes }, 'Düğüm eklendi: ' + (this.pointById(pointId) || {}).pointNo);
  }
  async removeNode(lineId, index) { const l = this.lineById(lineId); const nodes = l.nodes.slice(); const [pid] = nodes.splice(index, 1); return this.updateLine(lineId, { nodes }, 'Düğüm çıkarıldı: ' + (this.pointById(pid) || {}).pointNo); }
  async reverseLine(lineId) { const l = this.lineById(lineId); return this.updateLine(lineId, { nodes: l.nodes.slice().reverse() }, 'Hat yönü ters çevrildi'); }
  // Böl: düğüm indeksinde ikiye ayır (düğüm iki hatta ortak kalır)
  async splitLine(lineId, index) {
    const l = this.lineById(lineId);
    if (index <= 0 || index >= l.nodes.length - 1) throw new Error('Bölme noktası hat ucunda olamaz');
    const a = l.nodes.slice(0, index + 1), b = l.nodes.slice(index);
    await this.ds.update('lines', lineId, { nodes: a }, { reason: 'Hat bölündü' });
    const { id, lineNo, createdAt, updatedAt, rev, createdBy, updatedBy, ...rest } = l;
    const nl = await this.ds.create('lines', Object.assign({}, rest, { nodes: b, lineNo: this.nextLineNo(), splitFrom: lineId }), { reason: 'Hat bölündü (' + l.lineNo + ')' });
    await this._after('lines', l.lineNo + ' bölündü');
    return nl;
  }
  // Birleştir: ortak uçtan iki hattı tek hatta topla (aynı tip/iletken olmalı)
  async mergeLines(aId, bId) {
    const a = this.lineById(aId), b = this.lineById(bId);
    if (a.lineType !== b.lineType || a.install !== b.install || JSON.stringify(a.circuits) !== JSON.stringify(b.circuits)) throw new Error('Birleştirme için hat tipi, tesis şekli ve iletkenler aynı olmalı');
    let A = a.nodes.slice(), B = b.nodes.slice();
    if (A[A.length - 1] === B[0]) { /* uygun */ } else if (A[A.length - 1] === B[B.length - 1]) B.reverse(); else if (A[0] === B[0]) A.reverse(); else if (A[0] === B[B.length - 1]) { A.reverse(); B.reverse(); } else throw new Error('Hatların ortak ucu yok');
    await this.ds.update('lines', aId, { nodes: A.concat(B.slice(1)) }, { reason: 'Hat birleştirildi: ' + b.lineNo });
    await this.ds.remove('lines', bId, { reason: a.lineNo + ' ile birleştirildi' });
    return this._after('lines', 'Hatlar birleştirildi');
  }
  // Son alımı geri al: hat düğümü + ekipman + (başka yerde kullanılmıyorsa) nokta. Denetim kaydına yazılır.
  async undoCapture({ pointId, eqId, lineId }, reason = 'Son alım geri alındı') {
    if (lineId && pointId) { const l = this.lineById(lineId); if (l) { const i = l.nodes.lastIndexOf(pointId); if (i >= 0) { const nodes = l.nodes.slice(); nodes.splice(i, 1); await this.ds.update('lines', lineId, { nodes }, { reason }); } } }
    if (eqId) await this.ds.remove('equipment', eqId, { reason });
    await this.reload('lines'); await this.reload('equipment');
    const used = pointId && (this.data.lines.some((l) => l.nodes.includes(pointId)) || this.data.equipment.some((e) => e.pointId === pointId) || (this.data.crossings || []).some((c) => c.pointId === pointId));
    if (pointId && !used) await this.ds.remove('points', pointId, { reason });
    return this._after(['lines', 'equipment', 'points'], reason);
  }
  async removeLine(id, reason) { await this.ds.remove('lines', id, { reason }); return this._after('lines', 'Hat silindi'); }

  // ---------------- Obje bazlı hakediş durumu ----------------
  // type: 'equipment' | 'line'. Durum "tamamlandı" ve sonrası ise obje metraj/hakediş kümülatifine girer (iş tarihi yoksa bugün).
  async setHak(type, id, status, reason) {
    const st = HAK_STATUSES[status];
    if (!st) throw new Error('Geçersiz hakediş durumu: ' + status);
    const store = type === 'line' ? 'lines' : 'equipment';
    const rec = type === 'line' ? this.lineById(id) : this.eqById(id);
    if (!rec) throw new Error('Kayıt yok');
    if (hakOf(rec) === null) throw new Error('Mevcut / ileride durumundaki objenin hakediş kalemi yok');
    const patch = { hak: status, progress: st.done ? 'done' : 'planned' };
    if (st.done && !rec.workDate) patch.workDate = this.ds.iso().slice(0, 10);
    if (!st.done) patch.workDate = null;
    await this.ds.update(store, id, patch, { reason: reason || 'Hakediş durumu: ' + st.label });
    return this._after(store, (rec.no || rec.lineNo) + ' · ' + st.label);
  }
  hakCounts() {
    const c = {};
    for (const r of [...this.data.equipment, ...this.data.lines]) { const h = hakOf(r); if (h) c[h] = (c[h] || 0) + 1; }
    return c;
  }
  // Dönem açılınca / onaylanınca objelerin durumunu ilerlet (yalnız ileri yönde; elle verilen durum geri alınmaz)
  async _advanceHak(endDate, from, to, reason) {
    const end = String(endDate || '9999-12-31').slice(0, 10);
    let n = 0;
    for (const [store, arr] of [['equipment', this.data.equipment], ['lines', this.data.lines]]) {
      for (const r of arr) {
        const h = hakOf(r);
        if (!h || !from.includes(h) || r.progress !== 'done') continue;
        if ((r.workDate || '0000-00-00').slice(0, 10) > end) continue;
        await this.ds.update(store, r.id, { hak: to }, { reason, silent: true }); n++;
      }
    }
    if (n) { await this.reload('equipment'); await this.reload('lines'); }
    return n;
  }

  // ---------------- Eski GEÇİŞ kayıtları (v2.2'de özellik kaldırıldı) ----------------
  legacyCrossings() { return (this.data.crossings || []).filter((c) => c.status !== 'deleted'); }
  // mode 'detail': konumu olanlar "Detay noktası"na dönüştürülür · 'archive': yalnız arşivlenir. Kayıtlar veritabanında silinmiş (arşiv) olarak kalır.
  async convertLegacyCrossings(mode = 'detail') {
    let made = 0, archived = 0;
    for (const c of this.legacyCrossings()) {
      if (mode === 'detail' && c.E != null && c.N != null) {
        await this.createPoint({ pointNo: this.nextPointNo('P'), cls: 'DETAY', critical: false, coord: { E: c.E, N: c.N, H: c.groundH ?? null, lat: c.lat, lon: c.lon }, source: c.source === 'GNSS' ? 'MANUAL' : 'MANUAL', note: 'Eski geçiş kaydı: ' + (c.label || c.crossKind || '') + (c.objectHeight ? ' · nesne ' + c.objectHeight + ' m' : '') });
        made++;
      }
      await this.ds.remove('crossings', c.id, { reason: mode === 'detail' ? 'Geçiş kaldırıldı · detay noktasına dönüştürüldü' : 'Geçiş kaldırıldı · arşivlendi' });
      archived++;
    }
    await this._after(['crossings', 'points'], 'Eski geçiş kayıtları ' + (mode === 'detail' ? 'dönüştürüldü' : 'arşivlendi'));
    return { made, archived };
  }

  // ---------------- Fotoğraf ----------------
  async addPhoto(bytes, mime, meta) {
    const blobId = ulid();
    await this.ds.db.put('blobs', { id: blobId, projectId: this.p.id, mime, bytes });
    const ph = await this.ds.create('photos', Object.assign({ projectId: this.p.id, blobId, timestamp: this.ds.iso(), user: this.ds.user.name }, meta), { reason: 'Fotoğraf eklendi' });
    this.data.photos.push(ph);
    await this.recompute('Fotoğraf kanıtı');
    return ph;
  }
  async photoBytes(ph) { const b = await this.ds.db.get('blobs', ph.blobId); return b ? b.bytes : null; }

  // ---------------- Hakediş ----------------
  async createWorkProgram(opts = {}) {
    const items = buildWorkProgram(this.result.quantities, { marginPct: opts.marginPct || 0, price: (q) => this.unitPrice(q) });
    const wp = await this.ds.create('workPrograms', { projectId: this.p.id, basis: opts.basis || 'Keşif (otomatik metraj)', items, active: true }, { reason: 'İş programı oluşturuldu (' + items.length + ' kalem)' });
    for (const o of this.data.workPrograms) if (o.active) await this.ds.update('workPrograms', o.id, { active: false }, { reason: 'Yeni iş programı' });
    await this.reload('workPrograms');
    return wp;
  }
  unitPrice(q) {
    if (!q.servis) return null;
    const pz = this.cat.poz(q.servis);
    if (pz && (pz.priceMaterial != null || pz.priceLabor != null)) return (pz.priceMaterial || 0) + (pz.priceLabor || 0);
    const c = this.cat.t.conductors.find((x) => x.yd === q.servis || x.ydToprak === q.servis);
    if (c) { if (q.unit === 'Kg' && c.priceMaterialPerKg != null) return c.priceMaterialPerKg + (c.priceLaborPerKg || 0); if (q.unit === 'm' && c.priceMaterialPerM != null) return c.priceMaterialPerM + (c.priceLaborPerM || 0); }
    return null;
  }
  activeProgram() { return this.data.workPrograms.find((w) => w.active) || null; }
  async createPeriod({ start, end }) {
    const no = (this.data.periods.reduce((m, p) => Math.max(m, p.no), 0)) + 1;
    const last = this.data.periods.filter((p) => p.status === 'taslak');
    if (last.length) throw new Error('Onaylanmamış taslak dönem var (' + last[0].no + ')');
    const p = await this.ds.create('periods', { projectId: this.p.id, no, start, end, status: 'taslak' }, { reason: no + '. hakediş dönemi açıldı' });
    await this.reload('periods');
    const n = await this._advanceHak(end, ['TAMAMLANDI', 'KONTROL'], 'HAKEDISTE', no + '. hakedişe girdi');
    if (n) await this.recompute(no + '. hakediş dönemi · ' + n + ' obje hakedişe girdi');
    return p;
  }
  periodTable(periodId) { return periodTable(this.result.quantities, this.activeProgram(), this.data.periods, periodId); }
  async approvePeriod(id, reason) {
    const t = this.periodTable(id);
    await this.ds.update('periods', id, { status: 'onayli', snapshot: approveSnapshot(t), approvedAt: this.ds.iso(), approvedBy: this.ds.user.name, totals: t.totals }, { reason: reason || 'Hakediş onaylandı' });
    await this.reload('periods');
    const per = this.data.periods.find((x) => x.id === id);
    const n = await this._advanceHak(per ? per.end : null, ['HAKEDISTE'], 'ONAYLI', (per ? per.no + '. ' : '') + 'hakediş onaylandı');
    if (n) await this.recompute('Hakediş onayı · ' + n + ' obje');
    return t;
  }

  // ---------------- Aplikasyon ----------------
  async recordStakeout(d) { const s = await this.ds.create('stakeouts', Object.assign({ projectId: this.p.id }, d), { reason: 'Aplikasyon: ' + d.targetNo }); this.data.stakeouts.push(s); return s; }

  // ---------------- Revizyon / kontrol ----------------
  async createRevision(label, reason) {
    const snap = { project: this.p, data: {} };
    for (const s of ['points', 'equipment', 'lines', 'crossings', 'materials']) snap.data[s] = this.data[s];
    const json = JSON.stringify(snap);
    const blobId = ulid();
    await this.ds.db.put('blobs', { id: blobId, projectId: this.p.id, mime: 'application/json', text: json });
    const r = await this.ds.create('revisions', { projectId: this.p.id, label, reason, snapshotBlobId: blobId, counts: this.result.counts, signature: this.result.signature, no: this.data.revisions.length + 1 }, { reason: 'Revizyon: ' + label });
    await this.reload('revisions');
    return r;
  }
  async runInspection() {
    const res = this.result.issues;
    const rec = await this.ds.create('inspections', { projectId: this.p.id, runAt: this.ds.iso(), results: res.slice(0, 2000), errors: res.filter((x) => x.severity === 'error').length, warnings: res.filter((x) => x.severity === 'warn').length }, { reason: 'Kontrol çalıştırıldı', silent: true });
    await this.reload('inspections');
    return rec;
  }

  // CRS değişince tüm noktaların E/N değerleri enlem/boylamdan yeniden üretilir
  async reprojectAll(reason) {
    for (const p of this.data.points) {
      if (p.lat == null) continue;
      const q = projectLL(p.lat, p.lon, this.p.crs);
      await this.ds.update('points', p.id, { E: q.E, N: q.N }, { reason, silent: true });
    }
    await this.reload('points');
  }
  storesForProject() { return Object.keys(PROJECT_STORES); }
}
