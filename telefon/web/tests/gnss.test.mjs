// Düzeltme (CORS / sabit istasyon) bağlantıları: hazır profiller, bağlantı bilgisi dosyası, metinden alma,
// istasyon konumu ve uzaklığı, alıcı bağlanınca kendiliğinden bağlanma, yaklaşık GGA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadProfiles, activeProfile, updateActive, selectProfile, addProfile, removeProfile, setAuto, hazirProfilleriEkle, profilTamam,
  profilEksikleri, otomatikAyar, baglantiAyari, profilDosyasi, metindenProfiller, profilleriBirlestir, parseNtripUrl, ecefToGeo, uzaklikKm,
  HAZIR, DOSYA_BICIMI
} from '../src/gnss/ntrip-profiles.js';
import { GnssService } from '../src/gnss/gnss-service.js';
import { checksumOk, parseSentence } from '../src/gnss/nmea.js';

function kucukBus() {
  const h = new Map();
  return {
    on(e, f) { if (!h.has(e)) h.set(e, new Set()); h.get(e).add(f); return () => h.get(e).delete(f); },
    emit(e, d) { for (const f of [...(h.get(e) || [])]) f(d); }
  };
}
function ecef(lat, lon, hh) {
  const a = 6378137.0, f = 1 / 298.257222101, e2 = f * (2 - f), r = Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat * r) ** 2);
  return { x: (N + hh) * Math.cos(lat * r) * Math.cos(lon * r), y: (N + hh) * Math.cos(lat * r) * Math.sin(lon * r), z: (N * (1 - e2) + hh) * Math.sin(lat * r) };
}

test('G1 · Hazır profiller bir kez eklenir; TUSAGA-Aktif sunucusu dolar; kullanıcının profiline dokunulmaz', () => {
  // Yeni kurulum
  const ilk = hazirProfilleriEkle(loadProfiles(null, null));
  assert.equal(ilk.degisti, true);
  assert.deepEqual(ilk.st.list.map((p) => p.kind), ['tusaga', 'sabit', 'yerel']);
  const tus = ilk.st.list[0];
  assert.equal(tus.host, '212.156.70.42'); assert.equal(tus.port, 2101); assert.equal(tus.version, 1); assert.equal(tus.sendGGA, true);
  assert.equal(hazirProfilleriEkle(ilk.st).degisti, false, 'ikinci kez eklenmez');
  // Silinen hazır profil geri gelmez
  const silindi = removeProfile(ilk.st, ilk.st.list[2].id);
  assert.equal(hazirProfilleriEkle(silindi).st.list.length, 2);
  // Eski kurulum: kullanıcının kendi profilleri (biri sabit istasyon adlı) → yalnız eksikler eklenir
  const eski = loadProfiles({ active: 'a', list: [{ id: 'a', name: 'TUSAGA-Aktif', host: '', mount: '' }, { id: 'b', name: 'Sabit istasyon · Elazığ', host: '10.0.0.5', mount: 'BASE1' }] }, null);
  const r = hazirProfilleriEkle(eski);
  assert.deepEqual(r.st.list.map((p) => p.name), ['TUSAGA-Aktif', 'Sabit istasyon · Elazığ', 'Yerel CORS ağı']);
  assert.equal(r.st.list[0].host, '212.156.70.42', 'boş TUSAGA-Aktif sunucusu doldu');
  assert.equal(r.st.list[1].host, '10.0.0.5'); assert.equal(r.st.list[1].kind, 'sabit');
  assert.equal(r.st.active, 'a');
  // Kendi adresini yazmış TUSAGA profiline dokunulmaz
  const ozel = hazirProfilleriEkle(loadProfiles({ active: 'a', list: [{ id: 'a', name: 'TUSAGA-Aktif', host: 'caster.ornek', port: 2102 }] }, null)).st;
  assert.equal(ozel.list[0].host, 'caster.ornek'); assert.equal(ozel.list[0].port, 2102);
});

