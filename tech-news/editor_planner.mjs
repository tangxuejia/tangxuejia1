import fs from 'node:fs/promises';

const output = 'tech-news/output/editor_plan.json';

const plan = {
  mode: 'ai-editor',
  dailyArticles: { min: 5, max: 7 },
  workflow: [
    'collect same-day technology news',
    'score freshness popularity impact discussion value',
    'select top topics',
    'create article angles before writing',
    'generate Chinese-first articles'
  ],
  priorities: [
    'AI与大模型',
    '华为重大热点',
    '手机与消费电子',
    '芯片与硬件',
    '智能汽车与机器人',
    '科技实用技巧'
  ],
  rules: {
    avoidOldNews: true,
    chineseFirst: true,
    keepBrands: true,
    addFollowReason: true
  }
};

await fs.mkdir('tech-news/output', { recursive: true });
await fs.writeFile(output, JSON.stringify(plan, null, 2));
console.log('editor plan created');
