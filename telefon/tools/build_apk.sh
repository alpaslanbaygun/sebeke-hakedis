#!/bin/bash
# Şebeke-M (eski adı VOLT-EDAŞ Saha) APK üretimi (Gradle'sız): web paketi → aapt2 → ecj → d8 → hizalama → apksigner
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="${TOOLS:-/home/claude/tools}"
AAPT2="$T/aapt/package/bin/x64/linux/aapt2"; AJ="$T/minapk/package/tools/android.jar"
ECJ="$T/minapk/package/tools/ecj-3.45.0.jar"; D8="$T/minapk/package/tools/d8.jar"; SIGNER="$T/minapk/package/tools/apksigner.jar"
KS="$ROOT/keystore/voltsaha-release.jks"; KSPASS="${KSPASS:-VoltSaha2026!}"
B="$ROOT/build"; OUT="$ROOT/dist"
rm -rf "$B"; mkdir -p "$B/classes" "$B/dex" "$OUT"
echo "1/6 web paketi"; (cd "$ROOT/web" && node build.mjs --min)
echo "2/6 kaynaklar (aapt2)"
"$AAPT2" compile --dir "$ROOT/android/res" -o "$B/res.zip"
"$AAPT2" link -o "$B/base.apk" -I "$AJ" --manifest "$ROOT/android/AndroidManifest.xml" --auto-add-overlay "$B/res.zip"
echo "3/6 Java (ecj, Java 8 hedef)"
java -jar "$ECJ" -source 8 -target 8 -encoding UTF-8 -nowarn -bootclasspath "$ROOT/android/stubs/lambda-stub.jar:$AJ" -classpath "$AJ" -d "$B/classes" $(find "$ROOT/android/src" -name '*.java') > "$B/ecj.log" 2>&1 || true
if grep -q "ERROR in" "$B/ecj.log"; then grep -v JAVA_TOOL "$B/ecj.log"; echo "Java derleme hatası"; exit 1; fi
echo "   $(find "$B/classes" -name '*.class' | wc -l) sınıf"
echo "4/6 dex (d8)"
java -cp "$D8" com.android.tools.r8.D8 --release --min-api 26 --lib "$AJ" --output "$B/dex" $(find "$B/classes" -name '*.class') > "$B/d8.log" 2>&1 || { grep -v JAVA_TOOL "$B/d8.log"; exit 1; }
if strings "$B/dex/classes.dex" | grep -q LambdaMetafactory; then echo "Lambda desugar başarısız"; exit 1; fi
test -f "$B/dex/classes.dex"
echo "5/6 paketleme + hizalama"
python3 "$ROOT/tools/pack_apk.py" "$B/base.apk" "$B/dex" "$B/unsigned.apk" "assets/www/=$ROOT/web/dist/www"
if [ ! -f "$KS" ]; then keytool -genkeypair -keystore "$KS" -storepass "$KSPASS" -keypass "$KSPASS" -alias voltsaha -keyalg RSA -keysize 3072 -validity 12000 -dname "CN=VOLT-EDAS Saha, L=Elazig, C=TR" 2>&1 | grep -v JAVA_TOOL || true; fi
echo "6/6 imzalama (v2+v3)"
VER=$(grep -o 'versionName="[^"]*"' "$ROOT/android/AndroidManifest.xml" | cut -d'"' -f2)
APK="$OUT/Sebeke-M-$VER.apk"
java -jar "$SIGNER" sign --ks "$KS" --ks-pass "pass:$KSPASS" --key-pass "pass:$KSPASS" --ks-key-alias voltsaha --min-sdk-version 26 --out "$APK" "$B/unsigned.apk" 2>&1 | grep -v JAVA_TOOL || true
java -jar "$SIGNER" verify --print-certs "$APK" 2>&1 | grep -v JAVA_TOOL | head -4
"$AAPT2" dump badging "$APK" | head -3
ls -la "$APK"
