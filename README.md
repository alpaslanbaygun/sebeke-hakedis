# Şebeke Hakediş

Elektrik dağıtım şebekesi yapım işlerinde saha ölçümü, metraj, hakediş ve Durum Tespit raporu için iki
araç: **AutoCAD eklentisi** (bilgisayar) ve **Android uygulaması** (saha). İkisi aynı proje dosyasını
(`.sebeke.json`) okur ve yazar. PROMAGIS eklentisinin yerine geçmek üzere tasarlanmıştır; eski PROMAGIS
çizimleri içe alınabilir.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `autocad/` | AutoCAD eklentisi (C#). AutoCAD 2016–2024 ve 2025+ için iki derleme, tek kurulum paketi |
| `ortak/` | Proje dosyası biçimi, rapor katsayıları ve malzeme kataloğu (telefon ve bilgisayar ortak kullanır) |
| `android/` | Saha uygulaması (sonraki faz) |
| `araclar/` | Geliştirme araçları: AutoCAD olmadan DWG okuma ve test verisi üretme |

## AutoCAD eklentisini kurma

1. GitHub'da bu deponun **Releases** bölümünden en son `SebekeHakedis-0.1.x.zip` dosyasını indirin.
2. Zip'i bir klasöre çıkarın, AutoCAD'i kapatın, `KUR.bat` dosyasına çift tıklayın.
3. AutoCAD'i açın; şeritte **ŞEBEKE HAKEDİŞ** sekmesi görünür.

Ayrıntı: paketteki `OKUBENI.txt`.

## Eklenti komutları (1. sürüm)

| Komut | Ne yapar |
| --- | --- |
| `SH_RAPOR` | Açık PROMAGIS çiziminden Durum Tespit raporu (Excel) |
| `SH_ICEAL` | Çizimi ortak proje dosyasına aktarır (`.sebeke.json`) |
| `SH_PROJERAPOR` | Proje dosyasından Durum Tespit raporu |
| `SH_OZET` | Bölge, eleman, hat, kanal sayıları |
| `SH_SERIT` | Şerit sekmesini yeniden kurar |
| `SH_DOKUM` | Destek için teknik döküm |

## Doğrulama

Rapor kuralları, gerçek bir PROMAGIS projesi (37 alt proje, 8 hakediş) üzerinde PROMAGIS'in kendi Durum Tespit
raporuyla satır satır karşılaştırıldı: 22.048 satırın 22.045'i eşleşti, toplam ağırlık birebir aynı
(1.540.966,1 kg). Farklar: PROMAGIS raporundaki karakter bozulması ("√" yerine "?") ve çakışan bölge
sınırlarında 251 satırın bölge ataması.

## Geliştirme

- Her gönderimde GitHub Actions çekirdek testlerini çalıştırır, eklentiyi iki hedef için derler ve paketi
  **Releases** bölümüne koyar. Derleme günlükleri `ci-sonuc` dalına yazılır.
- Çekirdek kod (`autocad/src/Cekirdek`) AutoCAD'e bağımlı değildir; bilgisayarsız test edilir:
  `dotnet run --project autocad/test/CekirdekTest -- ornek`
- Plan ve fazlar: [PLAN.md](PLAN.md) · Veri modeli: [ortak/VERI-MODELI.md](ortak/VERI-MODELI.md)
