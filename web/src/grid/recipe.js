// Otomatik malzeme reçetesi motoru.
// Reçete = Ekipman tipi + Hat tipi + İletken sınıfı + Rol + İş tipi (Montaj/Demontaj/DMM) kombinasyonundan,
// veritabanındaki kurallar (MaterialRecipe) ile üretilir. Kullanıcı yalnızca miktarı değiştirebilir
// (denetim kaydıyla) veya "sahada ilave" talebi açabilir; elle eklenen kalem reçete sayılmaz.
import { STATUSES, TRAFO_STATUSES } from '../core/schema.js';
import { cabinItems, govdeKalemi } from './cabin-recipe.js';

const ROLN = { T: 'Taşıyıcı', D: 'Durdurucu', N: 'Nihayet', Z: 'Köşe' };

export function jobOf(e) {
  if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') return (TRAFO_STATUSES[e.state] || {}).job || null;
  return (STATUSES[e.state] || {}).job || null;
}

function matchWhen(when, ctx) {
  for (const [k, v] of Object.entries(when || {})) {
    const c = ctx[k];
    if (Array.isArray(v)) { if (!v.includes(c)) return false; }
    else if (typeof v === 'boolean') { if (!!c !== v) return false; }
    else if (v !== c) return false;
  }
  return true;
}
const fill = (tpl, ctx) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined && ctx[k] !== null ? ctx[k] : ''));

export function recipeContext(e, cat, extra = {}) {
  if (e.kind === 'pole' || e.kind === 'lighting') {
    const t = cat.poleType(e.typeId);
    const g = cat.poleGroup(e.group || (t && t.group));
    const cls = (t && t.cls) || '';
    return Object.assign({
      eq: 'pole', group: g ? g.id : e.group, kgGroup: g ? g.kgGroup : '', tip: t ? t.name : '?', self: t ? t.servis : null, kg: t ? t.kg : 0, selfName: t ? (t.label || t.name) : '',
      role: extra.role || 'T', rol: ROLN[extra.role || 'T'], cls, clsBig: cls.includes('477'), clsDbl: cls.startsWith('2x'), agCiplak: !!extra.agCiplak
    }, extra);
  }
  if (e.kind === 'transformer' || e.kind === 'kiosk' || e.kind === 'substation') {
    const a = e.attrs || {};
    const type = a.post || (e.kind === 'substation' ? 'ind' : e.kind === 'kiosk' ? 'mbk' : 'direk');
    const k = a.kioskServis ? cat.kiosk(a.kioskServis) : null;
    const kva = +a.kva || (k && k.kva) || 0;
    const tdType = a.poleTypeId ? cat.poleType(a.poleTypeId) : null;
    return { eq: 'trafo', type, kva, cins: a.cins || 'herm', cinsLabel: a.cins === 'kuru' ? 'kuru tip' : 'hermetik', tdirek: tdType ? tdType.name : '', tdServis: tdType ? tdType.servis : null, tdKg: tdType ? tdType.kg : 0, kioskServis: a.kioskServis || null, kioskLabel: k ? k.label : '' };
  }
  if (e.kind === 'sdk') {
    const t = cat.sdkType((e.attrs || {}).sdkTypeId);
    return { eq: 'sdk', self: t ? t.servis : null, tip: t ? t.name : 'SDK' };
  }
  // Serbest türler (pano, armatür, menhol, diğer): kayıtta seçilen poz (attrs.servis) tek kalem olarak gelir
  const a = e.attrs || {};
  const pz = a.servis ? cat.poz(a.servis) : null;
  return { eq: e.kind, self: a.servis || null, tip: a.typeName || (pz ? pz.name : ''), selfName: pz ? pz.name : '' };
}

// Kural listesini bağlama uygula → malzeme satırları
export function applyRules(rules, ctx, cat, params) {
  const out = [];
  for (const r of rules) {
    if (!matchWhen(r.when, ctx)) continue;
    for (const it of r.items) {
      let servis = it.servis || null, kgPer = null, nameOverride = null;
      if (it.src === 'self') { servis = ctx.self; kgPer = ctx.kg || null; nameOverride = ctx.selfName || null; }
      else if (it.src === 'self:pole') { servis = ctx.tdServis; kgPer = ctx.tdKg || null; }
      else if (it.src === 'self:kiosk') servis = ctx.kioskServis;
      else if (it.src === 'lookup:trafo') { const t = cat.pickTrafo(ctx.type === 'direk' ? 'direk' : 'bina', ctx.cins, ctx.kva); servis = t ? t.servis : null; if (t) ctx.kvaPicked = t.kva; }
      else if (it.src === 'lookup:panoH') { const p = cat.pickPanel('harici', ctx.kva); servis = p ? p.servis : null; }
      else if (it.src === 'lookup:panoD') { const p = cat.pickPanel('dahili', ctx.kva); servis = p ? p.servis : null; }
      let qty = it.qty; const qtyFrom = typeof it.qty === 'string' ? it.qty : 'num';
      if (typeof qty === 'string') qty = qty === '$length' ? (ctx.length || 0) : cat.param(qty, params);
      if (!(qty > 0)) continue;
      const pz = servis ? cat.poz(servis) : null;
      out.push({
        servis, qty: +qty, unit: pz ? pz.unit : (it.unit || 'Ad'), kgPer: kgPer ?? (pz ? pz.kgPerUnit : null),
        name: nameOverride || (pz ? pz.name : '(katalogda yok)'), why: fill(it.why, ctx), grp: fill(it.grp, ctx) || '', tag: it.tag || '', ruleId: r.id, origin: 'OTO', qtyFrom,
        missing: !servis || !pz
      });
    }
  }
  return out;
}

