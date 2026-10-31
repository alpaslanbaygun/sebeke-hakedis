# Kod haritası

Otomatik üretilir, elle düzenlenmez: `python3 araclar/kod-haritasi/kod_haritasi.py` (310 dosya · 31 AutoCAD komutu ·
1.299 bağ). Dosya, komut ya da konu ararken önce burada arayın (`grep -i "kelime" HARITA.md`).
Bağlar dosyaların içinden çıkarılır: içe aktarma, tür kullanımı, komut tanımı, belge bağlantısı, dosya / tür adı
anma. Ad anmasına dayanan birkaç bağ yanlış olabilir; bir dosyayı değiştirmeden önce kendisini okuyun.

## 1. İki platformda aynı kural

Bu dosyalar aynı kuralı AutoCAD eklentisinde ve telefonda ayrı ayrı uygular: birini değiştirirseniz ötekini de
değiştirin ve iki tarafın denemelerini çalıştırın (`CekirdekTest`, `telefon/web/tests`).

| AutoCAD | Telefon | Eşleşmeyi gösteren satır |
| --- | --- | --- |
| `autocad/src/Cekirdek/CinsKodu.cs` | `telefon/web/src/interop/sh-core.cjs` | sh-core.cjs › cinsDuzelt. |
| `autocad/src/Cekirdek/Geometri.cs` | `telefon/web/src/export/dxf.js` | Telefondaki DXF yazıcıyla aynı kural (telefon/web/src/export/dxf.js › yaziKonumu). |
| `autocad/src/Cekirdek/HesapBaglami.cs` | `telefon/web/src/hesap/baglam.js` | da kanalın hesaplara giden bilgileri. Telefondaki bağlamla (telefon/web/src/hesap/baglam.js) aynı biçimdedir. |
| `autocad/src/Cekirdek/Hesaplar.cs` | `telefon/web/src/hesap/kayitlar.js` | ayrı sayılır). Telefondaki kural (telefon/web/src/hesap/kayitlar.js) ile aynıdır. |
| `autocad/src/Cekirdek/Iletkenler.cs` | `telefon/web/src/grid/lines.js` | <summary>Etiket ve ana kesit yazısı: OG'ler " + ", sonra " / ", sonra AG'ler " + " (telefondaki lineLabel ile aynı).</s… |
| `autocad/src/Cekirdek/KatmanAdlari.cs` | `telefon/web/src/interop/sh-core.cjs` | Görünümü bütün şebeke katmanlarını bir kez çevirir. Telefondaki karşılığı: sh-core.cjs › katmanAscii. |
| `autocad/src/Cekirdek/MalzemeYazimi.cs` | `telefon/web/src/grid/lines.js` | Telefondaki karşılığı: telefon/web/src/interop/sh-core.cjs › malzemeYazisi (aynı kurallar, aynı sıra). |
| `autocad/src/Cekirdek/MalzemeYazimi.cs` | `telefon/web/src/interop/sh-core.cjs` | Telefondaki karşılığı: telefon/web/src/interop/sh-core.cjs › malzemeYazisi (aynı kurallar, aynı sıra). |
| `autocad/test/CekirdekTest/Program.cs` | `telefon/web/src/export/dxf.js` | Yazı yeri parçanın kendi ekseninde (telefondaki dxf.js yaziKonumu ile aynı): yatay hatta dünya ekseniyle aynı, |
| `autocad/test/CekirdekTest/Program.cs` | `telefon/web/tests/malzeme-yazimi.test.mjs` | ortak/deneme/malzeme-yazimi.json'da; telefondaki deneme (telefon/web/tests/malzeme-yazimi.test.mjs) aynı dosyayı okur. |
| `autocad/test/CekirdekTest/Program.cs` | `telefon/web/tests/sebeke.test.mjs` | VOLT-EDAŞ Saha'nın yazdığı dosya (telefon/web/tests/sebeke.test.mjs çıktısı): boş çizime aktarılır, rapor aynı kalır |
| `autocad/src/Cekirdek/MalzemeYazimi.cs` | `telefon/web/src/export/dxf.js` | Malzeme adı ortak yazımla (eklentideki MalzemeYazimi): "3x50/16 Xlpe Alm." → "3x50/16 XLPE Al" |
| `autocad/src/Cekirdek/Semboller.cs` | `telefon/web/src/export/dxf.js` | Demontaj türünden (KESİK / SÖKÜK) demontaj varyantı: DM · KESIK · SOKUK (eklentideki Semboller.Varyant ile aynı). |
| `autocad/src/Cekirdek/Iletkenler.cs` | `telefon/web/src/hesap/baglam.js` | Eklentinin adetli yazımı: "3x(1x240/25 Xlpe Alm.)" (Cekirdek.Iletkenler.AdetliYazi ile aynı) |
| `autocad/src/Cekirdek/Iletkenler.cs` | `telefon/web/src/interop/sebeke.js` | Kalemin adedi: tam yazımdaki "3x(…)" ön ekinden (eklentideki Iletkenler.Adet ile aynı); yoksa 1. |
| `autocad/src/Cekirdek/DurumTespit.cs` | `telefon/web/src/interop/sh-core.cjs` | Durum Tespit satırları (C# DurumTespit). Her satır: {handle, proje, cins, tip, durum, birimFiyat, |
| `autocad/src/Cekirdek/Geometri.cs` | `telefon/web/src/interop/sh-core.cjs` | Noktanın bölgesi: içinde kaldığı en küçük bölge; hiçbirinde değilse en yakını (C# Geometri.BolgeSec). |
| `autocad/src/Cekirdek/Katsayilar.cs` | `telefon/web/src/interop/sh-core.cjs` | katsayilar.json (C# Katsayilar.JsonYap biçimi) → hesapta kullanılan tablolar. |
| `autocad/src/Cekirdek/NesneOkuyucu.cs` | `telefon/web/src/interop/sh-core.cjs` | Malzeme cinsinden eleman türü (NesneOkuyucu.ElemanTuru ile aynı). |
| `autocad/src/Cekirdek/NesneYazici.cs` | `telefon/web/src/interop/sh-core.cjs` | yazılıdır (eklentideki NesneYazici.HatEtiketi / EtiketGovdesi ile aynı). |
| `autocad/src/Cekirdek/ProjeDosyasi.cs` | `telefon/web/src/interop/sh-core.cjs` | Proje nesnesini dosya biçimine çevirir (C# ProjeDosyasi.Yaz ile aynı alanlar ve sıra). |
| `autocad/src/Cekirdek/CizimStili.cs` | `telefon/web/tests/dxf.test.mjs` | Eklentideki karşılıkları: CizimStili (renkler), CizimYazici.ParcaMetrajlariYaz + Geometri.Acikliklar (metraj). |
| `autocad/src/Cekirdek/Geometri.cs` | `telefon/web/tests/dxf.test.mjs` | Eklentideki karşılıkları: CizimStili (renkler), CizimYazici.ParcaMetrajlariYaz + Geometri.Acikliklar (metraj). |
| `autocad/src/Eklenti/CizimYazici.cs` | `telefon/web/tests/dxf.test.mjs` | Eklentideki karşılıkları: CizimStili (renkler), CizimYazici.ParcaMetrajlariYaz + Geometri.Acikliklar (metraj). |
| `autocad/src/Cekirdek/MalzemeYazimi.cs` | `telefon/web/tests/malzeme-yazimi.test.mjs` | Malzeme adlarının görünen yazımı (sh-core malzemeYazisi): eklentideki MalzemeYazimi.Duzelt ile aynı sonuç. |
| `autocad/src/Cekirdek/CinsKodu.cs` | `telefon/web/tests/uyum.test.mjs` | Eklentideki karşılıkları: CinsKodu (cins kodu düzeltmesi), KatmanAdlari (Türkçe karaktersiz katman adı). |
| `autocad/src/Cekirdek/KatmanAdlari.cs` | `telefon/web/tests/uyum.test.mjs` | Eklentideki karşılıkları: CinsKodu (cins kodu düzeltmesi), KatmanAdlari (Türkçe karaktersiz katman adı). |

## 2. Değişince en çok yeri etkileyenler

Kod (bağ sayısı): `autocad/test/CekirdekTest/Program.cs` 44, `autocad/src/Eklenti/Serit.cs` 44, `autocad/src/Eklenti/CizimKomutlari.cs` 43, `autocad/src/Cekirdek/Model.cs` 36, `autocad/src/Cekirdek/Turler.cs` 35, `autocad/src/Cekirdek/KomutRehberi.cs` 34, `autocad/src/Eklenti/Komutlar.cs` 30, `autocad/src/Eklenti/Pencereler.cs` 29, `telefon/web/src/core/schema.js` 27, `autocad/test/PencereTest/Program.cs` 26, `autocad/src/Cekirdek/SayiCoz.cs` 24, `autocad/src/Cekirdek/NesneYazici.cs` 23.

Belgeler (kodu en çok anan; kod değişince bakılır): `DEVIR.md` 74, `README.md` 36, `KULLANIM.md` 35, `autocad/paket/OKUBENI.txt` 32, `ortak/VERI-MODELI.md` 22.

Köprüler (kümeler arası yolların çoğu buradan geçer): `ortak/hesap/moduller.json` %26,9, `telefon/web/src/grid/lines.js` %8,8, `telefon/web/src/hesap/kayitlar.js` %5,4, `telefon/web/src/ui/screens/map.js` %5,0, `telefon/web/src/core/schema.js` %5,0, `autocad/src/Eklenti/Serit.cs` %4,9.

## 3. AutoCAD komutları

| Komut | Tanımlandığı dosya | Anıldığı yerler |
| --- | --- | --- |
| `SH_ALTLIK` | `autocad/src/Eklenti/AltlikKomutlari.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_AYARLAR` | `autocad/src/Eklenti/CizimKomutlari.cs` | HesapMerkezi.cs, KULLANIM.md, KomutRehberi.cs, Komutlar.cs, OKUBENI.txt |
| `SH_BOLGE` | `autocad/src/Eklenti/CizimKomutlari.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, README.md, SeritSimgeleri.cs |
| `SH_CBSBILGI` | `autocad/src/Eklenti/CbsKomutlari.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_DETAY` | `autocad/src/Eklenti/Komutlar.cs` | CIZIM-BICIMI-NOTLARI.md, DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt |
| `SH_DOKUM` | `autocad/src/Eklenti/Komutlar.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Pencereler.cs |
| `SH_ELEMAN` | `autocad/src/Eklenti/CizimKomutlari.cs` | HizliSecim.cs, Kategoriler.cs, KomutRehberi.cs, OKUBENI.txt, README.md |
| `SH_GORUNUM` | `autocad/src/Eklenti/CizimKomutlari.cs` | Aktarim.cs, CizimYazici.cs, DEVIR.md, KULLANIM.md, KomutRehberi.cs |
| `SH_HAKEDIS` | `autocad/src/Eklenti/CizimKomutlari.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_HAKKINDA` | `autocad/src/Eklenti/Komutlar.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_HAT` | `autocad/src/Eklenti/CizimKomutlari.cs` | HizliSecim.cs, Kategoriler.cs, KomutRehberi.cs, OKUBENI.txt, README.md |
| `SH_HESAP` | `autocad/src/Eklenti/HesapMerkezi.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, PLAN.md, README.md |
| `SH_HESAPLAR` | `autocad/src/Eklenti/HesapMerkezi.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, README.md, Serit.cs |
| `SH_HIZLI` | `autocad/src/Eklenti/CizimKomutlari.cs` | DEVIR.md, HizliSecim.cs, KomutRehberi.cs, OKUBENI.txt, README.md |
| `SH_HIZLIAYRINTI` | `autocad/src/Eklenti/CizimKomutlari.cs` | KomutRehberi.cs, Serit.cs |
| `SH_ICEAL` | `autocad/src/Eklenti/Komutlar.cs` | HesapMerkezi.cs, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, README.md |
| `SH_KANAL` | `autocad/src/Eklenti/CizimKomutlari.cs` | HizliSecim.cs, Kategoriler.cs, KomutRehberi.cs, OKUBENI.txt, README.md |
| `SH_KML` | `autocad/src/Eklenti/CbsKomutlari.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_MALZEME` | `autocad/src/Eklenti/CizimKomutlari.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, README.md, Serit.cs |
| `SH_METRAJ` | `autocad/src/Eklenti/CizimKomutlari.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_MIFAL` | `autocad/src/Eklenti/CbsKomutlari.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_MIFVER` | `autocad/src/Eklenti/CbsKomutlari.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |
| `SH_NOKTAAL` | `autocad/src/Eklenti/CizimKomutlari.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, README.md, SeritSimgeleri.cs |
| `SH_ONAY` | `autocad/src/Eklenti/CizimKomutlari.cs` | CIZIM-BICIMI-NOTLARI.md, DEVIR.md, HakedisOnayi.cs, KULLANIM.md, KomutRehberi.cs |
| `SH_OZET` | `autocad/src/Eklenti/Komutlar.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, README.md, Serit.cs |
| `SH_PROJEAL` | `autocad/src/Eklenti/CizimKomutlari.cs` | BAGLAM.md, DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt |
| `SH_PROJERAPOR` | `autocad/src/Eklenti/Komutlar.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, README.md, Serit.cs |
| `SH_RAPOR` | `autocad/src/Eklenti/Komutlar.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, README.md, Serit.cs |
| `SH_SERIT` | `autocad/src/Eklenti/Komutlar.cs` | KULLANIM.md, KomutRehberi.cs, OKUBENI.txt |
| `SH_SONDAJ` | `autocad/src/Eklenti/CizimKomutlari.cs` | HizliSecim.cs, Kategoriler.cs, KomutRehberi.cs, OKUBENI.txt, README.md |
| `SH_TOPLUMALZEME` | `autocad/src/Eklenti/CizimKomutlari.cs` | DEVIR.md, KULLANIM.md, KomutRehberi.cs, OKUBENI.txt, Serit.cs |

## 4. Dosyalar

Biçim: `yol` — ne işe yaradığı · satır · bağ · en sıkı bağlı olduğu dosyalar. Bağsız dosyaların adı başka hiçbir
dosyada geçmez (Android ayarları gibi bazıları yine de kullanılır).

### Eklenti kurulum paketi — `autocad/paket`

- `autocad/paket/KALDIR.bat` — Sebeke-M AutoCAD eklentisini kaldirir (uc kurulum klasorunden de). · 53 satır · 4 bağ · autocad.yml, DEVIR.md, KULLANIM.md
- `autocad/paket/KUR.bat` — Sebeke-M AutoCAD eklentisi kurulumu. · 95 satır · 5 bağ · autocad.yml, DEVIR.md, KULLANIM.md
- `autocad/paket/OKUBENI.txt` — ŞEBEKE-M — AutoCAD eklentisi · 77 satır · 32 bağ · autocad.yml, KALDIR.bat, KUR.bat
- `autocad/paket/PackageContents.xml` · 31 satır · 1 bağ · autocad.yml

### AutoCAD çekirdeği — `autocad/src/Cekirdek`

- `autocad/src/Cekirdek/Aktarim.cs` — Telefondan gelen projenin çizime aktarılmasında tek bir iş. · 297 satır · 9 bağ · Model.cs, Turler.cs, Program.cs
- `autocad/src/Cekirdek/CadVarlik.cs` — AutoCAD çiziminden toplanan tek bir nesnenin yalın hâli. Eklenti çizimi bu biçime çevirir; çekirdek… · 238 satır · 13 bağ · Json.cs, Program.cs, NesneYazici.cs
- `autocad/src/Cekirdek/CbsYapisi.cs` — CBS dosyasındaki bir sütun (öznitelik). · 236 satır · 10 bağ · KmlYazici.cs, Model.cs, Turler.cs
- `autocad/src/Cekirdek/CinsKodu.cs` — Cins kodlarındaki yazım hataları (31.10.2026): AG_ALİMİNYUM_KABLO → AG_ALÜMİNYUM_KABLO, KOFRA → KOF… · 33 satır · 8 bağ · sh-core.cjs, Katalog.cs, Program.cs
- `autocad/src/Cekirdek/CizimAyarlari.cs` — Metraj ve hacim kuralları (telefondaki hatMetraji / kanalHacmi ile aynı). · 164 satır · 12 bağ · Program.cs, Model.cs, CizimKomutlari.cs
- `autocad/src/Cekirdek/CizimStili.cs` — Bir katman anahtarının stili (ortak/katalog/cizim-stili.json › katmanlar). · 317 satır · 17 bağ · CizimYazici.cs, Program.cs, Json.cs
- `autocad/src/Cekirdek/DetaySorgu.cs` — Eksik malzeme sorgusunun süzgeçleri. Boş alan: hepsi. · 132 satır · 11 bağ · Model.cs, Pencereler.cs, Program.cs
- `autocad/src/Cekirdek/DurumTespit.cs` — DURUM TESPİT sayfasının bir satırı (AutoCAD raporuyla aynı sütunlar). · 204 satır · 11 bağ · Model.cs, Program.cs, SayiCoz.cs
- `autocad/src/Cekirdek/Geometri.cs` — Çizginin uzunluğunun yarısındaki nokta. · 229 satır · 17 bağ · Model.cs, dxf.js, Program.cs
- `autocad/src/Cekirdek/HakedisOnayi.cs` — Hakediş onayı — AutoCAD'in onay kaydıyla aynı (çizim sözlüğü HAK_ONAY / ONAY_DURUM&lt;n&gt;): her h… · 148 satır · 13 bağ · Model.cs, CizimKomutlari.cs, Pencereler.cs
- `autocad/src/Cekirdek/HaritaAltligi.cs` — Harita altlığı sağlayıcısı (karo sunucusu). · 340 satır · 7 bağ · AltlikKomutlari.cs, Pencereler.cs, Program.cs
- `autocad/src/Cekirdek/HesapBaglami.cs` — Hesabın açıldığı hedef: direk, hat (parçalı), trafo, kanal ya da proje. · 587 satır · 12 bağ · HesapMerkezi.cs, Model.cs, Program.cs
- `autocad/src/Cekirdek/HesapSunucu.cs` — Hesap Merkezi'nin yerel web sunucusu. Hesap sayfaları bilgisayarın tarayıcısında (Edge uygulama pen… · 277 satır · 7 bağ · Json.cs, Turler.cs, HesapMerkezi.cs
- `autocad/src/Cekirdek/Hesaplar.cs` — Hesap Merkezi'nde kaydedilen bir hesap sonucu: hangi hesap (modül), hangi direk / hat / trafo / pro… · 340 satır · 14 bağ · Json.cs, Program.cs, HesapMerkezi.cs
- `autocad/src/Cekirdek/Iletkenler.cs` — Bir hattaki bir iletken / kablo (çizim penceresinde ve şeritte seçilen): katalog kalemi ve adedi. · 162 satır · 15 bağ · Pencereler.cs, Model.cs, HizliSecim.cs
- `autocad/src/Cekirdek/Json.cs` — Küçük, bağımlılıksız JSON okuyucu/yazıcı. .NET Framework 4.6 ve .NET 8'de aynı çalışır. Nesneler: J… · 313 satır · 18 bağ · HesapMerkezi.cs, Hesaplar.cs, Program.cs
- `autocad/src/Cekirdek/Katalog.cs` — Katalogdaki bir kalem tipi (direk tipi, hat kesiti, malzeme). · 407 satır · 18 bağ · HizliSecim.cs, Pencereler.cs, CizimKomutlari.cs
- `autocad/src/Cekirdek/Kategoriler.cs` — Menüdeki bir öğe: komut + tür (+ cins süzgeci). Ör. "AG Direk" = SH_ELEMAN, AG_DIREK. · 110 satır · 14 bağ · HizliSecim.cs, Serit.cs, SeritOnizleme.cs
- `autocad/src/Cekirdek/KatmanAdlari.cs` — Katman adları Türkçe karaktersiz (31.10.2026): eklentinin yazdığı her katman ç ğ ı İ ö ş ü yerine c… · 71 satır · 9 bağ · NesneYazici.cs, CizimYazici.cs, Program.cs
- `autocad/src/Cekirdek/Katsayilar.cs` — Raporun hesap katsayıları. Değerler Durum Tespit dosyasının KATSAYILAR sayfasından alınmıştır. Orta… · 133 satır · 9 bağ · Json.cs, DurumTespit.cs, RaporYazici.cs
- `autocad/src/Cekirdek/KmlYazici.cs` — Çizimi Google Earth dosyası olarak yazar (KML; KMZ: sıkıştırılmış KML). Koordinatlar çizimin 3° TM… · 224 satır · 7 bağ · CbsYapisi.cs, Model.cs, Geometri.cs
- `autocad/src/Cekirdek/KomutRehberi.cs` — Eklentinin komutları ve kısa açıklamaları (Hakkında penceresi ve komut satırı listesi aynı listeden… · 42 satır · 34 bağ · SH_ALTLIK, SH_AYARLAR, SH_BOLGE
- `autocad/src/Cekirdek/Koordinat.cs` — Çizim koordinatı ile enlem-boylam arasında çeviri. Çizim: ITRF96 / TUREF, 3° TM (dilim orta meridye… · 105 satır · 6 bağ · Program.cs, MifDosyasi.cs, CbsKomutlari.cs
- `autocad/src/Cekirdek/MalzemeHafizasi.cs` — Malzeme hafızasındaki bir satır (elemana bağlı malzeme: travers, izolatör, armatür …). · 171 satır · 14 bağ · Model.cs, Turler.cs, Json.cs
- `autocad/src/Cekirdek/MalzemeYazimi.cs` — Malzeme adlarının görünen yazımı: katalogdaki adlar eski programdan geldiği gibi karışık yazılmıştı… · 138 satır · 11 bağ · Pencereler.cs, sh-core.cjs, lines.js
- `autocad/src/Cekirdek/MifDosyasi.cs` — MIF dosyasından okunan bir nesne (geometri, stil rengi, MID satırı). · 696 satır · 7 bağ · CbsKomutlari.cs, CbsYapisi.cs, Program.cs
- `autocad/src/Cekirdek/Model.cs` — Bir poz satırı: bir nesneye bağlı malzeme ya da iş kalemi. · 192 satır · 36 bağ · Aktarim.cs, CbsYapisi.cs, CizimKomutlari.cs
- `autocad/src/Cekirdek/NesneOkuyucu.cs` — AutoCAD eklentisiyle hazırlanmış bir çizimi ortak proje modeline çevirir. AutoCAD veriyi nesnelerin… · 417 satır · 20 bağ · Model.cs, Program.cs, Geometri.cs
- `autocad/src/Cekirdek/NesneYazici.cs` — Proje modelinden çizim nesnelerinin tarifini (CadVarlik) üretir: katman, blok, öznitelikler, köşele… · 457 satır · 23 bağ · Model.cs, Program.cs, CizimKomutlari.cs
- `autocad/src/Cekirdek/NoktaDosyasi.cs` — Ölçü noktası dosyası okuyucu (CSV / TXT). Telefonun "Noktalar (CSV)" çıktısını ve yaygın "Ad, Y, X,… · 151 satır · 4 bağ · SayiCoz.cs, Model.cs, CizimKomutlari.cs
- `autocad/src/Cekirdek/Numara.cs` — GIS numarası ve kalem sırası (telefondaki sonrakiGis / enBuyukSira ile aynı kurallar). · 56 satır · 6 bağ · Model.cs, Program.cs, CizimKomutlari.cs
- `autocad/src/Cekirdek/ProjeDosyasi.cs` — Ortak proje dosyası (.sebeke.json). Telefon ve bilgisayar bu dosyayı okuyup yazar. Biçimin açıklama… · 378 satır · 15 bağ · Json.cs, Model.cs, Program.cs
- `autocad/src/Cekirdek/ProjeOzeti.cs` — "Proje özeti" penceresinin verisi: çizimdeki projeler (bölgeler) ve seçilen projenin malzeme listes… · 228 satır · 13 bağ · Model.cs, DurumTespit.cs, KoyuTema.cs
- `autocad/src/Cekirdek/RaporYazici.cs` — Durum Tespit raporunu Excel dosyası olarak yazar (AutoCAD raporuyla aynı sayfa ve sütunlar). · 205 satır · 13 bağ · Model.cs, DetaySorgu.cs, Hesaplar.cs
- `autocad/src/Cekirdek/SayiCoz.cs` — AutoCAD verisindeki sayılar Türkçe biçimde yazılır ("16,8", ",00") ama bazı alanlarda nokta da görü… · 42 satır · 24 bağ · CizimAyarlari.cs, NesneOkuyucu.cs, Program.cs
- `autocad/src/Cekirdek/Semboller.cs` — Sembol geometrisinin bir parçası (ortak/katalog/semboller.json ilkelleri). · 246 satır · 18 bağ · Program.cs, CizimYazici.cs, NesneYazici.cs
- `autocad/src/Cekirdek/Turler.cs` — Eleman ya da hat türü: kod (veri), ad (ekranda), GIS numarası biçimi. · 93 satır · 35 bağ · Pencereler.cs, CizimKomutlari.cs, CbsYapisi.cs
- `autocad/src/Cekirdek/XlsxYazici.cs` — Excel (.xlsx) dosyası yazan küçük, bağımlılıksız yazıcı. Bilgisayarda Excel kurulu olması gerekmez.… · 307 satır · 3 bağ · RaporYazici.cs, ProjeOzeti.cs, DEVIR.md

### AutoCAD eklentisi — `autocad/src/Eklenti`

- `autocad/src/Eklenti/AltlikKomutlari.cs` — Harita altlığı (SH_ALTLIK): seçilen sağlayıcının karoları kullanıcının anahtarıyla indirilir, birle… · 498 satır · 11 bağ · HaritaAltligi.cs, Komutlar.cs, Json.cs
- `autocad/src/Eklenti/ArayuzSimgeleri.cs` — Arayüz simgeleri (şerit ve pencereler): 24×24 birimlik ince çizgi simgeleri, istenen renkte. "dolu"… · 291 satır · 5 bağ · SeritSimgeleri.cs, KoyuTema.cs, PencereTest.csproj
- `autocad/src/Eklenti/ArmaturTakibi.cs` — Direk ile armatür simgesi arasındaki bağ (SH_ARM genişletilmiş verisi): direkte [simgenin tanıtıcıs… · 478 satır · 5 bağ · Komutlar.cs, CizimYazici.cs, NesneYazici.cs
- `autocad/src/Eklenti/CbsKomutlari.cs` — Çizimi başka programlara aktarma: Google Earth (KML / KMZ) ve CBS (MapInfo MIF / MID). Koordinatlar… · 409 satır · 18 bağ · Komutlar.cs, MifDosyasi.cs, Turler.cs
- `autocad/src/Eklenti/CizimKomutlari.cs` — Çizim araçları: eleman, hat, kanal, sondaj, bölge, nokta alma, malzeme düzenleme, metraj, ayarlar v… · 1.603 satır · 43 bağ · Model.cs, Pencereler.cs, Turler.cs
- `autocad/src/Eklenti/CizimSozlugu.cs` — AutoCAD'in çizim sözlüğündeki kayıtlar (Named Objects Dictionary → sözlük → Xrecord, metin değerler… · 183 satır · 4 bağ · CizimKomutlari.cs, Ortam.cs, Komutlar.cs
- `autocad/src/Eklenti/CizimYazici.cs` — Çekirdeğin ürettiği tarifleri (CadVarlik) çizime yazar: katman, blok, öznitelik, köşe, genişletilmi… · 1.391 satır · 21 bağ · CizimStili.cs, Semboller.cs, NesneYazici.cs
- `autocad/src/Eklenti/Eklenti.csproj` · 74 satır · 3 bağ · autocad.yml, hesap-paketle.mjs, marka-uret.py
- `autocad/src/Eklenti/HesapMerkezi.cs` — Hesap kayıtlarının çizimde saklanması: Named Objects Dictionary → SEBEKE_HAKEDIS → HESAPLAR → kayıt… · 968 satır · 21 bağ · HesapBaglami.cs, Json.cs, Komutlar.cs
- `autocad/src/Eklenti/HizliSecim.cs` — Şeritteki hızlı çizimin seçimi: kategori, etkin öğe (ör. AG Havai › AG Direk), öğe başına cins ve t… · 607 satır · 21 bağ · Katalog.cs, Kategoriler.cs, Turler.cs
- `autocad/src/Eklenti/KenarTakibi.cs` — Kanal kenarlarını AutoCAD komutlarında kanalın ekseniyle birlikte tutar: eksen taşınınca, uzatılınc… · 223 satır · 7 bağ · NesneYazici.cs, SayiCoz.cs, CizimYazici.cs
- `autocad/src/Eklenti/Komutlar.cs` — Proje özeti: projeler (bölgeler) ve seçilen projenin malzeme listesi bir pencerede; listeler Excel'… · 422 satır · 30 bağ · CbsKomutlari.cs, Model.cs, HesapMerkezi.cs
- `autocad/src/Eklenti/KoyuTema.cs` — Koyu tema renkleri (telefonun koyu lacivert zemini; vurgu: AG yeşili). · 1.649 satır · 8 bağ · Pencereler.cs, Program.cs, ProjeOzeti.cs
- `autocad/src/Eklenti/Marka.cs` — Şebeke-M markası: ad, logo ve simge. Görseller eklentiye gömülüdür (ortak/marka; üretici araclar/ma… · 90 satır · 7 bağ · Serit.cs, Komutlar.cs, Pencereler.cs
- `autocad/src/Eklenti/Ortam.cs` — Bir komutun çalışma ortamı: çizimden okunan proje, çizimin ayarları, katalog, ön ekler, aktif haked… · 157 satır · 12 bağ · CizimKomutlari.cs, HesapMerkezi.cs, CizimSozlugu.cs
- `autocad/src/Eklenti/OrtamVerisi.cs` — Komut ortamının AutoCAD'e bağlı olmayan kısmı: çizimden okunan proje, ayarlar, katalog, ön ekler, a… · 133 satır · 23 bağ · Pencereler.cs, Model.cs, Program.cs
- `autocad/src/Eklenti/Pencereler.cs` — Toplu malzeme penceresinden çıkan satır: her seçili elemana eklenecek malzeme. · 2.860 satır · 29 bağ · CizimKomutlari.cs, DetaySorgu.cs, Iletkenler.cs
- `autocad/src/Eklenti/Serit.cs` — AutoCAD şerit menüsüne "ŞEBEKE-M" (çizim) ve "ŞEBEKE-M ARAÇLAR" sekmelerini ekler (Google Stitch ta… · 1.085 satır · 44 bağ · Kategoriler.cs, HizliSecim.cs, Komutlar.cs
- `autocad/src/Eklenti/SeritSimgeleri.cs` — Şerit ve pencere simgeleri (AutoCAD'e bağlı değil; denemede de çizilir). Kategori ve öğeler ince çi… · 256 satır · 20 bağ · Kategoriler.cs, Serit.cs, Semboller.cs
- `autocad/src/Eklenti/Toplayici.cs` — Açık çizimin model alanındaki nesneleri çekirdeğin anladığı yalın biçime (CadVarlik) çevirir. Yalnı… · 271 satır · 12 bağ · CizimYazici.cs, CizimKomutlari.cs, CadVarlik.cs

### AutoCAD çekirdek denemesi — `autocad/test/CekirdekTest`

- `autocad/test/CekirdekTest/CekirdekTest.csproj` · 27 satır · 9 bağ · autocad.yml, cizim-stili.json, kalemler.json
- `autocad/test/CekirdekTest/Program.cs` — Çekirdek testleri. ornek : depodaki örnek dökümle birim testleri (CI'da çalışır) dogrula dokum.json… · 1.604 satır · 44 bağ · DetaySorgu.cs, HesapBaglami.cs, Hesaplar.cs
- `autocad/test/CekirdekTest/ornek-dokum.json` · 47 satır · 4 bağ · CekirdekTest.csproj, PencereTest.csproj, Program.cs
- `autocad/test/CekirdekTest/telefon-proje.sebeke.json` · 1 satır · 4 bağ · CekirdekTest.csproj, PencereTest.csproj, Program.cs
- `autocad/test/CekirdekTest/volt-telefon.sebeke.json` · 718 satır · 2 bağ · CekirdekTest.csproj, Program.cs

### AutoCAD pencere denemesi — `autocad/test/PencereTest`

- `autocad/test/PencereTest/PencereTest.csproj` · 44 satır · 8 bağ · autocad.yml, marka-uret.py, ArayuzSimgeleri.cs
- `autocad/test/PencereTest/Program.cs` — Pencereleri örnek verilerle kurar, ekran görüntüsünü PNG olarak kaydeder ve Tamam'a basıldığında dö… · 571 satır · 26 bağ · KoyuTema.cs, Model.cs, Pencereler.cs
- `autocad/test/PencereTest/SeritOnizleme.cs` — Şerit menünün önizlemesi (AutoCAD olmadan): eklentinin şeridiyle aynı veri (kategoriler, öğeler, kı… · 482 satır · 15 bağ · Kategoriler.cs, Turler.cs, HizliSecim.cs

### Ortak belgeler — `ortak`

- `ortak/CIZIM-BICIMI-NOTLARI.md` — Eski program incelemesi — neyi nasıl yapıyor, bizde ne var, ne alınabilir — 17.10.2026'da eski prog… · 197 satır · 11 bağ · kalemler.json, CinsKodu.cs, KatmanAdlari.cs
- `ortak/VERI-MODELI.md` — Ortak veri modeli — Telefon uygulaması (Şebeke-M) ve AutoCAD eklentisi aynı **proje dosyasını** kul… · 255 satır · 22 bağ · ProjeDosyasi.cs, sebeke.js, sh-core.cjs

### Ortak belgeler — `ortak/deneme`

- `ortak/deneme/malzeme-yazimi.json` — Malzeme adlarının görünen yazımı: girdi → beklenen. Eklentideki MalzemeYazimi.Duzelt ile telefondak… · 41 satır · 5 bağ · malzeme-yazimi.test.mjs, Program.cs, CekirdekTest.csproj

### Hesap Merkezi (ortak) — `ortak/hesap`

- `ortak/hesap/BAGLAM.md` — Hesap Merkezi: bağlam, sonuç ve kayıt biçimi — Hesap araçları (ortak/hesap/kaynak) telefon uygulama… · 146 satır · 13 bağ · kurallar.mjs, kayitlar.js, HesapBaglami.cs
- `ortak/hesap/kopru-bas.js` — Şebeke-M hesap köprüsü — sayfa başı. Paketleyici (araclar/hesap-paketle.mjs) bu dosyayı her hesap s… · 146 satır · 3 bağ · hesap-paketle.mjs, kosk.js, DEVIR.md
- `ortak/hesap/kopru.js` — Şebeke-M hesap köprüsü — sayfa sonu. Paketleyici bunu her hesap sayfasının sonuna, modülün uyarlama… · 528 satır · 6 bağ · HesapMerkezi.cs, hesap-paketle.mjs, hesap.js
- `ortak/hesap/kurallar.mjs` — Hesap Merkezi ortak kuralları: iletken adı çözümleme, eşdeğer açıklık ve hangi hesabın hangi hedeft… · 193 satır · 10 bağ · hesap-paketle.mjs, Hesaplar.cs, baglam.js
- `ortak/hesap/merkez.html` — Hesap Merkezi · Şebeke-M · 393 satır · 7 bağ · hesap-paketle.mjs, HesapMerkezi.cs, HesapSunucu.cs
- `ortak/hesap/moduller.json` — Hesap Merkezi'ndeki hesaplar. Telefon uygulaması (Hesaplar ekranı, direk ve hat ekranları) ile Auto… · 101 satır · 21 bağ · kayitlar.js, ag-gd.html, ag-kd.html
- `ortak/hesap/tema.css` — Şebeke-M hesap teması: telefon uygulamasının koyu laciverdi (ortak tasarım). Yalnız ekranda uygulan… · 115 satır · 2 bağ · hesap-paketle.mjs, DEVIR.md

### Hesap Merkezi modülleri — `ortak/hesap/kaynak|uyarlama|dene`

Her hesap: `kaynak/<id>.html` (aracın özgün sayfası, formüllere dokunulmaz), `uyarlama/<id>.js|css`
(Şebeke-M uyarlaması: bağlam → alanlar, sonuç okuma, kayıt), `dene/<id>.json` (deneme durumları; koşucu
`araclar/hesap-dene.py`). Liste ve gruplar `ortak/hesap/moduller.json`; sözleşme `ortak/hesap/BAGLAM.md`.

| id | Hesap | Satır: kaynak · uyarlama js / css · dene |
| --- | --- | --- |
| `ag-gd` | AG Gerilim Düşümü ve Güç Kaybı Hesabı | 532 · 316 / 64 · 339 |
| `ag-kd` | AG Kısa Devre Hesabı Simülatörü | 978 · 294 / 59 · 137 |
| `amax` | Amax Hesabı — Travers Düzenleri (DfDs0-9) | 701 · 289 / 35 · 471 |
| `cu-al` | Bakır Kablo Kesitine Eşdeğer Alüminyum Kablo Kesiti | 275 · 84 / 24 · 31 |
| `enh-agaw` | ENH ag-aw Bağıntısı Kontrolü | 492 · 428 / 65 · 521 |
| `enh-sehim` | ENH Sehim Hesabı Simülatörü | 775 · 358 / 78 · 622 |
| `kanal` | Kanal Planı | 1.744 · 300 / 31 · 48 |
| `kopma` | İki Misli Buz Yükü — İletken Kopma Hesabı Simülatörü | 543 · 209 / 69 · 462 |
| `kosk` | Beton Köşk 3B Yerleşim Simülatörü (Monoblok + Prefabrik) | 8.836 · 366 / 68 · 510 |
| `og-gd` | OG Gerilim Düşümü ve Güç Kaybı Hesabı – TEDAŞ | 468 · 338 / 69 · 416 |
| `og-kd` | OG Kısa Devre Simülatörü v23 | 1.067 · 288 / 54 · 125 |
| `tepe-tedas` | Tepe Kuvveti Hesabı (TEDAŞ) | 491 · 428 / 44 · 407 |
| `tepe-vektor` | Cer Vektör Çizimi — Tepe Kuvveti Hesabı | 818 · 370 / 53 · 384 |
| `uplift` | ENH Uplift Kontrol Simülatörü | 890 · 400 / 109 · 697 |

### Hesap araçları (özgün) — `ortak/hesap/kaynak`

- `ortak/hesap/kaynak/DEGISIKLIKLER.md` — Hesap araçlarının kaynak kopyalarındaki değişiklikler — Araçlar bir elektrik-elektronik mühendisini… · 26 satır · 1 bağ · hesap-paketle.mjs

### Ortak katalog ve tablolar — `ortak/katalog`

- `ortak/katalog/cizim-stili.json` — Ortak çizim stili: telefonun DXF çıktısı (Lejant) ile AutoCAD eklentisi aynı tabloyu kullanır; iki… · 97 satır · 12 bağ · CizimStili.cs, CizimYazici.cs, cizim-stili.js
- `ortak/katalog/kalemler.json` — cins+tanim+birim başına bir kalem. katsayi: giriş biriminden rapor birimine çarpan (ör. kg/m, kg/ad… · 35.029 satır · 13 bağ · katalog-aktar.py, Katalog.cs, kalemler.js
- `ortak/katalog/kategoriler.json` — Çizim menüsünün kategorileri (şerit: önce kategori seçilir, yalnız o kategorinin öğeleri görünür).… · 103 satır · 16 bağ · Kategoriler.cs, Serit.cs, CekirdekTest.csproj
- `ortak/katalog/katsayilar.json` · 269 satır · 4 bağ · katsayilar.js, Katsayilar.cs, sh-core.cjs
- `ortak/katalog/semboller.json` — Lejant simge takımı. Boyutlar metre (1/1000 pafta). AutoCAD eklentisi blokları SH_ adıyla metre cin… · 4.580 satır · 15 bağ · semboller-uret.mjs, CizimYazici.cs, Program.cs
- `ortak/katalog/volt-eslesme.json` — Telefon uygulamasının (TEDAŞ poz kataloğu) verisi ile AutoCAD eklentisinin çizim biçimi (cins / tan… · 108 satır · 6 bağ · sebeke.js, volt-eslesme.js, PLAN.md

### Telefon — `telefon`

- `telefon/DEVAM-NOTU.md` — Şebeke-M — Devam notu (yeni Claude hesabı için) — Bu dosya projeyi başka bir Claude hesabında kaldı… · 105 satır · 8 bağ · build.mjs, cabin-recipe.js, lines.js
- `telefon/README.md` — Şebeke-M (telefon uygulaması) — EDAŞ şebeke işleri için Android saha uygulaması (GNSS ile direk, tr… · 24 satır · 6 bağ · README.md, DEVAM-NOTU.md, README_KAYNAK.txt
- `telefon/README_KAYNAK.txt` — VOLT-EDAŞ Saha 2.4.0 — Kaynak paketi · 194 satır · 18 bağ · ortak-tablolar.mjs, telefon.yml, volt-eslesme.json

### Telefon · Android kabuğu — `telefon/android`

- `telefon/android/AndroidManifest.xml` · 62 satır · 4 bağ · telefon.yml, pack_apk.py, GNSS-BAGLANTI.md
- `telefon/android/res/mipmap-anydpi-v26/ic_launcher.xml` · 5 satır · bağsız
- `telefon/android/res/values/colors.xml` · 5 satır · bağsız
- `telefon/android/res/values/strings.xml` · 4 satır · bağsız
- `telefon/android/res/values/styles.xml` · 11 satır · bağsız
- `telefon/android/src/tr/voltedas/saha/BleUartLink.java` · 118 satır · 3 bağ · GnssHub.java, GnssLink.java, GNSS-BAGLANTI.md
- `telefon/android/src/tr/voltedas/saha/BtSppLink.java` · 71 satır · 3 bağ · GnssHub.java, GnssLink.java, GNSS-BAGLANTI.md
- `telefon/android/src/tr/voltedas/saha/GnssHub.java` · 129 satır · 9 bağ · VoltBridge.java, NtripClient.java, GnssLink.java
- `telefon/android/src/tr/voltedas/saha/GnssLink.java` · 16 satır · 4 bağ · GnssHub.java, BleUartLink.java, BtSppLink.java
- `telefon/android/src/tr/voltedas/saha/KeepAliveService.java` · 45 satır · 4 bağ · GnssHub.java, MainActivity.java, VoltBridge.java
- `telefon/android/src/tr/voltedas/saha/MainActivity.java` · 238 satır · 4 bağ · VoltBridge.java, GnssHub.java, KeepAliveService.java
- `telefon/android/src/tr/voltedas/saha/NtripClient.java` · 399 satır · 5 bağ · NtripTest.java, VoltBridge.java, GnssHub.java
- `telefon/android/src/tr/voltedas/saha/PhoneGnss.java` · 70 satır · 2 bağ · GnssHub.java, GNSS-BAGLANTI.md
- `telefon/android/src/tr/voltedas/saha/Rtcm3Parser.java` · 72 satır · 3 bağ · NtripTest.java, NtripClient.java, GNSS-BAGLANTI.md
- `telefon/android/src/tr/voltedas/saha/VoltBridge.java` · 286 satır · 6 bağ · NtripClient.java, MainActivity.java, GnssHub.java
- `telefon/android/src/tr/voltedas/saha/VoltFileProvider.java` · 40 satır · 1 bağ · VoltBridge.java
- `telefon/android/stubs/java/lang/invoke/LambdaMetafactory.java` · 7 satır · bağsız
- `telefon/android/test/NtripTest.java` · 122 satır · 4 bağ · NtripClient.java, Rtcm3Parser.java, mock_caster.py
- `telefon/android/test/mock_caster.py` — Sahte düzeltme sunucusu (NtripTest.java ile): NTRIP v1 (ICY) ve v2 (HTTP/1.1 chunked), kaynak tablo… · 177 satır · 3 bağ · NtripTest.java, GNSS-BAGLANTI.md, README_KAYNAK.txt

### Telefon belgeleri — `telefon/docs`

- `telefon/docs/GNSS-BAGLANTI.md` — GNSS bağlantısı: dosyalar, düzeltme kaynakları, sabit istasyon — Telefon uygulamasının (Şebeke-M) G… · 108 satır · 16 bağ · AndroidManifest.xml, NtripClient.java, NtripTest.java
- `telefon/docs/KULLANIM-KILAVUZU.md` — Şebeke-M Kullanım Kılavuzu — 6 Ekim 2026 · 951 satır · 4 bağ · KULLANIM.md, README.md, GNSS-BAGLANTI.md

### Telefon — `telefon/seed`

- `telefon/seed/design_raw.json` · 23.520 satır · 1 bağ · build_seed.mjs

### Telefon · derleme araçları — `telefon/tools`

- `telefon/tools/build_apk.sh` — Şebeke-M (eski adı VOLT-EDAŞ Saha) APK üretimi (Gradle'sız): web paketi → aapt2 → ecj → d8 → hizala… · 32 satır · 2 bağ · telefon.yml, build.mjs
- `telefon/tools/build_seed.mjs` — Tasarım maketinden çıkarılan ham veriyi (design_raw.json) versiyonlu standart paketine (TEDAŞ 2026… · 342 satır · 2 bağ · seed_extras_v23.mjs, design_raw.json
- `telefon/tools/extract_design_data.js` · 27 satır · bağsız
- `telefon/tools/pack_apk.py` — AndroidManifest first · 67 satır · 1 bağ · AndroidManifest.xml
- `telefon/tools/seed_extras_v23.mjs` — v2.3 katalog ekleri: hava yalıtımlı (hd) hücreler, LED / sodyum armatürler, abone kofresi, MOD-5 tr… · 112 satır · 1 bağ · build_seed.mjs
- `telefon/tools/setup_tools.sh` — APK derleme araçlarını kurar (Android Studio / Gradle gerekmez). Gerekenler: node + npm, Java 17+. · 16 satır · 1 bağ · telefon.yml

### Telefon · web derleme — `telefon/web`

- `telefon/web/build.mjs` — Web paketini üretir: dist/www (APK assets) — app.js + app.css + fonts + seed + assets (logo) + inde… · 33 satır · 6 bağ · hesap-paketle.mjs, build_apk.sh, package.json
- `telefon/web/index.html` — Şebeke-M · 21 satır · bağsız
- `telefon/web/package-lock.json` · 530 satır · bağsız
- `telefon/web/package.json` · 18 satır · 2 bağ · telefon.yml, build.mjs
- `telefon/web/web.html` — Şebeke-M Web · 14 satır · 1 bağ · build.mjs

### Telefon · standart paket — `telefon/web/seed`

- `telefon/web/seed/standard-tedas-2026.json` · 1 satır · bağsız

### Telefon · uygulama — `telefon/web/src`

- `telefon/web/src/main.js` — Uygulama başlatıcı: offline veritabanı, standart paketi, servisler, arayüz. · 128 satır · 17 bağ · app.js, bridge.js, bus.js

### Telefon · CAD dosyaları — `telefon/web/src/cad`

- `telefon/web/src/cad/aci.js` — AutoCAD renk indeksi (ACI) → RGB tablosu ve CSS renk yardımcıları. Tablo özgün NCZ→DXF dönüştürücüd… · 62 satır · 2 bağ · index.js, map-engine.js
- `telefon/web/src/cad/dxf.js` — ASCII DXF okuyucu → birleşik CAD modeli (bkz. index.js). Özgün tek dosyalık NCZ→DXF dönüştürücüdeki… · 838 satır · 3 bağ · index.js, cad.test.mjs, ncz.js
- `telefon/web/src/cad/index.js` — CAD altlık okuma (DXF + Netcad NCZ) ve harita üzerinde kullanım için geometri yardımcıları. Birleşi… · 267 satır · 6 bağ · dxf.js, ncz.js, aci.js
- `telefon/web/src/cad/ncz.js` — Netcad NCZ (ikili) okuyucu → birleşik CAD modeli (bkz. index.js). Özgün tek dosyalık NCZ→DXF dönüşt… · 394 satır · 4 bağ · index.js, cad.test.mjs, dxf.js
- `telefon/web/src/cad/symbols.js` — Netcad sembol kütüphanesi (NCS) geometri tablosu — özgün NCZ→DXF dönüştürücüden birebir. NCZ dosyas… · 44 satır · 2 bağ · index.js, ncz.js

### Telefon · eski hesap ekranları — `telefon/web/src/calc`

- `telefon/web/src/calc/tepe.js` — AG-OG direk tepe kuvveti hesabı — TEDAŞ / EKAT tablo metodu (cer vektör toplamı + direk tipi seçimi… · 1.116 satır · 3 bağ · tepe.js, tepe.test.mjs, v23.test.mjs

### Telefon · çekirdek — `telefon/web/src/core`

- `telefon/web/src/core/bus.js` — Basit olay yolu: veri değişiklikleri, GNSS akışı ve UI yenilemeleri buradan yayılır. · 17 satır · 4 bağ · bridge.js, data-service.js, helpers.mjs
- `telefon/web/src/core/data-service.js` — Veri servisi: tüm yazma işlemleri buradan geçer. Her yazma → revizyon (+1), denetim kaydı (kim/ne/n… · 134 satır · 6 bağ · bus.js, helpers.mjs, ids.js
- `telefon/web/src/core/db.js` — Depolama adaptörleri: IndexedDB (cihaz, offline-first) ve bellek (test). Üst katman yalnızca bu ara… · 83 satır · 4 bağ · helpers.mjs, main.js, scenarios.test.mjs
- `telefon/web/src/core/ids.js` — Zaman sıralı benzersiz kimlik (ULID benzeri, 26 karakter Crockford base32). · 43 satır · 7 bağ · cad-service.js, data-service.js, main.js
- `telefon/web/src/core/roles.js` — Hakediş onay mekanizması (v2.3): roller, yetkiler, PIN. Projede en az bir etkin Yönetici tanımlanın… · 104 satır · 6 bağ · compute.js, project-service.js, project.js
- `telefon/web/src/core/schema.js` — Merkezi proje veri modeli — tek kaynak. Her proje kaydı ortak alanları taşır (BASE); tablo tanımlar… · 167 satır · 27 bağ · exporter.js, calc.js, catalog.js
- `telefon/web/src/core/source.js` — Veri kaynağı takibi — tek kaynak. Kayıtta saklanan dahili kod (points.source) + ölçüm kalitesi → sp… · 37 satır · 9 bağ · checks.js, equipment.js, field.js
- `telefon/web/src/core/standards.js` — Standart sürüm paketlerinin (poz kataloğu, direk/iletken/trafo tabloları, reçete kuralları) veritab… · 86 satır · 8 bağ · catalog.js, helpers.mjs, main.js
- `telefon/web/src/core/sync.js` — Offline-first senkronizasyon. Her yazma senkron kuyruğuna (outbox) düşer. İnternet gelince sunucuya… · 88 satır · 7 bağ · data-service.js, ids.js, main.js

### Telefon · hesap motoru — `telefon/web/src/engine`

- `telefon/web/src/engine/compute.js` — Proje hesap zinciri (saf fonksiyon): NOKTA/HARİTA → HAT → AÇIKLIK → DİREK ROLÜ/AÇI → MALZEME REÇETE… · 112 satır · 9 bağ · checks.js, enh.js, lines.js

### Telefon · dışa aktarma — `telefon/web/src/export`

- `telefon/web/src/export/dxf.js` — AutoCAD DXF (R12 / AC1009) üretici — Lejant.dxf katman, ACI, çizgi tipi ve sembol yapısıyla. Koordi… · 277 satır · 13 bağ · Geometri.cs, cizim-stili.js, semboller.js
- `telefon/web/src/export/exporter.js` — Dışa aktarım servisi: tüm formatlar + TEDAŞ/EDAŞ teslim paketi (ZIP + SHA-256 manifest). · 159 satır · 16 bağ · schema.js, dxf.js, export.js
- `telefon/web/src/export/gis.js` — GeoJSON (RFC 7946 WGS84 veya proje CRS), KML/KMZ (gerçek koordinat + 3B direk/iletken), Netcad NCN. · 68 satır · 2 bağ · exporter.js, zip.js
- `telefon/web/src/export/model.js` — Dışa aktarım için tek tip obje modeli (DXF, SHP, GeoJSON, KML, NCN, XLSX, rapor aynı veriyi kullanı… · 48 satır · 7 bağ · crs.js, exporter.js, lines.js
- `telefon/web/src/export/report.js` — Teknik rapor (yazdırılabilir HTML → PDF): proje, CRS, GNSS kalite, ekipman, hatlar/açıklıklar, ENH,… · 79 satır · 5 bağ · crs.js, exporter.js, metraj.js
- `telefon/web/src/export/shp.js` — ESRI Shapefile yazıcı: SHP + SHX + DBF + PRJ + CPG (PointZ / PolyLineZ), UTF-8 öznitelikler. · 106 satır · 2 bağ · crs.js, exporter.js
- `telefon/web/src/export/xlsx.js` — Bağımlılıksız XLSX (Office Open XML) yazıcı — metraj, Yeşil Defter sayfaları, hakediş, poz, malzeme. · 52 satır · 4 bağ · excel-import.js, exporter.js, scenarios.test.mjs
- `telefon/web/src/export/zip.js` — Bağımlılıksız ZIP yazıcı (KMZ, XLSX ve teslim paketi için). Varsa CompressionStream ile deflate. · 76 satır · 7 bağ · excel-import.js, exporter.js, gis.js

### Telefon · koordinat — `telefon/web/src/geo`

- `telefon/web/src/geo/crs.js` — Koordinat referans sistemleri: ITRF96/TUREF (GRS80), WGS84, ED50 (Uluslararası 1924), 3° TM (Gauss-… · 237 satır · 14 bağ · settings.js, export.js, gnss-service.js
- `telefon/web/src/geo/geom.js` — Düzlem (proje CRS, metre) geometri servisi: mesafe, semt, açı, alan, ofset, bölme, yakalama. · 100 satır · 8 bağ · calc.js, equipment.js, gnss-service.js
- `telefon/web/src/geo/tiles.js` — Harita karosu matematiği: küresel Web Mercator (EPSG:3857 — OSM, Esri, Google) ve elipsoidal Mercat… · 23 satır · 3 bağ · map-engine.js, services.js, v23.test.mjs

### Telefon · GNSS — `telefon/web/src/gnss`

- `telefon/web/src/gnss/gnss-service.js` — GNSS servisi: konum kaynağı yönetimi (harici alıcı / telefon / simülatör), NMEA durum makinesi, ant… · 349 satır · 9 bağ · bridge.js, crs.js, geom.js
- `telefon/web/src/gnss/nmea.js` — NMEA 0183 ayrıştırıcı: GGA, RMC, GST, GSA, GSV, HDT, VTG, ZDA (+ tüm talker'lar: GP/GN/GL/GA/GB/BD/… · 154 satır · 4 bağ · gnss-service.js, gnss.test.mjs, scenarios.test.mjs
- `telefon/web/src/gnss/ntrip-profiles.js` — Kayıtlı düzeltme profilleri: TUSAGA-Aktif (CORS-TR), kendi sabit istasyonunuz, yerel CORS ağları ve… · 278 satır · 5 bağ · duzeltme.js, gnss-service.js, gnss.test.mjs
- `telefon/web/src/gnss/quality.js` — GNSS ölçüm kabul kuralları. Telefon GPS ile harici GNSS kesin olarak ayrılır. Sonuç sınıfları: RTK… · 53 satır · 1 bağ · gnss-service.js
- `telefon/web/src/gnss/rtcm.js` — RTCM 3.x çerçeve ayrıştırıcı (0xD3 önsöz, 10 bit uzunluk, CRC-24Q) — mesaj türü istatistiği ve düze… · 59 satır · 1 bağ · duzeltme.js

### Telefon · şebeke çizimi — `telefon/web/src/grid`

- `telefon/web/src/grid/cabin-recipe.js` — Kabin (köşk / trafo binası) keşfi: gövde tipine göre ayrı kalem + her hücre ayrı kalem + trafo + AG… · 89 satır · 7 bağ · cabin.js, cabin.js, equipment.js
- `telefon/web/src/grid/cabin.js` — Beton köşk / trafo binası yerleşim modeli — özgün tek dosyalık "Beton Köşk 3B Yerleşim Simülatörü"… · 1.242 satır · 5 bağ · cabin-recipe.js, cabin.js, cabin.test.mjs
- `telefon/web/src/grid/catalog.js` — Katalog servisi: seçili standart sürümünün (StandardVersion) tüm teknik verisi. Veriler veritabanın… · 118 satır · 3 bağ · catalog.js, project-service.js, schema.js
- `telefon/web/src/grid/checks.js` — Otomatik uygunluk kontrolleri (kayıt öncesi ve proje geneli). Kodlar: UYUMSUZ · EKSİK VERİ · ÖLÇÜ K… · 111 satır · 8 bağ · calc.js, catalog.js, compute.js
- `telefon/web/src/grid/energize.js` — Enerji verme kontrolü: AG ve/veya OG tarafına enerji verildiğinde hangi hat ve objelerin enerjili,… · 77 satır · 2 bağ · map.js, v23.test.mjs
- `telefon/web/src/grid/enh.js` — ENH / havai hat mekanik hesap motoru. Değişik haller denklemi (parabolik), ideal (ruling) açıklık,… · 140 satır · 1 bağ · compute.js
- `telefon/web/src/grid/lines.js` — Hat sistemi: havai iletken metrajı (m / kg), yeraltı kablo + kanal metrajı, abone hattı ekleri. Kg… · 147 satır · 15 bağ · MalzemeYazimi.cs, baglam.js, calc.js
- `telefon/web/src/grid/network.js` — Şebeke geometrisi ve topolojisi: açıklıklar, direk rolleri/köşe açıları, bağlantı grafiği. Girdi: n… · 159 satır · 2 bağ · compute.js, geom.js
- `telefon/web/src/grid/recipe.js` — Otomatik malzeme reçetesi motoru. Reçete = Ekipman tipi + Hat tipi + İletken sınıfı + Rol + İş tipi… · 152 satır · 13 bağ · equipment.js, cabin-recipe.js, cabin.js

### Telefon · Hesap Merkezi — `telefon/web/src/hesap`

- `telefon/web/src/hesap/baglam.js` — Hesap Merkezi bağlamı (ortak/hesap/BAGLAM.md, sürüm 1): telefondaki projeden seçili direğin, hattın… · 262 satır · 9 bağ · sebeke.test.mjs, HesapBaglami.cs, hesap.js
- `telefon/web/src/hesap/kayitlar.js` — Hesap kayıtları (ortak/hesap/BAGLAM.md › Kayıt): projenin documents tablosunda kind 'HESAP'. Aynı h… · 86 satır · 11 bağ · Hesaplar.cs, baglam.js, calc.js

### Telefon · AutoCAD aktarımı — `telefon/web/src/interop`

- `telefon/web/src/interop/sebeke.js` — AutoCAD eklentisiyle dosya uyumu: telefon projesi ↔ .sebeke.json (ortak/VERI-MODELI.md). sebekeYaz(… · 979 satır · 17 bağ · volt-eslesme.js, sh-core.cjs, volt-eslesme.json
- `telefon/web/src/interop/sh-core.cjs` — Şebeke-M — telefonun hesap çekirdeği. AutoCAD eklentisindeki C# çekirdeğinin (autocad/src/Cekirdek)… · 1.041 satır · 19 bağ · sebeke.js, MalzemeYazimi.cs, CinsKodu.cs

### Telefon · yerel köprü — `telefon/web/src/native`

- `telefon/web/src/native/bridge.js` — Yerel (Android) köprü soyutlaması. APK içinde window.VoltNative (Java @JavascriptInterface) kullanı… · 106 satır · 3 bağ · bus.js, gnss-service.js, main.js

### Telefon · ortak tablolar — `telefon/web/src/ortak`

- `telefon/web/src/ortak/cizim-stili.js` — Bu dosya araclar/ortak-tablolar.mjs ile ortak/katalog/cizim-stili.json dosyasından üretilir. Elle d… · 2 satır · 5 bağ · dxf.js, dxf.test.mjs, cizim-stili.json
- `telefon/web/src/ortak/kalemler.js` — Bu dosya araclar/ortak-tablolar.mjs ile ortak/katalog/kalemler.json dosyasından üretilir. Elle düze… · 2 satır · 6 bağ · malzeme-yazimi.test.mjs, sebeke.js, uyum.test.mjs
- `telefon/web/src/ortak/katsayilar.js` — Bu dosya araclar/ortak-tablolar.mjs ile ortak/katalog/katsayilar.json dosyasından üretilir. Elle dü… · 2 satır · 3 bağ · sebeke.test.mjs, katsayilar.json, ortak-tablolar.mjs
- `telefon/web/src/ortak/semboller.js` — Bu dosya araclar/ortak-tablolar.mjs ile ortak/katalog/semboller.json dosyasından üretilir. Elle düz… · 2 satır · 5 bağ · dxf.js, semboller-uret.mjs, semboller.test.mjs
- `telefon/web/src/ortak/volt-eslesme.js` — Bu dosya araclar/ortak-tablolar.mjs ile ortak/katalog/volt-eslesme.json dosyasından üretilir. Elle… · 2 satır · 6 bağ · sebeke.js, durum-kodu.js, uyum.test.mjs

### Telefon · metraj — `telefon/web/src/qty`

- `telefon/web/src/qty/hakedis.js` — Hakediş motoru: Proje → İş Programı → Hakediş Dönemi → Poz → Önceki / Bu dönem / Kümülatif / Kalan.… · 73 satır · 2 bağ · metraj.js, project-service.js
- `telefon/web/src/qty/metraj.js` — Otomatik metraj ve Yeşil Defter satırları. Montaj / Demontaj / DMM tamamen ayrı tutulur; servis kod… · 81 satır · 7 bağ · calc.js, compute.js, exporter.js

### Telefon · servisler — `telefon/web/src/services`

- `telefon/web/src/services/cad-service.js` — CAD çizimi (DXF / NCZ) servisi: dosyayı oku, projeye kaydet, haritada katman olarak göster, noktaya… · 86 satır · 6 bağ · ids.js, index.js, map.js
- `telefon/web/src/services/excel-import.js` — Excel Import Service — şablon üretimi, XLSX/CSV okuma, doğrulama (önizleme) ve toplu aktarım. Akış:… · 259 satır · 6 bağ · field.js, scenarios.test.mjs, schema.js
- `telefon/web/src/services/photo-service.js` — Photo Service — fotoğraf adlandırma ({ObjeNo}_{Sıra}.jpg), proje klasör yolu, görüntü üstü bilgi sa… · 145 satır · 5 bağ · exporter.js, records.js, scenarios.test.mjs
- `telefon/web/src/services/project-service.js` — Proje servisi: veritabanı ile hesap zincirini bağlar. UI yalnızca bu servisi çağırır. · 598 satır · 9 bağ · catalog.js, compute.js, crs.js
- `telefon/web/src/services/survey-service.js` — Survey Service — saha objesi oluşturma (veri kaynağından bağımsız tek giriş noktası) ve koordinat g… · 180 satır · 9 bağ · crs.js, equipment.js, excel-import.js

### Telefon · arayüz — `telefon/web/src/ui`

- `telefon/web/src/ui/app.js` — Uygulama kabuğu: HUD, alt sekme çubuğu, gezinme yığını, bildirimler, modal pencereler. · 101 satır · 4 bağ · ctx.js, index.js, kit.js
- `telefon/web/src/ui/ctx.js` — Uygulama bağlamı: servis örnekleri ve gezinme. UI bileşenleri iş kurallarına yalnız bu nesne üzerin… · 5 satır · 20 bağ · app.js, cabin.js, calc.js
- `telefon/web/src/ui/durum-kodu.js` — AutoCAD / AutoCAD alanları: kaydın çizim durum kodu (M, M+M, KM, DM, DM+M, MEVCUT, ENH, ME) ve demo… · 18 satır · 5 bağ · equipment.js, kit.js, records.js
- `telefon/web/src/ui/kit.js` — UI yapı taşları (Preact + htm). İş kuralı içermez; yalnız görünüm ve etkileşim. · 93 satır · 21 bağ · app.js, cabin.js, calc.js
- `telefon/web/src/ui/map-engine.js` — Canvas tabanlı GIS motoru: proje CRS (TM, metre) düzleminde çizim, XYZ altlık (TM'ye affine büküler… · 422 satır · 4 bağ · aci.js, crs.js, map.js
- `telefon/web/src/ui/screens/cabin.js` — Kabin düzenleyici: köşk / trafo binası tipi, içindeki hücreler (ekle · çıkar · sırala), kablo kanal… · 145 satır · 8 bağ · cabin-recipe.js, cabin.js, ctx.js
- `telefon/web/src/ui/screens/calc.js` — 04 · Hesaplar (açıklık/sehim, köşe açıları, direk tipi kontrolü, Yeşil Defter özeti) + ENH · Metraj… · 147 satır · 9 bağ · checks.js, ctx.js, geom.js
- `telefon/web/src/ui/screens/catalog.js` — 07 · Poz Kataloğu · 08 · Katmanlar & Lejant · 09 · Tanımlar (tek veri kaynağı) · 179 satır · 8 bağ · catalog.js, checks.js, ctx.js
- `telefon/web/src/ui/screens/duzeltme.js` — Ayarlar › Düzeltme kaynağı: TUSAGA-Aktif (CORS-TR), kendi sabit istasyonunuz, yerel CORS ağları. Ba… · 185 satır · 5 bağ · ctx.js, kit.js, ntrip-profiles.js
- `telefon/web/src/ui/screens/equipment.js` — 03 · Ekipman Kaydı (Direk · Trafo · SDK · Aydınlatma · Abone · Menhol) Reçete otomatik; kullanıcı y… · 192 satır · 14 bağ · recipe.js, cabin-recipe.js, cabin.js
- `telefon/web/src/ui/screens/export.js` — 05 · Dışa Aktarım — gerçek dosya üretimi (DXF, NCN, KMZ, SHP, GeoJSON, XLSX, rapor, teslim paketi) · 56 satır · 6 bağ · crs.js, ctx.js, exporter.js
- `telefon/web/src/ui/screens/field.js` — Saha operasyonu ekranları (v2.2): Excel toplu aktarım · Saha objeleri listesi · Sabit Base + Rover… · 238 satır · 9 bağ · ctx.js, excel-import.js, index.js
- `telefon/web/src/ui/screens/hesap.js` — Teknik hesaplar (Hesap Merkezi): hesap listesi, seçili direğe / hatta / trafoya uygun hesaplar, kay… · 138 satır · 7 bağ · baglam.js, ctx.js, index.js
- `telefon/web/src/ui/screens/index.js` — Ekran kayıt defteri · 25 satır · 15 bağ · app.js, cabin.js, calc.js
- `telefon/web/src/ui/screens/map.js` — 01 · Harita & Nokta Alımı — gerçek GIS motoru + tek elle hızlı ekipman/hat alımı. · 826 satır · 21 bağ · cabin-recipe.js, cabin.js, cad-service.js
- `telefon/web/src/ui/screens/matpick.js` — Katalogdan malzeme seçme kutusu (ekipman ve hat kayıtlarında ortak) · 13 satır · 3 bağ · ctx.js, kit.js, records.js
- `telefon/web/src/ui/screens/project.js` — Proje merkezi (akış: PROJE → GNSS → SAHA → ALIM → HAT → BAĞLANTI → REÇETE → METRAJ → HAKEDİŞ → KONT… · 208 satır · 11 bağ · crs.js, ctx.js, index.js
- `telefon/web/src/ui/screens/records.js` — Nokta kaydı · Hat kaydı · Fotoğraf (kanıt) ekranları · 233 satır · 15 bağ · crs.js, ctx.js, durum-kodu.js
- `telefon/web/src/ui/screens/settings.js` — 06 · Ayarlar — konum kaynağı, GNSS alıcı (Bluetooth SPP/BLE), NTRIP, hassasiyet eşikleri, proje CRS… · 141 satır · 7 bağ · crs.js, ctx.js, duzeltme.js
- `telefon/web/src/ui/screens/stakeout.js` — 02 · Aplikasyon — gerçek hedef noktadan canlı yönlendirme (ileri/sağ-sol, kot, semt, eksen ofseti,… · 118 satır · 6 bağ · cad-service.js, ctx.js, geom.js
- `telefon/web/src/ui/screens/team.js` — Kullanıcılar, roller ve hakediş onayı (v2.3) Ortak parçalar: HakRow (durum düğmeleri, yetkiye göre)… · 180 satır · 8 bağ · ctx.js, equipment.js, index.js
- `telefon/web/src/ui/screens/tepe.js` — Cer vektör hesabı ve direk tepe kuvveti. Kollar (yön + açıklık) çizimden ya da uygulamadaki hatlard… · 157 satır · 5 bağ · ctx.js, index.js, kit.js
- `telefon/web/src/ui/services.js` — UI tarafı yardımcı servisler: ölçüm oturumu, nokta alma akışı, karo önbelleği, son kullanılanlar. · 209 satır · 8 bağ · ctx.js, ids.js, kit.js
- `telefon/web/src/ui/theme.css` · 294 satır · 1 bağ · main.js

### Telefon · web yardımcıları — `telefon/web/src/web`

- `telefon/web/src/web/cloud-adapter.js` — Web sürümü depolama adaptörü: çalışma kopyası bellekte, kalıcı kopya bulut belge deposunda. Üst kat… · 283 satır · 3 bağ · main.js, schema.js, web.test.mjs
- `telefon/web/src/web/platform.js` — Web (ofis) sürümü platform katmanı. Yayınlanan sayfa kilitli bir çerçevede çalışır: dosya indirme y… · 77 satır · 3 bağ · main.js, web.test.mjs, zip.js

### Telefon denemeleri — `telefon/web/tests`

- `telefon/web/tests/cabin.test.mjs` — Beton köşk / trafo binası yerleşim modeli (src/grid/cabin.js) — özgün tek dosyalık araca karşı altı… · 680 satır · 1 bağ · cabin.js
- `telefon/web/tests/cad.test.mjs` — CAD altlık okuyucuları (src/cad) — DXF + Netcad NCZ ve geometri yardımcıları. DXF testleri metni te… · 796 satır · 3 bağ · dxf.js, index.js, ncz.js
- `telefon/web/tests/dxf.test.mjs` — DXF çıktısının çizim görünümü: hat renkleri (ortak stil), Tahoma, yazılar hattın renginde, metraj a… · 99 satır · 5 bağ · cizim-stili.js, dxf.js, CizimStili.cs
- `telefon/web/tests/fake-cloud.mjs` — Sahte bulut belge deposu (web sürümü testleri): yayınlanan sayfadaki "db" yeteneğinin kullanılan al… · 36 satır · 1 bağ · web.test.mjs
- `telefon/web/tests/fixtures/ornek-proje.sebeke.json` · 62 satır · bağsız
- `telefon/web/tests/gnss.test.mjs` — Düzeltme (CORS / sabit istasyon) bağlantıları: hazır profiller, bağlantı bilgisi dosyası, metinden… · 206 satır · 4 bağ · gnss-service.js, nmea.js, ntrip-profiles.js
- `telefon/web/tests/helpers.mjs` — Test yardımcıları: bellek veritabanı + gerçek standart paketi + Elazığ civarı gerçekçi saha verisi · 67 satır · 13 bağ · bus.js, crs.js, data-service.js
- `telefon/web/tests/malzeme-yazimi.test.mjs` — Malzeme adlarının görünen yazımı (sh-core malzemeYazisi): eklentideki MalzemeYazimi.Duzelt ile aynı… · 32 satır · 5 bağ · malzeme-yazimi.json, kalemler.js, sh-core.cjs
- `telefon/web/tests/scenarios.test.mjs` — 25 saha senaryosu — gerçek standart verisi (Yeşil Defter 26.23.GR.02) ve Elazığ civarı TM39 koordin… · 723 satır · 15 bağ · crs.js, db.js, excel-import.js
- `telefon/web/tests/sebeke.test.mjs` — AutoCAD eklentisiyle dosya uyumu: telefon projesi → .sebeke.json → (Durum Tespit) ve .sebeke.json →… · 504 satır · 10 bağ · baglam.js, exporter.js, helpers.mjs
- `telefon/web/tests/semboller.test.mjs` — Ortak simge takımı: telefonun tablosu (src/export/semboller.js) depodaki ortak dosyayla (ortak/kata… · 82 satır · 4 bağ · dxf.js, semboller.js, ortak-tablolar.mjs
- `telefon/web/tests/tepe.test.mjs` — Direk tepe kuvveti hesabı (src/calc/tepe.js) — özgün tek dosyalık araca karşı altın testler. tests/… · 596 satır · 1 bağ · tepe.js
- `telefon/web/tests/ui/gnss_ui.py` — Arayüz denemesi: Ayarlar › Düzeltme kaynağı (TUSAGA-Aktif, sabit istasyon, yerel CORS; NTRIP / doğr… · 176 satır · 1 bağ · telefon.yml
- `telefon/web/tests/ui/native_mock.py` — Yerel köprü protokol testi: window.VoltNative taklidi (Java yanıtları + NMEA/NTRIP olayları) ile JS… · 80 satır · bağsız
- `telefon/web/tests/ui/smoke.py` — Arayüz duman testi: Chromium (mobil 390x844) + simülatör GNSS ile uçtan uca saha akışı · 222 satır · bağsız
- `telefon/web/tests/ui/upgrade.py` — Sürüm geçiş testi: 2.1.0 ile oluşturulan veritabanı (IndexedDB) 2.2.0 ile açılır, sonra tekrar 2.1.… · 89 satır · bağsız
- `telefon/web/tests/ui/upgrade23.py` — Sürüm geçiş testi: 2.2.0 ile oluşturulan veritabanı 2.3.0 ile açılır (katalog güncellenir, veriler… · 70 satır · bağsız
- `telefon/web/tests/ui/upgrade24.py` — Sürüm geçiş testi: 2.3.0 ile oluşturulan veritabanı 2.4.0 ile açılır (katalog güncellenir, veriler… · 107 satır · bağsız
- `telefon/web/tests/ui/v23_grid.py` — v2.3 denemesi: enerji kontrolü, otomatik numara, CAD çizimi, tepe kuvveti · 89 satır · bağsız
- `telefon/web/tests/ui/v23_lib.py` — v2.3 arayüz denemeleri için ortak yardımcılar · 35 satır · bağsız
- `telefon/web/tests/ui/v23_team.py` — v2.3 denemesi: kullanıcılar, roller, şifreli oturum, onay bekleyenler · 75 satır · bağsız
- `telefon/web/tests/ui/v23_web.py` — v2.3 denemesi (web / ofis genişliği): enerji paneli, CAD paneli, kullanıcılar ekranı, tepe kuvveti · 33 satır · bağsız
- `telefon/web/tests/ui/v24_ui.py` — v2.4 arayüz denemesi: direkte armatür, DİĞER listesi, PB köşk + hücresiz kabin, kanal (kaplama + yö… · 115 satır · bağsız
- `telefon/web/tests/ui/v24_web.py` — v2.4 denemesi (web / ofis genişliği): direk kaydında armatür, hat kaydında kanal + elle malzeme, ka… · 50 satır · bağsız
- `telefon/web/tests/ui/web.py` — Web (ofis) sürümü arayüz testi: sahte bulut (window.claude) ile masaüstü + telefon genişliği. Akış:… · 142 satır · bağsız
- `telefon/web/tests/uyum.test.mjs` — Masaüstü (AutoCAD eklentisi) ile telefon arasındaki veri uyumu: cins kodları, katman adları, ortak… · 54 satır · 6 bağ · kalemler.js, sh-core.cjs, volt-eslesme.js
- `telefon/web/tests/v23.test.mjs` — v2.3: Spectra cümleleri, Yandex karo matematiği, katalog güncelleme, kabin keşfi, kofre, enerji kon… · 361 satır · 10 bağ · cabin.js, cad-service.js, energize.js
- `telefon/web/tests/v24.test.mjs` — v2.4: otomatik reçete kapalı (varsayılan), elle malzeme, direkte armatür, yeni kanal hesabı (kaplam… · 281 satır · 7 bağ · cabin-recipe.js, cabin.js, helpers.mjs
- `telefon/web/tests/web.test.mjs` — Web (ofis) sürümü: bulut kaydı adaptörü, telefon ↔ web veri alışverişi, indirme sarmalayıcı · 243 satır · 9 bağ · cad-service.js, cloud-adapter.js, fake-cloud.mjs

### Proje belgeleri — `kök`

- `.gitattributes` · 10 satır · bağsız
- `DEVIR.md` — Devir notu — Bu proje başka bir hesaba (GitHub ya da Claude) geçerken sohbet geçmişi taşınmaz. Deva… · 245 satır · 74 bağ · HesapMerkezi.cs, HesapSunucu.cs, baglam.js
- `KULLANIM.md` — Şebeke-M — Kullanım Kılavuzu — İki araç var, ikisi aynı proje dosyasını (`.sebeke.json`) kullanır: · 499 satır · 35 bağ · cizim-stili.json, KALDIR.bat, KUR.bat
- `PLAN.md` — Plan — telefon uygulaması bırakıldı, geri dönüş: `telefon-eski-0.2.3` dalı). Kataloğu TEDAŞ pozları… · 111 satır · 16 bağ · ArayuzSimgeleri.cs, cizim-stili.json, kategoriler.json
- `README.md` — Şebeke-M — Elektrik dağıtım şebekesi yapım işlerinde saha ölçümü, metraj, hakediş, Durum Tespit rap… · 78 satır · 36 bağ · hesap-dene.py, hesap-paketle.mjs, ortak-tablolar.mjs

### Otomatik derleme (CI) — `.github`

- `.github/workflows/autocad.yml` — AutoCAD eklentisi — Her gönderimde: çekirdek testleri → iki derleme (AutoCAD 2016–2024 ve 2025+) →… · 198 satır · 9 bağ · CekirdekTest.csproj, Eklenti.csproj, KALDIR.bat
- `.github/workflows/telefon.yml` — Telefon uygulaması — Her gönderimde: JavaScript testleri → web paketi → APK (Gradle'sız; aapt2 + ec… · 133 satır · 7 bağ · AndroidManifest.xml, build_apk.sh, gnss_ui.py

### Geliştirme araçları — `araclar`

- `araclar/dwg-dokum/README.md` — DWG döküm aracı (geliştirme) — AutoCAD olmadan bir eski program çizimini eklentinin döküm biçimine… · 13 satır · 1 bağ · dwg_dokum.py
- `araclar/dwg-dokum/dwg_dokum.py` — AutoCAD olmadan bir şebeke çizimini (DWG) eklentinin döküm biçimine çevirir. Kullanım: 1) LibreDWG… · 155 satır · 1 bağ · README.md
- `araclar/hesap-dene.py` — durum → yeni sayfada geri yükle · 219 satır · 3 bağ · hesap-paketle.mjs, DEVIR.md, README.md
- `araclar/hesap-paketle.mjs` · 135 satır · 13 bağ · kopru-bas.js, kurallar.mjs, build.mjs
- `araclar/katalog-aktar.py` — Cins listesi (menü sırası: ana türler, hatlar, kanal, sondaj, sonra AutoCAD sırasıyla diğerleri) · 365 satır · 4 bağ · kalemler.json, kalemler.js, DEVIR.md
- `araclar/marka-uret.py` — Telefonun web paketi · 126 satır · 3 bağ · Eklenti.csproj, Marka.cs, PencereTest.csproj
- `araclar/ortak-tablolar.mjs` · 19 satır · 11 bağ · semboller-uret.mjs, cizim-stili.js, kalemler.js
- `araclar/semboller-onizle.mjs` · 40 satır · 2 bağ · semboller.json, VERI-MODELI.md
- `araclar/semboller-uret.mjs` · 193 satır · 6 bağ · ortak-tablolar.mjs, semboller.js, semboller.json

<!-- dosya-listesi: a0d337bbcb3eae7b -->
