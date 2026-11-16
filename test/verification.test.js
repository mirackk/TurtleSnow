import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyNBM,fetchNBM,compactForecast,BASELINE,PUBLISHED} from '../src/forecast-pipeline.js';
import {saveForecast,saveReport,pruneArchive} from '../src/archive.js';
import {parseBrighton} from '../src/reports.js';
import {officialWeek} from '../dist/snow-sources.js';
import {analyzeBacktest,integrateSnow} from '../scripts/backtest-lib.mjs';
import {refresh,zonedMidnight} from '../src/worker.js';

function pilotFixture(first='2026-11-16'){
 const dates=Array.from({length:15},(_,i)=>new Date(Date.parse(first)+i*86400000).toISOString().slice(0,10));
 const start=zonedMidnight(dates[0],'America/Denver'),end=zonedMidnight(dates[3],'America/Denver');
 const time=Array.from({length:(end-start)/3600+24},(_,i)=>start+(i+1)*3600);
 return {timezone:'America/Denver',daily:{time:dates,snowfall_sum:Array(15).fill(99)},hourly:{time,snowfall:time.map(()=>0.7),temperature_2m:time.map(()=>-5)}};
}
test('NBM uses full local-day intervals including DST and leaves history/later dates unchanged',()=>{
 for(const start of ['2026-10-31','2026-03-07','2026-11-16']){
  const baseline=pilotFixture(start);baseline.history={snowfallTotal:7};const nbm={hourly:{time:baseline.hourly.time,snowfall:baseline.hourly.time.map(()=>1.5)}};
  const out=applyNBM(baseline,nbm),expected=start==='2026-10-31'?[36,37.5,36]:start==='2026-03-07'?[36,34.5,36]:[36,36,36];
  assert.deepEqual(out.daily.snowfall_sum.slice(0,3),expected);assert.equal(out.daily.snowfall_sum[3],99);assert.equal(baseline.daily.snowfall_sum[0],99);
  assert.equal(out.hourly.snowfall.at(-1),0.7);assert.equal(out.history,baseline.history);assert.equal(out.snowSource.mode,'nbm-pilot');
  nbm.hourly.snowfall[5]=null;assert.throws(()=>applyNBM(baseline,nbm),/complete/);
 }
});
test('NBM rejects missing/null hourly coverage, wrong units and upstream errors',async()=>{
 const raw={timezone:'America/Denver',hourly_units:{snowfall:'cm'},hourly:{time:[0,3600],snowfall:[0,1],precipitation:[0,1],rain:[0,0],temperature_2m:[-5,-5]}};
 const location={latitude:40.598,longitude:-111.583,elevation:2879,timezone:'America/Denver'};
 const value=await fetchNBM(location,async u=>{assert.equal(u.searchParams.get('models'),'ncep_nbm_conus');return Response.json(raw)});assert.equal(value.hourly.snowfall[1],1);
 raw.hourly.snowfall[1]=null;await assert.rejects(()=>fetchNBM(location,async()=>Response.json(raw)),/Incomplete/);
 await assert.rejects(()=>fetchNBM(location,async()=>new Response('',{status:429})),/429/);
});
test('NBM outage does not block baseline refresh or invent a newer NBM result',async()=>{
 const m=new Map(),stamp=new Date('2026-11-16T20:00:00Z');let calls=0;
 const env={SNOW_PILOT:'brighton-nbm-v1',FORECASTS:{put:async(k,v)=>m.set(k,JSON.parse(v))}};
 const results=await refresh(env,async u=>{
  calls++;if(u.searchParams.has('models'))return new Response('',{status:503});
  const zone=u.searchParams.get('timezone'),offset=zone==='America/New_York'?-5:zone==='America/Los_Angeles'?-8:-7;
  const start=Date.parse('2026-11-09T00:00:00Z')/1000-offset*3600;
  return Response.json({timezone:zone,utc_offset_seconds:offset*3600,daily:{time:Array.from({length:23},(_,i)=>start+i*86400),...Object.fromEntries(['snowfall_sum','temperature_2m_max','temperature_2m_min','wind_speed_10m_max'].map(k=>[k,Array(23).fill(1)]))},hourly:{time:Array.from({length:23*24},(_,i)=>start+i*3600),...Object.fromEntries(['snowfall','temperature_2m','wind_speed_10m','wind_gusts_10m','precipitation_probability'].map(k=>[k,Array(23*24).fill(1)]))}});
 },()=>stamp);
 assert.equal(calls,17);assert.ok(results.every(r=>r.status==='fulfilled'));assert.equal(m.get('forecast:brighton').updatedAt,stamp.toISOString());assert.equal(m.get('forecast:brighton').snowSource.pilotUnavailable,true);
});
test('official totals preserve fractional inch precision and flag contradictory fields',()=>{
 const d={name:'Brighton',updated:'2026-11-16T11:55:26Z',currentConditions:{resortLocations:{location:[{name:'Brighton',snow24Hours:{inches:'0'},snow48Hours:{inches:'5'},snow72Hours:{inches:'0'},snow7Days:{inches:'5'}}]}}};
 const p=parseBrighton(d);assert.equal(p.snow7DaysCm,12.7);assert.equal(p.snow24Cm,0);assert.ok(p.qualityIssues.includes('snow72Cm_lower_than_snow48Cm'));assert.equal(p.measurementCutoffVerified,false);
 assert.equal(officialWeek(p).total,12.7);d.currentConditions.resortLocations.location[0].snow7Days.inches='2';assert.equal(officialWeek(parseBrighton(d)),null);
});
test('snapshots/report revisions are batched, report hashes ignore fetch time, retention is bounded',async()=>{
 const batches=[],db={prepare:sql=>({bind:(...args)=>({sql,args})}),batch:async list=>batches.push(list)};
 const f={...pilotFixture(),updatedAt:'2026-11-16T20:00:00.000Z'};
 const location={latitude:40.598,longitude:-111.583,elevation:2879,timezone:'America/Denver'};
 await saveForecast({WEATHER_DB:db},'brighton',f,location,[[BASELINE,f],[PUBLISHED,f]]);assert.equal(batches[0].length,3);
 const saved=JSON.parse(batches[0][1].args[4]);assert.equal(saved.modelRunAt,null);assert.equal(saved.requestedPoint.elevation,2879);assert.ok(saved.hourly.time.length);
 assert.equal(compactForecast(f,location,f.updatedAt,false).hourly,undefined);
 const report={reportedAt:'2026-11-16T12:00:00Z',snow24Cm:12.7};
 await saveReport({WEATHER_DB:db},'brighton',{...report,fetchedAt:'2026-11-16T13:00:00Z'});
 await saveReport({WEATHER_DB:db},'brighton',{...report,fetchedAt:'2026-11-16T14:00:00Z'});
 assert.equal(batches[1][2].args[2],batches[2][2].args[2]);
 await saveReport({WEATHER_DB:db},'brighton',{...report,snow24Cm:15,fetchedAt:'2026-11-16T15:00:00Z'});assert.notEqual(batches[1][2].args[2],batches[3][2].args[2]);
 await pruneArchive({WEATHER_DB:db},new Date('2026-11-16T00:00:00Z'));assert.equal(batches.at(-1)[0].args[0],'2026-09-17T00:00:00.000Z');
});
test('backtest never uses post-target forecasts; missing hourly values are not zero',()=>{
 const end=Date.parse('2026-11-17T13:00:00Z'),start=end-86400000;
 const h={time:Array.from({length:24},(_,i)=>(start+(i+1)*3600000)/1000),snowfall:Array(24).fill(1)};
 assert.equal(integrateSnow(h,start,end),24);assert.equal(integrateSnow(h,start+1800000,end-1800000),23);
 assert.equal(integrateSnow({...h,snowfall:h.snowfall.map((v,i)=>i===5?null:v)},start,end),null);
 const row=(variant,cm,delta=0)=>({variant,captured_at:new Date(start+delta).toISOString(),pipeline_version:'test',payload:{hourly:{...h,snowfall:Array(24).fill(cm/24)}}});
 const reports=[{payload:{reportedAtUTC:new Date(end).toISOString(),snow24Cm:12,measurementCutoffVerified:false},last_seen_at:new Date(end).toISOString()}];
 const f=[row(BASELINE,7),row(PUBLISHED,13),row(PUBLISHED,100,60000)];
 const r=analyzeBacktest(f,reports,{from:'2026-11-17',to:'2026-11-17'});
 assert.equal(r.rows.find(x=>x.variant===PUBLISHED).predictedCm,13);assert.equal(r.metrics.find(x=>x.variant===BASELINE&&x.leadHours===24).maeCm,5);
 assert.equal(r.metrics.find(x=>x.variant===PUBLISHED&&x.leadHours===24).maeCm,1);assert.equal(r.rows[0].alignment,'provisional_report_timestamp');
 assert.equal(analyzeBacktest(f,reports,{from:'2026-11-17',to:'2026-11-17',strict:true}).rows.length,0);
 const empty=analyzeBacktest([],reports,{from:'2026-11-17',to:'2026-11-17'});assert.equal(empty.metrics[0].maeCm,null);assert.ok(empty.missing.length);
});
