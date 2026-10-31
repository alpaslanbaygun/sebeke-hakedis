# Eski program incelemesi — neyi nasıl yapıyor, bizde ne var, ne alınabilir

17.10.2026'da eski programın kurulum dosyaları (menü `menü dosyası (.cuix)`, VBA projesi `menü projesi (.dvb)`,
veri dosyası `katalog-veri.bin`, `menü kaynakları (.mnr)`) incelendi. Dosyaların kendisi depoya **konmaz** (üçüncü taraf
yazılım); burada yalnız uyumluluk için gereken bilgi ve çıkarılan dersler tutulur. Kod kopyalanmadı.

## 1. Eski program nasıl kurulu çalışıyor

- **AutoCAD VBA** (`.dvb`, 41 modül, ~19 bin satır) + bir `.cuix` menüsü. Komutlar AutoLISP `defun` ile tanımlanıp
  VBA'ya yönlendirilir (`HH` hat çiz, `DD` direk ekle, `TT` trafo ekle, `K` kanal, `SD` yatay sondaj, `BL` bölge,
  `BB` bilgi al, `R` rapor, `TAR` tarife/hakediş ayarları, `KT` katman oluştur, `EK` ek mufu, `BF` birim fiyat,
  `PP` proje araçları (ABONE, BOLGE_AYIRICI, KAPAK blokları), `YY`/`YS` etiket yerleştir, `KY`/`SY` kanal/sondaj
  etiketlerini yenile, `ON` onay, `TXS` yazı ölçeği, `BSC` blok ölçekle).
- **Katalog = Excel.** `katalog-veri.bin`, her baytı 1 ile XOR'lanmış bir `.xlsx`'tir. eski program bunu Excel'de
  (parola ile) açar ve adlandırılmış aralıklardan (ör. `AG_DEMİR_GLV`, `KABLO_KANALI`) listeleri çeker. Yani
  eski programın çalışması için bilgisayarda **Excel kurulu olmalı**; birim fiyatlar bu dosyaya girilir (`BF`).
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

| Kod | Anlamı (eski program Sayfa1) | Fiyat sütunu |
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
  Şebeke-M 31.10.2026'dan beri katman adlarını Türkçe karaktersiz yazar (AGDIR, MUSDIR, AYDDIR, ENHDIR,
  MUSTEREK_HAT; önek de); eski adları okur ve Telefon Görünümü'nde çevirir (`KatmanAdlari`).
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
  Şebeke-M bu kodlardaki yazım hatalarını düzeltilmiş yazar (AG_ALÜMİNYUM_KABLO, OG_ALÜMİNYUM_KABLO,
  REKORTMAN_ALÜMİNYUM, ALÜMİNYUM_BAĞ_TELİ, TEÇHİZAT_MONTAJ_DEMİRİ, KOFRE); eski kodları okurken çevirir (`CinsKodu`,
  katalogda `eskiCinsler`).
- Hat cinsine göre katman türü: AG_İLETKEN, ALPEK, KİLOMETRİK_BAKIM → AG_HAV; AG kablolar ve TOP_İLETKEN → AG_YER;
  OG_İLETKEN → OG_HAV; OG kablolar → OG_YER; REKORTMAN → REKORTM; AYDINLATMA_KABLO → AYD_HAT; MÜŞTEREK → MÜŞTEREK_HAT.

## 6. Eski programda miktarlar nasıl girilir (bizden farkı)

- **Hat uzunluğu eski programda elle girilir** (çizim uzunluğu yalnız bilgi olarak gösterilir); toplam = miktar ×
  metrik ağırlık. Bizde uzunluk geometriden hesaplanır (tam metreye yukarı yuvarlanır) ve telefonda ölçüm vardır.
- Kanal uzunluğu da elle girilir; hacim yukarıdaki formülle.
- Direk/trafo/pano: nesnenin kendi pozu (NIT) miktar 1 × metrik ağırlık; bağlı malzemeler (MALZEME) tek tek eklenir.
  Rapor ekranından **toplu malzeme ekleme** (seçilen tüm direklere aynı malzeme) ve **toplu güncelleme** vardır.
