export type WeatherEnv = { OPENWEATHER_API_KEY?: string };

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function weatherResponse(request: Request, env: WeatherEnv): Promise<Response> {
  if (request.method !== 'GET') return reply({ error: 'Weather requires a GET request.' }, 405);
  const params = new URL(request.url).searchParams;
  const lat = params.get('latitude');
  const lon = params.get('longitude');
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    !lat?.trim() ||
    !lon?.trim() ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return reply({ error: 'A valid location is needed to check the weather.' }, 400);
  const key = env.OPENWEATHER_API_KEY?.trim();
  if (!key)
    return reply(
      {
        error:
          'Weather is not configured yet. Please ask an employee to configure the weather service.',
      },
      503,
    );
  try {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.search = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      units: 'imperial',
      appid: key,
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) {
      // Do not return upstream messages or URLs: they could contain credentials.
      return reply(
        {
          error:
            response.status === 401 || response.status === 403
              ? 'The weather service could not authorize the request. Please ask an employee to check the weather key.'
              : response.status === 429
                ? 'The weather service is busy. Please try again shortly.'
                : 'Weather is unavailable right now. Please try again shortly.',
        },
        502,
      );
    }
    const data = (await response.json()) as {
      name?: string;
      main?: { temp?: number; feels_like?: number; humidity?: number };
      wind?: { speed?: number };
      weather?: { id?: number; main?: string; description?: string; icon?: string }[];
    };
    const condition = data?.weather?.[0];
    if (
      ![data?.main?.temp, data?.main?.feels_like, data?.main?.humidity, data?.wind?.speed].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      ) ||
      typeof condition?.main !== 'string' ||
      typeof condition.description !== 'string'
    )
      return reply({ error: 'Weather returned incomplete data. Please try again shortly.' }, 502);
    return reply({
      location: typeof data.name === 'string' ? data.name : 'Your location',
      temperature: data.main!.temp,
      feelsLike: data.main!.feels_like,
      humidity: data.main!.humidity,
      windSpeed: data.wind!.speed,
      condition: condition.main,
      description: condition.description,
      conditionId: condition.id,
      icon:
        typeof condition.icon === 'string' && /^\d{2}[dn]$/.test(condition.icon)
          ? condition.icon
          : null,
    });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
            ? 'The weather request timed out. Please try again.'
            : 'Weather is unavailable right now. Please check your connection and try again.',
      },
      502,
    );
  }
}
