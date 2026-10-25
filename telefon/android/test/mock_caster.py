# Sahte düzeltme sunucusu (NtripTest.java ile): NTRIP v1 (ICY) ve v2 (HTTP/1.1 chunked), kaynak tablosu, RTCM3
# çerçeveleri (1005 istasyon konumu dahil), GGA kaydı. Ayrıca:
#  - /VRS_BEKLER: gerçek VRS gibi ilk GGA gelene kadar veri göndermez (GGA'sız istemci kilitlenir);
#                 v2'de parça başlığı ile verisi arasında 1,3 s bekler (kısa okuma süresinde parça çözücü sınanır)
#  - port+1: doğrudan TCP (NTRIP'siz) RTCM yayını
# Kullanım: python3 mock_caster.py <port> <süre_s>
import socket, threading, sys, base64, time, math

def crc24q(b):
    crc = 0
    for x in b:
        crc ^= x << 16
        for _ in range(8):
            crc <<= 1
            if crc & 0x1000000: crc ^= 0x1864CFB
    return crc & 0xFFFFFF

def frame_payload(p):
    h = bytes([0xD3, (len(p) >> 8) & 3, len(p) & 0xFF]) + bytes(p)
    c = crc24q(h)
    return h + bytes([(c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF])

def frame(msg_type, payload_len=20):
    p = bytearray(payload_len); p[0] = (msg_type >> 4) & 0xFF; p[1] = ((msg_type & 0xF) << 4)
    return frame_payload(p)

class Bits:
    def __init__(self): self.v = 0; self.n = 0
    def put(self, val, n):
        if val < 0: val += 1 << n
        self.v = (self.v << n) | (val & ((1 << n) - 1)); self.n += n
    def bytes(self):
        pad = (-self.n) % 8
        v = self.v << pad
        return (v).to_bytes((self.n + pad) // 8, 'big')

# Elazığ yakınında bir istasyon: enlem 38.6743, boylam 39.2232, h 1100 m (GRS80)
def ecef(lat, lon, h):
    a = 6378137.0; f = 1 / 298.257222101; e2 = f * (2 - f)
    la, lo = math.radians(lat), math.radians(lon)
    N = a / math.sqrt(1 - e2 * math.sin(la) ** 2)
    return ((N + h) * math.cos(la) * math.cos(lo), (N + h) * math.cos(la) * math.sin(lo), (N * (1 - e2) + h) * math.sin(la))

STATION_ID = 2003
X, Y, Z = ecef(38.6743, 39.2232, 1100.0)

def frame_1005():
    b = Bits()
    b.put(1005, 12); b.put(STATION_ID, 12); b.put(0, 6); b.put(1, 1); b.put(1, 1); b.put(0, 1); b.put(0, 1)
    b.put(round(X * 1e4), 38); b.put(0, 1); b.put(0, 1)
    b.put(round(Y * 1e4), 38); b.put(0, 2)
    b.put(round(Z * 1e4), 38)
    return frame_payload(b.bytes())

TABLE = "STR;VRS_RTCM32;Elazig VRS;RTCM 3.2;1004(1),1005(10),1077(1);2;GPS+GLO+GAL+BDS;TUSAGA;TUR;38.67;39.22;1;1;sNTRIP;none;B;N;9600;\r\nSTR;VRS_BEKLER;VRS GGA bekler;RTCM 3.2;1077(1);2;GPS;TUSAGA;TUR;38.60;39.25;1;1;sNTRIP;none;B;N;4800;\r\nENDSOURCETABLE\r\n"
log = []

def paket():
    return frame_1005() + frame(1077, 60) + frame(1087, 50)

def handle(c):
    data = b''
    while b'\r\n\r\n' not in data:
        d = c.recv(4096)
        if not d: return
        data += d
    head = data.split(b'\r\n\r\n')[0].decode()
    rest = data.split(b'\r\n\r\n', 1)[1]
    line = head.split('\r\n')[0]; path = line.split()[1]; v2 = 'Ntrip-Version: Ntrip/2.0' in head
    auth = [h for h in head.split('\r\n') if h.startswith('Authorization')]
    ntrip_gga = [h for h in head.split('\r\n') if h.startswith('Ntrip-GGA')]
    log.append(('req', line, v2, auth[0] if auth else None, ntrip_gga))
    if path == '/':
        body = TABLE.encode()
        if v2: c.sendall(b'HTTP/1.1 200 OK\r\nContent-Type: gnss/sourcetable\r\nContent-Length: %d\r\n\r\n' % len(body) + body)
        else: c.sendall(b'SOURCETABLE 200 OK\r\nContent-Type: text/plain\r\n\r\n' + body)
        c.close(); return
    if auth and base64.b64decode(auth[0].split()[-1]).decode() != 'kullanici:sifre':
        c.sendall(b'HTTP/1.1 401 Unauthorized\r\n\r\n' if v2 else b'ERROR - Bad Password\r\n'); c.close(); return
    if path not in ('/VRS_RTCM32', '/VRS_BEKLER'):
        c.sendall(b'SOURCETABLE 200 OK\r\n\r\n' + TABLE.encode()); c.close(); return
    if v2: c.sendall(b'HTTP/1.1 200 OK\r\nNtrip-Version: Ntrip/2.0\r\nTransfer-Encoding: chunked\r\nContent-Type: gnss/data\r\n\r\n')
    else: c.sendall(b'ICY 200 OK\r\n')
    c.settimeout(0.05)
    ggas = rest.count(b'GGA')
    bekler = path == '/VRS_BEKLER'
    t_end = time.time() + 4.5
    sent = 0
    while time.time() < t_end:
        try:
            g = c.recv(4096)
            if not g: break
            ggas += g.count(b'GGA')
        except socket.timeout: pass
        except OSError: break
        if bekler and ggas == 0:
            time.sleep(0.1); continue
        payload = paket()
        try:
            if v2:
                hdr = b'%x\r\n' % len(payload)
                if bekler and sent == 1:
                    c.sendall(hdr); time.sleep(1.3); c.sendall(payload + b'\r\n')
                else:
                    c.sendall(hdr + payload + b'\r\n')
            else:
                c.sendall(payload)
        except OSError: break
        sent += 1
        time.sleep(0.25)
    log.append(('gga', path, v2, ggas, sent))
    try: c.close()
    except OSError: pass

def handle_tcp(c):
    c.settimeout(0.05)
    sent = 0; got = b''
    t_end = time.time() + 3.0
    while time.time() < t_end:
        try:
            d = c.recv(4096)
            if d: got += d
        except socket.timeout: pass
        except OSError: break
        try: c.sendall(paket())
        except OSError: break
        sent += 1
        time.sleep(0.25)
    log.append(('tcp', sent, got.count(b'GGA')))
    try: c.close()
    except OSError: pass

def serve(port, fn):
    s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('127.0.0.1', port)); s.listen(5)
    while True:
        c, _ = s.accept(); threading.Thread(target=fn, args=(c,), daemon=True).start()

if __name__ == '__main__':
    p = int(sys.argv[1])
    threading.Thread(target=serve, args=(p, handle), daemon=True).start()
    threading.Thread(target=serve, args=(p + 1, handle_tcp), daemon=True).start()
    print('ISTASYON', STATION_ID, '%.4f %.4f %.4f' % (X, Y, Z), flush=True)
    time.sleep(float(sys.argv[2]))
    for l in log: print('SUNUCU', l)
