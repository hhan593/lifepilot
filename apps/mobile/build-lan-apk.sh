#!/usr/bin/env bash
# 打一个「局域网直连」APK：API 地址指向当前 Mac 的局域网 IP。
# 用法：Mac 上先启动 API（pnpm --filter @lifepilot/api start 或 pnpm dev:api），
#       手机与本机连同一 Wi-Fi，运行本脚本，然后把产物 APK 传到手机安装。
# 签名前提（一次性）：~/.gradle/gradle.properties 里加两行——
#   LIFEPILOT_UPLOAD_STORE_PASSWORD=<keystore 密码>
#   LIFEPILOT_UPLOAD_KEY_PASSWORD=<key 密码>
# （本地 keystore 在 android/app/lifepilot-release.keystore，密码见生成记录）
set -euo pipefail
cd "$(dirname "$0")"

IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || true)
if [ -z "${IP:-}" ]; then
  echo "未找到局域网 IP（确认 Wi-Fi 已连接）"
  exit 1
fi
echo "API 地址：http://$IP:4000/api/v1"

# 没设 JAVA_HOME 时用系统默认 JDK（RN 0.88 需 JDK 17+）
EXPO_PUBLIC_API_BASE="http://$IP:4000/api/v1" \
  android/gradlew -p android clean assembleRelease --no-daemon

APK="$(pwd)/android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "✅ APK 已生成：$APK"
echo "   传到手机安装（允许未知来源），登录账号见 prisma/seed.ts。"
echo "   使用时保持 Mac 上 API 在运行。"
