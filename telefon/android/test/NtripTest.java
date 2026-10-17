import tr.voltedas.saha.*;
import java.util.*;
public class NtripTest {
  public static void main(String[] a) throws Exception {
    int port = Integer.parseInt(a[0]);
    for (int ver : new int[]{1, 2}) {
      NtripClient.Config c = new NtripClient.Config();
      c.host = "127.0.0.1"; c.port = port; c.version = ver; c.user = "kullanici"; c.pass = "sifre"; c.mount = "VRS_RTCM32"; c.ggaSec = 1;
      List<NtripClient.Mount> ms = NtripClient.sourcetable(c);
      System.out.println("v" + ver + " sourcetable: " + ms.size() + " -> " + ms.get(0).name + " nmea=" + ms.get(0).nmea + " fmt=" + ms.get(0).format);
      final long[] got = {0}; final Map<Integer,Integer>[] types = new Map[1]; final List<String> st = new ArrayList<>();
      Rtcm3Parser p = new Rtcm3Parser();
      NtripClient nc = new NtripClient(c, () -> "$GNGGA,120000.00,3840.4580000,N,03913.3920000,E,1,12,0.8,1031.000,M,36.100,M,,*5C", new NtripClient.Listener() {
        public void onRtcm(byte[] b, int off, int len) { got[0] += len; p.push(b, off, len); }
        public void onStatus(String s, String e) { st.add(s + (e != null ? ":" + e : "")); }
        public void onStats(long bytes, double r, Map<Integer,Integer> t, long last) { types[0] = t; }
      });
      nc.start(); Thread.sleep(3600); nc.stop();
      System.out.println("v" + ver + " status=" + st.subList(0, Math.min(3, st.size())) + " bytes=" + got[0] + " frames=" + p.frames + " crcErr=" + p.crcErrors + " types=" + p.snapshot());
      // Hatalı şifre
      c.pass = "yanlis"; final List<String> st2 = new ArrayList<>();
      NtripClient bad = new NtripClient(c, () -> null, new NtripClient.Listener() { public void onRtcm(byte[] b,int o,int l){} public void onStatus(String s,String e){ st2.add(s + (e!=null?":"+e:"")); } public void onStats(long x,double y,Map<Integer,Integer> t,long z){} });
      bad.start(); Thread.sleep(700); bad.stop();
      System.out.println("v" + ver + " bad-auth=" + st2.subList(0, Math.min(2, st2.size())));
    }
  }
}
