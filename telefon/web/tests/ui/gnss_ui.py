# Arayüz denemesi: Ayarlar › Düzeltme kaynağı (TUSAGA-Aktif, sabit istasyon, yerel CORS; NTRIP / doğrudan IP),
# akış denemesi, metinden alma, paylaşma, alıcı bağlanınca kendiliğinden bağlanma, alıcı ayar rehberi.
# Yerel köprü (window.VoltNative) taklit edilir; Java tarafı android/test/NtripTest.java ile ayrıca denenir.
# Kullanım: python3 gnss_ui.py <dist/www klasörü> <ekran görüntüsü klasörü>   (çıkış kodu 0: geçti)
import asyncio, json, math, os, subprocess, sys, time
from playwright.async_api import async_playwright

WWW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'www')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
PORT = 8831

def ecef(lat, lon, h):
    a = 6378137.0; f = 1 / 298.257222101; e2 = f * (2 - f)
    la, lo = math.radians(lat), math.radians(lon)
    N = a / math.sqrt(1 - e2 * math.sin(la) ** 2)
    return ((N + h) * math.cos(la) * math.cos(lo), (N + h) * math.cos(la) * math.sin(lo), (N * (1 - e2) + h) * math.sin(la))

X, Y, Z = ecef(38.6700 + 0.11, 39.2300, 1100.0)  # alıcıdan ~12 km kuzeyde istasyon
MOCK = r"""
(() => {
  const ev = (e, o) => setTimeout(() => window.__voltNative && window.__voltNative(e, JSON.stringify(o)), 5);
  const reply = (id, r, err) => ev('reply', err ? { reqId: id, error: err } : { reqId: id, result: r });
  function cs(b){let c=0;for(let i=0;i<b.length;i++)c^=b.charCodeAt(i);return '$'+b+'*'+c.toString(16).toUpperCase().padStart(2,'0');}
  let timer=null, lat=38.6700, lon=39.2300, files={};
  const ST = { id: 2003, x: __X__, y: __Y__, z: __Z__ };
  window.__mock = { calls: [], saved: [] };
  const M = {};
  const rec = (m) => (id, j) => { window.__mock.calls.push([m, JSON.parse(j)]); return M[m](id, JSON.parse(j)); };
  M.appInfo = (id) => reply(id, { platform: 'android', version: '2.5.x', sdk: 34, model: 'Deneme' });
  M.btBonded = (id) => reply(id, [{ name: 'Rover-1', address: '00:11:22:33:44:55', kind: 'classic' }]);
  M.bleScan = (id) => reply(id, []);
  M.gnssConnect = (id, a) => { reply(id, true); ev('gnssStatus', { state: 'connected', name: 'Rover-1', address: a.address });
    timer = setInterval(() => { const t='120000.00'; const la=Math.abs(lat), lo=Math.abs(lon);
      const L=String(Math.floor(la)).padStart(2,'0')+((la-Math.floor(la))*60).toFixed(7).padStart(10,'0'), O=String(Math.floor(lo)).padStart(3,'0')+((lo-Math.floor(lo))*60).toFixed(7).padStart(10,'0');
      const txt=[cs('GNGGA,'+t+','+L+',N,'+O+',E,4,26,0.6,1031.200,M,36.100,M,1.0,2003'), cs('GNGST,'+t+',0.010,0.006,0.005,0.0,0.006,0.007,0.012'), cs('GNGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.3,0.6,1.1')].join('\r\n')+'\r\n';
      ev('gnss', { text: txt }); }, 250); };
  M.gnssDisconnect = (id) => { clearInterval(timer); reply(id, true); ev('gnssStatus', { state: 'disconnected' }); ev('ntrip', { state: 'off' }); };
  M.gnssWrite = (id) => reply(id, true);
  M.ntripSourcetable = (id) => reply(id, { mounts: [
    { name: 'FKP_RTCM31', format: 'RTCM 3.1', nmea: true, lat: 39.90, lon: 32.80 },
    { name: 'VRSRTCM31', format: 'RTCM 3.1', nmea: true, lat: 38.70, lon: 39.20 },
    { name: 'VRSCMRP', format: 'CMR+', nmea: true, lat: 38.70, lon: 39.20 } ] });
  M.ntripProbe = (id, a) => setTimeout(() => reply(id, a.host === 'kapali.ornek'
      ? { connected: false, error: 'Sunucuya bağlanılamadı (adres / port kapalı)', bytes: 0, frames: 0, types: {} }
      : { connected: true, error: null, bytes: 4200, frames: 12, crcErrors: 0, firstDataMs: 640, types: { 1005: 2, 1077: 5, 1087: 5 }, station: ST, gga: a.gga }), 300);
  M.ntripConnect = (id, a) => { if (!a.host) return reply(id, null, 'Sunucu adresi gerekli'); reply(id, true);
    ev('ntrip', { state: 'connecting', mode: a.mode, host: a.host, port: a.port, mount: a.mode === 'tcp' ? null : a.mount });
    setTimeout(() => ev('ntrip', { state: 'connected', mode: a.mode, host: a.host, port: a.port, mount: a.mode === 'tcp' ? null : a.mount, bytes: 12040, rateBps: 1210, types: { 1005: 3, 1077: 30, 1087: 30 }, station: ST, error: null }), 300); };
  M.ntripDisconnect = (id) => { reply(id, true); ev('ntrip', { state: 'off' }); };
  M.phoneStart = (id) => reply(id, true); M.phoneStop = (id) => reply(id, true);
  M.fileBegin = (id, a) => { const k='f'+Math.random(); files[k]={ name: a.name, n: 0, action: a.action, text: '' }; reply(id, k); };
  M.fileChunk = (id, a) => { const s = atob(a.b64); files[a.id].n += s.length; files[a.id].text += s; reply(id, 1); };
  M.fileEnd = (id, a) => { window.__mock.saved.push(files[a.id]); reply(id, { uri: 'İndirilenler/Sebeke-M/' + files[a.id].name }); };
  M.printHtml = (id) => reply(id, true); M.keepScreenOn = (id) => reply(id, true); M.vibrate = (id) => reply(id, true);
  M.openSettings = (id) => reply(id, true);
  window.VoltNative = {}; for (const k of Object.keys(M)) window.VoltNative[k] = rec(k);
})();
""".replace('__X__', repr(X)).replace('__Y__', repr(Y)).replace('__Z__', repr(Z))

