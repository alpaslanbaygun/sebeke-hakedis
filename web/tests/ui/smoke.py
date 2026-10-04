# Arayüz duman testi: Chromium (mobil 390x844) + simülatör GNSS ile uçtan uca saha akışı
import asyncio, json, sys, os, subprocess, time
from playwright.async_api import async_playwright
WWW = '/home/claude/voltapp/web/dist/www'
OUT = '/home/claude/voltapp/web/tests/ui/shots'
os.makedirs(OUT, exist_ok=True)
errors = []
async def shot(pg, name):
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{OUT}/{name}.png', full_page=False)
async def tap(pg, text, exact=False, nth=0):
    loc = pg.get_by_text(text, exact=exact).nth(nth)
    await loc.scroll_into_view_if_needed(); await loc.click(); await pg.wait_for_timeout(250)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '-d', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=False)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errors.append(('console', m.type, m.text)) if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
        await pg.goto('http://127.0.0.1:8765/index.html')
        await pg.wait_for_function('window.__voltReady === true', timeout=60000)
        await shot(pg, '00_projects')
        await tap(pg, 'Yeni proje')
        await pg.get_by_placeholder('ör. OG-03 Hat Yenileme').fill('OG-03 Hat Yenileme · Kurtdere')
        await pg.locator('input.inp.mono').first.fill('ELZ-2026-OG03')
        await shot(pg, '01_new_project')
        await tap(pg, 'PROJE OLUŞTUR')
        await pg.wait_for_timeout(800)
        await shot(pg, '02_hub')
        # Simülatör FIX
        await pg.evaluate("""() => { const a = window.__app; a.gnss.startSimulator({ profile: 'FIX', hz: 5, base: { lat: 38.6700, lon: 39.2300, alt: 1055 } }); a.gnss.thresholds.minFixSeconds = 1; a.gnss.thresholds.epochs = 3; }""")
        await pg.wait_for_timeout(1800)
        await tap(pg, 'Harita', exact=True)
        await pg.wait_for_timeout(600)
        await shot(pg, '03_map_empty')
        # HAT başlat (OG 3xSwallow): alt çubuktaki "+ HAT"
        await pg.locator('button.lchip').click(); await pg.wait_for_timeout(300)
        await pg.locator('section.sheet').get_by_text('OG', exact=True).first.click()
        await shot(pg, '04_map_hat_form')
        await tap(pg, 'HAT BAŞLAT')
        await pg.wait_for_timeout(500)
        # 6 direk: sim konumunu kaydırarak al
        legs = [(0,0),(60,98.4),(60,102.7),(60,95.3),(88.7,110.0),(88.7,104.2)]
        types = ['GN-12 (3 AWG)','GT-12 (3 AWG)','GT-12 (3 AWG)','GZ-12 (3 AWG)','GT-12 (3 AWG)','GN-12 (3 AWG)']
        seen = set()
        for i,(az,d) in enumerate(legs):
            await pg.evaluate("""([az,d]) => { const a = window.__app, S = a.gnss.sim; const k=111320, kl=k*Math.cos(S.pos.lat*Math.PI/180); S.pos.lat += d*Math.cos(az*Math.PI/180)/k; S.pos.lon += d*Math.sin(az*Math.PI/180)/kl; S.pos.alt += 1.1; }""", [az, d])
            await pg.wait_for_timeout(1500)
            cur = await pg.locator('button.what small').inner_text()
            if not cur.startswith(types[i]):
                await pg.locator('button.what').click(); await pg.wait_for_timeout(300)
                if types[i] in seen:
                    if i == 4: await shot(pg, '04b_picker_recents')
                    await pg.locator('section.sheet button.rc', has_text=types[i]).first.click()   # son kullanılanlardan tek dokunuş
                else:
                    if i == 0:
                        await pg.locator('section.sheet').get_by_text('OG', exact=True).first.click()
                    sel = pg.locator('section.sheet select.inp').first
                    opts = await sel.evaluate("(s) => [...s.options].map(o => [o.value, o.text])")
                    v = [o[0] for o in opts if o[1].startswith(types[i])][0]
                    await sel.select_option(v)
                    if i == 0: await shot(pg, '04a_picker_pole')
                    await tap(pg, 'TAMAM', exact=True)
                await pg.wait_for_timeout(300)
            seen.add(types[i])
            await pg.locator('.dock-take button.take').click()
            if i == 2:
                await pg.screenshot(path=f'{OUT}/05a_measuring.png')
            await pg.wait_for_timeout(2500)
            # Konum her zaman GÖRÜNEN harita alanında (panelin arkasında değil)
            vis = await pg.evaluate("""() => { const a = window.__app, e = a.state.mapEngine, g = a.gnss.state; const s = e.toScreen(g.E, g.N); return { y: Math.round(s.y), top: e.pad.top, bottom: Math.round(e.h - e.pad.bottom), cy: Math.round(e.cy()), ok: e.inView(g.E, g.N, 40) }; }""")
            assert vis['ok'], ('konum panelin arkasinda', vis)
        print('konum gorunur alan', vis)
        await shot(pg, '05_map_poles')
        # Haritayı kaydır → konum düğmesi konumu görünen alanın ortasına getirir
        await pg.mouse.move(195, 300); await pg.mouse.down(); await pg.mouse.move(195, 120, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
        await pg.locator('button.loc').click(); await pg.wait_for_timeout(500)
        vis = await pg.evaluate("""() => { const a = window.__app, e = a.state.mapEngine, g = a.gnss.state; const s = e.toScreen(g.E, g.N); return { dy: Math.round(Math.abs(s.y - e.cy())), dx: Math.round(Math.abs(s.x - e.w / 2)), follow: a.state.follow }; }""")
        print('konum dugmesi', vis); assert vis['dy'] <= 3 and vis['dx'] <= 3 and vis['follow'], vis
        await shot(pg, '05b_map_located')
        # Hat penceresi → bitir
        await pg.locator('button.lchip').click(); await pg.wait_for_timeout(300)
        await shot(pg, '06_map_active_line')
        await tap(pg, 'HATTI BİTİR')
        # Trafo al
        await pg.evaluate("""() => { const S = window.__app.gnss.sim; S.pos.lat += 30/111320; }""")
        await pg.wait_for_timeout(1200)
        await pg.locator('button.what').click(); await pg.wait_for_timeout(300)
        await pg.locator('section.sheet').get_by_text('TRAFO', exact=True).first.click()
        await shot(pg, '07_map_trafo_form')
        await tap(pg, 'TAMAM', exact=True)
        await pg.locator('.dock-take button.take').click()
        await pg.wait_for_timeout(2500)
        await shot(pg, '07b_map_after_trafo')
        # Son alımı geri al → tekrar al
        n0 = await pg.evaluate("() => window.__app.ps.data.equipment.length")
        await pg.locator('.dock-take button.undo').click(); await pg.wait_for_timeout(300)
        await tap(pg, 'Sil', exact=True); await pg.wait_for_timeout(900)
        n1 = await pg.evaluate("() => window.__app.ps.data.equipment.length")
        assert n1 == n0 - 1, ('geri al', n0, n1)
        await pg.locator('.dock-take button.take').click(); await pg.wait_for_timeout(2500)
        info = await pg.evaluate("""() => { const ps = window.__app.ps; return { pts: ps.data.points.length, eq: ps.data.equipment.length, lines: ps.data.lines.map(l => [l.lineNo, l.nodes.length]), spans: ps.result.spans.length, roles: [...ps.result.roles.values()].map(r => r.role + (r.angle? ':' + r.angle.toFixed(1):'')), q: ps.result.quantities.length, issues: ps.result.issues.map(i => i.code + ' ' + i.entityNo + ' ' + i.message).slice(0, 12) } }""")
        print(json.dumps(info, ensure_ascii=False, indent=1))
        # Seçim kartı: ilk direğe dokun (harita merkezine sığdır)
        await pg.evaluate("""() => { const ps = window.__app.ps; const e = ps.data.equipment[3]; window.__app.state.sel = { type: 'point', id: e.pointId }; window.__app.bus.emit('ui:sel'); }""")
        await pg.wait_for_timeout(400)
        await shot(pg, '08_map_selection')
        await tap(pg, 'Kayıt', exact=True)
        await pg.wait_for_timeout(600)
        await shot(pg, '09_equipment_top')
        await pg.mouse.wheel(0, 900); await pg.wait_for_timeout(300)
        await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 900)')
        await shot(pg, '10_equipment_mats')
        await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 1400)')
        await shot(pg, '11_equipment_yd')
        await pg.evaluate("() => window.__app.nav.back()")
        # Aplikasyon
        await pg.evaluate("""() => { const ps = window.__app.ps; const e = ps.data.equipment[2]; window.__app.state.target = { id: e.pointId }; const p = ps.pointById(e.pointId); window.__app.gnss.simWalkTo({ lat: p.lat + 3/111320, lon: p.lon + 2/85000 }); }""")
        await tap(pg, 'Aplikasyon', exact=True)
        await pg.wait_for_timeout(1500)
        await shot(pg, '12_stakeout_far')
        await pg.evaluate("""() => { const ps = window.__app.ps; const e = ps.data.equipment[2]; const p = ps.pointById(e.pointId); window.__app.gnss.simWalkTo({ lat: p.lat, lon: p.lon }); }""")
        await pg.wait_for_timeout(9000)
        await shot(pg, '13_stakeout_near')
        await tap(pg, 'Hesaplar', exact=True); await pg.wait_for_timeout(600)
        await shot(pg, '14_calc')
        await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 900)'); await shot(pg, '15_calc_2')
        await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 1000)'); await shot(pg, '16_calc_3')
        await pg.evaluate("() => window.__app.nav.go('enh', { id: window.__app.ps.data.lines[0].id })"); await pg.wait_for_timeout(500); await shot(pg, '17_enh')
        await pg.evaluate("() => window.__app.nav.go('checks')"); await pg.wait_for_timeout(400); await shot(pg, '18_checks')
        await pg.evaluate("() => window.__app.nav.go('metraj')"); await pg.wait_for_timeout(400); await shot(pg, '19_metraj')
        await pg.evaluate("async () => { const ps = window.__app.ps; await ps.createWorkProgram(); await ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' }); }")
        await pg.evaluate("() => window.__app.nav.go('hakedis')"); await pg.wait_for_timeout(500); await shot(pg, '20_hakedis')
        await tap(pg, 'Dışa Aktar', exact=True); await pg.wait_for_timeout(500); await shot(pg, '21_export')
        async with pg.expect_download(timeout=60000) as dl:
            await pg.locator('button.btn.pri.huge').click()
        d = await dl.value
        print('download', d.suggested_filename)
        await pg.wait_for_timeout(4000)
        await shot(pg, '22_export_done')
        await tap(pg, 'Ayarlar', exact=True); await pg.wait_for_timeout(500); await shot(pg, '23_settings')
        await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 1100)'); await shot(pg, '24_settings_2')
        await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 1100)'); await shot(pg, '25_settings_3')
        for nm in ['poz','layers','definitions','hub','audit','sync']:
            await pg.evaluate(f"() => window.__app.nav.go('{nm}')"); await pg.wait_for_timeout(600); await shot(pg, '30_' + nm)
        await pg.evaluate("() => window.__app.nav.tab('map')"); await pg.wait_for_timeout(800)
        await pg.evaluate("() => { window.__app.state.sel = { type: 'line', id: window.__app.ps.data.lines[0].id, seg: 2 }; window.__app.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(500)
        await shot(pg, '31_map_line_sel')
        await b.close()
    srv.terminate()
    print('ERRORS', len(errors))
    for e in errors[:30]: print(e)
try:
    asyncio.run(main())
finally:
    print('ERRORS', len(errors))
    for e in errors[:30]: print(e)
