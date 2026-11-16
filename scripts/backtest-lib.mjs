// Pure verification logic; the CLI exports private D1 data using Wrangler OAuth.
const day=(ms,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
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

export function analyzeBacktest(forecasts,reports,{from,to,timezone='America/Denver',strict=false,variants=['best-match-v1','published-v1','nbm-native-v1'],leads=[24,48,72]}={}) {
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
 // Headline comparison uses exactly the same observation days for both
 // published and baseline. Unpaired rows remain in CSV, never in paired MAE.
 const metrics=[];
 for(const lead of leads){
  const shared=new Set(rows.filter(r=>r.leadHours===lead&&r.variant==='best-match-v1').map(r=>r.date).filter(d=>rows.some(r=>r.date===d&&r.leadHours===lead&&r.variant==='published-v1')));
  for(const variant of variants)for(const scope of ['all paired days','snow-active paired days']){
   const data=rows.filter(r=>r.leadHours===lead&&r.variant===variant&&shared.has(r.date)&&
    (scope==='all paired days'||rows.some(s=>s.date===r.date&&s.leadHours===lead&&['best-match-v1','published-v1'].includes(s.variant)&&(s.observedCm>=0.5||s.predictedCm>=0.5))));
   metrics.push({leadHours:lead,variant,scope,n:data.length,maeCm:data.length?round(data.reduce((s,r)=>s+Math.abs(r.errorCm),0)/data.length):null,
    biasCm:data.length?round(data.reduce((s,r)=>s+r.errorCm,0)/data.length):null,provisional:data.some(r=>r.alignment!=='verified')});
  }
 }
 return {from,to,timezone,strict,reportDays:daily.size,rows,metrics,missing,excluded,
  limitations:['Report timestamp is only a provisional measurement cutoff unless verified; use --strict to exclude it.',
   'Snow totals at different elevations/locations are not interchangeable. No official history is synthesized from modeled snow.',
   'Bias is prediction minus report. Negative means underprediction. Paired metrics compare the same observed days.',
   'NBM-only diagnostics may have fewer days than the paired baseline/published comparison; inspect n.',
   'Captured timestamps record availability to this app, not model initialization times. No post-target snapshots are admitted.',
   'Hourly interval amounts are prorated at sub-hour report boundaries; no missing hourly value is treated as zero.',
   'Early snow-season zero reports can reflect reporting practice; inspect raw reports before interpreting aggregate scores.']};
}
