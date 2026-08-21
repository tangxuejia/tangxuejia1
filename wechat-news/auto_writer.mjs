import fs from "node:fs/promises";
import path from "node:path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const AGNES_API_KEY = process.env.AGNES_API_KEY || "";
const AGNES_BASE_URL = process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com";
const AGNES_TEXT_MODEL = process.env.AGNES_TEXT_MODEL || "agnes-2.5-flash";
const AGNES_IMAGE_MODEL = process.env.AGNES_IMAGE_MODEL || "agnes-image-2.1-flash";
const OUT_DIR = process.env.OUT_DIR || "wechat-news/drafts";

const RSS_SOURCES = [
  { name: "Philstar", url: "https://www.philstar.com/rss/headlines" },
  { name: "Manila Bulletin", url: "https://mb.com.ph/rss" },
  { name: "Inquirer", url: "https://newsinfo.inquirer.net/feed" },
  { name: "ABS-CBN News", url: "https://news.abs-cbn.com/rss/news" },
  { name: "GMA News", url: "https://data.gmanetwork.com/gno/rss/news/feed.xml" },
];

const TOPIC_HINTS = [
  "china", "chinese", "embassy", "visa", "immigration", "pogo",
  "manila", "makati", "pasay", "binondo", "bamban", "airport",
  "typhoon", "weather", "traffic", "crime", "scam", "business",
  "shipping", "customs", "philippines", "davao", "cebu",
];

const FILIPINO_PHRASES = [
  ["Ingat po", "请注意安全 / 小心一点", "提醒台风、治安、交通时常用"],
  ["May advisory ba?", "有公告/提醒吗？", "问使馆、机场、物业、政府公告"],
  ["Saan ang affected area?", "受影响区域在哪里？", "问交通封路、停电、灾害影响范围"],
  ["Magkano ang dagdag?", "增加多少钱？", "问涨价、费用、附加费"],
  ["Open pa ba?", "还开着吗？", "问商场、银行、办公室是否营业"],
  ["Traffic ngayon", "现在堵车", "聊 EDSA、机场路、暴雨交通"],
  ["Valid ID", "有效证件", "办业务、入住、银行、实名常见词"],
  ["Announcement", "公告", "政府、学校、商场、物业通知"],
];

function todayManila() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function stripTags(input = "") {
  return input
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripTags(match?.[1] || "");
}

function parseRss(xml, source) {
  const blocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  return blocks.map((block) => ({
    source: source.name,
    title: pickTag(block, "title"),
    link: pickTag(block, "link"),
    description: pickTag(block, "description"),
    pubDate: pickTag(block, "pubDate"),
  })).filter((item) => item.title && item.link);
}

function scoreItem(item) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  return TOPIC_HINTS.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

