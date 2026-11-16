export const PIPELINE_VERSION = '2026-11-16-nbm-pilot-v1';
export const BASELINE = 'best-match-v1';
export const NBM = 'nbm-native-v1';
export const PUBLISHED = 'published-v1';
export const diagnosticFields = ['precipitation', 'rain', 'showers'];
const formatters=new Map();
export function localDay(seconds,timezone) {
 if(!formatters.has(timezone))formatters.set(timezone,new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}));
 return formatters.get(timezone).format(new Date(seconds*1000));
}

export async function fetchNBM(location, fetcher = fetch) {
 const url = new URL('https://api.open-meteo.com/v1/forecast');
 url.search = new URLSearchParams({latitude:location.latitude,longitude:location.longitude,elevation:location.elevation,
  models:'ncep_nbm_conus',hourly:'snowfall,precipitation,rain,temperature_2m',forecast_days:5,
  timezone:location.timezone,timeformat:'unixtime'});
 const response = await fetcher(url, {signal:AbortSignal.timeout(20000)});
 if (!response.ok) throw Error(`NBM HTTP ${response.status}`);
 const raw = await response.json(), h = raw.hourly;
 if(raw.timezone !== location.timezone || raw.hourly_units?.snowfall !== 'cm' ||
    !h?.time?.length || !h.time.every((t,i)=>Number.isFinite(t)&&(!i||t-h.time[i-1]===3600)) ||
    ['snowfall','precipitation','rain','temperature_2m'].some(k=>h[k]?.length!==h.time.length || !h[k].every(Number.isFinite)) ||
    ['snowfall','precipitation','rain'].some(k=>h[k].some(v=>v<0))) throw Error('Incomplete NBM forecast');
 return raw;
}

// Replace only complete local-day snowfall windows. Wind/temperature and longer
// leads retain Best Match. No guessed snow multiplier or rain-to-snow conversion.
export function applyNBM(baseline, nbm) {
 const h=nbm.hourly, indices=new Map(h.time.map((t,i)=>[t,i]));
 const days=baseline.daily.time.slice(0,3), replacements=new Map(),labels=baseline.hourly.time.map(t=>localDay(t-3600,baseline.timezone));
 for(let i=0;i<baseline.hourly.time.length;i++) {
  const time=baseline.hourly.time[i];
  if(!days.includes(labels[i])) continue;
  const j=indices.get(time);
  if(j===undefined || !Number.isFinite(h.snowfall[j])) throw Error('NBM does not cover complete pilot days');
  replacements.set(i,h.snowfall[j]);
 }
 if(days.some(day=>!labels.some((label,i)=>replacements.has(i)&&label===day))) throw Error('Missing pilot day');
 const hourly={...baseline.hourly,snowfall:baseline.hourly.snowfall.map((v,i)=>replacements.has(i)?replacements.get(i):v)};
 const sums=days.map(day=>Math.round([...replacements].reduce((s,[i,v])=>s+(labels[i]===day?v:0),0)*1000)/1000);
 return {...baseline,hourly,daily:{...baseline.daily,snowfall_sum:baseline.daily.snowfall_sum.map((v,i)=>i<3?sums[i]:v)},
  snowSource:{mode:'nbm-pilot',model:'ncep_nbm_conus',days,variable:'snowfall',pipelineVersion:PIPELINE_VERSION}};
}

export function baselineSource(error=null) {
 return {mode:'best-match',model:'best_match',days:[],pipelineVersion:PIPELINE_VERSION,...(error?{pilotUnavailable:true}: {})};
}

// Keep the fields needed for paired verification, not the full API response.
// All resorts retain daily forecasts; Brighton additionally retains hourly data.
export function compactForecast(forecast, location, capturedAt, hourly=false) {
 const result={capturedAt,availableAt:capturedAt,modelRunAt:null,timezone:location.timezone,
  requestedPoint:{latitude:location.latitude,longitude:location.longitude,elevation:location.elevation},
  gridPoint:{latitude:forecast.latitude,longitude:forecast.longitude,elevation:forecast.elevation},
  daily:forecast.daily??null,snowSource:forecast.snowSource??null,
  note:'Captured live forecast; model initialization time is not supplied by this endpoint.'};
 if(hourly && forecast.hourly) {
  const h=forecast.hourly, start=Date.parse(capturedAt)/1000-86400, end=Date.parse(capturedAt)/1000+8*86400;
  const selected=h.time.flatMap((t,i)=>t>=start&&t<=end?[i]:[]);
  result.hourly=Object.fromEntries(['time','snowfall','precipitation','rain','showers','temperature_2m'].filter(k=>h[k]).map(k=>[k,selected.map(i=>h[k][i])]));
 }
 return result;
}
