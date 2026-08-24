# Step 24：Node Runtime 目标隔离

已加入 Android arm64 与 OpenHarmony arm64 的目标选择器。

当前事实：

- Android APK 使用 Node Mobile Android arm64。
- 原生 HAP 需要单独的 OpenHarmony arm64 Native Node Runtime。
- 在 OpenHarmony 二进制未链接前，HAP manifest 保持 pending-native-link。
- 任何目标不匹配或未链接状态都会 fail-closed。
