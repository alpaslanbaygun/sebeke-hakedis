// Ayarlar › Düzeltme kaynağı: TUSAGA-Aktif (CORS-TR), kendi sabit istasyonunuz, yerel CORS ağları.
// Bağlantı türü NTRIP ya da doğrudan IP:port; akış denemesi (alıcısız), referans istasyonu ve uzaklığı, alıcı bağlanınca
// kendiliğinden bağlanma, bağlantı bilgisi dosyası (al / paylaş). Ayrıca alıcı ayar rehberi.
import { html, useState, useEffect, useBus, Icon, Chip, Seg, Sel, Badge, Toggle, Girdi, trn } from '../kit.js';
import { app } from '../ctx.js';
import {
  loadProfiles, activeProfile, updateActive, selectProfile, addProfile, removeProfile, setAuto, otomatikAyar, profilEksikleri,
  baglantiAyari, profilDosyasi, metindenProfiller, profilleriBirlestir, uzaklikKm, TUR_ADLARI, HAZIR
} from '../../gnss/ntrip-profiles.js';
import { RTCM_NAMES } from '../../gnss/rtcm.js';

const IPUCU = {
  tusaga: 'Kullanıcı adı ve şifre, tusaga-aktif.gov.tr hesabınızda alıcıya özel yazılıdır. "Bağlantı noktalarını getir" ile listeden VRS ile başlayan RTCM 3 noktasını seçin. GGA gönderme açık kalmalı: VRS düzeltmesi konumunuza göre hesaplanır.',
  sabit: 'Kendi sabit istasyonunuz: yayın bir NTRIP sunucusundan yapılıyorsa sunucu, port, bağlantı noktası, kullanıcı adı ve şifreyi girin; istasyon yalnız IP ve port verdiyse bağlantı türünü "Doğrudan IP" seçin. Bilgiler dosya ya da mesajla geldiyse "Dosyadan al" düğmesini kullanın.',
  yerel: 'Yerel CORS ağı (belediye vb.): sunucu, port, bağlantı noktası, kullanıcı adı ve şifreyi ağı işleten kurumdan alın.',
  diger: 'Sunucu, port ve (NTRIP\'te) bağlantı noktasını girin.'
};
const DURUM = { connected: 'Bağlı', connecting: 'Bağlanıyor', error: 'Hata', off: 'Kapalı' };
const TUR_KISA = { tusaga: 'TUSAGA-Aktif (CORS-TR)', sabit: 'Sabit istasyon', yerel: 'Yerel CORS ağı', diger: 'Diğer' };
const km = (v) => (v == null ? '' : v < 10 ? trn(v, 1) + ' km' : Math.round(v) + ' km');
const tur = (k) => RTCM_NAMES[k] ? k + ' · ' + RTCM_NAMES[k] : String(k);

/** Projedeki ilk konumlu nokta: alıcı konum vermeden VRS denemesi için yaklaşık konum. */
function yakinNokta() {
  const ps = app.ps;
  const p = ps && ps.p ? (ps.data.points || []).find((x) => x.lat != null && x.lon != null) : null;
  return p ? { lat: p.lat, lon: p.lon, alt: p.H } : null;
}

