# API 测试层 Implementation Plan

> ⚠️ 认证实测见 docs/probe/leads-dom.md：POST /api/v1/App/user 405，用 Espo-Authorization basic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为作品集新增 API 测试层：用 Playwright `request` context 直连 EspoCRM REST API，覆盖认证（token/负向）、Accounts CRUD+搜索、Leads CRUD+搜索，自建自清，并与现有 UI spec 零文件冲突（可并行开发）。

**Architecture:** 新增 `tests/api/` 目录：轻量 `EspoApi` client 封装认证（`Espo-Authorization` → `X-Auth-Token`）与 CRUD；spec 复用 `tests/helpers/fixtures.ts` 的 `unique` 唯一数据工厂（该文件已通用化）；probe 先行探测真实 API 响应（状态码/字段名）再落正式断言；`mobile` project 排除 `tests/api/`，API 只在 desktop-chromium 跑一次。

**Tech Stack:** Playwright 1.63 APIRequestContext（`request` fixture）、TypeScript、pnpm；被测 = 自有 EspoCRM 实例 REST API（`BASE_URL` 经 `.env` 注入）。

**并行前置（执行本计划前必做）：**

1. 使用 `superpowers:using-git-worktrees` 创建隔离环境：`git worktree add ../pw-qa-api -b feat/api-tests`（基于 main 最新 commit，确保包含已通用化的 `tests/helpers/fixtures.ts`）
2. 本计划**不触碰**主线热区：`tests/helpers/fixtures.ts`、`pages/AccountsPage.ts`、`pages/LeadsPage.ts`、`tests/accounts.spec.ts`、`tests/leads.spec.ts`、`README.md`、`HANDOFF.md`（文档同步见 Task 6，merge 时处理）
3. 每个 Task 完成后 `git status` 确认只包含本 Task 的文件

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `tests/probe/api.probe.spec.ts` | 临时探测真实 API 响应（状态码/字段名） | 新建后删除 |
| `docs/probe/api-notes.md` | API 决议（认证 header、状态码、search 语法），后续 spec 数据源 | 新建，提交 |
| `tests/api/helpers/espo-api.ts` | `EspoApi` client：login / create / get / update / remove / search | 新建 |
| `tests/api/auth.api.spec.ts` | API 认证：正确凭据 token / 错密码 / 无凭据 | 新建 |
| `tests/api/accounts.api.spec.ts` | Account API：create+get / update / search / delete→404 | 新建 |
| `tests/api/leads.api.spec.ts` | Lead API：create+get / update / search / delete→404 | 新建 |
| `playwright.config.ts` | mobile project 加 `testIgnore: /api\//`（API 只跑一次） | 修改 |
| `README.md` / `HANDOFF.md` | merge 后状态同步（与主线冲突时保留双方内容） | 修改（Task 6） |

---

### Task 1: probe EspoCRM REST API（临时 spec，产出 API 决议）

**Files:**
- Create: `tests/probe/api.probe.spec.ts`
- Output: `docs/probe/api-notes.md`

> 遵循 AGENTS.md「先探测真实行为，再落正式 spec」。EspoCRM 创建资源返回 200（非 201）、search 语法等以探测为准。

- [ ] **Step 1: 写 probe spec**

创建 `tests/probe/api.probe.spec.ts`：

