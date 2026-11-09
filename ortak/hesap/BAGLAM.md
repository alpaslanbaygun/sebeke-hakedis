# Hesap Merkezi: bağlam, sonuç ve kayıt biçimi

Hesap araçları (ortak/hesap/kaynak) telefon uygulamasında ve AutoCAD eklentisinde aynı sayfalarla açılır. Sayfa
açılırken uygulama / eklenti seçili direğin, hattın ya da trafonun bilgilerini **bağlam** olarak verir; hesabın
uyarlaması (ortak/hesap/uyarlama/<id>.js) bunları hesabın kendi giriş alanlarına yazar. Hesap kaydedilince
**sonuç** ve hesabın **tam durumu** projeye yazılır.

Kural: hesap formülleri, tabloları ve hesap kodları değiştirilmez. Uyarlama yalnız giriş alanlarına değer yazar,
aracın kendi işlevlerini çağırır ve sonuçları okur. Projede olmayan bilgi tahminle doldurulmaz: "eksik" olarak
işaretlenir, kullanıcı girer.

## Bağlam (sürüm 1)

Bütün alanlar isteğe bağlıdır; bilinmeyen alan `null` ya da yoktur. Uzunluklar metre, açılar derece, güç kVA,
gerilim kV. Sayılar yuvarlanmış gelir (uzunluk 0,01 m, açı 0,01°) ki güncellik karşılaştırması kararlı olsun.

```js
{
  surum: 1,
  kaynak: 'telefon' | 'autocad',
  proje: { ad, kod, yapan, unvan, firma, tarih /* YYYY-AA-GG */, buzBolgesi /* '1'..'5' */ },
  hedef: { tur: 'direk'|'hat'|'trafo'|'kanal'|'proje', id, no, ad,
           hatId,                  // trafo hedefinde hesaplanan çıkış (kol) — kullanıcı seçtiyse
           kol },                  // isteğe bağlı: direk hedefinde hangi kolun (direk.kollar dizini) hesaplanacağı

  direk: {                     // hedef direkse ya da hattın bir direğinden açıldıysa
    id, no,
    tur: 'AG'|'OG'|'MUSTEREK'|'AYD'|'TRAFO',
    malzeme: 'beton'|'demir'|'agac'|null,
    tip,                       // ekranda görünen tip adı (telefon: "GD-10 (3 AWG)", AutoCAD: "G-D-10 (sw)")
    rol: 'T'|'D'|'N'|'K'|null, // taşıyıcı, durdurucu, nihayet, köşe
    rolKaynagi: 'tip'|'geometri'|'kullanici'|null,
    aci,                       // köşe sapma açısı α (doğru hat = 0)
    kot,                       // direk ayağının kotu H (m) — ölçülmemişse null
    yukseklik,                 // direk boyu (m) — bilinmiyorsa null
    baglanti,                  // iletken bağlantı yüksekliği (yerden, m) — yalnız kullanıcı girdiyse; yoksa null
    durum,                     // M, M+M, MEVCUT, DM, DM+M ...
    kollar: [                  // direkten çıkan her hat parçası (açıklık)
      { yon,                   // açıklığın yönü: kuzeyden saat yönünde derece (0–360)
        aciklik,               // yatay (2B) açıklık, m
        aciklik3B, dH,         // eğik uzunluk ve kot farkı (karşı − bu direk); kot yoksa null
        karsi: { id, no, tip, rol, kot },   // karşı direğin bağlantı yüksekliği burada yoktur: hat.direkler'den bulunur
        hatId, hatNo, hatTur,  // hatTur: AG_HAVAI, OG_HAVAI, MUSTEREK, AYDINLATMA, AG_YERALTI, OG_YERALTI ...
        gerilimKV,
        iletkenler: [ Iletken ] }
    ]
  },

  hat: {                       // hedef hatsa ya da direğin üzerindeki hat
    id, no, tur /* hatTur */, havai: true|false, gerilimKV,
    iletkenler: [ Iletken ],
    direkler: [ { id, no, tip, malzeme, rol, aci, kot, yukseklik, baglanti } ],   // sırayla, baştan sona
    acikliklar: [ { bas, bit /* direk no */, uzunluk /* 2B */, uzunluk3B, dH } ],
    toplamUzunluk,
    ruling                     // eşdeğer açıklık √(Σa³/Σa); hesaplanamadıysa null
  },

  trafo: { id, no, tip, gucKVA, ogKV, agKV, uk /* % */, pcu /* W */, adet },

  kanal: { id, no, uzunluk, zemin, genislik /* cm */, derinlik /* cm */, kablolar: [ Iletken ] },

  // Trafodan çıkan AG / OG zincir (gerilim düşümü, kısa devre): baştan uca sıralı parçalar
  zincir: [ { bas, bit /* düğüm no */, uzunluk, iletken: Iletken, havai: true|false } ],

  // hedef.tur === 'proje' (8.11.2026 eki; direk listeleri): projedeki bütün direkler ve hat zincirleri
  bolgeler: [ { id, ad, kod, grup } ],      // AutoCAD bölgeleri (projeler); telefonda [] (tek proje)
  direkler: [ { ...direk,                   // yukarıdaki direk alanları (kollar dahil)
                cins, dmDurum, hakedis, bolge /* bölge adı ya da null */, saga, yukari,
                malzemeler: [ { cins, tanim, durum, miktar, birim } ],   // direğin kendi pozu dışındaki kalemler
                hesap: { tepe: { R, Rx, Ry, oneri, tarih, durum } } | null } ],   // kayıtlı cer vektörü hesabı
  hatlar: [ { ...hat, bolge, durum, parcalar: [ id ] } ],   // her zincir bir kez (AutoCAD parçaları zincirlenir)
  liste: { direkler, hatlar, imza }         // sayılar ve FNV-1a imzası (no, tip, durum, rol, açı, malzeme sayısı;
                                            // güncellik için: değişince "güncel değil")
}
```

