// Veri kaynağı takibi — tek kaynak.
// Kayıtta saklanan dahili kod (points.source) + ölçüm kalitesi → spesifikasyon kodu, etiket ve renk.
//   GNSS_RTK | GNSS_FLOAT | TELEFON_GPS | MANUEL | EXCEL | HARITADAN_SECILDI   (+ GNSS_SINGLE, TASARIM, SIMULATOR)
export const SRC = {
  GNSS_RTK: { tag: 'RTK FIX', label: 'GNSS · RTK FIX', color: '#10b981', badge: 'ok', precise: true },
  GNSS_FLOAT: { tag: 'RTK FLOAT', label: 'GNSS · RTK FLOAT', color: '#f59e0b', badge: 'warn', precise: false },
  GNSS_SINGLE: { tag: 'GNSS', label: 'GNSS · düzeltmesiz', color: '#ef4444', badge: 'err', precise: false },
  TELEFON_GPS: { tag: 'TELEFON GPS', label: 'Telefon GPS', color: '#38bdf8', badge: 'cy', precise: false },
  MANUEL: { tag: 'MANUEL', label: 'Manuel koordinat', color: '#fbbf24', badge: 'm', precise: false },
  EXCEL: { tag: 'EXCEL', label: 'Excel (toplu aktarım)', color: '#a3e635', badge: 'mut', precise: false },
  HARITADAN_SECILDI: { tag: 'HARİTA', label: 'Haritadan seçildi', color: '#c084fc', badge: 'mut', precise: false },
  TASARIM: { tag: 'TASARIM', label: 'Tasarım noktası', color: '#eab308', badge: 'm', precise: false },
  SIMULATOR: { tag: 'SİMÜLATÖR', label: 'Simülatör', color: '#a78bfa', badge: 'mut', precise: false }
};
export const SRC_CODES = ['GNSS_RTK', 'GNSS_FLOAT', 'TELEFON_GPS', 'MANUEL', 'EXCEL', 'HARITADAN_SECILDI'];

export function sourceCode(p) {
  if (!p) return 'MANUEL';
  switch (p.source) {
    case 'GNSS_RTK': { const f = p.quality && p.quality.fix; return !f || f === 'FIX' ? 'GNSS_RTK' : f === 'FLOAT' ? 'GNSS_FLOAT' : 'GNSS_SINGLE'; }
    case 'GNSS_FLOAT': return 'GNSS_FLOAT';
    case 'PHONE': case 'TELEFON_GPS': return 'TELEFON_GPS';
    case 'EXCEL': case 'IMPORT': return 'EXCEL';
    case 'MAP': case 'HARITADAN_SECILDI': return 'HARITADAN_SECILDI';
    case 'DESIGN': return 'TASARIM';
    case 'SIM': return 'SIMULATOR';
    default: return 'MANUEL';
  }
}
export function sourceInfo(p) { const code = sourceCode(p); return Object.assign({ code }, SRC[code]); }
export const sourceTag = (p) => '[' + sourceInfo(p).tag + ']';
// "GNSS / RTK FIX · σH 0.008 m" gibi okunur özet
export function sourceText(p) {
  const s = sourceInfo(p), q = (p && p.quality) || null;
  const acc = q && q.sigmaH != null ? ' · ±' + (q.sigmaH >= 1 ? q.sigmaH.toFixed(1) : q.sigmaH.toFixed(3)) + ' m' : '';
  return s.label + acc + (q && q.override ? ' · uyarıyla kabul' : '');
}
