import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface LeadData {
  firstName: string;
  lastName: string;
}

export interface LeadConvertData {
  accountName: string;
  opportunityName: string;
}

// 探测决议：EspoCRM click 无默认超时（attached 但不可见/不稳定时无限重试到测试超时），易竞态 click 显式限时 4s
const CLICK_TIMEOUT_MS = 4_000;
// 弹窗/行菜单出现通常 <1s；3s 覆盖 SPA 异步渲染，且比 click 预算短，先超时走重试循环
const DIALOG_VISIBLE_TIMEOUT_MS = 3_000;
// open() 列表就绪探测：最多 10 次 × 3s，覆盖表单 teardown 弹窗与 SPA 渲染
const OPEN_RETRY_LIMIT = 10;
const OPEN_PROBE_TIMEOUT_MS = 3_000;
// 保存后跳详情 / Convert 后回详情：服务端写入 + 表单 teardown，实测可达 ~10s，预算 30s
const SAVE_TIMEOUT_MS = 30_000;
// Convert 向导页路由跳转通常 <2s，15s 覆盖 SPA 异步渲染
const CONVERT_NAV_TIMEOUT_MS = 15_000;
// removeByName 重试：搜索重渲染会 clobber 已打开的行菜单，最多 6 次，间隔 500ms 等稳定
const REMOVE_RETRY_LIMIT = 6;
const REMOVE_RETRY_DELAY_MS = 500;
// 删除 XHR：实测响应 200，但慢时 30–90s 才完成（行乐观移除先行），预算 120s 覆盖上限
const DELETE_RESPONSE_TIMEOUT_MS = 120_000;
// 删除后行断言：等 DELETE 完成后列表可能重渲染，15s 足够
const DELETE_ASSERT_TIMEOUT_MS = 15_000;
// 搜索 XHR 完成后行渲染滞后（networkidle 只等网络空闲，不等客户端渲染），轮询等行出现最多 6 次 × 500ms；等不到视为已删除
const ROW_POLL_LIMIT = 6;
const ROW_POLL_DELAY_MS = 500;

export class LeadsPage {
  constructor(private readonly page: Page) {}

  get createButton() {
    return this.page.locator('a[data-action="create"]');
  }

  get firstNameInput() {
    return this.page.locator('input[data-name="firstName"]');
  }

