# Şebeke Hakediş

Elektrik dağıtım şebekesi yapım işlerinde saha ölçümü, metraj, hakediş ve Durum Tespit raporu için iki
araç: **Android uygulaması** (saha) ve **AutoCAD eklentisi** (büro). İkisi aynı proje dosyasını
(`.sebeke.json`) okur ve yazar; dosya Google Drive üzerinden taşınır. PROMAGIS eklentisinin yerine geçmek
üzere tasarlanmıştır: PROMAGIS çizimleri okunur, eklentinin çizdikleri de PROMAGIS biçimindedir.

**Kullanım kılavuzu: [KULLANIM.md](KULLANIM.md)** — kurulum, iş akışı, telefonda ve AutoCAD'de çalışma.

## İndirme

GitHub › **Releases**:

- `SebekeHakedis-0.2.x.apk` — telefon uygulaması (Android 8 ve üstü)
- `SebekeHakedis-0.1.x.zip` — AutoCAD eklentisi (AutoCAD 2016–2024 ve 2025+; LT hariç)

## Ne yapar?

| | Telefon | AutoCAD |
| --- | --- | --- |
| Proje dosyasını açma / yazma | ✓ | ✓ (`SH_PROJEAL`, `SH_ICEAL`) |
| PROMAGIS çizimini okuma | — | ✓ |
| Eleman koyma (direk, box, pano, trafo, mufu) | GNSS ile ölçerek | `SH_ELEMAN` |
| Hat, kablo kanalı, sondaj | ✓ (sondaj hariç) | `SH_HAT`, `SH_KANAL`, `SH_SONDAJ` |
| Bölge (alt proje) | ✓ | `SH_BOLGE` |
| Ölçü noktaları | ölçerek, CSV çıktısı | `SH_NOKTAAL` (CSV/TXT) |
| Malzeme düzenleme (katalogdan) | ✓ | `SH_MALZEME` |
| Fotoğraf ve not | ✓ | — |
| Hakediş özeti | ✓ | `SH_OZET` |
| Durum Tespit raporu (Excel) | ✓ | `SH_RAPOR`, `SH_PROJERAPOR` |
| DXF çıktısı | ✓ | — |

Telefon tarafı: her marka Bluetooth GNSS alıcısı (NMEA) + NTRIP (TUSAGA-Aktif), ya da telefonun konumu
(M-Survey RTK gibi uygulamaların verdiği konum dahil); OpenStreetMap / Google / Yandex altlık.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `android/` | Telefon uygulaması (Kotlin + WebView arayüzü, JS hesap çekirdeği). Ayrıntı: [android/README.md](android/README.md) |
| `autocad/` | AutoCAD eklentisi (C#): `src/Cekirdek` AutoCAD'den bağımsız hesap çekirdeği, `src/Eklenti` AutoCAD tarafı, `test/` denemeler, `paket/` kurulum |
| `ortak/` | Proje dosyası biçimi ([VERI-MODELI.md](ortak/VERI-MODELI.md)), rapor katsayıları, malzeme kataloğu |
| `araclar/` | Geliştirme araçları (AutoCAD olmadan DWG okuma) |

## Doğrulama

- Rapor kuralları gerçek bir PROMAGIS projesinde (37 alt proje, 8 hakediş) PROMAGIS'in kendi Durum Tespit
  raporuyla satır satır karşılaştırıldı: 22.048 satırın 22.045'i eşleşti, toplam ağırlık birebir aynı
  (1.540.966,1 kg). Telefondaki JS çekirdeği ile C# çekirdeği aynı projede 22.048 satırı birebir aynı üretir.
- Eklentinin PROMAGIS yazıcısı aynı projeyi çizim nesnelerine yazıp geri okuyunca rapor değişmez.
- Telefondan alma: o çizimden çıkmış, değişmemiş bir proje 17.837 nesnede **sıfır** değişiklik üretir;
  aynı dosyayı iki kez almak ikinci seferde iş çıkarmaz.

## Geliştirme

- Her gönderimde GitHub Actions çalışır:
  - **AutoCAD eklentisi** (Windows): çekirdek testleri → pencere denemesi (ekran görüntüleri) → iki derleme
    → kurulum paketi → Releases. Günlükler ve ekran görüntüleri `ci-sonuc` dalına yazılır.
  - **Telefon uygulaması** (Linux): JS çekirdek testleri → Kotlin testleri → APK → Releases. Günlükler `ci-sonuc-android` dalına.
- Bilgisayarsız deneme: `dotnet run --project autocad/test/CekirdekTest -- ornek`,
  `node android/araclar/cekirdek-test.js`.
- Gerçek proje dosyaları (DWG, proje verisi) depoya konmaz; testler uydurma örneklerle çalışır.
- Plan ve fazlar: [PLAN.md](PLAN.md) · Başka hesaba / oturuma devir: [DEVIR.md](DEVIR.md)
