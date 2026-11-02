// AutoCAD hakediş numarası (1, 2, 3…): telefondaki obje hangi hakedişe yazılır. AutoCAD dosyasına aktarımda
// (interop/sebeke.js) ve hakediş yetkisi kilidinde (services/project-service.js › editLock) aynı kural kullanılır.
import { hakOf } from './schema.js';

/** Aktif hakediş: açık (taslak) dönem varsa onun numarası; yoksa son dönemin bir sonrası; dönem yoksa 1. */
export function aktifHakedis(periods) {
  const ps = (periods || []).filter((p) => p.status !== 'deleted');
  if (!ps.length) return 1;
  const taslak = ps.filter((p) => p.status === 'taslak').sort((a, b) => b.no - a.no)[0];
  return taslak ? taslak.no : Math.max(...ps.map((p) => p.no)) + 1;
}

/** Objenin hakediş numarası: AutoCAD'den geldiyse oradaki; hakedişe girdiyse iş tarihinin düştüğü dönem; yoksa aktif hakediş. */
export function objeHakedisi(rec, periods, aktif) {
  if (rec.sebeke && rec.sebeke.hakedis) return rec.sebeke.hakedis;
  const h = hakOf(rec);
  if (h === 'HAKEDISTE' || h === 'ONAYLI') {
    const d = (rec.workDate || '').slice(0, 10);
    const per = (periods || []).filter((p) => p.status !== 'deleted' && (!d || ((!p.start || p.start <= d) && (!p.end || d <= p.end)))).sort((a, b) => a.no - b.no)[0];
    if (per) return per.no;
  }
  return aktif == null ? aktifHakedis(periods) : aktif;
}
