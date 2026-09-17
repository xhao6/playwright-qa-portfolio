import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  get usernameInput() {
    return this.page.locator('input[name="username"]');
  }

  get passwordInput() {
    return this.page.locator('input[name="password"]');
  }

  get submitButton() {
    return this.page.getByRole('button', { name: 'Log in' });
  }

  async open() {
    await this.page.goto('/', { waitUntil: 'commit' });
    await expect(this.usernameInput).toBeVisible({ timeout: 30_000 });
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async waitForLoggedIn() {
    await this.submitButton.waitFor({ state: 'hidden', timeout: 60_000 });
  }
}