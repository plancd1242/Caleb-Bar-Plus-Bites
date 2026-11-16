import { test, expect, type Page } from '@playwright/test';
test.use({
  extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.90' },
  hasTouch: true,
  viewport: { width: 768, height: 1024 },
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
test('touch additions confirm for one second and rapid taps add exact quantities', async ({
  page,
}) => {
  await page.goto('/#order');
  await expect(page.locator('.connection')).toContainText('Connected');
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const add = page.getByRole('button', { name: 'Add Chicken Bites', exact: true });
  await add.tap();
  await expect(page.getByText('✓ Ordered!', { exact: true })).toHaveCount(1);
  await page.clock.runFor(999);
  await expect(page.getByText('✓ Ordered!', { exact: true })).toHaveCount(1);
  await page.clock.runFor(1);
  await expect(page.getByText('✓ Ordered!', { exact: true })).toHaveCount(0);
  await add.evaluate((button) => {
    for (let i = 0; i < 4; i++) (button as HTMLButtonElement).click();
  });
  await expect(page.locator('.basket-title')).toContainText('5');
  await expect(page.locator('.basket .total')).toContainText('$23.75');
  await expect(page.getByText('✓ Ordered!', { exact: true })).toHaveCount(4);
  await page.clock.runFor(1000);
  await expect(page.getByText('✓ Ordered!', { exact: true })).toHaveCount(0);
  // Reaching the existing quantity cap must not produce a success popup.
  await add.evaluate((button) => {
    for (let i = 0; i < 16; i++) (button as HTMLButtonElement).click();
  });
  await expect(page.locator('.basket-title')).toContainText('20');
  await expect(page.getByText('✓ Ordered!', { exact: true })).toHaveCount(15);
});
test('seasonal drafts, display control, themes and farm branding', async ({ page, browser }) => {
  await login(page);
  const customer = await browser.newPage({
    hasTouch: true,
    viewport: { width: 1024, height: 768 },
  });
  await customer.goto('/#welcome');
  await expect(customer.locator('.connection')).toContainText('Connected');
  await expect(customer.getByText('Life by the Farm')).toBeVisible();
  await expect(customer.locator('.hero-art img')).toHaveAttribute(
    'src',
    '/art/farm-illustrated.webp',
  );
  await page.getByRole('button', { name: 'Seasonal Management', exact: true }).click();
  await expect(page.locator('.manager-row')).toHaveCount(19);
  const row = page.locator('.manager-row').filter({ hasText: 'Harvest Crunch Cup' });
  try {
    await page.getByLabel('Thanksgiving mode', { exact: true }).check();
    await page.getByLabel('Grand opening decorations', { exact: true }).check();
    await page.getByLabel('Seasonal animations', { exact: true }).check();
    await expect(
      customer.getByText('🎉 GRAND OPENING — NOVEMBER 26, 2026', { exact: true }),
    ).toBeVisible();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit menu item' });
    await editor
      .getByLabel('Description / ingredients')
      .fill('Test recipe confirmed in isolated test only');
    await editor.getByLabel('Enabled on customer menu').check();
    await editor.getByRole('button', { name: 'Save menu item' }).click();
    await expect(editor).toHaveCount(0);
    await customer.goto('/#main');
    await expect(
      customer.getByRole('heading', { name: 'Harvest Crunch Cup', exact: true }),
    ).toHaveCount(0);
    await customer.goto('/#order');
    await expect(
      customer.getByRole('heading', {
        name: '🦃 Thanksgiving Grand Opening Specials',
        exact: true,
      }),
    ).toBeVisible();
    await customer.getByRole('button', { name: 'Add Harvest Crunch Cup', exact: true }).tap();
    await expect(customer.locator('.basket .total')).toContainText('$2.00');
    expect(
      (
        await api(customer, '/settings', {
          seasonal: { thanksgiving: false, decorations: false, animations: false },
        })
      ).status,
    ).toBe(401);
    await page.reload();
    await page.getByRole('button', { name: 'Seasonal Management', exact: true }).click();
    await expect(page.getByLabel('Thanksgiving mode', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Preview seasonal theme' }).click();
    await expect(page.getByText('Preview only — use the controls above to save.')).toBeVisible();
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
    await api(page, '/settings', { item: { id: 'harvest-crunch-cup', available: true } });
    await api(page, '/settings', {
      seasonal: { thanksgiving: false, decorations: false, animations: false },
    });
    await customer.close();
  }
});
test('API verifies coupons, all recipes, one-use redemption, approval and unpaid submission', async ({
  page,
  browser,
}) => {
  await login(page);
  const customer = await browser.newPage();
  await customer.goto('/#order');
  await expect(customer.locator('.connection')).toContainText('Connected');
  const cart = [
    { id: 'chicken', quantity: 1, note: '', option: '' },
    { id: 'sunset', quantity: 2, note: '', option: '' },
  ];
  const id = 'opening-' + crypto.randomUUID();
  const rule = {
    id,
    name: 'Test configured offer',
    enabled: true,
    kind: 'sip',
    eligibility: 'coupon',
    starts: '2026-01-01T00:00:00Z',
    expires: '2030-01-01T00:00:00Z',
    minimum: 0,
    requiredItem: '',
    quantity: 1,
    amount: 0,
    limit: 10,
    code: 'TEST-OPENING',
  };
  try {
    for (const promotion of ['sip', 'bogo', 'ultimate', 'free', 'percent', 'credit', 'member'])
      expect((await api(customer, '/quote', { cart, promotion })).status).toBe(400);
    expect((await api(customer, '/quote', { cart, discount: 99999 })).status).toBe(400);
    expect((await api(customer, '/settings', { offer: rule })).status).toBe(401);
    expect((await api(page, '/settings', { offer: rule })).status).toBe(200);
    const publicMenu = (await api(customer, '/menu')).data;
    expect(JSON.stringify(publicMenu)).not.toContain('TEST-OPENING');
    expect(
      publicMenu.settings.offers.find((o: { id: string }) => o.id === id).couponHash,
    ).toBeUndefined();
    expect((await api(customer, '/quote', { cart, offerId: id, coupon: 'wrong' })).status).toBe(
      400,
    );
    expect(
      (await api(customer, '/quote', { cart: [cart[0]], offerId: id, coupon: 'TEST-OPENING' }))
        .status,
    ).toBe(400);
    const q = (await api(customer, '/quote', { cart, offerId: id, coupon: 'TEST-OPENING' })).data;
    expect(q.discount).toBe(350);
    expect(
      (
        await api(customer, '/orders', {
          cart,
          name: 'Coupon Guest',
          offerId: id,
          coupon: 'TEST-OPENING',
          requestId: crypto.randomUUID(),
          total: 1,
          revision: q.revision,
        })
      ).status,
    ).toBe(409);
    const requestId = crypto.randomUUID();
    const body = {
      cart,
      name: 'Coupon Guest',
      offerId: id,
      coupon: 'TEST-OPENING',
      requestId,
      total: q.total,
      revision: q.revision,
    };
    const receipts = await Promise.all([
      api(customer, '/orders', body),
      api(customer, '/orders', body),
    ]);
    expect(receipts[0].data.id).toBe(receipts[1].data.id);
    expect(receipts[0].data.paymentStatus).toBe('unconfirmed');
    expect(
      (await api(customer, '/quote', { cart, offerId: id, coupon: 'TEST-OPENING' })).status,
    ).toBe(400);
    expect((await api(customer, '/promotion-redemptions')).status).toBe(401);
    expect(
      (await api(page, '/promotion-redemptions')).data.some(
        (r: { order: string }) => r.order === receipts[0].data.id,
      ),
    ).toBe(true);
    await api(page, '/settings', { offer: { ...rule, expires: '2026-02-01T00:00:00Z' } });
    expect(
      (await api(customer, '/quote', { cart, offerId: id, coupon: 'TEST-OPENING' })).status,
    ).toBe(400);
    const session = (await api(customer, '/session')).data;
    const manager = { ...rule, id: id + '-manager', eligibility: 'manager' };
    await api(page, '/settings', { offer: manager });
    expect(
      (
        await api(customer, '/promotion-approval', {
          offerId: manager.id,
          customer: session.customer,
        })
      ).status,
    ).toBe(401);
    const token = (
      await api(page, '/promotion-approval', { offerId: manager.id, customer: session.customer })
    ).data.token;
    expect(
      (await api(customer, '/quote', { cart, offerId: manager.id, approvalToken: token })).data
        .discount,
    ).toBe(350);
    const other = await browser.newPage();
    await other.goto('/');
    await expect(other.locator('.connection')).toContainText('Connected');
    expect(
      (await api(other, '/quote', { cart, offerId: manager.id, approvalToken: token })).status,
    ).toBe(400);
    await other.close();
    await api(page, '/settings', { offer: { ...manager, enabled: false } });
  } finally {
    await api(page, '/settings', { offer: { ...rule, enabled: false } });
    await customer.close();
  }
});
