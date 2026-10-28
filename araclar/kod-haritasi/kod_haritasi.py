#!/usr/bin/env python3
"""Şebeke-M kod haritası.

Depodaki dosyaları ve AutoCAD komutlarını, aralarındaki bağlarla çıkarır ve kökteki HARITA.md'yi yazar.
Bağlar dosyaların içinden bulunur: JavaScript içe aktarmaları, HTML / CSS bağlantıları, C# / Java tür kullanımı,
komut tanımları (CommandMethod) ve anmaları, belgelerdeki bağlantılar, dosya yolu / adı ve tür adı anmaları.
HARITA.md bir işe başlarken depoyu baştan taramadan doğru dosyaya gitmek içindir; kod değişince yeniden üretilir.

Kullanım (depo kökünden):
    python3 araclar/kod-haritasi/kod_haritasi.py                    # HARITA.md
    python3 araclar/kod-haritasi/kod_haritasi.py --sayfa harita.html # ayrıca etkileşimli harita sayfası
Gerekenler: Python 3.9+, networkx (pip install networkx); --sayfa için numpy. Sayfa, Claude'un Artifact aracıyla
yayımlanacak biçimdedir (belge iskeleti yayımlarken eklenir).
"""
import argparse
import collections
import hashlib
import json
import math
import os
import re
import subprocess
import sys

nx = None  # networkx; cozumle() yükler (kanca.py bu dosyadan yalnız dosya listesini kullanır)

BURASI = os.path.dirname(os.path.abspath(__file__))
KOK = subprocess.check_output(['git', '-C', BURASI, 'rev-parse', '--show-toplevel'], text=True).strip()

# Haritanın kendisi ve Claude notu haritaya girmez (her dosyayı andıkları için merkeze otururlardı).
HARIC = {'HARITA.md', 'CLAUDE.md'}
HARIC_KLASOR = ('araclar/kod-haritasi/', '.claude/')
IKILI = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'woff', 'woff2', 'ttf', 'jks', 'ico', 'jar', 'apk', 'zip', 'dll', 'exe',
         'dwg', 'xlsx', 'pdf'}


def uzanti(p):
    return p.rsplit('.', 1)[-1].lower() if '.' in os.path.basename(p) else ''


def oku(p):
    try:
        with open(os.path.join(KOK, p), encoding='utf-8-sig', errors='replace') as fh:
            return fh.read()
    except OSError:
        return ''


# ---------------------------------------------------------------- sınıflama
def bolum(p):
    ust = p.split('/')[0]
    return ust if ust in ('autocad', 'telefon', 'ortak') else 'diger'


def alt_bolum(p):
    parcalar = p.split('/')
    if p.startswith(('autocad/src/', 'autocad/test/')): return '/'.join(parcalar[:3])
    if p.startswith('autocad/'): return '/'.join(parcalar[:2])
    if p.startswith('telefon/web/src/'): return '/'.join(parcalar[:4]) if len(parcalar) > 4 else 'telefon/web/src'
    if p.startswith('telefon/web/'): return '/'.join(parcalar[:3]) if len(parcalar) > 3 else 'telefon/web'
    if p.startswith('telefon/'): return '/'.join(parcalar[:2]) if len(parcalar) > 2 else 'telefon'
    if p.startswith('ortak/hesap/'): return '/'.join(parcalar[:3]) if len(parcalar) > 3 else 'ortak/hesap'
    if p.startswith('ortak/'): return '/'.join(parcalar[:2]) if len(parcalar) > 2 else 'ortak'
    if p.startswith('araclar/'): return 'araclar'
    if p.startswith('.github/'): return '.github'
    return '(kök)'


ALT_AD = {
    'autocad/src/Cekirdek': 'AutoCAD çekirdeği', 'autocad/src/Eklenti': 'AutoCAD eklentisi',
    'autocad/test/CekirdekTest': 'AutoCAD çekirdek denemesi', 'autocad/test/PencereTest': 'AutoCAD pencere denemesi',
    'autocad/paket': 'Eklenti kurulum paketi',
    'telefon/web/src/core': 'Telefon · çekirdek', 'telefon/web/src/services': 'Telefon · servisler',
    'telefon/web/src/ui': 'Telefon · arayüz', 'telefon/web/src/interop': 'Telefon · AutoCAD aktarımı',
    'telefon/web/src/gnss': 'Telefon · GNSS', 'telefon/web/src/geo': 'Telefon · koordinat',
    'telefon/web/src/export': 'Telefon · dışa aktarma', 'telefon/web/src/hesap': 'Telefon · Hesap Merkezi',
    'telefon/web/src/native': 'Telefon · yerel köprü', 'telefon/web/src/ortak': 'Telefon · ortak tablolar',
    'telefon/web/src/grid': 'Telefon · şebeke çizimi', 'telefon/web/src/cad': 'Telefon · CAD dosyaları',
    'telefon/web/src/qty': 'Telefon · metraj', 'telefon/web/src/web': 'Telefon · web yardımcıları',
    'telefon/web/src/engine': 'Telefon · hesap motoru', 'telefon/web/src/calc': 'Telefon · eski hesap ekranları',
    'telefon/tools': 'Telefon · derleme araçları', 'telefon/web/src': 'Telefon · uygulama',
    'telefon/web/tests': 'Telefon denemeleri', 'telefon/web/seed': 'Telefon · standart paket',
    'telefon/web': 'Telefon · web derleme', 'telefon/android': 'Telefon · Android kabuğu',
    'telefon/docs': 'Telefon belgeleri', 'telefon': 'Telefon',
    'ortak/hesap/kaynak': 'Hesap araçları (özgün)', 'ortak/hesap/uyarlama': 'Hesap uyarlamaları',
    'ortak/hesap/dene': 'Hesap denemeleri', 'ortak/hesap': 'Hesap Merkezi (ortak)',
    'ortak/katalog': 'Ortak katalog ve tablolar', 'ortak/marka': 'Marka', 'ortak': 'Ortak belgeler',
    'araclar': 'Geliştirme araçları', '.github': 'Otomatik derleme (CI)', '(kök)': 'Proje belgeleri',
}


