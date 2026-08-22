import fs from 'node:fs/promises';

const config = JSON.parse(await fs.readFile('tech-news/account.json', 'utf8'));
const eventName = process.env.GITHUB_EVENT_NAME || '';
const schedule = process.env.TECH_SCHEDULE || '';
const force = String(process.env.FORCE_PUBLISH || '').toLowerCase() === 'true';
const outputPath = process.env.GITHUB_OUTPUT || '';

const cronSlots = [
  '17 0 * * *',
  '43 2 * * *',
  '11 4 * * *',
  '37 6 * * *',
  '23 9 * * *',
  '49 11 * * *',
  '7 13 * * *',
  '53 14 * * *',
];

function manilaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone || 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function hash32(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, seed) {
  const out = [...values];
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function emit(values) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n');
  await fs.appendFile(outputPath, `${lines}\n`, 'utf8');
}

const date = manilaDate();
const seed = hash32(`${config.account}:${date}`);
const min = Number(config.dailyMin || 5);
const max = Number(config.dailyMax || 8);
const target = min + (seed % (max - min + 1));
const pickedSlots = shuffle([...cronSlots.keys()], seed).slice(0, target).sort((a, b) => a - b);

let slotIndex = cronSlots.indexOf(schedule);
if (eventName === 'workflow_dispatch' || force) {
  slotIndex = slotIndex >= 0 ? slotIndex : pickedSlots[0] ?? 0;
}

const shouldPublish = force || eventName === 'workflow_dispatch' || pickedSlots.includes(slotIndex);
const articleIndex = Math.max(0, pickedSlots.indexOf(slotIndex));
const lanes = Array.isArray(config.editorialLanes) && config.editorialLanes.length
  ? config.editorialLanes
  : ['科技热点'];
const lane = lanes[(seed + Math.max(articleIndex, 0)) % lanes.length];

await emit({
  should_publish: shouldPublish ? 'true' : 'false',
  daily_target: String(target),
  slot_index: String(slotIndex),
  article_index: String(Math.max(articleIndex, 0)),
  editorial_lane: lane,
  manila_date: date,
});
