# Şebeke Hakediş — Kullanım Kılavuzu

İki araç var, ikisi aynı proje dosyasını (`.sebeke.json`) kullanır:

- **Telefon uygulaması VOLT-EDAŞ Saha** (sahada): direk, trafo, SDK, pano koyma; hat ve kanal çizme; malzeme,
  fotoğraf, not; metraj, Yeşil Defter, hakediş ve teslim paketi. Ayrıntılı kılavuz:
  [telefon/docs/KULLANIM-KILAVUZU.md](telefon/docs/KULLANIM-KILAVUZU.md).
- **AutoCAD eklentisi** (büroda): PROMAGIS çizimlerini okuma, Durum Tespit raporu, telefona gönderme,
  telefondan alma ve çizim araçları (direk, hat, kanal, bölge, nokta alma, malzeme).

Dosya telefon ile bilgisayar arasında **Google Drive** üzerinden taşınır. Böylece hangi bilgisayarda
çalışırsanız çalışın proje Drive'da durur.

---

## 1. Kurulum

### Telefon

1. Telefondan GitHub'a girin (depo size özeldir; kendi hesabınızla giriş yapın):
   **sebeke-hakedis** deposu › **Releases**.
2. En üstteki **"Telefon uygulaması 2.5.x"** sürümünü açın, `VOLT-EDAS-Saha-2.5.x.apk` dosyasına dokunun.
3. İndirme bitince dosyayı açın. Telefon "bilinmeyen kaynak" uyarısı verirse **Ayarlar › Bu kaynağa izin ver**.
4. **Yükle**. Uygulama "VOLT-EDAŞ Saha" adıyla görünür.

Telefonda VOLT-EDAŞ Saha 2.1.0 ve sonrası kuruluysa **silmeyin**: yeni sürüm üzerine kurulur, projeleriniz silinmez.
(Eski "Şebeke Hakediş" telefon uygulaması ayrı bir uygulamadır; artık geliştirilmiyor, kaldırabilirsiniz.)

### AutoCAD (2016–2024 ve 2025 ve sonrası)

1. Bilgisayarda GitHub › **Releases** › en üstteki **"AutoCAD eklentisi 0.1.x"** › `SebekeHakedis-0.1.x.zip` indirin.
2. Zip'e sağ tıklayın › **Tümünü ayıkla**.
3. AutoCAD açıksa kapatın. Ayıklanan klasördeki **KUR.bat** dosyasına çift tıklayın.
   Windows "bilgisayarınız korundu" derse: **Ek bilgi › Yine de çalıştır**.
4. AutoCAD'i açın. Şeritte **ŞEBEKE HAKEDİŞ** sekmesi görünür.
   Güvenlik uyarısı çıkarsa **Her zaman yükle** deyin.

Güncellemek için yeni zip ile aynı adımları tekrarlayın. Kaldırmak için **KALDIR.bat**.

---

## 2. Genel iş akışı

### A. Elinizde bir PROMAGIS çizimi varsa

