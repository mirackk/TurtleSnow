export const brightonParking = {
 season:'2026–27', checked:'2026-10-15', start:'2026-12-04', end:'2027-04-18',
 source:'https://www.parkbrightonresort.com/reservenski',
 resortSource:'https://www.brightonresort.com/getting-here-and-parking',
 booking:'https://reserve.inflowparking.com/qr/ParkBrightonResort/welcome'
};
// Published operator calendar and general rule; no availability API is connected.
// Resort FAQ conflicts with operator calendar on Jan 19 and Feb 16: do not infer no reservation.
export function parkingStatus(day,time='09:00') {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return 'unconfirmed';
 const parsed=new Date(day+'T12:00:00Z');
 if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==day)return 'unconfirmed';
 if(day<brightonParking.start||day>brightonParking.end)return 'outside_window';
 if(time<'07:00')return 'closed';
 if(time>='12:00')return 'not_required';
 if(['2027-01-19','2027-02-16'].includes(day))return 'unconfirmed';
 if(day==='2026-12-25')return 'not_required';
 const weekday=parsed.getUTCDay();
 const holiday=(day>='2026-12-18'&&day<='2027-01-03')||['2027-01-18','2027-02-15'].includes(day);
 return holiday||[0,5,6].includes(weekday)?'required':'not_required';
}
