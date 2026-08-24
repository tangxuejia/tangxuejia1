import fs from 'node:fs/promises';
import path from 'node:path';

const key = process.env.AGNES_API_KEY || '';
const base = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/+$/, '');
const model = process.env.AGNES_TEXT_MODEL || 'agnes-2.5-flash';
const imageModel = process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.1-flash';
const out = 'wechat-news/output';
const date = '2026-08-24（菲律宾时间）';

const news = [
  {
    id:'visayas-grid-alert',
    title:'维萨亚斯电网今日发布红色与黄色预警',
    time:'2026年8月24日，ABS-CBN News 11:16（菲律宾时间）',
    source:'ABS-CBN News',
    url:'https://www.abs-cbn.com/news/business/2026/8/24/visayas-grid-on-red-yellow-alerts-on-august-24-1116',
    data:'国家电网公司（NGCP）表示，维萨亚斯电网当天面临 Red Alert 与 Yellow Alert；公开报道指出，部分燃煤电厂停运是背景之一。具体停电区域和时段仍以当地电力公司公告为准。',
    impact:'在宿务、伊洛伊洛、薄荷、莱特等维萨亚斯地区生活或经营的华人，应提前给手机、收银设备、路由器和备用电源充电；餐饮、冷链、网店仓储要注意短时断电风险。'
  },
  {
    id:'ai-data-foundation',
    title:'世界银行提醒：菲律宾AI发展不能缺数据基础',
    time:'2026年8月24日，Manila Bulletin 00:00（菲律宾时间）',
    source:'Manila Bulletin',
    url:'https://mb.com.ph/2026/08/24/weak-data-foundations-could-hold-back-philippine-ai-push-world-bank-warns',
    data:'报道援引世界银行观点称，菲律宾推进人工智能时，数据质量、数据治理和基础设施仍是关键短板；这不是单纯购买软件或模型就能解决的问题。',
    impact:'做BPO、跨境电商、客服、广告和软件外包的华人团队，未来会更看重数据合规、客户资料保护和员工使用AI的流程；不要把客户身份证、订单和支付资料随意上传到公开工具。'
  },
  {
    id:'renewables-data-centers',
    title:'可再生能源和数据中心成菲律宾吸引外资新重点',
    time:'2026年8月24日，Manila Bulletin 00:01（菲律宾时间）',
    source:'Manila Bulletin',
    url:'https://mb.com.ph/2026/08/24/renewables-data-centers-thriving-fdi-big-bets-for-philippines',
    data:'报道将可再生能源与数据中心列为菲律宾外商直接投资的重点方向，反映出电力、云服务和数字基础设施正在成为新的投资竞争领域。',
    impact:'对在菲做电商、物流、云服务、软件和工商业用电项目的华人来说，长期电价、供电稳定性、机房位置和地方许可会越来越重要；看项目不能只看租金和人工成本。'
  }
];

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function url(p){ return base + (p.startsWith('/v1') ? p.slice(3) : p); }

