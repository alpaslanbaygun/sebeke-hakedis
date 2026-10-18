# Ortak veri modeli

Telefon uygulaması (VOLT-EDAŞ Saha) ve AutoCAD eklentisi aynı **proje dosyasını** kullanır: `<ad>.sebeke.json`
(UTF-8 JSON). Biçimi okuyan/yazan başvuru kodu: `autocad/src/Cekirdek/ProjeDosyasi.cs` (eklenti) ve
`telefon/web/src/interop/sh-core.cjs` + `sebeke.js` (telefon).

## Koordinatlar

Karışıklık olmasın diye eksenler açık adla tutulur:

| Alan | Anlamı | AutoCAD'de |
| --- | --- | --- |
| `saga` | doğu (sağa değer) | X |
| `yukari` | kuzey (yukarı değer) | Y |
| `kot` | yükseklik | Z |

Çizgiler `kose` dizisiyle tutulur: `[[saga, yukari], ...]`. Projeksiyon: TM, ITRF96 (`proje.koordinat`).

## Dosyanın yapısı

```
{
  "bicim": "sebeke-hakedis.proje", "surum": 1,
  "proje":    { ad, kaynak, koordinat{sistem, datum, dom}, aktifHakedis, katmanOnEki, gisOnEki, onaylar[] },
  "bolgeler": [ { id, ad, kod, grup, sinir[[saga,yukari]...] } ],           alt projeler (AutoCAD: BÖLGE)
  "noktalar": [ { id, ad, kod, saga, yukari, kot, hakedis, bolge } ],          saha ölçüm noktaları (NOKTA AL)
  "elemanlar":[ { id, tur, gisId, cins, tip, durum, hakedis, bolge, saga, yukari, aci, guc, gerilim, dmDurum, kontrol, kalemler[], ekVeri{} } ],
  "hatlar":   [ { id, tur, anaKesit, durum, hakedis, bolge, kose[], cizimUzunlugu, etiket, kontrol, kalemler[] } ],
  "kanallar": [ { id, kod, kablolar, zemin, altGenislik, ustGenislik, derinlik, basNo, bitNo, durum, hakedis, bolge, kose[], kalemler[] } ],
  "sondajlar":[ { id, tip, durum, hakedis, bolge, kose[], kalemler[] } ]
}
```

- `proje.onaylar`: hakediş onayları `[{ no, kontrol, hakedis, gis }]` (AutoCAD `HAK_ONAY`; sıra kontrol → hakediş → GIS).
  Hakediş onayı olan hakediş eklentide kilitlidir. Telefonda onaylanan dönem `kontrol + hakedis` olarak yazılır;
  eklenti telefondan gelen onayları çizimdekilere ekler (onay geri alınmaz).
- `bolge.grup`: AutoCAD grup kodu (`FULLREG` üçüncü alanı, boş olabilir).
- `eleman.ekVeri`: AutoCAD'in eklentide ve telefonda düzenlenmeyen verileri — pano çıkış şeması `ANA`, `CON`, bina
  tipi trafonun hücreleri `FIDER` (her biri XDATA satırları dizisi). Okunur, taşınır, aynen geri yazılır; dosyada
  yoksa çizimdeki korunur.
- **Parçalı hat**: hat, kanal ve sondaj her bağlantı düğümünde (direk, SDK, pano, trafo) biter; her parça ayrı nesnedir.
  Telefon bir hattı parçalara bölünce kimlikler `<kök>-1`, `<kök>-2`… olur; `-1` parçası, çizimde tek parça olan eski
  nesneyi (tanıtıcı `<kök>`) günceller, diğerleri yeni nesnedir. HAT kalemi parçalara uzunlukla bölünür (tam sayı
  metre, toplam değişmez); hattın malzemeleri ilk parçadadır.

Okuyucular tanımadıkları alanları atlar. Telefonun (VOLT-EDAŞ Saha) eklediği alanlar:

