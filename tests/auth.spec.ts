import { test as base, expect } from '@playwright/test';

// Reset any persisted auth so negative auth cases run unauthenticated.
const test = base.extend({});
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication (unauthenticated)', () => {
  test('login with valid admin credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/web/index.php/auth/login', { waitUntil: 'commit' });
    await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 120_000 });
    await page.getByPlaceholder('Username').fill('Admin');
    await page.getByPlaceholder('Password').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForURL(/dashboard/);
    await expect(page).toHaveTitle(/OrangeHRM/);
  });

  test('login with wrong credentials shows an error and stays on login', async ({ page }) => {
    await page.goto('/web/index.php/auth/login', { waitUntil: 'commit' });
    await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 120_000 });
    await page.getByPlaceholder('Username').fill('Admin');
    await page.getByPlaceholder('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.oxd-alert-content-text')).toBeVisible();
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('login with empty required fields blocks submission', async ({ page }) => {
    await page.goto('/web/index.php/auth/login', { waitUntil: 'commit' });
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible({ timeout: 120_000 });
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.oxd-input-field-error-message')).toHaveCount(2);
    await expect(page).toHaveURL(/auth\/login/);
  });
});