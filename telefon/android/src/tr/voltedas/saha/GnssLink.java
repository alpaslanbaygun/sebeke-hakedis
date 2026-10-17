package tr.voltedas.saha;

/** Harici GNSS alıcı bağlantısı (Bluetooth SPP / BLE UART). */
public interface GnssLink {
    interface Callback {
        void onData(byte[] b, int off, int len);
        void onState(String state, String error);
    }
    void connect() throws Exception;
    void write(byte[] b, int off, int len);
    void close();
    boolean isConnected();
    String name();
    String address();
    String type();
}
