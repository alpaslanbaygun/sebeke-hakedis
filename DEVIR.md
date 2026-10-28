# Devir notu

Bu proje başka bir hesaba (GitHub ya da Claude) geçerken sohbet geçmişi taşınmaz. Devam etmek için
gereken her şey bu depodadır. Yeni oturum önce bu dosyayı okur; dosya ve kural ararken otomatik dizin
[HARITA.md](HARITA.md) kullanılır. [README.md](README.md), [PLAN.md](PLAN.md), [KULLANIM.md](KULLANIM.md) ve
[ortak/VERI-MODELI.md](ortak/VERI-MODELI.md) iş gerektirdiğinde okunur (hepsini her oturumda baştan okumak işi
yavaşlatır). Claude'un her oturumda kendiliğinden okuduğu kısa not: [CLAUDE.md](CLAUDE.md).
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

## 2. Durum (25.10.2026)

| Parça | Sürüm | Durum |
| --- | --- | --- |
| Telefon uygulaması (Şebeke-M) | 2.5.N (APK, Releases) | AutoCAD dosya uyumu, eski program durum kodları, INDEX / KONTROL / onayların korunması, harita altlıkları (anahtarlı), **Hesap Merkezi** (15 hesap), **düzeltme kaynakları** (TUSAGA-Aktif / sabit istasyon / yerel CORS; NTRIP ya da doğrudan IP, akış denemesi, istasyon uzaklığı, bağlantı bilgisi dosyası); telefonda denenmedi |
| AutoCAD eklentisi (Şebeke-M) | 0.1.N (zip, Releases) | İki şerit sekmesi, telefonla aynı görünüm, parçalı hat, tam katalog, eski program ortak kayıtları, eksik malzeme, hakediş onayı, **Hesap Merkezi** (yerel sunucu + tarayıcı sayfaları, kayıt çizimde, HESAPLAR rapor sayfası). 25.10: AutoCAD 2027'de canlı denendi (aşağıda) |
| Belgeler | KULLANIM, README, PLAN, VERI-MODELI, CIZIM-BICIMI-NOTLARI, DEVIR, ortak/hesap/BAGLAM, HARITA (otomatik), CLAUDE | Güncel |

25.10 canlı deneme (AutoCAD 2027, eklenti 0.1.52, uydurma örnek proje): Telefondan Al (72 nesne), Hesap Merkezi (AG
hattı seçildi, zincir dallanmadan düz geçti), AG gerilim düşümü sayfası (46 bilgi çizimden), Kaydet / yeniden aç /
güncelle, merkezde kayıt listesi ve rozet, Çizimde göster (yakınlaştırma + seçim), Kayıtlı Hesaplar: **çalıştı**.
Bulunan ve `sebeke-m` dalında düzeltilen hatalar:
1. **Eklentinin yazdığı çizim kaydedilip yeniden açılınca AutoCAD çöküyordu** ("Unhandled Access Violation");
   RECOVER 72 nesnenin hepsini `eWrongObjectType` ile attı. Neden: `CizimYazici.XdataYaz` değeri olmayan uygulama
   bölümlerini yalnız adıyla yazıyordu; AutoCAD sıfır uzunluklu bölümü saklıyor, DWG okuyucusu bunu verinin sonu
   sayıp arkasındaki bölümleri bozuyor. Artık değersiz bölüm yazılmaz; eski veri silinirken AutoCAD'in belgelenmiş
   yolu kullanılır, AutoCAD bölümü değersiz bırakırsa tek boş dizgi yazılır (`Toplayici.XdataSil`; okuyucu yok sayar).
   **Bu hata 0.1.52 ve öncesinin Telefondan Al ile çizdiği her çizimde vardı**: böyle bir çizim kaydedilmişse açılışta
   nesneler kaybolur (RECOVER ile açılır ama nesneler gelmez); projeyi telefon dosyasından yeniden almak gerekir.
   **0.1.58 ile canlı doğrulandı (25.10 akşam):** Telefondan Al (72 nesne) → kaydet → kapat → aç: nesneler yerinde,
   `AUDIT` 0 hata; direk SC108'e tepe kuvveti hesabı kaydı → kaydet → aç: "1 hesap kaydı okundu"; gerçek bir eski
   program çiziminin kopyası `SH_GORUNUM` ile çevrildi (396 nesne) → kaydet → aç: 286 eleman / 99 hat / 10 kanal,
   Durum Tespit raporu orijinalinkiyle birebir aynı (bütün sayfalar, tanıtıcılar dâhil). O çizimdeki 5 `AUDIT`
   uyarısı (eski tip POLYLINE köşelerinde katman farkı) orijinalde de aynı numaralarla var; dönüşümden gelmiyor.
