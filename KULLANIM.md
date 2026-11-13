# Şebeke-M Hakediş — Kullanım Kılavuzu

İki araç var, ikisi aynı proje dosyasını (`.sebeke.json`) kullanır:

- **Telefon uygulaması Şebeke-M Hakediş** (sahada): direk, trafo, SDK, pano koyma; hat ve kanal çizme; malzeme,
  fotoğraf, not; metraj, Yeşil Defter, hakediş ve teslim paketi; teknik hesaplar. Ayrıntılı kılavuz:
  [telefon/docs/KULLANIM-KILAVUZU.md](telefon/docs/KULLANIM-KILAVUZU.md).
- **AutoCAD eklentisi Şebeke-M Hakediş** (büroda): eski hakediş programının çizimlerini okuma, Durum Tespit raporu,
  telefona gönderme, telefondan alma, çizim araçları (direk, hat, kanal, bölge, nokta alma, malzeme) ve
  **Hesap Merkezi** (teknik hesaplar).

Dosya telefon ile bilgisayar arasında **Google Drive** üzerinden taşınır. Böylece hangi bilgisayarda
çalışırsanız çalışın proje Drive'da durur.

---

## 1. Kurulum

### Telefon

1. Telefondan GitHub'a girin (depo size özeldir; kendi hesabınızla giriş yapın):
   **sebeke-hakedis** deposu › **Releases**.
2. En üstteki **"Şebeke-M Hakediş telefon uygulaması 2.5.x"** sürümünü açın, `Sebeke-M-2.5.x.apk` dosyasına dokunun.
3. İndirme bitince dosyayı açın. Telefon "bilinmeyen kaynak" uyarısı verirse **Ayarlar › Bu kaynağa izin ver**.
4. **Yükle**. Uygulama "Şebeke-M Hakediş" adıyla görünür.

Telefonda önceki sürüm (2.1.0 ve sonrası, eski adıyla) kuruluysa **silmeyin**: yeni sürüm üzerine kurulur,
projeleriniz silinmez.

### AutoCAD (2016–2024 ve 2025 ve sonrası)

1. Bilgisayarda GitHub › **Releases** › en üstteki **"Şebeke-M Hakediş AutoCAD eklentisi 0.1.x"** › `SebekeHakedis-0.1.x.zip` indirin.
2. Zip'e sağ tıklayın › **Tümünü ayıkla**.
3. AutoCAD açıksa kapatın. Ayıklanan klasördeki **KUR.bat** dosyasına çift tıklayın.
   Windows "bilgisayarınız korundu" derse: **Ek bilgi › Yine de çalıştır**.
4. Windows **yönetici izni** sorar: **Evet** deyin. Eklenti AutoCAD'in güvenilir saydığı klasöre
   (`C:\Program Files\Autodesk\ApplicationPlugins`) kurulur; AutoCAD orada imza aramaz, **güvenlik uyarısı çıkmaz**.
5. AutoCAD'i açın. Şeritte **ŞEBEKE-M** ve **ŞEBEKE-M ARAÇLAR** sekmeleri görünür.

Yönetici izni veremiyorsanız (ör. kurum bilgisayarı) **Hayır** deyin: eklenti yine kurulur ama kendi kullanıcı
klasörünüze; o zaman AutoCAD ilk açılışta "imzalanmamış dosya" uyarısı gösterir, **Her zaman yükle** deyin.

Güncellemek için yeni zip ile aynı adımları tekrarlayın. Kaldırmak için **KALDIR.bat**. Sürüm ve komut listesi:
her iki sekmenin başındaki **Şebeke-M Hakediş › Hakkında** düğmesi (`SH_HAKKINDA`).

---

## 2. Genel iş akışı

### A. Elinizde eski programla yapılmış bir çizim varsa

