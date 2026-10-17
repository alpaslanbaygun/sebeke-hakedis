# v2.3 arayüz denemeleri için ortak yardımcılar
import asyncio, sys, os, subprocess, time
from playwright.async_api import async_playwright
WWW = '/home/claude/voltapp/web/dist/www'
OUT = '/home/claude/voltapp/web/tests/ui/shots'
os.makedirs(OUT, exist_ok=True)
class Ctx:
    def __init__(self): self.errors = []
async def start(p, port=8811, w=390, h=844, www=WWW, init=None):
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '-d', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if w < 600 else 1)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page()
    errors = []
    pg.on('console', lambda m: errors.append(('console', m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
    async def guard(route):
        u = route.request.url
        if u.startswith(f'http://127.0.0.1:{port}/'): await route.continue_()
        else: await route.abort()
    await pg.route('**/*', guard)
    await pg.goto(f'http://127.0.0.1:{port}/index.html')
    await pg.wait_for_function('window.__voltReady === true', timeout=60000)
    return srv, b, pg, errors
async def shot(pg, name):
    await pg.wait_for_timeout(450)
    await pg.screenshot(path=f'{OUT}/{name}.png')
SETUP = """async () => {
  const a = window.__app, ps = a.ps;
  const p = await ps.createProject({ name: 'OG-03 Hat Yenileme · Kurtdere', code: 'ELZ-2026-OG03', cm: 39, enhZone: 'III', mode: 'asbuilt' });
  await ps.open(p.id);
  return p.id;
}"""
