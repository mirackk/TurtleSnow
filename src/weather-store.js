// D1 is the authoritative store in production. KV is supported only by old
// deployments/test fixtures; an error from D1 must never fall back to stale KV.
export function weatherStore(env){
 if(!env.WEATHER_DB){if(env.FORECASTS)return env.FORECASTS;throw Error('Weather database binding missing')}
 return {
  async get(key,type){const row=await env.WEATHER_DB.prepare('SELECT value FROM weather_cache WHERE key = ?').bind(key).first();return row?(type==='json'?JSON.parse(row.value):row.value):null},
  async put(key,value){if(typeof value!=='string')throw Error('Weather values must be serialized JSON');await env.WEATHER_DB.prepare("INSERT INTO weather_cache(key,value,stored_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,stored_at=excluded.stored_at").bind(key,value).run()}
 };
}
