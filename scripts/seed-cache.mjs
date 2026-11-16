// Initial seed only. Routine updates run in Cloudflare's hourly Cron.
import { refresh } from '../src/worker.js';
import { refreshReports } from '../src/reports.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = await mkdtemp(join(tmpdir(), 'wasatch-seed-'));
const statements = [];
const quote=s=>s===null?'NULL':typeof s==='number'?String(s):"'"+String(s).replaceAll("'","''")+"'";
const db={prepare(sql){return {bind(...args){const entry={sql,args};return {...entry,async run(){statements.push(entry);return {meta:{changes:1}}}}}}},async batch(entries){statements.push(...entries);return entries.map(()=>({success:true}))}};
try {
  const env={WEATHER_DB:db,SNOW_PILOT:'brighton-nbm-v1'};
  const results = await refresh(env);
  if (results.some(r => r.status === 'rejected')) throw new Error('Seed fetch failed; no data uploaded');
  await refreshReports(env);
  const path = join(dir, 'seed.sql');
  await writeFile(path,statements.map(({sql,args})=>{let i=0;const statement=sql.replace(/\?/g,()=>quote(args[i++]));if(i!==args.length)throw Error('SQL bind mismatch');return statement+';'}).join('\n'));
  const run = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'turtlesnow-weather', '--file', path, '--remote'], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('D1 upload failed');
} finally { await rm(dir, { recursive: true, force: true }); }
