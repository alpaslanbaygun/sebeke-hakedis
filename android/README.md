# Şebeke Hakediş — telefon uygulaması (Android)

Sahada direk, box, pano, trafo gibi elemanları GNSS ile ölçüp koymak; hat, kanal ve malzemeleri
girmek; hakediş özetini ve PROMAGIS ile aynı Durum Tespit raporunu (Excel) almak için.
AutoCAD eklentisiyle aynı proje dosyasını (`.sebeke.json`) kullanır: AutoCAD'de “Telefona Gönder” ile
yazılan dosya telefonda “Dosyadan Aç” ile açılır; telefonda “Dışa Aktar › Proje dosyası” ile gönderilen
dosya AutoCAD'de “Telefondan Al” ile çizime işlenir. Kullanım: [../KULLANIM.md](../KULLANIM.md)

## Kurulum (telefon)

GitHub › **Releases** › en yeni “Telefon uygulaması” sürümündeki `SebekeHakedis-<sürüm>.apk`
dosyasını telefona indirip açın. İlk kurulumda “bilinmeyen kaynaklardan yüklemeye” izin verilir.
Yeni sürüm eskisinin üzerine, veriler silinmeden kurulur (tüm sürümler aynı anahtarla imzalanır).

## Yapı

- `app/src/main/assets/ui/` — arayüz (tek WebView, Saha Ölçüm ile aynı tasarım sistemi)
  - `sh-core.js` — hesap çekirdeği: proje dosyası, bölge, hat/kanal kuralları, Durum Tespit raporu,
    TM projeksiyonu. AutoCAD eklentisindeki C# çekirdeğinin karşılığı; gerçek bir projede iki raporun
    22.048 satırı birebir aynı çıktı.
  - `sh-xlsx.js` — Excel yazıcı ve rapor sayfaları, `sh-dxf.js` — DXF ve CSV
  - `sh-oturum.js` — açık proje: değişiklik günlüğü, geri alma, saha işlemleri
  - `harita.js` — harita (altlık karoları, ağ çizimi, dokunma)
  - `screens/*.html` + `screens-*.js` — ekranlar
- `app/src/main/java/com/sebekehakedis/mobil/` — telefon tarafı (Kotlin)
  - `ProjeDeposu.kt` — projeler; her kayıt küçük bir satır olarak eklenir, sonra derlenir
  - `GnssService.kt`, `NmeaParser.kt`, `NtripClient.kt` — Bluetooth GNSS alıcısı (marka fark etmez) ve NTRIP
  - `TelefonKonumu.kt` — telefonun konumu (M-Survey RTK gibi uygulamaların sahte konumu dahil)
  - `TileServer.kt` — harita altlığı karoları (OpenStreetMap, Google, Yandex)
  - `MainActivity.kt`, `UiApi.kt` — WebView, köprü, dosya açma/kaydetme/paylaşma, fotoğraf
- Malzeme kataloğu ve rapor katsayıları derlemede `../ortak/katalog/` klasöründen alınır.

## Derleme

APK GitHub Actions'ta derlenir (`.github/workflows/android.yml`): JS testleri, simge denetimi,
Kotlin testleri, APK, sürüm. Yerelde: JDK 17 + Android SDK 34 ile `./gradlew assembleRelease`.

## Bilgisayarda deneme

Node.js gerekir.

```
node android/araclar/dev-server.js            # http://localhost:8765/ui/index.html (sahte alıcıyla)
node android/araclar/cekirdek-test.js         # hesap çekirdeği testleri
node android/araclar/ekran-testi.js ekranlar  # uçtan uca deneme + ekran görüntüleri (Playwright)
node android/araclar/rapor-tsv.js proje.sebeke.json rapor.tsv   # raporu C# çıktısıyla karşılaştırmak için
```

Önizlemede “Dosyadan Aç” uydurma bir örnek proje yükler (`araclar/demo-proje.js`).

## Tasarım

Ekranlar Saha Ölçüm'ün Stitch'te hazırlanan tasarım sistemiyle (renkler, yazı tipi, bileşenler)
elle çizildi; Stitch bu ortamdan erişilemedi. İstenirse `tasarim/STITCH-ISTEMLERI.md` ile Stitch'te
yeniden çizilip aynı `data-*` bağlantılarıyla değiştirilebilir.
