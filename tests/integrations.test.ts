import { describe, it, expect, vi } from 'vitest';
import { giphyKey, integrationStatus, celebrationResponse } from '../worker/integrations';
describe('private GIPHY configuration detection', () => {
  it.each([
    undefined,
    null,
    '',
    ' ',
    '\t\n',
    '""',
    "''",
    'YOUR_GIPHY_API_KEY',
    'your_giphy_api_key_here',
    '<GIPHY_API_KEY>',
    'replace_me',
    'REPLACE_WITH_YOUR_GIPHY_API_KEY',
    'paste key here',
    'placeholder',
    'undefined',
    'null',
    'xxxxxxxx',
    '000000',
  ])('rejects empty or placeholder configuration (%s)', async (value) => {
    expect(giphyKey(value)).toBeNull();
    const env = { GIPHY_API_KEY: value as string | undefined };
    expect(integrationStatus(env).giphy.status).toBe('Not Configured');
    const fetcher = vi.fn();
    expect(await celebrationResponse(env, fetcher)).toEqual({ url: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports presence without claiming provider validation or returning credentials', () => {
    const value = 'synthetic-giphy-fixture-value';
    expect(giphyKey('  ' + value + '  ')).toBe(value);
    const status = integrationStatus({ GIPHY_API_KEY: value });
    expect(status.giphy.configured).toBe(true);
    expect(status.giphy.providerVerified).toBe(false);
    expect(JSON.stringify(status)).not.toContain(value);
  });
  it('retains graceful provider failure and valid GIF behavior', async () => {
    const env = { GIPHY_API_KEY: 'synthetic-giphy-fixture-value' };
    expect(
      await celebrationResponse(env, vi.fn().mockResolvedValue(Response.json({}, { status: 403 }))),
    ).toEqual({ url: null });
    expect(
      await celebrationResponse(env, vi.fn().mockRejectedValue(new Error('upstream'))),
    ).toEqual({ url: null });
    expect(
      await celebrationResponse(
        env,
        vi
          .fn()
          .mockResolvedValue(
            Response.json({
              data: [{ images: { fixed_height: { url: 'https://media.giphy.com/test.gif' } } }],
            }),
          ),
      ),
    ).toEqual({ url: 'https://media.giphy.com/test.gif' });
  });
});
