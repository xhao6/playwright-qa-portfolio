# Leads 页 DOM 探测决议（2026-09-17）

> 来源：临时 probe spec `tests/probe/leads.probe.spec.ts` + `leads.convert.probe.spec.ts`（已删除）对自有 EspoCRM 实例（`<BASE_URL>`）的真实 DOM 探测。
> 用法：`pages/LeadsPage.ts` 与 `tests/leads.spec.ts` 的 locator 一律以本文件为准。

## Leads Locator 决议

| 项 | 最终 locator | 依据/证据 |
|---|---|---|
| `createButton` | `page.locator('a[data-action="create"]')` | 与 Accounts 同构：`<a data-name="create" data-action="create" class="btn action btn-default btn-xs-wide main-header-manu-action" href="#Lead/create" title="Ctrl+Space">`。**是 `<a>` 不是 `<button>`**（getByRole button create count=0）。点击后 URL `#Lead/create`（无前导斜杠） |
| `firstNameInput` | `page.locator('input[data-name="firstName"]')` | 创建表单 First Name 字段，count=1，placeholder="First Name" |
| `lastNameInput` | `page.locator('input[data-name="lastName"]')` | 创建表单 Last Name 字段，count=1，placeholder="Last Name" |
| `saveButton` | `page.locator('button[data-action="save"]')` | `<button data-name="save" data-action="save" class="btn action btn-primary detail-action-item btn-xs-wide" type="button" title="Ctrl+Enter">Save</button>`（与 Accounts 同构） |
| `listSearch` | `page.locator('input[data-name="textFilter"]')` | 列表搜索框，**placeholder=null**，count=1；**fill+Enter 才触发过滤**（功能验证：fill zzz_no_such → rows=0；fill 唯一 lastName → rows=1）；与 Accounts 同构 |
| `rowLocator` | `page.locator('table tbody tr[data-id]')` | 行 `<tr data-id="…" class="list-row ">`。**注意：Lead 行名是复合名 "QA Auto_Probe_xxx"**（firstName + lastName），名称单元格 `td[data-name="name"] a.link`（href=`#Lead/view/<id>`，title=全名）——**行过滤用 `{ hasText: <lastName> }` 足够唯一**（Auto_ 前缀在 lastName 上） |
| `rowMenu` | `row.locator('.list-row-buttons button.dropdown-toggle')` | 行尾 `td[data-name="buttons"]` 内 dropdown-toggle（无 data-action，与 Accounts 同构） |
| `removeAction` | `row.locator('.dropdown-menu a[data-action="quickRemove"]')` | 行内菜单三项 View/Edit/Remove（quickRemove），与 Accounts 完全一致 |
| 删除确认弹窗 | `page.locator('.modal-dialog')`，确认 `button[data-name="confirm"]`、取消 `button[data-name="cancel"]` | 弹窗文案 `Are you sure you want to remove the record?`，与 Accounts 完全一致 |
| `detailNameField` | `page.locator('.field[data-name="name"]')` | 详情页 Name 字段 count=1（值=全名），与 Accounts 同构 |
| `detailStatusField` | `page.locator('.field[data-name="status"]')` | 详情页 Status 字段 count=1，创建后值 `New` |

## Convert 流程（与 Accounts 最大差异：是**向导页**不是弹窗）

- **入口**：详情页 `button[data-action="convert"]`（`<button data-name="convert" data-action="convert" class="btn action btn-default btn-xs-wide main-header-manu-action" type="button">Convert</button>`，count=1；getByRole button /convert/i 亦可）。点击后**整页跳转**到向导页 `#/Lead/convert/id=<leadId>`（**无 modal**，`modals: count=0`）
- **向导页结构**：三个 scope 区块 Account / Contact / Opportunity，各区块复选框 **默认未勾选**：
  - 复选框：`input[type="checkbox"].check-scope[data-scope="Account|Contact|Opportunity"]`（form-checkbox，勾选需 `check({ force: true })`，label 包着）
  - 区块容器：`.edit[data-scope="Account|Contact|Opportunity"]`（内嵌多行 form-grid，含 `input[data-name="name"]` 等）
- **提交按钮**：向导页 `button[data-action="convert"]`（`<button data-action="convert" class="btn btn-primary">Convert</button>`，count=1；另有 `button[data-action="cancel"]` Cancel）
- **必填校验**（未填直接点 Convert）：
  - 不勾任何 scope → 弹 `Select at least one record`
  - 勾了但缺必填 → body 出现 `Not valid`（`DIV.alert.alert-danger`），且对应 cell 标 `.has-error`（实测 Account Name、Contact Name*、Opportunity Name/Amount*/Close Date* 为必填）
- **成功转换必要步骤（实测 Probe 16 通过）**：
  1. 勾选三个 scope 复选框（`check({ force: true })`）
  2. Account 区块 `input[data-name="name"]` fill 账户名（Account 区块内唯一；全页 `input[data-name="name"]` count=2 = Account + Opportunity，必须区块限定）
  3. Opportunity 区块 `input[data-name="name"]` fill 商机名
  4. **Amount 陷阱**：`input[data-name="amount"]`（numeric-text，pattern `[\-]?[0-9,.]*`）**`fill()` 会被清空（value 变空、has-error）**！必须 `click()` 聚焦后 `pressSequentially('1000')` → 显示 `1,000`，Tab/失焦后变 `1,000.00`。`fill` 不触发 numeric 格式化 handler 被还原
  5. **Close Date 陷阱**：`input[data-name="closeDate"]` **fill 后会弹出 datepicker 且 fill 值不生效**（`value=` 空），`fill('31.12.2026')` 后 closeDate cell 无值、点 Convert 报 Not valid。**正确做法：`fill('31.12.2026')` 后 `press('Enter')` 确认** → 值变 `17.09.2026`（今天，datepicker 选中），cell 无 has-error。**禁按 Escape**：Escape 关 datepicker 但值也被清空（实测 closeDate now: 空）
  6. 点 `button[data-action="convert"]` 提交
