import { expect } from '@playwright/test';
import { test, uniqueName } from './fixtures';

test.describe('unique data factory', () => {
  test('uniqueName produces unique names with prefix', () => {
    const a = uniqueName('Auto_Account');
    const b = uniqueName('Auto_Account');
    expect(a).not.toBe(b);
    expect(a.startsWith('Auto_Account_')).toBe(true);
  });

  test('unique fixture produces unique names per call', async ({ unique }) => {
    const a = unique('Auto_Lead');
    const b = unique('Auto_Lead');
    expect(a).not.toBe(b);
    expect(a).toContain('Auto_Lead');
  });
});
