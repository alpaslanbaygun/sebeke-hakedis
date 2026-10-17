#!/bin/bash
# APK derleme araçlarını kurar (Android Studio / Gradle gerekmez). Gerekenler: node + npm, Java 17+.
# Kullanım:  ./tools/setup_tools.sh  [hedef klasör, varsayılan ../tools]
#            TOOLS=<hedef klasör> ./tools/build_apk.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="${1:-$(cd "$ROOT/.." && pwd)/tools}"
mkdir -p "$T" && cd "$T"
npm pack aaptjs3@2.0.2 @drxiaozhi/minapk@0.4.0 >/dev/null
rm -rf aapt minapk && mkdir aapt minapk
tar -xzf aaptjs3-2.0.2.tgz -C aapt
tar -xzf drxiaozhi-minapk-0.4.0.tgz -C minapk
chmod +x aapt/package/bin/x64/linux/aapt2 || true
for f in aapt/package/bin/x64/linux/aapt2 minapk/package/tools/android.jar minapk/package/tools/ecj-3.45.0.jar minapk/package/tools/d8.jar minapk/package/tools/apksigner.jar; do test -f "$f" || { echo "Eksik: $f"; exit 1; }; done
echo "Araçlar hazır: $T"
echo "APK için:  TOOLS=$T ./tools/build_apk.sh"
