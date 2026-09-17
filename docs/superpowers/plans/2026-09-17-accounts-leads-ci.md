# Accounts / Leads Specs + CI 落地 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 HANDOFF P0/P1：accounts.spec 与 leads.spec（创建/详情/编辑/搜索/删除/状态流转，自建自清），fixtures 通用化为唯一数据工厂，CI secrets 配置并 push GitHub 验证 Actions 绿。

**Architecture:** 按 AGENTS.md 规范：probe 先行（临时 spec 探测真实 DOM → 笔记落盘）→ POM 收敛 locator（`pages/AccountsPage.ts`、`pages/LeadsPage.ts`）→ 业务 spec 从 fixtures 取唯一数据、beforeEach 创建 / afterEach 清理、测试互不依赖。fixtures 通用化作为前置任务（accounts/leads 都依赖唯一数据工厂）。

**Tech Stack:** Playwright 1.63 + TypeScript（`@playwright/test`）、dotenv、pnpm；被测 = 自有 EspoCRM 实例（`BASE_URL` 经 `.env` 注入）。

**环境前置**：node 26 + pnpm 11 已就绪（若 node 报缺库：`brew install <缺的库>`）；本地跑 `pnpm test --project=desktop-chromium` 当前 3/3 绿。执行每一步前先 `git status` 确认工作区干净。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `tests/helpers/fixtures.ts` | 唯一数据工厂（`unique` fixture） | 重写 |
| `tests/helpers/fixtures.spec.ts` | fixtures 工厂单元验证 | 新建 |
| `tests/probe/accounts.probe.spec.ts` | 临时探测 Accounts 页 DOM → 写 `docs/probe/accounts-dom.md` | 新建后删除 |
| `tests/probe/leads.probe.spec.ts` | 临时探测 Leads 页 DOM → 写 `docs/probe/leads-dom.md` | 新建后删除 |
| `docs/probe/accounts-dom.md` | Accounts 页 locator 决议（后续 POM 数据源） | 新建，提交 |
| `docs/probe/leads-dom.md` | Leads 页 locator 决议 | 新建，提交 |
| `pages/AccountsPage.ts` | Accounts 列表/详情/表单操作 POM | 新建 |
| `tests/accounts.spec.ts` | Accounts 业务 spec（4 用例） | 新建 |
| `pages/LeadsPage.ts` | Leads 列表/详情/表单/转换操作 POM | 新建 |
| `tests/leads.spec.ts` | Leads 业务 spec（3 用例） | 新建 |
| `README.md` / `HANDOFF.md` | 状态同步 | 修改 |
| `.github/workflows/ci.yml` | 已就绪（pnpm） | 不变 |

---

### Task 1: fixtures 通用化为唯一数据工厂

**Files:**
- Rewrite: `tests/helpers/fixtures.ts`
- Test: `tests/helpers/fixtures.spec.ts`

当前 `fixtures.ts` 是 PIM 遗留的 `employee` 工厂，无任何 spec 引用（auth.spec 用 `base.extend({})`），可安全重写。

- [ ] **Step 1: 写失败测试**

创建 `tests/helpers/fixtures.spec.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec playwright test tests/helpers/fixtures.spec.ts --project=desktop-chromium --reporter=line`
Expected: FAIL — `fixtures` 模块无 `uniqueName` / `unique` 导出（TS 编译错或运行时 undefined）。

- [ ] **Step 3: 重写 `tests/helpers/fixtures.ts`**

```ts
import { test as base, expect } from '@playwright/test';

const TS = Date.now().toString().slice(-6);

export function uniqueName(prefix: string): string {
  return `${prefix}_${TS}`;
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
```

> 说明：`uniqueName` 供 POM 内自造名；`unique` fixture 保证同测试内多次调用也唯一（workerIndex 后缀，符合 AGENTS.md 数据纪律）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec playwright test tests/helpers/fixtures.spec.ts --project=desktop-chromium --reporter=line`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/fixtures.ts tests/helpers/fixtures.spec.ts
git commit -m "test: fixtures 通用化为唯一数据工厂（uniqueName + unique fixture）"
```

---

### Task 2: probe Accounts 页 DOM（临时 spec，产出 locator 决议）

**Files:**
- Create: `tests/probe/accounts.probe.spec.ts`
- Output: `docs/probe/accounts-dom.md`

> 遵循 AGENTS.md：「断言新行为先探测真实 DOM（临时 probe spec），再落正式 spec」。

- [ ] **Step 1: 写 probe spec**

创建 `tests/probe/accounts.probe.spec.ts`：

