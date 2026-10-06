# v2.3 denemesi: enerji kontrolü, otomatik numara, CAD çizimi, tepe kuvveti
import asyncio, sys
sys.path.insert(0, '/home/claude/voltapp/web/tests/ui')
from v23_lib import *
DATA = """async () => {
  const ps = window.__app.ps; const ids = {};
  const pole = async (k, E, N, group) => { const e = await ps.addEquipment('pole', { group: group || 'bahh', state: 'YENI' }, { coord: { E, N, H: 1050 } }); ids[k] = e.pointId; return e; };
  await pole('a', 519000, 4282000); await pole('b', 519080, 4282000); await pole('c', 519160, 4282030);
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mono', kva: 400, cins: 'herm' } }, { coord: { E: 519240, N: 4282030, H: 1050 } }); ids.tr = tr.pointId;
  await pole('d', 519240, 4281960, 'sehir'); await pole('e', 519240, 4281900, 'sehir');
  await pole('f', 519400, 4281900, 'sehir'); await pole('g', 519460, 4281900, 'sehir');
  const og = await ps.createLine({ lineType: 'OG', nodes: [ids.a, ids.b, ids.c, ids.tr], circuits: [{ role: 'OG', conductorId: null }] });
  const ag = await ps.createLine({ lineType: 'AG', nodes: [ids.tr, ids.d, ids.e], circuits: [{ role: 'AG', conductorId: null }] });
  const dead = await ps.createLine({ lineType: 'AG', nodes: [ids.f, ids.g], circuits: [{ role: 'AG', conductorId: null }] });
  window.__ids = Object.assign(ids, { og: og.id, ag: ag.id, dead: dead.id });
  window.__app.state.view = { cE: 519230, cN: 4281965, res: 0.75 }; window.__app.state.follow = false;
  return ids;
}"""
def dxf():
    out = ['0', 'SECTION', '2', 'ENTITIES']
    def line(layer, x1, y1, x2, y2): out.extend(['0', 'LINE', '8', layer, '10', str(x1), '20', str(y1), '11', str(x2), '21', str(y2)])
    line('OG_3x477_HAWK', 519000, 4282200, 519100, 4282200)
    line('OG_3x477_HAWK', 519100, 4282200, 519180, 4282260)
    line('AG_ROSE', 519100, 4282200, 519100, 4282140)
    out.extend(['0', 'TEXT', '8', 'YAZI', '10', '519102', '20', '4282205', '40', '3', '1', 'D5'])
    out.extend(['0', 'ENDSEC', '0', 'EOF', ''])
    return '\n'.join(out)
