# Hesap araçlarının kaynak kopyalarındaki değişiklikler

Araçlar Elektrik-Elektronik Mühendisi Baki SONAY'ın HTML dosyalarıdır; formüller, tablolar ve hesap kodları
değiştirilmemiştir. Depodaki kopyalarda yalnız gerçek proje verisi / yer adı içeren örnekler, kayıt artıkları ve
internetten yazı tipi istekleri çıkarılmıştır. Köprü, tema ve uyarlama derlemede (araclar/hesap-paketle.mjs)
eklenir; bu dosyalara yazılmaz.

| Hesap | Özgün dosya (sha256 ilk 16) | Depodaki kopya | Değişiklik |
|---|---|---|---|
| enh-sehim | `52e8449d09c08275` | `725ebf6137642178` | (1) Kullanılmayan örnek işlev _demo2 (gerçek bir projenin adı, direk tipleri ve açıklıkları) çıkarıldı. |
| uplift | `1a35ad39f7f902d0` | `9df55d9ddc2ce230` | (1) Proje adı örneğindeki yer adı genelleştirildi. (2) Hat/iş no örneğindeki iş numarası çıkarıldı. |
| enh-agaw | `71d7401c2ecb7110` | `71d7401c2ecb7110` | Değişiklik yok (birebir aynı). |
| amax | `fcf601c541756ad4` | `8efca98298c16923` | (1) Önceki bir kayıttan kalan gömülü durum (window.__AMAX_KAYIT) çıkarıldı; açılış değerleri aracın kendi varsayılanları. (2) #ilet seçim kutusundaki kayıttan kalan yinelenmiş seçenekler çıkarıldı (araç seçenekleri açılışta kendisi ekler). |
| kopma | `b673323239f792e5` | `b673323239f792e5` | Değişiklik yok (birebir aynı). |
| og-gd | `48a2c20657fcb26b` | `bcda9daa034c38a9` | (1) Merkez adı örneği genelleştirildi. (2) Açılışta yüklenen gerçek fider çalışması örneği (GD22: 9 dağıtım merkezi) çıkarıldı; tablo tek boş segmentle açılır. |
| ag-gd | `2c60c8a93ca1a631` | `56330bcb692964a4` | (1) İnternetten yazı tipi isteği (@import, Google Fonts) çıkarıldı: bağlantı yokken sayfayı ve hesabı bekletiyordu. Yazı tipleri Şebeke-M temasından gelir. |
| cu-al | `c3aed8afa637604c` | `c3aed8afa637604c` | Değişiklik yok (birebir aynı). |
| og-kd | `70518c7625bc96a0` | `b53a6fce42236072` | (1) TM adının varsayılan değeri (bir il adı) "TM" yapıldı. |
| ag-kd | `f084a25ffcf64aa8` | `82e7dd2728d1952c` | (1) Proje adı örneğindeki yer adı genelleştirildi. (2) Trafo adı örneği genelleştirildi. |
| tepe-tedas | `9658f650d3c3ba89` | `9658f650d3c3ba89` | Değişiklik yok (birebir aynı). |
| tepe-vektor | `4e6bda12ac1d57ba` | `9da4a50f1b6c394f` | (1) İnternetten yazı tipi bağlantısı (Google Fonts) çıkarıldı: bağlantı yokken sayfayı bekletiyordu. Yazı tipleri Şebeke-M temasından gelir. (2) Trafo adı örneğindeki yer adı genelleştirildi. |
| kanal | `3250d778336c341a` | `3250d778336c341a` | Değişiklik yok (birebir aynı). |
| kosk | `7d1f82d5f637e0b9` | `b86bb868afe490a5` | (1) Varsayılan proje adı (bir yer adı) "ÖRNEK DM" yapıldı. (2) Fider adı örneğindeki yer adı genelleştirildi. |

Özgün dosyalar depoya konmaz (gerçek proje örnekleri içerir); sahibinin onayıyla yalnız bu kopyalar kullanılır.
Kopya üretimi tek bir betikle yapılmıştır (her değişiklik tam olarak bir yerde eşleşmelidir; eşleşmezse betik durur).
