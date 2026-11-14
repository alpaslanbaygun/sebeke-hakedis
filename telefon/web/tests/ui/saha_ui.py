# Arayüz denemesi: saha istekleri (14.11.2026) — ölçülürken TAMAM (beklemeden bitir), haritadan nokta listesi, mevcut
# direklere dokunarak hat çizme (şerit: son direği çıkar, BİTİR), direğe dokununca malzeme ekleme, direk silme (etkisi
# gösterilir; hat tek direğe düşerse hat da silinir). Derlenmiş uygulamada (dist/www), yerel köprü taklidiyle; uydurma
# koordinatlar.
# Kullanım: python3 saha_ui.py <dist/www klasörü> <ekran görüntüsü klasörü>   (çıkış kodu 0: geçti)
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

WWW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'www')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
PORT = 8834

MOCK = r"""
(() => {
  const ev = (e, o) => setTimeout(() => window.__voltNative && window.__voltNative(e, JSON.stringify(o)), 5);
  const reply = (id, r) => ev('reply', { reqId: id, result: r });
  const sonuc = { appInfo: { platform: 'android', version: '2.5.x', sdk: 34, model: 'Deneme' }, sistemTemasi: { acik: false }, btBonded: [], bleScan: [] };
  window.VoltNative = new Proxy({}, { get: (t, m) => (id) => reply(id, Object.prototype.hasOwnProperty.call(sonuc, m) ? sonuc[m] : true) });
})();
"""

# Dört yeni direk (D1–D4) ve bir mevcut direk (M1), hat yok; simülatörün konumu yakında
KUR = """async () => { const a = window.__app, ps = a.ps;
  const p = await ps.createProject({ name: 'Deneme · Saha', code: 'DNM-SH', cm: 39, enhZone: 'III', mode: 'asbuilt' });
  await ps.open(p.id);
  const lat0 = 38.6743, lon0 = 39.2232, kl = 111320 * Math.cos(lat0 * Math.PI / 180);
  const dir = async (dx, dy, durum) => ps.addEquipment('pole', { group: 'sehir', typeId: ps.cat.poleTypeByName('sehir', 'G-K2').id, state: durum || 'YENI' }, { coord: { lat: lat0 + dy / 111320, lon: lon0 + dx / kl, H: 1050 } });
  const d = [await dir(-60, 30), await dir(-20, 30), await dir(20, 30), await dir(60, 30), await dir(0, -40, 'MEVCUT')];
  await ps.recompute('deneme');
  a.state.follow = false;
  return d.map((x) => [x.no, x.pointId]); }"""

