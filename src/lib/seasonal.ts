import type { MenuItem } from './types';
// Approved Thanksgiving menu. Legacy draft IDs are retained separately for saved settings/history.
const special = (
  id: string,
  name: string,
  price: number,
  description: string,
  image: string,
  bundle?: MenuItem['bundle'],
): MenuItem => ({
  id,
  name,
  price,
  description,
  image,
  emoji: '',
  category: 'Specials',
  special: true,
  seasonal: true,
  visibility: 'order',
  available: true,
  ...(bundle ? { bundle } : {}),
});
export const approvedSpecials: MenuItem[] = [
  special(
    'harvest-gobble-bites',
    'Gobble Bites',
    400,
    'Six chicken nuggets at our Thanksgiving special price.',
    '/art/specials/nuggets.webp',
  ),
  special(
    'harvest-cheese-bites',
    'Grilled Cheese Bites',
    200,
    'Half a grilled cheese cut into little bite-sized pieces.',
    '/art/specials/cheese-bites.webp',
  ),
  special(
    'harvest-snack-cup',
    'Thankful Snack Cup',
    175,
    'A small popcorn-and-cheddar-square snack mix.',
    '/art/specials/snack-cup.webp',
  ),
  special(
    'harvest-crunch-cup',
    'Harvest Crunch Cup',
    200,
    'Apple slices with cheddar squares on the side.',
    '/art/specials/apples.webp',
  ),
  special(
    'harvest-golden-gobbler',
    'Golden Gobbler',
    375,
    'Pineapple juice, orange juice and ginger beer. Alcohol-free.',
    '/art/specials/golden-gobbler.webp',
  ),
  special(
    'harvest-mini-sparkler',
    'Autumn Mini Sparkler',
    350,
    'A smaller lavender-and-ginger-beer mocktail. Alcohol-free.',
    '/art/specials/mini-sparkler.webp',
  ),
  special(
    'harvest-gobble-sip',
    'Gobble & Sip',
    700,
    'Six Gobble Bites chicken nuggets + one Golden Gobbler mocktail.',
    '/art/specials/gobble-sip.webp',
    [
      { id: 'harvest-gobble-bites', quantity: 1 },
      { id: 'harvest-golden-gobbler', quantity: 1 },
    ],
  ),
  special(
    'harvest-little-combo',
    'Little Thanksgiving Combo',
    500,
    'Grilled Cheese Bites + one Autumn Mini Sparkler.',
    '/art/specials/little-combo.webp',
    [
      { id: 'harvest-cheese-bites', quantity: 1 },
      { id: 'harvest-mini-sparkler', quantity: 1 },
    ],
  ),
  special(
    'harvest-ultimate',
    'ULTIMATE THANKSGIVING DEAL',
    1000,
    'Six chicken nuggets + Grilled Cheese Bites + one Golden Gobbler + a small popcorn.',
    '/art/specials/ultimate.webp',
    [
      { id: 'harvest-gobble-bites', quantity: 1 },
      { id: 'harvest-cheese-bites', quantity: 1 },
      { id: 'harvest-golden-gobbler', quantity: 1 },
      { id: 'popcorn', quantity: 1, label: 'Small popcorn' },
    ],
  ),
];
// New items advertised on the approved Thanksgiving PNGs. Separate kids IDs
// preserve existing kids pricing/promotion exclusions and employee overrides.
export const thanksgivingAdditions: MenuItem[] = [
  [
    'turkey-slider',
    'Turkey Slider',
    475,
    'Bites',
    'Turkey, cheese, and a soft bun.',
    '/art/specials/turkey-slider.webp',
  ],
  [
    'mashed-potato',
    'Mashed Potato Cup',
    375,
    'Bites',
    'Creamy and smooth!',
    '/art/specials/mashed-potato.webp',
  ],
  [
    'butter-corn',
    'Butter Corn Cup',
    300,
    'Bites',
    'Warm and tasty!',
    '/art/specials/butter-corn.webp',
  ],
  [
    'harvest-sparkle',
    'Harvest Sparkle',
    475,
    'Mocktails',
    'Ginger beer, orange syrup and a touch of honey syrup. Alcohol-free.',
    '/art/specials/harvest-sparkle.webp',
  ],
  [
    'pumpkin-pie',
    'Pumpkin Pie Mocktail',
    450,
    'Mocktails',
    'Creamy vanilla and honey syrup with a spiced pumpkin flavor. Alcohol-free.',
    '/art/specials/pumpkin-pie.webp',
  ],
].flatMap(([id, name, price, category, description, image]) => {
  const base: MenuItem = {
    id: 'thanksgiving-new-' + id,
    name: String(name),
    price: Number(price),
    category: category as MenuItem['category'],
    description: String(description),
    image: String(image),
    emoji: '',
    available: true,
    special: true,
    seasonal: true,
    visibility: 'order',
  };
  return [base, { ...base, id: 'kids-' + base.id, kids: true }];
});
// Do not resurrect old unreviewed recipes, or reinterpret any past order IDs.
export const legacySeasonalDrafts: MenuItem[] = [
  ['apple', 'Harvest Apple Fizz', 425],
  ['maple', 'Maple Harvest Sparkler', 450],
  ['cranberry', 'Cranberry Celebration Mocktail', 425],
  ['grilled', 'Thanksgiving Grilled Cheese', 450],
  ['popcorn', 'Harvest Popcorn', 300],
  ['opening', 'Grand Opening Combo', 675],
  ['surprise', 'Thanksgiving Surprise Mocktail', 375],
  ['autumn', 'Autumn Celebration Combo', 750],
].map(([id, name, price]) => ({
  id: 'thanksgiving-' + id,
  name: String(name),
  price: Number(price),
  description: 'Legacy draft — superseded by the approved Thanksgiving menu.',
  emoji: '',
  category: 'Specials',
  special: true,
  seasonal: true,
  visibility: 'order',
  available: false,
  retired: true,
}));
export const seasonalDrafts = [
  ...approvedSpecials,
  ...thanksgivingAdditions,
  ...legacySeasonalDrafts,
];

export const defaultSeasonal = {
  thanksgiving: false,
  decorations: false,
  animations: false,
  turkey: true,
  pumpkins: true,
  leaves: true,
  fallingLeaves: true,
  confetti: true,
  seasonalAnnouncements: true,
  farm: true,
  other: true,
  lightweight: false,
};
export function seasonalSettings(value?: Partial<typeof defaultSeasonal>) {
  return { ...defaultSeasonal, ...value };
}
export const decorationControls = [
  ['thanksgiving', 'Thanksgiving mode'],
  ['decorations', 'Grand opening decorations'],
  ['animations', 'Seasonal animations'],
  ['turkey', 'Thanksgiving turkey decorations'],
  ['pumpkins', 'Pumpkins'],
  ['leaves', 'Autumn leaves'],
  ['fallingLeaves', 'Falling leaf animations'],
  ['confetti', 'Grand opening confetti'],
  ['seasonalAnnouncements', 'Seasonal announcements'],
  ['farm', 'Farm scenery'],
  ['other', 'Other decorative elements'],
  ['lightweight', 'Lightweight graphics mode'],
] as const;
