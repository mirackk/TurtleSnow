export const hourlyFields = ['snowfall','temperature_2m','wind_speed_10m','wind_gusts_10m','precipitation_probability'];
const dateFormatters=new Map();
export function localDate(seconds, timezone) {
  if(!dateFormatters.has(timezone))dateFormatters.set(timezone,new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}));
  return dateFormatters.get(timezone).format(new Date(seconds*1000));
}
export function dayHours(hourly, day, timezone) {
  if(!hourly?.time)return [];
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const zone=new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeZoneName:'short'});
  return hourly.time.flatMap((end,i)=>{
    const start=end-3600;
    if(localDate(start,timezone)!==day)return [];
    const startTime=clock.format(new Date(start*1000)),endTime=localDate(end,timezone)===day?clock.format(new Date(end*1000)):'24:00';
    return [{start,end,startTime,endTime,zone:zone.formatToParts(new Date(end*1000)).find(p=>p.type==='timeZoneName').value,hour:Number(startTime.slice(0,2)),...Object.fromEntries(hourlyFields.map(k=>[k,hourly[k]?.[i]??null]))}];
  });
}
export function summarize(hours) {
  const all=k=>hours.length>0&&hours.every(h=>Number.isFinite(h[k]));
  return {snowfall:all('snowfall')?hours.reduce((s,h)=>s+h.snowfall,0):null,low:all('temperature_2m')?Math.min(...hours.map(h=>h.temperature_2m)):null,high:all('temperature_2m')?Math.max(...hours.map(h=>h.temperature_2m)):null,wind:all('wind_speed_10m')?Math.max(...hours.map(h=>h.wind_speed_10m)):null};
}
