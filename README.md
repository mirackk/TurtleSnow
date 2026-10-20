# turtleSnow · 滑雪天气预报

Website: https://turtlesnow.snowcast.workers.dev

Source: https://github.com/mirackk/TurtleSnow

Public, login-free 15-day snow forecasts for sixteen US resorts, with Chinese and English UI. Existing dark responsive UI preserved from Sites commit `21871e1efdfc8c2d50ee6d1f5e14c80ac8f24583`.

## Data flow

Cloudflare Cron (`0 * * * *`, UTC hourly) → sixteen Open-Meteo requests (at most three concurrent) → shared D1 snapshots → `/api/forecast?resort=brighton|alta` → browser.

Visitors and the refresh button only read D1. No upstream calls occur in HTTP request handlers. Each resort retains its last valid snapshot indefinitely if refresh fails. `updatedAt` is the last successful fetch time, `lastAttemptAt` the latest attempt. The UI formats timestamps in the selected resort’s local timezone including daylight saving time and warns when a refresh failed or data is older than 90 minutes. Source timestamps are retained when snapshots are migrated or read.

Forecast points are defined once in `dist/resorts.js`, shared by browser and Worker. Brighton 2879m and Alta 2900m are preserved. Other resorts use explicit representative on-mountain points; these are not official snow stakes or summit measurements. California resorts use America/Los_Angeles, Killington, Mount Snow and Okemo use America/New_York, and the remaining resorts use America/Denver. Snow is stored in cm, temperature in Celsius, wind in km/h. Unit and Chinese/English language switching are browser-local and remembered without login. Initial cache is populated separately; an empty cache returns 503 rather than fetching upstream.

## Development and deployment

Use Node.js 22+ (24 recommended).

```sh
npm ci
npm test
npx wrangler login
npm run dev
npm run deploy
```

`wrangler.jsonc` identifies the existing Cloudflare account and D1 databases; these IDs are not secrets. Login uses Cloudflare browser OAuth. Never commit credentials. Routine refreshes need no local computer. For a new account, create the two D1 databases, update the IDs and apply their respective migrations, then run `node scripts/seed-cache.mjs` once and deploy. The seed script fetches real data and writes it using your authenticated Wrangler session; it is not a public refresh endpoint.

GitHub stores source; deployment currently uses authenticated Wrangler locally. GitHub push alone does not deploy. No Actions secrets or automatic build integration have been configured.

## Usage and attribution

Data: [Open-Meteo](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Free hosted API use is non-commercial only and subject to its rate limits and terms. Sixteen hourly requests mean 384 normal requests/day; model/variable weighting can affect provider call accounting. Caching does not change licensing requirements.

Weather and summary storage uses D1; KV is not bound in production. D1 Free includes 5 million rows read/day and 100,000 rows written/day (indexes can add to accounting). Each forecast API request reads five indexed snapshot keys. Static assets are served through Workers Assets. No paid upgrade was requested. Traffic and any other account workloads share applicable quotas.

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

### Feedback
The floating bilingual Feedback button submits anonymously to `POST /api/feedback`.
Cloudflare D1 database **turtlesnow-feedback**, table **feedback**, stores timestamp (UTC), category, message, optional email, selected resort and language. View submissions in Cloudflare → Storage & databases → D1 → turtlesnow-feedback → Studio:

```sql
SELECT id, created_at, category, message, email, resort, language
FROM feedback ORDER BY id DESC LIMIT 100;
```
There is no public endpoint for reading feedback. Same-origin JSON, bounded input, a honeypot and an atomic database limit of three submissions per IP hash per rolling hour reduce spam. IP hashes rotate daily (the limit resets at UTC midnight); raw IP addresses are not stored. This is basic abuse protection, not a CAPTCHA. Review and delete feedback when no longer needed. Schema is in `migrations/0001_feedback.sql`; apply with `wrangler d1 migrations apply turtlesnow-feedback --remote` before deploying.

### Ski experience outlook
`dist/outlook.js` generates a bilingual, rule-based experience and forecast summary without any AI service or extra upstream requests. It uses the last three complete local days of modeled snowfall, the next three forecast days, temperature crossing signals, forecast wind/gusts and later snow trends. It explicitly does not assess base depth, observed surfaces, operations, coverage or avalanche safety. Thresholds (10 cm refresh, 30 km/h wind / 50 km/h gust) are simple presentation heuristics, not validated ski-quality or safety ratings. Data timestamp and stale warnings remain visible. This fallback itself does not call an LLM or add model fees; the newer cached AI layer below runs separately.

### Cached LLM summary and official snow reports
The highlighted summary now appears before charts. Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) writes concise English/Chinese experience interpretations from bounded, qualitative facts; deterministic cards retain exact snow quantities and unit switching. It never receives feedback/emails or arbitrary user prompts. Valid JSON, bilingual fields, length bounds and unsupported-claim checks gate caching; generation failures retain previous output, and missing/expired/date-mismatched summaries fall back to rules. AI prose is still an estimate and can be wrong.