def alt_ad(s):
    if s in ALT_AD: return ALT_AD[s]
    for k in sorted(ALT_AD, key=len, reverse=True):
        if s.startswith(k): return ALT_AD[k]
    return s


def tur(p):
    e = uzanti(p); b = os.path.basename(p)
    if '/test/' in p or '/tests/' in p or b.endswith('.test.mjs') or '/dene/' in p or b.startswith('hesap-dene'):
        return 'test'
    if e in ('md', 'txt'): return 'belge'
    if e in ('json', 'xml', 'yml', 'yaml', 'csproj') or b.startswith('.git'): return 'veri'
    return 'kod'


DIL = {'cs': 'C#', 'js': 'JavaScript', 'mjs': 'JavaScript', 'cjs': 'JavaScript', 'java': 'Java', 'py': 'Python',
       'html': 'HTML', 'css': 'CSS', 'md': 'Markdown', 'txt': 'Metin', 'json': 'JSON', 'xml': 'XML', 'yml': 'YAML',
       'csproj': 'C# proje', 'sh': 'Kabuk', 'bat': 'Windows betiği'}


def ozet(p, t):
    """Dosyanın ilk açıklaması: C# <summary>, JS / Java / CSS baş yorumu, Python belge dizgisi, başlık vb."""
    e = uzanti(p)
    s = ''
    if e == 'cs':
        aciklamalar = list(re.finditer(r'///\s*<summary>(.*?)</summary>((?:\s*///[^\n]*|\s*\[[^\n]*\])*)\s*([^\n]*)', t, re.S))
        m = next((a for a in aciklamalar if re.search(r'\b(?:class|struct|interface|enum)\s+[A-Z]', a.group(3))),
                 aciklamalar[0] if aciklamalar else None)
        if m: s = re.sub(r'\s*///\s*', ' ', m.group(1))
        if not s:
            m = re.search(r'^\s*//\s*(.+)$', t, re.M); s = m.group(1) if m else ''
    elif e in ('js', 'mjs', 'cjs', 'java', 'css'):
        m = re.match(r'\s*(?:/\*\*?(.*?)\*/|((?:\s*//[^\n]*\n)+))', t, re.S)
        if m: s = re.sub(r'^\s*(?:\*|//)\s?', '', (m.group(1) or m.group(2) or ''), flags=re.M)
    elif e == 'py':
        m = re.match(r'\s*(?:#!.*\n)?\s*(?:"""(.*?)"""|((?:\s*#[^\n]*\n)+))', t, re.S)
        if m: s = re.sub(r'^\s*#\s?', '', (m.group(1) or m.group(2) or ''), flags=re.M)
    elif e == 'md':
        satirlar = [l.strip() for l in t.split('\n')]
        h = next((l.lstrip('# ').strip() for l in satirlar if l.startswith('#')), '')
        para = next((l for l in satirlar if l and not l.startswith(('#', '|', '-', '*', '>', '```', '<'))), '')
        s = (h + ' — ' + para) if h and para else (h or para)
    elif e == 'html':
        m = re.search(r'<title>(.*?)</title>', t, re.S | re.I); s = m.group(1) if m else ''
    elif e == 'json':
        m = re.search(r'"aciklama"\s*:\s*"([^"]{8,})"', t); s = m.group(1) if m else ''
    elif e in ('yml', 'yaml'):
        m = re.search(r'^name:\s*(.+)$', t, re.M); n = m.group(1) if m else ''
        c = re.search(r'^#\s*(.+)$', t, re.M); s = (n + (' — ' + c.group(1) if c else '')).strip()
    elif e in ('txt', 'bat', 'sh'):
        s = next((re.sub(r'^(?:rem|::|#)\s*', '', l.strip(), flags=re.I) for l in t.split('\n')
                  if l.strip() and not l.strip().lower().startswith(('@echo', '#!', 'chcp', 'setlocal'))), '')
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return (s[:217] + '…') if len(s) > 220 else s


