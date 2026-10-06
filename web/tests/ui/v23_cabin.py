import asyncio, sys
sys.path.insert(0, '/home/claude/voltapp/web/tests/ui')
from v23_lib import *
async def main():
    async with async_playwright() as p:
        srv, b, pg, errors = await start(p)
        try:
            await pg.evaluate(SETUP)
            eid = await pg.evaluate("""async () => { const ps = window.__app.ps; const e = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mono', kva: 630, cins: 'herm' } }, { coord: { E: 519100, N: 4282100, H: 1050 }, source: 'MANUAL' }); return e.id; }""")
            before = await pg.evaluate(f"() => {{ const ps = window.__app.ps; const m = ps.result.matsByEq.get('{eid}'); return m.items.map((x) => [x.servis, x.qty, x.tag]); }}")
            print('kabinsiz kesif:', before)
            assert any(x[0] == '022.02.03.03-052' for x in before), 'monoblokta gövde TİP1C (BOŞ) gelmeli'
            await pg.evaluate(f"() => window.__app.nav.go('equipment', {{ id: '{eid}' }})"); await shot(pg, 'k00_equipment')
            await pg.locator('button', has_text='Kabini kur').click(); await pg.wait_for_timeout(500); await shot(pg, 'k01_cabin')
            # hücre ekle (sığana kadar), sil, sırala
            await pg.locator('button.btn.pri', has_text='Ekle').click(); await pg.wait_for_timeout(300)
            n = await pg.locator('.card.tight.list .li b.mono').count(); print('hucre sayisi', n)
            await pg.locator('button.btn.pri', has_text='Ekle').click(); await pg.wait_for_timeout(300); await shot(pg, 'k02_cabin_full')
            await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 900)'); await shot(pg, 'k03_cabin_cells')
            await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 1100)'); await shot(pg, 'k04_cabin_channels')
            await pg.get_by_placeholder('ör. OG giriş kanalı').fill('OG giriş kanalı')
            await pg.locator('input[type=number][step="0.01"]').fill('6.5'); await pg.get_by_text('Kanal ekle', exact=True).nth(1).click(); await pg.wait_for_timeout(300)
            await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 1200)'); await shot(pg, 'k05_cabin_kesif')
            await pg.get_by_text('KABİNİ KAYDET').click(); await pg.wait_for_timeout(800)
            after = await pg.evaluate(f"() => {{ const ps = window.__app.ps; const m = ps.result.matsByEq.get('{eid}'); return m.items.map((x) => [x.servis, x.qty, x.tag, x.unit]); }}")
            print('kabinli kesif:'); [print('  ', x) for x in after]
            assert any(x[2] == 'kosk' for x in after) and any(x[2] == 'hucre' for x in after) and any(x[2] == 'kanal' and x[1] == 6.5 for x in after)
            # trafo binası
            await pg.locator('main.screen').evaluate('(m) => m.scrollTo(0, 0)')
            await pg.get_by_text('Trafo binası (MOD)').click(); await pg.wait_for_timeout(400); await shot(pg, 'k06_cabin_mod5')
        finally:
            print('ERRORS', len(errors)); [print('  ', e) for e in errors[:10]]
            await b.close(); srv.terminate()
    if errors: sys.exit(1)
asyncio.run(main())