```ts
import { test } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { ENV } from '../../playwright.config';

test('probe EspoCRM REST API behavior', async ({ request }) => {
  const notes: string[] = [];
  const note = (s: string) => { notes.push(s); console.log(s); };

  const basic = Buffer.from(`${ENV.ADMIN_USER}:${ENV.ADMIN_PASS}`).toString('base64');

  // 1. Auth: POST /api/v1/App/user
  const authRes = await request.post('/api/v1/App/user', {
    headers: { 'Espo-Authorization': basic },
  });
  const authBody = await authRes.json();
  note(`auth: status=${authRes.status()} keys=${Object.keys(authBody).join(',')} token=${typeof authBody.token}`);

  // 2. Wrong password
  const badRes = await request.post('/api/v1/App/user', {
    headers: { 'Espo-Authorization': Buffer.from(`${ENV.ADMIN_USER}:definitely-wrong`).toString('base64') },
  });
  note(`authWrongPass: status=${badRes.status()} body=${JSON.stringify(await badRes.json())}`);

  // 3. No credentials
  const noCredRes = await request.post('/api/v1/App/user');
  note(`authNoCred: status=${noCredRes.status()}`);

  // 4. Account create / get / update / delete (with token)
  const token = authBody.token as string;
  const headers = { 'X-Auth-Token': token };
  const name = `Auto_Probe_${Date.now().toString().slice(-6)}`;

  const created = await request.post('/api/v1/Account', { headers, data: { name } });
  const createdBody = await created.json();
  note(`accountCreate: status=${created.status()} body=${JSON.stringify(createdBody)}`);

  const id = createdBody.id as string;
  const got = await request.get(`/api/v1/Account/${id}`, { headers });
  note(`accountGet: status=${got.status()} name=${(await got.json()).name}`);

  const updated = await request.put(`/api/v1/Account/${id}`, { headers, data: { website: 'https://probe.example.com' } });
  note(`accountUpdate: status=${updated.status()} body=${JSON.stringify(await updated.json())}`);

  const searched = await request.get('/api/v1/Account', {
    headers,
    params: { 'where[0][type]': 'contains', 'where[0][attribute]': 'name', 'where[0][value]': name },
  });
  const searchBody = await searched.json();
  note(`accountSearch: status=${searched.status()} total=${searchBody.total} listLen=${searchBody.list?.length} firstKeys=${searchBody.list?.[0] ? Object.keys(searchBody.list[0]).join(',') : 'n/a'}`);

  const removed = await request.delete(`/api/v1/Account/${id}`, { headers });
  note(`accountDelete: status=${removed.status()} body=${JSON.stringify(await removed.json())}`);

  const gone = await request.get(`/api/v1/Account/${id}`, { headers });
  note(`accountGetAfterDelete: status=${gone.status()}`);

  // 5. Lead fields
  const lead = await request.post('/api/v1/Lead', { headers, data: { firstName: 'QA', lastName: `Auto_Probe_${Date.now().toString().slice(-6)}` } });
  const leadBody = await lead.json();
  note(`leadCreate: status=${lead.status()} body=${JSON.stringify(leadBody)}`);
  if (leadBody.id) await request.delete(`/api/v1/Lead/${leadBody.id}`, { headers });

  mkdirSync('docs/probe', { recursive: true });
  writeFileSync('docs/probe/api-notes.md', '# EspoCRM API probe 决议\n\n' + notes.map((n) => `- ${n}`).join('\n') + '\n');
});
```

- [ ] **Step 2: 跑 probe，确认产出决议文件**

Run: `pnpm exec playwright test tests/probe/api.probe.spec.ts --project=desktop-chromium --reporter=line`
Expected: PASS；控制台与 `docs/probe/api-notes.md` 出现 auth/accountCreate/accountSearch/accountDelete/leadCreate 等行为记录。

- [ ] **Step 3: 阅读输出，确认决议要点**

确保 `docs/probe/api-notes.md` 能回答（若与下面默认假设不同，**后续 Task 以决议为准**）：
- 认证成功状态码（默认 200）+ token 字段名（默认 `token`）
- 错密码 / 无凭据状态码（默认 401）
- Account 创建状态码（默认 200，EspoCRM 非 201）+ 响应 `id`
- PUT/DELETE 状态码（默认 200）、删除后 GET（默认 404）
- search 参数语法（`where[0][type]=contains`）与响应结构（默认 `{ total, list }`）
- Lead 创建所需最小字段（默认 `firstName` + `lastName`）

- [ ] **Step 4: 删除临时 probe，提交决议**

