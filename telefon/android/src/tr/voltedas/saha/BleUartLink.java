package tr.voltedas.saha;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.os.Build;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/** BLE UART (Nordic UART Service ya da bildirim+yazma karakteristiği olan özel servis) üzerinden NMEA/RTCM. */
public final class BleUartLink implements GnssLink {
    static final UUID NUS = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    static final UUID NUS_TX = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e"); // alıcı → telefon (notify)
    static final UUID NUS_RX = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e"); // telefon → alıcı (write)
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Context ctx; private final BluetoothDevice dev; private final Callback cb;
    private volatile BluetoothGatt gatt; private volatile BluetoothGattCharacteristic txC, rxC;
    private volatile boolean alive; private volatile int mtu = 23;
    private final Semaphore writeLock = new Semaphore(1);
    private final CountDownLatch ready = new CountDownLatch(1);
    private volatile String err;

    public BleUartLink(Context ctx, BluetoothAdapter ad, String address, Callback cb) {
        this.ctx = ctx; this.dev = ad.getRemoteDevice(address); this.cb = cb;
    }
    @Override public String type() { return "ble"; }
    @Override public String address() { return dev.getAddress(); }
    @Override public String name() { try { String n = dev.getName(); return n == null ? dev.getAddress() : n; } catch (SecurityException e) { return dev.getAddress(); } }
    @Override public boolean isConnected() { return alive; }

    private final BluetoothGattCallback gcb = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt g, int status, int state) {
            try {
                if (state == BluetoothProfile.STATE_CONNECTED) { if (!g.requestMtu(247)) g.discoverServices(); }
                else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                    boolean was = alive; alive = false;
                    if (ready.getCount() > 0) { err = "BLE bağlantısı kurulamadı (durum " + status + ")"; ready.countDown(); }
                    else if (was) cb.onState("disconnected", "BLE bağlantısı koptu");
                    try { g.close(); } catch (Exception ignored) { }
                }
            } catch (SecurityException se) { err = "Bluetooth izni yok"; ready.countDown(); }
        }
        @Override public void onMtuChanged(BluetoothGatt g, int m, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) mtu = m;
            try { g.discoverServices(); } catch (SecurityException se) { err = "Bluetooth izni yok"; ready.countDown(); }
        }
        @Override public void onServicesDiscovered(BluetoothGatt g, int status) {
            try {
                BluetoothGattService s = g.getService(NUS);
                if (s != null) { txC = s.getCharacteristic(NUS_TX); rxC = s.getCharacteristic(NUS_RX); }
                if (txC == null) {
                    for (BluetoothGattService sv : g.getServices()) {
                        String u = sv.getUuid().toString();
                        if (u.startsWith("00001800") || u.startsWith("00001801") || u.startsWith("0000180a")) continue;
                        BluetoothGattCharacteristic n = null, w = null;
                        for (BluetoothGattCharacteristic c : sv.getCharacteristics()) {
                            int p = c.getProperties();
                            if (n == null && (p & (BluetoothGattCharacteristic.PROPERTY_NOTIFY | BluetoothGattCharacteristic.PROPERTY_INDICATE)) != 0) n = c;
                            if (w == null && (p & (BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)) != 0) w = c;
                        }
                        if (n != null) { txC = n; rxC = w; break; }
                    }
                }
                if (txC == null) { err = "Alıcıda UART (bildirim) servisi bulunamadı"; ready.countDown(); return; }
                g.setCharacteristicNotification(txC, true);
                BluetoothGattDescriptor d = txC.getDescriptor(CCCD);
                if (d != null) {
                    byte[] v = (txC.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0 ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE : BluetoothGattDescriptor.ENABLE_INDICATION_VALUE;
                    if (Build.VERSION.SDK_INT >= 33) g.writeDescriptor(d, v);
                    else { d.setValue(v); g.writeDescriptor(d); }
                } else { alive = true; ready.countDown(); }
            } catch (SecurityException se) { err = "Bluetooth izni yok"; ready.countDown(); }
        }
        @Override public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) { alive = true; ready.countDown(); }
        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value) { if (value != null) cb.onData(value, 0, value.length); }
        @SuppressWarnings("deprecation")
        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) { byte[] v = c.getValue(); if (v != null) cb.onData(v, 0, v.length); }
        @Override public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int status) { writeLock.release(); }
    };

    @Override public void connect() throws Exception {
        gatt = Build.VERSION.SDK_INT >= 23 ? dev.connectGatt(ctx, false, gcb, BluetoothDevice.TRANSPORT_LE) : dev.connectGatt(ctx, false, gcb);
        if (!ready.await(20, TimeUnit.SECONDS)) { close(); throw new Exception("BLE bağlantısı zaman aşımı"); }
        if (err != null) { close(); throw new Exception(err); }
        cb.onState("connected", null);
    }
    @SuppressWarnings("deprecation")
    @Override public void write(byte[] b, int off, int len) {
        BluetoothGatt g = gatt; BluetoothGattCharacteristic c = rxC;
        if (g == null || c == null || !alive) return;
        int chunk = Math.max(20, mtu - 3);
        int wt = (c.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0 ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
        for (int i = 0; i < len; i += chunk) {
            int n = Math.min(chunk, len - i);
            byte[] part = new byte[n];
            System.arraycopy(b, off + i, part, 0, n);
            try {
                if (!writeLock.tryAcquire(300, TimeUnit.MILLISECONDS)) writeLock.drainPermits();
                if (Build.VERSION.SDK_INT >= 33) g.writeCharacteristic(c, part, wt);
                else { c.setWriteType(wt); c.setValue(part); g.writeCharacteristic(c); }
            } catch (SecurityException | InterruptedException e) { return; }
        }
    }
    @Override public void close() {
        alive = false;
        try { if (gatt != null) { gatt.disconnect(); gatt.close(); } } catch (Exception ignored) { }
        gatt = null;
    }
}