def yorumsuz(t):
    """C# / Java kodundan yorumları ve dizgileri çıkarır (tür adları yalnız koddan sayılsın)."""
    out = []; i = 0; n = len(t)
    while i < n:
        c = t[i]
        if t.startswith('//', i):
            j = t.find('\n', i); i = n if j < 0 else j; continue
        if t.startswith('/*', i):
            j = t.find('*/', i + 2); i = n if j < 0 else j + 2; out.append(' '); continue
        if c == '@' and i + 1 < n and t[i + 1] == '"':
            j = i + 2
            while j < n:
                if t[j] == '"' and j + 1 < n and t[j + 1] == '"': j += 2; continue
                if t[j] == '"': break
                j += 1
            out.append('""'); i = j + 1; continue
        if c in '"\'':
            j = i + 1
            while j < n and t[j] != c and t[j] != '\n':
                if t[j] == '\\': j += 2; continue
                j += 1
            out.append(c + c); i = j + 1; continue
        out.append(c); i += 1
    return ''.join(out)


def satir_bul(t, konum):
    a = t.rfind('\n', 0, konum) + 1; b = t.find('\n', konum)
    return t[a:b if b >= 0 else len(t)].strip()


# ---------------------------------------------------------------- çözümleme
def dosya_listesi():
    """Haritaya giren dosyalar: git'teki metin dosyaları (ikili, harita ve Claude ayarları hariç)."""
    dosyalar = [f for f in subprocess.check_output(['git', '-C', KOK, 'ls-files'], text=True).split('\n') if f]
    return [f for f in dosyalar if uzanti(f) not in IKILI and os.path.basename(f) != '.gitignore'
            and f not in HARIC and not f.startswith(HARIC_KLASOR) and os.path.exists(os.path.join(KOK, f))]


def liste_izi(dosyalar):
    """Dosya listesinin izi; HARITA.md'nin sonuna yazılır, kanca.py haritanın eskiyip eskimediğine buna bakar."""
    return hashlib.sha1('\n'.join(sorted(dosyalar)).encode('utf-8')).hexdigest()[:16]


IZ_RE = re.compile(r'<!-- dosya-listesi: ([0-9a-f]+) -->')


