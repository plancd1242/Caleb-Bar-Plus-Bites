import { describe, it, expect } from 'vitest';
import { currentMenu, defaultSettings } from '../src/lib/menu';
import { changeMenu } from '../src/lib/menu-management';
import { quote } from '../src/lib/pricing';

describe('persistent menu edits', () => {
  const draft = {
    name: 'Test special',
    description: 'Test ingredients',
    price: 625,
    category: 'Bites',
    special: true,
    available: true,
  };
  it('keeps a new draft hidden until staff enables it', () => {
    const settings = structuredClone(defaultSettings);
    changeMenu(settings, { createItem: { ...draft, available: false } });
    const item = currentMenu(settings).at(-1)!;
    expect(item.available).toBe(false);
    expect(() =>
      quote([{ id: item.id, quantity: 1, note: '', option: '' }], currentMenu(settings)),
    ).toThrow(/available/);
  });
  it('reads legacy settings without changing original prices or custom pricing', () => {
    const settings = structuredClone(defaultSettings);
    expect(currentMenu(settings).find((i) => i.id === 'chicken')?.price).toBe(475);
    changeMenu(settings, {
      item: { id: 'custom-bite', name: 'Updated request', description: 'Describe it' },
    });
    expect(currentMenu(settings).find((i) => i.id === 'custom-bite')?.price).toBeNull();
    expect(() => changeMenu(settings, { item: { id: 'custom-bite', price: 500 } })).toThrow();
  });
  it('round-trips additions, edits, disabling, re-enabling and removal without changing receipts', () => {
    let settings = structuredClone(defaultSettings);
    changeMenu(settings, { createItem: draft });
    expect(currentMenu(settings).at(-1)?.special).toBe(true);
    const id = settings.additions![0].id;
    const cart = [{ id, quantity: 1, note: '', option: '' }];
    const receipt = quote(cart, currentMenu(settings));
    settings = JSON.parse(JSON.stringify(settings));
    changeMenu(settings, { item: { id, price: 700, name: 'Edited special', available: false } });
    expect(() => quote(cart, currentMenu(settings))).toThrow(/available/);
    changeMenu(settings, { item: { id, available: true } });
    expect(quote(cart, currentMenu(settings)).total).toBe(700);
    changeMenu(settings, { removeItem: id });
    expect(() => quote(cart, currentMenu(settings))).toThrow(/available/);
    expect(receipt.total).toBe(625);
    expect(receipt.lines[0].name).toBe(draft.name);
  });
  it.each([0, -1, 49, 100001, 123.5, '625', null])('rejects invalid cent price %s', (price) => {
    expect(() =>
      changeMenu(structuredClone(defaultSettings), { createItem: { ...draft, price } }),
    ).toThrow();
  });
  it('validates fields and keeps bundle eligibility based on category', () => {
    for (const patch of [
      { name: '' },
      { name: 'x'.repeat(81) },
      { description: 'x'.repeat(501) },
      { category: 'Invalid' },
      { available: 'yes' },
      { special: 1 },
    ]) {
      expect(() =>
        changeMenu(structuredClone(defaultSettings), { createItem: { ...draft, ...patch } }),
      ).toThrow();
    }
    const settings = structuredClone(defaultSettings);
    changeMenu(settings, { createItem: draft });
    const cart = [
      { id: settings.additions![0].id, quantity: 1, note: '', option: '' },
      { id: 'sunset', quantity: 1, note: '', option: '' },
    ];
    expect(quote(cart, currentMenu(settings)).discount).toBe(350);
    changeMenu(settings, { item: { id: cart[0].id, category: 'Specials' } });
    expect(quote(cart, currentMenu(settings)).discount).toBe(0);
  });
});