1. **AutoCAD**: çizimi açın › **ŞEBEKE-M ARAÇLAR › Telefon › Telefona Gönder**.
   Dosyayı Google Drive klasörünüze kaydedin (ör. `Google Drive\Şebeke-M Hakediş\`).
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
- **Hat**: başlangıç ve bitiş direğine dokunun; iletken / kablo tipini seçin. Yeraltında kanalın **cinsi** (toprak,
  tüvenan, mıcır, branşman kanalı, kablo demontaj kanalı), **kaplaması** (kaplamasız, parke, asfalt, beton),
  **bariyerli** / **trencher** ve yöntem (açık kazı, borulu geçiş, yatay sondaj) ayrı seçilir; AutoCAD'de kanal /
  sondaj nesnesi olur, kanalın kalem adı eklentidekiyle aynıdır (ör. `PARKE TUVENAN (BARİYERLİ)`).
- **Kanal listesi**: Proje merkezi › **Kanal listesi (proje bazında)**: her projenin kanalları (baş – bit, kablolar,
  cins, kaplama, ölçü, uzunluk, hacim, durum, hakediş) ve toplamları. Excel: Dışa Aktar › Excel dosyasında
  **Kanal Listesi** ve **Kanal Özeti** sayfaları.
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

İkisinin başında **Şebeke-M Hakediş** paneli (logo, **Hakkında**: sürüm, amaç ve yapabildikler, komut listesi).

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
   - **Kablo kanalında** Cins kanalın zeminidir (*Toprak*, *Tüvenan*, *Mıcır*, *Branşman kanalı*, *Kablo demontaj
     kanalı*); Tip'in yerinde **Kaplama** listesi çıkar (*Kaplamasız*, *Parke*, *Asfalt*, *Beton*; her birinin
     *bariyerli* olanı ve *Trencher* ile kazılanı). Seçimden kanalın kalem adı kurulur (ör. Tüvenan + Parke +
     bariyerli → `PARKE TUVENAN (BARİYERLİ)`). Eski programın listesinde olmayan birleşim de seçilebilir (ör. Toprak +
     Asfalt → `TOPRAK (ASFALT KAPLAMALI)`); ipucunda "listesinde yok" yazar, raporlara bu adla geçer.
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
5. **Düzenle**: Hat Değiştir, Metraj, Telefon Görünümü, Çizim Ayarları.

Çizerken: **Geri** son nesneyi kaldırır, **Ayarlar** seçimleri değiştirir, **Enter** bitirir. GIS numarası
kendiliğinden artar. Her komut AutoCAD'in **U** (Geri Al) komutuyla tek seferde geri alınır.

### Araçlar sekmesi

| Panel | Düğmeler |
| --- | --- |
| Hakediş | Aktif Hakediş, Hakediş Onayı |
| Raporlar | Durum Tespit, Dosyadan Rapor, Proje Özeti, Kanal Listesi, Çizim Onar, Eksik Malzeme |
| Telefon | Telefondan Al, Telefona Gönder |
| CBS ve Harita | Google Earth, CBS'ye Aktar, CBS'den Al, CBS Bilgisi, Harita Altlığı |
| Teknik Hesaplamalar | Hesap Merkezi, Kayıtlı Hesaplar, Cer Vektörü (direk tepe kuvveti), Kanal Planı |

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
- **Kablo kanalı çiz**: kanaldaki kablolar, **kanal cinsi (zemin)** ve **kaplama** ayrı ayrı (+ Bariyerli, Trencher;
  altında kalem adı), ölçüler ve **hızlı seçim** düğmeleri (40×40×80 …). Aynı seçici kanalın **Malzemeler**
  penceresinde ve **Çizim Ayarları › Metraj**'daki kanal varsayılanında da vardır.
- **Yatay sondaj çiz**: tip listesi, durum, hakediş.
- **Malzemeler**: nesnenin kendi pozu en üstte (kalın, simgeli); hücreye tıklayıp durum, miktar, hakediş, DM
  durumu değişir; altta toplam ağırlık. Onaylı hakedişin satırları gri ve kilit simgelidir.
- **Eksik malzeme bul**: süzgeç değiştikçe sonuç pencerede listelenir; **Çizimde seç** ya da **Excel'e yaz**.
- **Hakediş onayı**: her hakediş için Kontrol → Hakediş → GIS işaretleri; aktif hakediş vurgulu, onaylı olan kilitli.
- **Çizim ayarları**: Genel, Tarife, Görünüm, Metraj ve **Proje** sekmeleri. Proje sekmesi: proje adı, kodu,
  hesabı yapan, unvan, firma, buz yükü bölgesi — teknik hesaplara ve raporlara buradan yazılır.
- **Telefondan al**: Yeni eklenecek / Güncellenecek / Değişmeyen kutucukları (listeleriyle) ve uyarılar (kilitli
  hakediş, telefonda silinmiş, onaylar). **Çizime aktar** ile başlar.
- **Hakkında**: logo, sürüm, AutoCAD ve .NET sürümü; **Hakkında** sekmesinde Şebeke-M Hakediş'in amacı ve neler yapabildiği (telefonun Ayarlar › Hakkında ekranıyla aynı metin), **Komutlar** sekmesinde komut listesi.

### Hat, kanal ve sondaj parça parça çizilir

Hat çizerken direğe, SDK'ya, aydınlatma direğine, ENH direğine, pano / trafoya **simgesinin üstüne** tıklamanız
yeter; eklenti en yakın elemanı yakalar (simge ne kadar büyükse o kadar geniş; ekran uzaktaysa da birkaç piksel
payla). **Boş yere tıklamak yalnız köşe koyar**, direk konmaz.

Hat her direkte, SDK'da ya da pano/trafoda **biter ve yeniden başlar**: iki direk arası ayrı bir nesnedir, metrajı
ve etiketi kendine aittir. Direksiz ara köşeler (kırılma noktaları) parçanın içinde kalır. Her parçanın altına
**hat bilgisi** (durum işareti ve iletken, ör. `^ 3X50/16+70 ALPEK`), üstüne **bir kez uzunluğu** yazılır: yer altında
iki SDK, havai hatta iki direk arasına tek metraj; kırılma noktalarına ayrıca yazılmaz. "Alt" ve "üst" çizginin
kendi yönüne göredir: dik ya da eğik hatta da uzunluk çizginin bir yanında, hat bilgisi öbür yanında durur, yazılar
çizginin üstüne binmez. Yazılar hattın renginde ve Tahoma yazı tipindedir. Kanal ve sondaj da aynıdır; yalnız
uzunlukları bir satır daha yukarıda, kendi renklerindedir (içlerindeki kablonun uzunluğuyla üst üste binmesin diye).
Telefon bu parçaları tek hat olarak gösterir, geri gönderince parçalar korunur.

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
saklanır. Armatür simgesi küçüktür (8.11.2026): ışınlarıyla 1,1 m — direk simgesinin yarısından küçük; eski çizimlerde
blok tanımı eklenti çizime dokununca kendiliğinden yenilenir. Katalogda **LED armatür sınıfları S1…S17**
(`S3 SINIF NUMARALI LED ARMATÜR` …) ve sodyum / cıva armatürler vardır; telefonda aynı sınıflar
`020.05.03.01-001…017` pozlarıdır.

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

**Hat yazıları** (31.10.2026): metraj ve kablo tipi yazısı parçanın **ortasına ortalı** yazılır — metraj çizginin üst
yanında, kablo tipi alt yanında (çizginin en uzun parçasında); ikisi aynı noktadan başlamaz, üst üste binmez. Kısa
parçaya sığmayan yazı önce daraltılır, yetmezse biraz küçülür. Hattı AutoCAD'in komutlarıyla **silerseniz** metraj ve
kablo tipi yazıları da silinir; taşır, uzatır, köşesini oynatır ya da kopyalarsanız yazılar yeni yerine gelir (Geri Al
dahil). Telefonun DXF'i aynı kuralla yazar.

**Simge ve yazı boyutları** (Çizim Ayarları › Görünüm): simge büyüklüğü (kat), eleman yazısı (GIS no, tip), kablo tipi
ve metraj yazısının yüksekliği (m); **Varsayılana dön** telefonla aynı ölçülere (1 kat · 1,8 · 1,8 · 1,44 m) getirir.
Yeni çizilenler hemen bu ölçülerle çizilir; kaydederken çizimdekilere de uygulanması sorulur (Telefon Görünümü).
Boyutlar "Telefona Gönder" ile telefona gider, telefonun DXF'i de bunlarla çizer; telefonda Dışa Aktarım › Çizim
boyutları'ndan da değiştirilebilir. Telefondan alırken çizimde boyut ayarlanmamışsa telefondakiler alınır.

**Hat kalınlığı** (8.11.2026; Çizim Ayarları › Görünüm): hatlar baskıda görünsün diye kalın çizilir. Kalınlık
çizginin kendisindedir, ekranda da görünür; 1/1000 baskıda kâğıtta şu kalınlıktadır:

| Seçenek | OG havai, OG kablo, müşterek, ENH | AG havai, AG kablo | Abone, aydınlatma |
| --- | --- | --- | --- |
| İnce çizgi | kalınlık yok (eski görünüm) | | |
| İnce | 0,3 mm | 0,21 mm | 0,15 mm |
| **Normal** (varsayılan) | 0,5 mm | 0,35 mm | 0,25 mm |
| Kalın | 0,75 mm | 0,52 mm | 0,38 mm |
| Çok kalın | 1 mm | 0,7 mm | 0,5 mm |

Kanal, sondaj, bölge sınırı ve simgeler ince kalır. Eski çizimdeki hatlar bir kez **Telefon Görünümü** ile kalınlaşır.

**Malzemeleri çizimde göster** (8.11.2026; Çizim Ayarları › Görünüm): her elemanın malzemeleri simgenin yanında, tip
satırının altında satır satır yazılır — `AD=MİKTAR BİRİM (DURUM)`, ör. `GT-60=1 (M)`, `L-65=2,5 mt (DM)`. Elemanın kendi
tipi (direk tipi) yazılmaz, o tip satırındadır; adet yazılmaz, metre ve kilogram yazılır; durum programdaki kodla
(M, M+M, MEVCUT, DM, DM+M…); iki hakedişte girilmiş aynı malzeme tek satırda toplanır. Yazı eleman yazısının 0,7'si
büyüklüğünde, beyaz / siyahtır. Yazı **ayrı bir nesnedir** (13.11.2026; önce simgenin öznitelikleriydi): **Taşı** ile
direğin tipinden bağımsız istediğiniz yere alırsınız (başka direklerin ve hatların üstüne gelmesin diye), yeri direğe
göre saklanır ve güncellemede korunur; direği taşır, kopyalar ya da silerseniz yazı da onunla gider. Yazının üstüne
tıklayıp Malzeme komutunu verirseniz direğin malzemeleri açılır. Malzeme eklenince ya da silinince yazı kendiliğinden
yenilenir; kapatınca yazılar silinir. Eski çizimlerdeki satır satır yazılar güncellemede (ya da Telefon Görünümü ile)
tek yazıya çevrilir, taşınmış ilk satırın yeri kalır. Telefonda Dışa Aktarım › Çizim boyutları › Malzemeleri çizimde
göster açıksa telefonun DXF'i de aynı yazıyı (tek çok satırlı yazı) yazar.

**Eleman yazıları beyaz / siyah** (13.11.2026): GIS numarası ve tip yazısı direğin renginde değil, 7 numaralı renkte
yazılır (siyah ekranda beyaz, kâğıtta siyah) — koyu yeşil / kırmızı yazılar siyah ekranda okunmuyordu. Telefonun DXF'i
zaten öyleydi. Eski çizimdeki yazılar güncellemede ya da Telefon Görünümü ile çevrilir.

**Metraj yazısı iletken metrajını gösterir** (13.11.2026): hattın üstündeki uzunluk, iletken kaleminin metrajı ÷ adet
(kanal ve sondajda kendi pozunun metrajı). Malzemeler penceresinde metrajı değiştirince yazı da değişir; iletkeni
olmayan hatta çizim uzunluğu yazılır. Hattı AutoCAD'le **taşırsanız** yazı aynı kalır; **uzatır / kısaltırsanız** yeni
çizim uzunluğu yazılır (kalemin metrajı eskimiştir: **Metraj** komutu ya da Malzemeler kaydı yeniden yazar).

**Direk tipini sonradan değiştirme** (13.11.2026): Malzemeler penceresinde **Tipi değiştir…** (ya da ilk satıra çift
tıklayın) katalogdan yeni tipi seçtirir — aynı cinsten başka tip (9,30/3 → 9,30/8) ya da başka cins (beton → demir;
simge de değişir). Durum, hakediş, DM durumu ve malzemeler kalır; tip yazısı ve raporlar yeni tiple gider. Onaylı
(kilitli) hakedişteki direğin tipi değiştirilemez.

### Hat değiştir (iletkenin tipi ve cinsi)

Çizilmiş bir hattın iletkeni sonradan değişebilir: **Hat Değiştir** (`SH_HATDEGISTIR`, şeritte Düzenle). Hatları
seçin (ya da önce seçip düğmeye basın); Hat penceresi ilk hattın şimdiki iletkeniyle açılır. Yeni iletkeni (tip, cins;
gerekirse ikinci iletken, adet), türü, durumu ve hakedişi seçip **Değiştir**. Seçilen bütün hatların iletken satırları
yenilenir; diğer malzemeleri olduğu gibi kalır. Kablo tipi yazısı, katman ve renk güncellenir. Metraj korunur; tür
değişirse (ör. havai → yer altı) yeni türün metrajı yazılır. Onaylı (kilitli) hakedişteki hatlar değişmez.

**Katman adları Türkçe karaktersizdir** (31.10.2026): `AGDIR`, `MUSDIR`, `AYDDIR`, `ENHDIR`, `MUSTEREK_HAT`; katman
öneki de (ör. `ŞÇ` → `SC`). Eski adlı (`AGDİR` …) çizimler okunur; eklenti bir katmana yazarken eski adını yenisine
çevirir, Telefon Görünümü bütün şebeke katmanlarını bir kez çevirir (sizin kendi katmanlarınıza dokunmaz).
**Cins kodlarındaki yazım hataları** da düzeltildi: `AG_ALÜMİNYUM_KABLO`, `OG_ALÜMİNYUM_KABLO`, `REKORTMAN_ALÜMİNYUM`,
`ALÜMİNYUM_BAĞ_TELİ`, `TEÇHİZAT_MONTAJ_DEMİRİ`, `KOFRE`. Eski kodlu çizim ve telefon dosyaları okunurken yeni koda
çevrilir; Telefon Görünümü kayıtları da yeni kodla yazar. Eski program bu yeni adları tanımayabilir (artık yalnız
Şebeke-M Hakediş kullanılıyor).

**Cins adları** (8.11.2026): şeritte, Malzemeler penceresinde, eksik malzeme sorgusunda ve Proje Özeti'nde cinsin kodu
değil adı görünür; ad alt çizgisiz, her sözcüğün ilk harfi büyük yazılır: `AG_DEMİR_GLV` → **AG Galvaniz Demir Direk**,
`TRAVERS_VE_KONSOLLAR_GLV` → **Galvaniz Travers ve Konsollar**, kanalın kendi satırında **Kablo Kanalı**. Kodun kendisi
hücrenin ipucunda; raporlar, Excel ve dosyalar kodu yazmaya devam eder. Katalogda adı olmayan bir kod da aynı kuralla
çevrilir (`YENİ_BİR_CİNS` → "Yeni Bir Cins").

**Simge takımı** (9.11.2026; Çizim Ayarları › Görünüm › Simge takımı): iki takım vardır, çizim başına seçilir.
Seçim proje dosyasıyla telefona gider; telefonun DXF'i aynı takımla çizer (telefonda Dışa Aktar › Çizim boyutları ›
Simge takımı). Yeni konan elemanlar seçili takımla çizilir; takımı değiştirince çizimdekilere uygulanması sorulur
(**Telefon Görünümü**; eski çizimlerin blokları kendiliğinden değişmez).

*Klasik* (varsayılan): beton / ağaç direk daire, demir direk kare. Her durumun simgesi ayrıdır:

| Durum | Simge |
| --- | --- |
| Yeni (M, M+M, KM) | dolu |
| Mevcut | boş |
| Sök-tak (DM+M) | yarım dolu |
| Demontaj (DM) | boş + simgeden taşan tek çizgi `/` |
| Demontaj, KESİK | boş + iki paralel çizgi `//` |
| Demontaj, SÖKÜK | boş + çarpı `X` |

*Şebeke-M*: her elemanın kendi işareti vardır — AG direk (beton daire / demir kare), OG direk, ENH direği, aydınlatma
direği, direk tipi trafo (ve özel), köşkler (modüler · kuleli · kule çıkışlı · kulesiz özel · özel), indirici merkez,
trafo binası, box, SDK (AG / aydınlatma), armatür (LED · cıva · sodyum · floresan). Durum simgenin doluluğundan okunur:

| Durum | Simge |
| --- | --- |
| Yeni (M, M+M, KM) | dolu (iç işaret zıt renkte) |
| Mevcut | kontur (boş) |
| Sök-tak (DM+M) | sol yarısı dolu |
| Demontaj (DM) | çift kontur + altında **DM** yazısı |
| Demontaj, KESİK | çift kontur + **DM** + sağ altta **K** |
| Demontaj, SÖKÜK | çift kontur + **DM** + sağ altta **S** |

Köşkün türü elemanın **tipindeki** sözcükten tanınır (indirici · bina · kulesiz · kule çıkışlı · kule · özel); hiçbiri
yoksa modüler beton köşk çizilir. Armatürün lamba türü de tipten (LED · cıva · floresan; yoksa sodyum). Takımda
olmayan elemanlar (ek mufu, kofre, menhol, abone, diğer) klasik simgesiyle kalır. Bloklar `SH_SM_…` adıyla çizime
eklenir. İki takımın lejantı: `ortak/lejant/semboller-klasik.svg`, `ortak/lejant/semboller-sebekem.svg`.

Her iki takımda demontaj simgeleri sarı çizilir; simgeler metre cinsindendir, ayardaki büyüklükle konur (varsayılan
1 kat). Eski bir çizimi bu görünüme çevirmek için **Telefon Görünümü** (`SH_GORUNUM`); değişmeyen eski bloklara
dokunulmaz.

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
| Malzeme | `SH_MALZEME` | Direği, hattı, kanalı ya da sondajı seçin: malzemeleri tablo hâlinde düzenleyin, katalogdan ekleyin (2 982 kalemlik katalog; AG galvaniz travers ve konsollar GT-60, GD-80, T-AG-1… ağırlıklarıyla). Hatta iletken eklerseniz hattın ikinci iletkeni olur (metrajı hattın boyu). |
| Toplu Malzeme | `SH_TOPLUMALZEME` | Seçilen bütün direklere (trafo, SDK…) aynı malzemeleri birden ekler. |
| Malzeme Hafızası | — | Açıkken son elemanın malzemeleri aynı tipteki yeni elemana kendiliğinden eklenir; tıklayınca kapanır / açılır. |
| Hat Değiştir | `SH_HATDEGISTIR` | Seçilen hatların iletkenini (tip, cins), türünü, durumunu, hakedişini değiştirir; kablo tipi yazısı ve katman güncellenir, metraj korunur. |
| Metraj | `SH_METRAJ` | Seçilen hat / kanal / sondajın metrajını çizim uzunluğundan yeniden hesaplar (önce listeyi gösterip sorar). |
| Telefon Görünümü | `SH_GORUNUM` | Çizimi telefon görünümüne çevirir (seçili simge takımıyla simgeler, renk, hat kalınlığı, etiket, metraj ve malzeme yazıları, kanal kenarları, Tahoma yazı tipi); katman adlarını Türkçe karaktersiz, cins kodlarını yazım hatasız yapar. |
| Aktif Hakediş | `SH_HAKEDIS` | Aktif hakediş: yeni çizilenler bu hakedişin katmanlarına (`SC_3.HAK.…`) konur. Eski programın aktif hakedişiyle ortaktır. |
| Hakediş Onayı | `SH_ONAY` | Her hakediş için sırayla **Kontrol → Hakediş → GIS** onayı (eski programın onay kaydı; o program aynı işaretleri görür). **Hakediş onayı verilen hakediş kilitlenir**: o hakedişe yeni nesne çizilemez, malzeme satırları gri görünür ve değiştirilemez / silinemez, metraj güncellemesi o nesneleri atlar, telefondan gelen değişiklik o hakedişe dokunuyorsa aktarılmaz. Kilitli direğe açık hakedişte yeni malzeme eklemek serbesttir. **Kullanıcı tanımlıysa** (aşağıda) önce oturum istenir: Kontrol aşamasını Kontrol mühendisi, Hakediş ve GIS aşamasını Onay yetkilisi verir ya da kaldırır (Yönetici hepsini); yetkiniz olmayan kutular soluk ve kapalıdır. |
| Kullanıcılar | `SH_KULLANICILAR` | **Telefondaki kullanıcılar ve roller** (Yönetici, Kontrol mühendisi, Hakediş sorumlusu, Onay yetkilisi, Saha operatörü) ve **hakediş yetkisi**. İlk kullanıcı Yönetici olur ve onay mekanizması açılır; sonra kullanıcıyı yalnız Yönetici ekler / düzenler. Şifre 4–8 rakam, çizimde yalnız özeti saklanır. **Hakediş yetkisi**: Yönetici işaretlediği hakedişleri yazmaya kapatır; kapalı hakedişe yeni nesne çizilemez, satırları değiştirilemez (Yönetici hariç). Kullanıcılar ve hakediş yetkisi proje dosyasıyla telefona gider ve telefondan gelir (son değişiklik kazanır). Kullanıcı tanımlı değilse her şey eskisi gibi serbesttir. |
| Oturum | `SH_OTURUM` | Oturum aç (kullanıcı ve şifre) / oturumu kapat. Oturum çizim başınadır ve AutoCAD kapanınca düşer. 5 yanlış şifreden sonra 60 saniye beklenir. |
| Çizim Ayarları | `SH_AYARLAR` | Katman / GIS ön eki, koordinat dilimi, **tarife (şehir / köy-bakım ve karakteristik)**, sembol takımı, **simge ve yazı boyutları**, direğe yakalama mesafesi, metraj yuvarlama ve ek paylar, kanal varsayılanları, **proje bilgileri** (ad, kod, hesabı yapan, unvan, firma, buz bölgesi). Çizimin içinde saklanır. |
| Bölge | `SH_BOLGE` | Alt proje sınırı: köşeleri gösterin ya da **Nesne** deyip var olan kapalı çizgiyi seçin; ad, proje kodu ve **grup kodu**. Eski programın bölge listesine de kaydedilir. |
| Nokta Al | `SH_NOKTAAL` | Ölçü noktalarını dosyadan alır (telefonun "Noktalar (CSV)" çıktısı ya da Ad, Y, X, Z, Kod dosyası). |
| Telefondan Al | `SH_PROJEAL` | Bölüm 2. Üç dosya türü açılır: `.sebeke.json`, `.volt.json`, teslim paketi `.zip`. Teknik hesap kayıtları da alınır. |
| Telefona Gönder | `SH_ICEAL` | Bölüm 2. `.sebeke.json` (varsayılan) ya da `.volt.json` olarak kaydeder (onaylar, kullanıcılar, hakediş yetkisi ve hesap kayıtları da gider). |
| Durum Tespit | `SH_RAPOR` | Bu çizimden Excel rapor (eski programın sayfaları; ayrıca **DETAY** sayfası: her elemanın ara malzemeleri satır satır; **HESAPLAR** sayfası: teknik hesap sonuçları ve güncellikleri). |
| Dosyadan Rapor | `SH_PROJERAPOR` | Bir proje dosyasından Excel rapor (çizim açmadan; telefon dosyaları da olur). |
| Proje Özeti | `SH_OZET` | Pencere: solda projeler (bölgeler), sağda seçilen projenin **Malzeme listesi** ya da **Kanal listesi** sekmesi (hakediş, durum ve aramayla süzülür). Kanal listesinde her kanal parçası (baş – bit, kablolar, cins, kaplama, ölçü, uzunluk, hacim, durum, hakediş); "Tüm projeler"de her proje bir başlık satırıyla başlar, altında toplamı. **Excel'e aktar** proje listesini, görünen malzeme listesini ve **KANAL LİSTESİ / KANAL ÖZETİ** sayfalarını yazar. Kanal sekmesindeki **Çizime tablo olarak koy** görünen listeyi çizime tablo olarak koyar. **Birleşik Metraj…** (9.11.2026) eski programın Birleşik Metraj Excel şablonunu (DİREK / İLETKEN / YERALTI METRAJI, MALZ. LİSTESİ) seçili projeyle (ya da "Tüm projeler"le) doldurur: pencerede şablon (gömülü temiz kopya ya da kendi `.xlsm` dosyanız), yüklenici firma, il, ilçe ve hakediş no (bu bilgisayarda hatırlanır); dosya `<çizim>_<proje>_BIRLESIK_METRAJ_<tarih>.xlsm` olarak kaydedilir, sonuç penceresi açılan sütunları ve uyarıları gösterir, **Dosyayı aç** Excel'i açar. Kurallar: her direk / box bir satır (yeni → Yeni Direk, demontaj → Demontaj "tip (K/S)", sök-tak → Demontajdan Montaj, mevcut → Mevcut; malzemeler kendi durumlarıyla), şablonun kendi türetme formülleri yerine çizimdeki malzeme yazılır (olmayan 0), her havai açıklık İLETKEN'de bir satır (sök-tak iki satır: DM + AKTARIM; tel kodları R / P / A / SWLL…), kanallar ve yeraltı kablolar YERALTI'da (kablo metrajı kanal üstünden giden kısım KANAL İÇİN, kalan DİREK İÇİN). Şablonda olmayan direk tipi, tel, kablo ya da malzeme için ilgili sayfaya **yeni sütun** açılır (KOD `YE001`, `DE002`… — MALZ. LİSTESİ'nin EK satırlarına bağlı; 40 EK satırı bitince kalanlar "ŞABLONDA OLMAYAN" sayfasına). Dosya Excel'de açılınca formüller yeniden hesaplanır (makro korunur). Kural telefonla ortak: [ortak/BIRLESIK-METRAJ.md](ortak/BIRLESIK-METRAJ.md). |
| Kanal Listesi | `SH_KANALLISTESI` | Proje bazında kanal listesini çizime **tablo** olarak koyar (sol üst köşesini gösterin): her proje için başlık, kanallar ve toplamı, en altta genel toplam. Tablo `SH_KANAL_LISTESI` bloğudur (katman `SC_KANAL_LISTESI`); yeniden çalıştırınca yerinde yenilenir. AutoCAD'in tablo nesnesi değildir, DWG 2000 biçiminde de bozulmadan kalır. |
| Çizim Onar | `SH_ONAR` | Açılırken AutoCAD'i kapatan çizimi **açmadan** onarır (DWG 2000 biçimi): eklentinin eski sürümünün (0.1.57 ve öncesi) bıraktığı boş kayıtlar çıkarılır, onarılmış kopya `…-onarildi.dwg` adıyla yanına yazılır; asıl dosyaya dokunulmaz. Birden çok çizim seçilebilir; çizim AutoCAD'de açık olmamalıdır. |
| Eksik Malzeme | `SH_DETAY` | Eski programdaki DETAY sorgusu: ör. "topraklaması **olmayan** AG direkleri". Hangi elemanlarda (ana cins, tip, durum, bölge) hangi ara malzemenin (cins, tip, durum, hakediş) aranacağını seçin; **olmayanlar / olanlar / hepsi**. Sonuç pencerede listelenir; **Çizimde seç** bulunan elemanları seçer, **Excel'e yaz** ayrıca DETAY dosyasını yazar. |
| Google Earth | `SH_KML` | Aşağıda: CBS ve harita. |
| CBS'ye Aktar / CBS'den Al / CBS Bilgisi | `SH_MIFVER` / `SH_MIFAL` / `SH_CBSBILGI` | Aşağıda: CBS ve harita. |
| Harita Altlığı | `SH_ALTLIK` | Aşağıda: CBS ve harita. |
| Hesap Merkezi | `SH_HESAP merkez` | Bölüm 5. Seçili nesne için uygun hesapların listesi ve kayıtlı sonuçları. |
| Kayıtlı Hesaplar | `SH_HESAPLAR` | Bölüm 5. Çizimdeki bütün hesap kayıtları. |
| Cer Vektörü, Kanal Planı | `SH_HESAP <hesap>` | Bölüm 5. Seçili nesne için o hesabı açar. |

### CBS ve harita

Bu düğmeler çizimin gerçek koordinatını kullanır: **ITRF96, 3° TM**. Çizimin dilimi (dilim orta meridyeni:
27, 30, 33, 36, 39, 42, 45) **Çizim Ayarları**'nda yoksa ilk kullanımda bir kez sorulur ve çizime kaydedilir
(Elazığ, Malatya, Erzincan: 39°). Çizim yerel / kaydırılmış koordinatla çizilmişse uyarılırsınız.

- **Google Earth** (`SH_KML`): çizimi `.kmz` (ya da `.kml`) olarak kaydeder. Her proje (bölge) bir klasördür:
  proje sınırı, elemanlar, hatlar, kanallar, sondajlar; GPS noktaları ayrı klasörde (kapalı gelir). Renkler
  telefon ekranındakiyle aynıdır; demontajlar yarı saydamdır. Bir nesneye tıklayınca GIS no, tip, durum, hakediş,
  proje, metraj ve malzemeleri görünür. Telefon da aynı dosyayı üretir: **Dışa Aktar › Google Earth KMZ** (telefonda
  ayrıca 3 boyutlu direk / tel klasörü vardır, kapalı gelir).
- **CBS'ye Aktar** (`SH_MIFVER`): MapInfo **MIF / MID** dosyaları, **şebeke elemanı başına ayrı katman**.
  Verdiğiniz ada her katman için ek gelir; her biri `.mif` + `.mid`:
  - `ad_DIREK`, `ad_TRAFO`, `ad_SDK`, `ad_PANO`, `ad_ELEMAN` (diğer elemanlar: mufu, kofre…): nokta. Sütunlar
    `KIMLIK`, `GIS_NO`, `TUR` / `TUR_ADI`, `CINS` / `CINS_ADI`, `TIP`, `DURUM`, `DM_DURUM`, `HAKEDIS`, `GUC` (trafo
    kVA), `GERILIM`, `KONTROL`, `PROJE`, `PROJE_KODU`, `MALZEME` (özet), `MALZEME_SAYISI`, `SAGA`, `YUKARI`, `KOT`,
    `ACI`, `TELEFON_ID`.
  - `ad_HAT` (iletken / kablo): `KESIT`, iletkenler (`ILETKEN_CINS`, `ILETKEN`, `ILETKEN_ADET`; müşterek hatta ikinci
    iletken `ILETKEN2_…`), `ETIKET`, `DURUM`, `HAKEDIS`, `KONTROL`, `BAS_NO` / `BIT_NO` (hattın iki ucundaki eleman),
    `UZUNLUK`, `METRAJ`, `MALZEME_SAYISI`.
  - `ad_KANAL` (`KABLOLAR`, `ZEMIN`, `ALT_CM`, `UST_CM`, `DERIN_CM`, `BAS_NO`, `BIT_NO`), `ad_SONDAJ`, `ad_BOLGE`
    (proje sınırı), `ad_NOKTA` (GPS noktası).
  - `ad_MALZEME`: haritada yeri olmayan tablo; her nesnenin **bütün malzeme satırları** (cins, tanım, durum, miktar,
    birim, katsayı, hakediş, sıra, kontrol). `NESNE` sütunu malzemenin ait olduğu nesnenin `KIMLIK`'idir.

  Koordinatlar çizim koordinatıdır (dosyada dilim yazılıdır), harfler Türkçe Windows kod sayfasıdır. Telefonda:
  **Dışa Aktar › CBS MapInfo (MIF / MID)** aynı katman ve sütunları yazar (seçilen koordinat sisteminde; tek .zip).
- **CBS'den Al** (`SH_MIFAL`): bir ya da birkaç `.mif` dosyası seçin (yanında aynı adlı `.mid`). **CBS'den al**
  penceresi açılır:
  - Solda seçtiğiniz dosyalar. Her dosya için **Bu dosya ne?**: direk, trafo, SDK, pano, diğer eleman, hat, kablo
    kanalı, yatay sondaj, bölge, GPS noktası, malzeme tablosu ya da **altlık** (yalnız çizilir). Şebeke-M Hakediş'in yazdığı
    dosyalar adından kendiliğinden tanınır; başka bir CBS'nin dosyası sütun adlarından tahmin edilir.
  - **Sütunlar**: her bilgi (GIS no, cins, tip, durum, hakediş, iletken…) dosyanın hangi sütununda; yanında ilk
    nesnedeki değer görünür. Bulunamayan bilgi boş kalır, siz seçebilirsiniz.
  - **Durumu yazılı değilse** (yeni / mevcut / demontaj…) ve **Hakediş**: dosyada yoksa nesnelere verilecek değer.
  - **Al**: şebeke nesneleri **gerçek hakediş nesnesi** olarak çizilir (Telefondan Al gibi; önce özet penceresi):
    direkler, trafolar, SDK'lar, panolar tipi ve malzemeleriyle; hatlar iletkeni, adedi ve metrajıyla, iki ucundaki
    elemana bağlı; kanallar ölçüleriyle. Malzeme tablosu da seçildiyse malzemeler oradan gelir. Dosyada kimlik
    sütunu varsa aynı dosyayı yeniden almak nesneleri çoğaltmaz, günceller; Şebeke-M Hakediş'ten çıkan dosya aynı çizime geri
    alınınca nesneler kendisiyle eşleşir.
  - Altlık seçilen dosyalar eskisi gibi: noktalar küçük daire, çizgiler ve alanlar çoklu çizgi, yazılar yazı;
    her dosya kendi katmanında (`CBS-dosya adı`), hakediş nesnesi değildir (rapora ve telefona girmez).
  - TM (başka dilim, UTM), enlem-boylam ve düz koordinat çizimin dilimine çevrilir. Datum ITRF96 / WGS84 değilse
    (ör. ED50) uyarılırsınız (birkaç metre kayabilir). Telefonda MIF alma yoktur: CBS'den alınan nesneler çizimden
    **Telefona Gönder** ile telefona geçer.
- **CBS Bilgisi** (`SH_CBSBILGI`): CBS'den alınan nesneyi seçin; dosyadaki bütün bilgileri (MID satırı) gösterir.
- **Harita Altlığı** (`SH_ALTLIK`): uydu görüntüsü ya da harita, çizime oturtulmuş resim olarak **ALTLIK** katmanına,
  nesnelerin altına konur; altına kaynağın atıf yazısı yazılır. Resim çizimin yanındaki `Altlik` klasörüne kaydedilir
  (çizim henüz kaydedilmediyse `Belgeler\Altlik`).
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

Hesap araçları bir elektrik-elektronik mühendisinin hazırladığı hesap sayfalarıdır; formülleri ve tabloları
değiştirilmeden Şebeke-M Hakediş'e eklenmiştir. Telefonda ve AutoCAD'de **aynı sayfalar** açılır; aradaki tek
fark, bilgilerin nereden geldiğidir (telefonda projeden, AutoCAD'de çizimden).

| Hesap | Ne yapar |
| --- | --- |
| Direk Tepe Kuvveti (Cer Vektörü) | Direğe bağlı bütün hatların çekme kuvvetlerinin vektörel toplamı ve bileşke yönü; direk tipi kontrolü. Sonucun altında **Önerilen direk tipi** kutusu (8.11.2026): aracın hat satırlarından (kuvvet, açı, iletken) eski TEDAŞ tepe kuvveti tablosuyla uygun en küçük direk tipi (AG 9-H … 12I, K1 … K5; müşterek 10I'' … K5''; trafo direği T-15 … T-50; ağaç 9-O / 9-A), en kötü senaryo (bütün hatlar ya da bir hattın kopması), L / R / B30 değerleri ve projedeki tipin tabloya göre yeterli olup olmadığı. Tablo eski TEDAŞ aracından alınmıştır; sonuç öneridir, projeci karar verir |
| Kanal Planı | Yeraltı kablo kanalı kesit detayları: kablo dizilişi, kanal genişliği ve derinliği, kazı metrajı, DXF |
| Direk Listeleri (8.11.2026) | Proje (bölge) bazlı dört liste tek sayfada, sekmelerle: **AG Direk Listesi** (AG / müşterek direkler: fonksiyon, açı, hat tertibi, konsol, izolatör, tepe kuvveti — kayıtlı cer hesabından), **ENH Direk Dağıtım Cetveli** (OG hat zincirleri boyunca: baştan mesafe, ara mesafe, rüzgâr açıklığı, açı (grad), tip, izolatör), **Aydınlatma Direk Listesi** (armatür taşıyan direkler: tertip, tip, konsol, armatür sayısı), **Direk Koordinat Listesi** (Y sağa, X yukarı, kot). Üstte bölge seçimi; yazdırmaya uygun (A4 yatay). Şeritte her liste kendi düğmesiyle de açılır (aynı sayfanın o sekmesi). Hesap Merkezi'nde proje geneli hedefle (nesne seçmeden Enter) listelenir |

1.11.2026'dan 8.11'e kadar Hesap Merkezi'nde yalnız ilk iki hesap vardı (kullanıcı isteği); 8.11'de proje bazlı Direk
Listeleri eklendi. Daha önce bulunan sehim, uplift, ag–aw, Amax, kopma, tablo yöntemiyle tepe kuvveti, gerilim düşümü,
kısa devre, bakır–alüminyum kesit, beton köşk yerleşimi ve AG tek hat hesapları kaldırıldı; eski kayıtları projede bilgi
olarak durur (sayfası açılmaz).

### Nasıl açılır?

- **Telefon**: bir direğin, trafonun ya da hattın ekranında **Hesaplar** düğmesi; haritada objenin balonunda
  **Teknik hesaplar**; ya da **Hesaplar › Teknik hesaplar** (proje geneli). Listede yalnız o nesneye **uygun**
  hesaplar üstte gelir; uygun olmayanlar nedenleriyle birlikte altta katlanmış durur.
- **AutoCAD**: nesneyi seçip (ya da düğmeden sonra seçerek) **ŞEBEKE-M ARAÇLAR › Teknik Hesaplamalar**:
  - **Hesap Merkezi**: seçilen nesne için uygun hesaplar ve o nesnenin kayıtlı sonuçları. Nesne seçmeden **Enter**:
    çizimin tamamı.
  - **Cer Vektörü / Kanal Planı / Direk Listeleri (AG, ENH cetveli, aydınlatma, koordinat)**: hesabı doğrudan açar.
  - **Kayıtlı Hesaplar**: çizimdeki bütün kayıtlar.
  - Komut satırından: `SH_HESAP` (hesap kimliği sorar; `merkez`, `tepe-vektor` ya da `kanal`), `SH_HESAPLAR`.
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
  0.1.57 ve önceki sürümleri bazı nesnelere boş bir veri bölümü yazıyordu; böyle kaydedilmiş çizim açılışta çöker,
  `RECOVER` ile açılır ama o nesneler gelmez. Çözüm: eklentiyi güncelleyin; çizim **DWG 2000** biçiminde
  kaydedildiyse **Çizim Onar** (`SH_ONAR`) onu açmadan onarır (`…-onarildi.dwg`). Başka biçimdeyse boş bir çizime
  projeyi telefon dosyasından yeniden alın (`SH_PROJEAL`). Düzeltme 0.1.58 ve sonraki sürümlerdedir (`SH_HAKKINDA`
  sürümü gösterir; bilgisayarda eski zip dosyası kaldıysa silin).
- **Hat çizip komuttan çıkınca AutoCAD kapanıyor ("INTERNAL ERROR: !dbobji.cpp@8703: eNotOpenForWrite")**:
  0.1.74–0.1.80 sürümlerindeki hata; eklentiyi güncelleyin. Kapanmadan önce kaydedilmemiş iş AutoCAD'in Kurtarma
  penceresindeki yedekten açılır.
- **Çizim açılırken komut satırında eski programın adı yazıyor**: bu satırı Şebeke-M Hakediş yazmaz (adı programda hiç
  geçmez; `telefon/web/tests/marka.test.mjs` denetler). Bilgisayarda kurulu kalan eski program her çizim açılışında
  kendini yükleyip adını yazar. Eski programı artık kullanmıyorsanız AutoCAD'in açılışta yüklediklerinden çıkarılabilir
  (çoğunlukla komut satırına `APPLOAD` › **Başlangıç Grubu** › **İçindekiler**: eski programın dosyasını seçip **Kaldır**).
- **Malzeme yazıları simgeleri kapatıyor**: ilk satırı tutup boş bir yere taşıyın; öteki satırlar bir sonraki
  güncellemede onun altına dizilir. Yazı büyüklüğü eleman yazısıyla birlikte değişir (Çizim Ayarları › Görünüm).
- **Şerit sekmesi kayboldu**: komut satırına `SH_SERIT`.
- **Bir hata oldu**: ayrıntı `%TEMP%\SebekeHakedis_hata.txt` dosyasına yazılır. Destek için `SH_DOKUM`
  çizimin teknik dökümünü kaydeder.
