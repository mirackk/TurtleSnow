// Explicit forecast points, not official snow stakes or summit measurements.
// Existing Brighton/Alta elevations are preserved. Other points use representative
// on-mountain elevations; compare forecasts at the displayed elevation.
export const resorts = {
  alta: { name:'Alta', latitude:40.588, longitude:-111.638, elevation:2900, timezone:'America/Denver', state:'Utah', region:'LITTLE COTTONWOOD CANYON', url:'https://www.alta.com/conditions' },
  arapahoebasin: { name:'Arapahoe Basin', latitude:39.637, longitude:-105.871, elevation:3500, timezone:'America/Denver', state:'Colorado', region:'SUMMIT COUNTY · COLORADO', url:'https://www.arapahoebasin.com/snow-report/' },
  aspensnowmass: { name:'Aspen Snowmass', latitude:39.197, longitude:-106.965, elevation:3100, timezone:'America/Denver', state:'Colorado', region:'SNOWMASS MOUNTAIN · COLORADO', forecastArea:'Snowmass', url:'https://www.aspensnowmass.com/four-mountains/snowmass/snow-and-grooming-report' },
  bigsky: { name:'Big Sky', latitude:45.278, longitude:-111.429, elevation:2700, timezone:'America/Denver', state:'Montana', region:'LONE MOUNTAIN · MONTANA', url:'https://www.bigskyresort.com/current-conditions' },
  breckenridge: { name:'Breckenridge', latitude:39.480, longitude:-106.080, elevation:3200, timezone:'America/Denver', state:'Colorado', region:'SUMMIT COUNTY · COLORADO', url:'https://www.breckenridge.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx' },
  brighton: { name:'Brighton', latitude:40.598, longitude:-111.583, elevation:2879, timezone:'America/Denver', state:'Utah', region:'BIG COTTONWOOD CANYON', url:'https://www.brightonresort.com/conditions' },
  copper: { name:'Copper Mountain', latitude:39.481, longitude:-106.151, elevation:3200, timezone:'America/Denver', state:'Colorado', region:'SUMMIT COUNTY · COLORADO', url:'https://www.coppercolorado.com/the-mountain/conditions-weather/' },
  jacksonhole: { name:'Jackson Hole', latitude:43.591, longitude:-110.849, elevation:2700, timezone:'America/Denver', state:'Wyoming', region:'TETON RANGE · WYOMING', url:'https://www.jacksonhole.com/mountain-report' },
  killington: { name:'Killington', latitude:43.615, longitude:-72.811, elevation:1000, timezone:'America/New_York', state:'Vermont', region:'GREEN MOUNTAINS · VERMONT', url:'https://www.killington.com/the-mountain/conditions-weather/current-conditions-weather' },
  mammoth: { name:'Mammoth Mountain', latitude:37.642, longitude:-119.032, elevation:3000, timezone:'America/Los_Angeles', state:'California', region:'EASTERN SIERRA · CALIFORNIA', url:'https://www.mammothmountain.com/on-the-mountain/mountain-report' },
  mountsnow: { name:'Mount Snow', latitude:42.963, longitude:-72.920, elevation:1000, timezone:'America/New_York', state:'Vermont', region:'GREEN MOUNTAINS · VERMONT', url:'https://www.mountsnow.com/the-mountain/mountain-conditions/weather-report.aspx' },
  okemo: { name:'Okemo', latitude:43.402, longitude:-72.737, elevation:900, timezone:'America/New_York', state:'Vermont', region:'GREEN MOUNTAINS · VERMONT', url:'https://www.okemo.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx' },
  palisades: { name:'Palisades Tahoe', latitude:39.190, longitude:-120.250, elevation:2500, timezone:'America/Los_Angeles', state:'California', region:'LAKE TAHOE · CALIFORNIA', url:'https://www.palisadestahoe.com/mountain-information/snow-and-weather' },
  parkcity: { name:'Park City Mountain', latitude:40.636, longitude:-111.520, elevation:2600, timezone:'America/Denver', state:'Utah', region:'WASATCH RANGE · UTAH', url:'https://www.parkcitymountain.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx' },
  snowbasin: { name:'Snowbasin', latitude:41.208, longitude:-111.868, elevation:2500, timezone:'America/Denver', state:'Utah', region:'WASATCH RANGE · UTAH', url:'https://www.snowbasin.com/the-mountain/mountain-report/' },
  vail: { name:'Vail', latitude:39.617, longitude:-106.374, elevation:3000, timezone:'America/Denver', state:'Colorado', region:'VAIL VALLEY · COLORADO', url:'https://www.vail.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx' }
};
