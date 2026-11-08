# Şebeke-M Hakediş Kullanım Kılavuzu

6 Ekim 2026

Bu kılavuz, Şebeke-M Hakediş telefon uygulamasının 2.4.0 ve sonraki (2.5.x) sürümlerini sahada kullanacak kişiler içindir. Uygulama Android telefonda çalışır; internet olmadan da kayıt alır.

## Uygulama ne işe yarar

Sahada direk, trafo, hat ve diğer şebeke objelerini koordinatıyla kaydeder; malzeme listesini, keşfi, metrajı ve hakedişi bu kayıtlardan kendisi çıkarır.

Bir işin baştan sona sırası şöyledir:

1. Proje oluşturun.
2. GNSS alıcıyı bağlayın (ya da telefon GPS, elle koordinat, haritadan seçme, Excel kullanın).
3. Direkleri, trafoları ve diğer objeleri alın.
4. Hatları çizin.
5. Malzeme ve metrajı kontrol edin.
6. Hakediş durumlarını işleyin.
7. Rapor ve çizim dosyalarını dışa aktarın.

Ofiste bilgisayardan çalışmak için aynı uygulamanın web sürümü vardır. Ölçüm yalnız telefonda yapılır; iki taraf arasında veri dosyayla taşınır (bkz. "Dışa aktarım ve ofisle veri alışverişi").

## Kurulum ve ilk açılış

Uygulama bir kurulum dosyasıyla (APK) kurulur; mağazadan indirilmez. Android 8.0 ve üstü telefonlarda çalışır.

1. `Sebeke-M-2.5.x.apk` dosyasını telefona alın (GitHub › Releases; e-posta, Drive ya da kablo ile).
2. Dosyaya dokunun. Telefon "bu kaynaktan uygulama yüklemeye izin ver" diye sorarsa izin verin.
3. Kurulum bitince uygulamayı açın.
4. İlk açılışta sorulan izinleri verin: konum, yakındaki cihazlar (Bluetooth), kamera ve bildirim.
5. "Projeler" ekranı açılır. İlk projenizi oluşturun.

Eski sürüm kuruluysa silmeyin; yeni dosyayı üzerine kurun. Projeleriniz yerinde kalır.

| Kurulu sürüm | 2.4.0 üzerine kurulur mu |
| --- | --- |
| 2.1.0, 2.2.0, 2.3.0 | Evet, veri korunur |
| 2.0.0 | Hayır; imzası farklıdır. Kaldırıp kurmak telefondaki projeleri siler |
| 2.1.0-geri-donus | Hayır. Kaldırmayın; bu telefon için ayrı bir kurulum dosyası hazırlanmalıdır |

Uygulamanın kaydettiği dosyalar telefonda `İndirilenler/Sebeke-M` klasörüne iner.

## Ekranlar bir bakışta

Uygulamanın beş ana ekranı vardır; ekranın altındaki menüden geçilir. Proje açık değilken Ayarlar dışındaki ekranlar "Önce bir proje açın" der.

| Alt menü | Ne yapılır |
| --- | --- |
| Harita | Obje alınır, hat çizilir, seçilen objenin kartı açılır |
| Aplikasyon | Bir hedef noktaya yürünür ve zemine işaret çakılır |
| Hesaplar | Açıklık, sehim, metraj, hakediş ve kontrol listesi |
| Dışa Aktar | Çizim, Excel, rapor ve teslim paketi üretilir |
| Ayarlar | Gruplu menü: Ölçüm, Düzeltme kaynağı, Hassasiyet eşikleri, Koordinat sistemi, Harita, Veri ve kullanıcılar, Deneme ve eğitim, Hakkında |

Ayarlar ekranının üstündeki kart o anki konum kaynağını ve düzeltme durumunu özetler; dokununca Ölçüm grubu
açılır. **Hakkında** grubunda uygulamanın amacı, neler yapabildiği ve sürümü yazar (AutoCAD eklentisinin Hakkında
penceresiyle aynı metin).

### Üst durum çubuğu

Ekranın en üstündeki çubuk konumun ne kadar güvenilir olduğunu gösterir. Alım yapmadan önce buraya bakın.

| Gösterge | Anlamı |
| --- | --- |
| `RTK FIX` (yeşil) | Santimetre doğruluğu; hassas alım için doğru durum |
| `RTK FLOAT` | Desimetre doğruluğu; alım yapılır, kayıt Float olarak işaretlenir |
| `SINGLE`, `DGPS`, `FIX YOK` | Düzeltme yok ya da yetersiz; hassas alım için uygun değil |
| `TELEFON GPS` | Telefonun kendi konumu, ±3–10 m; yalnız deneme için |
| `GNSS YOK` | Konum kaynağı seçilmemiş |
| `±0.012 m` | Yatay doğruluk |
| `UYDU` | Kullanılan uydu sayısı |
| `PDOP` | Uydu dağılımı; küçük olması iyidir (eşik 3,0) |
| `YAŞ` (sarı) | Düzeltme verisi 3 saniyeden eski |

Sağ üstteki Bluetooth simgesi Ayarlar'ı açar; alıcı bağlıyken mavi yanar.

### Harita ekranındaki düğmeler

| Yer | Düğme | İşlevi |
| --- | --- | --- |
| Sol üst | Klasör | Proje merkezi |
| Sol üst | Kuzey oku | Tüm objeleri ekrana sığdırır |
| Sol üst | `CAD` | CAD çizimleri |
| Sol üst | `ϟ` | Enerji kontrolü |
| Sağ üst | Katmanlar | Katman aç / kapat, altlık harita seçimi |
| Sağ üst | Cetvel | Mesafe ölçümü; ikinci dokunuşta alan ölçümü |
| Sağ üst | Kalem | Düğüm taşıma |
| Sağ üst | `₺` | Hakediş renklerini açar / kapatır |
| Sağ alt | `+` `−` ve nişangah | Yakınlaş, uzaklaş, konumuma git |
| Alt çubuk | Nesne seçici | Alınacak objenin türü ve tipi |
| Alt çubuk | `+ HAT` | Hat başlat ya da devam et |
| Alt çubuk | `KAYNAK` | Konumun nereden geleceği |
| Alt çubuk | Büyük düğme | Alım (ör. `DİREK AL`) |
| Alt çubuk | Geri ok | Son alımı geri alır |

## Proje oluşturma

Her iş bir proje içinde tutulur; önce proje oluşturulur, sonra sahaya çıkılır.

1. "Projeler" ekranında `Yeni proje` düğmesine basın. (Ekrana sonradan dönmek için: Ayarlar › Veri ve kullanıcılar › Projeler.)
2. Formu doldurun.
3. `PROJE OLUŞTUR` düğmesine basın. Proje merkezi açılır.

| Alan | Ne yazılır |
| --- | --- |
| Proje adı | Zorunlu. Ör. "OG-03 Hat Yenileme" |
| Proje kodu, Yer, İdare / EDAŞ, Yüklenici | İsteğe bağlı; raporlarda görünür |
| Standart sürümü | Poz ve malzeme kataloğu. Sonradan değiştirilemez |
| Datum | `ITRF96 / TUREF` (varsayılan), `ED50`, `WGS84` |
| 3° dilim (DOM) | 27° … 45°. `Oto` düğmesi dilimi bulunduğunuz konumdan seçer |
| Yükseklik | `Ortometrik (H)` (varsayılan) ya da `Elipsoidal (h)` |
| ENH buz bölgesi | I – IV |
| Çalışma modu | Aşağıdaki tabloya bakın |

| Çalışma modu | Alınan yeni obje |
| --- | --- |
| `Uygulama / as-built` | "Tamamlandı" sayılır, metraja ve hakedişe girer |
| `Tasarım / keşif` | "Yapılacak" olarak kalır |

Koordinat sistemi sonradan Ayarlar › Koordinat sistemi ekranından değiştirilebilir; tüm noktalar yeniden hesaplanır.

### Proje merkezi

Proje merkezi projenin özet ekranıdır. Haritada sol üstteki klasör düğmesiyle açılır.

- Üstte nokta, ekipman, hat ve hata sayıları durur.
- `Saha objeleri`: tüm objelerin listesi, arama ve süzme.
- `Excel aktarım`: toplu veri alma.
- `Kullanıcılar ve hakediş onayı`: roller ve onay.
- "Proje akışı": 14 adımlık iş listesi. Biten adımın yanında yeşil tik olur; sıradaki adım vurgulanır. Bir adıma dokununca ilgili ekran açılır.
- `Revizyon al`: projenin o anki halinin kopyasını saklar. Ad ve gerekçe sorar.
- `Denetim kaydı`: kim, neyi, ne zaman, neden değiştirdi.

### Proje silme

1. Ayarlar › Veri ve kullanıcılar › `Projeler` ekranını açın.
2. Silinecek projenin satırındaki çöp kutusuna basın.
3. Onay için proje adını yazın, `Kalıcı olarak sil` deyin.

Proje; noktaları, objeleri, hatları, fotoğrafları ve hakediş kayıtlarıyla birlikte telefondan silinir ve geri alınamaz. Gerekirse önce Dışa Aktar ekranından teslim paketi alın. Onay mekanizması açıksa projeyi yalnız Yönetici silebilir. Projeyi kopyalama düğmesi yoktur.

## GNSS alıcıyı bağlama

Hassas alım için harici bir GNSS alıcı Bluetooth ile bağlanır ve düzeltme verisi (TUSAGA-Aktif, kendi sabit istasyonunuz ya da yerel bir CORS ağı) açılır. Ayarlar ekranı gruplu bir menüdür (1.11.2026): alıcı ve yöntem **Ölçüm**, düzeltme profilleri **Düzeltme kaynağı** grubundadır.

![Solda Ayarlar ekranının konum kaynağı ve ölçüm yöntemi bölümü, sağda kayıtlı NTRIP profilleri](kilavuz/09-gnss-v24.png)

### Alıcıyı Bluetooth ile bağlama

1. Alıcıyı açın ve telefonun kendi Bluetooth ayarlarından eşleştirin.
2. Uygulamada Ayarlar › Ölçüm › "Konum kaynağı" bölümünde `Harici GNSS` düğmesine basın.
3. "GNSS alıcı · Bluetooth" bölümünde `Cihaz Tara` düğmesine basın.
4. Listeden alıcınıza dokunun. Bağlandığında adının yanında `BAĞLI` yazar.
5. `Anten yüksekliği` alanına jalon boyunu metre olarak yazın; ölçü dikse `Dikey`, eğikse `Eğik` seçin.

Liste boşsa alıcı telefonla eşleşmemiştir; birinci adımı tekrarlayın.

### Düzeltme kaynağı: TUSAGA-Aktif, sabit istasyon, yerel CORS

