# CampusX 项目开发规范

## 1. 规范层级

本文件定义 CampusX 的跨端边界、公共契约、代码组织规则和变更验证要求。`README.md` 只说明项目背景和运行入口；`AGENTS.md` 只说明 AI/编码代理的执行规则。

修改代码前的读取顺序：

```text
读取 AGENTS.md
→ 读取本文件
→ 读取受影响目录和源码
→ 按稳定规则 ID 设计、修改和验证
```

- 本文件中出现的目录、文件、云函数、页面和管理端模块必须能由当前工作区证明。
- 可选结构只在实际需要时创建，不为了目录外观创建空目录、空抽象或无调用转发层。
- 新增规则时必须使用稳定规则 ID；修改既有规则时保留 ID，除非该规则被整体废弃。
- 如果用户需求与本文件冲突，先说明冲突点，再按用户确认后的范围执行。

## 2. 系统边界

稳定规则 ID：`SYSTEM-BOUNDARY-001`。

| 模块 | 目录 | 技术 | 职责 |
| --- | --- | --- | --- |
| 小程序端 | `miniprogram/` | 原生微信小程序 | 用户登录、浏览、发布、收藏、聊天和个人中心 |
| 云函数端 | `cloudfunctions/` | 微信云开发云函数 + Node.js CommonJS | 小程序业务接口、管理端接口和云数据库访问 |
| 管理端 | `admin-web/` | Vite + 原生 JavaScript ES Modules | 后台登录、数据看板、用户/商品/分类/聊天管理 |

- 小程序端只通过 `wx.cloud.callFunction` 调用云函数，不直接访问管理端 HTTP 接口。
- 管理端只通过 `VITE_ADMIN_API_URL` 请求 `adminService` HTTP 访问地址，不直接操作云数据库。
- 云函数是数据访问边界；客户端不得绕过云函数读写云数据库。
- 当前项目不引入跨端共享源码包；重复的端内适配逻辑优先在本端封装。

## 3. 端内分层

### 3.1 小程序分层

稳定规则 ID：`MINI-LAYER-001`。

```text
page
  → component
    → api adapter
      → wx.cloud.callFunction
```

- 页面放在 `miniprogram/pages/{page}/index.*`。
- 页面只处理页面状态、生命周期、用户交互和组件组合。
- 多页面复用 UI 放在 `miniprogram/components/`。
- 云函数调用统一经过 `miniprogram/api/index.js`。
- 本地存储、路由等工具放在 `miniprogram/utils/`。
- Mock 或降级数据放在 `miniprogram/mock/`，不得伪装成真实云端数据源。

### 3.2 云函数分层

稳定规则 ID：`CLOUD-FUNCTION-LAYER-001`。

```text
cloudfunctions/{function}/index.js
  → lib
  → services
  → cloud.database()
```

- 简单云函数可以保留单文件 `index.js`。
- 复杂云函数必须拆分通用能力和业务服务。
- `cloudfunctions/adminService/index.js` 只负责 HTTP 适配、action 分发和异常包装。
- `cloudfunctions/adminService/lib/` 只放鉴权、响应、分页、时间、HTTP、云环境初始化等通用能力。
- `cloudfunctions/adminService/services/` 只放管理端业务 action。
- 业务服务可以访问云数据库；HTTP 解析和响应头逻辑不得散落到业务服务中。

### 3.3 管理端分层

稳定规则 ID：`ADMIN-WEB-LAYER-001`。

```text
main
  → layout / view
    → component / util
      → api adapter
```

- `admin-web/src/main.js` 只负责初始化、导航调度、加载状态和错误处理。
- 管理端接口请求封装在 `admin-web/src/api/`。
- 登录态和本地 session 放在 `admin-web/src/state/`。
- 页面模块放在 `admin-web/src/views/`。
- 通用 UI 片段放在 `admin-web/src/components/`。
- 布局放在 `admin-web/src/layout/`。
- 通用格式化和安全输出工具放在 `admin-web/src/utils/`。

