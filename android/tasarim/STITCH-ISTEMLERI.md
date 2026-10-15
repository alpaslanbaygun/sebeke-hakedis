# Şebeke Hakediş (mobil) — Stitch tasarım istemleri

Hazırlanma: 16.10.2026. Uygulama, Saha Ölçüm (GNSS Link) altyapısının üzerine kurulur; ekranlar Stitch'te
çizilip Saha Ölçüm'deki gibi HTML olarak uygulamaya bağlanır (`tools/stitch-import.js`).

## Nasıl kullanılır

1. Stitch'te yeni bir proje açın: **Şebeke Hakediş**, cihaz: **Mobil**.
2. Önce **Bölüm 1**'deki tasarım sistemi istemini verin.
3. Sonra **Bölüm 3**'teki ekranları sırayla, her seferde tek istem olarak üretin.
4. Bitince tasarımı zip olarak dışa aktarın ve bana gönderin; uygulamayı o dosyaya göre kuracağım.

## 1. Tasarım sistemi (Saha Ölçüm ile aynı)

> Mobil saha uygulaması için tasarım sistemi kur. Yazı tipi Inter, ikonlar Material Symbols Outlined.
> Renkler: üst çubuk zemini #0D4A7A (beyaz metin ve ikon), sayfa zemini #F8F9FB, ana vurgu #1D4ED8,
> başarı #1B5E20, uyarı #B45309, hata #B3261E. Üst çubuk 64px, tam genişlik, saydamlık ve bulanıklık yok.
> Köşeler 12px, kartlar beyaz, ince gri kenarlık. Dokunma alanları en az 48px. Tüm metinler Türkçe.
> Koordinatlar her zaman "Y (Sağa)", "X (Yukarı)", "Kot" sırasıyla yazılır; ondalık ayırıcı nokta,
> binlik ayırıcı yok. GNSS durum şeridi tek satır: çözüm rozeti "Fixed" (yeşil) / "Float" (sarı) /
> "Otonom" (kırmızı) · düzeltme yaşı "1.2 sn" · yatay hassasiyet "0.012 m" · uydu "18".
> Alt gezinme yalnız ana ekranlarda: Proje, Harita, Hakediş.

## 2. Saha kullanımı kuralları (her ekran için geçerli)

Bunlar VOLT-EDAŞ sahada denenirken çıkan sorunlardan geliyor:

- **Harita hiç kapanmaz.** Alt panel en fazla ekranın %40'ı kadar açılır; konum noktası ve seçili nesne
  her zaman panelin üstünde kalır.
- **Ana eylem düğmesi başparmak altında:** sağ altta, 72px, tek elle (jalona takılıyken) basılabilir.
- **Tip seçimi tek dokunuş:** son kullanılan 6 tip ve yıldızlı tipler en üstte; tam liste aramayla.
- **Hat çizme iki dokunuş:** önce başlangıç direğine, sonra bitiş direğine dokunulur; ekranın üstünde
  "1/2 Başlangıç direğini seçin" gibi adım yazısı durur.
- Yazılar güneşte okunur: koyu metin, açık zemin; ince gri metin kullanılmaz.

## 3. Ekranlar

| Kod | Ekran | Amaç |
| --- | --- | --- |
| M01 | Projeler | Telefondaki projeler; Drive'dan proje dosyası (.sebeke.json) açma; yeni proje |
| M02 | Proje Ana Ekranı | Seçili hakediş ve bölge, sayılar, hızlı eylemler |
| M03 | Harita | Ana çalışma ekranı: altlık, bölgeler, mevcut ve yeni şebeke, GNSS konumu |
| M04 | Eleman Koy | Ölçülen noktaya direk, box, pano, trafo, ek mufu, kofre yerleştirme (alt panel) |
| M05 | Tip Seçici | Katalogdan tip seçimi: son kullanılanlar, yıldızlılar, arama |
| M06 | Hat Çiz | İki direk arasında hat: tür, kesit, durum, uzunluk |
| M07 | Kanal Çiz | Kablo kanalı: kanaldaki kablolar, zemin, ölçüler, hacim |
| M08 | Eleman Ayrıntısı | Kalemler, demontaj durumu, fotoğraf, not |
| M09 | Malzeme Ekle | Katalogdan malzeme: miktar, birim, toplam kg |
| M10 | Bölgeler | Alt projeler (proje adı ve kodu) |
| M11 | Hakediş Özeti | Hakediş ve bölgeye göre metraj tablosu, Excel'e aktarma |
| M12 | Dışa Aktar | Proje dosyası, Excel raporu, DXF; Drive'a paylaşma |
| M13 | Ayarlar | Koordinat sistemi, GIS no ön eki, varsayılan hakediş |

