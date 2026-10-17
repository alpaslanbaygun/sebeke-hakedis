// Önizleme ve ekran görüntüleri için örnek saha projesi üretir (uydurma veri, gerçek proje değildir).
// Elazığ civarında (TM 39) küçük bir AG şebekesi: yeni direkler, mevcut ve sökülecek hat, trafo,
// box, yeraltı kablosu ve kanalı, aydınlatma, rekortmanlar ve iki bölge.
'use strict';
const fs = require('fs');
const path = require('path');
const SH = require(path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'ui', 'sh-core.js'));

function uret() {
  const katalog = SH.katalogHazirla(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ortak', 'katalog', 'kalemler.json'), 'utf8')), null);
  const bul = (cins, tanim) => {
    const it = katalog.find(x => x.cins === cins && x.tanim === tanim);
    if (!it) throw new Error('katalogda yok: ' + cins + ' ' + tanim);
    return it;
  };
  const p = SH.yeniProje({ ad: 'Örnek Mahallesi AG Şebekesi', dom: 39, hakedis: 2, katmanOnEki: 'SC' });
  p.proje.kaynak = 'önizleme';
  const [E0, N0] = SH.tmIleri(38.6745, 39.2235, 39);
  const e0 = Math.round(E0);
  const n0 = Math.round(N0);
  let sira = 1000;
  let id = 0;
  const yeniId = on => on + (++id);
  const kalem = (it, o) => SH.kalemYap(it, Object.assign({ sira: ++sira }, o));

  p.bolgeler.push({ id: 'B1', ad: 'ELAZIĞ İLİ MERKEZ İLÇESİ ÖRNEK MAHALLESİ AG ŞEBEKE TESİSİ', kod: '23.01.01.02.30001',
    sinir: [[e0 - 60, n0 - 160], [e0 + 520, n0 - 160], [e0 + 520, n0 + 160], [e0 - 60, n0 + 160]] });
  p.bolgeler.push({ id: 'B2', ad: 'ELAZIĞ İLİ MERKEZ İLÇESİ ÖRNEK MAHALLESİ AYDINLATMA TESİSİ', kod: '23.01.01.02.30002',
    sinir: [[e0 + 300, n0 - 150], [e0 + 510, n0 - 150], [e0 + 510, n0 - 40], [e0 + 300, n0 - 40]] });
  const bolge = (x, y) => (SH.bolgeSec([x, y], p.bolgeler) || {}).id || '';

  const eleman = (tur, it, durum, hak, x, y, gis, ekler) => {
    const e = {
      id: yeniId('D'), tur, gisId: gis || '', cins: it.cins, tip: it.tanim, durum, hakedis: hak, bolge: bolge(x, y),
      saga: x, yukari: y, kot: 1067.5, aci: 0, kontrol: null, katman: '', blok: '',
      kalemler: [kalem(it, { durum, hakedis: hak, ana: true, kaynak: 'NIT', dmDurum: durum === 'DM' ? 'SÖKÜK' : undefined })]
    };
    for (const [ek, miktar] of ekler || []) e.kalemler.push(kalem(ek, { miktar, durum: durum === 'DM' ? 'DM' : 'M+M', hakedis: hak }));
    p.elemanlar.push(e);
    return e;
  };
  const hat = (tur, it, durum, hak, a, b, ara) => {
    const kose = [[a.saga, a.yukari]].concat(ara || [], [[b.saga, b.yukari]]);
    const L = SH.uzunluk(kose);
    const m = SH.hatMetraji(L, tur);
    const h = {
      id: yeniId('H'), tur, anaKesit: it.tanim, durum, hakedis: hak, bolge: bolge(...SH.ortaNokta(kose)), kose,
      cizimUzunlugu: L, etiket: SH.hatEtiketi(durum, it.tanim, m), kontrol: null, katman: '', uclar: [a.id, b.id],
      kalemler: [kalem(it, { miktar: m, durum, hakedis: hak, kaynak: 'HAT' })]
    };
    p.hatlar.push(h);
    return h;
  };

  const g10 = bul('AG_DEMİR_GLV', 'G-10I');
  const g12 = bul('AG_DEMİR_GLV', 'G-12I');
  const gk2 = bul('AG_DEMİR_GLV', 'G-K2');
  const travers = bul('TRAVERS_VE_KONSOLLAR_GLV', 'G-L-50');
  const izolator = bul('AG_İZOLATÖR', 'N-80');
  const alpek = bul('ALPEK_KABLOLAR', '3X50/16+70 ALPEK');
  const alpek25 = bul('ALPEK_KABLOLAR', '3X25/16+35 ALPEK');
  const rek = bul('REKORTMAN_ALİMİNYUM', '4x16 Nyy Alm.');
  const iletken = bul('AG_İLETKEN', '4P+R');

  // Trafo direği ve pano
  const tr = eleman('TRAFO_DIREGI', bul('TR_DİREK', 'T-25'), 'M', 1, e0, n0, 'SCTR01');
  eleman('PANO', bul('AG_PANO_HT', '160 kVA HT PANO '), 'M', 1, e0 + 6, n0 - 8, 'SCP01');

  // Ana cadde: yeni AG direkleri
  const ana = [tr];
  for (let i = 1; i <= 11; i++) {
    const x = e0 + i * 38 + (i % 3) * 1.5;
    const y = n0 + Math.sin(i / 3) * 6;
    const tip = i === 11 ? gk2 : i % 4 === 0 ? g12 : g10;
    const hak = i <= 6 ? 1 : 2;
    ana.push(eleman('AG_DIREK', tip, 'M', hak, x, y, 'SC' + (100 + i), [[travers, 1.2], [izolator, 4]]));
  }
  for (let i = 1; i < ana.length; i++) hat('AG_HAVAI', i < 7 ? alpek : alpek25, 'M', ana[i].hakedis, ana[i - 1], ana[i]);

  // Kuzeyde yan sokak: mevcut direkler ve mevcut hat
  const mevcut = [];
  for (let i = 0; i < 6; i++) mevcut.push(eleman('AG_DIREK', bul('AG_DEMİR', '10I'), 'MEVCUT', 1, e0 + 40 + i * 45, n0 + 95, ''));
  for (let i = 1; i < mevcut.length; i++) hat('AG_HAVAI', alpek25, 'MEVCUT', 1, mevcut[i - 1], mevcut[i]);
  hat('AG_HAVAI', alpek25, 'M', 1, ana[1], mevcut[0]);

  // Güneyde sökülecek eski çıplak hat
  const eski = [];
  for (let i = 0; i < 5; i++) eski.push(eleman('AG_DIREK', bul('AG_AĞAÇ', '11mt'), 'DM', 1, e0 + 30 + i * 52, n0 - 70, ''));
  for (let i = 1; i < eski.length; i++) hat('AG_HAVAI', iletken, 'DM', 1, eski[i - 1], eski[i]);

  // Rekortmanlar (abone bağlantısı)
  for (const i of [2, 3, 5, 7, 8, 10]) {
    const d = ana[i];
    const ev = { id: 'ev' + i, saga: d.saga + 6, yukari: d.yukari + (i % 2 ? 18 : -17) };
    const h = hat('REKORTMAN', rek, 'M', d.hakedis, d, ev);
    h.uclar = [d.id, ''];
  }

  // Box'lar ve yeraltı kablosu + kanal
  const b1 = eleman('BOX', bul('BOX_PANO', 'AG SAHA DAĞITIM KUTUSU (TİP-3)'), 'M', 2, e0 + 20, n0 - 120, 'SCB01');
  const b2 = eleman('BOX', bul('BOX_PANO', 'AG SAHA DAĞITIM KUTUSU (TİP-3)'), 'M', 2, e0 + 140, n0 - 125, 'SCB02');
  const yer = bul('AG_ALİMİNYUM_KABLO', '3x95+50 Nyy Alm.');
  hat('AG_YERALTI', yer, 'M', 2, tr, b1, [[e0 + 2, n0 - 60]]);
  hat('AG_YERALTI', yer, 'M', 2, b1, b2);
  const kose = [[e0 + 1, n0 - 4], [e0 + 2, n0 - 60], [e0 + 20, n0 - 120], [e0 + 140, n0 - 125]];
  const kod = SH.kanalKodu(false, true, false, false);
  const L = SH.uzunluk(kose);
  const kanal = {
    id: yeniId('K'), kod, kablolar: SH.kanalKablolari(kod), zemin: 'TOPRAK', altGenislik: 40, ustGenislik: 40, derinlik: 100,
    basNo: 'SCTR01', bitNo: 'SCB02', durum: 'M+M', hakedis: 2, bolge: bolge(...SH.ortaNokta(kose)), kose, cizimUzunlugu: L, kontrol: null,
    kalemler: [{ cins: String(kod), tanim: 'TOPRAK', durum: 'M+M', miktar: Math.ceil(L), birim: 'mt/m³', katsayi: 1, toplam: SH.kanalHacmi(40, 40, 100, Math.ceil(L)),
      birimFiyat: 0, hakedis: 2, tarife: '0104', sira: String(++sira), kontrol: null, ana: true, kaynak: 'NIT' }]
  };
  p.kanallar.push(kanal);

  // Aydınlatma direkleri
  const aydTip = bul('AYD_GLV_PLG', 'AD1-100/10');
  const arm = bul('ARMATÜR', 'S11 SINIF NUMARALI LED ARMATÜR');
  const ayd = [];
  for (let i = 0; i < 4; i++) ayd.push(eleman('AYD_DIREK', aydTip, 'M', 2, e0 + 330 + i * 45, n0 - 95, 'SC' + (200 + i), [[arm, 1]]));
  const aydKablo = bul('AYDINLATMA_KABLO', '4x16 Nyy Alm.');
  for (let i = 1; i < ayd.length; i++) hat('AYDINLATMA', aydKablo, 'M', 2, ayd[i - 1], ayd[i]);

  // Kofre ve ek mufu
  eleman('KOFRE', bul('KOFRA', 'KOFRA TIP-1'), 'M+M', 2, e0 + 120, n0 + 20, '');
  eleman('EK_MUFU', bul('EK_MUFU_AG_ALM', '3x95+50 Nyy Ek Mufu Alm.'), 'M', 2, e0 + 80, n0 - 122, 'EKAG');

  // Saha ölçüm noktaları
  ana.slice(1, 6).forEach((d, i) => p.noktalar.push({ id: yeniId('N'), ad: 'SC' + (101 + i), kod: d.tip, saga: d.saga, yukari: d.yukari, kot: 1067.5 + i * 0.3, hakedis: d.hakedis, bolge: d.bolge }));

  for (const e of p.elemanlar) {
    const t = SH.elemanTuru(e.tur);
    e.katman = e.durum === 'MEVCUT' ? 'SC_MEVCUT' : e.durum === 'DM' ? 'SC_DEMONTAJ' : t.katman === 'STANDART' ? 'SC_STANDART' : 'SC_' + e.hakedis + '.HAK.' + t.katman;
  }
  for (const h of p.hatlar) {
    h.katman = h.durum === 'MEVCUT' ? 'SC_MEVCUT' : h.durum === 'DM' ? 'SC_DEMONTAJ' : 'SC_' + h.hakedis + '.HAK.' + SH.hatTuru(h.tur).katman;
  }
  return SH.projeYaz(p, 'önizleme verisi');
}

module.exports = { uret };
if (require.main === module) process.stdout.write(uret());
