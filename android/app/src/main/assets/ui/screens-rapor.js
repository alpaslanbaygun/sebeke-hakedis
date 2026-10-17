// Hakediş özeti (M11) ve dışa aktarma (M12).
(function () {
  'use strict';
  const { api, set, setAll, toast } = App;
  const SH = window.SH;
  const ot = App.oturum;

  const MIME = {
    json: 'application/json',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dxf: 'application/dxf',
    csv: 'text/csv'
  };

  function dosyaAdi(ek, uzanti) {
    const ad = String(ot.p.proje.ad || 'proje').replace(/[\\/:*?"<>|\r\n]/g, '_').trim().slice(0, 60) || 'proje';
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return ad + (ek ? '_' + ek : '') + '_' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + uzanti;
  }

  async function excelUret(hakedis, bolge) {
    App.busy('Excel raporu hazırlanıyor…');
    await App.frame();
    try {
      const bytes = await window.SHX.raporYaz(ot.p, { surum: App.version, katsayilar: App.katsayilar, hakedis: hakedis || null, bolge: bolge || null });
      return window.SHX.base64(bytes);
    } finally {
      App.busy(false);
    }
  }

  async function gonder(tur, nasil, o) {
    const opt = o || {};
    let args;
    if (tur === 'json') {
      App.busy('Proje dosyası hazırlanıyor…');
      await App.frame();
      ot.sikistir();
      args = { name: dosyaAdi('', '.sebeke.json'), mime: MIME.json, text: ot.dosyaMetni(), subject: ot.p.proje.ad + ' — Şebeke Hakediş proje dosyası' };
    } else if (tur === 'xlsx') {
      const b64 = await excelUret(opt.hakedis, opt.bolge);
      args = { name: dosyaAdi('DURUMTESPIT' + (opt.hakedis ? '_H' + opt.hakedis : ''), '.xlsx'), mime: MIME.xlsx, b64, subject: ot.p.proje.ad + ' — Durum Tespit' };
    } else if (tur === 'dxf') {
      App.busy('Çizim hazırlanıyor…');
      await App.frame();
      args = { name: dosyaAdi('', '.dxf'), mime: MIME.dxf, b64: window.SHX.base64(window.SHD.dxf(ot.p)), subject: ot.p.proje.ad + ' — çizim' };
    } else if (tur === 'csv') {
      args = { name: dosyaAdi('noktalar', '.csv'), mime: MIME.csv, text: window.SHD.noktalarCsv(ot.p), subject: ot.p.proje.ad + ' — noktalar' };
    }
    await App.frame();
    const r = api(nasil === 'kaydet' ? 'file.save' : 'file.share', args);
    App.busy(false);
    if (r && r.error) toast(r.error);
  }
  App.disaGonder = gonder;

  // ---- M11 Hakediş özeti ----

  const SEKMELER = [['*', 'Tümü'], ['M', 'M'], ['M+M', 'M+M'], ['DM', 'Demontaj'], ['DM+M', 'Sök-Tak'], ['MEVCUT', 'Mevcut']];

  function hesapla(s) {
    const st = s.state;
    if (!st.tum || st.surum !== ot.rev) {
      st.tum = SH.durumTespit(ot.p, App.katsayilar);
      st.surum = ot.rev;
    }
    return SH.satirSuz(st.tum, ot.p, st.hakedis, st.bolge);
  }

  function renderOzet(s) {
    if (!ot.acik()) return App.root('projeler');
    const st = s.state;
    const satirlar = hesapla(s).filter(r => st.sekme === '*' || r.durum === st.sekme);
    const oz = SH.ozet(satirlar);
    const kg = satirlar.reduce((t, r) => t + (SH.birimler(r.birim)[1] === 'kg' ? r.toplam : 0), 0);
    setAll(s, {
      hakedis: st.hakedis ? 'Hakediş ' + st.hakedis : 'Tümü',
      bolge: st.bolge ? ((ot.nesne('bolgeler', st.bolge) || {}).ad || '—') : 'Tümü',
      kg: SH.tr(kg, 1) + ' kg',
      satir: satirlar.length.toLocaleString('tr-TR') + ' satır'
    });
    const gruplar = new Map();
    for (const r of oz) {
      let g = gruplar.get(r.cins);
      if (!g) {
        g = { cins: r.cins, satirlar: [], kg: 0, adet: 0 };
        gruplar.set(r.cins, g);
      }
      g.satirlar.push(r);
      if (SH.birimler(r.birim)[1] === 'kg') g.kg += r.toplam;
      g.adet += r.satir;
    }
    const liste = [...gruplar.values()].sort((a, b) => b.kg - a.kg || SH.ordinal(a.cins, b.cins));
    const acik = st.acik;
    const hepsi = st.hepsi;
    s.$('#gruplar').innerHTML = liste.map(g => {
      const a = hepsi || acik.has(g.cins) || liste.length <= 3;
      let html = '<div class="card overflow-hidden"><button data-a="grup" data-c="' + App.esc(g.cins) + '" class="w-full flex items-center gap-space-sm p-space-md text-left">' +
        '<span class="material-symbols-outlined text-secondary">' + (a ? 'expand_less' : 'expand_more') + '</span>' +
        '<div class="flex-1 min-w-0"><div class="text-body-md font-body-md font-semibold truncate">' + App.esc(g.cins) + '</div>' +
        '<div class="text-label-md font-label-md text-on-surface-variant">' + g.satirlar.length + ' tip · ' + g.adet + ' satır</div></div>' +
        (g.kg ? '<span class="text-title-md font-title-md num">' + SH.tr(g.kg, 1) + ' kg</span>' : '') + '</button>';
      if (a) {
        html += '<div class="overflow-x-auto"><table class="tablo"><tr><th>Tip</th><th>Durum</th><th>Miktar</th><th>Toplam</th></tr>' +
          g.satirlar.map(r => {
            const [gb, rb] = SH.birimler(r.birim);
            return '<tr><td>' + App.esc(r.tip) + (st.hakedis ? '' : ' <span class="text-secondary">H' + r.hakedis + '</span>') + '</td><td>' + App.esc(r.durum) + '</td>' +
              '<td>' + SH.tr(r.miktar, 2) + ' ' + App.esc(gb) + '</td><td><b>' + SH.tr(r.toplam, 2) + ' ' + App.esc(rb) + '</b></td></tr>';
          }).join('') + '</table></div>';
      }
      return html + '</div>';
    }).join('');
    App.show(s, 'bos', !liste.length);
    set(s, 'hepsiniAc', hepsi ? 'Hepsini kapat' : 'Hepsini aç');
  }

  App.screen('ozet', {
    mount(s) {
      if (!ot.acik()) return App.root('projeler');
      const st = s.state;
      st.hakedis = ot.hakedis();
      st.bolge = null;
      st.sekme = '*';
      st.acik = new Set();
      st.hepsi = false;
      const host = s.$('#sekmeler');
      host.innerHTML = SEKMELER.map(([v, l]) => '<button type="button" class="chip' + (v === '*' ? ' on' : '') + '" data-v="' + App.esc(v) + '">' + l + '</button>').join('');
      host.onclick = ev => {
        const b = ev.target.closest('[data-v]');
        if (!b) return;
        st.sekme = b.dataset.v;
        host.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
        renderOzet(s);
      };
      renderOzet(s);
    },
    resume: renderOzet,
    event(s, type) { if (type === 'veri') renderOzet(s); },
    actions: {
      proje() { App.root('ana'); },
      async hakedis(s) {
        hesapla(s);
        const varolan = new Set(s.state.tum.map(r => r.hakedis));
        const v = await App.dialog({
          title: 'Hakediş',
          items: [{ label: 'Tüm hakedişler', value: '*', icon: 'select_all' }].concat([...varolan].sort((a, b) => b - a).map(h => ({ label: 'Hakediş ' + h, value: String(h), icon: h === ot.hakedis() ? 'radio_button_checked' : 'radio_button_unchecked' })))
        });
        if (!v) return;
        s.state.hakedis = v === '*' ? null : Number(v);
        renderOzet(s);
      },
      async bolge(s) {
        const v = await App.bolgeSecDialog('Bölge', 'Tüm bölgeler');
        if (v === undefined) return;
        s.state.bolge = v;
        renderOzet(s);
      },
      grup(s, el) {
        const c = el.dataset.c;
        if (s.state.acik.has(c)) s.state.acik.delete(c); else s.state.acik.add(c);
        renderOzet(s);
      },
      hepsiniAc(s) {
        s.state.hepsi = !s.state.hepsi;
        s.state.acik.clear();
        renderOzet(s);
      },
      async excel(s) {
        const st = s.state;
        const v = await App.dialog({
          title: 'Durum Tespit raporu (Excel)',
          message: (st.hakedis ? 'Hakediş ' + st.hakedis : 'Tüm hakedişler') + (st.bolge ? ' · seçili bölge' : ''),
          actions: [{ label: 'Vazgeç', value: null }, { label: 'Kaydet', value: 'kaydet' }, { label: 'Paylaş', value: 'paylas', main: true }]
        });
        if (v) gonder('xlsx', v, { hakedis: st.hakedis, bolge: st.bolge });
      }
    }
  });

  // ---- M12 Dışa aktar ----

  App.screen('disa-aktar', {
    mount(s) {
      if (!ot.acik()) return App.root('projeler');
      set(s, 'hak', 'H' + ot.hakedis());
      let n = 0;
      for (const k of ['elemanlar', 'hatlar', 'kanallar', 'sondajlar']) for (const o of ot.p[k]) n += (o.fotolar || []).length;
      set(s, 'foto', n ? n + ' fotoğraf · tek zip dosyası' : 'Henüz fotoğraf yok');
    },
    actions: {
      projePaylas() { gonder('json', 'paylas'); },
      projeKaydet() { gonder('json', 'kaydet'); },
      excelPaylas(s) { gonder('xlsx', 'paylas', { hakedis: s.$('[data-c="yalnizHak"]').checked ? ot.hakedis() : null }); },
      excelKaydet(s) { gonder('xlsx', 'kaydet', { hakedis: s.$('[data-c="yalnizHak"]').checked ? ot.hakedis() : null }); },
      dxfPaylas() { gonder('dxf', 'paylas'); },
      dxfKaydet() { gonder('dxf', 'kaydet'); },
      csvPaylas() { gonder('csv', 'paylas'); },
      csvKaydet() { gonder('csv', 'kaydet'); },
      fotoPaylas() {
        const r = api('photo.share', { id: ot.id, name: dosyaAdi('fotograflar', '') });
        if (r && r.error) toast(r.error);
      }
    }
  });
})();
