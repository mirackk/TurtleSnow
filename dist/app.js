import { dayHours, summarize } from './hourly.js';
import { brightonParking, parkingStatus } from './parking.js';
import { resorts } from './resorts.js';
import { translations } from './translations.js';
const $=id=>document.getElementById(id);
const saved=k=>{try{return localStorage.getItem(k)}catch{return null}};
const save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let lang=saved('snow-language')==='zh'?'zh':'en', unit=saved('snow-unit')==='inch'?'inch':'cm', key=saved('snow-resort')||'brighton';
if(!Object.hasOwn(resorts,key))key='brighton';
let parkingActive=false;
let parkingDay=null,parkingTime='09:00';
let hourlyOpen=false;
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
 renderHourly();
 if(!data)return;const d=data.daily,i=selected;
 $('detail').innerHTML=`<strong>${date(d.time[i])} ${weekday(d.time[i])}</strong><span>${t('新增降雪','Snowfall')}<b>${snow(d.snowfall_sum[i])}</b></span><span>${t('气温','Temperature')}<b>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°C</b></span><span>${t('最大风速','Max wind')}<b>${Math.round(d.wind_speed_10m_max[i])} km/h</b></span>${i>6?`<span style="color:var(--purple)">${t('远期趋势','Long-range trend')}</span>`:''}`;
 document.querySelectorAll('.day').forEach((el,j)=>{el.classList.toggle('selected',j===i);el.setAttribute('aria-pressed',String(j===i));el.setAttribute('aria-expanded',String(hourlyOpen&&j===i))});
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
 staticText();status();applyView();renderParking();renderHistory();renderHourly();['cm','inch'].forEach(u=>{$(u).classList.toggle('active',u===unit);$(u).setAttribute('aria-pressed',String(u===unit))});
 if(!data){
 ['sum1','sum2','sum3'].forEach(id=>$(id).textContent='—');['range1','range2','range3'].forEach(id=>$(id).textContent=t('等待预报','Awaiting forecast'));
 $('chart').replaceChildren();$('rows').replaceChildren();$('total').textContent=t('正在加载','Loading');$('detail').textContent=failed?t('数据暂不可用；请刷新重试。','Data unavailable. Please refresh to retry.'):t('正在读取预报…','Loading forecast…');
 $('outlook-title').textContent=failed?t('等待天气数据','Awaiting weather data'):t('正在分析降雪窗口','Finding snow windows');$('outlook').textContent='';return;
 }
 const d=data.daily,falls=d.snowfall_sum,total=falls.reduce((a,b)=>a+b,0),max=Math.max(...falls,1),localToday=today();
 for(let j=0;j<3;j++){const start=j*5,end=start+5;$('sum'+(j+1)).innerHTML=num(falls.slice(start,end).reduce((a,b)=>a+b,0))+`<span>${unit==='inch'?'in':'cm'}</span>`;$('range'+(j+1)).textContent=date(d.time[start])+' – '+date(d.time[end-1])+(j===2?t(' · 远期趋势',' · Trend'):'');}
 $('total').textContent=t('15 天累计 ','15-day total ')+snow(total);
 const scroll=document.querySelector('.scroll'),previousScroll=scroll.scrollLeft;
 $('chart').innerHTML=d.time.map((day,i)=>`<button aria-controls="hourly-panel" class="day ${i>6?'far':''}" data-index="${i}" aria-label="${day}, ${t('新增降雪','snowfall')} ${snow(falls[i])}"><div class="bar-space"><span class="bar-value">${num(falls[i])}</span><div class="bar" style="height:${Math.max(3,falls[i]/max*147)}px"></div></div><span class="weekday">${day===localToday?t('今天','Today'):weekday(day)}</span><span class="date">${date(day)}</span></button>`).join('');
 $('chart').querySelectorAll('button').forEach(b=>b.onclick=()=>{selectDay(Number(b.dataset.index),true)});scroll.scrollLeft=previousScroll;
 $('rows').innerHTML=d.time.map((day,i)=>`<tr><td><button class="date-link" data-day="${i}" aria-controls="hourly-panel">${date(day)} ${weekday(day)}${i>6?t(' · 趋势',' · Trend'):''} ↗</button></td><td style="color:${i>6?'var(--purple)':'var(--blue)'}">${snow(falls[i])}</td><td>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°C</td><td>${Math.round(d.wind_speed_10m_max[i])} km/h</td></tr>`).join('');
 $('rows').querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selectDay(Number(b.dataset.day));$('hourly-panel')?.scrollIntoView({behavior:'smooth',block:'start'})});
 const peak=falls.indexOf(Math.max(...falls));
 $('outlook-title').textContent=total>0?t(`${date(d.time[peak])} 降雪信号最强`,`Strongest snow signal: ${date(d.time[peak])}`):t('未来 15 天暂无明显降雪信号','No notable snow signal in the next 15 days');
 $('outlook').textContent=total>0?t(`当前模型预计 ${resorts[key].name} 15 天累计新增降雪 ${snow(total)}，其中 ${date(d.time[peak])} 约 ${snow(falls[peak])}。`,`The current model forecasts ${snow(total)} of snow at ${resorts[key].name} over 15 days, with about ${snow(falls[peak])} on ${date(d.time[peak])}. `)+(peak>6?t('主要信号在一周之后，建议临近 3–5 天再确认雪量。','The main signal is over a week away. Recheck amounts 3–5 days before your trip.'):t('出发前继续关注预报更新、雪场开放与道路情况。','Check forecast updates, resort operations and road conditions before traveling.')):t('当前模型预计新增降雪为零。后续天气过程仍可能变化。','The current model predicts no new snow. Weather patterns may still change.');detail();
}
async function load(){
 const id=++request;data=null;selected=0;hourlyOpen=false;loading=true;failed=false;timedOut=false;render();document.querySelector('.chart-panel').classList.add('loading');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
 const response=await fetch('/api/forecast?resort='+encodeURIComponent(key),{signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);
 const result=await response.json();if(result.timezone!==resorts[key].timezone||!Number.isFinite(Date.parse(result.updatedAt))||result.daily?.time?.length!==15||['snowfall_sum','temperature_2m_max','temperature_2m_min','wind_speed_10m_max'].some(k=>result.daily[k]?.length!==15||!result.daily[k].every(Number.isFinite)))throw new Error('Incomplete forecast');
 if(id!==request)return;data=result;
 }catch(error){if(id!==request)return;failed=true;timedOut=error.name==='AbortError';}
 finally{clearTimeout(timer);if(id===request){loading=false;document.querySelector('.chart-panel').classList.remove('loading');render();}}
}
$('resort').onchange=e=>{key=e.target.value;if(key!=='brighton')parkingActive=false;parkingDay=null;save('snow-resort',key);document.querySelector('.scroll').scrollLeft=0;load()};
$('language').onchange=e=>{lang=e.target.value==='en'?'en':'zh';save('snow-language',lang);render()};
$('refresh').onclick=load;
['cm','inch'].forEach(u=>$(u).onclick=()=>{unit=u;save('snow-unit',u);render()});
function applyView(){
 const parkingTab=$('parking-tab');if(!parkingTab)return;
 parkingTab.textContent=t('停车预约','Parking');parkingTab.classList.toggle('hidden',key!=='brighton');
 $('weather-content')?.classList.toggle('hidden',parkingActive);
 $('refresh').classList.toggle('hidden',parkingActive);
 $('table-view').classList.toggle('hidden',!table);$('chart-view').classList.toggle('hidden',table);
 for(const name of ['chart','table','parking']){
  const active=name==='parking'?parkingActive:!parkingActive&&((name==='table')===table);
  $(name+'-tab').classList.toggle('active',active);$(name+'-tab').setAttribute('aria-pressed',String(active));
 }
}
function tab(showTable){parkingActive=false;table=showTable;render()}
$('table-tab').onclick=()=>tab(true);$('chart-tab').onclick=()=>tab(false);
$('parking-tab')?.addEventListener('click',()=>{parkingActive=true;render()});
load();

