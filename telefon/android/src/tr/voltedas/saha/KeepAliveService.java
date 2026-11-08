package tr.voltedas.saha;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/** GNSS/NTRIP bağlantısı açıkken ekran kapansa da süreci ayakta tutan ön plan servisi. */
public final class KeepAliveService extends Service {
    static final String CH = "gnss";
    private PowerManager.WakeLock wl;

    public static void update(Context ctx, boolean on) {
        try {
            Intent i = new Intent(ctx, KeepAliveService.class);
            if (on) { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i); }
            else ctx.stopService(i);
        } catch (Exception ignored) { /* izin yoksa servis olmadan devam */ }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) nm.createNotificationChannel(new NotificationChannel(CH, "GNSS bağlantısı", NotificationManager.IMPORTANCE_LOW));
            PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
            String nm2 = GnssHub.get().linkName();
            Notification n = b.setContentTitle("Şebeke-M Hakediş · GNSS bağlı").setContentText(nm2 == null ? "Konum kaynağı etkin" : nm2 + " · NMEA/NTRIP akışı sürüyor")
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setContentIntent(pi).setOngoing(true).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            else startForeground(7, n);
            if (wl == null) { PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE); wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "voltsaha:gnss"); wl.acquire(12 * 60 * 60 * 1000L); }
        } catch (Exception e) { stopSelf(); }
        return START_NOT_STICKY;
    }
    @Override public void onDestroy() { if (wl != null && wl.isHeld()) wl.release(); wl = null; super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
