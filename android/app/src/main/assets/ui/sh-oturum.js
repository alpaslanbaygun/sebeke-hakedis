/*
 * Açık proje (oturum): projeyi telefondan yükler, her değişikliği küçük bir satır olarak kaydeder,
 * geri almayı ve sahadaki işlemleri (eleman koyma, hat, kanal, malzeme…) yürütür.
 *
 * Kural: nesneler yerinde değiştirilmez; kopyası değiştirilip kaydet() ile "koy" işlemi yapılır.
 * Böylece her değişiklik günlüğe yazılır ve geri alınabilir.
 */
(function () {
  'use strict';
  const SH = window.SH;

  const VARSAYILAN_AYAR = {
    yukariYuvarla: true,
    ekPay: { AG_HAVAI: 0, AG_YERALTI: 0, AYDINLATMA: 0, OG_HAVAI: 0, OG_YERALTI: 0, REKORTMAN: 0, MUSTEREK: 0 },
    olcumSuresi: 0,
    antenYuksekligi: 0,
    yalnizFixed: false,
    enFazlaHata: 0.10,
    kanalAlt: 40,
    kanalUst: 40,
    kanalDerinlik: 100,
    kanalZemin: 'TOPRAK'
  };
  const SIKISTIR_ESIK = 150;
  const GERI_AL_EN_COK = 40;

  const O = {
    id: null,
    p: null,
    ix: null,
    katalog: [],
    alanlar: new Map(),
    sira: 0,
    gunluk: 0,
    geri: [],
    rev: 0,
    konumTM: null,
    metaZaman: null,
    sikistirZaman: null,

    acik() { return !!this.p; },

    /** Projeyi telefondan yükler. sessiz: hata olursa bildirim gösterme (açılışta son proje). */
    ac(id, sessiz) {
      const r = App.api('project.load', { id });
      if (!r || r.error || !r.base) {
        if (!sessiz) App.toast((r && r.error) || 'Proje açılamadı');
        if (sessiz) App.api('project.close');
        return false;
      }
      let p;
      try {
        p = SH.projeOku(r.base);
      } catch (e) {
        if (!sessiz) App.toast(e.message);
        return false;
      }
      const ix = SH.indeksYap(p);
      for (const d of r.journal || []) SH.degisiklikUygula(p, d, ix);
      this.id = id;
      this.p = p;
      this.ix = ix;
      this.gunluk = (r.journal || []).length;
      this.geri = [];
      this.rev++;
      p.proje.ayarlar = Object.assign({}, VARSAYILAN_AYAR, p.proje.ayarlar || {});
      p.proje.ayarlar.ekPay = Object.assign({}, VARSAYILAN_AYAR.ekPay, p.proje.ayarlar.ekPay || {});
      this.hazirla();
      if (this.konumTM === null && App.fix) this.konum(App.fix);
      if (this.gunluk > SIKISTIR_ESIK) this.sikistirSonra(2000);
      return true;
    },

    kapat() {
      this.bekleyenleriYaz();
      App.api('project.close');
      this.id = null;
      this.p = null;
      this.ix = null;
      this.geri = [];
    },

    /** Katalog, bölge alanları, kalem sırası, çizim kutuları. */
    hazirla() {
      const p = this.p;
      this.katalog = SH.katalogHazirla(App.katalogJson, p);
      this.alanlar = new Map(p.bolgeler.map(b => [b.id, SH.alan(b.sinir)]));
      this.sira = SH.enBuyukSira(p);
      for (const k of ['hatlar', 'kanallar', 'sondajlar']) for (const o of p[k]) o._kutu = SH.kutu(o.kose);
      for (const b of p.bolgeler) b._kutu = SH.kutu(b.sinir);
      this.kutu = SH.projeKutusu(p);
    },

    ayar() { return this.p.proje.ayarlar; },
    dom() { return this.p ? this.p.proje.koordinat.dom || 0 : 0; },
    hakedis() { return this.p ? this.p.proje.aktifHakedis || 1 : 1; },
    onEk() { return this.p ? (this.p.proje.katmanOnEki || 'SC') : 'SC'; },
    gisOnEki() { return this.p ? (this.p.proje.gisOnEki || this.onEk()) : 'SC'; },
    yeniSira() { this.sira += 1; return String(this.sira); },

    // ---- Kayıt ----

    /** Değişikliği uygular, günlüğe yazar, geri alma kaydı tutar, ekranlara bildirir. */
    kaydet(ops, o) {
      const opt = o || {};
      const p = this.p;
      if (!p || !ops.length) return false;
      const ters = [];
      if (!opt.geriAlma) {
        for (const op of ops) {
          if (op.k === 'proje') {
            const eski = {};
            for (const key of Object.keys(op.set || {})) eski[key] = p.proje[key] === undefined ? null : JSON.parse(JSON.stringify(p.proje[key]));
            ters.unshift({ k: 'proje', set: eski });
          } else {
            const id = op.put ? op.put.id : op.del;
            const eski = this.ix[op.k].get(id);
            if (eski) ters.unshift({ k: op.k, put: temizKopya(eski) });
            else ters.unshift({ k: op.k, del: id });
          }
        }
      }
      const satir = { t: Date.now(), ops: ops.map(op => (op.put ? { k: op.k, put: temizKopya(op.put) } : op)) };
      const r = App.api('project.patch', { id: this.id, line: JSON.stringify(satir) });
      if (r && r.error) {
        App.toast('Kaydedilemedi: ' + r.error);
        return false;
      }
      SH.degisiklikUygula(p, { ops }, this.ix);
      for (const op of ops) {
        if (op.put && op.put.kose) op.put._kutu = SH.kutu(op.put.kose);
        if (op.k === 'bolgeler') {
          if (op.put) {
            op.put._kutu = SH.kutu(op.put.sinir);
            this.alanlar.set(op.put.id, SH.alan(op.put.sinir));
          } else {
            this.alanlar.delete(op.del);
          }
        }
      }
      this.gunluk++;
      this.rev++;
      if (!opt.geriAlma) {
        this.geri.push({ ops: ters, mesaj: opt.mesaj || 'Değişiklik' });
        if (this.geri.length > GERI_AL_EN_COK) this.geri.shift();
      }
      this.kutu = SH.projeKutusu(p);
      this.metaSonra();
      if (this.gunluk > SIKISTIR_ESIK) this.sikistirSonra(4000);
      App.emit('veri', { ops });
      return true;
    },

    geriAlinabilir() { return this.geri.length > 0; },

    geriAl() {
      const g = this.geri.pop();
      if (!g) return null;
      for (const op of g.ops) if (op.k === 'proje') for (const key of Object.keys(op.set)) if (op.set[key] === null) op.set[key] = undefined;
      this.kaydet(g.ops, { geriAlma: true });
      return g.mesaj;
    },

    metaSonra() {
      clearTimeout(this.metaZaman);
      this.metaZaman = setTimeout(() => this.metaYaz(), 1500);
    },

    meta() {
      const p = this.p;
      return {
        ad: p.proje.ad, kaynak: p.proje.kaynak, hakedis: p.proje.aktifHakedis, dom: p.proje.koordinat.dom,
        sayilar: { eleman: p.elemanlar.length, hat: p.hatlar.length, kanal: p.kanallar.length, nokta: p.noktalar.length, bolge: p.bolgeler.length }
      };
    },

    metaYaz() {
      clearTimeout(this.metaZaman);
      this.metaZaman = null;
      if (this.p) App.api('project.meta', { id: this.id, meta: this.meta() });
    },

    sikistirSonra(ms) {
      clearTimeout(this.sikistirZaman);
      this.sikistirZaman = setTimeout(() => this.sikistir(), ms);
    },

    /** Günlüğü projeye katar: proje dosyası yeniden yazılır, günlük boşalır. */
    sikistir() {
      clearTimeout(this.sikistirZaman);
      this.sikistirZaman = null;
      if (!this.p || this.gunluk === 0) return true;
      const r = App.api('project.compact', { id: this.id, text: SH.projeYaz(this.p, 'Şebeke Hakediş (telefon) ' + App.version), meta: this.meta() });
      if (r && r.error) return false;
      this.gunluk = 0;
      return true;
    },

    bekleyenleriYaz() {
      if (!this.p) return;
      if (this.metaZaman) this.metaYaz();
      if (this.gunluk > 30) this.sikistir();
    },

    /** Proje dosyasının paylaşılacak / kaydedilecek metni. */
    dosyaMetni() { return SH.projeYaz(this.p, 'Şebeke Hakediş (telefon) ' + App.version); },

    // ---- Konum ----

    /** GNSS konumunu proje koordinatına çevirir (dilim biliniyorsa). */
    konum(f) {
      if (!f || !f.has || f.lat === null || f.lon === null) {
        this.konumTM = null;
        return null;
      }
      const dom = this.dom();
      if (!dom) {
        this.konumTM = { e: null, n: null, h: null, f };
        return this.konumTM;
      }
      const [e, n] = SH.tmIleri(f.lat, f.lon, dom);
      const anten = this.p ? Number(this.ayar().antenYuksekligi) || 0 : 0;
      const h = f.hMsl === null || f.hMsl === undefined ? null : f.hMsl - anten;
      this.konumTM = { e, n, h, f };
      return this.konumTM;
    },

    // ---- Yardımcılar ----

    /**
     * Noktanın bölgesi: içinde kaldığı en küçük bölge; hiçbirinin içinde değilse sınırı çizilmemiş
     * bölge (telefonda açılan projelerde rapor başlığı), o da yoksa en yakın bölge.
     */
    bolgeBul(nokta) {
      const p = this.p;
      if (!nokta || !p.bolgeler.length) return '';
      let sec = null;
      let secAlan = Infinity;
      for (const b of p.bolgeler) {
        if (!b.sinir || b.sinir.length < 3 || !SH.icinde(nokta, b.sinir)) continue;
        const a = this.alanlar.has(b.id) ? this.alanlar.get(b.id) : SH.alan(b.sinir);
        if (a < secAlan) {
          sec = b;
          secAlan = a;
        }
      }
      if (sec) return sec.id;
      const bos = p.bolgeler.find(b => !b.sinir || b.sinir.length < 3);
      if (bos) return bos.id;
      const yakin = SH.bolgeSec(nokta, p.bolgeler, this.alanlar);
      return yakin ? yakin.id : '';
    },

    elemanKatmani(tur, durum, hakedis) {
      const t = SH.elemanTuru(tur);
      const on = this.onEk();
      if (durum === 'MEVCUT') return on + '_MEVCUT';
      if (durum === 'DM') return on + '_DEMONTAJ';
      if (t.katman === 'STANDART') return on + '_STANDART';
      return on + '_' + hakedis + '.HAK.' + t.katman;
    },

    hatKatmani(tur, durum, hakedis) {
      const on = this.onEk();
      if (durum === 'MEVCUT') return on + '_MEVCUT';
      if (durum === 'DM') return on + '_DEMONTAJ';
      return on + '_' + hakedis + '.HAK.' + SH.hatTuru(tur).katman;
    },

    nesne(k, id) { return this.ix && this.ix[k] ? this.ix[k].get(id) : null; },

    /** Nesnenin kopyasını alır, fn ile değiştirir ve kaydeder. */
    guncelle(k, id, fn, mesaj) {
      const eski = this.nesne(k, id);
      if (!eski) return null;
      const yeni = temizKopya(eski);
      if (fn(yeni) === false) return null;
      this.kaydet([{ k, put: yeni }], { mesaj });
      return yeni;
    },

    // ---- Saha işlemleri ----

    /** Ölçülen noktaya eleman koyar. o: {tur, tip (katalog öğesi), durum, hakedis, saga, yukari, kot, gisId, olcum, dmDurum} */
    elemanKoy(o) {
      const hak = o.hakedis || this.hakedis();
      const tip = o.tip;
      const ana = SH.kalemYap(tip, { miktar: 1, durum: o.durum, hakedis: hak, ana: true, kaynak: 'NIT', sira: this.yeniSira(), dmDurum: o.dmDurum });
      const e = {
        id: SH.yeniId(), tur: o.tur, gisId: o.gisId || '', cins: tip.cins, tip: tip.tanim, durum: o.durum, hakedis: hak,
        bolge: this.bolgeBul([o.saga, o.yukari]), saga: SH.temiz(o.saga, 4), yukari: SH.temiz(o.yukari, 4),
        kot: o.kot === null || o.kot === undefined ? 0 : SH.temiz(o.kot, 3), aci: 0, kontrol: null,
        katman: this.elemanKatmani(o.tur, o.durum, hak), blok: '', kalemler: [ana]
      };
      if (o.dmDurum) e.dmDurum = o.dmDurum;
      if (o.olcum) e.olcum = o.olcum;
      e.olusturma = SH.zaman();
      this.kaydet([{ k: 'elemanlar', put: e }], { mesaj: (e.gisId || SH.elemanTuru(e.tur).ad) + ' konuldu' });
      return e;
    },

    /** Saha ölçüm noktası (PROMAGIS GPS noktası). */
    noktaKoy(o) {
      const n = {
        id: SH.yeniId(), ad: o.ad || '', kod: o.kod || '', saga: SH.temiz(o.saga, 4), yukari: SH.temiz(o.yukari, 4),
        kot: o.kot === null || o.kot === undefined ? 0 : SH.temiz(o.kot, 3), hakedis: o.hakedis || this.hakedis(),
        bolge: this.bolgeBul([o.saga, o.yukari])
      };
      if (o.olcum) n.olcum = o.olcum;
      this.kaydet([{ k: 'noktalar', put: n }], { mesaj: (n.ad || 'Nokta') + ' alındı' });
      return n;
    },

    /** Hat çizer. o: {tur, kesit (katalog öğesi), durum, hakedis, kose, metraj, uclar:[basId, bitId]} */
    hatCiz(o) {
      const hak = o.hakedis || this.hakedis();
      const kesit = o.kesit;
      const kl = SH.kalemYap(kesit, { miktar: o.metraj, durum: o.durum, hakedis: hak, kaynak: 'HAT', sira: this.yeniSira() });
      const kose = o.kose.map(q => [SH.temiz(q[0], 4), SH.temiz(q[1], 4)]);
      const h = {
        id: SH.yeniId(), tur: o.tur, anaKesit: kesit.tanim, durum: o.durum, hakedis: hak,
        bolge: this.bolgeBul(SH.ortaNokta(kose)), kose, cizimUzunlugu: SH.uzunluk(kose),
        etiket: SH.hatEtiketi(o.durum, kesit.tanim, o.metraj), kontrol: null, katman: this.hatKatmani(o.tur, o.durum, hak), kalemler: [kl]
      };
      if (o.uclar) h.uclar = o.uclar;
      h.olusturma = SH.zaman();
      this.kaydet([{ k: 'hatlar', put: h }], { mesaj: 'Hat çizildi' });
      return h;
    },

    /** Kablo kanalı. o: {og, ag, ayd, rek, zemin, alt, ust, derinlik, durum, hakedis, kose, metraj, basNo, bitNo} */
    kanalCiz(o) {
      const hak = o.hakedis || this.hakedis();
      const kod = SH.kanalKodu(o.og, o.ag, o.ayd, o.rek);
      const kose = o.kose.map(q => [SH.temiz(q[0], 4), SH.temiz(q[1], 4)]);
      const c = {
        id: SH.yeniId(), kod, kablolar: SH.kanalKablolari(kod), zemin: o.zemin, altGenislik: SH.sayi(o.alt), ustGenislik: SH.sayi(o.ust),
        derinlik: SH.sayi(o.derinlik), basNo: o.basNo || '', bitNo: o.bitNo || '', durum: o.durum || 'M+M', hakedis: hak,
        bolge: this.bolgeBul(SH.ortaNokta(kose)), kose, cizimUzunlugu: SH.uzunluk(kose), kontrol: null, kalemler: []
      };
      const kl = {
        cins: String(kod), tanim: o.zemin, durum: c.durum, miktar: SH.sayi(o.metraj) || 0, birim: 'mt/m³', katsayi: 1, toplam: 0, birimFiyat: 0,
        hakedis: hak, tarife: o.tarife || '0104', sira: this.yeniSira(), kontrol: null, ana: true, kaynak: 'NIT'
      };
      SH.kalemToplami(kl, c);
      c.kalemler.push(kl);
      c.olusturma = SH.zaman();
      this.kaydet([{ k: 'kanallar', put: c }], { mesaj: 'Kanal çizildi' });
      return c;
    },

    /** Yatay sondaj (delgi). o: {tip (katalog öğesi), durum, hakedis, kose, metraj} */
    sondajCiz(o) {
      const hak = o.hakedis || this.hakedis();
      const kose = o.kose.map(q => [SH.temiz(q[0], 4), SH.temiz(q[1], 4)]);
      const kl = SH.kalemYap(o.tip, { miktar: o.metraj, durum: o.durum, hakedis: hak, ana: true, kaynak: 'NIT', sira: this.yeniSira() });
      const s = {
        id: SH.yeniId(), tip: o.tip.tanim, durum: o.durum, hakedis: hak, bolge: this.bolgeBul(SH.ortaNokta(kose)),
        basNo: o.basNo || '', bitNo: o.bitNo || '', kose, cizimUzunlugu: SH.uzunluk(kose), kontrol: null, kalemler: [kl]
      };
      s.olusturma = SH.zaman();
      this.kaydet([{ k: 'sondajlar', put: s }], { mesaj: 'Sondaj çizildi' });
      return s;
    },

    /** Alt proje (bölge): ad, kod ve sınır. Bölgeler değişince nesnelerin bölgesi yeniden atanır. */
    bolgeKaydet(o) {
      const b = Object.assign({ id: SH.yeniId(), ad: '', kod: '', sinir: [] }, o);
      b.sinir = (b.sinir || []).map(q => [SH.temiz(q[0], 4), SH.temiz(q[1], 4)]);
      this.kaydet([{ k: 'bolgeler', put: b }], { mesaj: 'Bölge kaydedildi' });
      return b;
    },

    /** Bölge sınırları değiştiyse tüm nesnelerin bölgesini yeniden hesaplar (tek değişiklik). */
    bolgeleriYenidenAta() {
      const ops = [];
      const p = this.p;
      const ata = (k, o, nokta) => {
        const b = this.bolgeBul(nokta);
        if (b !== o.bolge) {
          const y = temizKopya(o);
          y.bolge = b;
          ops.push({ k, put: y });
        }
      };
      for (const e of p.elemanlar) ata('elemanlar', e, [e.saga, e.yukari]);
      for (const n of p.noktalar) ata('noktalar', n, [n.saga, n.yukari]);
      for (const k of ['hatlar', 'kanallar', 'sondajlar']) for (const o of p[k]) ata(k, o, SH.ortaNokta(o.kose));
      if (ops.length) this.kaydet(ops, { mesaj: 'Bölgeler yeniden atandı' });
      return ops.length;
    },

    /** Nesneye katalogdan malzeme ekler. */
    malzemeEkle(k, id, item, o) {
      const kl = SH.kalemYap(item, {
        miktar: o.miktar, durum: o.durum, hakedis: o.hakedis || this.hakedis(), kaynak: k === 'hatlar' && o.hatKalemi ? 'HAT' : 'MALZEME',
        sira: this.yeniSira()
      });
      return this.guncelle(k, id, x => { x.kalemler.push(kl); }, kl.tanim + ' eklendi');
    },

    kalemGuncelle(k, id, i, degisiklik) {
      return this.guncelle(k, id, x => {
        const kl = x.kalemler[i];
        if (!kl) return false;
        Object.assign(kl, degisiklik);
        for (const key of Object.keys(degisiklik)) if (degisiklik[key] === undefined || degisiklik[key] === '') delete kl[key];
        SH.kalemToplami(kl, k === 'kanallar' ? x : null);
        if (kl.ana) {
          if (k === 'elemanlar') {
            x.durum = kl.durum;
            x.hakedis = kl.hakedis;
            x.cins = kl.cins;
            x.tip = kl.tanim;
            if (kl.dmDurum) x.dmDurum = kl.dmDurum; else delete x.dmDurum;
            x.katman = this.elemanKatmani(x.tur, x.durum, x.hakedis);
          } else if (k === 'kanallar' || k === 'sondajlar') {
            x.durum = kl.durum;
            x.hakedis = kl.hakedis;
          }
        }
        if (k === 'hatlar' && kl.kaynak === 'HAT' && x.kalemler.indexOf(kl) === x.kalemler.findIndex(z => z.kaynak === 'HAT')) {
          x.durum = kl.durum;
          x.hakedis = kl.hakedis;
          x.anaKesit = kl.tanim;
          x.etiket = SH.hatEtiketi(x.durum, x.anaKesit, kl.miktar);
          x.katman = this.hatKatmani(x.tur, x.durum, x.hakedis);
        }
      }, 'Kalem güncellendi');
    },

    kalemSil(k, id, i) {
      return this.guncelle(k, id, x => {
        if (!x.kalemler[i] || x.kalemler[i].ana) return false;
        x.kalemler.splice(i, 1);
      }, 'Kalem silindi');
    },

    nesneSil(k, id) {
      const o = this.nesne(k, id);
      if (!o) return false;
      return this.kaydet([{ k, del: id }], { mesaj: 'Silindi' });
    },

    /** Elemanı yeni konuma taşır; ucu bu elemana bağlı hatların ucu da taşınır. */
    elemanTasi(id, saga, yukari, kot) {
      const e = this.nesne('elemanlar', id);
      if (!e) return false;
      const y = temizKopya(e);
      y.saga = SH.temiz(saga, 4);
      y.yukari = SH.temiz(yukari, 4);
      if (kot !== undefined && kot !== null) y.kot = SH.temiz(kot, 3);
      y.bolge = this.bolgeBul([y.saga, y.yukari]);
      const ops = [{ k: 'elemanlar', put: y }];
      for (const h of this.p.hatlar) {
        if (!h.uclar) continue;
        const bas = h.uclar[0] === id;
        const bit = h.uclar[1] === id;
        if (!bas && !bit) continue;
        const hy = temizKopya(h);
        if (bas) hy.kose[0] = [y.saga, y.yukari];
        if (bit) hy.kose[hy.kose.length - 1] = [y.saga, y.yukari];
        hy.cizimUzunlugu = SH.uzunluk(hy.kose);
        hy.bolge = this.bolgeBul(SH.ortaNokta(hy.kose));
        ops.push({ k: 'hatlar', put: hy });
      }
      this.kaydet(ops, { mesaj: (e.gisId || 'Eleman') + ' taşındı' });
      return true;
    },

    projeAyarla(set, mesaj) {
      return this.kaydet([{ k: 'proje', set }], { mesaj: mesaj || 'Ayar değişti' });
    },

    ayarKaydet(degisiklik) {
      const a = Object.assign({}, this.ayar(), degisiklik);
      return this.projeAyarla({ ayarlar: a }, 'Ayar değişti');
    },

    // ---- Son kullanılanlar ve yıldızlılar (telefona bağlı) ----

    sonKullanilan(anahtar) {
      try { return JSON.parse(localStorage.getItem('son:' + anahtar) || '[]'); } catch (e) { return []; }
    },

    sonaEkle(anahtar, deger) {
      const l = this.sonKullanilan(anahtar).filter(x => x !== deger);
      l.unshift(deger);
      try { localStorage.setItem('son:' + anahtar, JSON.stringify(l.slice(0, 8))); } catch (e) { /* kalıcı değil */ }
    },

    yildizlar() {
      try { return new Set(JSON.parse(localStorage.getItem('yildiz') || '[]')); } catch (e) { return new Set(); }
    },

    yildizDegistir(anahtar) {
      const s = this.yildizlar();
      if (s.has(anahtar)) s.delete(anahtar); else s.add(anahtar);
      try { localStorage.setItem('yildiz', JSON.stringify([...s])); } catch (e) { /* kalıcı değil */ }
      return s.has(anahtar);
    },

    /** Genel tercih (son durum, son tür…). */
    tercih(anahtar, varsayilan) {
      try {
        const v = localStorage.getItem('tercih:' + anahtar);
        return v === null ? varsayilan : JSON.parse(v);
      } catch (e) {
        return varsayilan;
      }
    },

    tercihYaz(anahtar, deger) {
      try { localStorage.setItem('tercih:' + anahtar, JSON.stringify(deger)); } catch (e) { /* kalıcı değil */ }
    }
  };

  /** Çalışma alanları (_ ile başlayanlar) olmadan derin kopya. */
  function temizKopya(o) {
    return JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v)));
  }

  O.temizKopya = temizKopya;
  window.App.oturum = O;
})();
