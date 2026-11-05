// Proje bazında kanal listesinin Excel sayfaları ve yazım yardımcıları (UI'siz; dışa aktarım ve Kanal listesi ekranı).
// AutoCAD eklentisindeki karşılığı: Cekirdek/KanalListesi.cs › SayfalariEkle (aynı sütunlar).
import SH from '../interop/sh-core.cjs';

export const PROJESIZ = 'Projesi olmayanlar';
export const projeAdi = (p) => (p ? p : PROJESIZ);
export const kaplamaYazisi = (s) => [s.kaplama, s.bariyerli ? 'bariyerli' : '', s.trencher ? 'trencher' : ''].filter(Boolean).join(' · ');
export const numara = (s) => (s.basNo || s.bitNo ? (s.basNo || '…') + ' – ' + (s.bitNo || '…') : '');

/** Excel sayfaları: Kanal Listesi (proje bazında, her projenin altında toplam) ve Kanal Özeti (proje × zemin × durum). */
export function kanalSayfalari(kl) {
  const satirlar = [];
  let i = 0;
  for (const t of kl.projeler) {
    if (t.tumu) continue;
    for (; i < kl.satirlar.length && kl.satirlar[i].proje === t.proje; i++) {
      const s = kl.satirlar[i];
      satirlar.push([projeAdi(t.proje), s.projeKodu, numara(s), s.kablolar, s.cins, s.kaplama, s.bariyerli ? 'Var' : '', s.trencher ? 'Var' : '', s.alt, s.ust, s.derinlik, s.uzunluk, s.hacim, s.durum, s.hakedis, s.zemin]);
    }
    satirlar.push([projeAdi(t.proje) + ' TOPLAMI', t.projeKodu, t.adet + ' kanal', '', '', '', '', '', null, null, null, t.uzunluk, t.hacim, '', null, '']);
  }
  const tumu = kl.projeler[kl.projeler.length - 1];
  satirlar.push(['GENEL TOPLAM', '', tumu.adet + ' kanal', '', '', '', '', '', null, null, null, tumu.uzunluk, tumu.hacim, '', null, '']);
  const sutun = (h, w, fmt) => ({ h, w, fmt });
  return [
    { name: 'Kanal Listesi', title: 'Kanal listesi (proje bazında) · ' + kl.cizimAdi, columns: [sutun('PROJE', 30), sutun('PROJE KODU', 18), sutun('BAŞ – BİT', 18), sutun('KABLOLAR', 10), sutun('CİNS', 14), sutun('KAPLAMA', 12), sutun('BARİYER', 9), sutun('TRENCHER', 9), sutun('ALT (cm)', 9, '0.##'), sutun('ÜST (cm)', 9, '0.##'), sutun('DERİNLİK (cm)', 11, '0.##'), sutun('UZUNLUK (m)', 12, '#,##0.00'), sutun('HACİM (m³)', 12, '#,##0.000'), sutun('DURUM', 8), sutun('HAK. NO', 8, '0'), sutun('KALEM ADI', 36)], rows: satirlar },
    { name: 'Kanal Özeti', title: 'Kanal özeti (proje × zemin × durum) · ' + kl.cizimAdi, columns: [sutun('PROJE', 30), sutun('KALEM ADI', 36), sutun('CİNS · KAPLAMA', 30), sutun('DURUM', 8), sutun('PARÇA', 8, '0'), sutun('UZUNLUK (m)', 12, '#,##0.00'), sutun('HACİM (m³)', 12, '#,##0.000')],
      rows: kl.ozet.map((o) => { const z = SH.kanalZeminiCoz(o.zemin); return [projeAdi(o.proje), o.zemin, z ? SH.kanalZeminiYazi(z) : o.zemin, o.durum, o.adet, o.uzunluk, o.hacim]; }) }
  ];
}
