import {test} from 'node:test';import assert from 'node:assert/strict';import {weatherStore} from '../src/weather-store.js';import worker from '../src/worker.js';
function db(){
 const rows=new Map();
 return {rows,prepare(sql){return {bind:(...args)=>({
  first:async()=>rows.has(args[0])?{value:rows.get(args[0])}:null,
  run:async()=>{rows.set(args[0],args[1]);return {meta:{changes:1}}}
 })}}};
}
test('D1 stores and replaces JSON snapshots without changing source timestamps',async()=>{const d=db(),s=weatherStore({WEATHER_DB:d});assert.equal(await s.get('missing','json'),null);await s.put('forecast:alta',JSON.stringify({updatedAt:'2026-10-20T19:00:00Z',snow:5}));assert.equal((await s.get('forecast:alta','json')).updatedAt,'2026-10-20T19:00:00Z');await s.put('forecast:alta',JSON.stringify({snow:10}));assert.equal((await s.get('forecast:alta','json')).snow,10)});
test('D1 errors never silently read obsolete KV data',async()=>{const env={WEATHER_DB:{prepare(){throw Error('database unavailable')}},FORECASTS:{get(){throw Error('Must not touch KV')}}};await assert.rejects(()=>weatherStore(env).get('forecast:alta','json'),/database unavailable/)});
test('anonymous API reads D1 snapshots and never accesses KV or upstream AI',async()=>{const d=db(),s=weatherStore({WEATHER_DB:d});await s.put('forecast:brighton',JSON.stringify({updatedAt:new Date().toISOString()}));await s.put('summary:brighton',JSON.stringify({windowDays:7,en:{text:'Cached AI summary'}}));const forbidden=()=>{throw Error('Unexpected access')};const r=await worker.fetch(new Request('https://snow.test/api/forecast?resort=brighton'),{WEATHER_DB:d,FORECASTS:{get:forbidden},AI:{run:forbidden}});assert.equal(r.status,200);const b=await r.json();assert.equal(b.stale,false);assert.equal(b.summary.windowDays,7);assert.equal(b.summary.en.text,'Cached AI summary')});
