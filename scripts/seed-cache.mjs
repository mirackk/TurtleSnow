// Initial seed only. Routine updates run in Cloudflare's hourly Cron.
import { refresh } from '../src/worker.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = await mkdtemp(join(tmpdir(), 'wasatch-seed-'));
const entries = [];
try {
  const results = await refresh({ FORECASTS: { async put(key, value) { entries.push({ key, value }); } } });
  if (results.some(r => r.status === 'rejected')) throw new Error('Seed fetch failed; no data uploaded');
  const path = join(dir, 'seed.json');
  await writeFile(path, JSON.stringify(entries));
  const run = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'kv', 'bulk', 'put', path, '--binding', 'FORECASTS', '--remote'], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('KV upload failed');
} finally { await rm(dir, { recursive: true, force: true }); }
