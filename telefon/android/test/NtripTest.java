import tr.voltedas.saha.*;
import java.util.*;

/**
 * Düzeltme istemcisi denemesi (JDK ile, Android'siz). Önce sahte sunucuyu başlatın:
 *   python3 telefon/android/test/mock_caster.py 21010 40 &
 *   javac -d /tmp/nt telefon/android/src/tr/voltedas/saha/NtripClient.java telefon/android/src/tr/voltedas/saha/Rtcm3Parser.java telefon/android/test/NtripTest.java
 *   java -cp /tmp/nt NtripTest 21010
 * Çıkış kodu 0: hepsi geçti.
 */
public class NtripTest {
  static int fail = 0;
  static void check(boolean ok, String what) { System.out.println((ok ? "GEÇTİ  " : "HATA   ") + what); if (!ok) fail++; }
  static final String GGA = "$GNGGA,120000.00,3840.4580000,N,03913.3920000,E,1,12,0.8,1031.000,M,36.100,M,,*5C";

  static final class Kayit implements NtripClient.Listener {
    long bytes; final List<String> st = Collections.synchronizedList(new ArrayList<>()); volatile NtripClient.Stats last; final Rtcm3Parser p = new Rtcm3Parser();
    public void onRtcm(byte[] b, int off, int len) { bytes += len; p.push(b, off, len); }
    public void onStatus(String s, String e) { st.add(s + (e != null ? ":" + e : "")); }
    public void onStats(NtripClient.Stats s) { last = s; }
  }
  static NtripClient.Config cfg(int port, int ver, String mount) {
    NtripClient.Config c = new NtripClient.Config();
    c.host = "127.0.0.1"; c.port = port; c.version = ver; c.user = "kullanici"; c.pass = "sifre"; c.mount = mount; c.ggaSec = 1;
    return c;
  }

