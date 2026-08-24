# Step 18：统一 CI 与 APK 构建入口

已增加统一 DSH Platform CI 和正式 Android APK build workflow。

CI 会先解压仓库中的源码包，再执行：

- DSH Smoke / Contract / Recovery
- 分层边界检查
- Android/JNI/Node/Runtime 构建链检查

APK workflow 使用 Node Mobile 固定提交、Android NDK 24、arm64、Runtime ZIP 和 debug APK 验收，产物会上传为 GitHub Actions artifact。
