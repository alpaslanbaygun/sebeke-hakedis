# Arayüz denemesi: lisans (13.11.2026). Yerel köprü taklit edilir (cihazKimligi = ANDROID_ID); ilk açılışta deneme
# sürümü (7 gün, uyarı), Ayarlar › Lisans'ta cihaz kodu; deneme süresi dolunca uygulama yalnız Lisans ekranını açar
# (alt menü yok), başka anahtarla imzalı / bozuk lisans kaydedilmez. Gerçek lisansla açılma, gizli anahtar gerektirdiği
# için burada değil, tests/lisans.test.mjs'de (deneme anahtarıyla) denenir.
# Kullanım: python3 lisans_ui.py <dist/www klasörü> <ekran görüntüsü klasörü>   (çıkış kodu 0: geçti)
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

WWW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'www')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
PORT = 8833
KOK = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')
V = json.load(open(os.path.join(KOK, 'ortak', 'deneme', 'lisans', 'vektorler.json'), encoding='utf-8'))
TL = next(c for c in V['cihazlar'] if c['onek'] == 'TL')
YABANCI = next(d for d in V['durumlar'] if d['beklenen']['hataKodu'] == 'imza')['lisans']

MOCK = r"""
(() => {
  const ev = (e, o) => setTimeout(() => window.__voltNative && window.__voltNative(e, JSON.stringify(o)), 5);
  const reply = (id, r) => ev('reply', { reqId: id, result: r });
  const sonuc = { cihazKimligi: { id: '__HAM__' }, appInfo: { platform: 'android', version: '2.5.x', sdk: 34, model: 'Deneme' }, sistemTemasi: { acik: false } };
  window.VoltNative = new Proxy({}, { get: (t, m) => (id) => reply(id, Object.prototype.hasOwnProperty.call(sonuc, m) ? sonuc[m] : null) });
})();
""".replace('__HAM__', TL['ham'])

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
            await ctx.add_init_script(MOCK)
            pg = await ctx.new_page()
            errors = []
            pg.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
            async def guard(route):
                if route.request.url.startswith(f'http://127.0.0.1:{PORT}/'): await route.continue_()
                else: await route.abort()
            await pg.route('**/*', guard)
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html')
            await pg.wait_for_function('window.__voltReady === true', timeout=60000)
            await pg.wait_for_timeout(2000)
            l = await pg.evaluate('() => window.__app.state.lisans')
            kontrol(l['cihaz']['kod'] == TL['kod'], 'cihaz kodu ANDROID_ID\'den (ortak denemedeki kod): ' + l['cihaz']['kod'])
            kontrol(l['durum']['tur'] == 'deneme' and l['durum']['kalanGun'] == 7 and l['durum']['kullanilabilir'], 'ilk açılış: deneme, 7 gün')
            kontrol(await pg.locator('.toast', has_text='Deneme sürümü').count() >= 1 or await pg.locator('text=Deneme sürümü: 7 gün kaldı').count() >= 1, 'ilk açılış: deneme uyarısı')
            await pg.evaluate("() => window.__app.nav.tab('settings')"); await pg.wait_for_timeout(600)
            await pg.evaluate("() => window.__app.nav.go('lisans')"); await pg.wait_for_timeout(600)
            metin = await pg.locator('main').inner_text()
            kontrol(TL['kod'] in metin and 'DENEME SÜRÜMÜ' in metin, 'Ayarlar › Lisans: cihaz kodu ve deneme')
            await pg.screenshot(path=f'{OUT}/lisans_01_deneme.png')
            # Deneme süresi dolsun (ilk açılış 10 gün önce)
            await pg.evaluate("""async () => { const a = window.__app; const k = (await a.ds.setting('lisans')) || {}; const d = new Date(Date.now() - 10 * 86400000); k.ilkAcilis = d.toISOString().slice(0, 10); await a.ds.setting('lisans', k); localStorage.setItem('sh-lisans', JSON.stringify(k)); }""")
            await pg.reload(); await pg.wait_for_function('window.__voltReady === true', timeout=60000); await pg.wait_for_timeout(1500)
            metin = await pg.locator('main').inner_text()
            kontrol('LİSANS GEREKLİ' in metin and 'Deneme süresi doldu' in metin and await pg.locator('nav.tabbar').count() == 0, 'süre dolunca yalnız Lisans ekranı (alt menü yok)')
            await pg.screenshot(path=f'{OUT}/lisans_02_kilit.png')
            kaydet = pg.get_by_role('button', name='LİSANSI KAYDET')
            kontrol(await kaydet.is_disabled(), 'boşken Kaydet kapalı')
            await pg.locator('textarea').fill(YABANCI); await pg.wait_for_timeout(400)
            kontrol('imza' in (await pg.locator('main').inner_text()) and await kaydet.is_disabled(), 'başka anahtarla imzalı lisans: imza hatası, Kaydet kapalı')
            await pg.locator('textarea').fill('SHL1.YWJj.ZGVm'); await pg.wait_for_timeout(400)
            kontrol('okunamadı' in (await pg.locator('main').inner_text()) and await kaydet.is_disabled(), 'bozuk lisans: okunamadı')
            await pg.screenshot(path=f'{OUT}/lisans_03_gecersiz.png')
            kontrol(await pg.evaluate("async () => !((await window.__app.ds.setting('lisans')) || {}).metin"), 'geçersiz lisans kaydedilmedi')
            kontrol(not errors, 'sayfa hatası yok' + ('' if not errors else ': ' + json.dumps(errors[:5], ensure_ascii=False)))
            await b.close()
    finally:
        srv.terminate()
    hata = [n for ok, n in sonuc if not ok]
    print('SONUÇ: ' + ('hepsi geçti (%d)' % len(sonuc) if not hata else '%d hata' % len(hata)))
    sys.exit(0 if not hata else 1)

asyncio.run(main())
