import type { CartLine, MenuItem, Promotion, Quote } from './types';
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export function quote(
  cart: CartLine[],
  menu: MenuItem[],
  promotion: Promotion = 'best',
  revision = 1,
): Quote {
  if (!Array.isArray(cart) || cart.length > 50)
    throw new Error('Please limit your order to 50 lines.');
  const lines = cart.map((line) => {
    const item = menu.find((i) => i.id === line.id);
    if (!item || item.available === false)
      throw new Error('An item is no longer available. Please review your order.');
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20)
      throw new Error('Choose a quantity from 1 to 20.');
    if (typeof line.note !== 'string' || line.note.length > 300 || typeof line.option !== 'string')
      throw new Error('Please keep item notes under 300 characters.');
    if (item.options && !item.options.includes(line.option))
      throw new Error(`Choose an option for ${item.name}.`);
    if (item.category === 'Custom' && !line.note.trim())
      throw new Error('Describe your custom request.');
    return {
      ...line,
      name: item.name,
      price: item.price,
      category: item.category,
      kids: item.kids,
    };
  });
  const units = (category: string) =>
    lines
      .filter((l) => l.category === category && !l.kids && l.price !== null)
      .flatMap((l) => Array(l.quantity).fill(l.price) as number[])
      .sort((a, b) => b - a);
  const bites = units('Bites'),
    mocks = units('Mocktails'),
    desserts = units('Desserts');
  const subtotal = lines.reduce((sum, l) => sum + (l.price ?? 0) * l.quantity, 0);
  const sip = bites
    .slice(0, mocks.length)
    .reduce((sum, price, index) => sum + Math.min(350, price + mocks[index]), 0);
  const bogo = mocks.reduce((sum, price, index) => sum + (index % 2 === 1 ? price : 0), 0);
  const bundleCount = Math.min(
    Math.floor(bites.length / 2),
    Math.floor(mocks.length / 2),
    desserts.length,
  );
  let ultimate = 0;
  for (let i = 0; i < bundleCount; i++)
    ultimate += Math.max(
      0,
      bites[2 * i] + bites[2 * i + 1] + mocks[2 * i] + mocks[2 * i + 1] + desserts[i] - 1000,
    );
  const choices = [
    { id: 'none', name: 'No promotion', value: 0 },
    { id: 'sip', name: 'Sip & Share', value: Math.min(sip, subtotal) },
    { id: 'bogo', name: 'BOGO Mocktails', value: bogo },
    { id: 'ultimate', name: 'The Ultimate $10 Deal', value: ultimate },
  ];
  const selected =
    promotion === 'best'
      ? choices.reduce((a, b) => (b.value > a.value ? b : a))
      : choices.find((c) => c.id === promotion);
  if (!selected) throw new Error('Unknown promotion.');
  return {
    lines,
    subtotal,
    discount: selected.value,
    tax: 0,
    total: subtotal - selected.value,
    pending: lines.some((l) => l.price === null),
    promotion: selected.value ? selected.name : 'No promotion',
    revision,
  };
}
