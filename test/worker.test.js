import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { refresh, resorts } from '../src/worker.js';
function store() { const m = new Map(); return { m, async put(k,v) { m.set(k,v); }, async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; } }; }
function fixture(timezone = 'America/Denver') {
 const offset=timezone==='America/New_York'?4:timezone==='America/Los_Angeles'?7:6;
 const start=Date.parse('2026-10-08T00:00:00Z')/1000+offset*3600;
 return { timezone, utc_offset_seconds:-offset*3600, daily: {time:Array.from({length:23},(_,i)=>start+i*86400),...Object.fromEntries(['snowfall_sum','temperature_2m_max','temperature_2m_min','wind_speed_10m_max'].map(k=>[k,Array(23).fill(2)]))},hourly:{time:Array.from({length:23*24},(_,i)=>start+i*3600),...Object.fromEntries(['snowfall','temperature_2m','wind_speed_10m','wind_gusts_10m','precipitation_probability'].map(k=>[k,Array(23*24).fill(k==='snowfall'?0.1:2)]))}};
}
test('hourly run fetches all sixteen resorts with local timezones; visitors only read KV', async () => {
  const kv=store(), calls=[]; const env={FORECASTS:kv};
  const result=await refresh(env,async url=>{calls.push(url);return Response.json(fixture(url.searchParams.get('timezone')));},()=>new Date('2026-10-15T17:00:00Z'));
  assert.ok(result.every(r=>r.status==='fulfilled')); assert.equal(calls.length,16);
  assert.equal(calls.find(u=>u.searchParams.get('latitude')==='40.598').searchParams.get('elevation'),'2879');
  assert.equal(calls.find(u=>u.searchParams.get('latitude')==='40.588').searchParams.get('elevation'),'2900');
  for (const [key,resort] of Object.entries(resorts)) assert.equal((await kv.get('forecast:'+key)).timezone,resort.timezone);
  const original=globalThis.fetch; globalThis.fetch=()=>{throw new Error('Visitor called upstream');};
  try { for(let i=0;i<3;i++) { const r=await worker.fetch(new Request('https://snow.test/api/forecast?resort=alta'),env); assert.equal(r.status,200); assert.equal((await r.json()).updatedAt,'2026-10-15T17:00:00.000Z'); } } finally { globalThis.fetch=original; }
});
test('one failed resort preserves old snapshot and timestamp while the other advances', async () => {
 const kv=store(),env={FORECASTS:kv}; await refresh(env,async u=>Response.json(fixture(u.searchParams.get('timezone'))),()=>new Date('2026-10-15T16:00:00Z'));
 const before=kv.m.get('forecast:brighton');
 await refresh(env,async u=>u.searchParams.get('elevation')==='2879'?new Response('',{status:503}):Response.json(fixture(u.searchParams.get('timezone'))),()=>new Date('2026-10-15T17:00:00Z'));
 assert.equal(kv.m.get('forecast:brighton'),before);
 const body=await (await worker.fetch(new Request('https://snow.test/api/forecast?resort=brighton'),env)).json();
 assert.equal(body.stale,true);assert.equal(body.lastRefreshOk,false);assert.equal(body.updatedAt,'2026-10-15T16:00:00.000Z');
 assert.equal(JSON.parse(kv.m.get('forecast:alta')).updatedAt,'2026-10-15T17:00:00.000Z');
});
test('invalid data cannot overwrite valid snapshot; empty cache never calls upstream', async () => {
 const kv=store(),env={FORECASTS:kv}; await refresh(env,async u=>Response.json(fixture(u.searchParams.get('timezone')))); const old=kv.m.get('forecast:alta');
 const bad=fixture();bad.daily.snowfall_sum[3]=null;await refresh(env,async()=>Response.json(bad));assert.equal(kv.m.get('forecast:alta'),old);
 assert.equal((await worker.fetch(new Request('https://snow.test/api/forecast'),{FORECASTS:store()})).status,503);
 assert.equal((await worker.fetch(new Request('https://snow.test/api/forecast?resort=bad'),env)).status,400);
});

test('a timezone mismatch cannot replace a cached forecast', async () => {
 const kv=store(),env={FORECASTS:kv};
 await refresh(env,async u=>Response.json(fixture(u.searchParams.get('timezone'))));
 const before=kv.m.get('forecast:killington');
 await refresh(env,async()=>Response.json(fixture('America/Denver')));
 assert.equal(kv.m.get('forecast:killington'),before);
 assert.equal((await kv.get('status:killington')).ok,false);
});

test('history is seven completed local days, forecast remains fifteen days', async () => {
 const kv=store();await refresh({FORECASTS:kv},async u=>{assert.equal(u.searchParams.get('past_days'),'7');return Response.json(fixture(u.searchParams.get('timezone')))},()=>new Date('2026-10-15T17:00:00Z'));
 const value=await kv.get('forecast:brighton');assert.equal(value.daily.time.length,15);assert.equal(value.daily.time[0],'2026-10-15');assert.equal(value.history.daily.time.length,7);assert.equal(value.history.daily.time[0],'2026-10-08');assert.equal(value.history.daily.time[6],'2026-10-14');assert.equal(value.history.snowfallTotal,14);assert.equal(value.history.source,'archived_forecast');
});

