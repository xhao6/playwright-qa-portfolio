import { expect } from '@playwright/test';
import { test } from './helpers/fixtures';
import { AccountsPage } from '../pages/AccountsPage';

test.describe('Accounts', () => {
  let name: string;

  test.beforeEach(async ({ page, unique }) => {
    name = unique('Auto_Account');
    await new AccountsPage(page).create({ name, website: 'https://example.com' });
  });

  test.afterEach(async ({ page }) => {
    await new AccountsPage(page).removeByName(name);
  });

  test('detail view shows created account', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await expect(page).toHaveURL(/#\/?Account\/view\//);
    await expect(page.locator('body')).toContainText(name);
  });

  test('edit updates account fields', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.open();
    await accounts.openRecord(name);
    await accounts.editButton.click();
    await accounts.websiteInput.fill('https://updated.example.com');
    await accounts.saveButton.click();
    await expect(accounts.websiteInput).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('body')).toContainText('updated.example.com');
  });

  test('list search finds the account', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.search(name);
    await expect(accounts.rowByName(name)).toBeVisible();
  });

  test('list search filters out non-matching names', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.search('Auto_zzz_no_such_record');
    await expect(accounts.rows).toHaveCount(0);
  });

  test('delete removes the account from the list', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.removeByName(name);
    await accounts.refresh();
    await accounts.search(name);
    await expect(accounts.rowByName(name)).toHaveCount(0);
  });
});
