# HAP Host Adapter

这里是 OpenHarmony/HarmonyOS 宿主层骨架，不复制 Runtime 或 DSH Core 逻辑。

宿主需要实现四类能力：

- 文件：沙箱读写、Workspace 路径
- 进程：启动/停止嵌入式 Node
- Runtime：安装 dsh-runtime.zip、版本戳、staging 替换
- Archive：Workspace ZIP 导入/导出

实现完成后，通过回调接入 dsh-platform/device-layer/hap-bridge-template.ts。这样 Android 卓易通容器和原生 HAP 可以共用 Runtime、Harness、Workspace 和 DSH Core。
