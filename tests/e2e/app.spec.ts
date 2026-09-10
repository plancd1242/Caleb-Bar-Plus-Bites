import { test, expect, type Page } from '@playwright/test';
const code = 'synthetic-test-only';
async function nav(page: Page, id: string) {
  await page.goto('/#' + id);
  await expect(page.locator('.connection')).toContainText('Connected');
}
async function login(page: Page) {
  await nav(page, 'employee');
  await page.getByLabel('Enter authorization code').fill(code);
  await page.getByRole('button', { name: 'Unlock control center' }).click();
  await expect(page.getByRole('heading', { name: 'Employee control center' })).toBeVisible();
}
async function api(page: Page, path: string, body?: unknown, method?: string) {
  return page.evaluate(
    async ({ path, body, method }) => {
      const r = await fetch('/api' + path, {
        method: method ?? (body === undefined ? 'GET' : 'POST'),
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body, method },
  );
}
async function addAndReview(page: Page) {
  await nav(page, 'order');
  await page.getByRole('button', { name: 'Add Chicken Bites', exact: true }).click();
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Looks good. Continue' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Test Guest');
}

test('welcome, every navigation, images, rapid flip protection and reduced motion', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await nav(page, 'welcome');
  await expect(page.getByRole('heading', { name: /Welcome to/ })).toBeVisible();
  for (const [label, heading] of [
    ['Main Menu', 'Good things on every page.'],
    ['Kids Menu', 'A little menu. A lot of fun.'],
    ['Weather', 'The view looks good on you.'],
    ['Time', ''],
    ['Place Your Order', 'What sounds good?'],
    ['Welcome', 'Welcome to'],
  ]) {
    await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
    if (heading)
      await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible();
  }
  await page.locator('.menu-card').click();
  await expect(page.locator('.menu-face.front img')).toHaveJSProperty('naturalWidth', 1024);
  await expect(page.locator('.menu-face.back img')).toHaveJSProperty('naturalWidth', 1024);
  await page.getByRole('button', { name: /Flip to back/ }).click();
  await expect(page.locator('.menu-flipper')).toHaveClass(/flipped/);
  await expect(page.locator('.flip-button')).toBeDisabled();
  await expect(page.locator('.flip-button')).toBeEnabled();
  await page.getByRole('button', { name: /Flip to front/ }).click();
  await expect(page.locator('.menu-flipper')).not.toHaveClass(/flipped/);
  await expect(page.locator('.flip-button')).toBeEnabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.flip-button').click();
  await expect(page.locator('.menu-flipper')).toHaveCSS('transform', 'none');
  await expect(page.locator('.menu-face.back')).toHaveCSS('opacity', '1');
  await page.getByRole('navigation').getByRole('button', { name: 'Kids Menu' }).click();
  await expect(page.locator('.menu-face img')).toHaveJSProperty('naturalWidth', 1024);
  expect(errors).toEqual([]);
});
test('basket quantities, removal, menu visits, reload and custom options', async ({ page }) => {
  await nav(page, 'order');
  await expect(page.getByText('A little empty. For now.')).toBeVisible();
  await page.getByRole('button', { name: 'Add Chicken Bites', exact: true }).click();
  await page.getByRole('button', { name: 'Increase Chicken Bites' }).click();
  await expect(page.locator('.total')).toContainText('$9.50');
  await page.getByRole('button', { name: 'Decrease Chicken Bites' }).click();
  await expect(page.locator('.total')).toContainText('$4.75');
  await page.getByRole('button', { name: 'Look at the main menu' }).click();
  await page.getByRole('button', { name: 'Let’s order' }).click();
  await expect(page.locator('.basket')).toContainText('Chicken Bites');
  await page.reload();
  await expect(page.locator('.basket')).toContainText('Chicken Bites');
  await page.getByRole('button', { name: 'Decrease Chicken Bites' }).click();
  await expect(page.getByText('A little empty. For now.')).toBeVisible();
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByRole('button', { name: 'Add Custom Bite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
  await page.getByLabel('Describe your request').fill('A little veggie sandwich');
  await page.getByRole('button', { name: 'Add to basket' }).click();
  await expect(page.locator('.basket')).toContainText('Pending');
  await expect(page.locator('.total')).toContainText('Known total');
  await page.getByRole('button', { name: 'Drinks', exact: true }).click();
  await page.getByRole('button', { name: 'Add Iced Tea', exact: true }).click();
  await page.getByLabel('Your choice').selectOption('Unsweet');
  await page.getByRole('button', { name: 'Add to basket' }).click();
  await expect(page.locator('.basket')).toContainText('Unsweet');
});
test('customer submission, duplicate protection, isolated sessions, employee realtime and statuses', async ({
  page,
  browser,
}) => {
  const employee = await browser.newPage();
  await login(employee);
  await addAndReview(page);
  await page.getByLabel('Your name', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Place order', exact: true })).toBeDisabled();
  await page.getByLabel('Your name', { exact: true }).fill('Realtime Guest');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByText('ORDER SENT!', { exact: true })).toBeVisible();
  const orderId = await page.locator('.receipt-summary strong').first().innerText();
  expect(orderId).toMatch(/^BARN-\d+$/);
  await expect(employee.locator('.order-ticket').filter({ hasText: orderId })).toContainText(
    'Realtime Guest',
  );
  const outsider = await browser.newPage();
  await nav(outsider, 'welcome');
  expect((await api(outsider, '/orders')).data).toEqual([]);
  await outsider.close();
  for (const status of ['accepted', 'making', 'ready', 'completed']) {
    await employee
      .locator('.order-ticket')
      .filter({ hasText: orderId })
      .getByRole('button', { name: 'Mark ' + status })
      .click();
    await expect(page.locator('.status-track .done').last()).toContainText(status.toUpperCase());
  }
  await employee.getByRole('button', { name: 'Order History', exact: true }).click();
  await expect(employee.locator('.order-ticket').filter({ hasText: orderId })).toBeVisible();
  await page.reload();
  await expect(page.locator('.receipt-summary')).toContainText(orderId);
  await expect(
    page.getByText('Please give your payment to your waiter.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start another order' }).click();
  await expect(page.getByText('A little empty. For now.')).toBeVisible();
  await employee.close();
});
test('failure preserves basket; lost acknowledgement retries same order only once', async ({
  page,
}) => {
  await addAndReview(page);
  let intercepted = false;
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() === 'POST' && !intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('ORDER SENT!', { exact: true })).toHaveCount(0);
  await expect(page.locator('.basket')).toContainText('Chicken Bites');
  await page.getByRole('button', { name: 'Retry sending order' }).click();
  await expect(page.getByText('ORDER SENT!', { exact: true })).toBeVisible();
  expect((await api(page, '/orders')).data).toHaveLength(1);
});
test('backend unavailable preserves basket and allows checked editing', async ({ page }) => {
  await addAndReview(page);
  await page.route('**/api/orders', (r) => r.abort());
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.basket')).toContainText('Chicken Bites');
  await page.unroute('**/api/orders');
  await page.getByRole('button', { name: 'check before editing' }).click();
  await expect(page.getByRole('button', { name: 'Increase Chicken Bites' })).toBeEnabled();
});
test('auth rejects empty and wrong codes, protects APIs, relocks and hidden hold works', async ({
  page,
}) => {
  await nav(page, 'employee');
  await expect(page.getByRole('button', { name: 'Unlock control center' })).toBeDisabled();
  expect((await api(page, '/settings', { open: false })).status).toBe(401);
  await page.getByLabel('Enter authorization code').fill('wrong-test-code');
  await page.getByRole('button', { name: 'Unlock control center' }).click();
  await expect(page.getByRole('alert')).toContainText('isn’t correct');
  await page.getByLabel('Enter authorization code').fill(code);
  await page.getByRole('button', { name: 'Unlock control center' }).click();
  await expect(page.getByRole('heading', { name: 'Employee control center' })).toBeVisible();
  await page.getByRole('button', { name: 'Relock' }).click();
  await expect(page.getByLabel('Enter authorization code')).toBeVisible();
  expect((await api(page, '/settings', { open: false })).status).toBe(401);
  await page.getByRole('navigation').getByRole('button', { name: 'Welcome', exact: true }).click();
  const logo = page.getByRole('button', { name: 'Hold for employee access' });
  await logo.click();
  await expect(page.getByRole('heading', { name: /Welcome to/ })).toBeVisible();
  await logo.hover();
  await page.mouse.down();
  await page.waitForTimeout(2100);
  await page.mouse.up();
  await expect(page.getByLabel('Enter authorization code')).toBeVisible();
});
test('menu availability, price editing, closed restaurant, custom pricing and settings', async ({
  page,
  browser,
}) => {
  await login(page);
  const customer = await browser.newPage();
  await nav(customer, 'order');
  await page.getByRole('button', { name: 'Menu Manager', exact: true }).click();
  const row = page.locator('.manager-row').filter({ hasText: 'Chicken Bites' });
  await row.getByRole('button', { name: 'Available', exact: true }).click();
  await expect(
    customer.getByRole('button', { name: 'Add Chicken Bites', exact: true }),
  ).toBeDisabled();
  await row.getByRole('button', { name: 'Sold out', exact: true }).click();
  await expect(
    customer.getByRole('button', { name: 'Add Chicken Bites', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Price Manager', exact: true }).click();
  await page.getByLabel('Price for Chicken Bites', { exact: true }).fill('5.25');
  await page
    .locator('.manager-row')
    .filter({ hasText: 'Chicken Bites' })
    .getByRole('button', { name: 'Save', exact: true })
    .click();
  await expect(customer.locator('.item-card').filter({ hasText: 'Chicken Bites' })).toContainText(
    '$5.25',
  );
  await page.getByLabel('Price for Chicken Bites', { exact: true }).fill('4.75');
  await page
    .locator('.manager-row')
    .filter({ hasText: 'Chicken Bites' })
    .getByRole('button', { name: 'Save', exact: true })
    .click();
  await page.getByRole('button', { name: 'Restaurant Open / Closed', exact: true }).click();
  await page.getByRole('button', { name: 'Close restaurant', exact: true }).click();
  await expect(customer.getByText('We’re taking a little break.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Open restaurant', exact: true }).click();
  await customer.getByRole('button', { name: 'Custom', exact: true }).click();
  await customer.getByRole('button', { name: 'Add Custom Bite', exact: true }).click();
  await customer.getByLabel('Describe your request').fill('Custom toast');
  await customer.getByRole('button', { name: 'Add to basket' }).click();
  await customer.getByRole('button', { name: 'Review order', exact: true }).click();
  await customer.getByRole('button', { name: 'Looks good. Continue' }).click();
  await customer.getByLabel('Your name', { exact: true }).fill('Custom Guest');
  await customer.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(customer.getByText('ORDER SENT!', { exact: true })).toBeVisible();
  const id = await customer.locator('.receipt-summary strong').first().innerText();
  await page.getByRole('button', { name: 'Live Orders', exact: true }).click();
  const ticket = page.locator('.order-ticket').filter({ hasText: id });
  await expect(ticket.getByRole('button', { name: 'Mark accepted' })).toBeDisabled();
  await ticket.getByLabel('Price for Custom Bite').fill('3.25');
  await ticket.getByRole('button', { name: 'Confirm price' }).click();
  await expect(customer.locator('.receipt-summary')).toContainText('$3.25');
  await expect(ticket.getByRole('button', { name: 'Mark accepted' })).toBeEnabled();
  for (const tab of ['Station Management', 'Display Settings', 'System Settings']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.locator('.settings-panel')).toBeVisible();
  }
  await customer.close();
});
test('server distrusts client totals, rejects invalid requests and enforces idempotency', async ({
  page,
}) => {
  await nav(page, 'welcome');
  const cart = [{ id: 'milk', quantity: 1, note: '', option: '' }];
  const q = (await api(page, '/quote', { cart, promotion: 'best' })).data;
  const requestId = crypto.randomUUID();
  const body = {
    cart,
    promotion: 'best',
    name: 'API Guest',
    requestId,
    total: q.total,
    revision: q.revision,
  };
  expect((await api(page, '/orders', { ...body, total: 1 })).status).toBe(409);
  expect((await api(page, '/orders', { ...body, name: '' })).status).toBe(400);
  const [a, b] = await Promise.all([api(page, '/orders', body), api(page, '/orders', body)]);
  expect(a.data.id).toBe(b.data.id);
  expect((await api(page, '/orders')).data).toHaveLength(1);
  expect((await api(page, '/quote', { cart: [{ ...cart[0], quantity: 0 }] })).status).toBe(400);
  const csrf = await page.request.post('/api/settings', {
    headers: { Origin: 'https://untrusted.invalid' },
    data: { open: false },
  });
  expect(csrf.status()).toBe(403);
});
test('weather denial, API failure, missing image and optional celebration fallback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) =>
      error?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
  });
  await nav(page, 'weather');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText(/Location access is off/)).toBeVisible();
  expect((await api(page, '/celebration')).data.url).toBeNull();
  await nav(page, 'kids');
  await page
    .locator('.menu-face img')
    .evaluate((img: HTMLImageElement) => (img.src = '/menus/missing-menu.png'));
  await expect(page.getByText(/This menu image couldn’t load/)).toBeVisible();
});
test('weather network failure does not affect ordering', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) =>
      success({
        coords: {
          latitude: 42,
          longitude: -83,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
  });
  await page.route('**/api/weather?**', (r) => r.abort());
  await nav(page, 'weather');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText(/Weather is unavailable/)).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Place Your Order' }).click();
  await expect(page.getByRole('button', { name: 'Add Chicken Bites', exact: true })).toBeEnabled();
});
for (const size of [
  { width: 1366, height: 1024 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
])
  test(`responsive layout ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await nav(page, 'welcome');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/welcome-${size.width}.png`, fullPage: true });
    if (size.width < 901) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('navigation')).toBeInViewport();
    }
    await page.getByRole('navigation').getByRole('button', { name: 'Place Your Order' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Add Chicken Bites', exact: true }).click();
    await page.getByRole('button', { name: 'Review order', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Review order', exact: true })).toBeInViewport();
  });
test('storage unavailable never prevents an acknowledged order', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Quota exceeded');
    };
    Storage.prototype.getItem = () => {
      throw new Error('Storage denied');
    };
    Storage.prototype.removeItem = () => {
      throw new Error('Storage denied');
    };
  });
  await addAndReview(page);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByText('ORDER SENT!', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('corrupt saved drafts and missing optional logo fail gracefully', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('barn-cart', 'broken json');
    localStorage.setItem(
      'barn-checkout',
      JSON.stringify({ name: { bad: true }, promotion: 'invalid', requestId: 17 }),
    );
  });
  await nav(page, 'order');
  await expect(
    page.getByText('A saved draft couldn’t be read. Please check your basket.'),
  ).toBeVisible();
  await expect(page.getByText('A little empty. For now.')).toBeVisible();
  await page
    .locator('.brand img')
    .evaluate((img: HTMLImageElement) => (img.src = '/icons/missing-icon.png'));
  await page.getByRole('button', { name: 'Add Chicken Bites', exact: true }).click();
  await expect(page.locator('.basket')).toContainText('Chicken Bites');
});
test('failed submission survives a full reload and checks receipt before editing', async ({
  page,
}) => {
  await addAndReview(page);
  await page.route('**/api/orders', async (r) =>
    r.request().method() === 'POST' ? r.abort() : r.continue(),
  );
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();
  await expect(page.locator('.basket')).toContainText('Chicken Bites');
  await expect(page.getByRole('button', { name: 'Increase Chicken Bites' })).toBeDisabled();
  await page.unroute('**/api/orders');
  await page.getByRole('button', { name: 'check before editing' }).click();
  await expect(page.getByRole('button', { name: 'Increase Chicken Bites' })).toBeEnabled();
});
test('expired or cleared sessions cannot duplicate or reveal an acknowledged order', async ({
  page,
  context,
}) => {
  await nav(page, 'welcome');
  const cart = [{ id: 'milk', quantity: 1, note: '', option: '' }];
  const q = (await api(page, '/quote', { cart, promotion: 'best' })).data;
  const requestId = crypto.randomUUID();
  const body = {
    cart,
    promotion: 'best',
    name: 'Session Guest',
    requestId,
    total: q.total,
    revision: q.revision,
  };
  const first = await api(page, '/orders', body);
  expect(first.status).toBe(201);
  await context.clearCookies();
  await api(page, '/session');
  expect((await api(page, '/orders', body)).status).toBe(409);
  expect((await api(page, '/recover', { requestId })).status).toBe(409);
  expect((await api(page, '/orders')).data).toEqual([]);
});
test.describe('Installed app cache', () => {
  test.use({ serviceWorkers: 'allow' });
  test('PWA manifest, icon files and Apple metadata', async ({ page, context }) => {
    await nav(page, 'main');
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      const r = await page.request.get(icon.src);
      expect(r.ok()).toBe(true);
      expect(r.headers()['content-type']).toContain('image/png');
    }
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      /\/icons\/apple-touch-icon\.png$/,
    );
  });
  test('service worker cache survives offline reload and reconnects', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Playwright service-worker automation is Chromium-only; test installed iPad Safari manually.',
    );
    await nav(page, 'main');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.menu-face.front img')).toHaveJSProperty('naturalWidth', 1024);
    await expect(page.locator('.connection')).toContainText('Offline');
    await page.getByRole('navigation').getByRole('button', { name: 'Place Your Order' }).click();
    await page.getByRole('button', { name: 'Add Chicken Bites', exact: true }).click();
    await page.reload();
    await expect(page.locator('.basket')).toContainText('Chicken Bites');
    await context.setOffline(false);
    await expect(page.locator('.connection')).toContainText('Connected');
  });
});