test('hourly cache covers all fifteen full forecast days, including final midnight',async()=>{
 const kv=store();await refresh({FORECASTS:kv},async u=>{assert.equal(u.searchParams.get('timeformat'),'unixtime');assert.equal(u.searchParams.get('forecast_days'),'16');return Response.json(fixture(u.searchParams.get('timezone')))},()=>new Date('2026-10-15T17:00:00Z'));
 const {dayHours}=await import('../dist/hourly.js');
 const d=await kv.get('forecast:brighton');assert.equal(d.hourly.time.length,360);
 for(const day of d.daily.time)assert.equal(dayHours(d.hourly,day,'America/Denver').length,24);
 const last=dayHours(d.hourly,'2026-10-29','America/Denver');assert.equal(last.at(-1).endTime,'24:00');
});
test('malformed hourly data preserves the entire previous snapshot',async()=>{
 const kv=store();await refresh({FORECASTS:kv},async u=>Response.json(fixture(u.searchParams.get('timezone'))));const before=kv.m.get('forecast:alta');
 await refresh({FORECASTS:kv},async u=>{const d=fixture(u.searchParams.get('timezone'));d.hourly.snowfall.pop();return Response.json(d)});
 assert.equal(kv.m.get('forecast:alta'),before);
});
test('local interval grouping handles DST and missing snow is not zero',async()=>{
 const {dayHours,summarize}=await import('../dist/hourly.js');
 for(const [day,start,count] of [['2026-11-01','2026-11-01T04:00:00Z',25],['2026-03-08','2026-03-08T05:00:00Z',23]]){
  const hourly={time:Array.from({length:count},(_,i)=>Date.parse(start)/1000+(i+1)*3600),snowfall:Array(count).fill(1)};
  const hours=dayHours(hourly,day,'America/New_York');assert.equal(hours.length,count);assert.equal(summarize(hours).snowfall,count);hours[0].snowfall=null;assert.equal(summarize(hours).snowfall,null);
 }
});

test('daily fixed-offset dates survive both DST transitions in all US resort zones',async()=>{
 const {splitForecast,zonedMidnight}=await import('../src/worker.js');const {dayHours}=await import('../dist/hourly.js');
 for(const zone of ['America/Denver','America/New_York','America/Los_Angeles'])for(const [today,offset] of [['2026-10-20',zone==='America/Denver'?-6:zone==='America/New_York'?-4:-7],['2026-03-01',zone==='America/Denver'?-7:zone==='America/New_York'?-5:-8]]){
  const anchor=Date.parse(today+'T00:00:00Z')/1000;const raw=fixture(zone);raw.utc_offset_seconds=offset*3600;
  raw.daily.time=Array.from({length:23},(_,i)=>anchor+(i-7)*86400-raw.utc_offset_seconds);
  const start=zonedMidnight(new Date((anchor-7*86400)*1000).toISOString().slice(0,10),zone),end=zonedMidnight(new Date((anchor+16*86400)*1000).toISOString().slice(0,10),zone);
  raw.hourly.time=Array.from({length:(end-start)/3600+1},(_,i)=>start+i*3600);for(const k of ['snowfall','temperature_2m','wind_speed_10m','wind_gusts_10m','precipitation_probability'])raw.hourly[k]=Array(raw.hourly.time.length).fill(1);
  const result=splitForecast(raw,zone,new Date(today+'T18:00:00Z'));assert.equal(result.daily.time[0],today);assert.equal(result.daily.time.length,15);assert.equal(result.hourly.time.length,today.startsWith('2026-10')?361:359);
  const changeDay=today.startsWith('2026-10')?'2026-11-01':'2026-03-08';assert.equal(dayHours(result.hourly,changeDay,zone).length,today.startsWith('2026-10')?25:23);
 }
});
test('a successful refresh supersedes an earlier failure without writing a second status key',async()=>{
 const kv=store(),now=()=>new Date('2026-10-15T17:00:00Z');await kv.put('status:brighton',JSON.stringify({attemptedAt:'2026-10-15T16:00:00Z',ok:false}));const writes=[];const put=kv.put;kv.put=async(k,v)=>{writes.push(k);await put(k,v)};
 await refresh({FORECASTS:kv},async u=>Response.json(fixture(u.searchParams.get('timezone'))),now);assert.equal(writes.length,16);const d=await(await worker.fetch(new Request('https://snow.test/api/forecast?resort=brighton'),{FORECASTS:kv})).json();assert.equal(d.lastRefreshOk,true);assert.equal(d.lastAttemptAt,'2026-10-15T17:00:00.000Z');
});
