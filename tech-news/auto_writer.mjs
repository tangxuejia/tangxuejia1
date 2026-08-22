import fs from 'node:fs/promises';
import path from 'node:path';

const config = JSON.parse(await fs.readFile('tech-news/account.json', 'utf8'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AGNES_API_KEY = process.env.AGNES_API_KEY || '';
const AGNES_BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
const AGNES_TEXT_MODEL = process.env.AGNES_TEXT_MODEL || 'agnes-2.5-flash';
const AGNES_IMAGE_MODEL = process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.1-flash';
const OUTPUT_DIR = process.env.OUT_DIR || 'tech-news/output';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'daily.json');
const EDITORIAL_LANE = process.env.TECH_EDITORIAL_LANE || '科技热点';
const ARTICLE_INDEX = Number(process.env.TECH_ARTICLE_INDEX || 0);
const MANILA_DATE = process.env.TECH_MANILA_DATE || todayManila();

const BASE_RSS_SOURCES = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', weight: 3 },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', weight: 3 },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', weight: 3 },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', weight: 3 },
  { name: '9to5Mac', url: 'https://9to5mac.com/feed/', weight: 2 },
  { name: 'Android Authority', url: 'https://www.androidauthority.com/feed/', weight: 2 },
];

const LANE_KEYWORDS = {
  'AI与大模型': ['ai', 'artificial intelligence', 'openai', 'chatgpt', 'deepseek', 'gemini', 'claude', 'llm', 'model', 'nvidia', '人工智能', '大模型'],
  '手机与消费电子': ['iphone', 'smartphone', 'android', 'apple', 'huawei', 'xiaomi', 'samsung', 'honor', 'oppo', 'vivo', 'pixel', 'fold', '手机', '华为', '小米', '苹果'],
  '软件与互联网': ['app', 'software', 'windows', 'ios', 'android', 'browser', 'google', 'meta', 'microsoft', 'platform', '软件', '互联网'],
  '数码实用技巧': ['feature', 'update', 'battery', 'storage', 'backup', 'settings', 'tips', 'privacy', 'security', '功能', '更新', '续航', '存储'],
  '消费避坑与隐私安全': ['scam', 'privacy', 'breach', 'malware', 'subscription', 'recall', 'security', 'fraud', '漏洞', '隐私', '诈骗', '召回'],
  '芯片与硬件': ['chip', 'semiconductor', 'nvidia', 'qualcomm', 'mediatek', 'intel', 'amd', 'tsmc', 'gpu', 'cpu', '芯片', '半导体'],
  '智能汽车与机器人': ['tesla', 'ev', 'robot', 'robotics', 'autonomous', 'waymo', 'vehicle', 'humanoid', '机器人', '智能汽车', '自动驾驶'],
  '科技行业观察': ['startup', 'acquisition', 'antitrust', 'regulation', 'earnings', 'layoff', 'market', 'business', '收购', '监管', '裁员', '科技公司'],
};

