using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>İçe aktarılacak bir CBS (MIF / MID) dosyası: ne olduğu (katmanı) ve sütunlarının Şebeke-M bilgileriyle eşleşmesi.</summary>
    public sealed class CbsKaynagi
    {
        /// <summary>Dosya adı (uzantısız).</summary>
        public string Ad = "";
        /// <summary>Okunmuş ve çizim koordinatına çevrilmiş dosya (MifDosyasi.Oku + CizimeCevir).</summary>
        public MifVerisi Veri;
        /// <summary>Dosyanın katmanı: DIREK, TRAFO, SDK, PANO, ELEMAN, HAT, KANAL, SONDAJ, BOLGE, NOKTA, MALZEME; "": altlık (yalnız çizilir).</summary>
        public string Katman = "";
        /// <summary>Şebeke-M'in yazdığı dosya mı (sütun adları birebir; kimlikleri nesnelere bağlanır).</summary>
        public bool SebekeM;
        /// <summary>Bilgi (alan) → dosyadaki sütun numarası (yoksa -1 ya da hiç yok).</summary>
        public readonly Dictionary<string, int> Sutunlar = new Dictionary<string, int>(StringComparer.Ordinal);

        public int Sutun(string alan)
        {
            int i;
            return Sutunlar.TryGetValue(alan, out i) ? i : -1;
        }

        /// <summary>Dosyadaki baskın geometri: "nokta", "cizgi", "alan", "yok" (en çok nesnenin türü).</summary>
        public string Geometri
        {
            get
            {
                var say = new Dictionary<string, int>(StringComparer.Ordinal);
                if (Veri != null) foreach (var n in Veri.Nesneler) { int c; say.TryGetValue(n.Tur, out c); say[n.Tur] = c + 1; }
                string en = "yok";
                int enCok = -1;
                foreach (var kv in say) if (kv.Value > enCok) { enCok = kv.Value; en = kv.Key; }
                return en == "yazi" ? "nokta" : en;
            }
        }
    }

    /// <summary>CBS'den alırken kullanılacak varsayılanlar ve çizimin kuralları.</summary>
    public sealed class CbsAlmaAyari
    {
        /// <summary>Dosyada durum yoksa (CBS'deki şebeke çoğunlukla mevcuttur).</summary>
        public string VarsayilanDurum = "MEVCUT";
        public int Hakedis = 1;
        /// <summary>Hat metrajı: (çizim uzunluğu, hat türü) → metraj (çizimin yuvarlama ve ek payıyla). null: çizim uzunluğu.</summary>
        public Func<double, string, double> HatMetraji;
        /// <summary>Yeni kalem sıra numarası. null: boş.</summary>
        public Func<string> Sira;
        public string Karakteristik = "";
        public bool Koy;
    }

    /// <summary>
    /// CBS'den (MapInfo MIF / MID) şebeke nesnesi olarak alma (31.10.2026): dosyalar direk, trafo, SDK, pano, diğer eleman,
    /// hat (iletken / kablo), kanal, sondaj, bölge, GPS noktası ya da malzeme tablosu olarak tanınır (Şebeke-M'in yazdığı
    /// dosyada birebir, başka CBS dosyasında dosya adı, sütun adları ve geometriden tahminle; kullanıcı pencerede
    /// değiştirebilir). Sütunlar bilgilere eş anlamlılarıyla eşlenir (GIS_NO ↔ TESIS_NO, DIREK_NO …). Sonuç bir proje
    /// (Proje): eklenti onu telefondan gelen proje gibi Aktarim ile çizime yazar — direk bloğu, hat çizgisi, bütün
    /// öznitelikleri ve malzemeleriyle (malzeme tablosu varsa satır satır, yoksa ana malzeme katalogdan).
    /// </summary>
    public static class CbsIceAktarim
    {
        /// <summary>Pencerede seçilebilen katmanlar: [kod, ad]. "" altlıktır (nesne olarak alınmaz, yalnız çizilir).</summary>
        public static readonly string[][] Secenekler =
        {
            new[] { "DIREK", "Direk" }, new[] { "TRAFO", "Trafo" }, new[] { "SDK", "SDK (saha dağıtım kutusu)" }, new[] { "PANO", "Pano" },
            new[] { "ELEMAN", "Diğer eleman (mufu, kofre…)" }, new[] { "HAT", "Hat (iletken / kablo)" }, new[] { "KANAL", "Kablo kanalı" },
            new[] { "SONDAJ", "Yatay sondaj" }, new[] { "BOLGE", "Bölge (proje sınırı)" }, new[] { "NOKTA", "GPS noktası" },
            new[] { "MALZEME", "Malzeme tablosu (nesnelerin malzemeleri)" }, new[] { "", "Altlık (yalnız çizilir)" },
        };

        public static string SecenekAdi(string kod)
        {
            foreach (var s in Secenekler) if (s[0] == (kod ?? "")) return s[1];
            return kod ?? "";
        }

        public static bool ElemanKatmani(string katman) => katman == "DIREK" || katman == "TRAFO" || katman == "SDK" || katman == "PANO" || katman == "ELEMAN";

        /// <summary>Katmanın bilgileri (eşlenecek alanlar): [alan, okunur ad].</summary>
        public static string[][] Alanlar(string katman)
        {
            if (ElemanKatmani(katman))
                return new[]
                {
                    A("KIMLIK", "Kimlik"), A("GIS_NO", "GIS no"), A("TUR", "Tür"), A("CINS", "Cins"), A("TIP", "Tip"), A("DURUM", "Durum"),
                    A("DM_DURUM", "Demontaj türü"), A("HAKEDIS", "Hakediş"), A("GUC", "Güç"), A("GERILIM", "Gerilim"), A("KONTROL", "Kontrol"),
                    A("KOT", "Kot"), A("ACI", "Açı (derece)"), A("TELEFON_ID", "Telefon kimliği"),
                };
            switch (katman)
            {
                case "HAT":
                    return new[]
                    {
                        A("KIMLIK", "Kimlik"), A("TUR", "Tür"), A("KESIT", "Kesit (iletken / kablo)"), A("ILETKEN_CINS", "İletken cinsi"),
                        A("ILETKEN", "İletken"), A("ILETKEN_ADET", "İletken adedi"), A("ILETKEN2_CINS", "2. iletken cinsi"), A("ILETKEN2", "2. iletken"),
                        A("ILETKEN2_ADET", "2. iletken adedi"), A("DURUM", "Durum"), A("HAKEDIS", "Hakediş"), A("KONTROL", "Kontrol"),
                        A("METRAJ", "Metraj (m)"), A("TELEFON_ID", "Telefon kimliği"),
                    };
                case "KANAL":
                    return new[]
                    {
                        A("KIMLIK", "Kimlik"), A("KABLOLAR", "Kablolar (OG/AG/AYD/REK)"), A("ZEMIN", "Zemin"), A("ALT_CM", "Alt genişlik (cm)"),
                        A("UST_CM", "Üst genişlik (cm)"), A("DERIN_CM", "Derinlik (cm)"), A("BAS_NO", "Baş no"), A("BIT_NO", "Bit no"), A("DURUM", "Durum"),
                        A("HAKEDIS", "Hakediş"), A("METRAJ", "Metraj (m)"),
                    };
                case "SONDAJ":
                    return new[] { A("KIMLIK", "Kimlik"), A("TIP", "Tip"), A("BAS_NO", "Baş no"), A("BIT_NO", "Bit no"), A("DURUM", "Durum"), A("HAKEDIS", "Hakediş"), A("METRAJ", "Metraj (m)") };
                case "BOLGE":
                    return new[] { A("KIMLIK", "Kimlik"), A("PROJE", "Proje adı"), A("PROJE_KODU", "Proje kodu"), A("GRUP", "Grup kodu"), A("ACIKLAMA", "Açıklama") };
                case "NOKTA":
                    return new[] { A("KIMLIK", "Kimlik"), A("AD", "Ad / no"), A("KOD", "Kod"), A("KOT", "Kot"), A("HAKEDIS", "Hakediş"), A("EK", "Ek bilgi") };
                case "MALZEME":
                    return new[]
                    {
                        A("NESNE", "Nesne kimliği"), A("KATMAN", "Nesnenin katmanı"), A("GIS_NO", "GIS no"), A("SIRA", "Sıra no"), A("CINS", "Cins"),
                        A("TANIM", "Tanım"), A("ACIKLAMA", "Tam yazım"), A("DURUM", "Durum"), A("DM_DURUM", "Demontaj türü"), A("MIKTAR", "Miktar"),
                        A("BIRIM", "Birim"), A("KATSAYI", "Katsayı"), A("TOPLAM", "Toplam"), A("HAKEDIS", "Hakediş"), A("TARIFE", "Tarife"),
                        A("KAYNAK", "Kaynak"), A("ANA", "Ana kalem"), A("KONTROL", "Kontrol"),
                    };
                default: return new string[0][];
            }
        }

        private static string[] A(string a, string b) => new[] { a, b };

        /// <summary>Bilgilerin dosyadaki olası sütun adları (büyük harf, Türkçe karaktersiz; ilk bulunan alınır).</summary>
        private static readonly Dictionary<string, string[]> Esanlamlar = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            { "KIMLIK", new[] { "KIMLIK", "ID", "OBJECTID", "OBJECT_ID", "OBJ_ID", "FID", "UID", "NESNE_ID", "NESNEID", "MI_PRINX" } },
            { "GIS_NO", new[] { "GIS_NO", "GISNO", "GIS_ID", "GISID", "GIS", "TESIS_NO", "TESISNO", "DIREK_NO", "DIREKNO", "TRAFO_NO", "TRAFONO", "SDK_NO", "SDKNO",
                                 "KUTU_NO", "PANO_NO", "NO", "NUMARA", "NUMARASI", "ADI", "AD", "ISIM", "NAME", "ETIKET", "LABEL" } },
            { "TUR", new[] { "TUR", "TURU", "TUR_KODU", "NESNE_TURU", "OBJE_TURU", "ELEMAN_TURU", "TESIS_TURU", "SINIF", "CLASS", "KATEGORI" } },
            { "CINS", new[] { "CINS", "CINSI", "CINS_KODU", "MALZEME_CINSI", "DIREK_CINSI" } },
            { "TIP", new[] { "TIP", "TIPI", "TYPE", "DIREK_TIPI", "TRAFO_TIPI", "SDK_TIPI", "KUTU_TIPI", "PANO_TIPI", "MODEL", "MALZEME" } },
            { "DURUM", new[] { "DURUM", "DURUMU", "DURUM_KODU", "STATUS", "STATU", "ISLEM", "ISLEM_TURU" } },
            { "DM_DURUM", new[] { "DM_DURUM", "DEMONTAJ", "DEMONTAJ_TURU" } },
            { "HAKEDIS", new[] { "HAKEDIS", "HAKEDIS_NO", "HAK" } },
            { "GUC", new[] { "GUC", "GUCU", "GUC_KVA", "KVA", "TRAFO_GUCU", "KURULU_GUC", "KAPASITE" } },
            { "GERILIM", new[] { "GERILIM", "GERILIMI", "GERILIM_KV", "GERILIM_SEVIYESI", "KV", "VOLTAJ", "SEVIYE" } },
            { "KONTROL", new[] { "KONTROL" } },
            { "KOT", new[] { "KOT", "Z", "YUKSEKLIK", "RAKIM", "ELEVATION" } },
            { "ACI", new[] { "ACI", "ACISI", "DONME", "DONUS", "ROTATION", "ANGLE" } },
            { "TELEFON_ID", new[] { "TELEFON_ID" } },
            { "KESIT", new[] { "KESIT", "KESITI", "ANA_KESIT", "ILETKEN_KESITI", "HAT_TIPI", "ILETKEN_TIPI", "KABLO_TIPI", "KABLO", "CONDUCTOR" } },
            { "ILETKEN_CINS", new[] { "ILETKEN_CINS", "ILETKEN_CINSI", "KABLO_CINSI" } },
            { "ILETKEN", new[] { "ILETKEN", "ILETKEN1", "ILETKEN_ADI" } },
            { "ILETKEN_ADET", new[] { "ILETKEN_ADET", "ILETKEN_ADEDI", "DEVRE_SAYISI", "DEVRE", "ADET" } },
            { "ILETKEN2_CINS", new[] { "ILETKEN2_CINS" } },
            { "ILETKEN2", new[] { "ILETKEN2" } },
            { "ILETKEN2_ADET", new[] { "ILETKEN2_ADET" } },
            { "METRAJ", new[] { "METRAJ", "UZUNLUK", "UZUNLUK_M", "HAT_UZUNLUGU", "BOY", "LENGTH" } },
            { "KABLOLAR", new[] { "KABLOLAR" } },
            { "ZEMIN", new[] { "ZEMIN", "ZEMIN_TURU", "KAPLAMA" } },
            { "ALT_CM", new[] { "ALT_CM", "ALT_GENISLIK" } },
            { "UST_CM", new[] { "UST_CM", "UST_GENISLIK", "GENISLIK" } },
            { "DERIN_CM", new[] { "DERIN_CM", "DERINLIK" } },
            { "BAS_NO", new[] { "BAS_NO", "BASLANGIC", "BAS" } },
            { "BIT_NO", new[] { "BIT_NO", "BITIS", "BIT" } },
            { "PROJE", new[] { "PROJE", "PROJE_ADI", "BOLGE", "BOLGE_ADI", "ADI", "AD", "ISIM", "NAME" } },
            { "PROJE_KODU", new[] { "PROJE_KODU", "PROJE_NO", "KOD", "KODU" } },
            { "GRUP", new[] { "GRUP", "GRUP_KODU" } },
            { "ACIKLAMA", new[] { "ACIKLAMA", "ACIKLAMASI", "NOT", "DESCRIPTION" } },
            { "AD", new[] { "AD", "ADI", "NO", "NOKTA_NO", "NOKTA", "ISIM", "NAME" } },
            { "KOD", new[] { "KOD", "KODU", "CODE" } },
            { "EK", new[] { "EK", "NOT", "ACIKLAMA" } },
            { "NESNE", new[] { "NESNE", "NESNE_KIMLIK", "NESNE_ID", "OBJ_ID" } },
            { "KATMAN", new[] { "KATMAN" } },
            { "SIRA", new[] { "SIRA", "SIRA_NO", "INDEX" } },
            { "TANIM", new[] { "TANIM", "MALZEME_ADI", "MALZEME" } },
            { "MIKTAR", new[] { "MIKTAR", "ADET", "QTY" } },
            { "BIRIM", new[] { "BIRIM", "UNIT" } },
            { "KATSAYI", new[] { "KATSAYI" } },
            { "TOPLAM", new[] { "TOPLAM" } },
            { "TARIFE", new[] { "TARIFE" } },
            { "KAYNAK", new[] { "KAYNAK" } },
            { "ANA", new[] { "ANA" } },
        };

        /// <summary>Sütun adı ya da değer karşılaştırma biçimi: büyük harf, Türkçe karaktersiz, harf / rakam dışı "_".</summary>
        public static string Normal(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            s = KatmanAdlari.Ascii(s.Trim()).ToUpperInvariant();
            var sb = new StringBuilder(s.Length);
            foreach (char c in s) sb.Append(char.IsLetterOrDigit(c) ? c : '_');
            return sb.ToString().Trim('_');
        }

        // ------------------------------------------------------------------ Tanıma

        /// <summary>
        /// Dosyanın ne olduğunu ve sütunlarını bulur. Şebeke-M'in dosyası: adı "_DIREK" … ile biter ve katmanın sütunlarının
        /// hepsi vardır. Başka CBS dosyası: adındaki sözcükten (DIREK, TRAFO, SDK / BOX / KUTU, PANO, HAT / ILETKEN / KABLO,
        /// KANAL, SONDAJ, BOLGE / PROJE, NOKTA / GPS, MALZEME), yoksa TUR sütunundaki türlerden; bulunamazsa altlık.
        /// </summary>
        public static void Tani(CbsKaynagi k)
        {
            string ad = Normal(k.Ad);
            k.Katman = "";
            k.SebekeM = false;
            foreach (var katman in CbsYapisi.Katmanlar)
                if (ad == katman.Ad || ad.EndsWith("_" + katman.Ad, StringComparison.Ordinal))
                {
                    k.Katman = katman.Ad;
                    k.SebekeM = SebekeMDosyasi(k.Veri, katman);
                    break;
                }
            if (k.Katman.Length == 0) k.Katman = AdindanKatman(ad, k.Geometri);
            if (k.Katman.Length == 0 && k.Geometri == "nokta") k.Katman = TurSutunundan(k.Veri);
            SutunlariEsle(k);
        }

        /// <summary>Dosya Şebeke-M'in o katmanının bütün sütunlarını taşıyor mu (eski, daha az sütunlu eleman dosyası da sayılır).</summary>
        private static bool SebekeMDosyasi(MifVerisi v, CbsKatmani katman)
        {
            if (v == null) return false;
            string[] gerekli = katman.Geometri == "nokta" && katman != CbsYapisi.Nokta ? new[] { "KIMLIK", "GIS_NO", "TUR", "CINS", "TIP", "DURUM", "HAKEDIS" }
                : katman == CbsYapisi.Hat ? new[] { "KIMLIK", "TUR", "KESIT", "DURUM", "HAKEDIS" }
                : katman == CbsYapisi.Malzeme ? new[] { "NESNE", "CINS", "TANIM", "MIKTAR", "BIRIM" }
                : new[] { "KIMLIK" };
            foreach (var g in gerekli) if (v.Sutun(g) < 0) return false;
            return true;
        }

        private static string AdindanKatman(string ad, string geometri)
        {
            Func<string, bool> var_ = s => ad.Contains(s);
            if (var_("MALZEME")) return "MALZEME";
            if (geometri == "nokta")
            {
                if (var_("TRAFO") || var_("TR_MERKEZ") || var_("KOSK")) return "TRAFO";
                if (var_("SDK") || var_("BOX") || var_("KUTU")) return "SDK";
                if (var_("PANO")) return "PANO";
                if (var_("DIREK") || var_("POLE")) return "DIREK";
                if (var_("MUFU") || var_("KOFRE") || var_("ELEMAN")) return "ELEMAN";
                if (var_("NOKTA") || var_("GPS")) return "NOKTA";
                return "";
            }
            if (geometri == "cizgi")
            {
                if (var_("KANAL")) return "KANAL";
                if (var_("SONDAJ")) return "SONDAJ";
                if (var_("HAT") || var_("ILETKEN") || var_("KABLO") || var_("ENH") || var_("LINE")) return "HAT";
                return "";
            }
            if (geometri == "alan" && (var_("BOLGE") || var_("PROJE") || var_("SINIR"))) return "BOLGE";
            return "";
        }

        /// <summary>Nokta dosyasında TUR sütunu bilinen eleman türlerini taşıyorsa diğer eleman katmanı (her nesne kendi türüyle).</summary>
        private static string TurSutunundan(MifVerisi v)
        {
            int i = v != null ? v.Sutun("TUR") : -1;
            if (i < 0) return "";
            foreach (var n in v.Nesneler)
                if (i < n.Degerler.Length && Turler.Eleman(n.Degerler[i]) != null) return "ELEMAN";
            return "";
        }

        /// <summary>Katmanın bilgilerini dosyanın sütunlarına eşler (eş anlamlılarla; bir sütun bir kez kullanılır).</summary>
        public static void SutunlariEsle(CbsKaynagi k)
        {
            k.Sutunlar.Clear();
            if (k.Veri == null) return;
            var normal = k.Veri.Sutunlar.ConvertAll(Normal);
            var kullanilan = new HashSet<int>();
            foreach (var a in Alanlar(k.Katman))
            {
                string[] es;
                if (!Esanlamlar.TryGetValue(a[0], out es)) es = new[] { a[0] };
                int bulunan = -1;
                foreach (var e in es)
                {
                    for (int i = 0; i < normal.Count; i++)
                        if (!kullanilan.Contains(i) && normal[i] == e) { bulunan = i; break; }
                    if (bulunan >= 0) break;
                }
                if (bulunan >= 0) kullanilan.Add(bulunan);
                k.Sutunlar[a[0]] = bulunan;
            }
        }

        // ------------------------------------------------------------------ Projeye çevirme

        private sealed class Okuyucu
        {
            public CbsKaynagi K;
            public string[] D;
            public string this[string alan]
            {
                get
                {
                    int i = K.Sutun(alan);
                    return i >= 0 && D != null && i < D.Length ? (D[i] ?? "").Trim() : "";
                }
            }
            public double Sayi(string alan, double varsayilan = 0) => SayiCoz.Coz(this[alan], varsayilan);
            public int Tam(string alan, int varsayilan) { double d = SayiCoz.Coz(this[alan], double.NaN); return double.IsNaN(d) ? varsayilan : (int)Math.Round(d); }
        }

        /// <summary>
        /// Dosyalardaki nesnelerden proje: elemanlar, hatlar, kanallar, sondajlar, bölgeler, GPS noktaları; malzeme tablosu
        /// varsa satırları nesnelerine (NESNE = KIMLIK). cizim: şimdiki çizimin projesi — Şebeke-M'in kendi dosyası aynı
        /// çizime geri alınırsa nesneler tanıtıcısıyla eşleşir (çift olmaz). Katalogda bulunamayan tip / iletken uyarılara yazılır.
        /// </summary>
        public static Proje ProjeyeCevir(IList<CbsKaynagi> kaynaklar, Katalog katalog, Proje cizim, CbsAlmaAyari ayar, List<string> uyarilar)
        {
            if (ayar == null) ayar = new CbsAlmaAyari();
            if (uyarilar == null) uyarilar = new List<string>();
            var p = new Proje { Ad = "CBS", Kaynak = "cbs" };

            // Malzeme tablosu: nesne kimliği → satırlar
            var malzemeler = new Dictionary<string, List<Kalem>>(StringComparer.OrdinalIgnoreCase);
            foreach (var k in kaynaklar)
            {
                if (k.Katman != "MALZEME" || k.Veri == null) continue;
                foreach (var n in k.Veri.Nesneler)
                {
                    var r = new Okuyucu { K = k, D = n.Degerler };
                    string nesne = r["NESNE"];
                    if (nesne.Length == 0) continue;
                    var kl = new Kalem
                    {
                        Cins = CinsKodu.Duzelt(r["CINS"]), Tanim = r["TANIM"], Aciklama = r["ACIKLAMA"], Durum = DurumKodu(r["DURUM"], ayar.VarsayilanDurum),
                        DmDurum = r["DM_DURUM"], Miktar = r.Sayi("MIKTAR"), Birim = r["BIRIM"], Katsayi = r.Sayi("KATSAYI", 1), Hakedis = r.Tam("HAKEDIS", ayar.Hakedis),
                        Tarife = r["TARIFE"], Sira = r["SIRA"], Kaynak = r["KAYNAK"].Length > 0 ? r["KAYNAK"] : "MALZEME", Ana = Evet(r["ANA"]) == true,
                        Kontrol = Evet(r["KONTROL"]),
                    };
                    double toplam = r.Sayi("TOPLAM", double.NaN);
                    kl.Toplam = double.IsNaN(toplam) ? SayiCoz.Temiz(kl.Miktar * kl.Katsayi) : toplam;
                    List<Kalem> l;
                    if (!malzemeler.TryGetValue(nesne, out l)) malzemeler[nesne] = l = new List<Kalem>();
                    l.Add(kl);
                }
            }
            // Malzeme tablosu alınıyorsa Şebeke-M'in dosyasındaki nesnelerin malzemeleri yalnız tablodan (satırı olmayanın
            // malzemesi yok); tablo yoksa ana malzeme katalogdan kurulur
            bool tabloVar = false;
            foreach (var k in kaynaklar) if (k.Katman == "MALZEME" && k.Veri != null) tabloVar = true;
            Func<CbsKaynagi, string, List<Kalem>> satirlari = (k, kimlik) =>
            {
                List<Kalem> l;
                if (!string.IsNullOrEmpty(kimlik) && malzemeler.TryGetValue(kimlik, out l)) return l.ConvertAll(x => x.Kopya());
                return tabloVar && k.SebekeM ? new List<Kalem>() : null;
            };
            Func<string> sira = () => ayar.Sira != null ? ayar.Sira() : "";

            foreach (var k in kaynaklar)
            {
                if (k.Veri == null || k.Katman.Length == 0 || k.Katman == "MALZEME") continue;
                int sirano = 0, atlanan = 0;
                foreach (var n in k.Veri.Nesneler)
                {
                    sirano++;
                    var r = new Okuyucu { K = k, D = n.Degerler };
                    string kimlik = r["KIMLIK"];
                    if (ElemanKatmani(k.Katman) || k.Katman == "NOKTA")
                    {
                        if (n.Parcalar.Count == 0 || n.Parcalar[0].Count == 0 || (n.Tur != "nokta" && n.Tur != "yazi")) { atlanan++; continue; }
                        var q = n.Parcalar[0][0];
                        if (k.Katman == "NOKTA")
                        {
                            var t = new Nokta { Id = Kimlik(k, kimlik, sirano, "nokta", cizim, null), Ad = r["AD"], Kod = r["KOD"], Saga = q[0], Yukari = q[1], Kot = r.Sayi("KOT"), Hakedis = r.Tam("HAKEDIS", ayar.Hakedis) };
                            if (r["EK"].Length > 0) t.EkMetinler.Add(r["EK"]);
                            p.Noktalar.Add(t);
                            continue;
                        }
                        var e = ElemanYap(k, r, q, katalog, ayar, sira, uyarilar);
                        e.Id = Kimlik(k, kimlik, sirano, "eleman", cizim, e);
                        var tablo = satirlari(k, kimlik);
                        if (tablo != null) e.Kalemler = tablo;
                        p.Elemanlar.Add(e);
                    }
                    else if (k.Katman == "BOLGE")
                    {
                        if (n.Tur != "alan" || n.Parcalar.Count == 0 || n.Parcalar[0].Count < 3) { atlanan++; continue; }
                        var b = new Bolge { Id = Kimlik(k, kimlik, sirano, "bolge", cizim, null), Ad = r["PROJE"], Kod = r["PROJE_KODU"], Grup = r["GRUP"], Aciklama = r["ACIKLAMA"] };
                        foreach (var x in n.Parcalar[0]) b.Sinir.Add(new[] { x[0], x[1] });
                        b.Alan = Geometri.Alan(b.Sinir);
                        p.Bolgeler.Add(b);
                    }
                    else // HAT, KANAL, SONDAJ: her çizgi parçası bir nesne
                    {
                        if (n.Tur != "cizgi" && n.Tur != "alan") { atlanan++; continue; }
                        int parca = 0;
                        foreach (var pr in n.Parcalar)
                        {
                            if (pr.Count < 2) continue;
                            parca++;
                            string pk = n.Parcalar.Count > 1 && kimlik.Length > 0 ? kimlik + "-" + parca : kimlik;
                            var kose = pr.ConvertAll(x => new[] { x[0], x[1] });
                            double L = 0;
                            for (int i = 1; i < kose.Count; i++) L += Geometri.Mesafe(kose[i - 1], kose[i]);
                            var tablo = parca == 1 ? satirlari(k, kimlik) : null;
                            if (k.Katman == "HAT")
                            {
                                var h = HatYap(k, r, kose, L, katalog, ayar, sira, uyarilar);
                                h.Id = Kimlik(k, pk, sirano, "hat", cizim, null);
                                if (tablo != null) h.Kalemler = tablo;
                                p.Hatlar.Add(h);
                            }
                            else if (k.Katman == "KANAL")
                            {
                                var c = new Kanal
                                {
                                    Id = Kimlik(k, pk, sirano, "kanal", cizim, null), Kod = KanalKoduOku(r["KABLOLAR"]), Zemin = r["ZEMIN"].Length > 0 ? r["ZEMIN"] : "TOPRAK",
                                    AltGenislik = r.Sayi("ALT_CM"), UstGenislik = r.Sayi("UST_CM"), Derinlik = r.Sayi("DERIN_CM"), BasNo = r["BAS_NO"], BitNo = r["BIT_NO"],
                                    Durum = DurumKodu(r["DURUM"], ayar.VarsayilanDurum), Hakedis = r.Tam("HAKEDIS", ayar.Hakedis), Kose = kose, CizimUzunlugu = L,
                                };
                                if (tablo != null) c.Kalemler = tablo;
                                else
                                {
                                    double m = r.Sayi("METRAJ");
                                    var kl = new Kalem
                                    {
                                        Cins = c.Kod.ToString(CultureInfo.InvariantCulture), Tanim = c.Zemin, Durum = c.Durum, Miktar = m > 0 ? m : Metraj.Kanal(L), Birim = "mt/m³",
                                        Katsayi = 1, Hakedis = c.Hakedis, Tarife = "", Sira = sira(), Ana = true, Kaynak = "NIT",
                                    };
                                    var zemin = katalog != null ? katalog.KanalZeminleri().Find(z => KatalogKalemi.Sade(z.Tanim) == KatalogKalemi.Sade(c.Zemin)) : null;
                                    kl.Tarife = Katalog.TarifeSec(zemin ?? new KatalogKalemi { Tarife = "0104", UnsurKoy = "16" }, ayar.Karakteristik, ayar.Koy);
                                    Metraj.Toplam(kl, c);
                                    c.Kalemler.Add(kl);
                                }
                                p.Kanallar.Add(c);
                            }
                            else
                            {
                                var s = new Sondaj
                                {
                                    Id = Kimlik(k, pk, sirano, "sondaj", cizim, null), Tip = r["TIP"], BasNo = r["BAS_NO"], BitNo = r["BIT_NO"],
                                    Durum = DurumKodu(r["DURUM"], ayar.VarsayilanDurum), Hakedis = r.Tam("HAKEDIS", ayar.Hakedis), Kose = kose, CizimUzunlugu = L,
                                };
                                if (tablo != null) s.Kalemler = tablo;
                                else
                                {
                                    var tip = katalog != null ? katalog.SondajTipleri().Find(z => KatalogKalemi.Sade(z.Tanim) == KatalogKalemi.Sade(s.Tip)) : null;
                                    double m = r.Sayi("METRAJ");
                                    if (tip != null) s.Kalemler.Add(Katalog.KalemYap(tip, m > 0 ? m : Math.Ceiling(L - 1e-6), s.Durum, s.Hakedis, true, "NIT", sira(), "", ayar.Karakteristik, ayar.Koy));
                                    else if (s.Tip.Length > 0) uyarilar.Add(k.Ad + ": sondaj tipi katalogda yok: " + s.Tip);
                                }
                                p.Sondajlar.Add(s);
                            }
                        }
                    }
                }
                if (atlanan > 0) uyarilar.Add(k.Ad + ": " + atlanan + " nesne " + SecenekAdi(k.Katman).ToLowerInvariant() + " olarak alınamadı (geometrisi uymuyor).");
            }
            return p;
        }

        /// <summary>
        /// Nesnenin kimliği. Şebeke-M'in dosyasında: aynı çizime geri alınıyorsa (aynı tanıtıcıda aynı türde nesne, elemanda
        /// aynı GIS no) tanıtıcının kendisi — nesne güncellenir; telefon kimliği (T…) olduğu gibi; ötekiler "CBS:kimlik".
        /// Başka CBS dosyasında "CBS:dosya:kimlik": aynı dosya yeniden alınınca önceki nesneler güncellenir (çift olmaz).
        /// Kimlik sütunu yoksa boş (her alışta yeni nesne).
        /// </summary>
        private static string Kimlik(CbsKaynagi k, string kimlik, int sirano, string nesne, Proje cizim, Eleman e)
        {
            if (string.IsNullOrEmpty(kimlik)) return "";
            if (k.SebekeM)
            {
                if (cizim != null && CizimdeAyni(cizim, nesne, kimlik, e)) return kimlik;
                if (kimlik.Length > 4 && kimlik[0] == 'T') return kimlik;
                return "CBS:" + kimlik;
            }
            return "CBS:" + k.Ad + ":" + kimlik;
        }

        private static bool CizimdeAyni(Proje c, string nesne, string id, Eleman e)
        {
            switch (nesne)
            {
                case "eleman":
                    var x = c.Elemanlar.Find(z => string.Equals(z.Id, id, StringComparison.OrdinalIgnoreCase));
                    return x != null && e != null && (x.GisId ?? "") == (e.GisId ?? "") && x.Tur == e.Tur;
                case "hat": return c.Hatlar.Exists(z => string.Equals(z.Id, id, StringComparison.OrdinalIgnoreCase));
                case "kanal": return c.Kanallar.Exists(z => string.Equals(z.Id, id, StringComparison.OrdinalIgnoreCase));
                case "sondaj": return c.Sondajlar.Exists(z => string.Equals(z.Id, id, StringComparison.OrdinalIgnoreCase));
                case "bolge": return c.Bolgeler.Exists(z => string.Equals(z.Id, id, StringComparison.OrdinalIgnoreCase));
                case "nokta": return c.Noktalar.Exists(z => string.Equals(z.Id, id, StringComparison.OrdinalIgnoreCase));
            }
            return false;
        }

        private static Eleman ElemanYap(CbsKaynagi k, Okuyucu r, double[] q, Katalog katalog, CbsAlmaAyari ayar, Func<string> sira, List<string> uyarilar)
        {
            string cins = CinsKodu.Duzelt(r["CINS"]), tip = r["TIP"];
            string tur = ElemanTuruBul(k.Katman, r["TUR"], cins, tip, r["GERILIM"]);
            var e = new Eleman
            {
                Tur = tur, GisId = r["GIS_NO"], Cins = cins, Tip = tip, Durum = DurumKodu(r["DURUM"], ayar.VarsayilanDurum), DmDurum = r["DM_DURUM"],
                Hakedis = r.Tam("HAKEDIS", ayar.Hakedis), Saga = q[0], Yukari = q[1], Kot = r.Sayi("KOT"), Aci = r.Sayi("ACI") * Math.PI / 180,
                Guc = r["GUC"], Gerilim = r["GERILIM"], Kontrol = Evet(r["KONTROL"]), TelefonId = r["TELEFON_ID"],
            };
            // Ana malzeme (direğin, trafonun … kendi pozu) katalogdan: cins + tip, yoksa türün tiplerinde tip adıyla
            KatalogKalemi kk = null;
            if (katalog != null && tip.Length > 0)
            {
                if (cins.Length > 0) kk = katalog.Bul(cins, tip);
                if (kk == null) kk = katalog.AnaTipler(tur).Find(z => KatalogKalemi.Sade(z.Tanim) == KatalogKalemi.Sade(tip));
            }
            if (kk != null)
            {
                e.Cins = kk.Cins;
                e.Tip = kk.Tanim;
                e.Kalemler.Add(Katalog.KalemYap(kk, 1, e.Durum, e.Hakedis, true, "NIT", sira(), e.DmDurum, ayar.Karakteristik, ayar.Koy));
            }
            else if (tip.Length > 0 || cins.Length > 0)
            {
                e.Kalemler.Add(new Kalem
                {
                    Cins = cins, Tanim = tip, Durum = e.Durum, DmDurum = e.DmDurum, Miktar = 1, Birim = "ad/ad", Katsayi = 1, Toplam = 1,
                    Hakedis = e.Hakedis, Sira = sira(), Ana = true, Kaynak = "NIT",
                });
                uyarilar.Add(k.Ad + ": " + (e.GisId.Length > 0 ? e.GisId + " " : "") + "tipi katalogda yok: " + (cins.Length > 0 ? cins + " " : "") + tip);
            }
            return e;
        }

        /// <summary>
        /// Elemanın türü: TUR sütunundaki kod ya da ad; yoksa cinsinden; o da yoksa dosyanın katmanından (direkte gerilime göre
        /// OG / müşterek / aydınlatma, trafoda köşk / bina).
        /// </summary>
        public static string ElemanTuruBul(string katman, string tur, string cins, string tip, string gerilim)
        {
            var t = Turler.Eleman(tur);
            if (t == null && !string.IsNullOrEmpty(tur))
                foreach (var x in Turler.Elemanlar) if (Normal(x.Ad) == Normal(tur)) { t = x; break; }
            if (t != null) return t.Kod;
            if (!string.IsNullOrEmpty(cins))
            {
                string c = NesneOkuyucu.ElemanTuru(cins);
                if (c != "DIGER") return c;
            }
            string ipucu = Normal((tur ?? "") + " " + (cins ?? "") + " " + (tip ?? "") + " " + (gerilim ?? ""));
            switch (katman)
            {
                case "DIREK":
                    if (ipucu.Contains("MUS")) return "MUSTEREK_DIREK";
                    if (ipucu.Contains("AYD")) return "AYD_DIREK";
                    if (ipucu.Contains("OG") || ipucu.Contains("ENH") || ipucu.Contains("34_5") || ipucu.Contains("33") || ipucu.Contains("31_5")) return "ENH_DIREK";
                    return "AG_DIREK";
                case "TRAFO":
                    return ipucu.Contains("KOSK") || ipucu.Contains("BINA") || ipucu.Contains("MERKEZ") || ipucu.Contains("BETON") ? "TRAFO_MERKEZI" : "TRAFO_DIREGI";
                case "SDK": return "BOX";
                case "PANO": return "PANO";
                default:
                    if (ipucu.Contains("MUFU")) return "EK_MUFU";
                    if (ipucu.Contains("KOFR")) return "KOFRE";
                    return "DIGER";
            }
        }

        private static Hat HatYap(CbsKaynagi k, Okuyucu r, List<double[]> kose, double L, Katalog katalog, CbsAlmaAyari ayar, Func<string> sira, List<string> uyarilar)
        {
            var h = new Hat { Durum = DurumKodu(r["DURUM"], ayar.VarsayilanDurum), Hakedis = r.Tam("HAKEDIS", ayar.Hakedis), Kose = kose, CizimUzunlugu = L, TelefonId = r["TELEFON_ID"] };
            h.Kontrol = Evet(r["KONTROL"]);
            // İletkenler: cins + ad; yoksa kesit yazısı katalogdaki iletken / kablo adlarında aranır
            var iletkenler = new List<HatIletkeni>();
            foreach (var on in new[] { "ILETKEN", "ILETKEN2" })
            {
                string ad = r[on];
                if (ad.Length == 0 && on == "ILETKEN") ad = r["KESIT"];
                if (ad.Length == 0) continue;
                var kk = IletkenBul(katalog, CinsKodu.Duzelt(r[on + "_CINS"]), ad);
                int adet = Math.Max(1, r.Tam(on + "_ADET", 1));
                if (kk != null) iletkenler.Add(new HatIletkeni(kk, adet));
                else uyarilar.Add(k.Ad + ": iletken / kablo katalogda yok: " + ad);
            }
            var t = Turler.Hat(r["TUR"]);
            if (t == null && r["TUR"].Length > 0)
                foreach (var x in Turler.Hatlar) if (Normal(x.Ad) == Normal(r["TUR"])) { t = x; break; }
            string tur = t != null ? t.Kod : iletkenler.Count > 0 ? NesneOkuyucu.HatTuru("", iletkenler[0].Kesit.Cins) : "DIGER";
            if (tur == "DIGER")
            {
                string ipucu = Normal(k.Ad + " " + r["TUR"] + " " + r["KESIT"]);
                bool og = ipucu.Contains("OG") || ipucu.Contains("ENH") || ipucu.Contains("SWALLOW") || ipucu.Contains("RAVEN") || ipucu.Contains("PIGEON") || ipucu.Contains("PARTRIDGE");
                bool yeralti = ipucu.Contains("KABLO") || ipucu.Contains("YERALTI") || ipucu.Contains("NYY") || ipucu.Contains("XLPE");
                tur = og ? (yeralti ? "OG_YERALTI" : "OG_HAVAI") : (yeralti ? "AG_YERALTI" : "AG_HAVAI");
            }
            h.Tur = tur;
            double m = r.Sayi("METRAJ");
            if (m <= 0) m = ayar.HatMetraji != null ? ayar.HatMetraji(L, tur) : SayiCoz.Temiz(L, 2);
            if (iletkenler.Count > 0)
            {
                h.Kalemler.AddRange(Iletkenler.Kalemler(iletkenler, m, h.Durum, h.Hakedis, sira, ayar.Karakteristik, ayar.Koy));
                h.AnaKesit = r["KESIT"].Length > 0 ? r["KESIT"] : Iletkenler.AnaKesit(iletkenler);
            }
            else
            {
                h.AnaKesit = r["KESIT"];
                if (h.AnaKesit.Length > 0)
                    h.Kalemler.Add(new Kalem { Cins = "", Tanim = h.AnaKesit, Durum = h.Durum, Miktar = m, Birim = "mt/mt", Katsayi = 1, Toplam = m, Hakedis = h.Hakedis, Sira = sira(), Kaynak = "HAT" });
            }
            return h;
        }

        /// <summary>İletken / kablo katalog kalemi: cins + ad, yoksa bütün iletken ve kabloların adlarında (büyük / küçük harf, boşluk farksız).</summary>
        public static KatalogKalemi IletkenBul(Katalog katalog, string cins, string ad)
        {
            if (katalog == null || string.IsNullOrEmpty(ad)) return null;
            string ic;
            int n;
            if (Iletkenler.AdetliMi(ad, out n, out ic)) ad = ic;
            KatalogKalemi kk = !string.IsNullOrEmpty(cins) ? katalog.Bul(cins, ad) : null;
            if (kk != null) return kk;
            string sade = KatalogKalemi.Sade(ad), bitisik = sade.Replace(" ", "");
            foreach (var it in katalog.Kalemler)
            {
                if (it.Rol != "hat") continue;
                string s = KatalogKalemi.Sade(it.Tanim);
                if (s == sade || s.Replace(" ", "") == bitisik) return it;
            }
            return null;
        }

        /// <summary>Durum yazısından Şebeke-M durum kodu (M, M+M, DM, DM+M, MEVCUT, KM, ENH, ME); bilinmiyorsa varsayılan.</summary>
        public static string DurumKodu(string durum, string varsayilan)
        {
            string d = (durum ?? "").Trim().ToUpperInvariant().Replace('İ', 'I');
            if (d.Length == 0) return varsayilan;
            foreach (var k in Turler.Durumlar) if (string.Equals(k, d, StringComparison.Ordinal)) return k;
            string n = Normal(durum);
            if (n.StartsWith("MEVCUT") || n == "VAR" || n.Contains("ISLETME") || n.Contains("KULLANIM") || n == "AKTIF") return "MEVCUT";
            if (n.Contains("SOK_TAK") || n.Contains("DEGIS") || n.Contains("YENILEN")) return "DM+M";
            if (n.StartsWith("DEMONTAJ") || n.Contains("SOKUL") || n.Contains("KALDIR") || n == "IPTAL") return "DM";
            if (n.StartsWith("YENI") || n.Contains("PROJE") || n.Contains("TESIS") || n.Contains("YAPILACAK") || n.StartsWith("MONTAJ")) return "M";
            return varsayilan;
        }

        /// <summary>EVET / HAYIR (E, H, 1, 0, TRUE, FALSE) → true / false; boş ya da tanınmayan → null.</summary>
        public static bool? Evet(string s)
        {
            string n = Normal(s);
            if (n == "EVET" || n == "E" || n == "1" || n == "TRUE" || n == "T" || n == "YES") return true;
            if (n == "HAYIR" || n == "H" || n == "0" || n == "FALSE" || n == "F" || n == "NO") return false;
            return null;
        }

        /// <summary>Kanal kablo yazısı ("OG/AG/AYD") → kanal kodu; sayıysa olduğu gibi.</summary>
        public static int KanalKoduOku(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return KanalKodu.AG;
            int kod;
            if (int.TryParse(s.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out kod)) return kod;
            string n = "_" + Normal(s) + "_";
            return KanalKodu.Kod(n.Contains("_OG_"), n.Contains("_AG_"), n.Contains("_AYD_"), n.Contains("_REK_"));
        }
    }
}
