import { expect } from '@playwright/test';
import { test, uniqueName } from '../helpers/fixtures';
import { EspoApi } from './helpers/espo-api';

test.describe('Accounts API @api', () => {
  let api: EspoApi;
  let accountId: string;
  let name: string;

  test.beforeEach(async ({ request }) => {
    api = new EspoApi(request);
    name = uniqueName('Auto_ApiAccount');
    const created = await api.create('Account', { name });
    expect(created.status).toBe(200);
    accountId = created.body.id;
  });

  test.afterEach(async () => {
    if (api && accountId) await api.remove('Account', accountId);
  });

  test('create returns an id and get returns the record', async () => {
    const res = await api.get('Account', accountId);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(name);
  });

  test('update persists new field values', async () => {
    const res = await api.update('Account', accountId, {
      website: 'https://updated.example.com',
    });
    expect(res.status).toBe(200);
    const after = await api.get('Account', accountId);
    expect(after.body.website).toBe('https://updated.example.com');
  });

  test('search by name contains finds the record', async () => {
    const res = await api.search('Account', 'name', name);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.list.some((row) => row.id === accountId)).toBe(true);
  });

  test('delete marks the record as deleted', async () => {
    const res = await api.remove('Account', accountId);
    expect(res.status).toBe(200);
    const after = await api.get('Account', accountId);
    expect(after.status).toBe(200);
    expect(after.body.deleted).toBe(true);
  });
});
