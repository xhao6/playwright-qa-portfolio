# Test Plan — Playwright + EspoCRM QA Portfolio

> **本文档是测试策略真源**：定义测什么、怎么测、如何判定通过。
> 开发规范（定位器/数据/断言纪律）见 [`../AGENTS.md`](../AGENTS.md)。

## 1. Scope

### In scope

| 业务域 | UI（E2E） | API（REST） |
|---|---|---|
| 认证 | 登录正向、错密码、空字段（未登录态） | Basic auth 验证、错密码 401、无凭据 401 |
| Accounts | 创建、详情、编辑、列表搜索（含负向）、删除 | create / get / update / search / delete |
| Leads | 创建、详情、列表搜索（含负向）、转换（convert） | create / get / search / delete |
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
| API | `tests/api/` | REST 契约与 CRUD；Playwright request context，不经过浏览器；每请求 Basic auth（`Espo-Authorization`） |
| Smoke | `tests/smoke/` | WebKit 关键路径冒烟（仅 webkit-smoke project）（预留，待 P2 落地） |
| Probe（临时） | `tests/probe/` | 探测真实 DOM/API 行为，产出决议到 `docs/probe/` 后删除 |

分层原则：UI 测用户可见行为，API 测契约与数据完整性；同一业务域的 UI 与 API 用例互补，不互相依赖。

## 3. Environment & Credentials

- 本地：`BASE_URL` / `ADMIN_USER` / `ADMIN_PASS` 经 `.env`（gitignored）注入
- CI：同 3 变量经 GitHub secrets（`ESPOCRM_BASE_URL` / `ESPOCRM_ADMIN_USER` / `ESPOCRM_ADMIN_PASS`）注入
- 凭据纪律：密码不出现在日志、报告、README、提交历史中；`.env`、`playwright/.auth/`、`test-results/` 已 gitignore
- 实例须对 GitHub Actions 公网可达（否则 CI 全红，本地先行验证）

## 4. Test Data

- **自建自清**：每个用例创建唯一命名数据，结束后清理
- 唯一命名格式：调用方传 `Auto_<prefix>` 前缀 + 工厂追加 `_<ts>_<seq|workerIndex>`（`uniqueName` 用模块级 seq；`unique` fixture 用 workerIndex，同测内重复前缀追加 `_2` 去重）
- 清理幂等：删除前先定位；记录不存在即跳过（支持重复运行；API 软删除天然幂等）
- 不动预置数据；`workers=1`（本地与 CI 一致）避免并发写互扰

## 5. Locator & Assertion Standards

- 定位器优先级：role / text / label / test-id；**禁止** CSS class 与 XPath（DOM 易变）
- UI 断言只用 web-first：`await expect(...)` 自动重试系列（`toBeVisible` / `toHaveText` / `toHaveURL` 等）；**禁止** `isVisible()` 手动断言
- API 断言用同步 `expect(...).toBe()` 等（request 已 await 完成，无 UI 等待语义）
- 探测驱动：断言新页面/新接口前，先用临时 probe 落决议（`docs/probe/`），再写正式 spec

## 6. Execution Matrix

| Project | 设备 | 范围 |
|---|---|---|
| `setup` | — | 认证前置（auth.setup） |
| `desktop-chromium` | Desktop Chrome（channel chrome） | 全量（UI + API） |
| `mobile` | Pixel 5 | UI 全量（`tests/api/` 排除） |
| `webkit-smoke` | Desktop Safari | `tests/smoke/`（预留，尚无 spec） |

```bash
pnpm test                              # 全量（本地）
pnpm test --project=desktop-chromium   # CI 同款：只跑主 project
pnpm test:api                          # 只跑 API 用例（@api tag）
pnpm exec playwright show-report       # 查看 HTML 报告
```

## 7. CI

- GitHub Actions（`.github/workflows/ci.yml`）：`push main` + `workflow_dispatch`
- 安装：`pnpm install --frozen-lockfile` + `pnpm exec playwright install --with-deps chromium`
- 执行：`desktop-chromium` project（含 API）；`retries=2`（CI）、`workers=1`
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

- CI（`desktop-chromium`）绿 且 本地全量绿（setup / desktop-chromium / mobile / webkit-smoke）
- 无 `Auto_` 前缀残留数据（抽查 Accounts / Leads 列表与 API search）
- HTML 报告可查；CI 失败用例有 trace 可诊断（本地失败仅 screenshot）
- 新增/修改的 spec 满足本文件第 4、5 节纪律

## 10. Roadmap（后续可选）

- `search-table`：列表搜索/排序/分页深度用例（当前仅覆盖名称搜索命中与负向）
- `i18n`：切换中文界面后的功能判定用例
- `responsive`：多断点布局断言（计算属性而非纯截图；当前 mobile 仅视口重跑）
- `acl`：Administration → Roles 权限用例（受限角色不可见某模块）
- 补 `tests/smoke/` WebKit 冒烟（登录 + Account 创建/搜索），填上预留空壳
- 用例造数切换 API（提速 + 降 flaky），UI 仅保留一条「UI 创建」契约用例

## 11. References

- [`../AGENTS.md`](../AGENTS.md) — 开发准则（必守规则、架构约定）
- [`probe/`](./probe/) — 真实 DOM/API 决议（探测产物）
- Playwright 官方：best-practices · test-fixtures · pom · ci（完整 URL 见 `../AGENTS.md` 参考节）
- [`target-understanding.md`](./target-understanding.md) — 被测系统理解（模块/字段/实体关系，实测）
