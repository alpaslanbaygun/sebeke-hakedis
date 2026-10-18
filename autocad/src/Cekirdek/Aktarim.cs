using System;
using System.Collections.Generic;
using System.Globalization;

namespace SebekeHakedis.Cekirdek
{
    /// <summary>Telefondan gelen projenin çizime aktarılmasında tek bir iş.</summary>
    public sealed class AktarimAdimi
    {
        /// <summary>"yeni" ya da "guncelle"</summary>
        public string Islem = "";
        /// <summary>bolge, nokta, eleman, hat, kanal, sondaj</summary>
        public string Nesne = "";
        /// <summary>Güncellenecek çizim nesnesinin tanıtıcısı (handle).</summary>
        public string Hedef = "";
        /// <summary>Telefondaki kimlik.</summary>
        public string Kimlik = "";
        /// <summary>Eleman türü (eleman için; çizimde blok yoksa yedek blok seçmek için).</summary>
        public string ElemanTuru = "";
        /// <summary>Çizimde olması gereken hâl ({H} = nesnenin kendi tanıtıcısı).</summary>
        public CadVarlik Varlik;
        /// <summary>Hat etiketi ({H} ile), diğer nesnelerde null.</summary>
        public string Etiket;
        /// <summary>Kullanıcıya gösterilecek kısa ad (ör. "SC12 AG Direk").</summary>
        public string Ad = "";
        /// <summary>Güncellemede ilk fark (bilgi için).</summary>
        public string Fark = "";
        /// <summary>Bu çizimden alınmış ama çizimde artık olmayan nesne (bilgisayarda silinmiş olabilir).</summary>
        public bool CizimdeSilinmis;
    }

    public sealed class AktarimPlani
    {
        public readonly List<AktarimAdimi> Adimlar = new List<AktarimAdimi>();
        /// <summary>Değişmeden kalan nesne sayısı.</summary>
        public int Ayni;
        /// <summary>Telefonda silinmiş görünen çizim nesneleri: tanıtıcı → kısa ad.</summary>
        public readonly Dictionary<string, string> Silinenler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        /// <summary>Onaylı (kilitli) hakedişe dokunduğu için aktarılmayacak işler (bkz. HakedisOnayi).</summary>
        public readonly List<AktarimAdimi> Kilitliler = new List<AktarimAdimi>();
        /// <summary>Telefonda silinmiş görünen ama onaylı hakedişte olduğu için silinmeyecek nesneler: tanıtıcı → kısa ad.</summary>
        public readonly Dictionary<string, string> KilitliSilinenler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public readonly List<string> Uyarilar = new List<string>();
        /// <summary>Çizimdeki tanıtıcıyla eşleşen telefon nesnesi sayısı (proje bu çizimden alınmış mı?).</summary>
        public int TaniticiylaEslesen;
        /// <summary>Daha önce telefondan alınmış (SH_ID) nesnelerle eşleşen sayı.</summary>
        public int KimlikleEslesen;

        public int Sayi(string islem, string nesne = null)
        {
            int n = 0;
            foreach (var a in Adimlar) if (a.Islem == islem && (nesne == null || a.Nesne == nesne)) n++;
            return n;
        }
    }

    /// <summary>
    /// Telefondan gelen proje dosyasını çizimle karşılaştırır ve yapılacak işleri çıkarır (çizime dokunmaz).
    /// Eşleştirme: telefon nesnesinin kimliği çizimdeki bir tanıtıcıysa o nesne; değilse daha önce aynı
    /// kimlikle alınmış nesne (SH_ID); ikisi de yoksa yeni nesne. Karşılaştırma iki tarafın da aynı
    /// yazıcıdan geçmiş hâliyle yapılır; böylece yalnız gerçekten değişen nesneler güncellenir.
    /// </summary>
    public static class Aktarim
    {
        private sealed class Mevcut
        {
            public string Nesne;
            public object Model;
        }

        /// <param name="onaylar">Çizimin hakediş onayları: onaylı hakedişe dokunan işler Kilitliler'e ayrılır (null: kilit yok).</param>
        public static AktarimPlani Planla(IList<CadVarlik> cizim, Proje tel, string onEk, IDictionary<int, int> onaylar = null)
        {
            var plan = new AktarimPlani();
            if (string.IsNullOrEmpty(onEk)) onEk = "SC";
            var cp = NesneOkuyucu.Oku(cizim, "");

            var kimlikten = new Dictionary<string, string>(StringComparer.Ordinal);
            var kimligi = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var v in cizim)
            {
                string k = v.XdIlk(NesneYazici.KimlikUygulamasi);
                if (string.IsNullOrEmpty(k) || string.IsNullOrEmpty(v.H)) continue;
                kimlikten[k] = v.H;
                kimligi[v.H] = k;
            }

