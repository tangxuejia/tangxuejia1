import fs from 'node:fs/promises';

const file = process.argv[2] || 'wechat-news/output/daily.json';
const article = JSON.parse(await fs.readFile(file, 'utf8'));

const requiredHeadings = [
  '🇵🇭 先看今天最关心的事',
  '🧳 在菲华人的出门清单',
  '🇵🇭 雨天上班/办事怎么问',
  '🇨🇳 中国人在菲证件最容易忽略的一点',
  '⏱ 30秒复习',
  '🏆 今日作业',
];

const requiredImages = ['cover', 'checklist', 'rainwork', 'documents'];

for (const heading of requiredHeadings) {
  if (!article.content?.includes(heading)) throw new Error(`Missing required heading: ${heading}`);
}

let lastPos = -1;
for (const heading of requiredHeadings) {
  const pos = article.content.indexOf(heading);
  if (pos <= lastPos) throw new Error(`Heading order invalid: ${heading}`);
  lastPos = pos;
}

for (const id of requiredImages) {
  const token = `{{image:${id}}}`;
  if (!article.content.includes(token)) throw new Error(`Missing image placeholder: ${token}`);
  if (!(article.inline_images || []).some((image) => image.id === id && image.base64)) {
    throw new Error(`Missing inline image payload: ${id}`);
  }
}

// Emoji are reserved for the six section headings. Strip decorative emoji from all other HTML segments.
const headingPattern = /(<h2\b[^>]*>[\s\S]*?<\/h2>)/gi;
const chunks = article.content.split(headingPattern);
article.content = chunks.map((chunk) => {
  if (/^<h2\b/i.test(chunk)) return chunk;
  return chunk
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/\s{2,}/g, ' ');
}).join('');

// Agnes hero image stays at the first screen inside the article. Keep the proven WeChat thumb path
// (WECHAT_THUMB_MEDIA_ID or publisher default) to avoid oversized generated images breaking draft creation.
delete article.thumb_image;

article.title = String(article.title || '').trim().slice(0, 60);
article.digest = String(article.digest || '').trim().slice(0, 110);

await fs.writeFile(file, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
console.log('v3_layout_qc=pass');
console.log('emoji_policy=headings_only');
console.log('hero_image=cover_first_screen');
console.log('wechat_thumb=stable_existing_path');
