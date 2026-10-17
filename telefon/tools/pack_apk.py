#!/usr/bin/env python3
"""Merge aapt2 base apk + classes.dex (+ extra files) into an aligned unsigned APK.
Stored entries are 4-byte aligned (resources.arsc must be stored + aligned for targetSdk>=30)."""
import sys, zipfile, struct, zlib, os

def write_aligned(out_path, entries):
    # entries: list of (name, bytes, compress:bool)
    with open(out_path, 'wb') as f:
        cd = []
        for name, data, compress in entries:
            nb = name.encode('utf-8')
            crc = zlib.crc32(data) & 0xffffffff
            if compress:
                co = zlib.compressobj(9, zlib.DEFLATED, -15)
                cdata = co.compress(data) + co.flush()
                method = 8
            else:
                cdata = data; method = 0
            off = f.tell()
            extra = b''
            if method == 0:
                align = 4096 if name.endswith('.so') else 4
                data_start = off + 30 + len(nb)
                pad = (-data_start) % align
                if pad:
                    # use padding extra field id 0xD935 (android zipalign style)
                    if pad < 4: pad += align
                    extra = struct.pack('<HH', 0xD935, pad - 4) + b'\0' * (pad - 4)
            dostime, dosdate = 0, (2008-1980)<<9 | 1<<5 | 1
            hdr = struct.pack('<IHHHHHIIIHH', 0x04034b50, 20 if method==8 else 10, 0x0800, method, dostime, dosdate, crc, len(cdata), len(data), len(nb), len(extra))
            f.write(hdr + nb + extra + cdata)
            cd.append((nb, method, crc, len(cdata), len(data), off, dostime, dosdate))
        cd_off = f.tell()
        for nb, method, crc, csz, usz, off, t, d in cd:
            f.write(struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20 if method==8 else 10, 0x0800, method, t, d, crc, csz, usz, len(nb), 0, 0, 0, 0, 0, off) + nb)
        cd_size = f.tell() - cd_off
        f.write(struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, len(cd), len(cd), cd_size, cd_off, 0))

def main():
    base, dexdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    extra_dirs = sys.argv[4:]  # prefix=dir pairs
    entries = []
    names = set()
    with zipfile.ZipFile(base) as z:
        for info in z.infolist():
            data = z.read(info.filename)
            store = info.filename == 'resources.arsc' or info.compress_type == 0
            entries.append((info.filename, data, not store)); names.add(info.filename)
    for fn in sorted(os.listdir(dexdir)):
        if fn.endswith('.dex'):
            entries.append((fn, open(os.path.join(dexdir, fn), 'rb').read(), True))
    no_compress = ('.png', '.jpg', '.woff2', '.gz', '.zip', '.mp4')
    for pair in extra_dirs:
        prefix, d = pair.split('=', 1)
        for root, _, files in os.walk(d):
            for fn in sorted(files):
                p = os.path.join(root, fn)
                rel = prefix + os.path.relpath(p, d).replace(os.sep, '/')
                if rel in names: continue
                entries.append((rel, open(p, 'rb').read(), not fn.lower().endswith(no_compress)))
    # AndroidManifest first
    entries.sort(key=lambda e: (e[0] != 'AndroidManifest.xml',))
    write_aligned(out, entries)
    print('packed', out, len(entries), 'entries', os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    main()
