import { describe, it, expect } from 'vitest';
import { quote, money } from '../src/lib/pricing';
import { menu, currentMenu, defaultSettings } from '../src/lib/menu';
import type { CartLine } from '../src/lib/types';
const line = (id: string, quantity = 1, note = '', option = ''): CartLine => ({
  id,
  quantity,
  note,
  option,
});
describe('integer-cent pricing and promotion contracts', () => {
  it('normal order, cents, quantities and zero tax', () => {
    const q = quote([line('chicken', 2), line('milk')], menu);
    expect(q.total).toBe(1150);
    expect(q.tax).toBe(0);
    expect(money(q.total)).toBe('$11.50');
  });
  it('empty cart has zero totals', () => expect(quote([], menu).total).toBe(0));
  it('Sip & Share saves 350 per qualifying pair', () =>
    expect(quote([line('chicken', 2), line('sunset', 2)], menu, 'sip').discount).toBe(700));
  it('Sip savings never consume non-qualifying items when prices fall', () => {
    const m = menu.map((i) => ({
      ...i,
      price: i.category === 'Bites' || i.category === 'Mocktails' ? 50 : i.price,
    }));
    expect(quote([line('chicken'), line('sunset'), line('milk')], m, 'sip').total).toBe(200);
  });
  it('BOGO picks equal or lesser prices and handles odd quantities', () =>
    expect(quote([line('sparkle2'), line('sunset', 2)], menu, 'bogo').discount).toBe(400));
  it('BOGO supports multiple pairs without reusing drinks', () =>
    expect(quote([line('sparkle2', 2), line('surprise', 3)], menu, 'bogo').discount).toBe(725));
  it('Ultimate bundle costs exactly $10', () =>
    expect(
      quote([line('sunset', 2), line('chicken', 2), line('nachos')], menu, 'ultimate').total,
    ).toBe(1000));
  it('multiple Ultimate bundles leave extra items full price', () =>
    expect(
      quote(
        [line('sunset', 4), line('chicken', 4), line('nachos', 2), line('milk')],
        menu,
        'ultimate',
      ).total,
    ).toBe(2200));
  it('does not make a cheap bundle more expensive', () => {
    const m = menu.map((i) => ({ ...i, price: 50 }));
    expect(
      quote([line('sunset', 2), line('chicken', 2), line('nachos')], m, 'ultimate').discount,
    ).toBe(0);
  });
  it('best selects one promotion, never adds competing savings', () => {
    const cart = [line('sunset', 2), line('chicken', 2), line('nachos')];
    const q = quote(cart, menu);
    expect(q.discount).toBe(1150);
    expect(q.promotion).toBe('The Ultimate $10 Deal');
  });
  it('unqualified and incomplete bundles earn no discount', () => {
    expect(quote([line('milk'), line('chicken')], menu).discount).toBe(0);
    expect(quote([line('sunset', 2), line('chicken')], menu, 'ultimate').discount).toBe(0);
  });
  it('kids and custom items are excluded', () =>
    expect(
      quote([line('kids-nuggets'), line('kids-sparkle'), line('custom-mocktail', 1, 'lime')], menu)
        .discount,
    ).toBe(0));
  it('variable prices are null, pending, and never invented', () => {
    const q = quote([line('custom-bite', 2, 'pizza'), line('milk')], menu);
    expect(q.total).toBe(200);
    expect(q.pending).toBe(true);
    expect(q.lines[0].price).toBeNull();
  });
  it('requires choices and custom details', () => {
    expect(() => quote([line('tea')], menu)).toThrow('Choose an option');
    expect(() => quote([line('custom-bite')], menu)).toThrow('Describe');
    expect(quote([line('tea', 1, '', 'Unsweet')], menu).total).toBe(250);
    expect(quote([line('kids-drink', 1, '', 'Lemonade')], menu).total).toBe(200);
  });
  it('rejects unknown items, sold out items, bad quantities and notes', () => {
    for (const qty of [0, -1, 1.2, 21, Infinity])
      expect(() => quote([line('milk', qty)], menu)).toThrow();
    expect(() => quote([line('no')], menu)).toThrow();
    expect(() => quote([line('milk', 1, 'x'.repeat(301))], menu)).toThrow();
    expect(() =>
      quote(
        [line('milk')],
        menu.map((i) => ({ ...i, available: false })),
      ),
    ).toThrow();
  });
  it('menu overrides leave variable prices unpriced', () => {
    const m = currentMenu({
      ...defaultSettings,
      overrides: { milk: { price: 225 }, 'custom-bite': { price: 400 } },
    });
    expect(m.find((i) => i.id === 'milk')?.price).toBe(225);
    expect(m.find((i) => i.id === 'custom-bite')?.price).toBeNull();
  });
  it('all menu ids are unique and all prices integer cents', () => {
    expect(new Set(menu.map((i) => i.id)).size).toBe(menu.length);
    for (const i of menu) expect(i.price === null || Number.isInteger(i.price)).toBe(true);
  });
  it('discounts stay bounded for 500 deterministic combinations', () => {
    for (let n = 0; n < 500; n++) {
      const cart = [
        line('chicken', (n % 7) + 1),
        line('surprise', (n % 5) + 1),
        line('sparkle2', (n % 3) + 1),
        line('cookies', (n % 4) + 1),
      ];
      const q = quote(cart, menu);
      expect(Number.isInteger(q.total)).toBe(true);
      expect(q.total).toBeGreaterThanOrEqual(0);
      expect(q.discount).toBeLessThanOrEqual(q.subtotal);
      const options = ['none', 'sip', 'bogo', 'ultimate'] as const;
      expect(q.discount).toBe(Math.max(...options.map((p) => quote(cart, menu, p).discount)));
    }
  });
});
