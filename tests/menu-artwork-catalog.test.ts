import { describe, it, expect } from 'vitest';
import { currentMenu, defaultSettings } from '../src/lib/menu';
import { quote } from '../src/lib/pricing';
import { verifiedQuote, validateOffer } from '../worker/promotions';
import type { Offer } from '../src/lib/types';
const main: [string, number][] = [
  ['chicken', 475],
  ['mac', 425],
  ['grilled', 375],
  ['apples', 250],
  ['popcorn', 250],
  ['cheddar', 250],
  ['fruit', 300],
  ['mix', 250],
  ['nachos', 400],
  ['cookies', 250],
  ['icecream', 275],
  ['johnny', 150],
  ['fruit-sorbet', 200],
  ['surprise', 250],
  ['sunset', 400],
  ['sparkle', 400],
  ['sparkle2', 475],
  ['tropical', 425],
  ['strawberry', 425],
  ['blue', 425],
  ['cherry', 400],
  ['tea', 250],
  ['lemonade', 250],
  ['milk', 200],
  ['sprite', 200],
  ['coke', 200],
  ['diet', 200],
  ['water', 150],
  ['chef', 400],
  ['custom-mocktail', 350],
  ['harvest-gobble-bites', 400],
  ['harvest-cheese-bites', 200],
  ['harvest-snack-cup', 175],
  ['harvest-crunch-cup', 200],
  ['harvest-golden-gobbler', 375],
  ['harvest-mini-sparkler', 350],
  ['harvest-gobble-sip', 700],
  ['harvest-little-combo', 500],
  ['harvest-ultimate', 1000],
];
const kids: [string, number][] = [
  ['kids-nuggets', 475],
  ['kids-mac', 425],
  ['kids-grilled', 375],
  ['kids-apples', 250],
  ['kids-fruit', 300],
  ['kids-drink', 200],
  ['kids-sparkle', 400],
  ['kids-sparkle2', 475],
  ['kids-strawberry', 425],
  ['kids-blue', 425],
  ['kids-cherry', 400],
];
const additions: [string, number][] = [
  ['turkey-slider', 475],
  ['mashed-potato', 375],
  ['butter-corn', 300],
  ['harvest-sparkle', 475],
  ['pumpkin-pie', 450],
];
const line = (id: string, quantity = 1) => ({ id, quantity, note: '', option: '' });
describe('all three Thanksgiving PNGs match orderable products', () => {
  it.each([
    ...main,
    ...kids,
    ...additions.flatMap(([id, price]): [string, number][] => [
      ['thanksgiving-new-' + id, price],
      ['kids-thanksgiving-new-' + id, price],
    ]),
  ])('orders advertised %s at %i cents', (id, price) => {
    const menu = currentMenu(structuredClone(defaultSettings));
    const item = menu.find((i) => i.id === id)!;
    expect(item?.available).toBe(true);
    expect(item.price).toBe(price);
    expect(
      quote(
        [
          {
            ...line(id),
            option: item.options?.[0] ?? '',
            note: item.category === 'Custom' ? 'Test request' : '',
          },
        ],
        menu,
        'none',
      ).total,
    ).toBe(price);
  });
  it('replaces only the old dessert ID without reinterpreting old order snapshots', () => {
    const settings = structuredClone(defaultSettings);
    settings.overrides.bar = { price: 500, available: true };
    const menu = currentMenu(settings);
    expect(menu.find((i) => i.id === 'bar')?.available).toBe(false);
    expect(() => quote([line('bar')], menu, 'none')).toThrow(/available/);
    expect(menu.find((i) => i.id === 'fruit-sorbet')?.price).toBe(200);
    expect(menu.find((i) => i.id === 'fruit-sorbet')?.description).toContain('real fruit shell');
  });
  it('corrects Cherry Pop for both catalogs without changing its price or lemon-lime soda', () => {
    for (const id of ['cherry', 'kids-cherry']) {
      const item = currentMenu(structuredClone(defaultSettings)).find((i) => i.id === id)!;
      expect(item.description).toContain('No lime juice.');
      expect(item.description).toContain('Lemon-lime soda');
      expect(item.price).toBe(400);
    }
  });
  it('qualifies main Thanksgiving categories and sorbet under configured rules, excludes kids', async () => {
    const settings = structuredClone(defaultSettings),
      menu = currentMenu(settings);
    const base: Offer = {
      id: 'configured-test',
      name: 'Configured test',
      enabled: true,
      kind: 'bogo',
      eligibility: 'cart',
      starts: '2026-01-01T00:00:00Z',
      expires: '2030-01-01T00:00:00Z',
      minimum: 0,
      requiredItem: '',
      quantity: 1,
      amount: 0,
      limit: 10,
    };
    for (const kind of ['bogo', 'sip', 'ultimate'] as const) {
      settings.offers = [await validateOffer({ ...base, kind })];
      const cart = [
        line('thanksgiving-new-harvest-sparkle', 2),
        line('thanksgiving-new-turkey-slider', 2),
        line('fruit-sorbet'),
      ];
      expect(
        (
          await verifiedQuote(
            cart,
            menu,
            settings,
            { offerId: base.id },
            () => false,
            () => false,
          )
        ).discount,
      ).toBeGreaterThan(0);
      const childCart = cart
        .filter((l) => l.id !== 'fruit-sorbet')
        .map((l) => ({ ...l, id: 'kids-' + l.id }));
      await expect(
        verifiedQuote(
          childCart,
          menu,
          settings,
          { offerId: base.id },
          () => false,
          () => false,
        ),
      ).rejects.toThrow(/qualify/);
    }
  });
});
