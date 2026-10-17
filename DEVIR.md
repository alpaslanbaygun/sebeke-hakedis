# Devir notu

Bu proje başka bir hesaba (GitHub ya da Claude) geçerken sohbet geçmişi taşınmaz. Devam etmek için
gereken her şey bu depodadır. Yeni oturum önce bu dosyayı, sonra [README.md](README.md),
[PLAN.md](PLAN.md), [KULLANIM.md](KULLANIM.md) ve [ortak/VERI-MODELI.md](ortak/VERI-MODELI.md) dosyalarını okumalı.
Telefon tarafının kendi notları: [telefon/DEVAM-NOTU.md](telefon/DEVAM-NOTU.md) (eski depodan gelen tarihçe) ve
[telefon/README_KAYNAK.txt](telefon/README_KAYNAK.txt) (kaynak yapısı, sürüm notları).

## 1. Çalışma kuralları

- Kullanıcı elektrik mühendisi, yazılımcı değil. Türkçe, kısa, adım adım ve teknik terimsiz anlatım.
- Belirsiz yerde varsayım yapma, kullanıcıya sor; iş bitince neyin değiştiğini madde madde özetle.
- Arayüz tasarımına başlamadan önce **Google Stitch** kullanılıp kullanılmayacağı sorulur.
- Çıktılara, belgelere ve araçlara kullanıcının istemediği hiçbir firma adı ya da markası yazılmaz
  (17.10.2026'da soruldu: şu an yasaklı bir ad yok).
- Her şey bulutta durur (GitHub, Google Drive); belirli bir bilgisayara bağlı çözüm yapılmaz.
- **Gerçek proje verisi depoya konmaz** (DWG, gerçek proje dosyası, rapor, proje kodları). Testler uydurma
  örneklerle çalışır (`autocad/test/CekirdekTest/*.json`, `telefon/web/tests/`).
- Çalışan özellikleri bozma; büyük değişiklikten önce geri dönüş noktası (dal / etiket + önceki APK) bırak.
- Değişiklik açıklamaları (commit) Türkçe yazılır. Çalışma dalı → ana dala (`main`) alınınca sürümler çıkar.

## 2. Durum (17.10.2026, akşam)

| Parça | Sürüm | Durum |
| --- | --- | --- |
| Telefon uygulaması (VOLT-EDAŞ Saha) | 2.5.N (APK, `main`'e alınınca Releases) · önceki 2.4.0 | Birleştirildi, AutoCAD dosya uyumu eklendi; telefonda denenmedi |
| AutoCAD eklentisi | 0.1.N (zip, Releases) | Lejant simgeleri ve telefon dosyası okuma eklendi; AutoCAD'de denenmedi (derleme, çekirdek ve pencere denemeleri geçti) |
| Belgeler | KULLANIM, README, PLAN, VERI-MODELI, DEVIR | Güncel |

17.10.2026 işleri `volt-birlesim` dalında yapıldı; kullanıcı onayıyla `main`'e alınır. `main`'e her gönderim
otomatik derler ve yeni sürüm çıkarır (sürüm numarası derleme sırasından gelir: eklenti 0.1.N, telefon 2.5.N).

## 3. Kod haritası

- `ortak/` — proje dosyası biçimi (`VERI-MODELI.md`), `katalog/kalemler.json` (PROMAGIS malzeme kataloğu),
  `katalog/katsayilar.json` (rapor katsayıları), `katalog/semboller.json` (lejant simge takımı; üretici
  `araclar/semboller-uret.mjs`), `katalog/volt-eslesme.json` (telefon kataloğu ↔ PROMAGIS eşlemesi).
  Değişince `node araclar/ortak-tablolar.mjs` telefon kopyalarını (`telefon/web/src/ortak/*.js`) yeniler.
- `autocad/src/Cekirdek/` — AutoCAD'den bağımsız C# çekirdek: `PromagisOkuyucu` (XDATA → model), `PromagisYazici`
  (model → çizim tarifi, blok seçimi), `Semboller` (tür + cins + durum → `SH_<aile>_<varyant>`, geometri),
  `DurumTespit` + `RaporYazici` + `XlsxYazici` (rapor), `Aktarim` (telefondan alma planı), `Katalog`, `Numara`,
  `CizimAyarlari` + `Metraj`, `NoktaDosyasi`, `ProjeDosyasi` (.sebeke.json ve telefonun .volt.json'u; `telefonId`), `Model`.
- `autocad/src/Eklenti/` — AutoCAD tarafı: `Komutlar` (rapor, içe alma, dosya seçme: json / volt.json / zip),
  `CizimKomutlari` (çizim araçları, `SH_PROJEAL`), `CizimYazici` (çizime yazma; blokları `semboller.json`dan çizer),
  `Toplayici`, `Ortam`/`OrtamVerisi` (gömülü kalemler.json ve semboller.json), `Pencereler`, `Serit`.
- `autocad/test/CekirdekTest` — çekirdek denemeleri. Komutlar: `ornek` (CI), `dogrula`, `gidisdonus`, `aktarim`,
  `bosaaktar`, `katsayilar`, `semboller`.
- `autocad/test/PencereTest` — pencereleri AutoCAD'siz açıp ekran görüntüsü alır (yalnız Windows/CI).
- `telefon/` — VOLT-EDAŞ Saha: `web/src` (Preact arayüz + hesap motoru), `web/seed/standard-tedas-2026.json`
  (TEDAŞ kataloğu), `web/src/interop/sebeke.js` (telefon ↔ .sebeke.json dönüşümü) ve `sh-core.cjs` (PROMAGIS
  kurallarının JS karşılığı: proje dosyası, etiket, kanal, rapor), `web/src/export/dxf.js` (DXF; simgeler ortak tablodan),
  `web/tests` (node --test; `sebeke.test.mjs` dönüşüm testleri), `android/` (Java kabuk), `tools/` (Gradle'sız APK),
  `keystore/` (imza anahtarı), `docs/` (telefon kılavuzu).
- `.github/workflows/` — `autocad.yml` (Windows), `telefon.yml` (Linux).

## 4. Derleme ve deneme

- AutoCAD eklentisi ve APK yalnız GitHub Actions'ta derlenir. Sonuçlar: `ci-sonuc` dalı (eklenti: test günlüğü,
  derleme günlüğü, pencere ekran görüntüleri `ekran/`) ve `ci-sonuc-android` dalı (telefon). `main` dışındaki
  dallarda `ci-sonuc-dal` / `ci-sonuc-android-dal`. Paketler Releases'te (`v0.1.N`, `mobil-2.5.N`).
- Tarayıcısız durum sorgusu: `gh run list --branch <dal>`, `gh api repos/<sahip>/sebeke-hakedis/releases`;
  günlükler: `git fetch origin ci-sonuc-dal && git show origin/ci-sonuc-dal:ozet.txt`.
- Yerelde: `dotnet run --project autocad/test/CekirdekTest -c Release -- ornek` (.NET 8),
  `cd telefon/web && node --test tests/*.test.mjs` (paket kurulu değilse 1 test atlanır/başarısız olur,
  referans dosyalar yoksa 35 test atlanır).
- Claude'un bulut ortamında npm / NuGet / .NET erişimi kapalı olabilir; derleme ve tam testler CI'a bırakılır,
  yerelde bağımlılıksız testler çalıştırılır. İş akışı ekleri (artifact) buradan indirilemez; günlükler bu yüzden
  git dallarına yazılır.
- **APK imza anahtarı** `telefon/keystore/voltsaha-release.jks` (alias ve şifre `telefon/README_KAYNAK.txt`).
  Değiştirilmemeli: değişirse telefondaki uygulama güncellenemez. Sürüm kodu 1000+N (telefondaki 2.4.0 = 240'tan büyük).
- Eski telefon uygulaması (0.2.3, Kotlin + sh-core): `telefon-eski-0.2.3` dalında durur; kodu `android/`
  klasörüydü, imza anahtarı o dalda.

## 5. Gerçek veriyle doğrulama (veri depoda yok)

Kullanıcıdaki gerçek PROMAGIS çizimi (37 alt proje, 8 hakediş) ve PROMAGIS Durum Tespit dosyasıyla yapıldı.
Yeniden yapmak için kullanıcıdan DWG ve Durum Tespit dosyası istenir, `araclar/dwg-dokum` ile döküm alınır,
`CekirdekTest` ile `dogrula`, `gidisdonus`, `aktarim` çalıştırılır. Beklenen:

- Rapor: 22.048 satırın 22.045'i PROMAGIS'le eşleşir, toplam 1.540.966,1 kg birebir aynı.
- Yazıcı gidiş-dönüş: rapor satırları aynı kalır.
- Telefondan alma: o çizimden çıkmış, değişmemiş proje 17.837 nesnede 0 iş üretir.

## 6. Sıradaki işler

1. **`volt-birlesim` dalını `main`'e almak** (kullanıcı onayı) → yeni sürümler Releases'e çıkar.
2. **AutoCAD'de ilk deneme** (kullanıcı yapacak): yeni simgeler, Telefona Gönder → telefonda aç → Telefondan Al.
   Hata ayrıntısı `%TEMP%\SebekeHakedis_hata.txt`'ye yazılır.
3. **Telefonda deneme**: 2.5.x kurulumu (2.4.0 üzerine), AutoCAD dosyasından proje alma, dışa aktarma; sahada
   Bluetooth alıcı + NTRIP ile Fixed çözüm.
4. **Bulut eşitleme** (Faz 7): dosyayı Drive'a elle taşımadan eşitleme. Yöntem kullanıcıyla konuşulmalı.
5. Telefonun ofis (web) sürümü 2.3.0'da kaldı; istenirse yeni hesapta yeniden yayınlanır (`telefon/DEVAM-NOTU.md`).
6. Açık sorular PLAN.md'de (KONTROL / KM / ME, birim fiyat, malzeme eşlemesinin inceltilmesi, "ileride" objeler).

## 7. Başka hesaba geçiş

### GitHub deposu

- **Ortak çalışan eklemek** (önerilen, geri alınabilir): depo › **Settings › Collaborators › Add people** ›
  diğer hesabın kullanıcı adı. Diğer hesap e-postadaki daveti kabul eder.
- **Sahipliği devretmek**: depo › **Settings › General** › en altta **Danger Zone › Transfer** › yeni sahibin
  kullanıcı adı › onay. Sürümler, dallar ve otomatik derleme birlikte taşınır; özel depoda derleme süresi yeni
  hesabın aylık hakkından düşer.

### Claude

Bu sohbet ve Claude'un kullanıcı hakkındaki notları diğer hesaba geçmez. Diğer hesapta GitHub'ı bağlayın
(depoya erişebilen GitHub hesabıyla), bu depoyla yeni bir oturum açın ve şunu yazın:

> Bu depo "Şebeke Hakediş" projesi. Önce DEVIR.md'yi, sonra README.md, PLAN.md, KULLANIM.md ve
> ortak/VERI-MODELI.md'yi oku; DEVIR.md'deki çalışma kurallarına uy. Bana Türkçe, kısa ve adım adım yaz.
> Önce durumu iki cümleyle özetle, sonra sıradaki işi sor.
