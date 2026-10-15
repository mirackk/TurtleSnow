import {resorts} from '../dist/resorts.js';
export const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export function validateSummary(raw,officialStatus='unknown'){
 let d=typeof raw==='string'?JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,'')):raw;
 for(const lang of ['en','zh'])for(const k of ['headline','text']){
  const s=d?.[lang]?.[k];if(typeof s!=='string'||s.trim().length<4||s.length>(k==='headline'?100:850)||/[<>\d]/.test(s))throw Error('Invalid summary '+lang+'.'+k+' '+typeof s+' '+JSON.stringify(s)?.slice(0,180));
 }
 if(officialStatus!=='Closed'){
  if(/closed|关闭|停业/i.test(d.en.text+' '+d.zh.text))throw Error('Unverified closure');
  if(/closed|关闭|停业/i.test(d.en.headline+' '+d.zh.headline)){
   if(officialStatus!=='outside_winter')throw Error('Unverified closure');
   d.en.headline='Weather outlook outside winter reporting';d.zh.headline='非冬季雪况模式 · 天气展望';
  }
 }
 if(!/[\u4e00-\u9fff]/.test(d.zh.text))throw Error('Missing Chinese');
 return Object.fromEntries(['en','zh'].map(l=>[l,{headline:d[l].headline.trim(),text:d[l].text.trim()}]));
}
export async function refreshSummaries(env,now=()=>new Date()){
 if(!env.AI)return;
 const stamp=now(),day=stamp.toISOString().slice(0,10),slot=day+'T'+(stamp.getUTCHours()<12?'00':'12')+':summary-v1';
 for(const [key,r] of Object.entries(resorts)){
  const forecast=await env.FORECASTS.get('forecast:'+key,'json');
  if(!forecast||stamp-Date.parse(forecast.updatedAt)>90*60000)continue;
  // Reserve before calling AI: no visitor-triggered generation, retries, or burst billing.
  const claim=await env.FEEDBACK_DB.prepare(`INSERT OR IGNORE INTO summary_runs(resort,slot,day) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM summary_runs WHERE day=?)<18`).bind(key,slot,day,day).run();
  if(!claim.meta.changes)continue;
  try{
   const report=['brighton','alta'].includes(key)?await env.FORECASTS.get('report:'+key,'json'):null;
   const reportStatus=report?await env.FORECASTS.get('report-status:'+key,'json'):null;
   const recentReport=report&&reportStatus?.ok!==false&&stamp-Date.parse(report.fetchedAt)<2*3600000&&report.reportedAt.slice(0,10)===new Intl.DateTimeFormat('en-CA',{timeZone:r.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(stamp)?report:null;
   const d=forecast.daily,n=d.snowfall_sum.slice(0,3).reduce((a,b)=>a+b,0),past=forecast.history?.daily?.snowfall_sum?.slice(-3),recent=past?.length===3?past.reduce((a,b)=>a+b,0):null;
   const facts={resort:r.name,scope:'next three days; forecasts only, not observed surfaces',pastContext:recent===null?'Past modeled snow unavailable':recent===0?'The PAST three completed days have no modeled new snow':'The PAST three completed days have '+(recent<10?'light':'notable')+' modeled snowfall. This is PAST, NOT a forecast or observed snow.',forecastNewSnow:n===0?'none':n<10?'light':'notable',temperature:d.temperature_2m_max.slice(0,3).every(v=>v<=0)?'highs remain at or below freezing':d.temperature_2m_max.slice(0,2).some((v,i)=>v>0&&d.temperature_2m_min[i+1]<0)?'daytime thaw followed by overnight freezing possible':'some periods above freezing',wind:Math.max(...d.wind_speed_10m_max.slice(0,3))>=30?'stronger forecast-point winds may affect exposed terrain':'forecast-point winds are not elevated by our simple threshold; ridge winds may differ',officialStatus:recentReport?.status??'unknown',baseAvailable:recentReport?.baseCm!==null&&recentReport?.baseCm!==undefined};
   const system='Write a useful skier experience outlook from ONLY these qualitative facts. Return JSON exactly {"en":{"headline":"short practical headline","text":"two or three concise sentences, at most sixty words"},"zh":{"headline":"自然的简体中文短标题","text":"相同含义的自然简体中文，最多一百五十字"}}. Use forecast/预计 language for future weather. Never describe past snow as expected or forecast. Current Closed status is a present report, NOT a forecast of continued closure. Omit unknown status; no need to mention it. Do not invent variable winds. Do not state current measured conditions. No snowfall does NOT mean dry, clear or rain-free. Any mention of recent snow MUST explicitly call it modeled/模型估算. Never invent powder, surface observations, base depth, roads, visibility, resort openings or safety. Do not infer skiability. If officialStatus is Closed or outside_winter, mention it briefly. If unknown, do not invent a status. Base only appears in separate cards; do not mention base in prose. Include relevant temperature or wind impact conditionally. No digits, numerical quantities or markdown. Keep resort names in English. Fluent Chinese skiing terms: 压雪、缆车、雪面. Do not repeat limitations as the whole summary.';
   const result=await env.AI.run(MODEL,{messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(facts).slice(0,5000)}],max_tokens:650,temperature:0.2});
   const raw=result.response??result.choices?.[0]?.message?.content;
   const text=validateSummary(raw,facts.officialStatus);
   if(/\bdry\b|干燥|reports? (?:no |new )?snow|no recent snowfall|currently (?:has |experiencing )?(?:no )?snow|remain closed|forecast[^.]*closed|modeled snow is expected|风况变化不定/i.test(text.en.text+' '+text.en.headline+' '+text.zh.text))throw Error('Unsupported condition claim');
   await env.FORECASTS.put('summary:'+key,JSON.stringify({...text,model:MODEL,generatedAt:now().toISOString(),forecastAt:forecast.updatedAt,forecastDates:forecast.daily.time.slice(0,3)}));
  }catch(error){console.error('AI summary retained/fallback: '+key+' '+error.message)}
 }
}
