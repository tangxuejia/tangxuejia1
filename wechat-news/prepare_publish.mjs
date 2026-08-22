import fs from 'node:fs/promises';

const file = process.argv[2] || 'wechat-news/output/daily.json';
const article = JSON.parse(await fs.readFile(file, 'utf8'));

const project = article.project || 'tagalog';

if (project === 'daily-talk') {
  const requiredSections = [
    '发生了什么',
    '为什么重要',
    '普通用户影响',
    '每日唠唠谈观察'
  ];

  for (const section of requiredSections) {
    if (!article.content?.includes(section)) {
      throw new Error(`Missing daily-talk section: ${section}`);
    }
  }

  if (!article.title || !article.digest) {
    throw new Error('daily-talk missing title or digest');
  }

  if (!article.time && !article.date) {
    throw new Error('daily-talk requires news time');
  }

  article.title = String(article.title).trim().slice(0, 60);
  article.digest = String(article.digest).trim().slice(0, 110);

  await fs.writeFile(file, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
  console.log('project=daily-talk');
  console.log('tech_news_qc=pass');
  process.exit(0);
}

const requiredHeadings = [
  '🇵🇭 先看今天最关心的事',
  '🧳 在菲华人的出门清单',
  '🇵🇭 雨天上班/办事怎么问',
  '🇨🇳 中国人在菲证件最容易忽略的一点',
  '⏱ 30秒复习',
  '🏆 今日作业',
];

for (const heading of requiredHeadings) {
  if (!article.content?.includes(heading)) throw new Error(`Missing required heading: ${heading}`);
}

article.title = String(article.title || '').trim().slice(0, 60);
article.digest = String(article.digest || '').trim().slice(0, 110);

await fs.writeFile(file, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
console.log('project=tagalog');
console.log('wechat_layout_qc=pass');