sonuc = []
def kontrol(ok, ne):
    sonuc.append((ok, ne)); print(('GEÇTİ  ' if ok else 'HATA   ') + ne, flush=True)

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={'width': 390, 'height': 2400}, device_scale_factor=1)
            await ctx.add_init_script(MOCK)
            pg = await ctx.new_page()
            errors = []
            pg.on('console', lambda m: errors.append(('console', m.text)) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
            async def guard(route):
                if route.request.url.startswith(f'http://127.0.0.1:{PORT}/'): await route.continue_()
                else: await route.abort()
            await pg.route('**/*', guard)
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html')
            await pg.wait_for_function('window.__voltReady === true', timeout=60000)
            await pg.evaluate("""async () => { const a = window.__app, ps = a.ps;
              const p = await ps.createProject({ name: 'Deneme · Düzeltme', code: 'DNM-01', cm: 39, enhZone: 'III', mode: 'asbuilt' });
              await ps.open(p.id);
              await ps.createPoint({ pointNo: 'P1', cls: 'DETAY', critical: false, coord: { lat: 38.6700, lon: 39.2300, H: 1031 }, source: 'MANUAL' });
              a.nav.tab('settings'); }""")
            await pg.wait_for_timeout(900)
            bolum = pg.locator('.sect', has_text='Düzeltme kaynağı').locator('xpath=following-sibling::div[1]')
            await bolum.scroll_into_view_if_needed()
            await bolum.screenshot(path=f'{OUT}/gnss_01_profiller.png')
            chips = await bolum.locator('.chips button').all_inner_texts()
            kontrol(all(x in chips for x in ['TUSAGA-Aktif', 'Sabit istasyon', 'Yerel CORS ağı']), 'hazır profiller: ' + ' | '.join(chips))
            host = await bolum.locator('input.inp.mono').first.input_value()
            kontrol(host == '212.156.70.42', 'TUSAGA-Aktif sunucusu hazır: ' + host)
            # Bağlantı noktaları listesi (en yakın önce)
            await bolum.get_by_role('button', name='Bağlantı noktalarını getir').click(); await pg.wait_for_timeout(500)
            opts = await bolum.locator('select option').all_inner_texts()
            kontrol(len(opts) == 4 and opts[1].startswith('VRSRTCM31') and 'km' in opts[1], 'bağlantı noktaları: ' + ' | '.join(opts))
            await bolum.locator('select').first.select_option('VRSRTCM31'); await pg.wait_for_timeout(200)
            await bolum.locator('input[type=password]').fill('gizli'); await bolum.locator('input[type=password]').press('Tab')
            # Akış denemesi (alıcısız)
            await bolum.get_by_role('button', name='Akışı dene').click(); await pg.wait_for_timeout(900)
            alert = await bolum.locator('.alert').first.inner_text()
            kontrol('Bağlantı tamam' in alert and '2003' in alert and 'km' in alert, 'akış denemesi: ' + alert.replace('\n', ' / '))
            prob = await pg.evaluate("() => window.__mock.calls.filter((c) => c[0] === 'ntripProbe').map((c) => c[1])")
            kontrol(len(prob) == 1 and prob[0]['mount'] == 'VRSRTCM31' and prob[0]['gga'].startswith('$GNGGA'), 'denemede yaklaşık GGA gitti (projenin / telefonun konumu): ' + (prob[0]['gga'][:30] if prob and prob[0]['gga'] else 'yok'))
            await bolum.screenshot(path=f'{OUT}/gnss_02_tusaga_deneme.png')
            # Sabit istasyon: doğrudan IP
            await bolum.locator('.chips button', has_text='Sabit istasyon').click(); await pg.wait_for_timeout(300)
            await bolum.get_by_role('button', name="Doğrudan IP (NTRIP'siz)").click(); await pg.wait_for_timeout(200)
            await bolum.locator('input.inp.mono').first.fill('88.1.2.3'); await bolum.locator('input.inp.mono').first.press('Tab')
            await bolum.locator('input[type=number]').first.fill('9000'); await bolum.locator('input[type=number]').first.press('Tab')
            await pg.wait_for_timeout(200)
            kontrol(await bolum.locator('input[type=password]').count() == 0, 'doğrudan IP: kullanıcı / şifre / bağlantı noktası alanı yok')
            await bolum.get_by_role('button', name='Sabit istasyon kurulurken firmadan istenecekler').click(); await pg.wait_for_timeout(200)
            await bolum.screenshot(path=f'{OUT}/gnss_03_sabit_ip.png')
            # Metinden alma
            await bolum.get_by_role('button', name='Dosyadan / metinden al').click(); await pg.wait_for_timeout(300)
            await pg.locator('.modal textarea').fill('Merhaba, istasyon bilgileri:\nSunucu: caster.ornek.com\nPort: 2101\nBağlantı noktası: BASE1\nKullanıcı adı: saha1\nŞifre: s1')
            await pg.locator('.modal').screenshot(path=f'{OUT}/gnss_04_metinden_al.png')
            await pg.locator('.modal').get_by_role('button', name='Al', exact=True).click(); await pg.wait_for_timeout(500)
            st = await pg.evaluate("() => { const s = window.__app.state.ntripProfiles; const a = s.list.find((p) => p.id === s.active); return [s.list.length, a.name, a.host, a.mount, a.user, a.mode]; }")
            kontrol(st[0] == 4 and st[2] == 'caster.ornek.com' and st[3] == 'BASE1' and st[4] == 'saha1' and st[5] == 'ntrip', 'metinden alındı: ' + json.dumps(st, ensure_ascii=False))
            # Alıcı bağlanınca kendiliğinden bağlanma (seçili profil eksiksiz)
            await pg.evaluate("() => window.__app.gnss.connectExternal({ type: 'spp', address: '00:11:22:33:44:55', name: 'Rover-1' })")
            await pg.wait_for_timeout(2600)
            bag = await pg.evaluate("() => window.__mock.calls.filter((c) => c[0] === 'ntripConnect').map((c) => [c[1].host, c[1].mount, c[1].mode])")
            kontrol(len(bag) == 1 and bag[0][0] == 'caster.ornek.com', 'alıcı bağlanınca kendiliğinden bağlandı: ' + json.dumps(bag))
            durum = await bolum.inner_text()
            kontrol('Bağlı' in durum and 'Referans istasyonu' in durum and 'km' in durum, 'durum: bağlı, istasyon ve uzaklık görünüyor')
            await bolum.screenshot(path=f'{OUT}/gnss_05_bagli.png')
            # Paylaş (şifresiz)
            await bolum.get_by_role('button', name='Paylaş (dosya)').click(); await pg.wait_for_timeout(300)
            await pg.locator('.modal').get_by_role('button', name='Şifresiz').click(); await pg.wait_for_timeout(700)
            saved = await pg.evaluate("() => window.__mock.saved.map((f) => [f.name, f.text])")
            ok = len(saved) == 1 and saved[0][0] == 'Sebeke-M-GNSS-baglanti.json'
            if ok:
                dosya = json.loads(saved[0][1]); ok = dosya['bicim'] == 'sebeke-m.gnss-baglanti' and all('pass' not in p for p in dosya['profiller']) and any(p['host'] == 'caster.ornek.com' for p in dosya['profiller'])
            kontrol(ok, 'paylaşılan dosya şifresiz: ' + (saved[0][0] if saved else 'yok'))
            # Alıcı ayar rehberi
            gn = pg.locator('.sect', has_text='GNSS alıcı').locator('xpath=following-sibling::div[1]')
            await gn.get_by_role('button', name='Alıcı ayar rehberi (bir kez yapılır)').click(); await pg.wait_for_timeout(300)
            await gn.screenshot(path=f'{OUT}/gnss_06_alici_rehberi.png')
            kontrol(await gn.get_by_text('Rover').count() > 0, 'alıcı ayar rehberi açıldı')
            # Kapalı sunucu: deneme hatası açıklamalı
            await pg.evaluate("() => window.__app.gnss.ntripDisconnect()")
            await bolum.locator('.chips button', has_text='Yerel CORS ağı').click(); await pg.wait_for_timeout(300)
            await bolum.locator('input.inp.mono').first.fill('kapali.ornek'); await bolum.locator('input.inp.mono').first.press('Tab')
            await bolum.locator('input.inp.mono').nth(2).fill('RTCM3'); await bolum.locator('input.inp.mono').nth(2).press('Tab')
            await bolum.get_by_role('button', name='Akışı dene').click(); await pg.wait_for_timeout(900)
            alert = await bolum.locator('.alert').first.inner_text()
            kontrol('Olmadı' in alert and 'bağlanılamadı' in alert, 'kapalı sunucu: ' + alert.replace('\n', ' / '))
            await bolum.screenshot(path=f'{OUT}/gnss_07_hata.png')
            kontrol(not errors, 'sayfa hatası yok' + ('' if not errors else ': ' + json.dumps(errors[:5], ensure_ascii=False)))
            await b.close()
    finally:
        srv.terminate()
    hata = [n for ok, n in sonuc if not ok]
    print('SONUÇ: ' + ('hepsi geçti (%d)' % len(sonuc) if not hata else '%d hata' % len(hata)))
    sys.exit(0 if not hata else 1)

asyncio.run(main())
