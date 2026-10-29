# Şebeke-M — Kullanım Kılavuzu

İki araç var, ikisi aynı proje dosyasını (`.sebeke.json`) kullanır:

- **Telefon uygulaması Şebeke-M** (sahada): direk, trafo, SDK, pano koyma; hat ve kanal çizme; malzeme,
  fotoğraf, not; metraj, Yeşil Defter, hakediş ve teslim paketi; teknik hesaplar. Ayrıntılı kılavuz:
  [telefon/docs/KULLANIM-KILAVUZU.md](telefon/docs/KULLANIM-KILAVUZU.md).
- **AutoCAD eklentisi Şebeke-M** (büroda): eski hakediş programının çizimlerini okuma, Durum Tespit raporu,
  telefona gönderme, telefondan alma, çizim araçları (direk, hat, kanal, bölge, nokta alma, malzeme) ve
  **Hesap Merkezi** (teknik hesaplar).

Dosya telefon ile bilgisayar arasında **Google Drive** üzerinden taşınır. Böylece hangi bilgisayarda
çalışırsanız çalışın proje Drive'da durur.

---

## 1. Kurulum

### Telefon

1. Telefondan GitHub'a girin (depo size özeldir; kendi hesabınızla giriş yapın):
   **sebeke-hakedis** deposu › **Releases**.
2. En üstteki **"Şebeke-M telefon uygulaması 2.5.x"** sürümünü açın, `Sebeke-M-2.5.x.apk` dosyasına dokunun.
3. İndirme bitince dosyayı açın. Telefon "bilinmeyen kaynak" uyarısı verirse **Ayarlar › Bu kaynağa izin ver**.
4. **Yükle**. Uygulama "Şebeke-M" adıyla görünür.

Telefonda önceki sürüm (2.1.0 ve sonrası, eski adıyla) kuruluysa **silmeyin**: yeni sürüm üzerine kurulur,
projeleriniz silinmez.

### AutoCAD (2016–2024 ve 2025 ve sonrası)

1. Bilgisayarda GitHub › **Releases** › en üstteki **"Şebeke-M AutoCAD eklentisi 0.1.x"** › `SebekeHakedis-0.1.x.zip` indirin.
2. Zip'e sağ tıklayın › **Tümünü ayıkla**.
3. AutoCAD açıksa kapatın. Ayıklanan klasördeki **KUR.bat** dosyasına çift tıklayın.
   Windows "bilgisayarınız korundu" derse: **Ek bilgi › Yine de çalıştır**.
4. Windows **yönetici izni** sorar: **Evet** deyin. Eklenti AutoCAD'in güvenilir saydığı klasöre
   (`C:\Program Files\Autodesk\ApplicationPlugins`) kurulur; AutoCAD orada imza aramaz, **güvenlik uyarısı çıkmaz**.
5. AutoCAD'i açın. Şeritte **ŞEBEKE-M** ve **ŞEBEKE-M ARAÇLAR** sekmeleri görünür.

Yönetici izni veremiyorsanız (ör. kurum bilgisayarı) **Hayır** deyin: eklenti yine kurulur ama kendi kullanıcı
klasörünüze; o zaman AutoCAD ilk açılışta "imzalanmamış dosya" uyarısı gösterir, **Her zaman yükle** deyin.

Güncellemek için yeni zip ile aynı adımları tekrarlayın. Kaldırmak için **KALDIR.bat**. Sürüm ve komut listesi:
her iki sekmenin başındaki **Şebeke-M › Hakkında** düğmesi (`SH_HAKKINDA`).

---

## 2. Genel iş akışı

### A. Elinizde eski programla yapılmış bir çizim varsa