  public static void main(String[] a) throws Exception {
    int port = Integer.parseInt(a[0]);
    // Beklenen istasyon (mock_caster.py: 38.6743, 39.2232, 1100 m)
    double[] beklenen = ecef(38.6743, 39.2232, 1100.0);
    for (int ver : new int[]{1, 2}) {
      NtripClient.Config c = cfg(port, ver, "VRS_RTCM32");
      List<NtripClient.Mount> ms = NtripClient.sourcetable(c);
      check(ms.size() == 2 && ms.get(0).name.equals("VRS_RTCM32") && ms.get(0).nmea, "v" + ver + " kaynak tablosu: " + ms.size() + " bağlantı noktası");

      Kayit k = new Kayit();
      NtripClient nc = new NtripClient(c, () -> GGA, k);
      nc.start(); Thread.sleep(2600); nc.stop();
      check(k.bytes > 0 && k.p.frames > 0 && k.p.crcErrors == 0, "v" + ver + " veri: " + k.bytes + " bayt, " + k.p.frames + " çerçeve, tür " + k.p.snapshot());
      check(k.st.contains("connected"), "v" + ver + " durum: " + k.st.subList(0, Math.min(3, k.st.size())));
      check(k.p.stationId == 2003 && Math.abs(k.p.stationX - beklenen[0]) < 0.001 && Math.abs(k.p.stationY - beklenen[1]) < 0.001 && Math.abs(k.p.stationZ - beklenen[2]) < 0.001,
        "v" + ver + " istasyon (1005): " + k.p.stationId + " X " + k.p.stationX + " Y " + k.p.stationY + " Z " + k.p.stationZ);
      check(k.last != null && k.last.stationId == 2003, "v" + ver + " saniyelik özet istasyonu taşıyor");

      // Yanlış şifre: bir kez dener, hatayı bildirir ve durur (sunucuyu yormaz, hesap kilitlenmez)
      NtripClient.Config yanlis = cfg(port, ver, "VRS_RTCM32"); yanlis.pass = "yanlis";
      Kayit k2 = new Kayit();
      NtripClient bad = new NtripClient(yanlis, () -> null, k2);
      bad.start(); Thread.sleep(2600);
      check(k2.st.toString().contains("şifre yanlış") && Collections.frequency(k2.st, "connecting") == 1 && !bad.isRunning(), "v" + ver + " yanlış şifre, yeniden denemez: " + k2.st);
      bad.stop();

      // Bilinmeyen bağlantı noktası (v2: 200 + kaynak tablosu) → kalıcı hata
      Kayit k4 = new Kayit();
      NtripClient yok = new NtripClient(cfg(port, ver, "YOK_BOYLE"), () -> GGA, k4);
      yok.start(); Thread.sleep(1200);
      check(k4.st.toString().contains("bulunamadı") && !yok.isRunning(), "v" + ver + " bilinmeyen bağlantı noktası: " + k4.st);
      yok.stop();

      // VRS: alıcı ilk 1,5 s konum vermiyor (GGA yok), sonra veriyor → istemci kilitlenmeden düzeltme almalı
      Kayit k3 = new Kayit();
      final long t0 = System.currentTimeMillis();
      NtripClient vrs = new NtripClient(cfg(port, ver, "VRS_BEKLER"), () -> System.currentTimeMillis() - t0 > 1500 ? GGA : null, k3);
      vrs.start(); Thread.sleep(4300); vrs.stop();
      check(k3.p.frames > 0 && k3.p.crcErrors == 0, "v" + ver + " VRS geç GGA: " + k3.p.frames + " çerçeve, " + k3.p.crcErrors + " CRC hatası, durum " + k3.st.subList(0, Math.min(3, k3.st.size())));
    }

    // Kısa oturumlar: veri gelen oturum koptukça bekleme 2 s'den başlar (2, 4, 8… diye büyümez)
    Kayit kk = new Kayit();
    NtripClient kisa = new NtripClient(cfg(port, 1, "KISA"), () -> GGA, kk);
    kisa.start(); Thread.sleep(12000); kisa.stop();
    int baglanti = Collections.frequency(kk.st, "connecting");
    check(baglanti >= 4, "kısa oturumlar: 12 s'de " + baglanti + " bağlantı (beklenen ≥ 4)");

    // Doğrudan TCP (NTRIP'siz)
    NtripClient.Config t = new NtripClient.Config();
    t.mode = "tcp"; t.host = "127.0.0.1"; t.port = port + 1; t.sendGGA = false;
    Kayit kt = new Kayit();
    NtripClient tcp = new NtripClient(t, () -> GGA, kt);
    tcp.start(); Thread.sleep(1800); tcp.stop();
    check(kt.p.frames > 0 && kt.p.stationId == 2003 && kt.st.contains("connected"), "TCP: " + kt.p.frames + " çerçeve, istasyon " + kt.p.stationId);

    // Akış denemesi (alıcısız): yaklaşık GGA ile
    NtripClient.Config pc = cfg(port, 2, "VRS_RTCM32"); pc.ggaFallback = GGA;
    NtripClient.Probe pr = NtripClient.probe(pc, 6);
    check(pr.connected && pr.error == null && pr.frames >= 3 && pr.stationId == 2003, "deneme: bağlandı=" + pr.connected + " çerçeve=" + pr.frames + " istasyon=" + pr.stationId + " hata=" + pr.error);
    NtripClient.Config pm = cfg(port, 1, "YOK_BOYLE"); pm.ggaFallback = GGA;
    NtripClient.Probe pr2 = NtripClient.probe(pm, 4);
    check(!pr2.connected && pr2.error != null && pr2.error.contains("bulunamadı"), "deneme yanlış bağlantı noktası: " + pr2.error);
    NtripClient.Config pk = cfg(port + 5, 2, "VRS_RTCM32");
    NtripClient.Probe pr3 = NtripClient.probe(pk, 4);
    check(!pr3.connected && pr3.error != null, "deneme kapalı port: " + pr3.error);
    NtripClient.Config tp = new NtripClient.Config(); tp.mode = "tcp"; tp.host = "127.0.0.1"; tp.port = port + 1; tp.sendGGA = false;
    NtripClient.Probe pr4 = NtripClient.probe(tp, 4);
    check(pr4.connected && pr4.frames > 0 && pr4.stationId == 2003, "deneme TCP: çerçeve=" + pr4.frames + " istasyon=" + pr4.stationId + " hata=" + pr4.error);

    // RTCM olmayan akış: deneme "RTCM değil" demeli
    NtripClient.Config nm = new NtripClient.Config(); nm.mode = "tcp"; nm.host = "127.0.0.1"; nm.port = port + 2; nm.sendGGA = false;
    NtripClient.Probe pr5 = NtripClient.probe(nm, 3);
    check(pr5.connected && pr5.frames == 0 && pr5.error != null && pr5.error.contains("RTCM"), "deneme RTCM olmayan akış: " + pr5.error);

    // Gelen veriyi okumayan sunucu: GGA yazımı kilitlenince istemci sezer ve bağlantıyı yeniler
    NtripClient.Config ok = new NtripClient.Config(); ok.mode = "tcp"; ok.host = "127.0.0.1"; ok.port = port + 3; ok.sendGGA = true; ok.ggaSec = 1; ok.dataTimeoutMs = 5000;
    StringBuilder buyuk = new StringBuilder(); while (buyuk.length() < 16_000_000) buyuk.append(GGA);
    ok.ggaFallback = buyuk.toString();
    Kayit ko = new Kayit();
    NtripClient okumayan = new NtripClient(ok, () -> null, ko);
    okumayan.start(); Thread.sleep(9000); okumayan.stop();
    check(ko.st.toString().contains("GGA") && ko.p.frames > 0, "okumayan sunucu: " + ko.st.subList(0, Math.min(4, ko.st.size())));

    System.out.println(fail == 0 ? "SONUÇ: hepsi geçti" : "SONUÇ: " + fail + " hata");
    System.exit(fail == 0 ? 0 : 1);
  }

  static double[] ecef(double lat, double lon, double h) {
    double a = 6378137.0, f = 1 / 298.257222101, e2 = f * (2 - f);
    double la = Math.toRadians(lat), lo = Math.toRadians(lon);
    double N = a / Math.sqrt(1 - e2 * Math.sin(la) * Math.sin(la));
    return new double[]{(N + h) * Math.cos(la) * Math.cos(lo), (N + h) * Math.cos(la) * Math.sin(lo), (N * (1 - e2) + h) * Math.sin(la)};
  }
}
