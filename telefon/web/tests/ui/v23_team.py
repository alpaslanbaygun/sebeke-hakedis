# v2.3 denemesi: kullanıcılar, roller, şifreli oturum, onay bekleyenler
import asyncio, sys
sys.path.insert(0, '/home/claude/voltapp/web/tests/ui')
from v23_lib import *
DATA = """async () => {
  const ps = window.__app.ps; const ids = [];
  for (let i = 0; i < 4; i++) { const e = await ps.addEquipment('pole', { group: 'bahh', state: 'YENI' }, { coord: { E: 519000 + i * 70, N: 4282000, H: 1050 } }); ids.push(e); }
  const l = await ps.createLine({ lineType: 'OG', nodes: ids.map((e) => e.pointId), circuits: [{ role: 'OG', conductorId: null }] });
  window.__ids = { poles: ids.map((e) => e.id), pts: ids.map((e) => e.pointId), line: l.id };
  window.__app.state.view = { cE: 519100, cN: 4281980, res: 0.6 }; window.__app.state.follow = false;
}"""
async def pins(pg, a, b=None):
    f = pg.locator('.modal input[type=password], input[type=password]')
    await f.nth(0).fill(a)
    if b is not None: await f.nth(1).fill(b)
async def add_member(pg, name, role, pin):
    await pg.get_by_text('+ Kullanıcı ekle').click(); await pg.wait_for_timeout(250)
    await pg.locator('input.inp:not([type=password])').last.fill(name)
    await pg.locator('select').last.select_option(role)
    await pins(pg, pin, pin)
    await pg.get_by_text('Kaydet', exact=True).click(); await pg.wait_for_timeout(600)
async def login(pg, name, pin):
    await pg.locator('button', has_text='Oturum aç').first.click(); await pg.wait_for_timeout(250)
    await pg.get_by_role('dialog').locator('button.li', has_text=name).click(); await pg.wait_for_timeout(150)
    await pins(pg, pin)
    await pg.get_by_role('dialog').get_by_role('button', name='Giriş').click(); await pg.wait_for_timeout(500)
