import fs from 'node:fs/promises';
import path from 'node:path';

const key = process.env.AGNES_API_KEY || '';
const base = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/+$/, '');
const model = process.env.AGNES_TEXT_MODEL || 'agnes-2.5-flash';
const imageModel = process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.1-flash';
const out = 'wechat-news/output';
const date = '2026-08-25（菲律宾时间）'; // batch trigger 2026-08-25T00:00+08:00

const news = [
  {
    id:'obet-super-typhoon',
    title:'台风Obet可能增强为超强台风，菲律宾进入重点防范期',
    time:'2026年8月25日，Philstar.com（菲律宾时间）',
    source:'The Philippine Star',
    url:'https://www.philstar.com/headlines/2026/08/24/2551352/obet-may-turn-super-typhoon/',
    data:'报道援引PAGASA信息称，国际名Saudel的热带气旋预计进入菲律宾责任区后命名为Obet，中心曾位于吕宋岛最北端以东约1,950公里，最大风速165公里/小时、阵风205公里/小时，并可能增强为超强台风；其停留时间预计较短，但可能增强西南季风。',
    impact:'在吕宋、马尼拉及西部受季风影响地区生活和经营的华人，要提前检查航班、海运、门店排水、备用电源和手机通知；不要只看“是否直接登陆”，还要关注季风带来的持续降雨和交通影响。'
  },
  {
    id:'school-safety-drill',
    title:'菲律宾全国学校今天举行安全演练，家长要先看接送安排',
    time:'2026年8月25日，Philstar.com报道（菲律宾时间）',
    source:'Philstar.com',
    url:'https://www.philstar.com/headlines/2026/08/21/2550825/deped-sets-nationwide-school-safety-drill-campus-threats-august-25',
    data:'菲律宾教育部要求学校在8月25日上午9时开展全国同步校园安全演练，内容依据各校针对校园攻击事件的应急计划；学校还需准备安全房、疏散路线、紧急沟通和家属集合区域，并邀请地方政府、警察或消防等外部人员评估。',
    impact:'有孩子在菲律宾上学的华人家庭，今天要提前确认学校是否调整入校、放学和接送流程，保存班主任或学校的紧急联系方式；演练期间应听从校方安排，不把演练消息当成正在发生的袭击。'
  },
  {
    id:'special-nonworking-days',
    title:'菲律宾3个市镇获宣布特别非工作日，办事和物流要提前确认',
    time:'2026年8月25日，Inquirer.net报道（菲律宾时间）',
    source:'INQUIRER.net',
    url:'https://newsinfo.inquirer.net/2289459/marcos-declares-special-non-working-days-in-3-municipalities',
    data:'总统府公布的公告安排了3个地方特别非工作日：Quezon省Buenavista为8月26日，Cagayan省Alcala为8月27日，Sultan Kudarat省Isulan为8月28日；相关安排与地方成立纪念日或节庆活动有关。',
    impact:'在这些地方有门店、仓库、员工、客户或政府手续的华人企业，要提前确认银行、地方政府窗口、快递和货运是否调整营业时间；不要把地方特别非工作日误认为全国放假。'
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
        const encoded = String(imageBase64).replace(/^data:image\\/[^;]+;base64,/,'');
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
  for(const [id,p,ratio] of [
    ['cover',common+' Wide WeChat cover image about '+n.title+'; Filipino city or business environment, clear focal point.','21:9'],
    ['action',common+' Specific action scene showing the practical response to this exact story, including the relevant Philippine location, equipment, infrastructure, or business context. Chinese residents or businesses should appear only when relevant.','3:2'],
    ['language',common+' Specific everyday conversation scene directly related to this exact story; show the relevant object or setting from the news, realistic Filipino people, no text.','3:2']
  ]) { try { const x=await img(p,id,ratio); if(x) images.push(x); } catch(e){ console.warn(`image_failed topic=${n.id} image=${id}: ${e.message}`); } }
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
