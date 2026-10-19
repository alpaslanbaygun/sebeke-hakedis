"""
AutoCAD olmadan bir şebeke çizimini (DWG) eklentinin döküm biçimine çevirir.

Kullanım:
  1) LibreDWG ile DWG'yi JSON'a çevirin:   dwgread -O JSON -o cizim.json cizim.dwg
  2) Bu betikle dökümü üretin:             python3 dwg_dokum.py cizim.json cizim_dokum.json
  3) Çekirdekle rapor/proje dosyası:       dotnet run --project autocad/test/CekirdekTest -- dogrula ...

Notlar (LibreDWG 0.13.3 JSON çıktısının iki kusuru burada düzeltilir):
  - U+0080..U+00FF karakterleri (Ö, Ü, Ç, ³) UTF-8 yerine tek bayt yazılıyor → Latin-1 olarak geri çevrilir.
  - 3 baytlık tanıtıcılar (handle) 16 bite kırpılıyor → nesne sırası ve çizimin GIS alanındaki
    kendi tanıtıcısı kullanılarak gerçek değerler yeniden kurulur.
"""
import json
import math
import re
import sys

XDATA_ALANLARI = {'GIS', 'NIT', 'MALZEME', 'HAT', 'KONTROL', 'REG', 'FULLREG', 'HAKNO', 'ZKOORD',
            'ANAKESIT', 'ETK', 'HANDLE', 'BOYUT', 'START', 'END', 'UZ'}


def oku(yol):
    ham = open(yol, 'rb').read().decode('utf-8', errors='surrogateescape')
    ham = re.sub('[\udc80-\udcff]', lambda m: chr(ord(m.group(0)) - 0xdc00), ham)
    return json.loads(ham)


def ref(r):
    return r[-1] if r else None


def main(girdi, cikti):
    veri = oku(girdi)
    nesneler = veri['OBJECTS']
    appid = {o['handle'][-1]: o.get('name') for o in nesneler if o.get('object') == 'APPID'}
    katman = {o['handle'][-1]: o.get('name') for o in nesneler if o.get('object') == 'LAYER'}

    def eed(o):
        d, cur = {}, None
        for e in o.get('eed', []) or []:
            if 'handle' in e:
                cur = appid.get(e['handle'][-1], str(e['handle'][-1]))
            d.setdefault(cur, []).append(e.get('value'))
        return d

    # Gerçek tanıtıcıları kur
    onceki, yuksek = -1, 0
    for o in nesneler:
        h = o.get('handle')
        if not h:
            continue
        boy, v = h[1], h[-1]
        capa = None
        if o.get('eed'):
            g = eed(o).get('GIS')
            if g and isinstance(g[0], str):
                try:
                    t = int(g[0].split(';')[0], 16)
                    if (t & 0xFFFF) == v:
                        capa = t
                except ValueError:
                    pass
        if capa is not None:
            gercek, yuksek = capa, capa >> 16
        elif boy <= 2:
            gercek = v
        else:
            yuksek = max(yuksek, 1)
            gercek = yuksek * 65536 + v
            if gercek <= onceki:
                yuksek += 1
                gercek = yuksek * 65536 + v
        o['_h'] = gercek
        onceki = gercek

    for i, o in enumerate(nesneler):
        o['_i'] = i
    kirpik = {}
    for i, o in enumerate(nesneler):
        if '_h' in o:
            kirpik.setdefault(o['_h'] & 0xFFFF, []).append((i, o))
    blok = {o['handle'][-1]: o.get('name') for o in nesneler if o.get('object') == 'BLOCK_HEADER'}

    def coz(r, yakin, tur):
        v = ref(r)
        if v is None:
            return None
        en = None
        for i, c in kirpik.get(v & 0xFFFF, []):
            if (c.get('entity') or c.get('object')) != tur:
                continue
            d = abs(i - yakin['_i'])
            if en is None or d < en[0]:
                en = (d, c)
        return en[1] if en else None

    kayitlar, etiketler, tanitici = [], set(), {}
    for o in nesneler:
        if '_h' in o:
            tanitici[format(o['_h'], 'X')] = o
    for o in nesneler:
        t = o.get('entity')
        if t not in ('INSERT', 'POLYLINE_2D', 'LWPOLYLINE', 'TEXT', 'MTEXT'):
            continue
        xd = {a: [str(v) for v in vs] for a, vs in eed(o).items() if a in XDATA_ALANLARI}
        if not xd:
            continue
        r = {'h': format(o['_h'], 'X'), 'tur': {'POLYLINE_2D': 'POLYLINE'}.get(t, t),
             'katman': katman.get(ref(o.get('layer')), '?')}
        if t == 'INSERT':
            r['blok'] = blok.get(ref(o.get('block_header')), '?')
            p = o.get('ins_pt') or [0, 0, 0]
            r['x'], r['y'], r['aci'] = round(p[0], 4), round(p[1], 4), round(o.get('rotation', 0.0), 6)
            oz = {}
            for a in o.get('attribs', []) or []:
                at = coz(a, o, 'ATTRIB')
                if at and at.get('tag'):
                    oz[at['tag']] = at.get('text_value') or ''
            r['oz'] = oz
        elif t == 'POLYLINE_2D':
            k = []
            for a in o.get('vertex', []) or []:
                vx = coz(a, o, 'VERTEX_2D')
                if vx and vx.get('point'):
                    k.append([round(vx['point'][0], 4), round(vx['point'][1], 4)])
            r['kose'], r['kapali'] = k, bool((o.get('flag') or 0) & 1)
        elif t == 'LWPOLYLINE':
            r['kose'] = [[round(p[0], 4), round(p[1], 4)] for p in (o.get('points') or [])]
            r['kapali'] = bool((o.get('flag') or 0) & 512)
        else:
            p = o.get('ins_pt') or [0, 0]
            r['x'], r['y'], r['metin'] = round(p[0], 4), round(p[1], 4), o.get('text_value') or o.get('text') or ''
        r['xd'] = xd
        kayitlar.append(r)
        for h in xd.get('ETK', []):
            etiketler.add(h.upper())

    for h in etiketler:
        o = tanitici.get(h)
        if o and o.get('entity') in ('TEXT', 'MTEXT'):
            p = o.get('ins_pt') or [0, 0]
            kayitlar.append({'h': h, 'tur': o['entity'], 'katman': katman.get(ref(o.get('layer')), '?'),
                             'x': round(p[0], 4), 'y': round(p[1], 4), 'metin': o.get('text_value') or o.get('text') or ''})

    json.dump({'bicim': 'sebeke-hakedis.cad-dokum', 'surum': 1, 'kaynak': girdi, 'varliklar': kayitlar},
              open(cikti, 'w', encoding='utf-8'), ensure_ascii=False)
    print(len(kayitlar), 'nesne yazıldı:', cikti)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
