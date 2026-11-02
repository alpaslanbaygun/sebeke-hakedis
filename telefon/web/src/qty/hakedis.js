// Hakediş motoru: Proje → İş Programı → Hakediş Dönemi → Poz → Önceki / Bu dönem / Kümülatif / Kalan.
// Onaylanan dönem dondurulur (anlık görüntü); sonradan değişen miktar bir sonraki dönemde "REVIZYON" kaynağıyla görünür.
import { round } from './metraj.js';

const qkey = (q) => q.job + '|' + (q.servis || 'MAT:' + (q.material || q.name));

// Belirli tarihe kadar tamamlanmış (done) katkıların kümülatifi
export function cumulativeAt(quantities, endDate) {
  const end = endDate ? String(endDate).slice(0, 10) : '9999-12-31';
  const m = new Map();
  for (const q of quantities) {
    let tot = 0; const src = {};
    for (const r of q.refs) {
      if (!r.done) continue;
      const d = (r.workDate || '0000-00-00').slice(0, 10);
      if (d > end) continue;
      tot += r.qty; src[r.source] = (src[r.source] || 0) + r.qty;
    }
    if (tot) m.set(qkey(q), { qty: round(tot, q.unit === 'Kg' ? 2 : 3), sources: src, q });
  }
  return m;
}

export function buildWorkProgram(quantities, opts = {}) {
  return quantities.filter((q) => q.qty > 0).map((q) => ({ key: qkey(q), job: q.job, servis: q.servis, code: q.code, name: q.name, unit: q.unit, contractQty: round(q.qty * (1 + (opts.marginPct || 0) / 100), 3), unitPrice: opts.price ? opts.price(q) : null }));
}

/**
 * Dönem tablosu. Onaylı dönem anlık görüntüden okunur: miktarlar gibi fiyat, tutar ve sözleşme miktarı da onay
 * anındakidir (hata 6); güncel iş programı yalnız açık dönemi etkiler. Eski sürümün fiyatsız görüntüsünde fiyat
 * güncel programdan okunur ve tablo legacyPrices ile işaretlenir; toplam, dönem kaydındaki onay anı toplamıdır.
 * Döner: { period, previousPeriod, lines, totals, frozen, legacyPrices }.
 */
export function periodTable(quantities, program, periods, periodId) {
  const P = periods.filter((p) => p.status !== 'deleted').sort((a, b) => a.no - b.no);
  const period = P.find((p) => p.id === periodId) || P[P.length - 1];
  if (!period) return { period: null, lines: [], totals: { amount: 0, lines: 0, overrun: 0, outOfProgram: 0 }, frozen: false, legacyPrices: false };
  const prev = P.filter((p) => p.no < period.no && p.status === 'onayli').pop();
  const prevMap = new Map(((prev && prev.snapshot) || []).map((l) => [l.key, l]));
  const frozen = period.status === 'onayli' && Array.isArray(period.snapshot);
  const snapMap = new Map(frozen ? period.snapshot.map((l) => [l.key, l]) : []);
  let curMap;
  if (frozen) curMap = new Map(period.snapshot.map((l) => [l.key, { qty: l.cumulative, sources: l.sources || {} }]));
  else curMap = cumulativeAt(quantities, period.end);
  // Revizyon: önceki onaylı dönemin bugünkü canlı değeri anlık görüntüden farklıysa
  const revMap = new Map();
  if (prev && period.status !== 'onayli') {
    const live = cumulativeAt(quantities, prev.end);
    const keys = new Set([...live.keys(), ...prevMap.keys()]);
    for (const k of keys) { const d = ((live.get(k) || {}).qty || 0) - ((prevMap.get(k) || {}).cumulative || 0); if (Math.abs(d) > 1e-6) revMap.set(k, round(d, 3)); }
  }
  const progMap = new Map((program ? program.items : []).map((i) => [i.key, i]));
  const keys = new Set([...progMap.keys(), ...curMap.keys(), ...prevMap.keys()]);
  const qByKey = new Map(quantities.map((q) => [qkey(q), q]));
  const lines = [];
  let legacyPrices = false;
  for (const k of keys) {
    const pi = progMap.get(k), q = qByKey.get(k), cur = curMap.get(k), pv = prevMap.get(k), sn = snapMap.get(k);
    const previous = pv ? pv.cumulative : 0;
    const cumulative = cur ? cur.qty : 0;
    const current = round(cumulative - previous, 3);
    // Onaylı dönemde sözleşme miktarı ve fiyat görüntüden; görüntüde yoksa (eski sürüm) güncel programdan, işaretli
    const priceFrozen = !!(sn && 'unitPrice' in sn);
    if (frozen && !priceFrozen) legacyPrices = true;
    const contract = sn && 'contract' in sn ? sn.contract : pi ? pi.contractQty : 0;
    const src = {};
    if (cur) for (const [s, v] of Object.entries(cur.sources)) src[s] = round(v - ((pv && pv.sources && pv.sources[s]) || 0), 3);
    if (revMap.has(k)) src.REVIZYON = revMap.get(k);
    const unitPrice = priceFrozen ? sn.unitPrice : pi && pi.unitPrice != null ? pi.unitPrice : null;
    const amount = priceFrozen && 'amount' in sn ? sn.amount : unitPrice != null ? round(current * unitPrice, 2) : null;
    const meta = sn && sn.servis !== undefined ? sn : (pi || q || {});
    lines.push({
      key: k, job: (sn || pi || q || {}).job || k.split('|')[0], code: (sn || pi || q || {}).code || '—', servis: meta.servis || null, name: (sn || pi || q || {}).name || k, unit: (sn || pi || q || {}).unit || '',
      contract, previous, current, cumulative, remaining: round(contract - cumulative, 3), overrun: contract > 0 && cumulative > contract + 1e-6, outOfProgram: !pi && !(sn && 'contract' in sn && sn.contract > 0) && cumulative > 0,
      sources: src, cumSources: cur ? Object.assign({}, cur.sources) : {}, unitPrice, amount, priceFrozen
    });
  }
  const order = { montaj: 0, demontaj: 1, dmm: 2 };
  lines.sort((a, b) => order[a.job] - order[b.job] || String(a.code).localeCompare(String(b.code)));
  const liveAmount = round(lines.reduce((s, l) => s + (l.amount || 0), 0), 2);
  // Eski görüntüde satır tutarları güncel fiyatladır; dönemin toplamı onay anında kaydedilen toplamdır (varsa)
  const approvedTotal = frozen && legacyPrices && period.totals && period.totals.amount != null ? period.totals.amount : null;
  const totals = { amount: approvedTotal != null ? approvedTotal : liveAmount, liveAmount, lines: lines.length, overrun: lines.filter((l) => l.overrun).length, outOfProgram: lines.filter((l) => l.outOfProgram).length };
  return { period, previousPeriod: prev || null, lines, totals, frozen, legacyPrices };
}

// Dönemi onayla → anlık görüntü (dondurulur): miktarlar, kaynaklar ve onay anındaki sözleşme miktarı, fiyat, tutar
export function approveSnapshot(table) {
  return table.lines.map((l) => ({
    key: l.key, code: l.code, name: l.name, unit: l.unit, job: l.job, servis: l.servis || null,
    cumulative: l.cumulative, current: l.current, previous: l.previous, sources: Object.assign({}, l.cumSources),
    contract: l.contract, unitPrice: l.unitPrice, amount: l.amount
  }));
}
