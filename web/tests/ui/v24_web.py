# v2.4 denemesi (web / ofis genişliği): direk kaydında armatür, hat kaydında kanal + elle malzeme, kabin (hücresiz PB köşk),
# ayarlar (profiller, kullanıcılar girişi), proje silme
import asyncio, sys, re
sys.path.insert(0, '/home/claude/voltapp/web/tests/ui')
src = open('/home/claude/voltapp/web/tests/ui/web.py').read()
MOCK = re.search(r'MOCK = r"""(.*?)"""', src, re.S).group(1)
from v23_lib import *
DATA = """async () => { const ps = window.__app.ps; const c = (i) => ({ coord: { E: 519000 + i * 60, N: 4282000, H: 1050 }, source: 'MANUAL' });
  const t = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id;
  const d = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, c(0));
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mbk', kva: 400, cins: 'herm', govde: '022.02.05.01-002' } }, c(1));
  const pn = await ps.addEquipment('panel', { attrs: {} }, c(2));
  const l = await ps.createLine({ lineType: 'AG', install: 'yeralti', circuits: [{ role: 'AG', key: 'NYY 3x50+25', count: 1 }], nodes: [tr.pointId, pn.pointId], cable: { surface: 'asfalt', method: 'borulu', depth: 0.8, width: 0.4, pipeDia: 110, pipeCount: 2 } });
  return { d: d.id, tr: tr.id, l: l.id, oto: ps.p.autoRecipe }; }"""
async def main():
    async with async_playwright() as p:
        srv, b, pg, errors = await start(p, port=8814, w=1440, h=900, www='/home/claude/voltapp/web/dist/web', init=MOCK)
        try:
            await pg.evaluate(SETUP); ids = await pg.evaluate(DATA); print('yeni projede otomatik reçete:', ids['oto']); assert ids['oto'] is False
            await pg.evaluate("(id) => window.__app.nav.go('equipment', { id })", ids['d']); await pg.wait_for_timeout(500)
            assert await pg.get_by_text('Armatür (direğin malzemesi)').count() >= 1
            await pg.get_by_role('button', name=re.compile('Malzeme ekle')).first.click(); await pg.wait_for_timeout(300); await shot(pg, 'w24_pole')
            await pg.evaluate("(id) => window.__app.nav.go('line', { id })", ids['l']); await pg.wait_for_timeout(600); await shot(pg, 'w24_line')
            txt = await pg.evaluate("() => document.body.textContent")
            assert 'Kaplama' in txt and 'Yatay sondaj' in txt and 'Direk inişi' not in txt and 'Duvar geçişi' not in txt
            q = await pg.evaluate("(id) => { const ci = window.__app.ps.result.lineInfo.get(id); return [ci.cable.kanal.surface, ci.cable.kanal.method, Math.round(ci.cable.kanal.hacim * 100) / 100, ci.cable.kanal.boru, ci.items.filter(x => x.kanal).map(x => x.servis)]; }", ids['l']); print('kanal:', q)
            assert q[0] == 'asfalt' and q[1] == 'borulu' and abs(q[2] - 60 * 0.4 * 0.8) < 0.01 and q[3] == 120
            await pg.evaluate("(id) => window.__app.nav.go('cabin', { id })", ids['tr']); await pg.wait_for_timeout(700); await shot(pg, 'w24_cabin')
            txt = await pg.evaluate("() => document.body.textContent")
            assert 'PB-' in txt and 'Bina tipi' not in txt, 'kabin ekranında PB tipleri var, bina tipi yok'
            await pg.get_by_text('Ayarlar', exact=True).first.click(); await pg.wait_for_timeout(500); await shot(pg, 'w24_settings')
            txt = await pg.evaluate("() => document.body.textContent")
            assert 'Alıcı markası' not in txt and 'Spectra' not in txt and 'Kullanıcılar ve hakediş onayı' in txt
            await pg.evaluate("() => window.__app.nav.go('projects')"); await pg.wait_for_timeout(400)
            await pg.locator('button[aria-label^="Projeyi sil"]').first.click(); await pg.wait_for_timeout(300)
            await pg.locator('.modal input, .mb input').first.fill('OG-03 Hat Yenileme · Kurtdere'); await shot(pg, 'w24_delete')
            await pg.get_by_role('button', name='Kalıcı olarak sil').click(); await pg.wait_for_timeout(1200)
            left = await pg.evaluate("async () => { const ps = window.__app.ps; return [(await ps.listProjects()).length, ps.p && ps.p.name]; }"); print('silme sonrası:', left)
            assert left == [0, None]
            await pg.wait_for_timeout(3000)
            st = await pg.evaluate("() => (window.__app.cloud && window.__app.cloud.status)"); print('bulut:', st)
            # silme buluta da yansıdı mı: sayfa yeniden açılınca proje geri gelmemeli
            await pg.reload(); await pg.wait_for_function('window.__voltReady === true', timeout=60000); await pg.wait_for_timeout(1200)
            back = await pg.evaluate("async () => { const a = window.__app; return [(await a.ps.listProjects()).length, a.ps.p && a.ps.p.name, (await a.ds.db.getAll('equipment')).length, (await a.ds.db.getAll('lines')).length]; }"); print('yeniden açılış:', back)
            assert back == [0, None, 0, 0], back
        finally:
            print('ERRORS', len(errors)); [print('  ', e) for e in errors[:10]]
            await b.close(); srv.terminate()
    if errors: sys.exit(1)
if __name__ == '__main__': asyncio.run(main())
