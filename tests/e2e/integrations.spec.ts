import { test, expect } from '@playwright/test';
test.use({ extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.222' } });
test('staff configuration status belongs to this runtime and never equates a binding name with a key', async ({
  page,
}) => {
  await page.goto('/#employee');
  await expect(page.locator('.connection')).toContainText('Connected');
  expect((await page.request.get('/api/integrations')).status()).toBe(401);
  await page.getByLabel('Enter authorization code').fill('synthetic-test-only');
  await page.getByRole('button', { name: 'Unlock control center' }).click();
  await page.getByRole('button', { name: 'System Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Check GIPHY configuration on this server' }).click();
  await expect(page.getByRole('status')).toContainText('GIPHY: Not Configured');
  await expect(
    page.getByText('Server checked: http://localhost:8799', { exact: true }),
  ).toBeVisible();
  const status = await (await page.request.get('/api/integrations')).json();
  expect(status.giphy.configured).toBe(false);
  expect(status.giphy.providerVerified).toBe(false);
  expect(Object.keys(status.giphy).sort()).toEqual([
    'configured',
    'providerVerified',
    'source',
    'status',
  ]);
  expect(await (await page.request.get('/api/celebration')).json()).toEqual({ url: null });
});