- Sıra numarası (INDEX) çizimdeki `AYARLAR/SAYAC` sayacından verilir; kayıtlar bu numarayla bulunur/silinir.

## 6a. Rapor modülü (`R` komutu)

- Rapor modülü **hesap yapmaz**: nesnelerin XDATA'sındaki hazır değerleri (miktar, metrik ağırlık, toplam, tutar,
  tarife) bölge / hakediş / durum süzgeciyle listeler ve boş bir `.xlsm`'e aktarır; gruplama, toplamlar, kanal
  paylaştırma, iletken tonajı ve pivot, AutoCAD `Support\pivot.bas` içindeki Excel makrolarıyla (KANAL_AYIR, OGTEL,
  AGTEL, PivotOluştur, METRAJ) yapılır. Bu makro dosyası elimizde yok; bizim Durum Tespit raporu, eski programın
  ürettiği rapor dosyasının KATSAYILAR sayfasından çıkarılan aynı tablolarla (`katsayilar.json`) hesaplar.
- Raporda yapılan tek hesap: hat / kanal / sondaj için `GIS UZ.` (çizim uzunluğu, 2 ondalık) ve `FARK` (girilen
  miktar − çizim uzunluğu). Bu sütun, elle girilen uzunlukla çizimi karşılaştırmak için — bizde de yararlı olur.
- Bölge → nesne eşlemesi, bölge çoklu çizgisinin köşeleriyle **crossing polygon** seçimidir (sınırı kesen nesne
  iki bölgede sayılabilir). Bizde nokta-poligon testi var.
- Excel sayfaları: DURUM TESPİT, ANA MALZEME, ARA MALZEME, HAT VE İLETKENLER, KANALLAR, SONDAJ, GPS, KATSAYILAR,
  METRAJ, SORGU, DETAY. Sütunlar: HANDLE, PROJE, SIRA, GIS ID, CİNS, TİP, DURUM, BİRM F., MİKTAR, BİRİM, METRİK A.,
  TOP. MİK., TOP. TL., HAK. NO, BÖL.TARİFE, MLZ.TARİFE, DM DRM, INDEX, KONTROL (hatta ek: GIS UZ., FARK; kanalda:
  BAŞ/BİT NO, ALT/ÜST G., DERİNLİK, UZUNLUK, HACİM). DURUM TESPİT sayfasında birim fiyat ve tutar sıfır yazılır.
- Rapor ekranındaki yardımcı işler: **SORGU** (cins/tip/durum/tarife/miktar süzgeci), **DETAY** (şu malzemeyi
  içeren / içermeyen direkler → eksik malzeme bulma), seçilenleri çizimde gösterme, **alana toplu malzeme ekleme**,
  tarife / durum / miktar toplu değiştirme, "Kontrol edildi" işaretleme, INDEX yeniden numaralama.
- Kusurlar: DURUM TESPİT'e kanal satırı eklenmez (yorumda); sondaj süzgeci yanlış alana bakar; hakediş listesi
  raporda 1–10, ayarlarda 1–12.

## 7. Onay akışı

Her hakediş numarası için üç aşamalı onay: **KONTROL → HAKEDİŞ → GIS**; her aşama parolalıdır ve işaret çizimde
saklanır (`HAK_ONAY/ONAY_DURUM<n>`, bitler 4/2/1). Denetlenmiş (`KONTROL=True`) öğeler denetim kipi kapalıyken
değiştirilemez; hakediş yetkisi olmayan numaradaki kayıtlar da kilitlidir (`HAK_YETKİ`).

## 8. Alınabilecekler (öneri listesi) — 18.10.2026 durumu

Hepsi yapıldı (`serit-ve-stil` dalı); ayrıntı KULLANIM.md › Bölüm 4 ve VERI-MODELI.md.

