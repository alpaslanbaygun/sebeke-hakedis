namespace SebekeHakedis.Cekirdek
{
    /// <summary>Eklentinin komutları ve kısa açıklamaları (Hakkında penceresi ve komut satırı listesi aynı listeden).</summary>
    public static class KomutRehberi
    {
        /// <summary>[grup, komut, açıklama]</summary>
        public static readonly string[][] Liste =
        {
            new[] { "Hızlı çizim", "SH_HIZLI", "Şeritte seçili öğeyi seçili tip, durum ve hakedişle çizer (pencere açılmaz)" },
            new[] { "Hızlı çizim", "SH_HIZLIAYRINTI", "Şeritteki öğeyi süzgeçli, aramalı pencereyle çizer" },
            new[] { "Çizim", "SH_ELEMAN", "Direk, box, pano, trafo, mufu koyar (GIS numarası kendiliğinden; malzeme hafızası açıksa son malzemeler eklenir)" },
            new[] { "Çizim", "SH_HAT", "Hat çizer (her direkte / elemanda parçalı; her parçanın metrajı ve etiketi ayrı; iki iletken, adet)" },
            new[] { "Çizim", "SH_KANAL", "Kablo kanalı çizer (box / direk aralarında parçalı; hacim ölçülerden)" },
            new[] { "Çizim", "SH_SONDAJ", "Yatay sondaj çizer" },
            new[] { "Çizim", "SH_BOLGE", "Bölge (alt proje) sınırı çizer ya da var olan çizgiyi bölge yapar" },
            new[] { "Çizim", "SH_NOKTAAL", "Ölçü noktalarını dosyadan alır (CSV / TXT)" },
            new[] { "Düzenleme", "SH_MALZEME", "Seçilen nesnenin malzemelerini düzenler (direğe armatür: simgesi direğin yanında)" },
            new[] { "Düzenleme", "SH_TOPLUMALZEME", "Seçilen direklere / elemanlara aynı malzemeleri tek seferde ekler" },
            new[] { "Düzenleme", "SH_METRAJ", "Hat / kanal metrajını çizim uzunluğundan yeniden hesaplar" },
            new[] { "Düzenleme", "SH_GORUNUM", "Çizimi telefon görünümüne çevirir (simge, renk, etiket, parça metrajı)" },
            new[] { "Düzenleme", "SH_AYARLAR", "Çizim ayarları (ön ek, tarife, simge takımı, etiket, metraj payı)" },
            new[] { "Hakediş", "SH_HAKEDIS", "Aktif hakedişi değiştirir" },
            new[] { "Hakediş", "SH_ONAY", "Hakediş onayı (Kontrol → Hakediş → GIS); onaylanan hakediş kilitlenir" },
            new[] { "Raporlar", "SH_RAPOR", "Bu çizimden Durum Tespit raporu (Excel)" },
            new[] { "Raporlar", "SH_PROJERAPOR", "Proje dosyasından Durum Tespit raporu" },
            new[] { "Raporlar", "SH_OZET", "Çizimdeki proje özeti (bölge, eleman, hat, kanal sayıları, onaylar)" },
            new[] { "Raporlar", "SH_DETAY", "Eksik malzeme bulur (ör. topraklaması olmayan direkler); bulunanları seçer, Excel'e yazar" },
            new[] { "Teknik hesaplar", "SH_HESAP", "Seçilen direk / hat / trafo / kanal için teknik hesabı tarayıcıda açar (SH_HESAP merkez: uygun hesapların listesi)" },
            new[] { "Teknik hesaplar", "SH_HESAPLAR", "Hesap merkezi: çizimdeki kayıtlı hesaplar, güncellikleri ve bütün hesap araçları" },
            new[] { "Telefon", "SH_ICEAL", "Telefona gönder: çizimi proje dosyasına yazar (.sebeke.json ya da .volt.json)" },
            new[] { "Telefon", "SH_PROJEAL", "Telefondan al: telefondaki yeni ve değişen nesneleri çizime aktarır" },
            new[] { "Diğer", "SH_HAKKINDA", "Bu pencere: sürüm ve komut listesi" },
            new[] { "Diğer", "SH_SERIT", "Şerit sekmelerini yeniden kurar (kaybolursa)" },
            new[] { "Diğer", "SH_DOKUM", "Destek için çizimin teknik dökümünü kaydeder" },
        };
    }
}
