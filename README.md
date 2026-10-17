# Şebeke Hakediş

Elektrik dağıtım şebekesi yapım işlerinde saha ölçümü, metraj, hakediş ve Durum Tespit raporu için iki
araç: **telefon uygulaması VOLT-EDAŞ Saha** (saha) ve **AutoCAD eklentisi** (büro). İkisi aynı proje dosyasını
(`.sebeke.json`) okur ve yazar; dosya Google Drive üzerinden taşınır. Eklenti PROMAGIS'in yerine geçmek üzere
tasarlanmıştır: PROMAGIS çizimleri okunur, eklentinin çizdikleri de PROMAGIS biçimindedir.

**Kullanım kılavuzu: [KULLANIM.md](KULLANIM.md)** — kurulum, iş akışı, telefonda ve AutoCAD'de çalışma.
Telefon uygulamasının ayrıntılı kılavuzu: [telefon/docs/KULLANIM-KILAVUZU.md](telefon/docs/KULLANIM-KILAVUZU.md).

## İndirme

GitHub › **Releases**:

- `VOLT-EDAS-Saha-2.5.x.apk` — telefon uygulaması (Android 8 ve üstü; 2.1.0 ve sonrasının üzerine kurulur)
- `SebekeHakedis-0.1.x.zip` — AutoCAD eklentisi (AutoCAD 2016–2024 ve 2025+; LT hariç)

## Ne yapar?

| | Telefon (VOLT-EDAŞ Saha) | AutoCAD |
| --- | --- | --- |
| Proje dosyasını açma / yazma | Projeler › AutoCAD dosyasından al · Dışa Aktar › AutoCAD proje dosyası | `SH_PROJEAL`, `SH_ICEAL` |
| PROMAGIS çizimini okuma | — | ✓ |
| Eleman koyma (direk, trafo, SDK, pano, abone…) | GNSS ile ölçerek (RTK, telefon konumu, elle, haritadan, Excel) | `SH_ELEMAN` |
| Hat, kablo kanalı, yatay sondaj | ✓ (kaplama + yöntem) | `SH_HAT`, `SH_KANAL`, `SH_SONDAJ` |
| Bölge (alt proje) | AutoCAD'den gelen bölgeler korunur | `SH_BOLGE` |
| Ölçü noktaları | ölçerek, CSV / NCN çıktısı | `SH_NOKTAAL` (CSV/TXT) |
| Malzeme (TEDAŞ poz kataloğu) | ✓ elle ekleme, otomatik reçete seçeneği | `SH_MALZEME` (PROMAGIS kataloğu) |
| Kabin / köşk yerleşimi, tepe kuvveti, enerji kontrolü | ✓ | — |
| Fotoğraf ve not | ✓ | — |
| Metraj, Yeşil Defter, hakediş dönemi ve onay | ✓ (Excel) | `SH_OZET` |
| Durum Tespit raporu (Excel, PROMAGIS biçimi) | telefondan gelen dosyayla eklentide | `SH_RAPOR`, `SH_PROJERAPOR` |
| DXF, KMZ, SHP, GeoJSON, teslim paketi | ✓ (DXF simgeleri eklentiyle aynı) | — |

Telefon tarafı: her marka Bluetooth GNSS alıcısı (NMEA) + NTRIP (TUSAGA-Aktif, sabit istasyon profilleri) ya da
telefonun konumu; OpenStreetMap / Google / Yandex altlık; çevrimdışı çalışır.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `telefon/` | Telefon uygulaması VOLT-EDAŞ Saha (Java kabuk + WebView, Preact arayüz, JS hesap motoru, TEDAŞ kataloğu). Ayrıntı: [telefon/README.md](telefon/README.md), kaynak notları [telefon/README_KAYNAK.txt](telefon/README_KAYNAK.txt) |
| `autocad/` | AutoCAD eklentisi (C#): `src/Cekirdek` AutoCAD'den bağımsız hesap çekirdeği, `src/Eklenti` AutoCAD tarafı, `test/` denemeler, `paket/` kurulum |
| `ortak/` | Proje dosyası biçimi ([VERI-MODELI.md](ortak/VERI-MODELI.md)), rapor katsayıları, PROMAGIS malzeme kataloğu, lejant simge takımı (`semboller.json`), telefon ↔ PROMAGIS eşlemesi (`volt-eslesme.json`) |
| `araclar/` | Geliştirme araçları: AutoCAD olmadan DWG okuma, simge takımı üretimi ve önizlemesi, ortak tabloların telefona kopyalanması |

## Doğrulama

- Rapor kuralları gerçek bir PROMAGIS projesinde (37 alt proje, 8 hakediş) PROMAGIS'in kendi Durum Tespit
  raporuyla satır satır karşılaştırıldı: 22.048 satırın 22.045'i eşleşti, toplam ağırlık birebir aynı
  (1.540.966,1 kg).
- Eklentinin PROMAGIS yazıcısı aynı projeyi çizim nesnelerine yazıp geri okuyunca rapor değişmez.
- Telefondan alma: o çizimden çıkmış, değişmemiş bir proje 17.837 nesnede **sıfır** değişiklik üretir;
  aynı dosyayı iki kez almak ikinci seferde iş çıkarmaz.
- Telefon ↔ AutoCAD dönüşümü: telefon projesinin direk ağırlıkları Durum Tespit'te telefonun metrajıyla aynı;
  AutoCAD örnek dosyası telefona alınıp geri yazılınca rapor satırları ve kg toplamı aynı kalır
  (`telefon/web/tests/sebeke.test.mjs`).

## Geliştirme

- Her gönderimde GitHub Actions çalışır:
  - **AutoCAD eklentisi** (Windows): çekirdek testleri → pencere denemesi (ekran görüntüleri) → iki derleme
    → kurulum paketi → Releases. Günlükler ve ekran görüntüleri `ci-sonuc` dalına yazılır.
  - **Telefon uygulaması** (Linux): JavaScript testleri → web paketi → APK (Gradle'sız: aapt2 + ecj + d8 + apksigner)
    → Releases. Günlükler `ci-sonuc-android` dalına.
  - `main` dışındaki dallarda yalnız test ve derleme yapılır; günlükler `ci-sonuc-dal` / `ci-sonuc-android-dal` dallarına yazılır.
- Bilgisayarsız deneme: `dotnet run --project autocad/test/CekirdekTest -- ornek`,
  `cd telefon/web && node --test tests/*.test.mjs`.
- Ortak tablolar değişince: `node araclar/semboller-uret.mjs` (simgeler) ve `node araclar/ortak-tablolar.mjs` (telefon kopyaları).
- Gerçek proje dosyaları (DWG, proje verisi) depoya konmaz; testler uydurma örneklerle çalışır.
- Plan ve fazlar: [PLAN.md](PLAN.md) · Başka hesaba / oturuma devir: [DEVIR.md](DEVIR.md)
