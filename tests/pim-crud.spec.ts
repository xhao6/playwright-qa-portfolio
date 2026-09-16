import { test, expect } from '../tests/helpers/fixtures';
import { PIMPage } from '../pages/PIMPage';

const employeeId = () => `0${Date.now().toString().slice(-8)}`;

test.describe('PIM — Employee CRUD (self-contained data)', () => {
  test('add a new employee with required fields', async ({ page, employee }) => {
    const pim = new PIMPage(page);
    await pim.open();
    await pim.openAddEmployee();

    const data = employee();
    const id = employeeId();
    await pim.addEmployee(data, id);

    // Personal Details page loads with the created employee name.
    await expect(page.locator('.orangehrm-edit-employee-name')).toContainText(`${data.firstName} ${data.lastName}`);
    await expect(
      page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input')
    ).toHaveValue(id);
  });

  test('created employee appears in the employee list and can be deleted', async ({ page, employee }) => {
    const pim = new PIMPage(page);
    await pim.open();
    await pim.openAddEmployee();

    const data = employee();
    const id = employeeId();
    await pim.addEmployee(data, id);

    // Back to the list and search by auto-generated id.
    await pim.open();
    await pim.searchByEmployeeId(id);
    await expect(page.locator('.oxd-table-body .oxd-table-row')).toHaveCount(1);
    await expect(page.locator('.oxd-table-body')).toContainText(data.firstName);

    await pim.deleteSearchedRow();
    await page.waitForTimeout(500);
    await pim.searchByEmployeeId(id);
    await expect(page.locator('.oxd-table-body')).not.toContainText(data.firstName);
  });
});