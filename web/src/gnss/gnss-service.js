// GNSS servisi: konum kaynağı yönetimi (harici alıcı / telefon / simülatör), NMEA durum makinesi,
// anten yüksekliği, geoit, proje CRS'ine dönüşüm, epok ortalamalı ölçüm ve ham kayıt.
import { NmeaStream, makeGGA, makeGST, makeGSA, withChecksum, FIX_LABEL } from './nmea.js';
import { evaluateFix, averageEpochs, DEFAULT_THRESHOLDS } from './quality.js';
import { project, geoidN, makeCrs, zoneForLon } from '../geo/crs.js';
import { polar, bearing, dist2 } from '../geo/geom.js';

const EMPTY = () => ({
  source: 'none', link: null, connected: false, fix: 'NONE', lat: null, lon: null, altMSL: null, geoidSep: null,
  hAnt: null, h: null, H: null, E: null, N: null, sats: null, satsInView: null, hdop: null, pdop: null, vdop: null,
  sigmaH: null, sigmaV: null, sigmaEst: false, age: null, stationId: null, heading: null, course: null, speed: null,
  rateHz: null, lastUpdate: 0, fixSince: null, fixSeconds: 0, receiver: null, error: null
});

export class GnssService {
  constructor({ bus, bridge, now } = {}) {
    this.bus = bus; this.bridge = bridge; this.now = now || (() => Date.now());
    this.state = EMPTY();
    this.ntrip = { state: 'off', bytes: 0, rateBps: 0, age: null, mount: null, types: {}, error: null };
    this.antenna = { height: 2.0, measure: 'vertical', radius: 0.0, pco: 0.0 };
    this.crs = makeCrs({ datum: 'TUREF', projection: 'TM3', cm: 39 });
    this.geoid = { model: 'receiver' };
    this.thresholds = Object.assign({}, DEFAULT_THRESHOLDS);
    this.stream = new NmeaStream((s) => this.onSentence(s));
    this.raw = []; this.rawBytes = 0;
    this.lastGGAt = []; this.sim = null; this.phoneWatch = null; this.web = null;
    this.lastGGA = null;
    this.method = null; this.base = null; // Sabit Base + Rover seçimi ve base bilgisi
    if (bus) {
      bus.on('native:gnss', (d) => { if (d && d.text) this.feed(d.text); });
      bus.on('native:gnssStatus', (d) => this.onLinkStatus(d));
      bus.on('native:ntrip', (d) => this.onNtrip(d));
      bus.on('native:phone', (d) => this.onPhone(d));
    }
  }
  configure({ crs, geoid, thresholds, antenna } = {}) {
    if (crs) this.crs = crs; if (geoid) this.geoid = geoid;
    if (thresholds) this.thresholds = Object.assign({}, this.thresholds, thresholds);
    if (antenna) this.antenna = Object.assign({}, this.antenna, antenna);
    this.recompute(); this.emit();
  }
  antennaVertical() {
    const a = this.antenna;
    const v = a.measure === 'slant' ? Math.sqrt(Math.max(0, a.height * a.height - a.radius * a.radius)) : a.height;
    return v + (a.pco || 0);
  }
  emit() { if (this.bus) this.bus.emit('gnss:state', this.snapshot()); }
  snapshot() { return Object.assign({}, this.state, { ntrip: Object.assign({}, this.ntrip), label: FIX_LABEL[this.state.fix] || this.state.fix, method: this.methodOf(), base: this.base }); }

