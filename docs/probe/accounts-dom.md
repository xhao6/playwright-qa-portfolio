# Accounts 页 DOM 探测决议（2026-09-17）

> 来源：临时 probe spec `tests/probe/accounts.probe.spec.ts`（已删除）对自有 EspoCRM 实例（`<BASE_URL>`）的真实 DOM 探测。
> 用法：`pages/AccountsPage.ts` 与 `tests/accounts.spec.ts` 的 locator 一律以本文件为准。

## Accounts Locator 决议

| 项 | 最终 locator | 依据/证据 |
|---|---|---|
| `createButton` | `page.locator('a[data-action="create"]')` | 列表页头部 `<a data-name="create" data-action="create" class="btn action btn-default btn-xs-wide main-header-manu-action" href="#Account/create" title="Ctrl+Space">`，内含 `fa-plus` 图标 + `Create` 文本。**注意：是 `<a>` 不是 `<button>`，`getByRole('button', { name: /create/i })` 找不到（count=0）。** 点击后 URL 变 `#Account/create`（无前导斜杠），创建表单正常渲染 |
| `nameInput` | `page.locator('input[data-name="name"]')` | 创建表单 Name 字段（必填，body 显示 `Name *`）。探测 count=1。表单输入控件均无 `name` 属性，`data-name` 在 **input 元素本身** 上 |
| `websiteInput` | `page.locator('input[data-name="website"]')` | 创建表单 Website 字段，count=1。类型 `input type="text"` |
| `saveButton` | `page.locator('button[data-action="save"]')`（fallback `getByRole('button', { name: /save/i })` 也可，两者都 FOUND） | `<button data-name="save" data-action="save" class="btn action btn-primary detail-action-item btn-xs-wide" type="button" title="Ctrl+Enter">Save</button>` |
| `listSearch` | `page.locator('input[data-name="textFilter"]')` | `<input type="search" class="form-control text-filter" data-name="textFilter" value="">`。**placeholder 为 null**；导航栏另有全局搜索 `input[type="search"]`（placeholder="Search"），勿用 placeholder 定位。**关键：必须 `fill(...)` 后 `press('Enter')` 才触发过滤**（功能验证：fill 'zzz_probe_no_such_name'+Enter → 行 0；fill 'test'+Enter → 行 ≥1；仅 fill 不生效） |
| `rowLocator` | `page.locator('table tbody tr[data-id]')`（行 class 亦含 `list-row`） | `<tr data-id="6aaa62cc954b58c46" class="list-row ">…`。名称单元格 `td[data-name="name"] a.link`（href=`#Account/view/<id>`，title=名称） |
| `rowMenu` | `row.locator('.list-row-buttons button.dropdown-toggle')` | 行尾 `td[data-name="buttons"]` 内 `<div class="list-row-buttons btn-group pull-right"><button type="button" class="btn btn-link btn-sm dropdown-toggle" data-toggle="dropdown">`。**该按钮无 `data-action` 属性**（`[data-action="dropdownMenu"]` 猜法 count=0，勿用） |
| `removeAction` | `row.locator('.dropdown-menu a[data-action="quickRemove"]')` | 行内菜单 `ul.dropdown-menu.pull-right.list-row-dropdown-menu` 三项：`View`（quickView）、`Edit`（quickEdit）、`Remove`（**quickRemove** —— 不是 `data-action="remove"`！）。列表头部另有全局 Actions 下拉（mass actions）含 `data-action="remove"`，勿混用；必须 row 作用域限定 |
| 删除确认弹窗 | `page.locator('.modal-dialog')`，确认按钮 `button[data-name="confirm"]`（btn-danger，文本 Remove），取消 `button[data-name="cancel"]` | 弹窗文案 `Are you sure you want to remove the record?`，按钮 HTML：`<button data-name="cancel" class="btn btn-default btn-s-wide">Cancel</button>`、`<button data-name="confirm" class="btn btn-danger btn-s-wide"> Remove </button>` |

## Detail 视图（Task 3 编辑用例用）