test('G2 · Profil işlemleri ayarları (kendiliğinden bağlan, hazır sürümü) korur; türler ve eksikler', () => {
  let st = hazirProfilleriEkle(loadProfiles(null, null)).st;
  st = setAuto(st, false);
  st = addProfile(st, 'İl Özel İdaresi ağı', 'yerel');
  assert.equal(activeProfile(st).kind, 'yerel'); assert.equal(st.auto, false); assert.equal(st.hazir, 2);
  st = updateActive(st, { host: 'cors.ornek.gov.tr', mount: 'RTCM3_VRS' });
  st = selectProfile(st, st.list[0].id);
  st = removeProfile(st, st.list[3].id);
  assert.equal(st.auto, false); assert.equal(st.hazir, 2); assert.equal(st.list.length, 3);
  // TCP profili: bağlantı noktası gerekmez
  st = addProfile(st, 'Ofis istasyonu', 'sabit');
  st = updateActive(st, { mode: 'tcp', host: '88.1.2.3', port: 9000 });
  const p = activeProfile(st);
  assert.equal(profilTamam(p), true); assert.deepEqual(profilEksikleri(p), []);
  assert.deepEqual(baglantiAyari(p, '$GGA'), { mode: 'tcp', host: '88.1.2.3', port: 9000, mount: '', user: '', pass: '', version: 2, sendGGA: true, ggaSec: 5, gga: '$GGA' });
  assert.equal(otomatikAyar(st), null, 'kendiliğinden bağlan kapalı');
  assert.equal(otomatikAyar(setAuto(st, true)).host, '88.1.2.3');
  // TUSAGA-Aktif: bağlantı noktası ve kullanıcı eksik
  const t = st.list.find((x) => x.kind === 'tusaga');
  assert.deepEqual(profilEksikleri(t), ['bağlantı noktası', 'kullanıcı adı']);
  assert.equal(profilTamam(t), false);
  assert.equal(otomatikAyar(selectProfile(setAuto(st, true), t.id)), null, 'eksik profil kendiliğinden bağlanmaz');
  assert.throws(() => addProfile(st, 'ofis İSTASYONU'), /var/);
});

test('G3 · Bağlantı bilgisi dosyası: şifresiz / şifreli paylaşım, geri alma ve birleştirme', () => {
  let st = hazirProfilleriEkle(loadProfiles(null, null)).st;
  st = updateActive(st, { mount: 'VRSRTCM31', user: 'alici1', pass: 'gizli' });
  const sifresiz = profilDosyasi(st);
  assert.equal(sifresiz.bicim, DOSYA_BICIMI); assert.equal(sifresiz.profiller.length, 1, 'yalnız sunucusu dolu profil yazılır');
  assert.equal(sifresiz.profiller[0].pass, undefined); assert.equal(sifresiz.profiller[0].user, 'alici1');
  assert.equal(JSON.stringify(sifresiz).includes('gizli'), false);
  const sifreli = profilDosyasi(st, { sifreler: true });
  assert.equal(sifreli.profiller[0].pass, 'gizli');
  // Başka telefon: boş kurulum + dosya
  let b = hazirProfilleriEkle(loadProfiles(null, null)).st;
  const r = profilleriBirlestir(b, metindenProfiller(JSON.stringify(sifreli)));
  assert.equal(r.eklenen, 0); assert.equal(r.guncellenen, 1, 'aynı adlı profil güncellenir');
  b = r.st;
  assert.equal(activeProfile(b).mount, 'VRSRTCM31'); assert.equal(activeProfile(b).pass, 'gizli');
  // Şifresiz dosya mevcut şifreyi silmez
  const r2 = profilleriBirlestir(b, metindenProfiller(JSON.stringify(sifresiz)));
  assert.equal(activeProfile(r2.st).pass, 'gizli');
  // Yeni adlı profil eklenir ve seçilir
  const r3 = profilleriBirlestir(b, [{ name: 'Komşu ilçe', host: 'cors.ornek', port: 2101, mount: 'K1' }]);
  assert.equal(r3.eklenen, 1); assert.equal(activeProfile(r3.st).name, 'Komşu ilçe'); assert.equal(activeProfile(r3.st).kind, 'diger');
  // Adsız gelene sunucudan ad
  const r4 = profilleriBirlestir(b, [{ mode: 'tcp', host: '88.1.2.3', port: 9000 }]);
  assert.equal(activeProfile(r4.st).name, 'IP 88.1.2.3:9000'); assert.equal(activeProfile(r4.st).mode, 'tcp');
  assert.throws(() => metindenProfiller('{ bozuk'), /JSON/);
});