async function text(prompt){
  if(!key) return '';
  const r=await fetch(url('/v1/chat/completions'),{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'你是严谨的菲律宾新闻编辑，只能使用材料，不得虚构数字。只输出JSON。'},{role:'user',content:prompt}],temperature:.35,max_tokens:4500})});
  if(!r.ok) throw new Error('text '+r.status+' '+await r.text());
  return (await r.json()).choices?.[0]?.message?.content?.trim()||'';
}
function json(s){ const t=String(s).replace(/^\`\`\`json/i,'').replace(/\`\`\`$/,'').trim(); const a=t.indexOf('{'),b=t.lastIndexOf('}'); return JSON.parse(t.slice(a,b+1)); }

async function img(prompt,id,ratio){
  if(!key) return null;
  const r=await fetch(url('/v1/images/generations'),{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:imageModel,prompt,size:'2K',ratio,extra_body:{response_format:'url'}})});
  if(!r.ok) throw new Error('image '+r.status+' '+await r.text());
  const u=(await r.json()).data?.[0]?.url; if(!u) throw new Error('no image url');
  const d=await fetch(u); const b=Buffer.from(await d.arrayBuffer()); const mime=(d.headers.get('content-type')||'image/jpeg').split(';')[0];
  return {id,filename:'tagalog-'+id+'.jpg',mime:'image/jpeg',alt:'',base64:b.toString('base64')};
}

async function fallbackImages() {
  try {
    const raw = JSON.parse(await fs.readFile('test.json', 'utf8'));
    const all = [
      raw.thumb_image ? { ...raw.thumb_image, id: 'cover' } : null,
      ...(Array.isArray(raw.inline_images) ? raw.inline_images : [])
    ].filter(Boolean);
    const by = new Map(all.map(x => [x.id, x]));
    const cover = by.get('cover') || all[0];
    const action = by.get('safety') || by.get('worker') || cover;
    const language = by.get('worker') || by.get('permit') || cover;
    return [
      cover ? { ...cover, id: 'cover' } : null,
      action ? { ...action, id: 'action' } : null,
      language ? { ...language, id: 'language' } : null
    ].filter(Boolean).map(x => ({ ...x, alt: '' }));
  } catch {
    return [];
  }
}

function fallback(n){
  return {title:n.title,digest:n.data.slice(0,100),
    top:`<p><strong>新闻时间：</strong>${esc(n.time)}</p><p>${esc(n.data)}</p><p><strong>来源：</strong><a href="${n.url}">${esc(n.source)}</a></p>`,
    checklist:`<p>${esc(n.impact)}</p><p><strong>Mag-charge muna.</strong><br>先充好电。</p>`,
    language:`<p><strong>May kuryente ba?</strong>＝有电吗？<br><strong>May abiso ba?</strong>＝有通知吗？</p>`,
    chinese:`<p>${esc(n.impact)}</p><p>涉及证件、投资和经营安排，请以菲律宾政府、地方机构或电力公司的最新通知为准。</p>`,
    review:'<p><strong>kuryente</strong>＝电力；<strong>abiso</strong>＝通知；<strong>ligtas</strong>＝安全；<strong>datos</strong>＝数据。</p>',
    homework:'<p>把“先充好电”翻成 Tagalog，并在评论区写出来。</p>'};
}

async function one(n,i){
  const prompt=`今天是${date}。请把下面这条英文/菲律宾新闻材料翻译、整理成面向在菲华人的中文微信公众号文章。必须保留：新闻时间、来源链接、可核实数据、华人影响；自然加入3-5句实用Tagalog/Taglish和中文解释。不要写普通天气，不得补造事实。每段1-3句，像真实生活资讯，不要AI腔。只输出JSON字段：title,digest,top,checklist,language,chinese,review,homework。top必须包含时间/来源/数据；checklist必须包含华人行动建议；language必须包含菲语学习；chinese必须包含华人影响。\n\n新闻：${JSON.stringify(n)}`;
  let a; try { a=json(await text(prompt)); } catch(e){ console.warn(e.message); }
  a=a&&a.title&&a.top?a:fallback(n);
  const common='Realistic editorial documentary photography in the Philippines, authentic local setting, natural light, no readable text, no logo, no watermark. The image must directly match this exact news story: '+n.title+'. Story facts: '+n.data+' Audience relevance: '+n.impact+' Do not depict unrelated weather, paperwork, schools, or generic business scenes.';
  const images=[];
  for(const [id,p,ratio] of [
    ['cover',common+' Wide WeChat cover image about '+n.title+'; Filipino city or business environment, clear focal point.','21:9'],
    ['action',common+' Specific action scene showing the practical response to this exact story, including the relevant Philippine location, equipment, infrastructure, or business context. Chinese residents or businesses should appear only when relevant.','3:2'],
    ['language',common+' Specific everyday conversation scene directly related to this exact story; show the relevant object or setting from the news, realistic Filipino people, no text.','3:2']
  ]) { try { const x=await img(p,id,ratio); if(x) images.push(x); } catch(e){ console.warn(e.message); } }
  if (!images.some(x => x.id === 'cover') || images.length < 3) {
    throw new Error(`Topic-specific images failed for ${n.id}; refusing to publish mismatched fallback images.`);
  }
  const h=(t)=>'<h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;color:#222;">'+t+'</h2>';
  const sources='<p style="color:#999;font-size:12px;">来源：<a href="'+n.url+'">'+esc(n.source)+'</a> · '+esc(n.time)+'</p>';
  const content='<section style="font-size:16px;line-height:1.9;color:#262626;">{{image:cover}}<p style="color:#888;font-size:13px;">'+date+' · 菲语 Tagalog 新闻学习</p>'+h('🇵🇭 先看今天最关心的事')+a.top+h('🧳 在菲华人的出门清单')+a.checklist+'{{image:action}}'+h('🇵🇭 雨天上班/办事怎么问')+a.language+'{{image:language}}'+h('🇨🇳 中国人在菲证件最容易忽略的一点')+a.chinese+h('⏱ 30秒复习')+a.review+h('🏆 今日作业')+a.homework+sources+'<p style="color:#aaa;font-size:11px;">请以相关机构最新正式公告为准。</p></section>';
  return {title:String(a.title).slice(0,60),author:'菲语Tagalog学习',digest:String(a.digest).slice(0,110),content,inline_images:images,thumb_image:images.find(x=>x.id==='cover'),need_open_comment:1,only_fans_can_comment:0,project:'tagalog',date};
}

await fs.mkdir(out,{recursive:true});
const articles=[];
for(let i=0;i<news.length;i++){ const a=await one(news[i],i); await fs.writeFile(path.join(out,'daily-'+(i+1)+'.json'),JSON.stringify(a,null,2)); articles.push({file:'daily-'+(i+1)+'.json',title:a.title,source:news[i].source}); }
await fs.writeFile(path.join(out,'batch-manifest.json'),JSON.stringify({date,count:articles.length,articles},null,2));
console.log('batch_articles=3');
console.log(articles.map(x=>x.title).join('\n'));
