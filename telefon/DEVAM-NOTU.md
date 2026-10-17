# VOLT-EDAŞ Saha — Devam notu (yeni Claude hesabı için)

Bu dosya projeyi başka bir Claude hesabında kaldığı yerden sürdürmek içindir. Yeni hesapta ilk iş bu dosyayı Claude'a okutun.

Son durum: **sürüm 2.4.0** (6 Ekim 2026). Telefon uygulaması (APK) 2.4.0; ofis web sürümü 2.3.0'da bırakıldı.

## Yeni hesapta başlarken

1. Yeni Claude hesabında bir proje açın (ör. "EDŞ-GNSS") ve bu dosyayı projeye belge olarak ekleyin.
2. GitHub bağlantısını açın ve `alpaslanbaygun/volt-edas-saha` deposunu oturuma tanıtın. Kod, sürüm geçmişi ve bu not oradadır.
3. Google Drive bağlantısını açın. Kurulum dosyaları ve kılavuz: Drive › Claude Çalışmaları › 07 VOLT-EDAŞ Saha Uygulaması.
4. Claude'a şunu yazmanız yeterli: "DEVAM-NOTU.md dosyasını oku, VOLT-EDAŞ Saha projesine kaldığımız yerden devam edelim."

Eski hesapta kalanlar (yeni hesaptan erişilemez, kopyaları buraya alındı):

- Claude Docs kılavuzu → Drive'da PDF ve Google Doc, depoda `docs/KULLANIM-KILAVUZU.md`.
- Web (ofis) sürümünün yayınlandığı sayfa → yeni hesapta yeniden yayınlanması gerekir (aşağıda).
- Eski projenin notları ve hafızası → bu dosyaya aktarıldı.

## Kullanıcı ve çalışma kuralları

- Kullanıcı: Alpaslan, Elazığ; elektrik mühendisliği alanında çalışıyor. Yazılım bilgisi yok: açıklamalar Türkçe, kısa, teknik terimsiz, adım adım.
- İngilizce metinlerin Türkçesi de verilmeli (ör. yabancı firmaya e-posta).
- Çalışan mevcut özellikleri ve hesapları bozma. Büyük değişiklikten önce geri dönüş noktası (git etiketi + önceki APK) bırak.
- Kullanıcının ilgisi olmayan bir firmanın adı/markası hiçbir çıktıda, belgede, kayıt anahtarında geçmemeli. Adı bu dosyaya bile yazılmadı; yeni hesapta ilk iş kullanıcıya sorup Claude hafızasına kaydettirin.
- Belirsiz yerde varsayım yapma, kullanıcıya sor.
- İş bitince neyin değiştiğini teknik terim kullanmadan madde madde özetle.
- Dosyalar bulutta dursun (GitHub, Google Drive); kullanıcı birden fazla bilgisayar kullanıyor. Ana bilgisayarı windows-tptqsk6, ana çalışma klasörü D:\.
- Arayüz tasarımı işlerinden önce Google Stitch kullanılıp kullanılmayacağını sor (kullanıcının Stitch anahtarı var).
- Ajan becerisi önerilirken yalnız GitHub'da 30 binden fazla yıldızı olan depolar dikkate alınır.

## Uygulama nedir

- EDAŞ şebeke işleri için Android saha uygulaması: direk, trafo, hat ve diğer objeleri GNSS ile koordinatlı alır; malzeme, keşif, metraj ve hakedişi bu kayıtlardan çıkarır.
- Sahada Meridian M20L alıcısı kullanılıyor. Kolida, Spectra, Geo, CHCNAV ve Trimble de gelecek; uygulamada marka seçimi gösterilmez.
- Sabit GNSS istasyonu kurulacak; uygulamada bunun için kayıtlı NTRIP profilleri var.
- Telefonu jalona takılı tek elle ve elde iki elle kullanıyor.
- Ofis için aynı koddan derlenen web sürümü var; ölçüm yalnız telefonda.

## Sürüm geçmişi