export function DuzeltmeBolumu() {
  useBus(['native:ntrip', 'native:gnssStatus', 'settings:change']);
  useBus('gnss:state', 1000);
  const g = app.gnss, s = g.state, native = app.bridge.isNative();
  const [np, setNp] = useState(() => app.state.ntripProfiles || loadProfiles(null, app.state.ntripCfg));
  const nt = activeProfile(np);
  const [mounts, setMounts] = useState([]);
  const [deneme, setDeneme] = useState(null);
  const [mesgul, setMesgul] = useState('');
  const [kurulum, setKurulum] = useState(false);
  // Açılışta profiller yüklenemediyse veritabanından okunur (boş listeyle kayıtlı profillerin üzerine yazılmasın)
  useEffect(() => {
    if (app.state.ntripProfiles) return;
    Promise.all([app.ds.setting('ntripProfiles'), app.ds.setting('ntrip')]).then(([pv, v]) => { const st = loadProfiles(pv, v); app.state.ntripProfiles = st; setNp(st); }).catch(() => {});
  }, []);
  const nts = g.ntrip;
  const tcp = nt.mode === 'tcp';
  const ref = s.lat != null ? { lat: s.lat, lon: s.lon } : yakinNokta();

  const saveNp = (st) => {
    setNp(st); app.state.ntripProfiles = st; app.state.ntripCfg = activeProfile(st);
    app.ds.setting('ntripProfiles', st); app.ds.setting('ntrip', activeProfile(st));
    g.autoNtrip = otomatikAyar(st);
  };
  const setN = (p) => { saveNp(updateActive(np, p)); setDeneme(null); };
  const bagliMi = nts.state === 'connected' || nts.state === 'connecting';
  const sec = (id) => {
    if (id === np.active) return;
    if (bagliMi) g.ntripDisconnect();
    setMounts([]); setDeneme(null);
    const st = selectProfile(np, id); saveNp(st);
    app.toast(activeProfile(st).name + ' seçildi' + (bagliMi ? ' · önceki bağlantı kesildi, "Bağlan" deyin' : ''));
  };
  const yeni = async () => {
    const kind = await app.modal((close) => html`<div class="mh"><h3>Yeni düzeltme profili</h3></div><div class="mb stack">
      ${['tusaga', 'sabit', 'yerel', 'diger'].map((k) => html`<button class="btn blk" style="justify-content:flex-start" onClick=${() => close(k)}>${TUR_ADLARI[k]}</button>`)}</div>
      <div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button></div>`);
    if (!kind) return;
    let ad = HAZIR[kind].name, i = 2;
    while (np.list.some((p) => p.name.toLocaleLowerCase('tr-TR') === ad.toLocaleLowerCase('tr-TR'))) ad = HAZIR[kind].name + ' ' + i++;
    const n = await app.prompt('Yeni profil · ' + TUR_ADLARI[kind], 'Profil adı', { required: true, value: ad, placeholder: 'ör. Sabit istasyon · Şantiye', note: 'Bağlantı bilgilerini profil seçiliyken aşağıdan girin ya da "Dosyadan al" ile alın.' });
    if (!n) return;
    try { setMounts([]); setDeneme(null); saveNp(addProfile(np, n, kind)); } catch (e) { app.toast(e.message, 'warn'); }
  };
  const sil = async () => {
    if (!(await app.confirm('Profili sil', '"' + nt.name + '" profili silinsin mi?', { danger: true, ok: 'Sil' }))) return;
    try { if (bagliMi) g.ntripDisconnect(); setMounts([]); setDeneme(null); saveNp(removeProfile(np, np.active)); } catch (e) { app.toast(e.message, 'warn'); }
  };
  const noktalar = async () => {
    if (!nt.host) return app.toast('Önce sunucu adresini girin', 'warn');
    setMesgul('liste');
    try {
      const r = await app.bridge.ntripSourcetable({ host: nt.host, port: nt.port, user: nt.user, pass: nt.pass, version: nt.version });
      const list = (r.mounts || []).map((m) => Object.assign({}, m, { km: ref && m.lat ? uzaklikKm(ref.lat, ref.lon, m.lat, m.lon) : null }));
      if (ref) list.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
      setMounts(list);
      app.toast(list.length + ' bağlantı noktası bulundu' + (list.length && !nt.mount ? ' · listeden seçin' : ''));
    } catch (e) { app.toast('Liste alınamadı: ' + e.message, 'err', 6000); }
    setMesgul('');
  };
  const dene = async () => {
    const eksik = profilEksikleri(nt);
    if (eksik.length) return app.toast('Eksik: ' + eksik.join(', '), 'warn', 5000);
    setMesgul('deneme'); setDeneme(null);
    try { setDeneme(await g.ntripProbe(baglantiAyari(nt), { seconds: 8, near: ref })); }
    catch (e) { setDeneme({ error: e.message }); }
    setMesgul('');
  };
  const baglan = async () => {
    const eksik = profilEksikleri(nt);
    if (eksik.length) return app.toast('Eksik: ' + eksik.join(', '), 'warn', 5000);
    try { await g.ntripConnect(baglantiAyari(nt), ref); } catch (e) { app.toast('Düzeltme: ' + e.message, 'err', 5000); }
  };
  const ice = async () => {
    const r = await app.modal((close) => { let txt = ''; return html`<div class="mh"><h3>Bağlantı bilgisi al</h3></div><div class="mb stack">
      <label class="btn blk"><${Icon} n="folder" s=${18} />Dosya seç (.json / .txt)<input type="file" accept=".json,.txt,application/json,text/plain" style="display:none" onChange=${async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) close({ text: await f.text(), ad: f.name }); }} /></label>
      <div class="fld"><label>ya da mesajdaki bilgiyi buraya yapıştırın</label><textarea class="inp mono" rows="5" style="height:auto;min-height:110px;padding:8px" placeholder=${'Sunucu: 1.2.3.4\nPort: 2101\nBağlantı noktası: NOKTA\nKullanıcı: …\nŞifre: …'} onInput=${(e) => { txt = e.target.value; }}></textarea></div>
      <div class="note">Tanınan biçimler: bu uygulamanın paylaştığı dosya · ntrip://kullanıcı:şifre@sunucu:2101/NOKTA · tcp://sunucu:port · "Sunucu / Port / Bağlantı noktası / Kullanıcı / Şifre" satırları.</div></div>
      <div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn grow pri" onClick=${() => close({ text: txt })}>Al</button></div>`; });
    if (!r || !r.text || !r.text.trim()) return;
    try {
      const gelen = metindenProfiller(r.text);
      if (!gelen.length) return app.toast('Metinde bağlantı bilgisi bulunamadı (sunucu adresi yok)', 'warn', 5000);
      const b = profilleriBirlestir(np, gelen);
      if (bagliMi) g.ntripDisconnect();
      setMounts([]); setDeneme(null); saveNp(b.st);
      app.toast((b.eklenen ? b.eklenen + ' profil eklendi' : '') + (b.eklenen && b.guncellenen ? ' · ' : '') + (b.guncellenen ? b.guncellenen + ' profil güncellendi' : '') + ' · seçili: ' + activeProfile(b.st).name, 'ok', 5000);
    } catch (e) { app.toast(e.message, 'err', 5000); }
  };
  const paylas = async () => {
    const dolu = np.list.filter((p) => p.host).length;
    if (!dolu) return app.toast('Paylaşılacak profil yok: önce sunucu bilgilerini girin', 'warn', 4000);
    const secim = await app.modal((close) => html`<div class="mh"><h3>Bağlantı bilgilerini paylaş</h3></div><div class="mb"><div class="note" style="font-size:14px">${dolu} profil tek dosyaya yazılır; dosya başka telefonda "Dosyadan al" ile alınır. Şifreler de yazılsın mı? Dosyayı alan herkes şifreleri görür.</div></div>
      <div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn grow" onClick=${() => close('sifreli')}>Şifrelerle</button><button class="btn grow pri" onClick=${() => close('sifresiz')}>Şifresiz</button></div>`);
    if (!secim) return;
    const u8 = new TextEncoder().encode(JSON.stringify(profilDosyasi(np, { sifreler: secim === 'sifreli' }), null, 2));
    try { await app.bridge.shareFile('Sebeke-M-GNSS-baglanti.json', 'application/json', u8); } catch (e) { app.toast(e.message, 'err', 5000); }
  };

  const bagli = nts.state === 'connected';
  const ist = bagli ? nts.station : null;
  const uzak = g.baseKm();
  const tipler = bagli && nts.types && Object.keys(nts.types).length ? Object.entries(nts.types) : [];
  const nereye = nts.state !== 'off' && nts.host ? (nts.mode === 'tcp' ? 'Doğrudan IP · ' + nts.host + ':' + nts.port : 'NTRIP · ' + (nts.mount || '') + ' · ' + nts.host) : '';
  return html`<div class="sect">Düzeltme kaynağı · CORS / sabit istasyon</div>
    <div class="card stack">
      <div class="lbl">Kayıtlı profiller · dokunarak seçin</div>
      <div class="chips">${np.list.map((p) => html`<${Chip} on=${p.id === np.active} onClick=${() => sec(p.id)}>${p.name || 'adsız'}</${Chip}>`)}<button class="chip" style="border-style:dashed" onClick=${yeni}>+ Profil ekle</button></div>
      <div class="row" style="align-items:flex-end"><div class="fld grow"><label>Profil adı · ${TUR_KISA[nt.kind] || TUR_KISA.diger}</label><${Girdi} key=${nt.id + ':ad'} cls="inp" value=${nt.name || ''} onSave=${(v) => setN({ name: v.trim() || 'profil' })} /></div>${np.list.length > 1 ? html`<button class="btn dang sm" style="height:48px" onClick=${sil}>Sil</button>` : null}</div>
      <div class="note">${IPUCU[nt.kind] || IPUCU.diger}</div>
      ${nt.kind === 'sabit' ? html`<button class="btn sm" onClick=${() => setKurulum(!kurulum)}><${Icon} n=${kurulum ? 'up' : 'down'} s=${16} />Sabit istasyon kurulurken firmadan istenecekler</button>
        ${kurulum ? html`<div class="card tight" style="padding:10px 12px"><ol class="note" style="margin:0;padding-left:18px;font-size:13px;line-height:1.5">
          <li><b>Yayın yolu:</b> NTRIP sunucusu (sunucu adresi ya da sabit IP, port, bağlantı noktası, kullanıcı adı, şifre) ya da doğrudan IP:port.</li>
          <li><b>İnternetten erişim:</b> sabit IP ya da alan adı; port (genelde 2101) dışarıya açık olmalı.</li>
          <li><b>Mesajlar:</b> RTCM 3.2 MSM4 ya da MSM5 (GPS, GLONASS, Galileo, BeiDou) + 1005 ya da 1006 (istasyon konumu) + 1033 + GLONASS için 1230; saniyede bir.</li>
          <li><b>İstasyon koordinatı:</b> TUSAGA-Aktif ile aynı datumda (ITRF96, 2005.0 epoğu), anten yüksekliği ve koordinat belgesi.</li>
          <li><b>Süreklilik:</b> kesintisiz güç kaynağı, sabit hat ya da mobil modem; kesintide yayının kendiliğinden yeniden başlaması.</li>
          <li><b>Kapsama:</b> tek istasyonda uzaklık arttıkça FIX zorlaşır; uygulama bağlıyken istasyona uzaklığı gösterir.</li></ol></div>` : null}` : null}

      <div class="row"><i style=${'width:10px;height:10px;border-radius:5px;background:' + (bagli ? '#10b981' : nts.state === 'connecting' ? '#f59e0b' : nts.state === 'error' ? '#ef4444' : 'var(--line3)')}></i><b class=${bagli ? 'hl' : ''}>${DURUM[nts.state] || nts.state}</b><span class="grow"></span><span class="mono note">${bagli ? trn((nts.rateBps || 0) / 1024, 1) + ' kB/s · yaş ' + (s.age != null ? trn(s.age, 1) + ' s' : '—') : ''}</span></div>
      ${nereye || (nts.state === 'error' && nts.error) ? html`<div class=${'note' + (nts.state === 'error' ? ' mono' : '')} style=${nts.state === 'error' ? 'color:var(--err3)' : ''}>${nts.state === 'error' && nts.error ? nts.error : nereye}</div>` : null}
      ${ist && ist.lat != null ? html`<div class="row"><${Icon} n="pin" s=${16} c="#22d3ee" /><span class="grow note">Referans istasyonu <b>${ist.id}</b>${uzak != null ? html` · <b>${km(uzak)}</b> uzakta` : ''}</span>${uzak != null && uzak > 20 ? html`<${Badge} k="warn">UZAK · FIX zorlaşabilir</${Badge}>` : null}</div>` : null}
      ${tipler.length ? html`<div class="row wrap" style="gap:4px">${tipler.map(([k, v]) => html`<span class="badge b-mut" title=${RTCM_NAMES[k] || ''}>${k}×${v}</span>`)}</div>` : null}

      <div class="fld"><label>Bağlantı türü</label><${Seg} value=${nt.mode} options=${[['ntrip', 'NTRIP'], ['tcp', 'Doğrudan IP (NTRIP\'siz)']]} onChange=${(v) => setN({ mode: v, sendGGA: v !== 'tcp' })} /></div>
      <div class="row"><div class="fld grow"><label>${tcp ? 'İstasyonun IP adresi / alan adı' : 'Sunucu'}</label><${Girdi} key=${nt.id + ':host'} placeholder=${tcp ? 'ör. 88.1.2.3' : '[SUNUCU IP / ad]'} autocomplete="off" autocapitalize="off" spellcheck="false" value=${nt.host} onSave=${(v) => setN({ host: v.trim() })} /></div><div class="fld" style="width:96px"><label>Port</label><${Girdi} key=${nt.id + ':port'} type="number" inputmode="numeric" placeholder=${tcp ? '9000' : '2101'} value=${nt.port || ''} onSave=${(v) => setN({ port: +v })} /></div></div>
      ${tcp ? html`<div class="note">Doğrudan IP: istasyon düzeltmeyi bu adresten düz yayınlar; bağlantı noktası, kullanıcı adı ve şifre gerekmez.</div>` : html`
      <div class="fld"><label>Bağlantı noktası (mountpoint)</label>${mounts.length ? html`<${Sel} mono value=${nt.mount} options=${[['', 'seçin'], ...mounts.map((m) => [m.name, m.name + ' · ' + (m.format || '') + (m.nmea ? ' · VRS' : '') + (m.km != null ? ' · ' + km(m.km) : '')])]} onChange=${(v) => setN({ mount: v })} />` : html`<${Girdi} key=${nt.id + ':mount'} placeholder=${nt.kind === 'tusaga' ? 'listeden seçin (ör. VRSRTCM31)' : 'ör. BASE1'} autocomplete="off" autocapitalize="off" spellcheck="false" value=${nt.mount} onSave=${(v) => setN({ mount: v.trim() })} />`}</div>
      <button class="btn sm" disabled=${!native || !!mesgul} onClick=${noktalar}><${Icon} n="list" s=${16} />${mesgul === 'liste' ? 'Liste alınıyor…' : 'Bağlantı noktalarını getir'}</button>
      <div class="grid2"><div class="fld"><label>Kullanıcı</label><${Girdi} key=${nt.id + ':user'} autocomplete="off" autocapitalize="off" spellcheck="false" value=${nt.user} onSave=${(v) => setN({ user: v })} /></div><div class="fld"><label>Şifre</label><${Girdi} key=${nt.id + ':pass'} type="password" autocomplete="off" value=${nt.pass} onSave=${(v) => setN({ pass: v })} /></div></div>
      <div class="fld"><label>NTRIP sürümü</label><${Seg} value=${nt.version} options=${[[1, 'v1.0'], [2, 'v2.0']]} onChange=${(v) => setN({ version: v })} /></div>`}
      <div class="row"><div class="grow"><b>Konumu (GGA) gönder</b><div class="note">${tcp ? 'Doğrudan IP\'de genelde gerekmez; istasyon isterse açın' : 'Her ' + (nt.ggaSec || 1) + ' s · VRS çözümü için gerekli; alıcı konum bulmadan önce telefonun ya da projenin yaklaşık konumu gider'}</div></div><${Toggle} on=${nt.sendGGA} onChange=${(v) => setN({ sendGGA: v })} label="GGA gönder" /></div>

      <div class="grid2"><button class="btn" disabled=${!native || !!mesgul || bagliMi} title=${bagliMi ? 'Bağlıyken denenmez (aynı hesapla ikinci bağlantı açılmasın)' : ''} onClick=${dene}>${mesgul === 'deneme' ? 'Deneniyor (8 s)…' : 'Akışı dene'}</button>${bagliMi ? html`<button class="btn dang" onClick=${() => g.ntripDisconnect()}>Bağlantıyı kes</button>` : html`<button class="btn pri" disabled=${!native || s.source !== 'external'} onClick=${baglan}>Bağlan</button>`}</div>
      ${deneme ? html`<div class=${'alert ' + (deneme.error ? 'err' : 'ok')} style="display:block">${deneme.error ? html`<b>Olmadı:</b> ${deneme.error}` : html`<b>Bağlantı tamam.</b> ${deneme.frames} mesaj geldi${deneme.firstDataMs >= 0 ? ' (ilk veri ' + trn(deneme.firstDataMs / 1000, 1) + ' s)' : ''}.
        ${deneme.station && deneme.station.lat != null ? html`<div>Referans istasyonu <b>${deneme.station.id}</b>${deneme.baseKm != null ? html` · <b>${km(deneme.baseKm)}</b> uzakta` : ''}</div>` : html`<div class="note">İstasyon konumu (1005/1006) bu sürede gelmedi.</div>`}
        <div class="note">${Object.keys(deneme.types || {}).map(tur).join(' · ')}</div>`}</div>` : null}
      <div class="row"><div class="grow"><b>Alıcı bağlanınca kendiliğinden bağlan</b><div class="note">Seçili profil eksiksizse alıcı her bağlandığında düzeltme de açılır (radyolu sabit base düzeninde açılmaz)</div></div><${Toggle} on=${np.auto !== false} onChange=${(v) => saveNp(setAuto(np, v))} label="Kendiliğinden bağlan" /></div>
      <div class="grid2"><button class="btn" onClick=${ice}><${Icon} n="down" s=${16} />Dosyadan al</button><button class="btn" onClick=${paylas}><${Icon} n="share" s=${16} />Paylaş</button></div>
      ${!native ? html`<div class="note">Düzeltme istemcisi APK içinde çalışır (RTCM doğrudan alıcıya iletilir). Tarayıcıda alıcının kendi NTRIP istemcisini kullanın.</div>` : s.source !== 'external' ? html`<div class="note">Bağlanmak için önce harici GNSS alıcısına bağlanın. "Akışı dene" alıcısız çalışır.</div>` : null}
    </div>`;
}

