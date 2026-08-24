# CI Check

云端门禁目前分两部分：

1. scripts/verify-build-chain.mjs 检查恢复原型的 Android/JNI/Node/Runtime 构建链。
2. scripts/check-boundaries.mjs 检查 UI、DSH Core、Runtime 的禁止依赖。

核心代码位于 dsh-platform/，原型构建输入位于 prototype/imported/。真实 APK 编译仍由原型目录内的 Android workflow 执行。