async def main():
    async with async_playwright() as p:
        srv, b, pg, errors = await start(p)
        try:
            await pg.evaluate(SETUP); await pg.evaluate(DATA)
            await pg.evaluate("() => window.__app.nav.go('hub')"); await pg.wait_for_timeout(400); await shot(pg, 't00_hub')
            await pg.locator('button', has_text='Kullanıcılar ve hakediş onayı').click(); await pg.wait_for_timeout(300); await shot(pg, 't01_team_off')
            await pg.get_by_text('İlk yöneticiyi tanımla · onayı aç').click(); await pg.wait_for_timeout(250)
            await pg.locator('input.inp:not([type=password])').last.fill('Deneme Yönetici'); await pins(pg, '9999', '9999'); await shot(pg, 't02_first_admin')
            await pg.get_by_text('Kaydet', exact=True).click(); await pg.wait_for_timeout(900); await shot(pg, 't03_team_on')
            await add_member(pg, 'Saha Kişisi', 'saha', '1111'); await add_member(pg, 'Kontrol Kişisi', 'kontrol', '2222'); await add_member(pg, 'Hakediş Kişisi', 'hakedis', '3333'); await add_member(pg, 'Onay Kişisi', 'onay', '4444')
            await shot(pg, 't04_members'); await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 900)'); await shot(pg, 't05_rules')
            await pg.locator('main.screen').evaluate('(m) => m.scrollTo(0, 0)')
            await pg.get_by_text('Oturumu kapat').click(); await pg.wait_for_timeout(300)
            # yanlış şifre
            await pg.locator('button', has_text='Oturum aç').first.click(); await pg.wait_for_timeout(250)
            await pg.get_by_role('dialog').locator('button.li', has_text='Saha Kişisi').click(); await pins(pg, '0000'); await pg.get_by_role('dialog').get_by_role('button', name='Giriş').click(); await pg.wait_for_timeout(300); await shot(pg, 't06_wrong_pin')
            assert await pg.get_by_text('Şifre yanlış').count() == 1
            await pins(pg, '1111'); await pg.get_by_role('dialog').get_by_role('button', name='Giriş').click(); await pg.wait_for_timeout(500)
            who = await pg.evaluate("() => window.__app.ps.member && window.__app.ps.member.name"); print('oturum:', who); assert who == 'Saha Kişisi'
            # haritada obje kartı: saha için KONTROL soluk
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(500)
            await pg.evaluate("() => { const a = window.__app; a.state.sel = { type: 'point', id: window.__ids.pts[1] }; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(400); await shot(pg, 't07_map_card_saha')
            await pg.locator('.hakrow button[aria-label="Kontrol Edildi"]').click(); await pg.wait_for_timeout(500); await shot(pg, 't08_denied')
            h = await pg.evaluate("() => window.__app.ps.eqById(window.__ids.poles[1]).hak"); print('saha kontrol denedi →', h); assert h == 'TAMAMLANDI'
            # kontrol mühendisi: onay bekleyenler
            await pg.evaluate("() => { const a = window.__app; a.state.sel = null; a.bus.emit('ui:sel'); a.ps.logout(); a.nav.go('team'); }"); await pg.wait_for_timeout(400)
            await login(pg, 'Kontrol Kişisi', '2222'); await shot(pg, 't09_pending_kontrol')
            await pg.locator('.card.tight.list .li button.grow').nth(0).click(); await pg.locator('.card.tight.list .li button.grow').nth(1).click(); await pg.wait_for_timeout(200)
            await pg.get_by_text('Seçilenleri onayla').click(); await pg.wait_for_timeout(250); await pg.get_by_text('Onayla', exact=True).click(); await pg.wait_for_timeout(900); await shot(pg, 't10_after_approve')
            st = await pg.evaluate("() => { const ps = window.__app.ps; return ps.hakCounts(); }"); print('durumlar:', st); assert st.get('KONTROL') == 2 and st.get('TAMAMLANDI') == 3
            # geri çevir (gerekçe)
            await pg.locator('.card.tight.list .li button.grow').nth(0).click(); await pg.get_by_text('Geri çevir', exact=True).click(); await pg.wait_for_timeout(250)
            await pg.locator('.modal input.inp, input.inp[autofocus]').last.fill('topraklama eksik'); await shot(pg, 't11_reject_reason')
            await pg.get_by_role('dialog').get_by_role('button', name='Geri çevir').click(); await pg.wait_for_timeout(900)
            st = await pg.evaluate("() => window.__app.ps.hakCounts()"); print('ret sonrası:', st); assert st.get('BASLANDI') == 1
            # obje ekranında onay geçmişi
            await pg.evaluate("() => window.__app.nav.go('equipment', { id: window.__ids.poles[0] })"); await pg.wait_for_timeout(500)
            await pg.locator('main.screen').evaluate('(m) => { const el = [...m.querySelectorAll(".lbl")].find((x) => x.textContent.includes("Onay geçmişi")); if (el) el.scrollIntoView({ block: "center" }); }'); await shot(pg, 't12_equipment_history')
            assert await pg.get_by_text('Onay geçmişi').count() >= 1
            # hakediş ekranı: kontrol mühendisi dönem açamaz
            await pg.evaluate("() => window.__app.nav.go('hakedis')"); await pg.wait_for_timeout(400)
            await pg.get_by_text('+ Dönem').click(); await pg.wait_for_timeout(250); await pg.get_by_role('dialog').get_by_role('button', name='Kaydet').click(); await pg.wait_for_timeout(500); await shot(pg, 't13_period_denied')
            n = await pg.evaluate("() => window.__app.ps.data.periods.length"); assert n == 0
        finally:
            print('ERRORS', len(errors)); [print('  ', e) for e in errors[:10]]
            await b.close(); srv.terminate()
    if errors: sys.exit(1)
asyncio.run(main())
