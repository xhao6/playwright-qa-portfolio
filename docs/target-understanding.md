# 被测网站全局理解 — EspoCRM 实例

> 基于 2026-09-17 对实例 `BASE_URL`（自有 EspoCRM 10.0.8）的实机探测（storageState 登录态 + DOM 采集）整理。
> 用途：为 accounts/leads 等业务 spec 提供页面结构、字段、模块关系的一手依据。

## 1. 概况

| 项 | 值 |
|---|---|
| 产品 | EspoCRM（开源 CRM，PHP 后端 + Backbone/React 前端 SPA） |
| 版本 | **10.0.8**（About 页实测） |
| 形态 | 单租户实例，hash 路由 SPA（`#/Account` 等），无移动 App 概念，桌面/移动视口共用同一套页面 |
| 登录 | 用户名/密码表单（`input[name=username|password]` + `Log in` 按钮），session 持久化于 cookie |
| 语言 | 默认英文界面（有 i18n 能力，P2 可测切中文） |

## 2. 目标群体与使用场景

EspoCRM 是面向 **中小企业销售/客服团队** 的通用 CRM，本实例为管理员视角（admin 账号），典型使用链路：

1. **销售**：Lead（线索）→ 转换 → Account/Contact/Opportunity（商机）→ 赢单
2. **客服**：Case（工单）+ Knowledge Base（知识库）
3. **活动协同**：Meeting/Call/Task/Calendar + Stream（动态流）留痕
4. **营销**：Campaign（活动）+ Target List（目标清单）+ Mass Email（群发，配置项）
5. **组织管理**：User/Team/Working Time Calendar/Import/模板

## 3. 导航结构（实测 navbar）

```
Home
├── CRM           Accounts · Contacts · Leads · Opportunities
├── Activities    Emails · Meetings · Calls · Tasks · Calendar
├── Support       Cases · Knowledge Base
└── More（折叠菜单）
    ├── Marketing         Campaigns · Target Lists
    ├── Business          Documents
    ├── Organization      Users · Teams · Working Time Calendars
    └── 工具类             Email Templates · PDF Templates · Import
```

- **全局搜索**：navbar 中部 "Search" 输入框，跨模块模糊检索
- **快速创建**（Quick Create "+" 下拉）：Account / Contact / Lead / Opportunity / Meeting / Call / Task / Case / Email —— 直接进入对应创建页
- **用户菜单**（右上）：Administration · Preferences · About · Log Out

> 导航 DOM 特征：`header li[data-name="Account"] a`（href=`#Account`，相对 hash）、`li[data-name]` 即模块名，tab-divider 分组。

## 4. 核心模块页面逻辑

通用页面范式（EspoCRM 所有业务模块一致）：

```
列表页 List        → 详情页 Detail    → 编辑/创建页 Edit（同一路由 + /create）
#/Account          #/Account/<id>     #/Account/create
```

- 列表页：表头列（可自定义布局）+ 行内快速操作 + 顶部 "Create X" 按钮 + 搜索/筛选区
- 详情页：Header（标题 + Star 关注 + Follow 按钮）→ Panel 布局：**Overview / Details / Stream / 相关实体列表**（Tabs）
- 创建/编辑页：字段 cell（`data-name` 属性 = 字段名）、必填项带 `*`、顶部 Save/Cancel/More 操作

### 4.1 Account（客户/公司）— 核心主数据

- 列表列（实测）：Name · Website · Type · Country（billingAddressCountry）
- 详情 Panel：Overview | Details | Stream | **Contacts · Opportunities · Documents · Cases · Activities · History · Tasks**（7 个关联列表 Tab）
- 字段（实测创建表单）：`name*` `website` `emailAddress` `phoneNumber` `billingAddress`(街/城/州/邮编/国家) `shippingAddress` `type` `industry` `description` `assignedUser` `teams`
- 详情页额外字段：Locked · Created · Modified · Followers
- 业务含义：客户公司档案，是 Contact/Opportunity/Case 的挂靠主体

### 4.2 Contact（联系人）

- 字段（实测）：`name*`（Salutation+姓+名）`accounts`（多对多挂 Account）`emailAddress` `phoneNumber` `address` `description` `assignedUser` `teams` `portalUser`
- 关系：N:N 挂 Account；可被 Lead 转换生成；可挂 Opportunity/Case/Meeting/Call

### 4.3 Lead（线索）— 销售漏斗入口

- 字段（实测）：`name*` `accountName`（文本）`emailAddress` `phoneNumber` `title` `website` `address` `status` `source` `opportunityAmount` `campaign` `industry` `description` `assignedUser` `teams`
- 转换字段（转换后回填）：`convertedAt` `createdAccount` `createdContact` `createdOpportunity`
- **核心业务动作：Convert（转换）→ 生成 Account/Contact/Opportunity 三件套**，转换后 Lead 状态变 Converted，主数据锁定

### 4.4 Opportunity（商机）

- 字段（实测）：`name*` `account`（挂 1 个 Account）`stage` `amount*` `probability` `closeDate*` `contacts` `leadSource` `description` `assignedUser` `teams`
- 业务含义：销售管线，stage 反映漏斗阶段，概率/金额随阶段联动（标准 CRM 逻辑）