sonuc = []
def kontrol(ok, ne):
    sonuc.append((ok, ne)); print(('GEÇTİ  ' if ok else 'HATA   ') + ne, flush=True)

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, color_scheme='dark')
            await ctx.add_init_script("try { localStorage.setItem('sh-tema', 'koyu'); } catch (e) {}")
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
            D = await pg.evaluate(KUR)
            kontrol(len(D) == 5, 'deneme projesi: 5 direk ' + json.dumps([x[0] for x in D]))
            ids = {x[0]: x[1] for x in D}
            nos = [x[0] for x in D]
            await pg.evaluate("() => window.__app.nav.tab('map')"); await pg.wait_for_timeout(1200)
            await pg.evaluate("() => { const e = window.__app.state.mapEngine; e.fit(window.__app.ps.data.points); e.zoom(1.8); }"); await pg.wait_for_timeout(600)

            async def direge_dokun(no):
                xy = await pg.evaluate("""(pid) => { const a = window.__app, e = a.state.mapEngine, p = a.ps.pointById(pid); const s = e.toScreen(p.E, p.N); const r = document.querySelector('.mapwrap canvas').getBoundingClientRect(); return [r.left + s.x, r.top + s.y]; }""", ids[no])
                await pg.mouse.click(xy[0], xy[1]); await pg.wait_for_timeout(500)

            # 1) Haritadan nokta listesi
            kontrol(await pg.locator('.fabl button[aria-label="Nokta listesi"]').count() == 1, 'harita: sol üstte Nokta listesi düğmesi')
            await pg.locator('.fabl button[aria-label="Nokta listesi"]').click(); await pg.wait_for_timeout(700)
            metin = await pg.locator('main').inner_text()
            kontrol('Saha objeleri' in metin and all(n in metin for n in nos), 'Nokta listesi açıldı, direkler listede')
            await pg.screenshot(path=f'{OUT}/saha_01_liste.png')
            await pg.evaluate("() => window.__app.nav.back()"); await pg.wait_for_timeout(900)
            await pg.evaluate("() => { const e = window.__app.state.mapEngine; e.fit(window.__app.ps.data.points); e.zoom(1.8); }"); await pg.wait_for_timeout(500)

            # 2) Dokunarak hat: D1'den başlat, D2, D3, D4'e dokun; son direği çıkar, D4'e yine dokun, BİTİR
            await direge_dokun(nos[0])
            btn = pg.get_by_role('button', name='Buradan hat çiz (direklere dokunarak)')
            kontrol(await btn.count() == 1, 'direğe dokununca: "Buradan hat çiz" düğmesi')
            await pg.screenshot(path=f'{OUT}/saha_02_secim.png')
            await btn.click(); await pg.wait_for_timeout(600)
            await pg.get_by_role('button', name='HAT BAŞLAT').click(); await pg.wait_for_timeout(900)
            kontrol(await pg.locator('.dokunserit').count() == 1, 'hat başladı: üstte "direğe dokunun" şeridi')
            for n in nos[1:4]: await direge_dokun(n)
            l = await pg.evaluate("() => { const a = window.__app, l = a.ps.lineById(a.state.activeLineId); return l ? [l.lineNo, l.nodes.length] : null; }")
            kontrol(l and l[1] == 4, 'üç dokunuşla hat 4 direk: ' + json.dumps(l))
            serit = await pg.locator('.dokunserit').inner_text()
            kontrol('4 direk' in serit and nos[3] in serit, 'şerit direk sayısını gösterir: ' + serit.replace('\n', ' · '))
            await pg.screenshot(path=f'{OUT}/saha_03_dokunarak_hat.png')
            await pg.locator('.dokunserit button[aria-label="Son direği çıkar"]').click(); await pg.wait_for_timeout(600)
            n3 = await pg.evaluate("() => { const a = window.__app; return a.ps.lineById(a.state.activeLineId).nodes.length; }")
            kontrol(n3 == 3, 'son direği çıkar: 3 direk')
            await direge_dokun(nos[3])
            await direge_dokun(nos[3])   # aynı direğe ikinci dokunuş eklemez
            n4 = await pg.evaluate("() => { const a = window.__app; return a.ps.lineById(a.state.activeLineId).nodes.length; }")
            kontrol(n4 == 4, 'aynı direğe ikinci dokunuş eklemez: ' + str(n4))
            await pg.locator('.dokunserit button.bitir').click(); await pg.wait_for_timeout(600)
            kontrol(await pg.evaluate("() => !window.__app.state.activeLineId && !window.__app.state.dokunBagla") and await pg.locator('.dokunserit').count() == 0, 'BİTİR: hat kapandı, şerit gitti')
            # Kot kaydır (AutoCAD'deki Kot Kaydır karşılığı): A-02 ve A-03'ü işaretle, +1,5 m → 3B uzunluk artar; Geri al
            L0 = await pg.evaluate("() => { const ps = window.__app.ps, l = ps.data.lines[0]; return ps.result.lineInfo.get(l.id).length3D; }")
            await pg.locator('.fabl button[aria-label="Nokta listesi"]').click(); await pg.wait_for_timeout(700)
            await pg.get_by_role('button', name='Seç', exact=True).click(); await pg.wait_for_timeout(300)
            for n in nos[1:3]:
                await pg.locator('.li', has_text=n).locator('button[aria-label="İşaretle"]').click(); await pg.wait_for_timeout(150)
            kb = pg.get_by_role('button', name='Kot kaydır · 2 nokta')
            kontrol(await kb.count() == 1, 'listede "Kot kaydır · 2 nokta"')
            await kb.click(); await pg.wait_for_timeout(400)
            await pg.locator('.modal input.inp').fill('1,5'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{OUT}/saha_03b_kot.png')
            await pg.locator('.modal button.pri').click(); await pg.wait_for_timeout(900)
            k = await pg.evaluate("(ids) => { const ps = window.__app.ps, l = ps.data.lines[0]; return [ps.pointById(ids[0]).H, ps.pointById(ids[1]).H, ps.pointById(ids[2]).H, ps.result.lineInfo.get(l.id).length3D]; }", [ids[nos[1]], ids[nos[2]], ids[nos[0]]])
            kontrol(abs(k[0] - 1051.5) < 1e-6 and abs(k[1] - 1051.5) < 1e-6 and abs(k[2] - 1050) < 1e-6 and k[3] > L0 + 0.01, 'kot +1,5: A-02, A-03 1051,5; A-01 değişmedi; 3B uzunluk %.3f → %.3f' % (L0, k[3]))
            await pg.locator('button.btn.warn', has_text='Geri al (+1,5').click(); await pg.wait_for_timeout(900)
            k = await pg.evaluate("(ids) => { const ps = window.__app.ps, l = ps.data.lines[0]; return [ps.pointById(ids[0]).H, ps.result.lineInfo.get(l.id).length3D]; }", [ids[nos[1]]])
            kontrol(abs(k[0] - 1050) < 1e-6 and abs(k[1] - L0) < 1e-6, 'Geri al: kot ve uzunluk eski haline döndü')
            await pg.get_by_role('button', name='Seçimi kapat').click(); await pg.wait_for_timeout(200)
            await pg.evaluate("() => window.__app.nav.back()"); await pg.wait_for_timeout(900)
            await pg.evaluate("() => { const e = window.__app.state.mapEngine; e.fit(window.__app.ps.data.points); e.zoom(1.8); }"); await pg.wait_for_timeout(500)
            # Bitince direğe dokunmak yine seçim penceresini açar
            await direge_dokun(nos[1])
            kontrol(await pg.get_by_role('button', name='Malzeme ekle', exact=False).count() == 1 and await pg.get_by_role('button', name='Direği sil').count() == 1, 'seçim penceresi: Malzeme ekle ve Direği sil')
            await pg.screenshot(path=f'{OUT}/saha_04_secim_malzeme_sil.png')

            # 3) Direğe malzeme
            once = await pg.evaluate("(id) => (window.__app.ps.result.matsByEq.get(window.__app.ps.eqAt(id)[0].id) || { items: [] }).items.length", ids[nos[1]])
            await pg.get_by_role('button', name='Malzeme ekle', exact=False).click(); await pg.wait_for_timeout(600)
            kontrol('Malzeme ekle · ' + nos[1] in await pg.locator('.modal').inner_text(), 'malzeme penceresi direğin adıyla')
            await pg.locator('.modal input.inp').first.fill('topraklama'); await pg.wait_for_timeout(500)
            await pg.locator('.modal .li').first.click(); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{OUT}/saha_05_malzeme.png')
            await pg.locator('.modal button.pri').click(); await pg.wait_for_timeout(900)
            sonra = await pg.evaluate("(id) => (window.__app.ps.result.matsByEq.get(window.__app.ps.eqAt(id)[0].id) || { items: [] }).items.length", ids[nos[1]])
            elle = await pg.evaluate("(id) => window.__app.ps.data.materials.filter((m) => m.ownerId === window.__app.ps.eqAt(id)[0].id).length", ids[nos[1]])
            kontrol(elle == 1 and sonra >= once, 'direğe 1 malzeme eklendi (liste %s → %s)' % (once, sonra))
            # Mevcut direğe malzeme eklenmez (uyarı)
            await pg.evaluate("() => { const a = window.__app; a.state.sel = null; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(300)
            await direge_dokun(nos[4])
            await pg.get_by_role('button', name='Malzeme ekle', exact=False).click(); await pg.wait_for_timeout(500)
            kontrol(await pg.locator('.modal').count() == 0 and await pg.locator('.toast', has_text='işi olmayan').count() >= 1, 'mevcut direk: malzeme penceresi açılmaz, uyarı')
            await pg.evaluate("() => { const a = window.__app; a.state.sel = null; a.bus.emit('ui:sel'); }"); await pg.wait_for_timeout(300)

            # 4) Direk sil: D4 (hat ucundan) → hat 3 direkle sürer
            await direge_dokun(nos[3])
            await pg.get_by_role('button', name='Direği sil').click(); await pg.wait_for_timeout(500)
            mt = await pg.locator('.modal').inner_text()
            kontrol(nos[3] + ' silinsin mi' in mt and 'hattından düğüm olarak çıkarılır' in mt, 'silme penceresi etkisini yazar')
            await pg.screenshot(path=f'{OUT}/saha_06_sil.png')
            await pg.locator('.modal button.dang').click(); await pg.wait_for_timeout(900)
            r = await pg.evaluate("(pid) => { const ps = window.__app.ps; return [!!ps.pointById(pid), ps.data.equipment.filter((e) => e.pointId === pid).length, ps.data.lines.map((l) => l.nodes.length)]; }", ids[nos[3]])
            kontrol(r[0] is False and r[1] == 0 and r[2] == [3], 'D4 silindi; hat 3 direkle sürer: ' + json.dumps(r))
            # D1–D2 kalırsa (D3 silinince hat 2 direk), sonra D2 silinince hat tek direğe düşer ve silinir
            await pg.evaluate("async (pid) => { await window.__app.ps.deletePoint(pid, 'deneme'); }", ids[nos[2]])
            await direge_dokun(nos[1])
            await pg.get_by_role('button', name='Direği sil').click(); await pg.wait_for_timeout(500)
            mt = await pg.locator('.modal').inner_text()
            kontrol('tek direğe düşer ve silinir' in mt and 'malzeme satırı' in mt, 'hat tek direğe düşecekse ve elle malzeme varsa söylenir')
            await pg.locator('.modal button.dang').click(); await pg.wait_for_timeout(900)
            r = await pg.evaluate("() => { const ps = window.__app.ps; return [ps.data.lines.length, ps.data.equipment.length, ps.data.materials.length]; }")
            kontrol(r == [0, 2, 0], 'hat ve malzeme de silindi (hat, ekipman, malzeme): ' + json.dumps(r))
            aud = await pg.evaluate("async (pid) => { const a = window.__app; const l = await a.ds.auditFor(pid); return l.filter((x) => x.action === 'delete').map((x) => x.reason); }", ids[nos[3]])
            kontrol(len(aud) == 1 and aud[0] == 'Sahada silindi', 'denetim kaydında silme (gerekçe boşsa "Sahada silindi"): ' + json.dumps(aud, ensure_ascii=False))

            # 4b) Nokta listesinde Seç › işaretle › Sil (toplu silme) ve dolu projenin adı değişirken uyarı
            await pg.locator('.fabl button[aria-label="Nokta listesi"]').click(); await pg.wait_for_timeout(700)
            await pg.get_by_role('button', name='Seç', exact=True).click(); await pg.wait_for_timeout(300)
            await pg.locator('.li', has_text=nos[0]).locator('button[aria-label="İşaretle"]').click(); await pg.wait_for_timeout(200)
            await pg.locator('button.btn.dang', has_text='Sil (1)').click(); await pg.wait_for_timeout(400)
            kontrol('1 kayıt silinsin mi' in await pg.locator('.modal').inner_text(), 'toplu silme penceresi')
            await pg.locator('.modal button.dang').click(); await pg.wait_for_timeout(900)
            kontrol(await pg.evaluate("(pid) => !window.__app.ps.pointById(pid)", ids[nos[0]]), 'Seçilenleri sil: ' + nos[0] + ' silindi')
            await pg.evaluate("() => window.__app.nav.go('projectEdit')"); await pg.wait_for_timeout(600)
            await pg.locator('main input.inp').first.fill('Başka iş'); await pg.wait_for_timeout(200)
            await pg.get_by_role('button', name='KAYDET').click(); await pg.wait_for_timeout(500)
            mt = await pg.locator('.modal').inner_text() if await pg.locator('.modal').count() else ''
            kontrol('Projenin adı değişiyor' in mt and 'Yeni proje aç' in mt, 'dolu projenin adı değişirken uyarı')
            await pg.screenshot(path=f'{OUT}/saha_06b_ad_uyari.png')
            await pg.get_by_role('button', name='Yeni proje aç').click(); await pg.wait_for_timeout(900)
            kontrol(await pg.evaluate("() => window.__app.ps.p.name") == 'Deneme · Saha' and 'Yeni proje' in await pg.locator('main').inner_text(), 'ad değişmedi; Yeni proje formu açıldı')
            await pg.evaluate("() => window.__app.nav.tab('map')"); await pg.wait_for_timeout(800)

            # 5) Ölçülürken TAMAM: 30 epok bekleniyor, ikinci epokta TAMAM → nokta erken alınır
            await pg.evaluate("async () => { const g = window.__app.gnss; g.thresholds.epochs = 30; g.startSimulator({ profile: 'FIX', hz: 2 }); }")
            await pg.wait_for_timeout(6500)   # FIX en az 5 s sürmeli (kalite eşiği)
            once = await pg.evaluate("() => window.__app.ps.data.points.length")
            await pg.locator('.dock .btn.take').click(); await pg.wait_for_timeout(1300)
            al = pg.locator('.dock .btn.take.olcum')
            kontrol(await al.count() == 1 and 'TAMAM' in await al.inner_text(), 'ölçülürken düğme TAMAM gösterir: ' + (await al.inner_text() if await al.count() else '—').replace('\n', ' '))
            await pg.screenshot(path=f'{OUT}/saha_07_tamam.png')
            t0 = time.time()
            await al.click()
            await pg.wait_for_function("(n) => window.__app.ps.data.points.length > n", arg=once, timeout=5000)
            sure = time.time() - t0
            q = await pg.evaluate("() => { const ps = window.__app.ps; const p = ps.data.points[ps.data.points.length - 1]; const o = ps.data.gnssObservations.find((x) => x.id === p.observationId) || {}; return [p.quality && p.quality.epochs, o.erken === true, o.epochsNeed]; }")
            kontrol(q[0] is not None and 1 <= q[0] < 30 and q[1] and q[2] == 30 and sure < 3, 'TAMAM: %.1f s içinde %s epokla alındı (erken, 30 istendi)' % (sure, q[0]))
            await pg.evaluate("() => window.__app.gnss.stopAll()")
            kontrol(not errors, 'sayfa hatası yok' + ('' if not errors else ': ' + json.dumps(errors[:5], ensure_ascii=False)))
            await b.close()
    finally:
        srv.terminate()
    hata = [n for ok, n in sonuc if not ok]
    print('SONUÇ: ' + ('hepsi geçti (%d)' % len(sonuc) if not hata else '%d hata' % len(hata)))
    sys.exit(0 if not hata else 1)

asyncio.run(main())