function selectDay(index,reveal=false){selected=index;parkingDay=data.daily.time[index];renderParking();hourlyOpen=true;detail();if(reveal)$('hourly-panel')?.scrollIntoView({behavior:'smooth',block:'start'})}
$('hourly-close')?.addEventListener('click',()=>{hourlyOpen=false;detail()});
$('hourly-prev')?.addEventListener('click',()=>{if(selected>0)selectDay(selected-1)});
$('hourly-next')?.addEventListener('click',()=>{if(selected<14)selectDay(selected+1)});
function renderHourly(){
 const panel=$('hourly-panel');if(!panel)return;
 panel.classList.toggle('hidden',!hourlyOpen||!data);if(!hourlyOpen||!data)return;
 const day=data.daily.time[selected],hours=dayHours(data.hourly,day,resorts[key].timezone),trend=selected>6;
 const n=v=>Number.isFinite(v)?Math.round(v):'—';
 const s=v=>Number.isFinite(v)?snow(v):'—';
 $('hourly-eyebrow').textContent=t('逐小时 / 当日详情','HOURLY / DAY DETAILS');
 $('hourly-title').textContent=date(day)+' '+weekday(day);
 $('hourly-subtitle').textContent=resorts[key].name+' · '+resorts[key].timezone.replace('America/','').replaceAll('_',' ')+t(' 当地时间',' local time');
 $('hourly-prev').disabled=selected===0;$('hourly-next').disabled=selected===14;
 $('hourly-prev').setAttribute('aria-label',t('前一天','Previous day'));$('hourly-next').setAttribute('aria-label',t('后一天','Next day'));$('hourly-close').setAttribute('aria-label',t('收起小时详情','Close hourly details'));
 $('hourly-note').textContent=trend?t('远期小时分布仅供趋势参考，临近出行时请重新确认。','Long-range hourly timing is uncertain. Recheck closer to your trip.'):t('点选上方其他日期，或使用箭头切换日期。','Choose another date above or use the arrows to change days.');
 const periods=[[0,6,t('凌晨','Overnight')],[6,12,t('早晨','Morning')],[12,18,t('下午','Afternoon')],[18,24,t('晚上','Evening')]];
 $('periods').innerHTML=periods.map(([start,end,label])=>{const group=hours.filter(h=>h.hour>=start&&h.hour<end),a=summarize(group);return `<div class="period"><div class="period-label">${label}</div><div class="period-time">${String(start).padStart(2,'0')}:00–${String(end).padStart(2,'0')}:00</div><div class="period-snow">${s(a.snowfall)}</div><div class="period-metrics">${n(a.low)}° / ${n(a.high)}°C<br>${t('最大风速','Max wind')} ${n(a.wind)} km/h</div></div>`}).join('');
 const max=Math.max(...hours.map(h=>h.snowfall??0),1);
 $('hourly-chart').style.gridTemplateColumns=`repeat(${Math.max(hours.length,1)},minmax(0,1fr))`;
 $('hourly-chart').innerHTML=hours.map(h=>`<div class="hour-column" role="img" aria-label="${h.startTime}–${h.endTime} ${h.zone}, ${t('降雪','snowfall')} ${s(h.snowfall)}, ${n(h.temperature_2m)}°C, ${t('风速','wind')} ${n(h.wind_speed_10m)} km/h"><div class="hour-bar-space"><span class="hour-value">${Number.isFinite(h.snowfall)?num(h.snowfall):'—'}</span><div class="hour-bar" style="height:${Math.max(3,(h.snowfall??0)/max*80)}px;opacity:${h.snowfall===null?0:1}"></div></div><div class="hour-time">${h.startTime}</div></div>`).join('');
 $('hourly-caption').textContent=hours.length?t('左右滑动查看全部小时。降雪为所示时段累计；气温、风速为时段结束值。小时合计可能与日预报略有差异；— 表示无数据。','Swipe for all hours. Snowfall covers each interval; temperature and wind are at its end. Hourly sums may differ from daily forecasts; — means unavailable.'):t('此日期的小时缓存暂不可用，下次定时更新后可查看。','Hourly data is not cached for this date yet. Check after the next scheduled update.');
 $('hourly-table-label').textContent=t('查看逐小时天气表','View hourly weather table');
 $('hourly-head').innerHTML='<tr>'+[t('当地时段','Local interval'),t('降雪','Snowfall'),t('气温','Temp.'),t('风速','Wind'),t('阵风','Gusts'),t('降水概率','Precip. chance')].map(x=>`<th>${x}</th>`).join('')+'</tr>';
 $('hourly-rows').innerHTML=hours.map(h=>`<tr><td>${h.startTime}–${h.endTime} ${h.zone}</td><td>${s(h.snowfall)}</td><td>${n(h.temperature_2m)}°C</td><td>${n(h.wind_speed_10m)} km/h</td><td>${n(h.wind_gusts_10m)} km/h</td><td>${n(h.precipitation_probability)}${h.precipitation_probability===null?'':'%'}</td></tr>`).join('');
}

