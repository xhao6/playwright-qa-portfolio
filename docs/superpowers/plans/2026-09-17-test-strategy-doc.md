# 测试策略文档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `docs/TEST_PLAN.md`：一份与代码库现状一致的测试策略文档（范围/分层/数据/断言规范/执行矩阵/CI/风险/退出标准），作为作品集的 QA 方法论证据。

**Architecture:** 纯文档任务，单文件产出。内容只写**策略**不写**进度**（进度归 `HANDOFF.md`），因此与并行中的 accounts/leads/API 开发零冲突；文末引用 `AGENTS.md`/`HANDOFF.md` 作为规范与状态的真源。

**Tech Stack:** Markdown；校验用 `rg`/`ls`/`pnpm` 命令验证文档中引用的路径与命令真实存在。

**并行前置（执行本计划前必做）：**

1. 使用 `superpowers:using-git-worktrees` 创建隔离环境：`git worktree add ../pw-qa-docs -b docs/test-plan`
2. 本计划只创建 `docs/TEST_PLAN.md`，**不触碰**任何既有文件（包括 `README.md`/`HANDOFF.md`/`AGENTS.md`）
3. 唯一 merge 风险：无（新文件）；merge 后由主线统一在 README/HANDOFF 中挂链接（可选，见 Task 3）

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `docs/TEST_PLAN.md` | 测试策略真源（scope/layers/data/standards/matrix/CI/risks/exit） | 新建 |

---

### Task 1: 写 `docs/TEST_PLAN.md`

**Files:**
- Create: `docs/TEST_PLAN.md`

- [ ] **Step 1: 创建文件并写入全文**

创建 `docs/TEST_PLAN.md`，内容如下（逐字）：

````markdown
# Test Plan — Playwright + EspoCRM QA Portfolio

> **本文档是测试策略真源**：定义测什么、怎么测、如何判定通过。
> 执行进度见 [`../HANDOFF.md`](../HANDOFF.md)；开发规范（定位器/数据/断言纪律）见 [`../AGENTS.md`](../AGENTS.md)。

## 1. Scope

### In scope

| 业务域 | UI（E2E） | API（REST） |
|---|---|---|
| 认证 | 登录正向、错密码、空字段（未登录态） | token 获取、错密码 401、无凭据 401 |
| Accounts | 创建、详情、编辑、列表搜索、删除 | create / get / update / search / delete |
| Leads | 创建、详情、列表搜索、转换（convert） | create / get / search / delete |
| 跨浏览器 | WebKit 关键路径 smoke | — |
| 移动端 | Pixel 5 视口回归（UI 全量，API 排除） | — |

### Out of scope

- 被测实例的部署与编排（用户自有实例，仓库只做测试工程，不建 webServer/docker-compose）
- 性能 / 负载 / 安全渗透测试
- 第三方外链与不可控内容（遵循「只测自己控制的内容」）
- EspoCRM 自身源码的单元 / 集成测试

## 2. Test Layers

| 层 | 位置 | 职责 |
|---|---|---|
| Auth setup | `tests/auth.setup.ts` | 登录一次 → storageState 复用；所有 project 的前置依赖 |
| UI E2E | `tests/*.spec.ts` | 用户旅程级验证；locator 收敛在 `pages/*.ts`（POM） |
| API | `tests/api/` | REST 契约与 CRUD；Playwright request context，不经过浏览器 |
| Smoke | `tests/smoke/` | WebKit 关键路径冒烟（仅 webkit-smoke project） |
| Probe（临时） | `tests/probe/` | 探测真实 DOM/API 行为，产出决议到 `docs/probe/` 后删除 |

分层原则：UI 测用户可见行为，API 测契约与数据完整性；同一业务域的 UI 与 API 用例互补，不互相依赖。

## 3. Environment & Credentials

- 本地：`BASE_URL` / `ADMIN_USER` / `ADMIN_PASS` 经 `.env`（gitignored）注入
- CI：同 3 变量经 GitHub secrets（`ESPOCRM_BASE_URL` / `ESPOCRM_ADMIN_USER` / `ESPOCRM_ADMIN_PASS`）注入
- 凭据纪律：密码不出现在日志、报告、README、提交历史中；`.env`、`playwright/.auth/`、`test-results/` 已 gitignore
- 实例须对 GitHub Actions 公网可达（否则 CI 全红，本地先行验证）

## 4. Test Data

- **自建自清**：每个用例创建唯一命名数据，结束后清理
- 唯一命名格式：`Auto_<prefix>_<ts>_<workerIndex>`（`tests/helpers/fixtures.ts` 的 `unique` 工厂）
- 清理幂等：删除前先定位；记录不存在即跳过（支持重复运行）
- 不动预置数据；`workers=1`（本地与 CI 一致）避免并发写互扰

## 5. Locator & Assertion Standards

- 定位器优先级：role / text / label / test-id；**禁止** CSS class 与 XPath（DOM 易变）
- 断言只用 web-first：`await expect(...)` 自动重试系列（`toBeVisible` / `toHaveText` / `toHaveURL` 等）；**禁止** `isVisible()` 手动断言
- 探测驱动：断言新页面/新接口前，先用临时 probe 落决议（`docs/probe/`），再写正式 spec

## 6. Execution Matrix

| Project | 设备 | 范围 |
|---|---|---|
| `setup` | — | 认证前置（auth.setup） |
| `desktop-chromium` | Desktop Chrome（channel chrome） | 全量（UI + API） |
| `mobile` | Pixel 5 | UI 全量（`tests/api/` 排除） |
| `webkit-smoke` | Desktop Safari | `tests/smoke/` |

```bash
pnpm test                              # 全量（本地）
pnpm test --project=desktop-chromium   # CI 同款：只跑主 project
pnpm exec playwright show-report       # 查看 HTML 报告
```

