# WeChat News Autowriter

每天自动采集菲律宾新闻，生成一篇面向在菲律宾中国人的微信公众号菲语学习草稿。配置 Agnes API 后，正文用 Agnes 文本模型生成，封面图用 Agnes 图片模型生成；没有 API 时也会产出基础新闻采集草稿。

## 生成内容

- 新闻号风格标题
- 公众号摘要
- 中文新闻背景
- Filipino / Taglish 重点词句
- 菲律宾本地使用场景
- 封面图提示词
- 文中插图建议
- 标签
- 新闻来源链接
- Agnes 封面图 URL 或封面提示词

## 使用方式

1. 在 GitHub 仓库打开 `Settings -> Secrets and variables -> Actions`。
2. 添加 Secret：`AGNES_API_KEY`，用于 Agnes 文本生成和封面图生成。
3. 可选添加 Variable：`AGNES_TEXT_MODEL`，默认是 `agnes-2.5-flash`。
4. 可选添加 Variable：`AGNES_IMAGE_MODEL`，默认是 `agnes-image-2.1-flash`。
5. 可选添加 Secret：`OPENAI_API_KEY`，只作为 Agnes 文本失败时的备用。
6. 可选添加 Variable：`OPENAI_MODEL`，默认是 `gpt-4o-mini`。
7. 打开 `Actions -> WeChat News Autowriter`。
8. 点击 `Run workflow` 手动测试。

如果没有任何 API Key，workflow 仍会生成新闻采集草稿和封面提示词。

workflow 默认每天马尼拉时间早上 8 点运行一次。生成结果会保存到：

```text
wechat-news/drafts/YYYY-MM-DD-philippines-filipino-news.md
```

## 后续接公众号草稿箱

微信公众平台自动写入草稿箱还需要：

- 公众号 `APP_ID`
- 公众号 `APP_SECRET`
- GitHub Actions 出口 IP 加到公众号 IP 白名单
- 封面图上传后得到 `thumb_media_id`

这些齐了以后，可以在本目录继续增加 `wechat_publish.mjs`，把 Markdown 转成公众号草稿。
