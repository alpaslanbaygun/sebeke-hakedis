using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;
using Autodesk.AutoCAD.DatabaseServices;
using SebekeHakedis.Cekirdek;

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// Kullanıcılar ve onay ayarı çizimin içinde: Named Objects Dictionary → SEBEKE_HAKEDIS → KULLANICILAR (Xrecord, JSON
    /// { kullanicilar, onayAyari } 250 karakterlik parçalar halinde; HesapDeposu'ndaki gibi). Şifreler yalnız özet olarak.
    /// </summary>
    internal static class KullaniciDeposu
    {
        private const string Sozluk = "SEBEKE_HAKEDIS";
        private const string Kayit = "KULLANICILAR";
        private const int ParcaBoyu = 250;

        public static void Oku(Database db, out List<Kullanici> kullanicilar, out OnayAyari ayar)
        {
            kullanicilar = new List<Kullanici>();
            ayar = null;
            try
            {
                var sb = new StringBuilder();
                using (var tr = db.TransactionManager.StartOpenCloseTransaction())
                {
                    var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForRead);
                    if (nod.Contains(Sozluk))
                    {
                        var d = tr.GetObject(nod.GetAt(Sozluk), OpenMode.ForRead) as DBDictionary;
                        if (d != null && d.Contains(Kayit))
                        {
                            var xr = tr.GetObject(d.GetAt(Kayit), OpenMode.ForRead) as Xrecord;
                            if (xr != null)
                                using (var rb = xr.Data)
                                    if (rb != null)
                                        foreach (TypedValue tv in rb) if (tv.TypeCode == (int)DxfCode.Text) sb.Append(tv.Value as string);
                        }
                    }
                    tr.Commit();
                }
                if (sb.Length == 0) return;
                var k = Cekirdek.Json.Oku(sb.ToString()) as JsonNesne;
                if (k == null) return;
                kullanicilar = Yetki.Oku(k.Dizi("kullanicilar"));
                ayar = OnayAyari.Oku(k.Nesne("onayAyari"));
            }
            catch { }
        }

        /// <summary>Kullanıcıları ve onay ayarını çizime yazar (kendi işlemini açar).</summary>
        public static void Yaz(Database db, IList<Kullanici> kullanicilar, OnayAyari ayar)
        {
            var k = new JsonNesne();
            var l = new List<object>();
            if (kullanicilar != null) foreach (var ku in kullanicilar) l.Add(ku.Json());
            k["kullanicilar"] = l;
            if (ayar != null) k["onayAyari"] = ayar.Json();
            string json = Cekirdek.Json.Yaz(k, false);
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var nod = (DBDictionary)tr.GetObject(db.NamedObjectsDictionaryId, OpenMode.ForWrite);
                DBDictionary d;
                if (nod.Contains(Sozluk)) d = (DBDictionary)tr.GetObject(nod.GetAt(Sozluk), OpenMode.ForWrite);
                else
                {
                    d = new DBDictionary();
                    nod.SetAt(Sozluk, d);
                    tr.AddNewlyCreatedDBObject(d, true);
                }
                Xrecord xr;
                if (d.Contains(Kayit)) xr = (Xrecord)tr.GetObject(d.GetAt(Kayit), OpenMode.ForWrite);
                else
                {
                    xr = new Xrecord();
                    d.SetAt(Kayit, xr);
                    tr.AddNewlyCreatedDBObject(xr, true);
                }
                using (var rb = new ResultBuffer())
                {
                    for (int i = 0; i < json.Length; i += ParcaBoyu)
                        rb.Add(new TypedValue((int)DxfCode.Text, json.Substring(i, Math.Min(ParcaBoyu, json.Length - i))));
                    xr.Data = rb;
                }
                tr.Commit();
            }
        }
    }

    /// <summary>
    /// Oturum: çizim başına oturumdaki kullanıcı (AutoCAD kapanınca düşer, çizime yazılmaz). Yanlış şifrede telefondaki
    /// gibi bekleme (roller.json › sifre: 5 yanlış → 60 sn).
    /// </summary>
    internal static class Oturum
    {
        private sealed class Durum { public string UyeId; }
        private static readonly ConditionalWeakTable<Database, Durum> _oturum = new ConditionalWeakTable<Database, Durum>();
        private static readonly Dictionary<string, int> _yanlis = new Dictionary<string, int>(StringComparer.Ordinal);
        private static readonly Dictionary<string, DateTime> _bekle = new Dictionary<string, DateTime>(StringComparer.Ordinal);

        /// <summary>Oturumdaki etkin kullanıcı (pasif olduysa ya da çizimde yoksa null).</summary>
        public static Kullanici Uye(Database db, IList<Kullanici> liste)
        {
            Durum d;
            if (db == null || !_oturum.TryGetValue(db, out d) || d.UyeId == null || liste == null) return null;
            foreach (var k in liste) if (k.Id == d.UyeId && k.Etkin) return k;
            return null;
        }

        /// <summary>Oturum açar; şifre yanlışsa ya da beklemedeyse hata metni döner, açılırsa null.</summary>
        public static string Ac(Database db, IList<Kullanici> liste, string uyeId, string sifre)
        {
            Kullanici k = null;
            if (liste != null) foreach (var x in liste) if (x.Id == uyeId && x.Etkin) k = x;
            if (k == null) return "Kullanıcı bulunamadı.";
            DateTime t;
            if (_bekle.TryGetValue(k.Id, out t) && t > DateTime.UtcNow)
                return "Çok fazla yanlış deneme · " + Math.Ceiling((t - DateTime.UtcNow).TotalSeconds) + " sn bekleyin.";
            if (!Yetki.SifreDogru(k, sifre))
            {
                int n;
                _yanlis.TryGetValue(k.Id, out n);
                n++;
                if (n >= Roller.YanlisDeneme) { _bekle[k.Id] = DateTime.UtcNow.AddSeconds(Roller.BeklemeSaniye); n = 0; }
                _yanlis[k.Id] = n;
                return "Şifre yanlış.";
            }
            _yanlis.Remove(k.Id);
            _bekle.Remove(k.Id);
            Kapat(db);
            _oturum.Add(db, new Durum { UyeId = k.Id });
            return null;
        }

        /// <summary>Kullanıcıyı doğrudan oturuma alır (ilk yönetici tanımlanınca).</summary>
        public static void Koy(Database db, string uyeId)
        {
            Kapat(db);
            _oturum.Add(db, new Durum { UyeId = uyeId });
        }

        public static void Kapat(Database db)
        {
            if (db != null) _oturum.Remove(db);
        }
    }
}