// Ekipmanın tam reçetesi: kurallar + iş tipi filtresi + miktar düzeltmeleri + manuel/sahada ilave kalemler
export function equipmentMaterials(e, cat, opts = {}) {
  const job = jobOf(e);
  const ctx = recipeContext(e, cat, opts.ctx || {});
  const rulesEq = ctx.eq === 'pole' ? 'pole' : ctx.eq;
  let items = job ? applyRules(cat.rules(rulesEq), ctx, cat, opts.params) : [];
  // v2.3 · Kabin: tanımlıysa gövde + hücreler + trafo + pano + kanallar ayrı ayrı; tanımlı değilse monoblok köşkte gövde kalemi eklenir
  if (job && ctx.eq === 'trafo') {
    const a = e.attrs || {};
    if (a.cabin) items = cabinItems(e, cat, ctx, opts.params);
    else if (!items.some((m) => m.tag === 'kosk')) { const g = govdeKalemi(a, ctx.type, cat); if (g) items.unshift(g); }
  }
  // Serbest türlerde kural yoksa seçilen poz otomatik kalemdir
  if (job && !items.length && ctx.self && !['pole', 'trafo', 'sdk'].includes(ctx.eq)) {
    const pz = cat.poz(ctx.self);
    items.push({ servis: ctx.self, qty: +(e.attrs && e.attrs.qty) || 1, unit: pz ? pz.unit : 'Ad', kgPer: pz ? pz.kgPerUnit : null, name: pz ? pz.name : '(katalogda yok)', why: (ctx.tip || 'Seçilen poz'), grp: (pz && pz.kgGroup) || '', tag: 'self', origin: 'OTO', qtyFrom: 'num', missing: !pz });
  }
  // Abone kofresi (v2.3): abone kaydında "kofre var" seçiliyse faz sayısına göre kofre kalemi gelir
  if (job && e.kind === 'subscriber' && e.attrs && e.attrs.kofre) {
    const servis = ((cat.table('cabin') || {}).kofre || {})[e.attrs.phase === 'tek' ? 'tek' : 'uc'] || null;
    const pz = servis ? cat.poz(servis) : null;
    items.push({ servis, qty: 1, unit: pz ? pz.unit : 'Ad', kgPer: null, name: pz ? pz.name : 'Abone kofresi (katalogda yok)', why: 'Abone kofresi · ' + (e.attrs.phase === 'tek' ? 'tek faz' : 'üç faz'), grp: '', tag: 'kofre', origin: 'OTO', qtyFrom: 'num', missing: !pz });
  }
  // Trafo durum filtreleri: gücü yükseltilen → yalnız trafo + pano; tadil/modül → köşk + hücre
  const ts = TRAFO_STATUSES[e.state];
  if (ctx.eq === 'trafo' && ts && ts.only) items = items.filter((m) => ts.only.includes(m.tag));
  // Demontaj / DMM'de topraklama geri alınmaz
  if (job && job !== 'montaj') items = items.filter((m) => m.tag !== 'top');
  // Miktar düzeltmeleri (yalnız reçete kalemleri için; denetim kaydı DataService'te)
  const ov = e.materialOverrides || {};
  for (const m of items) if (m.servis && ov[m.servis] !== undefined) { m.autoQty = m.qty; m.qty = +ov[m.servis]; m.overridden = true; }
  items = items.filter((m) => m.qty > 0);
  // Manuel / sahada ilave kalemler (ayrı işaretli)
  for (const x of opts.manual || []) {
    if (x.status === 'deleted') continue;
    const pz = cat.poz(x.servis);
    items.push({ servis: x.servis, qty: +x.qty, unit: pz ? pz.unit : x.unit || 'Ad', kgPer: pz ? pz.kgPerUnit : null, name: pz ? pz.name : x.name || '(katalogda yok)', why: x.reason || 'Sahada ilave', grp: x.grp || (pz && pz.kgGroup) || '', tag: 'manuel', origin: x.origin || 'MANUEL', materialId: x.id, approved: !!x.approved, missing: !pz });
  }
  // Gücü yükseltilen trafoda eski trafo demontajı
  if (ctx.eq === 'trafo' && ts && ts.removeOld && e.attrs && e.attrs.oldKva) {
    const t = cat.pickTrafo(ctx.type === 'direk' ? 'direk' : 'bina', ctx.cins, +e.attrs.oldKva);
    if (t) items.push({ servis: t.servis, qty: 1, unit: 'Ad', name: (cat.poz(t.servis) || {}).name || t.kva + ' kVA trafo', why: 'Eski trafo demontajı · ' + e.attrs.oldKva + ' kVA', grp: '', tag: 'trafo', origin: 'OTO', jobOverride: 'demontaj' });
  }
  return { job, ctx, items };
}
