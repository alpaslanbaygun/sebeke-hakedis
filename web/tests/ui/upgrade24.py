# Sürüm geçiş testi: 2.3.0 ile oluşturulan veritabanı 2.4.0 ile açılır (katalog güncellenir, veriler ve metraj korunur,
# otomatik reçete bir kez sorulur), sonra 2.3.0'a geri dönülür.
import asyncio, sys, subprocess, time, json, shutil
from playwright.async_api import async_playwright
OLD = '/tmp/claude-0/wt230/web/dist/www'; NEW = '/home/claude/voltapp/web/dist/www'; PROFILE = '/tmp/claude-0/upg24-profile'
shutil.rmtree(PROFILE, ignore_errors=True)
def serve(d):
    # önceki denemeden kalan sunucu yanlış sürümü sunmasın: kapat, kapı boşalana kadar bekle, sonra doğru klasörü sunduğunu doğrula
    import socket, os, urllib.request
    subprocess.run(['pkill', '-9', '-f', 'http[.]server 8771'])
    for _ in range(50):
        with socket.socket() as k:
            if k.connect_ex(('127.0.0.1', 8771)) != 0: break
        time.sleep(0.1)
    p = subprocess.Popen([sys.executable, '-m', 'http.server', '8771', '-d', d], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            n = len(urllib.request.urlopen('http://127.0.0.1:8771/app.js', timeout=2).read()); break
        except Exception: time.sleep(0.1)
    assert n == os.path.getsize(os.path.join(d, 'app.js')), 'sunucu yanlış klasörü sunuyor'
    return p
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
SUMMARY = """() => { const ps = window.__app.ps; const q = ps.result.quantities; return { proje: ps.p && ps.p.name, nokta: ps.data.points.length, ekipman: ps.data.equipment.map(e => e.no + ':' + e.kind + ':' + (e.hak || '-')).join(','), hat: ps.data.lines.map(l => l.lineNo + ':' + l.nodes.length).join(','), aciklik: ps.result.spans.length, metraj: q.length, toplam: Math.round(q.reduce((a, x) => a + x.qty, 0) * 100) / 100, kalemler: q.map(x => (x.servis || x.key) + '=' + Math.round(x.qty * 1000) / 1000).sort().join('|'), donem: ps.data.periods.map(p => p.no + ':' + p.status).join(','), poz: ps.cat.t.poz.length, oto: ps.p.autoRecipe }; }"""
MAKE = """async () => {
  const a = window.__app, ps = a.ps;
  const pr = await ps.createProject({ name: 'Geçiş testi 2.3.0', code: 'UPG-3', cm: 39, mode: 'asbuilt' }); await ps.open(pr.id);
  const t = ps.cat.poleTypeByName('bahh', 'GT-12 (3 AWG)').id; const ids = [];
  for (let i = 0; i < 4; i++) { const e = await ps.addEquipment('pole', { group: 'bahh', typeId: t }, { coord: { E: 519000 + i * 90, N: 4282000 + i * 12, H: 1050 + i }, source: 'MANUAL' }); ids.push(e.pointId); }
  await ps.createLine({ lineType: 'OG', install: 'havai', circuits: [{ role: 'OG', key: '3xSwallow', count: 1 }], nodes: ids });
  const tr = await ps.addEquipment('transformer', { state: 'yeni', attrs: { post: 'mono', kva: 630, cins: 'herm' } }, { coord: { E: 519400, N: 4282060, H: 1052 }, source: 'MANUAL' });
  const pn = await ps.addEquipment('panel', { attrs: {} }, { coord: { E: 519460, N: 4282060, H: 1052 }, source: 'MANUAL' });
  const lu = await ps.addEquipment('luminaire', { attrs: {} }, { coord: { E: 519430, N: 4282080, H: 1052 }, source: 'MANUAL' });
  const mh = await ps.addEquipment('manhole', { attrs: {} }, { coord: { E: 519430, N: 4282060, H: 1052 }, source: 'MANUAL' });
  // yeraltı: toprak kanal + beton kanal + direk inişi (2.4'te kaldırılan seçenek)
  const mk = async (ct, n1, n2) => ps.createLine({ lineType: 'AG', install: 'yeralti', channelOnly: true, circuits: [], nodes: [n1, n2], cable: { channelType: ct, depth: 0.8, width: 0.4 } });
  await mk('toprak', tr.pointId, mh.pointId); await mk('beton', mh.pointId, pn.pointId); await mk('direk', ids[3], tr.pointId);
  await ps.addEquipment('subscriber', { attrs: { phase: 'tek', kofre: true } }, { coord: { E: 519420, N: 4282090, H: 1052 }, source: 'MAP' });
  await ps.setHak('equipment', ps.data.equipment[0].id, 'KONTROL');
  await ps.createWorkProgram(); await ps.createPeriod({ start: '2026-09-01', end: '2026-12-31' });
  return true;
}"""
async def main():
    async with async_playwright() as p:
        srv = serve(OLD)
        _, e1 = await session(p, lambda pg: pg.evaluate(MAKE))
        s230, e1b = await session(p, lambda pg: pg.evaluate(SUMMARY))
        srv.terminate(); srv.wait(); time.sleep(0.5)
        print('2.3.0  ', json.dumps({k: v for k, v in s230.items() if k != 'kalemler'}, ensure_ascii=False), 'hata:', e1 + e1b)
        srv = serve(NEW)
        async def up(pg):
            s = await pg.evaluate(SUMMARY)
            # harita açılınca eski projeye bir kez sorulur
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(1200)
            soru = await pg.get_by_text('Otomatik malzeme reçetesi', exact=True).count()
            await pg.screenshot(path='/home/claude/voltapp/web/tests/ui/shots/u24_soru.png')
            await pg.get_by_role('button', name='Bu projede açık kalsın').click(); await pg.wait_for_timeout(600)
            s2 = await pg.evaluate(SUMMARY)
            # ikinci kez sorulmaz
            await pg.get_by_text('Hesaplar', exact=True).first.click(); await pg.wait_for_timeout(300)
            await pg.get_by_text('Harita', exact=True).first.click(); await pg.wait_for_timeout(1200)
            soru2 = await pg.get_by_text('Otomatik malzeme reçetesi', exact=True).count()
            # kapatınca: yardımcı kalemler çıkar, kanal hesabı ve seçilenler kalır; eski lamba/menhol kayıtları durur
            await pg.evaluate("async () => { await window.__app.ps.updateProject({ autoRecipe: false }, 'deneme'); }")
            s3 = await pg.evaluate(SUMMARY)
            kanal = await pg.evaluate("() => { const ps = window.__app.ps; return ps.data.lines.filter(l => l.install === 'yeralti').map(l => { const r = (ps.result.lineInfo.get(l.id) || {}).cable; return [l.cable.channelType, r && r.kanal ? [r.kanal.surface, r.kanal.method, Math.round(r.kanal.hacim * 100) / 100] : null]; }); }")
            # 2.4 özellikleri eski veride
            await pg.evaluate("""async () => { const ps = window.__app.ps;
              const d = ps.data.equipment.find((e) => e.kind === 'pole'); await ps.updateEquipment(d.id, { attrs: Object.assign({}, d.attrs, { armatur: [{ servis: ps.cat.t.poz.find((z) => /armat/i.test(z.name || '')).servis, qty: 2 }] }) }, 'armatür');
              const l = ps.data.lines.find((x) => x.install === 'yeralti'); await ps.updateLine(l.id, { cable: Object.assign({}, l.cable, { surface: 'asfalt', method: 'borulu', pipeDia: 110, pipeCount: 2 }) }, 'kanal');
              await ps.addMaterial('equipment', d.id, '030.02.01.01-001', 3, ''); }""")
            s4 = await pg.evaluate(SUMMARY)
            return s, soru, s2, soru2, s3, kanal, s4
        (s240, soru, s240b, soru2, s240c, kanal, s240d), e2 = await session(p, up)
        srv.terminate(); srv.wait(); time.sleep(0.5)
        print('2.4.0  ', json.dumps({k: v for k, v in s240.items() if k != 'kalemler'}, ensure_ascii=False))
        print('  soru çıktı:', soru, '· ikinci açılışta:', soru2, '· seçim sonrası oto:', s240b['oto'])
        print('  kapalıyken metraj kalem:', s240c['metraj'], '(açıkken', s240['metraj'], ') · kanal:', kanal)
        print('  2.4 kayıtları sonrası metraj kalem:', s240d['metraj'], 'hata:', e2)
        for k in ['proje', 'nokta', 'ekipman', 'hat', 'aciklik', 'metraj', 'toplam', 'kalemler', 'donem']: assert s230[k] == s240[k], ('2.4.0 açılışında fark', k, s230[k], s240[k])
        assert s240['oto'] is None and soru == 1 and s240b['oto'] is True and soru2 == 0, (s240['oto'], soru, s240b['oto'], soru2)
        assert s240b['kalemler'] == s230['kalemler'], 'açık bırakınca metraj aynı kalmalı'
        assert s240['poz'] > s230['poz'], 'katalog güncellenmeli'
        assert s240c['metraj'] < s240['metraj'] and s240c['ekipman'] == s240['ekipman']
        assert all(k[1] for k in kanal), kanal
        assert dict((k[0], k[1][2]) for k in kanal)['direk'] == 0, 'eski direk inişi kaydında kazı hesaplanmamalı'
        assert s240d['metraj'] > s240c['metraj']
        assert not e2, e2
        srv = serve(OLD)
        s230b, e3 = await session(p, lambda pg: pg.evaluate(SUMMARY))
        srv.terminate(); srv.wait()
        print('2.3.0 (geri dönüş)', json.dumps({k: v for k, v in s230b.items() if k != 'kalemler'}, ensure_ascii=False), 'hata:', e3)
        assert s230b['proje'] == s230['proje'] and s230b['nokta'] == s240d['nokta'] and s230b['hat'] == s230['hat'] and not e3, e3
        print('GEÇİŞ TESTİ TAMAM')
asyncio.run(main())