test('G4 · Metinden bağlantı bilgisi: adres satırları ve "Sunucu / Port / Bağlantı noktası" metni', () => {
  assert.deepEqual(parseNtripUrl('ntrip://u%40x:p:q@caster.ornek.com:2101/BASE1'), { mode: 'ntrip', host: 'caster.ornek.com', port: 2101, mount: 'BASE1', user: 'u@x', pass: 'p:q' });
  assert.deepEqual(parseNtripUrl('tcp://88.1.2.3:9000'), { mode: 'tcp', host: '88.1.2.3', port: 9000 });
  assert.deepEqual(parseNtripUrl('caster.ornek.com:2101/BASE1'), { mode: 'ntrip', host: 'caster.ornek.com', port: 2101, mount: 'BASE1' });
  assert.equal(parseNtripUrl('Sunucu: 1.2.3.4'), null);
  assert.equal(parseNtripUrl('merhaba'), null);
  const m = metindenProfiller('Merhaba, sabit istasyon bilgileri:\nSUNUCU: 212.156.70.42\nPORT: 2101\nBAĞLANTI NOKTASI: VRSRTCM31\nKULLANICI ADI: abc\nŞİFRE: x,y');
  assert.deepEqual(m, [{ mode: 'ntrip', host: '212.156.70.42', port: 2101, mount: 'VRSRTCM31', user: 'abc', pass: 'x,y' }]);
  assert.deepEqual(metindenProfiller('IP ADRESİ = 10.0.0.5 ; PORT = 5017'), [{ mode: 'tcp', host: '10.0.0.5', port: 5017 }]);
  assert.deepEqual(metindenProfiller('Caster: cors.ornek.gov.tr:2101\nMountpoint: RTCM3\nUser: u\nPassword: p\nNTRIP sürümü: 1'), [{ mode: 'ntrip', host: 'cors.ornek.gov.tr', port: 2101, mount: 'RTCM3', user: 'u', pass: 'p', version: 1 }]);
  assert.equal(metindenProfiller('ntrip://a:b@h1:2101/M1\n- tcp://h2:9000').length, 2);
  assert.deepEqual(metindenProfiller('88.1.2.3:9000'), [{ mode: 'tcp', host: '88.1.2.3', port: 9000 }]);
  assert.deepEqual(metindenProfiller('bilgi yok'), []);
});

