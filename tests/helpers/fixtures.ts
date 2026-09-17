import { test as base, expect } from '@playwright/test';

const TS = Date.now().toString().slice(-6);
let seq = 0;

export function uniqueName(prefix: string): string {
  return `${prefix}_${TS}_${++seq}`;
}

export const test = base.extend<{ unique: (prefix: string) => string }>({
  unique: async ({}, use, testInfo) => {
    const used = new Set<string>();
    await use((prefix: string) => {
      const baseName = `${prefix}_${TS}_${testInfo.workerIndex}`;
      let name = baseName;
      for (let i = 2; used.has(name); i++) name = `${baseName}_${i}`;
      used.add(name);
      return name;
    });
  },
});

export { expect };
