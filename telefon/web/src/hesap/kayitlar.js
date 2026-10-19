// Hesap kayıtları (ortak/hesap/BAGLAM.md › Kayıt): projenin documents tablosunda kind 'HESAP'. Aynı hedefte aynı
// hesap için bir güncel kayıt tutulur; yeniden kaydetmek üzerine yazar. Kayıtlar proje yedeğiyle (.volt.json),
// bulut eşitlemesiyle ve AutoCAD proje dosyasıyla (.sebeke.json › hesaplar) taşınır.
import MODULLER from '../../../../ortak/hesap/moduller.json' with { type: 'json' };
import { farklar } from '../../../../ortak/hesap/kurallar.mjs';
import { baglamKur } from './baglam.js';

export const MODUL = new Map(MODULLER.moduller.map((m) => [m.id, m]));
export const GRUPLAR = MODULLER.gruplar;
export const DURUM_ADI = { uygun: 'Uygun', 'uygun-degil': 'Uygun değil', bilgi: 'Bilgi' };
export const HEDEF_ADI = { direk: 'Direk', hat: 'Hat', trafo: 'Trafo', kanal: 'Kanal', proje: 'Proje' };

export function hesapKayitlari(ps) {
  return (ps.data.documents || []).filter((d) => d.kind === 'HESAP' && d.status !== 'deleted')
    .sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')));
}

// Aynı hedefte hesap başına bir güncel kayıt; trafoda her çıkış (hatId) ayrı sayılır. AutoCAD'deki kural (HesapKaydi.Anahtar) ile aynı.
const hedefAnahtari = (h) => ((h && h.tur) || 'proje') + '|' + ((h && h.id) || '') + '|' + ((h && h.hatId) || '');

/** Hedefteki kayıt; kolsuz: trafoda çıkış (hatId) ayrımı yapılmaz (liste rozetleri için). */
export function kayitBul(ps, modul, hedef, kolsuz) {
  const k = hedefAnahtari(hedef);
  const kk = hedefAnahtari(Object.assign({}, hedef, { hatId: '' }));
  return hesapKayitlari(ps).find((d) => d.modul === modul && (hedefAnahtari(d.hedef) === k || (kolsuz && hedefAnahtari(Object.assign({}, d.hedef, { hatId: '' })) === kk))) || null;
}

/** Hedefin bütün kayıtları (trafoda bütün çıkışlar dâhil). */
export function hedefKayitlari(ps, hedef) {
  const k = hedefAnahtari(Object.assign({}, hedef, { hatId: '' }));
  return hesapKayitlari(ps).filter((d) => hedefAnahtari(Object.assign({}, d.hedef, { hatId: '' })) === k);
}

/** Hedef hâlâ projede mi? */
export function hedefVar(ps, h) {
  if (!h || !h.tur || h.tur === 'proje') return true;
  if (h.tur === 'direk' || h.tur === 'trafo') { const e = ps.eqById(h.id); return !!(e && e.status !== 'deleted'); }
  const l = ps.lineById(h.id); return !!(l && l.status !== 'deleted');
}

/** Güncellik: { hedefYok } ya da { farklar: [...] } (boş dizi = güncel). */
export function guncellik(ps, kayit, kullanici) {
  if (!hedefVar(ps, kayit.hedef)) return { hedefYok: true, farklar: [] };
  const b = baglamKur(ps, kayit.hedef, { kullanici });
  return { farklar: farklar(kayit.kullanilan || {}, b, { platformlarArasi: !!kayit.kaynak && kayit.kaynak !== 'telefon' }) };
}

/** Köprüden gelen kaydı yazar (yeni ya da güncelleme). Döner: kayıt kimliği. */
export async function hesapKaydet(ps, veri, kullanici) {
  const hedef = Object.assign({ tur: 'proje', id: '', no: '' }, veri.hedef || {});
  const mevcut = (veri.kayitId && hesapKayitlari(ps).find((d) => d.id === veri.kayitId)) || kayitBul(ps, veri.modul, hedef);
  const m = MODUL.get(veri.modul) || {};
  const rec = {
    projectId: ps.p.id, kind: 'HESAP', modul: veri.modul, modulAdi: veri.modulAdi || m.ad || veri.modul, modulSurumu: veri.modulSurumu || '',
    hedef, ozet: String(veri.ozet || ''), durum: veri.durum === 'uygun değil' ? 'uygun-degil' : veri.durum || 'bilgi',
    ayrinti: veri.ayrinti || {}, modulDurumu: typeof veri.modulDurumu === 'string' ? veri.modulDurumu : JSON.stringify(veri.modulDurumu || null),
    kullanilan: veri.kullanilan || {}, tarih: new Date().toISOString(), kaynak: 'telefon', yapan: kullanici || '',
    name: (m.kisa || veri.modulAdi || veri.modul) + (hedef.no ? ' · ' + hedef.no : '')
  };
  const neden = (mevcut ? 'Hesap güncellendi: ' : 'Hesap kaydedildi: ') + rec.name;
  let id;
  if (mevcut) { await ps.ds.update('documents', mevcut.id, rec, { reason: neden, silent: true, noAudit: true }); id = mevcut.id; }
  else { const r = await ps.ds.create('documents', rec, { reason: neden, silent: true, noAudit: true }); id = r.id; }
  await ps.reload('documents');
  ps.bus.emit('hesap:kayit', { id, modul: rec.modul, hedef });
  return id;
}

export async function hesapSil(ps, id) {
  await ps.ds.remove('documents', id, { reason: 'Hesap kaydı silindi', silent: true, noAudit: true });
  await ps.reload('documents');
  ps.bus.emit('hesap:kayit', { id, silindi: true });
}

/** Rapor ve dışa aktarım için düz satırlar. */
export function kayitSatirlari(ps, kullanici) {
  return hesapKayitlari(ps).map((k) => {
    const g = guncellik(ps, k, kullanici);
    const liste = (ad) => ((k.ayrinti || {})[ad] || []).map((x) => (typeof x === 'string' ? x : x.ad + (x.deger !== undefined && x.deger !== '' ? ' = ' + (typeof x.deger === 'number' ? x.deger.toLocaleString('tr-TR', { maximumFractionDigits: 3 }) : x.deger) : '') + (x.birim ? ' ' + x.birim : '')));
    return {
      kayit: k, hesap: k.modulAdi, hedef: (HEDEF_ADI[(k.hedef || {}).tur] || '') + ((k.hedef || {}).no ? ' ' + k.hedef.no : '') + ((k.hedef || {}).hatId ? ' · çıkış ' + (((ps.lineById(k.hedef.hatId) || {}).lineNo) || '?') : ''),
      ozet: k.ozet, durum: DURUM_ADI[k.durum] || k.durum, guncel: g.hedefYok ? 'Hedef silinmiş' : g.farklar.length ? 'Güncel değil (' + g.farklar.length + ' bilgi değişti)' : 'Güncel',
      tarih: k.tarih, kaynak: k.kaynak === 'autocad' ? 'AutoCAD' : 'Telefon', girdiler: liste('girdiler'), degerler: liste('degerler'), uyarilar: liste('uyarilar')
    };
  });
}
