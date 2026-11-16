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

// Convert a local wall-clock time to Unix seconds, allowing real 23/25-hour days.
export function zonedHour(date,timezone,hour=0){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Missing calendar boundary');
 const target=Date.parse(date+'T'+String(hour).padStart(2,'0')+':00:00Z');let value=target;
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(value)).map(p=>[p.type,p.value]));const wall=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);value+=target-wall;}
 return value/1000;
}
export function skiDaySnow(hourly,day,timezone){
 const previous=new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const start=zonedHour(previous,timezone,18), dawn=zonedHour(day,timezone,6), end=zonedHour(day,timezone,18);
 const sum=(a,b)=>{
  const first=hourly?.time?.indexOf(a+3600)??-1;
  if(first<0)return null;
  let total=0;
  for(let t=a+3600,i=first;t<=b;t+=3600,i++){
   const amount=hourly.snowfall?.[i];
   if(hourly.time[i]!==t||!Number.isFinite(amount)||amount<0)return null;
   total+=amount;
  }
  return total;
 };
 const overnight=sum(start,dawn), daytime=sum(dawn,end);
 return {overnight,daytime,total:overnight===null||daytime===null?null:overnight+daytime};
}