1. **AutoCAD**: çizimi açın › **ŞEBEKE-M ARAÇLAR › Telefon › Telefona Gönder**.
   Dosyayı Google Drive klasörünüze kaydedin (ör. `Google Drive\Şebeke-M\`).
   *Bilgisayarda Google Drive uygulaması yoksa dosyayı drive.google.com'a sürükleyip bırakın.*
2. **Telefon**: uygulama › **Projeler › AutoCAD dosyasından proje al** › Drive › dosyayı seçin › **Al**.
   Proje, çizimdeki direk, hat, kanal ve bölgeleriyle açılır. Direk tipleri telefonun kataloğundan bulunur;
   bulunamayan malzemeler kataloğa "AutoCAD" kategorisiyle eklenir (Kontrol listesinde görünür, Poz Kataloğu'ndan düzeltilebilir).
3. Sahada çalışın (Bölüm 3).
4. İş bitince **Dışa Aktar › AutoCAD proje dosyası (.sebeke.json)** seçili olsun › **DIŞA AKTAR** ya da
   **PAYLAŞ › Drive**.
5. **AutoCAD**: aynı çizimi açın › **Telefon › Telefondan Al** › dosyayı seçin.
   Açılan pencere ne olacağını söyler: kaç nesne **yeni**, kaç nesne **güncellenecek**, kaçı **aynı**.
   **Evet** deyin.
   - Yalnız telefonda eklenen ve değişen nesneler çizime yazılır; değişmeyenlere dokunulmaz.
   - Telefonda silinmiş görünen nesneler ayrıca sorulur. **Hayır** derseniz çizimde kalırlar.
   - Aynı dosyayı ikinci kez alırsanız bir şey değişmez (çift nesne oluşmaz).
   - **Onaylı (kilitli) hakedişe** dokunan değişiklikler aktarılmaz; pencerede ayrıca listelenir (Bölüm 4, Hakediş Onayı).
   - Telefonda onaylanan hakediş dönemi çizime de onay olarak işlenir.
   - Telefonda yapılan **teknik hesap kayıtları** da çizime alınır (Bölüm 5).
   - Beğenmezseniz AutoCAD'de **U** (Geri Al) aktarımın tamamını tek seferde geri alır.
6. Rapor: **Raporlar › Durum Tespit** (Excel).

### B. Sahada sıfırdan başlıyorsanız

1. **Telefon**: **Projeler › Yeni proje**. Proje adını, kodunu ve **3° dilimi (DOM)** girin
   (Elazığ, Malatya, Erzincan: 39°).
2. Sahada çalışın (Bölüm 3), sonra **Dışa Aktar › AutoCAD proje dosyası** ile Drive'a gönderin.
3. **AutoCAD**: yeni boş bir çizim açın › **Telefondan Al**. Her şey eski programın katman ve bilgi biçiminde
   çizilir; direk, trafo ve SDK simgeleri lejanttaki gibidir (beton direk daire, demir direk kare, yeni dolu,
   mevcut boş, sök-tak yarım, demontaj çapraz). Bu çizim eski programda da açılır ve okunur.
4. Rapor: **Raporlar › Durum Tespit**. Telefonda tek bölge (projenin kendisi) vardır; alt projeler gerekiyorsa
   AutoCAD'de **Bölge** ile çizin, sonraki alışverişlerde korunur.

### Hangi dosya nereye?

| Dosya | Kim yazar | Kim açar |
| --- | --- | --- |
| `<proje>.sebeke.json` — AutoCAD proje dosyası | Eklenti (Telefona Gönder) · Telefon (Dışa Aktar) | İkisi de |
| `<proje>.volt.json` — telefon proje dosyası (tam yedek + AutoCAD bölümü) | Telefon (Dışa Aktar) · Eklenti (istenirse) | İkisi de |
| `<proje>_teslim_paketi.zip` | Telefon | Eklenti (içindeki proje dosyasını okur) · idareye teslim |
| `<proje>.dxf` | Telefon | AutoCAD (eklentisiz de açılır; simgeler eklentiyle aynı bloklar) |

Teknik hesap kayıtları proje dosyasının içinde (`hesaplar`) iki yöne de taşınır.

---

## 3. Telefonda çalışma (kısa)

Ayrıntı için telefon kılavuzuna bakın; AutoCAD ile birlikte çalışırken önemli olanlar:

- **Konum kaynağı**: Ayarlar › GNSS. Bluetooth alıcı + NTRIP (TUSAGA-Aktif ya da kayıtlı sabit istasyon profili),
  ya da telefon GPS'i. Üst çubuk çözümü gösterir (RTK FIX bekleyin).
- **Harita altlığı**: Harita › katman düğmesi. Açık sokak haritası anahtarsız gelir; uydu ve diğer altlıklar için
  **Ayarlar › Harita altlıkları**'na kendi anahtarınızı girin (anahtar yoksa o altlık listede kapalı görünür,
  yüklenemezse uyarı verir).
- **Obje alma**: Harita › **DİREK / TRAFO / DİĞER** › tür, tip, durum (Yeni, Mevcut, DMM, Demontaj, İleride) ›
  **ALIM**. Direk tipi adları AutoCAD'e eski programın yazımıyla gider (ör. `GD-10 (3 AWG)` → `G-D-10 (sw)`, `9.3/8` → `9,3/8`).
- **Durumlar**: Yeni → M (poz temini yüklenici ise M+M), Mevcut → MEVCUT, Demontaj → DM, DMM → DM+M.
  Objenin ekranında hakediş kodu ayrıca seçilebilir: **KM** (kurum malzemesi, yüklenici montajı), **ENH**
  (kilometrik bedelli iş), **ME** (mutabakat eksiği); demontajda **KESİK / SÖKÜK**. AutoCAD'den gelen kod korunur.
  **"İleride" durumundaki objeler AutoCAD dosyasına yazılmaz.**
- **Hat**: başlangıç ve bitiş direğine dokunun; iletken / kablo tipini seçin. Yeraltında kaplama (toprak, tüvenan,
  asfalt, beton, parke) ve yöntem (açık kazı, borulu geçiş, yatay sondaj) AutoCAD'de kanal / sondaj nesnesi olur.
- **Malzeme**: objeye dokunun › **Malzeme ekle** (katalogdan). AutoCAD'den gelen malzemeler aynen korunur.
- **Teknik hesaplar**: objenin ekranında **Hesaplar** düğmesi (direk, trafo, hat) ya da **Hesaplar › Teknik
  hesaplar**. Ayrıntı Bölüm 5.
- **Dışa Aktar**: "AutoCAD proje dosyası" varsayılan seçilidir; "Telefon proje dosyası" tam yedektir.
- **AutoCAD dosyasını bu projeye al** (Proje merkezi): AutoCAD'de yapılan değişiklikleri açık projeye alır;
  aynı nesneler güncellenir, yenileri eklenir.
- **Hat parçaları**: AutoCAD'de hat her direkte / SDK'da biter (parça parça). Telefonda bunlar tek hat olarak görünür;
  geri gönderince parçalar ve numaraları aynen döner.
- **AutoCAD onayları**: Hakediş ekranında görünür (Kontrol / Hakediş / GIS). AutoCAD'de onaylı hakedişe
  dokunan değişiklikler orada aktarılmaz.

---

## 4. AutoCAD'de çalışma

İki şerit sekmesi vardır. Çizilen her şey eski hakediş programının biçimindedir (aynı katmanlar ve bilgiler);
o programın çizimleriyle karışık kullanılabilir, raporda aynı okunur, o programda da açılır.

- **ŞEBEKE-M** (çizim): Kategori, Elemanlar, Ayarlar, Malzeme, Düzenle.
- **ŞEBEKE-M ARAÇLAR**: Hakediş, Raporlar, Telefon, **Teknik Hesaplamalar**, **Proje ve Yerleşim**.

İkisinin başında **Şebeke-M** paneli (logo, **Hakkında**: sürüm, ortam ve komut listesi).

### Çizim sekmesi (soldan sağa)

Şeridin zemin rengi AutoCAD'in temasından gelir; tasarım koyu temaya göredir (AutoCAD › Seçenekler › Görüntü ›
Renk teması: **Koyu**). Simgeler açık temada da okunur.

1. **Kategori**: AG Havai, AG Yeraltı, OG Havai / ENH, OG Yeraltı, Müşterek, Aydınlatma, Trafo, Abone, Kazı, Proje
   düğmeleri (sütunlar: havai · yeraltı · diğer · proje). Birine tıklayın; seçili olan renkli görünür ve yanındaki
   **Elemanlar** bölümünde **yalnız o kategorinin öğeleri** çıkar:

   | Kategori | Öğeler |
   | --- | --- |
   | AG Havai | AG Direk, AG Hat, Kofre, Abone Hattı |
   | AG Yeraltı | Box / SDK, Pano, AG Kablo, AG Ek Mufu, Kablo Kanalı, Yatay Sondaj |
   | OG Havai / ENH | ENH / OG Direk, OG Hat, Trafo Direği |
   | OG Yeraltı | OG Kablo, OG Ek Mufu, Köşk / Bina TR, Kablo Kanalı, Yatay Sondaj |
   | Müşterek | Müşterek Direk, Müşterek Hat, AG Hat, OG Hat |
   | Aydınlatma | Aydınlatma Direği, Aydınlatma Hattı, Armatür |
   | Trafo | Trafo Direği, Köşk / Bina TR, Pano |
   | Abone | Abone Hattı, Kofre |
   | Kazı | Kablo Kanalı, Yatay Sondaj |
   | Proje | Bölge, Nokta Al, Telefondan Al, Telefona Gönder |

2. **Elemanlar**: öğeye tıklayın, **pencere açılmadan** çizim başlar (ör. AG Direk → her tıklamada bir direk;
   AG Hat → direkten direğe tıklayın, Enter). Etkin öğe yeşil kare içinde görünür.
3. **Ayarlar**:
   - **Cins**: önce cinsi seçin (ör. AG direkte *Beton*, *Ağaç*, *Demir*; AG hatta *Çıplak*, *ALPEK*). **Tip**
     listesi yalnız o cinsin tiplerini katalog sırasıyla gösterir (ALPEK'ler bir arada, araya çıplak iletken girmez).
   - **Ara**: yazıp Enter'a basın (ör. `k2`, `beton 9,3`, `alpek 50`); öğenin bütün tipleri arasında arar, bulunanlar
     Tip listesine gelir, ilki seçilir (cinsi de seçilir). Boş Enter kısa listeye döner.
   - **Durum** (M, M+M, KM, DM, DM+M, MEVCUT): her durumun yanında çizilecek simge görünür. **Hakediş** ("Aktif
     hakediş" ya da bir numara); **DM türü** (KESİK / SÖKÜK) yalnız DM ve DM+M seçiliyken görünür.
   - **Adet** ve **2. iletken** yalnız hat öğelerinde görünür: aynı hatta 3 adet ALPEK, ya da OG + AG (bkz. aşağıda).
   - Altındaki satır **sıradaki tıklamada ne çizileceğini** gösterir: `AG Direk · 9,3/3 · M · 2. hakediş · +3 malzeme`.
   - **Ayrıntılı…**: aynı öğeyi pencereyle çizer (bütün tipler, GIS numarasını elle verme vb.).
   Seçimler hatırlanır (AutoCAD yeniden açılınca da).
4. **Malzeme** bölümü: **Malzeme** (seçilen nesnenin malzemeleri), **Toplu Malzeme** (seçilen direklerin hepsine
   birden malzeme ekler) ve **Malzeme Hafızası** (açık / kapalı; bkz. aşağıda).
5. **Düzenle**: Metraj, Telefon Görünümü, Çizim Ayarları.

Çizerken: **Geri** son nesneyi kaldırır, **Ayarlar** seçimleri değiştirir, **Enter** bitirir. GIS numarası
kendiliğinden artar. Her komut AutoCAD'in **U** (Geri Al) komutuyla tek seferde geri alınır.

### Araçlar sekmesi

| Panel | Düğmeler |
| --- | --- |
| Hakediş | Aktif Hakediş, Hakediş Onayı |
| Raporlar | Durum Tespit, Dosyadan Rapor, Proje Özeti, Eksik Malzeme |
| Telefon | Telefondan Al, Telefona Gönder |
| CBS ve Harita | Google Earth, CBS'ye Aktar, CBS'den Al, CBS Bilgisi, Harita Altlığı |
| Teknik Hesaplamalar | Hesap Merkezi, Kayıtlı Hesaplar, **Hat ve Direk ▾** (sehim, uplift, ag–aw, Amax, iletken kopma, tepe kuvveti TEDAŞ, cer vektörü), **Elektrik ▾** (OG / AG gerilim düşümü, OG / AG kısa devre, bakır–alüminyum kesit) |
| Proje ve Yerleşim | Beton Köşk, Kanal Planı, AG Tek Hat |

### Pencereler

Bütün pencereler koyu temadadır; **Enter** birincil düğmeye (Çiz, Kaydet), **Esc** Vazgeç'e basar. Pencere
başlığından tutup taşınır.

- **Eleman koy / Hat çiz**: solda tür, ortada arama kutusu + **cins düğmeleri** (Beton, Ağaç, Demir…; yanında
  tip sayısı) + tip listesi (**Son kullanılanlar** ve **Tüm tipler**; her satırda simge, tanım, cins, ağırlık, poz
  no), sağda durum (her kodun anlamıyla), demontaj türü, hakediş ve ilk GIS numarası (boş bırakılırsa
  kendiliğinden; kutuda önerilen numara görünür). Altta "Çizilecek: …" satırı ve simgesi. **Onaylı (kilitli) bir
  hakediş** seçilirse sarı uyarı çıkar ve Çiz düğmesi kapanır.
  - Eleman penceresinde **Son malzemeleri ekle (malzeme hafızası)** kutusu: hafızada ne varsa yanında yazar.
  - Hat penceresinde **1. iletken** ve **2. iletken** yuvaları, her birinin **Adet** kutusu (1–12). 2. iletkeni
    kaldırmak için yanındaki **Boşalt**.
- **Toplu malzeme**: solda katalog (arama kutusuyla), **Ekle** ile sağdaki tabloya; tabloda miktar ve durum
  ("elemana göre" ya da bir durum), altta hakediş. **Hafızadakiler** son konan elemanın malzemelerini tabloya getirir.
  **Malzemeleri ekle** seçilen bütün direklere yazar.
- **Kablo kanalı çiz**: kanaldaki kablolar, zemin listesi, ölçüler ve **hızlı seçim** düğmeleri (40×40×80 …).
- **Yatay sondaj çiz**: tip listesi, durum, hakediş.
- **Malzemeler**: nesnenin kendi pozu en üstte (kalın, simgeli); hücreye tıklayıp durum, miktar, hakediş, DM
  durumu değişir; altta toplam ağırlık. Onaylı hakedişin satırları gri ve kilit simgelidir.
- **Eksik malzeme bul**: süzgeç değiştikçe sonuç pencerede listelenir; **Çizimde seç** ya da **Excel'e yaz**.
- **Hakediş onayı**: her hakediş için Kontrol → Hakediş → GIS işaretleri; aktif hakediş vurgulu, onaylı olan kilitli.
- **Çizim ayarları**: Genel, Tarife, Görünüm, Metraj ve **Proje** sekmeleri. Proje sekmesi: proje adı, kodu,
  hesabı yapan, unvan, firma, buz yükü bölgesi — teknik hesaplara ve raporlara buradan yazılır.
- **Telefondan al**: Yeni eklenecek / Güncellenecek / Değişmeyen kutucukları (listeleriyle) ve uyarılar (kilitli
  hakediş, telefonda silinmiş, onaylar). **Çizime aktar** ile başlar.
- **Hakkında**: logo, sürüm, AutoCAD ve .NET sürümü, komut listesi.

### Hat, kanal ve sondaj parça parça çizilir

Hat çizerken direğe, SDK'ya, aydınlatma direğine, ENH direğine, pano / trafoya **simgesinin üstüne** tıklamanız
yeter; eklenti en yakın elemanı yakalar (simge ne kadar büyükse o kadar geniş; ekran uzaktaysa da birkaç piksel
payla). **Boş yere tıklamak yalnız köşe koyar**, direk konmaz.

Hat her direkte, SDK'da ya da pano/trafoda **biter ve yeniden başlar**: iki direk arası ayrı bir nesnedir, metrajı
ve etiketi kendine aittir. Direksiz ara köşeler (kırılma noktaları) parçanın içinde kalır. Her parçanın altına
**hat bilgisi** (durum işareti ve iletken, ör. `^ 3X50/16+70 ALPEK`), üstüne **bir kez uzunluğu** yazılır: yer altında
iki SDK, havai hatta iki direk arasına tek metraj; kırılma noktalarına ayrıca yazılmaz. Yazılar hattın renginde ve
Tahoma yazı tipindedir. Kanal ve sondaj da aynıdır. Telefon bu parçaları tek hat olarak gösterir, geri gönderince
parçalar korunur.

Yakalama mesafesinin alt sınırı **Çizim Ayarları › Genel › Direğe yakalama mesafesi**'dir; **0** yakalamayı kapatır.

### İki iletken, adet ve müşterek hat

- **Adet**: aynı iletkenden birkaç tane (ör. 3 adet 3X50/16+70 ALPEK). Malzeme miktarı adet × hat boyu olur;
  etikete `3x(3X50/16+70 ALPEK)` yazılır, hattın kendi boyu (40 m) üstündeki metraj yazısındadır.
- **2. iletken**: aynı hatta ikinci bir iletken ya da kablo (ör. 3P+R yanına 1X16+25 ALPEK). Her iletken ayrı malzeme
  satırıdır; etikette `+` ile birleşir.
- **Müşterek hat**: 1. iletken OG, 2. iletken AG olarak gelir (ör. 3xSW + 4P+R). Etiket `OG / AG` biçimindedir:
  `^ 3xSW / 4P+R`. Raporda OG ve AG iletkeni ayrı satırlarda çıkar.
- Telefona gönderince her iletken telefonda ayrı devre olur (adediyle); geri gelince yine aynı satırlar yazılır.

### Malzeme hafızası ve toplu malzeme

- **Malzeme hafızası** açıkken (şeritte **Malzeme Hafızası** düğmesi basılı, simgesi yeşil) bir direğin, trafonun,
  SDK'nın… malzemelerini düzenleyince (Malzeme, Toplu Malzeme ya da armatür ekleme) o malzemeler hatırlanır ve
  **aynı tür ve tipteki** bir sonraki elemana kendiliğinden eklenir (aynı tipte yoksa aynı türdeki son elemanınki). Şeridin özet satırında `+3 malzeme` görünür.
  Kapatmak için düğmeye bir kez tıklayın. Hafıza AutoCAD kapanınca da kalır.
- Malzemenin durumu elemanla aynıysa yeni elemanın durumunu alır (ör. yeni direğe M, sök-tak direğe DM+M);
  farklı seçilmişse (ör. mevcut direğe yeni travers) olduğu gibi kalır.
- **Toplu Malzeme** (`SH_TOPLUMALZEME`): direkleri seçin (ya da önce seçip düğmeye basın), pencerede malzemeleri
  ve miktarlarını girin, **Malzemeleri ekle**. Hepsine birden eklenir; onaylı (kilitli) hakedişe eklenmez.

### Armatür

Aydınlatma kategorisinde **Armatür**'ü seçip bir **direğin üstüne** tıklayın: armatür o direğin malzemesi olur ve
**simgesi direğin hemen yanına** (sol üstüne) çizilir. Boş yere tıklarsanız ayrı bir armatür konur. **Geri** son
eklenen armatürü direkten çıkarır. **Malzeme** penceresinden bir direğe armatür kalemi eklenirse de simgesi
kendiliğinden çizilir; kalem silinince simge de kalkar. Direği AutoCAD'in komutlarıyla taşır, kopyalar ya da
silerseniz simgesi de onunla gider (Geri Al dahil). Simgeyi tek başına başka yere çekerseniz o yer direğe göre
saklanır.

### Görünüm: telefondakiyle aynı

Simgeler, renkler, çizgi tipleri ve yazılar telefondaki çizimle birebir aynıdır (`ortak/katalog/cizim-stili.json`).
Her hat türünün rengi ayrıdır; demontajdaki hat sarıdır:

| Hat | Renk | Çizgi |
| --- | --- | --- |
| OG havai | kırmızı | sürekli |
| AG havai | yeşil | sürekli |
| Abone | turuncu | kesik |
| Müşterek | mor | sürekli |
| Aydınlatma | camgöbeği | sürekli |
| ENH | eflatun | sürekli |
| AG yer altı kablo | mavi | kesik-noktalı |
| OG yer altı kablo | pembe | kesik-noktalı |
| Yatay sondaj | sarı-turuncu | noktalı |
| Kablo kanalı | gri | iki kenar çizgisi + eksen |

**Kablo kanalı** hat gibi görünmez: kanalın genişliğinde (üst genişlik; yoksa alt genişlik, o da yoksa 40 cm) iki
gri kenar çizgisiyle çizilir, ortadaki eksen çizgisi kanalın kendisidir. Kanalı seçmek için eksene ya da kenarına
tıklayın. Kanalı AutoCAD'in komutlarıyla taşır, uzatır, köşesini oynatır, kopyalar ya da silerseniz kenarları da
onunla gider. Eklentinin bütün yazıları Tahoma'dır (yazı stili `SEBEKE-M`).

Bu görünümden önce çizilmiş çizimleri bir kez **Telefon Görünümü** (`SH_GORUNUM`) ile çevirin: etiketler, metraj
yazıları, renkler, kanal kenarları ve yazı tipi yenilenir.

Beton / ağaç direk daire, demir direk kare. Her durumun simgesi ayrıdır:

| Durum | Simge |
| --- | --- |
| Yeni (M, M+M, KM) | dolu |
| Mevcut | boş |
| Sök-tak (DM+M) | yarım dolu |
| Demontaj (DM) | boş + simgeden taşan tek çizgi `/` |
| Demontaj, KESİK | boş + iki paralel çizgi `//` |
| Demontaj, SÖKÜK | boş + çarpı `X` |

Demontaj simgeleri sarı çizilir. Simgeler metre cinsindendir, 1 ölçekle konur. Eski bir çizimi bu görünüme çevirmek
için **Telefon Görünümü** (`SH_GORUNUM`); değişmeyen eski bloklara dokunulmaz. Eski programın simgeleri istenirse
**Çizim Ayarları › Görünüm**.

### Malzeme adlarının yazımı

Katalogdaki adlar eski listeden geldiği gibi karışık yazılmıştır ("3x50/16 Xlpe Alm.", "1X16+25 ALPEK", "36KV 630A").
Çizimdeki hat etiketlerinde, pencerelerde, şeritte ve telefonda (listeler, DXF) tek düzende görünür: kelimeler
BÜYÜK harf; birimler standart (kV, kVA, kA, mm, cm, m) ve sayıdan ayrı; kablo kodları NYY, XLPE; metaller Cu, Al;
boyut çarpısı küçük x; yaygın kısaltmalar açık (HERMETİK, GENLEŞME TANKLI, ARMATÜR, KABLO BAŞLIĞI...).
Örnek: "3x50/16 Xlpe Alm." → "3x50/16 XLPE Al", "17,5 kV 25 kVA Herm." → "17,5 kV 25 kVA HERMETİK".
Yalnız görünen yazı değişir: çizimdeki veri, Durum Tespit ve Excel raporları ile eski programla eşleşme aynı kalır.
Eski çizimlerin hat etiketleri **Telefon Görünümü** (`SH_GORUNUM`) ile yenilenir.

### Diğer düğmeler

| Düğme | Komut | Ne yapar |
| --- | --- | --- |
| Malzeme | `SH_MALZEME` | Direği, hattı, kanalı ya da sondajı seçin: malzemeleri tablo hâlinde düzenleyin, katalogdan ekleyin (2 934 kalemlik katalog). Hatta iletken eklerseniz hattın ikinci iletkeni olur (metrajı hattın boyu). |
| Toplu Malzeme | `SH_TOPLUMALZEME` | Seçilen bütün direklere (trafo, SDK…) aynı malzemeleri birden ekler. |
| Malzeme Hafızası | — | Açıkken son elemanın malzemeleri aynı tipteki yeni elemana kendiliğinden eklenir; tıklayınca kapanır / açılır. |
| Metraj | `SH_METRAJ` | Seçilen hat / kanal / sondajın metrajını çizim uzunluğundan yeniden hesaplar (önce listeyi gösterip sorar). |
| Telefon Görünümü | `SH_GORUNUM` | Çizimi telefon görünümüne çevirir (simge, renk, etiket, metraj yazıları, kanal kenarları, Tahoma yazı tipi). |
| Aktif Hakediş | `SH_HAKEDIS` | Aktif hakediş: yeni çizilenler bu hakedişin katmanlarına (`SC_3.HAK.…`) konur. Eski programın aktif hakedişiyle ortaktır. |
| Hakediş Onayı | `SH_ONAY` | Her hakediş için sırayla **Kontrol → Hakediş → GIS** onayı (eski programın onay kaydı; o program aynı işaretleri görür). **Hakediş onayı verilen hakediş kilitlenir**: o hakedişe yeni nesne çizilemez, malzeme satırları gri görünür ve değiştirilemez / silinemez, metraj güncellemesi o nesneleri atlar, telefondan gelen değişiklik o hakedişe dokunuyorsa aktarılmaz. Kilitli direğe açık hakedişte yeni malzeme eklemek serbesttir. |
| Çizim Ayarları | `SH_AYARLAR` | Katman / GIS ön eki, koordinat dilimi, **tarife (şehir / köy-bakım ve karakteristik)**, sembol takımı, etiket yüksekliği, direğe yakalama mesafesi, metraj yuvarlama ve ek paylar, kanal varsayılanları, **proje bilgileri** (ad, kod, hesabı yapan, unvan, firma, buz bölgesi). Çizimin içinde saklanır. |
| Bölge | `SH_BOLGE` | Alt proje sınırı: köşeleri gösterin ya da **Nesne** deyip var olan kapalı çizgiyi seçin; ad, proje kodu ve **grup kodu**. Eski programın bölge listesine de kaydedilir. |
| Nokta Al | `SH_NOKTAAL` | Ölçü noktalarını dosyadan alır (telefonun "Noktalar (CSV)" çıktısı ya da Ad, Y, X, Z, Kod dosyası). |
| Telefondan Al | `SH_PROJEAL` | Bölüm 2. Üç dosya türü açılır: `.sebeke.json`, `.volt.json`, teslim paketi `.zip`. Teknik hesap kayıtları da alınır. |
| Telefona Gönder | `SH_ICEAL` | Bölüm 2. `.sebeke.json` (varsayılan) ya da `.volt.json` olarak kaydeder (onaylar ve hesap kayıtları da gider). |
| Durum Tespit | `SH_RAPOR` | Bu çizimden Excel rapor (eski programın sayfaları; ayrıca **DETAY** sayfası: her elemanın ara malzemeleri satır satır; **HESAPLAR** sayfası: teknik hesap sonuçları ve güncellikleri). |
| Dosyadan Rapor | `SH_PROJERAPOR` | Bir proje dosyasından Excel rapor (çizim açmadan; telefon dosyaları da olur). |
| Proje Özeti | `SH_OZET` | Pencere: solda projeler (bölgeler), sağda seçilen projenin malzeme listesi (hakediş, durum ve aramayla süzülür). **Excel'e aktar** proje listesini ve görünen malzeme listesini yazar; "Tüm projeler" seçiliyse her projenin listesi de ayrı sayfada. |
| Eksik Malzeme | `SH_DETAY` | Eski programdaki DETAY sorgusu: ör. "topraklaması **olmayan** AG direkleri". Hangi elemanlarda (ana cins, tip, durum, bölge) hangi ara malzemenin (cins, tip, durum, hakediş) aranacağını seçin; **olmayanlar / olanlar / hepsi**. Sonuç pencerede listelenir; **Çizimde seç** bulunan elemanları seçer, **Excel'e yaz** ayrıca DETAY dosyasını yazar. |
| Google Earth | `SH_KML` | Aşağıda: CBS ve harita. |
| CBS'ye Aktar / CBS'den Al / CBS Bilgisi | `SH_MIFVER` / `SH_MIFAL` / `SH_CBSBILGI` | Aşağıda: CBS ve harita. |
| Harita Altlığı | `SH_ALTLIK` | Aşağıda: CBS ve harita. |
| Hesap Merkezi | `SH_HESAP merkez` | Bölüm 5. Seçili nesne için uygun hesapların listesi ve kayıtlı sonuçları. |
| Kayıtlı Hesaplar | `SH_HESAPLAR` | Bölüm 5. Çizimdeki bütün hesap kayıtları. |
| Hat ve Direk ▾, Elektrik ▾, Beton Köşk, Kanal Planı, AG Tek Hat | `SH_HESAP <hesap>` | Bölüm 5. Seçili nesne için o hesabı açar. |

### CBS ve harita

Bu düğmeler çizimin gerçek koordinatını kullanır: **ITRF96, 3° TM**. Çizimin dilimi (dilim orta meridyeni:
27, 30, 33, 36, 39, 42, 45) **Çizim Ayarları**'nda yoksa ilk kullanımda bir kez sorulur ve çizime kaydedilir
(Elazığ, Malatya, Erzincan: 39°). Çizim yerel / kaydırılmış koordinatla çizilmişse uyarılırsınız.

- **Google Earth** (`SH_KML`): çizimi `.kmz` (ya da `.kml`) olarak kaydeder. Her proje (bölge) bir klasördür:
  proje sınırı, elemanlar, hatlar, kanallar, sondajlar; GPS noktaları ayrı klasörde (kapalı gelir). Renkler
  telefon ekranındakiyle aynıdır; demontajlar yarı saydamdır. Bir nesneye tıklayınca GIS no, tip, durum, hakediş,
  proje, metraj ve malzemeleri görünür.
- **CBS'ye Aktar** (`SH_MIFVER`): MapInfo **MIF / MID** dosyaları. Verdiğiniz ada her nesne türü için ek gelir:
  `ad_ELEMAN`, `ad_HAT`, `ad_KANAL`, `ad_SONDAJ`, `ad_BOLGE` (proje sınırı), `ad_NOKTA` (GPS noktası); her biri
  `.mif` + `.mid`. Koordinatlar çizim koordinatıdır (dosyada dilim yazılıdır), harfler Türkçe Windows kod sayfasıdır.
  Sütunlar: `KIMLIK`, `GIS_NO`, `TUR` / `TUR_ADI`, `CINS`, `TIP`, `DURUM`, `DM_DURUM`, `HAKEDIS`, `PROJE`,
  `PROJE_KODU`, `MALZEME`, `SAGA`, `YUKARI`, `KOT`, `ACI` (eleman); hatta `KESIT`, `ETIKET`, `UZUNLUK`, `METRAJ`;
  kanalda `KABLOLAR`, `ZEMIN`, `ALT_CM`, `UST_CM`, `DERIN_CM`, `BAS_NO`, `BIT_NO`.
- **CBS'den Al** (`SH_MIFAL`): bir ya da birkaç `.mif` dosyası seçin (yanında aynı adlı `.mid`). Noktalar küçük
  daire (adı / numarası yanında), çizgiler ve alanlar çoklu çizgi, yazılar yazı olarak **altlık** çizilir; her dosya
  kendi katmanındadır (`CBS-dosya adı`). TM (başka dilim, UTM), enlem-boylam ve düz koordinat çizimin dilimine
  çevrilir. Datum ITRF96 / WGS84 değilse (ör. ED50) uyarılırsınız (birkaç metre kayabilir). Bu nesneler hakediş
  nesnesi değildir: rapora ve telefona girmez.
- **CBS Bilgisi** (`SH_CBSBILGI`): CBS'den alınan nesneyi seçin; dosyadaki bütün bilgileri (MID satırı) gösterir.
- **Harita Altlığı** (`SH_ALTLIK`): uydu görüntüsü ya da harita, çizime oturtulmuş resim olarak **ALTLIK** katmanına,
  nesnelerin altına konur; altına kaynağın atıf yazısı yazılır. Resim çizimin yanındaki `Altlik` klasörüne kaydedilir.
  - Anahtarsız: **Esri uydu**, **OpenStreetMap** (yalnız küçük alanlar; toplu indirme yasak).
  - Kendi anahtarınızla: **Google** (uydu, uydu + yol adları, harita; Map Tiles API), **Bing** (yalnız kurumsal
    anahtar: ücretsiz anahtarlar kapatıldı, kurumsal anahtarlar 30.06.2028'e kadar), **Azure Maps** (Bing'in yerine),
    **Esri (ArcGIS anahtarı)**, **Yandex**, **MapTiler**; ya da kurumunuzun **özel karo sunucusu** (`{z}/{x}/{y}`).
  - Anahtar yalnız bu bilgisayarda saklanır (`%APPDATA%\SebekeHakedis\altlik.json`); çizime ve proje dosyalarına yazılmaz.
  - Alan: şebekenin bulunduğu alan, ekranda görünen alan ya da pencereyle seçilen alan. Ayrıntı: düşük (≈1 m),
    normal (≈0,5 m), yüksek (≈0,25 m); alan büyükse ayrıntı kendiliğinden düşer (resim en çok 4096 piksel).
  - Her sağlayıcının kullanım koşulları geçerlidir (pencerede bağlantısı var); bazıları görüntünün kalıcı
    saklanmasını kısıtlar.

### Eski programla ortak kayıtlar

Eklenti eski hakediş programının çizimde tuttuğu kayıtları da okur ve yazar; böylece aynı çizimde iki program sırayla kullanılabilir:

- **Kalem sırası (INDEX)**: yeni kalemlerin sıra numarası eski programın sayacıyla devam eder, sayaç ilerletilir.
  Telefondan dönen kalemler numaralarını korur.
- **Aktif hakediş**: eski programda seçilen hakediş eklentide de aktif olur; eklentide seçilen oraya yazılır.
- **Bölgeler**: eklentinin çizdiği ve telefondan gelen bölgeler eski programın bölge listesine eklenir (raporunda görünür).
- **Pano çıkış şeması ve trafo hücreleri**: eski programda girilen bilgiler eklentide ve telefonda korunur, aynen geri yazılır.
- **KONTROL (denetlendi) işareti**: korunur; denetlenmiş nesnenin malzemeleri açılırken sorulur.
- **Hakediş onayları**: bkz. Hakediş Onayı.

İpuçları:

- Pencerelerde liste üstündeki kutuya yazarak arayın (ör. `k2`, `alpek 50`). Çift tıklama seçer.
- Çizim komutları son seçimlerinizi hatırlar.

---

## 5. Teknik hesaplar (Hesap Merkezi)

Hesap araçları Elektrik-Elektronik Mühendisi **Baki SONAY**'ın hazırladığı hesap sayfalarıdır; formülleri ve
tabloları değiştirilmeden Şebeke-M'e eklenmiştir. Telefonda ve AutoCAD'de **aynı sayfalar** açılır; aradaki tek
fark, bilgilerin nereden geldiğidir (telefonda projeden, AutoCAD'de çizimden).

| Grup | Hesaplar |
| --- | --- |
| Hat ve direk | ENH Sehim, Uplift (kaldırma) kontrolü, ag–aw bağıntısı, Amax, İletken kopma (iki misli buz yükü), Direk tepe kuvveti (TEDAŞ), Direk tepe kuvveti (cer vektörü) |
| Elektrik | OG gerilim düşümü ve güç kaybı, AG gerilim düşümü ve güç kaybı, OG kısa devre, AG kısa devre, Bakır ⇄ alüminyum kablo kesiti |
| Proje ve yerleşim | Beton köşk yerleşim planı, Kanal planı, AG tek hat şeması (AG kısa devre hesabının içindeki şema) |

### Nasıl açılır?

- **Telefon**: bir direğin, trafonun ya da hattın ekranında **Hesaplar** düğmesi; haritada objenin balonunda
  **Teknik hesaplar**; ya da **Hesaplar › Teknik hesaplar** (proje geneli). Listede yalnız o nesneye **uygun**
  hesaplar üstte gelir; uygun olmayanlar nedeniyle birlikte altta katlanmış durur.
- **AutoCAD**: nesneyi seçip (ya da düğmeden sonra seçerek) **ŞEBEKE-M ARAÇLAR › Teknik Hesaplamalar**:
  - **Hesap Merkezi**: seçilen nesne için uygun hesaplar ve o nesnenin kayıtlı sonuçları. Nesne seçmeden **Enter**:
    çizimin tamamı.
  - **Hat ve Direk ▾ / Elektrik ▾**: hesabı doğrudan seçin. Trafo seçildiyse hangi **çıkışın (kolun)** hesaplanacağı
    komut satırında sorulur.
  - **Kayıtlı Hesaplar**: çizimdeki bütün kayıtlar.
  - Komut satırından: `SH_HESAP` (hesap kimliği sorar; `merkez` ya da ör. `enh-sehim`), `SH_HESAPLAR`.
  Sayfa bilgisayarın tarayıcısında açılır (Edge varsa uygulama penceresi, yoksa varsayılan tarayıcı, ör. Chrome);
  AutoCAD açık kaldığı sürece çizimle konuşur.

### Sayfada ne olur?

- Üst çubuk: hesabın adı, **hedef** (ör. `Direk SC104`), durum (`19 bilgi projeden · 2 eksik`), **Kaydet**, **ⓘ**.
  Soldaki **‹** telefonda sayfayı kapatır; AutoCAD'de sayfa Hesap Merkezi'nden açıldıysa merkeze döndürür
  (kaydedilmemiş değişiklik varsa sorar). Kayıtlı bir hesapta değişiklik yapınca durum çipi
  **değişiklik kaydedilmedi** diye uyarır.
- Nesnenin bilgileri (tip, açıklıklar, iletken, kot, trafo gücü, kablolar…) hesabın alanlarına **kendiliğinden
  yazılır**. Projede olmayan bilgiler **turuncu çerçeveyle** işaretlenir ve elle girilir; tahminle doldurulmaz.
- **ⓘ** paneli: nereden hangi bilgi geldi, neler eksik ("Alana git" ile atlar), uyarılar ve **Hesap hakkında**
  (aracın bilinen sınırları, doğrulanması gereken tablo değerleri, kaynak).
- **Kaydet**: sonuç (özet, uygun / uygun değil / bilgi, girdiler, değerler, uyarılar) ve hesabın tam durumu projeye
  yazılır. AutoCAD'de kayıt çizimin içindedir: **çizimi kaydetmeyi unutmayın** (Geri Al ile geri alınır).
- **Yeniden açma**: kayıtlı sonuca dokununca hesap kaydedildiği hâliyle açılır. Proje o arada değiştiyse üst çubukta
  **GÜNCEL DEĞİL** yazar; ⓘ panelinde hangi bilgiler değişti görünür, **Güncel bilgileri hesaba aktar** ile yeni
  değerler yazılır, kontrol edip yeniden kaydedersiniz. Hedef nesne silinmişse **HEDEF YOK**.
- Yazdırma ve dosya (PDF, DXF, CSV) aracın kendi düğmeleriyle yapılır; telefonda uygulamanın yazdırma ekranına ve
  proje klasörüne (`HESAPLAR`) gider.

### Kayıtlar nereye gider?

- Telefonda proje belgelerinde, AutoCAD'de çizimin içinde durur; proje dosyasıyla (`hesaplar`) iki yöne de taşınır.
  Aynı kayıt iki tarafta da varsa **daha yeni** olan kazanır.
- **Durum Tespit** raporunun **HESAPLAR** sayfasında ve telefonun raporunda (**11. Teknik hesaplar**) listelenir:
  hesap, hedef, sonuç, durum, güncellik, girdiler, değerler, uyarılar, tarih, kaynak, yapan.

### Dikkat

- Hesaplar kullanıcının sorumluluğundadır: araç bir kararı (uygun / uygun değil) ancak **bütün girdiler
  tamamsa** verir; eksik bilgiyle sonuç **BİLGİ** olarak kaydedilir.
- Her hesabın ⓘ panelindeki **Hesap hakkında** bölümünde, aracın tablolarında saptanan ve aracın sahibiyle
  doğrulanması gereken değerler yazılıdır (ör. bazı iletken satırları, köşk koridor kontrolü). Bunlar
  değiştirilmemiştir.
- AutoCAD'de hat, parçalardan direkten direğe zincirlenir; bir direkte kol ayrılıyorsa hattın **düz devamı** seçilir
  (sapması 40°'den küçük olan). Hesabın üst çubuğundaki hat adı (`SCTR01–SC111`) hangi zincirin alındığını
  gösterir.

---

## 6. Sık karşılaşılanlar

- **Telefonda konum haritaya oturmuyor**: projenin 3° dilimi yanlış. Proje bilgilerinden düzeltin.
- **AutoCAD'de "dilim uyuşmuyor" uyarısı**: telefondaki projenin dilimi ile çizim ayarındaki dilim farklı.
  Koordinatlar kayar; doğru dilimi `SH_AYARLAR`'dan girin.
- **"Bu proje bu çizimden alınmamış görünüyor"**: telefondaki proje başka bir çizimden gelmiş. Devam
  ederseniz telefondaki nesneler yeni olarak eklenir; var olanlar değişmez.
- **"Telefonun proje dosyasında AutoCAD bölümü yok"**: dosya eski telefon sürümüyle yazılmış. Telefonu güncelleyip
  **Dışa Aktar › AutoCAD proje dosyası** ile yeniden alın.
- **Telefonda "katalogda yok" uyarıları**: AutoCAD'den gelen bir direk tipi ya da malzeme telefon kataloğunda
  bulunamadı. Kayıt yine de gelir; Ayarlar › Poz Kataloğu'nda "AutoCAD" kategorisinde görünür, ad / poz no düzeltilebilir.
- **"… hakediş onaylı (kilitli)" uyarısı**: o hakediş onaylanmış. Yeni çizim için şeritteki **Hakediş** kutusundan
  ya da **Hakediş** düğmesinden açık bir hakediş seçin; kilidi kaldırmak gerekiyorsa **Hakediş Onayı**'ndan
  "Hakediş" işaretini kaldırın.
- **Telefondan alırken "onaylı hakedişe dokunduğu için aktarılmayacak"**: telefonda, AutoCAD'de onaylanmış bir
  hakedişin nesnesi değişmiş. Değişiklik gerçekten gerekiyorsa önce onayı kaldırın, sonra yeniden alın.
- **Hesap sayfası "AutoCAD ile bağlantı yok" diyor**: AutoCAD kapatılmış ya da sayfa AutoCAD yeniden başladıktan
  sonra açık kalmış. Hesabı AutoCAD'den yeniden açın.
- **Hesap sayfasında Kaydet "AutoCAD'de komut çalışıyor" diyor**: AutoCAD'de süren komutu bitirin (Esc), yeniden
  Kaydet'e basın.
- **Hesap sayfası tarayıcıda açılmadı**: Edge yoksa varsayılan tarayıcı kullanılır; yine açılmadıysa komut satırındaki
  adres kopyalanıp tarayıcıya yapıştırılabilir (`SH_HESAP` yazdıktan sonra görünür).
- **Eklentiyle çizilmiş bir çizim açılırken AutoCAD kapanıyor ("Unhandled Access Violation")**: eklentinin
  0.1.52 ve önceki sürümleri Telefondan Al ile çizdiği nesnelere bozuk bir veri bölümü yazıyordu; böyle kaydedilmiş
  çizim açılışta çöker, `RECOVER` ile açılır ama o nesneler gelmez. Çözüm: eklentiyi güncelleyin, boş bir çizime
  projeyi telefon dosyasından yeniden alın (`SH_PROJEAL`) ve kaydedin. Düzeltme 0.1.52'den sonraki sürümlerdedir
  (`SH_HAKKINDA` sürümü gösterir).
- **Şerit sekmesi kayboldu**: komut satırına `SH_SERIT`.
- **Bir hata oldu**: ayrıntı `%TEMP%\SebekeHakedis_hata.txt` dosyasına yazılır. Destek için `SH_DOKUM`
  çizimin teknik dökümünü kaydeder.
