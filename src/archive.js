import { PIPELINE_VERSION, compactForecast } from './forecast-pipeline.js';
import { weatherStore } from './weather-store.js';

export async function saveForecast(env,key,forecast,location,variants=[]) {
 const value=JSON.stringify(forecast);
 if(!env.WEATHER_DB) {await weatherStore(env).put('forecast:'+key,value);return;}
 const db=env.WEATHER_DB;
 const statements=[db.prepare("INSERT INTO weather_cache(key,value,stored_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,stored_at=excluded.stored_at").bind('forecast:'+key,value)];
 for(const [variant,snapshot] of variants) statements.push(db.prepare('INSERT OR IGNORE INTO forecast_archive(resort,captured_at,variant,pipeline_version,payload) VALUES(?,?,?,?,?)')
  .bind(key,forecast.updatedAt,variant,PIPELINE_VERSION,JSON.stringify(compactForecast(snapshot,location,forecast.updatedAt,key==='brighton'))));
 // One batched D1 subrequest: cache and its verification record commit together.
 await db.batch(statements);
}

export async function saveReport(env,key,report) {
 const value=JSON.stringify(report);
 if(!env.WEATHER_DB) {await weatherStore(env).put('report:'+key,value);await weatherStore(env).put('report-status:'+key,JSON.stringify({ok:true}));return;}
 const {fetchedAt,...source}=report;
 const encoded=JSON.stringify(source);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(encoded))),v=>v.toString(16).padStart(2,'0')).join('');
 const db=env.WEATHER_DB;
 await db.batch([
  db.prepare("INSERT INTO weather_cache(key,value,stored_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,stored_at=excluded.stored_at").bind('report:'+key,value),
  db.prepare("INSERT INTO weather_cache(key,value,stored_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,stored_at=excluded.stored_at").bind('report-status:'+key,JSON.stringify({ok:true})),
  db.prepare('INSERT INTO report_archive(resort,reported_at,content_hash,first_seen_at,last_seen_at,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(resort,reported_at,content_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at')
   .bind(key,report.reportedAt,hash,fetchedAt,fetchedAt,encoded)
 ]);
}

export async function pruneArchive(env,now=new Date()) {
 if(!env.WEATHER_DB)return;
 const cutoff=new Date(now-60*86400000).toISOString(),db=env.WEATHER_DB;
 await db.batch([
  db.prepare('DELETE FROM forecast_archive WHERE captured_at < ?').bind(cutoff),
  db.prepare('DELETE FROM report_archive WHERE last_seen_at < ?').bind(cutoff)
 ]);
}
