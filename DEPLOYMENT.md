# Deployment record — 2026-10-15

- GitHub: https://github.com/mirackk/TurtleSnow (owner verified as mirackk; source pushed to main).
- Cloudflare Worker: turtlesnow, account 43b5ffa383e06b416f11a0e935fe7b79.
- Public hostname: https://turtlesnow.snowcast.workers.dev
- KV namespace: e992f19c58074ecf879be71bf17062a7; FORECASTS binding.
- Cron: `0 * * * *` (UTC hourly; every hour in Denver too).
- Initial real cache for both resorts: 2026-10-15T17:27:50.910Z.
- No billing upgrade performed. OAuth does not grant access to account subscriptions, so the existing billing plan could not be independently inspected. Usage is designed for the documented Free quotas.

## Verified

- Existing Sites source restored by the official helper at commit 21871e1efdfc8c2d50ee6d1f5e14c80ac8f24583.
- Worker dry-run and deployment succeeded; hourly trigger confirmed by Wrangler.
- Three Node integration tests passed, including upstream failure and malformed-response retention, independent resorts, and cache-only visitor requests.
- Actual local scheduled handler invoked successfully against Open-Meteo.
- Anonymous production HTTP homepage returns 200. Both resort API endpoints return 200, 15 days, matching snapshots across repeat requests, actual cache timestamps, and `Cache-Control: no-store`.
- Local browser checks: real Brighton and Alta forecasts, elevations, cm/inch conversion, daily temperature/wind table; desktop and 390px mobile screenshots inspected. Existing dark layout retained with turtleSnow branding and a small turtle/ski SVG.

## Remaining verification

Initial TLS provisioning errors resolved during the session. Anonymous HTTPS homepage and both resort APIs now return 200. Repeat HTTPS API requests return identical snapshots with 15 days and the original successful fetch timestamp. Production browser confirmed turtleSnow branding, actual forecast data, resort switching and inch conversion. No certificate verification was bypassed. Cron registration is verified; a naturally occurring production hourly execution has not yet been observed.

The old Sites demo remains on its original deployment. The new cached implementation is hosted in the user's Cloudflare account. GitHub push alone does not trigger deployment; use `npm run deploy` after browser OAuth login.

## turtleSnow address and mobile update

- Repository renamed in place to `mirackk/TurtleSnow`; local Git remote updated.
- New primary Worker `turtlesnow` uses the existing KV namespace and hourly Cron.
- Old `wasatch-snow` Worker now returns 308 redirects to the new origin, preserving path and query. Its Cron list is empty to prevent duplicate refreshes. Reapply using `npx wrangler deploy --config wrangler.legacy.jsonc` only when changing the redirect.
- Cloudflare zones lookup returned no connected custom domains. Free Workers URLs require `<worker>.<account-subdomain>.workers.dev`; no domain purchase or paid upgrade was performed.
- Production HTTPS homepage and both resort APIs return 200. Old API URL returns 308 to the matching new URL.
- Mobile viewport checks at 320px and 390px confirmed document width equals viewport width (no page overflow). The 15-day chart scrolls horizontally inside its panel. Resort switching, cm/inch conversion, 15-row daily weather table, and far-date chart selection with temperature/wind details were verified in the production browser.
- Mobile controls have larger touch areas, cards have compact spacing, section headings wrap, daily table cells stay legible, and a horizontal chart scrolling hint is visible.

## Nine-resort and bilingual expansion

- Deployed nine resorts (Winter Park excluded) using a single catalog shared by browser and Worker.
- Added right-side Language selector (中文 / English), translated chart/table/status/outlook/error/footer text, and persisted language choice. Resort and snow-unit preferences survive a language change and reload.
- Preserved Brighton/Alta elevations. Each resort forecast requests and validates its own timezone, and the UI uses that timezone for today labels and successful-update timestamps.
- All nine anonymous production API requests verified: HTTP 200, 15 days, valid success timestamp, expected timezone, and fresh cache.
- Initial nine-resort remote seed succeeded. A local burst then hit upstream 429 errors for two resorts; changed scheduled updates to batches of at most three. Full local nine-resort scheduled invocation subsequently succeeded.
- Four integration tests passed, including cache-only visitor behavior, nine-resort timezone handling, independent failure retention, malformed data rejection, and timezone mismatch retention.
- Browser QA: Chinese and English; A–Z list of nine resorts; English legend and 15-row daily table; language/resort persistence after reload; EDT and PDT timestamps; long Mammoth Mountain title and language selector at 320px with document width exactly 320px; 390px English mobile screenshot.
- Latest runtime version: cd4d8843-b155-4b58-ab65-f74df3d918ad.
- Hourly schedule remains `0 * * * *`; routine usage is 216 upstream requests and 432 KV writes/day. No paid upgrade performed.

## Past-seven-days feature and snowcast domain

- Cloudflare API confirms account subdomain `snowcast`; primary HTTPS origin is now `https://turtlesnow.snowcast.workers.dev`.
- Updated the legacy Worker redirect target and source documentation. Previous account-subdomain URLs stop routing after the Cloudflare rename.
- Added a separate seven-day historical total, daily green bars, local date range and bilingual model-estimate disclosure. Excludes today; snowfall is not resort-measured snow depth.
- Upstream `past_days=7` uses the existing nine hourly requests. Validates 22 contiguous local dates before storing seven historical days plus fifteen forecast days in one cache snapshot.
- Five tests passed, including completed-day boundaries and historical totals, timezone handling, malformed data and failure retention.
- All nine production HTTPS APIs returned seven historical days (Oct 8–14), fifteen forecast days and consistent historical sums.
- Production mobile browser verified Brighton historical total 21.8 cm / 8.6 in, English translation, date labels and seven daily bars. Added safe rendering for older HTML during asset propagation.

## Hourly forecast detail release

- Added selectable dates from both the 15-day chart and daily table, with a matching dark inline detail panel, previous/next day and close controls.
- Added four six-hour period cards, 24-hour snowfall chart and expandable weather table including temperature, wind, gusts and precipitation chance. All use bilingual text, shared unit controls and resort-local time.
- Stored real hourly data in existing shared KV; all nine production resort endpoints verified with 360 hourly intervals, 15 complete forecast days and 7 historical days.
- Eight integration tests passed, including full final-day midnight coverage, 23/25-hour DST days, null handling, malformed-hourly snapshot retention and cache-only visitor behavior.
- Production browser verified chart/table date selection, last-day bounds, next-day arrows, close behavior, English/Chinese, cm/inch, four period cards, 24 hourly rows and no document overflow at 390px. Screenshot: `turtleSnow-hourly.png` in the parent workspace.
- The extra upstream day is trimmed from daily forecasts and used only to complete the last hourly interval. Missing values and uncertain long-range timing are disclosed.

## Brighton parking rule checker

- Deployed Brighton-only bilingual parking card with date/time controls, explicit rule status, official booking/source links and published release-time guidance.
- No live inventory API or paid parking-data subscription was integrated. API pricing is not publicly confirmed; no fees or credential changes were incurred.
- Two parking tests passed: enforcement boundaries, Christmas exception, holidays, conflicting official dates, invalid input and dates outside the verified calendar.
- Production browser verified Fri Dec 4 at 09:00 requires reservations, 12:00 does not, Jan 19 is unconfirmed, card hides on Alta, and English/Chinese render at 390px without document overflow.
- Runtime version: 893452d3-8929-4c95-a7c5-59a653a40995.
