using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Şeritteki hızlı çizimin seçimi: kategori, etkin öğe (ör. AG Havai › AG Direk), öğe başına tip, durum, demontaj
    /// türü ve hakediş. Şerit yazar, SH_HIZLI komutu okur. Son seçimler kullanıcının ayar klasöründe saklanır
    /// (AutoCAD yeniden açılınca aynı kategori ve tipler gelir).
    /// </summary>
    internal static class HizliSecim
    {
        public static MenuKategorisi Kategori;
        public static MenuOgesi Oge;
        public static string Durum = "M";
        public static string DmDurum = "";
        /// <summary>0: çizimin aktif hakedişi.</summary>
        public static int Hakedis;
        /// <summary>Kanal öğelerinde kanaldaki kablolar (OG, AG, AYD, REK); boşsa öğenin kendi kablosu.</summary>
        public static string KanalKablolari = "";

        /// <summary>Öğe kodu → seçili tipin anahtarı (cins|tanım).</summary>
        private static readonly Dictionary<string, string> _tip = new Dictionary<string, string>(StringComparer.Ordinal);
        /// <summary>Öğe kodu → son kullanılan tipler (en yeni önde).</summary>
        private static readonly Dictionary<string, List<string>> _son = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        private const int SonSayisi = 8;
        private static Katalog _katalog;
        private static bool _yuklendi;

        /// <summary>Seçim değişince (şeritteki kutuları yenilemek için).</summary>
        public static event Action Degisti;

        /// <summary>Gömülü katalog (çizimden bağımsız; şeritteki kısa tip listesi için).</summary>
        public static Katalog TemelKatalog => _katalog ?? (_katalog = Katalog.Oku(KatalogKaynagi.Json(), null));

        // ---------------- Tipler ----------------

        /// <summary>
        /// Öğenin tipleri (verilen katalogdan, öğenin tür ve cins süzgeciyle). genis: hatlarda türün cinslerinden sonra diğer
        /// iletken ve kablolar da (arama penceresi için); değilse yalnız türün cinsleri (şeritteki kısa liste).
        /// </summary>
        public static List<KatalogKalemi> Tipler(MenuOgesi oge, Katalog k, bool genis = false)
        {
            if (oge == null || k == null) return new List<KatalogKalemi>();
            IList<string> cinsler = oge.Cinsler.Count > 0 ? oge.Cinsler : null;
            switch (oge.Komut)
            {
                case "SH_ELEMAN": return k.AnaTipler(oge.Tur, cinsler ?? (genis ? null : k.ElemanCinsListesi(oge.Tur)));
                case "SH_HAT": return k.HatKesitleri(oge.Tur, cinsler ?? (genis ? null : k.HatCinsListesi(oge.Tur)));
                case "SH_SONDAJ": return k.SondajTipleri();
                case "SH_KANAL": return k.KanalZeminleri();
                default: return new List<KatalogKalemi>();
            }
        }

        /// <summary>Şeritteki kısa liste: son kullanılanlar, çok kullanılanlar, sonra katalog sırasıyla (en çok 16).</summary>
        public static List<KatalogKalemi> KisaListe(MenuOgesi oge)
        {
            var k = TemelKatalog;
            var hepsi = Tipler(oge, k);
            var l = new List<KatalogKalemi>();
            var secili = SeciliTip(oge, k);
            if (secili != null) l.Add(secili);
            List<string> son;
            if (oge != null && _son.TryGetValue(oge.Kod, out son))
                foreach (var a in son)
                {
                    var it = Bul(k, a);
                    if (it != null && !l.Contains(it)) l.Add(it);
                }
            // Gerçek çizimlerde çok kullanılanlar (öğenin kendi cinslerinden)
            var cok = hepsi.FindAll(x => x.Kullanim > 0);
            cok.Sort((a, b) => b.Kullanim.CompareTo(a.Kullanim));
            foreach (var it in cok) { if (l.Count >= 12) break; if (!l.Contains(it)) l.Add(it); }
            foreach (var it in hepsi) { if (l.Count >= 16) break; if (!l.Contains(it)) l.Add(it); }
            return l;
        }

        private static KatalogKalemi Bul(Katalog k, string anahtar)
        {
            if (string.IsNullOrEmpty(anahtar)) return null;
            int i = anahtar.IndexOf('|');
            return i < 0 ? null : k.Bul(anahtar.Substring(0, i), anahtar.Substring(i + 1));
        }

        /// <summary>Öğenin seçili tipi (verilen katalogda); seçilmemişse öğenin ilk tipi (çok kullanılan önce).</summary>
        public static KatalogKalemi SeciliTip(MenuOgesi oge, Katalog k)
        {
            if (oge == null || k == null) return null;
            Yukle();
            string a;
            if (_tip.TryGetValue(oge.Kod, out a))
            {
                var it = Bul(k, a);
                if (it != null) return it;
            }
            var hepsi = Tipler(oge, k);
            if (hepsi.Count == 0) return null;
            KatalogKalemi en = null;
            foreach (var x in hepsi) if (x.Kullanim > 0 && (en == null || x.Kullanim > en.Kullanim)) en = x;
            return en ?? hepsi[0];
        }

        public static void TipSec(MenuOgesi oge, KatalogKalemi it)
        {
            if (oge == null || it == null) return;
            Yukle();
            _tip[oge.Kod] = it.Anahtar;
            List<string> son;
            if (!_son.TryGetValue(oge.Kod, out son)) { son = new List<string>(); _son[oge.Kod] = son; }
            son.Remove(it.Anahtar);
            son.Insert(0, it.Anahtar);
            while (son.Count > SonSayisi) son.RemoveAt(son.Count - 1);
            Kaydet();
            Degisti?.Invoke();
        }

        public static void OgeSec(MenuKategorisi k, MenuOgesi oge)
        {
            Kategori = k ?? (oge != null ? oge.Kategori : Kategori);
            Oge = oge;
            Kaydet();
            Degisti?.Invoke();
        }

        public static void DurumSec(string durum, string dm)
        {
            Durum = string.IsNullOrEmpty(durum) ? "M" : durum;
            DmDurum = Turler.DemontajMi(Durum) ? (dm ?? "") : "";
            Kaydet();
            Degisti?.Invoke();
        }

        public static void HakedisSec(int hakedis)
        {
            Hakedis = Math.Max(0, hakedis);
            Kaydet();
            Degisti?.Invoke();
        }

        /// <summary>Komutta kullanılacak hakediş: şeritte seçilmişse o, değilse çizimin aktif hakedişi.</summary>
        public static int Hakedis_(OrtamVerisi o) => Hakedis > 0 ? Hakedis : o.Hakedis;

        // ---------------- Saklama (%APPDATA%\SebekeHakedis\serit.json) ----------------

        private static string Dosya
        {
            get
            {
                string k = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SebekeHakedis");
                return Path.Combine(k, "serit.json");
            }
        }

        /// <summary>Son seçimleri bir kez okur (şerit kurulurken).</summary>
        public static void Yukle()
        {
            if (_yuklendi) return;
            _yuklendi = true;
            try
            {
                KatalogKaynagi.KategorileriYukle();
                if (!File.Exists(Dosya)) { Varsayilan(); return; }
                var kok = Cekirdek.Json.Oku(File.ReadAllText(Dosya, Encoding.UTF8)) as JsonNesne;
                if (kok == null) { Varsayilan(); return; }
                Kategori = Kategoriler.Bul(kok.Metin("kategori"));
                if (Kategori != null) Oge = Kategori.Ogeler.Find(x => x.Kod == kok.Metin("oge"));
                Durum = kok.Metin("durum", "M");
                if (Array.IndexOf(Turler.CizimDurumlari, Durum) < 0) Durum = "M";
                DmDurum = kok.Metin("dm");
                Hakedis = kok.Tam("hakedis");
                KanalKablolari = kok.Metin("kanalKablolari");
                var tip = kok.Nesne("tip");
                if (tip != null) foreach (var kv in tip) if (kv.Value is string) _tip[kv.Key] = (string)kv.Value;
                var son = kok.Nesne("son");
                if (son != null)
                    foreach (var kv in son)
                    {
                        var d = kv.Value as List<object>;
                        if (d == null) continue;
                        var l = new List<string>();
                        foreach (var x in d) l.Add(Convert.ToString(x, CultureInfo.InvariantCulture));
                        _son[kv.Key] = l;
                    }
            }
            catch { }
            if (Kategori == null) Varsayilan();
        }

        private static void Varsayilan()
        {
            var l = Kategoriler.Hepsi();
            Kategori = l.Count > 0 ? l[0] : null;
            Oge = Kategori != null && Kategori.Ogeler.Count > 0 ? Kategori.Ogeler[0] : null;
        }

        private static void Kaydet()
        {
            try
            {
                var kok = new JsonNesne();
                kok["bicim"] = "sebeke-hakedis.serit";
                kok["kategori"] = Kategori != null ? Kategori.Kod : "";
                kok["oge"] = Oge != null ? Oge.Kod : "";
                kok["durum"] = Durum ?? "M";
                kok["dm"] = DmDurum ?? "";
                kok["hakedis"] = (double)Hakedis;
                kok["kanalKablolari"] = KanalKablolari ?? "";
                var tip = new JsonNesne();
                foreach (var kv in _tip) tip[kv.Key] = kv.Value;
                kok["tip"] = tip;
                var son = new JsonNesne();
                foreach (var kv in _son) son[kv.Key] = new List<object>(kv.Value);
                kok["son"] = son;
                Directory.CreateDirectory(Path.GetDirectoryName(Dosya));
                File.WriteAllText(Dosya, Cekirdek.Json.Yaz(kok, true), new UTF8Encoding(false));
            }
            catch { }
        }
    }
}