Weather and Brighton/Alta reports refresh hourly. Separate `30 */12 * * *` and `35 */12 * * *` Crons generates summaries in batches at 00:30/00:35 and 12:30/12:35 UTC (not on visitor requests). D1 `summary_runs` reserves attempts before inference: one per resort/12-hour slot, at most 32 scheduled calls per UTC day, no automatic retry within the slot. `max_tokens=1000` and bounded inputs keep this well below the published 10,000-neuron daily free allowance under expected use; other apps share the account allowance. No paid-plan upgrade, AI Gateway credits or paid-only model is enabled. Initial deployment QA uses a small additional one-time batch. Check Workers AI usage in Cloudflare; quota failures use the fallback. Reapply `0002_summary_runs.sql` through migrations when setting up a new database.

`src/reports.js` reads the same public Brighton ReportPal endpoint used by its official site and Alta's public `window.Alta` weather payload. Brighton uses explicitly labeled centimeters; Alta inches convert to centimeters only when official seasonal display flags publish that field. Hidden/off-season Alta values are deliberately omitted. Zero stays zero, missing stays null, source and retrieval timestamps are distinct. Reports retain old data on failure with a visible stale warning. Other resorts show missing official metrics and a source link rather than substituting modeled snow. These website feeds can change; they are not contracted stable APIs. Snow depth never establishes coverage or safe skiability.

The summary window is now seven completed local historical days plus seven forecast days (including today). AI inputs separate past modeled snowfall from the first three forecast days and the following four; later-week uncertainty is explicit. Structured past/next/experience fields are combined into the bilingual narrative. `windowDays: 7` prevents old three-day caches from being displayed as weekly summaries. The 12-hour schedule and 32 scheduled-call daily cap are unchanged.

### October 20 DST recovery
Open-Meteo daily Unix time labels use the response's fixed `utc_offset_seconds`; converting each label through IANA timezone rules shifted labels after November 1 and rejected forecasts starting October 19 UTC. Daily labels now use the API offset, while hourly boundaries use actual IANA-local midnights. Regression coverage spans spring/fall changes in Denver, New York and Los Angeles (359/361 hours across fifteen days). A successful forecast timestamp now supersedes older failed status records without a duplicate success-status write. Normal daily KV writes drop from about 546 to 330 across weather, official reports and summaries; failed refreshes still retain the previous forecast. No paid-plan change.

### D1 weather storage (October 20)
Production weather/summary/report storage now uses `WEATHER_DB` → **turtlesnow-weather**, table **weather_cache**. Existing weather and summary timestamps are preserved. The original KV namespace is retained only as an inactive rollback snapshot and is no longer bound to the deployed Worker; normal visitors and scheduled jobs perform no KV reads or writes. `src/weather-store.js` uses parameterized primary-key lookups and upserts and never falls back to obsolete KV if D1 fails. Legacy KV support remains solely for old deployments/tests. Feedback and the summary-run quota ledger remain in the separate **turtlesnow-feedback** database.

Apply weather migrations using `wrangler d1 migrations apply turtlesnow-weather --remote` (`weather-migrations/`). A read-only inspection query is `SELECT key, stored_at FROM weather_cache ORDER BY key;`. Stored JSON source timestamps remain authoritative; `stored_at` only describes database writes/migration time. Latest snapshots are overwritten rather than accumulating unbounded hourly history. Free plan retained. Future resort expansion also requires reviewing scheduled-job subrequest limits and upstream/AI budgets; D1 capacity alone is not a promise that arbitrary expansion is free.

### Sixteen-resort catalog
Added Arapahoe Basin, Aspen Snowmass, Big Sky, Jackson Hole, Mount Snow, Okemo and Snowbasin. Aspen Snowmass uses an explicitly labeled Snowmass forecast point, not a forecast averaged over all four Aspen mountains. New elevations are representative model heights, not official snow stakes. Official base/new-snow feeds remain connected only for Brighton/Alta; missing metrics are not invented for new resorts.

Weather refreshes all sixteen resorts hourly with three requests in flight. AI runs in two non-overlapping alphabetical batches of eight, five minutes apart, every twelve hours; the shared daily claim cap is 32, with one attempt per resort per twelve-hour slot. Output remains capped at 1,000 tokens and fact inputs bounded. This is expected to fit the daily free AI allowance under normal use, but other account workloads share quotas. No paid upgrade is enabled.