- **路由**：`#/Account/view/<id>`（带前导斜杠）直接 goto 可渲染；行名称链接点击同样渲染，但 URL 变为 **`#Account/view/<id>`（无前导斜杠）**。
  因此 URL 断言用 `/#\/?Account\/view\//`（`\/?` 兼容两种形式）。行点击后 detail 视图异步渲染约 1–2s，先 `expect(page.locator('.field[data-name="name"]')).toBeVisible()` 再断言，不要只等 URL。
- **Edit 按钮**：`page.locator('button[data-action="edit"]')` → `<button data-name="edit" data-action="edit" class="btn action btn-default detail-action-item btn-xs-wide" type="button" title="Ctrl+Space">Edit</button>`（count=1；不在 `.page-header` 内，在记录头部 button 容器）。`getByRole('button', { name: /edit/i })` 亦可。
- **详情 Name 值**：`.field[data-name="name"]` → `<div class="field" data-name="name"><span class="">test</span></div>`。body 文本断言用记录名即可。
- 详情头部另有 `Star`（data-action="star"）、`Follow`（data-action="follow"）、面包屑 `a[data-action="navigateToRoot"]`。无独立 Actions 下拉（detailActionsBtn count=0）。

## Task 3 实测增补（accounts.spec 红→修过程中新发现，2026-09-17）

> 以下为 `pages/AccountsPage.ts` / `tests/accounts.spec.ts` 实现与调绿过程中实测确认的行为，均已在最终代码中固化：

- **搜索重放陷阱（最坑）**：`fill()` 后 `press('Enter')` 时，若过滤框**当前值与新值相同**，EspoCRM 不会发 XHR，但会触发一次**延迟的客户端重渲染**（Enter 后 ~200–1000ms，无网络请求，`networkidle` 无法捕获）。此行重渲染会替换行元素并**关闭已打开的行菜单**——在「menuItem 可见性检查通过 → click 被 clobber」窗口内必挂。**修复**：`search()` 先 `inputValue()` 对比，相同则跳过 fill+Enter（`pages/AccountsPage.ts`）。
- **Playwright click 无默认超时**：元素「attached 但不可见/不稳定」时 click 会无限重试直到测试超时，`try/catch` 重试循环**永远不会推进**。**修复**：`removeByName` 内所有 click 显式 `{ timeout: 4_000 }`，每次失败后 `waitForTimeout(500)` 等重渲染稳定再重试（最多 6 次）。
- **删除 XHR 很慢**：确认弹窗点击后行会**立即从 DOM 消失（乐观移除）**，但服务端 DELETE 需 30–90s 才完成；期间再搜索会查到旧数据、且 DELETE 完成时列表会重渲染（clobber 行交互）。**修复**：confirm 后 `waitForLoadState('networkidle')` 等 DELETE 完成，再断言行消失。
- **Edit 保存后表单 teardown 竞态**：编辑保存后详情已渲染（body 含新值）但表单 `isChanged` 清理滞后，立即 `goto` 回列表会弹「Are you sure you want to leave the form?」。**修复**：编辑用例保存后等 `input[data-name="website"]` `toHaveCount(0)`（表单关闭信号，30s 超时），再断言 body 文本；`open()` 额外兜底：若出现该弹窗点 Yes。
- **Edit 路由不变**：详情页点 Edit 后 URL **仍是 `#Account/view/<id>`**（不变成 edit 路由），因此编辑用例无需（也无法）断言 URL 变化。
- **website 详情渲染为链接文本（无协议头）**：detail 视图 Website 显示 `<a href="https://updated.example.com">updated.example.com</a>`，body 文本断言用 `updated.example.com`（不含 `https://`）。
- **行点击不导航**：`rowByName(name).click()` 点击行中心落在 td 上，**不触发导航**（EspoCRM 无行级 click handler）；必须点名称链接 `rowByName(name).locator('td[data-name="name"] a.link')`。
- **open() 同 URL 无导航**：当前 hash 已是 `#/Account` 时 `goto('/#/Account')` 是 no-op（浏览器同文档 hash 相同不触发 hashchange），列表不刷新——配合上方「值相同跳过搜索」逻辑，`search()` 在 afterEach 重搜时是幂等的。

