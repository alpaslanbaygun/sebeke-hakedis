// Projeler (M01), yeni proje, proje ana ekranı (M02), ayarlar (M13), bölgeler (M10).
(function () {
  'use strict';
  const { api, set, setAll, toast } = App;
  const SH = window.SH;
  const ot = App.oturum;

  function tarih(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /** Projeyi açar ve ana ekrana geçer; dilim bilinmiyorsa sorar. */
  async function projeAc(id) {
    App.busy('Proje açılıyor…');
    await App.frame();
    const ok = ot.ac(id);
    App.busy(false);
    if (!ok) return false;
    App.root('ana');
    if (!ot.dom()) domKontrol(true);
    return true;
  }
  App.projeAc = projeAc;

  /**
   * Dilim (DOM) seçimi. GNSS konumu varsa projenin kapsadığı alana göre önerilir; boş projede
   * konumun boylamından bulunur.
   */
  async function domKontrol(sor) {
    const p = ot.p;
    const f = App.fix;
    let oneri = null;
    if (f && f.has && f.lat !== null) {
      oneri = ot.kutu ? SH.domTahmin(f.lat, f.lon, ot.kutu) : SH.domBoylamdan(f.lon);
      if (oneri && !ot.kutu) {
        ot.projeAyarla({ koordinat: Object.assign({}, p.proje.koordinat, { dom: oneri }) }, 'Dilim seçildi');
        toast('Koordinat dilimi TM ' + oneri + '° (GNSS konumundan)');
        return oneri;
      }
    }
    if (!sor) return null;
    const v = await App.dialog({
      title: 'Koordinat dilimi',
      message: 'Projenin koordinatları hangi TM dilimine göre? (ITRF96, 3°)' + (oneri ? '\nGNSS konumuna göre öneri: TM ' + oneri + '°' : '\nBilinmiyorsa sonra Ayarlar\'dan seçebilirsiniz.'),
      items: SH.DOMLAR.map(d => ({ label: 'TM ' + d + '°', sub: d === oneri ? 'Önerilen (konumunuza göre)' : DOM_ILLER[d] || '', value: d, icon: d === oneri ? 'recommend' : 'public' })),
      actions: [{ label: 'Sonra', value: null }]
    });
    if (!v) return null;
    ot.projeAyarla({ koordinat: Object.assign({}, p.proje.koordinat, { dom: v }) }, 'Dilim seçildi');
    ot.konum(App.fix);
    return v;
  }
  App.domKontrol = domKontrol;

  const DOM_ILLER = {
    27: 'Edirne, Çanakkale, İzmir', 30: 'İstanbul, Bursa, Antalya batısı', 33: 'Ankara, Konya, Mersin',
    36: 'Kayseri, Sivas, Adana, Samsun', 39: 'Elazığ, Malatya, Erzincan, Trabzon', 42: 'Erzurum, Diyarbakır, Van batısı', 45: 'Kars, Iğdır, Van, Hakkari'
  };

  /** Aktif hakediş seçimi (mevcut hakedişler + yenisi). */
  async function hakedisSec() {
    const p = ot.p;
    const varolan = new Set();
    for (const k of ['elemanlar', 'hatlar', 'kanallar', 'sondajlar']) for (const o of p[k]) if (o.hakedis) varolan.add(o.hakedis);
    const aktif = ot.hakedis();
    varolan.add(aktif);
    const enBuyuk = Math.max(...varolan);
    const liste = [...varolan].sort((a, b) => b - a);
    const items = [{ label: 'Hakediş ' + (enBuyuk + 1), sub: 'Yeni hakediş başlat', value: enBuyuk + 1, icon: 'add' }]
      .concat(liste.map(h => ({ label: 'Hakediş ' + h, sub: h === aktif ? 'Şu an aktif' : '', value: h, icon: h === aktif ? 'radio_button_checked' : 'radio_button_unchecked' })));
    const v = await App.dialog({ title: 'Aktif hakediş', message: 'Yeni konulan eleman, hat ve malzemeler bu hakedişe yazılır.', items });
    if (!v || v === aktif) return null;
    ot.projeAyarla({ aktifHakedis: v }, 'Hakediş ' + v);
    toast('Aktif hakediş: ' + v);
    return v;
  }
  App.hakedisSec = hakedisSec;

  /** Bölge seçimi (null: tümü). */
  async function bolgeSecDialog(baslik, tumuEtiketi) {
    const p = ot.p;
    const items = [{ label: tumuEtiketi || 'Tümü', value: '*', icon: 'select_all' }]
      .concat(p.bolgeler.map(b => ({ label: b.ad || '(adsız)', sub: b.kod, value: b.id, icon: 'polyline' })));
    const v = await App.dialog({ title: baslik || 'Bölge', items });
    if (!v) return undefined;
    return v === '*' ? null : v;
  }
  App.bolgeSecDialog = bolgeSecDialog;

  // ---- M01 Projeler ----

  function renderProjeler(s) {
    const list = api('projects.list') || [];
    const host = s.$('#liste');
    host.replaceChildren();
    for (const m of list) {
      const n = m.sayilar || {};
      const alt = [n.eleman !== undefined ? n.eleman.toLocaleString('tr-TR') + ' eleman' : null, n.hat !== undefined ? n.hat.toLocaleString('tr-TR') + ' hat' : null,
        n.bolge ? n.bolge + ' bölge' : null, m.hakedis ? 'H' + m.hakedis : null].filter(Boolean).join(' · ');
      const el = App.make(s, 'proje', { ad: m.ad || m.id, alt: alt || '—', zaman: 'Son değişiklik ' + tarih(m.guncelleme) + (m.kaynak ? ' · ' + m.kaynak : '') });
      el.dataset.id = m.id;
      el.querySelector('[data-a="menu"]').dataset.id = m.id;
      host.appendChild(el);
    }
    App.show(s, 'bos', !list.length);
    set(s, 'sayi', list.length ? list.length + ' proje' : '');
    s.state.list = list;
  }

  App.screen('projeler', {
    mount: renderProjeler,
    resume: renderProjeler,
    event(s, type, d) {
      if (type === 'projectImported') {
        App.busy(false);
        if (d.error) {
          App.dialog({ title: 'Dosya açılamadı', message: d.error, actions: [{ label: 'Tamam', value: true, main: true }] });
          return;
        }
        toast((d.ad || 'Proje') + ' telefona alındı');
        projeAc(d.id);
      }
    },
    actions: {
      sec(s, el, ev) {
        if (ev && ev.target.closest('[data-a="menu"]')) return;
        projeAc(el.dataset.id);
      },
      async menu(s, el) {
        const m = (s.state.list || []).find(x => x.id === el.dataset.id);
        if (!m) return;
        const v = await App.dialog({
          title: m.ad,
          items: [
            { label: 'Aç', value: 'ac', icon: 'folder_open' },
            { label: 'Proje dosyasını paylaş', sub: '.sebeke.json — Drive, e-posta, WhatsApp', value: 'paylas', icon: 'ios_share' },
            { label: 'Telefondan sil', sub: 'Paylaşılmamış değişiklikler kaybolur', value: 'sil', icon: 'delete', color: '#B3261E' }
          ]
        });
        if (v === 'ac') projeAc(m.id);
        else if (v === 'paylas') {
          if (await projeAc(m.id)) App.push('disa-aktar');
        } else if (v === 'sil') {
          if (!(await App.confirmDanger('Projeyi sil', m.ad + ' telefondan silinsin mi? Fotoğrafları da silinir. Bu işlem geri alınamaz.', 'Sil'))) return;
          if (ot.id === m.id) ot.kapat();
          api('project.delete', { id: m.id });
          renderProjeler(s);
        }
      },
      ac() {
        toast('Proje dosyasını (.sebeke.json) seçin');
        api('project.import');
      },
      yeni() { App.push('proje-yeni'); },
      hakkinda() {
        App.dialog({
          title: 'Şebeke Hakediş',
          message: 'Sürüm ' + (App.version || '—') + '\n\nElektrik şebekesi hakediş ve durum tespiti için saha uygulaması. Bilgisayardaki AutoCAD eklentisiyle aynı proje dosyasını (.sebeke.json) kullanır.\n\nKonum: Bluetooth GNSS alıcısı (marka fark etmez, NMEA) ya da telefonun konumu (M-Survey RTK gibi uygulamaların verdiği konum dahil).',
          actions: [{ label: 'Tamam', value: true, main: true }]
        });
      }
    }
  });

  // ---- Yeni proje ----

  App.screen('proje-yeni', {
    mount(s) {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      set(s, 'ad', 'Proje ' + p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear());
      const f = App.fix;
      if (f && f.has && f.lon !== null) s.$('#dom').value = String(SH.domBoylamdan(f.lon));
    },
    actions: {
      olustur(s) {
        const ad = App.val(s, 'ad');
        if (!ad) return toast('Proje adını girin');
        const hak = Math.max(1, Math.round(SH.sayi(App.val(s, 'hakedis')) || 1));
        const onek = (App.val(s, 'onek') || 'SC').toUpperCase();
        const p = SH.yeniProje({ ad, dom: Number(s.$('#dom').value) || 0, hakedis: hak, katmanOnEki: onek, gisOnEki: onek });
        const bAd = App.val(s, 'bolgeAd');
        const bKod = App.val(s, 'bolgeKod');
        if (bAd || bKod) p.bolgeler.push({ id: SH.yeniId(), ad: bAd || ad, kod: bKod, sinir: [] });
        const meta = { ad, kaynak: 'telefon', hakedis: hak, sayilar: { eleman: 0, hat: 0, kanal: 0, nokta: 0, bolge: p.bolgeler.length } };
        const r = api('project.create', { text: SH.projeYaz(p, 'Şebeke Hakediş (telefon) ' + App.version), meta });
        if (!r || r.error) return toast((r && r.error) || 'Proje oluşturulamadı');
        projeAc(r.id).then(ok => { if (ok) App.push('harita'); });
      }
    }
  });

  // ---- M02 Proje ana ekranı ----

  function kaynakYazisi() {
    const f = App.fix;
    if (!f || !f.live) return App.kaynak === 'phone' ? 'Telefon konumu' : 'Alıcı bağlı değil';
    if (f.source === 'phone') return f.mock ? 'Harici konum (sahte konum)' : 'Telefonun GPS\'i';
    return (f.sats ? f.sats + ' uydu · ' : '') + 'Bluetooth alıcı';
  }

  function renderAna(s) {
    if (!ot.acik()) return App.root('projeler');
    const p = ot.p;
    const hak = ot.hakedis();
    const bolge = s.state.bolge || null;
    const icinde = o => !bolge || o.bolge === bolge;
    const el = p.elemanlar.filter(icinde);
    const hatlar = p.hatlar.filter(icinde);
    const kanallar = p.kanallar.filter(icinde);
    const dm = el.filter(e => e.durum === 'DM').length + hatlar.filter(h => h.durum === 'DM').length;
    const buHak = el.filter(e => e.hakedis === hak).length + hatlar.filter(h => h.hakedis === hak).length + kanallar.filter(c => c.hakedis === hak).length;
    const sayi = n => n.toLocaleString('tr-TR');
    setAll(s, {
      ad: p.proje.ad,
      hakedis: hak,
      bolge: bolge ? ((p.bolgeler.find(b => b.id === bolge) || {}).ad || '—') : 'Tümü',
      nEleman: sayi(el.length), nHat: sayi(hatlar.length), nKanal: sayi(kanallar.length), nDm: sayi(dm),
      nNokta: sayi(p.noktalar.filter(icinde).length), nHak: sayi(buHak),
      kaynak: kaynakYazisi()
    });
    App.show(s, 'domYok', !ot.dom());
    App.telemetry(s, App.fix || { live: false, kind: 'nodata' });
  }

  App.screen('ana', {
    mount: renderAna,
    resume: renderAna,
    fix(s, f) {
      App.telemetry(s, f);
      set(s, 'kaynak', kaynakYazisi());
      if (!ot.dom() && !ot.kutu && f.has) domKontrol(false).then(d => { if (d) renderAna(s); });
    },
    event(s, type) { if (type === 'veri') renderAna(s); },
    actions: {
      projeler() { ot.kapat(); App.root('projeler'); },
      async menu(s) {
        const v = await App.dialog({
          title: ot.p.proje.ad,
          items: [
            { label: 'Ayarlar', value: 'ayar', icon: 'settings' },
            { label: 'Geri al', sub: ot.geriAlinabilir() ? ot.geri[ot.geri.length - 1].mesaj : 'Geri alınacak işlem yok', value: 'geri', icon: 'replay' },
            { label: 'Projeyi kapat', value: 'kapat', icon: 'logout' }
          ]
        });
        if (v === 'ayar') App.push('ayarlar');
        else if (v === 'geri') {
          const m = ot.geriAl();
          toast(m ? 'Geri alındı: ' + m : 'Geri alınacak işlem yok');
        } else if (v === 'kapat') {
          ot.kapat();
          App.root('projeler');
        }
      },
      async hakedis(s) { if (await hakedisSec()) renderAna(s); },
      async bolge(s) {
        const v = await bolgeSecDialog('Sayılar hangi bölge için?', 'Tüm proje');
        if (v === undefined) return;
        s.state.bolge = v;
        renderAna(s);
      },
      async domSec(s) { if (await domKontrol(true)) renderAna(s); },
      harita() { App.root('harita'); },
      ozet() { App.root('ozet'); },
      disa() { App.push('disa-aktar'); },
      konum() { App.push('konum'); },
      bolgeler() { App.push('bolgeler'); },
      ayarlar() { App.push('ayarlar'); }
    }
  });

  // ---- M13 Ayarlar ----

  const EKPAY = [['AG_HAVAI', 'AG havai'], ['AG_YERALTI', 'AG yeraltı'], ['AYDINLATMA', 'Aydınlatma'], ['OG_HAVAI', 'OG havai'], ['OG_YERALTI', 'OG yeraltı'], ['REKORTMAN', 'Rekortman']];

  App.screen('ayarlar', {
    mount(s) {
      const p = ot.p;
      const a = ot.ayar();
      const pr = api('prefs.get') || {};
      setAll(s, {
        ad: p.proje.ad, hakedis: ot.hakedis(), gisOnEki: ot.gisOnEki(), katmanOnEki: ot.onEk(), dom: String(ot.dom()),
        olcumSuresi: a.olcumSuresi, antenYuksekligi: a.antenYuksekligi, enFazlaHata: a.enFazlaHata,
        kanalAlt: a.kanalAlt, kanalUst: a.kanalUst, kanalDerinlik: a.kanalDerinlik,
        surum: 'Şebeke Hakediş ' + (App.version || '') + (pr.googleKeyHint ? ' · Google ' + pr.googleKeyHint : '') + (pr.yandexKeyHint ? ' · Yandex ' + pr.yandexKeyHint : '')
      });
      s.$('[data-c="yukariYuvarla"]').checked = a.yukariYuvarla !== false;
      s.$('[data-c="yalnizFixed"]').checked = !!a.yalnizFixed;
      s.$('[data-c="autoConfig"]').checked = !!pr.autoConfig;
      s.$('#ekpay').innerHTML = EKPAY.map(([k, ad]) =>
        '<div class="flex flex-col gap-1"><label class="field-label">' + ad + ' +m</label><input data-ek="' + k + '" class="input num" inputmode="decimal" value="' + App.esc(a.ekPay[k] || 0) + '"></div>').join('');
      const b = api('map.base') || { providers: [] };
      s.$('#altlik').innerHTML = b.providers.map(x => '<option value="' + x.id + '"' + (x.id === b.id ? ' selected' : '') + '>' + App.esc(x.label) + (x.needs && !x.ready ? ' (anahtar gerekli)' : '') + '</option>').join('');
    },
    actions: {
      kaydet(s) {
        const n = (k, d) => { const v = SH.sayi(App.val(s, k)); return Number.isFinite(v) ? v : d; };
        const p = ot.p;
        const ekPay = {};
        s.$$('[data-ek]').forEach(i => { ekPay[i.dataset.ek] = Number.isFinite(SH.sayi(i.value)) ? SH.sayi(i.value) : 0; });
        const ayarlar = Object.assign({}, ot.ayar(), {
          yukariYuvarla: s.$('[data-c="yukariYuvarla"]').checked,
          ekPay: Object.assign({}, ot.ayar().ekPay, ekPay),
          olcumSuresi: Math.max(0, Math.round(n('olcumSuresi', 0))),
          antenYuksekligi: n('antenYuksekligi', 0),
          yalnizFixed: s.$('[data-c="yalnizFixed"]').checked,
          enFazlaHata: n('enFazlaHata', 0.1),
          kanalAlt: n('kanalAlt', 40), kanalUst: n('kanalUst', 40), kanalDerinlik: n('kanalDerinlik', 100)
        });
        const dom = Number(s.$('#a-dom').value) || 0;
        const set1 = {
          ad: App.val(s, 'ad') || p.proje.ad,
          aktifHakedis: Math.max(1, Math.round(n('hakedis', ot.hakedis()))),
          gisOnEki: (App.val(s, 'gisOnEki') || 'SC').toUpperCase(),
          katmanOnEki: (App.val(s, 'katmanOnEki') || 'SC').toUpperCase(),
          koordinat: Object.assign({}, p.proje.koordinat, { dom }),
          ayarlar
        };
        ot.projeAyarla(set1, 'Ayarlar kaydedildi');
        ot.konum(App.fix);
        const prefs = { autoConfig: s.$('[data-c="autoConfig"]').checked, basemap: s.$('#altlik').value };
        const g = App.val(s, 'googleKey');
        const y = App.val(s, 'yandexKey');
        if (g) prefs.googleTilesKey = g;
        if (y) prefs.yandexTilesKey = y;
        api('prefs.set', prefs);
        if (g) api('tiles.test', { kind: 'google' });
        if (y) api('tiles.test', { kind: 'yandex' });
        toast('Ayarlar kaydedildi');
        App.pop();
      }
    },
    event(s, type, d) {
      if (type === 'keyTest') toast(d.text);
    }
  });

  // ---- M10 Bölgeler ----

  function renderBolgeler(s) {
    const p = ot.p;
    const q = (App.val(s, 'ara') || '').toLocaleLowerCase('tr-TR');
    const sayac = new Map();
    for (const k of ['elemanlar', 'hatlar', 'kanallar']) for (const o of p[k]) sayac.set(o.bolge, (sayac.get(o.bolge) || 0) + 1);
    const host = s.$('#liste');
    host.replaceChildren();
    const list = p.bolgeler.filter(b => !q || (b.ad || '').toLocaleLowerCase('tr-TR').includes(q) || (b.kod || '').includes(q));
    for (const b of list) {
      const el = App.make(s, 'bolge', {
        ad: b.ad || '(adsız)',
        alt: (b.kod || 'kodsuz') + ' · ' + (sayac.get(b.id) || 0).toLocaleString('tr-TR') + ' nesne' + (b.sinir && b.sinir.length >= 3 ? '' : ' · sınır yok')
      });
      el.dataset.id = b.id;
      host.appendChild(el);
    }
    App.show(s, 'bos', !p.bolgeler.length);
  }

  async function bolgeDuzenle(b) {
    const r = await App.dialog({
      title: b ? 'Bölgeyi düzenle' : 'Yeni bölge',
      fields: [
        { key: 'ad', label: 'Proje adı (raporda PROJE)', value: b ? b.ad : '' },
        { key: 'kod', label: 'Proje kodu (BÖL.TARİFE)', value: b ? b.kod : '', mode: 'decimal' }
      ],
      actions: [{ label: 'Vazgeç', value: null }, { label: 'Kaydet', value: 'ok', main: true }]
    });
    if (!r || !r.ok) return null;
    return { ad: r.values.ad.trim(), kod: r.values.kod.trim() };
  }

  App.screen('bolgeler', {
    mount(s) {
      renderBolgeler(s);
      s.$('[data-b="ara"]').addEventListener('input', () => renderBolgeler(s));
    },
    resume: renderBolgeler,
    event(s, type) { if (type === 'veri') renderBolgeler(s); },
    actions: {
      async sec(s, el) {
        const b = ot.nesne('bolgeler', el.dataset.id);
        if (!b) return;
        const sinirVar = b.sinir && b.sinir.length >= 3;
        const v = await App.dialog({
          title: b.ad || '(adsız)',
          message: (b.kod || 'kodsuz') + (sinirVar ? ' · ' + SH.tr(SH.alan(b.sinir) / 10000, 2) + ' ha' : ' · sınır çizilmemiş'),
          items: [
            sinirVar ? { label: 'Haritada göster', value: 'goster', icon: 'map' } : null,
            { label: 'Adı ve kodu', value: 'duzenle', icon: 'edit' },
            { label: sinirVar ? 'Sınırı yeniden çiz' : 'Sınırı haritada çiz', value: 'ciz', icon: 'polyline' },
            { label: 'Bölgeyi sil', value: 'sil', icon: 'delete', color: '#B3261E' }
          ].filter(Boolean)
        });
        if (v === 'goster') App.push('harita', { odak: { k: 'bolgeler', id: b.id } });
        else if (v === 'duzenle') {
          const d = await bolgeDuzenle(b);
          if (d) ot.guncelle('bolgeler', b.id, x => { x.ad = d.ad; x.kod = d.kod; }, 'Bölge düzenlendi');
        } else if (v === 'ciz') App.push('harita', { mod: 'bolge', bolge: b.id });
        else if (v === 'sil') {
          if (!(await App.confirmDanger('Bölgeyi sil', (b.ad || 'Bölge') + ' silinsin mi? İçindeki nesneler silinmez; bölgeleri yeniden atayın.', 'Sil'))) return;
          ot.nesneSil('bolgeler', b.id);
        }
      },
      async yeni(s) {
        const d = await bolgeDuzenle(null);
        if (!d) return;
        const b = ot.bolgeKaydet({ ad: d.ad, kod: d.kod, sinir: [] });
        const v = await App.dialog({
          title: 'Bölge eklendi',
          message: 'Sınırı şimdi haritada çizebilirsiniz. Sınırı olmayan bölge, hiçbir sınırın içinde kalmayan nesnelere yazılır.',
          actions: [{ label: 'Sonra', value: false }, { label: 'Sınırı Çiz', value: true, main: true }]
        });
        if (v) App.push('harita', { mod: 'bolge', bolge: b.id });
      },
      async yenidenAta() {
        if (!(await App.confirmDanger('Bölgeleri yeniden ata', 'Tüm nesnelerin bölgesi sınırlara göre yeniden hesaplansın mı?', 'Yeniden ata'))) return;
        App.busy('Hesaplanıyor…');
        await App.frame();
        const n = ot.bolgeleriYenidenAta();
        App.busy(false);
        toast(n ? n + ' nesnenin bölgesi değişti' : 'Değişiklik yok');
      }
    }
  });
})();
