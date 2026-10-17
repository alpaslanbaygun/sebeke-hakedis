# Devir notu

Bu proje başka bir hesaba (GitHub ya da Claude) geçerken sohbet geçmişi taşınmaz. Devam etmek için
gereken her şey bu depodadır. Yeni oturum önce bu dosyayı, sonra [README.md](README.md),
[PLAN.md](PLAN.md), [KULLANIM.md](KULLANIM.md) ve [ortak/VERI-MODELI.md](ortak/VERI-MODELI.md) dosyalarını okumalı.

## 1. Çalışma kuralları

- Kullanıcı elektrik mühendisi, yazılımcı değil. Türkçe, kısa, adım adım ve teknik terimsiz anlatım.
- Arayüz tasarımına başlamadan önce **Google Stitch** kullanılıp kullanılmayacağı sorulur.
- Çıktılara, belgelere ve araçlara kullanıcının istemediği hiçbir firma adı ya da markası yazılmaz.
- Her şey bulutta durur (GitHub, Google Drive); belirli bir bilgisayara bağlı çözüm yapılmaz.
- **Gerçek proje verisi depoya konmaz** (DWG, gerçek proje dosyası, rapor, proje kodları). Testler uydurma
  örneklerle çalışır (`autocad/test/CekirdekTest/*.json`, `android/araclar/demo-proje.js`).
- Saha arayüzü kuralları PLAN.md'nin “Kararlar” bölümündedir (harita panelin arkasında kalmaz, büyük KOY
  düğmesi, iki dokunuşla hat, malzeme elle, sahte konum kabul…).
- Değişiklik açıklamaları (commit) Türkçe yazılır.

## 2. Durum (17.10.2026)

| Parça | Sürüm | Durum |
| --- | --- | --- |
| Telefon uygulaması | 0.2.3 (APK, Releases) | Bitti; sahada denenmedi |
| AutoCAD eklentisi | 0.1.7 (zip, Releases) | Bitti; AutoCAD'de denenmedi (derleme, çekirdek ve pencere denemeleri geçti) |
| Belgeler | KULLANIM, README, PLAN, VERI-MODELI | Güncel |

Her gönderimde otomatik derleme yeni bir sürüm çıkarır (sürüm numarası derleme sırasından gelir).

## 3. Kod haritası

- `ortak/` — proje dosyası biçimi, `katalog/kalemler.json` (malzeme kataloğu), `katalog/katsayilar.json` (rapor katsayıları).
- `autocad/src/Cekirdek/` — AutoCAD'den bağımsız C# çekirdek:
  `PromagisOkuyucu` (PROMAGIS XDATA → model), `PromagisYazici` (model → PROMAGIS biçiminde çizim tarifi),
  `DurumTespit` + `RaporYazici` + `XlsxYazici` (rapor), `Aktarim` (telefondan alma planı), `Katalog`,
  `Numara` (GIS no, kalem sırası), `CizimAyarlari` + `Metraj`, `NoktaDosyasi`, `ProjeDosyasi`, `Model`.
- `autocad/src/Eklenti/` — AutoCAD tarafı: `Komutlar` (rapor, içe alma), `CizimKomutlari` (çizim araçları,
  `SH_PROJEAL`), `CizimYazici` (çizime yazma), `Toplayici` (çizimden okuma), `Ortam`/`OrtamVerisi`,
  `Pencereler` (WinForms, kodla), `Serit` (şerit menü).
- `autocad/test/CekirdekTest` — çekirdek denemeleri. Komutlar: `ornek` (CI), `dogrula`, `gidisdonus`,
  `aktarim`, `bosaaktar`, `katsayilar`.
- `autocad/test/PencereTest` — pencereleri AutoCAD'siz açıp ekran görüntüsü alır, değerleri denetler (yalnız Windows/CI).
- `android/app/src/main/assets/ui/` — telefon arayüzü ve JS çekirdek (`sh-core.js`; C# çekirdeğin karşılığı,
  aynı projede aynı raporu verir). `android/app/src/main/java/...` — Kotlin (depolama, GNSS, NTRIP, dosya, fotoğraf).
- `android/araclar/` — JS testleri, önizleme sunucusu, uçtan uca ekran testi.
- `.github/workflows/` — `autocad.yml` (Windows), `android.yml` (Linux).

## 4. Derleme ve deneme

- AutoCAD eklentisi ve APK yalnız GitHub Actions'ta derlenir. Sonuçlar:
  `ci-sonuc` dalı (eklenti: test günlüğü, derleme günlüğü, pencere ekran görüntüleri `ekran/`) ve
  `ci-sonuc-android` dalı. Paketler Releases'te (`v0.1.N`, `mobil-0.2.N`).
