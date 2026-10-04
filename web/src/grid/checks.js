// Otomatik uygunluk kontrolleri (kayıt öncesi ve proje geneli).
// Kodlar: UYUMSUZ · EKSİK VERİ · ÖLÇÜ KABUL EDİLMEDİ · MALZEME EKSİK · UYARI
import { circuitParts } from './lines.js';
import { TRAFO_STATUSES } from '../core/schema.js';

const I = (code, severity, e, message, extra = {}) => Object.assign({ code, severity, entityId: e.id, entityNo: e.no || e.lineNo || e.pointNo || '', message }, extra);

export function checkTransformer(e, cat) {
  const out = [];
  const a = e.attrs || {};
  const post = cat.postType(a.post);
  if (!a.post) out.push(I('EKSİK VERİ', 'error', e, 'Trafo postası tipi seçilmemiş'));
  if (post && !post.noTrafo) {
    const kva = +a.kva || (a.kioskServis && (cat.kiosk(a.kioskServis) || {}).kva) || 0;
    if (!kva) out.push(I('EKSİK VERİ', 'error', e, 'Trafo gücü (kVA) girilmemiş'));
    else if (post.maxKva && (kva > post.maxKva || kva < post.minKva)) out.push(I('UYUMSUZ', 'error', e, kva + ' kVA, ' + post.label + ' için uygun değil (' + post.minKva + '–' + post.maxKva + ' kVA)', { group: 'Trafo' }));
    if (a.post === 'direk') {
      const pt = a.poleTypeId ? cat.poleType(a.poleTypeId) : null;
      if (!pt) out.push(I('EKSİK VERİ', 'error', e, 'Direk tipi trafo için trafo direği seçilmemiş'));
      else {
        const comp = (cat.table('trafoPoleCompat') || []).find((c) => c.pole === pt.name);
        if (comp && kva > comp.maxKva) out.push(I('UYUMSUZ', 'error', e, pt.name + ' trafo direği en fazla ' + comp.maxKva + ' kVA taşır (' + kva + ' kVA seçildi)', { group: 'Trafo' }));
      }
    }
    if (a.kioskServis && a.kva) {
      const k = cat.kiosk(a.kioskServis);
      if (k && k.kva && +a.kva !== k.kva) out.push(I('UYUMSUZ', 'error', e, 'Köşk tipi ' + k.kva + ' kVA trafolu (' + k.label + '), girilen güç ' + a.kva + ' kVA', { group: 'Trafo' }));
    }
    const ts = TRAFO_STATUSES[e.state];
    if (ts && ts.removeOld && !a.oldKva) out.push(I('EKSİK VERİ', 'warn', e, 'Gücü yükseltilen trafoda eski güç (kVA) girilmemiş · demontaj kalemi oluşmaz'));
  }
  return out;
}

export function checkPole(e, cat, roleInfo) {
  const out = [];
  if (!e.group) out.push(I('EKSİK VERİ', 'error', e, 'Direk grubu seçilmemiş'));
  const t = e.typeId ? cat.poleType(e.typeId) : null;
  if (!t) out.push(I('EKSİK VERİ', 'error', e, 'Direk tipi seçilmemiş'));
  if (roleInfo) {
    if (roleInfo.role === 'Z' && (roleInfo.angle == null || !(roleInfo.angle > 0))) out.push(I('EKSİK VERİ', 'error', e, 'Köşe direğinde sapma açısı yok (hat bağlantısını kontrol edin)'));
    if (t && t.role && roleInfo.role && t.role !== roleInfo.role) {
      const alt = cat.poleTypes(t.group).find((x) => x.role === roleInfo.role && x.heightM === t.heightM && x.cls === t.cls);
      out.push(I('UYUMSUZ', 'error', e, 'Rol ' + roleLabel(roleInfo.role) + (roleInfo.angle ? ' (' + roleInfo.angle.toFixed(1) + '°)' : '') + ' ama tip ' + t.name + ' (' + roleLabel(t.role) + ')' + (alt ? ' → öneri: ' + alt.name : ''), { group: 'Direk', suggestTypeId: alt ? alt.id : null }));
    }
  }
  return out;
}
export const roleLabel = (r) => ({ T: 'Taşıyıcı', D: 'Durdurucu', N: 'Nihayet', Z: 'Köşe' }[r] || '—');

