import { test as base } from '@playwright/test';

export const UNIQUE = `Auto_${Date.now().toString().slice(-6)}`;

export interface NewEmployee {
  firstName: string;
  lastName: string;
}

export const test = base.extend<{ employee: () => NewEmployee }>({
  employee: async ({}, use) => {
    await use(() => ({
      firstName: UNIQUE,
      lastName: `PIM_${process.pid.toString().slice(-3)}`,
    }));
  },
});

export { expect } from '@playwright/test';