  // ------- Kaynaklar -------
  async connectExternal(link) {
    await this.stopAll();
    Object.assign(this.state, EMPTY(), { source: 'external', link, receiver: { name: link.name, address: link.address } });
    this.emit();
    if (link.type === 'web-serial' || link.type === 'web-ble') {
      const mod = await import('../native/bridge.js');
      this.web = link.type === 'web-serial' ? await mod.webSerialConnect(link.baud || 115200, (t) => this.feed(t)) : await mod.webBleConnect((t) => this.feed(t));
      this.state.connected = true; this.emit();
      return;
    }
    await this.bridge.gnssConnect(link);
  }
  onLinkStatus(d) {
    if (!d) return;
    if (d.state === 'connected') { this.state.connected = true; this.state.error = null; }
    if (d.state === 'disconnected' || d.state === 'error') { this.state.connected = false; this.state.fix = 'NONE'; this.state.error = d.error || null; }
    if (this.bus) this.bus.emit('gnss:link', d);
    this.emit();
  }
  async usePhone() {
    await this.stopAll();
    Object.assign(this.state, EMPTY(), { source: 'phone', connected: true, receiver: { name: 'Telefon konum servisi' } });
    this.emit();
    if (this.bridge && this.bridge.isNative()) { await this.bridge.phoneStart({ intervalMs: 1000 }); return; }
    if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('Konum servisi yok');
    this.phoneWatch = navigator.geolocation.watchPosition(
      (p) => this.onPhone({ lat: p.coords.latitude, lon: p.coords.longitude, alt: p.coords.altitude, acc: p.coords.accuracy, vacc: p.coords.altitudeAccuracy, heading: p.coords.heading, speed: p.coords.speed, time: p.timestamp }),
      (e) => { this.state.error = e.code === 1 ? 'Konum izni verilmedi' : 'Konum alınamadı'; this.emit(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
  onPhone(d) {
    if (!d || this.state.source !== 'phone') return;
    const s = this.state;
    Object.assign(s, { lat: d.lat, lon: d.lon, altMSL: d.alt != null ? d.alt - (d.geoidSep || 0) : null, geoidSep: d.geoidSep ?? 0, fix: 'PHONE', sigmaH: d.acc ?? null, sigmaV: d.vacc ?? null, sats: d.satsUsed ?? null, satsInView: d.sats ?? null, heading: d.heading ?? s.heading, lastUpdate: this.now(), sigmaEst: false });
    this.recompute(); this.emit();
  }
  startSimulator(opts = {}) {
    this.stopAll();
    const base = opts.base || { lat: 38.6743, lon: 39.2232, alt: 1067.2 };
    Object.assign(this.state, EMPTY(), { source: 'sim', connected: true, receiver: { name: 'Simülatör', serial: 'SIM-0001' } });
    this.sim = { profile: opts.profile || 'FIX', pos: Object.assign({}, base), t: 0, target: null, hz: opts.hz || 2, heading: 0 };
    this.simTimer = setInterval(() => this.simTick(), 1000 / this.sim.hz);
    this.emit();
  }
  setSimProfile(p) { if (this.sim) this.sim.profile = p; }
  simWalkTo(target) { if (this.sim) this.sim.target = target; } // {lat, lon}
  simTick() {
    const S = this.sim; if (!S) return;
    S.t++;
    const P = { FIX: [4, 0.008, 0.014, 1.2, 28, 1.0], FLOAT: [5, 0.09, 0.13, 1.9, 19, 2.4], SINGLE: [1, 1.8, 3.1, 3.4, 11, null], NONE: [0, 9, 9, 9, 3, null] }[S.profile] || [4, 0.008, 0.014, 1.2, 28, 1.0];
    if (S.target) {
      const k = 111320, kl = k * Math.cos(S.pos.lat * Math.PI / 180);
      const dN = (S.target.lat - S.pos.lat) * k, dE = (S.target.lon - S.pos.lon) * kl, d = Math.hypot(dE, dN);
      const step = Math.min(d, d > 5 ? 0.9 : d > 0.5 ? 0.25 : 0.02);
      if (d > 0.003) { S.pos.lat += (dN / d) * step / k; S.pos.lon += (dE / d) * step / kl; S.heading = (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360; }
    }
    const jit = () => (Math.random() - 0.5) * 2;
    const la = S.pos.lat + (jit() * P[1] * 0.5) / 111320, lo = S.pos.lon + (jit() * P[1] * 0.5) / (111320 * Math.cos(S.pos.lat * Math.PI / 180));
    const d = new Date(this.now());
    const text = [makeGGA(la, lo, S.pos.alt + jit() * P[2] * 0.3, P[0], P[4], P[3] * 0.6, 36.1, P[5], d), makeGST(P[1] / 1.4142, P[1] / 1.4142, P[2], d), makeGSA(P[3], P[3] * 0.6, P[3] * 0.8, Math.min(12, P[4])), withChecksum('GNHDT,' + S.heading.toFixed(1) + ',T')].join('\r\n') + '\r\n';
    this.feed(text);
  }
  async stopAll() {
    if (this.simTimer) { clearInterval(this.simTimer); this.simTimer = null; this.sim = null; }
    if (this.phoneWatch != null && typeof navigator !== 'undefined') { navigator.geolocation.clearWatch(this.phoneWatch); this.phoneWatch = null; }
    if (this.web) { await this.web.close(); this.web = null; }
    if (this.bridge && this.bridge.isNative()) {
      if (this.state.source === 'external') await this.bridge.gnssDisconnect().catch(() => {});
      if (this.state.source === 'phone') await this.bridge.phoneStop().catch(() => {});
    }
    Object.assign(this.state, EMPTY());
    this.emit();
  }

  // ------- NMEA -------
  feed(text) {
    this.stream.push(text);
    this.raw.push(text); this.rawBytes += text.length;
    if (this.rawBytes > 64 * 1024) this.flushRaw();
  }
  flushRaw() {
    if (!this.raw.length) return null;
    const chunk = { text: this.raw.join(''), t1: this.now() };
    this.raw = []; this.rawBytes = 0;
    if (this.bus) this.bus.emit('gnss:raw', chunk);
    return chunk;
  }
  onSentence(s) {
    const st = this.state, t = this.now();
    switch (s.type) {
      case 'GGA': {
        this.lastGGA = s.raw;
        const prevFix = st.fix;
        Object.assign(st, { lat: s.lat, lon: s.lon, altMSL: s.altMSL, geoidSep: s.geoidSep, sats: s.sats, hdop: s.hdop, age: s.age, stationId: s.stationId, fix: s.fix, lastUpdate: t });
        if (st.fix === 'FIX') { if (prevFix !== 'FIX' || !st.fixSince) st.fixSince = t; st.fixSeconds = (t - st.fixSince) / 1000; } else { st.fixSince = null; st.fixSeconds = 0; }
        this.lastGGAt.push(t); if (this.lastGGAt.length > 6) this.lastGGAt.shift();
        if (this.lastGGAt.length >= 2) st.rateHz = (this.lastGGAt.length - 1) / ((this.lastGGAt[this.lastGGAt.length - 1] - this.lastGGAt[0]) / 1000 || 1);
        if (!this.gotGST || t - this.gotGST > 3000) { // GST yoksa HDOP ile tahmin (UERE: FIX 0.01, FLOAT 0.1, diğer 1.5 m)
          const u = { FIX: 0.01, FLOAT: 0.1, DGPS: 0.5 }[st.fix] ?? 1.5;
          st.sigmaH = st.hdop != null ? +(st.hdop * u).toFixed(4) : null; st.sigmaV = st.sigmaH != null ? +(st.sigmaH * 1.7).toFixed(4) : null; st.sigmaEst = true;
        }
        this.recompute(); this.emit();
        if (this.bus) this.bus.emit('gnss:epoch', this.epoch());
        break;
      }
      case 'GST':
        if (s.sLat != null && s.sLon != null) { st.sigmaH = Math.hypot(s.sLat, s.sLon); st.sigmaV = s.sAlt; st.sigmaEst = false; this.gotGST = t; }
        break;
      case 'GSA':
        if (s.pdop != null) { st.pdop = s.pdop; st.vdop = s.vdop; }
        break;
      case 'GSV':
        if (s.msg === 1) { this._gsv = this._gsv || {}; this._gsv[s.talker] = s.inView; st.satsInView = Object.values(this._gsv).reduce((a, b) => a + b, 0); }
        break;
      case 'HDT': st.heading = s.heading; break;
      case 'RMC': if (s.speedKn != null) st.speed = s.speedKn * 0.514444; if (s.course != null) st.course = s.course; break;
      case 'VTG': if (s.course != null) st.course = s.course; break;
      default: break;
    }
  }
  recompute() {
    const st = this.state;
    if (st.lat == null || st.lon == null) return;
    st.hAnt = st.altMSL != null ? st.altMSL + (st.geoidSep || 0) : null;
    st.h = st.hAnt != null ? st.hAnt - (st.source === 'phone' ? 0 : this.antennaVertical()) : null;
    const N = geoidN(st.lat, st.lon, this.geoid, st.geoidSep);
    st.geoidN = N;
    st.H = st.h != null && N != null ? st.h - N : null;
    const p = project(st.lat, st.lon, this.crs, st.h || 0);
    st.E = p.E; st.N = p.N;
  }
  epoch() {
    const s = this.state;
    return { t: s.lastUpdate, lat: s.lat, lon: s.lon, h: s.h, H: s.H, E: s.E, N: s.N, fix: s.fix, sats: s.sats, pdop: s.pdop, hdop: s.hdop, vdop: s.vdop, sigmaH: s.sigmaH, sigmaV: s.sigmaV, age: s.age };
  }
  quality(opts = {}) { return evaluateFix(this.state, this.thresholds, opts); }
  // Ölçüm yöntemi: TELEFON_GPS · HARICI_GNSS · RTK_NTRIP · BASE_ROVER (kullanıcı seçimi yoksa bağlantıdan türetilir)
  methodOf() {
    const s = this.state;
    if (s.source === 'phone') return 'TELEFON_GPS';
    if (s.source === 'sim') return 'SIMULATOR';
    if (s.source === 'none') return null;
    if (this.method === 'BASE_ROVER') return 'BASE_ROVER';
    if (this.ntrip.state === 'connected') return 'RTK_NTRIP';
    return 'HARICI_GNSS';
  }
  setMethod(m, base) { this.method = m || null; if (base !== undefined) this.base = base; this.emit(); }

  // Epok ortalamalı ölçüm: kritik noktada FIX kaybı → ölçüm reddedilir
  // override: kullanıcı kalite uyarısını onayladı (spesifikasyon 7.5) → eşikler uyarıya döner, kayıt "uyarıyla kabul" işaretlenir
  observe({ epochs, critical, timeoutMs = 60000, allowTest = false, override = false } = {}) {
    const need = epochs || this.thresholds.epochs || 5;
    const overrideReasons = override ? this.quality({ critical, allowTest }).reasons : [];
    if (override) { critical = false; allowTest = true; }
    return new Promise((resolve, reject) => {
      const got = [];
      const q0 = this.quality({ critical, allowTest });
      if (!q0.ok) { const e = new Error('ÖLÇÜ KABUL EDİLMEDİ: ' + q0.reasons.join(' · ')); e.code = 'REJECTED'; e.reasons = q0.reasons; return reject(e); }
      const off = this.bus.on('gnss:epoch', (ep) => {
        const q = this.quality({ critical, allowTest });
        if (!q.ok) { off(); clearTimeout(to); const e = new Error('ÖLÇÜ KABUL EDİLMEDİ: ölçüm sırasında ' + q.reasons.join(' · ')); e.code = 'REJECTED'; e.reasons = q.reasons; return reject(e); }
        got.push(ep);
        if (this.bus) this.bus.emit('gnss:observeProgress', { n: got.length, need });
        if (got.length >= need) { off(); clearTimeout(to); resolve(Object.assign(this.buildObservation(got, q), override ? { override: true, overrideReasons, cls: 'UYARILI' } : {})); }
      });
      const to = setTimeout(() => { off(); reject(new Error('Ölçüm zaman aşımı (' + got.length + '/' + need + ' epok)')); }, timeoutMs);
      if (this.state.source === 'phone' && !this.bridge.isNative()) {
        // tarayıcı konum servisi seyrek günceller: mevcut konumu epok say
        for (let i = 0; i < need; i++) this.bus.emit('gnss:epoch', Object.assign(this.epoch(), { t: this.now() + i }));
      }
    });
  }
  buildObservation(eps, q) {
    const a = averageEpochs(eps);
    const s = this.state;
    return Object.assign(a, {
      H: a.h != null && s.geoidN != null ? a.h - s.geoidN : null, geoidN: s.geoidN, geoidModel: this.geoid.model,
      source: s.source, cls: q.cls, warn: q.warn, receiver: s.receiver ? s.receiver.name : null, receiverSerial: s.receiver ? s.receiver.serial || null : null,
      antennaHeight: this.antenna.height, antennaMeasure: this.antenna.measure, antennaVertical: this.antennaVertical(),
      datum: this.crs.datum, crs: this.crs.label, epsg: this.crs.epsg, zone: this.crs.cm, stationId: s.stationId,
      mountpoint: this.ntrip.mount, correctionSource: this.ntrip.state === 'connected' ? 'NTRIP ' + (this.ntrip.mount || '') : this.method === 'BASE_ROVER' && this.base ? 'Sabit base' + (this.base.link ? ' · ' + this.base.link : '') + (this.base.name ? ' · ' + this.base.name : '') : (s.age != null ? 'Alıcı düzeltmesi' : 'Yok'),
      sigmaEst: s.sigmaEst, timestamp: new Date(a.t1).toISOString(),
      // Ölçüm yöntemi + (varsa) sabit base bilgisi: her ölçüm kaydına yazılır
      method: this.methodOf(), base: this.base && this.method === 'BASE_ROVER' ? Object.assign({}, this.base) : null,
      rover: s.receiver ? { name: s.receiver.name || null, address: s.receiver.address || null, serial: s.receiver.serial || null } : null
    });
  }

  // ------- NTRIP -------
  async ntripConnect(cfg) { this.ntrip = Object.assign(this.ntrip, { state: 'connecting', mount: cfg.mount, error: null }); this.emit(); return this.bridge.ntripConnect(cfg); }
  async ntripDisconnect() { await this.bridge.ntripDisconnect().catch(() => {}); this.ntrip.state = 'off'; this.emit(); }
  onNtrip(d) {
    if (!d) return;
    Object.assign(this.ntrip, d);
    this.emit();
  }

  // Aplikasyon hesabı (proje düzleminde)
  stakeout(target, ref) {
    const s = this.state;
    if (s.E == null || !target) return null;
    const cur = { E: s.E, N: s.N };
    const d = dist2(cur, target), az = bearing(cur, target);
    const head = s.heading ?? s.course ?? null;
    let fwd = null, right = null, rel = null;
    if (head != null) { rel = az - head; fwd = d * Math.cos(rel * Math.PI / 180); right = d * Math.sin(rel * Math.PI / 180); }
    return { dist: d, azimuth: az, heading: head, relBearing: rel, forward: fwd, right, dE: target.E - cur.E, dN: target.N - cur.N, dH: target.H != null && s.H != null ? target.H - s.H : null, cur, ref };
  }
}
export { zoneForLon, polar };
