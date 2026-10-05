VOLT-EDAŞ Saha 2.2.0 — Kaynak paketi
====================================

İçerik
- web/        Arayüz + hesap motoru (Preact, JavaScript). web/src, web/seed, web/tests
- android/    Android kabuğu (Java): Bluetooth SPP/BLE, NTRIP, telefon GNSS, dosya kaydet/paylaş
- tools/      APK derleme betikleri (Gradle gerektirmez)
- keystore/   İmza anahtarı  voltsaha-release.jks
- surum-gecmisi.bundle   Git geçmişi (v2.1.0 ve v2.2.0 etiketleriyle)

GERİ DÖNÜŞ (v2.1.0'a)
- Telefonda: VOLT-EDAS-Saha-2.1.0-geri-donus.apk dosyasını 2.2.0'ın ÜZERİNE kurun (silmeden). Proje verisi korunur;
  veritabanı sürümü aynıdır (geçiş testi: tests/ui/upgrade.py). Bu APK'nın sürüm kodu 9210'dur; ondan sonra
  kurulacak yeni sürümlerin kodu 9210'dan büyük olmalıdır (derlemeden önce AndroidManifest.xml › versionCode).
- Kaynak kodda:  git clone surum-gecmisi.bundle voltapp && cd voltapp && git checkout v2.1.0

İMZA ANAHTARI (ÖNEMLİ)
- Dosya : keystore/voltsaha-release.jks   (sertifika: CN=VOLT-EDAS Saha, L=Elazig, C=TR)
- Alias : voltsaha
- Şifre : VoltSaha2026!
2.1.0, 2.1.0-geri-donus ve 2.2.0 aynı anahtarla imzalıdır; birbirinin üzerine kurulabilir.
Bu dosyayı ve şifreyi güvenli bir yerde saklayın, kimseyle paylaşmayın.

Derleme
1) cd web && npm install
2) Testler: node --test tests/scenarios.test.mjs   (33/33 geçmeli)
          python3 tests/ui/smoke.py                (arayüz duman testi, 0 hata)
          python3 tests/ui/upgrade.py              (2.1.0 ↔ 2.2.0 veri geçişi; önce v2.1.0 derlemesi gerekir)
3) APK : ./tools/build_apk.sh  →  dist/VOLT-EDAS-Saha-2.2.0.apk

2.2.0 değişiklikleri (Teknik Spesifikasyon v2)
- Veri kaynağı takibi: GNSS_RTK · GNSS_FLOAT · TELEFON_GPS · MANUEL · EXCEL · HARITADAN_SECILDI; harita, liste, rapor etiketleri.
- GEÇİŞ özelliği kaldırıldı; eski kayıtlar için "detay noktasına dönüştür / arşivle".
- Obje bazlı hakediş durumu (6 durum), haritada renkler, karttan tek dokunuşla değiştirme, dönem motoruna bağlı.
- Veri kaynağı seçimi: GNSS · Telefon GPS · Manuel koordinat (koordinat sistemi seçmeli) · Haritadan seç · Excel.
- Excel toplu aktarım: 6 şablon, doğrulama, önizleme, onaylı içe alma (XLSX ve CSV).
- Yeni obje türleri: Pano, Armatür / sokak lambası, Kanal / Kazı, Diğer (serbest).
- Fotoğraf: çoklu çekim, {ObjeNo}_{Sıra}.jpg, üst yazı, EXIF GPS, PROJE/TÜR/OBJE klasör yapısı.
- GNSS: kalite uyarısı onayla geçilebilir; ölçüm yöntemi seçimi; Sabit Base + Rover rehberi; her ölçümde cihaz/DOP/operatör.
- Rapor ve teslim paketi: obje listesi, kaynak, doğruluk, hakediş, fotoğraflar; proje klasör yapısı.

Kod yapısı (bağımsız servisler)
- gnss/gnss-service.js (GNSS + cihaz), geo/crs.js (koordinat), services/survey-service.js (saha alımı),
  ui/map-engine.js (harita), qty/hakedis.js + services/project-service.js (hakediş), services/photo-service.js,
  services/excel-import.js, export/report.js + export/exporter.js (rapor), core/sync.js (offline senkron).

Web (ofis) sürümü — 2.2.0-web
- Aynı kaynak koddan derlenir: cd web && node build.mjs --web  →  web/dist/web
  (page.html: yayınlanan sayfa parçası · index.html: tam sayfa, yerel deneme ya da kendi sunucun için)
- Ölçüm yok (GNSS, NTRIP, telefon GPS, kamera, aplikasyon telefondaki APK'da). Web: inceleme, düzeltme, Excel aktarım,
  manuel koordinat / haritadan seçme, hakediş durumu, hesaplar, dışa aktarım, telefonla .vsync dosya alışverişi.
- Veri: web/src/web/cloud-adapter.js — çalışma kopyası bellekte, kalıcı kopya yayınlanan sayfanın belge deposunda
  (m/manifest + b/<tablo>~<kova>; belge başına 256 KiB sınırı için otomatik bölme). Standart paketi, türetilmiş
  tablolar (açıklık, metraj) ve fotoğraf baytları buluta yazılmaz.
- Platform: web/src/web/platform.js — indirme (izinli olmayan uzantılar zip içinde), çoklu çıktı tek zip.
- Web'e özel görünüm yalnız "html.web" sınıfı altında (ui/theme.css sonu); APK görünümü değişmez.
- Testler: node --test tests/*.test.mjs  (42/42: 33 senaryo + 9 web)  ·  python3 tests/ui/web.py (sahte bulutla tarayıcı testi)
- APK 2.2.0 bu değişikliklerden etkilenmedi (yeniden derlenmedi); geri dönüş noktaları: v2.1.0, v2.2.0 etiketleri.
