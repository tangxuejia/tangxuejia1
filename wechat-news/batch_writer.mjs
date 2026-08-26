import fs from 'node:fs/promises';
import path from 'node:path';

const key = process.env.AGNES_API_KEY || '';
const base = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/+$/, '');
const model = process.env.AGNES_TEXT_MODEL || 'agnes-2.5-flash';
const imageModel = process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.1-flash';
const out = 'wechat-news/output';
const date = '2026-08-26（菲律宾时间）'; // batch trigger 2026-08-26T00:00+08:00

const news = [
  {
    id:'visayas-power-alert',
    title:'维萨亚斯电力告急：峰值时段可能出现供电中断',
    time:'2026年8月26日，Inquirer.net 04:30（菲律宾时间）',
    source:'INQUIRER.net',
    url:'https://newsinfo.inquirer.net/2292436/tight-power-supply-puts-tacloban-2-leyte-towns-on-alert',
    data:'莱特省电力合作社提醒消费者，维萨亚斯电网在周二下午2至5时、晚间8至10时发布黄色预警，下午5至8时发布红色预警；可用容量约2,421兆瓦，而预测峰值需求约2,570兆瓦，缺口约149兆瓦。',
    impact:'在塔克洛班、Palo和Babatngon经营餐饮、冷链、网店仓储或小型工厂的华人，应提前给路由器、收银设备、冰柜和备用电源充电，并把高耗电操作避开预警时段。'
  },
  {
    id:'philippines-drone-defense',
    title:'菲律宾拟扩大军用无人机能力，2027年防务预算拟增至3055亿比索',
    time:'2026年8月25日，Reuters报道（菲律宾时间）',
    source:'Reuters',
    url:'https://www.reuters.com/world/asia-pacific/philippines-seeking-expand-military-drone-capabilities-says-defence-chief-2026-08-25/',
    data:'菲律宾国防部长表示，政府正扩大无人机研发和采购能力；2027年防务预算提案约3,055亿比索，同比增长6.3%，其中约500亿比索用于现代化，较本年度增加25%。',
    impact:'这会影响在菲做无人机、通信、安防、软件和工业供应链的华人企业，但军用项目涉及合规、出口管制和政府采购，不能把普通消费级无人机直接当成军工项目参与。'
  },
  {
    id:'sara-duterte-impeachment',
    title:'菲律宾参议院今天继续审理副总统弹劾案，马尼拉办事安排需留意',
    time:'2026年8月26日，Philstar.com 08:45（菲律宾时间）',
    source:'Philstar.com',
    url:'https://www.philstar.com/headlines/2026/08/26/2551945/live-coverage-sara-dutertes-impeachment-trial-aug-26',
    data:'菲律宾参议院于8月26日上午10时继续审理副总统Sara Duterte弹劾案。该事件属于正在进行的政治程序，后续以参议院正式议程和公告为准。',
    impact:'在马尼拉市区办证、跑政府窗口、参加商务会议或安排员工通勤的华人，应关注当天道路、安保和公共机构通知；政治审理不等于全市停工，不要转发未经核实的“全面封路”消息。'
  }
];

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function url(p){
  const path = p.startsWith('/v1') ? p : '/v1' + (p.startsWith('/') ? p : '/'+p);
  return base.endsWith('/v1') ? base + path.slice(3) : base + path;
}