2. Boş NIT bölümlü GPS noktası okuyucuda eleman sayılıyor, direkle aynı yerdeki bu sahte eleman hesap zincirinin
   düğümü oluyordu (branşman noktası "2FA" gibi tanıtıcı çıktı). Okuyucu artık yalnız değeri olan bölüme bakar.
3. Hesap kaydı Xrecord parçaları 1000 → 250 karakter (DXF 1 dizgi sınırı; çökmenin asıl nedeni değildi ama güvenli).
4. Hesap sayfasında AutoCAD'de merkeze dönüş düğmesi yoktu; kayıtlı hesapta değişiklik yapınca çip uyarmıyordu.
Deneme ortamı notları: sayfa Edge yoksa varsayılan tarayıcıda (Chrome) açıldı; Claude'un bilgisayar kullanımında
AutoCAD'in dosya pencerelerine yazı yazılamıyor, `FILEDIA 0` ile komut satırından yol verildi (sonra 1'e alındı).

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

- Otomatik dizin [HARITA.md](HARITA.md) (28.10.2026): iki platformda aynı kuralı uygulayan dosya çiftleri, değişince
  en çok yeri etkileyen dosyalar, komutların tanımlandığı ve anıldığı yerler, her dosya için bir satır. Dosya eklenince,
  silinince ya da görevi değişince `python3 araclar/kod-haritasi/kod_haritasi.py` ile yenilenir (networkx gerekir);
  `--sayfa harita.html` aynı bilgiden yakınlaştırılabilir harita sayfası da üretir (numpy gerekir).
