// Pure verification logic; the CLI exports private D1 data using Wrangler OAuth.
const day=(ms,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const shadow='nbm-five-day-shadow-v1';
const production=['best-match-v1','published-v1'];
const round=v=>Math.round(v*1000)/1000;

export function integrateSnow(hourly,start,end) {
 if(!hourly?.time || end<=start)return null;
 let coverage=0,total=0,previous=-Infinity;
 for(let i=0;i<hourly.time.length;i++) {
  const t=hourly.time[i]*1000;
  if(!Number.isFinite(t)||t<=previous)return null;
  previous=t;
  const overlap=Math.max(0,Math.min(end,t)-Math.max(start,t-3600000));
  if(!overlap)continue;
  const v=hourly.snowfall?.[i];
  if(!Number.isFinite(v)||v<0)return null;
  coverage+=overlap;total+=v*overlap/3600000;
 }
 return coverage===end-start?round(total):null;
}

export function analyzeBacktest(forecasts,reports,{from,to,timezone='America/Denver',strict=false,variants=['best-match-v1','published-v1',shadow,'nbm-native-v1'],leads=[24,48,72,96,120]}={}) {
 const daily=new Map(),excluded=[];
 for(const row of reports) {
  const p=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
  const end=Date.parse(p.reportedAtUTC),d=Number.isFinite(end)?day(end,timezone):null;
  if(!d||d<from||d>to)continue;
  const problems=p.qualityIssues??[];
  if(!Number.isFinite(p.snow24Cm)||p.snow24Cm<0||problems.includes('snow48Cm_lower_than_snow24Cm')){excluded.push({date:d,reason:'missing or inconsistent official 24h snowfall'});continue;}
  if(strict&&!p.measurementCutoffVerified){excluded.push({date:d,reason:'measurement cutoff not independently verified'});continue;}
  // Avoid scoring overlapping updates repeatedly. Keep the latest morning
  // report per local date; revisions of the same report use last_seen_at.
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date(end)));
  if(hour>=12){excluded.push({date:d,reason:'not a morning report'});continue;}
  const prior=daily.get(d),seen=row.last_seen_at??row.first_seen_at??'';
  if(!prior||end>prior.end||(end===prior.end&&seen>prior.seen))daily.set(d,{p,end,seen,date:d});
 }
 const decoded=forecasts.map(row=>({...row,p:typeof row.payload==='string'?JSON.parse(row.payload):row.payload,time:Date.parse(row.captured_at)}));
 const rows=[],missing=[];
 for(const obs of [...daily.values()].sort((a,b)=>a.end-b.end))for(const lead of leads)for(const variant of variants){
  const target=obs.end-lead*3600000;
  // Never use a later snapshot: it has seen more of the event. A missed cron
  // cannot silently substitute a much older or post-event forecast.
  const candidate=decoded.filter(f=>f.variant===variant&&f.time<=target&&f.time>=target-90*60000).sort((a,b)=>b.time-a.time)[0];
  if(!candidate){missing.push({date:obs.date,lead,variant,reason:'no eligible pre-event snapshot'});continue;}
  const predicted=integrateSnow(candidate.p.hourly,obs.end-86400000,obs.end);
  if(predicted===null){missing.push({date:obs.date,lead,variant,reason:'missing complete hourly coverage'});continue;}
  rows.push({date:obs.date,reportAt:obs.p.reportedAtUTC,leadHours:lead,variant,capturedAt:candidate.captured_at,
   actualLeadHours:round((obs.end-candidate.time)/3600000),observedCm:obs.p.snow24Cm,predictedCm:predicted,
   errorCm:round(predicted-obs.p.snow24Cm),alignment:obs.p.measurementCutoffVerified?'verified':'provisional_report_timestamp',
   sourceQualityIssues:obs.p.qualityIssues??[],pipelineVersion:candidate.pipeline_version});
 }
 // Compare only common dates AND archive times within each cohort.
 const metrics=[], stormTotals=[];
 for(const lead of leads) {
  const leadRows=rows.filter(r=>r.leadHours===lead);
  for(const [cohort,members] of [['production pair',production],['three-way', [...production,shadow]],['raw NBM diagnostic',[...production,'nbm-native-v1']]]) {
   const matched=[...daily.keys()].sort().flatMap(date=>{
    const group=members.map(variant=>leadRows.find(r=>r.date===date&&r.variant===variant));
    return group.every(r=>r&&r.capturedAt===group[0]?.capturedAt)?[group]:[];
   });
   for(const variant of members)for(const scope of ['all paired days','snow-active paired days']){
    const data=matched.filter(g=>scope==='all paired days'||g.some(r=>r.observedCm>=0.5||r.predictedCm>=0.5)).map(g=>g.find(r=>r.variant===variant));
    metrics.push({leadHours:lead,cohort,variant,scope,n:data.length,maeCm:data.length?round(data.reduce((s,r)=>s+Math.abs(r.errorCm),0)/data.length):null,
     biasCm:data.length?round(data.reduce((s,r)=>s+r.errorCm,0)/data.length):null,
     misses:data.filter(r=>r.observedCm>=0.5&&r.predictedCm<0.5).length,falseAlarms:data.filter(r=>r.observedCm<0.5&&r.predictedCm>=0.5).length,
     provisional:data.some(r=>r.alignment!=='verified')});
   }
   if(cohort!=='three-way')continue;
   const storms=[];
   for(const date of [...daily.keys()].sort().filter(d=>daily.get(d).p.snow24Cm>=0.5)){
    const last=storms.at(-1);
    if(last&&Date.parse(date)-Date.parse(last.at(-1))===86400000)last.push(date);else storms.push([date]);
   }
   for(const dates of storms){
    const event=dates.map(d=>matched.find(g=>g[0].date===d));
    if(event.some(g=>!g))continue;
    stormTotals.push({leadHours:lead,from:dates[0],to:dates.at(-1),days:dates.length,
     observedCm:round(event.reduce((s,g)=>s+g[0].observedCm,0)),predictedCm:Object.fromEntries(members.map((v,i)=>[v,round(event.reduce((s,g)=>s+g[i].predictedCm,0))])),
     provisional:event.some(g=>g[0].alignment!=='verified')});
   }
  }
 }
 return {from,to,timezone,strict,reportDays:daily.size,rows,metrics,stormTotals,missing,excluded,
  limitations:['Report timestamp is only a provisional measurement cutoff unless verified; use --strict to exclude it.',
   'Snow totals at different elevations/locations are not interchangeable. No official history is synthesized from modeled snow.',
   'Bias is prediction minus report. Negative means underprediction. Paired metrics compare the same observed days.',
   'Compare scores within a cohort only. A five-local-calendar-day policy need not cover every hour at 120h lead; raw NBM is a separate diagnostic.',
   'Storm totals are sums of consecutive reported snowy days with complete three-way matches, not independent event forecasts. Inspect report times for overlaps/gaps.',
   'Captured timestamps record availability to this app, not model initialization times. No post-target snapshots are admitted.',
   'Hourly interval amounts are prorated at sub-hour report boundaries; no missing hourly value is treated as zero.',
   'Early snow-season zero reports can reflect reporting practice; inspect raw reports before interpreting aggregate scores.']};
}