Ayarlar › Düzeltme kaynağı ekranında her kaynak ayrı bir profildir. Uygulama ilk açılışta
üç hazır profil ekler:

| Profil | Hazır gelen | Sizin gireceğiniz |
| --- | --- | --- |
| TUSAGA-Aktif | Sunucu `212.156.70.42`, port `2101`, NTRIP v1, GGA açık | Kullanıcı adı ve şifre (tusaga-aktif.gov.tr hesabınızda alıcıya özel yazılıdır), bağlantı noktası (listeden) |
| Sabit istasyon | Port `2101` | İstasyonu kuran firmanın verdiği bilgiler |
| Yerel CORS ağı | Port `2101` | Ağı işleten kurumun (belediye vb.) verdiği bilgiler |

**Bağlantı türü** iki çeşittir:

- `NTRIP`: sunucu, port, bağlantı noktası (mountpoint), kullanıcı adı ve şifre. TUSAGA-Aktif ve çoğu sabit istasyon böyledir.
- `Doğrudan IP (NTRIP'siz)`: istasyon düzeltmeyi yalnız bir IP adresi ve porttan veriyorsa. Bağlantı noktası, kullanıcı
  adı ve şifre gerekmez.

Adımlar:

1. Profile dokunun (ya da `+ Profil ekle` › türünü seçin › ad verin).
2. Bilgileri girin. Bilgiler mesaj ya da dosyayla geldiyse `Dosyadan al` düğmesine basın (aşağıda).
3. NTRIP'te `Bağlantı noktalarını getir` düğmesine basın ve listeden seçin. Liste en yakın istasyondan başlar.
4. `Akışı dene` düğmesine basın. Alıcı bağlı olmasa da çalışır: 8 saniyede şifrenin, bağlantı noktasının ve verinin
   doğru gelip gelmediğini, düzeltme veren istasyonun numarasını ve size uzaklığını söyler.
5. Alıcıyı bağlayın, `Bağlan` düğmesine basın. Durum "Bağlı" olur; üst çubuk birkaç saniyede `RTK FLOAT`, sonra `RTK FIX` gösterir.

`Alıcı bağlanınca kendiliğinden bağlan` açıksa, seçili profil eksiksizse alıcı her bağlandığında düzeltme de kendiliğinden
açılır (yeni kurulumda açık; önceki sürümden güncelleyenlerde kapalı başlar). Radyo ile çalışan sabit base düzeninde açılmaz.
Şifre ya da bağlantı noktası yanlışsa uygulama bir kez dener, hatayı yazar ve durur (hesap kilitlenmesin); düzeltip
`Bağlan` deyin.

Bağlıyken bölümde düzeltme veren **referans istasyonunun numarası ve uzaklığı** görünür. Tek istasyonla çalışırken uzaklık
arttıkça FIX zorlaşır; 20 km'nin üstünde sarı uyarı çıkar.

`Konumu (GGA) gönder` NTRIP'te açık kalmalı: VRS düzeltmesi konumunuza göre hesaplanır. Alıcı henüz konum bulmadıysa
uygulama telefonun ya da projenin yaklaşık konumunu gönderir, böylece bağlantı beklemede kalmaz.

Telefonda internet olmalıdır; düzeltme telefondan alıcıya iletilir.

### Bağlantı bilgisi dosyası (başka telefona aktarma)

- `Paylaş`: sunucusu dolu bütün profiller `Sebeke-M-GNSS-baglanti.json` dosyasına yazılır; `Şifresiz` ya da
  `Şifrelerle` seçilir (dosyayı alan herkes şifreleri görür).
- `Dosyadan al`: bu dosya seçilir ya da mesajdaki bilgi yapıştırılır. Tanınan biçimler:
  `ntrip://kullanıcı:şifre@sunucu:2101/NOKTA`, `tcp://sunucu:port` ve "Sunucu: … / Port: … / Bağlantı noktası: … /
  Kullanıcı: … / Şifre: …" satırları. Aynı adlı profil güncellenir (dosyada şifre yoksa eskisi korunur), yenisi eklenir.

### Alıcı ayarı (bir kez)

Ayarlar › Ölçüm › "GNSS alıcı · Bluetooth" › `Alıcı ayar rehberi`: alıcıyı kendi yazılımından **Rover** moduna alın, düzeltme
girişini **Bluetooth / telefon** seçin, Bluetooth çıkışına **NMEA** (GGA, GST, GSA, RMC) açın, alıcının kendi internet /
NTRIP bağlantısını ve radyosunu kapatın.

### Sabit istasyon kurulurken firmadan istenecekler

"Sabit istasyon" profilindeki `Sabit istasyon kurulurken firmadan istenecekler` düğmesi listeyi açar: yayın yolu (NTRIP ya
da doğrudan IP:port ve bilgileri), internetten erişim (sabit IP / alan adı, açık port), mesajlar (RTCM 3.2 MSM4 / MSM5 +
1005 / 1006 + 1033 + 1230, saniyede bir), istasyon koordinatı (ITRF96, 2005.0 epoğu; anten yüksekliği, koordinat belgesi),
süreklilik (kesintisiz güç, modem).

### Alıcı markası

Alıcı markası seçimi bu sürümde kaldırıldı. Uygulama marka ayırmaz; alıcının gönderdiği standart konum cümlelerini (GGA, GST, GSA, RMC) okur. Konum gelmiyorsa bu cümlelerin çıkışını alıcının kendi yazılımından açın.

### Float çözümde alım

`RTK FLOAT` durumunda alım serbesttir; uygulama soru sormaz ve noktayı `[RTK FLOAT]` etiketiyle kaydeder. Her alımda onay sorulmasını isterseniz Ayarlar › Hassasiyet eşikleri ekranında `FLOAT çözümde nokta alımına izin ver` anahtarını kapatın.

### Telefon GPS (yalnız deneme)

Ayarlar › Ölçüm › "Konum kaynağı" › `Telefon GPS`. Doğruluk ±3–10 metredir. Noktalar `[TELEFON GPS]` etiketiyle kaydedilir ve kritik noktalar RTK FIX ile yeniden ölçülene kadar kontrol listesinde "ÖLÇÜ KABUL EDİLMEDİ" olarak kalır.

### Kendi base istasyonunuzla çalışma

Ayarlar › Ölçüm › "Ölçüm yöntemi" › `Sabit Base + Rover` altı adımlık rehberi açar. Uygulama base alıcıya bağlanmaz; base'i kendi yazılımından (ör. M-Survey) "Base" moduna alırsınız, rehber bilgileri kayda geçirir.

1. **BASE bağla:** base adı, cihaz / seri no, anten yüksekliği.
2. **BASE konumu:** `Bilinen nokta`, `Manuel koordinat`, `Ortalama al` (60 ölçünün ortalaması) ya da `Kayıtlı base`.
3. **Düzeltme verisi:** `UHF radyo`, `LoRa`, `Dahili / harici radyo`, `NTRIP` ya da `Diğer`. Base düzeltmeyi internetten veriyorsa (NTRIP ya da doğrudan IP:port) `NTRIP` seçin ve bağlantıyı "Düzeltme kaynağı" bölümündeki "Sabit istasyon" profilinden kurun.
4. **ROVER bağla:** elinizdeki alıcıyı Bluetooth ile bağlayın.
5. **Bağlantı kontrolü:** dört satırın dördü de yeşil olmalı.
6. **Ölçüme başla:** `ÖLÇÜME BAŞLA` düğmesi. Bundan sonra base bilgisi her ölçüme yazılır.

### Hassasiyet eşikleri

Uygulama bir ölçüyü aşağıdaki eşiklere göre "uygun" sayar. Değerler Ayarlar › Hassasiyet eşikleri ekranından değiştirilir.

| Eşik | Varsayılan |
| --- | --- |
| Yatay doğruluk (σH) | en çok 0,02 m |
| Düşey doğruluk (σV) | en çok 0,03 m |
| PDOP | en çok 3,0 |
| Uydu sayısı | en az 10 |
| Düzeltme yaşı | en çok 5 s |
| FIX süresi | en az 5 s |
| Ortalaması alınan ölçü sayısı | 5 |

## Nokta ve obje alma

Bir obje üç dokunuşla alınır: ne alacağınızı seçersiniz, konumun nereden geleceğini seçersiniz, büyük düğmeye basarsınız. Hepsi Harita ekranının alt çubuğundadır.

![Solda harita ve alt çubuk, sağda Alınacak nesne penceresi; direk için armatür seçimi en altta](kilavuz/01-obje-alma-v24.png)

### 1. Alınacak objeyi seçin

Alt çubuğun sol üstündeki nesne seçiciye dokunun. "Alınacak nesne" penceresi açılır; üstte üç sekme vardır.

| Sekme | Seçilenler |
| --- | --- |
| `DİREK` | Genel (`AG` / `OG` / `Müşterek` / `AYD.`), alt tip, direk tipi, durum, armatür |
| `TRAFO` | Posta tipi, güç (kVA), cins, durum |
| `DİĞER` | SDK / Box, Pano, Abone, Hat köşe noktası, Detay noktası, Diğer (serbest), Kanal / Kazı, Kablo (yeraltı) |

- Son kullandığınız altı direk tipi pencerenin başında durur; tek dokunuşla seçilir.
- Direk tipinin yanındaki yıldız o tipi favorilere ekler.
- Durum: `YENİ`, `MEVCUT`, `DMM`, `DEMONTAJ`, `İLERİDE`.
- Aydınlatma direği için `DİREK` sekmesinde `AYD.` seçilir.
- Armatür ayrı bir obje değildir; direğin malzemesidir. `DİREK` sekmesinin altındaki `Armatür` listesinden tipi ve yanındaki kutudan adedi seçin. Sonradan değiştirmek için direğin `Kayıt` ekranındaki "Armatür (direğin malzemesi)" alanını kullanın.
- Menhol ve ayrı armatür objesi menüden kaldırıldı. Eski sürümde alınmış olanlar haritada ve listelerde durur.
- Abone için faz (`Tek` / `Üç`), abone no ve `Kofre var` / `Kofre yok` seçilir.
- Direğin rolü (taşıyıcı, durdurucu, köşe, nihayet) ve köşe açısı hat çizilince kendiliğinden hesaplanır.

`TAMAM` ile pencereyi kapatın. Bu seçim yalnız hazırlıktır; alım düğmesine basana kadar hiçbir şey kaydedilmez.

### 2. Konum kaynağını seçin

`KAYNAK` düğmesi beş seçenek sunar. Seçilen kaynak her objeye etiket olarak yazılır; haritada, listelerde ve raporlarda görünür.

