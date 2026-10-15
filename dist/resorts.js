// Explicit forecast points, not official snow stakes or summit measurements.
// Existing Brighton/Alta elevations are preserved. Other points use representative
// on-mountain elevations; compare forecasts at the displayed elevation.
export const resorts = {
  alta: { name:'Alta', latitude:40.588, longitude:-111.638, elevation:2900, timezone:'America/Denver', state:'Utah', region:'LITTLE COTTONWOOD CANYON', url:'https://www.alta.com/conditions' },
  breckenridge: { name:'Breckenridge', latitude:39.480, longitude:-106.080, elevation:3200, timezone:'America/Denver', state:'Colorado', region:'SUMMIT COUNTY · COLORADO', url:'https://www.breckenridge.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx' },
  brighton: { name:'Brighton', latitude:40.598, longitude:-111.583, elevation:2879, timezone:'America/Denver', state:'Utah', region:'BIG COTTONWOOD CANYON', url:'https://www.brightonresort.com/conditions' },
  copper: { name:'Copper Mountain', latitude:39.481, longitude:-106.151, elevation:3200, timezone:'America/Denver', state:'Colorado', region:'SUMMIT COUNTY · COLORADO', url:'https://www.coppercolorado.com/the-mountain/conditions-weather/' },
  killington: { name:'Killington', latitude:43.615, longitude:-72.811, elevation:1000, timezone:'America/New_York', state:'Vermont', region:'GREEN MOUNTAINS · VERMONT', url:'https://www.killington.com/the-mountain/conditions-weather/current-conditions-weather' },
  mammoth: { name:'Mammoth Mountain', latitude:37.642, longitude:-119.032, elevation:3000, timezone:'America/Los_Angeles', state:'California', region:'EASTERN SIERRA · CALIFORNIA', url:'https://www.mammothmountain.com/on-the-mountain/mountain-report' },
  palisades: { name:'Palisades Tahoe', latitude:39.190, longitude:-120.250, elevation:2500, timezone:'America/Los_Angeles', state:'California', region:'LAKE TAHOE · CALIFORNIA', url:'https://www.palisadestahoe.com/mountain-information/snow-and-weather' },
  parkcity: { name:'Park City Mountain', latitude:40.636, longitude:-111.520, elevation:2600, timezone:'America/Denver', state:'Utah', region:'WASATCH RANGE · UTAH', url:'https://www.parkcitymountain.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx' },
  vail: { name:'Vail', latitude:39.617, longitude:-106.374, elevation:3000, timezone:'America/Denver', state:'Colorado', region:'VAIL VALLEY · COLORADO', url:'https://www.vail.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx' }
};