1. ✓ **Tam katalog**: 2 934 tip `kalemler.json`'da (cins, tip, poz no, metrik ağırlık, birimler, karakteristik +
   şehir / köy unsuru; fiyatsız). Telefon ve eklenti her eski program tipini seçebilir.
2. ✓ **Durum kodları**: `KM`, `ENH`, `ME` iki tarafta seçilir; hat etiketleri `/tip\` ve `{tip}`; DM'de KESİK / SÖKÜK.
3. ✓ **Tarife kuralı**: karakteristik + unsur ayrı; çizim ayarında şehir / köy-bakım anahtarı.
4. ✓ **Katman stilleri ve görünüm**: telefonun çizim stili (`cizim-stili.json`) iki tarafta aynı; eski program
   katman adları korunur.
5. ✓ **Sıra numarası**: yeni INDEX `AYARLAR/SAYAC`'tan devam eder, sayaç ilerletilir; aktif hakediş `HakNo_Rec`
   ile ortak. Telefon AutoCAD'den gelen kalemin INDEX'ini, hakedişini ve KONTROL'ünü korur.
6. ✓ **Bölge**: `FULLREG` üçüncü alanı (grup kodu) yazılır / okunur; bölgeler `DicBölge/RecBölge`'ye kaydedilir.
7. ✓ **FARK** sütunu (raporda vardı) ve **DETAY** (eksik malzeme bulma: `SH_DETAY`, raporda DETAY sayfası).
8. ✓ **Onay akışı**: `SH_ONAY` (`HAK_ONAY/ONAY_DURUM<n>`, Kontrol → Hakediş → GIS, parolasız). Hakediş onayı
   verilen hakediş eklentide kilitlidir (satır düzeyinde; kilitli nesneye açık hakedişte malzeme eklenebilir).
   Denetlenmiş (`KONTROL`) nesnede uyarı. Telefonda onaylanan dönem eklentiye onay olarak gelir.
   Yapılmayan: eski programın parolaları (`KEY`) ve `HAK_YETKİ` bayrakları (eklenti tek kullanıcılı; telefonda roller var).
9. ✓ Pano çıkış şeması (`ANA`/`CON`, öznitelik `C_1..C_8`) ve bina TR hücreleri (`FIDER`): okunur, telefonda ve
   dosyada taşınır, aynen geri yazılır. Düzenleme penceresi yok (ileride istenirse).

## 9. Bizde olan / olmayan — özet

| Konu | eski program | Bizde |
| --- | --- | --- |
| Çizimden okuma/yazma (XDATA, katman, blok) | — | var (aynı biçim) |
| Katalog | 2 982 tip, Excel | 2 934 tip (JSON, gömülü) |
| Durumlar | M+M, M, KM, ENH, DM+M, DM, ME, MEVCUT | aynı (iki tarafta seçilir) |
| DM'de KESİK/SÖKÜK | var | var (iki tarafta) |
| Tarife | katalogdan karakteristik+unsur, şehir/köy anahtarı | aynı |
| Katman stili | RGB + kalınlık + HIDDENX2 | telefonla ortak stil (ACI renk, çizgi tipleri) |
| Hat uzunluğu | elle | geometri / telefon ölçümü; direkten direğe parçalı |
| Sıra sayacı, aktif hakediş, bölge listesi | çizim sözlüğü | aynı kayıtlar okunur / yazılır |
| Pano çıkış şeması (`ANA`, `CON`), hücre (`FIDER`) | var | korunur (düzenleme yok) |
| Onay akışı, denetim kilidi | var (parolalı) | var (parolasız; satır düzeyinde kilit) |
| DETAY (eksik malzeme), FARK | var | var |
| Rapor | Excel (COM) | kendi `.xlsx` yazıcısı |
| Proje kodları | merkezi SQL Server | dosyadaki bölgeler |
| Lisans/kayıt | disk seri no | yok |
