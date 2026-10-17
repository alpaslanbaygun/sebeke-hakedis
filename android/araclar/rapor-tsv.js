// Geliştirme aracı: proje dosyasından Durum Tespit satırlarını sekmeyle ayrılmış metin olarak yazar.
// Kullanım: node android/araclar/rapor-tsv.js <proje.sebeke.json> <çıkış.tsv>
// AutoCAD eklentisinin (C#) ürettiği raporla karşılaştırmak için kullanılır.
const fs = require('fs');
const path = require('path');
const SH = require(path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'ui', 'sh-core.js'));
const kat = SH.katsayiHazirla(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ortak', 'katalog', 'katsayilar.json'), 'utf8')));
const t0 = Date.now();
const p = SH.projeOku(fs.readFileSync(process.argv[2], 'utf8'));
const t1 = Date.now();
const rows = SH.durumTespit(p, kat);
const t2 = Date.now();
const oz = SH.ozet(rows);
const cols = ['handle', 'proje', 'cins', 'tip', 'durum', 'birimFiyat', 'miktar', 'birim', 'katsayi', 'toplam', 'tutar', 'hakedis', 'bolgeTarife', 'malzemeTarife', 'dmDurum', 'index', 'kontrol'];
fs.writeFileSync(process.argv[3], rows.map(r => cols.map(c => r[c]).join('\t')).join('\n') + '\n');
const kg = rows.reduce((s, r) => s + (r.birim.endsWith('/kg') ? r.toplam : 0), 0);
console.log('okuma', t1 - t0, 'ms; rapor', t2 - t1, 'ms; satır', rows.length, '; özet', oz.length, '; toplam kg', SH.temiz(kg, 1));
