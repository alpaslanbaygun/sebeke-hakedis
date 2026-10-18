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
        /// <summary>Hakediş onayları (AutoCAD HAK_ONAY): hakediş no → bitler (Kontrol 4, Hakediş 2, GIS 1). Bkz. HakedisOnayi.</summary>
        public SortedDictionary<int, int> Onaylar = new SortedDictionary<int, int>();

        public Bolge BolgeBul(string id)
        {
            foreach (var b in Bolgeler) if (b.Id == id) return b;
            return null;
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
