# turtleSnow · 滑雪天气预报

Website: https://turtlesnow.snowcast.workers.dev

Source: https://github.com/mirackk/TurtleSnow

Public, login-free 15-day snow forecasts for nine US resorts, with Chinese and English UI. Existing dark responsive UI preserved from Sites commit `21871e1efdfc8c2d50ee6d1f5e14c80ac8f24583`.

## Data flow

Cloudflare Cron (`0 * * * *`, UTC hourly) → nine Open-Meteo requests (at most three concurrent) → shared KV → `/api/forecast?resort=brighton|alta` → browser.

Visitors and the refresh button only read KV. No upstream calls occur in HTTP request handlers. Each resort retains its last valid snapshot indefinitely if refresh fails. `updatedAt` is the last successful fetch time, `lastAttemptAt` the latest attempt. The UI formats timestamps in the selected resort’s local timezone including daylight saving time and warns when a refresh failed or data is older than 90 minutes. KV is eventually consistent; updates may take roughly a minute to appear globally.

Forecast points are defined once in `dist/resorts.js`, shared by browser and Worker. Brighton 2879m and Alta 2900m are preserved. Other resorts use explicit representative on-mountain points; these are not official snow stakes or summit measurements. California resorts use America/Los_Angeles, Killington uses America/New_York, and the remaining resorts use America/Denver. Snow is stored in cm, temperature in Celsius, wind in km/h. Unit and Chinese/English language switching are browser-local and remembered without login. Initial cache is populated separately; an empty cache returns 503 rather than fetching upstream.

## Development and deployment

Use Node.js 22+ (24 recommended).

```sh
npm ci
npm test
npx wrangler login
npm run dev
npm run deploy
```

`wrangler.jsonc` identifies the existing Cloudflare account and KV namespace; these IDs are not secrets. Login uses Cloudflare browser OAuth. Never commit credentials. Routine refreshes need no local computer. For a new account, create a KV namespace, update the IDs, then run `node scripts/seed-cache.mjs` once and deploy. The seed script fetches real data and writes it using your authenticated Wrangler session; it is not a public refresh endpoint.

GitHub stores source; deployment currently uses authenticated Wrangler locally. GitHub push alone does not deploy. No Actions secrets or automatic build integration have been configured.

## Usage and attribution