## 7. CI

- GitHub Actions（`.github/workflows/ci.yml`）：`push main` + `workflow_dispatch`
- 安装：`pnpm install --frozen-lockfile` + `pnpm exec playwright install --with-deps chromium`
- 执行：`desktop-chromium` project；`retries=2`（CI）、`workers=1`
- 产物（30 天）：HTML report + `test-results/`（失败 trace / video / screenshot）
- fork-PR 场景 secrets 不生效，故用 push + dispatch 触发

## 8. Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| 实例公网不可达 | CI 全红 | 端口对 Actions 放行；本地先验证 |
| 测试数据残留 | 污染实例 | 自建自清 + 幂等清理（afterEach） |
| 定位器随版本漂移 | 假失败 | 用户可见属性 + probe 决议 + POM 收敛 |
| 凭据泄漏 | 安全事故 | env/secrets 注入 + gitignore + 日志纪律 |
| 并发写冲突 | 数据互扰 | workers=1 + 唯一命名 |
| 第三方内容变化 | 不可控失败 | 只测自有实例，不测外链 |

## 9. Exit Criteria

- 所有 project 全绿（至少 `pnpm test --project=desktop-chromium` 与本地全量）
- 无 `Auto_` 前缀残留数据（抽查 Accounts / Leads 列表）
- HTML 报告可查；失败用例有 trace 可诊断
- 新增/修改的 spec 满足本文件第 4、5 节纪律

## 10. References

- [`../AGENTS.md`](../AGENTS.md) — 开发准则（必守规则、架构约定）
- [`../HANDOFF.md`](../HANDOFF.md) — 进度、待办与交接
- [`probe/`](./probe/) — 真实 DOM/API 决议（探测产物）
- Playwright 官方：best-practices · test-fixtures · pom · ci
````

- [ ] **Step 2: 渲染与链接检查**

Run: `rg -n "docs/TEST_PLAN|TEST_PLAN" README.md HANDOFF.md AGENTS.md` 
Expected: 无输出（本计划不改这些文件；若已挂链接属主线行为，不冲突）。

Run: `ls docs/probe/ tests/api/ 2>&1`
Expected: `docs/probe/` 存在（决议目录）；`tests/api/` 若尚未 merge 会报 No such file——**不影响**：TEST_PLAN 是策略文档，API 层为规划目标；若报缺失则继续。

- [ ] **Step 3: 与 AGENTS.md 一致性抽查**

逐条核对文档中以下声明与仓库现状一致（不一致则改文档，不改仓库）：
- 命名格式 `Auto_<prefix>_<ts>_<workerIndex>` ↔ `tests/helpers/fixtures.ts`
- 命令 `pnpm test --project=desktop-chromium` ↔ `package.json` scripts 与 CI workflow
- secrets 名称 ↔ `.github/workflows/ci.yml`

Run: `rg -n "ESPOCRM_" .github/workflows/ci.yml && rg -n "desktop-chromium" .github/workflows/ci.yml`
Expected: 输出含 3 个 secrets 与 `--project=desktop-chromium`，与文档第 3/7 节一致。

- [ ] **Step 4: Commit**

```bash
git add docs/TEST_PLAN.md
git commit -m "docs: 新增测试策略文档 TEST_PLAN.md（范围/分层/数据/CI/风险/退出标准）"
```

---

### Task 2: 交叉引用挂载（可选，merge 后执行）

**Files:**
- Modify: `README.md`（文档导航处加一行链接）
- Modify: `HANDOFF.md`（参考节加链接）

> 与主线文档改动同文件，属**已知冲突面**：仅在主线收尾后执行；冲突时保留双方内容。若主线已自行挂链接，跳过本任务。

- [ ] **Step 1: README 加链接**

在 README.md 的 `## Current status` 表格后（`> Tracked in detail in HANDOFF.md` 引用行下方）加：

```markdown
See [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md) for the full test strategy.
```

- [ ] **Step 2: HANDOFF 参考节加链接**

在 HANDOFF.md 第 7 节参考列表 `- **开发准则**：...` 行后加：

```markdown
- **测试策略**：`docs/TEST_PLAN.md`（范围/分层/数据/CI/风险/退出标准）
```

- [ ] **Step 3: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "docs: README/HANDOFF 挂载 TEST_PLAN 链接"
```

---

### Task 3: merge 回 main

- [ ] **Step 1: merge**

```bash
git checkout main
git merge docs/test-plan --no-ff -m "merge: 测试策略文档 TEST_PLAN.md"
```

Expected: 无冲突（Task 1 为新文件）；若 Task 2 已执行且主线改过 README/HANDOFF，保留双方。

- [ ] **Step 2: 清理 worktree（可选）**

```bash
git worktree remove ../pw-qa-docs
```

---

## 自检

- **Spec 覆盖**：策略文档（范围/分层/环境/数据/断言/矩阵/CI/风险/退出标准）→ Task 1 全文；文档可达性（README/HANDOFF 挂链）→ Task 2；合并 → Task 3。无缺口。
- **占位符扫描**：文档全文逐字给出，无 TBD；Task 1 Step 2 对 `tests/api/` 可能缺失的说明是显式的预期分支（策略文档不依赖 API 已实装），非占位符。
- **类型一致性**：文档内引用的路径（`tests/helpers/fixtures.ts`、`docs/probe/`、`pages/*.ts`、`.github/workflows/ci.yml`）与仓库实际一致；命名格式、命令、secrets 名称三处引用在 Task 1 Step 3 有交叉校验步骤。
- **并行安全**：只新增 `docs/TEST_PLAN.md`；Task 2 的文档挂链是唯一已知冲突面，已限定"主线收尾后执行 + 保留双方"。