  get lastNameInput() {
    return this.page.locator('input[data-name="lastName"]');
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

  get detailNameField() {
    return this.page.locator('.field[data-name="name"]');
  }

  get convertButton() {
    return this.page.locator('button[data-action="convert"]');
  }

  get convertAccountScope() {
    return this.page.locator('input[data-scope="Account"]');
  }

  get convertContactScope() {
    return this.page.locator('input[data-scope="Contact"]');
  }

  get convertOpportunityScope() {
    return this.page.locator('input[data-scope="Opportunity"]');
  }

  get convertAccountSection() {
    return this.page.locator('.edit[data-scope="Account"]');
  }

  get convertOpportunitySection() {
    return this.page.locator('.edit[data-scope="Opportunity"]');
  }

  get datePicker() {
    return this.page.locator('.datepicker-dropdown');
  }

  async open() {
    await this.page.goto('/#/Lead', { waitUntil: 'domcontentloaded' });
    const leave = this.page.locator('.modal-dialog').filter({ hasText: /leave the form/i });
    for (let attempt = 0; attempt < OPEN_RETRY_LIMIT; attempt++) {
      if ((await leave.count()) > 0) {
        await leave.getByRole('button', { name: 'Yes' }).click({ timeout: CLICK_TIMEOUT_MS });
      }
      try {
        await expect(this.createButton).toBeVisible({ timeout: OPEN_PROBE_TIMEOUT_MS });
        return;
      } catch {
        // form teardown still in progress; keep waiting for list or dialog
      }
    }
    await expect(this.createButton).toBeVisible();
  }

  async create(data: LeadData) {
    await this.open();
    await this.createButton.click();
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.saveButton.click();
    await expect(this.page).toHaveURL(/#\/?Lead\/view\//, { timeout: SAVE_TIMEOUT_MS });
    await expect(this.detailNameField).toBeVisible();
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

  async refresh() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(this.createButton).toBeVisible();
  }

  async convert(data: LeadConvertData) {
    await this.convertButton.click({ timeout: CLICK_TIMEOUT_MS });
    await expect(this.page).toHaveURL(/Lead\/convert/, { timeout: CONVERT_NAV_TIMEOUT_MS });
    await expect(this.convertAccountScope).toBeVisible({ timeout: CONVERT_NAV_TIMEOUT_MS });
    await this.convertAccountScope.check({ force: true });
    await this.convertContactScope.check({ force: true });
    await this.convertOpportunityScope.check({ force: true });
    await expect(this.convertAccountScope).toBeChecked();
    await expect(this.convertContactScope).toBeChecked();
    await expect(this.convertOpportunityScope).toBeChecked();
    const accountName = this.convertAccountSection.locator('input[data-name="name"]');
    const opportunityName = this.convertOpportunitySection.locator('input[data-name="name"]');
    await accountName.fill(data.accountName);
    await expect(accountName).toHaveValue(data.accountName);
    await opportunityName.fill(data.opportunityName);
    await expect(opportunityName).toHaveValue(data.opportunityName);
    // Amount 是 numeric-text：fill() 会被客户端还原为空，必须逐键输入（探测决议）
    const amount = this.convertOpportunitySection.locator('input[data-name="amount"]');
    await amount.click({ timeout: CLICK_TIMEOUT_MS });
    await amount.pressSequentially('1000');
    await expect(amount).toHaveValue(/1,000/);
    // Close Date：fill 后必须 Enter 确认（datepicker）；Escape 会清空值且弹层拦截后续 click（探测决议）
    const closeDate = this.convertOpportunitySection.locator('input[data-name="closeDate"]');
    await closeDate.fill('31.12.2026');
    await closeDate.press('Enter');
    await expect(closeDate).not.toHaveValue('');
    await expect(this.datePicker).toHaveCount(0);
    await this.convertButton.click({ timeout: CLICK_TIMEOUT_MS });
    await expect(this.page).toHaveURL(/#\/?Lead\/view\//, { timeout: SAVE_TIMEOUT_MS });
  }

  async removeByName(name: string) {
    await this.search(name);
    const row = this.rowByName(name);
    // 搜索 XHR 完成后行渲染滞后：networkidle 返回时行可能尚未渲染，直接 count 为 0 会误判「已删除」而漏删（实测留下孤儿记录）
    let found = false;
    for (let attempt = 0; attempt < ROW_POLL_LIMIT; attempt++) {
      if ((await row.count()) > 0) {
        found = true;
        break;
      }
      await this.page.waitForTimeout(ROW_POLL_DELAY_MS);
    }
    if (!found) return;
    const toggle = row.locator('.list-row-buttons button.dropdown-toggle');
    const menuItem = row.locator('.dropdown-menu a[data-action="quickRemove"]');
    const confirm = this.page.locator('.modal-dialog button[data-name="confirm"]');
    const cancel = this.page.locator('.modal-dialog button[data-name="cancel"]');
    for (let attempt = 0; attempt < REMOVE_RETRY_LIMIT; attempt++) {
      try {
        if ((await cancel.count()) > 0) await cancel.click({ timeout: CLICK_TIMEOUT_MS });
        await toggle.click({ timeout: CLICK_TIMEOUT_MS });
        await expect(menuItem).toBeVisible({ timeout: DIALOG_VISIBLE_TIMEOUT_MS });
        await menuItem.click({ timeout: CLICK_TIMEOUT_MS });
        await expect(confirm).toBeVisible({ timeout: DIALOG_VISIBLE_TIMEOUT_MS });
        // 探测实测删除 XHR 为 DELETE /api/v1/Lead/<id>（响应 200）；等其完成而非只等乐观移除
        const deleteResponse = this.page.waitForResponse(
          (r) => r.request().method() === 'DELETE' && r.url().includes('/api/v1/Lead/'),
          { timeout: DELETE_RESPONSE_TIMEOUT_MS },
        );
        await confirm.click({ timeout: CLICK_TIMEOUT_MS });
        await deleteResponse;
        break;
      } catch {
        await this.page.waitForTimeout(REMOVE_RETRY_DELAY_MS);
      }
    }
    // 兜底：若 waitForResponse 未捕获（罕见路径），确保删除请求完成再收尾，避免数据残留
    await this.page.waitForLoadState('networkidle');
    await expect(row).toHaveCount(0, { timeout: DELETE_ASSERT_TIMEOUT_MS });
  }
}