| Sürüm | Tarih | Ne geldi |
| --- | --- | --- |
| 2.4.0 | 6 Ekim 2026 | Otomatik reçete kapalı (yalnız kanal hesabı otomatik), elle malzeme ekleme, direkte armatür, menhol ve ayrı armatür menüden kalktı, kanal kaplama + yöntem (borulu geçiş, yatay sondaj), proje silme, PB köşk tipleri, hücresiz köşk, kabin ve kullanıcılar ekranına görünür girişler, alıcı markası kalktı, kayıtlı NTRIP profilleri. Yalnız telefon. |
| 2.3.0 | 6 Ekim 2026 | Kabin (hücre ekle/çıkar, kablo kanalı), Google/Yandex altlığı, DXF/NCZ çizim, tepe kuvveti, Float alım, katalog ekleri, enerji kontrolü, otomatik numara, köşk gövdesi kalemi, hakediş onay rolleri. Telefon + web. |
| 2.2.0 / 2.2.0-web | 4–5 Ekim 2026 | Teknik Spesifikasyon v2 (veri kaynağı takibi, obje bazlı hakediş durumu, Excel aktarım, fotoğraf düzeni, Base + Rover rehberi, rapor) ve ofis web sürümü. |
| 2.1.0 | — | Saha denemesi sonrası sadeleştirilmiş harita ekranı. |
| 2.0.0 | — | İlk saha sürümü (farklı imza anahtarı). |

## 2.4.0 kararları (kullanıcının cevapları)

- Otomatik reçete **tüm objelerde** kapalı; malzemeler elle eklenir, yalnız kanal hesabı otomatik. Proje bilgilerinde anahtarla açılabilir. Eski projede bir kez sorulur, seçilene kadar metraj değişmez.
- Kanal: önce kaplama (Toprak, Tüvenan, Asfalt, Beton, Parke taşı), sonra ayrı yöntem (Açık kazı / Borulu geçiş / Yatay sondaj). Beton ve Parke Claude'un eklemesi; kullanıcı onayı bekleniyor.
- Bina tipi trafo: kabin ekranından kaldırıldı (yalnız monoblok ve prefabrik köşk); trafo listesinde duruyor.
- Sabit GNSS: kayıtlı NTRIP profilleri.
- Web'e dokunulmadı; yalnız mobil güncellendi.

## Açık işler (kullanıcıdan beklenenler)

1. 2.4.0'ı telefonda denemek: kanal seçimi ve hesabı, direkte armatür, malzeme ekleme, köşk tipi + kabin, NTRIP profilleri, proje silme.
2. Asfalt / beton / parke kaplamalı kanal ve boru kalemlerinin poz numarası ve fiyatı (şu an "YEREL" kodlu, boş).
3. PB-1 … PB-4 köşk iç ölçüleri (plan çizimi şimdilik EK-1A/1B/1C tip proje ölçülerini kullanıyor).
4. Web sürümü 2.4.0'a güncellensin mi (web 2.3.0; aynı projenin metrajı web'de farklı görünür).
5. Excel şablonundaki "Armatür" sayfası kaldırılsın mı (hâlâ ayrı obje oluşturuyor).
6. Tam yedek / geri yükleme ve tek tek obje silme eklensin mi.
7. Katalogdaki "DOĞRULANACAK" kalemlerin onayı ve eksik poz numaraları (kofre, köşk içi kablo kanalı, numarasız hd hücreler, TİP-1A boş gövde, güce göre LED armatürler). Ayrıntı: `README_KAYNAK.txt`.
8. Hakediş onayındaki iki kuralın (yalnız kontrol edilmiş işler hakedişe girer / kontrol edilmiş kayıt kilitlenir) istenen davranış olduğunun teyidi.
9. Koordinat adlandırması teyidi (Y = sağa, X = yukarı).
10. Meridian'dan SDK / protokol belgesi bekleniyor (fabrikaya e-postayla soruldu, 6 Ekim 2026).

## Bilinen sınırlar

