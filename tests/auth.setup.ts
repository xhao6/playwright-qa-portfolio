import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ENV } from '../playwright.config';

const authFile = 'playwright/.auth/user.json';

setup('log into EspoCRM and persist session', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(ENV.ADMIN_USER, ENV.ADMIN_PASS);
  await login.waitForLoggedIn();

  // Top navigation with user menu confirms we are past the login view.
  await expect(page.locator('.navbar').first()).toBeVisible();

  await page.context().storageState({ path: authFile });
});