# turtleSnow · 滑雪天气预报

Public, login-free Brighton / Alta 15-day snow forecasts. Existing dark responsive UI preserved from Sites commit `21871e1efdfc8c2d50ee6d1f5e14c80ac8f24583`.

## Data flow

Cloudflare Cron (`0 * * * *`, UTC hourly) → two Open-Meteo requests → shared KV → `/api/forecast?resort=brighton|alta` → browser.

Visitors and the refresh button only read KV. No upstream calls occur in HTTP request handlers. Each resort retains its last valid snapshot indefinitely if refresh fails. `updatedAt` is the last successful fetch time, `lastAttemptAt` the latest attempt. The UI formats timestamps in America/Denver including the actual MST/MDT zone and warns when a refresh failed or data is older than 90 minutes. KV is eventually consistent; updates may take roughly a minute to appear globally.

Fixed forecast elevations: Brighton 2879m, Alta 2900m. Snow is stored in cm, temperature in Celsius, wind in km/h. Unit switching is browser-local. Initial cache is populated separately; an empty cache returns 503 rather than fetching upstream.

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

Data: [Open-Meteo](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Free hosted API use is non-commercial only and subject to its rate limits and terms. Two hourly requests mean 48 normal requests/day; model/variable weighting can affect provider call accounting. Caching does not change licensing requirements.

Cloudflare Free quotas currently include 100,000 KV key reads/day and 1,000 key writes/day. Normal updates write 96 keys/day (forecast + status for each resort hourly). Each forecast API request reads two keys. Static assets are served through Workers Assets. No paid upgrade was requested. Traffic and any other account workloads share applicable quotas.

## Verification

`npm test` covers visitor cache-only behavior, both fixed elevations, independent resort updates, failed/malformed upstream data preserving prior snapshots, real success timestamps, and empty/invalid requests. Production anonymous access and browser checks are recorded in `DEPLOYMENT.md`.
