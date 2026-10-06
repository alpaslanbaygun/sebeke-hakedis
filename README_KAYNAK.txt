VOLT-EDAŞ Saha 2.3.0 — Kaynak paketi
====================================

İçerik
- web/        Arayüz + hesap motoru (Preact, JavaScript). web/src, web/seed, web/tests
- android/    Android kabuğu (Java): Bluetooth SPP/BLE, NTRIP, telefon GNSS, dosya kaydet/paylaş
- tools/      APK derleme betikleri (Gradle gerektirmez)
- keystore/   İmza anahtarı  voltsaha-release.jks
- surum-gecmisi.bundle   Git geçmişi (v2.1.0, v2.2.0, v2.2.0-web ve v2.3.0 etiketleriyle)

GERİ DÖNÜŞ (v2.1.0'a)
- Telefonda: VOLT-EDAS-Saha-2.1.0-geri-donus.apk dosyasını 2.2.0'ın ÜZERİNE kurun (silmeden). Proje verisi korunur;
  veritabanı sürümü aynıdır (geçiş testi: tests/ui/upgrade.py). Bu APK'nın sürüm kodu 9210'dur; ondan sonra
  kurulacak yeni sürümlerin kodu 9210'dan büyük olmalıdır (derlemeden önce AndroidManifest.xml › versionCode).
- Kaynak kodda:  git clone surum-gecmisi.bundle voltapp && cd voltapp && git checkout v2.1.0

İMZA ANAHTARI (ÖNEMLİ)
- Dosya : keystore/voltsaha-release.jks   (sertifika: CN=VOLT-EDAS Saha, L=Elazig, C=TR)
- Alias : voltsaha
- Şifre : VoltSaha2026!
2.1.0, 2.1.0-geri-donus, 2.2.0 ve 2.3.0 aynı anahtarla imzalıdır; birbirinin üzerine kurulabilir.
Bu dosyayı ve şifreyi güvenli bir yerde saklayın, kimseyle paylaşmayın.

Derleme
1) cd web && npm install
2) Testler: node --test tests/scenarios.test.mjs   (33/33 geçmeli)
          python3 tests/ui/smoke.py                (arayüz duman testi, 0 hata)
          python3 tests/ui/upgrade.py              (2.1.0 ↔ 2.2.0 veri geçişi; önce v2.1.0 derlemesi gerekir)
3) APK : ./tools/build_apk.sh  →  dist/VOLT-EDAS-Saha-2.3.0.apk

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


2.3.0 değişiklikleri
====================
GERİ DÖNÜŞ (v2.2.0'a): VOLT-EDAS-Saha-2.2.0.apk 2.3.0'ın üzerine kurulamaz (sürüm kodu küçük: 220 < 230). Geri dönmek için
2.3.0'ı kaldırmadan önce Dışa Aktar › telefona veri (.vsync) ile yedek alın. Veritabanı sürümü aynıdır (3); 2.2.0 aynı veriyi
açar (tests/ui/upgrade23.py). Kaynak kodda: git checkout v2.2.0

Yeni dosyalar
- grid/cabin.js           Kabin (köşk / trafo binası) yerleşim kuralları: tipler, hücre serileri, sığma kontrolleri, plan şekilleri
- grid/cabin-recipe.js    Kabin keşfi: gövde (tipine göre ayrı kalem) + hücreler + trafo + pano + kablo kanalı (m)
- ui/screens/cabin.js     Kabin kurma ekranı (2B plan, hücre ekle / çıkar / sırala, kanal ekle)
- cad/{dxf,ncz,aci,symbols,index}.js   DXF ve NCZ okuma, birleşik çizim modeli, yapışma noktaları, kol bulma
- services/cad-service.js Çizimi projeye ekleme (documents + blobs), görünürlük, katman aç / kapat
- calc/tepe.js            Cer vektör ve direk tepe kuvveti (tablo yöntemi, kg): T / KT / D / KD / N / genel düğüm
- ui/screens/tepe.js      Tepe kuvveti ekranı (kollar çizimden ya da hattan, katman adından iletken tanıma + elle seçim)
- grid/energize.js        Enerji kontrolü: OG / AG kaynaklarından bağlantı izleme
- core/roles.js           Hakediş onay rolleri, izinli adımlar, şifre özeti (tuzlu, yinelemeli SHA-256)
- ui/screens/team.js      Kullanıcılar ve onay ekranı, oturum, onay bekleyenler, onay geçmişi
- geo/tiles.js            Karo matematiği: 3857 (OSM / Esri / Google) ve 3395 (Yandex)
- tools/seed_extras_v23.mjs   Katalog ekleri (hd hücreler, LED / sodyum armatürler, kofre, kanal, köşk gövde eşlemesi)

Davranış notları
- Katalog: standard.seedRev = 23. Eski veride açılışta yalnız EKSİK satırlar eklenir (core/standards.js › upgradeStandard);
  kullanıcının değiştirdiği fiyat / kalem korunur. Yeni kalemler verified:false ("DOĞRULANACAK") işaretlidir; Poz Kataloğu
  ekranından ad / poz no / fiyat düzeltilebilir, yeni kalem eklenebilir.
- Monoblok köşk (post 'mono') trafolarda köşk gövdesi artık ayrı kalem olarak keşfe gelir (varsayılan TİP-1C BOŞ;
  ekipman ekranından ya da kabin ekranından değiştirilir). Bu, mevcut projelerde de monoblok trafo metrajına 1 kalem ekler.
- Hakediş onayı: proje kaydında members[] (ad, rol, tuz, şifre özeti) ve approval{strict, lock}. Etkin Yönetici yoksa
  mekanizma kapalıdır ve davranış 2.2.0 ile aynıdır. Oturum cihazda saklanmaz (uygulama kapanınca kapanır).
- GNSS: Float çözümde alım ayardan açılıp kapatılır (varsayılan açık). Spectra: $PASHR,POS / $PTNL,GGK okunur;
  "Alıcı markası: Spectra" seçilirse konum çıkışı yoksa $PASHS,NME komutlarıyla açılır.
- Altlık: Google (anahtar varsa Map Tiles API oturumu, yoksa genel adres) ve Yandex (elipsoidal Mercator).

Testler
- node --test tests/*.test.mjs   → 120/120 (33 senaryo · 10 web · 29 kabin · 17 CAD · 19 tepe · 12 v2.3)
- python3 tests/ui/{smoke,web,v23_cabin,v23_grid,v23_team,v23_web}.py   → 0 hata
- python3 tests/ui/upgrade23.py  → 2.2.0 ↔ 2.3.0 aynı veritabanı (önce v2.2.0 derlemesi gerekir)
- tests/ref/ altındaki üç referans dosya pakete dahil değildir; yoksa ilgili karşılaştırma testleri atlanır.