| Alan | Nerede | Anlamı |
| --- | --- | --- |
| `telefonId` | eleman, hat, kanal, sondaj, nokta | telefondaki kayıt kimliği. Eklenti bunu çizime `SH_ID` olarak yazar ve "Telefona Gönder"de geri verir; telefon dosyayı alırken kaydını bununla bulur (çift kayıt olmaz) |
| `olcum` | eleman, nokta | ölçümün kaynağı ve kalitesi: `{kaynak: alici/telefon/harici/harita, cozum, hata, uydu, zaman}` |
| `not` | her nesne | serbest not |
| `uclar` | hat | `[başlangıç elemanının kimliği, bitiş elemanının kimliği]` |
| `kod` | proje | telefondaki proje kodu |
| `servis`, `koken` | kalem | telefon kataloğundaki poz kodu ve kalemin kökeni (OTO / MANUEL) |

Kimlikler: AutoCAD/AutoCAD'den gelen nesnelerde AutoCAD tanıtıcısı (onaltılık, ör. `2F3A`), telefonda
oluşturulanlarda telefonun kayıt kimliği (26 karakter, ör. `01M2YSTNC0W31N21HHMX9V1EG4`). Telefon, AutoCAD'den
aldığı nesnenin tanıtıcısını saklar (`sebekeId`) ve geri yazarken aynen kullanır.

### Telefonun tam proje dosyası (`.volt.json`, `volt-project/3`)

Telefonun kendi biçimi: ham kayıtlar (`data`), türetilmiş sonuçlar (`derived`) ve **AutoCAD bölümü `sebeke`**
(yukarıdaki proje dosyasının aynısı). Teslim paketindeki `PROJECT_INFO/project.json` de bu biçimdedir. Eklenti
üç dosyayı da açar: `.sebeke.json`, `.volt.json`, teslim paketi `.zip`. Eklenti "Telefona Gönder"de istenirse
`.volt.json` yazar (`data` boş, `sebeke` dolu); telefon ikisini de alır.

### Telefon ↔ AutoCAD eşlemesi (`katalog/volt-eslesme.json`)

Telefonun kataloğu TEDAŞ poz kodlarıyla (ör. `005.01.02.01-008`), eklentinin raporu AutoCAD cins / tanım ile
çalışır. Çeviri kuralları tek dosyadadır: `ortak/katalog/volt-eslesme.json` (telefon kopyası
`telefon/web/src/ortak/volt-eslesme.js`, dönüştürücü `telefon/web/src/interop/sebeke.js`):

- Direk grubu → tür, cins, tarife: `sehir → AG_DIREK / AG_DEMİR_GLV / 0107`, `mus → MUSTEREK_DIREK / MÜŞ_DEMİR_GLV`,
  `bahh → ENH_DIREK / ENH_DEMİR_GLV`, `civ → ENH_GLV_CVT`, `beton → AG_BETON`, `beton562 → ENH_BETON`,
  `agac → AG_AĞAÇ`, `ayd → AYD_DIREK / AYD_GLV_PLG`, `trafo → TRAFO_DIREGI / TR_DİREK_GLV`.
- Tip adları: beton `9.3/8 → 9,3/8`; B.A. hava hattı `GD-10 (3 AWG) → G-D-10 (sw)`, `(1/0)` aynı; trafo
  `G-T25 → G-T-25`. Ağırlıklar iki tarafta aynıdır (ör. G-K2 = 504 kg, 9,3/8 = 1510 kg).
- İletkenler: `3xSwallow → 3xSW`, `3xRaven → 3x1\0`, `3xPigeon → 3x3\0`, `3xPartridge → 3x266`, `3xHawk → 3x477`;
  çıplak AG kısa adları (R, P, A, O) aynı; `3x70/16+95 AER → 3X70/16+95 ALPEK`; yeraltı
  `3x(1x150/25) NA2XSY → 1x150/25 Xlpe Alm.` (açıklama `3(1x150/25) Xlpe Alm.`), `NAYY 3x95+50 → 3x95+50 Nyy Alm.`.
- Durumlar: `YENI → M` (pozun temini yüklenici "Y" ise `M+M`), `MEVCUT → MEVCUT`, `DEMONTAJ → DM`, `DMM → DM+M`;
  trafoda `yeni/guc/ger/gucger/tadil/modul → M`, `tasinan → DM+M`, `demontaj → DM`. **"İleride" nesneler dosyaya
  yazılmaz** (uyarı listesine düşer).
