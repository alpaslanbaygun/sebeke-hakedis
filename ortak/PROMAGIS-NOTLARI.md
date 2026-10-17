# PROMAGIS incelemesi — neyi nasıl yapıyor, bizde ne var, ne alınabilir

17.10.2026'da PROMAGIS'in kurulum dosyaları (menü `PROMAGIS.cuix`, VBA projesi `Promagis2021.dvb`,
veri dosyası `promagis2021.bin`, `PROMAGIS.mnr`) incelendi. Dosyaların kendisi depoya **konmaz** (üçüncü taraf
yazılım); burada yalnız uyumluluk için gereken bilgi ve çıkarılan dersler tutulur. Kod kopyalanmadı.

## 1. PROMAGIS nasıl kurulu çalışıyor

- **AutoCAD VBA** (`.dvb`, 41 modül, ~19 bin satır) + bir `.cuix` menüsü. Komutlar AutoLISP `defun` ile tanımlanıp
  VBA'ya yönlendirilir (`HH` hat çiz, `DD` direk ekle, `TT` trafo ekle, `K` kanal, `SD` yatay sondaj, `BL` bölge,
  `BB` bilgi al, `R` rapor, `TAR` tarife/hakediş ayarları, `KT` katman oluştur, `EK` ek mufu, `BF` birim fiyat,
  `PP` proje araçları (ABONE, BOLGE_AYIRICI, KAPAK blokları), `YY`/`YS` etiket yerleştir, `KY`/`SY` kanal/sondaj
  etiketlerini yenile, `ON` onay, `TXS` yazı ölçeği, `BSC` blok ölçekle).
- **Katalog = Excel.** `promagis2021.bin`, her baytı 1 ile XOR'lanmış bir `.xlsx`'tir. PROMAGIS bunu Excel'de
  (parola ile) açar ve adlandırılmış aralıklardan (ör. `AG_DEMİR_GLV`, `KABLO_KANALI`) listeleri çeker. Yani
  PROMAGIS'in çalışması için bilgisayarda **Excel kurulu olmalı**; birim fiyatlar bu dosyaya girilir (`BF`).
- **Rapor da Excel'le** üretilir (COM). Bizde ise katalog JSON olarak gömülü, rapor `.xlsx` doğrudan yazılır;
  telefon için de bu şart.
- Proje kodları (EK-3 projeleri) 2021 sürümünde şirketin **merkezi SQL Server**'ından çekiliyor
  (`TAR` ve bölge formu). Bizim için karşılığı: proje dosyasındaki `bolgeler[].kod` ve ileride bulut eşitleme.
- Lisans: bilgisayar diskinin seri numarasına bağlı kayıt (`REGISTER`, `LisansAktif`). Bizde yok, gerekmez.

## 2. Veri modeli (çizimdeki XDATA) — doğrulandı

Ayırıcı `;`. Alan sıraları VBA'daki `Enum`lardan alındı (`Mix` modülü).

| Uygulama | Nerede | Alanlar (sırayla) |
| --- | --- | --- |
| `GIS` | blok | SIRA_NO (= tanıtıcı), GIS_ID, cins, tip, durum[, güç, gerilim] (güç/gerilim yalnız TR, BOX, PANO) |
| `GIS` | kanal | baş, bit, uzunluk, derinlik, alt genişlik, üst genişlik (cm) |
| `GIS` | sondaj | baş, bit, miktar |
| `NIT` | blok / kanal / sondaj | cins, tip, durum, birim fiyat, miktar, ölçüt, metrik ağırlık, toplam miktar, toplam tutar, hakediş no, tarife (4 hane), **KESİK/SÖKÜK** (yalnız DM), sıra (INDEX) |
| `MALZEME` | blok (çok satır) | cins, tip, durum, birim fiyat, miktar, ölçüt, metrik ağırlık, toplam miktar, toplam tutar, hakediş no, tarife, sıra, kontrol |
| `HAT` | hat | hat cinsi, AG kesit, OG kesit, durum, birim fiyat, miktar, ölçüt, metrik ağırlık, toplam miktar, toplam tutar, hakediş no, tarife, sıra, kontrol |
| `ANAKESIT` | hat | kataloğun "KABLO KESİT" sütunu (ör. 3x70+35) |
| `FULLREG` | bölge çoklu çizgisi | bölge adı, proje kodu (tarife, ör. `24.38.01..05`), grup kodu |
| `REG` | nesne | ait olduğu bölge çoklu çizgisinin tanıtıcısı (bölge formunda **UYGULA** ile poligon içindeki her nesneye yazılır) |
| `KONTROL` | nesne | `True`/`False` — denetlendi işareti |
| `HANDLE` | blok | ilk tanıtıcı (kopyalanan bloğu yakalamak için; SIRA_NO ≠ tanıtıcı ise kontrol sıfırlanır) |
| `ETK`, `UZUNLUK`, `START`, `END`, `UZ`, `BOYUT` | hat/kanal/sondaj | etiket ve ölçü yazılarının tanıtıcıları |
| `ANA`, `CON` (8 satır) | pano | ana TMS;sayaç no — çıkış adı;TMS;NH;kesit1..4 (pano çıkış şeması, öznitelik `C_1..C_8`) |
| `FIDER` (7 satır) | bina tipi TR | hücre/fider çıkışları |
| `HAKNO`, `ZKOORD` | GPS noktası | hakediş no, kot |

