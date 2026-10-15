# Deployment record — 2026-10-15

- GitHub: https://github.com/mirackk/TurtleSnow (owner verified as mirackk; source pushed to main).
- Cloudflare Worker: turtlesnow, account 43b5ffa383e06b416f11a0e935fe7b79.
- Public hostname: https://turtlesnow.wasatch-snow.workers.dev
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
