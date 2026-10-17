using System;
using System.Collections.Generic;
using System.Text;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Runtime;
using SebekeHakedis.Cekirdek;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

[assembly: CommandClass(typeof(SebekeHakedis.Eklenti.StilKomutu))]

namespace SebekeHakedis.Eklenti
{
    /// <summary>
    /// SH_STIL: açık çizimdeki şebeke nesnelerini telefon uygulamasının görünümüne getirir — katman renkleri ve çizgi
    /// tipleri, eleman renkleri, simge blokları (istenirse PROMAGIS blokları da telefon simgeleriyle değiştirilir),
    /// eleman yazıları (GIS no + tip), hat etiketleri ve açıklık uzunluk yazıları. PROMAGIS verisine (XDATA) dokunmaz.
    /// </summary>
    public sealed class StilKomutu
    {
        [CommandMethod("SH_STIL", CommandFlags.Modal)]
        public void StilUygula()
        {
            var belge = AcApp.DocumentManager.MdiActiveDocument;
            if (belge == null) return;
            Komutlar.Calistir("Telefon görünümü", () =>
            {
                var o = Ortam.Hazirla(belge);
                var ed = o.Ed;
                var p = o.Proje;
                int promagisBlok = 0;
                foreach (var e in p.Elemanlar) if (!string.IsNullOrEmpty(e.Blok) && !Semboller.EklentininBlogu(e.Blok)) promagisBlok++;
                if (p.Elemanlar.Count + p.Hatlar.Count + p.Kanallar.Count + p.Sondajlar.Count == 0)
                {
                    Pencereler.Bilgi("Bu çizimde şebeke nesnesi yok. Yeni çizilen nesneler zaten telefon görünümüyle çizilir.");
                    return;
                }
                var sb = new StringBuilder();
                sb.AppendLine("Çizim telefon uygulamasının görünümüne getirilecek:");
                sb.AppendLine("  • Katman renkleri ve çizgi tipleri (AG yeşil 84, OG kırmızı 1, aydınlatma 4, yeraltı nokta-çizgi, demontaj sarı 2)");
                sb.AppendLine("  • " + p.Elemanlar.Count + " eleman: renk (gerilim ve duruma göre), yazı \"GIS no + tip\" simgenin sağ üstünde");
                sb.AppendLine("  • " + p.Hatlar.Count + " hat: renk, etiket hattın altında ortalanmış, her açıklığın uzunluğu üstünde");
                if (p.Kanallar.Count + p.Sondajlar.Count > 0) sb.AppendLine("  • " + (p.Kanallar.Count + p.Sondajlar.Count) + " kanal / sondaj: renk");
                sb.AppendLine();
                sb.AppendLine("PROMAGIS verisi (GIS, NIT, HAT…) değişmez; PROMAGIS raporu aynı çalışır.");
                sb.AppendLine("Beğenmezseniz AutoCAD'in Geri Al (U) komutu hepsini geri alır.");
                sb.AppendLine();
                sb.Append("Uygulansın mı?");
                if (!Pencereler.Onay(sb.ToString())) return;

                bool bloklariDegistir = false;
                if (promagisBlok > 0)
                    bloklariDegistir = Pencereler.Onay(promagisBlok + " eleman PROMAGIS bloğuyla çizilmiş.\n\n" +
                        "Bunlar da telefon simgeleriyle (SH_…) değiştirilsin mi?\n(Hayır derseniz blokları kalır; yalnız renk ve yazıları düzenlenir.)");

                var kimlikler = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var v in o.Varliklar)
                {
                    string k = v.XdIlk(PromagisYazici.KimlikUygulamasi);
                    if (!string.IsNullOrEmpty(k) && !string.IsNullOrEmpty(v.H)) kimlikler[v.H] = k;
                }
                Func<string, string> kimlik = h => { string k; return kimlikler.TryGetValue(h ?? "", out k) ? k : null; };

                int katman, blok, eleman = 0, hat = 0, kanal = 0, atlanan = 0;
                using (var tr = o.Db.TransactionManager.StartTransaction())
                {
                    var y = new CizimYazici(o.Db, tr) { EtiketYuksekligi = o.Ayar.EtiketYuksekligi, EtiketiYenidenKonumla = true };
                    katman = y.KatmanlariBoya();
                    blok = y.BloklariYenile();
                    foreach (var e in p.Elemanlar)
                    {
                        ObjectId id;
                        if (!Toplayici.TaniticiylaBul(o.Db, e.Id, out id)) { atlanan++; continue; }
                        string b = bloklariDegistir || string.IsNullOrEmpty(e.Blok) || Semboller.EklentininBlogu(e.Blok) ? Semboller.BlokAdi(e) : e.Blok;
                        if (!y.BlokKullanilabilir(b)) b = e.Blok;
                        y.BlokOlcegi = Semboller.EklentininBlogu(b) ? o.Olcek(b) : 0;
                        try { y.Guncelle(id, PromagisYazici.Eleman(e, o.OnEk, b, kimlik(e.Id)), null, false); eleman++; }
                        catch (System.Exception ex) { y.Uyarilar.Add((e.GisId ?? e.Id) + " düzenlenemedi (katmanı kilitli olabilir): " + ex.Message); }
                    }
                    foreach (var h in p.Hatlar)
                    {
                        ObjectId id;
                        if (!Toplayici.TaniticiylaBul(o.Db, h.Id, out id)) { atlanan++; continue; }
                        try { y.Guncelle(id, PromagisYazici.Hat(h, o.OnEk, kimlik(h.Id)), PromagisYazici.HatEtiketi(h), false); hat++; }
                        catch (System.Exception ex) { y.Uyarilar.Add("Hat " + h.Id + " düzenlenemedi (katmanı kilitli olabilir): " + ex.Message); }
                    }
                    foreach (var c in p.Kanallar)
                    {
                        ObjectId id;
                        if (!Toplayici.TaniticiylaBul(o.Db, c.Id, out id)) { atlanan++; continue; }
                        try { y.Guncelle(id, PromagisYazici.Kanal(c, o.OnEk, kimlik(c.Id)), null, false); kanal++; } catch { atlanan++; }
                    }
                    foreach (var s in p.Sondajlar)
                    {
                        ObjectId id;
                        if (!Toplayici.TaniticiylaBul(o.Db, s.Id, out id)) { atlanan++; continue; }
                        try { y.Guncelle(id, PromagisYazici.Sondaj(s, o.OnEk, kimlik(s.Id)), null, false); kanal++; } catch { atlanan++; }
                    }
                    tr.Commit();
                    int n = 0;
                    foreach (var u in y.Uyarilar) if (n++ < 10) ed.WriteMessage("\nUyarı: " + u);
                    blok += y.YenilenenBlok;
                }
                if (bloklariDegistir && o.Ayar.PromagisBloklari) { o.Ayar.PromagisBloklari = false; o.AyarKaydet(); }
                try { ed.Regen(); } catch { }

                var oz = new StringBuilder("Telefon görünümü uygulandı.\n\n");
                oz.AppendLine("Boyanan katman: " + katman);
                oz.AppendLine("Yenilenen simge bloğu: " + blok);
                oz.AppendLine("Düzenlenen eleman: " + eleman + (bloklariDegistir ? " (PROMAGIS blokları telefon simgeleriyle değiştirildi)" : ""));
                oz.AppendLine("Düzenlenen hat: " + hat + " (etiket ve açıklık uzunlukları yeniden yazıldı)");
                if (kanal > 0) oz.AppendLine("Düzenlenen kanal / sondaj: " + kanal);
                if (atlanan > 0) oz.AppendLine("Atlanan: " + atlanan + " (çizimde bulunamadı ya da kilitli)");
                double ltscale = 1;
                try { ltscale = o.Db.Ltscale; } catch { }
                if (Math.Abs(ltscale - 1) > 1e-9)
                    oz.AppendLine("\nNot: Çizgi tipi ölçeği (LTSCALE) " + ltscale.ToString("0.###") + ". Kesikli çizgilerin telefondaki gibi görünmesi için 1 olmalı (komut: LTSCALE 1).");
                ed.WriteMessage("\n" + oz.ToString().Replace("\n\n", "\n"));
                Pencereler.Bilgi(oz.ToString());
            });
        }
    }
}