GNSS bağlantısı, NTRIP ve alıcı ekranları Saha Ölçüm'den aynen alınır; yeniden çizilmez.

### M01 — Projeler
> "Projeler" ekranı. Üst çubukta başlık "Projeler" ve sağda arama ikonu. Liste kartlarında proje adı
> (ör. "Kayseri 25.38.03"), alt satırda "37 bölge · 8 hakediş · son değişiklik 14.10.2026" ve sağda
> ⋮ menüsü. Altta iki büyük düğme: "Drive'dan Aç" (dosya ikonu) ve "Yeni Proje". Boş durum için ortada
> "Henüz proje yok. Bilgisayardaki eklentiyle hazırlanan .sebeke.json dosyasını açın." yazısı.

### M02 — Proje Ana Ekranı
> "Proje Ana Ekranı". Üst çubukta proje adı. En üstte iki büyük seçici yan yana: "Hakediş: 8" ve
> "Bölge: Tümü". Altında 2x3 sayaç kartları: Direk 2.165, Hat 3.428, Kanal 863, Demontaj 1.804,
> GPS noktası 8.103, Uyarı 0. Sonra hızlı eylemler listesi: "Haritada Çalış", "Hakediş Özeti",
> "Dışa Aktar", "GNSS Bağlantısı". Alt gezinme: Proje (seçili), Harita, Hakediş.

### M03 — Harita
> "Harita" ana çalışma ekranı, tam ekran harita. Üstte GNSS durum şeridi. Haritada: bölge sınırları ince
> mavi çizgi ve adları, mevcut şebeke gri, yeni şebeke koyu mavi; direkler küçük daireler, hatlar
> çizgi, demontaj kırmızı kesik çizgi. Mavi konum noktası ve hassasiyet dairesi. Sol üstte katman
> düğmesi, sağ üstte altlık düğmesi (OSM / Uydu). Sağ altta 72px yuvarlak ana düğme "ÖLÇ ve KOY",
> onun üstünde daha küçük iki düğme: "Hat" ve "Kanal". Sol altta seçili hakediş rozeti "H8".
> Alt gezinme: Proje, Harita (seçili), Hakediş.