- Kalemler: nesnenin kendi pozu (direk tipi, trafo direği, köşk gövdesi, SDK tipi) `ana` kalemdir; katsayı telefonun kg
  değeridir (katalogda birebir eş varsa onun alanları). Diğer malzemelerde cins poz kategorisinden (`Travers → TRAVERS_VE_KONSOLLAR_GLV`,
  `İzolatör|OG → OG_İZOLATÖR` …), tanım poz adından gelir. Telefona alınan ve telefon kataloğunda eşi olmayan kalemler
  için kataloğa `AUTOCAD:…` kodlu kalem açılır; AutoCAD alanları kalemde saklanır ve geri yazımda aynen döner.
- Hat metrajı tam metreye yukarı yuvarlanır (AutoCAD gibi); yeraltında telefonun payları (dikey iniş, çıkış, trafo,
  SDK, rezerv) dahildir ve `3(1x…)` kablolarda üç damarın toplamı yazılır.
- Yeraltı hattın kazı kanalı ayrı **Kanal** nesnesi olur: kod kablo türlerinden (OG 8, AG 4, AYD 2, REK 1), zemin
  `toprak/tuvenan/asfalt/beton/parke → TOPRAK/TUVENAN/ASFALT/BETON/PARKE TUVENAN`, genişlik ve derinlik cm, borulu
  geçişte boru kalemi; yatay sondaj ayrı **Sondaj** nesnesidir. Ters yönde kanal, aynı köşeleri paylaşan hatta
  bağlanır; hattı olmayan kanal "kablosuz kanal / kazı" hattı olur.
- Bölge: AutoCAD'den gelen bölgeler telefonda saklanır ve geri yazılır; telefonda açılan projede tek bölge projenin
  kendisidir (tüm noktaları kapsayan kutu). Hakediş: hakedişe girmiş objede iş tarihinin düştüğü dönem, diğerlerinde
  aktif (taslak) dönem.

### Lejant simge takımı (`katalog/semboller.json`)

