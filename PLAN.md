# Plan

## Kararlar (16.10.2026)

- Ayrı bir **Android uygulaması** + kendi **AutoCAD eklentimiz**. İkisi aynı proje dosyasını kullanır.
- Eklenti **PROMAGIS'in yerine geçer**; eski PROMAGIS çizimleri bir kez içe alınır.
- AutoCAD sürümleri: **2016–2024** ve **2025 ve sonrası** (LT yok).
- Veri aktarımı: **önce dosya** (Google Drive'da `.sebeke.json`), **sonra bulut eşitleme**.
- Mobil ekranlar **Google Stitch** ile tasarlanır; altyapı Saha Ölçüm (GNSS Link) uygulamasından gelir
  (Bluetooth GNSS, NTRIP, TM projeksiyonu, DXF, harita altlığı).

## Fazlar

| Faz | Kapsam | Durum |
| --- | --- | --- |
| 1 | Ortak temel: proje dosyası biçimi, rapor katsayıları, malzeme kataloğu | tamam |
| 2 | AutoCAD eklentisi 1: şerit menü, PROMAGIS içe alma, Durum Tespit raporu | AutoCAD'de deneme bekliyor (v0.1.2) |
| 3 | Mobil tasarım: Stitch ekran listesi ve istemleri ([android/tasarim/STITCH-ISTEMLERI.md](android/tasarim/STITCH-ISTEMLERI.md)) | istemler hazır, Stitch bekliyor |
| 4 | AutoCAD eklentisi 2: nokta alma, direk/box/trafo, hat, kanal, sondaj, bölge, malzeme düzenleme | sırada |
| 5 | Mobil uygulama 1: proje açma, harita, GNSS ile eleman koyma, hat, hakediş/bölge, dışa aktarma | sırada |
| 6 | Mobilde rapor ve malzeme; ardından bulut eşitleme | sırada |

## Açık sorular

- PROMAGIS'teki `KONTROL` (Doğru/Yanlış) işareti ve `KM`, `ME` durum kodları ne anlama geliyor?
- Birim fiyat girişi mobilde olacak mı? (İncelenen projede fiyat sütunları boştu.)
