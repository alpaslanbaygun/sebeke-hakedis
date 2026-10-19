#!/usr/bin/env python3
"""Hesap Merkezi denemesi: paketlenmiş hesap sayfalarını gerçek bir tarayıcıda (Chromium) açar.

Her hesap telefon uygulamasındaki gibi bir çerçevenin (iframe) içinde açılır; deneme sayfası uygulamanın yerine
geçer (bağlamı verir, kaydı alır). ortak/hesap/dene/<id>.json dosyalarındaki her durum için:
  1. bağlamla açar, uyarlamanın doldurduğu / eksik bıraktığı alanları denetler,
  2. varsa ek adımları çalıştırır (kullanıcının gireceği değerler),
  3. sonucu okur ve beklenen değerlerle karşılaştırır (beklenen değerler hesabın özgün dosyasıyla aynı girdilerle
     elde edilmiştir: formüllerin değişmediğini gösterir),
  4. hesabın durumunu alıp yeni bir sayfada geri yükler, sonucun aynı çıktığını denetler,
  5. sayfa hatası (JavaScript) olmadığını denetler.

Kullanım: python3 araclar/hesap-dene.py [hesap-id ...] [--ekran KLASÖR] [--chrome YOL]
Gerekenler: Python Playwright (pip install playwright) ve Node.js (paketleyici için).
"""
import argparse, functools, http.server, json, math, os, re, shutil, socketserver, subprocess, sys, tempfile, threading, time

KOK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DENE = os.path.join(KOK, 'ortak', 'hesap', 'dene')

EV = r"""<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b1326}iframe{border:0;width:100%;height:100%;display:block}</style></head>
<body><iframe id="f"></iframe><script>
window.gelen = []; window.kaydedilen = null; window.ayar = {};
addEventListener('message', function (e) {
  var m = e.data; if (!m || m.sm !== 'hesap') return;
  gelen.push({ tip: m.tip, veri: m.veri });
  if (!m.id) return;
  var veri = null;
  if (m.tip === 'basla') veri = { baglam: ayar.baglam || null, hedef: (ayar.baglam && ayar.baglam.hedef) || null, kayit: ayar.kayit || null, guncel: ayar.guncel === undefined ? (ayar.kayit ? null : (ayar.baglam || null)) : ayar.guncel };
  else if (m.tip === 'kaydet') { kaydedilen = m.veri; veri = { id: 'K1', mesaj: 'Kaydedildi' }; }
  e.source.postMessage({ sm: 'hesap', tip: 'yanit', id: m.id, veri: veri }, '*');
});
function ac(modul, a, n) { ayar = a || {}; gelen = []; kaydedilen = null; document.getElementById('f').src = 'hesap/' + modul + '.html?ortam=telefon&n=' + n; }
</script></body></html>"""


def paketle(hedef):
    subprocess.run(['node', os.path.join(KOK, 'araclar', 'hesap-paketle.mjs'), hedef], check=True, stdout=subprocess.DEVNULL)


class Sunucu(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Isleyici(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def sunucu_baslat(kok):
    s = Sunucu(('127.0.0.1', 0), functools.partial(Isleyici, directory=kok))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def sayi_esit(a, b, tol):
    try:
        a = float(a); b = float(b)
    except (TypeError, ValueError):
        return False
    if math.isnan(a) or math.isnan(b):
        return False
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))


def deger_bul(sonuc, ad):
    """Sonuçta bir değeri bulur: 'degerler' ya da 'girdiler' listesinde ad ile, yoksa nokta yolu ile."""
    for liste in ('degerler', 'girdiler'):
        for x in sonuc.get(liste) or []:
            if isinstance(x, dict) and x.get('ad') == ad:
                return True, x.get('deger')
    c = sonuc
    for p in re.findall(r'[^.\[\]]+|\[\d+\]', ad):
        if p.startswith('['):
            i = int(p[1:-1])
            if not isinstance(c, list) or i >= len(c):
                return False, None
            c = c[i]
        else:
            if not isinstance(c, dict) or p not in c:
                return False, None
            c = c[p]
    return True, c


def karsilastir(sonuc, bek, tol, hatalar, on=''):
    if 'durum' in bek and sonuc.get('durum') != bek['durum']:
        hatalar.append(on + 'durum: %r (beklenen %r)' % (sonuc.get('durum'), bek['durum']))
    if 'ozet' in bek and not re.search(bek['ozet'], sonuc.get('ozet') or ''):
        hatalar.append(on + 'özet eşleşmedi: %r ~ /%s/' % (sonuc.get('ozet'), bek['ozet']))
    for ad, b in (bek.get('degerler') or {}).items():
        var, g = deger_bul(sonuc, ad)
        if not var:
            hatalar.append(on + 'değer yok: ' + ad)
        elif isinstance(b, (int, float)) and not isinstance(b, bool):
            if not sayi_esit(g, b, tol):
                hatalar.append(on + '%s = %r (beklenen %r)' % (ad, g, b))
        elif g != b:
            hatalar.append(on + '%s = %r (beklenen %r)' % (ad, g, b))