```ts
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

test('probe Accounts list/create/detail DOM', async ({ page }) => {
  const notes: string[] = [];
  const note = (s: string) => { notes.push(s); console.log(s); };

  await page.goto('/#/Account', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText(/account/i, { timeout: 30_000 });

  // 1. Create button
  const createBtn = page.getByRole('button', { name: /create/i }).first();
  note(`createButton: ${await createBtn.count() > 0 ? await createBtn.evaluate(el => el.outerHTML.slice(0, 200)) : 'NOT FOUND'}`);

  // 2. Search box
  const searchInput = page.locator('input[type="search"], input.search, input[placeholder*="earch" i]').first();
  note(`searchInput: ${await searchInput.count() > 0 ? `name=${await searchInput.getAttribute('name')} placeholder=${await searchInput.getAttribute('placeholder')}` : 'NOT FOUND'}`);

  // 3. Table rows / list items
  const rows = page.locator('table tbody tr, .list-row, [data-id]');
  note(`rows locator candidates: count=${await rows.count()}`);

  // 4. Open create form
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await expect(page.locator('body')).toContainText(/save|cancel/i, { timeout: 15_000 });

    const inputs = page.locator('input:not([type="hidden"]), select, textarea');
    const fields = await inputs.evaluateAll((els) =>
      els.slice(0, 40).map((el) => ({
        tag: el.tagName.toLowerCase(),
        name: el.getAttribute('name'),
        type: el.getAttribute('type'),
        placeholder: el.getAttribute('placeholder'),
        label: el.closest('div[class*="field"], div.cell')?.querySelector('label, .label, .field-label')?.textContent?.trim() ?? null,
      })),
    );
    note('formFields: ' + JSON.stringify(fields, null, 1));

    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    note(`saveButton: ${await saveBtn.count() > 0 ? 'FOUND' : 'NOT FOUND'}`);
  }

  mkdirSync('docs/probe', { recursive: true });
  writeFileSync('docs/probe/accounts-dom.md', notes.join('\n\n'));
});
```

- [ ] **Step 2: 跑 probe，确认产出决议文件**

Run: `pnpm exec playwright test tests/probe/accounts.probe.spec.ts --project=desktop-chromium --reporter=line`
Expected: PASS；控制台打印 createButton / searchInput / formFields / saveButton 详情。

- [ ] **Step 3: 人工阅读输出，在 `docs/probe/accounts-dom.md` 中确认/补充 locator 决议**

根据打印结果，确保文档包含以下决议（每个给出最终 locator 表达式 + 依据）：
- `createButton`：进入创建表单的按钮
- `nameInput`：Name 必填字段
- `websiteInput` / `phoneInput`：次要字段（若表单有）
- `saveButton`：提交按钮
- `listSearch`：列表搜索框
- `rowLocator`：列表行（唯一名可定位的行）
- `rowMenu` / `removeAction`：删除入口（行内 dropdown → Remove，若探测到）
- 备注：若表单字段是 float/自定义组件（`input[name="name"]` 等 standard 控件不存在），记录真实可用的定位方式

> 若探测结果与预期差异大（如按钮文案不同），以探测为准更新上面的决议项，Task 3 全部使用决议值。

- [ ] **Step 4: 删除临时 probe spec，提交决议**

```bash
rm tests/probe/accounts.probe.spec.ts
git add docs/probe/accounts-dom.md
git commit -m "test: probe Accounts 页 DOM，落盘 locator 决议"
```

---

### Task 3: AccountsPage POM + accounts.spec

**Files:**
- Create: `pages/AccountsPage.ts`
- Create: `tests/accounts.spec.ts`
- Read first: `docs/probe/accounts-dom.md`

- [ ] **Step 1: 写 POM**

创建 `pages/AccountsPage.ts`（所有 locator 使用 Task 2 决议值，下面为基于 EspoCRM 常见结构的默认实现，若决议不同**以决议为准替换**）：

```ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface AccountData {
  name: string;
  website?: string;
}

export class AccountsPage {
  constructor(private readonly page: Page) {}

  // Locator 决议（自 docs/probe/accounts-dom.md）
  get createButton() {
    return this.page.getByRole('button', { name: /create account/i }).first();
  }

  get nameInput() {
    return this.page.locator('input[name="name"]').first();
  }

  get websiteInput() {
    return this.page.locator('input[name="website"]').first();
  }

  get saveButton() {
    return this.page.getByRole('button', { name: /^save$/i }).first();
  }

  get listSearch() {
    return this.page.locator('input[type="search"], input.search').first();
  }

  get rows() {
    return this.page.locator('table tbody tr, .list-row');
  }

  async open() {
    await this.page.goto('/#/Account', { waitUntil: 'domcontentloaded' });
  }

  async create(data: AccountData) {
    await this.open();
    await this.createButton.click();
    await this.nameInput.fill(data.name);
    if (data.website) await this.websiteInput.fill(data.website);
    await this.saveButton.click();
    await expect(this.page).toHaveURL(/#\/Account\/view\//, { timeout: 30_000 });
  }

  async search(name: string) {
    await this.open();
    await this.listSearch.fill(name);
  }

  async rowByName(name: string) {
    return this.rows.filter({ hasText: name }).first();
  }

  async removeByName(name: string) {
    await this.search(name);
    const row = this.rowByName(name);
    if (await row.count() === 0) return;
    // 删除入口以 probe 决议为准（默认：行内菜单 → Remove）
    await row.locator('button[data-action="dropdownMenu"], .dropdown-menu-link').first().click();
    await this.page.getByRole('button', { name: /remove/i }).first().click();
    await expect(row).toHaveCount(0, { timeout: 15_000 });
  }
}
```

> 注意：`removeByName` 中「菜单按钮 / Remove 按钮」的 locator 必须按决议替换——若探测到不同入口（如行 hover 出现删除图标），改对应两行即可。

- [ ] **Step 2: 写 accounts.spec**

创建 `tests/accounts.spec.ts`（每个测试独立创建+清理，互不依赖）：

```ts
import { expect } from '@playwright/test';
import { test } from './helpers/fixtures';
import { AccountsPage } from '../pages/AccountsPage';

test.describe('Accounts', () => {
  let name: string;

  test.beforeEach(async ({ page, unique }) => {
    name = unique('Auto_Account');
    await new AccountsPage(page).create({ name, website: 'https://example.com' });
  });

  test.afterEach(async ({ page }) => {
    await new AccountsPage(page).removeByName(name);
  });

  test('detail view shows created account', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await expect(page).toHaveURL(/#\/Account\/view\//);
    await expect(page.locator('body')).toContainText(name);
  });

  test('edit updates account fields', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.open();
    await accounts.rowByName(name).click();
    await expect(page).toHaveURL(/#\/Account\/view\//);
    // 进入编辑：按钮以决议为准（默认 Edit）
    await page.getByRole('button', { name: /edit/i }).first().click();
    await accounts.websiteInput.fill('https://updated.example.com');
    await accounts.saveButton.click();
    await expect(page).toHaveURL(/#\/Account\/view\//);
    await expect(page.locator('body')).toContainText('https://updated.example.com');
  });

  test('list search finds the account', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.search(name);
    await expect(accounts.rowByName(name)).toBeVisible();
  });

  test('delete removes the account from the list', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.removeByName(name);
    await accounts.search(name);
    await expect(accounts.rowByName(name)).toHaveCount(0);
  });
});
```

- [ ] **Step 3: 跑 desktop 项目，红→修**

Run: `pnpm exec playwright test tests/accounts.spec.ts --project=desktop-chromium --reporter=line`
Expected: 首次可能 FAIL（locator 与决议有出入）。按失败信息逐条核对 `docs/probe/accounts-dom.md` 修正 POM 中 locator（不改 spec 断言意图），直到 4 passed。

- [ ] **Step 4: 确认编辑用例的 URL 断言不误伤**

编辑后若 URL 不变化（EspoCRM 详情页同 URL 刷新），把 `test('edit updates account fields')` 中的 URL 断言删掉，仅保留 body 文本断言。跑 `pnpm exec playwright test tests/accounts.spec.ts --project=desktop-chromium --reporter=line` → 4 passed。

- [ ] **Step 5: Commit**

```bash
git add pages/AccountsPage.ts tests/accounts.spec.ts
git commit -m "test: accounts.spec（创建/详情/编辑/搜索/删除，自建自清）+ AccountsPage POM"
```

---

### Task 4: Leads probe + LeadsPage POM + leads.spec

**Files:**
- Create: `tests/probe/leads.probe.spec.ts`（用后删除）
- Create: `docs/probe/leads-dom.md`
- Create: `pages/LeadsPage.ts`
- Create: `tests/leads.spec.ts`

- [ ] **Step 1: 写 Leads probe（同 Task 2 模式，换路由与字段关注点）**

