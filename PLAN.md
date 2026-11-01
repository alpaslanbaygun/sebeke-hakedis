# Plan

## Kararlar

- Ayrı bir **telefon uygulaması** + kendi **AutoCAD eklentimiz**. İkisi aynı proje dosyasını kullanır.
- Telefon uygulaması **Şebeke-M**'dır (17.10.2026'da bu depoya `telefon/` olarak alındı; bu depodaki ilk
  telefon uygulaması bırakıldı, geri dönüş: `telefon-eski-0.2.3` dalı). Kataloğu TEDAŞ pozlarıdır; AutoCAD'e
  eski program cins / tanım ile çevrilir (`ortak/katalog/volt-eslesme.json`).
- Eklenti **eski programın yerine geçer**: eski program çizimleri okunur; eklentinin çizdikleri de eski program
  biçimindedir (aynı katmanlar ve XDATA), böylece eski ve yeni nesneler aynı çizimde, aynı raporda durur.
- Görünüm: AutoCAD çizimi telefondakiyle **birebir aynı** (18.10.2026 kararı): simgeler `ortak/katalog/semboller.json`
  (1 ölçek), renk / çizgi tipi / yazı `ortak/katalog/cizim-stili.json`. Çizimdeki değişmeyen eski program bloklarına
  dokunulmaz; `SH_GORUNUM` istenirse çevirir. Ayarlardan eski program simgelerine dönülebilir.
- Şerit menü kategoriye göre değişir (kategori → yalnız o kategorinin öğeleri, pencere açmadan çizim); öğenin tip
  listesi yalnız o öğenin cinslerinden gelir (`ortak/katalog/kategoriler.json`).
- Şerit ve pencerelerin tasarımı **Google Stitch** ile yapıldı (18.10.2026), kullanıcının isteğiyle **koyu tema**:
  kategori düğmeleri, Elemanlar, Ayarlar (Tip / Ara / Durum / Hakediş / özet); pencerelerde kendi başlık çubuğu,
  üç sütunlu çizim pencereleri, "Çizilecek: …" özet satırı. Simgeler `ArayuzSimgeleri.cs` (çizgi simgeleri),
  denetimler `KoyuTema.cs`.
- Hat, kanal ve sondaj **parçalı**: her bağlantı düğümünde (direk, SDK, pano, trafo) biter ve yeniden başlar; her
  parçanın metrajı ve etiketi ayrı. Telefonda tek hat olarak görünür, parça kimlikleri korunur. Hat çizerken elemana
  simgesinin boyutunda (ve ekranda birkaç piksel payla) yakalanır; boş yere tıklamak yalnız köşe koyar (18.10.2026).
- **Çoklu iletken** (18.10.2026): aynı hatta iki iletken ve adet (3 × ALPEK, OG + AG). Her iletken ayrı `HAT` kalemi,
  adet `Nx(…)` yazımıyla; müşterek hatta 1. iletken OG, 2. iletken AG gelir; etiket `OG / AG`.
- **Malzeme hafızası** (kullanıcı kararı: kendiliğinden eklensin, şeritten kapatılabilsin): son konan ya da malzemesi
  değişen elemanın malzemeleri aynı tür ve tipteki yeni elemana eklenir. **Toplu malzeme**: seçilen direklere birden.
- **Armatür** direğin malzemesidir; simgesi direğin yanına çizilir ve direkle birlikte gider (`SH_ARM` bağı).
- **Durum simgeleri** telefonun haritası örnek alınarak ayrı: yeni dolu, mevcut boş, DM+M yarım, DM "/", kesik "//",
  sökük "X" (taşan sarı çizgiler).
- eski programın çizimdeki ortak kayıtları (sayaç, aktif hakediş, bölge listesi, onaylar) eklentide de okunur ve yazılır;
  onaylı hakediş kilitlidir.
- AutoCAD sürümleri: **2016–2024** ve **2025 ve sonrası** (LT yok).
- **Kurulum ve imza** (26.10.2026): eklenti AutoCAD'in güvenilir klasörüne (`Program Files\Autodesk\ApplicationPlugins`)
  kurulur; orada imza aranmadığı için "imzalanmamış dosya" uyarısı çıkmaz. Gerçek kod imzası için ticari sertifika
  gerekir; alınırsa CI imzalamaya hazırdır.
- Veri aktarımı: **önce dosya** (Google Drive'da `.sebeke.json`; telefonun `.volt.json` ve teslim paketi de
  eklentide açılır), **sonra bulut eşitleme**.
- Telefon ekranları Google Stitch'te değil, uygulamanın kendi tasarımıyla elle düzenlenir; büyük tasarım
  işlerinden önce Stitch kullanılıp kullanılmayacağı sorulur.