async def calistir(args):
    from playwright.async_api import async_playwright
    gecici = tempfile.mkdtemp(prefix='sm-hesap-')
    try:
        paketle(os.path.join(gecici, 'hesap'))
        with open(os.path.join(gecici, 'ev.html'), 'w', encoding='utf-8') as f:
            f.write(EV)
        srv = sunucu_baslat(gecici)
        adres = 'http://127.0.0.1:%d/' % srv.server_address[1]
        dosyalar = sorted(f for f in os.listdir(DENE) if f.endswith('.json'))
        if args.hesaplar:
            dosyalar = [f for f in dosyalar if f[:-5] in args.hesaplar]
        toplam = basarisiz = 0
        async with async_playwright() as p:
            secenek = {'executable_path': args.chrome} if args.chrome else {}
            tarayici = await p.chromium.launch(**secenek)
            for dosya in dosyalar:
                tanim = json.load(open(os.path.join(DENE, dosya), encoding='utf-8'))
                modul = tanim['modul']
                for d in tanim['durumlar']:
                    toplam += 1
                    hatalar = []
                    gen, yuk = (args.boyut or '1280x900').split('x')
                    boyut = d.get('ekran', {'width': int(gen), 'height': int(yuk)})
                    sayfa = await tarayici.new_page(viewport=boyut)
                    js_hatalari = []
                    sayfa.on('pageerror', lambda e: js_hatalari.append(str(e)))
                    sayfa.on('console', lambda m: js_hatalari.append('console: ' + m.text) if m.type == 'error' else None)
                    await sayfa.goto(adres + 'ev.html')

                    sayac = [0]

                    async def ac(ayar):
                        sayac[0] += 1
                        son = '%s.html?ortam=telefon&n=%d' % (modul, sayac[0])
                        await sayfa.evaluate('([m, a, n]) => ac(m, a, n)', [modul, ayar, sayac[0]])
                        cerceve = None
                        for _ in range(400):
                            cerceve = next((fr for fr in sayfa.frames if fr.url.endswith(son)), None)
                            if cerceve:
                                try:
                                    if await cerceve.evaluate('() => !!(window.__SM && window.__SM.durum && window.__SM.durum.hazir)'):
                                        return cerceve
                                except Exception:
                                    pass
                            await sayfa.wait_for_timeout(50)
                        raise RuntimeError('sayfa hazır olmadı')

                    try:
                        fr = await ac({'baglam': d.get('baglam')})
                        S = await fr.evaluate('() => JSON.parse(JSON.stringify(window.__SM.durum))')
                        if 'dolan' in d.get('beklenen', {}):
                            yollar = sorted(x.get('yol') or x.get('alan') for x in S['dolan'])
                            if d['beklenen']['dolan'] != len(S['dolan']) and d['beklenen']['dolan'] != yollar:
                                hatalar.append('dolan: %d alan %r (beklenen %r)' % (len(S['dolan']), yollar, d['beklenen']['dolan']))
                        if 'eksik' in d.get('beklenen', {}):
                            eks = sorted(x.get('alan') for x in S['eksik'])
                            if d['beklenen']['eksik'] != len(eks) and d['beklenen']['eksik'] != eks:
                                hatalar.append('eksik: %r (beklenen %r)' % (eks, d['beklenen']['eksik']))
                        for adim in d.get('adimlar', []):
                            await fr.evaluate('() => { ' + adim + ' }')
                            await sayfa.wait_for_timeout(30)
                        sonuc = await fr.evaluate('() => window.__SM_UYARLAMA.sonuc(window.__SM.A)')
                        if sonuc.get('hata'):
                            hatalar.append('sonuç hatası: ' + sonuc['hata'])
                        karsilastir(sonuc, d.get('beklenen', {}), d.get('tolerans', 1e-6), hatalar)
                        if args.ekran:
                            os.makedirs(args.ekran, exist_ok=True)
                            ad = re.sub(r'[^\w-]+', '_', modul + '-' + d['ad'])[:80]
                            await sayfa.screenshot(path=os.path.join(args.ekran, ad + '.png'), full_page=False)
                        # durum → yeni sayfada geri yükle
                        durum = await fr.evaluate('() => JSON.stringify(window.__SM.durumAl())')
                        kayit = {'id': 'K1', 'modul': modul, 'modulDurumu': durum, 'kullanilan': S.get('kullanilan') or {},
                                 'tarih': '2026-10-18T10:00:00.000Z', 'kaynak': 'telefon'}
                        fr2 = await ac({'kayit': kayit, 'baglam': d.get('baglam'), 'guncel': d.get('baglam')})
                        sonuc2 = await fr2.evaluate('() => window.__SM_UYARLAMA.sonuc(window.__SM.A)')
                        if (sonuc2.get('ozet') != sonuc.get('ozet')) or (json.dumps(sonuc2.get('degerler'), sort_keys=True) != json.dumps(sonuc.get('degerler'), sort_keys=True)):
                            hatalar.append('geri yükleme farklı sonuç verdi: %r → %r' % (sonuc.get('ozet'), sonuc2.get('ozet')))
                        S2 = await fr2.evaluate('() => window.__SM.durum.farklar')
                        if S2:
                            hatalar.append('aynı bağlamla açılan kayıt "güncel değil" göründü: %r' % S2)
                    except Exception as e:
                        hatalar.append('çalıştırılamadı: %s' % e)
                    yoksay = d.get('yoksay', [])
                    for h in js_hatalari:
                        if not any(re.search(y, h) for y in yoksay):
                            hatalar.append('sayfa hatası: ' + h)
                    await sayfa.close()
                    if hatalar:
                        basarisiz += 1
                        print('✗ %s · %s' % (modul, d['ad']))
                        for h in hatalar:
                            print('    ' + h)
                    else:
                        print('✓ %s · %s' % (modul, d['ad']))
            await tarayici.close()
        srv.shutdown()
        print('%d durumdan %d başarılı' % (toplam, toplam - basarisiz))
        return 1 if basarisiz else 0
    finally:
        shutil.rmtree(gecici, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('hesaplar', nargs='*')
    ap.add_argument('--ekran')
    ap.add_argument('--chrome', default=os.environ.get('SM_CHROME'))
    ap.add_argument('--boyut', help='pencere boyutu, ör. 390x844 (telefon)')
    args = ap.parse_args()
    import asyncio
    sys.exit(asyncio.run(calistir(args)))


if __name__ == '__main__':
    main()
