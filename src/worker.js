export const resorts = {
  brighton: { latitude: 40.598, longitude: -111.583, elevation: 2879 },
  alta: { latitude: 40.588, longitude: -111.638, elevation: 2900 }
};
const fields = ['snowfall_sum', 'temperature_2m_max', 'temperature_2m_min', 'wind_speed_10m_max'];
export function validate(data) {
  const d = data?.daily;
  if (data?.timezone !== 'America/Denver' || d?.time?.length !== 15 ||
      !d.time.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t)) ||
      fields.some(k => d[k]?.length !== 15 || !d[k].every(Number.isFinite)) ||
      d.snowfall_sum.some(n => n < 0) || d.wind_speed_10m_max.some(n => n < 0)) {
    throw new Error('Incomplete forecast');
  }
  return data;
}
export async function refresh(env, fetcher = fetch, now = () => new Date()) {
  return Promise.allSettled(Object.entries(resorts).map(async ([key, location]) => {
    const attemptedAt = now().toISOString();
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({ ...location, daily: fields.join(','), timezone: 'America/Denver', forecast_days: 15, temperature_unit: 'celsius', wind_speed_unit: 'kmh' });
      const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
      const forecast = validate(await response.json());
      // No TTL: the last valid forecast survives upstream outages.
      await env.FORECASTS.put(`forecast:${key}`, JSON.stringify({ ...forecast, updatedAt: now().toISOString() }));
      await env.FORECASTS.put(`status:${key}`, JSON.stringify({ attemptedAt, ok: true }));
    } catch (error) {
      await env.FORECASTS.put(`status:${key}`, JSON.stringify({ attemptedAt, ok: false }));
      console.error(`Forecast refresh failed: ${key}`, error.message);
      throw error;
    }
  }));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
    if (url.pathname !== '/api/forecast') return Response.json({ error: 'Not found' }, { status: 404, headers });
    const key = url.searchParams.get('resort') || 'brighton';
    if (!Object.hasOwn(resorts, key)) return Response.json({ error: 'Unknown resort' }, { status: 400, headers });
    // Visitors only read shared storage. They never trigger upstream calls.
    const [forecast, status] = await Promise.all([
      env.FORECASTS.get(`forecast:${key}`, 'json'), env.FORECASTS.get(`status:${key}`, 'json')
    ]);
    if (!forecast) return Response.json({ error: 'Forecast not initialized' }, { status: 503, headers: { ...headers, 'Retry-After': '300' } });
    const stale = Date.now() - Date.parse(forecast.updatedAt) > 90 * 60 * 1000 || status?.ok === false;
    return Response.json({ ...forecast, stale, lastAttemptAt: status?.attemptedAt || null, lastRefreshOk: status?.ok ?? null }, { headers });
  },
  async scheduled(controller, env, ctx) {
    const results = await refresh(env);
    if (results.some(r => r.status === 'rejected')) throw new Error('One or more forecasts failed to refresh');
  }
};