            var mevcut = new Dictionary<string, Mevcut>(StringComparer.OrdinalIgnoreCase);
            foreach (var x in cp.Bolgeler) mevcut[x.Id] = new Mevcut { Nesne = "bolge", Model = x };
            foreach (var x in cp.Noktalar) mevcut[x.Id] = new Mevcut { Nesne = "nokta", Model = x };
            foreach (var x in cp.Elemanlar) mevcut[x.Id] = new Mevcut { Nesne = "eleman", Model = x };
            foreach (var x in cp.Hatlar) mevcut[x.Id] = new Mevcut { Nesne = "hat", Model = x };
            foreach (var x in cp.Kanallar) mevcut[x.Id] = new Mevcut { Nesne = "kanal", Model = x };
            foreach (var x in cp.Sondajlar) mevcut[x.Id] = new Mevcut { Nesne = "sondaj", Model = x };

            var eslesen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var gorulen = new HashSet<string>(StringComparer.Ordinal);
            long enBuyukTanitici = -1;

            // Her nesne türü için ortak iş
            Action<string, string, Func<string, string, CadVarlik>, Func<object, string, CadVarlik>, Func<string, string>, string, string, object> isle =
                (nesne, id, telYaz, cizimYaz, telEtiket, ad, elemanTuru, telNesne) =>
            {
                if (!string.IsNullOrEmpty(id) && !gorulen.Add(nesne + "|" + id))
                {
                    plan.Uyarilar.Add("Telefon dosyasında aynı kimlik iki kez var, ikincisi yeni nesne olarak eklendi: " + ad);
                    id = "";
                }
                string hedef = null;
                bool kimlikle = false, parcaya = false;
                Mevcut m;
                if (!string.IsNullOrEmpty(id) && mevcut.TryGetValue(id, out m) && m.Nesne == nesne) hedef = id;
                else
                {
                    string h;
                    if (!string.IsNullOrEmpty(id) && kimlikten.TryGetValue(id, out h) && mevcut.TryGetValue(h, out m) && m.Nesne == nesne) { hedef = h; kimlikle = true; }
                    else
                    {
                        // Parçalı hat / kanal / sondaj: telefon, çizimde tek parça olan nesneyi direkten direğe böler
                        // ("<kimlik>-1", "-2"…). İlk parça eski nesneyi günceller (tanıtıcı ve bağlantıları korunur), diğerleri yeni.
                        string kok = IlkParcaKoku(id);
                        if (kok != null)
                        {
                            if (mevcut.TryGetValue(kok, out m) && m.Nesne == nesne && !eslesen.Contains(kok)) { hedef = kok; parcaya = true; }
                            else if (kimlikten.TryGetValue(kok, out h) && mevcut.TryGetValue(h, out m) && m.Nesne == nesne && !eslesen.Contains(h)) { hedef = h; kimlikle = true; parcaya = true; }
                        }
                    }
                }

                if (hedef == null)
                {
                    var yeni = telYaz(id, string.IsNullOrEmpty(id) ? null : id);
                    var adim = new AktarimAdimi
                    {
                        Islem = "yeni", Nesne = nesne, Kimlik = id ?? "", Varlik = yeni, Etiket = telEtiket?.Invoke(null), Ad = ad, ElemanTuru = elemanTuru ?? "",
                    };
                    if (HakedisOnayi.KilidiBozar(onaylar, null, telNesne)) { adim.Fark = "onaylı hakedişe yeni nesne"; plan.Kilitliler.Add(adim); }
                    else plan.Adimlar.Add(adim);
                    return;
                }

                eslesen.Add(hedef);
                if (kimlikle) plan.KimlikleEslesen++;
                else
                {
                    plan.TaniticiylaEslesen++;
                    long n;
                    if (long.TryParse(hedef, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out n) && n > enBuyukTanitici) enBuyukTanitici = n;
                }

                string kimlik;
                kimligi.TryGetValue(hedef, out kimlik);
                if (parcaya && kimlikle) kimlik = id; // telefondan alınmış eski nesne artık ilk parça: kimliği parçanın kimliği
                var istenen = telYaz(hedef, kimlik);
                var simdiki = cizimYaz(mevcut[hedef].Model, kimlik);
                NesneYazici.TaniticiYaz(istenen, hedef);
                NesneYazici.TaniticiYaz(simdiki, hedef);
                // Telefonun düzenlemediği AutoCAD verileri (pano çıkış şeması, hücreler): telefonda yoksa çizimdeki korunur
                foreach (var u in NesneYazici.EkUygulamalar)
                    if (!istenen.Xd.ContainsKey(u) && simdiki.Xd.ContainsKey(u)) istenen.Xd[u] = new List<string>(simdiki.Xd[u]);
                // Değişmeyen nesneye dokunulmaz (etiketi eski kalmış olsa bile); değişen hattın etiketi yeniden yazılır.
                string fark;
                if (CadVarlik.Ayni(simdiki, istenen, out fark)) { plan.Ayni++; return; }
                var guncelle = new AktarimAdimi
                {
                    Islem = "guncelle", Nesne = nesne, Hedef = hedef, Kimlik = id ?? "", Varlik = istenen,
                    Etiket = telEtiket?.Invoke(null), Ad = ad, Fark = fark ?? "", ElemanTuru = elemanTuru ?? "",
                };
                if (HakedisOnayi.KilidiBozar(onaylar, mevcut[hedef].Model, telNesne)) plan.Kilitliler.Add(guncelle);
                else plan.Adimlar.Add(guncelle);
            };

