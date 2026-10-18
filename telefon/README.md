# VOLT-EDAŞ Saha (telefon uygulaması)

EDAŞ şebeke işleri için Android saha uygulaması (GNSS ile direk, trafo, hat alımı; malzeme, keşif, metraj, hakediş)
ve ofis için web sürümü. 17.10.2026'dan beri **Şebeke Hakediş** deposunun telefon tarafıdır: AutoCAD eklentisiyle
aynı proje dosyasını (`.sebeke.json`) alır ve verir.

- Güncel sürüm: **2.5.x** (GitHub › Releases, `main` dalındaki her gönderimde derlenir). Önceki: 2.4.0 (6 Ekim 2026). Web sürümü 2.3.0.
- Kullanım kılavuzu: [docs/KULLANIM-KILAVUZU.md](docs/KULLANIM-KILAVUZU.md) · AutoCAD ile birlikte kullanım: [../KULLANIM.md](../KULLANIM.md)
- Kaynak, derleme, sürüm notları: [README_KAYNAK.txt](README_KAYNAK.txt)
- Eski depodan gelen devam notu (tarihçe, kararlar, açık işler): [DEVAM-NOTU.md](DEVAM-NOTU.md); güncel devir notu depo kökünde [../DEVIR.md](../DEVIR.md)
- Sürüm geçmişi (v2.1.0 … v2.4.0 etiketleri) bu deponun git geçmişindedir (alt ağaç birleştirmesi).

Bu depo özeldir; içinde APK imza anahtarı bulunur (`keystore/`). Herkese açık yapmayın.

## 2.5 ile gelenler (AutoCAD uyumu)

- **Projeler › AutoCAD dosyasından proje al** ve **Proje merkezi › AutoCAD dosyasını bu projeye al**:
  eklentinin yazdığı `.sebeke.json` (ya da telefonun `.volt.json`u) projeye alınır; direk tipleri ve hat tipleri
  telefon kataloğundan bulunur, bulunamayan malzemeler kataloğa `AUTOCAD:` koduyla eklenir (DOĞRULANACAK).
- **Dışa Aktar › AutoCAD proje dosyası (.sebeke.json)** ve **Telefon proje dosyası (.volt.json)**; teslim
  paketindeki `PROJECT_INFO/project.json` artık AutoCAD bölümünü de taşır.
- DXF çıktısındaki simgeler eklentiyle aynı ortak tablodan gelir (`SH_…` blokları, `../ortak/katalog/semboller.json`).
- Dönüşüm kuralları: `../ortak/VERI-MODELI.md` ("Telefon ↔ AutoCAD eşlemesi"), kod: `web/src/interop/sebeke.js`,
  testler: `web/tests/sebeke.test.mjs`.
