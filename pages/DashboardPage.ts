import type { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async isLoaded() {
    await this.page.waitForURL(/dashboard/);
  }

  async logout() {
    await this.page.locator('.oxd-userdropdown-trigger').click();
    await this.page.getByRole('menuitem', { name: 'Logout' }).click();
    await this.page.waitForURL(/auth\/login/);
  }
}