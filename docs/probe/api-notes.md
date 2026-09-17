# EspoCRM API probe 决议（2026-09-17）

> 来源：临时 probe spec `tests/probe/api.probe.spec.ts`（已删除）对自有 EspoCRM 实例（`<BASE_URL>`）REST API 的真实探测（干净 request context，无 session cookie 污染）。
> 用法：API 测试层（`tests/api/*.spec.ts`）一律以本文件为准。

## 认证决议（与默认假设不同，重要）

- **认证方式 = 每请求 Basic Auth**：`Authorization: Basic base64(user:pass)`（或 `Espo-Authorization: base64(user:pass)`）直接可用，**不需要 token 流程**。
- `POST /api/v1/App/user`（官方文档的 token 换取端点）在本实例返回 **405**（该路由仅允许 GET/DELETE/PUT/PATCH）——token 流程不可用。
- `GET /api/v1/App/user` + Basic → **200**，响应含 `user` 对象；其中的 `user.token` 是 **32 位、每次请求变化的一次性字段，不是 API session token**：
  - `X-Auth-Token: <user.token>` → **401**
  - `Espo-Authorization: <user.token>` → **400**
- 错密码 → **401**；无凭据 → **401**。两者响应体为 `text/html`（非 JSON），断言只查 status，不要 parse body。
- ⚠️ 探测陷阱：Playwright `request` fixture 会携带 storageState 的 session cookie，导致无凭据/错 token 探测误判为 200；**认证负向用例必须用干净上下文**（`import { request } from '@playwright/test'` + `request.newContext({ storageState: { cookies: [], origins: [] } })`，fixture 本身没有 `newContext` 方法）。

## API 行为决议

| 操作 | 状态码 | 响应 | 备注 |
|---|---|---|---|
| POST `/api/v1/Account` | **200**（非 201） | 完整记录 `{id, name, deleted, ...}` | 最小字段 `name` |
| GET `/api/v1/Account/{id}` | 200 | 完整记录 | — |
| PUT `/api/v1/Account/{id}` | 200 | 完整更新后记录（含 `versionNumber` 自增） | — |
| GET `/api/v1/Account`（搜索） | 200 | `{ total, list }`，`list[0]` 含 `id,name,deleted,website,...` | 参数：`where[0][type]=contains&where[0][attribute]=name&where[0][value]=<name>` |
| DELETE `/api/v1/Account/{id}` | **200** | JSON `true` | — |
| GET `/api/v1/Account/{id}`（删除后） | **200**（非 404） | 记录 `deleted: true` | **软删除**：删除断言看 `deleted === true`，不要 expect 404 |
| POST `/api/v1/Lead` | 200 | 完整记录 | 最小字段 `firstName` + `lastName`（生成 name = "QA <lastName>"） |

- 删除后 GET 仍 200 且带 `deleted: true`——业务 spec 的清理/存在性断言用 `deleted` 标志或搜索过滤。
- 全部请求头 `Content-Type: application/json`（POST/PUT 带 body 时）。
- 探测全程自建自清：Account/Lead 创建后即删除，未触碰预置数据。

## 原始探测输出

```
- authGet: status=200 userKeys=id,name,deleted,userName,type,authMethod,salutationName,firstName,lastName,isActive,title,emailAddress,phoneNumber,token,ipAddress,avatarColor,gender,createdAt,modifiedAt,auth2FA,middleName,emailAddressIsOptedOut,emailAddressIsInvalid,phoneNumberIsOptedOut,phoneNumberIsInvalid,defaultTeamId,defaultTeamName,teamsIds,teamsNames,teamsColumns,contactId,contactName,avatarId,avatarName,createdById,createdByName,dashboardTemplateId,dashboardTemplateName,workingTimeCalendarId,layoutSetId,emailAddressList,userEmailAddressList,excludeFromReplyEmailAddressList user.tokenType=string tokenLen=32
- authPost: status=405 (token 换取端点是否可用)
- tokenViaXAuthToken: status=401
- tokenViaEspoAuth: status=400
- authWrongPass: status=401 ct=text/html; charset=UTF-8
- authNoCred: status=401 ct=text/html; charset=UTF-8
- accountCreate: status=200 hasId=true name=Auto_Probe_575117 keys=id,name,deleted,contactIsInactive,isLocked,createdAt,modifiedAt,targetListIsOptedOut
- accountGet: status=200 name=Auto_Probe_575117
- accountUpdate: status=200 website=https://probe.example.com versionNumber=2
- accountSearch: status=200 total=1 listLen=1 firstKeys=id,name,deleted,website,emailAddress,phoneNumber,type,industry,sicCode,billingAddressStreet,billingAddressCity,billingAddressState,billingAddressCountry,billingAddressPostalCode,shippingAddressStreet,shippingAddressCity,shippingAddressState,shippingAddressCountry,shippingAddressPostalCode,description,isLocked,createdAt,modifiedAt,emailAddressIsOptedOut,emailAddressIsInvalid,phoneNumberIsOptedOut,phoneNumberIsInvalid,streamUpdatedAt,campaignId,campaignName,createdById,createdByName,modifiedById,modifiedByName,assignedUserId,assignedUserName,originalLeadId,originalLeadName,isStarred,versionNumber
- accountDelete: status=200 body=true
- accountGetAfterDelete: status=200 deletedFlag=true
- leadCreate: status=200 hasId=true name=QA Auto_Probe_576925
```