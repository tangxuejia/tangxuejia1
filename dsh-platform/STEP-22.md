# Step 22：APK Workflow 自检

已增加构建前静态检查，确认 APK workflow 必须包含：

- 源码 ZIP 解压
- Node Mobile arm64
- Android NDK 24
- DeepSeek Harness Runtime
- assembleDebug
- APK payload 验收
- SHA256 和构建 manifest
- Actions artifact 上传

该门禁只验证 workflow 合同，不替代真实 Android SDK/NDK 编译。
