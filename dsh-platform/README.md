# Huawei DSH Platform

当前架构已拆分为四层：

- UI：WebView/ArkUI 会话与页面模型
- Device Layer：Huawei/HAP 宿主桥接
- Runtime：Node、Harness、Runtime 安装、Workspace ZIP、进程恢复
- DSH Core：平台无关的服务契约与生命周期

恢复的 Android 原型位于 prototype/imported，目标链路为：

Pura X / Huawei device -> host container -> embedded Node.js 24 arm64 -> DeepSeek Harness -> 127.0.0.1:3080 -> WebView

当前已完成 Step 1–9：原型清单、分层契约、HAP 适配模板、Runtime 安装安全规则、Node/Harness 启动链和 GitHub 构建门禁。后续同步应保持上述四层边界，不直接把 Android/JNI API 引入 DSH Core 或 UI。
