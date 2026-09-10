import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import './icons.mjs';
// Clearly marked replacements, not claimed to be the user's original artwork.
for (const [name, title, sections] of [
  [
    'main-menu-front',
    'MAIN MENU',
    [
      [
        'TASTY BITES',
        'Chicken Bites  ·  $4.75',
        'Mac & Cheese  ·  $4.25',
        'Grilled Cheese  ·  $3.75',
        'Apple Slices / Popcorn  ·  $2.50',
        'Annie’s Cheddar Squares  ·  $2.50',
        'Fresh Fruit Cup  ·  $3.00',
        'Snack Mix  ·  $2.50',
      ],
      [
        'MOCKTAILS · ALCOHOL-FREE',
        'Surprise Mocktail  ·  $2.50',
        'Sunset Splash / SparkleTail  ·  $4.00',
        'SparkleTail 2.0  ·  $4.75',
        'Tropical Punch / Strawberry Fizz  ·  $4.25',
        'Blue Lagoon Fizz  ·  $4.25',
        'Cherry Pop  ·  $4.00',
      ],
      [
        'DESSERTS & DRINKS',
        'Apple Nachos $4.00 · Cookies $2.50',
        'Vanilla Ice Cream $2.75 · Johnny Pop $1.50',
        'Kirkland Ice Cream Bar $2.00',
        'Iced Tea / Lemonade $2.50',
        'Milk / Sprite / Coke / Diet Coke $2.00',
        'Bottled Water $1.50',
      ],
    ],
  ],
  [
    'main-menu-back',
    'FIND YOUR FAVORITES',
    [
      [
        'CJ’S PICKS',
        'Sunset Splash · SparkleTail · Tropical Punch',
        'Chicken Bites · Popcorn · Fresh Fruit Cup',
        'Apple Nachos · Cookies',
        'Iced Tea · Sprite',
      ],
      [
        'SOMETHING SPECIAL',
        'Sip & Share · bite + mocktail, save $3.50',
        'BOGO Mocktails · equal or lesser value free',
        'Ultimate Deal · 2 mocktails + 2 bites',
        '+ 1 dessert = $10.00',
        'One promotion per order.',
      ],
      [
        'MADE FOR YOU',
        'Make Your Own Mocktail · $3.50',
        'Custom Bite · employee confirms price',
        'Chef CJ’s Special · $4.00',
        'Ingredients UNKNOWN — please ask!',
      ],
    ],
  ],
  [
    'kids-menu',
    'KIDS MENU',
    [
      [
        'TASTY BITES',
        'Chicken Nuggets  ·  $4.75',
        'Mac & Cheese  ·  $4.25',
        'Grilled Cheese  ·  $3.75',
        'Apple Slices  ·  $2.50',
        'Fruit Cup  ·  $3.00',
        'Milk or Lemonade  ·  $2.00',
      ],
      [
        'MOCKTAILS · ALCOHOL-FREE',
        'SparkleTail  ·  $4.00',
        'SparkleTail 2.0  ·  $4.75',
        'Strawberry Fizz  ·  $4.25',
        'Blue Lagoon Fizz  ·  $4.25',
        'Cherry Pop  ·  $4.00',
      ],
      [
        'BE AWESOME!',
        'Tina and Liza are sisters.',
        'Tina is very chill. Liza is full of energy!',
        'Special food and mocktail requests welcome.',
        'An employee will confirm your price.',
      ],
    ],
  ],
]) {
  const esc = (s) => s.replaceAll('&', '&amp;');
  let y = 310;
  let text = '';
  for (const section of sections) {
    text += `<text x="85" y="${y}" font-size="29" font-weight="bold" fill="#b16443">${esc(section[0])}</text>`;
    y += 51;
    for (const row of section.slice(1)) {
      text += `<text x="85" y="${y}" font-size="24">${esc(row)}</text>`;
      y += 43;
    }
    y += 40;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500"><rect width="1000" height="1500" fill="#244e3e"/><rect x="30" y="30" width="940" height="1440" rx="26" fill="#f9f1df" stroke="#b58b59" stroke-width="12"/><g fill="#234d3c" font-family="Arial,sans-serif"><text x="500" y="130" font-size="64" font-weight="bold" text-anchor="middle">Caleb’s Bar + Bites</text><text x="500" y="200" font-size="36" text-anchor="middle">${title}</text><path d="M85 240h830" stroke="#b58b59"/>${text}<text x="500" y="1400" text-anchor="middle" font-size="20">PLACEHOLDER · Replace with your original menu artwork</text><text x="500" y="1440" text-anchor="middle" font-size="18">Good food. Great drinks. Brighter days.</text></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`static/menus/${name}.png`);
}
await writeFile(
  'static/manifest.webmanifest',
  JSON.stringify(
    {
      id: '/',
      name: 'Caleb Bar + Bites',
      short_name: 'Caleb’s',
      description: 'Good food. Great drinks. Brighter days.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#f6f5ee',
      theme_color: '#183e35',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
      ],
    },
    null,
    2,
  ),
);