## 4. API 公共契约

### 4.1 云函数响应

稳定规则 ID：`API-ENVELOPE-001`。

云函数业务返回值统一为：

```js
{
  code: 0,
  message: 'success',
  data: null
}
```

- `code === 0` 表示成功。
- `code !== 0` 表示业务失败。
- `message` 使用可读业务信息。
- `data` 存放业务数据；无数据时使用 `null` 或明确布尔值。
- 客户端页面不应依赖云函数未声明的临时字段。

### 4.2 小程序云函数调用

稳定规则 ID：`MINI-CALL-001`。

小程序端通过 `miniprogram/api/index.js` 调用云函数：

```js
wx.cloud.callFunction({
  name,
  data: { action, data }
})
```

- 页面不得直接散落 `wx.cloud.callFunction` 业务调用。
- 新增 action 时必须同步更新 `miniprogram/api/index.js` 和目标云函数分发逻辑。
- 小程序调用云函数后以 `res.result` 读取业务 envelope。

### 4.3 管理端 HTTP 调用

稳定规则 ID：`ADMIN-HTTP-001`。

管理端统一以 HTTP POST 调用 `adminService`：

```js
{
  action: 'actionName',
  data: {}
}
```

- 登录后的受保护请求必须在 `data` 中携带 `token`。
- `admin-web/src/api/cloud.js` 是管理端唯一 HTTP 调用封装。
- `VITE_ADMIN_API_URL` 必须指向能返回 JSON 的 `adminService` HTTP 访问地址。
- 如果返回 HTML，说明地址不是有效的 `adminService` JSON 接口。

当前已补充的 HTTP 访问地址：

```text
https://cloud1-d6g5stkeb92288dee-1445397435.tcloudbaseapp.com/
```

该地址必须通过 POST `{ action, data }` 验证能返回 JSON 后，才能作为管理端接口地址使用。

### 4.4 分页

稳定规则 ID：`PAGINATION-001`。

当前云函数分页请求使用：

```js
{
  page: 1,
  pageSize: 20
}
```

分页响应使用：

```js
{
  list: [],
  page: 1,
  pageSize: 20,
  total: 0
}
```

- `page` 从 1 开始。
- `pageSize` 在云函数内限制上限。
- 前端字段差异应在 API adapter 或调用层转换，不把多个分页命名混用到同一接口。

## 5. 鉴权与会话

### 5.1 小程序用户

稳定规则 ID：`MINI-AUTH-001`。

- 小程序通过 `login` 云函数登录。
- 登录态保存在本地 storage。
- 用户资料通过 `user` 云函数读取和更新。
- 页面需要登录时应通过现有 storage 和路由逻辑处理，不复制新的登录态体系。

### 5.2 管理端管理员

稳定规则 ID：`ADMIN-AUTH-001`。

- 管理端通过 `adminService` 的 `login` action 登录。
- 管理员 token 由 `adminService` 签发和校验。
- 受保护管理接口只允许 `role === 'super_admin'` 且 `status === 'enabled'` 的管理员访问。
- 管理端 token 保存在 `localStorage`，封装位置为 `admin-web/src/state/session.js`。
- 管理端收到 `unauthorized` 类错误时可以清理 session 并返回登录页。

## 6. 状态与数据约定

稳定规则 ID：`STATE-ENUM-001`。

当前业务状态枚举：

| 对象 | 状态 |
| --- | --- |
| 用户 | `enabled` / `disabled` |
| 商品 | `on_sale` / `off_shelf` / `sold` |
| 分类 | `enabled` / `disabled` |
| 聊天会话 | `active` |

- 不得随意新增、改名或复用状态值。
- 状态值变更必须同步小程序、管理端、云函数和已有数据兼容逻辑。
- 管理端展示文案由前端格式化函数映射，不把中文状态写回数据库。

稳定规则 ID：`COLLECTION-NAME-001`。

