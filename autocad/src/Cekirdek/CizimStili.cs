using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Bir katman anahtarının stili (ortak/katalog/cizim-stili.json › katmanlar).</summary>
    public sealed class KatmanStil
    {
        public string Anahtar = "", Telefon = "", Cizgi = "";
        public List<string> KatmanTurleri = new List<string>();
        public short Aci = 7, AciYeni = -1, AciDmm = -1;
        /// <summary>Kenar çizgileri (kanal): yoksa null.</summary>
        public KenarStil Kenar;
    }

    /// <summary>Çizginin iki yanına çizilen kenar çizgileri (kanal): renk, çizgi tipi, genişlik bilinmezse kullanılan (m).</summary>
    public sealed class KenarStil
    {
        public short Aci = 8;
        public string Cizgi = "CONTINUOUS";
        public double VarsayilanGenislik = 0.4;
    }

    /// <summary>
    /// Ortak çizim stili (ortak/katalog/cizim-stili.json): telefonun DXF çıktısıyla birebir aynı renkler, çizgi tipleri,
    /// yazı yükseklikleri ve etiket konumları. Eklenti katman adlarında AutoCAD düzenini korur, görünümü buradan alır.
    /// </summary>
    public static class CizimStili
    {
        private static Dictionary<string, KatmanStil> _katmanlar;
        private static Dictionary<string, KatmanStil> _katmanTuru;
        private static Dictionary<string, string> _elemanKatmani, _digerAileleri, _direkGerilimi, _hatKatmani;
        private static Dictionary<string, short[]> _direkRenkleri;
        private static Dictionary<string, double[]> _cizgiTipleri;
        private static short _demontajRengi = 2, _armaturRengi = 4;
        private static JsonNesne _ekran;

        public static bool Yuklu => _katmanlar != null;

        public static double BlokOlcegi = 1;
        public static double YaziYuksekligi = 1.8, ParcaMetraji = 1.44, AciYazisi = 1.26, NoktaYazisi = 1.26;
        public static double[] ParcaKaydirma = { 0, 0.8 }, HatKaydirma = { 0, -2.5 }, ElemanKaydirma = { 3.5, 3.0 }, AciKaydirma = { 3.5, 0.6 };
        public static double SatirArasi = 2.2;
        public static string ParcaBicimi = "0.00";
        /// <summary>Yazı tipi (TrueType), dosyası ve eklentinin yazı stili adı.</summary>
        public static string YaziFontu = "Tahoma", YaziFontDosyasi = "tahoma.ttf", YaziStili = "SEBEKE-M";

        public static void Yukle(string json)
        {
            var kok = Json.Oku(json) as JsonNesne;
            if (kok == null) throw new InvalidOperationException("cizim-stili.json okunamadı");
            var katmanlar = new Dictionary<string, KatmanStil>(StringComparer.Ordinal);
            var katmanTurleri = new Dictionary<string, KatmanStil>(StringComparer.Ordinal);
            var kn = kok.Nesne("katmanlar");
            if (kn == null) throw new InvalidOperationException("cizim-stili.json: 'katmanlar' yok");
            foreach (var kv in kn)
            {
                var o = kv.Value as JsonNesne;
                if (o == null) continue;
                var k = new KatmanStil
                {
                    Anahtar = kv.Key, Telefon = o.Metin("telefon"), Cizgi = o.Metin("cizgi"),
                    Aci = (short)o.Tam("aci", 7), AciYeni = (short)o.Tam("aciYeni", -1), AciDmm = (short)o.Tam("aciDmm", -1),
                };
                var pd = o.Dizi("katmanTurleri");
                if (pd != null) foreach (var p in pd) { var s = Convert.ToString(p, CultureInfo.InvariantCulture); if (!string.IsNullOrEmpty(s)) { k.KatmanTurleri.Add(s); katmanTurleri[s] = k; } }
                var ke = o.Nesne("kenar");
                if (ke != null) k.Kenar = new KenarStil { Aci = (short)ke.Tam("aci", 8), Cizgi = ke.Metin("cizgi", "CONTINUOUS"), VarsayilanGenislik = ke.Ondalik("varsayilanGenislik", 0.4) };
                katmanlar[kv.Key] = k;
            }
            var olcek = kok.Nesne("olcek");
            if (olcek != null) BlokOlcegi = olcek.Ondalik("blokOlcegi", 1);
            var yazi = kok.Nesne("yazi");
            if (yazi != null)
            {
                YaziYuksekligi = yazi.Ondalik("yukseklik", 1.8);
                ParcaMetraji = yazi.Ondalik("parcaMetraji", YaziYuksekligi * 0.8);
                AciYazisi = yazi.Ondalik("aciYazisi", YaziYuksekligi * 0.7);
                NoktaYazisi = yazi.Ondalik("noktaYazisi", YaziYuksekligi * 0.7);
                YaziFontu = yazi.Metin("font", YaziFontu);
                YaziFontDosyasi = yazi.Metin("fontDosyasi", YaziFontDosyasi);
                YaziStili = yazi.Metin("stil", YaziStili);
            }
            var et = kok.Nesne("etiketler");
            if (et != null)
            {
                ParcaKaydirma = Cift(et.Nesne("parcaMetraji"), ParcaKaydirma);
                HatKaydirma = Cift(et.Nesne("hat"), HatKaydirma);
                ElemanKaydirma = Cift(et.Nesne("eleman"), ElemanKaydirma);
                AciKaydirma = Cift(et.Nesne("aci"), AciKaydirma);
                var el = et.Nesne("eleman");
                if (el != null) SatirArasi = el.Ondalik("satirArasi", SatirArasi);
                var pm = et.Nesne("parcaMetraji");
                if (pm != null) ParcaBicimi = pm.Metin("bicim", ParcaBicimi);
            }
            var ct = new Dictionary<string, double[]>(StringComparer.OrdinalIgnoreCase);
            var ctn = kok.Nesne("cizgiTipleri");
            if (ctn != null)
                foreach (var kv in ctn)
                {
                    var d = kv.Value as List<object>;
                    if (d == null) continue;
                    var l = new List<double>();
                    foreach (var x in d) l.Add(Sayi(x));
                    ct[kv.Key] = l.ToArray();
                }
            var dr = new Dictionary<string, short[]>(StringComparer.Ordinal);
            var drn = kok.Nesne("direkRenkleri");
            if (drn != null)
            {
                foreach (var kv in drn)
                {
                    var d = kv.Value as List<object>;
                    if (d == null || d.Count < 3) continue;
                    dr[kv.Key] = new[] { (short)Sayi(d[0]), (short)Sayi(d[1]), (short)Sayi(d[2]) };
                }
                _demontajRengi = (short)drn.Tam("demontaj", 2);
            }
            var nr = kok.Nesne("nesneRenkleri");
            _elemanKatmani = Sozluk(nr != null ? nr.Nesne("elemanKatmani") : null);
            _digerAileleri = Sozluk(nr != null ? nr.Nesne("digerAileleri") : null);
            _direkGerilimi = Sozluk(nr != null ? nr.Nesne("direkGerilimi") : null);
            _hatKatmani = Sozluk(nr != null ? nr.Nesne("hatKatmani") : null);
            if (nr != null) _armaturRengi = (short)nr.Tam("armatur", 4);
            _ekran = kok.Nesne("ekran");
            _cizgiTipleri = ct;
            _direkRenkleri = dr;
            _katmanTuru = katmanTurleri;
            _katmanlar = katmanlar;
        }

        private static double Sayi(object o) => o is double ? (double)o : SayiCoz.Coz(Convert.ToString(o, CultureInfo.InvariantCulture), 0);

        private static double[] Cift(JsonNesne o, double[] varsayilan)
        {
            var d = o != null ? o.Dizi("kaydirma") : null;
            if (d == null || d.Count < 2) return varsayilan;
            return new[] { Sayi(d[0]), Sayi(d[1]) };
        }

        private static Dictionary<string, string> Sozluk(JsonNesne o)
        {
            var s = new Dictionary<string, string>(StringComparer.Ordinal);
            if (o == null) return s;
            foreach (var kv in o) if (kv.Key != "aciklama" && kv.Value is string) s[kv.Key] = (string)kv.Value;
            return s;
        }

        private static void Denetle()
        {
            if (_katmanlar == null) throw new InvalidOperationException("Çizim stili yüklenmedi (CizimStili.Yukle)");
        }

        // ---------------- Katmanlar ----------------

        public static KatmanStil Katman(string anahtar)
        {
            Denetle();
            KatmanStil k;
            return _katmanlar.TryGetValue(anahtar ?? "", out k) ? k : null;
        }

        public static IEnumerable<KatmanStil> Katmanlar()
        {
            Denetle();
            return _katmanlar.Values;
        }

        /// <summary>Çizgi tipi deseni (metre; eksi = boşluk); bilinmiyorsa null.</summary>
        public static double[] CizgiDeseni(string ad)
        {
            Denetle();
            double[] d;
            return !string.IsNullOrEmpty(ad) && _cizgiTipleri.TryGetValue(ad, out d) ? d : null;
        }

        /// <summary>AutoCAD katman adından stil: "SC_2.HAK.AG_YER_HAT" → KABLO, "SC_DEMONTAJ" → DEMONTAJ, "GPS" → OLCU.</summary>
        public static KatmanStil KatmanTuruStili(string katman)
        {
            Denetle();
            katman = katman ?? "";
            int i = katman.IndexOf(".HAK.", StringComparison.Ordinal);
            string tur = i >= 0 ? katman.Substring(i + 5) : "";
            KatmanStil k;
            if (tur.Length > 0 && _katmanTuru.TryGetValue(tur, out k)) return k;
            foreach (var kv in _katmanTuru)
                if (katman == kv.Key || katman.EndsWith("_" + kv.Key, StringComparison.Ordinal)) return kv.Value;
            return null;
        }

        /// <summary>Yeni katmanın rengi ve çizgi tipi (NesneYazici.KatmanStili bunu kullanır).</summary>
        public static bool KatmanStili(string katman, out short renk, out string cizgiTipi)
        {
            renk = 7; cizgiTipi = "";
            var k = Yuklu ? KatmanTuruStili(katman) : null;
            if (k == null) return false;
            renk = k.Aci;
            cizgiTipi = k.Cizgi == "CONTINUOUS" ? "" : (k.Cizgi ?? "");
            return true;
        }

        // ---------------- Nesne renkleri (telefonun DXF'iyle aynı) ----------------

        /// <summary>Durum sırası: 0 mevcut, 1 yeni, 2 sök-tak; demontaj -1.</summary>
        private static int DurumSirasi(string durum)
        {
            switch (Semboller.Varyant(durum))
            {
                case "YENI": return 1;
                case "DMM": return 2;
                case "DM":
                case "KESIK":
                case "SOKUK": return -1;
                default: return 0;
            }
        }

        /// <summary>Elemana yazılacak renk: direklerde gerilim + durum, diğerlerinde kendi katman anahtarının rengi; demontaj 2.</summary>
        public static short ElemanRengi(string tur, string cins, string durum)
        {
            Denetle();
            int d = DurumSirasi(durum);
            if (d < 0) return _demontajRengi;
            string gerilim;
            short[] renkler;
            if (_direkGerilimi.TryGetValue(tur ?? "", out gerilim) && _direkRenkleri.TryGetValue(gerilim, out renkler)) return renkler[d];
            string aile = Semboller.Aile(tur, cins);
            if (aile == "ARMATUR") return _armaturRengi;
            string anahtar;
            if (tur == "DIGER" && _digerAileleri.TryGetValue(aile, out anahtar)) { }
            else if (!_elemanKatmani.TryGetValue(tur ?? "", out anahtar)) anahtar = "YAZI";
            var k = Katman(anahtar);
            return k != null ? k.Aci : (short)7;
        }

        /// <summary>Hat türünün stil anahtarı (HAT_AG, KABLO…).</summary>
        public static KatmanStil HatStili(string tur)
        {
            Denetle();
            string anahtar;
            return Katman(_hatKatmani.TryGetValue(tur ?? "", out anahtar) ? anahtar : "HAT_AG");
        }

        /// <summary>Hatta yazılacak renk: türün rengi; demontaj 2.</summary>
        public static short HatRengi(string tur, string durum)
        {
            if (DurumSirasi(durum) < 0) return _demontajRengi;
            var k = HatStili(tur);
            return k != null ? k.Aci : (short)7;
        }

        /// <summary>Hatta yazılacak çizgi tipi ("" = sürekli).</summary>
        public static string HatCizgiTipi(string tur)
        {
            var k = HatStili(tur);
            return k == null || k.Cizgi == "CONTINUOUS" ? "" : (k.Cizgi ?? "");
        }

        public static short DemontajRengi => _demontajRengi;

        /// <summary>Kanalın kenar çizgileri (stil yüklü değilse ya da tanımsızsa varsayılan).</summary>
        public static KenarStil KanalKenari
        {
            get
            {
                var k = Yuklu ? Katman("KANAL") : null;
                return k != null && k.Kenar != null ? k.Kenar : new KenarStil();
            }
        }

        // ---------------- Ekran renkleri (telefonun koyu ekranı; şerit simgeleri) ----------------

        public static string EkranZemini => _ekran != null ? _ekran.Metin("zemin", "#0b1326") : "#0b1326";

        public static string EkranRengi(string anahtar, string varsayilan = "#cbd5e1") => _ekran != null ? _ekran.Metin(anahtar, varsayilan) : varsayilan;

        /// <summary>Elemanın telefondaki ekran rengi (yeni durum): direkler gerilime göre, trafo / box / pano mavi, armatür sarı.</summary>
        public static string EkranElemanRengi(string tur, string cins, bool mevcut = false)
        {
            Denetle();
            string gerilim;
            if (_direkGerilimi.TryGetValue(tur ?? "", out gerilim))
            {
                var d = _ekran != null ? _ekran.Nesne(mevcut ? "direkMevcut" : "direk") : null;
                return d != null ? d.Metin(gerilim, "#dae2fd") : "#dae2fd";
            }
            string aile = Semboller.Aile(tur, cins);
            if (aile == "ARMATUR") return EkranRengi("armatur", "#fde047");
            if (aile.StartsWith("TRAFO", StringComparison.Ordinal) || aile == "SDK" || aile == "PANO" || aile == "MENHOL") return EkranRengi("trafo", "#6b82ff");
            if (aile == "DIREK_AYD") return EkranRengi("armatur", "#fde047");
            return EkranRengi("diger");
        }

        /// <summary>Hattın telefondaki ekran rengi.</summary>
        public static string EkranHatRengi(string tur)
        {
            Denetle();
            string anahtar;
            if (!_hatKatmani.TryGetValue(tur ?? "", out anahtar)) anahtar = "HAT_AG";
            var h = _ekran != null ? _ekran.Nesne("hat") : null;
            return h != null ? h.Metin(anahtar, "#7ee08a") : "#7ee08a";
        }
    }
}
