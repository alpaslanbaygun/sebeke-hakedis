using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>
    /// Birleşik Metraj şablonunun tanımı: DİREK / İLETKEN / YERALTI METRAJI sayfalarının KOD sütunları, sabit sütunları,
    /// MALZ. LİSTESİ'nin formül sütunları ve EK satırları, KATSAYILAR seçim listeleri. Telefondaki karşılığı
    /// telefon/web/src/export/birlesik-metraj.js › sablonTanimi (aynı yapı; ortak/BIRLESIK-METRAJ.md).
    /// </summary>
    public sealed class MetrajSablonu
    {
        public sealed class Sutun
        {
            public int SutunNo; public string Kod = "", Blok = "", Tip, Poz = "", Ad = "", Temin = "", Birim = "", Grup; public bool Formullu;
            /// <summary>Planın açtığı sütun (şablonda yoktu): eşleşen sayılmaz, formüllü sütun sıfırlaması yapılmaz.</summary>
            public bool Yeni;
        }

        public sealed class Sayfa
        {
            public string Ad, Onek;
            public int KodSatiri, PozSatiri, AdSatiri, TeminSatiri, BirimSatiri, ToplamSatiri, IlkKodSutunu, IlkVeri, SonVeri, SonSutun;
            public int? TipSatiri, DurumSatiri, MalzSatiri, GrupSatiri;
            public List<int> BayrakSatirlari = new List<int>(), AltSatirlar = new List<int>();
            public List<Sutun> Sutunlar = new List<Sutun>();
            /// <summary>Tanımlı adların aralıkları sayfasız ("KOD" → "$G$10:$ZZ$10"): kopya sayfanın MALZ. LİSTESİ formülleri kopya sayfasıyla kullanır.</summary>
            public Dictionary<string, string> Adlar = new Dictionary<string, string>(StringComparer.Ordinal);
            /// <summary>Sabit sütunlar (harf): direk: no, yeni, demontaj, dmm, mevcut · iletken: direkler, aramesafe, tertip, durum · yeraltı: no, …</summary>
            public Dictionary<string, string> Sabit = new Dictionary<string, string>(StringComparer.Ordinal);
            /// <summary>İLETKEN: AG iletken (adet, kod) sütun çiftleri; OG ve AER çiftleri.</summary>
            public List<string[]> Ag = new List<string[]>(); public string[] Og, Aer;
            /// <summary>DİREK: İLİ … PROJE_TÜRÜ başlık değer hücreleri.</summary>
            public Dictionary<string, string> Baslik = new Dictionary<string, string>(StringComparer.Ordinal);

            public string S(string ad) { string v; return Sabit.TryGetValue(ad, out v) ? v : null; }
        }

        public sealed class Malz
        {
            public string Sayfa, KodSutunu, KaynakSutunu, PozSutunu, AdSutunu, BirimSutunu, TeminSutunu, MiktarSutunu, ToplamSutunu, BayrakSutunu;
            /// <summary>Örnek satırlar (biçim kopyalamak için): kalem satırı (ilk KOD'lu), grup başlığı (KOD'suz, adı yazılı, sonraki satır KOD'lu); EK KALEMLER bölüm başlığı.</summary>
            public int KalemOrnekSatiri; public int? GrupOrnekSatiri, EkBaslikSatiri;
            public List<EkSatiri> EkSatirlari = new List<EkSatiri>();
        }

        public sealed class EkSatiri { public int Satir; public string Kod; }
        public sealed class Liste { public string Sayfa, Sutun; public int Ilk, Son; public List<string> Degerler = new List<string>(); }

        public Sayfa Direk, Iletken, Yeralti;
        public Malz MalzListesi;
        public Dictionary<string, Liste> Listeler = new Dictionary<string, Liste>(StringComparer.Ordinal);
        public List<string> KullanilanKodlar = new List<string>();

        public Sayfa Al(string hangi) => hangi == "direk" ? Direk : hangi == "iletken" ? Iletken : hangi == "yeralti" ? Yeralti : null;

        private static readonly Dictionary<string, string> _listeAdlari = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { "LST_YENI_DIREK", "yeniDirek" }, { "LST_DEMONTAJ", "demontaj" }, { "LST_DMONTAJ", "dmontaj" }, { "LST_IM_ILETKEN", "imIletken" },
            { "LST_IM_AER", "imAer" }, { "LST_AYD_DIREK", "aydDirek" }, { "LST_BOX", "box" }
        };

        public static MetrajSablonu Oku(XlsmDosyasi x)
        {
            var t = new MetrajSablonu { Direk = SayfaOku(x, "DM"), Iletken = SayfaOku(x, "IM"), Yeralti = SayfaOku(x, "YM") };
            if (t.Direk == null && t.Iletken == null && t.Yeralti == null) throw new InvalidOperationException("Bu dosya Birleşik Metraj şablonu değil (DM_KOD_SATIRI gibi tanımlı adlar yok).");
            foreach (var hangi in new[] { "direk", "iletken", "yeralti" })
            {
                var o = t.Al(hangi);
                if (o == null) continue;
                Sabitler(x.Sayfa(o.Ad), o, hangi);
                foreach (var k in o.Sutunlar) t.KullanilanKodlar.Add(k.Kod);
            }
            t.MalzListesi = MalzOku(x);
            t.Listeler = ListelerOku(x, t);
            return t;
        }

        private static string Metin(XlsmSayfa s, int sutun, int satir) => (s.Metin(XlsmDosyasi.HucreAdi(sutun, satir)) ?? "").Trim();

        private static Sayfa SayfaOku(XlsmDosyasi x, string onek)
        {
            var kod = x.TanimliAd(onek + "_KOD_SATIRI");
            if (kod == null) return null;
            var s = x.Sayfa(kod.Sayfa);
            Func<string, int?> satir = ek => { var a = x.TanimliAd(onek + "_" + ek); return a != null ? a.BasSatir : (int?)null; };
            Func<string, string> aralik = ek =>
            {
                var a = x.TanimliAd(onek + "_" + ek);
                return a != null ? "$" + XlsmDosyasi.SutunHarfi(a.BasSutun) + "$" + a.BasSatir + ":$" + XlsmDosyasi.SutunHarfi(a.BitSutun) + "$" + a.BitSatir : null;
            };
            var o = new Sayfa
            {
                Ad = kod.Sayfa, Onek = onek, KodSatiri = kod.BasSatir, TipSatiri = satir("TIP_SATIRI"), DurumSatiri = satir("DURUM_SATIRI"),
                PozSatiri = satir("POZ_SATIRI") ?? 0, AdSatiri = satir("AD_SATIRI") ?? 0, TeminSatiri = satir("SEC_SATIRI") ?? 0, BirimSatiri = satir("BIRIM_SATIRI") ?? 0,
                ToplamSatiri = satir("TOPLAM_SATIRI") ?? 0, MalzSatiri = satir("MALZ_SATIRI"), IlkKodSutunu = kod.BasSutun
            };
            if (o.PozSatiri == 0 || o.AdSatiri == 0 || o.TeminSatiri == 0 || o.BirimSatiri == 0) throw new InvalidOperationException(kod.Sayfa + ": şablonun " + onek + "_ tanımlı adları eksik.");
            foreach (var ek in new[] { "KOD", "TIP", "DURUM", "POZ", "AD", "SEC", "BIRIM", "TOPLAM", "MALZ" }) { var ar = aralik(ek + "_SATIRI"); if (ar != null) o.Adlar[ek] = ar; }
            o.IlkVeri = o.BirimSatiri + 1;
            int sinirSatir, sinirSutun; s.Sinirlar(out sinirSatir, out sinirSutun);
            if (o.ToplamSatiri == 0)
            {
                int son = o.MalzSatiri ?? sinirSatir;
                for (int r = o.IlkVeri + 1; r <= son; r++) if (Regex.IsMatch(Metin(s, 1, r), "^TOPLAM", RegexOptions.IgnoreCase)) { o.ToplamSatiri = r; break; }
                if (o.ToplamSatiri == 0) throw new InvalidOperationException(kod.Sayfa + ": TOPLAM satırı bulunamadı.");
                if (!o.Adlar.ContainsKey("TOPLAM")) o.Adlar["TOPLAM"] = "$" + XlsmDosyasi.SutunHarfi(kod.BasSutun) + "$" + o.ToplamSatiri + ":$" + XlsmDosyasi.SutunHarfi(kod.BitSutun) + "$" + o.ToplamSatiri;
            }
            o.SonVeri = o.ToplamSatiri - 1;
            int ilkKodlu = 0; string oncekiBlok = "Y";
            for (int c = kod.BasSutun; c <= Math.Min(sinirSutun, kod.BitSutun); c++)
            {
                var kodMetni = Metin(s, c, o.KodSatiri);
                if (kodMetni.Length == 0) continue;
                if (ilkKodlu == 0) ilkKodlu = c;
                string blok = Regex.IsMatch(kodMetni, "^Y", RegexOptions.IgnoreCase) ? "Y" : Regex.IsMatch(kodMetni, "^DM", RegexOptions.IgnoreCase) ? "DM"
                    : Regex.IsMatch(kodMetni, "^D", RegexOptions.IgnoreCase) ? "D" : Regex.IsMatch(kodMetni, "^A", RegexOptions.IgnoreCase) ? "A" : null;
                if (blok == null)
                {
                    var d = o.DurumSatiri.HasValue ? BirlesikMetraj.Norm(Metin(s, c, o.DurumSatiri.Value)) : "";
                    blok = d == "YENI" ? "Y" : d == "DM" ? "D" : d == "AKTARIM" ? "A" : oncekiBlok;
                }
                oncekiBlok = blok;
                var veri = s.Oku(XlsmDosyasi.HucreAdi(c, o.IlkVeri));
                var tip = o.TipSatiri.HasValue ? Metin(s, c, o.TipSatiri.Value) : "";
                o.Sutunlar.Add(new Sutun
                {
                    SutunNo = c, Kod = kodMetni, Blok = blok, Tip = tip.Length > 0 ? tip : null, Poz = Metin(s, c, o.PozSatiri), Ad = Metin(s, c, o.AdSatiri),
                    Temin = Metin(s, c, o.TeminSatiri), Birim = Metin(s, c, o.BirimSatiri), Formullu = veri != null && veri.Formul != null
                });
                o.SonSutun = c;
            }
            int ust = Math.Max(o.KodSatiri, Math.Max(o.TipSatiri ?? 0, o.DurumSatiri ?? 0));
            for (int r = ust + 1; r < o.PozSatiri; r++)
            {
                var h = ilkKodlu > 0 ? s.Oku(XlsmDosyasi.HucreAdi(ilkKodlu, r)) : null;
                if (h != null && h.Formul != null) o.BayrakSatirlari.Add(r); else if (!o.GrupSatiri.HasValue) o.GrupSatiri = r;
            }
            if (o.GrupSatiri.HasValue) foreach (var k in o.Sutunlar) { var g = Metin(s, k.SutunNo, o.GrupSatiri.Value); k.Grup = g.Length > 0 ? g : null; }
            for (int r = o.ToplamSatiri; r <= o.ToplamSatiri + 8; r++)
            {
                var h = ilkKodlu > 0 ? s.Oku(XlsmDosyasi.HucreAdi(ilkKodlu, r)) : null;
                if (h != null && h.Formul != null) o.AltSatirlar.Add(r); else if (r > o.ToplamSatiri) break;
            }
            return o;
        }

        private sealed class Baslik { public string Sutun; public int SutunNo, Satir; public string Metin; }

        private static Baslik BaslikBul(XlsmSayfa s, int sonSatir, int sonSutun, Regex re, int basla, HashSet<int> haric)
        {
            for (int r = basla; r <= sonSatir; r++)
                for (int c = 1; c <= sonSutun; c++)
                {
                    if (haric != null && haric.Contains(c)) continue;
                    var t = Metin(s, c, r);
                    if (t.Length > 0 && re.IsMatch(t)) return new Baslik { Sutun = XlsmDosyasi.SutunHarfi(c), SutunNo = c, Satir = r, Metin = t };
                }
            return null;
        }

        private static readonly RegexOptions _ic = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

        private static void Sabitler(XlsmSayfa s, Sayfa o, string hangi)
        {
            var kodSutunlari = new HashSet<int>();
            foreach (var k in o.Sutunlar) kodSutunlari.Add(k.SutunNo);
            Func<string, string> ara = desen => { var b = BaslikBul(s, o.IlkVeri - 1, o.SonSutun, new Regex(desen, _ic), Math.Max(1, o.KodSatiri - 1), kodSutunlari); return b != null ? b.Sutun : null; };
            if (hangi == "direk")
            {
                o.Sabit["no"] = ara("^Direk No") ?? "A"; o.Sabit["yeni"] = ara("^Yeni Direk") ?? "C"; o.Sabit["demontaj"] = ara("^Demontaj$") ?? "D";
                o.Sabit["dmm"] = ara("^Demontajdan Montaj") ?? "E"; o.Sabit["mevcut"] = ara("^Mevcut$") ?? "F";
                var etiketler = new[] { new[] { "il", "^İLİ$" }, new[] { "ilce", "^İLÇESİ$" }, new[] { "grupNo", "^GRUP_NO$" }, new[] { "isinAdi", "^İŞİN_ADI$" }, new[] { "projeNo", "^PROJE_NO$" }, new[] { "yuklenici", "^YÜKLENİCİ_FİRMA$" }, new[] { "hakedisNo", "^HAK_EDİŞ_NO$" }, new[] { "projeTuru", "^PROJE_TÜRÜ$" } };
                var bulunan = new List<KeyValuePair<string, Baslik>>(); var sayac = new Dictionary<int, int>();
                foreach (var e in etiketler)
                {
                    var b = BaslikBul(s, o.IlkVeri - 1, 2, new Regex(e[1], _ic), 1, null);
                    if (b == null) continue;
                    int deger = 0;
                    for (int c = b.SutunNo + 1; c <= b.SutunNo + 3; c++) if (Metin(s, c, b.Satir).Length > 0) { deger = c; break; }
                    if (deger > 0) { int n; sayac.TryGetValue(deger, out n); sayac[deger] = n + 1; }
                    bulunan.Add(new KeyValuePair<string, Baslik>(e[0], b));
                }
                int degerSutunu = 0, enCok = 0;
                foreach (var kv in sayac) if (kv.Value > enCok || (kv.Value == enCok && kv.Key < degerSutunu)) { enCok = kv.Value; degerSutunu = kv.Key; }
                foreach (var kv in bulunan) o.Baslik[kv.Key] = XlsmDosyasi.HucreAdi(degerSutunu > 0 ? degerSutunu : kv.Value.SutunNo + 2, kv.Value.Satir);
            }
            else if (hangi == "iletken")
            {
                Func<string, string[]> cift = desen => { var b = BaslikBul(s, o.IlkVeri - 1, o.SonSutun, new Regex(desen, _ic), 1, kodSutunlari); return b != null ? new[] { b.Sutun, XlsmDosyasi.SutunHarfi(b.SutunNo + 1) } : null; };
                for (int i = 1; i <= 4; i++) { var c = cift("^AG İLETKEN " + i + "$"); if (c != null) o.Ag.Add(c); }
                if (o.Ag.Count == 0) { o.Ag.Add(new[] { "G", "H" }); o.Ag.Add(new[] { "I", "J" }); o.Ag.Add(new[] { "K", "L" }); }
                o.Og = cift("^OG İLETKEN$") ?? new[] { "M", "N" }; o.Aer = cift("ALPEK|AER") ?? new[] { "O", "P" };
                o.Sabit["direkler"] = ara("Direkler Arası") ?? "A"; o.Sabit["aramesafe"] = ara("^Aramesafe") ?? "E"; o.Sabit["tertip"] = ara("^Hat Tertibi") ?? "F";
                o.Sabit["durum"] = ara("^YENİ / DM") ?? ara("^DURUM$") ?? "Q";
            }
            else
            {
                o.Sabit["no"] = ara(@"^Direk\s*/\s*Box No") ?? "A"; o.Sabit["karakteristik"] = ara("^Yatırım Karakteristiği"); o.Sabit["unsur"] = ara("^Yatırım Unsurları");
                o.Sabit["direkCinsi"] = ara("^Direk Cinsi$"); o.Sabit["aydDirek"] = ara("^Aydınlatma Direk Cinsi"); o.Sabit["betonDirek"] = ara("^Beton Direk Cinsi"); o.Sabit["box"] = ara("^Box Cinsi");
                o.Sabit["aramesafe"] = ara("^Aramesafe") ?? "I"; o.Sabit["tertip"] = ara("^Hat Tertibi"); o.Sabit["taban"] = ara("^TABAN$"); o.Sabit["tavan"] = ara("^TAVAN$"); o.Sabit["derinlik"] = ara("^DERİNLİK$");
                o.Sabit["dolgu"] = ara("^KANAL DOLGU CİNSİ"); o.Sabit["toplamM3"] = ara("^TOPRAK KANAL TOPLAMI"); o.Sabit["duvar"] = ara("^DUVAR MONTAJ"); o.Sabit["aciklama"] = ara("^AÇIKLAMA$"); o.Sabit["kaplama"] = ara("^Kaplama Cinsi");
            }
        }

        private static Malz MalzOku(XlsmDosyasi x)
        {
            foreach (var sb in x.Sayfalar)
            {
                var s = x.Sayfa(sb.Ad);
                int kaynakSatir = 0; string kaynakSutunu = null, kodSutunu = null;
                foreach (var rk in s.Satirlar)
                {
                    foreach (var ck in rk.Value.Hucreler)
                    {
                        var f = s.Formul(XlsmDosyasi.HucreAdi(ck.Key, rk.Key));
                        if (f == null) continue;
                        var m = Regex.Match(f, @"MATCH\(\$([A-Z]+)\d+,(?:DM|IM|YM)_KOD_SATIRI,0\)");
                        if (m.Success) { kaynakSatir = rk.Key; kaynakSutunu = XlsmDosyasi.SutunHarfi(ck.Key); kodSutunu = m.Groups[1].Value; break; }
                    }
                    if (kaynakSatir > 0) break;
                }
                if (kaynakSatir == 0) continue;
                var o = new Malz { Sayfa = sb.Ad, KodSutunu = kodSutunu, KaynakSutunu = kaynakSutunu };
                foreach (var ck in s.Satirlar[kaynakSatir].Hucreler)
                {
                    var f = s.Formul(XlsmDosyasi.HucreAdi(ck.Key, kaynakSatir)) ?? "";
                    var h = XlsmDosyasi.SutunHarfi(ck.Key);
                    if (f.Contains("_POZ_SATIRI")) o.PozSutunu = h;
                    else if (f.Contains("_AD_SATIRI")) o.AdSutunu = h;
                    else if (f.Contains("_BIRIM_SATIRI")) o.BirimSutunu = h;
                    else if (f.Contains("_SEC_SATIRI") && !f.Contains("TRIM")) o.TeminSutunu = h;
                    else if (Regex.IsMatch(f, @"N\(INDEX\((?:DM|IM|YM)_(?:TOPLAM|MALZ)_SATIRI")) o.MiktarSutunu = h;
                }
                if (o.PozSutunu == null || o.AdSutunu == null || o.BirimSutunu == null || o.TeminSutunu == null || o.MiktarSutunu == null) throw new InvalidOperationException(sb.Ad + ": malzeme listesi sütunları çözülemedi.");
                o.KalemOrnekSatiri = kaynakSatir;
                // toplam sütunu: miktar sütununa eşit olan ("=H7"); bayrak sütunu: toplam > 0 denetimi yapan ("IF(F7>0,1,0)")
                foreach (var ck in s.Satirlar[kaynakSatir].Hucreler)
                {
                    var f = Regex.Replace(s.Formul(XlsmDosyasi.HucreAdi(ck.Key, kaynakSatir)) ?? "", @"\s+", "");
                    if (f == o.MiktarSutunu + kaynakSatir) o.ToplamSutunu = XlsmDosyasi.SutunHarfi(ck.Key);
                }
                foreach (var ck in s.Satirlar[kaynakSatir].Hucreler)
                {
                    var f = Regex.Replace(s.Formul(XlsmDosyasi.HucreAdi(ck.Key, kaynakSatir)) ?? "", @"\s+", "");
                    if (o.ToplamSutunu != null && f == "IF(" + o.ToplamSutunu + kaynakSatir + ">0,1,0)") o.BayrakSutunu = XlsmDosyasi.SutunHarfi(ck.Key);
                }
                // grup başlığı örneği: KOD'suz, ad sütununda yazılı, bir sonraki satırı KOD'lu ilk satır (ör. "BARALAR")
                var satirNolari = new List<int>(s.Satirlar.Keys);
                for (int i = 0; i + 1 < satirNolari.Count; i++)
                {
                    int r = satirNolari[i];
                    if (r >= kaynakSatir) break;
                    bool kodVar = (s.Metin(o.KodSutunu + r) ?? "").Trim().Length > 0, adVar = (s.Metin(o.AdSutunu + r) ?? "").Trim().Length > 0;
                    bool sonrakiKod = (s.Metin(o.KodSutunu + satirNolari[i + 1]) ?? "").Trim().Length > 0;
                    if (!kodVar && adVar && sonrakiKod) { o.GrupOrnekSatiri = r; break; }
                }
                foreach (var rk in s.Satirlar)
                {
                    var k = (s.Metin(o.KodSutunu + rk.Key) ?? "").Trim();
                    if (Regex.IsMatch(k, @"^E\d{3}$", RegexOptions.IgnoreCase)) o.EkSatirlari.Add(new EkSatiri { Satir = rk.Key, Kod = k });
                }
                // EK KALEMLER bölüm başlığı: ilk EK satırının üstündeki KOD'suz yazılı satır
                if (o.EkSatirlari.Count > 0)
                {
                    int r = o.EkSatirlari[0].Satir - 1;
                    var yazi = (s.Metin(o.PozSutunu + r) ?? "").Trim() + (s.Metin(o.AdSutunu + r) ?? "").Trim();
                    if (yazi.Length > 0 && (s.Metin(o.KodSutunu + r) ?? "").Trim().Length == 0) o.EkBaslikSatiri = r;
                }
                return o;
            }
            return null;
        }

        /// <summary>Listeler TİP satırlarından formülle dolar; önbellek yoksa (temiz şablon) aynı kuralla tanımdan türetilir.</summary>
        public static List<string> ListeDegerleri(string anahtar, MetrajSablonu t)
        {
            var l = new List<string>();
            var D = t.Direk; var I = t.Iletken;
            switch (anahtar)
            {
                case "yeniDirek": if (D != null) foreach (var k in D.Sutunlar) if (k.Blok == "Y" && k.Tip != null) l.Add(k.Tip); break;
                case "dmontaj": if (D != null) foreach (var k in D.Sutunlar) if (k.Blok == "DM" && k.Tip != null) l.Add(k.Tip); break;
                case "demontaj": if (D != null) foreach (var k in D.Sutunlar) if (k.Blok == "D" && k.Tip != null) l.Add(k.Tip + " (" + (string.IsNullOrEmpty(k.Temin) ? "K" : k.Temin.Substring(0, 1)) + ")"); break;
                case "imIletken": if (I != null) foreach (var k in I.Sutunlar) if (k.Blok == "Y" && k.Tip != null && k.Birim.StartsWith("kg", StringComparison.OrdinalIgnoreCase)) l.Add(k.Tip); break;
                case "imAer": if (I != null) foreach (var k in I.Sutunlar) if (k.Blok == "Y" && k.Tip != null && !k.Birim.StartsWith("kg", StringComparison.OrdinalIgnoreCase)) l.Add(k.Tip); break;
                case "aydDirek": if (D != null) foreach (var k in D.Sutunlar) if (k.Blok == "Y" && k.Poz == "5.5.3" && k.Ad.Length > 0) l.Add(k.Ad); break;
            }
            return l;
        }

        private static Dictionary<string, Liste> ListelerOku(XlsmDosyasi x, MetrajSablonu t)
        {
            var out_ = new Dictionary<string, Liste>(StringComparer.Ordinal);
            foreach (var kv in _listeAdlari)
            {
                string tanim;
                if (!x.TanimliAdlar.TryGetValue(kv.Key, out tanim)) continue;
                var m = Regex.Match(tanim.Trim(), @"^(?:'((?:[^']|'')*)'|([^'!]+))!\$([A-Z]+)\$(\d+)(?::(?:INDEX\([^)]*\$[A-Z]+\$(\d+),|\$[A-Z]+\$(\d+)))?");
                if (!m.Success) continue;
                var l = new Liste
                {
                    Sayfa = m.Groups[1].Success ? m.Groups[1].Value.Replace("''", "'") : m.Groups[2].Value, Sutun = m.Groups[3].Value,
                    Ilk = int.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture)
                };
                l.Son = m.Groups[5].Success ? int.Parse(m.Groups[5].Value, CultureInfo.InvariantCulture) : m.Groups[6].Success ? int.Parse(m.Groups[6].Value, CultureInfo.InvariantCulture) : l.Ilk;
                XlsmSayfa s;
                try { s = x.Sayfa(l.Sayfa); } catch (Exception) { continue; }
                bool formullu = false;
                for (int r = l.Ilk; r <= l.Son; r++)
                {
                    var o = s.Oku(l.Sutun + r);
                    if (o != null && o.Formul != null) formullu = true;
                    var v = s.Metin(l.Sutun + r);
                    if (string.IsNullOrEmpty(v)) break;
                    l.Degerler.Add(v);
                }
                if (formullu) l.Degerler = ListeDegerleri(kv.Value, t);
                out_[kv.Value] = l;
            }
            return out_;
        }

        /// <summary>Telefonun sablonTanimi çıktısıyla aynı JSON (ortak deneme karşılaştırması için).</summary>
        public JsonNesne JsonYap()
        {
            var j = new JsonNesne();
            j["direk"] = SayfaJson(Direk); j["iletken"] = SayfaJson(Iletken); j["yeralti"] = SayfaJson(Yeralti);
            if (MalzListesi != null)
            {
                var m = new JsonNesne();
                m["sayfa"] = MalzListesi.Sayfa; m["kodSutunu"] = MalzListesi.KodSutunu; m["kaynakSutunu"] = MalzListesi.KaynakSutunu; m["pozSutunu"] = MalzListesi.PozSutunu;
                m["adSutunu"] = MalzListesi.AdSutunu; m["birimSutunu"] = MalzListesi.BirimSutunu; m["teminSutunu"] = MalzListesi.TeminSutunu; m["miktarSutunu"] = MalzListesi.MiktarSutunu;
                m["toplamSutunu"] = MalzListesi.ToplamSutunu; m["bayrakSutunu"] = MalzListesi.BayrakSutunu; m["kalemOrnekSatiri"] = (double)MalzListesi.KalemOrnekSatiri;
                m["grupOrnekSatiri"] = MalzListesi.GrupOrnekSatiri.HasValue ? (object)(double)MalzListesi.GrupOrnekSatiri.Value : null;
                m["ekBaslikSatiri"] = MalzListesi.EkBaslikSatiri.HasValue ? (object)(double)MalzListesi.EkBaslikSatiri.Value : null;
                var ek = new List<object>();
                foreach (var e in MalzListesi.EkSatirlari) { var o = new JsonNesne(); o["satir"] = (double)e.Satir; o["kod"] = e.Kod; ek.Add(o); }
                m["ekSatirlari"] = ek;
                j["malz"] = m;
            }
            else j["malz"] = null;
            var ls = new JsonNesne();
            foreach (var kv in Listeler)
            {
                var o = new JsonNesne(); o["sayfa"] = kv.Value.Sayfa; o["sutun"] = kv.Value.Sutun; o["ilk"] = (double)kv.Value.Ilk; o["son"] = (double)kv.Value.Son;
                var d = new List<object>(); foreach (var v in kv.Value.Degerler) d.Add(v); o["degerler"] = d;
                ls[kv.Key] = o;
            }
            j["listeler"] = ls;
            var kk = new List<object>(); foreach (var k in KullanilanKodlar) kk.Add(k); j["kullanilanKodlar"] = kk;
            return j;
        }

        private static object SayfaJson(Sayfa o)
        {
            if (o == null) return null;
            var j = new JsonNesne();
            j["sayfa"] = o.Ad; j["onek"] = o.Onek; j["kodSatiri"] = (double)o.KodSatiri; j["tipSatiri"] = o.TipSatiri.HasValue ? (object)(double)o.TipSatiri.Value : null;
            j["durumSatiri"] = o.DurumSatiri.HasValue ? (object)(double)o.DurumSatiri.Value : null; j["pozSatiri"] = (double)o.PozSatiri; j["adSatiri"] = (double)o.AdSatiri;
            j["teminSatiri"] = (double)o.TeminSatiri; j["birimSatiri"] = (double)o.BirimSatiri; j["toplamSatiri"] = (double)o.ToplamSatiri;
            j["malzSatiri"] = o.MalzSatiri.HasValue ? (object)(double)o.MalzSatiri.Value : null; j["ilkKodSutunu"] = (double)o.IlkKodSutunu;
            var adl = new JsonNesne(); foreach (var kv in o.Adlar) adl[kv.Key] = kv.Value; j["adlar"] = adl;
            var b = new List<object>(); foreach (var r in o.BayrakSatirlari) b.Add((double)r); j["bayrakSatirlari"] = b;
            j["grupSatiri"] = o.GrupSatiri.HasValue ? (object)(double)o.GrupSatiri.Value : null;
            var a = new List<object>(); foreach (var r in o.AltSatirlar) a.Add((double)r); j["altSatirlar"] = a;
            j["ilkVeri"] = (double)o.IlkVeri; j["sonVeri"] = (double)o.SonVeri; j["sonSutun"] = (double)o.SonSutun;
            var sl = new List<object>();
            foreach (var k in o.Sutunlar)
            {
                var s = new JsonNesne();
                s["sutun"] = (double)k.SutunNo; s["kod"] = k.Kod; s["blok"] = k.Blok; s["tip"] = k.Tip; s["poz"] = k.Poz; s["ad"] = k.Ad; s["temin"] = k.Temin; s["birim"] = k.Birim; s["grup"] = k.Grup; s["formullu"] = k.Formullu;
                sl.Add(s);
            }
            j["sutunlar"] = sl;
            var sb = new JsonNesne();
            foreach (var kv in o.Sabit) sb[kv.Key] = kv.Value;
            if (o.Onek == "IM")
            {
                var ag = new List<object>(); foreach (var c in o.Ag) ag.Add(new List<object> { c[0], c[1] }); sb["ag"] = ag;
                sb["og"] = new List<object> { o.Og[0], o.Og[1] }; sb["aer"] = new List<object> { o.Aer[0], o.Aer[1] };
            }
            j["sabit"] = sb;
            var bs = new JsonNesne(); foreach (var kv in o.Baslik) bs[kv.Key] = kv.Value; j["baslik"] = bs;
            return j;
        }
    }

    /// <summary>Doldurma planı (SH.birlesikMetraj çıktısıyla aynı yapı).</summary>
    public sealed class MetrajPlani
    {
        public sealed class SayfaPlani
        {
            public Dictionary<string, object> Hucreler = new Dictionary<string, object>(StringComparer.Ordinal);
            public List<int> GosterSatirlar = new List<int>();
            public int[] Gizle;
        }
        public sealed class YeniSutun
        {
            public string Hangi, Sayfa, OrnekSayfa, Blok, Anahtar, Kod, Tip = "", Poz = "", Ad = "", Temin = "", Birim = "ad.", Grup, GrupAdi;
            public int SutunNo; public int? OrnekSutun; public bool VeriFormulu; public string KaynakCins, KaynakTanim;
        }
        /// <summary>Kopya sayfa: DİREK METRAJI'nın kopyası, temsil edilmeyen cinsin (ailenin) direkleri için.</summary>
        public sealed class KopyaSayfa { public string Ad, Kaynak, Hangi, Aile; }
        /// <summary>MALZ. LİSTESİ'ne eklenen satır: grup başlığı ya da kalem (biçimi örnek satırdan alınır).</summary>
        public sealed class MalzSatiri { public int Satir; public string Tur, Sayfa, Kod; }
        public sealed class ListeEki { public string Liste, Deger, Sayfa, Ref; }
        public sealed class Fazla { public string Hangi, Blok, Anahtar, Ad, Poz, Birim; public double Miktar; public List<string> Nereler = new List<string>(); }

        public Dictionary<string, SayfaPlani> Sayfalar = new Dictionary<string, SayfaPlani>(StringComparer.Ordinal);
        public List<KopyaSayfa> KopyaSayfalar = new List<KopyaSayfa>();
        public List<YeniSutun> YeniSutunlar = new List<YeniSutun>();
        public List<MalzSatiri> MalzSatirlari = new List<MalzSatiri>();
        public List<ListeEki> ListeEkle = new List<ListeEki>();
        public List<Fazla> Fazlalar = new List<Fazla>();
        public List<string> Uyarilar = new List<string>();
        public Dictionary<string, int> Ozet = new Dictionary<string, int>(StringComparer.Ordinal);

        public JsonNesne JsonYap()
        {
            var j = new JsonNesne();
            var sayfalar = new JsonNesne();
            foreach (var kv in Sayfalar)
            {
                var s = new JsonNesne(); var h = new JsonNesne();
                foreach (var c in kv.Value.Hucreler) h[c.Key] = c.Value is int ? (object)(double)(int)c.Value : c.Value;
                s["hucreler"] = h;
                var g = new List<object>(); foreach (var r in kv.Value.GosterSatirlar) g.Add((double)r); s["gosterSatirlar"] = g;
                s["gizle"] = kv.Value.Gizle != null ? new List<object> { (double)kv.Value.Gizle[0], (double)kv.Value.Gizle[1] } : null;
                sayfalar[kv.Key] = s;
            }
            j["sayfalar"] = sayfalar;
            var ks = new List<object>();
            foreach (var k in KopyaSayfalar) { var o = new JsonNesne(); o["ad"] = k.Ad; o["kaynak"] = k.Kaynak; o["hangi"] = k.Hangi; o["aile"] = k.Aile; ks.Add(o); }
            j["kopyaSayfalar"] = ks;
            var ys = new List<object>();
            foreach (var y in YeniSutunlar)
            {
                var o = new JsonNesne();
                o["hangi"] = y.Hangi; o["sayfa"] = y.Sayfa; o["ornekSayfa"] = y.OrnekSayfa; o["blok"] = y.Blok; o["anahtar"] = y.Anahtar; o["sutun"] = (double)y.SutunNo; o["kod"] = y.Kod;
                o["ornekSutun"] = y.OrnekSutun.HasValue ? (object)(double)y.OrnekSutun.Value : null; o["tip"] = y.Tip; o["poz"] = y.Poz; o["ad"] = y.Ad;
                o["temin"] = y.Temin; o["birim"] = y.Birim; o["grup"] = y.Grup; o["veriFormulu"] = y.VeriFormulu;
                if (y.KaynakCins != null) { var k = new JsonNesne(); k["cins"] = y.KaynakCins; k["tanim"] = y.KaynakTanim; o["kaynak"] = k; } else o["kaynak"] = null;
                ys.Add(o);
            }
            j["yeniSutunlar"] = ys;
            var ms = new List<object>();
            foreach (var m in MalzSatirlari) { var o = new JsonNesne(); o["satir"] = (double)m.Satir; o["tur"] = m.Tur; o["sayfa"] = m.Sayfa; if (m.Kod != null) o["kod"] = m.Kod; ms.Add(o); }
            j["malzSatirlari"] = ms;
            var le = new List<object>();
            foreach (var l in ListeEkle) { var o = new JsonNesne(); o["liste"] = l.Liste; o["deger"] = l.Deger; o["sayfa"] = l.Sayfa; o["ref"] = l.Ref; le.Add(o); }
            j["listeEkle"] = le;
            var fz = new List<object>();
            foreach (var f in Fazlalar)
            {
                var o = new JsonNesne(); o["hangi"] = f.Hangi; o["blok"] = f.Blok; o["anahtar"] = f.Anahtar; o["ad"] = f.Ad; o["poz"] = f.Poz; o["birim"] = f.Birim; o["miktar"] = f.Miktar;
                var n = new List<object>(); foreach (var x in f.Nereler) n.Add(x); o["nereler"] = n; fz.Add(o);
            }
            j["fazla"] = fz;
            var uy = new List<object>(); foreach (var u in Uyarilar) uy.Add(u); j["uyarilar"] = uy;
            var oz = new JsonNesne(); foreach (var kv in Ozet) oz[kv.Key] = (double)kv.Value; j["ozet"] = oz;
            return j;
        }
    }

    /// <summary>Birleşik Metraj penceresinin hatırlanan ayarları (%APPDATA%\SebekeHakedis\metraj.json): firma, il, ilçe, şablon.</summary>
    public sealed class MetrajAyari
    {
        public string Firma = "", Il = "", Ilce = "";
        /// <summary>true: gömülü temiz şablon; false: SablonYolu'ndaki kullanıcının dosyası.</summary>
        public bool Gomulu = true;
        public string SablonYolu = "";

        public static MetrajAyari Oku(string yol)
        {
            var a = new MetrajAyari();
            try
            {
                if (!System.IO.File.Exists(yol)) return a;
                var k = Json.Oku(System.IO.File.ReadAllText(yol, Encoding.UTF8)) as JsonNesne;
                if (k == null) return a;
                a.Firma = k.Metin("firma"); a.Il = k.Metin("il"); a.Ilce = k.Metin("ilce");
                a.Gomulu = k.Mantik("gomulu") ?? true; a.SablonYolu = k.Metin("sablonYolu");
            }
            catch { }
            return a;
        }

        public void Kaydet(string yol)
        {
            var k = new JsonNesne();
            k["firma"] = Firma ?? ""; k["il"] = Il ?? ""; k["ilce"] = Ilce ?? ""; k["gomulu"] = Gomulu; k["sablonYolu"] = SablonYolu ?? "";
            var klasor = System.IO.Path.GetDirectoryName(yol);
            if (!string.IsNullOrEmpty(klasor)) System.IO.Directory.CreateDirectory(klasor);
            System.IO.File.WriteAllText(yol, Json.Yaz(k) + "\n", new UTF8Encoding(false));
        }
    }

    /// <summary>
    /// Birleşik Metraj: projeden şablon doldurma planı ve planın dosyaya işlenmesi. Telefonla aynı kural
    /// (sh-core.cjs › birlesikMetraj, birlesik-metraj.js › planUygula); ortak deneme ortak/deneme/birlesik-metraj.
    /// </summary>
    public static class BirlesikMetraj
    {
        public const string FazlaSayfasi = "ŞABLONDA OLMAYAN";

        public sealed class Ayar
        {
            public string BolgeId, Firma, Il, Ilce, HakedisNo;
            public Katsayilar Katsayilar;
            /// <summary>ortak/katalog/metraj-sablon.json (eşleşme tablosu).</summary>
            public JsonNesne Eslesme;
            /// <summary>Katalog: kalemin poz numarası için.</summary>
            public Katalog Katalog;
        }

        /// <summary>ENH direk tipindeki iletken eki ("G-T-12 (sw)") → aile adı eki (İLETKEN METRAJI'ndaki tel kodlarıyla).</summary>
        private static readonly Dictionary<string, string> IletkenEki = new Dictionary<string, string>(StringComparer.Ordinal) { { "SW", "SWLL" }, { "RV", "RAVEN" }, { "PG", "PİGEON" }, { "HW", "HAWK" }, { "PN", "PANSY" }, { "RS", "ROSE" }, { "AS", "ASTER" } };
        private static readonly string[] SayfaSirasi = { "direk", "iletken", "yeralti" };

        /// <summary>Büyük harf (Türkçe: i → İ, ı → I).</summary>
        public static string Buyuk(string s) => Str(s).Replace('i', 'İ').Replace('ı', 'I').ToUpperInvariant();

        /// <summary>Direğin aile anahtarı: cins + ENH tipindeki iletken eki ("ENH_DEMİR_GLV|SW"); eki olmayan tipte yalnız cins.</summary>
        public static string Aile(string cins, string tip)
        {
            var m = Regex.Match(Str(tip).Trim(), @"\(\s*([A-Za-z]{2,3})\s*\)\s*$");
            var ek = m.Success ? m.Groups[1].Value.ToUpperInvariant().Replace('İ', 'I') : "";
            return Str(cins) + (ek.Length > 0 ? "|" + ek : "");
        }

        /// <summary>Kopya sayfanın adı: "DİREK " + cinsin okunur adı (büyük; "DİREK" / "DİREĞİ" sözü atılır, kısaltmalar) + iletken eki; 31 karakter.</summary>
        public static string KopyaAdi(string hangi, string aile, Func<string, string> cinsAdi)
        {
            var parca = aile.Split('|');
            string cins = parca[0], ek = parca.Length > 1 ? parca[1] : "";
            var adi = cinsAdi != null ? cinsAdi(cins) : null;
            var ad = Buyuk(!string.IsNullOrEmpty(adi) ? adi : cins.Replace('_', ' '));
            ad = Regex.Replace(ad, @"\s+DİRE(K|Ğİ)(?=\s|$)", "");
            ad = Regex.Replace(Regex.Replace(ad, @"[\[\]:*?/\\']", " "), @"\s+", " ").Trim();
            ad = Regex.Replace(ad, @"\bGALVANİZ\b", "GALV."); ad = Regex.Replace(ad, @"\bAYDINLATMA\b", "AYD."); ad = Regex.Replace(ad, @"\bMÜŞTEREK\b", "MÜŞ.");
            string ekAdi = ""; if (ek.Length > 0 && !IletkenEki.TryGetValue(ek, out ekAdi)) ekAdi = ek;
            var tam = (hangi == "direk" ? "DİREK " : hangi == "iletken" ? "İLETKEN " : "YERALTI ") + ad + (ekAdi.Length > 0 ? " " + ekAdi : "");
            if (tam.Length > 31) tam = tam.Substring(0, 31).Trim();
            return tam;
        }

        /// <summary>Formülde sayfa adı: tek tırnakla, içindeki tırnak ikilenir.</summary>
        private static string SayfaRef(string ad) => "'" + Str(ad).Replace("'", "''") + "'";

        /// <summary>Plan hedefi: ana metraj sayfası ya da kopyası (kaynak = ana tanım; ana sayfada null).</summary>
        private sealed class Hedef
        {
            public string Hangi, Sayfa; public MetrajSablonu.Sayfa Tanim, Kaynak; public List<MetrajSablonu.Sutun> Sutunlar; public int SonSutun;
        }

        private static readonly Dictionary<string, string> BlokAdi = new Dictionary<string, string>(StringComparer.Ordinal) { { "Y", "YENİ" }, { "D", "DEMONTAJ" }, { "DM", "DEMONTAJDAN MONTAJ" }, { "A", "AKTARIM" } };
        private static readonly Dictionary<string, string> DurumYazisi = new Dictionary<string, string>(StringComparer.Ordinal) { { "Y", "YENİ" }, { "D", "DM" }, { "DM", "DM" }, { "A", "AKTARIM" } };
        private static readonly Dictionary<string, string> Onek = new Dictionary<string, string>(StringComparer.Ordinal) { { "direk", "DM" }, { "iletken", "IM" }, { "yeralti", "YM" } };

        // ---------------- yardımcılar (sh-core.cjs ile aynı) ----------------

        private static string Str(string s) => s ?? "";

        /// <summary>Karşılaştırma için ad normalleştirme: büyük harf (i → I), '' → ", boşluk / çarpı sadeleşir.</summary>
        public static string Norm(string s)
        {
            string t = Str(s).Normalize(NormalizationForm.FormC).Trim();
            t = t.Replace("''", "\"").Replace('″', '"').Replace('“', '"').Replace('”', '"');
            t = Regex.Replace(t, @"\s+", " ");
            t = t.Replace('İ', 'I').Replace('ı', 'I').ToUpperInvariant();
            t = t.Replace("MM²", "MM2"); t = Regex.Replace(t, @"MM 2\b", "MM2");
            t = Regex.Replace(t, @"\s*[xX×]\s*(?=[\d(])", "X"); t = Regex.Replace(t, @"(\d)\s*\+\s*(?=\d)", "$1+"); t = Regex.Replace(t, @"(\d)\s*/\s*(?=\d)", "$1/");
            t = Regex.Replace(t, @"(\d)\(", "$1X(");
            t = t.Replace("TUVENAN", "TUVANEN").Replace("ALÜMINYUM", "ALUMINYUM");
            return t;
        }

        public static string IlkSozcuk(string s) { var n = Norm(s); int i = n.IndexOf(' '); return i < 0 ? n : n.Substring(0, i); }

        /// <summary>Durum kodu → blok: Y, D, DM, MEVCUT; İLERİDE → null.</summary>
        public static string Blok(string durum)
        {
            var d = Str(durum).Trim().ToUpperInvariant().Replace('İ', 'I');
            if (d == "DM" || d == "DEMONTAJ") return "D";
            if (d == "DM+M" || d == "DMM") return "DM";
            if (d == "MEVCUT") return "MEVCUT";
            if (d == "ILERIDE") return null;
            return "Y";
        }

        private static List<string> Parcala(string s)
        {
            var l = new List<string>();
            foreach (Match m in Regex.Matches(Str(s).ToUpperInvariant().Replace('İ', 'I').Replace('ı', 'I'), @"\d+|\D+")) l.Add(m.Value);
            return l;
        }

        /// <summary>Doğal sıra (SC2 &lt; SC10): sayılar sayı olarak, yazılar büyük harf kod sırasıyla.</summary>
        public static int DogalSira(string a, string b)
        {
            var pa = Parcala(a); var pb = Parcala(b);
            int n = Math.Min(pa.Count, pb.Count);
            for (int i = 0; i < n; i++)
            {
                string x = pa[i], y = pb[i];
                bool nx = char.IsDigit(x[0]), ny = char.IsDigit(y[0]);
                if (nx && ny)
                {
                    double d = double.Parse(x, CultureInfo.InvariantCulture) - double.Parse(y, CultureInfo.InvariantCulture);
                    if (d != 0) return d < 0 ? -1 : 1;
                    if (x.Length != y.Length) return x.Length - y.Length;
                    continue;
                }
                if (nx != ny) return nx ? -1 : 1;
                int c = string.CompareOrdinal(x, y);
                if (c != 0) return c < 0 ? -1 : 1;
            }
            return pa.Count - pb.Count;
        }

        /// <summary>Eklenti birimi ("ad/kg", "mt/mt", "mt/m³") → şablon birimi.</summary>
        public static string Birim(string birim)
        {
            var g = Str(birim).Split('/')[0].ToLowerInvariant().Trim();
            if (g == "kg") return "kg";
            if (g == "mt" || g == "m") return "mt.";
            if (g == "tk") return "tk.";
            if (g == "m3" || g == "m³") return "m3";
            return "ad.";
        }

        /// <summary>Yazılacak miktar: şablon sütunu kg / m3 ve kalemin rapor birimi öyleyse toplam, yoksa giriş miktarı.</summary>
        public static double Miktar(Kalem k, string sablonBirim)
        {
            var p = Str(k.Birim).Split('/');
            var rapor = p.Length > 1 ? p[1] : "";
            var sb = Str(sablonBirim).ToLowerInvariant();
            if ((sb.StartsWith("kg") && rapor.StartsWith("kg", StringComparison.OrdinalIgnoreCase)) || (sb.StartsWith("m3") && Regex.IsMatch(rapor, "^m(3|³)", RegexOptions.IgnoreCase)))
                return SayiCoz.Temiz(k.Toplam != 0 ? k.Toplam : k.Miktar * (k.Katsayi != 0 ? k.Katsayi : 1), 3);
            return SayiCoz.Temiz(k.Miktar, 3);
        }

        /// <summary>Poz: demontaj "1" + poz, demontajdan montaj / aktarım "2" + poz; ilk bölüm iki haneye tamamlanır.</summary>
        public static string Poz(string poz, string blok)
        {
            var t = Str(poz).Trim();
            if (t.Length == 0 || blok == "Y" || blok == "MEVCUT") return t;
            var seg = t.Split('.');
            seg[0] = seg[0].PadLeft(2, '0');
            return (blok == "D" ? "1" : "2") + string.Join(".", seg);
        }

        public static Eleman YakinEleman(Proje p, double[] nokta, double tol = 3.5)
        {
            if (nokta == null) return null;
            Eleman en = null; double enD = tol;
            foreach (var e in p.Elemanlar)
            {
                double d = Math.Sqrt((e.Saga - nokta[0]) * (e.Saga - nokta[0]) + (e.Yukari - nokta[1]) * (e.Yukari - nokta[1]));
                if (d <= enD) { enD = d; en = e; }
            }
            return en;
        }

        /// <summary>Kırık çizginin kanallardan birinin üstünden giden uzunluğu (m): 0,25 m adım, yanal pay 0,6 m.</summary>
        public static double KanalUstu(IList<double[]> kose, IList<IList<double[]>> kanallar)
        {
            if (kose == null || kose.Count < 2 || kanallar == null || kanallar.Count == 0) return 0;
            const double adim = 0.25, tol = 0.6;
            Func<double[], bool> kanaldaMi = q =>
            {
                foreach (var kk in kanallar)
                    for (int i = 1; i < kk.Count; i++)
                        if (Geometri.DogruParcasinaMesafe(q, kk[i - 1], kk[i]) <= tol) return true;
                return false;
            };
            double icinde = 0;
            for (int i = 1; i < kose.Count; i++)
            {
                var a = kose[i - 1]; var b = kose[i]; double L = Geometri.Mesafe(a, b);
                int n = Math.Max(1, (int)Math.Ceiling(L / adim));
                for (int j = 0; j < n; j++)
                {
                    double t = (j + 0.5) / n;
                    if (kanaldaMi(new[] { a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t })) icinde += L / n;
                }
            }
            return SayiCoz.Temiz(icinde, 2);
        }

        private static string Ust(string s) => Str(s).Replace('İ', 'I').ToUpperInvariant();

        /// <summary>Doldurma planı; kural ortak/BIRLESIK-METRAJ.md.</summary>
        public static MetrajPlani Planla(Proje p, MetrajSablonu sablon, Ayar ayar)
        {
            var a = ayar ?? new Ayar();
            var es = a.Eslesme ?? new JsonNesne();
            var esKalemler = es.Nesne("kalemler") ?? new JsonNesne();
            var esTemin = es.Nesne("temin") ?? new JsonNesne();
            var kat = a.Katsayilar ?? Katsayilar.Varsayilan;
            var plan = new MetrajPlani();
            var uyarilar = plan.Uyarilar;
            var ozet = plan.Ozet;
            foreach (var k in new[] { "eleman", "iletkenSatiri", "yeraltiSatiri", "eslesen", "yeniSutun", "kopyaSayfa", "fazla", "atlanan" }) ozet[k] = 0;
            Func<string, MetrajPlani.SayfaPlani> sayfa = ad => { MetrajPlani.SayfaPlani s; if (!plan.Sayfalar.TryGetValue(ad, out s)) { s = new MetrajPlani.SayfaPlani(); plan.Sayfalar[ad] = s; } return s; };
            Action<string, string, object> yaz = (ad, ref_, deger) =>
            {
                if (deger == null) return;
                var s = deger as string; if (s != null && s.Length == 0) return;
                sayfa(ad).Hucreler[ref_] = deger;
            };
            Action<string, string> sil = (ad, ref_) => { sayfa(ad).Hucreler[ref_] = null; };
            var basliklar = new Dictionary<string, object>(StringComparer.Ordinal);   // DİREK başlık hücreleri (il, ilçe…): kopya sayfalara da yazılır
            Action<string, string, object> baslikYaz = (ad, ref_, deger) =>
            {
                yaz(ad, ref_, deger);
                if (deger == null) return;
                var s = deger as string; if (s != null && s.Length == 0) return;
                basliklar[ref_] = deger;
            };
            Action<string, string, double> topla = (ad, ref_, m) =>
            {
                var h = sayfa(ad).Hucreler; object v; double eski = 0;
                if (h.TryGetValue(ref_, out v) && v is double) eski = (double)v;
                h[ref_] = SayiCoz.Temiz(eski + m, 3);
            };
            Func<string, bool> bolgeSuz = b => string.IsNullOrEmpty(a.BolgeId) || Str(b) == a.BolgeId;
            var elemanlar = new List<Eleman>(); foreach (var e in p.Elemanlar) if (bolgeSuz(e.Bolge)) elemanlar.Add(e);
            var hatlar = new List<Hat>(); foreach (var h in p.Hatlar) if (bolgeSuz(h.Bolge)) hatlar.Add(h);
            var kanallar = new List<Kanal>(); foreach (var k in p.Kanallar) if (bolgeSuz(k.Bolge)) kanallar.Add(k);
            Bolge bolge = null; foreach (var b in p.Bolgeler) if (Str(b.Id) == Str(a.BolgeId)) { bolge = b; break; }
            object hakedisNo = !string.IsNullOrEmpty(a.HakedisNo) ? (object)a.HakedisNo : (p.AktifHakedis > 0 ? (object)(double)p.AktifHakedis : "");
            Func<string, string, JsonNesne> esl = (cins, tanim) => esKalemler.Nesne(Str(cins) + "|" + Str(tanim)) ?? esKalemler.Nesne(Str(tanim));
            Func<string, string, string> pozAl = (cins, tanim) => { if (a.Katalog == null) return ""; var k = a.Katalog.Bul(cins, tanim); return k != null ? Str(k.PozNo) : ""; };
            Func<string, string, string, string> pozYap = (cins, tanim, blok) => { var e = esl(cins, tanim); var pz = e != null ? e.Metin("poz") : ""; return Poz(pz.Length > 0 ? pz : pozAl(cins, tanim), blok); };
            Func<string, string, string, string> temin = (cins, tanim, blok) =>
            {
                if (blok != "Y") return "";
                var e = esl(cins, tanim); var t = e != null ? e.Metin("temin") : "";
                if (t.Length > 0) return t;
                t = esTemin.Metin(Str(cins));
                return t.Length > 0 ? t : "Ş";
            };

            // ---- yeni sütun yönetimi (telefon: hedefler, kopyaSayfa, kodUret, yeniSutun, malzemeYaz, sutunBul, cinsTemsilEdiliyor)
            var hedefler = new List<Hedef>();
            foreach (var hangi in SayfaSirasi) { var t = sablon.Al(hangi); if (t != null) hedefler.Add(new Hedef { Hangi = hangi, Sayfa = t.Ad, Tanim = t, Kaynak = null, Sutunlar = t.Sutunlar, SonSutun = t.SonSutun }); }
            Func<string, Hedef> hedefBul = ad => { foreach (var h in hedefler) if (h.Sayfa == ad) return h; return null; };
            Func<string, string> cinsAdi = c => { var kc = a.Katalog != null ? a.Katalog.Cins(c) : null; return kc != null && Str(kc.Ad).Length > 0 ? kc.Ad : null; };
            Func<string, string, Hedef> kopyaSayfa = (hangi, aile) =>
            {
                var ana = sablon.Al(hangi);
                var ad = KopyaAdi(hangi, aile, cinsAdi);
                var k = hedefBul(ad);
                if (k != null) return k;
                k = new Hedef { Hangi = hangi, Sayfa = ad, Kaynak = ana, Tanim = ana, Sutunlar = new List<MetrajSablonu.Sutun>(), SonSutun = ana.IlkKodSutunu - 1 };
                hedefler.Add(k);
                plan.KopyaSayfalar.Add(new MetrajPlani.KopyaSayfa { Ad = ad, Kaynak = ana.Ad, Hangi = hangi, Aile = aile });
                if (hangi == "direk") foreach (var kv in basliklar) yaz(ad, kv.Key, kv.Value);
                return k;
            };
            // KOD dizisi: şablonun blok önekli numaraları sürer (Y001… → Y175…, D074…, DM072…, A017…)
            var kodSayac = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var k in sablon.KullanilanKodlar)
            {
                var m = Regex.Match(Str(k).Trim(), @"^(DM|Y|D|A)(\d+)$", RegexOptions.IgnoreCase);
                if (!m.Success) continue;
                var pre = m.Groups[1].Value.ToUpperInvariant(); int n = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
                int eski; if (!kodSayac.TryGetValue(pre, out eski) || n > eski) kodSayac[pre] = n;
            }
            Func<string, string> kodUret = blok => { int n; kodSayac.TryGetValue(blok, out n); n++; kodSayac[blok] = n; return blok + n.ToString("000", CultureInfo.InvariantCulture); };
            var listeSayac = new Dictionary<string, int>(StringComparer.Ordinal);
            Action<string, string> listeyeEkle = (liste, deger) =>
            {
                MetrajSablonu.Liste l;
                if (!sablon.Listeler.TryGetValue(liste, out l) || string.IsNullOrEmpty(deger)) return;
                var nd = Norm(deger);
                foreach (var v in l.Degerler) if (Norm(v) == nd) return;
                foreach (var x in plan.ListeEkle) if (x.Liste == liste && Norm(x.Deger) == nd) return;
                int say; listeSayac.TryGetValue(liste, out say);
                int satir = l.Ilk + l.Degerler.Count + say;
                if (satir > l.Son) { uyarilar.Add("KATSAYILAR " + liste + " listesi dolu; \"" + deger + "\" eklenemedi."); return; }
                listeSayac[liste] = say + 1;
                plan.ListeEkle.Add(new MetrajPlani.ListeEki { Liste = liste, Deger = deger, Sayfa = l.Sayfa, Ref = l.Sutun + satir });
                yaz(l.Sayfa, l.Sutun + satir, deger);
            };
            Func<Hedef, string, string, MetrajPlani.YeniSutun, MetrajPlani.YeniSutun> yeniSutun = (h, blok, anahtar, bilgi) =>
            {
                foreach (var v in plan.YeniSutunlar) if (v.Sayfa == h.Sayfa && v.Blok == blok && v.Anahtar == anahtar) return v;
                var t = h.Tanim;
                int sutun = ++h.SonSutun;
                var ornekler = (h.Kaynak ?? t).Sutunlar;
                MetrajSablonu.Sutun ornek = null;
                if (bilgi.VeriFormulu && h.Hangi == "direk") for (int i = ornekler.Count - 1; i >= 0; i--) if (ornekler[i].Blok == blok && ornekler[i].Tip != null) { ornek = ornekler[i]; break; }
                if (ornek == null) for (int i = ornekler.Count - 1; i >= 0; i--) if (ornekler[i].Blok == blok) { ornek = ornekler[i]; break; }
                if (ornek == null && ornekler.Count > 0) ornek = ornekler[ornekler.Count - 1];
                var kod = kodUret(blok);
                var y = new MetrajPlani.YeniSutun
                {
                    Hangi = h.Hangi, Sayfa = h.Sayfa, OrnekSayfa = (h.Kaynak ?? t).Ad, Blok = blok, Anahtar = anahtar, SutunNo = sutun, Kod = kod, OrnekSutun = ornek != null ? ornek.SutunNo : (int?)null,
                    Tip = Str(bilgi.Tip), Poz = Str(bilgi.Poz), Ad = Str(bilgi.Ad), Temin = Str(bilgi.Temin), Birim = Str(bilgi.Birim).Length > 0 ? bilgi.Birim : "ad.",
                    Grup = (BlokAdi.ContainsKey(blok) ? BlokAdi[blok] : blok) + "\n" + (Str(bilgi.GrupAdi).Length > 0 ? bilgi.GrupAdi : "ŞEBEKE-M"), VeriFormulu = bilgi.VeriFormulu, KaynakCins = bilgi.KaynakCins, KaynakTanim = bilgi.KaynakTanim
                };
                plan.YeniSutunlar.Add(y);
                if (ReferenceEquals(h.Sutunlar, t.Sutunlar)) h.Sutunlar = new List<MetrajSablonu.Sutun>(t.Sutunlar);   // ana tanımın listesi değişmesin
                h.Sutunlar.Add(new MetrajSablonu.Sutun { SutunNo = sutun, Kod = kod, Blok = blok, Tip = y.Tip.Length > 0 ? y.Tip : null, Poz = y.Poz, Ad = y.Ad, Temin = y.Temin, Birim = y.Birim, Grup = y.Grup, Formullu = y.VeriFormulu, Yeni = true });
                var S = XlsmDosyasi.SutunHarfi(sutun); var hc = sayfa(h.Sayfa).Hucreler;
                hc[S + t.KodSatiri] = y.Kod;
                if (t.TipSatiri.HasValue && y.Tip.Length > 0) hc[S + t.TipSatiri.Value] = y.Tip;
                if (t.DurumSatiri.HasValue) hc[S + t.DurumSatiri.Value] = DurumYazisi.ContainsKey(blok) ? DurumYazisi[blok] : blok;
                if (t.GrupSatiri.HasValue) hc[S + t.GrupSatiri.Value] = y.Grup;
                if (y.Poz.Length > 0) hc[S + t.PozSatiri] = y.Poz;
                hc[S + t.AdSatiri] = y.Ad;
                if (y.Temin.Length > 0) hc[S + t.TeminSatiri] = y.Temin;
                hc[S + t.BirimSatiri] = y.Birim;
                return y;
            };
            Func<string, string, string, MetrajPlani.YeniSutun, double, string, MetrajPlani.Fazla> fazlaya = (hangi, blok, anahtar, bilgi, miktar, kim) =>
            {
                MetrajPlani.Fazla f = null;
                foreach (var x in plan.Fazlalar) if (x.Hangi == hangi && x.Blok == blok && x.Anahtar == anahtar) { f = x; break; }
                if (f == null) { f = new MetrajPlani.Fazla { Hangi = hangi, Blok = blok, Anahtar = anahtar, Ad = Str(bilgi.Ad), Poz = Str(bilgi.Poz), Birim = Str(bilgi.Birim).Length > 0 ? bilgi.Birim : "ad." }; plan.Fazlalar.Add(f); }
                f.Miktar = SayiCoz.Temiz(f.Miktar + miktar, 3);
                if (!string.IsNullOrEmpty(kim) && !f.Nereler.Contains(kim)) f.Nereler.Add(kim);
                return f;
            };
            Func<List<MetrajSablonu.Sutun>, string, Kalem, MetrajSablonu.Sutun> sutunBul = (sutunlar, blok, k) =>
            {
                var tanim = Norm(k.Tanim); var e = esl(k.Cins, k.Tanim);
                var adlar = new List<string>();
                if (e != null && e.Dizi("adlar") != null) foreach (var x in e.Dizi("adlar")) adlar.Add(Norm(x as string));
                var aday = new List<MetrajSablonu.Sutun>(); foreach (var x in sutunlar) if (x.Blok == blok) aday.Add(x);
                foreach (var x in aday) if (x.Tip != null && Norm(x.Tip) == tanim) return x;
                foreach (var x in aday) if (Norm(x.Ad) == tanim) return x;
                if (adlar.Count > 0) foreach (var x in aday) if (adlar.Contains(Norm(x.Ad))) return x;
                if (Regex.IsMatch(tanim, @"[\d-]")) foreach (var x in aday) if (Norm(x.Ad).StartsWith(tanim + " ", StringComparison.Ordinal)) return x;
                return null;
            };
            Func<Hedef, string, Kalem, int, string, int> malzemeYaz = (h, blok, k, r, kim) =>
            {
                var s = sutunBul(h.Sutunlar, blok, k); int sutunNo; string birim;
                if (s != null) { if (!s.Yeni) ozet["eslesen"]++; sutunNo = s.SutunNo; birim = s.Birim; }
                else
                {
                    var anaS = h.Kaynak != null ? sutunBul(h.Kaynak.Sutunlar, blok, k) : null;
                    var bilgi = anaS != null
                        ? new MetrajPlani.YeniSutun { Tip = anaS.Tip ?? "", Poz = anaS.Poz, Ad = anaS.Ad, Temin = anaS.Temin, Birim = anaS.Birim, GrupAdi = "MALZEMELER", KaynakCins = Str(k.Cins), KaynakTanim = Str(k.Tanim) }
                        : new MetrajPlani.YeniSutun { Poz = pozYap(k.Cins, k.Tanim, blok), Ad = Str(k.Tanim), Temin = temin(k.Cins, k.Tanim, blok), Birim = Birim(k.Birim), GrupAdi = "MALZEMELER", KaynakCins = Str(k.Cins), KaynakTanim = Str(k.Tanim) };
                    if (anaS != null) ozet["eslesen"]++;
                    var y = yeniSutun(h, blok, "AD|" + Norm(k.Tanim), bilgi);
                    if (y == null) { fazlaya(h.Hangi, blok, "AD|" + Norm(k.Tanim), bilgi, Miktar(k, bilgi.Birim), kim); return 0; }
                    sutunNo = y.SutunNo; birim = y.Birim;
                }
                topla(h.Sayfa, XlsmDosyasi.SutunHarfi(sutunNo) + r, Miktar(k, birim));
                return sutunNo;
            };
            // Direğin cinsi ana DİREK sayfasında temsil ediliyor mu (telefon: cinsTemsilEdiliyor): TİP satırındaki bir tip o
            // cinsin katalogdaki ana pozlarından ya da eşleşme tablosundaki "tip" takma adından biriyse; ya da anaSayfaAileleri'ndeyse
            var temsilOnbellek = new Dictionary<string, bool>(StringComparer.Ordinal);
            var anaSayfaAileleri = new List<string>(); if (es.Dizi("anaSayfaAileleri") != null) foreach (var x in es.Dizi("anaSayfaAileleri")) anaSayfaAileleri.Add(Str(x as string));
            Func<string, bool> cinsTemsilEdiliyor = aile =>
            {
                bool var_;
                if (temsilOnbellek.TryGetValue(aile, out var_)) return var_;
                var D0 = sablon.Direk;
                var parca = aile.Split('|'); string cins = parca[0]; bool ekVar = parca.Length > 1;
                var_ = false;
                foreach (var x in anaSayfaAileleri) if (x == aile || (x == cins && !ekVar)) { var_ = true; break; }
                if (!var_ && D0 != null)
                {
                    var tipler = new List<string>(); foreach (var x in D0.Sutunlar) if (x.Tip != null) tipler.Add(Norm(x.Tip));
                    if (a.Katalog != null)
                        foreach (var tn in tipler) { foreach (var kk in a.Katalog.Kalemler) if (kk.Rol == "ana" && kk.Cins == cins && Norm(kk.Tanim) == tn) { var_ = true; break; } if (var_) break; }
                    if (!var_)
                        foreach (var kv in esKalemler)
                        {
                            var deger = kv.Value as JsonNesne;
                            if (deger == null || deger.Metin("tip").Length == 0 || kv.Key.IndexOf('|') < 0 || kv.Key.Split('|')[0] != cins) continue;
                            if (tipler.Contains(Norm(deger.Metin("tip")))) { var_ = true; break; }
                        }
                }
                temsilOnbellek[aile] = var_;
                return var_;
            };
            Action<string, int> satirGoster = (ad, r) => { var s = sayfa(ad); if (!s.GosterSatirlar.Contains(r)) s.GosterSatirlar.Add(r); };
            Action<string, MetrajSablonu.Sayfa, int> bitir = (ad, t, r) =>
            {
                var s = sayfa(ad);
                for (int i = r; i <= Math.Min(r + 1, t.SonVeri); i++) satirGoster(ad, i);
                s.Gizle = r + 2 <= t.SonVeri ? new[] { r + 2, t.SonVeri } : null;
            };
            Func<Eleman, bool> direkMi = e => Regex.IsMatch(Ust(e.Tur), "DIREK|DIREGI");
            var ucNoOnbellek = new Dictionary<Hat, string>();
            Func<Hat, string> ucNo = h =>
            {
                string v;
                if (ucNoOnbellek.TryGetValue(h, out v)) return v;
                var k = h.Kose;
                var b = k.Count > 0 ? YakinEleman(p, k[0]) : null; var s = k.Count > 0 ? YakinEleman(p, k[k.Count - 1]) : null;
                v = (b != null ? Str(b.GisId) : "?") + "-" + (s != null ? Str(s.GisId) : "?");
                ucNoOnbellek[h] = v;
                return v;
            };
            Func<Hat, bool> havaiMi = h => { var t = Ust(h.Tur); return !t.Contains("YERALTI") && Regex.IsMatch(t, "HAVAI|MUSTEREK|AYDINLATMA|REKORTMAN|ABONE|ENH"); };
            Func<Hat, bool> yeraltiMi = h => Ust(h.Tur).Contains("YERALTI");
            Func<Kalem, bool> hatKablosuMu = k => k.Ana || Regex.IsMatch(Ust(k.Cins), "ILETKEN|KABLO|ALPEK|REKORTMAN|AYDINLATMA");
            Func<Kalem, Eleman, string> kalemBlok = (k, e) => Blok(Str(k.Durum).Length > 0 ? k.Durum : (e != null ? e.Durum : ""));

            // ======================= DİREK METRAJI
            var D = sablon.Direk;
            if (D != null)
            {
                var ad = D.Ad;
                string bAl;
                if (D.Baslik.TryGetValue("il", out bAl) && !string.IsNullOrEmpty(a.Il)) baslikYaz(ad, bAl, a.Il);
                if (D.Baslik.TryGetValue("ilce", out bAl) && !string.IsNullOrEmpty(a.Ilce)) baslikYaz(ad, bAl, a.Ilce);
                if (D.Baslik.TryGetValue("grupNo", out bAl) && bolge != null) baslikYaz(ad, bAl, Str(bolge.Grup).Length > 0 ? bolge.Grup : Str(bolge.Kod));
                if (D.Baslik.TryGetValue("isinAdi", out bAl)) baslikYaz(ad, bAl, bolge != null ? Str(bolge.Ad) : Str(p.Ad));
                if (D.Baslik.TryGetValue("projeNo", out bAl) && bolge != null) baslikYaz(ad, bAl, Str(bolge.Kod));
                if (D.Baslik.TryGetValue("yuklenici", out bAl) && !string.IsNullOrEmpty(a.Firma)) baslikYaz(ad, bAl, a.Firma);
                if (D.Baslik.TryGetValue("hakedisNo", out bAl)) baslikYaz(ad, bAl, hakedisNo);
                var sira = new List<Eleman>();
                foreach (var e in elemanlar) if ((direkMi(e) || e.Kalemler.Count > 0) && Blok(e.Durum) != null) sira.Add(e);
                KararliSirala(sira, (x, y) => DogalSira(x.GisId, y.GisId));
                int kapasite = D.SonVeri - D.IlkVeri + 1;
                // Her eleman kendi hedef sayfasına: temsil edilmeyen cinsten direk kopya sayfaya (ilk görüldüğü sırayla açılır)
                var hedefSira = new List<Hedef> { hedefBul(ad) };   // hedefler yazılış sırasıyla (ana sayfa her zaman ilk)
                var satirlar = new Dictionary<string, int>(StringComparer.Ordinal) { { ad, D.IlkVeri } };
                Func<Eleman, Hedef> hedefi = e =>
                {
                    Kalem ana0 = null; foreach (var k in e.Kalemler) if (k.Ana) { ana0 = k; break; }
                    var tip0 = Str(e.Tip).Length > 0 ? e.Tip : (ana0 != null ? Str(ana0.Tanim) : "");
                    if (!direkMi(e)) return hedefBul(ad);
                    var aile = Aile(e.Cins, tip0);
                    return cinsTemsilEdiliyor(aile) ? hedefBul(ad) : kopyaSayfa("direk", aile);
                };
                foreach (var e in sira) { var h = hedefi(e); if (!satirlar.ContainsKey(h.Sayfa)) { satirlar[h.Sayfa] = D.IlkVeri; hedefSira.Add(h); } }
                foreach (var h in hedefSira)
                {
                    int sayi = 0; foreach (var e in sira) if (hedefi(e).Sayfa == h.Sayfa) sayi++;
                    if (sayi > kapasite) throw new InvalidOperationException("Şablonun " + h.Sayfa + " sayfası " + kapasite + " satır alır; projede " + sayi + " eleman var. Projeyi bölgelere bölün.");
                }
                foreach (var e in sira)
                {
                    var h = hedefi(e); var hs = h.Sayfa;
                    int r = satirlar[hs];
                    var blok = Blok(e.Durum); bool direk = direkMi(e);
                    var no = Str(e.GisId);
                    satirGoster(hs, r);
                    yaz(hs, D.S("no") + r, no);
                    Kalem ana = null; foreach (var k in e.Kalemler) if (k.Ana) { ana = k; break; }
                    if (direk)
                    {
                        var tip = Str(e.Tip).Length > 0 ? e.Tip : (ana != null ? Str(ana.Tanim) : "");
                        string anaCins = ana != null ? ana.Cins : e.Cins, anaTanim = ana != null ? ana.Tanim : tip;
                        if (blok == "MEVCUT") yaz(hs, D.S("mevcut") + r, tip);
                        else
                        {
                            string harf = "";
                            if (blok == "D")
                            {
                                var dm = Ust(ana != null && Str(ana.DmDurum).Length > 0 ? ana.DmDurum : e.DmDurum);
                                harf = dm.StartsWith("S") ? "S" : "K";
                                if (dm.Length == 0) uyarilar.Add(no + ": demontaj direğin kesik / sökük bilgisi yok; \"Kesik\" sayıldı.");
                            }
                            var e2 = esl(anaCins, anaTanim);
                            var adaylar = new List<string> { Norm(tip) };
                            if (e2 != null && e2.Metin("tip").Length > 0) adaylar.Add(Norm(e2.Metin("tip")));
                            MetrajSablonu.Sutun s = null;
                            foreach (var x in h.Sutunlar) if (x.Blok == blok && x.Tip != null && adaylar.Contains(Norm(x.Tip)) && (blok != "D" || Norm(x.Temin).StartsWith(harf))) { s = x; break; }
                            var tipYazisi = s != null ? Str(s.Tip) : (e2 != null && e2.Metin("tip").Length > 0 ? e2.Metin("tip") : tip);
                            if (s != null) { if (!s.Yeni) ozet["eslesen"]++; }
                            else
                            {
                                var cinsUst = Str(e.Cins).ToUpperInvariant();
                                var cAd = Str(cinsAdi(Str(e.Cins)));
                                if (cAd.Length == 0) cAd = Regex.IsMatch(cinsUst, "AĞAÇ|AGAC") ? "Ağaç Direk" : cinsUst.Contains("BETON") ? "Beton Direk" : "Demir Direk";
                                var bilgi = new MetrajPlani.YeniSutun
                                {
                                    Tip = tipYazisi, Poz = pozYap(anaCins, anaTanim, blok),
                                    Ad = tipYazisi + " " + Regex.Replace(cAd, @"^(AG|OG|ENH|MÜŞTEREK|Müşterek)\s+", "", RegexOptions.IgnoreCase),
                                    Temin = blok == "D" ? (harf == "S" ? "Sökük" : "Kesik") : blok == "DM" ? "Sökük" : temin(anaCins, anaTanim, "Y"), Birim = "ad.",
                                    GrupAdi = Regex.Replace(Buyuk(cAd), @"\s+DİRE(K|Ğİ)$", "") + " DİREKLER",
                                    VeriFormulu = true, KaynakCins = Str(e.Cins), KaynakTanim = tip
                                };
                                var y = yeniSutun(h, blok, "TIP|" + Norm(tipYazisi) + (blok == "D" ? "|" + harf : ""), bilgi);
                                if (y == null) { fazlaya("direk", blok, "TIP|" + Norm(tipYazisi), bilgi, 1, no); uyarilar.Add(no + ": direk tipi \"" + tip + "\" için sütun açılamadı."); }
                                // kopya sayfanın tipleri KATSAYILAR listelerine (listeler yalnız ana sayfadan formülle dolar)
                                else if (h.Kaynak != null) listeyeEkle(blok == "Y" ? "yeniDirek" : blok == "D" ? "demontaj" : "dmontaj", blok == "D" ? tipYazisi + " (" + harf + ")" : tipYazisi);
                            }
                            var secim = blok == "D" ? tipYazisi + " (" + harf + ")" : tipYazisi;
                            yaz(hs, (blok == "Y" ? D.S("yeni") : blok == "D" ? D.S("demontaj") : D.S("dmm")) + r, secim);
                        }
                    }
                    // malzemeler: her kalem kendi durumuyla (mevcut direğe yeni armatür gibi)
                    var yazilan = new HashSet<int>();
                    foreach (var k in e.Kalemler)
                    {
                        if (k.Ana && direk) continue;
                        var kb = kalemBlok(k, e);
                        if (kb == null || kb == "MEVCUT") continue;
                        int s = malzemeYaz(h, kb, k, r, no);
                        if (s > 0) yazilan.Add(s);
                    }
                    // programın sayısı olmayan formüllü malzeme sütunları (direk tipi sütunları hariç) → 0 (programın malzemesi esas)
                    foreach (var x in h.Sutunlar) if (x.Tip == null && x.Formullu && !x.Yeni && !yazilan.Contains(x.SutunNo)) sayfa(hs).Hucreler[XlsmDosyasi.SutunHarfi(x.SutunNo) + r] = 0.0;
                    satirlar[hs] = r + 1;
                    ozet["eleman"]++;
                }
                foreach (var h in hedefSira) bitir(h.Sayfa, D, satirlar[h.Sayfa]);
            }

            // ======================= İLETKEN METRAJI
            var I_ = sablon.Iletken;
            if (I_ != null)
            {
                var ad = I_.Ad;
                int kapasite = I_.SonVeri - I_.IlkVeri + 1;
                int r = I_.IlkVeri; bool doldu = false;
                var parcalar = new List<Hat>();
                foreach (var h in hatlar) { if (!havaiMi(h)) continue; var b2 = Blok(h.Durum); if (b2 != null && b2 != "MEVCUT") parcalar.Add(h); }
                KararliSirala(parcalar, (x, y) => { int c = DogalSira(ucNo(x), ucNo(y)); return c != 0 ? c : DogalSira(x.Id, y.Id); });
                Func<string, string, double, bool, string, double, double, string> telKodu = (blok, telAdi, kgM, og, kim, adet, metraj) =>
                {
                    var n = Norm(telAdi);
                    foreach (var x in I_.Sutunlar) if (x.Blok == blok && x.Birim.StartsWith("kg", StringComparison.OrdinalIgnoreCase) && IlkSozcuk(x.Ad) == n) { ozet["eslesen"]++; return Str(x.Tip); }
                    var pozKok = og ? "9.3.1" : "9.2.1";
                    var bilgi = new MetrajPlani.YeniSutun
                    {
                        Tip = telAdi, Poz = Poz(pozKok, blok), Ad = telAdi + (kgM > 0 ? " (" + XlsmSayfa.SayiYazisi(SayiCoz.Temiz(kgM * 1000, 2)) + " Kg/Km)" : ""),
                        Temin = blok == "Y" ? "Ş" : "", Birim = "kg", GrupAdi = "İLETKENLER", VeriFormulu = true, KaynakCins = og ? "OG_İLETKEN" : "AG_İLETKEN", KaynakTanim = telAdi
                    };
                    var y = yeniSutun(hedefBul(ad), blok, "TEL|" + n, bilgi);
                    if (y == null) { fazlaya("iletken", blok, "TEL|" + n, bilgi, SayiCoz.Temiz(metraj * adet * kgM, 3), kim); uyarilar.Add(kim + ": iletken \"" + telAdi + "\" için sütun açılamadı."); return null; }
                    if (blok != "Y")
                    {
                        bool var_ = false; foreach (var x in I_.Sutunlar) if (x.Blok == "Y" && x.Tip != null && Norm(x.Tip) == n) { var_ = true; break; }
                        if (!var_) listeyeEkle("imIletken", telAdi);
                    }
                    return telAdi;
                };
                Func<string, Kalem, string, double, double, string> kabloTipi = (blok, k, kim, adet, metraj) =>
                {
                    var kok = IlkSozcuk(k.Tanim); var tanim = Norm(k.Tanim); var e = esl(k.Cins, k.Tanim);
                    var adaylar = new List<string> { tanim }; if (e != null && e.Metin("tip").Length > 0) adaylar.Add(Norm(e.Metin("tip")));
                    MetrajSablonu.Sutun s = null;
                    foreach (var x in I_.Sutunlar) if (x.Blok == blok && x.Tip != null && adaylar.Contains(Norm(x.Tip))) { s = x; break; }
                    if (s == null && Regex.IsMatch(tanim, "ALPEK|AER")) foreach (var x in I_.Sutunlar) if (x.Blok == blok && x.Tip != null && Norm(x.Tip).Contains("AER") && IlkSozcuk(x.Tip) == kok) { s = x; break; }
                    if (s != null) { ozet["eslesen"]++; return Str(s.Tip); }
                    var adi = e != null && e.Metin("tip").Length > 0 ? e.Metin("tip") : (tanim.Contains("ALPEK") ? kok.ToLowerInvariant() + " AER Kablo" : Str(k.Tanim));
                    var pz = pozYap(k.Cins, k.Tanim, blok);
                    var bilgi = new MetrajPlani.YeniSutun { Tip = adi, Poz = pz.Length > 0 ? pz : Poz("9.5.1", blok), Ad = adi, Temin = temin(k.Cins, k.Tanim, blok), Birim = "mt.", GrupAdi = "KABLOLAR", VeriFormulu = true, KaynakCins = Str(k.Cins), KaynakTanim = Str(k.Tanim) };
                    var y = yeniSutun(hedefBul(ad), blok, "KABLO|" + Norm(adi), bilgi);
                    if (y == null) { fazlaya("iletken", blok, "KABLO|" + Norm(adi), bilgi, SayiCoz.Temiz(metraj * adet, 3), kim); uyarilar.Add(kim + ": \"" + k.Tanim + "\" için sütun açılamadı."); return null; }
                    if (blok != "Y")
                    {
                        bool var_ = false; foreach (var x in I_.Sutunlar) if (x.Blok == "Y" && x.Tip != null && Norm(x.Tip) == Norm(adi)) { var_ = true; break; }
                        if (!var_) listeyeEkle("imAer", adi);
                    }
                    return adi;
                };
                foreach (var h in parcalar)
                {
                    var hb = Blok(h.Durum); var kim = ucNo(h);
                    var bloklar = hb == "DM" ? new[] { "D", "A" } : new[] { hb };
                    Kalem ana = null; foreach (var k in h.Kalemler) if (k.Ana) { ana = k; break; }
                    double metraj = SayiCoz.Temiz(ana != null && ana.Miktar != 0 ? ana.Miktar : h.CizimUzunlugu, 2);
                    foreach (var blok in bloklar)
                    {
                        if (r > I_.SonVeri) { if (!doldu) uyarilar.Add(ad + " " + kapasite + " satır alır; kalan açıklıklar yazılmadı."); doldu = true; break; }
                        satirGoster(ad, r);
                        yaz(ad, I_.S("direkler") + r, kim);
                        yaz(ad, I_.S("aramesafe") + r, metraj);
                        yaz(ad, I_.S("durum") + r, DurumYazisi[blok]);
                        int agSira = 0;
                        foreach (var k in h.Kalemler)
                        {
                            var c = Ust(k.Cins);
                            if (c == "AG_ILETKEN" || c == "OG_ILETKEN")
                            {
                                bool og = c == "OG_ILETKEN";
                                int[] acilim;
                                var adlar = og ? kat.OgIletkenAdlari : kat.AgIletkenAdlari; var agirlik = og ? kat.OgIletkenAgirlik : kat.AgIletkenAgirlik;
                                if (!(og ? kat.OgIletkenAcilim : kat.AgIletkenAcilim).TryGetValue(Str(k.Tanim).Trim(), out acilim)) { uyarilar.Add(kim + ": iletken tertibi \"" + k.Tanim + "\" açılamadı."); ozet["atlanan"]++; continue; }
                                var teller = new List<int>();
                                for (int i = 0; i < adlar.Length; i++) if (i < acilim.Length && acilim[i] > 0) teller.Add(i);
                                if (og)
                                {
                                    if (teller.Count > 1) uyarilar.Add(kim + ": OG tertibinde birden çok tel türü; ilki yazıldı.");
                                    if (teller.Count > 0)
                                    {
                                        int t0 = teller[0];
                                        var kodu = telKodu(blok, adlar[t0], agirlik[t0], true, kim, acilim[t0], metraj);
                                        yaz(ad, I_.Og[0] + r, (double)acilim[t0]);
                                        if (kodu != null) yaz(ad, I_.Og[1] + r, kodu);
                                    }
                                }
                                else
                                {
                                    foreach (var ti in teller)
                                    {
                                        if (agSira >= I_.Ag.Count) { uyarilar.Add(kim + ": AG tertibinde " + I_.Ag.Count + "'ten çok tel türü; \"" + adlar[ti] + "\" yazılamadı."); ozet["atlanan"]++; break; }
                                        var kodu = telKodu(blok, adlar[ti], agirlik[ti], false, kim, acilim[ti], metraj);
                                        yaz(ad, I_.Ag[agSira][0] + r, (double)acilim[ti]);
                                        if (kodu != null) yaz(ad, I_.Ag[agSira][1] + r, kodu);
                                        agSira++;
                                    }
                                }
                            }
                            else if (hatKablosuMu(k))
                            {
                                var demet = Regex.Match(Norm(k.Tanim), @"^(\d+)\(");
                                double adet = demet.Success ? double.Parse(demet.Groups[1].Value, CultureInfo.InvariantCulture) : 1.0;
                                var tipi = kabloTipi(blok, k, kim, adet, metraj);
                                yaz(ad, I_.Aer[0] + r, adet);
                                if (tipi != null) yaz(ad, I_.Aer[1] + r, tipi);
                            }
                            else
                            {
                                uyarilar.Add(kim + ": hat malzemesi \"" + k.Tanim + "\" " + ad + " sayfasına yazılamaz; atlandı.");
                                ozet["atlanan"]++;
                            }
                        }
                        r++;
                        ozet["iletkenSatiri"]++;
                    }
                }
                bitir(ad, I_, r);
            }

            // ======================= YERALTI METRAJI
            var Yt = sablon.Yeralti;
            if (Yt != null)
            {
                var ad = Yt.Ad;
                int r = Yt.IlkVeri;
                int kapasite = Yt.SonVeri - Yt.IlkVeri + 1;
                Func<string, bool> satirAl = kim => { if (r > Yt.SonVeri) { uyarilar.Add(ad + " " + kapasite + " satır alır; \"" + kim + "\" yazılmadı."); return false; } satirGoster(ad, r); return true; };
                Func<Hat, List<Eleman>> ucEleman = h =>
                {
                    var l = new List<Eleman>(); var k = h.Kose;
                    var b = k.Count > 0 ? YakinEleman(p, k[0]) : null; var s = k.Count > 0 ? YakinEleman(p, k[k.Count - 1]) : null;
                    if (b != null) l.Add(b); if (s != null) l.Add(s);
                    return l;
                };
                Action<List<Eleman>> cinsYaz = eler =>
                {
                    foreach (var e in eler)
                    {
                        var tur = Ust(e.Tur);
                        if (Regex.IsMatch(tur, "BOX|PANO|SDK")) { if (Yt.S("box") != null) { yaz(ad, Yt.S("box") + r, Str(e.Tip)); listeyeEkle("box", Str(e.Tip)); } }
                        else if (tur.Contains("AYD")) { if (Yt.S("aydDirek") != null) yaz(ad, Yt.S("aydDirek") + r, Str(e.Tip)); }
                        else if (Ust(e.Cins).Contains("BETON")) { if (Yt.S("betonDirek") != null) yaz(ad, Yt.S("betonDirek") + r, Str(e.Tip)); }
                        else if (Regex.IsMatch(tur, "DIREK|DIREGI")) { if (Yt.S("direkCinsi") != null) yaz(ad, Yt.S("direkCinsi") + r, Str(e.Tip)); }
                    }
                };
                var kanalSira = new List<Kanal>();
                foreach (var k in kanallar) { var b2 = Blok(k.Durum); if (b2 != null && b2 != "MEVCUT") kanalSira.Add(k); }
                KararliSirala(kanalSira, (x, y) => { int c = DogalSira(Str(x.BasNo) + "-" + Str(x.BitNo), Str(y.BasNo) + "-" + Str(y.BitNo)); return c != 0 ? c : DogalSira(x.Id, y.Id); });
                foreach (var k in kanalSira)
                {
                    var blok = Blok(k.Durum);
                    var kim = (Str(k.BasNo).Length > 0 ? k.BasNo : "?") + "-" + (Str(k.BitNo).Length > 0 ? k.BitNo : "?");
                    if (!satirAl(kim)) break;
                    Kalem ana = null; foreach (var x in k.Kalemler) if (x.Ana) { ana = x; break; }
                    var zeminAdi = Str(k.Zemin).Length > 0 ? k.Zemin : (ana != null ? Str(ana.Tanim) : "");
                    var z = KanalZemini.Coz(zeminAdi) ?? new KanalZemini();
                    yaz(ad, Yt.S("no") + r, kim);
                    yaz(ad, Yt.S("aramesafe") + r, SayiCoz.Temiz(k.CizimUzunlugu, 2));
                    if (Yt.S("tertip") != null) yaz(ad, Yt.S("tertip") + r, "Kanal " + Regex.Replace(KanalKodu.Kablolar(k.Kod), "^/", ""));
                    if (Yt.S("taban") != null) yaz(ad, Yt.S("taban") + r, SayiCoz.Temiz(k.AltGenislik, 1));
                    if (Yt.S("tavan") != null) yaz(ad, Yt.S("tavan") + r, SayiCoz.Temiz(k.UstGenislik, 1));
                    if (Yt.S("derinlik") != null) yaz(ad, Yt.S("derinlik") + r, SayiCoz.Temiz(k.Derinlik, 1));
                    if (Yt.S("dolgu") != null) yaz(ad, Yt.S("dolgu") + r, zeminAdi);
                    if (Yt.S("kaplama") != null && z.Kaplama.Length > 0) yaz(ad, Yt.S("kaplama") + r, z.Kaplama);
                    double hacim = SayiCoz.Temiz(ana != null && ana.Toplam != 0 ? ana.Toplam : Metraj.KanalHacmi(k.AltGenislik, k.UstGenislik, k.Derinlik, k.CizimUzunlugu), 3);
                    if (Yt.S("toplamM3") != null) yaz(ad, Yt.S("toplamM3") + r, hacim);
                    bool ozel = KanalZemini.OzelMi(z.Cins);
                    var dolgu = z.Cins == KanalZemini.Tuvenan ? "TUVANEN" : z.Cins == KanalZemini.Micir ? "MICIR" : "TOPRAK";
                    var kaplama = z.Kaplama.Length > 0 ? z.Kaplama : "KAPLAMASIZ";
                    MetrajSablonu.Sutun s = null;
                    if (!ozel)
                        foreach (var x in Yt.Sutunlar)
                        {
                            var n = Norm(x.Ad);
                            if (x.Blok == blok && x.Birim.StartsWith("m3", StringComparison.OrdinalIgnoreCase) && n.Contains(kaplama) && n.Contains(dolgu) && z.Bariyerli == n.Contains("BARIYER") && z.Trencher == n.Contains("TRENCHER")) { s = x; break; }
                        }
                    if (s != null) { ozet["eslesen"]++; yaz(ad, XlsmDosyasi.SutunHarfi(s.SutunNo) + r, hacim); }
                    else
                    {
                        string kCins = ana != null ? ana.Cins : "KABLO_KANALI", kTanim = ana != null ? ana.Tanim : zeminAdi;
                        var kaplamaAdi = kaplama == "KAPLAMASIZ" ? "" : kaplama.Substring(0, 1) + kaplama.Substring(1).ToLowerInvariant() + " Kaplamalı ";
                        var dolguAdi = dolgu == "TOPRAK" ? "Toprak" : dolgu == "MICIR" ? "Mıcır Dolgulu" : "Tuvanen Dolgulu";
                        var adi = ozel ? (z.Cins == KanalZemini.Bransman ? "Branşman Kablo Kanalı Yapılması" : "Kablo Demontaj Kanalı Açılması")
                            : kaplamaAdi + dolguAdi + " Kablo Kanalı Yapılması" + (kaplama == "KAPLAMASIZ" ? " - Kaplamasız" : "") + (z.Bariyerli ? " (Bariyerli)" : "") + (z.Trencher ? " (Trencher)" : "");
                        var pz = pozYap(kCins, kTanim, blok);
                        var bilgi = new MetrajPlani.YeniSutun { Poz = pz.Length > 0 ? pz : Poz("32.12.1", blok), Ad = adi, Temin = blok == "Y" ? "Y" : "", Birim = "m3", GrupAdi = "KANALLAR", KaynakCins = Str(kCins), KaynakTanim = Str(kTanim) };
                        var anahtar = "KANAL|" + Norm(adi);
                        var y = yeniSutun(hedefBul(ad), blok, anahtar, bilgi);
                        if (y != null) yaz(ad, XlsmDosyasi.SutunHarfi(y.SutunNo) + r, hacim);
                        else { fazlaya("yeralti", blok, anahtar, bilgi, hacim, kim); uyarilar.Add(kim + ": kanal türü \"" + adi + "\" için sütun açılamadı."); }
                    }
                    foreach (var x in k.Kalemler)
                    {
                        if (x.Ana) continue;
                        var kb = Blok(Str(x.Durum).Length > 0 ? x.Durum : k.Durum);
                        if (kb == null || kb == "MEVCUT") continue;
                        malzemeYaz(hedefBul(ad), kb, x, r, kim);
                    }
                    r++;
                    ozet["yeraltiSatiri"]++;
                }
                var kablolar = new List<Hat>();
                foreach (var h in hatlar) { if (!yeraltiMi(h)) continue; var b2 = Blok(h.Durum); if (b2 != null && b2 != "MEVCUT") kablolar.Add(h); }
                KararliSirala(kablolar, (x, y) => { int c = DogalSira(ucNo(x), ucNo(y)); return c != 0 ? c : DogalSira(x.Id, y.Id); });
                var kanalCizgileri = new List<IList<double[]>>(); foreach (var k in kanallar) kanalCizgileri.Add(k.Kose);
                foreach (var h in kablolar)
                {
                    var blok = Blok(h.Durum); var kim = ucNo(h);
                    if (!satirAl(kim)) break;
                    yaz(ad, Yt.S("no") + r, kim);
                    yaz(ad, Yt.S("aramesafe") + r, SayiCoz.Temiz(h.CizimUzunlugu, 2));
                    Kalem kalem = null;
                    foreach (var x in h.Kalemler) if (x.Ana) { kalem = x; break; }
                    if (kalem == null) foreach (var x in h.Kalemler) if (hatKablosuMu(x)) { kalem = x; break; }
                    if (Yt.S("tertip") != null) yaz(ad, Yt.S("tertip") + r, kalem != null ? Str(kalem.Tanim) : Str(h.AnaKesit));
                    cinsYaz(ucEleman(h));
                    if (kalem != null)
                    {
                        double metraj = SayiCoz.Temiz(kalem.Miktar != 0 ? kalem.Miktar : h.CizimUzunlugu, 2);
                        double cizim = h.CizimUzunlugu;
                        double kanalUstu = KanalUstu(h.Kose, kanalCizgileri);
                        double kanalIcin = cizim > 0 ? SayiCoz.Temiz(metraj * Math.Min(1, kanalUstu / cizim), 2) : 0;
                        double direkIcin = SayiCoz.Temiz(metraj - kanalIcin, 2);
                        var kb = Blok(Str(kalem.Durum).Length > 0 ? kalem.Durum : h.Durum) ?? blok;
                        var tanim = Norm(kalem.Tanim); var e = esl(kalem.Cins, kalem.Tanim);
                        var adlar = new List<string>(); if (e != null && e.Dizi("adlar") != null) foreach (var x in e.Dizi("adlar")) adlar.Add(Norm(x as string));
                        var ustCins = Ust(kalem.Cins);
                        bool alm = Regex.IsMatch(tanim, @"ALM|ALUMINYUM|NAYY|\bAL\b") || Regex.IsMatch(ustCins, "ALÜMINYUM|_ALM");
                        bool cu = (Regex.IsMatch(tanim, @"\bCU\b|BAKIR|NYY(?!.*NAYY)") && !alm) || ustCins.Contains("BAKIR");
                        Func<string, bool> uyumlu = adN => { var t = Regex.Replace(adN, @"\(.*$", ""); bool tAlm = Regex.IsMatch(t, "NAYY|ALM|ALUMINYUM"), tCu = Regex.IsMatch(t, @"\bNYY\b|\bCU\b|BAKIR") && !tAlm; return !((alm && tCu) || (cu && tAlm)); };
                        Func<string, string> yeri = adN => Regex.IsMatch(adN, @"\(KANAL IÇIN\)") ? "KANAL" : Regex.IsMatch(adN, @"\((DIREK|BOX) IÇIN\)") ? "DIREK" : "";
                        Func<string, string> govde = adN => Regex.Replace(adN, @"\s*\((DIREK|KANAL|BOX) IÇIN\)\s*$", "");
                        var nereler = new[] { new object[] { "KANAL", kanalIcin, "KANAL İÇİN" }, new object[] { "DIREK", direkIcin, "DİREK İÇİN" } };
                        foreach (var ne in nereler)
                        {
                            var nerede = (string)ne[0]; double m = (double)ne[1]; var ek = (string)ne[2];
                            if (!(m > 0)) continue;
                            var aday = new List<MetrajSablonu.Sutun>(); foreach (var x in Yt.Sutunlar) if (x.Blok == kb && yeri(Norm(x.Ad)) == nerede) aday.Add(x);
                            MetrajSablonu.Sutun s = null;
                            foreach (var x in aday) if (govde(Norm(x.Ad)) == tanim) { s = x; break; }
                            if (s == null) foreach (var x in aday) if (adlar.Contains(govde(Norm(x.Ad)))) { s = x; break; }
                            if (s == null) foreach (var x in aday) if (govde(Norm(x.Ad)).StartsWith(tanim + " ", StringComparison.Ordinal)) { s = x; break; }
                            if (s == null) foreach (var x in aday) if (IlkSozcuk(x.Ad) == IlkSozcuk(tanim) && uyumlu(Norm(x.Ad))) { s = x; break; }
                            if (s != null) { ozet["eslesen"]++; yaz(ad, XlsmDosyasi.SutunHarfi(s.SutunNo) + r, m); continue; }
                            var adi = (e != null && e.Dizi("adlar") != null && e.Dizi("adlar").Count > 0 ? (string)e.Dizi("adlar")[0] : Str(kalem.Tanim)) + " (" + ek + ")";
                            var pz = pozYap(kalem.Cins, kalem.Tanim, kb);
                            var bilgi = new MetrajPlani.YeniSutun { Poz = pz.Length > 0 ? pz : Poz(nerede == "KANAL" ? "32.16" : "32.12", kb), Ad = adi, Temin = temin(kalem.Cins, kalem.Tanim, kb), Birim = "mt.", GrupAdi = "KABLOLAR", KaynakCins = Str(kalem.Cins), KaynakTanim = Str(kalem.Tanim) };
                            var anahtar = "KABLO|" + tanim + "|" + nerede;
                            var y = yeniSutun(hedefBul(ad), kb, anahtar, bilgi);
                            if (y != null) yaz(ad, XlsmDosyasi.SutunHarfi(y.SutunNo) + r, m);
                            else { fazlaya("yeralti", kb, anahtar, bilgi, m, kim); uyarilar.Add(kim + ": \"" + kalem.Tanim + "\" için sütun açılamadı."); }
                        }
                    }
                    foreach (var x in h.Kalemler)
                    {
                        if (ReferenceEquals(x, kalem) || x.Ana) continue;
                        var kb = Blok(Str(x.Durum).Length > 0 ? x.Durum : h.Durum);
                        if (kb == null || kb == "MEVCUT") continue;
                        malzemeYaz(hedefBul(ad), kb, x, r, kim);
                    }
                    r++;
                    ozet["yeraltiSatiri"]++;
                }
                bitir(ad, Yt, r);
            }

            // ======================= MALZ. LİSTESİ: yeni sütunlar normal satır olarak (EK KALEMLER bölümünün yerine; kullanıcı kararı)
            var M = sablon.MalzListesi;
            if (M != null && plan.YeniSutunlar.Count > 0)
            {
                var ekler = M.EkSatirlari;
                int r = M.EkBaslikSatiri ?? (ekler.Count > 0 ? ekler[0].Satir : 0);
                if (r == 0) uyarilar.Add(M.Sayfa + ": EK KALEMLER bölümü yok; yeni sütunlar listeye yazılamadı.");
                else
                {
                    // eski EK satırları temizlenir (KOD "E001"… ve miktar); bölüm başlığı satırının yazısı yeni başlıkla değişir
                    foreach (var e in ekler) { sil(M.Sayfa, M.KodSutunu + e.Satir); sil(M.Sayfa, M.MiktarSutunu + e.Satir); }
                    // bölüm sırası: DİREK METRAJI, DİREK kopyaları, İLETKEN, YERALTI
                    var sirali = new List<Hedef>(hedefler);
                    KararliSirala(sirali, (x, y) =>
                    {
                        int c = Array.IndexOf(SayfaSirasi, x.Hangi).CompareTo(Array.IndexOf(SayfaSirasi, y.Hangi)); if (c != 0) return c;
                        c = (x.Kaynak != null ? 1 : 0).CompareTo(y.Kaynak != null ? 1 : 0); if (c != 0) return c;
                        return hedefler.IndexOf(x).CompareTo(hedefler.IndexOf(y));
                    });
                    var F = Str(M.ToplamSutunu).Length > 0 ? M.ToplamSutunu : "F";
                    var A = Str(M.BayrakSutunu).Length > 0 ? M.BayrakSutunu : "A";
                    foreach (var h in sirali)
                    {
                        var sutunlar = new List<MetrajPlani.YeniSutun>(); foreach (var y in plan.YeniSutunlar) if (y.Sayfa == h.Sayfa) sutunlar.Add(y);
                        if (sutunlar.Count == 0) continue;
                        KararliSirala(sutunlar, (x, y) => x.SutunNo.CompareTo(y.SutunNo));
                        var t = h.Tanim; var ON = t.Onek;
                        // ad: ana sayfada tanımlı ad (DM_KOD_SATIRI), kopyada aynı aralık kopya sayfasında ('DİREK AG BETON'!$G$10:$ZZ$10)
                        Func<string, string> aralik = anahtar => { string v; return h.Kaynak != null ? SayfaRef(h.Sayfa) + "!" + (t.Adlar.TryGetValue(anahtar, out v) ? v : null) : ON + "_" + anahtar + "_SATIRI"; };
                        var mh = sayfa(M.Sayfa).Hucreler;
                        mh[A + r] = "=IF(COUNTIF(" + F + (r + 1) + ":" + F + (r + sutunlar.Count) + ",\">0\")>0,1,0)";
                        mh[M.PozSutunu + r] = h.Sayfa;
                        foreach (var c in new[] { M.AdSutunu, M.BirimSutunu, M.TeminSutunu, F, M.KodSutunu, M.MiktarSutunu, M.KaynakSutunu }) sil(M.Sayfa, c + r);
                        plan.MalzSatirlari.Add(new MetrajPlani.MalzSatiri { Satir = r, Tur = "grup", Sayfa = h.Sayfa });
                        r++;
                        foreach (var y in sutunlar)
                        {
                            var I = "$" + M.KaynakSutunu + r;
                            mh[A + r] = "=IF(" + F + r + ">0,1,0)";
                            mh[M.KodSutunu + r] = y.Kod;
                            mh[M.PozSutunu + r] = "=IF(" + I + "=\"\",\"\",INDEX(" + aralik("POZ") + "," + I + ")&\"\")";
                            mh[M.AdSutunu + r] = "=IF(" + I + "=\"\",\"\",TRIM(INDEX(" + aralik("AD") + "," + I + ")&IFERROR(VLOOKUP(INDEX(" + aralik("SEC") + "," + I + "),SECIM_EK,2,FALSE),\"\")))";
                            mh[M.BirimSutunu + r] = "=IF(" + I + "=\"\",\"\",INDEX(" + aralik("BIRIM") + "," + I + ")&\"\")";
                            mh[M.TeminSutunu + r] = y.Blok == "Y" ? "=IF(" + I + "=\"\",\"\",INDEX(" + aralik("SEC") + "," + I + ")&\"\")" : "Y";
                            // miktar: İLETKEN'de "MALZ. LİSTESİNE AKTARILAN" satırı (DM: hurda = demontaj − aktarım), ötekilerde TOPLAM satırı
                            mh[M.MiktarSutunu + r] = "=IF(" + I + "=\"\",0,N(INDEX(" + aralik(t.MalzSatiri.HasValue ? "MALZ" : "TOPLAM") + "," + I + ")))";
                            mh[F + r] = "=" + M.MiktarSutunu + r;
                            mh[M.KaynakSutunu + r] = "=IFERROR(MATCH($" + M.KodSutunu + r + "," + aralik("KOD") + ",0),\"\")";
                            plan.MalzSatirlari.Add(new MetrajPlani.MalzSatiri { Satir = r, Tur = "kalem", Sayfa = h.Sayfa, Kod = y.Kod });
                            r++;
                        }
                    }
                }
            }
            ozet["yeniSutun"] = plan.YeniSutunlar.Count;
            ozet["kopyaSayfa"] = plan.KopyaSayfalar.Count;
            ozet["fazla"] = plan.Fazlalar.Count;
            if (plan.Fazlalar.Count > 0) uyarilar.Add(plan.Fazlalar.Count + " malzeme yazılamadı; \"" + FazlaSayfasi + "\" sayfasına yazıldı.");
            return plan;
        }

        /// <summary>Kararlı sıralama (eşitlerde giriş sırası korunur; JavaScript'in sort'u gibi).</summary>
        private static void KararliSirala<T>(List<T> liste, Comparison<T> karsilastir)
        {
            var indeksli = new List<KeyValuePair<int, T>>(liste.Count);
            for (int i = 0; i < liste.Count; i++) indeksli.Add(new KeyValuePair<int, T>(i, liste[i]));
            indeksli.Sort((x, y) => { int c = karsilastir(x.Value, y.Value); return c != 0 ? c : x.Key.CompareTo(y.Key); });
            for (int i = 0; i < liste.Count; i++) liste[i] = indeksli[i].Value;
        }

        /// <summary>Planı dosyaya işler (telefon: birlesik-metraj.js › planUygula).</summary>
        public static void PlanUygula(XlsmDosyasi x, MetrajSablonu sablon, MetrajPlani plan)
        {
            // 0) kopya sayfalar (cins başına DİREK METRAJI kopyası): kaynağın biçimiyle, KOD sütunları boş (yeni sütunlar aşağıda açılır)
            foreach (var k in plan.KopyaSayfalar)
            {
                var t = sablon.Al(k.Hangi);
                if (t == null) continue;
                var s = x.SayfaKopyala(k.Kaynak, k.Ad);
                int sonSatir = Math.Max(t.ToplamSatiri, t.MalzSatiri ?? 0); foreach (var r in t.AltSatirlar) sonSatir = Math.Max(sonSatir, r);
                s.SutunlariBosalt(t.IlkKodSutunu, Math.Min(t.KodSatiri, Math.Min(t.TipSatiri ?? t.KodSatiri, t.DurumSatiri ?? t.KodSatiri)), sonSatir);
            }
            // 1) yeni sütunlar: biçim, genişlik, bayrak / toplam / alt satır formülleri, (gerekirse) veri formülleri — örnek ana sayfada
            foreach (var y in plan.YeniSutunlar)
            {
                var t = sablon.Al(y.Hangi);
                if (t == null || !y.OrnekSutun.HasValue) continue;
                var s = x.Sayfa(Str(y.Sayfa).Length > 0 ? y.Sayfa : t.Ad); var o = x.Sayfa(Str(y.OrnekSayfa).Length > 0 ? y.OrnekSayfa : t.Ad);
                int kaynak = y.OrnekSutun.Value, hedef = y.SutunNo, fark = hedef - kaynak;
                if (ReferenceEquals(o, s)) s.SutunGenisligiKopyala(kaynak, hedef);
                var formulluSatirlar = new List<int>(t.BayrakSatirlari); formulluSatirlar.AddRange(t.AltSatirlar);
                int ustBas = Math.Min(t.KodSatiri, Math.Min(t.TipSatiri ?? t.KodSatiri, t.DurumSatiri ?? t.KodSatiri));
                var satirlar = new List<int>(); for (int r = ustBas; r <= t.BirimSatiri; r++) satirlar.Add(r); satirlar.AddRange(formulluSatirlar);
                foreach (var r in satirlar)
                {
                    s.StilKopyala(XlsmDosyasi.HucreAdi(kaynak, r), XlsmDosyasi.HucreAdi(hedef, r), o);
                    if (formulluSatirlar.Contains(r)) { var f = o.Formul(XlsmDosyasi.HucreAdi(kaynak, r)); if (f != null) s.YazFormul(XlsmDosyasi.HucreAdi(hedef, r), XlsmDosyasi.FormulKaydir(f, 0, fark)); }
                }
                for (int r = t.IlkVeri; r <= t.SonVeri; r++)
                {
                    s.StilKopyala(XlsmDosyasi.HucreAdi(kaynak, r), XlsmDosyasi.HucreAdi(hedef, r), o);
                    if (y.VeriFormulu) { var f = o.Formul(XlsmDosyasi.HucreAdi(kaynak, r)); if (f != null) s.YazFormul(XlsmDosyasi.HucreAdi(hedef, r), XlsmDosyasi.FormulKaydir(f, 0, fark)); }
                }
            }
            // 1b) MALZ. LİSTESİ'ne eklenen satırların biçimi: grup başlığı ve kalem satırı örneklerinden
            var M = sablon.MalzListesi;
            if (M != null)
            {
                var s = x.Sayfa(M.Sayfa); int sonSutun = 0;
                foreach (var c in new[] { M.KodSutunu, M.KaynakSutunu, M.PozSutunu, M.AdSutunu, M.BirimSutunu, M.TeminSutunu, M.MiktarSutunu, Str(M.ToplamSutunu).Length > 0 ? M.ToplamSutunu : "A", Str(M.BayrakSutunu).Length > 0 ? M.BayrakSutunu : "A" })
                    sonSutun = Math.Max(sonSutun, XlsmDosyasi.SutunNo(c));
                foreach (var m in plan.MalzSatirlari)
                {
                    int? ornek = m.Tur == "grup" ? M.GrupOrnekSatiri : (int?)M.KalemOrnekSatiri;
                    if (ornek.HasValue && ornek.Value != 0 && ornek.Value != m.Satir) s.SatirBicimKopyala(ornek.Value, m.Satir, sonSutun);
                }
            }
            // 2) hücreler (null: hücre boşaltılır)
            foreach (var kv in plan.Sayfalar)
            {
                var s = x.Sayfa(kv.Key);
                foreach (var h in kv.Value.Hucreler) s.Yaz(h.Key, h.Value);
                foreach (var r in kv.Value.GosterSatirlar) s.SatirGoster(r);
                if (kv.Value.Gizle != null) for (int r = kv.Value.Gizle[0]; r <= kv.Value.Gizle[1]; r++) s.SatirGizle(r);
            }
            // 3) şablona sığmayan malzemeler
            if (plan.Fazlalar.Count > 0)
            {
                var s = x.SayfaEkle(FazlaSayfasi);
                var bas = new[] { "Sayfa", "Blok", "Poz", "Malzeme", "Birim", "Miktar", "Nerede" };
                for (int i = 0; i < bas.Length; i++) s.YazMetin(XlsmDosyasi.HucreAdi(i + 1, 1), bas[i]);
                for (int i = 0; i < plan.Fazlalar.Count; i++)
                {
                    var f = plan.Fazlalar[i]; int r = i + 2;
                    var sy = sablon.Al(f.Hangi);
                    s.YazMetin(XlsmDosyasi.HucreAdi(1, r), sy != null ? sy.Ad : f.Hangi);
                    s.YazMetin(XlsmDosyasi.HucreAdi(2, r), f.Blok);
                    s.YazMetin(XlsmDosyasi.HucreAdi(3, r), f.Poz ?? "");
                    s.YazMetin(XlsmDosyasi.HucreAdi(4, r), f.Ad);
                    s.YazMetin(XlsmDosyasi.HucreAdi(5, r), f.Birim);
                    s.YazSayi(XlsmDosyasi.HucreAdi(6, r), f.Miktar);
                    s.YazMetin(XlsmDosyasi.HucreAdi(7, r), string.Join(", ", f.Nereler.ToArray()));
                }
            }
        }

        /// <summary>Projeden Birleşik Metraj dosyası üretir: şablon baytları → doldurulmuş dosya baytları.</summary>
        public static byte[] Uret(Proje p, byte[] sablonBytes, Ayar ayar, out MetrajPlani plan, out MetrajSablonu sablon)
        {
            var x = XlsmDosyasi.Ac(sablonBytes);
            sablon = MetrajSablonu.Oku(x);
            plan = Planla(p, sablon, ayar);
            PlanUygula(x, sablon, plan);
            return x.Yaz();
        }
    }
}