            foreach (var b in tel.Bolgeler)
            {
                var t = b;
                isle("bolge", t.Id, (h, k) => NesneYazici.Bolge(t, onEk, k), (o, k) => NesneYazici.Bolge((Bolge)o, onEk, k), null,
                    "Bölge " + (string.IsNullOrEmpty(t.Kod) ? t.Ad : t.Kod), null, t);
            }
            foreach (var n in tel.Noktalar)
            {
                var t = n;
                isle("nokta", t.Id, (h, k) => NesneYazici.Nokta(t, k), (o, k) => NesneYazici.Nokta((Nokta)o, k), null,
                    "GPS " + t.Ad, null, t);
            }
            foreach (var e in tel.Elemanlar)
            {
                var t = e;
                string ad = (string.IsNullOrEmpty(t.GisId) ? "" : t.GisId + " ") + Turler.ElemanAdi(t.Tur);
                isle("eleman", t.Id,
                    (h, k) => NesneYazici.Eleman(t, onEk, NesneYazici.BlokSec(cp.Elemanlar, t), k),
                    (o, k) => { var d = (Eleman)o; return NesneYazici.Eleman(d, onEk, string.IsNullOrEmpty(d.Blok) ? NesneYazici.BlokOner(cp.Elemanlar, d.Tur, d.Cins, d.Durum, d.DmDurum) : d.Blok, k); },
                    null, ad, t.Tur, t);
            }
            foreach (var hat in tel.Hatlar)
            {
                var t = hat;
                string ad = "Hat " + t.AnaKesit + " (" + Turler.HatAdi(t.Tur) + ")";
                isle("hat", t.Id, (h, k) => NesneYazici.Hat(t, onEk, k), (o, k) => NesneYazici.Hat((Hat)o, onEk, k),
                    h => { var e = NesneYazici.HatEtiketi(t); return h == null ? e : e.Replace(NesneYazici.Tanitici, h); },
                    ad, null, t);
            }
            foreach (var c in tel.Kanallar)
            {
                var t = c;
                isle("kanal", t.Id, (h, k) => NesneYazici.Kanal(t, onEk, k), (o, k) => NesneYazici.Kanal((Kanal)o, onEk, k), null,
                    "Kanal " + t.Kablolar + " " + t.Zemin, null, t);
            }
            foreach (var s in tel.Sondajlar)
            {
                var t = s;
                isle("sondaj", t.Id, (h, k) => NesneYazici.Sondaj(t, onEk, k), (o, k) => NesneYazici.Sondaj((Sondaj)o, onEk, k), null,
                    "Sondaj " + t.Tip, null, t);
            }