```bash
rm tests/probe/api.probe.spec.ts
git add docs/probe/api-notes.md
git commit -m "test: probe EspoCRM REST API 行为，落盘 API 决议"
```

---

### Task 2: EspoApi client + auth.api.spec

**Files:**
- Create: `tests/api/helpers/espo-api.ts`
- Create: `tests/api/auth.api.spec.ts`
- Read first: `docs/probe/api-notes.md`

- [ ] **Step 1: 写 EspoApi client**

创建 `tests/api/helpers/espo-api.ts`（状态码/字段名以决议为准，下为默认实现）：

```ts
import type { APIRequestContext } from '@playwright/test';
import { ENV } from '../../../playwright.config';

export class EspoApi {
  private token = '';

  constructor(private readonly request: APIRequestContext) {}

  async login(): Promise<void> {
    const res = await this.request.post('/api/v1/App/user', {
      headers: {
        'Espo-Authorization': Buffer.from(
          `${ENV.ADMIN_USER}:${ENV.ADMIN_PASS}`,
        ).toString('base64'),
      },
    });
    if (!res.ok()) throw new Error(`EspoCRM auth failed: ${res.status()}`);
    this.token = ((await res.json()) as { token: string }).token;
  }

  private get authHeaders() {
    return { 'X-Auth-Token': this.token };
  }

  async create(entity: string, data: Record<string, unknown>) {
    const res = await this.request.post(`/api/v1/${entity}`, {
      headers: this.authHeaders,
      data,
    });
    return { status: res.status(), body: (await res.json()) as { id: string } };
  }

  async get(entity: string, id: string) {
    const res = await this.request.get(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
    });
    return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
  }

  async update(entity: string, id: string, data: Record<string, unknown>) {
    const res = await this.request.put(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
      data,
    });
    return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
  }

  async remove(entity: string, id: string) {
    const res = await this.request.delete(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
    });
    return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
  }

  async search(entity: string, attribute: string, value: string) {
    const res = await this.request.get(`/api/v1/${entity}`, {
      headers: this.authHeaders,
      params: {
        'where[0][type]': 'contains',
        'where[0][attribute]': attribute,
        'where[0][value]': value,
      },
    });
    return {
      status: res.status(),
      body: (await res.json()) as { total: number; list: Array<Record<string, unknown>> },
    };
  }
}
```

- [ ] **Step 2: 写 auth.api.spec**

创建 `tests/api/auth.api.spec.ts`（不依赖 storageState；`request` context 独立）：

```ts
import { expect, test } from '@playwright/test';
import { ENV } from '../../playwright.config';

test.describe('API auth', () => {
  test('valid admin credentials return a token', async ({ request }) => {
    const res = await request.post('/api/v1/App/user', {
      headers: {
        'Espo-Authorization': Buffer.from(
          `${ENV.ADMIN_USER}:${ENV.ADMIN_PASS}`,
        ).toString('base64'),
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });

  test('wrong password is rejected', async ({ request }) => {
    const res = await request.post('/api/v1/App/user', {
      headers: {
        'Espo-Authorization': Buffer.from(`${ENV.ADMIN_USER}:definitely-wrong`).toString('base64'),
      },
    });
    expect(res.status()).toBe(401);
  });

  test('missing credentials are rejected', async ({ request }) => {
    const res = await request.post('/api/v1/App/user');
    expect(res.status()).toBe(401);
  });
});
```

> 若决议显示负向状态码不是 401（如 403），把上面两处 `toBe(401)` 改为决议值。

- [ ] **Step 3: 跑测试**

Run: `pnpm exec playwright test tests/api/auth.api.spec.ts --project=desktop-chromium --reporter=line`
Expected: 3 passed。

- [ ] **Step 4: Commit**

```bash
git add tests/api/helpers/espo-api.ts tests/api/auth.api.spec.ts
git commit -m "test: EspoApi client + API 认证 spec（token/错密码/无凭据）"
```

---