| Kaynak | Nasıl çalışır | Etiket |
| --- | --- | --- |
| `GNSS (Harici / RTK)` | Bağlı alıcının konumu alınır | `[RTK FIX]`, `[RTK FLOAT]` ya da `[GNSS]` |
| `Telefon GPS` | Telefonun konumu alınır, ±3–10 m | `[TELEFON GPS]` |
| `Manuel koordinat` | Sağa, yukarı ve Z değerleri elle yazılır | `[MANUEL]` |
| `Haritadan seç` | Harita kaydırılır, nişangahın durduğu yer alınır; Z bilinmez | `[HARİTA]` |
| `Excel (toplu)` | Excel aktarım ekranı açılır | `[EXCEL]` |

![Solda Veri kaynağı penceresi, sağda elle koordinat girme](kilavuz/02-kaynak.png)

### 3. Alım düğmesine basın

Büyük düğmenin yazısı ve rengi o anki durumu söyler.

| Düğmede yazan | Renk | Anlamı |
| --- | --- | --- |
| `DİREK AL` | Yeşil | RTK FIX var; alım hassas |
| `DİREK AL · FLOAT` | Sarı | Float çözüm; alınır, Float olarak işaretlenir |
| `DİREK AL · FIX YOK` | Kırmızı | Hassas değil; onay sorulur |
| `DİREK AL · TEL.` | Mavi | Telefon GPS |
| `DİREK · ELLE` | Sarı | Koordinatı elle yazacaksınız |
| `DİREK · BURAYA` | Mor | Nişangahın durduğu yer alınacak |
| `KAYNAK YOK` | Gri | Konum kaynağı seçilmemiş |
| `ÖLÇÜLÜYOR 3/5` | Dolan çubuk | Ölçülerin ortalaması alınıyor; jalonu oynatmayın |

Kayıt bitince telefon titrer ve "D-017 kaydedildi" yazısı çıkar. Bir hat çiziyorsanız obje o hatta kendiliğinden bağlanır.

### Uygulama uyarırsa

Ölçü eşikleri tutmuyorsa "Hassas alım için uygun değil" penceresi açılır ve nedenleri sıralar (ör. "Uydu 8 < 10", "PDOP 3.4 > 3").

- `Vazgeç · FIX bekle`: kayıt yapılmaz. Birkaç saniye bekleyip yeniden deneyin.
- `Yine de kaydet`: nokta "uyarıyla kabul" notuyla saklanır, kontrol listesinde görünür ve sonradan RTK FIX ile yeniden ölçülebilir.

### Elle koordinat girme

1. `KAYNAK` › `Manuel koordinat` seçin, alım düğmesine basın.
2. `Koordinat sistemi` seçin.
3. `Y · Sağa` (6 haneli) ve `X · Yukarı` (7 haneli) değerlerini yazın. Yerleri karışırsa uygulama düzeltir.
4. `Z · Yükseklik` yazın ya da `Z bilinmiyor` anahtarını açın.
5. `Kaydet` düğmesine basın.

### Son alımı geri alma

Alt çubuğun sağındaki geri ok yalnız en son alımı siler; onay sorar. Daha eski bir objeyi silen düğme yoktur. Yanlış alınmış eski bir objenin durumunu kayıt ekranından değiştirebilir ya da noktayı yeniden ölçebilirsiniz.

### Alınmış bir objeye dokununca

Haritada bir objeye dokununca alt çubuğun yerine o objenin kartı gelir.

| Düğme | İşlevi |
| --- | --- |
| `Kayıt` | Objenin tüm bilgileri, malzemeleri ve fotoğrafları |
| `Fotoğraf` | Kamerayı açar |
| `Yeniden ölç` / `GNSS ile ölç` | Aynı noktayı yeniden ölçer; gerekçe sorar, yeni kayıt açmaz |
| `Aplikasyon` | Bu noktayı hedef yapar |
| `Buradan hat başlat` | Bu noktadan yeni hat başlatır |
| `Tepe kuvveti (cer vektör hesabı)` | Yalnız direklerde |
| Hakediş durumu satırı | Altı durumdan birine dokunarak değiştirilir |

### Fotoğraf çekme

1. Objenin kartında `Fotoğraf` düğmesine basın.
2. İsterseniz açıklama yazın (ör. "taban", "topraklama").
3. Yuvarlak düğmeyle çekin ya da `Galeri` ile telefondaki fotoğraflardan seçin. Art arda çekebilirsiniz.
4. `Bitti` düğmesine basın.

Fotoğraflar `D-017_01.jpg`, `D-017_02.jpg` diye adlandırılır ve `İndirilenler/Sebeke-M/<PROJE>/<TÜR>/<ObjeNo>/` klasörüne kopyalanır. Her fotoğrafın altına proje adı, obje no, tarih, koordinat ve doğruluk yazılır. Çekilmiş fotoğrafı silen düğme yoktur.

## Hat çizme

Hat, sırayla alınan direklerin kendiliğinden birbirine bağlanmasıyla çizilir: hattı başlatırsınız, direkleri alırsınız, hattı bitirirsiniz.

1. Alt çubukta `+ HAT` düğmesine basın. "Yeni hat" penceresi açılır.
2. `Hat tipi` seçin: `AG`, `OG`, `AYD.`, `ENH` ya da `ABONE`.
3. `Tesis` seçin: `Havai` ya da `Yeraltı`.
4. `İLETKEN / KABLO` satırını açıp iletkeni ve devre sayısını seçin. Bunu sonradan Hat kaydından da değiştirebilirsiniz.
5. `HAT BAŞLAT` düğmesine basın.
6. Direkleri sırayla alın. Her direk hatta eklenir; açıklık, köşe açısı ve direk rolü kendiliğinden hesaplanır.
7. Bitince hat düğmesine dokunup `HATTI BİTİR` deyin.

Hat çizilirken haritanın sol üstünde "H-01 çiziliyor · alınanlar hatta eklenir" yazar ve son direkten bulunduğunuz yere kesik bir çizgi uzanır.

![Solda Yeni hat penceresi, sağda çizilmekte olan hattın penceresi](kilavuz/03-hat.png)

### Sık gereken işler

| İş | Nasıl yapılır |
| --- | --- |
| OG direklerinde AG hattı da varsa | Hat başlatırken "Aynı direklerde AG hattı da var (müşterek)" anahtarını açın |
| Daha önce alınmış direği hatta bağlamak | Haritada direğe dokunun, `H-01 hattına ekle` deyin |
| Direk olmayan bir dönüş noktası eklemek | Alınacak nesne › `DİĞER` › `Hat köşe noktası`, sonra `KÖŞE AL` |
| Yanlış eklenen son direği hattan çıkarmak | Hat düğmesi › `Son düğümü çıkar` |
| Yarım kalan hatta devam etmek | `+ HAT` › "Mevcut hatta devam et" listesinden seçin, ya da hatta dokunup `Devam çiz` deyin |
| Bir direği hatta eklemeden almak | Hat düğmesi › `Alınanları bu hatta ekle` anahtarını kapatın |

Abone ve "Diğer" türü objeler hatta kendiliğinden bağlanmaz.

### Yeraltı kablosu ve kanal

Yeraltı hattında kanalın `Cins`'i (zemin: `Toprak`, `Tüvenan`, `Mıcır`, `Branşman kanalı`, `Kablo demontaj kanalı`), `Kaplama`'sı (`Kaplamasız`, `Parke`, `Asfalt`, `Beton`) ve `Ek` (`Bariyerli`, `Trencher`) ayrı ayrı, sonra `Yöntem` seçilir. `Derinlik (m)` zorunludur; girilmeden hat başlamaz.

Seçimden AutoCAD'e giden kanal kalemi adı kurulur; AutoCAD eklentisindekiyle aynı kural (ör. Tüvenan + Parke + Bariyerli → `PARKE TUVENAN (BARİYERLİ)`, Toprak + Asfalt → `TOPRAK (ASFALT KAPLAMALI)`). Hat kaydı ekranında "AutoCAD kalem adı" satırı bunu gösterir. AutoCAD'den gelen ve bu kurala uymayan bir ad olduğu gibi korunur; cins ya da kaplama seçilince yenisi yazılır. Eski sürümde tek `Kaplama` seçimiyle girilmiş hatlar okunur (Parke ve Asfalt → Tüvenan zemin, Beton → Toprak zemin).

| Yöntem | Uygulamanın hesapladığı |
| --- | --- |
| `Açık kazı` | Kazı hacmi = kanal boyu × genişlik × derinlik (m³); seçilen kaplamanın kalemine yazılır |
| `Borulu geçiş` | Kazı hacmi ve boru boyu (kanal boyu × boru adedi); `Boru çapı` ve `Boru adedi` sorulur |
| `Yatay sondaj` | Yalnız sondaj boyu (m); kazı hesaplanmaz |

![Solda yeraltı hattı başlatırken kaplama ve yöntem seçimi, sağda hat kaydında kanal hesabı](kilavuz/03-hat-v24.png)

- Aynı kanalda başka gerilimde kablo da gidiyorsa `Aynı kanalda AG kablosu da var` anahtarını açın. Yeraltında direk olmadığı için anahtarın adı artık kanalı söyler; hesap değişmedi.
- Yalnız kazı yapıldıysa `Yalnız kanal / kazı` anahtarını açın; kablo metrajı çıkmaz, kanal hesabı çıkar.
- Kum, uyarı bandı, koruma plakası, ek ve başlık kendiliğinden gelmez; Hat kaydı › "Malzemeler" › `Malzeme ekle` ile eklenir.
- "Direk inişi" ve "Duvar geçişi" seçenekleri kaldırıldı. Eski sürümde bu seçenekle girilmiş hatlarda kaplama seçilene kadar kazı hesaplanmaz; Hat kaydı ekranı bunu uyarır.
- Asfalt, beton ve parke kaplamalı kanal, mıcır zeminli kanal ile boru kalemlerinin poz numarası ve fiyatı henüz girilmemiştir; Hesaplar › Poz kataloğu ekranından girin.

### Kanal listesi