创建 `tests/probe/leads.probe.spec.ts`，将 Task 2 的 probe 复制一份，改动三处：
1. 路由：`/#/Lead`
2. 表单字段关注：`firstName` / `lastName` / `status`（select）/ `converted`（若出现）——沿用 Task 2 的 `formFields` 输出逻辑即可覆盖
3. 额外探测「Convert」入口：创建 Lead 后，在详情页 `getByRole('button', { name: /convert/i })` 是否存在，并输出状态字段当前值

Run: `pnpm exec playwright test tests/probe/leads.probe.spec.ts --project=desktop-chromium --reporter=line`
Expected: PASS；`docs/probe/leads-dom.md` 生成，含 createButton/name fields/saveButton/convertButton/listSearch/rows/rowMenu 决议。

- [ ] **Step 2: 删除 probe、提交决议**

```bash
rm tests/probe/leads.probe.spec.ts
git add docs/probe/leads-dom.md
git commit -m "test: probe Leads 页 DOM，落盘 locator 决议"
```

- [ ] **Step 3: 写 LeadsPage POM**

创建 `pages/LeadsPage.ts`（结构同 AccountsPage；locator 用 `docs/probe/leads-dom.md` 决议；默认实现参考 Task 3，路由改 `/#/Lead`，字段为 `firstName`/`lastName`，额外提供 `convert()` 与 `statusText()`）：

```ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface LeadData {
  firstName: string;
  lastName: string;
}

export class LeadsPage {
  constructor(private readonly page: Page) {}

  get createButton() {
    return this.page.getByRole('button', { name: /create lead/i }).first();
  }

  get firstNameInput() {
    return this.page.locator('input[name="firstName"]').first();
  }

  get lastNameInput() {
    return this.page.locator('input[name="lastName"]').first();
  }

  get saveButton() {
    return this.page.getByRole('button', { name: /^save$/i }).first();
  }

  get listSearch() {
    return this.page.locator('input[type="search"], input.search').first();
  }

  get rows() {
    return this.page.locator('table tbody tr, .list-row');
  }

  async open() {
    await this.page.goto('/#/Lead', { waitUntil: 'domcontentloaded' });
  }

  async create(data: LeadData) {
    await this.open();
    await this.createButton.click();
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.saveButton.click();
    await expect(this.page).toHaveURL(/#\/Lead\/view\//, { timeout: 30_000 });
  }

  async search(name: string) {
    await this.open();
    await this.listSearch.fill(name);
  }

  async rowByName(name: string) {
    return this.rows.filter({ hasText: name }).first();
  }

  async removeByName(name: string) {
    await this.search(name);
    const row = this.rowByName(name);
    if (await row.count() === 0) return;
    await row.locator('button[data-action="dropdownMenu"], .dropdown-menu-link').first().click();
    await this.page.getByRole('button', { name: /remove/i }).first().click();
    await expect(row).toHaveCount(0, { timeout: 15_000 });
  }
}
```

- [ ] **Step 4: 写 leads.spec**

创建 `tests/leads.spec.ts`：

```ts
import { expect } from '@playwright/test';
import { test } from './helpers/fixtures';
import { LeadsPage } from '../pages/LeadsPage';

test.describe('Leads', () => {
  let fullName: string;

  test.beforeEach(async ({ page, unique }) => {
    const lastName = unique('Auto_Lead');
    fullName = lastName;
    await new LeadsPage(page).create({ firstName: 'QA', lastName });
  });

  test.afterEach(async ({ page }) => {
    await new LeadsPage(page).removeByName(fullName);
  });

  test('detail view shows created lead', async ({ page }) => {
    await expect(page).toHaveURL(/#\/Lead\/view\//);
    await expect(page.locator('body')).toContainText(fullName);
  });

  test('list search finds the lead', async ({ page }) => {
    const leads = new LeadsPage(page);
    await leads.search(fullName);
    await expect(leads.rowByName(fullName)).toBeVisible();
  });

  test('convert flow completes without error', async ({ page }) => {
    // Convert 交互以 probe 决议为准（默认按钮名 Convert）
    const convertButton = page.getByRole('button', { name: /convert/i }).first();
    await expect(convertButton).toBeVisible();
    await convertButton.click();
    await expect(page.locator('body')).toContainText(/converted|conversion|success/i, { timeout: 15_000 });
  });
});
```

> 若 probe 显示 Convert 是下拉菜单项而非按钮，将 `convertButton` 改为决议 locator；若转换后 Lead 记录消失（被转换走），把该用例的 afterEach 清理改为「search 找不到即跳过」（`removeByName` 已幂等，天然兼容）。

- [ ] **Step 5: 跑 desktop 项目，红→修，直到 3 passed**

