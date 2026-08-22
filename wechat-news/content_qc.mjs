export function qcArticle(article = {}) {
  const result = {
    title: true,
    structure: true,
    emoji: true,
    images: true,
  };

  const headings = [
    '🇵🇭 先看今天最关心的事',
    '🧳 在菲华人的出门清单',
    '🇵🇭 雨天上班/办事怎么问',
    '🇨🇳 中国人在菲证件最容易忽略的一点',
    '⏱ 30秒复习',
    '🏆 今日作业',
  ];

  for (const item of headings) {
    if (!article.content?.includes(item)) result.structure = false;
  }

  if ((article.title || '').length > 60) result.title = false;

  const extraEmoji = (article.content || '').match(/\p{Extended_Pictographic}/gu) || [];
  if (extraEmoji.length > 10) result.emoji = false;

  return result;
}
