# CampusX / 校易通

CampusX 是一个面向大学生的校园资源共享与信息发布项目，首期聚焦西南大学场景。当前项目已经从早期微信小程序 Mock MVP 演进为「微信小程序 + 微信云开发云函数 + Vite 管理端」的三端系统。

项目以信息撮合为主，覆盖账号登录、个人资料、资源发布与浏览、收藏、会话消息、后台数据管理等基础闭环；当前不包含支付、担保交易、订单、售后、真实 IM 长连接等复杂交易能力。

## 原型链接

- Figma 原型链接：[Campusx 原型](https://www.figma.com/design/ypmVzm832Ho7LpKxfyzsnO/Campusx%E5%8E%9F%E5%9E%8B?node-id=0-1&t=Q2MPWXf11m2R8XXi-1)

## 项目定位

- 面向校园内二手交易、资料共享、技能服务、宿舍用品流转等高频场景。
- 小程序端使用原生微信小程序实现，便于在微信开发者工具中调试和部署。
- 云函数端作为统一数据访问边界，承接用户、商品、分类、收藏、聊天和管理端接口。
- 管理端使用 Vite + 原生 JavaScript，实现后台登录、看板、用户、商品、分类和聊天记录管理。

## 主要功能

### 小程序端

- 登录：学号 + 默认密码登录，绑定微信 openid，并同步用户资料。
- 首页：搜索入口、分类导航和推荐资源列表。
- 分类：按分类浏览资源，支持排序和列表展示。
- 发布：填写标题、分类、价格、交易地点、描述和图片后发布资源。
- 详情：展示图片、价格、描述、交易地点、发布者信息、浏览数、收藏和联系入口。
- 收藏：添加、取消、检查收藏状态，并查看收藏列表。
- 消息与聊天：打开商品会话、会话列表、文本消息收发和已读处理。
- 我的：查看个人信息、发布数量、收藏数量、我的发布、设置和关于页。

### 管理端

- 管理员登录与 token 会话。
- 数据看板：用户、商品、分类、会话和消息统计。
- 用户管理：用户列表、状态筛选、关键字搜索、启用/禁用。
- 商品管理：商品列表、状态/分类/关键字筛选、上架/下架/售出状态管理。
- 分类管理：分类列表、状态筛选、名称、图标、描述、排序和状态维护。
- 聊天记录：会话列表和指定会话消息查看。

## 技术栈

| 模块 | 目录 | 技术 | 说明 |
| --- | --- | --- | --- |
| 微信小程序 | `miniprogram/` | 原生微信小程序 | 用户侧浏览、发布、收藏、聊天和个人中心 |
| 云函数 | `cloudfunctions/` | 微信云开发 + Node.js CommonJS | 小程序业务接口、管理端 HTTP 接口和云数据库访问 |
| 管理端 | `admin-web/` | Vite + 原生 JavaScript ES Modules | 后台管理界面 |

## 本地运行

跨电脑恢复开发请先阅读 [2026-09-22 交接文档](docs/handoff-2026-09-22.md)，其中记录最新功能、依赖安装、本地配置和待验事项。日常开发规则以 `AGENTS.md`、`spec.md` 为准。

### 小程序

1. 安装并打开微信开发者工具。
2. 导入包含 `project.config.json` 的项目根目录，其中已配置小程序和云函数目录。
3. 确认云环境 ID 为 `cloud1-d6g5stkeb92288dee`。
4. 部署需要用到的云函数后编译运行。

当前小程序页面路径统一为 `pages/{page}/index`，登录页为 `pages/login/index`。

### 云函数

云函数目录位于 `cloudfunctions/`，当前包含：

- `login`：小程序登录。
- `user`：用户资料、个人看板。
- `category`：分类列表。
- `product`：商品发布、列表、推荐、详情、我的发布和状态更新。
- `favorite`：收藏添加、取消、检查和列表。
- `chatService`：会话创建、会话列表、消息列表、消息发送和已读处理。
- `adminService`：管理端 HTTP 入口和后台 action 分发。

云函数业务返回值统一为：

```js
{
  code: 0,
  message: 'success',
  data: null
}
```

小程序通过 `miniprogram/api/index.js` 调用云函数，调用格式为：

```js
wx.cloud.callFunction({
  name,
  data: { action, data }
})
```

### 管理端

管理端目录位于 `admin-web/`。

```bash
cd admin-web
npm install
cp .env.example .env
npm run dev
```

`admin-web/.env` 需要配置：

```text
VITE_ADMIN_API_URL=https://your-admin-service-http-url
```

该地址必须指向 `adminService` 的 HTTP 访问地址，并能对 POST `{ action, data }` 返回 JSON。当前项目约定的云环境为：

```text
cloud1-d6g5stkeb92288dee
```

管理端请求统一由 `admin-web/src/api/cloud.js` 发起，请求格式为：

```js
{
  action: 'actionName',
  data: {}
}
```

受保护管理端请求会在 `data` 中携带登录 token。

## 目录结构

```text
.
├── miniprogram/
│   ├── app.js / app.json / app.wxss
│   ├── api/
│   │   └── index.js
│   ├── components/
│   │   ├── empty-state/
│   │   ├── product-card/
│   │   └── search-bar/
│   ├── images/
│   ├── mock/
│   ├── pages/
│   │   ├── about/
│   │   ├── category/
│   │   ├── chat/
│   │   ├── detail/
│   │   ├── favorites/
│   │   ├── home/
│   │   ├── login/
│   │   ├── message/
│   │   ├── my-publish/
│   │   ├── profile/
│   │   ├── publish/
│   │   └── settings/
│   └── utils/
│       ├── router.js
│       └── storage.js
├── cloudfunctions/
│   ├── adminService/
│   │   ├── index.js
│   │   ├── lib/
│   │   └── services/
│   ├── category/
│   ├── chatService/
│   ├── favorite/
│   ├── login/
│   ├── product/
│   └── user/
├── admin-web/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── api/
│       ├── components/
│       ├── layout/
│       ├── state/
│       ├── utils/
│       ├── views/
│       ├── main.js
│       └── styles.css
├── spec.md
├── AGENTS.md
└── README.md
```

## 数据与状态约定

当前代码使用的云数据库集合包括：

- `admins`
- `users`
- `categories`
- `products`
- `favorites`
- `chat_sessions`
- `chat_messages`

当前业务状态值：

| 对象 | 状态 |
| --- | --- |
| 用户 | `enabled` / `disabled` |
| 商品 | `on_sale` / `off_shelf` / `sold` |
| 分类 | `enabled` / `disabled` |
| 聊天会话 | `active` |

## 默认分类

当前默认保留 5 个核心分类：

- 数码电子
- 考研资料
- 教材书籍
- 技能服务
- 宿舍用品

如果云数据库 `categories` 集合已有启用分类，则小程序优先使用云端分类；否则使用云函数内置默认分类。

## 设计风格

- 小程序：清爽、轻量、校园感。
- 管理端：工具型后台风格，优先保证信息密度、可扫描性和操作明确。
- 主色：`#3B82F6`
- 辅助色：`#60A5FA`
- 背景色：`#F8FAFC`
- 文字主色：`#111827`
- 文字副色：`#6B7280`

## 验证命令

管理端改动后：

```bash
cd admin-web
npm run build
```

云函数 JavaScript 改动后：

```bash
find cloudfunctions -name '*.js' -print -exec node --check {} \;
```

仅修改 README 等文档时，不需要运行构建；需要检查文档内容是否与当前项目结构和 `spec.md` 冲突。

## 后续可扩展

支付、订单、真实 IM、担保交易、信用分、AI 估价、推荐算法、多学校和多租户后台等能力不在当前项目范围内。引入前需要先明确产品范围、数据模型、权限边界、接口契约和验证方式。

## License

Apache-2.0 license