function escapeMarkdown(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function agnesUrl(pathname) {
  const base = AGNES_BASE_URL.replace(/\/+$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (base.endsWith("/v1") && path.startsWith("/v1/")) {
    return `${base}${path.slice(3)}`;
  }
  return `${base}${path}`;
}

async function fetchNews() {
  const results = [];
  for (const source of RSS_SOURCES) {
    try {
      const response = await fetch(source.url, {
        headers: { "user-agent": "wechat-news-autowriter/1.0" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const xml = await response.text();
      results.push(...parseRss(xml, source));
    } catch (error) {
      results.push({
        source: source.name,
        title: `SOURCE_ERROR: ${source.name}`,
        link: source.url,
        description: String(error.message || error),
        pubDate: "",
        error: true,
      });
    }
  }

  const seen = new Set();
  return results
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return !item.error;
    })
    .map((item) => ({ ...item, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function buildPrompt(items, date) {
  const sourceList = items.map((item, index) => (
    `${index + 1}. [${item.source}] ${item.title}\n${item.description}\n${item.link}`
  )).join("\n\n");

  return `你是一个面向在菲律宾中国人的微信公众号编辑。请基于下面真实新闻源，写一篇公众号草稿。

硬要求：
- 不能虚构新闻事实，不能写来源没有支持的细节。
- 标题要像新闻号，吸引在菲律宾的中国人点击。
- 正文中文为主，融入实用 Filipino/Taglish 学习。
- 文章不是纯语言课，要先让读者觉得新闻有用。
- 不要写“AI生成”。
- 给出公众号摘要、封面图提示词、文中插图建议、标签。
- 如果新闻源信息不足，明确用“据公开报道/目前可确认的是”这种写法。

输出 Markdown，结构如下：
# 标题

> 公众号摘要：

## 今天新闻
## 为什么在菲律宾的中国人要关注
## 新闻里能学到的 Filipino / Taglish
## 菲律宾人可能怎么说
## 在本地怎么用
## 可直接复制的朋友圈/群聊短句
## 封面图提示词
## 文中插图建议
## 标签
## 来源

日期：${date}

新闻源：
${sourceList}`;
}

async function generateWithOpenAI(prompt) {
  if (!OPENAI_API_KEY) return "";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "你写中文微信公众号文章，重视真实新闻、菲律宾本地语境和实用语言学习。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function generateWithAgnesText(prompt) {
  if (!AGNES_API_KEY) return "";

  const response = await fetch(agnesUrl("/v1/chat/completions"), {
    method: "POST",
    headers: {
      "authorization": `Bearer ${AGNES_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: AGNES_TEXT_MODEL,
      messages: [
        { role: "system", content: "你写中文微信公众号文章，重视真实新闻、菲律宾本地语境和实用 Filipino / Taglish 学习。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Agnes text API failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function generateArticle(prompt, items, date) {
  const errors = [];

  try {
    const agnesDraft = await generateWithAgnesText(prompt);
    if (agnesDraft) return { draft: agnesDraft, errors };
  } catch (error) {
    errors.push(String(error.message || error));
  }

  try {
    const openaiDraft = await generateWithOpenAI(prompt);
    if (openaiDraft) return { draft: openaiDraft, errors };
  } catch (error) {
    errors.push(String(error.message || error));
  }

  let draft = fallbackDraft(items, date);
  if (errors.length) {
    draft += `\n\n## 自动生成备注\n\n文本模型调用失败，本次已自动退回新闻采集草稿。\n\n${errors.map((item) => `- ${item}`).join("\n")}\n`;
  }
  return { draft, errors };
}

function fallbackDraft(items, date) {
  const lead = items[0];
  const pickedPhrases = FILIPINO_PHRASES.slice(0, 6)
    .map(([phrase, meaning, usage]) => `- **${phrase}**：${meaning}。用法：${usage}。`)
    .join("\n");

  const sourceLines = items.map((item, index) => {
    const description = escapeMarkdown(item.description);
    return `${index + 1}. **${escapeMarkdown(item.title)}**\n   - 来源：${item.source}\n   - 摘要：${description || "RSS 未提供摘要，请点开来源核对细节。"}\n   - 链接：${item.link}`;
  }).join("\n\n");

  const title = lead
    ? `菲律宾今天这条新闻，住在本地的中国人要看一下`
    : `菲律宾新闻菲语学习草稿 ${date}`;

  return `# ${title}

> 公众号摘要：今天整理菲律宾本地新闻线索，顺便学几句在马尼拉、宿务、达沃都能用上的 Filipino / Taglish 表达。本文为自动采集草稿，发布前请点开来源核对最新细节。

## 今天新闻

今天菲律宾本地新闻里，最值得先看的线索是：

**${lead ? escapeMarkdown(lead.title) : "今日新闻源暂未抓到高优先级线索"}**

${lead?.description ? escapeMarkdown(lead.description) : "这条新闻需要点开原文继续核对细节，尤其是时间、地点、官方说法和是否影响中国人日常生活。"}

## 为什么在菲律宾的中国人要关注

在菲律宾生活，很多事情不是“看不看新闻”的问题，而是会不会影响今天出门、办证、汇款、收货、上班、接孩子、去机场。

这类新闻可以重点看四点：

- 是否影响马尼拉、Makati、Pasay、Binondo、机场、港口或华人常去区域
- 是否涉及签证、移民局、使馆提醒、治安、诈骗、台风、交通
- 是否影响电商、物流、汇率、消费、商场营业和本地办事
- 是否有官方公告，避免只看群聊转发

## 新闻里能学到的 Filipino / Taglish

${pickedPhrases}

## 菲律宾人可能怎么说

- **May announcement ba today?** 今天有什么公告吗？
- **Traffic ba papunta airport?** 去机场堵不堵？
- **Affected ba ang area natin?** 我们这个区域受影响吗？
- **Ingat kayo, malakas ang ulan.** 大家小心，雨很大。
- **Check muna natin ang official source.** 我们先查官方来源。

## 在本地怎么用

你可以把今天的新闻转成很实用的本地问法：

- 问物业：**May advisory ba sa building today?**
- 问司机：**Traffic ba sa route na ito?**
- 问朋友：**Affected ba kayo diyan?**
- 问办公室：**Open pa ba today?**

## 可直接复制的朋友圈/群聊短句

今天菲律宾新闻有几条值得在本地生活的人留意，尤其是涉及交通、天气、办事和安全的内容。大家转发前最好先点开官方或主流媒体来源确认，不要只看群聊截图。顺便学一句：**Ingat po**，就是“请注意安全、小心一点”的意思，在菲律宾很常用。

## 封面图提示词

新闻公众号封面，菲律宾马尼拉城市街景，中文读者关注菲律宾本地新闻，画面里有手机新闻界面、 jeepney、马尼拉天际线、温暖但专业的新闻编辑风格，3:4 竖版，无文字，无水印，清晰明亮。

## 文中插图建议

- 菲律宾城市街景或交通图
- 手机查看新闻/公告的生活化场景
- 简洁的 Filipino / Taglish 词句卡片

## 候选新闻源

${sourceLines}

## 标签

菲律宾新闻, 菲语学习, Taglish, 马尼拉生活, 菲律宾华人, 海外生活
`;
}

function buildCoverPrompt(items) {
  const lead = items[0];
  const topic = lead ? escapeMarkdown(lead.title) : "daily Philippine local news";
  return [
    "A professional WeChat article cover image for Chinese readers living in the Philippines.",
    "Scene: Manila city street, phone showing local news, subtle jeepney silhouette, warm daylight, clear editorial style.",
    `Topic reference: ${topic}.`,
    "No readable text, no logo, no watermark, clean composition, 3:4 vertical cover, bright and trustworthy.",
  ].join(" ");
}

async function generateAgnesCover(prompt) {
  if (!AGNES_API_KEY) return null;

  const response = await fetch(agnesUrl("/v1/images/generations"), {
    method: "POST",
    headers: {
      "authorization": `Bearer ${AGNES_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: AGNES_IMAGE_MODEL,
      prompt,
      size: "2K",
      ratio: "3:4",
      extra_body: { response_format: "url" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Agnes API failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.data?.[0]?.url || null;
}

async function appendCoverBlock(draft, items) {
  const coverPrompt = buildCoverPrompt(items);
  let coverUrl = null;
  let coverError = "";
  try {
    coverUrl = await generateAgnesCover(coverPrompt);
  } catch (error) {
    coverError = String(error.message || error);
  }
  const block = coverUrl
    ? `\n\n## Agnes 封面图\n\n${coverUrl}\n\n## Agnes 封面提示词\n\n${coverPrompt}\n`
    : `\n\n## Agnes 封面提示词\n\n${coverPrompt}\n\n> ${AGNES_API_KEY ? `Agnes 封面图生成失败：${coverError}` : "未配置 AGNES_API_KEY，本次只生成封面提示词。配置后可自动生成封面图 URL。"}\n`;
  return `${draft.trim()}\n${block}`;
}

async function main() {
  const date = todayManila();
  const items = await fetchNews();
  if (!items.length) throw new Error("No news items fetched.");

  const prompt = buildPrompt(items, date);
  const { draft: articleDraft } = await generateArticle(prompt, items, date);
  const draft = await appendCoverBlock(articleDraft, items);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, `${date}-philippines-filipino-news.md`);
  await fs.writeFile(filePath, `${draft}\n`, "utf8");
  console.log(`Wrote ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
