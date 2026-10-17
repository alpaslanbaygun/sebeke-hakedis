# Sürüm geçiş testi: 2.1.0 ile oluşturulan veritabanı (IndexedDB) 2.2.0 ile açılır, sonra tekrar 2.1.0'a dönülür.
# Aynı adres (origin) ve aynı tarayıcı profili kullanılır → telefondaki "üzerine kurma" ve "geri dönüş" senaryosu.
import asyncio, sys, subprocess, time, json, shutil, os
from playwright.async_api import async_playwright
OLD = '/tmp/claude-0/wt210/web/dist/www'; NEW = '/home/claude/voltapp/web/dist/www'; PROFILE = '/tmp/claude-0/upg-profile'
shutil.rmtree(PROFILE, ignore_errors=True)
def serve(d):
    p = subprocess.Popen([sys.executable, '-m', 'http.server', '8770', '-d', d], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1); return p
async def session(p, fn):
    errors = []
    ctx = await p.chromium.launch_persistent_context(PROFILE, viewport={'width': 390, 'height': 844})
    pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
    await pg.route('**/*', lambda r: r.continue_())  # HTTP önbelleğini devre dışı bırakır (aynı adreste farklı sürüm)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    await pg.goto('http://127.0.0.1:8770/index.html'); await pg.wait_for_function('window.__voltReady === true', timeout=60000)
    r = await fn(pg)
    await pg.wait_for_timeout(500); await ctx.close()
    return r, errors
