# Hesap araçlarının kaynak kopyalarındaki değişiklikler

Araçlar bir elektrik-elektronik mühendisinin hazırladığı HTML dosyalarıdır; formüller, tablolar ve hesap kodları
değiştirilmemiştir. Depodaki kopyalarda yalnız gerçek proje verisi / yer adı içeren örnekler, kayıt artıkları,
internetten yazı tipi istekleri ve kişisel bilgiler (yazar adı ve imzası, kişi adları; KVKK, 31.10.2026)
çıkarılmıştır. Köprü, tema ve uyarlama derlemede (araclar/hesap-paketle.mjs) eklenir; bu dosyalara yazılmaz.

| Hesap | Özgün dosya (sha256 ilk 16) | Depodaki kopya | Değişiklik |
|---|---|---|---|
| enh-sehim | `52e8449d09c08275` | `62153d550ce2a100` | (1) Kullanılmayan örnek işlev _demo2 (gerçek bir projenin adı, direk tipleri ve açıklıkları) çıkarıldı. (2) Yazar adı ve imzası çıkarıldı: başlıktaki rozet, "projeyi yapan" alanlarının varsayılan adı, eski adları yazarın adıyla değiştiren liste (boş bırakıldı); baskı başlığına yazarın adı yerine "projeyi yapan" alanındaki ad ve unvan yazılır. |
| uplift | `1a35ad39f7f902d0` | `ac47d3e4e0dff255` | (1) Proje adı örneğindeki yer adı genelleştirildi. (2) Hat/iş no örneğindeki iş numarası çıkarıldı. (3) Yazar adı ve imzası çıkarıldı (başlıktaki rozet, baskı başlığındaki imza). |
| enh-agaw | `71d7401c2ecb7110` | `a21e0a8795bfa3b5` | (1) Yazar adı ve imzası çıkarıldı: başlıktaki rozet; "Hazırlayan" alanının varsayılanı boş. |
| amax | `fcf601c541756ad4` | `7f4cb8d8f642437c` | (1) Önceki bir kayıttan kalan gömülü durum (window.__AMAX_KAYIT) çıkarıldı; açılış değerleri aracın kendi varsayılanları. (2) #ilet seçim kutusundaki kayıttan kalan yinelenmiş seçenekler çıkarıldı (araç seçenekleri açılışta kendisi ekler). (3) Yazar imzası ("Hazırlayan") çıkarıldı. |
| kopma | `b673323239f792e5` | `a738fd72cb4cd4f1` | (1) Yazar adı, unvanı ve şehri (başlık) ile alt satırdaki yöntem sahibinin adı çıkarıldı. |
| og-gd | `48a2c20657fcb26b` | `ab9fd7c565d0a745` | (1) Merkez adı örneği genelleştirildi. (2) Açılışta yüklenen gerçek fider çalışması örneği (GD22: 9 dağıtım merkezi) çıkarıldı; tablo tek boş segmentle açılır. (3) Yazar imzası ("Hazırlayan": baştaki not ve başlık) çıkarıldı. |
| ag-gd | `2c60c8a93ca1a631` | `b34d65254795efac` | (1) İnternetten yazı tipi isteği (@import, Google Fonts) çıkarıldı: bağlantı yokken sayfayı ve hesabı bekletiyordu. Yazı tipleri Şebeke-M temasından gelir. (2) Yazar imzası ("Hazırlayan") çıkarıldı. |
| cu-al | `c3aed8afa637604c` | `c3aed8afa637604c` | Değişiklik yok (birebir aynı). |
| og-kd | `70518c7625bc96a0` | `4c4894417c3dec61` | (1) TM adının varsayılan değeri (bir il adı) "TM" yapıldı. (2) Yazar imzası ("Hazırlayan") çıkarıldı. |
| ag-kd | `f084a25ffcf64aa8` | `5f809df6a0aabf41` | (1) Proje adı örneğindeki yer adı genelleştirildi. (2) Trafo adı örneği genelleştirildi. (3) Yazar imzası ("Hazırlayan") çıkarıldı. |
| tepe-tedas | `9658f650d3c3ba89` | `9658f650d3c3ba89` | Değişiklik yok (birebir aynı). |
| tepe-vektor | `4e6bda12ac1d57ba` | `2cbef67b1f0edf0e` | (1) İnternetten yazı tipi bağlantısı (Google Fonts) çıkarıldı: bağlantı yokken sayfayı bekletiyordu. Yazı tipleri Şebeke-M temasından gelir. (2) Trafo adı örneğindeki yer adı genelleştirildi. (3) Yazar imzası ("Haz.") çıkarıldı. |
| kanal | `3250d778336c341a` | `8337e1e40d8b792a` | (1) Yazar imzası ("Hazırlayan") çıkarıldı. |
| kosk | `7d1f82d5f637e0b9` | `b86bb868afe490a5` | (1) Varsayılan proje adı (bir yer adı) "ÖRNEK DM" yapıldı. (2) Fider adı örneğindeki yer adı genelleştirildi. |

Özgün dosyalar depoya konmaz (gerçek proje örnekleri içerir); sahibinin onayıyla yalnız bu kopyalar kullanılır.
Kopya üretimi tek bir betikle yapılmıştır (her değişiklik tam olarak bir yerde eşleşmelidir; eşleşmezse betik durur).
