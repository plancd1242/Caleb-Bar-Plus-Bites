<script lang="ts">
  import Icon from './Icon.svelte';
  export let compact = false;
  let loading = false;
  let error = '';
  let weather: {
    location: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    condition: string;
    description: string;
    icon: string | null;
  } | null = null;
  function locate() {
    error = '';
    weather = null;
    loading = true;
    if (!navigator.onLine) {
      error = 'You’re offline. Reconnect to check the weather.';
      loading = false;
      return;
    }
    if (!navigator.geolocation) {
      error = 'Location isn’t available on this device.';
      loading = false;
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `/api/weather?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}`,
            { signal: AbortSignal.timeout(10000) },
          );
          const data = await response.json();
          if (!response.ok) {
            error =
              typeof data.error === 'string' ? data.error : 'Weather is unavailable right now.';
            return;
          }
          if (
            ![data.temperature, data.feelsLike, data.humidity, data.windSpeed].every(
              Number.isFinite,
            )
          )
            throw new Error();
          weather = data;
        } catch (e) {
          error = !navigator.onLine
            ? 'You’re offline. Reconnect to check the weather.'
            : e instanceof Error && ['TimeoutError', 'AbortError'].includes(e.name)
              ? 'The weather request timed out. Please try again.'
              : 'Weather is unavailable right now. Your next delicious bite is still available.';
        } finally {
          loading = false;
        }
      },
      (e) => {
        loading = false;
        error =
          e.code === 1
            ? 'Location access is off. You can enable it in your browser settings, or simply enjoy your visit.'
            : 'We couldn’t find your location. Try again when you have a connection.';
      },
      { timeout: 8000, maximumAge: 600000 },
    );
  }
</script>

<div class:compact class="weather-content">
  <div class="weather-symbol"><Icon name="sun" size={compact ? 30 : 64} /></div>
  <div>
    <p class="eyebrow">A LITTLE FRESH AIR</p>
    {#if weather}<h2>
        {Math.round(weather.temperature)}° <span class="muted">{weather.condition}</span>
      </h2>
      <p>{weather.location} · Feels like {Math.round(weather.feelsLike)}°F</p>
      {#if !compact}<p>
          {weather.description} · Humidity {weather.humidity}% · Wind {Math.round(
            weather.windSpeed,
          )} mph
        </p>{/if}{:else}<h2>
        {compact ? 'How’s it outside?' : 'A good day to be here.'}
      </h2>
      <p>{error || 'Check the forecast wherever you’re enjoying Caleb’s.'}</p>{/if}<button
      class="text-button"
      disabled={loading}
      onclick={locate}
      >{loading
        ? 'Checking the skies…'
        : weather
          ? 'Refresh weather ↻'
          : 'Use my location →'}</button
    >{#if weather}<small
        >Weather by <a href="https://openweathermap.org/" target="_blank" rel="noreferrer"
          >OpenWeather</a
        ></small
      >{/if}
  </div>
</div>