Kanalın `NIT` cinsi bir bit maskesidir: OG 8, AG 4, AYD 2, REK 1 (bizdeki `kanalKodu` ile aynı).
Kanal hacmi: `((alt + üst) / 2 × derinlik × uzunluk) / 10000` (cm → m³). Standart kanal ölçüleri (alt × üst × derinlik):
20×20×50, 20×20×70, 40×40×60/80/100, 60×60×60/80/100/120, 80×80×60/80/100/120, 90×90×60/80/100/120.

Çizim sözlüğündeki ayarlar (Named Objects Dictionary): `HakNo_Dic/HakNo_Rec` (aktif hakediş 1–12),
`Tarife_Dic/Tarife_Rec` (yatırım grup kodu), `AYARLAR`: `SAYAC` (sıra numarası sayacı), `TXSCALE` (yazı
yüksekliği ×10), `KONTROL` (denetim kipi), `HAK_YETKİ` (hangi hakedişlere yazılabilir, 12 bayrak), `DOSYA_NO`,
`SMIKMU` (1 şehir / 2 köy — unsur sütunu seçimi), `KRTNALINACAK` (karakteristik katalogdan mı); `DicBölge/RecBölge`
(bölge tanıtıcıları listesi); `HAK_ONAY/ONAY_DURUM1..12` (onay bitleri: kontrol 4, hakediş 2, GIS 1);
`KEY` (onay parolaları).

## 3. Durum kodları (açık soru kapandı)

| Kod | Anlamı (PROMAGIS Sayfa1) | Fiyat sütunu |
| --- | --- | --- |
| `M+M` | malzeme + montaj (yüklenici) | M+M |
| `M` | yalnız montaj (malzeme kurumdan) | MON. |
| `KM` | kurumun montaj ettiği fakat **malzeme olarak yükleniciye çıkılan** | MALZEME |
| `DM+M` | demontaj + montaj (taşınan) | DM+M |
| `DM` | demontaj (KESİK / SÖKÜK seçilir) | DM |
| `ENH` | kilometrik bedelli işler (ENH) | — |
| `ME` | mutabakat eksikleri | — |
| `MEVCUT` | mevcut, fiyat 0 | — |