- Tam yedek / geri yükleme yok; uygulama kaldırılırsa telefondaki projeler gider.
- Alınmış obje, nokta, fotoğraf tek tek silinemez (son alım geri alınır; hat ve proje silinir). Proje kopyalama yok.
- USB GNSS yok, yalnız Bluetooth. Telefon ile web arasında otomatik eşitleme yok (`.vsync` dosyasıyla).
- Gerçek telefonda denenmeyenler: 2.4.0 kurulumu, NTRIP profil değiştirme, Meridian dışı alıcılar, Google/Yandex altlığı, büyük CAD dosyaları.

## Geri dönüş noktaları

- Git etiketleri: v2.1.0, v2.2.0, v2.2.0-web, v2.3.0, v2.4.0. Depodaki `surum-gecmisi.bundle` tüm geçmişi taşır: `git clone surum-gecmisi.bundle voltapp`.
- Telefon: 2.4.0 (sürüm kodu 240), 2.1.0 / 2.2.0 / 2.3.0'ın üzerine kurulur. Eski sürüm yenisinin üzerine kurulamaz; geri dönmek için eski kod 240'tan büyük sürüm koduyla yeniden derlenmeli.
- İmza anahtarı `keystore/voltsaha-release.jks` (2.1.0 ve sonrası aynı anahtar; şifre `README_KAYNAK.txt` içinde). Kaybolursa yeni sürümler eskilerin üzerine kurulamaz. Depo özel kalmalı.

---

## Claude için teknik bilgiler

- Arayüz: Preact + htm (WebView içinde). Paketleme esbuild. Veri: IndexedDB `volt-edas-saha` v3.
- Klasörler: `web/src` (uygulama), `web/seed/standard-tedas-2026.json` (katalog, seedRev 24), `web/tests` (otomatik testler), `web/tests/ui` (tarayıcı denemeleri, Playwright + Chromium), `android/` (Java kabuğu: Bluetooth SPP/BLE, NTRIP, telefon GNSS, dosya), `tools/` (APK derleme).
- Derleme:
  - `cd web && npm install`
  - Telefon paketi: `node build.mjs` → `web/dist/www`
  - Web (ofis): `node build.mjs --web --min` → `web/dist/web` (`page.html` + app.css, app.js, seed, fonts)
  - APK araçları: `./tools/setup_tools.sh` (npm'den aaptjs3 2.0.2 ve @drxiaozhi/minapk 0.4.0; Java 17+ gerekir), sonra `TOOLS=<araç klasörü> ./tools/build_apk.sh` → `dist/VOLT-EDAS-Saha-<sürüm>.apk`
  - Sürüm: `web/package.json` ve `android/AndroidManifest.xml` (versionCode / versionName).
- Testler: `cd web && npm test` → 130/130. Tarayıcı denemeleri: `python3 tests/ui/{smoke,web,v23_grid,v23_team,v23_web,v24_ui,v24_web}.py` (0 hata). Geçiş denemesi `tests/ui/upgrade24.py` önce v2.3.0 derlemesini ister (`git worktree add … v2.3.0`).
- `tests/ref/` altındaki referans dosyalar depoda yok; ilgili karşılaştırma testleri kendiliğinden atlanır.
- Önemli kod noktaları (2.4.0): `grid/recipe.js` (autoRecipeOn: tanımsız = eski proje, açık sayılır), `grid/lines.js` (KAPLAMA, YONTEM, kanalModel, cableQuantities), `grid/cabin-recipe.js` (koskGovdeleri: PB / TİP), `services/project-service.js` (addMaterial, deleteProject), `gnss/ntrip-profiles.js`, `ui/screens/matpick.js`.
- Web sürümünü yeni hesapta yayınlamak: `node build.mjs --web --min`, sonra `web/dist/web/page.html` sayfa olarak, `app.css`, `app.js`, `seed/standard-tedas-2026.json` ve `fonts/*.woff2` yardımcı dosya olarak yayınlanır. Eski adres (eski hesapta): https://claude.ai/artifact/79uLGyfHSm2N6KyXvG3QvM. Web verisi o sayfanın kendi deposundadır; yeni sayfa boş başlar, veri telefondan `.vsync` dosyasıyla alınır.
- Her teslimden önce kaynak, paket ve APK içi o yasaklı firma adı için taranır (adı kullanıcıdan alın).