- Saha kuralları: harita alttaki panelin arkasında kalmaz; büyük alım düğmesi tek elle; hat iki dokunuşla;
  malzemeler elle eklenir (otomatik reçete proje ayarıdır); telefon konumu ve sahte konum kabul edilir;
  alıcı markasına bağlı kalınmaz.
- **Şebeke-M** (19.10.2026): ürün adı ve logosu her yerde; eski programın ve dağıtım şirketinin adı kullanıcıya görünen
  hiçbir yerde geçmez. Harita altlıkları kullanım koşullarına göre (anahtarsız ücretsizler; anahtarlılar kullanıcı
  anahtarıyla).
- **Hesap Merkezi** (19.10.2026): hesap araçları formülleri değiştirilmeden, ortak koyu temayla ve tek
  üst çubukla telefona ve AutoCAD'e bağlandı. Kural: projede olan bilgi hesaba kendiliğinden yazılır, olmayan tahminle
  doldurulmaz (turuncu çerçeve, elle giriş); karar yalnız girdiler tamken verilir, aksi "bilgi". Sonuç projeye /
  çizime kaydedilir, proje değişince "güncel değil". AutoCAD'de sayfalar yerel sunucudan Edge uygulama penceresinde
  açılır (WebView2 sürüm çatışmaları yüzünden). Sözleşme: `ortak/hesap/BAGLAM.md`.

## Fazlar