## 其他关键交互备忘

- **SPA 异步渲染**：`goto('/#/Account')` 后必须等列表头部稳定（`expect(a[data-action="create"]).toBeVisible()`）再操作；此前直接探测会拿到空壳 DOM（rows=1 假象）。
- **创建表单**：路由 `#Account/create`；表单字段全量探测见下方原始输出（name/website/email/phone/地址组/type/industry/description/assignedUser/teams）。`phone` 字段为复合组件：两个 `input`（placeholder `000-000-0000`）均**无 data-name**，`[data-name="phone"] input` count=0 —— Task 3 不需要（只用 website），若将来要用需另行探测。
- **Cancel 返回**：创建表单 `[data-action="cancel"]` count=1，点击回列表。
- **quickView / quickEdit** 为行内菜单的快捷动作（href `#Account/view/<id>` / `#Account/edit/<id>`），非全量 detail/edit。
- 列表当前仅 1 条预置数据（Account "test"，id `6aaa62cc954b58c46`），probe 全程只读（删除弹窗已 Cancel，未删除任何数据）。

## 原始探测输出

（三组探测 console 输出合并；PASS 4/4，desktop-chromium）

### Probe 1 — 列表 / 创建表单

```
listLoaded url: <BASE_URL>/#/Account
allButtons text: ["\n            \n        ","\n                    All\n                    \n                ","\n                    \n                ","\n                    \n                ","\n                    \n                ","Actions \n                ","Actions ",""]
createLink(a[href*="create"]): count=1
createButton(getByRole button create): count=0
createButton2(a data-action=create): count=1
createButton3(header links): count=1 html=<a data-name="create" data-action="create" class="btn action btn-default btn-xs-wide main-header-manu-action" href="#Account/create" title="Ctrl+Space"><span class="fas fa-plus fa-sm"></span><span>Create Account</span></a>
searchInput: name=null placeholder=Search
listQuickSearch(textFilter): count=1 placeholder=null html=<input type="search" class="form-control text-filter" data-name="textFilter" value="" tabindex="0" autocomplete="espo-dummy" spellcheck="false">
input[type=search] count: 2 placeholders=["Search",null]
rows locator candidates: count=8
afterCreateClick url: <BASE_URL>/#Account/create
editView: edit-view-rendered
formFields: [第一项 {tag:input, type:search, placeholder:Search}(导航搜索) → {input text}(Name) → {input text}(Website) → {input email}(Email) → select → {input text} → {input text placeholder:"000-000-0000"}(Phone ×2) → textarea/Street → City → State → Postal Code → Country（billing ×5，shipping ×5） → select(type) → input → select(industry) → input → textarea(description) → input placeholder:"Select"(assignedUserName) → input(assignedUserId) → input placeholder:"Select"(teams) …]
wideFields count: 25
wideFields: [{input form-control placeholder:Search}{input data-name:"name"}{input data-name:"website"}{input}{select}{input}{input placeholder:"000-000-0000"}{textarea data-name:"billingAddressStreet"}{input data-name:"billingAddressCity"}{input data-name:"billingAddressState"}{input data-name:"billingAddressPostalCode"}{input data-name:"billingAddressCountry"}{textarea data-name:"shippingAddressStreet"}{input data-name:"shippingAddressCity"}{input data-name:"shippingAddressState"}{input data-name:"shippingAddressPostalCode"}{input data-name:"shippingAddressCountry"}{select data-name:"type"}{input}{select data-name:"industry"}{input}{textarea data-name:"description"}{input data-name:"assignedUserName" placeholder:"Select"}{input data-name:"assignedUserId"}{input placeholder:"Select"}]
nameField: count=1
websiteField: count=1
phoneField: count=0
saveButton(getByRole save): FOUND
saveButton2(attr save): <button data-name="save" data-action="save" class="btn action btn-primary detail-action-item btn-xs-wide" type="button" title="Ctrl+Enter">Save</button>
bodyTextSlice:  Accountscreate | Save | Cancel | Overview | Name * | Website | Email |   | Phone | Office |    | +1 |     | Billing Address | Shipping Address | Details | Type | Industry | Description | Assigned User |   | Teams | © 2026 EspoCRM, Inc.
cancelButton: count=1
```