SUMMARY = """() => { const ps = window.__app.ps; return { proje: ps.p && ps.p.name, nokta: ps.data.points.length, ekipman: ps.data.equipment.map(e => e.no + ':' + e.kind).join(','), hat: ps.data.lines.map(l => l.lineNo + ':' + l.nodes.length).join(','), aciklik: ps.result.spans.length, metraj: ps.result.quantities.length, kg: Math.round(ps.result.quantities.reduce((s, q) => s + (q.unit === 'Kg' ? q.qty : 0), 0) * 100) / 100, gecis: (ps.data.crossings || []).filter(c => c.status !== 'deleted').length, hata: ps.result.issues.filter(i => i.severity === 'error').length }; }"""
async def main():
    async with async_playwright() as p:
        # 1) 2.1.0: proje + 4 direk + hat + geçiş + telefon noktası
        srv = serve(OLD)
        async def make(pg):
            return await pg.evaluate("""async () => {
              const a = window.__app, ps = a.ps;
              const pr = await ps.createProject({ name: 'Geçiş testi 2.1.0', code: 'UPG-1', cm: 39 }); await ps.open(pr.id);
              const t = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id;
              const obs = (E, N, H) => ({ lat: null, lon: null, E, N, h: H + 36, H, epochs: 5, sigmaH: 0.009, sigmaV: 0.014, pdop: 1.3, sats: 26, age: 1, fix: 'FIX', source: 'external', cls: 'RTK', receiver: 'M20L', timestamp: new Date().toISOString() });
              const ids = [];
              for (let i = 0; i < 4; i++) { const g = (await import('./app.js').catch(() => null)); const e = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { coord: { E: 519000 + i * 90, N: 4282000 + i * 12, H: 1050 + i }, source: 'MANUAL' }); ids.push(e.pointId); }
              const l = await ps.createLine({ lineType: 'OG', install: 'havai', circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }], nodes: ids });
              const sp = ps.result.spans[0];
              await ps.addCrossing({ crossKind: 'karayolu', label: 'D300 Karayolu', spanId: sp.id, distance: 30, E: 519030, N: 4282004, groundH: 1051, objectHeight: 4.5 });
              await ps.createWorkProgram(); await ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' });
              return true;
            }""")
        # app.js yeniden yüklenmesin diye import satırı olmadan tekrar yaz
        async def make2(pg):
            return await pg.evaluate("""async () => {
              const a = window.__app, ps = a.ps;
              const pr = await ps.createProject({ name: 'Geçiş testi 2.1.0', code: 'UPG-1', cm: 39 }); await ps.open(pr.id);
              const t = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id;
              const ids = [];
              for (let i = 0; i < 4; i++) { const e = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { coord: { E: 519000 + i * 90, N: 4282000 + i * 12, H: 1050 + i }, source: 'MANUAL' }); ids.push(e.pointId); }
              await ps.createLine({ lineType: 'OG', install: 'havai', circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }], nodes: ids });
              const sp = ps.result.spans[0];
              await ps.addCrossing({ crossKind: 'karayolu', label: 'D300 Karayolu', spanId: sp.id, distance: 30, E: 519030, N: 4282004, groundH: 1051, objectHeight: 4.5 });
              await ps.createWorkProgram(); await ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' });
              return true;
            }""")
        _, e1 = await session(p, make2)
        s210, e1b = await session(p, lambda pg: pg.evaluate(SUMMARY))
        srv.terminate(); srv.wait(); time.sleep(0.5)
        print('2.1.0  ', json.dumps(s210, ensure_ascii=False), 'hata:', e1 + e1b)
        # 2) 2.2.0 aynı veritabanını açar
        srv = serve(NEW)
        async def up(pg):
            s = await pg.evaluate(SUMMARY)
            hak = await pg.evaluate("() => window.__app.ps.hakCounts()")
            await pg.get_by_text('Harita', exact=True).click(); await pg.wait_for_timeout(900)
            asked = await pg.locator('.modal h3', has_text='Geçiş kayıtları').count()
            await pg.screenshot(path='/home/claude/voltapp/web/tests/ui/shots/60_upgrade_crossing_prompt.png')
            await pg.locator('.modal button', has_text='Detay noktasına dönüştür').click(); await pg.wait_for_timeout(1200)
            s2 = await pg.evaluate(SUMMARY)
            # 2.2.0 ile yeni tür + hakediş durumu + haritadan nokta
            await pg.evaluate("""async () => { const ps = window.__app.ps; await ps.addEquipment('luminaire', { state: 'YENI', attrs: { typeName: 'LED 100 W' } }, { coord: { E: 519100, N: 4282060, H: null }, source: 'MAP' }); await ps.setHak('equipment', ps.data.equipment[0].id, 'KONTROL'); }""")
            return s, hak, asked, s2, await pg.evaluate(SUMMARY)
        (s220, hak, asked, s220b, s220c), e2 = await session(p, up)
        srv.terminate(); srv.wait(); time.sleep(0.5)
        print('2.2.0  ', json.dumps(s220, ensure_ascii=False)); print('  hakediş durumu (türetilmiş):', hak, '· geçiş sorusu:', asked)
        print('  dönüştürme sonrası', json.dumps(s220b, ensure_ascii=False)); print('  yeni kayıtlar sonrası', json.dumps(s220c, ensure_ascii=False), 'hata:', e2)
        for k in ['proje', 'ekipman', 'hat', 'aciklik', 'metraj', 'kg']: assert s210[k] == s220[k], ('2.2.0 açılışında fark', k, s210[k], s220[k])
        assert s210['nokta'] == s220['nokta'] and asked == 1 and s220b['gecis'] == 0 and s220b['nokta'] == s210['nokta'] + 1
        assert not e2, e2
        # 3) Geri dönüş: 2.1.0 aynı veritabanını (2.2.0 kayıtlarıyla) açar
        srv = serve(OLD)
        async def back(pg):
            s = await pg.evaluate(SUMMARY)
            await pg.get_by_text('Harita', exact=True).click(); await pg.wait_for_timeout(900)
            await pg.screenshot(path='/home/claude/voltapp/web/tests/ui/shots/61_rollback_map.png')
            return s
        s210b, e3 = await session(p, back)
        srv.terminate()
        print('2.1.0\'a dönüş', json.dumps(s210b, ensure_ascii=False), 'hata:', e3)
        assert s210b['proje'] == s210['proje'] and s210b['hat'] == s210['hat'] and s210b['aciklik'] == s210['aciklik'] and not e3, e3
        print('GEÇİŞ TESTİ TAMAM')
asyncio.run(main())