- Claude Code ayarı (`.claude/`, 28.10.2026): `settings.json`'daki kanca (`araclar/kod-haritasi/kanca.py`) oturumdaki
  ilk dosya aramasında Claude'a haritayı hatırlatır; dosya eklenip silinmiş de harita yenilenmemişse bunu söyler.
  Aramayı engellemez, python3 yoksa sessiz kalır. `/harita` becerisi (`skills/harita`) haritayı yeniler ve istenirse
  sayfasını yayımlar (yayımlı sayfa: https://claude.ai/artifact/PJLGVnejxTfozyomQzkGi9).
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
  `keystore/` (imza anahtarı), `docs/` (telefon kılavuzu; GNSS / düzeltme dosyalarının haritası ve sabit istasyon
  gereksinimleri `docs/GNSS-BAGLANTI.md`).
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
- **Eklentinin kurulumu ve imzası** (26.10.2026): `KUR.bat` eklentiyi `%ProgramFiles%\Autodesk\ApplicationPlugins`'e
  kurar (bir kez yönetici izni). Autodesk'e göre bu klasördeki eklentiler güvenilirdir ve imzaları denetlenmez; bu
  yüzden DLL imzasız olsa da AutoCAD "imzalanmamış dosya" uyarısı göstermez. İzin verilmezse kullanıcı klasörüne
  (`%APPDATA%\…`) kurar, o zaman uyarı çıkar. Başka klasörlerde kalan eski kopyaları siler (iki kez yüklenmesin).
  CI'daki "Kurulum denemesi" adımı kurup kaldırarak sınar (`KUR.bat /sessiz`, `KALDIR.bat /sessiz`).
  DLL'ler imzasızdır; gerçek imza satın alınmış bir kod imzalama sertifikası ister (kullanıcı kararı). CI'daki
  "İmzala" adımı hazırdır: depo sırları `IMZA_PFX` (PFX'in base64 hâli) ve `IMZA_PAROLA` tanımlanınca iki DLL
  SHA-256 ve zaman damgasıyla imzalanır, sonuç `ozet.txt`'ye yazılır. 2023'ten beri satılan sertifikaların anahtarı
  donanımda ya da bulutta durduğu için çoğu PFX olarak verilmez; o durumda sağlayıcının imzalama aracı bu adıma
  eklenir. Kendinden imzalı sertifikayı kullanıcının bilgisayarlarına "güvenilir kök" olarak kurdurmak önerilmez.
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

0. **Gerçek telefonda deneme** (AutoCAD tarafı 25.10'da canlı doğrulandı, yukarıda): AutoCAD'den gelen hesap
   kaydının telefonda görünmesi ve "güncel" kalması (telefon koduyla kapta denendi; rekortman kolu düzeltmesi A10),
   telefonda bir hesabı kaydedip Telefondan Al ile çizime gelmesi. Hesap sahibi (Baki SONAY) ile ⓘ panellerindeki
   doğrulanacak tablo değerleri görüşülmeli (ör. tepe kuvveti AER yer tutucu değerleri: SC108'de "1,0 kg").
   Eski program çiziminde telefon kataloğunda karşılığı olmayan hat tipleri (`4P+R`, `5R`, `R`, `3R`, `3A+P+R`):
   metraj korunuyor; katalog kaydı için poz / birim fiyat bilgisi gerekir.
1. **AutoCAD'de ilk deneme** (kullanıcı yapacak): koyu şerit ve pencereler (kategori → öğe → çizim, Ara kutusu,
   yüksek DPI'da pencereler), yeni görünüm, parçalı hat; 18.10 akşam işleri: direğe / SDK'ya tıklayınca yakalama,
   cins seçimi, iki iletken / adet / müşterek, malzeme hafızası, toplu malzeme, armatür (taşı / kopyala / sil / geri al),
   durum simgeleri;
   Telefona Gönder → telefonda aç → Telefondan Al, `SH_ONAY` / `SH_DETAY`; eski programla aynı çizimde sırayla
   çalışma (INDEX, aktif hakediş, bölge listesi, onaylar). Hata ayrıntısı `%TEMP%\SebekeHakedis_hata.txt`'ye yazılır.
2. **Telefonda deneme**: 2.5.x kurulumu, AutoCAD dosyasından proje alma, eski program durum kodları, dışa aktarma;
   sahada Bluetooth alıcı + düzeltme ile Fixed çözüm (TUSAGA-Aktif ya da sabit istasyon: `Akışı dene`, istasyon
   uzaklığı, doğrudan IP; alıcı bağlanınca kendiliğinden bağlanma). Sabit istasyon kurulunca bilgileri "Sabit istasyon"
   profiline girilir (gereksinimler `telefon/docs/GNSS-BAGLANTI.md` › 4).
3. **Bulut eşitleme** (Faz 7): dosyayı Drive'a elle taşımadan eşitleme. Yöntem kullanıcıyla konuşulmalı.
4. İstenirse: pano çıkış şeması / hücre düzenleme penceresi, sondaj metrajının telefonda AutoCAD değeriyle korunması
   (şimdi telefon geometriden hesaplar), eski program parolaları ve `HAK_YETKİ`.
5. Telefonun ofis (web) sürümü 2.3.0'da kaldı; istenirse yeni hesapta yeniden yayınlanır (`telefon/DEVAM-NOTU.md`).
6. Açık sorular PLAN.md'de (birim fiyat, malzeme eşlemesinin inceltilmesi, "ileride" objeler).
7. **Tek ortak malzeme listesi** (telefon ve AutoCAD aynı liste; kullanıcı isteği 18.10): başlandı, 25.10'da kullanıcı
   isteğiyle bekletiliyor. Tasarım: TEDAŞ poz kataloğu ile eski program kalem listesi tek dosyada birleşir; iki listenin
   ortak adı az (yalnız direk tiplerinin ~530'u eşleşiyor), kalan kalemler iki tarafa da eklenir.
8. **Kod imzalama sertifikası** (isteğe bağlı, kullanıcı kararı): güvenlik uyarısı kurulum klasörüyle çözüldü; DLL'lerin
   gerçekten imzalı olması istenirse ticari bir kod imzalama sertifikası alınır, CI'daki "İmzala" adımına bağlanır.

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

> Bu depo "Şebeke-M" (eski adıyla Şebeke Hakediş) projesi. Önce DEVIR.md'yi oku; dosya ararken HARITA.md'yi kullan,
> diğer belgeleri iş gerektirdiğinde aç; DEVIR.md'deki çalışma kurallarına uy. Bana Türkçe, kısa ve adım adım yaz.
> Önce durumu iki cümleyle özetle, sonra sıradaki işi sor.
