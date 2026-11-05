# DWG onarım aracı (geliştirme)

Açılırken AutoCAD'i çökerten çizimi AutoCAD'e açtırmadan onarır. Eklentinin 0.1.57 ve öncesi bazı nesnelere değeri
olmayan uygulama bölümü yazıyordu; AutoCAD bunu sıfır uzunluklu genişletilmiş veri bölümü olarak saklar ve açarken
çöker (DEVIR.md › 25.10 ve 5.11 notları). Araç bu bölümleri çıkarır, nesnenin bit boyunu ve CRC'sini yeniden
hesaplar; nesne yerinde yazılır, başka bayta dokunulmaz. Yalnız DWG 2000 (AC1015) biçimi.

Kullanıcı için aynı onarım eklentide: **Çizim Onar** (`SH_ONAR`, ŞEBEKE-M ARAÇLAR › Raporlar). Çekirdekteki
karşılığı `autocad/src/Cekirdek/DwgOnarici.cs`; çekirdek denemesi uydurma bir DWG ile (`CekirdekTest` › `DwgOnarDene`).
Gerçek bir çizimde iki tarafın aynı sonucu verdiği şöyle denetlenir (çizim depoya konmaz):

    python3 -I dwg_onar.py bozuk.dwg py.dwg
    dotnet run --project autocad/test/CekirdekTest -c Release -- dwgonar bozuk.dwg cs.dwg
    cmp py.dwg cs.dwg
