# 作品集开发执行计划 & 交接文档（HANDOFF）

> 交接对象：**后续接手本作品集开发的 Agent**
> 更新：2026-09-14 · 被测 = 自有 **EspoCRM** 实例（唯一被测；**不使用公开 demo**）

## 0. 交接摘要（30 秒）

- **项目**：Playwright + TypeScript 自动化测试作品集（投递 1030 电鸭 CRM QA、反哺主线 QA 自动化叙事）
- **仓库**：本目录 `playwright-qa-portfolio`（本地 git；未 push GitHub）
- **被测**：EspoCRM 实例 `http://<BASE_URL>`，管理员 `admin/**REDACTED**`（经 `.env` 注入，不入库）
- **CI**：Github Actions 打**同一自有实例**（3 个 secrets：`ESPOCRM_BASE_URL` / `ESPOCRM_ADMIN_USER` / `ESPOCRM_ADMIN_PASS`）；**无公开 demo 通道**
- **状态**：env 接入、config、登录 POM、auth.setup(storageState) 完成；**auth.spec 4/4 绿**（~12s）；accounts/leads 等待做
- **下一步**：accounts.spec → leads.spec → CI secrets 配置 → GitHub push

## 1. 决策基线（用户确认，必须遵守）

1. 被测 = 用户自有 EspoCRM 实例；**不用公开 demo 做 CI 被测**
2. 仓库**只做测试工程**，不管理被测部署/编排（无 docker-compose/webServer）
3. 凭据/地址一律 env 注入；`.env` gitignore；**严禁把 `**REDACTED**` 或实例 IP 提交入库**
4. 复数 spec 命名/数据遵循自建自清

## 2. 环境

```
playwright-qa-portfolio/
├── playwright.config.ts   # multi-project + dotenv + channel chrome + 超时范式
├── .env                   # (gitignore) BASE_URL/ADMIN_USER/ADMIN_PASS 真实值
├── .env.example
├── pages/LoginPage.ts     # EspoCRM 登录 POM（实测）
├── tests/
│   ├── auth.setup.ts      # 登录 → storageState
│   ├── auth.spec.ts       # ✅ 4/4 绿
│   └── helpers/fixtures.ts# test.extend：当前 employee → 需通用化
├── .github/workflows/ci.yml  # secrets 注入自有实例
└── README.md              # 已更新（被测=EspoCRM 实例）
```

- deps：`@playwright/test` + `typescript` + `dotenv`（Node 26/npm 11）
- 本地跑：`npx playwright test`；report：`npx playwright show-report`

## 3. 已完成并验证

| 项 | 说明 |
|---|---|
| env/config | `dotenv/config` 导入；`ENV` 导出 BASE_URL/ADMIN；baseURL=ENV.BASE_URL |
| projects | setup / desktop-chromium(+channel chrome) / mobile / webkit-smoke(仅 smoke/)，依赖 setup；`retries CI2:0`、`workers CI1:1`、timeout 90s/nav 120s/expect 15s、trace/shot/video 按需 |
| LoginPage | `input[name=username|password]` + `button · Log in`（实测）；open/login/waitForLoggedIn |
| auth.setup | 登录 → `.navbar` 可见 → storageState `playwright/.auth/user.json` |
| auth.spec | 正确登录 / 错密码（滞留登录页）/ 空字段（`Username can not be empty`）→ 4/4 绿 (11.9s) |
| 元数据 | 仓库更名 `playwright-qa-portfolio`；README/package 更新为 EspoCRM 实例 |

## 4. 待办（接手顺序）

### P0 · 业务 spec（主体）
1. **accounts.spec**：`/#/Account` 创建（唯一后缀名）→ 详情 → 编辑 → 列表搜索 → 删除清理
   - 先跑临时 probe 探测 Accounts 表单/列表/搜索 DOM，再落 spec
2. **leads.spec**：创建 Lead → 状态流转 / 转换 → 断言 → 清理（探测 Lead detail 字段与转换行为）

### P1 · 工程面
3. **CI secrets**：用户在 GitHub repo 配 `ESPOCRM_BASE_URL`/`ESPOCRM_ADMIN_USER`/`ESPOCRM_ADMIN_PASS`（注意：`secrets` 对 fork-PR 不生效，当前 workflow 用 push+workflow_dispatch）
4. **fixtures.ts**：将 `employee` fixture 通用化为唯一数据工厂（`UNIQUE` 后缀沿用)
5. **push**：GitHub 建空 repo（建议同名）`git remote add origin <url>` → `git push -u origin main`（gh 未装，或用 gh 授权后 `gh repo create --source=. --public --push`）

### P2 · 加分
`search-table`（搜索/排序/分页）· `i18n`（切中文判定功能）· `responsive`（3 视口）· `acl`（Administration → Roles）

## 5. 技术备忘 / 易踩坑

- **数据纪律**：自建自清（`Auto_<ts>` + workerIndex），不动预置数据
- **凭据**：`admin/**REDACTED**` 仅存本机 `.env`；日志/报告/README 不得出现密码明文
- **不建 webServer**：被测是用户实例
- **EspoCRM API（可选造数）**：`POST /api/v1/App/user` 以 `Espo-Authorization: Base64(user:pass)` 拿 token，后续 accounts/leads 数据可走 API（P2 增强）
- **别把 `.env`、`test-results/`、`playwright/.auth/` 提交入库**

## 6. 风险与边界

| 风险 | 缓解 |
|---|---|
| CI 打自有实例依赖 secret 与公网可达 | 用户在 GitHub 配 3 secrets；实例端口需对 Actions 放行 |
| 实例被暴力写入 | 仅自建唯一数据并清理；workers 低 |
| 未 push | 用户建 repo 或装 gh |

## 7. 参考

- Playwright：/docs/pom · /test-fixtures · /test-configuration · /auth · /test-retries · /test-parallel · /ci
- 被测入口：`http://<BASE_URL>`（admin/**REDACTED**）

_文档版本：2026-09-14 · HANDOFF v1_