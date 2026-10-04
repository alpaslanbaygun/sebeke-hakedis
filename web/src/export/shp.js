// ESRI Shapefile yazıcı: SHP + SHX + DBF + PRJ + CPG (PointZ / PolyLineZ), UTF-8 öznitelikler.
import { wkt } from '../geo/crs.js';

function bboxZ(feats, getPts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const ft of feats) for (const p of getPts(ft)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  if (!Number.isFinite(x0)) return [0, 0, 0, 0, 0, 0];
  return [x0, y0, x1, y1, z0, z1];
}
function header(dv, fileLenWords, type, bb) {
  dv.setInt32(0, 9994, false); dv.setInt32(24, fileLenWords, false); dv.setInt32(28, 1000, true); dv.setInt32(32, type, true);
  dv.setFloat64(36, bb[0], true); dv.setFloat64(44, bb[1], true); dv.setFloat64(52, bb[2], true); dv.setFloat64(60, bb[3], true);
  dv.setFloat64(68, bb[4], true); dv.setFloat64(76, bb[5], true); dv.setFloat64(84, 0, true); dv.setFloat64(92, 0, true);
}

// feats: [{geom: [{x,y,z}] (nokta için tek eleman), attrs:{...}}]
export function writeShapefile(kind, feats, fields, crs) {
  const type = kind === 'point' ? 11 : 13;
  const recs = feats.map((ft) => {
    const pts = ft.geom;
    if (type === 11) { const b = new DataView(new ArrayBuffer(4 + 32)); b.setInt32(0, 11, true); b.setFloat64(4, pts[0].x, true); b.setFloat64(12, pts[0].y, true); b.setFloat64(20, pts[0].z || 0, true); b.setFloat64(28, 0, true); return new Uint8Array(b.buffer); }
    const n = pts.length, len = 44 + 4 + 16 * n + 16 + 8 * n + 16 + 8 * n;
    const b = new DataView(new ArrayBuffer(len));
    const bb = bboxZ([ft], (x) => x.geom);
    b.setInt32(0, 13, true); b.setFloat64(4, bb[0], true); b.setFloat64(12, bb[1], true); b.setFloat64(20, bb[2], true); b.setFloat64(28, bb[3], true);
    b.setInt32(36, 1, true); b.setInt32(40, n, true); b.setInt32(44, 0, true);
    let o = 48;
    for (const p of pts) { b.setFloat64(o, p.x, true); b.setFloat64(o + 8, p.y, true); o += 16; }
    b.setFloat64(o, bb[4], true); b.setFloat64(o + 8, bb[5], true); o += 16;
    for (const p of pts) { b.setFloat64(o, p.z || 0, true); o += 8; }
    b.setFloat64(o, 0, true); b.setFloat64(o + 8, 0, true); o += 16;
    for (let k = 0; k < n; k++) { b.setFloat64(o, 0, true); o += 8; }
    return new Uint8Array(b.buffer);
  });
  const bb = bboxZ(feats, (x) => x.geom);
  const shpLen = 100 + recs.reduce((s, r) => s + 8 + r.length, 0);
  const shp = new Uint8Array(shpLen), shx = new Uint8Array(100 + 8 * recs.length);
  const sd = new DataView(shp.buffer), xd = new DataView(shx.buffer);
  header(sd, shpLen / 2, type, bb); header(xd, shx.length / 2, type, bb);
  let off = 100;
  recs.forEach((r, i) => {
    sd.setInt32(off, i + 1, false); sd.setInt32(off + 4, r.length / 2, false); shp.set(r, off + 8);
    xd.setInt32(100 + i * 8, off / 2, false); xd.setInt32(104 + i * 8, r.length / 2, false);
    off += 8 + r.length;
  });
  return { shp, shx, dbf: writeDbf(feats.map((f) => f.attrs), fields), prj: new TextEncoder().encode(wkt(crs)), cpg: new TextEncoder().encode('UTF-8') };
}

// fields: [{name (≤10), type: 'C'|'N', len, dec}]
export function writeDbf(rows, fields) {
  const enc = new TextEncoder();
  const recLen = 1 + fields.reduce((s, f) => s + f.len, 0);
  const hdrLen = 32 + 32 * fields.length + 1;
  const buf = new Uint8Array(hdrLen + recLen * rows.length + 1);
  const dv = new DataView(buf.buffer);
  const d = new Date();
  buf[0] = 0x03; buf[1] = d.getFullYear() - 1900; buf[2] = d.getMonth() + 1; buf[3] = d.getDate();
  dv.setUint32(4, rows.length, true); dv.setUint16(8, hdrLen, true); dv.setUint16(10, recLen, true);
  buf[29] = 0x00; // dil sürücüsü: CPG dosyası UTF-8 bildirir
  fields.forEach((f, i) => {
    const o = 32 + i * 32;
    const nm = enc.encode(f.name.slice(0, 10).toUpperCase());
    buf.set(nm, o); buf[o + 11] = f.type.charCodeAt(0); buf[o + 16] = f.len; buf[o + 17] = f.dec || 0;
  });
  buf[hdrLen - 1] = 0x0d;
  rows.forEach((r, ri) => {
    let o = hdrLen + ri * recLen;
    buf[o++] = 0x20;
    for (const f of fields) {
      let v = r[f.name];
      let bytes;
      if (f.type === 'N') {
        const s = v === null || v === undefined || !Number.isFinite(+v) ? '' : (+v).toFixed(f.dec || 0);
        bytes = enc.encode(s.padStart(f.len).slice(-f.len));
      } else {
        let b = enc.encode(v == null ? '' : String(v));
        if (b.length > f.len) { // UTF-8 çok baytlı karakter bölünmesin
          let cut = f.len; while (cut > 0 && (b[cut] & 0xc0) === 0x80) cut--; b = b.subarray(0, cut);
        }
        bytes = new Uint8Array(f.len).fill(0x20); bytes.set(b);
      }
      buf.set(bytes, o); o += f.len;
    }
  });
  buf[buf.length - 1] = 0x1a;
  return buf;
}

