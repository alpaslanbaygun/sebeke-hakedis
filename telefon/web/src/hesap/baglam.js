// Hesap Merkezi bağlamı (ortak/hesap/BAGLAM.md, sürüm 1): telefondaki projeden seçili direğin, hattın, trafonun ya
// da kanalın hesaplara giden bilgileri. Yalnız projede gerçekten olan bilgi verilir; bilinmeyen alan null olur
// (hesap sayfası onu "eksik" diye işaretler, kullanıcı girer). Sayılar yuvarlanır (uzunluk ve kot 0,01 m, açı 0,01°)
// ki aynı proje her açılışta aynı bağlamı versin ve "güncel değil" uyarısı yalnız gerçek değişiklikte çıksın.
import { circuitParts } from '../grid/lines.js';
import { ruling } from '../../../../ortak/hesap/kurallar.mjs';

const r2 = (v) => (v == null || !Number.isFinite(+v) ? null : Math.round(+v * 100) / 100);
const ZONE = { I: '1', II: '2', III: '3', IV: '4', V: '5', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
const MALZEME = { beton: 'beton', beton562: 'beton', agac: 'agac', sehir: 'demir', mus: 'demir', bahh: 'demir', civ: 'demir', ayd: 'demir', trafo: 'demir' };
const DIREK_TURU = { sehir: 'AG', beton: 'AG', agac: 'AG', mus: 'MUSTEREK', bahh: 'OG', civ: 'OG', beton562: 'OG', ayd: 'AYD', trafo: 'TRAFO' };
const ROL = { T: 'T', D: 'D', N: 'N', Z: 'K' };
const KOSK_POST = { mbk: 'Prefabrik beton köşk', rbk: 'Prefabrik beton köşk (RMU)', mono: 'Monoblok köşk', bina: 'Bina tipi trafo', ba: 'Bina altı trafo', mod: 'Modüler trafo binası (MOD)', dapt: 'Prefabrik dağıtım (DAPT)', direk: 'Direk tipi trafo', kule: 'Kule tipi trafo', kulec: 'Kule çıkışlı trafo', mrmu: 'RMU / MRMU', ind: 'İndirici / dağıtım merkezi' };

const isoGun = (d) => { try { return new Date(d).toISOString().slice(0, 10); } catch (e) { return null; } };

/** Noktanın kotu: haritadan seçilen ya da kotsuz noktalarda null. */
function kotOf(p) {
  if (!p || p.source === 'MAP') return null;
  const h = p.H != null ? p.H : null;
  return h == null ? null : r2(h);
}

function hatTuru(l) {
  const roller = new Set((l.circuits || []).map((c) => (c.role === 'ENH' ? 'OG' : c.role)));
  const yer = l.install === 'yeralti';
  if (l.lineType === 'AYD') return yer ? 'AG_YERALTI' : 'AYDINLATMA';
  if (l.lineType === 'ABONE') return yer ? 'AG_YERALTI' : 'AG_HAVAI';
  if (!yer && roller.has('OG') && (roller.has('AG') || roller.has('AYD'))) return 'MUSTEREK';
  if (l.lineType === 'OG' || l.lineType === 'ENH') return yer ? 'OG_YERALTI' : 'OG_HAVAI';
  return yer ? 'AG_YERALTI' : 'AG_HAVAI';
}

function gerilimKV(l) {
  if (l.voltageKV) return +l.voltageKV;
  if (l.lineType === 'OG' || l.lineType === 'ENH') return null;
  return 0.4;
}

function iletkenler(l, cat) {
  return (l.circuits || []).map((c) => {
    const p = circuitParts(c, cat);
    return { ad: p ? p.label : c.key, adet: Math.max(1, c.count || 1), devre: c.role === 'OG' || c.role === 'ENH' ? 'OG' : 'AG' };
  });
}

export class BaglamKurucu {
  constructor(ps, opts = {}) {
    this.ps = ps;
    this.cat = ps.cat;
    this.r = ps.result;
    this.kullanici = opts.kullanici || null;
  }

  proje() {
    const p = this.ps.p || {};
    const ad = this.kullanici && this.kullanici !== 'Operatör' ? this.kullanici : null;
    return {
      ad: p.name || null, kod: p.code || null, yapan: ad, unvan: null, firma: p.contractor || null,
      tarih: isoGun(Date.now()), buzBolgesi: p.enhZone ? ZONE[String(p.enhZone).toUpperCase()] || null : null
    };
  }

  /** Noktadaki direk / aydınlatma direği (yoksa başka bir ekipman). */
  direkAt(pointId) {
    const eqs = this.ps.eqAt(pointId) || [];
    return eqs.find((e) => e.kind === 'pole') || eqs.find((e) => e.kind === 'lighting') || eqs[0] || null;
  }

  direkOzeti(e, p) {
    if (!e) return { id: null, no: p ? p.pointNo : null, tip: null, malzeme: null, rol: null, aci: null, kot: kotOf(p), yukseklik: null, baglanti: null };
    const t = this.cat.poleType(e.typeId);
    const g = (t && t.group) || e.group || null;
    const ri = (this.r.roles && this.r.roles.get(e.id)) || {};
    const a = e.attrs || {};
    return {
      id: e.id, no: e.no || (p && p.pointNo) || null,
      tip: t ? t.name : null, malzeme: e.kind === 'pole' ? MALZEME[g] || null : e.kind === 'lighting' ? 'demir' : null,
      rol: ROL[ri.role] || null, aci: ri.angle != null ? r2(ri.angle) : null,
      kot: kotOf(p), yukseklik: r2(a.heightM != null ? a.heightM : t && t.heightM),
      baglanti: a.attachH != null ? r2(a.attachH) : null
    };
  }

  /** Hattın açıklıkları (sırayla) ve düğüm direkleri. */
  hat(l) {
    if (!l) return null;
    const pts = (l.nodes || []).map((id) => this.ps.pointById(id));
    const direkler = pts.map((p) => (p ? this.direkOzeti(this.direkAt(p.id), p) : null)).filter(Boolean);
    const spans = (this.r.spans || []).filter((s) => s.lineId === l.id).sort((a, b) => a.seq - b.seq);
    const no = (pid, yedek) => { const e = this.direkAt(pid); return (e && e.no) || yedek; };
    const acikliklar = spans.map((s) => {
      const pa = this.ps.pointById(s.fromId), pb = this.ps.pointById(s.toId);
      const ka = kotOf(pa), kb = kotOf(pb);
      return {
        bas: no(s.fromId, s.fromNo), bit: no(s.toId, s.toNo), uzunluk: r2(s.length2D),
        uzunluk3B: ka != null && kb != null ? r2(s.length3D) : null, dH: ka != null && kb != null ? r2(kb - ka) : null
      };
    });
    const toplam = acikliklar.reduce((t, a) => t + (a.uzunluk || 0), 0);
    return {
      id: l.id, no: l.lineNo || null, tur: hatTuru(l), havai: l.install !== 'yeralti', gerilimKV: gerilimKV(l),
      iletkenler: iletkenler(l, this.cat), direkler, acikliklar, toplamUzunluk: r2(toplam), ruling: r2(ruling(acikliklar))
    };
  }

  /** Direkten çıkan hat parçaları (kollar). */
  kollar(e) {
    const p = this.ps.pointById(e.pointId);
    const out = [];
    for (const l of this.ps.data.lines) {
      if (l.status === 'deleted') continue;
      const nodes = l.nodes || [];
      nodes.forEach((pid, i) => {
        if (pid !== e.pointId) return;
        for (const j of [i - 1, i + 1]) {
          if (j < 0 || j >= nodes.length) continue;
          const q = this.ps.pointById(nodes[j]);
          if (!p || !q) continue;
          const sp = (this.r.spans || []).find((s) => s.lineId === l.id && ((s.fromId === pid && s.toId === nodes[j]) || (s.toId === pid && s.fromId === nodes[j])));
          if (!sp) continue;
          const yon = sp.fromId === pid ? sp.bearing : (sp.bearing + 180) % 360;
          const ka = kotOf(p), kb = kotOf(q);
          const ke = this.direkAt(q.id);
          const ko = this.direkOzeti(ke, q);
          out.push({
            yon: r2(yon), aciklik: r2(sp.length2D), aciklik3B: ka != null && kb != null ? r2(sp.length3D) : null, dH: ka != null && kb != null ? r2(kb - ka) : null,
            karsi: { id: ko.id, no: ko.no, tip: ko.tip, rol: ko.rol, kot: ko.kot },
            hatId: l.id, hatNo: l.lineNo || null, hatTur: hatTuru(l), gerilimKV: gerilimKV(l), iletkenler: iletkenler(l, this.cat)
          });
        }
      });
    }
    return out;
  }

  direk(e) {
    const p = this.ps.pointById(e.pointId);
    const t = this.cat.poleType(e.typeId);
    const g = (t && t.group) || e.group || null;
    return Object.assign(this.direkOzeti(e, p), {
      tur: e.kind === 'lighting' ? 'AYD' : DIREK_TURU[g] || null,
      rolKaynagi: e.roleManual ? 'kullanici' : 'geometri',
      durum: e.state || null,
      kollar: this.kollar(e)
    });
  }

  trafo(e) {
    const a = e.attrs || {};
    const v = String(a.voltage || '').match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
    const kosk = e.kind === 'kiosk' || e.kind === 'substation';
    const post = a.post || (kosk ? 'mbk' : null);
    let tip = KOSK_POST[post] || (kosk ? 'Köşk' : 'Trafo');
    if (a.kva) tip += ' · ' + (a.adet > 1 ? a.adet + 'x' : '1x') + a.kva + ' kVA';
    return {
      id: e.id, no: e.no || null, tip, post, gucKVA: a.kva ? +a.kva : null,
      ogKV: v ? +v[1].replace(',', '.') : null, agKV: v ? +v[2].replace(',', '.') : 0.4,
      uk: a.uk != null ? +a.uk : null, pcu: a.pcu != null ? +a.pcu : null, adet: a.adet ? +a.adet : 1
    };
  }

  kanal(l) {
    const c = l.cable || {};
    const uz = (this.r.lineInfo && this.r.lineInfo.get(l.id)) || {};
    return {
      id: l.id, no: l.lineNo || null, uzunluk: r2(uz.length2D), zemin: c.surface || null,
      genislik: c.width ? r2(c.width * 100) : null, derinlik: c.depth ? r2(c.depth * 100) : null,
      yontem: c.method || null, kablolar: iletkenler(l, this.cat)
    };
  }

  /** Hattın açıklıklarından baştan uca zincir (gerilim düşümü, kısa devre). */
  zincir(l, devre) {
    const h = this.hat(l);
    if (!h) return [];
    const il = h.iletkenler.find((x) => !devre || x.devre === devre) || h.iletkenler[0] || null;
    return h.acikliklar.map((a) => ({ bas: a.bas, bit: a.bit, uzunluk: a.uzunluk, iletken: il, havai: h.havai }));
  }

  /** Bir hattın trafo ucunda başladığı yöne çevrilmiş kopyası (zincir trafodan uca doğru olsun). */
  trafodanBaslat(l) {
    const nodes = l.nodes || [];
    if (nodes.length < 2) return l;
    const tr = (pid) => (this.ps.eqAt(pid) || []).some((e) => e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation');
    if (!tr(nodes[0]) && tr(nodes[nodes.length - 1])) return Object.assign({}, l, { nodes: nodes.slice().reverse(), _ters: true });
    return l;
  }

  /**
   * Hedef için bağlam. hedef: { tur: 'direk'|'hat'|'trafo'|'kanal'|'proje', id, hatId? (trafo için seçilen çıkış) }
   */
  kur(hedef) {
    const b = { surum: 1, kaynak: 'telefon', proje: this.proje(), hedef: { tur: (hedef && hedef.tur) || 'proje', id: (hedef && hedef.id) || '', no: '', ad: '' } };
    if (!hedef || !hedef.tur || hedef.tur === 'proje') { b.hedef.ad = 'Proje geneli'; return b; }
    if (hedef.tur === 'direk') {
      const e = this.ps.eqById(hedef.id);
      if (!e) return b;
      b.direk = this.direk(e);
      b.hedef.no = b.direk.no || ''; b.hedef.ad = (b.direk.tip ? b.direk.tip + ' ' : '') + 'direk';
      // direğin üzerindeki havai hat (ilk havai kolun hattı)
      const kol = b.direk.kollar.find((k) => /HAVAI|MUSTEREK|AYDINLATMA/.test(k.hatTur)) || b.direk.kollar[0];
      if (kol) b.hat = this.hat(this.ps.lineById(kol.hatId));
      return b;
    }
    if (hedef.tur === 'hat' || hedef.tur === 'kanal') {
      let l = this.ps.lineById(hedef.id);
      if (!l) return b;
      l = this.trafodanBaslat(l);
      b.hat = this.hat(l);
      b.hedef.no = b.hat.no || ''; b.hedef.ad = b.hat.iletkenler.map((x) => x.ad).join(' + ');
      b.zincir = this.zincir(l, b.hat.tur.startsWith('OG') ? 'OG' : b.hat.tur === 'MUSTEREK' ? null : 'AG');
      if (l.install === 'yeralti') b.kanal = this.kanal(l);
      // zincirin başındaki trafo
      const bas = (this.ps.eqAt(l.nodes[0]) || []).find((e) => e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation');
      if (bas) b.trafo = this.trafo(bas);
      if (hedef.tur === 'kanal') b.hedef.tur = 'kanal';
      return b;
    }
    if (hedef.tur === 'trafo') {
      const e = this.ps.eqById(hedef.id);
      if (!e) return b;
      b.trafo = this.trafo(e);
      b.hedef.no = b.trafo.no || ''; b.hedef.ad = b.trafo.tip;
      if (hedef.hatId) b.hedef.hatId = hedef.hatId; // seçilen çıkış: kayıt bu çıkışa ait olur
      if (hedef.hatId) {
        const l = this.trafodanBaslat(this.ps.lineById(hedef.hatId));
        if (l) { b.hat = this.hat(l); b.zincir = this.zincir(l, b.hat.tur.startsWith('OG') ? 'OG' : 'AG'); }
      }
      return b;
    }
    return b;
  }

  /** Trafonun çıkış hatları (AG / OG): kullanıcı hangi kolun hesaplanacağını seçer. */
  trafoCikislari(e) {
    return this.ps.data.lines.filter((l) => l.status !== 'deleted' && (l.nodes || []).length > 1 && (l.nodes[0] === e.pointId || l.nodes[l.nodes.length - 1] === e.pointId));
  }
}

export function baglamKur(ps, hedef, opts) { return new BaglamKurucu(ps, opts).kur(hedef); }