test('G4b · Metinden alma: adres + ayrı kullanıcı satırları birleşir, web adresi karışmaz, "%" içeren şifre, posta adresi', () => {
  assert.deepEqual(metindenProfiller('cors.ornek.gov.tr:2101/VRSRTCM31\nKullanıcı: abc\nŞifre: xyz'), [{ mode: 'ntrip', host: 'cors.ornek.gov.tr', port: 2101, mount: 'VRSRTCM31', user: 'abc', pass: 'xyz' }]);
  assert.deepEqual(metindenProfiller('Belediye CORS\nhttp://www.belediye.bel.tr\nSunucu: 10.1.1.1\nPort: 2101\nMountpoint: RTCM3\nKullanıcı: k\nŞifre: s'), [{ mode: 'ntrip', host: '10.1.1.1', port: 2101, mount: 'RTCM3', user: 'k', pass: 's' }]);
  assert.equal(parseNtripUrl('http://www.belediye.bel.tr'), null);
  assert.equal(parseNtripUrl('ntrip://u:100%ok@host.ornek:2101/MP').pass, '100%ok');
  assert.deepEqual(metindenProfiller('Adres: Atatürk Cad. No:5'), []);
  assert.equal(metindenProfiller('Caster: cors.ornek\nPort: 2101')[0].mode, 'ntrip', 'yayıncı sözcüğü: NTRIP');
  assert.equal(metindenProfiller('Sunucu: 1.2.3.4\nPort: 2101\nMountpoint: A\nSürüm: 2.1')[0].version, undefined, '2.1 sürüm sayılmaz');
  assert.equal(metindenProfiller('Sunucu: 1.2.3.4\nPort: 2101\nMountpoint: A\nNTRIP sürümü: v1.0')[0].version, 1);
  // İçe alınan doğrudan IP profili GGA göndermez (istasyon gelen veriyi okumayabilir)
  const st = hazirProfilleriEkle(loadProfiles(null, null)).st;
  const r = profilleriBirlestir(st, metindenProfiller('tcp://88.1.2.3:9000'));
  assert.equal(activeProfile(r.st).sendGGA, false);
  assert.equal(activeProfile(profilleriBirlestir(st, metindenProfiller('ntrip://u:p@h.ornek:2101/M')).st).sendGGA, true);
  // Kendiliğinden bağlanma: önceki sürümden gelen kayıtta kapalı, yeni kurulumda açık
  assert.equal(loadProfiles({ active: 'a', list: [{ id: 'a', name: 'x', host: 'h', mount: 'm' }] }, null).auto, false);
  assert.equal(loadProfiles(null, { name: 'TUSAGA-Aktif', host: 'h', mount: 'm' }).auto, false);
  assert.equal(loadProfiles(null, null).auto, true);
  assert.equal(loadProfiles({ active: 'a', auto: true, list: [{ id: 'a', name: 'x', host: 'h', mount: 'm' }] }, null).auto, true);
  // TUSAGA-Aktif kullanıcı adı olmadan kendiliğinden bağlanmaz
  const t = Object.assign({}, st.list[0], { mount: 'VRSRTCM31' });
  assert.equal(profilTamam(t), false); assert.equal(profilTamam(Object.assign({}, t, { user: 'u' })), true);
});

test('G5 · İstasyon konumu (RTCM 1005) → enlem / boylam ve uzaklık', () => {
  const p = ecef(38.6743, 39.2232, 1100);
  const g = ecefToGeo(p.x, p.y, p.z);
  assert.ok(Math.abs(g.lat - 38.6743) < 1e-9 && Math.abs(g.lon - 39.2232) < 1e-9 && Math.abs(g.h - 1100) < 1e-4, JSON.stringify(g));
  const d = uzaklikKm(38.6743, 39.2232, 38.6743 + 0.09, 39.2232);
  assert.ok(Math.abs(d - 10.0) < 0.05, 'yaklaşık 10 km: ' + d);
  assert.equal(uzaklikKm(null, 1, 2, 3), null);
});