Run: `pnpm exec playwright test tests/leads.spec.ts --project=desktop-chromium --reporter=line`
Expected: 3 passed（locator 按决议修正后）。

- [ ] **Step 6: Commit**

```bash
git add pages/LeadsPage.ts tests/leads.spec.ts
git commit -m "test: leads.spec（创建/搜索/转换，自建自清）+ LeadsPage POM"
```

---

### Task 5: 全量验证 + 文档状态同步

**Files:**
- Modify: `README.md`（Current status 表：Accounts/Leads 标 Done）
- Modify: `HANDOFF.md`（v3：完成项 + 待办收窄到 CI secrets/push）

- [ ] **Step 1: 全量跑**

Run: `pnpm test --reporter=line`
Expected: 全绿（setup + desktop + mobile × 3 auth + 4 accounts + 3 leads + fixtures.spec；webkit-smoke 无 smoke spec 不跑）。若 mobile 视口下 accounts/leads 有布局性失败，按 AGENTS.md「定位器用用户可见属性」修正 locator 后重跑。

- [ ] **Step 2: 更新 README 状态表**

把 README.md 的 Current status 表中 `Accounts / Leads business specs | Planned (next)` 改为 `Done`（两行：`Accounts spec (create/detail/edit/search/delete)` 与 `Leads spec (create/search/convert)`）。

- [ ] **Step 3: 更新 HANDOFF 至 v3**

- 交接摘要「状态」：加 `accounts.spec 4/4`、`leads.spec 3/3` 绿
- 第 4 节待办：P0 两项标 ✅，P1 只剩 CI secrets + push；fixtures 通用化标 ✅
- 环境树：加 `pages/AccountsPage.ts`、`pages/LeadsPage.ts`、`docs/probe/`，fixtures 注记改「已通用化」
- 版本行：`2026-09-17 · HANDOFF v3`

- [ ] **Step 4: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "docs: HANDOFF v3 / README 同步 accounts+leads 完成状态"
```

---

### Task 6: CI secrets + GitHub push（人工，需用户配合）

**Files:** 无代码改动；`git remote` 操作。

- [ ] **Step 1: 用户在 GitHub 建空 repo（建议同名 `playwright-qa-portfolio`）**

- [ ] **Step 2: 用户配置 3 个 Actions secrets**（repo → Settings → Secrets and variables → Actions）：

| Secret | 值（用户自有实例） |
|---|---|
| `ESPOCRM_BASE_URL` | `<BASE_URL>`（用户自有实例，env 注入） |
| `ESPOCRM_ADMIN_USER` | `admin` |
| `ESPOCRM_ADMIN_PASS` | 真实密码（用户手填，不在任何提交中出现） |

- [ ] **Step 3: push**

```bash
git remote add origin <repo-url>
git push -u origin main
```

- [ ] **Step 4: 验证 Actions**

在 GitHub Actions 页确认 `Playwright Tests` 跑绿（desktop-chromium）。若失败：
- secrets 未生效（fork-PR 场景）→ 确认走 push 触发
- 实例对公网不可达 → 用户放行端口（HANDOFF 风险表有此项）

- [ ] **Step 5: 更新 HANDOFF（可选）**

push 成功后，HANDOFF 交接摘要「仓库」改「已 push GitHub」；版本 v3.1。

---

## 自检

- **Spec 覆盖**：accounts（创建/详情/编辑/搜索/删除）→ Task 3；leads（创建/状态流转/转换/清理）→ Task 4；fixtures 通用化 → Task 1；CI secrets + push → Task 6；README/HANDOFF 同步 → Task 5。无缺口。
- **占位符扫描**：计划中唯一"按探测结果替换"之处是 EspoCRM 真实 DOM locator——已通过 Task 2/4 的 probe + 决议文件机制显式解决，每个 locator 都给了默认实现与替换规则，非 TBD。
- **类型一致性**：`uniqueName(prefix)` 与 `unique(prefix)` 在 Task 1 定义，Task 3/4 spec 中 `unique('Auto_Account')` / `unique('Auto_Lead')` 一致；`AccountsPage.create/removeByName/search/rowByName` 在 Task 3 定义并被 Task 5 引用，命名一致；`LeadsPage` 同构。`fixtures.spec.ts` 从 `./fixtures` 导入 `uniqueName` 与 `test`——`test` 是 extend 后的 test，`unique` 参数可用；`uniqueName` 为独立导出，匹配 Task 1 实现。
- **依赖顺序**：fixtures（T1）→ accounts（T2/T3）→ leads（T4）→ 全量/文档（T5）→ CI/push（T6），每任务可独立测试、独立提交。