import fs from 'node:fs/promises';

const status = {
  workflow: process.env.WORKFLOW_NAME || 'Daily Talk Tech Autowriter',
  status: process.env.JOB_STATUS || 'unknown',
  run_id: process.env.GITHUB_RUN_ID || '',
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || '',
  event_name: process.env.GITHUB_EVENT_NAME || '',
  ref: process.env.GITHUB_REF || '',
  sha: process.env.GITHUB_SHA || '',
  updated_at: new Date().toISOString(),
};

await fs.mkdir('tech-news/status', { recursive: true });
await fs.writeFile('tech-news/status/last-run.json', `${JSON.stringify(status, null, 2)}\n`, 'utf8');
console.log(`recorded_status=${status.status}`);
console.log(`run_id=${status.run_id}`);
