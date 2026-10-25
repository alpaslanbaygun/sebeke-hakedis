// Test yardımcıları: bellek veritabanı + gerçek standart paketi + Elazığ civarı gerçekçi saha verisi
import fs from 'node:fs';
import path from 'node:path';
import { MemoryAdapter } from '../src/core/db.js';
import { DataService } from '../src/core/data-service.js';
import { Bus } from '../src/core/bus.js';
import { importStandard } from '../src/core/standards.js';
import { ProjectService } from '../src/services/project-service.js';
import { GnssService } from '../src/gnss/gnss-service.js';
import { unproject, makeCrs } from '../src/geo/crs.js';
import { polar } from '../src/geo/geom.js';

const here = path.dirname(new URL(import.meta.url).pathname);
export const SEED = JSON.parse(fs.readFileSync(path.join(here, '../seed/standard-tedas-2026.json'), 'utf8'));

let clock = Date.parse('2026-09-20T07:00:00Z');
export const now = () => new Date(clock);
export const tick = (ms = 1000) => { clock += ms; };

export async function setup(opts = {}) {
  const bus = new Bus();
  const db = opts.adapter || new MemoryAdapter();
  await db.open();
  const ds = new DataService(db, { bus, user: { id: 'u1', name: opts.user || 'Test Operatör' }, deviceId: opts.deviceId || 'dev-A', now });
  if (!opts.skipSeed) await importStandard(ds, SEED);
  const fakeBridge = { isNative: () => false, gnssConnect: async () => {}, gnssDisconnect: async () => {}, phoneStart: async () => {}, phoneStop: async () => {}, ntripConnect: async () => {}, ntripDisconnect: async () => {}, ntripProbe: async () => ({ connected: false, error: 'yok' }) };
  const gnss = new GnssService({ bus, bridge: fakeBridge, now: () => clock });
  const ps = new ProjectService({ ds, bus, gnss });
  return { bus, db, ds, gnss, ps };
}

export const CRS = makeCrs({ datum: 'TUREF', projection: 'TM3', cm: 39 });
// RTK FIX gözlemi (proje düzleminden)
export function rtkObs(E, N, H, extra = {}) {
  const g = unproject(E, N, CRS);
  return Object.assign({ lat: g.lat, lon: g.lon, h: H + 36.1, H, E, N, epochs: 5, stdE: 0.003, stdN: 0.004, stdH: 0.006, spreadH: 0.005, sigmaH: 0.009, sigmaV: 0.014, pdop: 1.3, sats: 26, age: 1.0, fix: 'FIX', source: 'external', cls: 'RTK', duration: 4, receiver: 'CHC i73', receiverSerial: 'I73-2291', antennaHeight: 2.0, mountpoint: 'VRS_RTCM32', correctionSource: 'NTRIP VRS_RTCM32', timestamp: now().toISOString() }, extra);
}
export function phoneObs(E, N, H) {
  const g = unproject(E, N, CRS);
  return { lat: g.lat, lon: g.lon, h: H, H, E, N, epochs: 1, sigmaH: 4.8, sigmaV: 9.6, fix: 'PHONE', source: 'phone', cls: 'TEST', timestamp: now().toISOString() };
}
// Başlangıç noktasından semt/mesafe dizisi ile güzergah
export function route(start, legs) {
  const out = [Object.assign({}, start)];
  let cur = start;
  for (const [az, d, dH] of legs) { const p = polar(cur, az, d); cur = { E: p.E, N: p.N, H: cur.H + (dH || 0) }; out.push(cur); }
  return out;
}
export async function newProject(ps, extra = {}) {
  const p = await ps.createProject(Object.assign({ name: 'OG-03 Hat Yenileme', code: 'ELZ-2026-OG03', client: 'VOLT-EDAŞ Elazığ İl Müdürlüğü', contractor: 'Yüklenici Firma', cm: 39, enhZone: 'III', mode: 'asbuilt', autoRecipe: true }, extra));   // senaryo testleri otomatik reçete motorunu dener (uygulamada varsayılan kapalı)
  await ps.open(p.id);
  return p;
}
// Direkler + hat kısayolu
export async function buildPoleLine(ps, coords, { group, typeNames, lineType = 'OG', circuits, prefix, state = 'YENI', musterek = false, install = 'havai' }) {
  const poles = [];
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    const tn = Array.isArray(typeNames) ? typeNames[i] : typeNames;
    const t = ps.cat.poleTypeByName(group, tn);
    if (!t) throw new Error('Direk tipi yok: ' + group + ' ' + tn);
    const e = await ps.addEquipment('pole', { group, typeId: t.id, state, no: prefix ? prefix + '-' + String(i + 14).padStart(3, '0') : undefined }, { obs: rtkObs(c.E, c.N, c.H) });
    poles.push(e);
  }
  const line = await ps.createLine({ lineType, install, circuits, nodes: poles.map((p) => p.pointId), musterek, state });
  return { poles, line };
}
