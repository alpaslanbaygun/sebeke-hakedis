using System;
using System.Collections.Generic;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Eleman ya da hat türü: kod (veri), ad (ekranda), GIS numarası biçimi.</summary>
    public sealed class Tur
    {
        public readonly string Kod, Ad, Gis;

        public Tur(string kod, string ad, string gis = "")
        {
            Kod = kod; Ad = ad; Gis = gis;
        }

        public override string ToString() => Ad;
    }

    /// <summary>Telefon uygulamasıyla aynı tür, durum ve zemin listeleri (sh-core.js).</summary>
    public static class Turler
    {
        /// <summary>Gis: direk (ortak sıra SC77), TR (SCTR10), P (SCP03), B (SCB12), mufu (EKOG/EKAG), boş (numara yok).</summary>
        public static readonly Tur[] Elemanlar =
        {
            new Tur("AG_DIREK", "AG Direk", "direk"),
            new Tur("MUSTEREK_DIREK", "Müşterek Direk", "direk"),
            new Tur("AYD_DIREK", "Aydınlatma Direği", "direk"),
            new Tur("ENH_DIREK", "ENH Direği", "direk"),
            new Tur("TRAFO_DIREGI", "Trafo Direği", "TR"),
            new Tur("TRAFO_MERKEZI", "Trafo Merkezi (Köşk)", "TR"),
            new Tur("PANO", "Pano", "P"),
            new Tur("BOX", "Box", "B"),
            new Tur("EK_MUFU", "Ek Mufu", "mufu"),
            new Tur("KOFRE", "Kofre", ""),
            new Tur("DIGER", "Diğer", ""),
        };

        public static readonly Tur[] Hatlar =
        {
            new Tur("AG_HAVAI", "AG Havai"),
            new Tur("AG_YERALTI", "AG Yeraltı"),
            new Tur("AYDINLATMA", "Aydınlatma"),
            new Tur("OG_HAVAI", "OG Havai"),
            new Tur("OG_YERALTI", "OG Yeraltı"),
            new Tur("REKORTMAN", "Rekortman"),
            new Tur("MUSTEREK", "Müşterek"),
        };

        /// <summary>çizim durum kodları (Sayfa1 sırasıyla; sık kullanılanlar önde).</summary>
        public static readonly string[] Durumlar = { "M", "M+M", "KM", "DM", "DM+M", "MEVCUT", "ENH", "ME" };

        /// <summary>Çizimde yeni nesne için seçilebilen durumlar (ENH ve ME yalnız kalem düzenlemede).</summary>
        public static readonly string[] CizimDurumlari = { "M", "M+M", "KM", "DM", "DM+M", "MEVCUT" };

        public static readonly string[] DmDurumlari = { "", "KESİK", "SÖKÜK" };

        /// <summary>Demontaj türü durumlar (KESİK / SÖKÜK seçilebilir; etiket köşeli ayraçla).</summary>
        public static bool DemontajMi(string durum) => durum == "DM" || durum == "DM+M";

        public static readonly string[] Zeminler =
        {
            "TOPRAK", "TOPRAK (BARİYERLİ)", "TUVENAN", "TUVENAN (BARİYERLİ)", "PARKE TOPRAK", "PARKE TUVENAN",
            "PARKE TUVENAN (BARİYERLİ)", "BRANŞMAN KANAL",
        };

        /// <summary>Türkiye'de kullanılan 3° TM dilim orta meridyenleri.</summary>
        public static readonly int[] Domlar = { 27, 30, 33, 36, 39, 42, 45 };

        public static string DurumAdi(string durum)
        {
            switch (durum)
            {
                case "M": return "Montaj (malzeme kurumdan)";
                case "M+M": return "Malzeme + Montaj (yüklenici)";
                case "KM": return "Kurum montajı, malzeme yükleniciden";
                case "DM": return "Demontaj";
                case "DM+M": return "Sök-Tak";
                case "MEVCUT": return "Mevcut";
                case "ENH": return "Kilometrik bedelli iş";
                case "ME": return "Mutabakat eksiği";
                default: return durum ?? "";
            }
        }

        public static Tur Eleman(string kod) => Array.Find(Elemanlar, t => t.Kod == kod);

        public static Tur Hat(string kod) => Array.Find(Hatlar, t => t.Kod == kod);

        public static string ElemanAdi(string kod) => Eleman(kod)?.Ad ?? kod ?? "";

        public static string HatAdi(string kod) => Hat(kod)?.Ad ?? kod ?? "";
    }
}