/** Alıcı ayarı (bir kez, alıcının kendi yazılımında yapılır): rover modu, Bluetooth'tan NMEA çıkışı ve düzeltme girişi. */
export function AliciRehberi() {
  const [acik, setAcik] = useState(false);
  return html`<button class="btn sm" onClick=${() => setAcik(!acik)}><${Icon} n=${acik ? 'up' : 'down'} s=${16} />Alıcı ayar rehberi (bir kez yapılır)</button>
    ${acik ? html`<div class="card tight" style="padding:10px 12px"><ol class="note" style="margin:0;padding-left:18px;font-size:13px;line-height:1.5">
      <li>Alıcıyı kendi yazılımından <b>Rover</b> moduna alın; düzeltme (veri) girişi olarak <b>Bluetooth / telefon</b> seçilsin.</li>
      <li>Bluetooth çıkışına <b>NMEA</b> açın: <b>GGA</b> (1 Hz ya da daha sık), <b>GST</b>, <b>GSA</b>, <b>RMC</b>.</li>
      <li>Düzeltme biçimi <b>RTCM 3</b> (çoğu alıcıda kendiliğinden tanınır).</li>
      <li>Alıcının kendi internet / NTRIP bağlantısı ve radyosu kapalı olsun: düzeltme bu uygulamadan gider, iki kaynak karışmasın.</li>
      <li>Telefonun Bluetooth ayarlarından alıcıyı eşleştirin, sonra burada <b>Cihaz Tara</b> ile seçin.</li>
      <li>Anten yüksekliğini bu bölümde girin; ölçümde nokta kotuna bu değer uygulanır.</li></ol>
      <div class="note" style="margin-top:6px">FIX olmuyorsa: düzeltme durumu "Bağlı" ve yaş birkaç saniye mi, alıcı GGA gönderiyor mu (yukarıda $GNGGA yeşil), gökyüzü açık mı, istasyon çok uzak mı bakın.</div></div>` : null}`;
}
