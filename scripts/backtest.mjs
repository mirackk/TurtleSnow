import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resorts} from '../dist/resorts.js';
import {analyzeBacktest} from './backtest-lib.mjs';
const args=process.argv.slice(2),arg=(key,fallback)=>{const i=args.indexOf('--'+key);return i<0?fallback:args[i+1]};
if(args.includes('--help')){console.log('node scripts/backtest.mjs --resort brighton --from YYYY-MM-DD --to YYYY-MM-DD --remote [--strict] [--out DIR]');process.exit(0)}
const resort=arg('resort','brighton'),from=arg('from'),to=arg('to');
const validDate=s=>/^\d{4}-\d\d-\d\d$/.test(s??'')&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
if(!Object.hasOwn(resorts,resort)||!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>60*86400000)throw Error('Valid resort and --from/--to dates (maximum 60 days) required');
if(!args.includes('--remote'))throw Error('Use --remote explicitly to export the deployed verification archive');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(arg('out',resolve(root,'backtests',`${resort}-${from}-${to}`)));
const earliest=new Date(Date.parse(from)-6*86400000).toISOString(),latest=new Date(Date.parse(to)+2*86400000).toISOString();
function query(sql){
 const p=spawnSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','turtlesnow-weather','--remote','--command',sql,'--json'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
 if(p.status!==0)throw Error('D1 read failed: '+p.stderr.slice(-800));
 const data=JSON.parse(p.stdout);if(data.some(r=>r.success===false))throw Error('D1 query failed');return data.flatMap(r=>r.results??[]);
}
function exportRows(table,column){
 let all=[];
 for(let offset=0;;offset+=100){
  const rows=query(`SELECT * FROM ${table} WHERE resort='${resort}' AND ${column}>='${earliest}' AND ${column}<='${latest}' ORDER BY ${column}, ${table==='forecast_archive'?'variant':'reported_at, content_hash'} LIMIT 100 OFFSET ${offset}`);
  all.push(...rows);if(rows.length<100)return all;
 }
}
const forecasts=exportRows('forecast_archive','captured_at'),reports=exportRows('report_archive','last_seen_at');
const result=analyzeBacktest(forecasts,reports,{from,to,timezone:resorts[resort].timezone,strict:args.includes('--strict')});
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'raw-forecasts.json'),JSON.stringify(forecasts));
await writeFile(resolve(out,'raw-reports.json'),JSON.stringify(reports));
await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2));
const columns=['date','reportAt','leadHours','variant','capturedAt','actualLeadHours','observedCm','predictedCm','errorCm','alignment','pipelineVersion'];
await writeFile(resolve(out,'comparison.csv'),[columns.join(','),...result.rows.map(r=>columns.map(k=>r[k]).join(','))].join('\n')+'\n');
const metricRows=result.metrics.filter(m=>m.n).map(m=>`| ${m.leadHours} | ${m.cohort} | ${m.variant} | ${m.scope} | ${m.n} | ${m.maeCm} | ${m.biasCm} | ${m.provisional?'provisional':'verified'} |`);
const stormRows=result.stormTotals.map(s=>`| ${s.leadHours} | ${s.from}–${s.to} | ${s.observedCm} | ${s.predictedCm['best-match-v1']} | ${s.predictedCm['published-v1']} | ${s.predictedCm['nbm-five-day-shadow-v1']} | ${s.provisional?'provisional':'verified'} |`);
const report=`# ${resorts[resort].name} verification: ${from}–${to}\n\nGenerated ${new Date().toISOString()}. Official report days: ${result.reportDays}. Matched rows: ${result.rows.length}. Missing combinations: ${result.missing.length}.\n\n${result.rows.length?'Do not interpret provisional scores as validated skill.':'No eligible comparisons yet. This is not a zero-error result; forecasts must have been saved before each event.'}\n\n| Lead hours | Cohort | Variant | Scope | n | MAE cm | Bias cm | Misses | False alarms | Alignment |\n|---|---|---|---|---:|---:|---:|---:|---:|---|\n${metricRows.join('\n')}\n\n## Consecutive reported snowy days\n\n| Lead hours | Dates | Observed cm | Baseline cm | Published cm | Five-day candidate cm | Alignment |\n|---|---|---:|---:|---:|---:|---|\n${stormRows.join('\n')}\n\n${result.limitations.map(s=>'- '+s).join('\n')}\n\nInspect results.json for missing/excluded records, comparison.csv for each matched day, and raw JSON for source evidence. Positive bias means overprediction. No automatic recalibration or deployment is performed.\n`;
await writeFile(resolve(out,'report.md'),report);
console.log(JSON.stringify({directory:out,forecastSnapshots:forecasts.length,officialReports:reports.length,reportDays:result.reportDays,matchedRows:result.rows.length,missing:result.missing.length,strict:result.strict},null,2));