### M04 — Eleman Koy
> Harita üzerinde açılan alt panel (ekranın en fazla %40'ı), harita ve konum noktası görünür kalır.
> Panelde: ölçülen nokta "Y (Sağa) 494649.483 · X (Yukarı) 4278932.586 · Kot 1476.597" ve "Fixed".
> Altında eleman türü için tek satır kaydırmalı çipler: AG Direk, Müşterek, Aydınlatma, ENH, Trafo,
> Pano, Box, Ek Mufu, Kofre. Sonra "Tip: G-10I" seçici (dokununca Tip Seçici açılır), "Durum" için
> beş bölmeli düğme grubu: M, M+M, DM, DM+M, Mevcut. "GIS No: SC2346" (otomatik, düzenlenebilir).
> En altta tam genişlik büyük düğme "Kaydet".

### M05 — Tip Seçici
> "Tip Seçin — AG Direk" ekranı. En üstte arama kutusu. "Son kullanılanlar" başlığı altında 2 sütunlu
> büyük kutucuklar: G-10I, G-12I, G-K1, G-K2, 10I, 12I (her birinin altında "209 kg" gibi ağırlık).
> "Yıldızlılar" bölümü. Sonra tam liste: satırda tip adı, ağırlık ve sağda yıldız ikonu.

### M06 — Hat Çiz
> Harita ekranı, üstte adım şeridi: "2/2 Bitiş direğini seçin". Haritada başlangıç direği vurgulu,
> imleçten direğe kesik çizgi. Alt panelde: hat türü çipleri (AG Havai, AG Yeraltı, Aydınlatma,
> OG Havai, OG Yeraltı, Rekortman), "Kesit: 3X50/16+70 ALPEK" seçici, durum düğme grubu (M, M+M, DM,
> DM+M, Mevcut), "Uzunluk: 338.19 m çizim → 340 m metraj" ve metrajı elle düzeltme alanı.
> Etiket önizlemesi: "^ 3X50/16+70 ALPEK/340m". Altta "Hattı Kaydet".

### M07 — Kanal Çiz
> "Kablo Kanalı" alt paneli. "Kanaldaki kablolar" için dört büyük onay kutusu: OG, AG, Aydınlatma,
> Rekortman. "Zemin" seçici: Toprak, Tuvenan, Tuvenan (Bariyerli), Parke Toprak, Parke Tuvenan,
> Parke Tuvenan (Bariyerli), Branşman Kanal. Üç sayı alanı yan yana: Alt genişlik 40 cm, Üst genişlik
> 40 cm, Derinlik 100 cm. Canlı sonuç kartı: "Uzunluk 114 m · Hacim 45.60 m³". Altta "Kanalı Kaydet".

### M08 — Eleman Ayrıntısı
> "AG Direk SC77" ayrıntı ekranı. Üstte özet kartı: tip G-K2, durum M, hakediş 2, bölge adı,
> koordinatlar. "Kalemler" listesi: satırda malzeme adı (ör. "G-L-50 Travers"), "9.8 m × 3.77 kg/m =
> 36.95 kg", durum rozeti "M+M" ve kaydırınca sil. "Malzeme Ekle" düğmesi. Demontajda "Söküm durumu:
> Kesik / Sökük" seçici. Fotoğraf şeridi (en çok 4 küçük resim ve "+"), "Not" alanı. Altta "Kaydet".

### M09 — Malzeme Ekle
> "Malzeme Ekle" ekranı. Arama kutusu, altında kategori çipleri (Travers, İzolatör, Topraklama, Kablo,
> Armatür, Diğer). Liste satırı: malzeme adı, birim ve katsayı ("mt/kg · 3.77"). Seçince alt panel:
> miktar alanı büyük rakamlarla, durum düğme grubu, canlı toplam "9.8 m → 36.95 kg", "Ekle" düğmesi.

### M10 — Bölgeler
> "Bölgeler" ekranı. Liste: proje adı iki satıra kadar, altında proje kodu "25.38.03.19.24042" ve
> "312 eleman". Sağda haritada göster ikonu. Üstte arama.

### M11 — Hakediş Özeti
> "Hakediş Özeti" ekranı. Üstte "Hakediş 8" ve "Bölge: Tümü" seçicileri. Sekmeler: Malzeme, Hat, Kanal,
> Demontaj. Tablo satırı: cins ve tip, durum rozeti, miktar ve birim, toplam kg. Altta toplam kartı
> "Toplam 1.540.966 kg". Sağ üstte "Excel'e Aktar" ikonu. Alt gezinme: Proje, Harita, Hakediş (seçili).

### M12 — Dışa Aktar
> "Dışa Aktar" ekranı. Üç büyük kart: "Proje Dosyası (.sebeke.json) — bilgisayardaki eklenti açar",
> "Durum Tespit Raporu (Excel)", "AutoCAD Çizimi (DXF)". Her kartta "Paylaş" düğmesi (Drive, e-posta).
> Altta "Yalnız seçili hakediş" anahtarı.

### M13 — Ayarlar
> "Ayarlar" ekranı. Bölümler: Koordinat Sistemi (ITRF96, TM, Dilim orta meridyeni 36°), GIS No Ön Eki
> ("SC"), Varsayılan Hakediş (8), Hat metrajı yuvarlama ("Yukarı yuvarla", "AG havai hatta +1 m").
