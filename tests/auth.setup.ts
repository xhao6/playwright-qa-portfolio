import { test as setup, expect } from '@playwright/test';
import { ENV } from '../playwright.config';

const authFile = 'playwright/.auth/user.json';

setup('authenticate as Admin and persist session', { timeout: 90_000 }, async ({ page }) => {
  await page.goto('/web/index.php/auth/login', { waitUntil: 'commit' });
  await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 120_000 });
  await page.getByPlaceholder('Username').fill(ENV.ADMIN_USER);
  await page.getByPlaceholder('Password').fill(ENV.ADMIN_PASS);
  await page.getByRole('button', { name: 'Login' }).click();

  // Wait until the URL confirms a successful login so cookies are flushed before saving.
  await page.waitForURL(/dashboard/, { timeout: 60_000 });
  await expect(page).toHaveTitle(/OrangeHRM/);

  await page.context().storageState({ path: authFile });
});