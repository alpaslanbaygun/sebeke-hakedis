# Plan

## Kararlar

- Ayrı bir **telefon uygulaması** + kendi **AutoCAD eklentimiz**. İkisi aynı proje dosyasını kullanır.
- Telefon uygulaması **VOLT-EDAŞ Saha**'dır (17.10.2026'da bu depoya `telefon/` olarak alındı; bu depodaki ilk
  telefon uygulaması bırakıldı, geri dönüş: `telefon-eski-0.2.3` dalı). Kataloğu TEDAŞ pozlarıdır; AutoCAD'e
  PROMAGIS cins / tanım ile çevrilir (`ortak/katalog/volt-eslesme.json`).
- Eklenti **PROMAGIS'in yerine geçer**: PROMAGIS çizimleri okunur; eklentinin çizdikleri de PROMAGIS
  biçimindedir (aynı katmanlar ve XDATA), böylece eski ve yeni nesneler aynı çizimde, aynı raporda durur.
- Simgeler: çizimde PROMAGIS bloğu varsa o korunur; yoksa lejant simge takımı (`ortak/katalog/semboller.json`,
  telefonun DXF çıktısıyla aynı bloklar).
- AutoCAD sürümleri: **2016–2024** ve **2025 ve sonrası** (LT yok).
- Veri aktarımı: **önce dosya** (Google Drive'da `.sebeke.json`; telefonun `.volt.json` ve teslim paketi de
  eklentide açılır), **sonra bulut eşitleme**.
- Telefon ekranları Google Stitch'te değil, uygulamanın kendi tasarımıyla elle düzenlenir; büyük tasarım
  işlerinden önce Stitch kullanılıp kullanılmayacağı sorulur.
- Saha kuralları: harita alttaki panelin arkasında kalmaz; büyük alım düğmesi tek elle; hat iki dokunuşla;
  malzemeler elle eklenir (otomatik reçete proje ayarıdır); telefon konumu ve sahte konum kabul edilir;
  alıcı markasına bağlı kalınmaz.

## Fazlar

| Faz | Kapsam | Durum |
| --- | --- | --- |
| 1 | Ortak temel: proje dosyası biçimi, rapor katsayıları, malzeme kataloğu | tamam |
| 2 | AutoCAD eklentisi 1: şerit menü, PROMAGIS içe alma, Durum Tespit raporu | tamam (AutoCAD'de deneme bekliyor) |
| 3 | Mobil tasarım | tamam (VOLT-EDAŞ Saha tasarımı) |
| 4 | AutoCAD eklentisi 2: telefondan alma, eleman, hat, kanal, sondaj, bölge, nokta alma, malzeme, metraj, ayarlar | tamam (AutoCAD'de deneme bekliyor) |
| 5–6 | İlk telefon uygulaması | bırakıldı (yerine VOLT-EDAŞ Saha) |
| 7 | Bulut eşitleme (Drive'daki dosyayı elle taşımadan) | sırada |
| 8 | VOLT-EDAŞ Saha birleşmesi: depo + otomatik APK derlemesi, lejant simge takımı, telefon ↔ AutoCAD dosya uyumu (iki yön, iki biçim) | tamam (sahada ve AutoCAD'de deneme bekliyor) |

## Sahada / AutoCAD'de denenecekler

- Eklentinin çizdiği lejant simgeleri (ölçek 4, etiket 0,5) ve PROMAGIS çizimlerinde oradaki blokların korunması.
- `SH_PROJEAL` gerçek bir çizimde: telefonda taşınan direk, değişen metraj, demontaja çevrilen eleman doğru yansıyor mu?
- Telefonda **AutoCAD dosyasından proje al** → sahada değişiklik → **Dışa Aktar › AutoCAD proje dosyası** →
  `SH_PROJEAL`: nesneler çoğalmadan güncelleniyor mu? Durum Tespit raporu beklenen kg'yi veriyor mu?
- Telefonda Bluetooth alıcı + NTRIP ile Fixed çözüm; sabit istasyon profili.
- APK 2.5.x telefondaki 2.4.0'ın üzerine kuruluyor mu (aynı imza anahtarı)?

## Açık sorular

- ~~PROMAGIS'teki `KONTROL` işareti ve `KM`, `ME` durum kodları ne anlama geliyor?~~ Çözüldü, bkz.
  `ortak/PROMAGIS-NOTLARI.md` (KONTROL = denetlendi işareti; KM = malzemesi yükleniciye çıkılan kurum montajı;
  ME = mutabakat eksiği; ENH = kilometrik bedelli iş).
- Birim fiyat girişi gerekecek mi? (İncelenen projede fiyat sütunları boştu.)
- Telefon kataloğundaki travers, izolatör, topraklama gibi malzemelerin PROMAGIS cins / tanım karşılıkları şimdilik
  kategori kuralıyla üretiliyor; birebir eşleme istenirse `volt-eslesme.json › kalemler` doldurulur.
- "İleride" durumundaki objeler AutoCAD dosyasına yazılmıyor; PROMAGIS'te bir karşılığı istenirse konuşulmalı.
