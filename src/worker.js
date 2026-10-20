import { refreshReports } from './reports.js';
import { refreshSummaries } from './summaries.js';
import { feedback } from './feedback.js';
import { hourlyFields, localDate } from '../dist/hourly.js';
import { resorts } from '../dist/resorts.js';
export { resorts };
const fields = ['snowfall_sum', 'temperature_2m_max', 'temperature_2m_min', 'wind_speed_10m_max'];
export function validate(data, timezone = 'America/Denver', days = 15) {
  const d = data?.daily;
  if (data?.timezone !== timezone || d?.time?.length !== days ||
      !d.time.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t)) ||
      fields.some(k => d[k]?.length !== days || !d[k].every(Number.isFinite)) ||
      d.snowfall_sum.some(n => n < 0) || d.wind_speed_10m_max.some(n => n < 0)) {
    throw new Error('Incomplete forecast');
  }
  return data;
}
export function zonedMidnight(date,timezone){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Missing calendar boundary');
 const target=Date.parse(date+'T00:00:00Z');let value=target;
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(value)).map(p=>[p.type,p.value]));const wall=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);value+=target-wall;}
 return value/1000;
}
export function splitForecast(raw, timezone, now) {
  if (!raw?.daily?.time) throw new Error('Missing daily data');
  // Open-Meteo daily Unix dates use one utc_offset_seconds for the entire
  // response, even when the forecast crosses a DST transition. They are
  // calendar labels, not actual IANA-local midnight instants.
  if(!Number.isFinite(raw.utc_offset_seconds))throw new Error('Missing daily UTC offset');
  const dailyDates=raw.daily.time.map(n=>Number.isFinite(n)?new Date((n+raw.utc_offset_seconds)*1000).toISOString().slice(0,10):null);
  if(dailyDates.some(d=>!d))throw new Error('Invalid daily dates');
  const firstHour=zonedMidnight(dailyDates[7],timezone),lastHour=zonedMidnight(dailyDates[22],timezone);
  raw = {...raw, daily: Object.fromEntries(Object.entries(raw.daily).map(([k,v])=>[k,k==='time'?dailyDates.slice(0,22):v.slice(0,22)]))};
  validate(raw, timezone, 22);
  const h=raw.hourly;
  if(!h?.time?.length || !h.time.every((n,i)=>Number.isFinite(n)&&(!i||n-h.time[i-1]===3600)) || hourlyFields.some(k=>h[k]?.length!==h.time.length || !h[k].every(v=>v===null||Number.isFinite(v)))) throw new Error('Incomplete hourly data');
  if(h.snowfall.some(v=>v!==null&&v<0)||h.wind_speed_10m.some(v=>v!==null&&v<0))throw new Error('Invalid hourly values');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  const anchor = Date.parse(today + 'T00:00:00Z');
  if (!raw.daily.time.every((date,i) => date === new Date(anchor + (i-7)*86400000).toISOString().slice(0,10))) throw new Error('Unexpected forecast dates');
  const slice = (start,end) => Object.fromEntries(Object.entries(raw.daily).map(([key,values]) => [key,values.slice(start,end)]));
  const past = slice(0,7);
  const indices=h.time.flatMap((end,i)=>end>firstHour&&end<=lastHour?[i]:[]);
  const hourly=Object.fromEntries(['time',...hourlyFields].map(k=>[k,indices.map(i=>h[k][i])]));
  if(hourly.time.length!==(lastHour-firstHour)/3600||hourly.time[0]!==firstHour+3600||hourly.time.at(-1)!==lastHour)throw new Error('Missing hourly forecast coverage');
  return { ...raw, daily_units: {...raw.daily_units, time: 'iso8601'}, hourly, daily: slice(7,22), history: { daily: past, snowfallTotal: past.snowfall_sum.reduce((a,b)=>a+b,0), source: 'archived_forecast', completeDays: 7 } };
}
export async function refresh(env, fetcher = fetch, now = () => new Date()) {
  const entries = Object.entries(resorts), results = [];
  // Bound concurrent upstream requests as the catalog grows.
  for (let i = 0; i < entries.length; i += 3) {
    results.push(...await Promise.allSettled(entries.slice(i, i + 3).map(async ([key, location]) => {
    const attemptedAt = now().toISOString();
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, elevation: location.elevation, daily: fields.join(','), timezone: location.timezone, forecast_days: 16, past_days: 7, hourly: hourlyFields.join(','), timeformat: 'unixtime', temperature_unit: 'celsius', wind_speed_unit: 'kmh' });
      const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
      const forecast = splitForecast(await response.json(), location.timezone, now());
      // No TTL: the last valid forecast survives upstream outages.
      await env.FORECASTS.put(`forecast:${key}`, JSON.stringify({ ...forecast, updatedAt: now().toISOString() }));
      // A successful snapshot timestamp also records success; avoid a second KV write.
    } catch (error) {
      await env.FORECASTS.put(`status:${key}`, JSON.stringify({ attemptedAt, ok: false, error: String(error.message).slice(0,180) }));
      console.error(`Forecast refresh failed: ${key}`, error.message);
      throw error;
    }
    })));
  }
  return results;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/feedback') return feedback(request, env);
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
    if (url.pathname !== '/api/forecast') return Response.json({ error: 'Not found' }, { status: 404, headers });
    const key = url.searchParams.get('resort') || 'brighton';
    if (!Object.hasOwn(resorts, key)) return Response.json({ error: 'Unknown resort' }, { status: 400, headers });
    // Visitors only read shared storage. They never trigger upstream calls.
    const [forecast, savedStatus, summary, report, reportStatus] = await Promise.all([
      env.FORECASTS.get(`forecast:${key}`, 'json'), env.FORECASTS.get(`status:${key}`, 'json'),
      env.FORECASTS.get(`summary:${key}`, 'json'), env.FORECASTS.get(`report:${key}`, 'json'), env.FORECASTS.get(`report-status:${key}`, 'json')
    ]);
    if (!forecast) return Response.json({ error: 'Forecast not initialized' }, { status: 503, headers: { ...headers, 'Retry-After': '300' } });
    const status = savedStatus && Date.parse(savedStatus.attemptedAt)>Date.parse(forecast.updatedAt) ? savedStatus : {attemptedAt:forecast.updatedAt,ok:true};
    const stale = Date.now() - Date.parse(forecast.updatedAt) > 90 * 60 * 1000 || status?.ok === false;
    return Response.json({ ...forecast, summary, report: report ? {...report, stale: reportStatus?.ok === false || Date.now()-Date.parse(report.fetchedAt)>2*3600000} : null, stale, lastAttemptAt: status?.attemptedAt || null, lastRefreshOk: status?.ok ?? null }, { headers });
  },
  async scheduled(controller, env, ctx) {
    if (controller.cron === '30 */12 * * *') { await refreshSummaries(env); return; }
    const results = await refresh(env);
    await refreshReports(env);
    if (results.some(r => r.status === 'rejected')) throw new Error('One or more forecasts failed to refresh');
  }
};
