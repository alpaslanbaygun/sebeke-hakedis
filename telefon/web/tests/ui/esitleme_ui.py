# Arayüz denemesi: eklentiyle eşitleme (31.10.2026) — haritanın çizim görünümü (hat renkleri, metraj, hat etiketi,
# kanal kenarları), Katmanlar ve Lejant, Ayarlar › Harita altlığı (ArcGIS / Azure / Bing anahtarları), Dışa Aktarım ›
# Google Earth KMZ ve CBS MapInfo (MIF / MID). Derlenmiş uygulamada (dist/www), yerel köprü taklidiyle.
# Kullanım: python3 esitleme_ui.py <dist/www klasörü> <ekran görüntüsü klasörü>   (çıkış kodu 0: geçti)
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

WWW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'www')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
PORT = 8832

MOCK = r"""
(() => {
  const ev = (e, o) => setTimeout(() => window.__voltNative && window.__voltNative(e, JSON.stringify(o)), 5);
  const reply = (id, r, err) => ev('reply', err ? { reqId: id, error: err } : { reqId: id, result: r });
  let files = {};
  window.__mock = { calls: [], saved: [] };
  const M = {};
  const rec = (m) => (id, j) => { window.__mock.calls.push([m, JSON.parse(j)]); return M[m](id, JSON.parse(j)); };
  M.appInfo = (id) => reply(id, { platform: 'android', version: '2.5.x', sdk: 34, model: 'Deneme' });
  M.btBonded = (id) => reply(id, []); M.bleScan = (id) => reply(id, []);
  M.gnssConnect = (id) => reply(id, true); M.gnssDisconnect = (id) => reply(id, true); M.gnssWrite = (id) => reply(id, true);
  M.ntripDisconnect = (id) => reply(id, true); M.phoneStart = (id) => reply(id, true); M.phoneStop = (id) => reply(id, true);
  M.fileBegin = (id, a) => { const k = 'f' + Math.random(); files[k] = { name: a.name, n: 0 }; reply(id, k); };
  M.fileChunk = (id, a) => { files[a.id].n += atob(a.b64).length; reply(id, 1); };
  M.fileEnd = (id, a) => { window.__mock.saved.push(files[a.id]); reply(id, { uri: 'İndirilenler/Sebeke-M/' + files[a.id].name }); };
  M.printHtml = (id) => reply(id, true); M.keepScreenOn = (id) => reply(id, true); M.vibrate = (id) => reply(id, true);
  M.openSettings = (id) => reply(id, true);
  window.VoltNative = {}; for (const k of Object.keys(M)) window.VoltNative[k] = rec(k);
})();
"""

