import fs from 'node:fs/promises';

const file = process.argv[2] || 'tech-news/output/daily.json';
const article = JSON.parse(await fs.readFile(file, 'utf8'));

const requiredImages = ['cover', 'inline1', 'inline2'];
const requiredHeadings = [
  '这事到底发生了什么',
  '为什么普通人值得关心',
  '别只看热闹，真正有用的是这些',
  '我再唠两句',
];
const bannedPhrases = [
  '作为AI',
  '作为一个AI',
  'AI生成',
  '根据提示词',
  '综上所述',
  '首先，其次',
];

if (!article.title?.trim()) throw new Error('Missing title');
if (!article.digest?.trim()) throw new Error('Missing digest');
if (!article.content?.trim()) throw new Error('Missing content');

article.title = String(article.title).replace(/\s+/g, ' ').trim().slice(0, 60);
article.digest = String(article.digest).replace(/\s+/g, ' ').trim().slice(0, 110);

for (const heading of requiredHeadings) {
  if (!article.content.includes(heading)) throw new Error(`Missing heading: ${heading}`);
}

let lastHeading = -1;
for (const heading of requiredHeadings) {
  const pos = article.content.indexOf(heading);
  if (pos <= lastHeading) throw new Error(`Heading order invalid: ${heading}`);
  lastHeading = pos;
}

for (const id of requiredImages) {
  const placeholder = `{{image:${id}}}`;
  if (!article.content.includes(placeholder)) throw new Error(`Missing image placeholder: ${placeholder}`);
  const image = (article.inline_images || []).find((item) => item?.id === id);
  if (!image?.base64 || !image?.mime || !image?.filename) throw new Error(`Missing image payload: ${id}`);
}

for (const phrase of bannedPhrases) {
  if (`${article.title}\n${article.digest}\n${article.content}`.includes(phrase)) {
    throw new Error(`Banned AI/template phrase detected: ${phrase}`);
  }
}

const visibleText = article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
if (visibleText.length < 700) throw new Error(`Article too short: ${visibleText.length} chars`);
if (visibleText.length > 9000) throw new Error(`Article too long: ${visibleText.length} chars`);

const paragraphCount = (article.content.match(/<p\b/gi) || []).length;
if (paragraphCount < 10) throw new Error(`Not enough mobile-reading paragraphs: ${paragraphCount}`);

const sourcePos = article.content.indexOf('信息来源');
if (sourcePos < 0) throw new Error('Missing source section');

// Keep generated cover inside the article, but use a stable WeChat thumb material ID.
// This avoids generated hero dimensions causing permanent-thumb upload failures.
delete article.thumb_image;

await fs.writeFile(file, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
console.log('daily_talk_qc=pass');
console.log(`title_chars=${article.title.length}`);
console.log(`visible_chars=${visibleText.length}`);
console.log(`paragraphs=${paragraphCount}`);
console.log('images=cover+2_inline');
console.log('wechat_thumb=stable_material');
