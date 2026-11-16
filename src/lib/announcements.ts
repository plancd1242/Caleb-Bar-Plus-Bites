import type { AnnouncementSettings } from './types';
export const weatherEnabled = false; // Preserve Weather.svelte and worker/weather.ts for a future instructed restoration.
export const defaultAnnouncements: AnnouncementSettings = {
  mode: 'rotating',
  items: [
    ['🎉', 'Grand Opening — November 26, 2026!', true],
    ['🦃', 'Discover our Thanksgiving Specials!', true],
    ['🍹', 'Try our seasonal mocktails!', true],
    ['💧', 'Enjoy complimentary infused water!', false],
    ['🔋', 'Free device charging available!', false],
    ['💳', 'Caleb’s Store member cards accepted!', false],
    ['💚', 'Thank you for supporting our restaurant!', false],
    ['🚜', 'Welcome to Life by the Farm!', false],
  ].map(([icon, text, seasonal], index) => ({
    id: 'welcome-' + index,
    icon: String(icon),
    text: String(text),
    seasonal: !!seasonal,
    image: '',
    enabled: true,
    starts: '',
    expires: '',
  })),
};
export function validImage(value: string) {
  if (!value) return true;
  if (/^\/art\/[A-Za-z0-9/_-]+\.(?:webp|avif|png|jpg|svg)$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validateAnnouncements(input: unknown): AnnouncementSettings {
  if (!input || typeof input !== 'object') throw new Error('Announcements required.');
  const v = input as AnnouncementSettings;
  if (
    !['rotating', 'single', 'decorations'].includes(v.mode) ||
    !Array.isArray(v.items) ||
    v.items.length > 50
  )
    throw new Error('Choose a display mode and up to 50 announcements.');
  const ids = new Set<string>();
  return {
    mode: v.mode,
    items: v.items.map((a) => {
      if (!a || typeof a.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(a.id) || ids.has(a.id))
        throw new Error('Announcement IDs must be unique.');
      ids.add(a.id);
      if (
        typeof a.text !== 'string' ||
        !a.text.trim() ||
        a.text.length > 240 ||
        typeof a.icon !== 'string' ||
        a.icon.length > 16 ||
        typeof a.image !== 'string' ||
        a.image.length > 1000 ||
        !validImage(a.image) ||
        typeof a.enabled !== 'boolean' ||
        typeof a.seasonal !== 'boolean'
      )
        throw new Error(
          'Enter announcement text (up to 240 characters), a short icon and an optional HTTPS or /art/ image.',
        );
      for (const date of [a.starts, a.expires])
        if (typeof date !== 'string' || (date && !Number.isFinite(Date.parse(date))))
          throw new Error('Invalid announcement date.');
      if (a.starts && a.expires && Date.parse(a.expires) <= Date.parse(a.starts))
        throw new Error('Expiration must follow the start.');
      return {
        id: a.id,
        text: a.text.trim(),
        icon: a.icon,
        image: a.image,
        enabled: a.enabled,
        seasonal: a.seasonal,
        starts: a.starts,
        expires: a.expires,
      };
    }),
  };
}
export function activeAnnouncements(config: AnnouncementSettings, now: number, seasonal: boolean) {
  return config.items.filter(
    (a) =>
      a.enabled &&
      (!a.seasonal || seasonal) &&
      (!a.starts || Date.parse(a.starts) <= now) &&
      (!a.expires || Date.parse(a.expires) > now),
  );
}