async function text(prompt){
  if(!key) return '';
  const r=await fetch(url('/v1/chat/completions'),{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'你是严谨的菲律宾新闻编辑，只能使用材料，不得虚构数字。只输出JSON。'},{role:'user',content:prompt}],temperature:.35,max_tokens:4500})});
  if(!r.ok) throw new Error('text '+r.status+' '+await r.text());
  return (await r.json()).choices?.[0]?.message?.content?.trim()||'';
}
function json(s){ const t=String(s).replace(/^\`\`\`json/i,'').replace(/\`\`\`$/,'').trim(); const a=t.indexOf('{'),b=t.lastIndexOf('}'); return JSON.parse(t.slice(a,b+1)); }

async function sourceImage(n){
  try{
    const r=await fetch(n.url,{headers:{'user-agent':'Mozilla/5.0'}});
    if(!r.ok) return null;
    const html=await r.text();
    const m=html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    if(!m) return null;
    const imageUrl=new URL(m[1],n.url).href;
    const d=await fetch(imageUrl,{headers:{'user-agent':'Mozilla/5.0'}});
    if(!d.ok) return null;
    const b=Buffer.from(await d.arrayBuffer());
    if(b.length<1000) return null;
    const mime=(d.headers.get('content-type')||'image/jpeg').split(';')[0];
    if(!mime.startsWith('image/')) return null;
    return {id:'cover',filename:'source-'+n.id+'.jpg',mime,alt:n.title,base64:b.toString('base64'),source:'original-news'};
  } catch(e){ console.warn('source_image_failed topic='+n.id+': '+e.message); return null; }
}

async function img(prompt,id,ratio){
  if(!key) throw new Error('AGNES_API_KEY is missing; image generation cannot start.');
  const variants=[
    {model:imageModel,prompt,size:'2K',ratio,extra_body:{response_format:'url'}},
    {model:imageModel,prompt,size:'1024x1024'},
    {model:imageModel,prompt}
  ];
  let last='';
  for(let attempt=0;attempt<variants.length;attempt++){
    try{
      const r=await fetch(url('/v1/images/generations'),{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(variants[attempt])});
      const body=await r.text();
      if(!r.ok){ last='HTTP '+r.status+' '+body.slice(0,300); continue; }
      let data; try{ data=JSON.parse(body); }catch{ last='non-json response'; continue; }
      const root = data && typeof data === 'object' ? data : {};
      const candidates = [
        ...(Array.isArray(root.data) ? root.data : []),
        ...(Array.isArray(root.images) ? root.images : []),
        ...(Array.isArray(root.output) ? root.output : []),
        root.data && !Array.isArray(root.data) ? root.data : null,
        root.result && typeof root.result === 'object' ? root.result : null
      ].filter(Boolean);
      const item = candidates.find(x => x.url || x.b64_json || x.base64 || x.image_url || x.image) || {};
      const imageUrl = item.url || item.image_url;
      const imageBase64 = item.b64_json || item.base64 || item.image;
      let b,mime='image/jpeg';
      if(imageUrl){
        const d=await fetch(imageUrl); if(!d.ok) throw new Error('image download '+d.status);
        b=Buffer.from(await d.arrayBuffer()); mime=(d.headers.get('content-type')||mime).split(';')[0];
      } else if(imageBase64){
        const encoded = String(imageBase64).replace(/^data:image[^;]+;base64,/,'');
        b=Buffer.from(encoded,'base64');
        if(String(imageBase64).startsWith('data:image/')) mime=String(imageBase64).match(/^data:([^;]+)/)?.[1] || mime;
      } else { last='no usable image in response: '+body.slice(0,600); continue; }
      return {id,filename:'tagalog-'+id+'.jpg',mime,alt:'',base64:b.toString('base64')};
    }catch(e){ last=e.message; }
    await new Promise(r=>setTimeout(r,1500*(attempt+1)));
  }
  throw new Error('image generation failed for '+id+': '+last);
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
  const originalCover=await sourceImage(n);
  if(originalCover) images.push(originalCover);
  for(const [id,p,ratio] of [
    ['cover',common+' Wide WeChat cover image about '+n.title+'; Filipino city or business environment, clear focal point.','21:9'],
    ['action',common+' Specific action scene showing the practical response to this exact story, including the relevant Philippine location, equipment, infrastructure, or business context. Chinese residents or businesses should appear only when relevant.','3:2'],
    ['language',common+' Specific everyday conversation scene directly related to this exact story; show the relevant object or setting from the news, realistic Filipino people, no text.','3:2']
  ]) {
    if(id==='cover' && originalCover) continue;
    try { const x=await img(p,id,ratio); if(x) images.push(x); } catch(e){ console.warn(`image_failed topic=${n.id} image=${id}: ${e.message}`); }
  }
  if (!images.some(x => x.id === 'cover') || images.length < 3) {
    throw new Error(`Topic-specific images failed for ${n.id}; model=${imageModel}; endpoint=${base}; check the preceding image generation error logs.`);
  }
  const h=(t)=>'<h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;color:#222;">'+t+'</h2>';
  const sources='<p style="color:#999;font-size:12px;">来源：<a href="'+n.url+'">'+esc(n.source)+'</a> · '+esc(n.time)+'</p>';
  const content='<section style="font-size:16px;line-height:1.9;color:#262626;">{{image:cover}}<p style="color:#888;font-size:13px;">'+date+' · 菲语 Tagalog 新闻学习</p>'+h('🇵🇭 先看今天最关心的事')+a.top+h('🧳 在菲华人的出门清单')+a.checklist+'{{image:action}}'+h('🇵🇭 雨天上班/办事怎么问')+a.language+'{{image:language}}'+h('🇨🇳 中国人在菲证件最容易忽略的一点')+a.chinese+h('⏱ 30秒复习')+a.review+h('🏆 今日作业')+a.homework+sources+'<p style="color:#aaa;font-size:11px;">请以相关机构最新正式公告为准。</p></section>';
  return {title:String(a.title).slice(0,60),author:'菲语Tagalog学习',digest:String(a.digest).slice(0,110),content,inline_images:images,thumb_image:images.find(x=>x.id==='cover'),need_open_comment:1,only_fans_can_comment:0,project:'tagalog',date};
}

console.log('agnes_base_url='+base);
console.log('agnes_image_model='+imageModel);
if(!key) throw new Error('AGNES_API_KEY is missing; add it to GitHub Actions Secrets.');
await fs.mkdir(out,{recursive:true});
const articles=[];
for(let i=0;i<news.length;i++){ const a=await one(news[i],i); await fs.writeFile(path.join(out,'daily-'+(i+1)+'.json'),JSON.stringify(a,null,2)); articles.push({file:'daily-'+(i+1)+'.json',title:a.title,source:news[i].source}); }
await fs.writeFile(path.join(out,'batch-manifest.json'),JSON.stringify({date,count:articles.length,articles},null,2));
console.log('batch_articles=3');
console.log(articles.map(x=>x.title).join('\n'));
