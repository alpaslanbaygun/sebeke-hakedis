# Plan

## Kararlar

- Ayrı bir **Android uygulaması** + kendi **AutoCAD eklentimiz**. İkisi aynı proje dosyasını kullanır.
- Eklenti **PROMAGIS'in yerine geçer**: PROMAGIS çizimleri okunur; eklentinin çizdikleri de PROMAGIS
  biçimindedir (aynı katmanlar ve XDATA), böylece eski ve yeni nesneler aynı çizimde, aynı raporda durur.
- AutoCAD sürümleri: **2016–2024** ve **2025 ve sonrası** (LT yok).
- Veri aktarımı: **önce dosya** (Google Drive'da `.sebeke.json`), **sonra bulut eşitleme**.
- Mobil ekranlar Google Stitch ile tasarlanacaktı; Stitch bu çalışma ortamından erişilemediği için ekranlar
  Saha Ölçüm'ün (Stitch'te hazırlanmış) tasarım sistemiyle elle çizildi. İstenirse
  [android/tasarim/STITCH-ISTEMLERI.md](android/tasarim/STITCH-ISTEMLERI.md) ile Stitch'te yeniden çizilebilir.
- Saha kuralları: harita alttaki panelin arkasında kalmaz; konum noktası panelin altına girmez; tip seçimi
  hızlı (son kullanılanlar, yıldızlılar); büyük **KOY** düğmesi sağ altta, tek elle; hat iki dokunuşla;
  malzemeler elle eklenir, yalnız kanal hesabı kendiliğinden; telefon konumu ve sahte konum (M-Survey RTK)
  kabul edilir; alıcı markasına bağlı kalınmaz.

## Fazlar

| Faz | Kapsam | Durum |
| --- | --- | --- |
| 1 | Ortak temel: proje dosyası biçimi, rapor katsayıları, malzeme kataloğu | tamam |
| 2 | AutoCAD eklentisi 1: şerit menü, PROMAGIS içe alma, Durum Tespit raporu | tamam (AutoCAD'de deneme bekliyor) |
| 3 | Mobil tasarım | tamam (Saha Ölçüm tasarım sistemiyle) |
| 4 | AutoCAD eklentisi 2: telefondan alma, eleman, hat, kanal, sondaj, bölge, nokta alma, malzeme, metraj, ayarlar | tamam (AutoCAD'de deneme bekliyor) |
| 5 | Mobil uygulama 1: proje açma, harita, GNSS ile eleman koyma, hat, kanal, bölge, malzeme, fotoğraf, dışa aktarma | tamam (sahada deneme bekliyor) |
| 6 | Mobilde rapor ve malzeme | tamam |
| 7 | Bulut eşitleme (Drive'daki dosyayı elle taşımadan) | sırada |

## Sahada / AutoCAD'de denenecekler

- Eklentinin çizdiği bloklar ve etiketler PROMAGIS çizimindekilerle aynı görünüyor mu (ölçek 4, etiket 0,5)?
- `SH_PROJEAL` gerçek bir çizimde: telefonda taşınan direk, değişen metraj, demontaja çevrilen eleman doğru yansıyor mu?
- Telefonda Bluetooth alıcı + NTRIP ile Fixed çözüm; M-Survey RTK sahte konumla ölçü.

## Açık sorular

- PROMAGIS'teki `KONTROL` (Doğru/Yanlış) işareti ve `KM`, `ME` durum kodları ne anlama geliyor?
- Birim fiyat girişi gerekecek mi? (İncelenen projede fiyat sütunları boştu.)
