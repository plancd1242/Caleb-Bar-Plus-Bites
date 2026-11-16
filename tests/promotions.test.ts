import { describe, it, expect } from 'vitest';
import { verifiedQuote, validateOffer } from '../worker/promotions';
import { currentMenu, defaultSettings } from '../src/lib/menu';
import type { Offer, Settings } from '../src/lib/types';
const line = (id: string, quantity = 1) => ({ id, quantity, note: '', option: '' });
const cart = [line('chicken'), line('sunset', 2), line('nachos')];
const rule: Offer = {
  id: 'test-offer',
  name: 'Test offer',
  kind: 'sip',
  eligibility: 'cart',
  starts: '2026-01-01T00:00:00Z',
  expires: '2027-01-01T00:00:00Z',
  minimum: 0,
  requiredItem: '',
  quantity: 1,
  amount: 0,
  limit: 10,
  enabled: true,
};
const now = Date.parse('2026-11-15T12:00:00Z');
const settings = (offer?: Offer): Settings => ({
  ...structuredClone(defaultSettings),
  offers: offer ? [offer] : [],
});
const run = (
  input: Record<string, unknown>,
  offer?: Offer,
  items = cart,
  used = false,
  approved = false,
) =>
  verifiedQuote(
    items,
    currentMenu(settings(offer)),
    settings(offer),
    input,
    () => used,
    () => approved,
    now,
  );
describe('server-authorized offers', () => {
  it.each(['sip', 'bogo', 'ultimate', 'free', 'percent', 'credit', 'member', 'unknown'])(
    'rejects direct customer promotion %s',
    async (promotion) => {
      await expect(run({ promotion })).rejects.toThrow();
    },
  );
  it.each([
    'discount',
    'discountAmount',
    'credit',
    'percentage',
    'member',
    'membership',
    'promotions',
  ])('rejects customer-supplied %s', async (key) => {
    await expect(run({ [key]: 100 })).rejects.toThrow();
  });
  it('does not grant automatic discounts without configured offers', async () => {
    expect((await run({ promotion: 'best' })).discount).toBe(0);
    await expect(run({ offerId: rule.id })).rejects.toThrow();
  });
  it('validates dates, enable state and member verification', async () => {
    for (const patch of [
      { enabled: false },
      { starts: '2027-01-01' },
      { expires: '2026-01-02' },
      { eligibility: 'member' as const },
    ])
      await expect(run({ offerId: rule.id }, { ...rule, ...patch })).rejects.toThrow();
  });
  it('validates a coupon and recalculates eligibility for changed carts', async () => {
    const offer = await validateOffer({ ...rule, eligibility: 'coupon', code: 'TEST-COUPON' });
    await expect(run({ offerId: rule.id, coupon: 'wrong' }, offer)).rejects.toThrow(/coupon/);
    expect((await run({ offerId: rule.id, coupon: 'test-coupon' }, offer)).discount).toBe(350);
    await expect(
      run({ offerId: rule.id, coupon: 'TEST-COUPON' }, offer, [line('milk')]),
    ).rejects.toThrow(/qualify/);
    await expect(
      run({ offerId: rule.id, coupon: 'TEST-COUPON' }, { ...offer, expires: '2026-02-01' }),
    ).rejects.toThrow(/expired/);
  });
  it('blocks reused and unapproved redemptions', async () => {
    await expect(run({ offerId: rule.id }, rule, cart, true)).rejects.toThrow(/redeemed/);
    const offer = { ...rule, eligibility: 'manager' as const };
    await expect(run({ offerId: rule.id, approvalToken: 'test-token' }, offer)).rejects.toThrow(
      /approval/,
    );
    expect(
      (await run({ offerId: rule.id, approvalToken: 'test-token' }, offer, cart, false, true))
        .discount,
    ).toBe(350);
  });
  it.each(['fixed', 'percent', 'free', 'bogo', 'ultimate'] as const)(
    'enforces configured %s rules',
    async (kind) => {
      const offer = await validateOffer({
        ...rule,
        kind,
        requiredItem: 'chicken',
        amount: kind === 'percent' ? 10 : 100,
      });
      const items = [...cart, line('chicken')];
      expect((await run({ offerId: rule.id }, offer, items)).discount).toBeGreaterThan(0);
      await expect(run({ offerId: rule.id }, offer, [line('milk')])).rejects.toThrow();
    },
  );
  it('rejects undefined eligibility and invalid rules', async () => {
    for (const patch of [
      { eligibility: 'anything' },
      { starts: '' },
      { expires: rule.starts },
      { kind: 'unknown' },
      { minimum: -1 },
      { quantity: 0 },
      { amount: 1.5 },
      { kind: 'percent', amount: 101 },
      { kind: 'free', requiredItem: '' },
    ])
      await expect(validateOffer({ ...rule, ...patch })).rejects.toThrow();
  });
});
