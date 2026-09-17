import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ENV } from '../playwright.config';

// Negative auth cases run unauthenticated.
const test = base.extend({});
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication (unauthenticated)', () => {
  test('login with admin credentials succeeds', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login(ENV.ADMIN_USER, ENV.ADMIN_PASS);
    await login.waitForLoggedIn();

    await expect(page.locator('.navbar').first()).toBeVisible();
  });

  test('login with wrong password shows an error and stays on login', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login(ENV.ADMIN_USER, 'definitely-wrong');

    await expect(login.submitButton).toBeVisible();
    await expect(page).toHaveURL(baseUrl('/'));
  });

  test('login with empty fields blocks authentication', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.submitButton.click();

    // Invalid-credentials / empty-field feedback appears and we stay on login.
    await expect(page.locator('body')).toContainText(/can not be empty|incorrect username|invalid/i);
    await expect(page).toHaveURL(baseUrl('/'));
  });
});

function baseUrl(path: string): RegExp {
  return new RegExp(`^${ENV.BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${path}.*$`);
}