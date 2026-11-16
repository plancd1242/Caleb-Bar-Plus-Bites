import { test, expect, type Page } from '@playwright/test';

// Isolate this suite's login throttle bucket from the existing auth tests.
// Wrangler is local; production Cloudflare supplies this header itself.
test.use({
  extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.24' },
  viewport: { width: 1024, height: 768 },
});

async function api(page: Page, body?: unknown, path = '/settings') {
  return page.evaluate(
    async ({ body, path }) => {
      const r = await fetch('/api' + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    },
    { body, path },
  );
}

test('staff creates two specials, edits and syncs them, protects carts and preserves order history', async ({
  page,
  browser,
}) => {
  await page.goto('/#employee');
  await expect(page.locator('.connection')).toContainText('Connected');
  await page.getByLabel('Enter authorization code').fill('synthetic-test-only');
  await page.getByRole('button', { name: 'Unlock control center' }).click();
  await page.getByRole('button', { name: 'Menu Manager', exact: true }).click();
  const customer = await browser.newPage();
  await customer.goto('/#main');
  await expect(customer.locator('.connection')).toContainText('Connected');
  const suffix = crypto.randomUUID().slice(0, 6);
  const names = [`Test Special A ${suffix}`, `Test Special B ${suffix}`];
  const ids: string[] = [];
  try {
    for (const [index, name] of names.entries()) {
      await page.getByRole('button', { name: 'Add menu item', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Add menu item', exact: true });
      await dialog.getByLabel('Item name', { exact: true }).fill(name);
      await dialog.getByLabel('Description / ingredients').fill('Test ingredients only');
      await dialog
        .getByLabel('Category', { exact: true })
        .selectOption(index ? 'Mocktails' : 'Bites');
      await dialog.getByLabel('Price ($)', { exact: true }).fill(index ? '4.25' : '6.25');
      await dialog.getByLabel('Mark as a Special').check();
      await dialog.getByLabel('Enabled on customer menu').check();
      expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      await dialog.getByRole('button', { name: 'Save menu item' }).click();
      await expect(dialog).toHaveCount(0);
      const result = await api(page, undefined, '/menu');
      ids.push(result.data.menu.find((i: { name: string }) => i.name === name).id);
      await expect(
        customer
          .getByRole('region', { name: 'Specials', exact: true })
          .getByRole('heading', { name, exact: true }),
      ).toBeVisible();
    }
    // A fresh browser session obtains the saved catalog from the backend.
    const fresh = await browser.newPage();
    await fresh.goto('/#main');
    await expect(fresh.getByRole('heading', { name: names[1], exact: true })).toBeVisible();
    await fresh.close();
    await page.reload();
    await page.getByRole('button', { name: 'Menu Manager', exact: true }).click();
    const row = page.locator('.manager-row').filter({ hasText: names[0] });
    await customer.getByRole('button', { name: 'Order ' + names[0], exact: true }).click();
    await expect(customer.locator('.basket')).toContainText(names[0]);
    await customer.getByRole('button', { name: 'Review order', exact: true }).click();
    await customer.getByRole('button', { name: 'Looks good. Continue' }).click();
    await customer.getByLabel('Your name', { exact: true }).fill('Specials Test Guest');
    const cart = [{ id: ids[0], quantity: 1, note: '', option: '' }];
    const oldQuote = (await api(customer, { cart, promotion: 'best' }, '/quote')).data;
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit menu item' });
    await editor.getByLabel('Price ($)', { exact: true }).fill('7.25');
    await editor.getByLabel('Description / ingredients').fill('Revised test ingredients');
    await editor.getByRole('button', { name: 'Save menu item' }).click();
    await expect(editor).toHaveCount(0);
    await expect(customer.getByRole('button', { name: 'Place order', exact: true })).toBeDisabled();
    expect(
      (
        await api(
          customer,
          {
            cart,
            name: 'Stale Guest',
            promotion: 'best',
            requestId: crypto.randomUUID(),
            total: oldQuote.total,
            revision: oldQuote.revision,
          },
          '/orders',
        )
      ).status,
    ).toBe(409);
    await customer.getByRole('button', { name: 'Review updated basket' }).click();
    await expect(customer.locator('.basket')).toContainText('$7.25');
    await row.getByRole('button', { name: 'Available', exact: true }).click();
    await expect(
      customer.getByRole('button', { name: 'Add ' + names[0], exact: true }),
    ).toHaveCount(0);
    await expect(
      customer.getByRole('button', { name: 'Review order', exact: true }),
    ).toBeDisabled();
    expect((await api(customer, { cart, promotion: 'best' }, '/quote')).status).toBe(400);
    await row.getByRole('button', { name: 'Sold out', exact: true }).click();
    await expect(customer.getByRole('button', { name: 'Review order', exact: true })).toBeEnabled();
    await customer.getByRole('button', { name: 'Review order', exact: true }).click();
    await customer.getByRole('button', { name: 'Looks good. Continue' }).click();
    await customer.getByRole('button', { name: 'Place order', exact: true }).click();
    await expect(customer.getByText('✓ Order Submitted!', { exact: true })).toBeVisible();
    const receipt = (await api(customer, undefined, '/orders')).data[0];
    expect(receipt.total).toBe(725);
    for (const body of [
      { createItem: { name: 'Forbidden' } },
      { item: { id: ids[0], price: 100 } },
      { removeItem: ids[0] },
    ])
      expect((await api(customer, body)).status).toBe(401);
    expect((await api(page, { item: { id: ids[0], price: 1.5 } })).status).toBe(400);
    expect((await api(page, { revision: 0, item: { id: ids[0], price: 800 } })).status).toBe(409);
    await row.getByRole('button', { name: 'Remove', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Remove menu item' })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm removal' }).click();
    await expect(row).toHaveCount(0);
    const saved = (await api(customer, undefined, '/orders')).data.find(
      (o: { id: string }) => o.id === receipt.id,
    );
    expect(saved.lines).toEqual(receipt.lines);
    expect(saved.total).toBe(725);
    expect((await api(customer, { cart, promotion: 'best' }, '/quote')).status).toBe(400);
  } finally {
    for (const id of ids) await api(page, { removeItem: id });
    await customer.close();
  }
});
