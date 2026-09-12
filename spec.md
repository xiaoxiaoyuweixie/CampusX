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
| 小程序端 | `miniprogram/` | 原生微信小程序 | 用户登录、浏览、发布、收藏、聊天、举报和个人中心 |
| 云函数端 | `cloudfunctions/` | 微信云开发云函数 + Node.js CommonJS | 小程序业务接口、管理端接口和云数据库访问 |
| 管理端 | `admin-web/` | Vite + 原生 JavaScript ES Modules | 后台登录、数据看板、用户/商品/分类/聊天/举报管理 |

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

#### 4.2.1 AI 助手对话

稳定规则 ID：`AI-ASSISTANT-API-001`。

- 小程序通过 `miniprogram/api/index.js` 调用 `aiAssistant` 云函数的 `chat` action。
- 请求 `data.messages` 为 `{ role, content }` 数组，`role` 只使用 `user` 或 `assistant`。
- 用户单条问题最多 200 字，云函数只取最近 10 条消息作为对话上下文。
- 成功响应 `data` 使用 `{ content, sources, products }`。规则问答的 `sources` 中每项为 `{ id, title }`；商品检索的 `products` 最多 5 项，每项包含商品详情页跳转所需的商品 ID、标题、封面、价格、地点和分类信息。
- 规则问答只能使用 `cloudfunctions/aiAssistant/knowledge/rules.json` 中的规则；无可用规则时固定返回“暂无相关规则”。
- 商品检索只查询云数据库中 `status: 'on_sale'` 的商品，支持关键词、分类、价格区间和交易地点筛选；无结果时固定返回“暂未找到相关在售商品”。
- 商品检索第一版直接使用现有 CloudBase 商品数据，不接入向量数据库。
- AI 对话当前不写入云数据库。

#### 4.2.2 联系方式与商品聊天

稳定规则 ID：`CONTACT-CHAT-API-001`。

- 业务规则以 `docs/prd/contact-and-chat-2026-09-07.md` 为准；部署与双账号真机验收见 `docs/deployment/contact-and-chat-2026-09-07.md`。
- 本人联系方式由 `user.getContacts` 读取；`user.saveContact` 接收 `{ type: 'wechat' | 'phone', value: string }`，原样保存并原子开启对应开关；`user.setContactEnabled` 接收 `{ type, enabled: boolean }`。缺失配置默认空值和关闭，关闭保留号码，两项独立。小程序本人资料之外不下发 `contacts`；后台超级管理员的只读用户详情例外，遵循 `ADMIN-USER-DETAIL-001`。
- `chatService.getChatState` 接收 `{ sessionId }`，返回 `{ canSend, sendReason, wechat, phone }`，各联系方式包含 `{ available, reason, masked }`。不包含完整号码。
- `chatService.getContact` 接收 `{ sessionId, type, purpose }`。微信的 `preview` 仅返回 `{ masked }`，`copy` 返回最新完整 `value` 和 `masked`；电话只支持 `call`，返回最新完整 `value`。每次操作重新验证本人、参与者、对方账号、商品、开关及非空值。
- 不做交换申请或双向同意。对方禁用时旧消息可读、不可发送；商品下架或售出时，仅有实际成功消息的同一会话可继续文字/图片，联系方式均不可用。
- `chatService.sendMessage` 接收 `{ sessionId, clientMessageId, type, content, image, createdTimestamp }`。`clientMessageId` 是 8 至 96 位字母、数字、下划线或连字符，新消息唯一且重试不变；服务端按会话、发送人和该标识生成确定性消息 ID，使用事务一次性写消息及会话摘要/未读数。
- 兼容旧客户端不带 `clientMessageId` 的文字发送，由服务端生成独立标识；该旧调用方式不提供跨请求重试去重保证。新页面始终携带稳定标识。
- 文字最多 1000 个 Unicode 码点（`Array.from(text).length`）；纯空白拒绝，合法内容不 trim、不改写。不改变 AI 助手限制。
- 图片类型 `image`，其 `image` 请求含临时文件 `fileID`、宽高；服务端检查归属路径、文件字节、10 MB 限制和静态 JPG/PNG/WebP 格式，转存为服务端独立文件后写入消息。
- `chatService.prepareImage` 接收 `{ sessionId, clientMessageId, extension, size }`，权限通过后返回临时 `cloudPath`；已确认过同一消息时直接返回该消息。小程序仅通过 `wx.cloud.uploadFile` 上传文件，不直接访问数据库。
- `getMessages` 兼容原分页结构，增加 `permissions`，图片消息提供短期 `image.url`，不返回完整联系方式或云文件 ID。`getImage` 接收 `{ sessionId, messageId }`，参与者校验后返回 `{ url }`；历史图片同样受会话读取权限保护。
- 管理端 `listChatMessages` 在原结构上为图片增加 `imageUrl`，沿用管理员鉴权，不新增联系方式维护功能。
- 聊天状态沿用 5 秒轮询更新，并在每次实际操作时由服务端重新校验。轮询失败时不使用缓存完整号码操作。
- 草稿和待重试消息按账号 `openid` 与会话分别保存于本地；成功只清除对应输入版本，图片成功不清除文字。多图按选择顺序逐张提交和单项重试。