`Iletken`:

```js
{ ad,          // platformdaki yazım: telefon "3xSwallow", "3P+R", "3x50/16+70 AER", "NAYY 3x95+50";
               // AutoCAD "3xSW", "3X50/16+70 ALPEK", "3x95+50 Nyy Alm.", "1x150/25 Xlpe Alm.", "2(3xSW)" (çift devre)
  adet,        // aynı güzergâhta kaç devre (en az 1)
  devre }      // 'OG' | 'AG'
```

Uyarlamalar iletken adını köprünün `A.iletken(ad)` çözümleyicisiyle okur (ortak/hesap/kurallar.mjs › `iletkenCoz`:
aile ACSR / AAC / ABC / NAYY / NYY / XLPE-AL / XLPE-CU, tel adı, kesit, nötr, faz sayısı; AutoCAD'in "2(3xSW)"
yazımında `adet: 2`); her aracın kendi seçenek adlarına eşlemeyi uyarlama yapar.

AutoCAD'de hat parçadan parçaya zincirlenir: dallanma noktasında (bir direkte üçüncü bir parça) hattın düz devamı
(sapması 40°'den küçük olan parça) seçilir, kol ayrılır; düz devam yoksa zincir orada biter. Telefonda hat zaten
tek nesnedir (düğümleriyle). Zincir trafo ucundaysa trafodan başlar.

## Uyarlama arayüzü

Her hesabın uyarlaması tek bir kapalı işlev içinde `window.__SM_UYARLAMA` nesnesini tanımlar (aracın genel
adlarıyla çakışmasın diye üst düzeyde `var / let / const / function` tanımlanmaz):

```js
window.__SM_UYARLAMA = {
  hazir(A)            // isteğe bağlı: aracın kendi açılışı bittiyse true
  doldur(b, A)        // bağlamı giriş alanlarına yazar; döner:
                      // { dolan: [{ alan, deger, birim, yol, ham }],   // yol: bağlamdaki yer, ör. 'hat.acikliklar[0].uzunluk'
                      //   eksik: [{ alan, sec, neden, tamam, karar }],  // sec: giriş alanının seçicisi (turuncu çerçeve);
                      //                                                 // tamam(): varsa doğru dönünce "girildi" sayılır (tablosu
                      //                                                 // yeniden kurulan araçlar); karar:false → sonucu etkilemez,
                      //                                                 // eksik sayısına girmez
                      //   uyari: [metin],
                      //   kullanilan: { yol: deger } }                  // isteğe bağlı: dolan dışında güncellikte izlenecek değerler
  hesapla(A)          // isteğe bağlı: doldurduktan sonra yeniden hesap
  sonuc(A)            // döner: { ozet, durum: 'uygun'|'uygun-degil'|'bilgi',
                      //          girdiler: [{ad, deger, birim}], degerler: [{ad, deger, birim}],
                      //          tablo: { basliklar: [...], satirlar: [[...]] },   // isteğe bağlı (direk / düğüm listesi)
                      //          uyarilar: [metin] }   ya da { hata: 'neden' }
  durumAl(A)          // hesabın tam durumu (JSON'a çevrilebilir nesne)
  durumYukle(d, A)    // durumu geri yükler ve yeniden hesaplar
  bolumGoster(b, A)   // isteğe bağlı: sayfanın bir bölümüne açılış (moduller.json › bolum, ör. AG tek hat)
  alanAdlari(yol)     // isteğe bağlı: kayıt açılınca panelde yol yerine okunur alan adı
  notlar: [metin]     // bilgi panelinde "Hesap hakkında": doğrulanamayan tablo değerleri, bilinen sınırlar
}
```

Yazdırma: telefonda köprü `beforeprint` / `afterprint` olaylarını kendisi tetikler (`window.__SM.yazdirOlayli`);
yazdırılmayacak tuvaller `data-sm-baski="yok"` ile işaretlenir.

`A` yardımcıları (ortak/hesap/kopru.js): `A.$`, `A.$$`, `A.yaz(sec, deger)` (input + change olayı),
`A.sec(sec, deger|yazi|işlev)`, `A.secenekler`, `A.deger`, `A.metin`, `A.secili`, `A.sayi(yazi, ondalik)`,
`A.tr(sayi, basamak)`, `A.olay`, `A.tikla`, `A.bekle(ms)`, `A.norm(yazi)`, `A.iletken(ad)`, `A.ruling(acikliklar)`.

`durum` kuralı: araç bir uygunluk kararı veriyorsa ve girdiler tamamsa 'uygun' / 'uygun-degil'; karar yoksa ya da
girdiler eksikse 'bilgi'.

## Kayıt (projede)

```js
{ id, modul, modulAdi, modulSurumu,
  hedef: { tur, id, no, parcalar: [hat parça kimlikleri], hatId /* trafo çıkışı */ },
  ozet, durum,
  ayrinti: { girdiler, degerler, tablo, uyarilar },
  modulDurumu,                 // durumAl() çıktısı (JSON metni)
  kullanilan: { yol: deger },  // hesapta kullanılan bağlam değerleri — proje değişince "güncel değil"
  tarih, kaynak: 'telefon'|'autocad', yapan }
```

- Telefonda kayıtlar projenin `documents` tablosunda `kind: 'HESAP'` olarak, AutoCAD'de çizimin sözlüğünde
  (`SEBEKE_HAKEDIS › HESAPLAR`) saklanır; proje dosyasında (`.sebeke.json`) `hesaplar` dizisiyle taşınır.
- Aynı hedefte aynı hesap için bir güncel kayıt tutulur (yeniden kaydetme üzerine yazar); trafoda her çıkış
  (`hatId`) ayrı sayılır. Anahtar: `modul | tur | id | hatId` (telefon `kayitlar.js`, eklenti `HesapKaydi.Anahtar`).
- Platformlar arası: kayıt öbür platformda yapıldıysa (`kaynak` farklı) metin yazım farkları (tip adı, iletken
  yazımı) "değişti" sayılmaz; sayılar ve iletken kimliği (`IletkenAnahtari` / `iletkenCoz`) karşılaştırılır.
- Taşıma: AutoCAD kaydı telefona `hesaplar` dizisiyle gider (`telefonId` ile eşleşir), telefon kaydı AutoCAD'e
  SH_PROJEAL ile alınır (hedef kimlikleri çizim tanıtıcısına çevrilir; daha yeni tarih kazanır).
- **Güncellik**: kayıt açılınca ya da raporlanınca hedefin bugünkü bağlamı kurulur; `kullanilan` içindeki her yol
  bugünkü değerle karşılaştırılır (sayı 1e-6 göreli pay, metin birebir). Fark varsa "güncel değil" ve değişen
  bilgiler gösterilir. Kural eklentide `HesapGuncellik` (Cekirdek/Hesaplar.cs), telefonda köprüdeki `farklar` ile
  aynıdır.
