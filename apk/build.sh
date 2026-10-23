#!/usr/bin/env bash
# 명제보드 APK 빌드 (Android Studio SDK만 사용 — 그래들·인터넷 불필요)
# 안드로이드 빌드 도구가 한글 경로를 열지 못해, 영문 임시 폴더에서 빌드한 뒤 결과만 가져옵니다.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT_APK="$HERE/../myeongje-board.apk"
SDK="${ANDROID_SDK:-/c/Users/user/AppData/Local/Android/Sdk}"
BT="$SDK/build-tools/36.0.0"
JAR="$SDK/platforms/android-37.0/android.jar"
JBR="${JBR:-/c/Program Files/Android/Android Studio/jbr}"
KS="${KEYSTORE:-/c/Users/user/myeongje-board.keystore}"   # 영문 경로에 보관 (지우지 마세요)
KSPASS="myeongje2026"
export JAVA_HOME="$(cygpath -w "$JBR")"
W="${BUILD_DIR:-/c/Users/user/AppData/Local/Temp/myeongje-apk}"

rm -rf "$W"; mkdir -p "$W/gen" "$W/classes" "$W/dex"
cp -r "$HERE/res" "$W/res"
cp -r "$HERE/java" "$W/java"
cp "$HERE/AndroidManifest.xml" "$W/AndroidManifest.xml"
cp "$HERE/addDex.py" "$W/addDex.py"

# 테스트용: BOARD_URL 환경변수가 있으면 앱이 여는 주소를 바꿔 빌드
if [ -n "$BOARD_URL" ]; then
  sed -i "s|https://jjeongi1434-rgb[.]github[.]io/myeongje-note/index[.]html[^\"]*|$BOARD_URL|" "$W/java/kr/myeongje/board/MainActivity.java"
  echo "    (테스트 주소로 빌드: $BOARD_URL)"
fi

echo "[1/6] 리소스 컴파일"
"$BT/aapt2.exe" compile --dir "$(cygpath -w "$W/res")" -o "$(cygpath -w "$W/res.zip")"

echo "[2/6] 리소스 링크"
"$BT/aapt2.exe" link -o "$(cygpath -w "$W/base.apk")" \
  --manifest "$(cygpath -w "$W/AndroidManifest.xml")" \
  -I "$(cygpath -w "$JAR")" "$(cygpath -w "$W/res.zip")" --java "$(cygpath -w "$W/gen")" \
  --min-sdk-version 21 --target-sdk-version 34 \
  --version-code 1 --version-name 1.0

echo "[3/6] 자바 컴파일"
find "$W/java" "$W/gen" -name '*.java' | while read -r f; do cygpath -w "$f"; done > "$W/sources.txt"
"$JBR/bin/javac.exe" --release 11 -nowarn -encoding UTF-8 \
  -classpath "$(cygpath -w "$JAR")" -d "$(cygpath -w "$W/classes")" "@$(cygpath -w "$W/sources.txt")"

echo "[4/6] DEX 변환"
find "$W/classes" -name '*.class' | while read -r f; do cygpath -w "$f"; done > "$W/classes.txt"
"$BT/d8.bat" --lib "$(cygpath -w "$JAR")" --min-api 21 \
  --output "$(cygpath -w "$W/dex")" "@$(cygpath -w "$W/classes.txt")"

echo "[5/6] APK 조립 · 정렬"
python "$W/addDex.py" "$W/base.apk" "$W/dex/classes.dex" "$W/unsigned.apk"
"$BT/zipalign.exe" -f -p 4 "$(cygpath -w "$W/unsigned.apk")" "$(cygpath -w "$W/aligned.apk")"

echo "[6/6] 서명"
if [ ! -f "$KS" ]; then
  "$JBR/bin/keytool.exe" -genkeypair -keystore "$(cygpath -w "$KS")" -storepass "$KSPASS" \
    -keypass "$KSPASS" -alias board -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Myeongje Board, OU=Class, O=School, L=Seoul, C=KR" >/dev/null
  echo "    새 서명 키를 만들었습니다: $KS (다음 버전을 만들 때 필요하니 지우지 마세요)"
fi
"$BT/apksigner.bat" sign --ks "$(cygpath -w "$KS")" --ks-pass "pass:$KSPASS" \
  --ks-key-alias board --key-pass "pass:$KSPASS" \
  --out "$(cygpath -w "$W/signed.apk")" "$(cygpath -w "$W/aligned.apk")"
"$BT/apksigner.bat" verify "$(cygpath -w "$W/signed.apk")" && echo "    서명 확인 OK"
cp "$W/signed.apk" "$OUT_APK"
echo "완성: $OUT_APK ($(du -h "$OUT_APK" | cut -f1))"