| Faz | Kapsam | Durum |
| --- | --- | --- |
| 1 | Ortak temel: proje dosyası biçimi, rapor katsayıları, malzeme kataloğu | tamam |
| 2 | AutoCAD eklentisi 1: şerit menü, eski program içe alma, Durum Tespit raporu | tamam (AutoCAD'de deneme bekliyor) |
| 3 | Mobil tasarım | tamam (Şebeke-M tasarımı) |
| 4 | AutoCAD eklentisi 2: telefondan alma, eleman, hat, kanal, sondaj, bölge, nokta alma, malzeme, metraj, ayarlar | tamam (AutoCAD'de deneme bekliyor) |
| 5–6 | İlk telefon uygulaması | bırakıldı (yerine Şebeke-M) |
| 7 | Bulut eşitleme (Drive'daki dosyayı elle taşımadan) | sırada |
| 8 | Şebeke-M birleşmesi: depo + otomatik APK derlemesi, lejant simge takımı, telefon ↔ AutoCAD dosya uyumu (iki yön, iki biçim) | tamam (sahada ve AutoCAD'de deneme bekliyor) |
| 10 | Arayüz: Google Stitch tasarımıyla şerit ve bütün pencereler, koyu tema | tamam (AutoCAD'de deneme bekliyor) |
| 9 | eski programdan alınanlar ve şerit: tam katalog, durum kodları, tarife, telefonla aynı görünüm, dinamik şerit, parçalı hat, sayaç / hakediş / bölge kayıtları, eksik malzeme (DETAY), hakediş onayı ve kilit, pano / hücre verisinin korunması | tamam (AutoCAD'de ve sahada deneme bekliyor) |
| 11 | Şebeke-M: marka (ad, logo, iki şerit sekmesi, Hakkında), harita altlıkları, **Hesap Merkezi** (1.11.2026'dan beri iki hesap: cer vektörü ve kanal planı; 13 hesap kullanıcı isteğiyle kaldırıldı; telefon iframe köprüsü, AutoCAD yerel sunucu; bağlam / kayıt / güncellik; raporlarda HESAPLAR; proje dosyasıyla taşıma) | tamam (AutoCAD'de ve telefonda deneme bekliyor; hesap tablolarındaki şüpheli değerler aracın sahibiyle doğrulanacak) |
| 12 | Eklentiyle eşitleme (kural: eklenti güncellenince telefon da güncellenir): haritada çizim görünümü (renk, çizgi, açıklık metrajı, hat etiketi, kanal kenarları), Google Earth ve CBS (MIF / MID) eklentiyle aynı (ortak deneme `ortak/deneme/cbs`), aynı altlık listesi (Esri ArcGIS, Bing, Azure) | tamam (telefonda deneme bekliyor) |

## Sahada / AutoCAD'de denenecekler

- Kurulum: `KUR.bat` yönetici izni ister, eklenti `Program Files\Autodesk\ApplicationPlugins`'e kurulur, AutoCAD
  açılışında güvenlik uyarısı çıkmaz; kullanıcı klasöründeki eski kopya silinmiş olur.
- Şerit: kategori düğmeleri, öğeye tıklayınca pencere açılmadan çizim, Tip / Ara / Durum / Hakediş kutuları, özet satırı;
  dar ekranda bölümlerin küçülmesi; AutoCAD açık temasında simgelerin okunması.
- Koyu pencereler: yüksek DPI'da (125 %, 150 %) yazı ve kutuların taşmaması, başlıktan sürükleme, Enter / Esc.
- Telefonla aynı görünüm: yeni simgeler (1 ölçek), renkler, parça metrajı yazıları; `SH_GORUNUM` ile eski çizimin çevrilmesi.
- Hat çizerken direğe / SDK'ya / aydınlatma direğine tıklayınca yakalama (uzak ve yakın görünümde); boş tıkta yalnız köşe.
- Cins seçimi (AG beton / ağaç / demir), iletken listesinin sırası, iki iletken / adet / müşterek hat etiketi ve raporu.
- Malzeme hafızası (aç / kapat), Toplu Malzeme; armatürün direğe eklenmesi, simgesinin direkle taşınması / kopyalanması /
  silinmesi ve Geri Al.
- Durum simgeleri: yeni, mevcut, DM+M, DM, kesik, sökük direklerin çizimde ve şeritte ayırt edilmesi.
- eski program ile aynı çizimde sırayla çalışma: INDEX sırası, aktif hakediş, bölge listesi, onaylar iki programda aynı mı?
- `SH_ONAY` ile onaylanan hakedişte kilit; `SH_DETAY` ile eksik malzeme; raporun DETAY sayfası.
- `SH_PROJEAL` gerçek bir çizimde: telefonda taşınan direk, değişen metraj, demontaja çevrilen eleman doğru yansıyor mu?
- Telefonda **AutoCAD dosyasından proje al** → sahada değişiklik → **Dışa Aktar › AutoCAD proje dosyası** →
  `SH_PROJEAL`: nesneler çoğalmadan güncelleniyor mu? Durum Tespit raporu beklenen kg'yi veriyor mu?
- Telefonda Bluetooth alıcı + NTRIP ile Fixed çözüm; sabit istasyon profili.
- APK 2.5.x telefondaki 2.4.0'ın üzerine kuruluyor mu (aynı imza anahtarı)?
- Hesap Merkezi: AutoCAD'de `SH_HESAP` ile Edge penceresinin açılması; Kaydet'in çizime yazması ve çizim kaydedilince
  kalması; Telefona Gönder / Telefondan Al ile kayıtların iki yönde taşınması; telefonda hesap sayfasının WebView'da
  yazdırma ve DXF indirme; büyük hesap durumlarının (köşk, gerilim düşümü) kayıt boyutu.

## Açık sorular

- ~~eski programdaki `KONTROL` işareti ve `KM`, `ME` durum kodları ne anlama geliyor?~~ Çözüldü, bkz.
  `ortak/CIZIM-BICIMI-NOTLARI.md` (KONTROL = denetlendi işareti; KM = malzemesi yükleniciye çıkılan kurum montajı;
  ME = mutabakat eksiği; ENH = kilometrik bedelli iş).
- Birim fiyat girişi gerekecek mi? (İncelenen projede fiyat sütunları boştu.)
- Telefon kataloğundaki travers, izolatör, topraklama gibi malzemelerin eski program cins / tanım karşılıkları şimdilik
  kategori kuralıyla üretiliyor; birebir eşleme istenirse `volt-eslesme.json › kalemler` doldurulur.
- "İleride" durumundaki objeler AutoCAD dosyasına yazılmıyor; eski programda bir karşılığı istenirse konuşulmalı.
- Hesap araçlarının tablolarında saptanan, aracın sahibiyle doğrulanması gereken değerler (değiştirilmedi; her hesabın
  ⓘ panelindeki "Hesap hakkında" ve `ortak/hesap/uyarlama/<id>.js › notlar`): uplift Pigeon / 3. bölge / Ar 150;
  kopma ile sehim arasındaki buz katsayısı (k) tablosu farkı; OG gerilim düşümünde bazı K / C değerleri (3(1x35) 34,5 kV,
  çift devre satırları) ve aracın boş girdiyle "uygun" demesi; Cu–Al'da 630 mm² sınırı; cer vektöründe müşterek + AER
  satırlarının önceki satırın değerini taşıması; TEDAŞ tepe kuvvetinde AER yer tutucu değerleri ve 0,81 son satır
  hatası; kanal planında kesit → çap güncellenmemesi; köşk koridor kontrolünün her monoblokta "uygun değil" vermesi;
  ag–aw'da eksik Δa_g tabloları; Amax t6–t8 "belirleyici" yazısı; OG / AG kısa devrede geri yükleme ve yazdırma
  ayrıntıları; AG kısa devrede cihaz seçilmeden "uygun" verilmemesi (Şebeke-M bunu kapattı).
- AG tek hat şeması ayrı bir araç olarak gelmedi; AG kısa devre hesabının içindeki şema bölümüne açılan kısayol
  olarak eklendi. Ayrı dosya gelirse aynı yöntemle eklenir.
- Telefondaki eski "Tepe kuvveti hesabı" ekranı (beton direk seçebilen EKAT yöntemi) yeni araçların yanında durur;
  kaldırılıp kaldırılmayacağı kullanıcı kararıdır.
