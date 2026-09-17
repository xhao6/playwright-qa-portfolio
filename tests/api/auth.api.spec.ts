import { expect, test, request as pwRequest } from '@playwright/test';
import { ENV } from '../../playwright.config';
import { basicAuthHeader } from './helpers/espo-api';

test.describe('API auth', () => {
  test('valid admin credentials authenticate with Basic auth', async () => {
    const ctx = await pwRequest.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const res = await ctx.get('/api/v1/App/user', {
        headers: basicAuthHeader(),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.user.userName).toBe(ENV.ADMIN_USER);
    } finally {
      await ctx.dispose();
    }
  });

  test('wrong password is rejected with 401', async () => {
    const ctx = await pwRequest.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const res = await ctx.get('/api/v1/App/user', {
        headers: basicAuthHeader(ENV.ADMIN_USER, 'definitely-wrong'),
      });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test('missing credentials are rejected with 401', async () => {
    const ctx = await pwRequest.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const res = await ctx.get('/api/v1/App/user');
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });
});
