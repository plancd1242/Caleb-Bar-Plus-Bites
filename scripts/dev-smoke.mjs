import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:5173');
  await page.locator('.connection').filter({ hasText: 'Connected' }).waitFor();
  await page.getByRole('navigation').getByRole('button', { name: 'Place Your Order' }).click();
  await page.getByRole('button', { name: 'Add Chicken Bites', exact: true }).click();
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('heading', { name: 'Your happy little lineup.' }).waitFor();
  const auth = await page.evaluate(async () => {
    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'synthetic-test-only' }),
    });
    return { status: r.status, data: await r.json() };
  });
  assert.equal(auth.status, 503);
  assert.match(auth.data.error, /not configured/);
  assert.deepEqual(errors, []);
  console.log(
    'Development startup, Vite API proxy, WebSocket connection, item selection, server quote, missing-secret auth, and browser error checks passed. No order submitted.',
  );
} finally {
  await browser.close();
}
