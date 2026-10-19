# DWG döküm aracı (geliştirme)

AutoCAD olmadan bir eski program çizimini eklentinin döküm biçimine çevirir; çekirdeği bilgisayarsız
test etmek ve telefon uygulamasına örnek veri hazırlamak için kullanılır.

1. [LibreDWG](https://github.com/LibreDWG/libredwg) 0.13.3'ü kaynaktan derleyin.
2. `dwgread -O JSON -o cizim.json cizim.dwg`
3. `python3 dwg_dokum.py cizim.json cizim_dokum.json`
4. `dotnet run --project autocad/test/CekirdekTest -- dogrula cizim_dokum.json promagis_rapor.tsv cikti/`

Son adım; proje dosyasını (`proje.sebeke.json`), Durum Tespit Excel'ini üretir ve bir eski program raporu
(DURUM TESPİT sayfası, sekmeyle ayrılmış metin) verilirse satır satır karşılaştırır.
Gerçek proje verileri depoya konmaz.
