# Hesap araçlarının kaynak kopyalarındaki değişiklikler

Araçlar bir elektrik-elektronik mühendisinin hazırladığı HTML dosyalarıdır; formüller, tablolar ve hesap kodları
değiştirilmemiştir. Depodaki kopyalarda yalnız gerçek proje verisi / yer adı içeren örnekler, kayıt artıkları,
internetten yazı tipi istekleri ve kişisel bilgiler (yazar adı ve imzası, kişi adları; KVKK, 31.10.2026)
çıkarılmıştır. Köprü, tema ve uyarlama derlemede (araclar/hesap-paketle.mjs) eklenir; bu dosyalara yazılmaz.

| Hesap | Özgün dosya (sha256 ilk 16) | Depodaki kopya | Değişiklik |
|---|---|---|---|
| tepe-vektor | `4e6bda12ac1d57ba` | `2cbef67b1f0edf0e` | (1) İnternetten yazı tipi bağlantısı (Google Fonts) çıkarıldı: bağlantı yokken sayfayı bekletiyordu. Yazı tipleri Şebeke-M temasından gelir. (2) Trafo adı örneğindeki yer adı genelleştirildi. (3) Yazar imzası ("Haz.") çıkarıldı. |
| kanal | `3250d778336c341a` | `8337e1e40d8b792a` | (1) Yazar imzası ("Hazırlayan") çıkarıldı. |

1.11.2026: kullanıcı isteğiyle yalnız iki hesap kaldı (tepe-vektor, kanal); ötekilerin kopyaları (enh-sehim, uplift,
enh-agaw, amax, kopma, tepe-tedas, og-gd, ag-gd, og-kd, ag-kd, cu-al, kosk, ag-tekhat) depodan silindi. Gerekirse
`git log -- ortak/hesap/kaynak` ile geçmişten geri alınır (o günkü değişiklik tablosu da orada).

Özgün dosyalar depoya konmaz (gerçek proje örnekleri içerir); sahibinin onayıyla yalnız bu kopyalar kullanılır.
Kopya üretimi tek bir betikle yapılmıştır (her değişiklik tam olarak bir yerde eşleşmelidir; eşleşmezse betik durur).
