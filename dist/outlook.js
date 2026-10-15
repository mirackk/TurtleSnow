import { dayHours } from './hourly.js';
export function skiOutlook(data,{lang='en',snow,date,timezone}){
 const t=(zh,en)=>lang==='zh'?zh:en,d=data.daily;
 const sum=a=>a.reduce((s,n)=>s+n,0),next=d.snowfall_sum.slice(0,3),total=sum(next),peak=next.indexOf(Math.max(...next));
 const past=data.history?.daily?.snowfall_sum?.slice(-3),pastDates=data.history?.daily?.time?.slice(-3);
 const recent=past?.length===3&&past.every(Number.isFinite)?sum(past):null;
 const cold=d.temperature_2m_max.slice(0,3).every(n=>n<=0);
 const thaw=d.temperature_2m_max.slice(0,3).some(n=>n>0);
 const freeze=d.temperature_2m_max.slice(0,2).some((n,i)=>n>0&&d.temperature_2m_min[i+1]<0);
 const wind=Math.max(...d.wind_speed_10m_max.slice(0,3));
 const gusts=d.time.slice(0,3).flatMap(day=>dayHours(data.hourly,day,timezone)).map(h=>h.wind_gusts_10m).filter(Number.isFinite);
 const gust=gusts.length?Math.max(...gusts):null,strong=wind>=30||(gust!==null&&gust>=50);
 const title=total>=10?t('有补雪机会，留意风雪影响','Fresh-snow opportunity; watch the weather'):total>0?t('少量补雪，关注雪面变化','Light refresh; watch surface changes'):t('近期补雪有限，关注现有雪面','Limited refresh; existing surfaces matter');
 const paragraphs=[];
 paragraphs.push(recent===null?t('近期降雪估算暂不可用。','Recent snowfall estimates are unavailable.'):t(`过去三个完整当地日（${date(pastDates[0])}–${date(pastDates[2])}）模型估算降雪 ${snow(recent)}，并非雪场实测。`,`The last three complete local days (${date(pastDates[0])}–${date(pastDates[2])}) had ${snow(recent)} of modeled snowfall, not resort measurements.`));
 paragraphs.push(t(`未来三天（${date(d.time[0])}–${date(d.time[2])}）预计新增 ${snow(total)}。`,`The next three days (${date(d.time[0])}–${date(d.time[2])}) forecast ${snow(total)} of new snow. `)+(total>0?t(`${date(d.time[peak])} 补雪信号最强，预计 ${snow(next[peak])}；新雪可能改善表层，但不保证粉雪或足够覆盖。`,`The strongest refresh signal is ${date(d.time[peak])}, with ${snow(next[peak])}; new snow may freshen surfaces but does not guarantee powder or adequate coverage.`):t('没有明显补雪，体验更取决于已有积雪与压雪维护。','With little refresh, the experience depends more on existing cover and grooming.')));
 paragraphs.push(cold?t('未来三天日最高温均不高于 0°C，有利于限制融化，但不能据此判断雪面松软。','Daily highs stay at or below freezing for these three days, limiting melt; this does not establish soft snow conditions.'):freeze?t('存在白天升温、随后夜间重新冻结的信号；部分雪面可能变硬或结壳，受日照和压雪影响。','Daytime thaw followed by overnight freezing is possible; some surfaces may become firm or crusted, depending on sun exposure and grooming.'):thaw?t('部分时段高于 0°C，向阳或较低区域可能变湿、变软。','Some periods rise above freezing; sunny or lower areas may become wetter and softer.'):t('请关注临近出行时的气温变化。','Recheck temperatures closer to your visit.'));
 paragraphs.push(t(`未来三天最大预报风速 ${Math.round(wind)} km/h`,`Maximum forecast wind over these three days: ${Math.round(wind)} km/h`)+(gust===null?'':t(`，阵风最高 ${Math.round(gust)} km/h`,`, gusts up to ${Math.round(gust)} km/h`))+(strong?t('。风可能影响暴露区域的舒适度和雪面；缆车是否开放请查雪场公告。','. Wind may affect exposed terrain and snow surfaces; check resort notices for lift operations.'):t('。这是预报点风速，山脊实际风况可能不同。','. These are forecast-point winds; ridge conditions may differ.')));
 const future=d.snowfall_sum.slice(3),far=Math.max(...future);if(far>=5){const i=future.indexOf(far)+3;paragraphs.push(t(`${date(d.time[i])} 另有降雪信号（${snow(far)}），${i>6?'超过一周，仅供趋势参考':'仍需临近确认'}。`,`Another snow signal appears on ${date(d.time[i])} (${snow(far)}); ${i>6?'over a week away, so treat it as a trend':'recheck closer to the date'}.`));}
 return {title,paragraphs,note:t('体验推测 · 规则生成，非 AI 模型输出。Base／雪深、实测雪况与开放信息未接入；不能判断覆盖、实际可滑性或雪崩安全。','Experience estimate · Rule-based, not an AI model. Base depth, observed surfaces and operations are unavailable; coverage, skiability and avalanche safety cannot be assessed.')};
}
