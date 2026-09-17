import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface AccountData {
  name: string;
  website?: string;
}

export class AccountsPage {
  constructor(private readonly page: Page) {}

  get createButton() {
    return this.page.locator('a[data-action="create"]');
  }

  get nameInput() {
    return this.page.locator('input[data-name="name"]');
  }

  get websiteInput() {
    return this.page.locator('input[data-name="website"]');
  }

  get saveButton() {
    return this.page.locator('button[data-action="save"]');
  }

  get listSearch() {
    return this.page.locator('input[data-name="textFilter"]');
  }

  get rows() {
    return this.page.locator('table tbody tr[data-id]');
  }

  async open() {
    await this.page.goto('/#/Account', { waitUntil: 'domcontentloaded' });
    const leave = this.page.locator('.modal-dialog').filter({ hasText: /leave the form/i });
    for (let attempt = 0; attempt < 10; attempt++) {
      if ((await leave.count()) > 0) {
        await leave.getByRole('button', { name: 'Yes' }).click();
      }
      try {
        await expect(this.createButton).toBeVisible({ timeout: 3_000 });
        return;
      } catch {
        // form teardown still in progress; keep waiting for list or dialog
      }
    }
    await expect(this.createButton).toBeVisible();
  }

  async create(data: AccountData) {
    await this.open();
    await this.createButton.click();
    await this.nameInput.fill(data.name);
    if (data.website) await this.websiteInput.fill(data.website);
    await this.saveButton.click();
    await expect(this.page).toHaveURL(/#\/?Account\/view\//, { timeout: 30_000 });
    await expect(this.page.locator('.field[data-name="name"]')).toBeVisible();
  }

  async search(name: string) {
    await this.open();
    if ((await this.listSearch.inputValue()) !== name) {
      await this.listSearch.fill(name);
      await this.listSearch.press('Enter');
      await this.page.waitForLoadState('networkidle');
    }
  }

  rowByName(name: string) {
    return this.rows.filter({ hasText: name }).first();
  }

  async removeByName(name: string) {
    await this.search(name);
    const row = this.rowByName(name);
    if ((await row.count()) === 0) return;
    const toggle = row.locator('.list-row-buttons button.dropdown-toggle');
    const menuItem = row.locator('.dropdown-menu a[data-action="quickRemove"]');
    const confirm = this.page.locator('.modal-dialog button[data-name="confirm"]');
    const cancel = this.page.locator('.modal-dialog button[data-name="cancel"]');
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        if ((await cancel.count()) > 0) await cancel.click();
        await toggle.click({ timeout: 4_000 });
        await expect(menuItem).toBeVisible({ timeout: 3_000 });
        await menuItem.click({ timeout: 4_000 });
        await expect(confirm).toBeVisible({ timeout: 3_000 });
        await confirm.click({ timeout: 4_000 });
        break;
      } catch {
        await this.page.waitForTimeout(500);
      }
    }
    await this.page.waitForLoadState('networkidle');
    await expect(row).toHaveCount(0, { timeout: 15_000 });
  }
}