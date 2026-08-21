# 菲语Tagalog 公众号自动运营系统 V2.0

第一阶段目标：先不接新闻 AI，只验证 GitHub Actions 能不能自动调用微信公众号接口，把测试文章生成到公众号草稿箱。

## 当前流程

```text
GitHub Actions
  -> node publisher.mjs
  -> 获取 access_token
  -> 上传测试封面或使用已有封面 thumb_media_id
  -> 调用 /cgi-bin/draft/add
  -> 输出 draft_media_id
  -> 手机公众号后台审核
```

## 文件结构

```text
wechat-publisher
├── publisher.mjs
├── package.json
├── package-lock.json
├── articles/
│   └── test.json
└── .github/
    └── workflows/
        └── publish.yml
```

## 必须先做的安全步骤

你之前截图里已经露出了 AppSecret，所以那一组 AppSecret 不要再使用。

请在公众号后台重新重置一次 AppSecret。新的 AppSecret 只填进 GitHub Secrets，不要截图，不要发聊天，不要写进代码。

## GitHub Secrets 设置

进入 GitHub 仓库：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

新增：

```text
WECHAT_APP_ID
WECHAT_APP_SECRET
```

可选：

```text
WECHAT_THUMB_MEDIA_ID
```

如果不设置 `WECHAT_THUMB_MEDIA_ID`，脚本会自动上传一个极简测试封面，然后用返回的 `thumb_media_id` 创建草稿。

## 第一次手动测试

进入 GitHub：

```text
Actions -> Publish WeChat Draft -> Run workflow
```

成功时日志会出现：

```text
draft_media_id=xxxx
publish_status=success
```

看到 `draft_media_id` 就代表：

```text
云端发布成功
公众号草稿创建成功
可以进入第二阶段新闻系统
```

## 常见失败

### 40164 invalid ip

这通常不是代码错误，而是公众号后台 IP 白名单没有放行 GitHub Actions 的出口 IP。

GitHub-hosted runner 的出口 IP 可能变化，所以如果持续报这个错误，建议走固定 IP 方案：

```text
方案 A：自建服务器 + self-hosted runner
方案 B：继续使用已经跑通过的 Termux 环境做固定发布端
方案 C：部署到有固定出口 IP 的云服务器
```

### 40001 invalid credential

检查：

```text
WECHAT_APP_ID
WECHAT_APP_SECRET
```

是否填错，或者 AppSecret 是否已经被重置。

### 40007 invalid media_id

如果你手动设置了 `WECHAT_THUMB_MEDIA_ID`，说明这个封面素材 ID 不可用。先删除这个 Secret，让脚本自动上传测试封面再试。

## 第二阶段接口

第一阶段跑通后，再接：

```text
菲律宾新闻采集
  -> 华人关注点筛选
  -> 爆款标题分析
  -> Taglish/Tagalog 学习文章生成
  -> 封面图/插图生成
  -> 公众号草稿箱
```
