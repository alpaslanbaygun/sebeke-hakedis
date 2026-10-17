// Konum kaynağı: Bluetooth GNSS alıcısı (marka fark etmez) + NTRIP, ya da telefonun konumu.
(function () {
  'use strict';
  const { api, set, setAll, toast } = App;
  const SH = window.SH;
  const ot = App.oturum;

  function kaynakCiz(s, kaynak) {
    App.kaynak = kaynak;
    s.$$('[data-kaynak]').forEach(b => {
      const on = b.dataset.kaynak === kaynak;
      b.classList.toggle('!border-2', on);
      b.classList.toggle('!border-[#0D4A7A]', on);
      b.classList.toggle('bg-[#DCEAF6]', on);
    });
    App.show(s, 'bt', kaynak === 'bt');
    App.show(s, 'tel', kaynak === 'phone');
  }

  function durumCiz(s, st) {
    if (!st) return;
    s.state.durum = st;
    kaynakCiz(s, st.source);
    setAll(s, {
      alici: st.bt.device || 'Seçilmedi — dokunun',
      btMsg: st.bt.msg,
      ntripMsg: st.ntrip.msg + (st.ntrip.state === 'on' ? ' · ' + st.ntrip.bytes : ''),
      telMsg: st.phone.msg + (st.phone.permission ? '' : ' · konum izni yok')
    });
  }

  function konumCiz(s, f) {
    App.telemetry(s, f || { live: false, kind: 'nodata' });
    const k = ot.acik() ? ot.konumTM : null;
    const f3 = v => (v === null || v === undefined ? '—' : v.toFixed(3));
    if (k && k.e !== null) setAll(s, { e: f3(k.e), n: f3(k.n), h: k.h === null ? '—' : k.h.toFixed(2) });
    else setAll(s, { e: '—', n: '—', h: f && f.hMsl !== null && f.hMsl !== undefined ? f.hMsl.toFixed(2) : '—' });
    let geo = '—';
    if (f && f.has) {
      geo = 'Enlem ' + f.lat.toFixed(8) + '° · Boylam ' + f.lon.toFixed(8) + '°';
      if (ot.acik() && !ot.dom()) geo += ' · dilim seçilmedi (Ayarlar)';
      else if (ot.acik()) geo += ' · TM ' + ot.dom() + '°';
    }
    set(s, 'geo', geo);
  }

  function ntripOku(s) {
    const n = api('ntrip.get') || {};
    setAll(s, { nHost: n.host, nPort: n.port || 2101, nMount: n.mount, nUser: n.user, nPass: n.pass });
    s.$('[data-c="nGga"]').checked = n.gga !== false;
    s.$('[data-c="nAuto"]').checked = !!n.auto;
  }

  function ntripYaz(s) {
    api('ntrip.save', {
      host: App.val(s, 'nHost'), port: App.val(s, 'nPort'), mount: App.val(s, 'nMount'), user: App.val(s, 'nUser'),
      pass: s.$('[data-b="nPass"]').value, gga: s.$('[data-c="nGga"]').checked, auto: s.$('[data-c="nAuto"]').checked
    });
  }

  async function aliciSec(s) {
    const r = api('bt.devices') || {};
    if (r.needPermission) {
      api('bt.permission');
      return toast('Bluetooth iznini verin');
    }
    if (r.disabled) {
      api('bt.enable');
      return toast('Bluetooth kapalı');
    }
    if (r.unavailable) return toast('Bu telefonda Bluetooth yok');
    const list = r.devices || [];
    if (!list.length) {
      const go = await App.dialog({ title: 'Eşleşmiş alıcı yok', message: 'Alıcıyı önce telefonun Bluetooth ayarlarından eşleştirin.', actions: [{ label: 'Vazgeç', value: false }, { label: 'Bluetooth Ayarları', value: true, main: true }] });
      if (go) api('bt.settings');
      return;
    }
    const v = await App.dialog({
      title: 'Alıcı seçin',
      items: list.map(d => ({ label: d.name, sub: d.address, value: d.address, icon: d.selected ? 'radio_button_checked' : 'bluetooth' }))
    });
    if (!v) return;
    const d = list.find(x => x.address === v);
    durumCiz(s, api('bt.select', { address: d.address, name: d.name }));
  }

  App.screen('konum', {
    mount(s) {
      durumCiz(s, api('status'));
      ntripOku(s);
      konumCiz(s, App.fix);
    },
    leave(s) { ntripYaz(s); },
    fix(s, f) { konumCiz(s, f); },
    event(s, type, d) {
      if (type === 'status') durumCiz(s, d);
      else if (type === 'permission') toast('İzin verildi');
      else if (type === 'mounts') {
        if (d.error) return toast(d.error);
        App.dialog({ title: 'Bağlama noktaları', items: d.mounts.map(m => ({ label: m, value: m, icon: 'cell_tower' })) }).then(v => {
          if (v) {
            set(s, 'nMount', v);
            ntripYaz(s);
          }
        });
      }
    },
    actions: {
      kaynakBt(s) {
        const r = api('source.set', { source: 'bt' });
        if (r && r.error) return toast(r.error);
        kaynakCiz(s, 'bt');
        durumCiz(s, api('status'));
      },
      kaynakTel(s) {
        const r = api('source.set', { source: 'phone' });
        if (r && r.error) return toast(r.error);
        if (r && r.needPermission) toast('Konum iznini verin');
        kaynakCiz(s, 'phone');
        durumCiz(s, api('status'));
      },
      aliciSec(s) { aliciSec(s); },
      btAyar() { api('bt.settings'); },
      baglan(s) {
        const r = api('bt.connect') || {};
        if (r.needPermission) {
          api('bt.permission');
          return toast('Bluetooth iznini verip yeniden deneyin');
        }
        if (r.error) return toast(r.error);
        toast('Bağlanılıyor…');
      },
      kes() { api('bt.disconnect'); },
      ntripBaslat(s) {
        ntripYaz(s);
        const r = api('ntrip.start');
        if (r && r.error) toast(r.error);
      },
      ntripDurdur() { api('ntrip.stop'); },
      mountListe(s) {
        const r = api('ntrip.mounts', { host: App.val(s, 'nHost'), port: App.val(s, 'nPort') });
        if (r && r.error) toast(r.error);
        else toast('Liste alınıyor…');
      },
      konumAyar() { api('phone.settings'); },
      gelistirici() { api('dev.settings'); }
    }
  });
})();