### 4.5 Case（客服工单）＋ Knowledge Base

- Case 字段（实测）：`name*` `number`(自动编号) `status` `account` `priority` `contacts` `type` `description` `attachments` `assignedUser` `teams` `collaborators` `isInternal`(隐藏于 Portal)
- Knowledge Base Article：支持分类/标签/发布状态，供客服引用

### 4.6 活动类：Task / Meeting / Call

- 共同点：`name*` `parent`（**通用父级关联：可挂 Account/Contact/Lead/Opportunity/Case 任一**）`status` `priority` `dateStart` `dateEnd` `reminders` `description` `assignedUser` `teams` `collaborators` + `attachments`
- Meeting/Call 特有：`duration` `externalService`(在线会议) `users` `contacts` `leads`（与会人）
- Task 特有：`dateCompleted`；日期含 `dateDue`/`dateStart`
- 详情页这些实体以 "Activities / History" 双列表挂在 Account/Contact 下

### 4.7 其他模块（辅助）

- **Email**：Compose / Archive Email / Import EML / Email Templates / Folders / Personal & Group Email Accounts
- **Campaign / Target List**：营销活动 + 目标清单（活动投放对象）
- **Document / PDF Template / Email Template**：文档库与模板
- **User / Team / Working Time Calendar**：组织与排班
- **Import**：CSV 批量导入（可选造数通道）

## 5. 页面间联系（实体关系图）

```
                      ┌──────────────┐
                      │  TargetList  │
                      └──────┬───────┘
                             │ N:N (Campaign 投放对象)
                      ┌──────┴───────┐
                      │   Campaign   │
                      └──────┬───────┘
                             │ (Lead.source / opportunityAmount)
        ┌───────────┐  Convert  ┌───────────┐
        │   Lead    │──────────▶│  Account  │◀──┐
        └───────────┘  1:N:N    └─────┬─────┘   │ 1:N
              ▲                       │         │
              │campaign               │ 1:N     │
              │                ┌──────┴──┐  ┌───┴───┐
              │                │ Contact │  │  Case │──▶ KnowledgeBaseArticle
              │                └───┬─────┘  └───┬───┘
              │              N:N  │        N:N  │
        ┌─────┴──────┐      ┌─────┴──────┐      │
        │ Opportunity│◀────▶│  Task/     │◀─────┘
        │            │      │ Meeting/Call│ (parent 泛关联)
        └────────────┘      └────────────┘
```

关键关系（测试价值高）：

1. **Lead → Convert → Account + Contact + Opportunity**：跨模块数据联动，最典型业务闭环
2. **Account 1:N Opportunity / Case**；**Account N:N Contact**；**Opportunity N:N Contact**
3. **Task/Meeting/Call 的 `parent` 字段**：泛型关联到任意主数据实体（详情页 Activities/History 列表聚合展示）
4. **Campaign → TargetList → Lead/Opportunity** 营销漏斗
5. 全局搜索横跨以上所有实体

## 6. 全局交互要素（测试工程相关）

| 要素 | DOM/行为要点 |
|---|---|
| 登录 | `input[name=username|password]`、`button:has-text("Log in")`；空字段报 "Username can not be empty" 类错误，错误时滞留登录页 |
| 全局搜索 | navbar `.global-search-container` 内 "Search" 输入框；建议下拉结果列表断言 |
| 快速创建 | `.quick-create-container` 下拉，9 个模块直达创建页 |
| 关注/收藏 | 详情 Header Star（Follow/Favorites），详情页持久状态 |
| Stream | 详情页动态流 Panel，记录操作历史（Created/Modified 等） |
| 列表搜索 | 列表页搜索行（`input` + 筛选下拉），需按列过滤 |
| 分页/排序 | 列表底部分页控件、列头点击排序（P2 search-table spec 素材） |
| i18n | 界面语言可切（Preferences 或界面切换器），切中文后文案断言（P2） |

## 7. 对测试设计的影响（建议）

1. **P0 accounts.spec / leads.spec** 直接对齐 4.1/4.3 字段与流程：创建（必填 `name*`）→ 详情断言 → 编辑 → 列表搜索 → 删除清理；lead 转换流程是核心加分场景
2. **数据纪律**：现有实例数据极少（Account 4 条、User 1 条、其余空）——自建自清尤其安全；`Auto_<ts>` 命名即可保证唯一
3. **关系链路测试**（P2）：Lead→Convert 后 Account/Contact/Opportunity 三处可见性断言
4. **不建议测**：Email（需邮件服务器）、Import（文件上传）、Portal 相关（无 portal 配置证据）
5. **页面稳定性**：SPA hash 路由、渲染异步——所有断言走 Web-first 自动重试

## 附：探测记录

- 探测方式：Playwright (channel chrome) + 既有 `playwright/.auth/user.json` storageState 登录态，`probe-*.mjs` 临时脚本采集（已删除，未入库）
- 探测时间：2026-09-17；版本来自 `#/About`