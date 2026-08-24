# Step 21：APK 产物追踪

Android 构建 workflow 现在会同时上传：

- app-debug.apk
- app-debug.apk.sha256
- dsh-build-manifest.txt

Manifest 固定记录 app、Node、Harness、arm64-v8a、127.0.0.1:3080 和 GitHub commit。后续实机安装测试必须使用同一批 APK 与 manifest，避免测试错包。
