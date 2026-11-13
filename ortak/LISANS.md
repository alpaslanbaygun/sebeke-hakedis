# Lisans

AutoCAD eklentisi ve telefon uygulaması için internetsiz, cihaza bağlı lisans (13.11.2026). Kullanıcı kararları:
ikisi de lisanslı; sunucu yok, lisans cihaz koduna imzalanır; bitiş tarihi her lisansta seçilir ya da süresizdir;
lisanssız **7 gün** tam çalışır, sonra yalnız lisans girilebilir.

## Nasıl işler

1. Program bir **cihaz kodu** gösterir: AutoCAD'de **Lisans** düğmesi (şerit, Şebeke-M paneli) ya da `SH_LISANS`;
   telefonda **Ayarlar › Lisans**. Kod biçimi `PC-ABCD-EFGH-JKMN-PQRS` (PC: AutoCAD, TL: telefon, WB: web / ofis).
2. Kullanıcı kodu lisans verene gönderir (Kopyala / Gönder düğmeleri).
3. Lisans veren **lisans aracıyla** (`araclar/lisans/lisans-araci.html`, tarayıcıda açılır) gizli anahtar dosyasını seçer,
   cihaz kodunu, kime verildiğini, ürünü ve bitiş tarihini (ya da süresiz) yazar, **Lisansı üret** der. Çıkan metni ya da
   `.lisans` dosyasını kullanıcıya gönderir.
4. Kullanıcı lisansı programın Lisans penceresine yapıştırır ya da dosyadan açar, **Lisansı kaydet** der.

| Durum | Ne olur |
| --- | --- |
| Lisans yok, ilk 7 gün | Program tam çalışır; açılışta "Deneme sürümü: N gün kaldı" uyarısı |
| Lisans yok, 8. gün ve sonrası | AutoCAD'de komutlar çalışmaz, Lisans penceresi açılır; telefonda yalnız Lisans ekranı görünür |
| Geçerli lisans | Tam çalışır; bitişe 15 gün ve daha az kala uyarı |
| Lisansın süresi doldu | Deneme süresi de geçmişse kilit; yeni lisans girilir |
| Başka cihazın / başka ürünün lisansı, imzası tutmayan lisans | Kaydedilmez; hata açıklaması gösterilir |
| Bilgisayarın / telefonun saati geri alınmış | Son görülme tarihi esas alınır (deneme süresi uzamaz, süresi geçmiş lisans geri gelmez) |

## Biçim

- **Cihaz kodu:** önek + `SHA-256("sebeke-hakedis|cihaz|" + ham kimlik)` ilk 10 baytı, Crockford base32 (16 harf, O / I / L /
  U yok), dörderli gruplar. Ham kimlik: AutoCAD'de Windows'un `MachineGuid`'i (`HKLM\SOFTWARE\Microsoft\Cryptography`; yoksa
  bilgisayar adı); Android'de `Settings.Secure.ANDROID_ID` (uygulamanın imzasına bağlı, yeniden kurunca aynı kalır); web
  sürümünde ve köprüsüz telefonda ilk açılışta üretilen rastgele kimlik (tarayıcı verisi silinirse değişir).
- **Lisans metni:** `SHL1.<yük>.<imza>`; yük base64url JSON `{ v: 1, no, ad, cihaz, urun: hepsi|eklenti|telefon, verildi,
  bitis }` (tarihler YYYY-AA-GG, `bitis` boş: süresiz); imza `SHL1.<yük>` metninin RSASSA-PKCS1-v1_5 / SHA-256 imzası
  (RSA-2048). `.lisans` dosyası `#` ile başlayan açıklama satırları + lisans metnidir; programlar metnin içinden lisansı
  bulur (boşluk ve satır sonu önemsiz).
- **Doğrulama:** yalnız açık anahtarla (`ortak/lisans/acik-anahtar.json`; eklentiye gömülü kaynak, telefona
  `araclar/ortak-tablolar.mjs` kopyalar). İmza elle doğrulanır (C# `BigInteger`, JS `BigInt` + SHA-256), iki taraf aynı
  sonucu verir: `autocad/src/Cekirdek/Lisans.cs` ↔ `telefon/web/src/core/lisans.js`.
- **Saklama:** AutoCAD'de `%APPDATA%\SebekeHakedis\lisans.json` ve kayıt defteri `HKCU\Software\SebekeHakedis\Lisans`;
  telefonda ayarlar (`ds.setting('lisans')`) ve tarayıcı belleği (`sh-lisans`). İki yerde tutulur: en erken ilk açılış,
  en geç son görülme geçerlidir.

## Gizli anahtar

Lisansları yalnız **gizli anahtar** (`sebeke-m-lisans-gizli-anahtar.pem`) sahibi üretebilir. Dosya **depoya konmaz**
(`.gitignore`: `*.pem`, `*.lisans`), yedeklenip güvenli yerde saklanır; başkasının eline geçerse o kişi de lisans
üretebilir. Kaybolursa yeni anahtar çifti kurulur ve programlar yeni açık anahtarla yeniden derlenir — eski lisanslar
geçersiz olur.

- Yeni anahtar çifti: `node araclar/lisans/lisans-uret.mjs anahtar --ozel <depo dışında bir yol>.pem` (açık anahtarı
  `ortak/lisans/acik-anahtar.json`'a ve lisans aracına yazar), sonra `node araclar/ortak-tablolar.mjs`; ya da lisans aracında
  "Yeni anahtar çifti üret".
- Komut satırından lisans: `node araclar/lisans/lisans-uret.mjs uret --ozel <pem> --cihaz PC-… --ad "Kime" --bitis 2027-11-13
  --urun hepsi --no L-0001`; denetim: `… denetle --lisans <dosya ya da metin>`.

## Denemeler

- Ortak: `ortak/deneme/lisans/vektorler.json` (`araclar/lisans/lisans-deneme-uret.mjs` üretir; her seferinde yeni **deneme**
  anahtarı, gizli anahtarı yazılmaz). Eklenti: CekirdekTest `LisansOrtakDeneme`; telefon: `tests/lisans.test.mjs`.
- Pencere: PencereTest 45 / 45b / 40g (açık tema). Telefon arayüzü: `tests/ui/lisans_ui.py` (CI): deneme, kilit, geçersiz lisans.
- Sınırlar: internetsiz sistemde lisans iptali yoktur (süreli lisans verin); deneme süresi kayıtlar silinerek (AutoCAD'de iki
  yer, telefonda uygulama verisi) yeniden başlatılabilir.
