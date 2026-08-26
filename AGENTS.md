# CampusX 智能体执行说明

## 先读这些

修改代码前，先阅读 `spec.md` 以及与本次需求直接相关的源码文件。将 `spec.md` 视为项目范围、技术栈、目录结构、API 约定、状态值、UI 预期、环境说明和验证命令的事实来源。

如果用户需求与 `spec.md` 冲突，必须先明确指出冲突点，再按用户最新确认的要求执行。

## 项目结构

本仓库包含三个主要部分：

- `miniprogram/`：原生微信小程序。
- `cloudfunctions/`：微信 CloudBase 云函数。
- `admin-web/`：基于 Vite 的 Web 管理端。

除非用户明确要求迁移，否则不要用新的框架替换当前架构。

## 编码规则

- 改动范围必须聚焦在用户需求内。
- 如果用户需求存在不明确、范围含糊、输入缺失或有风险的假设，必须先向用户确认再开始实现。不得超出已确认需求自由发挥。
- 优先沿用现有代码风格，不引入新的写法模式。
- `miniprogram/` 中使用原生微信小程序 API。
- `cloudfunctions/` 中使用 CommonJS。
- `admin-web/` 中使用 ES Modules。
- 业务返回值保持 `{ code, message, data }` 结构。
- 管理端 API 调用保持 POST `{ action, data }` 结构。
- 除非任务明确需要，不要重命名已有云函数 action、数据库集合、状态枚举值、环境 ID 或页面路径。
- 如果修改小程序页面路径，必须同步更新 `miniprogram/app.json` 以及所有 `wx.navigateTo`、`wx.redirectTo`、`wx.reLaunch`、`wx.switchTab` 引用。
- 如果修改管理端 action，必须同步更新 `admin-web` 调用方和 `cloudfunctions/adminService` 分发逻辑。
- 如果文件变得过大或职责混杂，应按 `spec.md` 中描述的结构进行拆分。

## 环境与密钥

- `admin-web/.env` 是本地环境配置，除非用户明确要求，否则不应提交。
- `admin-web/.env.example` 必须保持通用且可安全共享。
- 不要在源码中硬编码新的密钥、token、私钥或密码。
- 管理端需要通过 `VITE_ADMIN_API_URL` 指向 `adminService` 的 HTTP 访问地址。该地址必须能对 POST `{ action, data }` 请求返回 JSON。

## 验证

针对本次改动的文件，运行最小但有效的验证。

管理端改动：

```bash
cd admin-web
npm run build
```

云函数 JavaScript 改动：

```bash
find cloudfunctions -name '*.js' -print -exec node --check {} \;
```

小程序路径改动：

- 检查 `miniprogram/app.json`。
- 使用 `rg` 搜索旧路径。
- 确认相关导航调用已更新。

如果因为缺少依赖、网络访问、权限限制或无法使用微信开发者工具而不能运行验证，必须明确说明哪些验证没有运行以及原因。

## Git 安全

- 不要 force push。
- 除非用户明确确认风险，否则不要通过 rebase、amend 或 squash 重写已发布历史。
- 在进行较大范围编辑前，先检查 `git status --short`。
- 除非用户明确要求，不要回退用户已有改动。
- 保留与本次任务无关的现有改动。

## 沟通方式

- 对于实现类任务，直接完成改动并说明改了什么。
- 对于 review 类任务，优先指出 bug、风险、回归或缺失测试。
- 最终回复中说明验证结果。
- 说明保持简洁、具体。
