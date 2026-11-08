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
- Ürün adı **Şebeke-M Hakediş** (8.11.2026; önce Şebeke-M). Logo `ortak/marka/` (kaynak `ortak/marka/kaynak/`, üretici `araclar/marka-uret.py`); telefon uygulaması, eklenti, pencere başlıkları ve çıktılar bu adla görünür. Şeritteki sekme adları kısa kalır (ŞEBEKE-M, ŞEBEKE-M ARAÇLAR). `telefon/web/tests/marka.test.mjs` adı ve yasak adları denetler.
- Her şey bulutta durur (GitHub, Google Drive); belirli bir bilgisayara bağlı çözüm yapılmaz.
- **Gerçek proje verisi depoya konmaz** (DWG, gerçek proje dosyası, rapor, proje kodları). Testler uydurma
  örneklerle çalışır (`autocad/test/CekirdekTest/*.json`, `telefon/web/tests/`).
- Çalışan özellikleri bozma; büyük değişiklikten önce geri dönüş noktası (dal / etiket + önceki APK) bırak.
- Değişiklik açıklamaları (commit) Türkçe yazılır. Çalışma dalı → ana dala (`main`) alınınca sürümler çıkar.
- **Eklenti güncellenince telefon da aynı güncellemeyi alır** (kullanıcı kuralı, 31.10.2026): ad, logo, çizim
  görünümü (renk, çizgi tipi, yazı, metraj, kanal), dışa aktarılan dosyalar (DXF, Google Earth, CBS / MIF), harita
  altlıkları ve iki tarafta da olan her özellik. Eklentideki iş telefona aynı işte (aynı dalda) taşınır; taşınamayan
  kısım nedeniyle birlikte §6'ya yazılır. Eşitlik ortak denemelerle denetlenir: `ortak/deneme/` (malzeme yazımı,
  CBS çıktıları: iki taraf aynı girdiden aynı beklenen dosyaları üretmek zorunda) ve HARITA.md §1'deki dosya çiftleri.

## 2. Durum (1.11.2026)

| Parça | Sürüm | Durum |
| --- | --- | --- |
| Telefon uygulaması (Şebeke-M Hakediş) | 2.5.N (APK, Releases) | AutoCAD dosya uyumu, eski program durum kodları, INDEX / KONTROL / onayların korunması, harita altlıkları (anahtarlı; Esri ArcGIS, Bing, Azure dâhil), **Hesap Merkezi** (iki hesap: direk cer vektörü, kanal planı), **düzeltme kaynakları** (TUSAGA-Aktif / sabit istasyon / yerel CORS; NTRIP ya da doğrudan IP, akış denemesi, istasyon uzaklığı, bağlantı bilgisi dosyası), **haritada çizim görünümü**, Google Earth ve CBS (MIF / MID) eklentiyle aynı; telefonda denenmedi |
| AutoCAD eklentisi (Şebeke-M Hakediş) | 0.1.N (zip, Releases) | İki şerit sekmesi, telefonla aynı görünüm, parçalı hat, tam katalog, eski program ortak kayıtları, eksik malzeme, hakediş onayı, **Hesap Merkezi** (yerel sunucu + tarayıcı sayfaları, kayıt çizimde, HESAPLAR rapor sayfası). 25.10: AutoCAD 2027'de canlı denendi (aşağıda) |
| Belgeler | KULLANIM, README, PLAN, VERI-MODELI, CIZIM-BICIMI-NOTLARI, DEVIR, ortak/hesap/BAGLAM, HARITA (otomatik), CLAUDE | Güncel |