1. **AutoCAD**: çizimi açın › **ŞEBEKE HAKEDİŞ › Telefon › Telefona Gönder**.
   Dosyayı Google Drive klasörünüze kaydedin (ör. `Google Drive\Şebeke Hakediş\`).
   *Bilgisayarda Google Drive uygulaması yoksa dosyayı drive.google.com'a sürükleyip bırakın.*
2. **Telefon**: uygulama › **Projeler › AutoCAD dosyasından proje al** › Drive › dosyayı seçin › **Al**.
   Proje, PROMAGIS'teki direk, hat, kanal ve bölgeleriyle açılır. Direk tipleri telefonun kataloğundan bulunur;
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
   - Beğenmezseniz AutoCAD'de **U** (Geri Al) aktarımın tamamını tek seferde geri alır.
6. Rapor: **Rapor › Durum Tespit** (Excel).

### B. Sahada sıfırdan başlıyorsanız

1. **Telefon**: **Projeler › Yeni proje**. Proje adını, kodunu ve **3° dilimi (DOM)** girin
   (Elazığ, Malatya, Erzincan: 39°).
2. Sahada çalışın (Bölüm 3), sonra **Dışa Aktar › AutoCAD proje dosyası** ile Drive'a gönderin.
3. **AutoCAD**: yeni boş bir çizim açın › **Telefondan Al**. Her şey PROMAGIS katman ve bilgi biçiminde
   çizilir; direk, trafo ve SDK simgeleri lejanttaki gibidir (beton direk daire, demir direk kare, yeni dolu,
   mevcut boş, sök-tak yarım, demontaj çapraz). Bu çizimi PROMAGIS çizimi gibi kullanabilirsiniz.
4. Rapor: **Rapor › Durum Tespit**. Telefonda tek bölge (projenin kendisi) vardır; alt projeler gerekiyorsa
   AutoCAD'de **Bölge** ile çizin, sonraki alışverişlerde korunur.

### Hangi dosya nereye?

| Dosya | Kim yazar | Kim açar |
| --- | --- | --- |
| `<proje>.sebeke.json` — AutoCAD proje dosyası | Eklenti (Telefona Gönder) · Telefon (Dışa Aktar) | İkisi de |
| `<proje>.volt.json` — telefon proje dosyası (tam yedek + AutoCAD bölümü) | Telefon (Dışa Aktar) · Eklenti (istenirse) | İkisi de |
| `<proje>_teslim_paketi.zip` | Telefon | Eklenti (içindeki proje dosyasını okur) · idareye teslim |
| `<proje>.dxf` | Telefon | AutoCAD (eklentisiz de açılır; simgeler eklentiyle aynı bloklar) |

---

## 3. Telefonda çalışma (kısa)

Ayrıntı için telefon kılavuzuna bakın; AutoCAD ile birlikte çalışırken önemli olanlar:

- **Konum kaynağı**: Ayarlar › GNSS. Bluetooth alıcı + NTRIP (TUSAGA-Aktif ya da kayıtlı sabit istasyon profili),
  ya da telefon GPS'i. Üst çubuk çözümü gösterir (RTK FIX bekleyin).
- **Obje alma**: Harita › **DİREK / TRAFO / DİĞER** › tür, tip, durum (Yeni, Mevcut, DMM, Demontaj, İleride) ›
  **ALIM**. Direk tipi adları AutoCAD'e PROMAGIS yazımıyla gider (ör. `GD-10 (3 AWG)` → `G-D-10 (sw)`, `9.3/8` → `9,3/8`).
- **Durumlar**: Yeni → M (poz temini yüklenici ise M+M), Mevcut → MEVCUT, Demontaj → DM, DMM → DM+M.
  Objenin ekranında PROMAGIS kodu ayrıca seçilebilir: **KM** (kurum malzemesi, yüklenici montajı), **ENH**
  (kilometrik bedelli iş), **ME** (mutabakat eksiği); demontajda **KESİK / SÖKÜK**. AutoCAD'den gelen kod korunur.
  **"İleride" durumundaki objeler AutoCAD dosyasına yazılmaz.**
- **Hat**: başlangıç ve bitiş direğine dokunun; iletken / kablo tipini seçin. Yeraltında kaplama (toprak, tüvenan,
  asfalt, beton, parke) ve yöntem (açık kazı, borulu geçiş, yatay sondaj) AutoCAD'de kanal / sondaj nesnesi olur.
- **Malzeme**: objeye dokunun › **Malzeme ekle** (katalogdan). AutoCAD'den gelen malzemeler aynen korunur.
- **Dışa Aktar**: "AutoCAD proje dosyası" varsayılan seçilidir; "Telefon proje dosyası" tam yedektir.
- **AutoCAD dosyasını bu projeye al** (Proje merkezi): AutoCAD'de yapılan değişiklikleri açık projeye alır;
  aynı nesneler güncellenir, yenileri eklenir.
- **Hat parçaları**: AutoCAD'de hat her direkte / SDK'da biter (parça parça). Telefonda bunlar tek hat olarak görünür;
  geri gönderince parçalar ve numaraları aynen döner.
- **AutoCAD (PROMAGIS) onayları**: Hakediş ekranında görünür (Kontrol / Hakediş / GIS). AutoCAD'de onaylı hakedişe
  dokunan değişiklikler orada aktarılmaz.

---

## 4. AutoCAD'de çalışma

Hepsi şeritteki **ŞEBEKE HAKEDİŞ** sekmesindedir. Çizilen her şey PROMAGIS biçimindedir (aynı katmanlar ve
bilgiler); PROMAGIS çizimleriyle karışık kullanılabilir, raporda aynı okunur, PROMAGIS'te de açılır.

### Şerit (soldan sağa)

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
   - **Tip**: yalnız o öğenin tipleri (son kullanılanlar ve çok kullanılanlar üstte).
   - **Ara**: yazıp Enter'a basın (ör. `k2`, `beton 9,3`, `alpek 50`); öğenin bütün tipleri arasında arar, bulunanlar
     Tip listesine gelir, ilki seçilir. Boş Enter kısa listeye döner.
   - Altındaki satır **sıradaki tıklamada ne çizileceğini** gösterir: `AG Direk · G-10I · M · 2. hakediş`.
   - **Durum** (M, M+M, KM, DM, DM+M, MEVCUT), **Hakediş** ("Aktif hakediş" ya da bir numara); **DM türü**
     (KESİK / SÖKÜK) yalnız DM ve DM+M seçiliyken görünür.
   - **Ayrıntılı…**: aynı öğeyi pencereyle çizer (bütün tipler, GIS numarasını elle verme vb.).
   Seçimler hatırlanır (AutoCAD yeniden açılınca da).
4. Sağdaki bölümler: **Düzenle** (Malzeme, Metraj, Telefon Görünümü, Çizim Ayarları), **Hakediş** (Aktif Hakediş,
   Hakediş Onayı), **Telefon**, **Rapor**, **Yardım**. Ekran darsa AutoCAD sağdaki bölümleri kendisi küçültür.

Çizerken: **Geri** son nesneyi kaldırır, **Ayarlar** seçimleri değiştirir, **Enter** bitirir. GIS numarası
kendiliğinden artar. Her komut AutoCAD'in **U** (Geri Al) komutuyla tek seferde geri alınır.

### Pencereler

Bütün pencereler koyu temadadır; **Enter** birincil düğmeye (Çiz, Kaydet), **Esc** Vazgeç'e basar. Pencere
başlığından tutup taşınır.

- **Eleman koy / Hat çiz**: solda tür, ortada arama kutusu + cins süzgeci + tip listesi (**Son kullanılanlar** ve
  **Tüm tipler**; her satırda tanım, cins, ağırlık, poz no), sağda durum (her kodun anlamıyla), demontaj türü,
  hakediş ve ilk GIS numarası (boş bırakılırsa kendiliğinden; kutuda önerilen numara görünür). Altta
  "Çizilecek: …" satırı. **Onaylı (kilitli) bir hakediş** seçilirse sarı uyarı çıkar ve Çiz düğmesi kapanır.
- **Kablo kanalı çiz**: kanaldaki kablolar, zemin listesi, ölçüler ve **hızlı seçim** düğmeleri (40×40×80 …).
- **Yatay sondaj çiz**: tip listesi, durum, hakediş.
- **Malzemeler**: nesnenin kendi pozu en üstte (kalın, simgeli); hücreye tıklayıp durum, miktar, hakediş, DM
  durumu değişir; altta toplam ağırlık. Onaylı hakedişin satırları gri ve kilit simgelidir.
- **Eksik malzeme bul**: süzgeç değiştikçe sonuç pencerede listelenir; **Çizimde seç** ya da **Excel'e yaz**.
- **Hakediş onayı**: her hakediş için Kontrol → Hakediş → GIS işaretleri; aktif hakediş vurgulu, onaylı olan kilitli.
- **Çizim ayarları**: Genel, Tarife, Görünüm, Metraj sekmeleri.
- **Telefondan al**: Yeni eklenecek / Güncellenecek / Değişmeyen kutucukları (listeleriyle) ve uyarılar (kilitli
  hakediş, telefonda silinmiş, onaylar). **Çizime aktar** ile başlar.

### Hat, kanal ve sondaj parça parça çizilir

Hat her direkte, SDK'da ya da pano/trafoda **biter ve yeniden başlar**: iki direk arası ayrı bir nesnedir, metrajı
ve etiketi kendine aittir. Direksiz ara köşeler parçanın içinde kalır. Her parçanın uzunluğu iki direğin arasında
yazılır. Kanal ve sondaj da aynıdır. Telefon bu parçaları tek hat olarak gösterir, geri gönderince parçalar korunur.

### Görünüm: telefondakiyle aynı

Simgeler, renkler, çizgi tipleri ve yazılar telefondaki çizimle birebir aynıdır (`ortak/katalog/cizim-stili.json`).
Beton / ağaç direk daire, demir direk kare; yeni dolu, mevcut boş, sök-tak yarım, demontaj çapraz. Simgeler
metre cinsindendir, 1 ölçekle konur. Eski bir çizimi bu görünüme çevirmek için **Telefon Görünümü** (`SH_GORUNUM`);
değişmeyen PROMAGIS bloklarına dokunulmaz. PROMAGIS simgeleri istenirse **Çizim Ayarları › Görünüm**.

### Diğer düğmeler

| Düğme | Komut | Ne yapar |
| --- | --- | --- |
| Malzeme | `SH_MALZEME` | Direği, hattı, kanalı ya da sondajı seçin: malzemeleri tablo hâlinde düzenleyin, katalogdan ekleyin (2 934 kalemlik PROMAGIS kataloğu). |
| Metraj | `SH_METRAJ` | Seçilen hat / kanal / sondajın metrajını çizim uzunluğundan yeniden hesaplar (önce listeyi gösterip sorar). |
| Telefon Görünümü | `SH_GORUNUM` | Çizimi telefon görünümüne çevirir (simge, renk, etiket, parça metrajları). |
| Aktif Hakediş | `SH_HAKEDIS` | Aktif hakediş: yeni çizilenler bu hakedişin katmanlarına (`SC_3.HAK.…`) konur. PROMAGIS'in aktif hakedişiyle ortaktır. |
| Hakediş Onayı | `SH_ONAY` | Her hakediş için sırayla **Kontrol → Hakediş → GIS** onayı (PROMAGIS'teki onay kaydı; PROMAGIS aynı işaretleri görür). **Hakediş onayı verilen hakediş kilitlenir**: o hakedişe yeni nesne çizilemez, malzeme satırları gri görünür ve değiştirilemez / silinemez, metraj güncellemesi o nesneleri atlar, telefondan gelen değişiklik o hakedişe dokunuyorsa aktarılmaz. Kilitli direğe açık hakedişte yeni malzeme eklemek serbesttir. |
| Çizim Ayarları | `SH_AYARLAR` | Katman / GIS ön eki, koordinat dilimi, **tarife (şehir / köy-bakım ve karakteristik)**, sembol takımı, etiket yüksekliği, direğe yakalama mesafesi, metraj yuvarlama ve ek paylar, kanal varsayılanları. Çizimin içinde saklanır. |
| Bölge | `SH_BOLGE` | Alt proje sınırı: köşeleri gösterin ya da **Nesne** deyip var olan kapalı çizgiyi seçin; ad, proje kodu ve **grup kodu**. PROMAGIS'in bölge listesine de kaydedilir. |
| Nokta Al | `SH_NOKTAAL` | Ölçü noktalarını dosyadan alır (telefonun "Noktalar (CSV)" çıktısı ya da Ad, Y, X, Z, Kod dosyası). |
| Telefondan Al | `SH_PROJEAL` | Bölüm 2. Üç dosya türü açılır: `.sebeke.json`, `.volt.json`, teslim paketi `.zip`. |
| Telefona Gönder | `SH_ICEAL` | Bölüm 2. `.sebeke.json` (varsayılan) ya da `.volt.json` olarak kaydeder (onaylar da gider). |
| Durum Tespit | `SH_RAPOR` | Bu çizimden Excel rapor (PROMAGIS'in sayfaları; ayrıca **DETAY** sayfası: her elemanın ara malzemeleri satır satır). |
| Dosyadan Rapor | `SH_PROJERAPOR` | Bir proje dosyasından Excel rapor (çizim açmadan; telefon dosyaları da olur). |
| Proje Özeti | `SH_OZET` | Bölge, eleman, hat, kanal sayıları ve hakediş onayları. |
| Eksik Malzeme | `SH_DETAY` | PROMAGIS'teki DETAY sorgusu: ör. "topraklaması **olmayan** AG direkleri". Hangi elemanlarda (ana cins, tip, durum, bölge) hangi ara malzemenin (cins, tip, durum, hakediş) aranacağını seçin; **olmayanlar / olanlar / hepsi**. Sonuç pencerede listelenir; **Çizimde seç** bulunan elemanları seçer, **Excel'e yaz** ayrıca DETAY dosyasını yazar. |

### PROMAGIS ile ortak kayıtlar

Eklenti PROMAGIS'in çizimde tuttuğu kayıtları da okur ve yazar; böylece aynı çizimde iki program sırayla kullanılabilir:

- **Kalem sırası (INDEX)**: yeni kalemlerin sıra numarası PROMAGIS'in sayacıyla (`AYARLAR/SAYAC`) devam eder,
  sayaç ilerletilir. Telefondan dönen kalemler numaralarını korur.
- **Aktif hakediş**: PROMAGIS'te seçilen hakediş eklentide de aktif olur; eklentide seçilen PROMAGIS'e yazılır.
- **Bölgeler**: eklentinin çizdiği ve telefondan gelen bölgeler PROMAGIS'in bölge listesine eklenir (raporunda görünür).
- **Pano çıkış şeması ve trafo hücreleri**: PROMAGIS'te girilen bilgiler eklentide ve telefonda korunur, aynen geri yazılır.
- **KONTROL (denetlendi) işareti**: korunur; denetlenmiş nesnenin malzemeleri açılırken sorulur.
- **Hakediş onayları**: bkz. Hakediş Onayı.

İpuçları:

- Pencerelerde liste üstündeki kutuya yazarak arayın (ör. `k2`, `alpek 50`). Çift tıklama seçer.
- Çizim komutları son seçimlerinizi hatırlar.

---

## 5. Sık karşılaşılanlar

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
- **Şerit sekmesi kayboldu**: komut satırına `SH_SERIT`.
- **Bir hata oldu**: ayrıntı `%TEMP%\SebekeHakedis_hata.txt` dosyasına yazılır. Destek için `SH_DOKUM`
  çizimin teknik dökümünü kaydeder.
