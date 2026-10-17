# Web (ofis) sürümü arayüz testi: sahte bulut (window.claude) ile masaüstü + telefon genişliği.
# Akış: boş açılış → proje → Excel toplu aktarım → harita (seçim, hakediş, haritadan obje) → dışa aktarım (tek zip)
#        → telefona dosya → sayfayı yeniden aç (veri buluttan gelir) → ikinci "bilgisayar" (ayrı tarayıcı bağlamı değil, aynı depo)
import asyncio, json, sys, os, subprocess, time
from playwright.async_api import async_playwright
WWW = '/home/claude/voltapp/web/dist/web'
OUT = '/home/claude/voltapp/web/tests/ui/shots'
os.makedirs(OUT, exist_ok=True)
errors = []
MOCK = r"""
(() => {
  const KEY = '__fakecloud';
  let docs = {}; try { docs = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const subs = {};
  const snap = (p) => ({ id: p.split('/').pop(), exists: p in docs, data: () => (p in docs ? JSON.parse(JSON.stringify(docs[p])) : undefined), metadata: {} });
  const save = () => localStorage.setItem(KEY, JSON.stringify(docs));
  const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v; return a; };
  const fire = (p) => (subs[p] || []).forEach((f) => setTimeout(() => f(snap(p)), 0));
  const chk = (d) => { if (new TextEncoder().encode(JSON.stringify(d)).length > 262144) throw { code: 'invalid_argument', message: 'belge büyük' }; };
  window.__cloud = { writes: 0, docs: () => docs };
  const db = { doc(p) { return {
    get: async () => snap(p),
    set: async (d) => { chk(d); docs[p] = JSON.parse(JSON.stringify(d)); save(); window.__cloud.writes++; fire(p); },
    update: async (d) => { if (!(p in docs)) throw { code: 'invalid_argument', message: 'yok' }; const m = merge(JSON.parse(JSON.stringify(docs[p])), d); chk(m); docs[p] = m; save(); window.__cloud.writes++; fire(p); },
    delete: async () => { delete docs[p]; save(); window.__cloud.writes++; },
    onSnapshot: (next) => { (subs[p] = subs[p] || []).push(next); setTimeout(() => next(snap(p)), 0); return () => {}; }
  }; } };
  window.__saved = [];
  const OKEXT = new Set('gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv ttf html svg pdf xlsx zip'.split(' '));
  const downloads = { save: async ({ filename, data }) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (!OKEXT.has(ext)) throw { code: 'rejected_extension', message: ext };
    const u8 = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
    window.__saved.push({ filename, size: u8.length, head: Array.from(u8.slice(0, 4)) });
    return { status: 'saved' };
  } };
  window.claude = { use: (n) => new Promise((r) => setTimeout(() => r(n === 'db' ? db : n === 'downloads' ? downloads : null), 40)) };
})();
"""
async def shot(pg, name):
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{OUT}/{name}.png', full_page=False)
async def tap(pg, text, exact=False, nth=0):
    loc = pg.get_by_text(text, exact=exact).nth(nth)
    await loc.scroll_into_view_if_needed(); await loc.click(); await pg.wait_for_timeout(250)
async def flushed(pg):
    await pg.wait_for_function("() => window.__app.cloud && window.__app.cloud.status.state === 'saved' && !window.__app.cloud.dirty.size", timeout=30000)