function todayManila() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone || 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function decodeEntities(input = '') {
  return String(input)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(input = '') {
  return decodeEntities(input)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagValue(block, names) {
  for (const tag of names) {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (match?.[1]) return stripTags(match[1]);
  }
  return '';
}

function atomLink(block) {
  const match = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return decodeEntities(match?.[1] || '').trim();
}

function parseFeed(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const entryBlocks = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;

  return blocks.map((block) => {
    const isAtom = /^<entry\b/i.test(block.trim());
    return {
      source: source.name,
      sourceWeight: source.weight,
      title: tagValue(block, ['title']),
      link: isAtom ? atomLink(block) : tagValue(block, ['link']),
      description: tagValue(block, ['description', 'summary', 'content']),
      pubDate: tagValue(block, ['pubDate', 'published', 'updated']),
    };
  }).filter((item) => item.title && item.link);
}

function laneQuery(lane) {
  const map = {
    'AI与大模型': 'AI OR OpenAI OR DeepSeek OR Gemini technology',
    '手机与消费电子': 'smartphone OR iPhone OR Huawei OR Xiaomi OR Samsung',
    '软件与互联网': 'software OR app OR Google OR Microsoft technology',
    '数码实用技巧': 'phone update battery privacy feature technology',
    '消费避坑与隐私安全': 'tech privacy security scam breach consumer',
    '芯片与硬件': 'chip semiconductor Nvidia Qualcomm AMD Intel',
    '智能汽车与机器人': 'robot robotics EV autonomous driving technology',
    '科技行业观察': 'technology company regulation acquisition startup',
  };
  return map[lane] || 'technology AI smartphone software';
}

function googleNewsSource(query, name) {
  return {
    name,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
    weight: 4,
  };
}

function ageHours(pubDate) {
  const ts = Date.parse(pubDate || '');
  if (!Number.isFinite(ts)) return 999;
  return Math.max(0, (Date.now() - ts) / 3_600_000);
}

function normalizeKey(title) {
  return stripTags(title).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
}

function scoreItem(item) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  let score = item.sourceWeight || 0;
  const keywords = LANE_KEYWORDS[EDITORIAL_LANE] || [];
  for (const keyword of keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 7;
  }

  const broad = ['apple', 'google', 'microsoft', 'openai', 'deepseek', 'huawei', 'xiaomi', 'samsung', 'nvidia', 'meta', 'tesla', 'ai', 'iphone'];
  for (const keyword of broad) {
    if (haystack.includes(keyword)) score += 2;
  }

  const age = ageHours(item.pubDate);
  if (age <= 6) score += 16;
  else if (age <= 12) score += 12;
  else if (age <= 24) score += 9;
  else if (age <= 48) score += 5;
  else if (age <= 72) score += 2;
  else if (age > 120) score -= 14;

  return score;
}

async function fetchOneSource(source) {
  const response = await fetch(source.url, {
    headers: { 'user-agent': 'Mozilla/5.0 daily-talk-wechat/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return parseFeed(await response.text(), source);
}

async function fetchNews() {
  const sources = [
    ...BASE_RSS_SOURCES,
    googleNewsSource(laneQuery(EDITORIAL_LANE), `Google News · ${EDITORIAL_LANE}`),
    googleNewsSource('Huawei OR Xiaomi OR Apple OR DeepSeek OR AI China technology', 'Google News · 中文用户关注'),
  ];

  const settled = await Promise.allSettled(sources.map(fetchOneSource));
  const all = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') all.push(...result.value);
    else console.warn(`rss_failed=${sources[i].name}:${String(result.reason?.message || result.reason)}`);
  });

  const seen = new Set();
  const ranked = all.filter((item) => {
    const key = normalizeKey(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({
    ...item,
    ageHours: ageHours(item.pubDate),
    score: scoreItem(item),
  })).filter((item) => item.ageHours <= 120)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) throw new Error('No recent tech news fetched from configured sources.');

  const primaryIndex = ARTICLE_INDEX % Math.min(6, ranked.length);
  const primary = ranked[primaryIndex];
  const materials = [primary, ...ranked.filter((_, index) => index !== primaryIndex)].slice(0, 10);
  console.log(`news_items=${materials.length}`);
  console.log(`editorial_lane=${EDITORIAL_LANE}`);
  console.log(`primary_source=${primary.source}`);
  console.log(`primary_title=${primary.title}`);
  return materials;
}

function extractOgImage(html) {
  const patterns = [
    /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return '';
}

async function enrichItem(item) {
  try {
    const response = await fetch(item.link, {
      headers: { 'user-agent': 'Mozilla/5.0 daily-talk-wechat/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return item;
    const html = await response.text();
    const text = stripTags(html);
    return {
      ...item,
      excerpt: text.slice(0, 2600),
      ogImage: extractOgImage(html),
      finalUrl: response.url || item.link,
    };
  } catch {
    return item;
  }
}

async function enrichNews(items) {
  const enriched = await Promise.all(items.slice(0, 6).map(enrichItem));
  return [...enriched, ...items.slice(6)];
}

function agnesUrl(pathname) {
  const base = AGNES_BASE_URL.replace(/\/+$/, '');
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (base.endsWith('/v1') && p.startsWith('/v1/')) return `${base}${p.slice(3)}`;
  return `${base}${p}`;
}

function sourceText(items) {
  return items.map((item, i) => [
    `${i + 1}. [${item.source}] ${item.title}`,
    `发布时间: ${item.pubDate || '来源未提供'}`,
    `摘要: ${item.description || '来源未提供摘要'}`,
    item.excerpt ? `页面摘录: ${item.excerpt}` : '',
    `链接: ${item.finalUrl || item.link}`,
  ].filter(Boolean).join('\n')).join('\n\n');
}

function buildWriterPrompt(items) {
  return `你是微信公众号“${config.account}”的科技数码主编。今天是 ${MANILA_DATE}，本篇编辑方向是“${EDITORIAL_LANE}”。\n\n账号定位：${config.positioning}。过去发过科技数码，现在继续做科技内容。读者不是科技从业者，而是普通手机、电脑、AI工具用户。\n\n最重要的规则：\n- 只能依据下面提供的新闻材料写，不得补造参数、价格、日期、销量、政策、发布会内容或人物表态。\n- 第1条材料是本篇首选主新闻；材料不足时宁可写保守，不要硬凑。\n- 新闻与评论必须分开。事实用“公开信息显示/报道提到”，判断用“我更关心的是/我觉得值得注意的是”。\n- 像一个长期玩数码的人在和读者聊天，不要写成通讯社稿件，不要有AI腔。\n- 禁止使用“首先、其次、最后、综上所述、值得一提的是、赋能、生态闭环”等模板腔。\n- 每段1到3句，句子别太长。可以有态度，但不能标题党。\n- 标题最好18到28个中文字符，突出“这事跟普通人有什么关系”。\n- 不要在标题和正文乱放emoji。\n- 不要写“AI生成”“根据提示词”“作为AI”等字样。\n- 全文约1200到1800个中文字符。\n\n只输出合法JSON，不要Markdown代码围栏。所有字段必须是纯文本，不要HTML：\n{\n  "title":"",\n  "digest":"",\n  "kicker":"",\n  "lead":"",\n  "what_happened":"",\n  "why_it_matters":"",\n  "practical":"",\n  "take":"",\n  "ending":""\n}\n\n字段要求：\n- kicker：15-35字，一句话点出今天为什么聊它。\n- lead：开场钩子，80-160字，不复述标题。\n- what_happened：把已确认事实讲明白，约250-400字。\n- why_it_matters：解释普通用户、消费者或行业为什么需要关注，约250-400字。\n- practical：给2-4条真正能用的判断、设置、购买或观望建议；用换行分条，不要编号模板化。\n- take：主编自己的克制判断，约180-300字，事实和观点分开。\n- ending：30-80字，用一个具体问题邀请评论。\n- digest：不超过90字。\n\n新闻材料：\n${sourceText(items)}`;
}

async function generateWithAgnes(prompt) {
  if (!AGNES_API_KEY) return '';
  const response = await fetch(agnesUrl('/v1/chat/completions'), {
    method: 'POST',
    headers: { authorization: `Bearer ${AGNES_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: AGNES_TEXT_MODEL,
      messages: [
        { role: 'system', content: '你是严谨但有聊天感的中文科技公众号主编。只根据用户提供的新闻材料写，输出严格JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 5200,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Agnes text API failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function generateWithOpenAI(prompt) {
  if (!OPENAI_API_KEY) return '';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: '你是严谨但有聊天感的中文科技公众号主编。只根据用户提供的新闻材料写，输出严格JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI text API failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function parseJsonObject(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('Writer model did not return valid JSON.');
}

function ensureArticle(obj) {
  const keys = ['title', 'digest', 'kicker', 'lead', 'what_happened', 'why_it_matters', 'practical', 'take', 'ending'];
  for (const key of keys) {
    if (typeof obj?.[key] !== 'string' || !obj[key].trim()) throw new Error(`Missing generated field: ${key}`);
  }
  return obj;
}

function fallbackArticle(items) {
  const lead = items[0];
  return {
    title: `这条科技消息，真正值得普通用户关注的是这一点`,
    digest: stripTags(lead.description || lead.title).slice(0, 90),
    kicker: `今天这条消息不只属于科技圈，普通用户也值得看一眼。`,
    lead: `最近科技新闻很多，但真正值得花时间看的，是那些会改变我们怎么用手机、软件和AI工具的变化。今天先聊聊“${lead.title}”。`,
    what_happened: `公开报道显示，${lead.title}。${lead.description || '目前公开材料提供的细节有限，具体信息仍应以相关公司和正式渠道后续说明为准。'}`,
    why_it_matters: `这类变化真正影响普通人的，往往不是发布会上的一句口号，而是产品会不会更好用、原来的设备还能不能继续用、要不要现在花钱，以及隐私和订阅成本会不会发生变化。信息还没完全明确时，不急着跟风通常更稳妥。`,
    practical: `准备购买相关产品的人，可以先等正式规格和实际体验出来再决定。\n已经在用现有产品的人，先确认更新、兼容性和账号数据是否受影响。\n涉及订阅、隐私或安全的变化，优先查看官方设置页面和正式说明，不要只看二手截图。`,
    take: `我更关心的是这件事最终能不能给普通用户带来可感知的变化。如果只是参数、命名或营销话术更新，没必要焦虑；如果它真的改变价格、功能、兼容性或使用门槛，那才值得认真考虑。`,
    ending: `你更在意这条消息里的新功能，还是它可能带来的价格和使用成本变化？`,
  };
}

async function generateArticle(items) {
  const prompt = buildWriterPrompt(items);
  const errors = [];

  if (AGNES_API_KEY) {
    try {
      const text = await generateWithAgnes(prompt);
      if (text) return ensureArticle(parseJsonObject(text));
    } catch (error) {
      errors.push(`agnes:${String(error.message || error)}`);
    }
  }

  if (OPENAI_API_KEY) {
    try {
      const text = await generateWithOpenAI(prompt);
      if (text) return ensureArticle(parseJsonObject(text));
    } catch (error) {
      errors.push(`openai:${String(error.message || error)}`);
    }
  }

  console.warn(`writer_fallback=${errors.join(' | ') || 'no text API key available'}`);
  return fallbackArticle(items);
}

function imagePrompts(article, items) {
  const references = items.slice(0, 3).map((x) => x.title).join(' | ');
  const common = 'Premium editorial documentary photography for a Chinese technology WeChat article. Modern real-world consumer technology, believable lighting and materials, sophisticated magazine composition, no readable screen text, no fake logos, no watermark, no captions, no sci-fi holograms, no distorted hands, no fake product branding.';
  return {
    cover: `${common} 21:9 wide hero image, one strong focal point, generous negative space, visually communicates this topic without pretending to show an unreleased exact product. Article: ${article.title}. References: ${references}`,
    inline1: `${common} 3:2 landscape inline image. A realistic everyday user interacting with technology related to this story; focus on the human consequence and practical use, not a fake product render. Theme: ${article.why_it_matters.slice(0, 500)}`,
    inline2: `${common} 3:2 landscape inline image. Practical consumer decision scene: comparing settings, device choices, privacy/security or purchase considerations appropriate to the article. Theme: ${article.practical.slice(0, 500)}`,
  };
}

async function generateAgnesImage(prompt, id) {
  if (!AGNES_API_KEY) throw new Error('AGNES_API_KEY missing');
  const response = await fetch(agnesUrl('/v1/images/generations'), {
    method: 'POST',
    headers: { authorization: `Bearer ${AGNES_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: AGNES_IMAGE_MODEL,
      prompt,
      size: '2K',
      ratio: id === 'cover' ? '21:9' : '3:2',
      extra_body: { response_format: 'url' },
    }),
  });
  if (!response.ok) throw new Error(`Agnes image API failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('Agnes image API returned no URL');
  return url;
}

async function imageFromUrl(url, id) {
  const response = await fetch(url, { signal: AbortSignal.timeout(35_000) });
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const rawMime = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const mime = ['image/jpeg', 'image/png', 'image/gif'].includes(rawMime) ? rawMime : 'image/jpeg';
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : 'jpg';
  return { id, filename: `daily-talk-${id}.${ext}`, mime, alt: '', base64: bytes.toString('base64') };
}

async function generateImages(article, items) {
  const prompts = imagePrompts(article, items);
  const images = [];
  for (const id of ['cover', 'inline1', 'inline2']) {
    const url = await generateAgnesImage(prompts[id], id);
    images.push(await imageFromUrl(url, id));
    console.log(`agnes_image_generated=${id}`);
  }
  return images;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toParagraphs(value, style = '') {
  const text = String(value || '').trim();
  let chunks = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (chunks.length === 1 && text.length > 180) {
    const sentences = text.split(/(?<=[。！？!?])/).map((x) => x.trim()).filter(Boolean);
    chunks = [];
    for (let i = 0; i < sentences.length; i += 2) chunks.push(sentences.slice(i, i + 2).join(''));
  }
  const extra = style ? `;${style}` : '';
  return chunks.map((chunk) => `<p style="margin:12px 0${extra}">${escapeHtml(chunk)}</p>`).join('');
}

function practicalHtml(value) {
  const lines = String(value || '').split(/\n+/).map((x) => x.replace(/^[-•\d.、\s]+/, '').trim()).filter(Boolean);
  return lines.map((line) => `<p style="margin:11px 0;padding:12px 14px;background:#f7f8fa;border-radius:8px;"><strong>·</strong> ${escapeHtml(line)}</p>`).join('');
}

function heading(text) {
  return `<h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;color:#171717;font-weight:700;border-left:4px solid #222;padding-left:10px;">${escapeHtml(text)}</h2>`;
}

function buildHtml(article, items) {
  const sources = items.slice(0, 5).map((item) =>
    `<p style="margin:5px 0;color:#999;font-size:12px;line-height:1.65;">${escapeHtml(item.source)} · ${escapeHtml(item.title)}</p>`
  ).join('');

  return `<section style="font-size:16px;line-height:1.9;color:#262626;letter-spacing:.15px;word-break:break-word;">
{{image:cover}}
<p style="margin:15px 0 5px;color:#999;font-size:12px;">${escapeHtml(MANILA_DATE)} · ${escapeHtml(EDITORIAL_LANE)}</p>
<p style="margin:8px 0 22px;font-size:18px;line-height:1.75;font-weight:600;color:#1f1f1f;">${escapeHtml(article.kicker)}</p>
${toParagraphs(article.lead)}
${heading('这事到底发生了什么')}
${toParagraphs(article.what_happened)}
${heading('为什么普通人值得关心')}
${toParagraphs(article.why_it_matters)}
{{image:inline1}}
${heading('别只看热闹，真正有用的是这些')}
${practicalHtml(article.practical)}
{{image:inline2}}
${heading('我再唠两句')}
${toParagraphs(article.take)}
<p style="margin:24px 0 8px;padding:16px 18px;background:#f7f7f7;border-radius:8px;font-weight:600;">${escapeHtml(article.ending)}</p>
<section style="margin-top:34px;padding-top:16px;border-top:1px solid #eeeeee;">
<p style="margin:0 0 8px;color:#888;font-size:12px;font-weight:600;">信息来源</p>
${sources}
<p style="margin-top:10px;color:#aaa;font-size:11px;line-height:1.6;">本文依据上述公开报道整理。产品规格、价格、上线范围和政策变化，以相关公司及机构最新正式信息为准。</p>
</section>
</section>`;
}

function normalizeText(value, max) {
  return stripTags(String(value || '')).replace(/\s+/g, ' ').trim().slice(0, max);
}

async function main() {
  const items = await enrichNews(await fetchNews());
  const article = await generateArticle(items);
  const images = await generateImages(article, items);
  const cover = images.find((x) => x.id === 'cover');

  const payload = {
    title: normalizeText(article.title, 60),
    author: config.author || config.account,
    digest: normalizeText(article.digest, 110),
    content: buildHtml(article, items),
    inline_images: images,
    thumb_image: cover ? { filename: cover.filename, mime: cover.mime, alt: '', base64: cover.base64 } : undefined,
    need_open_comment: 1,
    only_fans_can_comment: 0,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`daily_article=${OUTPUT_FILE}`);
  console.log(`title=${payload.title}`);
  console.log(`inline_images=${payload.inline_images.length}`);
}

main().catch((error) => {
  console.error(`tech_auto_writer_failed: ${String(error.message || error)}`);
  process.exit(1);
});
