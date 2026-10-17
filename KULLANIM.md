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
  **"İleride" durumundaki objeler AutoCAD dosyasına yazılmaz.**
- **Hat**: başlangıç ve bitiş direğine dokunun; iletken / kablo tipini seçin. Yeraltında kaplama (toprak, tüvenan,
  asfalt, beton, parke) ve yöntem (açık kazı, borulu geçiş, yatay sondaj) AutoCAD'de kanal / sondaj nesnesi olur.
- **Malzeme**: objeye dokunun › **Malzeme ekle** (katalogdan). AutoCAD'den gelen malzemeler aynen korunur.
- **Dışa Aktar**: "AutoCAD proje dosyası" varsayılan seçilidir; "Telefon proje dosyası" tam yedektir.
- **AutoCAD dosyasını bu projeye al** (Proje merkezi): AutoCAD'de yapılan değişiklikleri açık projeye alır;
  aynı nesneler güncellenir, yenileri eklenir.

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
| Nokta Al | `SH_NOKTAAL` | Ölçü noktalarını dosyadan alır (telefonun "Noktalar (CSV)" çıktısı ya da Ad, Y, X, Z, Kod dosyası). Çizimde olan noktalar atlanır. |
| Malzeme | `SH_MALZEME` | Direği, hattı, kanalı ya da sondajı seçin: malzemeleri tablo hâlinde düzenleyin, katalogdan ekleyin. |
| Metraj | `SH_METRAJ` | Uçlarını çektiğiniz hatların, kanalların metrajını çizim uzunluğundan yeniden hesaplar (önce listeyi gösterip sorar). |
| Hakediş | `SH_HAKEDIS` | Aktif hakediş: yeni çizilenler bu hakedişin katmanlarına (`SC_3.HAK.…`) konur. |
| Ayarlar | `SH_AYARLAR` | Katman/GIS ön eki, koordinat dilimi, sembol ölçeği, etiket yüksekliği, direğe yakalama mesafesi, metraj yuvarlama ve ek paylar, kanal varsayılanları. Ayarlar çizimin içinde saklanır. |
| Telefondan Al | `SH_PROJEAL` | Bölüm 2. Üç dosya türü açılır: `.sebeke.json`, `.volt.json`, teslim paketi `.zip`. |
| Telefona Gönder | `SH_ICEAL` | Bölüm 2. `.sebeke.json` (varsayılan) ya da `.volt.json` olarak kaydeder. |
| Durum Tespit | `SH_RAPOR` | Bu çizimden Excel rapor. |
| Dosyadan Rapor | `SH_PROJERAPOR` | Bir proje dosyasından Excel rapor (AutoCAD'de çizim açmadan; telefon dosyaları da olur). |
| Proje Özeti | `SH_OZET` | Bölge, eleman, hat, kanal sayıları. |

Simgeler: çizimde PROMAGIS bloğu varsa (o tür ve durumda) o kullanılır; yoksa eklentinin lejant simgesi gelir.
Beton / ağaç direk daire, demir direk kare; OG, müşterek ve ENH direklerinde topraklama işareti; trafo direği üçgen,
bina kare, köşk ev; SDK dikdörtgen, pano içinde yıldırım. Yeni = dolu, mevcut = boş, sök-tak = yarım dolu,
demontaj = boş + çapraz çizgi. Ölçek ve etiket yüksekliği **Ayarlar**'dan değişir.

İpuçları:

- Pencerelerde liste üstündeki kutuya yazarak arayın (ör. `k2`, `alpek 50`). Çift tıklama seçer.
- Bir komut sürerken **Ayarlar** yazıp (ya da tıklayıp) seçimleri değiştirebilirsiniz.
- Çizim komutları son seçimlerinizi hatırlar.
- Her komut AutoCAD'in **U** (Geri Al) komutuyla tek seferde geri alınır.

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
- **Şerit sekmesi kayboldu**: komut satırına `SH_SERIT`.
- **Bir hata oldu**: ayrıntı `%TEMP%\SebekeHakedis_hata.txt` dosyasına yazılır. Destek için `SH_DOKUM`
  çizimin teknik dökümünü kaydeder.
