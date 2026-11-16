import { quote } from '../src/lib/pricing';
import type { CartLine, MenuItem, Offer, Quote, Settings } from '../src/lib/types';
export async function hashCode(code: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code.trim().toUpperCase()),
  );
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function validateOffer(input: unknown, previous?: Offer): Promise<Offer> {
  if (!input || typeof input !== 'object') throw new Error('Offer required.');
  const v = input as Offer & { code?: string };
  if (
    !/^[a-z0-9-]{1,60}$/.test(v.id) ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    v.name.length > 80
  )
    throw new Error('Valid offer ID and name required.');
  if (
    !['sip', 'bogo', 'ultimate', 'fixed', 'percent', 'free'].includes(v.kind) ||
    !['cart', 'coupon', 'manager', 'member'].includes(v.eligibility) ||
    typeof v.enabled !== 'boolean'
  )
    throw new Error('Unsupported offer rules.');
  if (
    !Number.isFinite(Date.parse(v.starts)) ||
    !Number.isFinite(Date.parse(v.expires)) ||
    Date.parse(v.expires) <= Date.parse(v.starts)
  )
    throw new Error('Choose a start and a later expiration date.');
  for (const [key, min, max] of [
    ['minimum', 0, 100000],
    ['quantity', 1, 20],
    ['amount', 0, 100000],
    ['limit', 1, 100000],
  ] as const) {
    if (!Number.isInteger(v[key]) || v[key] < min || v[key] > max)
      throw new Error('Invalid offer limits or amounts.');
  }
  if (v.kind === 'percent' && v.amount > 100) throw new Error('Percentage cannot exceed 100.');
  if (
    typeof v.requiredItem !== 'string' ||
    v.requiredItem.length > 100 ||
    ((v.kind === 'free' || ['fixed', 'percent'].includes(v.kind)) && !v.requiredItem)
  )
    throw new Error('Choose the qualifying item for this offer.');
  if (
    v.code !== undefined &&
    (typeof v.code !== 'string' || v.code.length < 4 || v.code.length > 100)
  )
    throw new Error('Coupon needs 4–100 characters.');
  const couponHash = v.code ? await hashCode(v.code) : previous?.couponHash;
  if (v.eligibility === 'coupon' && !couponHash) throw new Error('Set a coupon code.');
  return {
    id: v.id,
    name: v.name.trim(),
    enabled: v.enabled,
    kind: v.kind,
    eligibility: v.eligibility,
    starts: v.starts,
    expires: v.expires,
    minimum: v.minimum,
    requiredItem: v.requiredItem,
    quantity: v.quantity,
    amount: v.amount,
    limit: v.limit,
    couponHash,
  };
}
export async function verifiedQuote(
  cart: CartLine[],
  menu: MenuItem[],
  settings: Settings,
  input: Record<string, unknown>,
  used: (id: string) => boolean,
  approved: (id: string, token: string) => boolean,
  now = Date.now(),
): Promise<Quote> {
  if (
    [
      'discount',
      'discountAmount',
      'credit',
      'percentage',
      'member',
      'membership',
      'promotions',
    ].some((key) => key in input)
  )
    throw new Error(
      'Discount amounts, stacking and membership claims cannot be supplied by customers.',
    );
  const result = quote(cart, menu, 'none', settings.revision);
  if (input.promotion !== undefined && !['none', 'best'].includes(String(input.promotion)))
    throw new Error('Select a configured offer; customer-supplied promotions are not accepted.');
  if (!input.offerId) {
    if (input.coupon || input.approvalToken)
      throw new Error('Choose an offer before entering a coupon or approval.');
    return result;
  }
  if (cart.some((line) => menu.find((i) => i.id === line.id)?.bundle))
    throw new Error('Thanksgiving deal products cannot be stacked with another promotional offer.');
  const offer = settings.offers?.find((o) => o.id === input.offerId);
  if (
    !settings.promotions ||
    !offer?.enabled ||
    now < Date.parse(offer.starts) ||
    now >= Date.parse(offer.expires)
  )
    throw new Error('This offer is unavailable or expired.');
  if (used(offer.id)) throw new Error('This offer has already been redeemed or reached its limit.');
  if (offer.eligibility === 'member')
    throw new Error('Verified membership is not configured. This offer is unavailable.');
  if (
    offer.eligibility === 'coupon' &&
    (typeof input.coupon !== 'string' ||
      input.coupon.length > 100 ||
      (await hashCode(input.coupon)) !== offer.couponHash)
  )
    throw new Error('Invalid coupon code.');
  if (
    offer.eligibility === 'manager' &&
    (typeof input.approvalToken !== 'string' || !approved(offer.id, input.approvalToken))
  )
    throw new Error('Valid manager approval is required.');
  const eligible = result.lines.filter((l) => l.id === offer.requiredItem && l.price !== null);
  if (
    result.subtotal < offer.minimum ||
    (offer.requiredItem && eligible.reduce((n, l) => n + l.quantity, 0) < offer.quantity)
  )
    throw new Error('Your cart does not qualify for this offer.');
  let discount = 0;
  if (['sip', 'bogo', 'ultimate'].includes(offer.kind))
    discount = quote(cart, menu, offer.kind as 'sip' | 'bogo' | 'ultimate').discount;
  else if (offer.kind === 'fixed') discount = Math.min(offer.amount, result.subtotal);
  else if (offer.kind === 'percent') discount = Math.floor((result.subtotal * offer.amount) / 100);
  else discount = Math.min(...eligible.map((l) => l.price!)) * offer.quantity;
  if (!Number.isFinite(discount) || discount <= 0)
    throw new Error('Your cart does not qualify for this offer.');
  return {
    ...result,
    discount,
    total: result.subtotal - discount,
    promotion: offer.name,
    offerId: offer.id,
    ...(offer.eligibility === 'coupon'
      ? { coupon: '••••' + String(input.coupon).trim().slice(-4) }
      : {}),
  };
}
