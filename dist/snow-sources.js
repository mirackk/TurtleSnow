export function officialWeek(report) {
 if(!report || !Number.isFinite(report.snow7DaysCm) || report.snow7DaysCm<0 ||
   report.qualityIssues?.some(s=>s.startsWith('snow7DaysCm_')))return null;
 return {total:report.snow7DaysCm,reportedAt:report.reportedAt,stale:!!report.stale};
}