def cozumle():
    global nx
    try:
        import networkx
    except ImportError:
        sys.exit('networkx gerekli: pip install networkx')
    nx = networkx
    dosyalar = dosya_listesi()
    fset = set(dosyalar)
    metin = {f: oku(f) for f in dosyalar}

    tur_re = re.compile(r'\b(class|struct|interface|enum)\s+([A-Z][A-Za-z0-9_]*)')
    turler = collections.defaultdict(set)  # tür adı -> tanımlandığı dosyalar
    temiz = {}
    for f in dosyalar:
        if uzanti(f) not in ('cs', 'java'): continue
        s = yorumsuz(metin[f]); temiz[f] = s
        derinlik = 0; son = 0
        for m in tur_re.finditer(s):  # ad alanı içinde 1 (C#), paket düzeyinde 0 (Java): iç içe türler sayılmaz
            derinlik += s.count('{', son, m.start()) - s.count('}', son, m.start()); son = m.start()
            if derinlik <= (1 if uzanti(f) == 'cs' else 0): turler[m.group(2)].add(f)

    kenarlar = collections.defaultdict(lambda: {'w': 0.0, 'rel': set(), 'kanit': []})

    def ekle(a, b, iliski, w=1.0, kanit=None):
        if a == b or a is None or b is None: return
        e = kenarlar[(a, b)]
        e['w'] += w; e['rel'].add(iliski)
        if kanit and len(e['kanit']) < 3 and kanit not in e['kanit']: e['kanit'].append(kanit[:160])

    def coz(taban, yol):
        if not yol.startswith('.'): return None
        p = os.path.normpath(os.path.join(os.path.dirname(taban), yol)).replace('\\', '/')
        for c in (p, p + '.js', p + '.mjs', p + '.cjs', p + '.json', p + '/index.js'):
            if c in fset: return c
        return None

    # 1) JavaScript içe aktarımları
    imp = re.compile(r'''(?:\bimport|\bexport)\s+(?:[\w*{}\s,$]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)''')
    for f in dosyalar:
        if uzanti(f) not in ('js', 'mjs', 'cjs', 'html'): continue
        for m in imp.finditer(metin[f]):
            r = coz(f, m.group(1) or m.group(2) or m.group(3))
            if r: ekle(f, r, 'içe aktarır', 1.0, satir_bul(metin[f], m.start()))
    # 2) HTML / CSS yerel bağlantıları
    for f in dosyalar:
        if uzanti(f) not in ('html', 'css'): continue
        for m in re.finditer(r'''(?:src|href)\s*=\s*["']([^"'#?:]+)["']|url\(\s*['"]?([^'")?#:]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]''', metin[f]):
            yol = m.group(1) or m.group(2) or m.group(3)
            if not yol: continue
            r = coz(f, yol if yol.startswith('.') else './' + yol)
            if r: ekle(f, r, 'yükler', 0.8, satir_bul(metin[f], m.start()))
    # 3) C# / Java tür kullanımı (yorum ve dizgiler hariç)
    ad_re = re.compile(r'\b[A-Z][A-Za-z0-9_]*\b')
    for f, s in temiz.items():
        hedef = collections.defaultdict(list)
        for ad, c in collections.Counter(ad_re.findall(s)).items():
            tanimlar = turler.get(ad)
            if not tanimlar or f in tanimlar or len(tanimlar) > 3: continue
            for d in tanimlar:
                if uzanti(d) == uzanti(f): hedef[d].append((ad, c))
        for d, ls in hedef.items():
            ls.sort(key=lambda x: -x[1])
            ekle(f, d, 'türünü kullanır', min(3.0, sum(1 + math.log(c) for _, c in ls) * 0.5),
                 ', '.join(a + (' ×' + str(c) if c > 1 else '') for a, c in ls[:6]))
    # 4) SH_ komutları: tanım (CommandMethod) ve anma (şerit, rehber, belgeler)
    komutlar = {}
    for f in dosyalar:
        if uzanti(f) != 'cs': continue
        for m in re.finditer(r'CommandMethod\(\s*"(SH_[A-Z0-9_]+)"', metin[f]):
            komutlar['cmd:' + m.group(1)] = f
    komut_re = re.compile(r'\b_?(SH_[A-Z0-9_]+)\b')
    for f in dosyalar:
        goruldu = set()
        for m in komut_re.finditer(metin[f]):
            k = 'cmd:' + m.group(1)
            if k not in komutlar or k in goruldu: continue
            goruldu.add(k)
            if komutlar[k] == f: ekle(f, k, 'komutu tanımlar', 1.5, satir_bul(metin[f], m.start()))
            else: ekle(f, k, 'komutu anar', 0.6, satir_bul(metin[f], m.start()))
    for k, f in komutlar.items():
        if (f, k) not in kenarlar: ekle(f, k, 'komutu tanımlar', 1.5)
    # 5) Dosya yolu ve adı anmaları (yorumlar, belgeler, derleme adımları dâhil)
    adlar = collections.defaultdict(list)
    for f in dosyalar: adlar[os.path.basename(f)].append(f)
    genel = {'index.html', 'README.md', 'main.js', 'kit.js', 'app.js', 'style.css', 'Program.cs', 'package.json',
             'package-lock.json', 'styles.xml', 'colors.xml', 'strings.xml', 'ic_launcher.xml', 'ic_launcher_round.xml'}
    tekil = {b: ps[0] for b, ps in adlar.items() if len(ps) == 1 and len(b) >= 7 and b not in genel}
    yol_re = re.compile('(?<![\\w/.-])(' + '|'.join(re.escape(f) for f in sorted(dosyalar, key=len, reverse=True)) + ')(?![\\w-])')
    tekil_re = re.compile('(?<![\\w/.-])(' + '|'.join(re.escape(b) for b in sorted(tekil, key=len, reverse=True)) + ')(?![\\w-])')
    for f in dosyalar:
        t = metin[f].replace('\\', '/')
        goruldu = set()
        for m in yol_re.finditer(t):
            r = m.group(1)
            if r == f or r in goruldu: continue
            goruldu.add(r); ekle(f, r, 'yolunu anar', 0.7, satir_bul(t, m.start()))
        for m in tekil_re.finditer(t):
            r = tekil[m.group(1)]
            if r == f or r in goruldu: continue
            goruldu.add(r); ekle(f, r, 'adını anar', 0.6, satir_bul(t, m.start()))
    # 6) C# tür adlarının başka dillerde anılması (platformlar arası "aynı kural" yorumları). Tek kelimelik adlar
    # (Katalog, Geometri) sıradan Türkçe kelimelerle karışır: yalnız "Ad.Uye" biçiminde sayılır.
    cs_turleri = {ad: list(fs) for ad, fs in turler.items()
                  if len(ad) >= 7 and len(fs) == 1 and uzanti(next(iter(fs))) == 'cs'}
    bilesik = [a for a in cs_turleri if len(re.findall(r'[A-Z]', a)) >= 2]
    tekli = [a for a in cs_turleri if a not in bilesik]
    if cs_turleri:
        desen = []
        if bilesik: desen.append(r'\b(' + '|'.join(sorted(bilesik, key=len, reverse=True)) + r')\b')
        if tekli: desen.append(r'\b(' + '|'.join(sorted(tekli, key=len, reverse=True)) + r')\.[A-Z]')
        cs_re = re.compile('|'.join(desen))
        for f in dosyalar:
            if uzanti(f) == 'cs': continue
            goruldu = set()
            for m in cs_re.finditer(metin[f]):
                ad = next(g for g in m.groups() if g)
                d = cs_turleri[ad][0]
                if d in goruldu: continue
                goruldu.add(d); ekle(f, d, 'türünü anar', 0.6, satir_bul(metin[f], m.start()))
    # 7) JavaScript'in dışa aktardığı adların C# / Java / belge / Python içinde anılması
    js_adlar = collections.defaultdict(set)
    for f in dosyalar:
        if uzanti(f) not in ('js', 'mjs', 'cjs'): continue
        for m in re.finditer(r'\bexport\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)', metin[f]):
            ad = m.group(1)
            if len(ad) >= 8 and re.search(r'[a-z][A-Z]', ad): js_adlar[ad].add(f)
    js_tekil = {a: next(iter(fs)) for a, fs in js_adlar.items() if len(fs) == 1}
    if js_tekil:
        js_re = re.compile(r'\b(' + '|'.join(sorted(js_tekil, key=len, reverse=True)) + r')\b')
        for f in dosyalar:
            if uzanti(f) not in ('cs', 'java', 'md', 'py', 'txt', 'yml'): continue
            t = metin[f]
            if uzanti(f) in ('cs', 'java'): t = re.sub(r'@"(?:""|[^"])*"|"(?:\\.|[^"\\\n])*"', '""', t)
            goruldu = set()
            for m in js_re.finditer(t):
                d = js_tekil[m.group(1)]
                if d == f or d in goruldu: continue
                goruldu.add(d)
                satirlar = [satir_bul(metin[f], k.start()) for k in re.finditer(r'\b' + re.escape(m.group(1)) + r'\b', metin[f])]
                kanit = next((l for l in satirlar if l.lstrip().startswith(('//', '*', '/*', '#'))), satirlar[0] if satirlar else '')
                ekle(f, d, 'işlevini anar', 0.6, kanit)
    # 8) Markdown bağlantıları
    for f in dosyalar:
        if uzanti(f) != 'md': continue
        for m in re.finditer(r'\[[^\]]*\]\(([^)\s#]+)', metin[f]):
            r = coz(f, m.group(1) if m.group(1).startswith('.') else './' + m.group(1))
            if r: ekle(f, r, 'bağlantı verir', 0.8, satir_bul(metin[f], m.start()))
    # 9) Hesap modülü zinciri: özgün sayfa ← uyarlama / biçim / deneme; moduller.json listesi
    modul_listesi = metin.get('ortak/hesap/moduller.json', '')
    for f in dosyalar:
        if not (f.startswith('ortak/hesap/kaynak/') and f.endswith('.html')): continue
        i = os.path.basename(f)[:-5]
        for d, iliski in (('ortak/hesap/uyarlama/%s.js' % i, 'uyarlar'), ('ortak/hesap/uyarlama/%s.css' % i, 'biçimler'),
                          ('ortak/hesap/dene/%s.json' % i, 'dener')):
            if d in fset: ekle(d, f, iliski, 1.2)
        if re.search(r'"id"\s*:\s*"%s"' % re.escape(i), modul_listesi): ekle('ortak/hesap/moduller.json', f, 'listeler', 0.8)

    # ---------------------------------------------------------------- çizge ve ölçüler
    dugumler = {}
    for f in dosyalar:
        t = metin[f]
        dugumler[f] = {'id': f, 'ad': os.path.basename(f), 'yol': f, 'bolum': bolum(f), 'alt': alt_bolum(f),
                       'altAd': alt_ad(alt_bolum(f)), 'tur': tur(f), 'dil': DIL.get(uzanti(f), uzanti(f).upper() or 'Dosya'),
                       'satir': t.count('\n') + (1 if t and not t.endswith('\n') else 0), 'ozet': ozet(f, t)}
    for k, f in komutlar.items():
        dugumler[k] = {'id': k, 'ad': k[4:], 'yol': f, 'bolum': 'autocad', 'alt': 'komut', 'altAd': 'AutoCAD komutu',
                       'tur': 'komut', 'dil': 'Komut', 'satir': 0, 'ozet': 'AutoCAD komutu; ' + os.path.basename(f) + ' içinde tanımlı.'}
    G = nx.Graph()
    G.add_nodes_from(dugumler)
    for (a, b), e in kenarlar.items():
        if a not in dugumler or b not in dugumler: continue
        if G.has_edge(a, b): G[a][b]['weight'] += e['w']
        else: G.add_edge(a, b, weight=e['w'])
    kumeler = sorted(nx.community.louvain_communities(G, weight='weight', resolution=1.0, seed=7), key=len, reverse=True)
    kume = {n: i for i, c in enumerate(kumeler) for n in c}
    derece = dict(G.degree())
    agirlik = dict(G.degree(weight='weight'))
    kopruluk = nx.betweenness_centrality(G, weight=None, seed=7, k=min(300, G.number_of_nodes()))
    for n, d in dugumler.items():
        d['derece'] = derece[n]; d['topluluk'] = kume[n]; d['kopruluk'] = round(kopruluk[n], 4)

    topluluklar = []
    kullanilan = collections.Counter()
    for i, c in enumerate(kumeler):
        uyeler = sorted(c, key=lambda n: (-derece[n], n))
        say = collections.Counter(dugumler[n]['altAd'] for n in c if dugumler[n]['tur'] != 'komut') or \
            collections.Counter(dugumler[n]['altAd'] for n in c)
        ad = say.most_common(1)[0][0]
        if len(say) > 1 and say.most_common(2)[1][1] >= 0.6 * say.most_common(1)[0][1]: ad += ' + ' + say.most_common(2)[1][0]
        kullanilan[ad] += 1
        if kullanilan[ad] > 1: ad += ' (' + dugumler[uyeler[0]]['ad'] + ')'
        topluluklar.append({'id': i, 'ad': ad, 'boyut': len(c), 'merkez': uyeler[0], 'ilk': uyeler[:4],
                            'bolumler': dict(collections.Counter(dugumler[n]['bolum'] for n in c))})

    sirali = sorted(G.nodes, key=lambda n: (-derece[n], -agirlik[n], n))
    capraz = sorted(({'a': a, 'b': b, 'rel': sorted(e['rel']), 'kanit': e['kanit'][:2]} for (a, b), e in kenarlar.items()
                     if a in dugumler and b in dugumler and {dugumler[a]['bolum'], dugumler[b]['bolum']} == {'autocad', 'telefon'}),
                    key=lambda x: (x['a'], x['b']))
    tarih = subprocess.check_output(['git', '-C', KOK, 'log', '-1', '--format=%cI', '--', '.', ':!HARITA.md', ':!CLAUDE.md'], text=True).strip()
    return {
        'G': G, 'kenarHam': kenarlar, 'komutlar': komutlar,
        'uretim': {'kok': os.path.basename(KOK), 'tarih': tarih,
                   'islem': subprocess.check_output(['git', '-C', KOK, 'rev-parse', '--short', 'HEAD'], text=True).strip()},
        'ozet': {'dosya': len(dosyalar), 'komut': len(komutlar), 'dugum': G.number_of_nodes(), 'kenar': G.number_of_edges(),
                 'topluluk': len(kumeler), 'satir': sum(dugumler[f]['satir'] for f in dosyalar),
                 'yalniz': sum(1 for n in G.nodes if derece[n] == 0)},
        'dugumler': dugumler, 'topluluklar': topluluklar,
        'rapor': {'merkez': sirali[:12], 'kopru': sorted(G.nodes, key=lambda n: (-kopruluk[n], n))[:10], 'capraz': capraz,
                  'yalniz': sorted(n for n in G.nodes if derece[n] == 0),
                  'merkezKod': [n for n in sirali if dugumler[n]['tur'] in ('kod', 'test')][:12],
                  'merkezBelge': [n for n in sirali if dugumler[n]['tur'] == 'belge'][:6],
                  'merkezKomut': [n for n in sirali if dugumler[n]['tur'] == 'komut'][:6]},
    }


