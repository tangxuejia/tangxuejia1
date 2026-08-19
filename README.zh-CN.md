# DeepSeek Harness Mobile for Huawei Pura X / 卓易通

这是一个**纯手机版** DeepSeek Harness Android 封装工程。目标不是远程控制电脑，也不是把 DeepSeek 聊天网页套进 WebView，而是：

- APK 内嵌 **Node.js 24.5.0 arm64-v8a**
- APK 内嵌 **DeepSeek Harness `@deepseek-ai/dsh@0.1.0-rc.7`**
- Harness 直接在手机本机启动 `dsh web`
- Android WebView 只访问本机 `http://127.0.0.1:3080`
- 工作区、会话、Harness 设置/API Key 都保存在 App 私有目录
- 不依赖电脑、VPS、NAS 或局域网服务器
- 不依赖 Google Play Services
- 目标安装方式：在 HarmonyOS 上通过卓易通运行 APK

## 当前 V1 能力

| 能力 | V1 |
|---|---|
| Harness Web UI | ✅ 本机 |
| Node.js | ✅ 内嵌 24.5.0 arm64 |
| DeepSeek API / 模型设置 | ✅ 使用 Harness 原生设置页 |
| 会话持久化 | ✅ App 私有目录 |
| 文件读取/写入/替换 | ✅ 工作区内 |
| `bash` 工具 | ✅ Android `/system/bin/sh -c` 兼容层 |
| 后台普通命令 | ✅ 走 Node child_process |
| Web Search | ✅ 取决于 DeepSeek API Key / Harness 配置 |
| 项目导入 | ✅ ZIP → App 工作区 |
| 项目导出 | ✅ 工作区 → ZIP |
| Google 服务 | 不需要 |
| 电脑/VPS | 不需要 |
| 持久 PTY 交互终端 | ⚠️ V1 暂时禁用 |
| `rg` / packaged ripgrep 搜索工具 | ⚠️ V1 暂时禁用 |

### 为什么 V1 暂时禁用 PTY

DeepSeek Harness 的本地 PTY 层依赖 `node-pty` 原生模块。桌面预编译二进制不能直接拿到 Android arm64 使用。本工程在运行时构建阶段移除桌面 `node-pty` 导入，使整个 Harness 不会因为 PTY 原生模块而启动失败；普通命令执行仍然保留。

后续可做 V1.1：用 Android NDK + forkpty/openpty 实现 Harness `SubprocessTerminalHandle`，把持久终端补齐。

## 安全模型

Android APK 不申请广域共享存储权限。Harness 默认以：

`DSH_PERMISSION_MODE=danger-full-access`

运行，但这里的 “full access” 是**Android App UID 沙箱内部**的完整访问，不等于获得整台手机 root 权限。

为了避免静默执行，本工程额外覆盖 Harness `approval` 配置为 `ask`。

如果用户在 Harness 内把 DSH 权限模式切换回 `workspace-write` / `read-only`，Android 兼容 sandbox provider 会**失败关闭**，不会假装拥有 bwrap/Landlock。

## 构建 APK（推荐：GitHub Actions）

工程已经包含：

`.github/workflows/build-apk.yml`

把整个工程上传到一个 GitHub 仓库后：

1. 打开 **Actions**
2. 运行 **Build Pura X APK**
3. workflow 会自动：
   - 安装 Android SDK / NDK r24
   - 拉取并编译 Node.js Mobile 24.5.0 arm64
   - 安装 DeepSeek Harness 0.1.0-rc.7
   - 应用 Android 兼容补丁
   - 将完整 Harness runtime 压入 APK assets
   - 编译 `arm64-v8a` Debug APK
4. 在 Artifacts 下载：
   `deepseek-harness-pura-x-debug-apk`
5. 得到：
   `app-debug.apk`

Debug APK 已由 Android debug keystore 签名，可直接用于手机安装测试。

## 本地 Linux 构建

需要：

- JDK 17
- Android SDK Platform 35 / Build Tools 35.0.0
- Android NDK `24.0.8215888`
- CMake 3.22.1
- Gradle 8.9
- Node.js 24.5.0
- zip / rsync / gcc / g++ / multilib

### 1. 编译 Node.js Mobile

本工程固定使用 nodejs-mobile PR #158 的 Node 24.5.0 Android 分支提交：

`4608d3c670cf37b383dbe631de4992cf23da46e0`

编译 arm64：

