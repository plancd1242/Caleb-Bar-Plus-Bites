import { currentMenu } from './menu';
import type { Category, MenuItem, Settings } from './types';

export const categories: Category[] = [
  'Bites',
  'Mocktails',
  'Desserts',
  'Drinks',
  'Specials',
  'Custom',
];
type Fields = Partial<
  Pick<
    MenuItem,
    | 'name'
    | 'description'
    | 'category'
    | 'price'
    | 'special'
    | 'available'
    | 'seasonal'
    | 'visibility'
  >
>;

function fields(value: unknown, creating: boolean, existing?: MenuItem): Fields {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Menu item required.');
  const input = value as Record<string, unknown>;
  const result: Fields = {};
  if (existing?.retired && input.available === true)
    throw new Error(
      'This legacy draft is retired. Use the approved Thanksgiving specials instead.',
    );
  for (const key of ['name', 'description'] as const) {
    if (creating || input[key] !== undefined) {
      const text = input[key];
      if (
        typeof text !== 'string' ||
        (key === 'name' && !text.trim()) ||
        text.length > (key === 'name' ? 80 : 500)
      )
        throw new Error(
          'Enter a name (up to 80 characters) and description (up to 500 characters).',
        );
      result[key] = text.trim();
    }
  }
  if (creating || input.category !== undefined) {
    if (!categories.includes(input.category as Category))
      throw new Error('Choose a valid category.');
    result.category = input.category as Category;
    if (existing?.price === null && result.category !== 'Custom')
      throw new Error('Employee-priced requests must stay in Custom.');
  }
  if (creating || input.price !== undefined) {
    if (existing?.price === null)
      throw new Error('Custom requests require individual employee quotes.');
    if (!Number.isInteger(input.price) || Number(input.price) < 50 || Number(input.price) > 100000)
      throw new Error('Price must be between $0.50 and $1,000.00 in whole cents.');
    result.price = Number(input.price);
  }
  for (const key of ['special', 'available', 'seasonal'] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean')
        throw new Error('Special and availability must be on or off.');
      result[key] = input[key];
    }
  }
  if (input.visibility !== undefined) {
    if (!['order', 'menu', 'both'].includes(String(input.visibility)))
      throw new Error('Choose a valid display location.');
    result.visibility = input.visibility as MenuItem['visibility'];
  }
  return result;
}

// Called only behind the Worker's employee authorization check. Existing order
// snapshots are never edited; removed catalog IDs are never reused.
export function changeMenu(settings: Settings, body: Record<string, unknown>) {
  if ([body.createItem, body.item, body.removeItem].filter((v) => v !== undefined).length !== 1)
    throw new Error('Send one menu change at a time.');
  if (body.createItem !== undefined) {
    const input = fields(body.createItem, true);
    const item: MenuItem = {
      id: 'staff-' + crypto.randomUUID(),
      emoji: '🍽️',
      available: false,
      special: false,
      ...input,
      name: input.name!,
      description: input.description!,
      category: input.category!,
      price: input.price!,
    };
    settings.additions = [...(settings.additions ?? []), item];
    return;
  }
  const id = body.removeItem ?? (body.item as Record<string, unknown> | undefined)?.id;
  const item = currentMenu(settings).find((i) => i.id === id);
  if (!item) throw new Error('Unknown menu item.');
  if (body.removeItem !== undefined) {
    settings.removed = [...(settings.removed ?? []), item.id];
    settings.additions = settings.additions?.filter((i) => i.id !== item.id);
    delete settings.overrides[item.id];
  } else {
    settings.overrides[item.id] = {
      ...settings.overrides[item.id],
      ...fields(body.item, false, item),
    };
  }
}