# Deneme projesi: AG havai (iki direk + elemansız kırılma köşesi), OG havai mevcut, abone, müşterek, AG kablo (kanal
# 0,6 m), OG kablo (yatay sondaj), yalnız kanal, demontaj hattı — hepsi uydurma koordinat (TM39 dilimi)
KUR = """async () => { const a = window.__app, ps = a.ps;
  const p = await ps.createProject({ name: 'Deneme · Eşitleme', code: 'DNM-ES', cm: 39, enhZone: 'III', mode: 'asbuilt' });
  await ps.open(p.id);
  const E0 = 519300, N0 = 4282100;
  const dir = async (dx, dy, grup, tip, durum) => ps.addEquipment('pole', { group: grup, typeId: ps.cat.poleTypeByName(grup, tip).id, state: durum || 'YENI' }, { coord: { E: E0 + dx, N: N0 + dy, H: 1050 } });
  const nok = async (dx, dy, no) => ps.createPoint({ pointNo: no, cls: 'HAT', critical: false, coord: { E: E0 + dx, N: N0 + dy, H: 1050 }, source: 'MANUAL' });
  const ag = ps.cat.lineDefault('AG', 'havai'), og = ps.cat.lineDefault('OG', 'havai'), kab = ps.cat.lineDefault('AG', 'yeralti'), ogk = ps.cat.lineDefault('OG', 'yeralti'), ab = ps.cat.lineDefault('ABONE', 'havai');
  const a1 = await dir(0, 0, 'sehir', 'G-K2'), a2 = await dir(40, 0, 'sehir', 'G-K2'), k1 = await nok(70, 12, 'K1'), a3 = await dir(100, 12, 'sehir', 'G-K2');
  await ps.createLine({ lineType: 'AG', install: 'havai', circuits: [{ role: 'AG', key: ag, count: 1 }], nodes: [a1.pointId, a2.pointId, k1.id, a3.pointId], state: 'YENI' });
  const o1 = await dir(0, 40, 'beton', '9.3/8', 'MEVCUT'), o2 = await dir(60, 40, 'beton', '9.3/8', 'MEVCUT');
  await ps.createLine({ lineType: 'OG', install: 'havai', circuits: [{ role: 'OG', key: og, count: 1 }], nodes: [o1.pointId, o2.pointId], state: 'MEVCUT' });
  const m1 = await dir(0, 80, 'sehir', 'G-K2'), m2 = await dir(60, 80, 'sehir', 'G-K2');
  await ps.createLine({ lineType: 'OG', install: 'havai', musterek: true, circuits: [{ role: 'OG', key: og, count: 1 }, { role: 'AG', key: ag, count: 1 }], nodes: [m1.pointId, m2.pointId], state: 'YENI' });
  const s1 = await ps.addEquipment('sdk', { state: 'YENI', attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { coord: { E: E0 + 75, N: N0 + 95, H: 1050 } });
  await ps.createLine({ lineType: 'ABONE', install: 'havai', circuits: [{ role: 'ABONE', key: ab, count: 1 }], nodes: [m2.pointId, s1.pointId], state: 'YENI' });
  const s2 = await ps.addEquipment('sdk', { state: 'YENI', attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { coord: { E: E0, N: N0 - 30, H: 1050 } });
  const s3 = await ps.addEquipment('sdk', { state: 'YENI', attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { coord: { E: E0 + 90, N: N0 - 50, H: 1050 } });
  const k2 = await nok(45, -30, 'K2');
  await ps.createLine({ lineType: 'AG', install: 'yeralti', circuits: [{ role: 'AG', key: kab, count: 1 }], nodes: [s2.pointId, k2.id, s3.pointId], state: 'YENI', cable: { surface: 'asfalt', method: 'acik', width: 0.6, depth: 0.8 } });
  const t1 = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'bina', kva: 400 } }, { coord: { E: E0, N: N0 - 75, H: 1050 } });
  const s4 = await ps.addEquipment('sdk', { state: 'YENI', attrs: { sdkTypeId: ps.cat.sdkTypes()[0].id } }, { coord: { E: E0 + 70, N: N0 - 75, H: 1050 } });
  await ps.createLine({ lineType: 'OG', install: 'yeralti', circuits: [{ role: 'OG', key: ogk, count: 1 }], nodes: [t1.pointId, s4.pointId], state: 'YENI', cable: { surface: 'toprak', method: 'sondaj', width: 0, pipeDia: 110, pipeCount: 1 } });
  const c1 = await nok(110, -30, 'C1'), c2 = await nok(150, -10, 'C2');
  await ps.createLine({ lineType: 'AG', install: 'yeralti', channelOnly: true, circuits: [], nodes: [c1.id, c2.id], state: 'YENI', cable: { surface: 'toprak', method: 'acik', width: 0.5, depth: 0.8 } });
  const d1 = await dir(110, 40, 'sehir', 'G-K2', 'DEMONTAJ'), d2 = await dir(150, 40, 'sehir', 'G-K2', 'DEMONTAJ');
  await ps.createLine({ lineType: 'AG', install: 'havai', circuits: [{ role: 'AG', key: ag, count: 1 }], nodes: [d1.pointId, d2.pointId], state: 'DEMONTAJ' });
  await ps.recompute('deneme');
  a.state.follow = false; a.state.layers = Object.assign({}, a.state.layers || {}, { hak: false });
  return ps.data.lines.length; }"""

