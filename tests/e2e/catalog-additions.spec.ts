import { test, expect } from '@playwright/test';
test.use({
  extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.201' },
  viewport: { width: 768, height: 1024 },
  hasTouch: true,
});
test('new Thanksgiving dishes and mocktails order from kids menu and remain staff-editable', async ({
  page,
  browser,
}) => {
  await page.goto('/#order');
  await expect(page.locator('.connection')).toContainText('Connected');
  await page.getByRole('button', { name: 'Kids menu 🐾', exact: true }).tap();
  await page.getByRole('button', { name: 'Thanksgiving Specials', exact: true }).tap();
  for (const name of [
    'Turkey Slider',
    'Mashed Potato Cup',
    'Butter Corn Cup',
    'Harvest Sparkle',
    'Pumpkin Pie Mocktail',
  ]) {
    const card = page
      .locator('.item-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await card.scrollIntoViewIfNeeded();
    await expect
      .poll(() => card.locator('img').evaluate((n) => (n as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await card.getByRole('button', { name: 'Add ' + name, exact: true }).tap();
  }
  await expect(page.locator('.basket .total')).toContainText('$20.75');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Looks good. Continue' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Kids Thanksgiving Test');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByText('✓ Order Submitted!', { exact: true })).toBeVisible();
  await expect(page.locator('.receipt-summary')).toContainText('$20.75');
  const employee = await browser.newPage({
    extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.201' },
  });
  await employee.goto('/#employee');
  await expect(employee.locator('.connection')).toContainText('Connected');
  await employee.getByLabel('Enter authorization code').fill('synthetic-test-only');
  await employee.getByRole('button', { name: 'Unlock control center' }).click();
  await employee.getByRole('button', { name: 'Menu Manager', exact: true }).click();
  const row = employee
    .locator('.manager-row')
    .filter({ hasText: 'Turkey Slider' })
    .filter({ hasText: 'Kids menu' });
  try {
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = employee.getByRole('dialog', { name: 'Edit menu item' });
    await dialog
      .getByLabel('Description / ingredients')
      .fill('Turkey, cheese, and a soft bun. Test edit.');
    await dialog.getByLabel('Price ($)', { exact: true }).fill('4.50');
    await dialog.getByRole('button', { name: 'Save menu item' }).click();
    await expect(dialog).toHaveCount(0);
    await employee.reload();
    await employee.getByRole('button', { name: 'Menu Manager', exact: true }).click();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(employee.getByLabel('Price ($)', { exact: true })).toHaveValue('4.50');
    await employee.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto('/#welcome');
    await expect(page.getByRole('note')).toContainText('Cherry Pop is made without lime juice');
  } finally {
    await employee.evaluate(async () => {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            id: 'kids-thanksgiving-new-turkey-slider',
            price: 475,
            description: 'Turkey, cheese, and a soft bun.',
          },
        }),
      });
    });
    await employee.close();
  }
});
test('Fruit Sorbet replaces the bar in actual dessert checkout', async ({ page }) => {
  await page.goto('/#order');
  await expect(page.locator('.connection')).toContainText('Connected');
  await page.getByRole('button', { name: 'Desserts', exact: true }).tap();
  await expect(
    page.getByRole('button', { name: 'Add Kirkland Ice Cream Bar', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Fruit Sorbet', exact: true }).tap();
  await expect(page.locator('.basket .total')).toContainText('$2.00');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Looks good. Continue' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Sorbet Test');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByText('✓ Order Submitted!', { exact: true })).toBeVisible();
  await expect(page.locator('.receipt-summary')).toContainText('$2.00');
});
