# Step 14：TypeScript 编译门禁

已加入 dsh-platform/tsconfig.json 和独立 typecheck workflow。

编译范围覆盖：

- dsh-core
- device-layer
- runtime
- ui

使用 strict 模式、NodeNext 模块解析和 noEmit。该检查与 Android APK 构建分离：先保证分层代码接口一致，再进入重量级 Android SDK/NDK 构建。
