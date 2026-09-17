import { expect } from '@playwright/test';
import { test, uniqueName } from '../helpers/fixtures';
import { EspoApi } from './helpers/espo-api';

test.describe('Leads API', () => {
  let api: EspoApi;
  let leadId: string;
  let lastName: string;

  test.beforeEach(async ({ request }) => {
    api = new EspoApi(request);
    lastName = uniqueName('Auto_ApiLead');
    const created = await api.create('Lead', { firstName: 'QA', lastName });
    expect(created.status).toBe(200);
    leadId = created.body.id;
  });

  test.afterEach(async () => {
    if (api && leadId) await api.remove('Lead', leadId);
  });

  test('create returns an id and get returns the record', async () => {
    const res = await api.get('Lead', leadId);
    expect(res.status).toBe(200);
    expect(res.body.lastName).toBe(lastName);
  });

  test('search by lastName contains finds the record', async () => {
    const res = await api.search('Lead', 'lastName', lastName);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.list.some((row) => row.id === leadId)).toBe(true);
  });

  test('delete marks the record as deleted', async () => {
    const res = await api.remove('Lead', leadId);
    expect(res.status).toBe(200);
    const after = await api.get('Lead', leadId);
    expect(after.status).toBe(200);
    expect(after.body.deleted).toBe(true);
  });
});