test('weather endpoint missing-key response and existing page fallback', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) =>
      success({ coords: { latitude: 42, longitude: -83 } } as GeolocationPosition);
  });
  await nav(page, 'weather');
  const r = await page.request.get('/api/weather?latitude=42&longitude=-83');
  expect(r.status()).toBe(503);
  expect((await r.json()).error).toContain('not configured');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText(/Weather is not configured/)).toBeVisible();
});
test('weather displays adapted data and shows failed refresh instead of stale weather', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) =>
      success({ coords: { latitude: 42, longitude: -83 } } as GeolocationPosition);
  });
  await page.route('**/api/weather?**', (r) =>
    r.fulfill({
      json: {
        location: 'Detroit',
        temperature: 72,
        feelsLike: 74,
        humidity: 60,
        windSpeed: 8,
        condition: 'Clear',
        description: 'clear sky',
        icon: '01d',
      },
    }),
  );
  await nav(page, 'weather');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText('Detroit · Feels like 74°F')).toBeVisible();
  await expect(page.getByText(/Humidity 60% · Wind 8 mph/)).toBeVisible();
  await page.unroute('**/api/weather?**');
  await page.route('**/api/weather?**', (r) =>
    r.fulfill({ status: 502, json: { error: 'The weather request timed out. Please try again.' } }),
  );
  await page.getByRole('button', { name: 'Refresh weather' }).click();
  await expect(page.getByText(/weather request timed out/)).toBeVisible();
  await expect(page.getByText('Detroit · Feels like 74°F')).toHaveCount(0);
});
