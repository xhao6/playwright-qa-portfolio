# AGENTS.md — Playwright + EspoCRM QA Portfolio 开发准则

> 给接手本仓库的 Agent 的开发规范。执行任何修改前先读本文件与 `docs/TEST_PLAN.md`。

## 项目定位

- Playwright + TypeScript 自动化测试作品集，被测 = **自有 EspoCRM 实例**（凭据经 `.env` 注入，**严禁入库**）
- 只做测试工程：**不建 webServer / docker-compose**，被测是用户实例
- 包管理：**pnpm**（lockfile = `pnpm-lock.yaml`，勿用 npm 生成/提交 `package-lock.json`）
- 状态与路线图：当前状态见 `README.md`，后续可选增强见 `docs/TEST_PLAN.md` 第 10 节

## 必守规则

1. **凭据纪律**：`BASE_URL`/`ADMIN_USER`/`ADMIN_PASS` 只从 env 读；`.env`、`test-results/`、`playwright/.auth/` 永不入库；日志/报告/README 不得出现密码明文
2. **数据纪律**：自建自清 —— 每个业务 spec 创建唯一命名数据（`Auto_<ts>` + workerIndex 后缀），结束后清理；不动预置数据
3. **定位器优先用户可见属性**：role / text / label / test-id，不用 CSS class / XPath（DOM 易变，class 变化即失败）
4. **Web-first 断言**：只用 `await expect(...)` 自动重试的断言（`toBeVisible` 等），不用 `isVisible()` 手动断言
5. **测试隔离**：每个测试独立运行，不依赖其他测试的状态/数据；共享登录态走 `storageState`（auth.setup），负面用例显式重置 `storageState: { cookies: [], origins: [] }`
6. **只测自己控制的内容**：不测第三方/外链/不可控内容

## 架构约定

- **POM**：`pages/*.ts`，每个页面一个类（参考 `pages/LoginPage.ts`：`open/login/waitForLoggedIn` 模式），locator 收敛在 POM 内
- **Fixtures**：`tests/helpers/fixtures.ts` 已通用化——`uniqueName(prefix)`（`Auto_<ts>` + 模块级 seq）与 `unique` fixture（`Auto_<ts>` + workerIndex，同测内去重）；业务 spec 从 fixtures 取数据
- **认证**：`tests/auth.setup.ts` 登录 → storageState `playwright/.auth/user.json`；所有 project 依赖 `setup`
- **spec 命名**：`*.spec.ts` 复数业务名（accounts / leads），smoke 放 `tests/smoke/`（仅 webkit-smoke project 跑）

## 验证命令

```bash
pnpm test                              # 全量（setup + desktop + mobile + webkit-smoke）
pnpm test --project=desktop-chromium   # CI 同款：只跑主 project
pnpm exec playwright show-report       # 查看 HTML 报告
```

- 改动后必须本地跑绿再收尾；断言新行为先探测真实 DOM（临时 probe spec），再落正式 spec
- CI 配置与本地一致：`pnpm install --frozen-lockfile` + `pnpm exec playwright install --with-deps chromium`

## CI / 环境

- GitHub Actions：push main + workflow_dispatch；3 个 secrets（`ESPOCRM_BASE_URL`/`ESPOCRM_ADMIN_USER`/`ESPOCRM_ADMIN_PASS`）注入自有实例；fork-PR secrets 不生效
- 实例需对 Actions 公网可达；retries CI 2 / workers 1
- 本地 node 由 Homebrew 管理；若 node 启动报缺库（如 llhttp dylib），`brew install <缺的库>` 修复

## 参考（Exa 调研固化的权威来源）

- 被测系统理解（模块/字段/实体关系，实机探测）：`docs/target-understanding.md`
- Playwright 官方最佳实践：https://playwright.dev/docs/best-practices
- Playwright CI：https://playwright.dev/docs/ci
- Fixtures：https://playwright.dev/docs/test-fixtures
- POM 与 Fixtures 架构权衡：https://github.com/currents-dev/playwright-best-practices-skill（architecture/pom-vs-fixtures.md）
- EspoCRM + Playwright 已有实践：https://github.com/tuan-engineer/playwright-espocrm · https://github.com/Mukuldev21/espocrm-docker_playwright_E2E_testing