- **转换后**：跳回详情页 `#/Lead/view/<id>`（**URL 带前导斜杠 `#/Lead/view/`**，注意 create 后是 `#Lead/view/` 无斜杠，正则用 `/#\/?Lead\/view\//`），Lead 状态变 **Converted**（`statusValue: Converted`，body 含 `Converted To Account <名> Contact <全名> Opportunity <名>`），**Convert 按钮消失**（count=0），详情页无独立 Actions 下拉
- **API 佐证**：转换后 Lead `status=Converted`、`convertedAt` 有值、`createdAccountId/createdContactId/createdOpportunityId` 均回填（**转换会创建 Account+Contact+Opportunity 三实体**——spec 清理时需一并处理）
- **API 认证（本次探测发现，`docs/superpowers/plans/2026-09-17-api-test-layer.md` 的 POST 方案与实例不符）**：EspoCRM 10.0.8 实例 **`POST /api/v1/App/user` 返回 405**；**`GET /api/v1/App/user` + `Espo-Authorization: Base64(user:pass)` 返回 200 带 token**；**业务 API（Lead/Account 等）直接用 `Espo-Authorization` basic header 即可**（`X-Auth-Token` 反而 401）。DELETE `/api/v1/Lead/<id>` 200（软删）。leadKeys 含 `createdAccountId` 等转换回填字段

## 与 Accounts 一致的陷阱（沿用 accounts-dom.md 决议）

- 创建表单输入控件无 `name` 属性，用 `data-name`；SPA 异步渲染需等关键元素可见
- 行点击不导航：必须点名称链接 `td[data-name="name"] a.link`
- `open()` 同 URL 无导航（hash 相同 no-op）
- 删除 XHR 慢（30–90s）、乐观移除先行；`removeByName` 用 waitForResponse 匹配 `DELETE /api/v1/Lead/` + poll-wait 行出现 + networkidle 兜底
- 搜索重放陷阱：`inputValue()` 相同则跳过 fill+Enter（AccountsPage 同款逻辑）
- 创建后落在详情视图（`#Lead/view/<id>` 无斜杠），detailNameField 可见

## 原始探测输出（精选，完整见 git 历史 docs/probe/leads-dom.md）

### 列表 / 创建表单

```
createHtml: <a data-name="create" data-action="create" class="btn action btn-default btn-xs-wide main-header-manu-action" href="#Lead/create" title="Ctrl+Space"><span class="fas fa-plus fa-sm"></span><span>Create Lead</span></a>
listQuickSearch(textFilter): count=1 placeholder=null
afterCreateClick url: <BASE_URL>/#Lead/create
firstName: count=1
lastName: count=1
status(select): count=1
saveHtml: <button data-name="save" data-action="save" class="btn action btn-primary detail-action-item btn-xs-wide" type="button" title="Ctrl+Enter">Save</button>
```

### 行 / 行菜单 / 搜索

```
rowHtml: <tr data-id="…" class="list-row ">…<td class="cell" data-name="name">…<a href="#Lead/view/…" class="link" data-id="…" title="QA Auto_Probe_258804">QA Auto_Probe_258804</a>…<td class="cell" data-name="status">…<span class="label …" title="New">New</span>
nameCellLink(td[data-name="name"] a.link): count=1
rowMenu items: ["View","Edit","Remove"]
quickRemove: count=1
modalText: Are you sure you want to remove the record? Cancel Remove
search zzz: rows=0
search lastName: rows=1
rowClickNav url: <BASE_URL>/#Lead/view/<id>（无前导斜杠）
```

### Convert 向导

```
convertButton(button[data-action="convert"]): count=1 html=<button data-name="convert" data-action="convert" class="btn action btn-default btn-xs-wide main-header-manu-action" type="button">Convert</button>
afterConvertClick url: <BASE_URL>/#Lead/convert/id=<leadId>   ← 向导页，非 modal
wizard checkboxes: count=3  checkboxInfo: [{"data-scope":"Account","checked":false},{"data-scope":"Contact","checked":false},{"data-scope":"Opportunity","checked":false}]
wizard convert-submit(button[data-action="convert"]): count=1  cancel: count=1
postSubmit bodySlice: … Select at least one record   ← 不勾 scope 直接提交
postConvert bodySlice: … Not valid   ← 缺必填（Amount*/Close Date* 等 .has-error）
amount[0] cls=numeric-text: after pressSequentially "1,000" → Tab "1,000.00"   ← fill() 会被清空
closeDate: fill('31.12.2026')+Enter → 17.09.2026（datepicker 确认），Escape 会清空
postConvert url: <BASE_URL>/#/Lead/view/<id>   ← 转换后回详情（带前导斜杠）
postConvert statusValue: Converted   convertBtn: count=0
postConvert bodySlice: … Converted To Account Acct_… Contact QA … Opportunity Opp_…
api lead: status=Converted convertedAt=2026-09-17 10:24:07 account=… contact=… opp=…
```

> 注：Probe 期间发现并验证的陷阱已并入上方决议：Convert 是**向导页非弹窗**；Amount 必须 pressSequentially（fill 被清空）；Close Date fill 后必须 Enter 确认（Escape 清空）；转换创建 Account/Contact/Opportunity 三实体；API 用 `Espo-Authorization` basic（POST App/user 405、X-Auth-Token 401）。