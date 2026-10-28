#!/usr/bin/env python3
"""Claude Code kancası (PreToolUse: Glob, Grep, Bash): oturumdaki ilk dosya aramasında Claude'a kod haritasını
(HARITA.md) hatırlatır; harita depodaki dosya listesinden geri kalmışsa bunu da söyler. Başka hiçbir şey yapmaz,
aramayı engellemez. Ayar: .claude/settings.json. Elle denemek için:
    echo '{"session_id":"deneme","tool_name":"Grep","tool_input":{"pattern":"gnss"}}' | python3 araclar/kod-haritasi/kanca.py
"""
import json
import os
import re
import sys
import tempfile

sys.dont_write_bytecode = True  # depoda __pycache__ bırakma
KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # araclar/kod-haritasi/ → kök

ARAMA = re.compile(r'(?:^|[\s;&|(])(?:grep|rg|ag|ack|find|git\s+grep|git\s+ls-files)\b')


def main():
    try:
        girdi = json.load(sys.stdin)
    except ValueError:
        return
    arac = girdi.get('tool_name', '')
    giris = girdi.get('tool_input') or {}
    if arac == 'Bash' and not ARAMA.search(str(giris.get('command', ''))):
        return  # dosya araması olmayan komut
    oturum = re.sub(r'[^A-Za-z0-9_-]', '', str(girdi.get('session_id', '')))[:80] or 'oturum'
    isaret = os.path.join(tempfile.gettempdir(), 'sebeke-m-harita-' + oturum)
    if os.path.exists(isaret):
        return  # bu oturumda zaten hatırlatıldı
    harita = os.path.join(KOK, 'HARITA.md')
    if not os.path.exists(harita):
        return
    open(isaret, 'w').close()
    if 'HARITA.md' in json.dumps(giris, ensure_ascii=False):
        return  # arama zaten haritada

    metin = ('Bu depoda otomatik kod haritası var: HARITA.md. İlk üç bölümü AutoCAD ile telefonda aynı kuralı uygulayan '
             'dosya çiftlerini, değişince en çok yeri etkileyen dosyaları ve komutların tanımlandığı dosyaları verir; '
             '4. bölümde her dosya için bir satır vardır (ne işe yaradığı, satır sayısı, en sıkı bağlı dosyalar), '
             'örneğin grep -i "kelime" HARITA.md.')
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import kod_haritasi as kh
        with open(harita, encoding='utf-8') as fh:
            iz = kh.IZ_RE.search(fh.read())
        if not iz or iz.group(1) != kh.liste_izi(kh.dosya_listesi()):
            metin += (' Harita depodaki dosya listesinden geri kalmış (dosya eklenmiş ya da silinmiş); yenileme komutu: '
                      'python3 araclar/kod-haritasi/kod_haritasi.py.')
    except Exception:  # eskime denetimi yapılamazsa yalnız hatırlatma gider
        pass
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'additionalContext': metin}},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()