#### 4.2.3 商品聊天举报

稳定规则 ID：`REPORT-API-001`。

- 业务契约见 `docs/prd/report-feature-2026-09-12.md`；发布前置条件与人工验收见 `docs/deployment/report-feature-2026-09-12.md`。小程序使用独立 `reportService`，不复用聊天发送或联系方式权限。
- `getContext` 接收 `{ sessionId }`。服务端从真实登录身份与会话关系推导被举报人和商品；本人必须账号可用且有会话读取权限。空会话、商品下架/售出、对方禁用均允许举报；会话、对方或商品真实不存在时拒绝新的提交。
- `prepareEvidence` 接收 `{ sessionId, submissionId, imageId, extension }`，返回与本人、本会话、本次提交和附件绑定的稳定临时 `cloudPath`；小程序通过 `wx.cloud.uploadFile` 上传文件。
- `submit` 接收 `{ sessionId, submissionId, reasonCode, detail, attachments: [{ imageId, fileId }] }`；原因使用已确认的七个固定码，详细信息为 1—100 个 Unicode 码点，拒绝纯空白，保留有效原文和换行，不截断后提交。
- 图片可选 0—9 张，每张不超过 10 MiB，只允许真实静态 JPEG/JPG、PNG、WebP。服务端核实准备记录、完整路径与环境、真实文件字节、格式和大小后，独立转存至正式证据目录。任一附件失败不创建部分成功举报。
- `reportService` 内使用固定版本 `sharp` 实际解码验证截图，保留原字节保存正式证据；该新函数使用 Nodejs20.19，部署时在云端安装 Linux 对应依赖，不能上传本机 macOS 二进制。具体安装与验证见举报部署文档，既有云函数运行时不变。
- 成功返回最小回执 `{ submitted: true, reportId, submissionId }`，不返回完整材料、处理进度、正式云文件 ID 或链接。`getSubmissionResult({ submissionId })` 仅核实本人指定提交，未查到返回 `{ submitted: false }`；未查到不等于不存在正在执行的提交。
- 同一账号的稳定提交标识与材料绑定；原样重试返回同一成功回执，修改材料不能覆盖原提交。同一举报人、同一会话通过数据库事务最多保留一份待处理举报；结案后可用新标识提交新的举报，旧标识仍永久对应原成功。
- `submit` 只有在事务确认该材料已终止、所有同标识在途请求均不能再提交后，才在业务失败 `data` 中返回 `{ settled: true, rejected: true, submissionId }`。客户端只接受匹配当前标识的这一确认来解锁材料；普通 4xx、鉴权失败或未查到回执不能证明原请求未成功。错误返回前若发现原举报已成功，则返回原成功回执。
- 回执核实在本人身份及归属验证后独立于当前关联对象。页面恢复未确认提交时先核实原回执，再校验发起新举报所需对象；关联对象消失不能使原成功变为失败。
- 举报成功不新增聊天消息、未读数或通知。完整举报资料只对启用的超级管理员开放；用户端不提供列表、详情、进度、修改、撤回或删除接口。

稳定规则 ID：`REPORT-EVIDENCE-001`。

