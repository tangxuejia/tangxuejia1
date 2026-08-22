import fs from 'node:fs/promises';
import path from 'node:path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AGNES_API_KEY = process.env.AGNES_API_KEY || '';
const AGNES_BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
const AGNES_TEXT_MODEL = process.env.AGNES_TEXT_MODEL || 'agnes-2.5-flash';
const AGNES_IMAGE_MODEL = process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.1-flash';
const OUTPUT_DIR = process.env.OUT_DIR || 'wechat-news/output';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'daily.json');
const FALLBACK_ARTICLE = 'test.json';

const RSS_SOURCES = [
  { name: 'Philstar', url: 'https://www.philstar.com/rss/headlines', weight: 3 },
  { name: 'Manila Bulletin', url: 'https://mb.com.ph/rss', weight: 3 },
  { name: 'Inquirer', url: 'https://newsinfo.inquirer.net/feed', weight: 3 },
  { name: 'ABS-CBN News', url: 'https://news.abs-cbn.com/rss/news', weight: 3 },
  { name: 'GMA News', url: 'https://data.gmanetwork.com/gno/rss/news/feed.xml', weight: 3 },
];

const TOPIC_WEIGHTS = new Map([
  ['china', 8], ['chinese', 8], ['embassy', 8], ['visa', 9], ['immigration', 9],
  ['foreign', 5], ['worker', 5], ['permit', 8], ['pogo', 7], ['binondo', 8],
  ['manila', 4], ['makati', 5], ['pasay', 5], ['airport', 7], ['naia', 7],
  ['typhoon', 8], ['weather', 5], ['rain', 5], ['flood', 8], ['habagat', 8],
  ['traffic', 5], ['crime', 6], ['scam', 8], ['business', 4], ['customs', 7],
  ['shipping', 5], ['dole', 8], ['wage', 6], ['holiday', 5], ['suspension', 7],
]);

function todayManila() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function stripTags(input = '') {
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return stripTags(match?.[1] || '');
}

function parseRss(xml, source) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
    .map((m) => m[0])
    .map((block) => ({
      source: source.name,
      sourceWeight: source.weight,
      title: pickTag(block, 'title'),
      link: pickTag(block, 'link'),
      description: pickTag(block, 'description'),
      pubDate: pickTag(block, 'pubDate'),
    }))
    .filter((item) => item.title && item.link);
}

function ageHours(pubDate) {
  const ts = Date.parse(pubDate || '');
  if (!Number.isFinite(ts)) return 999;
  return Math.max(0, (Date.now() - ts) / 3_600_000);
}

function scoreItem(item) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  let score = item.sourceWeight || 0;
  for (const [word, weight] of TOPIC_WEIGHTS) {
    if (haystack.includes(word)) score += weight;
  }
  const age = ageHours(item.pubDate);
  if (age <= 12) score += 10;
  else if (age <= 24) score += 7;
  else if (age <= 48) score += 3;
  else if (age > 96) score -= 8;
  return score;
}