async def main():
    port = 8791
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '-d', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
            await ctx.add_init_script(MOCK)
            pg = await ctx.new_page()
            pg.on('console', lambda m: errors.append(('console', m.type, m.text)) if m.type in ('error',) else None)
            pg.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
            # Yayınlanan sayfada dış sunucular engelli: aynısını burada da uygula
            async def guard(route):
                u = route.request.url
                if u.startswith(f'http://127.0.0.1:{port}/'): await route.continue_()
                else: errors.append(('dis-istek', u)); await route.abort()
            await pg.route('**/*', guard)
            await pg.goto(f'http://127.0.0.1:{port}/index.html')
            await pg.wait_for_function('window.__voltReady === true', timeout=60000)
            assert await pg.evaluate("() => !!window.__app.web && !!window.__app.cloud"), 'web + bulut modu'
            await shot(pg, 'w00_projects_empty')
            # --- proje ---
            await tap(pg, 'Yeni proje')
            await pg.get_by_placeholder('ör. OG-03 Hat Yenileme').fill('OG-03 Hat Yenileme · Kurtdere')
            await pg.locator('input.inp.mono').first.fill('ELZ-2026-OG03')
            await tap(pg, 'PROJE OLUŞTUR'); await pg.wait_for_timeout(800)
            await shot(pg, 'w01_hub')
            # --- Excel toplu aktarım (ofisin ana işi) ---
            await pg.locator('nav.tabbar button', has_text='Excel aktarım').click(); await pg.wait_for_timeout(500)
            await pg.get_by_text('EXCEL ŞABLONLARINI İNDİR').click(); await pg.wait_for_timeout(1200)
            await pg.locator('input[type=file]').set_input_files('/home/claude/voltapp/web/tests/out/excel_124_kayit.xlsx'); await pg.wait_for_timeout(1500)
            await shot(pg, 'w02_excel_preview')
            await pg.locator('button.btn.pri.huge').click(); await pg.wait_for_timeout(300)
            await pg.locator('.modal').get_by_text('İçe aktar', exact=True).click(); await pg.wait_for_timeout(9000)
            n1 = await pg.evaluate("() => window.__app.ps.data.equipment.length")
            print('excel aktarim ->', n1, 'ekipman'); assert n1 >= 110, n1
            await pg.wait_for_timeout(800); await shot(pg, 'w03_map_after_excel')
            # --- harita: obje seç, hakediş durumunu değiştir ---
            eq = await pg.evaluate("() => { const a = window.__app, e = a.ps.data.equipment.find((x) => x.kind === 'pole'); a.state.sel = { type: 'point', id: e.pointId }; a.bus.emit('ui:sel'); const p = a.ps.pointById(e.pointId); a.state.mapEngine.center(p.E, p.N, 0.5); return e.id; }")
            await pg.wait_for_timeout(600); await shot(pg, 'w04_map_selection')
            await pg.locator('.hakrow button', has_text='KONTROL').first.click(); await pg.wait_for_timeout(600)
            hk = await pg.evaluate(f"() => window.__app.ps.eqById('{eq}').hak"); print('hakedis ->', hk); assert hk == 'KONTROL', hk
            await pg.evaluate("() => { const a = window.__app; a.state.sel = null; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(400)
            # --- haritadan obje ekle (web varsayılan kaynağı: haritadan seç) ---
            src = await pg.locator('button.srcbtn b').inner_text(); print('kaynak:', src); assert src == 'HARİTA', src
            await pg.locator('button.srcbtn').click(); await pg.wait_for_timeout(300); await shot(pg, 'w05_source_sheet')
            assert await pg.locator('section.sheet button.srcopt').count() == 3, 'web kaynak seçenekleri: manuel, harita, excel'
            await pg.locator('section.sheet button.srcopt', has_text='Haritadan seç').click(); await pg.wait_for_timeout(300)
            await pg.locator('button.what').click(); await pg.wait_for_timeout(300); await shot(pg, 'w06_picker')
            await tap(pg, 'TAMAM', exact=True)
            n2 = await pg.evaluate("() => window.__app.ps.data.equipment.length")
            await pg.mouse.move(600, 420); await pg.mouse.down(); await pg.mouse.move(520, 380, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
            await pg.locator('.dock-take button.take').click(); await pg.wait_for_timeout(1500)
            n3 = await pg.evaluate("() => window.__app.ps.data.equipment.length"); print('haritadan ->', n2, n3); assert n3 == n2 + 1
            await shot(pg, 'w07_map_after_pick')
            # --- menüdeki diğer ekranlar ---
            for key, name in [('Saha objeleri', 'w08_objects'), ('Hesaplar', 'w09_calc'), ('Proje', 'w10_hub'), ('Ayarlar', 'w11_settings'), ('Telefonla veri', 'w12_sync')]:
                await pg.locator('nav.tabbar button', has_text=key).click(); await pg.wait_for_timeout(700); await shot(pg, name)
            # --- telefona dosya ---
            await pg.get_by_text('Telefon için dosya indir').click(); await pg.wait_for_timeout(1500)
            await pg.locator('.modal').get_by_text('Gönderildi', exact=True).click(); await pg.wait_for_timeout(500)
            # --- dışa aktarım: birden çok format → tek zip ---
            await pg.locator('nav.tabbar button', has_text='Dışa aktar').click(); await pg.wait_for_timeout(600); await shot(pg, 'w13_export')
            await pg.locator('button.btn.pri.huge').click(); await pg.wait_for_timeout(400)
            if await pg.locator('.modal').count(): await pg.locator('.modal').get_by_text('Üret', exact=True).click()
            await pg.wait_for_function("() => window.__saved.some((f) => /_cikti_/.test(f.filename))", timeout=90000)
            saved = await pg.evaluate("() => window.__saved"); print('indirilenler:', [(f['filename'], f['size']) for f in saved])
            assert any(f['filename'].endswith('.vsync.json') for f in saved), 'telefon dosyası .vsync.json'
            assert any(f['filename'].endswith('.xlsx') for f in saved), 'şablon xlsx'
            z = [f for f in saved if '_cikti_' in f['filename']][0]; assert z['head'][:2] == [80, 75], 'zip imzası'
            # --- buluta yazıldı mı, yeniden açılışta geliyor mu ---
            await flushed(pg)
            info = await pg.evaluate("() => { const d = window.__cloud.docs(); const k = Object.keys(d); return { n: k.length, max: Math.max(...k.map((x) => JSON.stringify(d[x]).length)), total: k.reduce((s, x) => s + JSON.stringify(d[x]).length, 0), writes: window.__cloud.writes, keys: k.filter((x) => !/audit|outbox/.test(x)) }; }")
            print('bulut:', info['n'], 'belge · en büyük', info['max'], 'bayt · toplam', info['total'], '·', info['writes'], 'yazma'); print('  ', info['keys'])
            assert info['max'] < 262144
            sig = await pg.evaluate("() => window.__app.ps.result.signature")
            await pg.reload(); await pg.wait_for_function('window.__voltReady === true', timeout=60000); await pg.wait_for_timeout(1200)
            st = await pg.evaluate("() => { const a = window.__app; return { p: a.ps.p && a.ps.p.name, eq: a.ps.data.equipment.length, sig: a.ps.result.signature, dev: a.ds.deviceId, std: a.ps.cat.std.id }; }")
            print('yeniden açılış:', st); assert st['eq'] == n3 and st['sig'] == sig, (st, n3, sig)
            assert await pg.evaluate(f"() => window.__app.ps.eqById('{eq}').hak") == 'KONTROL'
            await shot(pg, 'w14_reload_map')
            w0 = await pg.evaluate("() => window.__cloud.writes"); await pg.wait_for_timeout(5000)
            w1 = await pg.evaluate("() => window.__cloud.writes"); print('açılış sonrası boşta yazma:', w1 - w0); assert w1 - w0 <= 2, (w0, w1)
            # --- telefon genişliği ---
            await pg.set_viewport_size({'width': 400, 'height': 800}); await pg.wait_for_timeout(700); await shot(pg, 'w20_phone_map')
            ov = await pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"); assert ov <= 0, ('yatay taşma', ov)
            await pg.locator('nav.tabbar button', has_text='Saha objeleri').click(); await pg.wait_for_timeout(600); await shot(pg, 'w21_phone_objects')
            await b.close()
    finally:
        srv.terminate()
        print('ERRORS', len(errors))
        for e in errors[:20]: print('  ', e)
asyncio.run(main())
if errors: sys.exit(1)
