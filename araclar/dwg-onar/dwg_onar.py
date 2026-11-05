"""
Değersiz genişletilmiş veri bölümü onarıcısı (DWG 2000 biçimi, AC1015).

Eklentinin 0.1.57 ve öncesi bazı nesnelere değeri olmayan uygulama bölümü yazıyordu. AutoCAD bunu sıfır uzunluklu
bölüm olarak saklar; açarken sıfırı "genişletilmiş veri bitti" sayar, arkasındaki bölümleri nesnenin kendi verisi
diye okur ve çizim açılırken çöker (ya da RECOVER nesneleri atar).

Bu araç her nesnenin genişletilmiş verisini okur; sıfır uzunluklu bölümleri (ardından kayıtlı bir uygulama adı
geliyorsa) çıkarır, nesnenin bit boyunu ve CRC'sini yeniden hesaplar ve nesneyi dosyadaki yerine yazar (yeni nesne
eskisinden kısa olduğu için hiçbir konum kaymaz, nesne haritası değişmez).

Kullanım: python3 -I dwg_onar.py bozuk.dwg onarilmis.dwg
Yalnız DWG 2000 (AC1015) biçimi; başka sürümde hiçbir şey yazmadan çıkar. Asıl dosyaya dokunmaz.
"""
import struct
import sys


def crc16(data, seed=0xC0C1):
    crc = seed
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc & 0xFFFF


class Okuyucu:
    def __init__(self, buf, bayt=0):
        self.b = buf
        self.p = bayt * 8

    def bit(self):
        v = (self.b[self.p >> 3] >> (7 - (self.p & 7))) & 1
        self.p += 1
        return v

    def bits(self, n):
        v = 0
        for _ in range(n):
            v = (v << 1) | self.bit()
        return v

    def RC(self):
        return self.bits(8)

    def RS(self):
        a = self.RC()
        return a | (self.RC() << 8)

    def RL(self):
        a = self.RS()
        return a | (self.RS() << 16)

    def BS(self):
        k = self.bits(2)
        if k == 0: return self.RS()
        if k == 1: return self.RC()
        if k == 2: return 0
        return 256

    def BL(self):
        k = self.bits(2)
        if k == 0: return self.RL()
        if k == 1: return self.RC()
        if k == 2: return 0
        raise ValueError('BL')

    def H(self):
        kod = self.bits(4)
        n = self.bits(4)
        v = 0
        for _ in range(n):
            v = (v << 8) | self.RC()
        return kod, v

    def T(self):
        n = self.BS()
        return bytes(self.RC() for _ in range(n)).decode('cp1254', errors='replace').rstrip('\x00')


def ms(b, i):
    v = 0; kay = 0; bas = i
    while True:
        w = b[i] | (b[i + 1] << 8); i += 2
        v |= (w & 0x7FFF) << kay; kay += 15
        if not w & 0x8000:
            return v, i - bas


def ms_yaz(n):
    out = bytearray()
    while True:
        w = n & 0x7FFF; n >>= 15
        if n:
            out += struct.pack('<H', w | 0x8000)
        else:
            out += struct.pack('<H', w)
            return bytes(out)


def mc(b, i, isaretli):
    v = 0; kay = 0
    while True:
        c = b[i]; i += 1
        if c & 0x80:
            v |= (c & 0x7F) << kay; kay += 7
        else:
            if isaretli:
                neg = c & 0x40
                v |= (c & 0x3F) << kay
                return (-v if neg else v), i
            v |= (c & 0x7F) << kay
            return v, i


def nesne_haritasi(b, bas, boy):
    harita = {}
    i = bas
    while i < bas + boy:
        sb = i
        size = (b[i] << 8) | b[i + 1]; i += 2
        if size == 2:
            break
        h = 0; l = 0
        while i - sb < size:
            dh, i = mc(b, i, False)
            dl, i = mc(b, i, True)
            h += dh; l += dl
            harita[h] = l
        i += 2
    return harita


def bitleri_al(b, bas_bit, son_bit):
    return [(b[p >> 3] >> (7 - (p & 7))) & 1 for p in range(bas_bit, son_bit)]