// Proje modelinden katmanlar
export function shapefileLayers(model) {
  const pole = model.equipment.filter((e) => e.E != null);
  const eqFields = [{ name: 'NO', type: 'C', len: 16 }, { name: 'TUR', type: 'C', len: 20 }, { name: 'DURUM', type: 'C', len: 24 }, { name: 'IS', type: 'C', len: 10 }, { name: 'GRUP', type: 'C', len: 40 }, { name: 'TIP', type: 'C', len: 40 }, { name: 'SERVIS', type: 'C', len: 16 }, { name: 'ROL', type: 'C', len: 2 }, { name: 'ACI', type: 'N', len: 10, dec: 3 }, { name: 'BOY', type: 'N', len: 8, dec: 2 }, { name: 'KVA', type: 'N', len: 8, dec: 0 }, { name: 'Y', type: 'N', len: 14, dec: 3 }, { name: 'X', type: 'N', len: 14, dec: 3 }, { name: 'Z', type: 'N', len: 10, dec: 3 }, { name: 'KAYNAK', type: 'C', len: 10 }];
  const eqFeat = pole.map((e) => ({ geom: [{ x: e.E, y: e.N, z: e.H || 0 }], attrs: { NO: e.no, TUR: e.kindLabel, DURUM: e.stateLabel || e.state, IS: e.job || '', GRUP: e.groupLabel || (e.attrs.post || ''), TIP: e.typeName, SERVIS: e.servis, ROL: e.role || '', ACI: e.angle, BOY: e.heightM, KVA: e.attrs.kva || null, Y: e.E, X: e.N, Z: e.H, KAYNAK: e.source || '' } }));
  const lnFields = [{ name: 'NO', type: 'C', len: 12 }, { name: 'AD', type: 'C', len: 40 }, { name: 'TIP', type: 'C', len: 6 }, { name: 'TESIS', type: 'C', len: 8 }, { name: 'DURUM', type: 'C', len: 10 }, { name: 'IS', type: 'C', len: 10 }, { name: 'ILETKEN', type: 'C', len: 80 }, { name: 'UZ2D', type: 'N', len: 12, dec: 3 }, { name: 'UZ3D', type: 'N', len: 12, dec: 3 }];
  const lnFeat = model.lines.filter((l) => l.coords.length >= 2).map((l) => ({ geom: l.coords.map((c) => ({ x: c.E, y: c.N, z: c.H || 0 })), attrs: { NO: l.no, AD: l.name, TIP: l.lineType, TESIS: l.install, DURUM: l.state, IS: l.job || '', ILETKEN: l.label, UZ2D: l.length2D, UZ3D: l.length3D } }));
  const spFields = [{ name: 'HAT', type: 'C', len: 12 }, { name: 'BAS', type: 'C', len: 16 }, { name: 'BIT', type: 'C', len: 16 }, { name: 'UZ2D', type: 'N', len: 12, dec: 3 }, { name: 'UZ3D', type: 'N', len: 12, dec: 3 }, { name: 'DH', type: 'N', len: 10, dec: 3 }, { name: 'SEMT', type: 'N', len: 10, dec: 4 }];
  const spFeat = model.spans.filter((s) => s.a && s.b).map((s) => ({ geom: [{ x: s.a.E, y: s.a.N, z: s.a.H || 0 }, { x: s.b.E, y: s.b.N, z: s.b.H || 0 }], attrs: { HAT: s.lineNo, BAS: s.fromNo, BIT: s.toNo, UZ2D: s.length2D, UZ3D: s.length3D, DH: s.dH, SEMT: s.bearing } }));
  const ptFields = [{ name: 'NO', type: 'C', len: 16 }, { name: 'SINIF', type: 'C', len: 12 }, { name: 'KAYNAK', type: 'C', len: 10 }, { name: 'FIX', type: 'C', len: 8 }, { name: 'SH', type: 'N', len: 8, dec: 3 }, { name: 'SV', type: 'N', len: 8, dec: 3 }, { name: 'Y', type: 'N', len: 14, dec: 3 }, { name: 'X', type: 'N', len: 14, dec: 3 }, { name: 'Z', type: 'N', len: 10, dec: 3 }, { name: 'ENLEM', type: 'N', len: 14, dec: 9 }, { name: 'BOYLAM', type: 'N', len: 14, dec: 9 }];
  const ptFeat = model.points.filter((p) => p.E != null).map((p) => ({ geom: [{ x: p.E, y: p.N, z: p.H || 0 }], attrs: { NO: p.no, SINIF: p.cls, KAYNAK: p.source, FIX: p.fix || '', SH: p.sigmaH, SV: p.sigmaV, Y: p.E, X: p.N, Z: p.H, ENLEM: p.lat, BOYLAM: p.lon } }));
  return [
    { name: 'ekipman', kind: 'point', feats: eqFeat, fields: eqFields },
    { name: 'hatlar', kind: 'line', feats: lnFeat, fields: lnFields },
    { name: 'acikliklar', kind: 'line', feats: spFeat, fields: spFields },
    { name: 'olcu_noktalari', kind: 'point', feats: ptFeat, fields: ptFields }
  ].filter((l) => l.feats.length);
}