- `report-staging/` 只允许文件创建者读写；`report-evidence/` 对所有客户端禁读、禁写、禁删，由服务端独立保存原始证据。必须在实际云环境配置并验证规则，不能仅依赖随机文件名保密。
- 举报相关集合全部仅服务端读写；用户、商品、会话变化或删除不连带修改举报快照和证据。
- 原始正式证据不使用临时 URL 作为持久标识，不通过聊天图片或商品读取接口公开。只有后台鉴权后签发短期地址，前端不得持久缓存或记录资料/证据地址。

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

#### 4.3.1 后台用户详情

稳定规则 ID：`ADMIN-USER-DETAIL-001`。

- 用户列表「查看」进入只读用户详情，保留原有启用/禁用操作。详情支持返回列表及刷新当前用户，不增加编辑联系方式功能。
- 管理端通过 `adminService.getUserDetail` 查询，请求仍为 POST `{ action: 'getUserDetail', data: { id, token } }`，`id` 是 `users` 文档 ID。
- 该 action 必须经过现有 `requireAdmin` 鉴权，仅启用状态的 `super_admin` 可以访问。
- 成功 `data` 仅返回 `_id`、`nickname`、`account`、`gender`、`bio`、`status`、`updatedAt`、`contacts`。个性签名使用 `bio`；缺少更新时间时回退到创建时间。
- `contacts.wechat`、`contacts.phone` 各包含原始完整 `value` 和 `enabled`。用户关闭对外展示不限制超级管理员查看已保存值；详情同时标示开放状态，空值显示「未填写」。不返回密码、token、openid 或其他未声明字段。
- `listUsers` 仍不返回 `contacts`，小程序聊天联系人查询权限维持不变。这是用户于 2026-09-08 确认的后台只读例外，不改变小程序对其他用户的展示规则。
- 参数无效、用户不存在、登录失效及服务异常分别返回可读中文提示；联系方式不写入管理端本地存储或日志。离开详情、退出登录后，迟到的查询响应不能重新显示用户资料。

#### 4.3.2 后台举报管理

稳定规则 ID：`ADMIN-REPORT-001`。

- `listReports`、`getReportDetail`、`getReportEvidence`、`processReport` 均通过现有 `adminService` POST `{ action, data }` 和 `requireAdmin`；仅启用的 `super_admin` 可访问。dispatcher 将真实鉴权管理员传给处理服务，不接受客户端伪造的处理人。
- `listReports({ status, page, pageSize })` 支持 `pending`（默认）、`all`、`substantiated`、`unsubstantiated`，固定每页 20 条，按服务端 `createdAt` 和 `_id` 降序稳定排列；返回既有 `list/page/pageSize/total`。本期无搜索。
- `getReportDetail({ reportId })` 返回完整举报原文、必要快照、附件元信息、处理结果及关联对象存在性；关联记录消失仍可查看材料、证据和结案。详情不承诺完整聊天历史快照。
- `getReportEvidence({ reportId, imageId })` 验证附件属于该举报后返回短期 `{ url }`，不依赖原会话、用户或商品仍存在。
- `processReport({ reportId, result, remark })` 仅允许 `pending` 变为 `substantiated` 或 `unsubstantiated`。备注必填 1—200 个 Unicode 码点，拒绝纯空白，保留有效原文；在同一事务记录结论、备注、真实管理员 ID/显示名和服务端时间。终态不能修改、重开或覆盖，并发只允许一方结案。
- 列表切换状态回第 1 页；详情返回保留筛选与页码并刷新，空页回退。处理响应未知时读取权威详情核实；已处理冲突刷新原结果，不覆盖结论。
- 举报结论与既有用户启用/禁用、商品上下架操作独立；成立不自动处罚。退出账号或切换视图后，迟到响应不得重新渲染敏感数据；所有动态文本安全转义。

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
| 聊天消息类型 | `text` / `image` |
| 聊天消息成功状态 | `sent` |
| 举报 | `pending` / `substantiated` / `unsubstantiated` |

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
- `reports`
- `report_submissions`
- `report_pending_guards`
- `report_evidence_uploads`

新增集合或修改集合名必须同步全部读写函数、管理端统计和初始化逻辑。

## 7. 页面与路由

稳定规则 ID：`MINI-ROUTE-001`。

