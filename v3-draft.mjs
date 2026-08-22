import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = 'test.json';
const outputPath = 'generated-v3.json';

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const requiredImages = ['cover', 'safety', 'worker', 'permit'];
const imageIds = new Set((source.inline_images ?? []).map((item) => item?.id));

for (const id of requiredImages) {
  if (!imageIds.has(id)) {
    throw new Error(`Missing required inline image: ${id}`);
  }
}

const content = `
<section style="font-size:16px;line-height:1.9;color:#262626;letter-spacing:0.2px;">
  {{image:cover}}

  <p style="margin:18px 0 8px;color:#666;font-size:14px;">8月22日 · 菲律宾生活实用版</p>
  <p style="margin:0 0 22px;"><strong>今天不堆新闻。</strong>只挑和在菲华人最有关系的几件事：雨天怎么出门、上班和办事怎么问、证件该核对什么，顺便把真正能用上的 Tagalog 一起学掉。</p>

  <h2 style="margin:28px 0 14px;font-size:21px;line-height:1.45;">🇵🇭 先看今天最关心的事</h2>
  <p>菲律宾还在雨季节奏里。PAGASA 8月22日凌晨针对北吕宋部分地区继续发布 Habagat 降雨提醒；周末天气展望也显示，西南季风仍会给吕宋西部带来降雨，其他地区也可能出现阵雨或雷暴。</p>
  <p>另外两件事也值得在菲华人留意：DOLE 已发布关于<strong>恶劣天气下私人部门停工安排</strong>的劳动公告，同时还有 8月21日特别非工作日与 8月31日常规假日的工资规则；BI 最近也通报了 Binondo 外国人涉嫌非法务工的执法行动。</p>
  <p style="padding:14px 16px;background:#f7f7f7;border-left:4px solid #d9d9d9;margin:18px 0;">所以今天这一篇不讲大道理：<strong>先把出门、上班、办事、证件这四件事弄明白。</strong></p>

  <h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;">🧳 在菲华人的出门清单</h2>
  <p><strong>出门前，先做 5 个检查：</strong></p>
  <p>1. 看 PAGASA 和当地 LGU 的最新天气/积水提醒。<br>2. 用地图确认路线，尤其避开低洼路段。<br>3. 护照、ACR I-Card、工作文件拍照备份，纸质证件装防水袋。<br>4. 带充电宝和少量现金，暴雨时网络、叫车和刷卡都可能不稳定。<br>5. 去银行、政府部门或公司办事前，先确认今天是否正常办公。</p>
  <p><strong>这三句今天就能用：</strong></p>
  <p><strong>May baha ba sa daan?</strong><br><span style="color:#666;">路上有积水吗？</span></p>
  <p><strong>Bukas ba kayo ngayon?</strong><br><span style="color:#666;">你们今天营业 / 办公吗？</span></p>
  <p><strong>Pwede bang i-reschedule?</strong><br><span style="color:#666;">可以改期吗？</span></p>
  {{image:safety}}

  <h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;">🇵🇭 雨天上班/办事怎么问</h2>
  <p>菲律宾雨天最实用的，不是背一大串单词，而是会问<strong>“今天到底上不上班、还能不能办事”</strong>。</p>
  <p><strong>May pasok ba tayo ngayon?</strong><br><span style="color:#666;">我们今天上班吗？</span></p>
  <p><strong>Suspended ba ang work?</strong><br><span style="color:#666;">工作暂停了吗？</span></p>
  <p><strong>Late po ako dahil sa baha.</strong><br><span style="color:#666;">因为积水，我会迟到。</span></p>
  <p><strong>Anong oras kayo bukas?</strong><br><span style="color:#666;">你们几点开门？</span></p>
  <p>DOLE 已发布恶劣天气和类似情况导致私人部门停工的专门劳动公告。遇到暴雨，不要只听群里一句“今天不上班”。最好同时看<strong>政府公告 + 公司正式通知</strong>，并保留通知截图、打卡记录和沟通记录。</p>
  {{image:worker}}

  <h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;">🇨🇳 中国人在菲证件最容易忽略的一点</h2>
  <p>很多人会盯着“签证有没有过期”，却忽略更重要的一层：</p>
  <p style="font-size:18px;text-align:center;margin:20px 0;"><strong>有签证，不等于可以从事任何工作。</strong></p>
  <p>BI 近期通报，在 Binondo 的执法行动中，有外国人因涉嫌从事与其在菲停留条件不符的零售活动被查。对普通在菲华人来说，真正要核对的是：<strong>签证类型、工作许可、雇主信息、实际岗位和有效期能不能对应得上。</strong></p>
  <p>今天就翻一下自己的文件，至少确认：</p>
  <p>签证 / ACR I-Card 到期时间<br>工作许可或相关文件状态<br>登记雇主是否还是现在的公司<br>实际工作内容是否和文件情况一致</p>
  <p><strong>Kailangan ko bang i-update ang permit ko?</strong><br><span style="color:#666;">我的许可需要更新吗？</span></p>
  <p><strong>Kailan ang expiration nito?</strong><br><span style="color:#666;">这个什么时候到期？</span></p>
  {{image:permit}}

  <h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;">⏱ 30秒复习</h2>
  <p><strong>Habagat</strong> = 西南季风<br><strong>baha</strong> = 洪水 / 积水<br><strong>may pasok</strong> = 要上班 / 上课<br><strong>suspended</strong> = 暂停<br><strong>permit</strong> = 许可<br><strong>expiration</strong> = 到期时间</p>
  <p style="padding:14px 16px;background:#f7f7f7;margin:18px 0;">把这一句记住：<br><strong>May baha ba sa daan?</strong><br>路上有积水吗？</p>

  <h2 style="margin:30px 0 14px;font-size:21px;line-height:1.45;">🏆 今日作业</h2>
  <p>不用背十个单词，今天只做一个小练习。</p>
  <p><strong>用 Tagalog / Taglish 回答下面 3 个问题：</strong></p>
  <p>1. 你那边今天下雨吗？<br>2. 你今天要上班吗？<br>3. 你的签证 / permit 下一次什么时候到期？</p>
  <p>能说出来，就比单纯“看懂”又进了一步。</p>

  <p style="margin-top:34px;padding-top:16px;border-top:1px solid #eeeeee;color:#999;font-size:12px;line-height:1.7;">信息核对：PAGASA（2026-08-22 降雨提醒及周末天气展望）、DOLE Bureau of Working Conditions（Labor Advisory No. 13-26 / 14-26）、Philippine Bureau of Immigration / Philippine News Agency（Binondo 外国人涉嫌非法务工执法通报）。本文用于生活信息与语言学习，不替代移民、劳动或法律专业意见。</p>
</section>`;

const article = {
  ...source,
  title: '菲律宾今天这几件事，在菲华人出门、上班、证件都要看',
  author: '菲语Tagalog学习',
  digest: '8月22日菲律宾雨季继续：出门、上班、办事、证件怎么核对？顺便学几句今天就能用的 Tagalog。',
  content,
};

await writeFile(outputPath, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
console.log(`generated_article=${outputPath}`);
console.log(`title=${article.title}`);
console.log(`inline_images=${article.inline_images?.length ?? 0}`);