export function checkLine(l, cat, ctx = {}) {
  const out = [];
  if (!l.lineType) out.push(I('EKSİK VERİ', 'error', l, 'Hat tipi (AG/OG/AYD/ENH/ABONE) seçilmemiş'));
  if (!(l.circuits || []).length) out.push(I('EKSİK VERİ', 'error', l, 'Hatta iletken/kablo tanımlı değil'));
  for (const c of l.circuits || []) {
    const cp = circuitParts(c, cat);
    if (!cp) { out.push(I('EKSİK VERİ', 'error', l, 'İletken katalogda yok: ' + c.key)); continue; }
    const cond = c.custom ? null : cat.conductor(cp.parts[0].conductor);
    const isOGcond = cond ? (cond.voltage || []).includes('OG') : false;
    if ((c.role === 'OG' || c.role === 'ENH') && cond && !isOGcond) out.push(I('UYUMSUZ', 'error', l, 'OG hatta AG iletkeni seçilmiş (' + c.key + ')', { group: 'Hat' }));
    if ((c.role === 'AG' || c.role === 'AYD' || c.role === 'ABONE') && isOGcond) out.push(I('UYUMSUZ', 'error', l, 'AG devresinde OG iletkeni seçilmiş (' + c.key + ')', { group: 'Hat' }));
    if (l.install === 'yeralti' && cond && cond.kind !== 'KABLO') out.push(I('UYUMSUZ', 'error', l, 'Yeraltı hatta havai iletken seçilmiş (' + c.key + ')', { group: 'Hat' }));
    if (l.install === 'havai' && cond && cond.kind === 'KABLO') out.push(I('UYUMSUZ', 'error', l, 'Havai hatta yeraltı kablosu seçilmiş (' + c.key + ')', { group: 'Hat' }));
    if (cp.parts.some((p) => !p.yd)) out.push(I('MALZEME EKSİK', 'warn', l, c.key + ' için Yeşil Defter servis kodu tanımsız', { group: 'Hat' }));
  }
  if (l.lineType === 'OG' || l.lineType === 'ENH') {
    if ((l.circuits || []).some((c) => c.role !== 'OG' && c.role !== 'ENH') && !l.musterek) out.push(I('UYUMSUZ', 'warn', l, 'OG hatta AG devresi var ama müşterek işaretli değil'));
  }
  if (l.install === 'yeralti') {
    const cb = l.cable || {};
    if (!(cb.depth > 0)) out.push(I('EKSİK VERİ', 'error', l, 'Yeraltı hattında kanal derinliği yok'));
    if (!(cb.width > 0)) out.push(I('EKSİK VERİ', 'error', l, 'Yeraltı hattında kanal genişliği yok'));
    const rules = cat.table('cableRules') || { minDepth: { AG: 0.7, OG: 0.9 } };
    const md = rules.minDepth[l.lineType === 'OG' || l.lineType === 'ENH' ? 'OG' : 'AG'];
    if (cb.depth > 0 && md && cb.depth < md) out.push(I('UYUMSUZ', 'warn', l, 'Kanal derinliği ' + cb.depth + ' m < ' + md + ' m (asgari)'));
  }
  if (l.lineType === 'ABONE' && !l.abonePhase) out.push(I('EKSİK VERİ', 'error', l, 'Abone hattında tek/üç faz seçilmemiş'));
  if ((l.nodes || []).length < 2) out.push(I('EKSİK VERİ', 'error', l, 'Hat en az iki noktadan oluşmalı'));
  return out;
}

export function checkPoint(p, cls) {
  const out = [];
  const critical = !!p.critical;
  if (critical && p.source === 'PHONE') out.push(I('ÖLÇÜ KABUL EDİLMEDİ', 'error', p, 'Kritik nokta telefon GPS ile alınmış (TEST) · RTK FIX ile yeniden ölçülmeli', { group: 'Ölçü' }));
  if (critical && p.source === 'GNSS_RTK' && p.quality && p.quality.fix !== 'FIX') out.push(I('ÖLÇÜ KABUL EDİLMEDİ', 'error', p, 'Kritik nokta RTK FIX değil (' + p.quality.fix + ')', { group: 'Ölçü' }));
  if (p.source === 'SIM') out.push(I('ÖLÇÜ KABUL EDİLMEDİ', 'warn', p, 'Simülatör verisi · gerçek ölçüm değil', { group: 'Ölçü' }));
  if (p.E == null || p.N == null) out.push(I('EKSİK VERİ', 'error', p, 'Koordinat yok'));
  return out;
}

export function checkMaterials(e, mats) {
  const out = [];
  if (!mats.job) return out;
  if (!mats.items.length) out.push(I('MALZEME EKSİK', 'error', e, 'Malzeme reçetesi boş (' + mats.job + ')'));
  for (const m of mats.items) {
    if (m.missing) out.push(I('MALZEME EKSİK', 'error', e, (m.why || 'Kalem') + ' · servis kodu katalogda yok' + (m.servis ? ' (' + m.servis + ')' : ''), { group: 'Malzeme' }));
    if (m.origin !== 'OTO' && !m.approved) out.push(I('UYARI', 'warn', e, 'Onay bekleyen sahada ilave: ' + m.name, { group: 'Malzeme' }));
  }
  if (mats.ctx && mats.ctx.eq === 'pole' && !mats.items.some((m) => m.tag === 'direk')) out.push(I('MALZEME EKSİK', 'error', e, 'Direğin kendisi reçetede yok'));
  return out;
}
