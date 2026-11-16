// Presence is not provider validation. Never return a key or key fragment to callers.
export function giphyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    !normalized ||
    /^(?:null|undefined|none|empty|notconfigured|placeholder|example|dummy|test|changeme|replaceme|todo|tbd|giphyapikey|apikey|yourkey|yourapikey|yourgiphykey|yourgiphyapikey|youractualapikey|youractualgiphyapikey|insertkeyhere|pastekeyhere|replacewithyourkey|replacewithyourapikey|replacewithyourgiphyapikey)$/.test(
      normalized,
    ) ||
    /^(?:your|insert|paste|replace)(?:your)?(?:actual|real)?(?:giphy)?(?:api)?key(?:here)?$/.test(
      normalized,
    ) ||
    /^(?:x+|0+)$/.test(normalized)
  )
    return null;
  return key;
}

export function integrationStatus(env: { GIPHY_API_KEY?: string }) {
  const configured = giphyKey(env.GIPHY_API_KEY) !== null;
  return {
    giphy: {
      configured,
      status: configured ? 'Configured (not verified)' : 'Not Configured',
      source: 'GIPHY_API_KEY binding on this Worker runtime',
      providerVerified: false,
    },
  };
}

export async function celebrationResponse(
  env: { GIPHY_API_KEY?: string },
  request: typeof fetch = fetch,
) {
  const key = giphyKey(env.GIPHY_API_KEY);
  if (!key) return { url: null };
  try {
    const result = await request(
      `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=happy+food&rating=g&limit=1`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!result.ok) return { url: null };
    const data = (await result.json()) as {
      data?: { images?: { fixed_height?: { url?: string } } }[];
    };
    const gif = data.data?.[0]?.images?.fixed_height?.url;
    return { url: gif?.startsWith('https://') ? gif : null };
  } catch {
    return { url: null };
  }
}
