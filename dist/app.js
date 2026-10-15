import { resorts } from './resorts.js';
import { translations } from './translations.js';
const $=id=>document.getElementById(id);
const saved=k=>{try{return localStorage.getItem(k)}catch{return null}};
const save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let lang=saved('snow-language')==='zh'?'zh':'en', unit=saved('snow-unit')==='inch'?'inch':'cm', key=saved('snow-resort')||'brighton';
if(!Object.hasOwn(resorts,key))key='brighton';
let data=null, selected=0, request=0, table=false, loading=false, failed=false, timedOut=false;
const t=(zh,en)=>lang==='en'?en:zh;
const locale=()=>lang==='en'?'en-US':'zh-CN';
const date=s=>new Date(s+'T12:00:00Z').toLocaleDateString(locale(),{timeZone:'UTC',month:'numeric',day:'numeric'});
const weekday=s=>new Date(s+'T12:00:00Z').toLocaleDateString(locale(),{timeZone:'UTC',weekday:'short'});
const num=n=>(unit==='inch'?n/2.54:n).toFixed(1).replace(/\.0$/,'');
const snow=n=>num(n)+' '+(unit==='inch'?'in':'cm');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:resorts[key].timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('resort').replaceChildren(...Object.entries(resorts).sort((a,b)=>a[1].name.localeCompare(b[1].name,'en')).map(([id,r])=>new Option(r.name,id)));
$('resort').value=key;
function staticText(){
 document.documentElement.lang=lang==='en'?'en':'zh-CN';$('language').value=lang;
 document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=translations[Number(el.dataset.i18n)][lang==='en'?1:0]});
 document.querySelector('.seg').setAttribute('aria-label',t('降雪单位','Snowfall units'));
 document.querySelector('.cards').setAttribute('aria-label',t('累计降雪','Snowfall totals'));
 $('chart').setAttribute('aria-label',t('15 天每日新增降雪图','15-day daily snowfall chart'));
 $('point-label').textContent=t('指定预报点','Forecast point');$('horizon').textContent=t('未来 15 天','Next 15 days');
 $('source-label').textContent=t('数据：','Data: ');
 $('cache-note').textContent=t('服务端每小时更新 · 共享缓存','Updated hourly · Shared cache');
 $('forecast-note').textContent=t('模型预计新增降雪，非雪场实测；指定海拔不代表整座雪场。','Modeled snowfall, not resort measurements. The forecast elevation does not represent the entire resort.');
 $('units-note').textContent=t('指定预报点海拔 · 温度 °C · 风速 km/h','Forecast-point elevation · Temperature °C · Wind km/h');
 $('section-title').textContent=table?t('每日天气详情','Daily weather details'):t('15 天新增降雪','15-day snowfall');
}
function status(){
 const r=resorts[key];$('region').textContent=r.region;$('state').textContent=r.state+', USA';$('resort-title').textContent=r.name;
 document.title=r.name+' · turtleSnow';$('elevation').textContent=r.elevation.toLocaleString(locale())+' m';$('official').href=r.url;
 const warning=data?.stale;
 document.querySelector('.dot').style.background=failed?'#e9bb67':warning?'#e9bb67':'#6fdfb2';
 $('error').classList.toggle('hidden',!failed&&!warning);
 if(failed){$('updated').textContent=t('预报获取失败','Forecast unavailable');$('error').textContent=t('暂时无法读取预报，请稍后重试。','Unable to read the forecast. Please try again shortly.')+(timedOut?t('（请求超时）',' (Request timed out)'):'');}
 else if(data){
 const stamp=new Date(data.updatedAt).toLocaleString(locale(),{timeZone:r.timezone,year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'short'});
 $('updated').textContent=t('预报更新于 ','Forecast updated ')+stamp+(warning?t(' · 更新延迟',' · Update delayed'):'');
 if(warning)$('error').textContent=t('定时更新延迟或失败，当前展示最近一次成功获取的预报。请留意数据日期；页面刷新只重新读取共享缓存。','The scheduled update is delayed or failed. Showing the last successful forecast; check its date. Refresh only reads the shared cache.');
 }else $('updated').textContent=t('正在读取共享预报…','Loading shared forecast…');
 $('refresh').disabled=loading;
}
function detail(){
 if(!data)return;const d=data.daily,i=selected;
 $('detail').innerHTML=`<strong>${date(d.time[i])} ${weekday(d.time[i])}</strong><span>${t('新增降雪','Snowfall')}<b>${snow(d.snowfall_sum[i])}</b></span><span>${t('气温','Temperature')}<b>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°C</b></span><span>${t('最大风速','Max wind')}<b>${Math.round(d.wind_speed_10m_max[i])} km/h</b></span>${i>6?`<span style="color:var(--purple)">${t('远期趋势','Long-range trend')}</span>`:''}`;
 document.querySelectorAll('.day').forEach((el,j)=>{el.classList.toggle('selected',j===i);el.setAttribute('aria-pressed',String(j===i))});
}
function renderHistory(){
 if(!$('history-title'))return; // Tolerate an older HTML document during asset propagation.
 $('history-title').textContent=t('过去 7 天降雪','Past 7 days snowfall');
 $('history-badge').textContent=t('截至昨日 · 雪场当地时间','Through yesterday · Resort local time');
 $('history-label').textContent=t('7 天累计新增降雪','7-day snowfall total');
 $('history-note').textContent=t('历史天气模型估算（归档预报），不是雪场实测或现有积雪厚度；仅统计所示日期的 7 个完整自然日，不含今天。','Historical model estimates (archived forecasts), not resort measurements or current snow depth. Covers the seven complete local calendar days shown, excluding today.');
 const h=data?.history?.daily;
 if(!h||h.time?.length!==7||h.snowfall_sum?.length!==7||!h.snowfall_sum.every(Number.isFinite)){
  $('history-total').textContent='—';$('history-range').textContent=t('历史数据暂不可用','Historical data unavailable');$('history-days').replaceChildren();return;
 }
 const total=h.snowfall_sum.reduce((a,b)=>a+b,0),max=Math.max(...h.snowfall_sum,1);
 $('history-total').innerHTML=num(total)+`<span>${unit==='inch'?'in':'cm'}</span>`;
 $('history-range').textContent=date(h.time[0])+' – '+date(h.time[6]);
 $('history-days').innerHTML=h.time.map((day,i)=>`<div class="history-day" aria-label="${day}, ${t('历史模型降雪','historical modeled snowfall')} ${snow(h.snowfall_sum[i])}"><div class="history-bar-space"><span class="bar-value">${num(h.snowfall_sum[i])}</span><div class="history-bar" style="height:${Math.max(3,h.snowfall_sum[i]/max*64)}px"></div></div><div class="weekday">${weekday(day)}</div><div class="date">${date(day)}</div></div>`).join('');
}
function render(){
 staticText();status();renderHistory();['cm','inch'].forEach(u=>{$(u).classList.toggle('active',u===unit);$(u).setAttribute('aria-pressed',String(u===unit))});
 if(!data){
 ['sum1','sum2','sum3'].forEach(id=>$(id).textContent='—');['range1','range2','range3'].forEach(id=>$(id).textContent=t('等待预报','Awaiting forecast'));
 $('chart').replaceChildren();$('rows').replaceChildren();$('total').textContent=t('正在加载','Loading');$('detail').textContent=failed?t('数据暂不可用；请刷新重试。','Data unavailable. Please refresh to retry.'):t('正在读取预报…','Loading forecast…');
 $('outlook-title').textContent=failed?t('等待天气数据','Awaiting weather data'):t('正在分析降雪窗口','Finding snow windows');$('outlook').textContent='';return;
 }
 const d=data.daily,falls=d.snowfall_sum,total=falls.reduce((a,b)=>a+b,0),max=Math.max(...falls,1),localToday=today();
 for(let j=0;j<3;j++){const start=j*5,end=start+5;$('sum'+(j+1)).innerHTML=num(falls.slice(start,end).reduce((a,b)=>a+b,0))+`<span>${unit==='inch'?'in':'cm'}</span>`;$('range'+(j+1)).textContent=date(d.time[start])+' – '+date(d.time[end-1])+(j===2?t(' · 远期趋势',' · Trend'):'');}
 $('total').textContent=t('15 天累计 ','15-day total ')+snow(total);
 const scroll=document.querySelector('.scroll'),previousScroll=scroll.scrollLeft;
 $('chart').innerHTML=d.time.map((day,i)=>`<button class="day ${i>6?'far':''}" data-index="${i}" aria-label="${day}, ${t('新增降雪','snowfall')} ${snow(falls[i])}"><div class="bar-space"><span class="bar-value">${num(falls[i])}</span><div class="bar" style="height:${Math.max(3,falls[i]/max*147)}px"></div></div><span class="weekday">${day===localToday?t('今天','Today'):weekday(day)}</span><span class="date">${date(day)}</span></button>`).join('');
 $('chart').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.index);detail()});scroll.scrollLeft=previousScroll;
 $('rows').innerHTML=d.time.map((day,i)=>`<tr><td>${date(day)} ${weekday(day)}${i>6?t(' · 趋势',' · Trend'):''}</td><td style="color:${i>6?'var(--purple)':'var(--blue)'}">${snow(falls[i])}</td><td>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°C</td><td>${Math.round(d.wind_speed_10m_max[i])} km/h</td></tr>`).join('');
 const peak=falls.indexOf(Math.max(...falls));
 $('outlook-title').textContent=total>0?t(`${date(d.time[peak])} 降雪信号最强`,`Strongest snow signal: ${date(d.time[peak])}`):t('未来 15 天暂无明显降雪信号','No notable snow signal in the next 15 days');
 $('outlook').textContent=total>0?t(`当前模型预计 ${resorts[key].name} 15 天累计新增降雪 ${snow(total)}，其中 ${date(d.time[peak])} 约 ${snow(falls[peak])}。`,`The current model forecasts ${snow(total)} of snow at ${resorts[key].name} over 15 days, with about ${snow(falls[peak])} on ${date(d.time[peak])}. `)+(peak>6?t('主要信号在一周之后，建议临近 3–5 天再确认雪量。','The main signal is over a week away. Recheck amounts 3–5 days before your trip.'):t('出发前继续关注预报更新、雪场开放与道路情况。','Check forecast updates, resort operations and road conditions before traveling.')):t('当前模型预计新增降雪为零。后续天气过程仍可能变化。','The current model predicts no new snow. Weather patterns may still change.');detail();
}
async function load(){
 const id=++request;data=null;selected=0;loading=true;failed=false;timedOut=false;render();document.querySelector('.chart-panel').classList.add('loading');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
 const response=await fetch('/api/forecast?resort='+encodeURIComponent(key),{signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);
 const result=await response.json();if(result.timezone!==resorts[key].timezone||!Number.isFinite(Date.parse(result.updatedAt))||result.daily?.time?.length!==15||['snowfall_sum','temperature_2m_max','temperature_2m_min','wind_speed_10m_max'].some(k=>result.daily[k]?.length!==15||!result.daily[k].every(Number.isFinite)))throw new Error('Incomplete forecast');
 if(id!==request)return;data=result;
 }catch(error){if(id!==request)return;failed=true;timedOut=error.name==='AbortError';}
 finally{clearTimeout(timer);if(id===request){loading=false;document.querySelector('.chart-panel').classList.remove('loading');render();}}
}
$('resort').onchange=e=>{key=e.target.value;save('snow-resort',key);document.querySelector('.scroll').scrollLeft=0;load()};
$('language').onchange=e=>{lang=e.target.value==='en'?'en':'zh';save('snow-language',lang);render()};
$('refresh').onclick=load;
['cm','inch'].forEach(u=>$(u).onclick=()=>{unit=u;save('snow-unit',u);render()});
function tab(showTable){table=showTable;$('table-view').classList.toggle('hidden',!table);$('chart-view').classList.toggle('hidden',table);['table','chart'].forEach(name=>{const active=(name==='table')===table;$(name+'-tab').classList.toggle('active',active);$(name+'-tab').setAttribute('aria-pressed',String(active))});render()}
$('table-tab').onclick=()=>tab(true);$('chart-tab').onclick=()=>tab(false);load();
