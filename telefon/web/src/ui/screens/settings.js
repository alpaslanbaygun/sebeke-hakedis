// 06 · Ayarlar — konum kaynağı, GNSS alıcı (Bluetooth SPP/BLE), NTRIP, hassasiyet eşikleri, proje CRS/geoit, senkron, kullanıcı
import { html, useState, useEffect, useBus, Icon, Chip, Seg, Sel, Badge, Title, Toggle, Girdi, fmt, trn, FIXCOL } from '../kit.js';
import { DuzeltmeBolumu, AliciRehberi } from './duzeltme.js';
import { app } from '../ctx.js';
import { makeCrs, crsSummary, zoneForLon, TM_ZONES, parseGeoidGrid } from '../../geo/crs.js';
import { pendingChanges } from '../../core/sync.js';
import { BASEMAPS, ALTLIK_GRUPLARI, basemapById, basemapReady, prefetchArea } from '../services.js';
import { unproject } from '../../geo/crs.js';

export function SettingsScreen() {
  useBus('gnss:state', 500);
  useBus(['project:computed', 'settings:change', 'native:ntrip', 'native:gnssStatus', 'auth:change']);
  const g = app.gnss, s = g.state, ps = app.ps;
  const [devs, setDevs] = useState(null);
  const [scan, setScan] = useState(false);
  const [pend, setPend] = useState(0);
  const [ver, setVer] = useState(null);
  const [floatCap, setFloatCap] = useState(true);
  const [keys, setKeys] = useState(app.state.mapKeys || {});
  const saveKeys = (p) => { const k = Object.assign({}, keys, p); setKeys(k); app.state.mapKeys = k; app.ds.setting('mapKeys', k); app.bus.emit('tiles:error', { anahtar: true }); app.toast('Kaydedildi (yalnız bu cihazda saklanır)', 'ok', 2200); };
  useEffect(() => { app.ds.setting('floatCapture').then((v) => setFloatCap(v !== false)); }, []);
  useEffect(() => { pendingChanges(app.ds).then((x) => setPend(x.length)); app.bridge.info().then(setVer).catch(() => {}); }, []);
  const native = app.bridge.isNative();
  const usePhone = async () => { try { await g.usePhone(); app.toast('Telefon konum servisi · TEST modu', 'warn'); } catch (e) { app.toast(e.message, 'err'); } };
  const listBt = async () => { setScan(true); try { const b = await app.bridge.btBonded(); let ble = []; try { ble = await app.bridge.bleScan(5000); } catch (e) { /* BLE yok */ } const bonded = (b || []).map((d) => Object.assign(d, { type: d.kind === 'le' ? 'ble' : 'spp' })); setDevs([...bonded, ...(ble || []).filter((x) => !bonded.some((y) => y.address === x.address)).map((d) => Object.assign(d, { type: 'ble' }))]); } catch (e) { app.toast(e.message, 'err'); } setScan(false); };
  const connect = async (d) => { try { await g.connectExternal({ type: d.type, address: d.address, name: d.name }); await app.ds.setting('lastReceiver', d); app.toast(d.name + ' bağlanıyor…'); } catch (e) { app.toast(e.message, 'err'); } };
  const webConnect = async (type) => { try { await g.connectExternal({ type, name: type === 'web-serial' ? 'USB/seri alıcı' : 'BLE alıcı', baud: 115200 }); } catch (e) { app.toast(e.message, 'err'); } };
  const th = Object.assign({}, g.thresholds);
  const setTh = (k, v) => { const t = Object.assign({}, ps.p.thresholds || {}, { [k]: v }); ps.updateProject({ thresholds: t }, 'Eşik: ' + k + ' = ' + v); };
  const ant = g.antenna;
  const setAnt = (p) => { g.configure({ antenna: p }); app.ds.setting('antenna', Object.assign({}, g.antenna)); };
  const nts = s.ntrip || g.ntrip;
  const types = (g.stream && g.stream.seen) || {};
  const crs = ps.p ? ps.p.crs : null;
  const setCrs = async (o) => { const c = makeCrs(Object.assign({ datum: crs.datum, projection: crs.projection, cm: crs.cm, zone: crs.zone }, o)); if (!(await app.confirm('Koordinat sistemi', c.label + ' seçilsin mi? Tüm noktaların Y/X değerleri enlem/boylamdan yeniden hesaplanır (denetim kaydına yazılır).'))) return; await ps.updateProject({ crs: c }, 'CRS: ' + c.label); app.toast('CRS: ' + c.label); };
  const autoZone = () => { const lon = s.lon ?? (ps.data.points.find((p) => p.lon != null) || {}).lon; if (lon == null) return app.toast('Boylam için konum gerekli', 'warn'); setCrs({ cm: zoneForLon(lon) }); };
  const geoidFile = async (f) => { if (!f) return; try { const grid = parseGeoidGrid(await f.text()); await ps.updateProject({ geoid: { model: 'grid', name: f.name, grid } }, 'Geoit ızgarası yüklendi: ' + f.name); app.toast('Geoit ızgarası: ' + grid.rows + '×' + grid.cols); } catch (e) { app.toast(e.message, 'err'); } };
  const offline = async () => {
    const bm = basemapById(app.state.basemap || 'none');
    if (!basemapReady(bm)) return app.toast('Önce haritada altlık seçin', 'warn');
    if (!bm.offline) return app.toast(bm.label + ': kullanım koşulları toplu / offline indirmeye izin vermiyor. Gördüğünüz alanlar zaten cihazda saklanır.', 'warn', 7000);
    const v = app.state.view; if (!v) return app.toast('Haritayı açın', 'warn');
    const a = unproject(v.cE - v.res * 200, v.cN - v.res * 400, crs), b = unproject(v.cE + v.res * 200, v.cN + v.res * 400, crs);
    const z0 = Math.max(12, Math.round(Math.log2(156543 / v.res)) - 1);
    try { const n = await prefetchArea(bm, { w: a.lon, s: a.lat, e: b.lon, n: b.lat }, z0, Math.min(19, z0 + 3), 1500, (d, t) => { if (d % 50 === 0) app.toast('Karo ' + d + '/' + t, 'ok', 800); }); app.toast(n + ' karo offline kaydedildi'); } catch (e) { app.toast(e.message, 'err', 6000); }
  };
  return html`<div class="title"><div class="grow"><h1>Ayarlar</h1><div class="sub" style="font-family:Inter">${app.web ? 'Proje ayarları: kontrol eşikleri, koordinat sistemi, tanımlar' : 'Konum kaynağı, GNSS alıcı, NTRIP ve hassasiyet'}</div></div></div>
    ${app.web ? html`<div class="alert info"><${Icon} n="info" s=${16} /><span>Web sürümü ofis içindir: ölçüm (GNSS alıcı, NTRIP, telefon GPS) telefondaki uygulamayla yapılır. Buradaki ayarlar proje verisini ilgilendirir ve buluta kaydedilir.</span></div>` : html`    <div class="sect">Konum kaynağı</div>
    <div class="card stack">
      <div class="grid2">
        <button class=${'chip' + (s.source === 'phone' ? ' on' : '')} style="min-height:62px;flex-direction:column;--c:#38bdf8" onClick=${usePhone}><b style="font-size:16px">Telefon GPS</b><small>test · ±3–10 m</small></button>
        <button class=${'chip' + (s.source === 'external' ? ' on' : '')} style="min-height:62px;flex-direction:column" onClick=${() => (native ? listBt() : webConnect('web-serial'))}><b style="font-size:16px">Harici GNSS</b><small>RTK · ±1–2 cm</small></button>
      </div>
      ${s.source === 'phone' ? html`<div class="alert warn"><${Icon} n="warn" s=${16} /><span>Telefon GPS doğruluğu ±3–10 m. Noktalar "TEST / DÜŞÜK DOĞRULUK" olarak işaretlenir; kritik noktalar RTK FIX ile yeniden ölçülene kadar kontrol listesinde "ÖLÇÜ KABUL EDİLMEDİ" kalır.</span></div>` : null}
      <div class="row"><span class="grow note">Etkin: <b style=${'color:' + (FIXCOL[s.fix] || '#94a3b8')}>${s.source === 'none' ? 'yok' : (s.receiver || {}).name || s.source}</b> ${s.connected ? '· bağlı' : ''}</span>${s.source !== 'none' ? html`<button class="btn dang sm" onClick=${() => g.stopAll()}>Kaynağı kapat</button>` : null}</div>
    </div>
    <div class="sect">Ölçüm yöntemi</div>
    <div class="card stack">
      ${[['TELEFON_GPS', 'Telefon GPS', '±3–10 m · [TELEFON GPS]'], ['HARICI_GNSS', 'Harici GNSS', 'Düzeltmesiz / alıcı düzeltmesi'], ['RTK_NTRIP', 'RTK · CORS / sabit istasyon', 'TUSAGA-Aktif, sabit istasyon, yerel ağ · [RTK FIX]'], ['BASE_ROVER', 'Sabit Base + Rover', g.base ? 'Base: ' + g.base.name + (g.base.link ? ' · ' + g.base.link : '') : 'Kendi base istasyonunla · rehberi aç'], ['MANUEL', 'Manuel', 'Koordinat elle / haritadan / Excel · haritada KAYNAK düğmesi']].map(([k, t, d]) => { const on = k === 'MANUEL' ? (app.state.srcMode === 'manual' || app.state.srcMode === 'map') : s.method === k && !(app.state.srcMode === 'manual' || app.state.srcMode === 'map'); return html`<button class=${'srcopt' + (on ? ' on' : '')} style="--c:#10b981" onClick=${async () => {
        if (k === 'TELEFON_GPS') { app.state.srcMode = 'gnss'; await usePhone(); }
        else if (k === 'BASE_ROVER') app.nav.go('baseRover');
        else if (k === 'MANUEL') { app.state.srcMode = 'manual'; app.toast('Haritada KAYNAK düğmesinden Manuel / Haritadan / Excel seçilebilir', 'ok', 4000); app.nav.tab('map'); }
        else { app.state.srcMode = 'gnss'; if (g.method === 'BASE_ROVER') { g.setMethod(null); await app.ds.setting('gnssMethod', { method: null, base: g.base }); } if (s.source !== 'external') (native ? listBt() : webConnect('web-serial')); else if (k === 'RTK_NTRIP' && nts.state !== 'connected') app.toast('Düzeltme kaynağı bölümünden bağlanın (aşağıda)', 'warn', 4000); }
      }}><i></i><span class="grow"><b>${t}</b><small>${d}</small></span></button>`; })}
      <div class="note">Etkin yöntem her ölçüm kaydına yazılır: cihaz, seri no, fix, uydu, HDOP/VDOP/PDOP, düzeltme kaynağı, base ve rover bilgisi, operatör.</div>
    </div>
    <div class="card tight list">
      ${[['Telefon konum servisi', 'Android konum + GNSS durumu · test aşaması', s.source === 'phone'], ['Harici GNSS · Bluetooth NMEA', '$GNGGA, $GNGST, $GNGSA, $GNRMC, $GNHDT · fix tipi ve σ', s.source === 'external'], ['Düzeltmeli RTK · CORS / sabit istasyon', 'RTCM3 → alıcı · NTRIP ya da doğrudan IP · santimetre', nts.state === 'connected']].map(([t, d, on]) => html`<div class="li"><span class=${'badge ' + (on ? 'b-cy' : 'b-ok')} style="width:62px;justify-content:center">${on ? 'ŞİMDİ' : 'HAZIR'}</span><div class="grow"><div class="t" style="font-size:13px">${t}</div><div class="s">${d}</div></div></div>`)}
      <div class="note" style="padding:10px 12px">Her noktada kaynak · σH / σV · fix tipi · zaman · cihaz saklanır. Telefonla alınan nokta sonradan GNSS ile ölçülünce yeni kayıt açılmaz; aynı Point ID'nin koordinatı ve kaynağı revize edilir.</div>
    </div>

    <div class="sect">GNSS alıcı · Bluetooth</div>
    <div class="card stack">
      <div class="row"><span style="width:44px;height:44px;border-radius:8px;border:1px solid #334155;display:flex;align-items:center;justify-content:center"><${Icon} n="bt" c="#22d3ee" /></span><div class="grow"><b style="font-size:17px">${s.source === 'external' ? (s.receiver || {}).name : 'Alıcı seçilmedi'}</b><div class="mono note">${s.source === 'external' ? ((s.link || {}).type || '').toUpperCase() + ' · ' + ((s.link || {}).address || '') + (s.rateHz ? ' · ' + Math.round(s.rateHz) + ' Hz' : '') : native ? 'Eşleşmiş cihazlar listelenir' : 'Masaüstü: Web Serial / Web Bluetooth'}</div></div>${s.source === 'external' ? html`<${Badge} k=${s.connected ? 'ok' : 'warn'}>${s.connected ? 'BAĞLI' : 'BEKLİYOR'}</${Badge}>` : null}</div>
      <div class="grid2">${native ? html`<button class="btn" disabled=${scan} onClick=${listBt}>${scan ? 'Taranıyor…' : 'Cihaz Tara'}</button>` : html`<button class="btn" onClick=${() => webConnect('web-serial')}>USB / Seri</button>`}${native ? html`<button class="btn dang" disabled=${s.source !== 'external'} onClick=${() => g.stopAll()}>Bağlantıyı Kes</button>` : html`<button class="btn" onClick=${() => webConnect('web-ble')}>Web Bluetooth</button>`}</div>
      ${devs ? html`<div class="card tight list">${devs.map((d) => html`<button class="li" onClick=${() => connect(d)}><${Badge} k=${d.type === 'ble' ? 'cy' : 'mut'}>${d.type.toUpperCase()}</${Badge}><div class="grow"><div class="t" style="font-size:13px">${d.name || '(adsız)'}</div><div class="m">${d.address}${d.rssi ? ' · ' + d.rssi + ' dBm' : ''}</div></div><${Icon} n="next" s=${16} /></button>`)}${!devs.length ? html`<div class="empty">Cihaz bulunamadı · alıcıyı telefonun Bluetooth ayarlarından eşleştirin</div>` : null}</div>` : null}
      <div class="fld"><label>Anten yüksekliği</label><div class="row"><${Girdi} type="number" step="0.001" inputmode="decimal" style="flex:1;font-size:18px;color:#10b981" value=${ant.height} onSave=${(v) => setAnt({ height: +v })} /><${Chip} on=${ant.measure === 'vertical'} onClick=${() => setAnt({ measure: 'vertical' })}>Dikey</${Chip}><${Chip} on=${ant.measure === 'slant'} onClick=${() => setAnt({ measure: 'slant' })}>Eğik</${Chip}></div></div>
      ${ant.measure === 'slant' ? html`<div class="grid2"><div class="fld"><label>Anten yarıçapı (m)</label><${Girdi} type="number" step="0.001" inputmode="decimal" value=${ant.radius} onSave=${(v) => setAnt({ radius: +v })} /></div><div class="fld"><label>Dikey karşılık</label><div class="inp mono" style="display:flex;align-items:center">${fmt(g.antennaVertical())} m</div></div></div>` : null}
      <div class="fld"><label>Faz merkezi ofseti (PCO, m)</label><${Girdi} type="number" step="0.001" inputmode="decimal" value=${ant.pco} onSave=${(v) => setAnt({ pco: +v })} /></div>
      <div class="lbl">NMEA çıktısı</div><div class="row wrap" style="gap:6px">${['GGA', 'RMC', 'GST', 'GSA', 'GSV', 'HDT'].map((t) => html`<span class=${'badge ' + (types[t] ? 'b-ok' : 'b-mut')} style="height:30px;font-size:12px;padding:0 10px">$GN${t}</span>`)}</div>
      <div class="note">GST yoksa σ değerleri HDOP'tan tahmin edilir ve "σ tahmini" olarak işaretlenir. Alıcıyı GGA+GST+GSA 1–10 Hz çıkış verecek şekilde ayarlayın.</div>
      <${AliciRehberi} />
    </div>


    <${DuzeltmeBolumu} />`}

    ${ps.p ? html`<div class="sect">Hassasiyet eşikleri · proje</div>
    <div class="card tight list">${[['maxSigmaH', 'Yatay σH ≤', 'm', 0.001], ['maxSigmaV', 'Düşey σV ≤', 'm', 0.001], ['maxPdop', 'PDOP ≤', '', 0.1], ['minSats', 'Uydu ≥', 'adet', 1], ['maxAge', 'RTCM yaşı ≤', 's', 0.5], ['minFixSeconds', 'Min. FIX süresi ≥', 's', 1], ['epochs', 'Ortalama epok', 'adet', 1], ['maxAxisOffset', 'Eksen ofseti ≤', 'm', 0.01], ['stakeTolerance', 'Aplikasyon toleransı ≤', 'm', 0.001]].map(([k, l, u, st]) => html`<div class="li"><b class="grow" style="font-size:14px">${l}</b><${Girdi} style="width:110px;text-align:right;color:#10b981" type="number" step=${st} inputmode="decimal" value=${th[k]} onSave=${(v) => setTh(k, +v)} /><span class="note mono" style="width:30px">${u}</span></div>`)}
      ${app.web ? null : html`<div class="li"><div class="grow"><b style="font-size:14px">FLOAT çözümde nokta alımına izin ver</b><div class="s">Açık: FLOAT'ta soru sormadan alınır, nokta [RTK FLOAT] etiketiyle işaretlenir · Kapalı: her alımda onay istenir</div></div><${Toggle} on=${floatCap} onChange=${(v) => { setFloatCap(v); app.ds.setting('floatCapture', v); }} label="FLOAT'ta alım" /></div>`}</div>

    <div class="sect">Koordinat sistemi · proje</div>
    <div class="card stack">
      <div class="row"><b class="grow">Datum</b><div class="chips">${[['TUREF', 'ITRF96'], ['ED50', 'ED50'], ['WGS84', 'WGS84']].map(([k, l]) => html`<${Chip} on=${crs.datum === k} onClick=${() => setCrs({ datum: k })}>${l}</${Chip}>`)}</div></div>
      <div class="row"><b class="grow">Projeksiyon</b><div class="chips">${[['TM3', 'TM 3°'], ['UTM', 'UTM 6°']].map(([k, l]) => html`<${Chip} on=${crs.projection === k} onClick=${() => setCrs({ projection: k })}>${l}</${Chip}>`)}</div></div>
      ${crs.projection === 'TM3' ? html`<div class="row"><b class="grow">Dilim (DOM)</b><select class="inp mono" style="width:110px" value=${crs.cm} onChange=${(e) => setCrs({ cm: +e.target.value })}>${TM_ZONES.map((z) => html`<option value=${z}>${z}°</option>`)}</select><button class="btn sm" onClick=${autoZone}>Otomatik</button></div>` : null}
      <div class="mono note">${crsSummary(crs)}</div>
      <div class="lbl">Yükseklik (Z)</div>
      <${Seg} value=${ps.p.heightSystem} options=${[['elipsoidal', 'Elipsoidal'], ['ortometrik', 'Ortometrik']]} onChange=${(v) => ps.updateProject({ heightSystem: v }, 'Yükseklik sistemi: ' + v)} />
      <div class="row"><b class="grow">Geoit modeli</b><select class="inp" style="width:200px" value=${(ps.p.geoid || {}).model} onChange=${(e) => ps.updateProject({ geoid: Object.assign({}, ps.p.geoid, { model: e.target.value }) }, 'Geoit: ' + e.target.value)}><option value="receiver">Alıcının modeli (GGA)</option><option value="constant">Sabit N</option><option value="grid">Izgara dosyası</option><option value="none">Yok (H = h)</option></select></div>
      ${(ps.p.geoid || {}).model === 'constant' ? html`<div class="row"><b class="grow">N (m)</b><input class="inp mono" style="width:120px" type="number" step="0.001" value=${ps.p.geoid.N ?? ''} onChange=${(e) => ps.updateProject({ geoid: Object.assign({}, ps.p.geoid, { N: +e.target.value }) }, 'Geoit N')} /></div>` : null}
      ${(ps.p.geoid || {}).model === 'grid' ? html`<label class="btn sm">Izgara yükle (lat0 lon0 dlat dlon satır sütun + değerler)<input type="file" style="display:none" onChange=${(e) => geoidFile(e.target.files[0])} /></label><div class="note">${ps.p.geoid.name || 'Yüklenmedi'} · TG-20 vb. modeller ASCII ızgaraya dönüştürülerek yüklenebilir.</div>` : null}
      <div class="row"><b class="grow">Koordinat ondalığı</b><span class="mono note"><${Icon} n="lock" s=${12} /> 3 basamak · mm</span></div>
    </div>` : null}

    <div class="sect">${app.web ? 'Telefonla veri alışverişi' : 'Veri ve senkron'}</div>
    <div class="card stack"><div class="row"><div class="grow"><b>${app.web ? 'Telefona gönderilmemiş değişiklik' : 'Senkron kuyruğu'}</b><div class="mono" style="font-size:12px;color:${pend ? '#f59e0b' : '#10b981'}">${pend} kayıt ${app.web ? '' : 'çevrimdışı '}bekliyor</div></div><button class="btn sm" onClick=${() => app.nav.go('sync')}>${app.web ? 'Aç →' : 'Senkron →'}</button></div></div>

    ${ps.p ? html`<div class="sect">Kullanıcılar ve hakediş onayı</div>
    <div class="card row"><div class="grow"><b style="font-size:14px">${ps.approval().on ? (ps.member ? ps.member.name : 'Oturum açılmadı') : 'Onay mekanizması kapalı'}</b><div class="note">Roller, şifreli oturum, onay bekleyen işler</div></div><button class="btn sm pri" onClick=${() => app.nav.go('team')}>Aç →</button></div>` : null}
    <div class="sect">Tanımlar ve kayıtlar</div>
    <div class="card tight list">${[['projects', 'Projeler', 'Proje merkezi, akış, yeni proje'], ['definitions', 'Tanımlar (tek veri kaynağı)', 'Reçete kuralları, parametreler, standart sürümleri'], ['poz', 'Poz kataloğu (Yeşil Defter)', 'Veritabanından · sürümlü'], ['layers', 'Katmanlar ve lejant (TEDAŞ)', 'Lejant.dxf katman/ACI eşlemesi'], ['audit', 'Denetim kaydı', 'Kim · ne · ne zaman · eski/yeni · neden'], ['user', 'Kullanıcı ve cihaz', app.ds.user.name + ' · ' + app.ds.deviceId]].map(([k, t, d]) => html`<button class="li" onClick=${() => app.nav.go(k)}><div class="grow"><div class="t">${t}</div><div class="s">${d}</div></div><${Icon} n="next" s=${16} c="#94a3b8" /></button>`)}</div>
    ${app.web ? null : html`    <div class="sect">Harita altlığı</div>
    <div class="card stack"><div class="note">Altlık haritadaki Katmanlar düğmesinden seçilir; ölçüm, koordinat ve çizim altlıktan bağımsızdır. Ücretsiz altlıklar anahtarsız çalışır; anahtarlı sağlayıcıların ücretsiz kullanım payı vardır, ücretli plana geçmeniz gerekmez. Ücretsiz kullanım sınırsız değildir: sağlayıcı yoğun kullanımı kesebilir. Anahtarlar yalnız bu cihazda saklanır; proje dosyalarına ve paylaşıma girmez.</div>
      ${ALTLIK_GRUPLARI.map(([gk, gl]) => html`<div class="lbl" style="margin-top:4px">${gl}</div>${BASEMAPS.filter((b) => b.grup === gk).map((b) => html`<div class="row" style="align-items:flex-start;gap:8px;padding:4px 0"><${Icon} n=${basemapReady(b) ? 'check' : 'minus'} s=${16} c=${basemapReady(b) ? '#10b981' : '#64748b'} /><div class="grow"><b style="font-size:13px">${b.label}</b><div class="note">${b.note || ''}${b.kosul ? html` · koşullar: <span class="mono">${b.kosul}</span>` : null}</div></div></div>`)}`)}
      <div class="fld"><label>MapTiler anahtarı (ücretsiz plan yeterli)</label><input class="inp mono" type="password" autocomplete="off" value=${keys.maptiler || ''} placeholder="maptiler.com hesabından" onChange=${(e) => saveKeys({ maptiler: e.target.value.trim() })} /></div>
      <div class="fld"><label>Google Map Tiles anahtarı</label><input class="inp mono" type="password" autocomplete="off" value=${keys.google || ''} placeholder="Google Cloud konsolundan" onChange=${(e) => saveKeys({ google: e.target.value.trim() })} /></div>
      <div class="fld"><label>Yandex Tiles anahtarı</label><input class="inp mono" type="password" autocomplete="off" value=${keys.yandex || ''} placeholder="Yandex geliştirici hesabından" onChange=${(e) => saveKeys({ yandex: e.target.value.trim() })} /></div>
      <div class="fld"><label>Özel karo sunucusu adresi (XYZ)</label><input class="inp mono" autocomplete="off" value=${keys.ozelUrl || ''} placeholder="https://…/{z}/{x}/{y}.png" onChange=${(e) => { const v = e.target.value.trim(); if (v && !/^https:\/\/.*\{z\}.*\{x\}.*\{y\}/i.test(v)) { app.toast('Adres https ile başlamalı ve {z}, {x}, {y} içermeli', 'warn', 5000); return; } saveKeys({ ozelUrl: v }); }} /></div>
      <div class="fld"><label>Özel altlığın atıf yazısı</label><input class="inp" autocomplete="off" value=${keys.ozelAttr || ''} placeholder="ör. © Kurum adı" onChange=${(e) => saveKeys({ ozelAttr: e.target.value.trim() })} /></div></div>
    <div class="sect">Offline harita</div>
    <div class="card stack"><div class="note">Haritada gördüğünüz alanlar cihazda saklanır ve internetsiz de görünür. Toplu indirme (görünen alanı 4 yakınlaştırma seviyesinde kaydetme) yalnız koşulları izin veren altlıkta açıktır: OpenStreetMap, Esri, Google, Yandex ve MapTiler buna izin vermez; kendi karo sunucunuzda (Özel) kullanılabilir.</div><button class="btn" disabled=${!basemapById(app.state.basemap || 'none').offline} onClick=${offline}>Görünen alanı offline indir</button></div>
    <div class="sect">Test / eğitim</div>
    <div class="card stack"><div class="note">Simülatör gerçek alıcı yokken arayüzü denemek içindir; alınan noktalar SİM olarak işaretlenir ve teslim paketinde gerçek ölçü sayılmaz.</div>
      <div class="grid3">${['FIX', 'FLOAT', 'SINGLE'].map((p) => html`<button class="btn sm" onClick=${() => { if (g.state.source !== 'sim') { const p0 = ps.p && ps.data.points.find((x) => x.lat != null); g.startSimulator({ profile: p, base: p0 ? { lat: p0.lat, lon: p0.lon, alt: (p0.H || 1000) } : undefined }); } else g.setSimProfile(p); }}>Sim · ${p}</button>`)}</div></div>`}
    <div class="sect">Hakkında</div>
    <div class="card stack"><div class="aboutlogo"><img src="assets/sebeke-m-logo.png" alt="Şebeke-M" /></div>
      <div class="note mono">Şebeke-M ${ver ? ver.version || '' : ''} · ${native ? 'Android' : 'Web'} · standart ${ps.p ? ps.cat.std.name : '—'}</div>
      <div class="note">Saha ölçümü, proje, metraj ve hakediş; AutoCAD eklentisiyle aynı proje dosyası ve simgeler.</div></div>`;
}

export function UserScreen() {
  const [u, setU] = useState(Object.assign({}, app.ds.user));
  const save = async () => { app.ds.setUser(u); await app.ds.setting('user', u); app.toast('Kullanıcı kaydedildi'); app.nav.back(); };
  return html`<${Title} title="Kullanıcı ve cihaz" />
    <div class="card stack"><div class="fld"><label>Ad soyad</label><input class="inp" value=${u.name} onInput=${(e) => setU(Object.assign({}, u, { name: e.target.value }))} /></div>
      <div class="fld"><label>Rol</label><${Seg} value=${u.role || 'operator'} options=${[['operator', 'Operatör'], ['engineer', 'Mühendis'], ['admin', 'Yönetici']]} onChange=${(v) => setU(Object.assign({}, u, { role: v }))} /></div>
      <div class="kv mono" style="font-size:12px"><b>Cihaz</b><span>${app.ds.deviceId}</span></div>
      <button class="btn pri" onClick=${save}>Kaydet</button></div>
    <div class="note">Her kayıt ve değişiklik bu kullanıcı adıyla denetim kaydına yazılır. Sahada ilave malzeme onayı mühendis rolündedir.</div>`;
}
