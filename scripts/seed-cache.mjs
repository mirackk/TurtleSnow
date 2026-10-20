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
  const path = join(dir, 'seed.sql');
  const quote = s => "'" + s.replaceAll("'", "''") + "'";
  await writeFile(path, entries.map(({key,value})=>`INSERT INTO weather_cache(key,value) VALUES(${quote(key)},${quote(value)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value,stored_at=datetime('now');`).join('\n'));
  const run = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'turtlesnow-weather', '--file', path, '--remote'], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('D1 upload failed');
} finally { await rm(dir, { recursive: true, force: true }); }
