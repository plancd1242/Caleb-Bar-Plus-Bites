import { afterEach, expect, it, vi } from 'vitest';
import { weatherResponse } from '../worker/weather';
const request = () => new Request('https://kiosk.example/api/weather?latitude=42&longitude=-83');
// Only used with an intercepted fetch; never sent to OpenWeather.
const env = { OPENWEATHER_API_KEY: 'mock-only-not-a-real-key' };
afterEach(() => vi.unstubAllGlobals());
it('missing key returns useful error without calling the provider', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const response = await weatherResponse(request(), {});
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain('not configured');
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects invalid coordinates and methods', async () => {
  for (const query of [
    '',
    '?latitude=91&longitude=0',
    '?latitude=0&longitude=181',
    '?latitude=NaN&longitude=0',
    '?latitude=&longitude=0',
  ])
    expect(
      (await weatherResponse(new Request('https://kiosk.example/api/weather' + query), env)).status,
    ).toBe(400);
  expect((await weatherResponse(new Request(request(), { method: 'POST' }), env)).status).toBe(405);
});
it('adapts current weather, uses imperial units, and never returns the key', async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      name: 'Detroit',
      main: { temp: 72, feels_like: 74, humidity: 60 },
      wind: { speed: 8 },
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const response = await weatherResponse(request(), env);
  const body = await response.json();
  expect(body).toEqual({
    location: 'Detroit',
    temperature: 72,
    feelsLike: 74,
    humidity: 60,
    windSpeed: 8,
    condition: 'Clear',
    description: 'clear sky',
    conditionId: 800,
    icon: '01d',
  });
  const url = fetch.mock.calls[0][0] as URL;
  expect(url.hostname).toBe('api.openweathermap.org');
  expect(url.searchParams.get('units')).toBe('imperial');
  expect(url.searchParams.get('appid')).toBe(env.OPENWEATHER_API_KEY);
  expect(JSON.stringify(body)).not.toContain(env.OPENWEATHER_API_KEY);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
for (const status of [401, 403, 429, 500])
  it(`handles provider status ${status} without exposing provider content`, async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(env.OPENWEATHER_API_KEY, { status })),
    );
    const r = await weatherResponse(request(), env);
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain(env.OPENWEATHER_API_KEY);
  });
it('handles timeouts and network failures without leaking errors', async () => {
  for (const name of ['TimeoutError', 'TypeError']) {
    const error = new Error(env.OPENWEATHER_API_KEY);
    error.name = name;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    const r = await weatherResponse(request(), env);
    expect(r.status).toBe(502);
    const text = await r.text();
    expect(text).not.toContain(env.OPENWEATHER_API_KEY);
    if (name === 'TimeoutError') expect(text).toContain('timed out');
  }
});
it('handles malformed and incomplete provider data', async () => {
  for (const response of [Response.json({}), Response.json(null), new Response('not json')]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    expect((await weatherResponse(request(), env)).status).toBe(502);
  }
});
