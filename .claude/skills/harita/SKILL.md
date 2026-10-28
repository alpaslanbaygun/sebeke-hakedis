---
name: harita
description: Şebeke-M kod haritasını (HARITA.md) yeniler ve istenirse yakınlaştırılabilir harita sayfasını yayımlar. Kullanıcı /harita ya da /graphify yazınca, "haritayı yenile / göster" deyince ya da depoya dosya eklenip silinince kullanılır.
---

# Kod haritası

1. Depo kökünde `python3 araclar/kod-haritasi/kod_haritasi.py` çalıştır (networkx yoksa önce
   `pip install networkx`). HARITA.md yeniden yazılır; çıktı yalnız kod değişince değişir.
2. `git diff --stat HARITA.md` ile değişene bak. Kullanıcıya iki üç maddeyle söyle: eklenen / silinen dosyalar,
   1. bölümde (AutoCAD ↔ telefon aynı kural) yeni ya da kaybolan eşler.
3. Kullanıcı haritayı görmek isterse sayfayı üret: `python3 araclar/kod-haritasi/kod_haritasi.py --sayfa <geçici
   klasör>/sebeke-m-kod-haritasi.html` (numpy gerekir). Artifact aracıyla yayımla (simge `graph`). Yayımlı sayfa
   https://claude.ai/artifact/PJLGVnejxTfozyomQzkGi9 adresindedir; açılabiliyorsa aynı adrese güncelle, yoksa yeni yayımla.
4. HARITA.md değiştiyse çalışma dalında Türkçe açıklamayla gönder (DEVIR.md'nin 1. bölümündeki kurallar).
