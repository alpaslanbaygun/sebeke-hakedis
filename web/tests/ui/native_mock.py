# Yerel köprü protokol testi: window.VoltNative taklidi (Java yanıtları + NMEA/NTRIP olayları) ile JS tarafı
import asyncio, subprocess, sys, time, json
from playwright.async_api import async_playwright
WWW='/home/claude/voltapp/web/dist/www'
MOCK = r"""
(() => {
  const ev = (e, o) => setTimeout(() => window.__voltNative && window.__voltNative(e, JSON.stringify(o)), 5);
  const reply = (id, r, err) => ev('reply', err ? { reqId: id, error: err } : { reqId: id, result: r });
  function cs(b){let c=0;for(let i=0;i<b.length;i++)c^=b.charCodeAt(i);return '$'+b+'*'+c.toString(16).toUpperCase().padStart(2,'0');}
  let timer=null, lat=38.6700, lon=39.2300, files={};
  window.__mock = { calls: [], saved: [] };
  const M = {};
  const rec = (m) => (id, j) => { window.__mock.calls.push([m, JSON.parse(j)]); return M[m](id, JSON.parse(j)); };
  M.appInfo = (id) => reply(id, { platform: 'android', version: '2.0.0', sdk: 34, model: 'Mock Pixel' });
  M.btBonded = (id) => reply(id, [{ name: 'CHC i73', address: '00:11:22:33:44:55', kind: 'classic' }, { name: 'Reach RX', address: 'AA:BB:CC:DD:EE:FF', kind: 'le' }]);
  M.bleScan = (id) => reply(id, [{ name: 'Reach RX', address: 'AA:BB:CC:DD:EE:FF', rssi: -61 }]);
  M.gnssConnect = (id, a) => { reply(id, true); ev('gnssStatus', { state: 'connected', name: 'CHC i73', address: a.address });
    timer = setInterval(() => { const t='120000.00'; const la=Math.abs(lat), lo=Math.abs(lon);
      const L=String(Math.floor(la)).padStart(2,'0')+((la-Math.floor(la))*60).toFixed(7).padStart(10,'0'), O=String(Math.floor(lo)).padStart(3,'0')+((lo-Math.floor(lo))*60).toFixed(7).padStart(10,'0');
      const txt=[cs('GNGGA,'+t+','+L+',N,'+O+',E,4,26,0.6,1031.200,M,36.100,M,1.0,0021'), cs('GNGST,'+t+',0.010,0.006,0.005,0.0,0.006,0.007,0.012'), cs('GNGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.3,0.6,1.1'), cs('GNRMC,'+t+',A,'+L+',N,'+O+',E,0.1,45.0,260926,,,R')].join('\r\n')+'\r\n';
      ev('gnss', { text: txt }); }, 200); };
  M.gnssDisconnect = (id) => { clearInterval(timer); reply(id, true); ev('gnssStatus', { state: 'disconnected' }); };
  M.gnssWrite = (id) => reply(id, true);
  M.ntripSourcetable = (id) => reply(id, { mounts: [{ name: 'VRS_RTCM32', format: 'RTCM 3.2', nmea: true }, { name: 'ELAZ_RTCM3', format: 'RTCM 3.1', nmea: false }] });
  M.ntripConnect = (id, a) => { reply(id, true); ev('ntrip', { state: 'connecting', mount: a.mount }); setTimeout(() => ev('ntrip', { state: 'connected', mount: a.mount, bytes: 12040, rateBps: 1210, types: { 1005: 3, 1077: 30, 1087: 30 } }), 300); };
  M.ntripDisconnect = (id) => { reply(id, true); ev('ntrip', { state: 'off' }); };
  M.phoneStart = (id) => { reply(id, true); ev('phone', { lat, lon, alt: 1067.3, geoidSep: 36.1, acc: 4.2, vacc: 7.9, sats: 31, satsUsed: 22 }); };
  M.phoneStop = (id) => reply(id, true);
  M.fileBegin = (id, a) => { const k='f'+Math.random(); files[k]={ name: a.name, n: 0, action: a.action }; reply(id, k); };
  M.fileChunk = (id, a) => { files[a.id].n += atob(a.b64).length; reply(id, 1); };
  M.fileEnd = (id, a) => { window.__mock.saved.push(files[a.id]); reply(id, { uri: 'İndirilenler/VOLT-EDAS/' + files[a.id].name }); };
  M.printHtml = (id) => reply(id, true); M.keepScreenOn = (id) => reply(id, true); M.vibrate = (id) => reply(id, true);
  window.VoltNative = {}; for (const k of Object.keys(M)) window.VoltNative[k] = rec(k);
  window.__mockMove = (dN, dE) => { lat += dN/111320; lon += dE/(111320*Math.cos(lat*Math.PI/180)); };
})();
"""
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '-d', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    errs=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        await ctx.add_init_script(MOCK)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://127.0.0.1:8766/index.html'); await pg.wait_for_function('window.__voltReady === true', timeout=60000)
        r = await pg.evaluate("""async () => { const a = window.__app; const p = await a.ps.createProject({ name: 'Köprü testi', cm: 39 }); await a.ps.open(p.id); return a.bridge.isNative(); }""")
        print('native bridge:', r)
        await pg.evaluate("() => window.__app.nav.tab('settings')"); await pg.wait_for_timeout(500)
        await pg.get_by_text('Harici GNSS', exact=False).first.click(); await pg.wait_for_timeout(600)
        await pg.screenshot(path='/home/claude/voltapp/web/tests/ui/shots/40_bt_list.png')
        await pg.get_by_text('CHC i73').first.click(); await pg.wait_for_timeout(2500)
        st = await pg.evaluate("() => { const s = window.__app.gnss.snapshot(); return [s.source, s.connected, s.fix, s.sats, s.sigmaH && +s.sigmaH.toFixed(4), s.pdop, s.E && +s.E.toFixed(3), s.N && +s.N.toFixed(3), s.H && +s.H.toFixed(3), s.rateHz && Math.round(s.rateHz)] }")
        print('gnss state:', st)
        # NTRIP
        await pg.evaluate("() => { const S = window.__app.state; S.ntripCfg = { name: 'TUSAGA', host: '127.0.0.1', port: 2101, mount: 'VRS_RTCM32', user: 'u', pass: 'p', version: 2, sendGGA: true, ggaSec: 1 }; }")
        await pg.evaluate("() => window.__app.nav.tab('map')"); await pg.wait_for_timeout(300)
        await pg.evaluate("() => window.__app.nav.tab('settings')"); await pg.wait_for_timeout(500)
        await pg.get_by_text('Bağlantıyı Test Et').click(); await pg.wait_for_timeout(500)
        await pg.get_by_text('Bağlan', exact=True).click(); await pg.wait_for_timeout(900)
        nt = await pg.evaluate("() => window.__app.gnss.snapshot().ntrip")
        print('ntrip:', {k: nt.get(k) for k in ['state','mount','rateBps','types']})
        await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 1300)'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/home/claude/voltapp/web/tests/ui/shots/41_ntrip.png')
        # Nokta al (RTK FIX, gerçek köprü yolundan)
        await pg.evaluate("() => { window.__app.gnss.thresholds.minFixSeconds = 1; }")
        await pg.evaluate("() => window.__app.nav.tab('map')"); await pg.wait_for_timeout(600)
        await pg.locator('section.sheet button.btn.huge').click(); await pg.wait_for_timeout(3000)
        pt = await pg.evaluate("() => { const p = window.__app.ps.data.points[0]; return p && [p.pointNo, p.source, p.quality.fix, +p.E.toFixed(3), +p.N.toFixed(3), +p.H.toFixed(3), p.quality.epochs] }")
        print('point via bridge:', pt)
        # Telefon GPS
        await pg.evaluate("async () => { await window.__app.gnss.usePhone(); }"); await pg.wait_for_timeout(400)
        ph = await pg.evaluate("() => { const s = window.__app.gnss.state; return [s.source, s.fix, s.sigmaH, +s.h.toFixed(2), +s.H.toFixed(2)] }")
        print('phone:', ph)
        # Dışa aktarım (parçalı dosya aktarımı)
        await pg.evaluate("() => window.__app.nav.tab('export')"); await pg.wait_for_timeout(500)
        await pg.locator('button.btn.pri.huge').click(); await pg.wait_for_timeout(5000)
        saved = await pg.evaluate("() => window.__mock.saved")
        print('saved files:', saved)
        await b.close()
    srv.terminate(); print('errors:', errs[:10])
asyncio.run(main())
