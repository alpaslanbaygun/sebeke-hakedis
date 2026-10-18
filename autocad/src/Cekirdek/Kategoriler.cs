using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Menüdeki bir öğe: komut + tür (+ cins süzgeci). Ör. "AG Direk" = SH_ELEMAN, AG_DIREK.</summary>
    public sealed class MenuOgesi
    {
        public string Kod = "", Ad = "", Kisa = "", Komut = "", Tur = "", Kablolar = "";
        /// <summary>Boşsa türün bütün cinsleri; doluysa yalnız bunlar listelenir (ör. yalnız AG ek mufları).</summary>
        public List<string> Cinsler = new List<string>();
        public MenuKategorisi Kategori;

        public bool ElemanMi => Komut == "SH_ELEMAN";
        public bool HatMi => Komut == "SH_HAT";
        /// <summary>Tip seçimi gerektiren öğeler (eleman, hat, sondaj); kanal ve diğerleri kendi penceresini açar.</summary>
        public bool TipliMi => ElemanMi || HatMi || Komut == "SH_SONDAJ";

        /// <summary>Son seçimlerin saklandığı anahtar (çizim ayarları › Son).</summary>
        public string Anahtar => "menu." + Kod;

        public override string ToString() => Ad;
    }

    public sealed class MenuKategorisi
    {
        public string Kod = "", Ad = "", Kisa = "", Renk = "", Aciklama = "";
        public List<MenuOgesi> Ogeler = new List<MenuOgesi>();

        public override string ToString() => Ad;
    }

    /// <summary>
    /// Çizim menüsünün kategori tablosu (ortak/katalog/kategoriler.json): şeritte önce kategori seçilir, yalnız o
    /// kategorinin öğeleri görünür; her öğe doğrudan çizime atanır (komut + tür + cins süzgeci).
    /// </summary>
    public static class Kategoriler
    {
        private static List<MenuKategorisi> _liste;

        public static bool Yuklu => _liste != null;

        public static void Yukle(string json)
        {
            var liste = new List<MenuKategorisi>();
            var kok = Json.Oku(json) as JsonNesne;
            if (kok == null) throw new InvalidOperationException("kategoriler.json okunamadı");
            var dizi = kok.Dizi("kategoriler");
            if (dizi == null) throw new InvalidOperationException("kategoriler.json: 'kategoriler' yok");
            foreach (var x in dizi)
            {
                var o = x as JsonNesne;
                if (o == null) continue;
                var k = new MenuKategorisi { Kod = o.Metin("kod"), Ad = o.Metin("ad"), Kisa = o.Metin("kisa"), Renk = o.Metin("renk"), Aciklama = o.Metin("aciklama") };
                var ogeler = o.Dizi("ogeler");
                if (ogeler != null)
                    foreach (var y in ogeler)
                    {
                        var p = y as JsonNesne;
                        if (p == null) continue;
                        var m = new MenuOgesi { Kod = p.Metin("kod"), Ad = p.Metin("ad"), Kisa = p.Metin("kisa"), Komut = p.Metin("komut"), Tur = p.Metin("tur"), Kablolar = p.Metin("kablolar"), Kategori = k };
                        var c = p.Dizi("cinsler");
                        if (c != null) foreach (var s in c) { var cs = Convert.ToString(s, CultureInfo.InvariantCulture); if (!string.IsNullOrEmpty(cs)) m.Cinsler.Add(cs); }
                        if (string.IsNullOrEmpty(m.Kisa)) m.Kisa = m.Ad.Length >= 2 ? m.Ad.Substring(0, 2).ToUpperInvariant() : m.Ad;
                        k.Ogeler.Add(m);
                    }
                liste.Add(k);
            }
            _liste = liste;
        }

        /// <summary>Tablo yüklenmediyse (deneme ortamı) türlerden kurulan sade bir menü.</summary>
        public static List<MenuKategorisi> Hepsi()
        {
            if (_liste == null) _liste = Varsayilan();
            return _liste;
        }

        public static MenuKategorisi Bul(string kod) => Hepsi().Find(k => k.Kod == kod);

        /// <summary>Kategori kodu + öğe kodu ile öğe ("AG_HAVAI/AG_DIREK"); kategori verilmezse ilk eşleşen öğe.</summary>
        public static MenuOgesi Oge(string kategoriKodu, string ogeKodu)
        {
            foreach (var k in Hepsi())
            {
                if (!string.IsNullOrEmpty(kategoriKodu) && k.Kod != kategoriKodu) continue;
                var m = k.Ogeler.Find(o => o.Kod == ogeKodu);
                if (m != null) return m;
            }
            return null;
        }

        private static List<MenuKategorisi> Varsayilan()
        {
            var l = new List<MenuKategorisi>();
            var e = new MenuKategorisi { Kod = "ELEMANLAR", Ad = "Elemanlar", Kisa = "EL", Renk = "#B45309" };
            foreach (var t in Turler.Elemanlar) e.Ogeler.Add(new MenuOgesi { Kod = t.Kod, Ad = t.Ad, Komut = "SH_ELEMAN", Tur = t.Kod, Kategori = e });
            l.Add(e);
            var h = new MenuKategorisi { Kod = "HATLAR", Ad = "Hatlar", Kisa = "HT", Renk = "#1E7B4F" };
            foreach (var t in Turler.Hatlar) h.Ogeler.Add(new MenuOgesi { Kod = t.Kod, Ad = t.Ad, Komut = "SH_HAT", Tur = t.Kod, Kategori = h });
            l.Add(h);
            var k = new MenuKategorisi { Kod = "KAZI", Ad = "Kazı", Kisa = "KZ", Renk = "#8B5A2B" };
            k.Ogeler.Add(new MenuOgesi { Kod = "KANAL", Ad = "Kablo Kanalı", Kisa = "KN", Komut = "SH_KANAL", Kategori = k });
            k.Ogeler.Add(new MenuOgesi { Kod = "SONDAJ", Ad = "Yatay Sondaj", Kisa = "SN", Komut = "SH_SONDAJ", Kategori = k });
            l.Add(k);
            return l;
        }
    }
}
