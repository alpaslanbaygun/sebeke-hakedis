package tr.voltedas.saha;

import android.content.Context;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.location.OnNmeaMessageListener;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;

/** Telefonun kendi GNSS'i: konum + uydu durumu + çipin NMEA'sı (geoit ayrımı için GGA). TEST / düşük doğruluk. */
public final class PhoneGnss {
    public interface Sink { void onPhone(JSONObject o); }
    private final LocationManager lm; private final Sink sink; private final Handler h = new Handler(Looper.getMainLooper());
    private volatile int sats = 0, used = 0; private volatile Double geoidSep = null; private boolean on;

    public PhoneGnss(Context ctx, Sink sink) { this.lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE); this.sink = sink; }

    private final LocationListener ll = new LocationListener() {
        @Override public void onLocationChanged(Location l) {
            try {
                JSONObject o = new JSONObject();
                o.put("lat", l.getLatitude()); o.put("lon", l.getLongitude());
                if (l.hasAltitude()) o.put("alt", l.getAltitude()); // WGS84 elipsoidal yükseklik
                if (geoidSep != null) o.put("geoidSep", geoidSep);
                if (l.hasAccuracy()) o.put("acc", l.getAccuracy());
                if (android.os.Build.VERSION.SDK_INT >= 26 && l.hasVerticalAccuracy()) o.put("vacc", l.getVerticalAccuracyMeters());
                if (l.hasBearing()) o.put("heading", l.getBearing());
                if (l.hasSpeed()) o.put("speed", l.getSpeed());
                o.put("time", l.getTime()); o.put("sats", sats); o.put("satsUsed", used); o.put("provider", l.getProvider());
                sink.onPhone(o);
            } catch (Exception ignored) { }
        }
        @Override public void onStatusChanged(String p, int s, Bundle b) { }
        @Override public void onProviderEnabled(String p) { }
        @Override public void onProviderDisabled(String p) { }
    };
    private final GnssStatus.Callback gs = new GnssStatus.Callback() {
        @Override public void onSatelliteStatusChanged(GnssStatus s) {
            int n = s.getSatelliteCount(), u = 0;
            for (int i = 0; i < n; i++) if (s.usedInFix(i)) u++;
            sats = n; used = u;
        }
    };
    private final OnNmeaMessageListener nmea = (msg, ts) -> {
        if (msg != null && msg.length() > 6 && msg.substring(3, 6).equals("GGA")) {
            String[] f = msg.split(",");
            try { if (f.length > 11 && !f[11].isEmpty()) geoidSep = Double.parseDouble(f[11]); } catch (Exception ignored) { }
        }
    };

    public void start(long intervalMs) throws SecurityException {
        if (on) return;
        lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, Math.max(200, intervalMs), 0f, ll, Looper.getMainLooper());
        try { lm.registerGnssStatusCallback(gs, h); } catch (Exception ignored) { }
        try { lm.addNmeaListener(nmea, h); } catch (Exception ignored) { }
        on = true;
    }
    public void stop() {
        if (!on) return;
        try { lm.removeUpdates(ll); } catch (Exception ignored) { }
        try { lm.unregisterGnssStatusCallback(gs); } catch (Exception ignored) { }
        try { lm.removeNmeaListener(nmea); } catch (Exception ignored) { }
        on = false;
    }
    public boolean isOn() { return on; }
}
