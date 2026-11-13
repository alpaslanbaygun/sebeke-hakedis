# Birleşik Metraj şablonunun doldurulması

Kullanıcının **Birleşik Metraj** Excel şablonu (`.xlsm`; DİREK METRAJI, YERALTI METRAJI, İLETKEN METRAJI, MALZ. LİSTESİ,
KATSAYILAR sayfaları) proje (bölge) bazında programdan doldurulur. Kural iki platformda aynıdır:

| | AutoCAD eklentisi | Telefon |
|---|---|---|
| Şablonu okuma, hücre yazma, sütun ekleme (zip içinde sayfa XML'i) | `Cekirdek/XlsmDosyasi.cs` | `telefon/web/src/export/xlsm.js` |
| Şablon tanımı (tanımlı adlar, KOD sütunları, sabit sütunlar, MALZ. LİSTESİ örnek satırları, listeler) | `Cekirdek/BirlesikMetraj.cs › MetrajSablonu.Oku` | `export/birlesik-metraj.js › sablonTanimi` |
| Doldurma planı (proje + şablon tanımı → hücreler, kopya sayfalar, yeni sütunlar, MALZ. LİSTESİ satırları, uyarılar) | `Cekirdek/BirlesikMetraj.cs › Planla` | `sh-core.cjs › birlesikMetraj` |
| Planı dosyaya işleme (sayfa kopyalama, biçim ve formül kopyalama, satır gizleme, fazla sayfası) | `Cekirdek/BirlesikMetraj.cs › PlanUygula` | `export/birlesik-metraj.js › planUygula` |
| Ad eşleme tablosu ve temin varsayılanları | `ortak/katalog/metraj-sablon.json` (eklentide gömülü, telefonda `src/ortak/metraj-sablon.js`) | |
| Gömülü temiz şablon | `ortak/sablon/birlesik-metraj.xlsm` (eklentide gömülü kaynak, telefonda `telefon/web/assets/`; `araclar/ortak-tablolar.mjs` kopyalar) | |
| Ortak deneme | `ortak/deneme/birlesik-metraj/` — aynı şablondan aynı tanım, aynı projeden aynı plan (`CekirdekTest › BirlesikMetrajOrtakDeneme`, `tests/birlesik-metraj.test.mjs`) | |
| Beklenen dosyaları üretme | `araclar/metraj-beklenen-uret.mjs` (kural değişince çalıştırılır; eklenti aynı çıktıyı vermek zorundadır) | |
| Şablon temizleme (kullanıcının dosyasından gömülü kopya) | `araclar/metraj-sablon-temizle.mjs` | |
| Arayüz | Proje Özeti › **Birleşik Metraj…** (`Pencereler.BirlesikMetrajSor / BirlesikMetrajSonuc`, `Komutlar.BirlesikMetrajUret`) | Dışa Aktarım › **Birleşik Metraj** (`exporter.js › birlesikMetrajDosyasi`, `screens/export.js › MetrajAyarlari`) |

Kullanıcının gönderdiği dosya gerçek proje verisi içerir; depoya konmaz. Temiz şablon, temizleme aracının çıktısıdır:
proje başlığı (C3:C10) ve veri satırları silinir, formüllerin önbellek değerleri (eski projeden kalan sayılar) atılır,
yalnız kullanılan paylaşılan dizeler kalır (firma / yer adları düşer), notlardaki yazar adı, belge özelliklerindeki
kişi adı, bilgisayar yolu (`absPath`) ve Office eklenti kaydı kaldırılır; makro (sütun gizle / göster), formüller,
listeler, biçimler ve açıklama notları kalır. Araç çıktıyı yeniden açıp doğrular. Kullanıcı isterse kendi (güncel)
şablon dosyasını gösterir; kurallar aynıdır, yapı dosyadan okunur.

## Şablonun yapısı (dosyadan okunur)

Tanımlı adlar yapının çapasıdır; sütun ve satır konumları bunlardan ve başlık yazılarından çıkarılır, sabit varsayılmaz:

- `DM_KOD_SATIRI = 'DİREK METRAJI'!$G$10:$ZZ$10` → sayfa adı, ilk KOD sütunu (G), KOD satırı (10). Aynı biçimde
  `DM_TIP_SATIRI` (11), `DM_POZ_SATIRI` (14), `DM_AD_SATIRI` (15), `DM_SEC_SATIRI` (16, temin Ş / Y ya da demontaj
  şekli Kesik / Sökük), `DM_BIRIM_SATIRI` (17), `DM_TOPLAM_SATIRI` (316). Veri satırları: BİRİM satırının altından
  TOPLAM satırının üstüne (18–315). Bayrak satırları (sütun gizle makrosu için 1/0): KOD / TİP satırının altında,
  POZ satırının üstünde, ilk KOD sütununda formül olan satırlar (12); formülsüz olan grup başlığı satırıdır (13).
  Alt satırlar: TOPLAM'dan başlayıp formülü süren satırlar (DİREK'te 316; İLETKEN'de 116–120).
- `IM_*` (İLETKEN METRAJI): `IM_DURUM_SATIRI` (6: YENİ / DM / AKTARIM), KOD (7), TİP KODU (8), POZ (12), AD (13),
  SEC (14), BİRİM (15), `IM_MALZ_SATIRI` (120: malzeme listesine giden; DM'de hurda = demontaj − aktarım). TOPLAM
  satırının tanımlı adı yoktur: A sütununda "TOPLAM" ile başlayan ilk satır (116). Veri 16–115. Bayrak 9–10, grup 11.
- `YM_*` (YERALTI METRAJI): KOD (9), POZ (12), AD (13), SEC (14), BİRİM (15), TOPLAM (116). Veri 16–115. Bayrak 10,
  grup 11. Tanımlı ad O'dan başlar (toplam m³ sütunu, KOD'suz); KOD'lu sütunlar P'den.
- Sabit (KOD'suz) sütunlar başlık yazısından bulunur; KOD sütunları aramada dışarıdadır (grup başlıkları ve kablo adları
  yanıltmasın diye):
  - DİREK: `Direk No` (A), `Yeni Direk` (C), `Demontaj` (D), `Demontajdan Montaj` (E), `Mevcut` (F).
  - İLETKEN: `No'lu Direkler Arası` (A), `Aramesafe` (E), `Hat Tertibi` (F, formül), `AG İLETKEN 1..3` çiftleri
    adet / kod (G/H, I/J, K/L), `OG İLETKEN` (M/N), `ALPEK (AER)` adet / kablo tipi (O/P), `YENİ / DM / AKTARIM` (Q).
  - YERALTI: `Direk/Box No` (A), `Yatırım Karakteristiği` (C), `Yatırım Unsurları` (D), `Direk Cinsi` (E),
    `Aydınlatma Direk Cinsi` (F), `Beton Direk Cinsi` (G), `Box Cinsi` (H), `Aramesafe` (I), `Hat Tertibi` (J),
    `TABAN` / `TAVAN` / `DERİNLİK` (K/L/M, cm), `KANAL DOLGU CİNSİ` (N), `TOPRAK KANAL TOPLAMI (M3)` (O),
    `DUVAR MONTAJ` (V), `AÇIKLAMA` (W), `Kaplama Cinsi` (X).
- KOD sütunu: `{ sutun, kod, blok, tip, poz, ad, temin, birim, grup, formullu }`. Blok KOD önekinden: `Y` yeni, `DM`
  demontajdan montaj (DM önce denenir), `D` demontaj, `A` aktarım; başka önek DURUM satırından (YENİ / DM / AKTARIM),
  o da yoksa soldaki sütunun bloğu. `formullu`: ilk veri satırında formül var (şablonun türetme formülleri).
- MALZ. LİSTESİ: `MATCH($G7,DM_KOD_SATIRI,0)` biçimli ilk formül bulunur → KOD sütunu (G) ve kaynak (I); aynı satırdaki
  formüllerden poz (B), ad (C), birim (D), temin (E), miktar (H) sütunları; `=H` olan sütun toplam (F), 1/0 bayrağı (A).
  Örnek satırlar (biçim kopyalamak için): ilk KOD'lu satır (kalem), KOD'suz yazılı satırı KOD'lu satır izleyen ilk satır
  (grup başlığı). `E001…E040` olan satırlar şablonun **EK KALEMLER** bölümüdür: program bu bölümü kullanmaz, yerine
  kendi bölümlerini yazar (aşağıda); bölüm başlığı satırı (`ekBaslikSatiri`: ilk EK satırının üstündeki KOD'suz yazılı
  satır) ilk yeni bölümün başlığı olur.
- Sayfanın tanımlı ad aralıkları (`adlar`: KOD `$G$10:$ZZ$10`, TIP, POZ, AD, SEC, BIRIM, TOPLAM, MALZ) saklanır: kopya
  sayfaların MALZ. LİSTESİ formülleri aynı aralığı kopya sayfasında açık yazar (`'DİREK AG BETON'!$G$10:$ZZ$10`).
- Proje başlığı: DİREK METRAJI'nda `İLİ`, `İLÇESİ`, `GRUP_NO`, `İŞİN_ADI`, `PROJE_NO`, `YÜKLENİCİ_FİRMA`, `HAK_EDİŞ_NO`,
  `PROJE_TÜRÜ` etiketleri; değer sütunu etiketlerin sağındaki ilk dolu hücrelerin en sık sütunu (C). Öteki sayfalar
  buraya bağlıdır.
- Seçim listeleri (`LST_YENI_DIREK`, `LST_DEMONTAJ`, `LST_DMONTAJ`, `LST_IM_ILETKEN`, `LST_IM_AER`, `LST_AYD_DIREK`,
  `LST_BOX`; KATSAYILAR): tanımlı adın aralığı; değerler hücrelerden, formüllüyse (temiz şablonda önbellek yok) aynı
  kuralla tanımdan türetilir (Y bloğu TİP'leri, D bloğu "TİP (K)", kg birimli İLETKEN TİP'leri …).

## Doldurma kuralı

Proje = bölge (AutoCAD'de Proje Özeti'nde seçili proje; "tümü" seçilince bütün çizim; telefonda açık proje). Yalnız o
bölgenin elemanları, hatları ve kanalları.

**Başlık**: İLİ / İLÇESİ ← ayarlardan (eklentide hatırlanır, telefonda projede), GRUP_NO ← bölgenin grup kodu (yoksa
bölge kodu), İŞİN_ADI ← bölge adı (tümü: proje adı), PROJE_NO ← bölge kodu, YÜKLENİCİ_FİRMA ← ayarlardaki firma
(telefonda projenin yüklenicisi), HAK_EDİŞ_NO ← girilen (varsayılan görünen / etkin hakediş).

**Durum sözlüğü** (eklenti kodları): `M`, `M+M`, `KM`, `ENH`, `ME`… → **yeni** (Y); `DM` → **demontaj** (D); `DM+M` →
**demontajdan montaj** (DM); `MEVCUT` → mevcut (direk F sütununa yazılır; malzemesi yazılmaz); `ILERIDE` → yazılmaz.
Kalemler kendi durumlarıyla değerlendirilir: mevcut direğe takılan yeni armatür Y bloğuna yazılır.

**DİREK METRAJI** — her direk (AG, müşterek, aydınlatma, ENH, trafo direği) ve malzemesi olan her öteki eleman (box,
pano, ek mufu…) bir satır, numaraya göre doğal sıralı (SC2 < SC10); bir sayfada 298 satırı aşarsa hata (bölgeyi bölün).
- **Cins başına sayfa** (kullanıcı kararı 13.11.2026): direğin cinsi şablonun DİREK METRAJI sayfasında *temsil
  ediliyorsa* (TİP satırındaki bir tip o cinsin katalogdaki ana pozlarından ya da eşleme tablosundaki `tip` takma
  adından biri; ya da cins / aile `metraj-sablon.json › anaSayfaAileleri`'nde — `ENH_DEMİR_GLV|SW`: şablonun G-N12 /
  G-T25 tipleri kataloga uymaz) direk ana sayfaya yazılır; yoksa **DİREK METRAJI'nın kopyası** olan kendi sayfasına.
  Aile = cins + ENH tipindeki iletken eki (`G-T-12 (rv)` → `ENH_DEMİR_GLV|RV`); sayfa adı `DİREK ` + cinsin katalog adı
  (büyük; "DİREK / DİREĞİ" sözü atılır; GALVANİZ → GALV., AYDINLATMA → AYD., MÜŞTEREK → MÜŞ.) + iletken eki (SW → SWLL,
  RV → RAVEN, PG → PİGEON…), en çok 31 karakter: `DİREK AG BETON`, `DİREK ENH GALV. CIVATALI`, `DİREK ENH GALV.
  KAYNAKLI RAVEN`. Kopya sayfalar ilk görüldükleri sırayla, ana sayfanın hemen ardına açılır; kaynağın bütün biçimi,
  sabit sütunları, başlık hücreleri (il, ilçe, grup, işin adı, proje no, yüklenici, hakediş no), bayrak / toplam
  satırları ve makro bağları kalır; KOD sütunları (G'den sağa, KOD satırından TOPLAM satırına) boşaltılır, birleşik
  hücreler kaldırılır. Direğin tipi ve malzemeleri bu sayfada **normal sütun** olarak açılır (aşağıdaki "yeni sütun"
  kuralı; malzeme ana sayfada varsa aynı başlıkla); malzeme / tip sütunu olmayan direğe hiçbir "ek" kalem yazılmaz.
  Kopya sayfadaki direk tipleri KATSAYILAR seçim listelerine (`LST_YENI_DIREK`, `LST_DEMONTAJ` "tip (K)",
  `LST_DMONTAJ`) elle eklenir (listeler yalnız ana sayfadan formülle dolar). Mevcut direk de cinsine göre yönlenir.
- `A` eleman no. Direğin kendi pozu: yeni → `C` = tip; demontaj → `D` = tip + ` (K)` (KESİK) / ` (S)` (SÖKÜK); kesik /
  sökük bilgisi yoksa Kesik sayılır ve uyarılır; demontajdan montaj → `E` = tip; mevcut → `F` = tip. Tip yazımı
  şablonun TİP satırındaki gibi (`G-10I''`; `''` ↔ `"` eşdeğer); demontaj sütunu Kesik / Sökük'e göre de seçilir.
  Direk tipi sayfada yoksa (eşleme tablosundaki `tip` de denenir) yeni sütun açılır: TİP = tip, AD = "tip " + cinsin
  katalog adı (AG / OG / ENH öneki atılmış: `9,3/3 Beton Direk`, `BER-8 Galvaniz Cıvatalı Direk`; katalogda yoksa Demir
  / Beton / Ağaç Direk), grup başlığı "YENİ\nAG BETON DİREKLER" gibi, veri formülü bloğun direk tipi sütunundan
  kopyalanır; `C/D/E`'ye yine tip yazılır.
- Öteki kalemler: bloğun sütunu bulunur (aşağıdaki eşleme), miktar toplanarak yazılır: şablon birimi `kg` (`m3`) ve
  kalemin rapor birimi öyleyse toplam, yoksa giriş miktarı (adet, m, tk).
- Doldurulan satırda şablonun kendi türetme formülleri (ör. G-10I ise GT-60 = 1, levha = 1) yerine programın sayısı
  yazılır; programın o malzemesi yoksa formül hücresine 0 yazılır. Direk tipi sütunları (TİP satırı dolu) formül kalır:
  `C/D/E`'den kendileri bulur. Kullanıcı kararı: programın malzemesi esas.

**İLETKEN METRAJI** — havai hat parçaları (AG_HAVAI, OG_HAVAI, MUSTEREK, AYDINLATMA, REKORTMAN, ABONE, ENH): her
açıklık (parça) bir satır, "başNo-bitNo"ya göre doğal sıralı: `A` = uçtaki elemanların numarası (3,5 m içinde eleman
yoksa `?`), `E` = programın metrajı (ana kalemin miktarı: yuvarlanmış uzunluk + ek pay; yoksa çizim uzunluğu),
`Q` = YENİ / DM / AKTARIM. Sök-tak (DM+M) parça **iki satır**: DM ve AKTARIM (şablonda hurda = demontaj − aktarım).
MEVCUT ve ILERIDE yazılmaz; 100 satır dolunca uyarı.
- AG iletken kalemi (`3A+P+R` gibi tertip) tel tel açılır (Katsayilar açılımı): her tel türü sırayla AG çiftlerine
  adet + TİP KODU (şablonda bloğun kg birimli sütununda ADI'nın ilk sözcüğü tel adı olan: ROSE → `R`). Üçten çok tür
  varsa uyarı. OG iletken (`3xSW` → 3 × SWALLOW) M/N'ye. Hat kablosu (ALPEK / AER, aydınlatma kablosu, rekortman) O/P'ye:
  adet 1 (ya da `2(3x…)` demet sayısı), kablo tipi şablonun TİP'i (ALPEK kesit kökünden: `3X35/16+50 ALPEK` ↔
  `3x35/16+50 AER Kablo`). Başka hat malzemesi bu sayfaya yazılamaz; uyarılır.
- Tel türü şablonda yoksa yeni sütun: TİP KODU = tel adı, AD = "tel (kg/km Kg/Km)", poz 9.2.1 / 9.3.1 (+ blok öneki),
  birim kg, veri ve alt satır formülleri bloğun deseniyle; kablo için TİP = AD = "kesit AER Kablo" (ya da kalemin adı),
  poz katalogdan (yoksa 9.5.1), birim mt. DM / AKTARIM bloğunda açılan tel ya da kablo, YENİ bloğunda yoksa KATSAYILAR
  kod listesine de yazılır (şablonun "hatalı kod" denetimi için).

**YERALTI METRAJI** — her kablo kanalı ve her yeraltı kablo parçası (AG_YERALTI, OG_YERALTI) bir satır:
- Kanal: `A` = "başNo-bitNo", `I` = uzunluk, `J` = "Kanal OG/AG", `K/L/M` = taban / tavan / derinlik (cm), `N` =
  zemin, `X` = kaplama, `O` = kazı hacmi (m³; ana kalemin toplamı, yoksa `KanalHacmi`), hacim ayrıca zemine uyan kanal
  türü sütununa (AD'da kaplama — ASFALT / PARKE / BETON / KAPLAMASIZ — ve dolgu — TUVANEN / TOPRAK / MICIR — sözcükleri,
  bariyerli / trencher uyumu). Uymayan tür (beton kaplama, branşman kanalı, kablo demontaj kanalı…) yeni sütun (m3).
  Kanalın öteki kalemleri (boru, ikaz bandı…) genel eşlemeyle.
- Kablo parçası: `A`, `I` = çizim uzunluğu, `J` = kablo adı, `E/F/G/H` uçtaki direk / aydınlatma direği / beton direk /
  box cinsi (box listeye de eklenir); kablonun metrajı (ek paylı) **kanala göre bölünür**: parçanın bir kanalın üstünden
  giden kısmı (yanal ≤ 0,6 m, 0,25 m adımla örnekleme) KANAL İÇİN sütununa, kalan DİREK İÇİN sütununa (ek pay
  orantılı). Şablonun "(BOX İÇİN)" sütunları DİREK İÇİN sayılır. Sütun arama: AD gövdesi (ek sözü atılmış) = tanım →
  eşleme tablosu → gövde tanımla başlıyor → ilk sözcük (kesit) aynı ve bakır / alüminyum uyumlu. Yoksa yeni sütun
  (AD = "kablo adı (DİREK İÇİN)" / "(KANAL İÇİN)", poz katalogdan ya da 32.12 / 32.16 + blok öneki, birim mt.).

**Ad eşleme** (`metraj-sablon.json`): kalemin sütunu şu sırayla aranır (karşılaştırmalar normalleştirilmiş: büyük harf
i → I, boşluklar tek, `''` ve `″` → `"`, `3 x 50 + 25` → `3X50+25`, `3(1x150/25)` → `3X(1X150/25)`, `mm²` → `MM2`,
Tuvenan → Tuvanen):
1. TİP = tanım (direk tipleri, iletken kodları);
2. AD = tanım;
3. eşleme tablosundaki takma adlar (`kalemler["CİNS|TANIM"].adlar`) ∋ AD;
4. AD, tanım + boşluk ile başlıyor ve tanımda rakam ya da tire var (`GT-60 AG Konsol`, `N-80 Mesnet İzolatör`).
Bulunamazsa yeni sütun. Tablo ayrıca `tip` (şablonun TİP yazımı: ağaç `9mt` → `9-O`), `poz`, `temin` ve cins başına
varsayılan temin (`temin`; yoksa Ş) verir.

**Yeni sütun**: sayfanın (ana ya da kopya) kullanılan son sütununun sağına — kopya sayfada ilk KOD sütunundan (G)
başlayarak —, **ana sayfadaki** bloğun son sütunu (direk tipi için TİP'li son sütun) örnek alınarak: sütun genişliği
(aynı sayfadaysa), hücre biçimleri, bayrak ve alt satır formülleri (TOPLAM; İLETKEN'de 117–120) sütuna kaydırılarak
kopyalanır, veri formülü gerekiyorsa (direk tipi, İLETKEN) bütün veri satırlarına yazılır; KOD, TİP, DURUM, grup
başlığı ("blok adı \n MALZEMELER / … DİREKLER / İLETKENLER / KABLOLAR / KANALLAR"), POZ, AD, TEMİN, BİRİM yazılır.
**KOD = şablonun kendi KOD dizisinin devamı** (blok öneki + en büyük numara + 1: `Y175`, `D120`, `DM072`, `A017`;
"ek" kodu yok): şablonun blok süzgeçleri (`LEFT(KOD,1)="Y"` gibi seçim listeleri, denetimler) yeni sütunu kendi bloğunda
sayar, ana sayfanın listeleri kendiliğinden güncellenir. TEMİN: eşleme tablosu (yoksa Ş); demontaj / DMM direk tipinde
Kesik / Sökük. BİRİM: `ad/…` → `ad.`, `mt/…` → `mt.`, `kg/…` → `kg`, `m3` → `m3`, `tk/…` → `tk.`. POZ: katalog poz no
(boşluk ve büyük / küçük harf farkıyla da bulunur); demontaj `1` + poz, DMM / aktarım `2` + poz, ilk bölüm iki haneye
tamamlanır (`5.5.1` → `105.5.1`).

**MALZ. LİSTESİ**: yeni sütunlar EK KALEMLER bölümünün yerine **normal satır** olarak yazılır (kullanıcı kararı
13.11.2026). Eski EK satırlarının KOD'u (`E001…`) ve miktarı silinir; EK KALEMLER başlığından başlayarak her sayfa
için bir bölüm: başlık satırı (A = alt satırların F'sinde 0'dan büyük varsa 1, B = sayfa adı, ötekiler boş; biçimi
şablonun grup başlığı satırından), ardından sayfanın yeni sütunları sütun sırasıyla (biçimi şablonun ilk kalem
satırından): G = KOD, B/C/D/E/H/I formülleri şablonun kendi satırlarındaki gibi (`INDEX(DM_POZ_SATIRI,$I)`; D / DM / A
bloklarında E = `Y` sabiti; İLETKEN'de H `IM_MALZ_SATIRI`, ötekilerde `xx_TOPLAM_SATIRI`), F = `=H`, A = `IF(F>0,1,0)`.
Kopya sayfanın bölümünde aralıklar açık yazılır (`'DİREK AG BETON'!$G$14:$ZZ$14`). Bölüm sırası: DİREK METRAJI, DİREK
kopyaları (açılış sırasıyla), İLETKEN, YERALTI. Şablonun 40 EK satırı yeter; sığmayan malzeme (sütun açılamadı)
miktarıyla (tel kilogramıyla) **ŞABLONDA OLMAYAN** adlı yeni sayfaya yazılır (sayfa, blok, poz, malzeme, birim,
miktar, nerede) ve uyarılır.

**Dosya**: şablon zip olarak açılır, yalnız dokunulan sayfa XML'leri ve `workbook.xml` değiştirilir; her şey (makro,
stiller, listeler, koşullu biçimler) aynen kalır. Metinler `inlineStr`, sayılar `<v>`; formül hücresine değer
yazılırken `<f>` kaldırılır; paylaşılan formül (`t="shared"`) grubunun ana hücresi yazılırsa grup açılır (her hücreye
kendi formülü, göreli başvurular kaydırılarak). Yazılan satırlar ve iki yedek satır görünür, kalan veri satırları
gizlenir. `calcChain.xml` silinir, `calcPr fullCalcOnLoad="1"` yazılır: Excel (ve LibreOffice) açılınca her şeyi
yeniden hesaplar, MALZ. LİSTESİ ve toplamlar o anda dolar. Çıktı adı: eklentide
`<çizim>_<proje>_BIRLESIK_METRAJ_<tarih>.xlsm`, telefonda `<proje>_birlesik_metraj.xlsm`.

## Denemeler

- `ortak/deneme/birlesik-metraj/`: `proje.sebeke.json` (eklenti biçiminde küçük proje: iki bölge; yeni / kesik demontaj /
  sök-tak / mevcut / ağaç / şablonda olmayan direk tipleri, ENH direği (sw: ana sayfa), box, AG — OG — ALPEK — rekortman
  açıklıkları, sök-tak AG parçası (OXLIP), iki kanal ve kanal üstünden giden yeraltı kablolar; ana sayfada temsil
  edilmeyen cinsler: AG beton 9,3/3 yeni ve 9,3/8 kesik demontaj, ENH cıvatalı BER-8, ENH kaynaklı raven G-T-12 (rv) →
  üç kopya sayfa), `ayar.json` (bölge B1, firma, il, ilçe), `sablon.json` (temiz şablonun okunan tanımı),
  `beklenen-plan.json` (plan: 17 yeni sütun, 3 kopya sayfa, 23 MALZ. LİSTESİ satırı). İkisini
  `node araclar/metraj-beklenen-uret.mjs` yazar; eklenti (`CekirdekTest -- ornek`) ve telefon
  (`tests/birlesik-metraj.test.mjs`) aynı dosyaları okuyup birebir karşılaştırır (sayılarda 1e-6 pay).
- Her platform planı dosyaya yazıp yeniden açar: hücreler, yeni sütunun KOD / TİP / formülleri, gizli satırlar, kopya
  sayfa (başlık, direk, KOD sütunları boş, veri formülü ana sayfanın örneğinden), MALZ. LİSTESİ bölüm başlığı ve kalem
  satırları (açık aralıklı formül), KATSAYILAR liste eki, makro ve `fullCalcOnLoad`. Telefon ayrıca şablonun temizliğini
  (BM5), sütun açılamayınca fazla sayfasını (BM8), bölge süzgecini ve sığmayan projeyi (BM9), telefon projesinden dışa
  aktarımı (BM10) dener; eklenti pencere testleri (`PencereTest` 25c, 30, 30b) ayar ve sonuç pencerelerini açar.
  `SH_BM_CIKTI=<yol> dotnet run … -- ornek` eklentinin ürettiği dosyayı kaydeder (LibreOffice ile hesap denetimi).
- Elle doğrulama: doldurulmuş dosya LibreOffice ile `--convert-to xlsx` yapılınca formüller hesaplanır; MALZ. LİSTESİ
  miktarları ve denetim hücreleri ("TAMAM") okunabilir.