- 小程序页面路径统一使用 `miniprogram/pages/{page}/index.*`。
- `miniprogram/app.json` 是页面注册来源。
- 修改页面路径时必须同步所有 `wx.navigateTo`、`wx.redirectTo`、`wx.reLaunch`、`wx.switchTab` 引用。
- TabBar 页面路径不得只改文件不改 `tabBar.list`。
- 登录页当前路径为 `pages/login/index`。
- 商品聊天的举报页为 `pages/report/index`，仅由当前会话入口进入并携带 `sessionId`，成功或手动返回原聊天，不新建会话。

## 8. UI 与交互

稳定规则 ID：`UI-STYLE-001`。

- 小程序端文案使用中文。
- 小程序保持清爽、轻量、校园感。
- 当前主色为 `#3B82F6`，辅助色为 `#60A5FA`，背景色为 `#F8FAFC`。
- 管理端保持工具型后台风格，优先保证信息密度、可扫描性和操作明确。
- 不为了视觉效果引入复杂依赖。
- 用户可见错误信息应可理解；普通用户界面不展示内部堆栈、物理路径或敏感信息。

稳定规则 ID：`CHAT-MESSAGE-META-001`。

- 商品聊天消息区域的头像与时间规则以 `docs/prd/chat-avatar-and-time-2026-09-09.md` 为准。
- 每条文字、图片及本地待发送消息均显示当前发送者头像：本人在右，对方在左，直径 64rpx。头像为空或加载失败时沿用消息列表的蓝色渐变圆形与昵称首字，点击无操作；头像更新后同步用于已加载历史。
- 时间通过 `miniprogram/utils/chat-presentation.js` 在消息合并、去重后计算，统一使用北京时间 `MM-DD HH:mm`。首条有效时间、紧邻消息间隔达到 5 分钟或跨北京时间自然日时显示居中时间行；前一条时间无效时，下一条有效消息显示自身时间。
- 仅使用有效的 `createdTimestamp`，不由短 `time`、当前时刻或相邻消息推测时间。重试沿用首次发送记录时间，成功确认后使用服务端返回值；分页和轮询后重新计算，不新增业务消息、持久化字段或额外滚动。
- 头像与时间的展示不改变现有发送、联系方式、图片预览、权限、未读计数或分页契约。

稳定规则 ID：`REPORT-UI-001`。

- 聊天工具栏从左至右微信、电话、举报三等分；举报不跟随 `canSend` 或联系方式状态禁用，原头像、时间和输入能力保持既有契约。
- 举报草稿以账号和会话分别持久保存，独立于聊天草稿。未成功提交保留原因、详细信息、本地截图及未确认提交；缺失本地截图可重选，其他内容保留。
- 未确认结果必须沿用原提交标识与材料核实，不能在原结果未知时改写同一标识或悄悄改为新提交。服务端明确成功后提示“提交成功”2 秒，返回原聊天并仅清理对应版本的举报草稿与可清理的本地图片；迟到响应不能清除新草稿或操作其他账号页面。
- 本次 `aiAssistant/knowledge/rules.json` 与 `rules.md` 的举报说明应随实际举报入口同步发布；继续保留未实现的拉黑、在线客服及举报进度查询边界。

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
| DeepSeek API 密钥 | `aiAssistant` 云函数环境变量 `DEEPSEEK_API_KEY` |
| DeepSeek 模型 | 可选环境变量 `DEEPSEEK_MODEL`，默认 `deepseek-v4-flash` |
| DeepSeek API 地址 | 可选环境变量 `DEEPSEEK_API_URL`，默认 `https://api.deepseek.com/chat/completions` |

- `admin-web/.env` 是本地配置文件，不作为共享配置来源。
- `admin-web/.env.example` 必须保持安全占位值。
- 不在源码中新增密钥、私钥、生产 token 或第三方凭据。
- DeepSeek API 密钥只配置在 `aiAssistant` 云函数环境变量中，不下发到小程序端。
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
find cloudfunctions -path '*/node_modules' -prune -o -name '*.js' -print -exec node --check {} \;
```

小程序页面路径改动后运行搜索确认旧路径无残留：

```bash
rg "旧页面路径" miniprogram
```

- 首次运行举报测试前，在 `cloudfunctions/reportService/` 执行 `npm ci --include=optional`，安装真实图片解码依赖。源码语法检查排除 `node_modules`。
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