async function fetchNews() {
  const results = [];
  for (const source of RSS_SOURCES) {
    try {
      const response = await fetch(source.url, {
        headers: { 'user-agent': 'Mozilla/5.0 wechat-news-autowriter/3.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      results.push(...parseRss(await response.text(), source));
    } catch (error) {
      console.warn(`rss_failed=${source.name}:${String(error.message || error)}`);
    }
  }

  const seen = new Set();
  const ranked = results
    .filter((item) => {
      const key = item.title.toLowerCase().replace(/\W+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ ...item, score: scoreItem(item), ageHours: ageHours(item.pubDate) }))
    .sort((a, b) => b.score - a.score);

  const recent = ranked.filter((item) => item.ageHours <= 72);
  const picked = (recent.length >= 5 ? recent : ranked).slice(0, 10);
  if (!picked.length) throw new Error('No news items fetched from configured RSS sources.');
  console.log(`news_items=${picked.length}`);
  return picked;
}

async function enrichArticle(item) {
  try {
    const response = await fetch(item.link, {
      headers: { 'user-agent': 'Mozilla/5.0 wechat-news-autowriter/3.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return item;
    const text = stripTags(await response.text());
    const excerpt = text.length > 2400 ? `${text.slice(0, 2400)}…` : text;
    return { ...item, excerpt };
  } catch {
    return item;
  }
}

async function enrichNews(items) {
  const first = items.slice(0, 6);
  const enriched = [];
  for (const item of first) enriched.push(await enrichArticle(item));
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
    `发布时间: ${item.pubDate || 'RSS未提供'}`,
    `摘要: ${item.description || 'RSS未提供摘要'}`,
    item.excerpt ? `页面摘录: ${item.excerpt}` : '',
    `链接: ${item.link}`,
  ].filter(Boolean).join('\n')).join('\n\n');
}

function buildWriterPrompt(items, date) {
  return `你是面向“住在菲律宾的中国人”的微信公众号总编辑。今天是 ${date}（菲律宾时间）。\n\n只能依据下面提供的新闻材料写，不得虚构事实、数字、地点、机构公告或政策细节。材料不够时，用“目前公开信息显示/建议再看官方最新通知”，不要补造事实。\n\n定位：先解决在菲华人今天真正关心的问题，再自然教实用 Tagalog/Taglish；不是新闻堆砌，也不是语言课。\n\n固定栏目顺序，栏目名一个字都不要改：\n1. 🇵🇭 先看今天最关心的事\n2. 🧳 在菲华人的出门清单\n3. 🇵🇭 雨天上班/办事怎么问\n4. 🇨🇳 中国人在菲证件最容易忽略的一点\n5. ⏱ 30秒复习\n6. 🏆 今日作业\n\n编辑规则：\n- 表情只能出现在上述栏目标题，不得在正文散放。\n- 手机阅读：每段1-3句，拒绝密集长段。\n- 中文自然、像在菲律宾生活的人写，不用“首先/其次/综上所述”。\n- 必须有实用 Tagalog/Taglish，每句给中文解释，但不要堆词。\n- 不要出现“AI生成”“爆款”“模型”等字样。\n- 标题 18-30 个中文字符左右，有现实利益点，但不标题党。\n- 摘要不超过 100 个中文字符。\n- “30秒复习”简短；“今日作业”给1个能在评论区完成的小任务。\n\n请只输出合法 JSON，不要 Markdown 代码围栏，结构必须完全是：\n{\n  "title":"",\n  "digest":"",\n  "top":"",\n  "checklist":"",\n  "rainwork":"",\n  "documents":"",\n  "review":"",\n  "homework":""\n}\n\n每个栏目的值可以使用简单 HTML：<p><strong><br><em>，不要使用 h1/h2，不要加入图片。\n\n新闻材料：\n${sourceText(items)}`;
}

async function generateWithAgnesText(prompt) {
  if (!AGNES_API_KEY) return '';
  const response = await fetch(agnesUrl('/v1/chat/completions'), {
    method: 'POST',
    headers: { authorization: `Bearer ${AGNES_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: AGNES_TEXT_MODEL,
      messages: [
        { role: 'system', content: '你是严谨的微信公众号编辑，只使用用户提供的新闻材料，不虚构事实。输出严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.45,
      max_tokens: 5000,
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
        { role: 'system', content: '你是严谨的微信公众号编辑，只使用用户提供的新闻材料，不虚构事实。输出严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.45,
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

function ensureSections(obj) {
  const keys = ['title', 'digest', 'top', 'checklist', 'rainwork', 'documents', 'review', 'homework'];
  for (const key of keys) {
    if (typeof obj?.[key] !== 'string' || !obj[key].trim()) throw new Error(`Missing generated field: ${key}`);
  }
  return obj;
}

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fallbackArticle(items, date) {
  const lead = items[0];
  const title = lead?.title ? `菲律宾今天这条消息，在菲华人出门前先看` : `菲律宾今日生活提醒 ${date}`;
  return {
    title,
    digest: '把菲律宾当天新闻变成出门、上班、办事和证件检查清单，顺便学几句真正能用的 Tagalog。',
    top: `<p>今天先看这条：<strong>${escapeHtml(lead?.title || '菲律宾本地最新生活信息')}</strong></p><p>${escapeHtml(lead?.description || '请以当地政府和主流媒体最新公告为准。')}</p>`,
    checklist: '<p>出门前先确认天气、路况和办事机构是否正常开放；重要证件做好手机备份，雨天用防水袋收好。</p><p><strong>Bukas ba kayo ngayon?</strong><br>你们今天营业 / 办公吗？</p>',
    rainwork: '<p><strong>May pasok ba tayo ngayon?</strong><br>我们今天上班吗？</p><p><strong>Pwede bang i-reschedule?</strong><br>可以改期吗？</p><p>遇到恶劣天气，以政府和公司正式通知为准，重要沟通留好记录。</p>',
    documents: '<p>别只看“签证有没有过期”。还要核对签证类型、工作许可、雇主信息和实际工作内容是否一致。</p><p><strong>Kailan ang expiration nito?</strong><br>这个什么时候到期？</p>',
    review: '<p><strong>baha</strong> = 积水 / 洪水<br><strong>pasok</strong> = 上班 / 上课<br><strong>permit</strong> = 许可<br><strong>expiration</strong> = 到期时间</p>',
    homework: '<p>今天只练一句：如果你要问“你们今天办公吗？”，你会怎么说？把答案留在评论区。</p>',
  };
}

async function generateArticle(items, date) {
  const prompt = buildWriterPrompt(items, date);
  const errors = [];
  for (const [name, fn] of [['agnes', generateWithAgnesText], ['openai', generateWithOpenAI]]) {
    try {
      const raw = await fn(prompt);
      if (!raw) continue;
      const article = ensureSections(parseJsonObject(raw));
      console.log(`writer_model=${name}`);
      return article;
    } catch (error) {
      errors.push(`${name}:${String(error.message || error)}`);
    }
  }
  console.warn(`writer_fallback=${errors.join(' | ') || 'no API key available'}`);
  return fallbackArticle(items, date);
}

function imagePrompts(article, items) {
  const topic = items.slice(0, 3).map((x) => x.title).join(' | ');
  const common = 'Editorial documentary photography for a Chinese WeChat article about daily life in the Philippines. Authentic Filipino environment, natural people, credible local details, clean composition, realistic lighting, no readable text, no captions, no logo, no watermark, no fake government seal.';
  return {
    cover: `${common} 2.35:1 wide hero cover. Manila urban life, rainy-season atmosphere when relevant, Chinese residents in the Philippines as part of a normal street scene, strong focal point and generous clean space. Article theme: ${article.title}. News references: ${topic}`,
    checklist: `${common} 3:2 landscape inline image. A practical leaving-home checklist scene in Metro Manila: checking weather and traffic on a phone, waterproof document pouch, power bank, umbrella, transport outside. Theme: ${article.checklist.replace(/<[^>]+>/g, ' ').slice(0, 450)}`,
    rainwork: `${common} 3:2 landscape inline image. Realistic Philippines work or government-service scene on a rainy day, commuter asking whether office/work is open, wet street visible outside, calm practical mood. Theme: ${article.rainwork.replace(/<[^>]+>/g, ' ').slice(0, 450)}`,
    documents: `${common} 3:2 landscape inline image. Chinese resident in the Philippines carefully checking passport, ACR-style residence card and work-related paperwork at a clean desk, no legible personal data, responsible compliance mood. Theme: ${article.documents.replace(/<[^>]+>/g, ' ').slice(0, 450)}`,
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
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const rawMime = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const mime = ['image/jpeg', 'image/png', 'image/gif'].includes(rawMime) ? rawMime : 'image/jpeg';
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : 'jpg';
  return { id, filename: `agnes-${id}.${ext}`, mime, alt: '', base64: bytes.toString('base64') };
}

async function loadFallbackImages() {
  try {
    const raw = JSON.parse(await fs.readFile(FALLBACK_ARTICLE, 'utf8'));
    const map = new Map((raw.inline_images || []).map((x) => [x.id, x]));
    return {
      cover: map.get('cover'),
      checklist: map.get('safety'),
      rainwork: map.get('worker'),
      documents: map.get('permit'),
    };
  } catch {
    return {};
  }
}

async function generateImages(article, items) {
  const prompts = imagePrompts(article, items);
  const fallback = await loadFallbackImages();
  const images = [];
  for (const id of ['cover', 'checklist', 'rainwork', 'documents']) {
    try {
      const url = await generateAgnesImage(prompts[id], id);
      const image = await imageFromUrl(url, id);
      images.push(image);
      console.log(`agnes_image_generated=${id}`);
    } catch (error) {
      const old = fallback[id];
      if (!old?.base64) throw new Error(`Image ${id} failed and no fallback exists: ${String(error.message || error)}`);
      images.push({ ...old, id, filename: `fallback-${id}.jpg`, alt: '' });
      console.warn(`agnes_image_fallback=${id}:${String(error.message || error)}`);
    }
  }
  return images;
}

function heading(text) {
  return `<h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;color:#222;font-weight:700;">${text}</h2>`;
}

function buildHtml(article, items, date) {
  const sources = items.slice(0, 6).map((item) =>
    `<p style="margin:4px 0;color:#999;font-size:12px;line-height:1.65;">${escapeHtml(item.source)}：${escapeHtml(item.title)}</p>`
  ).join('');
  return `<section style="font-size:16px;line-height:1.9;color:#262626;letter-spacing:.2px;word-break:break-word;">
{{image:cover}}
<p style="margin:16px 0 22px;color:#888;font-size:13px;">${escapeHtml(date)} · 菲律宾生活实用版</p>
${heading('🇵🇭 先看今天最关心的事')}${article.top}
${heading('🧳 在菲华人的出门清单')}${article.checklist}{{image:checklist}}
${heading('🇵🇭 雨天上班/办事怎么问')}${article.rainwork}{{image:rainwork}}
${heading('🇨🇳 中国人在菲证件最容易忽略的一点')}${article.documents}{{image:documents}}
${heading('⏱ 30秒复习')}${article.review}
${heading('🏆 今日作业')}${article.homework}
<section style="margin-top:34px;padding-top:16px;border-top:1px solid #eee;">${sources}<p style="margin-top:8px;color:#aaa;font-size:11px;line-height:1.6;">内容依据上述公开新闻材料自动整理，政策、天气、交通及办事安排请以相关机构最新正式公告为准。</p></section>
</section>`;
}

function normalizeArticleText(value, max = 0) {
  const text = String(value || '').trim();
  return max && text.length > max ? text.slice(0, max) : text;
}

async function main() {
  const date = todayManila();
  const items = await enrichNews(await fetchNews());
  const article = await generateArticle(items, date);
  const images = await generateImages(article, items);
  const cover = images.find((x) => x.id === 'cover');

  const payload = {
    title: normalizeArticleText(article.title, 60),
    author: '菲语Tagalog学习',
    digest: normalizeArticleText(article.digest, 110),
    content: buildHtml(article, items, date),
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
  console.error(`auto_writer_failed: ${String(error.message || error)}`);
  process.exit(1);
});