- Tarayıcısız durum sorgusu: `gh api repos/<sahip>/sebeke-hakedis/commits/<işlem>/check-runs`,
  sürümler: `gh api repos/<sahip>/sebeke-hakedis/releases`.
- Yerelde: `dotnet run --project autocad/test/CekirdekTest -c Release -- ornek` (.NET 8; paket gerektirmez),
  `node android/araclar/cekirdek-test.js`, önizleme `node android/araclar/dev-server.js`.
- Claude'un bulut ortamında NuGet / Gradle erişimi kapalı olabilir; bu yüzden AutoCAD ve Android derlemesi
  CI'a bırakılır, yerelde yalnız çekirdek testleri çalıştırılır.
- **APK imza anahtarı** `android/app/signing/sebeke-hakedis.keystore` (şifreler `android/app/build.gradle.kts`).
  Değiştirilmemeli: değişirse telefondaki uygulama güncellenemez, kaldırıp kurmak gerekir ve projeler silinir.

## 5. Gerçek veriyle doğrulama (veri depoda yok)

Kullanıcıdaki gerçek PROMAGIS çizimi (37 alt proje, 8 hakediş) ve PROMAGIS Durum Tespit dosyasıyla yapıldı.
Yeniden yapmak için kullanıcıdan DWG ve Durum Tespit dosyası istenir, `araclar/dwg-dokum` ile döküm alınır,
`CekirdekTest` ile `dogrula`, `gidisdonus`, `aktarim` çalıştırılır. Beklenen:

- Rapor: 22.048 satırın 22.045'i PROMAGIS'le eşleşir, toplam 1.540.966,1 kg birebir aynı.
- Telefon (JS) ve bilgisayar (C#) çekirdeği aynı projede 22.048 satırı birebir aynı üretir.
- Yazıcı gidiş-dönüş: rapor satırları aynı kalır.
- Telefondan alma: o çizimden çıkmış, değişmemiş proje 17.837 nesnede 0 iş üretir.

## 6. Sıradaki işler

1. **AutoCAD'de ilk deneme** (kullanıcı yapacak): Eleman ve Hat ile çizilen sembol/etiket boyutları,
   Telefona Gönder → telefonda değiştir → Telefondan Al. Hata ayrıntısı `%TEMP%\SebekeHakedis_hata.txt`'ye yazılır.
2. **Sahada telefon denemesi**: Bluetooth alıcı + NTRIP ile Fixed çözüm; M-Survey RTK sahte konumla ölçü.
3. **Bulut eşitleme** (Faz 7): dosyayı Drive'a elle taşımadan eşitleme. Kullanıcının Google hesabıyla kurulum
   gerektirir; yöntem kullanıcıyla konuşulmalı.
4. İstenirse telefon ekranlarının Google Stitch'te yeniden çizilmesi (önce kullanıcıya sorulur; istemler
   `android/tasarim/STITCH-ISTEMLERI.md`).
5. Açık sorular: PROMAGIS'teki `KONTROL` işareti ile `KM`, `ME` durumlarının anlamı; birim fiyat girişi gerekecek mi?

## 7. Başka hesaba geçiş

### GitHub deposu

- **Ortak çalışan eklemek** (önerilen, geri alınabilir): depo › **Settings › Collaborators › Add people** ›
  diğer hesabın kullanıcı adı. Diğer hesap e-postadaki daveti kabul eder.
- **Sahipliği devretmek**: depo › **Settings › General** › en altta **Danger Zone › Transfer** › yeni sahibin
  kullanıcı adı › onay. Diğer hesap daveti kabul eder. Sürümler, dallar ve otomatik derleme birlikte taşınır;
  eski bağlantılar yeni adrese yönlenir. Özel depoda otomatik derleme süresi yeni hesabın aylık hakkından düşer.

### Claude

Bu sohbet, Claude belgeleri ve Claude'un kullanıcı hakkındaki notları diğer hesaba geçmez. Diğer hesapta
GitHub'ı bağlayın (depoya erişebilen GitHub hesabıyla), bu depoyla yeni bir oturum açın ve şunu yazın:

> Bu depo "Şebeke Hakediş" projesi. Önce DEVIR.md'yi, sonra README.md, PLAN.md, KULLANIM.md ve
> ortak/VERI-MODELI.md'yi oku; DEVIR.md'deki çalışma kurallarına uy. Bana Türkçe, kısa ve adım adım yaz.
> Önce durumu iki cümleyle özetle, sonra sıradaki işi sor.
