# Third-party notices

This wrapper project contains build integration code only. The APK produced by
the build workflow embeds third-party open-source components.

- DeepSeek Harness — deepseek-ai/deepseek-harness — MIT
- Node.js / nodejs-mobile — Node.js project and nodejs-mobile project licenses
- Android WebView — provided by the Android-compatible runtime on the device

Before redistributing a built APK publicly, preserve all license notices shipped
inside the embedded packages and review the licenses of transitive npm
dependencies.

The Node.js Mobile 24.5.0 source used by this project is pinned to an upstream
PR head commit because the stable nodejs-mobile release line does not satisfy
DeepSeek Harness's Node version floor.
