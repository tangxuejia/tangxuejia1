# 每日唠唠谈 · 科技数码自动写作

这条生产线与 `wechat-news/`（菲语公众号）独立运行，共用 `publisher.mjs`、Agnes/OpenAI 和固定代理，不修改原公众号内容规则。

## 内容定位

- 科技数码热点
- AI 与大模型
- 手机与消费电子
- 软件与互联网
- 数码实用技巧
- 消费避坑 / 隐私安全
- 芯片硬件
- 智能汽车 / 机器人
- 科技行业观察

每天从 8 个候选发布时间中按日期确定 5–8 个执行时段。每个时段只生成 1 篇，先采集近期公开科技新闻，再写作、生成 1 张首屏封面 + 2 张正文图、执行 QC，最后进入微信公众号草稿箱。

## GitHub Secrets

必须配置：

- `WECHAT_DAILY_TALK_APP_ID`：每日唠唠谈 AppID
- `WECHAT_DAILY_TALK_APP_SECRET`：每日唠唠谈 AppSecret
- `WECHAT_DAILY_TALK_THUMB_MEDIA_ID`：该公众号可用的稳定永久封面素材 media_id
- `AGNES_API_KEY`：复用现有 Agnes Key
- `WECHAT_PROXY_URL`：复用现有固定出口代理

可选：

- `OPENAI_API_KEY`：Agnes 文本失败时的备用写作通道

## GitHub Variables

如果仓库已经配置现有变量，可以直接复用：

- `AGNES_BASE_URL`
- `AGNES_TEXT_MODEL`
- `AGNES_IMAGE_MODEL`
- `OPENAI_MODEL`

## 运行流程

`slot_guard.mjs` → `auto_writer.mjs` → `prepare_publish.mjs` → `publisher.mjs --dry-run` → `publisher.mjs`

如果新闻采集、图片生成、内容长度、排版、来源或微信 payload 任一项 QC 失败，本次任务直接失败，不把低质量内容送进草稿箱。
