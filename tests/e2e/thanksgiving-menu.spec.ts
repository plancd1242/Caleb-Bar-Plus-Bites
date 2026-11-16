import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true });
test('approved specials are visible, distinct photos load, names fit and deals order normally', async ({
  page,
}, testInfo) => {
  await page.goto('/#order');
  await expect(page.locator('.connection')).toContainText('Connected');
  await page.getByRole('button', { name: 'Thanksgiving Specials', exact: true }).tap();
  for (const name of [
    'Gobble Bites',
    'Grilled Cheese Bites',
    'Thankful Snack Cup',
    'Harvest Crunch Cup',
    'Golden Gobbler',
    'Autumn Mini Sparkler',
    'Gobble & Sip',
    'Little Thanksgiving Combo',
    'ULTIMATE THANKSGIVING DEAL',
  ]) {
    const card = page
      .locator('.item-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await expect
      .poll(() => card.locator('img').evaluate((n) => (n as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    expect(
      await card
        .locator('h3')
        .evaluate((n) => n.scrollWidth <= n.clientWidth && n.scrollHeight <= n.clientHeight + 1),
    ).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('approved-specials.png'), fullPage: true });
  await expect(
    page.locator('.item-card').filter({ hasText: 'Grilled Cheese Bites' }).first(),
  ).toContainText('little bite-sized pieces');
  await page.getByRole('button', { name: 'Add Gobble & Sip', exact: true }).tap();
  await expect(page.locator('.basket .total')).toContainText('$7.00');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Looks good. Continue' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Thanksgiving Guest');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByText('✓ Order Submitted!', { exact: true })).toBeVisible();
  await expect(page.locator('.receipt-summary')).toContainText('$7.00');
  await page.goto('/#main');
  await expect(
    page.getByRole('heading', { name: 'Grilled Cheese Bites', exact: true }),
  ).toHaveCount(0);
});