test('G6 · GNSS servisi: yaklaşık GGA, bağlanma hatası, istasyon uzaklığı, alıcı bağlanınca kendiliğinden bağlanma', async () => {
  const bus = kucukBus();
  const cagri = [];
  let reddet = false;
  const bridge = {
    isNative: () => true,
    ntripConnect: async (c) => { cagri.push(c); if (reddet) throw new Error('Önce harici GNSS alıcısına bağlanın'); return true; },
    ntripDisconnect: async () => true,
    ntripProbe: async (c) => ({ connected: true, error: null, frames: 9, types: { 1005: 3, 1077: 3 }, station: Object.assign({ id: 2003 }, ecef(38.70, 39.25, 1100)), gga: c.gga })
  };
  const g = new GnssService({ bus, bridge, now: () => Date.UTC(2026, 9, 25, 12, 0, 0) });
  // Konum yokken yakın noktadan GGA
  assert.equal(g.fallbackGGA(), '');
  const gga = g.fallbackGGA({ lat: 38.6743, lon: 39.2232, alt: 1031 });
  assert.ok(checksumOk(gga));
  const ps = parseSentence(gga);
  assert.equal(ps.type, 'GGA'); assert.ok(Math.abs(ps.lat - 38.6743) < 1e-6 && Math.abs(ps.lon - 39.2232) < 1e-6); assert.equal(ps.quality, 1);
  // Bağlanma hatası "bağlanıyor"da takılı kalmaz
  reddet = true;
  await assert.rejects(() => g.ntripConnect({ mode: 'ntrip', host: 'h', port: 2101, mount: 'M' }, { lat: 38.6, lon: 39.2 }), /alıcısına/);
  assert.equal(g.ntrip.state, 'error');
  assert.ok(cagri[0].gga.startsWith('$GNGGA'), 'yaklaşık GGA gönderildi');
  reddet = false;
  // Akış denemesi: istasyon enlem / boylama çevrilir, uzaklık verilen yakın noktaya göre
  const r = await g.ntripProbe({ mode: 'ntrip', host: 'h', port: 2101, mount: 'M' }, { near: { lat: 38.6743, lon: 39.2232 } });
  assert.equal(r.station.id, 2003); assert.ok(Math.abs(r.station.lat - 38.70) < 1e-8);
  assert.ok(r.baseKm > 3 && r.baseKm < 4, 'yaklaşık 3,6 km: ' + r.baseKm);
  // Java'dan gelen durum: istasyon + alıcı konumu → uzaklık
  g.state.lat = 38.6743; g.state.lon = 39.2232;
  g.onNtrip({ state: 'connected', mode: 'tcp', host: '88.1.2.3', port: 9000, station: Object.assign({ id: 7 }, ecef(38.6743 + 0.09, 39.2232, 1000)) });
  assert.equal(g.ntrip.station.id, 7);
  assert.ok(Math.abs(g.snapshot().ntrip.baseKm - 10) < 0.06);
  g.onNtrip({ state: 'connected', rateBps: 512 });
  assert.equal(g.ntrip.station.id, 7, 'istasyonsuz durum iletisi istasyonu silmez');
  // Kaynak bilgisi ölçüm kaydında: doğrudan IP + istasyon
  const o = g.buildObservation([{ t: 0, t1: 0, lat: 38.6743, lon: 39.2232, h: 1000, E: 1, N: 2, fix: 'FIX' }], { cls: 'A', warn: [] });
  assert.equal(o.correctionSource, 'IP 88.1.2.3:9000 · istasyon 7'); assert.equal(o.mountpoint, null);
  // Alıcı bağlanınca kendiliğinden bağlanma
  g.ntrip.state = 'off'; cagri.length = 0;
  g.state.source = 'external';
  g.autoNtrip = { mode: 'ntrip', host: 'h', port: 2101, mount: 'M', sendGGA: true };
  g.onLinkStatus({ state: 'connected' });
  await new Promise((res) => setTimeout(res, 1700));
  assert.equal(cagri.length, 1, 'bağlandı'); assert.equal(cagri[0].mount, 'M');
  // Radyolu sabit base düzeninde açılmaz
  g.ntrip.state = 'off'; cagri.length = 0;
  g.setMethod('BASE_ROVER', { name: 'B1', link: 'UHF radyo' });
  g.onLinkStatus({ state: 'connected' });
  await new Promise((res) => setTimeout(res, 1700));
  assert.equal(cagri.length, 0, 'radyolu base: internet düzeltmesi açılmadı');
  // İnternetten yayın yapan base: açılır
  g.setMethod('BASE_ROVER', { name: 'B1', link: 'NTRIP (kendi caster / SIM)' });
  g.onLinkStatus({ state: 'connected' });
  await new Promise((res) => setTimeout(res, 1700));
  assert.equal(cagri.length, 1);
  // Hazır TUSAGA-Aktif profili sabit
  assert.equal(HAZIR.tusaga.host, '212.156.70.42');
});