Proje merkezinde `Kanal listesi (proje bazında)` düğmesi: her projenin (AutoCAD'den gelen bölgenin) kanalları; her satırda baş – bit numarası, kablolar, cins, kaplama, ölçü, uzunluk, hacim, durum ve hakediş; her projenin altında toplam, en altta genel toplam. Üstteki düğmelerle tek projeye ya da tek hakedişe süzülür. Aynı liste Dışa Aktar › Excel dosyasında `Kanal Listesi` ve `Kanal Özeti` (proje × kalem adı × durum) sayfalarıdır; AutoCAD'de Proje Özeti'nde ve çizime tablo olarak (`Kanal Listesi`) aynı satırlar çıkar.

### Hat kaydı

Haritada hatta dokunup `Hat kaydı` deyin. Bu ekranda hat adı, tipi, gerilimi, iletken devreleri ve kanal bilgileri düzeltilir; düğümler ve açıklıklar listelenir.

| Düğme | İşlevi |
| --- | --- |
| `+ Devre` | Hatta ikinci bir iletken devresi ekler |
| `Uzat (devam çiz)` | Hattı yeniden çizime açar |
| `Ters çevir` | Hattın yönünü değiştirir |
| `Birleştir` | Ucu ortak olan başka bir hatla birleştirir |
| `Böl` (düğüm satırında) | Hattı o düğümden ikiye ayırır |
| `№ Direklere numara ver` | Bu hattın direklerine sırayla numara verir |
| `Ofset hat` | Hattın paralelinde tasarım noktaları ve yeni hat oluşturur |
| `ENH hesabı` | Yalnız OG / ENH hatlarında |
| `Sil` | Hattı siler; gerekçe ister |

Değişiklikler `KAYDET` düğmesine basınca işlenir.

## Trafo, kabin ve kablo kanalları

Köşk tipi trafolarda hücre kendiliğinden gelmez; köşkün içi "Kabin" ekranında elle kurulur. Köşk gövdesi, eklediğiniz hücreler ve kablo kanalları keşfe ayrı kalemler olarak gelir.

1. Haritada trafoya dokunun. Açılan kartın en üstündeki `Kabin · hücreler ve kablo kanalları` düğmesine basın. Aynı düğme trafonun `Kayıt` ekranında da vardır.
2. `Yapı sınıfı` seçin: `Monoblok köşk` ya da `Prefabrik köşk`.
3. `Yerleşim ölçüsü` (monoblokta `Tip`), `Yerleşim` ve `Trafo gücü` seçin.
4. `Hücre yalıtımı` seçin: `Hava (hd)` ya da `Gaz (gd)`. Keşfe gelen hücre kalemleri buna göre değişir.
5. Hücreleri ekleyin (aşağıda). Kabin boş başlar.
6. Gerekirse kablo kanalı ekleyin (aşağıda).
7. `Köşk tipi` listesinden köşkün kalemini seçin (aşağıda).
8. `KABİNİ KAYDET` düğmesine basın.

Düğme monoblok ve prefabrik köşk trafolarında görünür; direk tipi trafoda yoktur. Bina tipi trafo (trafo binası) kabin ekranından kaldırıldı: trafo alınırken posta tipi olarak yine seçilebilir, ama içine hücre yerleştirilmez. Eski sürümde kurulmuş bina tipi kabinler açılır ve düzenlenir.

Seçimlerin altında köşkün planı çizilir ve üç ölçü gösterilir: hücre sırasının boyu, kalan yer ve koridor genişliği. Kalan yer eksiye düşerse kırmızı, koridor 800 mm'nin altına inerse sarı olur.

![Solda trafo kartı ve Kabin düğmesi, sağda kabin ekranında hücre ekleme, kanal ekleme ve köşk tipi](kilavuz/04-kabin-v24.png)

### Hücre ekleme ve çıkarma

| İş | Nasıl yapılır |
| --- | --- |
| Hücre eklemek | `Hücre serisi` seçin (`Ulusoy HMH 36`, `EVA 36 kV`, `EVA+ 36 kV`), listeden hücreyi seçin, `Ekle` deyin |
| Hücreyi çıkarmak | Hücre satırındaki çöp kutusu |
| Sırasını değiştirmek | Satırdaki sol ve sağ oklar |
| Aynısından bir tane daha | Satırdaki artı simgesi |
| Tipini değiştirmek | Satırdaki tip listesi |
| Fider adı ve yönü | Satırdaki `Fider adı` kutusu ve `Giriş` / `Çıkış` listesi |

Hücre köşke sığmıyorsa eklenmez; uygulama gereken ve kalan mesafeyi yazar. Daha geniş bir köşk tipi seçin ya da bir hücre çıkarın.

### Kablo kanalı ekleme

"Kanal ekle" kartında `Ad` (ör. "OG giriş kanalı"), `Uzunluk (m)`, `Genişlik (mm)` ve `Derinlik (mm)` yazıp `Kanal ekle` deyin. Kanal keşfe metre olarak gelir. Prefabrik köşkte tip projedeki kablo bölmesi planda görünür ama keşfe gelmez; keşfe yalnız sizin eklediğiniz kanallar gelir.

### Köşk tipi

`Köşk tipi` listesi köşkün kendisinin keşfe hangi kalemle geleceğini belirler. Aynı liste trafo alınırken "Alınacak nesne" penceresinde de sorulur.

- Prefabrik beton köşk: PB-1, PB-2, PB-3 ya da PB-4.
- Monoblok köşk: TİP-1A, TİP-1B ya da TİP-1C. `Otomatik` seçilirse tip dış boydan bulunur (5500 mm'ye kadar TİP-1A, 6500'e kadar TİP-1B, 7500'e kadar TİP-1C).
- `Köşk kalemi yok (mevcut yapı)`: köşk zaten vardı, yalnız içi yenilendiyse.

Kabin hiç kurulmasa da trafo alınırken seçilen köşk tipi keşfe gelir. PB köşklerin iç ölçüleri uygulamada tanımlı değildir; prefabrik köşkün plan çizimi ve sığma kontrolü tip proje ölçüsünü (EK-1A, EK-1B, EK-1C) kullanır.

### Kontroller ve keşif

Ekranın altındaki "Kontroller" bölümü hataları kırmızı, uyarıları sarı gösterir: hücrelerin sığıp sığmadığı, çalışma koridoru, trafo koruma hücresi, kapı ve havalandırma gibi. "Keşfe gelecek kalemler" tablosu kaydetmeden önce listeyi gösterir; "Ağırlıklar" toplam taşıma ağırlığını verir.

## Harita: altlık, katmanlar ve CAD çizimi

Haritanın görünümü sağ üstteki Katmanlar düğmesinden ayarlanır; proje çizimi sol üstteki `CAD` düğmesiyle haritanın üzerine açılır.

### Altlık harita

Katmanlar penceresinin altındaki `Altlık` listesinden seçilir. Üç grup vardır:

- **Ücretsiz (anahtarsız)**: `OpenStreetMap`, `OpenTopoMap (topografik)`, `Esri uydu görüntüsü`. Her zaman kullanılabilir.
- **Anahtarlı (ücretsiz katmanı olan)**: `MapTiler sokak`, `MapTiler uydu`, `Esri uydu (ArcGIS anahtarı)`, `Google harita`, `Google uydu`, `Google uydu + yol adları`, `Bing uydu`, `Bing uydu + yol adları`, `Azure Maps uydu`, `Azure Maps yol haritası`, `Yandex harita`. Kendi anahtarınızı Ayarlar › Harita › "Harita altlığı" bölümüne yazın; anahtar girilmemişse o altlık listede kapalı görünür ve denenmez (anahtarsız genel adresler kaldırıldı; sağlayıcı koşullarına uymuyordu). Bing yalnız kurumsal (Enterprise) anahtarla çalışır; yeni anahtar alacaksanız Azure Maps'i seçin. Liste AutoCAD eklentisinin altlık listesiyle aynıdır.
- **Özel**: kendi karo sunucunuz (XYZ adresi: `{z}`, `{x}`, `{y}` ya da Bing tipi `{q}`).

Notlar:

- Altlık için internet gerekir. Haritanın altında altlığın atıf yazısı görünür; altlık yüklenemezse uygulama sebebini söyler (anahtar, erişim, kota ya da ağ) ve `Altlık değiştir` önerir.
- Toplu / offline indirme yalnız koşulları buna izin veren altlıkta (özel sunucu) vardır; bakılan alanların karoları yine telefonda saklanır.
- Her altlığın kullanım koşulu ve ücretsiz kotası Ayarlar'daki açıklamasında yazar (ör. MapTiler ücretsiz plan, Google Map Tiles API aylık ücretsiz pay, Yandex Tiles API).
- Anahtarlı altlıklar gerçek telefonda henüz denenmedi.

### Katmanlar

Katmanlar penceresinde her satır bir katmanı açar ya da kapatır: A.G. şebeke, O.G. şebeke, Aydınlatma, E.N.H., Abone, Yeraltı kablo, Kanal kenarı ve sondaj, Trafo ve box, Mevcut elemanlar, Demontaj (sarı), Hakediş durumu (renkler), Veri kaynağı etiketleri, Ölçü noktaları, Etiketler (eleman, hat), Açıklık metrajı, Koordinat ızgarası, Altlık harita, CAD çizimi.

### Haritadaki çizim görünümü

Harita, AutoCAD eklentisinin çizimiyle aynı görünür (renkler ve çizgiler ortak çizim stilinden; `Lejant ve katman ayrıntıları` ekranında hepsi listelenir):

- **Hat renkleri**: A.G. havai yeşil, O.G. havai kırmızı, aydınlatma açık mavi, E.N.H. pembe-mor, abone turuncu kesik, müşterek mor, A.G. yeraltı kablo mavi kesik-nokta, O.G. yeraltı kablo pembe kesik-nokta, kanal gri eksen çizgisi, yatay sondaj sarı-turuncu noktalı. İleride yapılacak hat kesikli, demontaj hattı sarı, mevcut hat soluk.
- **Metraj**: her açıklığa bir kez yazılır (havai hatta iki direk, yer altında iki bağlantı elemanı arası; elemansız kırılma köşesinde bölünmez), açıklığın en uzun parçasının üst yanında, hattın renginde. Kanal ve sondaj metrajı, içindeki kablonun metrajıyla çakışmasın diye bir satır yukarıdadır.
- **Hat etiketi**: "hat no kesit" (ör. `H1 3P+R/P`; mevcutta `(…)`, ileride `<…>`), orta parçanın alt yanında. Etiketler yakınlaşınca görünür.
- **Kanal**: yakınlaşınca eksenin iki yanında kanal genişliğinde iki kenar çizgisi görünür (genişlik girilmemişse 0,4 m). Yatay sondajla geçen kablonun altında sondajın noktalı çizgisi vardır.

### Ölçüm ve düzenleme araçları

| Araç | Kullanımı |
| --- | --- |
| Mesafe ölçümü | Cetvele bir kez dokunun, haritada noktalara dokunun. Toplam, son parça ve semt görünür |
| Alan ölçümü | Cetvele ikinci kez dokunun. Üç noktadan sonra alan ve çevre görünür |
| Düğüm taşıma | Kaleme dokunun, noktayı sürükleyin. Gerekçe ister; noktanın kaynağı `[MANUEL]` olur |
| Haritaya uzun basma | "Tasarım noktası ekle", "Buraya aplikasyon yap" ya da "Buradan ölçüm başlat" |

### CAD çizimi açma

1. Sol üstteki `CAD` düğmesine basın.
2. `Çizim aç (DXF ya da NCZ)` deyin ve dosyayı seçin.
3. Çizim haritanın üzerine gelir ve ekrana sığdırılır.

Çizimin koordinatları projenin koordinat sisteminde olmalıdır; değilse çizim başka yerde görünür. Her çizim için `Göster` anahtarı, `Sığdır`, `Katmanlar` ve `Kaldır` düğmeleri vardır. Çizimi kaldırmak alınmış objeleri etkilemez.

### Çizimdeki bir noktayı kullanma

Çizimde bir çizgi ucuna, köşeye ya da merkeze dokunun. "Çizim noktası" kartı açılır; koordinatı, katmanı ve o noktada birleşen çizgileri gösterir.

| Düğme | İşlevi |
| --- | --- |
| `Aplikasyon yap` | Bu noktayı hedef yapıp Aplikasyon ekranını açar |
| `Tepe kuvveti` | Noktada birleşen çizgileri kol sayarak direk tepe kuvvetini hesaplar |
| `Buraya ekle: DİREK AL` | Alt çubukta seçili objeyi bu noktaya kaydeder; kaynak `[HARİTA]` olur |

![Solda çizimde seçilen nokta ve kartı, sağda tepe kuvveti sonucu](kilavuz/05-cizim-tepe.png)

## Aplikasyon

Aplikasyon ekranı sizi seçtiğiniz hedef noktaya yürütür ve toleransın içine girince zemine işaret çakmanızı ister.

### Hedef seçme

| Yol | Nasıl |
| --- | --- |
| Listeden | Aplikasyon ekranında `Hedef nokta` kartına dokunun. En yakın noktalar üstte sıralanır |
| Haritadan | Bir objeye dokunup `Aplikasyon` deyin, ya da haritaya uzun basıp `Buraya aplikasyon yap` deyin |
| Çizimden | `Ayrıntılar` bölümündeki `CAD çizimi aç` ile çizimi açın, çizimde bir uca dokunun, `Aplikasyon yap` deyin |
| Sıradaki | `SONRAKİ` düğmesi aynı hattaki bir sonraki düğüme geçer |

### Hedefe yürüme

Ekran (1.11.2026 tasarımı) tek bakışta okunacak şekilde düzenlenmiştir: solda radar (hedefin yürüyüş yönünüze göre yeri;
pusula yoksa kuzeye göre), sağda büyük harflerle **kalan mesafe** ve altında **ileri / geri** ve **sağa / sola** ne kadar
yürüyeceğiniz. Altındaki mavi satır ne yapacağınızı söyler: "Hedef önünüzde · ileri yürüyün", "Hedef sağınızda · sağa
dönün", 20 cm'den yakında "küçük adımlarla yaklaşın". Yaklaştıkça radar halkalarının ölçeği küçülür. `İŞARETLE` ve
`SONRAKİ` düğmeleri ekranın altına yapışıktır; kaydırmak gerekmez.

![Aplikasyon ekranı: radar, kalan mesafe, yönler ve alttaki İŞARETLE çubuğu](kilavuz/06-aplikasyon.png)

| Gösterge | Anlamı |
| --- | --- |
| `Kalan mesafe` | Hedefe yatay uzaklık (büyük sayı) |
| `… m ileri` / `geri`, `… m sağa` / `sola` | Hangi yöne ne kadar yürüyeceğiniz (yürüyüş yönü bilinince) |
| `Kot farkı` (dolgu + / kazı −) | Hedef kotuna göre yükseklik farkı |
| `Eksen` | Hat ekseninden ne kadar saptığınız (sağ / sol; izin 0,20 m) |
| `Doğruluk` | Ölçünün yatay doğruluğu (σH) ve tolerans |
| `BEKLİYOR` → `YAKLAŞIYOR` → `TOLERANS İÇİ`, `FIX` | Durum rozetleri |

`Ayrıntılar` satırına dokununca tolerans bandı, hedef ve mevcut koordinatlar, CAD çizimi düğmeleri ve son
aplikasyonlar açılır; bir kez açınca açık kalır.

### İşaretleme

1. "Zemin işareti" altında ne çakacağınızı seçin: `Kazık`, `Çelik çivi`, `Röper boya` ya da `Poligon kazığı`.
2. Toleransın içine girince telefon titrer ve büyük düğme `İŞARETLE · D-017` olur.
3. İşareti çakın ve düğmeye basın. Uygulama kaydı alır ve sıradaki hedefe geçer.

Düğme yalnız iki koşul birlikte sağlanınca açılır: toleransın içinde olmak ve `RTK FIX`. `TOLERANS DIŞI` yazıyorsa hedefe yaklaşın; `FIX BEKLE` yazıyorsa yerinizde bekleyin; `HEDEF SEÇİN` yazıyorsa önce hedef seçin.

Tolerans varsayılan olarak 0,02 metredir; Ayarlar › Hassasiyet eşikleri › `Aplikasyon toleransı` satırından değiştirilir.

## Teknik hesaplar (Hesap Merkezi)

Hesap sayfaları uygulamaya formülleri değiştirilmeden eklenmiştir;
AutoCAD eklentisinde de aynı sayfalar açılır. İki hesap vardır:

| Hesap | Ne yapar |
| --- | --- |
| Direk Tepe Kuvveti (Cer Vektörü) | Direğe bağlı bütün hatların çekme kuvvetlerinin vektörel toplamı ve bileşke yönü; direk tipi kontrolü |
| Kanal Planı | Yeraltı kablo kanalı kesit detayları: kablo dizilişi, kanal genişliği ve derinliği, kazı metrajı, DXF |

(1.11.2026'dan önceki sürümlerde bulunan sehim, uplift, gerilim düşümü, kısa devre gibi hesaplar kaldırıldı; eski
kayıtları projede bilgi olarak durur.)

**Nereden açılır:** bir direğin, trafonun ya da hattın kendi ekranındaki `Hesaplar` düğmesi; haritada objenin
balonundaki `Teknik hesaplar`; hat listesindeki `Hesaplar`; ya da `Hesaplar › Teknik hesaplar` (proje geneli).
Objeden açılınca liste o objeye **uygun** hesapları üstte, uygun olmayanları nedenleriyle birlikte altta katlanmış
gösterir.

**Sayfada:** üstte hesabın adı, hedef (`Direk D-17`), durum (`19 bilgi projeden · 2 eksik`), `Kaydet` ve `ⓘ`.
Objenin bilgileri (tip, açıklıklar, iletken, kot, trafo gücü, kablolar…) hesaba kendiliğinden yazılır. Projede
olmayan bilgiler **turuncu çerçeveyle** gösterilir ve elle girilir; uygulama tahmin etmez. `ⓘ` paneli hangi bilgi
nereden geldi, neler eksik (`Alana git`), uyarılar ve "Hesap hakkında" (aracın bilinen sınırları, doğrulanması
gereken tablo değerleri, kaynak) bölümlerini gösterir.

**Kaydet:** sonuç (özet, UYGUN / UYGUN DEĞİL / BİLGİ, girdiler, değerler, uyarılar) ve hesabın tam durumu projeye
yazılır. Kayıtlı sonuç listeden yeniden açılır; proje o arada değiştiyse `GÜNCEL DEĞİL` rozeti çıkar, `ⓘ` panelinde
değişen bilgiler listelenir ve `Güncel bilgileri hesaba aktar` ile yeni değerler yazılır. Hedef obje silinmişse
`HEDEF YOK`. Kayıtlar AutoCAD proje dosyasıyla iki yöne de taşınır ve raporun "11. Teknik hesaplar" bölümünde çıkar.

**Yazdırma ve dosya:** aracın kendi `Yazdır` düğmesi uygulamanın yazdırma ekranını açar; DXF / CSV gibi dosyalar
`İndirilenler/Sebeke-M/<proje>/HESAPLAR` klasörüne iner.

Hesaplar kullanıcının sorumluluğundadır: araç kararı ancak bütün girdiler tamamsa verir; eksik bilgiyle sonuç
BİLGİ olarak kaydedilir. Eski "Tepe kuvveti hesabı" ekranı (aşağıda) ayrıca durur: beton direk de seçebilen,
rüzgâr ve açıklığı hesaba katan daha kapsamlı yöntemdir; yeni araçlar TEDAŞ biçiminde hızlı kontrol ve rapor içindir.

## Tepe kuvveti hesabı

Bir direğe bağlanan hatların çekme kuvvetleri toplanır, tepe kuvveti kilogram olarak bulunur ve uygun demir ve beton direk önerilir.

Hesap iki yerden açılır:

- **Alınmış direkten:** haritada direğe dokunun, `Tepe kuvveti (cer vektör hesabı)` deyin. Kollar o direğe bağlı hatlardan gelir.
- **Çizimden:** CAD çiziminde hatların birleştiği uca dokunun, `Tepe kuvveti` deyin. Kollar o noktada birleşen çizgilerden gelir.

Hesaplar menüsünde bu hesabın girişi yoktur; yalnız haritadan açılır.

1. `Buz yükü bölgesi` seçin (1–4). Projenin bölgesi hazır gelir.
2. Her kol için yönü ve açıklığı kontrol edin; çizimden ya da hattan otomatik dolar.
3. Her kolda `OG iletkeni` ya da `AG tertibi` seçin. Katman adı iletkeni belli ediyorsa (ör. "OG\_3x477") uygulama kendisi seçer.
4. `Direğin görevi` seçin: `Taşıyıcı`, `Köşede taşıyıcı`, `Durdurucu`, `Köşede durdurucu`, `Nihayet` ya da `Branşman / tevzi`. Uygulamanın önerdiği görevde "öneri" yazar.
5. "Sonuç" kartını okuyun.

Uygulama tanıyamadığı bir katmanda iletkeni size sorar ve seçiminizi o katman adı için hatırlar. Eksik kol varsa `Kol ekle` ile elle eklenir.

### Sonuç kartı

| Satır | Anlamı |
| --- | --- |
| `Tepe kuvveti · demir direk` | Demir direk için bileşke kuvvet (kg) |
| `Beton direk için` | Beton direk için bileşke kuvvet (kg) |
| `Bileşke yönü` | Kuvvetin yönü (derece) |
| `Demir direk`, `Beton direk` | Önerilen en küçük tip |
| `Kuvvetli eksen`, `Zayıf eksen` | Direğin iki eksenine düşen kuvvet |

`Direk` listesinden belirli bir tip seçerseniz kart "Seçilen direk yeterlidir" ya da "Seçilen direk YETERSİZDİR" yazar. `Hesap adımlarını göster` tüm ara değerleri açar.

Yöntem tablo değerleriyle cer ve vektör toplamıdır; müşterek direkte AG kuvvetleri tepeye 0,81 oranıyla indirgenir. Sonuç proje müellifinin kontrolündedir.

## Enerji kontrolü ve otomatik numara

### Enerji kontrolü

Enerji kontrolü, çizdiğiniz şebekede hangi hatların ve objelerin bir kaynağa bağlı olduğunu, hangilerinin kopuk kaldığını gösterir. Kayıtlı veriyi değiştirmez.

1. Haritada sol üstteki `ϟ` düğmesine basın.
2. `OG'ye enerji ver`, `AG'ye enerji ver` ya da ikisini birden açın.
3. OG için kaynak gösterin: pencereyi kapatın, OG hattının beslendiği direğe ya da köşke dokunun, `Buradan OG enerjisi ver` deyin.
4. Haritaya bakın.

| Haritada | Anlamı |
| --- | --- |
| Sarı parlayan hat | Enerjili |
| Gri kesik çizgi | Enerjisiz ya da devre dışı |
| Turuncu parlayan hat | Müşterek hatta devrelerden biri enerjili, diğeri değil |
| Kırmızı çarpılı obje | Enerjisiz |
| Sarı halka ve `ϟ` | Enerji kaynağı |

![Solda enerji verilmiş şebeke, sağda Enerji kontrolü penceresi](kilavuz/07-enerji.png)

- AG tarafında trafolar kendiliğinden kaynaktır. İkisi birden açıkken "AG'yi yalnız OG'den enerji alan trafolar beslesin" anahtarı açıksa, OG almayan trafonun AG'si de enerjisiz görünür.
- Proje dışından beslenen bir AG noktası için o noktaya dokunup `Buradan AG enerjisi ver` deyin.
- Bir hattı ayırmak (kesici açık gibi) için hatta dokunun, `Hattı aç (ayır)` deyin. Geri almak için `Hat AÇIK · kapat`.
- Demontaj ve "ileride" durumundaki hatlar sayılmaz; saymak için penceredeki anahtarı açın.
- Pencere enerjisiz hatları ve objeleri listeler; birine dokununca harita oraya gider.
- Bitince `Enerjiyi kes · kontrolü kapat` deyin.

### Direklere otomatik numara verme

Numaralar sonradan toplu olarak yeniden verilebilir; eski numara kayıtta saklanır, ölçüler, malzemeler ve hakediş durumu değişmez.

1. Proje merkezi › `Saha objeleri` › `№ Otomatik numara` deyin. Tek bir hat için: Hat kaydı › `№ Direklere numara ver`.
2. `Hangi objeler` listesinden seriyi seçin: OG direkleri (D-), AG direkleri (A-), müşterek direkler (M-), aydınlatma direkleri (AY-), tüm direkler tek seri ya da başka bir obje türü.
3. `Sıra` seçin: `Hat güzergâhına göre` ya da `Kayıt sırasına göre`.
4. `Ön ek`, `Başlangıç` ve `Hane` değerlerini yazın. Örnek: ön ek "D-", başlangıç 101, hane 3 → D-101, D-102, D-103.
5. Önizlemede eski ve yeni numaraları kontrol edin.
6. `Numaraları ver` düğmesine basın.

Yeni numaralardan biri başka bir objede kullanılıyorsa düğme açılmaz; ön eki ya da başlangıcı değiştirin. Daha önce çekilmiş fotoğrafların dosya adları eski numarayla kalır.

## Excel ile toplu aktarım

Koordinatı elinizde olan çok sayıda obje tek tek girilmez; hazır şablon doldurulup toplu alınır.

1. Proje merkezi › `Excel aktarım` ekranını açın (ya da haritada `KAYNAK` › `Excel (toplu)`).
2. `EXCEL ŞABLONLARINI İNDİR` deyin. Tek dosyada altı sayfa gelir; sütun açıklamaları "AÇIKLAMA" sayfasındadır.
3. Dosyayı bilgisayarda doldurup telefona geri alın.
4. `Dosyadaki koordinat sistemi` seçin. Proje sisteminden farklıysa uygulama dönüştürür.
5. `Excel (.xlsx) ya da CSV seç` deyin.
6. "Önizleme" kartında bulunan, uygun ve hatalı kayıt sayılarına bakın. Hatalı satırlar nedenleriyle birlikte listelenir.
7. `İÇE AKTAR` düğmesine basın. Yalnız uygun kayıtlar alınır, `[EXCEL]` etiketiyle kaydedilir.

| Sayfa | Zorunlu sütunlar |
| --- | --- |
| Direk | Direk No, X, Y |
| Trafo | Trafo No, X, Y |
| SDK | SDK No, X, Y |
| Kanal | Kanal No, Başlangıç X, Başlangıç Y, Bitiş X, Bitiş Y |
| Armatür | Armatür No, X, Y |
| Genel | Obje Tipi, Obje No, X, Y |

X ve Y sütunlarının sırası karışırsa uygulama hane sayısından tanır (sağa değer 6, yukarı değer 7 hanelidir). Hatalı satırları Excel'de düzeltip dosyayı yeniden seçebilirsiniz; daha önce alınanlar ikinci kez eklenmez.

## Malzeme, keşif ve metraj

Bu sürümde otomatik malzeme reçetesi kapalıdır: objede yalnız sizin seçtiğiniz kalemler gelir, diğer malzemeleri siz eklersiniz. Metraj bunların toplamıdır.

| Obje | Kendiliğinden gelen |
| --- | --- |
| Direk | Direğin kendisi; seçildiyse armatür |
| Trafo | Trafo; köşk tipi seçildiyse köşk; kabinde eklediğiniz hücreler ve kanallar |
| Abone | Kofre (var seçildiyse) |
| Havai hat | İletken boyu |
| Yeraltı hat | Kablo boyu ve kanal hesabı (kazı, boru, sondaj) |

Travers, izolatör, topraklama, kum, uyarı bandı, ek ve başlık gibi yardımcı malzemeler kendiliğinden gelmez.

### Bir objenin malzemeleri

Objeye dokunup `Kayıt` deyin; "Malzemeler" bölümüne inin. Seçiminizden gelen kalemlerde `SEÇİM`, sizin eklediklerinizde `EKLENEN` yazar.

| İş | Nasıl yapılır |
| --- | --- |
| Objeye malzeme eklemek | `Malzeme ekle` › katalogda arayın › `Ekle` › miktarı yazın |
| Hatta malzeme eklemek | Hat kaydı › "Malzemeler" › `Malzeme ekle` |
| Eklenen malzemenin miktarını değiştirmek | Karttaki miktara dokunun, yeni miktarı yazın |
| Eklenen malzemeyi kaldırmak | Karttaki çöp kutusu |

Miktar ve ilave değişiklikleri anında kaydedilir ve denetim kaydına yazılır. Ekrandaki diğer değişiklikler (tip, durum, not) `KAYDET` düğmesine basınca işlenir.

Pano ve "Diğer" türü objelerde kayıt ekranındaki `Poz (hakediş kalemi)` listesinden bir kalem seçilirse 1 adet olarak metraja girer.

### Otomatik reçeteyi açmak

Proje merkezi › "Proje akışı" › `Proje oluştur` adımı Proje bilgileri ekranını açar. Buradaki `Otomatik malzeme reçetesi` anahtarı açılırsa yardımcı malzemeler önceki sürümdeki gibi kurala göre kendiliğinden gelir; o zaman miktar düzeltme ve `Sahada ilave talebi` kullanılır.

Önceki sürümde oluşturulmuş bir projeyi güncellemeden sonra ilk açtığınızda uygulama bir kez sorar: `Bu projede açık kalsın` ya da `Kapat (yeni düzen)`. Siz seçene kadar o projenin metrajı değişmez. Kapatırsanız kurala göre gelmiş yardımcı malzemeler metrajdan çıkar.

### Metraj

Hesaplar › `Metraj` ekranı tüm projenin Yeşil Defter satırlarını üç sayfada gösterir: `Montaj`, `Demontaj`, `DMM`. Bir satıra dokununca hangi objelerden geldiği açılır. "POZ TANIMSIZ" yazan satırın katalogda karşılığı yoktur.

### Kontrol listesi

Hesaplar › `Kontrol` ekranı eksikleri sıralar: tipi seçilmemiş direk, FIX olmadan alınmış kritik nokta, eksik malzeme, uyumsuz direk rolü gibi. Bir bulguya dokununca ilgili kayıt açılır.

### Poz kataloğu

Ayarlar › Veri ve kullanıcılar › `Poz kataloğu`. Ad ya da poz numarasıyla aranır.

| Rozet | Anlamı |
| --- | --- |
| `DEFTERDE` | Yeşil Defter'de miktarı olan kalem |
| `DOĞRULANACAK` | 2.3.0 ve 2.4.0 ile eklenen kalem; adı, poz numarası ve fiyatı resmî kitapla karşılaştırılmalı |
| `EKLENEN` | Sizin eklediğiniz kalem |

- Yeni kalem: sağ üstteki `Kalem ekle`. Ad zorunludur; poz numarası ve fiyat sonradan da girilebilir.
- Düzeltme: kaleme dokunun, `Ad / poz no / fiyat düzelt` deyin. Bu düğme yalnız doğrulanacak ve eklenen kalemlerde çıkar.
- Toplu fiyat: `Fiyat CSV` ile "servis kodu; malzeme fiyatı; montaj fiyatı" sütunlu bir dosya seçilir.

LED armatürler, hava yalıtımlı hücreler, kofre, kablo kanalı ve kaplamalı kanal (asfalt, beton, parke) kalemleri "doğrulanacak" durumdadır; bir kısmının poz numarası henüz yoktur.

## Hakediş ve onay

Her objenin ve her hattın bir hakediş durumu vardır; durum ilerledikçe iş metraja ve hakedişe girer. Onay mekanizması açılırsa her adımı yalnız yetkili rol atabilir.

### Altı durum

| Durum | Haritadaki kısa adı | Metraja girer mi |
| --- | --- | --- |
| Yapılacak | `YAPILACAK` | Hayır |
| Başlandı | `BAŞLANDI` | Hayır |
| Tamamlandı | `TAMAMLANDI` | Evet (onay açıksa kontrol edilene kadar hayır) |
| Kontrol Edildi | `KONTROL` | Evet |
| Hakedişe Girdi | `HAKEDİŞTE` | Evet |
| Hakediş Onaylandı | `ONAYLI` | Evet |

Durum üç yerden değiştirilir: haritada objenin kartından, kayıt ekranından ve "Onayınızı bekleyenler" listesinden. Haritadaki `₺` düğmesi açıkken objeler durumlarının rengiyle görünür. Mevcut ve "ileride" durumundaki objelerin hakediş kalemi yoktur.

### Onay mekanizmasını açma

Onay mekanizması başlangıçta kapalıdır; kapalıyken durumu herkes değiştirebilir.

1. `Kullanıcılar ve hakediş onayı` ekranını açın. Üç yerden açılır: Ayarlar › Veri ve kullanıcılar › "Kullanıcılar ve hakediş onayı" › `Aç`; Hesaplar › Hakediş ekranının sağ üstündeki `Kullanıcılar ve onay`; Proje merkezi.
2. `İlk yöneticiyi tanımla · onayı aç` deyin.
3. Ad soyad ve 4–8 rakamlı şifreyi iki kez yazıp `Kaydet` deyin.
4. `+ Kullanıcı ekle` ile diğer kişileri ekleyin; her birine bir rol ve şifre verin.

İlk yöneticinin şifresini unutmayın: başka yönetici yoksa şifre geri alınamaz.

### Roller ve adımlar

*(Çizim: hakediş onay akışı · 6 durum, 4 rol — Drive'daki PDF kılavuzda görülür.)*

Geri çevirme her zaman gerekçe ister. Kimin, ne zaman, hangi adımı attığı objenin kayıt ekranındaki "Onay geçmişi"nde ve Denetim kaydında görünür.

### Oturum açma ve durum değiştirme

1. `Kullanıcılar ve hakediş onayı` ekranında `Oturum aç` deyin.
2. Adınızı seçin, şifrenizi yazın, `Giriş` deyin.
3. Haritada ya da kayıt ekranında durum satırına bakın. Rolünüzün atamayacağı adımlar soluk görünür.

- Yetkiniz olmayan bir adıma basarsanız uygulama kimin yetkili olduğunu yazar.
- Beş yanlış şifreden sonra o kullanıcı 60 saniye bekletilir.
- Uygulama kapanınca oturum da kapanır. Telefonu başkasına verirken `Oturumu kapat` deyin.
- Şifre hafif bir denetimdir; telefonu ele geçiren birine karşı güçlü koruma değildir.

### Onayınızı bekleyenler

Kontrol mühendisi, hakediş sorumlusu ve onay yetkilisi oturum açınca aynı ekranda sıradaki işlerin listesini görür.

1. Onaylayacağınız satırları işaretleyin. Hiç işaretlemezseniz tümü seçilmiş sayılır.
2. Satırdaki konum simgesi objeyi haritada gösterir.
3. `Seçilenleri onayla` ya da `Tümünü onayla` deyin.
4. Uygun değilse `Geri çevir` deyip gerekçeyi yazın.

### Yöneticinin iki kuralı

| Kural | Açıkken |
| --- | --- |
| `Hakedişe yalnız kontrol edilmiş işler girsin` | "Tamamlandı" durumundaki iş, kontrol mühendisi onaylayana kadar metraja ve hakediş toplamına girmez |
| `Kontrol edilmiş kaydı kilitle` | "Kontrol Edildi" ve sonrası durumdaki objenin tipi, malzemesi ve hattı değiştirilemez; önce geri çevrilmesi gerekir |

İkisi de varsayılan olarak açıktır ve yalnız Yönetici değiştirir. `Onay mekanizmasını kapat` düğmesi her şeyi eski serbest haline döndürür; geçmiş kayıtlar saklanır.

### Hakediş yetkisi (yazmaya kapalı hakedişler)

Yönetici, hakedişleri yazmaya kapatabilir. Kapalı hakedişteki obje değiştirilemez, silinemez; o hakedişe yeni obje eklenemez. Yönetici için bu kısıt yoktur.

1. `Kullanıcılar ve onay` ekranında "Hakediş yetkisi" kartına inin.
2. Kapatılacak hakedişin numarasına dokunun. Kapalı numara kırmızı ve kilitli görünür.
3. Açmak için aynı numaraya yeniden dokunun.

Numaralar AutoCAD'deki hakediş numaralarıdır: AutoCAD'den gelen obje kendi numarasını taşır; telefonda çizilen obje aktif hakedişe (açık dönemin numarası) düşer. İş kalemi olmayan mevcut objeler etkilenmez.

### AutoCAD ile ortak kullanıcılar

Bu ekrandaki kullanıcılar, roller, şifreler ve hakediş yetkisi AutoCAD eklentisinde de geçerlidir. AutoCAD proje dosyasıyla (Dışa Aktar › AutoCAD proje dosyası; eklentide `Telefona Gönder` / `Telefondan Al`) iki yönde taşınır.

- Şifre dosyaya düz yazıyla gitmez; yalnız özeti gider. Aynı şifreyle eklentide de oturum açılır.
- İki tarafta da değişen kullanıcıda son değişiklik kazanır. Kullanıcı silinmez, kapatılır.
- AutoCAD'deki hakediş onayında Kontrol aşamasını Kontrol mühendisi, Hakediş ve GIS aşamasını Onay yetkilisi verir. Yönetici her aşamayı verebilir.

### Hakediş dönemi

Hesaplar › `Hakediş` ekranında dönem açılır ve onaylanır.

1. "İş programı" kartında `Oluştur` deyin. Program güncel metrajdan çıkarılır.
2. `+ Dönem` deyin; başlangıç ve bitiş tarihini "2026-10-01 2026-10-31" biçiminde yazın.
3. Kalemleri üç sayfada inceleyin: `Montaj`, `Demontaj`, `DMM`. Her kalemde sözleşme, önceki, bu dönem, kümülatif ve kalan miktar görünür.
4. `HAKEDİŞİ ONAYLA` deyin. Dönem dondurulur; sonraki değişiklikler bir sonraki dönemde revizyon olarak görünür.

Dönem açılınca iş tarihi dönemin içinde kalan tamamlanmış objeler (onay açıksa yalnız kontrol edilmiş olanlar) "Hakedişe Girdi", dönem onaylanınca "Hakediş Onaylandı" olur. Onay mekanizması açıkken dönemi hakediş sorumlusu açar, onay yetkilisi onaylar.

## Dışa aktarım ve ofisle veri alışverişi

Çizim, Excel, rapor ve teslim paketi tek ekrandan üretilir; dosyalar telefonda `İndirilenler/Sebeke-M` klasörüne iner.

1. Alt menüden `Dışa Aktar` ekranını açın.
2. `Koordinat sistemi` seçin: projenin kendi sistemi, `ED50 3°` ya da `WGS84 UTM`.
3. İstediğiniz çıktıları işaretleyin.
4. `DIŞA AKTAR` ile kaydedin ya da `PAYLAŞ` ile doğrudan e-posta, Drive ya da WhatsApp'a gönderin.

![Solda Dışa Aktarım ekranı, sağda Senkron ekranı](kilavuz/10-disa-aktar.png)

| Çıktı | Dosya | İçeriği |
| --- | --- | --- |
| AutoCAD proje dosyası | .sebeke.json | Şebeke-M Hakediş AutoCAD eklentisi "Telefondan Al" ile açar: direk, hat, kanal ve malzemeler eski program biçiminde (Durum Tespit raporu için). Varsayılan seçilidir |
| Telefon proje dosyası | .volt.json | Projenin tam yedeği (tüm kayıtlar) + AutoCAD bölümü; eklenti ve telefon bunu da açar |
| AutoCAD DXF | .dxf | Katmanlar, semboller (eklentiyle aynı bloklar), yazılar; 1/1000 |
| Netcad NCN | .ncn | Nokta adı, Y, X, Z, kod. Netcad'e DXF ile birlikte alınır |
| Google Earth KMZ | .kmz | AutoCAD eklentisinin Google Earth dosyasıyla aynı: her proje bir klasör (sınır, elemanlar, hatlar, kanallar, sondajlar), GPS noktaları; nesneye dokununca bilgileri (GIS no, tür, tip, durum, hakediş, proje, malzemeler, metraj). Ayrı klasörde (başta kapalı) gerçek yükseklikte 3 boyutlu direk ve tel |
| CBS MapInfo (MIF / MID) | .zip | AutoCAD eklentisinin CBS dosyalarıyla aynı katman ve sütunlar, şebeke elemanı bazında: DIREK, TRAFO, SDK, PANO, ELEMAN (diğer elemanlar), HAT (iletkenleri, adetleri, baş ve bit elemanıyla), KANAL, SONDAJ, BOLGE (proje sınırı), NOKTA (GPS noktası) ve MALZEME (her nesnenin bütün malzeme satırları; haritada yeri olmayan tablo); bütün öznitelikler (GIS no, tür, cins, tip, durum, hakediş, güç, gerilim, kontrol…); her katman bir `.mif` + `.mid` çifti, Türkçe karakterler Windows kod sayfasında. Seçilen koordinat sisteminde yazılır; QGIS ve MapInfo açar |
| CBS Shapefile | .zip | Ekipman, hat, açıklık ve ölçü katmanları |
| GeoJSON | .geojson | CBS yazılımları için |
| Excel | .xlsx | Metraj, Yeşil Defter ve hakediş sayfaları |
| Teknik rapor | .html | Tarayıcıda açılır; yazdırılır ya da PDF olarak kaydedilir |
| Teslim paketi | .zip | Proje klasörü: saha alımı, hakediş, GNSS kayıtları, fotoğraflar, harita, rapor |

- Kontrol listesinde hata varken de çıktı alınabilir; uygulama önce sorar ve hatayı teslim paketine yazar.
- Google Earth ve CBS (MIF / MID) dosyaları AutoCAD eklentisinin dosyalarıyla aynıdır: "ileride" durumundaki nesneler (eklentide olmadıkları için) bu dosyalara yazılmaz, dışa aktarımda uyarı çıkar. Projede AutoCAD'den gelen bölge yoksa proje sınırı yazılmaz; proje adı klasörün adıdır. MIF'te koordinatlar ve `SAGA` / `YUKARI` sütunları seçilen koordinat sistemindedir.
- Veri değişince önceki çıktılar "Son üretilenler" listesinde `ESKİDİ` olarak işaretlenir; yeniden üretin.
- **Çizim boyutları** kartı (DXF, AutoCAD dosyası ya da teslim paketi seçiliyken): simge ve yazı büyüklükleri, **Hat
  kalınlığı** (İnce çizgi · İnce · Normal · Kalın · Çok kalın; Normal'de 1/1000 baskıda OG 0,5 mm, AG 0,35 mm) ve
  **Malzemeleri çizimde göster** (her elemanın malzemeleri simgenin yanında satır satır: `GT-60=1 (M)`). Kalın hatlar
  DXF'te genişlikli çoklu çizgidir (düz çizilir; noktaların kotu ÖLÇÜ katmanında kalır). Ayarlar AutoCAD dosyasıyla
  eklentiye de gider (eklentide Çizim Ayarları › Görünüm).

### AutoCAD eklentisiyle çalışma (Şebeke-M Hakediş)

Büroda eski program çizimleriyle çalışan Şebeke-M Hakediş AutoCAD eklentisi aynı proje dosyasını kullanır:

1. AutoCAD'de **ŞEBEKE-M ARAÇLAR › Telefon › Telefona Gönder** ile yazılan dosyayı Drive'a koyun.
2. Telefonda **Projeler › AutoCAD dosyasından proje al** (ya da açık projede **Proje merkezi › AutoCAD dosyasını bu
   projeye al**) ile seçin. Direkler, hatlar, kanallar, bölgeler ve malzemeler gelir; telefon kataloğunda bulunamayan
   kalemler Poz Kataloğu'nda "AutoCAD" kategorisinde DOĞRULANACAK olarak görünür.
3. Sahada çalışın, sonra **Dışa Aktar › AutoCAD proje dosyası** ile geri gönderin. AutoCAD'de **Telefondan Al** yalnız
   değişen ve eklenen nesneleri çizime işler.

Durumlar şöyle çevrilir: Yeni → M (pozun temini yükleniciyse M+M), Mevcut → MEVCUT, Demontaj → DM, DMM → DM+M.
Objenin ekranında eski program kodu ayrıca seçilebilir (KM, ENH, ME; demontajda KESİK / SÖKÜK); AutoCAD'den gelen kod korunur.
**"İleride" durumundaki objeler AutoCAD dosyasına yazılmaz.**

AutoCAD'den gelen ve telefonda değişmeyen bilgiler aynen geri gider: kalemlerin sıra numarası (INDEX), hakedişi ve
kontrol işareti, bölgenin grup kodu, panonun çıkış şeması, hat parçalarının numaraları. Böylece değişmeyen nesne
AutoCAD'de "değişmiş" görünmez.

**Hakediş onayları**: AutoCAD'deki (eski program) onaylar **Hakediş** ekranında görünür (Kontrol / Hakediş / GIS). AutoCAD'de
onaylı hakediş kilitlidir; o hakedişe dokunan değişiklikler orada aktarılmaz. Telefonda onaylanan dönem AutoCAD'e
kontrol + hakediş onayı olarak gider. Ayrıntı ve komutlar: depo kökündeki `KULLANIM.md`.

### Ofisteki web sürümüyle veri alışverişi

Telefon ile ofisteki web sürümü arasında veri bir dosyayla taşınır; otomatik eşitleme yoktur.

Web sürümü 2.3.0'da bırakıldı; 2.4.0 yalnız telefon içindir. Web, telefondan gelen dosyadaki kanal kaplamasını ve yöntemini, direkteki armatürü ve kapalı otomatik reçeteyi tanımaz; aynı projenin metrajı web'de farklı görünür. Web güncellenene kadar metraj ve hakediş için telefondaki değerleri esas alın.

**Telefondan ofise:**

1. Ayarlar › Veri ve kullanıcılar › "Veri ve senkron" › `Senkron` ekranını açın.
2. `Değişiklikleri paylaş (.vsync)` deyin ve dosyayı kendinize gönderin (e-posta, Drive).
3. Uygulama "Dosya karşı cihaza aktarıldı mı?" diye sorar. Dosya ofise ulaştıysa `Tamam` deyin.
4. Ofiste web sürümünde `Telefonla veri` › `Telefondan gelen dosyayı seç` deyin.

**Ofisten telefona:**

1. Web sürümünde `Telefonla veri` › `Telefon için dosya indir` deyin.
2. Dosyayı telefona alın.
3. Telefonda Senkron ekranında `Dosyadan al` deyin.

Aynı kayıt iki tarafta da değiştiyse "Çakışmalar" bölümünde listelenir; her alan için `Benim` ya da `Gelen` değeri seçersiniz. Fotoğraflar bu dosyaya girmez; telefonda kalır ve teslim paketiyle çıkar.

## Verinin korunması, güncelleme ve geri dönüş

Tüm projeler telefonda, uygulamanın kendi içinde durur. Uygulamayı kaldırırsanız ya da verisini temizlerseniz projeler silinir ve geri yükleyen bir düğme yoktur.

### Veriyi korumak için

| Yöntem | Ne sağlar | Sınırı |
| --- | --- | --- |
| Ofise düzenli `.vsync` göndermek | Proje ofisteki web sürümünde de bulunur | Dosyaya yalnız son gönderimden beri yapılan değişiklikler girer; fotoğraflar girmez |
| Teslim paketi üretmek | Tüm kayıtlar, fotoğraflar ve çizimler dosya olarak elinizde olur | Paket uygulamaya geri yüklenemez |
| `Revizyon al` (Proje merkezi) | Projenin o anki hali uygulamanın içinde saklanır | Telefonun dışına çıkmaz |

Önemli günlerin sonunda teslim paketi üretip Drive'a yüklemek en güvenli alışkanlıktır.

### Güncelleme

Yeni sürümün kurulum dosyasını eski sürümün üzerine kurun; uygulamayı kaldırmayın. Projeler ve ayarlar yerinde kalır, malzeme kataloğu kendiliğinden güncellenir. Sizin değiştirdiğiniz fiyatlar ve eklediğiniz kalemler korunur.

### Eski sürüme dönmek

2.3.0, 2.4.0'ın üzerine kurulamaz; telefon daha eski bir sürümü üstüne kabul etmez. Geri dönmek uygulamayı kaldırmayı gerektirir ve bu telefondaki projeleri siler. Geri dönmeniz gerekirse uygulamayı kaldırmadan önce haber verin; verinin taşınması için ayrı bir kurulum dosyası hazırlanabilir.

## Sık karşılaşılan sorunlar

| Ne görüyorsunuz | Neden | Ne yapmalı |
| --- | --- | --- |
| "Önce bir proje açın" | Açık proje yok | Ayarlar › Veri ve kullanıcılar › `Projeler` |
| Cihaz listesi boş | Alıcı telefonla eşleşmemiş ya da Bluetooth izni verilmemiş | Telefonun Bluetooth ayarlarından eşleştirin; uygulamaya "yakındaki cihazlar" iznini verin |
| Alıcı `BAĞLI` ama konum gelmiyor | Alıcı konum cümlelerini göndermiyor | Alıcının kendi yazılımından GGA, GST, GSA ve RMC çıkışını açın |
| `RTK FLOAT`'ta kalıyor, `RTK FIX` olmuyor | Düzeltme gelmiyor ya da gökyüzü kapalı | NTRIP durumuna ve telefonun internetine bakın; ağaç ve bina altından çıkın; birkaç saniye bekleyin |
| `YAŞ` sarı yanıyor | Düzeltme verisi gecikiyor | İnternet çekimini kontrol edin; NTRIP'i kesip yeniden bağlanın |
| Düzeltmede `Bağlan` çalışmıyor | Harici alıcı bağlı değil | Önce alıcıyı bağlayın; bilgileri `Akışı dene` ile alıcısız deneyebilirsiniz |
| `Akışı dene`: "şifre yanlış (401)" | Kullanıcı adı / şifre | TUSAGA-Aktif'te kullanıcı adı alıcıya özeldir; web hesabınızdan bakın |
| `Akışı dene`: "bağlantı noktası bulunamadı" | Mountpoint adı yanlış | `Bağlantı noktalarını getir` ile listeden seçin |
| "Düzeltme verisi gelmiyor" | VRS konumu almadı ya da istasyon yayında değil | `Konumu (GGA) gönder` açık mı; sabit istasyonun yayında olduğunu firmaya sorun |
| Büyük düğmede `KAYNAK YOK` | Konum kaynağı seçilmemiş | `KAYNAK` düğmesinden seçin |
| "Önce direk tipini seçin" | Direk tipi boş | Nesne seçiciden tip seçin |
| "Hassas alım için uygun değil" | Ölçü eşikleri tutmuyor | `Vazgeç · FIX bekle` deyip bekleyin, ya da `Yine de kaydet` |
| "Köşe noktası için önce hat başlatın" | Çizilen hat yok | `+ HAT` ile hat başlatın |
| "Yeraltı hat için kanal derinliği zorunlu" | Derinlik boş | Hat penceresinde `Derinlik (m)` yazın |
| Hücre eklenemedi | Köşkte yer kalmadı | Daha geniş köşk tipi seçin ya da bir hücre çıkarın |
| CAD çizimi görünmüyor ya da başka yerde | Çizimin koordinat sistemi projeninkinden farklı | Çizimi proje koordinat sisteminde kaydedip yeniden açın; `Sığdır` ile yerini görün |
| Altlık harita boş | İnternet yok ya da adres yanıt vermiyor | Başka altlık seçin; sahaya çıkmadan `Görünen alanı offline indir` deyin |
| `İŞARETLE` düğmesi açılmıyor | Tolerans dışındasınız ya da RTK FIX yok | Hedefe yaklaşın; `FIX BEKLE` yazıyorsa yerinizde bekleyin |
| Hakediş durumu değişmiyor | Oturum açık değil ya da adım rolünüzün yetkisinde değil | Oturum açın; soluk adımları yetkili rol atar |
| "Kayıt kilitli" | Obje "Kontrol Edildi" ya da sonrası durumda | Durum geri çevrilmeli ya da Yönetici düzenlemeli |
| `Numaraları ver` düğmesi açılmıyor | Yeni numaralar başka objelerde kullanılıyor | Ön eki ya da başlangıç numarasını değiştirin |
| Excel'de "Eksik zorunlu sütun" | Şablonun sütun başlığı değişmiş | Şablonu yeniden indirin, başlıklara dokunmayın |
| "Kamera açılamadı" | Kamera izni yok | Telefon ayarlarından izin verin ya da `Galeri` ile seçin |
| Kaydedilen dosyayı bulamıyorum |  | Telefonda `İndirilenler/Sebeke-M` klasörüne bakın |

### Bilinen sınırlar

- Alınmış bir objeyi, noktayı ya da fotoğrafı silen düğme yoktur; yalnız son alım geri alınır. Hat ve proje silinebilir.
- Proje kopyalama yoktur. Proje silme yalnız o telefonda geçerlidir; web sürümündeki ya da başka telefondaki kopyayı silmez.
- Projeyi dosyaya yedekleyip başka telefona geri yükleyen bir düğme yoktur.
- Web (ofis) sürümü 2.3.0'da kaldı; 2.4.0 ile gelen değişiklikleri tanımaz.
- Asfalt, beton ve parke kaplamalı kanal ile boru kalemlerinin poz numarası ve fiyatı girilmemiştir.
- PB köşklerin iç ölçüleri tanımlı değildir; plan çizimi tip proje ölçüsünü kullanır.
- USB ile GNSS bağlantısı yoktur; yalnız Bluetooth.
- Kayıtlı NTRIP profilleri, anahtarlı altlıklar (Google, Yandex, Esri ArcGIS, Bing, Azure Maps) ile büyük CAD dosyaları gerçek cihazda henüz denenmedi. Google Earth (KMZ) ve CBS (MIF / MID) dosyalarının yapısı eklentininkiyle karşılaştırılarak doğrulandı; Google Earth ve QGIS'te açılışları telefonda denenmedi.
- Tepe kuvveti ve ENH sonuçları yardımcı hesaptır; proje müellifinin kontrolünden geçmelidir.
