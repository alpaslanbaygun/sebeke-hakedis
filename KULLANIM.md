# Şebeke Hakediş — Kullanım Kılavuzu

İki araç var, ikisi aynı proje dosyasını (`.sebeke.json`) kullanır:

- **Telefon uygulaması** (sahada): direk, box, pano, trafo koyma; hat ve kanal çizme; malzeme, fotoğraf,
  not; hakediş özeti ve Durum Tespit raporu (Excel).
- **AutoCAD eklentisi** (büroda): PROMAGIS çizimlerini okuma, Durum Tespit raporu, telefona gönderme,
  telefondan alma ve çizim araçları (direk, hat, kanal, bölge, nokta alma, malzeme).

Dosya telefon ile bilgisayar arasında **Google Drive** üzerinden taşınır. Böylece hangi bilgisayarda
çalışırsanız çalışın proje Drive'da durur.

---

## 1. Kurulum

### Telefon

1. Telefondan GitHub'a girin (depo size özeldir; kendi hesabınızla giriş yapın):
   **sebeke-hakedis** deposu › **Releases**.
2. En üstteki **“Telefon uygulaması 0.2.x”** sürümünü açın, `SebekeHakedis-0.2.x.apk` dosyasına dokunun.
3. İndirme bitince dosyayı açın. Telefon “bilinmeyen kaynak” uyarısı verirse **Ayarlar › Bu kaynağa izin ver**.
4. **Yükle**. Uygulama “Şebeke Hakediş” adıyla görünür.

Yeni sürüm çıktığında aynı adımlar: eskisinin üzerine kurulur, **projeleriniz silinmez**.

### AutoCAD (2016–2024 ve 2025 ve sonrası)

1. Bilgisayarda GitHub › **Releases** › en üstteki **“AutoCAD eklentisi 0.1.x”** › `SebekeHakedis-0.1.x.zip` indirin.
2. Zip'e sağ tıklayın › **Tümünü ayıkla**.
3. AutoCAD açıksa kapatın. Ayıklanan klasördeki **KUR.bat** dosyasına çift tıklayın.
   Windows “bilgisayarınız korundu” derse: **Ek bilgi › Yine de çalıştır**.
4. AutoCAD'i açın. Şeritte **ŞEBEKE HAKEDİŞ** sekmesi görünür.
   Güvenlik uyarısı çıkarsa **Her zaman yükle** deyin.

Güncellemek için yeni zip ile aynı adımları tekrarlayın. Kaldırmak için **KALDIR.bat**.

---

## 2. Genel iş akışı

### A. Elinizde bir PROMAGIS çizimi varsa

