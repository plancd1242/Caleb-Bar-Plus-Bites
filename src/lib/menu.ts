import type { MenuItem, Settings } from './types';
const item = (
  id: string,
  name: string,
  price: number | null,
  category: MenuItem['category'],
  emoji: string,
  description = '',
  extra: Partial<MenuItem> = {},
): MenuItem => ({ id, name, price, category, emoji, description, ...extra });
export const menu: MenuItem[] = [
  item('chicken', 'Chicken Bites', 475, 'Bites', '🍗', 'Crispy, all-white meat bites!'),
  item('mac', 'Mac & Cheese', 425, 'Bites', '🧀', 'Creamy and cheesy!'),
  item('grilled', 'Grilled Cheese', 375, 'Bites', '🥪', 'Warm & toasty!'),
  item('apples', 'Apple Slices', 250, 'Bites', '🍎', 'Fresh & sweet!'),
  item('popcorn', 'Popcorn', 250, 'Bites', '🍿', 'Light, salty and delicious!'),
  item('cheddar', 'Annie’s Cheddar Squares', 250, 'Bites', '🧀', 'Tasty and cheesy!'),
  item('fruit', 'Fresh Fruit Cup', 300, 'Bites', '🍓', 'Colorful cup of fresh fruit!'),
  item('mix', 'Snack Mix', 250, 'Bites', '🥨', 'A tasty mix of your favorites!'),
  item('nachos', 'Apple Nachos', 400, 'Desserts', '🍎', 'Fresh apples with sweet toppings!'),
  item('cookies', 'Cookies', 250, 'Desserts', '🍪', 'Soft, sweet, and delicious!'),
  item('icecream', 'Vanilla Ice Cream', 275, 'Desserts', '🍨', 'Classic and creamy!'),
  item('johnny', 'Johnny Pop', 150, 'Desserts', '🍧', 'A refreshing frozen treat!'),
  item('bar', 'Kirkland Ice Cream Bar', 200, 'Desserts', '🍫', 'Chocolatey and delicious!'),
  item(
    'surprise',
    'Surprise Mocktail',
    250,
    'Mocktails',
    '✨',
    'A mystery drink! Ask what today’s surprise is!',
  ),
  item(
    'sunset',
    'Sunset Splash',
    400,
    'Mocktails',
    '🍹',
    'Orange, pineapple, and grenadine with a splash of sparkling water',
  ),
  item('sparkle', 'SparkleTail', 400, 'Mocktails', '💜', 'Sparkling water with lavender syrup'),
  item(
    'sparkle2',
    'SparkleTail 2.0',
    475,
    'Mocktails',
    '🫧',
    'Sparkling water with lavender syrup and ginger beer',
  ),
  item(
    'tropical',
    'Tropical Punch',
    425,
    'Mocktails',
    '🍍',
    'Pineapple, orange, mango and a splash of grenadine',
  ),
  item(
    'strawberry',
    'Strawberry Fizz',
    425,
    'Mocktails',
    '🍓',
    'Lemonade, strawberry syrup, sparkling water',
  ),
  item(
    'blue',
    'Blue Lagoon Fizz',
    425,
    'Mocktails',
    '🧊',
    'Lemonade, blue raspberry syrup, lemon-lime soda',
  ),
  item(
    'cherry',
    'Cherry Pop',
    400,
    'Mocktails',
    '🍒',
    'Lemon-lime soda, cherry syrup, cherry juice, lime juice',
  ),
  item('tea', 'Iced Tea', 250, 'Drinks', '🧋', 'Freshly brewed!', {
    options: ['Sweet', 'Unsweet'],
  }),
  item('lemonade', 'Lemonade', 250, 'Drinks', '🍋', 'Classic and refreshing!'),
  item('milk', 'Milk', 200, 'Drinks', '🥛'),
  item('sprite', 'Sprite', 200, 'Drinks', '🥤'),
  item('coke', 'Coke', 200, 'Drinks', '🥤'),
  item('diet', 'Diet Coke', 200, 'Drinks', '🥤'),
  item('water', 'Bottled Water', 150, 'Drinks', '💧'),
  item(
    'chef',
    'Chef CJ’s Special',
    400,
    'Specials',
    '👨‍🍳',
    'A special creation from Chef/Bartender CJ! Ingredients UNKNOWN — ask before ordering.',
  ),
  item(
    'custom-mocktail',
    'Make Your Own Mocktail',
    350,
    'Custom',
    '🍹',
    'Choose your flavors and we’ll make it!',
  ),
  item(
    'custom-bite',
    'Custom Bite',
    null,
    'Custom',
    '🍽️',
    'Tell us your request. An employee will confirm availability and price.',
  ),
  ...[
    ['nuggets', 'Chicken Nuggets', 475, '🍗', 'Crispy organic chicken nuggets'],
    ['mac', 'Mac & Cheese', 425, '🧀', 'Creamy and cheesy!'],
    ['grilled', 'Grilled Cheese', 375, '🥪', 'Warm & toasty!'],
    ['apples', 'Apple Slices', 250, '🍎', 'Fresh & sweet!'],
    ['fruit', 'Fruit Cup', 300, '🍓', 'Colorful cup of fresh fruit!'],
  ].map(([id, name, price, emoji, description]) =>
    item('kids-' + id, String(name), Number(price), 'Bites', String(emoji), String(description), {
      kids: true,
    }),
  ),
  item('kids-drink', 'Milk or Lemonade', 200, 'Drinks', '🍋', 'Your choice!', {
    kids: true,
    options: ['Milk', 'Lemonade'],
  }),
  ...['sparkle', 'sparkle2', 'strawberry', 'blue', 'cherry'].map((id) => ({ id })),
].filter((x): x is MenuItem => 'name' in x);
for (const id of ['sparkle', 'sparkle2', 'strawberry', 'blue', 'cherry']) {
  const original = menu.find((i) => i.id === id)!;
  menu.push({ ...original, id: 'kids-' + id, kids: true });
}
menu.push(
  item(
    'kids-food',
    'Anything Else',
    null,
    'Custom',
    '⭐',
    'A special food request. An employee will confirm the price.',
    { kids: true },
  ),
  item(
    'kids-custom',
    'Special Mocktail Request',
    null,
    'Custom',
    '🌈',
    'A custom mocktail, made for you. Price confirmed by an employee.',
    { kids: true },
  ),
);
export const defaultSettings: Settings = {
  open: true,
  revision: 1,
  overrides: {},
  promotions: true,
};
export function currentMenu(settings: Settings) {
  return menu.map((i) => ({
    ...i,
    available: true,
    ...settings.overrides[i.id],
    price: i.price === null ? null : (settings.overrides[i.id]?.price ?? i.price),
  }));
}
