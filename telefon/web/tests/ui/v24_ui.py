# v2.4 arayüz denemesi: direkte armatür, DİĞER listesi, PB köşk + hücresiz kabin, kanal (kaplama + yöntem), elle malzeme,
# ayarlar (alıcı markası yok, NTRIP profilleri, kullanıcılar girişi), proje silme
import asyncio, sys
sys.path.insert(0, '/home/claude/voltapp/web/tests/ui')
from v23_lib import *
SIM = """async () => { const a = window.__app; a.gnss.startSimulator({ profile: 'FIX', base: { lat: 38.6748, lon: 39.2225, alt: 1050 } }); await new Promise((r) => setTimeout(r, 7000)); }"""
async def take(pg): await pg.locator('.dock-take button.take').click(); await pg.wait_for_timeout(2600)
async def main():
    async with async_playwright() as p:
        srv, b, pg, errors = await start(p, port=8817)
        try:
            await pg.evaluate(SETUP)
            assert (await pg.evaluate("() => window.__app.ps.p.autoRecipe")) is False
            await pg.evaluate(SIM)
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(700)
            # --- direk + armatür ---
            await pg.locator('button.what').click(); await pg.wait_for_timeout(300)
            await pg.locator('section.sheet').get_by_text('DİREK', exact=True).first.click(); await pg.wait_for_timeout(200)
            arm = pg.locator('section.sheet select').filter(has=pg.locator('option', has_text='Armatür yok'))
            opts = await arm.locator('option').all_inner_texts(); print('armatur secenek', len(opts), opts[1][:40])
            led = next(o for o in opts if 'LED' in o)
            await arm.select_option(label=led); await pg.wait_for_timeout(200)
            await pg.locator('section.sheet select[aria-label="Armatür adedi"]').select_option('2'); await shot(pg, 'v24_01_pole_armatur')
            await pg.locator('section.sheet').get_by_text('TAMAM', exact=True).click(); await pg.wait_for_timeout(300)
            await take(pg); await shot(pg, 'v24_01b_after_take')
            r = await pg.evaluate("() => { const ps = window.__app.ps; const e = ps.data.equipment[0]; return ps.result.matsByEq.get(e.id).items.map((m) => [m.tag, m.qty]); }"); print('direk kalemleri', r)
            assert sorted(x[0] for x in r) == ['armatur', 'direk'] and [x for x in r if x[0] == 'armatur'][0][1] == 2
            # --- DİĞER listesi ---
            await pg.locator('button.what').click(); await pg.wait_for_timeout(300)
            await pg.locator('section.sheet').get_by_text('DİĞER', exact=True).first.click(); await pg.wait_for_timeout(200); await shot(pg, 'v24_02_other')
            assert await pg.locator('section.sheet').get_by_text('Menhol', exact=True).count() == 0 and await pg.locator('section.sheet').get_by_text('Armatür / lamba', exact=True).count() == 0
            # --- trafo: prefabrik beton köşk, PB tipi ---
            await pg.locator('section.sheet').get_by_text('TRAFO', exact=True).first.click(); await pg.wait_for_timeout(200)
            post = pg.locator('section.sheet select').filter(has=pg.locator('option', has_text='Prefabrik beton köşk')).first
            await post.select_option(label='Prefabrik beton köşk'); await pg.wait_for_timeout(300)
            kt = pg.locator('section.sheet select').filter(has=pg.locator('option', has_text='PB-1'))
            ko = await kt.locator('option').all_inner_texts(); print('kosk tipleri', [o[:5] for o in ko])
            assert [o[:4] for o in ko] == ['PB-1', 'PB-2', 'PB-3', 'PB-4'] and not any('TİP' in o for o in ko)
            await kt.select_option(index=2); await shot(pg, 'v24_03_trafo_pb')
            await pg.locator('section.sheet').get_by_text('TAMAM', exact=True).click(); await pg.wait_for_timeout(300)
            await pg.evaluate("() => { const S = window.__app.gnss.sim; S.pos.lat += 40/111320; }"); await pg.wait_for_timeout(1300)
            await take(pg)
            tr = await pg.evaluate("() => { const ps = window.__app.ps; const e = ps.data.equipment.find((x) => x.kind === 'transformer'); return [e.id, e.pointId, ps.result.matsByEq.get(e.id).items.map((m) => [m.tag, m.name.slice(0, 12)])]; }"); print('trafo', tr[2])
            assert sorted(x[0] for x in tr[2]) == ['kosk', 'trafo'] and any(x[1].startswith('PB-3') for x in tr[2])
            # --- haritadaki trafo kartından kabin ---
            await pg.evaluate(f"() => {{ const a = window.__app; a.state.sel = {{ type: 'point', id: '{tr[1]}' }}; a.bus.emit('ui:sel'); }}"); await pg.wait_for_timeout(400); await shot(pg, 'v24_04_trafo_card')
            await pg.locator('button', has_text='Kabin · hücreler').click(); await pg.wait_for_timeout(600); await shot(pg, 'v24_05_cabin_empty')
            assert await pg.get_by_text('Köşk hücresiz').count() == 1
            assert await pg.get_by_text('Trafo binası (MOD)').count() == 0
            await pg.locator('button.btn.pri', has_text='Ekle').click(); await pg.wait_for_timeout(300)
            await pg.locator('button.btn.pri', has_text='Ekle').click(); await pg.wait_for_timeout(300)
            await pg.locator('main.screen').evaluate('(m) => m.scrollBy(0, 500)'); await shot(pg, 'v24_06_cabin_cells')
            await pg.get_by_text('KABİNİ KAYDET').click(); await pg.wait_for_timeout(900)
            it = await pg.evaluate(f"() => window.__app.ps.result.matsByEq.get('{tr[0]}').items.map((m) => [m.tag, m.qty])"); print('kabinli', it)
            assert sum(x[1] for x in it if x[0] == 'hucre') == 2 and not any(x[0] in ('pano', 'top', 'kanal') for x in it)
            # --- yeraltı hat: kaplama + yöntem ---
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(500)
            await pg.evaluate("() => { const a = window.__app; a.state.sel = null; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(300)
            await pg.locator('button[aria-label="Hat"]').click(); await pg.wait_for_timeout(300)
            await pg.locator('section.sheet').get_by_text('OG', exact=True).first.click()
            await pg.locator('section.sheet').get_by_text('Yeraltı', exact=True).click(); await pg.wait_for_timeout(300)
            txt = await pg.locator('section.sheet').inner_text()
            assert 'Aynı kanalda AG kablosu da var' in txt and 'Aynı direklerde' not in txt and 'Direk inişi' not in txt and 'Duvar' not in txt, txt[:600]
            for w in ['Toprak', 'Tüvenan', 'Asfalt', 'Beton', 'Parke taşı', 'Açık kazı', 'Borulu geçiş', 'Yatay sondaj']: assert w in txt, w
            await pg.locator('section.sheet').get_by_text('Asfalt', exact=True).click(); await pg.locator('section.sheet').get_by_text('Borulu geçiş', exact=True).click(); await pg.wait_for_timeout(200)
            await pg.locator('section.sheet input[placeholder="zorunlu"]').fill('0.8'); await pg.locator('section.sheet input[placeholder="zorunlu"]').blur(); await pg.wait_for_timeout(200)
            await pg.locator('section.sheet').evaluate('(m) => m.querySelector(".body").scrollBy(0, 400)'); await shot(pg, 'v24_07_line_sheet')
            await pg.get_by_text('HAT BAŞLAT').click(); await pg.wait_for_timeout(600)
            lid = await pg.evaluate("async () => { const ps = window.__app.ps; const l = ps.data.lines[0]; const e = ps.data.equipment; await ps.appendNode(l.id, e[0].pointId); await ps.appendNode(l.id, e[1].pointId); return l.id; }")
            li = await pg.evaluate(f"() => {{ const li = window.__app.ps.result.lineInfo.get('{lid}'); return [li.length2D, li.items.map((x) => [x.kanal ? 'kanal' : x.material || 'kablo', x.servis, Math.round(x.qty * 100) / 100, x.unit]), window.__app.ps.lineById('{lid}').cable]; }}"); print('hat', li)
            assert li[2]['surface'] == 'asfalt' and li[2]['method'] == 'borulu' and li[2]['pipeCount'] >= 1
            assert any(x[0] == 'kanal' and x[1] == 'YEREL:KANAL-ASFALT' and abs(x[2] - round(li[0] * 0.4 * 0.8, 2)) < 0.02 for x in li[1]) and any(x[0] == 'BORU_110' for x in li[1]) and not any(x[0] in ('KUM', 'UYARI_BANDI') for x in li[1])
            # --- hat kaydı: kanal özeti + malzeme ekle ---
            await pg.evaluate(f"() => {{ window.__app.state.activeLineId = null; window.__app.nav.go('line', {{ id: '{lid}' }}); }}"); await pg.wait_for_timeout(500)
            await pg.locator('main.screen').evaluate('(m) => { const el = [...m.querySelectorAll(".sect")].find((x) => x.textContent.trim() === "Kanal"); el.scrollIntoView({ block: "start" }); }'); await shot(pg, 'v24_08_line_kanal')
            assert await pg.get_by_text('Kazı hacmi').count() == 1
            await pg.locator('button', has_text='Malzeme ekle').click(); await pg.wait_for_timeout(300)
            await pg.locator('input[placeholder^="ad ya da poz no"]').fill('kazığı'); await pg.wait_for_timeout(300)
            await pg.locator('button.btn.sm', has_text='Ekle').first.click(); await pg.wait_for_timeout(300)
            await pg.get_by_role('dialog').locator('input').fill('4'); await pg.get_by_role('dialog').get_by_role('button', name='Kaydet').click(); await pg.wait_for_timeout(900)
            await pg.locator('main.screen').evaluate('(m) => { const el = [...m.querySelectorAll(".sect")].find((x) => x.textContent.startsWith("Malzemeler")); el.scrollIntoView({ block: "start" }); }'); await shot(pg, 'v24_09_line_materials')
            man = await pg.evaluate(f"() => window.__app.ps.result.lineInfo.get('{lid}').items.filter((x) => x.manual).map((x) => [x.servis, x.qty])"); print('elle', man)
            assert len(man) == 1 and man[0][1] == 4
            # --- ayarlar ---
            await pg.get_by_text('Ayarlar', exact=True).first.click(); await pg.wait_for_timeout(500)
            body = await pg.locator('main.screen').text_content()
            assert 'Alıcı markası' not in body and 'Spectra' not in body, 'alıcı markası kaldırılmalı'
            assert 'Kullanıcılar ve hakediş onayı' in body and 'Kayıtlı profiller' in body
            await pg.locator('main.screen').evaluate('(m) => { const el = [...m.querySelectorAll(".sect")].find((x) => x.textContent.startsWith("NTRIP")); el.scrollIntoView({ block: "start" }); }')
            await pg.get_by_text('+ Profil ekle').click(); await pg.wait_for_timeout(300)
            await pg.get_by_role('dialog').locator('input').fill('Sabit istasyon'); await pg.get_by_role('dialog').get_by_role('button', name='Kaydet').click(); await pg.wait_for_timeout(500)
            await pg.locator('input[placeholder="[SUNUCU IP / ad]"]').fill('10.0.0.5'); await pg.locator('input[placeholder="[SUNUCU IP / ad]"]').blur(); await pg.wait_for_timeout(300); await shot(pg, 'v24_10_ntrip_profiles')
            await pg.locator('.chips .chip', has_text='TUSAGA-Aktif').click(); await pg.wait_for_timeout(400)
            assert (await pg.locator('input[placeholder="[SUNUCU IP / ad]"]').input_value()) == ''
            await pg.locator('.chips .chip', has_text='Sabit istasyon').click(); await pg.wait_for_timeout(400)
            assert (await pg.locator('input[placeholder="[SUNUCU IP / ad]"]').input_value()) == '10.0.0.5'
            np = await pg.evaluate("async () => { const v = await window.__app.ds.setting('ntripProfiles'); return v.list.map((p) => [p.name, p.host]); }"); print('profiller', np)
            await pg.locator('main.screen').evaluate('(m) => m.scrollTo(0, 0)')
            await pg.locator('main.screen').evaluate('(m) => { const el = [...m.querySelectorAll(".sect")].find((x) => x.textContent.startsWith("Kullanıcılar")); el.scrollIntoView({ block: "center" }); }'); await shot(pg, 'v24_11_settings_team')
            # --- proje silme ---
            await pg.evaluate("() => window.__app.nav.go('projects')"); await pg.wait_for_timeout(500); await shot(pg, 'v24_12_projects')
            await pg.locator('button[aria-label^="Projeyi sil"]').click(); await pg.wait_for_timeout(300)
            await pg.get_by_role('dialog').locator('input').fill('yanlış ad'); await pg.get_by_role('dialog').get_by_role('button', name='Kalıcı olarak sil').click(); await pg.wait_for_timeout(500)
            assert (await pg.evaluate("async () => (await window.__app.ps.listProjects()).length")) == 1, 'yanlış adla silinmemeli'
            await pg.locator('button[aria-label^="Projeyi sil"]').click(); await pg.wait_for_timeout(300)
            await pg.get_by_role('dialog').locator('input').fill('OG-03 Hat Yenileme · Kurtdere'); await shot(pg, 'v24_13_delete_confirm')
            await pg.get_by_role('dialog').get_by_role('button', name='Kalıcı olarak sil').click(); await pg.wait_for_timeout(900); await shot(pg, 'v24_14_after_delete')
            left = await pg.evaluate("async () => [(await window.__app.ps.listProjects()).length, window.__app.ps.p, (await window.__app.ds.db.getAll('equipment')).length]"); print('silme sonrası', left)
            assert left == [0, None, 0]
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(400)
        finally:
            print('ERRORS', len(errors)); [print('  ', e) for e in errors[:10]]
            await b.close(); srv.terminate()
    if errors: sys.exit(1)
asyncio.run(main())