$('parking-date')?.addEventListener('change',e=>{parkingDay=e.target.value;renderParking()});
$('parking-time')?.addEventListener('change',e=>{parkingTime=e.target.value;renderParking()});
function renderParking(){
 const panel=$('parking-panel');if(!panel)return;panel.classList.toggle('hidden',key!=='brighton'||!parkingActive);if(key!=='brighton')return;
 const day=parkingDay??data?.daily?.time[selected]??today(),state=parkingStatus(day,parkingTime);
 $('parking-date').value=day;$('parking-time').value=parkingTime;
 $('parking-eyebrow').textContent=t('出行计划 / PARKING','PLAN YOUR ARRIVAL');$('parking-title').textContent=t('Brighton 停车','Brighton parking');
 $('parking-date-label').textContent=t('到达日期（雪场当地时间）','Arrival date (resort local time)');$('parking-time-label').textContent=t('到达时间 · 山地时间','Arrival time · Mountain Time');
 const labels={required:t('需要预约 · 普通停车','Reservation required · General parking'),not_required:t('无需预约 · 普通停车','No reservation required · General parking'),closed:t('停车场关闭 · 00:00–07:00','Parking lots closed · 00:00–07:00'),unconfirmed:t('预约要求待官方确认','Reservation requirement unconfirmed'),outside_window:t('此日期尚无已核实的冬季规则','No verified winter rule for this date')};
 $('parking-status').textContent=labels[state];$('parking-status').dataset.status=state;
 const explanations={required:t('所选日期 07:00–12:00 需要预约。免费季票预约也必须预订。','A reservation is required from 07:00 to 12:00 on this date, including complimentary passholder reservations.'),not_required:parkingTime>='12:00'?t('普通停车中午 12:00 后不要求预约；是否有现场空位仍需确认。','General parking does not require reservations after noon. On-site space is still subject to availability.'):t('按已公布日期表，此时段普通停车无需预约，先到先得。Preferred Parking 规则不同。','The published calendar does not require a general-parking reservation for this interval. First come, first served; Preferred Parking has separate rules.'),closed:t('冬季停车场每日凌晨关闭清雪，请选择 07:00 或之后到达。','Winter lots close overnight for snow clearing. Choose an arrival time of 07:00 or later.'),unconfirmed:t('日期输入无效，或官方页面存在冲突。请打开官方预约页面核实，勿按“无需预约”安排出行。','The date/time is invalid or official pages conflict. Check the official reservation site before planning your arrival.'),outside_window:t('当前仅核实 2026/12/4–2027/4/18 的公布预约日期范围；这不代表所选日期开放或无需预约。','The verified published reservation-calendar window is Dec 4, 2026–Apr 18, 2027. This does not establish opening status or reservation requirements outside that window.')};
 $('parking-explanation').textContent=explanations[state];
 $('parking-book').textContent=t('查看余位并前往官方预约 ↗','Check availability & book officially ↗');$('parking-book').href=brightonParking.booking;
 $('parking-availability-title').textContent=t('可订名额 / 现场空位：尚未接入','Bookable spaces / live occupancy: not connected');
 $('parking-availability-note').textContent=t('这里仅显示预约规则，不提供实时余位。普通、拼车和季票名额可能不同，请在官方平台确认。','This panel shows rules, not live inventory. General, carpool and passholder allocations may differ; verify availability on the official platform.');
 $('parking-more-title').textContent=t('查看规则、放号时间与来源','Rules, release times & sources');
 $('parking-rule-note').textContent=t('2026–27：12/4 起，周五至周日及指定假日 07:00–12:00 需预约；12/25 例外。按运营方日期表判断；1/19、2/16 因官网日期冲突保留为待确认。Preferred Parking 请另查官方规则。','2026–27: reservations apply 07:00–12:00 on Fridays–Sundays and listed holidays from Dec 4, except Dec 25. Uses the operator calendar; Jan 19 and Feb 16 remain unconfirmed because official pages conflict. Check Preferred Parking separately.');
 $('parking-release-note').textContent=t('公布放号时间：周一 18:00；到达前一天 08:00、14:00。取消名额可能重新放出；以官方当日安排为准。','Published releases: Monday at 18:00, then 08:00 and 14:00 the day before arrival. Cancellations may reopen inventory; confirm current details officially.');
 $('parking-pass-note').textContent=t('免费停车不等于无需预约；无需预约也不保证有空位。','Complimentary parking can still require a reservation. No reservation requirement does not guarantee an open space.');
 $('parking-source').textContent=t('停车运营方规则 ↗','Operator rules ↗');$('parking-source').href=brightonParking.source;
 $('parking-resort-source').textContent=t('雪场停车信息 ↗','Resort parking information ↗');$('parking-resort-source').href=brightonParking.resortSource;
 $('parking-verified').textContent=t('规则核实于 ','Rules checked ')+brightonParking.checked+' · '+brightonParking.season+t(' 雪季 · 非实时库存',' season · Not live inventory');
}
