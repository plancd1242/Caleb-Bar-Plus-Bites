import { describe, it, expect } from 'vitest';
import { currentMenu, defaultSettings } from '../src/lib/menu';
import { approvedSpecials } from '../src/lib/seasonal';
import { quote } from '../src/lib/pricing';
import { verifiedQuote } from '../worker/promotions';
const line = (id: string, quantity = 1) => ({ id, quantity, note: '', option: '' });
describe('approved Thanksgiving products and fixed-content deals', () => {
  it('enables six approved specials and three deals without changing ordinary prices', () => {
    const menu = currentMenu(structuredClone(defaultSettings));
    expect(approvedSpecials).toHaveLength(9);
    expect(new Set(approvedSpecials.map((i) => i.image)).size).toBe(9);
    expect(approvedSpecials.filter((i) => !i.bundle)).toHaveLength(6);
    expect(approvedSpecials.map((i) => i.price)).toEqual([
      400, 200, 175, 200, 375, 350, 700, 500, 1000,
    ]);
    expect(
      menu
        .filter((i) => i.id.startsWith('harvest-'))
        .every((i) => i.available && i.visibility === 'order' && i.image),
    ).toBe(true);
    expect(menu.find((i) => i.id === 'chicken')?.price).toBe(475);
    expect(menu.find((i) => i.id === 'grilled')?.price).toBe(375);
    expect(menu.filter((i) => i.retired).every((i) => !i.available)).toBe(true);
    expect(
      approvedSpecials.some((i) =>
        /cider|cranberry|lime|ginger ale/i.test(i.name + ' ' + i.description),
      ),
    ).toBe(false);
  });
  it.each([
    ['harvest-gobble-sip', 700, 2],
    ['harvest-little-combo', 500, 2],
    ['harvest-ultimate', 1000, 4],
  ])('quotes %s from its real components', (id, total, count) => {
    const q = quote([line(String(id), 2)], currentMenu(structuredClone(defaultSettings)), 'none');
    expect(q.total).toBe(Number(total) * 2);
    expect(q.lines[0].contents).toHaveLength(Number(count));
  });
  it('rejects disabled or removed components and never raises a cheaper separate total', () => {
    const s = structuredClone(defaultSettings);
    s.overrides['harvest-gobble-bites'] = { available: false };
    expect(() => quote([line('harvest-gobble-sip')], currentMenu(s), 'none')).toThrow(/available/);
    s.overrides['harvest-gobble-bites'] = { price: 50 };
    expect(quote([line('harvest-gobble-sip')], currentMenu(s), 'none').total).toBe(425);
    s.removed = ['harvest-golden-gobbler'];
    expect(() => quote([line('harvest-gobble-sip')], currentMenu(s), 'none')).toThrow(/available/);
  });
  it('rejects promotion stacking and ignores forged component snapshots', async () => {
    const s = structuredClone(defaultSettings),
      menu = currentMenu(s);
    await expect(
      verifiedQuote(
        [line('harvest-ultimate')],
        menu,
        s,
        { offerId: 'forged' },
        () => false,
        () => false,
      ),
    ).rejects.toThrow(/stacked/);
    const forged = {
      ...line('harvest-gobble-sip'),
      contents: [{ name: 'Extra free food', quantity: 100 }],
    };
    expect(
      quote([forged], menu, 'none').lines[0].contents?.some((i) => i.name === 'Extra free food'),
    ).toBe(false);
  });
});