### Task 3: accounts.api.spec（CRUD + 搜索）

**Files:**
- Create: `tests/api/accounts.api.spec.ts`

- [ ] **Step 1: 写 spec**

创建 `tests/api/accounts.api.spec.ts`（每个用例独立：beforeEach 创建 + afterEach 幂等删除）：

```ts
import { expect } from '@playwright/test';
import { test, uniqueName } from '../helpers/fixtures';
import { EspoApi } from './helpers/espo-api';

test.describe('Accounts API', () => {
  let api: EspoApi;
  let accountId: string;
  let name: string;

  test.beforeEach(async ({ request }) => {
    api = new EspoApi(request);
    await api.login();
    name = uniqueName('Auto_ApiAccount');
    const created = await api.create('Account', { name });
    expect(created.status).toBe(200);
    accountId = created.body.id;
  });

  test.afterEach(async () => {
    await api.remove('Account', accountId);
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

  test('delete removes the record', async () => {
    const res = await api.remove('Account', accountId);
    expect(res.status).toBe(200);
    const after = await api.get('Account', accountId);
    expect(after.status).toBe(404);
  });
});
```

> `uniqueName` 来自 `tests/helpers/fixtures.ts`（已通用化，Task 前置已确认）。若创建状态码决议不同（非 200），改 `beforeEach` 中 `toBe(200)`。

- [ ] **Step 2: 跑测试**

Run: `pnpm exec playwright test tests/api/accounts.api.spec.ts --project=desktop-chromium --reporter=line`
Expected: 4 passed（若字段/状态码与实例不符，按 `docs/probe/api-notes.md` 修正断言）。

- [ ] **Step 3: 确认无数据残留**

Run: `pnpm exec playwright test tests/api/accounts.api.spec.ts --project=desktop-chromium --reporter=line`
Expected: 再次 4 passed（证明清理幂等、可重复运行）。

- [ ] **Step 4: Commit**

```bash
git add tests/api/accounts.api.spec.ts
git commit -m "test: Account API spec（create/get/update/search/delete，自建自清）"
```

---

### Task 4: leads.api.spec（CRUD + 搜索）

**Files:**
- Create: `tests/api/leads.api.spec.ts`

- [ ] **Step 1: 写 spec**

创建 `tests/api/leads.api.spec.ts`：

```ts
import { expect } from '@playwright/test';
import { test, uniqueName } from '../helpers/fixtures';
import { EspoApi } from './helpers/espo-api';

test.describe('Leads API', () => {
  let api: EspoApi;
  let leadId: string;
  let lastName: string;

  test.beforeEach(async ({ request }) => {
    api = new EspoApi(request);
    await api.login();
    lastName = uniqueName('Auto_ApiLead');
    const created = await api.create('Lead', { firstName: 'QA', lastName });
    expect(created.status).toBe(200);
    leadId = created.body.id;
  });

  test.afterEach(async () => {
    await api.remove('Lead', leadId);
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

  test('delete removes the record', async () => {
    const res = await api.remove('Lead', leadId);
    expect(res.status).toBe(200);
    const after = await api.get('Lead', leadId);
    expect(after.status).toBe(404);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm exec playwright test tests/api/leads.api.spec.ts --project=desktop-chromium --reporter=line`
Expected: 3 passed。

- [ ] **Step 3: Commit**

```bash
git add tests/api/leads.api.spec.ts
git commit -m "test: Lead API spec（create/get/search/delete，自建自清）"
```

---

### Task 5: project 矩阵调整 + 全量验证

**Files:**
- Modify: `playwright.config.ts:43-46`（mobile project 加 `testIgnore`）

- [ ] **Step 1: mobile project 排除 API spec**

修改 `playwright.config.ts` 的 `mobile` project（当前内容）：

```ts
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], channel: 'chrome' },
      dependencies: ['setup'],
    },
```

改为：

```ts
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], channel: 'chrome' },
      testIgnore: /api\//,
      dependencies: ['setup'],
    },
```

