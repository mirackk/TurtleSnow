# Deployment record — 2026-10-15

- GitHub: https://github.com/mirackk/wasatch-snow (owner verified as mirackk; source pushed to main).
- Cloudflare Worker: wasatch-snow, account 43b5ffa383e06b416f11a0e935fe7b79.
- Public hostname: https://wasatch-snow.wasatch-snow.workers.dev
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

The new Cloudflare hostname was enabled successfully, but HTTPS initially failed with TLS handshake errors in curl and the browser. No certificate verification was bypassed. HTTP works; HTTPS anonymous access and production browser QA require a successful recheck after domain/certificate provisioning. Cron registration is verified; a naturally occurring production hourly execution has not yet been observed.

The old Sites demo remains on its original deployment. The new cached implementation is hosted in the user's Cloudflare account. GitHub push alone does not trigger deployment; use `npm run deploy` after browser OAuth login.