STATS = "() => [...document.querySelectorAll('.sheet .stat span')].map((x) => x.textContent)"
async def main():
    async with async_playwright() as p:
        srv, b, pg, errors = await start(p)
        try:
            await pg.evaluate(SETUP)
            ids = await pg.evaluate(DATA)
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(700); await shot(pg, 'g00_map')
            # --- enerji ---
            await pg.locator('button[aria-label="Enerji kontrolü"]').click(); await pg.wait_for_timeout(300); await shot(pg, 'g01_energy_closed')
            await pg.get_by_text("OG'ye enerji ver").click(); await pg.get_by_text("AG'ye enerji ver").click(); await pg.wait_for_timeout(300); await shot(pg, 'g02_energy_nosrc')
            r = await pg.evaluate(STATS); print('kaynaksiz:', r)
            assert r[0] == '0', 'kaynak yokken enerjili hat olmamalı'
            await pg.locator('.sheet .grab').click(); await pg.wait_for_timeout(300)
            await pg.evaluate("() => { const a = window.__app; a.state.sel = { type: 'point', id: window.__ids.a }; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(400); await shot(pg, 'g03_point_card')
            await pg.get_by_text('Buradan OG enerjisi ver').click(); await pg.wait_for_timeout(700)
            await pg.evaluate("() => { const a = window.__app; a.state.sel = null; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(400); await shot(pg, 'g04_energized')
            await pg.locator('button[aria-label="Enerji kontrolü"]').click(); await pg.wait_for_timeout(300); await shot(pg, 'g05_energy_sheet')
            r = await pg.evaluate(STATS); print('kaynakli:', r)
            assert r == ['2', '1', '2'], r
            await pg.locator('.sheet .grab').click(); await pg.wait_for_timeout(300)
            await pg.evaluate("() => { const a = window.__app; a.state.sel = { type: 'line', id: window.__ids.og, seg: 0 }; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(400); await shot(pg, 'g06_line_card')
            await pg.get_by_text('Hattı aç (ayır)').click(); await pg.wait_for_timeout(700); await shot(pg, 'g07_line_open')
            await pg.evaluate("() => { const a = window.__app; a.state.sel = null; a.bus.emit('ui:sel'); }")
            await pg.locator('button[aria-label="Enerji kontrolü"]').click(); await pg.wait_for_timeout(300)
            r = await pg.evaluate(STATS); print('hat acik:', r)
            assert r[0] == '0', r
            await shot(pg, 'g08_energy_open_line')
            await pg.get_by_text('Enerjiyi kes · kontrolü kapat').click(); await pg.wait_for_timeout(300)
            await pg.evaluate("async () => { const ps = window.__app.ps; await ps.updateLine(window.__ids.og, { energyOpen: false }, 'test'); }")
            # --- otomatik numara ---
            await pg.evaluate("() => window.__app.nav.go('objects')"); await pg.wait_for_timeout(400)
            await pg.get_by_text('№ Otomatik numara').click(); await pg.wait_for_timeout(300); await shot(pg, 'g09_renumber')
            await pg.locator('input.inp.mono[type=number]').first.fill('101'); await pg.wait_for_timeout(200); await shot(pg, 'g10_renumber_101')
            await pg.get_by_text('Numaraları ver').click(); await pg.wait_for_timeout(900)
            nos = await pg.evaluate("() => window.__app.ps.data.equipment.filter((e) => e.kind === 'pole').map((e) => [e.no, e.prevNo, window.__app.ps.pointById(e.pointId).pointNo])"); print('numaralar:', nos)
            assert sorted(x[0] for x in nos) == ['A-01', 'A-02', 'A-03', 'A-04', 'D-101', 'D-102', 'D-103'] and all(x[0] == x[2] for x in nos), nos
            await shot(pg, 'g11_objects_after')
            # --- CAD ---
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(500)
            await pg.locator('button[aria-label="CAD çizimleri"]').click(); await pg.wait_for_timeout(300); await shot(pg, 'g12_cad_empty')
            await pg.locator('.sheet input[type=file]').set_input_files({ 'name': 'ornek.dxf', 'mimeType': 'application/dxf', 'buffer': dxf().encode() }); await pg.wait_for_timeout(1200); await shot(pg, 'g13_cad_on_map')
            docs = await pg.evaluate("() => window.__app.ps.data.documents.filter((d) => d.kind === 'CAD').map((d) => [d.name, d.entCount, d.layerCount, d.bbox])"); print('cad:', docs)
            assert docs and docs[0][1] == 4
            xy = await pg.evaluate("() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); const e = window.__app.state.mapEngine; const s = e.toScreen(519100, 4282200); return [r.left + s.x, r.top + s.y]; }"); print('tap', xy)
            await pg.mouse.click(xy[0], xy[1]); await pg.wait_for_timeout(500); await shot(pg, 'g14_cad_point')
            sel = await pg.evaluate("() => window.__app.state.sel"); print('sel', sel)
            assert sel and sel['type'] == 'cad', sel
            await pg.locator('button', has_text='Tepe kuvveti').first.click(); await pg.wait_for_timeout(600); await shot(pg, 'g15_tepe')
            await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 700)'); await shot(pg, 'g16_tepe_b')
            await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 900)'); await shot(pg, 'g17_tepe_c')
            sels = pg.locator('main.screen select'); n = await sels.count(); print('select sayisi', n)
            opts = await sels.nth(5).evaluate('(s) => [...s.options].map((o) => o.value + "=" + o.textContent)'); print('AG secenek', opts[:8])
            await sels.nth(5).select_option(index=2); await pg.wait_for_timeout(500)
            await pg.locator('main.screen').evaluate('(m) => m.scrollTo(0, m.scrollHeight)'); await shot(pg, 'g18_tepe_result')
            txt = await pg.locator('main.screen').inner_text(); i = txt.find('SONUÇ'); print(txt[i:i + 900])
            assert 'Her kol için iletken' not in txt[i:], 'sonuç hesaplanmalı'
        finally:
            print('ERRORS', len(errors)); [print('  ', e) for e in errors[:10]]
            await b.close(); srv.terminate()
    if errors: sys.exit(1)
asyncio.run(main())