8.11 (`malzeme-yazisi` dalı, `main`'den; geri dönüş: `onceki-main-malzeme-yazisi-oncesi` dalı): kullanıcının 8.11 listesi.
**Malzemeleri çizimde göster** (kullanıcının örnek PDF'i gibi; isteğe bağlı, Çizim Ayarları › Görünüm, varsayılan kapalı):
elemanın malzemeleri simgenin öznitelikleri olarak (`MLZ_1…`, tanımsız öznitelik: simgeyle taşınır / kopyalanır / silinir;
DWG 2000'de de kalır) tip satırının altında "AD=MİKTAR BİRİM (DURUM)" — durum programdaki kodla (kullanıcı kararı), ad
görünen yazımla, ana poz ve sıfır miktar yok, aynı ad + birim + durum toplanır (`Cekirdek/MalzemeEtiketi.cs` = sh-core
`malzemeEtiketi`; ortak deneme `ortak/deneme/malzeme-etiketi.json`). "Aynı mı" karşılaştırması `MLZ_` özniteliklerini
saymaz (Telefondan al). Kullanıcı ilk satırı taşırsa yeri korunur. **Hat kalınlığı** (baskıda çok ince): `cizim-stili.json`
hat katmanlarına `kalinlik` (m = 1/1000'de mm: OG 0,5, AG 0,35, abone / aydınlatma 0,25) × Çizim Ayarları › Görünüm › Hat
kalınlığı (0 / 0,6 / 1 / 1,5 / 2 kat, varsayılan 1); eklenti çoklu çizginin genişliği yapar (ekranda ve baskıda görünür,
AutoCAD'in çizgi kalınlığı ayarına bağlı değil), telefonun DXF'i genişlikli POLYLINE (R12'de çizgi kalınlığı yok; kalın
hat düz çizilir). Yeni iki ayar `proje.boyutlar`'da (`hatKalinligi`, `malzemeYazisi`) iki yönde taşınır; Çizim Ayarları
kaydedilince çizimdekilere uygulanması sorulur. **Yeni logo ve ad**: "Şebeke-M Hakediş" (kullanıcı kararı); logodaki
"HAKKEDİŞ" yazımı `araclar/marka-uret.py` içinde HAKEDİŞ yapılır (kaynak kullanıcının dosyası). **Eski programın adı**:
depoda hiç yok (taranan kod, belge ve kullanıcının çizimleri); kullanıcının gördüğü satır büyük olasılıkla bilgisayarında
kurulu eski programın kendi yükleyicisinden (ekran görüntüsü istendi). Kalıcı denetim `telefon/web/tests/marka.test.mjs`
(yasak adlar parçalardan kurulur). **AG konsolları** (GT-60, GD-80…): katalogda yok; kullanıcı ad + kg listesini
gönderecek (§6).

5.11 (`kanal-listesi` dalı, `kullanici-rolleri` + `cokme-duzeltme` üstüne; geri dönüş: `onceki-main-kanal-oncesi` dalı):
kullanıcının 5.11 listesi (Karakoçan yeraltı çizimi). **Kanal cinsi ve kaplama ayrı** (kullanıcı kararı: her birleşim
seçilebilir): cins = zemin (toprak, tüvenan, mıcır, branşman, kablo demontaj), kaplama (yok, parke, asfalt, beton),
bariyerli, trencher; dosyaya ve rapora eski programın kalem adı gider (`Cekirdek/KanalZemini.cs` ↔ sh-core
`kanalZeminiTanim / kanalZeminiCoz`; ortak deneme `ortak/deneme/kanal-zemini.json`: 19 katalog adı birebir). Katalogda
olmayan birleşim `Katalog.KanalZeminleri` içinde kuralla kurulan kalemdir (Kaynak "kural", tarifesi topraktaki gibi).
Eklentide şeritte kanalda Cins = zemin, Tip'in yerinde **Kaplama**; kanal çizme, malzeme penceresi ve Çizim Ayarları ›
Metraj'da ortak `ZeminSecici`. Telefonda hat formu ve hat kaydında aynı seçim (`cable.zemin/kaplama/bariyer/trencher`,
poz anahtarı `surface` bunlardan; kurala uymayan AutoCAD adı `cable.zeminHam` ile korunur; eski "surface" kayıtları
okunur). **Proje bazında kanal listesi** (kullanıcı kararı: Proje Özeti + Excel + çizime tablo): `Cekirdek/KanalListesi.cs`
↔ sh-core `kanalListesi` (ortak deneme `ortak/deneme/kanal-listesi.json`); Proje Özeti'nde Kanal listesi sekmesi, Excel'de
KANAL LİSTESİ / KANAL ÖZETİ, `SH_KANALLISTESI` (şeritte Raporlar › Kanal Listesi) ile çizime tablo (`KanalTablosu` düzeni,
`SH_KANAL_LISTESI` bloğu, çizgi + yazı; AutoCAD tablo nesnesi değil, DWG 2000'de bozulmaz; yeniden çalışınca yerinde
yenilenir). Telefonda Proje merkezi › Kanal listesi ekranı ve Excel'de Kanal Listesi / Kanal Özeti sayfaları; çizime
tablo telefonda yok (DXF'e konmadı). **Çizim Onar** (`SH_ONAR`, `Cekirdek/DwgOnarici.cs`): açılırken çöken DWG 2000
çizimini açmadan onarır (değersiz genişletilmiş veri bölümleri; nesne yerinde yeniden yazılır, CRC ve bit boyu
yenilenir); uydurma DWG ile çekirdek denemesi, gerçek çizimde Python aracı `araclar/dwg-onar` ile bayt bayt aynı, eski
programın sağlam çiziminde (11.657 nesne) hiçbir şey değiştirmez. Kullanıcı kararları: mevcut köşk simgesi böyle kalır
(MEVCUT durumu içi boş; çizimdeki köşk "M" olduğu için dolu); yeraltı kablosunda metraj iki eleman arasına bir kez
(0.1.64'ten beri böyle; çizimdeki her köşedeki yazılar eski sürümden — `SH_GORUNUM` yeniler; yeni çekirdek denemesi).
Simge boyu Çizim Ayarları › Görünüm'de (0.1.66+). Kullanıcının çizimini eski sürüm (0.1.43) yazmıştı.

5.11 (`cokme-duzeltme` dalı, `main`'den): **Hat çizip komuttan çıkınca AutoCAD kapanıyordu** ("INTERNAL ERROR:
!dbobji.cpp@8703: eNotOpenForWrite"; kullanıcı ekran görüntüsü, AutoCAD 2027). Neden: süs takibi (`KenarTakibi.EksenIsle`)
komut bitince hattı yalnız okunur açıp `CizimYazici.EtiketYaz`'ı çağırıyor, o da hattın ETK verisini yazmaya açmadan
yazıyordu (31.10 `b7f7e85` ile geldi; 0.1.74–0.1.80). Düzeltme: ETK aynıysa yazılmaz, değilse önce yazmaya açılır;
eklentideki bütün `UpgradeOpen` çağrıları "yazmaya açık değilse" korumalı. Yeni deneme `CekirdekTest` ›
`YazmaDenetimiDene`: eklenti kaynağında genişletilmiş veri yazılan her yerde nesnenin hemen önce yazmaya açıldığı ve
korumasız `UpgradeOpen` kalmadığı denetlenir (eski kod bu denetimde yakalanıyor). Aynı gün bulunan öbür çökme (eski
çizim açılırken): çizim 0.1.43 ile yazılmıştı (değersiz genişletilmiş veri bölümü, 0.1.58'de düzelmişti); dosya
DWG 2000 biçiminde olduğundan AutoCAD dışında onarıldı (6 nesne), kullanıcıya gönderildi.
2.11 (`kullanici-rolleri` dalı; geri dönüş: `onceki-main-kullanici-rolleri-oncesi` dalı): **17. madde (eski program
parolaları / HAK_YETKİ)** kullanıcı kararıyla Şebeke-M'nin kendi tasarımıyla yapıldı: **telefondaki kullanıcılar ve
roller eklentide de geçerli** (ortak tablo `ortak/katalog/roller.json`; şifre özeti iki tarafta aynı; proje dosyasında
`proje.kullanicilar` / `proje.onayAyari`, alırken son değişiklik kazanır). Eklentide `SH_KULLANICILAR` (Kullanıcılar ve
yetkiler penceresi), `SH_OTURUM`; `SH_ONAY` onay mekanizması açıkken rol ister (Kontrol → Kontrol mühendisi, Hakediş ve
GIS → Onay yetkilisi, Yönetici hepsi). **Hakediş yetkisi**: Yönetici hakedişleri yazmaya kapatır; kapalı hakedişe iki
tarafta da yeni nesne eklenmez, nesneleri değiştirilmez (Yönetici, AutoCAD'den gelen obje ve iş kalemi olmayan mevcut
obje hariç). Eski programın `KEY` / `HAK_YETKİ` kayıtları okunmaz. Ortak deneme `ortak/deneme/kullanicilar.json`.

1.11 (`hata-duzeltme` dalı; geri dönüş: `onceki-main-hata-duzeltme-oncesi` dalı): dış incelemenin 9 bulgusu düzeltildi,
her biri önce başarısız sonra başarılı regresyon denemesiyle. **Koordinat**: UTM / yerel projeden AutoCAD dosyasına
yazarken bütün koordinatlar dosyanın 3° TM sistemine çevrilir (`sebeke.js › koordinatCevirici`); dosyanın `datum`'u
korunur (ED50 dosyası ED50 proje; var olan projeye alınırken dönüştürülür; datumsuz eski dosya TUREF). **Yeniden
alma**: aynı kimlikli elemanın kotu ve bağımsız noktanın konumu / kotu dosyadan güncellenir, kopya üretilmez.
**Onay kilidi** telefonda bütün servis yollarında (`ProjectService.editLock`: malzeme miktarı / silme / ekleme,
ekipman ve hat silme, bağlı nokta taşıma, bölme / birleştirme, son alımı geri alma, yeniden numaralama); AutoCAD **Hat
Değiştir** her iletken satırının hakedişini denetler (`Iletkenler.DegistirmeKilidi`). **Hakediş onayı** fiyat, tutar ve
sözleşme miktarını da dondurur (eski fiyatsız görüntü `legacyPrices` ile işaretli). **Web bulut kaydı**: eşzamanlı
kayıtlarda kova ezilmez (sürümlü kovalar, kayıt bazında birleştirme, `m/lock` kilidi). **GNSS** kotsuz konumun epok
ortalaması 0 değil boş kalır. **Eşitleme** tek projede başka projenin kaydını götürmez. Windows yolları `fileURLToPath`.
Yeni denemeler: `tests/kilit.test.mjs` (K1–K4), `tests/hakedis.test.mjs` (H1–H2), sebeke A30–A32, web W11–W13, gnss G7,
scenarios 20b; CekirdekTest 10 denetim. Bilinmesi gereken: eklenti ED50 datumlu çizimi Google Earth / altlık için ITRF96
sayar (datum dönüşümü yalnız telefonda).

1.11 (`telefon-duzen` dalı; geri dönüş: `onceki-main-telefon-duzen-oncesi` dalı): kullanıcı isteğiyle **Hesap Merkezi
sadeleşti**: yalnız Direk Tepe Kuvveti (Cer Vektörü) ve Kanal Planı kaldı; öteki 13 hesabın dosyaları silindi
(geçmişte: `git log -- ortak/hesap/kaynak`), eklenti şeridinde her hesabın kendi düğmesi, trafo çıkış seçimi kalktı;
kaldırılmış hesabın eski kaydı telefonda özet olarak görünür. **Telefon Ayarlar** gruplu menü (Ölçüm, Düzeltme kaynağı,
Hassasiyet eşikleri, Koordinat sistemi, Harita, Veri ve kullanıcılar, Deneme ve eğitim, Hakkında; `settings.js` alt
ekranları `ayar*`). **Aplikasyon** ekranı yeniden tasarlandı (büyük kalan mesafe ve yön, yönlendirme cümlesi, alta
yapışık İŞARETLE / SONRAKİ, katlanır ayrıntılar). **Kurum ve kitap sürümü yazıları** kaldırıldı (katalog başlığı
"Poz kataloğu 2026", seedRev 25 başlığı kurulu telefonlarda da yeniler; açılış yazısı, katalog, dışa aktarım, teslim
paketi adı). **Hakkında** metni ortak (`ortak/marka/hakkinda.json` → telefon `src/ortak/hakkinda.js`, eklentiye gömülü;
eklentinin penceresi Hakkında / Komutlar sekmeli). **Yazım**: katalog tanımlarındaki 22 yazım hatası görünen yazım
katmanında (`MalzemeYazimi` ↔ `malzemeYazisi`, ortak örnekler), telefon metinleri ve kılavuzlar düzeltildi. Genel
denetim: eslint (tanımsız değişken yok), 43 ekran Playwright ile açıldı (konsol hatası yok), bütün denemeler.

31.10 (`cbs-uyum` dalı, `telefon-esitleme` dalını da içerir; geri dönüş: `onceki-main-cbs-uyum-oncesi` dalı ve
Releases'teki eklenti 0.1.66 / telefon 2.5.44): kullanıcının 30.10 listesi. **KVKK**: kişisel bilgiler temizlendi (hesap
sayfalarındaki yazar adı ve imzası, deneme verilerindeki gerçek gibi görünen adlar, belgelerdeki kullanıcı adı ve
şehri); git geçmişinde eskileri durur. **Katman adları** Türkçe karaktersiz
(`KatmanAdlari` ↔ sh-core `katmanAscii`; eski çizimler `SH_GORUNUM` ile), **cins kodlarının yazım hataları**
düzeltildi (`CinsKodu` ↔ sh-core `cinsDuzelt`; eski kodlu dosyalar okunurken çevrilir). **Hat yazıları**: kablo tipi
yazısı da metraj gibi açıklığın ortasında, parçaya sığmazsa önce daralır sonra küçülür (`YaziDuzeni` ↔ dxf.js
`yaziSigdir`, harf genişlikleri ortak çizim stilinde); hat silinince metraj ve tip yazıları da silinir. **Hat
Değiştir** (`SH_HATDEGISTIR`): çizilmiş hattın iletkeni (tip, cins, adet), türü, durumu sonradan değişir; yazılar
yenilenir. **Simge ve yazı boyutları** ayarlanır (Çizim Ayarları › Görünüm; proje dosyasında `proje.boyutlar`,
telefonda Ayarlar › Harita görünümü). **CBS şebeke elemanı bazında**: `SH_MIFVER` DIREK / TRAFO / SDK / PANO /
ELEMAN / HAT / KANAL / SONDAJ / BOLGE / NOKTA katmanları ve MALZEME tablosu, bütün öznitelikleriyle (telefon aynı);
`SH_MIFAL` dosyaları **CBS'den al** penceresinde tanıyıp (sütun eşleme) şebeke nesnesi olarak çizer
(`CbsIceAktarim`, telefondan alma yolu `Aktarim.Planla` ile). **Masaüstü ↔ telefon eşlemesi**: eklentinin kataloğundaki
342 iletken / kablonun hepsi telefonda devre olur (telefonda karşılığı olmayanlar "AutoCAD'deki tip"; hat kaydında
ayrı grupta seçilir), bakır / alüminyum XLPE doğru eşlenir, telefonda dokunulmayan hat eklentinin metrajıyla döner
(`sebeke.js` › `ilkMetraj`), `OG_BAKIR_KABLO` iki tarafta OG yeraltı.

31.10 (`telefon-esitleme` dalı; geri dönüş: `onceki-main-telefon-esitleme-oncesi` dalı ve Releases'teki telefon
2.5.40): eklentinin 29.10 işleri telefona taşındı. **Harita çizimdeki gibi**: hat renkleri ve çizgi tipleri ortak
stilden (abone turuncu kesik, müşterek mor, AG kablo mavi, OG kablo pembe kesik-nokta, kanal gri eksen, sondaj noktalı,
ileride kesik, demontaj sarı), metraj açıklık başına (üst yanda, hattın renginde; kanal / sondaj bir satır yukarıda),
hat etiketi "hat no kesit" (alt yanda), kanal iki kenarlı (yakınlaşınca), Lejant ekranı ortak stilden; DXF'e de kanal
kenarları eklendi (`ui/cizim-gorunumu.js`, `export/dxf.js`). **Google Earth (KMZ) ve CBS (MIF / MID)** eklentininkiyle
aynı yapıda (`export/cbs.js`: CbsYapisi + KmlYazici + MifDosyasi karşılığı; girdi telefonun .sebeke.json'u); telefonun
3B direk / iletken görünümü KMZ'de ayrı klasörde (kapalı); MIF Dışa Aktarım'da seçilen koordinat sisteminde. Ortak
deneme `ortak/deneme/cbs`: eklenti (`CbsOrtakDeneme`) ve telefon (`tests/cbs.test.mjs`) aynı girdiden aynı beklenen
dosyaları üretir; eklentinin KML / MIF yazımı değişirse önce eklenti denemesi bozulur, beklenenler `CekirdekTest cbs
<klasör>` ile yeniden yazılır, telefon da aynı değişikliği alır. **Altlıklar**: Esri (ArcGIS anahtarı), Bing (kurumsal
anahtar, meta veriyle), Azure Maps (uydu, yol); özel adreste `{q}`. WebView kimliği `SebekeM/<sürüm>`.
Aynı gün eklenti oturumunun `cbs-uyum` dalı (CBS eleman türüne göre katmanlar + malzeme tablosu, CBS'den şebeke nesnesi
alma, hat yazıları ortalı / sığdırılmış, simge ve yazı boyutları, Hat Değiştir) bu dala katıldı (`5de1b9b`): `main`'e
alınırken ikisi birlikte gider; `cbs-uyum`'da sonradan yapılanlar için önce bu dal oraya katılır.

29.10 (`cizim-duzeltmeleri` dalı; kullanıcının 13 maddelik listesi): çizimde yazılar hattın renginde ve **Tahoma**;
metraj yalnız açıklık başına (iki direk / iki SDK arası; elemansız kırılma köşesinde bölünmez), etikette metraj ve
kod yok; hat renkleri ayrıştı (OG havai kırmızı, abone turuncu kesik, OG kablo pembe, AG kablo mavi, müşterek mor);
kanal iki kenar çizgisiyle (genişlik = üst genişlik; `KenarTakibi` eksen değişince kenarları yeniler); kanal ölçüleri
şeritten; **Proje Özeti** penceresi (proje listesi, malzeme listesi, Excel); **CBS ve Harita** paneli: Google Earth
(`SH_KML`), MIF / MID dışa ve içe (`SH_MIFVER`, `SH_MIFAL`, `SH_CBSBILGI`), **harita altlığı** (`SH_ALTLIK`;
anahtarlar yalnız kullanıcının bilgisayarında); malzeme adlarının görünen yazımı (`MalzemeYazimi` ↔ sh-core
`malzemeYazisi`, örnekler `ortak/deneme/malzeme-yazimi.json`; kayıt ve Durum Tespit ham adla kalır). Var olan
çizimler için bir kez **Telefon Görünümü** (`SH_GORUNUM`) çalıştırılır.

29.10 akşam canlı deneme (AutoCAD 2027, eklenti 0.1.64, uydurma örnek proje): Telefondan Al (72 nesne), renkler /
Tahoma / açıklık metrajı / kanal kenarları (taşı, kopyala, geri al), şeritten kanal ölçüsü, Proje Özeti ve Excel
(PROJELER + MALZEME LİSTESİ sayfaları), `SH_KML` (KMZ, 72 nesne, koordinatlar haritada doğru yerde), `SH_MIFVER`
(5 katman, .mif + .mid), `SH_MIFAL` (boş çizime 72 nesne; dilim dosyadan alındı), `SH_CBSBILGI`, `SH_ALTLIK` (Esri,
35 karo, nesnelerin altında, atıf yazısıyla): **çalıştı**. Denemede görülüp düzeltilen: dik hatta metraj ile hat
bilgisi çizginin üstüne düşüp birbirini örtüyordu (kaydırma dünya ekseninde uygulanıyordu) → kaydırma artık parçanın
kendi ekseninde (`Geometri.YaziKonumu` ↔ dxf.js `yaziKonumu`); kanal / sondaj metrajı içindeki kablonun metrajıyla
çakışıyordu → bir satır yukarıda (`etiketler.kaziMetraji`); telefon DXF'inde yalnız kanal / sondaj kablo renginde
çiziliyordu → kendi renk ve çizgisinde. Düzeltme 0.1.65 ile aynı örnek projede canlı doğrulandı (eğik kanal + kablo:
kablo metrajı, kanal metrajı ve hat bilgisi ayrı ayrı okunuyor).

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
**Hesap Merkezi**: 14 HTML hesap aracı (`ortak/hesap/kaynak`, formüller değiştirilmedi; yapılan
temizlik `kaynak/DEGISIKLIKLER.md`) ortak köprü (`kopru-bas.js`, `kopru.js`), koyu tema (`tema.css`) ve hesap
başına uyarlama (`uyarlama/<id>.js|css`) ile telefona (iframe, postMessage) ve AutoCAD'e (yerel HTTP sunucu
`HesapSunucu`, Edge uygulama penceresi, `HesapMerkezi.cs`) bağlandı. Bağlam / kayıt / güncellik sözleşmesi
`ortak/hesap/BAGLAM.md`; paketleyici `araclar/hesap-paketle.mjs` (derlemede çalışır, `ortak/hesap/paket` depoya
konmaz); deneme koşucusu `araclar/hesap-dene.py` (Playwright; masaüstü + telefon boyutu). Hesap
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
  `bosaaktar`, `katsayilar`, `semboller`, `cbs <klasör>` (telefonla ortak CBS denemesinin beklenen dosyalarını yazar:
  `ortak/deneme/cbs/beklenen`; dosyalar satır sonu korunarak saklanır, `.gitattributes`).
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
  yerelde bağımlılıksız testler çalıştırılır. (31.10: npm kapalıydı; .NET 8 SDK Microsoft'un sunucusundan indirilip
  `/opt/dotnet`'e açılınca `CekirdekTest` yerelde çalıştı.) İş akışı ekleri (artifact) buradan indirilemez; günlükler bu yüzden
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

- **8.11 `malzeme-yazisi` işlerinin AutoCAD'de denemesi**: Çizim Ayarları › Görünüm › Malzemeleri çizimde göster açıp
  direğe malzeme ekleme / silme (satırlar yenilenir), direği taşıma / kopyalama, ilk satırı taşıyıp malzeme değiştirme,
  DWG 2000 kaydedip açma, eski programın blokları (TİP özniteliği olmayanlarda yer); Hat kalınlığı seçenekleriyle baskı
  (PDF) ve Telefon Görünümü'yle eski çizimin kalınlaşması. Telefona taşınamayan: harita ekranındaki çizim görünümünde
  malzeme yazısı ve hat kalınlığı (ekran cihazın kendi boyutlarıyla çizilir; DXF'te ikisi de var).
- **AG konsolları** (kullanıcı listesi bekleniyor): GT-60, GD-80… adları ve kg ağırlıkları gelince `kalemler.json`'a
  TRAVERS_VE_KONSOLLAR_GLV (poz 5.4, ad/kg) altına eklenecek; telefon kataloğu (`ortak-tablolar.mjs`) ve iki tarafın
  malzeme listeleri aynı dosyadan.
- **Eski programın adı**: kullanıcı komut satırındaki satırın ekran görüntüsünü gönderince kaynağı kesinleştirilecek.

- **5.11 `kanal-listesi` işlerinin AutoCAD'de denemesi**: şeritte Kablo Kanalı › Cins / Kaplama seçip kanal çizme
  (kalem adı, rapor), kanalın Malzemeler penceresinde zemini değiştirme, Proje Özeti › Kanal listesi ve Excel, Kanal
  Listesi ile çizime tablo (DWG 2000 kaydedip yeniden açma), Çizim Onar ile kullanıcının bozuk çizimi; telefonda
  kanal cins / kaplama ile AutoCAD dosyasına yazıp eklentide açma. Telefona taşınamayan: kanal listesinin çizime
  tablosu (telefonun DXF'inde yok; ekran ve Excel var). Mıcır zeminli ve kaplamalı kanalların telefondaki poz
  numaraları yerel (YEREL:KANAL-…), fiyatı girilmeli.

- **2.11 `kullanici-rolleri` işlerinin denemesi**: AutoCAD'de `SH_KULLANICILAR` ile ilk Yöneticiyi tanımlama, kullanıcı
  ekleme, `SH_OTURUM`, `SH_ONAY`'da rol kısıtı (Kontrol mühendisi yalnız Kontrol), bir hakedişi yazmaya kapatıp o hakedişe
  çizim denemesi; `Telefona Gönder` → telefonda aynı şifreyle oturum; telefonda hakediş yetkisini değiştirip `Telefondan
  Al`. Bilinmesi gereken: şifreler 4–8 rakam olduğu için proje dosyasındaki özetler kararlı biri tarafından denenerek
  bulunabilir; bu düzen iş akışını düzenler, güçlü bir güvenlik kilidi değildir (dosya güvenilmeyen kişiyle
  paylaşılacaksa kullanıcılar kapatılıp gönderilebilir).
- **1.11 `hata-duzeltme` işlerinin denemesi**: telefonda UTM projesinden AutoCAD dosyası yazıp eklentide açma (koordinatlar
  3° TM'de olmalı), ED50 dosyasını alma, aynı dosyayı ikinci kez alma (düzeltmeler gelmeli, kopya olmamalı), onay açıkken
  kilitli kayıtta miktar / silme denemesi (bildirim çıkmalı), onaylı hakediş döneminin iş programı yenilenince
  değişmemesi; AutoCAD'de Hat Değiştir'in 2. dönemi onaylı hatta reddi. Web (bulut) sürümü yeniden yayınlanırsa iki
  tarayıcıda aynı anda kayıt denemesi (`m/lock` belgesi için db kuralı gerekirse eklenir).
- **Eklentide datum**: ED50 datumlu proje dosyası eklentide olduğu gibi çizilir; Google Earth / altlık / CBS dönüşümleri
  ITRF96 sayar (~185 m kayma). ED50 kullanılacaksa eklentiye datum dönüşümü (telefondaki `geo/crs.js` kuralı) taşınmalı.
- **1.11 `telefon-duzen` işlerinin denemesi**: telefonda yeni Aplikasyon ekranı sahada (yürüyüş yönü pusulası olan
  alıcıyla "ileri / sağa" satırları, pusulasızda semt), gruplu Ayarlar, Hakkında; AutoCAD'de Hakkında penceresi
  (iki sekme) ve Teknik Hesaplamalar panelindeki iki düğme. Kaldırılan hesapların eski kayıtları olan çizim / proje
  varsa Kayıtlı Hesaplar listesinde görünmeye devam eder (sayfası açılmaz).
- **Yazım düzeltmeleri yalnız görünen yazıda**: katalogdaki tanımlar (ör. "PARAFUDUR ŞASESİ") eski programla
  eşleşme için olduğu gibi durur; raporlar ham adı yazar. Kullanıcı raporda da düzeltilmiş ad isterse eski programın
  listesiyle birlikte karar verilmeli.
- **31.10 `cbs-uyum` işlerinin denemesi**: AutoCAD'de `SH_HATDEGISTIR`, Çizim Ayarları › Görünüm (boyutlar),
  `SH_MIFVER` dosyalarının MapInfo / QGIS'te açılması, `SH_MIFAL` ile kullanıcının kendi CBS örnek dosyası (Drive'da
  `Sebeke-M-deneme`; depoya konmaz — sütun adları farklıysa `CbsIceAktarim.Esanlamlar`'a eklenir); telefonda hat
  kaydından AutoCAD tipi seçme ve Ayarlar › Harita görünümü. Eski programın yeni katman adlarını ve düzeltilmiş cins
  kodlarını tanıyıp tanımadığı denenmeli (eski adlar eklentide okunmaya devam eder).
- **Telefonda MIF alma yok** (eklentide `SH_MIFAL` var; §1 kuralı gereği not): dosya seçme ve sütun eşleme ekranı
  gerektirir; şimdilik CBS verisi eklentide alınıp **Telefona Gönder** ile telefona geçer. İstenirse `MifDosyasi.Oku`
  + `CbsIceAktarim` telefona taşınır, ortak denemeye `ortak/deneme/cbs/beklenen` dosyalarının iki tarafta aynı projeye
  dönüştüğü eklenir.
- **31.10 telefon işlerinin denemesi** (telefonda): haritada hat renkleri / çizgileri, açıklık metrajı, hat etiketi,
  kanal kenarları (yakınlaşınca), Katmanlar › "Kanal kenarı ve sondaj"; Dışa Aktarım › Google Earth KMZ'nin Google
  Earth'te, CBS MapInfo (MIF / MID) dosyalarının QGIS / MapInfo'da açılması; yeni altlıklar kullanıcının anahtarıyla
  (Esri ArcGIS, Azure Maps; Bing yalnız kurumsal anahtarla).
- **29.10 işlerinin kalan denemeleri** (örnek projeyle canlı denendi, §2): gerçek eski bir çizimde `SH_GORUNUM`
  (renkler, Tahoma, açıklık metrajı, kanal kenarları, dik hatta yazıların yeri — 0.1.65 ve sonrası); `SH_KML`
  dosyasının Google Earth'te, `SH_MIFVER` dosyalarının MapInfo / QGIS'te açılması (dosyalar denetlendi, o
  programlarda açılmadı); `SH_ALTLIK` kullanıcının kendi anahtarıyla (Google / Yandex …). Kanal kenarlarının eski
  programda sorun çıkarmadığı (kenarlar kanal katmanında, yalnız SH_SAHIP verili) denetlenmeli.
0. **Gerçek telefonda deneme** (AutoCAD tarafı 25.10'da canlı doğrulandı, yukarıda): AutoCAD'den gelen hesap
   kaydının telefonda görünmesi ve "güncel" kalması (telefon koduyla kapta denendi; rekortman kolu düzeltmesi A10),
   telefonda bir hesabı kaydedip Telefondan Al ile çizime gelmesi. Hesap araçlarının sahibiyle ⓘ panellerindeki
   doğrulanacak tablo değerleri görüşülmeli (ör. tepe kuvveti AER yer tutucu değerleri: SC108'de "1,0 kg").
   Eski program çiziminde telefon kataloğunda karşılığı olmayan hat tipleri (`4P+R`, `5R`, `R`, `3R`, `3A+P+R` …)
   31.10'dan beri telefonda "AutoCAD'deki tip" olarak düzenlenir ve aynı kalemle döner; telefonun kendi hakediş
   raporunda fiyatlanmaları için poz / birim fiyat bilgisi gerekir.
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
4. İstenirse: pano çıkış şeması / hücre düzenleme penceresi, kanal ve sondaj metrajının telefonda AutoCAD değeriyle
   korunması (hatlarda 31.10'da yapıldı; kanal / sondaj telefonda geometriden hesaplanır). (Eski program parolaları ve
   `HAK_YETKİ` yerine 2.11'de ortak kullanıcılar ve hakediş yetkisi yapıldı.)
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