当前代码使用的云数据库集合包括：

- `admins`
- `users`
- `categories`
- `products`
- `favorites`
- `chat_sessions`
- `chat_messages`

新增集合或修改集合名必须同步全部读写函数、管理端统计和初始化逻辑。

## 7. 页面与路由

稳定规则 ID：`MINI-ROUTE-001`。

- 小程序页面路径统一使用 `miniprogram/pages/{page}/index.*`。
- `miniprogram/app.json` 是页面注册来源。
- 修改页面路径时必须同步所有 `wx.navigateTo`、`wx.redirectTo`、`wx.reLaunch`、`wx.switchTab` 引用。
- TabBar 页面路径不得只改文件不改 `tabBar.list`。
- 登录页当前路径为 `pages/login/index`。

## 8. UI 与交互

稳定规则 ID：`UI-STYLE-001`。

- 小程序端文案使用中文。
- 小程序保持清爽、轻量、校园感。
- 当前主色为 `#3B82F6`，辅助色为 `#60A5FA`，背景色为 `#F8FAFC`。
- 管理端保持工具型后台风格，优先保证信息密度、可扫描性和操作明确。
- 不为了视觉效果引入复杂依赖。
- 用户可见错误信息应可理解；普通用户界面不展示内部堆栈、物理路径或敏感信息。

稳定规则 ID：`DESTRUCTIVE-ACTION-001`。

- 删除、清空、禁用、下架、退出登录等破坏性或中断性操作应有明确用户触发。
- 新增破坏性操作时，应评估是否需要二次确认或防重复提交。

## 9. 环境配置

稳定规则 ID：`ENV-CONFIG-001`。

| 配置 | 当前约定 |
| --- | --- |
| 小程序根目录 | `miniprogram/` |
| 云函数根目录 | `cloudfunctions/` |
| 云环境 ID | `cloud1-d6g5stkeb92288dee` |
| 管理端 env 文件 | `admin-web/.env` |
| 管理端 env 示例 | `admin-web/.env.example` |
| 管理端接口变量 | `VITE_ADMIN_API_URL` |

- `admin-web/.env` 是本地配置文件，不作为共享配置来源。
- `admin-web/.env.example` 必须保持安全占位值。
- 不在源码中新增密钥、私钥、生产 token 或第三方凭据。
- 环境变量变更后必须重启 Vite 开发服务器。

## 10. 变更闭环

稳定规则 ID：`CONTRACT-CHANGE-001`。

以下变更必须在同一修改范围内完成消费者同步：

- 云函数 action 新增、删除或重命名。
- 请求字段、响应字段或状态枚举变化。
- 小程序页面路径变化。
- 管理端 HTTP 地址读取方式变化。
- 数据库集合名或关键字段变化。

同步范围包括：

- 小程序页面与 `miniprogram/api/index.js`。
- 目标云函数 `index.js` 和相关 service。
- 管理端 `admin-web/src/api/`、`views/` 和状态处理。
- 文档中的对应规则或环境说明。

## 11. 验证要求

稳定规则 ID：`VALIDATION-001`。

管理端代码改动后运行：

```bash
cd admin-web
npm run build
```

云函数 JavaScript 改动后至少运行语法检查：

```bash
find cloudfunctions -name '*.js' -print -exec node --check {} \;
```

小程序页面路径改动后运行搜索确认旧路径无残留：

```bash
rg "旧页面路径" miniprogram
```

- 如果验证无法运行，必须说明具体原因。
- 只修改文档时不需要运行构建，但应检查相关文档中的矛盾和旧表述。

## 12. 非目标边界

稳定规则 ID：`NON-GOAL-001`。

当前项目不实现：

- 支付、担保交易、订单、售后、退款。
- 真实 IM 长连接或复杂实时通信。
- 复杂推荐算法。
- 多学校、多租户后台。
- 大型前端框架迁移。

引入上述能力前必须先明确产品范围、数据模型、权限边界、接口契约和验证方式。