1. **AutoCAD**: çizimi açın › **ŞEBEKE HAKEDİŞ › Telefon › Telefona Gönder**.
   Dosyayı Google Drive klasörünüze kaydedin (ör. `Google Drive\Şebeke Hakediş\`).
   *Bilgisayarda Google Drive uygulaması yoksa dosyayı drive.google.com'a sürükleyip bırakın.*
2. **Telefon**: uygulama › **Projeler › Dosyadan Aç** › Drive › dosyayı seçin.
   Proje, PROMAGIS'teki tüm direk, hat, kanal ve bölgeleriyle açılır.
3. Sahada çalışın (Bölüm 3).
4. İş bitince **Dışa Aktar / Paylaş › Proje dosyası (.sebeke.json) › Paylaş › Drive** ile Drive'a kaydedin.
5. **AutoCAD**: aynı çizimi açın › **Telefon › Telefondan Al** › dosyayı seçin.
   Açılan pencere ne olacağını söyler: kaç nesne **yeni**, kaç nesne **güncellenecek**, kaçı **aynı**.
   **Evet** deyin.
   - Yalnız telefonda eklenen ve değişen nesneler çizime yazılır; değişmeyenlere dokunulmaz.
   - Telefonda silinmiş görünen nesneler ayrıca sorulur. **Hayır** derseniz çizimde kalırlar.
   - Aynı dosyayı ikinci kez alırsanız bir şey değişmez (çift nesne oluşmaz).
   - Beğenmezseniz AutoCAD'de **U** (Geri Al) aktarımın tamamını tek seferde geri alır.
6. Rapor: **Rapor › Durum Tespit** (Excel).

### B. Sahada sıfırdan başlıyorsanız

1. **Telefon**: **Projeler › Yeni Proje**. Proje adını, hakediş numarasını, GIS ön ekini (ör. SC) ve
   **koordinat dilimini** (Elazığ, Malatya, Erzincan: TM 39°) girin. “Rapor başlığı” kutularına ilk alt projenin
   adını ve proje kodunu yazın (rapordaki PROJE ve PROJE KODU sütunları buradan gelir).
2. Başka alt projeler varsa **Bölgeler › Yeni Bölge** ile ekleyin (ad, proje kodu, sınır).
3. Sahada çalışın (Bölüm 3), sonra proje dosyasını Drive'a gönderin.
4. **AutoCAD**: yeni boş bir çizim açın › **Telefondan Al**. Her şey PROMAGIS katman ve bilgi biçiminde
   çizilir, görünüm projeye yaklaşır. Bu çizimi PROMAGIS çizimi gibi kullanabilirsiniz.

---

## 3. Telefonda çalışma

### Konum kaynağı (Konum ekranı)

- **GNSS alıcısı**: Bluetooth ile bağlanan her marka alıcı (NMEA). **Eşleştir… › Bağlan**.
  Düzeltme için **NTRIP (TUSAGA-Aktif)**: sunucu, port, bağlama noktası, kullanıcı, parola › **Başlat**.
- **Telefon konumu**: telefonun kendi GPS'i ya da M-Survey RTK gibi bir uygulamanın verdiği konum.
  O uygulamayı kullanmak için: telefonda **Geliştirici seçenekleri › Sahte konum uygulaması** olarak o
  uygulamayı seçin ve uygulamada “Sahte konum / Mock location” seçeneğini açın.

Üst çubuktaki yazı konumun durumunu gösterir (ör. “Harici · RTK”, “Telefon”). **Fixed** (RTK) değilken
ölçü almak mümkündür ama hata payı büyüktür; **Ayarlar › Yalnız Fixed çözümde kaydet** ile engellenebilir.

### Eleman koyma (direk, box, pano, trafo, mufu)

1. **Haritada Çalış**. Ekranın sağ altındaki büyük **KOY** düğmesi.
2. Türü ve tipi seçin (son kullanılanlar ve yıldızlılar en üstte). GIS numarası kendiliğinden gelir.
3. **Ölç**: konum, ayarlardaki süre kadar ortalanır. **Kaydet**.
4. Konum yoksa haritadaki artı işaretinin yerine konabilir (“Artıyı ekle”).

### Hat çekme

1. **HAT** düğmesi › hat türü ve kesit.
2. Başlangıç direğine, sonra bitiş direğine dokunun (gerekirse araya köşe ekleyin) › **Bitir**.
3. Metraj çizim uzunluğundan hesaplanır (yukarı yuvarlanır, ayardaki ek pay eklenir); değiştirilebilir.
   Etiket PROMAGIS yazımıyla gösterilir (ör. `^ 3X50/16+70 ALPEK/40m`). **Hattı Kaydet**.

### Kablo kanalı

**KANAL** › köşeleri sırayla gösterin › kanaldaki kablolar (OG, AG, Aydınlatma, Rekortman), zemin,
alt/üst genişlik ve derinlik (cm) › **Kanalı Kaydet**. Hacim kendiliğinden hesaplanır.

### Malzeme, fotoğraf, not

Haritada nesneye dokunun: alttaki panelde **Ayrıntı**, **Hat çek**, **Taşı**, **Sil** vardır. **Ayrıntı**'dan
malzeme eklenir (katalogdan arayarak), miktar/durum/hakediş değiştirilir, fotoğraf çekilir ve not yazılır.
Direk taşınınca ona bağlı hatların uçları da taşınır. Her değişiklik anında kaydedilir; **Geri Al** son işi geri alır.

### Hakediş özeti ve rapor

- **Hakediş Özeti**: metraj tablosu ve toplam kg (bölge ve hakedişe göre süzülebilir).
- **Dışa Aktar / Paylaş**: proje dosyası, **Durum Tespit raporu (Excel)**, **Çizim (DXF)**,
  **Noktalar (CSV)**, **Fotoğraflar (zip)**. “Paylaş” Android paylaşım menüsünü açar (Drive, WhatsApp, e-posta…);
  “Kaydet” telefona kaydeder.

---

## 4. AutoCAD'de çizim araçları

Hepsi şeritteki **ŞEBEKE HAKEDİŞ** sekmesindedir. Çizilen her şey PROMAGIS biçimindedir
(aynı katmanlar ve bilgiler); PROMAGIS çizimleriyle karışık kullanılabilir ve raporda aynı okunur.

| Düğme | Komut | Ne yapar |
| --- | --- | --- |
| Eleman | `SH_ELEMAN` | Tür ve tipi seçin, sonra her tıklamada bir eleman konur. GIS numarası kendiliğinden artar. **Geri** son elemanı kaldırır, **Enter** bitirir. |
| Hat | `SH_HAT` | Tür ve kesit seçin; başlangıç direğine, ara köşelere ve bitiş direğine tıklayın, Enter. Uç direğe yakınsa (ayar: 1 m) direğin tam ortasına oturur. Metraj sorulur (Enter = önerilen), etiket yazılır. |
| Kanal | `SH_KANAL` | Kablolar, zemin ve ölçüler; köşeleri gösterin. Başta ve sonda direğe tıklanırsa baş/bit numarası yazılır. |
| Sondaj | `SH_SONDAJ` | Yatay sondaj (delgi) tipi ve güzergâhı. |
| Bölge | `SH_BOLGE` | Alt proje sınırı: köşeleri gösterin ya da **Nesne** deyip var olan kapalı çizgiyi seçin; ad ve proje kodu girin. |
| Nokta Al | `SH_NOKTAAL` | Ölçü noktalarını dosyadan alır (telefonun “Noktalar (CSV)” çıktısı ya da Ad, Y, X, Z, Kod dosyası). Çizimde olan noktalar atlanır. |
| Malzeme | `SH_MALZEME` | Direği, hattı, kanalı ya da sondajı seçin: malzemeleri tablo hâlinde düzenleyin, katalogdan ekleyin. |
| Metraj | `SH_METRAJ` | Uçlarını çektiğiniz hatların, kanalların metrajını çizim uzunluğundan yeniden hesaplar (önce listeyi gösterip sorar). |
| Hakediş | `SH_HAKEDIS` | Aktif hakediş: yeni çizilenler bu hakedişin katmanlarına (`SC_3.HAK.…`) konur. |
| Ayarlar | `SH_AYARLAR` | Katman/GIS ön eki, koordinat dilimi, sembol ölçeği, etiket yüksekliği, direğe yakalama mesafesi, metraj yuvarlama ve ek paylar, kanal varsayılanları. Ayarlar çizimin içinde saklanır. |
| Telefondan Al | `SH_PROJEAL` | Bölüm 2. |
| Telefona Gönder | `SH_ICEAL` | Bölüm 2. |
| Durum Tespit | `SH_RAPOR` | Bu çizimden Excel rapor. |
| Dosyadan Rapor | `SH_PROJERAPOR` | Bir proje dosyasından Excel rapor (AutoCAD'de çizim açmadan). |
| Proje Özeti | `SH_OZET` | Bölge, eleman, hat, kanal sayıları. |

İpuçları:

- Pencerelerde liste üstündeki kutuya yazarak arayın (ör. `k2`, `alpek 50`). Çift tıklama seçer.
- Bir komut sürerken **Ayarlar** yazıp (ya da tıklayıp) seçimleri değiştirebilirsiniz.
- Çizim komutları son seçimlerinizi hatırlar.
- Her komut AutoCAD'in **U** (Geri Al) komutuyla tek seferde geri alınır.

---

## 5. Sık karşılaşılanlar

- **Telefonda konum haritaya oturmuyor**: proje için koordinat dilimi seçilmemiş ya da yanlış. Proje ana
  ekranındaki uyarıdan **Seç**.
- **AutoCAD'de “dilim uyuşmuyor” uyarısı**: telefondaki projenin dilimi ile çizim ayarındaki dilim farklı.
  Koordinatlar kayar; doğru dilimi `SH_AYARLAR`'dan girin.
- **“Bu proje bu çizimden alınmamış görünüyor”**: telefondaki proje başka bir çizimden gelmiş. Devam
  ederseniz telefondaki nesneler yeni olarak eklenir; var olanlar değişmez.
- **Şerit sekmesi kayboldu**: komut satırına `SH_SERIT`.
- **Bir hata oldu**: ayrıntı `%TEMP%\SebekeHakedis_hata.txt` dosyasına yazılır. Destek için `SH_DOKUM`
  çizimin teknik dökümünü kaydeder.
