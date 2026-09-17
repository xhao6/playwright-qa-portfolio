import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { test } from './helpers/fixtures';
import { LeadsPage } from '../pages/LeadsPage';
import { ENV } from '../playwright.config';

// Convert 会创建 Account/Contact/Opportunity 三实体（探测决议），UI 无对应 POM 可清理，走 API 自建自清
async function removeConvertedRecords(request: APIRequestContext, lastName: string) {
  const headers = {
    'Espo-Authorization': Buffer.from(`${ENV.ADMIN_USER}:${ENV.ADMIN_PASS}`).toString('base64'),
  };
  const search = await request.get('/api/v1/Lead', {
    headers,
    params: { 'where[0][type]': 'contains', 'where[0][attribute]': 'lastName', 'where[0][value]': lastName },
  });
  for (const lead of (await search.json()).list ?? []) {
    const leadData = await (await request.get(`/api/v1/Lead/${lead.id}`, { headers })).json();
    for (const key of ['createdAccountId', 'createdContactId', 'createdOpportunityId']) {
      const id = leadData[key];
      if (id) {
        await request.delete(`/api/v1/${key.replace('created', '').replace('Id', '')}/${id}`, { headers });
      }
    }
    await request.delete(`/api/v1/Lead/${lead.id}`, { headers });
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
      await expect(page.locator('body')).toContainText(/converted|conversion|success/i, { timeout: 15_000 });
    } finally {
      await removeConvertedRecords(request, lastName);
    }
  });
});