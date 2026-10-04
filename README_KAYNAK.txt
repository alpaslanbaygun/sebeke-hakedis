VOLT-EDAŞ Saha 2.1.0 — Kaynak paketi
====================================

İçerik
- web/        Arayüz + hesap motoru (Preact, JavaScript). web/src, web/seed, web/tests
- android/    Android kabuğu (Java): Bluetooth SPP/BLE, NTRIP, telefon GNSS, dosya kaydet/paylaş
- tools/      APK derleme betikleri (Gradle gerektirmez)
- keystore/   İmza anahtarı  voltsaha-release.jks

İMZA ANAHTARI (ÖNEMLİ)
- Dosya : keystore/voltsaha-release.jks   (2.1.0 ile yenilendi; sertifika: CN=VOLT-EDAS Saha, L=Elazig, C=TR)
- Alias : voltsaha
- Şifre : VoltSaha2026!
2.0.0 farklı bir anahtarla imzalıydı: 2.1.0 kurulmadan önce eski uygulama telefondan kaldırılmalıdır.
Bundan sonraki sürümler AYNI anahtarla imzalanmazsa mevcut kurulumun üzerine yüklenemez;
kullanıcı uygulamayı silmek zorunda kalır ve cihazdaki proje verisi silinir.
Bu dosyayı ve şifreyi güvenli bir yerde saklayın, kimseyle paylaşmayın.

Derleme
1) cd web && npm install
2) Testler: node --test tests/scenarios.test.mjs   (26/26 geçmeli)
          python3 tests/ui/smoke.py                (arayüz duman testi, 0 hata)
3) APK : ./tools/build_apk.sh  (aapt2, d8, apksigner, ecj ve android.jar yolu betikte T= değişkeninde)
   Çıktı: dist/VOLT-EDAS-Saha-2.1.0.apk
   Farklı şifre için: KSPASS='...' ./tools/build_apk.sh

2.1.0 değişiklikleri (saha testi sonrası)
- Harita: konum her zaman haritanın GÖRÜNEN kısmının ortasına gelir (alt panelin arkasında kalmaz).
- Alt panel küçültüldü: seçili tür + hat durumu + büyük ALIM düğmesi her zaman ekranda.
- Tür seçimi ayrı pencerede; "Son kullanılanlar" ile tek dokunuşla direk tipi.
- Hat: "+ HAT" → başlat → direkleri sırayla al (otomatik bağlanır) → hat düğmesi → HATTI BİTİR.
- Son alımı geri al düğmesi; ölçüm ilerlemesi ALIM düğmesinin üstünde.
- Android geri tuşu açık pencereyi / seçimi kapatır.

Standart verisi
- web/seed/standard-tedas-2026.json (TEDAŞ 2026 · 26.23.GR.02)
- "unverifiedTables" listesindeki tablolar kullanım öncesi doğrulanmalıdır.
