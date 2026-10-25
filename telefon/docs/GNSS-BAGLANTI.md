# GNSS bağlantısı: dosyalar, düzeltme kaynakları, sabit istasyon

Telefon uygulamasının (Şebeke-M) GNSS alıcısına ve düzeltme kaynağına (TUSAGA-Aktif, kendi sabit istasyonunuz, yerel
CORS ağları) nasıl bağlandığı, bu işi yapan dosyalar ve sabit istasyon kurulurken gerekenler. Kullanım adımları:
[KULLANIM-KILAVUZU.md](KULLANIM-KILAVUZU.md) › "GNSS alıcıyı bağlama".

## 1. Veri yolu

```
GNSS alıcısı (rover) ──Bluetooth──► telefon (Şebeke-M) ──internet──► düzeltme kaynağı
   NMEA: GGA, GST, GSA, RMC  ───────►  konum, kalite              ◄── RTCM 3 düzeltmesi
   RTCM 3  ◄────────────────────────  düzeltme alıcıya yazılır       (NTRIP ya da doğrudan IP:port)
                                       GGA (yaklaşık konum) ─────────► VRS için yayıncıya
```

- Alıcı yalnız Bluetooth ile bağlanır (klasik SPP ya da BLE). Alıcıdan standart NMEA gelir; markaya bağlı değildir.
- Düzeltme telefonun internetiyle alınır ve doğrudan alıcıya yazılır (alıcının kendi internet / NTRIP bağlantısı kapalı olmalı).
- Bağlantı türleri: **NTRIP v1 / v2** (sunucu, port, bağlantı noktası, kullanıcı, şifre) ve **doğrudan IP:port** (NTRIP'siz,
  istasyon RTCM'i düz TCP ile veriyorsa).
- VRS yayıncıları ilk GGA gelmeden veri göndermez. Uygulama GGA'yı bağlanır bağlanmaz ve sonra düzenli gönderir; alıcı
  henüz konum bulmadıysa telefonun ya da projenin yaklaşık konumunu gönderir (yalnız konumu olan GGA iletilir).
- Gelen düzeltmedeki RTCM 1005 / 1006 mesajından referans istasyonunun numarası ve konumu okunur; rover'a uzaklığı gösterilir.

## 2. Uygulamadaki dosyalar

Android tarafı (Java) — `telefon/android/src/tr/voltedas/saha/`:

| Dosya | Görevi |
| --- | --- |
| `GnssHub.java` | Merkez: alıcı bağlantısı, NMEA'nın arayüze iletimi, son geçerli GGA, düzeltmenin alıcıya yazılması, telefon GNSS'i |
| `GnssLink.java` | Alıcı bağlantı arayüzü (bağlan, yaz, kapat) |
| `BtSppLink.java` | Klasik Bluetooth (SPP) seri bağlantı |
| `BleUartLink.java` | Bluetooth düşük enerji (BLE UART) bağlantı |
| `NtripClient.java` | Düzeltme istemcisi: NTRIP v1 / v2 ve doğrudan IP:port; GGA gönderimi, kaynak tablosu (bağlantı noktası listesi), akış denemesi, kopunca yeniden bağlanma |
| `Rtcm3Parser.java` | RTCM 3 çerçeve sayacı (CRC denetimi, mesaj türleri) ve 1005 / 1006 istasyon konumu |
| `PhoneGnss.java` | Telefonun kendi konumu (yalnız deneme) |
| `KeepAliveService.java` | Ekran kapalıyken bağlantıyı açık tutan servis (bildirim) |
| `VoltBridge.java` | Arayüz ↔ Java köprüsü: `gnssConnect`, `ntripConnect`, `ntripSourcetable`, `ntripProbe`, `ntripDisconnect` |
| `MainActivity.java` | İzinler (Bluetooth, konum), çıkışta "GNSS bağlantısı açık kalsın mı?" sorusu |
| `telefon/android/AndroidManifest.xml` | İzinler: internet, Bluetooth, konum, ön plan servisi |

Arayüz ve hesap tarafı (JavaScript) — `telefon/web/src/`:

| Dosya | Görevi |
| --- | --- |
| `gnss/gnss-service.js` | Konum kaynağı yönetimi, NMEA durum makinesi, ölçüm, düzeltme durumu, yaklaşık GGA, istasyon uzaklığı, alıcı bağlanınca kendiliğinden bağlanma |
| `gnss/ntrip-profiles.js` | Kayıtlı profiller, hazır profiller (TUSAGA-Aktif, sabit istasyon, yerel CORS), bağlantı bilgisi dosyası ve metinden alma, yer merkezli koordinat → enlem / boylam |
| `gnss/nmea.js` | NMEA ayrıştırıcı ve üretici (GGA…) |
| `gnss/rtcm.js` | RTCM 3 çözücü (masaüstü yedeği, mesaj adları) |
| `gnss/quality.js` | FIX / FLOAT, σ, PDOP, yaş eşik denetimi |
| `native/bridge.js` | Java köprüsü çağrıları |
| `ui/screens/settings.js` | Ayarlar: konum kaynağı, ölçüm yöntemi, alıcı (Bluetooth), anten |
| `ui/screens/duzeltme.js` | Ayarlar › Düzeltme kaynağı bölümü ve alıcı ayar rehberi |
| `ui/screens/field.js` | Sabit Base + Rover rehberi |
| `main.js` | Açılışta profillerin yüklenmesi, son alıcıya bağlanma |

Ayarlar telefonun kendi veritabanında saklanır (dosya değildir): `ntripProfiles` (profiller), `lastReceiver` (son alıcı),
`antenna` (anten), `gnssMethod` (ölçüm yöntemi, base bilgisi).

Denemeler: `telefon/android/test/NtripTest.java` + `mock_caster.py` (sahte yayıncı: v1 / v2, VRS'in GGA beklemesi,
doğrudan TCP, 1005 istasyon konumu; JDK ile, Android'siz) ve `telefon/web/tests/gnss.test.mjs`.

```
python3 telefon/android/test/mock_caster.py 21010 40 &
javac -d /tmp/nt telefon/android/src/tr/voltedas/saha/NtripClient.java telefon/android/src/tr/voltedas/saha/Rtcm3Parser.java telefon/android/test/NtripTest.java
java -cp /tmp/nt NtripTest 21010
```

## 3. Hazır düzeltme kaynakları

| Kaynak | Sunucu | Port | Not |
| --- | --- | --- | --- |
| TUSAGA-Aktif (CORS-TR) | `212.156.70.42` | `2101` | Kullanıcı adı ve şifre tusaga-aktif.gov.tr hesabında alıcıya özel yazılıdır. Ürünler: VRS (RTCM 3.1 / CMR+), FKP, MAC (RTCM 3 Net), DGPS. Datum ITRF96, 2005.0 epoğu. Bağlantı noktası uygulamada listeden seçilir. |
| Kendi sabit istasyonunuz | firmadan | genelde `2101` | NTRIP ya da doğrudan IP:port |
| Yerel CORS ağı | kurumdan | genelde `2101` | Belediye vb. ağlar |

TUSAGA-Aktif bilgileri: [tusaga-aktif.gov.tr › Sıkça sorulan sorular (teknik)](https://www.tusaga-aktif.gov.tr/Web/SSS_Teknik.aspx)
(25.10.2026'da bakıldı). Sunucu adresi değişirse profilde düzeltilir.

## 4. Sabit istasyon kurulurken firmadan istenecekler

1. **Yayın yolu:** NTRIP sunucusu (sunucu adresi ya da sabit IP, port, bağlantı noktası, kullanıcı adı, şifre) ya da doğrudan IP:port.
2. **İnternetten erişim:** sabit IP ya da alan adı; port (genelde 2101) dışarıya açık.
3. **Mesajlar:** RTCM 3.2 MSM4 ya da MSM5 (GPS, GLONASS, Galileo, BeiDou) + 1005 ya da 1006 (istasyon konumu) + 1033 +
   GLONASS için 1230; saniyede bir. 1005 / 1006 olmazsa uygulama istasyon uzaklığını gösteremez.
4. **İstasyon koordinatı:** TUSAGA-Aktif ile aynı datumda (ITRF96, 2005.0 epoğu), anten yüksekliği, koordinat belgesi.
5. **Süreklilik:** kesintisiz güç kaynağı, sabit hat ya da mobil modem; kesintide yayının kendiliğinden yeniden başlaması.
6. **Kapsama:** tek istasyonla uzaklık arttıkça FIX zorlaşır; uygulama bağlıyken uzaklığı gösterir (20 km üstünde uyarır).

Bilgiler mesajla gelirse uygulamada `Dosyadan / metinden al` ile yapıştırılır; "Sunucu / Port / Bağlantı noktası /
Kullanıcı / Şifre" satırları ve `ntrip://…`, `tcp://…` adresleri tanınır.

## 5. Bağlantı bilgisi dosyası

`Paylaş (dosya)` → `Sebeke-M-GNSS-baglanti.json`:

```json
{
  "bicim": "sebeke-m.gnss-baglanti", "surum": 1, "olusturma": "2026-10-25T12:00:00.000Z",
  "profiller": [
    { "name": "Sabit istasyon", "kind": "sabit", "mode": "ntrip", "host": "caster.ornek.com", "port": 2101,
      "mount": "BASE1", "user": "kullanici", "pass": "sifre (yalnız 'Şifrelerle' seçilirse)", "version": 2, "sendGGA": true, "ggaSec": 5 }
  ]
}
```

`mode`: `ntrip` ya da `tcp` (doğrudan IP:port). `kind`: `tusaga`, `sabit`, `yerel`, `diger`. Aynı adlı profil alınırken
güncellenir; dosyada şifre yoksa telefondaki şifre korunur.
