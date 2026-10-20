import { weatherStore } from './weather-store.js';
const brightonURL='https://www.brightonresort.com/api/reportpal?resortName=br&useReportPal=true';
const number=(v,max=1500)=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v):null;
export function parseBrighton(d){
 if(d.name!=='Brighton'||!Number.isFinite(Date.parse(d.updated)))throw Error('Invalid official report');
 const l=d.currentConditions?.resortLocations?.location?.find(l=>l.name==='Brighton');if(!l)throw Error('Missing location');
 return {source:'Brighton official snow report',url:'https://www.brightonresort.com/conditions',reportedAt:d.updated,baseCm:number(l.base?.centimeters),snow24Cm:number(l.snow24Hours?.centimeters),snow48Cm:number(l.snow48Hours?.centimeters),status:['Open','Closed'].includes(d.operations?.resortStatus)?d.operations.resortStatus:'unknown'};
}
export function parseAlta(html){
 const match=html.match(/window\.Alta\s*=\s*({[\s\S]*?});\s*<\/script>/);if(!match)throw Error('Missing official report');const d=JSON.parse(match[1]),c=d.conditions,s=d.seasonal;if(!c||!s||!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(c.dated_at))throw Error('Invalid report');
 return {source:'Alta official snow report',url:'https://www.alta.com/weather',reportedAt:c.dated_at+' America/Denver',baseCm:s.show_base_depth?convert(c.base_depth):null,snow24Cm:s.show_24hr_snow?convert(c.last24):null,snow48Cm:null,status:s.is_winter?'unknown':'outside_winter',seasonHidden:!s.show_base_depth&&!s.show_24hr_snow};
}
function convert(n){const v=number(n,600);return v===null?null:Math.round(v*2.54*10)/10}
export async function refreshReports(env,fetcher=fetch,now=()=>new Date()){
 for(const [key,url,parser] of [['brighton',brightonURL,parseBrighton],['alta','https://www.alta.com/weather',parseAlta]]){
  try{const r=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Report unavailable');const report=parser(key==='brighton'?await r.json():await r.text());await weatherStore(env).put('report:'+key,JSON.stringify({...report,fetchedAt:now().toISOString()}));await weatherStore(env).put('report-status:'+key,JSON.stringify({ok:true}));}
  catch{await weatherStore(env).put('report-status:'+key,JSON.stringify({ok:false}));console.error('Official report refresh failed: '+key)}
 }
}
