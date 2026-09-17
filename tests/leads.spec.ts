import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { test } from './helpers/fixtures';
import { LeadsPage } from '../pages/LeadsPage';
import { ENV } from '../playwright.config';

// Convert 会创建 Account/Contact/Opportunity 三实体（探测决议），UI 无对应 POM 可清理，走 API 自建自清
const ENTITY_BY_ID_KEY: Record<string, string> = {
  createdAccountId: 'Account',
  createdContactId: 'Contact',
  createdOpportunityId: 'Opportunity',
};

// 清理在 finally 里执行：失败只 console.error（状态码 + 原始 body，实例错误体结构未探测）不抛错，避免掩盖原始测试结果
async function removeConvertedRecords(request: APIRequestContext, lastName: string) {
  const headers = {
    'Espo-Authorization': Buffer.from(`${ENV.ADMIN_USER}:${ENV.ADMIN_PASS}`).toString('base64'),
  };
  const search = await request.get('/api/v1/Lead', {
    headers,
    params: { 'where[0][type]': 'contains', 'where[0][attribute]': 'lastName', 'where[0][value]': lastName },
  });
  if (!search.ok()) {
    console.error(`[cleanup] Lead search failed: ${search.status()} ${await search.text()}`);
    return;
  }
  for (const lead of (await search.json()).list ?? []) {
    const detail = await request.get(`/api/v1/Lead/${lead.id}`, { headers });
    if (!detail.ok()) {
      console.error(`[cleanup] Lead ${lead.id} fetch failed: ${detail.status()} ${await detail.text()}`);
      continue;
    }
    const leadData = await detail.json();
    for (const [key, entity] of Object.entries(ENTITY_BY_ID_KEY)) {
      const id = leadData[key];
      if (!id) continue;
      const del = await request.delete(`/api/v1/${entity}/${id}`, { headers });
      if (!del.ok()) {
        console.error(`[cleanup] DELETE ${entity}/${id} failed: ${del.status()} ${await del.text()}`);
      }
    }
    const delLead = await request.delete(`/api/v1/Lead/${lead.id}`, { headers });
    if (!delLead.ok()) {
      console.error(`[cleanup] DELETE Lead/${lead.id} failed: ${delLead.status()} ${await delLead.text()}`);
    }
  }
}

test.describe('Leads', () => {
  let lastName: string;

  test.beforeEach(async ({ page, unique }) => {
    lastName = unique('Auto_Lead');
    await new LeadsPage(page).create({ firstName: 'QA', lastName });
  });

  test.afterEach(async ({ page }) => {
    await new LeadsPage(page).removeByName(lastName);
  });

  test('detail view shows created lead', async ({ page }) => {
    await expect(page).toHaveURL(/#\/?Lead\/view\//);
    await expect(page.locator('body')).toContainText(lastName);
  });

  test('list search finds the lead', async ({ page }) => {
    const leads = new LeadsPage(page);
    await leads.search(lastName);
    await expect(leads.rowByName(lastName)).toBeVisible();
  });

  test('list search filters out non-matching names', async ({ page }) => {
    const leads = new LeadsPage(page);
    await leads.search('Auto_zzz_no_such_record');
    await expect(leads.rows).toHaveCount(0);
  });

  test('convert flow completes without error', async ({ page, request }) => {
    const leads = new LeadsPage(page);
    try {
      await leads.convert({ accountName: `Acct_${lastName}`, opportunityName: `Opp_${lastName}` });
      await expect(leads.detailStatusField).toHaveText(/converted/i, { timeout: 15_000 });
      await expect(leads.convertButton).toHaveCount(0);
    } finally {
      await removeConvertedRecords(request, lastName);
    }
  });
});