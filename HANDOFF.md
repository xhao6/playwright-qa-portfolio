# 作品集开发执行计划 & 交接文档（HANDOFF）

> 交接对象：**后续接手本作品集开发的 Agent**
> 更新：2026-09-17 · 被测 = 自有 **EspoCRM** 实例（唯一被测；**不使用公开 demo**）

## 0. 交接摘要（30 秒）

- **项目**：Playwright + TypeScript 自动化测试作品集（投递 1030 电鸭 CRM QA、反哺主线 QA 自动化叙事）
- **仓库**：本目录 `playwright-qa-portfolio`（本地 git；未 push GitHub）
- **被测**：EspoCRM 实例（`<BASE_URL>`，经 `.env` 注入，不入库）；管理员凭据 `ADMIN_USER` / `ADMIN_PASS`（经 `.env` 注入，不入库）
- **CI**：Github Actions 打**同一自有实例**（3 个 secrets：`ESPOCRM_BASE_URL` / `ESPOCRM_ADMIN_USER` / `ESPOCRM_ADMIN_PASS`）；**无公开 demo 通道**
- **包管理**：**pnpm**（`pnpm-lock.yaml` 已生成；CI 用 `pnpm install --frozen-lockfile`）
- **状态**：env 接入、config、登录 POM、auth.setup(storageState) 完成；**auth.spec 3/3 绿**；**accounts.spec 5 用例（含搜索负向控制）绿**；**leads.spec 4 用例（含搜索负向控制 + Convert）绿**；**fixtures 通用化完成（uniqueName + unique fixture）**；**全量 29/29 绿**（desktop + mobile，~2m）
- **下一步**：CI secrets 配置 → GitHub push

## 1. 决策基线（用户确认，必须遵守）

1. 被测 = 用户自有 EspoCRM 实例；**不用公开 demo 做 CI 被测**
2. 仓库**只做测试工程**，不管理被测部署/编排（无 docker-compose/webServer）
3. 凭据/地址一律 env 注入；`.env` gitignore；**严禁把管理员密码或实例地址明文提交入库**
4. 复数 spec 命名/数据遵循自建自清

## 2. 环境

```
playwright-qa-portfolio/
├── AGENTS.md              # ✅ 开发准则（Exa 调研固化；接手前必读）
├── playwright.config.ts   # multi-project + dotenv + channel chrome + 超时范式
├── .env                   # (gitignore) BASE_URL/ADMIN_USER/ADMIN_PASS 真实值
├── .env.example
├── pages/LoginPage.ts     # EspoCRM 登录 POM（实测）
├── pages/AccountsPage.ts  # Accounts 列表/详情/编辑/搜索/删除 POM（probe 决议）
├── pages/LeadsPage.ts     # Leads 创建/搜索/删除/Convert POM（probe 决议）
├── tests/
│   ├── auth.setup.ts      # 登录 → storageState
│   ├── auth.spec.ts       # ✅ 3/3 绿
│   ├── accounts.spec.ts   # ✅ 5/5 绿（创建/详情/编辑/搜索×2/删除；自建自清）
│   ├── leads.spec.ts      # ✅ 4/4 绿（创建/搜索×2/Convert；转换产物走 API 清理）
│   ├── helpers/fixtures.ts# ✅ 已通用化：uniqueName + unique fixture（Auto_<ts>+workerIndex）
│   └── helpers/fixtures.spec.ts # ✅ fixtures 自测 2/2
├── docs/
│   ├── target-understanding.md # 被测全局理解（模块/字段/实体关系，实测）
│   └── probe/accounts-dom.md · probe/leads-dom.md # probe 决议（locator 依据）
├── .github/workflows/ci.yml  # secrets 注入自有实例（pnpm）
└── README.md              # 已更新（被测=EspoCRM 实例；pnpm 命令）
```

- deps：`@playwright/test` + `typescript` + `dotenv`（Node 26/pnpm 11）
- 本地跑：`pnpm test`；report：`pnpm exec playwright show-report`

## 3. 已完成并验证

