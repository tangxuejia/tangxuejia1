export function scoreTitle(title = '') {
  const text = String(title);
  let score = 0;
  if (/[菲律宾|在菲|华人|签证|移民|天气|安全|提醒]/.test(text)) score += 30;
  if (/[注意|提醒|最新|突发|千万|别忽略]/.test(text)) score += 25;
  if (text.length >= 12 && text.length <= 32) score += 20;
  if (!/[AI|机器人|生成]/i.test(text)) score += 10;
  return score;
}

export function pickBestTitle(titles = []) {
  return [...titles].sort((a,b)=>scoreTitle(b)-scoreTitle(a))[0] || '';
}
