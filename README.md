# Şebeke-M

Elektrik dağıtım şebekesi yapım işlerinde saha ölçümü, metraj, hakediş, Durum Tespit raporu ve teknik hesaplar için
iki araç: **telefon uygulaması Şebeke-M** (saha) ve **AutoCAD eklentisi Şebeke-M** (büro). İkisi aynı proje
dosyasını (`.sebeke.json`) okur ve yazar; dosya Google Drive üzerinden taşınır. Eklenti eski hakediş programının
yerine geçmek üzere tasarlanmıştır: o programın çizimleri okunur, eklentinin çizdikleri de aynı biçimdedir.

**Kullanım kılavuzu: [KULLANIM.md](KULLANIM.md)** — kurulum, iş akışı, telefonda ve AutoCAD'de çalışma, Hesap Merkezi.
Telefon uygulamasının ayrıntılı kılavuzu: [telefon/docs/KULLANIM-KILAVUZU.md](telefon/docs/KULLANIM-KILAVUZU.md).

## İndirme

GitHub › **Releases**:

- `Sebeke-M-2.5.x.apk` — telefon uygulaması (Android 8 ve üstü; önceki sürümün üzerine projeler silinmeden kurulur)
- `SebekeHakedis-0.1.x.zip` — AutoCAD eklentisi (AutoCAD 2016–2024 ve 2025+; LT hariç)

## Ne yapar?

