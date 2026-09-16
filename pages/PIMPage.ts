import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { NewEmployee } from '../tests/helpers/fixtures';

export class PIMPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.locator('.oxd-main-menu-item').filter({ hasText: 'PIM' }).click();
    await this.page.waitForURL(/pim\/viewEmployeeList/);
  }

  async openAddEmployee() {
    await this.page.getByRole('button', { name: /Add/ }).click();
    await this.page.waitForURL(/pim\/addEmployee/);
  }

  async addEmployee(employee: NewEmployee, employeeId?: string) {
    const firstName = this.page.locator('.oxd-input-group').filter({ hasText: 'First Name' }).locator('input');
    const middleName = this.page.locator('.oxd-input-group').filter({ hasText: 'Middle Name' }).locator('input');
    const lastName = this.page.locator('.oxd-input-group').filter({ hasText: 'Last Name' }).locator('input');

    await firstName.fill(employee.firstName);
    await middleName.fill('T');
    await lastName.fill(employee.lastName);
    if (employeeId) {
      await this.page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input').fill(employeeId);
    }
    await this.page.getByRole('button', { name: 'Save' }).click();
    await this.page.waitForURL(/pim\/viewPersonalDetails/);
  }

  async searchByEmployeeId(employeeId: string) {
    await this.page
      .locator('.oxd-input-group')
      .filter({ hasText: 'Employee Id' })
      .locator('input')
      .fill(employeeId);
    await this.page.getByRole('button', { name: 'Search' }).click();
  }

  async deleteSearchedRow() {
    await this.page.locator('.orangehrm-container .oxd-table-row').first().waitFor();
    await this.page.locator('.oxd-table-row').first().locator('input[type="checkbox"]').check();
    await this.page.getByRole('button', { name: /Delete/ }).click();
    await this.page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect(this.page.locator('.oxd-toast')).toContainText(/Success/);
  }
}