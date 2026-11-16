import { test, expect, type Page } from '@playwright/test';
import { seasonalSettings } from '../../src/lib/seasonal';
test.use({
  extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.133' },
  viewport: { width: 768, height: 1024 },
  hasTouch: true,
});
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const r = await fetch('/api' + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body },
  );
}
async function login(page: Page) {
  await page.goto('/#employee');
  await expect(page.locator('.connection')).toContainText('Connected');
  await page.getByLabel('Enter authorization code').fill('synthetic-test-only');
  await page.getByRole('button', { name: 'Unlock control center' }).click();
  await expect(page.getByRole('heading', { name: 'Employee control center' })).toBeVisible();
}
test('weather is silent; announcements rotate, pause and lead to seasonal ordering', async ({
  page,
}) => {
  let weather = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/weather')) weather++;
  });
  await page.clock.install();
  await page.goto('/#welcome');
  await expect(page.locator('.connection')).toContainText('Connected');
  const panel = page.getByRole('region', { name: 'Restaurant Announcements', exact: true });
  await expect(panel).toBeVisible();
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Weather', exact: true }),
  ).toHaveCount(0);
  const first = await panel.locator('h2').innerText();
  await panel.getByRole('button', { name: 'Next announcement' }).tap();
  await expect(panel.locator('h2')).not.toHaveText(first);
  await panel.getByRole('button', { name: 'Pause rotation' }).click();
  const paused = await panel.locator('h2').innerText();
  await page.clock.fastForward(9000);
  await expect(panel.locator('h2')).toHaveText(paused);
  await panel.getByRole('button', { name: 'Resume rotation' }).click();
  await page.clock.fastForward(9000);
  await expect(panel.locator('h2')).not.toHaveText(paused);
  await panel.getByRole('button', { name: 'Explore Specials' }).tap();
  await expect(
    page.getByRole('heading', { name: '🦃 Thanksgiving Grand Opening Specials', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Thanksgiving Specials', exact: true }),
  ).toHaveClass(/active/);
  expect(weather).toBe(0);
});
test('announcement drafts publish, sync and persist; staff can edit, order and delete', async ({
  page,
  browser,
}) => {
  await login(page);
  const initial = (await api(page, '/menu')).data.settings;
  const customer = await browser.newPage();
  await customer.goto('/#welcome');
  await expect(customer.locator('.connection')).toContainText('Connected');
  const text = 'Test welcome ' + crypto.randomUUID().slice(0, 6);
  try {
    expect(
      (
        await api(customer, '/settings', {
          announcements: { mode: 'single', items: [] },
          revision: initial.revision,
        })
      ).status,
    ).toBe(401);
    await page.getByRole('button', { name: 'Announcement Manager', exact: true }).click();
    await page.getByRole('button', { name: 'Create announcement', exact: true }).click();
    await page.getByLabel('Announcement text', { exact: true }).fill(text);
    await page.getByLabel('Optional icon', { exact: true }).fill('💚');
    await page.getByLabel('Enabled announcement', { exact: true }).check();
    await page.getByRole('button', { name: 'Save announcement draft' }).click();
    let row = page.locator('.manager-row').filter({ hasText: text });
    for (let i = 0; i < 8; i++)
      await row.getByRole('button', { name: 'Move up ' + text, exact: true }).click();
    await page.getByLabel('Announcement display mode').selectOption('single');
    await page.getByRole('button', { name: 'Preview announcements', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Announcement preview' })).toContainText(text);
    await expect(
      customer.getByRole('region', { name: 'Restaurant Announcements', exact: true }),
    ).not.toContainText(text);
    await page.getByRole('button', { name: 'Publish announcements', exact: true }).click();
    await expect(
      customer.getByRole('region', { name: 'Restaurant Announcements', exact: true }),
    ).toContainText(text);
    await page.reload();
    await page.getByRole('button', { name: 'Announcement Manager', exact: true }).click();
    await expect(page.locator('.manager-row').first()).toContainText(text);
    row = page.locator('.manager-row').filter({ hasText: text });
    await row.getByRole('button', { name: 'Edit announcement', exact: true }).click();
    await page.getByLabel('Announcement text', { exact: true }).fill(text + ' edited');
    await page.getByRole('button', { name: 'Save announcement draft' }).click();
    await page.getByRole('button', { name: 'Publish announcements', exact: true }).click();
    await expect(
      customer.getByRole('region', { name: 'Restaurant Announcements', exact: true }),
    ).toContainText(text + ' edited');
    row = page.locator('.manager-row').filter({ hasText: text });
    await row.getByRole('button', { name: 'Disable', exact: true }).click();
    await page.getByRole('button', { name: 'Publish announcements', exact: true }).click();
    await expect(
      customer.getByRole('region', { name: 'Restaurant Announcements', exact: true }),
    ).not.toContainText(text);
    await row.getByRole('button', { name: 'Delete announcement', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await page.getByRole('button', { name: 'Publish announcements', exact: true }).click();
    await expect(row).toHaveCount(0);
  } finally {
    const current = (await api(page, '/menu')).data.settings;
    await api(page, '/settings', {
      announcements: initial.announcements,
      revision: current.revision,
    });
    await customer.close();
  }
});
test('independent decoration controls and lightweight images', async ({ page, browser }) => {
  await login(page);
  const initial = (await api(page, '/menu')).data.settings;
  const customer = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await customer.goto('/');
  await expect(customer.locator('.connection')).toContainText('Connected');
  try {
    await page.getByRole('button', { name: 'Seasonal Management', exact: true }).click();
    await page.getByLabel('Thanksgiving mode', { exact: true }).check();
    await page.getByLabel('Grand opening decorations', { exact: true }).check();
    await expect(customer.locator('.announcement-turkey')).toBeVisible();
    await customer.locator('.announcement-turkey').scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        customer
          .locator('.announcement-turkey')
          .evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(customer.locator('.hero-art img')).toHaveAttribute(
      'src',
      '/art/farm-illustrated.webp',
    );
    await page.getByLabel('Thanksgiving turkey decorations', { exact: true }).uncheck();
    await expect(customer.locator('.announcement-turkey')).toHaveCount(0);
    await page.getByLabel('Pumpkins', { exact: true }).uncheck();
    await expect(customer.locator('.autumn-decoration')).toHaveCount(0);
    await page.getByLabel('Autumn leaves', { exact: true }).uncheck();
    await expect(customer.locator('.leaf-art')).toHaveCount(0);
    await page.getByLabel('Grand opening confetti', { exact: true }).uncheck();
    await expect(customer.locator('.confetti-art')).toHaveCount(0);
    await page.getByLabel('Farm scenery', { exact: true }).uncheck();
    await expect(customer.locator('.hero-art')).toHaveCount(0);
    await page.getByLabel('Farm scenery', { exact: true }).check();
    await page.getByLabel('Lightweight graphics mode', { exact: true }).check();
    await expect(customer.locator('.hero-art img')).toHaveAttribute('src', '/art/farm.svg');
    await expect(customer.locator('.app-shell')).not.toHaveClass(/seasonal-motion/);
    for (const size of [
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]) {
      await customer.setViewportSize(size);
      expect(
        await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
  } finally {
    await api(page, '/settings', {
      seasonal: seasonalSettings(initial.seasonal),
    });
    await customer.close();
  }
});
