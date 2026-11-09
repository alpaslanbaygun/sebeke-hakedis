using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    // Ortak veri modeli. Telefon uygulaması ve AutoCAD eklentisi aynı proje dosyasını kullanır.
    // Koordinatlar Türk ölçme geleneğiyle değil, açık adlarla tutulur:
    //   Saga   = sağa değer (doğu, CAD X)
    //   Yukari = yukarı değer (kuzey, CAD Y)
    //   Kot    = yükseklik

    /// <summary>Bir poz satırı: bir nesneye bağlı malzeme ya da iş kalemi.</summary>
    public sealed class Kalem
    {
        public string Cins = "";        // ör. AG_DEMİR_GLV
        public string Tanim = "";       // ör. G-K2 (hatlarda ana kesit: 1x150/25 Xlpe Alm.)
        public string Aciklama = "";    // hatlarda çizimdeki tam yazım: 3(1x150/25) Xlpe Alm.
        public string Durum = "";       // M, M+M, DM, DM+M, MEVCUT, KM, ME
        public double Miktar;           // giriş biriminde miktar (ad, mt, kg...)
        public string Birim = "";       // "giriş/rapor" ör. ad/kg, mt/kg, mt/mt, mt/m³
        public double Katsayi = 1;      // giriş biriminden rapor birimine çarpan (ör. kg/m)
        public double Toplam;           // rapor biriminde miktar = Miktar × Katsayi
        public double BirimFiyat;
        public int Hakedis;
        public string Tarife = "";      // ör. 0107 (ilk iki hane karakteristik, son iki hane unsur)
        public string DmDurum = "";     // demontajda KESİK / SÖKÜK
        public string Sira = "";        // AutoCAD'deki kalem numarası (INDEX)
        public bool? Kontrol;
        public bool Ana;                // nesnenin kendi pozu mu (direk, box, trafo...)
        public string Kaynak = "";      // NIT, MALZEME, HAT

        public double ToplamTutar => Toplam * BirimFiyat;

        public Kalem Kopya() => (Kalem)MemberwiseClone();
    }

    public sealed class Bolge
    {
        public string Id = "";
        public string Ad = "";
        public string Kod = "";         // ör. 11.22.33.19.12345 (AutoCAD: bölge tarifesi)
        /// <summary>AutoCAD grup kodu (FULLREG üçüncü alanı, ör. "24.38.01 (NA)").</summary>
        public string Grup = "";
        public string Aciklama = "";
        public List<double[]> Sinir = new List<double[]>(); // [Saga, Yukari]
        public double Alan;              // m², hesaplanır
    }

    public sealed class Nokta
    {
        public string Id = "";
        public string Ad = "";          // ör. SC430 ya da mevcut direk no
        public string Kod = "";         // ör. AD2-120, 10İ, K1
        public double Saga, Yukari, Kot;
        public int Hakedis;
        public string Bolge = "";
        public List<string> EkMetinler = new List<string>();
        /// <summary>Telefondaki kayıt kimliği (çizimde SH_ID); dosyada "telefonId".</summary>
        public string TelefonId = "";
    }

    /// <summary>Noktasal şebeke elemanı: direk, box, pano, trafo, ek mufu, kofre...</summary>
    public sealed class Eleman
    {
        public string Id = "";
        public string Tur = "";         // AG_DIREK, MUSTEREK_DIREK, AYD_DIREK, ENH_DIREK, TRAFO_DIREGI, TRAFO_MERKEZI, PANO, BOX, EK_MUFU, KOFRE, DIGER
        public string GisId = "";       // ör. SC77
        public string Cins = "";
        public string Tip = "";
        public string Durum = "";
        public int Hakedis;
        public string Bolge = "";
        public double Saga, Yukari, Kot, Aci;
        public string Guc = "";
        public string Gerilim = "";
        public string DmDurum = "";
        public bool? Kontrol;
        public string Katman = "";
        public string Blok = "";
        public List<Kalem> Kalemler = new List<Kalem>();
        /// <summary>Telefondaki kayıt kimliği (çizimde SH_ID); dosyada "telefonId". Telefon dosyayı geri alırken kaydını bununla bulur.</summary>
        public string TelefonId = "";
        /// <summary>
        /// AutoCAD'in eklentinin düzenlemediği verileri (pano çıkış şeması ANA / CON, bina tipi trafonun hücreleri FIDER):
        /// okunur, dosyada taşınır ve aynen geri yazılır.
        /// </summary>
        public Dictionary<string, List<string>> EkVeri = new Dictionary<string, List<string>>(StringComparer.Ordinal);
    }

    /// <summary>Hat: AG/OG havai, yeraltı kablo, aydınlatma, rekortman (abone bağlantısı).</summary>
    public sealed class Hat
    {
        public string Id = "";
        public string Tur = "";         // AG_HAVAI, AG_YERALTI, AYDINLATMA, OG_HAVAI, OG_YERALTI, REKORTMAN, MUSTEREK
        public string AnaKesit = "";    // ör. 3X50/16+70 ALPEK
        public string Durum = "";
        public int Hakedis;
        public string Bolge = "";
        public List<double[]> Kose = new List<double[]>();
        public double CizimUzunlugu;    // köşelerden hesaplanan uzunluk (m)
        public string Etiket = "";
        public bool? Kontrol;
        public string Katman = "";
        public List<Kalem> Kalemler = new List<Kalem>();
        public string TelefonId = "";
    }

    /// <summary>Kablo kanalı. Kod, kanaldaki kablo türlerinin toplamıdır: REK 1, AYD 2, AG 4, OG 8.</summary>
    public sealed class Kanal
    {
        public string Id = "";
        public int Kod;
        public string Zemin = "";       // TOPRAK, TUVENAN, PARKE TUVENAN (BARİYERLİ)...
        public double AltGenislik, UstGenislik, Derinlik; // cm
        public string BasNo = "", BitNo = "";
        public string Durum = "";
        public int Hakedis;
        public string Bolge = "";
        public List<double[]> Kose = new List<double[]>();
        public double CizimUzunlugu;
        public bool? Kontrol;
        public List<Kalem> Kalemler = new List<Kalem>();
        public string TelefonId = "";

        public string Kablolar => KanalKodu.Kablolar(Kod);
    }

    public sealed class Sondaj
    {
        public string Id = "";
        public string Tip = "";
        public string Durum = "";
        public int Hakedis;
        public string Bolge = "";
        public string BasNo = "", BitNo = "";
        public List<double[]> Kose = new List<double[]>();
        public double CizimUzunlugu;
        public bool? Kontrol;
        public List<Kalem> Kalemler = new List<Kalem>();
        public string TelefonId = "";
    }

    public sealed class Proje
    {
        public string Ad = "";
        public string Kaynak = "";
        public string KoordinatSistemi = "TM";
        public string Datum = "ITRF96";
        public int Dom;                  // dilim orta meridyeni (0 = belirtilmemiş)
        public int AktifHakedis = 1;
        public string KatmanOnEki = "";
        /// <summary>GIS numaralarının ön eki (boşsa katman ön eki kullanılır).</summary>
        public string GisOnEki = "";
        public List<Bolge> Bolgeler = new List<Bolge>();
        public List<Nokta> Noktalar = new List<Nokta>();
        public List<Eleman> Elemanlar = new List<Eleman>();
        public List<Hat> Hatlar = new List<Hat>();
        public List<Kanal> Kanallar = new List<Kanal>();
        public List<Sondaj> Sondajlar = new List<Sondaj>();
        public List<string> Uyarilar = new List<string>();
        /// <summary>Teknik hesap sonuçları (Hesap Merkezi; proje dosyasında "hesaplar"). Çizimde sözlükte saklanır.</summary>
        public List<HesapKaydi> Hesaplar = new List<HesapKaydi>();
        /// <summary>Hakediş onayları (AutoCAD HAK_ONAY): hakediş no → bitler (Kontrol 4, Hakediş 2, GIS 1). Bkz. HakedisOnayi.</summary>
        public SortedDictionary<int, int> Onaylar = new SortedDictionary<int, int>();
        /// <summary>Kullanıcılar ve roller (telefondaki üyeler; proje.kullanicilar). Etkin Yönetici varsa onay mekanizması açıktır.</summary>
        public List<Kullanici> Kullanicilar = new List<Kullanici>();
        /// <summary>Onay ayarı ve hakediş yetkisi (proje.onayAyari); ayarlanmadıysa null.</summary>
        public OnayAyari OnayAyari;
        /// <summary>Simge ve yazı boyutları (proje dosyasında "boyutlar"; null: varsayılan, telefonla aynı).</summary>
        public Boyutlar Boyutlar;

        public Bolge BolgeBul(string id)
        {
            foreach (var b in Bolgeler) if (b.Id == id) return b;
            return null;
        }
    }

    /// <summary>
    /// Çizimin simge ve yazı boyutları (Çizim Ayarları › Görünüm; proje dosyasında proje.boyutlar — telefon da okur, DXF'i
    /// bunlarla çizer): simge büyüklüğü (kat; 1 = telefonla aynı, 1/1000 pafta), hat etiketi (kablo tipi), metraj ve eleman
    /// yazısı (GIS no, tip) yüksekliği (m); hat kalınlığı (kat: ortak stildeki kalınlıkların çarpanı, 0 = ince çizgi) ve
    /// elemanın malzemelerinin çizimde yazılıp yazılmayacağı (MalzemeEtiketi).
    /// </summary>
    public sealed class Boyutlar
    {
        public const double VarsayilanSimge = 1, VarsayilanEtiket = 1.8, VarsayilanMetraj = 1.44, VarsayilanEleman = 1.8;
        public const double VarsayilanKalinlik = 1;
        public const bool VarsayilanMalzemeYazisi = false;
        public double SimgeOlcegi = VarsayilanSimge, EtiketYuksekligi = VarsayilanEtiket, MetrajYuksekligi = VarsayilanMetraj,
                      ElemanYaziYuksekligi = VarsayilanEleman;
        /// <summary>Hat (iletken, kablo) çizgi kalınlığının çarpanı: ortak stildeki kalınlık (m, 1/1000 paftada mm) × bu; 0 = ince çizgi.</summary>
        public double HatKalinligi = VarsayilanKalinlik;
        /// <summary>Elemanın malzemeleri simgenin yanında satır satır yazılsın ("GT-60=1 (M)").</summary>
        public bool MalzemeYazisi = VarsayilanMalzemeYazisi;
        /// <summary>Simge takımı: "" klasik, "SM" Şebeke-M (kullanıcının SM_* tasarımı; Çizim Ayarları › Görünüm). Telefonla ortak alan.</summary>
        public string SimgeTakimi = VarsayilanTakim;
        public const string VarsayilanTakim = "";

        /// <summary>Geçerli takım adı: "" ya da "SM"; başka değer klasiğe döner.</summary>
        public static string TakimDuzelt(string t) => string.Equals((t ?? "").Trim(), "SM", StringComparison.OrdinalIgnoreCase) ? "SM" : "";

        /// <summary>Hepsi varsayılan mı (dosyaya yalnız farklıysa yazılır).</summary>
        public bool Varsayilan =>
            Math.Abs(SimgeOlcegi - VarsayilanSimge) < 1e-9 && Math.Abs(EtiketYuksekligi - VarsayilanEtiket) < 1e-9 &&
            Math.Abs(MetrajYuksekligi - VarsayilanMetraj) < 1e-9 && Math.Abs(ElemanYaziYuksekligi - VarsayilanEleman) < 1e-9 &&
            Math.Abs(HatKalinligi - VarsayilanKalinlik) < 1e-9 && MalzemeYazisi == VarsayilanMalzemeYazisi && TakimDuzelt(SimgeTakimi) == VarsayilanTakim;

        /// <summary>Makul aralık (simge 0,1–20 kat; yazılar 0,05–50 m; hat kalınlığı 0–5 kat); bozuk değer varsayılana döner.</summary>
        public Boyutlar Duzelt()
        {
            if (!(SimgeOlcegi >= 0.1 && SimgeOlcegi <= 20)) SimgeOlcegi = VarsayilanSimge;
            if (!(EtiketYuksekligi >= 0.05 && EtiketYuksekligi <= 50)) EtiketYuksekligi = VarsayilanEtiket;
            if (!(MetrajYuksekligi >= 0.05 && MetrajYuksekligi <= 50)) MetrajYuksekligi = VarsayilanMetraj;
            if (!(ElemanYaziYuksekligi >= 0.05 && ElemanYaziYuksekligi <= 50)) ElemanYaziYuksekligi = VarsayilanEleman;
            if (!(HatKalinligi >= 0 && HatKalinligi <= 5)) HatKalinligi = VarsayilanKalinlik;
            SimgeTakimi = TakimDuzelt(SimgeTakimi);
            return this;
        }

        public bool Ayni(Boyutlar b) =>
            b != null && Math.Abs(SimgeOlcegi - b.SimgeOlcegi) < 1e-9 && Math.Abs(EtiketYuksekligi - b.EtiketYuksekligi) < 1e-9 &&
            Math.Abs(MetrajYuksekligi - b.MetrajYuksekligi) < 1e-9 && Math.Abs(ElemanYaziYuksekligi - b.ElemanYaziYuksekligi) < 1e-9 &&
            Math.Abs(HatKalinligi - b.HatKalinligi) < 1e-9 && MalzemeYazisi == b.MalzemeYazisi && TakimDuzelt(SimgeTakimi) == TakimDuzelt(b.SimgeTakimi);

        public Boyutlar Kopya() => new Boyutlar
        {
            SimgeOlcegi = SimgeOlcegi, EtiketYuksekligi = EtiketYuksekligi, MetrajYuksekligi = MetrajYuksekligi,
            ElemanYaziYuksekligi = ElemanYaziYuksekligi, HatKalinligi = HatKalinligi, MalzemeYazisi = MalzemeYazisi, SimgeTakimi = SimgeTakimi,
        };

        /// <summary>Kısa yazı: "simge 1,5 kat · kablo tipi 2 m · metraj 1,6 m · eleman yazısı 2 m · hat kalınlığı 1 kat · malzemeler yazılı".</summary>
        public override string ToString()
        {
            var tr = System.Globalization.CultureInfo.GetCultureInfo("tr-TR");
            return "simge " + SimgeOlcegi.ToString("0.##", tr) + " kat · kablo tipi " + EtiketYuksekligi.ToString("0.##", tr) + " m · metraj " +
                   MetrajYuksekligi.ToString("0.##", tr) + " m · eleman yazısı " + ElemanYaziYuksekligi.ToString("0.##", tr) + " m · hat kalınlığı " +
                   (HatKalinligi > 0 ? HatKalinligi.ToString("0.##", tr) + " kat" : "ince") + (MalzemeYazisi ? " · malzemeler yazılı" : "") +
                   (TakimDuzelt(SimgeTakimi) == "SM" ? " · Şebeke-M simgeleri" : "");
        }
    }

    /// <summary>Kanal kodu ile kanaldaki kablo türleri arasındaki çeviri.</summary>
    public static class KanalKodu
    {
        public const int REK = 1, AYD = 2, AG = 4, OG = 8;

        /// <summary>AutoCAD raporundaki yazım: "OG", "/AG/AYD", "OG/AG/AYD/REK" ...</summary>
        public static string Kablolar(int kod)
        {
            string s = "";
            if ((kod & OG) != 0) s += "OG";
            if ((kod & AG) != 0) s += "/AG";
            if ((kod & AYD) != 0) s += "/AYD";
            if ((kod & REK) != 0) s += "/REK";
            return s;
        }

        public static int Kod(bool og, bool ag, bool ayd, bool rek)
            => (og ? OG : 0) | (ag ? AG : 0) | (ayd ? AYD : 0) | (rek ? REK : 0);
    }
}
