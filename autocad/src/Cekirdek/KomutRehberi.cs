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
            new[] { "Düzenleme", "SH_HATDEGISTIR", "Çizilmiş hatların iletkenini (tip, cins), türünü, durumunu değiştirir; kablo tipi yazısı ve katman güncellenir" },
            new[] { "Düzenleme", "SH_METRAJ", "Hat / kanal metrajını çizim uzunluğundan yeniden hesaplar" },
            new[] { "Düzenleme", "SH_GORUNUM", "Çizimi telefon görünümüne çevirir (simge, renk, etiket, parça metrajı; ayarlardaki boyutlarla); katman adları Türkçe karaktersiz, cins kodları yazım hatasız" },
            new[] { "Düzenleme", "SH_AYARLAR", "Çizim ayarları (ön ek, tarife, simge ve yazı boyutları, metraj payı)" },
            new[] { "Hakediş", "SH_HAKEDIS", "Aktif hakedişi değiştirir" },
            new[] { "Hakediş", "SH_ONAY", "Hakediş onayı (Kontrol → Hakediş → GIS); onaylanan hakediş kilitlenir; kullanıcı tanımlıysa her aşamayı kendi rolü verir" },
            new[] { "Hakediş", "SH_KULLANICILAR", "Kullanıcılar ve roller (telefondakilerle aynı), hakediş yetkisi: yazmaya kapalı hakedişler" },
            new[] { "Hakediş", "SH_OTURUM", "Oturum aç / kapat (kullanıcı ve şifre)" },
            new[] { "Raporlar", "SH_RAPOR", "Bu çizimden Durum Tespit raporu (Excel)" },
            new[] { "Raporlar", "SH_PROJERAPOR", "Proje dosyasından Durum Tespit raporu" },
            new[] { "Raporlar", "SH_OZET", "Proje özeti penceresi: projeler ve seçilen projenin malzeme listesi; Excel'e aktarılır" },
            new[] { "Raporlar", "SH_DETAY", "Eksik malzeme bulur (ör. topraklaması olmayan direkler); bulunanları seçer, Excel'e yazar" },
            new[] { "Teknik hesaplar", "SH_HESAP", "Seçilen direk / hat / trafo / kanal için teknik hesabı tarayıcıda açar (SH_HESAP merkez: uygun hesapların listesi)" },
            new[] { "Teknik hesaplar", "SH_HESAPLAR", "Hesap merkezi: çizimdeki kayıtlı hesaplar ve güncellikleri (hesaplar: direk cer vektörü, kanal planı)" },
            new[] { "Telefon", "SH_ICEAL", "Telefona gönder: çizimi proje dosyasına yazar (.sebeke.json ya da .volt.json)" },
            new[] { "Telefon", "SH_PROJEAL", "Telefondan al: telefondaki yeni ve değişen nesneleri çizime aktarır" },
            new[] { "CBS ve harita", "SH_KML", "Google Earth dosyası (KMZ / KML): her proje bir klasör, nesneler bilgileriyle" },
            new[] { "CBS ve harita", "SH_MIFVER", "CBS'ye MapInfo MIF / MID: direk, trafo, SDK, pano, hat, kanal… ayrı dosya, bütün bilgileri ve malzeme tablosuyla" },
            new[] { "CBS ve harita", "SH_MIFAL", "CBS'den MIF / MID alır: direk, trafo, SDK, pano, hat, kanal… bilgileri ve malzemeleriyle şebeke nesnesi olarak; ya da altlık olarak" },
            new[] { "CBS ve harita", "SH_CBSBILGI", "CBS'den alınan nesnenin bilgilerini gösterir" },
            new[] { "CBS ve harita", "SH_ALTLIK", "Harita altlığı: uydu / harita resmi (Esri, Google, Bing / Azure, Yandex...; anahtarlılar kendi anahtarınızla)" },
            new[] { "Diğer", "SH_HAKKINDA", "Bu pencere: sürüm ve komut listesi" },
            new[] { "Diğer", "SH_SERIT", "Şerit sekmelerini yeniden kurar (kaybolursa)" },
            new[] { "Diğer", "SH_DOKUM", "Destek için çizimin teknik dökümünü kaydeder" },
        };
    }
}