def sayi_bitleri(v, n):
    return [(v >> (n - 1 - k)) & 1 for k in range(n)]


def baytlara(bitler):
    out = bytearray((len(bitler) + 7) // 8)
    for k, x in enumerate(bitler):
        if x: out[k >> 3] |= 0x80 >> (k & 7)
    return bytes(out)


def bolumleri_oku(r, appid):
    """EED bölümleri: [(başlangıç biti, bitiş biti, uygulama, boyut)], sonlandırıcının başlangıç ve bitiş biti."""
    bolumler = []
    while True:
        bas = r.p
        es = r.BS()
        if es == 0:
            son_sifir = r.p
            try:
                kod, v = r.H()
            except IndexError:
                r.p = son_sifir
                return bolumler, bas, son_sifir
            if kod == 5 and v in appid:
                bolumler.append((bas, r.p, appid[v], 0))
                continue
            r.p = son_sifir
            return bolumler, bas, son_sifir
        kod, v = r.H()
        r.p += es * 8
        bolumler.append((bas, r.p, appid.get(v, '#%X' % v), es))


def onar(girdi, cikti):
    b = bytearray(open(girdi, 'rb').read())
    if bytes(b[:6]) != b'AC1015':
        print('Bu araç yalnız DWG 2000 (AC1015) biçimini onarır; dosya:', bytes(b[:6]))
        return 2
    n = struct.unpack_from('<i', b, 0x15)[0]
    kayit = {}
    for i in range(n):
        o = 0x19 + i * 9
        kayit[b[o]] = struct.unpack_from('<ii', b, o + 1)
    harita = nesne_haritasi(b, *kayit[2])
    # APPID adları
    appid = {}
    for h, loc in harita.items():
        sz, k = ms(b, loc)
        r = Okuyucu(b, loc + k)
        if r.BS() != 67: continue
        r.RL(); r.H()
        while True:
            es = r.BS()
            if es == 0: break
            r.H(); r.p += es * 8
        r.BL()
        appid[h] = r.T()
    onarilan = []
    for h, loc in sorted(harita.items()):
        sz, k = ms(b, loc)
        veri_bas = loc + k
        crc_dosya = b[veri_bas + sz] | (b[veri_bas + sz + 1] << 8)
        if crc16(b[loc:veri_bas + sz]) != crc_dosya:
            continue  # zaten bozuk nesneye dokunma
        r = Okuyucu(b, veri_bas)
        tur_bas = r.p
        r.BS()
        rl_bas = r.p
        bitboy = r.RL()
        r.H()
        h_son = r.p
        bolumler, sonl_bas, sonl_son = bolumleri_oku(r, appid)
        bos = [x for x in bolumler if x[3] == 0]
        if not bos:
            continue
        silinen = sum(x[1] - x[0] for x in bos)
        yeni = []
        yeni += bitleri_al(b, tur_bas, rl_bas)
        yeni += [x for bayt in struct.pack('<I', bitboy - silinen) for x in sayi_bitleri(bayt, 8)]
        yeni += bitleri_al(b, rl_bas + 32, h_son)
        for bas, son, ad, es in bolumler:
            if es: yeni += bitleri_al(b, bas, son)
        yeni += bitleri_al(b, sonl_bas, veri_bas * 8 + sz * 8)
        veri = baytlara(yeni)
        yeni_sz = len(veri)
        on = ms_yaz(yeni_sz)
        govde = on + veri
        govde += struct.pack('<H', crc16(govde))
        eski_boy = k + sz + 2
        if len(govde) > eski_boy:
            print('Nesne %X sığmadı, atlandı' % h)
            continue
        b[loc:loc + len(govde)] = govde
        onarilan.append((h, [x[2] for x in bos]))
    open(cikti, 'wb').write(bytes(b))
    print('%d nesne onarıldı' % len(onarilan))
    for h, adlar in onarilan:
        print('  %X: değersiz bölüm çıkarıldı → %s' % (h, ', '.join(adlar)))
    return 0


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    sys.exit(onar(sys.argv[1], sys.argv[2]))
