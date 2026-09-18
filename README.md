# Playwright + EspoCRM — QA 自动化测试作品集

基于 **TypeScript + Playwright** 的端到端自动化测试作品集，被测对象为**自有 EspoCRM 实例**（CRM 产品），展示专业级测试工程能力：

- 针对真实 CRM 应用的健壮、自包含的自动化测试
- Page Object Model（POM）+ 类型化 Fixtures + 共享登录态（storageState）
- 多项目矩阵（桌面 / 移动端）+ WebKit 跨浏览器冒烟通道
- GitHub Actions CI：HTML 报告、trace、视频、失败截图产物

## 当前状态

| 模块 | 状态 |
|---|---|
| 环境注入（dotenv，baseURL 取自 env） | ✅ 完成 |
| 登录 POM（`pages/LoginPage.ts`） | ✅ 完成 |
| 共享登录态（`tests/auth.setup.ts` → storageState） | ✅ 完成 |
| 认证套件（`tests/auth.spec.ts`）：正确登录 / 错密码 / 空字段 | ✅ 通过 |
| Accounts spec（`tests/accounts.spec.ts`）：创建 / 详情 / 编辑 / 搜索（含负向）/ 删除 | ✅ 通过 |
| Leads spec（`tests/leads.spec.ts`）：创建 / 搜索（含负向）/ Convert 转换 | ✅ 通过 |
| API 测试层（`tests/api/`）：认证 + Account/Lead CRUD & 搜索 | ✅ 通过（10 用例） |
| 数据工厂 Fixtures（`tests/helpers/fixtures.ts`） | ✅ 完成（`uniqueName` + `unique` fixture） |
| CI workflow（`.github/workflows/ci.yml`） | ✅ 运行中 — Actions 绿（push + workflow_dispatch） |
| GitHub push | ✅ 已推送 `github.com/xhao6/playwright-qa-portfolio`（public） |

> 测试策略见 [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md)，开发规范见 [`AGENTS.md`](./AGENTS.md)。

## 配置

被测实例与凭据通过环境变量注入（`.env`，已 gitignore）：

```bash
cp .env.example .env   # 填入你的 EspoCRM 实例地址与管理员凭据
```

## 快速开始

```bash
pnpm install
pnpm exec playwright install chromium     # Linux CI 上使用 --with-deps
pnpm test                                  # 针对你的实例运行全部 project
pnpm test:api                              # 仅运行 API 用例（@api tag）
pnpm exec playwright show-report           # 查看 HTML 报告
```

## 项目矩阵

| Project | 目标 | 用途 |
|---|---|---|
| `setup` | — | 登录一次 → 持久化 storageState（所有 project 的前置依赖） |
| `desktop-chromium` | Desktop Chrome | 全量套件（UI + API） |
| `mobile` | Pixel 5 | 移动端视口（API 用例排除） |
| `webkit-smoke` | Desktop Safari | 跨浏览器冒烟通道（预留，尚无 spec） |

## 测试纪律

测试遵循**自包含数据**原则（不依赖既有数据）：

- 每个业务 spec 创建唯一命名数据并事后清理（自建自清）
- 并行安全：唯一后缀（`Auto_<ts>` + workerIndex / 模块级 seq）
- 定位器优先用户可见属性（role / text / label / test-id），仅用 Web-first 断言
- 新页面/新接口先 probe 探测真实 DOM/API 落决议（`docs/probe/`），再落正式 spec
- 结果/产物落 `test-results/`（已 gitignore）

## CI（GitHub Actions）

workflow 在 push main 与手动 dispatch 时触发，通过 3 个 secrets 访问同一自有实例：

| Secret | 对应变量 |
|---|---|
| `ESPOCRM_BASE_URL` | `BASE_URL` |
| `ESPOCRM_ADMIN_USER` | `ADMIN_USER` |
| `ESPOCRM_ADMIN_PASS` | `ADMIN_PASS` |

安装 Chromium 后运行 `desktop-chromium` project（retries=2），上传 HTML 报告与 trace/视频/截图产物（保留 30 天）。

> 被测实例为用户自有；凭据视为机密（`BASE_URL` / `ADMIN_USER` / `ADMIN_PASS` 一律注入，永不入库）。