            // Telefonda silinmiş görünenler. Yalnız bu çizimden alınmış projede ve dışa aktarımdan önce
            // var olan nesnelerde (tanıtıcısı telefondaki en büyük tanıtıcıdan küçük) sorulur; bilgisayarda
            // sonradan çizilenler aday olmaz.
            var telKimlikleri = new HashSet<string>(StringComparer.Ordinal);
            foreach (var x in tel.Bolgeler) telKimlikleri.Add(x.Id);
            foreach (var x in tel.Noktalar) telKimlikleri.Add(x.Id);
            foreach (var x in tel.Elemanlar) telKimlikleri.Add(x.Id);
            foreach (var x in tel.Hatlar) telKimlikleri.Add(x.Id);
            foreach (var x in tel.Kanallar) telKimlikleri.Add(x.Id);
            foreach (var x in tel.Sondajlar) telKimlikleri.Add(x.Id);
            foreach (var kv in mevcut)
            {
                if (eslesen.Contains(kv.Key)) continue;
                string kimlik;
                bool aday;
                if (kimligi.TryGetValue(kv.Key, out kimlik)) aday = plan.KimlikleEslesen > 0 && !telKimlikleri.Contains(kimlik);
                else
                {
                    long n;
                    if (plan.TaniticiylaEslesen == 0) aday = false;
                    else if (long.TryParse(kv.Key, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out n)) aday = n <= enBuyukTanitici;
                    else aday = true; // onaltılık olmayan tanıtıcı (yalnız test dökümlerinde): yaşı bilinmez, sorulur
                }
                if (!aday) continue;
                if (HakedisOnayi.NesneKilitli(onaylar, kv.Value.Model)) plan.KilitliSilinenler[kv.Key] = KisaAd(kv.Value);
                else plan.Silinenler[kv.Key] = KisaAd(kv.Value);
            }

            // Çizimden alınmış ama çizimde artık bulunmayan nesneler (bilgisayarda silinmiş olabilir)
            if (plan.TaniticiylaEslesen > 0)
                foreach (var a in plan.Adimlar)
                {
                    long n;
                    if (a.Islem == "yeni" && long.TryParse(a.Kimlik, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out n) && n <= enBuyukTanitici)
                        a.CizimdeSilinmis = true;
                }

            // Yeni elemanların GIS numarası çizimde başka elemanda varsa uyar
            var gisler = new HashSet<string>(StringComparer.Ordinal);
            foreach (var e in cp.Elemanlar) if (!string.IsNullOrEmpty(e.GisId)) gisler.Add(e.GisId);
            foreach (var a in plan.Adimlar)
            {
                if (a.Islem != "yeni" || a.Nesne != "eleman") continue;
                var t = tel.Elemanlar.Find(x => x.Id == a.Kimlik && a.Kimlik != "");
                if (t == null || string.IsNullOrEmpty(t.GisId) || t.GisId == "EKOG" || t.GisId == "EKAG") continue;
                if (gisler.Contains(t.GisId)) plan.Uyarilar.Add(t.GisId + " numarası çizimde başka bir elemanda da var (" + Turler.ElemanAdi(t.Tur) + "). Numarayı kontrol edin.");
            }
            return plan;
        }

        /// <summary>"ABC-1" → "ABC" (parçalı nesnenin ilk parçası); değilse null.</summary>
        public static string IlkParcaKoku(string id)
        {
            if (string.IsNullOrEmpty(id) || id.Length < 3 || !id.EndsWith("-1", StringComparison.Ordinal)) return null;
            string kok = id.Substring(0, id.Length - 2);
            return kok.Trim().Length == 0 ? null : kok;
        }

        private static string KisaAd(Mevcut m)
        {
            switch (m.Nesne)
            {
                case "eleman": { var e = (Eleman)m.Model; return (string.IsNullOrEmpty(e.GisId) ? "" : e.GisId + " ") + Turler.ElemanAdi(e.Tur); }
                case "hat": { var h = (Hat)m.Model; return "Hat " + h.AnaKesit + " (" + Turler.HatAdi(h.Tur) + ")"; }
                case "kanal": { var c = (Kanal)m.Model; return "Kanal " + c.Kablolar + " " + c.Zemin; }
                case "sondaj": return "Sondaj " + ((Sondaj)m.Model).Tip;
                case "nokta": return "GPS " + ((Nokta)m.Model).Ad;
                case "bolge": { var b = (Bolge)m.Model; return "Bölge " + (string.IsNullOrEmpty(b.Kod) ? b.Ad : b.Kod); }
            }
            return m.Nesne;
        }
    }
}
