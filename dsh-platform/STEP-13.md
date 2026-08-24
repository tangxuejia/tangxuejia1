# Step 13：云端 Smoke Test

新增 dsh-platform-check.yml，执行顺序为：

1. 检查九个核心层文件是否存在。
2. 检查 Harness 默认 arm64、127.0.0.1:3080 配置。
3. 在 dsh-platform 工作目录执行架构边界检查。
4. 检查恢复原型的 Android/JNI/Runtime 构建链。

该门禁只做结构与契约检查，不把 TypeScript 静态检查冒充成 Android APK 编译。
