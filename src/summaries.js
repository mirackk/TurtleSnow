import { weatherStore } from './weather-store.js';
import {resorts} from '../dist/resorts.js';
export const DAILY_SUMMARY_LIMIT=32;
export function summaryBatch(index){return Object.keys(resorts).sort().slice(index*8,(index+1)*8)}
export const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export function validateSummary(raw,officialStatus='unknown'){
 let d=typeof raw==='string'?JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,'')):raw;
 for(const lang of ['en','zh']){
  const v=d?.[lang];if(v&&['past','next','experience'].some(k=>k in v)){
   if(!['past','next','experience'].every(k=>typeof v[k]==='string'&&v[k].trim().length>=4))throw Error('Missing weekly section');
   v.text=[v.past,v.next,v.experience].join(' ');
  }
 }
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
export async function refreshSummaries(env,now=()=>new Date(),keys=Object.keys(resorts)){
 if(!env.AI)return;
 const stamp=now(),day=stamp.toISOString().slice(0,10),slot=day+'T'+(stamp.getUTCHours()<12?'00':'12')+':summary-week-v1';
 for(const key of keys){
  const r=resorts[key];if(!r)continue;
  const forecast=await weatherStore(env).get('forecast:'+key,'json');
  if(!forecast||stamp-Date.parse(forecast.updatedAt)>90*60000)continue;
  // Reserve before calling AI: no visitor-triggered generation, retries, or burst billing.
  const claim=await env.FEEDBACK_DB.prepare(`INSERT OR IGNORE INTO summary_runs(resort,slot,day) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM summary_runs WHERE day=?)<?`).bind(key,slot,day,day,DAILY_SUMMARY_LIMIT).run();
  if(!claim.meta.changes)continue;
  try{
   const report=['brighton','alta'].includes(key)?await weatherStore(env).get('report:'+key,'json'):null;
   const reportStatus=report?await weatherStore(env).get('report-status:'+key,'json'):null;
   const recentReport=report&&reportStatus?.ok!==false&&stamp-Date.parse(report.fetchedAt)<2*3600000&&report.reportedAt.slice(0,10)===new Intl.DateTimeFormat('en-CA',{timeZone:r.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(stamp)?report:null;
   const facts=weeklyFacts(forecast,r,recentReport);
   const system='Write a skier experience summary covering BOTH the PAST seven completed local days and the NEXT seven forecast days using ONLY the supplied facts. Return JSON exactly {"en":{"headline":"short useful headline","past":"one sentence explicitly labeling past snow as modeled estimates","next":"one or two sentences comparing near-term versus later-week forecast snow","experience":"one or two conditional sentences about surface changes and wind"},"zh":{"headline":"自然简体中文短标题","past":"过去七天的模型估算降雪背景，不得写成实测","next":"未来七天，区分近期与后半段趋势","experience":"气温及风可能带来的体验变化"}}. Total at most one hundred English words and two hundred forty Chinese characters per language. Never describe past snow as future snow. Later-week timing/amounts are less certain. Forecasts do not establish current surfaces or skiability. No snow does not mean dry weather. Do not invent observed powder, base, visibility, roads, openings or safety. Present Closed status is not a forecast of continued closure. Mention status only when supplied and relevant; omit unknown status. Exact numbers are in separate cards: NO digits or numerical amounts in prose. Retain resort names in English. Use fluent Chinese skiing terms. Never infer lift closures from wind. Use conditional language for snow quality.';
   const result=await env.AI.run(MODEL,{messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(facts).slice(0,5000)}],max_tokens:1000,temperature:0.2});
   const raw=result.response??result.choices?.[0]?.message?.content;
   const text=validateSummary(raw,facts.officialStatus);
   if(/\bdry\b|干燥|reports? (?:no |new )?snow|no recent snowfall|currently (?:has |experiencing )?(?:no )?snow|remain closed|forecast[^.]*closed|modeled snow is expected|风况变化不定/i.test(text.en.text+' '+text.en.headline+' '+text.zh.text))throw Error('Unsupported condition claim');
   await weatherStore(env).put('summary:'+key,JSON.stringify({...text,model:MODEL,generatedAt:now().toISOString(),forecastAt:forecast.updatedAt,windowDays:7,historyDates:forecast.history?.daily?.time?.slice(-7)??[],forecastDates:forecast.daily.time.slice(0,7)}));
  }catch(error){console.error('AI summary retained/fallback: '+key+' '+error.message)}
 }
}

export function weeklyFacts(forecast,r,report){
 const d=forecast.daily,h=forecast.history?.daily;
 const sum=a=>a.reduce((a,b)=>a+b,0),snowTag=n=>n===0?'no new snow':n<10?'light new snow':'notable new snow';
 const past=h?.snowfall_sum?.slice(-7),recent=past?.length===7&&past.every(Number.isFinite)?sum(past):null;
 const next=d.snowfall_sum.slice(0,7),peak=next.indexOf(Math.max(...next));
 const temp=(start,end)=>d.temperature_2m_max.slice(start,end).every(v=>v<=0)?'highs at or below freezing':d.temperature_2m_max.slice(start,end-1).some((v,i)=>v>0&&d.temperature_2m_min[start+i+1]<0)?'possible daytime thaw followed by overnight freezing':'some highs above freezing';
 const wind=(start,end)=>Math.max(...d.wind_speed_10m_max.slice(start,end))>=30?'stronger forecast-point winds; exposed terrain may be affected':'forecast-point winds below our simple elevated-wind threshold; ridge winds may differ';
 return {resort:r.name,scope:'PAST seven completed local days and NEXT seven days including today',pastModeledSnow:recent===null?'unavailable':snowTag(recent)+' estimated by a MODEL for the PAST week; NOT observed or resort-reported',pastTemperature:h?.temperature_2m_max?.length===7?(h.temperature_2m_max.some(v=>v>0)?'modeled past week included above-freezing daytime temperatures':'modeled past week highs at or below freezing'):'unavailable',forecastWholeWeek:snowTag(sum(next)),forecastNearTerm:snowTag(sum(next.slice(0,3)))+' in the first three forecast days',forecastLaterWeek:snowTag(sum(next.slice(3)))+' in the following four forecast days; timing less certain',strongestSnowSignal:Math.max(...next)>0?(peak<3?'near term':'later in the week'):'none',nearTermTemperature:temp(0,3),laterWeekTemperature:temp(3,7),nearTermWind:wind(0,3),laterWeekWind:wind(3,7),officialStatus:report?.status??'unknown',baseAvailable:report?.baseCm!==null&&report?.baseCm!==undefined};
}