# ---------------------------------------------------------------- HARITA.md
def kisalt(s, n):
    s = re.sub(r'\s+', ' ', s or '').strip()
    return s if len(s) <= n else s[:n - 1].rstrip() + '…'


def yorum_temizle(s):
    return re.sub(r'^\s*(?:///|//|/\*\*|/\*|\*|#|<!--)\s*', '', s or '').replace('*/', '').strip()


def hucre(s):
    return s.replace('|', '\\|')


def harita_md(v):
    D, G = v['dugumler'], v['G']
    ad = lambda n: D[n]['ad']
    sayi = lambda x: '{:,}'.format(x).replace(',', '.')
    o = v['ozet']
    s = []
    y = s.append
    y('# Kod haritası')
    y('')
    # Tarih ve işlem numarası yazılmaz: harita yalnız kod değişince değişsin.
    y('Otomatik üretilir, elle düzenlenmez: `python3 araclar/kod-haritasi/kod_haritasi.py` (%s dosya · %s AutoCAD komutu ·'
      % (sayi(o['dosya']), sayi(o['komut'])))
    y('%s bağ). Dosya, komut ya da konu ararken önce burada arayın (`grep -i "kelime" HARITA.md`).' % sayi(o['kenar']))
    y('Bağlar dosyaların içinden çıkarılır: içe aktarma, tür kullanımı, komut tanımı, belge bağlantısı, dosya / tür adı')
    y('anma. Ad anmasına dayanan birkaç bağ yanlış olabilir; bir dosyayı değiştirmeden önce kendisini okuyun.')
    y('')

    # 1. platformlar arası eşler
    ciftler = collections.OrderedDict()
    for c in v['rapor']['capraz']:
        a, b = (c['a'], c['b']) if D[c['a']]['bolum'] == 'autocad' else (c['b'], c['a'])
        ciftler.setdefault((a, b), []).extend(c['kanit'])
    y('## 1. İki platformda aynı kural')
    y('')
    y('Bu dosyalar aynı kuralı AutoCAD eklentisinde ve telefonda ayrı ayrı uygular: birini değiştirirseniz ötekini de')
    y('değiştirin ve iki tarafın denemelerini çalıştırın (`CekirdekTest`, `telefon/web/tests`).')
    y('')
    y('| AutoCAD | Telefon | Eşleşmeyi gösteren satır |')
    y('| --- | --- | --- |')
    for (a, b), kanitlar in ciftler.items():
        kanit = next((yorum_temizle(k) for k in kanitlar if yorum_temizle(k)), '')
        y('| `%s` | `%s` | %s |' % (a, b, hucre(kisalt(kanit, 120))))
    y('')

    # 2. merkez ve köprü dosyalar
    y('## 2. Değişince en çok yeri etkileyenler')
    y('')
    kod = v['rapor']['merkezKod'][:12]
    y('Kod (bağ sayısı): ' + ', '.join('`%s` %d' % (D[n]['yol'], D[n]['derece']) for n in kod) + '.')
    y('')
    y('Belgeler (kodu en çok anan; kod değişince bakılır): ' +
      ', '.join('`%s` %d' % (D[n]['yol'], D[n]['derece']) for n in v['rapor']['merkezBelge'][:5]) + '.')
    y('')
    kopru = [n for n in v['rapor']['kopru'] if D[n]['tur'] != 'belge'][:6]
    y('Köprüler (kümeler arası yolların çoğu buradan geçer): ' +
      ', '.join('`%s` %%%s' % (D[n]['yol'], ('%.1f' % (D[n]['kopruluk'] * 100)).replace('.', ',')) for n in kopru) + '.')
    y('')

    # 3. komutlar
    y('## 3. AutoCAD komutları')
    y('')
    y('| Komut | Tanımlandığı dosya | Anıldığı yerler |')
    y('| --- | --- | --- |')
    for k in sorted(v['komutlar']):
        tanim = v['komutlar'][k]
        anan = sorted((n for n in G.neighbors(k) if n != tanim), key=lambda n: (-G[k][n]['weight'], ad(n)))
        y('| `%s` | `%s` | %s |' % (k[4:], tanim, hucre(', '.join(ad(n) for n in anan[:5]) or '—')))
    y('')

    # 4. dosya dizini
    y('## 4. Dosyalar')
    y('')
    y('Biçim: `yol` — ne işe yaradığı · satır · bağ · en sıkı bağlı olduğu dosyalar. Bağsız dosyaların adı başka hiçbir')
    y('dosyada geçmez (Android ayarları gibi bazıları yine de kullanılır).')
    # Hesap Merkezi modülleri (kaynak/<id>.html + uyarlama/<id>.js|css + dene/<id>.json) tek tabloda gösterilir.
    modul_re = re.compile(r'^ortak/hesap/(kaynak|uyarlama|dene)/([^/]+)\.(html|js|css|json)$')
    moduller = collections.defaultdict(dict)
    for n in D:
        m = modul_re.match(n)
        if m: moduller[m.group(2)][m.group(1) + '.' + m.group(3)] = n
    moduller = {i: p for i, p in moduller.items() if 'kaynak.html' in p}
    modul_dosyasi = {n for p in moduller.values() for n in p.values()}
    MODUL = 'ortak/hesap/(modüller)'
    sira = {'autocad': 0, 'ortak': 1, 'telefon': 2, 'diger': 3}
    gruplar = collections.defaultdict(list)
    for n, d in D.items():
        if d['tur'] != 'komut' and n not in modul_dosyasi: gruplar[d['alt']].append(n)
    if moduller: gruplar[MODUL] = ['ortak/hesap/moduller.json']
    for alt in sorted(gruplar, key=lambda a: (sira[D[gruplar[a][0]]['bolum']], a)):
        y('')
        if alt == MODUL:
            y('### Hesap Merkezi modülleri — `ortak/hesap/kaynak|uyarlama|dene`')
            y('')
            y('Her hesap: `kaynak/<id>.html` (aracın özgün sayfası, formüllere dokunulmaz), `uyarlama/<id>.js|css`')
            y('(Şebeke-M uyarlaması: bağlam → alanlar, sonuç okuma, kayıt), `dene/<id>.json` (deneme durumları; koşucu')
            y('`araclar/hesap-dene.py`). Liste ve gruplar `ortak/hesap/moduller.json`; sözleşme `ortak/hesap/BAGLAM.md`.')
            y('')
            y('| id | Hesap | Satır: kaynak · uyarlama js / css · dene |')
            y('| --- | --- | --- |')
            for i in sorted(moduller):
                p = moduller[i]
                st = lambda k: sayi(D[p[k]]['satir']) if k in p else '—'
                y('| `%s` | %s | %s · %s / %s · %s |' % (i, hucre(kisalt(D[p['kaynak.html']]['ozet'], 70)), st('kaynak.html'),
                                                       st('uyarlama.js'), st('uyarlama.css'), st('dene.json')))
            continue
        y('### %s — `%s`' % (alt_ad(alt), alt if alt != '(kök)' else 'kök'))
        y('')
        for n in sorted(gruplar[alt]):
            d = D[n]
            parca = ['- `%s`' % n]
            if d['ozet']: parca.append(' — ' + kisalt(d['ozet'], 100))
            parca.append(' · %s satır' % sayi(d['satir']))
            if d['derece']:
                komsu = sorted(G.neighbors(n), key=lambda m: (D[m]['tur'] == 'belge', -G[n][m]['weight'], ad(m)))[:3]
                parca.append(' · %d bağ · %s' % (d['derece'], ', '.join(ad(m) for m in komsu)))
            else:
                parca.append(' · bağsız')
            y(''.join(parca))
    y('')
    y('<!-- dosya-listesi: %s -->' % liste_izi([n for n in D if D[n]['tur'] != 'komut']))
    y('')
    return '\n'.join(s)