| 项 | 说明 |
|---|---|
| env/config | `dotenv/config` 导入；`ENV` 导出 BASE_URL/ADMIN；baseURL=ENV.BASE_URL |
| projects | setup / desktop-chromium(+channel chrome) / mobile / webkit-smoke(仅 smoke/)，依赖 setup；`retries CI2:0`、`workers CI1:1`、timeout 90s/nav 120s/expect 15s、trace/shot/video 按需 |
| LoginPage | `input[name=username|password]` + `button · Log in`（实测）；open/login/waitForLoggedIn |
| auth.setup | 登录 → `.navbar` 可见 → storageState `playwright/.auth/user.json` |
| auth.spec | 正确登录 / 错密码（滞留登录页）/ 空字段（`can not be empty`）→ 3/3 绿 (~18s) |
| probe | Accounts/Leads 页 DOM 探测落盘 `docs/probe/accounts-dom.md`、`docs/probe/leads-dom.md`（locator 决议依据，已脱敏）；`docs/target-understanding.md` 全局理解入库 |
| AccountsPage + accounts.spec | 创建（`unique('Auto_Account')`）→ 详情 → 编辑 website → 列表搜索（命中 + 负向控制 `Auto_zzz_no_such_record`）→ 删除清理；5/5 绿；locator 收敛 POM |
| LeadsPage + leads.spec | 创建 Lead → 详情 → 列表搜索（命中 + 负向控制）→ **Convert**（断言 status=Converted、Convert 按钮消失）；4/4 绿；**转换产物 Account/Contact/Opportunity 走 API 清理**（`Espo-Authorization` + 删除 `createdAccountId/createdContactId/createdOpportunityId`），失败仅 console.error 不掩盖断言 |
| fixtures | `uniqueName(prefix)` + `unique` fixture（`Auto_<ts>` + workerIndex + 同测内去重），自测 2/2 绿 |
| 元数据 | 仓库更名 `playwright-qa-portfolio`；README/package 更新为 EspoCRM 实例；切 **pnpm**（删 package-lock.json，CI/README/HANDOFF 同步）；新增 `AGENTS.md` 开发准则 |

## 4. 待办（接手顺序）

### P0 · 业务 spec（主体）✅ 已完成
1. ✅ **accounts.spec**：`/#/Account` 创建（唯一后缀名）→ 详情 → 编辑 → 列表搜索（含负向控制）→ 删除清理 → 5/5 绿（先 probe 再落 spec）
2. ✅ **leads.spec**：创建 Lead → 详情 → 列表搜索（含负向控制）→ 转换 → 断言 → 清理（转换产物走 API 清理）→ 4/4 绿（先 probe 再落 spec）

### P1 · 工程面（剩余）
3. **CI secrets**：用户在 GitHub repo 配 `ESPOCRM_BASE_URL`/`ESPOCRM_ADMIN_USER`/`ESPOCRM_ADMIN_PASS`（注意：`secrets` 对 fork-PR 不生效，当前 workflow 用 push+workflow_dispatch）
4. ✅ ~~**fixtures.ts**~~：已通用化为唯一数据工厂（`uniqueName` + `unique` fixture，`Auto_<ts>` + workerIndex 沿用）
5. **push**：GitHub 建空 repo（建议同名）`git remote add origin <url>` → `git push -u origin main`（gh 未装，或用 gh 授权后 `gh repo create --source=. --public --push`）

### P2 · 加分（后续可选）
- `search-table`（搜索/排序/分页）· `i18n`（切中文判定功能）· `responsive`（3 视口）· `acl`（Administration → Roles）
- **API 测试层**：`Espo-Authorization` 认证通道已探明（见 §5），计划见 `docs/superpowers/plans/2026-09-17-api-test-layer.md`
- **测试策略文档**：计划见 `docs/superpowers/plans/2026-09-17-test-strategy-doc.md`

## 5. 技术备忘 / 易踩坑

- **数据纪律**：自建自清（`Auto_<ts>` + workerIndex），不动预置数据
- **凭据**：管理员凭据（`ADMIN_USER`/`ADMIN_PASS`）仅存本机 `.env`；日志/报告/README 不得出现密码明文
- **不建 webServer**：被测是用户实例
- **EspoCRM API（可选造数）**：`POST /api/v1/App/user` 以 `Espo-Authorization: Base64(user:pass)` 拿 token，后续 accounts/leads 数据可走 API（P2 增强）
- **别把 `.env`、`test-results/`、`playwright/.auth/` 提交入库**；也别用 npm 生成/提交 `package-lock.json`（包管理统一 pnpm）
- **node 启动报缺库**（如 llhttp dylib）：`brew install <缺的库>` 修复；node 由 Homebrew 管理

## 6. 风险与边界

| 风险 | 缓解 |
|---|---|
| CI 打自有实例依赖 secret 与公网可达 | 用户在 GitHub 配 3 secrets；实例端口需对 Actions 放行 |
| 实例被暴力写入 | 仅自建唯一数据并清理；workers 低 |
| 未 push | 用户建 repo 或装 gh |

## 7. 参考

- **开发准则**：`AGENTS.md`（接手必读；含 6 条必守规则 + Exa 调研固化的权威来源）
- Playwright：/docs/pom · /test-fixtures · /test-configuration · /auth · /test-retries · /test-parallel · /ci
- 被测入口：`<BASE_URL>`（env 注入；凭据 `ADMIN_USER`/`ADMIN_PASS`，见 `.env.example`）

_文档版本：2026-09-17 · HANDOFF v3_