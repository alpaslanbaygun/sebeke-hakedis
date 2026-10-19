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
- Çıktılara, belgelere ve araçlara kullanıcının istemediği hiçbir firma adı ya da markası yazılmaz.
  **Eski hakediş programının adı ve dağıtım şirketinin adı kullanıcıya görünen hiçbir yerde geçmez** (18.10.2026);
  belgelerde "eski program" denir. Kod kimlikleri (`NesneOkuyucu` vb.) kullanıcıya görünmediği için kaldı.
- Ürün adı **Şebeke-M** (logo `ortak/marka/`); telefon uygulaması ve eklenti bu adla görünür.
- Her şey bulutta durur (GitHub, Google Drive); belirli bir bilgisayara bağlı çözüm yapılmaz.
- **Gerçek proje verisi depoya konmaz** (DWG, gerçek proje dosyası, rapor, proje kodları). Testler uydurma
  örneklerle çalışır (`autocad/test/CekirdekTest/*.json`, `telefon/web/tests/`).
- Çalışan özellikleri bozma; büyük değişiklikten önce geri dönüş noktası (dal / etiket + önceki APK) bırak.
- Değişiklik açıklamaları (commit) Türkçe yazılır. Çalışma dalı → ana dala (`main`) alınınca sürümler çıkar.

## 2. Durum (19.10.2026)

| Parça | Sürüm | Durum |
| --- | --- | --- |
| Telefon uygulaması (Şebeke-M) | 2.5.N (APK, Releases) | AutoCAD dosya uyumu, eski program durum kodları, INDEX / KONTROL / onayların korunması, harita altlıkları (anahtarlı), **Hesap Merkezi** (15 hesap); telefonda denenmedi |
| AutoCAD eklentisi (Şebeke-M) | 0.1.N (zip, Releases) | İki şerit sekmesi, telefonla aynı görünüm, parçalı hat, tam katalog, eski program ortak kayıtları, eksik malzeme, hakediş onayı, **Hesap Merkezi** (yerel sunucu + tarayıcı sayfaları, kayıt çizimde, HESAPLAR rapor sayfası); AutoCAD'de denenmedi (derleme, çekirdek ve pencere denemeleri CI'da) |
| Belgeler | KULLANIM, README, PLAN, VERI-MODELI, CIZIM-BICIMI-NOTLARI, DEVIR, ortak/hesap/BAGLAM | Güncel |

19.10 (`sebeke-m` dalı; geri dönüş: `onceki-main-sebeke-m-oncesi` dalı): Şebeke-M markası, harita altlıkları ve
**Hesap Merkezi**: Baki SONAY'ın 14 HTML hesap aracı (`ortak/hesap/kaynak`, formüller değiştirilmedi; yapılan
temizlik `kaynak/DEGISIKLIKLER.md`) ortak köprü (`kopru-bas.js`, `kopru.js`), koyu tema (`tema.css`) ve hesap
başına uyarlama (`uyarlama/<id>.js|css`) ile telefona (iframe, postMessage) ve AutoCAD'e (yerel HTTP sunucu
`HesapSunucu`, Edge uygulama penceresi, `HesapMerkezi.cs`) bağlandı. Bağlam / kayıt / güncellik sözleşmesi
`ortak/hesap/BAGLAM.md`; paketleyici `araclar/hesap-paketle.mjs` (derlemede çalışır, `ortak/hesap/paket` depoya
konmaz); deneme koşucusu `araclar/hesap-dene.py` (Playwright; 70 durum, masaüstü + telefon boyutu). Hesap
araçlarının tablolarında saptanan ve **aracın sahibiyle doğrulanması gereken** değerler her hesabın ⓘ panelindeki
"Hesap hakkında" notlarında ve `uyarlama/<id>.js` içindeki `notlar` listesinde yazılıdır (değiştirilmedi).