sonuc = []
def kontrol(ok, ne):
    sonuc.append((ok, ne)); print(('GEÇTİ  ' if ok else 'HATA   ') + ne, flush=True)

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
            await ctx.add_init_script(MOCK)
            pg = await ctx.new_page()
            errors = []
            pg.on('console', lambda m: errors.append(('console', m.text)) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
            async def guard(route):
                if route.request.url.startswith(f'http://127.0.0.1:{PORT}/'): await route.continue_()
                else: await route.abort()
            await pg.route('**/*', guard)
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html')
            await pg.wait_for_function('window.__voltReady === true', timeout=60000)
            n = await pg.evaluate(KUR)
            kontrol(n == 8, 'deneme projesi: %s hat' % n)

            # Harita: genel görünüm ve kanal kenarları (yakın)
            async def harita(ad, cE, cN, res):
                await pg.evaluate("([e, n, r]) => { const a = window.__app; a.state.follow = false; a.state.view = { cE: e, cN: n, res: r }; a.nav.tab('stake'); }", [cE, cN, res])
                await pg.wait_for_timeout(400)
                await pg.evaluate("() => window.__app.nav.tab('map')")
                await pg.wait_for_timeout(1200)
                await pg.screenshot(path=f'{OUT}/esitleme_{ad}.png')
                # Haritanın ortasındaki piksel renkleri (çizim tuvali)
                return await pg.evaluate("""() => { const c = document.querySelector('canvas'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data;
                  const say = {}; for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; say[k] = (say[k] || 0) + 1; } return say; }""")
            renk = await harita('01_harita', 519360, 4282110, 0.35)
            def var(rgb, en_az=20): return renk.get(rgb, 0) >= en_az
            kontrol(var('126,224,138'), 'AG havai yeşil (#7ee08a)')
            kontrol(var('192,132,252'), 'müşterek mor (#c084fc)')
            kontrol(var('251,146,60'), 'abone turuncu (#fb923c)')
            kontrol(var('96,165,250', 10), 'AG kablo mavi (#60a5fa)')
            kontrol(var('255,255,0'), 'demontaj sarı')
            kontrol(var('156,163,175', 10), 'kanal gri (#9ca3af)')
            kontrol(var('251,191,36', 5), 'sondaj sarı-turuncu (#fbbf24)')
            await harita('02_kanal_yakin', 519320, 4282070, 0.04)
            # Katmanlar penceresi
            await pg.get_by_role('button', name='Katmanlar').click(); await pg.wait_for_timeout(400)
            pop = pg.locator('.card', has_text='Kanal kenarı ve sondaj').first
            await pop.screenshot(path=f'{OUT}/esitleme_03_katmanlar.png')
            kontrol(await pop.count() == 1, 'Katmanlar: "Kanal kenarı ve sondaj" satırı')
            await pg.get_by_role('button', name='Lejant ve katman ayrıntıları').click(); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'{OUT}/esitleme_04_lejant.png')
            await pg.locator('.sect', has_text='Şebeke hatları').locator('xpath=following-sibling::div[1]').screenshot(path=f'{OUT}/esitleme_04b_lejant_hatlar.png')
            lej = await pg.locator('body').inner_text()
            kontrol(all(x in lej for x in ['Müşterek hat', 'O.G. yeraltı kablosu', 'Kablo kanalı (iki kenarlı)', 'Yatay sondaj', 'Demontaj hattı']), 'lejant: ortak stilin hat türleri')

            # Hat kaydı: iletken listesinde AutoCAD'deki tipler de var (telefonda karşılığı olmayan 4P+R vb.); seçilip kaydedilir
            lid = await pg.evaluate("() => { const ps = window.__app.ps; const l = ps.data.lines.find((x) => x.lineType === 'AG' && x.install === 'havai' && x.state === 'YENI' && !x.musterek); window.__app.nav.go('line', { id: l.id }); return l.id; }")
            await pg.wait_for_timeout(900)
            # Devre kartında ilk seçim adet (1×…4×), ikincisi iletken / kablo tipi
            sec = pg.locator('.sect', has_text='İletken / kablo devreleri').locator('xpath=following-sibling::div[1]').locator('select.mono').nth(1)
            gruplar = await sec.evaluate("(s) => [...s.querySelectorAll('optgroup')].map((g) => [g.label, g.children.length])")
            kontrol(len(gruplar) == 2 and gruplar[1][0] == "AutoCAD'deki tipler" and gruplar[1][1] > 5, 'hat kaydı: iletken listesi telefondaki ve AutoCAD\'deki tipler: ' + json.dumps(gruplar, ensure_ascii=False))
            await sec.select_option('@AG_İLETKEN|4P+R'); await pg.wait_for_timeout(400)
            not_ = await pg.locator('.sect', has_text='İletken / kablo devreleri').locator('xpath=following-sibling::div[1]').locator('.note').first.inner_text()
            kontrol("AutoCAD'deki tip" in not_ and 'Pansy' in not_, 'seçili AutoCAD tipinin notu (tel açılımı): ' + not_)
            await sec.scroll_into_view_if_needed(); await pg.screenshot(path=f'{OUT}/esitleme_04c_hat_autocad_tipi.png')
            await pg.get_by_role('button', name='KAYDET', exact=False).click(); await pg.wait_for_timeout(700)
            yeni = await pg.evaluate("(id) => { const ps = window.__app.ps; const l = ps.lineById(id); const li = ps.result.lineInfo.get(id); return [l.circuits[0].key, (li.items || []).filter((x) => x.unit === 'Kg').length]; }", lid)
            kontrol(yeni[0] == '@AG_İLETKEN|4P+R' and yeni[1] == 2, 'kaydedildi; metraj tel tel (kg): ' + json.dumps(yeni, ensure_ascii=False))
            await pg.evaluate("() => window.__app.nav.back()"); await pg.wait_for_timeout(400)

            # Ayarlar › Harita altlığı: yeni anahtar kutuları
            await pg.evaluate("() => window.__app.nav.tab('settings')"); await pg.wait_for_timeout(700)
            alt = pg.locator('.sect', has_text='Harita altlığı').locator('xpath=following-sibling::div[1]')
            await alt.locator('.fld', has_text='ArcGIS anahtarı').scroll_into_view_if_needed(); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{OUT}/esitleme_05_altlik.png')
            metin = await alt.inner_text()
            kontrol(all(x in metin for x in ['Esri uydu (ArcGIS anahtarı)', 'Bing uydu', 'Azure Maps uydu', 'ArcGIS anahtarı', 'Azure Maps anahtarı', 'Bing Maps kurumsal anahtarı']), 'altlık: Esri ArcGIS, Bing, Azure ve anahtar kutuları')
            await alt.locator('.fld', has_text='Azure Maps anahtarı').locator('input').fill('deneme-anahtar')
            await alt.locator('.fld', has_text='Azure Maps anahtarı').locator('input').press('Tab'); await pg.wait_for_timeout(300)
            kontrol(await pg.evaluate("() => (window.__app.state.mapKeys || {}).azure") == 'deneme-anahtar', 'Azure anahtarı kaydedildi (yalnız cihazda)')

            # Dışa Aktarım: Google Earth KMZ + CBS MapInfo
            await pg.evaluate("() => { window.__app.state.expSel = { kmz: true, mif: true }; window.__app.nav.tab('export'); }"); await pg.wait_for_timeout(800)
            await pg.locator('.card', has_text='CBS MapInfo (MIF / MID)').first.screenshot(path=f'{OUT}/esitleme_06_disa_aktar.png')
            await pg.get_by_role('button', name='DIŞA AKTAR · 2').click(); await pg.wait_for_timeout(700)
            # Kontrol listesinde hata varsa uygulama önce sorar ("Yine de üretilsin mi?")
            if await pg.locator('.modal').get_by_role('button', name='Üret').count(): await pg.locator('.modal').get_by_role('button', name='Üret').click()
            for _ in range(30):
                if await pg.evaluate("() => window.__mock.saved.length") >= 2: break
                await pg.wait_for_timeout(300)
            saved = await pg.evaluate("() => window.__mock.saved.map((f) => [f.name, f.n])")
            kontrol(len(saved) == 2 and saved[0][0].endswith('.kmz') and saved[1][0].endswith('_cbs_mif.zip') and all(x[1] > 500 for x in saved), 'dışa aktarım: ' + json.dumps(saved, ensure_ascii=False))
            kontrol(not errors, 'sayfa hatası yok' + ('' if not errors else ': ' + json.dumps(errors[:5], ensure_ascii=False)))
            await b.close()
    finally:
        srv.terminate()
    hata = [n for ok, n in sonuc if not ok]
    print('SONUÇ: ' + ('hepsi geçti (%d)' % len(sonuc) if not hata else '%d hata' % len(hata)))
    sys.exit(0 if not hata else 1)

asyncio.run(main())
