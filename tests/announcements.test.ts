import { describe, it, expect } from 'vitest';
import {
  activeAnnouncements,
  defaultAnnouncements,
  validateAnnouncements,
  validImage,
  weatherEnabled,
} from '../src/lib/announcements';
import { seasonalSettings } from '../src/lib/seasonal';
describe('announcements and recoverable weather', () => {
  it('disables weather and retains eight editable announcements', () => {
    expect(weatherEnabled).toBe(false);
    expect(validateAnnouncements(defaultAnnouncements).items).toHaveLength(8);
  });
  it('validates modes, safe images, dates, IDs and text', () => {
    const item = defaultAnnouncements.items[0];
    for (const patch of [
      { text: '' },
      { text: 'x'.repeat(241) },
      { icon: 'x'.repeat(17) },
      { enabled: 'true' },
      { image: 'javascript:alert(1)' },
      { image: 'data:image/svg+xml,unsafe' },
      { image: 'http://example.com/a.png' },
      { starts: 'bad' },
      { starts: '2026-12-01', expires: '2026-11-01' },
    ])
      expect(() =>
        validateAnnouncements({ mode: 'single', items: [{ ...item, ...patch }] }),
      ).toThrow();
    expect(() => validateAnnouncements({ mode: 'unknown', items: [] })).toThrow();
    expect(() => validateAnnouncements({ mode: 'single', items: [item, item] })).toThrow();
    expect(validImage('/art/turkey.webp')).toBe(true);
    expect(validImage('https://example.com/image.webp')).toBe(true);
    expect(validImage('https://user:password@example.com/image.webp')).toBe(false);
  });
  it('filters schedules, availability and seasonal announcements while retaining order', () => {
    const config = structuredClone(defaultAnnouncements);
    config.items[0].enabled = false;
    config.items[1].starts = '2030-01-01';
    config.items[2].expires = '2020-01-01';
    expect(activeAnnouncements(config, Date.parse('2026-11-15'), true).map((a) => a.id)).toEqual(
      config.items.slice(3).map((a) => a.id),
    );
    expect(
      activeAnnouncements(defaultAnnouncements, Date.now(), false).every((a) => !a.seasonal),
    ).toBe(true);
    expect(validateAnnouncements({ mode: 'decorations', items: [] })).toEqual({
      mode: 'decorations',
      items: [],
    });
  });
  it('preserves saved values and supplies legacy decoration defaults independently', () => {
    const saved = JSON.parse(
      JSON.stringify({
        mode: 'single',
        items: [{ ...defaultAnnouncements.items[0], text: 'Our custom welcome' }],
      }),
    );
    expect(validateAnnouncements(saved).items[0].text).toBe('Our custom welcome');
    const theme = seasonalSettings({
      thanksgiving: true,
      decorations: true,
      animations: true,
      farm: false,
      turkey: false,
    });
    expect(theme.farm).toBe(false);
    expect(theme.turkey).toBe(false);
    expect(theme.pumpkins).toBe(true);
  });
});
