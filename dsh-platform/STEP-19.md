# Step 19：原生 HAP 宿主骨架

已加入 HAP 宿主目录和 ArkTS 合约：

- dsh-platform/hap/entry/src/main/ets/bridge/HapNativeContract.ets
- dsh-platform/hap/entry/src/main/ets/pages/Index.ets

该层只负责宿主能力，不复制 Runtime 和 DSH Core。Android 卓易通路线继续使用现有 APK；原生 HAP 路线后续把这些契约绑定到真实文件、进程、压缩和 Native Node 实现。
