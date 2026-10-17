# Sürüm geçiş testi: 2.2.0 ile oluşturulan veritabanı 2.3.0 ile açılır (katalog güncellenir, veriler korunur), sonra 2.2.0'a geri dönülür.
import asyncio, sys, subprocess, time, json, shutil
from playwright.async_api import async_playwright
OLD = '/tmp/claude-0/wt220/web/dist/www'; NEW = '/home/claude/voltapp/web/dist/www'; PROFILE = '/tmp/claude-0/upg23-profile'
shutil.rmtree(PROFILE, ignore_errors=True)
def serve(d):
    p = subprocess.Popen([sys.executable, '-m', 'http.server', '8771', '-d', d], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1); return p
async def session(p, fn):
    errors = []
    ctx = await p.chromium.launch_persistent_context(PROFILE, viewport={'width': 390, 'height': 844})
    pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
    async def guard(route):
        if route.request.url.startswith('http://127.0.0.1:8771/'): await route.continue_()
        else: await route.abort()
    await pg.route('**/*', guard)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
    await pg.goto('http://127.0.0.1:8771/index.html'); await pg.wait_for_function('window.__voltReady === true', timeout=60000)
    r = await fn(pg)
    await pg.wait_for_timeout(500); await ctx.close()
    return r, errors
SUMMARY = """() => { const ps = window.__app.ps; const q = ps.result.quantities; return { proje: ps.p && ps.p.name, nokta: ps.data.points.length, ekipman: ps.data.equipment.map(e => e.no + ':' + e.kind + ':' + (e.hak || '-')).join(','), hat: ps.data.lines.map(l => l.lineNo + ':' + l.nodes.length).join(','), aciklik: ps.result.spans.length, metraj: q.length, toplam: Math.round(q.reduce((a, x) => a + x.qty, 0) * 100) / 100, donem: ps.data.periods.map(p => p.no + ':' + p.status).join(','), poz: ps.cat.t.poz.length, kosk: q.filter(x => x.servis === '022.02.03.03-052').map(x => x.servis + '×' + x.qty).join(',') }; }"""
MAKE = """async () => {
  const a = window.__app, ps = a.ps;
  const pr = await ps.createProject({ name: 'Geçiş testi 2.2.0', code: 'UPG-2', cm: 39, mode: 'asbuilt' }); await ps.open(pr.id);
  const t = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id; const ids = [];
  for (let i = 0; i < 4; i++) { const e = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { coord: { E: 519000 + i * 90, N: 4282000 + i * 12, H: 1050 + i }, source: 'MANUAL' }); ids.push(e.pointId); }
  await ps.createLine({ lineType: 'OG', install: 'havai', circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }], nodes: ids });
  await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'direk', kva: 100, cins: 'herm' } }, { coord: { E: 519400, N: 4282060, H: 1052 }, source: 'MANUAL' });
  await ps.addEquipment('subscriber', { attrs: { phase: 'tek' } }, { coord: { E: 519420, N: 4282090, H: 1052 }, source: 'MAP' });
  await ps.setHak('equipment', ps.data.equipment[0].id, 'KONTROL');
  await ps.createWorkProgram(); await ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' });
  return true;
}"""
async def main():
    async with async_playwright() as p:
        srv = serve(OLD)
        _, e1 = await session(p, lambda pg: pg.evaluate(MAKE))
        s220, e1b = await session(p, lambda pg: pg.evaluate(SUMMARY))
        srv.terminate(); srv.wait(); time.sleep(0.5)
        print('2.2.0  ', json.dumps(s220, ensure_ascii=False), 'hata:', e1 + e1b)
        srv = serve(NEW)
        async def up(pg):
            s = await pg.evaluate(SUMMARY)
            ap = await pg.evaluate("() => window.__app.ps.approval().on")
            # 2.3.0 özellikleri eski veride: köşk + kabin, kofre, enerji, numara
            await pg.evaluate("""async () => { const ps = window.__app.ps;
              const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mono', kva: 630, cins: 'herm' } }, { coord: { E: 519500, N: 4282060, H: 1052 }, source: 'MANUAL' });
              const ab = ps.data.equipment.find((e) => e.kind === 'subscriber'); await ps.updateEquipment(ab.id, { attrs: Object.assign({}, ab.attrs, { kofre: true }) }, 'kofre');
              await ps.renumber({ kinds: ['pole'], prefix: 'D-', start: 201, digits: 3 }); }""")
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(700)
            await pg.screenshot(path='/home/claude/voltapp/web/tests/ui/shots/u23_map.png')
            return s, ap, await pg.evaluate(SUMMARY)
        (s230, ap, s230b), e2 = await session(p, up)
        srv.terminate(); srv.wait(); time.sleep(0.5)
        print('2.3.0  ', json.dumps(s230, ensure_ascii=False)); print('  yeni kayıtlar sonrası', json.dumps(s230b, ensure_ascii=False), 'onay:', ap, 'hata:', e2)
        for k in ['proje', 'nokta', 'ekipman', 'hat', 'aciklik', 'metraj', 'toplam', 'donem']: assert s220[k] == s230[k], ('2.3.0 açılışında fark', k, s220[k], s230[k])
        assert s230['poz'] > s220['poz'], 'katalog güncellenmeli'
        assert ap is False, 'onay mekanizması kendiliğinden açılmamalı'
        assert s230b['kosk'], 'yeni monoblok trafoda köşk kalemi'
        assert 'D-201' in s230b['ekipman']
        assert not e2, e2
        # geri dönüş: 2.2.0 aynı veritabanını açar
        srv = serve(OLD)
        s220b, e3 = await session(p, lambda pg: pg.evaluate(SUMMARY))
        srv.terminate(); srv.wait()
        print('2.2.0 (geri dönüş)', json.dumps(s220b, ensure_ascii=False), 'hata:', e3)
        assert s220b['proje'] == s220['proje'] and s220b['nokta'] == s230b['nokta'] and not e3, e3
        print('GEÇİŞ TESTİ TAMAM')
asyncio.run(main())
