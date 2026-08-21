import fs from "node:fs/promises";
import path from "node:path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
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

function fallbackDraft(items, date) {
  const sourceLines = items.map((item, index) => (
    `${index + 1}. ${item.title}\n   来源：${item.source}\n   链接：${item.link}`
  )).join("\n");

  return `# 菲律宾新闻菲语学习草稿 ${date}

> 公众号摘要：今天先完成新闻采集。由于没有配置 OPENAI_API_KEY，本次只输出候选新闻源，配置密钥后会自动生成完整公众号文章。

## 候选新闻
${sourceLines}

## 下一步
在 GitHub 仓库 Settings → Secrets and variables → Actions 里添加 \`OPENAI_API_KEY\`，然后重新运行 workflow。
`;
}

async function main() {
  const date = todayManila();
  const items = await fetchNews();
  if (!items.length) throw new Error("No news items fetched.");

  const prompt = buildPrompt(items, date);
  const generated = await generateWithOpenAI(prompt);
  const draft = generated || fallbackDraft(items, date);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, `${date}-philippines-filipino-news.md`);
  await fs.writeFile(filePath, `${draft}\n`, "utf8");
  console.log(`Wrote ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