Eklentinin kendi blokları (`SH_<aile>_<varyant>`) ve telefonun DXF çıktısı aynı tablodan çizilir; üretici
`araclar/semboller-uret.mjs`, önizleme `araclar/semboller-onizle.mjs`. Aileler: `DIREK_AG` (beton / ağaç AG,
daire 2,25 m), `KAFES_AG` (demir AG, kare 4,6 m), `DIREK_OG` / `KAFES_OG` (OG, müşterek, ENH; topraklama işaretli),
`DIREK_AYD`, `TRAFO_DIREK` (üçgen), `TRAFO_BINA` (kare), `TRAFO_KOSK` (ev), `SDK`, `PANO`, `MUFU`, `KOFRE`, `MENHOL`,
`ABONE`, `ARMATUR`, `DIGER`. Varyantlar (sürüm 2, telefonun haritasıyla aynı): `YENI` dolu, `MEVCUT` boş (kafes
direkte içi çarpı, SDK'da çapraz), `DMM` yarım dolu, `DM` boş + simgeden taşan `/`, `KESIK` boş + taşan `//`,
`SOKUK` boş + taşan `X`. Taşma payı `R + min(3, max(1,5; 0,8 R))`; demontaj varyantlarında iç işaret (kafes çarpısı)
yoktur. Varyant durumdan gelir: M, M+M, KM, ENH, ME → `YENI`; DM → elemanın demontaj türüne (`dmDurum`) göre `DM` / `KESIK` /
`SOKUK`; DM+M → `DMM`. `aileler.<aile>.kapsam`: bütün varyantları içine alan yarı genişlik (şerit simgeleri).
Boyutlar metre; bloklar 1 ölçekle konur (telefonun DXF'iyle aynı). Varsayılan "telefon simgeleri": her yeni eleman
SH_ simgesiyle çizilir; çizimdeki değişmeyen AutoCAD bloklarına dokunulmaz (`SH_GORUNUM` istenirse çevirir).
Ayarlardan "AutoCAD simgeleri" seçilirse çizimde o tür ve durumda AutoCAD bloğu varsa o kullanılır.

### Çizim stili (`katalog/cizim-stili.json`) ve şerit kategorileri (`katalog/kategoriler.json`)

- `cizim-stili.json`: telefonun DXF'iyle AutoCAD'in aynı görünmesi için renkler (ACI; beyaz kâğıt için), çizgi tipleri,
  yazı yükseklikleri, parça metrajı yazısı ve ekran renkleri (`ekran`: telefonun koyu ekranındaki renkler; şerit
  simgeleri bunlarla çizilir). Telefon kopyası `telefon/web/src/ortak/cizim-stili.js`.
- `kategoriler.json`: şeritteki "Çizilecek şebeke" kategorileri ve her kategorinin öğeleri (komut, tür, kablolar,
  cins süzgeci). Öğenin tip listesi yalnız o öğenin cinslerinden gelir.

### Kalem (poz satırı)

| Alan | Örnek | Açıklama |
| --- | --- | --- |
| `cins` | AG_DEMİR_GLV | malzeme kategorisi |
| `tanim` | G-K2 | tip; hatlarda ana kesit (1x150/25 Xlpe Alm.) |
| `aciklama` | 3(1x150/25) Xlpe Alm. | hatlarda çizimdeki tam yazım; aynı iletkenden birkaç tane: `3x(3X50/16+70 ALPEK)` (adet × güzergâh = miktar) |
| `durum` | M | M montaj · M+M malzeme+montaj · KM kurum malzemesi + montaj · ENH kilometrik · DM demontaj · DM+M sök-tak · ME mutabakat eksiği · MEVCUT |
| `miktar` | 1 | giriş biriminde |
| `birim` | ad/kg | giriş/rapor birimi |
| `katsayi` | 504 | giriş biriminden rapor birimine (kg/ad, kg/m) |
| `toplam` | 504 | rapor biriminde = miktar × katsayı |
| `birimFiyat` | 0 | TL |
| `hakedis` | 2 | kalemin hakediş numarası (nesneninkinden farklı olabilir) |
| `tarife` | 0107 | ilk iki hane karakteristik, son iki hane unsur |
| `dmDurum` | KESİK | demontajda: KESİK / SÖKÜK |
| `sira` | 330 | AutoCAD kalem numarası (INDEX); yeni kalemde çizimdeki `AYARLAR/SAYAC`'tan devam eder. Telefon AutoCAD'den gelen kalemin sırasını, hakedişini ve kontrol işaretini saklar, geri yazarken aynı kaleme verir |
| `kontrol` | true | kontrol işareti |
| `ana` | true | nesnenin kendi pozu (direk, box, trafo...) |

### Eleman türleri

`AG_DIREK`, `MUSTEREK_DIREK`, `AYD_DIREK`, `ENH_DIREK`, `TRAFO_DIREGI`, `TRAFO_MERKEZI`, `PANO`, `BOX`,
`EK_MUFU`, `KOFRE`, `DIGER` (cinse göre belirlenir).

### Hat türleri

`AG_HAVAI`, `AG_YERALTI`, `AYDINLATMA`, `OG_HAVAI`, `OG_YERALTI`, `REKORTMAN` (abone bağlantısı), `MUSTEREK`.

Çok iletkenli hat: her iletken ayrı bir `HAT` kalemidir (müşterekte OG iletkeni `OG_İLETKEN`, AG iletkeni
`AG_İLETKEN` / `ALPEK_KABLOLAR`). Adet `aciklama`daki `Nx(…)` yazımıyla, miktar adet × güzergâh metrajı. Tek
iletkende `anaKesit` iletkenin tanımıdır (AutoCAD gibi); birden çok iletkende birleşik yazım: OG'ler ` + ` ile, sonra
` / `, sonra AG'ler ` + ` ile (ör. `3xSW / 4P+R`). Etiketteki uzunluk güzergâhın metrajıdır (ilk iletkenin miktarı / adedi).
Telefonda her `HAT` kalemi bir devredir (`{role, key, count}`); eşlenemeyen iletken varsa kalemler olduğu gibi saklanır.

### Kanal kodu

Kanaldaki kablo türlerinin puan toplamı: **REK 1 + AYD 2 + AG 4 + OG 8** (ör. 12 = OG + AG).
Kanal hacmi = (alt genişlik + üst genişlik) / 2 × derinlik × uzunluk (genişlik ve derinlik cm).

## Rapor kuralları (Durum Tespit)

1. Her kalem bir satırdır. Proje adı ve kodu nesnenin bölgesinden gelir.
2. Bölge: nesnenin (hatta orta noktasının) içinde kaldığı en küçük bölge; hiçbirinde değilse en yakını.
3. Kanalın kendi satırı yazılmaz; hacmi kanaldaki kablolara `katalog/katsayilar.json` → `kanalPaylasim`
   oranlarıyla bölünür ve her pay kendi tarifesine yazılır (OG 0104, AG 0105, AYD 0108, REK 0110;
   OG/AG payında karakteristik kalemin tarifesinden alınır).
4. Çıplak iletken hatları (AG_İLETKEN, OG_İLETKEN) ayrıca tel tel açılır: `AL_İLETKENLER` satırları,
   metre = hat uzunluğu × tel sayısı, kg = metre × kg/m (`agIletken`, `ogIletken`).
5. Özet: proje × hakediş × durum × cins × tip × birim toplamları.

## Katalog dosyaları

- `katalog/katsayilar.json` — rapor katsayıları (Durum Tespit dosyasının KATSAYILAR sayfası)
- `katalog/kalemler.json` — sürüm 2: AutoCAD'in tam malzeme listesi (2 934 kalem; cins, tip, poz no, metrik ağırlık,
  birimler, karakteristik + şehir / köy unsuru), nesne türü → cins grupları (pencere ve şerit süzgeçleri), durum
  listesi. Üretici `araclar/katalog-aktar.py`. Telefon uygulamasına ve AutoCAD eklentisine gömülür.
- Tarife: kalemin tarifesi = karakteristik (çizim ayarı; boşsa katalogdaki) + unsur (çizim ayarı köy / bakımsa
  kalemin köy unsuru, yoksa şehir unsuru).

## AutoCAD çizimlerinden okuma

AutoCAD veriyi nesnelerin genişletilmiş verisinde (XDATA) tutar. Okuyucu: `autocad/src/Cekirdek/NesneOkuyucu.cs`.

| XDATA | İçerik |
| --- | --- |
| `GIS` | kimlik;GIS no;cins;tip;durum[;güç;gerilim] — kanalda: baş;bit;uzunluk;derinlik;alt;üst |
| `NIT` | nesnenin kendi pozu: cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;dm durum;sıra |
| `MALZEME` | bağlı malzemeler: cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol |
| `HAT` | hat satırı: cins;tanım;ikinci tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol |
| `ANAKESIT` | hattın ana kesiti (raporda tip olarak kullanılır) |
| `FULLREG` | bölge sınırı: proje adı;proje kodu;grup kodu |
| `ANA`, `CON`, `FIDER` | pano çıkış şeması, bina tipi trafo hücreleri (eklenti korur) |
| `HAKNO`, `ZKOORD` | GPS noktasının hakedişi ve kotu |
| `KONTROL` | True/False |
| `ETK`, `START`, `END`, `UZ`, `BOYUT` | etiket ve ölçü yazılarının tanıtıcıları |

Katmanlar: `<ön ek>_<hakediş>.HAK.<tür>` (ör. `SC_8.HAK.AG_HAV_HAT`) ve `<ön ek>_DEMONTAJ`, `_MEVCUT`,
`_STANDART`, `_KABLO_KANALI`, `_YATAY_SONDAJ`, `_PROJE`, `GPS`.

## Eklentinin çizime yazdıkları

Eklenti AutoCAD'in yazdığı biçimle yazar (yukarıdaki XDATA ve katmanlar); ayrıca:

| Ne | Nerede | Anlamı |
| --- | --- | --- |
| `SH_ID` XDATA | telefondan gelen nesne | telefondaki kimlik; aynı dosya yeniden alınınca nesne bununla bulunur |
| `SH_PARCA` XDATA | hat, kanal, sondaj | parça metrajı yazılarının tanıtıcıları (`<ön ek>_YAZI` katmanında) |
| `SH_ARM` XDATA | armatürlü direk ve simgesi | direkte `[simgenin tanıtıcısı, dx, dy]` (simgenin direğe göre yeri), simgede `["@" + direğin tanıtıcısı]`. Simge `SH_ARMATUR_<varyant>` bloğudur, direğin katmanında; kendi poz verisi yoktur (armatür direğin `MALZEME` kalemidir). Direk AutoCAD'le taşınınca / kopyalanınca / silinince simge de gider |
| `SEBEKE_HAKEDIS` › `AYARLAR` | çizimin sözlüğü (Named Objects Dictionary) | çizim ayarları: ön ekler, aktif hakediş, dilim, tarife, sembol takımı, etiket, metraj payları, son seçimler |
| `SH_<aile>_<varyant>` (ör. `SH_KAFES_AG_YENI`), `GPS` | blok tanımları | lejant simgesi tür + malzeme + duruma göre (`katalog/semboller.json`; 1 ölçek, öznitelikler AutoCAD adlarıyla; panoda ayrıca gizli `C_1…C_8`); tanımın sürümü blok sözlüğünde (`SEBEKE_HAKEDIS › BLOK`) |

AutoCAD'in çizim sözlüğündeki kayıtlar da okunur ve yazılır (iki program aynı çizimde sırayla kullanılabilsin):

| Kayıt | Anlamı | Eklenti |
| --- | --- | --- |
| `AYARLAR` › `SAYAC` | sıradaki kalem numarası (INDEX) | yeni sıra bunun altına inmez; her yeni kalemde ve telefondan almada ilerletilir |
| `HakNo_Dic` › `HakNo_Rec` | aktif hakediş | okunur (AutoCAD'deki seçim geçerli); hakediş seçilince yazılır |
| `DicBölge` › `RecBölge` | bölge çizgilerinin tanıtıcı listesi | eklentinin çizdiği / telefondan gelen bölge eklenir, silinen çıkarılır |
| `HAK_ONAY` › `ONAY_DURUM<n>` | n. hakedişin onayı: KONTROL 4, HAKEDİŞ 2, GIS 1 | `SH_ONAY` yazar; hakediş onaylı hakediş kilitlidir |

Hat etiketi AutoCAD yazımıyladır: `^ kesit/341m/(tanıtıcı)` (M), `* …` (M+M), `>…<` (DM), `[…]` (DM+M),
`(…)` (MEVCUT); kesit yerine hattın tam yazımı varsa o kullanılır.

## Telefondan alma (SH_PROJEAL)

1. Telefondaki nesnenin kimliği çizimde bir tanıtıcıysa o nesne; değilse aynı `SH_ID`'li nesne; ikisi de
   yoksa yeni nesne.
2. İki taraf da aynı yazıcıdan geçirilip karşılaştırılır (konum 1 mm, sayılar 0,001 toleransla). Aynıysa
   nesneye dokunulmaz; değiştiyse yer, köşeler, katman, blok (durum değiştiyse o durumun bloğu),
   öznitelikler, XDATA ve hat etiketi güncellenir.
3. Telefonda olmayan çizim nesneleri, yalnız proje bu çizimden alınmışsa ve nesne dışa aktarımdan önce
   varsa (tanıtıcısı küçükse) “silinmiş görünen” olarak sorulur. Bilgisayarda sonradan çizilenler sorulmaz.
4. Onaylı (kilitli) hakediş: kilitli satırları değişen, kendisi kilitliyken yeri / geometrisi değişen, kilitli
   hakedişe yeni gelen ya da telefonda silinmiş kilitli nesneler aktarılmaz, ayrıca listelenir. Kilitli nesneye
   açık hakedişte malzeme eklenmesi aktarılır.

## Telefonda saklama

Telefon (VOLT-EDAŞ Saha) verisini kendi veritabanında tutar (IndexedDB `volt-edas-saha`; tablolar
`telefon/web/src/core/schema.js`). AutoCAD'den alınan nesnelerde `sebekeId` (AutoCAD tanıtıcısı) ve `sebeke`
(tür, cins, tip, katman, blok, bölge, hakediş; hatta ana kesit, eşleşmeyen kalemler ve parça kimlikleri; kalemlerin
sıra / hakediş / kontrol bilgisi `kalemBilgisi`; elemanda `ekVeri`) saklanır; projede `sebeke` (katman / GIS ön eki,
bölgeler, onaylar, kaynak) tutulur. Böylece telefonda değiştirilip geri gönderilen dosya AutoCAD'deki
nesnelerle eşleşir ve AutoCAD alanları korunur.
