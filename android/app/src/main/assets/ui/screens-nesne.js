// Tip seçici (M05), nesne ayrıntısı (M08), malzeme ekleme (M09) ve kalem düzenleme.
(function () {
  'use strict';
  const { api, set, setAll, toast } = App;
  const SH = window.SH;
  const ot = App.oturum;

  const anahtar = it => it.cins + '|' + it.tanim;
  const kucuk = s => String(s || '').toLocaleLowerCase('tr-TR');
  const DURUMLAR = [['M', 'M'], ['M+M', 'M+M'], ['DM', 'DM'], ['DM+M', 'DM+M'], ['MEVCUT', 'Mevcut']];

  function rozetSinifi(durum) {
    return durum ? 'rozet rozet-' + durum.replace(/\+/g, 'M').replace('MMM', 'MM') : 'rozet';
  }

  function agirlikYazisi(it) {
    const [g, r] = SH.birimler(it.birim);
    if (r === 'kg') return SH.tr(it.katsayi, 2) + ' kg/' + (g === 'ad' ? 'ad' : g);
    if (it.katsayi && it.katsayi !== 1) return '× ' + SH.tr(it.katsayi, 3) + ' ' + r;
    return it.birim;
  }

  /** Elle kalem tanımı (katalogda olmayan tip / malzeme). */
  async function elleGir(ornek, baslik) {
    const r = await App.dialog({
      title: baslik || 'Elle gir',
      message: 'Katalogda olmayan kalem. Cins ve tarife PROMAGIS yazımıyla girilmeli (ör. AG_DEMİR_GLV, 0107).',
      fields: [
        { key: 'cins', label: 'Cins', value: ornek ? ornek.cins : '' },
        { key: 'tanim', label: 'Tip / tanım', value: '' },
        { key: 'birim', label: 'Birim (giriş/rapor)', value: ornek ? ornek.birim : 'ad/ad', options: ['ad/ad', 'ad/kg', 'mt/mt', 'mt/kg', 'kg/kg', 'm²/m²', 'mt/m³'] },
        { key: 'katsayi', label: 'Katsayı (ör. kg/ad)', value: ornek ? ornek.katsayi : 1, mode: 'decimal' },
        { key: 'tarife', label: 'Tarife', value: ornek ? ornek.tarife : '', mode: 'numeric' }
      ],
      actions: [{ label: 'Vazgeç', value: null }, { label: 'Tamam', value: 'ok', main: true }]
    });
    if (!r || !r.ok) return null;
    const v = r.values;
    if (!v.cins.trim() || !v.tanim.trim()) {
      toast('Cins ve tanım gerekli');
      return null;
    }
    const it = {
      cins: v.cins.trim().toLocaleUpperCase('tr-TR'), tanim: v.tanim.trim(), birim: v.birim, katsayi: SH.sayi(v.katsayi) || 1,
      tarife: v.tarife.trim(), rol: ornek ? ornek.rol : 'malzeme', nesneler: new Set(ornek ? [...ornek.nesneler] : []), kullanim: 0, kaynak: 'elle'
    };
    ot.katalog.push(it);
    return it;
  }

  // ---- M05 Tip seçici ----

  function tipListesi(s) {
    const prm = s.params;
    if (prm.liste === 'ana') return SH.anaTipler(ot.katalog, prm.tur);
    if (prm.liste === 'sondaj') return ot.katalog.filter(it => it.rol === 'sondaj');
    if (prm.liste === 'hat') {
      const ana = SH.hatKesitleri(ot.katalog, prm.tur);
      const varolan = new Set(ana.map(anahtar));
      const diger = ot.katalog.filter(it => !varolan.has(anahtar(it)) && (it.rol === 'hat' || /KABLO|İLETKEN|ALPEK|REKORTMAN/.test(it.cins)))
        .sort((a, b) => b.kullanim - a.kullanim);
      s.state.digerBas = ana.length;
      return ana.concat(diger);
    }
    return ot.katalog;
  }

  function tipKutusu(it, secili) {
    return '<button data-a="sec" data-k="' + App.esc(anahtar(it)) + '" class="card p-space-sm text-left min-h-[72px] flex flex-col justify-center active:bg-surface-container-low' +
      (secili ? ' !border-2 !border-[#0D4A7A]' : '') + '"><span class="text-title-md font-title-md truncate">' + App.esc(it.tanim) + '</span>' +
      '<span class="text-label-md font-label-md text-on-surface-variant truncate">' + App.esc(agirlikYazisi(it)) + '</span></button>';
  }

  function renderTip(s) {
    const liste = tipListesi(s);
    s.state.liste = liste;
    const q = kucuk(App.val(s, 'ara'));
    const secili = s.params.secili;
    const yildiz = ot.yildizlar();
    const bul = k => liste.find(x => anahtar(x) === k);
    const son = (ot.sonKullanilan((s.params.liste === 'hat' ? 'kesit:' : 'tip:') + s.params.tur) || []).map(bul).filter(Boolean).slice(0, 6);
    const yil = liste.filter(it => yildiz.has(anahtar(it)));
    App.show(s, 'sonBolum', !q && son.length > 0);
    App.show(s, 'yildizBolum', !q && yil.length > 0);
    s.$('#son').innerHTML = son.map(it => tipKutusu(it, anahtar(it) === secili)).join('');
    s.$('#yildiz').innerHTML = yil.map(it => tipKutusu(it, anahtar(it) === secili)).join('');
    const suz = liste.filter(it => !q || kucuk(it.tanim).includes(q) || kucuk(it.cins).includes(q));
    let html = '';
    suz.forEach((it, i) => {
      if (s.params.liste === 'hat' && !q && i === s.state.digerBas && i > 0) html += '<div class="field-label px-margin pt-space-md pb-space-sm bg-background">Diğer kablo ve iletkenler</div>';
      const on = yildiz.has(anahtar(it));
      html += '<div class="row !py-0 !pr-1" data-k="' + App.esc(anahtar(it)) + '">' +
        '<button data-a="sec" data-k="' + App.esc(anahtar(it)) + '" class="flex-1 min-w-0 text-left py-3">' +
        '<div class="text-body-lg font-body-lg font-semibold truncate' + (anahtar(it) === secili ? ' text-primary-container' : '') + '">' + App.esc(it.tanim) + '</div>' +
        '<div class="text-label-md font-label-md text-on-surface-variant truncate">' + App.esc(it.cins + ' · ' + agirlikYazisi(it) + (it.tarife ? ' · ' + it.tarife : '')) + '</div></button>' +
        '<button data-a="yildiz" data-k="' + App.esc(anahtar(it)) + '" class="w-12 h-12 flex items-center justify-center ' + (on ? 'text-[#CA8A04]' : 'text-outline') + '" aria-label="Yıldız">' +
        '<span class="material-symbols-outlined"' + (on ? ' style="font-variation-settings:\'FILL\' 1"' : '') + '>star</span></button></div>';
    });
    s.$('#tum').innerHTML = html;
    set(s, 'tumBaslik', (q ? 'Arama sonucu' : s.params.liste === 'hat' ? 'Bu hat türünün kesitleri' : 'Tüm tipler') + ' (' + suz.length + ')');
    App.show(s, 'bos', !suz.length);
  }

  App.screen('tip-sec', {
    mount(s) {
      set(s, 'baslik', s.params.baslik || 'Tip Seçin');
      renderTip(s);
      s.$('[data-b="ara"]').addEventListener('input', () => renderTip(s));
    },
    actions: {
      sec(s, el) {
        const it = s.state.liste.find(x => anahtar(x) === el.dataset.k);
        if (it) App.pop({ tip: it });
      },
      yildiz(s, el) {
        const on = ot.yildizDegistir(el.dataset.k);
        toast(on ? 'Yıldızlandı' : 'Yıldız kaldırıldı');
        renderTip(s);
      },
      async elle(s) {
        const ornek = (s.state.liste || [])[0];
        const it = await elleGir(ornek ? Object.assign({}, ornek, { nesneler: new Set([s.params.liste === 'hat' ? 'HAT_' + s.params.tur : s.params.tur]) }) : null, 'Yeni tip');
        if (it) App.pop({ tip: it });
      }
    }
  });

  // ---- M08 Nesne ayrıntısı ----

  const KOLEKSIYON_ADI = { elemanlar: 'Eleman', hatlar: 'Hat', kanallar: 'Kanal', sondajlar: 'Sondaj' };

  function nesneBaslik(k, o) {
    if (k === 'elemanlar') return SH.elemanTuru(o.tur).ad + (o.gisId ? ' ' + o.gisId : '');
    if (k === 'hatlar') return SH.hatTuru(o.tur).ad + ' hattı';
    if (k === 'kanallar') return 'Kanal · ' + SH.kanalKablolari(o.kod);
    if (k === 'sondajlar') return 'Yatay sondaj';
    return 'Ayrıntı';
  }

  function kalemSatiri(kl, i, kanal) {
    const [g, r] = SH.birimler(kl.birim);
    let hesap;
    if (kanal && kl.ana) hesap = SH.tr(kl.miktar, 2) + ' m → ' + SH.tr(kl.toplam, 3) + ' m³';
    else if (kl.katsayi !== 1 || g !== r) hesap = SH.tr(kl.miktar, 3) + ' ' + g + ' × ' + SH.tr(kl.katsayi, 3) + ' = ' + SH.tr(kl.toplam, 3) + ' ' + r;
    else hesap = SH.tr(kl.miktar, 3) + ' ' + g;
    return '<button data-a="kalem" data-i="' + i + '" class="row text-left">' +
      '<div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="text-body-md font-body-md font-semibold truncate">' + App.esc(kanal && kl.ana ? 'Kanal (' + kl.tanim + ')' : kl.tanim) + '</span>' +
      (kl.ana ? '<span class="rozet bg-[#E8EDF2] text-[#0F172A]">ana</span>' : '') + '</div>' +
      '<div class="text-label-md font-label-md text-on-surface-variant line-clamp-2">' + App.esc(kl.cins + ' · ' + hesap) + '</div></div>' +
      '<div class="flex flex-col items-end gap-1 shrink-0"><span class="' + rozetSinifi(kl.durum) + '">' + App.esc(kl.durum === 'MEVCUT' ? 'Mevcut' : kl.durum) + '</span>' +
      '<span class="text-label-sm font-label-sm text-secondary num">H' + kl.hakedis + (kl.dmDurum ? ' · ' + App.esc(kl.dmDurum) : '') + '</span></div></button>';
  }

  function renderNesne(s) {
    const { k, id } = s.params;
    const o = ot.nesne(k, id);
    if (!o) {
      App.pop();
      return;
    }
    s.state.o = o;
    const b = ot.nesne('bolgeler', o.bolge);
    set(s, 'baslik', nesneBaslik(k, o));
    const rozet = s.$('[data-rozet]');
    rozet.className = rozetSinifi(o.durum);
    rozet.textContent = o.durum === 'MEVCUT' ? 'Mevcut' : o.durum || '';
    const satir = (ad, deger, eylem) => '<div class="min-w-0"><div class="field-label">' + ad + '</div>' +
      (eylem ? '<button data-a="' + eylem + '" class="text-left text-body-md font-body-md font-semibold text-primary-container underline decoration-dotted truncate max-w-full">' + App.esc(deger) + '</button>'
        : '<div class="text-body-md font-body-md font-semibold truncate">' + App.esc(deger) + '</div>') + '</div>';
    let ozet = '';
    if (k === 'elemanlar') {
      setAll(s, { tip: o.tip, cins: o.cins });
      ozet = satir('GIS no', o.gisId || '—', 'gis') + satir('Hakediş', 'H' + o.hakedis) + satir('Bölge', b ? (b.kod || b.ad) : '—') + satir('Katman', o.katman || '—');
      set(s, 'koord', 'Y ' + o.saga.toFixed(3) + ' · X ' + o.yukari.toFixed(3) + (o.kot ? ' · Kot ' + o.kot.toFixed(2) : ''));
    } else if (k === 'hatlar') {
      const kl = o.kalemler.find(x => x.kaynak === 'HAT') || {};
      setAll(s, { tip: o.anaKesit, cins: kl.cins || '' });
      ozet = satir('Metraj', SH.tr(kl.miktar, 2) + ' m') + satir('Çizim', SH.uzunluk(o.kose).toFixed(2) + ' m') + satir('Hakediş', 'H' + o.hakedis) + satir('Bölge', b ? (b.kod || b.ad) : '—');
      set(s, 'koord', 'Etiket: ' + (o.etiket || '—'));
    } else if (k === 'kanallar') {
      const kl = o.kalemler.find(x => x.ana) || {};
      setAll(s, { tip: o.zemin, cins: 'Kanal kodu ' + o.kod + ' · ' + SH.kanalKablolari(o.kod) });
      ozet = satir('Ölçüler', o.altGenislik + '/' + o.ustGenislik + ' × ' + o.derinlik + ' cm', 'kanalOlcu') + satir('Hacim', SH.tr(kl.toplam, 3) + ' m³') +
        satir('Baş → bit', (o.basNo || '—') + ' → ' + (o.bitNo || '—')) + satir('Hakediş', 'H' + o.hakedis);
      set(s, 'koord', 'Çizim ' + SH.uzunluk(o.kose).toFixed(2) + ' m · bölge ' + (b ? (b.kod || b.ad) : '—'));
    } else if (k === 'sondajlar') {
      setAll(s, { tip: o.tip, cins: 'YATAY_DELGİ' });
      ozet = satir('Uzunluk', SH.uzunluk(o.kose).toFixed(2) + ' m') + satir('Hakediş', 'H' + o.hakedis);
      set(s, 'koord', 'Bölge ' + (b ? (b.kod || b.ad) : '—'));
    }
    s.$('#ozet').innerHTML = ozet;
    const olc = o.olcum;
    set(s, 'olcum', olc ? 'Ölçüm: ' + ({ alici: 'GNSS alıcı', telefon: 'telefon GPS', harici: 'harici uygulama', harita: 'haritadan' }[olc.kaynak] || olc.kaynak) +
      (olc.cozum ? ' · ' + olc.cozum : '') + (olc.hata ? ' · ±' + Number(olc.hata).toFixed(3) + ' m' : '') + (olc.zaman ? ' · ' + olc.zaman.slice(0, 16).replace('T', ' ') : '') : '');
    const kanal = k === 'kanallar' ? o : null;
    s.$('#kalemler').innerHTML = o.kalemler.map((kl, i) => kalemSatiri(kl, i, kanal)).join('') || '<div class="p-space-md text-on-surface-variant">Kalem yok</div>';
    const kg = o.kalemler.reduce((t, kl) => t + (SH.birimler(kl.birim)[1] === 'kg' ? kl.toplam : 0), 0);
    set(s, 'kalemOzet', o.kalemler.length + ' kalem' + (kg ? ' · ' + SH.tr(kg, 2) + ' kg' : ''));
    const fotolar = o.fotolar || [];
    s.$('#fotolar').innerHTML = fotolar.map(f => '<button data-a="fotoAc" data-f="' + App.esc(f) + '" class="w-24 h-24 rounded-xl overflow-hidden bg-surface-container shrink-0">' +
      '<img src="/foto/' + encodeURIComponent(ot.id) + '/' + encodeURIComponent(f) + '" class="w-full h-full object-cover" alt=""></button>').join('') +
      '<button data-a="foto" class="w-24 h-24 rounded-xl border-2 border-dashed border-[#B6C2CF] text-secondary flex flex-col items-center justify-center shrink-0"><span class="material-symbols-outlined">add_a_photo</span><span class="text-label-sm font-label-sm">Ekle</span></button>';
    const not = s.$('#not');
    if (document.activeElement !== not) not.value = o.not || '';
  }

  function notKaydet(s) {
    const o = s.state.o;
    if (!o) return;
    const not = s.$('#not').value.trim();
    if ((o.not || '') === not) return;
    ot.guncelle(s.params.k, s.params.id, x => {
      if (not) x.not = not; else delete x.not;
    }, 'Not kaydedildi');
  }

  /** Kalem düzenleme: miktar, durum, hakediş, söküm durumu, birim fiyat; ana olmayan kalem silinebilir. */
  async function kalemDuzenle(s, i) {
    const { k, id } = s.params;
    const o = ot.nesne(k, id);
    const kl = o.kalemler[i];
    if (!kl) return;
    const [g] = SH.birimler(kl.birim);
    const kanal = k === 'kanallar' && kl.ana;
    const fields = [
      { key: 'miktar', label: kanal ? 'Kanal metrajı (m)' : 'Miktar (' + g + ')', value: kl.miktar, mode: 'decimal' },
      { key: 'durum', label: 'Durum', value: kl.durum, options: DURUMLAR.map(([v, l]) => ({ value: v, label: l })).concat(['KM', 'ME'].includes(kl.durum) ? [{ value: kl.durum, label: kl.durum }] : []) },
      { key: 'hakedis', label: 'Hakediş', value: kl.hakedis, mode: 'numeric' }
    ];
    if (kl.ana && k === 'elemanlar') fields.push({ key: 'dmDurum', label: 'Söküm durumu (demontajda)', value: kl.dmDurum || '', options: [{ value: '', label: '—' }, { value: 'KESİK', label: 'Kesik' }, { value: 'SÖKÜK', label: 'Sökük' }] });
    fields.push({ key: 'birimFiyat', label: 'Birim fiyat (TL, isteğe bağlı)', value: kl.birimFiyat || 0, mode: 'decimal' });
    const actions = [{ label: 'Vazgeç', value: null }, { label: 'Kaydet', value: 'ok', main: true }];
    if (!kl.ana) actions.unshift({ label: 'Sil', value: 'sil', danger: true });
    const r = await App.dialog({ title: kanal ? 'Kanal kalemi' : kl.tanim, message: kl.cins + (kl.tarife ? ' · tarife ' + kl.tarife : '') + ' · ' + kl.birim, fields, actions });
    if (r === 'sil') {
      if (await App.confirmDanger('Kalemi sil', kl.tanim + ' silinsin mi?', 'Sil')) {
        ot.kalemSil(k, id, i);
        toast('Kalem silindi', { label: 'Geri Al', run: () => ot.geriAl() });
      }
      return;
    }
    if (!r || !r.ok) return;
    const v = r.values;
    const miktar = SH.sayi(v.miktar);
    if (!Number.isFinite(miktar) || miktar < 0) return toast('Miktar geçersiz');
    const degisiklik = {
      miktar, durum: v.durum, hakedis: Math.max(1, Math.round(SH.sayi(v.hakedis) || kl.hakedis)), birimFiyat: SH.sayi(v.birimFiyat) || 0
    };
    if ('dmDurum' in v) degisiklik.dmDurum = v.dmDurum || undefined;
    ot.kalemGuncelle(k, id, i, degisiklik);
  }

  App.screen('nesne', {
    mount(s) {
      renderNesne(s);
      s.$('#not').addEventListener('blur', () => notKaydet(s));
    },
    resume: renderNesne,
    leave(s) { notKaydet(s); },
    event(s, type, d) {
      if (type === 'veri') renderNesne(s);
      if (type === 'photo' && d.ref === s.params.id && d.id === ot.id) {
        ot.guncelle(s.params.k, s.params.id, x => { x.fotolar = (x.fotolar || []).concat([d.file]); }, 'Fotoğraf eklendi');
        toast('Fotoğraf eklendi');
      }
    },
    actions: {
      kalem(s, el) { kalemDuzenle(s, Number(el.dataset.i)); },
      malzemeEkle(s) { App.push('malzeme-ekle', { k: s.params.k, id: s.params.id }); },
      foto(s) {
        notKaydet(s);
        const r = api('photo.take', { id: ot.id, ref: s.params.id });
        if (r && r.error) toast(r.error);
      },
      async fotoAc(s, el) {
        const f = el.dataset.f;
        const v = await App.dialog({
          html: '<img src="/foto/' + encodeURIComponent(ot.id) + '/' + encodeURIComponent(f) + '" style="width:100%;border-radius:12px" alt="">',
          actions: [{ label: 'Sil', value: 'sil', danger: true }, { label: 'Paylaş', value: 'paylas' }, { label: 'Kapat', value: null, main: true }]
        });
        if (v === 'sil') {
          if (!(await App.confirmDanger('Fotoğrafı sil', 'Fotoğraf silinsin mi?', 'Sil'))) return;
          ot.guncelle(s.params.k, s.params.id, x => { x.fotolar = (x.fotolar || []).filter(y => y !== f); }, 'Fotoğraf silindi');
          api('photo.delete', { id: ot.id, file: f });
        } else if (v === 'paylas') {
          const r = api('photo.share', { id: ot.id, files: [f], name: f.replace(/\.jpg$/, '') });
          if (r && r.error) toast(r.error);
        }
      },
      async gis(s) {
        const o = s.state.o;
        const r = await App.dialog({ title: 'GIS no', input: { value: o.gisId || '' }, actions: [{ label: 'Vazgeç', value: null }, { label: 'Kaydet', value: 'ok', main: true }] });
        if (r && r.ok) ot.guncelle('elemanlar', o.id, x => { x.gisId = r.text.trim().toLocaleUpperCase('tr-TR'); }, 'GIS no değişti');
      },
      async kanalOlcu(s) {
        const o = s.state.o;
        const r = await App.dialog({
          title: 'Kanal ölçüleri (cm)',
          fields: [
            { key: 'alt', label: 'Alt genişlik', value: o.altGenislik, mode: 'numeric' },
            { key: 'ust', label: 'Üst genişlik', value: o.ustGenislik, mode: 'numeric' },
            { key: 'der', label: 'Derinlik', value: o.derinlik, mode: 'numeric' },
            { key: 'zemin', label: 'Zemin', value: o.zemin, options: SH.ZEMINLER.indexOf(o.zemin) >= 0 ? SH.ZEMINLER : [o.zemin].concat(SH.ZEMINLER) }
          ],
          actions: [{ label: 'Vazgeç', value: null }, { label: 'Kaydet', value: 'ok', main: true }]
        });
        if (!r || !r.ok) return;
        ot.guncelle('kanallar', o.id, x => {
          x.altGenislik = SH.sayi(r.values.alt) || 0;
          x.ustGenislik = SH.sayi(r.values.ust) || 0;
          x.derinlik = SH.sayi(r.values.der) || 0;
          x.zemin = r.values.zemin;
          for (const kl of x.kalemler) {
            if (kl.ana) {
              kl.tanim = x.zemin;
              SH.kalemToplami(kl, x);
            }
          }
        }, 'Kanal ölçüleri değişti');
      },
      haritada(s) {
        App.root('harita', { odak: { k: s.params.k, id: s.params.id } });
      },
      async menu(s) {
        const k = s.params.k;
        const v = await App.dialog({
          title: nesneBaslik(k, s.state.o),
          items: [
            k === 'elemanlar' ? { label: 'Türü değiştir', value: 'tur', icon: 'category' } : null,
            { label: 'Sil', value: 'sil', icon: 'delete', color: '#B3261E' }
          ].filter(Boolean)
        });
        if (v === 'sil') {
          if (!(await App.confirmDanger('Sil', nesneBaslik(k, s.state.o) + ' silinsin mi?', 'Sil'))) return;
          ot.nesneSil(k, s.params.id);
          toast('Silindi', { label: 'Geri Al', run: () => ot.geriAl() });
          App.pop();
        } else if (v === 'tur') {
          const o = s.state.o;
          const t = await App.dialog({ title: 'Eleman türü', items: SH.ELEMAN_TURLERI.map(x => ({ label: x.ad, value: x.kod, icon: x.kod === o.tur ? 'radio_button_checked' : 'radio_button_unchecked' })) });
          if (t && t !== o.tur) ot.guncelle('elemanlar', o.id, x => { x.tur = t; x.katman = ot.elemanKatmani(t, x.durum, x.hakedis); }, 'Tür değişti');
        }
      },
      kapat(s) {
        notKaydet(s);
        App.pop();
      }
    }
  });

  // ---- M09 Malzeme ekle ----

  function grupAdi(cins) {
    if (/TRAVERS|KONSOL/.test(cins)) return 'Travers';
    if (/İZOLATÖR/.test(cins)) return 'İzolatör';
    if (/TOPRAKLAMA/.test(cins)) return 'Topraklama';
    if (/KABLO|İLETKEN|ALPEK|REKORTMAN|BARA/.test(cins)) return 'Kablo';
    if (/ARMATÜR|AMPUL/.test(cins)) return 'Armatür';
    if (/MUFU|BAŞLIK/.test(cins)) return 'Mufu, başlık';
    return 'Diğer';
  }

  function nesneAnahtari(k, o) {
    if (k === 'elemanlar') return o.tur;
    if (k === 'hatlar') return 'HAT_' + o.tur;
    if (k === 'kanallar') return 'KANAL';
    return 'SONDAJ';
  }

  function renderMalzeme(s) {
    const st = s.state;
    const q = kucuk(App.val(s, 'ara'));
    const g = st.grup;
    const suz = st.liste.filter(it => (!q || kucuk(it.tanim).includes(q) || kucuk(it.cins).includes(q)) &&
      (g === 'bu' ? it.nesneler.has(st.nesne) : g === 'tum' ? true : grupAdi(it.cins) === g));
    s.$('#liste').innerHTML = suz.slice(0, 300).map(it => '<button data-a="sec" data-k="' + App.esc(anahtar(it)) + '" class="row">' +
      '<div class="min-w-0 flex-1"><div class="text-body-lg font-body-lg font-semibold truncate">' + App.esc(it.tanim) + '</div>' +
      '<div class="text-label-md font-label-md text-on-surface-variant truncate">' + App.esc(it.cins + ' · ' + agirlikYazisi(it)) + '</div></div>' +
      '<span class="material-symbols-outlined text-primary-container">add_circle</span></button>').join('');
    App.show(s, 'bos', !suz.length);
  }

  function panelHesap(s) {
    const it = s.state.secili;
    if (!it) return;
    const m = SH.sayi(App.val(s, 'pMiktar'));
    const [g, r] = SH.birimler(it.birim);
    set(s, 'pToplam', Number.isFinite(m) ? SH.tr(SH.temiz(m * it.katsayi), 3) + ' ' + r : '—');
    set(s, 'pMiktarEt', 'Miktar (' + g + ')');
  }

  App.screen('malzeme-ekle', {
    mount(s) {
      const { k, id } = s.params;
      const o = ot.nesne(k, id);
      const st = s.state;
      st.nesne = nesneAnahtari(k, o);
      st.liste = SH.malzemeler(ot.katalog, st.nesne);
      const buVar = st.liste.some(it => it.nesneler.has(st.nesne));
      st.grup = buVar ? 'bu' : 'tum';
      const gruplar = [['bu', 'Bu nesnede kullanılanlar'], ['tum', 'Tümü']].concat(['Travers', 'İzolatör', 'Topraklama', 'Kablo', 'Armatür', 'Mufu, başlık', 'Diğer'].map(x => [x, x]));
      const host = s.$('#gruplar');
      host.innerHTML = gruplar.map(([v, l]) => '<button type="button" class="chip' + (v === st.grup ? ' on' : '') + '" data-v="' + v + '">' + l + '</button>').join('');
      host.onclick = ev => {
        const b = ev.target.closest('[data-v]');
        if (!b) return;
        st.grup = b.dataset.v;
        host.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
        renderMalzeme(s);
      };
      s.$('[data-b="ara"]').addEventListener('input', () => renderMalzeme(s));
      s.$('[data-b="pMiktar"]').addEventListener('input', () => panelHesap(s));
      renderMalzeme(s);
    },
    back(s) {
      if (s.state.secili) {
        s.state.secili = null;
        App.show(s, 'panel', false);
        return true;
      }
      return false;
    },
    actions: {
      sec(s, el) {
        const it = s.state.liste.find(x => anahtar(x) === el.dataset.k);
        if (!it) return;
        acPanel(s, it);
      },
      async elle(s) {
        const ornek = s.state.liste[0];
        const it = await elleGir(ornek ? Object.assign({}, ornek, { rol: 'malzeme', nesneler: new Set([s.state.nesne]) }) : null, 'Yeni malzeme');
        if (it) {
          s.state.liste.unshift(it);
          acPanel(s, it);
        }
      },
      panelKapat(s) {
        s.state.secili = null;
        App.show(s, 'panel', false);
      },
      ekle(s) {
        const st = s.state;
        const it = st.secili;
        const m = SH.sayi(App.val(s, 'pMiktar'));
        if (!Number.isFinite(m) || m <= 0) return toast('Miktarı girin');
        const hatKalemi = s.params.k === 'hatlar' && it.rol === 'hat';
        ot.malzemeEkle(s.params.k, s.params.id, it, { miktar: m, durum: st.durum, hatKalemi });
        ot.tercihYaz('malzemeDurum', st.durum);
        toast(it.tanim + ' eklendi');
        App.pop();
      }
    }
  });

  function acPanel(s, it) {
    const st = s.state;
    st.secili = it;
    const o = ot.nesne(s.params.k, s.params.id);
    st.durum = ot.tercih('malzemeDurum', o.durum === 'DM' ? 'DM' : 'M+M');
    if (o.durum === 'DM') st.durum = 'DM';
    setAll(s, { pAd: it.tanim, pAlt: it.cins + ' · ' + agirlikYazisi(it) + ' · H' + ot.hakedis(), pMiktar: '1' });
    const host = s.$('[data-seg="pDurum"]');
    host.innerHTML = DURUMLAR.map(([v, l]) => '<button type="button" data-v="' + v + '"' + (v === st.durum ? ' class="on"' : '') + '>' + l + '</button>').join('');
    host.onclick = ev => {
      const b = ev.target.closest('[data-v]');
      if (!b) return;
      st.durum = b.dataset.v;
      host.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    };
    panelHesap(s);
    App.show(s, 'panel', true);
    setTimeout(() => { const i = s.$('[data-b="pMiktar"]'); i.focus(); i.select(); }, 60);
  }
})();