| | Telefon (Şebeke-M) | AutoCAD (Şebeke-M) |
| --- | --- | --- |
| Proje dosyasını açma / yazma | Projeler › AutoCAD dosyasından al · Dışa Aktar › AutoCAD proje dosyası | `SH_PROJEAL`, `SH_ICEAL` |
| Eski programın çizimini okuma | — | ✓ |
| Eleman koyma (direk, trafo, SDK, pano, abone…) | GNSS ile ölçerek (RTK, telefon konumu, elle, haritadan, Excel) | şeritte kategori › öğe, tek tıkla (`SH_HIZLI`); `SH_ELEMAN` |
| Hat, kablo kanalı, yatay sondaj | ✓ (kaplama + yöntem) | direkten direğe parçalı, her parçanın metrajı ayrı; `SH_HAT`, `SH_KANAL`, `SH_SONDAJ` |
| Görünüm (simge, renk, çizgi tipi, yazı) | ✓ | telefonla birebir aynı (`SH_GORUNUM` eski çizimi çevirir) |
| Bölge (alt proje) | AutoCAD'den gelen bölgeler korunur (grup kodu dahil) | `SH_BOLGE` |
| Ölçü noktaları | ölçerek, CSV / NCN çıktısı | `SH_NOKTAAL` (CSV/TXT) |
| Malzeme (TEDAŞ poz kataloğu) | ✓ elle ekleme, otomatik reçete seçeneği | `SH_MALZEME` (2 934 kalemlik katalog) |
| **Teknik hesaplar (Hesap Merkezi)**: sehim, uplift, ag–aw, Amax, iletken kopma, tepe kuvveti (TEDAŞ / cer vektörü), OG–AG gerilim düşümü, OG–AG kısa devre, Cu ⇄ Al kesit, beton köşk yerleşimi, kanal planı, AG tek hat | ✓ (objeden açılır, bilgiler projeden dolar, sonuç projeye kaydedilir) | ✓ (`SH_HESAP`, `SH_HESAPLAR`; sonuç çizime kaydedilir, raporun HESAPLAR sayfasına yazılır) |
| Kabin / köşk yerleşimi, tepe kuvveti, enerji kontrolü (eski ekranlar) | ✓ | — |
| Fotoğraf ve not | ✓ | — |
| Metraj, Yeşil Defter, hakediş dönemi ve onay | ✓ (Excel; onaylı dönem AutoCAD'e onay olarak gider) | `SH_OZET`, `SH_ONAY` (Kontrol → Hakediş → GIS, onaylı hakediş kilitli) |
| Kullanıcılar, roller, hakediş yetkisi | ✓ (Kullanıcılar ve onay; yazmaya kapalı hakedişler) | `SH_KULLANICILAR`, `SH_OTURUM` (aynı kullanıcılar ve şifreler; onay aşamaları rolle) |
| Durum Tespit raporu (Excel, eski programın biçimi) | telefondan gelen dosyayla eklentide | `SH_RAPOR`, `SH_PROJERAPOR` |
| Eksik malzeme (DETAY sorgusu) | — | `SH_DETAY` |
| DXF, Google Earth (KMZ), CBS (MIF / MID), SHP, GeoJSON, teslim paketi | ✓ (DXF simgeleri, Google Earth ve MIF / MID eklentiyle aynı) | `SH_KML`, `SH_MIFVER` (ve `SH_MIFAL` ile CBS'den alma) |

Telefon tarafı: her marka Bluetooth GNSS alıcısı (NMEA) + NTRIP (TUSAGA-Aktif, sabit istasyon profilleri) ya da
telefonun konumu; açık sokak haritası ve anahtarla uydu / diğer altlıklar (eklentiyle aynı liste); harita çizimdeki
renk, çizgi ve yazılarla görünür; çevrimdışı çalışır.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `telefon/` | Telefon uygulaması Şebeke-M (Java kabuk + WebView, Preact arayüz, JS hesap motoru, TEDAŞ kataloğu). Ayrıntı: [telefon/README.md](telefon/README.md), kaynak notları [telefon/README_KAYNAK.txt](telefon/README_KAYNAK.txt) |
| `autocad/` | AutoCAD eklentisi (C#): `src/Cekirdek` AutoCAD'den bağımsız hesap çekirdeği, `src/Eklenti` AutoCAD tarafı (şerit, pencereler, Hesap Merkezi sunucusu), `test/` denemeler, `paket/` kurulum |
| `ortak/` | Proje dosyası biçimi ([VERI-MODELI.md](ortak/VERI-MODELI.md)), rapor katsayıları, malzeme kataloğu (2 934 kalem), lejant simge takımı (`semboller.json`), ortak çizim stili (`cizim-stili.json`), şerit kategorileri (`kategoriler.json`), telefon ↔ eski program eşlemesi (`volt-eslesme.json`), eski programın inceleme notları ([CIZIM-BICIMI-NOTLARI.md](ortak/CIZIM-BICIMI-NOTLARI.md)), marka (`marka/`), **Hesap Merkezi** (`hesap/`: hesap sayfaları, köprü, tema, uyarlamalar, denemeler; sözleşme [hesap/BAGLAM.md](ortak/hesap/BAGLAM.md)) |
| `araclar/` | Geliştirme araçları: AutoCAD olmadan DWG okuma, simge takımı üretimi ve önizlemesi, ortak tabloların telefona kopyalanması, Hesap Merkezi paketleyicisi (`hesap-paketle.mjs`) ve deneme koşucusu (`hesap-dene.py`) |

## Doğrulama

- Rapor kuralları gerçek bir projede (37 alt proje, 8 hakediş) eski programın kendi Durum Tespit raporuyla satır
  satır karşılaştırıldı: 22.048 satırın 22.045'i eşleşti, toplam ağırlık birebir aynı (1.540.966,1 kg).
- Eklentinin çizim yazıcısı aynı projeyi çizim nesnelerine yazıp geri okuyunca rapor değişmez.
- Telefondan alma: o çizimden çıkmış, değişmemiş bir proje 17.837 nesnede **sıfır** değişiklik üretir;
  aynı dosyayı iki kez almak ikinci seferde iş çıkarmaz.
- Telefon ↔ AutoCAD dönüşümü: telefon projesinin direk ağırlıkları Durum Tespit'te telefonun metrajıyla aynı;
  AutoCAD örnek dosyası telefona alınıp geri yazılınca rapor satırları ve kg toplamı aynı kalır; kalemlerin INDEX
  sırası, hakedişi ve KONTROL işareti, bölge grup kodu, pano çıkış şeması, hat parçaları, hakediş onayları ve hesap
  kayıtları korunur (`telefon/web/tests/sebeke.test.mjs`).
- Hesap Merkezi: 15 hesabın uyarlaması 70 deneme durumuyla (telefon ve masaüstü boyutunda) sınanır; altın değerler
  değiştirilmemiş özgün hesap dosyalarından alınmıştır (`python3 araclar/hesap-dene.py`). Eklentinin bağlam, kayıt,
  güncellik ve yerel sunucu kuralları `CekirdekTest`'te sınanır.

## Geliştirme

- Her gönderimde GitHub Actions çalışır:
  - **AutoCAD eklentisi** (Windows): hesap sayfaları paketlenir → çekirdek testleri → pencere denemesi (ekran
    görüntüleri) → iki derleme → kurulum paketi → Releases. Günlükler ve ekran görüntüleri `ci-sonuc` dalına yazılır.
  - **Telefon uygulaması** (Linux): JavaScript testleri → web paketi (hesap sayfaları dâhil) → APK (Gradle'sız:
    aapt2 + ecj + d8 + apksigner) → Releases. Günlükler `ci-sonuc-android` dalına.
  - `main` dışındaki dallarda yalnız test ve derleme yapılır; günlükler `ci-sonuc-dal` / `ci-sonuc-android-dal` dallarına yazılır.
- Bilgisayarsız deneme: `dotnet run --project autocad/test/CekirdekTest -- ornek`,
  `cd telefon/web && node --test tests/*.test.mjs`, `python3 araclar/hesap-dene.py [hesap…] [--boyut 390x844]`.
- Ortak tablolar değişince: `node araclar/semboller-uret.mjs` (simgeler) ve `node araclar/ortak-tablolar.mjs` (telefon kopyaları).
  Hesap sayfaları: `node araclar/hesap-paketle.mjs` (çıktı `ortak/hesap/paket/`, depoya konmaz).
- Gerçek proje dosyaları (DWG, proje verisi) depoya konmaz; testler uydurma örneklerle çalışır.
- Plan ve fazlar: [PLAN.md](PLAN.md) · Başka hesaba / oturuma devir: [DEVIR.md](DEVIR.md)