# ---------------------------------------------------------------- etkileşimli sayfa
def yerlesim(v):
    """Ana bileşen kuvvet yönlendirmeli (topluluklar çember üzerinde başlar), uzun ekseni yatay; düğümler sayfadaki
    çizim ölçüsünde çakışmasın diye aralanır. Küçük bileşenler ve bağsız dosyalar ana kümenin altına dizilir."""
    import numpy as np
    G, D = v['G'], v['dugumler']
    derece = dict(G.degree())
    rng = np.random.default_rng(7)
    bilesenler = sorted(nx.connected_components(G), key=len, reverse=True)
    ana = G.subgraph(bilesenler[0]).copy()
    kumeler = collections.defaultdict(set)
    for n in ana.nodes: kumeler[D[n]['topluluk']].add(n)
    baslangic = {}
    for i, c in enumerate(sorted(kumeler.values(), key=len, reverse=True)):
        aci = 2 * math.pi * i / max(1, len(kumeler)); r = 0.55 if len(c) > 3 else 0.95
        for n in sorted(c): baslangic[n] = (r * math.cos(aci) + rng.normal(0, 0.07), r * math.sin(aci) + rng.normal(0, 0.07))
    pos = nx.spring_layout(ana, pos=baslangic, weight=None, k=1.7 / math.sqrt(ana.number_of_nodes()), iterations=900, seed=7)
    sira = list(ana.nodes)
    P = np.array([pos[n] for n in sira], dtype=float)
    P -= P.mean(0)
    _, _, vt = np.linalg.svd(P, full_matrices=False)
    P = P @ vt.T

    def ort(b, eksen):
        m = [i for i, n in enumerate(sira) if D[n]['bolum'] == b]
        return P[m, eksen].mean() if m else 0.0
    if ort('autocad', 0) > ort('telefon', 0): P[:, 0] *= -1
    if ort('ortak', 1) < ort('telefon', 1): P[:, 1] *= -1
    gen, yuk = np.ptp(P[:, 0]), np.ptp(P[:, 1])
    if gen < 1.35 * yuk: P[:, 0] *= 1.35 * yuk / gen
    P *= 2000 / max(np.ptp(P[:, 0]), np.ptp(P[:, 1]))
    yaricap = np.array([min(15, 2.5 + 1.9 * math.sqrt(max(1, derece[n]))) for n in sira])  # sayfadaki yaricap()
    for _ in range(5):
        k = min((950 - 88) / np.ptp(P[:, 0]), (680 - 88) / np.ptp(P[:, 1]))
        R = (yaricap * max(0.55, min(1.6, math.sqrt(k / 0.42))) + 3) / k
        for _ in range(500):
            d = P[:, None, :] - P[None, :, :]
            uzak = np.sqrt((d ** 2).sum(-1)) + 1e-9
            cakisma = np.clip(R[:, None] + R[None, :] - uzak, 0, None); np.fill_diagonal(cakisma, 0)
            if cakisma.max() < 0.5: break
            P += ((d / uzak[..., None]) * (cakisma[..., None] * 0.5)).sum(1) * 0.5
    P -= (P.max(0) + P.min(0)) / 2
    for i, n in enumerate(sira):
        D[n]['x'] = round(float(P[i, 0]), 1); D[n]['y'] = round(float(P[i, 1]), 1); D[n]['ana'] = True
    sol, sag = float(P[:, 0].min()), float(P[:, 0].max())
    taban = float(P[:, 1].max()) + 220
    x0, satir_yuk = sol, 0
    for bil in bilesenler[1:]:
        if len(bil) < 2: continue
        pp = nx.spring_layout(G.subgraph(bil), seed=7, k=0.9)
        kutu = 70 * math.sqrt(len(bil)) + 40
        xs = [p[0] for p in pp.values()]; ys = [p[1] for p in pp.values()]
        olc = (kutu - 40) / max(1e-6, max(max(xs) - min(xs), max(ys) - min(ys)))
        if x0 + kutu > sag: x0 = sol; taban += satir_yuk + 60; satir_yuk = 0
        for n, p in pp.items():
            D[n]['x'] = round(x0 + 20 + (p[0] - min(xs)) * olc, 1); D[n]['y'] = round(taban + 20 + (p[1] - min(ys)) * olc, 1)
            D[n]['ana'] = False
        x0 += kutu + 40; satir_yuk = max(satir_yuk, kutu)
    taban += satir_yuk + 100
    sutun = max(1, int((sag - sol) // 90))
    for i, n in enumerate(sorted((n for n in D if derece[n] == 0), key=lambda n: D[n]['yol'])):
        D[n]['x'] = round(sol + (i % sutun) * 90, 1); D[n]['y'] = round(taban + (i // sutun) * 80, 1); D[n]['ana'] = False


def sayfa(v, cikti):
    yerlesim(v)
    veri = {'uretim': v['uretim'], 'ozet': v['ozet'], 'dugumler': list(v['dugumler'].values()),
            'kenarlar': [{'s': a, 't': b, 'rel': sorted(e['rel']), 'w': round(e['w'], 2), 'kanit': e['kanit']}
                         for (a, b), e in sorted(v['kenarHam'].items()) if a in v['dugumler'] and b in v['dugumler']],
            'topluluklar': v['topluluklar'], 'rapor': v['rapor']}
    # Gömülü JSON'da "<" yazılmaz: </script> ya da <!-- dizisi sayfayı bozamasın.
    metin = json.dumps(veri, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    with open(os.path.join(BURASI, 'sayfa.html'), encoding='utf-8') as fh:
        sablon = fh.read()
    with open(cikti, 'w', encoding='utf-8') as fh:
        fh.write(sablon.replace('__VERI__', metin))


def main():
    ap = argparse.ArgumentParser(description='Şebeke-M kod haritası: HARITA.md ve isteğe bağlı etkileşimli sayfa.')
    ap.add_argument('--sayfa', metavar='HTML', help='etkileşimli harita sayfasını bu dosyaya da yaz (numpy gerekir)')
    ap.add_argument('--cikti', metavar='MD', default=os.path.join(KOK, 'HARITA.md'), help='HARITA.md yolu')
    a = ap.parse_args()
    v = cozumle()
    with open(a.cikti, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(harita_md(v))
    o = v['ozet']
    print('%s yazıldı: %d dosya, %d komut, %d bağ, %d bağsız.' % (os.path.relpath(a.cikti), o['dosya'], o['komut'], o['kenar'], o['yalniz']))
    if a.sayfa:
        sayfa(v, a.sayfa)
        print('%s yazıldı.' % a.sayfa)


if __name__ == '__main__':
    main()