> 理由：API spec 与视口无关，避免在 desktop + mobile 重复执行。`webkit-smoke` 已有 `testMatch: /smoke\//`，天然不跑 API。

- [ ] **Step 2: 全量跑 desktop**

Run: `pnpm exec playwright test --project=desktop-chromium --reporter=line`
Expected: 全绿（既有 auth/accounts/leads UI spec + 新增 10 个 API 用例；数量以主线当前为准）。

- [ ] **Step 3: 全量跑 mobile，确认 API 被排除**

Run: `pnpm exec playwright test --project=mobile --reporter=line`
Expected: 绿；输出中**无** `tests/api/` 用例。

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: mobile project 排除 API spec（API 与视口无关，只跑一次）"
```

---

### Task 6: merge 回 main + 文档同步

**Files:**
- Modify: `README.md`（Current status 表加 API 行）
- Modify: `HANDOFF.md`（完成项加 API 层）

> 此时主线 accounts/leads 计划可能已 merge 并改过这两个文件。冲突时**保留双方内容**（状态表合并、完成项叠加），不要丢弃主线改动。

- [ ] **Step 1: merge 前先在 main 验证无冲突面**

Run: `git -C <main-worktree> log --oneline -5 && git status`
确认主线已把 accounts/leads 收尾提交；若主线仍在进行，等待其 Task 5 完成后再 merge。

- [ ] **Step 2: merge 分支**

```bash
git checkout main
git merge feat/api-tests --no-ff -m "merge: API 测试层（认证/Account/Lead CRUD + 搜索）"
```

若 `playwright.config.ts` 与 `README.md` / `HANDOFF.md` 冲突：config 保留 `testIgnore`（主线未改 config）；文档保留双方。

- [ ] **Step 3: 更新 README 状态表**

在 README.md 的 Current status 表中，`Data factory fixtures...` 行之后插入：

```markdown
| API tests (`tests/api/`): auth + Account/Lead CRUD & search | Done |
```

- [ ] **Step 4: 更新 HANDOFF**

- 交接摘要「状态」追加：`API 层 10/10 绿（tests/api/）`
- 第 3 节完成表加一行：`API 层 | EspoApi client + auth/accounts/leads API spec；mobile 排除 API`
- 第 5 节技术备忘「EspoCRM API」条目改为已落地描述（认证 header、search where 语法引用 `docs/probe/api-notes.md`）
- 版本行升 `HANDOFF v3.1`

- [ ] **Step 5: 全量验证 + 提交**

Run: `pnpm test --project=desktop-chromium --reporter=line`
Expected: 全绿。

```bash
git add README.md HANDOFF.md
git commit -m "docs: 同步 API 测试层完成状态（README/HANDOFF）"
```

- [ ] **Step 6: 清理 worktree（可选）**

```bash
git worktree remove ../pw-qa-api
```

---

## 自检

- **Spec 覆盖**：API 认证（Task 2）✓；Accounts CRUD+搜索（Task 3）✓；Leads CRUD+搜索（Task 4）✓；探测驱动（Task 1）✓；不重复跑 API（Task 5）✓；文档同步（Task 6）✓。无缺口。
- **占位符扫描**：唯一"以探测为准"点是 EspoCRM 真实状态码/字段名，已由 Task 1 probe + `docs/probe/api-notes.md` 决议机制显式解决（默认值全部给出，替换规则明确），非 TBD。
- **类型一致性**：`EspoApi` 的 `login/create/get/update/remove/search` 在 Task 2 定义，Task 3/4 调用签名一致；`uniqueName(prefix)` 与已提交的 `tests/helpers/fixtures.ts` 导出一致；`{ status, body }` 返回形状在 spec 断言中一致。
- **并行安全**：本计划文件清单与主线（accounts/leads/CI）零重叠；`playwright.config.ts` 主线计划未触碰；唯一交汇点是 Task 6 的 merge 文档同步，已写明冲突保留策略。