17.10 işleri `volt-birlesim`, 18.10 işleri (eski program öneri listesinin tamamı + şerit + görünüm + parçalı hat)
`serit-ve-stil` dalında yapıldı ve `main`'e alındı. 18.10 öğleden sonra: Google Stitch tasarımıyla şerit ve bütün
pencereler koyu temada yeniden kuruldu (`koyu-tema` dalı; geri dönüş: `onceki-main-koyu-tema-oncesi` dalı ve
Releases'teki eklenti 0.1.32). 18.10 akşam (`hat-malzeme-simge` dalı; geri dönüş: `onceki-main-hat-malzeme-oncesi`
dalı ve Releases'teki eklenti 0.1.36, telefon 2.5.21): hat çekerken elemanlara simge boyutunda yakalama, çoklu iletken / adet / müşterek OG + AG, cins seçimi ve
katalog sırası, malzeme hafızası ve toplu malzeme, armatürün direğe malzeme + yanına simge (direkle birlikte gider),
durum simgeleri (yeni, mevcut, DM+M, DM, kesik, sökük). `main`'e her gönderim otomatik derler ve yeni sürüm çıkarır
(sürüm numarası derleme sırasından gelir: eklenti 0.1.N, telefon 2.5.N). Geri dönüş: `onceki-main-2026-10-18`
dalı (önceki `main`; eklenti 0.1.16 ve telefon 2.5.8 Releases'te durur).

## 3. Kod haritası

- `ortak/` — proje dosyası biçimi (`VERI-MODELI.md`), `katalog/kalemler.json` (eski program malzeme kataloğu),
  `katalog/katsayilar.json` (rapor katsayıları), `katalog/semboller.json` (lejant simge takımı; üretici
  `araclar/semboller-uret.mjs`), `katalog/volt-eslesme.json` (telefon kataloğu ↔ eski program eşlemesi).
  Değişince `node araclar/ortak-tablolar.mjs` telefon kopyalarını (`telefon/web/src/ortak/*.js`) yeniler.
- `autocad/src/Cekirdek/` — AutoCAD'den bağımsız C# çekirdek: `NesneOkuyucu` (XDATA → model), `NesneYazici`
  (model → çizim tarifi, blok seçimi, `ANA`/`CON`/`FIDER` ek verisi, armatür simgesi), `Semboller` (tür + cins + durum +
  demontaj türü → `SH_<aile>_<varyant>`, geometri, aile ölçüleri), `Iletkenler` (çoklu iletken: adet yazımı `Nx(…)`,
  birleşik ana kesit, metraj), `MalzemeHafizasi` (son elemanın malzemeleri; tür + cins + tip anahtarı), `CizimStili` (ortak renk / çizgi tipi / yazı), `Kategoriler` (şerit kategorileri),
  `DurumTespit` + `RaporYazici` + `XlsxYazici` (rapor), `DetaySorgu` (eksik malzeme / DETAY), `HakedisOnayi` (onay
  bitleri, kilit kuralları), `Aktarim` (telefondan alma planı; parça kuralı, ek veri, kilit), `Katalog` (sürüm 2,
  tarife kuralı), `Numara`, `CizimAyarlari` + `Metraj`, `NoktaDosyasi`, `ProjeDosyasi` (.sebeke.json ve .volt.json),
  `Model`.
- `autocad/src/Eklenti/` — AutoCAD tarafı: `Komutlar` (rapor, içe alma, `SH_DETAY`, dosya seçme), `CizimKomutlari`
  (çizim araçları, `SH_HIZLI`, `SH_GORUNUM`, `SH_ONAY`, `SH_PROJEAL`, `SH_TOPLUMALZEME`; yakalama `Geometri.YakinEleman`),
  `CizimYazici` (çizime yazma; blokları `semboller.json`dan çizer, blok sürümü, parça metrajı yazıları, armatür simgesi),
  `ArmaturTakibi` (armatür simgesini AutoCAD komutlarında direkle birlikte taşır / kopyalar / siler; `SH_ARM` bağı),
  `Serit` + `SeritSimgeleri` + `HizliSecim` (dinamik şerit: Cins / Tip / Ara, Durum, Adet / 2. iletken, Malzeme
  bölümü; son seçimler, malzeme hafızası ve pencerelerin "son kullanılanlar" listesi `%APPDATA%\SebekeHakedis\serit.json`),
  `ArayuzSimgeleri` (şerit ve pencerelerin çizgi simgeleri, WPF ile çizilir), `KoyuTema` (koyu pencere parçaları:
  başlık çubuğu, düğme, onay / seçim kutusu, açılır liste, sayı kutusu, iki satırlı liste, sekme, bilgi çubuğu,
  koyu tablo ve ileti kutusu; ölçü 96 DPI'a göre, `Olcu.S()` ile büyür), `CizimSozlugu` (eski programın çizim sözlüğü: SAYAC,
  HakNo, DicBölge, HAK_ONAY), `Toplayici`, `Ortam`/`OrtamVerisi` (gömülü kalemler / semboller / cizim-stili /
  kategoriler), `Pencereler`.
- `araclar/katalog-aktar.py` — eski program veri dosyasından (kullanıcıdan alınır, depoya konmaz) `kalemler.json` üretir.
- `autocad/test/CekirdekTest` — çekirdek denemeleri. Komutlar: `ornek` (CI), `dogrula`, `gidisdonus`, `aktarim`,
  `bosaaktar`, `katsayilar`, `semboller`.
- `autocad/test/PencereTest` — pencereleri AutoCAD'siz açıp ekran görüntüsü alır; şeridin önizlemesini de çizer
  (`ekran/14-serit-*.png`, `15-serit-demontaj.png`, `16`/`17` tip listeleri ve durum simgeleri, `18-serit-musterek-hat`;
  pencerelerden `01c` cins + kesik, `03b` müşterek, `03c` adet, `23` toplu malzeme) (yalnız Windows/CI). Önizleme
  AutoCAD'in koyu temasına benzer zeminle çizilir; gerçek şeridin zemini AutoCAD temasından gelir.
- `telefon/` — Şebeke-M: `web/src` (Preact arayüz + hesap motoru), `web/seed/standard-tedas-2026.json`
  (TEDAŞ kataloğu), `web/src/interop/sebeke.js` (telefon ↔ .sebeke.json dönüşümü) ve `sh-core.cjs` (eski program
  kurallarının JS karşılığı: proje dosyası, etiket, kanal, rapor), `web/src/export/dxf.js` (DXF; simgeler ortak tablodan),
  `web/tests` (node --test; `sebeke.test.mjs` dönüşüm testleri), `android/` (Java kabuk), `tools/` (Gradle'sız APK),
  `keystore/` (imza anahtarı), `docs/` (telefon kılavuzu).
- `ortak/hesap/` — Hesap Merkezi: `kaynak/<id>.html` (araçlar), `moduller.json` (hesap listesi, gruplar, hangi
  hedefe uygun), `kopru-bas.js` + `kopru.js` (sayfa köprüsü: üst çubuk, bağlam doldurma, eksikler, kayıt, güncellik,
  telefonda yazdırma / dosya), `tema.css`, `kurallar.mjs` (iletken çözümleme, uygunluk, güncellik farkları; telefon
  doğrudan, sayfalar `kurallar.js` olarak), `uyarlama/<id>.js|css` (hesap başına bağlam → alanlar, sonuç okuma,
  durum kaydet / yükle, notlar), `dene/<id>.json` (deneme durumları, altın değerler), `merkez.html` (AutoCAD'in
  hesap merkezi sayfası), `BAGLAM.md` (sözleşme). Telefon tarafı: `telefon/web/src/hesap/baglam.js` (projeden
  bağlam), `kayitlar.js` (kayıtlar `documents` kind HESAP), `ui/screens/hesap.js` (liste + iframe). AutoCAD tarafı:
  `Cekirdek/HesapBaglami.cs` (çizimden bağlam; zincir kuralı), `Hesaplar.cs` (kayıt, güncellik, iletken anahtarı),
  `HesapSunucu.cs` (127.0.0.1, rastgele kapı ve anahtar), `Eklenti/HesapMerkezi.cs` (`HesapDeposu` NOD kayıtları,
  oturumlar, API, Edge; `SH_HESAP`, `SH_HESAPLAR`).
- `.github/workflows/` — `autocad.yml` (Windows; önce `node araclar/hesap-paketle.mjs`), `telefon.yml` (Linux).

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

Kullanıcıdaki gerçek eski program çizimi (37 alt proje, 8 hakediş) ve eski program Durum Tespit dosyasıyla yapıldı.
Yeniden yapmak için kullanıcıdan DWG ve Durum Tespit dosyası istenir, `araclar/dwg-dokum` ile döküm alınır,
`CekirdekTest` ile `dogrula`, `gidisdonus`, `aktarim` çalıştırılır. Beklenen:

- Rapor: 22.048 satırın 22.045'i eski programla eşleşir, toplam 1.540.966,1 kg birebir aynı.
- Yazıcı gidiş-dönüş: rapor satırları aynı kalır.
- Telefondan alma: o çizimden çıkmış, değişmemiş proje 17.837 nesnede 0 iş üretir.

## 6. Sıradaki işler

0. **Hesap Merkezi'nin gerçek denemesi** (kullanıcı yapacak): AutoCAD'de bir direk seçip Hesap Merkezi; Edge
   penceresinde sayfanın açılması, Kaydet, çizimi kaydedip yeniden açınca kaydın durması, Telefona Gönder → telefonda
   kaydın görünmesi; telefonda bir hesabı kaydedip Telefondan Al ile çizime gelmesi. Hesap sahibi (Baki SONAY) ile
   ⓘ panellerindeki doğrulanacak tablo değerleri görüşülmeli.
1. **AutoCAD'de ilk deneme** (kullanıcı yapacak): koyu şerit ve pencereler (kategori → öğe → çizim, Ara kutusu,
   yüksek DPI'da pencereler), yeni görünüm, parçalı hat; 18.10 akşam işleri: direğe / SDK'ya tıklayınca yakalama,
   cins seçimi, iki iletken / adet / müşterek, malzeme hafızası, toplu malzeme, armatür (taşı / kopyala / sil / geri al),
   durum simgeleri;
   Telefona Gönder → telefonda aç → Telefondan Al, `SH_ONAY` / `SH_DETAY`; eski programla aynı çizimde sırayla
   çalışma (INDEX, aktif hakediş, bölge listesi, onaylar). Hata ayrıntısı `%TEMP%\SebekeHakedis_hata.txt`'ye yazılır.
2. **Telefonda deneme**: 2.5.x kurulumu, AutoCAD dosyasından proje alma, eski program durum kodları, dışa aktarma;
   sahada Bluetooth alıcı + NTRIP ile Fixed çözüm.
3. **Bulut eşitleme** (Faz 7): dosyayı Drive'a elle taşımadan eşitleme. Yöntem kullanıcıyla konuşulmalı.
4. İstenirse: pano çıkış şeması / hücre düzenleme penceresi, sondaj metrajının telefonda AutoCAD değeriyle korunması
   (şimdi telefon geometriden hesaplar), eski program parolaları ve `HAK_YETKİ`.
5. Telefonun ofis (web) sürümü 2.3.0'da kaldı; istenirse yeni hesapta yeniden yayınlanır (`telefon/DEVAM-NOTU.md`).
6. Açık sorular PLAN.md'de (birim fiyat, malzeme eşlemesinin inceltilmesi, "ileride" objeler).

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

> Bu depo "Şebeke-M" (eski adıyla Şebeke Hakediş) projesi. Önce DEVIR.md'yi, sonra README.md, PLAN.md, KULLANIM.md ve
> ortak/VERI-MODELI.md'yi oku; DEVIR.md'deki çalışma kurallarına uy. Bana Türkçe, kısa ve adım adım yaz.
> Önce durumu iki cümleyle özetle, sonra sıradaki işi sor.