```bash
./tools/android_build.sh "$ANDROID_HOME/ndk/24.0.8215888" 28 arm64
```

### 2. 装入 libnode + headers

```bash
./scripts/install-node-mobile-artifacts.sh /path/to/nodejs-mobile
```

### 3. 打包 Harness runtime

```bash
./scripts/package-runtime.sh
```

### 4. 编译 APK

```bash
gradle :app:assembleDebug
```

APK：

`app/build/outputs/apk/debug/app-debug.apk`

## 手机内部目录

启动后自动创建：

```text
/files/
├── dsh-runtime/     # Node 里运行的 Harness JS runtime
├── dsh-home/        # Harness settings / credentials / sessions
├── workspace/       # 默认项目工作区
├── tmp/             # Node/Harness 临时目录
└── home/            # 内嵌 Node HOME
```

这些都属于 App 私有目录。

## 项目导入/导出

App 菜单提供：

- **导入项目 ZIP**：使用 Android Storage Access Framework 选择 ZIP，再安全解压到 `workspace`
- **导出工作区 ZIP**：把当前 `workspace` 打包到用户选择的位置

解压做了 Zip Slip 路径检查。

## Node / Harness 启动链

```text
Pura X
  ↓
卓易通 Android 环境
  ↓
DeepSeek Harness Mobile APK
  ↓ JNI
libnode.so (Node.js 24.5.0, arm64-v8a)
  ↓
bootstrap.mjs
  ↓
@deepseek-ai/dsh
  ↓
dsh web --patch android.cordis.patch.yml --port 3080
  ↓
127.0.0.1:3080
  ↓
Android WebView
```

## Android 兼容补丁

`scripts/prepare-runtime.mjs` 在构建时完成四件事：

1. `@deepseek-ai/dsh-subprocess-local`
   - 去掉桌面 `node-pty` 顶层导入
   - PTY 被调用时给出明确“不支持”错误，而不是启动即崩

2. `@deepseek-ai/dsh-bash-local`
   - `bash -c` → `/system/bin/sh -c`

3. `@deepseek-ai/dsh-bash-sandbox`
   - 同样改为 `/system/bin/sh -c`

4. `@deepseek-ai/dsh-sandbox-local`
   - 替换桌面 bwrap/Landlock/Seatbelt/Windows ACL provider
   - Android 下 confined 模式失败关闭

另外，Standard preset 暂时关闭 packaged ripgrep 搜索工具，避免桌面架构 `rg` 二进制影响手机版。

## V1 真机验收

在 Pura X / 卓易通上至少完成：

- [ ] APK 成功安装
- [ ] 首次启动完成 runtime 解压
- [ ] WebView 打开 Harness 首页
- [ ] Harness Models 页面能保存 DeepSeek API Key
- [ ] 新建会话
- [ ] 模型能回复
- [ ] 读取工作区文件
- [ ] 新建/修改工作区文件
- [ ] `/system/bin/sh -c "pwd && ls"` 能执行
- [ ] ZIP 导入正常
- [ ] ZIP 导出正常
- [ ] 折叠/展开 Pura X 后 WebView 不白屏
- [ ] 外屏/内屏切换后会话不丢
- [ ] App 完全退出再打开，会话和工作区仍存在

## 已知风险 / 下一轮

1. **Node.js Mobile 24.5.0 目前来自尚未合并的上游 PR 分支**  
   已固定提交 SHA，避免上游分支变化造成不可复现。

2. **16 KB ELF page alignment**  
   workflow 会打印 `libnode.so` LOAD segment alignment。需要在 Pura X 真机安装阶段确认卓易通宿主的实际要求。

3. **PTY**
   V1 不让 `node-pty` 阻塞整个 Harness；V1.1 再实现 Android 原生 PTY provider。

4. **ripgrep**
   V1 暂时关闭 packaged ripgrep。可后续交叉编译 Android arm64 `rg`，再恢复 `tool-fs-search`。

5. **卓易通宿主差异**
   Android APK 能编译并不等于所有 HarmonyOS/卓易通版本行为完全一致，因此最终必须以 Pura X 真机为验收环境。

## 版本锁

- DeepSeek Harness: `0.1.0-rc.7`
- Embedded Node: `24.5.0`
- Node mobile source commit: `4608d3c670cf37b383dbe631de4992cf23da46e0`
- ABI: `arm64-v8a`
- Android minSdk: 28
- Android targetSdk: 35
