// GNSS ölçüm kabul kuralları. Telefon GPS ile harici GNSS kesin olarak ayrılır.
// Sonuç sınıfları: RTK (teslim edilebilir) · TEST (telefon / düşük doğruluk) · SIM (simülatör) · RED

export const DEFAULT_THRESHOLDS = { minSats: 10, maxPdop: 3.0, maxSigmaH: 0.02, maxSigmaV: 0.03, maxAge: 5, minFixSeconds: 5, epochs: 5 };

export function evaluateFix(st, th = DEFAULT_THRESHOLDS, opts = {}) {
  const critical = !!opts.critical;
  const reasons = [];
  const warn = [];
  if (!st || !st.lat) return { ok: false, cls: 'RED', reasons: ['Konum yok'], warn };
  if (st.source === 'phone') {
    if (critical && !opts.allowTest) return { ok: false, cls: 'TEST', reasons: ['Telefon GPS (±' + (st.sigmaH ?? '?') + ' m) · kritik nokta RTK FIX olmadan alınamaz'], warn };
    return { ok: true, cls: 'TEST', reasons: [], warn: ['Telefon GPS · TEST / DÜŞÜK DOĞRULUK olarak kaydedilir'] };
  }
  if (st.source === 'sim') warn.push('Simülatör verisi · teslim paketine gerçek ölçüm olarak girmez');
  const cls = st.source === 'sim' ? 'SIM' : 'RTK';
  if (st.fix !== 'FIX') {
    if (critical) reasons.push('RTK FIX yok (' + (st.fix || 'NONE') + ')');
    else warn.push('RTK FIX değil (' + st.fix + ') · detay noktası olarak kaydedilir');
  }
  if (st.sats != null && st.sats < th.minSats) (critical ? reasons : warn).push('Uydu ' + st.sats + ' < ' + th.minSats);
  if (st.pdop != null && st.pdop > th.maxPdop) (critical ? reasons : warn).push('PDOP ' + st.pdop.toFixed(1) + ' > ' + th.maxPdop);
  if (st.sigmaH == null) warn.push('σH yok (alıcı GST göndermiyor) · HDOP ile tahmin');
  else if (st.sigmaH > th.maxSigmaH) (critical ? reasons : warn).push('σH ' + st.sigmaH.toFixed(3) + ' > ' + th.maxSigmaH.toFixed(3) + ' m');
  if (st.sigmaV != null && st.sigmaV > th.maxSigmaV) (critical ? reasons : warn).push('σV ' + st.sigmaV.toFixed(3) + ' > ' + th.maxSigmaV.toFixed(3) + ' m');
  if (st.fix === 'FIX' || st.fix === 'FLOAT') {
    if (st.age == null) warn.push('RTCM yaşı bilinmiyor');
    else if (st.age > th.maxAge) (critical ? reasons : warn).push('RTCM yaşı ' + st.age.toFixed(1) + ' s > ' + th.maxAge + ' s');
  }
  if (critical && st.fix === 'FIX' && th.minFixSeconds > 0) {
    const fs = st.fixSeconds ?? 0;
    if (fs < th.minFixSeconds) reasons.push('FIX süresi ' + fs.toFixed(0) + ' s < ' + th.minFixSeconds + ' s');
  }
  return { ok: reasons.length === 0, cls: reasons.length ? 'RED' : cls, reasons, warn };
}

// Epok ortalaması + dağılım istatistiği (proje düzleminde)
export function averageEpochs(epochs) {
  const n = epochs.length;
  if (!n) return null;
  const m = (k) => epochs.reduce((s, e) => s + e[k], 0) / n;
  const sd = (k, mu) => (n > 1 ? Math.sqrt(epochs.reduce((s, e) => s + (e[k] - mu) ** 2, 0) / (n - 1)) : 0);
  const E = m('E'), N = m('N'), h = m('h'), lat = m('lat'), lon = m('lon');
  const worst = (k, f) => epochs.reduce((a, e) => (e[k] == null ? a : a == null ? e[k] : f(a, e[k])), null);
  const fixes = [...new Set(epochs.map((e) => e.fix))];
  return {
    lat, lon, h, E, N, epochs: n, stdE: sd('E', E), stdN: sd('N', N), stdH: sd('h', h),
    spreadH: Math.hypot(sd('E', E), sd('N', N)),
    sigmaH: worst('sigmaH', Math.max), sigmaV: worst('sigmaV', Math.max), pdop: worst('pdop', Math.max), hdop: worst('hdop', Math.max), vdop: worst('vdop', Math.max), sats: worst('sats', Math.min), age: worst('age', Math.max),
    fix: fixes.length === 1 ? fixes[0] : fixes.includes('FLOAT') ? 'FLOAT' : fixes.join('/'),
    t0: epochs[0].t, t1: epochs[n - 1].t, duration: (epochs[n - 1].t - epochs[0].t) / 1000
  };
}