Data: [Open-Meteo](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Free hosted API use is non-commercial only and subject to its rate limits and terms. Nine hourly requests mean 216 normal requests/day; model/variable weighting can affect provider call accounting. Caching does not change licensing requirements.

Cloudflare Free quotas currently include 100,000 KV key reads/day and 1,000 key writes/day. Normal updates write 432 keys/day (forecast + status for each of nine resorts hourly). Each forecast API request reads two keys. Static assets are served through Workers Assets. No paid upgrade was requested. Traffic and any other account workloads share applicable quotas.

## Verification

`npm test` covers visitor cache-only behavior, both fixed elevations, independent resort updates, failed/malformed upstream data preserving prior snapshots, real success timestamps, and empty/invalid requests. Production anonymous access and browser checks are recorded in `DEPLOYMENT.md`.

## Resort catalog and localization

A–Z: Alta, Breckenridge, Brighton, Copper Mountain, Killington, Mammoth Mountain, Palisades Tahoe, Park City Mountain, Vail. Winter Park is excluded. New visitors default to Brighton; returning visitors retain their selection. `dist/app.js` handles rendering, dynamic bilingual messages, dates and language persistence; static translations live in `dist/translations.js`.

## Forecast point references

The numeric elevations in the app are selected model forecast heights, not official mountain statistics. Resort geography and context were checked against official resort information: [Breckenridge](https://www.breckenridge.com/the-mountain/about-the-mountain/mountain-info.aspx), [Copper](https://www.coppercolorado.com/the-mountain/mountain-safety-stats/winter-mountain-stats/), [Mammoth](https://www.mammothmountain.com/on-the-mountain/mountain-report), [Palisades](https://www.palisadestahoe.com/footer/mountain-statistics), [Park City](https://www.parkcitymountain.com/the-mountain/mountain-conditions/weather-report.aspx), [Vail](https://www.vail.com/the-mountain/about-the-mountain/mountain-info.aspx), and [Killington](https://www.killington.com/the-mountain/conditions-weather/current-conditions-weather).

## Past seven days

The hourly forecast request includes `past_days=7`. Open-Meteo supplies recently archived forecasts, not resort observations. The Worker validates all 22 contiguous local calendar dates, splits the seven completed days before today into `history.daily`, and preserves the existing fifteen-day `daily` forecast contract. The history panel recomputes its seven-day snowfall sum and supports both languages and snow units. Missing history displays unavailable rather than zero. History and forecasts are persisted together only after full validation, and retained together on an upstream failure. Normal upstream request and KV write counts remain unchanged.

## Domain migration

The account subdomain was changed to `snowcast` in Cloudflare Dashboard. Primary URL is https://turtlesnow.snowcast.workers.dev. The retired `*.wasatch-snow.workers.dev` namespace no longer routes; Cloudflare cannot retain those old URLs as redirects. The legacy Worker at `wasatch-snow.snowcast.workers.dev` redirects to the primary origin.

## Hourly day details

Click a forecast bar or a date in the daily weather table to reveal hourly details. Four local periods cover the full day: Overnight 00–06, Morning 06–12, Afternoon 12–18, Evening 18–24. Each shows snowfall, temperature range and maximum wind. The horizontally scrollable hourly snowfall chart is followed by an expandable table with temperature, wind, gusts and precipitation probability. Previous/next arrows and close controls support keyboard and touch use. English/Chinese and cm/inch preferences apply throughout; long-range timing is marked uncertain.

Open-Meteo hourly snowfall represents the preceding hour. Stored hourly timestamps are Unix seconds; the UI assigns each sample to the interval `[timestamp − 1 hour, timestamp]` and groups it by the start date in the resort timezone. Temperature and wind represent the interval end. DST days may contain 23 or 25 intervals. Missing values display as unavailable, not zero, and incomplete period snowfall does not produce a numeric total.

The server requests 16 forecast days plus 7 past days in the same hourly refresh. Only 15 daily forecast days and their complete hourly intervals are exposed; the extra day supplies the final midnight endpoint. Daily dates are normalized back to ISO calendar strings; hourly timestamps remain Unix seconds. The whole snapshot is retained if hourly arrays or coverage are malformed. Individual null hourly values remain explicitly unavailable. This keeps nine scheduled upstream requests per hour, though provider usage weighting can increase with the extra variables/time range.

## Brighton parking guidance

Brighton has a client-side general-parking rule checker with date and arrival time in America/Denver. It links to the official Inflow booking page; no parking inventory API, credentials, paid service or live occupancy feed is connected. Other resorts do not display Brighton's rules.

Sources checked 2026-10-15: https://www.parkbrightonresort.com/reservenski and https://www.brightonresort.com/getting-here-and-parking. The verified operator calendar covers Dec 4, 2026–Apr 18, 2027; dates outside it are unconfirmed, not assumed reservation-free. General parking requires reservations 07:00–12:00 Fri–Sun and published holidays, except Dec 25. Jan 19 and Feb 16 are unconfirmed because the resort FAQ and operator calendar disagree. Preferred Parking has separate rules and is excluded from the general-parking result. Summer/opening/closing dates are not inferred.

The UI labels live availability as not connected and separates rule status from inventory. Free passholder parking still requires reservations when applicable; reservation-free parking is not a guarantee of an open space. API access and pricing have not been confirmed with Inflow; no operator has been contacted.

### Parking tab and availability research

Brighton parking now has its own Parking tab. Snow overview and Daily weather contain only weather content; Parking hides the weather sections and weather refresh button. Switching away from Brighton returns to weather and hides the Brighton-specific Parking tab.

Further inspection on 2026-10-15 confirmed that the publicly served Inflow reservation client defines read/query routes `/calendar-availability` and `/calendar-rates` (POST). However, following the official Brighton welcome page's Get started button redirected to an authentication page explicitly requiring an Inflow account before continuing to the booking calendars. A documented public/anonymous third-party data interface has not been verified, nor have partner API pricing, redistribution permission or passholder-pool access. The presence of client routes is not proof of free public API access. No credentials were collected, authentication bypassed, reservations created or third-party accounts registered.

Evidence: official entry https://reserve.inflowparking.com/qr/ParkBrightonResort/welcome ; the public bundle inspected was https://reserve.inflowparking.com/assets/index-CU863i2U.js . No live availability integration has been claimed or deployed.
