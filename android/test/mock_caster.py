# Sahte NTRIP caster: v1 (ICY) ve v2 (HTTP/1.1 chunked), kaynak tablosu, RTCM3 çerçeveleri, GGA kaydı
import socket, threading, struct, sys, base64, time
def crc24q(b):
    crc=0
    for x in b:
        crc ^= x<<16
        for _ in range(8):
            crc <<= 1
            if crc & 0x1000000: crc ^= 0x1864CFB
    return crc & 0xFFFFFF
def frame(msg_type, payload_len=20):
    p=bytearray(payload_len); p[0]=(msg_type>>4)&0xFF; p[1]=((msg_type&0xF)<<4)
    h=bytes([0xD3,(payload_len>>8)&3,payload_len&0xFF])+bytes(p)
    c=crc24q(h); return h+bytes([(c>>16)&0xFF,(c>>8)&0xFF,c&0xFF])
TABLE="STR;VRS_RTCM32;Elazig VRS;RTCM 3.2;1004(1),1005(10),1077(1);2;GPS+GLO+GAL+BDS;TUSAGA;TUR;38.67;39.22;1;1;sNTRIP;none;B;N;9600;\r\nSTR;ELAZ_RTCM3;ELAZ;RTCM 3.1;1004(1);2;GPS;TUSAGA;TUR;38.60;39.25;0;0;sNTRIP;none;B;N;4800;\r\nENDSOURCETABLE\r\n"
log=[]
def handle(c):
    data=b''
    while b'\r\n\r\n' not in data:
        d=c.recv(4096)
        if not d: return
        data+=d
    head=data.split(b'\r\n\r\n')[0].decode()
    rest=data.split(b'\r\n\r\n',1)[1]
    line=head.split('\r\n')[0]; path=line.split()[1]; v2='Ntrip-Version: Ntrip/2.0' in head
    auth=[h for h in head.split('\r\n') if h.startswith('Authorization')]
    log.append(('req',line,v2,auth[0] if auth else None,[h for h in head.split('\r\n') if h.startswith('Ntrip-GGA')]))
    if path=='/':
        body=TABLE.encode()
        if v2: c.sendall(b'HTTP/1.1 200 OK\r\nContent-Type: gnss/sourcetable\r\nContent-Length: %d\r\n\r\n'%len(body)+body)
        else: c.sendall(b'SOURCETABLE 200 OK\r\nContent-Type: text/plain\r\n\r\n'+body)
        c.close(); return
    if auth and base64.b64decode(auth[0].split()[-1]).decode()!='kullanici:sifre':
        c.sendall(b'HTTP/1.1 401 Unauthorized\r\n\r\n' if v2 else b'ERROR - Bad Password\r\n'); c.close(); return
    if path!='/VRS_RTCM32':
        c.sendall(b'SOURCETABLE 200 OK\r\n\r\n'+TABLE.encode()); c.close(); return
    if v2: c.sendall(b'HTTP/1.1 200 OK\r\nNtrip-Version: Ntrip/2.0\r\nTransfer-Encoding: chunked\r\nContent-Type: gnss/data\r\n\r\n')
    else: c.sendall(b'ICY 200 OK\r\n')
    c.settimeout(0.05)
    ggas=0
    for i in range(12):
        payload=frame(1005,19)+frame(1077,60)+frame(1087,50)
        if v2: c.sendall(b'%x\r\n'%len(payload)+payload+b'\r\n')
        else: c.sendall(payload)
        try:
            g=c.recv(4096)
            if b'GGA' in g: ggas+=g.count(b'GGA')
        except Exception: pass
        time.sleep(0.25)
    if rest and b'GGA' in rest: ggas+=1
    log.append(('gga',ggas))
    c.close()
def serve(port):
    s=socket.socket(); s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1); s.bind(('127.0.0.1',port)); s.listen(5)
    while True:
        c,_=s.accept(); threading.Thread(target=handle,args=(c,),daemon=True).start()
if __name__=='__main__':
    t=threading.Thread(target=serve,args=(int(sys.argv[1]),),daemon=True); t.start()
    time.sleep(float(sys.argv[2]))
    for l in log: print('CASTER',l)
