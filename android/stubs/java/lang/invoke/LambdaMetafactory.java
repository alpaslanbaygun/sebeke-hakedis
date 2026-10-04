package java.lang.invoke;
/** Yalnız derleme zamanı saplaması: android.jar'da metafactory imzası yok. d8 lambda'ları "desugar" ettiği için çalışma zamanında kullanılmaz. */
public final class LambdaMetafactory {
    public static final int FLAG_SERIALIZABLE = 1, FLAG_MARKERS = 2, FLAG_BRIDGES = 4;
    public static CallSite metafactory(MethodHandles.Lookup caller, String name, MethodType type, MethodType sam, MethodHandle impl, MethodType inst) throws LambdaConversionException { throw new UnsupportedOperationException(); }
    public static CallSite altMetafactory(MethodHandles.Lookup caller, String name, MethodType type, Object... args) throws LambdaConversionException { throw new UnsupportedOperationException(); }
}
