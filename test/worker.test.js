import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { refresh } from '../src/worker.js';
function store() { const m = new Map(); return { m, async put(k,v) { m.set(k,v); }, async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; } }; }
function fixture() { return { timezone: 'America/Denver', daily: { time: Array.from({length:15},(_,i)=>`2026-10-${String(i+15).padStart(2,'0')}`), ...Object.fromEntries(['snowfall_sum','temperature_2m_max','temperature_2m_min','wind_speed_10m_max'].map(k=>[k,Array(15).fill(2)])) } }; }
test('hourly run fetches both fixed elevations; visitors only read KV', async () => {
  const kv=store(), calls=[]; const env={FORECASTS:kv};
  const result=await refresh(env,async url=>{calls.push(url);return Response.json(fixture());},()=>new Date('2026-10-15T17:00:00Z'));
  assert.ok(result.every(r=>r.status==='fulfilled')); assert.equal(calls.length,2);
  assert.deepEqual(calls.map(u=>u.searchParams.get('elevation')),['2879','2900']);
  const original=globalThis.fetch; globalThis.fetch=()=>{throw new Error('Visitor called upstream');};
  try { for(let i=0;i<3;i++) { const r=await worker.fetch(new Request('https://snow.test/api/forecast?resort=alta'),env); assert.equal(r.status,200); assert.equal((await r.json()).updatedAt,'2026-10-15T17:00:00.000Z'); } } finally { globalThis.fetch=original; }
});
test('one failed resort preserves old snapshot and timestamp while the other advances', async () => {
 const kv=store(),env={FORECASTS:kv}; await refresh(env,async()=>Response.json(fixture()),()=>new Date('2026-10-15T16:00:00Z'));
 const before=kv.m.get('forecast:brighton');
 await refresh(env,async u=>u.searchParams.get('elevation')==='2879'?new Response('',{status:503}):Response.json(fixture()),()=>new Date('2026-10-15T17:00:00Z'));
 assert.equal(kv.m.get('forecast:brighton'),before);
 const body=await (await worker.fetch(new Request('https://snow.test/api/forecast?resort=brighton'),env)).json();
 assert.equal(body.stale,true);assert.equal(body.lastRefreshOk,false);assert.equal(body.updatedAt,'2026-10-15T16:00:00.000Z');
 assert.equal(JSON.parse(kv.m.get('forecast:alta')).updatedAt,'2026-10-15T17:00:00.000Z');
});
test('invalid data cannot overwrite valid snapshot; empty cache never calls upstream', async () => {
 const kv=store(),env={FORECASTS:kv}; await refresh(env,async()=>Response.json(fixture())); const old=kv.m.get('forecast:alta');
 const bad=fixture();bad.daily.snowfall_sum[3]=null;await refresh(env,async()=>Response.json(bad));assert.equal(kv.m.get('forecast:alta'),old);
 assert.equal((await worker.fetch(new Request('https://snow.test/api/forecast'),{FORECASTS:store()})).status,503);
 assert.equal((await worker.fetch(new Request('https://snow.test/api/forecast?resort=bad'),env)).status,400);
});
