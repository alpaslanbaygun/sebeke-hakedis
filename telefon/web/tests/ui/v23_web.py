# v2.3 denemesi (web / ofis genişliği): enerji paneli, CAD paneli, kullanıcılar ekranı, tepe kuvveti
import asyncio, sys, re
sys.path.insert(0, '/home/claude/voltapp/web/tests/ui')
src = open('/home/claude/voltapp/web/tests/ui/web.py').read()
MOCK = re.search(r'MOCK = r"""(.*?)"""', src, re.S).group(1)
from v23_lib import *
import v23_grid
async def main():
    async with async_playwright() as p:
        srv, b, pg, errors = await start(p, port=8813, w=1440, h=900, www='/home/claude/voltapp/web/dist/web', init=MOCK)
        try:
            await pg.evaluate(SETUP); await pg.evaluate(v23_grid.DATA)
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(800)
            await pg.locator('button[aria-label="Enerji kontrolü"]').click(); await pg.wait_for_timeout(300)
            await pg.get_by_text("OG'ye enerji ver").click(); await pg.get_by_text("AG'ye enerji ver").click()
            await pg.evaluate("async () => { const ps = window.__app.ps; await ps.updateProject({ energy: { og: [window.__ids.a], ag: [] } }, 'kaynak'); }"); await pg.wait_for_timeout(600); await shot(pg, 'w23_energy')
            await pg.locator('.sheet .grab').click(); await pg.wait_for_timeout(200)
            await pg.locator('button[aria-label="CAD çizimleri"]').click(); await pg.wait_for_timeout(300)
            await pg.locator('.sheet input[type=file]').set_input_files({ 'name': 'ornek.dxf', 'mimeType': 'application/dxf', 'buffer': v23_grid.dxf().encode() }); await pg.wait_for_timeout(1500); await shot(pg, 'w23_cad')
            xy = await pg.evaluate("() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); const e = window.__app.state.mapEngine; const s = e.toScreen(519100, 4282200); return [r.left + s.x, r.top + s.y]; }")
            await pg.mouse.click(xy[0], xy[1]); await pg.wait_for_timeout(500); await shot(pg, 'w23_cad_point')
            assert (await pg.evaluate("() => (window.__app.state.sel || {}).type")) == 'cad'
            await pg.locator('button', has_text='Tepe kuvveti').first.click(); await pg.wait_for_timeout(600); await shot(pg, 'w23_tepe')
            await pg.evaluate("() => window.__app.nav.go('team')"); await pg.wait_for_timeout(400); await shot(pg, 'w23_team')
            await pg.evaluate("() => window.__app.nav.go('objects')"); await pg.wait_for_timeout(300); await pg.get_by_text('№ Otomatik numara').click(); await pg.wait_for_timeout(300); await shot(pg, 'w23_renumber')
            await pg.wait_for_timeout(2500)
            st = await pg.evaluate("() => ({ st: window.__app.cloud && window.__app.cloud.status, x: Object.keys(window.__cloud.docs()).filter((k) => k.startsWith('x/')).length })"); print('bulut:', st)
            assert st['x'] >= 1, 'çizim buluta yazıldı'
        finally:
            print('ERRORS', len(errors)); [print('  ', e) for e in errors[:10]]
            await b.close(); srv.terminate()
    if errors: sys.exit(1)
if __name__ == '__main__': asyncio.run(main())
