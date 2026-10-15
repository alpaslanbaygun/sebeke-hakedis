# Ortak veri modeli

Telefon uygulaması ve AutoCAD eklentisi aynı **proje dosyasını** kullanır: `<ad>.sebeke.json`
(UTF-8 JSON). Biçimi okuyan/yazan başvuru kodu: `autocad/src/Cekirdek/ProjeDosyasi.cs`.

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
  "proje":    { ad, kaynak, koordinat{sistem, datum, dom}, aktifHakedis, katmanOnEki },
  "bolgeler": [ { id, ad, kod, sinir[[saga,yukari]...] } ],                 alt projeler (PROMAGIS: BÖLGE)
  "noktalar": [ { id, ad, kod, saga, yukari, kot, hakedis, bolge } ],          saha ölçüm noktaları (NOKTA AL)
  "elemanlar":[ { id, tur, gisId, cins, tip, durum, hakedis, bolge, saga, yukari, aci, guc, gerilim, dmDurum, kontrol, kalemler[] } ],
  "hatlar":   [ { id, tur, anaKesit, durum, hakedis, bolge, kose[], cizimUzunlugu, etiket, kontrol, kalemler[] } ],
  "kanallar": [ { id, kod, kablolar, zemin, altGenislik, ustGenislik, derinlik, basNo, bitNo, durum, hakedis, bolge, kose[], kalemler[] } ],
  "sondajlar":[ { id, tip, durum, hakedis, bolge, kose[], kalemler[] } ]
}
```

### Kalem (poz satırı)

| Alan | Örnek | Açıklama |
| --- | --- | --- |
| `cins` | AG_DEMİR_GLV | malzeme kategorisi |
| `tanim` | G-K2 | tip; hatlarda ana kesit (1x150/25 Xlpe Alm.) |
| `aciklama` | 3(1x150/25) Xlpe Alm. | hatlarda çizimdeki tam yazım |
| `durum` | M | M montaj · M+M malzeme+montaj · DM demontaj · DM+M sök-tak · MEVCUT · (KM, ME seyrek) |
| `miktar` | 1 | giriş biriminde |
| `birim` | ad/kg | giriş/rapor birimi |
| `katsayi` | 504 | giriş biriminden rapor birimine (kg/ad, kg/m) |
| `toplam` | 504 | rapor biriminde = miktar × katsayı |
| `birimFiyat` | 0 | TL |
| `hakedis` | 2 | kalemin hakediş numarası (nesneninkinden farklı olabilir) |
| `tarife` | 0107 | ilk iki hane karakteristik, son iki hane unsur |
| `dmDurum` | KESİK | demontajda: KESİK / SÖKÜK |
| `sira` | 330 | PROMAGIS kalem numarası (INDEX) |
| `kontrol` | true | kontrol işareti |
| `ana` | true | nesnenin kendi pozu (direk, box, trafo...) |

### Eleman türleri

`AG_DIREK`, `MUSTEREK_DIREK`, `AYD_DIREK`, `ENH_DIREK`, `TRAFO_DIREGI`, `TRAFO_MERKEZI`, `PANO`, `BOX`,
`EK_MUFU`, `KOFRE`, `DIGER` (cinse göre belirlenir).

### Hat türleri

`AG_HAVAI`, `AG_YERALTI`, `AYDINLATMA`, `OG_HAVAI`, `OG_YERALTI`, `REKORTMAN` (abone bağlantısı), `MUSTEREK`.

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

- `katalog/katsayilar.json` — rapor katsayıları (PROMAGIS Durum Tespit dosyasının KATSAYILAR sayfası)
- `katalog/kalemler.json` — gerçek bir projeden çıkarılan 244 kalem (59 kategori): birim, katsayı, tarife

## PROMAGIS çizimlerinden okuma

PROMAGIS veriyi nesnelerin genişletilmiş verisinde (XDATA) tutar. Okuyucu: `autocad/src/Cekirdek/PromagisOkuyucu.cs`.

| XDATA | İçerik |
| --- | --- |
| `GIS` | kimlik;GIS no;cins;tip;durum[;güç;gerilim] — kanalda: baş;bit;uzunluk;derinlik;alt;üst |
| `NIT` | nesnenin kendi pozu: cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;dm durum;sıra |
| `MALZEME` | bağlı malzemeler: cins;tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol |
| `HAT` | hat satırı: cins;tanım;ikinci tanım;durum;0;miktar;birim;katsayı;toplam;fiyat;hakediş;tarife;sıra;kontrol |
| `ANAKESIT` | hattın ana kesiti (raporda tip olarak kullanılır) |
| `FULLREG` | bölge sınırı: proje adı;proje kodu |
| `HAKNO`, `ZKOORD` | GPS noktasının hakedişi ve kotu |
| `KONTROL` | True/False |
| `ETK`, `START`, `END`, `UZ`, `BOYUT` | etiket ve ölçü yazılarının tanıtıcıları |

Katmanlar: `<ön ek>_<hakediş>.HAK.<tür>` (ör. `SC_8.HAK.AG_HAV_HAT`) ve `<ön ek>_DEMONTAJ`, `_MEVCUT`,
`_STANDART`, `_KABLO_KANALI`, `_YATAY_SONDAJ`, `_PROJE`, `GPS`.