Hat etiketi: `* tip` (M+M), `^ tip` (M), `[tip]` (DM+M), `>tip<` (DM), `/tip\` (KM), `{tip}` (ENH), `(tip)` (MEVCUT);
ardından `/uzunluk m/(tanıtıcı)`. `KONTROL`: denetçi işaretler; işaretli öge, çizimin `AYARLAR/KONTROL` kipi
kapalıyken değiştirilemez ("BU ÖGE DENETLENMİŞ").

Blok adına göre izin verilen durumlar: `YENİ_*` → M+M, M, KM, ENH, DM+M, ME; `MEVCUT_*` → MEVCUT;
`DEMONTAJ_*` → DM (+ KESİK/SÖKÜK); `EK_MUFU`, `KOFRE` → M+M, M, KM. Direk tipi trafo ve BOX'ta güç ≤ 400 kVA.

## 4. Tarife ve kodlar

- Tarife = **karakteristik (2 hane) + unsur (2 hane)**, ör. `0107`. Karakteristikler: 01 Şebeke yatırımları,
  02 Yasal zorunluluğu olan, 03 Şebeke işletim sistemi, 04 Ar-Ge, 05 Yatırım harcaması niteliğindeki diğer,
  11 Şebeke yatırımları (fiyata dahiller). Unsurlar: 01 Trafo ekipman OG, 02 Trafo ekipman AG, 03 ENH,
  04 Şehir yeraltı OG, 05 Şehir yeraltı AG, 06 Şehir havai OG, 07 Şehir havai AG, 08 Aydınlatma,
  09 Rekortman havai, 10 Rekortman yeraltı, 11 Bağlantı hattı AG, 12 Bağlantı hattı OG, 13 Diğer, 14 Sayaç,
  15 Bakım-1-2, 16 Bakım-3.
- Her katalog kaleminin standart karakteristiği ve unsuru vardır (şehir / köy sütunları; incelenen dosyada "köy"
  sütunu bakım tarifesi 15/16 olarak kullanılmış). `SMIKMU` ayarı hangi sütunun geleceğini seçer.
- Proje (bölge) kodu: `YIL.İL.GRUP..PROJE` (ör. `24.38.01..05`); grup kodlarının harf karşılığı var (01 A, 02 B …).
- Katman adı: `<ön ek><hakediş>.HAK.<tür>`; ön ek = **çizim dosyası adının ilk alt çizgiye kadarki kısmı** (ör. `SC_`),
  yıl = dosya adının 4–5. karakterleri. Türler: AG_HAV_HAT, AG_YER_HAT, AGDİR, AYD_HAT, AYDDİR, BOX, ENHDİR, MÜŞDİR,
  MÜŞTEREK_HAT, OG_HAV_HAT, OG_YER_XLPE, PANO, REKORTMAN, TRAFO; standart katmanlar `<ön ek>DEMONTAJ`, `KABLO_KANALI`,
  `MEVCUT`, `STANDART`, `PROJE`, `YATAY_SONDAJ`, `GPS`, `HANDLE`.
- Katman renkleri (RGB) ve kalınlıkları `KT` komutunda sabittir: AG_HAV_HAT 0,255,0 (0.35); AG_YER_HAT 0,255,0
  (0.30, HIDDENX2); AGDİR 63,0,255; AYD_HAT 0,0,255 (0.30, HIDDENX2); AYDDİR 0,191,255; BOX 191,255,127; ENHDİR 255,0,63;
  MÜŞDİR 223,127,255; MÜŞTEREK_HAT 255,0,255 (0.30); OG_HAV_HAT 255,0,0 (0.25); OG_YER_XLPE 255,0,0 (0.30, HIDDENX2);
  PANO 255,127,159; REKORTMAN 0,191,255 (0.25, HIDDENX2); TRAFO 255,0,0; DEMONTAJ 128,128,128 (0.20, HIDDENX2);
  KABLO_KANALI 142,241,233; MEVCUT 165,165,0 (0.20); STANDART 255,255,255; PROJE 255,255,0 (HIDDENX2);
  YATAY_SONDAJ 255,223,127; GPS 0,255,255; HANDLE 233,96,32. Özel renkler: TOP_İLETKEN hattı 252,198,138;
  DM+M hat 165,82,165; bölge çoklu çizgisi 100,198,138.

## 5. Katalog (malzeme listesi)

- Ana liste: **2 982 tip, 93 cins**; sütunlar: cins, tip, POZ NO (TEDAŞ pozu, 2 325 satırda dolu), temini,
  önem sırası, metrik ağırlık (kg/ad, kg/m …), birim fiyatlar (malzeme, M+M, montaj, DM+M, DM — dağıtılan dosyada 0,
  kullanıcı girer), kablo kesit, güç, miktar ölçüsü (`ad/kg`, `mt/mt`, `mt/m³`, `ad/ad`, `kg/kg`, `tk/tk`, `m²/m²`,
  `tl/tl`, `mt/km`), toplam ölçüsü, standart karakteristik, unsur (şehir), unsur (köy/bakım).
- Bizim `ortak/katalog/kalemler.json` (244 kalem) bu listenin bir çizimde geçen alt kümesidir (241/244 birebir).
- İletken açılımları ve kg/m değerleri (ROSE 0.05915, PANSY 0.11832, ASTER 0.18765, OXLIP 0.29886; SWALLOW 0.10996,
  RAVEN 0.22052, PIGEON 0.35078, PARTRIDGE 0.55468, HAWK 0.99226) bizdeki `katsayilar.json` ile aynı.
- Nesne türü → cins listeleri (`ANA_MALZEMELER`): AG_DİREK: AG_AĞAÇ, AG_BETON, AG_DEMİR, AG_DEMİR_GLV ·
  MÜŞ_DİREK: MÜŞ_BETON, MÜŞ_DEMİR, MÜŞ_DEMİR_GLV · ENH_DİREK: ENH_BETON, ENH_DEMİR, ENH_DEMİR_GLV, ENH_GLV_CVT ·
  BOX: BOX_PANO · AYD_DİREK: AYD_GLV_PLG, AYD_BETON · DİREK_TR: TR_DİREK, TR_DİREK_GLV · BİNA_TR: TRAFO_BİNASI,
  BETON_KÖŞKLER · AG_PANO: AG_PANO_DT, AG_PANO_HT · HAT_CINS: AG_ALİMİNYUM_KABLO, AG_BAKIR_KABLO, AG_İLETKEN,
  ALPEK_KABLOLAR, AYDINLATMA_KABLO, OG_ALİMİNYUM_KABLO, OG_BAKIR_KABLO, OG_İLETKEN, REKORTMAN_ALİMİNYUM,
  REKORTMAN_BAKIR, TOP_İLETKEN · KOFRELER: KOFRA · EK_MUFU: EK_MUFU_AG_ALM, EK_MUFU_AG_BAKIR, EK_MUFU_OG_ALM,
  EK_MUFU_OG_BAKIR · YATAY_İŞLER: GALVANİZLİ_KABLO_TAVASI, YATAY_DELGİ, KABLO_MUHAFAZA_BORULARI.
- Hat cinsine göre katman türü: AG_İLETKEN, ALPEK, KİLOMETRİK_BAKIM → AG_HAV; AG kablolar ve TOP_İLETKEN → AG_YER;
  OG_İLETKEN → OG_HAV; OG kablolar → OG_YER; REKORTMAN → REKORTM; AYDINLATMA_KABLO → AYD_HAT; MÜŞTEREK → MÜŞTEREK_HAT.

## 6. PROMAGIS'te miktarlar nasıl girilir (bizden farkı)

- **Hat uzunluğu PROMAGIS'te elle girilir** (çizim uzunluğu yalnız bilgi olarak gösterilir); toplam = miktar ×
  metrik ağırlık. Bizde uzunluk geometriden hesaplanır (tam metreye yukarı yuvarlanır) ve telefonda ölçüm vardır.
- Kanal uzunluğu da elle girilir; hacim yukarıdaki formülle.
- Direk/trafo/pano: nesnenin kendi pozu (NIT) miktar 1 × metrik ağırlık; bağlı malzemeler (MALZEME) tek tek eklenir.
  Rapor ekranından **toplu malzeme ekleme** (seçilen tüm direklere aynı malzeme) ve **toplu güncelleme** vardır.
- Sıra numarası (INDEX) çizimdeki `AYARLAR/SAYAC` sayacından verilir; kayıtlar bu numarayla bulunur/silinir.

## 7. Onay akışı

Her hakediş numarası için üç aşamalı onay: **KONTROL → HAKEDİŞ → GIS**; her aşama parolalıdır ve işaret çizimde
saklanır (`HAK_ONAY/ONAY_DURUM<n>`, bitler 4/2/1). Denetlenmiş (`KONTROL=True`) öğeler denetim kipi kapalıyken
değiştirilemez; hakediş yetkisi olmayan numaradaki kayıtlar da kilitlidir (`HAK_YETKİ`).

## 8. Bizde olan / olmayan — özet

| Konu | PROMAGIS | Bizde |
| --- | --- | --- |
| Çizimden okuma/yazma (XDATA, katman, blok) | — | var (aynı biçim) |
| Katalog | 2 982 tip, Excel | 244 kalem (JSON); genişletilebilir |
| Durumlar | M+M, M, KM, ENH, DM+M, DM, ME, MEVCUT | M+M, M, DM+M, DM, MEVCUT; KM/ME/ENH yalnız okunur |
| DM'de KESİK/SÖKÜK | var | alan okunup yazılır, telefonda seçim yok |
| Tarife | katalogdan karakteristik+unsur, şehir/köy anahtarı | kalemde tek tarife |
| Katman stili | RGB + kalınlık + HIDDENX2 | yaklaşık ACI renk |
| Hat uzunluğu | elle | geometri / telefon ölçümü |
| Pano çıkış şeması (`ANA`, `CON`), hücre (`FIDER`) | var | yok |
| Onay akışı, denetim kilidi | var | yok |
| Rapor | Excel (COM) | kendi `.xlsx` yazıcısı |
| Proje kodları | merkezi SQL Server | dosyadaki bölgeler |
| Lisans/kayıt | disk seri no | yok |
