# Claude için çalışma notu

Bu dosya her oturumun başında kendiliğinden okunur; kısa tutulur.

- Çalışma kuralları [DEVIR.md](DEVIR.md)'nin 1. bölümündedir, her işte uyulur. Durum ve sıradaki işler de oradadır.
- Dosya, komut ya da kural ararken depoyu baştan taramak yerine [HARITA.md](HARITA.md) kullanılır: ilk üç bölümü
  okunur (iki platformda aynı kural, en çok etkilenen dosyalar, komutlar), dosya dizininde yalnız aranır
  (`grep -i "kelime" HARITA.md`). README, PLAN, KULLANIM ve VERI-MODELI belgeleri iş gerektirdiğinde açılır.
- HARITA.md'nin 1. bölümündeki dosyalar aynı kuralı AutoCAD'de ve telefonda ayrı ayrı uygular: biri değişirse öteki
  de değiştirilir, iki tarafın denemeleri çalıştırılır.
- Dosya eklenince, silinince ya da bir dosyanın görevi değişince harita yenilenir ve aynı değişiklikle gönderilir:
  `python3 araclar/kod-haritasi/kod_haritasi.py` (gerekirse `pip install networkx`).
