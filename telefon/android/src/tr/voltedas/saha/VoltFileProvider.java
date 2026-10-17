package tr.voltedas.saha;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import java.io.File;
import java.io.FileNotFoundException;

/** Paylaşım için önbellekteki dosyaları content:// adresiyle sunar (androidx gerektirmez). */
public final class VoltFileProvider extends ContentProvider {
    public static final String AUTH = "tr.voltedas.saha.files";
    public static Uri uriFor(File f) { return Uri.parse("content://" + AUTH + "/share/" + Uri.encode(f.getName())); }
    private File fileOf(Uri uri) throws FileNotFoundException {
        File dir = new File(getContext().getCacheDir(), "share");
        File f = new File(dir, uri.getLastPathSegment());
        try { if (!f.getCanonicalPath().startsWith(dir.getCanonicalPath())) throw new FileNotFoundException(); } catch (java.io.IOException e) { throw new FileNotFoundException(); }
        if (!f.exists()) throw new FileNotFoundException(uri.toString());
        return f;
    }
    @Override public boolean onCreate() { return true; }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException { return ParcelFileDescriptor.open(fileOf(uri), ParcelFileDescriptor.MODE_READ_ONLY); }
    @Override public String getType(Uri uri) {
        String ext = MimeTypeMap.getFileExtensionFromUrl(uri.getLastPathSegment());
        String m = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
        return m == null ? "application/octet-stream" : m;
    }
    @Override public Cursor query(Uri uri, String[] p, String s, String[] a, String o) {
        MatrixCursor c = new MatrixCursor(new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE });
        try { File f = fileOf(uri); c.addRow(new Object[] { f.getName(), f.length() }); } catch (FileNotFoundException ignored) { }
        return c;
    }
    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