### Probe 2 — 列表行 / 行菜单 / 搜索 / 行点击

```
rowLocator(tr[data-id]): count=1
firstRow html: <tr data-id="6aaa62cc954b58c46" class="list-row " data-view-cid="view38">
  <td class="cell" data-name="r-checkbox">…record-checkbox…</td>
  <td class="cell" data-name="name"><a href="#Account/view/6aaa62cc954b58c46" class="link" data-id="6aaa62cc954b58c46" title="test">test</a></td>
  <td class="cell" data-name="website"></td> <td data-name="type"></td> <td data-name="billingAddressCountry"></td>
  <td class="cell" data-name="buttons"><div class="list-row-buttons btn-group pull-right">
    <button type="button" class="btn btn-link btn-sm dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></button>
    <ul class="dropdown-menu pull-right list-row-dropdown-menu" data-id="6aaa62cc954b58c46">
      <li><a href="#Account/view/6aaa62cc954b58c46" class="action" data-action="quickView" data-id="…"><span class="item-text">View</span></a></li>
      <li><a href="#Account/edit/6aaa62cc954b58c46" class="action" data-action="quickEdit" data-id="…"><span class="item-text">Edit</span></a></li>
      <li><a role="button" class="action" data-action="quickRemove" data-id="…"><span class="item-text">Remove</span></a></li>
    </ul></div></td>
</tr>
rowMenuButton: count=1
rowMenu items: ["View","Edit","Remove"]
removeAction(row-scoped quickRemove): count=1
confirmModal: count=1
modalText: Are you sure you want to remove the record? | Cancel | Remove
modalButtons: ["Cancel"," Remove "]
modalButtonsHtml: ["<button data-name=\"cancel\" class=\"btn btn-default btn-s-wide\" type=\"button\">Cancel</button>","<button data-name=\"confirm\" class=\"btn btn-danger btn-s-wide\" type=\"button\"> Remove </button>"]
confirmModal dismissed (Cancel clicked) — 未删除任何数据
search functional: fill+Enter textFilter=zzz_probe_no_such_name → rows=0 ✓
search functional: fill+Enter textFilter=test → rows>=1 ✓
rowNameLink: count=1
rowClickNav: url=<BASE_URL>/#Account/view/6aaa62cc954b58c46 detail rendered ✓
rowClickNav urlContainsView: false   ← 无前导斜杠（#Account/view/…），URL 断言需用 /#\/?Account\/view\//
```

### Probe 3 — Detail 视图路由与按钮

```
route #/Account/view/6aaa62cc954b58c46: hash=#/Account/view/6aaa62cc954b58c46 nameField=1 editLink=0
detailNameField html: <div class="field" data-name="name" data-view-cid="view39"><span class="">test</span></div>
detailBodySlice:  Accountstest | Star | Follow | Edit | Overview | Name | test | Website | None | Email | None | Phone | None | Billing Address | None | Shipping Address | None | Details | Type | None | Industry | None | Description | None | Stream | Account | Support | Stream | Admin created this account | Yest 09:35 | Assigned User | None | Teams | None | Created | Yesterday 09:35
detailHeaderAll: [{"tag":"a","action":"navigateToRoot","text":"Accounts"},{"tag":"button","action":"star","text":"Star"},{"tag":"button","action":"follow","text":"Follow"}]
editCandidates([data-action*="edit"]): count=1
editCandidate html: <button data-name="edit" data-action="edit" class="btn action btn-default detail-action-item btn-xs-wide" type="button" title="Ctrl+Space">Edit</button>
detailActionsBtn: count=0
```

> 注：Probe 期间发现的陷阱（已并入决议）：`getByRole('button', {name:/create/i})` 找不到 create（是 `<a>`）；列表搜索框无 placeholder；搜索需 Enter 才生效；行菜单按钮无 data-action；删除项是 `quickRemove` 而非 `remove`；行点击后 URL 无前导斜杠；detail/列表均为 SPA 异步渲染需等关键元素可见。